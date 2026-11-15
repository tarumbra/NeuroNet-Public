"""Media -> Scan: barcodes.py and its backend calls (15 November 2026).

Cam chose the barcode scan to speed up data entry: the number (typed, or a
USB barcode scanner), photos of barcodes, or the Barcodes folder in
Documents/NeuroNet Picture References/Art to Action. Every web reply here is
a stand-in: nothing leaves the computer, nothing touches Cam's folders.
"""
import os
os.environ["NEURONET_PATHS"] = "/dev/null/paths.json"

import io
import json
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(HERE)
sys.path.insert(0, APP)
for k in [k for k in os.environ if k.startswith("XDG_")]:
    os.environ.pop(k)

import barcodes  # noqa: E402

PASS = FAIL = 0


def ok(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  ok    " + name)
    else:
        FAIL += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def jpeg(w=300, h=450):
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (120, 30, 60)).save(buf, "JPEG")
    return buf.getvalue()


class Fake:
    """Answers by address; anything it doesn't know is a 404 (None)."""

    def __init__(self, table):
        self.table, self.asked = table, []

    def get(self, url, limit=0, accept=""):
        self.asked.append(url)
        for key, val in self.table.items():
            if key in url:
                if isinstance(val, Exception):
                    raise val
                return val if isinstance(val, bytes) else json.dumps(val).encode()
        return None

    def json(self, url):
        raw = self.get(url)
        return None if raw is None else json.loads(raw)


tmp = tempfile.mkdtemp(prefix="nn-barcodes-")
cache = os.path.join(tmp, "cache")
try:
    print("\nMedia -> Scan (barcodes)\n")

    # ---- the number ----
    ok("a 13 digit EAN with a leading 0 is the 12 digit UPC", barcodes.normalise("0 883929 091270") == "883929091270")
    ok("  a 10 digit ISBN becomes its 13 digits", barcodes.normalise("0-14-032872-6") == "9780140328721")
    ok("  a wrong check digit isn't a barcode", barcodes.normalise("883929091271") == "")
    ok("  nor are letters or the wrong length", barcodes.normalise("abc") == "" and barcodes.normalise("12345") == "")
    ok("  978... is a book", barcodes.is_isbn("9780140328721") and not barcodes.is_isbn("883929091270"))

    # ---- titles from shops ----
    ok("packaging comes off a title", barcodes.clean_title("PRACTICAL MAGIC [DVD] [CANADIAN; FRENCH]") == ("Practical Magic", ""))
    ok("  a shop's stock code too", barcodes.clean_title("D112617D Practical Magic (Dvd/Re-Pkg/Eco)")[0] == "Practical Magic")
    ok("  and a year in brackets is kept as the year", barcodes.clean_title("Aliens (Blu-ray, 1986)") == ("Aliens", "1986"))
    ok("  but a bracket that's part of the name stays", barcodes.clean_title("Up (Pixar Short Films Collection) - DVD")[0]
       == "Up (Pixar Short Films Collection)")

    # ---- the lookups ----
    f = Fake({"api.upcitemdb.com": {"code": "OK", "items": [{"title": "Practical Magic (DVD)",
              "category": "Media > DVDs & Videos", "images": ["https://img.example/pm.jpg", "http://no.example/x.jpg"]}]},
              "wikidata.org": {"search": [{"label": "Practical Magic", "description": "1995 novel by Alice Hoffman"},
                                          {"label": "Practical Magic", "description": "1998 film directed by Griffin Dunne"}]},
              "img.example/pm.jpg": jpeg()})
    r = barcodes.lookup("0883929091270", cache, f)
    ok("a DVD: the UPC database names it, Wikidata gives its year and director",
       r.get("found") and r["type"] == "film" and r["title"] == "Practical Magic" and r["format"] == "DVD"
       and r["year"] == "1998" and r["creator"] == "Griffin Dunne" and r["source"] == "UPC database", r)
    ok("  MusicBrainz was asked first (it isn't a book)", "musicbrainz.org" in f.asked[0], f.asked)
    ok("  its cover is saved in the cache, with a small preview",
       r["cover"].startswith(cache) and os.path.isfile(r["cover"]) and r["preview"].startswith("data:image/jpeg;base64,"))
    ok("  only https pictures are taken", not any("http://no.example" in u for u in f.asked))

    f = Fake({"musicbrainz.org": {"releases": [{"id": "a10f09e2-9c4e-48aa-9221-9484dc9624f4", "title": "÷", "date": "2017-03-03",
              "barcode": "190295859039", "artist-credit": [{"name": "Ed Sheeran", "joinphrase": ""}],
              "media": [{"format": "CD"}], "release-group": {"id": "e05f9927-e24b-41c5-928d-d0e008a12444"}}]},
              "coverartarchive.org/release-group/": jpeg(500, 500)})
    r = barcodes.lookup("190295859039", cache, f)
    ok("a CD: MusicBrainz names it, its artist, year and format",
       r["type"] == "music" and r["title"] == "÷" and r["creator"] == "Ed Sheeran" and r["year"] == "2017" and r["format"] == "CD", r)
    ok("  this pressing has no cover, so the album's is used", bool(r["cover"])
       and any("/release/a10f" in u for u in f.asked) and any("release-group/e05f" in u for u in f.asked))
    ok("  and the UPC database wasn't asked", not any("upcitemdb" in u for u in f.asked))

    f = Fake({"musicbrainz.org": {"releases": [{"id": "x", "title": "Other", "barcode": "5099999999999"}]},
              "api.upcitemdb.com": {"code": "OK", "items": [{"title": "Betty Buckley - Ghostlight - Opera / Vocal - CD",
                                                             "category": "Media > Music & Sound Recordings > Music CDs"}]}})
    r = barcodes.lookup("753957217426", cache, f)
    ok("a MusicBrainz answer for another barcode isn't taken; the UPC one splits artist from album",
       r["type"] == "music" and r["creator"] == "Betty Buckley" and r["title"] == "Ghostlight" and r["format"] == "CD", r)

    f = Fake({"api.upcitemdb.com": {"code": "OK", "items": [{"title": "The Last of Us Part II - PlayStation 4",
              "category": "Electronics > Video Game Software"}]},
              "wikidata.org": {"search": [{"label": "The Last of Us Part II", "description": "2020 video game developed by Naughty Dog"}]}})
    r = barcodes.lookup("711719505020", cache, f)
    ok("a game: its platform is its format, the platform comes off the title",
       r["type"] == "game" and r["format"] == "PS4" and r["title"] == "The Last of Us Part II" and r["year"] == "2020", r)

    f = Fake({"openlibrary.org/isbn/": {"title": "Fantastic Mr. Fox", "authors": [{"key": "/authors/OL34184A"}],
              "publish_date": "October 1, 1988", "physical_format": "Paperback"},
              "openlibrary.org/authors/OL34184A": {"name": "Roald Dahl"}, "covers.openlibrary.org": jpeg()})
    r = barcodes.lookup("9780140328721", cache, f)
    ok("a book: Open Library, its author, year, paperback and cover",
       r["type"] == "book" and r["title"] == "Fantastic Mr. Fox" and r["creator"] == "Roald Dahl" and r["year"] == "1988"
       and r["format"] == "Paperback" and r["cover"] and r["source"] == "Open Library", r)
    ok("  and nothing else was asked about a book", not any("musicbrainz" in u or "upcitemdb" in u for u in f.asked))

    r = barcodes.lookup("883929091270", cache, Fake({}))
    ok("nothing known anywhere: found false, to be typed in, the number kept",
       r.get("ok") and not r["found"] and r["code"] == "883929091270" and r["title"] == "", r)
    r = barcodes.lookup("883929091270", cache, Fake({"musicbrainz.org": {"releases": []},
                                                     "upcitemdb": {"code": "EXCEED_LIMIT"}}))
    ok("  the UPC database's day used up: it says so", not r.get("found") and "100" in r.get("note", ""), r)
    r = barcodes.lookup("883929091270", cache, Fake({"musicbrainz.org": ValueError("Couldn't reach the lookup (offline)."),
                                                     "upcitemdb": ValueError("Couldn't reach the lookup (offline).")}))
    ok("  offline: an error to show", "offline" in r.get("error", ""), r)
    ok("a number that isn't a barcode isn't looked up", "isn't a barcode" in barcodes.lookup("12", cache, Fake({}))["error"])

    old = os.path.join(cache, "cover-old.jpg")
    open(old, "wb").write(b"x")
    os.utime(old, (1, 1))
    barcodes.prune(cache)
    ok("covers left in the cache over a day are cleared", not os.path.exists(old) and os.listdir(cache))

    ok("the web is asked only of public addresses (recipe_link's rule)",
       barcodes.recipe_link.not_public("http://192.168.1.1/x", resolve=lambda h, p: [(0, 0, 0, "", ("192.168.1.1", 0))]) != "")
    src = open(os.path.join(APP, "barcodes.py"), encoding="utf-8").read()
    ok("  and the app tells them only its name", 'UA = "NeuroNet/1.0 (personal media catalogue)"' in src
       and "tarumbra" not in src and "@" not in src.split("UA =")[1].split("\n")[0])

    # ---- photos ----
    writer = shutil.which("ZXingWriter")
    if writer and (shutil.which("ZXingReader") or shutil.which("zbarimg")):
        pic = os.path.join(tmp, "back.png")
        subprocess.run([writer, "-scale", "4", "EAN-13", "0883929091270", pic], check=True, capture_output=True)
        ok("a photo of a barcode is read", barcodes.read_picture(pic) == {"codes": ["883929091270"]},
           barcodes.read_picture(pic))
        from PIL import Image
        webp = os.path.join(tmp, "back.webp")
        Image.open(pic).convert("RGB").rotate(90, expand=True).save(webp)
        ok("  a WEBP, turned on its side, too", barcodes.read_picture(webp).get("codes") == ["883929091270"],
           barcodes.read_picture(webp))
        blank = os.path.join(tmp, "blank.png")
        Image.new("RGB", (200, 200), "white").save(blank)
        ok("  a photo with no barcode says so", "No barcode" in barcodes.read_picture(blank).get("error", ""))
    else:
        print("  --    (ZXing not installed: photo reading not tried)")
    ok("a picture that isn't there says so", "isn't there" in barcodes.read_picture(os.path.join(tmp, "gone.png"))["error"])
    leftover = [n for n in os.listdir(tempfile.gettempdir()) if n.startswith("neuronet-barcode-")]
    ok("  and no converted copies are left in /tmp", not leftover, leftover)

    # ---- a cover pasted or dropped into Media's Edit window ----
    class Ran:
        def __init__(self, out, code=0):
            self.stdout, self.returncode = out, code

    def fake_clip(table):
        asked = []

        def run(args):
            asked.append(args)
            if args[1] == "--list-types":
                return Ran("\n".join(table).encode())
            return Ran(table.get(args[-1], b""))
        return run, asked

    png = io.BytesIO()
    from PIL import Image
    Image.new("RGBA", (120, 180), (10, 20, 30, 255)).save(png, "PNG")
    run, asked = fake_clip({"text/x-moz-url": b"x", "text/html": b"<img src='https://e.x/a.jpg'>", "image/png": png.getvalue(),
                            "chromium/x-source-url": b"x"})
    got = barcodes.clipboard_picture(cache, run=run, fetcher=Fake({}))
    ok("Brave's Copy image: the picture on the clipboard is read (wl-paste), not its address",
       got.get("path", "").startswith(cache) and os.path.isfile(got["path"]) and asked[-1][-1] == "image/png", got)
    run, asked = fake_clip({"text/html": b"<meta charset='utf-8'><img src=\"https://img.example/c.jpg?a=1&amp;b=2\">"})
    f = Fake({"img.example/c.jpg": jpeg()})
    got = barcodes.clipboard_picture(cache, run=run, fetcher=f)
    ok("  only a web page's bit holding the picture: its address is fetched",
       got.get("path") and f.asked == ["https://img.example/c.jpg?a=1&b=2"], (got, f.asked))
    run, asked = fake_clip({"text/plain;charset=utf-8": b"Dust Bunny", "text/plain": b"Dust Bunny"})
    ok("  words on the clipboard: no picture", barcodes.clipboard_picture(cache, run=run, fetcher=Fake({})) == {"none": True})
    ok("an address that isn't a picture says so",
       "isn't a picture" in barcodes.picture_from_url("https://e.x/page", cache, Fake({"e.x/page": b"<html>"})).get("error", ""))
    ok("  nor a home network one (only public addresses are fetched)",
       "error" in barcodes.picture_from_url("http://127.0.0.1/x.png", cache))
    pf = os.path.join(tmp, "dropped.png")
    open(pf, "wb").write(png.getvalue())
    ok("  a file dropped from the file manager (file://) is used", barcodes.picture_from_url("file://" + pf, cache).get("path"))
    ok("  a dragged address in a list of links is found", barcodes.url_in("#comment\nhttps://x.example/p.webp") == "https://x.example/p.webp")

    # ---- the Barcodes folder ----
    os.environ["NEURONET_REFERENCES_DIR"] = os.path.join(tmp, "refs")
    import snips
    d = snips.barcodes_dir()
    ok("Picture References has Art to Action/Barcodes, with an Archive",
       d == os.path.join(tmp, "refs", "Art to Action", "Barcodes") and os.path.isdir(os.path.join(d, "Archive")))
    src = open(os.path.join(APP, "api", "media.py"), encoding="utf-8").read()
    ok("the backend's done-with refuses anything outside the Barcodes folder",
       "os.path.dirname(p) != os.path.realpath(d)" in src and "media_art_archive(p, d)" in src)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\n  %d passed, %d failed\n" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
