"""journal.py -- Notes -> Journal's store.

Cam: "the journal will act as a place i can write anything ... i should also
have the ability to add photos to journal entries", and Divination's readings
saved there "with the card images".

Runs in a scratch folder; nothing real is touched.
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
import time

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import journal                                         # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nThe journal's store\n")
root = tempfile.mkdtemp(prefix="nn-journal-")
journal.DATA_DIR_PROVIDER = lambda: root
cards = os.path.join(root, "cards_images")
os.makedirs(cards)
try:
    from PIL import Image
    for name, colour in (("fool.jpg", "red"), ("mag.png", "blue"), ("photo.jpg", "green")):
        Image.new("RGB", (2400, 1200), colour).save(os.path.join(cards, name))
    have_pil = True
except ImportError:
    for name in ("fool.jpg", "mag.png", "photo.jpg"):
        open(os.path.join(cards, name), "wb").write(b"\xff\xd8fake")
    have_pil = False

try:
    ok("an empty journal is empty", journal.list_entries() == [])
    ok("an empty entry is refused", "error" in journal.save_entry({"text": "   "}))

    a = journal.save_entry({"date": "2026-09-01", "title": "Lake", "text": "Quiet day."})["entry"]
    b = journal.save_entry({"date": "2026-09-03", "text": "Later day."})["entry"]
    ok("entries are listed newest first",
       [e["id"] for e in journal.list_entries()] == [b["id"], a["id"]])

    name = journal.copy_image(os.path.join(cards, "photo.jpg"), "Beach / trip")
    ok("a photo is copied into the journal under a safe name",
       name and "/" not in name and os.path.isfile(os.path.join(journal.images_dir(), name)), name)
    if have_pil:
        from PIL import Image
        with Image.open(os.path.join(journal.images_dir(), name)) as im:
            ok("  and made smaller", max(im.size) <= journal.JOURNAL_MAX_DIM, im.size)
    a["photos"] = [name]
    a["text"] = "Quiet day. Swam."
    got = journal.save_entry(a)["entry"]
    ok("editing keeps the entry's id and when it was first written",
       got["id"] == a["id"] and got["created"] == a["created"] and got["photos"] == [name])
    ok("a photo's picture comes back as data", (journal.image_url(name) or "").startswith("data:image/"))
    ok("  and as a thumbnail", (journal.image_url(name, thumb=True) or "").startswith("data:image/jpeg"))
    ok("a name that is a path is refused", journal.image_url("../journal.json") is None)

    res = journal.add_reading(
        {"kind": "tarot", "deckName": "Crows", "spreadName": "Two Card",
         "cards": [{"name": "The Fool", "image": "fool.jpg", "reversed": True,
                    "positionLabel": "Past.", "meaning": [["Look ", []], ["first", ["bold"]]]},
                   {"name": "The Magician", "image": "mag.png", "reversed": False}]},
        "Felt right.", "", cards)
    e = res.get("entry") or {}
    ok("a reading becomes an entry, titled by spread and deck",
       e.get("title") == "Two Card · Crows" and e.get("text") == "Felt right.", e.get("title"))
    imgs = [c["image"] for c in (e.get("reading") or {}).get("cards", [])]
    ok("  with its own copies of the card faces",
       all(i and os.path.isfile(os.path.join(journal.images_dir(), i)) for i in imgs), imgs)
    ok("  which way up each card fell", [c["reversed"] for c in e["reading"]["cards"]] == [True, False])
    ok("  and rich-text meanings as plain text", e["reading"]["cards"][0]["meaning"] == "Look first")
    os.remove(os.path.join(cards, "fool.jpg"))
    ok("  so deleting the deck's picture leaves the entry whole",
       os.path.isfile(os.path.join(journal.images_dir(), imgs[0])))

    # Pictures nobody uses are swept away -- but not one added a moment ago.
    stray = journal.copy_image(os.path.join(cards, "photo.jpg"), "stray")
    journal.save_entry({"text": "another"})
    ok("a picture just added is kept while its entry is being written",
       os.path.isfile(os.path.join(journal.images_dir(), stray)))
    old = time.time() - 3 * 86400
    os.utime(os.path.join(journal.images_dir(), stray), (old, old))
    journal.save_entry({"text": "and another"})
    ok("  and swept once nothing uses it", not os.path.exists(os.path.join(journal.images_dir(), stray)))

    ok("deleting an entry deletes its photos",
       journal.delete_entry(a["id"]).get("ok") and not os.path.exists(os.path.join(journal.images_dir(), name)))
    ok("deleting one that is gone says so", "error" in journal.delete_entry("nope"))

    # Divination's old readings, brought in once.
    shutil.copy(os.path.join(cards, "mag.png"), os.path.join(cards, "fool.jpg"))
    celestial = {
        "tarotDecks": [{"id": "d1", "name": "Crows", "cards": [
            {"id": "fool", "name": "The Fool", "image": "fool.jpg", "upright": "Leap",
             "reversed": [["Look first", []]]}]}],
        "tarotReadings": [{"id": "rd-1", "date": "2026-08-22", "deckId": "d1",
                           "spreadName": "One Card", "notes": "Accurate.",
                           "cards": [{"id": "fool", "name": "The Fool", "reversed": True,
                                      "positionLabel": "The card."}]}],
        "oracleReadings": [{"id": "rd-2", "date": "2026-08-09", "deckId": "gone",
                            "deckName": "Old deck", "notes": "", "cards": [{"name": "Hemlock"}]}],
    }
    n = journal.migrate_readings(celestial, cards)
    ok("Divination's readings come into the journal", n == 2, n)
    ok("  only once", journal.migrate_readings(celestial, cards) == 0)
    moved = {e["id"]: e for e in journal.list_entries()}
    m = moved.get("jn-rd-1")
    ok("  with their date, notes and card faces", m and m["date"] == "2026-08-22"
       and m["text"] == "Accurate." and m["reading"]["cards"][0]["image"])
    ok("  and what the card meant the way it fell",
       m and m["reading"]["cards"][0]["meaning"] == "Look first")
    ok("  a reading whose deck is gone still comes in, without a picture",
       moved.get("jn-rd-2") and moved["jn-rd-2"]["reading"]["cards"][0]["image"] is None
       and moved["jn-rd-2"]["reading"]["deckName"] == "Old deck")
    # Mindfulness's old Thought Journal, brought in once.
    thoughts = {"journal": [{"id": "t1", "date": "2026-07-01", "text": "A thought."},
                            {"id": "t2", "date": "2026-07-02", "text": "   "}]}
    ok("Thought Journal entries come into the journal", journal.migrate_thoughts(thoughts) == 1)
    ok("  only once", journal.migrate_thoughts(thoughts) == 0)
    t = {e["id"]: e for e in journal.list_entries()}.get("jn-th-t1")
    ok("  with their date and words", t and t["date"] == "2026-07-01" and t["text"] == "A thought.")
    doc = json.load(open(journal.journal_file()))
    ok("the store is one JSON file", isinstance(doc.get("entries"), list) and doc.get("readingsMigrated"))
finally:
    shutil.rmtree(root, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
