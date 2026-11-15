/* ==========================================================================
   The visualizer is drawn in the colours of whatever theme the app is in
   ==========================================================================
   Cam: "change the visualizer so it matches each theme, for example the
   blue visualizer does not fit the theme in the image provided."

   WHAT WAS WRONG. themeColors() asked document.documentElement for
   --chord-btn, --chord-btn-deep and --gold. Those three have never been
   declared on :root. They are declared on #ch-shell (chords.css ~line
   59) and re-pointed there by the theme bridge at the end of the same
   file (--chord-btn: var(--accent)). So every lookup came back empty,
   every || fired, and the visualizer drew in the literal #63B8F5 that
   sat behind them -- a fixed blue, in all nine themes, which is exactly
   the screenshot Cam sent.

   Measured before the change, with the app in Hearth:

       :root      --chord-btn   (empty)
       :root      --accent      #C7392C
       #ch-shell  --chord-btn   #C7392C
       canvas     --chord-btn   #C7392C

   The right colour was one inheritance away and nobody was asking the
   element that had it.

   WHY THIS TEST IS NOT IN JSDOM, unlike the rest of the suite. The whole
   mechanism here is a custom property whose value is another custom
   property -- --chord-btn: var(--accent) -- and jsdom does not resolve
   that. Asked, it returns the STRING "var(--accent)". A jsdom version of
   this test would compare two strings, find them unequal, and report a
   colour that is not a colour; or worse, be written to expect the string
   and pass forever. So this one boots the real app in Chromium. If
   Playwright is not installed it says so and exits 0 rather than
   failing, so `for f in *.js; do node "$f"; done` still runs clean.

   WHAT IS CHECKED, and how it is kept honest:

     1. the themes really are changing -- the nine themes must produce
        nine different :root --accent values. Without this the rest is
        worthless, and it very nearly was: the first version of this
        probe called window.crux.theme.set(), which does not exist, and
        fell through to setting a data-theme attribute. Themes are
        applied as INLINE STYLE on :root by CruxTheme.applyTheme, not by
        [data-theme] rules, so the attribute changed and not one colour
        did. All nine rows came back identical and looked like a pass.
     2. the visualizer's OWN themeColors() is called -- not a copy of
        the lookup written here. A test that reads the CSS variables
        itself passes even when the drawing code never does.
     3. every colour it returns is a real colour, not an unresolved
        var() and not empty.
     4. the bars follow the theme's accent, in all nine.
     5. #63B8F5 appears in none of them.
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
    console.log("test_visualizer_theme: Playwright isn't installed, so the "
      + "themed visualizer can't be checked here.");
    console.log("  (npm install -g playwright — jsdom cannot do this one: it "
      + "does not resolve var() inside a custom property.)");
    process.exit(0);
  }
}

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};

/** A backend stub just rich enough for the app to boot and reach the
    visualizer. Nothing here decides a colour; the colours come from the
    app's own CSS and its own theme module. */
function stub() {
  const tracks = {};
  for (let i = 0; i < 6; i++) {
    tracks["t" + i + ".flac"] = {title: "Track " + i, artist: "A", album: "B",
      art: "", duration: 100, plays: 0, added: i};
  }
  const nothing = {};
  const api = {
    ping: async () => ({ok: true}),
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: JSON.parse(JSON.stringify(tracks)),
                                   playlists: [], albums: []}),
    music_write_json: async () => ({ok: true}),
    music_thumb_url: async () => null,
    music_image_url: async () => null,
    chords_list: async () => Object.keys(tracks).map((n) => ({name: n, size: 1})),
    chords_audio_url: async () => ({url: "data:audio/mpeg;base64,SUQz", streamed: true}),
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
    training_load: async () => ({exercises: {}, circuits: [], sessions: [], guides: [],
      questionnaires: [], calendars: [], athletes: [], equipment: [],
      circuitTypes: [], lessonPlans: []}),
    training_save: async () => ({ok: true}),
    training_stamp: async () => 0,
    training_get_prefs: async () => ({}),
    training_set_prefs: async () => ({ok: true}),
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    notes_list_tree: async () => [],
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}),
    boards_list: async () => [],
    cells_list: async () => [],
    notebooks_list: async () => [],
  };
  window.pywebview = {api: new Proxy(api, {
    get: (t, n) => (n in t ? t[n]
      : (typeof n === "string" ? async () => nothing : undefined)),
  })};
}

const isColour = (s) => /^#[0-9a-f]{3,8}$|^rgba?\(/i.test(String(s || "").trim());
const norm = (s) => String(s || "").trim().toLowerCase();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1280, height: 860}});
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(stub);
  await page.goto("file://" + path.join(UI, "index.html"));
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.SS.go("music:visualizer"));
  await page.waitForTimeout(800);

  ok("the visualizer canvas is on the page",
    await page.evaluate(() => !!document.getElementById("viz-canvas")));
  ok("the visualizer exposes the colours it will draw with",
    await page.evaluate(() => !!(window.CH && window.CH.Visualizer
      && window.CH.Visualizer._test
      && typeof window.CH.Visualizer._test.themeColors === "function")),
    "CH.Visualizer._test.themeColors is what this test reads; without it "
    + "the test would have to keep its own copy of the lookup, which would "
    + "pass whatever the drawing code did");

  const themes = await page.evaluate(() => Object.keys(window.CruxTheme.THEMES));
  ok("every theme in the app is checked, not a chosen few",
    themes.length >= 5, "found " + themes.length);

  const rows = [];
  for (const t of themes) {
    const applied = await page.evaluate((k) => window.CruxTheme.setTheme(k), t);
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => {
      /* ASK THE VISUALIZER. Not the stylesheet. */
      const c = window.CH.Visualizer._test.themeColors();
      return {barColor: c.barColor, barColorDeep: c.barColorDeep, gold: c.gold,
              accent: getComputedStyle(document.documentElement)
                .getPropertyValue("--accent").trim(),
              star: getComputedStyle(document.documentElement)
                .getPropertyValue("--star").trim(),
              now: window.CruxTheme.theme};
    });
    rows.push({theme: t, applied, ...r});
  }

  /* 1. the premise: the themes really did change. */
  const accents = new Set(rows.map((r) => norm(r.accent)));
  ok("switching theme really changes the theme",
    accents.size === themes.length,
    themes.length + " themes produced " + accents.size + " distinct accents. "
    + "If this is 1, the switch did nothing and every other line below is "
    + "meaningless -- which is exactly what happened when this was first "
    + "written against a setter that does not exist.");
  ok("CruxTheme.setTheme accepted every theme",
    rows.every((r) => r.applied === true && r.now === r.theme));

  /* 2/3. real colours, per theme. */
  for (const r of rows) {
    ok("[" + r.theme + "] bars are a real colour", isColour(r.barColor), String(r.barColor));
    ok("[" + r.theme + "] the deep end is a real colour", isColour(r.barColorDeep),
      String(r.barColorDeep));
    ok("[" + r.theme + "] the tips are a real colour", isColour(r.gold), String(r.gold));
  }
  ok("no colour comes back as an unresolved var()",
    !rows.some((r) => /var\(/.test(r.barColor + r.barColorDeep + r.gold)));

  /* 4. they follow the theme. */
  const off = rows.filter((r) => norm(r.barColor) !== norm(r.accent));
  ok("the bars are the theme's accent in every theme", off.length === 0,
    off.map((r) => r.theme + ": bars " + r.barColor + " vs accent " + r.accent)
      .join("; "));
  ok("the bars are a different colour in every theme",
    new Set(rows.map((r) => norm(r.barColor))).size === themes.length);
  ok("the tips are not one fixed colour across all themes",
    new Set(rows.map((r) => norm(r.gold))).size > 1,
    "gold comes from --star, which each theme sets; one value across all "
    + "of them means it is being read off :root again");
  /* The tips specifically, and this line earns its place. Reading the
     colours off :root instead of the canvas, but keeping the --accent
     family as the fallback, brings the BARS back to the theme and leaves
     the tips falling through to --good -- green tips, in every theme,
     varying per theme, passing every other line above. Only this one
     catches it. --gold is bridged from --star on #ch-shell. */
  const wrongTips = rows.filter((r) => norm(r.gold) !== norm(r.star));
  ok("the tips are the theme's own star colour", wrongTips.length === 0,
    wrongTips.map((r) => r.theme + ": tips " + r.gold + " vs --star " + r.star)
      .join("; "));

  /* 5. the actual reported symptom. */
  const blue = rows.filter((r) => norm(r.barColor) === "#63b8f5");
  ok("the hardcoded blue is gone", blue.length === 0,
    blue.length + " theme(s) still draw #63B8F5");

  ok("the app booted without throwing", errs.length === 0, errs.slice(0, 3).join(" | "));

  console.log("\ntest_visualizer_theme.js");
  console.log(out.join("\n"));
  console.log("\n  " + rows.map((r) =>
    r.theme.padEnd(13) + "bars " + String(r.barColor).padEnd(9)
    + " deep " + String(r.barColorDeep).padEnd(9)
    + " tips " + String(r.gold).padEnd(9)).join("\n  "));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
