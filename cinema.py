"""Cinema (M&T → Cinema), brought across from Cam's Collective (team vote V30).

Cam (14 Nov 2026): "Cinema might be a nice one to add which would work great."
What Cam's Collective's Cinema had that the Media shelf didn't: shows by season
and episode, continue watching, watched marks, playlists. The films are the
same ones: everything under NeuroNet's Movies folder (media_shelf.movies_dir),
played by mpv or VLC, never by the page (media_shelf explains why: HEVC 10-bit
.mkv that the web engine can't decode).

EPISODES are found by their names, the way downloads are named:
    Severance/Season 2/Severance.S02E05.1080p.mkv      -> Severance, 2, 5
    The Bear 1x03 - Brigade.mp4                         -> The Bear, 1, 3
Anything without an SxxEyy (or 1x03) is a film.

RESUME is mpv's own. Cinema starts mpv with --save-position-on-quit pointed at
<data>/cinema/watch_later, so stopping half way is remembered by the player
itself, and mpv picks up where it left off next time. That file is named by
the MD5 of the film's full path (checked against mpv 0.41) and holds
"start=<seconds>": read back here for Continue watching and the progress bars.
VLC still plays, without resume.

WATCHED marks and PLAYLISTS live in <data>/cinema.json, written atomically and
read-merge-written, so two saves can't drop each other's changes. Durations
come from ffprobe once and are kept there too (keyed by path and size).

Every path from the page goes through media_shelf.film_path: nothing outside
the Movies folder is ever played or read.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile

import media_shelf as ms

_EP = re.compile(r"[Ss](\d{1,2})[ ._-]?[Ee](\d{1,3})|\b(\d{1,2})x(\d{2,3})\b")
WATCHED_AT = 0.92          # past this much of a film, it counts as watched


def episode_of(rel):
    """(show, season, episode) for an episode's path, else None."""
    name = os.path.basename(rel)
    m = _EP.search(name)
    if not m:
        return None
    season = int(m.group(1) or m.group(3))
    episode = int(m.group(2) or m.group(4))
    before = name[:m.start()]
    show, _ = ms.guess(before) if before.strip(" ._-") else ("", "")
    if not show:
        parts = rel.replace("\\", "/").split("/")[:-1]
        parts = [p for p in parts if not re.match(r"(?i)^(season|series|s)\s*\d+$", p.strip())]
        show = ms.guess(parts[0])[0] if parts else ""
    return (show or "Unknown show").strip(" -"), season, episode


def library(films):
    """Split media_shelf.list_films into shows (by season) and films."""
    shows, out_films = {}, []
    for f in films:
        ep = episode_of(f["path"])
        if not ep:
            out_films.append(f)
            continue
        name, season, number = ep
        key = ms.norm(name) or name.lower()
        show = shows.setdefault(key, {"key": key, "title": name, "seasons": {}})
        show["seasons"].setdefault(season, []).append(dict(f, season=season, episode=number))
    out = []
    for show in shows.values():
        seasons = []
        for s in sorted(show["seasons"]):
            eps = sorted(show["seasons"][s], key=lambda e: (e["episode"], e["path"]))
            seasons.append({"season": s, "episodes": eps})
        out.append({"key": show["key"], "title": show["title"], "seasons": seasons})
    out.sort(key=lambda s: ms.norm(s["title"]))
    out_films.sort(key=lambda f: (ms.norm(f["title"]), f["year"]))
    return {"shows": out, "films": out_films}


# ---- the state file --------------------------------------------------------

def state_path(data_dir):
    return os.path.join(data_dir, "cinema.json")


def watch_later_dir(data_dir):
    d = os.path.join(data_dir, "cinema", "watch_later")
    os.makedirs(d, exist_ok=True)
    return d


def load(data_dir):
    try:
        with open(state_path(data_dir), encoding="utf-8") as fh:
            d = json.load(fh)
    except (OSError, ValueError):
        d = {}
    if not isinstance(d, dict):
        d = {}
    d.setdefault("watched", {})
    d.setdefault("playlists", [])
    d.setdefault("durations", {})
    return d


def _write(data_dir, d):
    os.makedirs(data_dir, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=data_dir, prefix=".cinema-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(d, fh, ensure_ascii=False, indent=1)
        os.replace(tmp, state_path(data_dir))
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def update(data_dir, fn):
    """Read, change, write: fn(state) edits the freshly read state."""
    d = load(data_dir)
    fn(d)
    _write(data_dir, d)
    return d


def mark(data_dir, rel, watched, now):
    def change(d):
        if watched:
            d["watched"][rel] = now
        else:
            d["watched"].pop(rel, None)
    return update(data_dir, change)


def _clean_playlists(lists):
    out = []
    for p in lists if isinstance(lists, list) else []:
        if not isinstance(p, dict):
            continue
        name = str(p.get("name") or "").strip()[:80]
        pid = re.sub(r"[^A-Za-z0-9_-]", "", str(p.get("id") or ""))[:40]
        items = [str(x)[:500] for x in (p.get("items") or []) if isinstance(x, str)][:500]
        if name and pid:
            out.append({"id": pid, "name": name, "items": items})
    return out[:100]


def save_playlists(data_dir, lists):
    clean = _clean_playlists(lists)

    def change(d):
        d["playlists"] = clean
    return update(data_dir, change)


# ---- where the player stopped ----------------------------------------------

def resume_at(data_dir, path):
    """Seconds mpv saved for this file (0 if none). mpv names the file by the
    MD5 of the full path, upper-case hex."""
    name = hashlib.md5(os.path.abspath(path).encode("utf-8")).hexdigest().upper()
    try:
        with open(os.path.join(watch_later_dir(data_dir), name), encoding="utf-8") as fh:
            for line in fh:
                if line.startswith("start="):
                    return max(0.0, float(line.split("=", 1)[1]))
    except (OSError, ValueError):
        pass
    return 0.0


def duration(path, runner=None):
    """Seconds, from ffprobe, or 0 when it can't say."""
    if not shutil.which("ffprobe") and runner is None:
        return 0.0
    runner = runner or (lambda argv: subprocess.run(argv, capture_output=True, text=True, timeout=20))
    try:
        r = runner(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "default=nw=1:nk=1", path])
        return float((r.stdout or "").strip() or 0)
    except (OSError, ValueError, subprocess.SubprocessError):
        return 0.0


def progress(data_dir, root, films, runner=None):
    """{rel: {at, length, fraction}} for every film with a saved position,
    learning (and keeping) the lengths it needs."""
    d = load(data_dir)
    out, learned = {}, {}
    for f in films:
        path = resolve(data_dir, root, f["path"])      # a Movies film or a linked video
        if not path:
            continue
        at = position(data_dir, path, f["path"])   # the newer of NeuroNet's player and mpv
        if at <= 0:
            continue
        key = "%s|%s" % (f["path"], f.get("size", 0))
        length = d["durations"].get(key)
        if length is None:
            length = duration(path, runner)
            learned[key] = length
        frac = (at / length) if length else 0
        out[f["path"]] = {"at": round(at), "length": round(length or 0), "fraction": round(min(frac, 1), 3)}
    if learned:
        update(data_dir, lambda st: st["durations"].update(learned))
    return out


# ---- playing ---------------------------------------------------------------

def play(data_dir, paths, launcher=None):
    """Play one film, or a queue of them, resuming where mpv last stopped.
    Falls back to media_shelf.play (VLC, then the system's) for one file."""
    if not paths:
        return {"error": "Nothing to play."}
    launcher = launcher or (lambda argv: subprocess.Popen(
        argv, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL, start_new_session=True))
    if shutil.which("mpv"):
        title = os.path.splitext(os.path.basename(paths[0]))[0]
        argv = ["mpv", "--force-window=immediate", "--fs", "--sub-auto=fuzzy",
                "--save-position-on-quit", "--watch-later-dir=" + watch_later_dir(data_dir),
                "--title=" + title, "--"] + [os.path.abspath(p) for p in paths]
        try:
            launcher(argv)
            return {"ok": True, "player": "mpv", "count": len(paths)}
        except OSError:
            pass
    if len(paths) == 1:
        return ms.play(paths[0])
    if shutil.which("vlc"):
        try:
            launcher(["vlc", "--fullscreen", "--play-and-exit", "--"] + list(paths))
            return {"ok": True, "player": "VLC", "count": len(paths)}
        except OSError:
            pass
    return {"error": "Playing a list needs mpv or VLC."}


# ============================================================================
# The in-app player (14 Nov 2026). Cam: "Is there a way to have the film or
# show play inside of the app with its own player please".
#
# NeuroNet's web engine plays H.264 + AAC in MP4 and nothing Cam's films are
# (HEVC 10-bit, .mkv, 5.1/AC3 sound: checked with canPlayType). So the film is
# converted WHILE it plays: ffmpeg reads it from where the player asks
# (?t=seconds), and writes a fragmented MP4 straight into the loopback media
# server's response. On the NVIDIA card (cuda decode + h264_nvenc) a 4K HEVC
# 10-bit film converts at about 13x real time for ~3% of one CPU core
# (measured on The Ninth Gate, 14 Nov); pictures over 1080p are brought down
# to 1080p. Without the card it falls back to libx264, still playable.
# Nothing is written to disk. Seeking starts a new conversion at the new time
# and the old one is stopped, so there is only ever one ffmpeg running for the
# player, and none once it's closed.
# ============================================================================
import secrets as _secrets
import threading as _threading

SUB_TEXT = ("subrip", "ass", "ssa", "webvtt", "mov_text", "text", "srt")
SUB_EXTS = (".srt", ".vtt", ".ass", ".ssa")
_GPU = {}
_STREAM = {"proc": None, "lock": _threading.Lock()}


def gpu_ok(runner=None):
    """Can ffmpeg decode on CUDA and encode with NVENC here? Asked once."""
    if "ok" in _GPU:
        return _GPU["ok"]
    ok = False
    if shutil.which("ffmpeg") and os.path.exists("/dev/nvidia0"):
        runner = runner or (lambda argv: subprocess.run(argv, capture_output=True, text=True, timeout=10))
        try:
            enc = runner(["ffmpeg", "-hide_banner", "-encoders"]).stdout or ""
            acc = runner(["ffmpeg", "-hide_banner", "-hwaccels"]).stdout or ""
            ok = "h264_nvenc" in enc and "cuda" in acc
        except (OSError, subprocess.SubprocessError):
            ok = False
    _GPU["ok"] = ok
    return ok


def stream_argv(path, start=0.0, gpu=True, audio=0):
    """The ffmpeg command that turns `path`, from `start` seconds, into a
    playable fragmented MP4 on stdout. Never a shell; the path is one argv."""
    start = max(0.0, float(start or 0))
    common_out = ["-map", "0:v:0", "-map", "0:a:%d?" % int(audio or 0), "-sn", "-dn",
                  "-c:a", "aac", "-b:a", "192k", "-ac", "2",
                  "-f", "mp4", "-movflags", "frag_keyframe+empty_moov+default_base_moof",
                  "-frag_duration", "1000000", "pipe:1"]
    head = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error"]
    if gpu:
        return head + ["-ss", "%.3f" % start, "-hwaccel", "cuda", "-hwaccel_output_format", "cuda",
                       "-i", path, "-vf", "scale_cuda=w=-2:h='min(1080,ih)':format=nv12",
                       "-c:v", "h264_nvenc", "-preset", "p4", "-b:v", "6M", "-maxrate", "8M",
                       "-bufsize", "12M", "-g", "48"] + common_out
    return head + ["-ss", "%.3f" % start, "-i", path,
                   "-vf", "scale=w=-2:h='min(1080,ih)',format=yuv420p",
                   "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-g", "48"] + common_out


def _stop_stream():
    p = _STREAM.get("proc")
    _STREAM["proc"] = None
    if p and p.poll() is None:
        try:
            p.kill()
            p.wait(timeout=3)
        except (OSError, subprocess.SubprocessError):
            pass


def stop_stream():
    """The player closed: no conversion keeps running."""
    with _STREAM["lock"]:
        _stop_stream()


def _die_with_parent():
    """In the child, before ffmpeg starts: the kernel kills it the moment the
    thread that started it goes away (NeuroNet quitting or crashing mid-film),
    so a converter can never be left running on its own. Linux only; elsewhere
    the stream's own clean-up is the only guard."""
    try:
        import ctypes
        import signal
        ctypes.CDLL("libc.so.6", use_errno=True).prctl(1, signal.SIGKILL)   # PR_SET_PDEATHSIG
    except Exception:                                                    # noqa: BLE001
        pass


def serve_stream(write, path, start=0.0, audio=0, popen=None, chunk=64 * 1024):
    """Pump a live conversion into write(bytes) until the film ends or the
    player goes away (write raises). Returns how many bytes were sent."""
    import sys as _sys
    popen = popen or (lambda argv: subprocess.Popen(
        argv, stdout=subprocess.PIPE, stdin=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        start_new_session=True, preexec_fn=_die_with_parent if _sys.platform.startswith("linux") else None))
    tries = [True, False] if gpu_ok() else [False]
    sent = 0
    for gpu in tries:
        with _STREAM["lock"]:
            _stop_stream()                       # a seek or a new film replaces the old one
            proc = popen(stream_argv(path, start, gpu, audio))
            _STREAM["proc"] = proc
        try:
            while True:
                buf = proc.stdout.read(chunk)
                if not buf:
                    break
                write(buf)
                sent += len(buf)
        except (OSError, ValueError):
            sent = sent or 1                     # the player left: not a reason to retry on the CPU
        finally:
            with _STREAM["lock"]:
                if _STREAM.get("proc") is proc:
                    _stop_stream()
                elif proc.poll() is None:
                    proc.kill()
        if sent:
            return sent                          # the GPU worked (or the player is gone)
    return sent


# ---- subtitles ---------------------------------------------------------------

def _key(rel):
    return hashlib.sha1(rel.encode("utf-8")).hexdigest()[:16]


def uploads_dir(data_dir, rel):
    d = os.path.join(data_dir, "cinema", "subs", _key(rel))
    os.makedirs(d, exist_ok=True)
    return d


def subtitles(data_dir, path, rel, runner=None):
    """Every caption track for a film: inside it (text tracks only: picture
    subtitles can't be shown as text), files beside it or in its Subs folder,
    and ones Cam uploaded. [{id, label}] ids are opaque to the page."""
    out = []
    runner = runner or (lambda argv: subprocess.run(argv, capture_output=True, text=True, timeout=30))
    if shutil.which("ffprobe"):
        try:
            r = runner(["ffprobe", "-v", "error", "-select_streams", "s",
                        "-show_entries", "stream=index,codec_name:stream_tags=language,title", "-of", "json", path])
            for n, s in enumerate(json.loads(r.stdout or "{}").get("streams", [])):
                if s.get("codec_name") not in SUB_TEXT:
                    continue
                tags = s.get("tags") or {}
                name = tags.get("title") or tags.get("language") or "Track %d" % (n + 1)
                out.append({"id": "e%d" % n, "label": "%s (in the film)" % name})
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
    here = os.path.dirname(path)
    for folder in (here, os.path.join(here, "Subs"), os.path.join(here, "subs")):
        try:
            names = sorted(os.listdir(folder))
        except OSError:
            continue
        for f in names:
            if f.lower().endswith(SUB_EXTS):
                fid = "f" + _key(os.path.relpath(os.path.join(folder, f), here))
                out.append({"id": fid, "label": os.path.splitext(f)[0][:60], "_path": os.path.join(folder, f)})
    up = uploads_dir(data_dir, rel)
    for f in sorted(os.listdir(up)):
        if f.endswith(".vtt"):
            out.append({"id": "u" + f[:-4], "label": "%s (yours)" % f[:-4].replace("_", " ")[:60],
                        "_path": os.path.join(up, f)})
    return out


def _to_vtt(src_path=None, film=None, stream=None, runner=None):
    runner = runner or (lambda argv: subprocess.run(argv, capture_output=True, timeout=120))
    if film is not None:
        argv = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-i", film,
                "-map", "0:s:%d" % stream, "-f", "webvtt", "pipe:1"]
    else:
        argv = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-i", src_path, "-f", "webvtt", "pipe:1"]
    r = runner(argv)
    text = (r.stdout or b"").decode("utf-8", errors="replace") if isinstance(r.stdout, (bytes, bytearray)) else (r.stdout or "")
    return text[:5_000_000]


def subtitle_vtt(data_dir, path, rel, sid, runner=None):
    """A caption track as WebVTT text, or ''."""
    sid = str(sid or "")
    if re.fullmatch(r"e\d{1,3}", sid):
        return _to_vtt(film=path, stream=int(sid[1:]), runner=runner)
    for s in subtitles(data_dir, path, rel):
        if s["id"] == sid and s.get("_path"):
            if s["_path"].endswith(".vtt"):
                with open(s["_path"], encoding="utf-8", errors="replace") as fh:
                    return fh.read(5_000_000)
            return _to_vtt(src_path=s["_path"], runner=runner)
    return ""


def add_subtitle(data_dir, rel, src_path, runner=None):
    """Keep an uploaded caption file for this film, as WebVTT."""
    if not src_path.lower().endswith(SUB_EXTS) or not os.path.isfile(src_path):
        raise ValueError("Choose a subtitle file (.srt, .vtt, .ass or .ssa).")
    if os.path.getsize(src_path) > 10_000_000:
        raise ValueError("That subtitle file is too big.")
    vtt = _to_vtt(src_path=src_path, runner=runner)
    if not vtt.startswith("WEBVTT"):
        raise ValueError("That file couldn't be read as subtitles.")
    stem = re.sub(r"[^A-Za-z0-9 _.-]", "", os.path.splitext(os.path.basename(src_path))[0]).strip()[:60] or "Subtitles"
    dest = os.path.join(uploads_dir(data_dir, rel), stem.replace(" ", "_") + ".vtt")
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write(vtt)
    return stem


# ---- where the in-app player stopped ------------------------------------------

def save_position(data_dir, rel, at, now):
    def change(d):
        d.setdefault("positions", {})[rel] = {"at": round(max(0.0, float(at)), 1), "when": now}
    return update(data_dir, change)


def position(data_dir, path, rel):
    """Where to carry on: the newer of NeuroNet's own player and mpv's."""
    import time
    d = load(data_dir)
    mine = (d.get("positions") or {}).get(rel)
    mpv_at = resume_at(data_dir, path)
    name = hashlib.md5(os.path.abspath(path).encode("utf-8")).hexdigest().upper()
    try:
        mpv_when = os.path.getmtime(os.path.join(watch_later_dir(data_dir), name)) if mpv_at else 0
    except OSError:
        mpv_when = 0
    mine_when = 0
    if mine:
        try:
            mine_when = time.mktime(time.strptime(mine["when"][:19], "%Y-%m-%dT%H:%M:%S"))
        except (ValueError, KeyError, TypeError):
            mine_when = 0
    if mine and mine_when >= mpv_when:
        return float(mine.get("at") or 0)
    return mpv_at


# ============================================================================
# Linked videos (14 Nov 2026). Cam: "when we add a movie or video it should
# have a play button that is a link to the videos location on the computer
# ... This way i don't have to move videos from their storage location".
#
# A Media item can be linked to a video file ANYWHERE on the computer. The
# link is chosen in the system's own file picker and kept HERE, in
# <data>/cinema/links.json, which only the picker writes: the page can ask to
# play "link:<item id>", never hand NeuroNet a path of its own. A link still
# has to be an existing file with a video extension when it's played.
# ============================================================================
def links_path(data_dir):
    d = os.path.join(data_dir, "cinema")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "links.json")


def load_links(data_dir):
    try:
        with open(links_path(data_dir), encoding="utf-8") as fh:
            d = json.load(fh)
        return {str(k): str(v) for k, v in d.items()} if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_links(data_dir, links):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(links_path(data_dir)), prefix=".links-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(links, fh, ensure_ascii=False, indent=1)
        os.replace(tmp, links_path(data_dir))
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def is_video(path):
    return bool(path) and os.path.isfile(path) and path.lower().endswith(ms.VIDEO_EXTS)


def link(data_dir, item_id, path):
    item_id = ms._safe_id(item_id)
    path = os.path.realpath(path)
    if not is_video(path):
        raise ValueError("Choose a video file (mp4, mkv, avi, mov, webm and so on).")
    links = load_links(data_dir)
    links[item_id] = path
    _write_links(data_dir, links)
    return path


def unlink(data_dir, item_id):
    item_id = ms._safe_id(item_id)
    links = load_links(data_dir)
    links.pop(item_id, None)
    _write_links(data_dir, links)


def resolve(data_dir, movies_root, rel):
    """The file to play for what the page asked: a film under the Movies
    folder (media_shelf.film_path's own check), or "link:<item id>" for a
    linked video. None for anything else."""
    rel = str(rel or "")
    if rel.startswith("link:"):
        try:
            item_id = ms._safe_id(rel[5:])
        except ValueError:
            return None
        path = load_links(data_dir).get(item_id)
        return path if is_video(path) else None
    return ms.film_path(movies_root, rel)


def linked_films(data_dir, items):
    """Media items with a linked video, as Cinema films ({path: link:<id>})."""
    links = load_links(data_dir)
    out = []
    for it in items or []:
        p = links.get(str(it.get("id") or ""))
        if p and is_video(p):
            out.append({"path": "link:" + it["id"], "name": os.path.basename(p), "title": it.get("title") or os.path.basename(p),
                        "year": str(it.get("year") or ""), "alt": "", "size": os.path.getsize(p), "linked": True})
    return out
