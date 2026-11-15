#!/usr/bin/env python3
"""NeuroVale's visitors for NeuroCafe (2026-10-22, Cam: "the first blend of the two game worlds").

The request cart: one of NeuroPets' guild hall tutors drives in from NeuroVale with an order, waits out the front with
the cart and horse, and leaves a potion -- now and then a NeuroVale keepsake for the street. This lays NeuroPets' own
pictures straight into the game (ui/cafe/art/<id>.webp, at most 300 on a side, and their sizes into manifest.js, which
tools/cut_cafe_art.py keeps), and, for Cam to look at or paint over, as a sheet in his art folder (Icons/NeuroVale/).
They're NOT cut from the sheet: NeuroPets' pictures are already clear around the edges, and the pink flood turned the
cart's cream trim pink. The pictures: the cart (NeuroPets' pony cart with the bay draft horse in front, a stand-in until
one's painted for the street), the six tutors, and the seven keepsakes.

Run: python3 tools/make_cafe_neurovale.py"""
import json
import os
from PIL import Image, ImageDraw, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
PETS = os.path.join(HERE, "..", "ui", "pet", "art")
GAME = os.path.join(HERE, "..", "ui", "cafe", "art")
OUT = os.path.expanduser("~/Pictures/NeuroCafe Art Assets/Icons/NeuroVale")
PINK, GRID = (195, 66, 131), (60, 20, 30)

# cell order: (cut id, NeuroPets picture) -- "cart" is put together below
CELLS = [("cart-vale", None),
         ("tutor-pip", "people/pip"), ("tutor-wren", "people/wren"), ("tutor-brakka", "people/brakka"),
         ("tutor-ilse", "people/ilse"), ("tutor-aldo", "people/aldo"), ("tutor-tamsin", "people/tamsin"),
         ("prop-vale_chest", "icons/ancientchest"), ("prop-vale_dummy", "icons/obj_dummy"), ("prop-vale_anvil", "icons/obj_anvil"),
         ("prop-vale_wispjar", "icons/wispjar"), ("prop-vale_grindstone", "icons/obj_grindstone"), ("prop-vale_hives", "icons/obj_hives"),
         ("prop-vale_pond", "icons/obj_pond")]


def pic(name):
    im = Image.open(os.path.join(PETS, name + ".webp")).convert("RGBA")
    return im.crop(im.getbbox())


def cart():
    """The pony cart, the bay draft horse turned to pull it, standing between its shafts."""
    c = pic("icons/obj_ponycart")
    c = c.resize((c.width * 5 // 2, c.height * 5 // 2), Image.LANCZOS)
    h = ImageOps.mirror(pic("livestock/drafthorse-bay-a"))
    h = h.resize((h.width * 88 // 100, h.height * 88 // 100), Image.LANCZOS)
    ov = 125
    w, ht = h.width + c.width - ov, max(c.height, h.height) + 4
    out = Image.new("RGBA", (w, ht), (0, 0, 0, 0))
    out.paste(c, (w - c.width, ht - c.height - 6), c)
    out.paste(h, (0, ht - h.height), h)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    c, box = 512, 440
    im = Image.new("RGB", (2048, 2048), PINK)
    for k, (cid, src) in enumerate(CELLS):
        p = cart() if src is None else pic(src)
        sc = min(box / p.width, box / p.height)
        p = p.resize((round(p.width * sc), round(p.height * sc)), Image.LANCZOS)
        x0, y0 = (k % 4) * c, (k // 4) * c
        im.paste(p, (x0 + (c - p.width) // 2, y0 + (c - p.height) // 2), p)
    d = ImageDraw.Draw(im)
    for i in range(1, 4):
        d.line([(i * c, 0), (i * c, 2048)], fill=GRID, width=6)
        d.line([(0, i * c), (2048, i * c)], fill=GRID, width=6)
    im.save(os.path.join(OUT, "Icon - NeuroVale Sheet 1 - Visitors.png"))
    # into the game, and its picture list
    man = os.path.join(GAME, "manifest.js")
    text = open(man, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    sizes = json.loads(rest.split(";\n", 1)[0])
    for cid, src in CELLS:
        p = cart() if src is None else pic(src)
        sc = min(1, 300 / max(p.size))
        p = p.resize((round(p.width * sc), round(p.height * sc)), Image.LANCZOS)
        p.save(os.path.join(GAME, cid + ".webp"), "WEBP", quality=90, method=6)
        sizes[cid] = [p.width, p.height]
    open(man, "w", encoding="utf-8").write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":"))
                                           + ";\n" + rest.split(";\n", 1)[1])
    print(f"NeuroVale: {len(CELLS)} pictures into the game, and the sheet")


if __name__ == "__main__":
    main()
