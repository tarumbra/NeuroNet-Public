#!/usr/bin/env python3
"""NeuroCafe's paint-over templates (2026-10-20, V20 step 1).

Gemini paints walls that don't join and counters two tiles long when it's only told the shape in words. These are
the exact shapes as line drawings on the sheets' pink, at the floor's 2:1 angle, in a 2x2 grid of 1024px cells: it
colours them in instead of inventing them. Written to ~/Pictures/NeuroCafe Art Assets/Templates/.

    python3 tools/make_cafe_templates.py

2026-10-21: also Sheet 06 (street textures: flat squares), Sheet 07 (street things, each on its floor tile) and
Characters Sheet 02 (walking frames over the standing picture, with foot and head lines)."""
import os
from PIL import Image, ImageDraw

OUT = os.path.expanduser("~/Pictures/NeuroCafe Art Assets/Templates")
PINK, INK, FILL, FRONT, GRID = (195, 66, 131), (58, 29, 20), (222, 222, 222), (188, 188, 188), (60, 20, 30)
CELL, W = 1024, 560          # a cell, and one floor tile's width in it (its depth is W/2: the 2:1 grid)
LW = 7
FACE = 0.62                 # a counter's faces are this many tile widths tall


def sheet():
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    d = ImageDraw.Draw(im)
    d.line([(CELL, 0), (CELL, 2 * CELL)], fill=GRID, width=8)
    d.line([(0, CELL), (2 * CELL, CELL)], fill=GRID, width=8)
    return im, d


def poly(d, pts, fill):
    d.polygon(pts, fill=fill)
    d.line(pts + [pts[0]], fill=INK, width=LW, joint="curve")


def wall_points(cx, cy, side):
    """A wall panel's corners in a cell centred on (cx, cy): the face's bottom-left b0, bottom-right b1, top-right t1,
    top-left t0, and the cap on top. The NeuroCafe cutter (tools/cut_cafe_art.py) cuts painted panels by these."""
    H, T = int(W * 0.86), 18                          # the face's height; the wall's thickness
    hw, q = W // 2, W // 4
    if side == "l":
        b0, b1 = (cx - hw // 2, cy + q // 2 + H // 2), (cx + hw // 2, cy - q // 2 + H // 2)
        back = (-T, -T // 2)
    else:
        b0, b1 = (cx - hw // 2, cy - q // 2 + H // 2), (cx + hw // 2, cy + q // 2 + H // 2)
        back = (T, -T // 2)
    t0, t1 = (b0[0], b0[1] - H), (b1[0], b1[1] - H)
    cap = [t0, t1, (t1[0] + back[0], t1[1] + back[1]), (t0[0] + back[0], t0[1] + back[1])]
    return b0, b1, t1, t0, cap, H


def wall(d, cx, cy, side, door=False):
    """One wall panel on one tile edge: the face, flat cut ends, a thin cap on top. side 'l' rises to the right."""
    b0, b1, t1, t0, cap, H = wall_points(cx, cy, side)
    poly(d, [b0, b1, t1, t0], FILL)
    poly(d, cap, FRONT)
    if door:                                          # a door in the lower part, flat in the wall
        f0, f1, dh = 0.27, 0.73, 0.68
        p = lambda f, up: (b0[0] + (b1[0] - b0[0]) * f, b0[1] + (b1[1] - b0[1]) * f - up)
        poly(d, [p(f0, 0), p(f1, 0), p(f1, H * dh), p(f0, H * dh)], FRONT)


def cube(d, cx, cy, face, till=False):
    """A one-tile counter: its top is exactly one floor tile; the face with the front panels is darker."""
    hw, q, h = W // 2, W // 4, int(W * FACE)
    top = (cx, cy - q - h // 2)
    L, R, B = (cx - hw, top[1] + q), (cx + hw, top[1] + q), (cx, top[1] + 2 * q)
    poly(d, [top, R, B, L], FILL)
    lf = [L, B, (B[0], B[1] + h), (L[0], L[1] + h)]
    rf = [B, R, (R[0], R[1] + h), (B[0], B[1] + h)]
    poly(d, lf, FRONT if face == "l" else FILL)
    poly(d, rf, FRONT if face == "r" else FILL)
    if till:                                          # where the cash register sits: a small box on the top
        s = 0.42
        t2 = (cx, top[1] + q - int(q * s) - 120)
        l2, r2, b2 = (cx - int(hw * s), t2[1] + int(q * s)), (cx + int(hw * s), t2[1] + int(q * s)), (cx, t2[1] + 2 * int(q * s))
        poly(d, [t2, r2, b2, l2], FILL)
        poly(d, [l2, b2, (b2[0], b2[1] + 120), (l2[0], l2[1] + 120)], FRONT if face == "l" else FILL)
        poly(d, [b2, r2, (r2[0], r2[1] + 120), (b2[0], b2[1] + 120)], FRONT if face == "r" else FILL)


def textures():
    """Sheet 06 (2026-10-21): four flat, square, seen-from-straight-above textures for the street -- the game tips them
    onto the floor's angle itself, so Gemini only paints a flat square that repeats. Each cell: a square to fill."""
    im, d = sheet()
    for k in range(4):
        cx, cy = (k % 2) * CELL + CELL // 2, (k // 2) * CELL + CELL // 2
        d.rectangle([cx - 400, cy - 400, cx + 400, cy + 400], fill=FILL, outline=INK, width=LW)
    return im


def props():
    """Sheet 07 (2026-10-21): street things, 4x4 cells of 512, each with the floor tile it stands on drawn in (the same
    angle as the café floor), so whatever's painted stands at the right size and angle."""
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    d = ImageDraw.Draw(im)
    c = CELL // 2
    for i in range(1, 4):
        d.line([(i * c, 0), (i * c, 2 * CELL)], fill=GRID, width=6)
        d.line([(0, i * c), (2 * CELL, i * c)], fill=GRID, width=6)
    w = 300
    for k in range(16):
        cx, cy = (k % 4) * c + c // 2, (k // 4) * c + c - 70
        poly(d, [(cx, cy - w // 4), (cx + w // 2, cy), (cx, cy + w // 4), (cx - w // 2, cy)], FRONT)
    return im


def walk(guides):
    """Characters Sheet 02 (2026-10-21): walking frames. 4x4 cells of 512: two people, each two rows -- walking towards
    you (down-left) and away (up-right), four frames a row. Every cell has the person's standing picture faintly
    underneath, the line their feet stand on and the line their head reaches, so every frame is the same size."""
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    d = ImageDraw.Draw(im)
    c = CELL // 2
    foot, head = c - 40, 70
    for row, g in enumerate(guides):
        if g is None:
            continue
        pic = g.copy()
        pic.thumbnail((c, foot - head), Image.LANCZOS)
        a = pic.getchannel("A").point(lambda v: v * 0.3)
        for col in range(4):
            x0, y0 = col * c, row * c
            im.paste(Image.new("RGB", pic.size, (255, 255, 255)), (x0 + (c - pic.width) // 2, y0 + foot - pic.height), a)
    d = ImageDraw.Draw(im)
    for i in range(1, 4):
        d.line([(i * c, 0), (i * c, 2 * CELL)], fill=GRID, width=6)
        d.line([(0, i * c), (2 * CELL, i * c)], fill=GRID, width=6)
    for row in range(4):
        for col in range(4):
            x0, y0 = col * c, row * c
            d.line([(x0 + 30, y0 + foot), (x0 + c - 30, y0 + foot)], fill=INK, width=4)
            for x in range(x0 + 30, x0 + c - 30, 24):
                d.line([(x, y0 + head), (x + 10, y0 + head)], fill=INK, width=3)
    return im


def facings(pairs, grid, back=False):
    """Sheets 08-09 (2026-10-21, Cam: "rotate them the way I want"): street things in pairs, the left cell's front facing
    down-left, the right cell's down-right (an arrow on the floor diamond shows which), so every turn has its picture."""
    n = grid
    c = 2 * CELL // n
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    d = ImageDraw.Draw(im)
    for i in range(1, n):
        d.line([(i * c, 0), (i * c, 2 * CELL)], fill=GRID, width=6)
        d.line([(0, i * c), (2 * CELL, i * c)], fill=GRID, width=6)
    w = int(c * 0.58)
    for k in range(n * n):
        if k // 2 >= len(pairs):
            continue
        cx, cy = (k % n) * c + c // 2, (k // n) * c + c - int(c * 0.14)
        poly(d, [(cx, cy - w // 4), (cx + w // 2, cy), (cx, cy + w // 4), (cx - w // 2, cy)], FRONT)
        sx = -1 if k % 2 == 0 else 1                  # the arrow: from the middle to the front edge's middle
        tip = (cx + sx * w // 4, cy + (-w // 8 if back else w // 8))   # (back: towards the far edges -- up-left, up-right)
        d.line([(cx, cy), tip], fill=(40, 90, 200), width=8)
        a1 = (tip[0] - sx * 22, tip[1] + (2 if back else -2)); a2 = (tip[0] - sx * 6, tip[1] + (22 if back else -22))
        d.polygon([tip, a1, a2], fill=(40, 90, 200))
    return im


def facings4(names):
    """N47 (Halloween machines; Sheet 15 came back like this unasked, and it worked): one machine a ROW, four cells -- its
    front facing down-left, its front facing down-right, its back facing us with the front away up-right, the same away
    up-left -- an arrow on each floor diamond showing which way the FRONT faces."""
    c = 2 * CELL // 4
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    d = ImageDraw.Draw(im)
    for i in range(1, 4):
        d.line([(i * c, 0), (i * c, 2 * CELL)], fill=GRID, width=6)
        d.line([(0, i * c), (2 * CELL, i * c)], fill=GRID, width=6)
    w = int(c * 0.58)
    for r in range(len(names)):
        for k in range(4):
            cx, cy = k * c + c // 2, r * c + c - int(c * 0.14)
            poly(d, [(cx, cy - w // 4), (cx + w // 2, cy), (cx, cy + w // 4), (cx - w // 2, cy)], FRONT)
            sx, back = [(-1, False), (1, False), (1, True), (-1, True)][k]
            tip = (cx + sx * w // 4, cy + (-w // 8 if back else w // 8))
            d.line([(cx, cy), tip], fill=(40, 90, 200), width=8)
            a1 = (tip[0] - sx * 22, tip[1] + (2 if back else -2)); a2 = (tip[0] - sx * 6, tip[1] + (22 if back else -22))
            d.polygon([tip, a1, a2], fill=(40, 90, 200))
    return im


def twotile(names):
    """N48 (V23 q9: pool table, table tennis, air hockey): things two floor tiles long, one a ROW -- in the left half of
    the row lying along one way (down-right), in the right half the other way (down-left); two grey diamonds side by side
    show the floor it covers. Painted from the front side both times (seen from above at the game's angle)."""
    c = CELL                                            # 2 x 4 cells of 1024 x 512
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    d = ImageDraw.Draw(im)
    rh = 2 * CELL // 4
    for i in range(1, 4):
        d.line([(0, i * rh), (2 * CELL, i * rh)], fill=GRID, width=6)
    d.line([(c, 0), (c, 2 * CELL)], fill=GRID, width=6)
    w = int(rh * 0.62)
    for r in range(len(names)):
        for k in range(2):
            cx, cy = k * c + c // 2, r * rh + rh - int(rh * 0.2)
            sx = 1 if k == 0 else -1                     # along x (down-right) or along y (down-left)
            for j in (-0.5, 0.5):
                ox, oy = sx * j * w / 2, j * w / 4
                poly(d, [(cx + ox, cy + oy - w // 4), (cx + ox + w // 2, cy + oy), (cx + ox, cy + oy + w // 4), (cx + ox - w // 2, cy + oy)], FRONT)
    return im


def arrow(d, cx, cy, sx, back, w):
    tip = (cx + sx * w // 4, cy + (-w // 8 if back else w // 8))
    d.line([(cx, cy), tip], fill=(40, 90, 200), width=8)
    a1 = (tip[0] - sx * 22, tip[1] + (2 if back else -2)); a2 = (tip[0] - sx * 6, tip[1] + (22 if back else -22))
    d.polygon([tip, a1, a2], fill=(40, 90, 200))


def one_way(backs=False):
    """2026-10-24 (Cam: Gemini keeps getting the facings wrong): 16 DIFFERENT things all painted ONE way -- every arrow
    points down-left -- and the cutter's ":pair" mirrors each for the other facing. backs=True: two a row each, the left
    cell its front (down-left), the right its back (front away up-left), so :pair gives all four turns of 8 things."""
    c = 2 * CELL // 4
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    d = ImageDraw.Draw(im)
    for i in range(1, 4):
        d.line([(i * c, 0), (i * c, 2 * CELL)], fill=GRID, width=6)
        d.line([(0, i * c), (2 * CELL, i * c)], fill=GRID, width=6)
    w = int(c * 0.58)
    for k in range(16):
        cx, cy = (k % 4) * c + c // 2, (k // 4) * c + c - int(c * 0.14)
        poly(d, [(cx, cy - w // 4), (cx + w // 2, cy), (cx, cy + w // 4), (cx - w // 2, cy)], FRONT)
        arrow(d, cx, cy, -1, backs and k % 2 == 1, w)
    return im


def furniture4():
    """2026-10-24 (Cam: a table, a double sofa and a lamp that face all directions): rows 1-2 are one-tile things four
    ways like facings4 (front down-left, down-right, then backs: front away up-right, up-left); rows 3-4 are a two-tile
    sofa four ways, two cells a row, the pair of diamonds lying across the way its front faces."""
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    d = ImageDraw.Draw(im)
    rh, c = 2 * CELL // 4, 2 * CELL // 4
    for i in range(1, 4):
        d.line([(0, i * rh), (2 * CELL, i * rh)], fill=GRID, width=6)
    for i in range(1, 4):
        d.line([(i * c, 0), (i * c, 2 * rh)], fill=GRID, width=6)
    d.line([(CELL, 2 * rh), (CELL, 2 * CELL)], fill=GRID, width=6)
    turns = [(-1, False), (1, False), (1, True), (-1, True)]
    w = int(c * 0.58)
    for r in range(2):
        for k in range(4):
            cx, cy = k * c + c // 2, r * rh + rh - int(rh * 0.14)
            poly(d, [(cx, cy - w // 4), (cx + w // 2, cy), (cx, cy + w // 4), (cx - w // 2, cy)], FRONT)
            arrow(d, cx, cy, *turns[k], w)
    w = int(rh * 0.62)
    for r in range(2):
        for k in range(2):
            sx, back = turns[2 * r + k]
            run = 1 if sx == -1 else -1                  # across the facing: front down-left or up-left -> runs down-right
            cx, cy = k * CELL + CELL // 2, (2 + r) * rh + rh - int(rh * 0.36)
            for j in (-0.5, 0.5):
                ox, oy = run * j * w / 2, j * w / 4
                poly(d, [(cx + ox, cy + oy - w // 4), (cx + ox + w // 2, cy + oy), (cx + ox, cy + oy + w // 4), (cx + ox - w // 2, cy + oy)], FRONT)
            arrow(d, cx, cy, sx, back, w)
    return im


def stride(guides_for, who_pic, toward):
    """Characters Sheets 03-05 (2026-10-21, PT45: "their legs move naturally, through every step"): one person, eight
    frames walking towards you (rows 1-2) and eight walking away (rows 3-4). Each cell: their body faint above the hips,
    the foot line and the head line, and the two legs drawn for that moment of the step -- blue one leg, orange the
    other -- each ending in a short foot. Both legs swing about the same hip; the body rises as the legs pass."""
    import math
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    d = ImageDraw.Draw(im)
    c = CELL // 2
    foot, head = c - 40, 70
    hip_f = 0.6                                      # where the hips are, down the standing picture
    for row in range(4):
        away = row >= 2
        pic = who_pic[1 if away else 0].copy()
        pic.thumbnail((c, foot - head), Image.LANCZOS)
        hip_y = int(pic.height * hip_f)
        body = pic.crop((0, 0, pic.width, hip_y + 6))
        a = body.getchannel("A").point(lambda v: v * 0.3)
        L = pic.height - hip_y                       # leg length, hip to ground
        # towards you they go down-left; away, up-LEFT (as the standing pictures are painted)
        fwd = (-math.cos(math.radians(22)), -math.sin(math.radians(22))) if away else (-math.cos(math.radians(22)), math.sin(math.radians(22)))
        for col in range(4):
            k = (row % 2) * 4 + col                  # frame 0-7
            x0, y0 = col * c, row * c
            legs = []
            for ph in (0, math.pi):
                p = 2 * math.pi * k / 8 + ph
                th = math.radians(24 * math.cos(p))
                kn = math.radians(8 + 45 * max(0.0, -math.sin(p)))
                knee = (math.sin(th) * L * 0.5, math.cos(th) * L * 0.5)
                sh = th - kn
                ank = (knee[0] + math.sin(sh) * L * 0.5, knee[1] + math.cos(sh) * L * 0.5)
                legs.append((knee, ank, th))
            drop = max(l[1][1] for l in legs)        # the lowest foot on the line: the body bobs with the step
            hx, hy = x0 + c // 2, y0 + foot - drop
            im.paste(Image.new("RGB", body.size, (255, 255, 255)), (int(hx - pic.width / 2), int(hy - hip_y)), a)
            d = ImageDraw.Draw(im)
            for (knee, ank, th), col_ in zip(legs, ((40, 90, 200), (235, 140, 30))):
                P = lambda v: (hx + fwd[0] * v[0], hy + v[1] + fwd[1] * v[0] * 0.3)
                K, A = P(knee), P(ank)
                lift = max(0.0, -th) * 1.2           # a back foot rolls up on its toes
                toe = (A[0] + fwd[0] * L * 0.22 * math.cos(lift), A[1] + fwd[1] * L * 0.07 - L * 0.22 * math.sin(lift) * 0.5)
                d.line([(hx, hy), K, A, toe], fill=col_, width=9, joint="curve")
                d.ellipse([K[0] - 6, K[1] - 6, K[0] + 6, K[1] + 6], fill=col_)
    d = ImageDraw.Draw(im)
    for i in range(1, 4):
        d.line([(i * c, 0), (i * c, 2 * CELL)], fill=GRID, width=6)
        d.line([(0, i * c), (2 * CELL, i * c)], fill=GRID, width=6)
    for row in range(4):
        for col in range(4):
            x0, y0 = col * c, row * c
            d.line([(x0 + 30, y0 + foot), (x0 + c - 30, y0 + foot)], fill=INK, width=4)
            for x in range(x0 + 30, x0 + c - 30, 24):
                d.line([(x, y0 + head), (x + 10, y0 + head)], fill=INK, width=3)
    return im


def tiled(make2x2):
    """A 4x4 sheet of 512px cells made of four copies of a 2x2 template (the same exact shapes, half size)."""
    im2 = make2x2().resize((CELL, CELL), Image.LANCZOS)
    out = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    for k in range(4):
        out.paste(im2, ((k % 2) * CELL, (k // 2) * CELL))
    d = ImageDraw.Draw(out)
    c = CELL // 2
    for i in range(1, 4):
        d.line([(i * c, 0), (i * c, 2 * CELL)], fill=GRID, width=6)
        d.line([(0, i * c), (2 * CELL, i * c)], fill=GRID, width=6)
    return out


def walls_lr():
    """Wall panels only, left and right, twice over (Sheet 10's 2x2 quarter)."""
    im, d = sheet()
    c = [(CELL // 2, CELL // 2), (CELL + CELL // 2, CELL // 2), (CELL // 2, CELL + CELL // 2), (CELL + CELL // 2, CELL + CELL // 2)]
    wall(d, *c[0], "l"); wall(d, *c[1], "r"); wall(d, *c[2], "l"); wall(d, *c[3], "r")
    return im


def counters_lr():
    """Single counters, darker front left then right, twice over (Sheet 11's 2x2 quarter)."""
    im, d = sheet()
    c = [(CELL // 2, CELL // 2), (CELL + CELL // 2, CELL // 2), (CELL // 2, CELL + CELL // 2), (CELL + CELL // 2, CELL + CELL // 2)]
    cube(d, *c[0], "l"); cube(d, *c[1], "r"); cube(d, *c[2], "l"); cube(d, *c[3], "r")
    return im


def sitting(people, art):
    """Characters Sheet 06 (2026-10-21): people sitting, two cells each -- on the chair seen from the front (facing
    down-left) and on the chair seen from the back (facing up-right). The game's chair is drawn faintly in each cell
    where it will be, so the person sits on it at the right size; their standing picture is faint beside it to copy."""
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    c = CELL // 2
    foot = c - 40
    chairs = [Image.open(os.path.join(art, n + ".webp")).convert("RGBA") for n in ("chair-fl", "chair-bl")]
    for k, who in enumerate(people):
        stand = Image.open(os.path.join(art, who + "-tl.webp")).convert("RGBA")
        for j, ch in enumerate(chairs):
            n = k * 2 + j
            x0, y0 = (n % 4) * c, (n // 4) * c
            chp = ch.copy(); chp.thumbnail((int(c * 0.42), int(c * 0.5)), Image.LANCZOS)
            a = chp.getchannel("A").point(lambda v: v * 0.45)
            im.paste(Image.new("RGB", chp.size, (255, 255, 255)), (x0 + (c - chp.width) // 2, y0 + foot - chp.height), a)
            st = stand.copy(); st.thumbnail((c // 4, int(c * 0.62)), Image.LANCZOS)
            a2 = st.getchannel("A").point(lambda v: v * 0.22)
            im.paste(Image.new("RGB", st.size, (255, 255, 255)), (x0 + 8, y0 + foot - st.height), a2)
    d = ImageDraw.Draw(im)
    for i in range(1, 4):
        d.line([(i * c, 0), (i * c, 2 * CELL)], fill=GRID, width=6)
        d.line([(0, i * c), (2 * CELL, i * c)], fill=GRID, width=6)
    for n in range(len(people) * 2):
        x0, y0 = (n % 4) * c, (n // 4) * c
        d.line([(x0 + 30, y0 + foot), (x0 + c - 30, y0 + foot)], fill=INK, width=4)
    return im


def stool_sitting(people, art):
    """Characters Sheet 07 (N44, 2026-10-21, Cam's N41: "characters don't sit properly on a stool"): people perched on
    the tall stool, two cells each -- facing down-left (face showing) and facing up-left (their back to us). Laid out
    like Sheet 06: the game's stool faint where it stands, at the game's size against the chair, the person's standing
    picture faint beside it to copy."""
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    c = CELL // 2
    foot = c - 40
    st0 = Image.open(os.path.join(art, "stool.webp")).convert("RGBA")
    for k, who in enumerate(people):
        stand = Image.open(os.path.join(art, who + "-tl.webp")).convert("RGBA")
        for j in range(2):
            n = k * 2 + j
            x0, y0 = (n % 4) * c, (n // 4) * c
            # the chair in Sheet 06 was 0.42 of a cell wide; the game draws a stool 34 wide to a chair's 44
            sp = st0.copy(); sp.thumbnail((int(c * 0.42 * 34 / 44), int(c * 0.62)), Image.LANCZOS)
            a = sp.getchannel("A").point(lambda v: v * 0.45)
            im.paste(Image.new("RGB", sp.size, (255, 255, 255)), (x0 + (c - sp.width) // 2 + 20, y0 + foot - sp.height), a)
            st = stand.copy(); st.thumbnail((c // 4, int(c * 0.62)), Image.LANCZOS)
            a2 = st.getchannel("A").point(lambda v: v * 0.22)
            im.paste(Image.new("RGB", st.size, (255, 255, 255)), (x0 + 8, y0 + foot - st.height), a2)
    d = ImageDraw.Draw(im)
    for i in range(1, 4):
        d.line([(i * c, 0), (i * c, 2 * CELL)], fill=GRID, width=6)
        d.line([(0, i * c), (2 * CELL, i * c)], fill=GRID, width=6)
    for n in range(len(people) * 2):
        x0, y0 = (n % 4) * c, (n // 4) * c
        d.line([(x0 + 30, y0 + foot), (x0 + c - 30, y0 + foot)], fill=INK, width=4)
    return im


# a painting on a wall panel (N45): where it hangs on the face, as fractions -- along the panel, and up from the floor
PAINTING = {"x0": 0.22, "x1": 0.78, "y0": 0.42, "y1": 0.82}


def paintings(side="l"):
    """Sheet 14 (N45, PT51: "paintings for the walls"): eight framed pictures, each painted INTO a slanted frame drawn on
    a left-wall panel (the face shown faint), so it hangs at the wall's angle; the right wall shows it mirrored. 4x4
    cells, a painting in every other cell (the empty ones keep Gemini from running them together)."""
    n, c = 4, 2 * CELL // 4
    im = Image.new("RGB", (2 * CELL, 2 * CELL), PINK)
    d = ImageDraw.Draw(im)
    w = int(W * c / CELL * 1.2)                         # the panel a bit bigger than a floor tile would be here
    H, q = int(w * 0.86), w // 4
    for k in range(8):
        cell = [0, 2, 5, 7, 8, 10, 13, 15][k]
        cx, cy = (cell % n) * c + c // 2, (cell // n) * c + c // 2
        b0, b1 = (cx - w // 2, cy + q // 2 + H // 2), (cx + w // 2, cy - q // 2 + H // 2)
        if side == "r":                                 # Sheet 16 (PT53 / N45 a4): the right wall, falling to the right --
            b0, b1 = (cx + w // 2, cy + q // 2 + H // 2), (cx - w // 2, cy - q // 2 + H // 2)   # its front end on the right
        face = [b0, b1, (b1[0], b1[1] - H), (b0[0], b0[1] - H)]
        poly(d, face, (214, 160, 190))
        P = lambda fx, fy: (b0[0] + (b1[0] - b0[0]) * fx, b0[1] + (b1[1] - b0[1]) * fx - H * fy)
        art = [P(PAINTING["x0"], PAINTING["y0"]), P(PAINTING["x1"], PAINTING["y0"]), P(PAINTING["x1"], PAINTING["y1"]), P(PAINTING["x0"], PAINTING["y1"])]
        poly(d, art, (236, 236, 236))
        d.line(art + [art[0]], fill=INK, width=5)
    for i in range(1, n):
        d.line([(i * c, 0), (i * c, 2 * CELL)], fill=GRID, width=6)
        d.line([(0, i * c), (2 * CELL, i * c)], fill=GRID, width=6)
    return im


def step_base(pic):
    """One walking frame to edit (N36): a person's standing picture in a cell laid out like the walking templates'
    (feet on the line at the same height, the same size), 1024px, for Gemini to change only the legs."""
    c = CELL // 2
    foot, head = c - 40, 70
    im = Image.new("RGB", (c, c), PINK)
    sc = (foot - head) / pic.height
    p = pic.resize((round(pic.width * sc), round(pic.height * sc)), Image.LANCZOS)
    im.paste(p, ((c - p.width) // 2, foot - p.height), p)
    return im.resize((CELL, CELL), Image.LANCZOS)


def mannequin(pic, k, toward=True):
    """N37 (2026-10-21, the Gemini specialist): a POSE picture for Gemini to draw a person into -- their own outline
    above the hips in solid grey, and grey legs at moment k of an eight-step walk (0 and 4 both feet down, 2 and 6 the
    legs passing), feet on the ground line. Gemini copies a pose it can SEE far better than one it's told about."""
    import math
    c = CELL
    foot, head = int(c * 0.92), int(c * 0.14)
    im = Image.new("RGB", (c, c), (236, 232, 226))
    sc = (foot - head) / pic.height                    # (scaled UP to fill the frame: the standing picture is small)
    p = pic.resize((round(pic.width * sc), round(pic.height * sc)), Image.LANCZOS)
    hip_y = int(p.height * 0.6)
    body = p.crop((0, 0, p.width, hip_y + 8))
    L = p.height - hip_y
    fwd = (-math.cos(math.radians(22)), math.sin(math.radians(22))) if toward else (-math.cos(math.radians(22)), -math.sin(math.radians(22)))
    legs = []
    for ph in (0, math.pi):
        q = 2 * math.pi * k / 8 + ph
        th = math.radians(24 * math.cos(q)); kn = math.radians(8 + 45 * max(0.0, -math.sin(q)))
        knee = (math.sin(th) * L * 0.5, math.cos(th) * L * 0.5); sh = th - kn
        legs.append((knee, (knee[0] + math.sin(sh) * L * 0.5, knee[1] + math.cos(sh) * L * 0.5), th))
    drop = max(l[1][1] for l in legs) + L * 0.06
    hx, hy = c // 2, foot - drop
    d = ImageDraw.Draw(im)
    # the far leg darker, drawn first; the near leg lighter, over it
    for (knee, ank, th), col in sorted(zip(legs, ((150, 150, 158), (110, 110, 118))), key=lambda z: z[0][1][0] * fwd[0]):
        P = lambda v: (hx + fwd[0] * v[0], hy + v[1] + fwd[1] * v[0] * 0.3)
        K, A = P(knee), P(ank)
        w = int(L * 0.16)
        d.line([(hx, hy), K, A], fill=col, width=w, joint="curve")
        for q in ((hx, hy), K):
            d.ellipse([q[0] - w / 2, q[1] - w / 2, q[0] + w / 2, q[1] + w / 2], fill=col)
        lift = max(0.0, -th) * 1.2
        toe = (A[0] + fwd[0] * L * 0.26 * math.cos(lift), A[1] + L * 0.04 - L * 0.26 * math.sin(lift) * 0.5)
        d.line([A, toe], fill=(70, 60, 55), width=int(w * 0.9))
        d.ellipse([toe[0] - w * 0.45, toe[1] - w * 0.45, toe[0] + w * 0.45, toe[1] + w * 0.45], fill=(70, 60, 55))
    grey = Image.new("RGB", body.size, (128, 128, 136))
    im.paste(grey, (int(hx - p.width / 2), int(hy - hip_y)), body.getchannel("A").point(lambda v: 255 if v > 90 else 0))
    d.line([(c * 0.1, foot), (c * 0.9, foot)], fill=(180, 170, 160), width=4)
    return im


FACINGS_08 = ["bench", "aframe", "sign", "bikerack", "picnic", "fence", "planter", "hedge"]
FACINGS_09 = ["bin", "postbox"]


def main():
    os.makedirs(OUT, exist_ok=True)
    c = [(CELL // 2, CELL // 2), (CELL + CELL // 2, CELL // 2), (CELL // 2, CELL + CELL // 2), (CELL + CELL // 2, CELL + CELL // 2)]
    im, d = sheet()
    wall(d, *c[0], "l"); wall(d, *c[1], "r"); wall(d, *c[2], "l", door=True); wall(d, *c[3], "r", door=True)
    im.save(os.path.join(OUT, "Template - Sheet 04 - Walls and doors.png"))
    im, d = sheet()
    cube(d, *c[0], "l"); cube(d, *c[1], "r"); cube(d, *c[2], "l", till=True); cube(d, *c[3], "r", till=True)
    im.save(os.path.join(OUT, "Template - Sheet 05 - Counters.png"))
    textures().save(os.path.join(OUT, "Template - Sheet 06 - Street textures.png"))
    props().save(os.path.join(OUT, "Template - Sheet 07 - Street things.png"))
    art = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "cafe", "art")
    g = lambda n: Image.open(os.path.join(art, n + ".webp")).convert("RGBA")
    walk([g("woman-tl"), g("woman-ar"), g("oldman-tl"), g("oldman-ar")]).save(os.path.join(OUT, "Template - Characters Sheet 02 - Walking.png"))
    facings(FACINGS_08, 4).save(os.path.join(OUT, "Template - Sheet 08 - Street things facing.png"))
    facings(FACINGS_09, 2).save(os.path.join(OUT, "Template - Sheet 09 - Bin and post box facing.png"))
    for n, who in ((3, "woman"), (4, "oldman"), (5, "boy")):
        pics = [g(who + "-tl"), g(who + "-ar")]
        stride(None, pics, True).save(os.path.join(OUT, f"Template - Characters Sheet 0{n} - {who.capitalize()} walking.png"))
    facings(["bistro", "garden", "armchair"], 4, back=True).save(os.path.join(OUT, "Template - Sheet 13 - Chairs from the back.png"))
    tiled(walls_lr).save(os.path.join(OUT, "Template - Sheet 10 - Wallpapers.png"))
    tiled(counters_lr).save(os.path.join(OUT, "Template - Sheet 11 - Counter styles.png"))
    facings(["t1", "t2", "t3", "t4", "c1", "c2", "c3", "c4"], 4).save(os.path.join(OUT, "Template - Sheet 12 - Tables chairs and decor.png"))
    sitting(["woman", "oldman", "boy"], art).save(os.path.join(OUT, "Template - Characters Sheet 06 - Sitting.png"))
    ref = os.path.join(os.path.dirname(OUT), "References")
    step_base(g("woman-tl")).save(os.path.join(ref, "Walk base - Woman towards.png"))
    for k, name in ((0, "1 both feet down"), (2, "2 legs passing"), (4, "3 other foot forward"), (6, "4 legs passing again")):
        mannequin(g("woman-tl"), k).save(os.path.join(ref, f"Pose - towards {name}.png"))
    # N44 (PT50, Cam: "implement prompts for the others now"): the same mannequins for the old man and the boy walking
    # towards you, and for all three walking away (their up-left picture's outline, the legs stepping away from us)
    for who, name in (("oldman", "Old man"), ("boy", "Boy"), ("woman", "Woman")):
        for i, k in enumerate((0, 2, 4, 6)):
            if who != "woman":
                mannequin(g(who + "-tl"), k).save(os.path.join(ref, f"Pose - {name} towards {i + 1}.png"))
            mannequin(g(who + "-ar"), k, toward=False).save(os.path.join(ref, f"Pose - {name} away {i + 1}.png"))
    stool_sitting(["woman", "oldman", "boy"], art).save(os.path.join(OUT, "Template - Characters Sheet 07 - Sitting on stools.png"))
    # N45 (PT51: "paintings for the walls ... a music box ... an arcade machine"): the paintings, and the coin machines in
    # facing pairs (front facing down-left, front facing down-right -- both FRONTS: Sheet 12's second cells came back as backs)
    paintings().save(os.path.join(OUT, "Template - Sheet 14 - Wall paintings.png"))
    # N46 (N45 a4, Cam: "we need paintings created in the two directions that are the same as the wall"): the right wall's
    paintings("r").save(os.path.join(OUT, "Template - Sheet 16 - Wall paintings right.png"))
    facings(["jukebox", "arcade", "pinball", "piano"], 4).save(os.path.join(OUT, "Template - Sheet 15 - Coin machines.png"))
    # N47: machines painted four ways, one a row (the Halloween machines; any later ones too)
    facings4(["m1", "m2", "m3", "m4"]).save(os.path.join(OUT, "Template - Machines four ways.png"))
    twotile(["t1", "t2", "t3", "t4"]).save(os.path.join(OUT, "Template - Two-tile things.png"))
    furniture4().save(os.path.join(OUT, "Template - Furniture four ways.png"))
    one_way().save(os.path.join(OUT, "Template - One way.png"))
    one_way(backs=True).save(os.path.join(OUT, "Template - Front and back.png"))
    print("written to", OUT)


if __name__ == "__main__":
    main()
