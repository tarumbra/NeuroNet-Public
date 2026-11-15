"""Cinema (M&T → Cinema, cinema.py), 14 Nov 2026, brought across from Cam's
Collective (team vote V30). On a throwaway Movies folder and data folder only:
nothing real is played (the player launch is captured, not run) and Cam's own
data is never read.

Run: python3 test/test_cinema.py
"""
import os
# Never Cam's real data (test_test_isolation.py): a paths file that can't exist, before anything else.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import hashlib  # noqa: E402
import json  # noqa: E402
import shutil  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import cinema  # noqa: E402
import media_shelf as ms  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


tmp = tempfile.mkdtemp(prefix="cinema-")
try:
    movies = os.path.join(tmp, "Movies")
    data = os.path.join(tmp, "data")
    files = [
        "Severance/Season 2/Severance.S02E05.1080p.WEB-DL.mkv",
        "Severance/Season 2/Severance.S02E04.1080p.WEB-DL.mkv",
        "Severance/Season 1/Severance.S01E01.mkv",
        "The Bear 1x03 - Brigade.mp4",
        "Dust Bunny (2025) [1080p] [WEBRip]/Dust Bunny.mp4",
        "Send_Help_2026_1080p_WEB-DL_HEVC_x265_5.1_BONE.mkv",
    ]
    for f in files:
        p = os.path.join(movies, f)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "wb").write(b"x")

    print("\nShows and films\n")
    ok("S02E05 is Severance, season 2, episode 5",
       cinema.episode_of("Severance/Season 2/Severance.S02E05.1080p.mkv") == ("Severance", 2, 5))
    ok("1x03 is The Bear, season 1, episode 3", cinema.episode_of("The Bear 1x03 - Brigade.mp4") == ("The Bear", 1, 3))
    ok("a film is not an episode", cinema.episode_of("Dust Bunny (2025)/Dust Bunny.mp4") is None)
    lib = cinema.library(ms.list_films(movies))
    sev = next((s for s in lib["shows"] if s["title"] == "Severance"), None)
    ok("episodes group into their show", sev is not None and len(lib["shows"]) == 2, lib["shows"])
    ok("seasons in order, episodes in order",
       sev and [s["season"] for s in sev["seasons"]] == [1, 2]
       and [e["episode"] for e in sev["seasons"][1]["episodes"]] == [4, 5])
    ok("the rest are films, by title", [f["title"] for f in lib["films"]] == ["Dust Bunny", "Send Help"], lib["films"])

    print("\nWatched marks and playlists\n")
    rel = "Severance/Season 1/Severance.S01E01.mkv"
    cinema.mark(data, rel, True, "2026-11-14T20:00:00")
    ok("a watched mark is kept", cinema.load(data)["watched"].get(rel) == "2026-11-14T20:00:00")
    cinema.save_playlists(data, [{"id": "pl1", "name": "Friday", "items": [rel]}])
    ok("marking again doesn't drop the playlists (read-merge-write)",
       cinema.load(data)["playlists"][0]["name"] == "Friday")
    cinema.mark(data, rel, False, "x")
    ok("and a mark can be taken off", rel not in cinema.load(data)["watched"])
    bad = cinema.save_playlists(data, [{"id": "a\"><img onerror=x>", "name": " Late ", "items": [1, rel, {"x": 1}]},
                                       {"id": "", "name": "no id"}, "junk"])["playlists"]
    ok("playlists from the page are cleaned (safe ids, text only, nameless/junk dropped)",
       bad == [{"id": "aimgonerrorx", "name": "Late", "items": [rel]}], bad)
    ok("the state file is never left half written (no temp files)",
       not [f for f in os.listdir(data) if f.startswith(".cinema-")])

    print("\nWhere the player stopped\n")
    film = ms.film_path(movies, "Dust Bunny (2025) [1080p] [WEBRip]/Dust Bunny.mp4")
    wl = cinema.watch_later_dir(data)
    name = hashlib.md5(os.path.abspath(film).encode()).hexdigest().upper()
    open(os.path.join(wl, name), "w").write("# redirect entry\nstart=3000.500000\n")
    ok("mpv's saved position is read back (MD5 of the path, start=)", cinema.resume_at(data, film) == 3000.5)

    class Ran:
        n = 0

    def runner(argv):
        Ran.n += 1

        class R:
            stdout = "6000.0\n"
        return R()
    prog = cinema.progress(data, movies, ms.list_films(movies), runner=runner)
    ok("progress: 50 minutes into a 100 minute film is half way",
       prog.get("Dust Bunny (2025) [1080p] [WEBRip]/Dust Bunny.mp4", {}).get("fraction") == 0.5, prog)
    cinema.progress(data, movies, ms.list_films(movies), runner=runner)
    ok("its length is asked for once, then remembered", Ran.n == 1)

    print("\nPlaying\n")
    got = []
    r = cinema.play(data, [film, film], launcher=lambda argv: got.append(argv))
    argv = got[0] if got else []
    if shutil.which("mpv"):
        ok("a queue goes to mpv in one go", r.get("player") == "mpv" and r.get("count") == 2)
        ok("mpv remembers where Cam stops, in NeuroNet's own folder",
           "--save-position-on-quit" in argv and ("--watch-later-dir=" + wl) in argv)
        ok("file names can never be read as options (-- before them)",
           "--" in argv and argv.index("--") < argv.index(os.path.abspath(film)))
    else:
        print("  skip  mpv isn't installed here")
    ok("nothing outside the Movies folder is ever a film",
       ms.film_path(movies, "../data/cinema.json") is None and ms.film_path(movies, "/etc/passwd") is None)

    print("\nThe in-app player (14 Nov)\n")
    gpu = cinema.stream_argv("/m/Film -x.mkv", 754.5, gpu=True)
    cpu = cinema.stream_argv("/m/Film -x.mkv", 0, gpu=False)
    ok("on the NVIDIA card: cuda decode, h264_nvenc, at most 1080p",
       "h264_nvenc" in gpu and "cuda" in gpu and any("min(1080,ih)" in a for a in gpu))
    ok("without it: libx264, still 1080p at most", "libx264" in cpu and any("min(1080,ih)" in a for a in cpu))
    ok("both write a playable fragmented MP4 (H.264 + AAC stereo) to the response",
       all("frag_keyframe+empty_moov+default_base_moof" in a and "aac" in a and "pipe:1" in a for a in (gpu, cpu)))
    ok("the start time is asked of ffmpeg, the film is one argument (never a shell)",
       gpu[gpu.index("-ss") + 1] == "754.500" and gpu[gpu.index("-i") + 1] == "/m/Film -x.mkv")

    class FakeProc:
        made = []

        def __init__(self, argv):
            self.argv, self.killed, self._done = argv, False, False
            self.stdout = self
            self.chunks = [b"a" * 10, b"b" * 10]
            FakeProc.made.append(self)

        def read(self, n):
            return self.chunks.pop(0) if self.chunks else b""

        def poll(self):
            return 0 if (self.killed or not self.chunks) else None

        def kill(self):
            self.killed = True

        def wait(self, timeout=None):
            return 0
    got = []
    sent = cinema.serve_stream(got.append, "/x.mkv", 0, popen=FakeProc)
    ok("the stream pumps the conversion into the response", sent == 20 and b"".join(got) == b"a" * 10 + b"b" * 10)
    first = FakeProc([])
    cinema._STREAM["proc"] = first
    first.chunks = [b"x"] * 50

    def boom(b):
        raise BrokenPipeError()
    cinema.serve_stream(boom, "/x.mkv", 10, popen=FakeProc)
    ok("a new stream (a seek) stops the one before it", first.killed)
    ok("the player going away stops its conversion, with no CPU retry", FakeProc.made[-1].killed
       and len([p for p in FakeProc.made if p is not first]) == 2)
    ok("and each converter dies with NeuroNet if NeuroNet does (PR_SET_PDEATHSIG)",
       "prctl(1, signal.SIGKILL)" in open(os.path.join(HERE, "..", "cinema.py"), encoding="utf-8").read())

    film_dir = os.path.dirname(film)
    open(os.path.join(film_dir, "Dust Bunny.en.srt"), "w").write("1\n00:00:01,000 --> 00:00:02,000\nHi\n")
    subs = cinema.subtitles(data, film, "Dust Bunny (2025) [1080p] [WEBRip]/Dust Bunny.mp4",
                            runner=lambda argv: type("R", (), {"stdout": json.dumps({"streams": [
                                {"index": 2, "codec_name": "subrip", "tags": {"language": "eng"}},
                                {"index": 3, "codec_name": "hdmv_pgs_subtitle", "tags": {"language": "fre"}}]})})())
    ok("captions: text tracks inside the film (not picture ones), and .srt files beside it",
       [s["label"] for s in subs] == ["eng (in the film)", "Dust Bunny.en"], [s["label"] for s in subs])
    try:
        cinema.add_subtitle(data, "r", "/etc/passwd")
        ok("only subtitle files can be uploaded", False)
    except ValueError:
        ok("only subtitle files can be uploaded", True)

    rel2 = "Dust Bunny (2025) [1080p] [WEBRip]/Dust Bunny.mp4"
    cinema.save_position(data, rel2, 4200.0, "2099-01-01T00:00:00")
    ok("the in-app player's place wins when it's the newer one", cinema.position(data, film, rel2) == 4200.0)
    cinema.save_position(data, rel2, 10.0, "2000-01-01T00:00:00")
    ok("and mpv's wins when mpv stopped more recently", cinema.position(data, film, rel2) == 3000.5)

    nn = open(os.path.join(HERE, "..", "neuronet.py"), encoding="utf-8").read()
    ok("full screen is allowed for the page (FullScreenSupportEnabled, request accepted)",
       "FullScreenSupportEnabled" in nn and "request.accept()" in nn and "allow_qt_fullscreen()" in nn)
    ok("the stream route checks the token and resolves the film through cinema.resolve only",
       'secrets.compare_digest(parts[2], token)' in nn and "cinema.resolve(data_dir(), media_shelf.movies_dir(" in nn)

    print("\nLinked videos (14 Nov)\n")
    elsewhere = os.path.join(tmp, "Storage", "Home videos")
    os.makedirs(elsewhere)
    vid = os.path.join(elsewhere, "Beach 2019.mp4")
    open(vid, "wb").write(b"x")
    cinema.link(data, "item1", vid)
    ok("a Media item links to a video anywhere on the computer",
       cinema.resolve(data, movies, "link:item1") == os.path.realpath(vid))
    try:
        cinema.link(data, "item2", os.path.join(data, "cinema.json"))
        ok("only a video file can be linked", False)
    except ValueError:
        ok("only a video file can be linked", True)
    ok("the page can only ask by item: a made-up link or a path is never played",
       cinema.resolve(data, movies, "link:nobody") is None and cinema.resolve(data, movies, "link:../../etc") is None
       and cinema.resolve(data, movies, "/etc/passwd") is None and cinema.resolve(data, movies, vid) is None)
    ok("Movies-folder films still resolve as before",
       cinema.resolve(data, movies, "Dust Bunny (2025) [1080p] [WEBRip]/Dust Bunny.mp4") is not None)
    fl = cinema.linked_films(data, [{"id": "item1", "title": "Beach day", "year": 2019}, {"id": "x", "title": "No link"}])
    ok("linked items join Cinema's films, by their own title", [(f["title"], f["path"]) for f in fl] == [("Beach day", "link:item1")])
    os.rename(vid, vid + ".moved")
    ok("a video that has moved isn't played (and isn't listed)", cinema.resolve(data, movies, "link:item1") is None
       and cinema.linked_films(data, [{"id": "item1", "title": "Beach day"}]) == [])
    cinema.unlink(data, "item1")
    ok("and a link can be taken off", "item1" not in cinema.load_links(data))
    shelf = open(os.path.join(HERE, "..", "ui", "stuff", "shelf.js"), encoding="utf-8").read()
    scss = open(os.path.join(HERE, "..", "ui", "stuff", "shelf.css"), encoding="utf-8").read()
    ok("Media's Play is green when there's a video and greyed when there isn't",
       'class="btn sh-play ${video ? "sh-play-on" : ""}" id="sh-play" ${video ? "" : "disabled"}' in shelf
       and ".sh-play.sh-play-on { background: var(--good)" in scss and ".sh-play:disabled" in scss)
    ok("  and it plays in Cinema's own player, right there", "SS.CinemaPlayer.open(host, {items: [{path: video.path" in shelf)
    ok("  linking is the system's file picker (the backend keeps the link)", 'call("media_link_video", [it.id]' in shelf)

    app = open(os.path.join(HERE, "..", "ui", "app.js"), encoding="utf-8").read()
    html = open(os.path.join(HERE, "..", "ui", "index.html"), encoding="utf-8").read()
    print("\nThe page\n")
    # Cam (15 Nov 2026): "remove the cinema icon. It stays hidden but is used
    # when you click to play a linked film." Its films are Media items now.
    ok("Cinema has no page or icon any more; its old address opens Media",
       "stuff/cinema.js" not in html and '{key: "stuff:cinema"' not in app and '"stuff:cinema": "stuff:media"' in app
       and not os.path.exists(os.path.join(HERE, "..", "ui", "stuff", "cinema.js")))
    ok("the player is still loaded", '<script src="stuff/cinema-player.js"></script>' in html)
    player = open(os.path.join(HERE, "..", "ui", "stuff", "cinema-player.js"), encoding="utf-8").read()
    ok("mpv is one button away in the player", 'data-p="mpv"' in player)
    ok("the player has play, the timeline, skips, captions, the cog with upload, theatre and full screen",
       all(f'data-p="{k}"' in player for k in ("play", "back", "fwd", "cc", "cog", "theatre", "full"))
       and "cinema_subtitle_upload" in player and 'class="cn-time"' in player)
    ok("its keys work only while it has focus (split view's other side keeps the keyboard)",
       'root.addEventListener("keydown"' in player and 'document.addEventListener("keydown"' not in player)
    ok("closing empties the video and stops the conversion", 'video.removeAttribute("src")' in player
       and 'call("cinema_stop"' in player)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\n  %d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
