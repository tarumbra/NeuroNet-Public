#!/usr/bin/env python3
"""NeuroNet's "Follow Omarchy" theme (omarchy_theme.py).

Cam: "Colours follow omarchy is a wicked idea for greater integration with
the system."

Every Omarchy theme installed on this computer is turned into NeuroNet's
colours and checked for readable text: body text, muted text, text on the
accent, and the accent itself against the background. Newer themes name their
colours (green, red ...); older ones only have the terminal's numbered slots
-- both are checked. The page half (repainting on the hook's call) is in
test_omarchy_integration.js.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import glob
import os
import sys
import tempfile

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, APP)
import omarchy_theme as ot  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + detail if detail else ""))


NEEDED = ["--bg", "--panel", "--elevated", "--hover", "--active", "--line", "--line-strong",
          "--ink", "--text", "--muted", "--faint", "--accent", "--accent-hover", "--accent-deep",
          "--accent-tint", "--on-accent", "--good", "--danger", "--danger-tint", "--star", "--scheme"]

themes = sorted(glob.glob("/usr/share/omarchy/themes/*/colors.toml")
                + glob.glob(os.path.expanduser("~/.config/omarchy/themes/*/colors.toml")))
if not themes:
    print("  skip  no Omarchy themes on this computer")
for path in themes:
    name = os.path.basename(os.path.dirname(path))
    v = ot.theme_vars(ot.read_colors(path))
    missing = [k for k in NEEDED if k not in v]
    problems = []
    if ot.contrast(v["--ink"], v["--bg"]) < 4.5:
        problems.append("ink %.1f" % ot.contrast(v["--ink"], v["--bg"]))
    for surf in ("--bg", "--panel", "--elevated", "--hover"):   # (audit UX-1: muted text reads on every surface it sits on)
        if ot.contrast(v["--muted"], v[surf]) < 5.0:
            problems.append("muted on %s %.1f" % (surf, ot.contrast(v["--muted"], v[surf])))
    if ot.contrast(v["--on-accent"], v["--accent"]) < 4.5:
        problems.append("on-accent %.1f" % ot.contrast(v["--on-accent"], v["--accent"]))
    if ot.contrast(v["--accent"], v["--bg"]) < 2.5:
        problems.append("accent %.1f" % ot.contrast(v["--accent"], v["--bg"]))
    ok("%s: every colour, all readable" % name, not missing and not problems,
       "missing %s; %s" % (missing, ", ".join(problems)))

# the two colours.toml shapes
named = {"background": "#1e1e2e", "foreground": "#cdd6f4", "accent": "#89b4fa",
         "green": "#a6e3a1", "red": "#f38ba8", "yellow": "#f9e2af"}
v = ot.theme_vars(named)
ok("named colours (newer themes) become good / danger / star",
   (v["--good"], v["--danger"], v["--star"]) == ("#A6E3A1", "#F38BA8", "#F9E2AF"), str(v))
numbered = {"background": "#1B1B1B", "foreground": "#efebdc", "accent": "#e75a50",
            "color1": "#F44336", "color2": "#e75a50", "color3": "#a99b7a"}
v = ot.theme_vars(numbered)
ok("a 'green' slot that isn't green (Harbor Dark's is red) is not used as green",
   v["--good"] == "#6FBF8B" and v["--danger"] == "#F44336", str(v))
v = ot.theme_vars({"background": "#ffffff", "foreground": "#111111", "accent": "#f0f0a0"})
ok("a pale accent on a light theme is deepened until it can be seen",
   ot.contrast(v["--accent"], v["--bg"]) >= 3 and v["--scheme"] == "light", str(v))
v = ot.theme_vars({"background": "#222222", "foreground": "#2a2a2a", "accent": "#e75a50"})
ok("a theme with unreadable text gets readable text instead", ot.contrast(v["--ink"], v["--bg"]) >= 4.5)

# current(): reads the files Omarchy keeps for the theme in use
tmp = tempfile.mkdtemp()
cp = os.path.join(tmp, "colors.toml")
with open(cp, "w") as f:
    f.write('background = "#101010"\nforeground = "#f0f0f0"\naccent = "#e68e0d"\n')
with open(os.path.join(tmp, "theme.name"), "w") as f:
    f.write("matte-black\n")
ot.colors_path, ot.theme_name_path = (lambda: cp), (lambda: os.path.join(tmp, "theme.name"))
res = ot.current()
ok("current() gives the theme's name, colours and a swatch",
   res.get("name") == "matte-black" and res["vars"]["--accent"] == "#E68E0D" and len(res["swatch"]) == 4, str(res))
ot.colors_path = lambda: os.path.join(tmp, "nope.toml")
ok("no Omarchy theme file -> an error, not a crash", "error" in ot.current())

# NeuroNet's own named themes (ui/crux/theme.js): the same rule for their muted text (audit UX-1, 2026-10-19)
import re as _re
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "crux", "theme.js"), encoding="utf-8").read()
_blocks = _re.split(r"\n\s*(\w+):\s*\{\s*\n?\s*name:", _src)[1:]
for _i in range(0, len(_blocks), 2):
    _v = dict(_re.findall(r'"(--[a-z-]+)":\s*"(#[0-9A-Fa-f]{6})"', _blocks[_i + 1] or ""))
    if "--muted" not in _v:
        continue
    _bad = ["%s %.1f" % (k, ot.contrast(_v["--muted"], _v[k])) for k in ("--bg", "--panel", "--elevated", "--hover") if k in _v and ot.contrast(_v["--muted"], _v[k]) < 5.0]
    ok("theme %s: muted text reads on every surface (5:1)" % _blocks[_i], not _bad, ", ".join(_bad))

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
