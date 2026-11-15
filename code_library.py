"""
code_library.py -- Code's library: Guides, Data Structures and Research.

Cam (2026-10-01): "Code mainsection is also going to have guides (built out
like Neuro guides, but where i will place code snippet guides and
tutorials). Algorthm research (new tool, where i can annotate, highlight and
make text boxes around a code base i wrote and dig deeper into how it works,
think like a code review tool). Also then a data structures sub section
(This will contain common data structures and their implementations in
Python and Javascript ...). Think of it as an environment i can use to learn
not just programming but great software design. All guides, data structures
ect. Need to have the ability to add more."

THE FILES ARE THE TRUTH, as they are in the IDE. A guide is one markdown
file; a data structure is a folder holding about.md and one source file per
language (python.py, javascript.js, ...), each runnable on its own -- so the
implementations can be opened in any editor and run by a test. A research
study is one JSON file of annotations over a folder the study only ever
READS.

BUILT IN, AND YOURS. NeuroNet ships a starter library in code_library/
beside this file. Cam's own additions and edits live in his data folder,
neuronet_data/code/library/. The two are merged by slug:

  * his copy of a slug wins, so editing a built-in guide saves HIS copy and
    a NeuroNet update can never overwrite it ("Back to NeuroNet's" deletes
    his copy and the built-in shows again);
  * deleting a built-in hides it (hidden.json), since the file belongs to
    the app and comes back with every update; "Show hidden" brings it back;
  * a NEW built-in arriving in an update simply appears.

Answered by NeuroNet's Api as code_lib_<name> (neuronet.py, CODE_LIB_CALLS).
Tests: test/test_code_library.py (this, and every built-in implementation
and runnable guide snippet actually run) and test/test_code_library.js.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import traceback
from datetime import datetime

import code_ide

KINDS = ("guides", "structures")

#: The languages a data structure can be written in: file name, the
#: highlighter's name for it (ui/code/highlight.js; "plain" if it has none),
#: and how it's run. Anything here can be added to a structure in the app.
LANGUAGES = {
    "python":     {"label": "Python",     "file": "python.py",     "hl": "python"},
    "javascript": {"label": "JavaScript", "file": "javascript.js", "hl": "javascript"},
    "typescript": {"label": "TypeScript", "file": "typescript.ts", "hl": "javascript"},
    "rust":       {"label": "Rust",       "file": "rust.rs",       "hl": "rust"},
    "go":         {"label": "Go",         "file": "go.go",         "hl": "plain"},
    "c":          {"label": "C",          "file": "c.c",           "hl": "plain"},
    "cpp":        {"label": "C++",        "file": "cpp.cpp",       "hl": "plain"},
    "java":       {"label": "Java",       "file": "Main.java",     "hl": "plain"},
}
FILE_TO_LANG = {v["file"]: k for k, v in LANGUAGES.items()}

RUN_TIMEOUT = 15
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")

#: Research reads a folder Cam wrote; anything that isn't text is listed but
#: not opened. Wider than the IDE's list -- research only ever reads.
MAX_READ_BYTES = 2 * 1024 * 1024
MAX_STUDY_FILES = 20000


def builtin_dir():
    return os.path.join(code_ide.app_dir(), "code_library")


def user_dir():
    return os.path.join(code_ide.data_dir(), "library")


def research_dir():
    return os.path.join(user_dir(), "research")


def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", str(text or "").lower()).strip("-")[:60].strip("-")
    return s or "untitled"


def _check_slug(slug):
    if not isinstance(slug, str) or not SLUG.match(slug):
        raise ValueError("That name can't be used.")
    return slug


def _check_kind(kind):
    if kind not in KINDS:
        raise ValueError("Unknown library: %r" % (kind,))
    return kind


# ---- markdown with front matter ---------------------------------------------

def parse_front(text):
    """`---\\nkey: value\\n---\\nbody` -> (meta, body). No front matter, no meta."""
    text = str(text or "").replace("\r\n", "\n")
    meta = {}
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            for line in text[4:end].split("\n"):
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip().lower()] = v.strip()
            text = text[end + 4:].lstrip("\n")
    return meta, text.rstrip("\n")


def with_front(meta, body):
    lines = ["---"]
    for k, v in meta.items():
        v = " ".join(str(v if v is not None else "").split())
        if v:
            lines.append("%s: %s" % (k, v))
    lines.append("---")
    return "\n".join(lines) + "\n\n" + str(body or "").replace("\r\n", "\n").strip() + "\n"


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _order(meta):
    try:
        return float(meta.get("order", 1000))
    except ValueError:
        return 1000.0


# ---- hidden built-ins -------------------------------------------------------

def _hidden_file():
    return os.path.join(user_dir(), "hidden.json")


def load_hidden():
    try:
        with open(_hidden_file(), "r", encoding="utf-8") as f:
            data = json.load(f)
        return {k: list(data.get(k, [])) for k in KINDS}
    except (OSError, ValueError):
        return {k: [] for k in KINDS}


def save_hidden(hidden):
    code_ide._atomic_write(_hidden_file(), json.dumps(hidden, indent=2))


# ---- one item ---------------------------------------------------------------

def _item_path(base, kind, slug):
    if kind == "guides":
        return os.path.join(base, kind, slug + ".md")
    return os.path.join(base, kind, slug)


def _exists(base, kind, slug):
    p = _item_path(base, kind, slug)
    return os.path.isfile(p) if kind == "guides" else os.path.isfile(os.path.join(p, "about.md"))


def _source(kind, slug):
    """Where an item is read from, and whose it is."""
    if _exists(user_dir(), kind, slug):
        return user_dir(), ("edited" if _exists(builtin_dir(), kind, slug) else "mine")
    if _exists(builtin_dir(), kind, slug):
        return builtin_dir(), "builtin"
    return None, None


def _summary(kind, slug, base, origin):
    if kind == "guides":
        meta, body = parse_front(_read(_item_path(base, kind, slug)))
        return {"slug": slug, "title": meta.get("title") or slug,
                "blurb": meta.get("blurb", ""), "topic": meta.get("topic") or "Other",
                "level": meta.get("level", ""), "order": _order(meta), "origin": origin,
                "text": body}
    folder = _item_path(base, kind, slug)
    meta, body = parse_front(_read(os.path.join(folder, "about.md")))
    langs = [FILE_TO_LANG[n] for n in sorted(os.listdir(folder)) if n in FILE_TO_LANG]
    langs.sort(key=lambda k: list(LANGUAGES).index(k))
    return {"slug": slug, "title": meta.get("title") or slug,
            "blurb": meta.get("blurb", ""), "category": meta.get("category") or "Other",
            "order": _order(meta), "origin": origin, "languages": langs, "text": body}


def list_items(kind):
    _check_kind(kind)
    hidden = set(load_hidden()[kind])
    slugs = set()
    for base in (builtin_dir(), user_dir()):
        folder = os.path.join(base, kind)
        if not os.path.isdir(folder):
            continue
        for name in os.listdir(folder):
            slug = name[:-3] if kind == "guides" and name.endswith(".md") else name
            if SLUG.match(slug) and _exists(base, kind, slug):
                slugs.add(slug)
    items, hidden_items = [], []
    for slug in slugs:
        base, origin = _source(kind, slug)
        try:
            item = _summary(kind, slug, base, origin)
        except (OSError, UnicodeDecodeError) as exc:
            code_ide.log_error("library %s/%s: %s" % (kind, slug, exc))
            continue
        if origin == "builtin" and slug in hidden:
            hidden_items.append({"slug": slug, "title": item["title"]})
        else:
            items.append(item)
    group = "topic" if kind == "guides" else "category"
    items.sort(key=lambda i: (i["order"], i[group].lower(), i["title"].lower()))
    return {"items": items, "hidden": sorted(hidden_items, key=lambda i: i["title"].lower()),
            "languages": {k: {"label": v["label"], "hl": v["hl"]} for k, v in LANGUAGES.items()}}


def read_item(kind, slug):
    _check_kind(kind); _check_slug(slug)
    base, origin = _source(kind, slug)
    if not base:
        raise FileNotFoundError("It isn't in the library any more.")
    item = _summary(kind, slug, base, origin)
    if kind == "structures":
        folder = _item_path(base, kind, slug)
        item["code"] = {lang: _read(os.path.join(folder, LANGUAGES[lang]["file"]))
                        for lang in item["languages"]}
    return item


def save_item(kind, slug, data):
    """Save Cam's copy. `slug` None makes a new one (named from its title);
    a built-in's slug saves his edited copy over it."""
    _check_kind(kind)
    data = dict(data or {})
    title = " ".join(str(data.get("title") or "").split())
    if not title:
        raise ValueError("Give it a title.")
    if slug is not None and not str(data.get("order") or "").strip() and _source(kind, slug)[0]:
        # an edited built-in keeps its place in the list
        data["order"] = "%g" % _summary(kind, slug, *_source(kind, slug))["order"]
    if slug is None:
        base_slug = slugify(title)
        slug, n = base_slug, 2
        while _source(kind, slug)[0]:
            slug = "%s-%d" % (base_slug, n); n += 1
    _check_slug(slug)
    if kind == "guides":
        meta = {"title": title, "blurb": data.get("blurb", ""), "topic": data.get("topic", ""),
                "level": data.get("level", ""), "order": data.get("order", "")}
        code_ide._atomic_write(_item_path(user_dir(), kind, slug),
                               with_front(meta, data.get("text", "")))
        return read_item(kind, slug)
    folder = _item_path(user_dir(), kind, slug)
    meta = {"title": title, "blurb": data.get("blurb", ""), "category": data.get("category", ""),
            "order": data.get("order", "")}
    code = data.get("code") or {}
    unknown = [k for k in code if k not in LANGUAGES]
    if unknown:
        raise ValueError("Unknown language: %s" % ", ".join(unknown))
    # A copy is the whole item: a built-in being edited starts from the
    # built-in's files, so a language he didn't touch isn't lost.
    if not os.path.isdir(folder):
        src, _ = _source(kind, slug)
        if src and src != user_dir():
            shutil.copytree(_item_path(src, kind, slug), folder)
    os.makedirs(folder, exist_ok=True)
    code_ide._atomic_write(os.path.join(folder, "about.md"), with_front(meta, data.get("text", "")))
    for lang, text in code.items():
        target = os.path.join(folder, LANGUAGES[lang]["file"])
        if text is None:
            if os.path.exists(target):
                os.remove(target)
        else:
            code_ide._atomic_write(target, str(text))
    return read_item(kind, slug)


def remove_item(kind, slug):
    """Delete Cam's own; put an edited built-in back; hide an untouched built-in."""
    _check_kind(kind); _check_slug(slug)
    base, origin = _source(kind, slug)
    if origin in ("mine", "edited"):
        p = _item_path(user_dir(), kind, slug)
        if kind == "guides":
            os.remove(p)
        else:
            shutil.rmtree(p)
        return {"ok": True, "was": origin}
    if origin == "builtin":
        hidden = load_hidden()
        if slug not in hidden[kind]:
            hidden[kind].append(slug)
        save_hidden(hidden)
        return {"ok": True, "was": "builtin"}
    return {"ok": True, "was": None}


def unhide(kind, slug):
    _check_kind(kind); _check_slug(slug)
    hidden = load_hidden()
    hidden[kind] = [s for s in hidden[kind] if s != slug]
    save_hidden(hidden)
    return {"ok": True}


# ---- running an implementation ----------------------------------------------

def _which(*names):
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    return None


def run_commands(lang, src, work):
    """The commands that build and run `src` in `work`, or an error."""
    if lang == "python":
        py = sys.executable if not getattr(sys, "frozen", False) else _which("python3", "python")
        return [[py or "python3", "-X", "utf8", src]], None
    if lang in ("javascript", "typescript"):
        node = _which("node")
        if not node:
            return None, "Node.js isn't installed, so JavaScript can't run here (sudo pacman -S nodejs)."
        return [[node, src]], None
    if lang == "go":
        go = _which("go")
        return ([[go, "run", src]], None) if go else (None, "Go isn't installed (sudo pacman -S go).")
    exe = os.path.join(work, "program")
    if lang == "rust":
        rc = _which("rustc")
        return ([[rc, "-O", "-o", exe, src], [exe]], None) if rc \
            else (None, "Rust isn't installed (sudo pacman -S rust).")
    if lang in ("c", "cpp"):
        cc = _which("cc", "gcc", "clang") if lang == "c" else _which("c++", "g++", "clang++")
        return ([[cc, "-O2", "-o", exe, src], [exe]], None) if cc \
            else (None, "No %s compiler is installed (sudo pacman -S gcc)." % LANGUAGES[lang]["label"])
    if lang == "java":
        java = _which("java")
        return ([[java, src]], None) if java else (None, "Java isn't installed (sudo pacman -S jdk-openjdk).")
    return None, "%s can't be run here." % lang


def run_code(lang, text):
    """Run one implementation in a fresh temporary folder, so a run can't
    touch the library (or anything else) and leaves nothing behind."""
    if lang not in LANGUAGES:
        raise ValueError("Unknown language: %r" % (lang,))
    work = tempfile.mkdtemp(prefix="neuronet-run-")
    try:
        src = os.path.join(work, LANGUAGES[lang]["file"])
        with open(src, "w", encoding="utf-8") as f:
            f.write(str(text or ""))
        commands, error = run_commands(lang, src, work)
        if error:
            return {"ok": False, "output": error, "code": None}
        output = []
        for cmd in commands:
            try:
                p = subprocess.run(cmd, cwd=work, capture_output=True, text=True,
                                   timeout=RUN_TIMEOUT, stdin=subprocess.DEVNULL)
            except subprocess.TimeoutExpired:
                output.append("Stopped after %d seconds -- is something looping forever?" % RUN_TIMEOUT)
                return {"ok": False, "output": "".join(output), "code": None}
            output.append(p.stdout + p.stderr)
            if p.returncode != 0:
                return {"ok": False, "output": "".join(output).replace(work + os.sep, ""),
                        "code": p.returncode}
        return {"ok": True, "output": "".join(output).replace(work + os.sep, ""), "code": 0}
    finally:
        shutil.rmtree(work, ignore_errors=True)


# ---- research ---------------------------------------------------------------

def _study_path(slug):
    return os.path.join(research_dir(), _check_slug(slug) + ".json")


def load_study(slug):
    with open(_study_path(slug), "r", encoding="utf-8") as f:
        study = json.load(f)
    study["slug"] = slug
    study.setdefault("annotations", [])
    study.setdefault("overview", "")
    return study


def list_studies():
    out = []
    folder = research_dir()
    if os.path.isdir(folder):
        for name in sorted(os.listdir(folder)):
            if not name.endswith(".json") or not SLUG.match(name[:-5]):
                continue
            try:
                s = load_study(name[:-5])
            except (OSError, ValueError):
                continue
            out.append({"slug": s["slug"], "name": s.get("name") or s["slug"],
                        "path": s.get("path", ""), "found": os.path.isdir(s.get("path", "")),
                        "notes": len(s["annotations"]), "updated": s.get("updated", "")})
    out.sort(key=lambda s: s["updated"], reverse=True)
    return out


def create_study(name, path):
    name = " ".join(str(name or "").split())
    path = os.path.abspath(os.path.expanduser(str(path or "")))
    if not os.path.isdir(path):
        raise ValueError("That folder isn't there.")
    name = name or os.path.basename(path.rstrip(os.sep)) or "Study"
    base = slugify(name)
    slug, n = base, 2
    while os.path.exists(os.path.join(research_dir(), slug + ".json")):
        slug = "%s-%d" % (base, n); n += 1
    now = datetime.now().isoformat(timespec="seconds")
    study = {"name": name, "path": path, "created": now, "updated": now,
             "overview": "", "annotations": []}
    code_ide._atomic_write(_study_path(slug), json.dumps(study, indent=2))
    return load_study(slug)


ANNOTATION_KINDS = ("highlight", "note", "box")
COLOURS = ("yellow", "green", "blue", "pink", "orange", "purple")


def _clean_annotation(a):
    a = dict(a or {})
    if a.get("kind") not in ANNOTATION_KINDS:
        raise ValueError("Unknown annotation: %r" % (a.get("kind"),))
    pos = lambda p: {"line": max(1, int((p or {}).get("line", 1))),
                     "col": max(0, int((p or {}).get("col", 0)))}
    out = {"id": str(a.get("id") or "")[:40], "kind": a["kind"], "file": str(a.get("file") or ""),
           "start": pos(a.get("start")), "end": pos(a.get("end")),
           "colour": a.get("colour") if a.get("colour") in COLOURS else "yellow",
           "label": str(a.get("label") or "")[:200], "text": str(a.get("text") or ""),
           "quote": str(a.get("quote") or ""), "created": str(a.get("created") or ""),
           "updated": str(a.get("updated") or ""), "lost": bool(a.get("lost"))}
    if not out["id"] or not out["file"]:
        raise ValueError("An annotation needs an id and a file.")
    return out


def save_study(slug, changes):
    """Name, overview and the whole annotation list -- the interface always
    sends the list it has, so the file is never half one thing."""
    study = load_study(slug)
    changes = dict(changes or {})
    if "name" in changes:
        study["name"] = " ".join(str(changes["name"]).split()) or study["name"]
    if "overview" in changes:
        study["overview"] = str(changes["overview"] or "")
    if "path" in changes:
        p = os.path.abspath(os.path.expanduser(str(changes["path"])))
        if not os.path.isdir(p):
            raise ValueError("That folder isn't there.")
        study["path"] = p
    if "last_file" in changes:
        study["last_file"] = str(changes["last_file"] or "")
    if "annotations" in changes:
        study["annotations"] = [_clean_annotation(a) for a in changes["annotations"]]
    study["updated"] = datetime.now().isoformat(timespec="seconds")
    study.pop("slug", None)
    code_ide._atomic_write(_study_path(slug), json.dumps(study, indent=2))
    return load_study(slug)


def delete_study(slug):
    """Only the notes go -- the folder being studied is never touched."""
    p = _study_path(slug)
    if os.path.exists(p):
        os.remove(p)
    return {"ok": True}


def _looks_text(path):
    try:
        with open(path, "rb") as f:
            head = f.read(8192)
    except OSError:
        return False
    if b"\0" in head:
        return False
    try:
        head.decode("utf-8")
    except UnicodeDecodeError as exc:
        return exc.start > len(head) - 4    # a character cut at the edge
    return True


def study_tree(slug):
    study = load_study(slug)
    root = study.get("path", "")
    if not os.path.isdir(root):
        return {"root": root, "found": False, "tree": []}
    tree = code_ide.tree_of(root)
    count = [0]

    def mark(nodes):
        kept = []
        for n in nodes:
            if count[0] >= MAX_STUDY_FILES:
                break
            if n["type"] == "folder":
                n["children"] = mark(n["children"])
            else:
                count[0] += 1
                n["readable"] = (n.get("size") or 0) <= MAX_READ_BYTES \
                    and _looks_text(os.path.join(root, n["path"]))
            kept.append(n)
        return kept
    return {"root": root, "found": True, "tree": mark(tree)}


def study_file(slug, rel):
    study = load_study(slug)
    root = study.get("path", "")
    full = os.path.join(root, str(rel or ""))
    if not rel or not code_ide._inside(root, full) or not os.path.isfile(full):
        raise ValueError("That file isn't in the folder being studied.")
    if os.path.getsize(full) > MAX_READ_BYTES:
        raise ValueError("That file is too big to study here.")
    if not _looks_text(full):
        raise ValueError("That isn't a text file.")
    with open(full, "r", encoding="utf-8", errors="replace") as f:
        text = f.read().replace("\r\n", "\n")
    ext = os.path.splitext(full)[1].lower()
    lang = {".ts": "javascript", ".tsx": "javascript", ".jsx": "javascript",
            ".qml": "javascript", ".lua": "plain"}.get(ext) or code_ide.language_for(full)
    return {"path": rel, "text": text, "language": lang,
            "modified": os.path.getmtime(full)}


def study_markdown(slug):
    """The study as one review document: the overview, then every file's
    notes in line order, each with the code it's about."""
    study = load_study(slug)
    out = ["# " + study.get("name", slug), ""]
    out.append("Folder: `%s`  " % study.get("path", ""))
    out.append("Exported %s from NeuroNet -> Code -> Research." % datetime.now().strftime("%d %B %Y"))
    out.append("")
    if study.get("overview", "").strip():
        out += ["## Overview", "", study["overview"].strip(), ""]
    by_file = {}
    for a in study["annotations"]:
        by_file.setdefault(a["file"], []).append(a)
    for f in sorted(by_file):
        out += ["## " + f, ""]
        for a in sorted(by_file[f], key=lambda a: (a["start"]["line"], a["start"]["col"])):
            lines = (("line %d" % a["start"]["line"]) if a["start"]["line"] == a["end"]["line"]
                     else ("lines %d-%d" % (a["start"]["line"], a["end"]["line"])))
            head = {"highlight": "Highlight", "note": "Note", "box": "Box"}[a["kind"]]
            if a.get("label"):
                head += ": " + a["label"]
            out.append("### %s (%s)%s" % (head, lines, " -- the code has changed since" if a.get("lost") else ""))
            out.append("")
            lang = code_ide.language_for(f)
            out += ["```" + ("" if lang == "plain" else lang), a.get("quote", "").rstrip("\n"), "```", ""]
            if a.get("text", "").strip():
                out += [a["text"].strip(), ""]
    return "\n".join(out).rstrip() + "\n"


# ---- the Api ----------------------------------------------------------------

def _safely(fn, *args):
    try:
        return fn(*args)
    except (ValueError, FileNotFoundError) as exc:
        return {"error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        code_ide.log_error(traceback.format_exc())
        return {"error": "%s: %s" % (type(exc).__name__, exc)}


class Api:
    """What the interface calls, as code_lib_<name>. Every failure comes
    back as {"error": ...} to be shown as written."""

    def list(self, kind):
        return _safely(list_items, kind)

    def read(self, kind, slug):
        return _safely(read_item, kind, slug)

    def save(self, kind, slug, data):
        return _safely(save_item, kind, slug, data)

    def remove(self, kind, slug):
        return _safely(remove_item, kind, slug)

    def unhide(self, kind, slug):
        return _safely(unhide, kind, slug)

    def run(self, lang, text):
        return _safely(run_code, lang, text)

    def studies(self):
        return _safely(list_studies)

    def study(self, slug):
        return _safely(load_study, slug)

    def study_create(self, name, path):
        return _safely(create_study, name, path)

    def study_save(self, slug, changes):
        return _safely(save_study, slug, changes)

    def study_delete(self, slug):
        return _safely(delete_study, slug)

    def study_tree(self, slug):
        return _safely(study_tree, slug)

    def study_file(self, slug, rel):
        return _safely(study_file, slug, rel)

    def study_markdown(self, slug):
        return _safely(lambda: {"text": study_markdown(slug)})

    def choose_folder(self):
        return code_ide.Api().choose_folder()

    def export_study(self, slug):
        def run():
            import webview
            text = study_markdown(slug)
            if not webview.windows:
                return {"error": "No window to open the picker from."}
            name = slugify(load_study(slug).get("name", slug)) + "-research.md"
            picked = webview.windows[0].create_file_dialog(webview.SAVE_DIALOG, save_filename=name)
            if not picked:
                return {"cancelled": True}
            target = str(picked[0] if isinstance(picked, (list, tuple)) else picked)
            code_ide._atomic_write(target, text)
            return {"path": target}
        return _safely(run)


CALLS = ("list", "read", "save", "remove", "unhide", "run",
         "studies", "study", "study_create", "study_save", "study_delete",
         "study_tree", "study_file", "study_markdown", "choose_folder", "export_study")
