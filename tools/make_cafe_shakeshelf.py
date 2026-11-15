#!/usr/bin/env python3
"""NeuroCafe's plain milkshake counter (2026-10-26, Cam: "same design as the one in the game but with a bare top"):
the milkshake counter's pictures (Sheet 46: shakebar-l/-bl, their -r/-br mirrors) with the blender and glasses lifted
off. The top is found by flooding its pale surface; what stood on it is filled in from the surface round it, and where
something stood over the back edge the edge is drawn on along the line of the rest of it. Writes ui/cafe/art/
shakeshelf-l/-r/-bl/-br.webp and their sizes in ui/cafe/art/manifest.js. Run after cutting Sheet 46.

    python3 tools/make_cafe_shakeshelf.py
"""
import json
import os
from collections import deque
from PIL import Image, ImageDraw, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ART = os.path.join(ROOT, "ui", "cafe", "art")


def light(p): return p[3] > 200 and min(p[:3]) > 135 and max(p[:3]) - min(p[:3]) < 50
def flood(im, seed):
    px = im.load(); W, H = im.size; seen = {seed}; q = deque([seed])
    while q:
        x, y = q.popleft()
        for n in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and light(px[n]): seen.add(n); q.append(n)
    return seen
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
def fit(ps):
    n = len(ps); sx = sum(p[0] for p in ps); sy = sum(p[1] for p in ps)
    sxx = sum(p[0]*p[0] for p in ps); sxy = sum(p[0]*p[1] for p in ps)
    b = (n*sxy - sx*sy) / (n*sxx - sx*sx); return (sy - b*sx) / n, b
def bare(d, seed):
    """One picture with its top bare."""
    im = Image.open(f"{ART}/shakebar-{d}.webp").convert("RGBA"); W, H = im.size
    px = im.load(); orig = im.copy(); op = orig.load(); s = flood(im, seed)
    hm = Image.new("L", im.size, 0); ImageDraw.Draw(hm).polygon(hull(list(s)), fill=255); hp = hm.load()
    top = {}
    for x in range(W):
        for y in range(H):
            if hp[x, y]: top[x] = y; break
    def run(x):
        n = 0
        while top[x]-1-n >= 0 and op[x, top[x]-1-n][3] > 40: n += 1
        return n
    runs = {x: run(x) for x in top}; xs = sorted(top)
    lmin = {x: min(runs[c] for c in xs if abs(c - x) <= 30) for x in xs}
    clean = {x for x in xs if runs[x] <= lmin[x] + 2 and xs[0] + 8 < x < xs[-1] - 8}
    xc = min(xs, key=lambda x: top[x])
    for _ in range(3):                                   # the back corner: where the two back edges' lines cross
        L = fit([(x, top[x]) for x in clean if x < xc - 6]); R = fit([(x, top[x]) for x in clean if x > xc + 6])
        xc = (L[0] - R[0]) / (R[1] - L[1])
        ln = lambda x: (L if x < xc else R)
        clean = {x for x in clean if abs(top[x] - (ln(x)[0] + ln(x)[1]*x)) <= 1.5}
    K = {sd: sorted(runs[x] for x in clean if (x < xc) == sd)[len([x for x in clean if (x < xc) == sd]) // 2] for sd in (True, False)}
    clean = {x for x in clean if abs(runs[x] - K[x < xc]) <= 1}
    edge = lambda x: max(L[0] + L[1]*x, R[0] + R[1]*x)
    inner = [x for x in xs if xs[0] + 8 < x < xs[-1] - 8]
    clean = {x for x in clean if all(c in clean for c in range(x - 5, x + 6) if c in inner)}   # (a lifted thing's edges too)
    unk = set(p for p in ((x, y) for x in range(W) for y in range(H)) if hp[p] and p not in s)
    for x in xs:
        if not (xs[0] + 8 < x < xs[-1] - 8): continue
        t = int(round(edge(x))) if x not in clean else top[x]
        side = [c for c in clean if (c < xc) == (x < xc) and runs[c] == K[x < xc]] or [c for c in clean if (c < xc) == (x < xc)]
        c = x if x in clean else min(side, key=lambda c: abs(c - x))
        for y in range(t, top[x]): unk.add((x, y))
        for y in range(0, t):
            k = t - y
            px[x, y] = op[c, top[c] - k] if k <= runs[c] and top[c] - k >= 0 else (0, 0, 0, 0)
    near = set()
    for (x, y) in unk:
        for dx in range(-3, 4):
            for dy in range(-3, 4): near.add((x + dx, y + dy))
    shade = lambda c: c[0] > c[1] + 1
    for p in list(s):
        if p in near or shade(op[p]): unk.add(p)
    val = {p: op[p][:3] for p in s if p not in unk}
    mean = tuple(sum(v[i] for v in val.values()) / len(val) for i in range(3))
    for p in unk: val[p] = mean
    U = list(unk)
    for _ in range(500):
        for (x, y) in U:
            ns = [val[q] for q in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)) if q in val]
            val[(x, y)] = tuple(sum(v[i] for v in ns) / len(ns) for i in range(3))
    for p in U: px[p] = tuple(int(round(c)) for c in val[p]) + (255,)
    return im


def main():
    sizes = {}
    # (a point on each picture's bare surface to flood from)
    for d, m, seed in (("l", "r", (83, 117)), ("bl", "br", (100, 100))):
        im = bare(d, seed)
        for k, pic in ((d, im), (m, ImageOps.mirror(im))):
            pic.save(os.path.join(ART, f"shakeshelf-{k}.webp"), "WEBP", quality=90, method=6)
            sizes[f"shakeshelf-{k}"] = list(pic.size)
            print(f"  shakeshelf-{k}.webp", pic.size)
    man = os.path.join(ART, "manifest.js")
    text = open(man, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    have = json.loads(files_json)
    have.update(sizes)
    open(man, "w", encoding="utf-8").write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(have.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
