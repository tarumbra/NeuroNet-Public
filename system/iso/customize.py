#!/usr/bin/env python3
"""Turn a checkout of omarchy-iso into the NeuroNet ISO's builder.

    python3 system/iso/customize.py <omarchy-iso checkout>

Run by system/iso/build.sh on a clean checkout (it resets it first). Every
change is a small edit anchored on text Omarchy's builder has today; if a new
Omarchy release moves that text, this stops and says which anchor is gone,
rather than building an ISO without NeuroNet in it.

What changes (NeuroNet System plan, Stage 5):
  * the offline mirror also carries the `neuronet` package, built by build.sh
    and mounted into the build container at /neuronet-pkgs
  * the installer installs `neuronet` and everything it needs, from that
    mirror (builder/archinstall.packages)
  * the ISO is called NeuroNet: file name, volume label, boot menus
The installer's own screens are left as Omarchy wrote them: Omarchy's
acceptance harness (bin/omarchy-iso-test) reads them to drive a test install.
"""
import os
import re
import sys

root = sys.argv[1] if len(sys.argv) > 1 else "."


def edit(rel, pairs, regex=False):
    path = os.path.join(root, rel)
    with open(path, encoding="utf-8") as f:
        text = f.read()
    for old, new in pairs:
        if regex:
            text, n = re.subn(old, new, text)
        else:
            n = text.count(old)
            text = text.replace(old, new)
        if not n:
            sys.exit("customize.py: %s no longer has %r -- omarchy-iso changed; update system/iso/customize.py"
                     % (rel, old[:70]))
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print("  edited", rel)


# 1. the build container sees the neuronet package ---------------------------------
edit("bin/omarchy-iso-make", [(
    'if [[ -n $LOCAL_OMARCHY_PATH ]]; then\n  DOCKER_ARGS+=(',
    '# NeuroNet: the neuronet package for the offline mirror (system/iso/build.sh)\n'
    'if [[ -n ${NEURONET_PKG_DIR:-} ]]; then\n'
    '  DOCKER_ARGS+=(-v "$NEURONET_PKG_DIR:/neuronet-pkgs:ro")\n'
    'fi\n\n'
    'if [[ -n $LOCAL_OMARCHY_PATH ]]; then\n  DOCKER_ARGS+=('),
])

# 2. ... and puts it in the offline mirror --------------------------------------------
edit("builder/build-iso.sh", [
    # not downloaded: it's nowhere online
    ('mkdir -p /tmp/offlinedb\ndownload_offline_packages() {',
     '# NeuroNet: built locally (system/iso/build.sh), so never downloaded.\n'
     'mapfile -t all_packages < <(printf \'%s\\n\' "${all_packages[@]}" | grep -Fxv neuronet || true)\n\n'
     'mkdir -p /tmp/offlinedb\ndownload_offline_packages() {'),
    # copied in, and kept when the mirror is pruned
    ('printf \'%s\\n\' "${required_package_files[@]}" |\n  bash /builder/prune-offline-mirror.sh',
     '# NeuroNet: the package itself, into the mirror and the keep-set.\n'
     'if compgen -G "/neuronet-pkgs/neuronet-*.pkg.tar.zst" >/dev/null; then\n'
     '  for neuronet_pkg in /neuronet-pkgs/neuronet-*.pkg.tar.zst; do\n'
     '    cp "$neuronet_pkg" "$offline_mirror_dir/"\n'
     '    required_package_files+=("${neuronet_pkg##*/}")\n'
     '  done\n'
     'else\n'
     '  echo "ERROR: no neuronet package in /neuronet-pkgs (NEURONET_PKG_DIR)" >&2\n'
     '  exit 1\n'
     'fi\n\n'
     'printf \'%s\\n\' "${required_package_files[@]}" |\n  bash /builder/prune-offline-mirror.sh'),
])

# 2b. packages renamed upstream that Omarchy's published lists still name -----------
# (the same fix Omarchy's builder makes for broadcom-wl). 2026-09-30: the
# arch-mact2 repo renamed apple-bcm-firmware to apple-bcm-firmware-fetcher
# (conflicts=apple-bcm-firmware), and every build -- Omarchy's own too -- failed
# with "target not found: apple-bcm-firmware". Only T2 Macs use it.
edit("builder/build-iso.sh", [(
    "sed 's/^broadcom-wl$/broadcom-wl-dkms/'",
    "sed -e 's/^broadcom-wl$/broadcom-wl-dkms/' -e 's/^apple-bcm-firmware$/apple-bcm-firmware-fetcher/'"),
])

# 3. the installer installs it, and the mirror carries its depends ----------------
# The depends are listed too, not left to pacman: the mirror is filled from
# this list (neuronet itself isn't downloaded, so its depends wouldn't be).
pkgbuild = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "pkg", "PKGBUILD"),
                encoding="utf-8").read()
m = re.search(r"^depends=\(([^)]*)\)", pkgbuild, re.M)
if not m:
    sys.exit("customize.py: no depends=( ) in pkg/PKGBUILD")
depends = m.group(1).split()
with open(os.path.join(root, "builder/archinstall.packages"), "a", encoding="utf-8") as f:
    f.write("\n# NeuroNet (system/iso/customize.py): the app and what it needs\nneuronet\n"
            + "".join(d + "\n" for d in depends))
print("  edited builder/archinstall.packages (neuronet + %d depends)" % len(depends))

# 3b. ... and the installer installs it ----------------------------------------------
# archinstall.packages only fills the mirror: what the installer puts on the
# new computer is the runtime plus the ISO's own copy of omarchy-base.packages
# (orchestrator _runtime_package_list). The first ISO (2026-09-30) carried
# neuronet in its mirror and installed without it -- found in the VM test.
edit("builder/build-iso.sh", [(
    'cp "${base_pkg_lists[0]}" "$build_cache_dir/airootfs/usr/share/omarchy-iso/omarchy-base.packages"\n',
    'cp "${base_pkg_lists[0]}" "$build_cache_dir/airootfs/usr/share/omarchy-iso/omarchy-base.packages"\n'
    '# NeuroNet: installed on the new computer with Omarchy (its depends come with it)\n'
    'printf \'\\n# NeuroNet\\nneuronet\\n\' >> "$build_cache_dir/airootfs/usr/share/omarchy-iso/omarchy-base.packages"\n'),
])

# 4. its name ------------------------------------------------------------------------
edit("configs/profiledef.sh", [
    ('iso_name="omarchy"', 'iso_name="neuronet"'),
    ('iso_label="OMARCHY_', 'iso_label="NEURONET_'),
    ('iso_publisher="Omarchy <https://omarchy.org>"', 'iso_publisher="NeuroNet, built on Omarchy <https://omarchy.org>"'),
    ('iso_application="Omarchy Installer"', 'iso_application="NeuroNet Installer"'),
])
edit("configs/syslinux/archiso_head.cfg", [("MENU TITLE Omarchy", "MENU TITLE NeuroNet")])
edit("configs/syslinux/archiso_sys-linux.cfg", [("Omarchy", "NeuroNet")])
edit("configs/efiboot/loader/entries/01-archiso-x86_64-linux.conf", [("title    Omarchy", "title    NeuroNet")])
edit("configs/grub/grub.cfg", [('menuentry "Omarchy', 'menuentry "NeuroNet')])
edit("configs/grub/loopback.cfg", [('menuentry "Omarchy', 'menuentry "NeuroNet')])
print("customize.py: done")
