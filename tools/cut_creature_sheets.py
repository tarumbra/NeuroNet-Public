#!/usr/bin/env python3
"""Cut Cam's painted creature sheets into NeuroPets (2026-10-10). tools/creature_sheets/plan.txt: "N [file M]: id,id,..."
(4x4, left to right; "id@c,r,w,h" for one drawn across several cells). Each creature is cut out like the pets, turned to
face LEFT if it was painted facing right (tools/creature_sheets/faces_right.txt), and saved as
ui/pet/art/creatures/<id>.webp; art/creatures/manifest.js lists them."""
import json, os, re, sys
from PIL import Image, ImageOps
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_icon_sheet import grid_lines, cut_cell
from cut_pet_sheets import main_body

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "ui", "pet", "art", "creatures")
SRC = os.path.expanduser("~/Pictures/NeuroPets Art Assets/Creatures")
MAX = 360

def main():
    os.makedirs(OUT, exist_ok=True)
    rf = os.path.join(HERE, "creature_sheets", "faces_right.txt")
    right = {l.strip() for l in open(rf) if l.strip() and not l.startswith("#")} if os.path.exists(rf) else set()
    files = os.listdir(SRC) if os.path.isdir(SRC) else []
    done = 0
    for line in open(os.path.join(HERE, "creature_sheets", "plan.txt")):
        m = re.match(r"\s*(\d+)\s*(?:\[file (\d+)\])?\s*:\s*(.+)", line)
        if not m: continue
        num = m.group(2) or m.group(1)
        found = [f for f in files if f.lower().startswith("creature- sheet %s." % num)]
        if not found: print("not made yet: creature- sheet %s.jpeg" % num); continue
        raw = Image.open(os.path.join(SRC, found[0])).convert("RGB")
        W, H = raw.size
        xs, ys = grid_lines(raw, 4, "x"), grid_lines(raw, 4, "y")
        if len(xs) != 8: xs = [0] + [v for k in range(1, 4) for v in (round(k * W / 4),) * 2] + [W]
        if len(ys) != 8: ys = [0] + [v for k in range(1, 4) for v in (round(k * H / 4),) * 2] + [H]
        for i, spec in enumerate(x.strip() for x in m.group(3).split("#")[0].split(",")):
            if spec == "-": continue
            cid, c, r, cw, ch = spec, i % 4, i // 4, 1, 1
            if "@" in spec:
                cid, pos = spec.split("@"); c, r, cw, ch = (int(v) for v in pos.split("."))
            cell = main_body(cut_cell(raw.crop((xs[2 * c], ys[2 * r], xs[2 * (c + cw - 1) + 1], ys[2 * (r + ch - 1) + 1]))))
            bb = cell.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
            if not bb: print("  empty:", cid); continue
            obj = cell.crop(bb)
            if cid in right: obj = ImageOps.mirror(obj)
            k = MAX / max(obj.size)
            if k < 1: obj = obj.resize((round(obj.size[0] * k), round(obj.size[1] * k)), Image.LANCZOS)
            obj.save(os.path.join(OUT, cid + ".webp"), quality=90, method=6)
            done += 1
        print(found[0], "cut")
    have = sorted(f[:-5] for f in os.listdir(OUT) if f.endswith(".webp"))
    with open(os.path.join(OUT, "manifest.js"), "w") as fh:
        fh.write("/* Painted creatures (2026-10-10), all facing left: art/creatures/<id>.webp. Written by tools/cut_creature_sheets.py. */\n")
        fh.write("window.MONSTER_PICS = " + json.dumps({k: 1 for k in have}) + ";\n")
    print("%d cut; %d painted creatures." % (done, len(have)))

if __name__ == "__main__":
    main()
