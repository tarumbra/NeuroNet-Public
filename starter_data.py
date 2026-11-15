"""Starter data: what each release brings with it (2026-10-06).

Cam: "when new versions are pushed and released i want the data from cooking
to go there, with the recipe photos. Training data for sessions, circuits,
guides and documents to travel over as well as one default deck for tarot
(murder of crows), oracle (carnival of souls) and the lenormand."

A release carries system/starter/starter.json: the recipes (and the Photos
entries of their pictures), Training's sessions, circuits, guides and
documents (with the exercise names, equipment and circuit types they use),
and one deck of each kind. The pictures and files themselves (the decks are
~420 MB) are NOT in the release -- each update would download them again --
but under their own tag in the same repository, which neuronet-update fetches
only when it changes (tools/make_starter.py makes both, at release time).

apply() merges it into this computer's data, the first time NeuroNet starts
after it changed. The rule, per recipe / session / deck / file:

  * not here, never delivered      -> added
  * not here, delivered before     -> left out (it was deleted here)
  * here, the same                 -> nothing to do
  * here, as last delivered        -> updated (nobody changed it here)
  * here, changed here             -> this computer's version is kept
  * dropped from the starter, and here as last delivered -> removed

What was delivered is kept in <data>/starter-applied.json. Lists of names
(recipe tags, circuit types, exercise names) only ever gain names.
"""
import hashlib
import json
import os
import shutil
import tempfile

LEDGER = "starter-applied.json"


def _sig(obj):
    return hashlib.sha1(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def file_sha1(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _read(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            v = json.load(f)
        return v if isinstance(v, type(default)) else default
    except (OSError, ValueError):
        return default


def _write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".starter-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def merge_items(local, starter, ledger, area, id_key="id"):
    """Merge starter items into the local list in place; returns counts."""
    n = {"added": 0, "updated": 0, "kept": 0, "removed": 0}
    index = {it.get(id_key): i for i, it in enumerate(local) if isinstance(it, dict) and it.get(id_key)}
    seen = set()
    for s in starter:
        if not isinstance(s, dict) or not s.get(id_key):
            continue
        key = f"{area}:{s[id_key]}"
        seen.add(key)
        sig = _sig(s)
        i = index.get(s[id_key])
        if i is None:
            if key in ledger:            # delivered once, deleted here since
                continue
            local.append(s)
            index[s[id_key]] = len(local) - 1
            ledger[key] = sig
            n["added"] += 1
            continue
        mine = _sig(local[i])
        if mine == sig:
            ledger[key] = sig
        elif ledger.get(key) == mine:     # untouched here since it came
            local[i] = s
            ledger[key] = sig
            n["updated"] += 1
        else:
            n["kept"] += 1
    gone = [k for k in ledger if k.startswith(area + ":") and k not in seen]
    for key in gone:
        ident = key[len(area) + 1:]
        i = next((j for j, it in enumerate(local) if isinstance(it, dict) and it.get(id_key) == ident), None)
        if i is not None and _sig(local[i]) == ledger[key]:
            local.pop(i)
            n["removed"] += 1
        del ledger[key]
    return n


def merge_names(local, names):
    """Names only ever join (tags, circuit types)."""
    added = 0
    for x in names:
        if x not in local:
            local.append(x)
            added += 1
    return added


def apply(starter_path, files_dir, data_dir, docs, ledger_path=None, state_home=None):
    """Merge the starter into this computer's data.

    docs: {"kitchen": path, "training": path, "cards": path, "photos": path}
    (the JSON files the parts live in). files_dir holds the pictures and
    files, laid out as they are under the data folder. Returns a report, or
    {"skipped": why}."""
    starter = _read(starter_path, {})
    if not starter:
        return {"skipped": "no starter in this release"}
    ledger_path = ledger_path or os.path.join(data_dir, LEDGER)
    led = _read(ledger_path, {})
    stamp = starter.get("stamp") or _sig(starter)
    if led.get("stamp") == stamp:
        return {"skipped": "already applied"}
    files = (starter.get("files") or {}).get("sha1") or {}
    if files and not (files_dir and os.path.isfile(os.path.join(files_dir, "TAG"))
                      and open(os.path.join(files_dir, "TAG")).read().strip() == starter["files"].get("tag")):
        return {"skipped": "its pictures and files haven't been downloaded yet"}

    items = led.setdefault("items", {})
    report = {}
    # files first, so nothing arrives pointing at a picture that isn't there
    fl = led.setdefault("files", {})
    fn = {"added": 0, "updated": 0, "kept": 0}
    for rel, sha in files.items():
        if rel.startswith("/") or ".." in rel.split("/"):
            continue
        src = os.path.join(files_dir, rel)
        dst = os.path.join(data_dir, rel)
        if not os.path.isfile(src) or fl.get(rel) == sha and os.path.exists(dst):
            continue
        if not os.path.exists(dst):
            if rel in fl:                # delivered once, deleted here since
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            fl[rel] = sha
            fn["added"] += 1
            continue
        if rel == "notes/vaults.json":           # the vault list: add the vaults this computer hasn't got (2026-10-16)
            here, there = _read(dst, {}), _read(src, {})
            have = {v.get("id") for v in here.get("vaults") or [] if isinstance(v, dict)}
            new = [v for v in there.get("vaults") or [] if isinstance(v, dict) and v.get("id") and v["id"] not in have]
            if new:
                here["vaults"] = (here.get("vaults") or []) + new
                _write(dst, here)
                fn["updated"] += 1
            fl[rel] = sha
            continue
        if rel == "notes/ship.json":             # the notes that ship: this computer's ticks and the other's (2026-10-24)
            here, there = _read(dst, {}), _read(src, {})
            here = here if isinstance(here, dict) else {}
            got = False
            for key in ("paths", "vaults"):
                mine_ = [x for x in here.get(key) or [] if isinstance(x, str)]
                new = [x for x in (there.get(key) or []) if isinstance(x, str) and x and x not in mine_] if isinstance(there, dict) else []
                if new:
                    here[key] = sorted(mine_ + new)
                    got = True
            if got:
                _write(dst, here)
                fn["updated"] += 1
            fl[rel] = sha
            continue
        mine = file_sha1(dst)
        if mine == sha:
            fl[rel] = sha
        elif fl.get(rel) == mine:
            shutil.copy2(src, dst)
            fl[rel] = sha
            fn["updated"] += 1
        else:
            fn["kept"] += 1
    report["files"] = fn

    loaded, before = {}, {}

    def doc(name):
        if name not in loaded:
            loaded[name] = _read(docs[name], {})
            before[name] = _sig(loaded[name])
        return loaded[name]

    # a computer with none of a document yet starts it as the release says (Media's mediaVersion, 15 Nov 2026)
    for name, vals in (starter.get("docDefaults") or {}).items():
        if name in docs and docs[name] and isinstance(vals, dict):
            d = doc(name)
            if not d.get("items"):
                for k, v in vals.items():
                    d.setdefault(k, v)
    # folders matched by NAME (Photos -> Covers, 15 Nov 2026): one already here is used, so a computer never
    # has two Covers; the items the release puts in it are moved into this computer's own
    remap = {}
    for fb in starter.get("foldersByName") or []:
        d = doc(fb["doc"])
        lst = d.get(fb["key"])
        if not isinstance(lst, list):
            lst = d[fb["key"]] = []
        have = {(f.get("name"), f.get("parentId") or ""): f.get("id") for f in lst if isinstance(f, dict)}
        new = []
        for f in fb.get("items") or []:
            if not isinstance(f, dict) or not f.get("id"):
                continue
            mine = have.get((f.get("name"), f.get("parentId") or ""))
            if mine and mine != f["id"]:
                remap[f["id"]] = mine
            elif not mine:
                new.append(f)
        report[f'{fb["doc"]}.{fb["key"]}'] = merge_items(lst, new, items, f'{fb["doc"]}.{fb["key"]}')
    for c in starter.get("collections") or []:
        if not docs.get(c["doc"]):
            continue
        if remap and c["doc"] == "photos":
            c = dict(c, items=[dict(x, folderId=remap[x["folderId"]]) if isinstance(x, dict) and x.get("folderId") in remap
                               else x for x in c.get("items") or []])
        d = doc(c["doc"])
        lst = d.get(c["key"])
        if not isinstance(lst, list):
            lst = d[c["key"]] = []
        area = c.get("area") or f'{c["doc"]}.{c["key"]}'
        report[area] = merge_items(lst, c.get("items") or [], items, area, c.get("idKey", "id"))
    for u in starter.get("names") or []:
        d = doc(u["doc"])
        lst = d.get(u["key"])
        if not isinstance(lst, list):
            lst = d[u["key"]] = []
        merge_names(lst, u.get("values") or [])
    for g in starter.get("namesByGroup") or []:
        d = doc(g["doc"])
        groups = d.get(g["key"])
        if not isinstance(groups, dict):
            groups = d[g["key"]] = {}
        for group, names in (g.get("values") or {}).items():
            if not isinstance(groups.get(group), list):
                groups[group] = []
            merge_names(groups[group], names)
    for name, d in loaded.items():
        if d and _sig(d) != before[name]:     # only what changed is written
            _write(docs[name], d)

    # the desktop's daily card: the starter deck, where none has been chosen
    if state_home:
        for kind, deck_id in (starter.get("dailyDecks") or {}).items():
            flag = "dailyDeck:" + kind
            if led.get(flag):
                continue
            tool = "neuronet-lenormand" if kind == "lenormand" else f"neuronet-{kind}"
            p = os.path.join(state_home, tool, "state.json")
            st = _read(p, {})
            ids = st.get("deckIds") if isinstance(st.get("deckIds"), dict) else {}
            if not ids.get(kind):            # "any" is a choice too; only an unset one
                ids[kind] = deck_id
                st["deckIds"] = ids
                st.setdefault("kind", kind)
                _write(p, st)
            led[flag] = True

    led["stamp"] = stamp
    _write(ledger_path, led)
    return report
