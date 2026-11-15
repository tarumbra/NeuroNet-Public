#!/usr/bin/env python3
"""Cut Cam's NeuroCafe sheets into the game's pictures (2026-10-20, V19 -- the Stage 1 demo).

    python3 tools/cut_cafe_art.py            (every sheet in tools/cafe_sheets.txt)
    python3 tools/cut_cafe_art.py --dry-run  (say what would be written)

The sheets are painted on a flat dusky pink (each a little different, so each cell's own background is sampled from its
edges) with dark grid lines between the cells. Each cell: the background is flooded in from the edges (so pink inside a
picture -- raspberries -- stays), the grid lines and specks are dropped, the edge is softened, and the picture is trimmed
and saved as ui/cafe/art/<id>.webp, no larger than its size. ui/cafe/art/manifest.js says which there are, with each
picture's size (the game stands things on their bottom middle)."""
import argparse, json, os, sys
from collections import deque
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "ui", "cafe", "art")
SRC = os.path.expanduser("~/Pictures/NeuroCafe Art Assets/Icons")
PLAN = os.path.join(HERE, "cafe_sheets.txt")


def dist2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def cut_cell(cell, trim=True, band=None):
    """The picture in one cell, its background taken away (RGBA, trimmed), or None when the cell is empty. band: how
    deep the edge band taken as background is (default a thirtieth of the width); "band=<px>" in the plan makes it
    thinner for sheets whose things reach nearly to the grid lines (Sheet 22's wide cells: the band cut the legs off)."""
    cell = cell.convert("RGB")
    W, H = cell.size
    px = cell.load()
    # the background: the commonest colour along an inset of the edges (the grid lines are dark, the pink isn't)
    inset = band if band is not None else max(4, W // 30)
    ring = [px[x, inset] for x in range(inset, W - inset, 3)] + [px[x, H - 1 - inset] for x in range(inset, W - inset, 3)] \
        + [px[inset, y] for y in range(inset, H - inset, 3)] + [px[W - 1 - inset, y] for y in range(inset, H - inset, 3)]
    ring = [c for c in ring if sum(c) > 200]
    ring.sort(key=lambda c: sum(c))
    bg = ring[len(ring) // 2]
    near, far = 38 ** 2, 95 ** 2
    is_bg = [[dist2(px[x, y], bg) < near for x in range(W)] for y in range(H)]
    # flood the background in from every edge
    seen = [[False] * W for _ in range(H)]
    q = deque()
    for y in range(H):
        for x in range(W):
            if x <= inset or y <= inset or x >= W - 1 - inset or y >= H - 1 - inset:
                q.append((x, y))
    outside = [[False] * W for _ in range(H)]
    while q:
        x, y = q.popleft()
        if seen[y][x]:
            continue
        seen[y][x] = True
        # a band along the edges is outside even where it's grid line; inside it we only walk on background
        if not is_bg[y][x] and inset < x < W - 1 - inset and inset < y < H - 1 - inset:
            continue
        outside[y][x] = True
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx]:
                q.append((nx, ny))
    # what's left: pieces. Drop the grid lines (touching an edge and thin) and specks.
    comp = [[0] * W for _ in range(H)]
    pieces = []
    n = 0
    for y in range(H):
        for x in range(W):
            if outside[y][x] or comp[y][x]:
                continue
            n += 1
            comp[y][x] = n
            q = deque([(x, y)])
            area, x0, y0, x1, y1 = 0, x, y, x, y
            while q:
                cx, cy = q.popleft()
                area += 1
                x0, y0, x1, y1 = min(x0, cx), min(y0, cy), max(x1, cx), max(y1, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not outside[ny][nx] and not comp[ny][nx]:
                        comp[ny][nx] = n
                        q.append((nx, ny))
            pieces.append((n, area, x0, y0, x1, y1))
    keep = set()
    for (i, area, x0, y0, x1, y1) in pieces:
        edge = x0 <= inset or y0 <= inset or x1 >= W - 1 - inset or y1 >= H - 1 - inset
        thin = (x1 - x0) < W * 0.05 or (y1 - y0) < H * 0.05
        if area < W * H * 0.0015 or (edge and thin):
            continue
        keep.add(i)
    if not keep:
        return None
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    op = out.load()
    for y in range(H):
        for x in range(W):
            if comp[y][x] in keep:
                c = px[x, y]
                a = 255
                # soften the rim: a pixel beside the background fades by how pink it still is
                if any(0 <= nx < W and 0 <= ny < H and outside[ny][nx] for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                    d = dist2(c, bg)
                    a = 255 if d >= far else int(255 * max(0.0, (d ** 0.5 - 38) / (95 - 38)))
                op[x, y] = (c[0], c[1], c[2], a)
    box = out.getbbox()
    if not box:
        return None
    return out.crop(box) if trim else out


# walking frames (2026-10-21, PT45: "they move side to side"): every frame of a sheet is cut by the same box in its cell,
# so the body stays where it was painted and only the legs move -- trimming each to its own edges shifted it with the stride
FRAME_BOX = (0.12, 0.08, 0.88, 0.95)


def _wood(p):
    r, g, b = p
    return r > 95 and r > g * 1.45 and r > b * 1.6 and b < 110


def _door_mask(cell):
    """The door in a door cell: its biggest patch of door-brown, filled down each column (the panes), with its outline."""
    from PIL import ImageFilter
    px = cell.load()
    W, H = cell.size
    seen, best = set(), []
    for y in range(0, H):
        for x in range(0, W):
            if (x, y) in seen or not _wood(px[x, y]):
                continue
            q, pts = deque([(x, y)]), []
            seen.add((x, y))
            while q:
                a, b = q.popleft()
                pts.append((a, b))
                for nx, ny in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and _wood(px[nx, ny]):
                        seen.add((nx, ny))
                        q.append((nx, ny))
            if len(pts) > len(best):
                best = pts
    cols = {}
    for a, b in best:
        lo, hi = cols.get(a, (b, b))
        cols[a] = (min(lo, b), max(hi, b))
    mask = Image.new("L", (W, H), 0)
    mp = mask.load()
    for a, (lo, hi) in cols.items():
        for b in range(lo, hi + 1):
            mp[a, b] = 255
    return mask.filter(ImageFilter.MaxFilter(9))


def _fit(points):
    """A least-squares line y = a + b x through (x, y) points, dropping the worst tenth (stray specks) once."""
    def ls(pts):
        n = len(pts); sx = sum(p[0] for p in pts); sy = sum(p[1] for p in pts)
        sxx = sum(p[0] * p[0] for p in pts); sxy = sum(p[0] * p[1] for p in pts)
        bb = (n * sxy - sx * sy) / max(1e-9, n * sxx - sx * sx)
        return (sy - bb * sx) / n, bb
    a0, b0 = ls(points)
    keep = sorted(points, key=lambda p: abs(p[1] - (a0 + b0 * p[0])))[: max(2, int(len(points) * 0.9))]
    return ls(keep)


def _straighten(pic, bl, br, captop):
    """Stretch each column so the painted top and bottom edges land on the template's lines (bl-br the bottom,
    captop the cap's top-left and top-right points). Columns are resampled; nothing moves sideways."""
    W, H = pic.size
    al = pic.split()[3].load()
    tops, bots = [], []
    for x in range(int(W * 0.1), int(W * 0.9)):
        ys = [y for y in range(H) if al[x, y] > 128]
        if ys:
            tops.append((x, ys[0]))
            bots.append((x, ys[-1]))
    ta, tb = _fit(tops)
    ba, bb = _fit(bots)
    (cx0, cy0), (cx1, cy1) = captop
    tgt_t = lambda x: cy0 + (cy1 - cy0) * (x - cx0) / (cx1 - cx0)
    tgt_b = lambda x: bl[1] + (br[1] - bl[1]) * x / (br[0] - bl[0])
    src = pic.load()
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    op = out.load()
    for x in range(W):
        mt, mb, tt, tbm = ta + tb * x, ba + bb * x, tgt_t(x), tgt_b(x)
        k = (mb - mt) / max(1.0, tbm - tt)
        for y in range(H):
            sy = mt + (y - tt) * k
            if 0 <= sy < H - 1:
                y0i = int(sy); f = sy - y0i
                c0, c1 = src[x, y0i], src[x, y0i + 1]
                op[x, y] = tuple(round(c0[i] * (1 - f) + c1[i] * f) for i in range(4))
    return out


def cut_walls(sheet, ids):
    """Sheet 04 (V20): the wall panels and door panels, cut by the template's own shape (tools/make_cafe_templates.py)
    instead of trimmed -- every panel comes out the same size with its corners in known places, so they join. Gemini's
    end strips and cap ends fall outside the face and are cut off (the panels butt together). The doors: Gemini painted
    the door panels bigger than the walls, so a door panel is the plain wall panel with just the door set into it.
    Returns {id: (picture, meta)}; meta's yl/yr are where the face's bottom-left and bottom-right corners sit (0-1 down)."""
    import make_cafe_templates as T
    from PIL import ImageDraw, ImageFilter
    sc = sheet.width / (2 * T.CELL)
    cells = [sheet.crop((round(x * T.CELL * sc), round(y * T.CELL * sc), round((x + 1) * T.CELL * sc), round((y + 1) * T.CELL * sc))).convert("RGB")
             .resize((T.CELL, T.CELL), Image.LANCZOS) for y in (0, 1) for x in (0, 1)]
    out = {}
    for k, pid in enumerate(ids):
        side = "l" if k % 2 == 0 else "r"
        b0, b1, t1, t0, cap, H = T.wall_points(T.CELL // 2, T.CELL // 2, side)
        img = cells[k % 2].copy()                      # the plain panel ...
        if k >= 2:                                     # ... with the door set into it
            door = cells[k]
            img.paste(door, (0, 0), _door_mask(door))
        bg = cells[k % 2].getpixel((8, 8))
        shape = Image.new("L", img.size, 0)
        dr = ImageDraw.Draw(shape)
        dr.polygon([b0, b1, t1, t0], fill=255)
        dr.polygon(cap, fill=255)
        band = shape.filter(ImageFilter.MaxFilter(13))
        px, sp, bp = img.load(), shape.load(), band.load()
        pic = Image.new("RGBA", img.size, (0, 0, 0, 0))
        pp = pic.load()
        for y in range(img.height):
            for x in range(img.width):
                if sp[x, y] or (bp[x, y] and dist2(px[x, y], bg) > 70 ** 2):
                    pp[x, y] = px[x, y] + (255,)
        y0 = min(p[1] for p in cap) - 24                # room for the cap's top corner (it rises past the cap's points)
        y1 = max(b0[1], b1[1]) + 8
        pic = pic.crop((b0[0], y0, b1[0], y1))     # flat ends: exactly the face's width
        # straight lines (PT42: "walls again dont marry up perfectly"): Gemini's cap and bottom don't run exactly at the
        # floor's slope, so the caps step at each join. Fit the lines the painted top and bottom really follow and stretch
        # each column so both land on the template's lines -- then every panel's ends meet its neighbours'.
        pic = _straighten(pic, (0, b0[1] - y0), (pic.width, b1[1] - y0),
                          [(x - b0[0], y - y0) for x, y in (cap[3], cap[2])])
        # no seam where two panels meet: the few columns at each end (Gemini's outline) take the colours a little way
        # in, followed along the wall's slope (half a pixel down a pixel along, one way or the other)
        E, pw = 22, pic.width                          # (22: the template's cap stops 18px short of one end -- carry it on)
        slope = -0.5 if side == "l" else 0.5            # how the face's bottom moves going right
        sp2 = pic.load()
        src = pic.copy().load()
        for x in list(range(E)) + list(range(pw - E, pw)):
            fx = E if x < E else pw - 1 - E
            for y in range(pic.height):
                yy = round(y + slope * (fx - x))
                sp2[x, y] = src[fx, yy] if 0 <= yy < pic.height else (0, 0, 0, 0)
        out[pid] = (pic, {"yl": round((b0[1] - y0) / (y1 - y0), 4), "yr": round((b1[1] - y0) / (y1 - y0), 4)})
    return out


def fill_gridlines(cell):
    """2026-10-25 (Sheet 41: the round table and the pouf painted over their cells' grid line): rows that are mostly the
    sheet's dark grid line are walked in from each end, turning line pixels into the background until they meet the
    thing -- the bit of line under the thing is left (it's covered)."""
    c = cell.convert("RGB")
    w, h = c.size
    px = c.load()
    bg = cell_bg(c)
    dark = lambda p: (p[0] + p[1] + p[2]) / 3 < 95
    # the line's rows: dark at BOTH ends of the row (it runs right across; the thing never reaches both edges)
    edge = lambda y: all(dark(px[x, y]) for x in (2, 6, 10)) and all(dark(px[x, y]) for x in (w - 3, w - 7, w - 11))
    rows = [y for y in range(h) if edge(y)]
    # (Cam, 25 Oct: "this table has 2 notches cut out of the top") the thing's own outline is as dark as the line, so the
    # walk went through it: it stops where the thing starts -- the pixel just above or below the line's band not the
    # background (the band: the run of line rows this one is in)
    bands, b = [], []
    for y in rows:
        if b and y != b[-1] + 1:
            bands.append(b); b = []
        b.append(y)
    if b:
        bands.append(b)
    bgish = lambda p: dist2(p, bg) < 60 ** 2
    for b in bands:
        # the band and a row either side (the line's soft edges); the thing's edge across it runs straight from where it
        # is in the row above to where it is in the row below -- everything outside that, in these rows, is background
        y0, y1 = max(0, b[0] - 2), min(h - 1, b[-1] + 2)
        up, down = max(0, y0 - 1), min(h - 1, y1 + 1)
        for xs in (list(range(w)), list(range(w - 1, -1, -1))):
            ea = next((i for i, x in enumerate(xs) if not bgish(px[x, up])), None)
            eb = next((i for i, x in enumerate(xs) if not bgish(px[x, down])), None)
            if ea is None and eb is None:
                for y in range(y0, y1 + 1):
                    for x in xs:
                        px[x, y] = bg
                continue
            ea, eb = (eb if ea is None else ea), (ea if eb is None else eb)
            for y in range(y0, y1 + 1):
                stop = round(ea + (eb - ea) * (y - up) / max(1, down - up))
                for x in xs[:stop]:
                    px[x, y] = bg
    return c


def unglow(pic):
    """A glow Gemini painted round a light (pink, the sheet's colour lightened): pinkish pixels that aren't the dark
    outline go, then only the biggest piece is kept (the flame is orange, the bulb white -- both stay)."""
    pic = pic.convert("RGBA")
    px = pic.load()
    for y in range(pic.height):
        for x in range(pic.width):
            r, g, b, a = px[x, y]
            if a and r - g > 55 and b - g > -15 and (r + g + b) / 3 > 100:   # (salmon-pink glow: blue as high as green -- brass and flame
                                                                              #  have far less blue, cream and glass far less red)
                px[x, y] = (r, g, b, 0)
    return biggest_piece(pic)


def cell_bg(cell):
    """The cell's background: the commonest colour round its edge (2026-10-25: one pixel at the top's middle landed on a
    grid line, or a candle poking up from the cell below, and dark wood was cleared as \"background\")."""
    from collections import Counter
    c = cell.convert("RGB")
    w, h = c.size
    px = c.load()
    band = [px[x, y] for y in list(range(8, 20)) + list(range(h - 20, h - 8)) for x in range(8, w - 8, 3)] + \
           [px[x, y] for x in list(range(8, 20)) + list(range(w - 20, w - 8)) for y in range(8, h - 8, 3)]
    common = Counter((r // 8, g // 8, b // 8) for r, g, b in band).most_common(1)[0][0]
    near = [p for p in band if (p[0] // 8, p[1] // 8, p[2] // 8) == common]
    return tuple(sum(p[i] for p in near) // len(near) for i in range(3))


def pair_cells(sheet, n):
    """Sheets 10-11 (2026-10-21): 4x4 sheets of 512px cells made of the 2x2 templates at half size -- pair n (row by row,
    two cells each) as two cells at the templates' full 1024px, so the template-based cutting works on them unchanged."""
    import make_cafe_templates as T
    c = sheet.width / 4
    row, col = n // 2, (n % 2) * 2
    return [sheet.crop((round((col + i) * c), round(row * c), round((col + i + 1) * c), round((row + 1) * c))).convert("RGB")
            .resize((T.CELL, T.CELL), Image.LANCZOS) for i in (0, 1)]


def cut_chevrons(sheet, names, meta, auto=False):
    """N47 (Cam: the Halloween wallpapers "look a bit off ... I want them to work the same as the other wallpapers"):
    Gemini painted each as a room's corner -- a left wall and a right wall meeting in a V -- instead of Sheet 10's
    panels. So they're made into panels by logic: from the left half of each corner a clean patch of the paper is taken
    (the slope flattened out, the rail at the top and the edge at the bottom left off), made to repeat, and laid into
    the face of Sheet 10's stripes panel (its shape, its cap and its bottom line kept), the stripes panel's door set
    into the door panel the same way; the right wall's panels are the left's mirrored. Pairs as Sheet 10 (two cells each,
    row by row). Ids: wall-<name>-l/r, door-<name>-l/r; the same yl/yr as the stripes panels."""
    base, door = (Image.open(os.path.join(OUT, f"{k}-stripes-l.webp")).convert("RGBA") for k in ("wall", "door"))
    W, H = base.size
    ba, bp, dp = base.getchannel("A").load(), base.load(), door.load()
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    tops, caps = {}, []
    for x in range(W):                                 # the face starts below the cap: the cap is the same depth all along
        col = [y for y in range(H) if ba[x, y] > 200]
        if not col:
            continue
        tops[x] = (col[0], col[-1])
        pale = next((y for y in col if lum(bp[x, y]) > 205), None)
        if pale is not None:
            caps.append(pale - col[0])
    cap = sorted(caps)[len(caps) // 2] + 2
    c = sheet.width / 4
    out = {}
    for n, name in enumerate(names):
        if name == "-":
            continue
        row, col0 = n // 2, (n % 2) * 2
        cell = sheet.crop((round(col0 * c), round(row * c), round((col0 + 1) * c), round((row + 1) * c))).convert("RGB")
        cw, ch = cell.size
        bg = cell.getpixel((cw - 8, ch - 8))           # (the bottom right is below the wall: the sheet's pink)
        flat = cell.transform((cw, ch + cw // 2), Image.AFFINE, (1, 0, 0, -0.5, 1, 0), Image.BICUBIC, fillcolor=bg)
        fp = flat.load()
        x0, x1 = round(cw * 0.12), round(cw * 0.88)
        if auto:                                       # ("panels", Sheet 36: a small panel in the cell -- its own width, its edges left off)
            cols = [x for x in range(16, cw - 16) if sum(dist2(fp[x, y], bg) > 60 ** 2 for y in range(16, flat.height - 16, 4)) > flat.height // 16]   # (not the grid lines)
            if cols:
                w0 = cols[-1] - cols[0]
                x0, x1 = cols[0] + round(w0 * 0.16), cols[-1] - round(w0 * 0.16)
        good = [sum(dist2(fp[x, y], bg) > 60 ** 2 for x in range(x0, x1, 3)) >= 0.97 * len(range(x0, x1, 3)) for y in range(flat.height)]
        best, run = (0, 0), None
        for y, g in enumerate(good + [False]):
            if g and run is None:
                run = y
            elif not g and run is not None:
                best = max(best, (run, y), key=lambda r: r[1] - r[0])
                run = None
        r0, r1 = best
        r0, r1 = r0 + round((r1 - r0) * 0.2), r1 - round((r1 - r0) * 0.06)
        patch = seamless(flat.crop((x0, r0, x1, r1)))
        patch = patch.resize((W, round(patch.height * W / patch.width)), Image.LANCZOS)
        pp = patch.load()
        pic = base.copy()
        px = pic.load()
        for x, (t, b) in tops.items():
            for y in range(t + cap, b - 3):
                if ba[x, y] > 200:
                    px[x, y] = pp[x, (y - t - cap) % patch.height][:3] + (255,)
        dpic = pic.copy()
        dq = dpic.load()
        for y in range(H):                             # the door: where the stripes' door panel isn't its wall
            for x in range(W):
                if dist2(dp[x, y][:3], bp[x, y][:3]) > 45 ** 2 and dp[x, y][3] > 100:
                    dq[x, y] = dp[x, y]
        m = {"yl": meta["wall-stripes-l"]["yl"], "yr": meta["wall-stripes-l"]["yr"]}
        for k, im in (("wall", pic), ("door", dpic)):
            out[f"{k}-{name}-l"] = (im, dict(m))
            out[f"{k}-{name}-r"] = (im.transpose(Image.FLIP_LEFT_RIGHT), {"yl": m["yr"], "yr": m["yl"]})
    return out


def cut_wallpapers(sheet, names):
    """Sheet 10: each wallpaper's left and right panels, cut like Sheet 04's walls, and its door panels -- the wallpaper
    panel with Sheet 04's painted door set into it (by the door's own outline). Ids: wall-<name>-l/r, door-<name>-l/r."""
    import make_cafe_templates as T
    s4 = Image.open(os.path.join(SRC, "Building/Icon - Sheet 04 - Walls and Doors.jpeg"))
    sc4 = s4.width / (2 * T.CELL)
    doors = [s4.crop((round(x * T.CELL * sc4), round(T.CELL * sc4), round((x + 1) * T.CELL * sc4), round(2 * T.CELL * sc4))).convert("RGB")
             .resize((T.CELL, T.CELL), Image.LANCZOS) for x in (0, 1)]
    out = {}
    for n, name in enumerate(names):
        if name == "-":
            continue
        l, r = pair_cells(sheet, n)
        two = Image.new("RGB", (2 * T.CELL, 2 * T.CELL))
        for k, cell in enumerate([l, r] + doors):
            two.paste(cell, ((k % 2) * T.CELL, (k // 2) * T.CELL))
        out.update(cut_walls(two, [f"wall-{name}-l", f"wall-{name}-r", f"door-{name}-l", f"door-{name}-r"]))
    return out


def stretch_box(pic, tile_px, side, tiles=2):
    """A box twice as long from a one-tile counter (2026-10-21, the buffet counter's stand-in until it's painted): the far
    half is slid back along the box's length and the gap filled with the middle repeated -- the front face's middle
    column, and the top's middle line (each face cut in its own plane, so the top and the front stay joined). side 'l'
    runs up-left (its front is the left face); 'r' is made as the mirror of 'l'. The counters are drawn at half a tile
    (cafe.js CSCALE), so one tile more along the length is `tile_px` across in the picture."""
    if side == "r":
        return stretch_box(pic.transpose(Image.FLIP_LEFT_RIGHT), tile_px, "l", tiles).transpose(Image.FLIP_LEFT_RIGHT)
    import make_cafe_templates as T
    src = pic.convert("RGBA")
    w, h = src.size
    dx = round(tile_px * (tiles - 1))
    dy = dx // 2
    sp = src.load()
    out = Image.new("RGBA", (w + dx, h + dy), (0, 0, 0, 0))
    op = out.load()
    xc = w / 2                                         # the front corner: the picture's middle, at the bottom
    hf = T.FACE * tile_px                              # how tall the faces are (the template's)
    face_top = lambda x: h - hf - abs(xc - x) / 2      # where the faces meet the top
    xm = xc / 2                                        # the front face's middle column
    along = lambda x, y: -(x + 2 * y) / 2              # how far up-left a point on the top is
    am = along(xc, h - hf) + w / 4                     # the top's middle line
    for Y in range(h + dy):
        for X in range(w + dx):
            x, y = X - dx, Y - dy                      # in the near (front) piece's own frame
            if x > xc and y > face_top(x):             # the near end's face: as it is
                k = 0
            elif y > face_top(x):                      # the front face: by columns
                k = xm - x
            else:                                      # the top and what's on it: in its plane
                k = along(x, y) - am
            k = max(0, min(dx, k))
            sx, sy = round(x + k), round(y + k / 2)
            if 0 <= sx < w and 0 <= sy < h:
                op[X, Y] = sp[sx, sy]
    return out.crop(out.getbbox())


def erase_guides(cell):
    """Characters Sheet 02's template lines, painted over (2026-10-21): the solid line the feet stand on and the dashed
    line over the head go -- every pixel of them that isn't touching the person (a shoe on the line, hair at the dashes)."""
    cell = cell.convert("RGB")
    W, H = cell.size
    px = cell.load()
    bg = px[W // 2, max(2, H // 40)]
    dark = lambda c: sum(c) < 300
    pinkish = lambda c: dist2(c, bg) < 60 ** 2
    def wipe(y, look):                                 # look: which way the person is from this line (-9 up, +9 down)
        for yy in range(max(0, y - 8), min(H, y + 9)):
            for x in range(W):
                # anything that isn't plain background (cut_cell's own 38) goes, if the person isn't right there
                if dist2(px[x, yy], bg) >= 30 ** 2 and pinkish(px[x, min(H - 1, max(0, y + look))]):
                    px[x, yy] = bg
    for y in range(H // 2, H - 3):                     # the foot line: any line nearly all the way across (dark, or
        # Gemini's own light grey one -- PT49)
        if sum(1 for x in range(W) if dark(px[x, y]) or dist2(px[x, y], bg) > 90 ** 2) >= W * 0.45:
            wipe(y, -10)
    for y in range(2, H // 3):                         # the head line: dashes, dark about half the way across
        if sum(1 for x in range(W) if dark(px[x, y])) >= W * 0.25:
            wipe(y, 10)
    return cell


def seamless(pic):
    """A texture that repeats without a seam: blended with itself shifted half way, the shifted copy showing at the
    edges (where the two would meet) and the picture itself in the middle."""
    w, h = pic.size
    shifted = Image.new(pic.mode, (w, h))
    shifted.paste(pic, (-w // 2, -h // 2)); shifted.paste(pic, (w - w // 2, -h // 2))
    shifted.paste(pic, (-w // 2, h - h // 2)); shifted.paste(pic, (w - w // 2, h - h // 2))
    mask = Image.new("L", (w, h))
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            e = min(x, w - 1 - x, y, h - 1 - y) / (min(w, h) * 0.22)
            mp[x, y] = int(255 * min(1.0, e))
    return Image.composite(pic, shifted, mask)


def stool_to_bg(cell):
    """Characters Sheet 07 (N44): the stool under each sitter came back painted light pink, (225, 152, 187) or so, and
    its soft edges blend into the pink background. Anything pinkish -- more blue than green, much more red than green,
    and bright -- becomes the background's own pink, so the flood takes it away and only the person is left. Skin is
    safe: it has more green than blue."""
    im = cell.convert("RGB")
    bg = im.getpixel((im.width // 2, 6))
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            if r > 175 and b - g > 22 and r - g > 45:
                px[x, y] = bg
    return im


def unline(sheet):
    """2026-10-24 (Sheet 16, the blue sofa set): Gemini painted big things across the sheet's grid lines. Each line goes
    wherever it runs over plain pink (pink on both sides of it), so a thing can then be cut from any box."""
    sheet = sheet.convert("RGB")
    W, H = sheet.size
    px = sheet.load()
    bg = px[W // 8, 30]
    pinkish = lambda c: dist2(c, bg) < 60 ** 2
    dark = lambda c: sum(c) < 260
    cols = [x for x in range(20, W - 20) if sum(dark(px[x, y]) for y in range(5, 60)) > 45]
    rows = [y for y in range(20, H - 20) if sum(dark(px[x, y]) for x in range(5, 60)) > 45]
    for x0 in cols:
        for x in range(x0 - 3, x0 + 4):
            for y in range(H):
                if pinkish(px[x0 - 14, y]) and pinkish(px[x0 + 14, y]):
                    px[x, y] = bg
    for y0 in rows:
        for y in range(y0 - 3, y0 + 4):
            for x in range(W):
                if pinkish(px[x, y0 - 14]) and pinkish(px[x, y0 + 14]):
                    px[x, y] = bg
    return sheet


def clear_holes(pic, bg, glow=False):
    """Street things (Sheet 07): the pink shows through holes (a bike's wheels, between a fence's pickets), and a lamp's
    glow is painted onto the pink. Background inside a picture goes too, and pink-tinged pixels are faded out, the
    lighter ones (glow) turned warm. Not for food sheets -- raspberries are pink."""
    pic = pic.convert("RGBA")
    px = pic.load()
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    for y in range(pic.height):
        for x in range(pic.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            d = dist2((r, g, b), bg) ** 0.5
            # pink-tinged: red and blue both well over green, like the background
            # (a lamp's glow is salmon -- painted light over the pink -- so for a glow, blue near green counts too)
            tinge = r > g + 40 and (b > g + 25 or (glow and b > g - 15))
            if d < 40:
                px[x, y] = (r, g, b, 0)
            elif tinge and d < 120:
                k = (d - 40) / 80
                if lum((r, g, b)) > lum(bg):           # glow: warm light, see-through by how pink it was
                    px[x, y] = (255, 226, 160, int(a * k * 0.8))
                else:
                    px[x, y] = (r, g, b, int(a * k))
    return pic


def window_glass(pic, panel=False, glass=True):
    """Sheets 17-18 (N48): windows and curtains painted into Sheet 14's slanted frames on a faint wall panel. The
    template's pink left inside a curtain's or blind's frame becomes pale sky glass, its shading kept; with panel (the
    windows) the faint lilac panel round the window goes -- the café's own wall shows there -- and so do the thin bits of
    its outline left standing on their own."""
    pic = pic.convert("RGBA")
    px, W, H = pic.load(), pic.width, pic.height
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if not a:
                continue
            if glass and r >= 230 and 172 <= g <= 220 and b >= g + 8:          # the frame's pink: glass (fabric pinks are darker)
                k = g - 192
                px[x, y] = (min(255, 196 + k), min(255, 224 + k), min(255, 240 + k // 2), a)
            elif panel and dist2((r, g, b), (212, 157, 189)) < 50 * 50:
                px[x, y] = (0, 0, 0, 0)
    if not panel:
        return pic
    # the panel's outline, now standing alone: a thin line with nothing either side of it (across or up and down)
    al = pic.getchannel("A").load()
    solid = lambda x, y: 0 <= x < W and 0 <= y < H and al[x, y] >= 40
    band = lambda x, y, dx, dy: sum(solid(x + dx * d, y + dy * d) for d in range(-14, 15))   # (two lines side by side count too)
    thin = [(x, y) for y in range(H) for x in range(W) if al[x, y] >= 12 and (band(x, y, 1, 0) < 10 or band(x, y, 0, 1) < 10)]
    for q in thin:
        px[q] = (0, 0, 0, 0)
    return biggest_piece(pic, crop=False)


def wall_slant(pic, depth=0.05):
    """N48 (Cam: windows, clocks and wall things "not in line with the wall", "not 3D off the wall"): Gemini paints each
    wall thing at its own slant, so it's put right by logic. How slanted it is now is measured from its shape (how far
    its outline climbs per step across: cov(x, y) / var(x) -- a front-on clock or window measures 0), then it's sheared,
    its sides kept upright, to exactly the left wall's slope (rising 1 in 2 to the right). Then it's given depth: darker
    copies stepped back towards the wall (up-left, the way the wall lies from its face) so it stands off the wall with
    a visible edge. The right wall's picture is this one mirrored."""
    from PIL import ImageEnhance
    pic = pic.convert("RGBA")
    small = pic.copy()
    small.thumbnail((160, 160))
    a, sw, sh = small.getchannel("A").load(), small.width, small.height
    pts = [(x, y, a[x, y]) for y in range(sh) for x in range(sw) if a[x, y] > 60]
    n = sum(w for *_, w in pts) or 1
    mx, my = sum(x * w for x, _, w in pts) / n, sum(y * w for _, y, w in pts) / n
    vx = sum((x - mx) ** 2 * w for x, _, w in pts) / n or 1
    k = sum((x - mx) * (y - my) * w for x, y, w in pts) / n / vx       # its slope now (picture y runs down)
    s = -0.5 - k                                                        # the shear that makes it -0.5
    W, H = pic.size
    rise = abs(s) * W
    y0 = rise if s < 0 else 0
    # output (x, y) shows input (x, y - y0 - s*x)
    sheared = pic.transform((W, round(H + rise)), Image.AFFINE, (1, 0, 0, -s, 1, -y0), Image.BICUBIC)
    sheared = sheared.crop(sheared.getbbox())
    d = max(2, round(sheared.width * depth))
    back = ImageEnhance.Brightness(sheared).enhance(0.45)
    out = Image.new("RGBA", (sheared.width + d, sheared.height + (d + 1) // 2), (0, 0, 0, 0))
    for t in range(d):                                                  # the edge, from the wall out
        out.alpha_composite(back, (t, t // 2))
    out.alpha_composite(sheared, (d, d // 2))
    return out


def _foot_hull(pic):
    """The lower convex hull of where a picture stands (its lowest opaque pixel in each column), left to right."""
    a = pic.getchannel("A").point(lambda v: 255 if v > 110 else 0).load()
    W, H = pic.size
    pts = []
    for x in range(W):
        for y in range(H - 1, -1, -1):
            if a[x, y]:
                pts.append((x, y))
                break
    hull = []
    for p in pts:                                   # (y runs down: the lower hull keeps the turns that bulge downwards)
        while len(hull) >= 2 and (hull[-1][0] - hull[-2][0]) * (p[1] - hull[-2][1]) - (hull[-1][1] - hull[-2][1]) * (p[0] - hull[-2][0]) <= 0:
            hull.pop()
        hull.append(p)
    return hull


def true_house(pic):
    """PT56 (Cam: the buildings by the pavement "is there a way to straighten them up"): a building's two walls stand on
    lines Gemini drew at 0.35-0.65, not the ground's 1 in 2, so a row of them along a pavement looked askew. Each wall's
    foot is fitted (the lowest pixel of each column, away from the eaves) and the picture sheared, uprights kept upright,
    so both run at exactly 0.5 -- the two corrections blended across the middle fifth, so the roof bends smoothly rather
    than kinks. The front corner stays the lowest point (where the game stands it); room is added above."""
    W, H = pic.size
    a = pic.getchannel("A").load()
    low = [max([y for y in range(H) if a[x, y] > 128] or [-1]) for x in range(W)]
    fx = max(range(W), key=lambda x: low[x])

    def slope(xs):
        n = len(xs)
        mx, my = sum(xs) / n, sum(low[x] for x in xs) / n
        return sum((x - mx) * (low[x] - my) for x in xs) / sum((x - mx) ** 2 for x in xs)
    cl = 0.5 - slope(range(int(fx * 0.3), int(fx * 0.9)))
    cr = -0.5 - slope(range(int(fx + (W - fx) * 0.1), int(fx + (W - fx) * 0.7)))
    band = W * 0.1
    rate = lambda x: cl if x < fx - band else cr if x > fx + band else cl + (cr - cl) * (x - (fx - band)) / (2 * band)
    drop = [0.0] * W                                 # how far each column moves down (negative: up), 0 at the front corner
    for x in range(fx + 1, W):
        drop[x] = drop[x - 1] + rate(x)
    for x in range(fx - 1, -1, -1):
        drop[x] = drop[x + 1] - rate(x)
    k = 4
    big = pic.resize((W * k, H * k), Image.LANCZOS)
    up = max(0, -min(drop)) * k
    pad = round(up) + k
    out = Image.new("RGBA", (W * k, H * k + pad), (0, 0, 0, 0))
    for X in range(W * k):
        dy = round(drop[min(W - 1, X // k)] * k) + pad
        out.paste(big.crop((X, 0, X + 1, H * k)), (X, dy))
    out = out.resize((W, (H * k + pad) // k), Image.LANCZOS)
    return out.crop(out.getbbox())


def true_run(pic, right, shear=None):
    """PT56 (Cam: dividers "line up end to end but now not height"): Gemini's front edges slope 0.45-0.75, not the
    floor's exact 1 in 2, so each piece ended higher or lower than the next began. Measured along its foot -- a line
    fitted to the lowest pixel of each column across the middle of the front side (left of the lowest point facing
    down-left (-l), right of it facing down-right), ignoring the ends (a cap or lip overhangs there) and the gaps between
    legs -- and sheared, uprights kept upright, to exactly 0.5. Returns (picture, shear): pass the shear back in for its
    swatch layer, so it moves the same."""
    pic = pic.convert("RGBA")
    if shear is None:
        a = pic.getchannel("A").point(lambda v: 255 if v > 110 else 0).load()
        W, H = pic.size
        bot = {}
        for x in range(W):
            for y in range(H - 1, -1, -1):
                if a[x, y]:
                    bot[x] = y
                    break
        xs = sorted(bot)
        lo = max(xs, key=lambda x: (bot[x], -x if right else x))           # the corner: the lowest point
        x0, x1 = (lo, xs[-1]) if right else (xs[0], lo)
        pts = [(x, bot[x]) for x in xs if x0 + (x1 - x0) * 0.15 <= x <= x0 + (x1 - x0) * 0.85]
        k = None
        for _ in range(4):                                                  # fit; drop what's above (between legs)
            if len(pts) < 8:
                break
            n = len(pts); mx = sum(p[0] for p in pts) / n; my = sum(p[1] for p in pts) / n
            vx = sum((p[0] - mx) ** 2 for p in pts) or 1
            k = sum((p[0] - mx) * (p[1] - my) for p in pts) / vx
            pts = [p for p in pts if p[1] - (my + k * (p[0] - mx)) >= -2]
        target = -0.5 if right else 0.5
        shear = target - k if k is not None and abs(target - k) < 0.2 else 0.0   # (a lone piece: left be)
    W, H = pic.size
    rise = abs(shear) * W
    y0 = rise if shear < 0 else 0
    out = pic.transform((W, round(H + rise)), Image.AFFINE, (1, 0, 0, -shear, 1, -y0), Image.BICUBIC)
    return out, shear


def true_sofa(pic, rising):
    """2026-10-24 (Cam: "fix the rotation of the couch so its straight"): Gemini painted the blue sofa set turned too
    far round -- its long side runs at about 1 in 5, not the floor's 1 in 2, while its arms already run near the other
    grid line (about 1 in 1.75). Uprights kept upright, the one transform that puts both on the grid: each column
    dropped by 0.24 of its x and the whole stretched 1.3 high (rising: the long side climbs to the right, -r and -bl)."""
    pic = pic.convert("RGBA")
    c, d = (-0.24 if rising else 0.24), 1.3
    W, H = pic.size
    ys = [c * x + d * y for x in (0, W) for y in (0, H)]
    y0 = min(ys)
    out = pic.transform((W, round(max(ys) - y0)), Image.AFFINE, (1, 0, 0, -c / d, 1 / d, y0 / d), Image.BICUBIC)
    return out.crop(out.getbbox())


def dehalo(pic):
    """2026-10-24 (Cam: "remove the magenta around the outside jack o lanterns"): the template's pink left as a fringe
    between a thing's dark outline and the see-through round it. Flooded in from the see-through edge, through pinkish
    pixels only -- the outline stops it, so pinks painted inside a thing stay. The picture keeps its size.
    (`python3 tools/cut_cafe_art.py --dehalo id ...` cleans pictures already cut, in place.)"""
    pic = pic.convert("RGBA")
    W, H = pic.size
    px = pic.load()
    pink = lambda c: c[3] > 0 and c[0] > 140 and c[0] > c[1] + 40 and c[2] > c[1] - 25 and c[2] > 55
    stack = [(x, y) for y in range(H) for x in range(W) if px[x, y][3] < 30]
    seen = set(stack)
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and pink(px[q]):
                seen.add(q)
                px[q] = (0, 0, 0, 0)
                stack.append(q)
    return pic


def unpink(pic):
    """2026-10-25 (Cam: "the ceiling lights still have magenta on them"): the sheet's magenta showing through glass and
    a glow -- the fringe flooded off first (dehalo), then what's left is made neutral: a faint pink glow goes, a pinkish
    pixel keeps its lightness but loses the magenta (clear glass stays clear, crystals white). Reds, oranges and brass
    have far less blue than green, so they're left alone."""
    pic = dehalo(pic)
    px = pic.load()
    for y in range(pic.height):
        for x in range(pic.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            m = min(r, b) - g                              # how far red and blue both stand above green: magenta
            if m <= 6 or r - g < 18:
                continue
            if a < 150 and m > 25:                         # a faint pink glow round it
                px[x, y] = (r, g, b, 0)
                continue
            k = min(1.0, m / 40)
            lum = (r + g + b) / 3
            n = (lum + 6, lum, lum - 6)                    # (a touch warm, like the room's light)
            px[x, y] = tuple(round(c + (t - c) * k) for c, t in zip((r, g, b), n)) + (a,)
    return pic


def silk(pic):
    """2026-10-25 (Cam: "there is magenta left on some of the webs"): cobweb strands are thin and half see-through, so the
    sheet's magenta shows in every one -- each pinkish pixel made neutral (its lightness kept, a touch cool like silk),
    and nothing taken away. Wood, flames and lamplight have less blue than green and are left alone.
    (`python3 tools/cut_cafe_art.py --silk id ...` cleans pictures already cut, in place.)"""
    pic = pic.convert("RGBA")
    px = pic.load()
    for y in range(pic.height):
        for x in range(pic.width):
            r, g, b, a = px[x, y]
            lum = (r + g + b) / 3
            if a and r - g > 10 and (min(r, b) - g > 4 or (b - g > -12 and lum > 150)):   # (pale salmon-pink too; wood is darker)
                px[x, y] = (round(lum - 4), round(lum), round(lum + 6), a)
    return pic


def steam(pic):
    """2026-10-27 (the Haunted Faves): steam painted over the pink comes out pink. Only pale, clearly magenta pixels (blue
    well above green) are made neutral, so red jam, pink brains and salmon keep their colour (silk() is too broad for food).
    (`python3 tools/cut_cafe_art.py --steam id ...` cleans pictures already cut, in place.)"""
    pic = pic.convert("RGBA")
    px = pic.load()
    for y in range(pic.height):
        for x in range(pic.width):
            r, g, b, a = px[x, y]
            lum = (r + g + b) / 3
            if a and lum > 140 and r - g > 10 and b - g > 15:
                px[x, y] = (round(lum), round(lum), round(lum + 4), a)
    return pic


def true_points(pic, right):
    """run_points, the far end put on the foot's line (the corner's height less half the way along): a cap or lip
    overhanging the end no longer lifts it."""
    r = run_points(pic)["run"]
    W, H = pic.size
    if right:
        r[5] = r[3] - 0.5 * (r[4] - r[2]) * W / H
    else:
        r[1] = r[3] - 0.5 * (r[2] - r[0]) * W / H
    return {"run": [round(v, 4) for v in r]}


def fence_points(pic, right):
    """A fence segment's run (PT56): its whole width is the one tile, post to post, on the line through its lowest point
    at the floor's slope -- no thickness (a middle post standing forward doesn't shorten it)."""
    r = run_points(pic)["run"]
    W, H = pic.size
    bx, by = r[2], r[3]
    y = lambda x: by + (-0.5 if right else 0.5) * (x - bx) * W / H
    lx, rx = r[0], r[4]
    run = [lx, y(lx), rx, y(rx), rx, y(rx)] if not right else [lx, y(lx), lx, y(lx), rx, y(rx)]
    return {"run": [round(v, 4) for v in run], "fence": 1}


def run_points(pic):
    """N48 (Cam: dividers "do not marry up"): where a divider's run is in its picture, so the game can size it to exactly
    a tile and stand it on the tile's middle line -- a row then joins end to end. Three corners at its foot, as 0-1 of
    the picture: L the left-most point, B the lowest, R the right-most (each the lowest pixel there). Facing down-left
    (-l), L to B is the front edge (one tile long) and B to R the thickness; facing down-right, B to R is the front edge."""
    a = pic.getchannel("A").point(lambda v: 255 if v > 110 else 0)
    W, H = pic.size
    box = a.getbbox()
    px = a.load()
    def low(x):
        return max(y for y in range(H) if px[x, y])
    lx, rx, by = box[0], box[2] - 1, box[3] - 1
    xs = [x for x in range(W) if px[x, by]]
    bx = sum(xs) / len(xs)
    f = lambda x, y: [round(x / W, 4), round(y / H, 4)]
    return {"run": f(lx, low(lx)) + f(bx, by) + f(rx, low(rx))}


def biggest_piece(pic, crop=True):
    """The largest joined-up part of a cut picture, the rest (strays Gemini painted in the cell) taken away."""
    a = pic.getchannel("A")
    W, H = pic.size
    ap = a.load()
    seen = bytearray(W * H)
    best = []
    for y in range(H):
        for x in range(W):
            if ap[x, y] < 60 or seen[y * W + x]:
                continue
            comp, q = [], deque([(x, y)])
            seen[y * W + x] = 1
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and ap[nx, ny] >= 60:
                        seen[ny * W + nx] = 1
                        q.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    keep = Image.new("L", (W, H), 0)
    kp = keep.load()
    for x, y in best:
        kp[x, y] = 255
    from PIL import ImageFilter
    keep = keep.filter(ImageFilter.MaxFilter(5))         # its soft edge too
    out = pic.copy()
    out.putalpha(Image.composite(a, Image.new("L", (W, H), 0), keep))
    return out.crop(out.getbbox()) if crop else out


def align_frame(pic):
    """A walking frame drawn on its own (N37: one Gemini drawing per frame, so each sits a little differently): put it on
    a canvas with the top of the head at the top and the middle of the upper body in the middle, so frames line up by
    the body -- the legs, whatever they do, don't move it."""
    a = pic.getchannel("A")
    W, H = pic.size
    upper = a.crop((0, 0, W, int(H * 0.5))).getbbox() or (0, 0, W, H)
    cx = (upper[0] + upper[2]) / 2
    half = round(H * 0.46)                             # room for a long stride either side
    out = Image.new("RGBA", (2 * half, H), (0, 0, 0, 0))
    out.paste(pic, (round(half - cx), 0), pic)
    return out


def read_plan():
    """tools/cafe_sheets.txt: `file | grid | size | ids` (ids left to right, top to bottom; - skips a cell)."""
    plan = []
    for line in open(PLAN, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        f, grid, size, ids = [p.strip() for p in line.split("|")]
        grid, *flags = grid.split()
        # "free": each id is cut from its own box on the sheet, id@x0:y0:x1:y1 in the sheet's pixels
        gx, gy = (0, 0) if grid in ("walls", "wallpapers", "chevrons") else (-1, -1) if grid == "counters" else (1, 1) if grid == "free" \
            else (int(v) for v in grid.split("x"))
        if grid == "free":
            flags.append("free")
        if grid in ("wallpapers", "chevrons"):
            flags.append(grid)
        plan.append((f, gx, gy, int(size), [i.strip() for i in ids.split(",")], flags))
    return plan


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", default="", help="cut only the sheets whose file name holds this")
    ap.add_argument("--dehalo", nargs="+", help="take the pink fringe off these pictures in ui/cafe/art, in place")
    ap.add_argument("--silk", nargs="+", help="make the magenta in these pictures' cobwebs neutral, in place")
    ap.add_argument("--steam", nargs="+", help="make the pink in these pictures' steam neutral, in place")
    args = ap.parse_args()
    if args.steam:
        for pid in args.steam:
            path = os.path.join(OUT, pid + ".webp")
            steam(Image.open(path)).save(path, "WEBP", quality=90, method=6)
            print(f"  {pid}.webp: steam made neutral")
        return
    if args.silk:
        for pid in args.silk:
            path = os.path.join(OUT, pid + ".webp")
            silk(Image.open(path)).save(path, "WEBP", quality=90, method=6)
            print(f"  {pid}.webp: cobwebs made neutral")
        return
    if args.dehalo:
        for pid in args.dehalo:
            path = os.path.join(OUT, pid + ".webp")
            dehalo(Image.open(path)).save(path, "WEBP", quality=90, method=6)
            print(f"  {pid}.webp: fringe taken off")
        return
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, "manifest.js")
    sizes, meta = {}, {}
    if os.path.isfile(man_path):
        try:
            text = open(man_path, encoding="utf-8").read()
            sizes = json.loads(text.split("window.CafeArtFiles = ", 1)[1].split(";\n", 1)[0])
            if "window.CafeArtMeta = " in text:
                meta = json.loads(text.split("window.CafeArtMeta = ", 1)[1].split(";\n", 1)[0])
        except (ValueError, IndexError):
            sizes, meta = {}, {}
    for f, gx, gy, size, ids, flags in read_plan():
        wallp = "wallpapers" in flags
        if args.only and args.only not in f:
            continue
        if not os.path.isfile(os.path.join(SRC, f)):
            print(f"  {f}: not painted yet, skipped")
            continue
        sheet = Image.open(os.path.join(SRC, f))
        if gx == -1:                                   # Sheet 11: counter styles, each with its buffet
            import make_cafe_templates as T
            for n, name in enumerate(ids):
                if name == "-":
                    continue
                for side, cell in zip("lr", pair_cells(sheet, n)):
                    pic = cut_cell(cell)
                    if pic is None:
                        continue
                    cid, bid = f"counter-{name}-{side}", f"buffet-{name}-{side}"
                    meta[cid] = {"tile": round(pic.width / T.W, 4), "top": round(T.W / 4 / pic.height, 4)}
                    tile_px = pic.width / meta[cid]["tile"]
                    long = stretch_box(pic, tile_px, side)
                    meta[bid] = {"tile": round(long.width / tile_px, 4)}
                    long.thumbnail((round(size * long.width / pic.width), round(size * long.height / pic.height)), Image.LANCZOS)
                    pic.thumbnail((size, size), Image.LANCZOS)
                    for pid, im in ((cid, pic), (bid, long)):
                        sizes[pid] = list(im.size)
                        if not args.dry_run:
                            im.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=90, method=6)
                    print(f"  {cid}.webp {pic.size} + {bid}")
            continue
        if not gx:                                     # the template-cut walls and doors (Sheet 04; Sheet 10's wallpapers)
            cut = cut_chevrons(sheet, ids, meta, auto="panels" in flags) if "chevrons" in flags else cut_wallpapers(sheet, ids) if wallp else cut_walls(sheet, ids)
            for pid, (pic, m) in cut.items():
                pic.thumbnail((size, size), Image.LANCZOS)
                sizes[pid], meta[pid] = list(pic.size), m
                if not args.dry_run:
                    pic.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=90, method=6)
                print(f"  {pid}.webp {pic.size} {m}")
            continue
        if "unline" in flags:
            sheet = unline(sheet)
        W, H = sheet.size
        cw, ch = W / gx, H / gy
        if "free" in flags:
            boxes = [(i.split("@")[0], tuple(int(v) for v in i.split("@")[1].split(":"))) for i in ids if i != "-"]
        else:
            if len(ids) != gx * gy:
                sys.exit(f"{f}: {len(ids)} ids for {gx * gy} cells")
            boxes = [(pid, (round(k % gx * cw), round(k // gx * ch), round((k % gx + 1) * cw), round((k // gx + 1) * ch)))
                     for k, pid in enumerate(ids) if pid != "-"]
        for pid, box in boxes:
            cell = sheet.crop(box)
            if "gridfill" in flags:                        # (a free box over a grid line: the line, where it's in the pink, made pink)
                cell = fill_gridlines(cell)
            if "guides" in flags or "lines" in flags:          # ("lines": only take the template's lines away)
                cell = erase_guides(cell)
            if "stoolpink" in flags:                           # N44: Gemini painted the template's stool in light pink
                cell = stool_to_bg(cell)
            pid, flip = (pid[:-5], True) if pid.endswith(":flip") else (pid, False)
            pid, pair = (pid[:-5], True) if pid.endswith(":pair") else (pid, False)
            pid, main = (pid[:-5], True) if pid.endswith(":main") else (pid, False)
            pid, sofa = (pid[:-5], True) if pid.endswith(":sofa") else (pid, False)
            band = next((int(fl[5:]) for fl in flags if fl.startswith("band=")), None)
            pic = cut_cell(cell, trim="guides" not in flags, band=band)
            if pic is not None and main:                   # only the biggest piece (PT49: a stray leaf in the coat stand's cell)
                pic = biggest_piece(pic)
            if pic is not None and "guides" in flags:
                W2, H2 = pic.size
                pic = pic.crop(tuple(round(f * (W2 if i % 2 == 0 else H2)) for i, f in enumerate(FRAME_BOX)))
                fb = pic.getbbox()
                if fb:                                     # where the person is in the frame: their feet, their height
                    meta[pid] = {"top": round(fb[1] / pic.height, 4), "foot": round(fb[3] / pic.height, 4)}
            if pic is None:
                print(f"  {pid}: nothing in the cell")
                continue
            if "window" in flags or "curtain" in flags or "panel" in flags:     # ("panel": only the faint panel goes -- N51's mounts)
                pic = window_glass(pic, panel="window" in flags or "panel" in flags, glass="panel" not in flags)
            if "holes" in flags:
                pic = clear_holes(pic, cell_bg(cell), glow=pid == "prop-lamp")
            if "unglow" in flags:                          # (N61: a pink glow painted round a light -- off before the slant's edge copies it)
                pic = unglow(pic)
            slant = next((float(fl[6:]) for fl in flags if fl.startswith("slant=")), None)
            if slant is not None:                          # a wall thing (N48): the left wall's slope, depth; -r mirrored
                pic = wall_slant(pic, slant)
            if "align" in flags:
                pic = align_frame(pic)
                fb = pic.getbbox()
                meta[pid] = {"top": round(fb[1] / pic.height, 4), "foot": round(fb[3] / pic.height, 4)}
            if "dehalo" in flags:                          # (a pink fringe left round it)
                pic = dehalo(pic)
            if "unpink" in flags:                          # (the magenta through glass and round a glow)
                pic = unpink(pic)
            if flip:                                       # painted facing the other way: mirrored to match
                pic = pic.transpose(Image.FLIP_LEFT_RIGHT)
            if sofa:                                       # turned too far round: put square on the grid
                pic = true_sofa(pic, pid.endswith(("-r", "-bl")))
            if "texture" in flags:                         # a flat square: its painted border trimmed, made to repeat
                k = round(pic.width * 0.025)
                pic = pic.crop((k, k, pic.width - k, pic.height - k)).convert("RGB")
                if "seamless" in flags or pid.startswith("tex-grass"):
                    pic = seamless(pic)
            if pid.startswith(("counter-", "till-")):     # one-tile counters (Sheet 05): how wide a floor tile is in it
                import make_cafe_templates as T
                meta[pid] = {"tile": round(pic.width * (T.CELL / cw) / T.W, 4), "top": round(T.W / 4 * (T.CELL / cw) / pic.height, 4)}
            if pid in ("counter-l", "counter-r"):          # and the two-tile buffet counter made from it
                tile_px = pic.width / meta[pid]["tile"]
                long = stretch_box(pic, tile_px, pid[-1])
                bid = "buffet-" + pid[-1]
                meta[bid] = {"tile": round(long.width / tile_px, 4)}
                long.thumbnail((round(size * long.width / pic.width), round(size * long.height / pic.height)), Image.LANCZOS)
                sizes[bid] = list(long.size)
                if not args.dry_run:
                    long.save(os.path.join(OUT, bid + ".webp"), "WEBP", quality=90, method=6)
                print(f"  {bid}.webp {long.size}")
            pic.thumbnail((size, size), Image.LANCZOS)
            # ":pair" -- one facing painted (id ends in l), the other made by mirroring it (x-l -> x-r, x-bl -> x-br)
            outs = [(pid, pic), (pid[:-1] + "r", pic.transpose(Image.FLIP_LEFT_RIGHT))] if pair else \
                [(pid, pic), (pid + "-r", pic.transpose(Image.FLIP_LEFT_RIGHT))] if slant is not None else [(pid, pic)]
            for pid, pic in outs:
                if "divider" in flags:
                    pic, _ = true_run(pic, pid.endswith("-r"))
                    meta[pid] = true_points(pic, pid.endswith("-r"))
                if "house" in flags:
                    pic = true_house(pic)
                sizes[pid] = list(pic.size)
                if args.dry_run:
                    print(f"  would write {pid}.webp {pic.size}")
                else:
                    pic.save(os.path.join(OUT, pid + ".webp"), "WEBP", quality=90, method=6)
                    print(f"  {pid}.webp {pic.size}")
    if not args.dry_run:
        with open(man_path, "w", encoding="utf-8") as fh:
            fh.write("// NeuroCafe's painted pictures (ui/cafe/art), written by tools/cut_cafe_art.py: id -> [width, height].\n"
                     "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n"
                     "// where a picture sits: walls' face corners (yl, yr: 0-1 down), counters' tile width and top (0-1).\n"
                     "window.CafeArtMeta = " + json.dumps(dict(sorted(meta.items())), separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main()
