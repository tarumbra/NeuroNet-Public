#!/usr/bin/env python3
"""Ports Cranium into NeuroNet as ui/games/cranium.js.

WHY THIS IS A SCRIPT AND NOT A ONE-OFF EDIT. Cranium is 7,834 lines
across 14 files that share bare top-level names with each other -- app.js
declares `$`, `data`, `view`, `toast`, `render` and `go`, and every
screen file uses them as globals. That is fine when they are the only
scripts on the page and fatal when they are not: a duplicate top-level
`const` is a SyntaxError that kills the whole file, not a silent shadow,
and NeuroNet's own app.js declares every one of those names.

So the port is not "wrap each file in an IIFE" -- that would break the
cross-file references it relies on. It is: concatenate all fourteen
files into ONE bundle inside ONE IIFE, in the order index.html loaded
them, so the shared names stay shared but stay private.

Doing that by hand once would work. Doing it by hand again after every
fix would not, and there will be fixes -- so it is a script, and the
original Cranium tree is never modified.
"""
import os
import re
import sys

# RETIRED. cranium.js is now maintained directly -- this script's source
# (SRC below) was a sandbox path that no longer exists, and running it against a
# restored copy of Cranium would overwrite every fix made since, including
# the zoom fix that stopped Games scaling the whole app, and the text sizes converted so Text size reaches this tool.
if __name__ == "__main__" and "--i-know-this-overwrites-fixes" not in sys.argv:
    sys.exit("build_games.py is retired: ui/games/cranium.js is now the source and is edited "
             "directly. Running this would overwrite the fixes made there since.")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_bridge                       # noqa: E402

SRC = "/home/claude/cranium_probe/app/ui"
DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui", "games")

ENGINES = ["sudoku", "minesweeper", "wordsearch", "extras", "nonogram",
           "more", "futoshiki", "kakuro"]
SCREENS = ["app", "screens", "screens2", "wordsearch_screen", "screens3",
           "books"]

# Every engine object, so the screens can keep referring to them by bare
# name after the engines stop attaching themselves to window.
ENGINE_NAMES = [
    "Sudoku", "Minesweeper", "WordSearch", "Game2048", "Memory", "Mastermind",
    "MEMORY_SYMBOLS", "Nonogram", "Sliding", "Jigsaw", "Hangman", "LightsOut",
    "Hitori", "WordGuess", "Simon", "Hanoi", "PegSolitaire", "Futoshiki",
    "Kakuro",
]

# Cranium's DOM ids are all generic -- #app, #sidebar, #content, #toasts,
# #modal-veil -- and NeuroNet has its own. Prefixed rather than merged:
# sharing #toasts would mean Cranium's toast styling, which is scoped to
# its shell, landing in the host's container unstyled.
ID_MAP = {
    "app": "cr-shell", "topbar": "cr-topbar", "topbar-title": "cr-topbar-title",
    "topbar-actions": "cr-topbar-actions", "brand": "cr-brand",
    "body": "cr-body", "sidebar": "cr-sidebar", "content": "cr-content",
    "modal-veil": "cr-modal-veil", "confirm-veil": "cr-confirm-veil",
    "toasts": "cr-toasts", "cc-clock": "cr-clock", "cc-zoom": "cr-zoom",
    "cc-zoom-in": "cr-zoom-in", "cc-zoom-out": "cr-zoom-out",
    "cc-zoom-level": "cr-zoom-level",
}


def _longest_first(mapping):
    """Longest key first, always.

    "app" and "app-shell" are both keys, and `#app\b` matches inside
    `#app-shell` because a hyphen is a word boundary. Substituting in
    dict order turned #app-shell into #ch-app-shell before its own rule
    ran -- which put a second "-shell" id in the document, and the
    host's sweep hid it and never showed it again.
    """
    return sorted(mapping.items(), key=lambda kv: -len(kv[0]))


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def remap_ids(text):
    """Every way Cranium reaches for a DOM id -> the prefixed one.

    `$("content")` is the one that matters and the one missed first
    time: Cranium's `$` IS document.getElementById, so remapping only
    the literal getElementById calls left every `$("content")`,
    `$("sidebar")` and `$("toasts")` pointing at ids that no longer
    exist. The shell appeared and then render() wrote innerHTML to
    null -- a blank screen with one console line.
    """
    for old, new in _longest_first(ID_MAP):
        text = text.replace('getElementById("%s")' % old,
                            'getElementById("%s")' % new)
        text = re.sub(r'\$\(\s*"%s"\s*\)' % re.escape(old),
                      '$("%s")' % new, text)
        text = re.sub(r'(querySelector(?:All)?\(\s*["\'])#%s\b' % re.escape(old),
                      r'\1#%s' % new, text)
        text = text.replace('id="%s"' % old, 'id="%s"' % new)
    return text


def main():
    os.makedirs(DEST, exist_ok=True)
    parts = []

    parts.append('''/* ==========================================================================
   Cranium — 17 games and the puzzle books, moved into NeuroNet.
   ==========================================================================
   GENERATED by build_games.py from Cranium's own source. Do not hand-edit:
   re-run the script, which is where the porting decisions live.

   ONE BUNDLE, ONE SCOPE. Cranium's fourteen files shared bare top-level
   names -- $, data, view, toast, render, go -- across separate <script>
   tags. NeuroNet's app.js declares every one of those too, and a
   duplicate top-level const is a SyntaxError that kills the file rather
   than shadowing quietly. Wrapping each file separately would have
   broken the cross-file references they depend on, so all fourteen are
   concatenated here inside one IIFE: the names stay shared, and stay
   private.

   THE ENGINES STILL RUN HEADLESS. Cranium's best property is that every
   puzzle generator in games/*.js knows nothing about the DOM, which is
   what makes "this Sudoku has exactly one solution" testable. They are
   given a local namespace here instead of window, and exposed again as
   window.CRGames so the headless harness can still reach them.
   ========================================================================== */
(() => {
"use strict";

/* ---- the engines ------------------------------------------------------
   Each was written as (root => root.Thing = ...)(window). They are handed
   a local object instead, so nineteen names stop landing on window --
   Memory, Sliding, Simon and Jigsaw especially were collisions waiting
   to happen. */
const CRG = {};
''')

    for name in ENGINES:
        text = read(os.path.join(SRC, "games", "%s.js" % name))
        text = text.replace('})(typeof window !== "undefined" ? window : globalThis);',
                            "})(CRG);")
        parts.append("\n/* ---- games/%s.js ---- */\n" % name)
        parts.append(text)

    parts.append("\n/* The screens below refer to these by bare name. */\n")
    parts.append("const {%s} = CRG;\n" % ", ".join(ENGINE_NAMES))
    parts.append("window.CRGames = CRG;   /* for the headless engine tests */\n")

    for name in SCREENS:
        text = read(os.path.join(SRC, "%s.js" % name))
        text = remap_ids(text)

        if name == "app":
            # The host owns boot and navigation now.
            text = text.replace('window.addEventListener("DOMContentLoaded", boot);',
                                "/* boot is called by the host -- see SS.Games.mount */")
            # Cranium swallowed Ctrl+= / Ctrl+- / Ctrl+0 on EVERY screen,
            # whichever app was showing. In its own window that was fine.
            # Here it would fight the host, so the shortcut only applies
            # while a Cranium screen is actually visible.
            text = text.replace(
                "  window.addEventListener(\"keydown\", (e) => {\n"
                "    if (!e.ctrlKey || e.altKey || e.metaKey) return;",
                "  window.addEventListener(\"keydown\", (e) => {\n"
                "    if (!e.ctrlKey || e.altKey || e.metaKey) return;\n"
                "    /* only while a Cranium screen is on -- see the note in\n"
                "       build_games.py about this fighting the host */\n"
                "    const shell = document.getElementById(\"cr-shell\");\n"
                "    if (!shell || shell.hidden) return;")
            # namespaced backend calls
            for old, new in (("api.get_data()", "api.cranium_get_data()"),
                             ("api.save_data(d)", "api.cranium_save_data(d)"),
                             ("api.get_prefs()", "api.cranium_get_prefs()"),
                             ("api.set_prefs(p)", "api.cranium_set_prefs(p)")):
                text = text.replace(old, new)
        parts.append("\n/* ---- %s.js ---- */\n" % name)
        parts.append(text)

    parts.append('''

/* ======================================================================
   The seam: what NeuroNet's router calls.
   ======================================================================
   Cranium brings its own chrome -- topbar, sidebar, content pane -- and
   it is SHOWN rather than rendered into the host's page area, for the
   reason Coach Cam's shell had to be in KinCrux: its listeners are wired
   at parse time, so markup injected later would have every lookup come
   back null.

   The host's sidebar drives navigation, so Cranium's own sidebar is
   hidden by the stylesheet, but it stays in the document because
   renderSidebar() writes to it without checking it exists. */
const VIEW_OF = {
  "games:home": "home", "games:books": "books", "games:stats": "stats",
};
let started = false;

window.SS = window.SS || {};
window.SS.Games = {
  VIEWS: Object.keys(VIEW_OF),
  async mount(host, which) {
    const shell = document.getElementById("cr-shell");
    if (!shell) return;
    host.style.display = "none";
    shell.hidden = false;
    if (!started) { started = true; await boot(); }
    go(VIEW_OF[which] || "home");
  },
  /* every game key, so the host can offer them without knowing the list */
  get games() { return GAMES.map((g) => ({key: g.key, name: g.name})); },
  open(gameKey) { go(gameKey); },
};
})();
''')

    out = "".join(parts)
    with open(os.path.join(DEST, "cranium.js"), "w", encoding="utf-8") as f:
        f.write(out)
    print("ui/games/cranium.js: %d lines" % len(out.split("\n")))
    css, dropped = build_css()
    print("ui/games/cranium.css: %d lines (dropped %s)" % (css, dropped))



def build_css():
    """Cranium's stylesheet, scoped and bridged -- GENERATED FROM SOURCE.

    The first version patched its own previous output instead, and
    truncated at the first "/* ====" it found -- which was the file's
    own header comment. The whole stylesheet went, 1,306 lines down to
    41, and Cranium rendered as one 1,144px brain icon.

    A build step that reads what it last wrote is not a build step. This
    one always starts from Cranium's shared.css.
    """
    css = read(os.path.join(SRC, "shared.css"))
    for old, new in _longest_first(ID_MAP):
        css = re.sub(r"#%s\b" % re.escape(old), "#%s" % new, css)

    owned = theme_bridge.host_tokens()
    out, i, n = [], 0, len(css)
    dropped = []
    while i < n:
        j = css.find("{", i)
        if j < 0:
            out.append(css[i:])
            break
        selector = css[i:j]
        core = selector.strip()
        if core.startswith("@") and not core.startswith("@import"):
            out.append(css[i:j + 1])
            i = j + 1
            continue
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
            k += 1
        body = css[j:k]

        if core == ":root" or core.endswith(":root"):
            # the host owns --accent, --line, --text and the rest. A
            # module redefining them is what made four apps four
            # colours -- and they cannot be bridged, because
            # `--line: var(--line)` on one element is a cycle.
            kept, _ = theme_bridge.strip_host_tokens(body, owned)
            out.append("\n#cr-shell" + kept)
            i = k
            continue
        if re.match(r"^(html\s*,\s*body|html|body)(::before|::after)?$", core) \
                or core.startswith("*"):
            dropped.append(core)
            i = k
            continue

        parts = []
        for one in selector.split(","):
            t = one.strip()
            if not t:
                continue
            parts.append(t if t.startswith("#cr-shell") else "#cr-shell " + t)
        out.append("\n" + ",\n".join(parts) + " " + body)
        i = k

    header = '''/* ==========================================================================
   Cranium's stylesheet, scoped to #cr-shell.
   ==========================================================================
   GENERATED by build_games.py from Cranium's own shared.css. Every
   selector is prefixed, its :root block loses the token names the host
   owns (so the host's palette inherits), and the html/body rules and
   the * reset are dropped -- Cranium set the page background and
   overflow:hidden document-wide, which was right when it owned the
   window.
   ========================================================================== */
/* A flex item of #ss-app, beside the host sidebar -- not a sibling of
   it. Placed outside, it stacked below #ss-app\'s 100vh and sat
   entirely off screen: 81 Sudoku cells in the DOM and a black window.

   translateZ(0) makes this the containing block for anything
   position:fixed inside it, or Cranium\'s modals would resolve against
   the viewport and cover NeuroNet\'s sidebar. */
#cr-shell {
  display: flex; flex-direction: column;
  flex: 1; min-width: 0; height: 100%; min-height: 0; overflow: hidden;
  transform: translateZ(0);
}
/* Without this, `hidden` does nothing: an id selector with a display
   beats the browser\'s own [hidden] rule, and the host\'s page area sits
   beside the shell in a split screen. */
#cr-shell[hidden] { display: none; }
/* The host\'s sidebar drives navigation, so Cranium\'s own one is not
   drawn -- but the element stays, because renderSidebar() writes to it
   without checking it exists. */
#cr-shell #cr-sidebar { display: none; }
'''
    res = header + "".join(out) + theme_bridge.bridge("cr-shell",
                                                      theme_bridge.CRANIUM)
    os.makedirs(DEST, exist_ok=True)
    with open(os.path.join(DEST, "cranium.css"), "w", encoding="utf-8") as f:
        f.write(res)
    return len(res.split("\n")), dropped


if __name__ == "__main__":
    sys.exit(main())
