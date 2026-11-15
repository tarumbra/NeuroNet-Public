"""NeuroNet doesn't assume this computer (NeuroNet System plan, Stage 1).

Cam, 2026-09-29: the ISO will be "shared with family and friends", so nothing
in NeuroNet's desktop layer may name a folder of this computer's. Where
NeuroNet is lives in one place -- ~/.config/neuronet/paths.json, written by
system/bin/neuronet-setup -- and everything asks that:

  * the desktop widgets, through NeuroNetPaths.qml (one file, a copy in each
    plugin that needs it -- these must stay identical);
  * the shortcuts, autostart, launcher and services, through the commands
    neuronet-setup puts in ~/.local/bin (neuronet-quick ... and neuronet-path).

So this checks the repo's copy of the layer (system/, kept by collect.sh):
no folder names, the copies identical, and the templates filled in only by
neuronet-setup. And, on a computer where NeuroNet is set up, that it's
set up as neuronet-setup would do it now.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import os
import re
import subprocess
import sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYS = os.path.join(APP, "system")
HOME = os.path.expanduser("~")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def read(*p):
    with open(os.path.join(*p), encoding="utf-8") as f:
        return f.read()


# a folder of one particular computer
MACHINE = re.compile(r"/home/[a-z_][a-z0-9_-]*/|/mnt/[A-Za-z_]+|DataDrive|Data_Drive")

# ---- the layer names no folder -------------------------------------------------
hits = []
for place in ("omarchy/plugins", "omarchy/hooks", "hypr", "templates", "bin", "qml"):
    for root, _, files in os.walk(os.path.join(SYS, place)):
        for f in files:
            if f.endswith((".png", ".wav", ".jpg")):
                continue
            try:
                text = read(root, f)
            except UnicodeDecodeError:
                continue
            for n, line in enumerate(text.splitlines(), 1):
                s = line.strip()
                # comments are the design record and may quote anything
                if s.startswith(("//", "#", "*", "--")):
                    continue
                if MACHINE.search(line.split(" //")[0]):
                    hits.append("%s:%d: %s" % (os.path.relpath(os.path.join(root, f), SYS), n, s[:90]))
ok("no folder of this computer's is named in the desktop layer", not hits, "\n          ".join(hits))

ok("no computer's rendered launcher or units are kept in the repo (the templates are)",
   not os.path.exists(os.path.join(SYS, "applications")) and not os.path.exists(os.path.join(SYS, "systemd"))
   and not os.path.exists(os.path.join(APP, "NeuroNet.desktop")))

# ---- NeuroNet's window is found, whichever renderer draws it ------------------
# Fix notes from Manthies' computer, 2026-09-29: without python-qtpy, pywebview
# quietly fell back to GTK, the window was named "neuronet.py", and every
# shortcut failed with "didn't open".
deps = read(APP, "integration", "deps.txt")
ok("deps.txt requires qtpy (without it pywebview drops Qt without a word)",
   re.search(r"^python\s+qtpy\s+omarchy pkg add python-qtpy", deps, re.M) is not None)
src = __import__("backend_src").backend_source(APP)
ok("NeuroNet names its window \"NeuroNet\" under GTK too (GLib.set_prgname)",
   # (NEURONET_APP_ID renames only a test copy's window: cachyos-docker.sh --show)
   'GLib.set_prgname(os.environ.get("NEURONET_APP_ID") or "NeuroNet")' in src
   and 'setDesktopFileName(os.environ.get("NEURONET_APP_ID") or "NeuroNet")' in src)
quick = read(APP, "neuronet-quick")
ok("neuronet-quick finds the window under \"neuronet.py\" as well",
   '"neuronet.py"' in quick and "QT cannot be loaded" in quick)
rule = read(SYS, "hypr", "hyprland.lua.block")
ok("the window rule takes both names",
   re.search(r'class = "\^\(NeuroNet\|neuronet\[\.\]py\)\$"', rule) is not None, rule)
ok("the doctor and the installer both call out a start without Qt",
   "QT cannot be loaded" in read(SYS, "bin", "neuronet-doctor")
   and "QT cannot be loaded" in read(SYS, "install.sh"))

# ---- NeuroNetPaths.qml: one file, identical everywhere -------------------------
original = read(SYS, "qml", "NeuroNetPaths.qml")
copies = sorted(d for d in os.listdir(os.path.join(SYS, "omarchy", "plugins"))
                if os.path.exists(os.path.join(SYS, "omarchy", "plugins", d, "NeuroNetPaths.qml")))
ok("NeuroNetPaths.qml is in the widgets that read NeuroNet's files",
   set(copies) >= {"neuronet.tarot", "neuronet.oracle",
                   "neuronet.fleeting", "neuronet.music"}, copies)
drift = [d for d in copies if read(SYS, "omarchy", "plugins", d, "NeuroNetPaths.qml") != original]
ok("  and every copy is the same as system/qml/NeuroNetPaths.qml", not drift, drift)
ok("  its data folder isn't called `data` (every QML Item already has one)",
   "property string dataDir" in original and "property string data:" not in original)
ok("  it reads the file outside a binding (a read inside one sets it off again)",
   "function read()" in original and "onLoaded: nn.read()" in original)

# ---- the templates, and neuronet-setup ------------------------------------------
for t in ("neuronet-menu.path.in", "neuronet-menu.service.in", "NeuroNet.desktop.in"):
    ok("template %s is there" % t, os.path.exists(os.path.join(SYS, "templates", t)))
ok("the menu service runs neuronet-menu from ~/.local/bin (%h)",
   "ExecStart=%h/.local/bin/neuronet-menu" in read(SYS, "templates", "neuronet-menu.service.in"))
ok("the launcher runs neuronet-quick by name", "Exec=neuronet-quick show" in read(SYS, "templates", "NeuroNet.desktop.in"))
blocks = "".join(read(SYS, "hypr", f) for f in os.listdir(os.path.join(SYS, "hypr")))
ok("shortcuts and autostart run NeuroNet's commands by name",
   '"neuronet-quick notes"' in blocks and 'launch_on_start("neuronet-quick start")' in blocks)

# neuronet-setup on a throwaway home: writes the config, the commands, the units
tmp = subprocess.run(["mktemp", "-d"], capture_output=True, text=True).stdout.strip()
env = dict(os.environ, HOME=tmp, XDG_CONFIG_HOME=os.path.join(tmp, ".config"),
           XDG_DATA_HOME=os.path.join(tmp, ".local/share"))
setup = os.path.join(SYS, "bin", "neuronet-setup")
nn_data = os.path.join(tmp, "NeuroNetData")      # a new computer: not made yet
r = subprocess.run([setup, "--data", nn_data], capture_output=True, text=True, env=env)
ok("neuronet-setup runs on an empty home", r.returncode == 0, r.stderr.strip()[-300:])
try:
    conf = json.load(open(os.path.join(tmp, ".config/neuronet/paths.json")))
except (OSError, ValueError):
    conf = {}
ok("  paths.json says where the app and the data are",
   conf.get("app") == os.path.realpath(APP) and conf.get("data") == nn_data, conf)
ok("  and it made the data folder, chosen with --data on a new computer", os.path.isdir(nn_data))
unit = os.path.join(tmp, ".config/systemd/user/neuronet-menu.path")
ok("  the menu's path unit watches that data folder",
   os.path.exists(unit) and ("PathChanged=%s/chords/chords.json" % nn_data) in read(unit))
shims = [c for c in ("neuronet-quick", "neuronet-path", "neuronet-menu")
         if os.access(os.path.join(tmp, ".local/bin", c), os.X_OK)]
ok("  the commands are in ~/.local/bin", len(shims) == 3, shims)
r2 = subprocess.run([setup, "--check"], capture_output=True, text=True, env=env)
ok("  run again, nothing changes", "nothing to change" in r2.stdout, r2.stdout.strip()[-200:])
os.rmdir(nn_data)
r3 = subprocess.run([setup], capture_output=True, text=True, env=env)
ok("  a remembered data folder that's gone isn't made again (it may be an unplugged drive)",
   r3.returncode == 0 and not os.path.exists(nn_data), r3.stdout[-200:])
r4 = subprocess.run([setup, "--data", "/proc/nn-cannot-be-made"], capture_output=True, text=True, env=env)
ok("  a data folder it can't make is an error, not a silent pass", r4.returncode != 0, r4.stderr[-200:])
subprocess.run(["rm", "-rf", "--", tmp])

# ---- a hidden section's shortcut is off (neuronet-path hidden) ------------------
import tempfile  # noqa: E402
t = tempfile.mkdtemp(prefix="nn-hidden-")
os.makedirs(os.path.join(t, "data"))
with open(os.path.join(t, "paths.json"), "w") as f:
    json.dump({"app": APP, "data": os.path.join(t, "data")}, f)
with open(os.path.join(t, "data", "neuronet_prefs.json"), "w") as f:
    json.dump({"hiddenSections": ["photos", "training:groups"]}, f)
henv = dict(os.environ, NEURONET_PATHS=os.path.join(t, "paths.json"))
hid = lambda k: subprocess.run([os.path.join(SYS, "bin", "neuronet-path"), "hidden", k],  # noqa: E731
                               env=henv, capture_output=True).returncode == 0
ok("neuronet-path hidden: a hidden section is hidden", hid("photos"))
ok("  a shown one isn't", not hid("money") and not hid("training"))
ok("  a page follows its hidden section", hid("photos:albums") and hid("training:groups"))
os.remove(os.path.join(t, "data", "neuronet_prefs.json"))
ok("  no settings yet: nothing is hidden", not hid("photos"))
subprocess.run(["rm", "-rf", "--", t])
quick, capture = read(APP, "neuronet-quick"), read(APP, "neuronet-capture") + read(APP, "neuronet-snip")
ok("  neuronet-quick checks it before opening a section", 'section_off "$action" && exit 0' in quick)
ok("  and neuronet-capture before capturing into Photos", "neuronet-path hidden photos" in capture)

# ---- this computer, if NeuroNet is set up on it ---------------------------------
# (only for the NeuroNet that IS set up here -- a clone elsewhere, where
# development happens, would always differ in where the app is)
def _installed_app():
    try:
        return os.path.realpath(json.load(open(os.path.join(HOME, ".config/neuronet/paths.json"))).get("app") or "")
    except (OSError, ValueError, AttributeError):
        return ""


if _installed_app() == os.path.realpath(APP):
    r = subprocess.run([setup, "--check"], capture_output=True, text=True)
    ok("this computer is set up as neuronet-setup would do it now",
       "nothing to change" in r.stdout, r.stdout.strip()[-300:])

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
