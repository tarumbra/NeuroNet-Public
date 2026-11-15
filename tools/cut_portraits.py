#!/usr/bin/env python3
"""Cut Cam's full-figure character paintings into big portraits (2026-10-17, Cam: "When doing the tutorial for the tutor
please make the character image bigger. It is to small").

The 128px icons (obj_p<name>, cut by cut_icon_sheets.py) are for cards; the tutorial window shows a person at full height, so
it gets its own picture: the figure trimmed to itself and saved HEIGHT px tall as ui/pet/art/people/<name>.webp, and
ui/pet/art/people/manifest.js (window.PEOPLE_PICS) is rewritten so the game knows which people have one.

    python3 tools/cut_portraits.py          (every line of tools/portraits.txt: "name: file in ~/Pictures/NeuroPets Art Assets/Tutors")
"""
import os, re, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cut_icon_sheet import cut_cell                       # the same background flood the icons use

APP = os.path.dirname(HERE)
OUT = os.path.join(APP, "ui", "pet", "art", "people")
SRC = os.path.expanduser("~/Pictures/NeuroPets Art Assets/Tutors")
HEIGHT = 480

def despill(fig):
    """A glow (Tamsin's orb, Wren's bow) is painted over the magenta, so it's left in a mauve haze around the figure. Grow in
    from the cleared background through what still leans magenta (red and blue above green) and clear it; the growing stops
    where green takes over (the glow itself) or at the black outline, so nothing inside the figure -- skin, lips -- is reached."""
    from collections import deque
    px = fig.load(); W, H = fig.size
    leans = lambda c: c[3] and max(c[:3]) > 70 and c[0] - c[1] >= 6 and c[2] - c[1] >= -6
    q = deque((x, y) for y in range(H) for x in range(W) if px[x, y][3] == 0)
    seen = set(q)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen:
                seen.add((nx, ny))
                c = px[nx, ny]
                if leans(c): px[nx, ny] = c[:3] + (0,); q.append((nx, ny))
    return fig

def main():
    os.makedirs(OUT, exist_ok=True)
    done = []
    for line in open(os.path.join(HERE, "portraits.txt"), encoding="utf-8"):
        m = re.match(r"\s*([a-z]+)\s*:\s*(.+?)\s*$", line)
        if not m or line.lstrip().startswith("#"): continue
        name, f = m.groups()
        src = os.path.join(SRC, f)
        if not os.path.exists(src): print("  waiting  %s (%s)" % (name, f)); continue
        im = Image.open(src).convert("RGB")
        if im.width > 1024: im = im.resize((1024, round(im.height * 1024 / im.width)), Image.LANCZOS)   # quicker flood, plenty for 480 px
        fig = despill(cut_cell(im, inset=4))
        fig = fig.crop(fig.getchannel("A").getbbox())
        fig = fig.resize((round(fig.width * HEIGHT / fig.height), HEIGHT), Image.LANCZOS)
        fig.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=88, method=6)
        done.append(name); print("  %-10s %dx%d" % (name, fig.width, fig.height))
    have = sorted(n[:-5] for n in os.listdir(OUT) if n.endswith(".webp"))
    with open(os.path.join(OUT, "manifest.js"), "w") as fh:
        fh.write("// Made by tools/cut_portraits.py -- the people with a full-height portrait (art/people/<name>.webp).\n")
        fh.write("window.PEOPLE_PICS = {%s};\n" % ", ".join('"%s": 1' % n for n in have))
    print("%d cut; %d people have a portrait" % (len(done), len(have)))

if __name__ == "__main__":
    main()
