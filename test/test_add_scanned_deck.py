"""tools/add_scanned_deck.py (15 Nov 2026): a deck of named scans into Divination.
Never Cam's data: a scratch data folder with its own cards/celestial.json.

Run: python3 test/test_add_scanned_deck.py
"""
import os
# Never Cam's real data (test_test_isolation.py): a paths file that can't exist, before anything else.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import shutil  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(APP, "tools"))
import add_scanned_deck  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


tmp = tempfile.mkdtemp(prefix="nn-deck-")
try:
    data, scans = os.path.join(tmp, "data"), os.path.join(tmp, "scans")
    os.makedirs(os.path.join(data, "cards", "images"))
    os.makedirs(scans)
    json.dump({"tarotDecks": [], "oracleDecks": [{"name": "Old", "cards": []}], "lenormandDecks": []},
              open(os.path.join(data, "cards", "celestial.json"), "w"))
    for f in ("The Rider.jpg", "The Clover.jpg"):
        open(os.path.join(scans, f), "wb").write(b"jpg " + f.encode())
    spec = os.path.join(tmp, "Roses.json")
    json.dump({"name": "Roses", "kind": "lenormand", "cover": "The Rider.jpg",
               "cards": [{"id": "1", "name": "The Rider", "suit": "", "file": "The Rider.jpg"},
                         {"id": "2", "name": "The Clover", "suit": "", "file": "The Clover.jpg"}]}, open(spec, "w"))

    rc = add_scanned_deck.main([spec, "--scans", scans, "--data", data])
    doc = json.load(open(os.path.join(data, "cards", "celestial.json")))
    deck = (doc["lenormandDecks"] or [{}])[0]
    ok("the deck is added to its kind, with its cards and empty meanings",
       rc == 0 and deck.get("name") == "Roses" and [c["name"] for c in deck["cards"]] == ["The Rider", "The Clover"]
       and deck["cards"][0]["upright"] == "" and deck["cards"][0]["image"] == "Roses The Rider.jpg", deck)
    imgs = sorted(os.listdir(os.path.join(data, "cards", "images")))
    ok("pictures copied as '<Deck> <Card>.jpg', and the cover", imgs == ["Roses The Clover.jpg", "Roses The Rider.jpg", "Roses cover.jpg"], imgs)
    ok("the other decks are kept", doc["oracleDecks"] == [{"name": "Old", "cards": []}])
    ok("celestial.json was backed up first",
       any(f.startswith("celestial.json.before-roses-") for f in os.listdir(os.path.join(data, "cards"))))
    add_scanned_deck.main([spec, "--scans", scans, "--data", data])
    doc = json.load(open(os.path.join(data, "cards", "celestial.json")))
    ok("run again: left alone, not added twice", len(doc["lenormandDecks"]) == 1)

    folder = os.path.join(APP, "tools", "decks")
    for fn in sorted(os.listdir(folder)):
        s = json.load(open(os.path.join(folder, fn), encoding="utf-8"))
        n = len(s["cards"])
        full = {"tarot": n == 78, "lenormand": n == 36, "oracle": n >= 12}[s["kind"]]
        ok(f"tools/decks/{fn}: {n} {s['kind']} cards, no id or picture twice",
           full and len({c["id"] for c in s["cards"]}) == n and len({c["file"] for c in s["cards"]}) == n)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\n  %d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
