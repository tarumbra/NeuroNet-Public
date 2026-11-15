import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json names it, and data_dir() reads that
# before anything a test patches. test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
"""Money's cash books on disk (2026-10-11): the main book stays at the top level as it always was, and the others
(`cashbooks`) survive every save -- normalize_money runs on each one, so a save that dropped the key would lose them."""
import sys
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)
import kitchen_backend as k

passed = failed = 0
def ok(name, cond, detail=""):
    global passed, failed
    if cond: passed += 1; print("  ok    " + name)
    else: failed += 1; print("  FAIL  " + name + ("  -- " + str(detail) if detail else ""))

old = {"templates": [{"id": "rent"}], "oneoffs": [], "payments": {}, "goals": [], "calc": {}, "spendingLog": {}}
n = k.normalize_money(old)
ok("an old file reads as before: the main book at the top level, no other books", n["templates"] == [{"id": "rent"}] and n["cashbooks"] == [] and n["books"] == [])
f = dict(n, cashbooks=[{"id": "cb1", "name": "What if", "created": "x", "data": {"templates": [{"id": "rent", "amount": 600}]}},
                       {"id": "main", "name": "imposter"}, {"id": "cb1", "name": "dup"}, "junk", {"name": "no id"}])
m = k.normalize_money(f)
ok("other cash books are kept, each a whole budget", len(m["cashbooks"]) == 1 and m["cashbooks"][0]["name"] == "What if"
   and m["cashbooks"][0]["data"]["templates"] == [{"id": "rent", "amount": 600}] and m["cashbooks"][0]["data"]["payments"] == {}, m["cashbooks"])
ok("  a book can't take the main book's id, and ids are never doubled", [b["id"] for b in m["cashbooks"]] == ["cb1"])
ok("  reading what was saved gives the same back", k.normalize_money(m) == m)
ok("the main book is called Main until it's named", n["mainName"] == "Main" and k.normalize_money(dict(n, mainName="  Cam ")).get("mainName") == "Cam"
   and k.normalize_money(dict(n, mainName=5))["mainName"] == "Main")
print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
