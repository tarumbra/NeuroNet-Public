"""The Shelf (Stuff → Shelf): covers, and the films behind them.

Cam: "a new sub section called Shelf ... select a type of media and it will
be presented on a shelf ... as the cover image for the DVD, VHS or Bluray ...
a play button. Once play button is clicked, if the movie is located in a
movie sub folder in Neuronet directory then it will play."

WHAT A SHELF ENTRY IS. A Media item (personal_effects.json) -- the Shelf is a
way of looking at the same list, not a second one. The fields it adds live on
the item itself: review, reflections, favourite, film, cover.

COVERS are small JPEGs in neuronet_data/media_covers/, one per item, named by
the item's id. They are kept out of personal_effects.json on purpose: two
hundred covers inlined would make every save of that file two hundred covers
long.

FILMS live in Movies/ inside the NeuroNet folder (Movies, movies or Movie --
whichever is there; Movies is made if none is). A film is found by its title
and year from the file or folder name, the way downloads are named:
    The Ninth Gate (1999) [2160p] [4K] [BluRay]/The.Ninth.Gate...mkv
    Send_Help_2026_1080p_WEB-DL_HEVC_x265_5.1_BONE.mkv
or chosen by hand when the name gives nothing away.

PLAYING goes to a real video player (mpv, then VLC, then the system's own),
not to a <video> in the page. Cam's films are HEVC, most of them 10-bit, in
.mkv: the web engine inside NeuroNet cannot decode that, which is the fault
that kept Cam's Cinema shelved for eighteen versions. mpv plays all of them,
full screen, and picks up the subtitle files that sit beside them.
"""
import base64
import io
import os
import re
import shutil
import subprocess
import sys

VIDEO_EXTS = (".mp4", ".mkv", ".avi", ".m4v", ".mov", ".webm", ".mpg", ".mpeg",
              ".wmv", ".ts", ".m2ts", ".vob")
FOLDER_NAMES = ("Movies", "movies", "Movie", "movie", "Films", "films")
COVER_EDGE = 480           # long edge of a stored cover, in pixels

_TAGS = re.compile(
    r"\b(2160p|1080p|720p|480p|4k|uhd|hdr|web[- ]?dl|webrip|web|bluray|blu[- ]?ray|brrip|"
    r"bdrip|dvdrip|dvd|hdtv|x26[45]|h\.?26[45]|hevc|avc|10bit|aac\d?(\.\d)?|ac3|dts|"
    r"5\.1|7\.1|yts(\.\w+)?|yify|rarbg|proper|remastered|extended|unrated)\b.*$", re.I)


# ============================================================================
# Films
# ============================================================================

def _has_entries(p):
    try:
        return any(not e.name.startswith(".") for e in os.scandir(p))
    except OSError:
        return False


def movies_dir(app_dir, create=True):
    """The Movies folder inside NeuroNet's folder.

    Or, when that one is missing or empty, a Movies folder BESIDE NeuroNet's
    folder that has films in it (14 Nov 2026): Cam's films live in
    /mnt/Cams_Collective/Movies, next to /mnt/Cams_Collective/NeuroNet, and
    were deliberately never moved -- so Cinema and the shelf look there
    rather than show an empty library. NeuroNet's own folder wins as soon as
    anything is put in it."""
    own = None
    for name in FOLDER_NAMES:
        p = os.path.join(app_dir, name)
        if os.path.isdir(p):
            own = p
            break
    if own is None or not _has_entries(own):
        parent = os.path.dirname(os.path.abspath(app_dir))
        for name in FOLDER_NAMES:
            p = os.path.join(parent, name)
            if os.path.isdir(p) and _has_entries(p):
                return p
    if own:
        return own
    p = os.path.join(app_dir, "Movies")
    if create:
        try:
            os.makedirs(p, exist_ok=True)
        except OSError:
            pass
    return p


def norm(s):
    """A title as something to compare: lower case, punctuation and a
    leading "the"/"a"/"an" gone, "&" as "and"."""
    s = str(s or "").lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    s = re.sub(r"^(the|a|an) ", "", s)
    return s


def guess(name):
    """(title, year) from a download-style file or folder name.

    The year is the one in brackets when there is one ("Blade Runner 2049
    (2017)"), else the LAST year-like number that isn't the first word
    ("2001 A Space Odyssey 1968", "Send_Help_2026_1080p") -- a number that
    starts a title, or sits inside one, is part of the title."""
    stem = os.path.splitext(name)[0] if name.lower().endswith(VIDEO_EXTS) else name
    year = ""
    m = list(re.finditer(r"[\(\[]\s*((?:19|20)\d\d)\s*[\)\]]", stem))
    if m:
        year = m[-1].group(1)
        s = stem[:m[-1].start()]
    else:
        s = stem
    s = re.sub(r"[\[\(][^\]\)]*[\]\)]", " ", s)            # [1080p], (TOR)
    s = s.replace(".", " ").replace("_", " ")
    s = re.sub(r"\s+", " ", s).strip()
    if not year:
        words = s.split(" ")
        at = [i for i, w in enumerate(words) if re.fullmatch(r"(?:19|20)\d\d", w) and i > 0]
        # the last one followed by nothing, or by release tags somewhere
        # after it ("Alien 1979 Directors Cut 1080p BluRay")
        for i in reversed(at):
            rest = " ".join(words[i + 1:])
            if not rest or _TAGS.search(rest):
                year = words[i]
                s = " ".join(words[:i])
                break
    s = _TAGS.sub("", s)
    s = re.sub(r"[\(\)\[\]\-]+\s*$", "", s)
    return re.sub(r"\s+", " ", s).strip(" -"), year


def list_films(root):
    """Every video under the Movies folder, with the title and year its
    name suggests. Samples and trailers are left out."""
    out = []
    if not os.path.isdir(root):
        return out
    for here, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if not d.startswith("."))
        for f in sorted(files):
            if not f.lower().endswith(VIDEO_EXTS) or re.search(r"\b(sample|trailer)\b", f, re.I):
                continue
            path = os.path.join(here, f)
            rel = os.path.relpath(path, root).replace(os.sep, "/")
            # The folder's name is usually the cleaner one ("Dust Bunny
            # (2025) [1080p]..." around "Dust Bunny.mp4").
            parent = os.path.basename(here) if here != root else ""
            t1, y1 = guess(parent) if parent else ("", "")
            t2, y2 = guess(f)
            try:
                size = os.path.getsize(path)
            except OSError:
                size = 0
            out.append({"path": rel, "name": f, "title": t1 or t2, "year": y1 or y2,
                        "alt": t2 if t1 else "", "size": size})
    return out


def match(item, films):
    """The film for a Media item, by title (and year, when both have one)."""
    want = norm(item.get("title"))
    if not want:
        return None
    year = str(item.get("year") or "").strip()
    hits = [f for f in films if want in (norm(f["title"]), norm(f.get("alt")))]
    if year:
        exact = [f for f in hits if f["year"] == year]
        if exact:
            return exact[0]
        hits = [f for f in hits if not f["year"]]
    return hits[0] if len(hits) == 1 else None


def film_path(root, rel):
    """A path under the Movies folder, or None -- never anywhere else."""
    if not rel:
        return None
    root_r = os.path.realpath(root)
    p = os.path.realpath(os.path.join(root, str(rel)))
    if not p.startswith(root_r + os.sep) or not os.path.isfile(p):
        return None
    if not p.lower().endswith(VIDEO_EXTS):
        return None
    return p


def players():
    return [p for p in ("mpv", "vlc", "celluloid", "totem") if shutil.which(p)]


def play(path, launcher=None):
    """Start a real player on the file, detached, and say which."""
    launcher = launcher or (lambda argv: subprocess.Popen(
        argv, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, start_new_session=True))
    title = os.path.splitext(os.path.basename(path))[0]
    tries = []
    if shutil.which("mpv"):
        tries.append(("mpv", ["mpv", "--force-window=immediate", "--fs",
                              "--sub-auto=fuzzy", "--title=" + title, path]))
    if shutil.which("vlc"):
        tries.append(("VLC", ["vlc", "--fullscreen", "--play-and-exit", path]))
    for p in ("celluloid", "totem"):
        if shutil.which(p):
            tries.append((p, [p, path]))
    opener = "xdg-open" if sys.platform.startswith("linux") else ("open" if sys.platform == "darwin" else None)
    if opener and shutil.which(opener):
        tries.append(("the system's player", [opener, path]))
    for name, argv in tries:
        try:
            launcher(argv)
            return {"ok": True, "player": name}
        except OSError:
            continue
    if os.name == "nt":
        try:
            os.startfile(path)  # noqa: attribute exists on Windows
            return {"ok": True, "player": "the system's player"}
        except OSError:
            pass
    return {"error": "No video player was found. Installing mpv (or VLC) lets the Shelf play films."}


# ============================================================================
# Covers
# ============================================================================

def _safe_id(item_id):
    s = re.sub(r"[^A-Za-z0-9_-]", "", str(item_id or ""))[:64]
    if not s:
        raise ValueError("That isn't an item.")
    return s


def covers_dir(data_dir):
    d = os.path.join(data_dir, "media_covers")
    os.makedirs(d, exist_ok=True)
    return d


def cover_path(data_dir, item_id):
    return os.path.join(covers_dir(data_dir), _safe_id(item_id) + ".jpg")


def _store(data_dir, item_id, raw):
    from PIL import Image, ImageOps
    im = Image.open(io.BytesIO(raw))
    im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((COVER_EDGE, COVER_EDGE), Image.LANCZOS)
    path = cover_path(data_dir, item_id)
    tmp = path + ".tmp"
    im.save(tmp, "JPEG", quality=84, optimize=True)
    os.replace(tmp, path)
    return {"ok": True, "cover": data_url(path), "size": list(im.size)}


def set_cover_bytes(data_dir, item_id, raw):
    try:
        return _store(data_dir, item_id, raw)
    except ValueError as e:
        return {"error": str(e)}
    except Exception:
        return {"error": "That isn't a picture this can read."}


def set_cover_data_url(data_dir, item_id, url):
    m = re.match(r"data:image/[\w.+-]+;base64,(.+)$", str(url or ""), re.S)
    if not m:
        return {"error": "That isn't a picture."}
    try:
        raw = base64.b64decode(m.group(1))
    except ValueError:
        return {"error": "That isn't a picture."}
    return set_cover_bytes(data_dir, item_id, raw)


def set_cover_file(data_dir, item_id, path):
    try:
        with open(path, "rb") as f:
            return set_cover_bytes(data_dir, item_id, f.read())
    except OSError as e:
        return {"error": "Couldn't read that file (%s)." % e}


def film_frame(path, width=COVER_EDGE * 2, runner=None):
    """A still from the film itself, a fifth of the way in -- far enough to
    be past the studio logos -- as JPEG bytes, or {"error": ...}."""
    if not shutil.which("ffmpeg") and runner is None:
        return {"error": "Taking a still from the film needs ffmpeg, which isn't installed."}
    runner = runner or subprocess.run
    at = 600
    try:
        pr = runner(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                     "-of", "default=nw=1:nk=1", path], capture_output=True, timeout=30)
        dur = float((pr.stdout or b"0").decode().strip() or 0)
        if dur > 0:
            at = int(dur * 0.2)
    except (OSError, ValueError, subprocess.SubprocessError):
        pass
    try:
        r = runner(["ffmpeg", "-v", "error", "-ss", str(at), "-i", path, "-frames:v", "1",
                    "-vf", "scale='min(%d,iw)':-2" % width, "-f", "image2", "-c:v", "mjpeg", "-"],
                   capture_output=True, timeout=90)
    except (OSError, subprocess.SubprocessError) as e:
        return {"error": "Couldn't take a still from the film (%s)." % e}
    if not r.stdout:
        return {"error": "Couldn't take a still from the film."}
    return r.stdout


def cover_from_film(data_dir, item_id, path, runner=None):
    raw = film_frame(path, runner=runner)
    return raw if isinstance(raw, dict) else set_cover_bytes(data_dir, item_id, raw)


def film_still(path, folder, runner=None):
    """A full-size still written to a .jpg in `folder` -> {"path": ...}, for
    Photos to take in (covers live in Photos since 2026-10-02)."""
    raw = film_frame(path, width=1920, runner=runner)
    if isinstance(raw, dict):
        return raw
    name = re.sub(r"[^\w .()-]+", " ", os.path.splitext(os.path.basename(path))[0]).strip()[:80] or "Film"
    dest = os.path.join(folder, "%s - still.jpg" % name)
    with open(dest, "wb") as f:
        f.write(raw)
    return {"path": dest}


def data_url(path):
    with open(path, "rb") as f:
        return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode("ascii")


def covers(data_dir, ids):
    """{id: data url} for the ids that have a cover."""
    out = {}
    for i in ids or []:
        try:
            p = cover_path(data_dir, i)
        except ValueError:
            continue
        if os.path.isfile(p):
            try:
                out[i] = data_url(p)
            except OSError:
                pass
    return out


def clear_cover(data_dir, item_id):
    try:
        p = cover_path(data_dir, item_id)
        if os.path.exists(p):
            os.remove(p)
    except (OSError, ValueError):
        pass
    return {"ok": True}


# ============================================================================
# Music's albums, on the shelf as CDs (2026-10-02)
# ============================================================================
# Cam: "Albums added to Albums in music sub main section should ask if we want
# to add them to shelf, then they auto add including the songs." And every
# album there already: added once, by albums_onto_shelf below.
#
# A CD that came from an album keeps its albumId; its songs are read from the
# album live (the shelf entry shows them, and plays them), so an album that
# gains a song later shows it on the shelf too. Its cover is the album's cover
# from Music -- not copied into Photos, where 227 sleeves would bury the
# photos.

def album_artist(album, tracks):
    """The album's artist, or else the one artist its songs share (as
    albumArtistOf does in chords.js)."""
    if str(album.get("artist") or "").strip():
        return album["artist"].strip()
    seen = {}
    for f in album.get("files") or []:
        a = str((tracks.get(f) or {}).get("artist") or "").strip()
        if a:
            seen[a] = seen.get(a, 0) + 1
    if not seen:
        return ""
    top = sorted(seen.items(), key=lambda kv: -kv[1])
    return top[0][0] if len(top) == 1 or top[0][1] > len(album.get("files") or []) / 2 else ""


def _title_key(s):
    return re.sub(r"\s+", " ", str(s or "").strip()).lower()


def cd_for_album(items, album, tracks, now, new_id):
    """The Media item for an album: an existing CD with its id or its title
    (linked to it, keeping everything Cam wrote), else a new one. Returns
    (item, "linked"|"new"|"there")."""
    aid = album.get("id")
    for it in items:
        if it.get("albumId") == aid:
            return it, "there"
    name = _title_key(album.get("name"))
    for it in items:
        if it.get("type") in ("cd", "music") and _title_key(it.get("title")) == name and not it.get("albumId"):
            it["albumId"] = aid
            if not str(it.get("creator") or "").strip():
                it["creator"] = album_artist(album, tracks)
            if not str(it.get("year") or "").strip() and album.get("year"):
                it["year"] = str(album["year"])
            return it, "linked"
    it = {"id": new_id(), "type": "music", "formats": ["CD"], "title": str(album.get("name") or "").strip() or "Untitled album",
          "creator": album_artist(album, tracks), "year": str(album.get("year") or ""),
          "notes": "", "albumId": aid, "added": now}
    items.append(it)
    return it, "new"


def albums_onto_shelf(doc, chords, data_dir, images_dir, now, new_id):
    """Once: every album in Music becomes a CD in Media (doc changed in place).
    The doc keeps "albumsOnShelf" so this never runs again -- an album Cam
    takes off the shelf stays off. Covers come from the album's own art when
    the CD has none. -> {"new": n, "linked": n}"""
    if doc.get("albumsOnShelf"):
        return {"new": 0, "linked": 0, "skipped": True}
    albums = (chords or {}).get("albums") or []
    tracks = (chords or {}).get("tracks") or {}
    items = doc.setdefault("items", [])
    out = {"new": 0, "linked": 0}
    for a in albums:
        if not isinstance(a, dict) or not a.get("id"):
            continue
        it, how = cd_for_album(items, a, tracks, now, new_id)
        if how == "there":
            continue
        out[how] += 1
        art = os.path.basename(str(a.get("art") or ""))
        if art and not it.get("cover") and not os.path.isfile(cover_path(data_dir, it["id"])):
            src = os.path.join(images_dir, art)
            if os.path.isfile(src) and not set_cover_file(data_dir, it["id"], src).get("error"):
                it["cover"] = now
    doc["albumsOnShelf"] = now
    return out


# ============================================================================
# Media v2 (14 Nov 2026): WHAT a thing is, with the formats it's owned in.
# Cam: "add a movie, then click what category it is ... a tag for Dvd, VHS,
# Blu-ray, Digital ... Same with music ... Cassette, Vinyl, Cd, Mp3, Flac.
# This way we remove the double ups". Each old per-format type becomes a type
# and a format tag, and the same thing owned in two formats becomes ONE item
# carrying both -- its notes, review, star, cover and linked video kept.
# ============================================================================
OLD_TYPES = {
    "dvd": ("film", "DVD"), "bluray": ("film", "Blu-ray"), "vhs": ("film", "VHS"),
    "cd": ("music", "CD"), "cassette": ("music", "Cassette"), "vinyl": ("music", "Vinyl"),
    "books": ("book", None), "other": ("other", None),
    "ps1": ("game", "PS1"), "ps2": ("game", "PS2"), "ps3": ("game", "PS3"), "ps4": ("game", "PS4"),
    "ps5": ("game", "PS5"), "psp": ("game", "PSP"), "psvita": ("game", "PS Vita"), "xbox": ("game", "Xbox"),
    "xbox360": ("game", "Xbox 360"), "xboxone": ("game", "Xbox One"), "snes": ("game", "SNES"),
    "n64": ("game", "Nintendo 64"), "gamecube": ("game", "GameCube"), "wii": ("game", "Wii"),
    "switch": ("game", "Switch"), "switch2": ("game", "Switch 2"), "gameboy": ("game", "Game Boy"),
    "gba": ("game", "Game Boy Advance"), "nds": ("game", "Nintendo DS"), "n3ds": ("game", "Nintendo 3DS"),
}
KINDS = ("film", "tv", "music", "book", "game", "other")   # (tv: 18 Nov 2026, Cam: "add TV to media and things")


def media_v2(doc, data_dir, links=None):
    """Convert a v1 Media document in place. links: {item id: path} (Cinema's
    linked videos), remapped when an item is merged into another. Returns
    {"converted", "merged", "links"} -- the links as they should now be."""
    links = dict(links or {})
    custom = {t.get("id"): t.get("name") for t in doc.get("types") or [] if isinstance(t, dict)}
    items, merged, converted = [], 0, 0
    by_key = {}
    for it in doc.get("items") or []:
        if not isinstance(it, dict):
            continue
        t = it.get("type")
        formats = list(it.get("formats") or [])
        if t not in KINDS:
            kind, fmt = OLD_TYPES.get(t, ("other", custom.get(t) or (t if t else None)))
            it["type"] = kind
            if fmt and fmt not in formats:
                formats.append(fmt)
            converted += 1
        it["formats"] = formats
        key = (it["type"], _title_key(it.get("title")), _title_key(it.get("creator")), str(it.get("year") or "").strip())
        keep = by_key.get(key) if key[1] else None
        if keep is None:
            by_key[key] = it
            items.append(it)
            continue
        merged += 1
        keep["formats"] = keep["formats"] + [f for f in it["formats"] if f not in keep["formats"]]
        if it.get("favourite"):
            keep["favourite"] = True
        for field in ("review", "reflections", "notes"):
            a, b = str(keep.get(field) or "").strip(), str(it.get(field) or "").strip()
            if b and b != a:
                keep[field] = (a + "\n\n" + b) if a else b
        for field in ("film", "albumId", "cover"):
            if not keep.get(field) and it.get(field):
                keep[field] = it[field]
                if field == "cover":
                    try:
                        src, dst = cover_path(data_dir, it["id"]), cover_path(data_dir, keep["id"])
                        if os.path.isfile(src) and not os.path.exists(dst):
                            os.replace(src, dst)
                    except (OSError, ValueError):
                        pass
        if it.get("id") in links and keep.get("id") not in links:
            links[keep["id"]] = links[it["id"]]
        links.pop(it.get("id"), None)
    doc["items"] = items
    doc["types"] = [t for t in doc.get("types") or [] if isinstance(t, dict) and t.get("id") in KINDS]
    doc["mediaVersion"] = 2
    return {"converted": converted, "merged": merged, "links": links}


def split_year(title, year=""):
    """"Copper Sky (2024)" -> ("Copper Sky", "2024"); a year given wins."""
    t = re.sub(r"\s+", " ", str(title or "")).strip()
    m = re.match(r"^(.*?)\s*[\(\[]((?:19|20)\d\d)[\)\]]\s*$", t)
    if m and m.group(1):
        return m.group(1).strip(), str(year or m.group(2)).strip()
    return t, str(year or "").strip()


def add_digital(doc, title, year, path, link, cover, new_id, now):
    """Cam (18 Nov 2026): a film NeuroTV has downloaded "autofill into Neuronet
    under media and things as digital". It becomes a Media film tagged Digital
    and linked to its file -- or, owned already (a DVD of it, say), that item
    gets Digital and the link, and keeps everything else. link(item_id, path)
    and cover(item_id) are the caller's; cover is only asked for an item with
    no cover yet. Returns {"id", "added": bool, "title"}."""
    title, year = split_year(title, year)
    if not title:
        raise ValueError("The film has no title.")
    films = [it for it in doc.get("items") or [] if isinstance(it, dict) and it.get("type") == "film"]
    it = next((x for x in films if norm(x.get("title")) == norm(title) and str(x.get("year") or "") == year), None)
    if it is None and year:
        it = next((x for x in films if norm(x.get("title")) == norm(title) and not str(x.get("year") or "")), None)
    added = it is None
    if added:
        it = {"id": new_id(), "type": "film", "formats": ["Digital"], "title": title, "creator": "", "year": year,
              "notes": "", "added": now}
        doc.setdefault("items", []).append(it)
    else:
        if "Digital" not in (it.get("formats") or []):
            it["formats"] = list(it.get("formats") or []) + ["Digital"]
        if year and not it.get("year"):
            it["year"] = year
        it["updated"] = now
    link(it["id"], path)
    if not it.get("cover"):
        try:
            if cover(it["id"]):
                it["cover"] = now
        except Exception:                                        # noqa: BLE001
            pass
    return {"id": it["id"], "added": added, "title": title}


def episode_key(season, episode):
    return "s%02de%02d" % (int(season or 0), int(episode or 0))


def add_digital_episode(doc, show, year, season, episode, name, path, link, cover, new_id, now):
    """Cam (18 Nov 2026): "add TV to media and things ... my TV Series, for
    example at the moment i have one episode of scorpion". A show is ONE Media
    item of type tv, tagged Digital, with the episodes you have in
    it["episodes"] ([{key, season, episode, name}], in order); each episode's
    file is linked as "<item id>-<key>" (cinema.link), so it plays from Media.
    A show already there (a DVD box set, say) gains Digital and the episode.
    Returns {"id", "added": bool, "title", "episode": key}."""
    title, year = split_year(show, year)
    if not title:
        raise ValueError("The show has no title.")
    shows = [it for it in doc.get("items") or [] if isinstance(it, dict) and it.get("type") == "tv"]
    it = next((x for x in shows if norm(x.get("title")) == norm(title) and str(x.get("year") or "") == year), None)
    if it is None:
        it = next((x for x in shows if norm(x.get("title")) == norm(title) and (not year or not str(x.get("year") or ""))), None)
    added = it is None
    if added:
        it = {"id": new_id(), "type": "tv", "formats": ["Digital"], "title": title, "creator": "", "year": year,
              "notes": "", "added": now, "episodes": []}
        doc.setdefault("items", []).append(it)
    else:
        if "Digital" not in (it.get("formats") or []):
            it["formats"] = list(it.get("formats") or []) + ["Digital"]
        if year and not it.get("year"):
            it["year"] = year
        it["updated"] = now
    key = episode_key(season, episode)
    eps = [e for e in it.get("episodes") or [] if isinstance(e, dict) and e.get("key") != key]
    eps.append({"key": key, "season": int(season or 0), "episode": int(episode or 0), "name": str(name or "").strip()})
    it["episodes"] = sorted(eps, key=lambda e: (e.get("season", 0), e.get("episode", 0)))
    link(it["id"] + "-" + key, path)
    if not it.get("cover"):
        try:
            if cover(it["id"]):
                it["cover"] = now
        except Exception:                                        # noqa: BLE001
            pass
    return {"id": it["id"], "added": added, "title": title, "episode": key}


def adopt_movies(doc, films, root, link, cover, new_id, now):
    """Cam (14 Nov 2026): the films in the Movies folder (GOAT, Faces of
    Death ...) "Add them into Media and things and tag them with digital."
    Each film becomes (or joins) a Media film tagged Digital and linked to its
    file, so it plays from its own Play. link(item_id, path) and cover(item_id,
    path) are the caller's (cinema.link, cover_from_film). Returns counts."""
    added = joined = 0
    by_key = {(norm(it.get("title")), str(it.get("year") or "")): it
              for it in doc.get("items") or [] if it.get("type") == "film"}
    for f in films:
        path = film_path(root, f["path"])
        if not path:
            continue
        it = by_key.get((norm(f["title"]), f["year"])) or by_key.get((norm(f["title"]), ""))
        if it is None:
            it = {"id": new_id(), "type": "film", "formats": ["Digital"], "title": f["title"],
                  "creator": "", "year": f["year"], "notes": "", "added": now}
            doc.setdefault("items", []).append(it)
            by_key[(norm(f["title"]), f["year"])] = it
            added += 1
            try:
                cover(it["id"], path)
            except Exception:                                    # noqa: BLE001
                pass
        else:
            if "Digital" not in (it.get("formats") or []):
                it["formats"] = list(it.get("formats") or []) + ["Digital"]
            joined += 1
        try:
            link(it["id"], path)
        except Exception:                                        # noqa: BLE001
            pass
    doc["moviesAdopted"] = True
    return {"added": added, "joined": joined}
