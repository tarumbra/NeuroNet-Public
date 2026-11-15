"""NeuroNet's health (app_health.py, 3 Nov 2026): its memory now, from its own processes only, and the trend."""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import subprocess  # noqa: E402
import sys  # noqa: E402
import time  # noqa: E402

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, APP)
import app_health as h  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


m = h.measure()
ok("this process measured, as NeuroNet itself", m and m["parts"].get("app", 0) > 0 and m["total"] >= m["parts"]["app"], m)
child = subprocess.Popen([sys.executable, "-c", "x = bytearray(60 * 1024 * 1024); import time; time.sleep(5)"])
time.sleep(1.5)
m2 = h.measure()
ok("  and everything under it (a 60 MB child counts as a helper)", m2["parts"].get("helpers", 0) >= 55, m2)
child.kill(); child.wait()
s = h.started_at()
ok("when it started: a moment ago", s and 0 <= time.time() - s < 600, s)
ok("trend: MB an hour over the last two hours", h.trend([[0, 500], [1800, 510], [3600, 600]]) == 100.0)
ok("  nothing to say under half an hour", h.trend([[0, 500], [600, 900]]) is None and h.trend([]) is None)
ok("  older samples than two hours aren't counted", h.trend([[0, 100], [3600, 900], [7200, 900], [10800, 900]]) == 0.0)
snap = h.snapshot()
ok("the snapshot: now, since, samples (now included), no verdict yet",
   snap["now"]["total"] > 0 and snap["since"] and snap["samples"] and snap["steady"] is None, snap)
ok("the sampler starts from main() only (never on import)", not h._started[0]
   and "app_health.start()" in open(os.path.join(APP, "neuronet.py"), encoding="utf-8").read())

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
