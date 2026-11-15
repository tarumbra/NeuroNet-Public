"""crux.store — the one copy of how this project reads and writes data.

WHY THIS FILE EXISTS. Before KinCrux there were seven apps, each with
its own atomic_write_json, its own read_json, its own normaliser, and —
in one case — its own stale-write guard that the others lacked. Fixing a
bug in one fixed it in one. This is that code, moved rather than
re-derived, so there is one place to fix it.

Everything here is deliberately app-agnostic: no knowledge of photos,
recipes, exercises or notes. A module hands it a path and a shape.
"""

import json
import os
import tempfile

# Filesystem mtime granularity is coarser than you would like — some
# filesystems round to the nearest second, and a write that lands in the
# same tick as the read it is checked against would otherwise look like a
# conflict. Half a second is the tolerance Coach Cam arrived at in
# practice and it has held up.
STAMP_TOLERANCE = 0.5


def atomic_write_json(path, obj, prefix=".crux-"):
    """Write to a temp file in the same folder, then replace.

    A crash or a pulled power cable mid-write leaves the previous file
    intact rather than a half-written one. For most of these modules the
    file being written is the only copy of something Cam typed by hand,
    so a partial write is the worst possible outcome.

    The temp file is created in the SAME folder on purpose: os.replace is
    only atomic within one filesystem, and /tmp is frequently a different
    one.
    """
    folder = os.path.dirname(path) or "."
    os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=prefix, suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(obj, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


def atomic_write_text(path, text, suffix=".txt", prefix=".crux-"):
    """The same discipline for a text file — a note, an export."""
    folder = os.path.dirname(path) or "."
    os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=prefix, suffix=suffix)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


def read_json(path, fallback):
    """Never raises. A missing, unreadable or corrupt file degrades to the
    fallback, because a stack trace on launch is worse than an empty
    library — the app still opens and can say what went wrong."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError, ValueError):
        return fallback


def stamp_of(path):
    """When the file was last written, or 0.0 if it isn't there."""
    try:
        return os.path.getmtime(path)
    except OSError:
        return 0.0


def is_stale(path, expect_stamp, tolerance=STAMP_TOLERANCE):
    """Has the file moved on since the caller last saw it?

    THE BUG THIS PREVENTS. Two windows open on one file, both holding the
    whole document in memory. Whichever saves second silently erases the
    other's work, and nothing anywhere reports it. Passing the stamp you
    last saw turns that silence into a refusal.

    expect_stamp is allowed to be None so a caller that genuinely does
    not care — a first write, a single-window tool — keeps working
    unchanged rather than being forced to thread a stamp it has no use
    for.
    """
    if expect_stamp is None:
        return False
    try:
        expect = float(expect_stamp)
    except (TypeError, ValueError):
        return False
    return (stamp_of(path) - expect) > tolerance


def save_guarded(path, obj, expect_stamp=None, normalise=None,
                 what="this file"):
    """Write, unless something else wrote first.

    Returns {"ok": True, "stamp": …} or
            {"conflict": True, "stamp": …, "error": …}

    The conflict reply carries the CURRENT stamp so the caller can reload
    and retry without having to ask for it separately.
    """
    if is_stale(path, expect_stamp):
        return {
            "conflict": True,
            "stamp": stamp_of(path),
            "error": f"Something else saved {what} since this window "
                     "loaded it. Reload before saving, or your changes "
                     "would overwrite theirs.",
        }
    atomic_write_json(path, normalise(obj) if normalise else obj)
    return {"ok": True, "stamp": stamp_of(path)}


def save_merged(path, obj, owned_keys, normalise=None, expect_stamp=None,
                what="this file"):
    """Write only the keys this module owns, leaving everything else in
    the file untouched.

    WHY MERGE AT ALL when KinCrux is one app. Because a data folder can
    outlive the app that made it: an older standalone app may still be
    installed and writing keys this build has never heard of, and a blind
    overwrite would delete them silently. One extra read removes that
    whole class of surprise.

    NOTE the failure mode this does NOT solve: the read and the write are
    not atomic together, so it protects unknown KEYS, not concurrent
    edits to the same key. That is what expect_stamp is for — pass it.
    """
    if is_stale(path, expect_stamp):
        return {
            "conflict": True,
            "stamp": stamp_of(path),
            "error": f"Something else saved {what} since this window "
                     "loaded it.",
        }
    current = read_json(path, {})
    if not isinstance(current, dict):
        current = {}
    clean = normalise(obj) if normalise else (obj or {})
    for key in owned_keys:
        current[key] = clean.get(key)
    atomic_write_json(path, current)
    return {"ok": True, "stamp": stamp_of(path)}


# ------------------------------------------------------------- shapes ---
def as_list(value):
    return value if isinstance(value, list) else []


def as_dict(value):
    return value if isinstance(value, dict) else {}


def as_str(value, default=""):
    return value if isinstance(value, str) else default


def as_bool(value, default=False):
    return value if isinstance(value, bool) else default


def as_int(value, default=0, low=None, high=None):
    if not isinstance(value, int) or isinstance(value, bool):
        return default
    if low is not None and value < low:
        return default
    if high is not None and value > high:
        return default
    return value


def shape_records(items, fields):
    """Normalises a list of records in place against a field spec.

    `fields` maps a key to one of the as_* callables above, so a
    module's normaliser reads as a description of its own shape rather
    than forty lines of isinstance checks:

        shape_records(data["contacts"], {
            "name": as_str, "email": as_str, "favourite": as_bool})

    Anything in the list that is not a dict is dropped — a hand-edited
    or truncated file should degrade to something usable rather than
    crashing the app on launch.
    """
    out = []
    for item in as_list(items):
        if not isinstance(item, dict):
            continue
        for key, caster in fields.items():
            item[key] = caster(item.get(key))
        out.append(item)
    return out
