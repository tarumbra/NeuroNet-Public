"""NeuroNet's remote control on the session bus (org.neuronet.App).

It used to be NeuroNet on the Linux media bus too (MPRIS, org.mpris.MediaPlayer2.neuronet: the music player
in the bar, the media keys). The music moved to NeuroStream on 19 Nov 2026 (V31, Cam: "remove them from
Neuronet completely"), and NeuroStream is the player on the bus now (org.mpris.MediaPlayer2.neurostream).
What stays is NeuroNet's own remote: neuronet-quick opens a section in the popup (Quick, Compact), bar
widgets ask the page to do something (Do, answered through Api.board_done -> finish), and Show / Hide /
State / Raise move the window.

THE THREADING. The bus is served from its own thread with its own GLib main context. Not the default
context: under --gui qt, Qt iterates the default GLib context on the UI thread, and a D-Bus call answered
there that then calls window.evaluate_js (which waits for the UI thread) would wait on itself. And
evaluate_js is itself run on a short-lived thread, so a slow page never holds up the bus.

The page says when it's ready (Api.app_bus_ready, from app.js); until then commands wait in a short queue,
so neuronet-quick can start NeuroNet and ask for a section before the page has finished loading.
"""

import json
import os
import threading

# NeuroNet's own remote control, on the same connection (quick access).
# Cam: "a plugin that can load my tools in Neuronet and make them appear as
# a popup that i can do some quick work or viewing, rather then having to
# open the whole app all the time." neuronet-quick (the script beside
# neuronet.py) moves the window; this tells the page what to show.
APP_NAME = "org.neuronet.App"
APP_PATH = "/org/neuronet/App"
APP_IFACE = "org.neuronet.App"
APP_INTROSPECTION = """
<node>
  <interface name="org.neuronet.App">
    <method name="Quick">
      <arg name="section" type="s" direction="in"/>
      <arg name="compact" type="b" direction="in"/>
    </method>
    <method name="Compact"><arg name="on" type="b" direction="in"/></method>
    <method name="Raise"/>
    <method name="Show"><arg name="mode" type="s" direction="in"/></method>
    <method name="Hide"/>
    <method name="State"><arg name="state" type="s" direction="out"/></method>
    <method name="Do">
      <arg name="action" type="s" direction="in"/>
      <arg name="payload" type="s" direction="in"/>
      <arg name="result" type="s" direction="out"/>
    </method>
  </interface>
</node>
"""

# How long a desktop widget's request may wait for the page (it may still be
# starting up) before it is answered with an error.
DO_TIMEOUT = 45


class Mpris:
    """The bus side (the name is kept from when it was also the music player). `run_js(code)` evaluates
    JavaScript in the page; `raise_window()` brings NeuroNet to the front; `shown` is neuronet.ShownWindow."""

    def __init__(self, run_js, raise_window=None, shown=None):
        self._run_js = run_js
        self._raise = raise_window
        self._shown = shown
        self._lock = threading.RLock()
        self._ready = False                # has the page said it's ready?
        self._pending = []                 # commands waiting for the page
        self._calls = {}                   # Do() requests waiting for the page's answer
        self._conn = None
        self._ctx = None
        self._started = threading.Event()
        self.error = None

    # -- life cycle -----------------------------------------------------
    def start(self):
        """Serve the bus from a daemon thread. Never raises: a desktop
        without a session bus still gets a working NeuroNet."""
        t = threading.Thread(target=self._serve, name="neuronet-bus", daemon=True)
        t.start()
        self._started.wait(5)
        return self.error is None

    def _serve(self):
        try:
            import gi
            gi.require_version("Gio", "2.0")
            from gi.repository import Gio, GLib
            self._GLib = GLib
            self._ctx = GLib.MainContext.new()
            self._ctx.push_thread_default()
            conn = Gio.bus_get_sync(Gio.BusType.SESSION, None)
            app = Gio.DBusNodeInfo.new_for_xml(APP_INTROSPECTION)
            conn.register_object(APP_PATH, app.interfaces[0], self._on_app_call, None, None)
            self._conn = conn
            Gio.bus_own_name_on_connection(conn, APP_NAME, Gio.BusNameOwnerFlags.DO_NOT_QUEUE, None, None)
            loop = GLib.MainLoop.new(self._ctx, False)
        except Exception as e:           # no gi, no bus, ...
            self.error = str(e)
            self._started.set()
            return
        self._started.set()
        loop.run()

    def ready(self):
        """The page is up: run what was waiting for it."""
        with self._lock:
            self._ready = True
            pending, self._pending = self._pending, []
        for code in pending:
            self._eval(code)

    def _queue_js(self, code):
        with self._lock:
            if not self._ready:
                # Keep the last few; a burst from before the page loaded
                # should not replay as a burst.
                self._pending = (self._pending + [code])[-4:]
                return
        self._eval(code)

    def _eval(self, code):
        def go():
            try:
                self._run_js(code)
            except Exception:
                pass
        threading.Thread(target=go, daemon=True).start()

    def _on_app_call(self, conn, sender, path, iface, method, params, invocation):
        args = params.unpack()
        if method == "Quick":
            section, compact = str(args[0] or ""), bool(args[1])
            self._queue_js("window.SS && SS.quickMode && SS.quickMode("
                           f"{json.dumps(section)}, {json.dumps(compact)})")
        elif method == "Compact":
            self._queue_js("window.SS && SS.quickMode && SS.quickMode(\"\", "
                           f"{json.dumps(bool(args[0]))})")
        elif method == "Do":
            # Bar widgets (neuronet-call): the page does the work -- the
            # same code its own dashboard uses -- and answers through
            # Api.board_done -> finish(). NeuroNet saves; the widget never
            # writes NeuroNet's files itself. Answered later, not here.
            action, payload = str(args[0] or ""), str(args[1] or "{}")
            token = "d" + os.urandom(8).hex()
            t = threading.Timer(DO_TIMEOUT, self.finish, (token, json.dumps(
                {"error": "NeuroNet didn't answer. Is it still starting?"})))
            t.daemon = True
            with self._lock:
                self._calls[token] = (invocation, t)   # (the timer goes when the answer comes -- the audit, 3 Nov 2026)
            t.start()
            self._queue_js("window.SS && SS.boardDo && SS.boardDo("
                           f"{json.dumps(token)}, {json.dumps(action)}, {json.dumps(payload)})")
            return
        elif method == "Raise" and self._raise:
            threading.Thread(target=self._raise, daemon=True).start()
        elif method == "State":
            from gi.repository import GLib
            invocation.return_value(GLib.Variant("(s)", (self._shown.state() if self._shown else "window",)))
            return
        elif method == "Show" and self._shown:
            # answered once it's done, so the caller can raise it straight after
            self._shown.show(str(args[0] or "window"))
        elif method == "Hide" and self._shown:
            self._shown.hide()
        invocation.return_value(None)

    def finish(self, token, result):
        """The page's answer to a Do() request (or the timeout's)."""
        with self._lock:
            entry = self._calls.pop(str(token), None)
        if entry is None:
            return False
        invocation, timer = entry if isinstance(entry, tuple) else (entry, None)
        if timer is not None and timer is not threading.current_thread():
            timer.cancel()          # (a request answered no longer keeps a sleeping thread for 45 s: the audit, 3 Nov 2026)
        from gi.repository import GLib
        try:
            invocation.return_value(GLib.Variant("(s)", (str(result),)))
        except Exception:
            return False
        return True
