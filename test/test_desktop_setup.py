"""The desktop set-up travels with the export (NeuroNet System plan, Stage 3).

desktop_setup.capture() on the old computer, the data folder carried across,
desktop_setup.apply() on the new one -- with two made-up home folders and a
stand-in for the omarchy command, so nothing real is touched.
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

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import desktop_setup as ds  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def put(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write(text)


root = tempfile.mkdtemp(prefix="nn-desk-")
try:
    old, new = os.path.join(root, "old"), os.path.join(root, "new")
    put(os.path.join(old, ".local/state/omarchy/neuronet-dock.json"), '{"pinned": [{"key": "brave-browser"}]}')
    put(os.path.join(old, ".config/omarchy/neuronet-board.json"), '{"columns": 4}')
    put(os.path.join(old, ".config/omarchy/neuronet-desktop.json"), '{"items": {"frame": {"x": 9}}}')
    put(os.path.join(old, ".local/state/omarchy/current/theme.name"), "neuronet-light\n")
    put(os.path.join(old, ".local/state/omarchy/current/theme/backgrounds/02-brain.png"), "png")
    os.symlink(os.path.join(old, ".local/state/omarchy/current/theme/backgrounds/02-brain.png"),
               os.path.join(old, ".local/state/omarchy/current/background"))
    data_old = os.path.join(root, "data-old")
    os.makedirs(data_old)

    s = ds.capture(data_old, home=old)
    ok("capture takes the dock's settings, the theme and the wallpaper (no board: the desktop widgets went, 3 Nov 2026)",
       sorted(s["files"]) == ["dock.json"] and s["theme"] == "neuronet-light"
       and s["wallpaper"] == "02-brain.png", s)
    ok("  not where the widgets sit (that's fitted to a screen)",
       not any("desktop" in f for f in os.listdir(os.path.join(data_old, ds.FOLDER))))
    ok("  and on the computer it came from, there's nothing to apply", ds.pending(data_old, home=old) is None)

    # carried across: the data folder, as an export would
    data_new = os.path.join(root, "data-new")
    shutil.copytree(data_old, data_new)
    put(os.path.join(new, ".local/state/omarchy/neuronet-dock.json"), '{"pinned": []}')
    os.makedirs(os.path.join(new, ".config/omarchy/themes/neuronet-light"))
    calls = []

    def run(cmd, **kw):
        calls.append(cmd)
        if cmd[:3] == ["omarchy", "theme", "set"]:       # as Omarchy would: the theme's folder appears
            put(os.path.join(new, ".local/state/omarchy/current/theme/backgrounds/02-brain.png"), "png")

    ok("on the new computer it's waiting to be applied", ds.pending(data_new, home=new) is not None)
    done = ds.apply(data_new, home=new, run=run)
    ok("apply puts the settings in place",
       json.load(open(os.path.join(new, ".local/state/omarchy/neuronet-dock.json"))) == {"pinned": [{"key": "brave-browser"}]}
       and not os.path.exists(os.path.join(new, ".config/omarchy/neuronet-board.json")), done)
    ok("  keeping the new computer's own copy first",
       any(n.startswith("neuronet-dock.json.bak.") for n in os.listdir(os.path.join(new, ".local/state/omarchy"))))
    ok("  switches to the theme, then the wallpaper, then restarts the shell",
       ["omarchy", "theme", "set", "neuronet-light"] in calls
       and any(c[:4] == ["omarchy", "theme", "bg", "set"] and c[4].endswith("02-brain.png") for c in calls)
       and calls[-1] == ["omarchy", "restart", "shell"], calls)
    ok("  and says what it did, in words", "the dock's pins and settings" in done and "the NeuroNet Light theme" in done, done)
    calls.clear()
    ok("applying again does nothing", ds.apply(data_new, home=new, run=run) == [] and calls == [], calls)

    # an export without a desktop set-up (an older NeuroNet): nothing happens
    bare = os.path.join(root, "data-bare")
    os.makedirs(bare)
    ok("an import with no desktop set-up leaves the desktop alone", ds.apply(bare, home=new, run=run) == [] and calls == [])
    # a theme that isn't NeuroNet's isn't carried: it may not exist on the new computer
    put(os.path.join(old, ".local/state/omarchy/current/theme.name"), "tokyo-night\n")
    s = ds.capture(data_old, home=old)
    ok("only NeuroNet's own themes travel", s["theme"] == "" and s["wallpaper"] == "", s)
finally:
    shutil.rmtree(root, ignore_errors=True)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
