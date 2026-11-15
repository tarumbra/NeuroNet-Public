#!/usr/bin/env python3
"""Cut Cam's four new player pictures into NeuroPets (2026-10-11): a young man and a young woman, standing and fighting.
Customisation (skin, hair, tunic) is shelved; worn armour will be drawn onto these exact bodies.

    python3 tools/cut_player_bodies.py

Reads ~/Pictures/NeuroPets Art Assets/Player/New/"<Male|Female> - <Standing|Fighting>.jpeg" (one figure on flat pink).
Writes ui/pet/art/player/body-<m|f>-<a|fight>.webp, trimmed to the figure, HEIGHT px tall. The man and the woman are cut
with the same crop and scale per pose, so they stay lined up (the woman is an edit of the man) and armour fits both."""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_icon_sheet import cut_cell

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "ui", "pet", "art", "player")
SRC = os.path.expanduser("~/Pictures/NeuroPets Art Assets/Player/New")
HEIGHT = 600
PAD = 40                      # the boots touch the picture's bottom edge: pad with the background so nothing is trimmed off

def keyed(path):
    im = Image.open(path).convert("RGB")
    bg = sorted(im.getpixel(xy) for xy in ((4, 4), (im.width - 5, 4), (4, im.height // 2), (im.width - 5, im.height // 2)))[1]
    big = Image.new("RGB", (im.width + 2 * PAD, im.height + 2 * PAD), bg)
    big.paste(im, (PAD, PAD))
    return cut_cell(big, inset=14)

POSES = (("a", "Standing"), ("fight", "Fighting"))

def frame(pose):
    """The pose's keyed pictures and the one crop box both bodies share. Worn armour (tools/lift_worn.py) is cut with
    the same box and scale, so it lands pixel-for-pixel on either body."""
    name = dict(POSES)[pose]
    pics = {}
    for body, who in (("m", "Male"), ("f", "Female")):
        path = os.path.join(SRC, "%s - %s.jpeg" % (who, name))
        if not os.path.exists(path): sys.exit("missing: " + path)
        pics[body] = keyed(path)
    boxes = [p.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox() for p in pics.values()]
    return pics, (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))

def fit(im, box):
    """A keyed picture (same size as the bodies') cropped and scaled like the body sprites."""
    c = im.crop(box)
    return c.resize((round(c.width * HEIGHT / c.height), HEIGHT), Image.LANCZOS)

def main():
    for pose, _ in POSES:
        pics, box = frame(pose)          # one crop for both, so the pair stays lined up
        for body, p in pics.items():
            c = fit(p, box)
            dst = os.path.join(OUT, "body-%s-%s.webp" % (body, pose))
            c.save(dst, "WEBP", quality=90, method=6)
            print("wrote", os.path.relpath(dst, os.path.dirname(HERE)), c.size)

if __name__ == "__main__":
    main()
