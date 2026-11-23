#!/bin/bash
# cachyos-kde-checks.sh -- NeuroNet's KDE mode on a real KWin, inside the
# CachyOS test container (cachyos-docker.sh --kde runs it, as root, after the
# Hyprland checks; NeuroNet is unpacked in /home/tester/NeuroNet).
#
# Cam, 2026-10-14: "please commence building a KDE mode". What the test
# stand-ins can't show: that KDE's shortcut service takes NeuroNet's keys,
# and that KWin really brings the window forward and it really hides.
# KWin runs with no screen (--virtual) and its shortcut service beside it, in
# a session bus of their own; NeuroNet draws into that KWin.
set -uo pipefail
pass=0; fail=0
ok() { if [ "$2" = 0 ]; then pass=$((pass+1)); echo "  ok    $1"; else fail=$((fail+1)); echo "  FAIL  $1"; fi; }

echo; echo "== KDE: KWin, KDE's shortcut service, Qt for Wayland"
pacman -S --noconfirm --needed kwin kglobalacceld qt6-wayland gdb >/tmp/pacman-kde.log 2>&1 || { tail -20 /tmp/pacman-kde.log; exit 1; }
echo "   $(pacman -Q kwin kglobalacceld | tr '\n' ' ')"
# kwin_wayland carries a file capability (CAP_SYS_NICE, to run at high
# priority) that Docker doesn't grant, so it won't even start here ("Operation
# not permitted", 2026-10-14). A plain copy has none. Only in this container.
cp /usr/bin/kwin_wayland /usr/local/bin/kwin_wayland_test && chmod 755 /usr/local/bin/kwin_wayland_test
T() { sudo -u tester -H env XDG_RUNTIME_DIR=/tmp/xdg-tester "$@"; }

cat > /tmp/kde-session.sh <<'SESSION'
#!/bin/bash
# runs as tester, inside its own session bus (dbus-run-session)
set -uo pipefail
pass=0; fail=0
ok() { if [ "$2" = 0 ]; then pass=$((pass+1)); echo "  ok    $1"; else fail=$((fail+1)); echo "  FAIL  $1"; fi; }
export XDG_CURRENT_DESKTOP=KDE KDE_SESSION_VERSION=6 XDG_SESSION_TYPE=wayland
cd ~/NeuroNet

echo; echo "== 1. install-app.sh --desktop kde"
bash system/install-app.sh --yes --desktop kde; ok "install-app.sh (KDE) finished" $?
ok "the shortcuts file and its kglobalaccel link" "$(test -L ~/.local/share/kglobalaccel/net.neuronet.shortcuts.desktop -a -f ~/.local/share/applications/net.neuronet.shortcuts.desktop; echo $?)"
ok "autostart (NeuroNet hidden at login)" "$(grep -q 'neuronet-quick start' ~/.config/autostart/neuronet.desktop; echo $?)"
ok "Spectacle is there for capture" "$(command -v spectacle >/dev/null; echo $?)"
command -v desktop-file-validate >/dev/null && { desktop-file-validate ~/.local/share/applications/net.neuronet.shortcuts.desktop; ok "the shortcuts file is a valid launcher file" $?; }

echo; echo "== 2. KDE's shortcut service (no screen needed)"
# On its own, drawing nowhere: what matters is that it reads NeuroNet's
# shortcuts file and takes the keys. Stopped again before KWin starts (KWin
# runs its own).
QT_QPA_PLATFORM=offscreen /usr/lib/kglobalacceld >/tmp/kglobalaccel.log 2>&1 &
KGA_PID=$!
for _ in $(seq 1 40); do busctl --user call org.freedesktop.DBus /org/freedesktop/DBus org.freedesktop.DBus NameHasOwner s org.kde.kglobalaccel 2>/dev/null | grep -q true && break; sleep 0.5; done
comps=$(busctl --user call org.kde.kglobalaccel /kglobalaccel org.kde.KGlobalAccel allComponents 2>&1)
echo "   components: $comps" | cut -c1-200
ok "KDE's shortcut service has NeuroNet's shortcuts" "$(grep -q neuronet <<<"$comps"; echo $?)"
grep -q neuronet <<<"$comps" || { echo "   its log:"; tail -20 /tmp/kglobalaccel.log | sed 's/^/     /'; }
cpath=$(grep -o '"/component/[^"]*neuronet[^"]*"' <<<"$comps" | tr -d '"' | head -1)
if [ -n "$cpath" ]; then
  infos=$(busctl --user --json=short call org.kde.kglobalaccel "$cpath" org.kde.kglobalaccel.Component allShortcutInfos 2>&1)
  # each shortcut's details: its names, and its keys as numbers somewhere inside
  cat > /tmp/kga.py <<'KGA'
import json, sys
def nums(x):
    if isinstance(x, int): return [x] if x else []
    if isinstance(x, list): return [n for y in x for n in nums(y)]
    return []
try:
    d = json.load(sys.stdin)["data"][0]
except Exception as e:
    print("0"); print("      (couldn't read: %s)" % e); sys.exit()
keyed = [s for s in d if nums(s)]
print(len(keyed))
for s in d:
    print("      %s  %s" % ([x for x in s if isinstance(x, str) and x][:2], nums(s)[:2]))
KGA
  out=$(python3 /tmp/kga.py <<<"$infos"); n=$(head -1 <<<"$out")
  tail -n +2 <<<"$out" | head -25
  ok "with keys on them ($n)" "$( [ "${n:-0}" -ge 15 ]; echo $?)"
fi
kill "$KGA_PID" 2>/dev/null; wait "$KGA_PID" 2>/dev/null; KGA_PID=""

echo; echo "== 3. KWin (no screen)"
QT_FORCE_STDERR_LOGGING=1 KWIN_COMPOSE=Q /usr/local/bin/kwin_wayland_test --virtual --no-lockscreen --socket wayland-kde --width 1920 --height 1080 >/tmp/kwin.log 2>&1 &
KWIN_PID=$!
# stopped before this session's bus goes: left running, KWin aborts when the
# bus vanishes and the host's crash notifier reports it (2026-10-14)
finish() {
  pkill -u "$(id -u)" -f '[n]euronet.py|[n]europets.py' 2>/dev/null
  [ -n "${KGA_PID:-}" ] && kill "$KGA_PID" 2>/dev/null
  if kill -0 "$KWIN_PID" 2>/dev/null; then
    kill -TERM "$KWIN_PID"; for _ in $(seq 1 20); do kill -0 "$KWIN_PID" 2>/dev/null || break; sleep 0.25; done
  else
    echo "   (KWin had stopped by itself before the end)"
  fi
  if [ "$fail" != 0 ]; then
    echo; echo "== KWin's log (last 40 lines)"; grep -v NNWINDOWS /tmp/kwin.log | tail -40 | sed 's/^/   /'
    echo "== NeuroNet's start log (last 15 lines)"; tail -15 ~/.local/state/neuronet/start.log 2>/dev/null | sed 's/^/   /'
  fi
}
trap finish EXIT
for _ in $(seq 1 60); do [ -S "$XDG_RUNTIME_DIR/wayland-kde" ] && break; sleep 0.5; done
ok "KWin is running" "$(test -S "$XDG_RUNTIME_DIR/wayland-kde"; echo $?)"
if [ ! -S "$XDG_RUNTIME_DIR/wayland-kde" ]; then
  # where it died: once more under gdb, its messages forced to the screen
  echo; echo "== KWin under gdb (why it stopped)"
  QT_FORCE_STDERR_LOGGING=1 KWIN_COMPOSE=Q timeout 90 gdb -q -batch -ex run -ex bt -ex quit \
    --args /usr/local/bin/kwin_wayland_test --virtual --no-lockscreen --socket wayland-kde2 --width 1920 --height 1080 2>&1 \
    | grep -vE "^\[(New|Thread|Detaching)|^Downloading|debuginfod|^warning: (Missing|could not)" | tail -45 | sed 's/^/   /'
  echo "== KDE: $pass passed, $fail failed (the window checks need KWin)"; exit 1
fi
export WAYLAND_DISPLAY=wayland-kde QT_QPA_PLATFORM=wayland QTWEBENGINE_DISABLE_SANDBOX=1 \
       QTWEBENGINE_CHROMIUM_FLAGS="--disable-gpu" LIBGL_ALWAYS_SOFTWARE=1

# KWin's view of the windows: a one-off KWin script prints them into KWin's log
kwin_windows() {
  local js n
  js=$(mktemp --suffix=.js); echo > /tmp/kwin.mark
  cat >"$js" <<'JS'
var l = workspace.windowList(), out = [];
for (var i = 0; i < l.length; i++) { var w = l[i]; if (!w.normalWindow) continue;
  out.push(w.resourceClass + "|" + (workspace.activeWindow === w ? "active" : "-") + "|" + (w.minimized ? "min" : "-")
           + "|" + Math.round(w.frameGeometry.width) + "x" + Math.round(w.frameGeometry.height)); }
print("NNWINDOWS " + out.join(";"));
JS
  local before; before=$(grep -c NNWINDOWS /tmp/kwin.log)
  n=$(busctl --user call org.kde.KWin /Scripting org.kde.kwin.Scripting loadScript ss "$js" "nnlist$RANDOM" | awk '{print $2}')
  busctl --user call org.kde.KWin "/Scripting/Script$n" org.kde.kwin.Script run >/dev/null 2>&1
  for _ in $(seq 1 20); do [ "$(grep -c NNWINDOWS /tmp/kwin.log)" -gt "$before" ] && break; sleep 0.2; done
  grep NNWINDOWS /tmp/kwin.log | tail -1 | sed 's/.*NNWINDOWS //'
  rm -f "$js"
}
state() { busctl --user call "org.$1.App" "/org/$1/App" "org.$1.App" State 2>/dev/null | sed -E 's/^s "(.*)"$/\1/'; }
waitfor() { for _ in $(seq 1 "${2:-60}"); do eval "$1" && return 0; sleep 0.5; done; return 1; }

echo; echo "== 4. NeuroNet in KWin"
mkdir -p ~/.local/state/neuronet && echo '{}' > ~/.local/state/neuronet/welcome.json   # past the welcome
~/.local/bin/neuronet-quick start
waitfor '[ "$(state neuronet)" = hidden ]' 120; ok "start: running, hidden" $?
sleep 3; w=$(kwin_windows); echo "   KWin: ${w:-no windows}"
ok "  and KWin has no NeuroNet window" "$(! grep -qi 'neuronet|' <<<"$w"; echo $?)"

~/.local/bin/neuronet-quick notes; sleep 4
w=$(kwin_windows); echo "   KWin: $w"
ok "Super+Alt+N: the popup is up" "$( [ "$(state neuronet)" = popup ]; echo $?)"
ok "  in front (KWin's active window)" "$(grep -qiE '(^|;)neuronet\|active' <<<"$w"; echo $?)"
~/.local/bin/neuronet-quick notes; sleep 2
w=$(kwin_windows); echo "   KWin: ${w:-no windows}"
ok "Super+Alt+N again: put away, gone from KWin" "$( [ "$(state neuronet)" = hidden ] && ! grep -qi 'neuronet|' <<<"$w"; echo $?)"
~/.local/bin/neuronet-quick full; sleep 3
w=$(kwin_windows); echo "   KWin: $w"
ok "Super+Alt+O: the whole app, in front" "$( [ "$(state neuronet)" = full ] && grep -qiE '(^|;)neuronet\|active' <<<"$w"; echo $?)"
ok "  maximised (1920 wide)" "$(grep -qiE '(^|;)neuronet\|[^|]*\|[^|]*\|19[0-9][0-9]x' <<<"$w"; echo $?)"

echo; echo "== 5. NeuroPets in KWin"
~/.local/bin/neuropets toggle
waitfor '[ -n "$(state neuropets)" ]' 120; sleep 4
w=$(kwin_windows); echo "   KWin: $w"
ok "Super+Alt+G: NeuroPets opens" "$(grep -qi 'neuropets|' <<<"$w"; echo $?)"
~/.local/bin/neuronet-quick notes; sleep 3          # something else in front
~/.local/bin/neuropets toggle; sleep 2
~/.local/bin/neuropets toggle; sleep 3
w=$(kwin_windows); echo "   KWin: $w"
ok "Super+Alt+G twice: away and back, in front of NeuroNet" "$(grep -qiE '(^|;)neuropets\|active' <<<"$w"; echo $?)"
~/.local/bin/neuropets toggle; sleep 2
w=$(kwin_windows)
ok "Super+Alt+G again: tucked away" "$( [ "$(state neuropets)" = hidden ] && ! grep -qi 'neuropets|' <<<"$w"; echo $?)"

grep -iE "traceback|error" ~/.local/state/neuronet/start.log 2>/dev/null | grep -v -iE "dbus|gpu|egl|mesa|vaapi|libva|machine-id" | head -5
kill -0 "$KWIN_PID" 2>/dev/null; ok "KWin was still running at the end" $?
echo; echo "== KDE: $pass passed, $fail failed"
[ "$fail" = 0 ]
SESSION
chmod 755 /tmp/kde-session.sh
T dbus-run-session bash /tmp/kde-session.sh
