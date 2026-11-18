#!/usr/bin/env python3
"""Fill see-through holes inside a cut picture (2026-11-18, Cam, PT59 c7: "the milkshake vending machine, the sides
are see through and i can see the floor underneath"). The pink machine was painted on the pink template, so the cutter
took parts of its own panels for background. Everything inside the thing's outline is made solid again: the outside is
flooded in from the edges over the clear pixels, whatever the flood can't reach is inside, and each inside pixel that
isn't fully solid gets the colour of the painted panel around it (only light, solid pixels count, so the dark outlines
don't bleed in). Run make_cafe_fabric.py on the same pictures afterwards, so their swatch layer covers the filled part.

    python3 tools/fix_cafe_holes.py shakevend-l shakevend-r shakevend-bl shakevend-br
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "cafe", "art")


def fill_holes(im):
    im = im.convert("RGBA")
    W, H = im.size
    a = im.getchannel("A")
    # the outside: flooded from a 1px clear frame over pixels under half solid
    solid = a.point(lambda v: 255 if v >= 128 else 0)
    pad = Image.new("L", (W + 2, H + 2), 0)
    pad.paste(solid, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    outside = pad.crop((1, 1, W + 1, H + 1)).point(lambda v: 255 if v == 128 else 0)
    near_out = outside.filter(ImageFilter.MaxFilter(5))          # keep the soft edge against the outside as it is
    # pixels that count as panel colour: solid and not dark (the outlines stay out of the fill)
    px, ap = im.load(), a.load()
    no = near_out.load()
    body = [[None] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            r, g, b, al = px[x, y]
            if al >= 250 and max(r, g, b) >= 120:
                body[y][x] = (r, g, b)
    filled = 0
    out = im.copy()
    op = out.load()
    mask = Image.new("L", (W, H), 0)
    fm = mask.load()
    for y in range(H):
        for x in range(W):
            if no[x, y] or ap[x, y] >= 250:
                continue
            col = None
            for rad in (2, 4, 7, 11, 16, 24, 40):                 # the nearest ring with panel colour in it
                n, sr, sg, sb = 0, 0, 0, 0
                for yy in range(max(0, y - rad), min(H, y + rad + 1)):
                    row = body[yy]
                    for xx in range(max(0, x - rad), min(W, x + rad + 1)):
                        c = row[xx]
                        if c:
                            n += 1; sr += c[0]; sg += c[1]; sb += c[2]
                if n >= 6:
                    col = (sr / n, sg / n, sb / n)
                    break
            if col is None:
                continue
            r, g, b, al = px[x, y]
            k = al / 255
            op[x, y] = (int(r * k + col[0] * (1 - k)), int(g * k + col[1] * (1 - k)), int(b * k + col[2] * (1 - k)), 255)
            fm[x, y] = 255
            filled += 1
    # soften the fill so it reads as one painted panel, not streaks (only the filled pixels change)
    soft = out.filter(ImageFilter.GaussianBlur(2.5))
    out = Image.composite(soft, out, mask.filter(ImageFilter.MinFilter(3)))
    return out, filled


def main(ids):
    for pid in ids:
        path = os.path.join(ART, pid + ".webp")
        out, n = fill_holes(Image.open(path))
        out.save(path, "WEBP", quality=90, method=6)
        print(f"{pid}: {n} pixels filled")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
