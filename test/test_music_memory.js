/* ==========================================================================
   Music lets go of its hidden Library list (2026-10-05, the audit).
   ==========================================================================
   (and, below, its saves batched.)
   With 3,243 songs the Library is ~40,000 elements, and they stayed in
   memory, hidden, for as long as NeuroNet ran. A few minutes after leaving
   music the list is cleared; opening music draws it again. Music that is
   playing carries on.
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
      folders: [], events: [], contacts: [], recipes: [], menus: [],
      shoppingLists: [], books: [], tagList: []}),
    kc_save_data: async () => ({ok: true}),
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {},
      goals: [], spendingLog: {periodStart: "", entries: []},
      calc: {bills: [], income: []}}),
    kc_save_money: async () => ({ok: true}),
    kc_money_stamp: async () => 0,
    training_load: async () => ({exercises: {}, circuits: [], sessions: [],
      guides: [], questionnaires: [], calendars: [], athletes: [],
      equipment: [], circuitTypes: [], lessonPlans: []}),
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
  const w = await boot({tracks: 40});
  const rows = () => w.document.querySelectorAll("#ch-tracks .ch-track").length;
  w.SS.go("music:library"); await wait(400);
  ok("the Library shows its songs", rows() === 40, rows());

  /* catch the drop's timer instead of waiting three minutes */
  const realST = w.setTimeout;
  const caught = [];
  w.setTimeout = (fn, ms, ...a) => { if (ms >= 60000) { caught.push({fn, ms}); return 1; } return realST(fn, ms, ...a); };
  w.SS.go("photos"); await wait(200);
  w.SS.go("settings"); await wait(200);
  ok("leaving music sets one timer, minutes long (later screens don't push it back)",
    caught.length === 1 && caught[0].ms >= 120000, JSON.stringify(caught.map((c) => c.ms)));
  ok("  the list is still there until then", rows() === 40);
  caught[0].fn();
  ok("then the hidden list is cleared", rows() === 0 && $(w, "#ch-shell").hidden);
  w.setTimeout = realST;

  w.SS.go("music:library"); await wait(400);
  ok("opening music again draws it afresh", rows() === 40, rows());

  /* back in music before the timer: nothing is cleared */
  w.setTimeout = (fn, ms, ...a) => { if (ms >= 60000) { caught.push({fn, ms}); return 1; } return realST(fn, ms, ...a); };
  w.SS.go("photos"); await wait(200);
  w.SS.go("music:library"); await wait(400);
  caught[caught.length - 1].fn();
  w.setTimeout = realST;
  ok("  and a timer from before music was reopened clears nothing", rows() === 40, rows());

  /* saves are batched (2026-10-06): a run of changes writes the ~1 MB file
     once, after they stop; putting the page away writes at once */
  const c = w.CH.tools.chords;
  await wait(500);
  let n0 = WRITES.length;
  for (let i = 0; i < 6; i++) c.setFavourite(`t${i}.flac`, true);
  ok("six changes in a row: the screen knows at once", c.isFavourite("t5.flac"));
  ok("  but nothing is written while they're still coming", WRITES.length === n0);
  await wait(500);
  ok("  then one write, with all six", WRITES.length === n0 + 1
    && [0, 1, 2, 3, 4, 5].every((i) => WRITES[WRITES.length - 1].tracks[`t${i}.flac`].favourite === true),
    WRITES.length - n0);
  n0 = WRITES.length;
  c.setFavourite("t7.flac", true);
  Object.defineProperty(w.document, "hidden", {value: true, configurable: true});
  w.document.dispatchEvent(new w.Event("visibilitychange"));
  await wait(20);   // the bridge call is async; well under the 300 ms batch
  ok("putting the window away writes a pending change straight away",
    WRITES.length === n0 + 1 && WRITES[WRITES.length - 1].tracks["t7.flac"].favourite === true);
  await wait(500);
  ok("  and only once", WRITES.length === n0 + 1);

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
