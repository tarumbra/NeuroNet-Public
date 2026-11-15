#!/bin/bash
# install-neuronet.sh -- NeuroNet onto a freshly installed computer (CachyOS or
# any Arch, KDE Plasma or Hyprland), kept up to date from then on.
#
#   bash install-neuronet.sh                  find your data drive, or a fresh ~/NeuroNet
#   bash install-neuronet.sh --check          say what it would do; change nothing
#   bash install-neuronet.sh --yes            don't ask
#   bash install-neuronet.sh --mount DIR      connect the data drive at DIR (default: where it
#                                             was before if it remembers, else /mnt/mydata)
#   bash install-neuronet.sh --link DIR       the shortcut to it (default ~/DataDrive; none: no link)
#   bash install-neuronet.sh --drive UUID     that drive, when more than one has NeuroNet on it
#   bash install-neuronet.sh --drive none     don't look for a data drive
#   bash install-neuronet.sh --app DIR        NeuroNet in DIR (a new or empty folder, or one with NeuroNet)
#   bash install-neuronet.sh --data DIR       its data somewhere else
#
# Cam, 2026-10-14: "If i want to install it straight onto another cachy OS
# machine (running KDE) ... when updates occur we can just ship it there to?"
# ... "make the necessary install-neuronet.sh for my machine that creates a
# mount point and auto mounts the secondary drive".
#
# It travels in the update bundle, beside enable-updates.sh and update_key --
# NeuroNet's READ-ONLY key to the private GitHub repository (it can download
# releases and nothing else). Its source is system/install-neuronet.sh in the
# repository; copy it into the bundle after changing it.
#
# What it does, in order:
#   1. the tools: git, ssh, jq, rsync (pacman, after asking)
#   2. the newest release, from GitHub
#   3. your data drive: every drive that isn't connected is looked inside
#      (read-only) for NeuroNet. The one that has it is connected at its old
#      place -- now and at every start, by its UUID, "nofail" (system/drives.sh)
#      -- and ~/DataDrive points to it, as on the old system, so paths your
#      data remembers still work (with the same user name).
#   4. NeuroNet: the one on that drive, brought up to the newest release (the
#      data, and what NeuroNet writes beside itself, never touched -- the same
#      rules as the updater, the old code kept in ~/.local/state/neuronet/previous);
#      else a fresh release copy in ~/NeuroNet. A release copy, never a git
#      checkout: the updater leaves git checkouts alone.
#   5. installs it for this desktop: system/install-app.sh (KDE or Hyprland,
#      found by itself: the software, commands, launchers, shortcuts)
#   6. switches updates on: enable-updates.sh. Every release arrives by itself.
set -uo pipefail
# NEURONET_REPO: a stand-in repository; NEURONET_FAKE_DRIVES: stand-in drives,
# a folder of <uuid>/ folders (test_install_neuronet.py)
REPO="${NEURONET_REPO:-https://github.com/tarumbra/NeuroNet-Public.git}"
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
APP="" DATA="" CHECK="" YES="" DRIVE="auto" MOUNT="" LINK="$HOME/DataDrive"
while [ $# -gt 0 ]; do
  case "$1" in
    --app) APP="${2:?folder}"; shift 2 ;;
    --data) DATA="${2:?folder}"; shift 2 ;;
    --drive) DRIVE="${2:?a UUID, or none}"; shift 2 ;;
    --mount) MOUNT="${2:?folder}"; shift 2 ;;
    --link) LINK="${2:?folder, or none}"; shift 2 ;;
    --check) CHECK=1; shift ;;
    --yes|-y) YES=1; shift ;;
    -h|--help) sed -n '2,42p' "$0"; exit 0 ;;
    *) echo "install-neuronet: unknown option $1 (see --help)" >&2; exit 2 ;;
  esac
done

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
say() { printf '  %s\n' "$*"; }
die() { printf '\n  \033[31m%s\033[0m\n\n' "$*" >&2; exit 1; }
ask() {
  [ -n "$YES" ] && return 0
  local a; read -r -p "  $1 [Y/n] " a </dev/tty || return 1
  [[ -z $a || $a =~ ^[Yy] ]]
}
unsafe() {
  case "$(realpath -m -- "$1")" in /|/bin|/boot|/dev|/etc|/home|/lib|/lib64|/mnt|/media|/opt|/proc|/root|/run|/sbin|/srv|/sys|/tmp|/usr|/usr/*|/var|"$(realpath -m -- "$HOME")") return 0 ;; esac
  return 1
}
[ -n "$APP" ] && { APP="$(realpath -m -- "$APP")"; unsafe "$APP" && die "NeuroNet needs a folder of its own, not $APP (e.g. ~/NeuroNet)."; }
[ -f "$HERE/update_key" ] || die "No update_key beside this script. Run it from the update bundle folder."
[ -f "$HERE/enable-updates.sh" ] || die "No enable-updates.sh beside this script. Run it from the update bundle folder."
command -v pacman >/dev/null || die "This isn't an Arch computer (no pacman)."

bold "NeuroNet onto this computer"
[ -n "$CHECK" ] || ask "Go ahead?" || die "Nothing was changed."

# ---- 1. tools ---------------------------------------------------------------------------
bold "1. The tools"
missing=()
for t in git ssh jq rsync python3; do command -v "$t" >/dev/null || missing+=("$t"); done
if [ ${#missing[@]} -eq 0 ]; then say "all here (git, ssh, jq, rsync, python3)"
else
  pkgs=$(printf '%s\n' "${missing[@]}" | sed 's/^ssh$/openssh/;s/^python3$/python/' | tr '\n' ' ')
  if [ -n "$CHECK" ]; then say "would install: $pkgs"
  else
    say "installing: $pkgs (it asks for your password)"
    # shellcheck disable=SC2086
    sudo pacman -S --needed --noconfirm $pkgs || die "Couldn't install them -- try: sudo pacman -S $pkgs"
  fi
fi

# ---- 2. the newest release ------------------------------------------------------------------
bold "2. The newest release, from GitHub"
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
# a copy of the key only this user can read -- ssh refuses one others can
# (a key sent with LocalSend often arrives readable by all)
install -m 600 "$HERE/update_key" "$work/key"
export GIT_SSH_COMMAND="ssh -i $work/key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes"
if [ -n "$CHECK" ] && ! command -v git >/dev/null; then say "would ask GitHub (git isn't here yet)"; exit 0; fi
newest=$(git ls-remote --tags --refs "$REPO" 'v*' 2>/dev/null | sed -n 's#.*refs/tags/v##p' \
         | grep -E '^[0-9]+(\.[0-9]+)*$' | sort -V | tail -1)
[ -n "$newest" ] || die "GitHub didn't answer (offline, or the key isn't accepted). Nothing was changed."
say "newest release: $newest"
git -c advice.detachedHead=false clone -q --depth 1 --branch "v$newest" "$REPO" "$work/new" 2>"$work/clone.log" \
  || { cat "$work/clone.log" >&2; die "Couldn't download release $newest. Nothing was changed."; }
[ -f "$work/new/system/install-app.sh" ] \
  || die "Release $newest is from before NeuroNet could be installed without Omarchy (no system/install-app.sh). Put out a newer release first."

# ---- 3. the data drive ------------------------------------------------------------------------
bold "3. Your data drive"
FOUND=""        # NeuroNet on the data drive, once it's connected
if [ -n "$APP" ]; then say "not looked for (--app says where NeuroNet goes)"
elif [ "$DRIVE" = none ]; then say "not looked for (--drive none)"
else
  # each drive not connected -- or connected by the desktop on its own (KDE puts
  # a drive you open at /run/media/<you>/<label>; Cam's laptop, 2026-10-14) --
  # looked inside read-only: "uuid|fs|label|size|device|where the desktop has it"
  peek() {
    if [ -n "${NEURONET_FAKE_DRIVES:-}" ]; then        # tests: <uuid>/ folders stand in for drives
      for d in "$NEURONET_FAKE_DRIVES"/*/; do
        d="${d%/}"; printf '%s|ext4|%s|1T|%s|%s\n' "$(basename "$d")" "$(cat "$d/.label" 2>/dev/null)" "$d" \
          "$([ -e "$d/.automounted" ] && echo "$d")"
      done
      return
    fi
    lsblk -J -o PATH,UUID,FSTYPE,LABEL,SIZE,MOUNTPOINTS,TYPE 2>/dev/null | python3 -c '
import json, sys
def walk(ds):
    for d in ds:
        yield d
        yield from walk(d.get("children") or [])
for d in walk(json.load(sys.stdin).get("blockdevices", [])):
    mps = [m for m in (d.get("mountpoints") or []) if m]
    # opened by the desktop (/run/media, /media), or connected under /mnt already (an earlier run of this)
    auto = [m for m in mps if m.startswith(("/run/media/", "/media/", "/mnt/"))]
    if d.get("type") in ("part", "disk", "crypt") and d.get("uuid") and d.get("fstype") in ("ext4", "btrfs", "xfs", "f2fs") \
       and len(auto) == len(mps):
        print("%s|%s|%s|%s|%s|%s" % (d["uuid"], d["fstype"], d.get("label") or "", d.get("size") or "?", d["path"],
                                     auto[0] if auto else ""))'
  }
  candidates=()
  while IFS='|' read -r uuid fs label size dev auto; do
    [ -n "$uuid" ] || continue
    [ "$DRIVE" != auto ] && [ "$DRIVE" != "$uuid" ] && continue
    root="$dev"
    if [ -n "$auto" ]; then root="$auto"                # open already (the desktop's, or /mnt): look there
    elif [ -z "${NEURONET_FAKE_DRIVES:-}" ]; then
      root="$work/peek"; mkdir -p "$root"
      sudo mount -o ro "$dev" "$root" 2>/dev/null || continue
    fi
    rel=""; was=""
    for p in "$root"/NeuroNet "$root"/*/NeuroNet; do
      [ -f "$p/neuronet.py" ] && { rel="${p#"$root"/}"; break; }
    done
    ver=""; [ -n "$rel" ] && ver=$(tr -d ' \n' < "$root/$rel/VERSION" 2>/dev/null)
    if [ -n "$rel" ] && [ -f "$root/$rel/neuronet_data/drives.json" ]; then
      was=$(jq -r --arg u "$uuid" '.drives[] | select(.uuid == $u) | .where' "$root/$rel/neuronet_data/drives.json" 2>/dev/null | head -1)
    fi
    # the old system's user, from paths the data remembers (/home/<them>/DataDrive/...)
    olduser=""
    if [ -n "$rel" ]; then
      olduser=$( { cat "$root/$rel/library_path.txt" 2>/dev/null
                   find "$root/$rel/neuronet_data" -maxdepth 2 -name '*.json' -size -20M -print0 2>/dev/null | xargs -0 cat 2>/dev/null
                 } | grep -oE '/home/[a-z_][a-z0-9_-]*/DataDrive' | sort | uniq -c | sort -rn | awk '{print $2}' \
                   | sed -E 's#^/home/([^/]+)/DataDrive$#\1#' | grep -vx "$(id -un)" | head -1)
    fi
    [ -z "$auto" ] && [ -z "${NEURONET_FAKE_DRIVES:-}" ] && sudo umount "$root" 2>/dev/null
    isgit=""; [ -n "$rel" ] && [ -e "$root/$rel/.git" ] && isgit=1
    [ -n "$rel" ] && candidates+=("$uuid|$fs|$label|$size|$rel|$was|$ver|$dev|$auto|$olduser|$isgit")
  done < <(peek)

  if [ ${#candidates[@]} -eq 0 ]; then
    say "no drive with NeuroNet on it (any connected already are left as they are) -- a fresh NeuroNet then"
  elif [ ${#candidates[@]} -gt 1 ]; then
    say "NeuroNet is on more than one drive:"
    for c in "${candidates[@]}"; do IFS='|' read -r u f l s r w v _ <<<"$c"; say "  $u  $s ${l:+\"$l\"}  ($r)"; done
    die "Say which: bash $0 --drive <UUID>"
  else
    IFS='|' read -r uuid fs label size rel was dver dev auto olduser isgit <<<"${candidates[0]}"
    fixed=""; case "$auto" in /mnt/*) fixed="$auto"; auto="" ;; esac   # connected under /mnt already: stays there
    where="${MOUNT:-${fixed:-${was:-/mnt/mydata}}}"
    say "NeuroNet is on the $size drive${label:+ \"$label\"} (UUID $uuid), in $rel"
    [ -n "$auto" ] && say "(the desktop has it open at $auto for now)"
    say "it goes at $where${was:+ (where it was before)}, now and at every start"
    [ -n "$olduser" ] && say "your data remembers paths in /home/$olduser/DataDrive -- that will point to it too"
    FOUND="$where/$rel"
    if [ -n "$CHECK" ]; then
      say "(--check) would connect it there$([ "$LINK" != none ] && echo " and point $LINK to it")${olduser:+ (and /home/$olduser/DataDrive)}"
      bold "4. NeuroNet $newest in $FOUND"
      [ -n "$isgit" ] && say "(--check) it's a git copy: would make it a release copy first (its git history kept beside it)"
      say "(--check) would bring NeuroNet ${dver:-?} up to $newest -- its data untouched"
      bold "(--check) would then install it for this desktop and switch daily updates on."
      exit 0
    elif ask "Connect it at $where?"; then
      if [ -n "$auto" ] && [ -z "${NEURONET_FAKE_DRIVES:-}" ]; then
        # let go of the desktop's own connection first (nothing of NeuroNet's runs from it yet)
        udisksctl unmount -b "$dev" >/dev/null 2>&1 || sudo umount "$auto" \
          || die "Couldn't disconnect it from $auto (is something open on it? close it, then run this again)."
        say "disconnected from $auto"
      fi
      printf '{"saved": "install-neuronet", "drives": [{"uuid": "%s", "where": "%s", "fs": "%s", "options": "defaults", "label": "%s", "size": "%s", "owner": null}]}\n' \
        "$uuid" "$where" "$fs" "$label" "$size" > "$work/drive.json"
      sudo env NEURONET_DRIVES="$work/drive.json" ${NEURONET_FSTAB:+NEURONET_FSTAB="$NEURONET_FSTAB"} \
        ${NEURONET_BYUUID:+NEURONET_BYUUID="$NEURONET_BYUUID"} bash "$work/new/system/drives.sh" restore --yes \
        || die "Couldn't connect the drive -- see above. Nothing else was changed."
      [ -f "$FOUND/neuronet.py" ] || die "The drive is connected at $where, but NeuroNet isn't at $FOUND."
      if [ "$LINK" != none ]; then
        if [ -L "$LINK" ] || [ ! -e "$LINK" ]; then ln -sfn "$where" "$LINK"; say "$LINK -> $where"
        else say "$LINK already exists (not a link) -- left as it is"; fi
      fi
      # the old system's user's path, for what the data remembers: /home/<them>/DataDrive -> the drive
      OLDHOME="${NEURONET_OLDHOME_ROOT:-/home}/$olduser"     # tests: a made-up /home
      if [ -n "$olduser" ] && [ ! -e "$OLDHOME/DataDrive" ]; then
        if ask "Make /home/$olduser/DataDrive point to it, so paths your data remembers keep working?"; then
          { [ -d "$OLDHOME" ] || sudo mkdir -p "$OLDHOME"; } && sudo ln -sfn "$where" "$OLDHOME/DataDrive" \
            && say "/home/$olduser/DataDrive -> $where"
        fi
      fi
    else
      FOUND=""; say "left alone -- a fresh NeuroNet then"
    fi
  fi
fi

# ---- 4. NeuroNet ---------------------------------------------------------------------------
APP="${APP:-${FOUND:-$HOME/NeuroNet}}"
bold "4. NeuroNet $newest in $APP"
if [ -f "$APP/neuronet.py" ]; then
  have=$(tr -d ' \n' < "$APP/VERSION" 2>/dev/null || true)
  if [ -e "$APP/.git" ]; then
    # A git copy (the laptop's, 2026-10-14: "/mnt/mydata/NeuroNet is a git
    # checkout ... git pull" -- a pull a fresh system can't do, into a copy the
    # updater never updates). Offered as a release copy instead; its git
    # history is kept BESIDE it (inside, every update's backup would carry it).
    hist="$(dirname "$APP")/$(basename "$APP").git-before-$(date +%Y%m%d-%H%M%S)"
    say "this NeuroNet (${have:-?}) is a git copy -- the kind for developing in, which never updates itself"
    dirty=$(git -C "$APP" status --porcelain --untracked-files=no 2>/dev/null | head -8)
    if [ -n "$dirty" ]; then
      say "it has changes that were never committed (the old code is kept as a backup either way):"
      printf '%s\n' "$dirty" | sed 's/^/      /'
    fi
    if [ -n "$CHECK" ]; then
      say "(--check) would make it a release copy (its git history kept at $hist),"
      say "          then bring it up to $newest -- its data untouched"
    elif ask "Make it a release copy that updates itself? (its git history is kept at $hist)"; then
      mv "$APP/.git" "$hist" || die "Couldn't move its git history aside -- nothing else was changed."
      say "git history kept at $hist"
    else
      [ -f "$APP/system/install-app.sh" ] || die "Left as a git copy, and it's from before 1.0.113, so it can't be installed this way.
  The drive itself is set up${FOUND:+ (at $(dirname "$FOUND"))}; nothing else was changed.
  Run this again and answer y to make it a release copy -- or bring it up to date yourself with git."
      say "left as a git copy; it's updated with git, not by the updater"
    fi
  fi
  if [ -e "$APP/.git" ]; then :
  elif [ -n "$CHECK" ]; then say "(--check) would bring NeuroNet ${have:-?} up to $newest -- its data untouched"
  else
    # the updater's rules: the data and what NeuroNet writes beside itself are never touched
    excl=(--exclude=.git --exclude=/neuronet_data --exclude=/neuronet.log --exclude=/library_path.txt
          --exclude='*.bak' --exclude=__pycache__)
    [ -n "$DATA" ] && case "$(realpath -m -- "$DATA")" in "$APP"/*) excl+=("--exclude=/${DATA#"$APP"/}") ;; esac
    prev="${XDG_STATE_HOME:-$HOME/.local/state}/neuronet/previous"
    rm -rf "$prev"; mkdir -p "$prev"
    rsync -a "${excl[@]}" "$APP/" "$prev/" || die "Couldn't keep a copy of the code there -- nothing changed."
    rsync -a --checksum "${excl[@]}" "$work/new/" "$APP/" || die "The copy stopped part-way; the old code is in $prev."
    say "NeuroNet ${have:-?} -> $newest (your data untouched; the old code kept in $prev)"
  fi
else
  [ -d "$APP" ] && [ -n "$(ls -A "$APP" 2>/dev/null)" ] && die "$APP isn't empty. Choose another: --app <folder>"
  if [ -n "$CHECK" ]; then
    bold "(--check) would put NeuroNet $newest in $APP, install it for this desktop, and switch daily updates on."
    exit 0
  fi
  mkdir -p "$APP"
  rsync -a --exclude=.git "$work/new/" "$APP/" || die "Couldn't copy it into $APP."
  say "a fresh NeuroNet (a release copy: the updater keeps it current)"
fi
if [ -n "$CHECK" ]; then
  bold "(--check) would then install it for this desktop and switch daily updates on."
  exit 0
fi

# ---- 5. for this desktop -----------------------------------------------------------------------
bold "5. Installing it for this desktop"
inst=(bash "$APP/system/install-app.sh")
[ -n "$YES" ] && inst+=(--yes)
[ -n "$DATA" ] && inst+=(--data "$DATA")
"${inst[@]}" || die "install-app.sh didn't finish -- see above. Run it again: bash $APP/system/install-app.sh"

# ---- 6. updates -------------------------------------------------------------------------------
bold "6. Updates"
if [ -e "$APP/.git" ]; then say "a git checkout: not switched on (it's updated with git)"
else
  upd=(bash "$HERE/enable-updates.sh" --app "$APP" --key "$HERE/update_key")
  [ -n "$YES" ] && upd+=(--yes)
  "${upd[@]}" || die "enable-updates.sh didn't finish -- see above. NeuroNet is installed; run it again for updates."
fi

bold "All done: NeuroNet $newest in $APP."
say "Log out and back in once, so the shortcuts and the start-at-login take effect."
say "Then delete this bundle folder: it holds the key (a copy is kept in ~/.config/neuronet)."
