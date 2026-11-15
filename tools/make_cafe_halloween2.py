#!/usr/bin/env python3
"""NeuroCafe, V25 stand-in pictures (2026-10-25) until N58's sheets are painted -- the cutter writes over them:

- the four Halloween guests (dracula, frank, witch, pumpkinhead): the regulars' every picture, recoloured
  (dracula from the old man, frank and pumpkinhead from the boy, the witch from the woman), their frame data copied;
- the candy store's potions (art/ui/potion-golden, -crowd, -chef, -mastery): the old bottles recoloured;
- low tables, floor cushions and the two readers' tables, drawn in the game's ink style;
- Halloween's 16 town things (prop-hw_*): the game's own street pictures and colour emoji put together;
- the wall cobwebs and broom (slanted for the left wall), the three tarot frames (the photo mounts recoloured) and a
  card back (art/ui/card-back) for a frame whose deck isn't on this computer.

    python3 tools/make_cafe_halloween2.py
"""
import io
import json
import math
import os
import sys
import subprocess
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
UI = os.path.join(OUT, "ui")
INK = "#3a1d14"
EMOJI = "/usr/share/fonts/noto/NotoColorEmoji.ttf"

GUESTS = {"dracula": ("oldman", 270, 0.35, 0.75), "frank": ("boy", 95, 1.1, 0.95), "witch": ("woman", 285, 1.0, 0.85), "pumpkinhead": ("boy", 25, 1.4, 1.0)}
POSES = ["tl", "tr", "al", "ar", "sit-f", "sit-b", "stool-f", "stool-b"] + [f"{p}-{i}" for p in ("tl", "ar") for i in range(1, 5)]


def render(svg_text):
    png = subprocess.run(["rsvg-convert", "-f", "png"], input=svg_text.encode(), capture_output=True, check=True).stdout
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    return im.crop(im.getbbox())


def svg(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * 2}" height="{h * 2}">'
            f'<g stroke="{INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


def recolour(im, hue, sat, bright):
    """Turn a picture's colours round by hue (degrees), saturation and brightness -- its outlines stay dark."""
    a = im.getchannel("A")
    hsv = im.convert("RGB").convert("HSV")
    h, s, v = hsv.split()
    h = h.point(lambda x: (x + int(hue * 255 / 360)) % 256)
    s = s.point(lambda x: max(0, min(255, int(x * sat))))
    out = Image.merge("HSV", (h, s, v)).convert("RGB")
    out = ImageEnhance.Brightness(out).enhance(bright).convert("RGBA")
    out.putalpha(a)
    return out


def emoji(ch, size):
    f = ImageFont.truetype(EMOJI, 109)
    im = Image.new("RGBA", (180, 180), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((10, 10), ch, font=f, embedded_color=True)
    im = im.crop(im.getbbox())
    k = size / max(im.size)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def on(base, top, fx, fy):
    """top pasted on base with its middle at (fx, fy) of base (fractions)."""
    base = base.copy()
    base.alpha_composite(top, (max(0, round(base.width * fx - top.width / 2)), max(0, round(base.height * fy - top.height / 2))))
    return base


def canvas(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def shadow(w, h):
    im = canvas(w, h)
    ImageDraw.Draw(im).ellipse([w * 0.12, h * 0.8, w * 0.88, h * 0.98], fill=(42, 26, 14, 55))
    return im


def stack(*parts, w=300, h=300):
    """Emoji (char, size, fx, fy) laid out on a canvas over a soft shadow."""
    im = shadow(w, h)
    for ch, size, fx, fy in parts:
        im = on(im, emoji(ch, size), fx, fy)
    return im.crop(im.getbbox())


# ---- low furniture (front down-left; -r mirrored) -------------------------------------------------------------------
def iso(x, y, z):
    return (150 + (x - y) * 100, 150 + (x + y) * 50 - z)


def poly(pts, fill):
    return f'<polygon points="{" ".join(f"{a:.1f},{b:.1f}" for a, b in pts)}" fill="{fill}"/>'


def box(x0, x1, y0, y1, z0, z1, top, left, right):
    return (poly([iso(x0, y1, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x0, y1, z1)], left)
            + poly([iso(x1, y0, z0), iso(x1, y1, z0), iso(x1, y1, z1), iso(x1, y0, z1)], right)
            + poly([iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y1, z1), iso(x0, y1, z1)], top))


def low_table(top, side, dark, extra=""):
    legs = "".join(box(x, x + 0.08, y, y + 0.08, 0, 26, side, dark, dark) for x, y in ((-0.5, -0.5), (0.42, -0.5), (-0.5, 0.42), (0.42, 0.42)))
    return svg(300, 300, legs + box(-0.55, 0.55, -0.55, 0.55, 26, 36, top, side, dark) + extra)


def round_low(top, side, extra=""):
    cx, cy = iso(0, 0, 34)
    leg = f'<rect x="{cx - 9}" y="{cy}" width="18" height="40" fill="{side}"/>'
    return svg(300, 300, leg + f'<ellipse cx="{cx}" cy="{cy + 8}" rx="92" ry="44" fill="{side}"/><ellipse cx="{cx}" cy="{cy}" rx="92" ry="44" fill="{top}"/>' + extra)


def cushion(col, dark, extra=""):
    cx, cy = iso(0, 0, 0)
    return svg(300, 300, f'<path d="M{cx - 80} {cy - 6} Q{cx - 84} {cy + 30} {cx} {cy + 42} Q{cx + 84} {cy + 30} {cx + 80} {cy - 6} Z" fill="{dark}"/>'
               f'<path d="M{cx - 80} {cy - 6} Q{cx - 70} {cy - 46} {cx} {cy - 44} Q{cx + 70} {cy - 46} {cx + 80} {cy - 6} Q{cx + 60} {cy + 26} {cx} {cy + 26} Q{cx - 60} {cy + 26} {cx - 80} {cy - 6} Z" fill="{col}"/>'
               f'<circle cx="{cx}" cy="{cy - 10}" r="5" fill="{dark}"/>' + extra)


def pouf(col, dark):
    cx, cy = iso(0, 0, 0)
    return svg(300, 300, f'<path d="M{cx - 66} {cy - 30} L{cx - 66} {cy + 16} Q{cx} {cy + 48} {cx + 66} {cy + 16} L{cx + 66} {cy - 30} Z" fill="{dark}"/>'
               f'<ellipse cx="{cx}" cy="{cy - 30}" rx="66" ry="30" fill="{col}"/>')


def reader(robe, scarf, prop):
    """A reader sitting on the far side of a low round table, facing us, with their crystal ball or cards."""
    cx, cy = iso(0, 0, 34)
    person = (f'<path d="M{cx - 46} {cy - 4} Q{cx - 50} {cy - 92} {cx} {cy - 100} Q{cx + 50} {cy - 92} {cx + 46} {cy - 4} Z" fill="{robe}"/>'
              f'<circle cx="{cx}" cy="{cy - 122}" r="26" fill="#f0c8a0"/><path d="M{cx - 30} {cy - 126} Q{cx} {cy - 168} {cx + 30} {cy - 126} Z" fill="{scarf}"/>'
              f'<circle cx="{cx - 9}" cy="{cy - 120}" r="3" fill="{INK}" stroke="none"/><circle cx="{cx + 9}" cy="{cy - 120}" r="3" fill="{INK}" stroke="none"/>')
    table = f'<ellipse cx="{cx}" cy="{cy + 8}" rx="92" ry="44" fill="#4a2a1a"/><ellipse cx="{cx}" cy="{cy}" rx="92" ry="44" fill="#6b3e7a"/>'
    return svg(300, 340, f'<g transform="translate(0,150)">{person + table + prop(cx, cy)}</g>').replace('viewBox="0 0 300 340"', 'viewBox="0 0 300 380"')


def ball(cx, cy):
    return (f'<ellipse cx="{cx}" cy="{cy + 2}" rx="22" ry="8" fill="#c9973f"/><circle cx="{cx}" cy="{cy - 22}" r="24" fill="#bfe6ff"/>'
            f'<circle cx="{cx - 8}" cy="{cy - 30}" r="7" fill="#ffffff" stroke="none" opacity=".8"/>')


def cards(cx, cy):
    out = ""
    for i, dx in enumerate((-48, -16, 16, 48)):
        out += f'<rect x="{cx + dx - 11}" y="{cy - 14 + (i % 2) * 6}" width="22" height="30" rx="3" fill="{"#f4ecdc" if i == 1 else "#3b2a6a"}" transform="skewX(-20)"/>'
    return out + f'<rect x="{cx + 60}" y="{cy - 40}" width="10" height="26" fill="#f4ecdc"/><path d="M{cx + 65} {cy - 50} q-5 6 0 10 q5 -4 0 -10" fill="#f2a33a"/>'


# ---- the wall: cobwebs and a broom, slanted like the left wall --------------------------------------------------------
SKEW = "skewY(-26.565)"


def web(kind):
    spokes = "".join(f'<line x1="60" y1="60" x2="{60 + 56 * math.cos(a):.1f}" y2="{60 + 56 * math.sin(a):.1f}" stroke="#f4f4f4" stroke-width="1.6"/>' for a in [i * math.pi / 4 for i in range(8)])
    rings = "".join(f'<polygon points="{" ".join(f"{60 + r * math.cos(a):.1f},{60 + r * math.sin(a):.1f}" for a in [i * math.pi / 4 for i in range(8)])}" fill="none" stroke="#f4f4f4" stroke-width="1.4"/>' for r in (14, 28, 42, 54))
    spider = '<circle cx="78" cy="74" r="6" fill="#1e1b1a" stroke="none"/>' if kind in (1, 4) else ""
    body = spokes + rings + spider
    if kind == 2:
        body = f'<g transform="translate(-60,-60) scale(2)" clip-path="url(#q)">{body}</g>'
    if kind == 3:
        body = "".join(f'<path d="M{x} 0 q{6 if i % 2 else -6} 30 0 {50 + i * 9}" fill="none" stroke="#f4f4f4" stroke-width="1.8"/>' for i, x in enumerate(range(14, 110, 16)))
    return render(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -60 120 190" width="240" height="380"><defs><clipPath id="q"><rect x="0" y="0" width="120" height="120"/></clipPath></defs>'
                  f'<g transform="{SKEW}" stroke-linecap="round">{body}</g></svg>')


def slanted(im):
    """A flat picture sheared onto the left wall's slope (rising to the right, 1 in 2)."""
    w, h = im.size
    out = im.transform((w, h + w // 2), Image.AFFINE, (1, 0, 0, 0.5, 1, -w // 2), Image.BICUBIC)
    return out.crop(out.getbbox())


def portrait(pic):
    """A landscape photo mount (slanted onto the left wall, its 3D edge up-left) made portrait (Cam, 25 Oct: tarot cards
    are tall): straightened off the slope, rows and columns swapped (a transpose keeps the edge up-left), slanted back."""
    w, h = pic.size
    flat = pic.transform((w, h + w), Image.AFFINE, (1, 0, 0, -0.5, 1, 0), Image.BICUBIC)
    flat = flat.crop(flat.getbbox()).transpose(Image.TRANSPOSE)
    flat = flat.resize((flat.width, round(flat.height * 1.25)), Image.LANCZOS)     # (a card is taller still: 1 by 1.7)
    W, H = flat.size
    out = flat.transform((W, H + W // 2 + 1), Image.AFFINE, (1, 0, 0, 0.5, 1, -W / 2), Image.BICUBIC)
    return out.crop(out.getbbox())


def card_back():
    return render(svg(100, 170, '<rect x="4" y="4" width="92" height="162" rx="8" fill="#2e1f5c"/><rect x="12" y="12" width="76" height="146" rx="5" fill="none" stroke="#c9973f" stroke-width="2"/>'
                       + "".join(f'<circle cx="{x}" cy="{y}" r="2.2" fill="#e9c574" stroke="none"/>' for x, y in ((30, 40), (70, 52), (50, 85), (28, 120), (72, 128), (50, 150)))
                       + '<path d="M50 70 l5 12 13 1 -10 8 4 13 -12 -7 -12 7 4 -13 -10 -8 13 -1z" fill="#e9c574" stroke-width="1.4"/>'))


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    meta_head, meta_rest = tail.split("window.CafeArtMeta = ", 1)
    meta_json, meta_tail = meta_rest.split(";\n", 1)
    sizes, meta = json.loads(files_json), json.loads(meta_json)
    pics = {}
    for g, (base, hue, sat, bright) in GUESTS.items():
        for pose in POSES:
            src = os.path.join(OUT, f"{base}-{pose}.webp")
            if os.path.isfile(src):
                pics[f"{g}-{pose}"] = recolour(Image.open(src).convert("RGBA"), hue, sat, bright)
                if f"{base}-{pose}" in meta:
                    meta[f"{g}-{pose}"] = meta[f"{base}-{pose}"]
    art = lambda pid: Image.open(os.path.join(OUT, pid + ".webp")).convert("RGBA")
    pics.update({
        "table_low-l": render(low_table("#b07a4a", "#8a5a34", "#5e3a1e")),
        "table_lowround": render(round_low("#b07a4a", "#7a4e2c")),
        "cushion": render(cushion("#e2b23c", "#a8801e")),
        "pouf": render(pouf("#efe3c8", "#c9b894")),
        "table_lowhw-l": render(low_table("#3b2f3a", "#2a2028", "#191317", poly([iso(-0.15, -0.55, 37), iso(0.15, -0.55, 37), iso(0.15, 0.55, 37), iso(-0.15, 0.55, 37)], "#7b4fa8"))),
        "cushion_hw": render(cushion("#6b3fa0", "#43246a", '<path d="M136 136 q14 -12 14 0 q0 -12 14 0 q-14 2 -14 10 q0 -8 -14 -10z" fill="#1e1b1a" stroke="none"/>')),
        "crystalball-l": render(reader("#7a2f5a", "#e2b23c", ball)),
        "tarotreader-l": render(reader("#2f2a5a", "#4a7ab8", cards)),
        # Halloween's town things: the game's own street pictures, with emoji added
        "prop-hw_webtree": on(on(art("prop-hw_deadtree"), emoji("🕸️", 150), 0.45, 0.35), emoji("🕷️", 60), 0.7, 0.55),
        "prop-hw_weblamp": on(on(art("prop-lamp"), emoji("🕸️", 110), 0.5, 0.25), emoji("🕷️", 40), 0.6, 0.12),
        "prop-hw_bigweb": stack(("🕸️", 220, 0.5, 0.45), ("🕷️", 80, 0.55, 0.5)),
        "prop-hw_broom": stack(("🪵", 120, 0.5, 0.75), ("🧹", 170, 0.5, 0.4)),
        "prop-hw_turnips": stack(("🏮", 90, 0.3, 0.7), ("🏮", 100, 0.5, 0.6), ("🏮", 90, 0.7, 0.7)),
        "prop-hw_deckchair": stack(("🪑", 170, 0.5, 0.6), ("💀", 90, 0.5, 0.3)),
        "prop-hw_skulls": stack(("💀", 110, 0.38, 0.7), ("💀", 110, 0.62, 0.7), ("💀", 100, 0.5, 0.45), ("🕯️", 70, 0.5, 0.18)),
        "prop-hw_mummy": stack(("⚰️", 200, 0.5, 0.55), ("🧟", 90, 0.5, 0.25)),
        "prop-hw_gargoyle": stack(("🗿", 200, 0.5, 0.5)),
        "prop-hw_postbox": on(art("prop-postbox-l") if os.path.isfile(os.path.join(OUT, "prop-postbox-l.webp")) else art("prop-postbox"), emoji("👻", 90), 0.55, 0.2),
        "prop-hw_sweets": on(art("prop-hw_cauldron"), emoji("🍬", 90), 0.5, 0.15),
        "prop-hw_patch": stack(("🎃", 90, 0.25, 0.75), ("🎃", 110, 0.55, 0.7), ("🎃", 80, 0.8, 0.8), ("🌿", 70, 0.4, 0.85), w=360, h=220),
        "prop-hw_barrow": stack(("🛒", 200, 0.5, 0.6), ("🎃", 90, 0.45, 0.35), ("🎃", 80, 0.62, 0.38)),
        "prop-hw_crowpost": stack(("🪵", 90, 0.5, 0.8), ("🐦‍⬛", 120, 0.5, 0.35)),
        "prop-hw_rocker": stack(("🪑", 180, 0.5, 0.55), ("🪆", 80, 0.5, 0.42)),
        "prop-hw_fog": recolour(stack(("💨", 200, 0.5, 0.5)), 240, 1.4, 1.0),
        # the wall
        "web-1": web(1), "web-2": web(2), "web-3": web(3), "web-4": web(4),
        "hw_broomwall": slanted(emoji("🧹", 160)),
    })
    # (Cam, 25 Oct: portrait frames -- the tarot frames, and portrait photo frames at the furniture store)
    for m in ("oak", "walnut", "gilded", "shadowbox"):
        pics[f"mount-{m}-v"] = portrait(art(f"mount-{m}"))
    pics.update({
        "frame-tarotgold": pics["mount-gilded-v"],
        "frame-crows": ImageEnhance.Brightness(ImageEnhance.Color(pics["mount-shadowbox-v"]).enhance(0.2)).enhance(0.45),
        "frame-stars": recolour(pics["mount-oak-v"], 230, 0.8, 0.55),
    })
    for k in ("table_low", "table_lowhw", "crystalball", "tarotreader"):
        pics[k + "-r"] = ImageOps.mirror(pics[k + "-l"])
    force = "--force" in sys.argv
    for pid, im in pics.items():
        if not force and os.path.exists(os.path.join(OUT, pid + ".webp")):
            continue                                       # (never over a picture that's there -- it may be painted now)
        im.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=90, method=6)
        sizes[pid] = list(im.size)
    for name, src, hue in (("golden", "quick", 40), ("crowd", "sell", 300), ("chef", "fresh", 200), ("mastery", "quick", 230)):
        recolour(Image.open(os.path.join(UI, f"potion-{src}.webp")).convert("RGBA"), hue, 1.2, 1.0).save(os.path.join(UI, f"potion-{name}.webp"), "WEBP", quality=90)
    card_back().save(os.path.join(UI, "card-back.webp"), "WEBP", quality=90)
    print(f"  {len(pics)} pictures, 4 potions, a card back")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n"
                 + meta_head + "window.CafeArtMeta = " + json.dumps(dict(sorted(meta.items())), separators=(",", ":")) + ";\n" + meta_tail)


if __name__ == "__main__":
    main()
