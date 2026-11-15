#!/bin/bash
# install.sh -- turn this Omarchy computer into NeuroNet.
#
#   bash system/install.sh                 install (asks before changing anything)
#   bash system/install.sh --yes           ... without asking
#   bash system/install.sh --check         say what would change; change nothing
#   bash system/install.sh --data DIR      keep NeuroNet's data in DIR
#   bash system/install.sh --uninstall     take NeuroNet's desktop layer out again
#   bash system/install.sh --offline       never download or install software:
#                                          what's missing is only reported (the
#                                          ISO's first login, Stage 5 -- its
#                                          software came from the ISO itself)
#
# NeuroNet System plan, Stage 2 (2026-09-29): "one command turns a fresh
# Omarchy into NeuroNet". It installs what the repo's system/ folder holds --
# the desktop layer as it runs on Cam's computer, collected by collect.sh:
#
#   software   what integration/deps.txt lists, with Omarchy's own installer
#   where      ~/.config/neuronet/paths.json and NeuroNet's commands, by
#              neuronet-setup (data: --data, else the folder already set,
#              else NeuroNet's own neuronet_data if it has one, else ~/NeuroNet)
#   widgets    every neuronet.* shell plugin, switched on, on the bar where
#              they sit on Cam's; what they replace (Arc Dock) switched off
#   themes     NeuroNet and NeuroNet Light, with Cam's wallpapers
#   hook       the theme-set hook that repaints a running NeuroNet
#   Hyprland   the "NeuroNet desktop integration" blocks: shortcuts,
#              autostart, window rule -- any shortcut whose keys are already
#              taken here is left out, and if Hyprland reports errors its
#              files are put back as they were
#   services   the Omarchy-menu indexer
#
# Nothing is lost: a widget, theme or file it replaces is kept aside
# (plugins-before-neuronet-<date>/, themes-before-neuronet-<date>/,
# <file>.bak.<date>). NeuroNet's data is never touched -- by install or
# uninstall. Safe to run again: whatever is already in place is left alone,
# so a second run changes nothing.
#
# What it did is written to ~/.local/state/neuronet/install.json -- what it
# switched off, the theme before -- so --uninstall can put those back.
set -euo pipefail

SYS="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
APP="$(cd "$SYS/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
PLUGINS="$HOME/.config/omarchy/plugins"
THEMES="$HOME/.config/omarchy/themes"
HOOKS="$HOME/.config/omarchy/hooks"
SHELLJSON="$HOME/.config/omarchy/shell.json"
HYPR="$HOME/.config/hypr"
STATE_DIR="$HOME/.local/state/neuronet"
RECORD="$STATE_DIR/install.json"
BEGIN="-- >>> NeuroNet desktop integration (install.sh)"
END="-- <<< NeuroNet desktop integration (install.sh)"

ARGS="$*"
YES="" CHECK="" DATA="" UNINSTALL="" NOSTART="" OFFLINE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) YES=1; shift ;;
    --check) CHECK=1; shift ;;
    --offline) OFFLINE=1; shift ;;
    --data) DATA="${2:?folder}"; shift 2 ;;
    --uninstall) UNINSTALL=1; shift ;;
    --no-start) NOSTART=1; shift ;;
    -h|--help) sed -n '2,39p' "$0"; exit 0 ;;
    *) echo "install.sh: unknown option $1 (see --help)" >&2; exit 2 ;;
  esac
done

# Everything it says is kept, so a step that went wrong on someone else's
# computer can be read afterwards (2026-09-29: three libraries didn't install
# on Manthies' computer, and nothing there said why).
if [ -z "$CHECK" ]; then
  mkdir -p "$STATE_DIR"
  echo "---- $(date '+%Y-%m-%d %H:%M:%S') install.sh $ARGS" >> "$STATE_DIR/install.log"
  exec > >(tee -a "$STATE_DIR/install.log") 2>&1
fi

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
say()  { printf '  %s\n' "$*"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[31mStopped: %s\033[0m\n' "$*" >&2; exit 1; }
ask()  {
  [ -n "$YES" ] && return 0
  local a; read -r -p "  $1 [Y/n] " a; [[ -z "$a" || "$a" == [yY]* ]]
}
changes=0
would() { changes=$((changes + 1)); say "would $*"; }   # --check
# Restart the shell -- but only once it has finished taking in the plugin files just copied.
# Quickshell hot-reloads a local plugin the moment its files change (150 ms later it rescans and
# rebuilds the cards); a restart that lands in the middle of that reload crashes it (SIGSEGV in
# quickshell 0.3.1's IpcHandler::updateRegistration, on an engine generation the shutdown has
# already freed -- Board.qml's IpcHandler is being rebuilt). Seen twice on Cam's desktop on
# 2026-10-03 (19:12 and 20:32), each 0.4 s after install.sh copied neuronet.board's files.
# NEURONET_SHELL_SETTLE shortens the wait (tests).
restart_shell() {
  sleep "${NEURONET_SHELL_SETTLE:-2}"
  omarchy restart shell >/dev/null 2>&1
}

# ------------------------------------------------------------ the record --
record_get() {  # key -> JSON value, or empty
  [ -f "$RECORD" ] && jq -c --arg k "$1" '.[$k] // empty' "$RECORD" 2>/dev/null || true
}
record_set() {  # key json
  mkdir -p "$STATE_DIR"
  local cur='{}'; [ -f "$RECORD" ] && cur="$(cat "$RECORD")"
  jq --arg k "$1" --argjson v "$2" '.[$k] = $v' <<<"$cur" > "$RECORD.part" && mv "$RECORD.part" "$RECORD"
}

plugin_on()  { [ -f "$SHELLJSON" ] && jq -e --arg id "$1" '[.plugins[]?.id] | index($id) != null' "$SHELLJSON" >/dev/null 2>&1; }
on_bar()     { [ -n "$1" ] && [ "$1" != null ] && [ -f "$SHELLJSON" ] \
                 && jq -e --arg id "$1" '[.bar.layout[]?[]?.id] | index($id) != null' "$SHELLJSON" >/dev/null 2>&1; }
same_tree()  { [ -d "$2" ] && diff -rq --exclude='* (2)*' --exclude='__pycache__' --exclude='backgrounds' "$1" "$2" >/dev/null 2>&1; }

# --------------------------------------------------------------- checks --
bold "NeuroNet: $APP"
command -v omarchy >/dev/null || die "this isn't an Omarchy computer (no omarchy command)."
[ -f "$HYPR/bindings.lua" ] || die "no Hyprland Lua config at $HYPR -- NeuroNet needs Omarchy's Lua config."
for c in jq python3 hyprctl; do command -v "$c" >/dev/null || die "$c is missing."; done
[ -f "$APP/neuronet.py" ] && [ -d "$SYS/omarchy/plugins" ] || die "$APP isn't a NeuroNet folder with its system/ layer."
# NeuroNet's folder can't be / or a system folder (or the home folder itself):
# the updater copies new code over it. On Cam's desktop (2026-10-01) a copy
# made with an empty folder variable ("sudo rsync ... "$N/"") put NeuroNet in /,
# and paths.json then said "app": "/".
unsafe_app() {
  case "$(realpath -m -- "$1")" in
    /|/bin|/boot|/dev|/etc|/home|/lib|/lib64|/mnt|/media|/opt|/proc|/root|/run|/sbin|/srv|/sys|/tmp|/usr|/usr/*|/var|"$(realpath -m -- "$HOME")") return 0 ;;
  esac; return 1
}
unsafe_app "$APP" && die "NeuroNet can't live in $APP -- put the NeuroNet folder somewhere of its own (e.g. ~/NeuroNet) and run its system/install.sh from there."
[ -n "$CHECK" ] && say "(checking only -- nothing will be changed)"
# files a release dropped (system/retired.txt): an update never deletes, so take them out here (2026-10-15)
bash "$SYS/retire.sh" "$APP" ${CHECK:+--check}

# Sent over LocalSend (or unzipped), scripts arrive without their "runnable"
# flag. Every one this installs or runs gets it back.
if [ -z "$CHECK" ]; then
  for f in "$SYS"/bin/* "$SYS"/wallpapers/*.sh "$SYS"/collect.sh "$APP"/neuronet-* \
           "$SYS"/omarchy/hooks/theme-set.d/* "$SYS"/omarchy/plugins/*/*.py "$SYS"/omarchy/plugins/*/*.sh \
           "$SYS"/omarchy/shared/*/*.py "$SYS"/shared_files.py; do
    [ -f "$f" ] && [ "$(head -c 2 "$f")" = "#!" ] && chmod +x "$f"
  done
fi

# ===================================================================== uninstall
if [ -n "$UNINSTALL" ]; then
  bold "Taking NeuroNet's desktop layer out"
  say "NeuroNet itself ($APP) and its data are left exactly where they are."
  if [ -z "$CHECK" ]; then ask "Go ahead?" || die "nothing was changed."; fi
  pids=$(pgrep -f '^(/usr/bin/)?python3? [^ ]*neuronet\.py' || true)
  if [ -n "$pids" ]; then
    if [ -n "$CHECK" ]; then would "stop NeuroNet"
    else
      kill -TERM $pids 2>/dev/null || true
      # it takes a few seconds to close (clean-VM test, 2026-09-29); then firmly, as Game Mode does
      for _ in $(seq 1 16); do pgrep -f '^(/usr/bin/)?python3? [^ ]*neuronet\.py' >/dev/null || break; sleep 0.5; done
      pkill -KILL -f '^(/usr/bin/)?python3? [^ ]*neuronet\.py' 2>/dev/null || true
      say "Stopped NeuroNet."
    fi
  fi
  # Hyprland blocks
  for f in "$HYPR"/*.lua; do
    # -e: the marker starts with "--", which grep would take for an option
    grep -qxF -e "$BEGIN" "$f" 2>/dev/null || continue
    if [ -n "$CHECK" ]; then would "take the NeuroNet block out of $f"; continue; fi
    cp -a "$f" "$f.bak.$STAMP"
    python3 - "$f" "$BEGIN" "$END" <<'PY'
import sys
f, b, e = sys.argv[1:4]
out, skip = [], False
for l in open(f, encoding="utf-8").read().splitlines():
    if l == b: skip = True; continue
    if l == e: skip = False; continue
    if not skip: out.append(l)
while out and out[-1] == "": out.pop()
open(f, "w", encoding="utf-8").write("\n".join(out) + "\n")
PY
    say "Took the NeuroNet block out of $f (backup: .bak.$STAMP)"
  done
  [ -z "$CHECK" ] && { hyprctl reload >/dev/null 2>&1 || true; }
  # widgets: off, and set aside; what they replaced, back on
  for d in "$PLUGINS"/neuronet.*; do
    [ -d "$d" ] || continue; id=$(basename "$d")
    if [ -n "$CHECK" ]; then would "switch off and set aside $id"; continue; fi
    plugin_on "$id" && { omarchy plugin disable "$id" >/dev/null 2>&1 || warn "couldn't switch off $id"; }
    mkdir -p "$HOME/.config/omarchy/plugins-removed-neuronet-$STAMP"
    mv -- "$d" "$HOME/.config/omarchy/plugins-removed-neuronet-$STAMP/"
    say "Removed $id (kept in plugins-removed-neuronet-$STAMP/)"
  done
  for id in $(record_get disabled | jq -r '.[]?' 2>/dev/null); do
    [ -d "$PLUGINS/$id" ] || continue
    if [ -n "$CHECK" ]; then would "switch $id back on"; else
      omarchy plugin enable "$id" >/dev/null 2>&1 && say "Switched $id back on" || warn "couldn't switch $id back on"; fi
  done
  # theme: back to the one before, if NeuroNet's is in use
  cur=$(cat "$HOME/.local/state/omarchy/current/theme.name" 2>/dev/null || true)
  if [[ "$cur" == neuronet* ]]; then
    before=$(record_get themeBefore | jq -r '. // empty' 2>/dev/null || true)
    before=${before:-tokyo-night}
    if [ -n "$CHECK" ]; then would "switch the theme back to $before"; else
      omarchy theme set "$before" >/dev/null 2>&1 && say "Theme: $before" || warn "couldn't set theme $before"; fi
  fi
  for t in neuronet neuronet-light; do
    [ -d "$THEMES/$t" ] || continue
    if [ -n "$CHECK" ]; then would "set aside the $t theme"; else
      mkdir -p "$HOME/.config/omarchy/themes-removed-neuronet-$STAMP"
      mv -- "$THEMES/$t" "$HOME/.config/omarchy/themes-removed-neuronet-$STAMP/"; say "Set aside theme $t"; fi
  done
  # hook, services, launcher, commands, paths.json
  gone=( "$HOOKS/theme-set.d/neuronet-theme"
         "$HOME/.config/systemd/user/neuronet-menu.path" "$HOME/.config/systemd/user/neuronet-menu.service"
         "$HOME/.local/share/applications/NeuroNet.desktop" "$HOME/.local/share/applications/NeuroPets.desktop" "$HOME/.local/share/applications/NeuroFarm.desktop" "$HOME/.local/share/applications/NeuroCafe.desktop" "$HOME/.local/share/applications/NeuroArcana.desktop" "$HOME/.local/share/applications/NeuroTrain.desktop" "$HOME/.local/bin/neuronet-path"
         "$HOME/.config/neuronet/paths.json" )
  for c in neuronet-quick neuronet-call neuronet-music neuronet-menu neuronet-capture neuronet-snip neuronet-media-art neuronet-open neuronet-shell neuronet-desk-edit neuropets neuropets-call neurofarm neurofarm-call neurocafe neuroarcana neurotrain claude-dock; do   # the -call ones: retired 2026-10-15, still taken out
    gone+=("$HOME/.local/bin/$c")
  done
  if [ -z "$CHECK" ]; then systemctl --user disable --now neuronet-menu.path >/dev/null 2>&1 || true; fi
  # the Claude dock's hooks in Claude Code's settings (the person's own are kept)
  CLAUDE_SETTINGS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
  if [ -f "$CLAUDE_SETTINGS" ] && grep -q 'claude-dock replied' "$CLAUDE_SETTINGS"; then
    if [ -n "$CHECK" ]; then would "take the Claude dock's hooks out of $CLAUDE_SETTINGS"
    else
      cp -a "$CLAUDE_SETTINGS" "$CLAUDE_SETTINGS.bak.$STAMP"
      python3 - "$CLAUDE_SETTINGS" <<'PY'
import json, sys
f = sys.argv[1]; cfg = json.load(open(f)); hooks = cfg.get("hooks", {})
for ev in ("Stop", "Notification"):
    gs = [dict(g, hooks=[h for h in g.get("hooks", []) if str(h.get("command", "")).strip() != "claude-dock replied"]) for g in hooks.get(ev, [])]
    gs = [g for g in gs if g["hooks"]]
    if gs: hooks[ev] = gs
    else: hooks.pop(ev, None)
if not hooks: cfg.pop("hooks", None)
json.dump(cfg, open(f, "w"), indent=2); open(f, "a").write("\n")
PY
      say "Took the Claude dock's hooks out of $CLAUDE_SETTINGS (backup: .bak.$STAMP)"
    fi
  fi
  for f in "${gone[@]}"; do
    [ -e "$f" ] || continue
    if [ -n "$CHECK" ]; then would "remove $f"; else mv -- "$f" "$f.removed.$STAMP"; say "Removed $f (kept as .removed.$STAMP)"; fi
  done
  if [ -z "$CHECK" ]; then
    systemctl --user daemon-reload 2>/dev/null || true
    [ -f "$RECORD" ] && mv -- "$RECORD" "$RECORD.removed.$STAMP"
    restart_shell || true
    bold "Done -- NeuroNet's desktop layer is out. NeuroNet and its data are still in $APP."
  else
    bold "$changes change(s) would be made."
  fi
  exit 0
fi

# ===================================================================== install
if [ -z "$CHECK" ]; then
  say "This puts NeuroNet's widgets, dock, themes, shortcuts and commands on this computer."
  ask "Go ahead?" || die "nothing was changed."
fi

# ------------------------------------------------------------- 1. software --
bold "1. Software"
missing=()
while read -r kind name how; do
  case "$kind" in ''|\#*) continue ;; esac
  ok=yes
  case "$kind" in
    cmd|optional) command -v "$name" >/dev/null 2>&1 || ok=no ;;
    python) python3 -c "import $name" >/dev/null 2>&1 || ok=no ;;
  esac
  [ "$ok" = yes ] && continue
  cmd=$(sed -E 's/ *\(.*$//' <<<"$how")
  if [ "$kind" = optional ]; then warn "optional, not installed: $name -- $how"; continue; fi
  case "$cmd" in omarchy\ pkg*) missing+=("$name|$cmd") ;; *) warn "missing: $name -- $how" ;; esac
done < "$APP/integration/deps.txt"
# A freshly installed Omarchy hasn't downloaded its package lists yet -- it
# installs offline, and does that on its first update (the "Update System"
# notice). Without them nothing can be installed: found in the clean-VM test,
# 2026-09-29, where every library failed with "target not found" -- and the
# same thing is why three failed on Manthies' computer. Omarchy's own update
# brings the lists and the system to its current stable set together, rather
# than fetching lists alone and mixing old packages with new.
# (extra.db specifically: the ISO leaves an offline.db of its own behind)
if [ -n "${OFFLINE:-}" ]; then
  # The ISO's first login: no network to count on and no one to type a
  # password. Its software is installed from the ISO; anything else (the AUR's
  # python-pptx) is said, with how to add it later.
  for m in "${missing[@]}"; do warn "not installed (offline): ${m%%|*} -- later: ${m#*|}"; done
  missing=()
elif [ ${#missing[@]} -gt 0 ] && [ ! -s /var/lib/pacman/sync/extra.db ]; then
  say "This computer hasn't downloaded its package lists yet (a new Omarchy does that on its first update)."
  if [ -n "$CHECK" ]; then would "run Omarchy's update first (omarchy update -y), to be able to install software"
  elif ask "Run Omarchy's update now? NeuroNet's software can't be installed without it (a few minutes)"; then
    omarchy update -y || warn "Omarchy's update didn't finish -- run: omarchy update"
  else
    warn "Skipped -- NeuroNet's software won't install until Omarchy has been updated."
  fi
fi
if [ ${#missing[@]} -eq 0 ]; then
  say "Everything NeuroNet needs is here."
else
  for m in "${missing[@]}"; do
    name=${m%%|*}; cmd=${m#*|}
    if [ -n "$CHECK" ]; then would "install $name ($cmd)"; continue; fi
    say "Installing $name: $cmd"
    $cmd || warn "couldn't install $name -- run: $cmd"
  done
fi

# ---------------------------------------------------------------- 2. where --
bold "2. Where NeuroNet is"
if [ -z "$DATA" ]; then
  conf_data=$(jq -r '.data // empty' "$HOME/.config/neuronet/paths.json" 2>/dev/null || true)
  if [ -n "$conf_data" ]; then DATA="$conf_data"
  elif [ -f "$APP/neuronet_data/neuronet.json" ]; then DATA=""          # NeuroNet's own, as it always was
  else DATA="$HOME/NeuroNet"; fi                                       # a new computer: the home folder
fi
# NeuroNet itself put at ~/NeuroNet: its data goes in its own neuronet_data
# folder rather than loose among the app's files
if [ -n "$DATA" ] && [ "$(realpath -m -- "$DATA")" = "$(realpath -m -- "$APP")" ]; then
  DATA="$APP/neuronet_data"
fi
# through bash: in --check nothing's flags are restored, and a copy sent over
# LocalSend has none (found in the VM test, 2026-09-29: "Permission denied")
setup=(bash "$SYS/bin/neuronet-setup" --app "$APP")
[ -n "$DATA" ] && setup+=(--data "$DATA")
[ -n "$CHECK" ] && setup+=(--check)
out=$("${setup[@]}")
printf '%s\n' "$out" | sed 's/^  //; s/^/  /'
[ -n "$CHECK" ] && ! grep -q "nothing to change" <<<"$out" && changes=$((changes + 1))

# -------------------------------------------------------------- 3. widgets --
bold "3. Widgets"
mkdir -p "$PLUGINS"
plugins_changed=""
# The widgets' shared files come from ONE source each (system/omarchy/shared.json,
# 2026-10-06): the widgets are put together in a staging folder with those
# sources laid over them, and installed from there -- so a copy someone forgot
# to update can't reach the desktop.
STAGE=$(mktemp -d "${TMPDIR:-/tmp}/neuronet-widgets.XXXXXX")
trap 'rm -rf "$STAGE"' EXIT
rsync -a --exclude='* (2)*' --exclude='__pycache__' "$SYS"/omarchy/plugins/neuronet.* "$STAGE/"
python3 "$SYS/shared_files.py" --into "$STAGE" || die "Couldn't put the widgets' shared files together."
for d in "$STAGE"/neuronet.*; do
  id=$(basename "$d")
  if same_tree "$d" "$PLUGINS/$id"; then continue; fi
  plugins_changed=1
  if [ -n "$CHECK" ]; then would "install $id"; continue; fi
  if [ -e "$PLUGINS/$id" ]; then
    mkdir -p "$HOME/.config/omarchy/plugins-before-neuronet-$STAMP"
    mv -- "$PLUGINS/$id" "$HOME/.config/omarchy/plugins-before-neuronet-$STAMP/"
  fi
  rsync -a --exclude='* (2)*' --exclude='__pycache__' "$d" "$PLUGINS/"
  say "Installed $id"
done
[ -z "$plugins_changed" ] && say "All NeuroNet widgets are in place."
[ -d "$HOME/.config/omarchy/plugins-before-neuronet-$STAMP" ] && say "Replaced widgets kept in plugins-before-neuronet-$STAMP/"
[ -n "$plugins_changed" ] && [ -z "$CHECK" ] && { omarchy-shell shell rescanPlugins >/dev/null 2>&1 || true; }
# Glowing window borders: the Lua file the hyprland.lua block loads, made for
# this NeuroNet (off until Settings -> Appearance switches it on).
if [ -z "$CHECK" ] && [ -f "$APP/window_glow.py" ]; then
  python3 "$APP/window_glow.py" --refresh >/dev/null 2>&1 || true
fi
# The screensaver: NeuroNet's name in Omarchy's screensaver -- only over
# Omarchy's own untouched logo; the old one is kept (screensaver.py; Settings ->
# Screensaver switches back).
if [ -z "$CHECK" ] && [ -f "$APP/screensaver.py" ]; then
  [ "$(python3 "$APP/screensaver.py" --default 2>/dev/null)" = switched ] && say "Screensaver: NeuroNet (Omarchy's is kept -- Settings -> Screensaver)"
fi

SN="$SYS/omarchy/shell.neuronet.json"
[ -f "$SHELLJSON" ] && [ -z "$CHECK" ] && cp -a "$SHELLJSON" "$SHELLJSON.bak.$STAMP"

# The desktop widgets are gone (3 Nov 2026, Cam: "remove the widget
# functionality completely"): their own Quickshell (neuronet-desktop.service,
# ~483 MB) is stopped and switched off, and its unit and folder taken out. The
# board, frame and home plugins are 'retired' in shell.neuronet.json (set aside
# below); the bar widgets stay.
DESK="$HOME/.config/quickshell/neuronet-desktop"
DUNIT="$HOME/.config/systemd/user/neuronet-desktop.service"
if [ -e "$DUNIT" ] || [ -e "$DESK" ] || [ -e "$HOME/.local/bin/neuronet-shell" ] || [ -e "$HOME/.local/bin/neuronet-desk-edit" ]; then
  if [ -n "$CHECK" ]; then would "switch off the old desktop widgets (neuronet-desktop.service) and take them out"
  else
    systemctl --user disable --now neuronet-desktop.service >/dev/null 2>&1 || true
    rm -f -- "$DUNIT"; rm -rf -- "$DESK"
    systemctl --user daemon-reload 2>/dev/null || true
    rm -f -- "$HOME/.local/state/neuronet/desk-edit.json" "$HOME/.local/bin/neuronet-shell" "$HOME/.local/bin/neuronet-desk-edit"
    say "Switched off the old desktop widgets (no longer part of NeuroNet)"
  fi
fi
for id in $(jq -r '.plugins[].id' "$SN"); do
  plugin_on "$id" && continue
  if [ -n "$CHECK" ]; then would "switch on $id"; continue; fi
  omarchy plugin enable "$id" >/dev/null 2>&1 && say "Switched on $id" || warn "couldn't switch on $id"
done
# Bar widgets go beside the neighbour they have on Cam's computer. A
# neighbour may be another NeuroNet widget not placed yet, so go round while
# each round places something; whatever is left then goes in its section.
BAR_WIDGETS=$(jq -c '.bar | to_entries[] | .key as $s | .value[] | . + {section: $s}' "$SN")
place_round() {  # final? -> how many it placed
  local final="$1" n=0 w id after before sec
  while IFS= read -r w; do
    [ -z "$w" ] && continue
    id=$(jq -r .entry.id <<<"$w"); after=$(jq -r .after <<<"$w")
    before=$(jq -r .before <<<"$w"); sec=$(jq -r .section <<<"$w")
    on_bar "$id" && continue
    if on_bar "$after"; then omarchy bar put "$id" --after "$after" >/dev/null 2>&1 || true
    elif on_bar "$before"; then omarchy bar put "$id" --before "$before" >/dev/null 2>&1 || true
    elif [ -n "$final" ]; then omarchy bar put "$id" --section "$sec" >/dev/null 2>&1 || true
    fi
    if on_bar "$id"; then say "On the bar: $id ($sec)"; n=$((n + 1))
    elif [ -n "$final" ]; then warn "couldn't put $id on the bar -- omarchy bar put $id"; fi
  done <<<"$BAR_WIDGETS"
  echo "$n" > "$STATE_DIR/.placed"
}
if [ -n "$CHECK" ]; then
  while IFS= read -r w; do
    [ -z "$w" ] && continue
    on_bar "$(jq -r .entry.id <<<"$w")" || would "put $(jq -r .entry.id <<<"$w") on the bar ($(jq -r .section <<<"$w"))"
  done <<<"$BAR_WIDGETS"
else
  mkdir -p "$STATE_DIR"
  for _ in 1 2 3 4 5 6; do
    place_round ""
    [ "$(cat "$STATE_DIR/.placed")" = 0 ] && break
  done
  place_round final
  rm -f "$STATE_DIR/.placed"
fi
disabled=$(record_get disabled); disabled=${disabled:-[]}
for id in $(jq -r '.replaces[]?' "$SN"); do
  plugin_on "$id" || continue
  if [ -n "$CHECK" ]; then would "switch off $id (a NeuroNet widget takes its place)"; continue; fi
  omarchy plugin disable "$id" >/dev/null 2>&1 && say "Switched off $id (a NeuroNet widget takes its place)" \
    || warn "couldn't switch off $id"
  disabled=$(jq -c --arg id "$id" '(. + [$id]) | unique' <<<"$disabled")
done
[ -z "$CHECK" ] && record_set disabled "$disabled"
# NeuroNet widgets no longer part of NeuroNet (the class timer, 2026-09-29):
# off, off the bar, and set aside -- never deleted.
for id in $(jq -r '.retired[]?' "$SN"); do
  here=""; [ -d "$PLUGINS/$id" ] && here=1; plugin_on "$id" && here=1; on_bar "$id" && here=1
  [ -z "$here" ] && continue
  if [ -n "$CHECK" ]; then would "retire $id (no longer part of NeuroNet)"; continue; fi
  jq --arg id "$id" '.plugins |= map(select(.id != $id)) | .bar.layout |= map_values(map(select(.id != $id)))' \
    "$SHELLJSON" > "$SHELLJSON.part" && mv "$SHELLJSON.part" "$SHELLJSON"
  if [ -d "$PLUGINS/$id" ]; then
    mkdir -p "$HOME/.config/omarchy/plugins-removed-neuronet-$STAMP"
    mv -- "$PLUGINS/$id" "$HOME/.config/omarchy/plugins-removed-neuronet-$STAMP/"
  fi
  plugins_changed=1
  say "Retired $id (no longer part of NeuroNet; kept in plugins-removed-neuronet-$STAMP/)"
done

# Hand-made copies of a NeuroNet widget (the Claude dock was cam.claudedock on the
# PC and the laptop before NeuroNet had it, 10 Nov 2026): off, off the bar and
# set aside -- never deleted -- with NeuroNet's in their place.
for id in $(jq -r '.takes_over[]?' "$SN"); do
  here=""; [ -d "$PLUGINS/$id" ] && here=1; plugin_on "$id" && here=1; on_bar "$id" && here=1
  [ -z "$here" ] && continue
  if [ -n "$CHECK" ]; then would "set aside $id (NeuroNet's copy takes its place)"; continue; fi
  jq --arg id "$id" '.plugins |= map(select(.id != $id)) | .bar.layout |= map_values(map(select(.id != $id)))' \
    "$SHELLJSON" > "$SHELLJSON.part" && mv "$SHELLJSON.part" "$SHELLJSON"
  if [ -d "$PLUGINS/$id" ]; then
    mkdir -p "$HOME/.config/omarchy/plugins-removed-neuronet-$STAMP"
    mv -- "$PLUGINS/$id" "$HOME/.config/omarchy/plugins-removed-neuronet-$STAMP/"
  fi
  plugins_changed=1
  say "Set aside $id (NeuroNet's copy takes its place; kept in plugins-removed-neuronet-$STAMP/)"
done
# The Claude dock flashes when a tucked chat replies: Claude Code's Stop and
# Notification hooks run "claude-dock replied". Only where Claude Code is (its
# settings folder); the person's own hooks are kept, an old one that ran the
# hand-made copy's claudedock.py is replaced.
CLAUDE_SETTINGS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
if [ -d "$(dirname "$CLAUDE_SETTINGS")" ]; then
  res=$(CHECK="$CHECK" STAMP="$STAMP" python3 - "$CLAUDE_SETTINGS" <<'PY'
import json, os, shutil, sys
f = sys.argv[1]
try:
    cfg = json.load(open(f)) if os.path.exists(f) else {}
except ValueError:
    print("unreadable"); sys.exit(0)
ours = lambda h: isinstance(h, dict) and ("claudedock.py" in str(h.get("command", "")) or str(h.get("command", "")).strip() == "claude-dock replied")
want = {"type": "command", "command": "claude-dock replied", "timeout": 10}
before = json.dumps(cfg, sort_keys=True)
hooks = cfg.setdefault("hooks", {})
for ev in ("Stop", "Notification"):
    groups = []
    for g in hooks.get(ev, []):
        if isinstance(g, dict) and isinstance(g.get("hooks"), list):
            g = dict(g, hooks=[h for h in g["hooks"] if not ours(h)])
            if not g["hooks"]:
                continue
        groups.append(g)
    groups.append({"hooks": [want]})
    hooks[ev] = groups
if json.dumps(cfg, sort_keys=True) == before:
    print("same"); sys.exit(0)
if not os.environ["CHECK"]:
    if os.path.exists(f):
        shutil.copy2(f, f + ".bak." + os.environ["STAMP"])
    tmp = f + ".part"
    json.dump(cfg, open(tmp, "w"), indent=2); open(tmp, "a").write("\n"); os.replace(tmp, f)
print("changed")
PY
)
  case "$res" in
    same) say "Claude dock: Claude Code's hooks are in place." ;;
    changed) if [ -n "$CHECK" ]; then would "add the Claude dock's hooks to $CLAUDE_SETTINGS"
             else say "Claude dock: added Claude Code's Stop and Notification hooks (backup: .bak.$STAMP)"; fi ;;
    *) warn "couldn't read $CLAUDE_SETTINGS -- the Claude dock won't flash on replies" ;;
  esac
fi

# --------------------------------------------------------------- 4. themes --
bold "4. Themes"
mkdir -p "$THEMES"
for d in "$SYS"/omarchy/themes/*; do
  t=$(basename "$d")
  if same_tree "$d" "$THEMES/$t"; then :
  elif [ -n "$CHECK" ]; then would "install the $t theme"
  else
    if [ -e "$THEMES/$t" ]; then
      mkdir -p "$HOME/.config/omarchy/themes-before-neuronet-$STAMP"
      # keep this computer's wallpapers: they're drawn, and the same
      [ -d "$THEMES/$t/backgrounds" ] && cp -a "$THEMES/$t/backgrounds" "/tmp/nn-bg-$STAMP-$t"
      mv -- "$THEMES/$t" "$HOME/.config/omarchy/themes-before-neuronet-$STAMP/"
    fi
    rsync -a "$d" "$THEMES/"
    [ -d "/tmp/nn-bg-$STAMP-$t" ] && mv "/tmp/nn-bg-$STAMP-$t" "$THEMES/$t/backgrounds"
    say "Installed the $t theme"
  fi
done
# Cam's pictures (system/wallpapers/photos, 2026-10-01) -- a computer with the
# old drawn ones gets these instead
need_walls=""
for t in dark light; do
  theme=neuronet; [ "$t" = light ] && theme=neuronet-light
  for f in "$SYS"/wallpapers/photos/$t/*.jpg; do
    cmp -s "$f" "$THEMES/$theme/backgrounds/$(basename "$f")" || need_walls=1
  done
  [ -e "$THEMES/$theme/backgrounds/01-neural-field.png" ] && need_walls=1
done
if [ -n "$need_walls" ]; then
  if [ -n "$CHECK" ]; then would "put the wallpapers in place"
  else say "Putting the wallpapers in place (a minute)..."
    if bash "$SYS/wallpapers/make.sh" >/dev/null 2>&1; then
      say "Wallpapers in place."
      # the theme in use is a copy (~/.local/state/omarchy/current/theme): renew it
      cur=$(cat "$HOME/.local/state/omarchy/current/theme.name" 2>/dev/null || true)
      if [ "$cur" = neuronet ] || [ "$cur" = neuronet-light ]; then
        omarchy theme set "$cur" >/dev/null 2>&1 || true
      fi
    else warn "couldn't make the wallpapers -- run: bash $SYS/wallpapers/make.sh"
    fi
  fi
else
  say "NeuroNet and NeuroNet Light are in place."
fi

# ----------------------------------------------------------------- 5. hook --
bold "5. Theme hook"
mkdir -p "$HOOKS/theme-set.d"
for f in "$SYS"/omarchy/hooks/theme-set.d/*; do
  dst="$HOOKS/theme-set.d/$(basename "$f")"
  cmp -s "$f" "$dst" && { say "In place: $(basename "$f")"; continue; }
  if [ -n "$CHECK" ]; then would "install hook $(basename "$f")"; continue; fi
  [ -e "$dst" ] && cp -a "$dst" "$dst.bak.$STAMP"
  install -m 755 "$f" "$dst"; say "Installed hook $(basename "$f")"
done

# ------------------------------------------------------------ 6. Hyprland --
bold "6. Hyprland (shortcuts, login start, window rule)"
# NeuroPets' key says NeuroPets, not NeuroNet -- it's ours too, never a clash. Any
# "Neuro..." description is ours: a list of names missed NeuroArcana (1 Nov 2026), so its
# Super+Alt+Y counted as somebody else's on the next update and was taken out again
# The Claude dock's key was written by hand on the PC (1 Nov 2026, "Claude dock: ...") before NeuroNet had it
taken=$(omarchy menu keybindings --print 2>/dev/null | grep -vE "→ *(Neuro[A-Z]|Claude dock)" || true)
# Omarchy's own defaults: a key the block unbinds first may replace one of
# THESE (never one of Cam's own bindings)
defaults=$(cat "${OMARCHY_PATH:-/usr/share/omarchy}"/default/hypr/bindings/*.lua 2>/dev/null || true)
HYPR_BAK=()
for blk in "$SYS"/hypr/*.block; do
  file=$(basename "$blk" .block); target="$HYPR/$file"
  touch "$target"
  # the backup before anything is written; dropped again if nothing was
  [ -z "$CHECK" ] && cp -a "$target" "$target.bak.$STAMP"
  res=$(TARGET="$target" BLOCK="$blk" TAKEN="$taken" DEFAULTS="$defaults" BEGIN="$BEGIN" END="$END" CHECK="$CHECK" python3 - <<'PY'
import os, re
target, blk = os.environ["TARGET"], os.environ["BLOCK"]
b, e = os.environ["BEGIN"], os.environ["END"]
# Omarchy 4.5 prints a key's aliases on one line ("SUPER + W / SUPER + Q  → Close window"):
# one line per key, so the second one counts as taken too
taken = []
for t in os.environ["TAKEN"].splitlines():
    keys, arrow, rest = t.partition("→")
    for k in (keys.split(" / ") if arrow else [keys]):
        taken.append(k.strip() + "  " + arrow + rest)
defaults = os.environ.get("DEFAULTS", "")
OLD = [("-- >>> NeuroNet quick access (install.sh)", "-- <<< NeuroNet quick access (install.sh)"), (b, e)]

def menu_form(keys):     # "SUPER + ALT + N" -> "SUPER ALT + N", as omarchy prints it
    p = [x.strip() for x in keys.split("+")]
    return " ".join(p[:-1]) + " + " + p[-1] if len(p) > 1 else p[0]

norm = lambda k: k.replace(" ", "").upper()
src = open(blk, encoding="utf-8").read().splitlines()
# keys the block deliberately takes over: hl.unbind("KEYS") just before
unbinds = {norm(m.group(1)) for m in (re.match(r'\s*hl\.unbind\(\s*"([^"]+)"', l) for l in src) if m}
default_keys = {norm(k) for k in re.findall(r'(?:o\.bind|hl\.bind)\(\s*"([^"]+)"', defaults)}
want, skipped, dropped = [], [], set()
for line in src:
    m = re.match(r'\s*(?:o\.bind|hl\.bind)\(\s*"([^"]+)"', line)
    if m:
        hit = next((t for t in taken if re.match(re.escape(menu_form(m.group(1))) + r"\s", t)), None)
        # taken by Omarchy's default only, and the block unbinds it: ours
        own = hit and norm(m.group(1)) in unbinds and norm(m.group(1)) in default_keys and hit.split("→")[-1].strip() in defaults
        if hit and not own:
            skipped.append("%s (already: %s)" % (m.group(1), hit.split("→")[-1].strip()))
            dropped.add(norm(m.group(1)))
            continue
    want.append(line)
# an unbind whose bind was left out would only take Omarchy's key away
want = [l for l in want if not (re.match(r'\s*hl\.unbind\(\s*"([^"]+)"', l)
        and norm(re.match(r'\s*hl\.unbind\(\s*"([^"]+)"', l).group(1)) in dropped)]
lines = open(target, encoding="utf-8").read().splitlines()
kept, cur, skip = [], [], False
for l in lines:
    if any(l == x for x, _ in OLD): skip = True; cur.append(l); continue
    if any(l == y for _, y in OLD): skip = False; cur.append(l); continue
    (cur if skip else kept).append(l)

# NeuroNet lines written by hand, outside the block, that the block now does
# too: on Cam's desktop (2026-10-01) his own "SUPER + ALT + N ... neuronet-quick
# notes" lines stayed above the block, so every key ran neuronet-quick twice --
# shown, then hidden again at once. They're replaced by the block's (the file
# is backed up first); a hand-written NeuroNet line the block doesn't have
# (another key, another command) is kept.
def ident(line):
    s = line.strip()
    if s.startswith("--") or ("neuronet" not in s.lower() and "claude-dock" not in s):
        return None
    m = re.match(r'(?:o\.bind|hl\.bind)\(\s*"([^"]+)"', s)
    if m:
        return ("bind", m.group(1).replace(" ", "").upper())
    m = re.match(r'o\.launch_on_start\(\s*"([^"]+)"', s)
    if m:
        cmd = m.group(1).split()
        return ("launch", " ".join([os.path.basename(cmd[0])] + cmd[1:]))
    if s.startswith("o.window(") and "special:neuronet" in s:
        return ("window",)
    return None

block_ids = {ident(l) for l in want} - {None}
replaced, out, para = [], [], []
def flush():
    stmts = [l for l in para if l.strip() and not l.strip().startswith("--")]
    gone = [l for l in stmts if ident(l) in block_ids]
    replaced.extend(gone)
    if gone and len(gone) == len(stmts):
        return                           # the whole paragraph was NeuroNet's: its comments go too
    out.extend(l for l in para if l not in gone)
for l in kept + [""]:
    para.append(l)
    if l.strip() == "":
        flush(); para = []
kept = out
while kept and kept[-1] == "": kept.pop()
for r in replaced:
    print("replaced " + r.strip())
if cur == want and not replaced:
    print("same")
else:
    if not os.environ["CHECK"]:
        open(target, "w", encoding="utf-8").write("\n".join(kept + [""] + want) + "\n")
    print("changed")
for s in skipped:
    print("skipped " + s)
PY
)
  if grep -q '^changed' <<<"$res"; then
    if [ -n "$CHECK" ]; then would "update the NeuroNet block in $file"
    else HYPR_BAK+=("$target"); say "$file: NeuroNet block updated (backup: .bak.$STAMP)"; fi
  else
    say "$file: in place"
    [ -z "$CHECK" ] && rm -f -- "$target.bak.$STAMP"
  fi
  while IFS= read -r l; do
    [[ "$l" == skipped\ * ]] && warn "Not added, the keys are taken here: ${l#skipped }"
    if [[ "$l" == replaced\ * ]]; then
      if [ -n "$CHECK" ]; then would "replace a NeuroNet line outside the block in $file: ${l#replaced }"
      else say "$file: replaced by the block (it would have run twice): ${l#replaced }"; fi
    fi
  done <<<"$res"
done
if [ ${#HYPR_BAK[@]} -gt 0 ]; then
  hyprctl reload >/dev/null 2>&1 || true; sleep 1
  errs=$(hyprctl configerrors 2>/dev/null | grep -v '^\s*$' || true)
  if [ -n "$errs" ]; then
    warn "Hyprland reported errors, so its files were put back as they were:"
    printf '%s\n' "$errs" | sed 's/^/      /'
    for t in "${HYPR_BAK[@]}"; do [ -f "$t.bak.$STAMP" ] && cp -a "$t.bak.$STAMP" "$t"; done
    hyprctl reload >/dev/null 2>&1 || true
  else
    say "Hyprland reloaded with no config errors."
  fi
fi

# ------------------------------------------------------------ 7. services --
bold "7. Services"
if systemctl --user is-enabled neuronet-menu.path >/dev/null 2>&1; then
  say "The Omarchy-menu indexer is on."
elif [ -n "$CHECK" ]; then would "switch on the Omarchy-menu indexer"
else
  systemctl --user enable --now neuronet-menu.path >/dev/null 2>&1 && say "Switched on the Omarchy-menu indexer." \
    || warn "couldn't switch on neuronet-menu.path"
fi

# ---------------------------------------------------------------- 8. theme --
bold "8. Theme"
cur=$(cat "$HOME/.local/state/omarchy/current/theme.name" 2>/dev/null || true)
if [[ "$cur" == neuronet* ]]; then
  say "In use: $cur"
elif [ -n "$(record_get installed)" ]; then
  # Offered on the FIRST install only. Every update runs this with --yes, so
  # asking here switched Cam's theme back to NeuroNet at every update (found
  # 2026-10-02: he'd chosen Nord). His choice stands.
  say "Theme: $cur (yours -- kept)"
elif [ -n "$CHECK" ]; then would "switch to the NeuroNet theme (from $cur)"
elif ask "Switch to the NeuroNet theme now?"; then
  record_set themeBefore "$(jq -Rn --arg t "$cur" '$t')"
  omarchy theme set neuronet >/dev/null 2>&1 && say "Theme: NeuroNet (the eye on the home screen switches to Light)" \
    || warn "couldn't set it: omarchy theme set neuronet"
fi

# --------------------------------------------------------------- 9. start --
if [ -n "$CHECK" ]; then
  bold "$([ "$changes" = 0 ] && echo "Nothing to change -- NeuroNet is installed as the repo has it." || echo "$changes change(s) would be made.")"
  exit 0
fi
record_set installed "$(jq -n --arg when "$(date -Iseconds)" --arg app "$APP" \
  --arg rev "$(git -C "$APP" rev-parse --short HEAD 2>/dev/null || echo unknown)" '{when: $when, app: $app, rev: $rev}')"
[ -n "$plugins_changed" ] && { restart_shell && say "Restarted the top bar to load the widgets." || true; }
bold "9. NeuroNet"
if [ -n "$NOSTART" ]; then say "(not started: --no-start)"
elif pgrep -f '^(/usr/bin/)?python3? [^ ]*neuronet\.py' >/dev/null; then say "NeuroNet is running."
else "$HOME/.local/bin/neuronet-quick" start >/dev/null 2>&1 && say "NeuroNet is starting in the background." \
  || warn "NeuroNet didn't start -- try: python3 $APP/neuronet.py --gui qt"
fi
# Check it came up as the shortcuts expect (2026-09-29, Manthies' computer:
# without python-qtpy it quietly came up under GTK, under another name, and
# every shortcut failed -- found only by reading start.log by hand).
if [ -z "$NOSTART" ]; then
  cls=""
  for _ in $(seq 1 25); do
    cls=$(hyprctl clients -j 2>/dev/null | jq -r '.[] | select(.title == "NeuroNet") | .class' | head -1)
    [ -n "$cls" ] && break; sleep 1
  done
  if grep -qi 'QT cannot be loaded' "${XDG_STATE_HOME:-$HOME/.local/state}/neuronet/start.log" 2>/dev/null; then
    warn "NeuroNet started WITHOUT Qt, so its shortcuts can't find it. Install python-qtpy"
    warn "(omarchy pkg add python-qtpy), then restart NeuroNet."
  elif [ -n "$cls" ] && [ "$cls" != "NeuroNet" ]; then
    warn "NeuroNet's window came up named \"$cls\", not \"NeuroNet\" -- run neuronet-doctor."
  elif [ -n "$cls" ]; then
    say "NeuroNet's window is up, and its shortcuts can find it."
  else
    # (clean-VM test, 2026-09-29: it hadn't started, and nothing said so)
    warn "NeuroNet's window didn't appear. What it said: ${XDG_STATE_HOME:-$HOME/.local/state}/neuronet/start.log"
    warn "-- or run neuronet-doctor."
  fi
fi
bold "Done. Keys and quick access: $APP/QUICK-ACCESS.md"
