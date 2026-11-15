#!/usr/bin/env bash
# Build the NeuroNet ISO (NeuroNet System plan, Stage 5).
#
#   bash system/iso/build.sh              the ISO, into ~/NeuroNet-ISO/release/
#   bash system/iso/build.sh --package    only the neuronet package (quick; for tests)
#   bash system/iso/build.sh --prepare    the package and the customised builder, no build
#
# One command per Omarchy release: it takes Omarchy's own ISO builder
# (omacom/omarchy-iso, OMARCHY_ISO_BRANCH, default quattro) fresh, makes it
# NeuroNet's with customize.py, and builds. What goes in:
#
#   * Omarchy, exactly as its own ISO installs it -- offline, from the mirror
#     inside the ISO
#   * the `neuronet` package (pkg/PKGBUILD): NeuroNet's code as committed in
#     this repo (git archive -- code only, never anyone's data; tests and this
#     computer's notes left out), and every library it needs
#   * at each person's first login, neuronet-firstboot: NeuroNet set up
#     offline, opening on its welcome (bring a NeuroNet across, or start fresh)
#
# Needs: git, makepkg, docker (the build runs in Arch's container, as
# Omarchy's does) -- and sudo, which it asks for: to start docker and to run
# the privileged build. ~15 GB free in ~/NeuroNet-ISO; a first build downloads
# the whole Omarchy package set (~3 GB) and takes a while.
set -euo pipefail
REPO=$(cd "$(dirname "$0")/../.." && pwd)
ISO_DIR="$(dirname "$0")"
WORK="${NEURONET_ISO_WORK:-$HOME/NeuroNet-ISO}"
BRANCH="${OMARCHY_ISO_BRANCH:-quattro}"
PACKAGE_ONLY="" PREPARE_ONLY=""
[ "${1:-}" = "--package" ] && PACKAGE_ONLY=1
[ "${1:-}" = "--prepare" ] && PREPARE_ONLY=1
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ------------------------------------------------------------ the package --
say "1. The neuronet package"
cd "$REPO"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "  Uncommitted changes in $REPO -- the ISO takes what's COMMITTED. Commit first," >&2
  echo "  or they won't be in it. (git status)" >&2
  [ -n "${NEURONET_ISO_ALLOW_DIRTY:-}" ] || exit 1
fi
count=$(git rev-list --count HEAD)
version="$(tr -d " \n" < VERSION).r${count}.$(git rev-parse --short HEAD)"
pkgdir="$WORK/pkg"
rm -rf "$pkgdir"; mkdir -p "$pkgdir"
git archive --format=tar -o "$pkgdir/neuronet-$version.tar" HEAD -- . \
  ':!test' ':!system/vm' ':!system/INVENTORY.md' ':!system/notes-*' ':!system/iso'
cp "$ISO_DIR/neuronet-firstboot" "$ISO_DIR/neuronet-firstboot.desktop" "$pkgdir/"
sed "s/@PKGVER@/$version/" "$ISO_DIR/pkg/PKGBUILD" > "$pkgdir/PKGBUILD"
# Updates (Stage 6): the repository and its read-only deploy key, kept out of
# the repo in $WORK/secrets (system/iso/README.md). Without them the ISO
# still builds; its computers just don't update themselves.
if [ -f "$WORK/secrets/update.json" ]; then
  mkdir -p "$pkgdir/src"
  cp "$WORK/secrets/update.json" "$pkgdir/src/"
  [ -f "$WORK/secrets/update_key" ] && cp "$WORK/secrets/update_key" "$pkgdir/src/"
  echo "  with updates from $(jq -r .repo "$WORK/secrets/update.json")"
else
  echo "  (no $WORK/secrets/update.json: computers from this ISO won't update themselves)"
fi
(cd "$pkgdir" && PKGDEST="$pkgdir/out" makepkg --nodeps --force --noconfirm >/dev/null)
pkgfile=$(ls "$pkgdir"/out/neuronet-*.pkg.tar.zst)
echo "  $pkgfile"
[ -n "$PACKAGE_ONLY" ] && exit 0

# ------------------------------------------------------ Omarchy's builder --
say "2. Omarchy's ISO builder ($BRANCH), made NeuroNet's"
src="$WORK/omarchy-iso"
if [ ! -d "$src/.git" ]; then
  git clone -b "$BRANCH" https://github.com/omacom/omarchy-iso.git "$src"
else
  git -C "$src" fetch -q origin "$BRANCH"
  git -C "$src" checkout -q -f -B "$BRANCH" "origin/$BRANCH"
  git -C "$src" clean -fdq -e release -e test-runs      # last build's edits gone; ISOs and VM images kept
fi
echo "  omarchy-iso at $(git -C "$src" rev-parse --short HEAD)"
python3 "$ISO_DIR/customize.py" "$src"
[ -n "$PREPARE_ONLY" ] && { echo "  ready in $src (--prepare: not built)"; exit 0; }

# ------------------------------------------------------------------ build --
say "3. Building (docker, as Omarchy does -- it asks for your password)"
if ! systemctl is-active -q docker; then sudo systemctl start docker; fi
cd "$src"
NEURONET_PKG_DIR="$pkgdir/out" ./bin/omarchy-iso-make --keep-pkg-cache --no-boot-offer

iso=$(ls -t "$src"/release/neuronet-*.iso | head -1)
mkdir -p "$WORK/release"
out="$WORK/release/neuronet-$version.iso"
mv -f "$iso" "$out"
(cd "$WORK/release" && sha256sum "$(basename "$out")" > "$(basename "$out").sha256")
say "Done: $out"
echo "  Test it in a VM:  $src/bin/omarchy-iso-test $out --install-only"
