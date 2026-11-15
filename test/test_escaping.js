/* ==========================================================================
   No unescaped text in the page's HTML (2026-10-06, the audit).
   ==========================================================================
   The audit: "637 places replace a block of HTML ... safety relies on every
   value being escaped by hand. Do: add a check for unescaped values."

   This reads every page file, finds each template that builds HTML, and
   fails on a text field (a name, title, notes, label ...) put into it without
   esc()/escA(). Something the user typed must never be read as HTML. The
   few listed below insert NeuroNet's own fixed text (built-in lists, icons,
   guide bodies NeuroNet writes) and are allowed by name.
   ========================================================================== */
"use strict";
const fs = require("fs"), path = require("path");
function templates(src) {
  const out = []; let i = 0; const n = src.length;
  const stack = [];          // for ${ } nesting: each entry {tpl, depth}
  let cur = null;            // current template {start, parts: [], exprs: []}
  function readTemplate() {   // at backtick
    const t = {line: src.slice(0, i).split("\n").length, text: "", exprs: []};
    i++;
    while (i < n) {
      const c = src[i];
      if (c === "\\") { t.text += src.slice(i, i + 2); i += 2; continue; }
      if (c === "`") { i++; out.push(t); return; }
      if (c === "$" && src[i + 1] === "{") {
        i += 2; const s = i; let depth = 1;
        while (i < n && depth) {
          const d = src[i];
          if (d === "`") { readTemplate(); continue; }
          if (d === "'" || d === '"') { skipStr(d); continue; }
          if (d === "{") depth++;
          else if (d === "}") { depth--; if (!depth) break; }
          i++;
        }
        t.exprs.push(src.slice(s, i).trim()); t.text += "\u0000"; i++; continue;
      }
      t.text += c; i++;
    }
  }
  function skipStr(q) { i++; while (i < n && src[i] !== q) { if (src[i] === "\\") i++; if (src[i] === "\n") break; i++; } i++; }
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i = src.indexOf("*/", i + 2); i = i < 0 ? n : i + 2; continue; }
    if (c === "'" || c === '"') { skipStr(c); continue; }
    if (c === "`") { readTemplate(); continue; }
    if (c === "/") {           // a regex literal? look back
      let j = i - 1; while (j >= 0 && /\s/.test(src[j])) j--;
      if (j < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(src[j]) || /\b(return|typeof|case|in|of)$/.test(src.slice(Math.max(0, j - 6), j + 1))) {
        i++; let cls = false;
        while (i < n) { const e = src[i]; if (e === "\\") { i += 2; continue; } if (e === "[") cls = true; else if (e === "]") cls = false; else if (e === "/" && !cls) break; else if (e === "\n") break; i++; }
        i++; continue;
      }
    }
    i++;
  }
  return out;
}
const FIELD = /^[A-Za-z_$][\w$]*(\??\.[A-Za-z_$][\w$]*|\[[^\]]+\])*\??\.(name|title|notes|note|text|caption|description|desc|creator|artist|album|label|body|author|subtitle|place|location|words|query|value)$/;

const SAFE = new Set([
  "cards/celestial.js ${p.name}",          // breathwork PATTERNS, built in
  "ebooks/ebooks.js ${t.name}",            // reader THEMES, built in
  "ebooks/ebooks.js ${c.name}",            // highlight colours, built in
  "games/cranium.js ${c.name}",            // puzzle colours, built in
  "guide/guide.js ${t.body}",              // Neuro Guide topics, written by NeuroNet
  "guide/guide.js ${topic.body}",
  "home/home.js ${k.name}",                // puzzle kinds, built in
  "home/home.js ${s.label}",               // a guided routine's steps, built in
  "music/chords.js ${ICON.note}",          // an icon
  "notes/guides.js ${g.body}",             // a guide's rich text (HTML by design)
  "pet/pet.js ${Core.SKILLS[w.skill].name}",   // the game's skill names
  "scrapbook/materials.js ${p.body}",      // built-in paper bodies (SVG)
  "training/builders.js ${t.value}",       // question types, built in
  "training/builders.js ${t.label}",
]);
const UI = require("path").join(process.argv[2] || require("path").join(__dirname, ".."), "ui");
const found = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, {withFileTypes: true})) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!["vendor", "node_modules"].includes(e.name)) walk(p); continue; }
    if (!e.name.endsWith(".js")) continue;
    for (const t of templates(fs.readFileSync(p, "utf8"))) {
      if (!/<[a-zA-Z][\w-]*[\s>\/]/.test(t.text)) continue;
      for (const x of t.exprs) {
        const key = `${path.relative(UI, p)} \${${x}}`;
        if (FIELD.test(x) && !SAFE.has(key)) found.push(`${path.relative(UI, p)}:${t.line} \${${x}}`);
      }
    }
  }
})(UI);
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); } };
console.log("\nEscaping in the page's HTML\n");
ok("every text field put into HTML goes through esc()/escA()", found.length === 0, found.slice(0, 8).join(" | "));
// the scanner itself still sees what it should
const probe = templates("const a = `<b>${x.name}</b>`; const re = /`/; const b = `${esc(y.title)}`;");
ok("  (the check finds an unescaped name, and passes an escaped one)", probe.length === 2 && FIELD.test(probe[0].exprs[0]) && !FIELD.test(probe[1].exprs[0]));
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
