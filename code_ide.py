"""
code_ide.py -- Code -> IDE: Algorithm, inside NeuroNet.

Cam (2026-10-01): "intergrate Algorithm found in /mnt/Cams_Collective into
NeuroNet under Code main section and be in IDE sub section, there will be
more sub sections later included guides, ebooks etc."

This is Algorithm's own back end (algorithm.py), moved across nearly
whole: the same Api, the same rules -- a project is a real folder of real
files, saves are atomic and refuse to overwrite a file changed underneath,
every path is checked to stay inside its project, drafts survive a crash.
What changed:

  * the data lives in NeuroNet's data folder, neuronet_data/code/
    (projects/, guides/, drafts/, settings.json, code.log) -- ROOT, set by
    neuronet.py on every call, since Settings -> Data folder can move it;
  * no window of its own: NeuroNet's Api hands each code_<name> call to
    the Api here (neuronet.py, "Code -> IDE"), and the file pickers open on
    NeuroNet's window;
  * runner.py is code_runner.py.

The interface is ui/code/ (Algorithm's ui/, drawn in a shadow root so its
styles and ids and NeuroNet's never meet). Tests: test/test_code_ide.py and
test/test_code_ide.js.

Algorithm's own notes, as it had them:

Algorithm -- a small code editor with projects, guides and split view.

THE FILES ARE THE TRUTH. A project is a real folder of real files. Nothing
is kept in a database, nothing is stored as a blob inside a JSON index. That
is not a stylistic choice -- it is code, so it has to be runnable by python,
compilable by cargo, openable by any other editor, and committable to git
without Algorithm's involvement. Algorithm is a way of looking at a folder,
not a container the code lives inside.

THE COLLABORATION. Algorithm exports a codebase as one markdown document
with fenced, language-tagged blocks -- the shape Amnesia already reads.
"""

import json
import os
import shutil
import sys
import tempfile
import traceback

import code_runner as runner
from datetime import datetime

APP_NAME = "Algorithm"
RUNNER = runner.Runner()

#: Buffers the interface has told us are unsaved. In memory only — the
#: drafts on disk are what actually survives.
DIRTY = []

#: What Algorithm will open as text. Anything else is listed but not opened,
#: because loading a binary into a textarea corrupts it on the next save.
TEXT_EXTENSIONS = {
    ".py", ".pyw", ".js", ".mjs", ".cjs", ".rs", ".html", ".htm", ".css",
    ".md", ".txt", ".json", ".toml", ".yaml", ".yml", ".sh", ".cfg", ".ini",
    ".sql", ".xml", ".svg", ".rst", ".env", ".gitignore", ".lock",
}

#: Never walked into. These are the folders that make a tree unusable and a
#: scan slow, and none of them is ever something you want to edit by hand.
SKIP_DIRS = {
    ".git", "__pycache__", "node_modules", "target", "venv", ".venv",
    "dist", "build", ".mypy_cache", ".pytest_cache", ".idea", ".vscode",
}

#: A file this big is almost certainly not source, and would lock the
#: interface while it was highlighted.
MAX_TEXT_BYTES = 2 * 1024 * 1024

LANGUAGE_BY_EXT = {
    ".py": "python", ".pyw": "python",
    ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".rs": "rust", ".html": "html", ".htm": "html", ".css": "css",
    ".md": "markdown", ".json": "json", ".toml": "toml", ".sh": "bash",
}


def app_dir():
    return os.path.dirname(os.path.abspath(__file__))


#: neuronet_data/code -- set by neuronet.py before every call (the data folder
#: can be moved while NeuroNet runs). Unset, beside this file, as Algorithm was.
ROOT = None


def data_dir():
    d = ROOT or os.path.join(app_dir(), "code_data")
    os.makedirs(d, exist_ok=True)
    return d


def settings_file():
    return os.path.join(data_dir(), "settings.json")


def load_settings():
    try:
        with open(settings_file(), "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def save_settings(settings):
    _atomic_write(settings_file(), json.dumps(settings, indent=2))
    return True


def projects_root():
    return load_settings().get("projects_dir") \
        or os.path.join(data_dir(), "projects")


def guides_root():
    return load_settings().get("guides_dir") \
        or os.path.join(data_dir(), "guides")


def _atomic_write(path, text):
    """Write via a temporary file and replace.

    The failure that actually happens is a half-written file after a crash
    or a full disk, and replacing an intact file with a truncated one is the
    worst possible outcome for source code.
    """
    folder = os.path.dirname(path)
    os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=".algorithm-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


def _inside(root, path):
    """True if `path` is genuinely within `root`.

    Every path from the interface goes through this. Without it, a name of
    "../../.bashrc" would be honoured, and an editor that can be talked into
    writing anywhere on the disk is a bug with a CVE number.
    """
    try:
        root_real = os.path.realpath(root)
        path_real = os.path.realpath(path)
        return path_real == root_real or path_real.startswith(root_real + os.sep)
    except OSError:
        return False


def language_for(name):
    return LANGUAGE_BY_EXT.get(os.path.splitext(name)[1].lower(), "plain")


def is_text(name):
    ext = os.path.splitext(name)[1].lower()
    return ext in TEXT_EXTENSIONS or not ext


def tree_of(root):
    """The folder as a nested structure, folders first then files."""
    def walk(folder):
        try:
            entries = sorted(os.scandir(folder), key=lambda e: e.name.lower())
        except OSError:
            return []
        folders, files = [], []
        for entry in entries:
            if entry.name.startswith(".") and entry.name not in (".env",):
                continue
            if entry.is_dir():
                if entry.name in SKIP_DIRS:
                    continue
                folders.append({
                    "type": "folder",
                    "name": entry.name,
                    "path": os.path.relpath(entry.path, root),
                    "children": walk(entry.path),
                })
            else:
                try:
                    size = entry.stat().st_size
                except OSError:
                    size = None
                files.append({
                    "type": "file",
                    "name": entry.name,
                    "path": os.path.relpath(entry.path, root),
                    "size": size,
                    "language": language_for(entry.name),
                    "editable": is_text(entry.name)
                    and (size or 0) <= MAX_TEXT_BYTES,
                })
        return folders + files

    if not os.path.isdir(root):
        return []
    return walk(root)


class Api:
    """Everything the interface can ask for.

    Nothing raises across the bridge: an exception here would appear as a
    dead button, so failures come back as {"error": ...} to be shown as
    written.
    """

    @staticmethod
    def _safely(fn, *args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            log_error(traceback.format_exc())
            return {"error": f"{type(exc).__name__}: {exc}"}

    # ---- settings -----------------------------------------------------

    def get_settings(self):
        return self._safely(lambda: {
            **load_settings(),
            "projects_dir": projects_root(),
            "guides_dir": guides_root(),
        })

    def set_setting(self, key, value):
        def run():
            settings = load_settings()
            settings[key] = value
            save_settings(settings)
            return {"ok": True}
        return self._safely(run)

    def choose_folder(self):
        def run():
            import webview
            if not webview.windows:
                return {"error": "No window to open the picker from."}
            result = webview.windows[0].create_file_dialog(webview.FOLDER_DIALOG)
            if not result:
                return {"cancelled": True}
            return {"path": str(result[0] if isinstance(result, (list, tuple))
                                else result)}
        return self._safely(run)

    # ---- projects -----------------------------------------------------

    def list_projects(self):
        def run():
            root = projects_root()
            os.makedirs(root, exist_ok=True)
            out = []
            for name in sorted(os.listdir(root), key=str.lower):
                full = os.path.join(root, name)
                if not os.path.isdir(full) or name.startswith("."):
                    continue
                files = 0
                for dirpath, dirnames, filenames in os.walk(full):
                    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
                    files += len(filenames)
                out.append({
                    "name": name,
                    "path": full,
                    "files": files,
                    "modified": datetime.fromtimestamp(
                        os.path.getmtime(full)).isoformat(timespec="seconds"),
                })
            return out
        return self._safely(run)

    def create_project(self, name):
        def run():
            clean = _safe_name(name)
            if not clean:
                return {"error": "Give the project a name."}
            root = projects_root()
            full = os.path.join(root, clean)
            if os.path.exists(full):
                return {"error": f"“{clean}” already exists."}
            os.makedirs(full)
            return {"ok": True, "name": clean, "path": full}
        return self._safely(run)

    def delete_project(self, name):
        def run():
            full = project_dir(name)
            if not full:
                return {"error": "No such project."}
            shutil.rmtree(full)
            return {"ok": True}
        return self._safely(run)

    def tree(self, project):
        def run():
            root = project_dir(project)
            if not root:
                return {"error": "No such project."}
            return {"root": root, "tree": tree_of(root)}
        return self._safely(run)

    # ---- files --------------------------------------------------------

    def read_file(self, project, rel_path):
        def run():
            root = project_dir(project)
            if not root:
                return {"error": "No such project."}
            full = os.path.join(root, rel_path)
            if not _inside(root, full):
                return {"error": "That path is outside the project."}
            if not os.path.isfile(full):
                return {"error": "No such file."}
            size = os.path.getsize(full)
            if size > MAX_TEXT_BYTES:
                return {"error": f"That file is {size // 1024} KB — too big to "
                                 f"open safely as text."}
            try:
                with open(full, "r", encoding="utf-8") as f:
                    text = f.read()
            except UnicodeDecodeError:
                return {"error": "That looks like a binary file, not text."}
            return {
                "text": text,
                "path": rel_path,
                "language": language_for(rel_path),
                "size": size,
                "modified": os.path.getmtime(full),
            }
        return self._safely(run)

    def write_file(self, project, rel_path, text, expect_modified=None):
        """Save, refusing if the file changed underneath.

        `expect_modified` is the mtime the editor last saw. If the file on
        disk is newer, something else wrote it — another editor, a formatter,
        a git checkout — and overwriting silently would destroy that work.
        """
        def run():
            root = project_dir(project)
            if not root:
                return {"error": "No such project."}
            full = os.path.join(root, rel_path)
            if not _inside(root, full):
                return {"error": "That path is outside the project."}
            if expect_modified is not None and os.path.exists(full):
                current = os.path.getmtime(full)
                if current - float(expect_modified) > 0.5:
                    return {
                        "conflict": True,
                        "error": "This file changed on disk since you opened "
                                 "it. Saving now would overwrite that.",
                        "modified": current,
                    }
            _atomic_write(full, text)
            return {"ok": True, "modified": os.path.getmtime(full)}
        return self._safely(run)

    def create_file(self, project, rel_path):
        def run():
            root = project_dir(project)
            if not root:
                return {"error": "No such project."}
            full = os.path.join(root, rel_path)
            if not _inside(root, full):
                return {"error": "That path is outside the project."}
            if os.path.exists(full):
                return {"error": "Something with that name already exists."}
            _atomic_write(full, "")
            return {"ok": True, "path": rel_path}
        return self._safely(run)

    def create_folder(self, project, rel_path):
        def run():
            root = project_dir(project)
            if not root:
                return {"error": "No such project."}
            full = os.path.join(root, rel_path)
            if not _inside(root, full):
                return {"error": "That path is outside the project."}
            os.makedirs(full, exist_ok=True)
            return {"ok": True}
        return self._safely(run)

    def rename_path(self, project, rel_path, new_name):
        def run():
            root = project_dir(project)
            if not root:
                return {"error": "No such project."}
            full = os.path.join(root, rel_path)
            clean = _safe_name(new_name)
            if not clean:
                return {"error": "Give it a name."}
            target = os.path.join(os.path.dirname(full), clean)
            if not _inside(root, full) or not _inside(root, target):
                return {"error": "That path is outside the project."}
            if not os.path.exists(full):
                return {"error": "No such file."}
            if os.path.exists(target):
                return {"error": "Something with that name already exists."}
            os.rename(full, target)
            return {"ok": True, "path": os.path.relpath(target, root)}
        return self._safely(run)

    def delete_path(self, project, rel_path):
        def run():
            root = project_dir(project)
            if not root:
                return {"error": "No such project."}
            full = os.path.join(root, rel_path)
            if not _inside(root, full):
                return {"error": "That path is outside the project."}
            if os.path.isdir(full):
                shutil.rmtree(full)
            elif os.path.isfile(full):
                os.remove(full)
            else:
                return {"error": "No such file."}
            return {"ok": True}
        return self._safely(run)

    def search_project(self, project, needle, case_sensitive=False,
                       max_files=400, max_hits=300):
        """Find a plain string across every text file in a project.

        Plain text, not a regular expression, for the same reason the
        in-file search is: someone looking for `(` means that character.

        Bounded on purpose. An unbounded walk over a folder with a
        node_modules in it would take long enough to look like a hang, and
        a thousand hits are no more useful than the first hundred — so both
        are capped and the interface is told it was capped rather than being
        handed a quietly incomplete answer.
        """
        def run():
            root = project_dir(project)
            if not root:
                return {"error": "No such project."}
            term = str(needle or "")
            if len(term) < 2:
                return {"error": "Search for at least two characters."}

            compare = term if case_sensitive else term.lower()
            results = []
            hits = 0
            files_read = 0
            truncated = False

            for dirpath, dirnames, filenames in os.walk(root):
                dirnames[:] = sorted(d for d in dirnames
                                     if d not in SKIP_DIRS and not d.startswith("."))
                for name in sorted(filenames):
                    if name.startswith(".") or not is_text(name):
                        continue
                    full = os.path.join(dirpath, name)
                    try:
                        if os.path.getsize(full) > MAX_TEXT_BYTES:
                            continue
                    except OSError:
                        continue

                    files_read += 1
                    if files_read > max_files:
                        truncated = True
                        break

                    try:
                        with open(full, "r", encoding="utf-8") as f:
                            lines = f.read().split("\n")
                    except (OSError, UnicodeDecodeError):
                        continue

                    matches = []
                    offset = 0
                    for number, line in enumerate(lines, start=1):
                        haystack = line if case_sensitive else line.lower()
                        column = haystack.find(compare)
                        if column != -1:
                            matches.append({
                                "line": number,
                                "column": column,
                                # The offset into the whole file, so the
                                # editor can select the match directly
                                # rather than recounting lines itself.
                                "offset": offset + column,
                                "text": line.strip()[:160],
                            })
                            hits += 1
                            if hits >= max_hits:
                                truncated = True
                                break
                        offset += len(line) + 1
                    if matches:
                        results.append({
                            "path": os.path.relpath(full, root),
                            "language": language_for(name),
                            "matches": matches,
                        })
                    if truncated:
                        break
                if truncated:
                    break

            return {
                "results": results,
                "files": len(results),
                "hits": hits,
                "truncated": truncated,
                "length": len(term),
            }
        return self._safely(run)

    # ---- guides -------------------------------------------------------

    def list_guides(self):
        def run():
            root = guides_root()
            os.makedirs(root, exist_ok=True)
            out = []
            for name in sorted(os.listdir(root), key=str.lower):
                full = os.path.join(root, name)
                if not os.path.isfile(full) or name.startswith("."):
                    continue
                ext = os.path.splitext(name)[1].lower()
                if ext not in (".pdf", ".md", ".txt"):
                    continue
                out.append({
                    "name": name,
                    "path": full,
                    "kind": "pdf" if ext == ".pdf" else "markdown",
                    "size": os.path.getsize(full),
                })
            return out
        return self._safely(run)

    def import_guide(self):
        """Copy a PDF or markdown file into the guides folder.

        Copied rather than linked: a reference that vanishes because the
        original was moved is worse than using a little disk.
        """
        def run():
            import webview
            if not webview.windows:
                return {"error": "No window to open the picker from."}
            result = webview.windows[0].create_file_dialog(
                webview.OPEN_DIALOG, allow_multiple=True,
                file_types=("Guides (*.pdf;*.md;*.txt)", "All files (*.*)"))
            if not result:
                return {"cancelled": True}
            root = guides_root()
            os.makedirs(root, exist_ok=True)
            added = []
            for src in result:
                name = os.path.basename(str(src))
                target = os.path.join(root, name)
                stem, ext = os.path.splitext(name)
                n = 2
                while os.path.exists(target):
                    target = os.path.join(root, f"{stem} ({n}){ext}")
                    n += 1
                shutil.copy2(str(src), target)
                added.append(os.path.basename(target))
            return {"ok": True, "added": added}
        return self._safely(run)

    def read_guide(self, name):
        def run():
            full = os.path.join(guides_root(), os.path.basename(name))
            if not _inside(guides_root(), full) or not os.path.isfile(full):
                return {"error": "No such guide."}
            if full.lower().endswith(".pdf"):
                import base64
                with open(full, "rb") as f:
                    return {"kind": "pdf", "name": os.path.basename(full),
                            "dataUrl": "data:application/pdf;base64,"
                            + base64.b64encode(f.read()).decode("ascii")}
            with open(full, "r", encoding="utf-8", errors="replace") as f:
                return {"kind": "markdown", "name": os.path.basename(full),
                        "text": f.read()}
        return self._safely(run)

    def delete_guide(self, name):
        def run():
            full = os.path.join(guides_root(), os.path.basename(name))
            if not _inside(guides_root(), full) or not os.path.isfile(full):
                return {"error": "No such guide."}
            os.remove(full)
            return {"ok": True}
        return self._safely(run)

    # ---- export -------------------------------------------------------

    def export_markdown(self, project, target=None):
        """The whole project as one markdown document.

        Fenced blocks tagged with the language, which is exactly what Amnesia
        renders — so the export is readable there without either app knowing
        anything about the other.
        """
        def run():
            root = project_dir(project)
            if not root:
                return {"error": "No such project."}
            text = build_markdown(root, project)
            out = target or os.path.join(
                os.path.dirname(root), f"{_safe_name(project)}.md")
            _atomic_write(out, text)
            return {"ok": True, "path": out, "bytes": len(text.encode("utf-8"))}
        return self._safely(run)

    def export_preview(self, project, limit=4000):
        def run():
            root = project_dir(project)
            if not root:
                return {"error": "No such project."}
            text = build_markdown(root, project)
            return {"text": text[:limit],
                    "truncated": len(text) > limit,
                    "bytes": len(text.encode("utf-8"))}
        return self._safely(run)

    # ---- unsaved work -------------------------------------------------
    """
    Two layers, because they fail in different ways.

    The CLOSE GUARD asks before the window shuts. It handles the ordinary
    case — you click X with unsaved edits — but it depends on the window
    backend letting us cancel a close, which not every backend does, and it
    cannot help at all if the app crashes or the machine loses power.

    DRAFTS handle everything else. While a buffer is dirty its contents are
    written to neuronet_data/code/drafts/ a couple of seconds after you stop
    typing. If Algorithm reopens and finds a draft newer than the file, it
    offers it back. That is the layer that actually guarantees nothing is
    lost, which is why it exists rather than trusting the dialog alone.
    """

    def set_dirty(self, entries):
        """Tell the host which buffers have unsaved changes.

        Called from the interface whenever that set changes. Held in memory
        only; the drafts on disk are the durable part.
        """
        DIRTY.clear()
        for entry in entries or []:
            project = entry.get("project")
            path = entry.get("path")
            if project and path:
                DIRTY.append({"project": project, "path": path})
        return {"ok": True, "count": len(DIRTY)}

    def save_draft(self, project, rel_path, text):
        def run():
            root = project_dir(project)
            if not root:
                return {"error": "No such project."}
            target = os.path.join(root, rel_path)
            if not _inside(root, target):
                return {"error": "That path is outside the project."}
            _atomic_write(_draft_path(project, rel_path), text)
            return {"ok": True}
        return self._safely(run)

    def clear_draft(self, project, rel_path):
        def run():
            path = _draft_path(project, rel_path)
            if os.path.exists(path):
                os.remove(path)
            return {"ok": True}
        return self._safely(run)

    def list_drafts(self):
        """Drafts that are newer than the file they belong to.

        A draft older than its file means the file was saved afterwards, so
        the draft is stale and offering it would invite overwriting good
        work with old work.
        """
        def run():
            folder = os.path.join(data_dir(), "drafts")
            if not os.path.isdir(folder):
                return []
            out = []
            for name in sorted(os.listdir(folder)):
                full = os.path.join(folder, name)
                if not os.path.isfile(full):
                    continue
                meta = _draft_meta(name)
                if not meta:
                    continue
                project, rel = meta
                root = project_dir(project)
                if not root:
                    continue
                real = os.path.join(root, rel)
                draft_time = os.path.getmtime(full)
                if os.path.exists(real) and os.path.getmtime(real) >= draft_time:
                    os.remove(full)       # superseded; tidy it away
                    continue
                try:
                    with open(full, "r", encoding="utf-8") as f:
                        text = f.read()
                except OSError:
                    continue
                out.append({
                    "project": project, "path": rel, "text": text,
                    "saved": datetime.fromtimestamp(draft_time)
                    .isoformat(timespec="seconds"),
                })
            return out
        return self._safely(run)

    def has_unsaved(self):
        return {"count": len(DIRTY),
                "files": [d["path"] for d in DIRTY]}

    # ---- terminal -----------------------------------------------------

    def run_command(self, project, command):
        def run():
            cwd = project_dir(project)
            if not cwd:
                return {"error": "No such project."}
            return RUNNER.run(command, cwd)
        return self._safely(run)

    def run_output(self, session_id, since=0):
        return self._safely(RUNNER.get, session_id, since)

    def run_input(self, session_id, text):
        return self._safely(RUNNER.write, session_id, text)

    def run_stop(self, session_id):
        return self._safely(RUNNER.stop, session_id)

    def command_history(self):
        """Commands run before, newest first.

        Kept per project rather than globally: `cargo test` in a Rust
        project and `pytest` in a Python one should not be interleaved in
        one list you have to scroll past each other.
        """
        return self._safely(lambda: load_settings().get("history", {}))

    def remember_command(self, project, command):
        def run():
            # A different name, deliberately: assigning to `command` here
            # would make it local to this function, and reading it on the
            # same line would then fail before the outer value could be
            # seen at all. Python decides local-or-not for the whole
            # function body, not line by line.
            text = str(command or "").strip()
            if not text:
                return {"ok": True}
            settings = load_settings()
            history = settings.setdefault("history", {})
            entries = history.setdefault(str(project), [])
            # Move a repeat to the front rather than storing it twice; a
            # history with the same command forty times is a worse history.
            if text in entries:
                entries.remove(text)
            entries.insert(0, text)
            del entries[40:]
            save_settings(settings)
            return {"ok": True}
        return self._safely(run)

    def run_suggestions(self, language, rel_path=None):
        return self._safely(lambda: {
            "commands": runner.suggestions(language, rel_path)})

    # ---- diagnostics --------------------------------------------------

    def log_error(self, message):
        return log_error(message)

    def read_log(self, limit=80):
        try:
            with open(os.path.join(data_dir(), "algorithm.log"), "r",
                      encoding="utf-8", errors="replace") as f:
                return "".join(f.readlines()[-int(limit):])
        except OSError:
            return ""


def _draft_path(project, rel_path):
    """One flat file per buffer.

    The project and path are encoded into the filename rather than mirrored
    as a folder tree, because a tree of empty directories left behind after
    every save is worse than a flat folder that is easy to inspect and easy
    to clear.
    """
    folder = os.path.join(data_dir(), "drafts")
    os.makedirs(folder, exist_ok=True)
    safe = f"{project}\x1f{rel_path}".replace("/", "\x1e")
    import base64
    token = base64.urlsafe_b64encode(safe.encode("utf-8")).decode("ascii")
    return os.path.join(folder, token + ".draft")


def _draft_meta(filename):
    """The project and path a draft belongs to, or None if unreadable."""
    if not filename.endswith(".draft"):
        return None
    import base64
    try:
        raw = base64.urlsafe_b64decode(filename[:-6].encode("ascii"))
        text = raw.decode("utf-8")
    except Exception:
        return None
    if "\x1f" not in text:
        return None
    project, rel = text.split("\x1f", 1)
    return project, rel.replace("\x1e", "/")


def project_dir(name):
    """The folder for a project, or None if the name is not a real one.

    os.path.join(root, "") returns the root itself, so a name that sanitises
    to nothing — "..", "/", "." — silently resolved to the projects folder
    and commands ran there. Every caller goes through this instead.
    """
    clean = _safe_name(name)
    if not clean:
        return None
    full = os.path.join(projects_root(), clean)
    if not _inside(projects_root(), full) or not os.path.isdir(full):
        return None
    return full


def _safe_name(text):
    """A single path component, with anything that could escape removed."""
    cleaned = str(text or "").strip().replace("\\", "/")
    cleaned = cleaned.split("/")[-1]
    cleaned = "".join(c for c in cleaned if c not in '<>:"|?*\x00')
    if cleaned in (".", ".."):
        return ""
    return cleaned[:120]


MARKDOWN_FENCE_LANGS = {
    "python": "python", "javascript": "javascript", "rust": "rust",
    "html": "html", "css": "css", "markdown": "markdown", "json": "json",
    "toml": "toml", "bash": "bash", "plain": "",
}


def build_markdown(root, title):
    """One markdown document for a whole project.

    Files in tree order, each under its own heading with a fenced block. A
    fence long enough to contain the file's own backticks, because a
    markdown file inside the project would otherwise close the fence early
    and corrupt everything after it.
    """
    lines = [f"# {title}", "",
             f"Exported from Algorithm on "
             f"{datetime.now().strftime('%d %b %Y')}.", ""]

    collected = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS
                             and not d.startswith("."))
        for name in sorted(filenames):
            if name.startswith("."):
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root)
            collected.append((rel, full))

    if collected:
        lines.append("## Contents")
        lines.append("")
        for rel, _ in collected:
            lines.append(f"- `{rel}`")
        lines.append("")

    for rel, full in collected:
        lines.append(f"## {rel}")
        lines.append("")
        if not is_text(name_of(full)) or os.path.getsize(full) > MAX_TEXT_BYTES:
            lines.append(f"*Not included — {os.path.getsize(full)} bytes, "
                         f"not a text file.*")
            lines.append("")
            continue
        try:
            with open(full, "r", encoding="utf-8") as f:
                body = f.read()
        except (OSError, UnicodeDecodeError):
            lines.append("*Could not be read as text.*")
            lines.append("")
            continue

        fence = "```"
        while fence in body:
            fence += "`"
        lang = MARKDOWN_FENCE_LANGS.get(language_for(rel), "")
        lines.append(f"{fence}{lang}")
        lines.append(body.rstrip("\n"))
        lines.append(fence)
        lines.append("")

    return "\n".join(lines)


def name_of(path):
    return os.path.basename(path)


LOG_MAX_MESSAGE = 1000
LOG_KEEP_LINES = 200
LOG_TRIM_AT_BYTES = 256 * 1024


def log_error(message):
    try:
        text = str(message).replace("\r", " ").replace("\n", " | ")
        if len(text) > LOG_MAX_MESSAGE:
            text = text[:LOG_MAX_MESSAGE] + " …(truncated)"
        line = f"{datetime.now().isoformat(timespec='seconds')}  {text}\n"
        path = os.path.join(data_dir(), "code.log")
        if os.path.isfile(path) and os.path.getsize(path) > LOG_TRIM_AT_BYTES:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                tail = f.readlines()[-LOG_KEEP_LINES:]
            with open(path, "w", encoding="utf-8") as f:
                f.writelines(tail)
        with open(path, "a", encoding="utf-8") as f:
            f.write(line)
        return True
    except OSError:
        return False
