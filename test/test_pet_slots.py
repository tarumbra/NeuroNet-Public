"""NeuroPets save slots (2026-10-07).

Cam: "3 save slots to play different characters at a time". pet.json is always
the game being played; the others wait in
pet-slot<n>.json. Runs on a scratch data folder -- never the real save.
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


def game(name, mode="hardcore"):
    return {"v": 1, "pet": None, "log": [], "mode": mode, "player": {"name": name, "made": True}}


print("\nNeuroPets save slots\n")
tmp = tempfile.mkdtemp(prefix="nn-petslots-")
old = pet.DATA_DIR_PROVIDER
pet.DATA_DIR_PROVIDER = lambda: tmp
try:
    pet.save(game("Ada"), "main")
    s = pet.slots()
    ok("three slots; the game being played is slot 1", s["active"] == 1 and len(s["slots"]) == 3 and s["slots"][0]["player"]["name"] == "Ada"
       and s["slots"][1] is None and s["slots"][2] is None, s)
    r = pet.new_game(2, game("Bea", "hell"))
    ok("a new game in slot 2: it's played now (pet.json), slot 1's waits in its file",
       r["player"]["name"] == "Bea" and pet.active_slot() == 2 and pet.load("main")["mode"] == "hell"
       and json.load(open(os.path.join(tmp, "pet", "pet-slot1.json")))["player"]["name"] == "Ada")
    pet.save(dict(game("Bea", "hell"), coins=50), "main")
    back = pet.switch(1)
    ok("switching back: Ada's game is pet.json again, Bea's (as last saved) waits in slot 2",
       back["player"]["name"] == "Ada" and pet.active_slot() == 1 and json.load(open(os.path.join(tmp, "pet", "pet-slot2.json"))).get("coins") == 50)
    ok("an empty slot switched to is a new, empty game", pet.switch(3)["pet"] is None and pet.active_slot() == 3 and pet.load("main").get("player") is None)
    pet.switch(1)
    ok("the slot being played can't be cleared", "error" in pet.clear_slot(1))
    ok("another can", pet.clear_slot(2) == {"ok": True} and pet.slots()["slots"][1] is None)
    ok("no slot 4", "error" in pet.switch(4) and "error" in pet.new_game(0, game("X")))
    ok("a broken save isn't written", "error" in pet.new_game(2, {"v": 0}) and "error" in pet.new_game(2, {"v": "2"}))
finally:
    pet.DATA_DIR_PROVIDER = old
    shutil.rmtree(tmp, ignore_errors=True)

src = open(os.path.join(APP, "neuropets.py"), encoding="utf-8").read()
ok("the game's page can ask for them (pet_slots, pet_switch, pet_newgame, pet_clearslot)",
   all("def " + k in src for k in ("pet_slots", "pet_switch", "pet_newgame", "pet_clearslot")))
print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
