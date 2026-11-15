"""system/drives.sh -- remember the data drives, set them up again on a fresh install.

Cam, 2026-10-14, moving to CachyOS: "can you also make the drives
automatically ...?"

An "old" fstab like Cam's Omarchy one (root, /boot, swap, two data drives
under /mnt), saved; then a "fresh install" fstab with only the system's own
lines, restored into. Which drives are plugged in is a made-up by-uuid folder.
Everything is in a temporary folder: /etc/fstab and the real drives are never
read or written (NEURONET_FSTAB, NEURONET_BYUUID, NEURONET_DRIVES).
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import glob
import json
import os
import shutil
import subprocess
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRIVES = os.path.join(APP, "system", "drives.sh")
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


BIG, SPARE = "2ca8d52f-0000-4000-8000-000000000001", "083a5d32-0000-4000-8000-000000000002"
h = tempfile.mkdtemp(prefix="nn-drives-")
try:
    mnt = os.path.join(h, "mnt")
    big, spare = os.path.join(mnt, "Cams_Collective"), os.path.join(mnt, "Extra")
    SYSTEM = ("UUID=f6235baf-3408-410d-ab03-5240b187dcfb\t/\tbtrfs\trw,subvol=/@\t0 0\n"
              "UUID=3089-4832\t/boot\tvfat\trw,relatime\t0 2\n"
              "/swap/swapfile none swap defaults,pri=0 0 0\n")
    old = os.path.join(h, "fstab.old")
    # the drives are under /mnt on the real computer; here the test's own mnt
    # folder stands in, so the fstab names it -- save only takes /mnt or /media
    open(old, "w").write(SYSTEM + "# a comment\n"
                         "UUID=%s /mnt/Cams_Collective ext4 defaults 0 2\n"
                         "UUID=%s /mnt/Extra ext4 defaults 0 2\n" % (BIG, SPARE))
    data = os.path.join(h, "data")
    os.makedirs(data)
    store = os.path.join(data, "drives.json")
    env = dict(os.environ, NEURONET_FSTAB=old, NEURONET_DRIVES=store,
               NEURONET_BYUUID=os.path.join(h, "by-uuid"))

    def run(*args, fstab=None, stdin=""):
        e = dict(env)
        if fstab:
            e["NEURONET_FSTAB"] = fstab
        r = subprocess.run(["bash", DRIVES, *args], capture_output=True, text=True, env=e, input=stdin, timeout=60)
        return r.returncode, r.stdout + r.stderr

    code, out = run("save")
    ok("save: runs", code == 0, out)
    saved = json.load(open(store))
    ok("save: the two data drives, nothing of the system's",
       [(d["uuid"], d["where"], d["fs"]) for d in saved["drives"]]
       == [(BIG, "/mnt/Cams_Collective", "ext4"), (SPARE, "/mnt/Extra", "ext4")], saved)
    code, out = run("list")
    ok("list: shows them", code == 0 and "/mnt/Extra" in out and BIG in out, out)

    # point the remembered places into the test folder
    for d in saved["drives"]:
        d["where"] = d["where"].replace("/mnt", mnt)
    json.dump(saved, open(store, "w"))

    # ---- the fresh install: only the system's lines; only the big drive plugged in
    new = os.path.join(h, "fstab.new")
    open(new, "w").write(SYSTEM)
    os.makedirs(os.path.join(h, "by-uuid"))
    open(os.path.join(h, "by-uuid", BIG), "w").close()

    code, out = run("restore", "--check", fstab=new)
    ok("restore --check: says, changes nothing",
       code == 0 and "would add" in out and read(new) == SYSTEM and not os.path.exists(big), out)

    code, out = run("restore", "--yes", fstab=new)
    ok("restore: runs", code == 0, out)
    text = read(new)
    ok("restore: the big drive is added, by UUID, with nofail",
       ("UUID=%s %s ext4 defaults,nofail 0 2\n" % (BIG, big)) in text and text.startswith(SYSTEM), text)
    ok("restore: a drive that isn't plugged in is skipped, and said",
       SPARE not in text and "isn't plugged in" in out, out)
    ok("restore: its folder is made", os.path.isdir(big))
    ok("restore: fstab backed up", len(glob.glob(new + ".bak.*")) == 1)

    # ---- again, with the spare plugged in now: only it is added
    open(os.path.join(h, "by-uuid", SPARE), "w").close()
    code, out = run("restore", "--yes", fstab=new)
    text2 = read(new)
    ok("again: the big drive isn't added twice; the spare is now",
       code == 0 and text2.count(BIG) == 1 and text2.count(SPARE) == 1 and "already in" in out, out + text2)
    code, out = run("restore", "--yes", fstab=new)
    ok("a third time: nothing changes, no new backup",
       code == 0 and read(new) == text2 and len(glob.glob(new + ".bak.*")) == 2, out)

    # ---- a place with a space is written as fstab wants (\040)
    saved["drives"].append({"uuid": "aaaa-bbbb", "where": os.path.join(mnt, "My Drive"), "fs": "ext4",
                            "options": "defaults,nofail", "label": "", "size": "1T", "owner": None})
    json.dump(saved, open(store, "w"))
    open(os.path.join(h, "by-uuid", "aaaa-bbbb"), "w").close()
    code, out = run("restore", "--yes", fstab=new)
    ok("a space in the place is \\040, and nofail isn't doubled",
       ("UUID=aaaa-bbbb %s ext4 defaults,nofail 0 2" % os.path.join(mnt, "My\\040Drive")) in read(new)
       and os.path.isdir(os.path.join(mnt, "My Drive")), read(new))
finally:
    shutil.rmtree(h, ignore_errors=True)

print("\n%d passed, %d failed" % (passed, failed))
raise SystemExit(1 if failed else 0)
