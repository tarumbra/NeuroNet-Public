"""The Kitchen's cookbook library (kitchen_backend join_library / split_library),
23 Nov 2026: Cam's decoded MasterCook cookbooks live in <kitchen>/library/*.json,
are joined in when the Kitchen loads and taken back out when it saves, so
cookery.json stays Cam's own and stays small.

Run: python3 test/test_cookery_library.py
"""
import os
# Never Cam's real data (test_test_isolation.py): a paths file that can't exist, before anything else.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", "crux", "py"))
import kitchen_backend as K  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


root = tempfile.mkdtemp(prefix="nn-cookery-library-")
K.ROOT_PROVIDER = lambda: root
os.makedirs(os.path.join(root, "kitchen", "library"))


def recipe(rid, book):
    return {"id": rid, "created": "2026-11-23T00:00:00.000Z", "name": rid, "tags": ["Soup"], "source": book,
            "servings": "4", "images": [], "description": "", "ingredients": ["240 ml stock"],
            "steps": ["Simmer."], "notes": "", "library": book}


def write_book(slug, name, ids):
    doc = {"book": {"id": "mcbook-" + slug, "name": name, "logo": "", "notes": "", "library": name,
                    "created": "2026-11-23T00:00:00.000Z", "recipeIds": ids},
           "recipes": [recipe(i, name) for i in ids]}
    with open(os.path.join(root, "kitchen", "library", slug + ".json"), "w") as f:
        json.dump(doc, f)


own = {"id": "own1", "name": "Creme Anglaise", "tags": ["Sauce"], "ingredients": ["250 Ml Cream"], "steps": [""]}
K.write_cookery({"recipes": [own], "tagList": ["Sauce"]})
write_book("soups", "Soups", ["s1", "s2", "s3"])
write_book("breads", "Breads", ["b1", "b2"])


def load():
    """What the window gets, after a trip through the bridge."""
    return json.loads(json.dumps(K.join_library(K.read_cookery())))


def disk():
    with open(K.cookery_file()) as f:
        return json.load(f)


print("\nLoading\n")
doc = load()
ok("the Kitchen is Cam's recipes plus every cookbook's", [r["id"] for r in doc["recipes"]] == ["own1", "b1", "b2", "s1", "s2", "s3"],
   [r["id"] for r in doc["recipes"]])
ok("  and a book for each cookbook", sorted(b["id"] for b in doc["books"]) == ["mcbook-breads", "mcbook-soups"])
ok("  with a token for the library it was loaded against", bool(doc.get("libraryToken")))
ok("Find gets names and tags only", K.recipe_index()[0] == {"id": "own1", "name": "Creme Anglaise", "tags": ["Sauce"]})

print("\nSaving the whole document (an older window)\n")
K.write_cookery(K.split_library(doc))
ok("nothing untouched from the library lands in cookery.json", [r["id"] for r in disk()["recipes"]] == ["own1"]
   and disk()["books"] == [] and disk()["libraryHidden"] == [])

doc = load()
next(r for r in doc["recipes"] if r["id"] == "s2")["favourite"] = True
doc["recipes"] = [r for r in doc["recipes"] if r["id"] != "b1"]
K.write_cookery(K.split_library(doc))
ok("a favourited library recipe is kept as Cam's own", [r["id"] for r in disk()["recipes"]] == ["own1", "s2"])
ok("  a deleted one is remembered as deleted", disk()["libraryHidden"] == ["b1"])
doc = load()
ok("  and loading again shows both", next(r for r in doc["recipes"] if r["id"] == "s2").get("favourite") is True
   and not any(r["id"] == "b1" for r in doc["recipes"]) and sum(r["id"] == "s2" for r in doc["recipes"]) == 1)

stale = dict(doc, libraryToken="from-another-library")
stale["recipes"] = [r for r in stale["recipes"] if r["id"] != "s3"]
K.write_cookery(K.split_library(stale))
ok("a window loaded against a different library can't delete anything", disk()["libraryHidden"] == ["b1"])

print("\nSaving only what changed (app.js kitchenPayload)\n")
doc = load()
slim = dict(doc, recipes=[r for r in doc["recipes"] if not r.get("library")], books=[], libraryGone=[])
K.write_cookery(K.split_library(slim))
ok("Cam's own copy of a library recipe survives a save that didn't carry it", [r["id"] for r in disk()["recipes"]] == ["own1", "s2"],
   [r["id"] for r in disk()["recipes"]])
ok("  untouched ones aren't taken as deleted", disk()["libraryHidden"] == ["b1"])

doc = load()
s1 = next(r for r in doc["recipes"] if r["id"] == "s1")
s1["name"] = "Soup one, my way"
slim = dict(doc, recipes=[r for r in doc["recipes"] if not r.get("library")] + [s1], books=[], libraryGone=["s3", "s2"])
K.write_cookery(K.split_library(slim))
ok("an edit is saved, the ones it says are gone are hidden", sorted(r["id"] for r in disk()["recipes"]) == ["own1", "s1"]
   and disk()["libraryHidden"] == ["b1", "s2", "s3"], (disk()["recipes"], disk()["libraryHidden"]))
doc = load()
ok("  and the edit wins over the cookbook's version", [r["name"] for r in doc["recipes"] if r["id"] == "s1"] == ["Soup one, my way"])

doc["libraryGone"] = ["s2", "s3", "b1", "not-a-library-id"]
doc["recipes"] = [r for r in doc["recipes"] if not r.get("library")]
K.write_cookery(K.split_library(doc))
ok("only real library ids can be hidden", disk()["libraryHidden"] == ["b1", "s2", "s3"])

print("\nNo library at all\n")
for n in os.listdir(os.path.join(root, "kitchen", "library")):
    os.remove(os.path.join(root, "kitchen", "library", n))
doc = load()
ok("the Kitchen is just cookery.json, no token", "libraryToken" not in doc and [r["id"] for r in doc["recipes"]] == ["own1", "s1"])

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
