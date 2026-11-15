"""Media -> Scan: a barcode into Media (15 November 2026).

Cam asked for faster data entry; the first idea he chose: "Barcode scan:
photograph the barcode on the back of a case. One online lookup fills in the
title, year, format and cover."

    read_picture(path)  -> the EAN/UPC/ISBN numbers in a photo (ZXing, zbar)
    lookup(code)        -> what it is: {type, title, creator, year, format,
                           cover (a local file), preview, source}

WHERE IT LOOKS, all free and without an account:
- an ISBN (978/979...) is a book: Open Library, with its cover;
- anything else is asked of MusicBrainz first (CDs, vinyl and cassettes by
  barcode, covers from the Cover Art Archive), then the UPC database
  (upcitemdb's free tier: DVDs, Blu-rays, games, CDs; about 100 a day);
- a film or game with no year is matched by title on Wikidata ("1998 film
  directed by Griffin Dunne"), for its year and director.
Only the number (and, for a film, its title) is sent; the app is named
"NeuroNet" and nothing about the person using it.

Every address goes through recipe_link.not_public, so a reply can't make
NeuroNet fetch something on the home network. Covers are kept in a small
cache folder that empties itself of anything older than a day.
"""
import base64
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

import recipe_link

UA = "NeuroNet/1.0 (personal media catalogue)"
MAX_JSON = 2_000_000
MAX_IMAGE = 10_000_000
FORMATS_1D = "EAN-13,EAN-8,UPC-A,UPC-E"

FILM_FORMATS = (("4K UHD", r"\b4k\b|\buhd\b|ultra hd"), ("Blu-ray", r"blu[\s-]?ray|\bbd\b"),
                ("VHS", r"\bvhs\b"), ("DVD", r"\bdvd\b"))
MUSIC_FORMATS = (("Vinyl", r"vinyl|\blp\b|12\"|7\""), ("Cassette", r"cassette|\btape\b"),
                 ("CD", r"\bcd\b|compact disc"))
# longest first, so "Xbox One" isn't read as "Xbox", "PS Vita" as "PS"
GAME_PLATFORMS = (("Switch 2", r"switch 2"), ("Switch", r"\bswitch\b"), ("PS Vita", r"\bvita\b"),
                  ("PS5", r"\bps5\b|playstation 5"), ("PS4", r"\bps4\b|playstation 4"),
                  ("PS3", r"\bps3\b|playstation 3"), ("PS2", r"\bps2\b|playstation 2"),
                  ("PSP", r"\bpsp\b"), ("PS1", r"\bps1\b|\bpsx\b|playstation(?! ?\d)"),
                  ("Xbox One", r"xbox one|xbox series"), ("Xbox 360", r"xbox 360"), ("Xbox", r"\bxbox\b"),
                  ("Nintendo 3DS", r"\b3ds\b"), ("Nintendo DS", r"\bnds\b|nintendo ds\b|\bds\b"),
                  ("Game Boy Advance", r"game ?boy advance|\bgba\b"), ("Game Boy", r"game ?boy"),
                  ("Nintendo 64", r"nintendo 64|\bn64\b"), ("GameCube", r"game ?cube"),
                  ("Wii", r"\bwii\b"), ("SNES", r"\bsnes\b|super nintendo"), ("PC", r"\bpc\b|windows"))
# bracketed bits that say what the box is, not what the film is called
_PACKAGING = re.compile(
    r"dvd|blu[\s-]?ray|4k|uhd|vhs|\bcd\b|vinyl|\blp\b|cassette|widescreen|full ?screen|region|"
    r"canadian|french|english|spanish|import|digital|ultraviolet|re-?pkg|eco|edition|bilingual|"
    r"slipcover|steelbook|\bntsc\b|\bpal\b|ps\d|xbox|switch|wii|nintendo|playstation|\bpc\b|"
    r"pre-?owned|new|sealed|disc|\d{4}", re.I)


# -- the number --------------------------------------------------------------

def _ean_ok(d):
    if len(d) not in (8, 12, 13, 14):
        return False
    digits = [int(c) for c in d]
    body, check = digits[:-1], digits[-1]
    # weights 3,1,3,1... counted from the digit next to the check digit
    total = sum(x * (3 if i % 2 == 0 else 1) for i, x in enumerate(reversed(body)))
    return (10 - total % 10) % 10 == check


def _isbn10_to_13(d):
    core = "978" + d[:9]
    total = sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(core))
    return core + str((10 - total % 10) % 10)


def normalise(code):
    """The number as it's looked up: digits only, a 10 digit ISBN made 13,
    a 13 digit EAN with a leading 0 made the 12 digit UPC it is. '' when it
    isn't a barcode number (wrong length or its check digit doesn't add up)."""
    s = re.sub(r"[\s-]", "", str(code or "")).upper()
    if re.fullmatch(r"\d{9}[\dX]", s):
        ok = sum((10 if c == "X" else int(c)) * (10 - i) for i, c in enumerate(s)) % 11 == 0
        return _isbn10_to_13(s) if ok else ""
    if not s.isdigit() or not _ean_ok(s):
        return ""
    if len(s) == 14 and s.startswith("0"):
        s = s[1:]
    if len(s) == 13 and s.startswith("0"):
        s = s[1:]
    return s


def is_isbn(code):
    return len(code) == 13 and code[:3] in ("978", "979")


# -- the picture -------------------------------------------------------------

def _zxing(path):
    exe = shutil.which("ZXingReader")
    if not exe:
        return None
    try:
        r = subprocess.run([exe, "-json", "-formats", FORMATS_1D, path],
                           capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return None
    out = []
    for line in r.stdout.splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                out.append(json.loads(line).get("Text", ""))
            except ValueError:
                pass
    return out


def _zbar(path):
    exe = shutil.which("zbarimg")
    if not exe:
        return None
    try:
        r = subprocess.run([exe, "-q", "--raw", "-Sdisable", "-Sean13.enable", "-Sean8.enable",
                            "-Supca.enable", "-Supce.enable", "-Sisbn13.enable", "-Sisbn10.enable", path],
                           capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return None
    return [x.strip() for x in r.stdout.splitlines() if x.strip()]


def _as_png(path):
    """A copy the readers can open (a phone's HEIC or WEBP), or None."""
    try:
        from PIL import Image, ImageOps
        im = ImageOps.exif_transpose(Image.open(path)).convert("L")
    except Exception:                                             # noqa: BLE001
        return None
    fd, out = tempfile.mkstemp(suffix=".png", prefix="neuronet-barcode-")
    os.close(fd)
    im.save(out)
    return out


def read_picture(path, readers=None):
    """{codes: [...]} -- the barcode numbers in a photo, or {error}."""
    if not os.path.isfile(path):
        return {"error": "That picture isn't there any more."}
    if readers is None:
        if not any(shutil.which(x) for x in ("ZXingReader", "zbarimg")):
            return {"error": "Nothing on this computer can read barcodes (sudo pacman -S zxing-cpp)."}
        readers = (_zxing, _zbar)
    tries, tmp = [path], None
    codes = []
    for attempt in range(2):
        for reader in readers:
            got = reader(tries[-1]) or []
            for c in got:
                n = normalise(c)
                if n and n not in codes:
                    codes.append(n)
            if codes:
                break
        if codes or attempt:
            break
        tmp = _as_png(path)                  # not readable as it is: grey PNG, the right way up
        if not tmp:
            break
        tries.append(tmp)
    if tmp:
        os.remove(tmp)
    return {"codes": codes} if codes else {"error": "No barcode found in that picture. Closer, flat and in focus helps."}


# -- the web -----------------------------------------------------------------

class _Fetcher:
    """Public addresses only, every redirect checked (recipe_link's rules)."""

    def __init__(self, opener=None):
        self.opener = opener or urllib.request.build_opener(recipe_link._PublicRedirects)

    _last = {}                       # host -> when it was last asked (MusicBrainz: one a second)

    def get(self, url, limit=MAX_JSON, accept="application/json", again=True):
        bad = recipe_link.not_public(url)
        if bad:
            raise ValueError(bad)
        host = urllib.parse.urlsplit(url).hostname or ""
        if host == "musicbrainz.org":
            wait = 1.1 - (time.time() - self._last.get(host, 0))
            if wait > 0:
                time.sleep(wait)
            self._last[host] = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
        try:
            with self.opener.open(req, timeout=12) as r:
                raw = r.read(limit + 1)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in (429, 503) and again:            # busy: once more, a moment later
                time.sleep(1.5)
                return self.get(url, limit, accept, again=False)
            raise ValueError("The lookup said %s." % e.code)
        except ValueError:
            raise
        except Exception as e:                                    # noqa: BLE001
            raise ValueError("Couldn't reach the lookup (%s)." % getattr(e, "reason", e))
        if len(raw) > limit:
            raise ValueError("The lookup sent back too much.")
        return raw

    def json(self, url):
        raw = self.get(url)
        if raw is None:
            return None
        try:
            return json.loads(raw.decode("utf-8", errors="replace"))
        except ValueError:
            return None


def _year(text):
    m = re.search(r"\b(1[89]\d\d|20\d\d)\b", str(text or ""))
    return m.group(1) if m else ""


def _pick(table, *texts):
    blob = " ".join(str(t or "") for t in texts).lower()
    for name, pat in table:
        if re.search(pat, blob):
            return name
    return ""


def _titlecase(t):
    if t.isupper() and len(t) > 3:
        small = {"a", "an", "and", "of", "the", "in", "on", "to", "for", "at", "by", "or"}
        words = t.lower().split(" ")
        t = " ".join(w if (i and w in small) else w[:1].upper() + w[1:] for i, w in enumerate(words))
    return t


def clean_title(raw):
    """'PRACTICAL MAGIC [DVD] [CANADIAN; FRENCH]' -> ('Practical Magic', '')
       'Aliens (Blu-ray, 1986)' -> ('Aliens', '1986')"""
    t = str(raw or "")
    year = ""
    for m in re.finditer(r"[\(\[]([^\)\]]*)[\)\]]", t):
        year = year or _year(m.group(1))
    t = re.sub(r"[\(\[]([^\)\]]*)[\)\]]", lambda m: "" if _PACKAGING.search(m.group(1)) else m.group(0), t)
    t = re.sub(r"^(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,}\s+", "", t.strip())   # a shop's stock code
    t = re.sub(r"(?i)[\s,:-]+(dvd|blu[\s-]?ray|4k( uhd)?|vhs|cd|vinyl|lp|cassette|widescreen)\s*$", "", t)
    t = re.sub(r"\s+", " ", t).strip(" -,:;")
    return _titlecase(t), year


# -- the lookups -------------------------------------------------------------

def _open_library(code, f):
    d = f.json("https://openlibrary.org/isbn/%s.json" % code)
    if not d or not d.get("title"):
        return None
    authors = []
    for a in (d.get("authors") or [])[:3]:
        key = str(a.get("key", ""))
        if re.fullmatch(r"/authors/OL\d+A", key):
            got = f.json("https://openlibrary.org%s.json" % key) or {}
            if got.get("name"):
                authors.append(got["name"])
    if not authors and d.get("by_statement"):
        authors.append(str(d["by_statement"]).strip(" ."))
    title = d["title"] + (": " + d["subtitle"] if d.get("subtitle") else "")
    fmt = _pick((("Hardcover", r"hard"), ("Paperback", r"paper|soft"), ("Audiobook", r"audio")),
                d.get("physical_format"))
    return {"type": "book", "title": title, "creator": ", ".join(authors), "year": _year(d.get("publish_date")),
            "format": fmt, "cover_url": "https://covers.openlibrary.org/b/isbn/%s-L.jpg?default=false" % code,
            "source": "Open Library"}


def _musicbrainz(code, f):
    d = f.json("https://musicbrainz.org/ws/2/release/?query=barcode:%s&fmt=json&limit=5" % code)
    rels = [r for r in (d or {}).get("releases") or [] if str(r.get("barcode", "")).lstrip("0") == code.lstrip("0")]
    if not rels:
        return None
    r = rels[0]
    credit = "".join(c.get("name", "") + c.get("joinphrase", "") for c in r.get("artist-credit") or [])
    media = " ".join(str(m.get("format", "")) for m in r.get("media") or [])
    uid = r"[0-9a-f-]{36}"
    rid, gid = str(r.get("id", "")), str((r.get("release-group") or {}).get("id", ""))
    # this pressing's front, else the album's (the Cover Art Archive)
    cover = [u for u, i in (("https://coverartarchive.org/release/%s/front-500", rid),
                            ("https://coverartarchive.org/release-group/%s/front-500", gid))
             if re.fullmatch(uid, i) for u in [u % i]]
    return {"type": "music", "title": r.get("title", ""), "creator": credit.strip(), "year": _year(r.get("date")),
            "format": _pick(MUSIC_FORMATS, media), "cover_url": cover, "source": "MusicBrainz"}


def _upcitemdb(code, f):
    d = f.json("https://api.upcitemdb.com/prod/trial/lookup?upc=%s" % code)
    if d and d.get("code") == "TOO_FAST":
        raise ValueError("The UPC lookup wants a short rest; try again in a minute.")
    if d and d.get("code") == "EXCEED_LIMIT":
        raise ValueError("The UPC lookup's free 100 for today are used up; type this one in, or try tomorrow.")
    items = (d or {}).get("items") or []
    if not items:
        return None
    it = items[0]
    raw, cat = str(it.get("title", "")), str(it.get("category", ""))
    low = (raw + " " + cat).lower()
    if "video game" in low or (_pick(GAME_PLATFORMS, raw) and "dvd" not in low and "music" not in low):
        kind = "game"
    elif "music" in cat.lower() or _pick(MUSIC_FORMATS, raw):
        kind = "music"
    elif "book" in cat.lower():
        kind = "book"
    elif _pick(FILM_FORMATS, raw) or "dvd" in low or "video" in cat.lower() or "movie" in low:
        kind = "film"
    else:
        kind = "other"
    title, year = clean_title(raw)
    creator = ""
    if kind == "music" and " - " in title:              # "Betty Buckley - Ghostlight - Opera / Vocal - CD"
        parts = [p.strip() for p in title.split(" - ") if p.strip()]
        creator, title = parts[0], parts[1] if len(parts) > 1 else parts[0]
    fmt = {"film": lambda: _pick(FILM_FORMATS, raw, cat), "music": lambda: _pick(MUSIC_FORMATS, raw, cat),
           "game": lambda: _pick(GAME_PLATFORMS, raw, cat)}.get(kind, lambda: "")()
    if kind == "game":
        title = re.sub(r"(?i)\s*[-:]\s*(" + "|".join(p for _, p in GAME_PLATFORMS) + r").*$", "", title).strip() or title
    imgs = [u for u in it.get("images") or [] if str(u).startswith("https://")]
    return {"type": kind, "title": title, "creator": creator, "year": year or "", "format": fmt,
            "cover_url": imgs[0] if imgs else "", "source": "UPC database", "raw": raw}


def _norm(t):
    return re.sub(r"[^a-z0-9]+", " ", str(t or "").lower()).strip()


def _wikidata(title, kind, f):
    """{year, creator} from Wikidata's one-line description of a film or game
    with exactly that name ("1998 film directed by Griffin Dunne"), or None."""
    q = urllib.parse.urlencode({"action": "wbsearchentities", "search": title, "language": "en",
                                "type": "item", "format": "json", "limit": 15})
    d = f.json("https://www.wikidata.org/w/api.php?" + q) or {}
    word = r"\bfilm\b|\bmovie\b" if kind == "film" else r"video game"
    for r in d.get("search") or []:
        desc = str(r.get("description") or "")
        if _norm(r.get("label")) != _norm(title) or not re.search(word, desc, re.I):
            continue
        by = re.search(r"(?:directed|developed) by ([^,;(]+)|\bfilm by ([^,;(]+)", desc)
        return {"year": _year(desc), "creator": (by.group(1) or by.group(2)).strip() if by else ""}
    return None


def _fetch_cover(url, f, cache):
    """The cover into the cache: (path, data-url preview) or ('', '')."""
    if not url:
        return "", ""
    try:
        raw = f.get(url, limit=MAX_IMAGE, accept="image/*")
    except ValueError:
        return "", ""
    if not raw:
        return "", ""
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        if im.width < 40 or im.height < 40:
            return "", ""
    except Exception:                                             # noqa: BLE001
        return "", ""
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, "cover-%d-%s.jpg" % (int(time.time() * 1000), os.getpid()))
    im.save(path, "JPEG", quality=92)
    small = im.copy()
    small.thumbnail((360, 360))
    buf = io.BytesIO()
    small.save(buf, "JPEG", quality=85)
    return path, "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def prune(cache, older=86400):
    try:
        names = os.listdir(cache)
    except OSError:
        return
    now = time.time()
    for n in names:
        p = os.path.join(cache, n)
        try:
            if os.path.isfile(p) and now - os.path.getmtime(p) > older:
                os.remove(p)
        except OSError:
            pass


def lookup(code, cache, fetcher=None):
    """{ok, code, found, type, title, creator, year, format, cover, preview,
    source} -- or {error} when it isn't a barcode or nothing could be asked."""
    n = normalise(code)
    if not n:
        return {"error": "That isn't a barcode number (check the digits)."}
    f = fetcher or _Fetcher()
    prune(cache)
    hit, problems = None, []
    order = (_open_library,) if is_isbn(n) else (_musicbrainz, _upcitemdb)
    for ask in order:
        try:
            hit = ask(n, f)
        except ValueError as e:
            problems.append(str(e))
            continue
        if hit:
            break
    if not hit:
        if problems and len(problems) == len(order):
            return {"error": problems[-1]}
        return {"ok": True, "code": n, "found": False, "type": "book" if is_isbn(n) else "",
                "title": "", "creator": "", "year": "", "format": "", "cover": "", "preview": "",
                "source": "", "note": problems[-1] if problems else ""}
    if hit["type"] in ("film", "game") and hit["title"] and not hit["year"]:
        try:
            more = _wikidata(hit["title"], hit["type"], f)
        except ValueError:
            more = None
        if more:
            hit["year"] = more["year"]
            hit["creator"] = hit["creator"] or more["creator"]
    urls = hit.pop("cover_url", "")
    cover = preview = ""
    for url in (urls if isinstance(urls, (list, tuple)) else [urls]):
        cover, preview = _fetch_cover(url, f, cache)
        if cover:
            break
    out = {"ok": True, "code": n, "found": True, "cover": cover, "preview": preview}
    out.update({k: hit.get(k, "") for k in ("type", "title", "creator", "year", "format", "source", "raw")})
    return out


# -- a cover from the clipboard or a web address (15 Nov 2026) ---------------
# Cam: "if i copy Dust bunny cover have the edit window open and the window
# active, pressing Ctrl + V will paste the photo in as the cover", and drag a
# picture in from a web page. A browser's "Copy image" doesn't always reach
# the page as a picture (Qt's web view on Wayland), and a dragged picture is
# often only its address, so NeuroNet reads the clipboard itself (wl-paste)
# and fetches an address it's given -- public addresses only, as above.

_IMG_SRC = re.compile(r"""<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']""", re.I)
_PIC_TYPES = ("image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp")


def save_picture(raw, cache):
    """Bytes that are a picture -> {path} in the cache (PNG, or JPEG when
    there's no transparency), else {error}."""
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw))
        im.load()
    except Exception:                                             # noqa: BLE001
        return {"error": "That isn't a picture NeuroNet can read."}
    if im.width < 16 or im.height < 16:
        return {"error": "That picture is too small to be a cover."}
    os.makedirs(cache, exist_ok=True)
    prune(cache)
    alpha = im.mode in ("RGBA", "LA", "P")
    path = os.path.join(cache, "picture-%d-%s.%s" % (int(time.time() * 1000), os.getpid(), "png" if alpha else "jpg"))
    if alpha:
        im.convert("RGBA").save(path, "PNG")
    else:
        im.convert("RGB").save(path, "JPEG", quality=93)
    return {"path": path}


def picture_from_url(url, cache, fetcher=None):
    """A picture's address (web, data: or file://, or a file's path) -> {path} or {error}."""
    url = str(url or "").strip()
    if not url:
        return {"error": "No picture there."}
    if url.startswith("data:image/"):
        try:
            return save_picture(base64.b64decode(url.split(",", 1)[1]), cache)
        except (IndexError, ValueError):
            return {"error": "That picture couldn't be read."}
    if url.startswith("file://") or url.startswith("/"):
        p = urllib.parse.unquote(urllib.parse.urlsplit(url).path) if url.startswith("file://") else url
        if not os.path.isfile(p):
            return {"error": "That file isn't there."}
        with open(p, "rb") as fh:
            return save_picture(fh.read(MAX_IMAGE + 1)[:MAX_IMAGE], cache)
    if not re.match(r"(?i)^https?://", url):
        return {"error": "That isn't a picture's address."}
    try:
        raw = (fetcher or _Fetcher()).get(url, limit=MAX_IMAGE, accept="image/*")
    except ValueError as e:
        return {"error": str(e)}
    if not raw:
        return {"error": "The picture wasn't there."}
    return save_picture(raw, cache)


def url_in(text):
    """The picture address in pasted or dropped text (a link, a list of
    links, or a bit of a web page holding an <img>), or ''."""
    t = str(text or "")
    m = _IMG_SRC.search(t)
    if m:
        return html_unescape(m.group(1))
    for line in t.splitlines():
        line = line.strip()
        if line and not line.startswith("#") and re.match(r"(?i)^(https?://|file://|data:image/)\S+$", line):
            return line
    return ""


def html_unescape(s):
    import html
    return html.unescape(s)


def clipboard_picture(cache, run=None, fetcher=None):
    """What's on the clipboard as a picture -> {path}, or {none: True} when
    it holds no picture (or wl-paste isn't here), or {error}."""
    if run is None:
        if not shutil.which("wl-paste"):
            return {"none": True}
        run = lambda args: subprocess.run(args, capture_output=True, timeout=10)   # noqa: E731
    try:
        r = run(["wl-paste", "--list-types"])
    except (OSError, subprocess.SubprocessError):
        return {"none": True}
    types = [x.strip() for x in (r.stdout.decode("utf-8", "replace") if isinstance(r.stdout, bytes) else r.stdout).splitlines()]
    pic = next((t for t in _PIC_TYPES if t in types), "") or next((t for t in types if t.startswith("image/")), "")

    def read(kind):
        try:
            got = run(["wl-paste", "--no-newline", "--type", kind])
        except (OSError, subprocess.SubprocessError):
            return b""
        return got.stdout if got.returncode == 0 else b""

    if pic:
        raw = read(pic)
        return save_picture(raw, cache) if raw else {"none": True}
    for kind in ("text/uri-list", "text/html", "text/plain"):
        if kind in types or (kind == "text/plain" and any(t.startswith("text/plain") for t in types)):
            url = url_in(read(kind).decode("utf-8", "replace"))
            if url:
                return picture_from_url(url, cache, fetcher)
    return {"none": True}
