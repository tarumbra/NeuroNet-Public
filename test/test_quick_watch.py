"""A window opened over the popup gets the tool tiled beside it.

Cam (2026-10-02): "If i click print the page attatchs to the tool so when i
close the tool it closes the document as well. I need any app opened while the
tool is up to remain seperate from the tool."

quick_watch.py reads Hyprland's event socket and runs `neuronet-quick dock`;
the script does the moving. Here hyprctl is a stand-in that answers from JSON
files and logs every dispatch, so no real window moves.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import time
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import quick_watch                                      # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nReading Hyprland's events\n")
ok("a browser opening on the popup's scratchpad is docked",
   quick_watch.to_dock("openwindow>>55d1e0a0,special:neuronet,brave-browser,Print - Brave") == "0x55d1e0a0")
ok("  a title with commas is fine",
   quick_watch.to_dock("openwindow>>abc,special:neuronet,mpv,Film, The (1999), part 1") == "0xabc")
ok("NeuroNet's own windows are not", quick_watch.to_dock("openwindow>>abc,special:neuronet,NeuroNet,NeuroNet") == "")
ok("  nor under the old name", quick_watch.to_dock("openwindow>>abc,special:neuronet,neuronet.py,x") == "")
ok("a window on an ordinary workspace is left alone", quick_watch.to_dock("openwindow>>abc,2,brave-browser,x") == "")
ok("other events are ignored", quick_watch.to_dock("closewindow>>abc") == "")
seen = []
w = quick_watch.Watch("x", path="", run=seen.append)
rest = w.feed("workspace>>1\nopenwindow>>aa,special:neur")
rest = w.feed("onet,foot,t\nopenwindow>>bb,1,foot,t\n", rest)
ok("a line split across two reads still counts, once", seen == ["0xaa"] and rest == "", seen)
ok("outside Hyprland there's nothing to watch",
   quick_watch.socket_path({"XDG_RUNTIME_DIR": "/nonexistent"}) == ""
   and quick_watch.Watch("x", path="").start() is False)
src = __import__("backend_src").backend_source(APP)
main = src[src.index("def main():"):]
ok("NeuroNet starts watching from main() only (never on import)",
   "quick_watch.Watch(quick_script(), seen=page_rest() if gui == \"qt\" else None).start()" in main and "import quick_watch" not in src[:src.index("def main():")])

# ---- the script, against a stand-in Hyprland ---------------------------------
t = tempfile.mkdtemp(prefix="nn-quickwatch-")
stub = os.path.join(t, "bin")
os.makedirs(stub)
with open(os.path.join(stub, "hyprctl"), "w") as f:
    f.write("""#!/bin/bash
case "$1" in
  clients) cat "$NNT/clients.json" ;;
  monitors) cat "$NNT/monitors.json" ;;
  activeworkspace) jq -c '.[0].activeWorkspace' "$NNT/monitors.json" ;;
  dispatch) echo "$2" >> "$NNT/dispatch.log" ;;
esac
""")
os.chmod(os.path.join(stub, "hyprctl"), 0o755)
SCRIPT = os.path.join(APP, "neuronet-quick")
TOOL = "0x1000"


def world(tool_ws="special:neuronet", tool_float=True, other=None, special="special:neuronet", state=None):
    for n in ("dispatch.log", "neuronet-quick.section"):
        try:
            os.remove(os.path.join(t, n))
        except OSError:
            pass
    clients = [{"address": TOOL, "class": "NNQuickTest", "initialClass": "NNQuickTest", "title": "NeuroNet",
                "floating": tool_float, "workspace": {"name": tool_ws}}]
    if other:
        clients.append(other)
    json.dump(clients, open(os.path.join(t, "clients.json"), "w"))
    json.dump([{"focused": True, "width": 2752, "height": 1152, "scale": 1.25,
                "activeWorkspace": {"name": "1"}, "specialWorkspace": {"name": special}}],
              open(os.path.join(t, "monitors.json"), "w"))
    if state:
        open(os.path.join(t, "neuronet-quick.section"), "w").write(state + "\n")


def run(*args):
    env = dict(os.environ, NNT=t, PATH=stub + ":" + os.environ["PATH"], XDG_RUNTIME_DIR=t,
               NEURONET_QUICK_CLASS="NNQuickTest")
    subprocess.run(["bash", SCRIPT, *args], env=env, capture_output=True, text=True, timeout=30)
    try:
        return open(os.path.join(t, "dispatch.log")).read().splitlines()
    except OSError:
        return []


def browser(ws="special:neuronet", floating=False, addr="0x2000"):
    return {"address": addr, "class": "brave-browser", "initialClass": "brave-browser", "title": "Print",
            "floating": floating, "workspace": {"name": ws}}


print("\nneuronet-quick dock\n")
world(other=browser(), state="notes")
d = run("dock", "2000")
ok("the popup is put away", any("toggle_special" in x for x in d), d)
ok("the tool moves to the workspace in front, and tiles",
   any(TOOL in x and 'workspace = "1"' in x for x in d) and any(TOOL in x and "float" in x for x in d), d)
ok("the browser moves there too, and has focus",
   any("0x2000" in x and 'workspace = "1"' in x for x in d) and "0x2000" in (d[-1] if d else "") and "focus" in d[-1], d)
ok("  in that order: popup away first, focus last",
   d and "toggle_special" in d[0], d)
world(other=browser(floating=True), state="notes")
ok("a floating window (a file picker) stays with the tool", run("dock", "0x2000") == [])
world(other=browser(ws="3"), state="notes")
ok("a window that isn't on the scratchpad is left alone", run("dock", "0x2000") == [])
world(state="notes")
ok("the tool itself is never docked", run("dock", TOOL) == [])
ok("  nor a window that has gone", run("dock", "0x9999") == [])

print("\nThe tool as a window\n")
world(tool_ws="1", tool_float=False, special="", state="notes")
d = run("notes")
ok("its key tucks it away again: back to the scratchpad, floating",
   any(TOOL in x and "special:neuronet" in x for x in d) and any("float" in x for x in d)
   and not any("toggle_special" in x for x in d), d)
world(tool_ws="1", tool_float=False, special="", state="notes")
d = run("photos")
ok("another tool's key switches it where it is (no move)",
   not any("move" in x for x in d) and open(os.path.join(t, "neuronet-quick.section")).read().strip() == "photos", d)
world(tool_ws="1", tool_float=False, special="", state="notes")
d = run("full")
ok("Super+Alt+O makes it the whole app rather than hiding it",
   not any("special:neuronet" in x for x in d) and not os.path.exists(os.path.join(t, "neuronet-quick.section")), d)
world(tool_ws="1", tool_float=False, special="")
d = run("full")
ok("  while the whole app (not a docked tool) still hides on O, as before",
   any(TOOL in x and "special:neuronet" in x for x in d), d)

print("\nFile pickers\n")
blk = open(os.path.join(APP, "system", "hypr", "hyprland.lua.block"), encoding="utf-8").read()
# Cam (2026-10-02): "When i click to add a new photo for an album cover it
# brings up the file explorer behind the tool window". Qt draws GTK's file
# chooser (QT_QPA_PLATFORMTHEME=gtk3) in NeuroNet's own process, with its app
# id -- so the rule sent the picker, unfocused, under the tool.
ok("the scratchpad rule takes only the main window (titled NeuroNet), not its file pickers",
   'o.window({ class = "^(NeuroNet|neuronet[.]py)$", title = "^NeuroNet$" }, { workspace = "special:neuronet silent"' in blk
   and 'o.window("^(NeuroNet|neuronet[.]py)$"' not in blk)

print("\nOn screen or not (the page rests while it's tucked away, 3 Nov 2026)\n")
import quick_watch as qwm  # noqa: E402
MON = [{"activeWorkspace": {"name": "1"}, "specialWorkspace": {"name": ""}}]
MON_SP = [{"activeWorkspace": {"name": "1"}, "specialWorkspace": {"name": "special:neuronet"}}]
me = lambda ws: [{"pid": 42, "mapped": True, "hidden": False, "workspace": {"name": ws}}, {"pid": 7, "workspace": {"name": "1"}}]
ok("tucked into the scratchpad, not open: out of sight", qwm.on_screen(me("special:neuronet"), MON, 42) is False)
ok("  the scratchpad open over workspace 1: in sight", qwm.on_screen(me("special:neuronet"), MON_SP, 42) is True)
ok("  on workspace 1 while 1 shows: in sight; on 3: out of sight",
   qwm.on_screen(me("1"), MON, 42) is True and qwm.on_screen(me("3"), MON, 42) is False)
ok("  no window of ours: no answer (nothing changes)", qwm.on_screen(me("1"), MON, 99) is None)
told, world_now = [], {"clients": me("special:neuronet"), "monitors": MON}
w = qwm.Watch("/nowhere", path="", run=lambda a: None, seen=told.append, pid=42, ask=lambda k: world_now[k])
w.feed("activespecial>>,DP-3\nworkspace>>1\nworkspacev2>>1,1\n")
time.sleep(0.4)
ok("a burst of events -> one look, and the page is told it's hidden", told == [False], told)
world_now["monitors"] = MON_SP
w.feed("activespecial>>special:neuronet,DP-3\n")
time.sleep(0.4)
w.feed("activewindow>>NeuroNet,NeuroNet\n")
time.sleep(0.4)
ok("  shown again when the scratchpad opens; other events don't ask", told == [False, True], told)
w.feed("workspace>>1\n")
time.sleep(0.4)
ok("  told only when it changes", told == [False, True], told)
w2 = qwm.Watch("/nowhere", path="", run=lambda a: None, ask=lambda k: (_ for _ in ()).throw(AssertionError("asked")))
w2.feed("workspace>>2\n")
time.sleep(0.3)
ok("  without seen(), hyprctl is never asked", True)
nn = open(os.path.join(APP, "neuronet.py"), encoding="utf-8").read()
ok("neuronet.py hands it page_rest(): the page marked hidden on Qt's own thread",
   "def page_rest():" in nn and "page.setVisible(on)" in nn and "seen=page_rest()" in nn and "NEURONET_NO_REST" in nn)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
