#!/bin/bash
# make.sh -- NeuroNet's wallpapers into the two themes.
#
# Cam's own pictures (2026-10-01: "setting some new default wallpapers for
# Neuronet" and "light theme desktop wallpapers are ready"):
#   photos/dark/*.jpg    NeuroNet        (01-brain-green is the default)
#   photos/light/*.jpg   NeuroNet Light  (01-brain-clouds is the default)
# The first in each folder is the one a theme opens with. They replace the
# drawn wallpapers of before (walls.py, walls2.py, light.py -- in git history),
# which are taken out of the themes here.
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
THEMES="${NEURONET_THEMES:-$HOME/.config/omarchy/themes}"
for t in dark light; do
  theme=neuronet; [ "$t" = light ] && theme=neuronet-light
  out="$THEMES/$theme/backgrounds"
  mkdir -p "$out"
  rm -f "$out"/{01-neural-field,02-brain,03-web,04-library,05-neuronet}.png
  cp -f "$HERE"/photos/$t/*.jpg "$out/"
done
echo "  Wallpapers in $THEMES/neuronet{,-light}/backgrounds"
