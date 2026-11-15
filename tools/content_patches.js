#!/usr/bin/env node
/* Which parts of NeuroPets' rules CHANGE content an earlier part defined (2026-10-10, audit H-1 / SE-1). Adding new things
   (a recipe, a region, a spot) is how a feature part works; changing what another part already said is a patch -- it hides
   the real number from anyone reading the first part. This runs the parts in ui/pet/core/ with a snapshot of the content
   tables between each, and lists every value a later part changed.

     node tools/content_patches.js           list the patches, by part
     node tools/content_patches.js --check   exit 1 if a part patches something not in tools/content_patches.json
                                             (each entry says why it's a rule, not data: the pace, the economy, ...)
     node tools/content_patches.js --baseline  write the current patches into that list */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = path.join(__dirname, ".."), PARTS = path.join(APP, "ui", "pet", "core");
const args = process.argv.slice(2), CHECK = args.includes("--check"), BASELINE = args.includes("--baseline");
const LIST = path.join(__dirname, "content_patches.json");
const TABLES = ["ITEMS", "WORKSHOPS", "SKILLS", "MONSTERS", "HUNTS", "AREAS", "RUNS", "REGIONS", "PEOPLE", "CROPS", "HERB_TIERS", "EGGS", "PETS"];
const {parts, partSource} = require("./pet_content.js");     // content from ui/pet/content/*.json (2026-10-15)
const files = parts();
const grab = "(function(){var o={};" + TABLES.map((t) => `try{o.${t}=typeof ${t}==="undefined"?undefined:JSON.stringify(${t});}catch(e){}`).join("") + "return o;})()";
let src = "";
files.forEach((f, i) => { src += partSource(f); if (i < files.length - 1) src += `\n;__snap(${JSON.stringify(f)}, ${grab});\n`; });
const snaps = [];
const ctx = {window: {}, console, __snap: (f, o) => snaps.push([f, o])};
vm.createContext(ctx);
vm.runInContext(src, ctx);
// a change: a key that existed before with a different value (new keys are additions, fine)
const patches = {};
const walk = (a, b, p, out) => {
  if (a === undefined) return;
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) { Object.keys(a).forEach((k) => walk(a[k], b[k], p + "." + k, out)); return; }
  if (Array.isArray(a) && Array.isArray(b) && b.length > a.length && JSON.stringify(b.slice(0, a.length)) === JSON.stringify(a)) return;   // added to: how a feature plugs in
  if (Array.isArray(a) && Array.isArray(b) && b.length > a.length) {          // or at the front, or both ends
    const A = JSON.stringify(a);
    for (let i = 0; i + a.length <= b.length; i++) if (JSON.stringify(b.slice(i, i + a.length)) === A) return;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) { a.forEach((x, i) => walk(x, b[i], p + "[" + i + "]", out)); return; }
  out.push(p);
};
for (let i = 1; i < snaps.length; i++) {
  const [, before] = snaps[i - 1], [, after] = snaps[i], part = files[i];
  const out = [];
  TABLES.forEach((t) => { if (before[t] && after[t]) walk(JSON.parse(before[t]), JSON.parse(after[t]), t, out); });
  if (out.length) patches[part] = out;
}
// the last part (exports) is run without a snapshot after it; the pace/economy/recipe-xp steps come before it
const summary = (list) => { const g = {}; list.forEach((p) => { const k = process.env.ALL ? p : p.replace(/\[\d+\]/g, "[]").split(".").slice(0, 3).join("."); g[k] = (g[k] || 0) + 1; }); return g; };
const allow = fs.existsSync(LIST) ? JSON.parse(fs.readFileSync(LIST, "utf8")) : {parts: {}};
if (BASELINE) {
  Object.keys(patches).forEach((p) => { if (!allow.parts[p]) allow.parts[p] = "baseline " + new Date().toISOString().slice(0, 10) + ": " + Object.keys(summary(patches[p])).slice(0, 6).join(", "); });
  Object.keys(allow.parts).forEach((p) => { if (!patches[p]) delete allow.parts[p]; });
  fs.writeFileSync(LIST, JSON.stringify(allow, null, 2) + "\n");
}
const fresh = Object.keys(patches).filter((p) => !allow.parts[p]);
if (!CHECK) {
  Object.keys(patches).forEach((p) => {
    console.log(`${p}: ${patches[p].length} change(s)${allow.parts[p] ? "  [" + allow.parts[p] + "]" : "  [NOT LISTED]"}`);
    Object.entries(summary(patches[p])).slice(0, process.env.ALL ? 99 : 8).forEach(([k, n]) => console.log(`    ${k}${n > 1 ? " x" + n : ""}`));
  });
  console.log(`\n${Object.keys(patches).length} parts change earlier content; ${fresh.length} not in tools/content_patches.json.`);
}
if (CHECK) {
  if (fresh.length) { console.log("Parts that change earlier content without saying why (fold the change into the first part, or list it in tools/content_patches.json):\n  " + fresh.join("\n  ")); process.exit(1); }
  console.log(`content patches: ${Object.keys(patches).length} parts, all listed`);
}
