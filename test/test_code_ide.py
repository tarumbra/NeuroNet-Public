"""Code -> IDE -- Algorithm's back end, answered by NeuroNet's Api.

Cam (2026-10-01): "intergrate Algorithm found in /mnt/Cams_Collective into
NeuroNet under Code main section and be in IDE sub section".

Through NeuroNet's own Api (code_<name>), on a data folder made here, so
nothing of Cam's is touched. What it holds NeuroNet to:
  * every call the IDE's bridge makes (ui/code/*.js) is a code_ method
  * the IDE's files live in NeuroNet's data folder, neuronet_data/code/
  * Algorithm's promises survive the move: a path can't leave its project,
    a save refuses a file changed underneath it, a draft comes back, a
    command runs in the project and its output arrives
  * a command still running when NeuroNet closes is stopped (stop_code_runs)
The interface half is test_code_ide.js.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json, os, re, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)

tmp = tempfile.mkdtemp(prefix="nn-code-")
DATA = os.path.join(tmp, "data")
os.makedirs(DATA)
with open(os.path.join(tmp, "paths.json"), "w") as f:
    json.dump({"data": DATA}, f)
os.environ["NEURONET_PATHS"] = os.path.join(tmp, "paths.json")
os.environ["XDG_STATE_HOME"] = os.path.join(tmp, "state")

import neuronet  # noqa: E402
import code_ide  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


api = neuronet.Api()

# ---- the bridge -------------------------------------------------------------------
ui = ""
for name in ("ide.js", "editor.js", "store.js", "highlight.js"):
    with open(os.path.join(APP, "ui", "code", name), encoding="utf-8") as f:
        ui += f.read()
asked = set(re.findall(r'AL\.Store\.call\(\s*"([a-z_]+)"', ui))
missing = sorted(n for n in asked if not callable(getattr(api, "code_" + n, None)))
ok("every call the IDE makes is answered by NeuroNet as code_<name>",
   asked and not missing, missing)
ok("  and each is a real method of code_ide.Api",
   all(callable(getattr(code_ide.Api, n, None)) for n in neuronet.CODE_IDE_CALLS),
   [n for n in neuronet.CODE_IDE_CALLS if not callable(getattr(code_ide.Api, n, None))])

# ---- projects and files, in neuronet_data/code ------------------------------------
r = api.code_create_project("Demo")
ok("a project is made", r.get("ok"), r)
ok("  as a real folder in neuronet_data/code/projects",
   os.path.isdir(os.path.join(DATA, "code", "projects", "Demo")), os.listdir(DATA))
ok("projects are listed", [p["name"] for p in api.code_list_projects()] == ["Demo"])
api.code_create_file("Demo", "main.py")
r = api.code_write_file("Demo", "main.py", "print('hi')\n")
ok("a file is saved", r.get("ok") or "modified" in r, r)
got = api.code_read_file("Demo", "main.py")
ok("  and read back, with its language", got.get("text") == "print('hi')\n" and got.get("language") == "python", got)

r = api.code_read_file("Demo", "../../../../etc/passwd")
ok("a path can't leave its project", "error" in r and "outside" in r["error"], r)
r = api.code_write_file("Demo", "../escape.py", "x")
ok("  nor be written outside it", "error" in r and not os.path.exists(os.path.join(DATA, "code", "projects", "escape.py")), r)

seen = got["modified"]
time.sleep(1.1)
with open(os.path.join(DATA, "code", "projects", "Demo", "main.py"), "w") as f:
    f.write("print('changed by something else')\n")
r = api.code_write_file("Demo", "main.py", "print('mine')\n", seen)
ok("a save stops when the file changed underneath it",
   r.get("conflict") or "error" in r, r)
with open(os.path.join(DATA, "code", "projects", "Demo", "main.py")) as f:
    ok("  and the other change is still there", "something else" in f.read())

# ---- drafts -------------------------------------------------------------------------
api.code_save_draft("Demo", "main.py", "print('half typed')")
drafts = api.code_list_drafts()
ok("an unsaved buffer's draft comes back",
   isinstance(drafts, list) and any(d.get("text") == "print('half typed')" for d in drafts), drafts)
ok("  kept in neuronet_data/code/drafts", os.listdir(os.path.join(DATA, "code", "drafts")))
api.code_clear_draft("Demo", "main.py")
ok("  and goes when cleared", api.code_list_drafts() == [])

# ---- the terminal ------------------------------------------------------------------
api.code_write_file("Demo", "main.py", "print(6 * 7)\n")
run = api.code_run_command("Demo", "python3 main.py")
sid = run.get("id")
out, since, deadline = "", 0, time.time() + 10
while time.time() < deadline:
    o = api.code_run_output(sid, since)       # only the new output each time
    out += o.get("chunk") or ""
    since = o.get("since", since)
    if not o.get("running", True):
        break
    time.sleep(0.2)
ok("a command runs in the project and its output arrives", "42" in out, (run, o))

run = api.code_run_command("Demo", "sleep 30")
sid = run.get("id")
time.sleep(0.5)
neuronet.stop_code_runs()
time.sleep(0.8)
ok("a command still running is stopped when NeuroNet closes",
   not api.code_run_output(sid, 0).get("running", False), api.code_run_output(sid, 0))

# ---- guides -------------------------------------------------------------------------
os.makedirs(os.path.join(DATA, "code", "guides"), exist_ok=True)
with open(os.path.join(DATA, "code", "guides", "Notes.md"), "w") as f:
    f.write("# Loops\n")
g = api.code_list_guides()
ok("guides are listed from neuronet_data/code/guides", [x["name"] for x in g] == ["Notes.md"], g)
ok("  and read", api.code_read_guide("Notes.md").get("text") == "# Loops\n")
ok("  a guide name can't reach outside", "error" in api.code_read_guide("../../paths.json"))

import shutil  # noqa: E402
shutil.rmtree(tmp, ignore_errors=True)
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
