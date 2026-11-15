#!/usr/bin/env python3
"""NeuroCafe's garden and street (2026-10-24, Cam: "rocks of all shapes and sizes as well, plus some dead trees and other
types of trees ... more buildings that can be placed to create literal streets"): stand-in pictures in the game's
outlined style, drawn here as vector art till they're painted -- rocks, trees, wild plants, and homes for the street
(an isometric box and gable roof, its door on the long wall: <id>-l facing down-left, <id>-r turned to face down-right).
Drawn in the game's own pixels (a tile is 128 wide) and saved at twice that; the game sizes them at half. A home's
picture has its front corner at the bottom middle, its footprint cafecore.js HOME_FOOT.

Writes ui/cafe/art/prop-<id>.webp and adds them to ui/cafe/art/manifest.js.

    python3 tools/make_cafe_nature.py
"""
import io
import json
import math
import os
import random
import subprocess
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
INK = "#3a1d14"
TW, TH = 128, 64


def svg(w, h, body, ox=0, oy=0):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{ox} {oy} {w} {h}" width="{w * 2}" height="{h * 2}">'
            f'<g stroke="{INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


def render(text):
    png = subprocess.run(["rsvg-convert", "-f", "png"], input=text.encode(), capture_output=True, check=True).stdout
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    return im


def shade(hexc, k):
    r, g, b = int(hexc[1:3], 16), int(hexc[3:5], 16), int(hexc[5:7], 16)
    f = lambda c: max(0, min(255, round(c * k if k < 1 else c + (255 - c) * (k - 1))))
    return "#%02x%02x%02x" % (f(r), f(g), f(b))


def shadow(cx, cy, rx, ry):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#2a1a0e" fill-opacity=".22" stroke="none"/>'


# ---- rocks --------------------------------------------------------------------------------------------------------
def lump(rnd, cx, cy, rx, ry, k=9):
    pts = []
    for i in range(k):
        a = 2 * math.pi * i / k + rnd.uniform(-0.2, 0.2)
        rr = rnd.uniform(0.82, 1.08)
        pts.append((cx + math.cos(a) * rx * rr, cy + math.sin(a) * ry * rr * (0.75 if math.sin(a) < 0 else 1)))
    return pts


def rock(rnd, cx, cy, rx, ry, col="#9a948a", moss=False):
    pts = lump(rnd, cx, cy, rx, ry)
    p = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    top = " ".join(f"{cx + (x - cx) * 0.7 - rx * 0.08:.1f},{cy + (y - cy) * 0.55 - ry * 0.3:.1f}" for x, y in pts)
    out = (f'<polygon points="{p}" fill="{col}"/>'
           f'<polygon points="{top}" fill="{shade(col, 1.18)}" stroke="none"/>'
           f'<path d="M{cx - rx * 0.6:.1f} {cy + ry * 0.35:.1f} Q{cx:.1f} {cy + ry * 0.75:.1f} {cx + rx * 0.7:.1f} {cy + ry * 0.3:.1f}" fill="none" stroke="{shade(col, 0.72)}" stroke-width="1.6"/>'
           f'<polygon points="{p}" fill="none"/>')
    if moss:
        out += "".join(f'<ellipse cx="{cx + rnd.uniform(-0.5, 0.4) * rx:.1f}" cy="{cy - ry * rnd.uniform(0.2, 0.6):.1f}" rx="{rx * rnd.uniform(0.18, 0.32):.1f}" ry="{ry * 0.16:.1f}" fill="#6f9a3e" stroke="#3f6a22" stroke-width="1.2"/>' for _ in range(4))
    return out


def rocks():
    R = random.Random(4)
    out = {}
    out["rock_pebbles"] = svg(40, 22, shadow(20, 16, 18, 5) + "".join(rock(R, x, y, r, r * 0.7, c) for x, y, r, c in
                              ((9, 13, 5, "#a39d92"), (19, 10, 4, "#8f897e"), (28, 14, 5.5, "#b0a898"), (16, 16, 4, "#9a948a"), (33, 9, 3.5, "#857f75"))))
    out["rock_small"] = svg(40, 30, shadow(20, 24, 16, 5) + rock(R, 20, 17, 14, 10))
    out["rock_flat"] = svg(56, 26, shadow(28, 19, 25, 6) + rock(R, 28, 14, 24, 8, "#a8a294"))
    out["rock_round"] = svg(54, 44, shadow(27, 36, 23, 7) + rock(R, 27, 24, 21, 17, "#8f8a80"))
    out["rock_mossy"] = svg(64, 48, shadow(32, 40, 28, 7) + rock(R, 32, 27, 26, 19, "#8a8a7c", moss=True))
    out["rock_pile"] = svg(76, 56, shadow(38, 46, 34, 8) + rock(R, 22, 38, 15, 10, "#9a948a") + rock(R, 52, 38, 17, 11, "#8f897e")
                           + rock(R, 37, 25, 16, 12, "#a8a294") + rock(R, 60, 44, 9, 6, "#b0a898"))
    tall = "M24 64 L17 22 Q20 6 32 4 Q42 8 44 24 L40 64 Z"
    out["rock_tall"] = svg(60, 72, shadow(30, 64, 22, 6) + f'<path d="{tall}" fill="#8f8a80"/><path d="M24 62 L19 24 Q22 10 30 8 L32 62 Z" fill="#a8a294" stroke="none"/>'
                           f'<path d="M30 20 l4 6 M28 36 l5 3 M34 48 l-3 5" stroke="#6c675e" stroke-width="1.5" fill="none"/><path d="{tall}" fill="none"/>')
    out["rock_boulder"] = svg(110, 80, shadow(55, 70, 50, 10) + rock(R, 55, 44, 48, 32, "#8a857b") + rock(R, 86, 64, 12, 8, "#9a948a"))
    out["rock_slab"] = svg(56, 24, f'<ellipse cx="28" cy="13" rx="25" ry="9" fill="#a39d92"/><ellipse cx="26" cy="11" rx="18" ry="5.5" fill="#b4ae9f" stroke="none"/>'
                           f'<path d="M10 15 q8 4 20 3" stroke="#7a756c" stroke-width="1.4" fill="none"/>')
    return out


# ---- trees and plants ------------------------------------------------------------------------------------------------
def crown(rnd, cx, cy, rx, ry, col, n=14, dots=None):
    """A leafy crown: overlapping blobs -- all their outlines first, then all their fills, so only the outside shows."""
    blobs = [(cx + rnd.uniform(-1, 1) * rx * 0.62, cy + rnd.uniform(-1, 1) * ry * 0.55, rnd.uniform(0.32, 0.5) * rx) for _ in range(n)]
    blobs += [(cx, cy, rx * 0.6)]
    o = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{INK}" stroke="{INK}" stroke-width="5"/>' for x, y, r in blobs)
    o += "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{col}" stroke="none"/>' for x, y, r in blobs)
    o += "".join(f'<circle cx="{x - r * 0.25:.1f}" cy="{y - r * 0.3:.1f}" r="{r * 0.5:.1f}" fill="{shade(col, 1.2)}" stroke="none" opacity=".75"/>' for x, y, r in blobs if y < cy)
    o += "".join(f'<path d="M{x - r * 0.6:.1f} {y + r * 0.45:.1f} q{r * 0.6:.1f} {r * 0.35:.1f} {r * 1.2:.1f} 0" fill="none" stroke="{shade(col, 0.7)}" stroke-width="1.6"/>' for x, y, r in blobs[::3])
    if dots:
        o += "".join(f'<circle cx="{cx + rnd.uniform(-0.8, 0.8) * rx:.1f}" cy="{cy + rnd.uniform(-0.7, 0.7) * ry:.1f}" r="{dots[1]}" fill="{dots[0]}" stroke="{INK}" stroke-width="1.2"/>' for _ in range(dots[2]))
    return o


def trunk(x, y0, y1, w, col="#7a4e2c"):
    return (f'<path d="M{x - w} {y0} Q{x - w * 0.6} {(y0 + y1) / 2} {x - w * 0.5} {y1} L{x + w * 0.5} {y1} Q{x + w * 0.6} {(y0 + y1) / 2} {x + w} {y0} Z" fill="{col}"/>'
            f'<path d="M{x - w * 0.1} {y0 - 4} L{x - w * 0.2} {y1 + 6}" stroke="{shade(col, 0.7)}" stroke-width="1.4"/>')


def branches(rnd, x, y, ang, length, width, depth, col):
    if depth == 0 or length < 6:
        return ""
    x2, y2 = x + math.cos(ang) * length, y + math.sin(ang) * length
    o = f'<path d="M{x:.1f} {y:.1f} L{x2:.1f} {y2:.1f}" stroke="{INK}" stroke-width="{width + 2.4:.1f}" fill="none"/>'
    o2 = f'<path d="M{x:.1f} {y:.1f} L{x2:.1f} {y2:.1f}" stroke="{col}" stroke-width="{width:.1f}" fill="none"/>'
    kids = ""
    for _ in range(2 if depth > 1 else rnd.randint(1, 3)):
        kids += branches(rnd, x2, y2, ang + rnd.uniform(-0.75, 0.75), length * rnd.uniform(0.6, 0.78), width * 0.62, depth - 1, col)
    return o + o2 + kids


def trees():
    R = random.Random(9)
    out = {}
    out["tree_stump"] = svg(50, 40, shadow(25, 33, 22, 6) + '<path d="M9 30 L11 14 L39 14 L41 30 Q25 36 9 30 Z" fill="#7a4e2c"/>'
                            '<ellipse cx="25" cy="14" rx="14" ry="6" fill="#d9b27a"/><ellipse cx="25" cy="14" rx="8" ry="3.3" fill="none" stroke="#a37548" stroke-width="1.3"/>'
                            '<ellipse cx="25" cy="14" rx="3" ry="1.3" fill="none" stroke="#a37548" stroke-width="1.2"/><path d="M8 30 l-5 3 M42 30 l5 2" stroke-width="3"/>')
    out["tree_log"] = svg(92, 40, shadow(46, 31, 42, 7) + '<path d="M14 14 L78 22 L74 34 L10 26 Z" fill="#7a4e2c"/>'
                          '<path d="M20 20 L70 26 M24 25 L66 31" stroke="#5a3a1e" stroke-width="1.4"/><ellipse cx="12" cy="20" rx="6" ry="7" fill="#d9b27a"/>'
                          '<ellipse cx="12" cy="20" rx="2.5" ry="3" fill="none" stroke="#a37548" stroke-width="1.2"/><circle cx="50" cy="16" r="3" fill="#6f9a3e" stroke-width="1.2"/>')
    dead = lambda seed, h: svg(200, h + 80, shadow(60, h - 8, 26, 6) + branches(random.Random(seed), 60, h - 8, -math.pi / 2, h * 0.3, 10, 5, "#6e5643"), ox=-40, oy=-80)
    out["tree_dead"] = dead(3, 130)
    out["tree_dead2"] = dead(11, 150)
    pine = shadow(45, 162, 28, 7) + trunk(45, 165, 135, 6)
    for i, (y, w) in enumerate(((128, 40), (102, 33), (76, 26), (50, 18))):
        pine += f'<path d="M45 {y - 44} L{45 + w} {y} Q45 {y + 8} {45 - w} {y} Z" fill="{["#3f6e3a", "#467a40", "#4e8746", "#58934e"][i]}"/>'
        pine += f'<path d="M45 {y - 40} L{45 - w * 0.7} {y - 2}" stroke="#7fb06c" stroke-width="1.6" fill="none"/>'
    out["tree_pine"] = svg(90, 170, pine)
    leafy = lambda h, col, dots=None, trunkcol="#7a4e2c", seed=1: svg(140, h, shadow(70, h - 8, 34, 8) + trunk(70, h - 6, h * 0.45, 8, trunkcol)
                                                                   + crown(random.Random(seed), 70, h * 0.35, 58, h * 0.28, col, dots=dots))
    out["tree_apple"] = leafy(150, "#5f9a42", ("#d23b2a", 3.6, 14), seed=2)
    out["tree_cherry"] = leafy(150, "#f2a7c4", ("#fff0f6", 2.4, 22), "#6e4a3a", seed=5)
    out["tree_maple"] = leafy(160, "#e07a2a", ("#c43d22", 3, 18), seed=7)
    willow = shadow(75, 168, 40, 9) + trunk(75, 170, 70, 9, "#6e5643") + crown(random.Random(8), 75, 58, 56, 34, "#7fae4a", n=10)
    for i in range(16):
        x = 22 + i * 7
        willow += f'<path d="M{x} {50 + (i % 3) * 6} Q{x - 4} {100} {x + 2} {128 + (i % 4) * 8}" fill="none" stroke="#3f6a22" stroke-width="5"/>'
        willow += f'<path d="M{x} {50 + (i % 3) * 6} Q{x - 4} {100} {x + 2} {128 + (i % 4) * 8}" fill="none" stroke="#8fbe58" stroke-width="2.8"/>'
    out["tree_willow"] = svg(150, 175, willow)
    cyp = shadow(30, 162, 18, 5) + trunk(30, 165, 145, 4) + '<path d="M30 6 Q52 60 44 140 Q30 150 16 140 Q8 60 30 6 Z" fill="#3f6e3a"/>'
    cyp += '<path d="M28 20 Q20 70 22 130" stroke="#6f9e5c" stroke-width="2" fill="none"/><path d="M34 30 Q40 80 38 132" stroke="#2e5228" stroke-width="1.6" fill="none"/>'
    out["tree_cypress"] = svg(60, 170, cyp)
    # wild plants
    fern = shadow(25, 38, 20, 5)
    for a in (-2.6, -2.2, -1.8, -1.35, -0.95, -0.55):
        x2, y2 = 25 + math.cos(a) * 24, 36 + math.sin(a) * 24
        fern += f'<path d="M25 36 Q{25 + math.cos(a) * 14:.1f} {36 + math.sin(a) * 18:.1f} {x2:.1f} {y2:.1f}" fill="none" stroke="#3f6a22" stroke-width="5"/>'
        fern += f'<path d="M25 36 Q{25 + math.cos(a) * 14:.1f} {36 + math.sin(a) * 18:.1f} {x2:.1f} {y2:.1f}" fill="none" stroke="#6faa48" stroke-width="3"/>'
    out["plant_fern"] = svg(50, 44, fern)
    grass = shadow(20, 38, 16, 4) + "".join(f'<path d="M{20 + i * 2.2:.1f} 38 Q{20 + i * 3:.1f} 20 {20 + i * 4.2:.1f} {6 + abs(i) * 2}" fill="none" stroke="#3f6a22" stroke-width="3.6"/><path d="M{20 + i * 2.2:.1f} 38 Q{20 + i * 3:.1f} 20 {20 + i * 4.2:.1f} {6 + abs(i) * 2}" fill="none" stroke="#9cc25a" stroke-width="1.8"/>' for i in range(-4, 5))
    out["plant_grass"] = svg(42, 42, grass)
    flw = shadow(22, 36, 18, 4) + "".join(f'<path d="M{x} 37 L{x + d} {y}" stroke="#4f7a2a" stroke-width="1.8" fill="none"/>' for x, y, d in ((10, 16, -2), (16, 10, 1), (22, 14, 0), (28, 9, 2), (34, 17, 1), (19, 20, -1)))
    flw += "".join(f'<circle cx="{x}" cy="{y}" r="3.4" fill="{c}" stroke-width="1.2"/><circle cx="{x}" cy="{y}" r="1.1" fill="#f6d04a" stroke="none"/>'
                   for x, y, c in ((8, 16, "#e85a6a"), (17, 10, "#f2f2f2"), (22, 14, "#7a9be0"), (30, 9, "#f2c84a"), (35, 17, "#e85a6a"), (18, 20, "#c77ae0")))
    out["plant_flowers"] = svg(44, 40, flw)
    lav = shadow(22, 38, 18, 4) + "".join(f'<path d="M22 38 Q{22 + d * 0.4:.1f} 26 {22 + d:.1f} {10 + abs(d) * 0.6:.1f}" stroke="#5a7a3a" stroke-width="1.6" fill="none"/>'
                                           f'<ellipse cx="{22 + d:.1f}" cy="{12 + abs(d) * 0.6:.1f}" rx="2.6" ry="6" fill="#9a7ad0" stroke-width="1.2"/>' for d in (-14, -9, -4, 1, 6, 11, 15))
    out["plant_lavender"] = svg(44, 42, lav)
    mush = shadow(16, 26, 13, 3)
    for x, y, r, c in ((10, 22, 7, "#c7432a"), (21, 24, 5, "#d9a441")):
        mush += f'<rect x="{x - 2}" y="{y - 2}" width="4" height="7" fill="#f2e6cc"/><path d="M{x - r} {y} Q{x} {y - r * 1.6} {x + r} {y} Z" fill="{c}"/>'
        mush += f'<circle cx="{x - 2}" cy="{y - 4}" r="1.2" fill="#fff" stroke="none"/><circle cx="{x + 2}" cy="{y - 3}" r="1" fill="#fff" stroke="none"/>'
    out["plant_mushrooms"] = svg(32, 30, mush)
    return out


# ---- homes ------------------------------------------------------------------------------------------------------------
HOMES = {   # footprint (along the ridge, across), wall height, roof rise, walls, roof, trim, door, extras
    "home_cottage": dict(f=(1.6, 1.2), wall=58, roof=46, walls="#f3ead6", roof_c="#b4472f", trim="#6e4a30", door="#3f6e8a", beams=True, chimney=True),
    "home_bungalow": dict(f=(1.9, 1.3), wall=50, roof=38, walls="#e9c46a", roof_c="#7a4a32", trim="#f6efe0", door="#a8322a", porch=True),
    "home_terrace": dict(f=(1.2, 1.3), wall=104, roof=40, walls="#b55a3c", roof_c="#5a5f66", trim="#f6efe0", door="#2f4f3a", brick=True, storeys=2, chimney=True),
    "home_townhouse": dict(f=(1.4, 1.2), wall=112, roof=44, walls="#9fc3d6", roof_c="#3f4652", trim="#f6efe0", door="#c43d22", storeys=2),
    "home_farmhouse": dict(f=(2.0, 1.4), wall=70, roof=56, walls="#bdb3a2", roof_c="#5e3a26", trim="#6e4a30", door="#5a7a3a", stone=True, chimney=True),
    "home_shopfront": dict(f=(1.5, 1.5), wall=96, roof=36, walls="#d9e7d0", roof_c="#4e6b4a", trim="#2f4f3a", door="#2f4f3a", storeys=2, shop=True),
}


def iso(x, y, z, fx, fy):
    """A point on the house (x along its own x, y along its own y, z up), as screen pixels from its front corner."""
    return ((x - fx - (y - fy)) * TW / 2, (x - fx + y - fy) * TH / 2 - z)


def poly(pts, fill, extra=""):
    return f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="{fill}" {extra}/>'


def face_rect(face, fx, fy, a0, a1, z0, z1):
    """A rectangle on a wall: face "L" (y = fy, across x) or "R" (x = fx, across y); a0-a1 along it (tiles), z0-z1 up."""
    P = (lambda a, z: iso(a, fy, z, fx, fy)) if face == "L" else (lambda a, z: iso(fx, a, z, fx, fy))
    return [P(a0, z0), P(a1, z0), P(a1, z1), P(a0, z1)]


def home(spec, ridge_x):
    """ridge_x: the ridge along the house's x (its door on the left face) -- else along y (its door on the right face)."""
    fa, fb = spec["f"]
    fx, fy = (fa, fb) if ridge_x else (fb, fa)
    H, RF, W, RC = spec["wall"], spec["roof"], spec["walls"], spec["roof_c"]
    o = ""
    gnd = [iso(0, fy, 0, fx, fy), iso(fx, fy, 0, fx, fy), iso(fx, 0, 0, fx, fy)]
    o += f'<ellipse cx="0" cy="-6" rx="{(fx + fy) * TW / 4 + 18}" ry="{(fx + fy) * TH / 4 + 6}" fill="#2a1a0e" fill-opacity=".18" stroke="none"/>'
    left = [iso(0, fy, 0, fx, fy), iso(fx, fy, 0, fx, fy), iso(fx, fy, H, fx, fy), iso(0, fy, H, fx, fy)]
    right = [iso(fx, fy, 0, fx, fy), iso(fx, 0, 0, fx, fy), iso(fx, 0, H, fx, fy), iso(fx, fy, H, fx, fy)]
    # the gable end: on the right face (ridge along x) or the left (ridge along y)
    if ridge_x:
        gable = [iso(fx, fy, H, fx, fy), iso(fx, 0, H, fx, fy), iso(fx, fy / 2, H + RF, fx, fy)]
    else:
        gable = [iso(0, fy, H, fx, fy), iso(fx, fy, H, fx, fy), iso(fx / 2, fy, H + RF, fx, fy)]
    o += poly(left, shade(W, 0.9) if ridge_x else W) + poly(right, W if ridge_x else shade(W, 0.9)) + poly(gable, shade(W, 0.82))
    # brick or stone texture
    if spec.get("brick") or spec.get("stone"):
        for face in ("L", "R"):
            span = fx if face == "L" else fy
            rows = int(H / (9 if spec.get("brick") else 13))
            for r in range(1, rows):
                z = r * H / rows
                a, b = face_rect(face, fx, fy, 0, span, z, z)[0], face_rect(face, fx, fy, 0, span, z, z)[1]
                o += f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{shade(W, 0.75)}" stroke-width="1.1"/>'
    if spec.get("beams"):
        for face in ("L", "R"):
            span = fx if face == "L" else fy
            for a in (0.04, span / 2, span - 0.04):
                q = face_rect(face, fx, fy, a - 0.03, a + 0.03, 0, H)
                o += poly(q, spec["trim"], 'stroke-width="1.4"')
    storeys = spec.get("storeys", 1)
    door_face = "L" if ridge_x else "R"
    span_d = fx if door_face == "L" else fy
    other = "R" if door_face == "L" else "L"
    span_o = fy if door_face == "L" else fx
    win = lambda face, a0, a1, z0, z1: (poly(face_rect(face, fx, fy, a0 - 0.04, a1 + 0.04, z0 - 4, z1 + 4), spec["trim"], 'stroke-width="1.6"')
                                        + poly(face_rect(face, fx, fy, a0, a1, z0, z1), "#bfe0ea", 'stroke-width="1.4"')
                                        + f'<line x1="{face_rect(face, fx, fy, (a0 + a1) / 2, (a0 + a1) / 2, z0, z1)[0][0]:.1f}" y1="{face_rect(face, fx, fy, (a0 + a1) / 2, 0, z0, z1)[0][1]:.1f}" '
                                          f'x2="{face_rect(face, fx, fy, (a0 + a1) / 2, (a0 + a1) / 2, z0, z1)[3][0]:.1f}" y2="{face_rect(face, fx, fy, (a0 + a1) / 2, 0, z0, z1)[3][1]:.1f}" stroke-width="1.2"/>')
    # the door, middle of its face; windows either side and on the other face; upstairs windows
    dm = span_d / 2
    if spec.get("shop"):
        o += win(door_face, 0.12, dm - 0.22, 12, 44)
        q = face_rect(door_face, fx, fy, 0.05, span_d - 0.05, 46, 56)
        o += "".join(poly(face_rect(door_face, fx, fy, 0.05 + i * (span_d - 0.1) / 6, 0.05 + (i + 1) * (span_d - 0.1) / 6, 46, 58), c, 'stroke-width="1.2"') for i, c in enumerate(["#c43d22", "#f6efe0"] * 3))
    else:
        o += win(door_face, 0.14, dm - 0.2, 20, 40)
    o += win(door_face, dm + 0.2, span_d - 0.14, 20, 40)
    o += poly(face_rect(door_face, fx, fy, dm - 0.14, dm + 0.14, 0, 42), spec["door"], 'stroke-width="2"')
    knob = face_rect(door_face, fx, fy, dm + 0.08, dm + 0.08, 20, 20)[0]
    o += f'<circle cx="{knob[0]:.1f}" cy="{knob[1]:.1f}" r="1.6" fill="#e9c46a" stroke-width="1"/>'
    o += win(other, span_o * 0.3, span_o * 0.7, 20, 40)
    if storeys > 1:
        for face, span in ((door_face, span_d), (other, span_o)):
            for a0, a1 in ((0.14, span / 2 - 0.12), (span / 2 + 0.12, span - 0.14)):
                o += win(face, a0, a1, H - 42, H - 16)
    if spec.get("porch"):
        q = face_rect(door_face, fx, fy, dm - 0.3, dm + 0.3, 44, 50)
        o += poly(q, spec["trim"], 'stroke-width="1.6"')
    # the roof: the slope on the door's side (whole), the far slope's top showing over the ridge
    e = 0.08   # eaves
    if ridge_x:
        far = [iso(-e, fy / 2, H + RF, fx, fy), iso(fx + e, fy / 2, H + RF, fx, fy), iso(fx + e, -e, H - 4, fx, fy), iso(-e, -e, H - 4, fx, fy)]
        near = [iso(-e, fy + e, H - 4, fx, fy), iso(fx + e, fy + e, H - 4, fx, fy), iso(fx + e, fy / 2, H + RF, fx, fy), iso(-e, fy / 2, H + RF, fx, fy)]
    else:
        far = [iso(fx / 2, -e, H + RF, fx, fy), iso(fx / 2, fy + e, H + RF, fx, fy), iso(-e, fy + e, H - 4, fx, fy), iso(-e, -e, H - 4, fx, fy)]
        near = [iso(fx + e, -e, H - 4, fx, fy), iso(fx + e, fy + e, H - 4, fx, fy), iso(fx / 2, fy + e, H + RF, fx, fy), iso(fx / 2, -e, H + RF, fx, fy)]
    o += poly(far, shade(RC, 0.8))
    if spec.get("chimney"):
        cx = fx * 0.25 if ridge_x else fx * 0.35
        cy = fy * 0.3 if ridge_x else fy * 0.25
        top = H + RF * 0.95
        q = [iso(cx, cy + 0.16, H + RF * 0.4, fx, fy), iso(cx + 0.16, cy + 0.16, H + RF * 0.4, fx, fy), iso(cx + 0.16, cy + 0.16, top, fx, fy), iso(cx, cy + 0.16, top, fx, fy)]
        q2 = [iso(cx + 0.16, cy + 0.16, H + RF * 0.4, fx, fy), iso(cx + 0.16, cy, H + RF * 0.4, fx, fy), iso(cx + 0.16, cy, top, fx, fy), iso(cx + 0.16, cy + 0.16, top, fx, fy)]
        o += poly(q, "#a8503a") + poly(q2, "#8a3e2c")
    o += poly(near, RC)
    # roof shingles: lines along the slope
    for k in (0.25, 0.5, 0.75):
        if ridge_x:
            a, b = iso(-e, fy + e - k * (fy / 2 + e), H - 4 + k * (RF + 4), fx, fy), iso(fx + e, fy + e - k * (fy / 2 + e), H - 4 + k * (RF + 4), fx, fy)
        else:
            a, b = iso(fx + e - k * (fx / 2 + e), -e, H - 4 + k * (RF + 4), fx, fy), iso(fx + e - k * (fx / 2 + e), fy + e, H - 4 + k * (RF + 4), fx, fy)
        o += f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{shade(RC, 0.7)}" stroke-width="1.5"/>'
    # the canvas: the front corner at the bottom middle (6px of room under it)
    half = max(fx, fy) * TW / 2 + 14
    top = -(H + RF + (fx + fy) * TH / 2 + 30)
    return svg(round(half * 2), round(-top + 8), o, ox=-round(half), oy=round(top))


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    pics = {}
    for k, v in list(rocks().items()) + list(trees().items()):
        pics["prop-" + k] = v
    for k, spec in HOMES.items():
        pics[f"prop-{k}-l"] = home(spec, True)
        pics[f"prop-{k}-r"] = home(spec, False)
    for pid, src in pics.items():
        im = render(src)
        if not pid.startswith("prop-home"):
            im = im.crop(im.getbbox())          # (a garden thing: trimmed; its feet are its bottom)
        im.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=92, method=6)
        sizes[pid] = list(im.size)
        print(f"  {pid}.webp {im.size}")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
