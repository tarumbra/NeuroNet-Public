"""App stats: the usage record, the counts, and the Excel and Word exports.

Cam: "In Settings menu an application stats panel that breaks down what is in
the app and how much ... This data should also be able to be exported into
excell, a doc or imported into the in app boards feature with a chart."

Runs against a fake Api and a temporary usage file -- never the real data.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import io, json, os, re, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import app_stats  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nApp stats\n")
tmp = tempfile.mkdtemp()
usage = os.path.join(tmp, "usage.json")

# ---- the usage record ----------------------------------------------------
doc = app_stats.read_usage(usage)
ok("no file yet reads as an empty record", doc["seconds"] == 0 and doc["counts"] == {})
app_stats.launched(usage)
app_stats.record(usage, {"seconds": 60, "musicSeconds": 30, "day": "2026-09-26",
                         "sections": {"home": 40, "music": 20}})
app_stats.record(usage, {"seconds": 30, "day": "2026-09-27", "sections": {"home": 30}})
doc = app_stats.read_usage(usage)
ok("time adds up across flushes", doc["seconds"] == 90, doc["seconds"])
ok("  by section", doc["sections"] == {"home": 70, "music": 20}, doc["sections"])
ok("  and by day", doc["days"] == {"2026-09-26": 60, "2026-09-27": 30}, doc["days"])
ok("music time is kept apart", doc["musicSeconds"] == 30)
ok("launches are counted", doc["launches"] == 1)
ok("the day recording began is written down, once", bool(doc["since"]))
since = doc["since"]
app_stats.record(usage, {"seconds": 10**9, "sections": {"home": 10**9}})
doc = app_stats.read_usage(usage)
ok("one absurd flush cannot add a lifetime", doc["seconds"] == 90 + app_stats.MAX_FLUSH_SECONDS,
   doc["seconds"])
app_stats.record(usage, {"seconds": -500, "musicSeconds": "lots"})
ok("  nor take time away, or add words", app_stats.read_usage(usage)["seconds"]
   == 90 + app_stats.MAX_FLUSH_SECONDS)
ok("  and `since` never moves", app_stats.read_usage(usage)["since"] == since)
app_stats.count(usage, "print:recipe"); app_stats.count(usage, "print:recipe")
app_stats.count(usage, "")
ok("counts count", app_stats.read_usage(usage)["counts"] == {"print:recipe": 2})
with open(usage, "w") as f:
    f.write('{"seconds": "x", "sections": [1,2], "counts": {"a": -3, "b": 2}}')
bad = app_stats.read_usage(usage)
ok("a mangled file reads as what can be trusted in it",
   bad["seconds"] == 0 and bad["sections"] == {} and bad["counts"] == {"b": 2}, bad)
with open(usage, "w") as f:
    f.write("{not json")
ok("  and an unreadable one as empty, not an error", app_stats.read_usage(usage)["seconds"] == 0)
os.remove(usage)

# ---- the lock: many threads adding at once lose nothing -------------------
import threading  # noqa: E402
ts = [threading.Thread(target=lambda: [app_stats.record(usage, {"seconds": 1}) for _ in range(20)])
      for _ in range(5)]
[t.start() for t in ts]; [t.join() for t in ts]
ok("flushes racing each other lose nothing", app_stats.read_usage(usage)["seconds"] == 100,
   app_stats.read_usage(usage)["seconds"])

# ---- puzzles, from Cranium's own history ------------------------------------
pz = app_stats.puzzle_numbers({"stats": {
    "sudoku": {"sessions": [{"won": True, "time": 100}, {"won": False, "time": 50}],
               "legacy": {"plays": 10, "wins": 7}},
    "minesweeper": {"sessions": [{"won": True}]},
    "broken": "nonsense"}})
ok("completed counts wins, including history from before the upgrade",
   pz["completed"] == 9 and pz["played"] == 13, pz)
ok("  and time spent", pz["seconds"] == 150)

# ---- gather, over a fake Api -----------------------------------------------


class FakeApi:
    def photo_get_data(self): return {"photos": [1] * 43, "albums": [1, 2]}
    def music_read_json(self, name): return {"tracks": {str(i): {} for i in range(1320)},
                                             "playlists": [1], "albums": []}
    def kc_get_data(self): return {"recipes": [1] * 100, "contacts": [1], "events": []}
    def training_load(self): return {"sessions": [1] * 100, "circuits": [1] * 132, "programs": [],
                                     "exercises": {"Legs": {"a": 1, "b": 2}, "Arms": {"c": 3}}}
    def cranium_get_data(self): return {"stats": {}, "books": [1, 2]}
    def cards_read_json(self, name): raise OSError("gone")          # unreadable store
    def effects_load(self): return {"error": "no file"}             # an error answer
    def notes_list_tree(self): return [{"type": "folder", "children": [
        {"type": "note"}, {"type": "note"}, {"type": "canvas"}]}, {"type": "note"}]
    def fleeting_list(self): return [1, 2]
    def boards_list(self): return []
    def cells_list(self): return [1]
    def notebooks_list(self): return []
    def meditation_list(self): return []


st = app_stats.gather(FakeApi(), usage)
c = st["content"]
ok("Cam's own examples come out as counted: recipes, music, photos, sessions, circuits, programs",
   (c["recipes"], c["tracks"], c["photos"], c["sessions"], c["circuits"], c["programs"])
   == (100, 1320, 43, 100, 132, 0), c)
ok("exercises are counted across their categories", c["exercises"] == 3)
ok("notes and canvases are counted through folders", (c["notes"], c["canvases"]) == (3, 1))
ok("a store that throws costs only its own numbers", c["readings"] == 0 and c["recipes"] == 100)
ok("  as does one that answers with an error", c["effects"] == 0)
ok("the usage record comes along", st["usage"]["seconds"] == 100)

# ---- exports ---------------------------------------------------------------
model = {"title": "NeuroNet — App stats", "notes": ["Recorded since today."],
         "groups": [{"title": "Kitchen", "rows": [["Recipes", "100", 100]]},
                    {"title": "Usage", "rows": [["Time in the app", "400 hours", 24000]]}],
         "charts": [{"title": "Time by section", "unit": "Minutes",
                     "labels": ["Home", "Music", "Training"], "values": [300, 120, 60]}]}
try:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(app_stats.build_xlsx(model)))
    rows = list(wb["Summary"].iter_rows(values_only=True))
    ok("Excel: a summary sheet with the numbers as numbers",
       ("Recipes", 100, None) in rows and ("Time in the app", 24000, "400 hours") in rows, rows)
    ok("  and a real Excel chart for each chart", len(wb["Charts"]._charts) == 1)
except ImportError:
    print("  --    (openpyxl not installed; Excel export not checked)")
try:
    import docx
    d = docx.Document(io.BytesIO(app_stats.build_docx(model)))
    ok("Word: a table per group, as the panel words it",
       len(d.tables) == 2 and d.tables[1].rows[0].cells[1].text == "400 hours")
except ImportError:
    print("  --    (python-docx not installed; Word export not checked)")
ok("a model without groups is refused, not exported empty", not app_stats._model_ok({"rows": []}))

# ---- the wiring --------------------------------------------------------------
src = __import__("backend_src").backend_source(APP)
ok("printing counts by kind", "def open_print_document(self, html_body, kind=None)" in src
   and 'self._count("print:" + str(kind))' in src)
ok("  and Training's prints and exports count themselves",
   'self._count("print:training-%s" % kind)' in src
   and 'self._count("export:training-%s" % kind)' in src)
ui = lambda p: open(os.path.join(APP, "ui", p), encoding="utf-8").read()
labels = {
    "app.js": ['"recipe")', '"shopping-list")', '"recipe-book")'],
    "games/cranium.js": ['"word-search")', '"puzzle-book")'],
    "notes/books.js": ['"note-book"]'], "notes/guides.js": ['"notes-guide"]'],
    "money.js": ['"money-calculation")', '"money-sheet")'],
    # Stuff names its kind per list, in the list's settings.
    "stuff/stuff.js": ['printKind: "stuff-media"', 'printKind: "stuff-inventory"'],
}
missing = [f"{f}: {l}" for f, ls in labels.items() for l in ls if l not in ui(f)]
ok("every print button says what it prints", not missing, missing)
stats_js = ui("stats/stats.js")
kinds = set(re.findall(r'\["([a-z-]+)", "[^"]+"\]', stats_js.split("PRINT_KINDS = [")[1].split("];")[0]))
sent = {re.search(r'"([a-z-]+)"', l).group(1) for ls in labels.values() for l in ls}
ok("  and the panel has a name for every one of them", sent <= kinds, sent - kinds)

# Reset (Cam, 2026-10-02: "I want a reset stats feature in the app stats"):
# everything recorded starts again from now; the old record is kept beside it.
rdir = tempfile.mkdtemp()
rpath = os.path.join(rdir, "usage.json")
app_stats.record(rpath, {"seconds": 600, "musicSeconds": 60, "sections": {"notes": 600}, "day": "2026-10-01"})
app_stats.count(rpath, "print:recipe")
app_stats.launched(rpath)
kept = app_stats.reset(rpath)
fresh = app_stats.read_usage(rpath)
ok("reset: time, sections, music, prints and launches back to nothing",
   fresh["seconds"] == 0 and fresh["musicSeconds"] == 0 and not fresh["sections"]
   and not fresh["counts"] and fresh["launches"] == 0 and not fresh["days"], fresh)
ok("  recorded since now", (fresh["since"] or "")[:10] == app_stats.datetime.date.today().isoformat(), fresh["since"])
old = app_stats.read_usage(os.path.join(rdir, kept)) if kept else {}
ok("  the old record kept beside it", kept.startswith("usage.json.before-reset-")
   and old.get("seconds") == 600 and old["counts"].get("print:recipe") == 1, kept)
ok("  a reset with nothing recorded yet is fine", app_stats.reset(os.path.join(rdir, "none.json")) == "")

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
