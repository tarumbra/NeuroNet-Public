"""NeuroNet on the Linux media bus (MPRIS).

Cam: "is it possible to make companion style omarchy plugins, like a top
bar music player for NeuroNet? That uses the music library file from
neuronet?" -- and then: "yes build option 1 with a bar widget".

Option 1 was: NeuroNet ANNOUNCES ITSELF as a music player, the standard
Linux way, rather than a second player living in the bar. So this file is
the announcement. It puts NeuroNet on the session D-Bus as
org.mpris.MediaPlayer2.neuronet, and from then on:

  - Omarchy's own audio panel and track popups show NeuroNet's songs;
  - the keyboard's media keys (playerctl) drive it;
  - the NeuroNet bar widget (~/.config/omarchy/plugins/neuronet.music)
    reads it like any other player, and starts playlists and albums
    through OpenUri("neuronet:album/<id>").

THERE IS STILL ONE PLAYER. Nothing here plays audio. Every command goes
back into the page and through CH.Player -- the same functions the app's
own buttons call -- so play counts, the queue, shuffle and repeat can't
drift between the bar and the app.

THE THREADING. The bus is served from its own thread with its own GLib
main context. Not the default context: under --gui qt, Qt iterates the
default GLib context on the UI thread, and a D-Bus call answered there
that then calls window.evaluate_js (which waits for the UI thread) would
wait on itself. And evaluate_js is itself run on a short-lived thread,
so a slow page never holds up the bus.

The page tells us what is playing (Api.music_mpris_update); until it has
said so once, commands wait in a queue -- the bar widget can launch
NeuroNet and ask for an album before the page has finished loading.
"""

import hashlib
import json
import os
import threading
import time
import urllib.parse

BUS_NAME = "org.mpris.MediaPlayer2.neuronet"
OBJECT_PATH = "/org/mpris/MediaPlayer2"
ROOT_IFACE = "org.mpris.MediaPlayer2"
PLAYER_IFACE = "org.mpris.MediaPlayer2.Player"
NO_TRACK = "/org/mpris/MediaPlayer2/TrackList/NoTrack"

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

INTROSPECTION = """
<node>
  <interface name="org.mpris.MediaPlayer2">
    <method name="Raise"/>
    <method name="Quit"/>
    <property name="CanQuit" type="b" access="read"/>
    <property name="CanRaise" type="b" access="read"/>
    <property name="HasTrackList" type="b" access="read"/>
    <property name="Identity" type="s" access="read"/>
    <property name="DesktopEntry" type="s" access="read"/>
    <property name="SupportedUriSchemes" type="as" access="read"/>
    <property name="SupportedMimeTypes" type="as" access="read"/>
  </interface>
  <interface name="org.mpris.MediaPlayer2.Player">
    <method name="Next"/>
    <method name="Previous"/>
    <method name="Pause"/>
    <method name="PlayPause"/>
    <method name="Stop"/>
    <method name="Play"/>
    <method name="Seek"><arg name="Offset" type="x" direction="in"/></method>
    <method name="SetPosition">
      <arg name="TrackId" type="o" direction="in"/>
      <arg name="Position" type="x" direction="in"/>
    </method>
    <method name="OpenUri"><arg name="Uri" type="s" direction="in"/></method>
    <signal name="Seeked"><arg name="Position" type="x"/></signal>
    <property name="PlaybackStatus" type="s" access="read"/>
    <property name="LoopStatus" type="s" access="readwrite"/>
    <property name="Rate" type="d" access="readwrite"/>
    <property name="Shuffle" type="b" access="readwrite"/>
    <property name="Metadata" type="a{sv}" access="read"/>
    <property name="Volume" type="d" access="readwrite"/>
    <property name="Position" type="x" access="read"/>
    <property name="MinimumRate" type="d" access="read"/>
    <property name="MaximumRate" type="d" access="read"/>
    <property name="CanGoNext" type="b" access="read"/>
    <property name="CanGoPrevious" type="b" access="read"/>
    <property name="CanPlay" type="b" access="read"/>
    <property name="CanPause" type="b" access="read"/>
    <property name="CanSeek" type="b" access="read"/>
    <property name="CanControl" type="b" access="read"/>
  </interface>
</node>
"""

# NeuroNet's repeat modes <-> MPRIS LoopStatus.
LOOP_OF = {"off": "None", "one": "Track", "all": "Playlist"}
REPEAT_OF = {v: k for k, v in LOOP_OF.items()}


def track_id(file_name):
    """A D-Bus object path for a track. Paths allow only [A-Za-z0-9_], so
    the file name is hashed rather than escaped."""
    if not file_name:
        return NO_TRACK
    return "/org/neuronet/track/t" + hashlib.sha1(
        file_name.encode("utf-8")).hexdigest()[:16]


def art_url(images_dir, name):
    """file:// URL of a stored cover, or "" if there isn't one on disk.
    Only a bare file name is accepted -- the name comes from the page."""
    if not name or not images_dir:
        return ""
    base = os.path.basename(str(name))
    if base != name:
        return ""
    path = os.path.join(images_dir, base)
    if not os.path.isfile(path):
        return ""
    return "file://" + urllib.parse.quote(path)


def parse_open_uri(uri):
    """neuronet:album/<id> or neuronet:playlist/<id> -> (kind, id), or None."""
    if not isinstance(uri, str) or not uri.startswith("neuronet:"):
        return None
    rest = uri[len("neuronet:"):].lstrip("/")
    kind, _, ident = rest.partition("/")
    ident = urllib.parse.unquote(ident)
    if kind not in ("album", "playlist") or not ident:
        return None
    return kind, ident


def normalize_state(raw):
    """What the page sent, reduced to what MPRIS needs, with safe types."""
    raw = raw if isinstance(raw, dict) else {}

    def num(k):
        try:
            v = float(raw.get(k) or 0)
        except (TypeError, ValueError):
            return 0.0
        return v if v == v and v >= 0 else 0.0     # drop NaN / negatives

    status = raw.get("status")
    if status not in ("Playing", "Paused", "Stopped"):
        status = "Stopped"
    repeat = raw.get("repeat") if raw.get("repeat") in LOOP_OF else "off"
    return {
        "status": status,
        "file": str(raw.get("file") or ""),
        "title": str(raw.get("title") or ""),
        "artist": str(raw.get("artist") or ""),
        "album": str(raw.get("album") or ""),
        "art": str(raw.get("art") or ""),
        "length": num("length"),
        "position": num("position"),
        "volume": min(1.0, num("volume")) if "volume" in raw else 1.0,
        "shuffle": bool(raw.get("shuffle")),
        "repeat": repeat,
        "seeked": bool(raw.get("seeked")),
        # the song is a favourite (chords.js setFavourite) -- on the bus as
        # xesam:userRating, so the desktop and bar music widgets show the ♥
        "favourite": bool(raw.get("favourite")),
    }


class Mpris:
    """The bus side. `run_js(code)` evaluates JavaScript in the page;
    `raise_window()` brings NeuroNet to the front; `images_dir()` is where
    album art is stored."""

    def __init__(self, run_js, raise_window=None, images_dir=None, shown=None):
        self._run_js = run_js
        self._raise = raise_window
        self._shown = shown          # neuronet.ShownWindow: Show/Hide/State (KDE and other desktops)
        self._images_dir = images_dir
        self._lock = threading.RLock()
        self._state = normalize_state({})
        self._stamp = time.monotonic()     # when position was last reported
        self._ready = False                # has the page reported yet?
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
        t = threading.Thread(target=self._serve, name="neuronet-mpris",
                             daemon=True)
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
            info = Gio.DBusNodeInfo.new_for_xml(INTROSPECTION)
            for iface in info.interfaces:
                conn.register_object(OBJECT_PATH, iface, self._on_call,
                                     self._on_get, self._on_set)
            app = Gio.DBusNodeInfo.new_for_xml(APP_INTROSPECTION)
            conn.register_object(APP_PATH, app.interfaces[0], self._on_app_call,
                                 None, None)
            self._conn = conn
            Gio.bus_own_name_on_connection(
                conn, BUS_NAME, Gio.BusNameOwnerFlags.DO_NOT_QUEUE, None, None)
            Gio.bus_own_name_on_connection(
                conn, APP_NAME, Gio.BusNameOwnerFlags.DO_NOT_QUEUE, None, None)
            loop = GLib.MainLoop.new(self._ctx, False)
        except Exception as e:           # no gi, no bus, ...
            self.error = str(e)
            self._started.set()
            return
        self._started.set()
        loop.run()

    # -- page -> bus ----------------------------------------------------
    def update(self, raw):
        """The page's report of what is playing. Emits PropertiesChanged
        for whatever differs, and Seeked when the page says it jumped."""
        new = normalize_state(raw)
        with self._lock:
            old = self._state
            self._state = new
            self._stamp = time.monotonic()
            first = not self._ready
            self._ready = True
            pending, self._pending = self._pending, []
        for code in pending:
            self._eval(code)

        changed = {}
        if first or new["status"] != old["status"]:
            changed["PlaybackStatus"] = new["status"]
        if first or any(new[k] != old[k] for k in
                        ("file", "title", "artist", "album", "art", "length", "favourite")):
            changed["Metadata"] = None
            changed["CanSeek"] = None
        if first or new["shuffle"] != old["shuffle"]:
            changed["Shuffle"] = None
        if first or new["repeat"] != old["repeat"]:
            changed["LoopStatus"] = None
        if first or abs(new["volume"] - old["volume"]) > 1e-4:
            changed["Volume"] = None
        if changed:
            self._emit_changed(list(changed))
        if new["seeked"]:
            self._emit("Seeked", "(x)", (int(new["position"] * 1e6),))

    def _emit_changed(self, names):
        GLib = getattr(self, "_GLib", None)
        if not self._conn or GLib is None:
            return
        props = {n: self._value(n) for n in names}
        props = {k: v for k, v in props.items() if v is not None}
        self._emit_raw("org.freedesktop.DBus.Properties", "PropertiesChanged",
                       GLib.Variant("(sa{sv}as)", (PLAYER_IFACE, props, [])))

    def _emit(self, name, sig, args):
        GLib = getattr(self, "_GLib", None)
        if not self._conn or GLib is None:
            return
        self._emit_raw(PLAYER_IFACE, name, GLib.Variant(sig, args))

    def _emit_raw(self, iface, name, variant):
        try:
            self._conn.emit_signal(None, OBJECT_PATH, iface, name, variant)
        except Exception:
            pass

    # -- bus -> page ----------------------------------------------------
    def _command(self, cmd, arg=None):
        code = ("window.SS && SS.Music && SS.Music.remote && "
                f"SS.Music.remote({json.dumps(cmd)}, {json.dumps(arg)})")
        self._queue_js(code)

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

    def position(self):
        """Seconds into the track now -- extrapolated while playing, since
        the page reports on changes, not every tick."""
        with self._lock:
            s, stamp = self._state, self._stamp
        pos = s["position"]
        if s["status"] == "Playing":
            pos += time.monotonic() - stamp
        if s["length"]:
            pos = min(pos, s["length"])
        return pos

    def _value(self, name):
        from gi.repository import GLib
        V = GLib.Variant
        s = self._state
        if name == "PlaybackStatus":
            return V("s", s["status"])
        if name == "LoopStatus":
            return V("s", LOOP_OF[s["repeat"]])
        if name == "Shuffle":
            return V("b", s["shuffle"])
        if name == "Volume":
            return V("d", s["volume"])
        if name == "Position":
            return V("x", int(self.position() * 1e6))
        if name in ("Rate", "MinimumRate", "MaximumRate"):
            return V("d", 1.0)
        if name == "CanSeek":
            return V("b", bool(s["file"] and s["length"] > 0))
        if name in ("CanGoNext", "CanGoPrevious", "CanPlay", "CanPause",
                    "CanControl"):
            return V("b", True)
        if name == "Metadata":
            md = {"mpris:trackid": V("o", track_id(s["file"]))}
            if s["file"]:
                md["xesam:title"] = V("s", s["title"] or s["file"])
                if s["artist"]:
                    md["xesam:artist"] = V("as", [s["artist"]])
                if s["album"]:
                    md["xesam:album"] = V("s", s["album"])
                if s["length"]:
                    md["mpris:length"] = V("x", int(s["length"] * 1e6))
                md["xesam:userRating"] = V("d", 1.0 if s.get("favourite") else 0.0)
                images = self._images_dir() if callable(self._images_dir) \
                    else self._images_dir
                url = art_url(images, s["art"])
                if url:
                    md["mpris:artUrl"] = V("s", url)
            return V("a{sv}", md)
        # org.mpris.MediaPlayer2
        if name in ("CanQuit", "HasTrackList"):
            return V("b", False)
        if name == "CanRaise":
            return V("b", self._raise is not None)
        if name == "Identity":
            return V("s", "NeuroNet")
        if name == "DesktopEntry":
            return V("s", "NeuroNet")
        if name == "SupportedUriSchemes":
            return V("as", ["neuronet"])
        if name == "SupportedMimeTypes":
            return V("as", [])
        return None

    def _on_get(self, conn, sender, path, iface, name):
        with self._lock:
            return self._value(name)

    def _on_set(self, conn, sender, path, iface, name, value):
        v = value.unpack()
        if name == "Shuffle":
            self._command("shuffle", bool(v))
        elif name == "LoopStatus" and v in REPEAT_OF:
            self._command("repeat", REPEAT_OF[v])
        elif name == "Volume":
            self._command("volume", max(0.0, min(1.0, float(v))))
        return True

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

    def _on_call(self, conn, sender, path, iface, method, params, invocation):
        args = params.unpack()
        simple = {"Next": "next", "Previous": "prev", "Pause": "pause",
                  "PlayPause": "playpause", "Stop": "stop", "Play": "play"}
        if method in simple:
            self._command(simple[method])
        elif method == "Seek":
            self._command("seekTo", max(0.0, self.position() + args[0] / 1e6))
        elif method == "SetPosition":
            with self._lock:
                current = track_id(self._state["file"])
            if args[0] == current:
                self._command("seekTo", max(0.0, args[1] / 1e6))
        elif method == "OpenUri":
            target = parse_open_uri(args[0])
            if target is None:
                invocation.return_dbus_error(
                    "org.mpris.MediaPlayer2.NeuroNet.BadUri",
                    "NeuroNet opens neuronet:album/<id> and neuronet:playlist/<id>")
                return
            self._command("open", {"kind": target[0], "id": target[1]})
        elif method == "Raise" and self._raise:
            threading.Thread(target=self._raise, daemon=True).start()
        invocation.return_value(None)
