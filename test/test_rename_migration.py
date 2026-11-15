"""Cam's library survives the rename to NeuroNet.

Cam: "Ok last major change, name change everything please. I want the app
to be called NeuroNet. Please rename everything."

WHAT MAKES A RENAME DANGEROUS, and it is not the renaming. Every photo,
track, note, board, sheet, saved game and training document Cam has lives
in a folder called synapsoul_data/, and the app knows a folder is a real
library because it holds a marker file called synapsoul.json.

Rename the constants and nothing throws. NeuroNet looks for neuronet_data,
does not find it, falls through to "start a fresh library" and creates an
empty one. The app opens, works perfectly, and is empty. There is no error
to see and nothing in the log to read: it reads exactly like having lost
everything, and the natural next move -- reinstalling, or copying a backup
over the top -- is the one that could make it true.

So the old names are still known, and a library found under them is
adopted. This file is the proof, and it is written against the layouts Cam
can actually end up in rather than a convenient one:

  1. he renames the folder      /home/tarumbra/DataDrive/NeuroNet with
                                synapsoul_data still inside it
  2. he unzips NeuroNet beside  /home/tarumbra/DataDrive/NeuroNet next to
     the old install            /mnt/Cams_Collective/SynapSoul, whose
                                synapsoul_data is a level further in and
                                invisible to any search of the app folder
                                or its parent
  3. the data sits beside       the layout the pre-rename search handled
  4. a clean install            nothing anywhere, and a new library is made
  5. library_path.txt           an explicit choice, which outranks all of
                                the above and must not be touched

Each case is built as real folders with a real file in the library, and
the check is that THE FILE IS STILL THERE AND READABLE afterwards -- not
that a path came back. A path that points at a fresh empty folder is
exactly the failure being tested for, and it would satisfy any check that
only asked whether a directory exists.
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
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(HERE)

passed = failed = 0
lines = []


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        lines.append("  ok    " + name)
    else:
        failed += 1
        lines.append("  FAIL  " + name + (("\n          " + detail) if detail else ""))


def make_old_library(path, treasure="Cam's photos"):
    """A library as it looks before the rename: old folder name, old
    marker, and something inside worth not losing."""
    os.makedirs(os.path.join(path, "photos"), exist_ok=True)
    with open(os.path.join(path, "synapsoul.json"), "w", encoding="utf-8") as f:
        json.dump({"photos": [{"id": "p1", "caption": treasure}]}, f)
    with open(os.path.join(path, "photos", "p1.jpg"), "w", encoding="utf-8") as f:
        f.write(treasure)


def resolve_in(app_dir):
    """Run the app's OWN resolution in a fresh interpreter and report what
    it decided.

    A subprocess rather than an import: data_dir() memoises into a module
    global, so a second call in this process would return the first case's
    answer and every later case would pass by accident.

    It calls the real data_dir() and the real prefs_file(). A copy of the
    logic written out here would be a test of the copy.
    """
    code = (
        "import sys, os, json\n"
        "sys.argv = ['neuronet.py']\n"
        f"sys.path.insert(0, {os.path.join(APP)!r})\n"
        "import importlib.util\n"
        f"spec = importlib.util.spec_from_file_location('nn', {os.path.join(APP, 'neuronet.py')!r})\n"
        "m = importlib.util.module_from_spec(spec)\n"
        "sys.modules['nn'] = m\n"
        "spec.loader.exec_module(m)\n"
        f"m.app_dir = lambda: {app_dir!r}\n"
        "m._resolved_root = None\n"
        "m._prefs_adopted = False\n"
        "root = m.data_dir()\n"
        "prefs = m.prefs_file()\n"
        "print(json.dumps({'root': root, 'prefs': prefs}))\n"
    )
    r = subprocess.run([sys.executable, "-c", code],
                       capture_output=True, text=True, timeout=60)
    out = (r.stdout or "").strip().splitlines()
    for line in reversed(out):
        try:
            return json.loads(line)
        except ValueError:
            continue
    return {"error": (r.stderr or "")[-400:]}


def treasure_in(root):
    """What the library actually contains, read back off the disk."""
    if not root or not os.path.isdir(root):
        return None
    p = os.path.join(root, "photos", "p1.jpg")
    if not os.path.isfile(p):
        return None
    with open(p, encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------- case 1
# Cam renames /mnt/Cams_Collective/SynapSoul to .../NeuroNet. The data
# folder travels with it, still under its old name.
with tempfile.TemporaryDirectory() as tmp:
    app = os.path.join(tmp, "Cams_Collective", "NeuroNet")
    os.makedirs(app)
    make_old_library(os.path.join(app, "synapsoul_data"), "the renamed folder")
    got = resolve_in(app)
    root = got.get("root")
    ok("1. renaming the app folder keeps the library",
       treasure_in(root) == "the renamed folder",
       f"resolved to {root}, which holds {treasure_in(root)!r}")
    # The name AND the contents. Checking only the name passes when the
    # migration is gone entirely -- the fall-through creates an empty
    # neuronet_data, whose basename is exactly what this was looking for.
    # It said "adopted" while the library was lost.
    ok("   it is adopted under the new name, with the library in it",
       root and os.path.basename(root) == "neuronet_data"
       and treasure_in(root) == "the renamed folder",
       f"{root} holds {treasure_in(root)!r}")
    ok("   and the marker is renamed with it",
       root and os.path.exists(os.path.join(root, "neuronet.json"))
       and not os.path.exists(os.path.join(root, "synapsoul.json")),
       "a library whose marker still says synapsoul.json would be adopted "
       "all over again on the next launch")

# ---------------------------------------------------------------- case 2
# He unzips NeuroNet next to the old install and leaves SynapSoul alone.
# This is the case the pre-rename search could never have found: nothing
# in the app folder OR its parent is called synapsoul_data.
with tempfile.TemporaryDirectory() as tmp:
    collective = os.path.join(tmp, "Cams_Collective")
    app = os.path.join(collective, "NeuroNet")
    os.makedirs(app)
    old_app = os.path.join(collective, "SynapSoul")
    os.makedirs(old_app)
    make_old_library(os.path.join(old_app, "synapsoul_data"), "the old install")
    got = resolve_in(app)
    root = got.get("root")
    ok("2. unzipping beside the old install still finds the library",
       treasure_in(root) == "the old install",
       f"resolved to {root}, which holds {treasure_in(root)!r}. This is the "
       "layout where the library is one level deeper than anything the "
       "search used to look at")

# ---------------------------------------------------------------- case 3
# The layout the old code already handled, with the old names.
with tempfile.TemporaryDirectory() as tmp:
    parent = os.path.join(tmp, "apps")
    app = os.path.join(parent, "NeuroNet")
    os.makedirs(app)
    make_old_library(os.path.join(parent, "synapsoul_data"), "beside the app")
    got = resolve_in(app)
    root = got.get("root")
    ok("3. a library beside the app is still found",
       treasure_in(root) == "beside the app",
       f"resolved to {root}, holds {treasure_in(root)!r}")

# ---------------------------------------------------------------- case 4
# Nothing anywhere. A fresh library, and no pretending one was adopted.
with tempfile.TemporaryDirectory() as tmp:
    app = os.path.join(tmp, "NeuroNet")
    os.makedirs(app)
    got = resolve_in(app)
    root = got.get("root")
    ok("4. a clean install starts a new library",
       root == os.path.join(app, "neuronet_data") and os.path.isdir(root),
       str(root))

# ---------------------------------------------------------------- case 5
# An explicit choice outranks everything, and nothing is moved.
with tempfile.TemporaryDirectory() as tmp:
    app = os.path.join(tmp, "NeuroNet")
    os.makedirs(app)
    chosen = os.path.join(tmp, "external_drive", "library")
    os.makedirs(chosen)
    make_old_library(chosen, "on the external drive")
    with open(os.path.join(app, "library_path.txt"), "w", encoding="utf-8") as f:
        f.write(chosen)
    # a decoy the adopter would otherwise take
    make_old_library(os.path.join(app, "synapsoul_data"), "the decoy")
    got = resolve_in(app)
    root = got.get("root")
    ok("5. library_path.txt still wins, and nothing is moved",
       root == chosen and treasure_in(root) == "on the external drive",
       f"resolved to {root}")
    ok("   the folder it pointed past is left exactly as it was",
       os.path.isdir(os.path.join(app, "synapsoul_data")),
       "an explicit choice must not cause anything to be renamed behind it")

# ---------------------------------------------------------------- case 6
# A real NeuroNet library already there. The old one must NOT be moved
# over it, and must not be deleted either.
with tempfile.TemporaryDirectory() as tmp:
    app = os.path.join(tmp, "NeuroNet")
    os.makedirs(app)
    new_lib = os.path.join(app, "neuronet_data")
    os.makedirs(os.path.join(new_lib, "photos"))
    with open(os.path.join(new_lib, "neuronet.json"), "w", encoding="utf-8") as f:
        json.dump({"photos": []}, f)
    with open(os.path.join(new_lib, "photos", "p1.jpg"), "w", encoding="utf-8") as f:
        f.write("the new library")
    make_old_library(os.path.join(app, "synapsoul_data"), "the old library")
    got = resolve_in(app)
    root = got.get("root")
    ok("6. an existing NeuroNet library is not written over",
       treasure_in(root) == "the new library", f"resolved to {root}")
    ok("   and the old one is still on disk, untouched",
       os.path.isfile(os.path.join(app, "synapsoul_data", "photos", "p1.jpg")),
       "nothing in a rename should ever delete a library")

# ---------------------------------------------------------------- prefs
with tempfile.TemporaryDirectory() as tmp:
    app = os.path.join(tmp, "NeuroNet")
    os.makedirs(app)
    make_old_library(os.path.join(app, "synapsoul_data"))
    with open(os.path.join(app, "synapsoul_prefs.json"), "w", encoding="utf-8") as f:
        json.dump({"theme": "plum", "hiddenSections": ["games:home"]}, f)
    got = resolve_in(app)
    prefs = got.get("prefs")
    ok("Cam's settings survive the rename too",
       prefs and os.path.isfile(prefs), str(prefs))
    if prefs and os.path.isfile(prefs):
        with open(prefs, encoding="utf-8") as f:
            kept = json.load(f)
        ok("   with his actual choices in them, not defaults",
           kept.get("theme") == "plum", str(kept))

# ------------------------------------------------------------ the names
py = __import__("backend_src").backend_source(APP)
ok("the app is called NeuroNet", 'APP_NAME = "NeuroNet"' in py)
ok("the old names are still known, or none of the above could work",
   'OLD_DATA_NAME = "synapsoul_data"' in py and 'OLD_MARKER = "synapsoul.json"' in py)
# Scoped to the two functions the rename added, not the whole file. The
# first version of this checked the file for "shutil.rmtree" and fired on
# an unrelated one 1200 lines away that rolls back a KinCrux training copy
# -- and only ever deletes paths that same function just created. A check
# whose scope is wider than its claim reports a fault that is not there,
# and the fix for that is the check, not the code.
_mig_start = py.index("def _adopt_old_library")
_mig_end = py.index("def _log_line")
migration = py[_mig_start:_mig_end]
ok("the migration never deletes a directory tree",
   "rmtree" not in migration,
   "adopting a library should move and rename; an rmtree in here is the "
   "one way to turn a wrong guess into lost data")
ok("   and removes a directory only when it is empty",
   migration.count("os.rmdir") == 1 and "not os.listdir(target)" in migration,
   "the only directory it may remove is an empty neuronet_data left by an "
   "earlier launch, which would otherwise block the rename")
ok("   it renames rather than copies, so there is never a half-copy",
   "os.rename" in migration and "copytree" not in migration)

# ------------------------------------------------- what the package ships
#
# FOUND WHILE TESTING THE RENAME, and true long before it.
#
# A synapsoul_prefs.json sat in the source tree holding {"view": "all"}.
# package.sh excluded the data folder, the log, library_path.txt -- not
# that. So it went into every update zip, and the README says to unzip an
# update straight over the install. Nineteen bytes landing on top of Cam's
# real settings: theme, text size, UI scale, favourites, nav order, which
# subsections are hidden, all reset, quietly, on every single update.
#
# It surfaced because it BROKE THE MIGRATION. The adopter refuses to write
# over an existing neuronet_prefs.json -- rightly -- so a shipped one meant
# Cam's old settings were never picked up, and the first end-to-end run of
# this came back with the theme gone. Without the rename it would have gone
# on quietly resetting his app.
sh = open(os.path.join(APP, "package.sh"), encoding="utf-8").read()
ok("the package cannot ship a settings file",
   "--exclude='*_prefs.json'" in sh,
   "an update is unzipped over the install, so anything of Cam's in the "
   "zip lands on top of his own copy")
ok("   and refuses to build if one gets in anyway",
   "REFUSING TO BUILD: a settings file" in sh,
   "an exclude can be missed by a file named a little differently; the "
   "guard checks what actually got staged")
ok("   the data folder is still refused too",
   "REFUSING TO BUILD: a data folder" in sh)

print("\ntest_rename_migration.py")
print("\n".join(lines))
print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
