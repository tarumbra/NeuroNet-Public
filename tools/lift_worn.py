#!/usr/bin/env python3
"""Lift worn armour off Cam's Gemini pictures into NeuroPets (2026-10-11).

    python3 tools/lift_worn.py bronze            (one outfit, both poses)
    python3 tools/lift_worn.py --all             (every outfit that has its pictures)

The method (vault: NeuroPets/Worn Armour): Gemini dresses the young man (Player/New/Male - <Standing|Fighting>.jpeg) in
one outfit, then takes him away and leaves only the armour, where it sat. Those armour-only pictures are
~/Pictures/NeuroPets Art Assets/Worn/Done/"<outfit> - <standing|fighting> - armour.jpeg". The outfit's pieces, by slot,
are in tools/worn/outfits.json.

Each picture is keyed and cut with the SAME crop and scale as the body sprites (cut_player_bodies.frame), then split into
its slots (helmet, torso, arms, legs, feet, cloak) by where each part sits on the body. A connected piece that sits almost all
in one slot goes to it whole (a long robe stays a robe); pieces that touch (greaves into boots, the front gauntlet over
the chestplate when fighting) are split along the body's lines. Every layer is the body sprite's size, so the game just
stacks them: ui/pet/art/worn/<item>-<a|fight>.webp, listed in ui/pet/art/worn/manifest.js."""
import json, os, re, sys
from collections import deque
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cut_player_bodies as bodies

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "ui", "pet", "art", "worn")
DONE = os.path.expanduser("~/Pictures/NeuroPets Art Assets/Worn/Done")
OUTFITS = os.path.join(HERE, "worn", "outfits.json")
ALIASES = {"ram-horn-brawler": ["ram-brawler", "brawler"]}          # names Cam's pictures use for an outfit
SLOTS = ("helmet", "torso", "arms", "legs", "feet", "cloak")
# a part that sits where the outfit has no piece goes to the next one that makes sense: a robe's skirt with no greaves is
# the robe; everything below a mage's hat is the cloak (which the game draws behind you)
FALLBACK = {"helmet": ["torso", "cloak"], "arms": ["torso", "cloak"], "legs": ["torso", "cloak"], "feet": ["legs", "torso", "cloak"],
            "torso": ["legs", "cloak"]}
SHIFT = bodies.PAD - 14          # keyed pictures are padded by PAD and cut with a 14px inset: master (x, y) -> (x+SHIFT, y+SHIFT)

# The young man's body lines, in the 2048x2048 master pictures (measured 2026-10-11 on the bronze pilot).
# Fighting: his front fist and forearm sit across his chest -- that zone is the arms, so a chestplate worn on its own
# leaves the arm in front of it, as it is on the body.
FRONT_ARM = [(642, 897), (725, 852), (822, 837), (882, 770), (950, 752), (1017, 758), (1067, 807), (1067, 902),
             (1025, 935), (950, 938), (912, 950), (860, 983), (740, 1040), (650, 1040)]
def inside(poly, x, y):
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
LINES = {
    "a":     {"neck": 560, "hips": 1340, "boots": ((1000, 1800), (2048, 1800)),
              "arms": lambda x, y: 950 < y < 1440 and (x < 800 or x > 1185)},
    "fight": {"neck": 558, "hips": 1300, "boots": ((1100, 1830), (2048, 1770)),
              "arms": lambda x, y: inside(FRONT_ARM, x, y) or (x > 1250 and y < 1000)},
}

def region(pose, x, y, cut=None):
    """The slot the body has at master pixel (x, y). `cut` (x -> y) is where greaves meet boots in this picture."""
    L = LINES[pose]
    # above the neck it's the helmet over the head (or up high: horns, crests) -- out at the shoulders it's the body's
    # (2026-10-11: the bat leather robe's wings and the brawler plate's spikes were cut off into the helmet)
    if y < L["neck"] and (y < 440 or 700 <= x <= 1240): return "helmet"
    if L["arms"](x, y): return "arms"
    if y < L["hips"]: return "torso"
    for right, line in L["boots"]:
        if x < right: return "feet" if y >= (cut or {}).get(x, line) else "legs"
    return "legs"

def boot_cut(pose, keyed, band=90, smooth=12):
    """Where greaves meet boots, column by column: the drawn ink line nearest the body's boot line (a greave's bottom
    edge, or a boot's top), so a greave worn alone ends on its own outline rather than a ruler-straight cut."""
    px, W = keyed.convert("L").load(), keyed.size[0]
    ap = keyed.split()[3].load()
    raw, left = {}, 0
    for right, line in LINES[pose]["boots"]:
        for x in range(left, min(right, W - SHIFT)):
            best = None
            for d in range(band):
                for y in (line + d, line - d):
                    X, Y = x + SHIFT, y + SHIFT
                    if 0 <= Y < keyed.size[1] and ap[X, Y] > 200 and px[X, Y] < 60:
                        best = y; break
                if best is not None: break
            raw[x] = best if best is not None else line
        left = right
    xs = sorted(raw)
    med = lambda w: sorted(w)[len(w) // 2]
    return {x: med([raw[k] for k in xs[max(0, i - smooth): i + smooth + 1]]) for i, x in enumerate(xs)}

def owner(slot, have):
    """Which of the outfit's own slots takes a part that sits in `slot` (a robe's skirt with no greaves: the torso)."""
    for s in [slot] + FALLBACK.get(slot, []):
        if s in have: return s
    return next(iter(have))

def stray_lines_out(im, reach=26):
    """Ink lines with no armour beside them go (2026-10-11: a soft leather cap's inner rim was drawn as a line that ran
    across the face). A real outline always edges some painted fill within a few pixels; a line drawn where the body was
    has only pink on both sides."""
    from PIL import ImageChops, ImageFilter
    a, lum = im.split()[3], im.convert("L")
    dark = ImageChops.multiply(lum.point(lambda v: 255 if v < 45 else 0), a.point(lambda v: 255 if v > 128 else 0))
    fill = ImageChops.multiply(lum.point(lambda v: 255 if v >= 45 else 0), a.point(lambda v: 255 if v > 128 else 0))
    near = fill.filter(ImageFilter.MaxFilter(2 * reach + 1))
    stray = ImageChops.multiply(dark, ImageChops.invert(near))
    out = im.copy(); out.putalpha(ImageChops.multiply(a, ImageChops.invert(stray)))
    return out

def skin_showing(outfit, pname, size):
    """Where the dressed picture shows the young man's own skin (his face through a helmet's opening): a mask in the keyed
    pictures' frame, or None. Gemini sometimes paints a helmet's opening dark once he's gone (the standing snapshell,
    2026-10-11) though the dressed picture shows his face there -- so that part of a helmet must be see-through."""
    from PIL import ImageChops, ImageFilter
    flat = lambda x: re.sub(r"[^a-z]", "", x.lower())
    names = [flat(outfit)] + [flat(a) for a in ALIASES.get(outfit, [])]
    hit = [f for f in os.listdir(DONE) if (lambda m: m and flat(m.group(1)) in names and m.group(2).lower() == pname)(
        re.match(r"(.+?) - (standing|fighting) - dressed$", os.path.splitext(f)[0].strip(), re.I))]
    if not hit: return None
    master = Image.open(os.path.join(bodies.SRC, "Male - %s.jpeg" % pname.capitalize())).convert("RGB")
    dressed = Image.open(os.path.join(DONE, hit[0])).convert("RGB")
    if dressed.size != master.size: return None
    r, g, b = master.split()
    skin = ImageChops.multiply(ImageChops.multiply(r.point(lambda v: 255 if v > 190 else 0), g.point(lambda v: 255 if 130 < v < 210 else 0)),
                               b.point(lambda v: 255 if 100 < v < 185 else 0))
    diff = ImageChops.difference(dressed, master).convert("L").filter(ImageFilter.MinFilter(5))   # a few pixels' drift is fine
    same = diff.point(lambda v: 255 if v < 35 else 0)
    m = ImageChops.multiply(skin, same).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    m = m.filter(ImageFilter.MaxFilter(41)).filter(ImageFilter.MinFilter(41))   # and the eyes, brows and mouth inside the face...
    m = ImageChops.multiply(m, same)                                          # ...but only where the dressed picture still shows him
    out = Image.new("L", size, 0); out.paste(m, (bodies.PAD - 14, bodies.PAD - 14))
    return out

def components(alpha, step=4):
    """Connected parts of the keyed picture, on a 1/step grid: a list of [(gx, gy), ...]."""
    W, H = alpha.size[0] // step, alpha.size[1] // step
    small = alpha.resize((W, H)).point(lambda v: 255 if v > 60 else 0).load()
    seen, parts = set(), []
    for y in range(H):
        for x in range(W):
            if small[x, y] and (x, y) not in seen:
                q, part = deque([(x, y)]), []
                seen.add((x, y))
                while q:
                    cx, cy = q.popleft(); part.append((cx, cy))
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < W and 0 <= ny < H and small[nx, ny] and (nx, ny) not in seen:
                            seen.add((nx, ny)); q.append((nx, ny))
                if len(part) > 30: parts.append(part)          # specks and stray lettering out
    return parts

def lift(outfit, pieces, pose, pname):
    # "armor", any case, any picture type, and "snap-shell" for snapshell or "ram-brawler" for ram-horn-brawler are fine too
    flat = lambda x: re.sub(r"[^a-z]", "", x.lower())
    names = [flat(outfit)] + [flat(a) for a in ALIASES.get(outfit, [])]
    want = "%s - %s - armour" % (outfit, pname)
    found = []
    for f in (os.listdir(DONE) if os.path.isdir(DONE) else []):
        m = re.match(r"(.+?) - (standing|fighting) - (armour|armor)$", os.path.splitext(f)[0].strip(), re.I)
        if m and flat(m.group(1)) in names and m.group(2).lower() == pname: found.append(f)
    if not found: print("  not made yet:", want + ".jpeg"); return []
    src = os.path.join(DONE, found[0])
    keyed = stray_lines_out(bodies.keyed(src))
    pics, box = bodies.frame(pose)
    if keyed.size != pics["m"].size:
        sys.exit("%s isn't the same size as the young man's picture -- save Gemini's picture as it came" % src)
    have = [s for s in SLOTS if pieces.get(s)]
    cut = boot_cut(pose, keyed) if "legs" in have and "feet" in have else None
    step, a = 4, keyed.split()[3]
    cell = {}                                                     # grid cell -> its part's slot, or None: split by the body lines
    for part in components(a, step):
        votes = {}
        for gx, gy in part[::3]:
            s = owner(region(pose, gx * step + step // 2 - SHIFT, gy * step + step // 2 - SHIFT), have)
            votes[s] = votes.get(s, 0) + 1
        best, n = max(votes.items(), key=lambda kv: kv[1])
        whole = best if n >= 0.85 * sum(votes.values()) else None
        for g in part: cell[g] = whole
    near = [(0, 0)] + [(dx, dy) for r in (1, 2) for dx in range(-r, r + 1) for dy in range(-r, r + 1) if max(abs(dx), abs(dy)) == r]
    slot_of = Image.new("L", keyed.size, 255)                     # 255 = nothing; else the index in SLOTS
    sp, ap = slot_of.load(), a.load()
    W, H = keyed.size
    for y in range(H):
        for x in range(W):
            if not ap[x, y]: continue
            gx, gy = x // step, y // step
            for dx, dy in near:                                    # the soft edge just outside a part's cells joins that part
                g = (gx + dx, gy + dy)
                if g in cell:
                    s = cell[g] or owner(region(pose, x - SHIFT, y - SHIFT, cut), have)
                    if s != "feet" and "feet" in have and region(pose, x - SHIFT, y - SHIFT, cut) == "feet":
                        s = "feet"                                   # footwear touching a long robe is still footwear (the pharaoh's sandals)
                    sp[x, y] = SLOTS.index(s)
                    break
    os.makedirs(OUT, exist_ok=True)
    done = []
    face = skin_showing(outfit, pname, keyed.size) if "helmet" in have else None
    for s in have:
        m = slot_of.point(lambda v, i=SLOTS.index(s): 255 if v == i else 0)
        if s == "helmet" and face:                                   # his face shows through the opening...
            from PIL import ImageChops, ImageStat
            covered = ImageChops.multiply(ImageChops.multiply(m, face), keyed.convert("L").point(lambda v: 255 if v < 90 else 0))
            faced = ImageStat.Stat(face).sum[0] or 1
            if ImageStat.Stat(covered).sum[0] / faced > 0.3:          # ...only when the helmet painted it over dark
                m = ImageChops.multiply(m, ImageChops.invert(face))
                print("  %-16s %-5s the face showed through the opening: made see-through" % (pieces[s], pose))
        layer = keyed.copy(); layer.putalpha(Image.composite(a, Image.new("L", a.size, 0), m))
        out = bodies.fit(layer, box)
        if not out.getbbox():
            print("  %-16s %-5s nothing found in its part of the body -- check the picture" % (pieces[s], pose)); continue
        dst = os.path.join(OUT, "%s-%s.webp" % (pieces[s], pose))
        out.save(dst, "WEBP", quality=90, method=6)
        done.append(pieces[s]); print("  %-16s %-5s %s" % (pieces[s], pose, s))
    return done

def write_manifest(new):
    path = os.path.join(OUT, "manifest.js")
    pics = {}
    if os.path.exists(path):
        m = re.search(r"window\.WORN_PICS = (\{.*\});", open(path, encoding="utf-8").read())
        if m: pics = json.loads(m.group(1))
    for item, pose in new: pics.setdefault(item, {})[pose] = 1
    with open(path, "w", encoding="utf-8") as f:
        f.write("/* Worn armour (2026-10-11): item id -> poses (a = standing, fight = fighting), each a layer the size of the body\n"
                "   sprite: art/worn/<item>-<pose>.webp. Written by tools/lift_worn.py. */\n")
        f.write("window.WORN_PICS = %s;\n" % json.dumps(dict(sorted(pics.items())), sort_keys=True))

def main():
    outfits = json.load(open(OUTFITS, encoding="utf-8"))
    want = list(outfits) if "--all" in sys.argv else [a for a in sys.argv[1:] if not a.startswith("-")]
    if not want: sys.exit(__doc__)
    new = []
    for o in want:
        if o not in outfits: sys.exit("No outfit called %s in tools/worn/outfits.json" % o)
        print(o)
        for pose, pname in (("a", "standing"), ("fight", "fighting")):
            new += [(i, pose) for i in lift(o, outfits[o], pose, pname)]
    write_manifest(new)

if __name__ == "__main__":
    main()
