#!/usr/bin/env python3
"""NeuroPets' cooked dishes for NeuroCafe (2026-10-21, PT53: "port other recipes from neuropets and bring their assets").

NeuroPets already has these painted, in the same style, as single 128px icons -- the dish SERVED. NeuroCafe shows every
dish three ways (cooking in the pan, served, burnt), so this lays NeuroPets' icons out as NeuroCafe food sheets: a 4x4 grid
on the food sheets' pink, one dish a cell, saved in Cam's art folder under Icons/Food/NeuroPets/ (with each dish on its
own in Dishes/). The Servery sheets are cut straight into the game (tools/cafe_sheets.txt); Gemini paints the Cooking and
Burnt sheets cell for cell from them (the prompts are in the Collaboration note).

Run: python3 tools/make_cafe_neuropets_food.py"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(HERE, "..", "ui", "pet", "art", "icons")
OUT = os.path.expanduser("~/Pictures/NeuroCafe Art Assets/Icons/Food/NeuroPets")
PINK, GRID = (195, 66, 131), (60, 20, 30)

# the three sheets, in cell order (id, the name in NeuroCafe) -- also used by the game's dish list
SHEETS = [
    ("Cakes tarts and teas", [("berrytart", "Berry tart"), ("honeycake", "Honey cake"), ("carrotcake", "Carrot cake"), ("custardtart", "Custard tart"),
                              ("strawberrytart", "Strawberry tart"), ("dragonfruittart", "Dragonfruit tart"), ("starfruitpie", "Starfruit pie"), ("pumpkinpie", "Pumpkin pie"),
                              ("strawberrycream", "Strawberries and cream"), ("creamtea", "Cream tea"), ("honeyyoghurt", "Honey yoghurt"), ("minttea", "Mint tea"),
                              ("chamomiletea", "Chamomile tea"), ("lavendertea", "Lavender tea")]),
    ("Dinners 1", [("cabbagesoup", "Cabbage soup"), ("carrotsoup", "Carrot soup"), ("cornchowder", "Corn chowder"), ("bakedpotato", "Baked potato"),
                   ("mashedpotato", "Mashed potatoes"), ("cheeseomelette", "Cheese omelette"), ("duckeggomelette", "Duck egg omelette"), ("truffleomelette", "Truffle omelette"),
                   ("cheesepie", "Cheese pie"), ("cheeseboard", "Cheese board"), ("fishpie", "Fish pie"), ("butteredfish", "Buttered fish"),
                   ("grilledtrout", "Grilled trout"), ("crabcakes", "Crab cakes"), ("cookedsalmon", "Salmon fillet"), ("lobster", "Lobster")]),
    ("Dinners 2", [("roastchicken", "Roast chicken"), ("rosemarychicken", "Rosemary chicken"), ("roastpork", "Roast pork"), ("thymepork", "Thyme-roast pork"),
                   ("mintlamb", "Minted lamb"), ("steak", "Steak"), ("venisonsteak", "Venison steak"), ("muttonstew", "Mutton stew"),
                   ("rabbitstew", "Rabbit stew"), ("herbstew", "Herb stew"), ("trufflestew", "Truffle stew")]),
    # 2026-10-22 (Cam): Aunty's secret recipes -- the family dishes she sends in her daily deliveries
    ("Auntys secrets", [("bread", "Aunty's soda bread"), ("heartystew", "Hearty stew"), ("smokedfish", "Smoked fish"), ("comingofagecake", "Coming-of-age cake"),
                        ("richstew", "Rich stew"), ("cookedsturgeon", "Grilled sturgeon"), ("grilledchar", "Grilled char"), ("greatwhitesteak", "Great white steak"),
                        ("hammerheadsteak", "Hammerhead steak"), ("grilledstingray", "Grilled stingray")]),
]


def sheet(dishes):
    c = 512
    im = Image.new("RGB", (2048, 2048), PINK)
    for k, (did, _) in enumerate(dishes):
        ic = Image.open(os.path.join(ICONS, did + ".webp")).convert("RGBA")
        ic = ic.resize((ic.width * 3, ic.height * 3), Image.LANCZOS)          # 128 -> 384, a cell's dish size
        x0, y0 = (k % 4) * c, (k // 4) * c
        im.paste(ic, (x0 + (c - ic.width) // 2, y0 + (c - ic.height) // 2), ic)
    d = ImageDraw.Draw(im)
    for i in range(1, 4):
        d.line([(i * c, 0), (i * c, 2048)], fill=GRID, width=6)
        d.line([(0, i * c), (2048, i * c)], fill=GRID, width=6)
    return im


def main():
    os.makedirs(os.path.join(OUT, "Dishes"), exist_ok=True)
    for n, (title, dishes) in enumerate(SHEETS, 1):
        sheet(dishes).save(os.path.join(OUT, f"Icon - NeuroPets Sheet {n} - Servery.png"))
        for did, _ in dishes:
            Image.open(os.path.join(ICONS, did + ".webp")).convert("RGBA").save(os.path.join(OUT, "Dishes", did + ".png"))
        print(f"Sheet {n} ({title}): {len(dishes)} dishes")


if __name__ == "__main__":
    main()
