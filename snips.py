"""NeuroNet Snips (15 November 2026).

Cam: "implement a snip feature that lives within NeuroNet so i can stop using
the screen shot tool. Use the omarchy screenshot tool as the guide for all
functionality the only difference is the snips get stored in the in app photo
viewer in a folder called neuronet snips. Also saved to a new folder that
lives in Documents named "Neuronet Snips", where the snips are saved with
naming convention YYMMDD - Snip # ... the snip feature should have a save as
which will automatically have the naming convention above but also an extra
piece for example 261115 - Snip 22 - (Definition) ... when you complete using
the photo i want you to move the relevant snip to Archive which is a sub
folder that lives within the NeuroNet Snips directory."

This module is the one place that knows the folder and the names. The
capture itself is Omarchy's own tool (omasnap, see neuronet-snip); the app
files a copy in Photos; Claude reads the folder when Cam says "Snips in
folder" and archives what it has used (`neuronet-snip archive 22`).

THE NAME: "YYMMDD - Snip N.png", or "YYMMDD - Snip N - (Definition).png".
N counts up for ever, across days and the Archive, so "Snip 22" names one
picture. The date is the day it was taken and never changes on a rename.
"""
import datetime
import os
import re
import shutil
import subprocess

REFERENCES = "NeuroNet Picture References"   # Documents/<this>/ holds everything below (15 Nov 2026)
FOLDER = "NeuroNet Snips"
ART = "Art to Action"
MEDIA_ART = "Media Art"
BARCODES = "Barcodes"          # Art to Action/Barcodes: photos of barcodes, for Media -> Scan
ARCHIVE = "Archive"
LAST = ".last-snip"           # the highest number given out, so a deleted snip's number isn't reused
NAME_RE = re.compile(r"^(\d{6}) - Snip (\d+)(?: - \((.*)\))?\.png$")
DEF_MAX = 80


def documents_dir():
    """The Documents folder (XDG's, so a renamed or translated one is found)."""
    try:
        r = subprocess.run(["xdg-user-dir", "DOCUMENTS"], capture_output=True, text=True, timeout=3)
        d = r.stdout.strip()
        if r.returncode == 0 and d and d != os.path.expanduser("~") and os.path.isdir(d):
            return d
    except (OSError, subprocess.SubprocessError):
        pass
    return os.path.join(os.path.expanduser("~"), "Documents")


def references_dir(create=True):
    """~/Documents/NeuroNet Picture References (NEURONET_REFERENCES_DIR
    overrides it: tests). Cam, 15 Nov 2026: "i want the NeuroNet Snips
    Directory to be moved into a new Directory called NeuroNet Picture
    referrences. Inside that will be art to action inside that sub directory
    there will be Media Art"."""
    d = os.environ.get("NEURONET_REFERENCES_DIR") or os.path.join(documents_dir(), REFERENCES)
    if create:
        for sub in ((FOLDER, ARCHIVE), (ART, MEDIA_ART, ARCHIVE), (ART, BARCODES, ARCHIVE)):
            os.makedirs(os.path.join(d, *sub), exist_ok=True)
        _move_old_snips(d)
    return d


def _move_old_snips(refs):
    """The snips folder as it was first made (Documents/NeuroNet Snips) moves
    in here, once; anything already here with the same name is left alone."""
    if os.environ.get("NEURONET_REFERENCES_DIR"):
        return
    old = os.path.join(documents_dir(), FOLDER)
    new = os.path.join(refs, FOLDER)
    if not os.path.isdir(old) or os.path.realpath(old) == os.path.realpath(new):
        return
    for sub in ("", ARCHIVE):
        src = os.path.join(old, sub)
        if not os.path.isdir(src):
            continue
        for name in os.listdir(src):
            a, b = os.path.join(src, name), os.path.join(new, sub, name)
            if os.path.isfile(a) and not os.path.exists(b):
                os.replace(a, b)
            elif name == LAST and os.path.isfile(a):          # keep the higher count
                if _read_int(a) > _read_int(b):
                    os.replace(a, b)
    for sub in (ARCHIVE, ""):
        try:
            os.rmdir(os.path.join(old, sub))                     # only when empty
        except OSError:
            pass


def _read_int(path):
    try:
        with open(path, encoding="utf-8") as f:
            return int(f.read().strip() or 0)
    except (OSError, ValueError):
        return 0


def snips_dir(create=True):
    """Documents/NeuroNet Picture References/NeuroNet Snips
    (NEURONET_SNIPS_DIR overrides it: tests)."""
    if os.environ.get("NEURONET_SNIPS_DIR"):
        d = os.environ["NEURONET_SNIPS_DIR"]
        if create:
            os.makedirs(os.path.join(d, ARCHIVE), exist_ok=True)
        return d
    return os.path.join(references_dir(create), FOLDER)


def media_art_dir(create=True):
    """Documents/NeuroNet Picture References/Art to Action/Media Art: covers
    Cam photographs, for Claude to put onto Media (neuronet-media-art)."""
    return os.path.join(references_dir(create), ART, MEDIA_ART)


def barcodes_dir(create=True):
    """Documents/NeuroNet Picture References/Art to Action/Barcodes: photos
    of the barcodes on the back of cases; Media -> Scan reads them (the
    same waiting/archive as Media Art: media_art_waiting(d), media_art_archive(p, d))."""
    return os.path.join(references_dir(create), ART, BARCODES)


PICTURE_EXT = (".png", ".jpg", ".jpeg", ".webp", ".heic", ".gif", ".bmp")


def media_art_waiting(d=None):
    """The pictures in Media Art still to do (not its Archive), oldest first."""
    d = d or media_art_dir()
    out = []
    for name in os.listdir(d):
        p = os.path.join(d, name)
        if os.path.isfile(p) and name.lower().endswith(PICTURE_EXT) and not name.startswith("."):
            out.append(p)
    return sorted(out, key=lambda p: (os.path.getmtime(p), p))


def media_art_archive(path, d=None):
    """Done with: into Media Art/Archive (a name already there gets a number)."""
    d = d or media_art_dir()
    base, ext = os.path.splitext(os.path.basename(path))
    dest, k = os.path.join(d, ARCHIVE, base + ext), 2
    while os.path.exists(dest):
        dest, k = os.path.join(d, ARCHIVE, "%s (%d)%s" % (base, k, ext)), k + 1
    os.replace(path, dest)
    return dest


def clean_definition(text):
    """What goes in the brackets: one line, no slashes or brackets (they'd
    break the name), at most 80 characters. '' for nothing."""
    t = re.sub(r"[\x00-\x1f/\\()]+", " ", str(text or ""))
    t = re.sub(r"\s+", " ", t).strip().strip(".")
    return t[:DEF_MAX].strip()


def file_name(day, n, definition=""):
    """day: 'YYMMDD'. -> '261115 - Snip 22 - (For Q22).png'."""
    d = clean_definition(definition)
    return "%s - Snip %d%s.png" % (day, int(n), " - (%s)" % d if d else "")


def parse(name):
    """{'day', 'n', 'definition'} for a snip's file name, else None."""
    m = NAME_RE.match(os.path.basename(name))
    if not m:
        return None
    return {"day": m.group(1), "n": int(m.group(2)), "definition": m.group(3) or ""}


def _entries(d):
    out = []
    for where, folder in (("snips", d), ("archive", os.path.join(d, ARCHIVE))):
        try:
            names = os.listdir(folder)
        except OSError:
            continue
        for name in names:
            info = parse(name)
            if info:
                info.update({"name": name, "path": os.path.join(folder, name), "archived": where == "archive"})
                out.append(info)
    return out


def list_snips(include_archive=False, d=None):
    """Every snip, newest number first: [{n, day, definition, name, path, archived}]."""
    d = d or snips_dir()
    return sorted((e for e in _entries(d) if include_archive or not e["archived"]),
                  key=lambda e: -e["n"])


def find(n, d=None):
    """The snip numbered n, in the folder or the Archive, else None."""
    for e in _entries(d or snips_dir()):
        if e["n"] == int(n):
            return e
    return None


def _last(d):
    return _read_int(os.path.join(d, LAST))


def next_number(d=None):
    d = d or snips_dir()
    return max([_last(d)] + [e["n"] for e in _entries(d)]) + 1


def add(src, when=None, definition="", d=None):
    """Copy a capture in as the next snip. -> {n, name, path, day}."""
    d = d or snips_dir()
    if not os.path.isfile(src):
        raise FileNotFoundError(src)
    day = (when or datetime.datetime.now()).strftime("%y%m%d")
    n = next_number(d)
    name = file_name(day, n, definition)
    path = os.path.join(d, name)
    shutil.copyfile(src, path + ".part")
    os.replace(path + ".part", path)
    with open(os.path.join(d, LAST), "w", encoding="utf-8") as f:
        f.write(str(n))
    return {"n": n, "name": name, "path": path, "day": day}


def replace(n, src, d=None):
    """The same snip, a newer picture (Cam edited it in the capture's editor
    and saved): the file keeps its name. -> the entry, or None."""
    e = find(n, d)
    if not e or not os.path.isfile(src):
        return None
    shutil.copyfile(src, e["path"] + ".part")
    os.replace(e["path"] + ".part", e["path"])
    return e


def rename(n, definition, d=None):
    """Save as: the same day and number, a new definition ('' takes it off).
    -> the entry with its new name/path, or None when there's no such snip."""
    e = find(n, d)
    if not e:
        return None
    name = file_name(e["day"], e["n"], definition)
    path = os.path.join(os.path.dirname(e["path"]), name)
    if path != e["path"]:
        os.replace(e["path"], path)
    e.update({"name": name, "path": path, "definition": clean_definition(definition)})
    return e


def archive(n, d=None):
    """Into NeuroNet Snips/Archive (done with). -> the entry, or None."""
    d = d or snips_dir()
    e = find(n, d)
    if not e:
        return None
    if not e["archived"]:
        path = os.path.join(d, ARCHIVE, e["name"])
        os.replace(e["path"], path)
        e.update({"path": path, "archived": True})
    return e


def unarchive(n, d=None):
    d = d or snips_dir()
    e = find(n, d)
    if not e:
        return None
    if e["archived"]:
        path = os.path.join(d, e["name"])
        os.replace(e["path"], path)
        e.update({"path": path, "archived": False})
    return e
