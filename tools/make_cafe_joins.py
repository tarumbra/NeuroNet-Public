#!/usr/bin/env python3
"""NeuroCafe's long pictures made from short ones (2026-10-25, Cam: "the square table in the game so it can cover two
tiles" and "make it so counters join when placed next to each other"):

  table_long-l / -r     the square table stretched one tile longer (like the buffet from the counter): its near end
                        and far end as painted, the middle repeated between
  <counter>-jf / -jn / -jfn
                        a counter or buffet counter (every counter style, both facings) for a row: -jf has its far end
                        open (the plain middle runs right to where its far end was, and stops); -jn reaches forward
                        to its nearer neighbour, its near end open, tucked under that one's far end. In a row the
                        nearer counter is drawn over the one behind it, so the one behind fills the gap underneath
                        and nothing is drawn over a dish.

Every picture keeps the near piece where the plain picture has it, measured from its top-left (a -r picture: its
top-right), so the game draws it from the same corner, only bigger. Adds them (and the wood colour layers, through
make_cafe_fabric.py) to ui/cafe/art/manifest.js.

    python3 tools/make_cafe_joins.py
"""
import json
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_cafe_templates as T

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
GAP = 0.5      # a counter is drawn half a tile long in its tile's middle: half a tile to the next one's near end
UNDER = 0.12   # how far a reaching counter goes on under its neighbour (past its near end's rim and moulding)
STYLES = ["", "cream", "marble", "mint", "oak", "pink", "red", "slate", "walnut"]


def box(pic, tile_px, side, stretch=0.0, far_open=False, near=0.0, hf=None):
    """A box (painted to the template: its front corner at the bottom middle, a 2:1 footprint) made longer and/or
    opened at its ends. stretch: tiles added in the middle (the far end slid back); far_open: the far end is the plain
    middle, cut off square where it was; near: tiles the near end reaches forward, the plain middle, cut off square.
    side 'l' runs up-left (the front is the left face); 'r' is made as the mirror of 'l'. Distances along the box are
    in the picture's pixels across, like stretch_box's (cut_cafe_art.py) -- one tile is `tile_px`."""
    if side == "r":
        return box(pic.transpose(Image.FLIP_LEFT_RIGHT), tile_px, "l", stretch, far_open, near, hf).transpose(Image.FLIP_LEFT_RIGHT)
    src = pic.convert("RGBA")
    w, h = src.size
    s, e = round(tile_px * stretch), round(tile_px * near)
    sp = src.load()
    out = Image.new("RGBA", (w + s + e, h + (s + e) // 2), (0, 0, 0, 0))
    op = out.load()
    xc = w / 2                                         # the front corner: the picture's middle, at the bottom
    hf = T.FACE * tile_px if hf is None else hf        # how tall the faces are
    xn, hn = xc + e, h + e / 2                         # the front corner, reached forward
    face_top = lambda x: hn - hf - abs(xn - x) / 2     # where the faces meet the top
    xm = xc / 2                                        # the front face's middle column
    along = lambda x, y: -(x + 2 * y) / 2              # how far up-left a point on the top is
    am = along(xc, h - hf) + w / 4                     # the top's middle line
    end = xc / 2                                       # the near end (-end) and the far end (+end), from the middle
    for Y in range(out.height):
        for X in range(out.width):
            x, y = X - s, Y - s // 2                   # in the near piece's own frame
            if x > xn and y > face_top(x):             # the near end's face
                if e:
                    continue                           # (open: under the neighbour)
                u = None
            elif y > face_top(x):                      # the front face: by columns
                u = xm - x
            else:                                      # the top and what's on it: in its plane
                u = along(x, y) - am
            if u is None or (u <= 0 and not e):        # the near half as painted
                sx, sy = x, y
            elif u <= 0:                               # reaching forward: the middle, to the cut
                if u < -end - e:
                    continue
                sx, sy = x + u, y + u / 2
            elif u <= s or (far_open and u <= s + end):
                k = min(u, s) if not far_open else u   # the middle, repeated
                sx, sy = x + k, y + k / 2
            elif far_open:
                continue                               # (open: past its far end)
            else:                                      # the far half as painted, slid back
                sx, sy = x + s, y + s / 2
            sx, sy = round(sx), round(sy)
            if 0 <= sx < w and 0 <= sy < h:
                op[X, Y] = sp[sx, sy]
    return out


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    meta_head, meta_rest = tail.split("window.CafeArtMeta = ", 1)
    meta_json, meta_tail = meta_rest.split(";\n", 1)
    sizes, meta = json.loads(files_json), json.loads(meta_json)
    pics = {}
    # the long table: the square table's top is about as far down as a counter's, so its legs are its "faces"
    sq = Image.open(os.path.join(OUT, "table_square.webp"))
    tile = sq.width / 1.09                             # (drawn a counter's size; tile as the counters')
    pics["table_long-l"] = box(sq, tile, "l", stretch=1)
    pics["table_long-r"] = pics["table_long-l"].transpose(Image.FLIP_LEFT_RIGHT)
    for st in STYLES:
        for side in ("l", "r"):
            cid = f"counter-{st}-{side}" if st else f"counter-{side}"
            path = os.path.join(OUT, cid + ".webp")
            if not os.path.isfile(path) or cid not in meta:
                continue
            pic = Image.open(path)
            tile_px = pic.width / meta[cid]["tile"]
            bid = cid.replace("counter", "buffet", 1)
            for base, stretch in ((cid, 0), (bid, 1)):
                pics[base + "-jf"] = box(pic, tile_px, side, stretch, far_open=True)
                pics[base + "-jn"] = box(pic, tile_px, side, stretch, near=GAP + UNDER)
                pics[base + "-jfn"] = box(pic, tile_px, side, stretch, far_open=True, near=GAP + UNDER)
    for pid, im in pics.items():
        im.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=90, method=6)
        sizes[pid] = list(im.size)
        print(f"  {pid}.webp {im.size}")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n"
                 + meta_head + "window.CafeArtMeta = " + json.dumps(meta, separators=(",", ":")) + ";\n" + meta_tail)


if __name__ == "__main__":
    main()
