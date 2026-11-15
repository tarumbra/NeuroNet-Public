"""Notes that ship with releases (2026-10-11, Cam: "Project notes and the training session you done for me. Plus add a
check box where i can select notes to ship along in the future"). Throwaway folders only -- never Cam's notes."""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import shutil
import subprocess
import sys
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)
import notes_backend  # noqa: E402
import starter_data  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


tmp = tempfile.mkdtemp(prefix="nn-ship-")
try:
    data = os.path.join(tmp, "data"); notes = os.path.join(data, "notes")
    notes_backend.DATA_DIR_PROVIDER = lambda: notes
    vault = notes_backend.vault_dir()
    os.makedirs(os.path.join(vault, "Game", "Sub"))
    os.makedirs(os.path.join(vault, "attachments"))
    for rel, text in {"Game/Plan.md": "plan ![[pic.png]]", "Game/Sub/Deep.md": "deep", "Private.md": "secret", "Session.md": "sets"}.items():
        with open(os.path.join(vault, rel), "w") as f: f.write(text)
    with open(os.path.join(vault, "attachments", "pic.png"), "wb") as f: f.write(b"png")
    api = notes_backend.NotesApi()

    ok("nothing ships until ticked", api.ship_list() == [])
    r = api.set_ship("Game", True); api.set_ship("Session.md", True)
    ok("tick a folder and a note", api.ship_list() == ["Game", "Session.md"], api.ship_list())
    ok("a path outside the vault is refused", "error" in api.set_ship("../x", True))
    api.rename_item("Session.md", "Monday.md")
    ok("renaming a shipped note keeps it shipped", api.ship_list() == ["Game", "Monday.md"], api.ship_list())
    api.create_folder("", "Work"); api.move_item("Monday.md", "Work")
    ok("moving it keeps it shipped", api.ship_list() == ["Game", "Work/Monday.md"], api.ship_list())

    # packed at release time
    out = os.path.join(tmp, "starter.json"); tree = os.path.join(tmp, "tree")
    sys.path.insert(0, os.path.join(APP, "tools"))
    import make_starter  # noqa: E402
    real_build = make_starter.build
    def build_notes_only(d):                         # the rest of the starter needs Cam's kitchen etc.: notes alone here
        files = {}
        orig_read = make_starter.read
        make_starter.read = lambda p: (orig_read(p) if p.endswith("ship.json") else {"recipes": [], "photos": [], "tarotDecks": [{"name": "Murder Of Crows", "id": "t"}],
                                       "oracleDecks": [{"name": "Carnival Of Souls", "id": "o"}], "lenormandDecks": [{"name": "Lenormand Of Enchantment", "id": "l"}]})
        try:
            return real_build(d)
        finally:
            make_starter.read = orig_read
    make_starter.build = build_notes_only
    make_starter.main(["--data", data, "--out", out, "--files-tree", tree, "--no-commit"])
    st = json.load(open(out)); shipped = sorted(k for k in st["files"]["sha1"] if k.startswith("notes/"))
    ok("the release packs the ticked notes (a folder with everything in it) and the pictures they link",
       shipped == ["notes/ship.json", "notes/vault/Game/Plan.md", "notes/vault/Game/Sub/Deep.md", "notes/vault/Work/Monday.md", "notes/vault/attachments/pic.png"], shipped)  # ship.json too, since 1.0.139 (the ticks in step on both computers)
    ok("an unticked note stays on this computer", not any("Private" in k for k in st["files"]["sha1"]))

    # merged on another computer
    other = os.path.join(tmp, "other"); os.makedirs(other)
    with open(os.path.join(tree, "TAG"), "w") as f: f.write(st["files"]["tag"] + "\n")
    st2 = {"files": st["files"], "collections": [], "stamp": "x1"}; p2 = os.path.join(tmp, "s2.json"); json.dump(st2, open(p2, "w"))
    r = starter_data.apply(p2, tree, other, {})
    ok("another computer gets them on its next update", r["files"]["added"] == 5 and open(os.path.join(other, "notes/vault/Work/Monday.md")).read() == "sets", r)
    with open(os.path.join(other, "notes/vault/Game/Plan.md"), "w") as f: f.write("edited there")
    with open(os.path.join(vault, "Game/Plan.md"), "w") as f: f.write("plan v2")
    with open(os.path.join(vault, "Game/Sub/Deep.md"), "w") as f: f.write("deep v2")
    make_starter.main(["--data", data, "--out", out, "--files-tree", tree, "--no-commit"])
    st = json.load(open(out)); st3 = {"files": st["files"], "collections": [], "stamp": "x2"}; json.dump(st3, open(p2, "w"))
    with open(os.path.join(tree, "TAG"), "w") as f: f.write(st["files"]["tag"] + "\n")
    r = starter_data.apply(p2, tree, other, {})
    ok("a note edited there is kept; an untouched one is updated",
       open(os.path.join(other, "notes/vault/Game/Plan.md")).read() == "edited there" and open(os.path.join(other, "notes/vault/Game/Sub/Deep.md")).read() == "deep v2", r)

    js = open(os.path.join(APP, "ui", "notes", "app.js")).read()
    ok("Notes has the tick in its right-click menu and a mark in the sidebar", "Ship with releases" in js and "cx-ship-mark" in js and "CC.Store.setShip(path" in js)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
