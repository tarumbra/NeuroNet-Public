# The NeuroNet layer — inventory

Stage 0 of the NeuroNet System plan (`~/Documents/NeuroNet System - Project Plan.pdf`).
Taken 29 September 2026 on **fluffs** (Cam's laptop, user `tarumbra`, NeuroNet in
`/home/tarumbra/DataDrive/NeuroNet` = `/mnt/mydata/NeuroNet`), on Omarchy 4.0.4.

Everything that makes a fresh Omarchy install into NeuroNet, sorted three ways:

- **System** — ships on every NeuroNet machine (the ISO, the installer).
- **Personal** — Cam's (or whoever's) own; arrives by the new-machine import, never in the ISO.
- **Machine** — belongs to one computer's hardware or screen; made fresh on each.

`system/collect.sh` copies the live system files into this folder;
run it after changing any of them, then commit.

Files several widgets share (NeuroNetPaths.qml, the card tools'
bar/service/journal script) each have ONE source, named in
`system/omarchy/shared.json`. `system/shared_files.py` checks the copies
(`--write` makes them from the sources); the installer builds the widgets
from the sources, and `collect.sh` takes an edit made in one live copy back
to its source and the other copies.

---

## 1. The app — System

| What | Where | Notes |
|---|---|---|
| NeuroNet | this repo: `neuronet.py`, `*.py`, `crux/`, `ui/`, `icons/` | ~18 MB without data |
| Helper commands | `neuronet-quick`, `neuronet-call`, `neuronet-music`, `neuronet-menu`, `neuronet-capture`, `neuronet-snip`, `neuronet-media-art`, `neuronet-open` | |
| Launcher | `~/.local/share/applications/NeuroNet.desktop` | made from `system/templates/NeuroNet.desktop.in` by `neuronet-setup` |
| Tests | `test/` | JS tests need `jsdom`, the visualizer test needs Playwright — neither installed here |

### Packages it needs (beyond Omarchy)

All from Arch packages on this machine — nothing from pip:

`python-pywebview` `python-pyqt6` `python-pyqt6-webengine` `python-qtpy` `python-pillow`
`python-docx` `python-openpyxl` `python-pymupdf` `ffmpeg` (ffprobe) `jq` `mpv` (optional)

**Missing here, and missing from `integration/deps.txt`:**
`python-reportlab` (Kitchen PDF prints, Training documents) and `python-pptx`
(PowerPoint export). Both are imported only when used, so those features fail
quietly on this machine. → add to deps; install.

### Other packages on this machine beyond Omarchy — decide per item for the ISO

`brave-bin` `spotify` `kodi` + 4 kodi add-ons (+ AUR `ffmpeg6.1`) `kate` `nano`
`freerdp` `gst-libav` `gst-plugins-bad` `gst-plugins-good` `cd-discid` `openbsd-netcat`.
Hardware-only (Machine): `intel-ucode`, `efibootmgr`, `mkinitcpio`.

## 2. The desktop layer — System

All collected into this folder.

| What | Live on the computer | In the repo |
|---|---|---|
| 8 shell plugins | `~/.config/omarchy/plugins/neuronet.*` | `system/omarchy/plugins/` |
| &nbsp;&nbsp;launcher, music, fleeting, tarot, oracle, lenormand, gamemode | top-bar widgets (the desktop widgets went 3 Nov 2026) | |
| &nbsp;&nbsp;dock | the NeuroNet dock (replaces Arc Dock) | |
| &nbsp;&nbsp;gamemode | Game Mode controller + `gamemode.py` | |
| Themes NeuroNet, NeuroNet Light | `~/.config/omarchy/themes/neuronet{,-light}` | `system/omarchy/themes/` (no wallpapers) |
| Wallpapers (7 dark, 4 light) | the themes' `backgrounds/` | Cam's pictures, `system/wallpapers/photos/{dark,light}`, put in place by `system/wallpapers/make.sh` |
| Theme-set hook | `~/.config/omarchy/hooks/theme-set.d/neuronet-theme` | `system/omarchy/hooks/` |
| Plugins + bar places | `~/.config/omarchy/shell.json` | `system/omarchy/shell.neuronet.json` (+ what they replace) |
| Shortcuts, autostart, window rule | the `>>> NeuroNet` blocks in `~/.config/hypr/{bindings,autostart,hyprland}.lua` | `system/hypr/*.block` |
| Omarchy-menu indexer | `~/.config/systemd/user/neuronet-menu.{path,service}` | made from `system/templates/` by `neuronet-setup` |
| Omarchy-menu rows | `~/.config/omarchy/extensions/omarchy-menu.jsonc` | *Machine* — written per computer by `neuronet-menu` |

## 3. Personal — arrives by import, never in the ISO

| What | Where | Size |
|---|---|---|
| All NeuroNet data | `neuronet_data/` (calendar, contacts, family, recipes, money now all live inside it) | 92 GB |
| &nbsp;&nbsp;music library | `neuronet_data/chords/` | 87 GB — **left behind** (decision) |
| &nbsp;&nbsp;photos | `neuronet_data/photos/` | 2.8 GB |
| &nbsp;&nbsp;card art | `neuronet_data/cards/` | 2.6 GB — travels with the app (decision) |
| &nbsp;&nbsp;notes, journal, training, meditation, family… | the rest | ~0.3 GB |
| App settings | `neuronet_prefs.json` | |
| Dock pins & settings | `~/.local/state/omarchy/neuronet-dock.json` | |
| Chosen theme & wallpaper | `~/.local/state/omarchy/current/`, `neuronet-wallpaper` | |
| Photo-frame settings | `~/.config/omarchy/neuronet-frame.json` | |
| Board contents / order | `~/.config/omarchy/neuronet-board.json` | |

## 4. Machine — made fresh on each computer

| What | Where |
|---|---|
| Monitors, input | `~/.config/hypr/monitors.lua`, `input.lua` |
| Game Mode state | `~/.local/state/omarchy/neuronet-gamemode.json` (never carried) |
| Omarchy-menu rows | `~/.config/omarchy/extensions/omarchy-menu.jsonc` |

## 5. Findings to act on

**For Stage 1 (make it portable)**

- ~~**Hard-coded paths**~~ — **done 29 Sep.** One config,
  `~/.config/neuronet/paths.json`, written by `system/bin/neuronet-setup`
  (which also installs NeuroNet's commands in `~/.local/bin` and makes the
  menu units and launcher from `system/templates/`). Widgets read it through
  `NeuroNetPaths.qml`; shortcuts, autostart, launcher and services run the
  commands by name; `neuronet.py` takes its `"data"` as an explicit choice.
  No folder of this computer's is left in the layer (`test/test_portable.py`).
  The app's own docs and tests still mention this computer's folders — those
  are records, not settings.
- **Fresh install** — **checked 29 Sep.** Every always-running widget loads on
  an empty data folder with no errors and writes nothing into it
  (`test/test_fresh_install.py`). NeuroNet itself, run from a copy on a
  private session bus with empty data: every section opens its first page,
  each with a proper empty state; no errors; nothing written until something
  is saved. `neuronet-setup --data DIR` makes DIR on a new computer — but never
  a remembered one that's gone (it may be an unplugged drive).
- **Settings** — **moved 29 Sep** (Cam: "In data folder"). `neuronet_prefs.json`
  (and Kitchen's `hearth_prefs.json`) live in the data folder; an older one in
  the app folder moves in on first launch — never over one already there, never
  deleted (`test/test_settings_location.py`). The export is now one part.
  `neuronet.log` stays beside the app (it's the app's, not the person's).
- **Names shown to users** — **done 29 Sep** (Cam: "change the coach cam to just
  be coaching and the same for money"): Training is "Coaching" (its brand, book
  covers, printouts, messages); Money's import says "the old Counting tool";
  Music's empty player says "Open Music". Internal names (`coach_cam.json`,
  `coachcam-192.png`) unchanged — renaming them would orphan existing data.
- **Missing dependencies**: listed in `deps.txt` now; install `python-reportlab`, `python-pptx` here.
- **Duplicate "(2)" files**: 184 — 166 identical, 18 older. Cam checking
  (`~/Documents/NeuroNet - duplicate (2) files.txt`). Ignored by git meanwhile.
- **Two stale copies of the layer** in the app folder: `omarchy-plugin/`
  (older copies of 9 plugins) and `integration/` (deps, hooks, units). `system/`
  supersedes both; retire them once `rebuild.sh` reads `system/`.

**The migration tool (`/mnt/mydata/NuNt_migration_desktopintegration`)** — fixed 29 Sep

`rebuild.sh` already found every `neuronet.*` plugin (so the dock and Game Mode
travel), the Hyprland lines, hooks, launcher and services. Added on 29 Sep
(backups: `rebuild.sh.bak.20260929-160830`, `install.sh.bak.20260929-160830`):

1. **themes** — NeuroNet and NeuroNet Light carried with their wallpapers
   (manifest `themes`, `theme`); `install.sh` step 4b installs them, sets
   aside any older copy, and offers to switch to the one in use;
2. **replaced widgets switched off** — manifest `replaces` (Arc Dock by the
   dock, Ominity by Tarot); switched off with `omarchy plugin disable`, not removed;
3. **dock pins/settings** — full bundles take `~/.local/state/omarchy/neuronet-*`
   (never Game Mode's state);
4. NeuroNet's `.git` is left out of bundles.

Tested: a features bundle built from a scratch copy; the new install steps run
against a sandbox home with a stand-in `omarchy`. The migration scripts are not
in git yet — they become part of the Stage 2 installer.

**Fixed already (29 Sep)**

- `integration/deps.txt` now lists every Python library NeuroNet imports
  (added `docx`, `openpyxl`, `fitz`, `reportlab`, `pptx`; `pywebview` from the
  Arch package, not pip). `reportlab` and `pptx` still to be installed here.
- The idle memory leak (music visualizer + top-bar clock, `ui/music/chords.js`): idle growth ~90 MB/min → ~0.8 MB/min.

## 6. Decisions on record

- ISO is shared with **family and friends** — nothing of Cam's baked in; "Start fresh" offered at first boot.
- Called **NeuroNet** everywhere. Manual: **Neuro Guide**, all of Omarchy + NeuroNet, sample-data screenshots.
- Data lives in the **home folder by default**, user may choose; a Settings option to move it to another drive.
- Export: password-protected where possible; music left behind; cards travel.
- Installed machines **update automatically**.
- Hiding a section in Settings should also switch off its shortcut.
- First real test machine: **NVIDIA** graphics.
- Git: local only until Cam confirms her GitHub account.
