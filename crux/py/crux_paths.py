"""crux.paths — where the app is, and where its data lives.

THE ONE PACKAGING TRAP THIS EXISTS TO PREVENT. app_dir() and
resource_dir() are different folders and conflating them silently breaks
a real PyInstaller build. Cranium paid for this the hard way:

  * resource_dir() is where the bundled ui/ files land once frozen —
    PyInstaller's own sys._MEIPASS, which for a onedir build is an
    `_internal` folder, NOT the folder the exe sits in.
  * app_dir() is where the data folder persists — beside the exe, where
    the user can find it, back it up and copy it.

Use resource_dir() for anything shipped with the app and app_dir() for
anything the user owns. Never the other way round.
"""

import os
import sys


def is_frozen():
    return getattr(sys, "frozen", False)


def app_dir():
    """Where the exe (or the plain .py, in a dev run) lives. Data goes
    beside this."""
    if is_frozen():
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(sys.argv[0] or __file__))


def resource_dir(module_file=None):
    """Where files bundled WITH the app live. Pass __file__ from the
    calling module in a dev run so a module nested in a subfolder still
    resolves relative to itself."""
    if is_frozen():
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    if module_file:
        return os.path.dirname(os.path.abspath(module_file))
    return app_dir()


def find_data_dir(names, pointer_file=None, create=None, marker=None):
    """Finds an existing data folder, most likely location first.

    `names` is a list of folder names to look for — several because a
    folder often outlives the app that named it. Hearth still reads
    `camily_data/` and Amnesia still reads `cortex_collab_data/`, both
    deliberately: renaming a folder means migrating real data for no
    functional gain, and risks the user thinking their library is lost.

    A pointer file (one line, an absolute path) wins over the search,
    which is how the folder can live anywhere — an external drive, a
    synced folder.

    `marker` is the file or folder that proves a candidate is the REAL
    one -- "camily.json", "cashbox.json", "vault". Folders holding it
    are preferred over folders that merely exist.

    That preference is not a nicety. The fallback below CREATES an empty
    folder beside the app when it finds nothing, and "beside the app" is
    the first place searched. Without the marker, one launch in a
    directory with no data left an empty folder that permanently
    shadowed the real library one level up -- and the app then showed an
    empty photo library, calendar and contacts, which reads exactly like
    having lost them.

    Returns (path, found). `found` is False when nothing existed and a
    fallback was created, so the UI can say so rather than pretending.
    """
    here = app_dir()
    if pointer_file:
        ptr = os.path.join(here, pointer_file)
        if os.path.isfile(ptr):
            try:
                with open(ptr, "r", encoding="utf-8") as f:
                    chosen = f.read().strip()
                if chosen and os.path.isdir(chosen):
                    return chosen, True
            except OSError:
                pass

    roots = []
    for name in names:
        roots += [
            os.path.join(here, name),
            os.path.join(os.path.dirname(here), name),
            os.path.join(os.path.expanduser("~"), name),
        ]
    # First pass: a folder that actually holds the data, nearest first.
    if marker:
        for root in roots:
            if os.path.isdir(root) and os.path.exists(os.path.join(root, marker)):
                return root, True

    # Second pass: any folder that exists. An empty one is still better
    # than making a second empty one beside it.
    for root in roots:
        if os.path.isdir(root):
            return root, True

    fallback = os.path.join(here, create or names[0])
    os.makedirs(fallback, exist_ok=True)
    return fallback, False


def remember_data_dir(path, pointer_file):
    """Writes the pointer file. Failing to write it is not fatal — the
    choice still holds for this session, it just is not remembered."""
    if not os.path.isdir(path):
        return False
    try:
        with open(os.path.join(app_dir(), pointer_file), "w",
                  encoding="utf-8") as f:
            f.write(path)
    except OSError:
        pass
    return True


def ensure(path):
    os.makedirs(path, exist_ok=True)
    return path
