"""Notes books -- the store, and turning a book's HTML into a Word file.

Cam: "a book feature for the Notes subsection where I can add any type of
note from a subsection to it and then export or print. The feature is
already present in Training."

The interface half is tested in test_books.js. This is the half that
touches disk and produces a file:

  the store      one JSON file per book, written beside and moved into
                 place, never leaving a half-written book behind
  a bad file     a book that cannot be read is REPORTED, never replaced
  the converter  a book's HTML as a .docx, with the structure intact

The converter has the most surface and has already been wrong twice, both
times silently:

  * <meta> and <link> send no end tag, so counting every start tag to
    skip <head> made the counter climb and never come down -- the whole
    book converted to an EMPTY document
  * collapsing whitespace threw away the space before an inline tag, so
    "The <b>plan</b>" came out "Theplan"

Neither raised anything. Both are checked below.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import io
import json
import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


# The data folder is pinned to a temporary directory BEFORE anything is
# asked for a path, so this test can never see or touch Cam's own books.
TMP = tempfile.mkdtemp(prefix="ss-books-test-")
os.environ["HOME"] = TMP
import neuronet as S                                    # noqa: E402

S.data_dir = lambda: os.path.join(TMP, "neuronet_data")
api = S.Api()

print("\nNotes books\n")

# ---------------------------------------------------------------- the store
root = S.notebooks_dir()
ok("books live inside the vault's own folder, beside boards and cells",
   os.path.isdir(root) and os.path.basename(root) == "books"
   and os.path.basename(os.path.dirname(root)) == "notes", root)
ok("  and nowhere near the real one", TMP in root, root)

BOOK = {"id": "winter", "name": "Winter Manual", "subtitle": "Pre-season",
        "brand": "Coach Cam", "created": "2026-09-25T00:00:00Z",
        "entries": [{"type": "note", "refId": "Block 1.md"},
                    {"type": "sheet", "refId": "loads"}]}

res = api.notebooks_write("winter", BOOK)
ok("a book saves", res.get("ok") and res.get("updated"), res)
ok("  as one file, named after it",
   os.path.isfile(os.path.join(root, "winter.json")), os.listdir(root))
ok("  and nothing half-written is left behind",
   not [n for n in os.listdir(root) if n.endswith(".part")], os.listdir(root))

got = api.notebooks_read("winter")
ok("it reads back exactly", got.get("book", {}).get("entries") == BOOK["entries"], got)

lst = api.notebooks_list()
ok("the list counts what is in it",
   len(lst) == 1 and lst[0]["count"] == 2 and lst[0]["name"] == "Winter Manual", lst)
ok("  and carries the subtitle", lst[0]["subtitle"] == "Pre-season", lst)

# A book whose file has been corrupted is REPORTED, not replaced. The same
# rule boards and sheets follow: never overwrite what could not be read.
with open(os.path.join(root, "broken.json"), "w") as fh:
    fh.write("{not json at all")
lst = api.notebooks_list()
broken = [b for b in lst if b["id"] == "broken"]
ok("a book that cannot be read is listed with its problem",
   len(broken) == 1 and "error" in broken[0], lst)
ok("  and reading it refuses rather than returning a blank one",
   "error" in api.notebooks_read("broken"), api.notebooks_read("broken"))
before = open(os.path.join(root, "broken.json")).read()
api.notebooks_list()
ok("  and listing never rewrites it",
   open(os.path.join(root, "broken.json")).read() == before)
os.remove(os.path.join(root, "broken.json"))

# A path with a slash or a .. in it must not escape the folder.
for bad in ("../escape", "a/b", "..", ""):
    r = api.notebooks_write(bad, {"name": "x"})
    ok(f"  a book id of {bad!r} is refused", "error" in r, r)

ok("deleting one leaves the rest", api.notebooks_delete("winter").get("ok")
   and not os.path.isfile(os.path.join(root, "winter.json")))
ok("  and deleting one that has gone is not an error",
   api.notebooks_delete("winter").get("ok"))

# --------------------------------------------------------------- the formats
fmts = api.notebooks_formats()
ok("HTML is always available", fmts.get("html") is True, fmts)
ok("  and .docx is asked about rather than assumed",
   "docx" in fmts and isinstance(fmts["docx"], bool), fmts)

# ------------------------------------------------------------- the converter
try:
    import docx                                          # noqa: F401
    HAVE_DOCX = True
except ImportError:
    HAVE_DOCX = False

if not HAVE_DOCX:
    print("  --    python-docx is not installed; the converter is not checked")
else:
    import docx

    def convert(html):
        return docx.Document(io.BytesIO(S.html_to_docx(html)))

    def text_of(doc):
        return " ".join(p.text for p in doc.paragraphs if p.text.strip()).strip()

    # A WHOLE document, head and all. This is what the app actually sends,
    # and the <meta> inside <head> is what broke it the first time.
    whole = """<!doctype html><html><head><meta charset="utf-8">
      <title>Winter</title><style>body { color: red }</style></head>
      <body><div class="bk-doc"><h1>Winter</h1><p>The body.</p></div></body></html>"""
    d = convert(whole)
    ok("a complete HTML document converts, head and all",
       "Winter" in text_of(d) and "The body." in text_of(d), text_of(d))
    ok("  with the stylesheet left out of the text",
       "color: red" not in text_of(d), text_of(d))

    # The whitespace bug, in each of its shapes.
    SPACING = [
        ("<p>The <b>plan</b> for the <i>season</i>.</p>", "The plan for the season."),
        ("<p>A <code>=SUM(A1:A3)</code> formula.</p>", "A =SUM(A1:A3) formula."),
        ("<p><b>Bold</b> first.</p>", "Bold first."),
        ("<p>ends in <b>bold</b></p>", "ends in bold"),
        ("<p>two <b>a</b> <i>b</i> tags</p>", "two a b tags"),
    ]
    wrong = [(h, want, text_of(convert(h)))
             for h, want in SPACING if text_of(convert(h)) != want]
    ok("words keep their spaces around inline tags", not wrong,
       "; ".join(f"{g!r} should be {w!r}" for _, w, g in wrong))

    # Structure survives.
    rich = """<h1>Title</h1><h2>Section</h2><p>Words.</p>
      <ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>
      <blockquote>Quoted.</blockquote><pre>=SUM(B2:B10)</pre><hr>
      <table><thead><tr><th>Week</th><th>Load</th></tr></thead>
      <tbody><tr><td>1</td><td>82.5</td></tr></tbody></table>"""
    d = convert(rich)
    styles = [p.style.name for p in d.paragraphs if p.text.strip()]
    ok("headings stay headings", "Heading 1" in styles and "Heading 2" in styles, styles)
    ok("  bullets stay bullets", "List Bullet" in styles, styles)
    ok("  numbered lists stay numbered", "List Number" in styles, styles)
    ok("  quotes stay quotes", "Intense Quote" in styles, styles)
    ok("a table becomes a real table, not a run of text", len(d.tables) == 1, len(d.tables))
    if d.tables:
        rows = [[c.text for c in r.cells] for r in d.tables[0].rows]
        ok("  with its heading row and its numbers",
           rows[0] == ["Week", "Load"] and rows[1] == ["1", "82.5"], rows)

    # The cover: four blocks, four lines. One line was the bug.
    cover = """<section class="cover"><p class="cover-brand">Coach Cam</p>
      <div class="cover-rule"></div><h1 class="cover-title">Winter Manual</h1>
      <p class="cover-sub">Pre-season</p><p class="cover-meta">6 items</p></section>"""
    lines = [p.text.strip() for p in convert(cover).paragraphs if p.text.strip()]
    ok("the cover is separate lines, not one run-on paragraph",
       lines[:4] == ["Coach Cam", "Winter Manual", "Pre-season", "6 items"], lines)

    # Something the converter has no rule for must still come through.
    d = convert("<p>before</p><aside><mark>kept</mark></aside><p>after</p>")
    ok("a tag with no rule of its own still keeps its words",
       all(w in text_of(d) for w in ("before", "kept", "after")), text_of(d))

    # And the file really is a file.
    blob = S.html_to_docx("<h1>Hi</h1>")
    ok("what comes out is a real .docx", blob[:2] == b"PK" and len(blob) > 5000,
       f"{blob[:4]!r}, {len(blob)} bytes")

# ------------------------------------------------------------------ export
dest = os.path.join(TMP, "Desktop")
os.makedirs(dest, exist_ok=True)
r = api.notebooks_export("Winter Manual", "<h1>Winter</h1><p>Body.</p>", "html")
ok("exporting as HTML writes a file", r.get("ok") and os.path.isfile(r["path"]), r)
ok("  named after the book", os.path.basename(r.get("path", "")) == "Winter Manual.html", r)
first = r["path"]
r2 = api.notebooks_export("Winter Manual", "<h1>Again</h1>", "html")
ok("  and a second export never overwrites the first",
   r2.get("ok") and r2["path"] != first and os.path.isfile(first), [first, r2.get("path")])
ok("  the first one still says what it said",
   "Winter" in open(first).read(), open(first).read()[:60])

# A name with characters no filesystem will take.
r3 = api.notebooks_export('Block 1/2: "notes"?', "<p>x</p>", "html")
ok("a book name with slashes and colons still writes",
   r3.get("ok") and os.path.isfile(r3["path"]), r3)
ok("  with those characters taken out of the filename",
   not any(c in os.path.basename(r3.get("path", "")) for c in '\\/:*?"<>|'),
   os.path.basename(r3.get("path", "")))

if HAVE_DOCX:
    r4 = api.notebooks_export("Winter Manual", "<h1>Winter</h1>", "docx")
    ok("exporting as .docx writes a real Word file",
       r4.get("ok") and open(r4["path"], "rb").read(2) == b"PK", r4)

    # Cam: "When printing a notebook from the notes main section i want to use
    # this icon ... design the print pages from the notebooks to match all the
    # other print and export pages." Word draws the letterhead itself.
    import docx
    r5 = api.notebooks_export("Winter Manual", "<h1>Winter</h1><p>Body.</p>", "docx",
                              {"title": "Winter Manual", "subtitle": "2 items",
                               "right_logo": "notes.png", "right_name": "notes"})
    d = docx.Document(r5["path"])
    head = d.tables[0].rows[0].cells if d.tables else []
    ok("a notebook's Word export opens on the shared letterhead",
       len(head) == 3 and "Winter Manual" in head[1].text and "notes" in head[2].text,
       [c.text for c in head])
    pics = d.tables[0]._element.xpath(".//pic:pic") if d.tables else []
    ok("  NeuroNet's mark and the notes mark, as real pictures", len(pics) == 2, len(pics))
    ok("  then the notebook itself", any(p.text == "Body." for p in d.paragraphs))
    r6 = api.notebooks_export("Winter Manual", "<h1>Winter</h1>", "docx")
    ok("  and without one it is the notebook alone, as before",
       not docx.Document(r6["path"]).tables, r6)

from PIL import Image  # noqa: E402
logo = os.path.join(ROOT, "icons", "notes.png")
ok("the notes mark is in the app", os.path.isfile(logo))
if os.path.isfile(logo):
    with Image.open(logo) as im:
        ok("  on a transparent ground, small enough to travel in every page",
           im.convert("RGBA").getpixel((0, 0))[3] == 0 and os.path.getsize(logo) < 60 * 1024)

shutil.rmtree(TMP, ignore_errors=True)
print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
