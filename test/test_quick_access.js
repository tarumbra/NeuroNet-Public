/* ==========================================================================
   Quick access: NeuroNet as a popup -- the page's half.
   ==========================================================================
   Cam: "a plugin that can load my tools in Neuronet and make them appear as
   a popup that i can do some quick work or viewing, rather then having to
   open the whole app all the time." Notes, Training, Photos and Music.

   neuronet-quick floats the window and calls SS.quickMode(section, compact)
   over D-Bus. This checks the page: compact hides the left menu and shows
   the "whole NeuroNet" button; the section opens where Cam last was in it,
   and asking for the section already on screen leaves the page alone.
   test_mpris.py checks the D-Bus half; test_quick_script.py the script.
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

const $ = (w, s) => w.document.querySelector(s);
const view = (w) => w.document.querySelector("#ss-app") && w.SS.currentView
  ? w.SS.currentView() : null;

(async () => {
  const w = await boot();
  const app = $(w, "#ss-app"), full = $(w, "#ss-quick-full");
  ok("the whole-app button exists and is hidden normally", full && full.hidden
    && !app.classList.contains("nn-quick"));

  w.SS.quickMode("music", true); await wait(400);
  ok("Quick(music, compact) turns the compact look on", app.classList.contains("nn-quick"));
  ok("  shows the whole-app button", !full.hidden);
  ok("  and opens Music", !$(w, "#ch-shell").hidden, "the music shell is hidden");
  const css = require("fs").readFileSync(require("path").join(UI, "multitask.css"), "utf8");
  ok("compact hides the left menu (and only that)",
    /#ss-app\.nn-quick #ss-sidebar \{ display: none; \}/.test(css)
    && !/nn-quick #ss-topbar|nn-quick #ss-subnav/.test(css));

  w.SS.go("music:playlists"); await wait(300);
  w.SS.quickMode("photos", true); await wait(300);
  w.SS.quickMode("music", true); await wait(300);
  ok("a section reopens on the page last used in it (Playlists)",
    /Playlists/.test(($(w, "#ss-bottombar") || w.document.body).textContent)
    && !!$(w, "#ch-shell") && !$(w, "#ch-shell").hidden, ($(w, "#ss-bottombar") || {}).textContent);

  w.SS.go("music:visualizer"); await wait(300);
  w.SS.quickMode("music", true); await wait(300);
  ok("asking for the section already open leaves the page as it is",
    /Visualizer/.test(($(w, "#ss-bottombar") || w.document.body).textContent), ($(w, "#ss-bottombar") || {}).textContent);

  let called = 0;
  w.pywebview.api = new Proxy(w.pywebview.api, {get: (t, n) => n === "quick_full"
    ? async () => { called++; return {ok: true}; } : t[n]});
  full.click(); await wait(50);
  ok("the whole-app button asks NeuroNet to leave the popup", called === 1);

  w.SS.quickMode("", false); await wait(100);
  ok("Compact(false) brings the left menu back and hides the button",
    !app.classList.contains("nn-quick") && full.hidden);

  /* Every tool has a key (Cam: "the rest of the short cuts for every tool
     in Neuronet"), so every section must open in the popup on one of its
     own pages -- Kitchen's pages aren't named after it, and Stuff's are made
     at run time, so each is checked, not assumed. */
  const TOOLS = ["notes", "training", "photos", "music", "money", "home",
                 "mind", "games", "divination", "stuff", "cookery", "code", "creative"];
  const missed = [];
  for (const sec of TOOLS) {
    w.SS.go("photos"); await wait(150);
    if (sec === "photos") w.SS.go("music:library"), await wait(150);
    w.SS.quickMode(sec, true); await wait(300);
    const v = w.SS._test.view;
    /* M&T (2026-10-02): Music and Stuff are one section; Super+Alt+M opens
       its music pages, Super+Alt+I its media pages. */
    const want = {music: "stuff"}[sec] || sec;
    const half = {music: "music:", stuff: "stuff:"}[sec];
    if (w.SS._test.sectionOf(v) !== want || (half && !v.startsWith(half))) missed.push(`${sec} -> ${v}`);
  }
  ok("every tool with a key opens in the popup on one of its own pages",
    !missed.length, missed.join(", "));

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
