#!/usr/bin/env python3
"""NeuroCafe's plain sushi counter (2026-10-26, Cam: "lets make the sushi work the same way as the milkshake one"): the
sushi bar's pictures (Sheet 46: sushibar-l/-bl, their -r/-br mirrors) with the food and the things for making it
lifted off its top and its ledge, which are filled in from the wood round them. Writes ui/cafe/art/
sushishelf-l/-r/-bl/-br.webp and their sizes in ui/cafe/art/manifest.js. Run after cutting Sheet 46.

    python3 tools/make_cafe_sushishelf.py
"""
import json
import os
from collections import deque
from PIL import Image, ImageDraw, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ART = os.path.join(ROOT, "ui", "cafe", "art")


def flood(im, seed, tol=55):
    px = im.load(); W, H = im.size; c0 = px[seed]; seen = {seed}; q = deque([seed])
    ok = lambda p: p[3] > 200 and sum(abs(p[i] - c0[i]) for i in range(3)) < tol * 2
    while q:
        x, y = q.popleft()
        for n in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and ok(px[n]): seen.add(n); q.append(n)
    return seen
# per picture: a point on each wooden surface to flood from, and boxes round what lies on it (plates of sushi, the bamboo
# mats, the cutting board) -- the case of fish, the lucky cat and the soy sauce stay
JOBS = {"l": [((83, 100), [(35, 88, 75, 112), (78, 50, 138, 90)]), ((230, 140), [(106, 180, 140, 202), (146, 151, 190, 179)])],
        "bl": [((117, 100), [(63, 88, 104, 112), (94, 56, 160, 95), (147, 39, 185, 63)]), ((233, 127), [(156, 126, 230, 174)])]}
def hull(pts):
    pts = sorted(set(pts))
    cr = lambda o, a, b: (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
def bare(d):
    im = Image.open(f"{ART}/sushibar-{d}.webp").convert("RGBA"); px = im.load(); W, H = im.size
    for seed, boxes in JOBS[d]:
        s = flood(im, seed)
        hm = Image.new("L", im.size, 0); ImageDraw.Draw(hm).polygon(hull(list(s)), fill=255); hp = hm.load()
        unk = set()
        for (x0, y0, x1, y1) in boxes:
            for x in range(x0 - 2, x1 + 3):
                for y in range(y0 - 2, y1 + 3):
                    if 0 <= x < W and 0 <= y < H and hp[x, y]: unk.add((x, y))
        val = {p: px[p][:3] for p in s if p not in unk}
        for p in unk: val[p] = (230, 190, 140)
        U = list(unk)
        for _ in range(600):
            for (x, y) in U:
                ns = [val[q] for q in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)) if q in val]
                val[(x, y)] = tuple(sum(v[i] for v in ns) / len(ns) for i in range(3))
        for p in U: px[p] = tuple(int(round(c)) for c in val[p]) + (255,)
    return im


def main():
    sizes = {}
    for d, m in (("l", "r"), ("bl", "br")):
        im = bare(d)
        for k, pic in ((d, im), (m, ImageOps.mirror(im))):
            pic.save(os.path.join(ART, f"sushishelf-{k}.webp"), "WEBP", quality=90, method=6)
            sizes[f"sushishelf-{k}"] = list(pic.size)
            print(f"  sushishelf-{k}.webp", pic.size)
    man = os.path.join(ART, "manifest.js")
    text = open(man, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    have = json.loads(files_json)
    have.update(sizes)
    open(man, "w", encoding="utf-8").write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(have.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
