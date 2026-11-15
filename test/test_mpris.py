"""NeuroNet on the Linux media bus -- the bus half (mpris.py).

Cam: "yes build option 1 with a bar widget". NeuroNet announces itself as
an MPRIS player so Omarchy's audio panel, the media keys and the NeuroNet
bar widget can see and drive it. This checks, on a PRIVATE session bus
(dbus-run-session) so a running NeuroNet is never disturbed:

  - what the page reports comes out as proper MPRIS properties, with the
    cover as a file:// URL and the position moving on while playing;
  - every method becomes the right SS.Music.remote(...) call, and a
    command sent before the page is ready waits for it;
  - OpenUri takes neuronet:album/<id> and neuronet:playlist/<id> only.

test_mpris.js checks the page half.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import os
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import mpris                                            # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


# Re-run inside a private bus, once.
if not os.environ.get("NN_MPRIS_PRIVATE_BUS"):
    env = dict(os.environ, NN_MPRIS_PRIVATE_BUS="1")
    r = subprocess.run(["dbus-run-session", "--", sys.executable, __file__],
                       env=env)
    sys.exit(r.returncode)

print("\nThe pure parts\n")
ok("repeat modes map to MPRIS loop states and back",
   mpris.LOOP_OF == {"off": "None", "one": "Track", "all": "Playlist"}
   and all(mpris.REPEAT_OF[v] == k for k, v in mpris.LOOP_OF.items()))
ok("a track id is a valid D-Bus path even for an awkward file name",
   mpris.track_id("Jelly Roll - 05. When The Drugs Don_t Work.mp3")
   .replace("/", "").replace("_", "").isalnum())
ok("  and no track is MPRIS's NoTrack", mpris.track_id("") == mpris.NO_TRACK)
ok("OpenUri: album and playlist, ids unquoted",
   mpris.parse_open_uri("neuronet:album/al%201") == ("album", "al 1")
   and mpris.parse_open_uri("neuronet://playlist/p1") == ("playlist", "p1"))
ok("  anything else refused",
   all(mpris.parse_open_uri(u) is None for u in
       ["http://x", "neuronet:song/x", "neuronet:album/", None, "file:///a"]))
d = tempfile.mkdtemp(prefix="nn-mpris-")
open(os.path.join(d, "c.jpg"), "wb").write(b"x")
ok("cover -> file:// URL only for a bare name that exists",
   mpris.art_url(d, "c.jpg").startswith("file://")
   and mpris.art_url(d, "../c.jpg") == "" and mpris.art_url(d, "none.jpg") == "")
ok("bad numbers from the page are made safe",
   mpris.normalize_state({"length": "nan", "position": -3, "status": "x"})
   == {**mpris.normalize_state({}), "status": "Stopped"})

print("\nOn the bus\n")
calls = []
m = mpris.Mpris(calls.append, lambda: calls.append("RAISE"), d)
ok("claims org.mpris.MediaPlayer2.neuronet", m.start(), m.error)

DEST = ["--session", "--dest", mpris.BUS_NAME, "--object-path", mpris.OBJECT_PATH]


def call(method, *args):
    r = subprocess.run(["gdbus", "call", *DEST, "--method", method, *args],
                       capture_output=True, text=True, timeout=10)
    return (r.stdout + r.stderr).strip()


def prop(name, iface=mpris.PLAYER_IFACE):
    return call("org.freedesktop.DBus.Properties.Get", iface, name)


def js():
    time.sleep(0.3)
    out = list(calls)
    calls.clear()
    return out


call("org.mpris.MediaPlayer2.Player.Play")
ok("a command before the page is ready waits", js() == [])
m.update({"status": "Playing", "file": "a.mp3", "title": "Winning Streak",
          "artist": "Jelly Roll", "album": "Beautifully Broken", "art": "c.jpg",
          "length": 200, "position": 10, "volume": 0.5, "shuffle": True,
          "repeat": "all"})
ok("  and is sent once the page reports", any('remote("play"' in c for c in js()))

md = prop("Metadata")
ok("Metadata carries the track", all(s in md for s in
   ["'Winning Streak'", "['Jelly Roll']", "'Beautifully Broken'",
    "int64 200000000", "file://" + d]), md)
ok("  a song not ♥'d: userRating 0", "'xesam:userRating': <0.0>" in md, md)
m.update({**m._state, "favourite": True})
ok("♥ (chords.js setFavourite): userRating 1 on the bus, for the desktop and bar widgets",
   "'xesam:userRating': <1.0>" in prop("Metadata"))
ok("  a change to the ♥ alone is news (Metadata changed)", mpris.normalize_state({"favourite": True})["favourite"] is True
   and '"favourite")):' in open(mpris.__file__, encoding="utf-8").read())
m.update({**m._state, "favourite": False})
ok("Identity is NeuroNet",
   "NeuroNet" in prop("Identity", mpris.ROOT_IFACE))
ok("status, loop, shuffle, volume",
   "'Playing'" in prop("PlaybackStatus") and "'Playlist'" in prop("LoopStatus")
   and "true" in prop("Shuffle") and "0.5" in prop("Volume"))
p1 = int(prop("Position").split()[-1].rstrip(",)>"))
time.sleep(0.5)
p2 = int(prop("Position").split()[-1].rstrip(",)>"))
ok("the position moves on while playing, without the page re-reporting",
   10_000_000 <= p1 < p2, (p1, p2))
m.update({**m._state, "status": "Paused", "position": 42})
p3 = int(prop("Position").split()[-1].rstrip(",)>"))
time.sleep(0.3)
ok("  and holds still while paused",
   p3 == int(prop("Position").split()[-1].rstrip(",)>")) == 42_000_000, p3)

for method, want in [("Next", '"next"'), ("Previous", '"prev"'),
                     ("PlayPause", '"playpause"'), ("Pause", '"pause"'),
                     ("Stop", '"stop"')]:
    call("org.mpris.MediaPlayer2.Player." + method)
    got = js()
    ok(f"{method} -> SS.Music.remote({want})",
       len(got) == 1 and f"remote({want}" in got[0], got)

call("org.mpris.MediaPlayer2.Player.Seek", "5000000")
got = js()
ok("Seek is relative to where the track is now",
   got and 'remote("seekTo", 47' in got[0], got)
call("org.mpris.MediaPlayer2.Player.SetPosition", mpris.track_id("a.mp3"), "30000000")
ok("SetPosition on the current track", 'remote("seekTo", 30' in "".join(js()))
call("org.mpris.MediaPlayer2.Player.SetPosition", mpris.track_id("other.mp3"), "1")
ok("  but not on a stale track id (the spec says ignore it)", js() == [])

call("org.freedesktop.DBus.Properties.Set", mpris.PLAYER_IFACE, "LoopStatus", "<'Track'>")
call("org.freedesktop.DBus.Properties.Set", mpris.PLAYER_IFACE, "Shuffle", "<false>")
call("org.freedesktop.DBus.Properties.Set", mpris.PLAYER_IFACE, "Volume", "<0.25>")
got = "".join(js())
ok("setting loop, shuffle and volume goes to the page",
   'remote("repeat", "one")' in got and 'remote("shuffle", false)' in got
   and 'remote("volume", 0.25)' in got, got)

call("org.mpris.MediaPlayer2.Player.OpenUri", "neuronet:album/al1")
ok("OpenUri neuronet:album/<id> opens that album",
   'remote("open", {"kind": "album", "id": "al1"})' in "".join(js()))
bad = call("org.mpris.MediaPlayer2.Player.OpenUri", "http://example.com/x.mp3")
ok("  any other URI is an error, not a guess", "BadUri" in bad and js() == [], bad)
call("org.mpris.MediaPlayer2.Raise")
ok("Raise brings the window forward", js() == ["RAISE"])

print("\nQuick access (org.neuronet.App)\n")
APPDEST = ["--session", "--dest", mpris.APP_NAME, "--object-path", mpris.APP_PATH]


def app_call(method, *args):
    r = subprocess.run(["gdbus", "call", *APPDEST, "--method", method, *args],
                       capture_output=True, text=True, timeout=10)
    return (r.stdout + r.stderr).strip()


app_call("org.neuronet.App.Quick", "notes", "true")
got = "".join(js())
ok("Quick(section, compact) asks the page for that section, compact",
   'SS.quickMode("notes", true)' in got, got)
app_call("org.neuronet.App.Compact", "false")
got = "".join(js())
ok("Compact(false) turns the compact look off without moving",
   'SS.quickMode("", false)' in got, got)
names = subprocess.run(["busctl", "--user", "list", "--no-legend"],
                       capture_output=True, text=True).stdout
ok("NeuroNet also owns org.neuronet.App, so a second copy can see it's open",
   mpris.APP_NAME in names)

print("\nDesktop board requests (org.neuronet.App.Do)\n")
import re as _re
seen_page = []


def fake_page(code):
    """Stands in for the page: answers SS.boardDo as NeuroNet's would."""
    m = _re.search(r'SS\.boardDo\("([^"]+)", "([^"]+)", (".*")\)$', code)
    if not m:
        calls.append(code)
        return
    token, action, payload = m.group(1), m.group(2), json.loads(m.group(3))
    seen_page.append((action, json.loads(payload)))
    body = json.loads(payload)
    if action == "media.add" and body.get("title") == "Aliens":
        answer = {"duplicate": True, "title": "Aliens", "type": "DVD"}
    else:
        answer = {"ok": True, "echo": body}
    m2 = threading.Timer(0.2, lambda: mpris_obj.finish(token, json.dumps(answer)))
    m2.start()


import threading                                          # noqa: E402
mpris_obj = m
m._run_js = fake_page
r = app_call("org.neuronet.App.Do", "media.add", json.dumps({"type": "dvd", "title": "Tron"}))
ok("Do waits for the page and returns its answer",
   "ok" in r and "Tron" in r and seen_page and seen_page[-1][0] == "media.add", r)
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = subprocess.run([os.path.join(here, "neuronet-call"), "media.add",
                      json.dumps({"type": "dvd", "title": "Aliens"})],
                     capture_output=True, text=True, timeout=30).stdout.strip()
ok("neuronet-call prints the answer as one line of JSON (the duplicate here)",
   json.loads(out) == {"duplicate": True, "title": "Aliens", "type": "DVD"}, out)
ok("  with the details passed through intact", seen_page[-1][1] == {"type": "dvd", "title": "Aliens"})
ok("a late answer for a request already answered is ignored", m.finish("d-unknown", "{}") is False)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
