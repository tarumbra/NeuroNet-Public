"""Cells — standalone spreadsheets under Notes.

Cam: "add another sub section in Notes called Cells ... the grid based system
found in the vault on the tool bar. However it will be a complete standalone
notes page ... It should also have the ability to import .csv /spreadsheets
and export."

The point of these checks is that Cells REUSES the grid rather than growing a
second spreadsheet: one engine, one stylesheet, one set of behaviours.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os, re, shutil, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def ui(p):
    return open(os.path.join(APP, "ui", p), encoding="utf-8").read()


print("\nCells\n")
js, app, html = ui("cells/cells.js"), ui("app.js"), ui("index.html")

# ---- where it sits and what it reuses -----------------------------------
ok("Cells is a subsection under Notes",
   '{key: "cells:list", name: "Cells"}' in app and re.search(r'cells:\s*"notes"', app) is not None)
ok("its view is not notes:*, so Notes' editor is not left on screen",
   '"cells:list"' in js and '"notes:cells"' not in app)
ok("a sheet holds the SAME model as a grid in a note",
   "SSGrid.blank(" in js and "SSGrid.serialize" in js and "SSGrid.parse" in js)
ok("and is drawn by the same grid view, not a second one",
   "SSGridView.mount" in js and "class Grid" not in js)
# Every rule, not just one: an earlier version passed while most of the
# stylesheet was still scoped to Notes' shell alone.
grid_css = re.sub(r"/\*.*?\*/", "", ui("notes/grid.css"), flags=re.S)
notes_only = [sel.strip() for sel in re.findall(r"(?m)^([^{@}]+)\{", grid_css)
              if sel.strip().startswith("#cx-shell")]
ok("every grid rule covers a note AND a sheet, not Notes alone",
   not notes_only, notes_only[:3])
# The grid's styles are written in Notes' colour names.
ok("a Cells page supplies those colour names, or borders vanish",
   re.search(r"\.ss-cells\s*\{[^}]*--border:", ui("cells/cells.css"), re.S) is not None)
ok("'Remove grid' is hidden on a sheet, where the grid IS the page",
   "this.inNote" in ui("notes/grid-view.js") and "inNote: false" in js)
ok("exports send VALUES, worked out by the same engine that draws them",
   "computeAll" in js and "SSGrid.display" in js)
ok("a sheet that cannot be read is never replaced with a blank one",
   "Couldn't open that sheet." in js and "never save over a model we cannot read" in js)

# ---- the backend --------------------------------------------------------
root = tempfile.mkdtemp(prefix="ss-sheets-")
appdir = os.path.join(root, "NeuroNet")
shutil.copytree(APP, appdir, ignore=shutil.ignore_patterns(
    "__pycache__", "node_modules", "test", "*_data", "*.log", "library_path.txt"))
os.makedirs(os.path.join(appdir, "neuronet_data"))
open(os.path.join(appdir, "neuronet_data", "neuronet.json"), "w").write("{}")
try:
    sys.argv = [os.path.join(appdir, "neuronet.py")]
    sys.path.insert(0, appdir)
    import neuronet
    api = neuronet.Api()
    sheet = {"name": "Week 1", "grid": {"v": 1, "rows": [["Lift", "Kg"], ["Squat", "100"]]}}

    ok("sheets sit beside the boards and the vault",
       os.path.basename(neuronet.cells_dir()) == "cells"
       and os.path.dirname(neuronet.cells_dir()) == os.path.dirname(neuronet.boards_dir()))
    ok("a sheet saves and reads back", api.cells_write("w1", sheet).get("ok")
       and api.cells_read("w1")["sheet"]["name"] == "Week 1")
    ok("a sheet id cannot escape its folder",
       "error" in api.cells_write("../../escape", sheet) and "error" in api.cells_read("../../x"))
    ok("saving is atomic — no half-written sheet left behind",
       not any(f.endswith(".part") for f in os.listdir(neuronet.cells_dir())))
    open(os.path.join(neuronet.cells_dir(), "broken.json"), "w").write("{oops")
    broken = [s for s in api.cells_list() if s["id"] == "broken"]
    ok("an unreadable sheet is listed with the reason, not hidden",
       broken and broken[0].get("error"), broken)

    # ---- reading files (separate from the file dialog, so it is testable) --
    d = tempfile.mkdtemp()
    csvp = os.path.join(d, "loads.csv")
    open(csvp, "w", encoding="utf-8").write('Lift,Kg,Total\nSquat,100,=B2*5\n"Bench, heavy",80\n')
    got = neuronet.read_sheet_file(csvp)
    ok("a .csv reads in, named after the file", got.get("ok") and got["name"] == "loads")
    ok("  a formula stays a formula", got["rows"][1][2] == "=B2*5")
    ok("  a comma inside a quoted cell survives", got["rows"][2][0] == "Bench, heavy")
    ok("  a ragged file squares up", all(len(r) == 3 for r in got["rows"]))
    if api.cells_formats().get("xlsx"):
        import openpyxl
        wb = openpyxl.Workbook(); ws = wb.active
        ws.append(["Lift", "Kg"]); ws.append(["Squat", 100]); ws.append(["Bench", None])
        xp = os.path.join(d, "book.xlsx"); wb.save(xp)
        x = neuronet.read_sheet_file(xp)
        ok("an .xlsx reads in, empty cells as empty text",
           x.get("ok") and x["rows"][2][1] == "")
    ok("another file type is refused plainly",
       "error" in neuronet.read_sheet_file(os.path.join(d, "notes.docx")))
    open(os.path.join(d, "empty.csv"), "w").write("")
    ok("an empty file is refused", "error" in neuronet.read_sheet_file(os.path.join(d, "empty.csv")))

    # ---- writing files ---------------------------------------------------
    rows = [["Lift", "Kg"], ["Bench, heavy", "80"]]
    out = api.cells_export("Week 1", rows, "csv")
    ok("a sheet exports to .csv", out.get("ok") and os.path.isfile(out["path"]))
    import csv as _csv
    ok("  and reads back exactly, comma and all",
       list(_csv.reader(open(out["path"], newline="", encoding="utf-8"))) == rows)
    again = api.cells_export("Week 1", rows, "csv")
    ok("  a second export never overwrites the first", again["path"] != out["path"])
    ok("an unknown format is refused", "error" in api.cells_export("x", rows, "pdf"))
    ok("nothing to export is refused", "error" in api.cells_export("x", [], "csv"))
    for f in (out.get("path"), again.get("path")):
        if f and os.path.exists(f):
            os.remove(f)
    shutil.rmtree(d, ignore_errors=True)
finally:
    shutil.rmtree(root, ignore_errors=True)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
