"""Stuff's files and exports, and the letterheads in Word and Excel.

Cam: "I want the print out to also match the others however contain the
collection icon file ... Also i want to be able to export to excell ... please
replace the print, export icon for coach cam to this one. As before please
make them match all the prints you have done before."

The real Api, pointed at a scratch folder; HOME pointed at another, so no
export ever lands on the real desktop.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import importlib.util, io, json, os, sys, tempfile, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nStuff: files, exports and letterheads\n")
spec = importlib.util.spec_from_file_location("nn", os.path.join(APP, "neuronet.py"))
nn = importlib.util.module_from_spec(spec)
sys.modules["nn"] = nn
spec.loader.exec_module(nn)
import print_header as ph  # noqa: E402


class Fake(nn.Api):
    def __init__(self, root):
        self._root = root

    def stuff_file(self):
        return os.path.join(self._root, "stuff.json")


# ---- the logos ----------------------------------------------------------------
from PIL import Image  # noqa: E402
for name, what in (("collection.png", "the collection mark"), ("coachcam-192.png", "Coach Cam's new mark"),
                   ("neuronet-mark.png", "NeuroNet's mark, as a picture for Word and Excel")):
    path = os.path.join(APP, "icons", name)
    ok(what + " is in the app", os.path.isfile(path))
    if os.path.isfile(path):
        with Image.open(path) as im:
            rgba = im.convert("RGBA")
            corner = rgba.getpixel((0, 0))[3]
            ok("  on a transparent ground, so it never prints as a black square", corner == 0, corner)
            ok("  and small enough to travel inside every page", os.path.getsize(path) < 60 * 1024,
               os.path.getsize(path))

# ---- inventories on disk --------------------------------------------------------
with tempfile.TemporaryDirectory() as tmp:
    api = Fake(tmp)
    ok("no inventories yet is an empty list, not an error", api.stuff_load() == {"inventories": []})
    doc = {"inventories": [{"id": "i1", "name": "Garage",
                            "items": [{"id": "a", "title": "Drill", "type": "general", "quantity": "2"}],
                            "types": []}]}
    ok("it saves", api.stuff_save(doc).get("ok") is True)
    ok("  and reads back what went in", api.stuff_load()["inventories"][0]["items"][0]["title"] == "Drill")
    ok("  leaving no temporary file", os.listdir(tmp) == ["stuff.json"], os.listdir(tmp))
    with open(api.stuff_file(), "w") as f:
        f.write("{broken")
    got = api.stuff_load()
    ok("a damaged file is reported", bool(got.get("error")))
    with open(api.stuff_file()) as f:
        ok("  and left exactly as it was", f.read() == "{broken")

# ---- exports ---------------------------------------------------------------------
payload = {
    "title": "Media", "subtitle": "3 items · CD, DVD · 26 September 2026",
    "logo": "collection.png", "logoName": "collection",
    "columns": [{"key": "title", "label": "Title"}, {"key": "creator", "label": "By"},
                {"key": "year", "label": "Year"}],
    "sections": [{"name": "CD", "items": [{"title": "Abbey Road", "creator": "The Beatles", "year": ""}]},
                 {"name": "DVD", "items": [{"title": "aliens", "creator": "", "year": "1986"},
                                           {"title": "Zulu", "creator": "", "year": "1964"}]}],
}
with tempfile.TemporaryDirectory() as home:
    os.environ["HOME"] = home
    os.makedirs(os.path.join(home, "Desktop"))
    api = nn.Api()

    res = api.stuff_export("xlsx", payload)
    ok("Excel is written", res.get("ok") is True, res)
    import openpyxl
    wb = openpyxl.load_workbook(res["path"])
    ws = wb["Media"]
    ok("  opening on the letterhead: the list's name centred at the top", ws["B1"].value == "Media")
    ok("  with NeuroNet's mark and the collection mark on it", len(ws._images) == 2, len(ws._images))
    rows = [r for r in ws.iter_rows(min_row=5, values_only=True)]
    ok("  then the columns, and every item in the order it was given",
       [r[:2] for r in rows] == [("Type", "Title"), ("CD", "Abbey Road"), ("DVD", "aliens"), ("DVD", "Zulu")],
       rows)
    ok("  filterable, with the heading row kept on screen", ws.auto_filter.ref and ws.freeze_panes == "A6")
    ok("  and a tab per section, each on its own letterhead",
       wb.sheetnames == ["Media", "CD", "DVD"] and len(wb["DVD"]._images) == 2, wb.sheetnames)

    res = api.stuff_export("docx", payload)
    ok("Word is written", res.get("ok") is True, res)
    import docx
    d = docx.Document(res["path"])
    head = d.tables[0].rows[0].cells
    ok("  on the letterhead: NeuroNet left, the title centred, collection right",
       head[1].paragraphs[0].text == "Media" and "collection" in head[2].text, [c.text for c in head])
    pics = d.tables[0]._element.xpath(".//pic:pic")
    ok("  with both marks as real pictures, not \"[image]\"", len(pics) == 2 and "[image]" not in
       "\n".join(p.text for p in d.paragraphs), len(pics))
    body = [p.text for p in d.paragraphs if p.text.strip()]
    ok("  then each section and its items, in order, numbered afresh in each",
       body[:5] == ["CD  (1)", "1.  Abbey Road  —  The Beatles", "DVD  (2)", "1.  aliens  —  1986",
                    "2.  Zulu  —  1964"],
       body[:5])
    with zipfile.ZipFile(res["path"]) as z:
        ok("  under the green rule", "5FA665" in z.read("word/document.xml").decode("utf-8"))

    ok("an empty export says so rather than writing a blank file",
       bool(api.stuff_export("xlsx", {"sections": []}).get("error")))
    ok("exporting twice never writes over the first file",
       api.stuff_export("xlsx", payload)["path"] != res["path"])

# ---- Coach Cam's Word exports match the printouts ----------------------------------
import training_documents as td  # noqa: E402
session = {"name": "Monday — Lower", "blocks": [], "exercises": []}
try:
    d = td.build_session_docx(session)
    buf = io.BytesIO(); d.save(buf); d = docx.Document(io.BytesIO(buf.getvalue()))
    cells = d.tables[0].rows[0].cells
    # since the 2026-10-05 refresh the letterhead names the kind of sheet, and the
    # session's own name is the title bar just below it (not printed twice)
    ok("a Coach Cam Word export opens on the same letterhead: the kind centred, the name below",
       cells[1].paragraphs[0].text == "Training session"
       and any(p.text == "Monday — Lower" for p in d.paragraphs + [p for t in d.tables[1:] for r in t.rows for c in r.cells for p in c.paragraphs]),
       [c.text for c in cells])
    ok("  NeuroNet's mark on the left, Coach Cam's mark and name on the right",
       len(cells[0]._element.xpath(".//pic:pic")) == 1 and len(cells[2]._element.xpath(".//pic:pic")) == 1
       and cells[2].text.strip() == "coaching", [c.text for c in cells])
except Exception as e:  # pragma: no cover - reported, not hidden
    ok("a Coach Cam Word export builds", False, repr(e))
html = td._print_header_html("Monday — Lower")
ok("and the printed sheet names it the same way", "coaching" in html and "coachcam-192.png" not in html
   and "data:image/png;base64," in html)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
