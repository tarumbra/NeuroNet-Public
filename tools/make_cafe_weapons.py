#!/usr/bin/env python3
"""NeuroCafe's wall weapons (2026-10-24, Cam: "use my weapon art from NeuroPets ... for wall decor" -- singles and
arrangements, by level, the sandbox first). Built from the NeuroPets icons (ui/pet/art/icons, 128px, the same outlined
style): a single weapon on a wooden plaque; two longswords crossed on a plaque; a kite shield over two crossed swords;
two staves crossed (and each bare, wpnb-<id>, for its painted mount -- N51). Drawn front-on and flat -- the game tilts them onto the wall. Writes ui/cafe/art/wpn-<id>.webp and
adds them to ui/cafe/art/manifest.js. The list (ids, icons, kinds) must match cafecore.js WEAPONS.

    python3 tools/make_cafe_weapons.py
"""
import json
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ICONS = os.path.join(ROOT, "ui", "pet", "art", "icons")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
S = 220                                               # each picture's square canvas
INK, WOOD, WOOD_D, WOOD_L = (58, 29, 20, 255), (139, 90, 50, 255), (104, 64, 34, 255), (168, 116, 70, 255)

METALS = ["bronze", "iron", "steel", "mithril", "adamant", "rune"]
SINGLES = ["sword", "mace", "longsword", "maul", "kiteshield"]
EXTRAS = ["woodenclub", "shortbow", "boneaxe", "longbow", "firestaff", "fangspear", "yewbow", "mysticstaff", "magicbow"]


def icon(name, scale=1.0):
    im = Image.open(os.path.join(ICONS, name + ".webp")).convert("RGBA")
    im = im.crop(im.getbbox())
    if scale != 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    return im


BARE = False                                          # N51: the weapon alone, for setting into a painted mount


def plaque():
    """A wooden plaque: a rounded board with a bevel and a little grain, outlined like the icons."""
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    if BARE:
        return im
    d = ImageDraw.Draw(im)
    box = (22, 30, S - 22, S - 30)
    d.rounded_rectangle(box, radius=34, fill=WOOD, outline=INK, width=7)
    d.rounded_rectangle((box[0] + 14, box[1] + 14, box[2] - 14, box[3] - 14), radius=22, outline=WOOD_D, width=5)
    for y in (box[1] + 40, box[1] + 78, box[1] + 112):
        d.arc((box[0] + 30, y - 6, box[2] - 30, y + 6), 200, 340, fill=WOOD_L, width=3)
    return im


def centre(base, im, dy=0):
    base.alpha_composite(im, ((S - im.width) // 2, (S - im.height) // 2 + dy))


def fit(im, most):
    k = most / max(im.size)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def single(name):
    base = plaque()
    centre(base, fit(icon(name), 150))
    return base


def crossed(name, plaque_under=True):
    """The icon (drawn bottom-left to top-right) and its mirror image: an X."""
    a = fit(icon(name), 190)
    base = plaque() if plaque_under else Image.new("RGBA", (S, S), (0, 0, 0, 0))
    centre(base, a.transpose(Image.FLIP_LEFT_RIGHT))
    centre(base, a)
    return base


def staves_crossed():
    """The staves stand upright in their icons: a fire staff and a water staff, each tilted, crossed on a plaque."""
    base = plaque()
    for name, deg, dx in (("waterstaff", -30, 34), ("firestaff", 30, -34)):     # (heads out to the sides, shafts crossing)
        im = fit(icon(name).rotate(deg, expand=True, resample=Image.BICUBIC), 168)
        base.alpha_composite(im, ((S - im.width) // 2 + dx, (S - im.height) // 2 - 4))
    return base


def shield_and_swords(metal):
    base = crossed(metal + "longsword", plaque_under=False)
    centre(base, fit(icon(metal + "kiteshield"), 128), dy=6)
    return base


def pieces():
    """id -> picture: the same ids as cafecore.js WEAPONS (wpn-<id>)."""
    out = {}
    for m in METALS:
        for w in SINGLES:
            out[m + w] = lambda m=m, w=w: single(m + w)
        out[m + "crossed"] = lambda m=m: crossed(m + "longsword")
        out[m + "arms"] = lambda m=m: shield_and_swords(m)
    for e in EXTRAS:
        out[e] = lambda e=e: single(e)
    out["stavescrossed"] = staves_crossed
    return out


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    global BARE
    # wpn-<id> on its own plaque; wpnb-<id> bare, set into its mount (N51)
    for BARE, pre in ((False, "wpn-"), (True, "wpnb-")):
        for pid, make in pieces().items():
            im = make()
            im = im.crop(im.getbbox())
            im.save(os.path.join(OUT, f"{pre}{pid}.webp"), "WEBP", quality=90, method=6)
            sizes[pre + pid] = list(im.size)
            print(f"  {pre}{pid}.webp {im.size}")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
