#!/usr/bin/env python3
"""NeuroCafe's outdoor cooking, stand-in pictures (V24 step 2, 2026-10-25) until Gemini paints them (N54):

- the five appliances (barbecue grill, pizza oven, tandoor, rotisserie spit, smoker) drawn in the café's ink style,
  each -l (front down-left) and -r (mirrored), clean and dirty (<kind>-dirty-l/-r);
- their forty dishes three ways like every dish: dish-<id> (served, on a plate), cook-<id> (on the grate, steaming)
  and burnt-<id> (charred, smoking) -- the food a colour emoji (Noto Color Emoji) as a placeholder.

Adds them to ui/cafe/art/manifest.js. The cutter (tools/cut_cafe_art.py) overwrites them when the sheets come in.

    python3 tools/make_cafe_outdoor.py
    python3 tools/make_cafe_outdoor.py --dirty smoker      (a dirty picture made from the painted clean one)
"""
import io
import json
import os
import sys
import subprocess
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
INK = "#3a1d14"
EMOJI = "/usr/share/fonts/noto/NotoColorEmoji.ttf"

# dish -> its stand-in emoji (keep in step with cafecore.js DISHES' outdoor books)
FOOD = {
    "corncob": "🌽", "bbqsausages": "🌭", "bbqribs": "🍖", "bbqburger": "🍔", "halloumi": "🍢", "bbqwings": "🍗", "lambleg": "🥩", "plankfish": "🐟",
    "garlicbread": "🫓", "margherita": "🍕", "focaccia": "🍞", "pepperoni": "🍕", "sourdough": "🥖", "fourcheese": "🧀", "roastveg": "🍆", "calzone": "🥟",
    "naan": "🫓", "paneertikka": "🍢", "tandoorichicken": "🍗", "seekh": "🌭", "raan": "🍖", "chickentikka": "🍛", "lambchops": "🥩", "tandooriprawns": "🍤",
    "gyros": "🥙", "spitpineapple": "🍍", "rotisserie": "🍗", "shawarma": "🌯", "hogroast": "🐖", "churrasco": "🥩", "spitduck": "🦆", "porchetta": "🥓",
    "smokedalmonds": "🥜", "smokedcheese": "🧀", "smokedmac": "🍝", "pulledpork": "🥪", "smokedsalmon": "🐟", "burntends": "🥩", "smokedturkey": "🦃", "brisket": "🍖",
}


def render(svg_text):
    png = subprocess.run(["rsvg-convert", "-f", "png"], input=svg_text.encode(), capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(png)).convert("RGBA")


def svg(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * 2}" height="{h * 2}">'
            f'<g stroke="{INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


def emoji(ch, size):
    f = ImageFont.truetype(EMOJI, 109)
    im = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((10, 10), ch, font=f, embedded_color=True)
    im = im.crop(im.getbbox())
    k = size / max(im.size)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def paste_mid(base, top, cx, by):
    base.alpha_composite(top, (round(cx - top.width / 2), round(by - top.height)))


# ---- the dishes ---------------------------------------------------------------------------------------------------
PLATE = svg(100, 83, '<ellipse cx="50" cy="60" rx="44" ry="17" fill="#2a1a0e" fill-opacity=".18" stroke="none"/>'
                     '<ellipse cx="50" cy="56" rx="45" ry="18" fill="#f4efe6"/><ellipse cx="50" cy="55" rx="31" ry="11.5" fill="#e6ded0" stroke-width="1.6"/>')
GRATE = svg(78, 80, '<ellipse cx="39" cy="58" rx="36" ry="15" fill="#2b2522"/>'
                    + "".join(f'<line x1="{x}" y1="{50 + abs(x - 39) * 0.12}" x2="{x}" y2="{66 - abs(x - 39) * 0.12}" stroke="#77706a" stroke-width="2"/>' for x in range(14, 66, 8))
                    + '<ellipse cx="39" cy="58" rx="36" ry="15" fill="none"/>')
STEAM = svg(78, 80, "".join(f'<path d="M{x} 30 q-5 -7 0 -13 q5 -6 0 -13" fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="2.4"/>' for x in (26, 39, 52)))
SMOKE = svg(78, 80, '<g fill="#6b6460" fill-opacity=".8" stroke="none"><circle cx="30" cy="20" r="9"/><circle cx="42" cy="12" r="11"/><circle cx="52" cy="22" r="8"/><circle cx="38" cy="26" r="7"/></g>')


def dish_pics(did, ch):
    served = render(PLATE)                                   # 200 x 166, like dish-pancakes
    paste_mid(served, emoji(ch, 118), served.width / 2, 116)
    cook = render(GRATE).resize((156, 160), Image.LANCZOS)    # like cook-pancakes
    food = emoji(ch, 92)
    paste_mid(cook, food, 78, 124)
    burnt = cook.copy()
    cook.alpha_composite(render(STEAM).resize((156, 160), Image.LANCZOS))
    char = ImageEnhance.Brightness(ImageEnhance.Color(food).enhance(0.3)).enhance(0.32)
    paste_mid(burnt, char, 78, 124)
    burnt.alpha_composite(render(SMOKE).resize((156, 160), Image.LANCZOS))
    return {"dish-" + did: served, "cook-" + did: cook, "burnt-" + did: burnt}


# ---- the appliances (front down-left; -r is the mirror) ------------------------------------------------------------
def legs(xs, y0, y1, col="#3b3532"):
    return "".join(f'<path d="M{x} {y0} L{x + (2 if x > 60 else -2)} {y1}" stroke-width="5" stroke="{INK}"/><path d="M{x} {y0} L{x + (2 if x > 60 else -2)} {y1}" stroke-width="2" stroke="{col}"/>' for x in xs)


SHADOW = '<ellipse cx="60" cy="140" rx="46" ry="12" fill="#2a1a0e" fill-opacity=".2" stroke="none"/>'
APPLIANCES = {
    # a wagon grill: red firebox on legs, the grate on top, the lid open behind, a wooden side shelf
    "bbq": SHADOW + legs((28, 44, 78, 92), 96, 140)
    + '<path d="M18 64 L62 86 L102 66 L58 44 Z" fill="#9b2f24"/>'
    + '<path d="M18 64 L18 84 Q40 104 62 106 L62 86 Z" fill="#c23b2c"/><path d="M62 86 L62 106 Q86 100 102 86 L102 66 Z" fill="#8e2a20"/>'
    + '<path d="M24 64 L62 83 L96 66 L58 48 Z" fill="#2b2522"/>'
    + "".join(f'<line x1="{30 + i * 8}" y1="{66 + i * 4}" x2="{60 + i * 8}" y2="{51 + i * 4}" stroke="#7d756f" stroke-width="1.8"/>' for i in range(5))
    + '<path d="M58 44 L102 66 L104 28 Q82 14 60 8 Z" fill="#b5352a"/><path d="M68 20 L92 31" stroke-width="4"/><path d="M68 20 L92 31" stroke="#d9d2c8" stroke-width="2"/>'
    + '<path d="M102 76 L118 68 L118 74 L102 82 Z" fill="#b07a4a"/><path d="M118 68 L104 61 L102 66 L102 76 Z" fill="#c99360"/>',
    # a domed brick oven on a stone base, the arched mouth glowing, a little chimney
    "pizzaoven": SHADOW + '<path d="M16 96 L60 118 L104 96 L104 116 L60 138 L16 116 Z" fill="#8c8478"/><path d="M16 96 L60 74 L104 96 L60 118 Z" fill="#a39b8e"/>'
    + '<path d="M22 96 Q22 40 60 32 Q98 40 98 96 Q80 110 60 112 Q40 110 22 96 Z" fill="#c9733f"/>'
    + '<path d="M30 92 Q32 68 48 66 Q62 70 62 96 Q46 102 30 92 Z" fill="#2b1a12"/><path d="M36 92 Q38 76 48 74 Q56 78 57 95 Q46 98 36 92 Z" fill="#f2a33a" stroke="none"/>'
    + '<path d="M60 40 Q86 46 92 80" fill="none" stroke="#e8a06a" stroke-width="3"/>'
    + '<path d="M70 34 L70 12 L80 12 L80 38" fill="#5a4a40"/><ellipse cx="75" cy="12" rx="5" ry="2" fill="#3a2e28"/>',
    # a clay tandoor: a tall terracotta urn in a brick collar, the coals glowing in its mouth
    "tandoor": SHADOW + '<path d="M26 60 Q20 100 34 128 Q60 142 86 128 Q100 100 94 60 Z" fill="#c4683c"/>'
    + '<path d="M34 72 Q34 104 42 124" fill="none" stroke="#e39466" stroke-width="3"/>'
    + '<ellipse cx="60" cy="60" rx="34" ry="13" fill="#a8532e"/><ellipse cx="60" cy="61" rx="22" ry="8" fill="#2b1a12"/><ellipse cx="60" cy="63" rx="15" ry="4.5" fill="#f2903a" stroke="none"/>'
    + '<path d="M20 112 L36 120 L36 132 L20 124 Z M84 120 L100 112 L100 124 L84 132 Z" fill="#9c4a34"/>'
    + '<path d="M50 40 L58 62 M66 36 L62 62" stroke-width="3.5"/><path d="M50 40 L58 62 M66 36 L62 62" stroke="#c9c2b8" stroke-width="1.4"/>',
    # a rotisserie spit: a stone fire pit, two iron posts, the roast on its bar with a crank
    "spit": SHADOW + '<ellipse cx="60" cy="118" rx="40" ry="16" fill="#8f877b"/><ellipse cx="60" cy="116" rx="28" ry="10" fill="#2b1a12"/>'
    + '<path d="M44 116 Q50 96 56 112 Q60 94 66 112 Q72 98 76 116 Z" fill="#f29a3a" stroke-width="1.8"/>'
    + '<path d="M22 122 L26 62 M98 122 L94 62" stroke-width="6"/><path d="M22 122 L26 62 M98 122 L94 62" stroke="#4a4442" stroke-width="2.5"/>'
    + '<path d="M18 62 L104 62" stroke-width="5"/><path d="M18 62 L104 62" stroke="#9a948e" stroke-width="2"/>'
    + '<ellipse cx="60" cy="64" rx="24" ry="14" fill="#b8692f"/><path d="M44 58 Q60 50 76 58" fill="none" stroke="#dd9a5a" stroke-width="3"/>'
    + '<path d="M104 62 L110 62 L110 72 L116 72" fill="none" stroke-width="3.5"/>',
    # an offset smoker: a black barrel on legs with a firebox and a tall chimney
    "smoker": SHADOW + legs((26, 40, 80, 96), 96, 140, "#2a2624")
    + '<path d="M14 62 Q14 46 30 44 L92 44 Q108 46 108 62 L108 88 Q108 104 92 104 L30 104 Q14 104 14 88 Z" fill="#2f2b29"/>'
    + '<path d="M14 72 L108 72" stroke-width="2"/><path d="M24 54 L96 54" stroke="#6f6863" stroke-width="2.5"/>'
    + '<path d="M56 62 L70 62" stroke-width="4"/><path d="M56 62 L70 62" stroke="#c9a26a" stroke-width="2"/>'
    + '<path d="M86 44 L86 8 L98 8 L98 44" fill="#3a3533"/><ellipse cx="92" cy="8" rx="6" ry="2.4" fill="#1e1b1a"/>'
    + '<path d="M2 78 L14 74 L14 104 L2 108 Z" fill="#3a3533"/><circle cx="8" cy="92" r="3" fill="#c9a26a" stroke-width="1.4"/>',
}


def dirty(im):
    """The appliance after a dish: darker, greasy smudges and soot on it."""
    a = im.getchannel("A")
    out = ImageEnhance.Brightness(im).enhance(0.78)
    marks = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(marks)
    w, h = im.size
    for (fx, fy, r) in ((0.32, 0.38, 0.07), (0.6, 0.3, 0.05), (0.45, 0.55, 0.06), (0.7, 0.62, 0.045), (0.25, 0.68, 0.04)):
        d.ellipse([w * fx - w * r, h * fy - w * r * 0.7, w * fx + w * r, h * fy + w * r * 0.7], fill=(40, 26, 14, 150))
    marks.putalpha(Image.composite(marks.getchannel("A"), Image.new("L", im.size, 0), a))
    out.alpha_composite(marks)
    return out


def grime(im, seed=7):
    """A painted appliance made grubby in place (PT57: Gemini's dirty smoker faced the other way): soft patches of grey
    ash, rust and greasy brown laid over it inside its outline, a little darker overall -- so it can't turn round when
    it gets dirty. (Light patches: darkening alone doesn't show on black steel.)"""
    import random
    from PIL import ImageFilter
    rnd = random.Random(seed)
    w, h = im.size
    a = im.getchannel("A")
    out = ImageEnhance.Brightness(im.convert("RGB")).enhance(0.92).convert("RGBA")
    for col, n, op in (((150, 142, 132), 14, 120), ((156, 84, 40), 10, 130), ((70, 50, 36), 10, 150)):
        layer = Image.new("L", im.size, 0)
        d = ImageDraw.Draw(layer)
        for _ in range(n):
            cx, cy, r = rnd.uniform(0.12, 0.88) * w, rnd.uniform(0.15, 0.8) * h, rnd.uniform(0.02, 0.06) * w
            d.ellipse([cx - r, cy - r * 0.6, cx + r, cy + r * 0.6], fill=op)
        layer = layer.filter(ImageFilter.GaussianBlur(w * 0.012))
        mask = Image.composite(layer, Image.new("L", im.size, 0), a.point(lambda v: 255 if v > 200 else 0))
        out = Image.composite(Image.new("RGBA", im.size, col + (255,)), out, mask)
    out.putalpha(a)
    return out


def dirty_from_clean(kinds):
    """<kind>-dirty-l/-r made from the cut <kind>-l (a painted one), and added to the manifest."""
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    for kind in kinds:
        pic = grime(Image.open(os.path.join(OUT, kind + "-l.webp")).convert("RGBA"))
        for side, p in (("l", pic), ("r", ImageOps.mirror(pic))):
            p.save(os.path.join(OUT, f"{kind}-dirty-{side}.webp"), "WEBP", quality=90, method=6)
            sizes[f"{kind}-dirty-{side}"] = list(p.size)
        print(f"  {kind}-dirty-l/-r made from {kind}-l")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    pics = {}
    for kind, body in APPLIANCES.items():
        im = render(svg(120, 150, body))
        im = im.crop(im.getbbox())
        k = 300 / im.height                                   # (300 tall, like the stove)
        im = im.resize((round(im.width * k), 300), Image.LANCZOS)
        for tag, pic in (("", im), ("-dirty", dirty(im))):
            pics[f"{kind}{tag}-l"] = pic
            pics[f"{kind}{tag}-r"] = ImageOps.mirror(pic)
    for did, ch in FOOD.items():
        pics.update(dish_pics(did, ch))
    force = "--force" in sys.argv
    for pid, im in pics.items():
        if not force and os.path.exists(os.path.join(OUT, pid + ".webp")):
            continue                                       # (never over a picture that's there -- it may be painted now)
        im.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=90, method=6)
        sizes[pid] = list(im.size)
    print(f"  {len(pics)} pictures")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    import sys
    if sys.argv[1:2] == ["--dirty"]:                       # python3 tools/make_cafe_outdoor.py --dirty smoker
        dirty_from_clean(sys.argv[2:])
    else:
        main()
