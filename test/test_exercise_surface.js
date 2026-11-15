/* ==========================================================================
   An exercise sits on its own surface, in every theme
   ==========================================================================
   Cam: "Last change for the exercises provide another background for the
   exercises so they are easier to read on the background."

   They had no background. An exercise row -- a circuit station, a session
   block, a program's work -- was painted var(--surface), which resolves to
   var(--panel), which is the SAME VALUE as the detail pane behind it. The
   only thing separating an exercise from the page was a hairline border.

   Measured before the change, row against pane, all nine themes:

       hearth 1.00   professional 1.00   greenblack 1.00
       aero   1.00   win98        1.00   icecream   1.00
       contrast 1.00 lightgreen   1.00   plum       1.00

   Exactly 1.00 every time -- not "low contrast", no contrast, the same
   colour -- with the border between 1.42 and 1.98 in seven of them. Four
   exercises in a circuit read as one dark block.

   WHY THE COLOUR IS MIXED RATHER THAN PICKED, which is the thing this
   file is really guarding. The obvious fix is var(--raised). I expected
   it to work in seven themes and fail in the two where --elevated is
   defined as the same value as --panel. Swapping it in and running this
   test says it fails in EIGHT:

       hearth 1.06   professional 1.06   greenblack 1.06
       aero   1.04   win98        1.00   icecream   1.05
       contrast 1.12 lightgreen   1.00   plum       1.06

   Only contrast clears the floor. --elevated is meant to be a hair off
   --panel -- a dialog on a panel, not a row against the page. Shipped on
   the strength of how one theme looked, it would have left the bug in
   eight of nine while the screenshot I checked looked fixed. That is the
   break this file exists to catch, and it is checked by making it.

   WHY THIS IS NOT IN JSDOM. The mechanism is color-mix(), and jsdom does
   not compute it -- nor does it resolve var() inside a custom property,
   which is how the token reaches the rule. It would report a string.
   So the app is booted in Chromium; color-mix is separately confirmed to
   work in WebKitGTK 2.52, which is the engine Cam actually runs.

   HOW THE COLOURS ARE READ, because I got this wrong first time round.
   color-mix resolves to "color(srgb 0.15 0.12 0.11)" -- components in
   0-1, not 0-255. The first version of this measurement parsed the
   numbers out of the string and divided by 255 regardless, which turned
   every reading into nonsense: light themes reported separations of 19+
   and dark ones 1.08, and both were meaningless. Nothing is parsed now.
   Each colour is painted into a 1x1 canvas and read back, so whatever
   notation the engine chooses, what is measured is the pixel.
   ========================================================================== */
"use strict";
const fs = require("fs");
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
    console.log("test_exercise_surface: Playwright isn't installed, so the "
      + "exercise surface can't be checked here.");
    console.log("  (npm install -g playwright — jsdom cannot do this one: it "
      + "computes neither color-mix() nor var() inside a custom property.)");
    process.exit(0);
  }
}

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};

/** A circuit with four exercises in it — the rows this is about. */
function stub() {
  const data = {
    exercises: {"Lower body": {"Back Squat": {instructions: "Brace and descend.",
      bodyParts: ["Quads"], photos: []}}},
    circuits: [{id: "c1", name: "Lower Power", rounds: 3, type: "AMRAP",
      timeCap: "", notes: "", tags: [], guides: [], log: [],
      stations: [
        {name: "Back Squat", reps: 8, work: 0, rest: 0},
        {name: "Romanian Deadlift", reps: 10, work: 0, rest: 0},
        {name: "Pull-up", reps: 6, work: 0, rest: 0},
        {name: "Farmer Carry", work: 40, rest: 20},
      ]}],
    sessions: [], guides: [], questionnaires: [], calendars: [], athletes: [],
    equipment: [], circuitTypes: [], lessonPlans: [],
  };
  const api = {
    ping: async () => ({ok: true}),
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    music_write_json: async () => ({ok: true}),
    chords_list: async () => [],
    cards_read_json: async () => ({tarotDecks: [], oracleDecks: [], lenormandDecks: [],
      tarotReadings: [], oracleReadings: [], lenormandReadings: [],
      meditation: [], journal: [], gratitude: []}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    kc_available: async () => true,
    kc_get_data: async () => ({photos: [], albums: [], photoTagList: [], folders: [],
      events: [], contacts: [], recipes: [], menus: [], shoppingLists: [],
      books: [], tagList: []}),
    kc_save_data: async () => ({ok: true}),
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {}, goals: [],
      spendingLog: {periodStart: "", entries: []}, calc: {bills: [], income: []}}),
    kc_save_money: async () => ({ok: true}),
    kc_money_stamp: async () => 0,
    training_load: async () => JSON.parse(JSON.stringify(data)),
    training_save: async () => ({ok: true}),
    training_stamp: async () => 0,
    training_get_prefs: async () => ({}),
    training_set_prefs: async () => ({ok: true}),
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    notes_list_tree: async () => [], notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}), boards_list: async () => [],
    cells_list: async () => [], notebooks_list: async () => [],
  };
  window.pywebview = {api: new Proxy(api, {get: (t, n) => (n in t ? t[n]
    : (typeof n === "string" ? async () => ({}) : undefined))})};
}

/* A row must be visibly its own surface. 1.00 is what it was; the mix
   lands between 1.18 and 1.27. 1.10 is the floor -- below that a theme
   has quietly gone back to painting the row in the page's colour. */
const FLOOR = 1.10;
/* And making it a card must not have cost the readability of the words
   on it. AAA is 7.0 for body text. */
const TEXT_FLOOR = 7.0;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(stub);
  await page.goto("file://" + path.join(UI, "index.html"));
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.SS.go("training:circuits"));
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    const c = [...document.querySelectorAll("#cf-shell .card, #cf-shell .list > *")]
      .find((e) => /Lower Power/.test(e.textContent));
    if (c) c.click();
  });
  await page.waitForTimeout(800);

  ok("a circuit's exercises are on screen",
    await page.evaluate(() => document.querySelectorAll("#cf-shell .station").length >= 4),
    "without rows to measure every check below would pass vacuously");

  const themes = await page.evaluate(() => Object.keys(window.CruxTheme.THEMES));
  const rows = [];
  for (const t of themes) {
    await page.evaluate((k) => window.CruxTheme.setTheme(k), t);
    await page.waitForTimeout(110);
    rows.push(Object.assign({theme: t}, await page.evaluate(() => {
      /* Let the engine paint each colour and read the pixel back, so the
         notation it chose -- rgb(), color(srgb ...) -- cannot mislead. */
      const cv = document.createElement("canvas"); cv.width = cv.height = 1;
      const cx = cv.getContext("2d", {willReadFrequently: true});
      const rgb = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000";
        cx.fillRect(0, 0, 1, 1); cx.fillStyle = css; cx.fillRect(0, 0, 1, 1);
        const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
      const lum = (css) => { const f = rgb(css).map((v) => { v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
      const cr = (a, b) => { const L1 = lum(a), L2 = lum(b);
        return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05))).toFixed(3); };
      const bgOf = (el) => { let e = el; while (e) {
        const c = getComputedStyle(e).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
        e = e.parentElement; } return "rgb(0,0,0)"; };
      const st = document.querySelector("#cf-shell .station");
      const rowBg = getComputedStyle(st).backgroundColor;
      const pane = bgOf(st.parentElement);
      const name = st.querySelector(".station-name");
      return {row: rgb(rowBg).join(","), pane: rgb(pane).join(","),
              sep: cr(rowBg, pane),
              text: cr(getComputedStyle(name).color, rowBg)};
    })));
  }

  ok("the measurement resolves colours instead of parsing them",
    rows.every((r) => /^\d+,\d+,\d+$/.test(r.row)),
    "a colour that came back unresolved would make every ratio below a "
    + "guess; color-mix prints components in 0-1 and rgb() in 0-255");

  for (const r of rows) {
    ok(`[${r.theme}] the exercise has its own surface`, r.sep >= FLOOR,
      `separation ${r.sep} (row ${r.row} vs pane ${r.pane}); it was 1.00 `
      + "before this change, meaning the identical colour");
  }
  for (const r of rows) {
    ok(`[${r.theme}] its words are still easy to read on it`, r.text >= TEXT_FLOOR,
      `${r.text}, below AAA's ${TEXT_FLOOR}`);
  }

  ok("no theme was left behind",
    rows.length === themes.length && rows.every((r) => r.sep >= FLOOR),
    "the point of mixing the colour rather than naming one is that a "
    + "theme cannot opt out by setting --elevated equal to --panel, which "
    + "is exactly what win98 and lightgreen do");

  ok("the app booted without throwing", errs.length === 0, errs.slice(0, 3).join(" | "));

  console.log("\ntest_exercise_surface.js");
  console.log(out.join("\n"));
  console.log("\n  " + rows.map((r) => r.theme.padEnd(13)
    + "separation " + String(r.sep).padEnd(7)
    + " text " + String(r.text).padEnd(7)).join("\n  "));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
