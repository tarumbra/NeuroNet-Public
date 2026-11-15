#!/usr/bin/env python3
"""NeuroNet's backend: where the data lives, and the media server.

Two things are being held to account here, and they are the two that
would cost Cam real data or real privacy.

THE DATA FOLDER MUST NOT BE INSIDE THE APP. Cam updates an app by
replacing its folder. Every file the app writes on first run therefore
has to land somewhere else, or updating the app deletes the photos, the
music and the saved games. KinCrux learned this with the recipe folder,
which the first build quietly created inside the app.

THE MEDIA SERVER OPENS A REAL SOCKET. It is the only part of either app
that listens on a port, so it gets tested like one: bound to loopback
only, a token that is actually required, no traversal out of music/, and
byte ranges that return the right bytes rather than merely a 206.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os
import shutil
import sys
import tempfile
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
sys.path.insert(0, os.path.join(APP, "crux", "py"))

import neuronet                                         # noqa: E402

PASS = 0
FAIL = 0
LINES = []


def ok(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        LINES.append("  ok    " + name)
    else:
        FAIL += 1
        LINES.append("  FAIL  " + name
                     + ("\n          " + str(detail) if detail else ""))


def scene():
    """A fresh install: an app folder with nothing beside it."""
    root = tempfile.mkdtemp(prefix="neuronet-")
    app = os.path.join(root, "NeuroNet")
    os.makedirs(app)
    # a real install has its neuronet.py: data_dir() only ever moves a library into a NeuroNet folder (2026-10-15)
    open(os.path.join(app, "neuronet.py"), "w").write("# the app\n")
    neuronet.app_dir = lambda: app
    neuronet.crux_paths.app_dir = lambda: app
    neuronet._resolved_root = None
    return root, app


# ---- where the data lives ---------------------------------------------
# Cam: "please move all the neuronet data to within the neuronet app
# folder so it lives together". These checks used to assert the opposite --
# that the folder sat BESIDE the app, so replacing the app could not delete
# it. That protection now lives in package.sh (which never ships the data)
# and in the README's update instructions, not in where the folder sits.
root, app = scene()
try:
    where = neuronet.data_dir()
    ok("a fresh install puts the data folder inside the app folder",
       os.path.abspath(where) == os.path.abspath(os.path.join(app, "neuronet_data")),
       where)
    ok("and creates nothing beside the app",
       not os.path.isdir(os.path.join(root, "neuronet_data")),
       sorted(os.listdir(root)))
finally:
    shutil.rmtree(root, ignore_errors=True)


# A folder that actually holds the library beats one that merely exists.
# Without this, one launch before the data was copied in leaves an empty
# folder that shadows the real one for good, and the app opens empty --
# which reads exactly like having lost everything.
root, app = scene()
try:
    real = os.path.join(root, "neuronet_data")
    os.makedirs(real)
    # Distinctive contents, so the check is about WHICH library opens rather
    # than where it happens to be: under the new layout the real one is
    # moved inside, so its path changes but it must still be the real one.
    open(os.path.join(real, "neuronet.json"), "w").write('{"marker": "the real library"}')
    empty = os.path.join(app, "neuronet_data")
    os.makedirs(empty)
    neuronet._resolved_root = None
    opened = neuronet.data_dir()
    got = open(os.path.join(opened, "neuronet.json")).read() \
        if os.path.isfile(os.path.join(opened, "neuronet.json")) else ""
    ok("a folder holding the library beats an empty one nearer the app",
       "the real library" in got, "opened %s holding %r" % (opened, got[:60]))
    ok("and it was moved in, not copied -- no second copy is left beside the app",
       not os.path.exists(real), sorted(os.listdir(root)))
finally:
    shutil.rmtree(root, ignore_errors=True)


# ---- the backend method names are the contract ------------------------
root, app = scene()
try:
    api = neuronet.Api()
    names = [n for n in dir(api) if not n.startswith("_")]

    # Cranium shipped get_data/save_data and pywebview puts every method
    # in ONE flat namespace, so a generic name here is a module silently
    # overwriting another module's file later.
    for generic in ("get_data", "save_data", "read_json", "write_json",
                    "save_image", "image_url", "thumb_url"):
        ok("no method is called %s -- too generic to share a namespace"
           % generic, generic not in names, names)

    for expected in ("photo_get_data", "photo_save_data", "photo_rename",
                     "photo_store", "photo_thumb", "photo_full",
                     "photo_delete", "library_info", "open_print_document"):
        ok("  %s is there" % expected, expected in names, names)

    doc = api.photo_get_data()
    ok("an empty library still has the full shape",
       sorted(doc) == ["albums", "folders", "photoTagList", "photos"],
       sorted(doc))

    # a key a future build adds must survive a save by this one
    neuronet.atomic_write_json(neuronet.data_file(),
                                {"photos": [], "somethingNew": [1, 2]})
    api.photo_save_data({"photos": [], "albums": [], "folders": [],
                         "photoTagList": []})
    after = neuronet.read_json(neuronet.data_file(), {})
    ok("saving does not delete a key this build doesn't know about",
       after.get("somethingNew") == [1, 2], sorted(after))
finally:
    shutil.rmtree(root, ignore_errors=True)


# ---- renaming a photo moves the file, the thumb and the frame ---------
root, app = scene()
try:
    api = neuronet.Api()
    stored = "71b0070c869646a4b7882dfa0877ff95.jpg"
    open(os.path.join(neuronet.photos_dir(), stored), "wb").write(b"PHOTO")
    open(os.path.join(neuronet.thumbs_dir(),
                      neuronet._thumb_name(stored)), "wb").write(b"THUMB")
    open(os.path.join(neuronet.frames_dir(),
                      neuronet._frame_name(stored)), "wb").write(b"FRAME")

    res = api.photo_rename(stored, "The Fool")
    new = res.get("storedName")
    ok("renaming gives the file the name Cam typed",
       new and new.startswith("The Fool"), res)
    ok("  the old file is gone",
       not os.path.isfile(os.path.join(neuronet.photos_dir(), stored)), "")
    ok("  the THUMBNAIL followed it",
       os.path.isfile(os.path.join(neuronet.thumbs_dir(),
                                   neuronet._thumb_name(new))),
       "a thumbnail left behind fills the library with blank tiles")
    ok("  and the frame copy followed it",
       os.path.isfile(os.path.join(neuronet.frames_dir(),
                                   neuronet._frame_name(new))), "")

    # A name that looks like a path is CONTAINED, not refused. Refusing
    # would be wrong for Cam: typing a slash in a photo name is a typo,
    # not an attack, and an error message helps nobody. What must never
    # happen is the file landing outside photos_dir.
    for attempt in ("../../etc/passwd", "/etc/passwd", "..\\..\\win"):
        res = api.photo_rename(new, attempt)
        landed = res.get("storedName", "")
        ok("  \"%s\" is contained, not turned into a path" % attempt,
           landed and os.path.basename(landed) == landed
           and ".." not in landed and "/" not in landed
           and os.path.isfile(os.path.join(neuronet.photos_dir(), landed)),
           res)
        new = landed or new
finally:
    shutil.rmtree(root, ignore_errors=True)


# ---- the media server -------------------------------------------------
root, app = scene()
try:
    payload = bytes(range(256)) * 400              # 102,400 bytes
    open(os.path.join(neuronet.music_dir(), "song.mp3"), "wb").write(payload)

    info = neuronet.ensure_media_server()
    ok("the media server starts and reports a port", bool(info["port"]), info)
    ok("it is bound to loopback, never to the network",
       neuronet._MEDIA_SERVER["httpd"].server_address[0] == "127.0.0.1",
       neuronet._MEDIA_SERVER["httpd"].server_address)
    ok("and every URL carries a per-session token",
       len(info["token"]) >= 16, len(info["token"]))

    url = neuronet.media_url_for("music", "song.mp3")
    ok("the token is in the path, not guessable from the filename",
       info["token"] in url and "song.mp3" in url, url)

    req = urllib.request.Request(url, headers={"Range": "bytes=100-199"})
    with urllib.request.urlopen(req) as r:
        body = r.read()
        ok("a byte range comes back as a 206", r.status == 206, r.status)
        ok("  with the right Content-Range",
           r.headers.get("Content-Range") == "bytes 100-199/102400",
           r.headers.get("Content-Range"))
        # 206 with the wrong bytes would make every seek land elsewhere
        ok("  and the bytes are ACTUALLY the ones asked for",
           body == payload[100:200], "%d bytes" % len(body))
        ok("  Accept-Ranges is advertised, or the player won't seek at all",
           r.headers.get("Accept-Ranges") == "bytes",
           r.headers.get("Accept-Ranges"))

    def status_of(u, headers=None):
        try:
            with urllib.request.urlopen(
                    urllib.request.Request(u, headers=headers or {})) as r:
                return r.status
        except urllib.error.HTTPError as e:
            return e.code
        except Exception as e:                       # noqa: BLE001
            return type(e).__name__

    bad = url.replace(info["token"], "x" * len(info["token"]))
    ok("a wrong token is refused", status_of(bad) == 403, status_of(bad))

    base = "http://127.0.0.1:%d/media/%s/music/" % (info["port"], info["token"])
    for label, name in (("traversal", "..%2F..%2Fneuronet.json"),
                        ("an absolute path", "%2Fetc%2Fpasswd"),
                        ("a non-audio file", "neuronet.json")):
        code = status_of(base + name)
        ok("  %s is refused" % label, code == 404, code)

    # nothing here may ever write
    def method_status(u, method):
        try:
            req = urllib.request.Request(u, method=method, data=b"")
            with urllib.request.urlopen(req) as r:
                return r.status
        except urllib.error.HTTPError as e:
            return e.code
        except Exception as e:                       # noqa: BLE001
            return type(e).__name__

    for method in ("POST", "PUT", "DELETE"):
        code = method_status(url, method)
        ok("  %s is not served -- this server only ever reads" % method,
           code == 501, code)

    ok("a range past the end is a 416, not a crash",
       status_of(url, {"Range": "bytes=999999-1000000"}) == 416,
       status_of(url, {"Range": "bytes=999999-1000000"}))
finally:
    neuronet.stop_media_server()
    shutil.rmtree(root, ignore_errors=True)



# ---- meditation: Cam's own guided audio and video ---------------------
# Cam: "i want to be able to upload my video and soundtrack guides for
# meditation."
#
# The thing worth guarding is ONE SERVER. Chords brought a loopback
# media server for music and Celestial brought an identical one for
# meditations; two of them in one process, on two ports, for the same
# reason, is exactly the duplication this merge exists to remove. So the
# URL now carries which folder it wants, and that folder is looked up in
# a fixed dict rather than joined -- which is what the refusals below
# are checking.
root, app = scene()
try:
    import types
    fake = types.ModuleType("webview")
    fake.OPEN_DIALOG = 10
    fake.FOLDER = 20
    sys.modules["webview"] = fake

    api = neuronet.Api()
    src = tempfile.mkdtemp(prefix="picked-")
    video = os.path.join(src, "Body Scan.mp4")
    audio = os.path.join(src, "Ocean.mp3")
    other = os.path.join(src, "notes.txt")
    open(video, "wb").write(bytes(range(256)) * 500)
    open(audio, "wb").write(bytes(range(256)) * 300)
    open(other, "w").write("not media")

    class FakeWindow:
        def create_file_dialog(self, *a, **k):
            return [video, audio, other]

    api._window = FakeWindow()
    res = api.meditation_import()

    added = {e["file"]: e["kind"] for e in res["added"]}
    ok("a guided VIDEO can be uploaded",
       added.get("Body Scan.mp4") == "video", res)
    ok("and a soundtrack",
       added.get("Ocean.mp3") == "audio", res)
    ok("  something that is neither is skipped, with a reason",
       len(res["skipped"]) == 1 and res["skipped"][0]["why"],
       res["skipped"])

    # The import must COPY, never read the file into the page. A guided
    # video runs to hundreds of megabytes; across the JS bridge that
    # costs several times its size in memory for nothing.
    ok("  the file is copied on disk, and the original left alone",
       os.path.isfile(os.path.join(neuronet.meditation_dir(), "Body Scan.mp4"))
       and os.path.isfile(video), "")

    listed = {f["name"]: f for f in api.meditation_list()}
    ok("both show up in the list with their kind and size",
       listed["Body Scan.mp4"]["kind"] == "video"
       and listed["Ocean.mp3"]["size"] > 0, listed)

    # a second import of the same name must not overwrite the first
    api._window = FakeWindow()
    api.meditation_import()
    names = [f["name"] for f in api.meditation_list()]
    ok("importing the same name twice keeps both, rather than overwriting",
       "Body Scan-2.mp4" in names, names)

    for name, kind, mime in (("Body Scan.mp4", "video", "video/mp4"),
                             ("Ocean.mp3", "audio", "audio/mpeg")):
        got = api.meditation_media_url(name)
        ok("%s gets a streaming URL" % name,
           got.get("streamed") and got.get("kind") == kind, got)
        req = urllib.request.Request(got["url"], headers={"Range": "bytes=50-149"})
        with urllib.request.urlopen(req) as r:
            body = r.read()
            want = open(os.path.join(neuronet.meditation_dir(), name), "rb"
                        ).read()[50:150]
            ok("  it streams a real byte range, correctly",
               r.status == 206 and body == want, r.status)
            ok("  and says what it is, so <video> vs <audio> is right",
               r.headers.get("Content-Type") == mime,
               r.headers.get("Content-Type"))

    # ONE server for both libraries
    open(os.path.join(neuronet.music_dir(), "song.mp3"), "wb").write(b"M" * 900)
    music = api.chords_audio_url("song.mp3")
    ok("music and meditation are served by ONE media server, on one port",
       "/media/" in music["url"] and neuronet._MEDIA_SERVER["port"],
       "two servers for the same job is the duplication being removed")

    tok = neuronet._MEDIA_SERVER["token"]
    base = "http://127.0.0.1:%d/media/%s/" % (neuronet._MEDIA_SERVER["port"], tok)

    def status(u):
        try:
            with urllib.request.urlopen(u) as r:
                return r.status
        except urllib.error.HTTPError as e:
            return e.code
        except Exception as e:                       # noqa: BLE001
            return type(e).__name__

    for label, path in (
            ("a folder that isn't served", "secrets/Ocean.mp3"),
            ("traversal out of it", "meditation/..%2F..%2Fneuronet.json"),
            ("the right name in the wrong folder", "music/Ocean.mp3"),
            ("a file that isn't media", "meditation/notes.txt")):
        ok("  %s is refused" % label, status(base + path) == 404,
           status(base + path))

    # Removing from the list must not be able to destroy Cam's only copy.
    api.meditation_remove("Ocean.mp3")
    ok("removing an entry does NOT delete the file by default",
       os.path.isfile(os.path.join(neuronet.meditation_dir(), "Ocean.mp3")),
       "these may be his only copy")
    api.meditation_remove("Ocean.mp3", True)
    ok("  and deletes it only when asked outright",
       not os.path.isfile(os.path.join(neuronet.meditation_dir(), "Ocean.mp3")),
       "")
    shutil.rmtree(src, ignore_errors=True)
finally:
    neuronet.stop_media_server()
    shutil.rmtree(root, ignore_errors=True)


print("\nNeuroNet's backend\n")
for line in LINES:
    print(line)
print("\n  %d passed, %d failed\n" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
