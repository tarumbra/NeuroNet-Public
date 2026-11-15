#!/usr/bin/env python3
"""Cut Cam's painted livestock sheets into the Farm's animals (2026-10-12). Reads tools/livestock_sheets/plan.txt and
~/Pictures/NeuroPets Art Assets/Pets/livestock- sheet N.jpeg; writes ui/pet/art/livestock/<kind>-<breed>-<pose>.webp
(256x256, background keyed out) and ui/pet/art/livestock/manifest.js (window.LIVESTOCK_PICS). Uses the icon cutter's own
grid finding and keying, so a sheet behaves the same as an icon sheet. Run it again after adding a sheet."""
import json, os, re, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cut_icon_sheet import grid_lines, cut_cell  # noqa: E402
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "ui", "pet", "art", "livestock")
SRC = os.path.expanduser("~/Pictures/NeuroPets Art Assets/Pets")
SIZE = 256

def main():
    os.makedirs(OUT, exist_ok=True)
    pics, waiting = {}, []
    for line in open(os.path.join(HERE, "livestock_sheets", "plan.txt")):
        m = re.match(r"\s*(\d+)\s+(\w+)\s*:\s*(.+)", line)
        if not m:
            continue
        n, pose, ids = m.group(1), m.group(2), [x.strip() for x in m.group(3).split(",")]
        found = [f for f in os.listdir(SRC) if f.lower().replace(" - ", "- ").startswith("livestock- sheet %s." % n)]
        if not found:
            waiting.append(n); continue
        raw = Image.open(os.path.join(SRC, found[0])).convert("RGB")
        inset = 14 if raw.size[0] >= 2000 else 7                         # a 1024px sheet has thinner grid lines
        xs, ys = grid_lines(raw, 4, "x"), grid_lines(raw, 4, "y")
        for i, key in enumerate(ids):
            if key == "-":
                continue
            c, r = i % 4, i // 4
            cell = cut_cell(raw.crop((xs[2 * c], ys[2 * r], xs[2 * c + 1], ys[2 * r + 1])), inset=inset)
            bb = cell.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
            if not bb:
                print("  %-18s empty cell -- skipped" % key); continue
            obj = cell.crop(bb)
            side = int(max(obj.size) * 1.06)
            sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            sq.paste(obj, ((side - obj.size[0]) // 2, side - obj.size[1] - (side - obj.size[1]) // 4))   # standing a little low
            sq.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, key.replace("/", "-") + "-" + pose + ".webp"), quality=90, method=6)
            pics.setdefault(key, {})[pose] = 1
            print("  %-18s %s" % (key, pose))
    with open(os.path.join(OUT, "manifest.js"), "w") as f:
        f.write("/* Painted farm animals (2026-10-12): \"kind/breed\" -> poses there are (a = standing, walk = walking), as\n"
                "   art/livestock/<kind>-<breed>-<pose>.webp. Written by tools/cut_livestock_sheets.py -- don't edit by hand. */\n")
        f.write("window.LIVESTOCK_PICS = %s;\n" % json.dumps(pics, sort_keys=True))
    print("%d animals%s" % (len(pics), "; sheets not made yet: " + ", ".join(waiting) if waiting else ""))

if __name__ == "__main__":
    main()
