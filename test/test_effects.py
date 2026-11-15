"""Personal Effects — the store, and what comes out of it.

Cam: "a new sub section under the home main section ... called Personal
Effects. This should be a data base where i can add new item ... they then
need to appear under their respective names in lists and have the ability
to be searched, to be exported to excel and doc but it has to be in
alphabetical order and be divided into each section."

WHAT THIS FILE COVERS is the Python half: the file the collection lives in,
and the spreadsheet and document that come out of it. The ordering, the
grouping, the section picking and the duplicate warning are decided in the
interface and are tested in test_effects.js, against the real app.

THE FILE IS THE COLLECTION. A photo library can be rebuilt from the photos
on disk; this cannot -- a thousand titles typed in by hand exist nowhere
else. So the two things that matter most here are that a save is atomic
(a half-written file would read as most of the collection having gone) and
that an unreadable file is never silently replaced with an empty one.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import os
import sys
import tempfile
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(HERE)
sys.path.insert(0, APP)

passed = failed = 0
lines = []


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        lines.append("  ok    " + name)
    else:
        failed += 1
        lines.append("  FAIL  " + name + (("\n          " + detail) if detail else ""))


import importlib.util
spec = importlib.util.spec_from_file_location("nn", os.path.join(APP, "neuronet.py"))
nn = importlib.util.module_from_spec(spec)
sys.modules["nn"] = nn
spec.loader.exec_module(nn)


class Fake(nn.Api):
    """The real Api, pointed at a scratch folder. The methods under test are
    the app's own; only where the data lives is different."""
    def __init__(self, root):
        self._root = root

    def effects_file(self):
        return os.path.join(self._root, "personal_effects.json")

    def _media_movies_root(self):
        return os.path.join(self._root, "Movies")      # never Cam's real films


def desktop_into(tmp):
    """_to_desktop writes to the desktop. Point HOME at a scratch folder so
    a test run never puts files on the real one."""
    os.environ["HOME"] = tmp
    os.makedirs(os.path.join(tmp, "Desktop"), exist_ok=True)


# ---------------------------------------------------------------- the file
with tempfile.TemporaryDirectory() as tmp:
    api = Fake(tmp)

    got = api.effects_load()
    ok("a first run opens an empty collection, not an error",
       got == {"items": [], "types": []}, str(got))

    doc = {"items": [{"id": "i1", "title": "Aliens", "type": "vhs",
                      "year": "1986", "notes": ""}],
           "types": [{"id": "claserdisc-ab12", "name": "LaserDisc"}]}
    ok("it saves", api.effects_save(doc).get("ok") is True)
    back = api.effects_load()
    # Media v2 (15 Nov 2026): an old "vhs" item reads back as a film tagged
    # VHS, and the custom type becomes a format, once, with a backup kept.
    ok("  and reads back what went in, in Media v2's shape",
       back["items"] == [{"id": "i1", "title": "Aliens", "type": "film", "year": "1986", "notes": "", "formats": ["VHS"]}]
       and back["types"] == [] and back.get("mediaVersion") == 2, str(back))
    ok("  the file as it was is kept beside it",
       os.path.isfile(os.path.join(tmp, "personal_effects.json.before-media-v2")))

    ok("  through a real file on disk",
       os.path.isfile(os.path.join(tmp, "personal_effects.json")))
    ok("  and leaves no temporary file behind",
       not os.path.exists(os.path.join(tmp, "personal_effects.json.tmp")),
       "a .tmp left lying about means a save did not finish")

    # A file that cannot be read must NOT be replaced with a blank one.
    with open(os.path.join(tmp, "personal_effects.json"), "w") as f:
        f.write("{ this is not json")
    broken = api.effects_load()
    ok("a damaged file is reported, not silently emptied",
       broken.get("error") and broken["items"] == [], str(broken)[:120])
    with open(os.path.join(tmp, "personal_effects.json")) as f:
        still = f.read()
    ok("  and the file itself is left exactly as it was",
       still == "{ this is not json",
       "saving over a collection that failed to parse is how it gets lost")

# ------------------------------------------------------------ the spreadsheet
with tempfile.TemporaryDirectory() as tmp:
    desktop_into(tmp)
    api = Fake(tmp)
    payload = {"sections": [
        {"name": "Blu-ray", "items": [{"title": "Blade Runner", "year": "1982",
                                       "notes": "Final cut"}]},
        {"name": "DVD", "items": [{"title": "Akira", "year": "1988", "notes": ""},
                                  {"title": "Zulu", "year": "1964", "notes": ""}]},
        {"name": "VHS", "items": [{"title": "Aliens", "year": "1986", "notes": ""},
                                  {"title": "The Thing", "year": "1982", "notes": ""}]},
    ]}
    res = api.effects_export("Personal Effects", payload, "xlsx")
    ok("the spreadsheet is written", res.get("ok") is True, str(res))
    path = res.get("path", "")
    ok("  with an .xlsx name", path.endswith(".xlsx"), path)
    if path and os.path.isfile(path):
        import openpyxl
        wb = openpyxl.load_workbook(path)
        ok("  and it really is a workbook a spreadsheet can open",
           zipfile.is_zipfile(path))
        ok("  with a tab per section as well as the combined one",
           set(wb.sheetnames) >= {"Personal Effects", "Blu-ray", "DVD", "VHS"},
           str(wb.sheetnames))
        ws = wb["VHS"]
        titles = [ws.cell(row=r, column=1).value for r in range(2, ws.max_row + 1)]
        ok("  each section's own tab holds its own items, in order",
           titles == ["Aliens", "The Thing"], str(titles))
        combined = wb["Personal Effects"]
        col_a = [c.value for c in combined["A"] if c.value]
        ok("  and the combined tab carries the section headings",
           col_a[:4] == ["Type", "Blu-ray", "DVD", "VHS"], str(col_a[:6]))
        allb = [combined.cell(row=r, column=2).value
                for r in range(1, combined.max_row + 1)]
        allb = [v for v in allb if v and v != "Title"]
        ok("  with every title in it",
           allb == ["Blade Runner", "Akira", "Zulu", "Aliens", "The Thing"],
           str(allb))

    # A second export must not overwrite the first.
    res2 = api.effects_export("Personal Effects", payload, "xlsx")
    ok("exporting twice never writes over the first file",
       res2.get("ok") and res2.get("path") != path, str(res2.get("path")))

    ok("an empty export says so rather than writing a blank file",
       api.effects_export("Personal Effects", {"sections": []}, "xlsx").get("error"),
       "a spreadsheet with nothing in it looks like the collection is gone")

# ------------------------------------------------------------- the document
with tempfile.TemporaryDirectory() as tmp:
    desktop_into(tmp)
    api = Fake(tmp)
    html = ("<html><body><h1>Personal Effects</h1>"
            "<h2>VHS</h2><ol><li>Aliens</li><li>The Thing</li></ol>"
            "<h2>DVD</h2><ol><li>Akira</li></ol></body></html>")
    res = api.effects_export("Personal Effects", {"html": html}, "docx")
    ok("the Word document is written", res.get("ok") is True, str(res))
    p = res.get("path", "")
    if p and os.path.isfile(p):
        import docx
        d = docx.Document(p)
        text = "\n".join(par.text for par in d.paragraphs)
        ok("  and it is a real .docx with the collection in it",
           "Aliens" in text and "The Thing" in text and "Akira" in text,
           repr(text[:160]))
        ok("  keeping the section headings",
           "VHS" in text and "DVD" in text, repr(text[:160]))

    # A divider must be a LINE in Word, not three asterisks. Cam asked for
    # "some color titles and dividers", and this document goes to Word as
    # well as to the printer; "* * *" where he asked for a divider is a
    # shrug. python-docx has no border API, so it is written as XML -- and
    # checked by reading the XML back, because a try/except around it would
    # otherwise fall back to asterisks silently.
    ruled = ("<html><body><h1>Personal Effects</h1><hr>"
             "<h2>VHS</h2><hr><ol><li>Aliens</li></ol></body></html>")
    res = api.effects_export("Ruled", {"html": ruled}, "docx")
    p = res.get("path", "")
    if p and os.path.isfile(p):
        import docx
        d = docx.Document(p)
        text = "\n".join(par.text for par in d.paragraphs)
        ok("a divider is a real rule in Word, not asterisks",
           "* * *" not in text, repr(text))
        with zipfile.ZipFile(p) as z:
            xml = z.read("word/document.xml").decode("utf-8")
        ok("  drawn as a paragraph border", xml.count("w:pBdr") >= 2,
           "%d borders" % xml.count("w:pBdr"))
        ok("  in his green", "5FA665" in xml)

    res = api.effects_export("Personal Effects", {"html": html}, "html")
    ok("HTML is written too, which needs nothing installed",
       res.get("ok") and res.get("path", "").endswith(".html"), str(res))

    ok("formats says what this machine can actually do",
       set(api.effects_formats()) == {"html", "xlsx", "docx"},
       str(api.effects_formats()))

print("\ntest_effects.py")
print("\n".join(lines))
print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
