#!/usr/bin/env python3
"""The café's field across the street (2026-10-22, Cam: "farm plots across the street ... use the assets from NeuroFarm,
even the growing animation stages").

Copies NeuroFarm's pictures straight into the game (ui/cafe/art, at most 128 on a side; their sizes into manifest.js,
which tools/cut_cafe_art.py keeps): each crop's four growing stages (crop-<id>-1..4), the soil (field-soil, and wet),
the for-sale sign (field-sign); and a harvest icon per crop (item-<id>): NeuroPets' own where it has one, else the
crop's last stage; and (Cam, later the same day) the farm things to put round the plots (prop-farm_*, NeuroPets'
windmill, fence, barn, the chicken coop with its hens and eggs ...), Farmer Giles (NeuroPets' painted look for him) and the plow (NeuroPets' hoe).

Run: python3 tools/make_cafe_field.py"""
import json
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FARM = os.path.join(HERE, "..", "ui", "farm", "art")
PETS = os.path.join(HERE, "..", "ui", "pet", "art", "icons")
GAME = os.path.join(HERE, "..", "ui", "cafe", "art")
# the crops the café grows (cafecore.js CROPS)
CROPS = ["wheat", "strawberry", "tomato", "onion", "blackberry", "cabbage", "carrot", "lettuce", "potato", "beetroot",
         "dragonfruit", "starfruit", "sweetcorn", "pumpkin"]


# farm things for the street (cafecore.js DECOR, farm: true): id -> NeuroPets picture
FARM_PROPS = {"farm_fence": "obj_paddock", "farm_can": "wateringcan", "farm_hay": "hay", "farm_compost": "obj_compost",
              "farm_cart": "obj_handcart", "farm_windmill": "obj_mill", "farm_glass": "obj_glass", "farm_barn": "obj_barn",
              "farm_coop": "obj_coop"}
# the coop's hens and their eggs (2026-10-23): NeuroPets' white pet hen and brown farmyard hen, and its chicken egg
HENS = {"hen-white": "pets/chicken-white-a", "hen-white-sleep": "pets/chicken-white-sleep", "hen-brown": "livestock/hen-brown-a",
        "hen-brown-walk": "livestock/hen-brown-walk"}


def fit(im, side):
    sc = min(1, side / max(im.size))
    return im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)


def main():
    out = {}
    def put(cid, im, side):
        im = fit(im.convert("RGBA"), side)
        im.save(os.path.join(GAME, cid + ".webp"), "WEBP", quality=90, method=6)
        out[cid] = [im.width, im.height]
    for c in CROPS:
        for n in range(1, 5):
            put(f"crop-{c}-{n}", Image.open(os.path.join(FARM, f"crop-{c}-{n}.webp")), 128)
        pet = os.path.join(PETS, c + ".webp")
        if os.path.isfile(pet):
            put("item-" + c, Image.open(pet), 96)
        else:
            ripe = Image.open(os.path.join(FARM, f"crop-{c}-4.webp")).convert("RGBA")
            put("item-" + c, ripe.crop(ripe.getbbox()), 96)
    put("field-soil", Image.open(os.path.join(FARM, "tile-soil.webp")), 160)
    put("field-soil-wet", Image.open(os.path.join(FARM, "tile-soil-wet.webp")), 160)
    put("field-sign", Image.open(os.path.join(FARM, "sign-forsale.webp")), 128)
    for pid, src in FARM_PROPS.items():
        im = Image.open(os.path.join(PETS, src + ".webp")).convert("RGBA")
        put("prop-" + pid, im.crop(im.getbbox()), 160)
    for hid, src in HENS.items():
        im = Image.open(os.path.join(PETS, "..", src + ".webp")).convert("RGBA")
        put(hid, im.crop(im.getbbox()), 96)
    egg = Image.open(os.path.join(PETS, "chickenegg.webp")).convert("RGBA")
    put("item-egg", egg.crop(egg.getbbox()), 96)
    giles = Image.open(os.path.join(PETS, "..", "player", "1-3-0-a.webp")).convert("RGBA")
    put("giles", giles.crop(giles.getbbox()), 300)
    hoe = Image.open(os.path.join(PETS, "hoe.webp")).convert("RGBA")
    put("field-plow", hoe.crop(hoe.getbbox()), 96)
    man = os.path.join(GAME, "manifest.js")
    text = open(man, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    sizes = json.loads(rest.split(";\n", 1)[0])
    sizes.update(out)
    open(man, "w", encoding="utf-8").write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":"))
                                           + ";\n" + rest.split(";\n", 1)[1])
    print(f"Field: {len(out)} pictures into the game")


if __name__ == "__main__":
    main()
