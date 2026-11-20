/* ==========================================================================
   Find: one box for the whole of NeuroNet (2026-10-06).
   ==========================================================================
   The audit: "a search or command box in the top bar (jump to any recipe,
   note or session)". Ctrl+K or Find on the bar; pages, recipes, notes,
   Training's sessions, circuits and guides, Media, albums, playlists, songs.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const {JSDOM} = require("jsdom");

const APP = process.argv[2] || path.join(__dirname, "..");
const UI = path.join(APP, "ui");

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms || 60));

function declaredScripts() {
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
}

let REPORTS = [];
let WRITES = [];
async function boot({tracks = 12} = {}) {
  REPORTS = [];
  const TRACKS = {};
  for (let i = 0; i < tracks; i++) {
    TRACKS[`t${i}.flac`] = {title: `Track ${i}`, artist: i === 4 || i === 5 ? "Anastacia" : "A", album: "B",
                            art: "", duration: 100, plays: 0};
  }
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: JSON.parse(JSON.stringify(TRACKS)),
      playlists: [],
      albums: [
        {id: "al1", name: "Pump", artist: "Aerosmith", art: "", files: ["t0.flac"]},
        {id: "al2", name: "Anthology", artist: "Aerosmith", art: "", files: ["t1.flac", "t0.flac", "t7.flac"]},
        {id: "al3", name: "Blink", artist: "blink-182", art: "", files: ["t2.flac"]},
        {id: "al4", name: "Dude Ranch", artist: "blink\u2010182", art: "", files: ["t3.flac"]},
        /* made before albums had an artist: it comes from the songs */
        {id: "al5", name: "Old One", artist: "", art: "", files: ["t4.flac", "t5.flac"]},
        {id: "al6", name: "Hits", artist: "The Script", art: "", files: ["t6.flac"]},
      ]}),
    music_write_json: async (n, d) => { WRITES.push(JSON.parse(JSON.stringify(d))); return {ok: true}; },
    music_mpris_update: async (s) => { REPORTS.push(s); return null; },
    music_thumb_url: async () => null,
    music_image_url: async () => null,
    chords_list: async () => Object.keys(TRACKS).map((n) => ({name: n, size: 1})),
    chords_audio_url: async () => ({url: "data:audio/mpeg;base64,SUQz", streamed: true}),
    cards_read_json: async () => ({tarotDecks: [], oracleDecks: [], lenormandDecks: [],
      tarotReadings: [], oracleReadings: [], lenormandReadings: [],
      meditation: [], journal: [], gratitude: []}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    /* The Kitchen and Money halves come from KinCrux and normalise their
       own documents in Python. An empty {} is not one of those, and money
       walks data.goals on load -- so the real empty shapes are given here
       rather than letting an unrelated module throw during boot. */
    kc_available: async () => true,
    kc_get_data: async () => ({photos: [], albums: [], photoTagList: [],
      folders: [], events: [], contacts: [], recipes: [{id: "r1", name: "Creme Anglaise", tags: ["Sauce"]},
        {id: "r2", name: "Pavlova", tags: []}], menus: [],
      shoppingLists: [], books: [], tagList: []}),
    kc_save_data: async () => ({ok: true}),
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {},
      goals: [], spendingLog: {periodStart: "", entries: []},
      calc: {bills: [], income: []}}),
    kc_save_money: async () => ({ok: true}),
    kc_money_stamp: async () => 0,
    training_load: async () => ({exercises: {}, circuits: [{id: "c1", name: "Creme Circuit"}],
      sessions: [{id: "s1", name: "Recon Ariel - Plan B - Sit Up Program", items: []}],
      guides: [], questionnaires: [], calendars: [], athletes: [],
      equipment: [], circuitTypes: [], lessonPlans: []}),
    training_save: async () => ({ok: true}),
    training_stamp: async () => 0,
    training_get_prefs: async () => ({}),
    training_set_prefs: async () => ({ok: true}),
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    notes_list_tree: async () => [{type: "folder", name: "Ideas", path: "Ideas", children: [
      {type: "note", name: "Garden plans", path: "Ideas/Garden plans.md"}]}],
    effects_load: async () => ({items: [{id: "m1", title: "Gold", creator: "Abba", type: "cd", year: "1992"}], types: []}),
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}),
    boards_list: async () => [],
    cells_list: async () => [],
    notebooks_list: async () => [],
  };
  const api = new Proxy({}, {
    get: (t, n) => (typeof n === "string"
      ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined),
  });
  const dom = new JSDOM(fs.readFileSync(path.join(UI, "index.html"), "utf8"),
    {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia
    || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  /* jsdom's <audio> cannot play; the PLAYER's own logic is what is being
     tested, so the element is stubbed and its paused state kept honest. */
  w.HTMLMediaElement.prototype.play = function () {
    this.__p = true; return Promise.resolve();
  };
  w.HTMLMediaElement.prototype.pause = function () { this.__p = false; };
  w.HTMLMediaElement.prototype.load = function () {};
  Object.defineProperty(w.HTMLMediaElement.prototype, "paused", {
    get() { return !this.__p; }, configurable: true});
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {},
    lineTo() {}, stroke() {}, fill() {}, save() {}, restore() {},
    translate() {}, scale() {}, createLinearGradient: () => ({addColorStop() {}}),
    setTransform() {}, closePath() {},
  });
  w.AudioContext = w.AudioContext || class {
    createAnalyser() { return {connect() {}, fftSize: 0, frequencyBinCount: 0,
                               getByteFrequencyData() {}}; }
    createMediaElementSource() { return {connect() {}}; }
    get destination() { return {}; }
    resume() { return Promise.resolve(); }
  };
  for (const src of declaredScripts()) {
    w.eval(fs.readFileSync(path.join(UI, src), "utf8"));
  }
  await wait(600);
  return w;
}

const T = (w) => w.CH.tools.chords._test;
const P = (w) => w.SS.Music.Player;
const $ = (w, s) => w.document.querySelector(s);

(async () => {
  const w = await boot();
  const doc = w.document;
  const F = w.SS.Find;
  ok("Find is on the top bar", !!doc.getElementById("ss-find") && !!F);
  const key = (el, k, o) => el.dispatchEvent(new w.KeyboardEvent("keydown", Object.assign({key: k, bubbles: true, cancelable: true}, o)));
  key(doc.body, "k", {ctrlKey: true});
  await wait(100);
  ok("Ctrl+K opens it, with the cursor in the box", !!doc.querySelector(".nf-veil") && doc.activeElement === doc.querySelector(".nf-q"));
  const q = doc.querySelector(".nf-q");
  const type = async (s) => { q.value = s; q.dispatchEvent(new w.Event("input")); await wait(400); return [...doc.querySelectorAll(".nf-row .nf-name")].map((n) => n.textContent); };
  ok("an empty box lists pages", (await type("")).length > 0 && doc.querySelector(".nf-row .nf-kind").textContent === "Page");
  let names = await type("creme");
  ok("a recipe is found, and a circuit with the same word, closest names first",
    names.slice(0, 2).sort().join() === "Creme Anglaise,Creme Circuit", names.join());
  ok("a note, by its name", (await type("garden")).includes("Garden plans"));
  ok("a Training session", (await type("sit up")).includes("Recon Ariel - Plan B - Sit Up Program"));
  ok("Media and songs aren't searched here any more (they're NeuroStream's, 19 Nov 2026)",
    !(await type("gold abba")).includes("Gold") && !(await type("track 4")).includes("Track 4"));
  names = await type("sessions");
  ok("a page by its name", names[0] === "Sessions");
  key(q, "Enter");
  await wait(300);
  ok("Enter opens the first, and Find closes", w.SS._test.view === "training:sessions" && !doc.querySelector(".nf-veil"), w.SS._test.view);
  const ta = doc.createElement("textarea"); doc.body.appendChild(ta); ta.focus();
  key(ta, "k", {ctrlKey: true});
  await wait(80);
  ok("Ctrl+K while typing in a box is left to the box (a note's link)", !doc.querySelector(".nf-veil"));
  doc.getElementById("ss-find").click();
  await wait(80);
  key(doc.querySelector(".nf-q"), "Escape");
  ok("the Find button opens it; Esc closes it", !doc.querySelector(".nf-veil"));
  F.open(); await wait(50);
  await (async () => { const qq = doc.querySelector(".nf-q"); qq.value = "zzzz"; qq.dispatchEvent(new w.Event("input")); await wait(300); })();
  ok("nothing found says so", /Nothing matches/.test(doc.querySelector(".nf-list").textContent));
  F.close();

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
