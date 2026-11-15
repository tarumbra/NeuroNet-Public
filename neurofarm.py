#!/usr/bin/env python3
"""NeuroFarm -- the farming game, in its own window.

Cam (2026-10-07): "Now a new game NeuroFarm (A farmville, simfarm game, simple
with crops ...)". Built like NeuroPets (neuropets.py): a pywebview window on a
local page, one copy only (a second `neurofarm` brings the first forward over
the session bus, so two windows never save over each other), and the data in
NeuroNet's data folder (neuronet_data/farm/farm.json -- farm.py).

THE RULES ARE NOT HERE: ui/farm/farmcore.js. The page applies an action and
hands the result to farm_save. The page is ui/neurofarm.html -- at the top of
ui/ so it can use NeuroPets' pictures (ui/pet/petart.js) as well as its own.

Out of sight for 10 minutes, it closes (the desktop card and neurofarm-call
were removed 2026-10-15) (as NeuroPets does) -- the farm grows by the clock either way.

    neurofarm [--gui qt] [--hidden]
"""
import json
import os
import subprocess
import sys
import threading
import time

import neuronet as nn      # the data folder (farm.DATA_DIR_PROVIDER) and the Qt hardening
import farm

APP_NAME = "NeuroFarm"
BUS_NAME = "org.neurofarm.App"
OBJECT_PATH = "/org/neurofarm/App"
INTROSPECTION = """
<node>
  <interface name="org.neurofarm.App">
    <method name="Show"/>
    <method name="Hide"/>
    <method name="State"><arg name="state" type="s" direction="out"/></method>
  </interface>
</node>
"""

IDLE_QUIT = int(os.environ.get("NEUROFARM_IDLE_QUIT", "600") or 0)
SPECIAL = "special:neurofarm"

farm.DATA_DIR_PROVIDER = lambda: nn.data_dir()


# ---- quitting when tucked away (as neuropets.py) ----------------------------------------------
def _hypr(what):
    try:
        r = subprocess.run(["hyprctl", what, "-j"], capture_output=True, text=True, timeout=3)
        return json.loads(r.stdout) if r.returncode == 0 else None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def tucked_away():
    """True out of sight (hidden, or in its scratchpad while that's closed); None when Hyprland can't say."""
    clients = _hypr("clients")
    if not isinstance(clients, list):
        return None
    win = next((c for c in clients if c.get("class") == APP_NAME or c.get("initialClass") == APP_NAME), None)
    if win is None:
        return True
    if (win.get("workspace") or {}).get("name") != SPECIAL:
        return False
    monitors = _hypr("monitors")
    if not isinstance(monitors, list):
        return None
    return not any((m.get("specialWorkspace") or {}).get("name") == SPECIAL for m in monitors)


def should_quit(away_since, last_call, now, busy, idle=IDLE_QUIT):
    return bool(idle > 0 and away_since is not None and not busy
                and now - away_since >= idle and now - last_call >= idle)


def watch_and_quit(bus, quit_game, every=60):
    def run():
        away_since = None
        while True:
            time.sleep(every)
            away = tucked_away()
            if away is None and getattr(bus, "_shown", None) is not None:
                away = bus._shown.state() == "hidden"        # no Hyprland (KDE): the window's own state
            now = time.time()
            if not away:
                away_since = None
                continue
            away_since = away_since or now
            if should_quit(away_since, bus.last_call, now, False):
                quit_game()
                return
    if IDLE_QUIT > 0:
        threading.Thread(target=run, name="neurofarm-idle", daemon=True).start()


def page_dir():
    return nn.ui_dir()


def version():
    try:
        with open(os.path.join(nn.app_dir(), "VERSION"), encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


class Bus:
    """org.neurofarm.App on the session bus (Show, Do). Never raises: without a bus the game still runs."""

    def __init__(self, run_js, show, shown=None):
        self._run_js = run_js
        self._show = show
        self._shown = shown          # neuronet.ShownWindow: Hide/State (KDE and other desktops)
        self._lock = threading.RLock()
        self._ready = False
        self._pending = []
        self._started = threading.Event()
        self.error = None
        self.last_call = time.time()

    def start(self):
        threading.Thread(target=self._serve, name="neurofarm-bus", daemon=True).start()
        self._started.wait(5)
        return self.error is None

    def _serve(self):
        try:
            import gi
            gi.require_version("Gio", "2.0")
            from gi.repository import Gio, GLib
            ctx = GLib.MainContext.new()
            ctx.push_thread_default()
            conn = Gio.bus_get_sync(Gio.BusType.SESSION, None)
            info = Gio.DBusNodeInfo.new_for_xml(INTROSPECTION)
            conn.register_object(OBJECT_PATH, info.interfaces[0], self._on_call, None, None)
            Gio.bus_own_name_on_connection(conn, BUS_NAME, Gio.BusNameOwnerFlags.DO_NOT_QUEUE, None, None)
            loop = GLib.MainLoop.new(ctx, False)
        except Exception as e:
            self.error = str(e)
            self._started.set()
            return
        self._started.set()
        loop.run()

    def page_ready(self):
        with self._lock:
            self._ready = True
            pending, self._pending = self._pending, []
        for code in pending:
            self._eval(code)

    def _queue_js(self, code):
        with self._lock:
            if not self._ready:
                self._pending = (self._pending + [code])[-8:]
                return
        self._eval(code)

    def _eval(self, code):
        def go():
            try:
                self._run_js(code)
            except Exception:
                pass
        threading.Thread(target=go, daemon=True).start()

    def _on_call(self, conn, sender, path, iface, method, params, invocation):
        self.last_call = time.time()
        if method == "Show":
            threading.Thread(target=self._show, daemon=True).start()
        elif method == "Hide" and self._shown:
            self._shown.hide()
        elif method == "State":
            from gi.repository import GLib
            invocation.return_value(GLib.Variant("(s)", (self._shown.state() if self._shown else "window",)))
            return
        invocation.return_value(None)



class Api:
    """What the game's page may ask of Python. Nothing else is exposed."""

    def __init__(self):
        self._bus = None

    def farm_load(self):
        return farm.load()

    def farm_save(self, state):
        try:
            return farm.save(state)
        except OSError as e:
            return {"error": f"Couldn't save the farm: {e}"}

    def hello(self):
        """The page has loaded: the bus may talk to it now."""
        if self._bus:
            self._bus.page_ready()
        return {"version": version()}



def already_running():
    """True when another NeuroFarm owns the bus name. NEUROFARM_ALLOW_SECOND=1 skips it (tests)."""
    if os.environ.get("NEUROFARM_ALLOW_SECOND"):
        return False
    try:
        import gi
        gi.require_version("Gio", "2.0")
        from gi.repository import Gio, GLib
        conn = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        r = conn.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
                           "NameHasOwner", GLib.Variant("(s)", (BUS_NAME,)), None,
                           Gio.DBusCallFlags.NONE, 2000, None)
        return bool(r.unpack()[0])
    except Exception:
        return False


def poke():
    try:
        import gi
        gi.require_version("Gio", "2.0")
        from gi.repository import Gio
        conn = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        conn.call_sync(BUS_NAME, OBJECT_PATH, BUS_NAME, "Show", None, None, Gio.DBusCallFlags.NONE, 5000, None)
    except Exception as e:
        sys.stderr.write(f"NeuroFarm: couldn't reach the open game: {e}\n")


def main():
    argv = sys.argv[1:]
    hidden = "--hidden" in argv
    gui = None
    for i, arg in enumerate(argv):
        if arg == "--gui" and i + 1 < len(argv):
            gui = argv[i + 1]
        elif arg.startswith("--gui="):
            gui = arg.split("=", 1)[1]
    if already_running():
        if not hidden:
            poke()
        return
    nn.prefer_integrated_gpu()
    try:
        import webview
    except ImportError:
        nn.fatal("NeuroFarm needs pywebview.\n\n    pip install pywebview\n")
    index = os.path.join(page_dir(), "neurofarm.html")
    if not os.path.isfile(index):
        nn.fatal(f"NeuroFarm can't find its game. Expected:\n  {index}")
    api = Api()
    window = webview.create_window(APP_NAME, index, js_api=api, width=1360, height=880,
                                   min_size=(980, 640), hidden=hidden, background_color="#1e2a1a")

    # shown and hidden by the game itself where there's no Hyprland scratchpad (KDE)
    shown = nn.ShownWindow(window, hidden)

    def show():
        shown.show("window")
    api._bus = Bus(window.evaluate_js, show, shown)
    if not api._bus.start():
        sys.stderr.write(f"NeuroFarm: not on the session bus (its shortcut can't bring it forward): {api._bus.error}\n")

    def quit_game():
        sys.stderr.write("NeuroFarm: tucked away for a while -- closing (the farm grows by the clock)\n")
        try:
            window.destroy()
        except Exception:
            os._exit(0)
    watch_and_quit(api._bus, quit_game)
    if gui == "qt":
        nn.fix_qt_permissions()
        nn.lock_qt_navigation(page_dir())
        try:
            from PyQt6.QtGui import QGuiApplication
            QGuiApplication.setDesktopFileName(os.environ.get("NEURONET_APP_ID") or "NeuroFarm")  # a test copy's other name (cachyos-docker.sh --show)
        except Exception:
            pass
    try:
        from gi.repository import GLib
        GLib.set_prgname(os.environ.get("NEURONET_APP_ID") or "NeuroFarm")
    except Exception:
        pass
    webview.start(gui=gui) if gui else webview.start()


if __name__ == "__main__":
    main()
