#!/usr/bin/env python3
"""Add a deck of scanned cards to Divination (15 November 2026).

Cam: "name each photo with the name on the card ... Once that is done they can
be added into divination and Neuroarcana please. I will add guidebooks later
down the track." The scans (Epson FastFoto) are named after their cards; a
deck list in tools/decks/<Deck>.json says which card each file is:

    {"name": "Necronomicon", "kind": "tarot|oracle|lenormand", "cover": "The Fool.jpg",
     "cards": [{"id": "fool", "name": "The Fool", "suit": "Major", "file": "The Fool.jpg"}, ...]}
    (a card may also carry "synopsis": the words printed on it under its name, e.g. the Mayan Oracle's)

    python3 tools/add_scanned_deck.py tools/decks/Necronomicon.json --scans "<folder of scans>" [--data <NeuroNet data>]

Copies each picture into <data>/cards/images as "<Deck> <Card>.jpg" (the way
every deck's pictures are named), and adds the deck to cards/celestial.json with
empty meanings, for the guidebook later. A deck already there by that name is
left alone (nothing is ever overwritten). celestial.json is backed up first.
Close NeuroNet before running it: an open Divination page saves its own copy.
For NeuroArcana afterwards: NeuroArcana's tools/import_decks.py, then
tools/ship_to_neuronet.sh.
"""
import argparse
import datetime
import json
import os
import random
import shutil
import string
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))


def default_data():
    try:
        out = subprocess.run([os.path.join(os.path.dirname(HERE), "system", "bin", "neuronet-path"), "data"],
                             capture_output=True, text=True, timeout=10).stdout.strip()
        if out:
            return out
    except (OSError, subprocess.SubprocessError):
        pass
    return os.path.join(os.path.dirname(HERE), "neuronet_data")


def new_id():
    return "cd-%d-%s" % (int(time.time() * 1000), "".join(random.choices(string.ascii_lowercase + string.digits, k=5)))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("spec")
    ap.add_argument("--scans", required=True, help="the folder of named scans")
    ap.add_argument("--data", default=None, help="NeuroNet's data folder (default: this computer's)")
    a = ap.parse_args(argv)
    spec = json.load(open(a.spec, encoding="utf-8"))
    name, kind = spec["name"], spec["kind"]
    if kind not in ("tarot", "oracle", "lenormand"):
        sys.exit("kind must be tarot, oracle or lenormand")
    data = a.data or default_data()
    cards_dir = os.path.join(data, "cards")
    images = os.path.join(cards_dir, "images")
    doc_path = os.path.join(cards_dir, "celestial.json")
    if not os.path.isfile(doc_path):
        sys.exit(f"no Divination data at {doc_path}")
    doc = json.load(open(doc_path, encoding="utf-8"))
    key = kind + "Decks"
    if any(isinstance(d, dict) and d.get("name") == name for d in doc.get(key, [])):
        print(f"{name}: already in Divination, left alone")
        return 0

    missing = [c["file"] for c in spec["cards"] if not os.path.isfile(os.path.join(a.scans, c["file"]))]
    if missing:
        sys.exit(f"{name}: {len(missing)} scans missing from {a.scans}, e.g. {missing[:3]}")

    def place(src_name, dst_name):
        dst = os.path.join(images, dst_name)
        if not os.path.exists(dst):
            shutil.copy2(os.path.join(a.scans, src_name), dst)
        return dst_name

    os.makedirs(images, exist_ok=True)
    cards = []
    for c in spec["cards"]:
        img = place(c["file"], f"{name} {os.path.splitext(c['file'])[0]}{os.path.splitext(c['file'])[1].lower()}")
        cards.append({"id": c["id"], "name": c["name"], "suit": c.get("suit", ""),
                      "upright": "", "reversed": "", "synopsis": c.get("synopsis", ""), "image": img})
    cover = None
    if spec.get("cover"):
        cover = place(spec["cover"], f"{name} cover{os.path.splitext(spec['cover'])[1].lower()}")

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copy2(doc_path, f"{doc_path}.before-{name.lower().replace(' ', '-')}-{stamp}")
    doc.setdefault(key, []).append({"id": new_id(), "kind": kind, "name": name,
                                    "createdAt": datetime.date.today().isoformat(),
                                    "cover": cover, "cardBack": None, "cards": cards})
    tmp = doc_path + ".part"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    os.replace(tmp, doc_path)
    print(f"{name}: added to Divination ({kind}, {len(cards)} cards)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
