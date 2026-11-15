/* ==========================================================================
   This computer's display: layout and brightness (2026-10-06).
   ==========================================================================
   Cam: "i need a setting for my laptop where i can change the UI ... my
   laptop screen is smaller then my ultra wide monitor and can sometimes get
   cramped when working through the training sessions ... Also the laptop
   setting will need to do something about the brightness as it is very dark
   on my laptop and difficult to see (maybe like accessibility feature you
   see in other applications."

   Kept on THIS computer (the page's own storage), not in the data folder,
   so the laptop and the ultrawide can each have their own:

     layout      auto | roomy | compact. Auto is compact whenever the window
                 is narrower than COMPACT_BELOW (CSS px, after UI scale) --
                 the laptop gets it by itself. Compact: the menu as icons,
                 less padding, Training's tags on one row, tighter cards.
                 (html[data-density="compact"], styles in shared.css)
     brightness  0 | 1 | 2 -- Normal, Brighter, Brightest. On a dark theme
                 the backgrounds, panels and lines are lifted and the text
                 made lighter; on a light theme the text and lines are made
                 darker. Pictures are untouched (no filter over the page).
                 Recomputed whenever the theme changes.

   Loaded before app.js, so the page never draws first and changes after.
   ========================================================================== */
(() => {
  "use strict";
  const KEY = "nn:display";
  const COMPACT_BELOW = 1500;
  const root = document.documentElement;
  const listeners = new Set();

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "{}");
      return {layout: ["auto", "roomy", "compact"].includes(v.layout) ? v.layout : "auto",
              brightness: [0, 1, 2].includes(v.brightness) ? v.brightness : 0};
    } catch (e) { return {layout: "auto", brightness: 0}; }
  }
  let state = read();

  function compact() {
    if (state.layout === "compact") return true;
    if (state.layout === "roomy") return false;
    return window.innerWidth < COMPACT_BELOW;
  }
  function applyDensity() {
    const c = compact();
    if ((root.getAttribute("data-density") === "compact") !== c) {
      if (c) root.setAttribute("data-density", "compact"); else root.removeAttribute("data-density");
      listeners.forEach((fn) => { try { fn(); } catch (e) { /* a listener's own problem */ } });
    }
  }

  /* ---- brightness: the theme's own colours, lifted ---- */
  const SURFACES = ["--bg", "--panel", "--elevated", "--hover", "--active"];
  const LINES = ["--line", "--line-strong"];
  const TEXT = ["--ink", "--text", "--muted", "--faint"];
  const STEP = {
    1: {surface: 0.06, line: 0.10, text: 0.35, faint: 0.30},
    2: {surface: 0.12, line: 0.18, text: 0.60, faint: 0.50},
  };
  function parse(c) {
    c = String(c || "").trim();
    let m = c.match(/^#([0-9a-f]{3,8})$/i);
    if (m) {
      let h = m[1];
      if (h.length <= 4) h = h.split("").map((x) => x + x).join("");
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
              h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    }
    m = c.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    return null;
  }
  const mix = (c, to, t) => [0, 1, 2].map((i) => Math.round(c[i] + (to - c[i]) * t));
  const css = (rgb, a) => a < 1 ? `rgba(${rgb.join(", ")}, ${a})` : `rgb(${rgb.join(", ")})`;
  const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

  let styleEl = null;
  function applyBrightness() {
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "nn-brightness";
      (document.head || root).appendChild(styleEl);
    }
    styleEl.textContent = "";                       // read the theme's own values
    root.toggleAttribute("data-bright", !!state.brightness);
    if (!state.brightness) return;
    const k = STEP[state.brightness];
    const cs = getComputedStyle(root);
    const bg = parse(cs.getPropertyValue("--bg"));
    if (!bg) return;
    const dark = lum(bg) < 0.5;
    const out = [];
    const put = (name, t, toward) => {
      const c = parse(cs.getPropertyValue(name));
      if (c) out.push(`${name}: ${css(mix(c, toward, t), c[3])} !important;`);
    };
    if (dark) {
      SURFACES.forEach((n) => put(n, k.surface, 255));
      LINES.forEach((n) => put(n, k.line, 255));
      TEXT.forEach((n) => put(n, n === "--faint" ? k.faint : k.text, 255));
    } else {
      LINES.forEach((n) => put(n, k.line, 0));
      TEXT.forEach((n) => put(n, (n === "--faint" ? k.faint : k.text) * 0.6, 0));
    }
    styleEl.textContent = `:root { ${out.join(" ")} }`;
  }

  /* the theme changes (or Follow Omarchy refreshes it): lift the new colours */
  let again = 0;
  new MutationObserver(() => {
    if (!state.brightness) return;
    cancelAnimationFrame(again);
    again = requestAnimationFrame(applyBrightness);
  }).observe(root, {attributes: true, attributeFilter: ["data-theme", "style"]});

  let resizeT = 0;
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(applyDensity, 120); });

  function set(changes) {
    state = Object.assign({}, state, changes);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* this session only */ }
    applyDensity();
    applyBrightness();
  }

  applyDensity();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyBrightness);
  else applyBrightness();

  window.NNDisplay = {
    get: () => Object.assign({}, state),
    set,
    compact,
    onChange: (fn) => listeners.add(fn),
    COMPACT_BELOW,
    _test: {parse, mix, applyBrightness},
  };
})();
