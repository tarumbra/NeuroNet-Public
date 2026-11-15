/* ==========================================================================
   Music -> Albums: the artist selector.
   ==========================================================================
   Cam: "make the album sub section in the music main section more usable
   with an artist selector, this can be by a drop down and then it only
   displays the albums from the selected artists (should be able to select
   multiple)."

   Checks: one entry per artist however it is spelled; an album with no
   artist of its own takes its songs' artist; ticking artists shows only
   theirs, several at once, and Clear shows all again; the choice survives
   opening an album and coming back; and hold-to-reorder, which used to swap
   by position on screen, moves the right albums while the shelf is filtered.
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
        {id: "al2", name: "Anthology", artist: "Aerosmith", art: "", files: ["t1.flac"]},
        {id: "al3", name: "Blink", artist: "blink-182", art: "", files: ["t2.flac"]},
        {id: "al4", name: "Dude Ranch", artist: "blink\u2010182", art: "", files: ["t3.flac"]},
        /* made before albums had an artist: it comes from the songs */
        {id: "al5", name: "Old One", artist: "", art: "", files: ["t4.flac", "t5.flac"]},
        {id: "al6", name: "Hits", artist: "The Script", art: "", files: ["t6.flac"]},
      ]}),
    music_mpris_update: async (s) => { REPORTS.push(s); return null; },
    music_write_json: async () => ({ok: true}),
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
const shown = (w) => [...w.document.querySelectorAll(".cc-case[data-album]")].map((b) => b.dataset.album);
const tick = (w, name) => {
  const row = [...w.document.querySelectorAll(".ch-artist-row")]
    .find((r) => r.querySelector(".ch-artist-name").textContent === name);
  if (!row) return false;
  const cb = row.querySelector("input");
  cb.checked = !cb.checked;
  cb.dispatchEvent(new w.Event("change", {bubbles: true}));
  return true;
};

(async () => {
  const w = await boot();
  const t = T(w);
  ok("spellings of one artist are one key",
    t.artistKey("blink-182") === t.artistKey("blink\u2010182")
    && t.artistKey("Florence + the Machine") === t.artistKey("Florence + The Machine"));
  const list = t.albumArtistList(w.CH.tools.chords.getAlbums(), t.albumArtistOf);
  ok("one entry per artist, with album counts, A-Z ignoring 'The'",
    JSON.stringify(list.map((x) => [x.name, x.count])) === JSON.stringify(
      [["Aerosmith", 2], ["Anastacia", 1], ["blink-182", 2], ["The Script", 1]]),
    JSON.stringify(list));

  /* 2026-10-05: the Albums page is gone -- albums are M&T -> Media's CDs, which
     search by artist (the CD's "By") along with everything else. The pure
     helpers above stay in use for the album editor and the shuffle. */
  w.SS.go("music:albums"); await wait(800);
  ok("music:albums now lands on Media's CD covers",
    w.SS._test.view === "stuff:media" && !w.document.getElementById("ch-artist-btn"), w.SS._test.view);

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
