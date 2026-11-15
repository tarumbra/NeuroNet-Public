#!/bin/bash
# make_update_kit.sh -- the folder that switches on automatic updates on a computer set up
# before the auto-update ISO (2026-10-21, for Manthies' computer).
#
#   bash tools/make_update_kit.sh [DIR]     default: ~/NeuroNet-ISO/update-kit
#
# Puts system/enable-updates.sh beside the repository and its READ-ONLY deploy key (the same
# pair the ISO uses: ~/NeuroNet-ISO/secrets/update.json and update_key -- never in the repo).
# Copy the folder to that computer (a USB stick), then there:  bash enable-updates.sh
# The kit holds a key: keep it off anything shared, and delete it from the stick afterwards.
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
SECRETS="${NEURONET_ISO_WORK:-$HOME/NeuroNet-ISO}/secrets"
OUT="${1:-${NEURONET_ISO_WORK:-$HOME/NeuroNet-ISO}/update-kit}"
[ -f "$SECRETS/update.json" ] || { echo "no $SECRETS/update.json -- see system/iso/README.md (Updates)" >&2; exit 1; }
mkdir -p "$OUT"
install -m 755 "$HERE/system/enable-updates.sh" "$OUT/enable-updates.sh"
jq '{repo: .repo}' "$SECRETS/update.json" > "$OUT/update.json"
if [ -f "$SECRETS/update_key" ]; then install -m 600 "$SECRETS/update_key" "$OUT/update_key"; else echo "(no update_key in $SECRETS: the computer's own GitHub key will be used)"; fi
cat > "$OUT/README.txt" <<TXT
NeuroNet: switch on automatic updates (for a computer set up before the auto-update ISO)

On that computer, logged in as the person who uses NeuroNet, open a terminal in this folder and run:

    bash enable-updates.sh

It finds NeuroNet, asks before changing anything, updates it to the newest release (the data is
never touched; the old code is kept in ~/.local/state/neuronet/previous) and switches on the daily
check. To only see what it would do:  bash enable-updates.sh --check
If it can't find NeuroNet:  bash enable-updates.sh --app /path/to/NeuroNet

This folder holds a read-only key to NeuroNet's GitHub repository: delete it from the USB stick
when you're done (the computer keeps its own copy in ~/.config/neuronet/).
TXT
echo "update kit: $OUT"
ls -la "$OUT"
