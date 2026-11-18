"""NeuroPet (was Pixel Pet) -- where the pet is kept (neuronet_data/pet/pet.json).

Cam (2026-10-03, Notes -> Vault -> "Pixel Pet Feature"): a Tamagotchi-style
pet that grows into an idle game -- expeditions, skills, a village -- built
"slowly ... in a logical order". Slice 1 is the pet itself.

THE RULES ARE NOT HERE. They are ui/pet/petcore.js, which the game's page
runs. It applies an action (feed, play, ...) with petcore and hands the
result here to keep. This module checks the shape,
writes it safely and keeps the previous copy.
"""
import json
import os
import shutil
import tempfile

#: Provides the NeuroNet data folder. Set by neuronet.py; tests point it at a
#: scratch folder.
DATA_DIR_PROVIDER = None

MAX_BYTES = 256 * 1024
STATS = ("full", "happy", "energy", "clean", "health")


def root():
    d = os.path.join(DATA_DIR_PROVIDER(), "pet")
    os.makedirs(d, exist_ok=True)
    return d


SLOTS = {"main": "pet.json", "dev": "pet-dev.json"}
# Two sandboxes (2026-10-15, Cam: "add to saves in dev mode. One with everything unlocked. The other with the ability to add
# items to a plain account, this will allow me to test across a multitude of environments"). "dev" is whichever is in use:
# "max" -- everything unlocked (the sandbox as it always was, pet-dev.json) or "plain" -- the game's own rules (arrows run
# out, weapons break), with Dev tools to add things. sandbox.json remembers which.
SANDBOXES = {"max": "pet-dev.json", "plain": "pet-dev-plain.json"}


def sandbox_kind():
    got = _read(os.path.join(root(), "sandbox.json")) or {}
    return got.get("kind") if got.get("kind") in SANDBOXES else "max"


def sandbox_use(kind):
    """Switch which sandbox "dev" is. Its save is kept as it was; a new one starts empty (the page fills it)."""
    if kind not in SANDBOXES:
        return {"error": "There's no sandbox like that."}
    _write(os.path.join(root(), "sandbox.json"), json.dumps({"kind": kind}))
    return {"ok": True, "kind": kind, "exists": os.path.exists(os.path.join(root(), SANDBOXES[kind]))}


def path(slot="main"):
    """The save: "main" is Cam's game; "dev" is the Developer sandbox in use (a copy to test in)."""
    if slot == "dev":
        return os.path.join(root(), SANDBOXES[sandbox_kind()])
    return os.path.join(root(), SLOTS.get(slot, "pet.json"))


def empty():
    return {"v": 1, "pet": None, "log": []}


def load(slot="main"):
    """The saved state, or an empty one (no pet yet) if there isn't one."""
    try:
        with open(path(slot), encoding="utf-8") as f:
            s = json.load(f)
    except FileNotFoundError:
        return empty()
    except (OSError, ValueError):
        # a damaged file: the copy from before the last save, if it reads
        try:
            with open(path(slot) + ".bak", encoding="utf-8") as f:
                s = json.load(f)
        except (OSError, ValueError):
            return empty()
    return s if isinstance(s, dict) else empty()


def check(state):
    """None if `state` is a pet state worth keeping, else what's wrong."""
    v = state.get("v") if isinstance(state, dict) else None
    # v is the save's migration number (2026-10-10, audit M-5): 1 before numbered migrations, higher after
    if not isinstance(v, int) or isinstance(v, bool) or v < 1 or state.get("game") == "neurofarm":
        return "That isn't a NeuroPets save."
    if not isinstance(state.get("log", []), list):
        return "The pet's diary is damaged."
    p = state.get("pet")
    if p is None:
        return None
    if not isinstance(p, dict) or not isinstance(p.get("name"), str) or not p.get("species"):
        return "The pet is missing its name or kind."
    for k in ("born", "hatchAt", "at"):
        if not isinstance(p.get(k), (int, float)):
            return "The pet is missing its times."
    s = p.get("s")
    if not isinstance(s, dict) or any(not isinstance(s.get(k), (int, float)) or not 0 <= s[k] <= 100 for k in STATS):
        return "The pet's stats are out of range."
    return None


def save(state, slot="main"):
    """Keeps `state` (from petcore.act). The file before it is kept as pet.json.bak."""
    err = check(state)
    if slot == "main" and isinstance(state, dict) and isinstance(state.get("dev"), dict) and state["dev"].get("on"):
        return {"error": "A sandbox game can't be saved over the real one."}
    if err:
        return {"error": err}
    text = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    if len(text.encode("utf-8")) > MAX_BYTES:
        return {"error": "The pet's save is too big."}
    target = path(slot)
    fd, tmp = tempfile.mkstemp(dir=root(), prefix=".pet-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        if os.path.exists(target):
            shutil.copyfile(target, target + ".bak")   # copied, so pet.json is never missing
        os.replace(tmp, target)
    except OSError:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    return {"ok": True}


# ---- save slots (2026-10-07, Cam: "3 save slots to play different characters at a time") -----------------------
# pet.json is always the game being played -- everything else reads it. The other
# slots wait in pet-slot<n>.json; switching parks the current game in its own slot file and brings the other in.
# slots.json says which slot pet.json is.
SLOT_COUNT = 3


def _meta_path():
    return os.path.join(root(), "slots.json")


def active_slot():
    try:
        with open(_meta_path(), encoding="utf-8") as f:
            n = int(json.load(f).get("active", 1))
        return n if 1 <= n <= SLOT_COUNT else 1
    except (OSError, ValueError, TypeError, AttributeError):
        return 1


def _slot_file(n):
    return os.path.join(root(), "pet-slot%d.json" % n)


def _write(target, text):
    fd, tmp = tempfile.mkstemp(dir=root(), prefix=".pet-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, target)
    except OSError:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def _read(p):
    try:
        with open(p, encoding="utf-8") as f:
            s = json.load(f)
        return s if isinstance(s, dict) else None
    except (OSError, ValueError):
        return None


# ---- the game's own settings (2026-10-08): the window runs in private mode, so the page can't keep them -----------
# settings.json: what Cam hides (sidebar, modder, new game buttons, sandbox switch, the daily save slots screen)
# and the day NeuroPets last started, so the save slots show on the first start of a day.
SETTINGS = {"sidebar": True, "modder": True, "newGame": True, "sandbox": True, "dailySaves": True, "dayNight": True, "deepNight": False, "kit": False}


def _settings_path():
    return os.path.join(root(), "settings.json")


def settings():
    got = _read(_settings_path()) or {}
    out = dict(SETTINGS)
    out.update({k: bool(got[k]) for k in SETTINGS if k in got})
    out["lastStart"] = str(got.get("lastStart", ""))[:10]
    return out


def save_settings(d):
    """Keep the known switches only (True/False)."""
    cur = settings()
    if isinstance(d, dict):
        cur.update({k: bool(d[k]) for k in SETTINGS if k in d})
    os.makedirs(root(), exist_ok=True)
    _write(_settings_path(), json.dumps(cur, indent=1))
    return cur


def first_start_today(today):
    """True the first time the game starts on `today` (YYYY-MM-DD); remembers it."""
    cur = settings()
    if cur.get("lastStart") == today:
        return False
    cur["lastStart"] = today
    os.makedirs(root(), exist_ok=True)
    _write(_settings_path(), json.dumps(cur, indent=1))
    return True


def slots():
    """Every slot's game (None for an empty one), and which is being played."""
    a = active_slot()
    out = []
    for n in range(1, SLOT_COUNT + 1):
        out.append(load("main") if n == a else _read(_slot_file(n)))
    return {"active": a, "slots": out}


def switch(n):
    """Play slot `n`: the current game goes back to its slot file, `n`'s comes in. Returns the new game."""
    n = int(n)
    if not 1 <= n <= SLOT_COUNT:
        return {"error": "There's no slot like that."}
    a = active_slot()
    if n == a:
        return load("main")
    cur = path("main")
    if os.path.exists(cur):
        shutil.copyfile(cur, _slot_file(a))
    else:
        _write(_slot_file(a), json.dumps(empty()))
    nxt = _read(_slot_file(n)) or empty()
    _write(cur, json.dumps(nxt, ensure_ascii=False, separators=(",", ":")))
    _write(_meta_path(), json.dumps({"active": n}))
    return load("main")


def new_game(n, state):
    """Start `state` (a new game, from petcore) in slot `n` -- over whatever was there -- and play it."""
    n = int(n)
    if not 1 <= n <= SLOT_COUNT:
        return {"error": "There's no slot like that."}
    err = check(state)
    if err:
        return {"error": err}
    text = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    if len(text.encode("utf-8")) > MAX_BYTES:
        return {"error": "The pet's save is too big."}
    if n == active_slot():
        r = save(state, "main")
        if r.get("error"):
            return r
        return load("main")
    _write(_slot_file(n), text)
    return switch(n)


def clear_slot(n):
    """Empty slot `n` (not the one being played)."""
    n = int(n)
    if not 1 <= n <= SLOT_COUNT:
        return {"error": "There's no slot like that."}
    if n == active_slot():
        return {"error": "That's the game you're playing -- switch to another slot first."}
    p = _slot_file(n)
    if os.path.exists(p):
        shutil.copyfile(p, p + ".bak")
        os.remove(p)
    return {"ok": True}


# ---- mod packs (2026-10-07, Cam: "an inbuilt modders tool ... These can then be saved and when starting a new game
#      you should be able to select a mod pack") -- neuronet_data/pet/mods/<id>.json: a name, rates, pets (colours,
#      buffs), and pictures for items, creatures and regions (data: URLs, PNG). ------------------------------------
import re  # noqa: E402

MOD_MAX_BYTES = 12 * 1024 * 1024
MOD_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,40}")
_PNG_URL = re.compile(r"data:image/(png|webp|jpeg|gif);base64,[A-Za-z0-9+/=]+")


def mods_dir():
    d = os.path.join(root(), "mods")
    os.makedirs(d, exist_ok=True)
    return d


def _mod_path(mod_id):
    return os.path.join(mods_dir(), mod_id + ".json")


def mods():
    """Every mod pack: its name and what it changes (not the pictures)."""
    out = []
    for f in sorted(os.listdir(mods_dir())):
        if not f.endswith(".json"):
            continue
        m = _read(os.path.join(mods_dir(), f))
        if not m or not MOD_ID.fullmatch(str(m.get("id", ""))):
            continue
        out.append({"id": m["id"], "name": str(m.get("name") or m["id"]), "about": str(m.get("about") or ""),
                    "rates": m.get("rates") or {}, "pets": len(m.get("pets") or {}),
                    "pictures": sum(len(m.get(k) or {}) for k in ("items", "monsters", "regions"))})
    return out


def mod_load(mod_id):
    mod_id = str(mod_id or "")
    if not MOD_ID.fullmatch(mod_id):
        return {"error": "There's no mod pack like that."}
    return _read(_mod_path(mod_id)) or {"error": "That mod pack is gone."}


def _clean_pictures(d):
    out = {}
    for k, v in (d or {}).items() if isinstance(d, dict) else []:
        if isinstance(k, str) and re.fullmatch(r"[a-z0-9_/-]{1,60}", k) and isinstance(v, str) and _PNG_URL.fullmatch(v):
            out[k] = v
    return out


def mod_save(doc):
    """Keep a mod pack. A new one gets its id from its name."""
    if not isinstance(doc, dict):
        return {"error": "That isn't a mod pack."}
    name = str(doc.get("name") or "").strip()[:80]
    if not name:
        return {"error": "Give the mod pack a name."}
    mod_id = str(doc.get("id") or "")
    if not MOD_ID.fullmatch(mod_id):
        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:30] or "mod"
        mod_id, n = base, 2
        while os.path.exists(_mod_path(mod_id)):
            mod_id = "%s-%d" % (base, n)
            n += 1
    rates = {}
    for k, v in (doc.get("rates") or {}).items():
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        if isinstance(k, str) and 0 < f <= 20:
            rates[k[:20]] = round(f, 2)
    pets = doc.get("pets") if isinstance(doc.get("pets"), dict) else {}
    clean = {"id": mod_id, "name": name, "about": str(doc.get("about") or "")[:400], "v": 1, "rates": rates, "pets": pets,
             "items": _clean_pictures(doc.get("items")), "monsters": _clean_pictures(doc.get("monsters")),
             "regions": _clean_pictures(doc.get("regions"))}
    text = json.dumps(clean, ensure_ascii=False, separators=(",", ":"))
    if len(text.encode("utf-8")) > MOD_MAX_BYTES:
        return {"error": "The mod pack is too big (its pictures) -- 12 MB at most."}
    _write(_mod_path(mod_id), text)
    return {"ok": True, "id": mod_id}


def mod_delete(mod_id):
    mod_id = str(mod_id or "")
    if not MOD_ID.fullmatch(mod_id) or not os.path.exists(_mod_path(mod_id)):
        return {"error": "There's no mod pack like that."}
    os.remove(_mod_path(mod_id))
    return {"ok": True}


# ---- the place editor (2026-10-15, audit FUT-2) -------------------------------------------------------------------------
# Where each place is painted on its scene lives in ui/pet/art/places.js (window.SCENE_PLACES = {...}): the game loads it
# like the art manifests, and Developer -> Place editor writes it here. Only the shape below is ever written.
PLACE_KEY = re.compile(r"[A-Za-z0-9:@#_.-]{1,60}")
PLACES_HEAD = """// NeuroPets -- where each place is painted on its scene (moved out of pet.js 2026-10-15 for the place editor).
// Written by Developer -> Place editor (pet.places_text); everything after "window.SCENE_PLACES = " is JSON.
// Each scene is a 2000x1116 picture (art/<scene>.webp). A place: "at" = [middle x, middle y, width, height (56 if left
// out)] of its painted scroll, "o" = the middle of the painted thing it names (a click there counts too), "chip" = not
// painted (a secret found later): drawn as a little scroll of its own. Keys: "skill:spot" for gathering spots; hunt /
// boss / exp / person for a region's ground, boss, expedition and person; page keys (pet:...) or village people
// elsewhere; "#2" = the same place painted twice. "//" holds notes about each scene.
"""


def places_check(doc):
    """The places, cleaned -- or raises ValueError saying what's wrong."""
    if not isinstance(doc, dict) or not doc:
        raise ValueError("The places should be a list of scenes.")
    out = {}
    notes = doc.get("//") or {}
    if not isinstance(notes, dict):
        raise ValueError("The scene notes are the wrong shape.")
    out["//"] = {str(k)[:60]: (str(v) if not isinstance(v, list) else [str(x) for x in v][:20]) for k, v in notes.items()}

    def nums(v, n, what):
        if not isinstance(v, list) or len(v) not in n or not all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in v):
            raise ValueError(what)
        if not all(-500 <= x <= 4000 for x in v):
            raise ValueError(what + " (off the picture)")
        return [int(round(x)) for x in v]
    for scene, places in doc.items():
        if scene == "//":
            continue
        if not PLACE_KEY.fullmatch(str(scene)) or not isinstance(places, dict):
            raise ValueError("A scene called %r isn't right." % scene)
        clean = {}
        for key, p in places.items():
            if not PLACE_KEY.fullmatch(str(key)) or not isinstance(p, dict) or set(p) - {"at", "o", "chip"}:
                raise ValueError("%s: the place %r isn't right." % (scene, key))
            c = {"at": nums(p.get("at"), (3, 4), "%s / %s: where its scroll is should be 3 or 4 numbers" % (scene, key))}
            if "o" in p:
                c["o"] = nums(p["o"], (2,), "%s / %s: the painted thing should be 2 numbers" % (scene, key))
            if "chip" in p:
                c["chip"] = str(p["chip"])[:40]
            clean[str(key)] = c
        out[str(scene)] = clean
    return out


def places_text(doc):
    """places.js: a scene to a line, then a place to a line."""
    d = places_check(doc)
    one = lambda v: json.dumps(v, ensure_ascii=False, separators=(", ", ": "))
    lines = ['  "//": {\n' + ",\n".join("    %s: %s" % (json.dumps(k), one(v)) for k, v in d["//"].items()) + "\n  }"]
    for scene, places in d.items():
        if scene == "//":
            continue
        lines.append("  %s: {\n" % json.dumps(scene) + ",\n".join("    %s: %s" % (json.dumps(k), one(v)) for k, v in places.items()) + "\n  }")
    return PLACES_HEAD + "window.SCENE_PLACES = {\n" + ",\n".join(lines) + "\n};\n"


def places_read(path):
    """The places in a places.js."""
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    start = "\nwindow.SCENE_PLACES = "
    body = text[text.index(start) + len(start):].rstrip().rstrip(";")
    return json.loads(body)


def places_write(path, doc):
    """Check and write places.js (the old one kept as places.js.bak)."""
    text = places_text(doc)
    d = os.path.dirname(path)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".places-", suffix=".js")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        if os.path.exists(path):
            shutil.copyfile(path, path + ".bak")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    return {"ok": True}
