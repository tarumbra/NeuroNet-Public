"""Ticks and flags on notes, and the Archive (2026-11-02, Cam: "right click a note ... and put a tick or flag next to it"
and "implement an archive in the scribe app, which contains all archived notes, collabs etc"). Throwaway folders only --
never Cam's notes or collaboration desk."""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import shutil
import sys
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)
import notes_backend  # noqa: E402
import collab  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def paths(tree):
    out = []
    for n in tree:
        out.append(n["path"])
        out += paths(n.get("children") or [])
    return out


tmp = tempfile.mkdtemp(prefix="nn-archive-")
try:
    notes = os.path.join(tmp, "data", "notes")
    notes_backend.DATA_DIR_PROVIDER = lambda: notes
    main = notes_backend.vault_dir()
    os.makedirs(os.path.join(main, "Art", "Old"))
    for rel, text in [("Art/Start here.md", "# Start"), ("Art/14 Sigils.md", "sigils"), ("Art/Old/Done.md", "done"), ("Top.md", "top")]:
        with open(os.path.join(main, rel), "w") as f:
            f.write(text)
    api = notes_backend.NotesApi()

    # ---- ticks and flags
    r = api.set_mark("Art/Start here.md", "flag")
    api.set_mark("Art/14 Sigils.md", "tick")
    ok("a note can be flagged and another ticked", api.marks_list() == {"Art/Start here.md": "flag", "Art/14 Sigils.md": "tick"}, api.marks_list())
    ok("  a mark that isn't tick or flag clears it", api.set_mark("Art/Start here.md", "")["marks"] == {"Art/14 Sigils.md": "tick"})
    ok("  marking something that isn't there is refused", "error" in api.set_mark("Art/Nope.md", "tick"))
    api.set_mark("Art/Start here.md", "flag")
    api.rename_item("Art/Start here.md", "00 Start here")
    ok("a mark follows its note when it's renamed", api.marks_list().get("Art/00 Start here.md") == "flag", api.marks_list())
    api.move_item("Art/00 Start here.md", "")
    ok("  ... and when it's moved", api.marks_list().get("00 Start here.md") == "flag", api.marks_list())
    api.set_mark("Art/Old", "tick")
    api.rename_item("Art", "Artwork")
    ok("  marks inside a renamed folder follow it", api.marks_list() == {"00 Start here.md": "flag", "Artwork/14 Sigils.md": "tick", "Artwork/Old": "tick"}, api.marks_list())
    api.delete_item("00 Start here.md")
    ok("  a deleted note's mark goes with it", "00 Start here.md" not in api.marks_list())
    v = api.new_vault("Other")
    ok("each vault keeps its own marks", api.marks_list() == {})
    api.switch_vault("main")
    ok("  the main vault's are still there", api.marks_list().get("Artwork/14 Sigils.md") == "tick")

    # ---- archiving a note
    r = api.archive_item("Artwork/14 Sigils.md")
    ok("a note archives into the vault's hidden archive, at the same path", r.get("archived") == "Artwork/14 Sigils.md"
       and os.path.isfile(os.path.join(main, ".archive", "Artwork", "14 Sigils.md")), r)
    ok("  it's gone from the tree", "Artwork/14 Sigils.md" not in paths(api.list_tree()), paths(api.list_tree()))
    ok("  ... and its mark with it", "Artwork/14 Sigils.md" not in api.marks_list())
    ok("  the hidden archive never shows in the tree", not any(p.startswith(".archive") for p in paths(api.list_tree())))
    lst = api.archive_list()
    ok("the archive lists it, with its vault", [(x["vault"], x["path"], x["type"], x["name"]) for x in lst] == [("main", "Artwork/14 Sigils.md", "note", "14 Sigils")], lst)
    ok("  and shows what it says", api.archive_read("main", "Artwork/14 Sigils.md") == {"type": "note", "text": "sigils"})
    ok("  nothing outside the archive can be read through it", "error" in api.archive_read("main", "../Top.md") and "error" in api.archive_read("main", "/etc/passwd"))

    # ---- a whole folder
    r = api.archive_item("Artwork/Old")
    lst = api.archive_list()
    ok("a folder archives as one thing, counting what's inside", sorted((x["path"], x["type"], x.get("count")) for x in lst)
       == [("Artwork/14 Sigils.md", "note", None), ("Artwork/Old", "folder", 1)], lst)
    ok("  reading it lists its files", api.archive_read("main", "Artwork/Old") == {"type": "folder", "files": ["Done.md"]})

    # ---- putting back
    r = api.archive_restore("main", "Artwork/14 Sigils.md")
    ok("a note goes back where it was", r == {"vault": "main", "path": "Artwork/14 Sigils.md"} and "Artwork/14 Sigils.md" in paths(api.list_tree()), r)
    shutil.rmtree(os.path.join(main, "Artwork"))
    r = api.archive_restore("main", "Artwork/Old")
    ok("  a folder goes back even if the folder it sat in has gone (made again)", r["path"] == "Artwork/Old"
       and os.path.isfile(os.path.join(main, "Artwork", "Old", "Done.md")) and not os.path.exists(os.path.join(main, "Artwork", "Old", ".archived-folder")), r)
    ok("  the empty place-holding folders in the archive are tidied away", not os.listdir(os.path.join(main, ".archive")), os.listdir(os.path.join(main, ".archive")))
    with open(os.path.join(main, "Top.md"), "w") as f:
        f.write("top")
    api.archive_item("Top.md")
    with open(os.path.join(main, "Top.md"), "w") as f:
        f.write("a new top")
    r = api.archive_restore("main", "Top.md")
    ok("  a name clash on the way back gets a new name, nothing overwritten", r["path"] != "Top.md" and open(os.path.join(main, "Top.md")).read() == "a new top", r)

    # ---- deleting for good, another vault
    api.archive_item("Artwork/Old/Done.md")
    api.archive_delete("main", "Artwork/Old/Done.md")
    ok("deleting from the archive deletes it", api.archive_list() == [], api.archive_list())
    api.switch_vault("v1")
    with open(os.path.join(notes_backend.active_vault_dir(), "Elsewhere.md"), "w") as f:
        f.write("x")
    api.archive_item("Elsewhere.md")
    api.switch_vault("main")
    ok("the archive lists every vault's, whichever is open", [(x["vault"], x["vaultName"]) for x in api.archive_list()] == [("v1", "Other")], api.archive_list())

    # ---- collaboration documents
    collab.DATA_DIR_PROVIDER = lambda: os.path.join(tmp, "data")
    d = collab.new("note", "Old note", "NeuroArcana")
    d["archived"] = True
    collab.save(d)
    s = [x for x in collab.listing() if x["ref"] == d["ref"]][0]
    ok("a collaboration document can be archived (the list says so)", s["archived"] is True and collab.get(d["ref"])["archived"] is True, s)
    ok("  an archived document isn't counted as waiting in its project", [p for p in collab.projects()["projects"] if p["name"] == "NeuroArcana"][0]["waiting"] == 0)
    d = collab.get(d["ref"]); d["archived"] = False; collab.save(d)
    ok("  and comes back", collab.get(d["ref"])["archived"] is False)
    ok("  a document saved without the field isn't archived", collab.clean({"ref": "N9", "type": "note", "sections": []})["archived"] is False)

    # ---- the page side is wired
    src = open(os.path.join(APP, "ui", "notes", "app.js")).read()
    ok("Notes' right-click menu has Tick, Flag and Archive", "Tick (done)" in src and "Flag for review" in src and "archiveItemFlow(path, type)" in src)
    app = open(os.path.join(APP, "ui", "app.js")).read()
    idx = open(os.path.join(APP, "ui", "index.html")).read()
    ok("Scribe has an Archive page", '{key: "archive:list", name: "Archive"}' in app and "SS.Archive" in app and "archive/archive.js" in idx and 'id="i-archive"' in idx)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
