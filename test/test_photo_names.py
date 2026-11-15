"""Photo files named like the photos: the back end's part.

Cam (2026-10-02): "when naming a photo or if it has been named within
Neuronet application please make the name in the file explorer match now."
The real Api, its data folder pointed at a scratch one.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import importlib.util
import json
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


spec = importlib.util.spec_from_file_location("nn", os.path.join(APP, "neuronet.py"))
nn = importlib.util.module_from_spec(spec)
sys.modules["nn"] = nn
spec.loader.exec_module(nn)
tmp = tempfile.mkdtemp(prefix="nn-photo-names-")
nn.data_dir = lambda: tmp
for d in ("photos", "photos_thumbs", "photos_frame", "notes/boards", "family", "kitchen"):
    os.makedirs(os.path.join(tmp, d), exist_ok=True)
api = nn.Api.__new__(nn.Api)

print("\nRenaming a photo's file\n")
open(os.path.join(tmp, "photos", "4df473a1cd9642c090823a3b4fe7ebe7.jpg"), "wb").write(b"jpg")
open(os.path.join(tmp, "photos_thumbs", "4df473a1cd9642c090823a3b4fe7ebe7.thumb.jpg"), "wb").write(b"t")
r = api.photo_rename("4df473a1cd9642c090823a3b4fe7ebe7.jpg", "Dad, Mum and Milly")
ok("the file takes the photo's name (what a file name can't hold left out)",
   r.get("storedName") == "Dad Mum and Milly.jpg" and os.path.isfile(os.path.join(tmp, "photos", "Dad Mum and Milly.jpg")), r)
ok("  and its thumbnail goes with it", os.path.isfile(os.path.join(tmp, "photos_thumbs", "Dad Mum and Milly.thumb.jpg")))
open(os.path.join(tmp, "photos", "aaaa.jpg"), "wb").write(b"jpg2")
r2 = api.photo_rename("aaaa.jpg", "Dad Mum and Milly")
ok("a second photo of the same name is numbered, never written over", r2.get("storedName", "").startswith("Dad Mum and Milly")
   and r2["storedName"] != "Dad Mum and Milly.jpg" and open(os.path.join(tmp, "photos", "Dad Mum and Milly.jpg"), "rb").read() == b"jpg", r2)

print("\nThe files no page holds\n")
json.dump({"items": [{"id": "e1", "coverPhoto": "old1.jpg", "title": "old1.jpg is a title too"}]},
          open(os.path.join(tmp, "personal_effects.json"), "w"))
json.dump({"items": [{"k": "photo", "photo": "old1.jpg"}, {"k": "text", "text": "see old1.jpg"}]},
          open(os.path.join(tmp, "notes", "boards", "B.json"), "w"))
got = api.photo_refs_rename({"old1.jpg": "Rumours.jpg", "same.jpg": "same.jpg"})
pe = json.load(open(os.path.join(tmp, "personal_effects.json")))
bd = json.load(open(os.path.join(tmp, "notes", "boards", "B.json")))
ok("a Media cover follows its photo", pe["items"][0]["coverPhoto"] == "Rumours.jpg")
ok("  and a board's photo", bd["items"][0]["photo"] == "Rumours.jpg", bd)
ok("only a value that IS the old name changes, never text that mentions it",
   pe["items"][0]["title"] == "old1.jpg is a title too" and bd["items"][1]["text"] == "see old1.jpg")
ok("  two changes counted", got == {"changed": 2}, got)
ok("nothing to change, nothing written", api.photo_refs_rename({}) == {"changed": 0})

print("\nBacked up first\n")
json.dump({"photos": [1]}, open(os.path.join(tmp, "neuronet.json"), "w"))
json.dump({"photos": [2]}, open(os.path.join(tmp, "family", "camily.json"), "w"))
b = api.photo_names_backup()
f = b.get("folder", "")
ok("the photo index, the Kitchen's files, Media and the boards are copied before",
   all(os.path.isfile(os.path.join(f, x)) for x in ("neuronet.json", "family/camily.json", "personal_effects.json", "notes/boards/B.json")), f)
ok("  into neuronet_data/backups", f.startswith(os.path.join(tmp, "backups", "photo-names-")))
api.photo_names_backup({"a.jpg": "Beach.jpg"})
ok("and the old -> new list kept beside them, in the same folder",
   json.load(open(os.path.join(f, "renamed.json"))) == {"a.jpg": "Beach.jpg"})
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
