/* ==========================================================================
   Settings is a section like every other one
   ==========================================================================
   Cam: "Now i want the settings menu to be like the rest of the app with
   each setting in the right side bar as sub sections of the settings menu,
   default to just the theme selector sub section when opening the settings
   please"

   WHAT "LIKE THE REST OF THE APP" MEANS HERE. Every other part of NeuroNet
   is a main section on the left with its subsections on the right, and only
   the chosen subsection on screen. Settings was the one screen that ignored
   all of it: one page, 343 lines, five unrelated things stacked down it,
   and the theme cards -- the thing Cam actually opens it for -- pushed to
   the top of a scroll he had to hunt through.

   SETTINGS IS THE AWKWARD ONE, and that is what most of this file is about.
   It is reached by the gear at the bottom of the left menu, not by a row in
   it, so it is deliberately in SECTIONS (which builds the right-hand menu)
   and deliberately NOT in SECTION_ORDER (which builds the left one). Those
   two lists have always moved together; Settings is the first thing to be
   in one and not the other, so both halves are checked, and checked by
   LOOKING AT THE MENUS rather than by reading the arrays.

   AND IT MUST NOT BE HIDEABLE. "Sections shown" is built from SECTIONS, so
   adding Settings to SECTIONS put a switch on the page that turns Settings
   off -- and the way back from a hidden Settings is to edit a JSON file by
   hand. Two checks cover it: the switch is not offered, and a prefs file
   that already names "settings" (carried over, hand-edited, whatever) is
   overruled rather than obeyed.

   ONLY ONE SUBSECTION IS ON SCREEN, and that is measured, not read off the
   `hidden` attribute. All five are BUILT every time -- the wiring below
   renderSettings reaches for #set-choose, [data-sec], [data-ren-folder] and
   a dozen more by id, and building only the open one would need a guard on
   every one of them -- so "hidden" here is a fact about what Cam sees, and
   getBoundingClientRect is the only thing that knows.

   Not jsdom: this clicks real menu rows and asks what is actually visible.
   ========================================================================== */
"use strict";
const path = require("path");

const APP = process.argv[2] || path.join(__dirname, "..");
const UI = path.join(APP, "ui");

let chromium;
try {
  ({chromium} = require("playwright"));
} catch (e) {
  try {
    ({chromium} = require(require("child_process")
      .execSync("npm root -g").toString().trim() + "/playwright"));
  } catch (e2) {
    console.log("test_settings_sections: Playwright isn't installed, so the "
      + "settings menu can't be checked here. (npm install -g playwright)");
    process.exit(0);
  }
}

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};

/* The five, in the order Cam reads them down the right-hand menu. */
const WANT = ["Appearance", "Text & scale", "Sections shown",
              "Photo library", "Combine libraries"];

function makeInit(prefs) {
  const body = `
    window.__prefs = ${JSON.stringify(prefs || {})};
    const api = {
      ping: async () => ({ok: true}),
      library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
      photo_get_data: async () => ({photos: [], albums: [], folders: [],
        photoTagList: []}),
      get_prefs: async () => window.__prefs,
      set_prefs: async (p) => { Object.assign(window.__prefs, p); return {ok: true}; },
      read_taken_dates: async () => ({dates: {}}),
      music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
      chords_list: async () => [],
      cards_read_json: async () => ({tarotDecks: [], oracleDecks: [],
        lenormandDecks: [], tarotReadings: [], oracleReadings: [],
        lenormandReadings: [], meditation: [], journal: [], gratitude: []}),
      cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
        wordGuessList: [], slideImages: [], books: []}),
      cranium_get_prefs: async () => ({}), kc_available: async () => true,
      kc_get_data: async () => ({photos: [], albums: [], photoTagList: [],
        folders: [], events: [], contacts: [], recipes: [], menus: [],
        shoppingLists: [], books: [], tagList: []}),
      kc_get_money: async () => ({templates: [], oneoffs: [], payments: {},
        goals: [], spendingLog: {periodStart: "", entries: []},
        calc: {bills: [], income: []}}),
      kc_money_stamp: async () => 0,
      training_load: async () => ({exercises: {}, circuits: [], sessions: [],
        guides: [], questionnaires: [], calendars: [], athletes: [],
        equipment: [], circuitTypes: [], lessonPlans: []}),
      training_get_prefs: async () => ({}), training_stamp: async () => 0,
      training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
      notes_list_tree: async () => [],
      notes_read_all_notes: async () => ({notes: [], truncated: false}),
      notes_get_prefs: async () => ({}), boards_list: async () => [],
      cells_list: async () => [], notebooks_list: async () => [],
      effects_load: async () => ({items: [], types: []}),
    };
    window.pywebview = {api: new Proxy(api, {get: (t, n) => (n in t ? t[n]
      : (typeof n === "string" ? async () => ({}) : undefined))})};`;
  return body;
}

async function openApp(browser, prefs) {
  const page = await browser.newPage({viewport: {width: 1300, height: 900}});
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript({content: makeInit(prefs)});
  await page.goto("file://" + path.join(UI, "index.html"));
  await page.waitForTimeout(2200);
  return {page, errs};
}

/* What is actually on screen, not what the markup says. */
const visibleSections = (page) => page.evaluate(() =>
  [...document.querySelectorAll("#ss-main .set-sec")].filter((s) => {
    const r = s.getBoundingClientRect();
    return getComputedStyle(s).display !== "none" && r.width > 0 && r.height > 0;
  }).map((s) => s.getAttribute("data-set")));

const subnav = (page) => page.evaluate(() =>
  [...document.querySelectorAll("#ss-subnav-body [data-view]")]
    .map((b) => b.textContent.trim().replace(/\s+/g, " ")));

const leftMenu = (page) => page.evaluate(() =>
  [...document.querySelectorAll("#ss-nav [data-section]")]
    .map((b) => b.getAttribute("data-section")));

/* Reading text and clicking without hanging. Playwright's page.click and
   page.textContent WAIT for a selector and then time out -- thirty seconds
   and a stack trace with no result lines -- where what is wanted is a
   failed check saying the thing is not there. */
const text = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  return el ? el.textContent.trim().replace(/\s+/g, " ") : "";
}, sel);

const clickOne = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return false;
  el.click();
  return true;
}, sel);

/* Clicking a row in the right-hand menu by its name.
   It REPORTS rather than throws. Proving these checks fire meant removing
   Settings from SECTIONS on purpose, and the first version of this helper
   then died inside page.evaluate on `row.click()` of an undefined row --
   a stack trace, a non-zero exit and NO result lines at all, which a run
   that reads "n passed, n failed" cannot count. A check that cannot fail
   out loud is worse than no check. */
async function pick(page, name) {
  const found = await page.evaluate((n) => {
    const row = [...document.querySelectorAll("#ss-subnav-body [data-view]")]
      .find((b) => b.textContent.includes(n));
    if (!row) return false;
    row.click();
    return true;
  }, name);
  ok("  the right-hand menu offers " + name, found,
    "nothing in #ss-subnav-body says " + name);
  await page.waitForTimeout(350);
  return found;
}

(async () => {
  const browser = await chromium.launch();
  const {page, errs} = await openApp(browser, {});

  /* ---- the gear opens the theme selector ------------------------------ */
  ok("the gear is there at all", await clickOne(page, "#ss-settings"));
  await page.waitForTimeout(400);

  ok("the gear opens Settings on the theme selector",
    await page.evaluate(() => window.SS._test.view) === "settings:appearance",
    await page.evaluate(() => window.SS._test.view));
  ok("  and that is what the page says it is",
    (await text(page, "#ss-main .page-h")) === "Appearance",
    await text(page, "#ss-main .page-h"));
  ok("  with the theme cards on it",
    await page.evaluate(() =>
      document.querySelectorAll("#ss-main [data-theme]").length) >= 9,
    "nine themes; this is the thing Cam opens Settings for");

  /* ---- the five subsections are in the RIGHT menu --------------------- */
  const right = await subnav(page);
  ok("all five settings are in the right-hand menu",
    WANT.every((n) => right.some((r) => r.includes(n))),
    JSON.stringify(right));
  ok("  and nothing else is", right.length === 5, JSON.stringify(right));
  ok("  in the order they were written",
    WANT.every((n, i) => (right[i] || "").includes(n)), JSON.stringify(right));

  /* ---- only one of them is on screen ---------------------------------- */
  let vis = await visibleSections(page);
  ok("only the chosen setting is shown", vis.length === 1 && vis[0] === "appearance",
    JSON.stringify(vis) + " visible");
  ok("  though all five are built, so the wiring below still finds them",
    await page.evaluate(() =>
      document.querySelectorAll("#ss-main .set-sec").length) === 5,
    "five built, one shown");

  /* ---- picking another one switches the page -------------------------- */
  await pick(page, "Text & scale");
  vis = await visibleSections(page);
  ok("picking another setting shows that one instead",
    vis.length === 1 && vis[0] === "size", JSON.stringify(vis));
  ok("  and the heading follows it",
    (await text(page, "#ss-main .page-h")) === "Text & scale",
    await text(page, "#ss-main .page-h"));
  ok("  the theme cards are gone from view, not merely scrolled past",
    await page.evaluate(() => {
      const t = document.querySelector("#ss-main [data-theme]");
      if (!t) return true;
      const r = t.getBoundingClientRect();
      return r.width === 0 && r.height === 0;
    }),
    "this is the whole point: five things stacked down one page is what "
    + "Cam asked to be rid of");

  /* ---- the controls in each one still work ---------------------------- */
  const has = async (sel) => (await page.evaluate((s) =>
    !!document.querySelector(s), sel));
  ok("the photo library's folder button survived the split",
    await has("#set-choose"));
  ok("  and the merge preview",
    await has("#ss-merge-preview"));
  ok("  and the section switches", await has("[data-sec]"));
  ok("  and the text-size buttons", await has("[data-text]"));

  /* A theme is CHOSEN, not merely present: the split moved this markup
     inside a <section>, and a wiring pass that missed it would leave nine
     cards that do nothing. */
  await pick(page, "Appearance");
  const picked = await clickOne(page, '#ss-main [data-theme="plum"]');
  await page.waitForTimeout(350);
  ok("  a theme card is there to press", picked);
  ok("choosing a theme still applies it",
    picked && await page.evaluate(() => window.CruxTheme.theme) === "plum",
    await page.evaluate(() => window.CruxTheme.theme));
  ok("  and it is saved",
    await page.evaluate(() => window.__prefs.theme) === "plum",
    JSON.stringify(await page.evaluate(() => window.__prefs.theme)));

  /* ---- the left menu is unchanged ------------------------------------- */
  const left = await leftMenu(page);
  ok("Settings is NOT a row in the left menu",
    !left.includes("settings"),
    JSON.stringify(left) + " — it is reached by the gear, as it always was");
  ok("  and the gear is still there to reach it by",
    await has("#ss-settings"));
  ok("  the gear lights up while Settings is open",
    await page.evaluate(() =>
      document.getElementById("ss-settings").classList.contains("on")),
    "every other section highlights its own row; the gear is Settings' row");

  /* ---- Settings cannot be switched off -------------------------------- */
  await pick(page, "Sections shown");
  const switches = await page.evaluate(() =>
    [...document.querySelectorAll("#ss-main [data-sec]")]
      .map((b) => b.getAttribute("data-sec")));
  ok("no switch is offered that would hide Settings",
    !switches.some((s) => s === "settings" || s.startsWith("settings:")),
    JSON.stringify(switches.filter((s) => s.startsWith("settings")))
    + " — the way back from a hidden Settings is to hand-edit JSON");
  ok("  but every other section still has one",
    switches.includes("home") && switches.includes("photos")
    && switches.length > 20, switches.length + " switches");

  /* And the switches still DO something -- turning one off must take its
     row out of the left menu, or this whole page is decoration. */
  const before = (await leftMenu(page)).length;
  const flicked = await clickOne(page, '#ss-main [data-sec="money"]');
  await page.waitForTimeout(400);
  ok("  and they still work",
    flicked && (await leftMenu(page)).length === before - 1,
    before + " rows before, " + (await leftMenu(page)).length + " after");
  await clickOne(page, '#ss-main [data-sec="money"]');
  await page.waitForTimeout(300);

  ok("nothing threw while all that happened", errs.length === 0,
    errs.join(" | "));
  await page.close();

  /* ---- a prefs file that already hides Settings is overruled ----------
     Not hypothetical: hiddenSections is persisted, and any build where the
     switch existed -- or a hand-edited file -- can name it. If that were
     obeyed, Settings would vanish with no way back through the app. */
  {
    const {page: p2, errs: e2} = await openApp(browser,
      {hiddenSections: ["settings", "settings:appearance", "money"]});
    await clickOne(p2, "#ss-settings");
    await p2.waitForTimeout(400);
    ok("a prefs file that hides Settings is overruled",
      (await text(p2, "#ss-main .page-h")) === "Appearance",
      await text(p2, "#ss-main .page-h"));
    const r2 = await subnav(p2);
    ok("  and its subsections come back too",
      r2.length === 5 && WANT.every((n) => r2.some((x) => x.includes(n))),
      JSON.stringify(r2));
    ok("  while a section that really was hidden stays hidden",
      !(await leftMenu(p2)).includes("money"),
      "the override is for Settings only, not a blanket ignore of the file");
    ok("  and nothing threw", e2.length === 0, e2.join(" | "));
    await p2.close();
  }

  await browser.close();

  console.log("\ntest_settings_sections.js");
  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
