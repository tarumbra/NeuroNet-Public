"""tools/collab_post.py (2026-11-08): the team's ideas onto the Collaboration desk, with a pop-up -- on a scratch data
folder (never the real one), the pop-up printed (NEURONET_NO_NOTIFY), never shown.

Cam: "If a new idea is added to collaboration during a prompt have a pop up appear with a notification that something
has been added ... This project should be a rolling collaboration from the whole team."
"""
import os
# Never Cam's real data (test_test_isolation.py): a paths file that can't exist, before anything else.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
TOOL = os.path.join(APP, "tools", "collab_post.py")

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


print("\nThe team's ideas onto the desk (tools/collab_post.py)\n")
tmp = tempfile.mkdtemp(prefix="nn-collabpost-")
env = dict(os.environ, NEURONET_DATA=tmp, NEURONET_NO_NOTIFY="1", NEURONET_PATHS=os.path.join(os.devnull, "paths.json"))


def run(*args):
    return subprocess.run([sys.executable, TOOL, *args], capture_output=True, text=True, env=env, timeout=60)


try:
    r = run("idea", "--by", "Software Engineer", "--title", "One command to release", "--idea", "tools/release.sh does it all",
            "--why", "fewer steps to forget", "--when", "b")
    ref = r.stdout.splitlines()[0] if r.stdout else ""
    ok("an idea goes on the desk as the next I, in the rolling project, and says so in a pop-up", re.match(r"^I\d+$", ref) and
       "(pop-up) New idea in Collaboration: " + ref + ": One command to release" in r.stdout and "from the Software Engineer" in r.stdout, r.stdout + r.stderr)
    d = json.load(open(os.path.join(tmp, "collab", ref + ".json")))
    ans = {it["id"]: it.get("answer") for s in d["sections"] for it in s["items"]}
    ok("  the Idea form filled in: the idea, why, when; raised by the section head, from Claude, waiting for Cam",
       ans["t1"] == "tools/release.sh does it all" and ans["t2"] == "fewer steps to forget" and ans["q1"] == "b"
       and d["by"] == "Software Engineer" and d["from"] == "claude" and d["status"] == "open" and d["project"] == "NeuroNet: Ideas and Plans")
    pj = json.load(open(os.path.join(tmp, "collab", "projects.json")))
    ok("  the project is made the first time", any(p["name"] == "NeuroNet: Ideas and Plans" for p in pj["projects"]))
    r2 = run("idea", "--by", "Software Engineer", "--title", "Cam's own", "--idea", "x", "--why", "y", "--from", "cam", "--quiet")
    d2 = json.load(open(os.path.join(tmp, "collab", r2.stdout.split()[0] + ".json")))
    ok("  one of Cam's own from a prompt: his, written up by a section head; --quiet shows no pop-up",
       d2["from"] == "cam" and d2["by"] == "" and "Cam's" in d2["intro"] and "(pop-up)" not in r2.stdout and d2["ref"] != ref)
    r3 = run("notify", ref)
    ok("  notify: just the pop-up, for one written another way", r3.returncode == 0 and f"{ref}: One command to release" in r3.stdout)
    ok("  no such document: refused", run("notify", "I999").returncode != 0)
    page = open(os.path.join(APP, "ui", "app.js"), encoding="utf-8").read()
    opener = open(os.path.join(APP, "neuronet-open"), encoding="utf-8").read()
    ok("clicking the pop-up opens it in NeuroNet: neuronet-open collab <code> -> open.collab -> SS.Collab.open",
       "collab) section=notes" in opener and 'case "open.collab"' in page and "SS.Collab.open(ref)" in page
       and "neuronet-open" in open(TOOL, encoding="utf-8").read())
    bad = subprocess.run(["bash", os.path.join(APP, "neuronet-open"), "collab"], capture_output=True, text=True, timeout=20,
                         env=dict(os.environ, PATH="/usr/bin:/bin"))
    ok("  neuronet-open collab with no code: refused before anything opens", bad.returncode != 0 and "nothing to open" in bad.stderr, bad.stderr)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
