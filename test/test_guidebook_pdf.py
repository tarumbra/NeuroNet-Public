"""A deck's guidebook exported as a PDF (guidebook_pdf.py).

Cam: "add the ability to print full guidebooks and select pages of guide
books ... designed as all other print pages are, using this icon", then:
"Printing guidebook from a tarot deck gets stuck on preparing, change to
export to PDF then i can just print that PDF."

The page is built in Python from the files on disk, so nothing big crosses
the pywebview bridge (the cause of the hang). Checked here: the letterhead
and mark, whole and chosen guidebooks, the plumbing, and -- when a renderer
is installed -- a real PDF with a page per card.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import guidebook_pdf as gp                              # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def read(p):
    return open(os.path.join(APP, p), encoding="utf-8").read()


print("\nGuidebook as a PDF\n")

# ---- the plumbing -----------------------------------------------------------
py, js = __import__("backend_src").backend_source(APP), read("ui/cards/celestial.js")
ok("the backend exports a guidebook", "def cards_export_guidebook_pdf(self, kind, deck_id" in py)
ok("  asks where to save it, then opens it", "SAVE_DIALOG" in py[py.index("def cards_export_guidebook_pdf"):]
   and "gp.open_file(path)" in py)
ok("  and is counted in App stats", '"export:guidebook-pdf"' in py
   and '"guidebook-pdf": "Guidebooks to PDF"' in read("ui/stats/stats.js"))
ok("the page asks for it by deck and cards -- no pictures cross the bridge",
   "api.cards_export_guidebook_pdf(kind, deckId, cardIds, !!cover)" in js
   and "cards_print_image_url" not in js and "printImageURL" not in js)
ok("the buttons say Export", 'id="gb-print">Export PDF' in js and ">Export the Guidebook<" in js)
ok("exports skip the print copies", '"cards/print/"' in read("data_transfer.py"))
icon = os.path.join(APP, "icons", "divination.png")
ok("the divination mark is there, small like the others",
   os.path.isfile(icon) and os.path.getsize(icon) < 60000)

# ---- the document -------------------------------------------------------------
deck = {"name": "Crows & Co", "cover": "cover.png", "cards": [
    {"id": "fool", "name": "The Fool", "suit": "Major", "image": "fool.jpg",
     "upright": "Leap.", "reversed": [["Look ", []], ["first.", ["bold"]]], "synopsis": ""},
    {"id": "magician", "name": "The Magician", "suit": "Major", "image": None,
     "upright": "", "reversed": "", "synopsis": ""},
    {"id": "ace_wands", "name": "Ace of <Wands>", "suit": "Wands", "image": "ace.jpg",
     "upright": "Spark.", "reversed": "", "synopsis": "A beginning."},
]}
work = tempfile.mkdtemp(prefix="nn-gb-")
try:
    pics = {}
    try:
        from PIL import Image
        for n, c in (("fool.jpg", "red"), ("ace.jpg", "blue"), ("cover.png", "green")):
            Image.new("RGB", (500, 700), c).save(os.path.join(work, n))
            pics[n] = os.path.join(work, n)
    except ImportError:
        pass
    where = lambda name: pics.get(name)                 # noqa: E731
    whole = gp.build_html(deck, deck["cards"], "tarot", cover=True, image_path=where)
    sections = whole.count('<section class="page')
    ok("whole guidebook: cover, contents, a page per card", sections == 5, sections)
    import print_header as ph
    mark = ph.logo_data_uri("divination.png")
    ok("every page has the letterhead with the divination mark",
       mark and whole.count(mark) == 5, whole.count(mark or "--"))
    ok("cover says all the cards, and shows the cover art",
       "All 3 cards" in whole and ("cover.png" in whole or not pics))
    ok("contents are grouped by suit", re.search(r'toc-suit">Major.*toc-suit">Wands', whole, re.S))
    ok("each card says where it sits in the deck", "Card 3 of 3" in whole)
    ok("rich text is printed as text", "Look first." in whole and "[[" not in whole)
    ok("empty sections are left out", whole.count("<h2>Card Synopsis</h2>") == 1)
    ok("a card with nothing written says so", "Nothing written for this card yet." in whole)
    ok("a card with no picture gets a blank frame", 'class="blank"' in whole)
    ok("names are escaped", "Ace of &lt;Wands&gt;" in whole and "<Wands>" not in whole)
    ok("the page is A4", "size: A4" in whole)

    some = gp.build_html(deck, [deck["cards"][0], deck["cards"][2]], "tarot", cover=True, image_path=where)
    ok("chosen cards: only those pages, the cover saying how many",
       some.count('<section class="page') == 4 and "The Magician" not in some
       and "2 of the deck's 3 cards" in some)
    one = gp.build_html(deck, [deck["cards"][0]], "tarot", cover=True, image_path=where)
    ok("one card needs no cover", one.count('<section class="page') == 1 and "Contents" not in one)

    # ---- a real PDF, when something can render one --------------------------------
    have_renderer = gp.find_chromium() is not None
    if not have_renderer:
        try:
            import PyQt6.QtWebEngineCore  # noqa: F401
            have_renderer = True
        except ImportError:
            pass
    if have_renderer and shutil.which("pdfinfo"):
        out = os.path.join(work, "g.pdf")
        res = gp.html_to_pdf(whole, out)
        pages = 0
        if res.get("ok"):
            info = subprocess.run(["pdfinfo", out], capture_output=True, text=True).stdout
            m = re.search(r"Pages:\s+(\d+)", info)
            pages = int(m.group(1)) if m else 0
            ok("a real PDF is made (%s), A4" % res.get("engine"), "A4" in info, info)
        ok("  a page per section", pages == 5, res if not res.get("ok") else pages)
    else:
        print("  --    no Chromium/Qt web engine or pdfinfo here; the PDF itself isn't rendered")
finally:
    shutil.rmtree(work, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
