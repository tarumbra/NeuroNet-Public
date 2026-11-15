#!/usr/bin/env bash
# Retake the Neuro Guide's screenshots from a made-up household.
#
#   bash system/guide-shots.sh
#
# Copies NeuroNet's code (never neuronet_data) into a throwaway folder,
# fills an empty data folder with tools/make_sample_data.py, starts that
# copy off-screen (no window appears) in the NeuroNet Omarchy theme, and
# lets tools/guide_shots.mjs photograph it into ui/guide/shots/. The copy
# has its own HOME and XDG folders, so the real NeuroNet, its settings and
# its data are never read or written. Needs: python3, node, ffmpeg.
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
PORT=${PORT:-9239}
T=$(mktemp -d /tmp/neuronet-shots.XXXXXX)
H=$T/home; APP=$T/app; DATA=$T/data
mkdir -p "$H/.config/neuronet" "$H/.local/state/neuronet" "$H/.local/state/omarchy/current/theme" \
         "$H/.local/share" "$H/.cache" "$DATA" "$T/bin"

rsync -a --exclude neuronet_data --exclude .git --exclude '*(2)*' --exclude logs \
      --exclude '*.bak' --exclude node_modules "$REPO/" "$APP/"
printf '{"app": "%s", "data": "%s"}\n' "$APP" "$DATA" > "$H/.config/neuronet/paths.json"
printf '#!/bin/sh\nexit 0\n' > "$T/bin/omarchy"; chmod +x "$T/bin/omarchy"
# NeuroNet's own theme through "Follow Omarchy"; the welcome already answered
cp "$REPO/system/omarchy/themes/neuronet/colors.toml" "$H/.local/state/omarchy/current/theme/"
echo neuronet > "$H/.local/state/omarchy/current/theme.name"
echo '{"done": "fresh"}' > "$H/.local/state/neuronet/welcome.json"
cat > "$DATA/neuronet_prefs.json" <<'EOF'
{"theme": "omarchy", "dashBlocks": [
 {"id": "b-today", "type": "today", "col": 0, "slot": 0}, {"id": "b-up", "type": "upcoming", "col": 0, "slot": 1},
 {"id": "b-photos", "type": "photos", "col": 1, "slot": 0}, {"id": "b-fleet", "type": "fleetview", "col": 1, "slot": 1},
 {"id": "b-movie", "type": "randommovie", "col": 1, "slot": 2},
 {"id": "b-music", "type": "music", "col": 2, "slot": 0, "shelf": "albums"},
 {"id": "b-recipe", "type": "quickrecipe", "col": 2, "slot": 1}, {"id": "b-circ", "type": "circuit", "col": 2, "slot": 2}]}
EOF

run() {
  env HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_STATE_HOME="$H/.local/state" \
      XDG_DATA_HOME="$H/.local/share" XDG_CACHE_HOME="$H/.cache" PATH="$T/bin:$PATH" "$@"
}
(cd "$APP" && run NEURONET_SAMPLE=1 python3 tools/make_sample_data.py)

(cd "$APP" && run QT_QPA_PLATFORM=offscreen QTWEBENGINE_REMOTE_DEBUGGING=127.0.0.1:$PORT \
    dbus-run-session python3 neuronet.py --gui qt > "$T/app.log" 2>&1) &
stop() {   # only the copy running from this sandbox -- never the real NeuroNet
  local app="" bus="" p
  for p in $(pgrep -f "[n]euronet.py --gui qt"); do
    [ "$(readlink "/proc/$p/cwd")" = "$APP" ] && [ "$(cat "/proc/$p/comm" 2>/dev/null)" = python3 ] && app=$p
  done
  [ -n "$app" ] || return 0
  bus=$(cat "/proc/$app/environ" 2>/dev/null | tr '\0' '\n' | grep -m1 '^DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/')
  # FIRST whatever its private bus started -- the desktop portals, gvfsd, the
  # accessibility bus. Stopped after the app, they lost their bus: the
  # portal crashed (a desktop "xdg-desktop-portal" crash notification each
  # time) and the rest lingered, 108 processes after a day of test runs
  # (2026-09-30). Only processes on THIS sandbox's /tmp bus; the real
  # session's are on /run/user.
  if [ -n "$bus" ]; then
    for p in $(pgrep -u "$(id -u)" .); do
      [ "$p" = "$app" ] && continue
      cat "/proc/$p/environ" 2>/dev/null | tr '\0' '\n' | grep -qxF "$bus" && kill "$p" 2>/dev/null
    done
    sleep 1
  fi
  kill "$app" 2>/dev/null
  for _ in $(seq 20); do kill -0 "$app" 2>/dev/null || break; sleep 0.5; done
  kill -9 "$app" 2>/dev/null || true
  echo "stopped the sample NeuroNet ($app)"
}
trap stop EXIT
for _ in $(seq 60); do curl -sf "127.0.0.1:$PORT/json" | grep -q index.html && break; sleep 1; done
sleep 4   # the app's first render
NEURONET_SAMPLE_DATA="$DATA" node "$REPO/tools/guide_shots.mjs" "$PORT" "$REPO/ui/guide/shots"
stop; trap - EXIT
sleep 2
if [ "${KEEP:-}" = 1 ]; then echo "sandbox kept at $T"; else rm -rf "$T"; fi
echo "Screenshots in ui/guide/shots/"
