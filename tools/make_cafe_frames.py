#!/usr/bin/env python3
"""NeuroCafe paintings' frames, for their paints (PT56, Cam: "the custom photo frames work, but not the other ones"). A
painting's frame is painted into its picture, so the frame's ring is cut out as <pic>-fab.webp: the picture's slanted
outline, less the canvas inside it. The game tints that layer over the painting, like the furniture's -fab layers.

The canvas starts the same way in on every one of Gemini's frames (measured by eye, PT56 round 4: finding it by colour
stopped at a frame's dark side and left its face bare, Cam's "didn't really work"): a share of the picture's width
in from the left and right, of its height down from the top and up from the bottom -- the ornate ones deeper.

    python3 tools/make_cafe_frames.py
"""
import glob
import json
import os

from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "ui", "cafe", "art")
MARGIN = {"l": 0.135, "r": 0.13, "t": 0.13, "b": 0.135}
DEEPER = {"painting-hw1": {"l": 0.175, "r": 0.17, "t": 0.16, "b": 0.17}, "painting-hw8": {"l": 0.14, "r": 0.14, "t": 0.13, "b": 0.14}}


def outline(pic):
    """The picture's slanted outline: its first and last columns, and each column's top and bottom."""
    a = pic.getchannel("A").load()
    W, H = pic.size
    top, bot = {}, {}
    for x in range(W):
        ys = [y for y in range(H) if a[x, y] > 128]
        if ys:
            top[x], bot[x] = ys[0], ys[-1]
    return min(top), max(top), top, bot


def frame(pic, m):
    """The frame's ring: everything inside the outline but outside the canvas (m: the four shares), soft-edged."""
    x0, x1, top, bot = outline(pic)
    a = pic.getchannel("A").load()
    mask = Image.new("L", pic.size, 0)
    mp = mask.load()
    for x in top:
        u = (x - x0) / (x1 - x0)
        for y in range(pic.height):
            if a[x, y] < 10:
                continue
            v = (y - top[x]) / max(1, bot[x] - top[x])
            if not (m["l"] < u < 1 - m["r"] and m["t"] < v < 1 - m["b"]):
                mp[x, y] = a[x, y]
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    out = pic.copy()
    out.putalpha(Image.composite(mask, Image.new("L", pic.size, 0), pic.getchannel("A").point(lambda v: 255 if v > 10 else 0)))
    return out


def main():
    man_path = os.path.join(OUT, "manifest.js")
    text = open(man_path, encoding="utf-8").read()
    head, rest = text.split("window.CafeArtFiles = ", 1)
    files_json, tail = rest.split(";\n", 1)
    sizes = json.loads(files_json)
    for f in sorted(glob.glob(os.path.join(OUT, "painting-*.webp"))):
        pid = os.path.basename(f)[:-5]
        if pid.endswith("-fab"):
            continue
        fab = frame(Image.open(f).convert("RGBA"), DEEPER.get(pid, MARGIN))
        fab.save(os.path.join(OUT, pid + "-fab.webp"), "WEBP", quality=92, method=6)
        sizes[pid + "-fab"] = list(fab.size)
        print(f"  {pid}-fab.webp")
    with open(man_path, "w", encoding="utf-8") as fh:
        fh.write(head + "window.CafeArtFiles = " + json.dumps(dict(sorted(sizes.items())), separators=(",", ":")) + ";\n" + tail)


if __name__ == "__main__":
    main()
