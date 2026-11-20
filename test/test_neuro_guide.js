/* ==========================================================================
   The Neuro Guide says what's true (NeuroNet System plan, Stage 4).
   ==========================================================================
   Cam: "a manual built for NeuroNet based off omarchys one ... easy to
   digest", named "Neuro Guide", covering "all omarchy and NeuroNet". A
   manual that has drifted from the system is worse than none, because it's
   believed -- so, as test_guides.js does for Notes' guides:

     * NeuroNet's shortcut table is exactly the installed shortcuts
       (system/hypr/bindings.lua.block) -- none missing, none made up;
     * every Omarchy key the guide mentions, in a table or in a page, is one
       of Omarchy's own (`omarchy menu keybindings`, when on Omarchy);
     * the menu's chapters (app.js SECTIONS) are the guide's chapters;
     * every main section of NeuroNet has a page;
     * every page has a title, a blurb and something to read.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const {execSync} = require("child_process");

const UI = path.join(__dirname, "..", "ui");
const SYS = path.join(__dirname, "..", "system");
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log("  ok    " + name); }
  else { failed++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
}

/* the guide, loaded as the app loads it (it only needs window.SS) */
const src = fs.readFileSync(path.join(UI, "guide", "guide.js"), "utf8");
const window = {SS: {}};
new Function("window", "SS", src.replace(/^\(\(\) => \{/m, "(() => {"))(window, window.SS);
const G = window.SS.NeuroGuide;
ok("the guide loads", G && Array.isArray(G.VIEWS) && G._test, "no SS.NeuroGuide");
const {CHAPTERS, NEURONET_KEYS, OMARCHY_KEYS, OPENS, SHOTS, printDoc} = G._test;

/* "SUPER + ALT + N" and "SUPER ALT + N" are the same combo */
const norm = (k) => k.toUpperCase().replace(/\s*\+\s*/g, " ").replace(/\s+/g, " ").trim()
  .split(" ").sort().join(" ");

/* ---- 1. NeuroNet's shortcuts: exactly the installed ones ---------------- */
{
  const block = fs.readFileSync(path.join(SYS, "hypr", "bindings.lua.block"), "utf8");
  // NeuroTrain's key is Training's (it opens NeuroNet's Training where NeuroTrain isn't installed)
  const installed = [...block.matchAll(/o\.bind\("([^"]+)",\s*"Neuro(?:Net|Train|Stream)[^"]*"/g)].map((m) => norm(m[1]));
  const guide = NEURONET_KEYS.map(([k]) => norm(k));
  const missing = installed.filter((k) => !guide.includes(k));
  const invented = guide.filter((k) => !installed.includes(k));
  ok("NeuroNet's shortcut table has every installed NeuroNet shortcut", !missing.length, "missing: " + missing.join(", "));
  ok("  and none that aren't installed", !invented.length, "not a NeuroNet shortcut: " + invented.join(", "));
  // E was the class timer's; since 2026-10-01 it's Code's (E for editor)
  ok("  and not the class timer's, which is gone (2026-09-29)",
     !NEURONET_KEYS.some(([, what]) => /timer/i.test(what)));
}

/* ---- 2. Omarchy's shortcuts: each one of Omarchy's own ------------------- */
{
  let listed = null;
  try { listed = execSync("omarchy menu keybindings --print", {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20000}); }
  catch (e) { listed = null; }
  if (!listed) {
    console.log("  skip  Omarchy's keys (not on an Omarchy computer)");
  } else {
    // Omarchy 4.5 lists a key's aliases on one line: "SUPER + W / SUPER + Q  → Close window"
    const omarchy = new Set(listed.split("\n").flatMap((l) => l.split("→")[0].split(" / ")).filter((k) => k.trim()).map(norm));
    const neuronet = new Set(NEURONET_KEYS.map(([k]) => norm(k)));
    const inTable = OMARCHY_KEYS.map(([k]) => k).filter((k) => !omarchy.has(norm(k)));
    ok("every key in the Omarchy table is one of Omarchy's", !inTable.length, "not Omarchy's: " + inTable.join(", "));
    /* every key named anywhere in the pages: keys("...") and key tables */
    const named = [...src.matchAll(/keys\("([^"]+)"\)/g), ...src.matchAll(/\[\["([A-Z][^"]+)",/g),
                   ...src.matchAll(/\],\s*\n?\s*\["([A-Z][^"]+)",/g)].map((m) => m[1]);
    // keys that belong to an app, not the desktop: Quick note's save
    // and a key on its own ("hold Super and drag") is a key, not a shortcut
    const INSIDE_APPS = new Set([norm("CTRL + RETURN"), norm("RETURN"), norm("SUPER")]);
    const unknown = [...new Set(named)].filter((k) => !omarchy.has(norm(k)) && !neuronet.has(norm(k))
                                                     && !INSIDE_APPS.has(norm(k)));
    ok("every key named in the pages is Omarchy's or NeuroNet's", !unknown.length, "unknown: " + unknown.join(", "));
  }
}

/* ---- 3. the menu's chapters are the guide's ------------------------------- */
{
  const app = fs.readFileSync(path.join(UI, "app.js"), "utf8");
  const blk = app.slice(app.indexOf('{key: "guide", name: "Neuro Guide", children: ['));
  const menu = [...blk.slice(0, blk.indexOf("]}")).matchAll(/\{key: "(guide:[a-z]+)", name: "([^"]+)"\}/g)]
    .map((m) => m[1] + "=" + m[2]);
  const guide = CHAPTERS.map((c) => "guide:" + c.id + "=" + c.name);
  ok("the menu's chapters are the guide's, in order", JSON.stringify(menu) === JSON.stringify(guide),
     "menu: " + menu.join(" | ") + "\n          guide: " + guide.join(" | "));
  ok("  and it's in the left menu (SECTION_ORDER)", /const SECTION_ORDER = \[[^\]]*"guide"\]/.test(app));
  ok("  and the router knows guide: views are the Neuro Guide's",
     /guide: "guide"\}\[prefix\]/.test(app) && app.includes("SS.NeuroGuide,")
     && /guide: \{icon: "i-neuron", accent: "#5FA665"/.test(app));
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  ok("  and index.html loads it", html.includes('src="guide/guide.js"') && html.includes('href="guide/guide.css"'));
}

/* ---- 4. every main section of NeuroNet has a page ------------------------ */
{
  const sections = CHAPTERS.find((c) => c.id === "sections");
  const titles = sections.topics.map((t) => t.title);
  /* Music and Stuff are one section, M&T, since 2026-10-02 */
  const want = ["Home", "Photos", "M&T", "Training", "Scribe", "Creative", "Kitchen", "Money",
                "Puzzles", "Divination", "Mindfulness", "Code", "Settings"];
  const missing = want.filter((w) => !titles.includes(w));
  ok("every main section of NeuroNet has a page", !missing.length, "missing: " + missing.join(", "));
}

/* ---- 5. the shape of every page ------------------------------------------- */
{
  const bad = [];
  for (const c of CHAPTERS) {
    if (!c.id || !c.name || !c.intro || !/^#[0-9a-f]{6}$/i.test(c.colour) || !c.topics.length) bad.push(c.id || "?");
    for (const t of c.topics) {
      if (!t.id || !t.title || !t.blurb || String(t.body).replace(/<[^>]+>/g, "").trim().length < 60) bad.push(c.id + "/" + t.id);
    }
  }
  ok("every chapter has a name, a colour and topics; every page something to read", !bad.length, bad.join(", "));
  const ids = CHAPTERS.flatMap((c) => c.topics.map((t) => c.id + "/" + t.id));
  ok("  and no two pages share a name", new Set(ids).size === ids.length);
}

/* ---- 6. "Open in NeuroNet" goes somewhere real ---------------------------- */
{
  const app = fs.readFileSync(path.join(UI, "app.js"), "utf8");
  const order = JSON.parse(app.match(/const SECTION_ORDER = (\[[^\]]*\])/)[1]);
  const views = new Set([...app.matchAll(/\{key: "([a-z]+:[a-z-]+)"/g)].map((m) => m[1]));
  const pages = new Set(CHAPTERS.flatMap((c) => c.topics.map((t) => c.id + "/" + t.id)));
  const bad = Object.entries(OPENS).filter(([page, [to, label]]) =>
    !pages.has(page) || !label || !(to.includes(":") ? views.has(to) : order.includes(to)));
  ok("every Open in NeuroNet button goes to a real section or page", !bad.length,
     bad.map(([p, [to]]) => p + " -> " + to).join(", "));
  const sectionPages = CHAPTERS.find((c) => c.id === "sections").topics.map((t) => "sections/" + t.id);
  const without = sectionPages.filter((p) => !OPENS[p]);
  ok("  and every section's page has one", !without.length, "none on: " + without.join(", "));
  ok("  and app.js has SS.openSection", /SS\.openSection = \(key\) =>/.test(app));
}

/* ---- 6b. the screenshots (sample data, system/guide-shots.sh) ------------- */
{
  const pages = new Set(CHAPTERS.flatMap((c) => c.topics.map((t) => c.id + "/" + t.id)));
  const shots = path.join(UI, "guide", "shots");
  const bad = Object.entries(SHOTS).filter(([page, name]) =>
    !pages.has(page) || !fs.existsSync(path.join(shots, name + ".jpg")));
  ok("every screenshot belongs to a real page and its file is there", !bad.length,
     bad.map(([p, n]) => p + " -> " + n).join(", "));
  const without = Object.keys(OPENS).filter((p) => !SHOTS[p]);
  ok("  and every page with an Open button has a picture", !without.length, "none on: " + without.join(", "));
  ok("  and the printable edition carries them", printDoc(CHAPTERS, true).includes('class="shot"'));
}

/* ---- 7. the printable edition ---------------------------------------------- */
{
  const whole = printDoc(CHAPTERS, true);
  const titles = CHAPTERS.flatMap((c) => c.topics.map((t) => t.title));
  const plain = whole.replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const missing = titles.filter((t) => !plain.includes(">" + t + "<"));
  ok("the whole-guide document has a cover and contents", whole.includes('class="cover"') && whole.includes("<h2>Contents</h2>"));
  ok("  and every page", !missing.length, "missing: " + missing.join(", "));
  ok("  and each chapter in its colour", CHAPTERS.every((c) => whole.includes(`--c:${c.colour}`)));
  const one = printDoc([Object.assign({}, CHAPTERS[0], {topics: [CHAPTERS[0].topics[0]]})], false);
  ok("a single page prints without the cover", !one.includes('class="cover"') && one.includes(CHAPTERS[0].topics[0].title));
  /* the backend, split by section since 2026-10-06 (neuronet.py + api/*.py) */
  const py = [path.join(__dirname, "..", "neuronet.py")].concat(fs.readdirSync(path.join(__dirname, "..", "api"))
    .filter((f) => f.endsWith(".py")).map((f) => path.join(__dirname, "..", "api", f))).map((f) => fs.readFileSync(f, "utf8")).join("\n");
  ok("  and the app can save it as a PDF (guide_save_pdf)", /def guide_save_pdf\(self, html/.test(py) && /def guide_pdf\(/.test(py));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
