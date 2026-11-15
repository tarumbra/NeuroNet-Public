"""Cam's own order, and Cam's favourites.

Cam: "integrate a re-arrange feature where i can drag the main section and
sub section icons to another place in the list to arrange their order",
"a favorite feature where i can favorite any sub section", and "our app
already has a Home Main section which acts as a dashboard, so lets put the
favorites there".
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


read = lambda p: open(os.path.join(UI, p), encoding="utf-8").read()
print("\nOrder and favourites\n")
app, home, css = read("app.js"), read("home/home.js"), read("shared.css")

# ---- dragging -----------------------------------------------------------
# Cam: "holding the right mouse button over an icon is used when rearranging
# this is to not mess up the clicking of the icon." So no HTML5 drag (which is
# left-button only) and the press that starts a move must be button 2.
_wire = app[app.index("function wireDragOrder("):app.index("let navGhost")]
_nav = app[app.index("const navCard ="):app.index("const favStar")]
ok("cards are moved with the right button", "function wireDragOrder(" in app
   and "e.button !== 2" in _wire)
ok("  and no longer with the left (no HTML5 drag on the cards)", 'draggable' not in _nav)
ok("  the drop happens on the release of the button that started it (the right one, in the menus)",
   re.search(r'addEventListener\("mouseup", \(e\) => \{\s*if \(!dragging \|\| e\.button !== dragging\.button\) return;', app))
# 15 Nov 2026 (Cam, Snip 1): the page tabs move with a left-button hold-and-drag, sideways
ok("the page tabs are dragged with the left button, along the row, in the menu's order",
   'wireDragOrder($("ss-tabs"), saveChildOrder, {left: true, across: true})' in app
   and 'data-drag="${escA(c.key)}"' in app and "#ss-tabs .ss-tab.drop-before" in css)
ok("both menus are wired for it",
   'wireDragOrder($("ss-nav")' in app and 'wireDragOrder($("ss-subnav-body")' in app)
ok("where a card would land is shown", ".drop-before" in css and ".drop-after" in css)
# A saved order that named everything would hide anything added later.
ok("a saved order never hides something new",
   "function inSavedOrder(" in app
   and "out.splice(before ? out.indexOf(before) + 1 : 0, 0, k)" in app)
ok("the menus draw in that order",
   "orderedSections()" in app and "orderedChildren(section)" in app)
ok("and it is remembered", "setPrefs({navOrder})" in app and "prefs.navOrder" in app)
# Dragging within one menu must not reorder the other: a drop target is only
# ever a card inside the menu the drag began in.
_drop = app[app.index("function navDropAt("):app.index("let navDragWired")]
ok("a drag only affects the menu it started in",
   "dragging.from.contains(card)" in _drop)

# ---- favourites ---------------------------------------------------------
ok("every subsection card carries a star", "favStar(c.key)" in app and "data-fav=" in app)
# Checked INSIDE the star's own handler: "e.stopPropagation()" appears in
# several other handlers, so looking for it anywhere proved nothing.
_star = re.search(r"data-fav\]\"\)\.forEach\(\(star\) => \{(.*?)\n  \}\);", app, re.S)
ok("starring does not also open the section",
   _star is not None and "e.stopPropagation()" in _star.group(1)
   and "toggleFavourite(star.dataset.fav)" in _star.group(1))
ok("favourites are remembered", "setPrefs({favourites})" in app and "prefs.favourites" in app)
ok("Home draws them, from the app's own list",
   "favouritesStrip()" in home and "SS.favourites()" in home and "SS.favouriteInfo" in home)
ok("  and each card is a quick link to that subsection",
   "data-fav-go=" in home and "host.go(card.dataset.favGo)" in home)
ok("  with a hint when there are none yet", "fav-strip-empty" in home)
# The star used to take width from the name: "Dashboard" became "Dashb...".
ok("the star sits in the card's padding, not in the row",
   re.search(r"#ss-subnav \.ss-fav \{[^}]*position: absolute", css, re.S) is not None
   and re.search(r"#ss-subnav \.ss-card \{[^}]*padding-right", css, re.S) is not None)

# ---- where the app opens ------------------------------------------------
ok("the app opens on Home, where the favourites are",
   'view = "home:dashboard";' in app)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
