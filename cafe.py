"""NeuroCafe -- where the cafe is kept (neuronet_data/cafe/cafe.json).

Cam (2026-10-20, V19): a Cafeland-style cafe game, its own app like NeuroPets.
THE RULES ARE NOT HERE -- they're ui/cafe/cafecore.js. The page applies an
action and hands the result here to keep: checked, written safely, the
previous copy kept as cafe.json.bak.
"""
import json
import io
import os
import shutil
import tempfile

#: Provides the NeuroNet data folder. Set by neurocafe.py; tests point it at a scratch folder.
DATA_DIR_PROVIDER = None
MAX_BYTES = 512 * 1024


def root():
    d = os.path.join(DATA_DIR_PROVIDER(), "cafe")
    os.makedirs(d, exist_ok=True)
    return d


#: The saves: your cafe, and the sandbox (2026-10-21, PT41-PT43: a cafe to try things in with the dev tools).
SLOTS = {"main": "cafe.json", "sandbox": "cafe-sandbox.json"}


def path(slot="main"):
    return os.path.join(root(), SLOTS.get(slot) or SLOTS["main"])


def empty():
    return {"v": 1, "game": "neurocafe", "log": []}


def load(slot="main"):
    """The saved cafe (or the sandbox), or a new one."""
    if slot not in SLOTS:
        return {"error": "There's no such save."}
    for p in (path(slot), path(slot) + ".bak"):
        try:
            with open(p, encoding="utf-8") as f:
                s = json.load(f)
            if isinstance(s, dict):
                return s
        except FileNotFoundError:
            if p == path(slot) and not os.path.exists(path(slot) + ".bak"):
                return empty()
        except (OSError, ValueError, RecursionError):      # (2026-10-26: a save nested thousands deep is damaged, not a crash)
            continue
    return empty()


def check(state):
    if not isinstance(state, dict) or state.get("v") != 1 or state.get("game") != "neurocafe":
        return "That isn't a NeuroCafe save."
    if not isinstance(state.get("log", []), list):
        return "The cafe's diary is damaged."
    if not isinstance(state.get("items", []), list) or not isinstance(state.get("ware", {}), dict):
        return "The cafe's floor is damaged."
    if not isinstance(state.get("coins", 0), (int, float)):
        return "The cafe's coins are damaged."
    return None


def save(state, slot="main"):
    if slot not in SLOTS:
        return {"error": "There's no such save."}
    err = check(state)
    if err:
        return {"error": err}
    # the sandbox's dev tools never reach your cafe: a sandbox save only goes in the sandbox, and back
    if bool(state.get("sandbox")) != (slot == "sandbox"):
        return {"error": "That save belongs in the other cafe."}
    text = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    if len(text.encode("utf-8")) > MAX_BYTES:
        return {"error": "The cafe's save is too big."}
    target = path(slot)
    fd, tmp = tempfile.mkstemp(dir=root(), prefix=".cafe-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        if os.path.exists(target):
            shutil.copyfile(target, target + ".bak")
        os.replace(tmp, target)
    except OSError:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    return {"ok": True}


# ---- your photos in frames (Cam, 2026-10-24: "turn our photos into photo frames within the game") -------------------
# The page shrinks a photo you pick (at most 640px, a JPEG) and hands it here; it's kept as <data>/cafe/photos/<id>.jpg
# -- not in the save, which stays small -- and given back to the page as data addresses when it opens.
PHOTO_MAX = 600 * 1024
PHOTO_PREFIX = "data:image/jpeg;base64,"


def photos_dir():
    d = os.path.join(root(), "photos")
    os.makedirs(d, exist_ok=True)
    return d


def _photo_id_ok(pid):
    return isinstance(pid, str) and 6 <= len(pid) <= 40 and all(c.isalnum() or c == "-" for c in pid)


def photo_add(data_url):
    """A photo (a JPEG data address) kept: {"id"} -- or {"error"}."""
    import base64
    import uuid
    if not isinstance(data_url, str) or not data_url.startswith(PHOTO_PREFIX):
        return {"error": "That isn't a picture NeuroCafe can keep."}
    if len(data_url) > len(PHOTO_PREFIX) + (PHOTO_MAX * 4) // 3 + 8:     # (too big to keep: not even decoded -- 2026-10-25)
        return {"error": "That picture is too big, or not a JPEG."}
    try:
        raw = base64.b64decode(data_url[len(PHOTO_PREFIX):], validate=True)
    except ValueError:
        return {"error": "That picture is damaged."}
    if len(raw) > PHOTO_MAX or raw[:3] != b"\xff\xd8\xff":
        return {"error": "That picture is too big, or not a JPEG."}
    pid = uuid.uuid4().hex[:12]
    with open(os.path.join(photos_dir(), pid + ".jpg"), "wb") as f:
        f.write(raw)
    return {"id": pid}


def photos():
    """Every kept photo: {id: data address}."""
    import base64
    out = {}
    for name in sorted(os.listdir(photos_dir())):
        pid, ext = os.path.splitext(name)
        if ext != ".jpg" or not _photo_id_ok(pid):
            continue
        try:
            with open(os.path.join(photos_dir(), name), "rb") as f:
                out[pid] = PHOTO_PREFIX + base64.b64encode(f.read()).decode("ascii")
        except OSError:
            continue
    return out


def photo_delete(pid):
    if not _photo_id_ok(pid):
        return {"error": "There's no such photo."}
    try:
        os.remove(os.path.join(photos_dir(), pid + ".jpg"))
    except FileNotFoundError:
        pass
    return {"ok": True}


# ---- the jukebox's music (PT56 / Q8, Cam: "a music selector ... the ability to add other music, playlist (which is a
# folder that contains music and the game will play each song in the folder once then restart)"). The café radio is the
# game's own lofi and whatever is in <data>/cafe/music; a playlist is a folder you picked, kept by its path in
# playlists.json. Only the songs straight in a folder count (not its subfolders). The game plays them through
# NeuroNet's loopback media server (neurocafe.py), so nothing here is read but the names.
MUSIC_EXTS = (".mp3", ".ogg", ".oga", ".opus", ".wav", ".flac", ".m4a", ".aac", ".weba")


# ---- V25 q5 (N56): the tarot frames' cards, from the person's own decks in NeuroNet's card library --------------------
# Published decks (Old School Tarot, Murder of Crows): read from this computer's NeuroNet data when the game opens,
# never copied into the game's files or a release. Each card a small JPEG data address, made once and kept.
MAJOR = ["The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor", "The Hierophant", "The Lovers", "The Chariot",
         "Strength", "The Hermit", "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance", "The Devil", "The Tower",
         "The Star", "The Moon", "The Sun", "Judgement", "The World"]
DECKS = {"oldschool": ("cards/images", "Old School Tarot {}.jpg"), "crows": ("photos", "Murder Of Crows - {}.jpg")}
CARD_H = 240
_card_cache = {}


def _thumb(path):
    import base64
    from PIL import Image
    key = (path, os.path.getmtime(path))
    if key not in _card_cache:
        im = Image.open(path).convert("RGB")
        im.thumbnail((CARD_H, CARD_H), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=82)
        _card_cache[key] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    return _card_cache[key]


def cards():
    """{deck: {card name: data address}} -- the Major Arcana found in each deck on this computer (none: {})."""
    out = {}
    base = DATA_DIR_PROVIDER()
    for deck, (folder, pattern) in DECKS.items():
        found = {}
        for name in MAJOR:
            path = os.path.join(base, folder, pattern.format(name))
            if os.path.isfile(path):
                try:
                    found[name] = _thumb(path)
                except Exception:
                    pass
        if found:
            out[deck] = found
    return out


def music_dir():
    d = os.path.join(root(), "music")
    os.makedirs(d, exist_ok=True)
    return d


def songs(folder):
    """The songs straight in a folder, in name order ("2 ..." before "10 ...")."""
    import re
    try:
        names = [n for n in os.listdir(folder) if n.lower().endswith(MUSIC_EXTS) and os.path.isfile(os.path.join(folder, n))]
    except OSError:
        return []
    return sorted(names, key=lambda n: [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", n)])


def _playlists_path():
    return os.path.join(root(), "playlists.json")


def playlists():
    """[{id, name, path}] -- the folders you've added, oldest first."""
    try:
        with open(_playlists_path(), encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError, RecursionError):
        return []
    return [p for p in data if isinstance(p, dict) and _photo_id_ok(p.get("id")) and isinstance(p.get("path"), str)] if isinstance(data, list) else []


def _write_playlists(items):
    with tempfile.NamedTemporaryFile("w", dir=root(), delete=False, encoding="utf-8", suffix=".tmp") as f:
        json.dump(items, f, indent=1)
        tmp = f.name
    os.replace(tmp, _playlists_path())


def playlist_add(folder):
    """A folder kept as a playlist, named after it: {"id"} -- or {"error"}."""
    import uuid
    folder = os.path.abspath(str(folder or ""))
    if not os.path.isdir(folder):
        return {"error": "That folder isn't there."}
    items = playlists()
    for p in items:
        if p["path"] == folder:
            return {"id": p["id"]}
    if not songs(folder):
        return {"error": "There's no music straight in that folder (mp3, ogg, flac, wav, m4a...)."}
    pid = uuid.uuid4().hex[:12]
    items.append({"id": pid, "name": os.path.basename(folder.rstrip(os.sep)) or folder, "path": folder})
    _write_playlists(items)
    return {"id": pid}


def playlist_remove(pid):
    """A playlist forgotten (its folder and songs are left alone)."""
    _write_playlists([p for p in playlists() if p["id"] != pid])
    return {"ok": True}
