/* ==========================================================================
   Scribe is NeuroScribe: switched off once, and every way in still has a way in
   ==========================================================================
   Cam (21 Nov 2026): "Now hide the scribe inside of the neuronet main app please".

   The rule this holds, as test_training_nav.js does for Training's pills: EVERY SCRIBE PAGE STILL HAS A WAY IN.
   With Scribe switched off, each of its subsections (read from the real SECTIONS list, not a copy) must hand over
   to NeuroScribe with a request NeuroScribe understands, never land nowhere. And the switch-off happens once, only
   where NeuroScribe is built: a computer without it keeps its Scribe, and Cam turning it back on in Settings is
   never undone by the next start.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = process.argv[2] || path.join(__dirname, "..");
const src = fs.readFileSync(path.join(APP, "ui", "app.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};

// the real functions, cut out of app.js
const cut = (start, end) => { const i = src.indexOf(start), j = src.indexOf(end, i); if (i < 0 || j < 0) throw new Error("not found: " + start); return src.slice(i, j); };
const code = [
  "const KITCHEN_VIEWS = new Set([]); const PHOTO_VIEWS = {};",
  cut("function sectionOf(v) {", "function sectionName("),
  cut("async function hideScribeOnce(prefs) {", "function sectionOn(key) {"),
  cut("function sectionOn(key) {", "function wireSettingsAppearance"),
].join("\n");
function world(installed, hidden) {
  const ctx = {calls: [], prefs: null, toasts: [], hiddenSections: new Set(hidden || []), Promise};
  ctx.SS = {Store: {
    call: async (name, args) => { ctx.calls.push([name, ...args]); return name === "neuroscribe_installed" ? {installed} : {ok: true}; },
    setPrefs: async (p) => { ctx.prefs = Object.assign({}, ctx.prefs || {}, p); } }};
  ctx.toast = (m) => ctx.toasts.push(m);
  vm.createContext(ctx);
  vm.runInContext(code.replace("let hiddenSections", "var hiddenSections") + "\nthis.api = {hideScribeOnce, scribeHandedOver, sectionOn, sectionOf, set: (s) => { hiddenSections = s; }, get: () => hiddenSections};", ctx);
  ctx.api.set(ctx.hiddenSections);
  return ctx;
}

(async () => {
  console.log("\nSwitched off once, only where NeuroScribe is built\n");
  let w = world(false);
  await w.api.hideScribeOnce({});
  ok("no NeuroScribe here: Scribe stays, and it's asked again next time", w.api.sectionOn("notes") && !w.prefs);
  w = world(true);
  await w.api.hideScribeOnce({});
  ok("NeuroScribe built: Scribe is switched off", !w.api.sectionOn("notes") && !w.api.sectionOn("notes:vault"));
  ok("  and that's remembered", w.prefs && w.prefs.scribeHiddenForNeuroScribe === true && w.prefs.hiddenSections.includes("notes"));
  w = world(true);
  await w.api.hideScribeOnce({scribeHiddenForNeuroScribe: true});
  ok("Cam turned it back on in Settings: the next start leaves it on", w.api.sectionOn("notes") && !w.calls.length);

  console.log("\nEvery Scribe page still has a way in\n");
  const i = src.indexOf('{key: "notes", name: "Scribe", children: [');
  const kids = [...src.slice(i, src.indexOf("]},", i)).matchAll(/\{key: "([\w:]+)", name: "([^"]+)"\}/g)].map((m) => m[1]);
  ok("Scribe's subsections are read from the real menu", kids.length >= 9, kids.join(" "));
  w = world(true, ["notes"]);
  const known = new Set(["", "fleeting", "page ebooks", "page ebook-marks", "page cells", "page notebooks", "page guides", "page archive", "page collab"]);
  for (const k of kids) {
    w.calls.length = 0;
    const handed = w.api.scribeHandedOver(k);
    const req = (w.calls[0] || [])[1];
    ok(k + ": opens NeuroScribe" + (req ? " (" + req + ")" : ""), handed && w.calls[0] && w.calls[0][0] === "open_neuroscribe" && known.has(req), JSON.stringify(w.calls));
  }
  w.calls.length = 0;
  w.api.scribeHandedOver("notes:vault", {path: "Folder/A note.md"});
  ok("a note from Find or the menu opens in NeuroScribe, by its path", w.calls[0][2] === "Folder/A note.md");
  w.calls.length = 0;
  w.api.scribeHandedOver("collab:board", {ref: "PT98"});
  ok("a Collaboration document opens on that document", w.calls[0][1] === "collab PT98");
  ok("other sections stay in NeuroNet", !w.api.scribeHandedOver("training:sessions") && !w.api.scribeHandedOver("boards:list") && !w.api.scribeHandedOver("cookery"));
  w = world(true, []);
  ok("Scribe switched back on: its pages open in NeuroNet again", !w.api.scribeHandedOver("notes:vault"));

  console.log("\n  " + pass + " passed, " + fail + " failed\n");
  process.exit(fail ? 1 : 0);
})();
