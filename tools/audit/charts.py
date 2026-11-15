"""Small SVG charts for the audit reports (2026-10-18). No libraries: each function returns an <svg> string drawn in the
reports' parchment style, so the HTML prints straight to PDF through Chromium.

    bar(items, ...)        horizontal bars: [(label, value)]
    columns(items, ...)    vertical bars, optionally stacked: [(label, {series: value})]
    line(series, ...)      lines over x: {name: [(x, y)]}
    radar(axes, series)    spider chart: axes [names], series {name: [0..1 per axis]}
    donut(items, ...)      share of a whole: [(label, value)]
"""
import math
from html import escape

INK, MUTED, GRID, BG = "#3b2213", "#7a5a3a", "#d9c29a", "#f6ead2"
PALETTE = ["#8a5434", "#2f7f8f", "#4e8a2c", "#c9773d", "#7a4f9a", "#b8402a", "#2a3270", "#a8862a", "#5a6a7a", "#d0607a"]
FONT = 'font-family="Noto Sans, DejaVu Sans, sans-serif"'


def _nice(v):
    """A round number at or above v for an axis top."""
    if v <= 0:
        return 1
    e = 10 ** math.floor(math.log10(v))
    for m in (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10):
        if m * e >= v:
            return m * e
    return 10 * e


def fmt(v):
    if isinstance(v, float) and not v.is_integer():
        return f"{v:,.1f}" if abs(v) < 100 else f"{v:,.0f}"
    return f"{int(v):,}"


def _svg(w, h, body, title=""):
    t = f'<text x="0" y="14" {FONT} font-size="13" font-weight="700" fill="{INK}">{escape(title)}</text>' if title else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" role="img" aria-label="{escape(title)}">{t}{body}</svg>'


def bar(items, title="", unit="", width=640, row=22, label_w=190, color=None, colors=None, marks=None):
    """Horizontal bars. marks: {value: label} for reference lines (e.g. a target)."""
    top = 26 if title else 6
    h = top + row * len(items) + 24
    vmax = _nice(max([v for _, v in items] + list((marks or {}).keys()) + [0]))
    pw = width - label_w - 70
    out = []
    for k in range(5):
        x = label_w + pw * k / 4
        out.append(f'<line x1="{x:.1f}" y1="{top}" x2="{x:.1f}" y2="{h - 20}" stroke="{GRID}" stroke-width="1"/>'
                   f'<text x="{x:.1f}" y="{h - 6}" {FONT} font-size="10" fill="{MUTED}" text-anchor="middle">{fmt(vmax * k / 4)}{escape(unit)}</text>')
    for i, (lab, v) in enumerate(items):
        y = top + i * row
        c = (colors[i] if colors else None) or color or PALETTE[0]
        bw = pw * (v / vmax if vmax else 0)
        out.append(f'<text x="{label_w - 8}" y="{y + row * 0.68:.1f}" {FONT} font-size="11" fill="{INK}" text-anchor="end">{escape(str(lab))}</text>'
                   f'<rect x="{label_w}" y="{y + 3}" width="{max(bw, 0.5):.1f}" height="{row - 7}" rx="3" fill="{c}"/>'
                   f'<text x="{label_w + bw + 5:.1f}" y="{y + row * 0.68:.1f}" {FONT} font-size="10.5" fill="{INK}">{fmt(v)}{escape(unit)}</text>')
    for v, lab in (marks or {}).items():
        x = label_w + pw * v / vmax
        out.append(f'<line x1="{x:.1f}" y1="{top - 2}" x2="{x:.1f}" y2="{h - 20}" stroke="#b8402a" stroke-width="1.5" stroke-dasharray="4 3"/>'
                   f'<text x="{x + 3:.1f}" y="{top + 8}" {FONT} font-size="10" fill="#b8402a">{escape(lab)}</text>')
    return _svg(width, h, "".join(out), title)


def columns(items, title="", unit="", width=640, height=260, series=None, rotate=False, legend=True, log=False, grouped=False):
    """Vertical bars. items: [(label, value)] or [(label, {series: value})] stacked in `series` order (grouped=True: side by side)."""
    top = 26 if title else 8
    stacked = items and isinstance(items[0][1], dict)
    series = series or (list(dict.fromkeys(k for _, d in items for k in d)) if stacked else ["v"])
    tot = [(max if grouped else sum)(d.get(s, 0) for s in series) if stacked else d for _, d in items]
    vmax = _nice(max(tot + [0]))
    bottom = 62 if rotate else 34
    left = 52
    ph, pw = height - top - bottom - (18 if stacked and legend else 0), width - left - 10
    out = []
    for k in range(5):
        y = top + ph - ph * k / 4
        out.append(f'<line x1="{left}" y1="{y:.1f}" x2="{width - 10}" y2="{y:.1f}" stroke="{GRID}"/>'
                   f'<text x="{left - 6}" y="{y + 3:.1f}" {FONT} font-size="10" fill="{MUTED}" text-anchor="end">{fmt(vmax * k / 4)}{escape(unit)}</text>')
    n = max(len(items), 1)
    slot = pw / n
    bw = min(slot * 0.7, 46)
    for i, (lab, d) in enumerate(items):
        x = left + slot * i + (slot - bw) / 2
        y = top + ph
        parts = [(s, d.get(s, 0)) for s in series] if stacked else [("v", d)]
        if grouped and stacked:
            gw = slot * 0.8 / len(series)
            for j, (s, v) in enumerate(parts):
                hh = ph * v / vmax if vmax else 0; gx = left + slot * i + slot * 0.1 + gw * j
                out.append(f'<rect x="{gx:.1f}" y="{top + ph - hh:.1f}" width="{gw * 0.92:.1f}" height="{max(hh, 0):.1f}" fill="{PALETTE[j % len(PALETTE)]}"/>'
                           f'<text x="{gx + gw * 0.46:.1f}" y="{top + ph - hh - 3:.1f}" {FONT} font-size="8.5" fill="{INK}" text-anchor="middle">{fmt(v)}</text>')
            cx = left + slot * i + slot / 2
            if rotate:
                out.append(f'<text transform="translate({cx:.1f},{top + ph + 10}) rotate(-40)" {FONT} font-size="10" fill="{INK}" text-anchor="end">{escape(str(lab))}</text>')
            else:
                out.append(f'<text x="{cx:.1f}" y="{top + ph + 14}" {FONT} font-size="10" fill="{INK}" text-anchor="middle">{escape(str(lab))}</text>')
            continue
        for j, (s, v) in enumerate(parts):
            hh = ph * v / vmax if vmax else 0
            y -= hh
            out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{max(hh, 0):.1f}" fill="{PALETTE[j % len(PALETTE)] if stacked else PALETTE[i % len(PALETTE)] if not stacked and len(items) <= 10 else PALETTE[0]}"/>')
        out.append(f'<text x="{x + bw / 2:.1f}" y="{y - 3:.1f}" {FONT} font-size="9.5" fill="{INK}" text-anchor="middle">{fmt(tot[i])}</text>')
        cx = x + bw / 2
        if rotate:
            out.append(f'<text transform="translate({cx:.1f},{top + ph + 10}) rotate(-40)" {FONT} font-size="10" fill="{INK}" text-anchor="end">{escape(str(lab))}</text>')
        else:
            out.append(f'<text x="{cx:.1f}" y="{top + ph + 14}" {FONT} font-size="10" fill="{INK}" text-anchor="middle">{escape(str(lab))}</text>')
    if stacked and legend:
        lx = left
        for j, s in enumerate(series):
            out.append(f'<rect x="{lx}" y="{height - 14}" width="10" height="10" fill="{PALETTE[j % len(PALETTE)]}"/><text x="{lx + 14}" y="{height - 5}" {FONT} font-size="10" fill="{INK}">{escape(s)}</text>')
            lx += 22 + 6.2 * len(s)
    return _svg(width, height, "".join(out), title)


def line(series, title="", xlabel="", ylabel="", width=640, height=260, logy=False, xfmt=None, points=False, ymax=None):
    """Lines: {name: [(x, y)]}. logy draws y on a log scale (for xp curves)."""
    top = 26 if title else 8
    left, bottom = 58, 40 + (16 if len(series) > 1 else 0)
    pw, ph = width - left - 14, height - top - bottom
    xs = [x for s in series.values() for x, _ in s]
    ys = [y for s in series.values() for _, y in s if y is not None]
    x0, x1 = min(xs), max(xs)
    if logy:
        lo, hi = math.log10(max(min(y for y in ys if y > 0), 1e-9)), math.log10(max(ys))
        lo, hi = math.floor(lo), math.ceil(hi)
        Y = lambda y: top + ph - ph * ((math.log10(max(y, 10 ** lo)) - lo) / ((hi - lo) or 1))
        ticks = [10 ** e for e in range(lo, hi + 1)]
    else:
        top_v = ymax or _nice(max(ys + [0]))
        Y = lambda y: top + ph - ph * (y / top_v if top_v else 0)
        ticks = [top_v * k / 4 for k in range(5)]
    X = lambda x: left + pw * ((x - x0) / ((x1 - x0) or 1))
    out = []
    for t in ticks:
        out.append(f'<line x1="{left}" y1="{Y(t):.1f}" x2="{width - 14}" y2="{Y(t):.1f}" stroke="{GRID}"/>'
                   f'<text x="{left - 6}" y="{Y(t) + 3:.1f}" {FONT} font-size="10" fill="{MUTED}" text-anchor="end">{fmt(t)}</text>')
    for k in range(6):
        xv = x0 + (x1 - x0) * k / 5
        out.append(f'<text x="{X(xv):.1f}" y="{top + ph + 14}" {FONT} font-size="10" fill="{MUTED}" text-anchor="middle">{escape(xfmt(xv) if xfmt else fmt(round(xv, 1)))}</text>')
    for j, (name, pts) in enumerate(series.items()):
        c = PALETTE[j % len(PALETTE)]
        d = " ".join(f"{'M' if i == 0 else 'L'}{X(x):.1f},{Y(y):.1f}" for i, (x, y) in enumerate(pts) if y is not None)
        out.append(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="2.2" stroke-linejoin="round"/>')
        if points:
            out.extend(f'<circle cx="{X(x):.1f}" cy="{Y(y):.1f}" r="2.6" fill="{c}"/>' for x, y in pts if y is not None)
    if xlabel:
        out.append(f'<text x="{left + pw / 2}" y="{top + ph + 28}" {FONT} font-size="10.5" fill="{INK}" text-anchor="middle">{escape(xlabel)}</text>')
    if ylabel:
        out.append(f'<text transform="translate(12,{top + ph / 2}) rotate(-90)" {FONT} font-size="10.5" fill="{INK}" text-anchor="middle">{escape(ylabel)}</text>')
    if len(series) > 1:
        lx = left
        for j, name in enumerate(series):
            out.append(f'<rect x="{lx}" y="{height - 12}" width="12" height="4" fill="{PALETTE[j % len(PALETTE)]}"/><text x="{lx + 16}" y="{height - 6}" {FONT} font-size="10" fill="{INK}">{escape(name)}</text>')
            lx += 26 + 6.2 * len(name)
    return _svg(width, height, "".join(out), title)


def radar(axes, series, title="", size=420):
    """A spider chart: each series a list of 0..1 per axis."""
    top = 26 if title else 6
    legend = 18 * ((len(series) + 2) // 3)
    w, h = size + 160, size + top + legend
    cx, cy, r = w / 2, top + size / 2, size / 2 - 50
    n = len(axes)
    pt = lambda i, v: (cx + r * v * math.sin(2 * math.pi * i / n), cy - r * v * math.cos(2 * math.pi * i / n))
    out = []
    for ring in (0.25, 0.5, 0.75, 1):
        out.append('<polygon points="' + " ".join(f"{x:.1f},{y:.1f}" for x, y in (pt(i, ring) for i in range(n))) + f'" fill="none" stroke="{GRID}"/>')
    for i, a in enumerate(axes):
        x, y = pt(i, 1)
        lx, ly = pt(i, 1.13)
        anchor = "middle" if abs(lx - cx) < 8 else ("start" if lx > cx else "end")
        out.append(f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="{GRID}"/>'
                   f'<text x="{lx:.1f}" y="{ly + 4:.1f}" {FONT} font-size="10.5" fill="{INK}" text-anchor="{anchor}">{escape(a)}</text>')
    for j, (name, vals) in enumerate(series.items()):
        c = PALETTE[j % len(PALETTE)]
        out.append('<polygon points="' + " ".join(f"{x:.1f},{y:.1f}" for x, y in (pt(i, v) for i, v in enumerate(vals))) + f'" fill="{c}" fill-opacity=".12" stroke="{c}" stroke-width="2"/>')
    for j, name in enumerate(series):
        lx, ly = 20 + (j % 3) * (w - 40) / 3, size + top + 4 + 18 * (j // 3)
        out.append(f'<rect x="{lx:.1f}" y="{ly:.1f}" width="12" height="12" fill="{PALETTE[j % len(PALETTE)]}"/><text x="{lx + 17:.1f}" y="{ly + 10:.1f}" {FONT} font-size="11" fill="{INK}">{escape(name)}</text>')
    return _svg(w, h, "".join(out), title)


def donut(items, title="", size=230, unit=""):
    """Share of a whole, with a legend to the right."""
    top = 26 if title else 4
    w, h = size + 280, max(size, 18 * len(items) + 10) + top
    cx, cy, r, ir = size / 2, top + size / 2, size / 2 - 6, size / 4
    tot = sum(v for _, v in items) or 1
    a = -math.pi / 2
    out = []
    for j, (lab, v) in enumerate(items):
        b = a + 2 * math.pi * v / tot
        large = 1 if b - a > math.pi else 0
        p = lambda ang, rr: (cx + rr * math.cos(ang), cy + rr * math.sin(ang))
        (x1, y1), (x2, y2), (x3, y3), (x4, y4) = p(a, r), p(b, r), p(b, ir), p(a, ir)
        if v >= tot:
            out.append(f'<circle cx="{cx}" cy="{cy}" r="{(r + ir) / 2}" fill="none" stroke="{PALETTE[j % len(PALETTE)]}" stroke-width="{r - ir}"/>')
        else:
            out.append(f'<path d="M{x1:.1f},{y1:.1f} A{r},{r} 0 {large} 1 {x2:.1f},{y2:.1f} L{x3:.1f},{y3:.1f} A{ir},{ir} 0 {large} 0 {x4:.1f},{y4:.1f} Z" fill="{PALETTE[j % len(PALETTE)]}"/>')
        ly = top + 8 + j * 18
        out.append(f'<rect x="{size + 16}" y="{ly}" width="12" height="12" fill="{PALETTE[j % len(PALETTE)]}"/>'
                   f'<text x="{size + 34}" y="{ly + 10}" {FONT} font-size="11" fill="{INK}">{escape(str(lab))}: {fmt(v)}{escape(unit)} ({100 * v / tot:.0f}%)</text>')
        a = b
    out.append(f'<text x="{cx}" y="{cy + 5}" {FONT} font-size="15" font-weight="700" fill="{INK}" text-anchor="middle">{fmt(tot)}{escape(unit)}</text>')
    return _svg(w, h, "".join(out), title)


def heat(rows, cols, values, title="", cell=26, label_w=200, lo_color=(246, 234, 210), hi_color=(78, 138, 44)):
    """A grid of 0..1 values (rows x cols), for the similarity matrix."""
    top = (26 if title else 4) + 90
    w, h = label_w + cell * len(cols) + 10, top + cell * len(rows) + 6
    out = []
    for j, c in enumerate(cols):
        x = label_w + j * cell + cell / 2
        out.append(f'<text transform="translate({x:.1f},{top - 6}) rotate(-55)" {FONT} font-size="10" fill="{INK}">{escape(c)}</text>')
    for i, r in enumerate(rows):
        y = top + i * cell
        out.append(f'<text x="{label_w - 6}" y="{y + cell * 0.65:.1f}" {FONT} font-size="10" fill="{INK}" text-anchor="end">{escape(r)}</text>')
        for j in range(len(cols)):
            v = values[i][j]
            col = tuple(round(lo_color[k] + (hi_color[k] - lo_color[k]) * v) for k in range(3))
            out.append(f'<rect x="{label_w + j * cell + 1}" y="{y + 1}" width="{cell - 2}" height="{cell - 2}" rx="3" fill="rgb{col}"/>')
    return _svg(w, h, "".join(out), title)
