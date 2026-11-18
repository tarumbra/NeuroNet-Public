"""Scribe > Collaboration (2026-10-15): Cam and Claude's shared desk -- collab.py, on a scratch data folder (never the real one).

Cam: "lets use neuronet to discuss play tests, questions and more ... I can just say refer to "X", "Y" or "Z" in the app.
Create a template that works best for you that i can fill out like a form."
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
import collab  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


def bad(f, *a):
    try:
        f(*a)
        return False
    except ValueError:
        return True


print("\nCollaboration (collab.py)\n")
tmp = tempfile.mkdtemp(prefix="nn-collab-")
collab.DATA_DIR_PROVIDER = lambda: tmp
try:
    b = collab.new("bug")
    ok("+ Bug: a form from its template, coded B1, open, yours", b["ref"] == "B1" and b["status"] == "open" and b["from"] == "cam"
       and len(b["sections"][0]["items"]) == 5 and os.path.exists(os.path.join(tmp, "collab", "B1.json")))
    ok("  the next is B2; each kind counts on its own (I1, N1, PT1, Q1)", collab.new("bug")["ref"] == "B2" and collab.new("idea")["ref"] == "I1"
       and collab.new("note")["ref"] == "N1" and collab.new("playtest")["ref"] == "PT1" and collab.new("questions")["ref"] == "Q1")
    body = {"intro": "Try these.", "sections": [{"title": "Fights", "items": [
        {"id": "a1", "kind": "check", "text": "Swap in a fight", "expect": "It costs your next attack"},
        {"id": "q1", "kind": "choice", "text": "Keep it?", "options": [{"id": "a", "label": "Yes", "rec": True}, {"id": "b", "label": "No"}]},
        {"id": "t1", "kind": "text", "text": "Anything else?"}]}]}
    pt = collab.new("playtest", "Part 1 and 2", "NeuroPets", "claude", body)
    ok("Claude's play test: its own checks, choices and prompts, from Claude", pt["ref"] == "PT2" and pt["from"] == "claude"
       and [it["kind"] for it in pt["sections"][0]["items"]] == ["check", "choice", "text"] and pt["sections"][0]["items"][0]["result"] is None)
    d = collab.get("PT2")
    d["sections"][0]["items"][0].update(result="fail", note="It didn't cost a turn")
    d["sections"][0]["items"][1]["answer"] = "a"
    d["sections"][0]["items"][2]["answer"] = "Loved the wear bars."
    d["status"] = "answered"; d["from"] = "cam"; d["created"] = "1999-01-01T00:00:00"
    s = collab.save(d)
    ok("Cam's answers save: a ✗ with its note, a choice, words -- and Done hands it over", s["status"] == "answered"
       and s["sections"][0]["items"][0]["result"] == "fail" and s["sections"][0]["items"][1]["answer"] == "a")
    ok("  who wrote it and when it started can't be changed by saving", s["from"] == "claude" and s["created"] != "1999-01-01T00:00:00")
    lst = collab.listing()
    ok("the list: every document, newest change first, with how much is done and how many ✗", lst[0]["ref"] == "PT2" and lst[0]["done"] == 3
       and lst[0]["fails"] == 1 and len(lst) == 7, lst[0])
    ok("refused: a wrong code, a kind that doesn't match it, a bad answer, a stray status",
       bad(collab.clean, dict(s, ref="X1")) and bad(collab.clean, dict(s, type="bug"))
       and bad(collab.clean, json.loads(json.dumps(s).replace('"answer": "a"', '"answer": "z"')))
       and bad(collab.clean, dict(s, status="maybe")) and bad(collab.new, "letter"))
    ok("  and a path in the code can't reach outside the folder", "error" in collab.get("../x") and bad(collab._path, "../../etc/passwd"))
    ok("text is kept to a sane size", len(collab.clean(dict(s, title="x" * 900))["title"]) == 200)
    r = collab.remove("B2")
    ok("delete: into collab/deleted, not gone", r == {"ok": True} and not os.path.exists(os.path.join(tmp, "collab", "B2.json"))
       and len(os.listdir(os.path.join(tmp, "collab", "deleted"))) == 1 and "error" in collab.get("B2"))
    ok("  and a bad file in the folder is skipped, not a crash", (open(os.path.join(tmp, "collab", "B9.json"), "w").write("{oops") and True)
       and all(x["ref"] != "B9" for x in collab.listing()))
    # votes (2026-10-16): ballots for the team, Cam's vote and override; the count; ballots can't be changed from the page
    ballot = lambda i, v: {"id": i, "kind": "ballot", "voter": i.upper(), "vote": v, "text": "because"}
    camv = {"id": "cam", "kind": "choice", "text": "Your vote", "options": [{"id": "yes"}, {"id": "no"}, {"id": "abstain"}], "answer": None, "note": ""}
    over = {"id": "override", "kind": "choice", "text": "Override", "options": [{"id": "accept"}, {"id": "yes"}, {"id": "no"}], "answer": None, "note": ""}
    v = collab.new("vote", "Class books", "NeuroPets", "claude", {"intro": "x", "sections": [{"title": "", "items": [ballot("a", "yes"), ballot("b", "no"), ballot("c", "yes"), camv, over]}]})
    ok("a vote: V1, counting -- waiting for Cam", v["ref"] == "V1" and collab.tally(v)["result"] == "" and collab.tally(v)["waiting"] == 1)
    v["sections"][0]["items"][3]["answer"] = "no"; v["sections"][0]["items"][0]["vote"] = "no"; v = collab.save(v)
    ok("  Cam votes no: 2-2 is a tie -- not carried; and the page can't change a ballot", collab.tally(v)["result"] == "no" and v["sections"][0]["items"][0]["vote"] == "yes")
    v["sections"][0]["items"][4]["answer"] = "yes"; v = collab.save(v)
    ok("  Cam's override decides over the count", collab.tally(v)["result"] == "yes" and collab.tally(v)["overridden"])
    c = collab.new("concern", "Save size", "NeuroPets", "claude", None, author="Software Engineer")
    ok("a concern a section head raised: C1, by them", c["ref"] == "C1" and c["by"] == "Software Engineer" and [x for x in collab.listing() if x["ref"] == "C1"][0]["by"] == "Software Engineer")
    ok("  a ballot must be yes, no or abstain", bad(collab.clean, dict(v, sections=[{"title": "", "items": [ballot("z", "maybe")]}])))
    # projects (2026-10-17, Cam: "the ability in collaboration to be broken into projects (think vaults in the notes app)")
    pj = collab.projects()
    ok("projects: General holds documents with no project; the project names documents carry are projects too",
       pj["projects"][0]["name"] == "General" and any(x["name"] == "NeuroPets" for x in pj["projects"]) and pj["active"] == "")
    pj = collab.new_project("Market/Thief")
    ok("  a new project (a slash is fine -- it's a name, not a folder), and it's the one being looked at",
       any(x["name"] == "Market/Thief" and x["docs"] == 0 for x in pj["projects"]) and pj["active"] == "Market/Thief")
    ok("  two with one name: refused", bad(collab.new_project, "market/thief") and bad(collab.new_project, "  ") and bad(collab.new_project, "General"))
    q = collab.new("questions", "The stalls", "Market/Thief", "claude", None)
    mv = collab.get("C1"); mv["project"] = "Market/Thief"; collab.save(mv)
    pj = collab.projects(); mt = [x for x in pj["projects"] if x["name"] == "Market/Thief"][0]
    ok("  documents in it (a new one, and one moved in by saving it with the project)", mt["docs"] == 2 and mt["waiting"] == 2)
    pj = collab.rename_project("Market/Thief", "Market and Thief")
    ok("  renamed: its documents go with it", collab.get(q["ref"])["project"] == "Market and Thief" and collab.get("C1")["project"] == "Market and Thief"
       and pj["active"] == "Market and Thief" and not any(x["name"] == "Market/Thief" for x in pj["projects"]))
    ok("  General keeps its name", bad(collab.rename_project, "General", "Other"))
    ok("  looking at every project again", collab.set_active_project("")["active"] == "")
    ok("  projects.json is the desk's own file, never a document", all(x["ref"] != "projects" for x in collab.listing()))
    # (2026-11-18, Cam: "a way to delete projects"): its documents to General, or deleted with it
    collab.new_project("Gone soon"); g1 = collab.new("note", "One", "Gone soon", "claude", None)
    g2 = collab.new("note", "Two (archived)", "Gone soon", "claude", None); g2d = collab.get(g2["ref"]); g2d["archived"] = True; collab.save(g2d)
    ok("  deleting one: refused for General, a project that isn't there, or a bad choice",
       bad(collab.delete_project, "General") and bad(collab.delete_project, "Nowhere") and bad(collab.delete_project, "Gone soon", "shred"))
    pj = collab.delete_project("Gone soon", "move")
    ok("  deleted, documents moved: they're in General (archived ones too), the project's gone and not looked at",
       collab.get(g1["ref"])["project"] == "" and collab.get(g2["ref"])["project"] == ""
       and not any(x["name"] == "Gone soon" for x in pj["projects"]) and pj["active"] == "")
    collab.new_project("Gone too"); g3 = collab.new("note", "Three", "Gone too", "claude", None)
    pj = collab.delete_project("Gone too", "delete")
    ok("  deleted with its documents: they're in collab/deleted, not gone for good",
       not any(x["name"] == "Gone too" for x in pj["projects"]) and collab.get(g3["ref"]).get("error")
       and any(n.startswith(g3["ref"] + "-") for n in os.listdir(os.path.join(collab.root(), "deleted"))))
    collab.new_project("Empty one")
    ok("  an empty project deletes too", not any(x["name"] == "Empty one" for x in collab.delete_project("Empty one")["projects"]))
    import neuronet  # noqa: E402  -- the Api part, on the same scratch folder
    neuronet.collab.DATA_DIR_PROVIDER = lambda: tmp
    api = neuronet.Api()
    ok("the app's Api: projects -- list, new (with a document started in it), rename, use",
       "projects" in api.collab_projects() and "error" in api.collab_project_new("") and api.collab_project_new("Story")["active"] == "Story"
       and api.collab_new("note", "", "Story")["project"] == "Story" and api.collab_project_rename("Story", "Story re-work")["active"] == "Story re-work"
       and api.collab_project_use("")["active"] == ""
       and "error" in api.collab_project_delete("General") and not any(x["name"] == "Story re-work" for x in api.collab_project_delete("Story re-work", "move")["projects"]))
    ok("the app's Api: collab_list, _get, _new, _save, _delete", api.collab_new("idea")["ref"] == "I2" and api.collab_get("I2")["type"] == "idea"
       and "error" in api.collab_save({"ref": "nope"}) and api.collab_delete("I2") == {"ok": True} and isinstance(api.collab_list(), list))
    # pictures (2026-10-21, PT49): pasted or picked, checked, kept in collab/pictures, listed on the item
    import base64
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 40
    url = "data:image/png;base64," + base64.b64encode(png).decode()
    pd = api.collab_new("note")
    r = api.collab_picture_add(pd["ref"], "body", url)
    ok("a picture is kept under a name made here, in collab/pictures", r.get("name") == pd["ref"] + "-body-1.png"
       and os.path.isfile(os.path.join(tmp, "collab", "pictures", r["name"])))
    ok("  a second for the same item gets the next number", api.collab_picture_add(pd["ref"], "body", url).get("name", "").endswith("-2.png"))
    ok("  read back as a picture the page can show", api.collab_picture(r["name"]).get("url", "").startswith("data:image/png;base64,"))
    ok("  not a picture, or not PNG/JPEG/WebP, or too big: refused",
       "error" in api.collab_picture_add(pd["ref"], "body", "data:image/png;base64," + base64.b64encode(b"<svg/>").decode())
       and "error" in api.collab_picture_add(pd["ref"], "body", "file:///etc/passwd")
       and "error" in api.collab_picture_add(pd["ref"], "body", "data:image/png;base64," + base64.b64encode(png + b"\x00" * (10 * 1024 * 1024)).decode()))
    ok("  no names from outside: only its own kind of name is read or removed",
       "error" in api.collab_picture("../../paths.json") and "error" in api.collab_picture_remove("../x.png") and "error" in api.collab_picture_add("../N1", "body", url))
    doc = api.collab_get(pd["ref"])
    for sec in doc["sections"]:
        for it in sec["items"]:
            it["pics"] = [r["name"], "../evil.png"]
    api.collab_save(doc)
    back = api.collab_get(pd["ref"])
    ok("  an item keeps its pictures' names (and nothing that isn't one)", all(it.get("pics") == [r["name"]] for sec in back["sections"] for it in sec["items"] if it["kind"] != "ballot"))
    ok("  taken off: moved to the deleted folder", api.collab_picture_remove(r["name"]) == {"ok": True}
       and os.path.isfile(os.path.join(tmp, "collab", "deleted", r["name"])))
    # I20 (8 Nov 2026): what's new to Cam -- dots on the desk, a count in the sidebar
    import time  # noqa: E402
    sp = os.path.join(tmp, "collab", "seen.json")
    ok("what's new: the first time, nothing already on the desk is new (an old desk isn't all dots at once)",
       os.path.isfile(sp) and collab.fresh()["total"] == 0 and not any(x["new"] for x in collab.listing()))
    time.sleep(1.1)
    nn = collab.new("note", "From the team", "Ideas", "claude", body={"intro": "x", "sections": []})
    f = collab.fresh()
    ok("  one the team adds afterwards is new: counted, by project, and on its row and its project",
       f["total"] == 1 and f["projects"] == {"Ideas": 1} and f["refs"] == [nn["ref"]]
       and next(x for x in collab.listing() if x["ref"] == nn["ref"])["new"] and next(p for p in collab.projects()["projects"] if p["name"] == "Ideas")["fresh"] == 1, f)
    ok("  opened (seen): not new any more", api.collab_seen([nn["ref"]])["total"] == 0 and api.collab_fresh()["total"] == 0)
    time.sleep(1.1)
    d2 = collab.get(nn["ref"]); d2["intro"] = "Claude added more"; d2["updated"] = collab.now(); collab._write(d2)
    ok("  changed again by the team after that: new again", collab.fresh()["refs"] == [nn["ref"]])
    api.collab_seen(nn["ref"])
    time.sleep(1.1)
    mine = api.collab_new("idea", "Cam's own", "Ideas")
    ok("  Cam's own, and his own saves, are never new to him", collab.fresh()["total"] == 0
       and (api.collab_save(dict(collab.get(mine["ref"]), title="Cam's own, edited")) or True) and collab.fresh()["total"] == 0)
    time.sleep(1.1)
    old = collab.new("note", "Archived one", "", "claude", body={"intro": "", "sections": []})
    collab._write(dict(collab.get(old["ref"]), archived=True))
    ok("  archived ones are never new", old["ref"] not in collab.fresh()["refs"])
    ok("  a broken seen.json starts again rather than failing", (open(sp, "w").write("{oops") and collab.fresh()["total"] == 0))
    page, app, css = (open(os.path.join(APP, "ui", *p), encoding="utf-8").read() for p in (("collab", "collab.js"), ("app.js",), ("shared.css",)))
    ok("the page: a dot on new rows, '· n new' on projects, Mark all seen; opening one tells the app",
       'class="cb-newdot"' in page and "${p.fresh ? ` · ${p.fresh} new` : \"\"}" in page and 'id="cb-allseen"' in page
       and "seeIt(host, [ref])" in page and "SS.collabFresh(f)" in page)
    ok("the sidebar: a count on Scribe and on Collaboration (and its tab), asked again when NeuroNet comes into view, never while hidden",
       'key === "notes" ? collabBadge() : ""' in app and '(c.key === "collab:board" ? collabBadge() : "")' in app
       and 'c.key === "collab:board" ? collabBadge() : ""}${favStar' in app and "if (document.hidden) return;" in app
       and 'addEventListener("visibilitychange"' in app and ".ss-nav-new" in css)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
