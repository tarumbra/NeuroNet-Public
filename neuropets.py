#!/usr/bin/env python3
"""NeuroPets -- the game, in its own window.

Cam (2026-10-03): "NeuroPet will eventually migrate off the NeuroNet app and
become a fully standalone game that will have its own short cut to open the
same way we do for NeuroNet (If you think that is better to do now then do it
please)". Done with the Melvor-style overhaul: the game has its own sidebar of
skills, which only makes sense in a window of its own.

What it shares with NeuroNet, for now:
  * the data folder (neuronet_data/pet/pet.json, pet-dev.json -- pet.py), so
    nothing moves and Cam's game carries on;
  * the hardening of the Qt page (neuronet.lock_qt_navigation,
    fix_qt_permissions) -- the game is a local page like NeuroNet's.

THE RULES ARE NOT HERE: ui/pet/petcore.js. The page applies an action and hands the result to pet_save.

One copy only. A second `neuropets` brings the first forward (org.neuropets.App
Show), so two windows can never save over each other. (The desktop pet card
and its neuropets-call were removed 2026-10-15 -- Cam no longer used them.)

    neuropets [--gui qt] [--hidden] [--sandbox]
"""
import json
import subprocess
import os
import sys
import threading
import time

import lite               # Lite mode: lighter on a small computer or on battery
import neuronet as nn      # the data folder (pet.DATA_DIR_PROVIDER) and the Qt hardening
import pet

APP_NAME = "NeuroPets"
GUIDE_PDF = "NeuroPets - How to Play.pdf"      # ui/pet/guide/, made by tools/make_guide.js
BUS_NAME = "org.neuropets.App"
OBJECT_PATH = "/org/neuropets/App"

INTROSPECTION = """
<node>
  <interface name="org.neuropets.App">
    <method name="Show"/>
    <method name="Hide"/>
    <method name="State"><arg name="state" type="s" direction="out"/></method>
    <method name="Sandbox"/>
  </interface>
</node>
"""


# ---- quitting when tucked away (2026-10-06) ----------------------------------
# Cam: "lets do the change for Neuropets" -- tucked away, the game held ~1.3 GB
# all day for nothing: everything in it (trips, gathering, hatching, farms,
# battles) is worked out from the time that has passed when it opens
# (petcore.advance, up to 60 days). So once it has been out of sight for
# IDLE_QUIT seconds, it closes; Super+Alt+G starts it again. NEUROPETS_IDLE_QUIT=0 keeps it running.
IDLE_QUIT = int(os.environ.get("NEUROPETS_IDLE_QUIT", "600") or 0)
SPECIAL = "special:neuropets"


def _hypr(what):
    try:
        r = subprocess.run(["hyprctl", what, "-j"], capture_output=True, text=True, timeout=3)
        return json.loads(r.stdout) if r.returncode == 0 else None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def tucked_away():
    """True when the game is out of sight -- started hidden, or in its
    scratchpad while that isn't open; False when it's on a workspace or its
    scratchpad is showing; None when Hyprland can't say (then it never quits)."""
    clients = _hypr("clients")
    if not isinstance(clients, list):
        return None
    win = next((c for c in clients if c.get("class") == APP_NAME or c.get("initialClass") == APP_NAME), None)
    if win is None:
        return True                                   # hidden: not mapped at all
    if (win.get("workspace") or {}).get("name") != SPECIAL:
        return False
    monitors = _hypr("monitors")
    if not isinstance(monitors, list):
        return None
    return not any((m.get("specialWorkspace") or {}).get("name") == SPECIAL for m in monitors)


def should_quit(away_since, last_call, now, busy, idle=IDLE_QUIT):
    """Out of sight for `idle` seconds, nothing asked of it for as long, and
    nothing being answered right now."""
    return bool(idle > 0 and away_since is not None and not busy
                and now - away_since >= idle and now - last_call >= idle)


def watch_and_quit(bus, quit_game, every=60):
    """A daemon thread: looks once a minute, and closes the game when it should."""
    def run():
        away_since = None
        while True:
            time.sleep(every)
            away = tucked_away()
            if away is None and getattr(bus, "_shown", None) is not None:
                away = bus._shown.state() == "hidden"        # no Hyprland (KDE): the window's own state
            now = time.time()
            if away is None or not away:
                away_since = None
                continue
            away_since = away_since or now
            if should_quit(away_since, bus.last_call, now, False):
                quit_game()
                return
    if IDLE_QUIT > 0:
        threading.Thread(target=run, name="neuropets-idle", daemon=True).start()


def game_dir():
    return os.path.join(nn.ui_dir(), "pet")


def version():
    try:
        with open(os.path.join(nn.app_dir(), "VERSION"), encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


class Bus:
    """org.neuropets.App on the session bus, served from a daemon thread.
    Never raises: without a bus the game still runs (Super+Alt+G
    just can't bring it forward)."""

    def __init__(self, run_js, show, shown=None):
        self._run_js = run_js
        self._show = show
        self._shown = shown          # neuronet.ShownWindow: Hide/State (KDE and other desktops)
        self._lock = threading.RLock()
        self._ready = False
        self._pending = []
        self._started = threading.Event()
        self.error = None
        self.last_call = time.time()        # the last request over the bus (watch_and_quit)

    def start(self):
        threading.Thread(target=self._serve, name="neuropets-bus", daemon=True).start()
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
        args = params.unpack()
        self.last_call = time.time()
        if method == "Show":
            threading.Thread(target=self._show, daemon=True).start()
        elif method == "Hide" and self._shown:
            self._shown.hide()
        elif method == "State":
            from gi.repository import GLib
            invocation.return_value(GLib.Variant("(s)", (self._shown.state() if self._shown else "window",)))
            return
        elif method == "Sandbox":
            threading.Thread(target=self._show, daemon=True).start()
            self._queue_js("window.NP && NP.sandbox && NP.sandbox(true)")
        invocation.return_value(None)



class Api:
    """What the game's page may ask of Python. Nothing else is exposed."""

    def __init__(self):
        self._bus = None
        self._sandbox = False
        self._started = None      # the first hello of this run: is it the first start today?

    # the How to Play guide on Scribe's Ebooks shelf (2026-10-20, Cam: "also store as a pdf within the ebook section of scribe"):
    # the game asks when it hands you the book, and again when you read it -- added once, refreshed when a release brings a new one
    def guide_to_scribe(self):
        try:
            import ebooks
            src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui", "pet", "guide", GUIDE_PDF)
            return ebooks.Library(os.path.join(pet.DATA_DIR_PROVIDER(), "ebooks")).shelve(src)
        except Exception as e:      # (never break the game over the shelf)
            return {"error": f"Couldn't put the guide in Scribe: {e}"}

    def pet_load(self, slot="main"):
        return pet.load("dev" if slot == "dev" else "main")

    def pet_save(self, state, slot="main"):
        try:
            return pet.save(state, "dev" if slot == "dev" else "main")
        except OSError as e:
            return {"error": f"Couldn't save the game: {e}"}

    # the two sandboxes (2026-10-15): everything unlocked, or a plain account
    def pet_sandbox(self):
        return {"kind": pet.sandbox_kind(), "kinds": list(pet.SANDBOXES)}

    def pet_sandbox_use(self, kind):
        try:
            return pet.sandbox_use(str(kind or ""))
        except OSError as e:
            return {"error": f"Couldn't switch sandbox: {e}"}

    # save slots (2026-10-07): the real game only, never the sandbox
    def pet_slots(self):
        return pet.slots()

    def pet_switch(self, n):
        try:
            return pet.switch(n)
        except OSError as e:
            return {"error": f"Couldn't switch games: {e}"}

    def pet_newgame(self, n, state):
        try:
            return pet.new_game(n, state)
        except OSError as e:
            return {"error": f"Couldn't start the game: {e}"}

    def pet_clearslot(self, n):
        try:
            return pet.clear_slot(n)
        except OSError as e:
            return {"error": f"Couldn't clear the slot: {e}"}

    # mod packs (2026-10-07)
    def pet_mods(self):
        return pet.mods()

    def pet_mod_load(self, mod_id):
        return pet.mod_load(mod_id)

    def pet_mod_save(self, doc):
        try:
            return pet.mod_save(doc)
        except OSError as e:
            return {"error": f"Couldn't save the mod pack: {e}"}

    def pet_mod_delete(self, mod_id):
        return pet.mod_delete(mod_id)

    # the place editor (Developer -> Place editor, 2026-10-15): where each place is painted, written to art/places.js
    def places_save(self, doc):
        try:
            return pet.places_write(os.path.join(game_dir(), "art", "places.js"), doc)
        except ValueError as e:
            return {"error": str(e)}
        except OSError as e:
            return {"error": f"Couldn't save the places: {e}"}

    # NeuroNet's game assets (Creative -> Pixel art, saved as Game assets): pictures for a mod pack
    def pet_game_assets(self):
        try:
            import paper_assets
            got = paper_assets.Assets(nn.assets_dir()).list()
        except Exception:
            return []
        return [a for a in got.get("assets", []) if a.get("cat") == "game" and a.get("ext") in ("png", "webp", "gif", "jpg", "jpeg")]

    def pet_game_asset(self, asset_id):
        try:
            import paper_assets
            return paper_assets.Assets(nn.assets_dir()).data(asset_id)
        except Exception as e:
            return {"error": f"Couldn't read that asset: {e}"}

    def hello(self):
        """The page has loaded: what it needs to know, and the bus may talk to it now."""
        if self._bus:
            self._bus.page_ready()
        if self._started is None:   # once per run: the window being shown again isn't a new start
            try:
                self._started = pet.first_start_today(time.strftime("%Y-%m-%d"))
            except OSError:
                self._started = False
            first = self._started
        else:
            first = False
        return {"version": version(), "sandbox": self._sandbox, "firstToday": first}

    # the game's settings (2026-10-08): kept by pet.py, not the page (the window is private)
    def pet_settings(self):
        return pet.settings()

    def pet_settings_save(self, d):
        try:
            return pet.save_settings(d)
        except OSError as e:
            return {"error": f"Couldn't save the settings: {e}"}



def already_running():
    """True when another NeuroPets owns the bus name. NEUROPETS_ALLOW_SECOND=1 skips it (tests)."""
    if os.environ.get("NEUROPETS_ALLOW_SECOND"):
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


def poke(method):
    """Ask the running copy to Show (or open its Sandbox)."""
    try:
        import gi
        gi.require_version("Gio", "2.0")
        from gi.repository import Gio
        conn = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        conn.call_sync(BUS_NAME, OBJECT_PATH, BUS_NAME, method, None, None, Gio.DBusCallFlags.NONE, 5000, None)
    except Exception as e:
        sys.stderr.write(f"NeuroPets: couldn't reach the open game: {e}\n")


def main():
    argv = sys.argv[1:]
    hidden = "--hidden" in argv
    sandbox = "--sandbox" in argv
    gui = None
    for i, arg in enumerate(argv):
        if arg == "--gui" and i + 1 < len(argv):
            gui = argv[i + 1]
        elif arg.startswith("--gui="):
            gui = arg.split("=", 1)[1]

    if already_running():
        if not hidden:
            poke("Sandbox" if sandbox else "Show")
        return

    nn.prefer_integrated_gpu()
    lite.apply_flags()         # Lite mode (lite.py): reduced motion asked for before Qt WebEngine starts
    try:
        import webview
    except ImportError:
        nn.fatal("NeuroPets needs pywebview.\n\n    pip install pywebview\n")
    index = os.path.join(game_dir(), "index.html")
    if not os.path.isfile(index):
        nn.fatal(f"NeuroPets can't find its game. Expected:\n  {index}")

    api = Api()
    api._sandbox = sandbox
    window = webview.create_window(APP_NAME, index, js_api=api, width=1360, height=880,
                                   min_size=(980, 640), hidden=hidden, background_color="#1b1e27")
    lite.attach(window)        # and its stylesheet put in as the page loads

    # shown and hidden by the game itself where there's no Hyprland scratchpad (KDE)
    shown = nn.ShownWindow(window, hidden)

    def show():
        shown.show("window")

    api._bus = Bus(window.evaluate_js, show, shown)
    if not api._bus.start():
        sys.stderr.write(f"NeuroPets: not on the session bus (Super+Alt+G can't bring it forward): {api._bus.error}\n")

    def quit_game():
        sys.stderr.write("NeuroPets: tucked away for a while -- closing (it catches up when it opens)\n")
        try:
            window.destroy()
        except Exception:
            os._exit(0)
    watch_and_quit(api._bus, quit_game)

    if gui == "qt":
        nn.fix_qt_permissions()
        nn.lock_qt_navigation(game_dir())
        try:
            from PyQt6.QtGui import QGuiApplication
            QGuiApplication.setDesktopFileName(os.environ.get("NEURONET_APP_ID") or "NeuroPets")  # a test copy's other name (cachyos-docker.sh --show)
        except Exception:
            pass
    try:
        from gi.repository import GLib
        GLib.set_prgname(os.environ.get("NEURONET_APP_ID") or "NeuroPets")
    except Exception:
        pass
    webview.start(gui=gui) if gui else webview.start()


if __name__ == "__main__":
    main()
