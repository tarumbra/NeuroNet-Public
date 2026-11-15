#!/usr/bin/env python3
"""Cut a sheet of painted item icons (made with Gemini from the audit's prompts) into NeuroPets icons (2026-10-10, H-6).

    python3 tools/cut_icon_sheet.py SHEET.png --grid 4x4 --ids apple,pear,berry,...   (left to right, top to bottom)
    python3 tools/cut_icon_sheet.py SHEET.png --grid 4x4 --ids ... --dry-run          (show what would be written)

The sheet's background is removed whether it's transparent, flat magenta (#ff00ff), white, or the grey-and-white
"transparent" checkerboard image tools sometimes paint in. Each cell is trimmed to its object, padded to a square and saved
as ui/pet/art/icons/<id>.webp at 128x128; ui/pet/art/icons/manifest.js is rewritten so the game uses them. Use "-" in --ids
to skip a cell. Existing icons are replaced. Ids must be NeuroPets item ids (checked against ui/pet/petcore.js)."""
import argparse, json, os, re, subprocess, sys
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
ICONS = os.path.join(APP, "ui", "pet", "art", "icons")
SIZE = 128

def item_ids():
    js = ("const fs=require('fs'),vm=require('vm');const c={window:{},console};vm.createContext(c);"
          "vm.runInContext(fs.readFileSync(%s,'utf8'),c);const C=c.window.PetCore||c.PetCore;"
          "const t=[];Object.keys(C.TALENTS).forEach(k=>C.TALENTS[k].branches.forEach(b=>b.nodes.forEach(n=>t.push('talent_'+n.id))));"   # (the talent tree's badges, 2026-10-17)
          "Object.keys(C.CLASSES).forEach(k=>Object.keys(C.CLASSES[k].specials).forEach(x=>t.push('spec_'+x)));['weapon','signature'].forEach(g=>Object.keys(C.SPECIALS[g]).forEach(x=>t.push('spec_'+x)));"   # (the specials' icons, V18)
          "console.log(JSON.stringify(Object.keys(C.ITEMS).concat(t)))"
          % json.dumps(os.path.join(APP, "ui", "pet", "petcore.js")))
    ids = set(json.loads(subprocess.check_output(["node", "-e", js], text=True)))
    # and the game's own picture-only icons (benches, places, the top bar): obj_*, heart, tome, starteregg
    art = open(os.path.join(APP, "ui", "pet", "petart.js"), encoding="utf-8").read()
    return ids | set(re.findall(r"^\s+(obj_[a-z]+|heart|tome|starteregg):", art, re.M)) | {"specialegg", "bredegg", "coastegg", "poop", "starteregg"}

def key_out(im):
    """Alpha from the image: keep what's there, drop magenta, white and checkerboard greys (low saturation, bright)."""
    im = im.convert("RGBA")
    r, g, b, a = im.split()
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    grey = ImageChops.subtract(mx, mn).point(lambda v: 255 if v <= 14 else 0)
    bright = mx.point(lambda v: 255 if v >= 165 else 0)
    paper = ImageChops.multiply(grey, bright)                                        # white / checkerboard
    magenta = Image.merge("RGB", (r, g, b)).point(lambda v: v).convert("RGB")
    mr, mg, mb = magenta.split()
    mag = ImageChops.multiply(ImageChops.multiply(mr.point(lambda v: 255 if v >= 200 else 0), mb.point(lambda v: 255 if v >= 200 else 0)),
                              mg.point(lambda v: 255 if v <= 80 else 0))
    drop = ImageChops.lighter(paper, mag)
    alpha = ImageChops.multiply(a, ImageChops.invert(drop))
    im.putalpha(alpha)
    return im

def grid_lines(im, n, axis):
    """The sheet's own dividing lines (long, dark), if it has n-1 of them on this axis; else equal cells."""
    W, H = im.size
    px = im.convert("L").load()
    size, other = (W, H) if axis == "x" else (H, W)
    dark = []
    for i in range(size):
        hits = sum(1 for j in range(0, other, 8) if (px[i, j] if axis == "x" else px[j, i]) < 70)
        if hits > 0.6 * other / 8:
            dark.append(i)
    groups = []
    for i in dark:
        if groups and i - groups[-1][-1] <= 3: groups[-1].append(i)
        else: groups.append([i])
    if len(groups) == n - 1:
        return [0] + [g for grp in groups for g in (grp[0], grp[-1])] + [size]   # cell k spans [b[2k], b[2k+1]]
    step = size / n
    out = [0]
    for k in range(1, n): out += [round(k * step), round(k * step)]
    return out + [size]

def cut_cell(cell, inset=14, pockets=True, thresh=70, pocket=45):
    """Flood the background in from the cell's edges (whatever its colour -- pink, magenta, white or a checkerboard) so
    the same colour inside the object (a pink potion) stays; then trim the soft fringe."""
    from PIL import ImageDraw, ImageFilter
    w, h = cell.size
    cell = cell.crop((inset, inset, w - inset, h - inset)).convert("RGB")
    w, h = cell.size
    corners = [cell.getpixel(xy) for xy in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3))]
    bgc = tuple(sorted(c[i] for c in corners)[1] for i in range(3))     # the sheet's background colour, from the corners
    SENT = (1, 254, 3)
    near = lambda c: sum((c[i] - bgc[i]) ** 2 for i in range(3)) < 60 ** 2
    # flood in from the edges -- but only from background there: an animal whose feet touch its cell's edge isn't filled
    for x in range(0, w, 6):
        for y in (0, h - 1):
            c = cell.getpixel((x, y))
            if c != SENT and near(c): ImageDraw.floodfill(cell, (x, y), SENT, thresh=thresh)
    for y in range(0, h, 6):
        for x in (0, w - 1):
            c = cell.getpixel((x, y))
            if c != SENT and near(c): ImageDraw.floodfill(cell, (x, y), SENT, thresh=thresh)
    mask = Image.new("L", (w, h), 0)
    cp, mp = cell.load(), mask.load()
    for y in range(h):
        for x in range(w):
            c = cp[x, y]
            # also pockets of background shut inside the object (a needle's eye, the loop of a fishing line): only pixels
            # very close to the sheet's own background colour, so a pink potion keeps its pink
            if c != SENT and (not pockets or sum((c[i] - bgc[i]) ** 2 for i in range(3)) > pocket ** 2): mp[x, y] = 255
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))   # eat the pink fringe, soften
    out = cell.convert("RGBA"); out.putalpha(mask)
    return out

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheet"); ap.add_argument("--grid", default="4x4"); ap.add_argument("--ids", required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--out", default=ICONS, help="where to write (default: the game's icon folder)")
    o = ap.parse_args()
    cols, rows = (int(x) for x in o.grid.lower().split("x"))
    ids = [x.strip() for x in o.ids.split(",")]
    if len(ids) > cols * rows:
        sys.exit("More ids (%d) than cells (%d)." % (len(ids), cols * rows))
    known = item_ids()
    bad = [i for i in ids if i != "-" and i not in known]
    if bad:
        sys.exit("Not NeuroPets item ids: " + ", ".join(bad))
    raw = Image.open(o.sheet).convert("RGB")
    xs, ys = grid_lines(raw, cols, "x"), grid_lines(raw, rows, "y")
    outdir = o.out
    os.makedirs(outdir, exist_ok=True)
    done = []
    for n, iid in enumerate(ids):
        if iid == "-":
            continue
        c, r = n % cols, n // cols
        cell = cut_cell(raw.crop((xs[2 * c], ys[2 * r], xs[2 * c + 1], ys[2 * r + 1])))
        bb = cell.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
        if not bb:
            print("  %-20s empty cell -- skipped" % iid); continue
        obj = cell.crop(bb)
        side = int(max(obj.size) * 1.08)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.paste(obj, ((side - obj.size[0]) // 2, (side - obj.size[1]) // 2))
        out = sq.resize((SIZE, SIZE), Image.LANCZOS)
        if not o.dry_run:
            out.save(os.path.join(outdir, iid + ".webp"), quality=90, method=6)
        done.append(iid)
        print("  %-20s %s" % (iid, "would write" if o.dry_run else "written"))
    if o.dry_run:
        return
    have = sorted(f[:-5] for f in os.listdir(outdir) if f.endswith(".webp"))
    with open(os.path.join(outdir, "manifest.js"), "w") as f:
        f.write("/* Painted item icons (2026-10-10 audit, H-6): every id listed here has art/icons/<id>.webp, and the game shows it instead of\n"
                "   the pixel icon. Written by tools/cut_icon_sheet.py -- don't edit by hand. */\n")
        f.write("window.PET_ICONS = " + json.dumps({k: 1 for k in have}) + ";\n")
    print("%d icons written; %d painted icons in all. Restart NeuroPets to see them." % (len(done), len(have)))

if __name__ == "__main__":
    main()
