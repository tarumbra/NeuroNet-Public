"""NeuroNet as one app -- the decisions that made it work, kept from coming back.

Each check below is a specific fix. Undo one and a real bug returns:

  the bar          lived inside music; now across the top of every tool
  empty bar        its player and clock only started when music was opened
  cut-off bottom   at UI scale 150%+ the app overflowed the window
  text size        "Larger" grew text by 0% outside music (fixed px sizes)
  clock covered    the player floated over the clock at high UI scale
  grid overridden  a later stylesheet silently won and the grid never applied
  Cranium          its logo, name and second clock duplicated the app's
  menu             collapses to icons, each named on hover

Layout itself needs a real browser; these read the code the layout rests on.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
UI = os.path.join(os.path.dirname(HERE), "ui")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def read(p):
    return open(os.path.join(UI, p), encoding="utf-8").read()


def code(t):
    return re.sub(r"/\*.*?\*/", "", t, flags=re.S)


print("\nNeuroNet as one app\n")
html, app = read("index.html"), read("app.js")
shared = code(read("shared.css"))

# ---- the bar ------------------------------------------------------------
ok("the bar sits in the app-wide top strip, not inside music",
   0 <= html.find('id="ss-topbar"') < html.find('id="ch-top-bar"') < html.find('id="ss-stage"'))
ch_shell = html[html.find('<div id="ch-shell"'):] if '<div id="ch-shell"' in html else ""
ok("and is no longer inside the music section", 'id="ch-top-bar"' not in ch_shell)
ok("every tool is drawn in the stage beneath it",
   all(0 <= html.find('id="ss-stage"') < html.find(f'id="{i}"')
       for i in ("ss-main", "cf-shell", "cx-shell", "cr-shell", "cs-shell")))   # (ch-shell went with the music, 19 Nov 2026)
ok("the bar's styles are applied at its new home", 'href="topbar.css"' in html)

# ---- the bar is filled from launch: its clock has a file of its own since the music left (19 Nov 2026) ----
ok("the bar's clock is its own file, loaded with the page", '<script src="topbar.js"></script>' in html
   and "ch-top-bar-clock" in read("topbar.js"))
ok("  and nothing starts music at launch any more", "SS.Music.start()" not in app)

# ---- UI scale -----------------------------------------------------------
ok("UI scale exists, 90% to 200%", "const UI_SCALES = [0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];" in app)
ok("it is applied before the first paint", "ss:uiScale" in html and "documentElement.style.zoom" in html)
ok("the app fills its container, not the window height (cut off at 150%+)",
   re.search(r"#ss-app\s*\{[^}]*height:\s*100%", shared) is not None
   and re.search(r"#ss-app\s*\{[^}]*height:\s*100vh", shared) is None)
ok("Training's Lens and Notes fill the space under the bar",
   "height: 100vh" not in code(read("training/training.css")).split("#cf-lens.tool")[1][:200]
   and "height: 100vh" not in code(read("notes/notes.css")).split("#cx-shell #cx-app")[1][:120])

# ---- Text size reaches every tool --------------------------------------
fixed = {f: len(re.findall(r"font-size\s*:\s*\d+(?:\.\d+)?px", code(read(f))))
         for f in ("shared.css", "training/training.css",
                   "notes/notes.css", "games/cranium.css", "cards/celestial.css")}
ok("no fixed-pixel text sizes left for Text size to miss",
   not any(fixed.values()), {k: v for k, v in fixed.items() if v})

# ---- the bar's layout ---------------------------------------------------
ok("the bar is three columns, so its parts cannot overlap",
   re.search(r"#ss-app #ss-topbar #ch-top-bar\s*\{[^}]*display:\s*grid", shared) is not None)
ok("with enough weight to beat topbar.css, which loads later",
   "#ss-app #ss-topbar #ch-top-bar" in shared)
ok("all three parts on one row", "grid-row: 1" in shared)
ok("the player's column never shrinks below its controls",
   "minmax(min-content, 1fr) auto minmax(0, 1fr)" in shared)
ok("the clock fits itself to the bar, stepping down only if it overflows",
   "const FORMS = [" in read("topbar.js") and "bar.scrollWidth <= bar.clientWidth" in read("topbar.js"))

# ---- Cranium ------------------------------------------------------------
cr = code(read("games/cranium.css"))
ok("Cranium's logo, name and clock are hidden",
   re.search(r"#cr-shell #cr-brand,\s*#cr-shell #cr-clock\s*\{\s*display:\s*none", cr) is not None)
# A guard against OVER-hiding: removing the branding must not take the game's
# own controls with it. It passes on the old code too, correctly -- nothing
# was hidden there. It reads EVERY hiding rule, not just the last one.
hidden = " ".join(re.findall(r"([^{}]*)\{[^}]*display:\s*none", cr))
ok("its game title, buttons and zoom are not hidden",
   not any(k in hidden for k in ("#cr-zoom", "#cr-topbar-actions", "#cr-topbar-title")),
   hidden[:200])

# ---- the collapsible menu ----------------------------------------------
ok("the menu has a collapse button", 'id="ss-collapse"' in html)
ok("collapsed, each button is named from its own label", "function labelNav()" in app and "dataset.autoTitle" in app)
ok("a title a button already had is left alone", "!b.dataset.autoTitle) continue" in app)
ok("the choice is remembered", "setPrefs({navCollapsed})" in app)

# ---- two menus, a location bar, and F9 ---------------------------------
ok("the left menu holds main sections, the right their subsections",
   'id="ss-subnav"' in html and "function renderSubnav(" in app and "data-section=" in app)
def element_span(text, start_tag, tag="div"):
    """Where an element starts and ends, matched by tag depth -- not by
    searching for a closing tag, which is how the right menu and the bottom
    bar both ended up INSIDE Notes' shell and invisible everywhere else."""
    i = text.index(start_tag)
    depth, j = 0, i
    pat = re.compile(rf"<{tag}\b|</{tag}>")
    while True:
        m = pat.search(text, j)
        depth += 1 if m.group(0) == f"<{tag}" else -1
        j = m.end()
        if depth == 0:
            return i, j

stage_i, stage_j = element_span(html, '<div id="ss-stage">')
stage = html[stage_i:stage_j]
ok("the right menu is in the stage", 'id="ss-subnav"' in stage)
shells = [sh for sh in ("cx-shell", "cf-shell", "ch-shell", "cr-shell", "cs-shell")
          if f'<div id="{sh}"' in html]
inside = [sh for sh in shells
          if 'id="ss-subnav"' in html[slice(*element_span(html, f'<div id="{sh}"'))]
          or 'id="ss-bottombar"' in html[slice(*element_span(html, f'<div id="{sh}"'))]]
ok("neither the right menu nor the bottom bar is inside a tool's shell",
   not inside, "inside: " + ", ".join(inside))
col_i, col_j = element_span(html, '<div id="ss-column">')
ok("the bottom bar is the last thing in the column",
   'id="ss-bottombar"' in html[col_i:col_j]
   and html[col_i:col_j].index('id="ss-stage"') < html[col_i:col_j].index('id="ss-bottombar"'))
ok("the bottom bar says where you are",
   'id="ss-bottombar"' in html and "function renderCrumb(" in app and '" — "' in app)
ok("F9 hides every bar", 'e.key !== "F9"' in app and "bars-hidden" in shared)
ok("  ...and the music keeps playing (hiding is only a style change)",
   re.search(r"#ss-app\.bars-hidden[^{]*\{[^}]*display:\s*none", shared) is not None
   and "pause" not in app[app.index("function applyBarsHidden"):app.index("function applyNavCollapsed")])
ok("both menus collapse to icons", "applySubnavCollapsed" in app and "subnav-collapsed" in shared)
ok("a collapsed card still shows its icon",
   ":not(.ss-card-ic) { display: none; }" in shared)
ok("cards are drawn in Cam's Collective's style: stripe, icon tile, name",
   ".ss-card::before" in shared and ".ss-card .ss-card-ic" in shared and "--card-accent" in shared)
ok("resting, hovered and chosen all look different",
   ".ss-card:hover" in shared and ".ss-card.on" in shared)
ok("a section reopens where it was left", "lastViewBySection" in app)

# ---- the icons Cam asked for -------------------------------------------
ok("the treble clef drawing is still there (Music itself went to NeuroStream, 19 Nov 2026)", 'id="i-clef"' in html
   and re.search(r'music:\s*\{icon:\s*"i-clef"', app) is None)
ok("Photos uses what used to be Music's icon (a framed picture)",
   re.search(r'photos:\s*\{icon:\s*"i-album"', app) is not None)
ok("  and the clef is a real drawing, not an empty shape",
   len(re.search(r'<g id="i-clef">(.*?)</g>', html, re.S).group(1)) > 80)

# ---- no tool scales the whole app behind Cam's back --------------------
# Cranium's zoom set the PAGE's base font size. Once every tool's text was
# measured in rem, that scaled the entire app — and stayed that way after
# leaving Games, while Settings showed nothing changed.
tools_js = {f: code(read(f)) for f in ("games/cranium.js", "cards/celestial.js",
                                 "music/chords.js", "notes/app.js",
                                 "training/bridge.js", "boards/editor.js")
            if os.path.isfile(os.path.join(UI, f))}
# The rule, stated simply: a tool never touches the page element. The old
# bug assigned through a variable (root.style.fontSize, where root was
# document.documentElement), so searching for the literal text
# "documentElement.style.fontSize" missed the very form the bug took.
# Reading from the page element is fine (Chords reads the theme's colours);
# WRITING to it is not, and neither is taking hold of it in a variable --
# the old bug did exactly that, then set .style.fontSize on the variable.
def touches_page(src):
    allowed = src.replace("getComputedStyle(document.documentElement)", "")
    return "documentElement" in allowed

offenders = [f for f, src in tools_js.items() if touches_page(src)]
ok("no tool writes to the page element (reading the theme is fine)",
   not offenders, offenders)
ok("Cranium's zoom lives on its own shell",
   'shell.style.setProperty("--z", z);' in tools_js["games/cranium.js"])
ok("and its text multiplies by that zoom there",
   "var(--z, 1)" in read("games/cranium.css"))
ok("only Settings changes the whole app's size",
   "document.documentElement.style.zoom = v;" in app
   and app.count("documentElement.style.zoom") == 1)

# ---- the three fixes Cam asked for -------------------------------------
# Collapsing the LEFT menu used to strip the names from the RIGHT one while
# leaving it full width: the nav-collapsed rules were not scoped to the left.
leaks = [sel for sel in re.findall(r"(?m)^(#ss-app\.nav-collapsed[^,{]*)[,{]", shared)
         # The left menu's own furniture counts as the left menu: its brand,
         # its collapse button, and the two buttons in its foot.
         if not any(k in sel for k in ("#ss-sidebar", "#ss-collapse", "#ss-brand",
                                       ".ss-brand-name", "#ss-add", "#ss-settings"))]
ok("collapsing the left menu only touches the left menu", not leaks, leaks)
ok("the bottom bar has room for the path to be read",
   re.search(r"#ss-bottombar\s*\{[^}]*height:\s*34px", shared) is not None
   and re.search(r"#ss-bottombar\s*\{[^}]*font-size:\s*0\.8125rem", shared) is None
   or "font-size: 0.8125rem" in shared)
ok("a Cells sheet takes the page, not a note's 460px",
   "#ss-app .grid-page .ssg-scroll" in open(os.path.join(UI, "cells/cells.css"), encoding="utf-8").read())

# ---- Training's content on a panel -------------------------------------
# Cam: "make it more align with how old Cams Collective handled the display of
# content ... only apply the UI to the workspace content." The detail pane was
# position: fixed, inset: 0 -- a full-window sheet over the menus and all.
tcss = code(read("training/training.css"))
panel = re.search(r"#cf-shell \.detail \{(.*?)\}", tcss, re.S)
ok("Training's content sits beside the list, inside the workspace",
   panel is not None and "position: relative" in panel.group(1)
   and "flex:" in panel.group(1), panel.group(1)[:90] if panel else "no rule")
# A real radius and a real background: "border-radius: 0" passed the earlier
# version of this check.
ok("  drawn as a raised panel, not flat on the page",
   panel is not None
   and re.search(r"border-radius:\s*(?!0)[0-9]", panel.group(1)) is not None
   and re.search(r"background:\s*var\(", panel.group(1)) is not None
   and "box-shadow" in panel.group(1), panel.group(1)[:100] if panel else "")
ok("  its body scrolls inside the panel", "#cf-shell .detail .detail-body { flex: 1 1 auto;" in tcss)
# Training's own container was 100dvh -- Coach Cam owned the whole window.
# The LAST rule for this selector is the one that wins; an earlier version of
# this check matched an earlier rule and missed the change entirely.
app_rules = re.findall(r"#cf-shell \.app \{([^}]*)\}", tcss)
ok("Training fits its workspace, not the whole window",
   app_rules and re.search(r"height:\s*100%", app_rules[-1]) is not None
   and "100dvh" not in app_rules[-1], app_rules[-1][:90] if app_rules else "no rule")
ok("Lens still takes the window, since that is the gym view",
   ":is(#cf-shell, #cf-lens) .app { display: flex; height: 100dvh;" in tcss)

# ---- icons tell entries apart when the menus are collapsed -------------
# Collapsed, an icon IS the entry. Divination had five entries sharing two
# icons, which read as three ambiguous pairs.
from collections import defaultdict as _dd
_block = re.search(r"const CHILD_ICONS = \{(.*?)\};", app, re.S).group(1)
_per = _dd(lambda: _dd(list))
# an entry that takes another's place is never beside it: NeuroTrain replaces
# Programs where it's installed (Q19, 10 Nov 2026), so it keeps that icon
_REPLACES = {"training:neurotrain": "training:programs"}
for _view, _icon in re.findall(r'"([a-z:]+)":\s*"(i-[a-z0-9-]+)"', _block):
    if _view in _REPLACES:
        continue
    _per[_view.split(":")[0]][_icon].append(_view)
_dupes = {s2: {i: v for i, v in ics.items() if len(v) > 1} for s2, ics in _per.items()
          if any(len(v) > 1 for v in ics.values())}
ok("no two entries in one menu share an icon", not _dupes, _dupes)
_defined = set(re.findall(r'<g id="(i-[\w-]+)"', html))
_used = set(re.findall(r'"(i-[a-z0-9-]+)"', _block))
ok("every icon a menu names is actually drawn", not (_used - _defined), sorted(_used - _defined))
# The puzzle entries are added at RUNTIME from Cranium's list, so they are not
# in CHILD_ICONS and the checks above cannot see them -- seventeen of them
# shared one generic tile until it was spotted by eye.
_cran = read("games/cranium.js")
_games = re.findall(r'\{key: "([a-z0-9]+)", name: "([^"]+)", icon: "(i-[a-z0-9-]+)"', _cran)
_gicons = [i for _k, _n, i in _games]
ok("each puzzle has its own icon", _games and len(set(_gicons)) == len(_gicons),
   [i for i in _gicons if _gicons.count(i) > 1])
ok("  and every one of them is drawn", not (set(_gicons) - _defined), sorted(set(_gicons) - _defined))
ok("  and the menu actually uses it",
   "c.icon || CHILD_ICONS[c.key]" in app and "icon: g.icon" in app)

# ---- the generators cannot silently undo hand fixes --------------------
# Each was built from a sandbox folder that no longer exists, while telling
# the next reader to re-run it. cranium.js holds the fix that stopped Games
# scaling the whole app; both stylesheets hold the converted text sizes.
_gens = [g for g in ("build_music.py", "build_games.py", "build_cards.py")
         if os.path.isfile(os.path.join(os.path.dirname(UI), g))]
# What matters is that running one cannot overwrite the file it used to
# generate. Each is RUN and the maintained files compared byte for byte
# afterwards. Note the honest limit: with their source folders gone these
# scripts would fail anyway, so a crash and a deliberate refusal look the
# same from outside -- this checks the outcome, not the intent, and the
# guard inside each script is the part that keeps working if a source folder
# ever comes back.
import subprocess as _sp
_root = os.path.dirname(UI)
_watch = [f for f in ("ui/games/cranium.js", "ui/games/cranium.css",
                      "ui/cards/celestial.js", "ui/cards/celestial.css",
                      "ui/music/chords.js", "ui/music/chords.css")
          if os.path.isfile(os.path.join(_root, f))]
_before = {f: open(os.path.join(_root, f), "rb").read() for f in _watch}
for _g in _gens:
    _sp.run([sys.executable, os.path.join(_root, _g)], capture_output=True, cwd=_root)
_changed = [f for f in _watch if open(os.path.join(_root, f), "rb").read() != _before[f]]
ok("running a retired generator overwrites nothing", not _changed, _changed)
ok("  and each still carries its refusal",
   all("is retired" in open(os.path.join(_root, g), encoding="utf-8").read() for g in _gens))

# ---------------------------------------------------------------------------
# Cam: "when i hover over an icon in the left sidebar a weird horizontal
# scrollbar appears, disappears when i move off it."
#
# A menu card is width:100% of the menu, and hovering one nudges it with
# transform: translateX(1px) -- the resting/hovered/chosen states Cam
# asked for. A transform does not change LAYOUT, so nothing gets wider,
# but it DOES count towards scrollable overflow: measured scrollWidth 196
# against clientWidth 195, in both the expanded and collapsed menu. One
# pixel is enough for a scrollbar.
#
# And a box with one axis set to auto treats a `visible` other axis as
# auto too -- so overflow-x was never really visible here, it was auto,
# waiting for something to overflow it.
_shared = open(os.path.join(UI, "shared.css"), encoding="utf-8").read()


def _rule(css, selector):
    """The body of the rule with exactly this selector.

    Exactly, not startswith: "#ss-nav" would otherwise match the
    "#ss-nav-h" heading rule sitting a few lines below it and cheerfully
    report on the wrong element."""
    for m in re.finditer(r"(?m)^([^{}@/]+)\{([^}]*)\}", css):
        if m.group(1).strip() == selector:
            return m.group(2)
    return ""


for _menu in ("#ss-nav", "#ss-subnav-body"):
    _body = _rule(_shared, _menu)
    ok("%s cannot scroll sideways" % _menu,
       "overflow-x: hidden" in _body,
       "a vertical menu has no business scrolling sideways, and the 1px "
       "hover nudge is enough to make it try")

ok("  the hover nudge that caused it is still a transform, not a margin",
   "transform: translateX(1px)" in _shared,
   "if this ever becomes a margin or padding it WILL change layout, and "
   "hiding the overflow would then be hiding a real problem")

# ---------------------------------------------------------------------------
# Cam: "album view scroll bar is grey and doesnt fit theme."
#
# Nothing had ever styled a scrollbar at the app level: two modules had
# noticed and styled their own, and every other scrolling box got whatever
# the desktop drew. Set once now, in the theme's own colours, so it follows
# all nine themes.
#
# Both spellings are needed because the two renderers read different ones:
# WebKitGTK honours the standard scrollbar-color and ignores the
# ::-webkit- pseudo-elements, while Chromium (which is what --gui qt gets
# you) honours the pseudo-elements.
ok("scrollbars are themed for the whole app",
   "scrollbar-color:" in _shared and "::-webkit-scrollbar-thumb" in _shared)
ok("  in theme tokens, not a fixed grey",
   re.search(r"scrollbar-color:\s*var\(--", _shared) is not None
   and re.search(r"::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*var\(--",
                 _shared) is not None,
   "a hardcoded colour is right in one theme and wrong in the other eight")
ok("  and for both renderers, not just the one in use today",
   "scrollbar-width:" in _shared and "::-webkit-scrollbar " in _shared)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
