# Testing NeuroNet on a clean Omarchy, in a VM

First run 2026-09-29, on Omarchy 4.0.4. It found four things the sandbox
tests couldn't: a fresh Omarchy has no package lists (every library failed
-- the real reason three were missing on Manthies' computer), `--check`
failed on a LocalSend copy, nothing said when NeuroNet's window never
appeared, and uninstall didn't wait for NeuroNet to close.

Needs `qemu-full edk2-ovmf socat tesseract tesseract-data-eng`, and ~20 GB.

## 1. A clean Omarchy, installed the way a person would

Omarchy's own acceptance harness drives the real installer (OCR + keystrokes):

    git clone -b quattro https://github.com/omacom/omarchy-iso.git
    curl -LO https://iso.omarchy.org/omarchy-<version>.iso    # check the .sha256
    omarchy-iso/bin/omarchy-iso-test omarchy-<version>.iso --install-only --no-preview

That leaves `test-runs/omarchy-<version>/base.qcow2` (user and password
`omarchy`) and an SSH key beside it. Its own SSH step may time out; the
image is fine.

## 2. A throwaway copy of it

    qemu-img create -f qcow2 -b base.qcow2 -F qcow2 overlay.qcow2
    cp OVMF_VARS.4m.fd run/
    qemu-system-x86_64 -cpu host -enable-kvm -machine q35,accel=kvm -smp 6 -m 8192 \
      -drive if=pflash,format=raw,readonly=on,file=/usr/share/edk2/x64/OVMF_CODE.4m.fd \
      -drive if=pflash,format=raw,file=run/OVMF_VARS.4m.fd \
      -drive file=overlay.qcow2,format=qcow2,if=none,id=drive0 \
      -device virtio-blk-pci,drive=drive0,bootindex=1 -device virtio-vga \
      -display none -vnc 127.0.0.1:6 -usb -device usb-tablet \
      -netdev user,id=net0,hostfwd=tcp:127.0.0.1:2322-:22 -device virtio-net-pci,netdev=net0 \
      -qmp unix:run/qmp.sock,server,nowait -daemonize

It boots to the login screen: type `omarchy` + Enter through QMP `send-key`
(watch with `vncviewer 127.0.0.1:6`). Switch the idle lock off
(`"idle": {"screensaver": 0, "lock": 0}` in shell.json), or keystrokes land
in the lock screen after five minutes.

## 3. NeuroNet, as someone would get it

- rsync `~/NeuroNet-to-send/NeuroNet/` to `~/NeuroNet` in the VM, then
  `chmod -R a-x+X ~/NeuroNet` -- LocalSend drops the runnable flags.
- No one is at the keyboard for sudo. In the VM only:
  `/etc/sudoers.d/zzzz-vm-test` with `Defaults:omarchy !authenticate` and
  `omarchy ALL=(ALL) NOPASSWD: ALL` -- named to sort after Omarchy's own
  sudoers files, and `!authenticate` because `omarchy update` runs `sudo -v`.
- Run things inside the desktop session with `in-session.sh` (copy it into
  the VM): it takes the whole environment of the Omarchy shell --
  `OMARCHY_PATH`, `HYPRLAND_INSTANCE_SIGNATURE` and the rest.

      ~/in-session.sh "bash ~/NeuroNet/system/install.sh --check"
      ~/in-session.sh "bash ~/NeuroNet/system/install.sh --yes"

## 4. What to check

- every library in integration/deps.txt imports
- NeuroNet's window is class `NeuroNet`, on `special:neuronet`
- Super+Alt+N (QMP send-key meta_l + alt + n) shows it; again hides it
- `install.sh --check`: "Nothing to change"; `neuronet-doctor`: no problems
- `install.sh --uninstall`: theme back, plugins and shortcuts gone,
  NeuroNet stopped, its folder and data kept

## CachyOS, app only (no Omarchy, no widgets), in Docker

`system/install-app.sh` puts NeuroNet on any Arch with Hyprland -- the app,
NeuroPets, NeuroCafe, their commands and shortcuts, no desktop widgets
(Cam, 2026-10-14, thinking of moving to CachyOS). To try it on a fresh
CachyOS without a VM:

    sudo bash system/vm/cachyos-docker.sh          # the checks
    sudo bash system/vm/cachyos-docker.sh --show   # ... then NeuroNet from the container, on this desktop
    sudo bash system/vm/cachyos-docker.sh --shell  # ... then a shell in it

It packs the code git knows (uncommitted too; never neuronet_data/), and
checks the install, `Hyprland --verify-config` on what it wrote, that the
three apps start, and the uninstall. A full CachyOS + Hyprland desktop
(logging in, the shortcuts working) still needs a VM.
