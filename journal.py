"""Mindfulness -> Journal: Cam's personal journal.

(It began as Notes -> Journal; Cam: "fully migrate the journal to live in
mindfullness, change the name from thought journal to just be journal." It
took Thought Journal's place, and migrate_thoughts() brings in what was
written there.)

Cam: "the journal will act as a place i can write anything, that note section
will be more personal and i should also have the ability to add photos to
journal entries." Divination's readings live here too: "just have the entry
save to journal in the Notes main section under journal subsection (with the
card images)".

ITS OWN STORE, NOT VAULT NOTES. Fleeting notes are vault notes because Cam
copies out of them into other notes. A journal entry is kept and re-read: it
carries photos, and a reading carries its cards, some of them reversed, which
markdown cannot draw. So: journal/journal.json and journal/images/.

EVERY PICTURE IS A PRIVATE COPY, downsized. A reading must still show its
cards after the deck is deleted, and a journal photo must survive being tidied
out of the photo library. The copies are small (JOURNAL_MAX_DIM), so a
journal of years stays small too.

    entry = {id, created, date, title, text, photos: [name],
             reading: None | {kind, deckName, spreadName,
                              cards: [{name, image, reversed, positionLabel,
                                       meaning}]}}
"""
import base64
import json
import os
import re
import shutil
import tempfile
import time
import uuid
from datetime import datetime

#: Provides the NeuroNet data folder. Set by neuronet.py; tests point it at a
#: scratch folder.
DATA_DIR_PROVIDER = None

JOURNAL_MAX_DIM = 1600       # a photo in an entry, opened big
CARD_MAX_DIM = 900           # a card in a reading
THUMB_MAX_DIM = 480
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp")
KINDS = ("tarot", "oracle", "lenormand")
_SAFE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.-]{0,160}$")


# ------------------------------------------------------------------ paths --
def root():
    d = os.path.join(DATA_DIR_PROVIDER(), "journal")
    os.makedirs(d, exist_ok=True)
    return d


def images_dir():
    d = os.path.join(root(), "images")
    os.makedirs(d, exist_ok=True)
    return d


def thumbs_dir():
    d = os.path.join(root(), "thumbs")
    os.makedirs(d, exist_ok=True)
    return d


def journal_file():
    return os.path.join(root(), "journal.json")


# --------------------------------------------------------------------- io --
def _read():
    try:
        with open(journal_file(), encoding="utf-8") as f:
            doc = json.load(f)
    except (OSError, ValueError):
        doc = {}
    if not isinstance(doc, dict):
        doc = {}
    entries = doc.get("entries")
    doc["entries"] = [normalize(e) for e in entries if isinstance(e, dict)] \
        if isinstance(entries, list) else []
    return doc


def _write(doc):
    path = journal_file()
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def plain(v):
    """Text, whatever shape it arrived in. Decks from Cam's Collective kept
    rich text as [[text, [styles]], ...] runs."""
    if isinstance(v, list):
        return "".join(r[0] if isinstance(r, list) and r and isinstance(r[0], str)
                       else (r if isinstance(r, str) else "") for r in v).strip("\n")
    return v if isinstance(v, str) else ("" if v is None else str(v))


def _new_id():
    return "jn-" + uuid.uuid4().hex[:12]


def _now():
    return datetime.now().isoformat(timespec="seconds")


def normalize(e):
    """An entry, every field present and of the right type."""
    out = {
        "id": str(e.get("id") or _new_id()),
        "created": str(e.get("created") or _now()),
        "date": str(e.get("date") or str(e.get("created") or _now())[:10])[:10],
        "title": str(e.get("title") or "").strip()[:200],
        "text": str(e.get("text") or ""),
        "photos": [p for p in (e.get("photos") or []) if isinstance(p, str) and _SAFE.match(p)],
        "reading": None,
    }
    r = e.get("reading")
    if isinstance(r, dict):
        out["reading"] = {
            "kind": r.get("kind") if r.get("kind") in KINDS else "tarot",
            "deckName": str(r.get("deckName") or ""),
            "spreadName": str(r.get("spreadName") or ""),
            "cards": [{
                "name": str(c.get("name") or ""),
                "image": c.get("image") if isinstance(c.get("image"), str)
                and _SAFE.match(c.get("image")) else None,
                "reversed": bool(c.get("reversed")),
                "positionLabel": str(c.get("positionLabel") or ""),
                "meaning": plain(c.get("meaning")),
            } for c in (r.get("cards") or []) if isinstance(c, dict)],
        }
    return out


def _sort(entries):
    return sorted(entries, key=lambda e: (e["date"], e["created"]), reverse=True)


# ----------------------------------------------------------------- images --
def _unused_name(stem, ext):
    stem = re.sub(r"[^A-Za-z0-9 _.-]+", "", stem).strip(" .")[:80] or "image"
    name, n = stem + ext, 2
    while os.path.exists(os.path.join(images_dir(), name)):
        name = "%s-%d%s" % (stem, n, ext)
        n += 1
    return name


def copy_image(src, stem, max_dim=JOURNAL_MAX_DIM):
    """A downsized private copy of `src` in journal/images; its name, or None."""
    if not src or not os.path.isfile(src):
        return None
    ext = os.path.splitext(src)[1].lower()
    if ext not in IMAGE_EXTS:
        return None
    try:
        from PIL import Image
        img = Image.open(src)
        animated = getattr(img, "is_animated", False)
        if not animated:
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.thumbnail((max_dim, max_dim), Image.LANCZOS)
            name = _unused_name(stem, ".jpg")
            img.save(os.path.join(images_dir(), name), "JPEG", quality=85, optimize=True)
            return name
    except Exception:
        pass                     # no Pillow, or an odd file: keep it as it is
    name = _unused_name(stem, ext)
    shutil.copy2(src, os.path.join(images_dir(), name))
    return name


def image_path(name, thumb=False):
    """The picture's file (its small copy if thumb, made when needed), or None."""
    base = os.path.basename(str(name or ""))
    if not base or base != name:
        return None
    src = os.path.join(images_dir(), base)
    if not os.path.isfile(src):
        return None
    path = src
    if thumb:
        dest = os.path.join(thumbs_dir(), os.path.splitext(base)[0] + ".thumb.jpg")
        try:
            if not os.path.isfile(dest) or os.path.getmtime(dest) < os.path.getmtime(src):
                from PIL import Image
                img = Image.open(src)
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                img.thumbnail((THUMB_MAX_DIM, THUMB_MAX_DIM), Image.LANCZOS)
                img.save(dest, "JPEG", quality=75, optimize=True)
            path = dest
        except Exception:
            path = src
    return path


def image_url(name, thumb=False):
    """The picture as data, for what must stand on its own (a printout)."""
    path = image_path(name, thumb)
    if not path:
        return None
    ext = os.path.splitext(path)[1].lower()
    mime = {".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}.get(ext, "image/jpeg")
    try:
        with open(path, "rb") as f:
            return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))
    except OSError:
        return None


def _referenced(entries):
    names = set()
    for e in entries:
        names.update(e["photos"])
        if e["reading"]:
            names.update(c["image"] for c in e["reading"]["cards"] if c["image"])
    return names


def _sweep(entries, grace=86400):
    """Removes pictures no entry uses any more. A picture added in the last
    day is kept even so: it may belong to an entry still being written."""
    keep = _referenced(entries)
    now = time.time()
    for name in os.listdir(images_dir()):
        path = os.path.join(images_dir(), name)
        if name in keep or not os.path.isfile(path):
            continue
        if now - os.path.getmtime(path) < grace:
            continue
        try:
            os.remove(path)
            thumb = os.path.join(thumbs_dir(), os.path.splitext(name)[0] + ".thumb.jpg")
            if os.path.isfile(thumb):
                os.remove(thumb)
        except OSError:
            pass


# ---------------------------------------------------------------- entries --
def list_entries():
    return _sort(_read()["entries"])


def save_entry(entry):
    """Adds a new entry, or replaces the one with the same id."""
    if not isinstance(entry, dict):
        return {"error": "That isn't a journal entry."}
    doc = _read()
    e = normalize(entry)
    if not (e["title"] or e["text"].strip() or e["photos"] or e["reading"]):
        return {"error": "Write something first."}
    for i, old in enumerate(doc["entries"]):
        if old["id"] == e["id"]:
            e["created"] = old["created"]
            if e["reading"] is None and old["reading"] is not None and "reading" not in entry:
                e["reading"] = old["reading"]
            doc["entries"][i] = e
            break
    else:
        doc["entries"].append(e)
    _write(doc)
    _sweep(doc["entries"])
    return {"ok": True, "entry": e}


def delete_entry(entry_id):
    doc = _read()
    before = len(doc["entries"])
    doc["entries"] = [e for e in doc["entries"] if e["id"] != entry_id]
    if len(doc["entries"]) == before:
        return {"error": "That entry isn't in the journal any more."}
    _write(doc)
    _sweep(doc["entries"], grace=0)
    return {"ok": True}


def add_reading(reading, text="", title="", cards_images_dir=None, date=None):
    """A reading as a new entry, its card faces copied in.

    `reading.cards[].image` names a file in the cards folder
    (`cards_images_dir`); each is copied, so the entry keeps its cards
    whatever later happens to the deck."""
    if not isinstance(reading, dict) or not reading.get("cards"):
        return {"error": "There are no cards to save."}
    cards = []
    for c in reading.get("cards") or []:
        if not isinstance(c, dict):
            continue
        img = None
        src_name = os.path.basename(str(c.get("image") or ""))
        if src_name and cards_images_dir:
            img = copy_image(os.path.join(cards_images_dir, src_name),
                             "%s %s" % (reading.get("deckName") or "card", c.get("name") or ""),
                             CARD_MAX_DIM)
        cards.append(dict(c, image=img))
    deck = str(reading.get("deckName") or "").strip()
    spread = str(reading.get("spreadName") or "").strip()
    entry = {
        "title": title or " · ".join(x for x in (spread, deck) if x) or "Reading",
        "text": text or "",
        "date": date or datetime.now().strftime("%Y-%m-%d"),
        "photos": [],
        "reading": dict(reading, cards=cards),
    }
    return save_entry(entry)


# -------------------------------------------------------------- migration --
def migrate_thoughts(celestial):
    """Mindfulness's old Thought Journal (celestial.json "journal":
    [{id, date, text}]), brought in once. The entries stay in the file,
    unread; the flag stops them coming in twice. Returns how many."""
    doc = _read()
    if doc.get("thoughtsMigrated"):
        return 0
    n = 0
    for t in celestial.get("journal") or []:
        if not isinstance(t, dict) or not str(t.get("text") or "").strip():
            continue
        date = str(t.get("date") or _now()[:10])[:10]
        doc["entries"].append(normalize({
            "id": "jn-th-" + str(t.get("id") or _new_id()),
            "created": date + "T12:00:00", "date": date,
            "title": "", "text": t.get("text"), "photos": [], "reading": None,
        }))
        n += 1
    doc["thoughtsMigrated"] = True
    _write(doc)
    return n


def migrate_readings(celestial, cards_images_dir):
    """Divination's saved readings, brought in once.

    Divination kept readings per kind (tarotReadings, ...). They become
    journal entries with their card faces, their date and their notes. The
    readings stay in celestial.json, unread, as the record of what was
    moved; the flag stops them coming in twice. Returns how many."""
    doc = _read()
    if doc.get("readingsMigrated"):
        return 0
    decks = {d.get("id"): d for k in KINDS for d in (celestial.get(k + "Decks") or [])
             if isinstance(d, dict)}
    n = 0
    for kind in KINDS:
        for r in celestial.get(kind + "Readings") or []:
            if not isinstance(r, dict):
                continue
            deck = decks.get(r.get("deckId")) or {}
            by_id = {c.get("id"): c for c in deck.get("cards") or []}
            cards = []
            for c in r.get("cards") or []:
                card = by_id.get(c.get("cardId") or c.get("id")) or {}
                img_name = c.get("image") or card.get("image")
                img = copy_image(os.path.join(cards_images_dir, img_name),
                                 "%s %s" % (deck.get("name") or "card", c.get("name") or ""),
                                 CARD_MAX_DIM) if img_name else None
                rev = bool(c.get("reversed"))
                cards.append({"name": c.get("name") or card.get("name") or "",
                              "image": img, "reversed": rev,
                              "positionLabel": c.get("positionLabel") or "",
                              "meaning": plain(card.get("reversed") if rev else card.get("upright"))})
            deck_name = r.get("deckName") or deck.get("name") or ""
            spread = r.get("spreadName") or ""
            doc["entries"].append(normalize({
                "id": "jn-" + str(r.get("id") or _new_id()),
                "created": (r.get("date") or _now()[:10]) + "T12:00:00",
                "date": r.get("date") or _now()[:10],
                "title": " · ".join(x for x in (spread, deck_name) if x) or "Reading",
                "text": r.get("notes") or "",
                "photos": [],
                "reading": {"kind": kind, "deckName": deck_name, "spreadName": spread,
                            "cards": cards},
            }))
            n += 1
    doc["readingsMigrated"] = True
    _write(doc)
    return n
