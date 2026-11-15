"""neuronet-quick, neuropets, neurofarm and neurocafe without Hyprland -- KDE Plasma.

Cam, 2026-10-14: "is it possible to have a KDE desktop environment and still
have the app run in the background and brought up with the shortcuts" ...
"please commence building a KDE mode".

No scratchpad there: the scripts ask the app over the session bus (State,
Show <mode>, Hide, Quick, Compact) and neuronet-raise asks KWin to bring the
window forward. Here busctl is a stand-in that plays the running app (its
state in a file) and logs every call; python3 is a stand-in too, so "starting
NeuroNet" only marks it running. No real NeuroNet, bus or KWin is touched.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os
import shutil
import subprocess
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail)[-900:] if detail else ""))


h = tempfile.mkdtemp(prefix="nn-quick-kde-")
try:
    stub, run_dir = os.path.join(h, "bin"), os.path.join(h, "run")
    os.makedirs(stub)
    os.makedirs(run_dir)
    LOG = os.path.join(h, "calls.log")
    # busctl: NameHasOwner answers from <h>/owned-<name>; State from <h>/state-<name>;
    # Show/Hide change it, as the app would
    open(os.path.join(stub, "busctl"), "w").write(r'''#!/bin/bash
H="%s"
echo "busctl $*" >> "$H/calls.log"
args=("$@"); [ "${args[0]}" = --user ] && args=("${args[@]:1}")
[ "${args[0]}" = call ] || exit 0
dest="${args[1]}"; method="${args[4]}"
if [ "$method" = NameHasOwner ]; then
  [ -e "$H/owned-${args[6]}" ] && echo "b true" || echo "b false"; exit 0
fi
[ -e "$H/owned-$dest" ] || exit 1
case "$method" in
  State) echo "s \"$(cat "$H/state-$dest" 2>/dev/null || echo window)\"" ;;
  Show)  m="${args[6]:-window}"; echo "$m" > "$H/state-$dest" ;;
  Hide)  echo hidden > "$H/state-$dest" ;;
esac
exit 0
''' % h)
    # python3: "starting" an app marks its bus name owned, hidden if asked
    open(os.path.join(stub, "python3"), "w").write(r'''#!/bin/bash
H="%s"
echo "python3 $*" >> "$H/calls.log"
case "$1" in
  *neuronet.py) n=org.neuronet.App ;; *neuropets.py) n=org.neuropets.App ;; *neurofarm.py) n=org.neurofarm.App ;; *neurocafe.py) n=org.neurocafe.App ;; *) exit 0 ;;
esac
: > "$H/owned-$n"
case " $* " in *" --hidden "*) echo hidden > "$H/state-$n" ;; *) echo window > "$H/state-$n" ;; esac
''' % (h))
    for n in ("busctl", "python3"):
        os.chmod(os.path.join(stub, n), 0o755)
    for n in ("jq", "flock", "setsid", "sed", "cat", "seq", "sleep", "dirname", "readlink", "mkdir", "rm", "grep", "awk", "mktemp"):
        if shutil.which(n):
            os.symlink(shutil.which(n), os.path.join(stub, n))
    env = {"PATH": stub, "HOME": os.path.join(h, "home"), "XDG_RUNTIME_DIR": run_dir,
           "XDG_STATE_HOME": os.path.join(h, "state"), "XDG_CURRENT_DESKTOP": "KDE",
           "NEURONET_PATHS": os.path.join(os.devnull, "paths.json")}

    def run(script, *args):
        open(LOG, "w").close()
        r = subprocess.run(["/bin/bash", os.path.join(APP, script), *args], capture_output=True, text=True,
                           env=env, timeout=60)
        return r.returncode, open(LOG).read(), r.stdout + r.stderr

    def state(name="org.neuronet.App", value=None):
        p = os.path.join(h, "state-" + name)
        if value is not None:
            open(p, "w").write(value)
        return open(p).read().strip() if os.path.exists(p) else None

    def settle(name="org.neuronet.App"):
        # the scripts start an app in the background (setsid -f) and return
        import time
        for _ in range(50):
            if os.path.exists(os.path.join(h, "owned-" + name)) and state(name):
                return
            time.sleep(0.1)

    section = lambda: open(os.path.join(run_dir, "neuronet-quick.section")).read().strip()

    # ---- NeuroNet ---------------------------------------------------------------------------
    code, calls, out = run("neuronet-quick", "start")
    settle()
    calls = open(LOG).read()
    ok("start: NeuroNet started hidden", code == 0 and "neuronet.py --gui qt --hidden" in calls
       and state() == "hidden", calls + out)
    code, calls, out = run("neuronet-quick", "start")
    ok("start again: not a second one", "python3" not in calls, calls)

    code, calls, out = run("neuronet-quick", "notes")
    ok("a tool's key: the page to Notes, compact; shown as the popup; KWin asked to raise it",
       code == 0 and "Quick sb notes true" in calls and "Show s popup" in calls
       and "NameHasOwner s org.kde.KWin" in calls and state() == "popup" and section() == "notes", calls + out)
    code, calls, out = run("neuronet-quick", "notes")
    ok("the same key again puts it away", "Hide" in calls and state() == "hidden" and "Show" not in calls, calls)
    run("neuronet-quick", "notes")
    code, calls, out = run("neuronet-quick", "money")
    ok("another tool's key while it's up switches, doesn't hide",
       "Quick sb money true" in calls and "Hide" not in calls and state() == "popup" and section() == "money", calls)
    code, calls, out = run("neuronet-quick", "open", "money")
    ok("open (a note, a recipe) never hides", "Hide" not in calls and state() == "popup", calls)

    code, calls, out = run("neuronet-quick", "full")
    ok("Super+Alt+O: the whole app, not compact, maximised",
       "Compact b false" in calls and "Show s full" in calls and state() == "full", calls)
    code, calls, out = run("neuronet-quick", "full")
    ok("Super+Alt+O again hides it", "Hide" in calls and state() == "hidden", calls)
    code, calls, out = run("neuronet-quick", "show")
    run("neuronet-quick", "show")
    ok("show (the app icon) never hides", state() == "full", calls)

    code, calls, out = run("neuronet-quick", "toggle")
    ok("toggle while shown: hides", state() == "hidden", calls)
    code, calls, out = run("neuronet-quick", "toggle")
    ok("toggle while hidden: the popup again (no tool since Super+Alt+O: as it was, compact)",
       "Quick sb  true" in calls and "Show s popup" in calls and state() == "popup", calls)
    run("neuronet-quick", "games")
    run("neuronet-quick", "toggle")
    code, calls, out = run("neuronet-quick", "toggle")
    ok("toggle after a tool: back on that tool", "Quick sb games true" in calls and state() == "popup", calls)
    code, calls, out = run("neuronet-quick", "dock", "0x1234")
    ok("dock does nothing (only Hyprland opens apps inside the popup)", code == 0 and "busctl" not in calls, calls)
    ok("nothing called hyprctl", "hyprctl" not in calls)

    # not running yet: a tool's key starts it hidden, then shows it
    os.remove(os.path.join(h, "owned-org.neuronet.App"))
    code, calls, out = run("neuronet-quick", "photos")
    ok("not running: a tool's key starts it, then shows that tool",
       "neuronet.py --gui qt --hidden" in calls and "Quick sb photos true" in calls and state() == "popup", calls + out)

    # ---- NeuroPets, NeuroFarm, NeuroCafe -----------------------------------------------------------------
    for script, svc in (("neuropets", "org.neuropets.App"), ("neurofarm", "org.neurofarm.App"), ("neurocafe", "org.neurocafe.App")):
        code, calls, out = run(script, "toggle")
        settle(svc)
        calls = open(LOG).read()
        ok(script + ": not running -- the key starts it, in view", script + ".py --gui qt" in calls
           and "--hidden" not in calls and state(svc) == "window", calls + out)
        code, calls, out = run(script, "toggle")
        ok(script + ": the key again tucks it away", "Hide" in calls and state(svc) == "hidden", calls)
        code, calls, out = run(script, "toggle")
        ok(script + ": and again brings it back, raised by KWin",
           " Show" in calls and "NameHasOwner s org.kde.KWin" in calls and state(svc) == "window", calls)
        code, calls, out = run(script, "show")
        ok(script + ": show (the app icon) never hides", "Hide" not in calls, calls)
        code, calls, out = run(script, "start")
        ok(script + ": start when running starts nothing", "python3" not in calls, calls)
    # ---- the window, shown and hidden by the app (neuronet.ShownWindow) -------------------------
    import sys
    sys.path.insert(0, APP)
    import neuronet

    class Win:
        def __init__(self):
            self.did = []
        def __getattr__(self, name):
            return lambda *a: self.did.append((name,) + a)

    w = Win()
    sw = neuronet.ShownWindow(w, hidden=True)
    ok("ShownWindow: started hidden says hidden", sw.state() == "hidden")
    sw.show("popup")
    ok("ShownWindow: popup = shown, restored, about three quarters of the screen",
       sw.state() == "popup" and w.did[:2] == [("show",), ("restore",)] and w.did[2][0] == "resize", w.did)
    w.did.clear(); sw.show("full")
    ok("ShownWindow: full = maximised", sw.state() == "full" and ("maximize",) in w.did, w.did)
    w.did.clear(); sw.hide()
    ok("ShownWindow: hide", sw.state() == "hidden" and w.did == [("hide",)], w.did)
    sw.show("nonsense")
    ok("ShownWindow: an unknown mode is a plain window", sw.state() == "window")
    ok("ShownWindow: started in view says window", neuronet.ShownWindow(Win()).state() == "window")
finally:
    shutil.rmtree(h, ignore_errors=True)

print("\n%d passed, %d failed" % (passed, failed))
raise SystemExit(1 if failed else 0)
