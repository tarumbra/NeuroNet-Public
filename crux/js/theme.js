/* ==========================================================================
   crux.theme — THEMES, TEXT SIZE
   ==========================================================================
   Cam: "Lets implement theme options into the settings menu… Like this
   menu from coach cam app."

   WHY THIS SHAPE, AND NOT COACH CAM'S. Both apps had a working theme
   system and they took opposite approaches. Coach Cam wrote each theme as
   a block of CSS ([data-theme="aero"] { … }) with per-component
   overrides; Hearth wrote each theme as a short object of custom-property
   values applied to the root element.

   Hearth's won, for three reasons that matter more than taste:
     * a theme is one enumerable object, so the contrast checker can walk
       every theme automatically rather than being told the list twice;
     * adding a theme touches one file, not scattered CSS blocks;
     * it already sets data-theme on the root, which means Coach Cam's
       per-component CSS overrides still work unchanged when its themes
       are ported — Aero's gloss and Windows 98's bevels hang off exactly
       that attribute.

   So: colour lives here, as data. Anything a colour cannot express —
   shape, gloss, a bevel — hangs off [data-theme=…] or [data-shape=…] in
   the stylesheet. That keeps the expressive escape hatch without giving
   up the enumerable list.

   HOW A THEME WORKS. Every colour in shared.css is a CSS custom property
   on :root, so a theme is nothing but a set of replacement values written
   onto the document element. No stylesheet swapping, no class on <body>
   that every rule has to account for, no second copy of the CSS. Adding a
   theme means adding an entry to THEMES below and nothing else.

   The exception is Windows 98, which changes SHAPE as well as colour —
   square corners, bevelled edges, a different font. Shape can't live in a
   colour variable, so that one also sets a `data-shape` attribute that a
   small block at the end of shared.css keys off. It is the only theme
   that needs it, and it's worth the one special case rather than
   pretending a colour system can express a bevel.

   WHY IT'S APPLIED BEFORE FIRST PAINT. applyTheme() runs from this file's
   own top level, reading localStorage directly, rather than waiting for
   the backend prefs to arrive. Waiting would mean the app painting in the
   default theme for a beat and then flipping — a visible flash on every
   single launch. The backend prefs are still the real store; localStorage
   is a cache kept in step on every change, used only to get the first
   paint right.
   ========================================================================== */
"use strict";

window.CruxTheme = (() => {

  /* Each theme lists only what it changes. Anything left out falls back
     to the base :root block in shared.css, so a theme is a short, honest
     diff rather than a full copy of the palette. */
  const THEMES = {
    hearth: {
      name: "Hearth",
      blurb: "Warm near-black and a red ember. The default — "
        + "carried over from Cheffo when the two apps merged.",
      swatch: ["#0A0605", "#1B1210", "#C7392C", "#F0E7D8"],
      vars: {},          // the base palette IS this theme
    },

    professional: {
      name: "Professional",
      blurb: "Warm slate and terracotta on cream. Calm, and the easiest "
        + "to read in a bright room.",
      swatch: ["#F4EFE7", "#E4DCCF", "#4A5159", "#AD5B38"],
      vars: {
        "--bg": "#F4EFE7", "--panel": "#FBF8F3", "--elevated": "#FFFFFF",
        "--hover": "#EDE6DA", "--active": "#E4DCCF",
        "--line": "#DDD3C4", "--line-strong": "#C3B6A3",
        "--ink": "#2C3137", "--text": "#3E454D", "--muted": "#6E7781",
        "--faint": "#9AA3AD",
        /* Measured: the original #B4613D put white button text at 4.45
           against a 4.5 WCAG AA minimum — a hair under, and invisible
           to the eye until someone with poor contrast vision uses it.
           Darkened just enough to clear it (4.85) while staying the
           same terracotta this theme is named for. */
        "--accent": "#AD5B38", "--accent-hover": "#C97550",
        "--accent-deep": "#8E4A2D",
        "--accent-tint": "rgba(180, 97, 61, 0.14)",
        "--on-accent": "#FFFFFF",
        "--good": "#3F8F6F", "--danger": "#B33B37",
        "--danger-tint": "rgba(179, 59, 55, 0.12)", "--star": "#C08A2E",
        "--scheme": "light",
      },
    },

    greenblack: {
      name: "Green on black",
      blurb: "The original. Dark, low glare.",
      swatch: ["#000000", "#12181A", "#1FAA5F", "#7BE3A6"],
      vars: {
        "--bg": "#000000", "--panel": "#0C1113", "--elevated": "#12181A",
        "--hover": "#182124", "--active": "#1E2A2E",
        "--line": "#1C2629", "--line-strong": "#2A383C",
        "--ink": "#E6F5EC", "--text": "#C9E4D6", "--muted": "#84A895",
        "--faint": "#557165",
        "--accent": "#1FAA5F", "--accent-hover": "#31C976",
        "--accent-deep": "#157A43",
        "--accent-tint": "rgba(31, 170, 95, 0.16)",
        "--on-accent": "#04150C",
        "--good": "#31C976", "--danger": "#E0605F",
        "--danger-tint": "rgba(224, 96, 95, 0.15)", "--star": "#D9B34A",
        "--scheme": "dark",
      },
    },

    aero: {
      name: "Aero",
      blurb: "Windows 7's glassy blue on a light background. Gloss on "
        + "the surfaces, flat measured colour on the text.",
      swatch: ["#EAF3FB", "#CFE3F5", "#1F6FB2", "#1E87A0"],
      vars: {
        "--bg": "#EAF3FB", "--panel": "#F7FBFE", "--elevated": "#FFFFFF",
        "--hover": "#DDEBF8", "--active": "#CFE3F5",
        "--line": "#BDD6EC", "--line-strong": "#93B9DA",
        "--ink": "#12324C", "--text": "#1E3F5C", "--muted": "#5A7B95",
        "--faint": "#8CA6BC",
        "--accent": "#1F6FB2", "--accent-hover": "#2A86D1",
        "--accent-deep": "#16558A",
        "--accent-tint": "rgba(31, 111, 178, 0.14)",
        "--on-accent": "#FFFFFF",
        "--good": "#1E87A0", "--danger": "#C4453F",
        "--danger-tint": "rgba(196, 69, 63, 0.12)", "--star": "#C9902B",
        "--scheme": "light",
        /* the one genuinely glassy touch: a soft top highlight on
           raised surfaces, which is what actually read as "Aero" */
        "--gloss": "linear-gradient(180deg, rgba(255,255,255,0.85) 0%,"
          + " rgba(255,255,255,0.35) 45%, rgba(255,255,255,0) 100%)",
      },
    },

    win98: {
      name: "Windows 98",
      blurb: "Grey chrome, navy selection, square corners and bevelled "
        + "edges. The only theme that changes shape as well as colour.",
      swatch: ["#C0C0C0", "#D4D0C8", "#000080", "#FFFFFF"],
      shape: "win98",
      vars: {
        "--bg": "#C0C0C0", "--panel": "#D4D0C8", "--elevated": "#D4D0C8",
        "--hover": "#DFDCD6", "--active": "#000080",
        "--line": "#808080", "--line-strong": "#404040",
        "--ink": "#000000", "--text": "#000000", "--muted": "#404040",
        "--faint": "#6E6E6E",
        "--accent": "#000080", "--accent-hover": "#1084D0",
        "--accent-deep": "#000050",
        "--accent-tint": "rgba(0, 0, 128, 0.12)",
        "--on-accent": "#FFFFFF",
        "--good": "#007800", "--danger": "#A80000",
        "--danger-tint": "rgba(168, 0, 0, 0.12)", "--star": "#8A6D00",
        "--radius": "0px", "--radius-lg": "0px",
        "--font": "'MS Sans Serif', 'Segoe UI', Tahoma, sans-serif",
        "--scheme": "light",
      },
    },

    icecream: {
      name: "Ice cream",
      blurb: "Strawberry, pistachio and blueberry on cream. Pastels "
        + "fill; deepened versions of the same hues carry the text.",
      swatch: ["#FDEFE9", "#F8CFD4", "#B03A55", "#2E7D63"],
      vars: {
        "--bg": "#FDEFE9", "--panel": "#FFF8F4", "--elevated": "#FFFFFF",
        "--hover": "#FBE3E2", "--active": "#F8CFD4",
        "--line": "#F0D5D2", "--line-strong": "#D9AFAE",
        /* the text colours are DEEPENED versions of the pastel fills,
           not the pastels themselves — pink text on cream fails every
           contrast check going */
        "--ink": "#4A2A33", "--text": "#5C363F", "--muted": "#8A6068",
        "--faint": "#B08E93",
        "--accent": "#B03A55", "--accent-hover": "#C9506C",
        "--accent-deep": "#8C2A41",
        "--accent-tint": "rgba(176, 58, 85, 0.12)",
        "--on-accent": "#FFF6F8",
        "--good": "#2E7D63", "--danger": "#B0303A",
        "--danger-tint": "rgba(176, 48, 58, 0.12)", "--star": "#B8862B",
        "--scheme": "light",
      },
    },

    contrast: {
      name: "High contrast",
      blurb: "Yellow on black, heavier borders. Built for poor light "
        + "and reading at distance.",
      swatch: ["#000000", "#1A1A1A", "#FFD400", "#FFFFFF"],
      vars: {
        "--bg": "#000000", "--panel": "#0D0D0D", "--elevated": "#1A1A1A",
        "--hover": "#262626", "--active": "#333333",
        "--line": "#6E6E6E", "--line-strong": "#FFFFFF",
        "--ink": "#FFFFFF", "--text": "#FFFFFF", "--muted": "#D9D9D9",
        "--faint": "#B0B0B0",
        "--accent": "#FFD400", "--accent-hover": "#FFE24D",
        "--accent-deep": "#C7A600",
        "--accent-tint": "rgba(255, 212, 0, 0.22)",
        "--on-accent": "#000000",
        "--good": "#5BE38A", "--danger": "#FF6B6B",
        "--danger-tint": "rgba(255, 107, 107, 0.22)", "--star": "#FFD400",
        "--border-weight": "2px",
        "--scheme": "dark",
      },
    },

    lightgreen: {
      name: "Light green",
      blurb: "White and green, if you prefer the original palette on a "
        + "light background.",
      swatch: ["#F6FAF7", "#D6E9DC", "#177A45", "#17241C"],
      vars: {
        "--bg": "#F6FAF7", "--panel": "#FFFFFF", "--elevated": "#FFFFFF",
        "--hover": "#E9F3EC", "--active": "#D6E9DC",
        "--line": "#D0E2D6", "--line-strong": "#A6C6B2",
        "--ink": "#17241C", "--text": "#243A2C", "--muted": "#5A7565",
        "--faint": "#8CA695",
        "--accent": "#177A45", "--accent-hover": "#1E9556",
        "--accent-deep": "#105C34",
        "--accent-tint": "rgba(23, 122, 69, 0.12)",
        "--on-accent": "#FFFFFF",
        "--good": "#177A45", "--danger": "#B3352F",
        "--danger-tint": "rgba(179, 53, 47, 0.12)", "--star": "#B4841F",
        "--scheme": "light",
      },
    },

    plum: {
      name: "Plum",
      blurb: "Hearth's own purple on near-black, from before the merge.",
      swatch: ["#0A060F", "#1B1026", "#A855F7", "#F1E8F8"],
      vars: {
        "--bg": "#0A060F", "--panel": "#120B1A", "--elevated": "#1B1026",
        "--hover": "#251633", "--active": "#2F1D40",
        "--line": "#271733", "--line-strong": "#3A2450",
        "--ink": "#F1E8F8", "--text": "#DCCFE8", "--muted": "#A28BB5",
        "--faint": "#6D5880",
        "--accent": "#A855F7", "--accent-hover": "#C084FC",
        "--accent-deep": "#7E3BC4",
        "--accent-tint": "rgba(168, 85, 247, 0.16)",
        "--on-accent": "#16081F",
        "--good": "#4FBFA0", "--danger": "#E0605F",
        "--danger-tint": "rgba(224, 96, 95, 0.15)", "--star": "#E0B145",
        "--scheme": "dark",
      },
    },
  };

  /* Text size scales the ROOT FONT SIZE, not a font-size on body.
     Everything in shared.css that should grow with it is specified in
     rem or em, so buttons, padding and spacing grow together and the
     layout genuinely re-flows — the same reasoning as Cranium's zoom,
     where a CSS transform was rejected for blurring text and leaving
     the layout thinking it was still the old size. */
  const TEXT_SIZES = {
    normal: {name: "Normal", scale: 1},
    large: {name: "Large", scale: 1.15},
    larger: {name: "Larger", scale: 1.3},
  };

  /* The key an app's theme choice is cached under. Renamed from
     "hearth:*" when this became shared code — OLD_KEYS is read once as a
     fallback so nobody's chosen theme is silently forgotten the first
     time they launch the merged app. Costs two reads on a cold start. */
  const LS_THEME = "crux:theme";
  const LS_TEXT = "crux:textSize";
  const OLD_KEYS = {theme: "hearth:theme", text: "hearth:textSize"};

  const read = (key, fallback) => {
    try { return localStorage.getItem(key) || fallback; }
    catch (e) { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  };

  /* The base palette, and the fallback for anything unrecognised. */
  const DEFAULT_THEME = "hearth";

  function readTheme() {
    const stored = read(LS_THEME, "") || read(OLD_KEYS.theme, "");
    return THEMES[stored] ? stored : DEFAULT_THEME;
  }
  let current = readTheme();
  function readTextSize() {
    const stored = read(LS_TEXT, "") || read(OLD_KEYS.text, "");
    return TEXT_SIZES[stored] ? stored : "normal";
  }
  let textSize = readTextSize();

  function applyTheme(key) {
    const theme = THEMES[key] || THEMES[DEFAULT_THEME];
    const root = document.documentElement;

    /* clear the previous theme's variables before writing the new
       one's, or a theme that sets --gloss would leave it behind for a
       theme that doesn't */
    for (const t of Object.values(THEMES)) {
      for (const name of Object.keys(t.vars)) root.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(theme.vars)) {
      root.style.setProperty(name, value);
    }
    /* colour-scheme drives the browser's own chrome — scrollbars, and
       the native parts of form controls. Getting it wrong gives you a
       white scrollbar on a black app. */
    /* colour-scheme drives the browser's own chrome — scrollbars, and
       the native parts of form controls. Getting it wrong gives you a
       white scrollbar on a black app, or dark dropdowns on a light one.
       Every theme that isn't the dark base declares its own; the default
       is dark because the base palette is. */
    root.style.setProperty("color-scheme",
      theme.vars["--scheme"] || "dark");
    if (theme.shape) root.setAttribute("data-shape", theme.shape);
    else root.removeAttribute("data-shape");
    root.setAttribute("data-theme", key);
    current = key;
  }

  function applyTextSize(key) {
    const size = TEXT_SIZES[key] || TEXT_SIZES.normal;
    document.documentElement.style.fontSize = (16 * size.scale) + "px";
    document.documentElement.setAttribute("data-text-size", key);
    textSize = key;
  }

  /* Run immediately, before the app renders anything. */
  applyTheme(current);
  applyTextSize(textSize);

  return {
    THEMES, TEXT_SIZES,
    get theme() { return current; },
    get textSize() { return textSize; },
    /** Applies and remembers. The caller also writes it to the backend
        prefs; localStorage here is only the first-paint cache. */
    setTheme(key) {
      if (!THEMES[key]) return false;
      applyTheme(key);
      write(LS_THEME, key);
      return true;
    },
    setTextSize(key) {
      if (!TEXT_SIZES[key]) return false;
      applyTextSize(key);
      write(LS_TEXT, key);
      return true;
    },
    /** Called once the real prefs arrive from the backend. If they
        disagree with the cache, the backend wins and the cache is
        corrected — that's what keeps a second install in step. */
    adoptFromPrefs(prefs) {
      if (!prefs) return;
      if (prefs.theme && THEMES[prefs.theme] && prefs.theme !== current) {
        applyTheme(prefs.theme);
        write(LS_THEME, prefs.theme);
      }
      if (prefs.textSize && TEXT_SIZES[prefs.textSize]
          && prefs.textSize !== textSize) {
        applyTextSize(prefs.textSize);
        write(LS_TEXT, prefs.textSize);
      }
    },
    swatchHtml(key) {
      const t = THEMES[key];
      if (!t) return "";
      return `<span class="th-swatches">${t.swatch.map((c) =>
        `<span class="th-swatch" style="background:${c}"></span>`).join("")}</span>`;
    },
  };
})();
