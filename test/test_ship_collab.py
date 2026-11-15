"""The release carries Collaboration and the shipped notebooks (2026-10-16, Cam: "push and release all the collaboration
notes"): make_starter packs collab/*.json and the vaults named in ship.json's "vaults"; starter_data merges the vault list
by id (a computer's own vaults stay) and, like every file, keeps one edited on that computer; Notes keeps "vaults" when it
rewrites ship.json. Everything here is in scratch folders. Run: python3 test/test_ship_collab.py"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json, os, sys, tempfile
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP); sys.path.insert(0, os.path.join(APP, "tools"))
import starter_data, make_starter  # noqa: E402  (imported before anything points at a data folder)
import notes_backend as nb  # noqa: E402
ok_n = bad = 0
def ok(name, cond, detail=""):
    global ok_n, bad
    print(("  ok    " if cond else "  FAIL  ") + name + ("" if cond else "  -- " + str(detail)))
    if cond: ok_n += 1
    else: bad += 1
def w(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f: json.dump(obj, f)
with tempfile.TemporaryDirectory() as d:
    src = os.path.join(d, "desk")
    w(os.path.join(src, "collab", "PT1.json"), {"ref": "PT1"}); w(os.path.join(src, "collab", "V3.json"), {"ref": "V3"})
    os.makedirs(os.path.join(src, "notes", "vaults", "v4", "Battle Re-work"))
    open(os.path.join(src, "notes", "vaults", "v4", "Battle Re-work", "00 - Start here.md"), "w").write("# start")
    w(os.path.join(src, "notes", "vaults.json"), {"active": "v4", "vaults": [{"id": "v4", "name": "Battle Re-Work"}]})
    w(os.path.join(src, "notes", "ship.json"), {"paths": [], "vaults": ["v4", "../x"]})
    # build() needs the other parts' files: the smallest that will do
    w(os.path.join(src, "kitchen", "cookery.json"), {"recipes": []}); w(os.path.join(src, "neuronet.json"), {"photos": []})
    w(os.path.join(src, "training", "coach_cam.json"), {})
    w(os.path.join(src, "cards", "celestial.json"), {k + "Decks": [{"id": k, "name": n}] for k, n in make_starter.DECKS.items()})
    starter, files = make_starter.build(src)
    ok("the release carries every Collaboration document", "collab/PT1.json" in files and "collab/V3.json" in files, sorted(files))
    ok("  and the notebooks named in ship.json's vaults, with the vault list", "notes/vaults/v4/Battle Re-work/00 - Start here.md" in files and "notes/vaults.json" in files)
    ok("  (a vault name that isn't plain is ignored)", not any("x" == k.split("/")[2] for k in files if k.startswith("notes/vaults/") and k.count("/") > 2))
    # a laptop with a vault of its own
    lap, tree = os.path.join(d, "laptop"), os.path.join(d, "tree")
    for rel, p in files.items():
        os.makedirs(os.path.dirname(os.path.join(tree, rel)), exist_ok=True)
        open(os.path.join(tree, rel), "wb").write(open(p, "rb").read())
    w(os.path.join(lap, "notes", "vaults.json"), {"active": "", "vaults": [{"id": "v1", "name": "Laptop things"}]})
    w(os.path.join(lap, "collab", "PT1.json"), {"ref": "PT1", "answered": "on the laptop"})
    shas = {rel: starter_data.file_sha1(os.path.join(tree, rel)) for rel in files}
    st = {"files": {"tag": "t", "sha1": shas}, "collections": [], "names": [], "namesByGroup": []}
    open(os.path.join(tree, "TAG"), "w").write("t\n")
    sp = os.path.join(d, "starter.json"); w(sp, st)
    docs = {k: os.path.join(lap, k + ".json") for k in ("kitchen", "photos", "training", "cards")}
    starter_data.apply(sp, tree, lap, docs, ledger_path=os.path.join(d, "ledger.json"))
    vj = json.load(open(os.path.join(lap, "notes", "vaults.json")))
    ok("the laptop's vault list gains the notebook, and keeps its own", [v["id"] for v in vj["vaults"]] == ["v1", "v4"], vj)
    ok("  the notebook's notes arrive", os.path.isfile(os.path.join(lap, "notes", "vaults", "v4", "Battle Re-work", "00 - Start here.md")))
    ok("Collaboration arrives; a document already edited on the laptop is kept", json.load(open(os.path.join(lap, "collab", "V3.json")))["ref"] == "V3"
       and json.load(open(os.path.join(lap, "collab", "PT1.json"))).get("answered") == "on the laptop")
    # Notes rewriting ship.json keeps "vaults"
    nb.DATA_DIR_PROVIDER = None
    nd = os.path.join(d, "notesdata"); w(os.path.join(nd, "ship.json"), {"paths": ["a.md"], "vaults": ["v4"]})
    orig = nb.ship_file; nb.ship_file = lambda: os.path.join(nd, "ship.json")
    try:
        nb.write_ship(["a.md", "b.md"])
    finally:
        nb.ship_file = orig
    sj = json.load(open(os.path.join(nd, "ship.json")))
    ok("Notes ticking 'Ship with releases' keeps the shipped notebooks", sj == {"paths": ["a.md", "b.md"], "vaults": ["v4"]}, sj)
print("\n  %d passed, %d failed" % (ok_n, bad)); sys.exit(1 if bad else 0)
