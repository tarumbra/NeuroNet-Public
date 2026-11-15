"""Code -> Web playground: Cam's HTML + CSS pages, kept on disk.

Cam (2026-10-02): "create an environment that i can code html and css in
where it will have one side of the screen for my code and the other to run a
live environment where it can show me my changes instantly ... When creating
take the perspective of a senior cyber security expert to ensure there is no
chance for remote code execution within the application."

Each page is one JSON file in neuronet_data/code/web/<id>.json:
{"name", "html", "css", "updated"}.

SECURITY, this side: the page only ever names a page by its id, and an id is
checked against a strict pattern (lower-case letters, digits and dashes) --
never a path -- so nothing can read or write outside this folder. Sizes are
capped. Nothing here runs, opens or serves anything; the preview is drawn by
the page in a fully sandboxed frame (ui/code/web.js). Export writes one file
where Cam chooses in the save dialog.
"""
import datetime
import json
import os
import re

ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,59}$")
MAX_CHARS = 1_000_000          # per part (html, css): a page, not a data dump


def _ok_id(pid):
    return isinstance(pid, str) and bool(ID.match(pid))


def folder(data_dir):
    d = os.path.join(data_dir, "code", "web")
    os.makedirs(d, exist_ok=True)
    return d


def _path(data_dir, pid):
    return os.path.join(folder(data_dir), pid + ".json")


def new_id(name, data_dir):
    base = re.sub(r"[^a-z0-9]+", "-", str(name or "").lower()).strip("-")[:40] or "page"
    if not base[0].isalnum():
        base = "page"
    pid, n = base, 2
    while os.path.exists(_path(data_dir, pid)):
        pid = "%s-%d" % (base, n)
        n += 1
    return pid


def listing(data_dir):
    out = []
    for f in sorted(os.listdir(folder(data_dir))):
        if not f.endswith(".json") or not _ok_id(f[:-5]):
            continue
        try:
            with open(os.path.join(folder(data_dir), f), encoding="utf-8") as fh:
                d = json.load(fh)
        except (OSError, ValueError):
            continue
        out.append({"id": f[:-5], "name": str(d.get("name") or f[:-5]), "updated": str(d.get("updated") or "")})
    out.sort(key=lambda x: x["updated"], reverse=True)
    return out


def read(data_dir, pid):
    if not _ok_id(pid):
        return {"error": "There's no page called that."}
    try:
        with open(_path(data_dir, pid), encoding="utf-8") as f:
            d = json.load(f)
    except (OSError, ValueError):
        return {"error": "That page isn't there any more."}
    return {"id": pid, "name": str(d.get("name") or pid), "html": str(d.get("html") or ""),
            "css": str(d.get("css") or ""), "updated": str(d.get("updated") or "")}


def write(data_dir, pid, doc):
    """Save a page; pid None or "" makes a new one. -> {ok, id} or {error}."""
    doc = doc if isinstance(doc, dict) else {}
    name = str(doc.get("name") or "").strip()[:80] or "Untitled page"
    html, css = str(doc.get("html") or ""), str(doc.get("css") or "")
    if len(html) > MAX_CHARS or len(css) > MAX_CHARS:
        return {"error": "That page is too big to keep (a million characters a part)."}
    if not pid:
        pid = new_id(name, data_dir)
    if not _ok_id(pid):
        return {"error": "There's no page called that."}
    p = _path(data_dir, pid)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"name": name, "html": html, "css": css,
                   "updated": datetime.datetime.now().isoformat(timespec="seconds")}, f, indent=1)
    os.replace(tmp, p)
    return {"ok": True, "id": pid, "name": name}


def delete(data_dir, pid):
    if not _ok_id(pid):
        return {"error": "There's no page called that."}
    try:
        os.remove(_path(data_dir, pid))
    except FileNotFoundError:
        pass
    except OSError as e:
        return {"error": "Couldn't delete it: %s" % e}
    return {"ok": True}


def as_html(page):
    """One standalone .html file of a page: its HTML with its CSS in the head."""
    css = str(page.get("css") or "").replace("</style", "<\\/style")
    html = str(page.get("html") or "")
    title = re.sub(r"[<>&\"]", "", str(page.get("name") or "Page"))
    if re.search(r"<html[\s>]", html, re.I):
        # a whole document already: the CSS goes into its head
        style = "<style>\n%s\n</style>\n" % css
        if re.search(r"</head>", html, re.I):
            return re.sub(r"</head>", lambda m: style + m.group(0), html, count=1, flags=re.I)
        return re.sub(r"<html[^>]*>", lambda m: m.group(0) + "<head>" + style + "</head>", html, count=1, flags=re.I)
    return ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
            "<title>%s</title>\n<style>\n%s\n</style>\n</head>\n<body>\n%s\n</body>\n</html>\n" % (title, css, html))
