#!/usr/bin/env python3
"""A downloaded film into Media, tagged Digital and linked to its file (2026-11-18, Cam: "have the movie autofill
into Neuronet under media and things as digital"). NeuroTV runs this when a film finishes downloading; anything else
may too. It's NeuroNet's own code (media_shelf.add_digital, cinema.link), so Media's rules are kept in one place.

    python3 tools/media_add_digital.py --data <data folder> --title "Copper Sky (2024)" [--year 2024]
                                       --file "/path/Copper Sky (2024).mkv" [--poster <http(s) address or image file>]
    an episode (into the show's TV item): --kind episode --title "Scorpion (2014)" --season 3 --episode 12
                                          [--episode-title "Ice Ca-Cabes"] --file ...

Prints {"ok": true, "id", "added", "title"} or {"error"}. The Media file is read fresh and written whole through a
temporary file (as NeuroNet saves it); Media's page re-reads before it saves, so an open page doesn't undo this.
A cover is set only on an item with none: the poster if given and it loads, else a frame from the film.
"""
import argparse
import datetime
import json
import os
import sys
import urllib.request
import uuid

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)
import cinema  # noqa: E402
import media_shelf as ms  # noqa: E402


def poster_bytes(src):
    if not src:
        return None
    try:
        if src.startswith(("http://", "https://")):
            req = urllib.request.Request(src, headers={"User-Agent": "NeuroNet/1.0"})
            with urllib.request.urlopen(req, timeout=15) as r:
                return r.read(8 * 1024 * 1024)
        if os.path.isfile(src):
            with open(src, "rb") as f:
                return f.read(8 * 1024 * 1024)
    except Exception:                                            # noqa: BLE001
        return None
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--year", default="")
    ap.add_argument("--file", required=True)
    ap.add_argument("--poster", default="")
    # (18 Nov 2026) an episode: --title is the show, and these say which one
    ap.add_argument("--kind", default="film", choices=["film", "episode"])
    ap.add_argument("--season", default="0")
    ap.add_argument("--episode", default="0")
    ap.add_argument("--episode-title", default="")
    a = ap.parse_args()
    path = os.path.join(a.data, "personal_effects.json")
    if not cinema.is_video(a.file):
        return {"error": "That isn't a video file: %s" % a.file}
    doc = {"items": [], "types": []}
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                doc = json.load(f)
        except (OSError, ValueError) as e:
            return {"error": "Couldn't read Media (%s); it's left as it is." % e}
        if not isinstance(doc, dict):
            return {"error": "Media isn't in the expected shape; it's left as it is."}
    now = datetime.datetime.now().isoformat(timespec="seconds")

    def cover(item_id):
        raw = poster_bytes(a.poster)
        if raw and not (ms.set_cover_bytes(a.data, item_id, raw) or {}).get("error"):
            return True
        got = ms.cover_from_film(a.data, item_id, a.file)
        return not (isinstance(got, dict) and got.get("error"))

    link = lambda i, p: cinema.link(a.data, i, p)                 # noqa: E731
    new_id = lambda: "e" + uuid.uuid4().hex[:12]                   # noqa: E731
    if a.kind == "episode":
        got = ms.add_digital_episode(doc, a.title, a.year, a.season, a.episode, a.episode_title, a.file,
                                     link=link, cover=cover, new_id=new_id, now=now)
    else:
        got = ms.add_digital(doc, a.title, a.year, a.file, link=link, cover=cover, new_id=new_id, now=now)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)
    return dict(got, ok=True)


if __name__ == "__main__":
    try:
        out = main()
    except Exception as e:                                       # noqa: BLE001
        out = {"error": str(e)}
    print(json.dumps(out))
    sys.exit(0 if out.get("ok") else 1)
