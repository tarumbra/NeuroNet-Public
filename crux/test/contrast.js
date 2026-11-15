/* crux.test.contrast — measuring a theme's real contrast.

   Exported as a module so every app's theme set is checked the same way
   and no one has to reimplement WCAG.

   A theme system is easy to get subtly wrong: one variable left out of
   a theme falls back to the base palette, and a light theme inheriting
   a near-black base text colour looks fine in the swatch row and is
   unreadable on the page. So this resolves the ACTUAL computed value of
   each colour pair after the theme is applied, and computes the WCAG
   contrast ratio rather than eyeballing hex codes. */
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log("  ok   " + n); }
  else { fail++; console.log("  FAIL " + n + (x ? "\n         " + x : "")); } };

/* ---- colour maths, written from the WCAG definition ---------------- */
function parseColor(s) {
  s = String(s || "").trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return m[1].split("").map((c) => parseInt(c + c, 16));
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(",").map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}
const srgb = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92
  : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * srgb(c[0]) + 0.7152 * srgb(c[1]) + 0.0722 * srgb(c[2]);
/** Flattens a translucent colour over its backdrop before measuring —
    otherwise a tint reads as far lighter or darker than it looks. */
function over(fg, bg) {
  if (fg.length < 4 || fg[3] === undefined || fg[3] >= 1) return fg;
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
}
function ratio(fgS, bgS) {
  const bg = parseColor(bgS), fgRaw = parseColor(fgS);
  if (!bg || !fgRaw) return null;
  const fg = over(fgRaw, bg);
  const a = lum(fg), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}


/* The pairs that actually decide whether an interface is readable.
   [foreground, background, label, minimum]. 4.5 is WCAG AA for body
   text; 3.0 is AA for large text and UI chrome. */
const PAIRS = [
  ["--ink", "--bg", "headings on the app background", 4.5],
  ["--text", "--bg", "body text on the app background", 4.5],
  ["--text", "--panel", "body text on a panel", 4.5],
  ["--text", "--elevated", "body text on a card", 4.5],
  ["--muted", "--panel", "muted/meta text on a panel", 3.0],
  ["--on-accent", "--accent", "label on an accent button", 4.5],
  ["--accent", "--bg", "accent against the background", 3.0],
  ["--danger", "--panel", "danger text on a panel", 3.0],
];

/** The base :root values, so a theme that OMITS a variable is measured
    on what it actually inherits rather than on nothing. That case — a
    light theme inheriting a near-black base text colour — looks fine in
    the swatch row and is unreadable on the page. */
function baseVars(cssPath) {
  const css = fs.readFileSync(cssPath, "utf8");
  const start = css.indexOf(":root");
  const block = css.slice(start, css.indexOf("}", start));
  const vars = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars[m[1]] = m[2].trim().replace(/\s*\/\*[\s\S]*?\*\/\s*/g, "");
  }
  return vars;
}

/** Walks every theme and returns the failures. `applyTheme(key)` must
    actually apply it to the document the vars are then read from. */
function check(themes, applyTheme, root, cssPath, pairs) {
  const base = baseVars(cssPath);
  const resolve = (name) =>
    (root.style.getPropertyValue(name) || base[name] || "").trim();
  const results = [];
  for (const key of Object.keys(themes)) {
    applyTheme(key);
    const bad = [];
    let worst = Infinity, worstLabel = "";
    for (const [f, b, label, min] of (pairs || PAIRS)) {
      const r = ratio(resolve(f), resolve(b));
      if (r === null) continue;
      if (r < worst) { worst = r; worstLabel = label; }
      if (r < min) bad.push({ label, ratio: r, min });
    }
    results.push({ key, name: themes[key].name || key, bad, worst, worstLabel });
  }
  return results;
}

module.exports = { parseColor, lum, ratio, over, PAIRS, baseVars, check };
