#!/usr/bin/env python3
"""Cut Cam's painted player sheets into NeuroPets (2026-10-10). tools/player_sheets/plan.txt: "N POSE [CxR]: skin-hair-outfit,..."
(A portrait, B battle facing right; 4x4 unless said; "-" skips a repeat). Files: ~/Pictures/NeuroPets Art Assets/Player/
"player - sheet N.jpeg". Saved as ui/pet/art/player/<s>-<h>-<o>-<a|fight>.webp; art/player/manifest.js lists them."""
import json, os, re, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_icon_sheet import grid_lines, cut_cell
from cut_pet_sheets import main_body

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "ui", "pet", "art", "player")
SRC = os.path.expanduser("~/Pictures/NeuroPets Art Assets/Player")
POSE = {"A": "a", "B": "fight"}

def main():
    os.makedirs(OUT, exist_ok=True)
    files = os.listdir(SRC) if os.path.isdir(SRC) else []
    done = 0
    for line in open(os.path.join(HERE, "player_sheets", "plan.txt")):
        m = re.match(r"\s*(\d+)\s+([AB])\s*(?:\[(\d+)x(\d+)\])?\s*:\s*(.+)", line)
        if not m: continue
        n, pose = m.group(1), POSE[m.group(2)]
        cols, rows = int(m.group(3) or 4), int(m.group(4) or 4)
        found = [f for f in files if re.sub(r"\s+", " ", f.lower()).replace("player - ", "player- ").startswith("player- sheet %s." % n)]
        if not found: print("not made yet: player - sheet %s.jpeg" % n); continue
        raw = Image.open(os.path.join(SRC, found[0])).convert("RGB")
        W, H = raw.size
        xs, ys = grid_lines(raw, cols, "x"), grid_lines(raw, rows, "y")
        for i, lid in enumerate(x.strip() for x in m.group(5).split("#")[0].split(",")):
            if lid == "-": continue
            c, r = i % cols, i // cols
            cell = main_body(cut_cell(raw.crop((xs[2 * c], ys[2 * r], xs[2 * c + 1], ys[2 * r + 1])), pockets=False))   # pink tunics are near the pink background
            bb = cell.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
            if not bb: print("  empty:", lid); continue
            obj = cell.crop(bb)
            k = 360 / max(obj.size)
            if k < 1: obj = obj.resize((round(obj.size[0] * k), round(obj.size[1] * k)), Image.LANCZOS)
            obj.save(os.path.join(OUT, "%s-%s.webp" % (lid, pose)), quality=90, method=6)
            done += 1
        print(found[0], "cut")
    have = {}
    for f in sorted(os.listdir(OUT)):
        m = re.match(r"(\d-\d-\d)-(a|fight)\.webp$", f)
        if m: have.setdefault(m.group(1), {})[m.group(2)] = 1
    with open(os.path.join(OUT, "manifest.js"), "w") as fh:
        fh.write("/* Painted player looks (2026-10-10): \"skin-hair-outfit\" -> poses (a = portrait, fight = battle, facing right).\n"
                 "   art/player/<look>-<pose>.webp. Written by tools/cut_player_sheets.py. */\n")
        fh.write("window.PLAYER_PICS = " + json.dumps(have) + ";\n")
    print("%d cut; %d looks." % (done, len(have)))

if __name__ == "__main__":
    main()
