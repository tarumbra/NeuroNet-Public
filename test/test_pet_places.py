"""The place editor's file (2026-10-15, audit FUT-2): ui/pet/art/places.js.

Where each place is painted on its scene moved out of pet.js into art/places.js, which Developer -> Place editor
writes through neuropets.Api.places_save -> pet.places_write. Every write here goes to a scratch folder -- the real
places.js is only read.
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


def bad(doc):
    try:
        pet.places_check(doc)
        return False
    except ValueError:
        return True


print("\nThe place editor's file (art/places.js)\n")
REAL = os.path.join(APP, "ui", "pet", "art", "places.js")
real = pet.places_read(REAL)
scenes = [k for k in real if k != "//"]
ok("the game's places load: 30+ scenes, 300+ places, notes kept apart", len(scenes) >= 30 and sum(len(real[k]) for k in scenes) >= 300
   and isinstance(real["//"], dict) and "ranch" in real["//"])
ok("  the file is exactly what the editor would write (so a Save changes only what you moved)",
   open(REAL, encoding="utf-8").read() == pet.places_text(real))
ok("  the page loads it before the game's pages", (lambda h: h.index('src="art/places.js"') < h.index('src="pet.js"'))(
   open(os.path.join(APP, "ui", "pet", "index.html"), encoding="utf-8").read()))
ok("  every scene has its painting", all(os.path.exists(os.path.join(APP, "ui", "pet", "art", k + ".webp")) for k in scenes if k != "islandestate"),
   [k for k in scenes if k != "islandestate" and not os.path.exists(os.path.join(APP, "ui", "pet", "art", k + ".webp"))])

good = {"//": {"ranch": "a note"}, "ranch": {"coop": {"at": [200, 220, 240], "o": [190, 380]}, "pet:estate": {"at": [1877.4, 462, 160, 70], "chip": "x" * 60}}}
c = pet.places_check(good)
ok("checked: numbers rounded, a chip cut to 40 letters, notes kept", c["ranch"]["pet:estate"]["at"] == [1877, 462, 160, 70]
   and len(c["ranch"]["pet:estate"]["chip"]) == 40 and c["//"] == {"ranch": "a note"})
ok("  refused: not a list of scenes", bad([]) and bad({}) and bad("x"))
ok("  refused: a place with too few or too many numbers, or text for numbers",
   bad({"s": {"k": {"at": [1, 2]}}}) and bad({"s": {"k": {"at": [1, 2, 3, 4, 5]}}}) and bad({"s": {"k": {"at": ["1", 2, 3]}}}) and bad({"s": {"k": {"at": [True, 2, 3]}}}))
ok("  refused: off the picture, an odd key, or anything else on a place",
   bad({"s": {"k": {"at": [99999, 2, 3]}}}) and bad({"s": {"<b>": {"at": [1, 2, 3]}}}) and bad({"s": {"k": {"at": [1, 2, 3], "onclick": "x"}}})
   and bad({"s": {"k": {"at": [1, 2, 3], "o": [1]}}}) and bad({"../x": {"k": {"at": [1, 2, 3]}}}))

tmp = tempfile.mkdtemp(prefix="nn-places-")
try:
    p = os.path.join(tmp, "places.js")
    shutil.copyfile(REAL, p)
    r = pet.places_write(p, good)
    back = pet.places_read(p)
    ok("written: it reads back the same, the old file kept as .bak", r == {"ok": True} and back == pet.places_check(good)
       and pet.places_read(p + ".bak") == real)
    text = open(p, encoding="utf-8").read()
    ok("  a scene to a line, then a place to a line (easy to read and to diff)",
       '\n  "ranch": {\n    "coop": {"at": [200, 220, 240], "o": [190, 380]},\n' in text and text.startswith("// NeuroPets -- where each place"))
    before = open(p, encoding="utf-8").read()
    try:
        pet.places_write(p, {"s": {"k": {"at": [1]}}})
        refused = False
    except ValueError:
        refused = True
    ok("  a bad save changes nothing", refused and open(p, encoding="utf-8").read() == before and not [f for f in os.listdir(tmp) if f.startswith(".places-")])
    # the game's bridge: Api.places_save writes art/places.js in the game's folder (here a scratch copy)
    import neuropets  # noqa: E402
    game = os.path.join(tmp, "pet")
    os.makedirs(os.path.join(game, "art"))
    shutil.copyfile(REAL, os.path.join(game, "art", "places.js"))
    old_dir = neuropets.game_dir
    neuropets.game_dir = lambda: game
    try:
        api = neuropets.Api()
        r1 = api.places_save(good)
        r2 = api.places_save({"s": {"k": {"at": [1]}}})
    finally:
        neuropets.game_dir = old_dir
    ok("neuropets.Api.places_save writes it, and says what's wrong with a bad one", r1 == {"ok": True}
       and pet.places_read(os.path.join(game, "art", "places.js")) == pet.places_check(good) and "error" in r2 and "3 or 4 numbers" in r2["error"])
finally:
    shutil.rmtree(tmp, ignore_errors=True)
ok("the real places.js is untouched by all that", pet.places_read(REAL) == real)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
