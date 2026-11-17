"""The NeuroNet dock steps aside on floating workspaces (17 Nov 2026).

Cam: "When using floating window layout please hide the neuronet dock because it wont be needed and gets
in the way. It should still be availible for scrolling and tiling mode." Omarchy's own dock shows on
floating workspaces; NeuroNet's hides there and comes back on dwindle (tiling) and scrolling ones.

The dock reads the mode the way omarchy-hyprland-workspace-layout-current does: the workspace's own file in
$XDG_STATE_HOME/omarchy/workspace-layouts/<id>.lua (Super+L writes it, and deletes it when the workspace goes
back to the default), else default.lua. This loads the real Dock.qml in a throwaway Quickshell whose home is a
temporary folder, writes those files for the workspace the dock is on, and checks the dock follows: written,
changed, deleted, and through the default. Nothing of Cam's is read or written; the dock's window may show on
the real screen for these few seconds, as in the other throwaway-Quickshell tests.
"""
import os
# Never Cam's real data (test_test_isolation.py checks every test does this first).
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import shutil
import subprocess
import sys
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCK = os.path.join(APP, "system", "omarchy", "plugins", "neuronet.dock")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


# Each step writes (or deletes) a file, waits for the watch, then logs what the dock decided.
HARNESS = r'''
import QtQuick
import Quickshell
import Quickshell.Io
ShellRoot {
  id: sh
  property var dock: null
  property int step: 0
  readonly property string dir: "%(dir)s"
  Process { id: p }
  function put(name, text) { p.exec(["sh", "-c", "mkdir -p '" + dir + "' && printf '%%s\\n' '" + text + "' > '" + dir + "/" + name + "'"]) }
  function drop(name) { p.exec(["rm", "-f", dir + "/" + name]) }
  function say(label) { console.log("RESULT " + label + " ws=" + dock.dockWorkspace + " floating=" + dock.floatingHere) }
  Timer { interval: 400; running: true; onTriggered: {
    var c = Qt.createComponent("file://%(dock)s/Dock.qml")
    if (c.status !== Component.Ready) { console.log("RESULT loaderr " + JSON.stringify(c.errorString())); Qt.quit(); return }
    sh.dock = c.createObject(sh, { shell: null, manifest: null })
    steps.start()
  } }
  Timer { id: steps; interval: 600; repeat: true; onTriggered: {
    var ws = String(sh.dock.dockWorkspace), w = ws + ".lua"
    switch (sh.step++) {
      case 0: sh.say("start"); sh.put(w, 'o.workspace_mode({ workspace = "' + ws + '", mode = "floating" })'); break
      case 1: sh.say("floating"); sh.put(w, 'o.workspace_mode({ workspace = "' + ws + '", mode = "scrolling" })'); break
      case 2: sh.say("scrolling"); sh.put(w, 'o.workspace_mode({ workspace = "' + ws + '", mode = "dwindle" })'); break
      case 3: sh.say("dwindle"); sh.put(w, 'o.workspace_mode({ workspace = "' + ws + '", mode = "floating" })'); break
      case 4: sh.say("floating-again"); sh.drop(w); break
      case 5: sh.say("deleted"); sh.put("default.lua", 'o.workspace_mode({ default = "floating" })'); break
      case 6: sh.say("default-floating"); sh.put(w, 'o.workspace_mode({ workspace = "' + ws + '", mode = "scrolling" })'); break
      case 7: sh.say("own-scrolling-over-default"); sh.put("default.lua", 'o.workspace_mode({ default = "scrolling" })'); break
      case 8: sh.drop(w); break
      case 9: sh.say("default-scrolling"); console.log("RESULT done"); Qt.quit(); break
    }
  } }
}
'''

if not shutil.which("qs") or not os.environ.get("WAYLAND_DISPLAY") or not os.environ.get("HYPRLAND_INSTANCE_SIGNATURE"):
    print("  skip  dock on floating workspaces (needs qs and a Hyprland session)")
    sys.exit(0)

h = tempfile.mkdtemp(prefix="nn-dockfloat-")
try:
    home = os.path.join(h, "home")
    state = os.path.join(home, ".local", "state")
    os.makedirs(os.path.join(home, ".config", "neuronet"))
    # no workspace-layouts folder yet, as on a computer that never pressed Super+L: the dock makes it
    for d in ["Ui", "Commons"]:
        os.symlink(os.path.join("/usr/share/omarchy/shell", d), os.path.join(h, d))
    with open(os.path.join(h, "shell.qml"), "w") as f:
        f.write(HARNESS % {"dir": os.path.join(state, "omarchy", "workspace-layouts"), "dock": DOCK})
    env = dict(os.environ, HOME=home, XDG_CONFIG_HOME=os.path.join(home, ".config"), XDG_STATE_HOME=state,
               XDG_DATA_HOME=os.path.join(home, ".local", "share"))
    r = subprocess.run(["qs", "-p", h], env=env, capture_output=True, text=True, timeout=60)
    out = r.stdout + r.stderr
    got = {}
    for line in out.splitlines():
        if "RESULT " in line:
            parts = line.split("RESULT ", 1)[1].split()
            if len(parts) == 3:
                got[parts[0]] = (parts[1], parts[2] == "floating=true")

    ok("the dock loads and the throwaway shell runs to the end", "RESULT done" in out and "start" in got, out[-800:])
    ws = got.get("start", ("ws=-1", None))[0]
    ok("  it knows which workspace its screen shows", ws != "ws=-1" and ws.split("=")[1].isdigit(), got)
    for label, want, what in [
        ("start", False, "no saved mode: shown"),
        ("floating", True, "the workspace goes floating: hidden"),
        ("scrolling", False, "scrolling: shown"),
        ("dwindle", False, "tiling (dwindle): shown"),
        ("floating-again", True, "floating again: hidden"),
        ("deleted", False, "back to the default (file deleted), default not floating: shown"),
        ("default-floating", True, "the default is floating and the workspace has no mode of its own: hidden"),
        ("own-scrolling-over-default", False, "its own scrolling beats a floating default: shown"),
        ("default-scrolling", False, "default scrolling, no own mode: shown"),
    ]:
        ok("  " + what, label in got and got[label][1] is want, got.get(label))
finally:
    shutil.rmtree(h, ignore_errors=True)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
