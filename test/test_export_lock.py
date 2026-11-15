"""A password on the export (NeuroNet System plan, Stage 3, 2026-09-29).

Cam asked for the new-machine export to be password protected "if possible":
it holds the journal, the money and the contacts, and travels over LocalSend
or on a stick. data_transfer.export_locked / peek_encrypted / import_locked.

All in temporary folders; nothing of NeuroNet's real data is touched.
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
import data_transfer as dt  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def put(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


root = tempfile.mkdtemp(prefix="nn-lock-")
try:
    src = os.path.join(root, "old")
    put(os.path.join(src, "neuronet.json"), b'{"photos": []}')
    put(os.path.join(src, "journal", "journal.json"), b'{"entries": ["private thoughts"]}')
    put(os.path.join(src, "cards", "images", "fool.png"), os.urandom(3 * 1024 * 1024 + 17))   # > 3 pieces
    put(os.path.join(src, "chords", "music", "song.flac"), b"music stays behind")
    areas = [{"key": "neuronet", "label": "NeuroNet", "path": src}]
    dest = os.path.join(root, "export" + dt.ENC_EXT)

    res = dt.export_locked(areas, dest, "correct horse")
    ok("a locked export is written", res.get("ok") and res.get("locked") and os.path.isfile(dest), res)
    ok("  and nothing unlocked is left beside it",
       sorted(os.listdir(root)) == ["export.nnx", "old"], os.listdir(root))
    raw = open(dest, "rb").read()
    ok("  it starts as a locked NeuroNet export", dt.is_encrypted(dest) and raw.startswith(dt.ENC_MAGIC))
    ok("  and none of what's in it can be read without the password",
       b"private thoughts" not in raw and b"neuronet-export" not in raw and b"journal" not in raw)

    m = dt.peek_encrypted(dest, "correct horse")
    ok("the password shows what's in it, without unlocking it all",
       m.get("format") == dt.FORMAT and m.get("files") == 3, m)
    ok("  music still left behind", any("music" in x["why"] for x in m.get("left_out", [])), m.get("left_out"))
    try:
        dt.peek_encrypted(dest, "wrong")
        ok("a wrong password is refused", False, "no error")
    except dt.WrongPassword:
        ok("a wrong password is refused", True)

    new = os.path.join(root, "new")
    work = os.path.join(new, ".import-work")
    areas_new = [{"key": "neuronet", "label": "NeuroNet", "path": new}]
    r = dt.import_locked(dest, "wrong", areas_new, os.path.join(new, "import-backups"), work)
    ok("importing with a wrong password says so, and writes nothing",
       r.get("error") == "That password doesn't open this export."
       and not os.path.exists(os.path.join(new, "journal")), r)
    r = dt.import_locked(dest, "correct horse", areas_new, os.path.join(new, "import-backups"), work)
    same = all(open(os.path.join(src, p), "rb").read() == open(os.path.join(new, p), "rb").read()
               for p in ("neuronet.json", "journal/journal.json", "cards/images/fool.png"))
    ok("the right password brings everything across, byte for byte", r.get("ok") and r.get("written") == 3 and same, r)
    ok("  and the unlocked copy is gone afterwards", os.listdir(work) == [], os.listdir(work))

    # damage: one byte changed in the middle
    bad = os.path.join(root, "bad.nnx")
    b = bytearray(raw)
    b[len(b) // 2] ^= 0x01
    open(bad, "wb").write(bytes(b))
    try:
        dt.decrypt_file(bad, os.path.join(root, "x.zip"), "correct horse")
        ok("a changed byte is caught", False, "decrypted")
    except ValueError as e:
        ok("a changed byte is caught", "damaged" in str(e), e)
    # cut short: the last piece missing
    short = os.path.join(root, "short.nnx")
    open(short, "wb").write(raw[: len(raw) - 2 * 1024 * 1024])
    try:
        dt.decrypt_file(short, os.path.join(root, "y.zip"), "correct horse")
        ok("an export cut short is caught", False, "decrypted")
    except ValueError as e:
        ok("an export cut short is caught", "cut short" in str(e) or "damaged" in str(e), e)
    ok("a plain .zip export still works as before",
       dt.export(areas, os.path.join(root, "plain.zip")).get("ok")
       and dt.read_manifest(os.path.join(root, "plain.zip")).get("ok")
       and not dt.is_encrypted(os.path.join(root, "plain.zip")))
    ok("the import's work folder is never exported", dt.left_out(".import-work/unlocked-1.zip") is not None)
finally:
    shutil.rmtree(root, ignore_errors=True)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
