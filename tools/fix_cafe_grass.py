#!/usr/bin/env python3
"""NeuroCafe's garden things without the grass they were painted standing on (2026-10-25, Cam: "remove the green grass
from the bottom of the outdoor items like the angel statue, gazebo, ponds etc."): the game's own ground shows under them
instead. Grass is taken away from the outside in -- green pixels (and the patch's dark green rim) reached from the
picture's see-through edge -- so greens inside the thing (a lily pad on the water, the roses' leaves) stay. Run after
cutting Sheet 47; it rewrites the pictures in place and their sizes in ui/cafe/art/manifest.js.

    python3 tools/fix_cafe_grass.py [--dir DIR]
"""
import argparse
import colorsys
import json
import os
from collections import deque
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ART = os.path.join(ROOT, "ui", "cafe", "art")
IDS = ["pond_small", "pond_big", "pond_koi", "pond_lily", "fountain", "birdbath", "well", "bridge", "gazebo", "pergola",
       "rosearch", "sundial", "gnome", "statue", "birdhouse", "stonelantern"]


def grassy(p):
    """Grass green, or the dark olive of its rim and tufts."""
    r, g, b, a = p
    if a < 20:
        return False
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    h *= 360
    # (the painted grass is a light olive, about 150,155,70; the roses' leaves are darker, about 100,100,55 -- kept)
    return 45 <= h <= 120 and s > 0.28 and v > 0.5 and g >= r * 0.9


def clean(im, pond=False):
    im = im.convert("RGBA")
    W, H = im.size
    px = im.load()
    green = [[grassy(px[x, y]) for x in range(W)] for y in range(H)]
    # near grass: within 3 pixels of a green one (so the patch's dark outline can be crossed, but not the thing's own)
    near = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if green[y][x]:
                for dy in range(-3, 4):
                    for dx in range(-3, 4):
                        if 0 <= x + dx < W and 0 <= y + dy < H:
                            near[y + dy][x + dx] = True
    def dark(p):
        return p[3] >= 20 and max(p[:3]) < 110
    def olive(p):                                          # (the grass's darker tufts and shading)
        h, s, v = colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255)
        return 40 <= h * 360 <= 120 and s > 0.25 and v > 0.3 and p[1] >= p[0] * 0.85
    gone = [[False] * W for _ in range(H)]
    q = deque()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] < 20:
                gone[y][x] = True
                q.append((x, y))
    eaten = 0
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            low = not pond and ny > H * 0.5               # (the grass's shading lies round a thing's foot)
            if 0 <= nx < W and 0 <= ny < H and not gone[ny][nx] and (green[ny][nx] or ((near[ny][nx] or low) and (dark(px[nx, ny]) and near[ny][nx] or olive(px[nx, ny]) or px[nx, ny][3] < 235))):
                gone[ny][nx] = True
                eaten += 1
                q.append((nx, ny))
    # grass shut in by the thing (between a pergola's posts) -- in its lower half, any light grass is grass
    if not pond:
        for y in range(int(H * 0.5), H):
            for x in range(W):
                if green[y][x]:
                    gone[y][x] = True
    # specks left in the gap (a lone dark pixel of the old rim) go too
    for _ in range(2):
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                n4 = 0 if gone[y][x] else sum(gone[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if n4 >= 3 or (n4 and near[y][x] and px[x, y][3] < 235):
                    gone[y][x] = True
    # where the grass met the thing, its edge gets a thin dark outline again
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    op = out.load()
    for y in range(H):
        for x in range(W):
            if gone[y][x]:
                continue
            p = px[x, y]
            edge = any(0 <= x + dx < W and 0 <= y + dy < H and gone[y + dy][x + dx] and px[x + dx, y + dy][3] >= 20
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            op[x, y] = (62, 40, 26, 255) if edge and not dark(p) else p
    # what's left of the patch's outline lies loose under the thing: keep only pieces of a fair size (not the ponds',
    # whose reeds stand on their own)
    if not pond:
        op = out.load()
        seen = [[False] * W for _ in range(H)]
        comps = []
        for y in range(H):
            for x in range(W):
                if seen[y][x] or op[x, y][3] < 20:
                    continue
                seen[y][x] = True
                q2, pts = deque([(x, y)]), []
                while q2:
                    a, b = q2.popleft()
                    pts.append((a, b))
                    for na, nb in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1), (a + 1, b + 1), (a - 1, b - 1), (a + 1, b - 1), (a - 1, b + 1)):
                        if 0 <= na < W and 0 <= nb < H and not seen[nb][na] and op[na, nb][3] >= 20:
                            seen[nb][na] = True
                            q2.append((na, nb))
                comps.append(pts)
        big = max((len(c) for c in comps), default=0)
        for c in comps:
            if len(c) < big * 0.03:
                for a, b in c:
                    op[a, b] = (0, 0, 0, 0)
    box = out.getbbox()
    return (out.crop(box) if box else out), eaten


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=ART)
    a = ap.parse_args()
    man = os.path.join(ART, "manifest.js")
    text = open(man, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    for i in IDS:
        f = os.path.join(a.dir, "prop-" + i + ".webp")
        im, n = clean(Image.open(f), pond=i.startswith("pond"))
        im.save(f, "WEBP", quality=90, method=6)
        if a.dir == ART:
            sizes["prop-" + i] = list(im.size)
        print(f"  prop-{i}.webp {im.size} (-{n} grass)")
    if a.dir == ART:
        open(man, "w", encoding="utf-8").write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
