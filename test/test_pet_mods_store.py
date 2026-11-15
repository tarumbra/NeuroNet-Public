"""NeuroPets mod packs, where they're kept (2026-10-07).

neuronet_data/pet/mods/<id>.json. Runs on a scratch data folder -- never the
real data.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import shutil  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import pet  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
print("\nNeuroPets mod packs: storage\n")
tmp = tempfile.mkdtemp(prefix="nn-petmods-")
old = pet.DATA_DIR_PROVIDER
pet.DATA_DIR_PROVIDER = lambda: tmp
try:
    ok("no packs to start with", pet.mods() == [])
    r = pet.mod_save({"name": "Easy mode", "rates": {"xp": 2, "bad": "x"}, "items": {"honeycomb": PNG, "evil": "javascript:alert(1)"},
                      "regions": {"worldmap": PNG}, "pets": {"cat": {"buffs": [{"skill": "mining", "amount": 0.2}]}}})
    ok("a pack is saved, its id from its name", r == {"ok": True, "id": "easy-mode"}, r)
    m = pet.mod_load("easy-mode")
    ok("  only real pictures are kept (PNG data, never anything else)", m["items"] == {"honeycomb": PNG} and m["regions"] == {"worldmap": PNG})
    ok("  and only numeric rates", m["rates"] == {"xp": 2.0})
    lst = pet.mods()
    ok("the list: names, rates and counts -- not the pictures", lst[0]["name"] == "Easy mode" and lst[0]["pictures"] == 2 and lst[0]["pets"] == 1 and "items" not in lst[0])
    ok("a second with the same name gets its own id", pet.mod_save({"name": "Easy mode"})["id"] == "easy-mode-2")
    ok("saving an existing one keeps its id", pet.mod_save(dict(m, name="Easier"))["id"] == "easy-mode" and pet.mod_load("easy-mode")["name"] == "Easier")
    ok("a pack needs a name", "error" in pet.mod_save({"name": ""}))
    ok("a pack can be deleted", pet.mod_delete("easy-mode-2") == {"ok": True} and len(pet.mods()) == 1)
    ok("no reading outside the mods folder", "error" in pet.mod_load("../pet") and "error" in pet.mod_delete("../../x"))
finally:
    pet.DATA_DIR_PROVIDER = old
    shutil.rmtree(tmp, ignore_errors=True)
src = open(os.path.join(APP, "neuropets.py"), encoding="utf-8").read()
ok("the game's page can ask for them, and for NeuroNet's game assets",
   all("def " + k in src for k in ("pet_mods", "pet_mod_load", "pet_mod_save", "pet_mod_delete", "pet_game_assets", "pet_game_asset")))
print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
