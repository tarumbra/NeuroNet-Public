/* ==========================================================================
   Stuff -- Media and inventories, their printouts and exports
   ==========================================================================
   Cam: "lets create a new main section called Stuff, this will act as the
   section where i can make inventories, databases of all our media ... I
   want the print out to also match the others however contain the
   collection icon file. Further i want to be able to select what i print,
   so i can choose to only print DVDs, CDS or a mixture. Further i want the
   print outs and lists alphabetical when stored in the app and when
   printed. Also i want to be able to export to excell as well or cells
   located in the notes subsection of the app."

   Replaces test_effects.js, which drove Personal Effects in Playwright;
   every behaviour it guarded is carried here, and run in jsdom so it runs.
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

// Media v2 (15 Nov 2026): a kind (film, music ...) with the formats it's owned in
let effects = {items: [
  {id: "a", title: "Zulu", type: "film", formats: ["DVD"], year: "1964"},
  {id: "b", title: "aliens", type: "film", formats: ["DVD"], year: "1986"},
  {id: "c", title: "Rocky 10", type: "film", formats: ["VHS"]}, {id: "d", title: "Rocky 2", type: "film", formats: ["VHS"]},
  {id: "e", title: "Abbey Road", type: "music", formats: ["CD"], creator: "The Beatles"}], types: [], mediaVersion: 2};
let stuff = {inventories: []};
const saves = [], printed = [], exported = [], cells = [];

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
    effects_load: async () => JSON.parse(JSON.stringify(effects)),
    effects_save: async (d) => { effects = JSON.parse(JSON.stringify(d)); saves.push("media"); return {ok: true}; },
    stuff_load: async () => JSON.parse(JSON.stringify(stuff)),
    stuff_save: async (d) => { stuff = JSON.parse(JSON.stringify(d)); saves.push("stuff"); return {ok: true}; },
    print_header: async (t, o) => `<div class="LH">NN | ${t} | ${o.subtitle} | ${o.logo} ${o.name}</div>`,
    open_print_document: async (html, kind) => { printed.push([html, kind]); return true; },
    stuff_export: async (fmt, p) => { exported.push([fmt, p]); return {ok: true, path: "/Desktop/x." + fmt}; },
    cells_list: async () => [],
    cells_write: async (id, sheet) => { cells.push([id, sheet]); return {ok: true}; },
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
  w.addEventListener("unhandledrejection", (e) =>
    thrown.push("unhandled: " + String((e.reason && e.reason.message) || e.reason)));
  const doc = w.document, $ = (s) => doc.querySelector(s), $$ = (s) => [...doc.querySelectorAll(s)];
  const button = (label) => $$("button").find((b) => b.textContent.trim() === label);
  const sections = () => $$(".pe-section").map((s) => ({
    name: s.querySelector(".pe-h").childNodes[0].textContent.trim(),
    titles: [...s.querySelectorAll(".bd-name")].map((n) => n.textContent)}));
  await wait(300);

  /* ---- where it lives (Media went to NeuroStream's My Media, 19 Nov 2026) ---- */
  ok("Stuff (M&T) is a main section of its own", !!$('#ss-nav [data-section="stuff"]'));
  w.SS.go("home:effects"); await wait(700);
  ok("the old Personal Effects and Media views land on M&T's Inventories", w.SS._test.view === "stuff:inventories", w.SS._test.view);
  w.SS.go("stuff:media"); await wait(500);
  ok("  and so does the old Media page", w.SS._test.view === "stuff:inventories", w.SS._test.view);
  w.SS.go("music:library"); await wait(500);
  ok("  and the old Music pages", w.SS._test.view === "stuff:inventories", w.SS._test.view);

  /* ---- inventories ---------------------------------------------------------- */
  w.SS.go("stuff:inventories"); await wait(600);
  $("#st-newinv").click(); await wait(200);
  $("#st-invname").value = "Garage"; button("Create").click(); await wait(800);
  ok("a new inventory opens", /^stuff:inv:/.test(w.SS._test.view));
  ok("  and joins the M&T menu by name, then Inventories (Music and Media are NeuroStream's now)",
    $$("#ss-subnav-body [data-view]").map((b) => b.dataset.view.replace(/^stuff:inv:.*/, "inv"))
      .join() === "inv,stuff:inventories",
    $$("#ss-subnav-body [data-view]").map((b) => b.dataset.view).join());
  $('[data-st="add"]').click(); await wait(200);
  ok("an inventory has an item, a category, a quantity and a place",
    ["#st-f-title", "#st-type", "#st-f-quantity", "#st-f-location", "#st-f-notes"].every((s) => $(s)));
  $("#st-f-title").value = "Drill"; $("#st-f-quantity").value = "2"; $("#st-f-location").value = "Top shelf";
  button("Add").click(); await wait(500);
  const inv = stuff.inventories[0];
  ok("  saved into the inventory", inv && inv.name === "Garage" && inv.items[0].title === "Drill"
    && inv.items[0].quantity === "2" && inv.items[0].location === "Top shelf");
  ok("  and listed with its quantity and place", /× 2 · Top shelf/.test($(".bd-meta").textContent));
  $('[data-st="print"]').click(); await wait(200);
  button("Print").click(); await wait(400);
  const invPage = (printed[0] || [])[0] || "";
  ok("an inventory prints on the same letterhead, under its own name",
    /NN \| Inventory \| {2}\| collection\.png collection/.test(invPage) && /class="nn-title">Garage</.test(invPage));
  ok("  counted as an inventory print", (printed[0] || [])[1] === "stuff-inventory");

  const broke = [...thrown, ...asyncFailures];
  ok("the app threw nothing", broke.length === 0, broke.slice(0, 3).join(" | "));
}

run().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_stuff.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
