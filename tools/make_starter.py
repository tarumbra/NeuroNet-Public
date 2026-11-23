#!/usr/bin/env python3
"""Make the starter data a release carries (run at release time, 2026-10-06).

    python3 tools/make_starter.py [--data DIR] [--files-tree DIR] [--out FILE] [--no-commit]

Reads Cam's data (paths.json's "data", or --data) and writes:

  system/starter/starter.json   the recipes and their Photos entries,
                                Training's sessions, circuits, guides and
                                documents (with the exercise names, equipment
                                and circuit types), and one deck of each kind
  the starter-files tree        the pictures and files those need (a git
                                worktree on the orphan branch starter-files,
                                in ~/.cache), committed and tagged
                                starter-files-<content> when they changed

Push the tag with the release: git push origin <tag> (the release steps in
CHANGELOG.md's header say so). starter_data.py merges it on each computer.
"""
import hashlib
import json
import re
import os
import shutil
import subprocess
import sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)
from starter_data import _sig, file_sha1  # noqa: E402

# Cam: "one default deck for tarot (murder of crows), oracle (carnival of
# souls) and the lenormand (Enchanted Forest)" -- his only Lenormand deck is
# named "Lenormand Of Enchantment".
DECKS = {"tarot": "Murder Of Crows", "oracle": "Carnival Of Souls", "lenormand": "Lenormand Of Enchantment"}
TRAINING = ("sessions", "circuits", "guides", "documents", "equipment")
BRANCH = "starter-files"


def read(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def data_dir(argv):
    if "--data" in argv:
        return os.path.abspath(argv[argv.index("--data") + 1])
    with open(os.path.expanduser("~/.config/neuronet/paths.json")) as f:
        return json.load(f)["data"]


def strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from strings(v)


def build(data):
    files = {}                                  # rel path under the data folder -> source

    kitchen = read(os.path.join(data, "kitchen", "cookery.json"))
    # not the cookbook library (23 Nov 2026): Cam's own copies of MasterCook
    # recipes (a favourite, an edit) sit in cookery.json too, flagged "library"
    recipes = [r for r in kitchen.get("recipes", []) if isinstance(r, dict) and not r.get("library")]
    pics = {im["storedName"] for r in recipes for im in (r.get("images") or [])
            if isinstance(im, dict) and im.get("storedName")}
    for p in sorted(pics):
        src = os.path.join(data, "photos", p)
        if os.path.isfile(src):
            files["photos/" + p] = src
    # the Kitchen's cookbook library (23 Nov 2026, Cam: "so other systems can get the update"): whole files, one per
    # cookbook; the recipes themselves stay out of starter.json (kitchen_backend joins them in on load)
    libdir = os.path.join(data, "kitchen", "library")
    if os.path.isdir(libdir):
        for n in sorted(os.listdir(libdir)):
            if n.endswith(".json"):
                files["kitchen/library/" + n] = os.path.join(libdir, n)
    index = read(os.path.join(data, "neuronet.json"))
    photo_entries = [dict(e, albumIds=[], folderId="") for e in index.get("photos", [])
                     if isinstance(e, dict) and e.get("storedName") in pics]

    training = read(os.path.join(data, "training", "coach_cam.json"))
    for d in training.get("documents") or []:
        name = isinstance(d, dict) and d.get("storedName")
        src = name and os.path.join(data, "training", "documents", name)
        if src and os.path.isfile(src):
            files["training/documents/" + name] = src

    cards = read(os.path.join(data, "cards", "celestial.json"))
    imgs = os.path.join(data, "cards", "images")
    decks, daily = {}, {}
    for kind, name in DECKS.items():
        found = [d for d in cards.get(kind + "Decks", []) if isinstance(d, dict) and d.get("name") == name]
        if not found:
            sys.exit(f"make_starter: no {kind} deck named {name!r} in {data}")
        deck = found[0]
        decks[kind] = deck
        daily[kind] = deck["id"]
        for s in strings(deck):
            if s and "/" not in s and os.path.isfile(os.path.join(imgs, s)):
                files["cards/images/" + s] = os.path.join(imgs, s)

    # notes ticked "Ship with releases" in Notes (2026-10-11): <notes>/ship.json; a folder ships all of it, and a note
    # brings the pictures it links to. starter_data.py adds or updates them on each computer (an edited note is kept).
    vault = os.path.join(data, "notes", "vault")
    try:
        shipcfg = read(os.path.join(data, "notes", "ship.json"))
    except (OSError, ValueError):
        shipcfg = {}
    ship = shipcfg.get("paths", [])
    for rel in ship:
        src = os.path.join(vault, rel)
        if ".." in rel.split("/") or not os.path.exists(src):
            continue
        walk = [(src, "")] if os.path.isfile(src) else [(os.path.join(r, n), "") for r, _d, ns in os.walk(src) for n in ns]
        for path, _ in walk:
            if os.path.basename(path).startswith("."):
                continue
            files["notes/vault/" + os.path.relpath(path, vault).replace(os.sep, "/")] = path
            if path.endswith(".md"):
                with open(path, encoding="utf-8", errors="replace") as f:
                    text = f.read()
                for name in re.findall(r"!\[\[([^\]|#]+)", text) + re.findall(r"\]\((?:\.?/)?attachments/([^)\s]+)\)", text):
                    att = os.path.join(vault, "attachments", name.strip())
                    if os.path.isfile(att):
                        files["notes/vault/attachments/" + name.strip()] = att
    # Collaboration (Cam, 2026-10-16: "push and release all the collaboration notes"): every document, so the laptop has
    # the play tests, questions, votes and concerns too (starter_data.py adds them; one edited on a computer is kept there)
    cdir = os.path.join(data, "collab")
    for n in sorted(os.listdir(cdir)) if os.path.isdir(cdir) else []:
        if n.endswith(".json") and not n.startswith("."):
            files["collab/" + n] = os.path.join(cdir, n)
    # notebooks of their own (Notes' separate vaults) named in ship.json's "vaults": all their files, and the vault list --
    # starter_data.py merges that list by id, so a computer's own vaults stay
    shipped_vaults = [v for v in shipcfg.get("vaults", []) if isinstance(v, str) and re.fullmatch(r"[A-Za-z0-9_-]+", v)]
    for vid in shipped_vaults:
        vroot = os.path.join(data, "notes", "vaults", vid)
        for r, _d, ns in os.walk(vroot):
            for n in ns:
                if not n.startswith("."):
                    p = os.path.join(r, n)
                    files["notes/vaults/" + vid + "/" + os.path.relpath(p, vroot).replace(os.sep, "/")] = p
    if shipped_vaults and os.path.isfile(os.path.join(data, "notes", "vaults.json")):
        files["notes/vaults.json"] = os.path.join(data, "notes", "vaults.json")
    # the ship list itself (2026-10-24, Cam: "I would like the notes to be synced"): without it a release made on the
    # other computer shipped none of the notes -- starter_data.py merges it into each computer's own list
    if os.path.isfile(os.path.join(data, "notes", "ship.json")):
        files["notes/ship.json"] = os.path.join(data, "notes", "ship.json")
    # Media (Cam, 15 Nov 2026: "when i push and release please carry over the media data as well for example all
    # the movie titles and information. Not the video files themselves but the meta data. Do this for all media"):
    # every film, album, book and game with its formats, notes and stars, the shelf's covers, and the cover photos in
    # Photos -> Covers. The films, songs and links to them stay on each computer. A public release carries none of
    # this (tools/make_public.py).
    media_items, media_types, cover_entries, folders = [], [], [], []
    mfile = os.path.join(data, "personal_effects.json")
    if os.path.isfile(mfile):
        media = read(mfile)
        media_items = [x for x in media.get("items") or [] if isinstance(x, dict) and x.get("id")]
        media_types = [x for x in media.get("types") or [] if isinstance(x, dict) and x.get("id")]
        for it in media_items:
            cov = os.path.join(data, "media_covers", re.sub(r"[^A-Za-z0-9_-]", "", str(it["id"])) + ".jpg")
            if os.path.isfile(cov):
                files["media_covers/" + os.path.basename(cov)] = cov
        cover_names = {it["coverPhoto"] for it in media_items if isinstance(it.get("coverPhoto"), str) and it["coverPhoto"]}
        cover_entries = [e for e in index.get("photos", []) if isinstance(e, dict) and e.get("storedName") in cover_names
                         and os.path.isfile(os.path.join(data, "photos", e["storedName"]))]
        for e in cover_entries:
            files["photos/" + e["storedName"]] = os.path.join(data, "photos", e["storedName"])
        used = {e.get("folderId") for e in cover_entries}
        folders = [f for f in index.get("folders", []) if isinstance(f, dict) and f.get("id") in used and not f.get("parentId")]
        keep = {f["id"] for f in folders}
        cover_entries = [dict(e, albumIds=[], folderId=e.get("folderId") if e.get("folderId") in keep else "")
                         for e in cover_entries]
    starter = {
        "about": "Made by tools/make_starter.py; merged by starter_data.py. Cam's own data -- see CHANGELOG 1.0.39.",
        "collections": (
            [{"doc": "kitchen", "key": "recipes", "items": recipes},
             {"doc": "photos", "key": "photos", "items": photo_entries}]
            + [{"doc": "training", "key": k, "items": [x for x in training.get(k) or [] if isinstance(x, dict)]}
               for k in TRAINING]
            + [{"doc": "cards", "key": kind + "Decks", "items": [decks[kind]]} for kind in DECKS]
            + ([{"doc": "media", "key": "items", "items": media_items},
                {"doc": "media", "key": "types", "items": media_types},
                {"doc": "photos", "key": "photos", "items": cover_entries, "area": "photos.covers"}] if media_items else [])),
        # a folder that's here by the same name already is that one (Photos -> Covers made on each computer)
        "foldersByName": [{"doc": "photos", "key": "folders", "itemsKey": "photos", "items": folders}] if folders else [],
        # a computer with no Media yet gets it as it is now, not as a file from before 14 Nov 2026 to convert
        "docDefaults": {"media": {"mediaVersion": 2}} if media_items else {},
        "names": [{"doc": "kitchen", "key": "tagList", "values": kitchen.get("tagList") or []},
                  {"doc": "training", "key": "circuitTypes", "values": training.get("circuitTypes") or []}]
                 + ([{"doc": "photos", "key": "photoTagList", "values": ["Cover"]}] if cover_entries else []),
        "namesByGroup": [{"doc": "training", "key": "exercises", "values": training.get("exercises") or {}}],
        "dailyDecks": daily,
    }
    return starter, files


def git(*args, cwd=APP, check=True):
    return subprocess.run(["git", *args], cwd=cwd, check=check, capture_output=True, text=True)


def files_tree(argv):
    if "--files-tree" in argv:
        return os.path.abspath(argv[argv.index("--files-tree") + 1])
    return os.path.expanduser("~/.cache/neuronet-starter-files")


def main(argv):
    data = data_dir(argv)
    starter, files = build(data)
    shas = {rel: file_sha1(src) for rel, src in sorted(files.items())}
    tag = "starter-files-" + hashlib.sha1(json.dumps(shas, sort_keys=True).encode()).hexdigest()[:12]
    starter["files"] = {"tag": tag, "sha1": shas}
    starter["stamp"] = _sig(starter)

    out = (os.path.abspath(argv[argv.index("--out") + 1]) if "--out" in argv
           else os.path.join(APP, "system", "starter", "starter.json"))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(starter, f, ensure_ascii=False, indent=1)
    size = sum(os.path.getsize(s) for s in files.values())
    print(f"  starter.json: {sum(len(c['items']) for c in starter['collections'])} items; "
          f"{len(files)} files ({size / 1e6:.0f} MB) as {tag}")

    tree = files_tree(argv)
    if "--no-commit" in argv:
        os.makedirs(tree, exist_ok=True)
    elif not os.path.isdir(tree):
        if git("rev-parse", "--verify", "-q", BRANCH, check=False).returncode == 0:
            git("worktree", "add", tree, BRANCH)
        else:
            git("worktree", "add", "--detach", tree)
            git("checkout", "-q", "--orphan", BRANCH, cwd=tree)
            git("rm", "-rqf", ".", cwd=tree, check=False)
    # the tree is exactly the files: copy the changed, drop the gone
    keep = set(files) | {"TAG"}
    for root, dirs, names in os.walk(tree):
        dirs[:] = [d for d in dirs if d != ".git"]
        for n in names:
            rel = os.path.relpath(os.path.join(root, n), tree)
            if rel != ".git" and rel not in keep:
                os.remove(os.path.join(root, n))
    for rel, src in files.items():
        dst = os.path.join(tree, rel)
        if not os.path.isfile(dst) or file_sha1(dst) != shas[rel]:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
    with open(os.path.join(tree, "TAG"), "w") as f:
        f.write(tag + "\n")
    if "--no-commit" in argv:
        return 0
    if git("rev-parse", "-q", "--verify", "refs/tags/" + tag, check=False).returncode == 0:
        print(f"  files unchanged ({tag} already made)")
        return 0
    git("add", "-A", ".", cwd=tree)
    git("commit", "-qm", f"Starter files {tag}", cwd=tree)
    git("tag", tag, cwd=tree)
    print(f"  committed and tagged {tag} -- push it: git push origin {tag}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
