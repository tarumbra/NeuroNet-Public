"""The Shelf's backend -- finding films, playing them, and covers.

Cam: "a play button. Once play button is clicked, if the movie is located in a
movie sub folder in Neuronet directory then it will play."

media_shelf.py on names made here, and on Cam's real Movies folder when it is
on this machine (real download names are where title guessing is wrong).
Nothing here starts a player: the launcher is replaced, and what it would
have run is checked instead.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import base64, io, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
import media_shelf as ms  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nThe Shelf: films, playing and covers\n")

# ---- names -> title and year --------------------------------------------------
cases = {
    "The Ninth Gate (1999) [2160p] [4K] [BluRay] [5.1] [YTS.BZ]": ("The Ninth Gate", "1999"),
    "Send_Help_2026_1080p_WEB-DL_HEVC_x265_5.1_BONE.mkv": ("Send Help", "2026"),
    "The.Magic.Faraway.Tree.2026.2160p.4K.WEB.x265.10bit.AAC5.1-[YTS.BZ].mkv": ("The Magic Faraway Tree", "2026"),
    "Dust Bunny.mp4": ("Dust Bunny", ""),
    "Blade Runner 2049 (2017) [1080p].mkv": ("Blade Runner 2049", "2017"),
    "2001 A Space Odyssey (1968).mp4": ("2001 A Space Odyssey", "1968"),
    "Alien.1979.Directors.Cut.1080p.BluRay.x264.mkv": ("Alien", "1979"),
    "Blade.Runner.2049.2017.1080p.mkv": ("Blade Runner 2049", "2017"),
    "1917.2019.1080p.mkv": ("1917", "2019"),
}
for name, want in cases.items():
    got = ms.guess(name)
    ok("a download name reads as a title and year: " + want[0], got == want, got)

# ---- matching ------------------------------------------------------------------
films = [{"path": "a.mkv", "title": "The Ninth Gate", "year": "1999", "alt": ""},
         {"path": "b.mkv", "title": "Dune", "year": "1984", "alt": ""},
         {"path": "c.mkv", "title": "Dune", "year": "2021", "alt": ""},
         {"path": "d.mp4", "title": "Dust Bunny", "year": "", "alt": ""}]
ok("an entry finds its film by title, \"The\" and case ignored",
   (ms.match({"title": "ninth gate", "year": "1999"}, films) or {}).get("path") == "a.mkv")
ok("  and the year tells two films of one name apart",
   (ms.match({"title": "Dune", "year": "2021"}, films) or {}).get("path") == "c.mkv")
ok("  with no year to go on, two of a name are not guessed between",
   ms.match({"title": "Dune"}, films) is None)
ok("  a film whose name has no year still matches an entry that has one",
   (ms.match({"title": "Dust Bunny", "year": "2025"}, films) or {}).get("path") == "d.mp4")
ok("  and nothing is matched from nothing", ms.match({"title": ""}, films) is None)

with tempfile.TemporaryDirectory() as tmp:
    # ---- the Movies folder --------------------------------------------------------
    app = os.path.join(tmp, "app")
    os.makedirs(app)
    root = ms.movies_dir(app)
    ok("NeuroNet's Movies folder is made when there isn't one",
       os.path.isdir(root) and os.path.basename(root) == "Movies")
    sub = os.path.join(root, "Hoppers (2026) [2160p] [4K] [WEB] [5.1] [YTS.BZ]")
    os.makedirs(os.path.join(sub, "Subs"))
    for f in ("Hoppers.2026.2160p.4K.WEB.x265.10bit.AAC5.1-[YTS.BZ].mkv", "Hoppers-sample.mkv",
              "Subs/English.srt", "YTS.BZ - Official site.jpg"):
        open(os.path.join(sub, f), "wb").write(b"x")
    open(os.path.join(root, "Whistle_2025_1080p_WEB-DL_HEVC_x265_5.1_BONE.mkv"), "wb").write(b"x")
    got = ms.list_films(root)
    ok("films are found in folders of their own and loose, and nothing else is",
       sorted(f["title"] for f in got) == ["Hoppers", "Whistle"], [f["path"] for f in got])
    ok("  samples, subtitles and pictures are left out", not any("sample" in f["path"] for f in got))
    os.makedirs(os.path.join(tmp, "other", "movies"))
    ok("an existing lower-case movies folder is the one used, not a second one made",
       ms.movies_dir(os.path.join(tmp, "other")) == os.path.join(tmp, "other", "movies"))

    # 14 Nov 2026: a Movies folder beside NeuroNet's (Cam's films, never moved) is used
    # while NeuroNet's own is empty, and NeuroNet's own wins once it has anything
    side = os.path.join(tmp, "side")
    os.makedirs(os.path.join(side, "NeuroNet", "Movies"))
    os.makedirs(os.path.join(side, "Movies"))
    open(os.path.join(side, "Movies", "Film (2020).mkv"), "wb").write(b"x")
    ok("an empty Movies folder of NeuroNet's gives way to the drive's own Movies beside it",
       ms.movies_dir(os.path.join(side, "NeuroNet")) == os.path.join(side, "Movies"))
    open(os.path.join(side, "NeuroNet", "Movies", "Mine (2021).mkv"), "wb").write(b"x")
    ok("  and NeuroNet's own wins once it has films", ms.movies_dir(os.path.join(side, "NeuroNet"))
       == os.path.join(side, "NeuroNet", "Movies"))

    # ---- nothing outside it can be played -----------------------------------------------
    rel = got[0]["path"]
    ok("a film is reached by its place in the Movies folder", ms.film_path(root, rel) is not None)
    secret = os.path.join(tmp, "secret.mkv"); open(secret, "wb").write(b"x")
    ok("  and never outside it", ms.film_path(root, "../secret.mkv") is None
       and ms.film_path(root, secret) is None)
    ok("  nor anything that isn't a video", ms.film_path(root, got[0]["path"].rsplit("/", 1)[0]
                                                        + "/Subs/English.srt") is None)

    # ---- playing -------------------------------------------------------------------------
    ran = []
    res = ms.play(ms.film_path(root, rel), launcher=lambda argv: ran.append(argv))
    if ms.shutil.which("mpv"):
        ok("Play hands the film to mpv, full screen, with its subtitle files",
           res.get("player") == "mpv" and ran[0][0] == "mpv" and "--fs" in ran[0]
           and "--sub-auto=fuzzy" in ran[0] and ran[0][-1].endswith(".mkv"), ran)
    fails = []

    def broken(argv):
        fails.append(argv[0])
        if len(fails) < 2:
            raise OSError("gone")
    res2 = ms.play(ms.film_path(root, rel), launcher=broken)
    ok("  a player that won't start is passed over for the next",
       len(fails) >= 2 and res2.get("ok"), (fails, res2)) if len(ms.players()) >= 2 else None

    def none(argv):
        raise OSError("no")
    res3 = ms.play(ms.film_path(root, rel), launcher=none)
    ok("  and with no player at all it says what to install", "mpv" in res3.get("error", ""), res3)

    # ---- covers ----------------------------------------------------------------------------
    from PIL import Image
    buf = io.BytesIO(); Image.new("RGB", (1200, 1800), (200, 30, 30)).save(buf, "PNG")
    url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    data = os.path.join(tmp, "data")
    r = ms.set_cover_data_url(data, "m01", url)
    ok("a picture becomes the cover, made small", r.get("ok") and max(r["size"]) == ms.COVER_EDGE, r.get("size"))
    ok("  kept as a file of its own, not in the Media list",
       os.path.isfile(os.path.join(data, "media_covers", "m01.jpg")))
    ok("  and handed back for the shelf", list(ms.covers(data, ["m01", "m02"])) == ["m01"])
    ok("something that isn't a picture is refused",
       "error" in ms.set_cover_data_url(data, "m02", "data:image/png;base64,bm90IGFuIGltYWdl"))
    ok("  an id can't reach outside the covers folder",
       os.path.basename(ms.cover_path(data, "../../etc/x")) == "etcx.jpg")
    ms.clear_cover(data, "m01")
    ok("removing a cover removes the file", not ms.covers(data, ["m01"]))

    # A still from the film: ffprobe and ffmpeg replaced by a fake runner.
    calls = []

    class R:
        def __init__(self, out): self.stdout = out

    def runner(argv, **kw):
        calls.append(argv)
        if argv[0] == "ffprobe":
            return R(b"6000.0\n")
        b = io.BytesIO(); Image.new("RGB", (960, 400), (10, 90, 30)).save(b, "JPEG")
        return R(b.getvalue())
    r = ms.cover_from_film(data, "m03", ms.film_path(root, rel), runner=runner)
    ok("a still from the film can be the cover", r.get("ok"), r)
    ok("  taken a fifth of the way in, past the studio logos",
       any(a[0] == "ffmpeg" and a[a.index("-ss") + 1] == "1200" for a in calls), calls)

# ---- Cam's real films, when they are here ----------------------------------------------------
REAL = "/mnt/Cams_Collective/Movies"
if os.path.isdir(REAL):
    got = ms.list_films(REAL)
    bad = [f["path"] for f in got if not f["title"] or not f["year"] or len(f["title"]) > 40
           or ms.guess(f["title"])[1]]
    ok("every film in Cam's Movies folder reads as a clean title and year (%d)" % len(got),
       got and not bad, bad)
else:
    print("  --    (Cam's Movies folder isn't on this machine; skipped)")

# ---- the puzzles mark, for Puzzles' printouts ----------------------------------------------
from PIL import Image  # noqa: E402
logo = os.path.join(APP, "icons", "puzzles.png")
ok("the puzzles mark is in the app", os.path.isfile(logo))
if os.path.isfile(logo):
    with Image.open(logo) as im:
        ok("  on a transparent ground, small enough to travel in every page",
           im.convert("RGBA").getpixel((0, 0))[3] == 0 and os.path.getsize(logo) < 60 * 1024)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
