"""The widgets' shared files, each from one source (2026-10-06, the audit).

"The same code is copied by hand ... a forgotten copy is still a likely bug.
Do: have the installer copy from one source." system/omarchy/shared.json names
each shared file's source; system/shared_files.py checks, makes, stages and
adopts the copies. Everything but the first check runs on a throwaway copy.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SYS = os.path.join(APP, "system")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


def run(app, *args):
    r = subprocess.run([sys.executable, os.path.join(app, "system", "shared_files.py"), *args],
                       capture_output=True, text=True, timeout=60)
    return r.returncode, r.stdout + r.stderr


def body(*p):
    with open(os.path.join(*p), encoding="utf-8") as f:
        return f.read()


print("\nShared widget files, one source each\n")
code, out = run(APP)
ok("every widget's copy is the same as its source", code == 0, out)
man = json.load(open(os.path.join(SYS, "omarchy", "shared.json")))
names = {e["name"] for e in man["files"]}
ok("  the copies the audit named are covered",
   {"NeuroNetPaths.qml", "Service.qml", "BarWidget.qml"} <= names   # petcore/petart went with the pet card (2026-10-15); DeskSpace etc. with the desktop widgets (3 Nov 2026)
   and not names & {"DeskSpace.qml", "desklayout.js", "WidgetMenu.qml", "EditHandles.qml"}
   and not names & {"petcore.js", "petart.js", "farmcore.js", "farmart.js"})
ok("  each source exists, and each named widget has the file",
   all(os.path.isfile(os.path.join(APP, e["from"])) and all(
       os.path.isfile(os.path.join(SYS, "omarchy", "plugins", w, e["name"])) for w in e["to"]) for e in man["files"]))
inst = body(SYS, "install.sh")
widgets = inst.split('bold "3. Widgets"')[1].split("# ----")[0]
ok("the installer builds the widgets in a staging folder from the sources, and installs from there",
   'shared_files.py" --into "$STAGE"' in widgets and 'for d in "$STAGE"/neuronet.*' in widgets)
ok("collect.sh takes an edit in one copy back to the source", 'shared_files.py" --adopt' in body(SYS, "collect.sh"))

# ---- on a throwaway NeuroNet ------------------------------------------------
tmp = tempfile.mkdtemp(prefix="nn-shared-")
try:
    app = os.path.join(tmp, "app")
    os.makedirs(os.path.join(app, "system", "omarchy", "plugins"))
    shutil.copy(os.path.join(SYS, "shared_files.py"), os.path.join(app, "system"))
    os.makedirs(os.path.join(app, "src"))
    with open(os.path.join(app, "src", "Desk.qml"), "w") as f:
        f.write("source\n")
    for w in ("a", "b", "c"):
        os.makedirs(os.path.join(app, "system", "omarchy", "plugins", w))
        with open(os.path.join(app, "system", "omarchy", "plugins", w, "Desk.qml"), "w") as f:
            f.write("source\n")
    with open(os.path.join(app, "system", "omarchy", "shared.json"), "w") as f:
        json.dump({"files": [{"from": "src/Desk.qml", "name": "Desk.qml", "to": ["a", "b", "c"]}]}, f)
    P = lambda w: os.path.join(app, "system", "omarchy", "plugins", w, "Desk.qml")  # noqa: E731

    with open(P("b"), "w") as f:
        f.write("forgotten\n")
    code, out = run(app)
    ok("a copy that differs is caught, with its source named", code == 1 and "plugins/b/Desk.qml" in out, out)

    stage = os.path.join(tmp, "stage")
    shutil.copytree(os.path.join(app, "system", "omarchy", "plugins"), stage)
    run(app, "--into", stage)
    ok("staging lays the source over every widget's copy (what the installer installs)",
       all(body(stage, w, "Desk.qml") == "source\n" for w in ("a", "b", "c")))
    ok("  without touching NeuroNet's own folder", body(P("b")) == "forgotten\n")

    code, out = run(app, "--adopt")
    ok("adopt: an edit made in one copy becomes the source and every copy",
       code == 0 and body(app, "src", "Desk.qml") == "forgotten\n"
       and all(body(P(w)) == "forgotten\n" for w in ("a", "b", "c")), out)

    with open(P("a"), "w") as f:
        f.write("one way\n")
    with open(P("c"), "w") as f:
        f.write("another\n")
    code, out = run(app, "--adopt")
    ok("  two different edits stop, naming both, and change nothing",
       code == 1 and "CONFLICT" in out and "plugins/a/" in out and "plugins/c/" in out
       and body(app, "src", "Desk.qml") == "forgotten\n", out)

    with open(os.path.join(app, "src", "Desk.qml"), "w") as f:
        f.write("new source\n")
    run(app, "--write")
    ok("--write makes every copy from an edited source", all(body(P(w)) == "new source\n" for w in ("a", "b", "c")))
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
