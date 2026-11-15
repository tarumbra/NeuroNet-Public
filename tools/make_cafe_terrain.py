#!/usr/bin/env python3
"""NeuroCafe's ground to paint (2026-10-24, Cam: "different terrains like dirt, soil, and rocky ground think like sims
games ... paint it directly on the ground and not have it locked to the grid"): seamless 512px textures in the painted
grass's soft style, till they're painted -- a mottled base (blurred blobs, wrapped round the edges so it tiles) and its
own details (pebbles with a dark rim, clods, flecks, twigs). Writes ui/cafe/art/tex-<id>.webp and adds them to
ui/cafe/art/manifest.js. The ids must match cafecore.js TERRAINS.

    python3 tools/make_cafe_terrain.py
"""
import json
import os
import random
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
N = 512


def wrap_draw(draw_fn, img, x, y, r):
    """Draw at x, y and wherever the shape crosses an edge, again on the far side (so the texture tiles)."""
    for dx in (-N, 0, N):
        for dy in (-N, 0, N):
            if -r <= x + dx <= N + r and -r <= y + dy <= N + r:
                draw_fn(img, x + dx, y + dy)


def mottle(base, spots, seed, blur=26):
    """A soft, uneven base: blobs of a few tones, blurred together (the blur done on a 3x3 tiling, so it wraps)."""
    rnd = random.Random(seed)
    im = Image.new("RGB", (N, N), base)
    d = ImageDraw.Draw(im)
    for col, n, rmin, rmax in spots:
        for _ in range(n):
            x, y, r = rnd.uniform(0, N), rnd.uniform(0, N), rnd.uniform(rmin, rmax)
            ry = r * rnd.uniform(0.5, 1)
            wrap_draw(lambda _i, X, Y: d.ellipse((X - r, Y - ry, X + r, Y + ry), fill=col), im, x, y, r)
    big = Image.new("RGB", (N * 3, N * 3))
    for i in range(3):
        for j in range(3):
            big.paste(im, (i * N, j * N))
    big = big.filter(ImageFilter.GaussianBlur(blur))
    return big.crop((N, N, 2 * N, 2 * N))


def details(im, seed, items):
    """Small things on top, each with a soft shadow and a darker rim, wrapped round the edges."""
    rnd = random.Random(seed)
    over = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    for kind, n, rmin, rmax, cols, rim in items:
        for _ in range(n):
            x, y, r = rnd.uniform(0, N), rnd.uniform(0, N), rnd.uniform(rmin, rmax)
            col = rnd.choice(cols)
            ry = r * rnd.uniform(0.55, 0.85)
            if kind == "stone":
                import math
                k = rnd.randint(6, 9)                      # an irregular stone: a lumpy polygon, lit from the top left
                shape = [(math.cos(2 * math.pi * i / k + rnd.uniform(-0.25, 0.25)) * r * rnd.uniform(0.75, 1.1),
                          math.sin(2 * math.pi * i / k + rnd.uniform(-0.25, 0.25)) * ry * rnd.uniform(0.75, 1.1)) for i in range(k)]
                def f(_i, X, Y, r=r, ry=ry, col=col, shape=shape):
                    pts = [(X + a, Y + b) for a, b in shape]
                    d.polygon([(a + 2, b + 3) for a, b in pts], fill=(40, 28, 18, 70))
                    d.polygon(pts, fill=col + (255,), outline=rim + (255,), width=max(1, int(r / 6)))
                    d.polygon([(X + a * 0.5 - r * 0.2, Y + b * 0.45 - ry * 0.3) for a, b in shape], fill=tuple(min(255, c + 30) for c in col) + (120,))
            elif kind == "fleck":
                def f(_i, X, Y, r=r, ry=ry, col=col):
                    d.ellipse((X - r, Y - ry, X + r, Y + ry), fill=col + (rnd.randint(110, 200),))
            elif kind == "twig":
                a, b = rnd.uniform(-1, 1) * r, rnd.uniform(-0.5, 0.5) * r
                def f(_i, X, Y, a=a, b=b, col=col):
                    d.line((X - a, Y - b, X + a, Y + b), fill=col + (230,), width=3)
            elif kind == "ripple":                         # (water) a thin light arc lying on the surface
                def f(_i, X, Y, r=r, ry=ry, col=col):
                    d.arc((X - r * 1.8, Y - ry * 0.6, X + r * 1.8, Y + ry * 0.6), 200, 340, fill=col + (rnd.randint(90, 170),), width=2)
            elif kind == "clod":
                def f(_i, X, Y, r=r, ry=ry, col=col):
                    d.ellipse((X - r, Y - ry, X + r, Y + ry), fill=col + (200,))
                    d.ellipse((X - r * 0.6, Y - ry * 0.9, X + r * 0.4, Y - ry * 0.1), fill=tuple(min(255, c + 22) for c in col) + (120,))
            wrap_draw(f, over, x, y, r + 4)
    im = im.convert("RGBA")
    im.alpha_composite(over)
    return im.convert("RGB")


TEX = {
    "dirt": lambda: details(mottle((158, 118, 78), [((176, 136, 92), 70, 18, 60), ((136, 98, 62), 60, 14, 50), ((186, 150, 104), 30, 10, 30)], 1),
                            2, [("fleck", 420, 1, 3, [(110, 78, 50), (196, 162, 118)], None), ("stone", 26, 3, 7, [(150, 140, 128), (172, 160, 142)], (92, 78, 64))]),
    "soil": lambda: details(mottle((96, 62, 40), [((112, 74, 48), 80, 16, 50), ((78, 50, 32), 70, 12, 40)], 3),
                            4, [("clod", 160, 4, 10, [(84, 54, 34), (118, 80, 52)], None), ("fleck", 300, 1, 2.5, [(60, 38, 24), (140, 100, 70)], None)]),
    "rocky": lambda: details(mottle((140, 128, 112), [((156, 144, 126), 60, 18, 50), ((118, 106, 92), 60, 12, 40)], 5),
                             6, [("stone", 90, 8, 22, [(150, 146, 140), (128, 124, 120), (170, 164, 154), (138, 128, 116)], (70, 64, 58)),
                                 ("stone", 160, 3, 7, [(160, 152, 140), (120, 114, 106)], (80, 72, 64))]),
    "gravel": lambda: details(mottle((176, 168, 154), [((188, 180, 166), 60, 14, 40), ((160, 152, 140), 60, 12, 36)], 7, blur=14),
                              8, [("stone", 900, 2.5, 5.5, [(196, 190, 180), (150, 144, 136), (178, 168, 152), (128, 122, 116)], (96, 90, 84))]),
    "sand": lambda: details(mottle((226, 202, 150), [((236, 214, 164), 70, 20, 60), ((212, 186, 134), 60, 14, 50)], 9),
                            10, [("fleck", 600, 0.8, 2, [(196, 170, 120), (246, 230, 190)], None), ("stone", 8, 2, 4, [(220, 210, 196)], (160, 140, 110))]),
    "mulch": lambda: details(mottle((104, 64, 38), [((122, 76, 44), 70, 14, 40), ((84, 50, 30), 60, 12, 36)], 11, blur=12),
                             12, [("twig", 700, 5, 11, [(140, 88, 50), (96, 58, 34), (164, 108, 64), (74, 44, 26)], None)]),
    "moss": lambda: details(mottle((96, 128, 58), [((112, 146, 66), 70, 14, 46), ((78, 108, 46), 60, 12, 40), ((132, 158, 74), 20, 8, 20)], 13),
                            14, [("clod", 260, 3, 8, [(88, 122, 52), (120, 154, 70), (70, 100, 42)], None), ("stone", 10, 4, 9, [(138, 134, 124)], (78, 72, 64))]),
    "mud": lambda: details(mottle((104, 80, 58), [((92, 70, 50), 60, 20, 60), ((120, 94, 68), 50, 16, 44), ((76, 64, 54), 20, 20, 50)], 15, blur=30),
                           16, [("fleck", 120, 2, 6, [(150, 140, 128)], None), ("clod", 60, 4, 9, [(86, 64, 46)], None)]),
    # V26-time (Cam, 25 Oct: "add water to the terrain tools and a shovel"): water in two frames the page swaps (the
    # base the same, only the ripples move), and the dug-out earth the shovel leaves
    "water": lambda: details(mottle((86, 168, 176), [((104, 186, 190), 70, 20, 60), ((72, 150, 160), 60, 16, 50)], 17, blur=30),
                             18, [("ripple", 160, 6, 16, [(220, 245, 240), (170, 222, 222)], None), ("fleck", 40, 1, 2, [(250, 255, 250)], None)]),
    "water-2": lambda: details(mottle((86, 168, 176), [((104, 186, 190), 70, 20, 60), ((72, 150, 160), 60, 16, 50)], 17, blur=30),
                               19, [("ripple", 160, 6, 16, [(220, 245, 240), (170, 222, 222)], None), ("fleck", 40, 1, 2, [(250, 255, 250)], None)]),
    "deepwater": lambda: details(mottle((34, 76, 120), [((42, 90, 136), 70, 22, 70), ((26, 60, 100), 60, 18, 60)], 21, blur=34),
                                 22, [("ripple", 120, 8, 18, [(120, 170, 210), (90, 140, 190)], None)]),
    "deepwater-2": lambda: details(mottle((34, 76, 120), [((42, 90, 136), 70, 22, 70), ((26, 60, 100), 60, 18, 60)], 21, blur=34),
                                   23, [("ripple", 120, 8, 18, [(120, 170, 210), (90, 140, 190)], None)]),
    "dug": lambda: details(mottle((88, 60, 40), [((100, 70, 46), 80, 16, 50), ((70, 46, 30), 70, 12, 40)], 25),
                           26, [("clod", 220, 4, 11, [(80, 54, 36), (112, 78, 52), (66, 44, 28)], None), ("stone", 14, 3, 6, [(140, 128, 112)], (80, 70, 60))]),
}


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    for tid, make in TEX.items():
        im = make()
        pid = "tex-" + tid
        im.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=88, method=6)
        sizes[pid] = list(im.size)
        print(f"  {pid}.webp")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
