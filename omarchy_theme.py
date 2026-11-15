"""NeuroNet's "Follow Omarchy" theme: NeuroNet's colours, worked out from
whichever Omarchy theme is in use.

Cam: "Colours follow omarchy is a wicked idea for greater integration with
the system."

Omarchy keeps the current theme's palette in
~/.local/state/omarchy/current/theme/colors.toml: background, foreground,
accent and the sixteen terminal colours. NeuroNet's themes (ui/crux/theme.js)
are a set of CSS custom properties -- --bg, --panel, --ink, --accent ...
This turns the first into the second:

  * surfaces (--panel, --elevated, --hover, --active, --line...) are the
    background stepped towards the foreground, so they stay in the theme's
    own family, light theme or dark;
  * text (--ink, --text, --muted, --faint) is the foreground stepped back
    towards the background;
  * --accent is the theme's accent; the text ON it is whichever of the
    theme's background and foreground reads better against it (some themes'
    accents are pale -- Kanagawa's is nearly cream);
  * --good / --danger / --star come from the terminal's green / red / yellow
    slots, but only when those really are green, red and yellow -- several
    themes use the "green" slot for their accent (Harbor Dark's is red).
    Otherwise NeuroNet's own are kept.

It is recomputed each time it's asked for, so a theme change shows the next
time NeuroNet asks: at start-up, and when the Omarchy theme-set hook
(~/.config/omarchy/hooks/theme-set.d/neuronet-theme) tells a running
NeuroNet to look again. test/test_omarchy_theme.py checks every stock theme
for readable text.
"""
import colorsys
import os

try:
    import tomllib
except ImportError:              # Python < 3.11
    tomllib = None


def colors_path():
    return os.path.expanduser("~/.local/state/omarchy/current/theme/colors.toml")


def theme_name_path():
    return os.path.expanduser("~/.local/state/omarchy/current/theme.name")


def read_colors(path=None):
    path = path or colors_path()
    with open(path, "rb") as f:
        if tomllib:
            return tomllib.load(f)
        out = {}                 # colors.toml is flat key = "value" lines
        for line in f.read().decode("utf-8").splitlines():
            k, sep, v = line.partition("=")
            if sep:
                out[k.strip()] = v.strip().strip('"')
        return out


# ---- colour arithmetic -------------------------------------------------------

def rgb(hexstr):
    h = str(hexstr or "").strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        raise ValueError("not a colour: %r" % hexstr)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hexc(c):
    return "#%02X%02X%02X" % tuple(max(0, min(255, round(v))) for v in c)


def mix(a, b, t):
    """a moved t of the way to b."""
    a, b = rgb(a), rgb(b)
    return hexc(tuple(a[i] + (b[i] - a[i]) * t for i in range(3)))


def rgba(c, alpha):
    r, g, b = rgb(c)
    return "rgba(%d, %d, %d, %s)" % (r, g, b, alpha)


def luminance(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb(c)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def hue_sat(c):
    r, g, b = (v / 255 for v in rgb(c))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return h * 360, s


def _pick(cands, lo, hi, fallback):
    """The first candidate whose hue is in [lo, hi) and isn't grey."""
    for c in cands:
        try:
            h, s = hue_sat(c)
        except (ValueError, TypeError):
            continue
        inside = lo <= h < hi if lo < hi else (h >= lo or h < hi)
        if inside and s > 0.25:
            return hexc(rgb(c))
    return fallback


def _readable_on(bg, want, cands):
    """The first candidate that reaches `want` contrast on bg, else the best."""
    best = max(cands, key=lambda c: contrast(c, bg))
    for c in cands:
        if contrast(c, bg) >= want:
            return c
    return best


def _readable_mix(fg, bg, t, want):
    """fg moved t towards bg -- but no further than still reads at `want`."""
    while t > 0 and contrast(mix(fg, bg, t), bg) < want:
        t = round(t - 0.04, 2)
    return mix(fg, bg, max(t, 0))


def theme_vars(colors):
    bg = hexc(rgb(colors.get("background") or "#1B1B1B"))
    fg = hexc(rgb(colors.get("foreground") or "#EEEEEE"))
    accent = hexc(rgb(colors.get("accent") or colors.get("color4") or "#C7392C"))
    dark = luminance(bg) < luminance(fg)

    # a theme whose foreground barely differs from its background is broken;
    # fall back to white/black text rather than an unreadable app
    if contrast(fg, bg) < 4.5:
        fg = "#F5F5F5" if dark else "#111111"

    # newer themes name their colours (green, red ...); older ones only have
    # the terminal's numbered slots
    c = lambda n: colors.get("color%d" % n) or ""
    named = lambda k: [colors.get(k) or "", colors.get("bright_" + k) or ""]
    base_good, base_danger, base_star = (
        ("#6FBF8B", "#E0616B", "#D9A441") if dark else ("#3F8F6F", "#B33B37", "#C08A2E"))

    # on light themes the accent may be too pale to carry text or to be seen
    # as a link; deepen it until it reads (at most a few steps)
    acc = accent
    for _ in range(6):
        if contrast(acc, bg) >= 3:
            break
        acc = mix(acc, fg, 0.18)

    on_accent = _readable_on(acc, 4.5, [fg, bg, "#FFFFFF", "#000000"])
    toward = "#FFFFFF" if dark else "#000000"
    good = _pick(named("green") + [c(2), c(10)], 70, 170, base_good)
    danger = _pick(named("red") + [c(1), c(9)], 330, 25, base_danger)

    return {
        "--bg": bg,
        "--panel": mix(bg, fg, 0.035),
        "--elevated": mix(bg, fg, 0.07),
        "--hover": mix(bg, fg, 0.10),
        "--active": mix(bg, fg, 0.14),
        "--line": mix(bg, fg, 0.13),
        "--line-strong": mix(bg, fg, 0.24),
        "--ink": fg,
        "--text": mix(fg, bg, 0.12),
        # (audit UX-1, 2026-10-19: muted text sits on panels and cards, not only the page, and measured 3.6:1 there -- so
        # it now reads against the lightest surface it lands on, and at 5:1, not the 4.5 floor)
        "--muted": _readable_mix(fg, mix(bg, fg, 0.10), 0.36, 5.0),
        "--faint": mix(fg, bg, 0.55),
        "--accent": acc,
        "--accent-hover": mix(acc, toward, 0.15),
        "--accent-deep": mix(acc, "#000000", 0.28),
        "--accent-tint": rgba(acc, 0.16),
        "--on-accent": on_accent,
        "--good": good,
        "--danger": danger,
        "--danger-tint": rgba(danger, 0.15),
        "--star": _pick(named("yellow") + [c(3), c(11)], 30, 65, base_star),
        "--scheme": "dark" if dark else "light",
    }


def current():
    """{name, vars, swatch} for the Omarchy theme in use, or {error}."""
    try:
        colors = read_colors()
    except (OSError, ValueError) as e:
        return {"error": "Couldn't read Omarchy's theme: %s" % e}
    try:
        with open(theme_name_path(), encoding="utf-8") as f:
            name = f.read().strip()
    except OSError:
        name = ""
    try:
        v = theme_vars(colors)
    except (ValueError, TypeError) as e:
        return {"error": "Omarchy's theme colours didn't make sense: %s" % e}
    return {"name": name, "vars": v,
            "swatch": [v["--bg"], v["--elevated"], v["--accent"], v["--ink"]]}
