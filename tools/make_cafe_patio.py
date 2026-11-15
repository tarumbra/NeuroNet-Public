#!/usr/bin/env python3
"""NeuroCafe's patio, stand-in pictures (V24 step 1, 2026-10-25) until Gemini paints them: the outdoor floors (decking,
flagstones, brick paving, gravel) as floor tiles shaped like the café's, and the six railings as fence pieces (drawn
along a tile edge like the street fences, each with its run measured): plain wood (the paddock fence), white picket
(the picket fence), black wrought iron (the picket darkened), glass panels (the half-wall, glassed), rope and posts (the
velvet rope), a low hedge planter (the hedge planter). Adds them to ui/cafe/art/manifest.js (sizes and runs).

    python3 tools/make_cafe_patio.py
"""
import json
import os
from PIL import Image, ImageEnhance, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
# railing -> (the picture it's made from: its -l and -r, and how)
RAILS = {"wood": ("prop-farm_fence", None), "picket": ("prop-fence", None), "iron": ("prop-fence", "iron"),
         "glass": ("halfwall", "glass"), "rope": ("vipropes", None), "hedge": ("planterwall", None)}
# floor -> (a texture, how it's turned)
FLOORS = {"deck": ("floor-oak", "deck"), "flagstone": ("floor-stone", "flag"), "brickpave": ("tex-road", "map"), "gravel": ("tex-gravel", "map")}


def iron(im):
    """The white picket, black: dark iron with its light edges kept as a sheen."""
    a = im.getchannel("A")
    g = ImageOps.grayscale(im.convert("RGB"))
    g = g.point(lambda v: int(18 + v * 0.32))
    out = Image.merge("RGB", (g, g, g.point(lambda v: min(255, v + 6))))
    out.putalpha(a)
    return out


def glass(im):
    """The half-wall's white panels turned to pale glass (see-through), its wood top rail kept."""
    px = im.convert("RGBA").load()
    w, h = im.size
    out = Image.new("RGBA", im.size)
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) > 170 and max(r, g, b) - min(r, g, b) < 40:      # (the white paint)
                op[x, y] = (200, 228, 240, int(a * 0.45))
            else:
                op[x, y] = (r, g, b, a)
    return out


def tile_from(tex, how):
    """A floor tile: a square texture laid on the café floor tile's top (its diamond), shaded like the grey stone's."""
    base = Image.open(os.path.join(OUT, "floor-grey.webp")).convert("RGBA")
    W, H = base.size
    src = Image.open(os.path.join(OUT, tex + ".webp")).convert("RGB")
    if how == "deck":                        # weathered grey-brown boards
        out = ImageEnhance.Color(Image.open(os.path.join(OUT, tex + ".webp")).convert("RGBA")).enhance(0.45)
        return ImageEnhance.Brightness(out).enhance(0.92)
    if how == "flag":                        # cooler, greyer stone
        out = ImageEnhance.Color(Image.open(os.path.join(OUT, tex + ".webp")).convert("RGBA")).enhance(0.25)
        return ImageEnhance.Brightness(out).enhance(0.95)
    # (map) the texture onto the diamond: the top face is the full width, half as tall (the 2:1 grid)
    S = src.size[0]
    top_h = W / 2
    sp, bp = src.load(), base.load()
    out = Image.new("RGBA", (W, H))
    op = out.load()
    ref = [bp[x, y][0] for y in range(H) for x in range(W) if bp[x, y][3] > 200]
    mean = sum(ref) / max(1, len(ref))
    for y in range(H):
        for x in range(W):
            r0, g0, b0, a0 = bp[x, y]
            if not a0:
                continue
            yy = min(y, top_h)                                       # (the slab's edge: the texture's edge, shaded)
            u = (x / W + yy / top_h) - 0.5
            v = (yy / top_h - x / W) + 0.5
            c = sp[int(max(0, min(0.999, u)) * S), int(max(0, min(0.999, v)) * S)]
            k = r0 / mean
            op[x, y] = (min(255, int(c[0] * k)), min(255, int(c[1] * k)), min(255, int(c[2] * k)), a0)
    return out


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    meta_head, meta_rest = tail.split("window.CafeArtMeta = ", 1)
    meta_json, meta_tail = meta_rest.split(";\n", 1)
    sizes, meta = json.loads(files_json), json.loads(meta_json)
    for rid, (src, how) in RAILS.items():
        for side in ("l", "r"):
            im = Image.open(os.path.join(OUT, f"{src}-{side}.webp")).convert("RGBA")
            im = iron(im) if how == "iron" else glass(im) if how == "glass" else im
            pid = f"prop-rail_{rid}-{side}"
            im.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=90, method=6)
            sizes[pid] = list(im.size)
            meta[pid] = dict(meta[f"{src}-{side}"], fence=1)
            print(f"  {pid}.webp {im.size}")
    for fid, (tex, how) in FLOORS.items():
        im = tile_from(tex, how)
        pid = "floor-" + fid
        im.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=90, method=6)
        sizes[pid] = list(im.size)
        print(f"  {pid}.webp {im.size}")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n"
                 + meta_head + "window.CafeArtMeta = " + json.dumps(meta, separators=(",", ":")) + ";\n" + meta_tail)


if __name__ == "__main__":
    main()
