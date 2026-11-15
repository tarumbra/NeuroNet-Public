#!/usr/bin/env python3
"""NeuroCafe's patio side wall (2026-10-25, Cam: "the brick wall is not consistent all the way ... so it alligns with
the ground"): the low brick wall divider (halfbrick-r) made to run on. Each painted piece has its end caps and its
coping overhangs them, so pieces side by side stepped. These are the same painting with its plain middle repeated
along the wall's slope -- a third of a tile at a time, so a tile is a whole number of repeats and piece after piece runs
on seamlessly:

  brickrun-r       repeated all the way (the middle of the wall)
  brickrun-r-near  the painting's own near (left) end, then repeated
  brickrun-r-far   repeated, then the painting's own far (right) end

Same frame as halfbrick-r (twice its size), so the game places them by halfbrick-r's run. Each also gets its swatch
masks (<id>-fab bricks, <id>-fab2 coping), made the same way from halfbrick-r-fab/-fab2 (tools/make_cafe_fabric.py).
Writes ui/cafe/art/<id>.webp and adds them to ui/cafe/art/manifest.js.

    python3 tools/make_cafe_brickrun.py
"""
import json
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
SRC = "halfbrick-r"
RUN = (0.0036, 0.4691, 0.1643, 0.9321, 0.9928, 0.5779)          # manifest CafeArtMeta[halfbrick-r].run
REPEATS = 3                                                     # repeats in a tile's length of wall
C0 = 0.30                                                       # where the repeated strip starts (the plain middle)


def build(name, suffix=""):
    src = Image.open(os.path.join(OUT, name + ".webp")).convert("RGBA")
    src = src.resize((src.width * 2, src.height * 2), Image.LANCZOS)
    W, H = src.size
    lx, ly, bx, by, rx, ry = RUN
    span = (rx - bx) * W                                        # a tile's length of wall, across the picture
    k = ((by - ry) * H) / span                                  # the wall's rise per pixel to the right
    sw = span / REPEATS
    c0 = C0 * W
    c1 = c0 + (REPEATS - 1) * sw                                # where the far end's own painting takes over
    sp = src.load()

    def sample(x, y):                                           # src at a whole column, a fractional row
        y0 = int(y // 1)
        f = y - y0
        a = sp[x, y0] if 0 <= y0 < H else (0, 0, 0, 0)
        b = sp[x, y0 + 1] if 0 <= y0 + 1 < H else (0, 0, 0, 0)
        return tuple(round(a[i] * (1 - f) + b[i] * f) for i in range(4))

    def periodic(x, y):
        s = c0 + ((x - c0) % sw)
        si = min(W - 1, int(round(s)))
        return sample(si, y + (x - si) * k)

    ids = {k: "brickrun-r" + k + suffix for k in ("", "-near", "-far")}
    outs = {n: Image.new("RGBA", (W, H)) for n in ids.values()}
    px = {n: im.load() for n, im in outs.items()}
    for x in range(W):
        for y in range(H):
            p = periodic(x, y)
            px[ids[""]][x, y] = p
            px[ids["-near"]][x, y] = sp[x, y] if x < c0 else p
            px[ids["-far"]][x, y] = sp[x, y] if x >= c1 else p
    return outs


def main():
    outs = build(SRC)
    for sfx in ("-fab", "-fab2"):
        if os.path.exists(os.path.join(OUT, SRC + sfx + ".webp")):
            outs.update(build(SRC + sfx, sfx))
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    for pid, im in outs.items():
        im.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=92, method=6)
        sizes[pid] = list(im.size)
        print(f"  {pid}.webp {im.size}")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
