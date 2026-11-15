"""Two music fixes, kept from coming back.

1. Playing a song from the library threw an album up over it -- Cam: "When
   double clicking a song it opens the album for Jelly Roll no matter what
   the song is." The play-count refresh checked the wrong tab ("library"
   instead of "albums") and trusted a leftover album selection.

2. Album view lagged while scrolling -- the one full-size image in Chords,
   drawn into a smaller box, which a software renderer can re-scale on every
   frame. The cover is now fetched at exactly its drawn size, and the size
   a caller asks for is honoured instead of silently ignored.

Runs in a temporary copy of the app; nothing real is touched.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import base64, io, os, re, shutil, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nMusic fixes and features\n")


def section(text, start, end):
    """The text from `start` up to `end`, or "" if either is missing -- so a
    feature that is absent shows up as named failures, not a crash."""
    if start not in text:
        return ""
    rest = text[text.index(start):]
    return rest[:rest.index(end)] if end in rest else rest
js = open(os.path.join(APP, "ui", "music", "chords.js"), encoding="utf-8").read()

# ---- 1. the album that jumped up over the library ---------------------
# Up to the statement that follows the hook. Cutting at the first "};" is
# wrong: the hook's third line ends an object literal with "};", so an
# earlier version of this test looked at three lines, never reached the
# condition, and "passed" the library check without reading it.
hook = js[js.index("CH.Player._onPlayed = "):]
hook = hook[:hook.index("if (unsubscribe) unsubscribe();")]
# Read the CODE, not the comments: the fix's own comment explains the bug by
# quoting the old condition, and matching that would fail a correct fix.
hook = re.sub(r"/\*.*?\*/", "", hook, flags=re.S)
hook = re.sub(r"(?m)//.*$", "", hook)
ok("(the check below really does read the condition)",
   "showAlbum(page)" in hook, hook[:120])
ok("the play-count refresh never fires on the library tab",
   'sub === "library"' not in hook, hook)
ok("it fires only on the albums tab", 'sub === "albums"' in hook, hook)
ok("and only when the album's own track list is really on screen",
   "#ch-alb-tracks" in hook, hook)

# ---- 2. the cover drawn at its real size ------------------------------
show = js[js.index("async function showAlbum(page)"):]
show = show[:show.index("#ch-alb-back")]
show = re.sub(r"/\*.*?\*/", "", show, flags=re.S)
# cachedThumbURL is thumbURL with SS.Art's cache in front of it -- still
# sized, which is what this check is about. Either spelling passes; asking
# for the FULL-size picture here does not.
ok("the album cover is fetched sized, not full size",
   ("thumbURL(a.art, edge)" in show or "cachedThumbURL(a.art, edge)" in show)
   and "imageURL(a.art)" not in show, "")
ok("sized for the box in real screen pixels",
   "devicePixelRatio" in show and "clientWidth" in show, "")

# ---- 3. bulk edit -------------------------------------------------------
code = re.sub(r"/\*.*?\*/", "", js, flags=re.S)
bulk = section(code, "function bulkEdit(page)", "function editTrack(")
ok("bulk edit is offered in select mode",
   'id="ch-sel-edit"' in js and "bulkEdit(page)" in code)
ok("it walks the songs in the order shown",
   "filtered()" in bulk)
ok("and does not skip songs the current filter hides",
   "allTracks()" in bulk and "!shown.includes(f)" in bulk, bulk[:200])
edit = section(code, "function editTrack(page, file", "async function removeTrack")
ok("the button reads Next until the last song, then Save",
   'last ? "Save" : "Next"' in edit)
ok("it is the same editor as a single song, not a second one",
   code.count('openDlg(heading') == 1 and "function editTrack(page, file, run" in code)

# ---- 4. the top bar -----------------------------------------------------
css = open(os.path.join(APP, "ui", "music", "chords.css"), encoding="utf-8").read()
css_code = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
tail = section(css_code, "#ch-shell #ch-sidebar-left", "\n\n\n\n\n\n\n\n")
ok("the top bar is shown in the music section",
   re.search(r"#ch-shell #ch-top-bar\s*\{[^}]*display:\s*flex", tail) is not None)
ok("it sits in the flow above the content, not fixed over it",
   re.search(r"#ch-shell #ch-top-bar\s*\{[^}]*position:\s*relative", tail) is not None)
ok("the content fills what is left beneath it",
   re.search(r"#ch-shell #ch-inner\s*\{[^}]*flex:\s*1", tail) is not None)
ok("its menu button, which opened Chords' replaced sidebar, stays hidden",
   "#ch-shell #ch-menu-toggle { display: none; }" in tail)
html = open(os.path.join(APP, "ui", "index.html"), encoding="utf-8").read()
ok("the clock and the mini player are in the bar",
   'id="ch-top-bar-clock"' in html and 'id="cc-mini-play"' in html)

root = tempfile.mkdtemp(prefix="ss-music-")
app = os.path.join(root, "NeuroNet")
shutil.copytree(APP, app, ignore=shutil.ignore_patterns(
    "__pycache__", "node_modules", "test", "*_data", "*.log"))
data = os.path.join(app, "neuronet_data")
os.makedirs(os.path.join(data, "chords", "images"))
open(os.path.join(data, "neuronet.json"), "w").write("{}")
try:
    from PIL import Image
    Image.new("RGB", (768, 768), (120, 40, 60)).save(
        os.path.join(data, "chords", "images", "Cover.jpg"))
    sys.argv = [os.path.join(app, "neuronet.py")]
    sys.path.insert(0, app)
    import neuronet
    api = neuronet.Api()

    def dims(u):
        # thumbnails come by address since 2026-10-05 (pictures by address);
        # a data URL is still what you get when the media server can't start
        if u.startswith("http"):
            import urllib.request
            with urllib.request.urlopen(u, timeout=5) as r:
                return Image.open(io.BytesIO(r.read())).size
        return Image.open(io.BytesIO(base64.b64decode(u.split(",", 1)[1]))).size

    ok("a requested size is honoured (it used to be ignored)",
       dims(api.music_thumb_url("Cover.jpg", 258)) == (258, 258))
    ok("double density gets double the pixels",
       dims(api.music_thumb_url("Cover.jpg", 516)) == (516, 516))
    ok("asking for more than the source never enlarges it",
       dims(api.music_thumb_url("Cover.jpg", 2000)) == (768, 768))
    thumbs = os.listdir(neuronet.music_thumbs_dir())
    ok("and writes no pointless oversized copy",
       not any(".2000." in t for t in thumbs), thumbs)
    ok("no size still gives the shared thumbnail",
       dims(api.music_thumb_url("Cover.jpg")) == (360, 360))
    ok("a path outside the art folder is refused",
       api.music_thumb_url("../../neuronet.py", 300) is None)
finally:
    shutil.rmtree(root, ignore_errors=True)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
