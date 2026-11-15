"""The desktop set-up that goes with NeuroNet to a new computer.

NeuroNet System plan, Stage 3 (2026-09-29): the new-machine export carries
not just NeuroNet's data but how its desktop was set up -- so a new computer
comes up the way the old one looked, after one import:

    the dock's pins and settings   ~/.local/state/omarchy/neuronet-dock.json
    the theme (NeuroNet or Light), and which wallpaper

(The desktop board's and photo frame's settings went with the desktop
widgets, 3 Nov 2026; an old export that has them is fine -- they're skipped.)

HOW IT TRAVELS. capture() copies them into desktop-setup/ inside NeuroNet's
data folder just before an export, so the export -- which takes the whole
data folder -- carries them with no machinery of its own. After an import,
apply() puts them back where they belong. Each capture has an id, and the
last id applied is remembered, so an import that brings the same set-up
again (or one without it) changes nothing on the desktop.
"""
import datetime
import json
import os
import shutil
import subprocess
import uuid

FOLDER = "desktop-setup"
FILES = {
    "dock.json": ".local/state/omarchy/neuronet-dock.json",
}
DESCRIBE = {"dock.json": "the dock's pins and settings"}


def _home(home):
    return home or os.path.expanduser("~")


def _applied_path(home):
    return os.path.join(_home(home), ".local", "state", "neuronet", "desktop-applied")


def capture(data_dir, home=None):
    """Copy this computer's desktop set-up into data_dir/desktop-setup/."""
    home = _home(home)
    folder = os.path.join(data_dir, FOLDER)
    os.makedirs(folder, exist_ok=True)
    taken = []
    for name, rel in FILES.items():
        src, dest = os.path.join(home, rel), os.path.join(folder, name)
        if os.path.isfile(src):
            shutil.copy2(src, dest)
            taken.append(name)
        elif os.path.exists(dest):
            os.remove(dest)                  # gone here since the last capture
    state = os.path.join(home, ".local", "state", "omarchy", "current")
    theme = ""
    try:
        theme = open(os.path.join(state, "theme.name")).read().strip()
    except OSError:
        pass
    wallpaper = os.path.basename(os.path.realpath(os.path.join(state, "background"))) \
        if os.path.exists(os.path.join(state, "background")) else ""
    setup = {
        "id": uuid.uuid4().hex,
        "captured": datetime.datetime.now().isoformat(timespec="seconds"),
        "files": taken,
        # only NeuroNet's own themes travel: another theme may not be on the new computer
        "theme": theme if theme.startswith("neuronet") else "",
        "wallpaper": wallpaper if theme.startswith("neuronet") else "",
    }
    with open(os.path.join(folder, "setup.json"), "w") as f:
        json.dump(setup, f, indent=1)
    # this computer's own set-up: nothing to apply here
    os.makedirs(os.path.dirname(_applied_path(home)), exist_ok=True)
    with open(_applied_path(home), "w") as f:
        f.write(setup["id"])
    return setup


def pending(data_dir, home=None):
    """The set-up in data_dir waiting to be applied, or None."""
    try:
        setup = json.load(open(os.path.join(data_dir, FOLDER, "setup.json")))
    except (OSError, ValueError):
        return None
    try:
        last = open(_applied_path(home)).read().strip()
    except OSError:
        last = ""
    return setup if setup.get("id") and setup["id"] != last else None


def apply(data_dir, home=None, run=subprocess.run):
    """Put an imported desktop set-up in place. Returns what was done, in
    words; [] if there was nothing new to do."""
    home = _home(home)
    setup = pending(data_dir, home)
    if not setup:
        return []
    folder = os.path.join(data_dir, FOLDER)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    done = []
    for name in setup.get("files", []):
        src = os.path.join(folder, name)
        if name not in FILES or not os.path.isfile(src):
            continue
        dest = os.path.join(home, FILES[name])
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if os.path.isfile(dest):
            shutil.copy2(dest, dest + ".bak." + stamp)      # this computer's, kept
        shutil.copy2(src, dest)
        done.append(DESCRIBE[name])
    theme, wallpaper = setup.get("theme"), setup.get("wallpaper")
    if theme and os.path.isdir(os.path.join(home, ".config", "omarchy", "themes", theme)):
        try:
            run(["omarchy", "theme", "set", theme], check=False, timeout=120,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            done.append("the %s theme" % ("NeuroNet Light" if theme == "neuronet-light" else "NeuroNet"))
            bg = os.path.join(home, ".local", "state", "omarchy", "current", "theme", "backgrounds", wallpaper)
            if wallpaper and os.path.isfile(bg):
                run(["omarchy", "theme", "bg", "set", bg], check=False, timeout=60,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                done.append("its wallpaper")
        except (OSError, subprocess.SubprocessError):
            pass
    if done:
        # the widgets read their settings when they start
        try:
            run(["omarchy", "restart", "shell"], check=False, timeout=60,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except (OSError, subprocess.SubprocessError):
            pass
    os.makedirs(os.path.dirname(_applied_path(home)), exist_ok=True)
    with open(_applied_path(home), "w") as f:
        f.write(setup["id"])
    return done
