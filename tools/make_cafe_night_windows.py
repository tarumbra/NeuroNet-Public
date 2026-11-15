#!/usr/bin/env python3
"""NeuroCafe's windows at night (2026-10-24, Cam: "make the windows show a dark outside image when it is night time and
the image it does now when it is day time"): for every window, curtain and blind picture (each painted with its window,
Sheets 17-18, both walls), a <id>-night.webp with only the view through the glass turned to night -- the frame,
curtains and sill as they are. The glass is found as the sky-blue paint (and the cutter's pale sky glass), and the green that
runs straight on from it with no outline between (the trees in the view -- not a window box's leaves or green drapes). Night: the view darkened to deep blue, its shapes kept as silhouettes, a few stars in the sky.

    python3 tools/make_cafe_night_windows.py
"""
import json
import os
import random
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
IDS = [f"window-{i}" for i in range(1, 9)] + [f"curtain-{i}" for i in range(1, 5)] + [f"blind-{i}" for i in range(1, 5)]


def is_sky(r, g, b):
    """Blue sky, down to the palest near-white blue by the horizon (and the cutter's pale glass, 196/224/240)."""
    return max(r, g, b) >= 185 and b >= r + 8 and b >= g - 12 and not (r > 235 and g > 235 and b > 235 and b - r < 12)


def is_leaf(r, g, b):
    """Green trees and hills seen through the glass."""
    return max(r, g, b) >= 60 and g > r + 10 and g > b - 8


def glass_mask(pic):
    """The sky through the glass, and the green that runs straight on from it with no outline between (trees in the
    view; a window box's leaves or green drapes are outlined, so they stay)."""
    W, H = pic.size
    px = pic.load()
    kind = [[0] * W for _ in range(H)]                     # 1 sky, 2 leaf
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a > 200:
                kind[y][x] = 1 if is_sky(r, g, b) else 2 if is_leaf(r, g, b) else 0
    mask = Image.new("L", (W, H), 0)
    mp = mask.load()
    stack = [(x, y) for y in range(H) for x in range(W) if kind[y][x] == 1]
    for q in stack:
        mp[q] = 255
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and kind[ny][nx] == 2 and not mp[nx, ny]:
                mp[nx, ny] = 255
                stack.append((nx, ny))
    return mask


def night(pic, mask):
    out = pic.copy()
    px, mp = out.load(), mask.load()
    rnd = random.Random(7)
    W, H = out.size
    for y in range(H):
        for x in range(W):
            if not mp[x, y]:
                continue
            r, g, b, a = px[x, y]
            lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255
            sky = is_sky(r, g, b)
            k = 0.32 + 0.35 * lum if sky else 0.16 + 0.2 * lum    # the sky a deep blue, the land a dark silhouette
            nr, ng, nb = 28 * k * 2.2, 36 * k * 2.2, 78 * k * 2.2
            if sky and rnd.random() < 0.003:
                nr = ng = nb = 235                                 # a star
            px[x, y] = (round(nr), round(ng), round(nb), a)
    return out


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    for base in IDS:
        for pid in (base, base + "-r"):
            path = os.path.join(OUT, pid + ".webp")
            if not os.path.isfile(path):
                continue
            pic = Image.open(path).convert("RGBA")
            mask = glass_mask(pic)
            n = mask.histogram()[255]
            im = night(pic, mask)
            im.save(os.path.join(OUT, pid + "-night.webp"), "WEBP", quality=92, method=6)
            sizes[pid + "-night"] = list(im.size)
            print(f"  {pid}-night.webp ({n} glass pixels)")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
