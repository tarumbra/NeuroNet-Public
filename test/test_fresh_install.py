"""NeuroNet's desktop on a brand-new computer, with no data yet.

NeuroNet System plan, Stage 1 (2026-09-29). Cam: the ISO is "shared with
family and friends", with "Start fresh" at first boot -- so every desktop
widget has to come up on an empty NeuroNet: no music library, no photos, no
notes, no cards, no training, no NeuroNet running. Not broken, not blank
with an error in the log: just empty, until there's something to show.

This makes that computer in a temporary folder -- a home whose
~/.config/neuronet/paths.json points NeuroNet's data at an empty folder --
and loads each always-running plugin (board, photo frame, home screen, daily
cards, dock) in a throwaway Quickshell for a few seconds. It
checks that each loads, that nothing throws, and that no widget writes into
the new data folder: NeuroNet's data is NeuroNet's to create (the widgets
hand every save to it).

Their windows open on the real screen for those seconds, as the other
throwaway-Quickshell tests' do: the ones on workspace 1 only if you're on it.
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
import shutil
import subprocess
import sys
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLUG = os.path.join(APP, "system", "omarchy", "plugins")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


PLUGINS = [
    ("neuronet.tarot", "Service.qml"),
    ("neuronet.oracle", "Service.qml"),
    ("neuronet.dock", "Dock.qml"),
]

HARNESS = r'''
import QtQuick
import Quickshell
ShellRoot {
  id: sh
  property var made: []
  Timer { interval: 300; running: true; onTriggered: sh.go() }
  // long enough for FileViews to answer and first layouts to run
  Timer { id: done; interval: 4000; onTriggered: { console.log("RESULT done"); Qt.quit() } }
  function go() {
    var list = %s
    for (var i = 0; i < list.length; i++) {
      var c = Qt.createComponent("file://%s/" + list[i])
      if (c.status !== Component.Ready) { console.log("RESULT loaderr " + list[i] + " " + JSON.stringify(c.errorString())); continue }
      var o = c.createObject(sh, { shell: null, manifest: null })
      console.log("RESULT " + (o ? "made " : "noobj ") + list[i])
      if (o) made.push(o)
    }
    done.start()
  }
}
'''

if not shutil.which("qs") or not os.environ.get("WAYLAND_DISPLAY"):
    print("  skip  fresh install (needs qs and a Wayland session)")
    sys.exit(0)

h = tempfile.mkdtemp(prefix="nn-fresh-")
try:
    home = os.path.join(h, "home")
    data = os.path.join(h, "data")              # the new computer's NeuroNet data: empty
    os.makedirs(os.path.join(home, ".config", "neuronet"))
    os.makedirs(data)
    with open(os.path.join(home, ".config", "neuronet", "paths.json"), "w") as f:
        json.dump({"app": APP, "data": data}, f)
    for d, _ in PLUGINS:
        shutil.copytree(os.path.join(PLUG, d), os.path.join(h, d))
    for d in ["Ui", "Commons"]:
        os.symlink(os.path.join("/usr/share/omarchy/shell", d), os.path.join(h, d))
    entries = [d + "/" + f for d, f in PLUGINS]
    with open(os.path.join(h, "shell.qml"), "w") as f:
        f.write(HARNESS % (json.dumps(entries), h))
    env = dict(os.environ, HOME=home, XDG_CONFIG_HOME=os.path.join(home, ".config"),
               XDG_STATE_HOME=os.path.join(home, ".local", "state"),
               XDG_DATA_HOME=os.path.join(home, ".local", "share"))
    r = subprocess.run(["qs", "-p", h], env=env, capture_output=True, text=True, timeout=60)
    out = r.stdout + r.stderr

    ok("the throwaway shell ran to the end", "RESULT done" in out, out[-600:])
    for e in entries:
        ok("%s loads on an empty NeuroNet" % e, ("RESULT made " + e) in out,
           next((l for l in out.splitlines() if e in l and "RESULT" in l), out[-300:]))

    # errors from our plugins' own code (a missing file read is fine: nothing is there yet)
    ours = re.escape(h)
    errors = [l.strip() for l in out.splitlines()
              if re.search(ours, l) and re.search(r"TypeError|ReferenceError|SyntaxError|is not a function|"
                                                   r"Cannot read property|Cannot assign|unavailable|Binding loop", l)]
    ok("no widget throws on an empty NeuroNet", not errors, "\n          ".join(errors[:12]))

    made = []
    for root, dirs, files in os.walk(data):
        made += [os.path.relpath(os.path.join(root, f), data) for f in files]
        made += [os.path.relpath(os.path.join(root, d), data) + "/" for d in dirs]
    ok("no widget writes into the new NeuroNet data folder (that's NeuroNet's to do)", not made, made[:10])
finally:
    shutil.rmtree(h, ignore_errors=True)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
