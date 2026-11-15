"""Media: Music's albums on the shelf as CDs, and covers that come from Photos.

Cam (2026-10-02): "Albums added to Albums in music sub main section should ask
if we want to add them to shelf, then they auto add including the songs" --
and every album already there added now. "Need to have cover allocation for
media items handled in the add media menu not the shelf. Plus the handling of
images should be with in built photos app."

The real Api with its data, Music and Photos folders pointed at a scratch one.
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
import media_shelf as ms  # noqa: E402
from PIL import Image  # noqa: E402

tmp = tempfile.mkdtemp(prefix="nn-media-albums-")
images = os.path.join(tmp, "chords", "images")
photos = os.path.join(tmp, "photos")
os.makedirs(images)
os.makedirs(photos)
nn.data_dir = lambda: tmp
nn.chords_file = lambda: os.path.join(tmp, "chords", "chords.json")
nn.music_images_dir = lambda: images
nn.photos_dir = lambda: photos
nn._log_line = lambda m: None


class Fake(nn.Api):
    def __init__(self):
        pass

    def effects_file(self):
        return os.path.join(tmp, "personal_effects.json")

    def _media_movies_root(self):
        return os.path.join(tmp, "Movies")      # never Cam's real films


Image.new("RGB", (600, 600), (200, 30, 30)).save(os.path.join(images, "album_Rumours.jpg"))
Image.new("RGB", (900, 1200), (30, 30, 200)).save(os.path.join(photos, "abc123.jpg"))
chords = {
    "tracks": {
        "a1.flac": {"title": "Dreams", "artist": "Fleetwood Mac"},
        "a2.flac": {"title": "Go Your Own Way", "artist": "Fleetwood Mac"},
        "b1.mp3": {"title": "Winning Streak", "artist": "Jelly Roll"},
    },
    "albums": [
        {"id": "al1", "name": "Rumours", "artist": "", "year": "1977", "art": "album_Rumours.jpg",
         "files": ["a1.flac", "a2.flac"]},
        {"id": "al2", "name": "Beautifully Broken", "artist": "", "art": "", "files": ["b1.mp3"]},
        {"id": "al3", "name": "Mixed Bag", "artist": "Various", "files": []},
    ],
}
json.dump(chords, open(nn.chords_file(), "w"))
mine = {"items": [
    {"id": "e1", "type": "cd", "title": "beautifully broken", "creator": "", "year": "", "notes": "signed copy"},
    {"id": "e2", "type": "dvd", "title": "Rumours", "creator": "", "year": "", "notes": ""},
], "types": []}
json.dump(mine, open(Fake().effects_file(), "w"))

print("\nEvery album onto the shelf, once\n")
api = Fake()
doc = api.effects_load()
# Media v2 (15 Nov 2026): a CD is a music item tagged CD.
cds = [x for x in doc["items"] if x.get("type") == "music" and "CD" in (x.get("formats") or [])]
by_album = {x.get("albumId"): x for x in cds}
ok("each album is a CD now", set(by_album) == {"al1", "al2", "al3"}, [(x["title"], x.get("albumId")) for x in cds])
ok("  a CD Cam already had (same title, any case) is linked, not doubled -- his notes kept",
   by_album["al2"]["id"] == "e1" and by_album["al2"]["notes"] == "signed copy" and len(cds) == 3)
ok("  its artist filled in from the songs, as Music shows it", by_album["al2"]["creator"] == "Jelly Roll")
ok("  a DVD of the same name is a different thing, left alone",
   any(x["id"] == "e2" and x["type"] == "film" and x.get("formats") == ["DVD"] and not x.get("albumId") for x in doc["items"]))
r = by_album["al1"]
ok("a new CD has the album's name, artist and year", (r["title"], r["creator"], r["year"]) == ("Rumours", "Fleetwood Mac", "1977"), r)
ok("  and the album's cover", os.path.isfile(ms.cover_path(tmp, r["id"])) and r.get("cover"))
ok("  an album with no cover just has none", not os.path.isfile(ms.cover_path(tmp, by_album["al3"]["id"])))
ok("  and its songs aren't copied: they're read from the album (by albumId)", "tracks" not in r and r["albumId"] == "al1")
disk = json.load(open(api.effects_file()))
ok("it's saved, with the flag that it's been done", disk.get("albumsOnShelf") and len(disk["items"]) == 4)
ok("  and the file as it was is kept beside it",
   json.load(open(api.effects_file() + ".before-albums-onto-shelf")) == mine)

again = api.effects_load()
ok("loading again adds nothing", len(again["items"]) == 4)
# the page saves only items and types -- the flag must survive that
page = {"items": [x for x in again["items"] if x.get("albumId") != "al3"], "types": []}
api.effects_save(page)
after = api.effects_load()
ok("a save from the page keeps the flag", json.load(open(api.effects_file())).get("albumsOnShelf"))
ok("  so an album taken off the shelf stays off", not any(x.get("albumId") == "al3" for x in after["items"]))
json.dump({"albums": []}, open(nn.chords_file(), "w"))
os.remove(api.effects_file())
ok("no file and no albums: an empty list, nothing written",
   api.effects_load() == {"items": [], "types": []} and not os.path.exists(api.effects_file()))

print("\nCovers from Photos\n")
got = api.media_cover_from_photo("e1", "abc123.jpg")
ok("a photo in the library becomes the cover", got.get("ok") and os.path.isfile(ms.cover_path(tmp, "e1")), got)
with Image.open(ms.cover_path(tmp, "e1")) as im:
    ok("  as the shelf's own small copy", max(im.size) == ms.COVER_EDGE, im.size)
ok("  the photo itself is left in Photos", os.path.isfile(os.path.join(photos, "abc123.jpg")))
ok("a photo that isn't there says so", "error" in api.media_cover_from_photo("e1", "gone.jpg"))
ok("  and a path can't reach outside Photos", "error" in api.media_cover_from_photo("e1", "../chords/images/album_Rumours.jpg"))
ok("an album's cover can be the cover", api.media_cover_from_album("e2", "album_Rumours.jpg").get("ok"))
ok("the old cover's file is found, to move it into Photos", api.media_cover_file("e1") == ms.cover_path(tmp, "e1")
   and api.media_cover_file("nope") == "")


class Run:
    def __init__(self):
        self.calls = []

    def __call__(self, cmd, **kw):
        self.calls.append(cmd)
        out = b"100.0" if cmd[0] == "ffprobe" else b"\xff\xd8fakejpeg\xff\xd9"
        return type("R", (), {"stdout": out, "returncode": 0})()


run = Run()
film = os.path.join(tmp, "The Film (1999).mkv")
open(film, "w").close()
st = ms.film_still(film, tmp, runner=run)
ok("a still from the film is written as a full-size picture for Photos",
   os.path.isfile(st.get("path", "")) and "min(1920,iw)" in " ".join(run.calls[-1]), (st, run.calls[-1:]))

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
