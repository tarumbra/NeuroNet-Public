"""Scrapbook and the desktop Drop zone -- the backend, and the card's wiring.

Cam (2026-10-02): "Scrapbook, which should have the same toolbar as boards,
but also contain a collapseable scrapbook materials ... it will have a cover"
-- and of the Drop zone idea ("Drag a file onto the desktop: pictures go to
Photos, PDFs and EPUBs to Ebooks, text to Fleeting"): "i like your drop zone
so please do that one as well."

Runs in a temporary copy of the app; nothing real is touched. The page side
is test_scrapbook.js.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import base64, json, re, shutil, struct, sys, tempfile, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def png(w, h):
    """A real (tiny, all-white) PNG."""
    raw = b"".join(b"\x00" + b"\xff\xff\xff\xff" * w for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


print("\nScrapbook and the Drop zone\n")
src = lambda p: open(os.path.join(APP, p), encoding="utf-8").read()

# ---- wiring -------------------------------------------------------------------
app, html = src("ui/app.js"), src("ui/index.html")
ok("Scrapbook is the first page of Creative, before Boards (since 2026-10-03)",
   re.search(r'\{key: "creative", name: "Creative", children: \[\s*/\*.*?\*/\s*\{key: "scrapbook:shelf", name: "Scrapbook"\},'
             r'\s*/\*.*?\*/\s*\{key: "boards:list", name: "Boards"\}', app, re.S) is not None)
ok("its views are filed under Creative and routed to SS.Scrapbook",
   'scrapbook: "creative"' in app and "SS.Scrapbook" in app and '"scrapbook:shelf": "i-scrapbook"' in app)
ok("the page loads the materials before the scrapbook, after the Boards editor",
   html.index("boards/editor.js") < html.index("scrapbook/materials.js") < html.index("scrapbook/scrapbook.js")
   and "scrapbook/scrapbook.css" in html and 'id="i-scrapbook"' in html)
ok("the Boards editor draws scrapbook materials and per-page paper (one drawing for screen and export)",
   "SS.ScrapArt.itemSVG(it)" in src("ui/boards/editor.js")
   and "paperSVG(board, w, h, (board.pages || [])[pageIndex])" in src("ui/boards/editor.js"))


# ---- the backend --------------------------------------------------------------
root = tempfile.mkdtemp(prefix="nn-scrap-")
appdir = os.path.join(root, "NeuroNet")
shutil.copytree(APP, appdir, ignore=shutil.ignore_patterns(
    "__pycache__", "node_modules", "test", "*_data", "*.log", "library_path.txt", "Movies"))
os.makedirs(os.path.join(appdir, "neuronet_data"))
open(os.path.join(appdir, "neuronet_data", "neuronet.json"), "w").write("{}")
try:
    sys.argv = [os.path.join(appdir, "neuronet.py")]
    sys.path.insert(0, appdir)
    import neuronet
    api = neuronet.Api()
    ok("this run uses the temporary copy, not Cam's data",
       neuronet.data_dir().startswith(root), neuronet.data_dir())

    book = {"kind": "scrapbook", "name": "Summer", "w": 1500, "h": 1500, "paper": "kraft",
            "cover": {"material": "fur", "colour": "#d8c3a5", "title": "Summer"},
            "pages": [{"paper": "kraft", "items": [{"id": "a", "k": "tape", "style": "dots"},
                                                   {"id": "b", "k": "frame", "photo": "beach.jpg"}]},
                      {"paper": "linen", "paperColour": "#dcebf5", "items": []}]}
    folder = neuronet.scrapbooks_dir()
    ok("scrapbooks sit beside the boards, not in the vault",
       os.path.dirname(folder) == os.path.dirname(neuronet.boards_dir())
       and not folder.startswith(neuronet.notes_backend.vault_dir() + os.sep))
    ok("a scrapbook saves and reads back, paper per page and all",
       api.scrapbooks_write("Summer", book).get("ok")
       and api.scrapbooks_read("Summer")["book"]["pages"][1]["paper"] == "linen")
    shelf = api.scrapbooks_list()
    ok("the shelf has its cover, pages and items",
       shelf and shelf[0]["cover"]["material"] == "fur" and shelf[0]["pages"] == 2 and shelf[0]["items"] == 2, shelf)
    ok("a scrapbook id cannot escape its folder",
       "error" in api.scrapbooks_write("../../x", book) and "error" in api.scrapbooks_read("../../../etc/passwd"))
    ok("saving is atomic -- nothing half-written is left", not any(f.endswith(".part") for f in os.listdir(folder)))
    open(os.path.join(folder, "broken.json"), "w").write("{oops")
    broken = [b for b in api.scrapbooks_list() if b["id"] == "broken"]
    ok("an unreadable scrapbook is still on the shelf, with the reason", broken and broken[0].get("error"))
    ok("and reading it never replaces it",
       "error" in api.scrapbooks_read("broken") and open(os.path.join(folder, "broken.json")).read() == "{oops")
    ok("deleting one", api.scrapbooks_delete("broken").get("ok") and not os.path.exists(os.path.join(folder, "broken.json")))

    # renaming a photo reaches the scrapbooks too (they name photos like boards do)
    api.photo_refs_rename({"beach.jpg": "Beach day.jpg"})
    ok("a renamed photo is renamed inside scrapbooks as well",
       api.scrapbooks_read("Summer")["book"]["pages"][0]["items"][1]["photo"] == "Beach day.jpg")

    # ---- the sticker book
    url = "data:image/png;base64," + base64.b64encode(png(30, 20)).decode()
    added = api.scrapbook_sticker_add("Dog", url)
    ok("a sticker goes into the sticker book", added.get("ok") and added.get("id"), added)
    got = api.scrapbook_stickers()["stickers"]
    ok("and comes back with its name, size and picture",
       len(got) == 1 and got[0]["name"] == "Dog" and (got[0]["w"], got[0]["h"]) == (30, 20)
       and got[0]["dataUrl"] == url, got)
    ok("only a PNG is taken", "error" in api.scrapbook_sticker_add("x", "data:image/jpeg;base64,AAAA")
       and "error" in api.scrapbook_sticker_add("x", "data:image/png;base64,bm90IGEgcG5n"))
    ok("a sticker id can't be used to delete other files",
       "error" in api.scrapbook_sticker_delete("../stickers") and "error" in api.scrapbook_sticker_delete("stickers.json"))
    ok("taking it out of the book", api.scrapbook_sticker_delete(added["id"]).get("ok")
       and api.scrapbook_stickers()["stickers"] == []
       and not os.path.exists(os.path.join(folder, "stickers", added["id"] + ".png")))
    ok("the sticker book is not listed as a scrapbook", all(b["id"] != "stickers" for b in api.scrapbooks_list()))

    ok("App stats counts scrapbooks", "scrapbooks" in src("app_stats.py") and 'row("Scrapbooks"' in src("ui/stats/stats.js"))

finally:
    shutil.rmtree(root, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
