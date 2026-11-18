"""NeuroPets settings (2026-10-08): pet.py keeps them (the window is private, so the page can't), and knows the
first start of a day -- the save slots show then. neuropets.py's hello() asks once per run.

Cam: "Happy for save slots to appear when first opening the game for the day if the neuropets app was fully
closed. Settings can hide the modder and new game button etc."
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json names it, and data_dir() reads that
# before anything a test patches. test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import sys, tempfile, json
APP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, APP)
import pet

passed = failed = 0
def ok(name, cond, detail=""):
    global passed, failed
    if cond: passed += 1; print("  ok    " + name)
    else: failed += 1; print("  FAIL  " + name + ("  -- " + str(detail) if detail else ""))

d = tempfile.mkdtemp(prefix="np-settings-")
pet.DATA_DIR_PROVIDER = lambda: d
ok("a new game shows everything (but the Kit, off until switched on)", pet.settings() == {"sidebar": True, "modder": True, "newGame": True, "sandbox": True, "dailySaves": True, "dayNight": True, "deepNight": False, "kit": False, "lastStart": ""}, pet.settings())
ok("  an old settings.json's \"prototypes\" switch (the grid game's, taken out 2026-11-18) is left out", "prototypes" not in pet.save_settings({"prototypes": True}))
s = pet.save_settings({"modder": False, "sidebar": 0, "junk": "x", "lastStart": "2099-01-01"})
ok("  switches are kept as True/False, and nothing else", s["modder"] is False and s["sidebar"] is False and "junk" not in s and s["lastStart"] == "", s)
ok("  they last (settings.json beside the saves)", os.path.exists(os.path.join(pet.root(), "settings.json")) and pet.settings()["modder"] is False)
ok("the first start of a day is noticed once", pet.first_start_today("2026-10-08") is True and pet.first_start_today("2026-10-08") is False
   and pet.first_start_today("2026-10-09") is True)
ok("  and doesn't touch the switches", pet.settings()["modder"] is False and pet.settings()["sidebar"] is False)
src = open(os.path.join(APP, "neuropets.py"), encoding="utf-8").read()
ok("hello() asks once per run, so showing the window again isn't a new start",
   "if self._started is None:" in src and '"firstToday": first' in src and "def pet_settings(self)" in src and "def pet_settings_save(self, d)" in src)
print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
