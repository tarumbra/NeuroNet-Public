"""KinCrux's data layer, brought into NeuroNet.

Cam: "i now want the two apps merged together into one". Kitchen, Home
(contacts and calendar) and Money keep reading the files they always have --
camily.json, cookery.json and the money file, wherever KinCrux kept them --
so nothing had to move for the merge. Only the PHOTO library is combined, by
its own migration.

This is KinCrux's own module-level code with its Api class and window
bootstrap removed; the merged app's Api delegates to the functions here.
"""


import datetime
import io
import json
import os
import re
import shutil
import sys
import tempfile
import uuid

# The shared core. Python imports resolve through sys.path, so unlike the
# UI's own <script> tags this CAN live in a sibling folder — see the note
# in ui/index.html about why nothing there traverses upward.
sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "crux", "py"))
try:
    import crux_paths                  # noqa: E402
    import crux_print                  # noqa: E402
    import crux_rich                   # noqa: E402
    import crux_store                  # noqa: E402
except ImportError as _e:              # pragma: no cover - startup only
    # A raw ModuleNotFoundError here tells the user nothing. This is the
    # one dependency that is not pip-installable — it ships with the app
    # — so the likely cause is a half-copied folder.
    sys.exit(
        f"KinCrux can't find its shared core ({_e}).\n\n"
        f"crux/py/ must sit beside kincrux.py. Expected it at:\n"
        f"  {os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crux', 'py')}\n\n"
        "Copy the whole app folder, not just kincrux.py.")

# Cam: "schedule name change to Cams Collection K" -- matched to its sibling,
# Cam's Collective S, and to the suite's own name. The file name, the data
# folders and the ids inside stay as they are on purpose: renaming a data
# folder risks stranding a library, and renaming this file breaks however the
# app is launched. Both can be done later, deliberately.
APP_NAME = "Cam's Collective K"

THUMB_MAX_DIM = 360
THUMB_QUALITY = 68
FRAME_MAX_DIM = 1280
FRAME_QUALITY = 78

# Everything Hearth manages. Anything else found in the file is left
# alone on save — see save_data. That matters if an older Camily is
# still installed and writing keys this build doesn't know about.
OWNED_KEYS = ("photos", "albums", "photoTagList", "folders",
              "events", "contacts")

# The Kitchen's own keys. They used to sit in camily.json alongside the
# photo library -- a leftover from the Cheffo merge, and the one module
# without a folder of its own, so a bad write took the family photos and
# the recipes together.
#
# They are deliberately NOT in OWNED_KEYS any more: save_data writes only
# what it owns, so leaving them there would keep writing the Kitchen into
# camily.json as well. The copy already in camily.json is left exactly as
# it was, so Cam's existing Hearth install keeps working and there is a
# pre-split snapshot to fall back on.
COOKERY_KEYS = ("recipes", "menus", "shoppingLists", "tagList", "books")


def app_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def resource_dir():
    if getattr(sys, "frozen", False):
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def ui_dir():
    return os.path.join(resource_dir(), "ui")


# SET BY NEURONET: a function giving NeuroNet's data folder. When it is set,
# the family library, the Kitchen and Money are fixed folders INSIDE it --
# family/, kitchen/, money/ -- and nothing is searched for anywhere else.
#
# Cam: "migrate all the data so it lives within the NeuroNet directory, my
# goal is to fully replace camily and all other apps with this one, so it
# needs to be standalone." The search below looked beside the app, one level
# up, in a sibling Camily folder and in the home folder; on another computer
# that could quietly pick up a stray camily_data/ from anywhere. NeuroNet
# copies the old folders in once (see adopt_outside_data in neuronet.py) and
# from then on only ever uses its own. Left unset -- the older apps that
# share this file -- the search is exactly as it was.
ROOT_PROVIDER = None
# {part: folder} for a part NeuroNet couldn't bring in this launch -- used
# where it is, for this session, rather than showing an empty one.
FALLBACK = {}


def _own(sub):
    if FALLBACK.get(sub) and os.path.isdir(FALLBACK[sub]):
        return FALLBACK[sub]
    d = os.path.join(ROOT_PROVIDER(), sub)
    os.makedirs(d, exist_ok=True)
    return d


def _candidate_roots():
    """Where camily_data/ might be, most likely first."""
    here = app_dir()
    return [
        os.path.join(here, "camily_data"),
        os.path.join(os.path.dirname(here), "camily_data"),
        os.path.join(os.path.dirname(here), "Camily", "camily_data"),
        os.path.join(os.path.expanduser("~"), "camily_data"),
        os.path.join(os.path.expanduser("~"), "Camily", "camily_data"),
    ]


def _cheffo_candidate_roots():
    """Where Cheffo's own data folder might be, most likely first.

    Cheffo kept everything in cheffo_data/ beside cheffo.py, so the
    search mirrors _candidate_roots above: next to Hearth, one level up,
    in a sibling Cheffo folder, and in the home directory.
    """
    here = app_dir()
    return [
        os.path.join(here, "cheffo_data"),
        os.path.join(os.path.dirname(here), "cheffo_data"),
        os.path.join(os.path.dirname(here), "Cheffo", "cheffo_data"),
        os.path.join(os.path.expanduser("~"), "cheffo_data"),
        os.path.join(os.path.expanduser("~"), "Cheffo", "cheffo_data"),
    ]


def find_cheffo_data():
    """The first Cheffo folder that actually has a cheffo.json in it."""
    for root in _cheffo_candidate_roots():
        if os.path.isfile(os.path.join(root, "cheffo.json")):
            return root
    return None


_resolved_root = None


def data_dir():
    """Camily's data folder — the shared library.

    Cached after the first successful lookup. If a pointer file is
    present it wins, which is how Cam can put the library anywhere
    without Capture having to guess.
    """
    global _resolved_root
    if ROOT_PROVIDER:
        return _own("family")
    if _resolved_root:
        return _resolved_root

    pointer = os.path.join(app_dir(), "library_path.txt")
    if os.path.isfile(pointer):
        try:
            with open(pointer, "r", encoding="utf-8") as f:
                chosen = f.read().strip()
            if chosen and os.path.isdir(chosen):
                _resolved_root = chosen
                return _resolved_root
        except OSError:
            pass

    # A folder holding camily.json beats one that merely exists. The
    # fallback below creates an empty camily_data/ beside the app when
    # it finds nothing, and that slot is searched FIRST -- so without
    # this, one launch before the library was copied in would shadow the
    # real one from then on, and the app would show an empty photo
    # library, calendar and contacts. Which reads as having lost them.
    for path in _candidate_roots():
        if os.path.isfile(os.path.join(path, "camily.json")):
            _resolved_root = path
            return _resolved_root

    for path in _candidate_roots():
        if os.path.isdir(path):
            _resolved_root = path
            return _resolved_root

    # Nothing found: fall back to a local folder so the app still runs,
    # but library_found() will report this so the UI can say so.
    fallback = os.path.join(app_dir(), "camily_data")
    os.makedirs(fallback, exist_ok=True)
    _resolved_root = fallback
    return _resolved_root


def set_library_root(path):
    """Points Capture at a chosen folder, and remembers it."""
    global _resolved_root
    if not os.path.isdir(path):
        return False
    _resolved_root = path
    try:
        with open(os.path.join(app_dir(), "library_path.txt"), "w",
                  encoding="utf-8") as f:
            f.write(path)
    except OSError:
        pass  # it still works this session, just isn't remembered
    return True


def data_file():
    return os.path.join(data_dir(), "camily.json")


def prefs_file():
    # Capture's OWN preferences — window state, view mode, sort order.
    # Deliberately not Camily's prefs file: these are different apps
    # with different settings, and sharing it would mean one app's
    # sidebar width fighting the other's.
    # In the data folder, with NeuroNet's own settings (2026-09-29, Cam:
    # "In data folder") -- the person's, not the app folder's. Where the
    # data folder can't be found (the Kitchen on its own, not wired to
    # NeuroNet), beside the app as before: asking where the settings go
    # must never fail, or the export quietly leaves them out.
    try:
        folder = data_dir()
    except Exception:
        folder = None
    return os.path.join(folder or app_dir(), "hearth_prefs.json")


def boards_dir():
    d = os.path.join(notes_backend.data_dir(), "boards")
    os.makedirs(d, exist_ok=True)
    return d


def cells_dir():
    d = os.path.join(notes_backend.data_dir(), "cells")
    os.makedirs(d, exist_ok=True)
    return d


def read_sheet_file(path):
    """Rows from a .csv, .tsv or .xlsx file.

    Separate from the file dialog on purpose: choosing a file needs a window,
    reading one does not, and the reading is the part that can go wrong.

    Cells keep the TEXT they hold, so "=B2*5" imported from a spreadsheet
    stays a formula and this grid works it out with its own engine.
    """
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext in (".csv", ".tsv"):
            import csv
            delim = "\t" if ext == ".tsv" else ","
            with open(path, newline="", encoding="utf-8-sig") as f:
                rows = [[str(c) for c in row] for row in csv.reader(f, delimiter=delim)]
        elif ext == ".xlsx":
            try:
                import openpyxl
            except ImportError:
                return {"error": "Reading .xlsx needs the openpyxl library, "
                                 "which isn't installed on this machine."}
            wb = openpyxl.load_workbook(path, data_only=False)
            ws = wb.active
            rows = [["" if c.value is None else str(c.value) for c in row]
                    for row in ws.iter_rows()]
        else:
            return {"error": "That file type can't be read here — "
                             "use .csv, .tsv or .xlsx."}
    except Exception as e:
        return {"error": f"Couldn't read that file: {e}"}
    if not rows:
        return {"error": "That file had no rows in it."}
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]   # a ragged file squares up
    return {"ok": True, "name": os.path.splitext(os.path.basename(path))[0],
            "rows": rows}


def _doc_path(folder, doc_id):
    """A document id is a plain file name and nothing else -- no slashes, no
    "..". Without this a board or sheet called ../../neuronet.json would
    write wherever it liked. Shared by Boards and Cells so one guard covers
    both rather than two that can drift."""
    name = str(doc_id or "").strip()
    if not name or name != os.path.basename(name) or name.startswith("."):
        return None
    if not re.fullmatch(r"[A-Za-z0-9 _-]{1,80}", name):
        return None
    return os.path.join(folder, name + ".json")


def _board_path(board_id):
    return _doc_path(boards_dir(), board_id)


def _cells_path(sheet_id):
    return _doc_path(cells_dir(), sheet_id)


def _now_stamp():
    return datetime.datetime.now().isoformat(timespec="seconds")


def _board_path(board_id):
    return _doc_path(boards_dir(), board_id)


def _cells_path(sheet_id):
    return _doc_path(cells_dir(), sheet_id)


def _now_stamp():
    return datetime.datetime.now().isoformat(timespec="seconds")


def read_sheet_file(path):
    """Rows from a .csv, .tsv or .xlsx file.

    Separate from the file dialog on purpose: choosing a file needs a window,
    reading one does not, and the reading is the part that can go wrong.

    Cells keep the TEXT they hold, so "=B2*5" imported from a spreadsheet
    stays a formula and this grid works it out with its own engine.
    """
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext in (".csv", ".tsv"):
            import csv
            delim = "\t" if ext == ".tsv" else ","
            with open(path, newline="", encoding="utf-8-sig") as f:
                rows = [[str(c) for c in row] for row in csv.reader(f, delimiter=delim)]
        elif ext == ".xlsx":
            try:
                import openpyxl
            except ImportError:
                return {"error": "Reading .xlsx needs the openpyxl library, "
                                 "which isn't installed on this machine."}
            wb = openpyxl.load_workbook(path, data_only=False)
            ws = wb.active
            rows = [["" if c.value is None else str(c.value) for c in row]
                    for row in ws.iter_rows()]
        else:
            return {"error": "That file type can't be read here — "
                             "use .csv, .tsv or .xlsx."}
    except Exception as e:
        return {"error": f"Couldn't read that file: {e}"}
    if not rows:
        return {"error": "That file had no rows in it."}
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]   # a ragged file squares up
    return {"ok": True, "name": os.path.splitext(os.path.basename(path))[0],
            "rows": rows}


def _doc_path(folder, doc_id):
    """A document id is a plain file name and nothing else -- no slashes, no
    "..". Without this a board or sheet called ../../neuronet.json would
    write wherever it liked. Shared by Boards and Cells so one guard covers
    both rather than two that can drift."""
    name = str(doc_id or "").strip()
    if not name or name != os.path.basename(name) or name.startswith("."):
        return None
    if not re.fullmatch(r"[A-Za-z0-9 _-]{1,80}", name):
        return None
    return os.path.join(folder, name + ".json")


def photos_dir():
    d = os.path.join(data_dir(), "photos")
    os.makedirs(d, exist_ok=True)
    return d


def thumbs_dir():
    d = os.path.join(data_dir(), "photos_thumbs")
    os.makedirs(d, exist_ok=True)
    return d


def frames_dir():
    d = os.path.join(data_dir(), "photos_frame")
    os.makedirs(d, exist_ok=True)
    return d


_SAFE_STEM = re.compile(r"[^A-Za-z0-9 _.-]+")


def _safe_file_stem(name):
    """A person's name for a photo, turned into something a filesystem
    will accept -- and nothing more than a filename.

    Everything that could make this a PATH rather than a name is
    removed: separators, parent references, NUL bytes, leading dots.
    What is left is trimmed, because a trailing space or dot is
    invalid on Windows and silently dropped on some filesystems, which
    would quietly land two photos on one name.
    """
    text = str(name or "")
    text = text.replace("\x00", "")
    text = text.replace("/", " ").replace("\\", " ")
    text = _SAFE_STEM.sub("", text)
    text = re.sub(r"\s+", " ", text).strip(" .")
    while text.startswith("."):
        text = text[1:].strip()
    # "..", "...", and friends leave nothing once the dots are stripped
    if not text or set(text) <= {".", " "}:
        return ""
    return text[:120]


def _unused_photo_name(stem, ext, keep=None):
    """`stem` + `ext`, with a number appended if that name is taken.

    `keep` is the photo being renamed: a photo renamed to the name it
    already has must not be pushed to "Pavlova-2".
    """
    candidate = stem + ext
    if candidate == keep:
        return candidate
    n = 2
    while os.path.exists(os.path.join(photos_dir(), candidate)):
        candidate = "%s-%d%s" % (stem, n, ext)
        n += 1
    return candidate


def _thumb_name(stored_name):
    stem, _ = os.path.splitext(stored_name)
    return stem + ".thumb.jpg"


def _frame_name(stored_name):
    stem, _ = os.path.splitext(stored_name)
    return stem + ".frame.jpg"


# ------------------------------------------------------------------ io ---
# --------------------------------------------------- moved to crux ---
# atomic_write_json, read_json and the shape helpers now live in
# crux/py/crux_store.py — one copy for the whole app instead of one per
# module. These aliases keep the call sites below unchanged.
atomic_write_json = crux_store.atomic_write_json
read_json = crux_store.read_json


def normalize_data(raw):
    """Validates everything Hearth owns: photos, albums, folders, tags,
    events and contacts."""
    if not isinstance(raw, dict):
        raw = {}

    def arr(key):
        v = raw.get(key)
        return v if isinstance(v, list) else []

    photos = arr("photos")
    for p in photos:
        if not isinstance(p, dict):
            continue
        if not isinstance(p.get("tags"), list):
            p["tags"] = []
        if not isinstance(p.get("albumIds"), list):
            p["albumIds"] = []
        for key in ("notes", "caption", "takenDate"):
            if not isinstance(p.get(key), str):
                p[key] = ""
        if not isinstance(p.get("inFrame"), bool):
            p["inFrame"] = False
        # Capture's own additions. Both are ignored by Camily, which
        # simply passes through fields it doesn't know about.
        if not isinstance(p.get("rating"), int) or not 0 <= p["rating"] <= 5:
            p["rating"] = 0
        if not isinstance(p.get("folderId"), str):
            p["folderId"] = ""

    folders = arr("folders")
    for f in folders:
        if isinstance(f, dict):
            for key in ("id", "name", "parentId"):
                if not isinstance(f.get(key), str):
                    f[key] = ""

    events = arr("events")
    for e in events:
        if isinstance(e, dict):
            for key in ("name", "date", "startTime", "endTime", "notes",
                        "repeat", "repeatUntil", "stamp"):
                if not isinstance(e.get(key), str):
                    e[key] = "" if key != "repeat" else "none"

    contacts = arr("contacts")
    for ct in contacts:
        if isinstance(ct, dict):
            for key in ("name", "email", "phone", "address", "notes",
                        "birthday"):
                if not isinstance(ct.get(key), str):
                    ct[key] = ""
            if not isinstance(ct.get("favourite"), bool):
                ct["favourite"] = False

    tag_list = raw.get("tagList")

    return {
        "photos": photos,
        "albums": arr("albums"),
        "photoTagList": arr("photoTagList"),
        "folders": folders,
        "events": events,
        "contacts": contacts,
        # cookery. Each MUST be listed here as well as in OWNED_KEYS:
        # normalize_data is the gate every save passes through, so a key
        # missing from it is silently dropped on the next write.
        "recipes": arr("recipes"),
        "menus": arr("menus"),
        "shoppingLists": arr("shoppingLists"),
        "books": arr("books"),
        "tagList": tag_list if isinstance(tag_list, list) and tag_list
            else list(DEFAULT_TAGS),
    }




def _encode_file(path):
    if not os.path.isfile(path):
        return {"error": "That photo is missing."}
    try:
        import base64
        ext = os.path.splitext(path)[1].lower()
        mime = {".png": "image/png", ".gif": "image/gif",
                ".webp": "image/webp"}.get(ext, "image/jpeg")
        with open(path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("ascii")
        return {"dataUrl": f"data:{mime};base64,{encoded}"}
    except OSError as e:
        return {"error": f"Couldn't load that photo: {e}"}


def _make_thumbnail(source_path, dest_path):
    from PIL import Image
    img = Image.open(source_path)
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    img.thumbnail((THUMB_MAX_DIM, THUMB_MAX_DIM), Image.LANCZOS)
    img.save(dest_path, "JPEG", quality=THUMB_QUALITY, optimize=True)


def _make_frame_copy(source_path, dest_path):
    from PIL import Image
    img = Image.open(source_path)
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    img.thumbnail((FRAME_MAX_DIM, FRAME_MAX_DIM), Image.LANCZOS)
    img.save(dest_path, "JPEG", quality=FRAME_QUALITY, optimize=True)


def read_taken_date(path):
    """When a photo was actually taken, from EXIF. Empty when there
    isn't one — callers fall back to the import date."""
    try:
        from PIL import Image
        with Image.open(path) as img:
            exif = img.getexif()
            if not exif:
                return ""
            raw = exif.get(36867) or exif.get(306)
            if not raw:
                return ""
            date_part = str(raw).strip().split(" ")[0].replace(":", "-")
            parts = date_part.split("-")
            if len(parts) != 3:
                return ""
            y, m, d = (int(p) for p in parts)
            if not (1900 <= y <= 2200 and 1 <= m <= 12 and 1 <= d <= 31):
                return ""
            return f"{y:04d}-{m:02d}-{d:02d}"
    except Exception:
        return ""



# ===========================================================================
# COOKERY — recipes, menus, shopping lists and recipe books
# ===========================================================================
# Cam: "i would like to combine cheffo and merge into the hearth app...
# This way we remove one extra app and combine in."
#
def import_cheffo_data(source_root=None):
    """Brings Cam's existing Cheffo library across — recipes, menus,
    shopping lists, tags, books, and the recipe photos themselves.

    THREE THINGS THIS HAS TO GET RIGHT, because it runs once over data
    that took years to type and has no other copy:

    1. IT MERGES, IT DOES NOT REPLACE. Anything already in Hearth stays.
       Records are matched by id, so running it twice adds nothing the
       second time rather than duplicating the whole book.

    2. IT COPIES THE PHOTOS, and renames on collision. Cheffo's photo
       filenames were only ever unique within Cheffo's own folder; a
       name already taken in Hearth's would otherwise be overwritten,
       destroying a family photo to make room for a recipe one. On a
       clash the file is stored under a fresh name and the recipe's own
       images[] entry is rewritten to point at it.

    3. IT NEVER TOUCHES THE SOURCE. Cheffo's folder is read only, so if
       anything here goes wrong the original is still sitting there.

    Returns a summary of what came across, or {"error": ...}.
    """
    root = source_root or find_cheffo_data()
    if not root:
        return {"error": "Couldn't find a cheffo_data folder to import from."}
    src_json = os.path.join(root, "cheffo.json")
    if not os.path.isfile(src_json):
        return {"error": f"No cheffo.json in {root}."}

    src = read_json(src_json, None)
    if not isinstance(src, dict):
        return {"error": "That cheffo.json couldn't be read."}

    current = read_json(data_file(), {})
    if not isinstance(current, dict):
        current = {}
    for key in ("recipes", "menus", "shoppingLists", "books", "tagList"):
        if not isinstance(current.get(key), list):
            current[key] = []

    src_photos = os.path.join(root, "photos")
    dest_photos = photos_dir()
    taken = set(os.listdir(dest_photos)) if os.path.isdir(dest_photos) else set()
    renamed = {}
    photos_copied = 0

    def bring_photo(stored):
        """Copies one recipe photo across, returning the name it ended
        up with. Cached in `renamed` so two recipes sharing a photo
        don't copy it twice or land on two different names."""
        nonlocal photos_copied
        if not stored or not isinstance(stored, str):
            return stored
        if stored in renamed:
            return renamed[stored]
        source = os.path.join(src_photos, os.path.basename(stored))
        if not os.path.isfile(source):
            renamed[stored] = stored          # nothing to copy; leave the name
            return stored
        name = os.path.basename(stored)
        if name in taken:
            stem, ext = os.path.splitext(name)
            n = 2
            while f"{stem}-cheffo{n}{ext}" in taken:
                n += 1
            name = f"{stem}-cheffo{n}{ext}"
        try:
            shutil.copy2(source, os.path.join(dest_photos, name))
            taken.add(name)
            photos_copied += 1
        except OSError:
            renamed[stored] = stored
            return stored
        renamed[stored] = name
        return name

    added = {"recipes": 0, "menus": 0, "shoppingLists": 0, "books": 0,
             "tags": 0, "photos": 0}
    skipped = {"recipes": 0, "menus": 0, "shoppingLists": 0, "books": 0}

    have = {k: {r.get("id") for r in current[k] if isinstance(r, dict)}
            for k in ("recipes", "menus", "shoppingLists", "books")}

    for r in (src.get("recipes") or []):
        if not isinstance(r, dict):
            continue
        if r.get("id") in have["recipes"]:
            skipped["recipes"] += 1
            continue
        rec = dict(r)
        images = []
        for im in (r.get("images") or []):
            if isinstance(im, dict) and im.get("storedName"):
                images.append(dict(im, storedName=bring_photo(im["storedName"])))
        rec["images"] = images
        current["recipes"].append(rec)
        have["recipes"].add(rec.get("id"))
        added["recipes"] += 1

    for key in ("menus", "shoppingLists", "books"):
        for item in (src.get(key) or []):
            if not isinstance(item, dict):
                continue
            if item.get("id") in have[key]:
                skipped[key] += 1
                continue
            current[key].append(dict(item))
            have[key].add(item.get("id"))
            added[key] += 1

    existing_tags = {str(t) for t in current["tagList"]}
    for t in (src.get("tagList") or []):
        if isinstance(t, str) and t not in existing_tags:
            current["tagList"].append(t)
            existing_tags.add(t)
            added["tags"] += 1

    added["photos"] = photos_copied

    try:
        atomic_write_json(data_file(), current)
    except OSError as e:
        return {"error": f"Couldn't write the library: {e}"}

    return {"ok": True, "source": root, "added": added, "skipped": skipped}


# Ported from cheffo.py rather than rewritten. Everything below was
# already correct and tested there — the rich-text allowlist, the print
# document builders, the book builders, the SVG-path-to-PDF converter
# and the desktop export. Merging an app is a reason to move code, never
# a reason to re-derive it.
#
# ONE REAL CHANGE: photos_dir() is now Hearth's, so a recipe photo lands
# in the same folder as the family photos. That is deliberate and safe —
# the gallery renders from data["photos"], and a recipe photo is never
# added to that index, so it is stored alongside without ever showing up
# in the photo library.
# ===========================================================================

DEFAULT_TAGS = ["Sweet", "Bread", "Chicken", "Beef"]

# The rich-text allowlist, the HTML element table and the two
# sanitisers now live in crux/py/crux_rich.py. It was attacked with 22
# XSS vectors and carries the fix for prose in angle brackets being
# eaten ("Simmer <do not boil>"), so it is emphatically not worth a
# second copy.
RICH_ALLOWED_TAGS = crux_rich.RICH_ALLOWED_TAGS
HTML_ELEMENT_NAMES = crux_rich.HTML_ELEMENT_NAMES
_rich = crux_rich.rich
_he = crux_rich.he
_strip_html = crux_rich.strip_html


def _photo_data_uri(stored_name):
    """Same base64-embed approach get_photo_data already uses for the
    in-app photo grid, reused here so a printed recipe can carry its
    own photo — the print file is a standalone temp file opened by
    the OS browser, so it needs the image data embedded directly
    rather than referencing photos_dir() by path."""
    import base64
    import mimetypes
    path = os.path.join(photos_dir(), stored_name)
    if not os.path.isfile(path):
        return None
    try:
        mime = mimetypes.guess_type(path)[0] or "image/jpeg"
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        return f"data:{mime};base64,{b64}"
    except OSError:
        return None


def _html_document(title, body_html, meta=""):
    """Cam: "I want the print out to also maintain a nice color
    theme and not just be a plain white paper." A real colored title
    bar and warm accents throughout, matching Cheffo's own palette —
    not the old plain Georgia-on-white. print-color-adjust is
    deliberately forced: most browsers strip background colors by
    default when actually printing (only the on-screen preview shows
    them) unless a page opts back in explicitly, which would have
    made this look right in the browser tab and then silently print
    as plain white paper again anyway."""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{_he(title)}</title>
<style>
  * {{ box-sizing: border-box; -webkit-print-color-adjust: exact;
       print-color-adjust: exact; color-adjust: exact; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                 Arial, sans-serif;
    color: #33302E;
    background: #FBF6EF;
    max-width: 720px;
    margin: 0 auto;
    padding: 0 0 60px;
  }}
  .print-titlebar {{
    background: #C7392C;
    color: #FFFDF8;
    padding: 30px 36px 26px;
    margin-bottom: 26px;
  }}
  .print-titlebar h1 {{
    font-family: Georgia, "Times New Roman", serif;
    margin: 0;
    font-size: 32px;
  }}
  .print-titlebar .print-meta {{
    margin: 8px 0 0;
    font-size: 15px;
    color: #FBEAE6;
  }}
  .print-body {{ padding: 0 36px; }}
  .print-body h2 {{
    font-family: Georgia, "Times New Roman", serif;
    color: #A32E22;
    border-left: 4px solid #C7392C;
    padding-left: 12px;
    font-size: 21px;
    margin: 28px 0 10px;
  }}
  .print-body p {{ font-size: 16px; line-height: 1.55; }}
  .print-body ul, .print-body ol {{ padding-left: 24px; font-size: 16px; line-height: 1.6; }}
  .print-body li {{ padding: 3px 0; }}
  .print-chips {{ margin: 2px 0 4px; }}
  .print-chip {{
    display: inline-block;
    background: #F3EBDE;
    border: 1px solid #D8CDBB;
    color: #33302E;
    border-radius: 999px;
    padding: 3px 13px;
    font-size: 13px;
    margin: 0 6px 6px 0;
  }}
  .print-photo {{
    width: 100%;
    max-height: 360px;
    object-fit: cover;
    border-radius: 14px;
    border: 1px solid #E6DED2;
    margin: 4px 0 18px;
    display: block;
  }}
  .print-notes {{
    background: #F3EBDE;
    border-radius: 10px;
    padding: 14px 18px;
    margin-top: 20px;
  }}
</style>
</head>
<body>
<div class="print-titlebar">
  <h1>{_he(title)}</h1>
  {f'<p class="print-meta">{meta}</p>' if meta else ""}
</div>
<div class="print-body">
{body_html}
</div>
</body></html>"""


def _recipe_html(r):
    meta_bits = []
    if r.get("servings"):
        meta_bits.append(f"Serves {_he(r['servings'])}")
    if r.get("source"):
        meta_bits.append(_he(r["source"]))
    meta = "  &mdash;  ".join(meta_bits)

    parts = []
    images = r.get("images") or []
    if images:
        photo_uri = _photo_data_uri(images[0].get("storedName", ""))
        if photo_uri:
            parts.append(f'<img class="print-photo" src="{photo_uri}" alt="">')
    tags = r.get("tags") or []
    if tags:
        parts.append('<p class="print-chips">' + "".join(
            f'<span class="print-chip">{_he(t)}</span>' for t in tags) + "</p>")
    if r.get("description"):
        parts.append(f"<div>{_rich(r['description'])}</div>")
    parts.append("<h2>Ingredients</h2><ul>" + "".join(
        f"<li>{_he(i)}</li>" for i in (r.get("ingredients") or [])) + "</ul>")
    parts.append("<h2>Steps</h2><ol>" + "".join(
        f"<li>{_he(s)}</li>" for s in (r.get("steps") or [])) + "</ol>")
    if r.get("notes"):
        parts.append(f'<div class="print-notes"><b>Notes</b>'
                     f'<div style="margin:6px 0 0">{_rich(r["notes"])}</div></div>')
    return "".join(parts), meta


def _shopping_list_html(l):
    items = [i for i in (l.get("items") or []) if str(i).strip()]
    parts = ['<ul style="list-style:none;padding:0 !important">']
    parts += [f'<li style="padding:8px 0;border-bottom:1px solid #E6DED2;'
              f'font-size:16px">&#9744;&nbsp;&nbsp;{_he(i)}</li>' for i in items]
    parts.append("</ul>")
    return "".join(parts)


# open_in_new_window and open_print_document now live in
# crux/py/crux_print.py. Three apps hit the same two bugs separately —
# window.open() returning null inside a webview, and browsers opening a
# tab instead of a window — so the fix is kept in one place.
_open_in_new_window = crux_print.open_in_new_window


def open_print_document(html_body):
    return crux_print.open_html(html_body, prefix="kincrux-print-")


# ========================================================== recipe books ===
"""Cam: "can we make the app have the same book feature that cranium has
where i can add to a book, pick a logo, name it and print or export it?
This will allow me to work with collections of recipes."

ONE REAL DIFFERENCE FROM CRANIUM, and it's deliberate. Cranium stores a
SNAPSHOT of each puzzle in the book, because a generated puzzle doesn't
live anywhere else — throw the snapshot away and the puzzle is gone.
Cheffo's recipes are permanent records with their own ids, so a book
stores recipeIds instead. That means fixing a typo in a recipe fixes it
in every book that holds it, which is what you want for recipes and
emphatically not what you'd want for puzzles. It also matches how Menus
already reference recipes here, so deleting a recipe prunes it from
books by the same path that already prunes it from menus.

The cover emblem's artwork is NOT duplicated on this side. The UI owns
COVER_LOGOS and passes the chosen path data down with each request, so
there is exactly one copy of every emblem in the codebase.
"""


def _book_recipes(book, all_recipes):
    """The book's recipes, in the book's own order, skipping any id
    that no longer resolves. A book should never fail to print because
    one recipe was deleted."""
    by_id = {r.get("id"): r for r in (all_recipes or []) if isinstance(r, dict)}
    return [by_id[i] for i in (book.get("recipeIds") or []) if i in by_id]


def _cover_svg(logo_path, size=120, color="#FFFDF8"):
    if not logo_path:
        return ""
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" '
            f'fill="none" stroke="{color}" stroke-width="1.4" '
            f'stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="{_he(logo_path)}"/></svg>')


def build_book_html(book, all_recipes):
    """The whole book as one self-contained HTML document: a cover
    carrying the emblem and the book's name, a contents page, then one
    recipe per page. Each page is headed with the emblem on the left
    and the app and book names centred, the same convention Cranium's
    own printed books use.

    Self-contained matters for both jobs this does — printing opens it
    as a temp file, and exporting saves it somewhere Cam will open it
    later, possibly after the photos have moved. Photos are embedded as
    data URIs for exactly that reason.
    """
    recipes = _book_recipes(book, all_recipes)
    name = book.get("name") or "Recipe Book"
    logo = book.get("logoPath") or ""
    n = len(recipes)
    count = f"{n} recipe" + ("" if n == 1 else "s")
    import datetime
    stamp = datetime.date.today().strftime("%d %B %Y")

    header = (f'<div class="bk-runhead">'
              f'<span class="bk-runhead-logo">{_cover_svg(logo, 26, "#A32E22")}</span>'
              f'<span class="bk-runhead-mid">KinCrux &middot; {_he(name)}</span>'
              f'<span class="bk-runhead-logo"></span></div>')

    pages = [f'''<section class="bk-cover">
  <div class="bk-cover-mark">{_cover_svg(logo, 132)}</div>
  <h1 class="bk-cover-title">{_he(name)}</h1>
  <p class="bk-cover-sub">{count} &middot; {stamp}</p>
</section>''']

    if recipes:
        items = "".join(
            f'<li><span class="bk-toc-name">{_he(r.get("name") or "Untitled")}</span>'
            f'<span class="bk-toc-dots"></span>'
            f'<span class="bk-toc-no">{i + 1}</span></li>'
            for i, r in enumerate(recipes))
        pages.append(f'''<section class="bk-page">{header}
  <h2 class="bk-h">Contents</h2>
  <ol class="bk-toc">{items}</ol>
</section>''')

    for i, r in enumerate(recipes):
        body, meta = _recipe_html(r)
        pages.append(f'''<section class="bk-page">{header}
  <div class="bk-recipe-head">
    <span class="bk-recipe-no">{i + 1}</span>
    <div>
      <h2 class="bk-recipe-title">{_he(r.get("name") or "Untitled")}</h2>
      {f'<p class="bk-recipe-meta">{meta}</p>' if meta else ""}
    </div>
  </div>
  {body}
</section>''')

    if not recipes:
        pages.append(f'''<section class="bk-page">{header}
  <p class="bk-empty">This book has no recipes in it yet.</p>
</section>''')

    return _book_document(name, "".join(pages))


def _book_document(title, body_html):
    """Same palette as the single-recipe print document, laid out as a
    book. print-color-adjust is forced for the same reason it is
    there: browsers strip background colours when actually printing
    unless a page opts back in, which would turn the cover into a
    blank sheet."""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{_he(title)}</title>
<style>
  * {{ box-sizing: border-box; -webkit-print-color-adjust: exact;
       print-color-adjust: exact; color-adjust: exact; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
          Roboto, Arial, sans-serif; color: #33302E;
          background: #FBF6EF; margin: 0; }}
  .bk-cover {{
    background: #C7392C; color: #FFFDF8;
    min-height: 92vh; padding: 90px 60px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
    page-break-after: always;
  }}
  .bk-cover-mark {{ margin-bottom: 26px; }}
  .bk-cover-title {{
    font-family: Georgia, "Times New Roman", serif;
    font-size: 46px; margin: 0; line-height: 1.15;
  }}
  .bk-cover-sub {{ margin: 16px 0 0; font-size: 17px; color: #FBEAE6; }}
  .bk-page {{
    max-width: 720px; margin: 0 auto; padding: 0 36px 40px;
    page-break-after: always;
  }}
  .bk-page:last-child {{ page-break-after: auto; }}
  .bk-runhead {{
    display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid #E6DED2;
    padding: 16px 0 10px; margin-bottom: 22px;
  }}
  .bk-runhead-logo {{ width: 26px; height: 26px; flex: 0 0 26px; }}
  .bk-runhead-mid {{
    flex: 1; text-align: center; font-size: 12.5px;
    letter-spacing: .08em; text-transform: uppercase; color: #8A7F71;
  }}
  .bk-h {{
    font-family: Georgia, "Times New Roman", serif;
    color: #A32E22; font-size: 26px; margin: 0 0 16px;
  }}
  .bk-toc {{ list-style: none; padding: 0; margin: 0; font-size: 16px; }}
  .bk-toc li {{ display: flex; align-items: baseline; gap: 8px; padding: 7px 0; }}
  .bk-toc-dots {{ flex: 1; border-bottom: 1px dotted #C9BEAD; }}
  .bk-toc-no {{ color: #8A7F71; }}
  .bk-recipe-head {{ display: flex; gap: 14px; align-items: flex-start;
                     margin-bottom: 6px; }}
  .bk-recipe-no {{
    flex: 0 0 34px; height: 34px; border-radius: 50%;
    background: #C7392C; color: #FFFDF8;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 700;
  }}
  .bk-recipe-title {{
    font-family: Georgia, "Times New Roman", serif;
    color: #A32E22; font-size: 25px; margin: 2px 0 0;
  }}
  .bk-recipe-meta {{ margin: 4px 0 0; font-size: 14px; color: #8A7F71; }}
  .bk-empty {{ color: #8A7F71; font-size: 16px; }}
  .bk-page h2 {{
    font-family: Georgia, "Times New Roman", serif; color: #A32E22;
    border-left: 4px solid #C7392C; padding-left: 12px;
    font-size: 20px; margin: 24px 0 10px;
  }}
  .bk-page h2.bk-h, .bk-page h2.bk-recipe-title {{
    border-left: 0; padding-left: 0;
  }}
  .bk-page p {{ font-size: 16px; line-height: 1.55; }}
  .bk-page ul, .bk-page ol {{ padding-left: 24px; font-size: 16px;
                              line-height: 1.6; }}
  .bk-page li {{ padding: 3px 0; }}
  .print-chips {{ margin: 2px 0 4px; }}
  .print-chip {{
    display: inline-block; background: #F3EBDE; border: 1px solid #D8CDBB;
    color: #33302E; border-radius: 999px; padding: 3px 13px;
    font-size: 13px; margin: 0 6px 6px 0;
  }}
  .print-photo {{
    width: 100%; max-height: 320px; object-fit: cover;
    border-radius: 14px; border: 1px solid #E6DED2;
    margin: 10px 0 18px; display: block;
  }}
  .print-notes {{
    background: #F3EBDE; border-radius: 10px; padding: 14px 18px;
    margin-top: 20px;
  }}
  @media print {{
    body {{ background: #FFFFFF; }}
    .bk-cover {{ min-height: 96vh; }}
  }}
</style>
</head>
<body>{body_html}</body></html>"""


def _strip_html(s):
    """Rich text down to plain text, for the markdown and PDF exports.

    Only REAL html elements are stripped. A blanket <[^>]+> would take
    "Simmer <do not boil> for 20 minutes" down to "Simmer  for 20
    minutes" — the same text-loss _rich's keep() guards against, and
    every bit as bad in an exported file as on a printed page. Caught
    by a test rather than by reading the code.

    Entities are decoded last, so "&amp;" arrives in a plain-text file
    as "&" rather than as markup.
    """
    import html as _html
    text = re.sub(r"(?is)<(script|style)\b.*?</\1\s*>", "", str(s or ""))
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(p|div|li|h[1-6]|ul|ol)\s*>", "\n", text)

    def drop(m):
        name = m.group(1).lower()
        if name in RICH_ALLOWED_TAGS or name in HTML_ELEMENT_NAMES:
            return ""
        return m.group(0)      # prose in angle brackets — keep it

    text = re.sub(r"</?([A-Za-z][A-Za-z0-9]*)[^>]*>", drop, text)
    text = _html.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def build_book_markdown(book, all_recipes):
    """A readable .md file. Photos are referenced by name rather than
    embedded — a markdown file that carried megabytes of base64 would
    not be readable, which is the only reason to choose this format."""
    recipes = _book_recipes(book, all_recipes)
    name = book.get("name") or "Recipe Book"
    import datetime
    out = [f"# {name}", ""]
    n = len(recipes)
    out.append(f"{n} recipe{'' if n == 1 else 's'} · "
               f"{datetime.date.today().strftime('%d %B %Y')}")
    out.append("")
    if book.get("notes"):
        out += [_strip_html(book["notes"]), ""]
    if not recipes:
        out += ["*This book has no recipes in it yet.*", ""]
        return "\n".join(out)

    out.append("## Contents")
    out.append("")
    for i, r in enumerate(recipes):
        out.append(f"{i + 1}. {r.get('name') or 'Untitled'}")
    out.append("")

    for i, r in enumerate(recipes):
        out.append("---")
        out.append("")
        out.append(f"## {i + 1}. {r.get('name') or 'Untitled'}")
        out.append("")
        bits = []
        if r.get("servings"):
            bits.append(f"Serves {r['servings']}")
        if r.get("source"):
            bits.append(str(r["source"]))
        if bits:
            out += ["*" + " — ".join(bits) + "*", ""]
        if r.get("tags"):
            out += ["`" + "`  `".join(str(t) for t in r["tags"]) + "`", ""]
        if r.get("description"):
            out += [_strip_html(r["description"]), ""]
        if r.get("images"):
            for im in r["images"]:
                out.append(f"![{r.get('name') or ''}]"
                           f"(photos/{im.get('storedName', '')})")
            out.append("")
        out += ["### Ingredients", ""]
        out += [f"- {i2}" for i2 in (r.get("ingredients") or [])] or ["- —"]
        out += ["", "### Steps", ""]
        steps = r.get("steps") or []
        out += [f"{j + 1}. {s}" for j, s in enumerate(steps)] or ["1. —"]
        out.append("")
        if r.get("notes"):
            out += ["> **Notes**  ", "> " +
                    _strip_html(r["notes"]).replace("\n", "  \n> "), ""]
    return "\n".join(out)


# -------------------------------------------------------- PDF export ---
"""A real .pdf, written directly rather than through the browser's own
Save-as-PDF. reportlab does the layout; there is no SVG renderer in the
dependency set (no svglib, no cairosvg), so the cover emblem is drawn by
converting its SVG path straight onto reportlab's own path object.

That conversion is why the emblems are deliberately drawn with only
move/line/curve commands and no elliptical arcs — arcs are the one part
of the SVG path grammar that is genuinely painful to convert, and
avoiding them in artwork we control is cheaper than writing and testing
an arc converter nobody needs.

reportlab is OPTIONAL, the same way Pillow is optional in Hearth and
ffmpeg in Chords: without it the other two export formats and printing
all still work, and the PDF option says what to install rather than
failing with a stack trace.
"""

_PDF_NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")


def _svg_path_commands(d):
    """SVG path data -> [(command_letter, [numbers...]), ...], with
    each command already split into its own correct argument count so
    repeated arguments ("L 1 2 3 4" meaning two lines) are expanded."""
    counts = {"m": 2, "l": 2, "h": 1, "v": 1, "c": 6, "s": 4,
              "q": 4, "t": 2, "z": 0}
    out = []
    for letter, args in re.findall(r"([MmLlHhVvCcSsQqTtZz])([^MmLlHhVvCcSsQqTtZz]*)",
                                   str(d or "")):
        nums = [float(x) for x in _PDF_NUM.findall(args)]
        need = counts[letter.lower()]
        if need == 0:
            out.append((letter, []))
            continue
        if not nums:
            continue
        for i in range(0, len(nums) - need + 1, need):
            chunk = nums[i:i + need]
            # a repeated moveto behaves as a lineto, per the SVG spec
            cmd = letter
            if i > 0 and letter in "Mm":
                cmd = "L" if letter == "M" else "l"
            out.append((cmd, chunk))
    return out


def _draw_svg_path(canvas, d, x, y, size, stroke=(1, 1, 1), width=1.4):
    """Strokes an SVG path from a 24x24 viewBox into `size` points at
    (x, y), where y is the TOP edge — PDF's origin is bottom-left and
    SVG's is top-left, so every y is flipped here rather than in the
    artwork."""
    from reportlab.lib.colors import Color
    cmds = _svg_path_commands(d)
    if not cmds:
        return
    s = size / 24.0
    px = lambda v: x + v * s
    py = lambda v: y - v * s

    canvas.saveState()
    canvas.setStrokeColor(Color(*stroke))
    canvas.setLineWidth(width * s)
    canvas.setLineCap(1)
    canvas.setLineJoin(1)

    p = canvas.beginPath()
    cx = cy = 0.0
    sx = sy = 0.0
    prev_ctrl = None
    open_sub = False

    for letter, a in cmds:
        rel = letter.islower()
        L = letter.upper()
        if L == "M":
            cx, cy = (cx + a[0], cy + a[1]) if rel else (a[0], a[1])
            sx, sy = cx, cy
            p.moveTo(px(cx), py(cy))
            open_sub = True
            prev_ctrl = None
        elif L in ("L", "H", "V", "T"):
            if L == "L":
                cx, cy = (cx + a[0], cy + a[1]) if rel else (a[0], a[1])
            elif L == "H":
                cx = cx + a[0] if rel else a[0]
            elif L == "V":
                cy = cy + a[0] if rel else a[0]
            else:                       # smooth quadratic, as a line
                cx, cy = (cx + a[0], cy + a[1]) if rel else (a[0], a[1])
            if not open_sub:
                p.moveTo(px(cx), py(cy))
                open_sub = True
            else:
                p.lineTo(px(cx), py(cy))
            prev_ctrl = None
        elif L in ("C", "S"):
            if L == "C":
                x1, y1, x2, y2, ex, ey = a
                if rel:
                    x1, y1, x2, y2, ex, ey = (cx + x1, cy + y1, cx + x2,
                                              cy + y2, cx + ex, cy + ey)
            else:
                x2, y2, ex, ey = a
                if rel:
                    x2, y2, ex, ey = cx + x2, cy + y2, cx + ex, cy + ey
                # reflect the previous control point, or use the
                # current point when there wasn't one
                x1, y1 = ((2 * cx - prev_ctrl[0], 2 * cy - prev_ctrl[1])
                          if prev_ctrl else (cx, cy))
            p.curveTo(px(x1), py(y1), px(x2), py(y2), px(ex), py(ey))
            prev_ctrl = (x2, y2)
            cx, cy = ex, ey
        elif L == "Q":
            qx, qy, ex, ey = a
            if rel:
                qx, qy, ex, ey = cx + qx, cy + qy, cx + ex, cy + ey
            # a quadratic is an exact cubic with these control points
            p.curveTo(px(cx + 2.0 / 3 * (qx - cx)), py(cy + 2.0 / 3 * (qy - cy)),
                      px(ex + 2.0 / 3 * (qx - ex)), py(ey + 2.0 / 3 * (qy - ey)),
                      px(ex), py(ey))
            prev_ctrl = (qx, qy)
            cx, cy = ex, ey
        elif L == "Z":
            p.close()
            cx, cy = sx, sy
            open_sub = False
            prev_ctrl = None

    canvas.drawPath(p, stroke=1, fill=0)
    canvas.restoreState()


def build_book_pdf(book, all_recipes, dest_path):
    """Writes the book as a real PDF. Returns None on success, or a
    message explaining what to install."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.lib.utils import ImageReader
        from reportlab.platypus import (BaseDocTemplate, Frame, Image,
                                        ListFlowable, ListItem, NextPageTemplate,
                                        PageBreak, PageTemplate, Paragraph,
                                        Spacer)
    except ImportError:
        return ("PDF export needs reportlab. Install it with:\n\n"
                "    pip install reportlab\n\n"
                "Print, HTML and Markdown exports all work without it.")

    recipes = _book_recipes(book, all_recipes)
    name = book.get("name") or "Recipe Book"
    logo = book.get("logoPath") or ""
    RED = colors.HexColor("#C7392C")
    DEEP = colors.HexColor("#A32E22")
    INK = colors.HexColor("#33302E")
    MUTE = colors.HexColor("#8A7F71")
    CREAM = colors.HexColor("#FFFDF8")

    W, H = A4
    M = 20 * mm

    def cover_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(RED)
        canvas.rect(0, 0, W, H, stroke=0, fill=1)
        _draw_svg_path(canvas, logo, W / 2 - 24 * mm, H / 2 + 52 * mm,
                       48 * mm, stroke=(1, 0.992, 0.973), width=1.3)
        canvas.setFillColor(CREAM)
        canvas.setFont("Times-Bold", 34)
        for i, line in enumerate(_wrap_for_width(name, 22)):
            canvas.drawCentredString(W / 2, H / 2 - 2 * mm - i * 13 * mm, line)
        canvas.setFont("Helvetica", 12)
        canvas.setFillColor(colors.HexColor("#FBEAE6"))
        import datetime
        n = len(recipes)
        canvas.drawCentredString(
            W / 2, H / 2 - 26 * mm,
            f"{n} recipe{'' if n == 1 else 's'}  ·  "
            f"{datetime.date.today().strftime('%d %B %Y')}")
        canvas.restoreState()

    def inner_page(canvas, doc):
        canvas.saveState()
        _draw_svg_path(canvas, logo, M, H - M + 5 * mm, 7 * mm,
                       stroke=(0.639, 0.180, 0.133), width=1.6)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTE)
        canvas.drawCentredString(W / 2, H - M + 1 * mm,
                                 ("HEARTH  ·  " + name).upper())
        canvas.setStrokeColor(colors.HexColor("#E6DED2"))
        canvas.setLineWidth(0.6)
        canvas.line(M, H - M - 1 * mm, W - M, H - M - 1 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.drawCentredString(W / 2, M - 6 * mm, str(canvas.getPageNumber() - 1))
        canvas.restoreState()

    body = ParagraphStyle("body", fontName="Helvetica", fontSize=10.5,
                          leading=15, textColor=INK)
    h2 = ParagraphStyle("h2", fontName="Times-Bold", fontSize=14,
                        leading=18, textColor=DEEP, spaceBefore=10,
                        spaceAfter=4)
    title = ParagraphStyle("title", fontName="Times-Bold", fontSize=19,
                           leading=23, textColor=DEEP, spaceAfter=2)
    meta = ParagraphStyle("meta", fontName="Helvetica-Oblique", fontSize=9,
                          leading=12, textColor=MUTE, spaceAfter=6)
    toc = ParagraphStyle("toc", fontName="Helvetica", fontSize=11,
                         leading=18, textColor=INK)

    doc = BaseDocTemplate(dest_path, pagesize=A4,
                          leftMargin=M, rightMargin=M,
                          topMargin=M + 4 * mm, bottomMargin=M,
                          title=name, author="KinCrux")
    frame = Frame(M, M, W - 2 * M, H - 2 * M - 4 * mm, id="f")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame], onPage=cover_page),
        PageTemplate(id="inner", frames=[frame], onPage=inner_page),
    ])

    story = [NextPageTemplate("inner"), PageBreak()]

    if not recipes:
        story.append(Paragraph("This book has no recipes in it yet.", meta))
    else:
        story.append(Paragraph("Contents", h2))
        story.append(Spacer(1, 4))
        for i, r in enumerate(recipes):
            story.append(Paragraph(
                f"{i + 1}. &nbsp;{_he(r.get('name') or 'Untitled')}", toc))
        story.append(PageBreak())

        for i, r in enumerate(recipes):
            story.append(Paragraph(
                f"{i + 1}. {_he(r.get('name') or 'Untitled')}", title))
            bits = []
            if r.get("servings"):
                bits.append(f"Serves {_he(r['servings'])}")
            if r.get("source"):
                bits.append(_he(r["source"]))
            if r.get("tags"):
                bits.append(", ".join(_he(t) for t in r["tags"]))
            if bits:
                story.append(Paragraph(" &mdash; ".join(bits), meta))

            for im in (r.get("images") or [])[:1]:
                p = os.path.join(photos_dir(), im.get("storedName", ""))
                if os.path.isfile(p):
                    try:
                        iw, ih = ImageReader(p).getSize()
                        w = W - 2 * M
                        h = min(w * ih / float(iw), 70 * mm)
                        story.append(Image(p, width=h * iw / float(ih), height=h))
                        story.append(Spacer(1, 8))
                    except Exception:
                        pass       # a corrupt photo must not kill the book

            if r.get("description"):
                story.append(Paragraph(
                    _he(_strip_html(r["description"])).replace("\n", "<br/>"), body))

            story.append(Paragraph("Ingredients", h2))
            ings = [i2 for i2 in (r.get("ingredients") or []) if str(i2).strip()]
            if ings:
                story.append(ListFlowable(
                    [ListItem(Paragraph(_he(i2), body), leftIndent=14)
                     for i2 in ings], bulletType="bullet", start="circle",
                    leftIndent=12))
            story.append(Paragraph("Steps", h2))
            steps = [s for s in (r.get("steps") or []) if str(s).strip()]
            if steps:
                story.append(ListFlowable(
                    [ListItem(Paragraph(_he(s), body), leftIndent=14)
                     for s in steps], bulletType="1", leftIndent=12))
            if r.get("notes"):
                story.append(Spacer(1, 6))
                story.append(Paragraph(
                    "<b>Notes</b><br/>"
                    + _he(_strip_html(r["notes"])).replace("\n", "<br/>"), body))
            if i < len(recipes) - 1:
                story.append(PageBreak())

    doc.build(story)
    return None


def _wrap_for_width(text, max_chars):
    """Greedy wrap for the cover title — reportlab's canvas draws a
    single string at a time, so a long book name needs splitting by
    hand rather than by a paragraph flowable."""
    words, lines, cur = str(text or "").split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if len(trial) > max_chars and cur:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines[:3] or [""]


def export_book_file(book, all_recipes, fmt):
    """Writes the book to the desktop in one of three formats, never
    overwriting an earlier export."""
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    if not os.path.isdir(desktop):
        desktop = os.path.expanduser("~")
    safe = "".join(c for c in (book.get("name") or "Recipe Book")
                   if c not in '\\/:*?"<>|').strip() or "Recipe Book"
    ext = {"html": ".html", "md": ".md", "pdf": ".pdf"}.get(fmt)
    if not ext:
        return {"error": "Unknown export format."}
    dest = os.path.join(desktop, safe + ext)
    n = 2
    while os.path.exists(dest):
        dest = os.path.join(desktop, f"{safe} ({n}){ext}")
        n += 1

    try:
        if fmt == "pdf":
            problem = build_book_pdf(book, all_recipes, dest)
            if problem:
                return {"error": problem}
        else:
            text = (build_book_html(book, all_recipes) if fmt == "html"
                    else build_book_markdown(book, all_recipes))
            with open(dest, "w", encoding="utf-8", newline="") as f:
                f.write(text)
        return {"ok": True, "path": dest}
    except OSError as e:
        return {"error": f"Couldn't write the file: {e}"}
    except Exception as e:                       # reportlab, mostly
        return {"error": f"Couldn't build the {fmt.upper()}: {e}"}




# ===========================================================================
# MONEY — merged in from Cashbox.
# ===========================================================================
# Its own data file, deliberately. Separate data per domain means a bad
# write to the budget cannot reach the photo library, and each module
# keeps the storage shape that suits it. The frozen date contract lives
# in ui/money.js and is covered by test/test_money_contract.js.
# ===========================================================================

MONEY_DEFAULTS = {"templates": [], "oneoffs": [], "payments": {}, "goals": [],
                  "calc": {"bills": [], "income": []},
                  "spendingLog": {"periodStart": "", "entries": []}}


# ================================================================= notes ===
"""Amnesia's vault, reachable from KinCrux.

The vault is a real folder of real .md files and it STAYS one -- KinCrux
points at it, it does not absorb it. The acceptance test for this whole
stage is that Obsidian can still open the folder afterwards.

The module is optional: a build missing notes_backend.py loses the Notes
section and nothing else, the same guard every other module has.
"""
try:
    import notes_backend                # noqa: E402
    _notes = notes_backend.NotesApi()
except ImportError:
    notes_backend = None
    _notes = None


# =============================================================== kitchen ===
"""Recipes, menus, shopping lists, recipe books and the tag list.

Cam: "would you please fix this now so it has a standalone file, so i can
import my recipes from the old hearth app".

WHAT THE UI SEES IS UNCHANGED. get_data still hands back one document
with every key on it, and save_data still takes one. The split happens
here, on the way to and from disk, so neither app.js nor cookery.js --
two thousand lines of it -- had to change at all.

WHAT THE OLD FILE SEES IS ALSO UNCHANGED. camily.json keeps its copy of
the recipes from the day of the split, untouched, for as long as Cam
wants it. Nothing here ever writes to it or truncates it.
"""

_resolved_cookery_root = None


def cookery_dir():
    """The Kitchen's folder, kept BESIDE the family library.

    Not inside the app folder. The first version of this used the
    ordinary fallback, which creates the folder next to kincrux.py --
    and since the migration always writes the file on first run, every
    install put the recipes inside the app. Replace or move that folder
    to update the app and the recipes are left behind, or gone.

    So the fallback here is the family library's own parent: recipes end
    up next to camily_data/, they copy when Cam copies his data folder,
    and they back up when he backs it up. An existing cookery_data/
    anywhere the normal search looks still wins over all of this.
    """
    global _resolved_cookery_root
    if ROOT_PROVIDER:
        return _own("kitchen")
    if _resolved_cookery_root:
        return _resolved_cookery_root

    root, found = crux_paths.find_data_dir(
        ["cookery_data", "kincrux_cookery"], create="cookery_data",
        marker="cookery.json")
    if found:
        _resolved_cookery_root = root
        return root

    # nothing existed, so put it beside the library rather than in the app
    beside = os.path.join(os.path.dirname(os.path.abspath(data_dir())),
                          "cookery_data")
    try:
        os.makedirs(beside, exist_ok=True)
        # the fallback the search just made, if it is empty and elsewhere
        if os.path.abspath(root) != os.path.abspath(beside):
            try:
                if os.path.isdir(root) and not os.listdir(root):
                    os.rmdir(root)
            except OSError:
                pass
        _resolved_cookery_root = beside
    except OSError:
        _resolved_cookery_root = root
    return _resolved_cookery_root


def cookery_file():
    return os.path.join(cookery_dir(), "cookery.json")


def normalize_cookery(raw):
    """Every Kitchen key always exists and is always a list, whatever is
    on disk -- missing, null, or the wrong container type entirely."""
    src = raw if isinstance(raw, dict) else {}
    out = {}
    for key in COOKERY_KEYS:
        out[key] = crux_store.as_list(src.get(key))
    if not out["tagList"]:
        out["tagList"] = list(DEFAULT_TAGS)
    return out


def migrate_cookery_from_camily():
    """First run after the split: lift the Kitchen out of camily.json.

    Runs ONCE, and only when cookery.json does not exist yet. That
    condition is what stops it resurrecting a recipe Cam has since
    deleted -- after the first run the Kitchen file is the only thing
    consulted, and camily.json's copy is frozen history.

    camily.json is opened read-only. It is never written, never
    truncated, and the keys are never removed from it.
    """
    if os.path.isfile(cookery_file()):
        return {"migrated": False, "reason": "already split"}
    old = crux_store.read_json(data_file(), {})
    kitchen = normalize_cookery(old if isinstance(old, dict) else {})
    crux_store.atomic_write_json(cookery_file(), kitchen)
    return {"migrated": True,
            "recipes": len(kitchen["recipes"]),
            "menus": len(kitchen["menus"]),
            "books": len(kitchen["books"]),
            "shoppingLists": len(kitchen["shoppingLists"])}


def read_cookery():
    migrate_cookery_from_camily()
    return normalize_cookery(crux_store.read_json(cookery_file(), {}))


def write_cookery(doc):
    crux_store.atomic_write_json(cookery_file(), normalize_cookery(doc))


def import_cookery_from(source_root):
    """Brings the Kitchen across from ANOTHER Hearth or KinCrux install.

    THE SOURCE IS READ-ONLY. Nothing here writes to it, at all.

    Merges by id and skips anything already here, so running it twice
    changes nothing the second time. Recipe photos are copied into this
    library and RENAMED ON COLLISION -- a recipe photo called pav.jpg
    must never land on top of a family photo of the same name. That is
    the same rule the Cheffo import follows, and for the same reason.
    """
    if not source_root or not os.path.isdir(source_root):
        return {"error": "That folder isn't there."}

    src_json = None
    for name in ("cookery.json", "camily.json", "cheffo.json"):
        candidate = os.path.join(source_root, name)
        if os.path.isfile(candidate):
            src_json = candidate
            break
    if not src_json:
        return {"error": "No cookery.json or camily.json in that folder."}

    src = crux_store.read_json(src_json, {})
    incoming = normalize_cookery(src if isinstance(src, dict) else {})
    here = read_cookery()

    src_photos = os.path.join(source_root, "photos")
    dest_photos = photos_dir()
    taken = set(os.listdir(dest_photos)) if os.path.isdir(dest_photos) else set()
    renamed = {}
    photos_copied = 0

    def bring_photo(stored):
        """Copies one recipe photo across, returning the name it ended up
        with. Cached so two recipes sharing a photo do not copy it twice
        or land on two different names."""
        nonlocal photos_copied
        if not stored or not isinstance(stored, str):
            return stored
        if stored in renamed:
            return renamed[stored]
        source = os.path.join(src_photos, os.path.basename(stored))
        if not os.path.isfile(source):
            renamed[stored] = stored
            return stored
        name = os.path.basename(stored)
        if name in taken:
            stem, ext = os.path.splitext(name)
            n = 2
            while f"{stem}-imported{n}{ext}" in taken:
                n += 1
            name = f"{stem}-imported{n}{ext}"
        try:
            shutil.copy2(source, os.path.join(dest_photos, name))
            taken.add(name)
            photos_copied += 1
        except OSError:
            renamed[stored] = stored
            return stored
        renamed[stored] = name
        return name

    added = {k: 0 for k in COOKERY_KEYS}

    for key in ("recipes", "menus", "shoppingLists", "books"):
        have = {r.get("id") for r in here[key] if isinstance(r, dict)}
        for record in incoming[key]:
            if not isinstance(record, dict):
                continue
            rid = record.get("id")
            if rid and rid in have:
                continue                      # already here; leave it alone
            record = json.loads(json.dumps(record))
            if key == "recipes":
                record["images"] = [bring_photo(n)
                                    for n in crux_store.as_list(record.get("images"))]
            here[key].append(record)
            if rid:
                have.add(rid)
            added[key] += 1

    # tags are a plain list of strings, so merge without duplicating
    before_tags = len(here["tagList"])
    seen = {str(t) for t in here["tagList"]}
    for tag in incoming["tagList"]:
        if str(tag) not in seen:
            here["tagList"].append(tag)
            seen.add(str(tag))
    added["tagList"] = len(here["tagList"]) - before_tags

    write_cookery(here)
    return {"ok": True, "source": source_root, "photosCopied": photos_copied,
            **{k: added[k] for k in COOKERY_KEYS}}


def money_dir():
    if ROOT_PROVIDER:
        return _own("money")
    root, _found = crux_paths.find_data_dir(
        ["cashbox_data", "kincrux_money"], create="kincrux_money",
        marker="cashbox.json")
    return root


def money_file():
    return os.path.join(money_dir(), "cashbox.json")


def _normalize_marks(raw_marks):
    """Each mark needs key/source/id/date/name as real strings to be
    usable — anything malformed (hand-edited, or a genuinely corrupt
    write) is dropped rather than trusted, the same discipline as
    every other shape check in this function."""
    if not isinstance(raw_marks, list):
        return []
    out = []
    for m in raw_marks:
        if not isinstance(m, dict):
            continue
        if not all(isinstance(m.get(k), str) and m.get(k)
                   for k in ("key", "source", "id", "date")):
            continue
        out.append({"key": m["key"], "source": m["source"], "id": m["id"],
                    "date": m["date"], "name": m.get("name") or ""})
    return out


def normalize_money(raw):
    """The whole Money file: the main cash book's budget at the top level (as it always was), its printed books,
    and the other cash books (2026-10-11, Cam: "i want to be able to have seperate cash books. So my main one and
    then another one say a hypothetical one")."""
    out = _normalize_budget(raw)
    raw = raw if isinstance(raw, dict) else {}
    out["books"] = _normalize_money_books(raw.get("books"))
    out["cashbooks"] = _normalize_cashbooks(raw.get("cashbooks"))
    # the main cash book's own name -- whose it is (2026-10-11, Cam: "2 completely different cashbooks ... for 2
    # different people"); "Main" until it's named
    mn = raw.get("mainName")
    out["mainName"] = mn.strip()[:60] if isinstance(mn, str) and mn.strip() else "Main"
    return out


def _normalize_cashbooks(raw):
    """The cash books besides the main one: each its own budget, the same shape as the main one's."""
    out, seen = [], set()
    for b in raw if isinstance(raw, list) else []:
        if not isinstance(b, dict):
            continue
        bid = b.get("id") if isinstance(b.get("id"), str) else ""
        if not bid or bid == "main" or bid in seen:
            continue
        seen.add(bid)
        name = b.get("name") if isinstance(b.get("name"), str) and b.get("name").strip() else "Cash book"
        data = _normalize_budget(b.get("data"))
        data["books"] = _normalize_money_books((b.get("data") or {}).get("books") if isinstance(b.get("data"), dict) else None)
        out.append({"id": bid, "name": name[:60], "created": b.get("created") if isinstance(b.get("created"), str) else "",
                    "data": data})
    return out


def _normalize_budget(raw):
    """Same defensive shape-normalizing every read of the data goes
    through, whether it came from disk or from an imported file:
    each of the four top-level keys always exists and is always the
    right container type, even if the source file is missing one,
    has it as null, or (Cam hand-editing the file, or a genuinely
    corrupt write) the wrong type entirely."""
    if not isinstance(raw, dict):
        raw = {}
    templates = raw.get("templates")
    oneoffs = raw.get("oneoffs")
    payments = raw.get("payments")
    goals = raw.get("goals")
    calc = raw.get("calc")
    if not isinstance(calc, dict):
        calc = {}
    spending_log = raw.get("spendingLog")
    if not isinstance(spending_log, dict):
        spending_log = {}
    return {
        "templates": templates if isinstance(templates, list) else [],
        "oneoffs": oneoffs if isinstance(oneoffs, list) else [],
        "payments": payments if isinstance(payments, dict) else {},
        "goals": goals if isinstance(goals, list) else [],
        "spendingLog": {
            "periodStart": spending_log.get("periodStart")
                if isinstance(spending_log.get("periodStart"), str) else "",
            "entries": spending_log.get("entries")
                if isinstance(spending_log.get("entries"), list) else [],
        },
        "calc": {"bills": _normalize_marks(calc.get("bills")),
                 "income": _normalize_marks(calc.get("income"))},
    }


def _normalize_money_books(raw):
    """Money's books (2026-10-02, the desktop Bookshelf): each one's make-up
    -- months or fortnights From -> To, and whether the Calculation sheet and
    Savings goals go in. Without this key here a save would drop them."""
    out = []
    for b in raw if isinstance(raw, list) else []:
        if not isinstance(b, dict) or not b.get("id") or not str(b.get("name") or "").strip():
            continue
        out.append({"id": str(b["id"]), "name": str(b["name"]).strip(),
                    "subtitle": str(b.get("subtitle") or ""),
                    "mode": "fortnight" if b.get("mode") == "fortnight" else "period",
                    "from": str(b.get("from") or ""), "to": str(b.get("to") or ""),
                    "calc": bool(b.get("calc")), "goals": bool(b.get("goals")),
                    "created": str(b.get("created") or "")})
    return out




# --------------------------------------------------------------- Api ---

def fatal(msg):
    sys.stderr.write(msg + "\n")
    sys.exit(1)




