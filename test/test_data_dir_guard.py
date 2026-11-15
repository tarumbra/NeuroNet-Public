"""NeuroNet never moves a data folder into anything but a NeuroNet folder (2026-10-15).

What happened: a test run from NeuroNet/test/ made app_dir() test/ (it's where the script is), data_dir() found Cam's
real neuronet_data one folder up and -- as it does for an install that's moved -- renamed it into test/. It was moved
straight back and nothing was lost. Now the move happens only when the app folder really is NeuroNet (neuronet.py in
it). Everything here is in a temporary folder, with a temporary HOME.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import shutil  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
tmp = tempfile.mkdtemp(prefix="nn-guard-")
os.environ["HOME"] = tmp
sys.path.insert(0, APP)
import neuronet  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


def resolve(app):
    neuronet._resolved_root = None
    neuronet.app_dir = lambda: app
    return neuronet.data_dir()


print("\nThe data folder is never moved into a folder that isn't NeuroNet\n")
try:
    app = os.path.join(tmp, "NeuroNet")
    real = os.path.join(app, "neuronet_data")
    os.makedirs(os.path.join(app, "test"))
    os.makedirs(real)
    open(os.path.join(real, "neuronet.json"), "w").write("{}")
    open(os.path.join(app, "neuronet.py"), "w").write("# the app\n")
    got = resolve(os.path.join(app, "test"))
    ok("run from NeuroNet/test/: the real data one folder up is NOT moved into test/",
       os.path.isfile(os.path.join(real, "neuronet.json")) and not os.path.exists(os.path.join(app, "test", "neuronet_data", "neuronet.json")), got)
    ok("  and what test/ gets is never the real folder", os.path.abspath(got) != os.path.abspath(real), got)
    # an install whose data sits beside it (the case the move is for) still works
    app2 = os.path.join(tmp, "Apps", "NeuroNet")
    beside = os.path.join(tmp, "Apps", "neuronet_data")
    os.makedirs(app2); os.makedirs(beside)
    open(os.path.join(app2, "neuronet.py"), "w").write("# the app\n")
    open(os.path.join(beside, "neuronet.json"), "w").write("{}")
    got2 = resolve(app2)
    ok("a real NeuroNet folder with its data beside it still takes it in (the move it's for)",
       got2 == os.path.join(app2, "neuronet_data") and os.path.isfile(os.path.join(app2, "neuronet_data", "neuronet.json")) and not os.path.exists(beside), got2)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
