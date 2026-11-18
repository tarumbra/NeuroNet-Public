#!/usr/bin/env python3
"""The coffee counters' stand-in pictures (2026-11-18, Cam, PT59 c9: "a barista counter and a coffee serving counter
that works like the milkshake counters"). Until their own sheet is painted, each is made from the plain milkshake
counter in all four turns, its mint panels turned to a coffee brown:

    coffeeshelf-<turn>   the coffee serving counter: the plain counter, brown
    coffeebar-<turn>     the barista counter: the same, with the espresso machine (Counter Sheet 2) standing on top

Their swatch layer (-fab) is the counter's own mint layer, so the swatches recolour the panels and never the machine
or its cups. Adds them to ui/cafe/art/manifest.js. Run it again after make_cafe_fabric.py has remade shakeshelf-*-fab.

    python3 tools/make_cafe_coffee.py
"""
import colorsys
import json
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ART = os.path.join(ROOT, "ui", "cafe", "art")
TURNS = ("l", "r", "bl", "br")
HUE, SAT, VAL = 28 / 360, 1.7, 0.66          # the brown: hue 28, more saturated and darker than the mint
CREAM = 38 / 360                             # the pale glass top and trims: a warm cream
# where the espresso machine stands on each turn of the counter: its turn, its width as a share of the counter's, and
# where its foot's middle goes (shares of the counter picture) -- the back half of the bare top
MACHINE = {"l": ("l", 0.42, 0.40, 0.40), "r": ("r", 0.42, 0.60, 0.40),
           "bl": ("bl", 0.40, 0.42, 0.36), "br": ("br", 0.40, 0.58, 0.36)}


def brown(pic, fab):
    """pic with every mint pixel turned: the painted panels (the fab layer's, or any strong mint) to coffee brown, the
    pale mint glass top and trims to a warm cream. Outlines and greys are left as they are."""
    out = pic.copy()
    px, fp = out.load(), fab.load()
    for y in range(pic.height):
        for x in range(pic.width):
            r, g, b, a = px[x, y]
            if a < 5:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            mint = 85 / 360 <= h <= 225 / 360 and s >= 0.02 and v >= 0.3   # (the glass runs from mint to a pale blue)
            k = fp[x, y][3] / 255
            if not mint and k <= 0:
                continue
            if k > 0.05 or s >= 0.22:
                nr, ng, nb = colorsys.hsv_to_rgb(HUE, min(1.0, s * SAT + 0.12), v * VAL)
            else:
                nr, ng, nb = colorsys.hsv_to_rgb(CREAM, min(1.0, s * 1.6 + 0.06), min(1.0, v * 1.02))
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return out


def tinted_fab(fab, pic):
    """The swatch layer: the browned pixels, where the mint layer was."""
    out = pic.copy()
    out.putalpha(fab.getchannel("A"))
    return out


def main():
    man_path = os.path.join(ART, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    for t in TURNS:
        pic = Image.open(os.path.join(ART, f"shakeshelf-{t}.webp")).convert("RGBA")
        fab = Image.open(os.path.join(ART, f"shakeshelf-{t}-fab.webp")).convert("RGBA")
        shelf = brown(pic, fab)
        shelf_fab = tinted_fab(fab, shelf)
        mt, share, fx, fy = MACHINE[t]
        mac = Image.open(os.path.join(ART, f"espresso-{mt}.webp")).convert("RGBA")
        bb = mac.getbbox()
        mac = mac.crop(bb)
        w = int(shelf.width * share)
        mac = mac.resize((w, int(mac.height * w / mac.width)), Image.LANCZOS)
        # the machine may stand above the counter's top edge: the picture grows upward to fit it
        foot_x, foot_y = int(shelf.width * fx), int(shelf.height * fy)
        top = foot_y - mac.height
        lift = max(0, -top)
        H = shelf.height + lift
        bar = Image.new("RGBA", (shelf.width, H), (0, 0, 0, 0))
        bar.alpha_composite(shelf, (0, lift))
        bar.alpha_composite(mac, (foot_x - w // 2, top + lift))
        bar_fab = Image.new("RGBA", (shelf.width, H), (0, 0, 0, 0))
        bar_fab.alpha_composite(shelf_fab, (0, lift))
        hole = Image.new("RGBA", (shelf.width, H), (0, 0, 0, 0))
        hole.alpha_composite(mac, (foot_x - w // 2, top + lift))
        a = bar_fab.getchannel("A")
        bar_fab.putalpha(Image.composite(Image.new("L", a.size, 0), a, hole.getchannel("A").point(lambda v: 255 if v > 20 else 0)))
        for pid, im in ((f"coffeeshelf-{t}", shelf), (f"coffeeshelf-{t}-fab", shelf_fab), (f"coffeebar-{t}", bar), (f"coffeebar-{t}-fab", bar_fab)):
            im.save(os.path.join(ART, pid + ".webp"), "WEBP", quality=90, method=6)
            sizes[pid] = list(im.size)
            print(f"  {pid}.webp {im.size}")
    files = json.dumps(dict(sorted(sizes.items())), separators=(",", ":"))
    open(man_path, "w", encoding="utf-8").write(head + "window.CafeArtFiles = " + files + ";\n" + tail)


if __name__ == "__main__":
    main()
