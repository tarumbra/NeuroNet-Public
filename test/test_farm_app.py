"""NeuroFarm, the app around the rules (2026-10-07): where the farm is kept,
the window, its launcher, and how it's put on the desktop.

Cam: "Now a new game NeuroFarm". Its own window like NeuroPets, its own
command (neurofarm), its own key (Super+Alt+Y), its own save
(neuronet_data/farm/farm.json). Runs on a scratch data folder -- never the
real data, never a real window.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import shutil  # noqa: E402
import stat  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import farm  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


def read(*p):
    return open(os.path.join(APP, *p), encoding="utf-8").read()


print("\nNeuroFarm, the app\n")
tmp = tempfile.mkdtemp(prefix="nn-farm-")
old = farm.DATA_DIR_PROVIDER
farm.DATA_DIR_PROVIDER = lambda: tmp
try:
    ok("no farm yet: a new one", farm.load() == farm.empty())
    good = {"v": 1, "game": "neurofarm", "log": [], "tiles": {}, "silo": {}, "coins": 200}
    ok("a farm is saved", farm.save(good) == {"ok": True} and farm.load()["coins"] == 200)
    farm.save(dict(good, coins=300))
    ok("  the one before is kept (farm.json.bak)", json.load(open(os.path.join(tmp, "farm", "farm.json.bak")))["coins"] == 200)
    ok("  a NeuroPets save (or junk) isn't written as a farm", "error" in farm.save({"v": 1, "pet": None, "log": []}) and "error" in farm.save([]))
    with open(os.path.join(tmp, "farm", "farm.json"), "w") as f:
        f.write("{broken")
    ok("  a damaged save: the copy from before it", farm.load()["coins"] == 200)
finally:
    farm.DATA_DIR_PROVIDER = old
    shutil.rmtree(tmp, ignore_errors=True)

src = read("neurofarm.py")
ok("its own window and one copy only (org.neurofarm.App), saving through farm.py",
   'BUS_NAME = "org.neurofarm.App"' in src and "def farm_load" in src and "def farm_save" in src and "farm.DATA_DIR_PROVIDER" in src)
page = read("ui", "neurofarm.html")
ok("the page: the farm's rules, NeuroPets' pictures and its own", all(x in page for x in ('src="farm/farmcore.js"', 'src="pet/petart.js"', 'src="farm/farmart.js"', 'src="farm/farm.js"')))
ok("  nothing inline for the page's security rules to block", "onerror=" not in page and "onclick=" not in page and "script-src 'self'" in page)
# 1.0.68 (Cam: "nothing loads when i open neurofarm"): pywebview's bridge to Python is built with eval -- without
# 'unsafe-eval' the page got an empty API, never loaded the farm, and drew nothing. NeuroPets' page has it too.
ok("  the page lets pywebview's bridge in ('unsafe-eval', as NeuroPets' does)",
   "script-src 'self' 'unsafe-eval'" in page and "'unsafe-eval'" in read("ui", "pet", "index.html"))
ok("  and if Python still can't be reached, it says so (not a blank page)", "couldn't reach its save" in read("ui", "farm", "farm.js"))
launcher = os.path.join(APP, "neurofarm")
ok("the neurofarm command: show, toggle", os.stat(launcher).st_mode & stat.S_IXUSR and "neurofarm.py" in read("neurofarm") and "toggle)" in read("neurofarm"))
# Super+Alt+Y went to NeuroArcana on 1 Nov 2026 (NeuroFarm is moving into NeuroCafe): no key of its own now
ok("installed like NeuroPets: the command and the app icon (its old key, Super+Alt+Y, is NeuroArcana's)",
   "neurofarm" in read("system", "bin", "neuronet-setup").split("COMMANDS=")[1].split("\n")[0]
   and "NeuroFarm.desktop.in" in read("system", "bin", "neuronet-setup")
   and "Exec=neurofarm show" in read("system", "templates", "NeuroFarm.desktop.in")
   and 'o.bind("SUPER + ALT + Y", "NeuroArcana' in read("system", "hypr", "bindings.lua.block")
   and '"NeuroFarm' not in read("system", "hypr", "bindings.lua.block")
   and os.path.isfile(os.path.join(APP, "icons", "NeuroFarm.png")))
ok("  and taken out again by the uninstaller", "NeuroFarm.desktop" in read("system", "install.sh") and "neurofarm neurofarm-call" in read("system", "install.sh"))
print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
