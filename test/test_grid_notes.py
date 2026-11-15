"""Grid inside Notes -- the wiring that keeps a note's data safe.

A grid is saved by Notes rebuilding the note from the page. Three separate
defences stop that ever rebuilding the note from the grid alone, which once
saved a grid's cell text over an ENTIRE note (dragging a grid column let
Notes' own table resizer take the drag). Each defence was shown, on its own,
to prevent that. These checks keep all three in place, plus:

  a grid block is drawn as a grid and written back verbatim
  code blocks keep their language (```python came back as bare ```)
  the Grid button, in both the raw editor and the editable View
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


def code(p):
    t = open(os.path.join(UI, p), encoding="utf-8").read()
    return re.sub(r"/\*.*?\*/", "", t, flags=re.S)


print("\nGrid inside Notes\n")
app, gv, html = code("notes/app.js"), code("notes/grid-view.js"), code("index.html")

# ---- a grid is drawn, and written back verbatim ------------------------
ok("a ```grid block is drawn as a grid holder, not code text",
   'if (lang === "grid")' in app and 'class="ss-grid"' in app)
ser = app[app.index("function serializeBlock(node)"):]
ser = ser[:ser.index("\nfunction ", 10)]
ok("and written back verbatim from the text it carries",
   'classList.contains("ss-grid")' in ser and "decodeURIComponent(node.dataset.gridSrc" in ser)
ok("code blocks keep their language when written back",
   'node.dataset.lang' in ser and 'data-lang=' in app)

# ---- the three defences ------------------------------------------------
ok("defence 1: the grid keeps pointer presses to itself",
   re.search(r'CONTAINED\s*=\s*\[[^\]]*"pointerdown"[^\]]*"mousedown"', gv, re.S) is not None)
ok("  ...and keys, typing and the clipboard",
   all(f'"{e}"' in gv for e in ("keydown", "input", "beforeinput", "paste", "cut", "copy")))
ptr = app[app.index("function onTablePointerDown(e)"):]
ptr = ptr[:ptr.index("\nfunction ", 10)]
ok("defence 2: Notes' own table resizer ignores grids",
   'e.target.closest(".ss-grid")) return;' in ptr)
ok("  ...and saves into a really editable area, not any [contenteditable]",
   'editable: e.target.closest("[contenteditable=\'true\'], [contenteditable=\'\']")' in ptr
   and 'editable: e.target.closest("[contenteditable]")' not in ptr)
ok("defence 3: the save path always rebuilds the WHOLE note",
   "function wholeNoteArea(" in app and "e = {target: wholeNoteArea(e && e.target)};" in app)

# ---- the grid saves through the normal edit path -----------------------
ok("a grid change is saved like any other edit (onViewEditInput)",
   "onChange: () => onViewEditInput({target: el}, true)" in app)
ok("editability is asked at the moment of editing, not at render",
   "editable: () => el.isContentEditable" in app)
ok("a grid that cannot be read is shown as it is, never saved over",
   "ssg-broken" in gv and "nothing here is saved over it" in gv)

# ---- the button -------------------------------------------------------
ok("Grid sits in Notes' bottom toolbar", 'data-cmd="grid"' in html)
# The first Grid button lacked class="cx-tool", which is what wireToolbar()
# connects -- so it was drawn but did nothing when clicked. Every toolbar
# button must carry it; checked for all of them, not just Grid.
tools = re.findall(r'<button([^>]*)data-cmd="([a-z-]+)"', html)
unwired = [cmd for attrs, cmd in tools if 'class="cx-tool"' not in attrs]
ok("every toolbar button, Grid included, is one the toolbar connects",
   tools and not unwired, "not connected: " + ", ".join(unwired))
ok("inserting a grid from the raw editor switches to View to show it",
   re.search(r'grid:\s*\(ta\)\s*=>\s*\{[^}]*setMode\("preview"\)', app, re.S) is not None)
ok("it works in the raw editor", re.search(r"grid:\s*\(ta\)\s*=>", app) is not None)
ok("and in the editable View", re.search(r"grid:\s*\(ed\)\s*=>", app) is not None)
ok("the engine loads before Notes", html.index("notes/grid.js") < html.index("notes/app.js")
   and html.index("notes/grid-view.js") < html.index("notes/app.js"))

# ---- stage 3: formatting, sort, filter, rules --------------------------
css = code("notes/grid.css")
ok("formatting, sort, filter and rules controls are there",
   all(f'data-act="{a}"' in gv for a in ("bold", "italic", "sort-asc", "sort-desc"))
   and all(f'data-pop="{p}"' in gv for p in ("fill", "text", "filter", "rules")))
ok("a fill with no text colour gets readable text chosen by its brightness",
   "function readableOn(" in gv and "readableOn(bg)" in gv)
# The selection used to REPLACE a cell's fill, leaving the automatic dark text
# on the dark selection colour -- unreadable while selected.
sel = re.search(r"\.ssg-cell\.is-sel\s*\{([^}]*)\}", css)
ok("the selection tints a fill instead of replacing it",
   sel is not None and "background-image" in sel.group(1) and "!important" not in sel.group(1),
   sel.group(1) if sel else "no rule")
ok("  ...which needs fills set as background-color, not the shorthand",
   "`background-color:${bg}`" in gv and "`background:${bg}`" not in gv)
ok("a filter always says how many rows are hidden, and that none are deleted",
   "none deleted" in gv and "ssg-clear-filter" in gv)
ok("clearing a format leaves no trace in the saved text",
   "else delete this.model.fmt[key];" in gv)

# ---- stage 4: charts ----------------------------------------------------
ok("a chart can be made from the selected cells", 'data-pop="chart"' in gv and "drawChart(" in gv)
ok("changing only the type keeps the chart's own range",
   "const keep = !block && this.model.chart;" in gv)
# Grid works offline like the rest of NeuroNet: no chart library, nothing
# loaded from the network. (An earlier version of this check compared an
# empty string with itself and passed no matter what the code did.)
engine = code("notes/grid.js")
outside = [w for w in ("fetch(", "XMLHttpRequest", "import(", "https://", "http://", "cdn")
           if w in engine or w in gv]
ok("charts are drawn here — nothing is fetched from the network",
   "chartSVG" in engine and "chartSVG" in gv and not outside, outside)
ok("a panel closes on a press inside the grid as well as outside",
   'this.root.addEventListener("mousedown", closeIfOutside, true)' in gv
   and 'document.addEventListener("mousedown", closeIfOutside)' in gv)

# ---- removing a grid ----------------------------------------------------
# Cam: "i cant delete it. I want to be able to select and click delete."
# Deleting one meant putting the caret exactly after it; clicking it and
# pressing Delete cleared cells, because the grid keeps those keys.
ok("a grid can be removed", "removeSelf()" in gv and 'data-act="remove"' in gv)
ok("selecting the whole grid, then Delete, removes it",
   "selectBlock(" in gv and re.search(r'if \(this\.blockSelected\)', gv) is not None
   and re.search(r'k === "Delete" \|\| k === "Backspace"\) && this\.canEdit\(\)\) \{\s*e\.preventDefault\(\); this\.removeSelf', gv) is not None)
# The grip ELEMENT, not just the name: an earlier version of this check
# passed even with the grip gone, because the click handler still said the word.
ok("there is something to grab to select it",
   'class="ssg-grip"' in gv and ".ssg-grip" in code("notes/grid.css"))
ok("Escape steps out of the cells and selects the grid",
   re.search(r'k === "Escape"\) \{ e\.preventDefault\(\); this\.selectBlock\(true\)', gv) is not None)
ok("removing is one edit to the note, so Ctrl+Z puts it back",
   "if (this.opts.onChange) this.opts.onChange();" in gv[gv.index("removeSelf()"):gv.index("selectBlock(on)")])

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
