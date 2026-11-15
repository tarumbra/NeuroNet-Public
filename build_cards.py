#!/usr/bin/env python3
"""Ports Celestial into NeuroNet as ui/cards/celestial.js + .css.

Celestial is two apps sharing a window -- divination (tarot, oracle,
lenormand, runes, I Ching, astrology) and mindfulness (meditation,
breathwork, journals) -- so it arrives as two sidebar sections, not one.

THREE COLLISIONS HAD TO BE SOLVED, none of them optional:

1. `window.CC` is Celestial's namespace AND Chords'. Whichever loaded
   second would take the name and the other app would call into a
   stranger's object. Celestial becomes CS here; Chords becomes CH.

2. celestial_shell.js is the one non-IIFE file, and its top-level
   `boot`, `paintClock`, `wireTopNav` and `currentPageId` would collide
   with the host and with Chords' shell, which has a `boot` and a
   `paintClock` of its own. A duplicate top-level const is a SyntaxError
   that kills the whole file, so everything is bundled into one IIFE.

3. Every modal in nine files reaches for `#modal-veil`, which NeuroNet
   also owns, and Celestial's dialog styling is scoped to its own shell
   -- sharing the host's container would leave every dialog unstyled.
   All ids are prefixed "cs-".

And one behavioural collision: Celestial attaches a DOCUMENT-WIDE click
handler to close its nav dropdowns, which would fire on every NeuroNet
click. Its top nav is gone here, so the handler goes with it.
"""
import os
import re
import sys

# RETIRED. celestial.js is now maintained directly -- this script's source
# (SRC below) was a sandbox path that no longer exists, and running it against a
# restored copy of Celestial would overwrite every fix made since, including
# the text sizes converted so Text size reaches this tool.
if __name__ == "__main__" and "--i-know-this-overwrites-fixes" not in sys.argv:
    sys.exit("build_cards.py is retired: ui/cards/celestial.js is now the source and is edited "
             "directly. Running this would overwrite the fixes made there since.")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_bridge                       # noqa: E402

SRC = "/home/claude/celestial_src/Celestial/ui"
DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui", "cards")

# shell first: it creates the namespace every page assigns itself onto
FILES = ["celestial_shell", "cards_common", "tarot", "oracle", "lenormand",
         "runes", "iching", "astrology", "database", "meditation",
         "journal", "gratitude", "breathwork", "tarot_journal"]

ID_MAP = {
    "app": "cs-app", "toasts": "cs-toasts", "modal-veil": "cs-modal-veil",
    "confirm-veil": "cs-confirm-veil", "top-bar": "cs-top-bar",
    "top-bar-clock": "cs-top-bar-clock",
}

# Which of Celestial's pages sits behind which NeuroNet view.
VIEWS = {
    "div:tarot": "tarot", "div:oracle": "oracle",
    "div:lenormand": "lenormand", "div:runes": "runes",
    "div:iching": "iching", "div:astrology": "astrology",
    "div:readings": "tarotjournal",
    # NOT "database". That page is Celestial's OWN photo library --
    # card_photos/ with its own tags, thumbnails, search and bulk
    # import. NeuroNet has a photo library, and having two is the
    # exact duplication Cam asked to remove. Deck art is picked from
    # the one library through the ordinary picker instead.
    "mind:meditation": "meditation", "mind:breathwork": "breathwork",
    "mind:journal": "journal", "mind:gratitude": "gratitude",
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
    # the namespace: CC is Chords' too
    text = re.sub(r'\bwindow\.CC\b', "window.CS", text)
    text = re.sub(r'\bCC\.', "CS.", text)
    text = re.sub(r'\bCardsCommon\b', "CSCards", text)
    return text


# The two replacements above, kept out of the loop so they are readable.
PICK_FROM_LIBRARY = """    /* NeuroNet's own picker, not the operating system's file dialog.
       A photo enters the app ONCE, through the photo library, and is
       then CHOSEN wherever it is needed -- the same correction KinCrux
       made when recipe photos stopped being private copies. */
    async function pickImageFor(onSaved, suggestedName) {
      const name = await pickFromNeuroNet(suggestedName);
      if (!name) return;
      onSaved(name);
      await save();
      render();
    }

    /** Opens the host picker and copies what comes back into the cards
        folder. Returns the stored filename, or null if cancelled. */
    async function pickFromNeuroNet(suggestedName) {
      const shared = window.SS && window.SS.shared;
      if (!shared || typeof shared.pickFromLibrary !== "function") {
        CS.toast("The photo library isn't available.", "error");
        return null;
      }
      const picked = await shared.pickFromLibrary(
        {title: "Choose a picture for " + (suggestedName || "this card")});
      if (!picked) return null;
      const api = window.pywebview && window.pywebview.api;
      if (!api || typeof api.cards_assign_photo !== "function") return null;
      const res = await api.cards_assign_photo(
        picked.storedName, suggestedName || picked.caption || "card");
      if (!res || res.error) {
        CS.toast((res && res.error) || "Couldn't use that photo.", "error");
        return null;
      }
      return res.name;
    }
"""

OPEN_PHOTO_LIBRARY = """    /* Was a gallery over card_photos/ -- Celestial's OWN second photo
       library, with its own tags, thumbnails, search and bulk import.
       NeuroNet has a photo library; having two is exactly what this
       merge removes. Every caller of this function now reaches the same
       one picker, and keeps its own signature. */
    function openPhotoLibrary(onPicked, suggestedName, onClose) {
      pickFromNeuroNet(suggestedName).then(async (name) => {
        if (name) {
          onPicked(name);
          await save();
          render();
          CS.toast("Image set.");
        }
        /* onClose lets a caller restore the dialog it opened this
           from, and must run whether or not a photo was chosen. */
        if (typeof onClose === "function") onClose();
      });
    }"""


def build_js():
    parts = ['''/* ==========================================================================
   Celestial — divination and mindfulness, moved into NeuroNet.
   ==========================================================================
   GENERATED by build_cards.py from Celestial's own source. Do not
   hand-edit: re-run the script, which is where the decisions live.

   Its namespace was `window.CC`, which is also Chords' -- whichever
   loaded second would have taken the name. It is CS here.

   What is NOT changed is the part worth keeping: the shuffle is a real
   Fisher-Yates (the source explicitly refuses the biased
   sort(() => Math.random() - 0.5)), the cut deals into real piles and
   re-stacks bottom-on-top so cutting again works from the current
   state, and spreads are {row, col} grid coordinates rather than pixel
   positions. That is the app.
   ========================================================================== */
(() => {
"use strict";
''']

    for name in FILES:
        text = read(os.path.join(SRC, "%s.js" % name))
        text = remap(text)

        if name == "cards_common":
            # ------------------------------------------------------------
            # Deck art comes from NeuroNet's photo library.
            #
            # Cam: "i want it to bring up the apps photo browser like it
            # does for KinCrux recipes. I want NeuroNet to handle photos
            # like KinCrux."
            #
            # Celestial had TWO ways to get a picture and neither is the
            # right one here: pickImageFor() opened the operating
            # system's file dialog, and openPhotoLibrary() browsed
            # card_photos/ -- Celestial's own second photo library, the
            # duplication this merge exists to remove.
            #
            # Both become the same thing: the host picker, then a copy
            # into the cards folder under a name of the card's own. The
            # callers are untouched -- they still hand in a callback and
            # a suggested name and still get a filename back.
            old_pick = text[text.index("    async function pickImageFor("):]
            old_pick = old_pick[:old_pick.index("\n    }\n") + len("\n    }\n")]
            text = text.replace(old_pick, PICK_FROM_LIBRARY)

            start = text.index("    function openPhotoLibrary(")
            # walk braces to find the end of the function
            depth, i = 0, start
            while i < len(text):
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                    if depth == 0:
                        break
                i += 1
            text = text[:start] + OPEN_PHOTO_LIBRARY + text[i + 1:]

        if name == "celestial_shell":
            # The host owns boot, navigation and the clock.
            text = text.replace(
                'window.addEventListener("DOMContentLoaded", boot);', "")
            # A document-wide click handler would fire on every host click.
            text = re.sub(
                r'document\.addEventListener\("click", closeAllDropdowns\);',
                "/* Celestial's top nav is gone here, and with it the\n"
                "   document-wide click handler that closed its dropdowns --\n"
                "   it would have fired on every NeuroNet click. */",
                text)
            # namespaced backend calls
            for old, new in (
                ('api.read_json(', 'api.cards_read_json('),
                ('api.write_json(', 'api.cards_write_json('),
                ('api.image_url(', 'api.cards_image_url('),
                ('api.thumb_url(', 'api.cards_thumb_url('),
                ('api.save_image(', 'api.cards_save_image('),
            ):
                text = text.replace(old, new)
        parts.append("\n/* ---- %s.js ---- */\n" % name)
        parts.append(text)

    parts.append('''

/* ======================================================================
   The seam: what NeuroNet's router calls.
   ====================================================================== */
const VIEW_OF = %s;
let booted = false;

window.SS = window.SS || {};
const mod = {
  VIEWS: Object.keys(VIEW_OF),
  async mount(host, which) {
    const shell = document.getElementById("cs-shell");
    if (!shell) return;
    host.style.display = "none";
    shell.hidden = false;
    if (!booted) {
      booted = true;
      if (CS.Store && CS.Store.ready) { try { await CS.Store.ready; } catch (e) { /* offline */ } }
    }
    await CS.route(VIEW_OF[which]);
  },
};
window.SS.Cards = mod;
window.SS.Mind = mod;    /* one module, two sidebar sections */
})();
''' % repr(VIEWS).replace("'", '"'))

    os.makedirs(DEST, exist_ok=True)
    out = "".join(parts)
    with open(os.path.join(DEST, "celestial.js"), "w", encoding="utf-8") as f:
        f.write(out)
    return len(out.split("\n"))


def build_css():
    """Scope every rule to #cs-shell, the same treatment Cranium's got.

    Celestial defined ~45 unprefixed custom properties on :root --
    --accent, --line, --gold, --radius-md, --font-body -- which would
    have repainted the whole host app. They move onto the shell element.
    """
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
            out.append("\n#cs-shell" + kept)
            i = k
            continue
        # these styled the whole page: background, the fixed grain
        # overlay, the top-bar padding and the box-sizing reset
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
            parts.append(t if t.startswith("#cs-shell") else "#cs-shell " + t)
        out.append("\n" + ",\n".join(parts) + " " + body)
        i = k

    header = '''/* ==========================================================================
   Celestial's stylesheet, scoped.
   ==========================================================================
   GENERATED from Celestial's shared.css. Every selector is prefixed
   #cs-shell, its :root token block moved onto that element (it defined
   --accent, --line, --radius-md and --font-body unprefixed, which would
   have repainted the whole host), and the html/body rules and the
   full-viewport grain overlay are dropped -- they belonged to an app
   that owned the window.
   ========================================================================== */
/* A BLOCK, not a flex column.

   As a flex container its one child, #cs-app, was a flex item sizing to
   its own content -- 253px inside a 1144px shell. The astrology grid
   then had room for exactly one column, so twelve signs came down the
   page in a single strip. Measured before changing anything. */
#cs-shell {
  display: block;
  flex: 1; min-width: 0; height: 100%; min-height: 0; overflow: auto;
  /* containing block for everything position:fixed inside it, or
     Celestial's modals would resolve against the viewport and cover
     NeuroNet's sidebar */
  transform: translateZ(0);
}
/* Without this, `hidden` does nothing: an id selector with a display
   beats the browser's own [hidden] rule, and the host's page area sits
   beside the shell in a split screen. Learned the hard way on Cranium. */
#cs-shell[hidden] { display: none; }
'''
    os.makedirs(DEST, exist_ok=True)
    res = (header + "".join(out)
           + theme_bridge.bridge("cs-shell", theme_bridge.WARM))
    with open(os.path.join(DEST, "celestial.css"), "w", encoding="utf-8") as f:
        f.write(res)
    return len(res.split("\n")), dropped


def main():
    js = build_js()
    css, dropped = build_css()
    print("ui/cards/celestial.js : %d lines" % js)
    print("ui/cards/celestial.css: %d lines (dropped %s)" % (css, dropped))


if __name__ == "__main__":
    sys.exit(main())
