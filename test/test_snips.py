"""NeuroNet Snips (15 Nov 2026): snips.py's names and folders, and neuronet-snip
driving a stand-in omasnap. Never Cam's Documents, clipboard or NeuroNet: a
scratch NEURONET_SNIPS_DIR, stub commands first on PATH, a fake neuronet-call.

Run: python3 test/test_snips.py
"""
import os
# Never Cam's real data (test_test_isolation.py): a paths file that can't exist, before anything else.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import datetime  # noqa: E402
import json  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
tmp = tempfile.mkdtemp(prefix="nn-snips-")
os.environ["NEURONET_SNIPS_DIR"] = os.path.join(tmp, "NeuroNet Snips")
import snips  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000"
                    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082")
src = os.path.join(tmp, "shot.png")
with open(src, "wb") as f:
    f.write(PNG)

try:
    print("\nThe names\n")
    D = snips.snips_dir()
    ok("the folder is NeuroNet Snips, with Archive inside", os.path.isdir(os.path.join(D, "Archive")))
    day = datetime.datetime(2026, 11, 15, 9, 30)
    a = snips.add(src, when=day)
    ok("the first snip is '261115 - Snip 1.png'", a["name"] == "261115 - Snip 1.png" and os.path.isfile(a["path"]), a)
    b = snips.add(src, when=day, definition="For Q22")
    ok("Save as puts the definition in brackets: '261115 - Snip 2 - (For Q22).png'",
       b["name"] == "261115 - Snip 2 - (For Q22).png", b["name"])
    ok("the number counts on across days", snips.add(src, when=datetime.datetime(2026, 11, 16))["name"] == "261116 - Snip 3.png")
    ok("a definition can't break the name (slashes, brackets, new lines)",
       snips.clean_definition(" New (numbers)/feature\n ") == "New numbers feature")
    ok("  and is at most 80 characters", len(snips.clean_definition("x" * 200)) == 80)
    r = snips.rename(1, "New Numbers Feature")
    ok("renaming keeps the day and the number", r["name"] == "261115 - Snip 1 - (New Numbers Feature).png"
       and os.path.isfile(r["path"]) and not os.path.exists(a["path"]))
    ok("  and an empty definition takes the brackets off", snips.rename(1, "")["name"] == "261115 - Snip 1.png")
    ok("parse reads a name back", snips.parse("261115 - Snip 22 - (For Q22).png") == {"day": "261115", "n": 22, "definition": "For Q22"})
    ok("  and ignores anything else in the folder", snips.parse("holiday.png") is None and snips.parse("261115 - Snip x.png") is None)

    print("\nThe Archive\n")
    e = snips.archive(2)
    ok("archive moves it into NeuroNet Snips/Archive", e["archived"] and os.path.dirname(e["path"]).endswith("Archive")
       and os.path.isfile(e["path"]))
    ok("  list shows only what's waiting", [x["n"] for x in snips.list_snips()] == [3, 1])
    ok("  and --all shows the Archive too, newest first", [x["n"] for x in snips.list_snips(include_archive=True)] == [3, 2, 1])
    os.remove(snips.find(3)["path"])
    ok("a deleted snip's number is never given out again", snips.next_number() == 4)
    ok("unarchive brings one back", not snips.unarchive(2)["archived"] and os.path.isfile(os.path.join(D, "261115 - Snip 2 - (For Q22).png")))
    ok("an unknown number is None, not a crash", snips.find(99) is None and snips.archive(99) is None and snips.rename(99, "x") is None)

    print("\nneuronet-snip, with a stand-in omasnap\n")
    stubs = os.path.join(tmp, "bin")
    os.makedirs(stubs)
    log = os.path.join(tmp, "calls.log")

    def stub(name, body):
        p = os.path.join(stubs, name)
        with open(p, "w") as f:
            f.write("#!/bin/bash\n" + body + "\n")
        os.chmod(p, 0o755)
    # omasnap: saves a capture, then (as an edit saved from its editor) a second, then closes
    stub("omasnap", 'echo "omasnap $*" >> "%s"\n'
                    'cp "%s" "$OMASNAP_SCREENSHOT_DIR/screenshot-1.png"; sleep 1.2\n'
                    'cp "%s" "$OMASNAP_SCREENSHOT_DIR/screenshot-1-edited.png"; sleep 1.2' % (log, src, src))
    stub("fake-call", 'echo "call $1 $2" >> "%s"; echo \'{"ok": true}\'' % log)
    for quiet in ("omarchy-notification-send", "notify-send", "wl-paste", "neuronet-path", "busctl"):
        stub(quiet, 'echo "%s $*" >> "%s"; exit 1' % (quiet, log) if quiet in ("wl-paste", "neuronet-path", "busctl")
             else 'echo "%s $*" >> "%s"' % (quiet, log))
    env = dict(os.environ, PATH=stubs + ":/usr/bin:/bin", NEURONET_SNIP_CALL=os.path.join(stubs, "fake-call"),
               XDG_RUNTIME_DIR=tmp, HOME=tmp)
    before = snips.next_number()
    r = subprocess.run([sys.executable, os.path.join(APP, "neuronet-snip"), "region"], env=env,
                       capture_output=True, text=True, timeout=60)
    calls = open(log).read()
    new = snips.find(before)
    ok("it runs Omarchy's own tool, in the mode asked", "omasnap --capture-region" in calls, calls)
    ok("  what omasnap saved becomes the next snip, in Documents/NeuroNet Snips", r.returncode == 0 and new
       and new["name"] == "%s - Snip %d.png" % (datetime.datetime.now().strftime("%y%m%d"), before), r.stderr)
    ok("  and is handed to NeuroNet for Photos (snip.add)", "call snip.add" in calls and '"n": %d' % before in calls)
    ok("  the edit saved after it replaces that snip's picture, same number",
       "call snip.replace" in calls and snips.next_number() == before + 1)
    ok("  a notification says so, and clicking it opens the Save as", "omarchy-notification-send" in calls
       and "neuronet-open snip %d" % before in calls)
    ok("  omasnap's private folder is cleared away", not os.listdir(os.path.join(tmp, "neuronet-snip")))
    open(log, "w").close()
    subprocess.run([sys.executable, os.path.join(APP, "neuronet-snip"), "smart", "--from-app"], env=env,
                   capture_output=True, text=True, timeout=60)
    calls = open(log).read()
    ok("from the Snip button NeuroNet asks for the name itself (no notification)",
       '"ask": true' in calls and "omarchy-notification-send" not in calls and "\nomasnap" in "\n" + calls, calls)
    open(log, "w").close()
    n = snips.next_number() - 1
    r = subprocess.run([sys.executable, os.path.join(APP, "neuronet-snip"), "archive", str(n)], env=env,
                       capture_output=True, text=True, timeout=30)
    ok("neuronet-snip archive N files it in Archive, and Photos follows", snips.find(n)["archived"]
       and "call snip.archive" in open(log).read())
    r = subprocess.run([sys.executable, os.path.join(APP, "neuronet-snip"), "name", str(n), "For", "Q22"], env=env,
                       capture_output=True, text=True, timeout=30)
    ok("neuronet-snip name N text: the Save as from a terminal", snips.find(n)["definition"] == "For Q22")
    env_off = dict(env, NEURONET_SNIP_NO_APP="1")
    open(log, "w").close()
    subprocess.run([sys.executable, os.path.join(APP, "neuronet-snip"), "unarchive", str(n)], env=env_off,
                   capture_output=True, text=True, timeout=30)
    ok("  with NeuroNet off it never starts it", "call " not in open(log).read() and not snips.find(n)["archived"])

    print("\nNeuroNet Picture References (15 Nov 2026)\n")
    docs = os.path.join(tmp, "Documents")
    old = os.path.join(docs, "NeuroNet Snips")
    os.makedirs(os.path.join(old, "Archive"))
    for name in ("261115 - Snip 1 - (Tabs).png", "Archive/261114 - Snip 0.png"):
        with open(os.path.join(old, name), "wb") as f:
            f.write(PNG)
    with open(os.path.join(old, ".last-snip"), "w") as f:
        f.write("1")
    real_docs, saved_env = snips.documents_dir, os.environ.pop("NEURONET_SNIPS_DIR")
    snips.documents_dir = lambda: docs
    try:
        refs = snips.references_dir()
        ok("Documents/NeuroNet Picture References holds NeuroNet Snips and Art to Action/Media Art (each with an Archive)",
           refs == os.path.join(docs, "NeuroNet Picture References")
           and all(os.path.isdir(os.path.join(refs, *p)) for p in (("NeuroNet Snips", "Archive"),
                                                                   ("Art to Action", "Media Art", "Archive"))))
        ok("  the first snips folder moved in, Archive and count too, and the old one is gone",
           os.path.isfile(os.path.join(refs, "NeuroNet Snips", "261115 - Snip 1 - (Tabs).png"))
           and os.path.isfile(os.path.join(refs, "NeuroNet Snips", "Archive", "261114 - Snip 0.png"))
           and snips.next_number() == 2 and not os.path.exists(old))
        ok("  snips_dir() is the new place", snips.snips_dir() == os.path.join(refs, "NeuroNet Snips"))
        art = snips.media_art_dir()
        for name in ("b.jpg", "a.png", "notes.txt"):
            with open(os.path.join(art, name), "wb") as f:
                f.write(PNG)
        ok("Media Art lists the pictures waiting (not other files, not its Archive)",
           sorted(os.path.basename(p) for p in snips.media_art_waiting()) == ["a.png", "b.jpg"])
        dest = snips.media_art_archive(os.path.join(art, "a.png"))
        with open(os.path.join(art, "a.png"), "wb") as f:
            f.write(PNG)
        dest2 = snips.media_art_archive(os.path.join(art, "a.png"))
        ok("  done ones go into its Archive, a second of the same name numbered",
           dest.endswith("Media Art/Archive/a.png") and dest2.endswith("Media Art/Archive/a (2).png"))
        env_art = dict(env, NEURONET_REFERENCES_DIR=refs)
        open(log, "w").close()
        r = subprocess.run([sys.executable, os.path.join(APP, "neuronet-media-art"), "apply", os.path.join(art, "b.jpg"),
                            "--title", "Practical Magic", "--format", "VHS", "--year", "1998"],
                           env=env_art, capture_output=True, text=True, timeout=30)
        calls = open(log).read()
        ok("neuronet-media-art apply hands the picture, title, type, format and year to NeuroNet (media.cover)",
           r.returncode == 0 and "call media.cover" in calls and '"title": "Practical Magic"' in calls
           and '"format": "VHS"' in calls and '"type": "film"' in calls, r.stderr + calls)
        ok("  and the picture moves to Media Art/Archive", not os.path.exists(os.path.join(art, "b.jpg"))
           and os.path.isfile(os.path.join(art, "Archive", "b.jpg")))
    finally:
        snips.documents_dir = real_docs
        os.environ["NEURONET_SNIPS_DIR"] = saved_env

    print("\nThe pieces\n")
    cap = open(os.path.join(APP, "neuronet-capture")).read()
    ok("Super+Alt+X (neuronet-capture) is a snip now", 'neuronet-snip" "${1:-smart}"' in cap)
    ok("neuronet-snip checks Photos isn't hidden before filing a copy there", "neuronet-path" in open(os.path.join(APP, "neuronet-snip")).read())
    opener = open(os.path.join(APP, "neuronet-open")).read()
    page = open(os.path.join(APP, "ui", "app.js")).read()
    ok("the notification's click opens its Save as (neuronet-open snip N -> open.snip)",
       "snip)   section=photos" in opener and 'case "open.snip"' in page and "snipSaveAs(n)" in page)
    ok("Photos keeps it in NeuroNet Snips (and its Archive), tagged Snip",
       'const SNIP_FOLDER = "NeuroNet Snips"' in page and 'tag: "Snip"' in page and 'name: "Archive", parentId: top.id' in page)
    ok("the Snip button is in the top bar: a click snips, a right-click offers the other ways",
       'id="ss-snip"' in open(os.path.join(APP, "ui", "index.html")).read() and 'takeSnip("smart")' in page
       and "snipMenu(snipBtn)" in page)
    ok("renaming a snip in the viewer is its Save as (Documents too)", "if (p.snip) { closeViewer(); snipSaveAs(p.snip); return; }" in page)
    setup = open(os.path.join(APP, "system", "bin", "neuronet-setup")).read()
    ok("neuronet-snip is installed as a command", "neuronet-snip" in setup)

    print("\nCollaboration\n")
    import collab  # noqa: E402
    doc = {"ref": "Q99", "type": "questions", "title": "t", "status": "open", "sections": [{"title": "s", "items": [
        {"id": "q1", "kind": "text", "text": "Which?", "answer": "", "snip": True},
        {"id": "q2", "kind": "text", "text": "And?", "answer": ""}]}]}
    items = collab.clean(doc)["sections"][0]["items"]
    ok("a question's Snip tick is kept when saved", items[0].get("snip") is True and "snip" not in items[1], items)
    cj = open(os.path.join(APP, "ui", "collab", "collab.js")).read()
    ok("  each question has a Snip box", 'data-snip="${esc(it.id)}"' in cj and "it.snip = cb.checked" in cj)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\n  %d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
