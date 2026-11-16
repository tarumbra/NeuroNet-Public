#!/usr/bin/env python3
"""NeuroNet — music, games and cards, with a photo library under them.

Cam: "lets create another app that blends together cranium, chords and
celestrial as well... KinCrux will house the adaptations for Cashbox,
Cheffo, Amnesia, coach cam and hearth. While the new app called
NeuroNet will house the adaptations of Celestrial, chords and cranium.
This will remove the need for so many apps. However also keep the bloat
down by splitting into apps."

WHY THIS IS A SECOND APP AND NOT MORE OF KINCRUX. The split is not
tidiness. NeuroNet has something KinCrux never had: a process that must
keep going while you navigate. Audio is playing. Every screen in here has
to not stop the music, and that is a property of the whole app, not of
one module. Putting it inside a household ledger would make every view
in the ledger responsible for it.

THE DATA. One folder, neuronet_data/, created BESIDE the app rather
than inside it, so replacing the app folder to update NeuroNet does not
take the photos, the music or the saved games with it. Inside it, a file
per domain rather than one big document -- a bad write then has a small
blast radius, which is the same conclusion KinCrux reached.

EVERY MODULE'S BACKEND METHODS ARE NAMESPACED. Cranium shipped with
get_data/save_data and Chords with read_json/write_json, and pywebview
puts every js_api method in one flat namespace. Two modules with
save_data means one silently overwrites the other's file. That is not a
hypothetical: it was caught in the KinCrux merge with the recipe file
about to be written over the family photos. So the methods here are
photo_*, chords_* and cranium_*, and nothing is generic.
"""

import datetime
import glob
import io
import json
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "crux", "py"))
try:
    import crux_paths                  # noqa: E402
    import crux_print                  # noqa: E402
    import crux_store                  # noqa: E402
except ImportError as _e:              # pragma: no cover - startup only
    sys.exit(
        f"NeuroNet can't find its shared core ({_e}).\n\n"
        f"crux/py/ must sit beside neuronet.py. Expected it at:\n"
        f"  {os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crux', 'py')}\n\n"
        "Copy the whole app folder, not just neuronet.py.")

# WHAT THIS APP HAS BEEN CALLED, in order, because the names are quotes and
# a search-and-replace across the source turned this paragraph into a
# circle -- "we will change the name of NeuroNet to Cam's Collective S"
# and "for it to be called NeuroNet", neither of which he ever said. The
# old names are written out deliberately here and must survive the next
# rename too:
#
#   SynapSoul          the original
#   Cam's Collective S  Cam: "we will change the name of SynapSoul to
#                       Cam's Collective S"
#   Meus Cerebro        Cam, at the KinCrux merge: "i now want the two apps
#                       merged together into one and for it to be called
#                       Meus Cerebro"
#   NeuroNet            Cam: "I want the app to be called NeuroNet. Please
#                       rename everything."
#
# Until the last one, only the name Cam SAW ever changed: this file, the
# data folder and the ids inside deliberately stayed put, so an update
# could be unzipped straight over an install without risking a library.
# "Rename everything" gave up that protection on purpose, which is why
# _adopt_old_library() below knows the old names and takes on a library
# found under them. Nothing else in the app may assume the folder is
# called neuronet_data -- ask data_dir().
APP_NAME = "NeuroNet"

THUMB_MAX_DIM = 360
THUMB_QUALITY = 68
FRAME_MAX_DIM = 1280
FRAME_QUALITY = 78

# The photo library's keys. Anything else found in the file is left
# alone on save -- the same discipline KinCrux uses, for the same
# reason: a build that does not know about a key must not delete it.
OWNED_KEYS = ("photos", "albums", "photoTagList", "folders")


# ------------------------------------------------------------- paths ---
def app_dir():
    return crux_paths.app_dir()


def resource_dir():
    return crux_paths.resource_dir()


def ui_dir():
    return os.path.join(resource_dir(), "ui")


_resolved_root = None
# The data folder paths.json names, when it isn't there -- a drive that isn't
# plugged in (Settings -> Data folder can put the data on one). NeuroNet then
# says so and waits, rather than opening on an empty library.
_missing_data = ""


def paths_file():
    """This computer's ~/.config/neuronet/paths.json (NEURONET_PATHS in tests)."""
    return os.environ.get("NEURONET_PATHS") or os.path.join(
        os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config"),
        "neuronet", "paths.json")


def _configured_data_dir():
    """The data folder ~/.config/neuronet/paths.json names, or "" -- only its
    "data" key: the app always knows where it is itself. NEURONET_PATHS
    points elsewhere (the tests use it to keep off the real config)."""
    conf = paths_file()
    try:
        with open(conf, "r", encoding="utf-8") as f:
            data = json.load(f).get("data") or ""
    except (OSError, ValueError, AttributeError):
        return ""
    return os.path.abspath(os.path.expanduser(data)) if data else ""


def data_dir():
    """NeuroNet's data folder -- INSIDE the app folder.

    Cam: "please move all the neuronet data to within the neuronet app
    folder so it lives together".

    THIS REVERSES AN EARLIER DECISION, ON PURPOSE. The folder used to be
    created beside the app rather than in it, so that updating NeuroNet
    by replacing its folder could not take the photos, the music, the
    saved games or the training with it. KinCrux learned that one the
    hard way with its recipe folder. Keeping everything together is a
    reasonable trade, but it moves the danger rather than removing it:

        UPDATE BY COPYING NEW FILES OVER THE TOP. NEVER DELETE THE OLD
        NEURONET FOLDER AND DROP IN A NEW ONE -- the data goes with it.

    package.sh never puts neuronet_data/ in an update, so unzipping an
    update over an existing install cannot touch it. That is the second
    half of the protection; the first half is the sentence above.

    HOW AN EXISTING FOLDER GETS HERE. On first launch after this change,
    a real neuronet_data/ found beside the app is MOVED inside it. A move
    within one disk is a rename, which is atomic -- the folder is either
    wholly in the old place or wholly in the new one, never half of each.
    If the rename cannot happen (a different disk, no permission) nothing
    is copied or deleted: the folder is simply used where it is, which
    still works, and the reason is logged.

    A LIBRARY CHOSEN WITH library_path.txt IS LEFT ALONE. That file is an
    explicit instruction to keep the data somewhere else -- an external
    drive, a synced folder -- and moving it would override Cam.

    The marker (neuronet.json) still decides which candidate is real, for
    the reason it always has: an early launch can leave an empty folder
    that would otherwise shadow the real library, and the app opens empty,
    which reads exactly like having lost everything.
    """
    global _resolved_root, _missing_data
    if _resolved_root:
        return _resolved_root

    here = app_dir()
    inside = os.path.join(here, "neuronet_data")
    marker = "neuronet.json"

    def is_real(path):
        return os.path.isdir(path) and os.path.exists(os.path.join(path, marker))

    # 0. This computer's NeuroNet config says where the data is (NeuroNet
    #    System plan, Stage 1, 2026-09-29): ~/.config/neuronet/paths.json,
    #    written by neuronet-setup, the one file the desktop widgets and
    #    commands read too. An explicit choice like library_path.txt below,
    #    and used only if the folder is there -- a drive that isn't mounted
    #    must never open NeuroNet empty.
    configured = _configured_data_dir()
    if configured:
        if os.path.isdir(configured):
            _resolved_root = configured
            return configured
        _log_line("paths.json names %s for the data, which isn't there; "
                  "looking in the usual places" % configured)
        _missing_data = configured
    # 1. An explicit choice wins, untouched.
    pointer = os.path.join(here, "library_path.txt")
    if os.path.isfile(pointer):
        try:
            with open(pointer, "r", encoding="utf-8") as f:
                chosen = f.read().strip()
            if chosen and os.path.isdir(chosen):
                _resolved_root = chosen
                return chosen
        except OSError:
            pass

    # 2. Already inside, and real.
    if is_real(inside):
        _resolved_root = inside
        return inside

    # 2b. The library from before the app was renamed.
    old = _adopt_old_library(here, inside)
    if old:
        _resolved_root = old
        return old

    # 3. A real library somewhere the search can see -- move it in.
    #    ONLY into a real NeuroNet folder (neuronet.py beside it). 2026-10-15: a test run from NeuroNet/test/ took
    #    test/ for the app, saw Cam's real neuronet_data one folder up and moved it into test/ (moved straight back,
    #    nothing lost). Anywhere else, the library is used where it is -- never moved.
    if not os.path.isfile(os.path.join(here, "neuronet.py")):
        for candidate in (os.path.join(os.path.dirname(os.path.abspath(here)), "neuronet_data"),
                          os.path.join(os.path.expanduser("~"), "neuronet_data")):
            if is_real(candidate):
                _log_line("not moving %s: %s isn't a NeuroNet folder" % (candidate, here))
        elsewhere = []
    else:
        elsewhere = [
            os.path.join(os.path.dirname(os.path.abspath(here)), "neuronet_data"),
            os.path.join(os.path.expanduser("~"), "neuronet_data"),
        ]
    for candidate in elsewhere:
        if not is_real(candidate):
            continue
        if os.path.abspath(candidate) == os.path.abspath(inside):
            continue
        try:
            # An empty folder left inside by an early launch would block
            # the rename; only ever remove it if it really is empty.
            if os.path.isdir(inside) and not os.listdir(inside):
                os.rmdir(inside)
            if not os.path.exists(inside):
                os.rename(candidate, inside)
                _log_line("moved neuronet_data inside the app: %s -> %s"
                          % (candidate, inside))
                _resolved_root = inside
                return inside
        except OSError as exc:
            _log_line("could not move neuronet_data inside the app (%s); "
                      "using it where it is: %s" % (exc, candidate))
        _resolved_root = candidate
        return candidate

    # 4. Nothing anywhere: start a fresh library, inside.
    try:
        os.makedirs(inside, exist_ok=True)
    except OSError:
        pass
    _resolved_root = inside
    return inside


#: What the app and its library were called before the rename to NeuroNet.
OLD_APP_DIR_NAME = "SynapSoul"
OLD_DATA_NAME = "synapsoul_data"
OLD_MARKER = "synapsoul.json"
OLD_PREFS = "synapsoul_prefs.json"


def _adopt_old_library(here, inside):
    """Find the library from before the rename, and take it on.

    Cam: "I want the app to be called NeuroNet. Please rename everything."

    THIS IS THE DANGEROUS PART OF A RENAME, and it is worth being plain
    about why. Every photo, track, note, board, sheet, saved game and
    training document Cam has lives in synapsoul_data/, and the app knows
    a folder is real because it contains a marker file called
    synapsoul.json. Rename the constants and nothing errors: NeuroNet
    looks for neuronet_data, does not find it, reaches step 4 and
    cheerfully creates an empty one. The window opens on a working app
    with nothing in it, which reads exactly like having lost everything.

    So the old names are still known here, and a library found under them
    is adopted: the folder is renamed to neuronet_data and its marker to
    neuronet.json, after which it is an ordinary NeuroNet library and this
    function never fires again.

    WHERE IT LOOKS, and the third one is the one that matters. Cam's
    install is /mnt/Cams_Collective/SynapSoul with the data inside it:

      1. inside the app folder     -- he renamed the folder to NeuroNet,
                                      so the data came along as
                                      NeuroNet/synapsoul_data
      2. beside the app folder     -- the layout the old step 3 handled
      3. in a sibling SynapSoul/   -- he unzipped NeuroNet next to the old
                                      install and left it alone. Nothing
                                      in the app folder or its parent is
                                      called synapsoul_data at all; it is
                                      one level further in, and without
                                      this case his library is invisible
                                      while sitting right there
      4. in his home folder        -- the old search looked there, so this
                                      one does too

    NOTHING IS EVER DELETED. The folder is renamed, which on one disk is
    atomic: it is wholly under the old name or wholly under the new one,
    never half of each. If the rename cannot happen -- a different disk,
    a permission -- the folder is used exactly where it is, under its old
    name, and the reason goes in the log. A library that cannot be moved
    is still a library; refusing to open it would be the one outcome
    worse than leaving it where it lies.

    A library_path.txt is not consulted here because step 1 already
    returned before this ran. That is deliberate: an explicit choice of
    where the data lives outranks anything this would guess.
    """
    def is_old(path):
        return os.path.isdir(path) and os.path.exists(os.path.join(path, OLD_MARKER))

    parent = os.path.dirname(os.path.abspath(here))
    candidates = [
        os.path.join(here, OLD_DATA_NAME),
        os.path.join(parent, OLD_DATA_NAME),
        os.path.join(parent, OLD_APP_DIR_NAME, OLD_DATA_NAME),
        os.path.join(os.path.expanduser("~"), OLD_DATA_NAME),
    ]
    found = None
    for candidate in candidates:
        if is_old(candidate):
            found = candidate
            break
    if not found:
        return None

    target = inside
    # Never write over something already there. If a neuronet_data exists
    # but is not real (an empty folder from an earlier launch) it can go;
    # anything else is left alone and the old library is used in place.
    try:
        if os.path.isdir(target) and not os.listdir(target):
            os.rmdir(target)
    except OSError:
        pass

    if not os.path.exists(target):
        try:
            os.rename(found, target)
            _log_line("adopted the library from before the rename: %s -> %s"
                      % (found, target))
        except OSError as exc:
            _log_line("could not move the old library (%s); using it where "
                      "it is: %s" % (exc, found))
            target = found
    else:
        _log_line("a neuronet_data already exists at %s; using the old "
                  "library where it is: %s" % (target, found))
        target = found

    # The marker carries the name too. Renamed, not rewritten, and only
    # when the new one is not already there.
    old_marker = os.path.join(target, OLD_MARKER)
    new_marker = os.path.join(target, "neuronet.json")
    if os.path.exists(old_marker) and not os.path.exists(new_marker):
        try:
            os.rename(old_marker, new_marker)
        except OSError as exc:
            _log_line("could not rename the library marker (%s)" % exc)
    return target


def _adopt_old_prefs(here):
    """The settings file, by the same rule as the library above.

    Losing this is not losing data, but it is losing every choice Cam has
    made -- theme, text size, which subsections are hidden, where the app
    opens -- and the app would come up looking like a fresh install even
    with the library attached. Renamed if the new name is free, never
    overwritten, never deleted.
    """
    old = os.path.join(here, OLD_PREFS)
    new = os.path.join(here, "neuronet_prefs.json")
    if os.path.isfile(old) and not os.path.exists(new):
        try:
            os.rename(old, new)
            _log_line("adopted settings from before the rename: %s -> %s"
                      % (old, new))
        except OSError as exc:
            _log_line("could not adopt the old settings (%s)" % exc)


def _log_line(message):
    """A line in the log before the Api exists, for the data move above --
    the one thing worth a record that happens before the window opens."""
    try:
        path = os.path.join(app_dir(), "neuronet.log")
        from datetime import datetime as _dt
        with open(path, "a", encoding="utf-8") as f:
            f.write("%s  %s\n" % (_dt.now().isoformat(timespec="seconds"),
                                   message))
    except OSError:
        pass


def set_library_root(path):
    """Points NeuroNet at a chosen folder, and remembers it."""
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
    return os.path.join(data_dir(), "neuronet.json")


# -- The first-boot welcome (NeuroNet System plan, Stage 3, 2026-09-29) ----------
# Cam: on a new computer NeuroNet should "pop up a window when you boot ... that
# will ask for an import of a data file ... Then it imports once and it is good
# to go", with "Start fresh" for anyone who isn't Cam. It shows while NeuroNet
# has no data here (no neuronet.json) and the welcome hasn't been answered;
# neuronet-quick asks the same question at login, to open NeuroNet in view.
def _welcome_file():
    state = os.environ.get("XDG_STATE_HOME") or os.path.expanduser("~/.local/state")
    return os.path.join(state, "neuronet", "welcome.json")


def welcome_wanted():
    if os.path.exists(_welcome_file()):
        return False
    data_dir()
    if _missing_data:       # the data is on a drive that isn't here: not a new computer
        return False
    try:
        return not os.path.isfile(os.path.join(data_dir(), "neuronet.json"))
    except OSError:
        return False


def welcome_mark_done(how):
    path = _welcome_file()
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"done": how, "when": datetime.datetime.now().isoformat(timespec="seconds")}, f)
    except OSError:
        pass


_prefs_adopted = False


def prefs_file():
    """Where the settings live -- in the DATA folder -- adopting older
    files once.

    IN THE DATA FOLDER (2026-09-29). Cam, asked where the settings should
    live now NeuroNet is to be shared with family and friends: "In data
    folder". Beside the app they were one set for everyone who used that
    NeuroNet, sat next to the code an update replaces, and stayed behind
    when the data moved to a new computer. In the data folder they're the
    person's, and the new-machine export carries them with everything else.

    On the first ask of a launch: the pre-rename file is adopted in the app
    folder as before, and then a settings file still there is moved into
    the data folder -- renamed if both are on one disk (atomic), copied if
    not, with the original left where it was. Never over one already in
    the data folder, and never deleted.

    Done here rather than at startup because this is the first thing to
    ask for the file, and doing it on the first ask means it cannot be
    missed by a code path that reads prefs before some init function ran.
    The flag keeps it to one attempt per launch -- a rename that failed
    once will fail again, and retrying it on every read would fill the
    log with the same line.
    """
    global _prefs_adopted
    here = app_dir()
    new = os.path.join(data_dir(), "neuronet_prefs.json")
    if not _prefs_adopted:
        _prefs_adopted = True
        _adopt_old_prefs(here)
        old = os.path.join(here, "neuronet_prefs.json")
        if os.path.isfile(old) and not os.path.exists(new) \
                and os.path.abspath(old) != os.path.abspath(new):
            try:
                os.rename(old, new)
                _log_line("settings moved into the data folder: %s -> %s" % (old, new))
            except OSError:
                try:
                    import shutil
                    shutil.copy2(old, new)
                    _log_line("settings copied into the data folder: %s -> %s "
                              "(the original is left where it was)" % (old, new))
                except OSError as exc:
                    _log_line("couldn't bring the settings into the data folder: %s" % exc)
                    return old
    return new


def usage_file():
    """App stats' record of how the app is used (see app_stats.py). Its own
    file, not prefs: it is written every minute the app is open, and a
    settings file rewritten that often is a settings file one bad write
    away from losing Cam's layout."""
    return os.path.join(data_dir(), "usage.json")


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
    """The photo library's shape, filled in rather than trusted.

    A photo read from disk may predate a field, or have been hand-edited.
    Every list is coerced to a list and every photo to the full shape, so
    no screen has to check for a missing key.
    """
    doc = raw if isinstance(raw, dict) else {}
    out = {}

    photos = doc.get("photos")
    out["photos"] = [p for p in photos if isinstance(p, dict)] \
        if isinstance(photos, list) else []
    for p in out["photos"]:
        p.setdefault("id", uuid.uuid4().hex)
        p.setdefault("storedName", "")
        p.setdefault("originalName", p.get("storedName", ""))
        p.setdefault("caption", "")
        p.setdefault("notes", "")
        p.setdefault("tags", [] if not isinstance(p.get("tags"), list) else p["tags"])
        if not isinstance(p.get("tags"), list):
            p["tags"] = []
        p.setdefault("albumIds", [])
        if not isinstance(p.get("albumIds"), list):
            p["albumIds"] = []
        p.setdefault("folderId", "")
        p.setdefault("rating", 0)
        p.setdefault("takenDate", "")
        p.setdefault("created", "")
        # What the photo is FOR. NeuroNet's library holds deck art,
        # rune faces and album covers as well as ordinary pictures, and
        # the pickers filter on this so a tarot picker is not full of
        # album sleeves. Blank means "just a photo".
        p.setdefault("kind", "")

    for key in ("albums", "folders"):
        value = doc.get(key)
        out[key] = [x for x in value if isinstance(x, dict)] \
            if isinstance(value, list) else []
        for x in out[key]:
            x.setdefault("id", uuid.uuid4().hex)
            x.setdefault("name", "")
        if key == "folders":
            for x in out[key]:
                x.setdefault("parentId", "")

    tags = doc.get("photoTagList")
    out["photoTagList"] = [t for t in tags if isinstance(t, str)] \
        if isinstance(tags, list) else []
    return out


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
# Printing — shared by every module
# ===========================================================================
# Cranium's puzzle books print through here, and so will a card spread.
# The document is a standalone temp file opened by the OS browser, so it
# cannot reference the app's own stylesheet or photo folder -- everything
# it needs is embedded in it.

def _photo_data_uri(stored_name):
    """Same base64 embed the in-app photo grid uses, reused so a printed
    page can carry its own pictures. The print file is a standalone temp
    file opened by the OS browser, so it needs the image data inline
    rather than a path into photos_dir()."""
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
    bar and warm accents throughout rather than plain
    Georgia-on-white. print-color-adjust is
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



def open_print_document(html_body):
    return crux_print.open_html(html_body, prefix="neuronet-print-")


def guide_pdf(html, dest, chrome="chromium"):
    """A finished HTML document -> a PDF at dest, through headless Chromium.
    Written beside dest first and renamed, so a half-made PDF never sits
    where a whole one should."""
    import tempfile
    work = tempfile.mkdtemp(prefix="neuronet-guide-")
    try:
        page = os.path.join(work, "guide.html")
        with open(page, "w", encoding="utf-8") as f:
            f.write(html)
        part = dest + ".part"
        r = subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                            "--user-data-dir=" + os.path.join(work, "profile"),
                            "--print-to-pdf=" + part, "file://" + page],
                           capture_output=True, text=True, timeout=180)
        if r.returncode != 0 or not os.path.isfile(part) or os.path.getsize(part) < 1000:
            try:
                os.remove(part)
            except OSError:
                pass
            return {"error": "The PDF couldn't be made (%s)." % ((r.stderr or "").strip()[-200:] or r.returncode)}
        os.replace(part, dest)
        return {"ok": True, "path": dest, "bytes": os.path.getsize(dest)}
    except (OSError, subprocess.SubprocessError) as e:
        return {"error": "The PDF couldn't be made: %s" % e}
    finally:
        shutil.rmtree(work, ignore_errors=True)



# ======================================================================
# CHORDS — the music module's own folders, moved from Cam's Chords app.
# ======================================================================
AUDIO_EXTS = (".mp3", ".wav", ".flac", ".ogg", ".oga", ".opus", ".m4a",
              ".aac", ".wma", ".aiff", ".aif", ".alac", ".mp4a", ".weba")
VIDEO_EXTS = (".mp4", ".webm", ".mov", ".m4v", ".ogv", ".mkv")
# What the media server will serve at all. A guided meditation may be
# either, which is the whole reason this is wider than AUDIO_EXTS.
MEDIA_EXTS = AUDIO_EXTS + VIDEO_EXTS


def is_video_file(name):
    return str(name).lower().endswith(VIDEO_EXTS)


def chords_dir():
    """Chords' own folder inside the data folder.

    A file per domain, not one document: the music library and the
    photo library are written by different modules at different times,
    and a bad write should not be able to take both.
    """
    d = os.path.join(data_dir(), "chords")
    os.makedirs(d, exist_ok=True)
    return d


def chords_file():
    return os.path.join(chords_dir(), "chords.json")


def music_dir():
    d = os.path.join(chords_dir(), "music")
    os.makedirs(d, exist_ok=True)
    return d


def safe_audio_path(name, must_exist=True):
    """An audio filename -> absolute path inside music/, or None if the
    name tries anything clever (traversal, absolute path, wrong type)."""
    base = os.path.basename(str(name or ""))
    if base != name or not base.lower().endswith(AUDIO_EXTS):
        return None
    path = os.path.join(music_dir(), base)
    if must_exist and not os.path.isfile(path):
        return None
    return path


def dedupe_audio_name(base):
    """song.mp3 -> song-2.mp3, -3... until free."""
    stem, ext = os.path.splitext(os.path.basename(base))
    cand, n = stem + ext, 2
    while os.path.exists(os.path.join(music_dir(), cand)):
        cand = f"{stem}-{n}{ext}"
        n += 1
    return cand


def audio_file_url(path):
    """The fallback when no socket could be opened at all."""
    try:
        from pathlib import Path
        return Path(path).resolve().as_uri()
    except Exception:
        return None


# PORTED FROM CAM'S CHORDS, UNCHANGED. This is the most carefully
# written piece of any of the apps being merged, and every line of it
# is a response to a real failure: WebKitGTK refusing file:// media
# from another directory, file:// not doing byte ranges so seeking
# broke, and a 400MB lossless album not fitting in memory. It is not
# improved here, only moved -- the only edit anywhere in the module is
# that the Api method which starts it is called chords_audio_url rather
# than something generic.
# ---------------------------------------------------------------------------
# THE LOOPBACK MEDIA SERVER — how music actually plays.
#
# A file:// page (which is how a pywebview window is opened) cannot load
# media from a different directory — WebKitGTK in particular refuses it
# outright, which looks exactly like an unsupported format and is not one.
# So music/ is served over plain HTTP on 127.0.0.1 instead, and the
# <audio> element gets a real http:// URL:
#   * Range requests -> real seeking, which a scrub bar needs and which
#     file:// media loads in WebKit don't do reliably at all.
#   * Nothing is ever held in memory: files stream in 64KB chunks, so a
#     400MB lossless album costs one buffer, not 400MB (and never the
#     ~1.3x-bigger base64 a data: URL would cost instead).
#
# SAFETY, since this does open a real socket on Cam's own machine:
#   * bound to 127.0.0.1 only, never 0.0.0.0 — unreachable off the machine,
#   * an ephemeral, OS-chosen port,
#   * a fresh random token in every URL path, so another local program
#     that happens to guess the port still can't enumerate anything,
#   * only music/ is reachable, only real AUDIO_EXTS, and every name goes
#     through the exact same safe_audio_path basename check as everywhere
#     else — no traversal, no absolute paths,
#   * GET/HEAD/OPTIONS only; nothing here ever writes anything,
#   * started LAZILY on the first real track load, so a session that
#     never plays a note never opens a socket at all.
# ---------------------------------------------------------------------------
MEDIA_CHUNK = 64 * 1024
MEDIA_MIME = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".flac": "audio/flac",
    ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg",
    ".m4a": "audio/mp4", ".mp4a": "audio/mp4", ".aac": "audio/aac",
    ".weba": "audio/webm", ".aiff": "audio/aiff", ".aif": "audio/aiff",
    ".alac": "audio/mp4", ".wma": "audio/x-ms-wma",
}

_MEDIA_SERVER = {"port": None, "token": None, "httpd": None, "thread": None}
_MEDIA_LOCK = threading.Lock()


def media_content_type(path):
    ext = os.path.splitext(str(path))[1].lower()
    return MEDIA_MIME.get(ext) or mimetypes.guess_type(str(path))[0] \
        or "application/octet-stream"


def parse_byte_range(header, size):
    """A Range header -> (first, last) inclusive byte offsets, None for
    "send the whole thing" (a 200), or "bad" for a range that can't be
    satisfied (a 416). Single ranges only — a media element never asks
    for multipart."""
    if not header or size <= 0:
        return None
    m = re.match(r"^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$", str(header))
    if not m:
        return None
    first, last = m.group(1), m.group(2)
    if not first and not last:
        return None
    if not first:
        n = int(last)
        if n <= 0:
            return "bad"
        return (max(0, size - n), size - 1)
    start = int(first)
    if start >= size:
        return "bad"
    end = int(last) if last else size - 1
    end = min(end, size - 1)
    if end < start:
        return "bad"
    return (start, end)


# The folders the media server may serve, and nothing else.
#
# ONE SERVER, TWO FOLDERS. Chords brought a loopback media server for
# music and Celestial brought an identical one for guided meditations.
# Two servers in one process, listening on two ports, for exactly the
# same reason, is the duplication this whole merge exists to remove --
# so the URL carries which folder it wants and a single server answers
# for both. Adding a third is a line in this dict.
MEDIA_ROOTS = {
    "music": lambda: music_dir(),
    "meditation": lambda: meditation_dir(),
    # Pictures by address (2026-10-05, the audit's first fix). Thumbnails and
    # frames used to cross the bridge as base64 text: each one was held as
    # file bytes, a Python string, JSON, a JS string in SS.Art's 1,200-entry
    # cache and a decoded bitmap -- in both processes. Now the page gets a
    # short address on this server and the web engine fetches, caches,
    # decodes and frees the picture itself. Display only: anything that is
    # embedded or edited (boards, scrapbooks, prints, full photos) still
    # gets the picture's data.
    "photo-thumbs": lambda: thumbs_dir(),
    "photo-frames": lambda: frames_dir(),
    "music-thumbs": lambda: music_thumbs_dir(),
    "music-images": lambda: music_images_dir(),
    "cards-thumbs": lambda: cards_thumbs_dir(),
    "cards-images": lambda: cards_images_dir(),
    # 2026-10-06, the audit's remaining pictures: Assets' tiles and the journal
    "asset-thumbs": lambda: os.path.join(assets_dir(), ".thumbs"),
    "journal-images": lambda: journal.images_dir(),
    "journal-thumbs": lambda: journal.thumbs_dir(),
}
IMAGE_ROOTS = {"photo-thumbs", "photo-frames", "music-thumbs", "music-images",
               "cards-thumbs", "cards-images", "asset-thumbs", "journal-images", "journal-thumbs"}
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp")


def safe_media_path(kind, name, must_exist=True):
    """(folder, filename) -> an absolute path inside that folder, or
    None if anything about it is off.

    The folder is looked up in a fixed dict rather than joined, so a
    request cannot name a folder that was never meant to be served.
    The filename must be a bare basename of a type we recognise -- no
    separators, no traversal, no absolute paths.
    """
    root = MEDIA_ROOTS.get(str(kind))
    if not root:
        return None
    base = os.path.basename(str(name or ""))
    allowed = IMAGE_EXTS if str(kind) in IMAGE_ROOTS else MEDIA_EXTS
    if base != name or not base.lower().endswith(allowed):
        return None
    path = os.path.join(root(), base)
    if must_exist and not os.path.isfile(path):
        return None
    return path


def media_url_for(kind, name):
    port, token = _MEDIA_SERVER.get("port"), _MEDIA_SERVER.get("token")
    if not port or not token:
        return None
    from urllib.parse import quote
    return "http://127.0.0.1:%d/media/%s/%s/%s" % (
        port, token, quote(str(kind), safe=""), quote(str(name), safe=""))


def _media_handler_class(token):
    """Bound to one token via closure, never an attribute something
    else could read or rewrite."""
    from http.server import BaseHTTPRequestHandler
    from urllib.parse import unquote

    class MediaHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "ChordsMedia/1.0"

        def log_message(self, *args):
            """Silence — a media element makes dozens of range
            requests per track, and logging all of them would bury
            anything actually worth seeing in the terminal."""

        def _common(self, cache=False):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods",
                              "GET, HEAD, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Range")
            self.send_header("Access-Control-Expose-Headers",
                              "Accept-Ranges, Content-Length, Content-Range")
            # a picture's address names its version (?v=mtime-size), so it can
            # be kept; audio and errors are never cached
            self.send_header("Cache-Control", "private, max-age=31536000, immutable" if cache else "no-store")

        def _plain(self, code, text="no"):
            body = text.encode("utf-8")
            self.send_response(code)
            self._common()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            try:
                self.wfile.write(body)
            except OSError:
                self.close_connection = True

        def do_OPTIONS(self):
            self.send_response(204)
            self._common()
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_HEAD(self):
            self._serve(send_body=False)

        def do_GET(self):
            self._serve(send_body=True)

        def _resolve(self):
            """-> (path, None) or (None, http status). Path shape is
            /media/<token>/<folder>/<url-encoded filename>.

            The folder segment is new: one server answers for both the
            music library and the meditation library. It is looked up
            in MEDIA_ROOTS, never joined, so an unknown folder is a 404
            rather than a path."""
            parts = self.path.split("?")[0].split("/")
            if len(parts) != 5 or parts[0] != "" or parts[1] != "media":
                return None, 404
            tok, kind, name = parts[2], unquote(parts[3]), unquote(parts[4])
            if not secrets.compare_digest(tok, token):
                return None, 403
            path = safe_media_path(kind, name)
            if not path:
                return None, 404
            return path, None

        def _cinema(self, send_body):
            """/cinema/<token>/<film, url-encoded>?t=<seconds>&a=<audio track>:
            the film, converted live for the page's own player (cinema.py).
            The film is looked up under the Movies folder by media_shelf's own
            check, never joined from the address."""
            import media_shelf
            import cinema
            from urllib.parse import parse_qs
            raw, _, query = self.path.partition("?")
            parts = raw.split("/")
            if len(parts) != 4 or not secrets.compare_digest(parts[2], token):
                self._plain(403 if len(parts) == 4 else 404, "not available")
                return
            path = cinema.resolve(data_dir(), media_shelf.movies_dir(app_dir(), create=False), unquote(parts[3]))
            if not path:
                self._plain(404, "not available")
                return
            q = parse_qs(query)
            try:
                start = max(0.0, min(float((q.get("t") or ["0"])[0]), 360000.0))
                audio = max(0, min(int((q.get("a") or ["0"])[0]), 31))
            except ValueError:
                self._plain(400, "bad request")
                return
            self.send_response(200)
            self._common()
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True
            if send_body:
                cinema.serve_stream(self.wfile.write, path, start, audio)

        def _serve(self, send_body):
            if self.path.startswith("/cinema/"):
                return self._cinema(send_body)
            path, err = self._resolve()
            if err:
                self._plain(err, "not available")
                return
            try:
                size = os.path.getsize(path)
            except OSError:
                self._plain(404, "not available")
                return
            rng = parse_byte_range(self.headers.get("Range"), size)
            if rng == "bad":
                self.send_response(416)
                self._common()
                self.send_header("Content-Range", "bytes */%d" % size)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            start, end = rng if rng else (0, size - 1)
            length = end - start + 1
            self.send_response(206 if rng else 200)
            self._common(cache=media_content_type(path).startswith("image/"))
            self.send_header("Content-Type", media_content_type(path))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(length))
            if rng:
                self.send_header("Content-Range",
                                  "bytes %d-%d/%d" % (start, end, size))
            self.end_headers()
            if not send_body:
                return
            try:
                with open(path, "rb") as f:
                    f.seek(start)
                    left = length
                    while left > 0:
                        buf = f.read(min(MEDIA_CHUNK, left))
                        if not buf:
                            break
                        self.wfile.write(buf)
                        left -= len(buf)
            except (OSError, ValueError):
                # Every seek and every track change ABORTS an
                # in-flight response. Normal operation for a media
                # server, not an error.
                self.close_connection = True

    return MediaHandler


def picture_url(kind, path):
    """A picture on disk -> its address on the local media server, with a
    version in the query so a changed file gets a new address; None when the
    server can't be had (callers then fall back to the old data URL)."""
    try:
        st = os.stat(path)
    except OSError:
        return None
    if not ensure_media_server():
        return None
    url = media_url_for(kind, os.path.basename(path))
    return "%s?v=%d-%d" % (url, st.st_mtime_ns, st.st_size) if url else None


def _picture(kind, path):
    """{"dataUrl": address} for display -- the address where the server is up,
    the data itself if not (the field keeps its old name so every caller,
    which only sets img.src, takes either)."""
    url = picture_url(kind, path)
    return {"dataUrl": url, "url": url} if url else _encode_file(path)


def cinema_stream_url(rel):
    """The address the page's player streams a film from (see _cinema)."""
    srv = ensure_media_server()
    if not srv:
        return None
    from urllib.parse import quote
    return "http://127.0.0.1:%d/cinema/%s/%s" % (srv["port"], srv["token"], quote(str(rel), safe=""))


def ensure_media_server():
    """Start the loopback server if it isn't up yet; return
    {"port", "token"} or None if no socket could be opened.
    Idempotent and thread-safe."""
    with _MEDIA_LOCK:
        if _MEDIA_SERVER.get("port"):
            return {"port": _MEDIA_SERVER["port"],
                     "token": _MEDIA_SERVER["token"]}
        from http.server import ThreadingHTTPServer
        token = secrets.token_urlsafe(18)
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", 0),
                                         _media_handler_class(token))
        except OSError:
            return None
        httpd.daemon_threads = True
        thread = threading.Thread(target=httpd.serve_forever,
                                   name="chords-media-server", daemon=True)
        thread.start()
        _MEDIA_SERVER.update(port=httpd.server_address[1], token=token,
                              httpd=httpd, thread=thread)
        return {"port": _MEDIA_SERVER["port"], "token": token}


# Code -> IDE: Algorithm's Api, made on first use (Api._code), and the
# names of its methods NeuroNet answers as code_<name>.
_code_api = None
CODE_IDE_CALLS = (
    "get_settings", "set_setting", "choose_folder",
    "list_projects", "create_project", "delete_project", "tree",
    "read_file", "write_file", "create_file", "create_folder", "rename_path",
    "delete_path", "search_project",
    "list_guides", "import_guide", "read_guide", "delete_guide",
    "export_markdown", "export_preview",
    "set_dirty", "save_draft", "clear_draft", "list_drafts", "has_unsaved",
    "run_command", "run_output", "run_input", "run_stop",
    "command_history", "remember_command", "run_suggestions",
    "log_error", "read_log",
)


def stop_code_runs():
    """A command left running in Code -> IDE's terminal would outlive the
    window and keep writing to a terminal nobody can see (Algorithm did the
    same on close)."""
    if _code_api is not None:
        try:
            import code_ide
            code_ide.RUNNER.stop_all()
        except Exception:
            pass


def stop_media_server():
    """Only used by tests — the real app's server is a daemon thread
    and dies with the process."""
    with _MEDIA_LOCK:
        httpd = _MEDIA_SERVER.get("httpd")
        if httpd:
            try:
                httpd.shutdown()
                httpd.server_close()
            except Exception:
                pass
        _MEDIA_SERVER.update(port=None, token=None, httpd=None, thread=None)


# ---------------------------------------------------------------------------

# ======================================================================
# CRANIUM — the games module's own file.
# ======================================================================
# Its own folder inside the data folder, and its own file. Cranium
# shipped with get_data/save_data on a hardcoded path, which in a shared
# pywebview namespace is one module silently overwriting another's data.
CRANIUM_KEYS = ("stats", "saved", "wordLists", "wordGuessList",
                "slideImages", "books")


def cranium_dir():
    d = os.path.join(data_dir(), "cranium")
    os.makedirs(d, exist_ok=True)
    return d


def cranium_file():
    return os.path.join(cranium_dir(), "cranium.json")


def cranium_prefs_file():
    return os.path.join(cranium_dir(), "prefs.json")


def normalize_cranium(raw):
    """Cranium's own shape gate, moved across as it was.

    The original dropped any top-level key it did not know about on the
    next write -- so a key added by a future build would vanish. Kept
    deliberately: the games rely on these six being the right types, and
    the drop is documented in Cranium's own source. Anything new must be
    added to CRANIUM_KEYS in the same change.
    """
    doc = raw if isinstance(raw, dict) else {}
    out = {}
    out["stats"] = doc.get("stats") if isinstance(doc.get("stats"), dict) else {}
    out["saved"] = doc.get("saved") if isinstance(doc.get("saved"), dict) else {}
    for key in ("wordLists", "wordGuessList", "slideImages", "books"):
        value = doc.get(key)
        out[key] = value if isinstance(value, list) else []
    return out


# ======================================================================
# CELESTIAL — divination and mindfulness.
# ======================================================================
# Its own file inside the data folder. Celestial shipped read_json /
# write_json / image_url / save_image, all maximally generic, in the
# one flat pywebview namespace every other module shares.
def cards_dir():
    d = os.path.join(data_dir(), "cards")
    os.makedirs(d, exist_ok=True)
    return d


def cards_file():
    return os.path.join(cards_dir(), "celestial.json")


def cards_images_dir():
    """Card faces, covers and backs.

    Kept separate from photos/ on purpose. The photo library is where a
    picture ENTERS NeuroNet; this is where an ASSIGNED one lives, under
    a name derived from the deck and card. One picture can be assigned
    to several cards, and deleting a card must not reach back into the
    library and remove the original -- the same correction KinCrux made
    when recipe photos stopped being private copies.
    """
    d = os.path.join(cards_dir(), "images")
    os.makedirs(d, exist_ok=True)
    return d


def cards_thumbs_dir():
    d = os.path.join(cards_dir(), "thumbs")
    os.makedirs(d, exist_ok=True)
    return d


def cards_print_dir():
    """Print-sized copies of card art, for the guidebook printout."""
    d = os.path.join(cards_dir(), "print")
    os.makedirs(d, exist_ok=True)
    return d


#: A printed guidebook card is about 10 cm tall. 1000 px is ~250 dpi there --
#: sharp on paper -- while 78 of them still make a PDF of a sensible size.
#: The 360 px thumbnails print soft.
CARD_PRINT_MAX_DIM = 1000
CARD_PRINT_QUALITY = 80


def card_print_path(name):
    """A card picture's print copy (CARD_PRINT_MAX_DIM), made when missing or
    older than the picture; the file's path, or None. Falls back to the
    picture itself if Pillow can't make one."""
    base = os.path.basename(str(name or ""))
    if not base or base != name:
        return None
    src = os.path.join(cards_images_dir(), base)
    if not os.path.isfile(src):
        return None
    dest = os.path.join(cards_print_dir(), os.path.splitext(base)[0] + ".print.jpg")
    try:
        if not os.path.isfile(dest) or os.path.getmtime(dest) < os.path.getmtime(src):
            from PIL import Image
            img = Image.open(src)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.thumbnail((CARD_PRINT_MAX_DIM, CARD_PRINT_MAX_DIM), Image.LANCZOS)
            img.save(dest, "JPEG", quality=CARD_PRINT_QUALITY, optimize=True)
        return dest
    except Exception:
        return src


def music_images_dir():
    d = os.path.join(chords_dir(), "images")
    os.makedirs(d, exist_ok=True)
    return d


def music_thumbs_dir():
    d = os.path.join(chords_dir(), "thumbs")
    os.makedirs(d, exist_ok=True)
    return d


def _art_data_url(name, full=True, edge=None, as_url=False):
    """Album art as a data: URL -- or, with as_url (thumbnails, since
    2026-10-05), its address on the local media server, so the hundreds of
    covers on a page no longer sit in memory as text.

    edge: a copy sized for one particular place, cached per size. Used by
    the open album's big cover, which asks for exactly the pixels it is
    drawn at. Cam: "When in album view when scrolling the page lags." The
    album page was the one place in Chords drawing a full-size image into a
    smaller box (768 into 260). A GPU-composited browser scales that once
    and keeps the result, which is why it never showed up in testing; a
    software renderer like Cam's WebKitGTK can scale it again on every
    repaint -- and while scrolling, that is every frame. Drawn at its real
    size, there is nothing left to scale."""
    base = os.path.basename(str(name or ""))
    if not base or base != name:
        return None
    src = os.path.join(music_images_dir(), base)
    if not os.path.isfile(src):
        return None
    path = src
    if edge:
        stem = os.path.splitext(base)[0]
        dest = os.path.join(music_thumbs_dir(), "%s.%d.jpg" % (stem, edge))
        try:
            from PIL import Image
            with Image.open(src) as probe:      # reads the header only
                if max(probe.size) <= edge:
                    # Already no bigger than asked for: a re-encoded copy
                    # would only be a worse version of the same picture.
                    got = _picture("music-images", src) if as_url else _encode_file(src)
                    return got.get("dataUrl") if isinstance(got, dict) else None
            if (not os.path.isfile(dest)
                    or os.path.getmtime(dest) < os.path.getmtime(src)):
                from PIL import Image
                img = Image.open(src)
                if img.mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGB")
                # thumbnail() never enlarges: a small source stays as it is.
                img.thumbnail((edge, edge), Image.LANCZOS)
                img.save(dest, "JPEG", quality=88, optimize=True)
            path = dest
        except Exception:
            path = src          # Pillow missing: full size beats nothing
        got = (_picture("music-images" if path == src else "music-thumbs", path) if as_url
               else _encode_file(path))
        return got.get("dataUrl") if isinstance(got, dict) else None
    if not full:
        stem = os.path.splitext(base)[0]
        dest = os.path.join(music_thumbs_dir(), stem + ".thumb.jpg")
        try:
            if (not os.path.isfile(dest)
                    or os.path.getmtime(dest) < os.path.getmtime(src)):
                _make_thumbnail(src, dest)
            path = dest
        except Exception:
            path = src          # Pillow missing: full size beats nothing
    got = (_picture("music-images" if path == src else "music-thumbs", path) if as_url
               else _encode_file(path))
    return got.get("dataUrl") if isinstance(got, dict) else None



# ======================================================================
# MEDITATION — Cam's own guided audio and video.
# ======================================================================
# Cam: "i want to be able to upload my video and soundtrack guides for
# meditation."
#
# These files are LARGE -- a guided video can be hundreds of megabytes --
# and that shapes every decision here:
#
#   * Import takes PATHS from the native dialog and copies on disk. The
#     file never crosses the JS bridge, which would cost several times
#     its size in memory for no reason.
#   * Playback goes through the loopback media server, so the browser
#     streams it in 64 KB chunks with real byte ranges. A data: URL
#     would load the whole thing into the page before a note played.
#   * Nothing is ever read into Python memory either. The server opens
#     the file and writes it out.
def meditation_dir():
    d = os.path.join(data_dir(), "meditation")
    os.makedirs(d, exist_ok=True)
    return d


def dedupe_media_name(base):
    """guide.mp4 -> guide-2.mp4, -3... until free."""
    stem, ext = os.path.splitext(os.path.basename(base))
    cand, n = stem + ext, 2
    while os.path.exists(os.path.join(meditation_dir(), cand)):
        cand = "%s-%d%s" % (stem, n, ext)
        n += 1
    return cand


def probe_media_meta(name):
    """Duration and any embedded title, if ffprobe happens to be here.

    Deliberately best-effort. ffprobe is not a dependency: without it
    the file still imports and still plays, it just shows no duration.
    A missing nicety must not stop Cam adding his own recordings.
    """
    path = safe_media_path("meditation", name)
    if not path or not shutil.which("ffprobe"):
        return {}
    try:
        import subprocess
        raw = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", path],
            capture_output=True, text=True, timeout=20).stdout
        fmt = (json.loads(raw) or {}).get("format") or {}
    except Exception:
        return {}
    out = {}
    try:
        dur = float(fmt.get("duration"))
        if dur > 0:
            out["duration"] = dur
    except (TypeError, ValueError):
        pass
    tags = {str(k).lower(): v for k, v in (fmt.get("tags") or {}).items()}
    title = tags.get("title")
    if isinstance(title, str) and title.strip():
        out["title"] = title.strip()
    return out


def list_meditation_files():
    out = []
    try:
        for n in sorted(os.listdir(meditation_dir())):
            path = os.path.join(meditation_dir(), n)
            if not n.lower().endswith(MEDIA_EXTS) or not os.path.isfile(path):
                continue
            out.append({"name": n,
                        "kind": "video" if is_video_file(n) else "audio",
                        "size": os.path.getsize(path)})
    except OSError:
        pass
    return out


# --------------------------------------------------------------- Api ---
# ============================================================== training ===
"""Coach Cam's coaching document: exercises, circuits, sessions, guides,
questionnaires, calendars, athletes, equipment, circuit types, lesson plans,
programs and books.

Cam: "I want the training features to be moved from KinCrux to NeuroNet
please, remove it from KinCrux entirely."

WHERE IT LIVES. neuronet_data/training/ -- inside the data folder, beside
chords/ and cranium/, so everything NeuroNet owns moves together.

WHY IT DOES NOT SEARCH FOR coach_cam_data. KinCrux's version searched for
Coach Cam's folder first and only created its own when that failed -- and
it did fail, which is how KinCrux ended up editing a separate copy. Cam is
keeping standalone Coach Cam running alongside, over its own data. If
NeuroNet searched for coach_cam_data, then the day that folder became
findable -- a move, a symlink, a new install one level up -- NeuroNet
would silently switch to a different training library. So the location is
fixed. Two separate libraries is what Cam chose; a library that changes
underneath you is not.

WHY EVERY METHOD IS NAMESPACED. Coach Cam's storage layer calls get_data
and save_data. So does everything else here, and they mean different
files. Every backend method is training_*, and ui/training/storage.js
calls nothing else.
"""

TRAINING_EMPTY = {
    "exercises": {}, "circuits": [], "sessions": [], "guides": [],
    "questionnaires": [], "calendars": [], "athletes": [], "equipment": [],
    "circuitTypes": [], "lessonPlans": [],
}

_training_checked = False


def training_dir():
    d = os.path.join(data_dir(), "training")
    os.makedirs(d, exist_ok=True)
    global _training_checked
    if not _training_checked:
        _training_checked = True
        _bring_training_from_kincrux(d)
    return d


def training_file():
    return os.path.join(training_dir(), "coach_cam.json")


def training_prefs_file():
    """Coach Cam's own prefs.json, kept separate from NeuroNet's. Its
    README is explicit that questionnaire answers go here rather than into
    the shared document, so the original app never sees a key it does not
    recognise."""
    return os.path.join(training_dir(), "prefs.json")


def _kincrux_training_candidates():
    """Where KinCrux kept its training, nearest first.

    KinCrux created kincrux_training/ INSIDE its own app folder, which on
    Cam's machine sits beside this one under Cams_Collective/.
    """
    parent = os.path.dirname(os.path.abspath(app_dir()))
    return [
        os.path.join(parent, "KinCrux", "kincrux_training"),
        os.path.join(parent, "kincrux_training"),
        os.path.join(os.path.expanduser("~"), "kincrux_training"),
    ]


def _valid_training_file(path):
    """True if this is a coaching document rather than something else that
    happens to be called coach_cam.json -- parsed, a dict, and carrying at
    least one of the collections a coaching document always has."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return False
    return isinstance(data, dict) and any(k in data for k in TRAINING_EMPTY)


def _bring_training_from_kincrux(dest):
    """Copy KinCrux's training in, once, if NeuroNet has none yet.

    COPIED, NOT MOVED. KinCrux's folder is left exactly as it was: it is
    the only other copy of 35 sessions and 58 circuits, and the cost of
    keeping it until Cam has seen them here is a few megabytes.

    Only ever runs into an EMPTY destination. If neuronet_data/training/
    already holds a coaching document, nothing is copied -- otherwise a
    second launch would overwrite a week of work with KinCrux's older copy.

    The copy is checked before it is trusted: coach_cam.json must parse
    and look like a coaching document. A half-finished copy is removed
    rather than left to open as an empty or broken library.
    """
    target = os.path.join(dest, "coach_cam.json")
    if os.path.exists(target):
        return "present"

    for source in _kincrux_training_candidates():
        src_file = os.path.join(source, "coach_cam.json")
        if not (os.path.isfile(src_file) and _valid_training_file(src_file)):
            continue
        copied = []
        try:
            for name in sorted(os.listdir(source)):
                src = os.path.join(source, name)
                dst = os.path.join(dest, name)
                if os.path.exists(dst):
                    continue
                if os.path.isdir(src):
                    shutil.copytree(src, dst)
                else:
                    shutil.copy2(src, dst)
                copied.append(dst)
            if not _valid_training_file(target):
                raise OSError("the copied coach_cam.json did not verify")
            _log_line("copied training from KinCrux: %s -> %s (%d items; "
                      "the original is untouched)" % (source, dest, len(copied)))
            return "copied"
        except OSError as exc:
            # Undo only what this function created. Never the source.
            for path in copied:
                try:
                    if os.path.isdir(path):
                        shutil.rmtree(path)
                    else:
                        os.remove(path)
                except OSError:
                    pass
            _log_line("could not copy training from KinCrux (%s)" % exc)
            return "failed"
    return "none-found"


def normalize_training(raw):
    """Every collection always exists and is always the right container
    type, so the interface never guards against a missing key.

    exercises is a dict keyed by category; everything else is a list.
    A key this build does not know about is carried through untouched,
    so nothing Coach Cam writes is ever dropped here.
    """
    out = json.loads(json.dumps(TRAINING_EMPTY))
    if isinstance(raw, dict):
        for key, value in raw.items():
            if key == "exercises":
                out[key] = crux_store.as_dict(value)
            elif key in TRAINING_EMPTY:
                out[key] = crux_store.as_list(value)
            else:
                out[key] = value
    return out


# ================================================================= notes ===
"""Amnesia's notes vault -- NeuroNet's own, separate from KinCrux's.

Cam: "lets add the notes application into NeuroNet as well. Do not
remove it from KinCrux, as they will be used to store different
variations of notes and store different PDF textbooks."

So this is a copy, not a move: KinCrux keeps its Notes, over its own
vault, and NeuroNet gets a second vault at neuronet_data/notes/. The
location is handed to notes_backend rather than searched for -- see its
data_dir() for why a search here would be the wrong thing.

The vault stays a real folder of real .md files, openable in Obsidian.
The module is optional: a build without notes_backend.py loses the Notes
section and nothing else.
"""


def boards_dir():
    d = os.path.join(notes_dir(), "boards")
    os.makedirs(d, exist_ok=True)
    return d


def scrapbooks_dir():
    d = os.path.join(notes_dir(), "scrapbooks")
    os.makedirs(d, exist_ok=True)
    return d


def covers_dir():
    d = os.path.join(notes_dir(), "covers")
    os.makedirs(d, exist_ok=True)
    return d


def assets_dir():
    d = os.path.join(data_dir(), "assets")
    os.makedirs(d, exist_ok=True)
    return d


def cells_dir():
    d = os.path.join(notes_dir(), "cells")
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


def _scrapbook_path(book_id):
    return _doc_path(scrapbooks_dir(), book_id)


def _png_size(data):
    """Width and height from a PNG's header, or (0, 0)."""
    if len(data) >= 24 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    return 0, 0


def _cells_path(sheet_id):
    return _doc_path(cells_dir(), sheet_id)


def _to_desktop(filename, data, binary=False):
    """Write a finished export to the desktop without ever clobbering
    last week's one. The same rule export_text_file follows; kept as its
    own helper because a book can be text or bytes."""
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    if not os.path.isdir(desktop):
        desktop = os.path.expanduser("~")
    base = os.path.basename(str(filename or "export"))
    stem, ext = os.path.splitext(base)
    dest = os.path.join(desktop, base)
    n = 2
    while os.path.exists(dest):
        dest = os.path.join(desktop, f"{stem} ({n}){ext}")
        n += 1
    try:
        if binary:
            with open(dest, "wb") as fh:
                fh.write(data)
        else:
            with open(dest, "w", encoding="utf-8", newline="") as fh:
                fh.write(data)
        return {"ok": True, "path": dest}
    except OSError as e:
        return {"error": f"Couldn't write the file: {e}"}


def html_to_docx(html, letterhead=None):
    """A book's HTML as a Word document, in bytes.

    DELIBERATELY A SMALL SUBSET, and the subset is not a guess: it is
    exactly what a book can contain -- headings, paragraphs, lists,
    tables, quotes, code blocks and rules, which is what the Vault's own
    markdown renderer and the grid's table writer between them produce.
    Anything else becomes a plain paragraph of its text rather than being
    dropped, so a future block type degrades to something readable
    instead of vanishing.

    Written against html.parser from the standard library rather than a
    dependency: this runs on Cam's machine, and an export that needs a
    pip install nobody did is an export that does not work.
    """
    from html.parser import HTMLParser
    from io import BytesIO
    import docx
    from docx.shared import Pt
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = docx.Document()
    if letterhead:
        # The shared letterhead, drawn by Word itself: a converted page can
        # carry text but not the marks. {title, subtitle, right_logo, right_name}
        import print_header as _ph
        _ph.docx_letterhead(doc, **{k: v for k, v in dict(letterhead).items()
                                    if k in ("title", "subtitle", "right_logo",
                                             "right_name", "meta")})

    class Build(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.stack = []          # open tags, innermost last
            self.para = None         # the paragraph being filled
            self.row = None          # the table row being filled
            self.table = None
            self.cols = 0
            self.pending_cell = None
            # The tag whose whole subtree is being ignored (head, script,
            # style), and how deep we are inside it. Counting EVERY start
            # tag was the first attempt and it was wrong: <meta> and <link>
            # never send an end tag, so the counter climbed inside <head>
            # and never came back down -- the converter silently produced
            # an empty document from a perfectly good book. Void elements
            # are the whole reason this is not a simple depth counter.
            self.skip_tag = None
            self.skip_depth = 0

        # -- helpers ---------------------------------------------------
        def _has(self, *names):
            return any(t in self.stack for t in names)

        def _new(self, style=None):
            self.para = doc.add_paragraph(style=style) if style \
                else doc.add_paragraph()
            return self.para

        def _write(self, text):
            if not text:
                return
            if self.pending_cell is not None:
                self.pending_cell.append(text)
                return
            if self.para is None:
                self._new()
            run = self.para.add_run(text)
            run.bold = self._has("b", "strong", "th")
            run.italic = self._has("i", "em")
            if self._has("code", "pre"):
                run.font.name = "Consolas"
                run.font.size = Pt(9)
            if self._has("del", "s"):
                run.font.strike = True
            if self._has("u"):
                run.underline = True

        # -- structure -------------------------------------------------
        VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
                "link", "meta", "param", "source", "track", "wbr"}
        BLOCK = {"div", "section", "article", "header", "footer", "main",
                 "aside", "figure", "figcaption", "nav"}

        def handle_startendtag(self, tag, attrs):
            self.handle_starttag(tag, attrs)
            if tag not in self.VOID:
                self.handle_endtag(tag)

        def handle_starttag(self, tag, attrs):
            if self.skip_tag:
                if tag == self.skip_tag and tag not in self.VOID:
                    self.skip_depth += 1
                return
            if tag in ("script", "style", "head"):
                self.skip_tag = tag
                self.skip_depth = 1
                return
            if tag in self.VOID:
                self._void(tag)
                return
            self.stack.append(tag)
            if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
                self.para = doc.add_heading("", level=min(int(tag[1]), 4))
            elif tag == "p":
                self._new()
            elif tag == "li":
                self._new(style="List Number" if "ol" in self.stack
                          else "List Bullet")
            elif tag == "blockquote":
                self._new(style="Intense Quote")
            elif tag == "pre":
                self._new()
            elif tag in self.BLOCK:
                # A div or a section is a block: whatever follows starts a
                # new paragraph rather than running on from the last one.
                # Without this the cover page -- four divs -- came out as
                # one line reading "Coach Cam Winter Manual Pre-season
                # block 6 items".
                self.para = None
            elif tag == "table":
                self.table = None        # built once its width is known
                self.rows_buf = []
            elif tag == "tr":
                self.row = []
            elif tag in ("td", "th"):
                self.pending_cell = []

        def handle_endtag(self, tag):
            if self.skip_tag:
                if tag == self.skip_tag:
                    self.skip_depth -= 1
                    if self.skip_depth <= 0:
                        self.skip_tag = None
                return
            if tag in ("td", "th"):
                if self.row is not None and self.pending_cell is not None:
                    self.row.append("".join(self.pending_cell).strip())
                self.pending_cell = None
            elif tag == "tr":
                if self.row:
                    self.rows_buf.append(self.row)
                self.row = None
            elif tag == "table":
                self._flush_table()
            elif tag in ("h1", "h2", "h3", "h4", "h5", "h6", "p", "li",
                         "blockquote", "pre") or tag in self.BLOCK:
                self.para = None
            while tag in self.stack:
                popped = self.stack.pop()
                if popped == tag:
                    break

        def _flush_table(self):
            rows = getattr(self, "rows_buf", [])
            self.rows_buf = []
            if not rows:
                return
            width = max(len(r) for r in rows)
            t = doc.add_table(rows=0, cols=width)
            try:
                t.style = "Table Grid"
            except KeyError:
                pass                     # a template without that style
            for r in rows:
                cells = t.add_row().cells
                for i in range(width):
                    cells[i].text = r[i] if i < len(r) else ""
            doc.add_paragraph()

        def _void(self, tag):
            """A tag with no end tag of its own."""
            if tag == "hr":
                # A REAL RULE, not "* * *".
                #
                # Cam asked for "some color titles and dividers" on the
                # Personal Effects printout, and that document goes to Word
                # as well as to the printer. Three asterisks where he asked
                # for a divider is a shrug. python-docx has no border API,
                # so the paragraph mark carries a bottom border written as
                # XML; every Word and LibreOffice draws it.
                #
                # Books export through this function too and gain the same
                # thing -- a chapter break that used to read as stray
                # punctuation is now a line.
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                try:
                    from docx.oxml import OxmlElement
                    from docx.oxml.ns import qn
                    borders = OxmlElement("w:pBdr")
                    bottom = OxmlElement("w:bottom")
                    bottom.set(qn("w:val"), "single")
                    bottom.set(qn("w:sz"), "8")       # eighths of a point
                    bottom.set(qn("w:space"), "1")
                    bottom.set(qn("w:color"), "5FA665")
                    borders.append(bottom)
                    p._p.get_or_add_pPr().append(borders)
                except Exception:
                    # Never lose the divider entirely because a version of
                    # python-docx moved something.
                    p.add_run("* * *")
                self.para = None
            elif tag == "br" and self.para is not None:
                self.para.add_run().add_break()
            elif tag == "img":
                # A picture cannot travel into a .docx from an <img> alone
                # -- the bytes are a data: URL or a file this converter does
                # not fetch. Named rather than dropped.
                self._write("[image]")

        def handle_data(self, data):
            if self.skip_tag:
                return
            if self._has("pre"):
                text = data
            else:
                # Collapse runs of whitespace, but KEEP one space at each
                # end if there was any. Without that, "The <b>plan</b>"
                # came out "Theplan": the space before the tag belongs to
                # this text node, and splitting on whitespace throws it
                # away. Caught by reading the converted document rather
                # than by trusting the code.
                collapsed = " ".join(data.split())
                if not collapsed:
                    # whitespace ONLY -- still a word gap, if we are
                    # mid-paragraph and not already sitting on a space
                    if self.para is not None and self.para.runs \
                            and not self.para.runs[-1].text.endswith(" "):
                        self._write(" ")
                    return
                text = ((" " if data[:1].isspace() else "")
                        + collapsed
                        + (" " if data[-1:].isspace() else ""))
                # never two spaces in a row across a tag boundary
                if text.startswith(" ") and self.para is not None \
                        and self.para.runs \
                        and self.para.runs[-1].text.endswith(" "):
                    text = text[1:]
            self._write(text)

    b = Build()
    b.feed(html)
    b.close()
    out = BytesIO()
    doc.save(out)
    return out.getvalue()


def notebooks_dir():
    """Where a Notes book lives. Beside boards/ and cells/, inside the
    vault's own folder, for the same reason those are: a book is part of
    the vault, and backing the vault up should back the books up too."""
    d = os.path.join(notes_dir(), "books")
    os.makedirs(d, exist_ok=True)
    return d


def _notebook_path(book_id):
    return _doc_path(notebooks_dir(), book_id)


def _now_stamp():
    return datetime.datetime.now().isoformat(timespec="seconds")


def notes_dir():
    return os.path.join(data_dir(), "notes")


# ---------------------------------------------------------------------------
# EVERYTHING INSIDE NEURONET.
#
# Cam: "migrate all the data so it lives within the NeuroNet directory, my
# goal is to fully replace camily and all other apps with this one, so it
# needs to be standalone."
#
# Three parts of the data came from other apps and were found by searching:
# the family library (calendar, contacts, family and recipe photos) in
# Camily's camily_data/, the recipes in cookery_data/ beside it, and Money in
# kincrux_money/. They now have fixed homes inside the data folder --
# family/, kitchen/, money/ -- and kitchen_backend is told so (ROOT_PROVIDER),
# so it never looks anywhere else.
#
# ADOPTING THE OLD FOLDERS, once. Each is COPIED in, checked file by file
# (the same names, the same sizes), and only then put in place; a copy that
# doesn't check out is thrown away and the next launch tries again. The other
# apps' folders are not touched -- Camily still has its own copy. The one
# exception is kincrux_money/ inside NeuroNet's own folder: that is
# NeuroNet's, and left there it would ship in every update zip, so the
# original is moved into adopted-originals/ in the data folder instead.
# A part that is already home (its marker file is there) is never adopted
# over, so this is safe on every launch.
# ---------------------------------------------------------------------------
ADOPT = (
    # (home inside data, the file that proves it's the real one, where the
    #  old apps kept it -- most likely first)
    ("family", "camily.json", lambda here, up, home: [
        os.path.join(here, "camily_data"), os.path.join(up, "camily_data"),
        os.path.join(up, "Camily", "camily_data"), os.path.join(home, "camily_data"),
        os.path.join(home, "Camily", "camily_data")]),
    ("kitchen", "cookery.json", lambda here, up, home: [
        os.path.join(d, n) for d in (here, up, os.path.join(up, "Camily"), home)
        for n in ("cookery_data", "kincrux_cookery")]),
    ("money", "cashbox.json", lambda here, up, home: [
        os.path.join(d, n) for d in (here, up, home) for n in ("kincrux_money", "cashbox_data")]),
)


# A part that couldn't be brought in this launch -> where it still is. Used
# for this session only, so a failed copy never shows Cam an empty calendar.
ADOPT_FAILED = {}


def _tree_listing(root):
    out = {}
    for d, _dirs, files in os.walk(root):
        for f in files:
            p = os.path.join(d, f)
            try:
                out[os.path.relpath(p, root)] = os.path.getsize(p)
            except OSError:
                pass
    return out


def adopt_outside_data(root=None, here=None, home=None):
    """Copy family, kitchen and money in from where the old apps kept them.
    Returns what was done, for the log and the tests."""
    root = root or data_dir()
    here = here or app_dir()
    home = home or os.path.expanduser("~")
    up = os.path.dirname(os.path.abspath(here))
    done = []
    for sub, marker, where in ADOPT:
        dest = os.path.join(root, sub)
        if os.path.isfile(os.path.join(dest, marker)):
            continue                                   # already home
        src = next((c for c in where(here, up, home)
                    if os.path.isfile(os.path.join(c, marker))
                    and not os.path.abspath(c).startswith(os.path.abspath(root) + os.sep)), None)
        if not src:
            continue
        tmp = dest + ".adopting"
        try:
            if os.path.exists(tmp):
                shutil.rmtree(tmp)
            shutil.copytree(src, tmp, symlinks=False)
            want, got = _tree_listing(src), _tree_listing(tmp)
            if want != got:
                raise OSError("the copy didn't match (%d files vs %d)" % (len(want), len(got)))
            if os.path.isdir(dest):
                # Made empty by a launch before this one (or holding a file
                # or two written since): what is there wins; the rest joins it.
                for rel in got:
                    to = os.path.join(dest, rel)
                    if not os.path.exists(to):
                        os.makedirs(os.path.dirname(to), exist_ok=True)
                        os.replace(os.path.join(tmp, rel), to)
                shutil.rmtree(tmp, ignore_errors=True)
            else:
                os.replace(tmp, dest)
        except OSError as exc:
            shutil.rmtree(tmp, ignore_errors=True)
            _log_line("could not bring %s in from %s (%s); using it where it is "
                      "for now, and trying again next launch" % (sub, src, exc))
            ADOPT_FAILED[sub] = src
            continue
        moved = ""
        if os.path.abspath(src).startswith(os.path.abspath(here) + os.sep):
            # NeuroNet's own old folder: moved out of the app folder so it
            # can't ship in an update or be mistaken for the live one.
            keep = os.path.join(root, "adopted-originals", os.path.basename(src))
            try:
                os.makedirs(os.path.dirname(keep), exist_ok=True)
                if not os.path.exists(keep):
                    os.replace(src, keep)
                    moved = keep
            except OSError:
                pass
        _log_line("brought %s into NeuroNet: %s -> %s (%d files)%s"
                  % (sub, src, dest, len(want), "; original kept in " + moved if moved else ""))
        done.append({"part": sub, "from": src, "to": dest, "files": len(want), "original": moved})
    if done:
        try:
            log = os.path.join(root, "adopted.json")
            prior = read_json(log, []) if os.path.isfile(log) else []
            atomic_write_json(log, (prior if isinstance(prior, list) else []) + [
                dict(d, when=datetime.datetime.now().isoformat(timespec="seconds")) for d in done])
        except Exception:
            pass
    return done


def adopt_at_startup():
    """Run by main(), before the window opens -- never merely by importing
    this file, so a test or a tool that loads it can't move real data.
    Only for the real library, inside this app's own folder: a data folder
    somewhere else (a library_path.txt choice) is left to itself."""
    try:
        here = os.path.abspath(app_dir())
        if os.path.abspath(data_dir()).startswith(here + os.sep):
            return adopt_outside_data()
    except Exception as exc:              # never stop the app starting
        _log_line("adopting outside data failed: %s" % exc)
    return []


def starter_files_dir():
    """Where neuronet-update keeps the starter's pictures and files."""
    state = os.environ.get("XDG_STATE_HOME") or os.path.expanduser("~/.local/state")
    return os.path.join(state, "neuronet", "starter-files")


def apply_starter():
    """The recipes, Training items and decks this release brings (see
    starter_data.py), merged once per change, before the window opens. Not on
    a brand-new computer until its welcome is done: the welcome looks for an
    empty data folder, and may bring this person's own data over first."""
    try:
        if welcome_wanted() or _missing_data:
            return None
        import starter_data
        docs = {"kitchen": kitchen_backend.cookery_file() if kitchen_backend else None,
                "training": training_file(), "cards": cards_file(), "photos": data_file(),
                "media": os.path.join(data_dir(), "personal_effects.json")}
        if not docs["kitchen"]:
            return None
        rep = starter_data.apply(os.path.join(os.path.dirname(os.path.abspath(__file__)), "system", "starter", "starter.json"),
                                 starter_files_dir(), data_dir(), docs,
                                 state_home=os.environ.get("XDG_STATE_HOME") or os.path.expanduser("~/.local/state"))
        if rep and "skipped" not in rep:
            _log_line("starter data merged: %s" % json.dumps(rep))
        return rep
    except Exception as exc:              # never stop the app starting
        _log_line("starter data failed: %s" % exc)
        return None


def kitchen_root():
    """NeuroNet's data folder, for kitchen_backend."""
    return data_dir()


# Kitchen, Home and Money came from KinCrux with the merge. Optional, like
# Notes: a build without the file loses those sections and nothing else.
try:
    import kitchen_backend               # noqa: E402
    kitchen_backend.ROOT_PROVIDER = kitchen_root
    kitchen_backend.FALLBACK = ADOPT_FAILED
except ImportError:
    kitchen_backend = None

import journal                          # noqa: E402
journal.DATA_DIR_PROVIDER = lambda: data_dir()
import pet                              # noqa: E402
pet.DATA_DIR_PROVIDER = lambda: data_dir()
import collab                           # noqa: E402  Scribe > Collaboration (2026-10-15)
collab.DATA_DIR_PROVIDER = lambda: data_dir()

try:
    import notes_backend                # noqa: E402
    notes_backend.DATA_DIR_PROVIDER = notes_dir
    _notes = notes_backend.NotesApi()
except ImportError:
    notes_backend = None
    _notes = None


# The media-bus bridge (mpris.py), set up by main().
_mpris = None


# ---------------------------------------------------------- quick access --
#
# Cam: "a plugin that can load my tools in Neuronet and make them appear as a
# popup that i can do some quick work or viewing, rather then having to open
# the whole app all the time ... my computer usage is all centred around
# Neuronet".
#
# NeuroNet itself is the popup: `neuronet-quick notes` (the script beside
# this file; SUPER+ALT+N, the bar launcher) tucks the window into a Hyprland
# scratchpad, floats it over whatever Cam is doing, and asks the page -- over
# org.neuronet.App, see mpris.py -- to open Notes in its compact look.
# ONE NeuroNet, so nothing is ever loaded twice and saves can't race.

def quick_script():
    # Beside this file, wherever NeuroNet was started from.
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "neuronet-quick")


class ShownWindow:
    """The window shown and hidden by the app itself, for a desktop without
    Hyprland's scratchpads -- KDE (Cam, 2026-10-14: "is it possible to have a
    KDE desktop environment and still have the app run in the background and
    brought up with the shortcuts"). Hidden is really hidden: unmapped, out of
    the taskbar, still running. The desktop's own script (neuronet-quick,
    neuropets, neurofarm) asks over the session bus -- Show <mode>, Hide,
    State -- and brings it to the front (neuronet-raise). On Hyprland none of
    this is used: the scratchpad does it.

    mode: "window" (as it is), "popup" (about three quarters of the screen,
    like the Hyprland popup), "full" (maximised); state() is one of those or
    "hidden". Never raises."""

    POPUP = (0.72, 0.82)

    def __init__(self, window, hidden=False):
        self.window = window
        self.mode = "hidden" if hidden else "window"

    def _popup_size(self):
        try:
            import webview
            s = webview.screens[0]
            return int(s.width * self.POPUP[0]), int(s.height * self.POPUP[1])
        except Exception:
            return 1400, 900

    def show(self, mode="window"):
        mode = mode if mode in ("window", "popup", "full") else "window"
        w = self.window
        for step in (w.show, w.restore):
            try:
                step()
            except Exception:
                pass
        try:
            if mode == "popup":
                w.resize(*self._popup_size())
            elif mode == "full":
                w.maximize()
        except Exception:
            pass
        self.mode = mode

    def hide(self):
        try:
            self.window.hide()
        except Exception:
            pass
        self.mode = "hidden"

    def state(self):
        return self.mode


def page_rest():
    """seen(bool) for quick_watch: NeuroNet's page marked hidden while its
    window is out of sight on Hyprland, shown again when it's back (the
    performance audit, 3 Nov 2026). Then Chromium itself rests the page --
    document.hidden, no animation frames, CSS animations still, timers slowed
    -- and every "if (document.hidden)" in the page finally works. Sound keeps
    playing (an audible page isn't slowed). The signal object is made here, on
    the main thread, so the watcher's thread hands it over and Qt does the
    work on its own thread. NEURONET_NO_REST=1 turns it off. None without Qt."""
    if os.environ.get("NEURONET_NO_REST"):
        return None
    try:
        from PyQt6.QtCore import QObject, pyqtSignal
        from webview.platforms import qt as wq
    except Exception:
        return None

    class Rest(QObject):
        seen = pyqtSignal(bool)

        def apply(self, on):
            for view in list(getattr(wq.BrowserView, "instances", {}).values()):
                try:
                    page = view.webview.page()
                    if page.isVisible() != on:
                        page.setVisible(on)
                except Exception:
                    continue

    rest = Rest()
    rest.seen.connect(rest.apply)
    page_rest.keep = rest                       # (kept alive)
    return rest.seen.emit


def _run_quick(action):
    try:
        subprocess.Popen([quick_script(), action], start_new_session=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"ok": True}
    except OSError as e:
        return {"error": str(e)}


def already_running():
    """True when another NeuroNet already owns org.neuronet.App -- opening
    the app again then brings THAT one forward rather than starting a
    second copy on the same data. NEURONET_ALLOW_SECOND=1 skips it (tests)."""
    if os.environ.get("NEURONET_ALLOW_SECOND"):
        return False
    try:
        import gi
        gi.require_version("Gio", "2.0")
        from gi.repository import Gio, GLib
        bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        r = bus.call_sync("org.freedesktop.DBus", "/org/freedesktop/DBus",
                          "org.freedesktop.DBus", "NameHasOwner",
                          GLib.Variant("(s)", ("org.neuronet.App",)),
                          GLib.VariantType("(b)"), 0, 2000, None)
        return bool(r.unpack()[0])
    except Exception:
        return False


# -- the Api, by section ----------------------------------------------------
# The Api's ~250 calls used to be one 3,500-line class here. Since 2026-10-06
# (the audit: "split the Python backend by section") each section's calls are
# in api/<section>.py, as a class of their own, run in THIS file's namespace
# -- not imported -- so they use this file's helpers by the same names, with
# the same live values, and nothing about them changed but where they're
# written. The page sees one Api, as before (pywebview reads inherited calls).
API_PARTS = [("photos", "PhotosApi"), ("creative", "CreativeApi"), ("effects", "EffectsApi"), ("system", "SystemApi"), ("media", "MediaApi"), ("kitchen", "KitchenApi"), ("desktop", "DesktopApi"), ("training", "TrainingApi"), ("mind", "MindApi"), ("music", "MusicApi"), ("printing", "PrintingApi"), ("collab", "CollabApi")]


def load_api_parts():
    here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "api")
    g = globals()
    for name, _ in API_PARTS:
        path = os.path.join(here, name + ".py")
        with open(path, encoding="utf-8") as f:
            exec(compile(f.read(), path, "exec"), g)   # noqa: S102 -- our own file, see above
    return tuple(g[cls] for _, cls in API_PARTS)


class Api(*load_api_parts()):
    """Everything the interface can call.

    The method names are the contract, and they are namespaced on
    purpose -- see the note at the top of this file about save_data.
    """

    def __init__(self):
        self._window = None

    def ping(self):
        return "ok"





def fatal(msg):
    sys.stderr.write(msg + "\n")
    sys.exit(1)


def _is_own_page(url):
    """True for NeuroNet's own interface: the local file, or pywebview's
    loopback server. Anything else is a page from somewhere else."""
    try:
        scheme = url.scheme()
        host = url.host()
    except Exception:
        return False
    return scheme in ("file", "qrc") or (
        scheme in ("http", "https") and host in ("127.0.0.1", "localhost", "::1"))


def fix_qt_permissions():
    """Stop the qt renderer aborting the whole app on a permission request.

    Crash, 2026-09-26 (and eight times on 2026-08-28): NeuroNet vanished
    with SIGABRT, and the journal held the reason --

        webview/platforms/qt.py, in onFeaturePermissionRequested
          self.setFeaturePermission(url, feature, 2)
        TypeError: ... argument 3 has unexpected type 'int'

    pywebview 6.2.1 answers Chromium's permission requests with bare ints.
    PyQt6 6.11 only accepts a real QWebEnginePage.PermissionPolicy, so the
    handler raises -- and PyQt turns an exception inside a Qt callback into
    qFatal(), which aborts the process. Any page asking for any permission
    closed the app. The Copy buttons in Fleeting and Training ask for the
    clipboard, so pressing Copy was enough.

    The handler is replaced here, in NeuroNet, rather than patched inside
    site-packages, where the next `pip install -U pywebview` would silently
    undo it. It is looked up on the class when each page is built, so
    replacing it before webview.start() is enough.

    Same decisions as pywebview's, plus one: the clipboard is allowed for
    NeuroNet's own pages. Denying it is why Copy only ever fell back to
    "select and copy" -- the buttons were written to copy. A page from
    anywhere else still gets nothing but the camera and microphone.

    Any failure here leaves pywebview's own handler in place: better the
    old bug than the app not starting at all.
    """
    try:
        from webview.platforms import qt as wq
    except Exception:
        return
    page_cls = getattr(getattr(wq, "BrowserView", None), "WebPage", None)
    QWebPage = getattr(wq, "QWebPage", None)
    if page_cls is None or QWebPage is None or not getattr(wq, "is_webengine", False):
        return
    try:
        Feature = QWebPage.Feature
        Policy = QWebPage.PermissionPolicy
        granted_anywhere = {Feature.MediaAudioCapture, Feature.MediaVideoCapture,
                            Feature.MediaAudioVideoCapture}
        granted_own = set(granted_anywhere)
        if hasattr(Feature, "ClipboardReadWrite"):
            granted_own.add(Feature.ClipboardReadWrite)
        grant, deny = Policy.PermissionGrantedByUser, Policy.PermissionDeniedByUser
    except Exception:
        return

    def onFeaturePermissionRequested(self, url, feature):
        # Nothing may escape this function: an exception here is what
        # killed the app. A request that cannot be answered is dropped.
        try:
            allowed = granted_own if _is_own_page(url) else granted_anywhere
            self.setFeaturePermission(url, feature, grant if feature in allowed else deny)
        except Exception as e:
            sys.stderr.write(f"NeuroNet: permission request not answered: {e}\n")

    page_cls.onFeaturePermissionRequested = onFeaturePermissionRequested


def allow_qt_autoplay():
    """Let NeuroNet's own player start sound without a click in the page.

    Cam, after the desktop board's Random album: "now it even shows up in
    the player on the wallpaper but produces no sound". Chromium -- which
    the qt renderer is -- only lets audio start after a click INSIDE the
    page ("PlaybackRequiresUserGesture", on by default). A play asked for
    from outside -- the desktop board, the bar's music widget, the media
    keys, all through org.neuronet.App / MPRIS and evaluate_js -- loaded
    the album and then was refused at audio.play(): the player showed the
    track, Paused, silent. NeuroNet is a desktop app, not a website, so its
    pages are allowed to play.

    Done like fix_qt_permissions: pywebview's page class is wrapped here, in
    NeuroNet, so a pywebview update can't quietly undo it, and any failure
    leaves pywebview as it was. test_qt_permissions.py guards it.
    """
    try:
        from webview.platforms import qt as wq
        from PyQt6.QtWebEngineCore import QWebEngineSettings
    except Exception:
        return False
    page_cls = getattr(getattr(wq, "BrowserView", None), "WebPage", None)
    if page_cls is None or getattr(page_cls.__init__, "_nn_autoplay", False):
        return page_cls is not None
    original = page_cls.__init__

    def __init__(self, *args, **kwargs):
        original(self, *args, **kwargs)
        try:
            self.settings().setAttribute(
                QWebEngineSettings.WebAttribute.PlaybackRequiresUserGesture, False)
        except Exception as e:
            sys.stderr.write(f"NeuroNet: couldn't allow playback: {e}\n")

    __init__._nn_autoplay = True
    page_cls.__init__ = __init__
    return True


def allow_qt_fullscreen():
    """Let a page element (Cinema's player) go full screen.

    Cam (14 Nov 2026): "a seamless way to enter full screen mode". Chromium
    asks the page's host with fullScreenRequested and, unanswered, the
    request is simply refused. Answered here: accepted, and the window itself
    goes full screen (and back, on Escape or the player's button). Done like
    allow_qt_autoplay: pywebview's page class is wrapped here, and any failure
    leaves pywebview as it was."""
    try:
        from webview.platforms import qt as wq
        from PyQt6.QtWebEngineCore import QWebEngineSettings
        from PyQt6.QtWebEngineWidgets import QWebEngineView
    except Exception:
        return False
    page_cls = getattr(getattr(wq, "BrowserView", None), "WebPage", None)
    if page_cls is None or getattr(page_cls.__init__, "_nn_fullscreen", False):
        return page_cls is not None
    original = page_cls.__init__

    def __init__(self, *args, **kwargs):
        original(self, *args, **kwargs)
        try:
            self.settings().setAttribute(QWebEngineSettings.WebAttribute.FullScreenSupportEnabled, True)

            def on_request(request, page=self):
                request.accept()
                view = QWebEngineView.forPage(page)
                win = view.window() if view is not None else None
                if win is None:
                    return
                if request.toggleOn():
                    win.showFullScreen()
                else:
                    win.showNormal()
            self.fullScreenRequested.connect(on_request)
        except Exception as e:
            sys.stderr.write(f"NeuroNet: couldn't allow full screen: {e}\n")

    __init__._nn_fullscreen = True
    page_cls.__init__ = __init__
    return True


def navigation_verdict(url, main_frame, link_clicked, ui_root, app_origin=None):
    """Where NeuroNet's window may go -- "allow", "external" (a web link:
    the computer's browser opens it) or "deny".

    SECURITY (Cam, 2026-10-02: "take the perspective of a senior cyber
    security expert to ensure there is no chance for remote code execution
    within the application"). NeuroNet's page holds the bridge to Python
    (window.pywebview.api), and that bridge can run commands -- Code -> IDE's
    runner exists to. pywebview hands the bridge to WHATEVER page the window
    has loaded, a web site included. So the window itself must only ever show
    NeuroNet's own files:
      * the main frame: NeuroNet's own pages, nothing else -- pywebview
        serves ui/ from its own server on 127.0.0.1 (app_origin, e.g.
        http://127.0.0.1:41231; found on the real app, 2026-10-02), or
        file:// inside ui/. Any other port (the media server, another
        program's) is not NeuroNet's page. A clicked http(s)/mailto link opens in the browser instead; a
        script trying to go anywhere (a redirect, data:, javascript:, another
        folder) is refused.
      * frames inside the page (the reader, the web playground's preview):
        about:, data:, blob: and NeuroNet's own files -- never the web, so a
        link in a previewed page can't fetch anything either.
    """
    from urllib.parse import urlsplit, unquote
    u = str(url or "")
    try:
        parts = urlsplit(u)
    except ValueError:
        return "deny"
    scheme = parts.scheme.lower()

    def ours():
        if app_origin and scheme in ("http", "https"):
            return "%s://%s" % (scheme, parts.netloc.lower()) == str(app_origin).rstrip("/").lower()
        if scheme != "file" or parts.netloc not in ("", "localhost"):
            return False
        path = os.path.realpath(unquote(parts.path))
        root = os.path.realpath(ui_root)
        return path == root or path.startswith(root + os.sep)

    if main_frame:
        if ours():
            return "allow"
        if scheme in ("http", "https", "mailto") and link_clicked:
            return "external"
        return "deny"
    if scheme in ("about", "data", "blob") or ours():
        return "allow"
    return "deny"


def lock_qt_navigation(ui_root):
    """Fit navigation_verdict to pywebview's Qt page (it has no check of its
    own). Done like fix_qt_permissions: wrapped here, so a pywebview update
    can't quietly undo it. test_security.py guards it."""
    try:
        from webview.platforms import qt as wq
        from PyQt6.QtWebEngineCore import QWebEnginePage
        import webview
    except Exception:
        return False
    page_cls = getattr(getattr(wq, "BrowserView", None), "WebPage", None)
    if page_cls is None:
        return False
    if getattr(page_cls, "_nn_nav_lock", False):
        return True
    try:
        # target=_blank / window.open: the browser, never a new NeuroNet window
        webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True
    except Exception:
        pass
    clicked = QWebEnginePage.NavigationType.NavigationTypeLinkClicked
    from urllib.parse import urlsplit

    def app_origin_of(page):
        """The address pywebview opened this window on (its own server)."""
        for view in list(getattr(wq.BrowserView, "instances", {}).values()):
            try:
                if view.webview.page() is page:
                    u = urlsplit(str(view.pywebview_window.real_url or ""))
                    return "%s://%s" % (u.scheme, u.netloc) if u.scheme in ("http", "https") else None
            except Exception:
                continue
        return None

    def acceptNavigationRequest(self, url, nav_type, is_main_frame):
        verdict = navigation_verdict(url.toString(), is_main_frame, nav_type == clicked, ui_root,
                                     app_origin_of(self))
        if verdict == "external":
            try:
                import webbrowser
                webbrowser.open(url.toString())
            except Exception:
                pass
            return False
        if verdict == "deny":
            sys.stderr.write("NeuroNet: refused to go to %s\n" % url.toString()[:200])
        return verdict == "allow"

    page_cls.acceptNavigationRequest = acceptNavigationRequest
    page_cls._nn_nav_lock = True

    # New windows (target=_blank, window.open) go to pywebview's
    # NavigationHandler, which hands ANY address to the system opener -- a
    # file:///…/x.desktop there could start a program. Only web and mail
    # links leave NeuroNet; anything else is refused.
    handler = getattr(wq.BrowserView, "NavigationHandler", None)
    if handler is not None:
        def handler_accept(self, url, nav_type, is_main_frame):
            u = url.toString()
            if u.split(":", 1)[0].lower() in ("http", "https", "mailto"):
                try:
                    import webbrowser
                    webbrowser.open(u)
                except Exception:
                    pass
            else:
                sys.stderr.write("NeuroNet: refused to open %s\n" % u[:200])
            return False
        handler.acceptNavigationRequest = handler_accept

    # pywebview's server also answers POST /js_api/<uid> -- a second door to
    # the bridge, over HTTP, open to any origin (CORS *) and named by a uuid1,
    # which isn't a secret. Nothing registers behind it for the Qt window
    # today; NeuroNet makes sure nothing ever can: its table of callbacks is
    # always empty. (A web site in Cam's browser posting to 127.0.0.1 gets
    # nothing.)
    try:
        from webview import http as wh

        class _Sealed(dict):
            def __setitem__(self, k, v):
                pass

            def update(self, *a, **k):
                pass

            def setdefault(self, k, d=None):
                return d

            def __contains__(self, k):
                return False

        srv = getattr(wh, "BottleServer", None)
        if srv is not None and not getattr(srv.__init__, "_nn_sealed", False):
            original = srv.__init__

            def __init__(self, *a, **k):
                original(self, *a, **k)
                self.js_callback = _Sealed()
            __init__._nn_sealed = True
            srv.__init__ = __init__
            wh._NNSealed = _Sealed
    except Exception as e:
        sys.stderr.write("NeuroNet: couldn't seal pywebview's HTTP bridge: %s\n" % e)
    return True


NVIDIA, INTEL, AMD = "0x10de", "0x8086", "0x1002"


def prefer_integrated_gpu(environ=None, sysfs="/sys/class/drm",
                          mesa="/usr/share/glvnd/egl_vendor.d/50_mesa.json",
                          icd_dir="/usr/share/vulkan/icd.d", dri_dir="/usr/lib/dri"):
    """On a laptop with an NVIDIA card AND a built-in Intel/AMD GPU, draw
    NeuroNet on the built-in one. Returns what it set ({} when nothing).

    Health check, 2026-09-30: NeuroNet was drawing on the NVIDIA card --
    glvnd tries NVIDIA's EGL first -- with 19 handles open on it, so the
    card worked all day for a window that is mostly hidden, and a card in
    use can't sleep. The built-in GPU draws a page like this with a
    fraction of the power. Three routes led to the card, and each is closed:
    EGL (Mesa's instead), Vulkan (only the other drivers), and video
    decoding (VA-API: the built-in GPU's driver if it's installed --
    intel-media-driver -- otherwise none, so video decodes on the CPU
    rather than wake the card). Measured: 19 handles on the card -> 0.

    ONLY on those laptops. A computer with just an NVIDIA card (the first
    NeuroNet ISO machine) is left alone: without it there'd be no GPU at all.
    NEURONET_GPU=nvidia keeps NeuroNet on the NVIDIA card anyway, and
    anything already set by hand is never overridden."""
    environ = os.environ if environ is None else environ
    if environ.get("NEURONET_GPU", "").lower() == "nvidia":
        return {}
    vendors = set()
    try:
        for name in os.listdir(sysfs):
            if re.fullmatch(r"card\d+", name):
                try:
                    with open(os.path.join(sysfs, name, "device", "vendor")) as f:
                        vendors.add(f.read().strip().lower())
                except OSError:
                    pass
    except OSError:
        return {}
    if NVIDIA not in vendors or not (vendors & {INTEL, AMD}) or not os.path.isfile(mesa):
        return {}
    wanted = {"__EGL_VENDOR_LIBRARY_FILENAMES": mesa,   # Mesa's EGL: the built-in GPU
              "__GLX_VENDOR_LIBRARY_NAME": "mesa"}
    try:
        icds = sorted(os.path.join(icd_dir, n) for n in os.listdir(icd_dir)
                      if n.endswith(".json") and "nvidia" not in n.lower())
    except OSError:
        icds = []
    if icds:
        wanted["VK_DRIVER_FILES"] = ":".join(icds)
    va = ("iHD" if INTEL in vendors and os.path.isfile(os.path.join(dri_dir, "iHD_drv_video.so"))
          else "radeonsi" if AMD in vendors and os.path.isfile(os.path.join(dri_dir, "radeonsi_drv_video.so"))
          else "none")          # no driver of the built-in GPU's: no hardware decoding
    wanted["LIBVA_DRIVER_NAME"] = va
    # Omarchy's NVIDIA set-up (default/hypr/nvidia.lua) sets these two to
    # "nvidia" for the whole desktop whenever there's an NVIDIA card, two
    # GPUs or not -- that's what still woke the card (7 handles). On a
    # two-GPU laptop that value is the blanket default, not a choice, so it's
    # replaced; any other value is someone's choice and is kept.
    omarchy_default = {"LIBVA_DRIVER_NAME", "__GLX_VENDOR_LIBRARY_NAME"}
    set_now = {}
    for k, v in wanted.items():
        if k not in environ or (k in omarchy_default and environ[k].lower() == "nvidia"):
            environ[k] = set_now[k] = v
    return set_now


def _code_ide_call(name):
    def call(self, *args):
        return getattr(self._code(), name)(*args)
    call.__name__ = "code_" + name
    call.__doc__ = "Code -> IDE: code_ide.Api.%s (Algorithm)." % name
    return call


for _name in CODE_IDE_CALLS:
    setattr(Api, "code_" + _name, _code_ide_call(_name))
del _name


# Code -> Guides, Data Structures and Research: code_library.py, answered as
# code_lib_<name> on the same data folder as the IDE.
def _code_lib_call(name):
    def call(self, *args):
        import code_library
        self._code()                  # sets code_ide.ROOT (the data folder can move)
        return getattr(code_library.Api(), name)(*args)
    call.__name__ = "code_lib_" + name
    call.__doc__ = "Code library: code_library.Api.%s." % name
    return call


# code_library.CALLS, named here so nothing of Code is imported until it's
# used (test_code_library.py checks the two lists agree).
CODE_LIB_CALLS = ("list", "read", "save", "remove", "unhide", "run",
                  "studies", "study", "study_create", "study_save", "study_delete",
                  "study_tree", "study_file", "study_markdown", "choose_folder", "export_study")


for _name in CODE_LIB_CALLS:
    setattr(Api, "code_lib_" + _name, _code_lib_call(_name))
del _name


def main():
    # On a laptop with two GPUs, the built-in one (before Qt loads any GL).
    gpu = prefer_integrated_gpu()
    if gpu:
        sys.stderr.write("NeuroNet: drawing on the built-in GPU, not the NVIDIA card "
                         "(NEURONET_GPU=nvidia to change)\n")

    # Already open? Bring that one forward instead (see quick access).
    if already_running():
        _run_quick("show")
        sys.stderr.write("NeuroNet is already open; bringing it forward.\n")
        return

    try:
        import webview
    except ImportError:
        fatal("NeuroNet needs pywebview.\n\n    pip install pywebview\n")

    index = os.path.join(ui_dir(), "index.html")
    if not os.path.isfile(index):
        fatal(f"NeuroNet can't find its interface. Expected:\n  {index}")

    # Family, Kitchen and Money into the data folder, once (see ADOPT).
    adopt_at_startup()
    # What this release brings: recipes, Training, a deck of each kind.
    apply_starter()

    api = Api()
    # --hidden: started out of sight (neuronet-quick start, at login) on a
    # desktop without Hyprland's scratchpad -- there a window rule hides it
    hidden = "--hidden" in sys.argv[1:]
    window = webview.create_window(
        APP_NAME, index, js_api=api,
        width=1280, height=860, min_size=(900, 600), hidden=hidden)
    api._window = window
    shown = ShownWindow(window, hidden)
    # Notes keeps its own backend object, and its file dialogs (Import,
    # Import folder, Import PDF, attach image) open on THIS window. It was
    # never handed it, so each died on None.create_file_dialog and the
    # Vault's buttons did nothing. test_notes_vault.py guards it.
    if _notes is not None:
        _notes._window = window

    # --gui NAME picks the renderer. It used to be accepted and ignored:
    # main() never looked at its own command line, so Cam's launcher,
    # which has said `--gui qt` for a long time, was quietly running the
    # default GTK renderer (WebKitGTK) the whole time. He was tuning an
    # engine he was not using.
    #
    # Which renderer matters more than it sounds. WebKitGTK paired with
    # WEBKIT_DISABLE_DMABUF_RENDERER=1 -- the usual cure for a black
    # window on Linux -- draws every frame on the CPU, so scrolling a
    # long list is real work. The qt renderer is Chromium underneath and
    # does not need that workaround.
    #
    # An unknown or uninstalled renderer says so and names the ones that
    # are there, rather than failing with pywebview's own message about a
    # word the person never typed.
    gui = None
    argv = sys.argv[1:]
    for i, arg in enumerate(argv):
        if arg == "--gui" and i + 1 < len(argv):
            gui = argv[i + 1]
        elif arg.startswith("--gui="):
            gui = arg.split("=", 1)[1]
    # Say which renderer is actually in use, and whether the GPU is on.
    # Cam spent a long time tuning an engine he was not running, because
    # nothing ever told him which one it was. One line on stdout is
    # enough to never have that question again.
    chosen = gui or "default"
    note = ""
    # WebKit's switch only matters to the GTK renderer: under qt (Chromium, the
    # one NeuroNet runs) the note was a false alarm in every start.log
    if os.environ.get("WEBKIT_DISABLE_DMABUF_RENDERER") and gui != "qt":
        note = ("  [WEBKIT_DISABLE_DMABUF_RENDERER is set: WebKit draws every\n"
                "   frame on the CPU. It is the usual cure for a black window,\n"
                "   but it is also why long lists scroll heavily. If your\n"
                "   window is fine without it, it is worth dropping.]")
    sys.stderr.write(f"NeuroNet: renderer {chosen}\n" + (note + "\n" if note else ""))

    if gui == "qt":
        fix_qt_permissions()
        allow_qt_autoplay()
        allow_qt_fullscreen()
        lock_qt_navigation(ui_dir())
        # The window's Wayland app id. Unset, it was "python3" -- which
        # Hyprland rules and neuronet-quick can't tell from any other
        # Python window. "NeuroNet" also matches NeuroNet.desktop.
        # NEURONET_APP_ID: a test copy's window under another name, so this
        # desktop's rules and shortcuts leave it be (system/vm/cachyos-docker.sh
        # --show: under "NeuroNet" it went to the hidden NeuroNet workspace,
        # beside the real one).
        try:
            from PyQt6.QtGui import QGuiApplication
            QGuiApplication.setDesktopFileName(os.environ.get("NEURONET_APP_ID") or "NeuroNet")
        except Exception:
            pass

    # The same name whichever renderer draws the window. (2026-09-29, fix
    # notes from Manthies' computer: python-qtpy was missing, so pywebview
    # quietly fell back to GTK, which named the window after the program --
    # "neuronet.py" -- and neuronet-quick and the Hyprland window rule, both
    # looking for "NeuroNet", never found it: every shortcut said "didn't
    # open".) GTK takes the Wayland app id from the program name.
    try:
        from gi.repository import GLib
        GLib.set_prgname(os.environ.get("NEURONET_APP_ID") or "NeuroNet")
    except Exception:
        pass

    # On the Linux media bus as a music player: Omarchy's audio panel,
    # the media keys and the NeuroNet bar widget all see it (mpris.py).
    # Started here, not at import, so no test ever claims the bus name.
    global _mpris
    try:
        import mpris

        def _raise_window():
            try:
                window.restore()
                window.show()
            except Exception:
                pass
        def run_js(code):
            # pywebview keeps an entry for every evaluate_js call and never drops it (webview/window.py _callbacks);
            # NeuroNet's calls never have a callback, so after each one the unused entries go (the audit, 3 Nov 2026)
            try:
                return window.evaluate_js(code)
            finally:
                cbs = getattr(window, "_callbacks", None)
                if isinstance(cbs, dict):
                    for k in [k for k, v in list(cbs.items()) if v is None]:
                        cbs.pop(k, None)
        _mpris = mpris.Mpris(run_js, _raise_window, music_images_dir, shown=shown)
        if not _mpris.start():
            sys.stderr.write(f"NeuroNet: not on the media bus: {_mpris.error}\n")
            _mpris = None
    except Exception as e:
        sys.stderr.write(f"NeuroNet: not on the media bus: {e}\n")
        _mpris = None

    # (The desktop Bookshelf's list, bookshelf.py, rebuilt every 20 s, went with
    # the desktop widgets, 3 Nov 2026.)

    # NeuroNet's memory every five minutes, for Settings -> App stats (app_health.py)
    try:
        import app_health
        app_health.start()
    except Exception as e:
        sys.stderr.write(f"NeuroNet: not keeping an eye on its memory: {e}\n")

    # A window opened over the popup (Print's browser, say) gets the tool
    # tiled beside it instead of hiding with it (quick_watch.py).
    try:
        import quick_watch
        quick_watch.Watch(quick_script(), seen=page_rest() if gui == "qt" else None).start()
    except Exception as e:
        sys.stderr.write(f"NeuroNet: not watching for windows over the popup: {e}\n")

    try:
        webview.start(gui=gui) if gui else webview.start()
    except Exception as e:
        if gui:
            fatal(f"NeuroNet couldn't start with --gui {gui}.\n\n  {e}\n\n"
                  f"Leave --gui off to use the default renderer.\n"
                  f"For qt you need PyQt5 or PySide6 with QtWebEngine:\n\n"
                  f"    pip install 'pywebview[qt]'\n")
        raise
    finally:
        stop_code_runs()
        stop_media_server()


if __name__ == "__main__":
    main()
