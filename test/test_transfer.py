"""Export & import -- data_transfer.py and the app's list of where data lives.

Cam: "a setting to export and import data. It will export all the data except
for music, movies, videos or anything large, It will export the photos and
ebooks. This will make it easier to move to another system."

Two made-up computers in a temporary folder: one exported, one imported into.
Guarded in particular:
  * the new computer's music is never touched by an import
  * a file an import replaces is kept first
  * an export can't write outside the places it belongs, however its zip is made
  * data kept OUTSIDE neuronet_data (family, recipes, money) is exported too
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import importlib.util, io, json, os, sys, tempfile, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import data_transfer as dt  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def put(path, data=b"x"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data if isinstance(data, bytes) else data.encode())


print("\nExport & import\n")

# ---- what goes in ---------------------------------------------------------------
for rel, why in (("chords/music/Song.flac", "music"), ("meditation/Sleep.mp4", "music"),
                 ("photos_thumbs/a.jpg", "cache"), ("chords/thumbs/a.jpg", "cache"),
                 ("training/coach_cam.json.backup-20260918-211943", "backup"),
                 ("x.json.tmp", "backup"), ("import-backups/2026/x.json", "cache")):
    ok("left out: " + rel, why in (dt.left_out(rel) or ""), dt.left_out(rel))
for rel in ("photos/abc.jpg", "ebooks/files/b1.epub", "ebooks/files/b2.pdf", "notes/vault/Plan.md",
            "chords/chords.json", "chords/images/cover.jpg", "media_covers/m1.jpg",
            "notes/vault/thumbs/sketch.png"):
    ok("kept: " + rel, dt.left_out(rel) is None, dt.left_out(rel))

with tempfile.TemporaryDirectory() as tmp:
    A = os.path.join(tmp, "old")
    B = os.path.join(tmp, "new")
    # ---- the old computer ---------------------------------------------------------
    big_photo = os.urandom(3 * 1024 * 1024)
    put(f"{A}/nn/photos/p1.jpg", big_photo)
    put(f"{A}/nn/ebooks/library.json", '{"books": []}')
    put(f"{A}/nn/ebooks/files/b1.epub", os.urandom(200000))
    put(f"{A}/nn/notes/vault/Plan.md", "# Plan\nWrite it all down.")
    put(f"{A}/nn/chords/chords.json", '{"tracks": {}}')
    put(f"{A}/nn/chords/music/Song.flac", os.urandom(500000))
    put(f"{A}/nn/meditation/Sleep.mp4", os.urandom(300000))
    put(f"{A}/nn/photos_thumbs/p1.jpg", b"thumb")
    put(f"{A}/nn/training/coach_cam.json", '{"sessions": []}')
    put(f"{A}/nn/training/coach_cam.json.backup-20260918-211943", "old")
    put(f"{A}/family/camily.json", '{"events": [{"name": "Birthday"}]}')
    put(f"{A}/family/photos/f1.jpg", b"family photo")
    put(f"{A}/recipes/cookery.json", '{"recipes": [{"name": "Soup"}]}')
    put(f"{A}/money/cashbox.json", '{"payments": {}}')
    put(f"{A}/app/neuronet_prefs.json", '{"theme": "forest"}')
    areas_a = [{"key": "neuronet", "label": "NeuroNet", "path": f"{A}/nn"},
               {"key": "family", "label": "Family", "path": f"{A}/family"},
               {"key": "recipes", "label": "Recipes", "path": f"{A}/recipes"},
               {"key": "money", "label": "Money", "path": f"{A}/money"},
               {"key": "settings", "label": "Settings", "path": f"{A}/app/neuronet_prefs.json", "file": True},
               {"key": "kitchen-settings", "label": "Kitchen settings",
                "path": f"{A}/app/hearth_prefs.json", "file": True}]

    s = dt.summary(areas_a)
    ok("the summary counts what will go, place by place",
       [a["files"] for a in s["areas"]] == [6, 2, 1, 1, 1, 0], [a["files"] for a in s["areas"]])
    music = next((x for x in s["skipped"] if "music" in x["why"]), None)
    ok("  and says what is left out, with its size", music and music["files"] == 2
       and music["bytes"] == 800000, s["skipped"])

    zpath = os.path.join(tmp, "export.zip")
    seen = []
    r = dt.export(areas_a, zpath, lambda d, n, f: seen.append((d, n, f)))
    with zipfile.ZipFile(zpath) as z:
        names = set(z.namelist())
        stored = z.getinfo("neuronet/photos/p1.jpg").compress_type
    ok("the export is written", r["ok"] and os.path.isfile(zpath) and not os.path.exists(zpath + ".part"))
    ok("  with the photos and ebooks in it",
       {"neuronet/photos/p1.jpg", "neuronet/ebooks/files/b1.epub", "neuronet/ebooks/library.json"} <= names)
    ok("  and the family data, recipes, money and settings kept outside NeuroNet's folder",
       {"family/camily.json", "family/photos/f1.jpg", "recipes/cookery.json", "money/cashbox.json",
        "settings/neuronet_prefs.json"} <= names, sorted(names))
    ok("  but no music, films, caches or old backup copies",
       not any(n.endswith((".flac", ".mp4")) or "photos_thumbs" in n or ".backup-" in n for n in names),
       sorted(names))
    ok("  photos stored as they are (already compressed)", stored == zipfile.ZIP_STORED)
    ok("  saying what it is", json.loads(zipfile.ZipFile(zpath).read(dt.MANIFEST))["format"] == dt.FORMAT)
    ok("  and progress was reported to the end", seen and seen[-1][:2] == (11, 11) and seen[-1][2] == 1.0,
       seen[-1:])

    # ---- the new computer: its own paths, its own music ------------------------------
    put(f"{B}/data/chords/music/Theirs.flac", b"the new computer's music")
    put(f"{B}/data/notes/vault/Plan.md", "an older plan")
    put(f"{B}/data/notes/vault/Only here.md", "made on the new computer")
    areas_b = [{"key": "neuronet", "label": "NeuroNet", "path": f"{B}/data"},
               {"key": "family", "label": "Family", "path": f"{B}/elsewhere/camily_data"},
               {"key": "recipes", "label": "Recipes", "path": f"{B}/elsewhere/cookery_data"},
               {"key": "money", "label": "Money", "path": f"{B}/app/kincrux_money"},
               {"key": "settings", "label": "Settings", "path": f"{B}/app/neuronet_prefs.json", "file": True}]
    back = f"{B}/data/import-backups"
    res = dt.import_zip(zpath, areas_b, back)
    ok("an import puts each part where THIS computer keeps it",
       open(f"{B}/elsewhere/camily_data/camily.json").read().count("Birthday") == 1
       and os.path.isfile(f"{B}/app/kincrux_money/cashbox.json")
       and open(f"{B}/app/neuronet_prefs.json").read() == '{"theme": "forest"}')
    ok("  photos and ebooks arrive whole", open(f"{B}/data/photos/p1.jpg", "rb").read() == big_photo)
    ok("  the new computer's music is untouched",
       open(f"{B}/data/chords/music/Theirs.flac", "rb").read() == b"the new computer's music")
    ok("  nothing is deleted", os.path.isfile(f"{B}/data/notes/vault/Only here.md"))
    ok("  a file it replaces is kept first",
       res["replaced"] == 1 and open(os.path.join(res["backup"], "neuronet/notes/vault/Plan.md")).read()
       == "an older plan", res)
    again = dt.import_zip(zpath, areas_b, back)
    ok("importing the same export twice changes nothing and backs nothing up",
       again["written"] == 0 and again["replaced"] == 0 and again["same"] == res["written"], again)

    # ---- files that aren't exports, or are made to escape ----------------------------
    bad = os.path.join(tmp, "bad.zip")
    with zipfile.ZipFile(bad, "w") as z:
        z.writestr("hello.txt", "hi")
    ok("a zip that isn't an export is refused", "error" in dt.read_manifest(bad))
    open(os.path.join(tmp, "junk.zip"), "wb").write(b"not a zip")
    ok("  so is something that isn't a zip at all", "error" in dt.read_manifest(os.path.join(tmp, "junk.zip")))
    newer = os.path.join(tmp, "newer.zip")
    with zipfile.ZipFile(newer, "w") as z:
        z.writestr(dt.MANIFEST, json.dumps({"format": dt.FORMAT, "version": dt.VERSION + 1}))
    ok("  and one from a newer NeuroNet says to update first", "newer" in dt.read_manifest(newer).get("error", ""))

    evil = os.path.join(tmp, "evil.zip")
    with zipfile.ZipFile(evil, "w") as z:
        z.writestr(dt.MANIFEST, json.dumps({"format": dt.FORMAT, "version": 1, "areas": []}))
        z.writestr("neuronet/../../escaped.txt", "out")
        z.writestr("neuronet//etc/abs.txt", "out")
        z.writestr("settings/../x.json", "out")
        z.writestr("settings/sub/neuronet_prefs.json", "out")
        z.writestr("neuronet/fine.txt", "in")
        z.writestr("stranger/x.txt", "somewhere this computer doesn't have")
    r = dt.import_zip(evil, areas_b, back)
    ok("names that would land outside their place are refused, not written",
       not os.path.exists(os.path.join(B, "escaped.txt")) and not os.path.exists(os.path.join(tmp, "escaped.txt"))
       and len(r["refused"]) >= 3 and os.path.isfile(f"{B}/data/fine.txt"), r["refused"])
    ok("  a place this computer doesn't have is named, not guessed at",
       r["unknown"] == ["stranger"], r["unknown"])
    ok("  and the settings file is still the real one", open(f"{B}/app/neuronet_prefs.json").read()
       == '{"theme": "forest"}')

# ---- the app's list of places --------------------------------------------------------------
spec = importlib.util.spec_from_file_location("nn", os.path.join(APP, "neuronet.py"))
nn = importlib.util.module_from_spec(spec)
sys.modules["nn"] = nn
spec.loader.exec_module(nn)
with tempfile.TemporaryDirectory() as tmp:
    nn.data_dir = lambda: os.path.join(tmp, "nd")
    nn.prefs_file = lambda: os.path.join(tmp, "neuronet_prefs.json")

    class KB:
        data_dir = staticmethod(lambda: os.path.join(tmp, "nd", "camily"))      # inside neuronet_data
        cookery_dir = staticmethod(lambda: os.path.join(tmp, "cookery_data"))   # outside it
        money_dir = staticmethod(lambda: os.path.join(tmp, "nd"))               # the same folder
        prefs_file = staticmethod(lambda: os.path.join(tmp, "hearth_prefs.json"))
    nn.kitchen_backend = KB
    got = [a["key"] for a in nn.Api.__new__(nn.Api)._transfer_areas()]
    ok("every place the app keeps data is listed, each only once",
       got == ["neuronet", "recipes", "settings", "kitchen-settings"], got)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
