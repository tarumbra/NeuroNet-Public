#!/usr/bin/env python3
"""NeuroCafe's recolourable parts (2026-10-24, Cam: "swatches for each furniture item"): for each picture listed, the
pixels of its fabric colour (by hue) cut out into <id>-fab.webp, soft at the edges. The game draws that layer over the
picture with a colour shift (CSS hue-rotate / saturate / brightness), so a swatch or the colour slider recolours the
cushions and leaves the wood and the outlines alone. Adds them to ui/cafe/art/manifest.js.

    python3 tools/make_cafe_fabric.py [prefix]     (only the pictures whose names start with prefix, e.g. prop-rail_)
"""
import colorsys
import json
import os
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
# Each MATERIAL says which pixels recolour (2026-10-24, Cam: "implement for the other furniture"): a hue range for
# coloured ones, or "light" (white paint, marble) / "dark" (black iron) by brightness, as those have no hue to turn --
# the game tints them first (sepia) and turns that. Its swatch set is cafe.js SWATCH_SETS[material].
#   material: (kind, hue lo, hue hi, min saturation, min value, max value)
MATERIALS = {
    "blue": ("hue", 165, 235, 0.12, 0.18, 1.0),       # Cam's blue sofa set: cushions, arm stripes, the lamp's shade
    # (PT, 24 October: the edges stayed orange -- the shading runs red, down to hue 345; the outlines are what's darker)
    "leather": ("hue", -18, 50, 0.2, 0.34, 1.0),       # the armchair's tan leather
    "wood": ("hue", -18, 50, 0.2, 0.34, 1.0),          # wooden tables, chairs, the stool, coat stand, the counters
    "pot": ("hue", -20, 40, 0.25, 0.42, 1.0),          # terracotta plant pots (the leaves are green: left alone; the shading runs red; the soil is darker)
    "darkwood": ("hue", 0, 45, 0.2, 0.08, 1.0),        # dark-stained wood: the bookshelf
    "shade": ("hue", 22, 66, 0.08, 0.6, 1.0),          # the old floor lamp's cream shade
    "linen": ("hue", 5, 50, 0.06, 0.55, 1.0),          # (2026-10-25) the pouf's cream linen and the cushion: low saturation, warm
    "light": ("light", 0, 360, 0.0, 0.62, 1.0),        # white paint, marble
    "dark": ("dark", 0, 360, 0.0, 0.0, 0.36),          # black iron
    # (PT56, Cam: "the paint on the divider not covering it all" -- white paint's shaded grooves and base are greyer)
    "white": ("light", 0, 360, 0.0, 0.4, 1.0),         # the white-painted dividers, shading and all
    # (2026-11-08, Cam: the velvet rope, "change the color of the poles and the ropes"): the red rope, the gold posts
    "velvet": ("hue", -30, 14, 0.3, 0.4, 1.0),          # (above the dark red outlines: those stay)
    "brass": ("hue", 22, 66, 0.25, 0.3, 1.0),
    # (2026-11-08, Cam: "swatches for the stoves, milkshake makers and counters"): the milkshake counters' mint panels
    # (and the blender on the counter, the same mint), the milkshake machine's pink
    "mint": ("hue", 105, 178, 0.12, 0.35, 1.0),
    "pink": ("hue", -45, 8, 0.2, 0.45, 1.0),
}
# picture -> its material (every picture of a thing; THINGS[kind].tint in cafecore.js names the same material)
PICTURES = {
    "blue": ["sofa-l", "sofa-r", "sofa-bl", "sofa-br", "lamp_blue"],
    "leather": ["armchair-l", "armchair-bl", "armchair-br"],
    "wood": ["table", "chair-fl", "chair-bl", "table_square", "table_coffee", "table_wood", "stool", "coatstand",
             "counter-l", "counter-r", "buffet-l", "buffet-r",   # (2026-10-24: counters by swatch, not counter styles)
             "table_long-l", "table_long-r",                      # (2026-10-25, make_cafe_joins.py)
             "table_low-l", "table_low-r", "table_lowround"]      # (V25 q2: the low tables)
             + [f"{k}-{s}-{j}" for k in ("counter", "buffet") for s in "lr" for j in ("jf", "jn", "jfn")],   # (a row's joins)
    "darkwood": ["bookshelf"],
    "pot": ["fern", "palm", "pot_lavender", "pot_flowers", "pot_ferns"],
    "shade": ["floorlamp", "cushion", "cupboard"],             # (2026-10-25: the pantry cupboard's cream paint)                       # (V25 q2: the floor cushion too)
    "linen": ["pouf"],
    "light": ["table_garden", "chair_garden-l", "chair_garden-bl", "chair_garden-br", "table_bistro"],
    "dark": ["chair_bistro-l", "chair_bistro-bl", "chair_bistro-br"],
}
# N48 (Sheet 20): the dividers, both their pictures (painted -l and -r) -- the brick and the velvet rope take the warm
# "wood" range (red-brown), the banner the cream "shade", the white half-wall and trellis the white paint
PICTURES["white"], PICTURES["velvet"] = [], []
for m, kinds in (("white", ["halfwall", "lattice"]), ("wood", ["halfbrick", "screen", "planterwall", "standmirror"]), ("shade", ["barrier"]), ("velvet", ["vipropes"])):
    PICTURES[m] += [k + side for k in kinds for side in ("-l", "-r")]
# PT56 (Cam: two-tone things, "the black divider with a red top"): the second part, cut into <pic>-fab2 (cafecore.js
# MATERIAL2 names the same): the half wall's wood top rail, the brick wall's stone coping, the banner's black posts.
# Each keeps only its biggest joined-up piece (the brick's pale mortar lines aren't the coping).
PICTURES2 = {"wood": ["halfwall-l", "halfwall-r"], "light": ["halfbrick-l", "halfbrick-r"], "dark": ["barrier-l", "barrier-r"],
             "brass": ["vipropes-l", "vipropes-r"]}   # (2026-11-08: the velvet rope's gold posts; its rope is the -fab)
# PT56 (Cam: "the cash register have swatches as well, two tones"): the till's cabinet is wood (its -fab) and the brass
# register on it its second part (-fab2). The two are the same orange, so the register is cut by place: everything
# inside its own dark outline, flooded from its middle (REGISTER, measured), its holes filled and the outline taken too;
# the cabinet's layer is the wood less that.
REGISTER = {"till-l": (125, 60), "till-r": (113, 60)}
PICTURES["wood"] += list(REGISTER)
# (2026-11-08, Cam: half walls "should have swatches for colors as well" -- and the patio's railings are half-wall
# styles now): each railing's painted part, both its pictures
for m, kinds in (("wood", ["wood", "glass", "rope", "hedge", "bamboo", "wicker", "trellis", "festoon", "corten"]),
                 ("white", ["picket", "chain", "balustrade"]), ("blue", ["pastel"]), ("dark", ["iron", "spooky", "ivyiron"])):
    PICTURES[m] += [f"prop-rail_{k}{side}" for k in kinds for side in ("-l", "-r")]
# (2026-11-08) the stove's cream enamel (the "shade" swatches; the dirty stove's too), the milkshake counters, the
# milkshake machine and the sushi counters' pine (wood: their biggest piece, so the salmon in the glass stays salmon)
PICTURES["shade"] += ["stove-l", "stove-r", "stove-dirty-l", "stove-dirty-r"]
PICTURES["mint"] = [f"{k}-{s}" for k in ("shakebar", "shakeshelf") for s in ("l", "r", "bl", "br")]
PICTURES["pink"] = [f"shakevend-{s}" for s in ("l", "r", "bl", "br")]
SUSHI = [f"{k}-{s}" for k in ("sushibar", "sushishelf") for s in ("l", "r", "bl", "br")]
PICTURES["wood"] += SUSHI
FABRIC2 = {pid: MATERIALS[m] for m, ids in PICTURES2.items() for pid in ids}
FABRIC = {pid: MATERIALS[m] for m, ids in PICTURES.items() for pid in ids}
# a picture whose pixels need their own range though it takes its material's swatches (2026-10-25, Cam: the floor
# cushion "doesnt colour properly with swatches" -- it's ochre, not the lampshade's cream: its shaded sides are a deep
# orange, darker than "shade" takes; the dark red outline, hue 340-10 and under 40% bright, stays out)
FABRIC["cushion"] = ("hue", 10, 56, 0.3, 0.38, 1.0)
# the stove's enamel is a peachier cream than the lampshade (hue 10 to 35); its dark red-brown outline stays out
for _s in ("stove-l", "stove-r", "stove-dirty-l", "stove-dirty-r"):
    FABRIC[_s] = ("hue", 0, 48, 0.08, 0.55, 1.0)
# materials whose layer keeps only its sizeable joined-up pieces (Cam, 24 October: a green pot's colour speckled the
# fern's leaf outlines too -- the pot's body and rim are the big pieces; specks are dropped)
ONE_PIECE = {"pot", "velvet"}
PIECE_OF = {pid: m for m, ids in PICTURES.items() for pid in ids}


def one_piece(fab, share=0.1):
    """The fabric layer's sizeable joined-up pieces (share of the biggest or more); specks dropped."""
    from collections import deque
    W, H = fab.size
    a = fab.getchannel("A").load()
    seen, comps = bytearray(W * H), []
    for y in range(H):
        for x in range(W):
            if a[x, y] < 40 or seen[y * W + x]:
                continue
            comp, q = [], deque([(x, y)])
            seen[y * W + x] = 1
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and a[nx, ny] >= 40:
                        seen[ny * W + nx] = 1
                        q.append((nx, ny))
            comps.append(comp)
    big = max((len(c) for c in comps), default=0)
    keep = Image.new("L", (W, H), 0)
    kp = keep.load()
    for c in comps:
        if len(c) >= big * share:
            for x, y in c:
                kp[x, y] = 255
    from PIL import ImageFilter
    keep = keep.filter(ImageFilter.MaxFilter(5))          # its soft edge too
    out = fab.copy()
    out.putalpha(Image.composite(fab.getchannel("A"), Image.new("L", (W, H), 0), keep))
    return out


def register_mask(pic, seed):
    """The register on the till: flooded from seed over everything lighter than its outline (36%), holes filled, then
    grown 2px to take its outline."""
    from collections import deque
    from PIL import ImageFilter
    pic = pic.convert("RGBA")
    W, H = pic.size
    px = pic.load()
    inside = bytearray(W * H)
    inside[seed[1] * W + seed[0]] = 1
    q = deque([seed])
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not inside[ny * W + nx]:
                r, g, b, a = px[nx, ny]
                if a > 100 and max(r, g, b) > 0.36 * 255:
                    inside[ny * W + nx] = 1
                    q.append((nx, ny))
    outside = bytearray(W * H)                         # the holes: what can't be reached from the picture's edge
    q = deque((x, y) for x in range(W) for y in (0, H - 1)) + deque((x, y) for y in range(H) for x in (0, W - 1))
    for x, y in q:
        outside[y * W + x] = 1
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not outside[ny * W + nx] and not inside[ny * W + nx]:
                outside[ny * W + nx] = 1
                q.append((nx, ny))
    m = Image.new("L", (W, H), 0)
    mp = m.load()
    for y in range(H):
        for x in range(W):
            if not outside[y * W + x]:
                mp[x, y] = 255
    m = m.filter(ImageFilter.MaxFilter(5))
    return Image.composite(m, Image.new("L", (W, H), 0), pic.getchannel("A").point(lambda v: 255 if v > 10 else 0))


def till_register(pic, seed, *rule):
    """The register's mask with its loose bits too (the crank handle, outside its outline): the cabinet's small
    pieces once the register's taken out."""
    from PIL import ImageChops
    reg = register_mask(pic, seed)
    rest = masked(fabric(pic, *rule), reg, keep=False)
    loose = ImageChops.subtract(rest.getchannel("A"), one_piece(rest, 0.05).getchannel("A")).point(lambda v: 255 if v > 20 else 0)
    from PIL import ImageFilter
    near = reg.filter(ImageFilter.MaxFilter(15))       # (only bits by the register: Cam saw a strip of the cabinet's panel go too)
    loose = loose.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(5))   # (lumps like the crank, not thin edge lines)
    return ImageChops.lighter(reg, ImageChops.multiply(loose, near))


def masked(pic, mask, keep=True):
    """pic (RGBA) with only the mask's part (keep) or all but it."""
    pic = pic.convert("RGBA")
    m = mask if keep else mask.point(lambda v: 255 - v)
    out = pic.copy()
    out.putalpha(Image.composite(pic.getchannel("A"), Image.new("L", pic.size, 0), m))
    return out


def cap(pic):
    """A wall's coping, sides and all (PT56 round 5, Cam: "the half wall top needs to also paint the sides"): by colour
    only its pale top face was found -- its shaded sides are darker and warmer. So it's taken by place instead: in each
    column, everything above the first brick (a red-orange pixel) once past the coping's pale face -- the dark red
    outline over the top doesn't count as brick. Where a column finds no brick (the wall's ends) or a stray one, its
    neighbours' line is used (the median over 25 columns)."""
    pic = pic.convert("RGBA")
    W, H = pic.size
    src = pic.load()
    cut = [None] * W
    for x in range(W):
        pale = False
        for y in range(H):
            r, g, b, a = src[x, y]
            if a < 10:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            pale = pale or (s < 0.25 and v > 0.6)
            if pale and s > 0.35 and v > 0.45 and (h * 360 < 35 or h * 360 > 345):
                cut[x] = y                             # the bricks start here
                break
    out = Image.new("RGBA", pic.size, (0, 0, 0, 0))
    dst = out.load()
    for x in range(W):
        near = sorted(c for c in cut[max(0, x - 12):x + 13] if c is not None)
        if not near:
            continue
        for y in range(near[len(near) // 2]):
            if src[x, y][3] >= 10:
                dst[x, y] = src[x, y]
    return out


def fabric(pic, how, lo, hi, smin, vmin, vmax):
    pic = pic.convert("RGBA")
    out = Image.new("RGBA", pic.size, (0, 0, 0, 0))
    src, dst = pic.load(), out.load()
    for y in range(pic.height):
        for x in range(pic.width):
            r, g, b, a = src[x, y]
            if a < 10:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            h *= 360
            if how == "light":                         # pale and nearly grey: white paint, marble
                if s > 0.22 or v < vmin:
                    continue
                k = min(1.0, (0.22 - s) / 0.08) * min(1.0, (v - vmin) / 0.1)
            elif how == "dark":                        # dark and nearly grey: black iron (the brown outlines have colour)
                if s > 0.45 or v > vmax:
                    continue
                k = min(1.0, (0.45 - s) / 0.1) * min(1.0, (vmax - v) / 0.08)
            else:
                if s < smin or v < vmin:               # greys and the dark outlines stay as they are
                    continue
                d = (h - lo) % 360                     # (a range can run round past red: lo below 0)
                edge = min(d, hi - lo - d)             # inside the range; fades over 8 degrees at its ends
                if d > hi - lo or edge <= 0:
                    continue
                k = min(1.0, edge / 8) * min(1.0, (s - smin) / 0.1) * min(1.0, (v - vmin) / 0.05)
            dst[x, y] = (r, g, b, int(a * k))
    return out


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    for pid, rule in FABRIC.items():
        if not pid.startswith(only):
            continue
        path = os.path.join(OUT, pid + ".webp")
        if not os.path.isfile(path):
            print(f"  {pid}: no picture, skipped")
            continue
        fab = fabric(Image.open(path), *rule)
        if pid in REGISTER:
            fab = one_piece(masked(fab, register_mask(Image.open(path), REGISTER[pid]), keep=False), 0.05)
        if PIECE_OF[pid] in ONE_PIECE:
            fab = one_piece(fab)
        if pid in SUSHI:
            fab = one_piece(fab, 0.3)
        fab.save(os.path.join(OUT, pid + "-fab.webp"), "WEBP", quality=92, method=6)
        sizes[pid + "-fab"] = list(fab.size)
        print(f"  {pid}-fab.webp {fab.size}")
    for pid, rule in FABRIC2.items():
        if not pid.startswith(only):
            continue
        path = os.path.join(OUT, pid + ".webp")
        if not os.path.isfile(path):
            continue
        fab = one_piece(cap(Image.open(path)), 0.35) if pid.startswith("halfbrick") else one_piece(fabric(Image.open(path), *rule), 0.02 if pid.startswith("barrier") else 0.1)
        fab.save(os.path.join(OUT, pid + "-fab2.webp"), "WEBP", quality=92, method=6)
        sizes[pid + "-fab2"] = list(fab.size)
        print(f"  {pid}-fab2.webp {fab.size}")
    for pid, seed in REGISTER.items():
        if not pid.startswith(only):
            continue
        path = os.path.join(OUT, pid + ".webp")
        if not os.path.isfile(path):
            continue
        pic = Image.open(path)
        fab = masked(pic, till_register(pic, seed, *FABRIC[pid]))
        fab.save(os.path.join(OUT, pid + "-fab2.webp"), "WEBP", quality=92, method=6)
        sizes[pid + "-fab2"] = list(fab.size)
        print(f"  {pid}-fab2.webp {fab.size}")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
