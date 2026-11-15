#!/usr/bin/env python3
"""The training store — shape, guarding, and the file it must never touch.

The point of this file is the last group. Coach Cam and Hearth both had
a save_data, and they meant different files. This proves that saving a
coaching document leaves camily.json alone, by writing a real one and
comparing the bytes before and after.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import os
import shutil
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
sys.path.insert(0, os.path.join(APP, "crux", "py"))

import crux_store                                    # noqa: E402

PASS = 0
FAIL = 0
LINES = []


def ok(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        LINES.append("  ok    " + name)
    else:
        FAIL += 1
        LINES.append("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


# Import the app without letting it start a window.
sys.argv = [sys.argv[0]]
import neuronet                                     # noqa: E402

# Pin the data folder to a throwaway directory BEFORE any path is asked
# for. Without this, the first training_file() call below would run the
# real data-folder logic: create neuronet_data/ beside this test, and --
# because training_dir() copies KinCrux's training in on first use -- go
# looking for a real KinCrux folder to copy from. A test must never be the
# thing that moves someone's data.
SANDBOX = tempfile.mkdtemp(prefix="ss-training-")
neuronet._resolved_root = SANDBOX
neuronet._training_checked = True
kincrux = neuronet        # the checks below were written against KinCrux


# ------------------------------------------------------------ shape ---
EMPTY = kincrux.TRAINING_EMPTY
norm = kincrux.normalize_training

ok("an empty file still has every collection",
   set(norm({}).keys()) == set(EMPTY.keys()),
   sorted(norm({}).keys()))
ok("exercises is a dict, not a list",
   isinstance(norm({}) ["exercises"], dict), type(norm({})["exercises"]))
ok("circuits is a list", isinstance(norm({})["circuits"], list))

ok("a list where a dict belongs is corrected",
   isinstance(norm({"exercises": []})["exercises"], dict),
   norm({"exercises": []})["exercises"])
ok("a dict where a list belongs is corrected",
   isinstance(norm({"circuits": {}})["circuits"], list),
   norm({"circuits": {}})["circuits"])
ok("null is corrected rather than carried",
   norm({"sessions": None})["sessions"] == [], norm({"sessions": None})["sessions"])
ok("garbage input gives a usable document",
   set(norm("not a document").keys()) == set(EMPTY.keys()))

ok("real content survives normalising",
   norm({"circuits": [{"id": "c1", "name": "Ladder"}]})["circuits"][0]["name"] == "Ladder")

# The original Coach Cam writes keys this build does not know about.
# Dropping them would quietly damage the file they share.
unknown = norm({"somethingCoachCamAdded": {"keep": "me"}})
ok("a key this build does not know is carried through untouched",
   unknown.get("somethingCoachCamAdded") == {"keep": "me"}, unknown.keys())

ok("normalising does not mutate the shared empty template",
   EMPTY["circuits"] == [] and kincrux.TRAINING_EMPTY["exercises"] == {},
   "the template was modified in place")

# A second normalise must not alias the first's lists.
a, b = norm({}), norm({})
a["circuits"].append({"id": "x"})
ok("two reads do not share their collections", b["circuits"] == [], b["circuits"])


# ------------------------------------------------- guarded writing ---
tmp = tempfile.mkdtemp(prefix="ss-training-doc-")
try:
    doc = os.path.join(tmp, "coach_cam.json")

    first = crux_store.save_guarded(doc, {"circuits": [{"id": "c1"}]},
                                    normalise=norm, what="your coaching document")
    ok("a first write succeeds", first.get("ok"), first)
    ok("and hands back a stamp", isinstance(first.get("stamp"), float), first)

    on_disk = json.load(open(doc))
    ok("what landed on disk is the normalised document",
       set(on_disk.keys()) == set(EMPTY.keys()), sorted(on_disk.keys()))

    # Someone else writes. The stamp we hold is now old.
    time.sleep(1.1)
    crux_store.atomic_write_json(doc, norm({"circuits": [{"id": "theirs"}]}))

    stale = crux_store.save_guarded(doc, {"circuits": [{"id": "mine"}]},
                                    expect_stamp=first["stamp"],
                                    normalise=norm, what="your coaching document")
    ok("a stale write is refused", stale.get("conflict") is True, stale)
    ok("and says which file, in words a person can act on",
       "coaching document" in str(stale.get("error", "")), stale.get("error"))
    ok("the other window's work is still there",
       json.load(open(doc))["circuits"][0]["id"] == "theirs",
       json.load(open(doc))["circuits"])

    fresh = crux_store.save_guarded(doc, {"circuits": [{"id": "mine"}]},
                                    expect_stamp=stale["stamp"],
                                    normalise=norm, what="your coaching document")
    ok("reloading the stamp lets the write through", fresh.get("ok"), fresh)
    ok("and it is the one that landed",
       json.load(open(doc))["circuits"][0]["id"] == "mine")
finally:
    shutil.rmtree(tmp, ignore_errors=True)


# ------------------------------- the collision this all exists for ---
# Hearth's save_data and Coach Cam's save_data meant different files.
# Prove the training path cannot reach Hearth's.
ok("training and the family document are different files",
   os.path.abspath(kincrux.training_file())
   != os.path.abspath(kincrux.data_file()),
   kincrux.training_file() + " vs " + kincrux.data_file())

ok("training and the music library are different files",
   os.path.abspath(kincrux.training_file())
   != os.path.abspath(os.path.join(neuronet.chords_dir(), "chords.json")))

ok("training and the saved games are different files",
   os.path.abspath(kincrux.training_file())
   != os.path.abspath(os.path.join(neuronet.cranium_dir(), "cranium.json")))

ok("training keeps Coach Cam's own file name",
   os.path.basename(kincrux.training_file()) == "coach_cam.json",
   kincrux.training_file())

ok("its prefs stay beside it, not in NeuroNet's own",
   os.path.dirname(kincrux.training_prefs_file())
   == os.path.dirname(kincrux.training_file()),
   kincrux.training_prefs_file())

# Every training Api method carries the namespace, so the isolation test
# has something real to check against.
api_methods = [n for n in dir(kincrux.Api)
               if n.startswith("training") and callable(getattr(kincrux.Api, n))]
ok("the backend exposes the training methods", len(api_methods) >= 5, api_methods)
ok("every one of them is namespaced",
   all("training" in n for n in api_methods), api_methods)

# The real thing: write a coaching document, check the family file's bytes.
tmp2 = tempfile.mkdtemp(prefix="ss-collide-")
try:
    family = os.path.join(tmp2, "camily.json")
    training = os.path.join(tmp2, "coach_cam.json")
    original = {"photos": [{"id": "p1", "file": "wedding.jpg"}],
                "contacts": [{"id": "k1", "name": "Mum"}]}
    crux_store.atomic_write_json(family, original)
    before = open(family, "rb").read()

    crux_store.save_guarded(training, {"circuits": [{"id": "c1"}]}, normalise=norm)

    ok("saving training does not touch the family document",
       open(family, "rb").read() == before, "camily.json changed")
    ok("and the family document still reads back intact",
       json.load(open(family)) == original)
    ok("both files exist side by side",
       os.path.isfile(family) and os.path.isfile(training))
finally:
    shutil.rmtree(tmp2, ignore_errors=True)


# ------------------------------------------ decisions made in the move ---
# Cam: "inside the neuronet app folder itself ... so it lives together".
ok("training lives inside NeuroNet's data folder, beside chords and cranium",
   os.path.dirname(os.path.abspath(neuronet.training_dir()))
   == os.path.abspath(SANDBOX),
   neuronet.training_dir())

# Standalone Coach Cam keeps running over its own coach_cam_data/. If
# NeuroNet searched for that folder, the day it became findable NeuroNet
# would silently switch libraries. So the location must be fixed.
import inspect
ok("the training location is fixed, not a search for Coach Cam's folder",
   "coach_cam_data" not in inspect.getsource(neuronet.training_dir),
   inspect.getsource(neuronet.training_dir))

shutil.rmtree(SANDBOX, ignore_errors=True)
stray = [d for d in os.listdir(HERE) if d.endswith("_data") or d == "training"]
ok("the test left nothing behind beside itself", not stray, stray)


print("\nThe training store\n")
for line in LINES:
    print(line)
print("\n  %d passed, %d failed\n" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
