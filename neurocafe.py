#!/usr/bin/env python3
"""NeuroCafe -- the cafe game, in its own window.

Cam (2026-10-20, V19 -- the Stage 1 demo): "a cafeland style clone game", its
own app like NeuroCafe, on Super+Alt+J. Built like neurocafe.py: a pywebview
window on a local page, one copy only (a second `neurocafe` brings the first
forward over the session bus), and the data in NeuroNet's data folder
(neuronet_data/cafe/cafe.json -- cafe.py).

THE RULES ARE NOT HERE: ui/cafe/cafecore.js. The page applies an action and
hands the result to cafe_save. The page is ui/neurocafe.html.

Out of sight for 10 minutes, it closes -- dishes cook and customers come by the
clock either way.

    neurocafe [--gui qt] [--hidden]
"""
import json
import math
import os
import subprocess
import sys
import threading
import time

import neuronet as nn      # the data folder (cafe.DATA_DIR_PROVIDER) and the Qt hardening
import cafe

APP_NAME = "NeuroCafe"
BUS_NAME = "org.neurocafe.App"
OBJECT_PATH = "/org/neurocafe/App"
INTROSPECTION = """
<node>
  <interface name="org.neurocafe.App">
    <method name="Show"/>
    <method name="Hide"/>
    <method name="State"><arg name="state" type="s" direction="out"/></method>
  </interface>
</node>
"""

IDLE_QUIT = int(os.environ.get("NEUROCAFE_IDLE_QUIT", "600") or 0)
SPECIAL = "special:neurocafe"

cafe.DATA_DIR_PROVIDER = lambda: nn.data_dir()


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


def watch_and_quit(bus, quit_game, every=10):
    """Every few seconds: out of sight? The page is told (it stops drawing -- a window tucked in its scratchpad isn't
    "hidden" to the page, so it went on animating for nobody: 2026-10-25 performance pass), and after IDLE_QUIT seconds
    away with no calls the game closes."""
    def run():
        away_since, told = None, None
        while True:
            time.sleep(every)
            away = tucked_away()
            if away is None and getattr(bus, "_shown", None) is not None:
                away = bus._shown.state() == "hidden"        # no Hyprland (KDE): the window's own state
            if away is not None and bool(away) != told and hasattr(bus, "_queue_js"):
                told = bool(away)
                bus._queue_js(f"window.NCAway && window.NCAway({'true' if told else 'false'})")
            now = time.time()
            if not away:
                away_since = None
                continue
            away_since = away_since or now
            if should_quit(away_since, bus.last_call, now, False):
                quit_game()
                return
    threading.Thread(target=run, name="neurocafe-idle", daemon=True).start()


def page_dir():
    return nn.ui_dir()


def version():
    try:
        with open(os.path.join(nn.app_dir(), "VERSION"), encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


class Bus:
    """org.neurocafe.App on the session bus (Show, Do). Never raises: without a bus the game still runs."""

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
        threading.Thread(target=self._serve, name="neurocafe-bus", daemon=True).start()
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
        self._window = None      # (set in main: the window a photo is taken of)

    def cafe_load(self, slot="main"):
        return cafe.load(slot)

    def cafe_save(self, state, slot="main"):
        try:
            return cafe.save(state, slot)
        except OSError as e:
            return {"error": f"Couldn't save the cafe: {e}"}

    # your photos for the photo frames (2026-10-24): kept beside the save, not in it
    def cafe_photo_add(self, data_url):
        try:
            return cafe.photo_add(data_url)
        except OSError as e:
            return {"error": f"Couldn't keep the photo: {e}"}

    def cafe_photos(self):
        try:
            return cafe.photos()
        except OSError:
            return {}

    def cafe_cards(self):
        """V25 q5: the tarot frames' Major Arcana, from the person's own decks (never put in the game's files)."""
        try:
            return cafe.cards()
        except Exception:
            return {}

    def cafe_photo_delete(self, pid):
        try:
            return cafe.photo_delete(pid)
        except OSError as e:
            return {"error": f"Couldn't remove the photo: {e}"}

    # the jukebox (PT56 / Q8): the café radio and your playlists, played from NeuroNet's loopback media server
    def cafe_music(self):
        """{radio: [{name, url}], folder, playlists: [{id, name, path, songs: [{name, url}]}]} -- or {"error"}."""
        try:
            if not nn.ensure_media_server():
                return {"error": "NeuroCafe couldn't start its music server."}
            nn.MEDIA_ROOTS["cafe-music"] = cafe.music_dir
            game = os.path.join(page_dir(), "cafe", "music")
            radio = [{"name": os.path.splitext(n)[0], "url": "cafe/music/" + n} for n in cafe.songs(game)]
            radio += [{"name": os.path.splitext(n)[0], "url": nn.media_url_for("cafe-music", n)} for n in cafe.songs(cafe.music_dir())]
            lists = []
            for p in cafe.playlists():
                kind = "cafe-pl-" + p["id"]
                nn.MEDIA_ROOTS[kind] = (lambda d=p["path"]: d)    # (served only while it's one of your playlists)
                lists.append({"id": p["id"], "name": p["name"], "path": p["path"],
                              "songs": [{"name": os.path.splitext(n)[0], "url": nn.media_url_for(kind, n)} for n in cafe.songs(p["path"])]})
            return {"radio": radio, "folder": cafe.music_dir(), "playlists": lists}
        except OSError as e:
            return {"error": f"Couldn't read the music: {e}"}

    def cafe_music_add(self):
        """Pick a folder; it becomes a playlist."""
        import webview  # (loaded by main() long before -- after small_js_heap)
        try:
            picked = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
        except Exception as e:
            return {"error": f"Couldn't open the folder picker: {e}"}
        if not picked:
            return {"cancelled": True}
        try:
            return cafe.playlist_add(picked[0] if isinstance(picked, (list, tuple)) else picked)
        except OSError as e:
            return {"error": f"Couldn't keep the playlist: {e}"}

    def cafe_music_remove(self, pid):
        try:
            nn.MEDIA_ROOTS.pop("cafe-pl-" + str(pid), None)
            return cafe.playlist_remove(pid)
        except OSError as e:
            return {"error": f"Couldn't forget the playlist: {e}"}

    def cafe_music_folder(self):
        """Open the café radio's folder in the file manager, to drop songs in."""
        try:
            subprocess.Popen(["xdg-open", cafe.music_dir()], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            return {"ok": True}
        except OSError as e:
            return {"error": f"Couldn't open the folder: {e}"}

    # photos of the café (2026-10-25, Cam: "a little transparent camera ... takes a photo of inside the cafe only"): the page
    # frames the café and hides what's outside it, then the window's own pixels inside its outline become a PNG
    def cafe_snap(self, outline):
        try:
            return snap(self._window, outline)
        except Exception as e:      # (Qt missing or the grab failing: say so, the game goes on)
            return {"error": f"Couldn't take the photo: {e}"}

    def hello(self):
        """The page has loaded: the bus may talk to it now."""
        if self._bus:
            self._bus.page_ready()
        return {"version": version()}



def snaps_dir():
    """Where photos of the café go: Pictures/NeuroCafe (the desktop's own Pictures folder, if it names one)."""
    pics = ""
    try:
        pics = subprocess.run(["xdg-user-dir", "PICTURES"], capture_output=True, text=True, timeout=3).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    home = os.path.expanduser("~")
    if not pics or os.path.normpath(pics) == os.path.normpath(home):
        pics = os.path.join(home, "Pictures")
    return os.path.join(pics, "NeuroCafe")


def grab_view(window, timeout=5.0):
    """The game's window, as it looks (a QImage): its web view grabbed on Qt's own thread. None without the Qt window."""
    view = getattr(getattr(window, "native", None), "webview", None)
    if view is None:
        return None
    from qtpy import QtCore
    from qtpy.QtWidgets import QApplication
    done, out = threading.Event(), {}

    class Grab(QtCore.QObject):
        go = QtCore.Signal()

        def run(self):
            try:
                out["image"] = view.grab().toImage()
            finally:
                done.set()

    g = Grab()
    g.moveToThread(QApplication.instance().thread())
    g.go.connect(g.run, QtCore.Qt.ConnectionType.QueuedConnection)
    g.go.emit()
    done.wait(timeout)
    return out.get("image")


def cut_out(image, outline, scale):
    """Just the café: the picture inside `outline` (page points; `scale` device pixels to one), the rest see-through."""
    from qtpy.QtCore import QPointF, Qt
    from qtpy.QtGui import QImage, QPainter, QPainterPath, QPolygonF
    pts = [QPointF(float(x) * scale, float(y) * scale) for x, y in outline]
    path = QPainterPath()
    path.addPolygon(QPolygonF(pts + pts[:1]))
    box = path.boundingRect().toAlignedRect().intersected(image.rect())
    out = QImage(box.size(), QImage.Format.Format_ARGB32_Premultiplied)
    out.fill(Qt.GlobalColor.transparent)
    p = QPainter(out)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    p.translate(-box.x(), -box.y())
    p.setClipPath(path)
    p.drawImage(0, 0, image)
    p.end()
    return out


def snap(window, outline, folder=None, when=None):
    """Takes the photo: grabs the window, cuts the café out, saves it as "NeuroCafe <date> <time>.png"."""
    # (2026-10-26, hardening: the café's outline is a handful of corners -- never thousands, never anything but numbers)
    if not isinstance(outline, list) or not 3 <= len(outline) <= 64 or not all(
            isinstance(q, (list, tuple)) and len(q) == 2 and all(isinstance(n, (int, float)) and math.isfinite(n) and abs(n) < 1e6 for n in q)
            for q in outline):
        return {"error": "No café to take a photo of."}
    image = grab_view(window)
    if image is None or image.isNull():
        return {"error": "Photos need NeuroCafe's own window (it runs with --gui qt)."}
    view = window.native.webview
    scale = image.width() / max(1, view.width())
    pic = cut_out(image, outline, scale)
    shown_as = "Pictures/NeuroCafe/" if folder is None else ""
    folder = folder or snaps_dir()
    os.makedirs(folder, exist_ok=True)
    name = time.strftime("NeuroCafe %Y-%m-%d %H-%M-%S", time.localtime(when)) + ".png"
    path = os.path.join(folder, name)
    if not pic.save(path, "PNG"):
        return {"error": "Couldn't save the photo."}
    return {"path": path, "name": shown_as + name}


def small_js_heap(environ=None):
    """N40 (2026-10-21): give the page's JavaScript a 128 MB ceiling. The game keeps ~2 MB alive, but on a machine with
    lots of memory Chromium tidies up so rarely that what the clock throws away piled up past a gigabyte in half an
    hour; with a ceiling it tidies at a few tens of MB. Flags already set by the person are left alone."""
    environ = os.environ if environ is None else environ
    flags = environ.get("QTWEBENGINE_CHROMIUM_FLAGS", "")
    if "--js-flags" not in flags:
        environ["QTWEBENGINE_CHROMIUM_FLAGS"] = (flags + " --js-flags=--max-old-space-size=128").strip()


def already_running():
    """True when another NeuroCafe owns the bus name. NEUROCAFE_ALLOW_SECOND=1 skips it (tests)."""
    if os.environ.get("NEUROCAFE_ALLOW_SECOND"):
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
        sys.stderr.write(f"NeuroCafe: couldn't reach the open game: {e}\n")


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
    small_js_heap()
    try:
        import webview
    except ImportError:
        nn.fatal("NeuroCafe needs pywebview.\n\n    pip install pywebview\n")
    index = os.path.join(page_dir(), "neurocafe.html")
    if not os.path.isfile(index):
        nn.fatal(f"NeuroCafe can't find its game. Expected:\n  {index}")
    api = Api()
    window = webview.create_window(APP_NAME, index, js_api=api, width=1360, height=880,
                                   min_size=(360, 480), hidden=hidden, background_color="#45281a")

    # shown and hidden by the game itself where there's no Hyprland scratchpad (KDE)
    shown = nn.ShownWindow(window, hidden)

    def show():
        shown.show("window")
    api._window = window
    api._bus = Bus(window.evaluate_js, show, shown)
    if not api._bus.start():
        sys.stderr.write(f"NeuroCafe: not on the session bus (its shortcut can't bring it forward): {api._bus.error}\n")

    def quit_game():
        sys.stderr.write("NeuroCafe: tucked away for a while -- closing (the cafe runs by the clock)\n")
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
            QGuiApplication.setDesktopFileName(os.environ.get("NEURONET_APP_ID") or "NeuroCafe")  # a test copy's other name (cachyos-docker.sh --show)
        except Exception:
            pass
    try:
        from gi.repository import GLib
        GLib.set_prgname(os.environ.get("NEURONET_APP_ID") or "NeuroCafe")
    except Exception:
        pass
    webview.start(gui=gui) if gui else webview.start()


if __name__ == "__main__":
    main()
