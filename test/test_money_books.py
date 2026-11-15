"""Money's books survive a save (kitchen_backend.normalize_money).

Money's back end rebuilds the budget from the keys it knows on every read and
save, so a key it doesn't know is dropped. Money books (2026-10-02, the
desktop Bookshelf) are one of its keys now.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
sys.path.insert(0, os.path.join(APP, "crux", "py"))
import kitchen_backend as kb  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nMoney books\n")
book = {"id": "mb1", "name": "2026 so far", "subtitle": "", "mode": "fortnight", "from": "2026-01-02",
        "to": "2026-02-27", "calc": True, "goals": False, "created": "2026-10-02T12:00:00Z"}
got = kb.normalize_money({"templates": [], "books": [book]})
ok("a book is kept through Money's save", got["books"] == [book], got.get("books"))
ok("an old budget with no books gets an empty list", kb.normalize_money({})["books"] == [])
bad = kb.normalize_money({"books": [{"name": "no id"}, {"id": "x", "name": "  "}, "junk",
                                    {"id": "y", "name": "Odd", "mode": "weekly", "calc": "yes"}]})
ok("one without an id or a name is dropped", [b["id"] for b in bad["books"]] == ["y"], bad["books"])
ok("  and an odd one made sensible (months, True/False)",
   bad["books"][0]["mode"] == "period" and bad["books"][0]["calc"] is True and bad["books"][0]["goals"] is False)
ok("books that aren't a list are none", kb.normalize_money({"books": {"a": 1}})["books"] == [])
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
