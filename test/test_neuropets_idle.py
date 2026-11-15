"""NeuroPets closes when it has been tucked away a while (2026-10-06).

Cam: "lets do the change for Neuropets" -- tucked away, the game held ~1.3 GB
all day, and nothing in it needs it running: it works out the time that has
passed when it opens. Out of sight for 10 minutes, with nothing asked of it,
it closes. A stand-in hyprctl says where the window is; nothing real is asked.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import shutil  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import neuropets as np_  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


print("\nNeuroPets, tucked away\n")
tmp = tempfile.mkdtemp(prefix="nn-npidle-")
real_path = os.environ.get("PATH", "")
try:
    def hypr(clients, monitors):
        with open(os.path.join(tmp, "hyprctl"), "w") as f:
            f.write("#!/bin/bash\ncase \"$1\" in clients) echo '%s';; monitors) echo '%s';; esac\n"
                    % (json.dumps(clients), json.dumps(monitors)))
        os.chmod(os.path.join(tmp, "hyprctl"), 0o755)
        os.environ["PATH"] = tmp + ":" + real_path

    on_ws = [{"class": "NeuroPets", "workspace": {"name": "2"}}]
    in_pad = [{"class": "NeuroPets", "workspace": {"name": "special:neuropets"}}]
    hypr(on_ws, [{"specialWorkspace": {"name": ""}}])
    ok("on a workspace: not away", np_.tucked_away() is False)
    hypr(in_pad, [{"specialWorkspace": {"name": ""}}])
    ok("in its scratchpad (Super+Alt+G): away", np_.tucked_away() is True)
    hypr(in_pad, [{"specialWorkspace": {"name": "special:neuropets"}}])
    ok("  but not while the scratchpad is open on a screen", np_.tucked_away() is False)
    hypr([{"class": "kitty", "workspace": {"name": "1"}}], [])
    ok("started hidden for the desktop pet (no window): away", np_.tucked_away() is True)
    os.environ["PATH"] = tmp + ":/nonexistent"
    os.remove(os.path.join(tmp, "hyprctl"))
    ok("no Hyprland to ask: it never closes itself", np_.tucked_away() is None)
finally:
    os.environ["PATH"] = real_path
    shutil.rmtree(tmp, ignore_errors=True)

Q = np_.should_quit
ok("away 10 minutes, nothing asked for 10 minutes: closes", Q(0, 0, 600, False, 600))
ok("  not after 9", not Q(0, 0, 540, False, 600))
ok("  not if the desktop pet asked something within the 10 minutes", not Q(0, 300, 600, False, 600))
ok("  not while it's answering the desktop", not Q(0, 0, 600, True, 600))
ok("  not when it isn't away", not Q(None, 0, 9999, False, 600))
ok("  never with NEUROPETS_IDLE_QUIT=0", not Q(0, 0, 9999, False, 0))
ok("10 minutes unless set", np_.IDLE_QUIT == 600 or os.environ.get("NEUROPETS_IDLE_QUIT"))

src = open(os.path.join(APP, "neuropets.py"), encoding="utf-8").read()
ok("every desktop request counts as use", "self.last_call = time.time()" in src.split("def _on_call")[1].split("def finish")[0])
ok("the game starts the watcher, and closes its window (saved on every move, so nothing is lost)",
   "watch_and_quit(api._bus, quit_game)" in src and "window.destroy()" in src)
core = open(os.path.join(APP, "ui", "pet", "petcore.js"), encoding="utf-8").read()
ok("  it catches up by the time passed when it opens (trips, gathering and all)",
   "function advance(state, now)" in core and "runTrip(s, s.player, e)" in core)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
