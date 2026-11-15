"""Media and things: one item, many formats (15 Nov 2026).

Cam: "add a movie, then click what category it is ... a tag for Dvd, VHS,
Blu-ray, Digital etc. This way we remove the double ups." media_shelf.media_v2
turns old per-format types into a kind + formats and merges the double ups;
adopt_movies brings the Movies folder's films in as Digital, linked to play.

Run: python3 test/test_media_formats.py
"""
import os
# Never Cam's real data (test_test_isolation.py): a paths file that can't exist, before anything else.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import media_shelf as ms  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nOld types become a kind and a format\n")
with tempfile.TemporaryDirectory() as data:
    doc = {"types": [{"id": "laser", "name": "LaserDisc"}], "items": [
        {"id": "a", "type": "dvd", "title": "Practical Magic", "year": "1998", "notes": "Mum's copy"},
        {"id": "b", "type": "vhs", "title": "practical  magic", "year": "1998", "favourite": True, "notes": "Taped", "cover": "2026-01-01"},
        {"id": "c", "type": "cd", "title": "Divide", "creator": "Ed Sheeran"},
        {"id": "d", "type": "vinyl", "title": "Divide", "creator": "Ed Sheeran"},
        {"id": "e", "type": "cd", "title": "Greatest Hits", "creator": "Queen"},
        {"id": "f", "type": "cd", "title": "Greatest Hits", "creator": "ABBA"},
        {"id": "g", "type": "laser", "title": "Alien"},
        {"id": "h", "type": "ps2", "title": "Okami"},
    ]}
    os.makedirs(ms.covers_dir(data), exist_ok=True)
    with open(ms.cover_path(data, "b"), "wb") as fh:
        fh.write(b"jpg")
    r = ms.media_v2(doc, data, {"b": "/films/pm.mkv"})
    by = {it["id"]: it for it in doc["items"]}
    ok("DVD + VHS of the same film are one item with both", set(by) >= {"a"} and "b" not in by
       and by["a"]["formats"] == ["DVD", "VHS"] and by["a"]["type"] == "film", by.get("a"))
    ok("  the favourite and both notes are kept", by["a"].get("favourite") and "Mum's copy" in by["a"]["notes"]
       and "Taped" in by["a"]["notes"])
    ok("  its cover moves over, and its linked video", os.path.isfile(ms.cover_path(data, "a"))
       and r["links"] == {"a": "/films/pm.mkv"}, r["links"])
    ok("CD + vinyl of one album merge", "d" not in by and by["c"]["formats"] == ["CD", "Vinyl"] and by["c"]["type"] == "music")
    ok("the same title by different artists stays apart", "e" in by and "f" in by)
    ok("a custom type becomes a format of Other", by["g"]["type"] == "other" and by["g"]["formats"] == ["LaserDisc"])
    ok("a game keeps its platform as the format", by["h"]["type"] == "game" and by["h"]["formats"] == ["PS2"])
    ok("counts and version", r["converted"] == 8 and r["merged"] == 2 and doc["mediaVersion"] == 2
       and doc["types"] == [], r)
    again = ms.media_v2(doc, data, r["links"])
    ok("running it again changes nothing", again["converted"] == 0 and again["merged"] == 0 and len(doc["items"]) == 6)

print("\nThe Movies folder's films come in as Digital\n")
with tempfile.TemporaryDirectory() as root:
    for name in ("GOAT (2024).mkv", "Practical Magic (1998).mp4"):
        open(os.path.join(root, name), "w").close()
    doc = {"items": [{"id": "pm", "type": "film", "formats": ["VHS"], "title": "Practical Magic", "year": "1998"}]}
    links, covers, ids = {}, [], iter(["n1", "n2"])
    films = [{"path": "GOAT (2024).mkv", "title": "GOAT", "year": "2024"},
             {"path": "Practical Magic (1998).mp4", "title": "Practical Magic", "year": "1998"},
             {"path": "../outside.mkv", "title": "Escape", "year": ""}]
    r = ms.adopt_movies(doc, films, root, lambda i, p: links.__setitem__(i, p),
                        lambda i, p: covers.append(i), lambda: next(ids), "2026-11-15")
    by = {it["id"]: it for it in doc["items"]}
    ok("a new film is added, tagged Digital, linked and given a cover",
       by.get("n1", {}).get("formats") == ["Digital"] and links.get("n1", "").endswith("GOAT (2024).mkv") and covers == ["n1"])
    ok("a film already on the shelf (VHS) gains Digital instead of a double up",
       by["pm"]["formats"] == ["VHS", "Digital"] and "pm" in links and len(doc["items"]) == 2)
    ok("nothing outside the Movies folder is linked", not any("outside" in p for p in links.values()))
    ok("counts and the done flag", r == {"added": 1, "joined": 1} and doc["moviesAdopted"] is True, r)

print("\nThe page\n")
stuff = open(os.path.join(HERE, "..", "ui", "stuff", "stuff.js"), encoding="utf-8").read()
ok("format chips in the item dialog, double ups offered to merge",
   'id="st-formats"' in stuff and "Add to it" in stuff and "MEDIA_FORMATS" in stuff)
ok("VHS-only films can still link a video (Play is per film, not per format)",
   "VHS" in stuff and "stuff:cinema" not in stuff)
app = open(os.path.join(HERE, "..", "ui", "app.js"), encoding="utf-8").read()
ok("the Cinema icon is gone; old links to it land on Media", '"stuff:cinema": "stuff:media"' in app)
ok("the player stays", os.path.isfile(os.path.join(HERE, "..", "ui", "stuff", "cinema-player.js"))
   and not os.path.exists(os.path.join(HERE, "..", "ui", "stuff", "cinema.js")))

print("\n  %d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
