/* ==========================================================================
   Training's keyboard belongs to Training
   ==========================================================================
   Coach Cam's keydown listener came across whole. In its own app it had the
   window to itself; inside NeuroNet it heard every key on every screen, so
   Escape blurred fields elsewhere, Ctrl+F and / were taken on pages that are
   not Training, and 1-9 anywhere threw "NAV is not defined" -- the list it
   read was Coach Cam's own sidebar, which did not come across.

   Now it answers only while Training is showing, and the numbers follow the
   Training subsections in NeuroNet's menu.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const APP = process.argv[2] || path.join(__dirname, "..");
const UI = path.join(APP, "ui");

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms || 60));

const asyncFailures = [];
process.on("unhandledRejection", (reason) => {
  asyncFailures.push(String((reason && reason.message) || reason));
});

async function run() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; nothing here can run without it)"); return; }

  const prefs = {dashBlocks: [
    {id: "b-pz", type: "puzzle", col: 0, slot: 0},
    {id: "b-qr", type: "quickrecipe", col: 1, slot: 0},
    {id: "b-fv", type: "fleetview", col: 2, slot: 0},
    {id: "b-qn", type: "quicknote", col: 2, slot: 1},
  ]};
  /* A fleeting queue that behaves like the backend's: deleting one closes
     the numbers up behind it. */
  let fleeting = [
    {n: 1, text: "first thought", written: 1790000000},
    {n: 2, text: "second thought\n" + "a long line. ".repeat(80), written: 1790000100},
    {n: 3, text: "third thought", written: 1790000200},
  ];
  const deleted = [];
  const kitchenSaves = [];
  const kitchenDoc = {photos: [], albums: [], photoTagList: [], folders: [],
    events: [], contacts: [], recipes: [], menus: [], shoppingLists: [],
    books: [], tagList: []};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => JSON.parse(JSON.stringify(prefs)),
    set_prefs: async (p) => { Object.assign(prefs, p || {}); return {ok: true}; },
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    kc_available: async () => true,
    kc_get_data: async () => kitchenDoc,
    kc_save_data: async (d) => { kitchenSaves.push(JSON.parse(JSON.stringify(d))); return {ok: true}; },
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {}, goals: [],
      spendingLog: {periodStart: "", entries: []}, calc: {bills: [], income: []}}),
    training_load: async () => ({exercises: {}, circuits: [], sessions: [], guides: [],
      questionnaires: [], calendars: [], athletes: [], equipment: [],
      circuitTypes: [], lessonPlans: []}),
    training_get_prefs: async () => ({}),
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    notes_list_tree: async () => [],
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}),
    boards_list: async () => [], cells_list: async () => [],
    notebooks_list: async () => [],
    fleeting_list: async () => JSON.parse(JSON.stringify(fleeting)),
    fleeting_add: async (text) => {
      const n = fleeting.length + 1;
      fleeting.push({n, text, written: 1790000300});
      return {ok: true, n};
    },
    fleeting_delete: async (n) => {
      deleted.push(n);
      fleeting = fleeting.filter((x) => x.n !== n).map((x, i) => ({...x, n: i + 1}));
      return {ok: true};
    },
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only",
                               url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia
    || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {},
    lineTo() {}, stroke() {}, fill() {}, save() {}, restore() {},
    translate() {}, scale() {}, createLinearGradient: () => ({addColorStop() {}}),
    setTransform() {}, closePath() {}, getImageData: () => ({data: [0, 0, 0, 255]}),
  });
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(900);

  const thrown = [];
  w.addEventListener("error", (e) => thrown.push(String(e.message || e)));
  const doc = w.document;
  const key = (el, k, extra) => el.dispatchEvent(new w.KeyboardEvent("keydown",
    Object.assign({key: k, bubbles: true, cancelable: true}, extra || {})));
  const view = () => w.SS._test.view;

  w.SS.go("home:dashboard");
  await wait(1200);

  /* ---- away from Training ---------------------------------------------- */
  for (const k of ["1", "3", "9"]) key(doc.body, k);
  await wait(200);
  ok("number keys on the dashboard throw nothing", thrown.length === 0, thrown.slice(0, 2).join(" | "));
  ok("  and do not drag Cam into Training", view() === "home:dashboard", view());

  const qn = doc.querySelector("#dash-qn-text");
  qn.focus();
  key(qn, "Escape");
  ok("Escape in a dashboard text box leaves it alone", doc.activeElement === qn,
    "Training's handler blurred it: " + (doc.activeElement && doc.activeElement.tagName));
  const ctrlF = key(doc.body, "f", {ctrlKey: true});
  ok("Ctrl+F on the dashboard is not taken by Training", ctrlF === true,
    "the event was cancelled");

  /* ---- in Training ------------------------------------------------------ */
  w.SS.go("training:sessions");
  await wait(1500);
  const subs = [...doc.querySelectorAll('#ss-subnav-body [data-view^="training:"]')]
    .map((e) => e.dataset.view);
  ok("Training's subsections are in the menu", subs.length >= 2, subs.join(","));
  const shell = doc.getElementById("cf-shell");
  ok("  and Training is on screen", shell && !shell.hidden);
  if (subs.length >= 2) {
    doc.activeElement && doc.activeElement.blur && doc.activeElement.blur();
    key(doc.body, "2");
    await wait(600);
    ok("in Training, 2 opens the second subsection in the menu", view() === subs[1],
      "on " + view() + ", wanted " + subs[1]);
    key(doc.body, "1");
    await wait(600);
    ok("  and 1 the first", view() === subs[0], "on " + view());
  }
  ok("nothing threw in Training either", thrown.length === 0, thrown.slice(0, 2).join(" | "));

  /* ---- and away again --------------------------------------------------- */
  w.SS.go("home:dashboard");
  await wait(800);
  key(doc.body, "2");
  await wait(300);
  ok("leaving Training takes its keys with it", view() === "home:dashboard", view());
}

run().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_training_keys.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
