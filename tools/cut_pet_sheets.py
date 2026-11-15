#!/usr/bin/env python3
"""Cut Cam's painted pet sheets into NeuroPets (2026-10-10). tools/pet_sheets/plan.txt says what's in each cell; the files are
~/Pictures/NeuroPets Art Assets/Pets/pet- Sheet N.jpeg (portraits), "pet- Sheet N - Side.jpeg", "pet- Sheet N - Asleep.jpeg",
any shape of 4x4 grid ("- Sleep" does for "- Asleep"; a cell "id:side" or "id:side+a" sets its own pose(s)). Each pet is cut out (background flooded in from the edges, as for item icons), painted labels and
specks dropped, trimmed, and saved as ui/pet/art/pets/<species>-<colour>-<a|side|sleep>.webp; art/pets/manifest.js lists them.

    python3 tools/cut_pet_sheets.py            all sheets that exist
    python3 tools/cut_pet_sheets.py --only 3   just the third set (its portraits, side views and sleepers)"""
import json, os, re, sys
from collections import deque
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_icon_sheet import grid_lines, cut_cell

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "ui", "pet", "art", "pets")
SRC = os.path.expanduser("~/Pictures/NeuroPets Art Assets/Pets")
# --spectral (2026-10-16, the risen's look -- note 10): the same plan, from Pets/Spectral, into art/pets/spectral, listed as
# window.PET_SPECTRAL (only the sets Cam has painted; a risen without one keeps the page's ghostly tint)
SPECTRAL = "--spectral" in sys.argv
if SPECTRAL:
    OUT = os.path.join(OUT, "spectral"); SRC = os.path.join(SRC, "Spectral")
POSE = {"A": ("a", ""), "B": ("side", " - Side"), "C": ("sleep", " - Asleep")}
MAX = 320

def drop_glow(im):
    """Take off a painted pink glow round the pet (2026-10-18, Cam: the Red-dust Hound stood in a pink haze in the room). The
    glow is the sheet's dusky pink lit up -- blue about as strong as green, unlike the pets' own reds and browns -- so it is
    flooded away from the outside in, and pink inside a pet (a tongue, a blush) stays."""
    px = im.load(); w, h = im.size
    def pink(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and r > 140 and r > g + 28 and (b >= g - 10 or (b >= g - 36 and g > 105))   # (its warm, peachy rim too)
    seen = bytearray(w * h); q = deque()
    for x in range(w):
        for y in range(h):
            if px[x, y][3] < 24 or x in (0, w - 1) or y in (0, h - 1): seen[y * w + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        if px[x, y][3] >= 24: px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and pink(nx, ny):
                seen[ny * w + nx] = 1; q.append((nx, ny))
    # the soft fringe where the glow met the outline: half-pink pixels beside the cleared space fade out
    for _ in range(2):
        clear = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] == 0]
        for x, y in clear:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    r, g, b, a = px[nx, ny]
                    if a and r > g + 20 and b >= g - 18 and r > 120: px[nx, ny] = (r, g, b, a // 3)
    return im

def main_body(im):
    """Keep the animal: drop small separate bits near the top (a painted name) and specks."""
    a = im.split()[3]
    w, h = a.size
    s = 4                                                     # work on a quarter-size mask: quick, and enough
    sm = a.resize((w // s, h // s)).point(lambda v: 255 if v > 40 else 0)
    W, H = sm.size; px = sm.load(); seen = [[0] * W for _ in range(H)]; comps = []
    for y in range(H):
        for x in range(W):
            if px[x, y] and not seen[y][x]:
                q = deque([(x, y)]); seen[y][x] = 1; pts = []
                while q:
                    cx, cy = q.popleft(); pts.append((cx, cy))
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < W and 0 <= ny < H and px[nx, ny] and not seen[ny][nx]:
                            seen[ny][nx] = 1; q.append((nx, ny))
                comps.append(pts)
    if not comps: return im
    big = max(len(c) for c in comps)
    main = max(comps, key=len)
    mx0, mx1 = min(p[0] for p in main), max(p[0] for p in main)
    my0, my1 = min(p[1] for p in main), max(p[1] for p in main)
    outside = lambda c: all(p[1] < my0 - 1 or p[1] > my1 + 1 or p[0] < mx0 - 1 or p[0] > mx1 + 1 for p in c)
    # a painted name (above or below), sparkles and specks: small and clear of the animal's own outline
    top = lambda c: sum(p[1] for p in c) / len(c) < 0.22 * H                   # labels sit in the cell's top band
    drop = [c for c in comps if c is not main and len(c) < 0.06 * big and (outside(c) or top(c) or len(c) < 0.004 * big)]
    keep = [c for c in comps if c not in drop]
    # keep only what's near a kept part: faint ghosts of lettering (too faint to be a part) go too
    from PIL import ImageFilter
    km = Image.new("L", (W, H), 0); kp = km.load()
    for c in keep:
        for cx, cy in c: kp[cx, cy] = 255
    km = km.filter(ImageFilter.MaxFilter(5)).resize((w, h))
    a = Image.composite(a, Image.new("L", (w, h), 0), km)
    if not drop: im = im.copy(); im.putalpha(a); return im
    a = a.copy(); ap = a.load()
    for c in drop:
        for cx, cy in c:
            for dy in range(-1, s + 1):
                for dx in range(-1, s + 1):
                    X, Y = cx * s + dx, cy * s + dy
                    if 0 <= X < w and 0 <= Y < h: ap[X, Y] = 0
    im = im.copy(); im.putalpha(a)
    return im

def _lines_found(raw, k):
    """Does the sheet have exactly k-1 dividing lines across (rather than grid_lines falling back to even rows)?"""
    ys = grid_lines(raw, k, "y")
    even = [0] + [v for j in range(1, k) for v in (round(j * raw.size[1] / k),) * 2] + [raw.size[1]]
    return ys != even

def main():
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    os.makedirs(OUT, exist_ok=True)
    files = os.listdir(SRC) if os.path.isdir(SRC) else []
    done = 0
    for line in open(os.path.join(HERE, "pet_sheets", "plan.txt")):
        m = re.match(r"\s*(\d+)\s+([ABC])\s*:\s*(.+)", line)
        if not m: continue
        n, pose, ids = int(m.group(1)), m.group(2), [x.strip() for x in m.group(3).split("#")[0].split(",")]
        noglow = "!noglow" in m.group(3)                                    # a painted pink glow to take off (the planet pets)
        set_no = n - {"A": 0, "B": 5, "C": 10}[pose]
        if only and str(set_no) != only: continue
        want = ("pet- sheet %d%s." % (set_no, POSE[pose][1])).lower()
        flat = lambda f: re.sub(r"\s+", " ", f.lower()).replace("pet - sheet", "pet- sheet")   # "pet - sheet 6" is fine too (2026-10-11)
        found = [f for f in files if flat(f).startswith(want)]
        if not found and pose == "C":                                    # "pet- Sheet 7 - Sleep.jpeg" (2026-10-18)
            found = [f for f in files if flat(f).startswith(want.replace(" - asleep.", " - sleep."))]
        if not found: print("not made yet:", want + "jpeg"); continue
        raw = Image.open(os.path.join(SRC, found[0])).convert("RGB")
        xs = grid_lines(raw, 4, "x")
        rows = next((k for k in (4, 3, 2) if len(grid_lines(raw, k, "y")) == 2 * k and _lines_found(raw, k)), 4)   # 4 rows, or fewer
        ys = grid_lines(raw, rows, "y")
        for i, pid in enumerate(ids):
            if pid == "-": continue
            # a cell may say its own pose(s): "id:side", or "id:side+a" to stand in for a broken cell elsewhere (2026-10-18:
            # set 7 paints each planet pet as portrait then side view, and two of its cells need repainting)
            poses = [POSE[pose][0]]
            if ":" in pid: pid, poses = pid.split(":")[0], pid.split(":")[1].split("+")
            c, r = i % 4, i // 4
            if 2 * r + 1 >= len(ys): continue
            # a small sheet (1024 px: thin outlines) gets a tighter cut, or the background seeps into pale animals (2026-10-11,
            # set 6's sleeping Sphynx, ram and polar bear came out washed out)
            tight = {"thresh": 30, "pocket": 20} if raw.size[0] < 1600 else {}
            cell = main_body(cut_cell(raw.crop((xs[2 * c], ys[2 * r], xs[2 * c + 1], ys[2 * r + 1])), **tight))
            bb = cell.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
            if not bb: print("  empty cell:", pid, POSE[pose][0]); continue
            obj = cell.crop(bb)
            if noglow:
                obj = drop_glow(obj); bb2 = obj.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
                if bb2: obj = obj.crop(bb2)
            k = MAX / max(obj.size)
            if k < 1: obj = obj.resize((max(1, round(obj.size[0] * k)), max(1, round(obj.size[1] * k))), Image.LANCZOS)
            for ps in poses:
                obj.save(os.path.join(OUT, "%s-%s.webp" % (pid, ps)), quality=90, method=6)
                done += 1
        print("%s: %d pets" % (found[0], len([x for x in ids if x != "-"])))
    have = {}
    for f in sorted(os.listdir(OUT)):
        m = re.match(r"(.+?)-([a-z]+)-(a|side|sleep)\.webp$", f)
        if m: have.setdefault(m.group(1) + "/" + m.group(2), {})[m.group(3)] = 1
    with open(os.path.join(OUT, "manifest.js"), "w") as fh:
        fh.write("/* Painted pets (2026-10-10): \"species/colour\" -> poses there are (a = portrait, side = walking, sleep = asleep), as\n"
                 "   art/pets/<species>-<colour>-<pose>.webp. Written by tools/cut_pet_sheets.py -- don't edit by hand. */\n")
        fh.write(("window.PET_SPECTRAL = " if SPECTRAL else "window.PET_PICS = ") + json.dumps(have) + ";\n")
    print("%d pictures cut; %d pets painted." % (done, len(have)))

if __name__ == "__main__":
    main()
