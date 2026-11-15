#!/usr/bin/env python3
"""NeuroCafe: take what Gemini painted BEHIND a tree out of its cut picture (2026-10-25, N54 -- Cam: "there is identified
clipping in the trees artwork"). Sheet 33's pine came with a yellow-green bush behind its left side and the cypress with
a clump of flowers behind its right. The tree is kept: its foliage (the biggest patch of true green -- green well above
red), the brown trunk under the middle of it, anything enclosed by them, and its own dark outline round the edge; the
rest goes. Run after tools/cut_cafe_art.py has cut Sheet 33 (cutting again brings the clutter back):

    python3 tools/fix_cafe_trees.py [ids...]          (default: prop-tree_pine prop-tree_cypress, and prop-rock_slab's pink)
"""
import os
import sys
from collections import deque
from PIL import Image, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "cafe", "art")
TREES = ["prop-tree_pine", "prop-tree_cypress"]
PINKED = ["prop-rock_slab"]
GLOWED = []                                                  # (none now: the cutter's "unglow" flag does it before the slant)                                  # (Sheet 32: a pink smear left under the stepping stone)
PANELED = ["web-1", "web-3", "web-4"]
GRIDLINED = []                                               # (none: the cutter's "gridfill" flag takes grid lines off first)                        # (Halloween Walls 2: cobwebs painted on the template's wall panel)


def _unused_biggest(mask, w, h):
    """The largest 4-connected patch of a boolean mask (a flat list)."""
    seen, best = bytearray(w * h), []
    for start in range(w * h):
        if not mask[start] or seen[start]:
            continue
        part, q = [], deque([start])
        seen[start] = 1
        while q:
            i = q.popleft()
            part.append(i)
            x, y = i % w, i // w
            for j in ((i - 1) if x else -1, (i + 1) if x < w - 1 else -1, i - w, i + w):
                if 0 <= j < w * h and mask[j] and not seen[j]:
                    seen[j] = 1
                    q.append(j)
        if len(part) > len(best):
            best = part
    out = bytearray(w * h)
    for i in best:
        out[i] = 1
    return out


def fill_holes(mask, w, h):
    """Everything the mask encloses (not reachable from the picture's edge without crossing it)."""
    outside, q = bytearray(w * h), deque()
    for i in list(range(w)) + list(range(w * (h - 1), w * h)) + list(range(0, w * h, w)) + list(range(w - 1, w * h, w)):
        if not mask[i] and not outside[i]:
            outside[i] = 1
            q.append(i)
    while q:
        i = q.popleft()
        x = i % w
        for j in ((i - 1) if x else -1, (i + 1) if x < w - 1 else -1, i - w, i + w):
            if 0 <= j < w * h and not mask[j] and not outside[j]:
                outside[j] = 1
                q.append(j)
    return bytearray(0 if outside[i] else 1 for i in range(w * h))


def parts(mask, w, h):
    """4-connected patches of a boolean mask: a label per pixel (0 = none) and each patch's pixels."""
    lab, groups = [0] * (w * h), [None]
    for start in range(w * h):
        if not mask[start] or lab[start]:
            continue
        n = len(groups)
        part, q = [], deque([start])
        lab[start] = n
        while q:
            i = q.popleft()
            part.append(i)
            x = i % w
            for j in ((i - 1) if x else -1, (i + 1) if x < w - 1 else -1, i - w, i + w):
                if 0 <= j < w * h and mask[j] and not lab[j]:
                    lab[j] = n
                    q.append(j)
        groups.append(part)
    return lab, groups


def fix(pid):
    """Split the picture along its dark lines into patches; keep the patches that are mostly true green (the foliage)
    or the brown trunk under its middle, then the dark lines that touch what's kept (the tree's outline and its
    strokes) -- a bush or flowers behind it are patches of their own, behind the tree's outline, and go."""
    path = os.path.join(OUT, pid + ".webp")
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = list(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata())
    dark = [a > 40 and (r + g + b) / 3 < 80 and g <= 1.15 * r for r, g, b, a in px]   # (the brown ink, not dark green shade)
    solid = [a > 40 and not dark[i] for i, (r, g, b, a) in enumerate(px)]
    green = [g > 1.3 * r and g >= b for r, g, b, a in px]
    brown = [r > g > b and r - b > 30 for r, g, b, a in px]
    lab, groups = parts(solid, w, h)
    gx = [i % w for i in range(w * h) if solid[i] and green[i]]
    mid = sum(gx) / max(1, len(gx))
    kept = bytearray(w * h)
    for part in groups[1:]:
        gf = sum(green[i] for i in part) / len(part)
        cx = sum(i % w for i in part) / len(part)
        cy = sum(i // w for i in part) / len(part)
        trunk = cy > h * 0.55 and abs(cx - mid) < w * 0.25 and sum(brown[i] for i in part) / len(part) > 0.35   # (its bark strokes cut it into pieces)
        if gf > 0.4 or trunk:
            for i in part:
                kept[i] = 1
    # the trunk: everything solid under the foliage's lowest point near the middle (a bush behind ends higher up)
    low = max((i // w for i in range(w * h) if kept[i] and green[i] and abs(i % w - mid) < w * 0.1), default=h)
    for i in range(w * h):
        if px[i][3] > 40 and i // w > low - h * 0.03 and abs(i % w - mid) < w * 0.3:
            kept[i] = 1
    near = list(Image.frombytes("L", (w, h), bytes(255 if k else 0 for k in kept)).filter(ImageFilter.MaxFilter(7)).tobytes())
    keep = bytearray(w * h)
    for i in range(w * h):
        keep[i] = 1 if kept[i] or (dark[i] and near[i]) else 0
    keep = fill_holes(keep, w, h)                            # (little bits the strokes close in)
    alpha = bytes(px[i][3] if keep[i] else 0 for i in range(w * h))
    im.putalpha(Image.frombytes("L", (w, h), alpha))
    box = im.getbbox()
    im = im.crop((box[0], 0, box[2], h))                     # (trimmed at the sides; the feet stay where they were)
    im.save(path, "WEBP", quality=90, method=6)
    print(f"  {pid}.webp {im.size} (was {w}x{h})")
    return im.size


def depink(pid):
    """The background's pink left on a picture as a smear (not touching the edge, so dehalo misses it): pinkish pixels
    lighter than the dark ink outline go -- blue above green, red well above both."""
    path = os.path.join(OUT, pid + ".webp")
    im = Image.open(path).convert("RGBA")
    px = list(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata())
    im.putalpha(Image.frombytes("L", im.size, bytes(0 if (b > g + 5 and r > g + 40 and (r + g + b) / 3 > 70) else a for r, g, b, a in px)))
    im.save(path, "WEBP", quality=90, method=6)
    print(f"  {pid}.webp: pink smear taken off")
    return im.size


def unpanel(pid):
    """A cobweb painted on the template's wall panel (Halloween - Walls 2): the strands (bright) are kept, and the dark
    only where it hugs a strand (their outlines) or is thick (the spider); the panel's fill and its border go."""
    path = os.path.join(OUT, pid + ".webp")
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = list(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata())
    lum = [(r + g + b) / 3 for r, g, b, a in px]
    core = Image.frombytes("L", (w, h), bytes(255 if a > 200 and l > 200 else 0 for (r, g, b, a), l in zip(px, lum)))
    hug = list(core.filter(ImageFilter.MaxFilter(5)).tobytes())
    dark = Image.frombytes("L", (w, h), bytes(255 if a > 60 and l < 110 else 0 for (r, g, b, a), l in zip(px, lum)))
    blob = list(dark.filter(ImageFilter.MinFilter(11)).filter(ImageFilter.MaxFilter(17)).tobytes())   # (thin lines vanish, the spider stays)
    cb = core.tobytes()
    keep = bytes(px[i][3] if (cb[i] or (hug[i] and lum[i] < 200 and px[i][3] > 160) or (blob[i] and lum[i] < 110)) else 0 for i in range(w * h))
    im.putalpha(Image.frombytes("L", (w, h), keep))
    # the panel's upright sides (thick dark bars down the left and right): dark near the outer edges goes
    box = im.getbbox()
    al = bytearray(im.getchannel("A").tobytes())
    edge = max(8, round(w * 0.05))
    for i in range(w * h):
        x = i % w
        if al[i] and lum[i] < 110 and (x < box[0] + edge or x >= box[2] - edge):
            al[i] = 0
    im.putalpha(Image.frombytes("L", (w, h), bytes(al)))
    im = im.crop(im.getbbox())
    im.save(path, "WEBP", quality=90, method=6)
    print(f"  {pid}.webp: the panel under it taken off")
    return im.size


GUESTS = ["dracula", "frank", "witch", "pumpkinhead"]


def guests(sizes, meta):
    """The Halloween guests once painted (Characters Sheets 09-11): the stand-ins' walking frames (the regulars'
    recoloured -- the page would show those over the painting) are taken out, and the down-right and up-right
    pictures made as the painted down-left and up-left ones mirrored (tr from tl, al from ar)."""
    from PIL import ImageOps
    for g in GUESTS:
        for pose in ("tl", "ar"):
            for i in range(1, 5):
                pid = f"{g}-{pose}-{i}"
                if os.path.exists(os.path.join(OUT, pid + ".webp")):
                    os.remove(os.path.join(OUT, pid + ".webp"))
                sizes.pop(pid, None)
                meta.pop(pid, None)
        for src, dst in (("tl", "tr"), ("ar", "al")):
            im = Image.open(os.path.join(OUT, f"{g}-{src}.webp"))
            ImageOps.mirror(im).save(os.path.join(OUT, f"{g}-{dst}.webp"), "WEBP", quality=90, method=6)
            sizes[f"{g}-{dst}"] = list(im.size)
        print(f"  {g}: walking frames out, -tr and -al mirrored")


def ungrid(pid):
    """A stub of the sheet's grid line poking out each side (Sheet 41): going down, each side of the outline moves out
    a little row by row; a sudden jump of more than 5 pixels in one row is the line -- those pixels (beyond where the
    side was heading) are cleared, for the line's few rows, and the side carries on from where it was."""
    path = os.path.join(OUT, pid + ".webp")
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    a = im.getchannel("A").load()
    p = im.load()
    prev = None
    for y in range(h // 2):
        xs = [x for x in range(w) if a[x, y] > 60]
        if not xs:
            continue
        lo, hi = xs[0], xs[-1]
        if prev:
            plo, phi = prev
            if plo - lo > 5 or hi - phi > 5:            # jumped out: the grid line
                nlo, nhi = (plo - 2 if plo - lo > 5 else lo), (phi + 2 if hi - phi > 5 else hi)
                for x in xs:
                    if x < nlo or x > nhi:
                        r, g, b, al = p[x, y]
                        p[x, y] = (r, g, b, 0)
                lo, hi = nlo, nhi
        prev = (lo, hi)
    im = im.crop(im.getbbox())
    im.save(path, "WEBP", quality=90, method=6)
    print(f"  {pid}.webp: grid-line stubs taken off")
    return im.size


def unglow(pid):
    """A wall light Gemini painted with a glow round it (N61's Sheet 39): the faint half-see-through ring goes, and any
    pink left in it -- the flame (orange: little blue) and the white bulb stay."""
    path = os.path.join(OUT, pid + ".webp")
    im = Image.open(path).convert("RGBA")
    px = list(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata())
    keep = []
    for r, g, b, a in px:
        pink = r - g > 22 and b - g > -12 and (r + g + b) / 3 > 85
        keep.append(0 if a < 190 or pink else a)
    im.putalpha(Image.frombytes("L", im.size, bytes(keep)))
    im = im.crop(im.getbbox())
    im.save(path, "WEBP", quality=90, method=6)
    print(f"  {pid}.webp: painted glow taken off")
    return im.size


def main():
    import json
    if sys.argv[1:] == ["--guests"]:                     # (after cutting Characters Sheets 09-11)
        man = os.path.join(OUT, "manifest.js")
        text = open(man, encoding="utf-8").read()
        head, rest = text.split("window.CafeArtFiles = ", 1)
        files_json, tail = rest.split(";\n", 1)
        mhead, mrest = tail.split("window.CafeArtMeta = ", 1)
        meta_json, mtail = mrest.split(";\n", 1)
        sizes, meta = json.loads(files_json), json.loads(meta_json)
        guests(sizes, meta)
        with open(man, "w", encoding="utf-8") as fh:
            fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n"
                     + mhead + "window.CafeArtMeta = " + json.dumps(dict(sorted(meta.items())), separators=(",", ":")) + ";\n" + mtail)
        return
    ids = sys.argv[1:] or TREES
    man = os.path.join(OUT, "manifest.js")
    text = open(man, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    for pid in ids:
        sizes[pid] = list(depink(pid) if pid in PINKED else unpanel(pid) if pid in PANELED else unglow(pid) if pid in GLOWED else ungrid(pid) if pid in GRIDLINED else fix(pid))
    if not sys.argv[1:]:
        for pid in PINKED:
            sizes[pid] = list(depink(pid))
        for pid in PANELED:
            sizes[pid] = list(unpanel(pid))
        for pid in GLOWED:
            sizes[pid] = list(unglow(pid))
        for pid in GRIDLINED:
            sizes[pid] = list(ungrid(pid))
    with open(man, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
