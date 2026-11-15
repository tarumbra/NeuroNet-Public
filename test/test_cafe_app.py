"""NeuroCafe, the app around the rules (2026-10-20, V19): where the cafe is kept,
the window, its launcher, and how it's put on the desktop.

Cam: "Its own app, like NeuroFarm, Super+Alt+J". Its own window, its own
command (neurocafe), its own save (neuronet_data/cafe/cafe.json). Runs on a
scratch data folder -- never the real data, never a real window.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import shutil  # noqa: E402
import stat  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import cafe  # noqa: E402
import neurocafe  # noqa: E402  (before the scratch folder below: importing it points cafe at the real data)

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


def read(*p):
    return open(os.path.join(APP, *p), encoding="utf-8").read()


print("\nNeuroCafe, the app\n")
tmp = tempfile.mkdtemp(prefix="nn-cafe-")
old = cafe.DATA_DIR_PROVIDER
cafe.DATA_DIR_PROVIDER = lambda: tmp
try:
    ok("no cafe yet: a new one", cafe.load() == cafe.empty())
    good = {"v": 1, "game": "neurocafe", "log": [], "items": [], "ware": {}, "coins": 150}
    ok("a cafe is saved", cafe.save(good) == {"ok": True} and cafe.load()["coins"] == 150)
    cafe.save(dict(good, coins=300))
    ok("  the one before is kept (cafe.json.bak)", json.load(open(os.path.join(tmp, "cafe", "cafe.json.bak")))["coins"] == 150)
    ok("  a farm, a NeuroPets save or junk isn't written as a cafe",
       all("error" in cafe.save(x) for x in ({"v": 1, "game": "neurofarm", "log": []}, {"v": 1, "pet": None, "log": []}, [], dict(good, items={}))))
    with open(os.path.join(tmp, "cafe", "cafe.json"), "w") as f:
        f.write("{broken")
    ok("  a damaged save: the copy from before it", cafe.load()["coins"] == 150)
    # (2026-10-26, hardening) a save nested thousands deep is damaged like any other -- the copy from before it, no crash
    with open(cafe.path(), "w") as f:
        f.write("[" * 100000 + "]" * 100000)
    ok("  a save nested thousands deep: the copy from before it, no crash", cafe.load()["coins"] == 150)
    # the sandbox (2026-10-21): its own file, and the two never cross
    sb = dict(good, coins=999999, sandbox=True)
    ok("the sandbox is kept in its own file", cafe.save(sb, "sandbox") == {"ok": True} and os.path.isfile(os.path.join(tmp, "cafe", "cafe-sandbox.json"))
       and cafe.load("sandbox")["coins"] == 999999 and cafe.load()["coins"] == 150)
    ok("  a sandbox save is never written over your cafe", "error" in cafe.save(sb) and cafe.load()["coins"] == 150)
    ok("  nor your cafe into the sandbox, nor anywhere else", "error" in cafe.save(good, "sandbox") and "error" in cafe.save(good, "../x") and "error" in cafe.load("../x"))
    # your photos for the photo frames (2026-10-24): kept beside the save as JPEGs, given back as data addresses
    import base64
    jpg = cafe.PHOTO_PREFIX + base64.b64encode(b"\xff\xd8\xff\xe0" + b"0" * 200).decode()
    got = cafe.photo_add(jpg)
    ok("a photo is kept in cafe/photos and comes back by its id", "id" in got and os.path.isfile(os.path.join(tmp, "cafe", "photos", got["id"] + ".jpg"))
       and cafe.photos() == {got["id"]: jpg})
    ok("  only a JPEG, and not too big", all("error" in cafe.photo_add(x) for x in ("data:image/png;base64,AAAA", cafe.PHOTO_PREFIX + "!!!", cafe.PHOTO_PREFIX + base64.b64encode(b"GIF89a").decode(),
       cafe.PHOTO_PREFIX + base64.b64encode(b"\xff\xd8\xff" + b"0" * (cafe.PHOTO_MAX + 1)).decode(), 42)))
    ok("  removed by its id -- and nothing outside the folder", cafe.photo_delete(got["id"]) == {"ok": True} and cafe.photos() == {} and "error" in cafe.photo_delete("../cafe"))
    # the jukebox (PT56 / Q8): the café radio's folder, and folders kept as playlists -- songs straight in them, by name
    mus = os.path.join(tmp, "my music")
    os.makedirs(os.path.join(mus, "sub"))
    for name in ("10 Rain.mp3", "2 Dawn.ogg", "cover.jpg", "notes.txt", "sub/9 Deep.mp3"):
        open(os.path.join(mus, name), "wb").write(b"x" * 64)
    ok("a playlist folder's songs: music only, straight in it, in number order", cafe.songs(mus) == ["2 Dawn.ogg", "10 Rain.mp3"])
    pl = cafe.playlist_add(mus)
    ok("  kept as a playlist named after its folder (the same folder twice is one playlist)", "id" in pl and cafe.playlists() == [{"id": pl["id"], "name": "my music", "path": mus}]
       and cafe.playlist_add(mus) == pl)
    ok("  a folder with no music, or none at all, isn't", "error" in cafe.playlist_add(os.path.join(mus, "sub", "..", "..")) and "error" in cafe.playlist_add(os.path.join(tmp, "nope")))
    ok("  forgotten again -- its folder and songs left alone", cafe.playlist_remove(pl["id"]) == {"ok": True} and cafe.playlists() == [] and os.path.isfile(os.path.join(mus, "2 Dawn.ogg")))
    ok("the café radio's own folder: <data>/cafe/music", cafe.music_dir() == os.path.join(tmp, "cafe", "music") and os.path.isdir(cafe.music_dir()))
    # ... played through NeuroNet's loopback media server: the page gets an address, and only that folder's songs are there
    import urllib.request
    cafe.playlist_add(mus)
    open(os.path.join(cafe.music_dir(), "Mine.mp3"), "wb").write(b"m" * 32)
    neurocafe.page_dir = lambda: os.path.join(APP, "ui")      # (run from test/, NeuroNet would look for its ui there)
    lib = neurocafe.Api().cafe_music()
    song = lib["playlists"][0]["songs"][0]
    ok("  the library: the game's lofi and jazz + your café music, and the playlist's songs at loopback addresses",
       {"cafe/music/lofi.ogg", "cafe/music/jazz.ogg"} <= {r["url"] for r in lib["radio"]} and any(r["name"] == "Mine" and r["url"].startswith("http://127.0.0.1:") for r in lib["radio"])
       and song["name"] == "2 Dawn" and song["url"].startswith("http://127.0.0.1:"), json.dumps(lib)[:400])
    ok("  a song plays from its address", urllib.request.urlopen(song["url"]).read() == b"x" * 64)
    try:
        urllib.request.urlopen(song["url"].rsplit("/", 1)[0] + "/notes.txt")
        served_txt = True
    except Exception:
        served_txt = False
    ok("  (notes.txt beside the songs isn't served)", not served_txt)
    for k in [k for k in neurocafe.nn.MEDIA_ROOTS if k.startswith("cafe-")]:
        neurocafe.nn.MEDIA_ROOTS.pop(k)
finally:
    cafe.DATA_DIR_PROVIDER = old
    shutil.rmtree(tmp, ignore_errors=True)

src = read("neurocafe.py")
ok("its own window and one copy only (org.neurocafe.App), saving through cafe.py",
   'BUS_NAME = "org.neurocafe.App"' in src and "def cafe_load" in src and "def cafe_save" in src and "cafe.DATA_DIR_PROVIDER" in src
   and "farm" not in src.replace("neurofarm", ""))
# N40: the page's JavaScript gets a 128 MB ceiling (set before Qt starts), unless the person set their own js-flags
fn = src[src.index("def small_js_heap"):src.index("def already_running")]
ns = {"os": os}
exec(fn, ns)
e1, e2, e3 = {}, {"QTWEBENGINE_CHROMIUM_FLAGS": "--no-sandbox"}, {"QTWEBENGINE_CHROMIUM_FLAGS": "--js-flags=--foo"}
for e in (e1, e2, e3):
    ns["small_js_heap"](e)
ok("a small JavaScript heap for the page (N40), added to flags already there, never over the person's own",
   e1["QTWEBENGINE_CHROMIUM_FLAGS"] == "--js-flags=--max-old-space-size=128" and e2["QTWEBENGINE_CHROMIUM_FLAGS"] == "--no-sandbox --js-flags=--max-old-space-size=128"
   and e3["QTWEBENGINE_CHROMIUM_FLAGS"] == "--js-flags=--foo" and src.index("small_js_heap()") < src.index("import webview\n"))
page = read("ui", "neurocafe.html")
ok("the page: the cafe's rules, its pictures and its screen", all(x in page for x in ('src="cafe/cafecore.js"', 'src="cafe/art/manifest.js"', 'src="cafe/cafe.js"')))
ok("  nothing inline for the page's security rules to block; pywebview's bridge let in ('unsafe-eval')",
   "onerror=" not in page and "onclick=" not in page and "script-src 'self' 'unsafe-eval'" in page)
ok("  and if Python can't be reached, it says so (not a blank page)", "couldn't reach its save" in read("ui", "cafe", "cafe.js"))
launcher = os.path.join(APP, "neurocafe")
ok("the neurocafe command: show, toggle, start", os.stat(launcher).st_mode & stat.S_IXUSR and "neurocafe.py" in read("neurocafe")
   and "toggle)" in read("neurocafe") and "org.neurocafe.App" in read("neurocafe") and "special:$SPECIAL" in read("neurocafe"))
ok("installed like NeuroFarm: the command, the app icon, the key (Super+Alt+J)",
   "neurocafe" in read("system", "bin", "neuronet-setup").split("COMMANDS=")[1].split("\n")[0]
   and "NeuroCafe.desktop.in" in read("system", "bin", "neuronet-setup")
   and "Exec=neurocafe show" in read("system", "templates", "NeuroCafe.desktop.in")
   and 'o.bind("SUPER + ALT + J", "NeuroCafe' in read("system", "hypr", "bindings.lua.block")
   and "J|NeuroCafe" in read("system", "install-app.sh")
   and os.path.isfile(os.path.join(APP, "icons", "NeuroCafe.png")))
binds = read("system", "hypr", "bindings.lua.block")
ok("  Super+Alt+J was free (no other NeuroNet key on it)", binds.count('"SUPER + ALT + J"') == 1)
ok("  and taken out again by the uninstallers", "NeuroCafe.desktop" in read("system", "install.sh") and "neurocafe neuroarcana neurotrain" in read("system", "install.sh")
   and "NeuroCafe.desktop" in read("system", "install-app.sh"))
# photos of the café (2026-10-25): the window's pixels inside the café's outline, into Pictures/NeuroCafe
ok("a photo: no window or no outline says so, nothing saved", "error" in neurocafe.snap(None, [[0, 0], [5, 0], [5, 5]], folder=os.path.join(tmp, "snaps"))
   and "error" in neurocafe.snap(None, "nope", folder=os.path.join(tmp, "snaps")) and not os.path.exists(os.path.join(tmp, "snaps")))
# (2026-10-26, hardening for shipping) the outline is a handful of real numbers: thousands of points, text, NaN or huge
# numbers are turned away before anything is grabbed
ok("  an outline that isn't a few real corners is turned away", all("error" in neurocafe.snap(None, bad, folder=os.path.join(tmp, "snaps")) for bad in (
   [[0, 0]] * 5000, [[0, 0], [1, "x"], [2, 2]], [[0, 0], [float("nan"), 1], [2, 2]], [[0, 0], [1e9, 1], [2, 2]], [[0, 0], [1, 1, 1], [2, 2]])))
ok("  the page asks Python for it by name, and the API has it", callable(getattr(neurocafe.Api(), "cafe_snap", None)) and 'Store.call("cafe_snap", [cafeRing(v)])' in read("ui", "cafe", "cafe.js"))
try:
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    from qtpy.QtGui import QColor, QGuiApplication, QImage
    _qapp = QGuiApplication.instance() or QGuiApplication([])
    img = QImage(200, 100, QImage.Format.Format_ARGB32)
    img.fill(QColor("red"))
    cut = neurocafe.cut_out(img, [[50, 0], [100, 25], [50, 50], [0, 25]], 2)     # (page points at 2 pixels each)
    ok("  just the café: cut to its outline's box, see-through outside it",
       cut.width() == 200 and cut.height() == 100 and cut.pixelColor(100, 50).red() == 255 and cut.pixelColor(100, 50).alpha() == 255
       and cut.pixelColor(2, 2).alpha() == 0 and cut.pixelColor(197, 97).alpha() == 0)
except ImportError:
    ok("  (Qt not here: the cut-out isn't checked)", True)
_old_run = neurocafe.subprocess.run
class _R:
    def __init__(self, out): self.stdout = out
for out, want in (("/home/x/Bilder\n", "/home/x/Bilder/NeuroCafe"), (os.path.expanduser("~") + "\n", os.path.join(os.path.expanduser("~"), "Pictures", "NeuroCafe"))):
    neurocafe.subprocess.run = lambda *a, _o=out, **k: _R(_o)
    got = neurocafe.snaps_dir()
    ok(f"  photos go in the desktop's Pictures folder, NeuroCafe ({want})", got == want, got)
neurocafe.subprocess.run = _old_run
# V25 q5: the tarot frames' cards come from the person's own decks in NeuroNet's card library (a scratch one here)
try:
    from PIL import Image as _Im
    os.makedirs(os.path.join(tmp, "cards", "images"), exist_ok=True)
    os.makedirs(os.path.join(tmp, "photos"), exist_ok=True)
    _Im.new("RGB", (400, 700), (40, 20, 90)).save(os.path.join(tmp, "cards", "images", "Old School Tarot The Fool.jpg"))
    _Im.new("RGB", (400, 700), (10, 10, 10)).save(os.path.join(tmp, "photos", "Murder Of Crows - Death.jpg"))
    _Im.new("RGB", (400, 700), (10, 10, 10)).save(os.path.join(tmp, "photos", "Murder Of Crows - Ace of Cups.jpg"))
    _was = cafe.DATA_DIR_PROVIDER
    cafe.DATA_DIR_PROVIDER = lambda: tmp                 # (the scratch folder -- never the real card library)
    try:
        got = neurocafe.Api().cafe_cards()
    finally:
        cafe.DATA_DIR_PROVIDER = _was
    ok("the tarot cards: each deck's Major Arcana found on this computer, small pictures (minor cards left out)",
       sorted(got) == ["crows", "oldschool"] and list(got["oldschool"]) == ["The Fool"] and list(got["crows"]) == ["Death"]
       and got["crows"]["Death"].startswith("data:image/jpeg;base64,") and len(got["crows"]["Death"]) < 40000, {k: list(v) for k, v in got.items()})
except ImportError:
    ok("  (no Pillow here: the cards aren't checked)", True)
# 2026-10-25 performance pass: tucked away in its scratchpad the page isn't "hidden", so the watcher tells it (it stops
# drawing) -- once per change, every few seconds; never touching Hyprland or a real window here
class _Stop(Exception):
    pass
_said, _seq = [], [False, True, True, False]
class _FakeBus:
    last_call = 0
    _shown = None
    def _queue_js(self, code): _said.append(code)
_old = (neurocafe.tucked_away, neurocafe.time.sleep, neurocafe.threading.Thread)
neurocafe.tucked_away = lambda: _seq.pop(0) if _seq else (_ for _ in ()).throw(_Stop())
neurocafe.time.sleep = lambda s: None
class _NowThread:
    def __init__(self, target=None, **k): self.target = target
    def start(self):
        try:
            self.target()
        except _Stop:
            pass
neurocafe.threading.Thread = _NowThread
neurocafe.watch_and_quit(_FakeBus(), lambda: None)
neurocafe.tucked_away, neurocafe.time.sleep, neurocafe.threading.Thread = _old
ok("tucked away, the page is told to stop drawing; back, to start again -- once per change",
   _said == ["window.NCAway && window.NCAway(false)", "window.NCAway && window.NCAway(true)", "window.NCAway && window.NCAway(false)"], _said)
ok("  and the page listens (no drawing while away)", "window.NCAway = (a) =>" in read("ui", "cafe", "cafe.js") and "document.hidden || away) return;" in read("ui", "cafe", "cafe.js"))
print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
