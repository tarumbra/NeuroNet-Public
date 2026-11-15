"""NeuroNet doesn't keep growing (the performance audit, 3 Nov 2026).

The audit found NeuroNet climbing 1.8 GB in a working day: the top-bar clock
(160 MB an hour) and views that left pieces behind each visit (the picture
loader's observers, Training's tag filter, drag-select, Music's playlists
panel). This keeps them fixed: the SAMPLE NeuroNet (tools/audit/nn_sandbox.sh
-- a throwaway copy with a made-up household, its own HOME, off screen; the
real NeuroNet and its data are never touched) visits each of those views 12
times, and a minute still on the dashboard is measured. A cache stops
growing after the first visits, so only the last 8 count.

About three minutes. Skipped without node, PyQt6's web engine, dbus-run-session
or rsync, or with NEURONET_SKIP_SLOW=1.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def can_run():
    if os.environ.get("NEURONET_SKIP_SLOW"):
        return "NEURONET_SKIP_SLOW"
    for t in ("node", "dbus-run-session", "rsync", "curl"):
        if not shutil.which(t):
            return "no " + t
    try:
        import PyQt6.QtWebEngineWidgets  # noqa: F401
    except Exception:
        return "no PyQt6 web engine"
    return ""


why = can_run()
if why:
    print("  skip  the growth check (%s)" % why)
else:
    out = tempfile.mkdtemp(prefix="nn-grow-")
    try:
        env = dict(os.environ, AUDIT_TMP=out, AUDIT_SCRIPT="nn_growcheck.mjs", PORT="9257")
        r = subprocess.run(["bash", os.path.join(APP, "tools", "audit", "nn_sandbox.sh"), os.path.join(out, "res")],
                           env=env, capture_output=True, text=True, timeout=900)
        f = os.path.join(out, "res", "growcheck.json")
        if not os.path.exists(f):
            ok("the sample NeuroNet ran", False, (r.stdout + r.stderr)[-1500:])
        else:
            res = json.load(open(f))
            for v in res["views"]:
                g = v["next8"]
                # a few nodes either way is the garbage collector's timing; a leak was hundreds a visit
                ok("%s: 8 more visits leave nothing behind (nodes %+d, listeners %+d)" % (v["view"], g["nodes"], g["listeners"]),
                   g["listeners"] <= 2 and g["nodes"] <= 150, v)
            idle = res["idle"]
            ok("a minute on the dashboard: memory stays flat (%+d MB)" % idle["grewMB"],
               idle["startMB"] > 0 and idle["grewMB"] <= 15, idle)
    finally:
        shutil.rmtree(out, ignore_errors=True)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
