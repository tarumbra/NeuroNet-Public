#!/usr/bin/env python3
"""NeuroCafe's outdoor cinema showing a film (V26 q3, N62): Sheet 45's night cell came painted on a navy sky, so it
can't be cut from the pink. Its screen is taken instead: the day picture's white screen is filled from the night
cell, the same spot on the sheet. Writes ui/cafe/art/prop-cinema-on.webp (the size of prop-cinema) and adds it to
ui/cafe/art/manifest.js. Run after cutting Sheet 45.

    python3 tools/make_cafe_cinema.py
"""
import json
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_cafe_art import cut_cell, SRC  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
SHEET = os.path.join(SRC, "Building", "Icon - Sheet 45 - Carts and cinema.jpeg")


def main():
    sheet = Image.open(SHEET).convert("RGB")
    c = sheet.width // 4
    day = sheet.crop((3 * c, 0, 4 * c, c))
    night = sheet.crop((3 * c, c, 4 * c, 2 * c))
    cut = cut_cell(day, trim=False)
    dp, npx, op = day.load(), night.load(), cut.load()
    # the screen: the day picture's pale cloth (light, little colour), inside the cut-out
    for y in range(c):
        for x in range(c):
            r, g, b, a = op[x, y]
            if a and min(r, g, b) > 200 and max(r, g, b) - min(r, g, b) < 40:
                n = npx[x, y]
                op[x, y] = (n[0], n[1], n[2], a)
    cut = cut.crop(cut.getbbox())
    ref = Image.open(os.path.join(OUT, "prop-cinema.webp"))
    cut = cut.resize(ref.size, Image.LANCZOS)
    cut.save(os.path.join(OUT, "prop-cinema-on.webp"), "WEBP", quality=90, method=6)
    man = os.path.join(OUT, "manifest.js")
    text = open(man, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    sizes["prop-cinema-on"] = list(cut.size)
    open(man, "w", encoding="utf-8").write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)
    print("  prop-cinema-on.webp", cut.size)


if __name__ == "__main__":
    main()
