/* ==========================================================================
   NeuroNet's reader (ui/reader) -- what the desktop Bookshelf opens.
   ==========================================================================
   Cam: "i can read within the window or click again to enter reading mode"
   and "the ability to zoom in as well so i can focus in words".

   Boots the real app in jsdom with a fake back end holding one book of each
   kind NeuroNet makes, opens each in the reader, and works its controls.
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
process.on("unhandledRejection", (r) => asyncFailures.push(String((r && r.message) || r)));

const hidden = [], printed = [], trainingAsked = [];

async function run() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; nothing here can run without it)"); return; }

  const training = {exercises: {}, circuits: [], guides: [], questionnaires: [], calendars: [], athletes: [],
    equipment: [], circuitTypes: [], lessonPlans: [], programs: [], documents: [],
    sessions: [{id: "s1", name: "Intervals"}],
    books: [{id: "t1", name: "Maximal Aerobic Speed", entries: [{type: "session", refId: "s1"}, {type: "session", refId: "gone"}]}]};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    kc_available: async () => true,
    kc_get_data: async () => ({photos: [], albums: [], photoTagList: [], folders: [], events: [], contacts: [],
      recipes: [{id: "rc1", name: "Roast", ingredients: ["lamb"], steps: ["cook"], tags: [], images: []}],
      menus: [], shoppingLists: [], tagList: [], books: [{id: "rb1", name: "Sunday dinners", recipeIds: ["rc1"]}]}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [], wordGuessList: [], slideImages: [],
      books: [{id: "p1", name: "Holiday puzzles", puzzles: [{id: "x", game: "sudoku",
        data: {puzzle: Array(81).fill(0), solution: Array(81).fill(5), difficulty: "easy"}}]}]}),
    cranium_get_prefs: async () => ({}),
    training_load: async () => JSON.parse(JSON.stringify(training)),
    training_get_prefs: async () => ({}),
    training_document_html: async (kind, rec) => {
      trainingAsked.push([kind, rec]);
      return {html: `<html><body><h1>${rec.name}</h1><p>${rec.entries.map((e) => e.record.name).join(",")}</p></body></html>`};
    },
    notebooks_read: async (id) => (id === "nb1" ? {id: "nb1", name: "Reading notes", entries: []} : {error: "gone"}),
    print_header: async (t) => `<div class="LH">${t}</div>`,
    quick_hide: async () => { hidden.push(1); return {ok: true}; },
    open_print_document: async (html, kind) => { printed.push([html, kind]); return {ok: true}; },
    stuff_load: async () => ({inventories: []}),
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = () => ({matches: false, addListener() {}, removeListener() {}});
  w.scrollTo = () => {};
  w.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  w.cancelAnimationFrame = (id) => clearTimeout(id);
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {get: (t, n) =>
    n === "getImageData" ? () => ({data: [0, 0, 0, 255]}) : n === "measureText" ? () => ({width: 5})
      : () => ({addColorStop() {}})});
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(900);
  const thrown = [];
  w.addEventListener("error", (e) => thrown.push(String(e.message || e)));
  const doc = w.document, $ = (s) => doc.querySelector(s);
  const R = w.SS.Reader;
  const frame = () => $("#nn-reader .rd-frame");
  /* jsdom doesn't load srcdoc into the frame, so what the reader would show
     is read from the attribute, and its page is loaded by hand to work the
     zoom and paper. */
  const shown = () => frame().getAttribute("srcdoc") || "";
  const loadFrame = async () => {
    const fd = frame().contentDocument;
    fd.open(); fd.write(shown()); fd.close();
    frame().dispatchEvent(new w.Event("load"));
    await wait(50);
  };

  ok("the reader is there", !!R && R.KINDS.join() === "training,puzzles,notebook,recipes,money,ebook", R && R.KINDS.join());

  /* ---- each kind of book ------------------------------------------------ */
  let r = await R.open("training", "t1");
  ok("a Training book opens in the reader", r.ok && R.isOpen && /Maximal Aerobic Speed/.test($("#rd-title").textContent));
  ok("  its records filled in as they are today, a missing one left out",
    trainingAsked.length === 1 && trainingAsked[0][0] === "book" && /<p>Intervals<\/p>/.test(shown()), shown().slice(0, 200));
  ok("  in a frame that can't run scripts", frame().getAttribute("sandbox") === "allow-same-origin");
  r = await R.open("puzzles", "p1");
  ok("a puzzle book opens -- the same document its Print makes", r.ok && /Holiday puzzles/.test(shown())
    && /<section class="page cover">/.test(shown()));
  r = await R.open("notebook", "nb1");
  ok("a notebook opens", r.ok && /Reading notes/.test($("#rd-title").textContent));
  r = await R.open("recipes", "rb1");
  ok("a recipe book opens", r.ok && /Sunday dinners/.test($("#rd-title").textContent) && /Roast/.test(shown()), shown().slice(0, 160));
  r = await R.open("notebook", "nope");
  ok("a book that has gone says so", !!r.error);
  r = await R.open("nonsense", "x");
  ok("  as does a kind there isn't", !!r.error);

  /* ---- zoom and paper ---------------------------------------------------- */
  await R.open("training", "t1");
  await loadFrame();
  const pct = () => $("#nn-reader .rd-pct").textContent;
  ok("zoom starts at 100%", pct() === "100%" && frame().contentDocument.documentElement.style.zoom === "1", pct());
  $('#nn-reader [data-rd="in"]').click(); $('#nn-reader [data-rd="in"]').click();
  ok("A+ zooms in, the page itself", pct() === "125%" && frame().contentDocument.documentElement.style.zoom === "1.25", pct());
  const ctrlWheel = new w.WheelEvent("wheel", {deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true});
  frame().contentDocument.dispatchEvent(ctrlWheel);
  ok("  Ctrl+wheel over the page zooms too", pct() === "150%", pct());
  doc.dispatchEvent(new w.KeyboardEvent("keydown", {key: "0", ctrlKey: true, bubbles: true}));
  ok("  Ctrl+0 is back to 100%", pct() === "100%", pct());
  for (let i = 0; i < 20; i++) $('#nn-reader [data-rd="in"]').click();
  ok("  up to 300%, where A+ stops", pct() === "300%" && $('#nn-reader [data-rd="in"]').disabled);
  $('#nn-reader [data-paper="night"]').click();
  ok("Night paper", $("#nn-reader").dataset.tone === "night"
    && /invert/.test((frame().contentDocument.getElementById("nn-rd-style") || {}).textContent || ""));
  const css = fs.readFileSync(path.join(UI, "reader/reader.css"), "utf8");
  ok("  turns the page over, pictures turned back", /data-tone="night"\] \.rd-frame \{[^}]*invert/.test(css));
  $('#nn-reader [data-paper="sepia"]').click();
  ok("Sepia paper", $("#nn-reader").dataset.tone === "sepia" && /data-tone="sepia"\] \.rd-frame/.test(css));
  ok("the zoom and paper are remembered", R.prefs.zoom === 3 && R.prefs.paper === "sepia");

  /* ---- closing ------------------------------------------------------------ */
  doc.dispatchEvent(new w.KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
  await wait(50);
  ok("Esc closes the book", !R.isOpen);
  ok("  opened inside NeuroNet, closing leaves NeuroNet as it is", hidden.length === 0);
  ok("there's no Reading mode any more (it didn't scroll; Cam: \"Lets just remove it\")",
    !/reading/i.test(fs.readFileSync(path.join(UI, "reader/reader.css"), "utf8"))
      && !$('#nn-reader [data-rd="reading"]'));
  await R.open("puzzles", "p1", {fromDesktop: true});
  $('#nn-reader [data-rd="print"]').click(); await wait(80);
  ok("Print prints that same document, counted as its own kind",
    printed.length === 1 && printed[0][1] === "puzzle-book" && /Holiday puzzles/.test(printed[0][0]));
  $('#nn-reader [data-rd="close"]').click(); await wait(80);
  ok("a book from the desktop Bookshelf: closing it goes back to the desktop", !R.isOpen && hidden.length === 1);
  await R.open("puzzles", "p1", {fromDesktop: true});
  await R.open("notebook", "nb1", {fromDesktop: true});
  ok("  opening another book over it doesn't put NeuroNet away", R.isOpen && hidden.length === 1);
  R.close(); await wait(50);

  /* ---- from the desktop --------------------------------------------------- */
  const appSrc = fs.readFileSync(path.join(UI, "app.js"), "utf8");
  ok("the desktop asks through open.book, as from the desktop",
    /case "open\.book":[\s\S]{0,400}SS\.Reader\.open\([\s\S]{0,80}fromDesktop: true/.test(appSrc));
  const openSh = fs.readFileSync(path.join(APP, "neuronet-open"), "utf8");
  ok("  neuronet-open book shows the tool without ever hiding it",
    /book\)/.test(openSh) && /neuronet-quick" open "\$section"/.test(openSh));

  ok("nothing threw", !thrown.length && !asyncFailures.length, thrown.concat(asyncFailures).slice(0, 3).join(" | "));
}

run().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_reader.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
