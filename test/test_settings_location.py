"""NeuroNet's settings live in the data folder, not beside the app.

Cam, 2026-09-29, asked where the settings should live now NeuroNet is to be
shared with family and friends: "In data folder". So neuronet_prefs.json is
the person's -- it goes where their data goes, and the new-machine export
carries it -- and a settings file left in the app folder by an older NeuroNet
is brought across once, never over one already there, never deleted.

Everything here happens in temporary folders: neuronet.py's app_dir and
data_dir are pointed at them before any settings are asked for.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import neuronet as nn  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def world(app_prefs=None, data_prefs=None):
    """A made-up NeuroNet: an app folder and a data folder, each maybe with
    a settings file. Points neuronet.py at them and forgets what it knew."""
    root = tempfile.mkdtemp(prefix="nn-prefs-")
    app, data = os.path.join(root, "app"), os.path.join(root, "data")
    os.makedirs(app)
    os.makedirs(data)
    for folder, prefs in ((app, app_prefs), (data, data_prefs)):
        if prefs is not None:
            with open(os.path.join(folder, "neuronet_prefs.json"), "w") as f:
                json.dump(prefs, f)
    nn.app_dir = lambda: app
    nn.data_dir = lambda: data
    nn._prefs_adopted = False
    return root, app, data


def load(path):
    with open(path) as f:
        return json.load(f)


# an older NeuroNet's settings, beside the app: moved in, once
root, app, data = world(app_prefs={"theme": "hearth", "view": "notes:vault"})
p = nn.prefs_file()
ok("the settings file is in the data folder", p == os.path.join(data, "neuronet_prefs.json"), p)
ok("  the app folder's settings were brought across, whole",
   os.path.exists(p) and load(p) == {"theme": "hearth", "view": "notes:vault"})
ok("  and moved, not copied, on one disk (one set of settings, not two)",
   not os.path.exists(os.path.join(app, "neuronet_prefs.json")))
ok("  asking again changes nothing", nn.prefs_file() == p and load(p)["theme"] == "hearth")
shutil.rmtree(root)

# settings already in the data folder win; the app folder's are left alone
root, app, data = world(app_prefs={"theme": "old"}, data_prefs={"theme": "current"})
p = nn.prefs_file()
ok("settings already in the data folder are never written over",
   load(p) == {"theme": "current"})
ok("  and the app folder's file is left where it was, not deleted",
   load(os.path.join(app, "neuronet_prefs.json")) == {"theme": "old"})
shutil.rmtree(root)

# a new computer: no settings anywhere yet
root, app, data = world()
p = nn.prefs_file()
ok("a new computer's settings will be made in the data folder",
   p == os.path.join(data, "neuronet_prefs.json") and not os.path.exists(p))
shutil.rmtree(root)

# the export's "Settings" area follows the file to the data folder
src = __import__("backend_src").backend_source(APP)
ok("the export's Settings area is prefs_file(), wherever that is",
   '"key": "settings", "label": "Settings", "path": prefs_file()' in src)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
