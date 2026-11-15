#!/usr/bin/env python3
"""Cut every painted icon sheet listed in tools/icon_sheets/*.txt (2026-10-10). Each line: "N: id,id,..." for
~/Pictures/NeuroPets Art Assets/Icons/icon- sheet N.jpeg. Run after adding a sheet and its line."""
import glob, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.expanduser("~/Pictures/NeuroPets Art Assets/Icons")
done, waiting = 0, []
KEEP = set()
kf = os.path.join(HERE, "icon_sheets", "hand_fixed.list")
if os.path.exists(kf):
    KEEP = {l.strip() for l in open(kf) if l.strip() and not l.startswith("#")}
for f in sorted(glob.glob(os.path.join(HERE, "icon_sheets", "*.txt"))):
    for line in open(f):
        m = re.match(r"\s*(\d+)\s*(?:\[(\d+x\d+)\])?\s*(?:\{([^}]+)\})?\s*:\s*(.+)", line)   # {file} when Cam's name differs        # "N [colsxrows]: ids" -- 4x4 unless said
        if not m: continue
        if m.group(3) and m.group(3).startswith("@"):                          # {@crops/x.png}: a crop kept with these plans (2026-10-16)
            found = [os.path.join(HERE, "icon_sheets", m.group(3)[1:])]
        elif m.group(3) and os.path.exists(os.path.join(SRC, m.group(3))): found = [m.group(3)]
        else:
          want = "icon- sheet %s." % m.group(1)                              # any capitals, .jpeg/.jpg/.png
          found = [f for f in os.listdir(SRC) if f.lower().replace("icon - ", "icon- ").startswith(want) and f.lower().rsplit(".", 1)[-1] in ("jpeg", "jpg", "png", "webp")]
        sheet = os.path.join(SRC, found[0]) if found else os.path.join(SRC, "icon- sheet %s.jpeg" % m.group(1))
        if not os.path.exists(sheet): waiting.append(m.group(1)); continue
        r = subprocess.run([sys.executable, os.path.join(HERE, "cut_icon_sheet.py"), sheet, "--grid", m.group(2) or "4x4", "--ids=" + ",".join("-" if x in KEEP else x for x in m.group(4).split("#")[0].replace(" ", "").split(","))], capture_output=True, text=True)
        print("sheet %s: %s" % (m.group(1), (r.stdout.strip().splitlines() or [r.stderr.strip()])[-1]))
        done += r.returncode == 0
print("%d sheets cut%s" % (done, "; not made yet: " + ", ".join(waiting) if waiting else ""))
