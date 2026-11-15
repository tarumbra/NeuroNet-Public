"""The two sandboxes (2026-10-15). (This test's first version imported neuropets AFTER pointing pet at a scratch folder;
the import pointed it back at NeuroNet's real data and moved it -- see test_data_dir_guard.py. Never again.)
The two sandboxes: Cam: "add to saves in dev mode. One with everything unlocked. The other with the ability
to add items to a plain account". pet.py keeps "dev" pointing at the one in use. A scratch data folder -- never the real one."""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import shutil  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import neuropets  # noqa: E402  -- FIRST: importing it points pet at NeuroNet's data folder, so the scratch folder goes in after
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


print("\nThe two sandboxes\n")
tmp = tempfile.mkdtemp(prefix="nn-sbx-")
pet.DATA_DIR_PROVIDER = lambda: tmp
neuropets.nn._resolved_root = tmp            # and NeuroNet's own lookup can't wander off to look for the real one
neuropets.nn.app_dir = lambda: tmp
try:
    ok("to start with, the sandbox is the one there always was (everything unlocked, pet-dev.json)", pet.sandbox_kind() == "max" and pet.path("dev").endswith("pet-dev.json"))
    unlocked = dict(pet.empty(), dev={"on": True, "infinite": True}, coins=99999)
    pet.save(unlocked, "dev")
    r = pet.sandbox_use("plain")
    ok("switching to the plain account: a save of its own, new the first time", r == {"ok": True, "kind": "plain", "exists": False}
       and pet.path("dev").endswith("pet-dev-plain.json") and pet.load("dev").get("coins") != 99999)
    pet.save(dict(pet.empty(), dev={"on": True}, coins=5), "dev")
    pet.sandbox_use("max")
    ok("  and back: each keeps its own game", pet.load("dev")["coins"] == 99999 and pet.sandbox_use("plain")["exists"] and pet.load("dev")["coins"] == 5)
    ok("  the real game is never either of them", pet.path("main").endswith("pet.json") and not os.path.exists(pet.path("main")))
    ok("  an unknown sandbox is refused", "error" in pet.sandbox_use("other") and pet.sandbox_kind() == "plain")
    api = neuropets.Api()
    ok("the game's bridge: pet_sandbox says which, pet_sandbox_use switches", api.pet_sandbox() == {"kind": "plain", "kinds": ["max", "plain"]}
       and api.pet_sandbox_use("max")["kind"] == "max" and api.pet_load("dev")["coins"] == 99999)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
