# The NeuroNet ISO

Boot it from a USB stick, install, log in: it's NeuroNet. (NeuroNet System
plan, Stage 5.)

## Build

    bash system/iso/build.sh            # -> ~/NeuroNet-ISO/release/neuronet-<version>.iso (+ .sha256)

It takes Omarchy's own ISO builder (omacom/omarchy-iso, branch quattro) fresh,
makes it NeuroNet's with `customize.py`, and builds it in Docker the way
Omarchy does. It asks for your password (to start Docker and for the build).
The ISO takes what is **committed** in this repo -- commit first.
Following a new Omarchy release is just running it again. If Omarchy has
moved something `customize.py` edits, it stops and names the file.

    bash system/iso/build.sh --package  # just the neuronet package
    bash system/iso/build.sh --prepare  # package + customised builder, no Docker

## What's in it

- Omarchy, installed exactly as its own ISO does -- offline, from the package
  mirror inside the ISO.
- The `neuronet` package (`pkg/PKGBUILD`): NeuroNet's code at
  `/opt/neuronet/NeuroNet` (code only -- no one's data; tests and this
  computer's notes left out) and, as its depends, every library
  `integration/deps.txt` needs. PowerPoint export (python-pptx) is in the AUR,
  so it's added later online: `omarchy pkg aur add python-pptx`.
- `neuronet-firstboot`, from `/etc/xdg/autostart`: at each person's first
  login it copies NeuroNet to `~/NeuroNet`, runs `system/install.sh --yes
  --offline`, gives a new NeuroNet the desktop's theme, and opens it on the
  welcome -- *Bring my NeuroNet across* or *Start fresh*. Its log:
  `~/.local/state/neuronet/firstboot.log`.
- The name: `neuronet-<version>.iso`, volume `NEURONET_<yyyymm>`, NeuroNet in
  the boot menus. The installer's own screens are Omarchy's, unchanged: its
  test harness reads them.

## Test it

    ~/NeuroNet-ISO/omarchy-iso/bin/omarchy-iso-test ~/NeuroNet-ISO/release/neuronet-<version>.iso --install-only

(installs it in a VM by reading the screens and typing, as a person would;
see `system/vm/README.md` for logging in and checking NeuroNet). The package
and first login were checked on a clean Omarchy 4.0.4 VM on 2026-09-30.

## Updates (Stage 6)

Computers from the ISO update NeuroNet themselves: `neuronet-update`, daily,
takes the newest release -- a git tag `v<VERSION>` on NeuroNet's private
GitHub repository -- keeping the data folder untouched (see the script).

For that the ISO needs, in `~/NeuroNet-ISO/secrets/` (never in the repo):

- `update.json` -- `{"repo": "git@github.com:<owner>/<repo>.git"}`
- `update_key` -- the private half of a **read-only** deploy key on that repo

Without them the ISO still builds; its computers just don't update.

To release: bump `VERSION`, add the release to `CHANGELOG.md`, commit, then
`git tag v<version> && git push origin main --tags`. Installed computers pick
it up within a day (`neuronet-update --check` shows what they have).
