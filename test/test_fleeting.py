"""Fleeting notes, and the two new dashboard widgets.

Cam: "quick note, a little text widget where I can write a quick thought and
it gets saved under a new sub section in Notes called Fleeting ... If I have 5
notes in fleeting then delete number 1 the other notes then rename. The
numbers act as a que." And: "a random circuit generator, which displays a
random circuit in the widget windows that is scrollable."
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os, re, shutil, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
UI = os.path.join(APP, "ui")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


read = lambda p: open(os.path.join(UI, p), encoding="utf-8").read()
print("\nFleeting notes and the new widgets\n")
app, home, fl = read("app.js"), read("home/home.js"), read("fleeting/fleeting.js")

ok("Fleeting is a subsection of Notes",
   '{key: "fleeting:list", name: "Fleeting"}' in app
   and re.search(r'fleeting:\s*"notes"', app) is not None)
ok("a fleeting note can be copied out and deleted",
   "data-copy=" in fl and "data-del=" in fl and "clipboard.writeText" in fl)
ok("  with a way to copy even without clipboard permission",
   "couldn't reach the clipboard" in fl)
ok("the dashboard's quick note goes into the same queue",
   "SS.Fleeting.add" in home or "window.SS.Fleeting && window.SS.Fleeting.add" in home)
ok("  and Ctrl+Enter saves it", 'e.key === "Enter"' in home and "ctrlKey" in home)

# ---- the circuit block --------------------------------------------------
ok("there is a random circuit block", "function circuitBlockBody(" in home)
ok("  it is scrollable, so a long circuit does not stretch the block",
   re.search(r"\.dash-circuit-scroll \{[^}]*overflow-y: auto", read("home/home.css")) is not None
   and re.search(r"\.dash-circuit-scroll \{[^}]*max-height", read("home/home.css")) is not None)
ok("  'Another' never repeats the one on show",
   "randomCircuit(shownCircuit && shownCircuit.id)" in home
   and "c.id !== notId" in read("training/bridge.js"))
# Picking another circuit must not count as a layout change.
ok("  and picking one does not rewrite the layout",
   "let shownCircuit = null;" in home
   and not re.search(r"shownCircuit = next;\s*await saveBlocks", home))
ok("circuits are read through Training's own store",
   "CF.Store.load()" in read("training/bridge.js"))

# ---- the queue itself ---------------------------------------------------
root = tempfile.mkdtemp(prefix="mc-fleeting-")
appdir = os.path.join(root, "app")
shutil.copytree(APP, appdir, ignore=shutil.ignore_patterns(
    "__pycache__", "node_modules", "test", "*_data", "kincrux_*", "*.log"))
os.makedirs(os.path.join(appdir, "neuronet_data"))
open(os.path.join(appdir, "neuronet_data", "neuronet.json"), "w").write("{}")
try:
    sys.argv = [os.path.join(appdir, "neuronet.py")]
    sys.path.insert(0, appdir)
    import neuronet as _mc
    api = _mc.Api()
    folder = os.path.join(_mc.notes_backend.vault_dir(), "Fleeting")
    texts = lambda: [x["text"] for x in api.fleeting_list()]
    nums = lambda: [x["n"] for x in api.fleeting_list()]

    for t in ("one", "two", "three", "four", "five"):
        api.fleeting_add(t)
    ok("notes are numbered in the order they are taken", nums() == [1, 2, 3, 4, 5], nums())
    ok("  and are ordinary notes in the vault",
       os.path.isfile(os.path.join(folder, "Fleeting note 1.md")))
    api.fleeting_delete(1)
    ok("deleting number 1 closes the gap",
       nums() == [1, 2, 3, 4] and texts() == ["two", "three", "four", "five"], texts())
    api.fleeting_delete(2)
    ok("  and so does deleting one from the middle",
       nums() == [1, 2, 3] and texts() == ["two", "four", "five"], texts())
    ok("  and the folder holds exactly the queue, nothing else",
       sorted(os.listdir(folder)) == [f"Fleeting note {i}.md" for i in (1, 2, 3)],
       os.listdir(folder))
    # A code-shape check, honestly labelled: ascending renames mean a
    # collision cannot be forced from outside, so there is no behaviour to
    # drive. os.rename overwrites silently on Linux, so the guard is what
    # stands between an unexpected state and one note written over another.
    _py = __import__("backend_src").backend_source(APP)
    # Scoped to fleeting_delete: that line appears elsewhere in the file, so
    # looking for it anywhere proved nothing about this function.
    _del = _py[_py.index("def fleeting_delete"):_py.index("def notes_available")]
    ok("  a name in the way is refused rather than written over",
       "if os.path.exists(dst):" in _del and "in the way" in _del)

    api.fleeting_add("six")
    ok("a new note continues the queue", nums() == [1, 2, 3, 4], nums())
    ok("deleting one that is already gone says so",
       "error" in api.fleeting_delete(99))
    # A note Cam named himself must not be swept up in the renumbering.
    open(os.path.join(folder, "Keep this.md"), "w").write("mine")
    api.fleeting_delete(1)
    ok("a note Cam named himself is left alone",
       os.path.isfile(os.path.join(folder, "Keep this.md")))
    ok("  and is not listed as part of the queue",
       all(x["name"] != "Keep this" for x in api.fleeting_list()))
finally:
    shutil.rmtree(root, ignore_errors=True)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
