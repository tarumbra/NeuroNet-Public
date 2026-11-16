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


def edit(rel, pairs, regex=False, optional=False):
    path = os.path.join(root, rel)
    if optional and not os.path.exists(path):
        print("  (no", rel, "in this builder -- skipped)")
        return
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
    # (2026-11-16: Omarchy's builder now DROPS names no repository offers, and strips them from the
    # install too -- so neuronet leaves both lists before that step; the root image still gets it
    # from the shipped omarchy-base.packages copy, step 3b)
    ('mkdir -p /tmp/offlinedb\n# A package name the lists carry',
     '# NeuroNet: built locally (system/iso/build.sh), so never downloaded or resolved online.\n'
     'mapfile -t all_packages < <(printf \'%s\\n\' "${all_packages[@]}" | grep -Fxv neuronet || true)\n'
     'mapfile -t target_packages < <(printf \'%s\\n\' "${target_packages[@]}" | grep -Fxv neuronet || true)\n\n'
     'mkdir -p /tmp/offlinedb\n# A package name the lists carry'),
    # copied in, and kept when the mirror is pruned
    ('printf \'%s\\n\' "${required_package_files[@]}" |\n  bash /builder/prune-offline-mirror.sh "$offline_mirror_dir"',
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
     'printf \'%s\\n\' "${required_package_files[@]}" |\n  bash /builder/prune-offline-mirror.sh "$offline_mirror_dir"'),
])

# 2b. (apple-bcm-firmware's rename: Omarchy's builder follows it itself since Nov 2026 -- our edit removed)


# 1b. after the build, omarchy-iso-make looks for the ISO by name: ours is neuronet-*.iso (2026-11-16)
edit("bin/omarchy-iso-make", [(
    'iso_name=omarchy\n[[ ${OMARCHY_OEM_INSTALL:-} == "1" ]] && iso_name=omarchy-oem\n',
    'iso_name=neuronet\n[[ ${OMARCHY_OEM_INSTALL:-} == "1" ]] && iso_name=omarchy-oem\n'),
])


# 1c. the build container may be NEWER than Omarchy's mirror (2026-11-16: a fresh archlinux:latest had
# OpenSSL 4.1 while Omarchy stable was on 3.6.5, and -Syu refused to install anything). -Syuu lets
# the container step back to the mirror's versions, so it matches what the ISO is built from.
edit("builder/build-iso.sh", [(
    'pacman --noconfirm -Syu archiso git sudo base-devel',
    'pacman --noconfirm -Syuu archiso git sudo base-devel'),
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
edit("configs/efiboot/loader/entries/01-archiso-x86_64-linux.conf", [("title    Omarchy", "title    NeuroNet")], optional=True)  # gone Nov 2026: GRUB boots EFI too
edit("configs/grub/grub.cfg", [('menuentry "Omarchy', 'menuentry "NeuroNet')])
edit("configs/grub/loopback.cfg", [('menuentry "Omarchy', 'menuentry "NeuroNet')])
print("customize.py: done")
