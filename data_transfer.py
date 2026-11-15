"""Export and import -- everything of Cam's in one file, to move NeuroNet to
another machine.

Cam: "in settings i would like a setting to export and import data. It will
export all the data except for music, movies, videos or anything large, It
will export the photos and ebooks. This will make it easier to move to
another system."

WHERE THE DATA IS. Not one folder. NeuroNet's own (neuronet_data/) holds most
of it, but the calendar, contacts and family photos live in camily_data/, the
recipes in cookery_data/ and the money in kincrux_money/ -- wherever the
Kitchen found them, which on Cam's machine is beside NeuroNet, not in it. An
export of neuronet_data/ alone would have looked complete and left all of
that behind. So the caller hands in AREAS, each resolved the way the running
app resolves it, and the import puts each area back wherever the NEW machine
keeps that area -- not at the old machine's paths.

WHAT IS LEFT OUT, by kind rather than by size, so a large photo or ebook is
never dropped by accident:
  * audio and video, anywhere -- the music library, meditation recordings,
    films. Photos and ebooks are what Cam asked to keep, and are kept.
  * caches the app rebuilds by itself (photo thumbnails and frames, album
    thumbnails)
  * the rolling .backup-* copies Training keeps of itself, temp files, logs,
    and the import safety copies below
What was left out is counted in the manifest, so the export can say so.

IMPORT ADDS AND REPLACES; IT NEVER DELETES. Moving to a new machine, the
music library there is exactly what an import must not touch. And any file
an import is about to overwrite is copied first into
neuronet_data/import-backups/<when>/, so an import made by mistake can be
undone by hand.

THE FILE is a plain .zip: one folder per area inside it, plus
neuronet-export.json saying what it is. It opens on any computer.
"""
import datetime
import json
import os
import shutil
import socket
import zipfile

FORMAT = "neuronet-export"
VERSION = 1
MANIFEST = "neuronet-export.json"

MEDIA_EXTS = {
    # audio
    ".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wma", ".aiff",
    ".aif", ".alac", ".ape", ".mka", ".mid", ".midi",
    # video
    ".mp4", ".mkv", ".avi", ".mov", ".m4v", ".webm", ".wmv", ".mpg", ".mpeg", ".ts",
    ".m2ts", ".vob", ".3gp", ".flv",
}
# Folders the app fills again by itself.
CACHE_DIRS = {"photos_thumbs", "photos_frame", "__pycache__", "import-backups",
              "adopted-originals", ".import-work"}
# album thumbnails, card art's thumbnails and print copies, and the journal's
# thumbnails -- all remade from the pictures
CACHE_PATHS = ("chords/thumbs/", "cards/thumbs/", "cards/print/", "journal/thumbs/")
# Already compressed: stored as they are, which is much faster and no bigger.
STORED_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".pdf", ".epub",
               ".zip", ".docx", ".xlsx", ".pptx", ".mobi"}


def _now():
    return datetime.datetime.now()


def left_out(rel):
    """Why a file (its path inside its area) is not exported, or None."""
    parts = rel.replace("\\", "/").split("/")
    name = parts[-1]
    ext = os.path.splitext(name)[1].lower()
    if ext in MEDIA_EXTS:
        return "music, films and other recordings"
    if any(p in CACHE_DIRS for p in parts[:-1]) or rel.replace("\\", "/").startswith(CACHE_PATHS):
        return "caches the app rebuilds"
    if ".backup-" in name or name.endswith((".tmp", ".log", ".pyc")) or name.startswith(".~"):
        return "old backup copies and temporary files"
    return None


def plan(areas):
    """What an export of these areas would hold, and what it would leave out.

    areas: [{"key", "label", "path", "file"?}] -- a folder, or with "file"
    set, a single file."""
    files, skipped = [], {}
    for a in areas:
        path = a["path"]
        if a.get("file"):
            if os.path.isfile(path):
                files.append((a["key"], os.path.basename(path), path, os.path.getsize(path)))
            continue
        if not os.path.isdir(path):
            continue
        for here, dirs, names in os.walk(path):
            dirs[:] = sorted(dirs)
            for n in sorted(names):
                full = os.path.join(here, n)
                if os.path.islink(full) or not os.path.isfile(full):
                    continue
                rel = os.path.relpath(full, path).replace(os.sep, "/")
                try:
                    size = os.path.getsize(full)
                except OSError:
                    continue
                why = left_out(rel)
                if why:
                    s = skipped.setdefault(why, {"files": 0, "bytes": 0})
                    s["files"] += 1
                    s["bytes"] += size
                    continue
                files.append((a["key"], rel, full, size))
    return files, skipped


def summary(areas):
    """For the Settings page, before anything is written."""
    files, skipped = plan(areas)
    by_area = {}
    for key, _rel, _full, size in files:
        s = by_area.setdefault(key, {"files": 0, "bytes": 0})
        s["files"] += 1
        s["bytes"] += size
    return {"areas": [dict(key=a["key"], label=a["label"], path=a["path"],
                           **by_area.get(a["key"], {"files": 0, "bytes": 0})) for a in areas],
            "files": len(files), "bytes": sum(f[3] for f in files),
            "skipped": [{"why": k, **v} for k, v in sorted(skipped.items())]}


def export(areas, dest, progress=None):
    """Write the export to `dest`, through a temporary file and a rename, so
    a half-written export never sits where a whole one should be."""
    files, skipped = plan(areas)
    total = sum(f[3] for f in files) or 1
    tmp = dest + ".part"
    done = 0
    manifest = {
        "format": FORMAT, "version": VERSION,
        "created": _now().isoformat(timespec="seconds"),
        "from": socket.gethostname(),
        "areas": [{"key": a["key"], "label": a["label"], "file": bool(a.get("file"))} for a in areas],
        "files": len(files), "bytes": sum(f[3] for f in files),
        "left_out": [{"why": k, **v} for k, v in sorted(skipped.items())],
    }
    try:
        with zipfile.ZipFile(tmp, "w", allowZip64=True) as z:
            z.writestr(MANIFEST, json.dumps(manifest, indent=1, ensure_ascii=False))
            for i, (key, rel, full, size) in enumerate(files):
                how = zipfile.ZIP_STORED if os.path.splitext(rel)[1].lower() in STORED_EXTS \
                    else zipfile.ZIP_DEFLATED
                try:
                    z.write(full, key + "/" + rel, compress_type=how)
                except OSError:
                    continue            # vanished while exporting: not worth failing the rest for
                done += size
                if progress:
                    progress(i + 1, len(files), done / total)
        os.replace(tmp, dest)
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise
    return {"ok": True, "path": dest, **{k: manifest[k] for k in ("files", "bytes", "left_out")}}


def read_manifest(src):
    """What an export holds, or an error that says why it isn't one."""
    try:
        with zipfile.ZipFile(src) as z:
            try:
                m = json.loads(z.read(MANIFEST).decode("utf-8"))
            except KeyError:
                return {"error": "That zip isn't a NeuroNet export -- it has no neuronet-export.json."}
    except (zipfile.BadZipFile, OSError) as e:
        return {"error": "That file couldn't be opened as a zip (%s)." % e}
    except ValueError:
        return {"error": "That export's description is damaged."}
    if not isinstance(m, dict) or m.get("format") != FORMAT:
        return {"error": "That zip isn't a NeuroNet export."}
    if int(m.get("version") or 0) > VERSION:
        return {"error": "That export was made by a newer NeuroNet. Update this one first."}
    return {"ok": True, "manifest": m}


def _same(path, info):
    """Is the file here already exactly the one in the export?"""
    import zlib
    try:
        if os.path.getsize(path) != info.file_size:
            return False
        crc = 0
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                crc = zlib.crc32(chunk, crc)
        return (crc & 0xFFFFFFFF) == info.CRC
    except OSError:
        return False


def import_zip(src, areas, backup_root, progress=None):
    """Put an export's files into this machine's areas.

    Adds and replaces; never deletes. Every file about to be overwritten is
    copied under backup_root first. A name in the zip that would land
    outside its area, or in an area this machine doesn't know, is refused
    rather than written."""
    got = read_manifest(src)
    if not got.get("ok"):
        return got
    where = {a["key"]: a for a in areas}
    stamp = _now().strftime("%Y%m%d-%H%M%S")
    backup = os.path.join(backup_root, stamp)
    written = replaced = same = 0
    refused, unknown = [], set()
    with zipfile.ZipFile(src) as z:
        members = [i for i in z.infolist() if not i.is_dir() and i.filename != MANIFEST]
        for n, info in enumerate(members):
            name = info.filename.replace("\\", "/")
            key, _, rel = name.partition("/")
            area = where.get(key)
            if not area:
                unknown.add(key)
                continue
            if area.get("file"):
                # A single file (a settings file): one name, no folders.
                if not rel or "/" in rel or rel in (".", ".."):
                    refused.append(name)
                    continue
                target = area["path"]
                base = os.path.dirname(target)
            else:
                base = area["path"]
                target = os.path.normpath(os.path.join(base, rel))
                if os.path.isabs(rel) or not rel or \
                        os.path.commonpath([os.path.abspath(base), os.path.abspath(target)]) != os.path.abspath(base):
                    refused.append(name)
                    continue
            if os.path.isfile(target) and _same(target, info):
                same += 1               # already here, byte for byte: nothing to do
                if progress:
                    progress(n + 1, len(members), (n + 1) / max(1, len(members)))
                continue
            if os.path.isfile(target):
                keep = os.path.join(backup, key, rel if not area.get("file") else os.path.basename(target))
                os.makedirs(os.path.dirname(keep), exist_ok=True)
                shutil.copy2(target, keep)
                replaced += 1
            os.makedirs(base if area.get("file") else os.path.dirname(target), exist_ok=True)
            part = target + ".importing"
            with z.open(info) as fin, open(part, "wb") as fout:
                shutil.copyfileobj(fin, fout, 1024 * 1024)
            os.replace(part, target)
            written += 1
            if progress:
                progress(n + 1, len(members), (n + 1) / max(1, len(members)))
    return {"ok": True, "written": written, "replaced": replaced, "same": same,
            "backup": backup if replaced else "", "refused": refused[:20],
            "unknown": sorted(unknown), "manifest": got["manifest"]}


# ============================================================================
# A PASSWORD ON THE EXPORT (NeuroNet System plan, Stage 3, 2026-09-29).
#
# Cam: the new-machine export should be password protected "if possible".
# It holds the journal, the money and the contacts, and it travels over
# LocalSend or on a stick. So it can be locked: the same zip, wrapped.
#
#   NEURONET-ENC1\n | u32 header length | header (JSON) | the zip, in pieces
#
# The key comes from the password with scrypt (slow on purpose, so guessing
# is expensive). Each 1 MB piece of the zip is sealed with AES-GCM: a wrong
# password or a changed byte fails its check, and each piece is numbered and
# the last one marked, so pieces can't be reordered, dropped or cut short
# without it showing. The export's description (what it holds, from where)
# is sealed separately in the header, so picking the file needs only the
# password to show what's in it -- not unlocking 5 GB first.
# ============================================================================
import base64
import struct

ENC_MAGIC = b"NEURONET-ENC1\n"
ENC_EXT = ".nnx"
CHUNK = 1024 * 1024
_SCRYPT = {"n": 2 ** 15, "r": 8, "p": 1}


class WrongPassword(Exception):
    pass


def _key(password, salt, n, r, p):
    from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
    return Scrypt(salt=salt, length=32, n=n, r=r, p=p).derive(password.encode("utf-8"))


def _aad(header_bytes, index, final):
    return header_bytes + struct.pack(">QB", index, 1 if final else 0)


def is_encrypted(path):
    try:
        with open(path, "rb") as f:
            return f.read(len(ENC_MAGIC)) == ENC_MAGIC
    except OSError:
        return False


def _read_header(f):
    if f.read(len(ENC_MAGIC)) != ENC_MAGIC:
        raise ValueError("not a locked NeuroNet export")
    (n,) = struct.unpack(">I", f.read(4))
    raw = f.read(n)
    return raw, json.loads(raw.decode("utf-8"))


def encrypt_file(src, dest, password, manifest, progress=None):
    """Lock the zip at src into dest, with its manifest sealed in the header."""
    import os as _os
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    salt, prefix, meta_nonce = _os.urandom(16), _os.urandom(4), _os.urandom(12)
    key = _key(password, salt, **_SCRYPT)
    aead = AESGCM(key)
    meta = aead.encrypt(meta_nonce, json.dumps(manifest).encode("utf-8"), b"neuronet-manifest")
    header = json.dumps({
        "kdf": "scrypt", **_SCRYPT, "salt": base64.b64encode(salt).decode(),
        "prefix": base64.b64encode(prefix).decode(), "chunk": CHUNK,
        "meta_nonce": base64.b64encode(meta_nonce).decode(),
        "meta": base64.b64encode(meta).decode(),
    }).encode("utf-8")
    total = os.path.getsize(src) or 1
    done = 0
    with open(src, "rb") as fin, open(dest, "wb") as fout:
        fout.write(ENC_MAGIC + struct.pack(">I", len(header)) + header)
        index = 0
        piece = fin.read(CHUNK)
        while True:
            nxt = fin.read(CHUNK)
            final = not nxt
            nonce = prefix + struct.pack(">Q", index)
            sealed = aead.encrypt(nonce, piece, _aad(header, index, final))
            fout.write(struct.pack(">I", len(sealed)) + sealed)
            done += len(piece)
            if progress:
                progress(done, total, done / total)
            if final:
                break
            piece, index = nxt, index + 1


def peek_encrypted(src, password):
    """The sealed manifest of a locked export -- checks the password without
    unlocking the rest. Raises WrongPassword."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.exceptions import InvalidTag
    with open(src, "rb") as f:
        _raw, h = _read_header(f)
    key = _key(password, base64.b64decode(h["salt"]), h["n"], h["r"], h["p"])
    try:
        meta = AESGCM(key).decrypt(base64.b64decode(h["meta_nonce"]),
                                   base64.b64decode(h["meta"]), b"neuronet-manifest")
    except InvalidTag:
        raise WrongPassword()
    return json.loads(meta.decode("utf-8"))


def decrypt_file(src, dest, password, progress=None):
    """Unlock a locked export into the zip it was made from."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.exceptions import InvalidTag
    total = os.path.getsize(src) or 1
    with open(src, "rb") as fin:
        header, h = _read_header(fin)
        aead = AESGCM(_key(password, base64.b64decode(h["salt"]), h["n"], h["r"], h["p"]))
        prefix = base64.b64decode(h["prefix"])
        index, finished = 0, False
        with open(dest, "wb") as fout:
            while True:
                size_b = fin.read(4)
                if not size_b:
                    break
                if finished:
                    raise ValueError("That export has something after its end -- it isn't whole.")
                (n,) = struct.unpack(">I", size_b)
                sealed = fin.read(n)
                if len(sealed) != n:
                    raise ValueError("That export is cut short -- it didn't copy across whole.")
                nonce = prefix + struct.pack(">Q", index)
                try:
                    piece = aead.decrypt(nonce, sealed, _aad(header, index, False))
                except InvalidTag:
                    try:
                        piece = aead.decrypt(nonce, sealed, _aad(header, index, True))
                        finished = True
                    except InvalidTag:
                        if index == 0:
                            raise WrongPassword()
                        raise ValueError("That export is damaged (piece %d doesn't check out)." % index)
                fout.write(piece)
                index += 1
                if progress:
                    progress(fin.tell(), total, fin.tell() / total)
        if not finished:
            raise ValueError("That export is cut short -- it didn't copy across whole.")


def export_locked(areas, dest, password, progress=None):
    """export(), then locked with the password: the zip is written beside
    the destination, sealed into it, and removed."""
    plain = dest + ".zip.part"
    lock_part = dest + ".part"

    def zip_progress(done, total, fraction):
        if progress:
            progress(done, total, fraction * 0.85)

    def lock_progress(done, total, fraction):
        if progress:
            progress(done, total, 0.85 + fraction * 0.15)
    try:
        res = export(areas, plain, zip_progress)
        manifest = read_manifest(plain)["manifest"]
        encrypt_file(plain, lock_part, password, manifest, lock_progress)
        os.replace(lock_part, dest)
    finally:
        for p in (plain, lock_part):
            try:
                os.remove(p)
            except OSError:
                pass
    res["path"] = dest
    res["locked"] = True
    return res


def import_locked(src, password, areas, backup_root, work_dir, progress=None):
    """Unlock a locked export into work_dir, import it, and remove the
    unlocked copy -- whatever happens."""
    os.makedirs(work_dir, exist_ok=True)
    plain = os.path.join(work_dir, "unlocked-%d.zip" % os.getpid())

    def unlock_progress(done, total, fraction):
        if progress:
            progress(done, total, fraction * 0.5)

    def import_progress(done, total, fraction):
        if progress:
            progress(done, total, 0.5 + fraction * 0.5)
    try:
        decrypt_file(src, plain, password, unlock_progress)
        return import_zip(plain, areas, backup_root, import_progress)
    except WrongPassword:
        return {"error": "That password doesn't open this export."}
    finally:
        try:
            os.remove(plain)
        except OSError:
            pass
