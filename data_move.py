"""Moving NeuroNet's data folder to another drive (Settings -> Data folder).

Cam's decision for the NeuroNet System (2026-09-29): the data lives in the
home folder by default, with "a Settings option to migrate data to another
drive". Her own folder is 92 GB -- photos, music, notes, everything -- so this
is written to be the one thing in NeuroNet that cannot lose any of it:

  * COPY, NEVER MOVE. Everything is copied to a NEW folder on the other drive
    ("NeuroNet-data"), then copied again for anything that changed while the
    first pass ran, then checked file by file (every file there, every size
    the same). Only then does NeuroNet switch over.
  * THE SWITCH IS ONE LINE: "data" in ~/.config/neuronet/paths.json, which
    the app, its commands and the desktop widgets all read. neuronet-setup is
    run to re-point the services that watch the folder.
  * THE OLD FOLDER IS KEPT, RENAMED ("neuronet_data.moved-<when>", with a note
    inside saying where everything went). Renamed because NeuroNet looks for
    its data in the usual places when the configured folder isn't there -- an
    unplugged drive -- and a stale old copy found that way would quietly
    split Cam's data in two. Kept because deleting 92 GB is the person's call,
    made later, in the file manager, once they're happy.
  * A FAILED OR CANCELLED COPY REMOVES ONLY WHAT IT MADE. The new folder must
    not exist (or be empty) before the move, so removing it again touches
    nothing that was there before.
"""
import datetime as _dt
import json
import os
import shutil
import subprocess

TARGET_NAME = "NeuroNet-data"
FAT_LIMIT = 4 * 1024 ** 3 - 1          # the largest file FAT32 can hold
WINDOWS_FS = ("exfat", "ntfs", "ntfs3", "fuseblk")
FAT_FS = ("vfat", "msdos", "fat")
NOTE = "MOVED - README.txt"


class Cancelled(Exception):
    pass


def survey(src):
    """How much there is: files, bytes, and the biggest file (for FAT32)."""
    files = size = biggest = 0
    for root, _dirs, names in os.walk(src):
        for n in names:
            p = os.path.join(root, n)
            try:
                st = os.lstat(p)
            except OSError:
                continue
            files += 1
            size += st.st_size
            biggest = max(biggest, st.st_size)
    return {"files": files, "bytes": size, "biggest": biggest}


def fs_type(path):
    """The filesystem a folder is on ("btrfs", "exfat", "vfat", ...), or ""."""
    try:
        r = subprocess.run(["findmnt", "-no", "FSTYPE", "-T", path],
                           capture_output=True, text=True, timeout=5)
        return r.stdout.strip().splitlines()[0] if r.stdout.strip() else ""
    except (OSError, subprocess.SubprocessError, IndexError):
        return ""


def _inside(a, b):
    """Is folder a the same as, or inside, folder b?"""
    a, b = os.path.realpath(a), os.path.realpath(b)
    return a == b or a.startswith(b.rstrip(os.sep) + os.sep)


def _empty(path):
    try:
        return not any(True for _ in os.scandir(path))
    except OSError:
        return False


def check(src, chosen, info=None):
    """What moving src into the folder `chosen` would do, and what stops it.

    The data goes into a new folder, chosen/NeuroNet-data. Returns
    {target, need, free, fs, problems: [...], warnings: [...]}; the move may
    start only when problems is empty."""
    info = info or survey(src)
    out = {"source": os.path.realpath(src), "chosen": chosen, "files": info["files"],
           "need": info["bytes"], "free": 0, "fs": "", "problems": [], "warnings": []}
    problems, warnings = out["problems"], out["warnings"]
    if not chosen or not os.path.isdir(chosen):
        problems.append("That folder isn't there.")
        return out
    target = os.path.join(os.path.realpath(chosen), TARGET_NAME)
    out["target"] = target
    if _inside(target, src):
        problems.append("That's inside NeuroNet's data folder already. Pick a folder on the other drive.")
    elif _inside(src, chosen):
        problems.append("NeuroNet's data is inside that folder. Pick a folder on the other drive.")
    if os.path.exists(target) and not (os.path.isdir(target) and _empty(target)):
        problems.append("There's already a folder called %s there. Pick another place, "
                        "or rename that folder first." % TARGET_NAME)
    if not os.access(chosen, os.W_OK):
        problems.append("NeuroNet isn't allowed to write there.")
    try:
        out["free"] = shutil.disk_usage(chosen).free
    except OSError:
        out["free"] = 0
    margin = max(1024 ** 3, info["bytes"] // 50)      # 1 GB, or 2% for a big library
    if out["free"] < info["bytes"] + margin:
        problems.append("Not enough room: it needs %s and that drive has %s free."
                        % (human(info["bytes"] + margin), human(out["free"])))
    fs = out["fs"] = fs_type(chosen)
    if fs in FAT_FS:
        if info["biggest"] > FAT_LIMIT:
            problems.append("That drive is formatted FAT32, which can't hold a file over 4 GB, "
                            "and NeuroNet has one. Reformat it as exFAT or ext4 first.")
        else:
            warnings.append("That drive is formatted FAT32: no file on it can be over 4 GB, "
                            "so a very long film or recording couldn't be added later.")
    elif fs in WINDOWS_FS:
        warnings.append("That drive is formatted for Windows (%s). It works, but it's slower "
                        "than a Linux drive for lots of small files." % fs)
    try:
        if os.stat(chosen).st_dev == os.stat(src).st_dev:
            warnings.append("That's the same drive NeuroNet's data is on now, so it won't free any room.")
    except OSError:
        pass
    real = os.path.realpath(chosen)
    if real.startswith(("/run/media/", "/media/", "/mnt/")) or fs in FAT_FS + WINDOWS_FS:
        warnings.append("NeuroNet will need this drive connected whenever it's open. "
                        "If it isn't, NeuroNet says so and waits, rather than opening empty.")
    return out


def human(b):
    b = float(b or 0)
    for unit in ("bytes", "KB", "MB", "GB", "TB"):
        if b < 1000 or unit == "TB":
            return ("%d %s" % (b, unit)) if unit == "bytes" else ("%.1f %s" % (b, unit))
        b /= 1000.0


def copy_tree(src, dst, progress=None, only_changed=False, cancelled=None):
    """Copy every file under src to dst, keeping times. With only_changed,
    files already there with the same size and time are left alone (the
    catch-up pass). Each file is written as .part and renamed into place,
    so a file in dst is never half-written."""
    total = survey(src)["bytes"] if progress else 0
    done = copied = 0
    for root, dirs, names in os.walk(src):
        dirs.sort()
        rel = os.path.relpath(root, src)
        into = dst if rel == "." else os.path.join(dst, rel)
        os.makedirs(into, exist_ok=True)
        for n in sorted(names):
            if cancelled and cancelled():
                raise Cancelled()
            a, b = os.path.join(root, n), os.path.join(into, n)
            st = os.lstat(a)
            if os.path.islink(a):
                if not os.path.lexists(b):
                    os.symlink(os.readlink(a), b)
                continue
            if only_changed and os.path.isfile(b):
                bt = os.stat(b)
                if bt.st_size == st.st_size and int(bt.st_mtime) == int(st.st_mtime):
                    done += st.st_size
                    continue
            part = b + ".part"
            shutil.copyfile(a, part)
            try:
                shutil.copystat(a, part)
            except OSError:
                pass            # a drive that can't keep permissions still keeps the file
            os.replace(part, b)
            copied += 1
            done += st.st_size
            if progress:
                progress(done, total, (done / total) if total else 1.0)
    return {"copied": copied}


def verify(src, dst):
    """Every file under src is in dst, the same size. Returns what isn't."""
    bad = []
    for root, _dirs, names in os.walk(src):
        rel = os.path.relpath(root, src)
        for n in names:
            a = os.path.join(root, n)
            b = os.path.join(dst, n) if rel == "." else os.path.join(dst, rel, n)
            if os.path.islink(a):
                if not os.path.lexists(b):
                    bad.append(os.path.relpath(a, src))
                continue
            try:
                if os.stat(b).st_size != os.lstat(a).st_size:
                    bad.append(os.path.relpath(a, src))
            except OSError:
                bad.append(os.path.relpath(a, src))
    return bad


def point_paths(paths_file, app, target):
    """Write "data": target into paths.json (made if missing), keeping
    anything else in it."""
    try:
        with open(paths_file, encoding="utf-8") as f:
            conf = json.load(f)
        if not isinstance(conf, dict):
            conf = {}
    except (OSError, ValueError):
        conf = {}
    conf.setdefault("app", app)
    conf["data"] = target
    os.makedirs(os.path.dirname(paths_file), exist_ok=True)
    tmp = paths_file + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(conf, f, indent=2)
        f.write("\n")
    os.replace(tmp, paths_file)


def retire(src, target, now=None):
    """Rename the old folder out of NeuroNet's way, with a note inside.
    Returns its new name."""
    now = now or _dt.datetime.now()
    old = "%s.moved-%s" % (src.rstrip(os.sep), now.strftime("%Y%m%d-%H%M%S"))
    os.rename(src, old)
    try:
        with open(os.path.join(old, NOTE), "w", encoding="utf-8") as f:
            f.write("NeuroNet's data was moved on %s to:\n\n    %s\n\n"
                    "This folder is the copy from before the move, kept just in case.\n"
                    "NeuroNet no longer uses it. Once you're happy everything is there,\n"
                    "you can delete this folder to free the room.\n"
                    % (now.strftime("%-d %B %Y at %H:%M"), target))
    except OSError:
        pass
    return old


def move(src, chosen, paths_file, app, progress=None, cancelled=None, setup=None, phase=None):
    """The whole move: check, copy, catch up, verify, switch, retire the old
    folder. Returns {ok, target, old} or {error}; on any failure before the
    switch, the new folder is removed again and nothing else has changed."""
    say = phase or (lambda _p: None)
    say("checking")
    info = survey(src)
    plan = check(src, chosen, info)
    if plan["problems"]:
        return {"error": plan["problems"][0]}
    target = plan["target"]
    made = not os.path.exists(target)
    try:
        say("copying")
        copy_tree(src, target, progress, cancelled=cancelled)
        say("catching up")
        copy_tree(src, target, None, only_changed=True, cancelled=cancelled)
        say("checking the copy")
        bad = verify(src, target)
        if bad:
            raise OSError("%d file(s) didn't copy properly, e.g. %s" % (len(bad), bad[0]))
    except Cancelled:
        _remove(target, made)
        return {"error": "Cancelled. Nothing was changed.", "cancelled": True}
    except OSError as e:
        _remove(target, made)
        return {"error": "The copy didn't finish (%s). Nothing was changed -- "
                         "NeuroNet still uses its data where it was." % e}
    say("switching")
    point_paths(paths_file, app, target)
    if setup:
        try:
            subprocess.run([setup, "--data", target], capture_output=True, timeout=60)
        except (OSError, subprocess.SubprocessError):
            pass    # paths.json is already right; the services catch up next setup
    old, note = None, ""
    try:
        old = retire(src, target)
    except OSError as e:
        note = ("The old folder couldn't be renamed (%s). It's still at %s -- "
                "you can delete it once you're happy." % (e, src))
    return {"ok": True, "target": target, "old": old, "note": note,
            "files": info["files"], "bytes": info["bytes"]}


def _remove(target, made):
    """Remove the new folder -- only ever one this move made, or one that
    was empty before it."""
    if os.path.isdir(target):
        if made:
            shutil.rmtree(target, ignore_errors=True)
        else:
            for e in os.scandir(target):
                if e.is_dir(follow_symlinks=False):
                    shutil.rmtree(e.path, ignore_errors=True)
                else:
                    try:
                        os.remove(e.path)
                    except OSError:
                        pass
