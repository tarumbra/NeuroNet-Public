"""Collaboration -- Cam and Claude's shared desk (Scribe > Collaboration, 2026-10-15).

Cam: "lets use neuronet to discuss play tests, questions and more. The prompts can be the main workspace where we direct
work directly on the project. Further context will go through neuronet ... We can make notes there that we can both see
... I can just say refer to "X", "Y" or "Z" in the app. Create a template that works best for you that i can fill out
like a form."

Each document is one JSON file in <data>/collab/ (<ref>.json, e.g. PT1.json), so Claude reads and writes them directly and
the page shows them as forms. A document:

    {"ref": "PT1", "type": "playtest", "title": "...", "project": "...", "from": "claude" | "cam",
     "status": "open" | "answered" | "closed", "created": iso, "updated": iso, "intro": "text",
     "sections": [{"title": "...", "items": [ITEM, ...]}]}

and an ITEM is one of
    {"id": "a1", "kind": "check",  "text": "what to try", "expect": "what should happen",
     "result": null | "pass" | "fail" | "skip" | "unsure", "note": ""}
    {"id": "q1", "kind": "choice", "text": "the question", "options": [{"id": "a", "label": "...", "rec": true}],
     "answer": null | option id, "note": ""}
    {"id": "t1", "kind": "text",   "text": "a prompt", "answer": ""}
    {"id": "gd", "kind": "ballot", "voter": "Game Developer", "vote": "yes" | "no" | "abstain", "text": "why, honestly"}

Votes (2026-10-16, Cam: "Put it to a vote from all stakeholders and if majority vote yes then implement and if majority no
then dont. I would like this voting system the way we handle features and ideas. I can choose to override in the end"):
a "vote" document holds a ballot for Claude and each section head, Cam's own vote (the choice item "cam": yes / no /
abstain) and his override (the choice item "override": accept the vote / yes anyway / no anyway). tally() counts them: a
majority of the votes cast decides; a tie is no; Cam's override, if he gives one, is the decision. "by" names who raised
a document when it isn't Claude or Cam -- a section head raising a concern ("concern", C1 ...) or a proposal.

The archive (2026-11-02, Cam: "implement an archive in the scribe app, which contains all archived notes, collabs etc
this will stop cluttering the main apps"): "archived": true takes a document off the desk's lists; Scribe > Archive lists
it and puts it back. Its status stays what it was.

Projects (2026-10-17, Cam: "i would like the ability in collaboration to be broken into projects (think vaults in the notes app).
This way we can knuckle down all our notes on the projects and not overload the one"): a document's "project" names its
project; <data>/collab/projects.json keeps the list (with ones that have no documents yet) and the one being looked at.
A document with no project is in "General".

What's new (I20, 2026-11-08, Cam: "If a new idea is added to collaboration during a prompt have a pop up appear ... This
will allow it to prompt me to check collaboration"; the team's idea I20: the pop-up goes after 20 seconds, so the app
marks it too): <data>/collab/seen.json keeps {"since": iso, "seen": {ref: the "updated" Cam last saw}}. A document is new
when it changed after Cam last opened it (or, never opened, after "since": the first time this ran, so an old desk isn't
all new at once). Opening one, or Cam's own saves, mark it seen; archived ones are never new.

"open": waiting for Cam. "answered": Cam has filled it in (he presses "Done -- over to Claude"). "closed": Claude has
acted on it. Refs are a type's letters and the next number: PT play test, Q questions, B bug, I idea, N note.
"""
import datetime
import json
import os
import re
import shutil
import tempfile

#: Provides the NeuroNet data folder. Set by neuronet.py; tests point it at a scratch folder.
DATA_DIR_PROVIDER = None

TYPES = {
    "playtest": {"prefix": "PT", "name": "Play test"},
    "questions": {"prefix": "Q", "name": "Questions"},
    "bug": {"prefix": "B", "name": "Bug"},
    "idea": {"prefix": "I", "name": "Idea"},
    "note": {"prefix": "N", "name": "Note"},
    "vote": {"prefix": "V", "name": "Vote"},
    "concern": {"prefix": "C", "name": "Concern"},
}
VOTES = ("yes", "no", "abstain")
STATUSES = ("open", "answered", "closed")
RESULTS = (None, "pass", "fail", "skip", "unsure")   # (unsure: 2026-11-02, Cam PT62 f3: "Im not sure should become a pill after didnt try")
REF = re.compile(r"^(PT|Q|B|I|N|V|C)([1-9][0-9]{0,4})$")
MAX_TEXT = 20000
MAX_ITEMS = 400

# what Cam starts from (the + New buttons); Claude's play tests and questions are written in full
TEMPLATES = {
    "bug": {"title": "A bug", "intro": "", "sections": [{"title": "The bug", "items": [
        {"id": "t1", "kind": "text", "text": "Where were you, and what did you do? (the steps)", "answer": ""},
        {"id": "t2", "kind": "text", "text": "What did you expect?", "answer": ""},
        {"id": "t3", "kind": "text", "text": "What happened instead? (any message word for word)", "answer": ""},
        {"id": "q1", "kind": "choice", "text": "How bad is it?", "options": [
            {"id": "a", "label": "It stops me playing"}, {"id": "b", "label": "Annoying, but I can carry on"},
            {"id": "c", "label": "Cosmetic"}], "answer": None, "note": ""},
        {"id": "q2", "kind": "choice", "text": "Does it happen every time?", "options": [
            {"id": "a", "label": "Every time"}, {"id": "b", "label": "Sometimes"}, {"id": "c", "label": "Once so far"}],
         "answer": None, "note": ""}]}]},
    "idea": {"title": "An idea", "intro": "", "sections": [{"title": "The idea", "items": [
        {"id": "t1", "kind": "text", "text": "The idea, in a sentence or two", "answer": ""},
        {"id": "t2", "kind": "text", "text": "Why -- what would it make better?", "answer": ""},
        {"id": "t3", "kind": "text", "text": "Games that do something like it (optional)", "answer": ""},
        {"id": "q1", "kind": "choice", "text": "When?", "options": [
            {"id": "a", "label": "Now -- next in line"}, {"id": "b", "label": "Soon"}, {"id": "c", "label": "Later -- just keep it"}],
         "answer": None, "note": ""}]}]},
    "note": {"title": "A note", "intro": "", "sections": [{"title": "", "items": [
        {"id": "t1", "kind": "text", "text": "", "answer": ""}]}]},
    "playtest": {"title": "Play-test notes", "intro": "", "sections": [
        {"title": "What I played", "items": [{"id": "t1", "kind": "text", "text": "What did you do, and for how long?", "answer": ""}]},
        {"title": "What I noticed", "items": [
            {"id": "t2", "kind": "text", "text": "What felt good?", "answer": ""},
            {"id": "t3", "kind": "text", "text": "What felt wrong, slow, too easy or too hard?", "answer": ""},
            {"id": "t4", "kind": "text", "text": "Bugs (or start a Bug for each)", "answer": ""}]}]},
    # a vote Cam starts: his proposal and his vote -- Claude adds every section head's ballot when it comes over
    "vote": {"title": "A proposal to vote on", "intro": "", "sections": [
        {"title": "The proposal", "items": [{"id": "t1", "kind": "text", "text": "What should change, and why", "answer": ""}]},
        {"title": "Your vote", "items": [{"id": "cam", "kind": "choice", "text": "Your vote", "options": [
            {"id": "yes", "label": "Yes"}, {"id": "no", "label": "No"}, {"id": "abstain", "label": "Abstain"}], "answer": None, "note": ""}]}]},
    "concern": {"title": "A concern", "intro": "", "sections": [{"title": "", "items": [
        {"id": "t1", "kind": "text", "text": "What worries you, and what you'd do about it", "answer": ""}]}]},
    "questions": {"title": "Questions", "intro": "", "sections": [{"title": "", "items": [
        {"id": "t1", "kind": "text", "text": "Your question for Claude", "answer": ""}]}]},
}


def root():
    d = os.path.join(DATA_DIR_PROVIDER(), "collab")
    os.makedirs(d, exist_ok=True)
    return d


def now():
    return datetime.datetime.now().replace(microsecond=0).isoformat()


def _s(v, n=MAX_TEXT):
    return v[:n] if isinstance(v, str) else ""


def clean(doc):
    """The document, checked and trimmed to the shape above -- or raises ValueError."""
    if not isinstance(doc, dict):
        raise ValueError("That isn't a collaboration document.")
    ref = str(doc.get("ref") or "")
    if not REF.match(ref):
        raise ValueError("A document's code should look like PT1, Q2 or B3.")
    typ = doc.get("type")
    if typ not in TYPES or not ref.startswith(TYPES[typ]["prefix"]) or (typ == "playtest" and not ref.startswith("PT")):
        raise ValueError("The document's kind doesn't match its code.")
    if doc.get("status", "open") not in STATUSES:
        raise ValueError("A document is open, answered or closed.")
    out = {"ref": ref, "type": typ, "title": _s(doc.get("title"), 200) or TYPES[typ]["name"], "project": _s(doc.get("project"), 120),
           "from": "claude" if doc.get("from") == "claude" else "cam", "status": doc.get("status", "open"),
           "created": _s(doc.get("created"), 40) or now(), "updated": _s(doc.get("updated"), 40) or now(),
           "intro": _s(doc.get("intro")), "by": _s(doc.get("by"), 80), "archived": doc.get("archived") is True, "sections": []}
    seen, count = set(), 0
    for sec in doc.get("sections") or []:
        if not isinstance(sec, dict):
            raise ValueError("A section is the wrong shape.")
        items = []
        for it in sec.get("items") or []:
            count += 1
            if count > MAX_ITEMS or not isinstance(it, dict):
                raise ValueError("Too many items, or an item is the wrong shape.")
            iid = str(it.get("id") or "")
            if not re.match(r"^[A-Za-z0-9_-]{1,20}$", iid) or iid in seen:
                raise ValueError("Every item needs its own short id.")
            seen.add(iid)
            kind = it.get("kind")
            c = {"id": iid, "kind": kind, "text": _s(it.get("text"))}
            if kind == "check":
                if it.get("result") not in RESULTS:
                    raise ValueError("A check is pass, fail, skip or not yet.")
                c.update(expect=_s(it.get("expect")), result=it.get("result"), note=_s(it.get("note")))
            elif kind == "choice":
                opts = []
                for o in it.get("options") or []:
                    if not isinstance(o, dict) or not re.match(r"^[A-Za-z0-9_-]{1,20}$", str(o.get("id") or "")):
                        raise ValueError("A choice's option is the wrong shape.")
                    opts.append({"id": str(o["id"]), "label": _s(o.get("label"), 600), "rec": bool(o.get("rec"))})
                ans = it.get("answer")
                if ans is not None and ans not in [o["id"] for o in opts]:
                    raise ValueError("An answer must be one of its options.")
                c.update(options=opts, answer=ans, note=_s(it.get("note")))
            elif kind == "text":
                c.update(answer=_s(it.get("answer")))
            elif kind == "ballot":
                if it.get("vote") not in VOTES:
                    raise ValueError("A ballot is yes, no or abstain.")
                c.update(voter=_s(it.get("voter"), 80) or "?", vote=it.get("vote"))
            else:
                raise ValueError("An item is a check, a choice, a text or a ballot.")
            pics = it.get("pics") or []
            if kind != "ballot" and isinstance(pics, list):
                c["pics"] = [p for p in pics if isinstance(p, str) and PIC_NAME.match(p)][:MAX_PICS]
            # 15 Nov 2026: "a check box ... that says snip" -- Claude looks in NeuroNet Picture References/NeuroNet Snips for it
            if kind != "ballot" and it.get("snip"):
                c["snip"] = True
            items.append(c)
        out["sections"].append({"title": _s(sec.get("title"), 200), "items": items})
    return out


# ---- pictures (2026-10-21, Cam PT49: "copy and paste images directly in here ... or attach photos saved on my
# system"): the page sends a picture's bytes (pasted, or a file Cam picked); they're checked to really be a PNG, JPEG or
# WebP, kept under a name made here, in <data>/collab/pictures/, and listed on the item they belong to. Claude reads
# them from there.
PIC_NAME = re.compile(r"^[A-Z]{1,3}[0-9]{1,5}-[A-Za-z0-9_-]{1,20}-[0-9]{1,4}\.(png|jpg|webp)$")
MAX_PICS = 12
MAX_PIC_BYTES = 10 * 1024 * 1024
_MAGIC = ((b"\x89PNG\r\n\x1a\n", "png", "image/png"), (b"\xff\xd8\xff", "jpg", "image/jpeg"), (b"RIFF", "webp", "image/webp"))


def pictures_dir():
    d = os.path.join(root(), "pictures")
    os.makedirs(d, exist_ok=True)
    return d


def add_picture(ref, item, data_url):
    """Keep a picture for item `item` of document `ref`; returns its name (to add to the item's pics)."""
    import base64
    _path(ref)
    if not re.match(r"^[A-Za-z0-9_-]{1,20}$", str(item or "")):
        raise ValueError("Which item is the picture for?")
    s = str(data_url or "")
    if not s.startswith("data:") or ";base64," not in s[:80]:
        raise ValueError("That isn't a picture.")
    try:
        raw = base64.b64decode(s.split(",", 1)[1], validate=True)
    except (ValueError, TypeError):
        raise ValueError("That picture is damaged.")
    if len(raw) > MAX_PIC_BYTES:
        raise ValueError("That picture is too big (10 MB at most).")
    kind = next((ext for magic, ext, _ in _MAGIC if raw.startswith(magic) and (ext != "webp" or raw[8:12] == b"WEBP")), None)
    if not kind:
        raise ValueError("Pictures can be PNG, JPEG or WebP.")
    d = pictures_dir()
    n = 1
    while any(os.path.exists(os.path.join(d, f"{ref}-{item}-{n}.{e}")) for e in ("png", "jpg", "webp")):
        n += 1
    name = f"{ref}-{item}-{n}.{kind}"
    with open(os.path.join(d, name), "wb") as fh:
        fh.write(raw)
    return {"name": name}


def picture(name):
    """A kept picture as a data URL (for the page to show)."""
    import base64
    if not PIC_NAME.match(str(name or "")):
        raise ValueError("There's no picture like that.")
    path = os.path.join(pictures_dir(), name)
    with open(path, "rb") as fh:
        raw = fh.read()
    mime = next(m for magic, ext, m in _MAGIC if name.endswith("." + ext))
    return {"name": name, "url": f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")}


def remove_picture(name):
    """A picture taken off an item goes to the deleted folder, like a document."""
    if not PIC_NAME.match(str(name or "")):
        raise ValueError("There's no picture like that.")
    src = os.path.join(pictures_dir(), name)
    if os.path.exists(src):
        dest = os.path.join(root(), "deleted")
        os.makedirs(dest, exist_ok=True)
        os.replace(src, os.path.join(dest, name))
    return {"ok": True}


def _path(ref):
    if not REF.match(str(ref or "")):
        raise ValueError("There's no document like that.")
    return os.path.join(root(), ref + ".json")


def _read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return clean(json.load(fh))
    except (OSError, ValueError, json.JSONDecodeError):
        return None


def _write(doc):
    d = clean(doc)
    path = _path(d["ref"])
    fd, tmp = tempfile.mkstemp(dir=root(), prefix=".collab-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(d, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    return d


def tally(d):
    """A vote's count: {yes, no, abstain, waiting, result: "yes" | "no" | "", overridden}. Cam's vote is the choice "cam"
    (its options' ids are yes / no / abstain); "override" (accept / yes / no) decides over the count when he gives one."""
    items = [it for s in d["sections"] for it in s["items"]]
    t = {"yes": 0, "no": 0, "abstain": 0, "waiting": 0}
    for it in items:
        if it["kind"] == "ballot":
            t[it["vote"]] += 1
        elif it["kind"] == "choice" and it["id"] == "cam":
            if it["answer"] in VOTES:
                t[it["answer"]] += 1
            else:
                t["waiting"] += 1
    counted = t["yes"] + t["no"]
    t["result"] = ("yes" if t["yes"] > t["no"] else "no") if counted and not t["waiting"] else ""
    ov = next((it["answer"] for it in items if it["kind"] == "choice" and it["id"] == "override"), None)
    t["overridden"] = ov in ("yes", "no")
    if t["overridden"]:
        t["result"] = ov
    return t


def summary(d):
    """A document in a line: for the list."""
    items = [it for s in d["sections"] for it in s["items"]]
    done = sum(1 for it in items if (it["kind"] == "check" and it["result"]) or (it["kind"] == "choice" and it["answer"])
               or (it["kind"] == "text" and it["answer"].strip()) or it["kind"] == "ballot")
    fails = sum(1 for it in items if it["kind"] == "check" and it["result"] == "fail")
    return {"ref": d["ref"], "type": d["type"], "title": d["title"], "project": d["project"], "from": d["from"],
            "status": d["status"], "updated": d["updated"], "created": d["created"], "items": len(items), "done": done, "fails": fails,
            "by": d.get("by", ""), "tally": tally(d) if d["type"] == "vote" else None, "archived": d.get("archived", False)}


def listing():
    """Every document, newest change first, as summaries (each saying whether it's new to Cam)."""
    out, s = [], _read_seen()
    for name in os.listdir(root()):
        if name.endswith(".json") and REF.match(name[:-5]):
            d = _read(os.path.join(root(), name))
            if d and d["ref"] == name[:-5]:
                x = summary(d)
                x["new"] = _is_new(x, s)
                out.append(x)
    return sorted(out, key=lambda x: x["updated"], reverse=True)


def _seen_path():
    return os.path.join(root(), "seen.json")


def _read_seen():
    try:
        with open(_seen_path(), encoding="utf-8") as f:
            s = json.load(f)
        if isinstance(s, dict) and isinstance(s.get("since"), str) and isinstance(s.get("seen"), dict):
            return {"since": s["since"], "seen": {k: v for k, v in s["seen"].items() if REF.match(str(k)) and isinstance(v, str)}}
    except (OSError, ValueError):
        pass
    s = {"since": now(), "seen": {}}                                  # the first time: nothing already here is new
    _write_seen(s)
    return s


def _write_seen(s):
    fd, tmp = tempfile.mkstemp(dir=root(), prefix=".seen-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(s, fh, indent=1, sort_keys=True)
        os.replace(tmp, _seen_path())
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def _is_new(x, s):
    return not x.get("archived") and x["updated"] > s["seen"].get(x["ref"], s["since"])


def mark_seen(refs):
    """Cam has seen these (opened them, or saved his own changes): not new until they change again."""
    s, changed = _read_seen(), False
    for ref in refs:
        d = _read(_path(ref)) if REF.match(str(ref or "")) else None
        if d and s["seen"].get(ref) != d["updated"]:
            s["seen"][ref] = d["updated"]
            changed = True
    if changed:
        _write_seen(s)
    return fresh()


def fresh():
    """How many are new to Cam: {"total": n, "projects": {name: n}, "refs": [...]} (General for no project)."""
    out = {"total": 0, "projects": {}, "refs": []}
    for x in listing():
        if x["new"]:
            n = x["project"] or GENERAL
            out["total"] += 1
            out["projects"][n] = out["projects"].get(n, 0) + 1
            out["refs"].append(x["ref"])
    return out


def get(ref):
    try:
        return _read(_path(ref)) or {"error": "That document is gone."}
    except ValueError as e:
        return {"error": str(e)}


def next_ref(typ):
    p = TYPES[typ]["prefix"]
    ns = [int(m.group(2)) for m in (REF.match(n[:-5]) for n in os.listdir(root()) if n.endswith(".json")) if m and m.group(1) == p]
    return p + str(max(ns + [0]) + 1)


def new(typ, title="", project="", by="cam", body=None, author=""):
    """A new document: from Cam's template for its kind, or Claude's full body ({intro, sections}). author: who raised it
    (a section head), when it isn't Claude or Cam."""
    if typ not in TYPES:
        raise ValueError("There's no kind of document like that.")
    tpl = json.loads(json.dumps(body if body is not None else TEMPLATES[typ]))
    d = {"ref": next_ref(typ), "type": typ, "title": title or tpl.get("title") or TYPES[typ]["name"], "project": project,
         "from": by, "status": "open", "created": now(), "updated": now(), "intro": tpl.get("intro", ""), "sections": tpl.get("sections", []),
         "by": author}
    return _write(d)


def save(doc):
    """Cam's edits (answers, notes, status, title). The questions themselves stay as they were written."""
    d = clean(doc)
    old = _read(_path(d["ref"]))
    if old and old["type"] != d["type"]:
        raise ValueError("A document can't change its kind.")
    d["updated"] = now()
    if old:
        d["created"] = old["created"]
        d["from"] = old["from"]
        d["by"] = old.get("by", "")
        # the ballots are the voters' own: Cam's page can't change them
        oldb = {it["id"]: it for s in old["sections"] for it in s["items"] if it["kind"] == "ballot"}
        for s in d["sections"]:
            s["items"] = [oldb.get(it["id"], it) if it["kind"] == "ballot" else it for it in s["items"]]
    return _write(d)


GENERAL = "General"
PROJECT_MAX = 60


def _projects_path():
    return os.path.join(root(), "projects.json")


def _clean_project(name):
    return re.sub(r"\s+", " ", str(name or "")).strip()[:PROJECT_MAX]


def _read_projects():
    try:
        with open(_projects_path(), encoding="utf-8") as f:
            p = json.load(f)
    except (OSError, ValueError):
        p = {}
    names = [_clean_project(x.get("name")) for x in p.get("projects", []) if isinstance(x, dict)]
    return {"projects": [{"name": n, "created": x.get("created", "")} for n, x in zip(names, p.get("projects", [])) if n],
            "active": _clean_project(p.get("active")) or ""}


def _write_projects(p):
    tmp = _projects_path() + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(p, f, indent=1, ensure_ascii=False)
    os.replace(tmp, _projects_path())


def projects():
    """The projects, like the Notes app's vaults: the list (General first, then the rest in the order they were made), each
    with how many documents it has and how many wait for Cam; and the one being looked at ("" = every project)."""
    p = _read_projects()
    docs = listing()
    names = [GENERAL] + [x["name"] for x in p["projects"] if x["name"] != GENERAL]
    for d in docs:                                                    # a project only documents name (written by Claude, say)
        n = d["project"] or GENERAL
        if n not in names:
            names.append(n)
    out = []
    for n in names:
        mine = [d for d in docs if (d["project"] or GENERAL) == n]
        out.append({"name": n, "docs": len(mine), "waiting": sum(1 for d in mine if d["status"] == "open" and not d.get("archived")),
                    "fresh": sum(1 for d in mine if d.get("new"))})
    active = p["active"] if p["active"] in names else ""
    return {"projects": out, "active": active}


def new_project(name):
    n = _clean_project(name)
    if not n:
        raise ValueError("Give the project a name.")
    p = _read_projects()
    if n.lower() in [GENERAL.lower()] + [x["name"].lower() for x in p["projects"]] + [(d["project"] or "").lower() for d in listing()]:
        raise ValueError("There's already a project called that.")
    p["projects"].append({"name": n, "created": now()})
    p["active"] = n
    _write_projects(p)
    return projects()


def rename_project(old, new_name):
    """A project's new name -- its documents move with it."""
    o, n = _clean_project(old), _clean_project(new_name)
    if not n:
        raise ValueError("Give the project a name.")
    if o == GENERAL:
        raise ValueError("General keeps its name.")
    p = _read_projects()
    if n.lower() != o.lower() and n.lower() in [GENERAL.lower()] + [x["name"].lower() for x in p["projects"]]:
        raise ValueError("There's already a project called that.")
    for x in p["projects"]:
        if x["name"] == o:
            x["name"] = n
    if not any(x["name"] == n for x in p["projects"]):
        p["projects"].append({"name": n, "created": now()})
    if p["active"] == o:
        p["active"] = n
    _write_projects(p)
    for d in listing():
        if d["project"] == o:
            doc = _read(_path(d["ref"]))
            doc["project"] = n
            _write(doc)
    return projects()


def delete_project(name, docs="move"):
    """A project gone (2026-11-18, Cam: "I need a way to delete projects in collaboration"). Its documents either move to
    General (docs="move") or go with it (docs="delete": into collab/deleted, like one deleted on its own, never gone at
    once). Archived ones too, so the project can't come back by a document still naming it. General stays."""
    n = _clean_project(name)
    if not n or n == GENERAL:
        raise ValueError("General can't be deleted.")
    if docs not in ("move", "delete"):
        raise ValueError("Move its documents to General, or delete them with it.")
    if n not in [x["name"] for x in projects()["projects"]]:
        raise ValueError("There's no project called that.")
    for d in listing():
        if d["project"] == n:
            if docs == "delete":
                remove(d["ref"])
            else:
                doc = _read(_path(d["ref"]))
                doc["project"] = ""
                _write(doc)
    p = _read_projects()
    p["projects"] = [x for x in p["projects"] if x["name"] != n]
    if p["active"] == n:
        p["active"] = ""
    _write_projects(p)
    return projects()


def set_active_project(name):
    """The project the desk is showing ("" = every project)."""
    p = _read_projects()
    p["active"] = _clean_project(name)
    _write_projects(p)
    return projects()


def remove(ref):
    """Into collab/deleted/ (never gone at once)."""
    path = _path(ref)
    if not os.path.exists(path):
        return {"error": "That document is gone."}
    dd = os.path.join(root(), "deleted")
    os.makedirs(dd, exist_ok=True)
    shutil.move(path, os.path.join(dd, ref + "-" + now().replace(":", "") + ".json"))
    return {"ok": True}
