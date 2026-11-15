"""Ebooks — the library, and the books themselves, for Notes → Ebooks.

Cam: "add a new sub section called ebooks. This should be an ebook library
and reader. It should have a bookmarks feature as well and a bookmarks sub
section. Further i want a tool where i can highlight over an ebook if
possible."

WHAT IS READ. EPUB (the ebook format almost everything uses), PDF (drawn by
the pdf.js Notes already ships), and plain text. Each book is copied into
neuronet_data/ebooks/files/ -- the library never depends on a file that
might be moved or deleted from wherever Cam downloaded it.

AN EPUB IS A ZIP OF WEB PAGES. This opens it, follows its own table of
contents and reading order, and hands the interface one chapter at a time as
CLEAN HTML: headings, paragraphs, lists, tables, emphasis, images (inlined,
so nothing is fetched), and nothing else. The book's own stylesheets are left
behind on purpose -- they were written for a phone's reading app, and let
loose inside NeuroNet they would restyle the app around them. The reader sets
the type instead, and the size and paper colour are Cam's to choose.

WHAT IS KEPT PER BOOK, in library.json beside the files:
  position    where he stopped reading -- moves on its own as he reads
  bookmarks   places he CHOSE to come back to -- never moved by reading
  highlights  passages he marked, each with a colour and an optional note
These are separate on purpose (the lesson from Cam's Collective's Cortex):
merge position and bookmarks and reading past a bookmark quietly destroys it.
"""
import base64
import datetime
import html
import io
import json
import mimetypes
import os
import posixpath
import re
import shutil
import threading
import uuid
import zipfile
from html.parser import HTMLParser

FORMATS = {".epub": "epub", ".pdf": "pdf", ".txt": "txt"}
_lock = threading.Lock()


def _now():
    return datetime.datetime.now().isoformat(timespec="seconds")


class Library:
    """Everything about the shelf, rooted at one folder so a test can point
    it anywhere."""

    def __init__(self, root):
        self.root = root

    # ------------------------------------------------------------------ files
    @property
    def files_dir(self):
        d = os.path.join(self.root, "files")
        os.makedirs(d, exist_ok=True)
        return d

    @property
    def index_path(self):
        return os.path.join(self.root, "library.json")

    def _read(self):
        try:
            with open(self.index_path, encoding="utf-8") as f:
                doc = json.load(f)
        except FileNotFoundError:
            return {"books": []}
        except (OSError, ValueError) as e:
            raise LibraryError("Couldn't read the ebook library (%s). It has "
                               "been left exactly as it is." % e)
        if not isinstance(doc, dict) or not isinstance(doc.get("books"), list):
            raise LibraryError("The ebook library isn't in the expected shape. "
                               "It has been left exactly as it is.")
        return doc

    def _write(self, doc):
        os.makedirs(self.root, exist_ok=True)
        tmp = self.index_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
        os.replace(tmp, self.index_path)

    def path_of(self, book):
        return os.path.join(self.files_dir, book["file"])

    # ---------------------------------------------------------------- the shelf
    def list(self):
        try:
            doc = self._read()
        except LibraryError as e:
            return {"books": [], "error": str(e)}
        books = [clean_book(b) for b in doc["books"] if isinstance(b, dict) and b.get("id")]
        books.sort(key=lambda b: (sort_key(b.get("title")), sort_key(b.get("author"))))
        return {"books": books}

    def get(self, book_id):
        for b in self._read()["books"]:
            if b.get("id") == book_id:
                return b
        return None

    def import_paths(self, paths):
        added, skipped = [], []
        with _lock:
            try:
                doc = self._read()
            except LibraryError as e:
                return {"error": str(e)}
            for src in paths or []:
                src = str(src)
                ext = os.path.splitext(src)[1].lower()
                fmt = FORMATS.get(ext)
                name = os.path.basename(src)
                if not fmt:
                    skipped.append({"name": name, "why": "Only EPUB, PDF and plain text "
                                    "books can be read here."})
                    continue
                if not os.path.isfile(src):
                    skipped.append({"name": name, "why": "That file is gone."})
                    continue
                # The same file added twice: the same name and the same size.
                size = os.path.getsize(src)
                if any(b.get("source") == name and b.get("size") == size for b in doc["books"]):
                    skipped.append({"name": name, "why": "It is already in the library."})
                    continue
                book_id = uuid.uuid4().hex[:12]
                dest_name = book_id + ext
                dest = os.path.join(self.files_dir, dest_name)
                try:
                    shutil.copyfile(src, dest)
                    meta = read_meta(dest, fmt, fallback_title=os.path.splitext(name)[0])
                except Exception as e:
                    if os.path.exists(dest):
                        os.remove(dest)
                    skipped.append({"name": name, "why": "It couldn't be opened (%s)." % e})
                    continue
                book = {"id": book_id, "file": dest_name, "format": fmt,
                        "source": name, "size": size, "added": _now(), "opened": "",
                        "position": {}, "bookmarks": [], "highlights": []}
                book.update(meta)
                doc["books"].append(book)
                added.append(clean_book(book))
            self._write(doc)
        return {"added": added, "skipped": skipped}

    def shelve(self, src):
        """A book NeuroNet itself provides (NeuroPets' How to Play guide, 2026-10-20): on the shelf once, by its file name;
        when a release brings a newer copy, the file is swapped in place -- Cam's position, bookmarks and highlights stay."""
        src = str(src)
        name, ext = os.path.basename(src), os.path.splitext(src)[1].lower()
        if not os.path.isfile(src) or ext not in FORMATS:
            return {"error": "That book isn't there."}
        size = os.path.getsize(src)
        with _lock:
            doc = self._read()
            for b in doc["books"]:
                if b.get("source") == name:
                    if b.get("size") == size:
                        return {"ok": True, "id": b["id"], "fresh": False}
                    shutil.copyfile(src, os.path.join(self.files_dir, b["file"]))
                    b["size"] = size
                    self._write(doc)
                    return {"ok": True, "id": b["id"], "fresh": False, "refreshed": True}
        r = self.import_paths([src])
        if r.get("added"):
            return {"ok": True, "id": r["added"][0]["id"], "fresh": True}
        return {"error": (r.get("skipped") or [{}])[0].get("why") or r.get("error") or "It couldn't be shelved."}

    def update(self, book_id, patch):
        """Only these fields are Cam's to change; anything else in the patch
        is ignored -- and SAID to be, rather than appearing to save."""
        allowed = {"title", "author", "position", "bookmarks", "highlights",
                   "opened", "pages", "cover"}
        patch = patch if isinstance(patch, dict) else {}
        unknown = [k for k in patch if k not in allowed]
        with _lock:
            doc = self._read()
            for b in doc["books"]:
                if b.get("id") == book_id:
                    for k in allowed & set(patch):
                        b[k] = patch[k]
                    self._write(doc)
                    out = {"ok": True, "book": clean_book(b)}
                    if unknown:
                        out["ignored"] = unknown
                    return out
        return {"error": "That book is not in the library."}

    def remove(self, book_id):
        with _lock:
            doc = self._read()
            keep, gone = [], None
            for b in doc["books"]:
                (keep.append(b) if b.get("id") != book_id else None)
                if b.get("id") == book_id:
                    gone = b
            if not gone:
                return {"ok": True}
            doc["books"] = keep
            self._write(doc)
            try:
                os.remove(self.path_of(gone))
            except OSError:
                pass
        return {"ok": True}

    # ------------------------------------------------------------- the contents
    def chapter(self, book_id, index):
        book = self.get(book_id)
        if not book:
            return {"error": "That book is not in the library."}
        path = self.path_of(book)
        try:
            if book["format"] == "epub":
                return epub_chapter(path, int(index))
            if book["format"] == "txt":
                return txt_chapter(path, int(index))
        except (OSError, zipfile.BadZipFile, KeyError, ValueError) as e:
            return {"error": "That chapter couldn't be read (%s)." % e}
        return {"error": "A %s is read page by page, not by chapter." % book["format"]}

    def pdf_data(self, book_id):
        book = self.get(book_id)
        if not book or book.get("format") != "pdf":
            return {"error": "That is not a PDF in the library."}
        try:
            with open(self.path_of(book), "rb") as f:
                return {"data": "data:application/pdf;base64,"
                        + base64.b64encode(f.read()).decode("ascii")}
        except OSError as e:
            return {"error": "The PDF couldn't be read (%s)." % e}


class LibraryError(Exception):
    pass


def sort_key(s):
    """Alphabetical the way a shelf is: case ignored, a leading "The"/"A"
    ignored, numbers read as numbers ("Book 2" before "Book 10")."""
    s = str(s or "").strip().lower()
    s = re.sub(r"^(the|a|an)\s+", "", s)
    return [int(p) if p.isdigit() else p for p in re.split(r"(\d+)", s)]


def clean_book(b):
    """A book record with every field present and the right type."""
    out = dict(b)
    for k, v in (("title", ""), ("author", ""), ("format", ""), ("cover", ""),
                 ("toc", []), ("position", {}), ("bookmarks", []), ("highlights", []),
                 ("chapters", 0), ("pages", 0), ("opened", "")):
        if not isinstance(out.get(k), type(v)):
            out[k] = v
    return out


# ============================================================================
# Reading a book's details on import
# ============================================================================

def read_meta(path, fmt, fallback_title=""):
    if fmt == "epub":
        return epub_meta(path, fallback_title)
    if fmt == "txt":
        chapters = txt_split(path)
        return {"title": fallback_title, "author": "", "cover": "",
                "chapters": len(chapters),
                "toc": [{"index": i, "title": c["title"]} for i, c in enumerate(chapters)]}
    # PDF: the page count and the cover are read by pdf.js the first time
    # it is opened; the title is the file's name until Cam changes it.
    return {"title": fallback_title, "author": "", "cover": "", "chapters": 0, "toc": []}


def _xml_text(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


class _Epub:
    """The parts of an EPUB this needs: where each file is, the reading
    order (the spine), and the table of contents."""

    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        container = self.z.read("META-INF/container.xml").decode("utf-8", "replace")
        m = re.search(r'full-path="([^"]+)"', container)
        if not m:
            raise ValueError("no rootfile")
        self.opf_path = m.group(1)
        self.base = posixpath.dirname(self.opf_path)
        self.opf = self.z.read(self.opf_path).decode("utf-8", "replace")
        self.manifest = {}
        for item in re.finditer(r"<(?:\w+:)?item\b([^>]*)/?>", self.opf):
            a = dict(re.findall(r'([\w:-]+)="([^"]*)"', item.group(1)))
            if "id" in a and "href" in a:
                self.manifest[a["id"]] = {
                    "href": self.resolve(self.base, html.unescape(a["href"])),
                    "type": a.get("media-type", ""), "props": a.get("properties", "")}
        self.spine = []
        for ref in re.finditer(r"<(?:\w+:)?itemref\b([^>]*)/?>", self.opf):
            a = dict(re.findall(r'([\w:-]+)="([^"]*)"', ref.group(1)))
            it = self.manifest.get(a.get("idref"))
            if it and a.get("linear", "yes") != "no" and "html" in it["type"]:
                self.spine.append(it["href"])
        if not self.spine:
            raise ValueError("no readable chapters")

    @staticmethod
    def resolve(base, href):
        href = href.split("#")[0]
        return posixpath.normpath(posixpath.join(base, href)) if base else posixpath.normpath(href)

    def meta(self, tag):
        m = re.search(r"<dc:%s\b[^>]*>(.*?)</dc:%s>" % (tag, tag), self.opf, re.S | re.I)
        return _xml_text(m.group(1)) if m else ""

    def toc_titles(self):
        """{file: title} from the EPUB 3 nav document, or the EPUB 2 NCX."""
        titles = {}
        nav = next((it for it in self.manifest.values() if "nav" in it["props"].split()), None)
        if nav:
            try:
                raw = self.z.read(nav["href"]).decode("utf-8", "replace")
                navbase = posixpath.dirname(nav["href"])
                m = re.search(r'<nav\b[^>]*toc[^>]*>(.*?)</nav>', raw, re.S | re.I)
                for href, text in re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
                                             m.group(1) if m else raw, re.S | re.I):
                    self._title(titles, navbase, href, _xml_text(text))
            except KeyError:
                pass
        if not titles:
            ncx = next((it for it in self.manifest.values()
                        if it["type"] == "application/x-dtbncx+xml"), None)
            if ncx:
                try:
                    raw = self.z.read(ncx["href"]).decode("utf-8", "replace")
                    ncxbase = posixpath.dirname(ncx["href"])
                    for label, src in re.findall(
                            r"<navLabel>\s*<text>(.*?)</text>\s*</navLabel>\s*<content\s+src=\"([^\"]+)\"",
                            raw, re.S):
                        self._title(titles, ncxbase, src, _xml_text(label))
                except KeyError:
                    pass
        return titles

    def _title(self, titles, base, href, title):
        """One contents entry. Books converted from Kindle files by Calibre
        point each entry at an anchor at the very END of the file before the
        chapter (where the old file's page break was), which would name every
        chapter after the one that follows it. An anchor with next to no text
        after it, and a next file to go to, names that next file instead."""
        href = html.unescape(href)
        f = self.resolve(base, href)
        frag = href.partition("#")[2]
        if frag and f in self.spine:
            try:
                raw = self.z.read(f).decode("utf-8", "replace")
                at = re.search(r"""\b(?:id|name)=["']%s["']""" % re.escape(frag), raw)
                if at:
                    after = re.sub(r"<[^>]+>", "", raw[at.end():])
                    i = self.spine.index(f)
                    if len(after.split()) < 12 and i + 1 < len(self.spine):
                        f = self.spine[i + 1]
            except KeyError:
                pass
        titles.setdefault(f, title)

    def cover_bytes(self):
        cover = next((it for it in self.manifest.values() if "cover-image" in it["props"].split()), None)
        if not cover:
            m = re.search(r'<meta\s+[^>]*name="cover"[^>]*content="([^"]+)"', self.opf) \
                or re.search(r'<meta\s+[^>]*content="([^"]+)"[^>]*name="cover"', self.opf)
            if m:
                cover = self.manifest.get(m.group(1))
        if not cover:
            cover = next((it for k, it in self.manifest.items()
                          if "cover" in k.lower() and it["type"].startswith("image/")), None)
        if not cover:
            return None
        try:
            return self.z.read(cover["href"])
        except KeyError:
            return None


def _thumb(raw, width=240):
    """A cover, small enough to keep in the library file."""
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        im.thumbnail((width, int(width * 1.6)))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=78)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return ""


def epub_meta(path, fallback_title=""):
    ep = _Epub(path)
    titles = ep.toc_titles()
    toc = []
    for i, f in enumerate(ep.spine):
        title = titles.get(f) or ""
        if not title:
            try:
                raw = ep.z.read(f).decode("utf-8", "replace")
                m = re.search(r"<h[1-3]\b[^>]*>(.*?)</h[1-3]>", raw, re.S | re.I) \
                    or re.search(r"<title>(.*?)</title>", raw, re.S | re.I)
                title = _xml_text(m.group(1)) if m else ""
            except KeyError:
                title = ""
        toc.append({"index": i, "title": title[:120] or "Section %d" % (i + 1)})
    cover = ep.cover_bytes()
    return {"title": ep.meta("title") or fallback_title,
            "author": ep.meta("creator"),
            "cover": _thumb(cover) if cover else "",
            "chapters": len(ep.spine), "toc": toc}


# ============================================================================
# One chapter, as clean HTML
# ============================================================================

KEEP = {"p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "em", "i", "strong", "b",
        "u", "s", "sub", "sup", "small", "blockquote", "q", "cite", "ul", "ol",
        "li", "dl", "dt", "dd", "table", "thead", "tbody", "tfoot", "tr", "th",
        "td", "caption", "img", "figure", "figcaption", "a", "hr", "pre", "code",
        "span", "div", "section", "article", "aside", "header", "footer", "abbr"}
DROP_WITH_CONTENT = {"script", "style", "head", "title", "svg", "math", "iframe",
                     "object", "embed", "audio", "video", "form", "button", "input",
                     "select", "textarea", "noscript", "template"}
VOID = {"br", "hr", "img"}
# Every element that never has a closing tag. Nesting is counted with these
# left out: an unclosed <input> or <source> counted as an opening would never
# be matched, and would swallow the rest of the chapter.
VOID_ALL = VOID | {"area", "base", "col", "embed", "input", "link", "meta",
                   "param", "source", "track", "wbr"}


class _Clean(HTMLParser):
    """Keeps the structure of a chapter and nothing that could act."""

    def __init__(self, image_url, link_of):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip = 0
        self.image_url = image_url
        self.link_of = link_of

    def handle_starttag(self, tag, attrs):
        tag = tag.lower().split(":")[-1]
        # Inside something being dropped, only count the nesting, so its own
        # closing tag -- and nothing after it -- ends the drop.
        if self.skip:
            if tag not in VOID_ALL:
                self.skip += 1
            return
        if tag in DROP_WITH_CONTENT:
            if tag not in VOID_ALL:
                self.skip = 1
            return
        if tag == "body":
            return
        if tag not in KEEP:
            return
        a = {k.lower(): (v or "") for k, v in attrs}
        keep = []
        if a.get("id"):
            keep.append(('id', "eb-" + a["id"]))
        if tag == "img":
            src = self.image_url(a.get("src") or a.get("xlink:href") or "")
            if not src:
                return
            keep.append(("src", src))
            keep.append(("alt", a.get("alt", "")))
        elif tag == "a":
            target = self.link_of(a.get("href", ""))
            if target:
                keep.append(("data-eb-href", target))
        elif tag in ("td", "th"):
            for k in ("colspan", "rowspan"):
                if a.get(k, "").isdigit():
                    keep.append((k, a[k]))
        attr = "".join(' %s="%s"' % (k, html.escape(v, quote=True)) for k, v in keep)
        self.out.append("<%s%s>" % (tag, attr))

    def handle_startendtag(self, tag, attrs):
        """<x/>: opens and closes at once, so it never changes the nesting.
        (Counting it as an opening was the bug that let one self-closed tag
        inside a dropped block swallow the rest of the chapter.)"""
        if self.skip:
            return
        t = tag.lower().split(":")[-1]
        if t in DROP_WITH_CONTENT:
            return
        self.handle_starttag(tag, attrs)
        if t in KEEP and t not in VOID and self.out and self.out[-1].startswith("<" + t):
            self.out.append("</%s>" % t)

    def handle_endtag(self, tag):
        tag = tag.lower().split(":")[-1]
        if self.skip:
            if tag not in VOID_ALL:
                self.skip -= 1
            return
        if tag not in KEEP or tag in VOID:
            return
        self.out.append("</%s>" % tag)

    def handle_data(self, data):
        if not self.skip:
            self.out.append(html.escape(data, quote=False))


def epub_chapter(path, index):
    ep = _Epub(path)
    if not 0 <= index < len(ep.spine):
        return {"error": "There is no chapter %d." % (index + 1)}
    f = ep.spine[index]
    raw = ep.z.read(f).decode("utf-8", "replace")
    fbase = posixpath.dirname(f)
    images = {}

    def image_url(src):
        if not src or src.startswith(("http:", "https:", "data:")):
            return src if src.startswith("data:") else ""
        p = ep.resolve(fbase, html.unescape(src))
        if p not in images:
            try:
                data = ep.z.read(p)
            except KeyError:
                images[p] = ""
                return ""
            mime = mimetypes.guess_type(p)[0] or "image/jpeg"
            images[p] = "data:%s;base64,%s" % (mime, base64.b64encode(data).decode("ascii"))
        return images[p]

    spine_index = {s: i for i, s in enumerate(ep.spine)}

    def link_of(href):
        """A link inside the book becomes "chapter#anchor"; one out of it is
        dropped -- the reader is not a browser."""
        if not href or href.startswith(("http:", "https:", "mailto:")):
            return ""
        path_part, _, frag = html.unescape(href).partition("#")
        target = ep.resolve(fbase, path_part) if path_part else f
        if target not in spine_index:
            return ""
        return "%d#%s" % (spine_index[target], ("eb-" + frag) if frag else "")

    c = _Clean(image_url, link_of)
    body = re.search(r"<body\b[^>]*>(.*)</body>", raw, re.S | re.I)
    body = body.group(1) if body else raw
    # Covers and full-page plates are often a picture inside an <svg>. The
    # svg goes; the picture in it becomes an ordinary image.
    body = re.sub(r'<(?:\w+:)?image\b[^>]*?(?:xlink:)?href="([^"]+)"[^>]*/?>',
                  r'<img src="\1" alt="">', body, flags=re.I)
    body = re.sub(r"</?(?:\w+:)?svg\b[^>]*>", "", body, flags=re.I)
    c.feed(body)
    c.close()
    return {"index": index, "count": len(ep.spine), "html": "".join(c.out).strip()}


# ============================================================================
# Plain text
# ============================================================================

# "Chapter 3", "PART II", "Book One: The Road", "Prologue" -- a word and a
# number, not any short paragraph that happens to start "Part of the...".
_NUM = r"(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|" \
       r"thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|first|second|third|last)"
_HEADING = re.compile(r"^\s*(?:(?:chapter|book|part)\s+%s\b[.:\-\u2013\u2014]?(?:\s.{0,60})?"
                      r"|prologue|epilogue|introduction|preface|afterword)\s*[.:]?\s*$" % _NUM, re.I)


def txt_split(path, per=120):
    """Chapters from "Chapter ..." lines where the text has them, otherwise
    runs of `per` paragraphs, so a long file is never one enormous page."""
    with open(path, "rb") as f:
        raw = f.read()
    text = None
    # UTF-16 only with its byte-order mark: without one, almost any bytes
    # "decode" as UTF-16, and a Windows text file would come out as nonsense.
    encs = ("utf-16",) if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else ("utf-8-sig", "cp1252")
    for enc in encs:
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    text = (text if text is not None else raw.decode("utf-8", "replace")).replace("\r\n", "\n")
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chapters, cur = [], None
    for p in paras:
        if _HEADING.match(p) and len(p) < 80:
            cur = {"title": p, "paras": []}
            chapters.append(cur)
            continue
        if cur is None or (not any(_HEADING.match(c["title"]) for c in chapters) and len(cur["paras"]) >= per):
            cur = {"title": "Part %d" % (len(chapters) + 1), "paras": []}
            chapters.append(cur)
        cur["paras"].append(p)
    return chapters or [{"title": "Part 1", "paras": []}]


def txt_chapter(path, index):
    chapters = txt_split(path)
    if not 0 <= index < len(chapters):
        return {"error": "There is no part %d." % (index + 1)}
    c = chapters[index]
    body = "<h2>%s</h2>" % html.escape(c["title"]) + "".join(
        "<p>%s</p>" % html.escape(p).replace("\n", "<br>") for p in c["paras"])
    return {"index": index, "count": len(chapters), "html": body}
