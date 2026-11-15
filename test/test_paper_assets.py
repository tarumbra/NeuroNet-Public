"""Assets, notebook covers and saved papers -- the backend (paper_assets.py
and the Api doors to it), and the wiring of Vault -> Paper creator / Assets.

Cam (2026-10-03): "please create me a paper creator ... Also it will have a
cover creator ... A5 - A4 or custom size (i create pocket notebooks)" and
"lets add a new feature called assets, This is where i can go in and upload
new assets into their respective categories or create them."

Runs in a temporary copy of the app; nothing real is touched. The pages are
test_paper.js and test_assets.js.
"""
import os
# Never Cam's real data (see test_test_isolation.py).
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
    raw = b"".join(b"\x00" + b"\x00\x00\x00\x00" * w for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def jpeg_header(w, h):
    """Enough of a JPEG for its size to be read (SOI, an APP0, SOF0)."""
    app0 = b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, h, w, 1) + b"\x01\x11\x00"
    return b"\xff\xd8" + app0 + sof + b"\xff\xd9"


durl = lambda kind, data: "data:%s;base64,%s" % (kind, base64.b64encode(data).decode())
src = lambda p: open(os.path.join(APP, p), encoding="utf-8").read()

print("\nPaper creator, covers and Assets -- backend and wiring\n")

# ---- wiring -------------------------------------------------------------------
app, html = src("ui/app.js"), src("ui/index.html")
creative = re.search(r'\{key: "creative", name: "Creative", children: \[(.*?)\n  \]\},', app, re.S)
ok("Creative is a main section of its own: Scrapbook, Boards, Paper creator, Pixel art, Vector, Assets",
   creative is not None and re.findall(r'\{key: "([a-z]+:[a-z]+)"', creative.group(1))
   == ["scrapbook:shelf", "boards:list", "paper:make", "pixel:studio", "vector:studio", "assets:library"])
ok("  in the left menu after Scribe (the Vault, renamed; its key is still notes)",
   '"notes", "creative", "code"' in app and '{key: "notes", name: "Scribe"' in app and 'creative: {icon: "i-creative"' in app
   and 'id="i-creative"' in html)
ok("  with its own key, Super+Alt+B, in the bindings, the launcher and the Omarchy menu",
   'o.bind("SUPER + ALT + B", "NeuroNet Creative", "neuronet-quick creative")' in src("system/hypr/bindings.lua.block")
   and 'key: "creative"' in src("system/omarchy/plugins/neuronet.launcher/BarWidget.qml")
   and '("creative", "Creative"' in src("neuronet-menu"))
ok("their views are filed under the Vault, with icons, and routed",
   'paper: "creative", assets: "creative"' in app and "SS.Paper, SS.Assets" in app
   and '"paper:make": "i-paper"' in app and '"assets:library": "i-assets"' in app
   and 'id="i-paper"' in html and 'id="i-assets"' in html)
ok("scripts load in order: editor, materials, clip art, scrapbook, assets, paper",
   html.index("boards/editor.js") < html.index("scrapbook/materials.js") < html.index("assets/clipart.js")
   < html.index("scrapbook/scrapbook.js") < html.index("assets/assets.js") < html.index("paper/paper.js")
   and "paper/paper.css" in html and "assets/assets.css" in html)
stats = src("ui/stats/stats.js")
ok("App stats can name paper and cover prints",
   '["paper", "Paper"]' in stats and '["cover", "Notebook covers"]' in stats)
ok("the paper, cover and scrapbook prints say what they are (App stats names each)",
   '"paper")' in src("ui/paper/paper.js") and 'kind: "cover"' in src("ui/paper/paper.js")
   and 'kind: "scrapbook"' in src("ui/scrapbook/scrapbook.js") and '["scrapbook", "Scrapbook pages"]' in stats)

sys.path.insert(0, APP)
import paper_assets as pa                                    # noqa: E402

cats_js = re.findall(r'\["(\w+)", "([^"]+)"\]', re.search(r"const CATEGORIES = \[(.*?)\];", src("ui/assets/assets.js"), re.S).group(1))
ok("the page's categories are the backend's, in the same order", cats_js == pa.CATEGORIES, cats_js)

# ---- sizes from headers ---------------------------------------------------------
ok("a PNG's size", pa.picture_size(png(7, 5), "png") == (7, 5))
ok("a JPEG's size", pa.picture_size(jpeg_header(640, 480), "jpg") == (640, 480))
ok("an SVG's size from its viewBox",
   pa.picture_size(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"></svg>', "svg") == (120, 80))
ok("a GIF's size", pa.picture_size(b"GIF89a" + struct.pack("<HH", 33, 21) + b"\x00" * 8, "gif") == (33, 21))
ok("nothing readable is (0, 0), not a crash", pa.picture_size(b"rubbish", "png") == (0, 0))

# ---- the backend, in a temporary copy ---------------------------------------------
root = tempfile.mkdtemp(prefix="nn-paper-")
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
    ok("this run uses the temporary copy, not Cam's data", neuronet.data_dir().startswith(root), neuronet.data_dir())
    folder = neuronet.assets_dir()
    ok("assets live in the data folder (so Export & import carries them)",
       folder == os.path.join(neuronet.data_dir(), "assets"))

    # assets
    empty = api.assets_list()
    ok("an empty library lists the categories and no assets",
       empty["assets"] == [] and [c["key"] for c in empty["categories"]] == [k for k, _ in pa.CATEGORIES])
    r1 = api.asset_add("clipart", "Owl", durl("image/png", png(40, 30)))
    ok("a PNG goes into Clip art", r1.get("ok") and r1["asset"]["cat"] == "clipart"
       and (r1["asset"]["w"], r1["asset"]["h"]) == (40, 30), r1)
    ok("  kept as the file it was, beside the index",
       open(os.path.join(folder, r1["id"] + ".png"), "rb").read() == png(40, 30)
       and json.load(open(os.path.join(folder, "assets.json")))["assets"][0]["id"] == r1["id"])
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 20"><rect width="50" height="20"/></svg>'
    r2 = api.asset_add("tapes", "Washi", "data:image/svg+xml," + svg.decode())
    ok("an SVG (even not base64) goes into Tapes", r2.get("ok") and r2["asset"]["ext"] == "svg" and r2["asset"]["w"] == 50, r2)
    ok("the wrong kind of file is refused in words",
       "PNG, JPEG" in api.asset_add("clipart", "x", "data:text/html;base64,PGI+")["error"])
    ok("a damaged picture is refused", "damaged" in api.asset_add("clipart", "x", durl("image/png", b"not a png"))["error"])
    ok("an unknown category is refused", "categor" in api.asset_add("hats", "x", durl("image/png", png(2, 2)))["error"])
    ok("a picture over 25 MB is refused", "too big" in pa.Assets(folder).add(
       "clipart", "big", durl("image/png", png(2, 2) + b"\0" * (26 * 1024 * 1024)))["error"])
    lst = api.assets_list()["assets"]
    ok("the list is newest first, and carries no pictures (they're fetched one by one)",
       [a["name"] for a in lst] == ["Washi", "Owl"] and all("dataUrl" not in a for a in lst))
    got = api.asset_data(r1["id"])
    ok("one asset's picture comes back as a data URL", got["dataUrl"] == durl("image/png", png(40, 30)))
    ok("an asset id can't reach outside the folder",
       "error" in api.asset_data("../assets") and "error" in api.asset_update("../../x", {"name": "y"}))
    up = api.asset_update(r1["id"], {"name": "Barn owl", "cat": "stickers"})
    ok("rename and move to another category", up.get("ok") and api.assets_list()["assets"][1]["name"] == "Barn owl"
       and api.assets_list()["assets"][1]["cat"] == "stickers")
    design = {"kind": "asset", "w": 1000, "h": 1000, "pages": [{"items": [{"id": "a", "k": "clip", "art": "leaf"}]}]}
    r3 = api.asset_add("clipart", "My leaf", durl("image/png", png(10, 12)), design)
    ok("one made in NeuroNet keeps its design beside it",
       r3.get("ok") and api.asset_design(r3["id"])["design"]["pages"][0]["items"][0]["art"] == "leaf"
       and api.assets_list()["assets"][0]["design"] is True)
    ok("an uploaded one has no design to open", "wasn't made in NeuroNet" in api.asset_design(r2["id"])["error"])
    api.asset_update(r3["id"], {"dataUrl": durl("image/png", png(20, 24)), "design": {**design, "w": 900}})
    ok("saving it again replaces the picture and the design",
       api.asset_data(r3["id"])["w"] == 20 and api.asset_design(r3["id"])["design"]["w"] == 900)
    api.asset_update(r2["id"], {"dataUrl": durl("image/png", png(3, 3))})
    ok("a new picture of another type replaces the old file, not beside it",
       not os.path.exists(os.path.join(folder, r2["id"] + ".svg")) and os.path.exists(os.path.join(folder, r2["id"] + ".png")))
    ok("delete takes the picture, the design and the entry",
       api.asset_delete(r3["id"]).get("ok") and not os.path.exists(os.path.join(folder, r3["id"] + ".png"))
       and not os.path.exists(os.path.join(folder, r3["id"] + ".design.json"))
       and all(a["id"] != r3["id"] for a in api.assets_list()["assets"]))
    os.remove(os.path.join(folder, r2["id"] + ".png"))
    ok("an asset whose file has gone isn't offered", all(a["id"] != r2["id"] for a in api.assets_list()["assets"]))
    ok("nothing half-written is left", not any(f.endswith(".part") for f in os.listdir(folder)))

    # in progress / completed works (Cam, 2026-10-04)
    rw = api.asset_add("game", "Slime", durl("image/png", png(4, 4)), {"kind": "pixel", "w": 4, "h": 4}, [4, 4], "wip")
    got = next(a for a in api.assets_list()["assets"] if a["id"] == rw["id"])
    ok("a sprite saved in progress is kept as in progress, and known as pixel art",
       got["stage"] == "wip" and got["kind"] == "pixel" and got["cat"] == "game", got)
    ok("an upload is a completed work", next(a for a in api.assets_list()["assets"] if a["id"] == r1["id"])["stage"] == "done")
    ok("moving it to Completed works", api.asset_update(rw["id"], {"stage": "done"}).get("ok")
       and next(a for a in api.assets_list()["assets"] if a["id"] == rw["id"])["stage"] == "done")
    ok("there are only two places", "in progress or completed" in api.asset_update(rw["id"], {"stage": "later"})["error"]
       and "in progress or completed" in api.asset_add("game", "x", durl("image/png", png(2, 2)), None, None, "maybe")["error"])
    ok("Game assets is a category", "game" in pa.CATEGORY_KEYS)
    api.asset_delete(rw["id"])

    # pixel-art palettes and exported files
    ok("no palettes of your own yet", api.pixel_palettes() == {"palettes": []})
    pals = [{"name": "Swamp", "colours": ["#1a2b3c", "#aabbcc", "not a colour"]}]
    ok("palettes save, and only real colours are kept",
       api.pixel_palettes_save(pals).get("ok") and api.pixel_palettes()["palettes"] == [{"name": "Swamp", "colours": ["#1a2b3c", "#aabbcc"]}])
    ok("they live with the assets", os.path.isfile(os.path.join(folder, "palettes.json")))
    out_png = os.path.join(root, "out", "slime.png")
    os.makedirs(os.path.dirname(out_png))
    wr = pa.write_b64_file(out_png, base64.b64encode(png(3, 3)).decode())
    ok("an export is written where it was asked, whole", wr.get("ok") and open(out_png, "rb").read() == png(3, 3)
       and not os.path.exists(out_png + ".part"))
    ok("a damaged export isn't written", "error" in pa.write_b64_file(out_png + "2", "%%%"))
    ok("saving an export needs a window (the save dialog)", "window" in api.pixel_save_file("x.png", "AA==")["error"])

    # importing a pack from files
    pack = os.path.join(root, "pack")
    os.makedirs(pack)
    open(os.path.join(pack, "flower_pink-01.png"), "wb").write(png(9, 9))
    open(os.path.join(pack, "photo.jpeg"), "wb").write(jpeg_header(100, 50))
    open(os.path.join(pack, "readme.txt"), "w").write("thanks for buying")
    open(os.path.join(pack, "broken.png"), "wb").write(b"nope")
    res = pa.Assets(folder).add_files("clipart", sorted(os.path.join(pack, f) for f in os.listdir(pack)))
    names = {a["name"] for a in api.assets_list()["assets"]}
    ok("a pack of files: the pictures come in, named from their files",
       len(res["added"]) == 2 and "flower pink 01" in names and "photo" in names, (res, names))
    ok("and the rest are listed with why, not dropped silently",
       sorted(s["name"] for s in res["skipped"]) == ["broken.png", "readme.txt"], res["skipped"])
    ok("importing asks for files only for a real category, and needs a window",
       "categor" in api.assets_import_files("hats")["error"] and "window" in api.assets_import_files("clipart")["error"])

    # saved papers
    ok("no saved papers yet", api.paper_designs() == {"designs": []})
    ds = [{"name": "Pocket dots", "design": {"kind": "dot", "size": "pocket", "spacing": 5}}]
    ok("papers save and read back", api.paper_designs_save(ds).get("ok") and api.paper_designs()["designs"] == ds)
    ok("they live with the notes", os.path.isfile(os.path.join(neuronet.notes_dir(), "paper", "designs.json")))
    ok("rubbish isn't saved", "error" in api.paper_designs_save("x") and api.paper_designs()["designs"] == ds)

    # covers
    cover = {"kind": "cover", "name": "Field notes", "w": 890, "h": 700, "mm": 5,
             "spec": {"size": "pocket", "layout": "wrap", "spine": 0, "bleed": 0, "material": "kraft"},
             "pages": [{"items": [{"id": "t", "k": "text", "x": 500, "y": 300, "text": "Field notes"}]}]}
    ok("a cover saves and reads back", api.covers_write("Field notes", cover).get("ok")
       and api.covers_read("Field notes")["book"]["spec"]["layout"] == "wrap")
    ok("a renamed photo is renamed inside covers too (like boards and scrapbooks)",
       any(os.sep + "covers" + os.sep in p for p in api._photo_ref_paths()))
    shelf = api.covers_list()
    ok("the covers shelf has its size and layout", shelf and shelf[0]["spec"]["size"] == "pocket" and shelf[0]["pages"] == 1, shelf)
    ok("covers sit beside the scrapbooks", os.path.dirname(neuronet.covers_dir()) == os.path.dirname(neuronet.scrapbooks_dir()))
    ok("a cover id can't escape its folder", "error" in api.covers_write("../x", cover) and "error" in api.covers_read("../../etc/passwd"))
    open(os.path.join(neuronet.covers_dir(), "broken.json"), "w").write("{oops")
    ok("an unreadable cover is still listed, with the reason",
       any(c["id"] == "broken" and c.get("error") for c in api.covers_list()))
    ok("deleting a cover", api.covers_delete("broken").get("ok") and api.covers_delete("Field notes").get("ok")
       and api.covers_list() == [])
finally:
    shutil.rmtree(root, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
