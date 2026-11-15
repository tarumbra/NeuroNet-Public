"""Ebooks -- the library, and books turned into something the reader can show.

Cam: "add a new sub section called ebooks. This should be an ebook library
and reader. It should have a bookmarks feature as well and a bookmarks sub
section. Further i want a tool where i can highlight over an ebook if
possible."

The interface half is test_ebooks.js. This is ebooks.py, on books made here
(so the test runs anywhere), then on Cam's two real EPUBs when they are on
this machine -- real books are where an EPUB reader finds out it was wrong.

What has already been wrong once, silently, and is checked below:
  * a self-closed tag inside something being dropped (<svg><image/></svg>)
    counted as an opening, so the rest of the chapter vanished
  * an unclosed <input> or <source> did the same thing
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import base64, io, json, os, re, sys, tempfile, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import ebooks  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def png(w=60, h=90):
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (200, 40, 40)).save(buf, "PNG")
    return buf.getvalue()


def make_epub(path, title="The Sea Road", author="A. Writer"):
    ch1 = """<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title>
<style>p { color: red }</style><link rel="stylesheet" href="x.css"/></head>
<body><h1 id="top">Chapter One</h1>
<p>It was <em>cold</em> at sea. <a href="ch2.xhtml#far">Onward</a> and
<a href="https://example.com">away</a>.</p>
<svg xmlns="http://www.w3.org/2000/svg"><image xlink:href="images/plate.png"/></svg>
<p>After the plate.</p>
<script>alert(1)</script>
<div><video><source src="a.mp4"><p>no video</p></video></div>
<p onclick="evil()">Last line of one.</p>
</body></html>"""
    ch2 = """<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Two</title></head>
<body><h2>Chapter Two</h2><p id="far">The far shore.</p>
<form><input type="text"><p>inside a form</p></form><p>Still here.</p></body></html>"""
    opf = f"""<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>{title}</dc:title><dc:creator>{author}</dc:creator></metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
<item id="c2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
<item id="cov" href="images/cover.png" media-type="image/png" properties="cover-image"/>
<item id="pl" href="images/plate.png" media-type="image/png"/>
</manifest>
<spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>"""
    nav = """<html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc" id="toc">
<ol><li><a href="ch1.xhtml">One: Leaving</a></li><li><a href="ch2.xhtml">Two: Arriving</a></li></ol>
</nav></body></html>"""
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("mimetype", "application/epub+zip")
        z.writestr("META-INF/container.xml",
                   '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>')
        z.writestr("OEBPS/content.opf", opf)
        z.writestr("OEBPS/nav.xhtml", nav)
        z.writestr("OEBPS/ch1.xhtml", ch1)
        z.writestr("OEBPS/ch2.xhtml", ch2)
        z.writestr("OEBPS/images/cover.png", png())
        z.writestr("OEBPS/images/plate.png", png(10, 10))


def balanced(h):
    return (len(re.findall(r"<(p|div|li|h\d|blockquote|table)\b", h))
            == len(re.findall(r"</(p|div|li|h\d|blockquote|table)>", h)))


print("\nEbooks: the library and the books\n")
with tempfile.TemporaryDirectory() as tmp:
    src = os.path.join(tmp, "src")
    os.makedirs(src)
    epub = os.path.join(src, "sea-road.epub")
    make_epub(epub)
    make_epub(os.path.join(src, "an-apple.epub"), title="An Apple a Day", author="B")
    txt = os.path.join(src, "Journal.txt")
    with open(txt, "w", encoding="cp1252") as f:
        f.write("Chapter 1\n\nThe caf\xe9 was shut.\n\nPart of the problem was the rain.\n\n"
                "Chapter 2\n\nMorning.\n")
    pdf = os.path.join(src, "Manual.pdf")
    with open(pdf, "wb") as f:
        f.write(b"%PDF-1.4\n%fake but only copied, never parsed here\n")

    lib = ebooks.Library(os.path.join(tmp, "lib"))
    ok("an empty library is an empty shelf, not an error", lib.list() == {"books": []})

    # ---- adding ----------------------------------------------------------------
    r = lib.import_paths([epub, os.path.join(src, "an-apple.epub"), txt, pdf,
                          os.path.join(src, "notes.docx"), os.path.join(src, "gone.epub")])
    got = {b["format"]: b for b in r["added"]}
    ok("EPUB, PDF and text are added", sorted(b["format"] for b in r["added"]) == ["epub", "epub", "pdf", "txt"],
       r["added"])
    ok("  anything else is turned away, saying why",
       [s["name"] for s in r["skipped"]] == ["notes.docx", "gone.epub"] and all(s["why"] for s in r["skipped"]),
       r["skipped"])
    ok("  each is COPIED in, so moving the original loses nothing",
       len(os.listdir(lib.files_dir)) == 4 and os.path.isfile(epub))
    again = lib.import_paths([epub])
    ok("  the same book added twice is turned away",
       not again["added"] and "already" in again["skipped"][0]["why"], again)

    sea = next(b for b in r["added"] if b["title"] == "The Sea Road")
    ok("an EPUB's title and author come from the book", sea["author"] == "A. Writer")
    ok("  its cover too, as a small picture kept with the library",
       sea["cover"].startswith("data:image/jpeg;base64,") and len(sea["cover"]) < 60000)
    ok("  its contents from the book's own table of contents",
       [t["title"] for t in sea["toc"]] == ["One: Leaving", "Two: Arriving"], sea["toc"])
    ok("a PDF is named after its file until Cam renames it", got["pdf"]["title"] == "Manual")

    # A Kindle book converted by Calibre: each contents entry points at an
    # anchor at the END of the file before its chapter. Cam's Tarot book is
    # one; it named every chapter after the next one.
    cal = os.path.join(src, "calibre.epub")
    with zipfile.ZipFile(cal, "w") as z:
        z.writestr("META-INF/container.xml", '<container><rootfile full-path="c.opf"/></container>')
        z.writestr("c.opf", """<package><metadata><dc:title>Split</dc:title></metadata><manifest>
<item id="a" href="s0.html" media-type="application/xhtml+xml"/>
<item id="b" href="s1.html" media-type="application/xhtml+xml"/>
<item id="c" href="s2.html" media-type="application/xhtml+xml"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest>
<spine><itemref idref="a"/><itemref idref="b"/><itemref idref="c"/></spine></package>""")
        z.writestr("s0.html", "<body><p>Title page words here.</p><a id='p1'></a></body>")
        z.writestr("s1.html", "<body><p>" + "Chapter one text. " * 30 + "</p><div id='p2'></div></body>")
        z.writestr("s2.html", "<body><p>" + "Chapter two text. " * 30 + "</p></body>")
        z.writestr("toc.ncx", """<ncx><navMap>
<navPoint><navLabel><text>One</text></navLabel><content src="s0.html#p1"/></navPoint>
<navPoint><navLabel><text>Two</text></navLabel><content src="s1.html#p2"/></navPoint></navMap></ncx>""")
    m = ebooks.epub_meta(cal)
    ok("  a contents entry pointing at the end of the file before names the right chapter",
       [t["title"] for t in m["toc"]] == ["Title page words here.", "One", "Two"]
       or [t["title"] for t in m["toc"]][1:] == ["One", "Two"], m["toc"])

    # ---- the shelf ---------------------------------------------------------------
    titles = [b["title"] for b in lib.list()["books"]]
    ok("the shelf is alphabetical, a leading \"The\" and \"An\" ignored",
       titles == ["An Apple a Day", "Journal", "Manual", "The Sea Road"], titles)
    ok("  and numbers read as numbers", sorted(["Book 10", "Book 2"], key=ebooks.sort_key) == ["Book 2", "Book 10"])

    # ---- a chapter -----------------------------------------------------------------
    c = lib.chapter(sea["id"], 0)
    h = c.get("html", "")
    ok("a chapter comes back as HTML", "<h1" in h and "It was <em>cold</em> at sea." in h, h[:200])
    ok("  with nothing in it that could act: no script, style, handler or form",
       not re.search(r"<script|<style|onclick|<video|<form|<input|<link", h, re.I), h)
    ok("  and every word after what was taken out still there",
       "After the plate." in h and "Last line of one." in h, h[-200:])
    ok("  a picture in an <svg> becomes an ordinary one, carried inside the page",
       h.count('<img src="data:image/png;base64,') == 1)
    ok("  a link to another chapter becomes chapter#place; one leading out goes",
       'data-eb-href="1#eb-far"' in h and "example.com" not in h, re.findall(r"<a[^>]*>", h))
    ok("  and every block is closed", balanced(h))
    c2 = lib.chapter(sea["id"], 1)["html"]
    ok("an unclosed <input> doesn't swallow the rest of the chapter",
       "Still here." in c2 and 'id="eb-far"' in c2 and balanced(c2), c2)
    ok("a chapter past the end says so", "error" in lib.chapter(sea["id"], 9))
    ok("a book not in the library says so", "error" in lib.chapter("nope", 0))

    # ---- plain text ---------------------------------------------------------------------
    j = got["txt"]
    ok("a text book is cut at its chapter headings",
       [t["title"] for t in j["toc"]] == ["Chapter 1", "Chapter 2"], j["toc"])
    t0 = lib.chapter(j["id"], 0)["html"]
    ok("  a Windows-encoded file reads correctly (café, not nonsense)", "caf\xe9" in t0, t0)
    ok("  and \"Part of the problem...\" is a sentence, not a chapter", "Part of the problem" in t0, t0)
    ok("  as escaped paragraphs", t0.count("<p>") == 2)

    # ---- a PDF ----------------------------------------------------------------------------
    d = lib.pdf_data(got["pdf"]["id"])
    ok("a PDF is handed over whole, for pdf.js", d.get("data", "").startswith("data:application/pdf;base64,")
       and base64.b64decode(d["data"].split(",")[1]).startswith(b"%PDF"))
    ok("  and asking a PDF for a chapter says it reads by page",
       "page" in lib.chapter(got["pdf"]["id"], 0).get("error", ""))

    # ---- places: position, bookmarks, highlights ---------------------------------------------
    bm = [{"id": "m1", "chapter": 1, "progress": 0.2, "label": "Two: Arriving"}]
    hl = [{"id": "h1", "chapter": 0, "start": 4, "end": 11, "text": "It was", "colour": "green", "note": "n"}]
    lib.update(sea["id"], {"bookmarks": bm, "highlights": hl})
    res = lib.update(sea["id"], {"position": {"chapter": 1, "progress": 0.6}, "file": "../../etc/passwd"})
    back = next(b for b in lib.list()["books"] if b["id"] == sea["id"])
    ok("reading on moves the position and nothing else",
       back["position"] == {"chapter": 1, "progress": 0.6} and back["bookmarks"] == bm and back["highlights"] == hl,
       back)
    ok("  a field that isn't Cam's to change is refused, and said to be",
       res.get("ignored") == ["file"] and back["file"].endswith(".epub"), res)
    ok("  updating a book that isn't there says so", "error" in lib.update("nope", {"title": "x"}))
    raw = json.load(open(lib.index_path))
    ok("the library is one JSON file, written whole", isinstance(raw.get("books"), list)
       and not os.path.exists(lib.index_path + ".tmp"))

    # ---- a damaged library is reported, never replaced ---------------------------------------
    good = open(lib.index_path).read()
    with open(lib.index_path, "w") as f:
        f.write("{broken")
    ok("a damaged library file is reported", "error" in lib.list())
    ok("  and adding to it refuses rather than starting again", "error" in lib.import_paths([txt])
       and open(lib.index_path).read() == "{broken")
    with open(lib.index_path, "w") as f:
        f.write(good)

    # ---- removing ----------------------------------------------------------------------------
    lib.remove(sea["id"])
    ok("removing a book takes the library's copy and its marks",
       all(b["id"] != sea["id"] for b in lib.list()["books"]) and len(os.listdir(lib.files_dir)) == 3)
    ok("  and never the file it was added from", os.path.isfile(epub))

    # ---- through the app ---------------------------------------------------------------------
    import importlib.util
    spec = importlib.util.spec_from_file_location("nn", os.path.join(APP, "neuronet.py"))
    nn = importlib.util.module_from_spec(spec)
    sys.modules["nn"] = nn
    spec.loader.exec_module(nn)
    nn.data_dir = lambda: os.path.join(tmp, "app")
    api = nn.Api.__new__(nn.Api)
    added = api.ebooks_import_paths([epub])
    bid = added["added"][0]["id"]
    ok("the app's calls reach the library", [b["id"] for b in api.ebooks_list()["books"]] == [bid])
    ok("  and live in NeuroNet's data folder", os.path.isfile(os.path.join(tmp, "app", "ebooks", "library.json")))
    ok("  a chapter", "<h1" in api.ebooks_chapter(bid, 0).get("html", ""))
    ok("  a save", api.ebooks_update(bid, {"position": {"chapter": 1, "progress": 0}}).get("ok") is True)
    ok("  a PDF that isn't one says so", "error" in api.ebooks_pdf(bid))
    ok("  and a removal", api.ebooks_delete(bid).get("ok") is True and not api.ebooks_list()["books"])

# ---- Cam's real books, when they are here -----------------------------------------------------

# a book NeuroNet provides (NeuroPets' How to Play, 2026-10-20): shelved once, refreshed in place
with tempfile.TemporaryDirectory() as tmp:
    src = os.path.join(tmp, "Guide.pdf")
    with open(src, "wb") as fh:
        fh.write(b"%PDF-1.4\n%%EOF\n")
    lib = ebooks.Library(os.path.join(tmp, "lib"))
    a = lib.shelve(src)
    lib.update(a["id"], {"bookmarks": [{"at": 3}]})
    b = lib.shelve(src)
    with open(src, "wb") as fh:
        fh.write(b"%PDF-1.4\n% a newer guide\n%%EOF\n")
    c = lib.shelve(src)
    books = lib.list()["books"]
    ok("shelve: a provided book goes on once, and a newer copy replaces the file in place, bookmarks kept",
       a.get("fresh") and not b.get("fresh") and c.get("refreshed") and len(books) == 1 and lib.get(a["id"])["bookmarks"] == [{"at": 3}]
       and os.path.getsize(lib.path_of(lib.get(a["id"]))) == os.path.getsize(src), [a, b, c, len(books)])
    ok("shelve: a missing file says so", "error" in lib.shelve(os.path.join(tmp, "nope.pdf")))


REAL = "/mnt/Cams_Collective/Apps/cams_collective_complete/library"
real = [os.path.join(REAL, f) for f in (os.listdir(REAL) if os.path.isdir(REAL) else []) if f.endswith(".epub")]
if real:
    with tempfile.TemporaryDirectory() as tmp:
        lib = ebooks.Library(tmp)
        for b in lib.import_paths(real)["added"]:
            bad, words = [], 0
            for i in range(b["chapters"]):
                h = lib.chapter(b["id"], i).get("html", "")
                words += len(re.sub(r"<[^>]+>", " ", h).split())
                if not balanced(h) or re.search(r"<script|<style", h, re.I):
                    bad.append(i)
            ok("a real book reads whole: " + b["title"][:40],
               not bad and words > 20000 and b["cover"], f"bad chapters {bad}, {words} words")
else:
    print("  --    (Cam's real EPUBs aren't on this machine; skipped)")

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
