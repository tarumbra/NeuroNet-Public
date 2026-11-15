"""Starter data travels with each release (2026-10-06).

Cam: "when new versions are pushed and released i want the data from cooking
to go there, with the recipe photos. Training data for sessions, circuits,
guides and documents to travel over as well as one default deck for tarot
(murder of crows), oracle (carnival of souls) and the lenormand."

tools/make_starter.py makes it from a data folder; starter_data.apply merges
it into another. Everything here runs on throwaway folders.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import starter_data  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


def wj(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f)


def rj(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def wb(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def deck(i, kind, name):
    return {"id": i, "kind": kind, "name": name, "cover": f"{name} cover.png",
            "cards": [{"id": "1", "name": "One", "image": f"{name} One.jpg"}]}


print("\nStarter data\n")
tmp = tempfile.mkdtemp(prefix="nn-starter-")
try:
    # ---- the source: Cam's data, in small ------------------------------------
    src = os.path.join(tmp, "src")
    wj(os.path.join(src, "kitchen", "cookery.json"), {"recipes": [
        {"id": "r1", "name": "Creme Anglaise", "tags": ["Sauce"], "images": [{"storedName": "a1.jpg"}]},
        {"id": "r2", "name": "Pavlova", "images": []}], "tagList": ["Sauce", "Dessert"], "menus": [{"id": "m"}]})
    wb(os.path.join(src, "photos", "a1.jpg"), b"\xff\xd8 creme")
    wb(os.path.join(src, "photos", "family.jpg"), b"\xff\xd8 private")
    wj(os.path.join(src, "neuronet.json"), {"photos": [
        {"id": "p1", "storedName": "a1.jpg", "albumIds": ["al"], "folderId": "f"},
        {"id": "p2", "storedName": "family.jpg"}], "albums": [{"id": "al"}]})
    wj(os.path.join(src, "training", "coach_cam.json"), {
        "sessions": [{"id": "s1", "name": "Sit Up program"}], "circuits": [{"id": "c1", "name": "RFT"}],
        "guides": [{"id": "g1", "name": "MAS"}], "documents": [{"id": "d1", "storedName": "plan.pdf"}],
        "equipment": [{"id": "e1", "name": "Ski Erg"}], "circuitTypes": ["EMOM"],
        "exercises": {"Push": ["Push-up"]}, "athletes": [{"id": "a1", "name": "A client"}],
        "programs": [{"id": "pr1"}], "questionnaires": [{"id": "q1"}]})
    wb(os.path.join(src, "training", "documents", "plan.pdf"), b"%PDF plan")
    decks = [deck("t1", "tarot", "Murder Of Crows"), deck("t2", "tarot", "Ryder Smith")]
    wj(os.path.join(src, "cards", "celestial.json"), {
        "tarotDecks": decks, "oracleDecks": [deck("o1", "oracle", "Carnival Of Souls")],
        "lenormandDecks": [deck("l1", "lenormand", "Lenormand Of Enchantment")],
        "tarotReadings": [{"id": "x"}]})
    for name in ("Murder Of Crows", "Ryder Smith", "Carnival Of Souls", "Lenormand Of Enchantment"):
        wb(os.path.join(src, "cards", "images", f"{name} cover.png"), b"png " + name.encode())
        wb(os.path.join(src, "cards", "images", f"{name} One.jpg"), b"jpg " + name.encode())

    out = os.path.join(tmp, "starter.json")
    files = os.path.join(tmp, "files")
    r = subprocess.run([sys.executable, os.path.join(APP, "tools", "make_starter.py"), "--data", src,
                        "--out", out, "--files-tree", files, "--no-commit"], capture_output=True, text=True, timeout=60)
    ok("make_starter makes the starter from a data folder", r.returncode == 0 and os.path.isfile(out), r.stdout + r.stderr)
    st = rj(out)
    cols = {f'{c["doc"]}.{c["key"]}': c["items"] for c in st["collections"]}
    ok("  the recipes, and the Photos entries of their pictures only (not in albums or folders here)",
       [x["id"] for x in cols["kitchen.recipes"]] == ["r1", "r2"]
       and cols["photos.photos"] == [{"id": "p1", "storedName": "a1.jpg", "albumIds": [], "folderId": ""}])
    ok("  Training's sessions, circuits, guides and documents, with the equipment, types and exercise names",
       all(k in cols for k in ("training.sessions", "training.circuits", "training.guides", "training.documents", "training.equipment"))
       and {"doc": "training", "key": "circuitTypes", "values": ["EMOM"]} in st["names"])
    ok("  not the clients, programs or questionnaires, the menus or the readings",
       not any(k in cols for k in ("training.athletes", "training.programs", "training.questionnaires", "kitchen.menus"))
       and "x" not in json.dumps(cols.get("cards.tarotDecks")))
    ok("  one deck of each kind: Murder Of Crows, Carnival Of Souls, Lenormand Of Enchantment",
       [d["name"] for d in cols["cards.tarotDecks"]] == ["Murder Of Crows"]
       and [d["name"] for d in cols["cards.oracleDecks"]] == ["Carnival Of Souls"]
       and [d["name"] for d in cols["cards.lenormandDecks"]] == ["Lenormand Of Enchantment"]
       and st["dailyDecks"] == {"tarot": "t1", "oracle": "o1", "lenormand": "l1"})
    want = {"photos/a1.jpg", "training/documents/plan.pdf", "cards/images/Murder Of Crows cover.png",
            "cards/images/Murder Of Crows One.jpg", "cards/images/Carnival Of Souls One.jpg",
            "cards/images/Carnival Of Souls cover.png", "cards/images/Lenormand Of Enchantment One.jpg",
            "cards/images/Lenormand Of Enchantment cover.png"}
    ok("  the files they need, and nothing else (no family photo, no other deck)", set(st["files"]["sha1"]) == want,
       sorted(st["files"]["sha1"]))
    ok("  laid out in the files tree, named by its tag",
       all(os.path.isfile(os.path.join(files, f)) for f in want)
       and open(os.path.join(files, "TAG")).read().strip() == st["files"]["tag"]
       and st["files"]["tag"].startswith("starter-files-"))

    # ---- another computer ------------------------------------------------------
    dst = os.path.join(tmp, "dst")
    state = os.path.join(tmp, "state")
    docs = {"kitchen": os.path.join(dst, "kitchen", "cookery.json"), "training": os.path.join(dst, "training", "coach_cam.json"),
            "cards": os.path.join(dst, "cards", "celestial.json"), "photos": os.path.join(dst, "neuronet.json")}
    wj(docs["kitchen"], {"recipes": [{"id": "mine", "name": "My soup"}], "tagList": ["Soup"]})
    wj(docs["training"], {"sessions": [], "exercises": {"Push": ["Dips"]}})
    wj(os.path.join(state, "neuronet-oracle", "state.json"), {"kind": "oracle", "deckIds": {"oracle": "any"}})

    rep = starter_data.apply(out, os.path.join(tmp, "nowhere"), dst, docs, state_home=state)
    ok("nothing is merged until its pictures and files are here", "skipped" in rep and not os.path.exists(os.path.join(dst, "photos")), rep)

    rep = starter_data.apply(out, files, dst, docs, state_home=state)
    k, t, c, p = rj(docs["kitchen"]), rj(docs["training"]), rj(docs["cards"]), rj(docs["photos"])
    ok("the recipes arrive beside this computer's own, with their photos in Photos",
       [x["id"] for x in k["recipes"]] == ["mine", "r1", "r2"] and k["tagList"] == ["Soup", "Sauce", "Dessert"]
       and os.path.isfile(os.path.join(dst, "photos", "a1.jpg")) and [x["id"] for x in p["photos"]] == ["p1"], rep)
    ok("Training's items arrive, exercise names joined to this computer's",
       [x["id"] for x in t["sessions"]] == ["s1"] and t["guides"][0]["name"] == "MAS"
       and t["exercises"] == {"Push": ["Dips", "Push-up"]} and t["circuitTypes"] == ["EMOM"]
       and os.path.isfile(os.path.join(dst, "training", "documents", "plan.pdf")))
    ok("the three decks arrive with their pictures",
       [d["id"] for d in c["tarotDecks"] + c["oracleDecks"] + c["lenormandDecks"]] == ["t1", "o1", "l1"]
       and os.path.isfile(os.path.join(dst, "cards", "images", "Murder Of Crows One.jpg")))
    ok("they're the desktop's daily decks where none was chosen; a choice (even 'any') is kept",
       rj(os.path.join(state, "neuronet-tarot", "state.json"))["deckIds"] == {"tarot": "t1"}
       and rj(os.path.join(state, "neuronet-lenormand", "state.json"))["deckIds"] == {"lenormand": "l1"}
       and rj(os.path.join(state, "neuronet-oracle", "state.json"))["deckIds"] == {"oracle": "any"})
    ok("  starting again changes nothing", starter_data.apply(out, files, dst, docs, state_home=state) == {"skipped": "already applied"})
    # on the computer it was made from, nothing is rewritten
    m0 = {n: os.path.getmtime(pth) for n, pth in docs.items()}
    os.remove(os.path.join(dst, starter_data.LEDGER))
    starter_data.apply(out, files, dst, docs, state_home=state)
    ok("  where everything is already the same, no file is rewritten",
       all(os.path.getmtime(pth) == m0[n] for n, pth in docs.items()))

    # ---- the next release ------------------------------------------------------
    k["recipes"] = [x for x in k["recipes"] if x["id"] != "r2"]          # deleted here
    k["recipes"][1]["notes"] = "less sugar"                              # r1 edited here
    wj(docs["kitchen"], k)
    t["sessions"][0]["notes"] = "mine"                                   # s1 edited here
    wj(docs["training"], t)
    os.remove(os.path.join(dst, "cards", "images", "Murder Of Crows cover.png"))
    st2 = json.loads(json.dumps(st))
    cols2 = {f'{c2["doc"]}.{c2["key"]}': c2 for c2 in st2["collections"]}
    cols2["kitchen.recipes"]["items"][0]["name"] = "Crème Anglaise"     # changed at the source
    cols2["kitchen.recipes"]["items"].append({"id": "r3", "name": "Brownies"})
    cols2["training.circuits"]["items"][0]["name"] = "RFT (Rounds For Time)"
    cols2["training.guides"]["items"] = []                               # dropped at the source
    st2["stamp"] = "next"
    out2 = os.path.join(tmp, "starter2.json")
    wj(out2, st2)
    rep = starter_data.apply(out2, files, dst, docs, state_home=state)
    k, t = rj(docs["kitchen"]), rj(docs["training"])
    r1 = next(x for x in k["recipes"] if x["id"] == "r1")
    ok("next release: a new recipe arrives; one deleted here stays deleted", [x["id"] for x in k["recipes"]] == ["mine", "r1", "r3"], rep)
    ok("  one changed here keeps this computer's version", r1.get("notes") == "less sugar" and r1["name"] == "Creme Anglaise")
    ok("  one nobody changed here takes the new version", t["circuits"][0]["name"] == "RFT (Rounds For Time)")
    ok("  one dropped from the starter goes, as nobody changed it here", t["guides"] == [])
    ok("  a session edited here is kept", t["sessions"][0].get("notes") == "mine")
    ok("  and a picture deleted here isn't brought back", not os.path.exists(os.path.join(dst, "cards", "images", "Murder Of Crows cover.png")))

    # ---- Media (15 Nov 2026) ---------------------------------------------------
    # Cam: "when i push and release please carry over the media data as well for example all the movie titles and
    # information. Not the video files themselves but the meta data. Do this for all media please as well."
    wj(os.path.join(src, "personal_effects.json"), {"mediaVersion": 2, "moviesAdopted": True, "types": [{"id": "comics", "name": "Comics"}],
        "items": [{"id": "e1", "type": "film", "title": "Dust Bunny", "year": "2025", "formats": ["Blu-ray"], "coverPhoto": "dbc.jpg",
                   "cover": "2026-11-15", "film": "Dust Bunny (2025)/Dust.Bunny.mkv"},
                  {"id": "e2", "type": "music", "title": "Rumours", "creator": "Fleetwood Mac", "formats": ["Vinyl"]}]})
    wb(os.path.join(src, "media_covers", "e1.jpg"), b"\xff\xd8 dust bunny small")
    wb(os.path.join(src, "photos", "dbc.jpg"), b"\xff\xd8 dust bunny cover")
    wb(os.path.join(src, "Movies", "Dust Bunny (2025)", "Dust.Bunny.mkv"), b"a film")
    idx = rj(os.path.join(src, "neuronet.json"))
    idx["folders"] = [{"id": "fcov", "name": "Covers", "parentId": ""}, {"id": "fam", "name": "Family", "parentId": ""}]
    idx["photos"].append({"id": "p9", "storedName": "dbc.jpg", "folderId": "fcov", "tags": ["Cover"], "albumIds": ["al"]})
    wj(os.path.join(src, "neuronet.json"), idx)
    mout, mfiles = os.path.join(tmp, "m-starter.json"), os.path.join(tmp, "m-files")
    r = subprocess.run([sys.executable, os.path.join(APP, "tools", "make_starter.py"), "--data", src,
                        "--out", mout, "--files-tree", mfiles, "--no-commit"], capture_output=True, text=True, timeout=60)
    ms_ = rj(mout)
    mcols = {c.get("area") or f'{c["doc"]}.{c["key"]}': c["items"] for c in ms_["collections"]}
    ok("Media goes with the release: every film and album with its details, and its own types",
       r.returncode == 0 and [x["title"] for x in mcols["media.items"]] == ["Dust Bunny", "Rumours"]
       and mcols["media.types"] == [{"id": "comics", "name": "Comics"}], r.stderr)
    ok("  with the shelf's covers and the cover photos (in Photos, Covers), not the films",
       {"media_covers/e1.jpg", "photos/dbc.jpg"} <= set(ms_["files"]["sha1"])
       and not any("Movies" in f or f.endswith(".mkv") for f in ms_["files"]["sha1"])
       and [e["storedName"] for e in mcols["photos.covers"]] == ["dbc.jpg"] and mcols["photos.covers"][0]["folderId"] == "fcov"
       and mcols["photos.covers"][0]["albumIds"] == []
       and ms_["foldersByName"][0]["items"] == [{"id": "fcov", "name": "Covers", "parentId": ""}])

    # a computer with no Media yet, and its own Covers folder in Photos
    m2 = os.path.join(tmp, "m2")
    mdocs = {"kitchen": os.path.join(m2, "kitchen", "cookery.json"), "training": os.path.join(m2, "training", "coach_cam.json"),
             "cards": os.path.join(m2, "cards", "celestial.json"), "photos": os.path.join(m2, "neuronet.json"),
             "media": os.path.join(m2, "personal_effects.json")}
    wj(mdocs["photos"], {"photos": [{"id": "q1", "storedName": "mine.jpg", "folderId": "myCov"}],
                         "folders": [{"id": "myCov", "name": "Covers", "parentId": ""}], "photoTagList": []})
    starter_data.apply(mout, mfiles, m2, mdocs)
    md, ph = rj(mdocs["media"]), rj(mdocs["photos"])
    ok("another computer gets the Media list, as Media is now (no conversion from the old kind)",
       [x["title"] for x in md["items"]] == ["Dust Bunny", "Rumours"] and md.get("mediaVersion") == 2
       and "moviesAdopted" not in md and os.path.isfile(os.path.join(m2, "media_covers", "e1.jpg")))
    ok("  the cover photo goes into ITS Covers folder (never a second Covers)",
       [f["name"] for f in ph["folders"]].count("Covers") == 1
       and next(x for x in ph["photos"] if x["storedName"] == "dbc.jpg")["folderId"] == "myCov"
       and "Cover" in ph["photoTagList"] and os.path.isfile(os.path.join(m2, "photos", "dbc.jpg")), json.dumps(ph))
    # next release: a film edited on that computer is kept; one edited only at the source is updated
    md["items"][0]["notes"] = "watched on the laptop"
    wj(mdocs["media"], md)
    ms2 = json.loads(json.dumps(ms_))
    for c2 in ms2["collections"]:
        if c2["doc"] == "media" and c2["key"] == "items":
            c2["items"][1]["formats"] = ["Vinyl", "CD"]
            c2["items"][0]["year"] = "2024"
            c2["items"].append({"id": "e3", "type": "film", "title": "Practical Magic", "formats": ["VHS"]})
    ms2["stamp"] = "media-next"
    wj(mout, ms2)
    starter_data.apply(mout, mfiles, m2, mdocs)
    md = rj(mdocs["media"])
    ok("next release: new titles arrive, changes made here are kept, the rest take the new details",
       [x["title"] for x in md["items"]] == ["Dust Bunny", "Rumours", "Practical Magic"]
       and md["items"][0].get("notes") == "watched on the laptop" and md["items"][0]["year"] == "2025"
       and md["items"][1]["formats"] == ["Vinyl", "CD"], json.dumps(md["items"]))
    old = {k: v for k, v in mdocs.items() if k != "media"}
    ok("  a NeuroNet that doesn't know Media yet skips it without failing",
       "skipped" not in starter_data.apply(mout, mfiles, os.path.join(tmp, "m3"), dict(old, kitchen=os.path.join(tmp, "m3", "k.json"))))

    # ---- where it's wired ------------------------------------------------------
    src_py = __import__("backend_src").backend_source(APP)
    main = src_py.split("def main():")[1]
    ok("NeuroNet merges it as it starts, before the window opens, never on a brand-new computer before its welcome",
       main.index("apply_starter()") < main.index("api = Api()")
       and "if welcome_wanted() or _missing_data:" in src_py.split("def apply_starter():")[1].split("def ")[0])
    upd = open(os.path.join(APP, "system", "bin", "neuronet-update"), encoding="utf-8").read()
    ok("neuronet-update fetches the pictures and files under their own tag, only when it changes, even with no new release",
       'clone -q --depth 1 --branch "$want"' in upd
       and upd.index("starter_files\n  echo \"NeuroNet $have is the newest.\"") > 0
       and upd.count("starter_files\n") >= 2)
    real = os.path.join(APP, "system", "starter", "starter.json")
    if os.path.isfile(real):
        rs = rj(real)
        ok("this release's starter has the three decks and some recipes",
           {c["key"] for c in rs["collections"]} >= {"recipes", "sessions", "tarotDecks", "oracleDecks", "lenormandDecks"}
           and rs["files"]["tag"].startswith("starter-files-"))
    # the ship list travels too (2026-10-24, Cam: "I would like the notes to be synced"), merged into each computer's own
    ms = open(os.path.join(APP, "tools", "make_starter.py"), encoding="utf-8").read()
    sd = os.path.join(tmp, "ship")
    sfiles, sdata = os.path.join(sd, "files"), os.path.join(sd, "data")
    wj(os.path.join(sfiles, "notes", "ship.json"), {"paths": ["NeuroPets", "A note.md"], "vaults": ["v4"]})
    open(os.path.join(sfiles, "TAG"), "w").write("starter-files-ship")
    wj(os.path.join(sdata, "notes", "ship.json"), {"paths": ["NeuroCafe", "A note.md"]})
    sst = os.path.join(sd, "starter.json")
    wj(sst, {"collections": [], "names": [], "files": {"tag": "starter-files-ship", "sha1": {"notes/ship.json": starter_data.file_sha1(os.path.join(sfiles, "notes", "ship.json"))}}, "stamp": "s1"})
    starter_data.apply(sst, sfiles, sdata, {}, state_home=os.path.join(sd, "state"))
    got = rj(os.path.join(sdata, "notes", "ship.json"))
    ok("the notes' ship list goes with the release and merges into this computer's (its own ticks kept)",
       '"notes/ship.json"' in ms and got.get("paths") == ["A note.md", "NeuroCafe", "NeuroPets"] and got.get("vaults") == ["v4"], json.dumps(got))
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
