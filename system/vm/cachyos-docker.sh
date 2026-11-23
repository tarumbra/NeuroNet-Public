#!/bin/bash
# cachyos-docker.sh -- try system/install-app.sh on a fresh CachyOS, in Docker.
#
#   sudo bash system/vm/cachyos-docker.sh          the checks (a few minutes the first time)
#   sudo bash system/vm/cachyos-docker.sh --show   ... then NeuroNet opens from the container,
#                                                  as a window on this desktop, to click around
#   sudo bash system/vm/cachyos-docker.sh --shell  ... then a shell in the container
#   sudo bash system/vm/cachyos-docker.sh --kde    ... then KDE mode on a real KWin
#                                                  (cachyos-kde-checks.sh: the shortcuts
#                                                  KDE takes, the window in front and away)
#
# Cam, 2026-10-14: "are you able to install a cachyOS onto docker? Then i can
# run and test the environment before commiting?"
#
# What it does: packs NeuroNet's CODE from the repo -- the files git knows,
# committed or not, so uncommitted work is tested too; never neuronet_data/
# (.gitignore) -- starts a fresh cachyos/cachyos container, installs Hyprland,
# makes a user "tester" with sudo, and as tester:
#   1. runs install-app.sh --yes (pacman installs NeuroNet's software)
#   2. Hyprland --verify-config on the hyprland.conf AND the hyprland.lua it made
#   3. starts NeuroNet and NeuroPets with no screen (Qt offscreen)
#      and checks each is still running 25 s later with no Python error
#   4. --uninstall, and checks the person's config is as it was
# Nothing on this computer is touched but Docker's own storage; the container
# is removed at the end. Docker needs root, hence sudo.
set -uo pipefail
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
APP="$(cd "$HERE/../.." && pwd)"
IMAGE="${CACHYOS_IMAGE:-cachyos/cachyos:latest}"
MODE="${1:-}"
NAME="neuronet-cachyos-test"

command -v docker >/dev/null || { echo "Docker isn't installed."; exit 1; }
systemctl is-active -q docker || systemctl start docker || { echo "Couldn't start Docker."; exit 1; }

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"; docker rm -f "$NAME" >/dev/null 2>&1' EXIT
echo "== Packing NeuroNet's code (no data)"
# run git as the repo's owner: under sudo, git refuses a repo root doesn't own
OWNER="$(stat -c %U "$APP")"
(cd "$APP" && sudo -u "$OWNER" git ls-files -co --exclude-standard -z) \
  | grep -zv -E '^(neuronet_data|Movies)/' \
  | tar -C "$APP" --null -T - -czf "$WORK/neuronet.tgz"
echo "   $(du -h "$WORK/neuronet.tgz" | cut -f1)"

cp "$HERE/cachyos-kde-checks.sh" "$WORK/kde.sh"
cat > "$WORK/inside.sh" <<'IN'
#!/bin/bash
set -uo pipefail
pass=0; fail=0
ok() { if [ "$2" = 0 ]; then pass=$((pass+1)); echo "  ok    $1"; else fail=$((fail+1)); echo "  FAIL  $1"; fi; }
echo "== CachyOS: $(. /etc/os-release; echo "$PRETTY_NAME")"
# pacman's download sandbox needs rights a container doesn't have (its hooks
# all failed, 2026-10-14); a real CachyOS doesn't need this
grep -q '^DisableSandbox' /etc/pacman.conf || sed -i '/^\[options\]/a DisableSandbox' /etc/pacman.conf
# a container has no machine id; D-Bus wants one
[ -s /etc/machine-id ] || tr -d - </proc/sys/kernel/random/uuid > /etc/machine-id
echo "== Base packages (sudo, hyprland, git)"
pacman -Syu --noconfirm --needed sudo hyprland git >/tmp/pacman.log 2>&1 || { tail -20 /tmp/pacman.log; exit 1; }
echo "   $(pacman -Q hyprland)"
useradd -m -u 1000 tester 2>/dev/null
echo "tester ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/tester
mkdir -p /home/tester/NeuroNet && tar -C /home/tester/NeuroNet -xzf /work/neuronet.tgz
mkdir -p /home/tester/.config/hypr
printf 'bind = SUPER, RETURN, exec, kitty\n' > /home/tester/.config/hypr/hyprland.conf
chown -R tester:tester /home/tester
T() { sudo -u tester -H env XDG_RUNTIME_DIR=/tmp/xdg-tester "$@"; }
mkdir -p /tmp/xdg-tester && chown tester /tmp/xdg-tester && chmod 700 /tmp/xdg-tester

echo; echo "== 1. install-app.sh --yes (hyprland.conf)"
T bash /home/tester/NeuroNet/system/install-app.sh --yes; ok "install-app.sh finished" $?
T python3 -c "import webview, qtpy, PyQt6.QtWebEngineWidgets, PIL, fitz, reportlab, docx, openpyxl"; ok "NeuroNet's Python libraries import" $?
ok "commands in ~/.local/bin" "$(test -x /home/tester/.local/bin/neuronet-quick -a -x /home/tester/.local/bin/neuropets; echo $?)"
ok "launcher entries" "$(test -f /home/tester/.local/share/applications/NeuroNet.desktop; echo $?)"
ok "no widget shell or Omarchy menu units" "$(! ls /home/tester/.config/systemd/user/neuronet-desktop.service /home/tester/.config/systemd/user/neuronet-menu.path >/dev/null 2>&1; echo $?)"

echo; echo "== 2. Hyprland checks the config"
out=$(T Hyprland --verify-config -c /home/tester/.config/hypr/hyprland.conf 2>&1); r=$?
echo "$out" | grep -iE "error|ok|neuronet" | head -12
ok "hyprland.conf + neuronet.conf verify" "$( [ $r = 0 ] && ! grep -qi "error" <<<"$out"; echo $?)"
T bash /home/tester/NeuroNet/system/install-app.sh --yes --uninstall >/dev/null
ok "uninstall puts hyprland.conf back" "$(printf 'bind = SUPER, RETURN, exec, kitty\n' | cmp -s - /home/tester/.config/hypr/hyprland.conf; echo $?)"
# the Lua kind: a hyprland.lua, as a Lua-config Hyprland has
T bash -c 'mv ~/.config/hypr/hyprland.conf ~/.config/hypr/hyprland.conf.off; printf "hl.bind(\"SUPER + RETURN\", hl.dsp.exec_cmd(\"kitty\"))\n" > ~/.config/hypr/hyprland.lua'
T bash /home/tester/NeuroNet/system/install-app.sh --yes --no-packages >/dev/null; ok "install-app.sh (hyprland.lua) finished" $?
out=$(T Hyprland --verify-config -c /home/tester/.config/hypr/hyprland.lua 2>&1); r=$?
echo "$out" | grep -iE "error|ok|neuronet|lua" | head -12
ok "hyprland.lua + neuronet.lua verify (this Hyprland may not take Lua -- then it's the .conf that counts)" "$( [ $r = 0 ] && ! grep -qi "error" <<<"$out"; echo $?)"

echo; echo "== 3. NeuroNet and NeuroPets start (no screen)"
for app in neuronet neuropets; do
  log=/tmp/$app.log
  T env QT_QPA_PLATFORM=offscreen QTWEBENGINE_DISABLE_SANDBOX=1 QTWEBENGINE_CHROMIUM_FLAGS="--disable-gpu" \
    bash -c "cd ~/NeuroNet && exec python3 $app.py --gui qt" >"$log" 2>&1 &
  pid=$!; sleep 25
  alive=1; kill -0 $pid 2>/dev/null && alive=0
  ok "$app is running after 25 s" $alive
  ok "$app: no Python error" "$(! grep -q Traceback "$log"; echo $?)"
  [ $alive = 0 ] || tail -15 "$log"
  grep -q Traceback "$log" && grep -A12 Traceback "$log" | head -20
  kill $pid 2>/dev/null; sleep 2; kill -9 $pid 2>/dev/null; wait $pid 2>/dev/null
done

echo; echo "== $pass passed, $fail failed"
[ $fail = 0 ]
IN

echo "== Starting $IMAGE"
docker pull -q "$IMAGE" >/dev/null || { echo "Couldn't pull $IMAGE (set CACHYOS_IMAGE=... to use another)"; exit 1; }
# a test container left from an earlier run (stopped part-way, or still
# going in another terminal) holds the name; it's disposable (2026-10-14)
if docker container inspect "$NAME" >/dev/null 2>&1; then
  echo "   (removing a test container left from an earlier run: $(docker ps -a --filter "name=^$NAME\$" --format '{{.Status}}'))"
  docker rm -f "$NAME" >/dev/null
fi
docker run -d --name "$NAME" -v "$WORK:/work:ro" "$IMAGE" sleep infinity >/dev/null || exit 1
docker exec "$NAME" bash /work/inside.sh; rc=$?
if [ "$MODE" = --kde ]; then
  docker exec "$NAME" bash /work/kde.sh || rc=1
fi

if [ "$MODE" = --show ]; then
  # NeuroNet from the container, drawn on this desktop: this desktop's Wayland
  # socket and GPU are lent to it. Its data is the container's (empty) one.
  U="${SUDO_UID:-1000}"; RT="/run/user/$U"; WL="${WAYLAND_DISPLAY:-wayland-1}"
  [ -S "$RT/$WL" ] || { echo "No Wayland socket at $RT/$WL"; exit $rc; }
  docker commit "$NAME" neuronet-cachyos-tested >/dev/null
  echo; echo "== NeuroNet from CachyOS opens on your desktop; close its window to finish."
  echo "   (NeuroPets: run this again with SHOW_APP=neuropets.py)"
  # Its window is named NeuroNet-CachyOS: under "NeuroNet" this desktop's own
  # window rule hid it on the NeuroNet workspace, beside the real NeuroNet,
  # and the shortcuts could have picked either (2026-10-14). Drawn without
  # the graphics card -- the container has no driver for it (NVIDIA here) --
  # so it's slower than the real thing.
  docker run --rm -u 1000 -e HOME=/home/tester -e XDG_RUNTIME_DIR=/tmp/xdg -e WAYLAND_DISPLAY=wl \
    -e QT_QPA_PLATFORM=wayland -e QTWEBENGINE_DISABLE_SANDBOX=1 -e NEURONET_APP_ID=NeuroNet-CachyOS \
    -e LIBGL_ALWAYS_SOFTWARE=1 -e QTWEBENGINE_CHROMIUM_FLAGS="--disable-gpu" \
    -v "$RT/$WL:/tmp/xdg/wl" -w /home/tester/NeuroNet neuronet-cachyos-tested \
    python3 "${SHOW_APP:-neuronet.py}" --gui qt
  docker image rm neuronet-cachyos-tested >/dev/null 2>&1
elif [ "$MODE" = --shell ]; then
  echo; echo "== A shell in the container as tester (exit to finish; it's removed after)"
  docker exec -it -u tester -w /home/tester "$NAME" bash
fi
exit $rc
