#!/usr/bin/env python3
"""Ports Chords into NeuroNet as ui/music/chords.js + .css.

BACKGROUND PLAY IS THE POINT, and it decides the shape of this port.

Cam asked for music that keeps playing while he does something else.
That is not a feature you bolt onto a music screen -- it is a property
of the whole app, and it falls out of two decisions here:

1. The <audio> element is appended to document.body, not to Chords'
   shell. Chords already did this, and it is why the port works at all:
   hiding the shell to show Cranium does not touch the element, and the
   browser keeps decoding. Moving it inside the shell "to tidy up" would
   silently break background play the moment a shell is hidden.

2. The MINI PLAYER moves OUT of Chords' top bar and into NeuroNet's
   sidebar, where every screen can see it. In Chords it lived in a bar
   that only existed on Chords' own screens, which is exactly the thing
   Cam is complaining about when the music vanishes.

The collisions are the same three as everywhere else: window.CC is also
Celestial's (this becomes CH), chords_shell.js is a non-IIFE file whose
top-level boot/paintClock/NAV_ITEMS would collide, and its #app,
#toasts and #modal-veil are names the host owns.
"""
import os
import re
import sys

# RETIRED. ui/music/chords.js is now maintained directly -- this script's
# source (SRC below) was a sandbox path that no longer exists, and running
# it against a restored copy of Chords would overwrite every fix made in
# chords.js since it was generated. Kept for the record of how the port was
# done, and for its explanation of why the pieces fit together as they do.
if __name__ == "__main__" and "--i-know-this-overwrites-fixes" not in sys.argv:
    sys.exit("build_music.py is retired: ui/music/chords.js is now the source "
             "and is edited directly. Running this would overwrite the fixes "
             "made there since. See the note at the top of chords.js.")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_bridge                       # noqa: E402

SRC = "/home/claude/chords_probe/app/ui"
DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui", "music")

FILES = ["chords_shell", "chords_player", "chords_visualizer",
         "chords_right_panel", "chords"]

# NOTE the "app-shell" line. Chords has an INNER wrapper called
# #app-shell, and naming it #ch-app-shell put a second "-shell" id in
# the document -- which the host's sweep then hid along with the real
# one, and never showed again. It only LOOKED fine because that element
# was also missing its [hidden] override, so two bugs cancelled out.
# The suffix "-shell" now means exactly one thing: a top-level pane the
# host shows and hides.
ID_MAP = {
    "app": "ch-app", "app-shell": "ch-inner", "toasts": "ch-toasts",
    "modal-veil": "ch-modal-veil", "confirm-veil": "ch-confirm-veil",
    "top-bar": "ch-top-bar", "top-bar-clock": "ch-top-bar-clock",
    "cc-sidebar-left": "ch-sidebar-left", "cc-sidebar-right": "ch-sidebar-right",
    "cc-menu-toggle": "ch-menu-toggle", "cc-panel-toggle": "ch-panel-toggle",
}

VIEWS = {
    "music:library": "library", "music:albums": "albums",
    "music:playlists": "playlists", "music:visualizer": "visualizer",
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


def remap(text):
    for old, new in _longest_first(ID_MAP):
        text = text.replace('getElementById("%s")' % old,
                            'getElementById("%s")' % new)
        text = re.sub(r'(querySelector(?:All)?\(\s*["\'])#%s\b' % re.escape(old),
                      r'\1#%s' % new, text)
        text = text.replace('id="%s"' % old, 'id="%s"' % new)
    text = re.sub(r'\bwindow\.CC\b', "window.CH", text)
    text = re.sub(r'(?<![\w.])CC\.', "CH.", text)
    return text


# The real shuffle, as Chords shipped it: a fresh random index on every
# `next`. That looks like shuffle and is not one -- the queue never
# reaches an end, so repeat-all is unreachable; the same track can come
# up again two tracks later; and Previous goes somewhere NEW rather than
# back to what you just heard.
SHUFFLE_OLD = """    if (shuffle) {
      if (queue.length === 1) { index = 0; }
      else {
        let n = index;
        while (n === index) n = Math.floor(Math.random() * queue.length);
        index = n;
      }
      loadCurrent(true, auto); return;
    }"""

SHUFFLE_NEW = """    if (shuffle) {
      /* A REAL shuffle: the order is decided ONCE and then walked.
         See the note in build_music.py about what the old one did. */
      if (shuffleOrder.length !== queue.length) buildShuffleOrder();
      if (shufflePos + 1 < shuffleOrder.length) {
        shufflePos += 1;
        index = shuffleOrder[shufflePos];
        loadCurrent(true, auto); return;
      }
      /* the end of the shuffled order IS an end, which is what makes
         repeat-all reachable at all */
      if (repeat === "all") {
        buildShuffleOrder();
        shufflePos = 0;
        index = shuffleOrder[0];
        loadCurrent(true, auto); return;
      }
      if (auto) { audio && audio.pause(); paintBar(); emit(); }
      return;
    }"""

# Previous never knew about shuffle at all -- it walked the queue index
# down, so in shuffle mode it went to a track you had not heard.
PREV_OLD = """    if (index > 0) index--;
    else if (repeat === "all") index = queue.length - 1;
    loadCurrent(true, false);"""

PREV_NEW = """    if (shuffle && shuffleOrder.length === queue.length) {
      /* back along the order actually played, not down the raw queue */
      if (shufflePos > 0) shufflePos -= 1;
      else if (repeat === "all") shufflePos = shuffleOrder.length - 1;
      index = shuffleOrder[shufflePos];
      loadCurrent(true, false);
      return;
    }
    if (index > 0) index--;
    else if (repeat === "all") index = queue.length - 1;
    loadCurrent(true, false);"""

# the order itself, plus the state it needs
SHUFFLE_STATE_OLD = """  let shuffle = false;"""
SHUFFLE_STATE_NEW = """  let shuffle = false;
  /* The shuffled ORDER, and where along it we are. Held separately from
     `queue` so turning shuffle off drops straight back into the real
     running order rather than leaving the queue scrambled. */
  let shuffleOrder = [];
  let shufflePos = -1;

  /** Fisher-Yates over the queue's indices, with whatever is playing
      moved to the front so turning shuffle on does not skip the current
      track. */
  function buildShuffleOrder() {
    shuffleOrder = queue.map((_, i) => i);
    for (let i = shuffleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
    }
    const at = shuffleOrder.indexOf(index);
    if (at > 0) {
      shuffleOrder.splice(at, 1);
      shuffleOrder.unshift(index);
    }
    shufflePos = 0;
  }"""

# turning shuffle on must lay a fresh order, or the first next() walks a
# stale one from a queue that has since changed
SET_SHUFFLE_OLD = """    setShuffle(on) { shuffle = !!on; emit(); },"""
SET_SHUFFLE_NEW = """    setShuffle(on) {
      shuffle = !!on;
      if (shuffle) buildShuffleOrder(); else { shuffleOrder = []; shufflePos = -1; }
      emit();
    },"""

TOGGLE_OLD = """    shufBtn.onclick = () => { shuffle = !shuffle; paintPopover(); emit(); };"""
TOGGLE_NEW = """    shufBtn.onclick = () => {
      shuffle = !shuffle;
      if (shuffle) buildShuffleOrder(); else { shuffleOrder = []; shufflePos = -1; }
      paintPopover(); emit();
    };"""

PATCHES = [
    ("shuffle order state", SHUFFLE_STATE_OLD, SHUFFLE_STATE_NEW),
    ("next()", SHUFFLE_OLD, SHUFFLE_NEW),
    ("prev()", PREV_OLD, PREV_NEW),
    ("setShuffle()", SET_SHUFFLE_OLD, SET_SHUFFLE_NEW),
    ("the shuffle button", TOGGLE_OLD, TOGGLE_NEW),
]


def build_js():
    parts = ['''/* ==========================================================================
   Chords — the music module, moved into NeuroNet.
   ==========================================================================
   GENERATED by build_music.py. Do not hand-edit: re-run the script.

   Its namespace was `window.CC`, which is also Celestial's. It is CH
   here.

   THE MEDIA SERVER IS NOT IN THIS FILE and that is deliberate -- it is
   Python, it lives in neuronet.py, and it was ported verbatim because
   it is the most carefully written code in any of these apps. Every
   line of it answers a real failure: WebKitGTK refusing file:// media
   from another directory, file:// not doing byte ranges so seeking
   broke, and a lossless album not fitting in memory.
   ========================================================================== */
(() => {
"use strict";
''']

    for name in FILES:
        text = read(os.path.join(SRC, "%s.js" % name))
        text = remap(text)

        if name == "chords_shell":
            text = text.replace(
                'window.addEventListener("DOMContentLoaded", boot);', "")
            for old, new in (
                ("api.read_json(", "api.music_read_json("),
                ("api.write_json(", "api.music_write_json("),
                ("api.image_url(", "api.music_image_url("),
                ("api.thumb_url(", "api.music_thumb_url("),
                ("api.save_image(", "api.music_save_image("),
            ):
                text = text.replace(old, new)

        if name == "chords_player":
            for label, old, new in PATCHES:
                if old not in text:
                    raise SystemExit(
                        "build_music.py: could not find %s to patch. The "
                        "source changed; fix the patch rather than shipping "
                        "a half-fixed shuffle." % label)
                text = text.replace(old, new, 1)
        parts.append("\n/* ---- %s.js ---- */\n" % name)
        parts.append(text)

    parts.append('''

/* ======================================================================
   The seam.
   ====================================================================== */
const VIEW_OF = %s;
let booted = false;

window.SS = window.SS || {};

/* ======================================================================
   Album art comes from NeuroNet's photo library.
   ======================================================================
   Cam: "When i got to add a photo to an album or song as the cover it
   brings up the computer file browser, i want it to bring up the apps
   photo browser like it does for KinCrux recipes."

   Chords already had the hook. `pickAndStoreImage()` calls CH.PickImage
   if something defines it and falls back to an <input type="file">
   otherwise -- and standalone, nothing ever defined it, so the fallback
   was the only path there had ever been. Defining it here is the whole
   fix: not one line of the five call sites changes.

   A photo enters NeuroNet ONCE, through the library, and is then
   CHOSEN wherever it is needed. That is the same correction KinCrux
   made when recipe photos stopped being private copies -- otherwise
   the same sleeve exists twice, and renaming it in the library leaves
   the album pointing at a name nothing has. */
CH.PickImage = async (nameHint, label) => {
  const shared = window.SS && window.SS.shared;
  if (!shared || typeof shared.pickFromLibrary !== "function") return null;
  const picked = await shared.pickFromLibrary({title: "Choose album art"});
  if (!picked) return null;                       /* cancelled */
  const api = window.pywebview && window.pywebview.api;
  if (!api || typeof api.music_assign_photo !== "function") return null;
  /* A COPY into the music folder, under a name of the album's own. The
     library photo stays exactly where it is -- it may be in an album,
     on another record, or simply a photo Cam wants to keep. */
  const res = await api.music_assign_photo(picked.storedName,
                                           label || nameHint || "album");
  if (!res || res.error) {
    CH.toast((res && res.error) || "Couldn't use that photo.", "error");
    return null;
  }
  return res.name;
};

window.SS.Music = {
  VIEWS: Object.keys(VIEW_OF),
  async mount(host, which) {
    const shell = document.getElementById("ch-shell");
    if (!shell) return;
    host.style.display = "none";
    shell.hidden = false;
    if (!booted) { booted = true; await boot(); }
    CH.tools.chords.showSection(VIEW_OF[which]);
  },
  /* The host's sidebar mini-player asks for these. The audio element
     itself is on document.body, so nothing here stops when a shell is
     hidden -- that IS background play. */
  get Player() { return CH.Player; },
};
})();
''' % repr(VIEWS).replace("'", '"'))

    os.makedirs(DEST, exist_ok=True)
    out = "".join(parts)
    with open(os.path.join(DEST, "chords.js"), "w", encoding="utf-8") as f:
        f.write(out)
    return len(out.split("\n"))


def build_css():
    css = read(os.path.join(SRC, "shared.css"))
    for old, new in _longest_first(ID_MAP):
        css = re.sub(r"#%s\b" % re.escape(old), "#%s" % new, css)

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
            # the host owns these names; a module redefining them is
            # what made four apps four different colours
            kept, dropped = theme_bridge.strip_host_tokens(
                body, theme_bridge.host_tokens())
            out.append("\n#ch-shell" + kept)
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
            parts.append(t if t.startswith("#ch-shell") else "#ch-shell " + t)
        out.append("\n" + ",\n".join(parts) + " " + body)
        i = k

    header = '''/* ==========================================================================
   Chords' stylesheet, scoped to #ch-shell.
   ==========================================================================
   GENERATED from Chords' shared.css. Same three changes as the others:
   every selector prefixed, the :root tokens moved onto the shell, and
   the html/body rules dropped.
   ========================================================================== */
#ch-shell {
  display: flex; flex-direction: column;
  flex: 1; min-width: 0; height: 100%; min-height: 0; overflow: auto;
  transform: translateZ(0);
}
/* Without this `hidden` does nothing -- an id selector with a display
   beats the browser's own [hidden] rule, and you get a split screen. */
#ch-shell[hidden] { display: none; }
'''
    os.makedirs(DEST, exist_ok=True)
    overrides = """

/* ----------------------------------------------------------------------
   Overrides, deliberately LAST.

   These were at the top of the file first time and lost: the ported
   rules below them have the same specificity, and the later rule wins.
   Chords' top bar and its own left sidebar both drew straight through,
   so the app showed two navigations at once.
   ---------------------------------------------------------------------- */

/* Chords' own top bar and sidebar duplicated NeuroNet's. They stay in
   the document because the player and the shell write to their elements
   without checking they exist -- they are simply not drawn. */
#ch-shell #ch-top-bar,
#ch-shell #ch-sidebar-left { display: none; }
#ch-shell #ch-inner { padding-top: 0; }
"""
    res = (header + "".join(out) + overrides
           + theme_bridge.bridge("ch-shell", theme_bridge.WARM))
    with open(os.path.join(DEST, "chords.css"), "w", encoding="utf-8") as f:
        f.write(res)
    return len(res.split("\n")), dropped


def main():
    js = build_js()
    css, dropped = build_css()
    print("ui/music/chords.js : %d lines" % js)
    print("ui/music/chords.css: %d lines (dropped %s)" % (css, dropped))


if __name__ == "__main__":
    sys.exit(main())
