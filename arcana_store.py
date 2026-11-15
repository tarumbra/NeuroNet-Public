"""NeuroArcana's keeping side inside NeuroNet -- the saves, the profiles, the achievement diary and the card catalogue.

The game itself is its own project (~/Work/NeuroArcana, Electron); NeuroNet carries a copy of its page (ui/arcana/,
ui/neuroarcana.html) and its card art (ui/arcana-art/) so every NeuroNet computer can play it (Cam, 1 Nov 2026: "push and
release this so I can install on my other pc and laptop"). This is the Electron shell's shell/store.js in Python, file
for file the same layout, so a save moves between the two:

    <data>/profiles.json               the saves: which is open, names, difficulty, pictures
    <data>/profiles/<id>.json (+ .bak) each save; deleted ones kept in profiles/deleted/
    <data>/achievements.json           the achievement diary, every save
    <data> = $AA_DATA, else $XDG_DATA_HOME/NeuroArcana (~/.local/share/NeuroArcana)

THE RULES ARE NOT HERE: ui/arcana/core.js.
"""
import json
import os
import re
import secrets
import shutil
import time

MAX_BYTES = 2 * 1024 * 1024
ID = re.compile(r"^p[0-9]{1,6}$")
DIFFS = ("free", "easy", "normal", "hard")
ACH_ID = re.compile(r"^[a-z0-9-]{1,60}$")


def data_dir():
    d = os.environ.get("AA_DATA") or os.path.join(os.environ.get("XDG_DATA_HOME") or os.path.join(os.path.expanduser("~"), ".local", "share"), "NeuroArcana")
    os.makedirs(d, exist_ok=True)
    return d


def _dir(*parts):
    d = os.path.join(data_dir(), *parts)
    os.makedirs(d, exist_ok=True)
    return d


def empty():
    return {"v": 1, "game": "neuroarcana"}


def _write(path, text):
    tmp = os.path.join(os.path.dirname(path), ".arcana-" + secrets.token_hex(6) + ".json")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def clean_name(n):
    return re.sub(r"\s+", " ", re.sub(r"[\x00-\x1f]", "", str(n or ""))).strip()[:30]


def clean_face(f):
    if isinstance(f, str) and (re.match(r"^[a-z0-9-]{1,60}:[a-z0-9_]{1,60}$", f) or re.match(r"^ach:[a-z0-9-]{1,60}:(easy|normal|hard)$", f)):
        return f
    return None


def clean_diff(d, kind=None):
    return d if d in DIFFS else ("free" if kind == "sandbox" else "normal")


# ---- the profiles ----
def _index_path():
    return os.path.join(data_dir(), "profiles.json")


def _profile_path(pid):
    return os.path.join(_dir("profiles"), pid + ".json")


def _write_index(x):
    _write(_index_path(), json.dumps(x, indent=1))


def read_index():
    try:
        with open(_index_path(), encoding="utf-8") as f:
            x = json.load(f)
    except (OSError, ValueError):
        x = None
    if not isinstance(x, dict) or not isinstance(x.get("list"), list):
        # the first run with profiles: a single old save (arcana.json) moves in as p1
        old = os.path.join(data_dir(), "arcana.json")
        kind, made = "normal", False
        if os.path.isfile(old):
            try:
                with open(old, encoding="utf-8") as f:
                    s0 = json.load(f)
                kind = "sandbox" if s0.get("sandbox") else "normal"
                made = bool(s0.get("made"))
            except (OSError, ValueError, AttributeError):
                pass
            shutil.copyfile(old, _profile_path("p1"))
        x = {"active": "p1", "list": [{"id": "p1", "name": ("Sandbox" if kind == "sandbox" else "My collection") if made else "Seeker",
                                       "kind": kind, "face": None, "created": time.strftime("%Y-%m-%dT%H:%M:%S")}]}
        _write_index(x)
    out = []
    for p in x["list"]:
        if not isinstance(p, dict) or not ID.match(str(p.get("id", ""))):
            continue
        diff = clean_diff(p.get("diff"), p.get("kind"))
        out.append({"id": p["id"], "name": clean_name(p.get("name")) or "Seeker", "diff": diff, "kind": "sandbox" if diff == "free" else "normal",
                    "face": clean_face(p.get("face")), "created": str(p.get("created") or "")})
    if not out:
        out = [{"id": "p1", "name": "Seeker", "diff": "normal", "kind": "normal", "face": None, "created": time.strftime("%Y-%m-%dT%H:%M:%S")}]
    active = x.get("active") if any(p["id"] == x.get("active") for p in out) else out[0]["id"]
    return {"active": active, "list": out}


def profiles():
    x = read_index()
    return {"active": x["active"], "list": x["list"]}


def profile_use(pid):
    x = read_index()
    if not any(p["id"] == pid for p in x["list"]):
        return {"error": "There's no such save."}
    x["active"] = pid
    _write_index(x)
    return profiles()


def profile_new(meta):
    meta = meta if isinstance(meta, dict) else {}
    x = read_index()
    if len(x["list"]) >= 12:
        return {"error": "Twelve saves is the most."}
    n = 1
    while any(p["id"] == "p%d" % n for p in x["list"]) or os.path.isfile(_profile_path("p%d" % n)):
        n += 1
    pid = "p%d" % n
    with open(_profile_path(pid), "w", encoding="utf-8") as f:
        json.dump(empty(), f)
    diff = clean_diff(meta.get("diff"), meta.get("kind"))
    x["list"].append({"id": pid, "name": clean_name(meta.get("name")) or "Seeker", "diff": diff, "kind": "sandbox" if diff == "free" else "normal",
                      "face": clean_face(meta.get("face")), "created": time.strftime("%Y-%m-%dT%H:%M:%S")})
    x["active"] = pid
    _write_index(x)
    return profiles()


def profile_edit(pid, meta):
    meta = meta if isinstance(meta, dict) else {}
    x = read_index()
    p = next((q for q in x["list"] if q["id"] == pid), None)
    if not p:
        return {"error": "There's no such save."}
    if "name" in meta:
        p["name"] = clean_name(meta["name"]) or p["name"]
    if "face" in meta:
        p["face"] = clean_face(meta["face"])
    if meta.get("setDiff") is True and meta.get("diff") in DIFFS:          # (only as a new save begins)
        p["diff"] = meta["diff"]
        p["kind"] = "sandbox" if p["diff"] == "free" else "normal"
    _write_index(x)
    return profiles()


def profile_delete(pid):
    x = read_index()
    if pid == x["active"]:
        return {"error": "Switch to another save first."}
    if not any(p["id"] == pid for p in x["list"]):
        return {"error": "There's no such save."}
    f = _profile_path(pid)
    if os.path.isfile(f):
        os.replace(f, os.path.join(_dir("profiles", "deleted"), "%s-%d.json" % (pid, int(time.time() * 1000))))
    x["list"] = [p for p in x["list"] if p["id"] != pid]
    _write_index(x)
    return profiles()


# ---- a save ----
def check(state):
    if not isinstance(state, dict) or state.get("v") != 1 or state.get("game") != "neuroarcana":
        return "That isn't a NeuroArcana save."
    if "cards" in state and not isinstance(state["cards"], dict):
        return "The collection is damaged."
    if "journal" in state and not isinstance(state["journal"], list):
        return "The journal is damaged."
    if "moon" in state and (not isinstance(state["moon"], (int, float)) or isinstance(state["moon"], bool)):
        return "The Moonstones are damaged."
    return None


def load(pid=None):
    """The open save (or another's, read only), or a new one. A damaged save gives way to the copy from before it."""
    p = _profile_path(pid) if pid and ID.match(str(pid)) else _profile_path(read_index()["active"])
    for f in (p, p + ".bak"):
        try:
            with open(f, encoding="utf-8") as fh:
                text = fh.read()
        except OSError:
            continue
        if len(text) > MAX_BYTES * 2:
            continue
        try:
            s = json.loads(text)
            if isinstance(s, dict) and s.get("game") == "neuroarcana":
                return s
        except ValueError:
            pass
    return empty()


def save(state):
    err = check(state)
    if err:
        return {"error": err}
    try:
        text = json.dumps(state, ensure_ascii=False)
    except (TypeError, ValueError):
        return {"error": "The save is damaged."}
    if len(text.encode("utf-8")) > MAX_BYTES:
        return {"error": "The save is too big."}
    target = _profile_path(read_index()["active"])
    try:
        if os.path.isfile(target):
            shutil.copyfile(target, target + ".bak")
        _write(target, text)
    except OSError as e:
        return {"error": "Couldn't save: %s" % e}
    return {"ok": True}


# ---- the achievement diary ----
def _ach_path():
    return os.path.join(data_dir(), "achievements.json")


def ach_get():
    try:
        with open(_ach_path(), encoding="utf-8") as f:
            x = json.load(f)
    except (OSError, ValueError):
        x = {}
    out = {"easy": {}, "normal": {}, "hard": {}}
    if isinstance(x, dict):
        for d in out:
            t = x.get(d)
            if isinstance(t, dict):
                for aid, v in list(t.items())[:2000]:
                    if ACH_ID.match(aid) and isinstance(v, dict):
                        out[d][aid] = {"at": v.get("at") if isinstance(v.get("at"), (int, float)) else 0, "by": clean_name(v.get("by"))}
    return out


def ach_add(diff, payload):
    payload = payload if isinstance(payload, dict) else {}
    ids = payload.get("ids") if isinstance(payload.get("ids"), list) else []
    if diff not in ("easy", "normal", "hard"):
        return {"error": "Not an achievement."}
    x, at = ach_get(), int(time.time() * 1000)
    for aid in ids[:200]:
        if isinstance(aid, str) and ACH_ID.match(aid) and aid not in x[diff]:
            x[diff][aid] = {"at": at, "by": clean_name(payload.get("by"))}
    _write(_ach_path(), json.dumps(x))
    return x


# ---- the codex (2 Nov, Q12 q7): what you know of every card and keeper, and the tutorial chapters you've had -- the same
#      codex.json as shell/store.js in the NeuroArcana source {v, cards: {key: [seen, faced, beaten, lost]}, keepers, taught}
CARD_KEY = re.compile(r"^[a-z0-9-]{1,60}:[a-z0-9_]{1,30}$")
KEEPER_KEY = re.compile(r"^(fool|oracle):[0-9]{1,2}$")


def _n0(v, top):
    try:
        return max(0, min(top, int(float(v))))
    except (TypeError, ValueError):
        return 0


def codex_clean(x):
    out = {"v": 1, "cards": {}, "keepers": {}, "taught": {}, "library": {}, "pulled": {}}
    if not isinstance(x, dict):
        return out
    cards = x.get("cards") if isinstance(x.get("cards"), dict) else {}
    for k, c in list(cards.items())[:6000]:
        if CARD_KEY.match(k) and isinstance(c, list):
            c = (c + [0, 0, 0, 0])[:4]
            out["cards"][k] = [_n0(c[0], 1), _n0(c[1], 10 ** 6), _n0(c[2], 10 ** 6), _n0(c[3], 10 ** 6)]
    keepers = x.get("keepers") if isinstance(x.get("keepers"), dict) else {}
    for k, K in list(keepers.items())[:200]:
        if not KEEPER_KEY.match(k) or not isinstance(K, dict):
            continue
        sp = {}
        spreads = K.get("spreads") if isinstance(K.get("spreads"), dict) else {}
        for i, keys in list(spreads.items())[:4]:
            if re.match(r"^[0-3]$", str(i)) and isinstance(keys, list):
                sp[str(i)] = [q for q in keys if isinstance(q, str) and CARD_KEY.match(q)][:8]
        out["keepers"][k] = {"met": _n0(K.get("met"), 10 ** 6), "won": _n0(K.get("won"), 10 ** 6), "lost": _n0(K.get("lost"), 10 ** 6),
                             "at": _n0(K.get("at"), 10 ** 15), "spreads": sp}
    taught = x.get("taught") if isinstance(x.get("taught"), dict) else {}
    for t in ("I", "II", "III"):
        if taught.get(t):
            out["taught"][t] = 1
    # the Library (2 Nov): pages found {id: [at, read]}, minor cards ever pulled from a booster {id: 1}
    lib = x.get("library") if isinstance(x.get("library"), dict) else {}
    for k, v in list(lib.items())[:2000]:
        if re.match(r"^[a-z0-9_-]{1,40}$", k) and isinstance(v, list):
            v = (v + [0, 0])[:2]
            out["library"][k] = [_n0(v[0], 10 ** 15), _n0(v[1], 1)]
    pulled = x.get("pulled") if isinstance(x.get("pulled"), dict) else {}
    for k, v in list(pulled.items())[:500]:
        if re.match(r"^[a-z0-9_]{1,30}$", k) and v:
            out["pulled"][k] = 1
    return out


def codex_get():
    try:
        with open(os.path.join(data_dir(), "codex.json"), encoding="utf-8") as f:
            return codex_clean(json.load(f))
    except (OSError, ValueError):
        return codex_clean(None)


def codex_reset():
    """Forget what's been learned: the codex is set aside (codex-<time>.json), never destroyed."""
    p = os.path.join(data_dir(), "codex.json")
    if os.path.isfile(p):
        os.replace(p, os.path.join(data_dir(), "codex-%d.json" % int(time.time() * 1000)))
    return codex_get()


def codex_set(x):
    text = json.dumps(codex_clean(x))
    if len(text) > MAX_BYTES:
        return {"error": "The codex is too big."}
    _write(os.path.join(data_dir(), "codex.json"), text)
    return {"ok": True}


# ---- the card catalogue: the art NeuroNet carries (ui/arcana-art/cards.json) ----
def catalogue(art_dir):
    try:
        with open(os.path.join(art_dir, "cards.json"), encoding="utf-8") as f:
            x = json.load(f)
        return x if isinstance(x, dict) and isinstance(x.get("decks"), list) else {"decks": []}
    except (OSError, ValueError):
        return {"decks": []}
