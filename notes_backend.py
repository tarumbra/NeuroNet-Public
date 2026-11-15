#!/usr/bin/env python3
"""Notes — Amnesia's vault backend, moved into KinCrux.

MOVED, NOT REWRITTEN. Everything below is Amnesia's, down to the
comments. What changed:

  1. data_dir() finds the vault through crux_paths, so KinCrux opens
     Cam's EXISTING cortex_collab_data/ rather than starting an empty
     one beside itself.
  2. The window/boot section at the end is gone -- KinCrux owns the
     window now.
  3. class Api became class NotesApi, and kincrux.py exposes its
     methods under notes_* names. Amnesia's get_prefs, set_prefs and
     ping collide with KinCrux's own, which mean different files.

WHAT DELIBERATELY DID NOT CHANGE IS THE VAULT ITSELF. A note is still a
real .md file in a real folder. That is the whole point of this module,
and the acceptance test for this stage is that Obsidian can still open
the folder afterwards -- see test_notes_vault.py, which opens the vault
with nothing but the standard library and reads the notes back.

safe_vault_path in particular is carried over character for character.
It is the boundary between "a path the interface sent" and "a file this
app will overwrite or delete", and it earns that trust by checking
twice: every segment textually, then the fully resolved realpath. The
second check is what catches a symlink pointing out of the vault.
test_notes_contract.py runs 44 checks against it, and passes identically
against Amnesia and against this copy.
"""
import base64
import datetime
import json
import os
import sys as _sys
import re
import shutil
import sys
import tempfile
import time

IS_FROZEN = getattr(sys, "frozen", False)
IS_WINDOWS = sys.platform.startswith("win")


def fatal(message):
    """Report a startup failure Cam will actually see, then exit 1.
    Same shape as every other app in this project's own fatal()."""
    try:
        if sys.stderr is not None:
            print(message, file=sys.stderr)
    except (OSError, ValueError, AttributeError):
        pass
    if IS_WINDOWS and (sys.stderr is None or IS_FROZEN):
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(
                None, str(message), "Amnesia", 0x10)
        except Exception:                        # noqa: BLE001
            pass
    sys.exit(1)


# -- crux, for find_data_dir -------------------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.join(_HERE, "crux", "py") not in _sys.path:
    _sys.path.insert(0, os.path.join(_HERE, "crux", "py"))
import crux_paths                                            # noqa: E402


def app_dir():
    """Folder this script (or the frozen exe) lives in."""
    if IS_FROZEN:
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def ui_dir():
    base = getattr(sys, "_MEIPASS", app_dir())
    return os.path.join(base, "ui")


#: Set by neuronet.py at import: a function returning the notes folder.
#: Handed in rather than looked up, because importing neuronet from here
#: while it runs as __main__ would load a SECOND copy of the module, with
#: its own state -- two answers to "where is the data" in one process.
DATA_DIR_PROVIDER = None


def data_dir():
    """NeuroNet's own notes folder: neuronet_data/notes/.

    Cam: "lets add the notes application into NeuroNet as well. Do not
    remove it from KinCrux, as they will be used to store different
    variations of notes and store different PDF textbooks."

    A SEPARATE VAULT, ON PURPOSE. KinCrux's copy of this file SEARCHES --
    for cortex_collab_data first, which is standalone Amnesia's folder --
    because there the goal was the opposite: "two front ends over one
    vault, not two vaults that drift apart." Copied here unchanged, that
    search would open Amnesia's vault or KinCrux's, which is exactly what
    Cam does not want.

    So there is no search at all. The folder is fixed, beside training/
    and chords/ inside NeuroNet's data folder. And if the provider has not
    been set, this refuses rather than falling back to a search: a guess
    here would mean writing Cam's notes into someone else's vault.
    """
    if DATA_DIR_PROVIDER is None:
        raise RuntimeError(
            "NeuroNet's notes folder was not set. neuronet.py sets it at "
            "import; refusing to guess, since a guess could open another "
            "app's vault.")
    d = DATA_DIR_PROVIDER()
    os.makedirs(d, exist_ok=True)
    return d


def vault_dir():
    """The vault root — every note and folder Cam creates lives
    somewhere under here. Kept one level below data_dir() (rather than
    data_dir() itself) so ATTACHMENTS_DIRNAME can sit as a real,
    ordinary subfolder of the vault without it looking like a note
    folder — see list_tree's own comment for why that matters."""
    d = os.path.join(data_dir(), "vault")
    os.makedirs(d, exist_ok=True)
    return d


# ---- separate vaults (2026-10-12, Cam: "Another feature would be seperate vaults. Think like the seperate cash
#      books.") -- the MAIN vault stays exactly where it always was (vault_dir(): Fleeting notes, the desktop board,
#      shipping and transfers all keep writing there); the others live in notes/vaults/<id>/. vaults.json says which
#      are there, what they're called and which one the Notes window has open. Everything the Notes window does to
#      files goes through active_vault_dir().
VAULTS_FILE = "vaults.json"
_VAULT_ID = re.compile(r"^v[0-9]{1,6}$")


def read_vaults():
    try:
        with open(os.path.join(data_dir(), VAULTS_FILE), encoding="utf-8") as f:
            v = json.load(f)
    except (OSError, ValueError):
        v = {}
    if not isinstance(v, dict):
        v = {}
    vaults = [x for x in v.get("vaults", []) if isinstance(x, dict) and _VAULT_ID.match(str(x.get("id", "")))
              and isinstance(x.get("name"), str)]
    active = v.get("active") if any(x["id"] == v.get("active") for x in vaults) else "main"
    main = v.get("mainName") if isinstance(v.get("mainName"), str) and v.get("mainName").strip() else "Main vault"
    return {"active": active, "mainName": main, "vaults": vaults}


def write_vaults(v):
    atomic_write_text(os.path.join(data_dir(), VAULTS_FILE), json.dumps(v, indent=1) + "\n")


def other_vault_dir(vid):
    if not _VAULT_ID.match(vid or ""):
        raise ValueError("not a vault id")
    return os.path.join(data_dir(), "vaults", vid)


def active_vault_dir():
    """The vault the Notes window has open: the main one, or one of the others."""
    a = read_vaults()["active"]
    if a == "main":
        return vault_dir()
    d = other_vault_dir(a)
    os.makedirs(d, exist_ok=True)
    return d


def vault_root(vid):
    """Any vault's folder by its id (the main one, or one listed in vaults.json); None if there's no such vault."""
    if vid == "main":
        return vault_dir()
    if not any(x["id"] == vid for x in read_vaults()["vaults"]):
        return None
    d = other_vault_dir(vid)
    os.makedirs(d, exist_ok=True)
    return d


def move_to_vault_path(path, vid, dest_folder=""):
    """Move a note, PDF, canvas or folder out of the open vault into another one (2026-10-12, Cam: "the right click
    option where it says move folder to, to include other vaults as well ... save on copy and pasting notes"). The
    pictures its notes show (![[name]] and ![alt](name), from the vault's attachments) are COPIED across -- the open
    vault keeps its copy, since another note there may show it too; a picture whose name is taken by a different one
    over there is renamed, and the moved notes are rewritten to match. Returns (new path there, pictures copied)."""
    src_root = active_vault_dir()
    dst_root = vault_root(vid)
    if dst_root is None:
        raise ValueError("there's no vault like that")
    if os.path.realpath(dst_root) == os.path.realpath(src_root):
        raise ValueError("it's already in this vault")
    if not path or path.split("/")[0] == ATTACHMENTS_DIRNAME:
        raise ValueError("that can't be moved")
    real = safe_vault_path(path)
    if not real or not os.path.exists(real):
        raise ValueError("that item doesn't exist")
    parent = os.path.realpath(os.path.join(dst_root, dest_folder or ""))
    root_real = os.path.realpath(dst_root)
    if not (parent == root_real or parent.startswith(root_real + os.sep)) or not os.path.isdir(parent) \
            or (dest_folder or "").split("/")[0] == ATTACHMENTS_DIRNAME:
        raise ValueError("that folder isn't in the other vault")
    is_folder = os.path.isdir(real)
    notes = []
    if is_folder:
        for d, _dirs, files in os.walk(real):
            notes += [os.path.join(d, f) for f in files if f.lower().endswith(NOTE_EXT)]
    elif real.lower().endswith(NOTE_EXT):
        notes = [real]
    src_att = os.path.join(src_root, ATTACHMENTS_DIRNAME)
    dst_att = os.path.join(dst_root, ATTACHMENTS_DIRNAME)
    renames, copied = {}, 0
    for n in notes:
        try:
            with open(n, encoding="utf-8") as f:
                text = f.read()
        except (OSError, UnicodeDecodeError):
            continue
        for ref, _cand in _referenced_local_images(text, src_att):
            if ref in renames or "/" in ref or not _SAFE_IMAGE.match(ref):
                continue
            src_pic = os.path.join(src_att, ref)
            os.makedirs(dst_att, exist_ok=True)
            there = os.path.join(dst_att, ref)
            if os.path.exists(there):
                with open(src_pic, "rb") as a, open(there, "rb") as b:
                    if a.read() == b.read():
                        renames[ref] = ref
                        continue
                final = dedupe_name(dst_att, ref, is_folder=False)
            else:
                final = ref
            shutil.copy2(src_pic, os.path.join(dst_att, final))
            renames[ref] = final
            copied += 1
    final_name = dedupe_name(parent, os.path.basename(real), is_folder)
    dest = os.path.join(parent, final_name)
    shutil.move(real, dest)
    changed = {k: v for k, v in renames.items() if k != v}
    if changed:
        moved = [dest] if not is_folder else [os.path.join(d, f) for d, _x, fs in os.walk(dest) for f in fs if f.lower().endswith(NOTE_EXT)]
        for n in moved:
            with open(n, encoding="utf-8") as f:
                text = f.read()
            new = text
            for old, nw in changed.items():
                new = re.sub(r"(!\[\[)" + re.escape(old) + r"(\]\]|\|)", lambda m: m.group(1) + nw + m.group(2), new)
                new = re.sub(r"(!\[[^\]]*\]\()" + re.escape(old) + r"(\))", lambda m: m.group(1) + nw + m.group(2), new)
            if new != text:
                atomic_write_text(n, new)
    return os.path.relpath(dest, dst_root).replace(os.sep, "/"), copied


def clean_vault_name(name):
    name = _BAD_NAME_CHARS.sub("", str(name or "")).strip()[:60]
    return name


def prefs_file():
    """App-level preferences (View mode zoom level, sidebar-hidden
    state — see app.js's own prefsCache/setPref()) — deliberately
    living in data_dir() itself, NOT inside the vault: this isn't part
    of Cam's own note content, so it has no business traveling if the
    vault folder is ever copied or backed up on its own."""
    return os.path.join(data_dir(), "prefs.json")


def read_prefs():
    try:
        with open(prefs_file(), "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def write_prefs(prefs):
    """Same atomic mkstemp/fsync/os.replace discipline every write in
    this project follows."""
    folder = data_dir()
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=".prefs-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(prefs, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, prefs_file())
    except BaseException:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except OSError:
            pass
        raise


ATTACHMENTS_DIRNAME = "attachments"
NOTE_EXT = ".md"
PDF_EXT = ".pdf"
CANVAS_EXT = ".canvas"
_SAFE_IMAGE = re.compile(r"^[\w.\-]+\.(jpg|jpeg|png|gif|webp)$", re.IGNORECASE)
_SAFE_PDF = re.compile(r"^[\w.\- ]+\.pdf$", re.IGNORECASE)

# a real, minimal, VALID JSON Canvas file (the actual open format
# Obsidian's own Canvas feature uses — nodes[]/edges[] arrays,
# confirmed directly against the real spec and a real sample .canvas
# file, not invented) — a fresh canvas starts as this rather than a
# truly empty file, the same way a fresh note starts as "" rather
# than needing special-casing the moment it's first opened.
EMPTY_CANVAS_JSON = "{\"nodes\":[],\"edges\":[]}"

# Windows itself forbids these in a filename; also excludes the path
# separators outright rather than trying to sanitise around them.
_BAD_NAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def is_safe_name(name):
    """A single path SEGMENT (one folder or file name, never a full
    path) — no traversal, no separators, no reserved characters, never
    empty, never just dots. The one gate every create/rename call
    below goes through before touching disk at all."""
    if not name or name in (".", "..") or _BAD_NAME_CHARS.search(name):
        return False
    return True


def safe_vault_path(rel_path, must_exist=None):
    """rel_path (forward-slash separated, as the JS side always sends
    it, regardless of OS) -> an absolute path INSIDE the vault, or
    None if it tries anything at all clever. must_exist: None (don't
    care), "file", "dir" — checked AFTER resolving, so a symlink
    pointing back out of the vault is still caught by the realpath
    comparison below, not just the textual one.

    Defense in depth, not just a single check: every segment is
    validated with is_safe_name individually (catching a bare ".."
    segment even if it's buried in the middle of a longer path), AND
    the fully-resolved real path is confirmed to still sit inside the
    vault's own real path afterward — the second check is what
    actually stops a symlink-based escape a purely textual check
    would miss."""
    if rel_path is None:
        return None
    rel_path = str(rel_path).strip("/\\")
    if not rel_path:
        return active_vault_dir() if must_exist in (None, "dir") else None
    segments = re.split(r"[/\\]+", rel_path)
    if not all(is_safe_name(s) for s in segments):
        return None
    root = active_vault_dir()
    candidate = os.path.join(root, *segments)
    real_root = os.path.realpath(root)
    real_candidate = os.path.realpath(candidate)
    if real_candidate != real_root and not real_candidate.startswith(
            real_root + os.sep):
        return None
    if must_exist == "file" and not os.path.isfile(candidate):
        return None
    if must_exist == "dir" and not os.path.isdir(candidate):
        return None
    return candidate


def to_rel(abs_path):
    """The inverse of safe_vault_path — an absolute path back to the
    forward-slash, vault-relative form the JS side works with
    everywhere, regardless of OS (so a Windows build never leaks a
    backslash into a path Cam sees or a link that references it)."""
    rel = os.path.relpath(abs_path, active_vault_dir())
    return rel.replace(os.sep, "/") if rel != "." else ""


def dedupe_name(parent_dir, name, is_folder):
    """"Untitled.md" -> "Untitled 2.md", "Untitled 3.md"… until free —
    Obsidian's own real convention for a name collision, not an error.
    A folder dedupes the same way, just without an extension to
    preserve."""
    if is_folder:
        stem, ext = name, ""
    else:
        stem, ext = os.path.splitext(name)
    cand, n = name, 2
    while os.path.exists(os.path.join(parent_dir, cand)):
        cand = f"{stem} {n}{ext}"
        n += 1
    return cand


def atomic_write_text(path, text):
    """Same atomic mkstemp/fsync/os.replace discipline every write in
    this whole project follows — a note is exactly as irreplaceable as
    any other data here, arguably more so given this app's entire
    reason for existing."""
    folder = os.path.dirname(path)
    os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=".tmp-", suffix=".md")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except OSError:
            pass
        raise


def list_tree(root=None):
    """The vault's own folder/note/pdf/canvas structure, as JSON — the
    sidebar's own entire data source. ATTACHMENTS_DIRNAME is
    deliberately excluded at the vault ROOT ONLY (a folder Cam
    actually names "attachments" himself three levels deep is a real
    folder, not this one) — photos are not notes, and showing an
    "attachments" folder full of images beside real notes would be
    real, confusing noise for no benefit; Cam never browses it
    directly at all, only ever through the notes that embed something
    from it. PDFs and canvas files are the opposite of that: real,
    first-class items in the tree, exactly like notes — Cam: "PDF
    capability, this way i can use it to read PDF or even open it
    split view with a note beside it," which only works if a PDF can
    be opened, tabbed, and split the same way a note already is, not
    hidden away as an attachment. A canvas is the same real kind of
    thing — Cam: "have a look at obisidians webpage... I want an in
    depth system implemented into Cortex.\""""
    root = root or active_vault_dir()

    def walk(abs_dir, rel_dir):
        children = []
        try:
            entries = sorted(os.listdir(abs_dir))
        except OSError:
            return children
        for name in entries:
            if rel_dir == "" and name == ATTACHMENTS_DIRNAME:
                continue
            if name.startswith("."):
                continue
            full = os.path.join(abs_dir, name)
            rel = f"{rel_dir}/{name}" if rel_dir else name
            if os.path.isdir(full):
                children.append({"name": name, "type": "folder",
                                 "path": rel, "children": walk(full, rel)})
            elif name.lower().endswith(NOTE_EXT):
                children.append({"name": name[:-len(NOTE_EXT)],
                                 "type": "note", "path": rel})
            elif name.lower().endswith(PDF_EXT):
                children.append({"name": name[:-len(PDF_EXT)],
                                 "type": "pdf", "path": rel})
            elif name.lower().endswith(CANVAS_EXT):
                children.append({"name": name[:-len(CANVAS_EXT)],
                                 "type": "canvas", "path": rel})
        # folders first, then notes and pdfs together, each
        # alphabetical — the same ordering Obsidian's own default file
        # explorer uses
        children.sort(key=lambda c: (c["type"] != "folder",
                                     c["name"].lower()))
        return children

    return walk(root, "")


def read_note_file(path):
    real = safe_vault_path(path, must_exist="file")
    if not real:
        return None
    try:
        with open(real, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return None


def create_note_file(parent_path, name):
    """A new, empty note under parent_path (vault root if empty),
    deduped so an existing "Untitled.md" never gets silently
    overwritten. Returns the new note's own vault-relative path."""
    parent_real = safe_vault_path(parent_path, must_exist="dir") \
        if parent_path else active_vault_dir()
    if not parent_real:
        raise ValueError("that folder doesn't exist")
    if not name.lower().endswith(NOTE_EXT):
        name += NOTE_EXT
    if not is_safe_name(name):
        raise ValueError("that name isn't allowed")
    final_name = dedupe_name(parent_real, name, is_folder=False)
    full = os.path.join(parent_real, final_name)
    atomic_write_text(full, "")
    return to_rel(full)


def create_canvas_file(parent_path, name):
    """A new canvas under parent_path (vault root if empty), deduped
    the same way a new note already is. Seeded with EMPTY_CANVAS_JSON
    (a real, minimal, VALID JSON Canvas structure) rather than a
    truly empty file, so it parses correctly the very first time it's
    opened — a fresh note can start as "" because markdown has no
    real syntax to violate; a fresh canvas can't, since "" isn't
    valid JSON at all."""
    parent_real = safe_vault_path(parent_path, must_exist="dir") \
        if parent_path else active_vault_dir()
    if not parent_real:
        raise ValueError("that folder doesn't exist")
    if not name.lower().endswith(CANVAS_EXT):
        name += CANVAS_EXT
    if not is_safe_name(name):
        raise ValueError("that name isn't allowed")
    final_name = dedupe_name(parent_real, name, is_folder=False)
    full = os.path.join(parent_real, final_name)
    atomic_write_text(full, EMPTY_CANVAS_JSON)
    return to_rel(full)


def create_folder_dir(parent_path, name):
    parent_real = safe_vault_path(parent_path, must_exist="dir") \
        if parent_path else active_vault_dir()
    if not parent_real:
        raise ValueError("that folder doesn't exist")
    if not is_safe_name(name):
        raise ValueError("that name isn't allowed")
    final_name = dedupe_name(parent_real, name, is_folder=True)
    full = os.path.join(parent_real, final_name)
    os.makedirs(full)
    return to_rel(full)


def rename_item_path(path, new_name):
    """Renames a note, PDF, OR a folder in place — new_name is a bare
    name, never a path (is_safe_name enforces that directly; a caller
    trying to smuggle a "/" into new_name to relocate the item
    entirely is rejected outright, not silently reinterpreted as a
    move — move_item_path below is the only path that ever
    relocates anything)."""
    real = safe_vault_path(path)
    if not real or not os.path.exists(real):
        raise ValueError("that item doesn't exist")
    is_folder = os.path.isdir(real)
    if is_folder:
        if not is_safe_name(new_name):
            raise ValueError("that name isn't allowed")
    else:
        # the correct extension comes from the file that already
        # exists on disk, never assumed — a PDF stays a PDF
        _, real_ext = os.path.splitext(real)
        if not new_name.lower().endswith(real_ext.lower()):
            new_name += real_ext
        if not is_safe_name(new_name):
            raise ValueError("that name isn't allowed")
    parent_real = os.path.dirname(real)
    final_name = dedupe_name(parent_real, new_name, is_folder)
    dest = os.path.join(parent_real, final_name)
    os.rename(real, dest)
    return to_rel(dest)


def move_item_path(path, new_parent_path):
    """Relocates a note or folder to a different parent — the one
    thing rename_item_path above deliberately never does."""
    real = safe_vault_path(path)
    if not real or not os.path.exists(real):
        raise ValueError("that item doesn't exist")
    parent_real = safe_vault_path(new_parent_path, must_exist="dir") \
        if new_parent_path else active_vault_dir()
    if not parent_real:
        raise ValueError("that destination folder doesn't exist")
    real_check = os.path.realpath(real)
    parent_check = os.path.realpath(parent_real)
    if os.path.isdir(real) and (parent_check == real_check
            or parent_check.startswith(real_check + os.sep)):
        raise ValueError("can't move a folder inside itself")
    name = os.path.basename(real)
    final_name = dedupe_name(parent_real, name, os.path.isdir(real))
    dest = os.path.join(parent_real, final_name)
    os.rename(real, dest)
    return to_rel(dest)


def delete_item_path(path):
    real = safe_vault_path(path)
    if not real or not os.path.exists(real):
        return   # already gone - deleting twice is not an error
    if os.path.isdir(real):
        import shutil
        shutil.rmtree(real)
    else:
        os.remove(real)


def duplicate_item_path(path):
    """Cam: "Make a copy" (both context menus). A note copies as a
    real, independent .md file — "Note copy.md", deduped further if
    that's ALSO taken ("Note copy 2.md"...), matching the same
    dedupe_name convention every other create/rename path here
    already uses. A folder copies its ENTIRE tree, recursively —
    every note and sub-folder inside it, genuinely duplicated, not a
    shortcut or reference to the original."""
    real = safe_vault_path(path)
    if not real or not os.path.exists(real):
        raise ValueError("that item doesn't exist")
    parent_real = os.path.dirname(real)
    is_folder = os.path.isdir(real)
    if is_folder:
        base_name = os.path.basename(real)
        candidate = f"{base_name} copy"
    else:
        stem, ext = os.path.splitext(os.path.basename(real))
        candidate = f"{stem} copy{ext}"
    final_name = dedupe_name(parent_real, candidate, is_folder)
    dest = os.path.join(parent_real, final_name)
    if is_folder:
        import shutil
        shutil.copytree(real, dest)
    else:
        import shutil
        shutil.copy2(real, dest)
    return to_rel(dest)


def show_in_file_manager_path(path):
    """Cam: "Show in system explorer." No single command works
    identically everywhere, so each OS gets its own real mechanism —
    macOS and Windows both genuinely SELECT the file/folder itself;
    Linux has no reliably universal "select this one item" command
    across every file manager, so xdg-open falls back to opening its
    CONTAINING folder instead — still lands Cam in the right place,
    just without the specific item pre-highlighted."""
    real = safe_vault_path(path)
    if not real or not os.path.exists(real):
        raise ValueError("that item doesn't exist")
    import subprocess
    if sys.platform == "darwin":
        subprocess.run(["open", "-R", real], check=False)
    elif IS_WINDOWS:
        subprocess.run(["explorer", "/select,", real], check=False)
    else:
        target = real if os.path.isdir(real) else os.path.dirname(real)
        subprocess.run(["xdg-open", target], check=False)


def open_in_default_app_path(path):
    """Cam: "Open in default app." Whatever the OS already has
    associated with .md files (often a plain text editor, sometimes
    nothing at all if no association exists) — the same, real
    "hand it to the OS" pattern this project's own webbrowser.open
    already uses for external links elsewhere, just for local files."""
    real = safe_vault_path(path, must_exist="file")
    if not real:
        raise ValueError("that note doesn't exist")
    import subprocess
    if sys.platform == "darwin":
        subprocess.run(["open", real], check=False)
    elif IS_WINDOWS:
        os.startfile(real)          # noqa: S606
    else:
        subprocess.run(["xdg-open", real], check=False)


# ---- notes that ship with releases (2026-10-11, Cam: "add a check box where i can select notes to ship along in the
#      future") -- <notes>/ship.json lists vault paths; a folder ships everything in it. tools/make_starter.py packs them
#      into the starter files, and starter_data.py adds or updates them on each computer (a note edited there is kept).
SHIP_FILE = "ship.json"


def ship_file():
    return os.path.join(data_dir(), SHIP_FILE)


def read_ship():
    try:
        with open(ship_file(), encoding="utf-8") as f:
            paths = json.load(f).get("paths", [])
        return sorted({p for p in paths if isinstance(p, str) and p})
    except (OSError, ValueError, AttributeError):
        return []


def write_ship(paths):
    try:                                     # keep what else it says (2026-10-16: "vaults", the notebooks that ship too)
        with open(ship_file(), encoding="utf-8") as f:
            cur = json.load(f)
        cur = cur if isinstance(cur, dict) else {}
    except (OSError, ValueError):
        cur = {}
    cur["paths"] = sorted(set(paths))
    atomic_write_text(ship_file(), json.dumps(cur, indent=1) + "\n")


def ship_moved(old, new):
    """A shipped path (or one inside a shipped folder's list) renamed or moved: the list follows it; new=None drops it."""
    out = []
    for p in read_ship():
        if p == old or p.startswith(old + "/"):
            if new is not None:
                out.append(new + p[len(old):])
        else:
            out.append(p)
    if out != read_ship():
        write_ship(out)


# ---- ticks and flags (2026-11-02, Cam: "right click a note ... and put a tick or flag next to it. This will allow me to
#      flag anything for review or tick what i have done, i can then use this to make decisions of what needs to be done
#      and what i can archive") -- <notes>/marks.json: {vault id: {vault path: "tick" | "flag"}}. A mark follows its note
#      when it's renamed or moved, and goes when it's deleted or archived.
MARKS_FILE = "marks.json"
MARKS = ("tick", "flag")


def _read_all_marks():
    try:
        with open(os.path.join(data_dir(), MARKS_FILE), encoding="utf-8") as f:
            m = json.load(f)
        return m if isinstance(m, dict) else {}
    except (OSError, ValueError):
        return {}


def read_marks(vid=None):
    m = _read_all_marks().get(vid or read_vaults()["active"], {})
    return {p: v for p, v in m.items() if isinstance(p, str) and v in MARKS} if isinstance(m, dict) else {}


def write_marks(marks, vid=None):
    allm = _read_all_marks()
    allm[vid or read_vaults()["active"]] = {p: v for p, v in sorted(marks.items()) if v in MARKS}
    atomic_write_text(os.path.join(data_dir(), MARKS_FILE), json.dumps(allm, indent=1) + "\n")


def marks_moved(old, new, vid=None):
    """A marked path (or one inside a folder) renamed or moved: its mark follows; new=None drops it."""
    cur = read_marks(vid)
    out = {}
    for p, v in cur.items():
        if p == old or p.startswith(old + "/"):
            if new is not None:
                out[new + p[len(old):]] = v
        else:
            out[p] = v
    if out != cur:
        write_marks(out, vid)


# ---- the archive (2026-11-02, Cam: "implement an archive in the scribe app, which contains all archived notes, collabs
#      etc this will stop cluttering the main apps") -- an archived note or folder moves into its vault's hidden .archive
#      folder at the same path it had, so the tree, search and links never see it; Scribe > Archive lists it, shows it
#      and puts it back where it was.
ARCHIVE_DIRNAME = ".archive"


def archive_root(vid):
    root = vault_root(vid)
    if root is None:
        raise ValueError("There's no vault like that.")
    return os.path.join(root, ARCHIVE_DIRNAME)


def _archived_real(vid, path):
    """An archived item's real path, refusing anything that climbs out of the archive."""
    base = os.path.realpath(archive_root(vid))
    if not path or path.startswith("/") or "\\" in path:
        raise ValueError("That isn't an archived item.")
    real = os.path.realpath(os.path.join(base, path))
    if not real.startswith(base + os.sep) or not os.path.exists(real):
        raise ValueError("That archived item is gone.")
    return real


def archive_item_path(path):
    """Moves a note, PDF, canvas or folder of the open vault into its archive, at the same path."""
    real = safe_vault_path(path)
    if not real or not os.path.exists(real):
        raise ValueError("that item doesn't exist")
    rel_parent = os.path.dirname(path)
    dest_parent = os.path.join(archive_root(read_vaults()["active"]), rel_parent)
    os.makedirs(dest_parent, exist_ok=True)
    name = dedupe_name(dest_parent, os.path.basename(real), os.path.isdir(real))
    os.rename(real, os.path.join(dest_parent, name))
    return (rel_parent + "/" + name) if rel_parent else name


def list_archive():
    """Every archived item in every vault: the top of each archived thing (a folder counts once, with what's inside)."""
    v = read_vaults()
    vaults = [("main", v["mainName"])] + [(x["id"], x["name"]) for x in v["vaults"]]
    out = []
    for vid, vname in vaults:
        try:
            base = archive_root(vid)
        except ValueError:
            continue
        if not os.path.isdir(base):
            continue
        for dirpath, dirs, files in os.walk(base):
            rel_dir = os.path.relpath(dirpath, base)
            rel_dir = "" if rel_dir == "." else rel_dir.replace(os.sep, "/")
            # a folder made only to hold an archived item's place is walked into; a folder archived whole is one item
            keep = []
            for d in sorted(dirs):
                full = os.path.join(dirpath, d)
                rel = (rel_dir + "/" + d) if rel_dir else d
                if os.path.exists(os.path.join(full, ".archived-folder")):
                    n = sum(1 for _r, _d, fs in os.walk(full) for f in fs if f.lower().endswith((NOTE_EXT, PDF_EXT, CANVAS_EXT)))
                    out.append({"vault": vid, "vaultName": vname, "path": rel, "name": d, "type": "folder", "count": n,
                                "when": os.path.getmtime(os.path.join(full, ".archived-folder"))})
                else:
                    keep.append(d)
            dirs[:] = keep
            for f in sorted(files):
                low = f.lower()
                typ = "note" if low.endswith(NOTE_EXT) else "pdf" if low.endswith(PDF_EXT) else "canvas" if low.endswith(CANVAS_EXT) else None
                if not typ:
                    continue
                rel = (rel_dir + "/" + f) if rel_dir else f
                out.append({"vault": vid, "vaultName": vname, "path": rel, "name": os.path.splitext(f)[0], "type": typ,
                            "when": os.path.getmtime(os.path.join(dirpath, f))})
    return sorted(out, key=lambda x: x["when"], reverse=True)


def read_archived(vid, path):
    real = _archived_real(vid, path)
    if os.path.isdir(real):
        names = sorted(os.path.relpath(os.path.join(r, f), real).replace(os.sep, "/") for r, _d, fs in os.walk(real)
                       for f in fs if f.lower().endswith((NOTE_EXT, PDF_EXT, CANVAS_EXT)))
        return {"type": "folder", "files": names}
    if not real.lower().endswith(NOTE_EXT):
        return {"type": "file"}
    with open(real, encoding="utf-8", errors="replace") as f:
        return {"type": "note", "text": f.read()}


def restore_archived(vid, path):
    """Back where it was (the folders it sat in are made again if they've gone); a clash of names gets a new name."""
    real = _archived_real(vid, path)
    root = vault_root(vid)
    dest_parent = os.path.join(root, os.path.dirname(path))
    os.makedirs(dest_parent, exist_ok=True)
    marker = os.path.join(real, ".archived-folder")
    if os.path.isdir(real) and os.path.exists(marker):
        os.remove(marker)
    name = dedupe_name(dest_parent, os.path.basename(real), os.path.isdir(real))
    os.rename(real, os.path.join(dest_parent, name))
    _prune_empty(os.path.dirname(real), os.path.realpath(archive_root(vid)))
    rel = os.path.dirname(path)
    return {"vault": vid, "path": (rel + "/" + name) if rel else name}


def delete_archived(vid, path):
    real = _archived_real(vid, path)
    if os.path.isdir(real):
        import shutil
        shutil.rmtree(real)
    else:
        os.remove(real)
    _prune_empty(os.path.dirname(real), os.path.realpath(archive_root(vid)))


def _prune_empty(d, base):
    """The empty place-holding folders an archived item leaves behind when it goes."""
    d = os.path.realpath(d)
    while d.startswith(base + os.sep) and os.path.isdir(d) and not os.listdir(d):
        os.rmdir(d)
        d = os.path.dirname(d)


def attachments_dir():
    d = os.path.join(active_vault_dir(), ATTACHMENTS_DIRNAME)
    os.makedirs(d, exist_ok=True)
    return d


def _image_as_data_url(name):
    real = os.path.join(attachments_dir(), name)
    if not _SAFE_IMAGE.match(name or "") or not os.path.isfile(real):
        return None
    ext = os.path.splitext(name)[1].lower().lstrip(".")
    mime = "jpeg" if ext == "jpg" else ext
    with open(real, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("ascii")
    return f"data:image/{mime};base64,{encoded}"


def _pdf_as_data_url(path):
    """A PDF's own real bytes, base64-encoded for the same JS<->Python
    bridge every other piece of binary content in this app already
    goes through (see _image_as_data_url above) — kept consistent
    rather than introducing a second, different transport just for
    PDFs. Unlike _image_as_data_url, this takes a full VAULT-relative
    path (safe_vault_path, not a bare filename inside attachments/),
    since a PDF is a real, first-class vault item that can live
    anywhere in the tree, exactly like a note."""
    real = safe_vault_path(path, must_exist="file")
    if not real or not real.lower().endswith(PDF_EXT):
        return None
    with open(real, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("ascii")
    return f"data:application/pdf;base64,{encoded}"


_EMBED_RE = re.compile(r"!\[\[([^\[\]|]+?)(?:\|[^\[\]]*)?\]\]")
_MD_IMAGE_RE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)\)")


def _referenced_local_images(text, source_dir):
    """Every image an imported note's own text actually points at,
    resolved relative to that note's OWN original folder (source_dir)
    — both syntaxes Obsidian itself writes: ![[image.png]] (its own
    embed syntax) and standard markdown ![alt](image.png). Only a
    bare filename or a same-folder-relative one is considered "local"
    here — an http(s):// URL is left as plain text in the note,
    untouched, the same "preserve what doesn't have a home here rather
    than silently break it" principle the main app's own markdown
    importer already established."""
    found = []
    for pattern in (_EMBED_RE, _MD_IMAGE_RE):
        for m in pattern.finditer(text):
            ref = m.group(1).strip()
            if re.match(r"^\w+://", ref):
                continue
            candidate = os.path.join(source_dir, ref)
            if os.path.isfile(candidate):
                found.append((ref, candidate))
    return found


def import_paths(paths, dest_folder_path=""):
    """Copies one or more external .md files (or whole folders of
    them) into the vault, preserving each one's own internal folder
    structure relative to whatever was picked — Cam: "It should also
    allow the importing on obsidian text files." Genuinely lossless:
    the raw text is copied byte-for-byte, so every [[link]] and #tag
    already in an Obsidian note keeps working here exactly as
    written, no conversion at all. Any local image a note's own text
    references is copied into this vault's own attachments/ too, and
    the note's own reference is rewritten to the (possibly deduped)
    name it actually landed under here — otherwise an embed that
    worked in the source vault would silently break the moment it
    landed in a different one with a same-named-but-different photo
    already in it.

    Returns (n_notes, n_images, skipped) — skipped is a list of
    {name, why} for anything that couldn't be read at all, so an
    import can report a real, honest partial result rather than
    either all-or-nothing."""
    dest_real = safe_vault_path(dest_folder_path, must_exist="dir") \
        if dest_folder_path else active_vault_dir()
    if not dest_real:
        raise ValueError("that destination folder doesn't exist")

    # flatten every path picked (files or folders) into a single list
    # of (source_root, abs_file_path) pairs — source_root is whichever
    # of the ORIGINAL picked paths this file came from, so a picked
    # folder's own internal structure can be reproduced under dest_real
    md_files = []
    for p in paths:
        if os.path.isdir(p):
            for dirpath, _dirnames, filenames in os.walk(p):
                for fn in filenames:
                    if fn.lower().endswith(NOTE_EXT):
                        md_files.append((p, os.path.join(dirpath, fn)))
        elif p.lower().endswith(NOTE_EXT):
            md_files.append((os.path.dirname(p), p))

    n_notes = 0
    n_images = 0
    skipped = []
    for source_root, abs_path in md_files:
        try:
            with open(abs_path, "r", encoding="utf-8",
                     errors="replace") as f:
                text = f.read()
        except OSError as e:
            skipped.append({"name": os.path.basename(abs_path),
                            "why": str(e)})
            continue

        rel_from_root = os.path.relpath(abs_path, source_root)
        rel_from_root = rel_from_root.replace(os.sep, "/")
        segments = rel_from_root.split("/")
        if not all(is_safe_name(s) for s in segments):
            skipped.append({"name": os.path.basename(abs_path),
                            "why": "that name isn't allowed"})
            continue

        target_dir = dest_real
        for seg in segments[:-1]:
            target_dir = os.path.join(target_dir, seg)
        os.makedirs(target_dir, exist_ok=True)
        target_name = dedupe_name(target_dir, segments[-1], is_folder=False)
        target_path = os.path.join(target_dir, target_name)

        note_source_dir = os.path.dirname(abs_path)
        for original_ref, image_abs in _referenced_local_images(
                text, note_source_dir):
            image_base = os.path.basename(image_abs)
            if not _SAFE_IMAGE.match(image_base):
                continue
            final_image_name = dedupe_name(
                attachments_dir(), image_base, is_folder=False)
            try:
                with open(image_abs, "rb") as imf:
                    image_bytes = imf.read()
                with open(os.path.join(attachments_dir(), final_image_name),
                         "wb") as outf:
                    outf.write(image_bytes)
            except OSError:
                continue
            n_images += 1
            if final_image_name != os.path.basename(original_ref):
                text = text.replace(original_ref, final_image_name)

        atomic_write_text(target_path, text)
        n_notes += 1

    return n_notes, n_images, skipped


class NotesApi:
    def __init__(self):
        self._window = None

    def ping(self):
        return "ok"

    def _dialog(self, *args, **kwargs):
        """A native file dialog on the app's window.

        NeuroNet hands the window over in main(); if that ever goes missing
        again, pywebview's own list of windows is asked instead, and failing
        that the caller gets an error it can show -- never the silent
        AttributeError that left the Vault's import buttons dead."""
        win = self._window
        if win is None:
            import webview
            win = webview.windows[0] if getattr(webview, "windows", None) else None
        if win is None:
            return {"error": "The file dialog isn't available right now."}
        return win.create_file_dialog(*args, **kwargs)

    # -- the vault's own structure -----------------------------------------
    def list_tree(self):
        return list_tree()

    # -- every note at once, for the graph -------------------------------
    def read_all_notes(self, limit=1500):
        """Every note's text in one call, for building the link graph.

        One call rather than one per note: a vault of a few hundred notes
        would otherwise mean a few hundred round trips across the bridge,
        and the graph would visibly assemble itself rather than appear.

        The links are NOT extracted here. That is done on the JavaScript
        side by the same CC.md.extractLinks the editor, the backlinks panel
        and the autocomplete all use — one regex for the whole app, so the
        graph can never disagree with the backlinks about what links to
        what.
        """
        out = []
        root = active_vault_dir()
        truncated = False
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = sorted(d for d in dirnames
                                 if not d.startswith(".") and d != "attachments")
            for name in sorted(filenames):
                if not name.lower().endswith(".md"):
                    continue
                if len(out) >= int(limit):
                    truncated = True
                    break
                full = os.path.join(dirpath, name)
                rel = os.path.relpath(full, root).replace(os.sep, "/")
                try:
                    with open(full, "r", encoding="utf-8", errors="replace") as f:
                        text = f.read()
                except OSError:
                    continue
                out.append({
                    "path": rel,
                    "title": os.path.splitext(name)[0],
                    "folder": os.path.dirname(rel),
                    "text": text,
                })
            if truncated:
                break
        return {"notes": out, "truncated": truncated}

    # -- a single note --------------------------------------------------
    def read_note(self, path):
        return read_note_file(path)

    def write_note(self, path, text):
        real = safe_vault_path(path, must_exist="file")
        if not real:
            return {"error": "that note doesn't exist"}
        atomic_write_text(real, text)
        return {"ok": True}

    def create_note(self, parent_path, name):
        try:
            return {"path": create_note_file(parent_path, name)}
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    # -- a single canvas — Cam: "have a look at obisidians webpage...
    # I want an in depth system implemented into Cortex." A canvas's
    # own real content is JSON text (the real JSON Canvas format), so
    # read/write are exactly read_note/write_note's own shape — the
    # frontend owns parsing/serializing that JSON, the same way it
    # already owns rendering markdown from a note's own raw text. --
    def read_canvas(self, path):
        return read_note_file(path)

    def write_canvas(self, path, json_text):
        real = safe_vault_path(path, must_exist="file")
        if not real:
            return {"error": "that canvas doesn't exist"}
        atomic_write_text(real, json_text)
        return {"ok": True}

    def create_canvas(self, parent_path, name):
        try:
            return {"path": create_canvas_file(parent_path, name)}
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def create_folder(self, parent_path, name):
        try:
            return {"path": create_folder_dir(parent_path, name)}
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def rename_item(self, path, new_name):
        try:
            new = rename_item_path(path, new_name)
        except (ValueError, OSError) as e:
            return {"error": str(e)}
        marks_moved(path, new)
        if read_vaults()["active"] == "main":
            ship_moved(path, new)
        return {"path": new}

    def move_item(self, path, new_parent_path):
        try:
            new = move_item_path(path, new_parent_path)
        except (ValueError, OSError) as e:
            return {"error": str(e)}
        marks_moved(path, new)
        if read_vaults()["active"] == "main":
            ship_moved(path, new)
        return {"path": new}

    def delete_item(self, path):
        delete_item_path(path)
        marks_moved(path, None)
        if read_vaults()["active"] == "main":
            ship_moved(path, None)
        return {"ok": True}

    # -- separate vaults (2026-10-12) ---------------------------------------
    def list_vaults(self):
        v = read_vaults()
        return {"active": v["active"], "vaults": [{"id": "main", "name": v["mainName"]}] + [{"id": x["id"], "name": x["name"]} for x in v["vaults"]]}

    def switch_vault(self, vid):
        v = read_vaults()
        if vid != "main" and not any(x["id"] == vid for x in v["vaults"]):
            return {"error": "There's no vault like that."}
        v["active"] = vid
        write_vaults(v)
        active_vault_dir()
        return self.list_vaults()

    def new_vault(self, name):
        name = clean_vault_name(name)
        if not name:
            return {"error": "Give the vault a name."}
        v = read_vaults()
        if name.lower() in [v["mainName"].lower()] + [x["name"].lower() for x in v["vaults"]]:
            return {"error": "There's already a vault called that."}
        n = 1
        taken = {x["id"] for x in v["vaults"]}
        while "v%d" % n in taken or os.path.exists(other_vault_dir("v%d" % n)):
            n += 1
        vid = "v%d" % n
        os.makedirs(other_vault_dir(vid), exist_ok=True)
        v["vaults"].append({"id": vid, "name": name, "created": time.strftime("%Y-%m-%dT%H:%M:%S")})
        v["active"] = vid
        write_vaults(v)
        return self.list_vaults()

    def rename_vault(self, vid, name):
        name = clean_vault_name(name)
        if not name:
            return {"error": "Give the vault a name."}
        v = read_vaults()
        others = [x for x in v["vaults"] if x["id"] != vid]
        if name.lower() in ([] if vid == "main" else [v["mainName"].lower()]) + [x["name"].lower() for x in others]:
            return {"error": "There's already a vault called that."}
        if vid == "main":
            v["mainName"] = name
        else:
            hit = [x for x in v["vaults"] if x["id"] == vid]
            if not hit:
                return {"error": "There's no vault like that."}
            hit[0]["name"] = name
        write_vaults(v)
        return self.list_vaults()

    def delete_vault(self, vid):
        """Never the main vault. The folder isn't erased: it's moved to notes/deleted vaults/, so a slip can be undone
        by hand."""
        if vid == "main":
            return {"error": "The main vault can't be deleted."}
        v = read_vaults()
        hit = [x for x in v["vaults"] if x["id"] == vid]
        if not hit:
            return {"error": "There's no vault like that."}
        src = other_vault_dir(vid)
        if os.path.isdir(src):
            bin_dir = os.path.join(data_dir(), "deleted vaults")
            os.makedirs(bin_dir, exist_ok=True)
            dst = os.path.join(bin_dir, "%s - %s" % (clean_vault_name(hit[0]["name"]) or vid, time.strftime("%Y-%m-%d %H%M%S")))
            shutil.move(src, dst)
        v["vaults"] = [x for x in v["vaults"] if x["id"] != vid]
        if v["active"] == vid:
            v["active"] = "main"
        write_vaults(v)
        return self.list_vaults()

    def vault_folders(self, vid):
        """Another vault's folders, flat with their depth, for the Move to... picker."""
        root = vault_root(vid)
        if root is None:
            return {"error": "There's no vault like that."}
        out = []

        def walk(nodes, depth):
            for n in nodes:
                if n["type"] == "folder":
                    out.append({"path": n["path"], "name": n["name"], "depth": depth})
                    walk(n["children"], depth + 1)
        walk(list_tree(root), 0)
        return {"folders": out}

    def move_to_vault(self, path, vid, dest_folder=""):
        try:
            new, pics = move_to_vault_path(path, vid, dest_folder)
        except (ValueError, OSError) as e:
            return {"error": str(e)}
        marks_moved(path, None)
        if read_vaults()["active"] == "main":
            ship_moved(path, None)                      # only the main vault ships
        return {"ok": True, "path": new, "vault": vid, "pictures": pics}

    def ship_list(self):
        """The vault paths that ship with releases (the main vault's; another vault's notes never ship)."""
        return read_ship() if read_vaults()["active"] == "main" else []

    def set_ship(self, path, on):
        """Ship a note or folder with releases (on), or stop (off)."""
        if read_vaults()["active"] != "main":
            return {"error": "Only the main vault ships with releases."}
        if not path or not safe_vault_path(path) or not os.path.exists(safe_vault_path(path)):
            return {"error": "There's no note or folder there."}
        paths = [p for p in read_ship() if p != path]
        if on:
            paths.append(path)
        write_ship(paths)
        return {"paths": read_ship()}

    # -- ticks and flags, the archive (2026-11-02) ----------------------------
    def marks_list(self):
        return read_marks()

    def set_mark(self, path, mark):
        """mark: "tick", "flag" or "" (clear)."""
        if not path or not safe_vault_path(path) or not os.path.exists(safe_vault_path(path)):
            return {"error": "There's no note or folder there."}
        m = read_marks()
        if mark in MARKS:
            m[path] = mark
        else:
            m.pop(path, None)
        write_marks(m)
        return {"marks": read_marks()}

    def archive_item(self, path):
        try:
            real = safe_vault_path(path)
            was_folder = bool(real) and os.path.isdir(real)
            new = archive_item_path(path)
            if was_folder:                      # (so the Archive shows the folder as one thing, not each note in it)
                with open(os.path.join(archive_root(read_vaults()["active"]), new, ".archived-folder"), "w") as f:
                    f.write(datetime.datetime.now().replace(microsecond=0).isoformat() + "\n")
        except (ValueError, OSError) as e:
            return {"error": str(e)}
        marks_moved(path, None)
        if read_vaults()["active"] == "main":
            ship_moved(path, None)
        return {"ok": True, "archived": new}

    def archive_list(self):
        try:
            return list_archive()
        except OSError as e:
            return {"error": str(e)}

    def archive_read(self, vid, path):
        try:
            return read_archived(str(vid), str(path))
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def archive_restore(self, vid, path):
        try:
            return restore_archived(str(vid), str(path))
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def archive_delete(self, vid, path):
        try:
            delete_archived(str(vid), str(path))
            return {"ok": True}
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def duplicate_item(self, path):
        try:
            return {"path": duplicate_item_path(path)}
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def show_in_file_manager(self, path):
        try:
            show_in_file_manager_path(path)
            return {"ok": True}
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    def open_in_default_app(self, path):
        try:
            open_in_default_app_path(path)
            return {"ok": True}
        except (ValueError, OSError) as e:
            return {"error": str(e)}

    # -- photo attachments — Cam: "should allow attaching photos to
    #    notes" -----------------------------------------------------------
    def save_image(self, name, data_url):
        """Same base64-decode-and-write shape every other app in this
        project already uses for a photo upload, deduped the same
        way — an attached photo can never silently clobber another
        one already in the vault."""
        if not _SAFE_IMAGE.match(name or ""):
            raise ValueError("bad image name")
        m = re.match(r"^data:[^;]+;base64,(.+)$", data_url or "", re.S)
        if not m:
            raise ValueError("expected a base64 data URL")
        final = dedupe_name(attachments_dir(), name, is_folder=False)
        with open(os.path.join(attachments_dir(), final), "wb") as f:
            f.write(base64.b64decode(m.group(1)))
        return final

    def image_url(self, name):
        return _image_as_data_url(name)

    def pdf_data(self, path):
        return _pdf_as_data_url(path)

    # -- Cam: "PDF capability, this way i can use it to read PDF or
    #    even open it split view with a note beside it and write
    #    notes on what i read." A PDF is a real, first-class vault
    #    item (see list_tree's own docstring), so importing one is
    #    modeled on pick_image/attach_images above — a real file
    #    dialog, then a straightforward copy — rather than
    #    import_paths' own more involved logic, which exists
    #    specifically to rewrite [[links]] and embedded images inside
    #    imported markdown text; a PDF has none of that to rewrite.
    def pick_pdf(self):
        import webview
        picked = self._dialog(
            webview.OPEN_DIALOG, allow_multiple=True,
            file_types=("PDF files (*.pdf)", "All files (*.*)"))
        if isinstance(picked, dict):
            return picked
        if not picked:
            return {"cancelled": True}
        if isinstance(picked, str):
            picked = [picked]
        return {"paths": list(picked)}

    def import_pdfs(self, paths, dest_folder_path=""):
        """Copies each picked PDF straight into the chosen vault
        folder (dest_folder_path — the same right-click "New note
        here"-style destination scoping every other create/import
        action in this app already respects, not always the vault
        root). Deduped the same way every other import in this app
        already is, so two different PDFs that happen to share a
        filename can never clobber one another. A file that's
        vanished, isn't readable, or genuinely isn't a PDF by the
        time this runs is skipped rather than failing the whole
        batch — the same "one bad file doesn't sink the rest"
        principle import_files/attach_images already establish."""
        dest_dir = safe_vault_path(dest_folder_path, must_exist="dir") \
            if dest_folder_path else active_vault_dir()
        if not dest_dir:
            return {"error": "that destination folder doesn't exist"}
        saved = []
        skipped = []
        for p in paths or []:
            base = os.path.basename(p)
            if not base.lower().endswith(PDF_EXT):
                skipped.append({"name": base, "why": "not a PDF"})
                continue
            try:
                with open(p, "rb") as f:
                    data = f.read()
            except OSError as e:
                skipped.append({"name": base, "why": str(e)})
                continue
            final = dedupe_name(dest_dir, base, is_folder=False)
            with open(os.path.join(dest_dir, final), "wb") as out:
                out.write(data)
            saved.append(to_rel(os.path.join(dest_dir, final)))
        return {"saved": saved, "skipped": skipped}

    # -- v171: "Add insert photo to right click" — a second way to
    #    attach a photo alongside paste (save_image above), for a
    #    photo that's just sitting on disk rather than on the
    #    clipboard. Two calls, same shape as pick_import/import_files:
    #    the dialog is its own call so the UI can react to a plain
    #    cancel without treating it as an error, and the actual copy
    #    reads each file directly off disk rather than round-tripping
    #    it through JS as base64 the way a paste has no choice but to.
    def list_attachments(self):
        """Every real, existing image already sitting in the vault's
        own attachments/ folder — Cam: "Does canvas allow me to add
        photos onto the canvas as well?" -> "Pick from existing
        attachments" needs a real list to pick FROM, which nothing
        before this ever needed, since attachments/ is deliberately
        never browsed directly anywhere else in this app (see
        list_tree's own docstring). Sorted for a stable, predictable
        real order in the picker."""
        try:
            names = os.listdir(attachments_dir())
        except OSError:
            return []
        return sorted(n for n in names if _SAFE_IMAGE.match(n))

    def pick_image(self):
        import webview
        picked = self._dialog(
            webview.OPEN_DIALOG, allow_multiple=True,
            file_types=("Images (*.png;*.jpg;*.jpeg;*.gif;*.webp)",
                        "All files (*.*)"))
        if isinstance(picked, dict):
            return picked
        if not picked:
            return {"cancelled": True}
        if isinstance(picked, str):
            picked = [picked]
        return {"paths": list(picked)}

    def attach_images(self, paths):
        """Copies each picked photo straight into the vault's own
        attachments/ folder — the exact same self-sufficiency a pasted
        image already gets (see save_image above), just sourced from
        a real path instead of clipboard bytes. Deduped the same way
        too, so two different photos that happen to share a filename
        can never clobber one another. A file that's vanished, isn't
        readable, or isn't actually a supported image type by the
        time this runs is skipped rather than failing the whole
        batch — same "one bad file doesn't sink the rest" principle
        import_files already established."""
        saved = []
        skipped = []
        for p in paths or []:
            base = os.path.basename(p)
            if not _SAFE_IMAGE.match(base):
                skipped.append({"name": base,
                                "why": "not a supported image type"})
                continue
            try:
                with open(p, "rb") as f:
                    data = f.read()
            except OSError as e:
                skipped.append({"name": base, "why": str(e)})
                continue
            final = dedupe_name(attachments_dir(), base, is_folder=False)
            with open(os.path.join(attachments_dir(), final), "wb") as out:
                out.write(data)
            saved.append(final)
        return {"saved": saved, "skipped": skipped}

    def open_external(self, url):
        """An ordinary [text](url) link in a note's own preview opens
        in the system's default browser — never inside this app's own
        webview itself, which would just navigate the whole app away
        from itself with no way back."""
        import webbrowser
        if re.match(r"^https?://", url or ""):
            webbrowser.open(url)
        return {"ok": True}

    def get_prefs(self):
        return read_prefs()

    def set_prefs(self, prefs):
        write_prefs(prefs)
        return {"ok": True}

    # -- importing from Obsidian — Cam: "It should also allow the
    #    importing on obsidian text files." --------------------------------
    def pick_import(self):
        """A real, native picker — individual .md files (multi-select)
        OR a whole folder, either one landing in the same
        import_files below. Obsidian itself lets you point at a
        vault (a folder) or a handful of loose notes; both are
        genuinely common, so both are offered rather than picking
        one for Cam."""
        import webview
        picked = self._dialog(
            webview.OPEN_DIALOG, allow_multiple=True,
            file_types=("Markdown (*.md;*.markdown)", "All files (*.*)"))
        if isinstance(picked, dict):
            return picked
        if not picked:
            return {"cancelled": True}
        if isinstance(picked, str):
            picked = [picked]
        return {"paths": list(picked)}

    def pick_import_folder(self):
        import webview
        picked = self._dialog(webview.FOLDER_DIALOG)
        if isinstance(picked, dict):
            return picked
        if not picked:
            return {"cancelled": True}
        if isinstance(picked, (list, tuple)):
            picked = picked[0]
        return {"paths": [picked]}

    def import_files(self, paths, dest_folder_path=""):
        try:
            n_notes, n_images, skipped = import_paths(paths, dest_folder_path)
        except (OSError, ValueError) as e:
            return {"error": str(e)}
        return {"notes": n_notes, "images": n_images, "skipped": skipped}
