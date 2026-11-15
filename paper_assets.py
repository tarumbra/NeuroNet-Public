"""Assets, notebook covers and saved papers -- the files behind Creative ->
Assets and Creative -> Paper creator.

Cam (2026-10-03): "lets add a new feature called assets, This is where i can
go in and upload new assets into their respective categories or create them.
So for example all the assets used in scrapbook and boards (These assets can
then be used in projects straight from the app."

    neuronet_data/assets/assets.json        the index: {"assets": [...]}
    neuronet_data/assets/<id>.<ext>         each picture, exactly as it came
    neuronet_data/assets/<id>.design.json   one made in NeuroNet's editor, so
                                            it can be opened and changed again
    neuronet_data/notes/covers/<id>.json    a notebook cover (a board)
    neuronet_data/notes/paper/designs.json  papers Cam has saved

Kept apart from neuronet.py so the rules (what a category is, what a picture
may be, how big) are in one small file the tests read directly.
"""

import base64
import json
import os
import re
import struct
import uuid

CATEGORIES = [
    ("clipart", "Clip art"),
    ("stickers", "Stickers"),
    ("backgrounds", "Backgrounds & papers"),
    ("borders", "Borders & frames"),
    ("tapes", "Tapes & ribbons"),
    ("words", "Words & labels"),
    ("game", "Game assets"),
    # designs for the desktop's sticky notes (2026-10-05; Creative -> Vector's template)
    ("sticky", "Sticky notes"),
    ("other", "Other"),
]
# Cam (2026-10-04): "create a folder for in progress in there is where my
# current works in progress go. Once completed i can simply change location
# to completed works". Every asset is one or the other; uploads are finished.
STAGES = ("wip", "done")
# what made an asset, so Edit opens the right editor: Pixel art, Vector
EDITORS = ("pixel", "vector")
CATEGORY_KEYS = {k for k, _ in CATEGORIES}

# what a picture may be, by its data URL type -> the file's extension
KINDS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
}
EXT_TYPE = {v: k for k, v in KINDS.items()}
EXT_TYPE["jpeg"] = "image/jpeg"
MAX_BYTES = 25 * 1024 * 1024        # one picture; bought packs are big PNGs
ASSET_ID = re.compile(r"a[0-9a-f]{12}")


def _atomic_json(path, doc):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".part"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def _stamp():
    import datetime
    return datetime.datetime.now().isoformat(timespec="seconds")


# ------------------------------------------------------------------ sizes

def picture_size(data, ext):
    """Width and height from a picture's own header, or (0, 0). Only the
    header is read; nothing is decoded."""
    try:
        if ext == "png" and data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 24:
            return struct.unpack(">II", data[16:24])
        if ext == "gif" and data[:4] == b"GIF8" and len(data) >= 10:
            return struct.unpack("<HH", data[6:10])
        if ext == "webp" and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            chunk = data[12:16]
            if chunk == b"VP8X" and len(data) >= 30:
                w = 1 + int.from_bytes(data[24:27], "little")
                h = 1 + int.from_bytes(data[27:30], "little")
                return w, h
            if chunk == b"VP8 " and len(data) >= 30:
                w, h = struct.unpack("<HH", data[26:30])
                return w & 0x3FFF, h & 0x3FFF
            if chunk == b"VP8L" and len(data) >= 25:
                b = data[21:25]
                w = 1 + (((b[1] & 0x3F) << 8) | b[0])
                h = 1 + (((b[3] & 0xF) << 10) | (b[2] << 2) | ((b[1] & 0xC0) >> 6))
                return w, h
        if ext == "jpg" and data[:2] == b"\xff\xd8":
            i = 2
            while i + 9 < len(data):
                if data[i] != 0xFF:
                    i += 1
                    continue
                marker = data[i + 1]
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    h, w = struct.unpack(">HH", data[i + 5:i + 9])
                    return w, h
                seg = struct.unpack(">H", data[i + 2:i + 4])[0]
                i += 2 + seg
        if ext == "svg":
            head = data[:4000].decode("utf-8", "replace")
            m = re.search(r"viewBox\s*=\s*[\"']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)", head)
            if m:
                return round(float(m.group(1))), round(float(m.group(2)))
            mw = re.search(r"<svg[^>]*\swidth\s*=\s*[\"']([\d.]+)", head)
            mh = re.search(r"<svg[^>]*\sheight\s*=\s*[\"']([\d.]+)", head)
            if mw and mh:
                return round(float(mw.group(1))), round(float(mh.group(1)))
    except (struct.error, ValueError, IndexError):
        pass
    return 0, 0


def decode_data_url(url):
    """A picture's data URL -> (bytes, ext), or raises ValueError in words."""
    m = re.match(r"^data:([a-z/+.-]+)(;base64)?,(.*)$", str(url or ""), re.S | re.I)
    if not m:
        raise ValueError("That isn't a picture.")
    kind = m.group(1).lower()
    if kind not in KINDS:
        raise ValueError("Assets take PNG, JPEG, WebP, GIF or SVG pictures.")
    try:
        if m.group(2):
            data = base64.b64decode(m.group(3), validate=True)
        else:
            from urllib.parse import unquote_to_bytes
            data = unquote_to_bytes(m.group(3))
    except ValueError:
        raise ValueError("That picture is damaged.")
    if not data:
        raise ValueError("That picture is empty.")
    if len(data) > MAX_BYTES:
        raise ValueError("That picture is too big (25 MB at most).")
    ext = KINDS[kind]
    if ext == "svg" and b"<svg" not in data[:4000]:
        raise ValueError("That SVG has no picture in it.")
    if ext != "svg" and picture_size(data, ext) == (0, 0):
        raise ValueError("That picture is damaged.")
    return data, ext


# ------------------------------------------------------------------ assets

class Assets:
    def __init__(self, folder):
        self.folder = folder

    def _index_path(self):
        return os.path.join(self.folder, "assets.json")

    def index(self):
        try:
            with open(self._index_path(), encoding="utf-8") as f:
                doc = json.load(f)
            return [a for a in doc.get("assets", []) if isinstance(a, dict) and ASSET_ID.fullmatch(str(a.get("id", "")))]
        except (OSError, ValueError, AttributeError):
            return []

    def _save_index(self, items):
        _atomic_json(self._index_path(), {"assets": items})

    def _file(self, a):
        return os.path.join(self.folder, a["id"] + "." + a.get("ext", "png"))

    def thumbs_folder(self):
        return os.path.join(self.folder, ".thumbs")

    def thumb_path(self, asset_id, edge=200):
        """A small PNG of the asset for tiles and buttons (2026-10-06: tiles
        used to fetch the whole picture as text and shrink it in the page).
        Made once, remade when the asset changes; None for an SVG or without
        Pillow (the caller then sends the picture as before)."""
        a = self._find(asset_id)
        if not a or a.get("ext") == "svg":
            return None
        src = self._file(a)
        dest = os.path.join(self.thumbs_folder(), a["id"] + ".png")
        try:
            if not os.path.isfile(dest) or os.path.getmtime(dest) < os.path.getmtime(src):
                from PIL import Image
                os.makedirs(self.thumbs_folder(), exist_ok=True)
                img = Image.open(src)
                img = img.convert("RGBA") if img.mode not in ("RGB", "RGBA", "L", "LA") else img
                img.thumbnail((edge, edge), Image.LANCZOS)
                img.save(dest, "PNG", optimize=True)
            return dest
        except Exception:
            return None

    def list(self):
        """Every asset, newest first -- names and sizes, not the pictures
        (a bought pack can be hundreds of MB; each picture is fetched once
        it is on screen)."""
        out = []
        for a in self.index():
            if not os.path.isfile(self._file(a)):
                continue                               # a file gone: not offered
            out.append({"id": a["id"], "name": a.get("name") or "Asset", "cat": a.get("cat") or "other",
                        "ext": a.get("ext", "png"), "w": a.get("w", 0), "h": a.get("h", 0),
                        "made": a.get("made", ""), "design": bool(a.get("design")),
                        "kind": a.get("kind") or "", "stage": a.get("stage") if a.get("stage") in STAGES else "done",
                        "updated": a.get("updated") or a.get("made", "")})
        return {"categories": [{"key": k, "name": n} for k, n in CATEGORIES], "assets": out}

    def data(self, asset_id):
        a = self._find(asset_id)
        if not a:
            return {"error": "That asset is gone."}
        try:
            with open(self._file(a), "rb") as f:
                raw = f.read()
        except OSError:
            return {"error": "That asset's picture is gone."}
        kind = EXT_TYPE.get(a.get("ext", "png"), "image/png")
        return {"id": a["id"], "name": a.get("name") or "Asset", "w": a.get("w", 0), "h": a.get("h", 0),
                "dataUrl": "data:%s;base64,%s" % (kind, base64.b64encode(raw).decode("ascii"))}

    def _find(self, asset_id):
        aid = str(asset_id or "")
        if not ASSET_ID.fullmatch(aid):
            return None
        return next((a for a in self.index() if a["id"] == aid), None)

    def _store(self, data, ext, name, cat, design=None, size=None, stage="done"):
        if cat not in CATEGORY_KEYS:
            return {"error": "That isn't one of the asset categories."}
        if stage not in STAGES:
            return {"error": "An asset is either in progress or completed."}
        aid = "a" + uuid.uuid4().hex[:12]
        w, h = picture_size(data, ext)
        if (not w or not h) and size and len(size) == 2:
            try:
                w, h = int(size[0]), int(size[1])
            except (TypeError, ValueError):
                w, h = 0, 0
        entry = {"id": aid, "name": (str(name or "").strip()[:80] or "Asset"), "cat": cat,
                 "ext": ext, "w": w, "h": h, "made": _stamp(), "stage": stage}
        if isinstance(design, dict) and design.get("kind") in EDITORS:
            entry["kind"] = design["kind"]
        try:
            os.makedirs(self.folder, exist_ok=True)
            path = os.path.join(self.folder, aid + "." + ext)
            with open(path + ".part", "wb") as f:
                f.write(data)
            os.replace(path + ".part", path)
            if design is not None:
                _atomic_json(os.path.join(self.folder, aid + ".design.json"), design)
                entry["design"] = True
            self._save_index([entry] + self.index())
        except OSError as e:
            return {"error": "Couldn't save the asset: %s" % e}
        return {"ok": True, "id": aid, "asset": entry}

    def add(self, cat, name, data_url, design=None, size=None, stage="done"):
        """A picture (as a data URL) into a category, in progress or done."""
        try:
            data, ext = decode_data_url(data_url)
        except ValueError as e:
            return {"error": str(e)}
        if design is not None and not isinstance(design, dict):
            return {"error": "That design is damaged."}
        return self._store(data, ext, name, cat, design, size, stage or "done")

    def add_files(self, cat, paths):
        """Pictures from files on disk (the import dialog): each copied in as
        it is. Ones that aren't pictures are said, not dropped silently."""
        added, skipped = [], []
        for p in paths or []:
            base = os.path.basename(str(p))
            ext = os.path.splitext(base)[1].lower().lstrip(".")
            ext = "jpg" if ext == "jpeg" else ext
            if ext not in EXT_TYPE:
                skipped.append({"name": base, "why": "Not a PNG, JPEG, WebP, GIF or SVG picture."})
                continue
            try:
                if os.path.getsize(p) > MAX_BYTES:
                    skipped.append({"name": base, "why": "Bigger than 25 MB."})
                    continue
                with open(p, "rb") as f:
                    data = f.read()
            except OSError as e:
                skipped.append({"name": base, "why": str(e)})
                continue
            if ext != "svg" and picture_size(data, ext) == (0, 0):
                skipped.append({"name": base, "why": "The picture is damaged."})
                continue
            name = re.sub(r"[_-]+", " ", os.path.splitext(base)[0]).strip()
            res = self._store(data, ext, name, cat)
            if res.get("error"):
                skipped.append({"name": base, "why": res["error"]})
            else:
                added.append(res["id"])
        return {"ok": True, "added": added, "skipped": skipped}

    def update(self, asset_id, changes):
        """Rename, move to another category, or (from the editor) a new
        picture and design for one made in NeuroNet."""
        a = self._find(asset_id)
        if not a:
            return {"error": "That asset is gone."}
        changes = changes if isinstance(changes, dict) else {}
        items = self.index()
        entry = next(x for x in items if x["id"] == a["id"])
        if "name" in changes:
            entry["name"] = str(changes.get("name") or "").strip()[:80] or entry.get("name") or "Asset"
        if "cat" in changes:
            if changes["cat"] not in CATEGORY_KEYS:
                return {"error": "That isn't one of the asset categories."}
            entry["cat"] = changes["cat"]
        if "stage" in changes:
            if changes["stage"] not in STAGES:
                return {"error": "An asset is either in progress or completed."}
            entry["stage"] = changes["stage"]
        entry["updated"] = _stamp()
        try:
            if changes.get("dataUrl"):
                data, ext = decode_data_url(changes["dataUrl"])
                old = self._file(entry)
                entry["ext"] = ext
                new = self._file(entry)
                with open(new + ".part", "wb") as f:
                    f.write(data)
                os.replace(new + ".part", new)
                if old != new and os.path.exists(old):
                    os.remove(old)
                w, h = picture_size(data, ext)
                if w and h:
                    entry["w"], entry["h"] = w, h
            if isinstance(changes.get("design"), dict):
                _atomic_json(os.path.join(self.folder, entry["id"] + ".design.json"), changes["design"])
                entry["design"] = True
                if changes["design"].get("kind") in EDITORS:
                    entry["kind"] = changes["design"]["kind"]
            self._save_index(items)
        except ValueError as e:
            return {"error": str(e)}
        except OSError as e:
            return {"error": "Couldn't change the asset: %s" % e}
        return {"ok": True, "asset": entry}

    def design(self, asset_id):
        a = self._find(asset_id)
        if not a or not a.get("design"):
            return {"error": "That asset wasn't made in NeuroNet, so there's no design to open."}
        try:
            with open(os.path.join(self.folder, a["id"] + ".design.json"), encoding="utf-8") as f:
                return {"design": json.load(f)}
        except (OSError, ValueError) as e:
            return {"error": "The design couldn't be read: %s" % e}

    def delete(self, asset_id):
        a = self._find(asset_id)
        if not a:
            return {"ok": True}
        try:
            self._save_index([x for x in self.index() if x["id"] != a["id"]])
            for path in (self._file(a), os.path.join(self.folder, a["id"] + ".design.json")):
                if os.path.exists(path):
                    os.remove(path)
        except OSError as e:
            return {"error": "Couldn't delete the asset: %s" % e}
        return {"ok": True}


# ------------------------------------------------------------- saved papers

def read_designs(path):
    try:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
        return {"designs": [d for d in doc.get("designs", []) if isinstance(d, dict) and d.get("name")]}
    except (OSError, ValueError, AttributeError):
        return {"designs": []}


def write_designs(path, designs):
    if not isinstance(designs, list) or not all(isinstance(d, dict) for d in designs):
        return {"error": "Those papers are damaged."}
    try:
        _atomic_json(path, {"designs": designs[:200]})
    except OSError as e:
        return {"error": "Couldn't save your papers: %s" % e}
    return {"ok": True}


# ------------------------------------------------------------------ covers

def list_covers(folder):
    """Every notebook cover, newest first, for the Covers shelf."""
    out = []
    try:
        names = os.listdir(folder)
    except OSError:
        return out
    for name in names:
        if not name.endswith(".json"):
            continue
        try:
            with open(os.path.join(folder, name), encoding="utf-8") as f:
                doc = json.load(f)
            if not isinstance(doc, dict):
                raise ValueError("not a cover")
        except (OSError, ValueError):
            out.append({"id": name[:-5], "name": name[:-5], "error": "This cover could not be read.", "updated": ""})
            continue
        out.append({"id": name[:-5], "name": doc.get("name") or "Cover", "spec": doc.get("spec") or {},
                    "w": doc.get("w") or 0, "h": doc.get("h") or 0,
                    "pages": len(doc.get("pages") or [{}]), "updated": doc.get("updated") or ""})
    out.sort(key=lambda b: b.get("updated") or "", reverse=True)
    return out


# ------------------------------------------------------- pixel-art palettes

def read_palettes(path):
    """Palettes Cam made or imported in Pixel art: [{name, colours}]."""
    try:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
        out = []
        for p in doc.get("palettes", []):
            cols = [c for c in (p.get("colours") or []) if isinstance(c, str) and re.fullmatch(r"#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?", c)]
            if p.get("name"):
                out.append({"name": str(p["name"])[:60], "colours": cols[:256]})
        return {"palettes": out}
    except (OSError, ValueError, AttributeError):
        return {"palettes": []}


def write_palettes(path, palettes):
    if not isinstance(palettes, list) or not all(isinstance(p, dict) for p in palettes):
        return {"error": "Those palettes are damaged."}
    try:
        _atomic_json(path, {"palettes": palettes[:100]})
    except OSError as e:
        return {"error": "Couldn't save your palettes: %s" % e}
    return {"ok": True}


def write_b64_file(path, b64):
    """An exported file (PNG, .aseprite, .gpl) written where Cam chose."""
    try:
        data = base64.b64decode(str(b64 or ""), validate=True)
    except ValueError:
        return {"error": "That file is damaged."}
    if not data:
        return {"error": "There's nothing to save."}
    try:
        tmp = path + ".part"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, path)
    except OSError as e:
        return {"error": "Couldn't save it: %s" % e}
    return {"ok": True, "path": path, "bytes": len(data)}
