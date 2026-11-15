#!/usr/bin/env python3
"""The team's way onto the Collaboration desk, with a pop-up (2026-11-08, Cam: "If a new idea is added to collaboration
during a prompt have a pop up appear with a notification that something has been added. This will allow it to prompt me
to check collaboration and action some along the way. This project should be a rolling collaboration from the whole team").

    python3 tools/collab_post.py idea --by "Software Engineer" --title "..." --idea "..." --why "..." [--when a|b|c]
                                      [--project "NeuroNet: Ideas and Plans"] [--from cam]
    python3 tools/collab_post.py notify <code> [--what "New idea"]     (one written another way: just the pop-up)
    python3 tools/collab_post.py project "<name>"                      (make sure a project is there)

An idea is collab.py's Idea form (the same one + Idea starts), filled in by the section head who raised it ("by"); --when
is its "When?" answer (a now, b soon, c later: kept). The pop-up says what came in and who from; clicking it opens the
document in NeuroNet (neuronet-open collab <code>). NEURONET_NO_NOTIFY=1: no pop-up (tests), the line printed instead.
"""
import argparse
import os
import shutil
import subprocess
import sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)
import collab  # noqa: E402

ROLLING = "NeuroNet: Ideas and Plans"


def data_dir():
    if os.environ.get("NEURONET_DATA"):
        return os.environ["NEURONET_DATA"]
    try:
        d = subprocess.run(["neuronet-path", "data"], capture_output=True, text=True, timeout=10).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        d = ""
    return d or os.path.join(APP, "neuronet_data")


def notify(ref, what=""):
    """The pop-up: "New idea in Collaboration", its code, title and who raised it. Clicking it opens it in NeuroNet."""
    d = collab.get(ref)
    if not d or d.get("error"):
        sys.exit(f"collab_post: there's no {ref}")
    kind = collab.TYPES[d["type"]]["name"].lower()
    head = f"New {what or kind} in Collaboration"
    body = f"{d['ref']}: {d['title']}" + (f"\nfrom the {d['by']}" if d.get("by") else "") + (f"\n{d['project']}" if d.get("project") else "")
    if os.environ.get("NEURONET_NO_NOTIFY") or not shutil.which("notify-send"):
        print(f"(pop-up) {head}: {body}")
        return
    # waits for a click in the background (notify-send -A prints the action picked), then opens it; this returns at once
    script = ('a=$(notify-send -a NeuroNet -i dialog-information -t 20000 -A default=Open -A open="Open in Collaboration" "$1" "$2")\n'
              '[ -n "$a" ] && "$3" collab "$4" >/dev/null 2>&1\n')
    subprocess.Popen(["bash", "-c", script, "collab_post", head, body, os.path.join(APP, "neuronet-open"), d["ref"]],
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


def ensure_project(name):
    if name.lower() not in [p["name"].lower() for p in collab.projects()["projects"]]:
        collab.new_project(name)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    i = sub.add_parser("idea")
    i.add_argument("--by", required=True, help="the section head who raised it")
    i.add_argument("--title", required=True)
    i.add_argument("--idea", required=True)
    i.add_argument("--why", required=True)
    i.add_argument("--like", default="", help="games or apps that do something like it")
    i.add_argument("--when", choices="abc", default=None)
    i.add_argument("--project", default=ROLLING)
    i.add_argument("--from", dest="frm", choices=("claude", "cam"), default="claude")
    i.add_argument("--quiet", action="store_true", help="no pop-up (a batch: one pop-up for them all after)")
    n = sub.add_parser("notify")
    n.add_argument("ref")
    n.add_argument("--what", default="")
    p = sub.add_parser("project")
    p.add_argument("name")
    a = ap.parse_args()
    collab.DATA_DIR_PROVIDER = data_dir
    if a.cmd == "project":
        ensure_project(a.name)
        print(a.name)
        return 0
    if a.cmd == "notify":
        notify(a.ref, a.what)
        return 0
    ensure_project(a.project)
    body = collab.TEMPLATES["idea"]
    d = collab.new("idea", a.title, a.project, a.frm, body=body, author="" if a.frm == "cam" else a.by)
    for s in d["sections"]:
        for it in s["items"]:
            if it["id"] == "t1":
                it["answer"] = a.idea
            elif it["id"] == "t2":
                it["answer"] = a.why
            elif it["id"] == "t3":
                it["answer"] = a.like
            elif it["id"] == "q1":
                it["answer"] = a.when
    if a.frm == "cam":
        d["intro"] = f"Cam's, from a prompt; written up by the {a.by}."
    d = collab.save(d)
    print(d["ref"])
    if not a.quiet:
        notify(d["ref"], "idea")
    return 0


if __name__ == "__main__":
    sys.exit(main())
