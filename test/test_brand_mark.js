/* ==========================================================================
   Cam's neuronet mark is the thing in the top left
   ==========================================================================
   Cam: "Can you incorporate the name part of this icon into the apps top
   bar at the top left instead of the circle thing which is there now."
   Then, with the wordmark on its own: "Please incorporate this as the icon
   in the top left of the App."

   It is his artwork, traced from the image he sent into two paths -- the
   whole wordmark, and the neuron that stands in for the "o" -- so it is
   sharp at any size instead of a green bitmap on a black square that
   would have to be cut out and would blur on a bigger screen.

   THE MARK CARRIES THE NAME, so the word that used to sit beside the old
   circle had to go or the corner would read "neuronet NeuroNet". It stays
   as the accessible name, which is checked here: a logo that spells the
   app's name in paths says nothing at all to a screen reader.

   COLLAPSED, only the neuron is left. It is the part of his mark that
   still reads at that size, and it is checked because the collapsed menu
   is 58px wide and the wordmark would either overflow or shrink to a
   smear.

   THE COLOUR IS HIS, and that took measuring. His green is #5FA665, and
   on the app's light themes it does not hold up -- 2.78 on professional,
   2.80 on icecream, and 1.92 on win98's grey, against a floor of 3:1 for
   a graphic. So the dark themes keep his exact value and the light ones
   get a deeper green, through light-dark(), which reads the color-scheme
   the theme engine already sets. Every theme is measured here rather than
   the two or three I might have thought to look at, because five of the
   nine were the problem.

   Not jsdom: light-dark() and the resolved colour behind the mark are the
   whole point, and jsdom computes neither.
   ========================================================================== */
"use strict";
const path = require("path");
const fs = require("fs");

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
    console.log("test_brand_mark: Playwright isn't installed, so the mark "
      + "can't be checked here. (npm install -g playwright)");
    process.exit(0);
  }
}

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};

/* A graphic needs 3:1 to be seen against what it sits on. The mark is not
   body text, but it IS the only thing naming the app on screen. */
const FLOOR = 3.0;

const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
const css = fs.readFileSync(path.join(UI, "shared.css"), "utf8");

/* ---- the artwork is actually in the file ------------------------------ */

ok("the wordmark is in the sprite", /<symbol id="i-neuronet"/.test(html));
ok("  and the neuron on its own is too",
  /<symbol id="i-neuronet-node"/.test(html));
ok("  they are symbols, not plain groups",
  /<symbol id="i-neuronet" viewBox=/.test(html)
  && /<symbol id="i-neuronet-node" viewBox=/.test(html),
  "every other icon in this sprite is 24x24; only a <symbol> carries its "
  + "own viewBox through <use>, so a <g> here would be cropped to a corner");
const wordLen = (html.match(/<symbol id="i-neuronet"[^>]*><path d="([^"]+)"/) || [])[1];
ok("  the wordmark is real traced artwork, not a placeholder",
  wordLen && wordLen.length > 3000, "path is " + (wordLen || "").length + " chars");

ok("the circle that used to be there is gone from the corner",
  !/id="ss-brand">[\s\S]{0,400}#i-aperture/.test(html),
  "Cam asked for the mark INSTEAD of the circle, not beside it");
ok("the word beside it is gone too",
  !/class="ss-brand-name"/.test(html),
  "the mark spells the name itself; leaving the span would read "
  + "'neuronet NeuroNet'");

ok("the mark is filled, not stroked",
  /\.ss-brand-mark[^{]*\{[^}]*fill: currentColor/.test(css.replace(/\n/g, " "))
  || /fill: currentColor; stroke: none/.test(css),
  "the sprite's icons are fill:none + stroke:currentColor via .ic; a "
  + "traced outline given that treatment disappears");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1300, height: 860}});
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => {
    const api = {ping: async () => ({ok: true}),
      library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
      photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
      get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
      read_taken_dates: async () => ({dates: {}}),
      music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
      chords_list: async () => [],
      cards_read_json: async () => ({tarotDecks: [], oracleDecks: [], lenormandDecks: [],
        tarotReadings: [], oracleReadings: [], lenormandReadings: [],
        meditation: [], journal: [], gratitude: []}),
      cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
        wordGuessList: [], slideImages: [], books: []}),
      cranium_get_prefs: async () => ({}), kc_available: async () => true,
      kc_get_data: async () => ({photos: [], albums: [], photoTagList: [], folders: [],
        events: [], contacts: [], recipes: [], menus: [], shoppingLists: [],
        books: [], tagList: []}),
      kc_get_money: async () => ({templates: [], oneoffs: [], payments: {}, goals: [],
        spendingLog: {periodStart: "", entries: []}, calc: {bills: [], income: []}}),
      kc_money_stamp: async () => 0,
      training_load: async () => ({exercises: {}, circuits: [], sessions: [], guides: [],
        questionnaires: [], calendars: [], athletes: [], equipment: [],
        circuitTypes: [], lessonPlans: []}),
      training_get_prefs: async () => ({}), training_stamp: async () => 0,
      training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
      notes_list_tree: async () => [],
      notes_read_all_notes: async () => ({notes: [], truncated: false}),
      notes_get_prefs: async () => ({}), boards_list: async () => [],
      cells_list: async () => [], notebooks_list: async () => [],
    };
    window.pywebview = {api: new Proxy(api, {get: (t, n) => (n in t ? t[n]
      : (typeof n === "string" ? async () => ({}) : undefined))})};
  });
  await page.goto("file://" + path.join(UI, "index.html"));
  await page.waitForTimeout(2200);

  const shown = () => page.evaluate(() => {
    const vis = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return getComputedStyle(el).display !== "none" && r.width > 0 && r.height > 0
        ? {w: Math.round(r.width), h: Math.round(r.height)} : false;
    };
    return {mark: vis(".ss-brand-mark"), node: vis(".ss-brand-node")};
  });

  const open = await shown();
  ok("the wordmark is on screen", !!open.mark, JSON.stringify(open));
  ok("  and it is drawn, not a zero-sized box",
    open.mark && open.mark.w > 80 && open.mark.h > 20, JSON.stringify(open.mark));
  ok("  and it fits the sidebar it sits in",
    open.mark && open.mark.w <= 216 - 20, JSON.stringify(open.mark));
  ok("  with only one of the two shown at a time", open.node === false);

  ok("a screen reader is still told the app's name",
    await page.evaluate(() => {
      const m = document.querySelector(".ss-brand-mark");
      return !!m && (m.getAttribute("aria-label") || "").trim() === "NeuroNet";
    }),
    "the name is paths now; without a label the corner is silent");

  /* ---- collapsed ------------------------------------------------------- */
  await page.evaluate(() => document.querySelector("#ss-collapse").click());
  await page.waitForTimeout(400);
  const small = await shown();
  ok("collapsed, the neuron takes over", !!small.node, JSON.stringify(small));
  ok("  and the wordmark steps aside", small.mark === false,
    "at 58px the wordmark would overflow the menu or shrink to a smear");
  ok("  the neuron is big enough for its spokes to survive",
    small.node && small.node.h >= 26, JSON.stringify(small.node)
    + " — below about 26px the fine lines close up into a blob");
  ok("  and it still fits the collapsed menu",
    small.node && small.node.w <= 58 - 14, JSON.stringify(small.node));
  await page.evaluate(() => document.querySelector("#ss-collapse").click());
  await page.waitForTimeout(400);

  /* ---- it can be seen, in every theme ---------------------------------- */
  const themes = await page.evaluate(() => Object.keys(window.CruxTheme.THEMES));
  const rows = [];
  for (const t of themes) {
    await page.evaluate((k) => window.CruxTheme.setTheme(k), t);
    await page.waitForTimeout(110);
    rows.push(Object.assign({theme: t}, await page.evaluate(() => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 1;
      const cx = cv.getContext("2d", {willReadFrequently: true});
      const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000";
        cx.fillRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
        const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
      const lum = (c) => { const f = rgb(c).map((v) => { v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
      const cr = (a, b) => { const L1 = lum(a), L2 = lum(b);
        return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05))).toFixed(2); };
      const m = document.querySelector(".ss-brand-mark");
      let e = m, bg = "rgb(0,0,0)";
      while (e) { const c = getComputedStyle(e).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; }
        e = e.parentElement; }
      return {mark: rgb(getComputedStyle(m).color).join(","),
              ratio: cr(getComputedStyle(m).color, bg)};
    })));
  }
  for (const r of rows) {
    ok(`[${r.theme}] the mark can be seen against the menu`, r.ratio >= FLOOR,
      `${r.ratio} — his raw green measured 1.92 here on win98 and under 3 on `
      + "every light theme, which is why it is not used unchanged everywhere");
  }
  /* His own colour, kept where it works -- which is the point of going to
     the trouble of light-dark() rather than one compromise green. */
  const dark = rows.filter((r) => ["hearth", "greenblack", "contrast", "plum"]
    .includes(r.theme));
  ok("the dark themes carry his own green, exactly",
    dark.length === 4 && dark.every((r) => r.mark === "95,166,101"),
    dark.map((r) => r.theme + " " + r.mark).join("; "));
  ok("the light themes use the deeper one",
    rows.filter((r) => r.mark === "46,107,56").length === 5,
    rows.map((r) => r.theme + " " + r.mark).join("; "));

  ok("the app threw nothing", errs.length === 0, errs.slice(0, 3).join(" | "));

  console.log("\ntest_brand_mark.js");
  console.log(out.join("\n"));
  console.log("\n  " + rows.map((r) => r.theme.padEnd(13) + "rgb(" + r.mark + ")"
    + "  contrast " + r.ratio).join("\n  "));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
