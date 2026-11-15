#!/usr/bin/env python3
"""NeuroCafe's pantry cupboard (2026-10-25, Cam: "Pantry will become a cupboard object that is placed"): a stand-in drawn
here in the game's outlined style, on the bookshelf's angle and size, till it's painted (Collaboration N64). Writes
ui/cafe/art/cupboard.webp and adds it to ui/cafe/art/manifest.js.

    python3 tools/make_cafe_cupboard.py
"""
import io
import json
import os
import subprocess
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
INK = "#3a1d14"
O, U, V, S = (8, 34), (142, 70), (0, 196), (56, -30)      # front's top-left corner; along the front; down; back (the side)


def P(fu, fv, fs=0.0):
    return (O[0] + U[0] * fu + V[0] * fv + S[0] * fs, O[1] + U[1] * fu + V[1] * fv + S[1] * fs)


def poly(pts, fill, w=4, extra=""):
    return f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="{fill}" stroke="{INK}" stroke-width="{w}" stroke-linejoin="round"{extra}/>'


def quad(u0, v0, u1, v1, fill, w=3, s=0.0):
    return poly([P(u0, v0, s), P(u1, v0, s), P(u1, v1, s), P(u0, v1, s)], fill, w)


def main():
    b = []
    b.append(poly([P(0, 0), P(0, 0, 1), P(1, 0, 1), P(1, 0)], "#f6ecd2"))                     # top
    b.append(poly([P(1, 0), P(1, 0, 1), P(1, 1, 1), P(1, 1)], "#d9c7a0"))                     # side
    b.append(poly([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], "#efe2c3"))                           # front
    b.append(quad(0, -0.025, 1, 0.045, "#b07a46", 3))                                         # the top's wooden edge
    # the open shelf: a dark back, jars on it
    b.append(quad(0.07, 0.09, 0.93, 0.36, "#7a5434", 3))
    b.append(quad(0.07, 0.33, 0.93, 0.37, "#b07a46", 2))
    jars = [(0.16, "#e8a04a", 0.17), (0.3, "#c84a3a", 0.2), (0.44, "#9fc46a", 0.15), (0.6, "#f2d36a", 0.19), (0.76, "#d9773a", 0.16), (0.87, "#a46ad0", 0.13)]
    for u, col, h in jars:
        x, y = P(u, 0.335)
        w = 15
        b.append(f'<rect x="{x - w / 2:.1f}" y="{y - h * 196:.1f}" width="{w}" height="{h * 196:.1f}" rx="4" fill="{col}" stroke="{INK}" stroke-width="2.5"/>')
        b.append(f'<rect x="{x - w / 2 - 1:.1f}" y="{y - h * 196 - 5:.1f}" width="{w + 2}" height="6" rx="2" fill="#f6ecd2" stroke="{INK}" stroke-width="2"/>')
        b.append(f'<rect x="{x - w / 2 + 3:.1f}" y="{y - h * 196 + 5:.1f}" width="3" height="{h * 196 - 12:.1f}" rx="1.5" fill="#fff" opacity=".45"/>')
    # the two doors, each panelled, a knob by the middle
    for u0, u1, knob in ((0.06, 0.49, 0.43), (0.51, 0.94, 0.57)):
        b.append(quad(u0, 0.43, u1, 0.93, "#f3e8cc", 3))
        b.append(quad(u0 + 0.06, 0.5, u1 - 0.06, 0.86, "#e6d6b0", 2.5))
        x, y = P(knob, 0.66)
        b.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="#c9973f" stroke="{INK}" stroke-width="2.2"/>')
    # feet
    for u in (0.03, 0.97):
        x, y = P(u, 1)
        b.append(f'<rect x="{x - 6:.1f}" y="{y - 2:.1f}" width="12" height="12" rx="2" fill="#b07a46" stroke="{INK}" stroke-width="2.5"/>')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="210" height="300" viewBox="0 -10 210 300">{"".join(b)}</svg>'
    png = subprocess.run(["rsvg-convert", "-f", "png"], input=svg.encode(), capture_output=True, check=True).stdout
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    im = im.crop(im.getbbox())
    im.save(os.path.join(OUT, "cupboard.webp"), "WEBP", quality=92, method=6)
    man = os.path.join(OUT, "manifest.js")
    text = open(man, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    sizes["cupboard"] = list(im.size)
    open(man, "w", encoding="utf-8").write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)
    print("  cupboard.webp", im.size)


if __name__ == "__main__":
    main()
