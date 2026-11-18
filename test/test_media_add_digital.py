"""A downloaded film into Media as Digital (2026-11-18, Cam: NeuroTV's downloads "autofill into Neuronet under media
and things as digital"): tools/media_add_digital.py and media_shelf.add_digital, in a scratch folder."""
import os
# Never Cam's real data (test_test_isolation.py checks every test does this first).
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json, shutil, subprocess, sys, tempfile
APP = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, APP)
import media_shelf as ms

passed = failed = 0
def ok(name, cond, detail=""):
    global passed, failed
    if cond: passed += 1; print("  ok    " + name)
    else: failed += 1; print("  FAIL  " + name + ("  -- " + str(detail) if detail else ""))

print("\nA downloaded film into Media as Digital\n")
ok("a title's year comes out of its name", ms.split_year("Copper Sky (2024)") == ("Copper Sky", "2024")
   and ms.split_year("Copper Sky", "2024") == ("Copper Sky", "2024") and ms.split_year("1917") == ("1917", ""))

d = tempfile.mkdtemp(prefix="nn-media-digital-")
try:
    films = os.path.join(d, "drive")
    os.makedirs(films)
    film = os.path.join(films, "Copper Sky (2024).mkv")
    with open(film, "wb") as f:
        f.write(b"\x1aE\xdf\xa3 not really a film")
    poster = os.path.join(d, "poster.png")
    from PIL import Image
    Image.new("RGB", (300, 450), (40, 90, 160)).save(poster)
    # Cam's Media already has a DVD of another film, with notes
    with open(os.path.join(d, "personal_effects.json"), "w") as f:
        json.dump({"items": [{"id": "e1", "type": "film", "formats": ["DVD"], "title": "Paper Boats", "year": "2021",
                              "notes": "Lent to Mum"}], "types": [], "mediaVersion": 2}, f)

    def run(*args):
        r = subprocess.run([sys.executable, "-I", os.path.join(APP, "tools", "media_add_digital.py"), "--data", d] + list(args),
                           capture_output=True, text=True, timeout=60)
        try:
            return json.loads(r.stdout.strip().splitlines()[-1])
        except (ValueError, IndexError):
            return {"error": r.stdout + r.stderr}

    got = run("--title", "Copper Sky (2024)", "--file", film, "--poster", poster)
    doc = json.load(open(os.path.join(d, "personal_effects.json")))
    it = next((x for x in doc["items"] if x["title"] == "Copper Sky"), None)
    ok("a new film: in Media as a film, tagged Digital, its year from the name", got.get("ok") and got.get("added") and it
       and it["type"] == "film" and it["formats"] == ["Digital"] and it["year"] == "2024", got)
    links = json.load(open(os.path.join(d, "cinema", "links.json")))
    ok("  linked to its file, so it plays from Media", links.get(it["id"]) == os.path.realpath(film), links)
    ok("  the poster as its cover", os.path.isfile(ms.cover_path(d, it["id"])) and it.get("cover"))
    ok("  the rest of Media kept", doc.get("mediaVersion") == 2 and any(x["id"] == "e1" and x["notes"] == "Lent to Mum" for x in doc["items"]))

    again = run("--title", "Copper Sky", "--year", "2024", "--file", film)
    doc = json.load(open(os.path.join(d, "personal_effects.json")))
    ok("downloaded again: the same item, not a second one", again.get("ok") and not again.get("added") and again["id"] == it["id"]
       and sum(1 for x in doc["items"] if x["title"] == "Copper Sky") == 1, again)

    boats = os.path.join(films, "Paper Boats (2021).mp4")
    shutil.copy(film, boats)
    got = run("--title", "Paper Boats (2021)", "--file", boats)
    doc = json.load(open(os.path.join(d, "personal_effects.json")))
    e1 = next(x for x in doc["items"] if x["id"] == "e1")
    ok("a film owned already (the DVD): it gains Digital and the link, keeping its notes",
       got.get("ok") and not got.get("added") and got["id"] == "e1" and e1["formats"] == ["DVD", "Digital"] and e1["notes"] == "Lent to Mum"
       and json.load(open(os.path.join(d, "cinema", "links.json"))).get("e1") == os.path.realpath(boats), e1)

    # TV (18 Nov 2026, Cam: "add TV to media and things ... one episode of scorpion")
    ep = os.path.join(films, "Scorpion - S03E12.mkv"); shutil.copy(film, ep)
    ep2 = os.path.join(films, "Scorpion - S01E01.mkv"); shutil.copy(film, ep2)
    got = run("--kind", "episode", "--title", "Scorpion (2014)", "--season", "3", "--episode", "12", "--episode-title", "Ice Ca-Cabes", "--file", ep)
    got2 = run("--kind", "episode", "--title", "Scorpion (2014)", "--season", "1", "--episode", "1", "--file", ep2)
    doc = json.load(open(os.path.join(d, "personal_effects.json")))
    shows = [x for x in doc["items"] if x.get("type") == "tv"]
    links = json.load(open(os.path.join(d, "cinema", "links.json")))
    ok("an episode: ONE TV item for the show, tagged Digital, its year from the name", got.get("ok") and got.get("added") and got2.get("ok")
       and not got2.get("added") and len(shows) == 1 and shows[0]["title"] == "Scorpion" and shows[0]["year"] == "2014"
       and shows[0]["formats"] == ["Digital"], (got, got2, shows))
    ok("  its episodes in order, each linked to its file", [e["key"] for e in shows[0]["episodes"]] == ["s01e01", "s03e12"]
       and shows[0]["episodes"][1]["name"] == "Ice Ca-Cabes"
       and links.get(shows[0]["id"] + "-s03e12") == os.path.realpath(ep) and links.get(shows[0]["id"] + "-s01e01") == os.path.realpath(ep2))
    again = run("--kind", "episode", "--title", "Scorpion (2014)", "--season", "3", "--episode", "12", "--file", ep)
    doc = json.load(open(os.path.join(d, "personal_effects.json")))
    ok("  the same episode again isn't listed twice", again.get("ok") and len(next(x for x in doc["items"] if x.get("type") == "tv")["episodes"]) == 2)
    ok("  and it isn't a film", not any(x.get("type") == "film" and x["title"] == "Scorpion" for x in doc["items"]))
    ok("TV is one of Media's kinds (so a conversion keeps it)", "tv" in ms.KINDS)

    ok("not a video: refused, Media untouched", "error" in run("--title", "X", "--file", poster)
       and len(json.load(open(os.path.join(d, "personal_effects.json")))["items"]) == 3)
    with open(os.path.join(d, "personal_effects.json"), "w") as f:
        f.write("{ broken")
    ok("a Media file it can't read is left exactly as it is", "error" in run("--title", "Y", "--file", film)
       and open(os.path.join(d, "personal_effects.json")).read() == "{ broken")
finally:
    shutil.rmtree(d, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
