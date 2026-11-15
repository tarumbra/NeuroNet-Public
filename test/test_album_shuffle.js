/* ==========================================================================
   Music -> Albums: pick several albums, shuffle them together.
   ==========================================================================
   Cam: "select multiple albums and click play, this will add all albums
   tracks selected to a playlist and shuffle all the tracks."

   Select on the Albums shelf turns a click into a pick. Shuffle play puts
   every song of every picked album into the queue, shuffled, each song once
   (a best-of and its album share songs). Save as playlist keeps that mix
   under a name. While picking, a click never opens an album and a hold
   never reorders the shelf.
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
const press = (w, id) => {
  const el = $(w, `.cc-case[data-album="${id}"]`);
  el.dispatchEvent(new w.MouseEvent("mousedown", {bubbles: true, button: 0}));
  w.document.dispatchEvent(new w.MouseEvent("mouseup", {bubbles: true, button: 0}));
  el.dispatchEvent(new w.MouseEvent("click", {bubbles: true, button: 0}));
};

(async () => {
  const w = await boot();
  const t = T(w);
  ok("a song on two picked albums is played once",
    t.tracksOfAlbums([{f: ["a", "b"]}, {f: ["b", "c"]}], (x) => x.f.map((file) => ({file})))
      .map((x) => x.file).join() === "a,b,c");
  ok("missing files are left out",
    t.tracksOfAlbums([{f: ["a", "b"]}], (x) => [{file: "a"}, {file: "b", missing: true}])
      .map((x) => x.file).join() === "a");
  const src = Array.from({length: 30}, (_, i) => i);
  const sh = t.shuffled(src);
  ok("shuffle keeps every song and changes the order",
    sh.slice().sort((a, b) => a - b).join() === src.join() && sh.join() !== src.join()
    && src.join() === Array.from({length: 30}, (_, i) => i).join(), sh.join());

  /* 2026-10-05: picking albums moved to M&T -> Media's CDs ("Shuffle…"), which
     calls these two -- the same shuffle and the same Save as playlist. */
  await w.SS.Music.shuffleAlbums(["al1", "al2"]); await wait(300);
  const q = P(w).queue.map((x) => x.file);
  ok("Shuffle play queues every song of the picked albums, each once",
    q.slice().sort().join() === "t0.flac,t1.flac,t7.flac" && P(w).index === 0, q.join());
  ok("  and it plays", P(w).current && q.includes(P(w).current.file));

  let done = false;
  await w.SS.Music.saveAlbumsAsPlaylist(["al3", "al4"], () => { done = true; }); await wait(200);
  const name = w.document.getElementById("ch-alb-pln");
  ok("Save as playlist suggests a name from the albums", name && name.value === "Blink + Dude Ranch", name && name.value);
  name.value = "Pop punk mix";
  const saveBtn = [...w.document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Save");
  saveBtn.click(); await wait(400);
  const pl = w.CH.tools.chords.getPlaylists().find((p) => p.name === "Pop punk mix");
  ok("it saves a playlist of those albums' songs",
    pl && pl.files.slice().sort().join() === "t2.flac,t3.flac", pl && pl.files.join());
  ok("  written to the library file", WRITES.some((d) => (d.playlists || []).some((p) => p.name === "Pop punk mix")));
  ok("  and plays it, and tells the shelf it's done", P(w).queue.map((x) => x.file).slice().sort().join() === "t2.flac,t3.flac" && done);

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
