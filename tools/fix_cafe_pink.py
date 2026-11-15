#!/usr/bin/env python3
"""Take the sheets' magenta out of NeuroCafe pictures (PT56, Cam: "the magenta top of the cauldron ... oldmans head ...
steam from dishes is magenta"). Steam, smoke and glows were painted see-through over the magenta background, and some
background is shut inside a shape (a kettle's handle), where the cutter's flood fill can't reach -- so they kept its pink.

Each pixel is taken as a mix of the background and a grey: colour = t * bg + (1 - t) * grey (solved by least squares).
Where that fits closely, the background's share comes out: the pixel keeps its grey, and its share of the background
becomes see-through (all of it, when it's background all through). Real pinks and purples don't fit the mix, so they stay.

    python3 tools/fix_cafe_pink.py [--dry-run] [--top=0.3] [--fit=14] [--grey [--from=0.8]] [--glow=r,g,b] <id> ...     (ids in ui/cafe/art, without .webp)
"""
import os
import sys

from PIL import Image

ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "cafe", "art")
BG = (196, 75, 130)


def unmix(c):
    """(t, grey, misfit) for colour c as t * BG + k * (1, 1, 1)."""
    # least squares on [bg_i, 1] [t, k]^T = c_i
    sbb = sum(b * b for b in BG); sb = sum(BG); n = 3
    sbc = sum(b * x for b, x in zip(BG, c)); sc = sum(c)
    det = sbb * n - sb * sb
    t = (sbc * n - sb * sc) / det
    k = (sbb * sc - sb * sbc) / det
    misfit = max(abs(t * b + k - x) for b, x in zip(BG, c))
    grey = k / (1 - t) if t < 0.98 else 0
    return t, grey, misfit


def grey_out(pic, top, start=0.0):
    """Burnt dishes' smoke (brownish, not grey, so it doesn't fit the mix): any pink left in the top share of the
    picture loses its colour, keeping its lightness and see-through."""
    pic = pic.convert("RGBA")
    px = pic.load()
    n = 0
    for y in range(round(pic.height * start), round(pic.height * top)):
        for x in range(pic.width):
            r, g, b, a = px[x, y]
            if a and r > g + 8 and b > g + 2:                     # (faint plum too: browns have b below g)
                v = round(0.3 * r + 0.59 * g + 0.11 * b)
                px[x, y] = (v, v, v, a)
                n += 1
    return pic, n


def glow(pic, top, col):
    """A coloured glow painted over the background (the cauldron's green haze came out solid pink): each pink pixel in the
    top share taken as a mix of the background and the glow's colour -- it becomes the glow, its background share
    see-through."""
    pic = pic.convert("RGBA")
    px = pic.load()
    d = [b - c for b, c in zip(BG, col)]
    dd = sum(x * x for x in d)
    n = 0
    for y in range(round(pic.height * top)):
        for x in range(pic.width):
            r, g, b, a = px[x, y]
            if not a or not (r > g + 15 and r > b):
                continue
            t = max(0.0, min(1.0, sum((v - c) * k for v, c, k in zip((r, g, b), col, d)) / dd))
            px[x, y] = col + (round(a * (1 - t)),)
            n += 1
    return pic, n


def clean(pic, top=1.0, fit=14):
    """top: only the top share of the picture (a pink food's steam, leaving its berries or dragonfruit be)."""
    pic = pic.convert("RGBA")
    px = pic.load()
    n = 0
    for y in range(round(pic.height * top)):
        for x in range(pic.width):
            r, g, b, a = px[x, y]
            if not a or not (r > g + 20 and b > g + 10):        # only pinks
                continue
            t, grey, misfit = unmix((r, g, b))
            if t < 0.15 or misfit > fit:
                continue
            if t > 0.88:
                px[x, y] = (r, g, b, 0)
            else:
                v = max(0, min(255, round(grey)))
                px[x, y] = (v, v, v, round(a * (1 - t)))
            n += 1
    return pic, n


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    top = next((float(a[6:]) for a in sys.argv if a.startswith("--top=")), 1.0)
    fit = next((float(a[6:]) for a in sys.argv if a.startswith("--fit=")), 14)   # (dark smoke: --fit=24)
    for pid in [a for a in sys.argv[1:] if not a.startswith("--")]:
        f = os.path.join(ART, pid + ".webp")
        g = next((tuple(int(v) for v in a[7:].split(",")) for a in sys.argv if a.startswith("--glow=")), None)
        pic, n = glow(Image.open(f), top, g) if g else grey_out(Image.open(f), top, next((float(a[7:]) for a in sys.argv if a.startswith("--from=")), 0.0)) if "--grey" in sys.argv else clean(Image.open(f), top, fit)
        print(f"{pid}: {n} pixels")
        if n and not dry:
            pic.save(f, "WEBP", quality=90, method=6)
