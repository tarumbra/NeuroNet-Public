/* ==========================================================================
   NeuroNet on the Linux media bus -- the page's half.
   ==========================================================================
   Cam: "is it possible to make companion style omarchy plugins, like a top
   bar music player for NeuroNet?" ... "yes build option 1 with a bar widget".

   mpris.py puts NeuroNet on D-Bus; the bar widget, Omarchy's audio panel and
   the media keys talk to it there. This checks the page's two jobs:

     1. it TELLS the bus what CH.Player is doing (music_mpris_update), and
        the first report goes out on its own, because that is what tells the
        bus the page is ready for commands;
     2. every command from the bus (SS.Music.remote) goes through CH.Player,
        the same calls the app's own buttons make -- there is one player.

   test_mpris.py checks the bus half.
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
    TRACKS[`t${i}.flac`] = {title: `Track ${i}`, artist: "A", album: "B",
                            art: "", duration: 100, plays: 0};
  }
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: JSON.parse(JSON.stringify(TRACKS)),
      playlists: [{id: "pl1", name: "Upbeat", art: null, files: ["t5.flac", "t6.flac"]}],
      albums: [{id: "al1", name: "Album One", artist: "A", art: "cover.jpg",
                files: ["t3.flac", "t4.flac"]}]}),
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

const P = (w) => w.SS.Music.Player;
const last = () => REPORTS[REPORTS.length - 1] || {};

(async () => {
  const w = await boot();
  await wait(300);
  ok("the page reports to the bus on its own at startup",
    REPORTS.length >= 1 && last().status === "Stopped",
    JSON.stringify(REPORTS));

  await w.SS.Music.remote("play");
  await wait(400);
  ok("Play from the bus starts music, as the app's play button does",
    P(w).playing && last().status === "Playing",
    JSON.stringify(last()));
  ok("  and the bus is told the title, artist and album",
    last().title === "Track 0" && last().artist === "A" && last().album === "B",
    JSON.stringify(last()));

  const before = REPORTS.length;
  await wait(400);
  ok("nothing is re-sent while nothing changes (no per-tick chatter)",
    REPORTS.length === before, `${REPORTS.length - before} extra reports`);

  await w.SS.Music.remote("pause");
  await wait(300);
  ok("Pause", !P(w).playing && last().status === "Paused", JSON.stringify(last()));
  await w.SS.Music.remote("playpause");
  await wait(300);
  ok("PlayPause", P(w).playing && last().status === "Playing", JSON.stringify(last()));

  await w.SS.Music.remote("next");
  await wait(400);
  ok("Next moves the real queue on", P(w).index === 1 && last().title === "Track 1",
    JSON.stringify({i: P(w).index, t: last().title}));

  await w.SS.Music.remote("shuffle", true);
  await w.SS.Music.remote("repeat", "one");
  await w.SS.Music.remote("volume", 0.4);
  await wait(300);
  ok("shuffle, repeat and volume set from the bus reach the player",
    P(w).shuffle === true && P(w).repeat === "one" && Math.abs(P(w).volume - 0.4) < 1e-6,
    JSON.stringify({s: P(w).shuffle, r: P(w).repeat, v: P(w).volume}));
  ok("  and are reported back", last().shuffle === true && last().repeat === "one"
    && Math.abs(last().volume - 0.4) < 1e-6, JSON.stringify(last()));

  const opened = await w.SS.Music.remote("open", {kind: "album", id: "al1"});
  await wait(400);
  ok("OpenUri neuronet:album/<id> plays that album",
    opened !== false && P(w).queue.map((t) => t.file).join() === "t3.flac,t4.flac"
    && last().title === "Track 3" && last().art === "cover.jpg",
    JSON.stringify({q: P(w).queue.map((t) => t.file), last: last()}));
  await w.SS.Music.remote("open", {kind: "playlist", id: "pl1"});
  await wait(400);
  ok("OpenUri neuronet:playlist/<id> plays that playlist",
    P(w).queue.map((t) => t.file).join() === "t5.flac,t6.flac",
    JSON.stringify(P(w).queue.map((t) => t.file)));
  ok("an unknown album is refused, not guessed at",
    (await w.SS.Music.remote("open", {kind: "album", id: "nope"})) === false);

  const audio = w.document.getElementById("cc-audio");
  audio.dispatchEvent(new w.Event("seeked"));
  await wait(300);
  ok("a seek is reported straight away, flagged so the bus sends Seeked",
    last().seeked === true, JSON.stringify(last()));

  await w.SS.Music.remote("stop");
  await wait(300);
  ok("Stop pauses", !P(w).playing, "");

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
