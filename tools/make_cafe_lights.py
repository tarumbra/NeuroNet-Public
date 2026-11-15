#!/usr/bin/env python3
"""NeuroCafe's lights (2026-10-24, Cam: "add wall sconce lights as well and roof lights ... circle leds, hallogen wire
industrial lights, chandaliers and others"): stand-in pictures, drawn here as outlined vector art in the game's style
till they're painted. Writes ui/cafe/art/<id>.webp and adds them to ui/cafe/art/manifest.js. The ids must match
cafecore.js CEILING (ceil-*) and WALL_THINGS' sconces (sconce-*).

  ceil-*        hang from the ceiling: the top of the picture is where it's fixed (a cord, chain or rods down to it)
  sconce-*      on the left wall, sheared to its slope (the game mirrors them for the right wall)
  lightswitch-* the switch by the door for the ceiling lights, on and off (left wall)

    python3 tools/make_cafe_lights.py
"""
import io
import json
import os
import subprocess
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
INK = "#3a1d14"
BRASS, BRASS_D, BRASS_L = "#c9973f", "#94672a", "#e9c574"
IRON, IRON_D = "#4c5552", "#2f3634"
GLASS = "#fff6dc"
SKEW = "skewY(-26.565)"                              # the left wall's slope (1 in 2, rising to the right)


def svg(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * 2}" height="{h * 2}">'
            f'<g stroke="{INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


def cord(x, y0, y1, w=3):
    return f'<line x1="{x}" y1="{y0}" x2="{x}" y2="{y1}" stroke-width="{w}"/>'


def bulb(cx, cy, r=9, fill=GLASS):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke-width="3"/><circle cx="{cx - r * 0.3}" cy="{cy - r * 0.3}" r="{r * 0.3}" fill="#fff" stroke="none"/>'


# ---- the ceiling's ----------------------------------------------------------------------------------------------
CEIL = {
    # a ring of LED on two wires: a flat circle, seen from the side and above
    "ceil-led": svg(200, 160, f'''
        <line x1="100" y1="2" x2="30" y2="112" stroke-width="2.5"/><line x1="100" y1="2" x2="170" y2="112" stroke-width="2.5"/>
        <ellipse cx="100" cy="118" rx="84" ry="34" fill="none" stroke-width="16"/>
        <ellipse cx="100" cy="118" rx="84" ry="34" fill="none" stroke="#dfe8ee" stroke-width="10"/>
        <ellipse cx="100" cy="122" rx="80" ry="30" fill="none" stroke="#f6fbff" stroke-width="5"/>
        <ellipse cx="100" cy="2" rx="12" ry="4" fill="#dfe8ee" stroke-width="3"/>'''),
    # a round paper lantern on a cord, its ribs showing
    "ceil-lantern": svg(160, 190, f'''
        {cord(80, 0, 52)}
        <rect x="66" y="50" width="28" height="10" rx="3" fill="{IRON}"/>
        <ellipse cx="80" cy="118" rx="62" ry="60" fill="#fff1d6"/>
        <g fill="none" stroke="#e2c08e" stroke-width="3">
          <path d="M22 98 Q80 112 138 98"/><path d="M19 118 Q80 134 141 118"/><path d="M22 138 Q80 154 138 138"/><path d="M32 80 Q80 92 128 80"/><path d="M34 158 Q80 170 126 158"/></g>
        <ellipse cx="80" cy="118" rx="62" ry="60" fill="none"/>
        <rect x="68" y="174" width="24" height="9" rx="3" fill="{IRON}"/>'''),
    # an industrial pendant: a dark iron shade, the bulb in a wire cage under it
    "ceil-cage": svg(170, 210, f'''
        {cord(85, 0, 70)}
        <rect x="76" y="66" width="18" height="16" rx="3" fill="{IRON_D}"/>
        <path d="M70 80 L100 80 L150 128 Q85 142 20 128 Z" fill="{IRON}"/>
        <path d="M30 124 Q85 136 140 124" fill="none" stroke="#6d7a76" stroke-width="3"/>
        {bulb(85, 150, 16)}
        <g fill="none" stroke-width="3"><path d="M48 132 Q50 186 85 192 Q120 186 122 132"/><path d="M66 136 Q68 186 85 192"/><path d="M104 136 Q102 186 85 192"/>
          <path d="M52 160 Q85 172 118 160"/></g>'''),
    # halogen lights on two tight wires between rods (the wires run with the floor's lines)
    "ceil-wire": svg(210, 170, f'''
        <line x1="14" y1="0" x2="14" y2="34" stroke-width="5"/><line x1="196" y1="91" x2="196" y2="125" stroke-width="5"/>
        <line x1="14" y1="30" x2="196" y2="121" stroke="#9aa3a0" stroke-width="3"/>
        <line x1="14" y1="44" x2="196" y2="135" stroke="#9aa3a0" stroke-width="3"/>
        {"".join(f'<g transform="translate({x},{30 + (x - 14) * 0.5 + 6})"><line x1="0" y1="0" x2="0" y2="16" stroke-width="3"/><path d="M-11 14 L11 14 L8 34 L-8 34 Z" fill="#c9cfcc"/><ellipse cx="0" cy="34" rx="8" ry="3.5" fill="#fffbe8" stroke-width="2.5"/></g>' for x in (46, 105, 164))}'''),
    # a clear glass globe on a cord, a brass cap
    "ceil-globe": svg(150, 200, f'''
        {cord(75, 0, 72)}
        <path d="M60 70 L90 70 L94 88 L56 88 Z" fill="{BRASS}"/>
        <circle cx="75" cy="136" r="54" fill="#e9f4f6" fill-opacity=".85"/>
        <path d="M40 112 Q50 92 72 88" fill="none" stroke="#fff" stroke-width="6"/>
        {bulb(75, 138, 13)}
        <line x1="75" y1="88" x2="75" y2="124" stroke-width="3"/>'''),
    # Edison bulbs on cords of different lengths, from one round canopy
    "ceil-edison": svg(190, 200, f'''
        <ellipse cx="95" cy="8" rx="44" ry="10" fill="{BRASS_D}"/>
        {"".join(f'{cord(x, 10, y, 2.5)}<rect x="{x - 6}" y="{y}" width="12" height="12" rx="2" fill="{BRASS}" stroke-width="3"/><path d="M{x - 7} {y + 12} Q{x - 18} {y + 30} {x - 12} {y + 44} Q{x} {y + 56} {x + 12} {y + 44} Q{x + 18} {y + 30} {x + 7} {y + 12} Z" fill="#ffd27a" fill-opacity=".9" stroke-width="3"/><path d="M{x - 4} {y + 18} L{x - 4} {y + 34} Q{x} {y + 42} {x + 4} {y + 34} L{x + 4} {y + 18}" fill="none" stroke="#e07a1a" stroke-width="2"/>' for x, y in ((48, 92), (78, 128), (110, 108), (140, 76), (95, 60)))}'''),
    # a Tiffany shade: a dome of coloured glass in leaded panes
    "ceil-tiffany": svg(190, 180, f'''
        {cord(95, 0, 58)}
        <rect x="84" y="54" width="22" height="12" rx="3" fill="{BRASS_D}"/>
        <path d="M95 64 Q22 74 12 140 L178 140 Q168 74 95 64 Z" fill="#d98a2b"/>
        <g stroke-width="3"><path d="M95 64 Q60 98 52 140" fill="none"/><path d="M95 64 Q130 98 138 140" fill="none"/><path d="M95 64 L95 140" fill="none"/>
          <path d="M30 106 Q95 92 160 106" fill="none"/></g>
        <path d="M58 82 Q40 96 34 104 L56 100 Q64 88 74 76 Z" fill="#4f9a5a" stroke-width="2.5"/>
        <path d="M118 76 Q130 88 138 100 L158 104 Q150 92 134 82 Z" fill="#4f9a5a" stroke-width="2.5"/>
        <path d="M60 110 Q58 124 56 138 L92 138 L92 108 Z" fill="#b8402e" stroke-width="2.5"/>
        <path d="M98 108 L98 138 L134 138 Q132 124 130 110 Z" fill="#e2b33c" stroke-width="2.5"/>
        <path d="M10 140 L180 140 L176 150 L14 150 Z" fill="{BRASS_D}"/>
        <ellipse cx="95" cy="152" rx="40" ry="8" fill="#ffe7a8" stroke="none"/>'''),
    # a brass chandelier on a chain: five curved arms, a candle and its flame on each, crystal drops below
    "ceil-chandelier": svg(240, 240, f'''
        {"".join(f'<ellipse cx="120" cy="{y}" rx="5" ry="8" fill="none" stroke="{BRASS_D}" stroke-width="3"/>' for y in range(4, 92, 12))}
        <path d="M108 92 L132 92 L138 118 L102 118 Z" fill="{BRASS}"/>
        {"".join(f'<path d="M120 150 Q{120 + dx * 0.45} {176 + dy} {120 + dx} {150 + dy} L{120 + dx} {132 + dy}" fill="none" stroke="{INK}" stroke-width="10"/><path d="M120 150 Q{120 + dx * 0.45} {176 + dy} {120 + dx} {150 + dy} L{120 + dx} {132 + dy}" fill="none" stroke="{BRASS}" stroke-width="5"/>' for dx, dy in ((-96, 8), (96, 8), (-56, 20), (56, 20), (0, 28)))}
        <ellipse cx="120" cy="150" rx="22" ry="34" fill="{BRASS}"/>
        <ellipse cx="114" cy="140" rx="6" ry="14" fill="{BRASS_L}" stroke="none"/>
        {"".join(f'<ellipse cx="{120 + dx}" cy="{130 + dy}" rx="12" ry="5" fill="{BRASS_D}" stroke-width="3"/><rect x="{114 + dx}" y="{104 + dy}" width="12" height="26" rx="2" fill="#fbf3e2" stroke-width="3"/><path d="M{120 + dx} {84 + dy} Q{128 + dx} {96 + dy} {120 + dx} {102 + dy} Q{112 + dx} {96 + dy} {120 + dx} {84 + dy} Z" fill="#ffc94a" stroke-width="2.5"/>' for dx, dy in ((-96, 8), (96, 8), (-56, 20), (56, 20), (0, 28)))}
        {"".join(f'<line x1="{120 + dx}" y1="{168 + dy}" x2="{120 + dx}" y2="{184 + dy}" stroke-width="2"/><path d="M{120 + dx} {184 + dy} l-6 9 l6 13 l6 -13 Z" fill="#e6f4fb" stroke-width="2.5"/>' for dx, dy in ((-70, 6), (-36, 18), (0, 22), (36, 18), (70, 6)))}
        <path d="M120 184 L114 196 L120 222 L126 196 Z" fill="#e6f4fb" stroke-width="3"/>'''),
}

# ---- the wall's (drawn front-on, then sheared onto the left wall) ----------------------------------------------
SCONCE = {
    # a brass candle sconce: an oval back plate, a curled arm, a drip cup and its candle
    "sconce-1": (120, 200, f'''
        <ellipse cx="60" cy="110" rx="24" ry="40" fill="{BRASS}"/><ellipse cx="60" cy="110" rx="12" ry="24" fill="{BRASS_L}" stroke-width="3"/>
        <path d="M60 130 Q60 160 86 156 Q100 152 96 132" fill="none" stroke="{INK}" stroke-width="10"/><path d="M60 130 Q60 160 86 156 Q100 152 96 132" fill="none" stroke="{BRASS}" stroke-width="5"/>
        <ellipse cx="96" cy="128" rx="18" ry="6" fill="{BRASS_D}"/>
        <rect x="87" y="80" width="18" height="46" rx="3" fill="#fbf3e2"/>
        <path d="M96 46 Q108 64 96 76 Q84 64 96 46 Z" fill="#ffc94a" stroke-width="3"/><line x1="96" y1="76" x2="96" y2="82" stroke-width="2"/>'''),
    # a frosted glass globe on a short brass arm
    "sconce-2": (130, 190, f'''
        <rect x="30" y="98" width="30" height="58" rx="10" fill="{BRASS}"/>
        <path d="M58 128 L84 128" stroke="{INK}" stroke-width="10"/><path d="M58 128 L84 128" stroke="{BRASS}" stroke-width="5"/>
        <path d="M76 116 L98 116 L100 126 L74 126 Z" fill="{BRASS_D}"/>
        <circle cx="87" cy="84" r="34" fill="#f3f6f2"/><path d="M66 74 Q72 58 88 54" fill="none" stroke="#fff" stroke-width="6"/>'''),
    # a coach lantern on a curled iron bracket
    "sconce-3": (140, 210, f'''
        <rect x="18" y="70" width="18" height="70" rx="5" fill="{IRON_D}"/>
        <path d="M34 90 L96 90 Q112 90 112 74" fill="none" stroke-width="7"/><path d="M34 110 Q60 110 70 92" fill="none" stroke-width="5"/>
        <line x1="104" y1="74" x2="104" y2="96" stroke-width="3"/>
        <path d="M86 96 L122 96 L130 108 L78 108 Z" fill="{IRON}"/>
        <rect x="82" y="108" width="44" height="54" fill="#ffe9b0" fill-opacity=".92"/>
        <line x1="104" y1="108" x2="104" y2="162" stroke-width="3"/><line x1="82" y1="135" x2="126" y2="135" stroke-width="2"/>
        <path d="M80 162 L128 162 L120 176 L88 176 Z" fill="{IRON}"/>'''),
    # an art deco fan: a half-round shade opening upwards, its light thrown up the wall
    "sconce-4": (150, 170, f'''
        <path d="M75 140 L28 70 Q75 40 122 70 Z" fill="#f2e6cc"/>
        <g stroke-width="3" fill="none"><line x1="75" y1="140" x2="46" y2="58"/><line x1="75" y1="140" x2="75" y2="52"/><line x1="75" y1="140" x2="104" y2="58"/></g>
        <path d="M28 70 Q75 40 122 70" fill="none" stroke="{BRASS_D}" stroke-width="8"/>
        <rect x="64" y="134" width="22" height="18" rx="4" fill="{BRASS}"/>'''),
    # a swing-arm reading light: a round plate, a jointed arm, a little cone shade
    "sconce-5": (170, 180, f'''
        <circle cx="34" cy="100" r="20" fill="{BRASS}"/>
        <path d="M44 100 L96 78 L134 92" fill="none" stroke="{INK}" stroke-width="10"/><path d="M44 100 L96 78 L134 92" fill="none" stroke="{BRASS}" stroke-width="5"/>
        <circle cx="96" cy="78" r="6" fill="{BRASS_D}" stroke-width="3"/>
        <path d="M120 84 L148 84 L162 124 L106 124 Z" fill="#2f5e4e"/>
        <ellipse cx="134" cy="124" rx="28" ry="7" fill="#ffe7a8"/>'''),
}
SWITCH = {
    "lightswitch-on": (60, 80, f'''<rect x="8" y="8" width="44" height="64" rx="6" fill="#f4ecdc"/><rect x="22" y="22" width="16" height="36" rx="3" fill="#d9cdb4" stroke-width="3"/><rect x="22" y="22" width="16" height="17" rx="3" fill="#fffaf0" stroke-width="3"/>'''),
    "lightswitch-off": (60, 80, f'''<rect x="8" y="8" width="44" height="64" rx="6" fill="#f4ecdc"/><rect x="22" y="22" width="16" height="36" rx="3" fill="#d9cdb4" stroke-width="3"/><rect x="22" y="41" width="16" height="17" rx="3" fill="#fffaf0" stroke-width="3"/>'''),
}


def on_wall(w, h, body):
    """Front-on art sheared onto the left wall: rises half its width, so the canvas is that much taller."""
    rise = w * 0.5
    return svg(w, round(h + rise), f'<g transform="translate(0,{rise}) {SKEW}">{body}</g>')


def render(text):
    png = subprocess.run(["rsvg-convert", "-f", "png"], input=text.encode(), capture_output=True, check=True).stdout
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    return im.crop(im.getbbox())


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    pics = dict(CEIL)
    pics.update({k: on_wall(*v) for k, v in list(SCONCE.items()) + list(SWITCH.items())})
    for pid, src in pics.items():
        im = render(src)
        im.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=92, method=6)
        sizes[pid] = list(im.size)
        print(f"  {pid}.webp {im.size}")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
