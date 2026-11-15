"""Another app opened over the popup -> the tool becomes a window beside it.

Cam (2026-10-02): "When i have a tool open, after using shortcut to open it.
If i click print the page attatchs to the tool so when i close the tool it
closes the document as well. I need any app opened while the tool is up to
remain seperate from the tool. That way i can open a browser while i have a
tool open."

WHY IT HAPPENED. The popup is a Hyprland scratchpad (special:neuronet, see
neuronet-quick). While it has focus, Hyprland opens every NEW window on it --
Print's browser window, a browser started from the launcher, mpv from the
Shelf -- so they hid with the tool and looked attached to it.

WHAT THIS DOES. Listens on Hyprland's event socket (socket2) and, when a
window that isn't NeuroNet opens on special:neuronet, runs
`neuronet-quick dock <address>`. The script decides the rest (a floating
window -- a file picker, a dialog -- stays with the tool) and does the moving,
so everything about windows stays in one place.

ON SCREEN OR NOT (the performance audit, 3 Nov 2026). The same events say
when NeuroNet's own window goes out of sight -- tucked into special:neuronet,
or left on a workspace that isn't showing. Hyprland still calls it mapped
and visible, so neither Qt nor the page ever knew, and every timer and
animation ran all day. On a workspace or window event the watcher asks
hyprctl where the window is (on_screen) and calls `seen(True|False)` when
that changes; neuronet.py marks the page hidden, so Chromium itself rests
everything (document.hidden, no animation frames, slower timers).

Started from main() only, so no test or import ever listens. Nothing to do
outside Hyprland (no socket), and it gives up quietly if the socket goes.
"""
import os
import socket
import subprocess
import threading
import time

SPECIAL = "special:neuronet"
OURS = {"neuronet", "neuronet.py"}


def socket_path(env=None):
    env = os.environ if env is None else env
    sig = env.get("HYPRLAND_INSTANCE_SIGNATURE")
    if not sig:
        return ""
    runtime = env.get("XDG_RUNTIME_DIR") or "/run/user/%d" % os.getuid()
    for base in (os.path.join(runtime, "hypr"), "/tmp/hypr"):
        p = os.path.join(base, sig, ".socket2.sock")
        if os.path.exists(p):
            return p
    return ""


def to_dock(line):
    """One socket2 line -> the address to dock, or "".

    openwindow>>ADDRESS,WORKSPACENAME,CLASS,TITLE (the title may hold commas)."""
    if not line.startswith("openwindow>>"):
        return ""
    parts = line[len("openwindow>>"):].split(",", 3)
    if len(parts) < 3:
        return ""
    addr, ws, cls = parts[0].strip(), parts[1].strip(), parts[2].strip()
    if ws != SPECIAL or not addr or cls.lower() in OURS:
        return ""
    return addr if addr.startswith("0x") else "0x" + addr


# the events after which NeuroNet's window may have come into or gone out of sight
SIGHT = ("workspace>>", "workspacev2>>", "focusedmon>>", "focusedmonv2>>", "activespecial>>", "activespecialv2>>",
         "movewindow>>", "movewindowv2>>", "openwindow>>", "closewindow>>", "monitoradded>>", "monitorremoved>>",
         "moveworkspace>>", "moveworkspacev2>>")


def on_screen(clients, monitors, pid):
    """Is any window of process `pid` on a workspace a monitor is showing (its
    workspace, or the special one open over it)? None when it has no window."""
    shown = set()
    for m in monitors or []:
        for k in ("activeWorkspace", "specialWorkspace"):
            name = ((m or {}).get(k) or {}).get("name")
            if name:
                shown.add(name)
    mine = [c for c in clients or [] if (c or {}).get("pid") == pid and c.get("mapped", True)]
    if not mine:
        return None
    return any(((c.get("workspace") or {}).get("name") in shown) and not c.get("hidden") for c in mine)


def _hyprctl(what):
    import json
    try:
        out = subprocess.run(["hyprctl", what, "-j"], capture_output=True, text=True, timeout=3).stdout
        return json.loads(out or "null")
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


class Watch:
    def __init__(self, script, path=None, run=None, seen=None, pid=None, ask=None):
        self.script = script
        self.path = path if path is not None else socket_path()
        self.run = run or self._run
        self.seen = seen                      # seen(bool): NeuroNet's window came into / went out of sight
        self.pid = pid or os.getpid()
        self.ask = ask or _hyprctl
        self.stopped = False
        self.shown = None
        self._timer = None
        self._lock = threading.Lock()

    def check(self):
        """Where is the window now? Tell seen() only when that changed."""
        with self._lock:
            self._timer = None
        if not self.seen:
            return
        now = on_screen(self.ask("clients"), self.ask("monitors"), self.pid)
        if now is None or now == self.shown:
            return
        self.shown = now
        try:
            self.seen(now)
        except Exception:
            pass

    def _soon(self):
        """A burst of events (a workspace switch sends several) -> one look, 150 ms later."""
        with self._lock:
            if self._timer is not None:
                return
            self._timer = threading.Timer(0.15, self.check)
            self._timer.daemon = True
            self._timer.start()

    def _run(self, addr):
        try:
            subprocess.Popen([self.script, "dock", addr], start_new_session=True,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError:
            pass

    def feed(self, data, rest=""):
        """Bytes off the socket (text so far in `rest`) -> what's left over."""
        text = rest + data
        *lines, rest = text.split("\n")
        sight = False
        for line in lines:
            addr = to_dock(line)
            if addr:
                self.run(addr)
            if self.seen and line.startswith(SIGHT):
                sight = True
        if sight:
            self._soon()
        return rest

    def loop(self):
        tries = 0
        while not self.stopped and tries < 5:
            try:
                with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
                    s.connect(self.path)
                    tries = 0
                    self._soon()                  # where it is to begin with
                    rest = ""
                    while not self.stopped:
                        chunk = s.recv(65536)
                        if not chunk:
                            break
                        rest = self.feed(chunk.decode("utf-8", "replace"), rest)
            except OSError:
                pass
            tries += 1
            time.sleep(2)

    def start(self):
        if not self.path:
            return False
        threading.Thread(target=self.loop, name="neuronet-quick-watch", daemon=True).start()
        return True
