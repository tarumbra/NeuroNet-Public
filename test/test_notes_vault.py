"""NeuroNet's notes are their own vault -- never KinCrux's, never Amnesia's.

Cam: "lets add the notes application into NeuroNet as well. Do not remove
it from KinCrux, as they will be used to store different variations of
notes and store different PDF textbooks."

KinCrux's copy of notes_backend.py SEARCHES for its vault, and searches for
standalone Amnesia's cortex_collab_data first -- there, sharing one vault
was the point. Copied here unchanged, that search would have opened the
wrong vault. This test plants decoy vaults exactly where that search would
look and checks NeuroNet ignores every one of them.

Everything happens in a temporary copy of the app. Nothing real is touched.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os
import shutil
import sys
import tempfile
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nNeuroNet's notes vault is its own\n")

root = tempfile.mkdtemp(prefix="ss-notes-vault-")
app = os.path.join(root, "NeuroNet")
shutil.copytree(APP, app, ignore=shutil.ignore_patterns(
    "__pycache__", "node_modules", "test", "*_data", "*.log", "library_path.txt"))
os.makedirs(os.path.join(app, "neuronet_data"))
open(os.path.join(app, "neuronet_data", "neuronet.json"), "w").write("{}")

# Decoys: an Amnesia-named and a KinCrux-named vault, beside the app and
# one level up -- every place the old search would have found one.
decoys = [os.path.join(where, name, "vault")
          for where in (root, app)
          for name in ("cortex_collab_data", "kincrux_notes")]
for d in decoys:
    os.makedirs(d)
    open(os.path.join(d, "DECOY.md"), "w").write("# not NeuroNet's")

sys.argv = [os.path.join(app, "neuronet.py")]
sys.path.insert(0, app)
import neuronet                                    # noqa: E402

try:
    vault = neuronet.notes_backend.vault_dir()
    ok("the vault is neuronet_data/notes/vault",
       vault == os.path.join(app, "neuronet_data", "notes", "vault"), vault)

    api = neuronet.Api()
    ok("no decoy vault shows in the tree",
       "DECOY" not in repr(api.notes_list_tree()), api.notes_list_tree())

    made = api.notes_create_note("", "Energy Systems")
    api.notes_write_note(made["path"], "# Energy Systems")
    ok("a new note lands in NeuroNet's vault on disk",
       os.path.isfile(os.path.join(vault, "Energy Systems.md")))
    ok("and in none of the decoys",
       all(os.listdir(d) == ["DECOY.md"] for d in decoys),
       {d: os.listdir(d) for d in decoys})

    ok("prefs sit beside the vault, not in NeuroNet's own settings",
       os.path.dirname(neuronet.notes_backend.prefs_file())
       == os.path.join(app, "neuronet_data", "notes"))

    src = open(os.path.join(app, "notes_backend.py")).read()
    ok("notes_backend never calls find_data_dir",
       "find_data_dir(" not in src)

    # Misconfigured, it must refuse -- a guess could mean writing Cam's
    # notes into another app's vault.
    spec = importlib.util.spec_from_file_location(
        "nb_bare", os.path.join(app, "notes_backend.py"))
    bare = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bare)
    try:
        bare.data_dir()
        ok("with no folder set, it refuses rather than searching", False,
           "it returned a folder instead of refusing")
    except RuntimeError:
        ok("with no folder set, it refuses rather than searching", True)

    for rel in ("ui/notes/vendor/pdfjs/pdf.min.mjs",
                "ui/notes/vendor/pdfjs/pdf.worker.min.mjs"):
        ok("pdf.js is where Notes looks for it: " + rel,
           os.path.isfile(os.path.join(app, rel)))
finally:
    shutil.rmtree(root, ignore_errors=True)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
