"""system/install-neuronet.sh -- NeuroNet onto a computer that doesn't have it yet.

Cam, 2026-10-14: "If i want to install it straight onto another cachy OS
machine (running KDE) ... when updates occur we can just ship it there to?"

A stand-in repository on disk (NEURONET_REPO) with a release tag, a bundle
folder with the script, a made-up key and a stand-in enable-updates.sh, and a
release whose install-app.sh only notes how it was run. Nothing outside the
temporary folder is touched; GitHub is never asked.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os
import shutil
import subprocess
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(APP, "system", "install-neuronet.sh")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail)[-900:] if detail else ""))


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def git(*a, cwd):
    subprocess.run(["git", *a], cwd=cwd, check=True, capture_output=True,
                   env=dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t",
                            GIT_COMMITTER_EMAIL="t@t"))


def make_repo(path, tags):
    """tags: [(version, has_install_app)] in order"""
    os.makedirs(path)
    git("init", "-q", "-b", "main", cwd=path)
    for v, has in tags:
        open(os.path.join(path, "neuronet.py"), "w").write("# NeuroNet %s\n" % v)
        open(os.path.join(path, "VERSION"), "w").write(v + "\n")
        os.makedirs(os.path.join(path, "system"), exist_ok=True)
        ia = os.path.join(path, "system", "install-app.sh")
        if has:
            open(ia, "w").write('#!/bin/bash\necho "install-app $*" >> "$HOME/../calls.log"\n')
            shutil.copy(os.path.join(APP, "system", "drives.sh"), os.path.join(path, "system", "drives.sh"))
        elif os.path.exists(ia):
            os.remove(ia)
        git("add", "-A", cwd=path)
        git("commit", "-q", "-m", v, cwd=path)
        git("tag", "v" + v, cwd=path)


h = tempfile.mkdtemp(prefix="nn-install-neuronet-")
try:
    home = os.path.join(h, "home")
    os.makedirs(home)
    repo = os.path.join(h, "repo")
    make_repo(repo, [("1.0.112", False), ("1.0.113", True)])
    old_repo = os.path.join(h, "old-repo")
    make_repo(old_repo, [("1.0.112", False)])

    bundle = os.path.join(h, "bundle")
    os.makedirs(bundle)
    shutil.copy(SCRIPT, os.path.join(bundle, "install-neuronet.sh"))
    open(os.path.join(bundle, "update_key"), "w").write("-----BEGIN OPENSSH PRIVATE KEY-----\nnot a key\n")
    os.chmod(os.path.join(bundle, "update_key"), 0o644)        # as LocalSend leaves it
    open(os.path.join(bundle, "enable-updates.sh"), "w").write('#!/bin/bash\necho "enable-updates $*" >> "$HOME/../calls.log"\n')

    stub = os.path.join(h, "bin")
    os.makedirs(stub)
    for n, body in (("pacman", ""), ("sudo", 'exec "$@"\n')):
        p = os.path.join(stub, n)
        open(p, "w").write('#!/bin/bash\necho "%s $*" >> "$HOME/../calls.log"\n%s' % (n, body))
        os.chmod(p, 0o755)
    no_drives = os.path.join(h, "no-drives")
    os.makedirs(no_drives)
    # no drive is ever really looked into: stand-in drives (none, unless a test makes some)
    env = dict(os.environ, HOME=home, PATH=stub + ":" + os.environ["PATH"], NEURONET_REPO=repo,
               NEURONET_FAKE_DRIVES=no_drives)
    # every XDG folder is the made-up home's: with Cam's XDG_STATE_HOME left in,
    # the script's "keep the old code" step wrote into his real
    # ~/.local/state/neuronet/previous (2026-10-14)
    for k in ("XDG_CONFIG_HOME", "XDG_STATE_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME"):
        env.pop(k, None)
    log = os.path.join(h, "calls.log")

    def run(*args, repo_=None, more=None):
        e = dict(env)
        if repo_:
            e["NEURONET_REPO"] = repo_
        e.update(more or {})
        open(log, "w").close()
        r = subprocess.run(["bash", os.path.join(bundle, "install-neuronet.sh"), *args],
                           capture_output=True, text=True, env=e, timeout=120)
        return r.returncode, r.stdout + r.stderr, read(log)

    dest = os.path.join(home, "NeuroNet")
    code, out, calls = run("--check")
    ok("--check: finds the newest release, changes nothing",
       code == 0 and "newest release: 1.0.113" in out and not os.path.exists(dest) and calls == "", out + calls)

    code, out, calls = run("--yes")
    ok("install: runs", code == 0, out)
    ok("the newest release is in ~/NeuroNet", read(os.path.join(dest, "VERSION")).strip() == "1.0.113")
    ok("a release copy, not a git checkout (the updater leaves those alone)", not os.path.exists(os.path.join(dest, ".git")))
    ok("installed for this desktop: its own install-app.sh, --yes",
       "install-app --yes" in calls, calls)
    ok("updates switched on: enable-updates.sh with the folder and the key",
       "enable-updates --app %s --key %s --yes" % (dest, os.path.join(bundle, "update_key")) in calls, calls)
    ok("in that order", calls.index("install-app") < calls.index("enable-updates"), calls)
    ok("no software installed (all the tools are here)", "pacman" not in calls, calls)

    open(os.path.join(dest, "neuronet_data_marker"), "w").write("x")
    code, out, calls = run("--yes")
    ok("again: the NeuroNet already there is brought up to date and installed again",
       code == 0 and "1.0.113 -> 1.0.113" in out and "install-app --yes" in calls, out + calls)

    other = os.path.join(home, "Other")
    os.makedirs(other)
    open(os.path.join(other, "something.txt"), "w").write("x")
    code, out, calls = run("--yes", "--app", other)
    ok("a folder that isn't empty is refused", code != 0 and "isn't empty" in out and calls == "", out)

    code, out, calls = run("--yes", "--app", home)
    ok("the home folder itself is refused", code != 0 and "folder of its own" in out, out)

    code, out, calls = run("--yes", "--app", os.path.join(home, "Second"), "--data", os.path.join(h, "drive", "data"))
    ok("--data goes to install-app.sh",
       code == 0 and "install-app --yes --data %s" % os.path.join(h, "drive", "data") in calls, out + calls)

    code, out, calls = run("--yes", "--app", os.path.join(home, "Third"), repo_=old_repo)
    ok("a release from before install-app.sh: refused, says to put out a newer one",
       code != 0 and "Put out a newer release first" in out and not os.path.exists(os.path.join(home, "Third")), out)

    code, out, calls = run("--yes", "--app", os.path.join(home, "Fourth"), repo_=os.path.join(h, "nowhere"))
    ok("GitHub not answering: says so, nothing changed",
       code != 0 and "GitHub didn't answer" in out and not os.path.exists(os.path.join(home, "Fourth")), out)
    # ---- the data drive (Cam's laptop: NeuroNet on a second drive, at /mnt/mydata) ----------
    drives = os.path.join(h, "drives")
    UUID = "11111111-2222-4333-8444-555555555555"
    drive = os.path.join(drives, UUID)
    old = os.path.join(drive, "NeuroNet")
    os.makedirs(os.path.join(old, "neuronet_data", "notes"))
    open(os.path.join(old, "neuronet.py"), "w").write("# NeuroNet 1.0.112\n")
    open(os.path.join(old, "VERSION"), "w").write("1.0.112\n")
    open(os.path.join(old, "neuronet_data", "notes", "mine.md"), "w").write("my note")
    open(os.path.join(old, "library_path.txt"), "w").write("/home/tarumbra/DataDrive/Music")
    open(os.path.join(drive, ".label"), "w").write("mydata")
    home2 = os.path.join(h, "home2")
    os.makedirs(home2)
    fstab = os.path.join(h, "fstab")
    open(fstab, "w").write("UUID=abcd / btrfs defaults 0 0\n")
    byuuid = os.path.join(h, "by-uuid")
    os.makedirs(byuuid)
    open(os.path.join(byuuid, UUID), "w").close()
    oldhome_root = os.path.join(h, "slash-home")       # stands in for /home
    os.makedirs(oldhome_root)
    dmore = {"NEURONET_FAKE_DRIVES": drives, "NEURONET_FSTAB": fstab, "NEURONET_BYUUID": byuuid, "HOME": home2,
             "NEURONET_OLDHOME_ROOT": oldhome_root}
    # KDE had already opened the drive by itself (/run/media/cam/Data on the laptop)
    open(os.path.join(drive, ".automounted"), "w").close()

    code, out, calls = run("--check", more=dmore)
    ok("--check: finds NeuroNet on the drive, would put it at /mnt/mydata, changes nothing",
       code == 0 and "UUID %s" % UUID in out and "it goes at /mnt/mydata" in out
       and "the desktop has it open at" in out
       and "would bring NeuroNet 1.0.112 up to 1.0.113" in out and read(fstab).count("UUID=") == 1, out)

    # the stand-in drive is "connected" where it is: --mount names its own folder
    code, out, calls = run("--yes", "--mount", drive, more=dmore)
    ok("drive: runs", code == 0, out + calls)
    ok("drive: never touches this computer's real state folder",
       not os.path.exists(os.path.expanduser("~/.local/state/neuronet/previous/neuronet.py"))
       or read(os.path.expanduser("~/.local/state/neuronet/previous/neuronet.py")) != "# NeuroNet 1.0.112\n")
    ok("drive: in fstab by its UUID, at its place, nofail",
       ("UUID=%s %s ext4 defaults,nofail 0 2" % (UUID, drive)) in read(fstab), read(fstab))
    ok("drive: ~/DataDrive points to it, as on the old system",
       os.readlink(os.path.join(home2, "DataDrive")) == drive)
    ok("drive: the old user's /home/tarumbra/DataDrive (what library_path.txt remembers) points to it too",
       "your data remembers paths in /home/tarumbra/DataDrive" in out
       and os.readlink(os.path.join(oldhome_root, "tarumbra", "DataDrive")) == drive, out)
    ok("drive: its NeuroNet is brought up to the newest release", read(os.path.join(old, "VERSION")).strip() == "1.0.113")
    ok("drive: the data and library_path.txt untouched",
       read(os.path.join(old, "neuronet_data", "notes", "mine.md")) == "my note"
       and read(os.path.join(old, "library_path.txt")) == "/home/tarumbra/DataDrive/Music")
    ok("drive: the old code kept", read(os.path.join(home2, ".local", "state", "neuronet", "previous", "VERSION")).strip() == "1.0.112")
    ok("drive: that NeuroNet installed and kept up to date (not a new ~/NeuroNet)",
       "install-app --yes" in calls and "enable-updates --app %s " % old in calls
       and not os.path.exists(os.path.join(home2, "NeuroNet")), calls)

    # a drive that remembers where it was (drives.sh save on the old system)
    json_path = os.path.join(old, "neuronet_data", "drives.json")
    open(json_path, "w").write('{"saved": "2026-10-14", "drives": [{"uuid": "%s", "where": "/mnt/Cams_Collective"}]}' % UUID)
    code, out, calls = run("--check", more=dmore)
    ok("a drive that remembers its place goes back there", "it goes at /mnt/Cams_Collective (where it was before)" in out, out)

    # two drives with NeuroNet on them: says which, picks with --drive
    other = os.path.join(drives, "99999999-2222-4333-8444-555555555555", "Stuff", "NeuroNet")
    os.makedirs(other)
    open(os.path.join(other, "neuronet.py"), "w").write("#\n")
    code, out, calls = run("--check", more=dmore)
    ok("two drives with NeuroNet: lists them, asks which", code != 0 and "--drive <UUID>" in out and "Stuff/NeuroNet" in out, out)
    code, out, calls = run("--check", "--drive", UUID, more=dmore)
    ok("--drive picks one", code == 0 and "UUID %s" % UUID in out, out)
    # the laptop's NeuroNet was a git copy from before 1.0.113 (2026-10-14)
    open(os.path.join(old, "VERSION"), "w").write("1.0.100\n")
    os.remove(os.path.join(old, "system", "install-app.sh"))
    git("init", "-q", "-b", "main", cwd=old)
    git("add", "neuronet.py", "VERSION", cwd=old)
    git("commit", "-q", "-m", "laptop", cwd=old)
    code, out, calls = run("--check", "--drive", UUID, more=dmore)
    ok("--check: a git copy on the drive is said, and what would happen to it",
       code == 0 and "it's a git copy: would make it a release copy first" in out, out)
    code, out, calls = run("--yes", "--drive", UUID, "--mount", drive, more=dmore)
    hist = [n for n in os.listdir(drive) if n.startswith("NeuroNet.git-before-")]
    ok("git copy: made a release copy -- its history kept beside it, not inside",
       code == 0 and not os.path.exists(os.path.join(old, ".git")) and len(hist) == 1
       and os.path.isdir(os.path.join(drive, hist[0], "objects")), out)
    ok("git copy: then brought up to date, installed, and updates on",
       read(os.path.join(old, "VERSION")).strip() == "1.0.113" and "install-app --yes" in calls
       and "enable-updates --app %s " % old in calls, out + calls)
    ok("git copy: its data untouched", read(os.path.join(old, "neuronet_data", "notes", "mine.md")) == "my note")
    code, out, calls = run("--yes", "--drive", UUID, "--mount", drive, more=dmore)
    ok("run again on the same drive: the same NeuroNet, its fstab line not doubled",
       code == 0 and "enable-updates --app %s " % old in calls and read(fstab).count("UUID=%s" % UUID) == 1, out)
    code, out, calls = run("--check", "--drive", "none", more=dmore)
    ok("--drive none: a fresh NeuroNet", code == 0 and "not looked for" in out and "would put NeuroNet 1.0.113 in" in out, out)
finally:
    shutil.rmtree(h, ignore_errors=True)

print("\n%d passed, %d failed" % (passed, failed))
raise SystemExit(1 if failed else 0)
