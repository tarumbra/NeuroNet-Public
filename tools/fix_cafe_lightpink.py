#!/usr/bin/env python3
"""Take the light template pink (250, 152, 178) out of a cut picture (tools/fix_cafe_pink.py is for the older magenta sheets) (2026-11-18, Cam: "The coffee cupes have pink in the handle section").
The cutter only clears the pink it can reach from the picture's edge, so the pink inside a cup's handle stayed, and so
did the pink seen through empty glasses, under saucers and in the steam (painted light over pink). Each pixel is
taken as a mix of the template's pink and what was really painted there: how much pink it holds is read from how far
its red and blue sit above its green, in the pink's own proportions; that much is taken out and it's left that much
see-through (all pink: clear). Browns, creams, whites, greys and skin have no pink in them, and dark pixels (the
outlines) are never touched.

Only for pictures with no pink of their own -- not food with raspberries, strawberries or pink icing.

    python3 tools/fix_cafe_lightpink.py dish-latte cook-latte burnt-latte ...
    python3 tools/fix_cafe_lightpink.py --coffee      (all 24 coffee pictures)
"""
import os
import sys
from PIL import Image

ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "cafe", "art")
PINK = (250, 152, 178)                       # the template's pink, as the cutter left it
DR, DB = PINK[0] - PINK[1], PINK[2] - PINK[1]
COFFEE = ["espresso", "flatwhite", "cappuccino", "latte", "mocha", "icedcoffee", "macchiato", "affogato"]


def unpink(im):
    im = im.convert("RGBA")
    px = im.load()
    n = 0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            dr, db = r - g, b - g
            if dr <= 8 or db <= 4:
                continue
            k = min(1.0, dr / DR, db / DB)
            lum = 0.3 * r + 0.59 * g + 0.11 * b
            k *= max(0.0, min(1.0, (lum - 70) / 20))     # the dark outlines stay (fading in from 70 to 90)
            if k <= 0.04:
                continue
            if k >= 0.85:
                px[x, y] = (r, g, b, 0)
            else:
                c = [max(0, min(255, int((v - k * p) / (1 - k)))) for v, p in zip((r, g, b), PINK)]
                px[x, y] = (c[0], c[1], c[2], int(a * (1 - k)))
            n += 1
    return im, n


def main(args):
    ids = [f"{st}-{d}" for d in COFFEE for st in ("dish", "cook", "burnt")] if args == ["--coffee"] else args
    for pid in ids:
        path = os.path.join(ART, pid + ".webp")
        im, n = unpink(Image.open(path))
        im.save(path, "WEBP", quality=90, method=6)
        print(f"{pid}: {n} pixels")


if __name__ == "__main__":
    if not sys.argv[1:]:
        sys.exit(__doc__)
    main(sys.argv[1:])
