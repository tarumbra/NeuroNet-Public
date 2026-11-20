"""The merge: KinCrux's tools inside NeuroNet.

Cam: "i now want the two apps merged together into one and for it to be
called NeuroNet ... i am happy if there is only one notes section and
photo handler for them both."

The point of these checks is that the merge moved NO data. Kitchen, Home and
Money read KinCrux's own files where they sit, so nothing can be stranded by
the merge and the old app still opens the same files.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
UI = os.path.join(APP, "ui")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


read = lambda p: open(os.path.join(UI, p), encoding="utf-8").read()
print("\nThe merge\n")
app, html = read("app.js"), read("index.html")
py = __import__("backend_src").backend_source(APP)

ok("the app is called NeuroNet",
   'APP_NAME = "NeuroNet"' in py and "<title>NeuroNet</title>" in html)
ok("Home, Kitchen and Money are sections here",
   all(f'{{key: "{k}", name: "{n}"' in app for k, n in
       (("home", "Home"), ("cookery", "Kitchen"), ("money", "Money"))))
ok("and each is reachable from the router",
   "SS.Home" in app and "CP.Cookery" in app and "CP.Money" in app)

# ---- the data, which is the part that matters --------------------------
ok("KinCrux's data layer came across whole, as its own module",
   os.path.isfile(os.path.join(APP, "kitchen_backend.py")))
kb = open(os.path.join(APP, "kitchen_backend.py"), encoding="utf-8").read()
ok("  and still reads KinCrux's own files, unmoved",
   "camily.json" in kb and "cookery.json" in kb and "def cookery_dir" in kb)
ok("the app's calls for them are namespaced, so they cannot collide",
   all(f"def {m}(self" in py for m in
       ("kc_get_data", "kc_save_data", "kc_get_money", "kc_save_money")))
ok("the Kitchen half is optional, like Notes",
   "import kitchen_backend" in py and "kitchen_backend = None" in py)

# The Kitchen works on a shared `data` object; in this app that name already
# means the photo library. Handing it the wrong one would be silent and bad.
ok("the Kitchen gets its OWN document, not the photo library",
   "window.CK" in app and "const S = window.CK.shared;" in read("cookery.js"))
ok("  and it is fetched only when a Kitchen screen is opened",
   "loadKitchen()" in app and "!kitchenLoaded" in app)
# Home reads from BOTH: photos and albums here, contacts and events there.
home = read("home/home.js")
ok("Home reads photos here and contacts from KinCrux's document",
   "get photos() { return host.data.photos" in home
   and "get contacts() { return (kitchen.data && kitchen.data.contacts)" in home)
ok("  and saves each back to the file it came from",
   "await kitchen.save(); await host.save();" in home)

# ---- Puzzles ------------------------------------------------------------
ok("Games is now Puzzles", '{key: "games", name: "Puzzles"' in app)
ok("  with one subsection per puzzle, from Cranium's own list",
   "addPuzzleSections" in app and "mod.games" in app)
_gk = re.findall(r'\{key: "([a-z0-9]+)", name: "[^"]+", icon: "i-[a-z0-9-]+"', read("games/cranium.js"))
ok("  and every puzzle is reachable",
   len(_gk) >= 15 and 'VIEWS: Object.keys(VIEW_OF).concat(GAMES.map((g) => "games:" + g.key))'
   in read("games/cranium.js"), len(_gk))

# ---- nothing of this app's own moved ------------------------------------
ok("this app's own data folder is unchanged, so an upgrade strands nothing",
   'neuronet_data' in py)
ok("Home carries KinCrux's code, not a rewrite of it",
   "renderDashboard" in home and "renderCalendarPage" in home and "renderContacts" in home)

# ---- combining the two photo libraries ---------------------------------
# Cam chose "Combine both into one library". This is the only part of the
# merge that touches files, so the rules are checked by RUNNING it.
import shutil as _sh, tempfile as _tf, json as _json
from PIL import Image as _Img

root = _tf.mkdtemp(prefix="mc-merge-")
appdir = os.path.join(root, "app")
_sh.copytree(APP, appdir, ignore=_sh.ignore_patterns(
    "__pycache__", "node_modules", "test", "*_data", "*.log", "library_path.txt"))
try:
    ours = os.path.join(appdir, "neuronet_data", "photos")
    os.makedirs(ours)
    _Img.new("RGB", (8, 8), (10, 80, 10)).save(os.path.join(ours, "IMG_1.jpg"))
    _Img.new("RGB", (8, 8), (5, 5, 200)).save(os.path.join(ours, "same.jpg"))
    _json.dump({"photos": [{"id": "s1", "storedName": "IMG_1.jpg", "caption": "Mine"},
                           {"id": "s2", "storedName": "same.jpg"}],
                "albums": [{"id": "a1", "name": "Holiday"}], "folders": [], "photoTagList": []},
               open(os.path.join(appdir, "neuronet_data", "neuronet.json"), "w"))
    kc = os.path.join(root, "camily_data")
    kcp = os.path.join(kc, "photos")
    os.makedirs(kcp)
    _Img.new("RGB", (8, 8), (200, 30, 30)).save(os.path.join(kcp, "IMG_1.jpg"))   # same name, other picture
    _sh.copy(os.path.join(ours, "same.jpg"), os.path.join(kcp, "other_name.jpg"))  # same picture
    _Img.new("RGB", (8, 8), (150, 120, 40)).save(os.path.join(kcp, "roast.jpg"))
    _json.dump({"photos": [{"id": "k1", "storedName": "IMG_1.jpg", "caption": "Theirs", "albumIds": ["ka"]},
                           {"id": "k2", "storedName": "other_name.jpg"},
                           {"id": "k3", "storedName": "roast.jpg", "folderId": "kf"},
                           {"id": "k4", "storedName": "gone.jpg"}],
                "albums": [{"id": "ka", "name": "Holiday"}],
                "folders": [{"id": "kf", "name": "Scans"}],
                "photoTagList": ["Food"], "contacts": [], "events": []},
               open(os.path.join(kc, "camily.json"), "w"))
    kc_before = sorted(os.listdir(kcp))
    kc_doc_before = open(os.path.join(kc, "camily.json")).read()

    sys.argv = [os.path.join(appdir, "neuronet.py")]
    sys.path.insert(0, appdir)
    import neuronet as _mc
    # What main() does before the window opens: KinCrux's family library,
    # found beside the app, is brought inside it (test_standalone.py). The
    # merge then reads that copy; the original is still checked untouched below.
    _mc.adopt_at_startup()
    api = _mc.Api()

    pre = api.photos_merge_preview()
    ok("a preview says what would happen and writes nothing",
       pre.get("copied") == 2 and sorted(os.listdir(ours)) == ["IMG_1.jpg", "same.jpg"], pre)
    run = api.photos_merge_run()
    ok("photos come across", run.get("copied") == 2)
    ok("  a name clash keeps BOTH, renaming the incomer",
       run["renamed"] and run["renamed"][0]["now"] == "IMG_1 (2).jpg"
       and os.path.isfile(os.path.join(ours, "IMG_1 (2).jpg"))
       and os.path.isfile(os.path.join(ours, "IMG_1.jpg")), run.get("renamed"))
    doc = api.photo_get_data()
    ok("  and the original's record still points at the original file",
       [p for p in doc["photos"] if p["storedName"] == "IMG_1.jpg"][0]["caption"] == "Mine")
    ok("  the same picture under another name is not duplicated",
       run.get("skipped_same") == 1 and not os.path.isfile(os.path.join(ours, "other_name.jpg")))
    ok("  an album of the same name is joined, not duplicated",
       [a["name"] for a in doc["albums"]].count("Holiday") == 1)
    ok("  a folder that is new is created", "Scans" in [f["name"] for f in doc["folders"]])
    ok("  a record pointing at a missing file is reported, not fatal",
       run.get("missing") == ["gone.jpg"])
    ok("KinCrux's library is NEVER touched",
       sorted(os.listdir(kcp)) == kc_before
       and open(os.path.join(kc, "camily.json")).read() == kc_doc_before)
    before_count = len(doc["photos"])
    again = api.photos_merge_run()
    ok("running it twice brings nothing across again",
       again.get("copied") == 0 and again.get("skipped_done") == 2
       and len(api.photo_get_data()["photos"]) == before_count, again)
finally:
    _sh.rmtree(root, ignore_errors=True)

ok("and it is offered in Settings, preview first",
   "photos_merge_preview" in app and "previewLibraryMerge" in app
   and "Combine the libraries?" in app)

# ---- the calendar, and album scrolling ---------------------------------
# Cam: "the calander doesnt look like a calander and is impossible to use."
# The screens came across in the merge; their stylesheet did not.
home_css = read("home/home.css")
ok("Home's styles came across with its screens",
   os.path.isfile(os.path.join(UI, "home", "home.css")) and "home/home.css" in html)
ok("  including the month grid itself",
   ".cal-grid-body" in home_css and ".cal-cell" in home_css and ".cal-dow" in home_css)
# Training has a calendar using the same class names.
# Scoped to the Home PAGE, or to Home's own dialog: the "Add a block" chooser
# is a modal and so lives outside the page, but its classes (dash-add-*) exist
# nowhere else. Anything else would be free to restyle another section.
def _scoped(sel):
    sel = sel.strip()
    if ".ss-home" in sel:
        return True
    return sel.startswith(".modal") and ".dash-add" in sel

unscoped = [sel for sel in re.findall(r"(?m)^([^{@}]+)\{", home_css)
            if not sel.strip().startswith("@") and not _scoped(sel)]
ok("  and every rule is scoped to Home, so two calendars cannot restyle each other",
   not unscoped, unscoped[:3])
ok("  with the page carrying that scope", 'page.className = "page ss-home"' in read("home/home.js"))

# Cam: "when i click on an album ... it lags when i scroll on the page."
#
# This machinery now lives in SS.Art, shared with music -- Cam: "it lags
# when i move around the app, especially when loading the album sub
# section found under the music main section." What it DOES is checked
# for real in test_perf.js, by breaking it; what is checked here is only
# that it is still one shared thing rather than a copy per module, which
# is the shape the merge is about.
ok("one art loader serves every module, not one per module",
   "SS.Art = (() => {" in app and "SS.Art.get(" in app)
_lazy = app[app.index("    lazy(opts) {"):] if "    lazy(opts) {" in app else ""
ok("  a tile is given its picture only near the window",
   "IntersectionObserver" in _lazy and "${NEAR} 0px" in _lazy)
# One observer cannot do both jobs: it reports a tile once, at its own
# boundary, so a single near boundary released nothing.
ok("  and a SECOND observer releases it once well behind",
   _lazy.count("new IntersectionObserver") == 2
   and "${FAR} 0px" in _lazy and 'const FAR = "3000px";' in app)
ok("  with a fallback where there is no observer at all",
   'typeof IntersectionObserver === "undefined"' in _lazy)
ok("  the photo library is one of its callers, not its own copy",
   "SS.Art.get(storedName" in app and "SS.Art.lazy({" in app)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
