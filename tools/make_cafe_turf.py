#!/usr/bin/env python3
"""NeuroCafe's fake grass floor (2026-11-08, Cam: "a new grass floor tile (fake grass for indoors)"): made from the green
carpet's painted tile (its shape, outline and blades), turned a brighter, even lawn green with the mower stripes of
artificial turf across its top, and its edge a short fringe of blades over a dark rubber backing. Writes
ui/cafe/art/floor-turf.webp and adds it to manifest.js.

    python3 tools/make_cafe_turf.py
"""
import colorsys
import json
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
SRC, PID = "floor-green", "floor-turf"
TOP, CORNER = 0, 85            # the top face: its top corner's y, its side corners' y (the bottom one at 2 x CORNER)
STRIPES, HUE = 6, 0.305        # mower stripes across the top; the turf's green (as a hue, 0-1)


def main():
    im = Image.open(os.path.join(OUT, SRC + ".webp")).convert("RGBA")
    W, H = im.size
    px = im.load()
    half = W / 2
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if a < 8 or max(r, g, b) < 70 or ((h < 0.06 or h > 0.9) and s > 0.3):   # (clear, or the dark red outline: kept)
                continue
            dx, dy = (x - half) / half, (y - TOP) / CORNER
            c, rr = (dx + dy) / 2, (dy - dx) / 2
            if -0.02 <= c <= 1.02 and -0.02 <= rr <= 1.02:  # the top: lawn green, striped
                band = int(max(0, min(STRIPES - 1, c * STRIPES))) % 2
                h, s, v = HUE, min(1, s * 1.1 + 0.12), min(1, v * (1.06 if band else 0.94))
            else:                                           # the edge: a fringe of blades, then the rubber backing
                edge = CORNER + x * CORNER / half if x <= half else 2 * CORNER - (x - half) * CORNER / half
                if y - edge < 7:
                    h, s, v = HUE, min(1, s * 1.1 + 0.12), v * 0.8
                else:
                    h, s, v = 0.33, 0.25, 0.16 + v * 0.18
            R, G, B = colorsys.hsv_to_rgb(h, s, v)
            px[x, y] = (round(R * 255), round(G * 255), round(B * 255), a)
    im.save(os.path.join(OUT, PID + ".webp"), "WEBP", quality=92, method=6)
    man = os.path.join(OUT, "manifest.js")
    text = open(man, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    sizes[PID] = [W, H]
    with open(man, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)
    print(f"{PID}.webp {W}x{H}")


if __name__ == "__main__":
    main()
