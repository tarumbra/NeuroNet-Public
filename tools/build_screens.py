#!/usr/bin/env python3
"""Build NeuroPets' screens file from its parts (2026-10-13, audit SE-13: "the screens are one 4,880-line file").

ui/pet/pet.js is ONE plain script (one function wrapping every page), like the rules in petcore.js. It is now *built*
from the parts in ui/pet/screens/ (NN-name.js, joined in order) -- edit the parts, never pet.js itself. A part on its own
isn't a whole script (the wrapper opens in the first part and closes in the last); only the joined file is.

    python3 tools/build_screens.py           join ui/pet/screens/*.js into ui/pet/pet.js
    python3 tools/build_screens.py --check   exit 1 if pet.js isn't exactly the parts joined (the tests run this)
    python3 tools/build_screens.py --split   (once) cut pet.js into parts at the lines in CUTS

After building, run the tests (node test/test_pet*.js; python3 test/test_pet.py) and reopen NeuroPets."""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
PET = os.path.join(APP, "ui", "pet")
OUT = os.path.join(PET, "pet.js")
PARTS = os.path.join(PET, "screens")
# where the split cut pet.js (its first line number, the part's name): one feature or a few small neighbours a part
CUTS = [(1, "header-ticker-and-checkpoints"), (145, "the-room-and-the-page"), (286, "mod-pictures-and-celebrations"),
        (395, "the-tutorial"), (664, "you-and-the-player-page"), (888, "gathering"), (1088, "the-item-sheet"),
        (1186, "the-village-and-the-estate"), (1334, "life-at-home"), (1695, "the-house"), (1950, "breeding-the-garden-your-class"),
        (2125, "the-hunt"), (2344, "the-battle-screen"), (2561, "your-pets-and-the-hatchery"), (2779, "crates-and-equipment"),
        (2905, "the-camp-today-and-settings"), (3052, "save-slots-and-the-modder"), (3324, "the-world-map-and-painted-places"),
        (3547, "living-pictures"), (3681, "shipyard-pyramid-island-estate"), (3908, "the-sea-chart"),
        (4075, "storeroom-recycle-and-the-cart"), (4313, "illustrated-scenes"), (4596, "books-herbarium-graveyard"),
        (4679, "the-farm"), (4861, "expedition-runs"), (4968, "developer-tools-and-the-api")]


def parts():
    return sorted(f for f in os.listdir(PARTS) if re.match(r"^\d\d-.*\.js$", f)) if os.path.isdir(PARTS) else []


def joined():
    out = []
    for f in parts():
        with open(os.path.join(PARTS, f), encoding="utf-8", newline="") as fh:
            out.append(fh.read())
    return "".join(out)


def split():
    with open(OUT, encoding="utf-8", newline="") as fh:
        whole = fh.read()
    lines = whole.splitlines(keepends=True)
    os.makedirs(PARTS, exist_ok=True)
    for n, (start, name) in enumerate(CUTS):
        end = CUTS[n + 1][0] if n + 1 < len(CUTS) else len(lines) + 1
        fn = "%02d-%s.js" % (n, name)
        with open(os.path.join(PARTS, fn), "w", encoding="utf-8", newline="") as fh:
            fh.write("".join(lines[start - 1:end - 1]))
        print("  %-50s %5d lines" % (fn, end - start))
    same = whole == joined()
    print("%d parts; joined back %s." % (len(CUTS), "byte-for-byte the same" if same else "DIFFERENT -- something is wrong"))
    return 0 if same else 1


def main():
    if "--split" in sys.argv:
        return split()
    if not parts():
        print("No parts in %s -- run with --split first." % PARTS)
        return 1
    text = joined()
    with open(OUT, encoding="utf-8", newline="") as fh:
        current = fh.read()
    if "--check" in sys.argv:
        if current == text:
            print("pet.js is its %d parts joined." % len(parts()))
            return 0
        print("pet.js differs from ui/pet/screens/ joined -- edit the parts, then run python3 tools/build_screens.py")
        return 1
    if current != text:
        with open(OUT, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
    print("Built ui/pet/pet.js from %d parts%s." % (len(parts()), " (changed)" if current != text else " (no change)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
