#!/usr/bin/env python3
"""NeuroCafe, potted plants for indoors (Cam, 25 Oct: "potted version of the lavender, flowers and ferns for outside"):
stand-in pictures until Gemini paints them (N60) -- the garden's own lavender, wildflowers and wild ferns (prop-plant_*)
set in a terracotta pot drawn in the game's ink style. Writes pot_<plant>.webp and adds them to the manifest.

    python3 tools/make_cafe_pots.py
"""
import io
import json
import os
import sys
import subprocess
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
INK = "#3a1d14"
PLANTS = {"pot_lavender": "prop-plant_lavender", "pot_flowers": "prop-plant_flowers", "pot_ferns": "prop-plant_fern"}
POT = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 110" width="480" height="440"><g stroke="{INK}" stroke-width="3" stroke-linejoin="round">'
       '<path d="M22 30 L32 100 Q60 108 88 100 L98 30 Z" fill="#c4683c"/><path d="M34 40 L40 92" stroke="#e39466" stroke-width="4" fill="none"/>'
       '<path d="M16 18 L104 18 L104 32 Q60 40 16 32 Z" fill="#d97c4c"/><ellipse cx="60" cy="18" rx="44" ry="8" fill="#5a3a22"/></g></svg>')


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    pot = Image.open(io.BytesIO(subprocess.run(["rsvg-convert", "-f", "png"], input=POT.encode(), capture_output=True, check=True).stdout)).convert("RGBA")
    pot = pot.crop(pot.getbbox())
    for pid, src in PLANTS.items():
        if "--force" not in sys.argv and os.path.exists(os.path.join(OUT, pid + ".webp")):
            continue                                       # (never over a picture that's there -- it may be painted now)
        plant = Image.open(os.path.join(OUT, src + ".webp")).convert("RGBA")
        k = pot.width * 1.5 / plant.width                                 # (the plant wider than the pot, like the potted fern)
        plant = plant.resize((round(plant.width * k), round(plant.height * k)), Image.LANCZOS)
        sp = round(pot.height * 0.2)                                      # (its base down in the soil, behind the rim's front)
        small = pot.resize((round(pot.width * 0.8), round(pot.height * 0.8)), Image.LANCZOS)
        W = max(small.width, plant.width)
        im = Image.new("RGBA", (W, plant.height - sp + small.height), (0, 0, 0, 0))
        im.alpha_composite(small, ((W - small.width) // 2, plant.height - sp))
        im.alpha_composite(plant, ((W - plant.width) // 2, 0))
        front = small.crop((0, round(small.height * 0.16), small.width, small.height))   # (the rim's front and the pot over the plant's foot)
        im.alpha_composite(front, ((W - small.width) // 2, plant.height - sp + round(small.height * 0.16)))
        im.thumbnail((300, 300), Image.LANCZOS)
        im.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=90, method=6)
        sizes[pid] = list(im.size)
        print(f"  {pid}.webp {im.size}")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
