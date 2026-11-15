"""Settings -> Data folder: moving NeuroNet's data to another drive (data_move.py).

Cam's data is 92 GB and irreplaceable, so this checks the promises the move
makes: it refuses the moves that can't work, it copies everything and checks
it before switching, a failed or cancelled copy changes nothing, the old
folder is kept (renamed, with a note), and a data folder on a drive that
isn't plugged in makes NeuroNet say so rather than open empty.
Everything happens in temporary folders.
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

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)
import data_move as dm  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def library(root):
    """A small NeuroNet data folder: nested folders, a binary file, an empty one."""
    files = {"neuronet.json": b'{"photos": []}', "neuronet_prefs.json": b"{}",
             "photos/a.jpg": os.urandom(70000), "photos/b.jpg": os.urandom(1234),
             "chords/music/Artist - 01. Song.ogg": os.urandom(250000),
             "notes/vault/Garden/Seedlings.md": "Tomatoes — basil".encode(),
             "journal/empty.txt": b""}
    for rel, data in files.items():
        p = os.path.join(root, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as f:
            f.write(data)
    return files


def same(files, root):
    for rel, data in files.items():
        try:
            with open(os.path.join(root, rel), "rb") as f:
                if f.read() != data:
                    return rel
        except OSError:
            return rel
    return None


def fresh():
    t = tempfile.mkdtemp(prefix="nn-move-")
    src, drive = os.path.join(t, "app", "neuronet_data"), os.path.join(t, "drive")
    os.makedirs(src)
    os.makedirs(drive)
    files = library(src)
    paths = os.path.join(t, "config", "paths.json")
    os.makedirs(os.path.dirname(paths))
    with open(paths, "w") as f:
        json.dump({"app": os.path.join(t, "app")}, f)
    return t, src, drive, files, paths


# ---- the checks ------------------------------------------------------------------
t, src, drive, files, paths = fresh()
c = dm.check(src, drive)
ok("a folder on another drive: no problems", not c["problems"], c["problems"])
ok("  the data goes into a new NeuroNet-data folder there", c["target"] == os.path.join(drive, "NeuroNet-data"))
ok("  and it knows how much there is", c["files"] == len(files) and c["need"] == sum(map(len, files.values())))
ok("a folder that isn't there is refused", dm.check(src, os.path.join(t, "nope"))["problems"])
ok("a folder inside the data is refused", dm.check(src, os.path.join(src, "photos"))["problems"])
ok("the folder that holds the data is refused", dm.check(src, os.path.dirname(src))["problems"])
os.makedirs(os.path.join(drive, "NeuroNet-data"))
open(os.path.join(drive, "NeuroNet-data", "x"), "w").close()
ok("a NeuroNet-data folder with things in it already is refused", dm.check(src, drive)["problems"])
shutil.rmtree(os.path.join(drive, "NeuroNet-data"))
os.makedirs(os.path.join(drive, "NeuroNet-data"))
ok("  an empty one is fine", not dm.check(src, drive)["problems"])
os.rmdir(os.path.join(drive, "NeuroNet-data"))

real_usage, real_fs = shutil.disk_usage, dm.fs_type
shutil.disk_usage = lambda p: type("U", (), {"free": 5000})()
ok("not enough room is refused, saying how much is needed", any("Not enough room" in p for p in dm.check(src, drive)["problems"]))
shutil.disk_usage = real_usage
dm.fs_type = lambda p: "vfat"
big = {"files": 1, "bytes": 5 * 1024 ** 3, "biggest": 5 * 1024 ** 3}
shutil.disk_usage = lambda p: type("U", (), {"free": 10 ** 13})()
ok("FAT32 with a file over 4 GB is refused", any("FAT32" in p for p in dm.check(src, drive, big)["problems"]))
ok("FAT32 without one is only a warning", not dm.check(src, drive)["problems"]
   and any("FAT32" in w for w in dm.check(src, drive)["warnings"]))
dm.fs_type = lambda p: "exfat"
ok("a Windows drive is a warning, and so is needing it plugged in",
   any("Windows" in w for w in dm.check(src, drive)["warnings"])
   and any("connected" in w for w in dm.check(src, drive)["warnings"]))
shutil.disk_usage, dm.fs_type = real_usage, real_fs
shutil.rmtree(t)

# ---- a whole move ----------------------------------------------------------------
t, src, drive, files, paths = fresh()
phases = []
r = dm.move(src, drive, paths, os.path.join(t, "app"), phase=phases.append)
target = os.path.join(drive, "NeuroNet-data")
ok("the move finishes", r.get("ok"), r)
ok("  every file is there, byte for byte", same(files, target) is None, same(files, target))
ok("  paths.json points at the new folder, keeping what else it said",
   json.load(open(paths)) == {"app": os.path.join(t, "app"), "data": target})
ok("  the old folder is kept, renamed out of NeuroNet's way", not os.path.exists(src)
   and r["old"] and os.path.isdir(r["old"]) and same(files, r["old"]) is None, r.get("old"))
ok("  with a note inside saying where it all went",
   target in open(os.path.join(r["old"], dm.NOTE)).read())
ok("  it copied, caught up and checked before switching",
   phases == ["checking", "copying", "catching up", "checking the copy", "switching"], phases)
ok("  and no half-written .part file is left", not any(n.endswith(".part") for _, _, ns in os.walk(target) for n in ns))
shutil.rmtree(t)

# ---- a file that changes while the first pass runs -------------------------------
t, src, drive, files, paths = fresh()
seen = []


def busy(done, total, fraction):
    if not seen:            # after the first file: NeuroNet saves something meanwhile
        seen.append(1)
        with open(os.path.join(src, "neuronet_prefs.json"), "wb") as f:
            f.write(b'{"theme": "omarchy"}')
        os.utime(os.path.join(src, "neuronet_prefs.json"), (2e9, 2e9))
        with open(os.path.join(src, "photos", "new.jpg"), "wb") as f:
            f.write(b"new")


r = dm.move(src, drive, paths, os.path.join(t, "app"), progress=busy)
target = os.path.join(drive, "NeuroNet-data")
ok("a save made during the copy is caught up", r.get("ok")
   and open(os.path.join(target, "neuronet_prefs.json"), "rb").read() == b'{"theme": "omarchy"}'
   and os.path.isfile(os.path.join(target, "photos", "new.jpg")), r)
shutil.rmtree(t)

# ---- cancelled, and failed half way ---------------------------------------------
t, src, drive, files, paths = fresh()
before = open(paths).read()
r = dm.move(src, drive, paths, os.path.join(t, "app"), cancelled=lambda: True)
ok("cancelled: it says so", r.get("cancelled"), r)
ok("  the new folder is gone again", not os.path.exists(os.path.join(drive, "NeuroNet-data")))
ok("  the data is where it was, untouched", same(files, src) is None)
ok("  and paths.json is unchanged", open(paths).read() == before)

real_copy = shutil.copyfile
count = [0]


def flaky(a, b, **kw):
    count[0] += 1
    if count[0] == 3:
        raise OSError(28, "No space left on device")
    return real_copy(a, b, **kw)


shutil.copyfile = flaky
r = dm.move(src, drive, paths, os.path.join(t, "app"))
shutil.copyfile = real_copy
ok("a copy that fails half way (drive full) is an error that says nothing changed",
   r.get("error") and "Nothing was changed" in r["error"], r)
ok("  the half copy is removed", not os.path.exists(os.path.join(drive, "NeuroNet-data")))
ok("  the data is untouched and still used", same(files, src) is None and open(paths).read() == before)
os.makedirs(os.path.join(drive, "keep"))
open(os.path.join(drive, "keep", "mine.txt"), "w").close()
r = dm.move(src, drive, paths, os.path.join(t, "app"), cancelled=lambda: True)
ok("  and nothing else on the drive is touched", os.path.isfile(os.path.join(drive, "keep", "mine.txt")))
shutil.rmtree(t)

# ---- a data folder on a drive that isn't plugged in ------------------------------
t = tempfile.mkdtemp(prefix="nn-move-")
paths = os.path.join(t, "paths.json")
with open(paths, "w") as f:
    json.dump({"app": APP, "data": os.path.join(t, "unplugged", "NeuroNet-data")}, f)
code = """
import sys; sys.argv = sys.argv[:1]; sys.path.insert(0, %r)
import neuronet
neuronet.app_dir = lambda: %r
neuronet.data_dir()
print(neuronet._missing_data)
print(neuronet.welcome_wanted())
""" % (APP, os.path.join(t, "empty-app"))
os.makedirs(os.path.join(t, "empty-app"))
env = dict(os.environ, NEURONET_PATHS=paths, XDG_STATE_HOME=os.path.join(t, "state"))
out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, env=env)
lines = out.stdout.strip().splitlines()
ok("an unplugged drive: NeuroNet knows its data is missing, and where",
   lines[:1] == [os.path.join(t, "unplugged", "NeuroNet-data")], out.stdout + out.stderr[-400:])
ok("  and doesn't offer the new-computer welcome over it", lines[1:2] == ["False"], lines)
shutil.rmtree(t)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
