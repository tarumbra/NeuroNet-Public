"""Boards — where they live, and the rules that protect them.

Cam: "i want to add a boards feature, that mimics the one from the old Cam's
Collective app ... The boards feature will be a seperate sub section under the
notes main section."

Runs in a temporary copy of the app; nothing real is touched.
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


print("\nBoards\n")
ui = lambda p: open(os.path.join(APP, "ui", p), encoding="utf-8").read()
js, html, app = ui("boards/boards.js"), ui("index.html"), ui("app.js")
ed = ui("boards/editor.js")

# ---- where it sits ------------------------------------------------------
ok("Boards is a page of Creative (under Notes until 2026-10-03)",
   '{key: "boards:list", name: "Boards"}' in app
   and re.search(r'boards:\s*"creative"', app) is not None)
ok("its view is NOT notes:*, so Notes' editor is not left on screen",
   '"boards:list"' in js and '"notes:boards"' not in js and '"notes:boards"' not in app)
ok("the module is loaded and reachable from the router",
   "boards/boards.js" in html and "SS.Boards" in app and "SS.Boards = {" in js)
ok("backend calls pass their arguments as an array, as SS.Store.call expects",
   re.search(r'SS\.Store\.call\("boards_write", \[id, board\]', js) is not None)
ok("it uses the app's own dialog, not a second kind",
   "SS.shared.openDlg" in js and "bd-veil" not in js)
ok("templates are ordinary items, not a special kind",
   "TEMPLATES" in js and re.search(r'k:\s*"rect"', js) is not None)
# ...and being an ordinary item is not the same as being a usable one. The
# check above passed for months while every template board was frozen: the
# shapes had no id, so the click-to-item lookup found nothing and none of
# them could be selected, moved, recoloured or deleted. Cam: "i cannot move
# the boxes around? Is this and intended feature?"
#
# What that costs is proved properly in test_boards_move.js, which builds
# each template through the app's own function and drags something. These
# two only make sure the two halves of the fix are still here at all.
ok("  and a new board gives every shape an id, which is how it is found",
   "function boardFrom(" in js and re.search(r"map\(\(it, i\) => \(\{id:", js) is not None,
   "everything on a board is found by its id; a shape without one renders "
   'as data-id="" and nothing can pick it up')
ok("  with boards saved before that repaired when they are opened",
   "repairIds()" in ed and "it.id = uid()" in ed,
   "a fix that only helped NEW boards would leave the mind map Cam is "
   "looking at just as stuck")

# ---- the editor ---------------------------------------------------------
ok("every tool from the old app is there",
   all(f'["{t}"' in ed.replace("'", '"') or f'"{t}"' in ed for t in
       ["text", "photo", "graph", "rect", "square", "ellipse", "circle",
        "triangle", "diamond", "line", "arrow", "curve", "draw"]))
# Layer order IS the list order -- one truth, so what is on top cannot
# disagree with what is saved.
ok("layering is the order of one list, not a separate idea",
   'where === "front"' in ed and "list.push(it)" in ed and "list.unshift(it)" in ed)
ok("photos come from the app's own library, not a file dialog",
   "pickFromLibrary" in ed and "getPhotoData" in ed)
ok("graphs reuse Grid's chart drawing rather than a second one",
   "SSGrid.chartSVG" in ed)
# The SVG namespace ("http://www.w3.org/2000/svg") is required in an exported
# file and is never fetched — an earlier version of this check flagged it.
probe = ed.replace("http://www.w3.org/2000/svg", "")
ok("nothing is fetched from the network",
   not any(w in probe for w in ("fetch(", "XMLHttpRequest", "https://", "http://", "src=\"http")),
   [w for w in ("fetch(", "XMLHttpRequest", "https://", "http://") if w in probe])
# A text item used to be clickable only ON its letters.
ok("text has an invisible panel behind it, so it can be hit",
   re.search(r'case "text":.*?fill="transparent"', ed, re.S) is not None)
# The first click redraws to show the selection, so a double-click can land
# on a brand new element and be reported on the container instead.
ok("what was double-clicked is worked out from position, not the event target",
   "itemAt(...this.point(e))" in ed and "itemAt(x, y)" in ed)
ok("and editing never depends on a double-click landing",
   'id="bd-edit"' in ed and "editSelected()" in ed
   and re.search(r'e\.key === "Enter"\) \{ e\.preventDefault\(\); this\.editSelected', ed) is not None)
ok("undo keeps a copy of the page before each change",
   "push()" in ed and "this.undoStack.push(JSON.stringify(this.board.pages))" in ed)
ok("saving is debounced, and forced when the board is left",
   "this.saveTimer" in ed and "flush()" in ed and "this.flush(); this.onBack();" in ed)
ok("a board that cannot be read is never replaced with a blank one",
   "Couldn't open that board." in ui("boards/boards.js"))

# ---- pages, snapshots, exports -----------------------------------------
bd = ui("boards/boards.js")
ok("a board has pages, and a page becomes a slide",
   "addPage()" in ed and "deletePage()" in ed and 'id="bd-page-n"' in ed)
ok("a board keeps at least one page", "A board keeps at least one page." in ed)
# The line that actually STORES one. Looking for the phrase anywhere passed
# even when snapshots were moved onto a window global.
ok("snapshots live in the board itself, so they travel with it",
   "const snaps = this.board.snapshots = this.board.snapshots || [];" in ed
   and "snaps.length > 10" in ed)
ok("restoring a snapshot can be undone", re.search(r"\[data-restore\].*?this\.push\(\)", ed, re.S) is not None)
# One drawing routine: a slide cannot look different from the board.
ok("pages are drawn for export by the same code that draws them on screen",
   "function pageSVG(" in ed and "itemSVG" in ed and "pagePNG" in ed)
ok("an exported page is paper, never transparent", 'ctx.fillStyle = "#ffffff"' in ed)
ok("Export PNG puts the page in the photo library",
   "addPhotoFromDataUrl" in ed and "exportPNG()" in ed)
# Exporting used to re-mount the open section, throwing Cam out of the editor.
ok("adding a photo in the background does not tear down what is open",
   'if (sectionOf(view) === "photos") render();' in app)
ok("PowerPoint asks whether this machine can write one first",
   "boards_formats" in bd and "python-pptx" in bd)
ok("a board that cannot be read is skipped, not fatal to the whole export",
   "a broken board is skipped" in bd)

# ---- the backend --------------------------------------------------------
root = tempfile.mkdtemp(prefix="ss-boards-")
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
    board = {"name": "UI", "w": 1600, "h": 1000, "paper": "grid",
             "pages": [{"items": [{"k": "text", "x": 1, "y": 2, "text": "hi"}]}, {"items": []}]}

    # Compared as paths, not by looking for the word "boards" in a string:
    # the temporary folder for this test is itself called ss-boards-…, so a
    # substring check passed nothing and failed everything.
    vault = neuronet.notes_backend.vault_dir()
    ok("boards sit beside the vault, not inside it",
       os.path.basename(neuronet.boards_dir()) == "boards"
       and os.path.dirname(neuronet.boards_dir()) == os.path.dirname(vault)
       and not neuronet.boards_dir().startswith(vault + os.sep))
    ok("a board saves and reads back", api.boards_write("b1", board).get("ok")
       and api.boards_read("b1")["board"]["name"] == "UI")
    listed = api.boards_list()[0]
    ok("the list counts items and pages across every page",
       listed["items"] == 1 and listed["pages"] == 2, listed)
    ok("a board id cannot escape its folder",
       "error" in api.boards_write("../../escape", board)
       and "error" in api.boards_read("../../../etc/passwd"))
    ok("saving is atomic — no half-written board is left behind",
       not any(f.endswith(".part") for f in os.listdir(neuronet.boards_dir())))
    # A board that cannot be read must be SEEN, not silently missing.
    open(os.path.join(neuronet.boards_dir(), "broken.json"), "w").write("{oops")
    broken = [b for b in api.boards_list() if b["id"] == "broken"]
    ok("an unreadable board is still listed, with the reason",
       broken and broken[0].get("error"), broken)
    ok("and reading it says so rather than replacing it",
       "error" in api.boards_read("broken")
       and open(os.path.join(neuronet.boards_dir(), "broken.json")).read() == "{oops")
    ok("deleting a board that is already gone is not an error",
       api.boards_delete("nope").get("ok"))

    # ---- the export chain ----------------------------------------------
    # Exporting a photo to the PC already existed: the photo viewer's own
    # Export button, backed by photo_export. A second way to do the same
    # thing was written here and then removed -- two paths to one action
    # drift apart, and the one Cam already uses is the one to keep.
    from PIL import Image
    Image.new("RGB", (30, 20), (90, 140, 90)).save(
        os.path.join(neuronet.photos_dir(), "board.png"))
    first = api.photo_export(os.path.basename("board.png"), "board.png")
    ok("a photo still exports out to the PC, through the one existing path",
       not first.get("error"), first)
    ok("and Boards adds no second way to do it",
       "photo_export_to_pc" not in __import__("backend_src").backend_source(APP))
    for cand in (first.get("path"), os.path.join(os.path.expanduser("~"), "Desktop", "board.png"),
                 os.path.join(os.path.expanduser("~"), "board.png")):
        if cand and os.path.exists(cand):
            os.remove(cand)

    # ---- PowerPoint -----------------------------------------------------
    import base64, io as _io
    def png(w, h):
        b = _io.BytesIO(); Image.new("RGB", (w, h), (200, 80, 80)).save(b, "PNG")
        return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()

    ok("the app says whether this machine can write PowerPoint at all",
       isinstance(api.boards_formats().get("pptx"), bool))
    if api.boards_formats().get("pptx"):
        deck = api.boards_export_pptx("Test deck", [{"dataUrl": png(1600, 1000)},
                                                    {"dataUrl": png(1600, 1000)}])
        ok("one slide per page", deck.get("slides") == 2, deck)
        from pptx import Presentation
        prs = Presentation(deck["path"])
        pic = [sh for sh in prs.slides[0].shapes if sh.shape_type == 13][0]
        ok("  the board is fitted whole, not stretched to 16:9",
           abs((pic.width / pic.height) - 1.6) < 0.01)
        again = api.boards_export_pptx("Test deck", [{"dataUrl": png(800, 500)}])
        ok("  a second export never overwrites the first",
           again.get("ok") and again["path"] != deck["path"])
        for f in (deck.get("path"), again.get("path")):
            if f and os.path.exists(f):
                os.remove(f)
    ok("nothing chosen is refused plainly", "error" in api.boards_export_pptx("x", []))

finally:
    shutil.rmtree(root, ignore_errors=True)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
