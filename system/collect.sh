#!/bin/bash
# collect.sh -- copy NeuroNet's desktop layer from this computer into the repo.
#
# NeuroNet System plan, Stage 0 (2026-09-29): "every file in the NeuroNet
# layer is in the repo". The layer is still edited where it runs -- the
# plugins in ~/.config/omarchy/plugins hot-reload there -- so the live copy
# is the one that's current. Run this after changing any of it, then commit:
#
#     bash system/collect.sh && git add -A system && git commit
#
# What it takes (see INVENTORY.md for why each is here):
#   omarchy/plugins/   every neuronet.* shell plugin
#   omarchy/themes/    NeuroNet and NeuroNet Light (not their wallpapers:
#                      those are kept once, in wallpapers/photos/, and put in
#                      the themes by wallpapers/make.sh)
#   omarchy/hooks/     the theme-set hook that repaints NeuroNet
#   omarchy/shell.neuronet.json   NeuroNet's plugins and bar places in
#                      shell.json, and what they replace (Arc Dock)
#   hypr/              the "NeuroNet desktop integration" blocks from
#                      autostart.lua, bindings.lua and hyprland.lua
#   (the menu indexer's units and the launcher are system/templates/,
#    made for each computer by bin/neuronet-setup -- not collected)
#
# Only copies. Nothing on the computer is changed.
set -euo pipefail

SYS="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
H="$HOME"

say() { printf '  %s\n' "$*"; }

# ---- shell plugins -------------------------------------------------------
rm -rf "$SYS/omarchy/plugins"
mkdir -p "$SYS/omarchy/plugins"
for d in "$H"/.config/omarchy/plugins/neuronet.*; do
  [ -d "$d" ] || continue
  rsync -a --exclude='* (2)*' --exclude='__pycache__' "$d" "$SYS/omarchy/plugins/"
  say "plugin   $(basename "$d")"
done
# Shared files (system/omarchy/shared.json): an edit made in one widget's copy
# becomes the source and every other copy; two different edits stop here.
python3 "$SYS/shared_files.py" --adopt || { say "Shared files were edited in two different ways -- settle them, then collect again."; exit 1; }

# ---- themes (without wallpapers) ------------------------------------------
rm -rf "$SYS/omarchy/themes"
mkdir -p "$SYS/omarchy/themes"
for t in neuronet neuronet-light; do
  src="$H/.config/omarchy/themes/$t"
  [ -d "$src" ] || continue
  rsync -a --exclude='backgrounds' --exclude='.git' "$src" "$SYS/omarchy/themes/"
  say "theme    $t"
done

# ---- hooks ------------------------------------------------------------------
mkdir -p "$SYS/omarchy/hooks/theme-set.d"
for f in "$H"/.config/omarchy/hooks/theme-set.d/neuronet*; do
  [ -f "$f" ] && cp -a "$f" "$SYS/omarchy/hooks/theme-set.d/" && say "hook     theme-set.d/$(basename "$f")"
done

# ---- shell.json: NeuroNet's entries --------------------------------------
python3 - "$H/.config/omarchy/shell.json" "$SYS/omarchy/shell.neuronet.json" <<'PY'
import json, sys
src, dest = sys.argv[1:3]
cfg = json.load(open(src))
RETIRED = ["neuronet.training", "neuronet.board", "neuronet.frame", "neuronet.home"]
nn = lambda e: isinstance(e, dict) and str(e.get("id", "")).startswith("neuronet.")
out = {
    "_about": "NeuroNet's part of ~/.config/omarchy/shell.json, collected by "
              "system/collect.sh. 'replaces' are plugins NeuroNet's own take the "
              "place of, and must be switched off where these are switched on; "
              "'retired' are NeuroNet widgets no longer part of NeuroNet. "
              "'takes_over' are hand-made copies of a NeuroNet widget: off, off "
              "the bar and set aside, NeuroNet's in their place.",
    "plugins": [e for e in cfg.get("plugins", []) if nn(e) and e.get("id") not in RETIRED],
    "replaces": ["io.github.claudsondouglas.arcdock", "omadock", "io.github.matheusmedrado.omadock"],
    # NeuroNet widgets taken out of NeuroNet: a computer that has one has it
    # switched off, off the bar and set aside by install.sh.
    # neuronet.training -- the class timer (2026-09-29, Cam: "remove the class
    # timer in neuronet i dont use it")
    # neuronet.board, .frame, .home -- the desktop widgets (3 Nov 2026, Cam:
    # "remove the widget functionality completely"); the bar widgets stay
    "retired": RETIRED,
    # hand-made copies of a NeuroNet widget, set aside by install.sh with
    # NeuroNet's in their place: the Claude dock (10 Nov 2026)
    "takes_over": ["cam.claudedock"],
    "bar": {},
}
for section, items in (cfg.get("bar", {}).get("layout", {}) or {}).items():
    ids = [e.get("id") for e in items if isinstance(e, dict)]
    placed = []
    for i, e in enumerate(items):
        if nn(e):
            placed.append({"entry": e,
                           "after": ids[i - 1] if i > 0 else None,
                           "before": ids[i + 1] if i + 1 < len(ids) else None})
    if placed:
        out["bar"][section] = placed
json.dump(out, open(dest, "w"), indent=2)
open(dest, "a").write("\n")
PY
say "shell    shell.neuronet.json"

# ---- Hyprland blocks ---------------------------------------------------------
mkdir -p "$SYS/hypr"
for f in "$H"/.config/hypr/*.lua; do
  n="$(basename "$f")"
  block="$(sed -n '/>>> NeuroNet/,/<<< NeuroNet/p' "$f")"
  if [ -n "$block" ]; then
    printf '%s\n' "$block" > "$SYS/hypr/$n.block"
    say "hypr     $n"
  fi
done

# ---- user services, launcher: NOT collected (2026-09-29) --------------------
# They're made for each computer from system/templates/ by neuronet-setup.
# Copies of this computer's rendered ones carried its folders into the repo
# (fix notes from Manthies' computer), and nothing read them.

echo
echo "  Collected into $SYS"
