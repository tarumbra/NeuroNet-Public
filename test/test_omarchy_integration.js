/* ==========================================================================
   Omarchy integration, the page's half (2026-09-29).
   ==========================================================================
   Cam picked: the Omarchy menu search for NeuroNet, capture straight into
   Photos, and "Colours follow omarchy ... for greater integration with the
   system". Outside NeuroNet those are neuronet-menu / neuronet-open,
   neuronet-capture and the theme-set hook; they all end up here, in
   SS.boardDo (neuronet-call -> org.neuronet.App.Do):

     theme.omarchy          re-read Omarchy's colours ("Follow Omarchy")
     photo.add              a capture into Photos -> Captures, tagged Capture
     open.note / .recipe    the menu opening one note or recipe

   The Python halves: test_omarchy_theme.py and test_home_screen.py.
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

let PHOTOS = null, STORED = [], READ = [], DELETED = [], SNIPCALLS = [], PREFSSET = [];
let OMARCHY = {name: "nord", swatch: ["#2E3440", "#3B4252", "#81A1C1", "#D8DEE9"],
  vars: {"--bg": "#2E3440", "--panel": "#333946", "--ink": "#D8DEE9", "--accent": "#81A1C1", "--scheme": "dark"}};

function declaredScripts() {
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
}

let REPORTS = [];
let WRITES = [];
let EFFECTS = {items: [{id: "m1", type: "dvd", title: "Aliens", review: "A classic", cover: "aliens.jpg"}], types: []};
let KITCHEN = null, NOTES = [], DONE = [], SAVES = [];
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
    photo_save_data: async (d) => { PHOTOS = JSON.parse(JSON.stringify(d)); return {ok: true}; },
    photo_store: async (p) => { STORED.push(p); return {storedName: "s" + STORED.length + ".png", originalName: p.split("/").pop(), takenDate: ""}; },
    photo_delete: async (n) => { DELETED.push(n); return {ok: true}; },
    snip_info: async (n) => ({ok: true, n, day: "261115", name: `261115 - Snip ${n}`, definition: "", archived: false}),
    snip_rename: async (n, def) => { SNIPCALLS.push([n, def]); return {ok: true, n, name: `261115 - Snip ${n} - (${def})`, definition: def}; },
    omarchy_theme: async () => JSON.parse(JSON.stringify(OMARCHY)),
    read_note: async (p) => { READ.push(p); return "# " + p; },
    notes_read_note: async (p) => { READ.push(p); return "# " + p; },
    get_prefs: async () => ({}), set_prefs: async (p) => { PREFSSET.push(p); return {ok: true}; },
    media_cover_from_photo: async (id, stored) => ({ok: true, cover: "data:image/png;base64,AAAA", id, stored}),
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
    effects_load: async () => JSON.parse(JSON.stringify(EFFECTS)),
    effects_save: async (d) => { EFFECTS = JSON.parse(JSON.stringify(d)); SAVES.push("effects"); return {ok: true}; },
    fleeting_add: async (text) => { NOTES.push(text); return {ok: true, n: NOTES.length}; },
    fleeting_delete: async (n) => { NOTES.splice(n - 1, 1); return {ok: true}; },
    board_done: async (token, res) => { DONE.push([token, JSON.parse(res)]); return null; },
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
      folders: [], events: [], contacts: [],
      recipes: [{id: "r1", name: "Pancakes", tags: [], source: "", servings: "", images: [],
                 description: "", ingredients: ["Flour"], steps: ["Mix"], notes: ""}], menus: [],
      shoppingLists: [], books: [], tagList: []}),
    kc_save_data: async (d) => { KITCHEN = JSON.parse(JSON.stringify(d)); SAVES.push("kitchen"); return {ok: true}; },
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
    notes_list_tree: async () => [{type: "note", name: "Bugs.md", path: "Bugs.md"}],
    list_tree: async () => [{type: "note", name: "Bugs.md", path: "Bugs.md"}],
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
  /* jsdom refuses localStorage on a file:// page; theme.js keeps its
     first-paint cache there, which one check below reads back */
  const mem = {};
  Object.defineProperty(w, "localStorage", {configurable: true, value: {
    getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }}});
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

const run = async (w, action, payload) => {
  const token = "t" + Math.random().toString(36).slice(2);
  const res = await w.SS.boardDo(token, action, JSON.stringify(payload || {}));
  await wait(50);
  const done = DONE.find((d) => d[0] === token);
  return {res, answered: done ? done[1] : null};
};

(async () => {
  const w = await boot();
  const rootStyle = () => w.document.documentElement.style;

  /* ---- Follow Omarchy ---- */
  ok("there is a Follow Omarchy theme, first in Settings",
    Object.keys(w.CruxTheme.THEMES)[0] === "omarchy" && w.CruxTheme.THEMES.omarchy.name === "Follow Omarchy");
  ok("its colours were fetched at start-up", w.CruxTheme.THEMES.omarchy.vars["--bg"] === "#2E3440");
  w.CruxTheme.setTheme("hearth");
  OMARCHY.vars["--bg"] = "#111111";
  let r = await run(w, "theme.omarchy");
  ok("the hook's theme.omarchy answers ok with the theme's name", r.res.ok && r.res.name === "nord", JSON.stringify(r.res));
  ok("  but NeuroNet on another theme keeps its own colours", rootStyle().getPropertyValue("--bg") === "");
  w.CruxTheme.setTheme("omarchy");
  ok("choosing Follow Omarchy paints the Omarchy colours", rootStyle().getPropertyValue("--bg") === "#111111"
    && w.document.documentElement.getAttribute("data-theme") === "omarchy");
  OMARCHY = {name: "white", swatch: ["#FFFFFF", "#EEEEEE", "#6E6E6E", "#000000"],
             vars: {"--bg": "#FFFFFF", "--ink": "#000000", "--accent": "#6E6E6E", "--scheme": "light"}};
  r = await run(w, "theme.omarchy");
  ok("an Omarchy theme change repaints NeuroNet straight away",
    rootStyle().getPropertyValue("--bg") === "#FFFFFF" && rootStyle().getPropertyValue("color-scheme") === "light");
  ok("  and a colour the new theme doesn't set is cleared, not left behind",
    rootStyle().getPropertyValue("--panel") === "");
  ok("  and it's kept for the next start's first paint",
    JSON.parse(w.localStorage.getItem("crux:omarchy")).vars["--bg"] === "#FFFFFF");

  /* ---- capture into Photos ---- */
  r = await run(w, "photo.add", {path: "/run/user/1000/neuronet-capture/screenshot-1.png", caption: "Capture 29 Sep"});
  const folder = PHOTOS && PHOTOS.folders.find((f) => f.name === "Captures");
  const ph = PHOTOS && PHOTOS.photos[0];
  ok("a capture is stored and saved as a library photo", r.res.ok && STORED.length === 1 && ph && ph.storedName === "s1.png",
    JSON.stringify(r.res));
  ok("  in a top-level Captures folder, tagged Capture, with its caption",
    folder && !folder.parentId && ph.folderId === folder.id && ph.tags.join() === "Capture" && ph.caption === "Capture 29 Sep");
  ok("  and Capture is one of the photo tags", PHOTOS.photoTagList.includes("Capture"));
  ok("  the answer goes back to neuronet-capture", r.answered && r.answered.ok);
  r = await run(w, "photo.add", {path: "/tmp/b.png"});
  ok("a second capture goes in the same folder (no second Captures)",
    r.res.ok && PHOTOS.folders.filter((f) => f.name === "Captures").length === 1 && PHOTOS.photos.length === 2);
  r = await run(w, "photo.add", {});
  ok("no picture, nothing added", !!r.res.error && PHOTOS.photos.length === 2);

  /* ---- snips (15 Nov 2026): neuronet-snip hands them over ---- */
  r = await run(w, "snip.add", {path: "/home/cam/Documents/NeuroNet Snips/261115 - Snip 7.png", n: 7, name: "261115 - Snip 7"});
  const snipFolder = PHOTOS.folders.find((f) => f.name === "NeuroNet Snips" && !f.parentId);
  const sp = PHOTOS.photos.find((x) => x.snip === 7);
  ok("a snip goes into Photos, in a top-level NeuroNet Snips folder, tagged Snip, named for it",
    r.res.ok && snipFolder && sp && sp.folderId === snipFolder.id && sp.tags.join() === "Snip" && sp.caption === "261115 - Snip 7",
    JSON.stringify(r.res) + JSON.stringify(sp));
  const firstStored = sp && sp.storedName;
  r = await run(w, "snip.replace", {n: 7, path: "/home/cam/Documents/NeuroNet Snips/261115 - Snip 7.png"});
  const sp2 = PHOTOS.photos.find((x) => x.snip === 7);
  ok("  an edit saved in omasnap replaces its picture (the old file goes), still snip 7",
    r.res.ok && sp2 && sp2.storedName !== firstStored && DELETED.includes(firstStored)
    && PHOTOS.photos.filter((x) => x.snip === 7).length === 1, JSON.stringify(r.res));
  r = await run(w, "snip.archive", {n: 7, archived: true});
  const arc = PHOTOS.folders.find((f) => f.name === "Archive" && snipFolder && f.parentId === snipFolder.id);
  ok("  archived, it moves to NeuroNet Snips / Archive", r.res.ok && arc && PHOTOS.photos.find((x) => x.snip === 7).folderId === arc.id);
  r = await run(w, "snip.archive", {n: 7, archived: false});
  ok("  and back again", PHOTOS.photos.find((x) => x.snip === 7).folderId === snipFolder.id);
  r = await run(w, "open.snip", {n: 7});
  await wait(400);
  const defBox = w.document.getElementById("snip-def");
  ok("clicking the notification opens Save as: the day and number fixed, the definition to type",
    r.res.ok && defBox && /261115 - Snip 7 - \(/.test(w.document.querySelector(".snip-save").textContent));
  if (defBox) {
    defBox.value = "For Q22"; defBox.dispatchEvent(new w.Event("input"));
    ok("  it shows the file name as it'll be", /261115 - Snip 7 - \(For Q22\)\.png/.test(w.document.getElementById("snip-file").textContent));
    [...w.document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Save").click();
    await wait(400);
    ok("  Save renames it in Documents and in Photos", JSON.stringify(SNIPCALLS.at(-1)) === '[7,"For Q22"]'
      && PHOTOS.photos.find((x) => x.snip === 7).caption === "261115 - Snip 7 - (For Q22)",
      JSON.stringify(SNIPCALLS) + PHOTOS.photos.find((x) => x.snip === 7).caption);
  }
  r = await run(w, "snip.add", {path: "/x/261115 - Snip 8.png", n: 8, name: "261115 - Snip 8"});
  ok("a second snip goes in the same folder", PHOTOS.folders.filter((f) => f.name === "NeuroNet Snips").length === 1
    && PHOTOS.photos.find((x) => x.snip === 8).folderId === snipFolder.id);
  ok("the top bar has the Snip button", !!w.document.getElementById("ss-snip"));

  /* (Media Art went with Media to NeuroStream, 19 Nov 2026) */

  /* ---- the dashboard's app cards (15 Nov 2026, Snip 2) ---- */
  w.SS.go("home:dashboard");
  await wait(600);
  const appCards = [...w.document.querySelectorAll(".app-card")];
  const shown = w.SS.appCards().map((a) => a.key);
  ok("the dashboard shows a card for every app, by default, in the sidebar's order (not Home)",
    appCards.length > 5 && appCards.length === shown.length && !shown.includes("home")
    && appCards.map((c) => c.dataset.appGo).join() === shown.join(), appCards.map((c) => c.dataset.appGo).join());
  ok("  each with its icon, name and pages", appCards.every((c) => c.querySelector(".fav-card-ic svg") && c.querySelector(".fav-card-name").textContent));
  const toMoney = appCards.find((c) => c.dataset.appGo === "money");     // (M&T has one page since Music and Media left)
  if (toMoney) { toMoney.click(); await wait(500); }
  ok("  a card opens its app (on its first page)", w.SS.where().section === "money", JSON.stringify(w.SS.where()));
  const tabs = [...w.document.querySelectorAll("#ss-tabs .ss-tab")];
  ok("the page tabs can be dragged into order (each carries its key, held with the left button)",
    tabs.length > 1 && tabs.every((t) => t.dataset.drag === t.dataset.view));
  w.SS.go("home:dashboard");
  await wait(500);
  w.document.getElementById("dash-edit").click(); await wait(200);
  w.document.getElementById("dash-apps").click(); await wait(300);
  ok("Edit layout can hide the app cards (remembered)", !w.document.querySelector(".app-card")
    && PREFSSET.some((p) => p.dashApps === false));
  w.document.getElementById("dash-apps").click(); await wait(300);
  ok("  and show them again", !!w.document.querySelector(".app-card") && PREFSSET.at(-1).dashApps === true);
  w.document.getElementById("dash-edit").click(); await wait(200);

  /* ---- the menu opening one thing ---- */
  r = await run(w, "open.recipe", {id: "r1"});
  await wait(200);
  const pane = w.document.getElementById("cc-split-pane");
  ok("a recipe row opens that recipe in the Kitchen", r.res.ok && pane && /Pancakes/.test(pane.textContent),
    JSON.stringify(r.res));
  r = await run(w, "open.recipe", {id: "gone"});
  ok("  a recipe that's gone says so", /isn't there/.test(r.res.error || ""), JSON.stringify(r.res));
  r = await run(w, "open.note", {path: "Bugs.md"});
  await wait(200);
  ok("a note row opens that note in the Vault", r.res.ok && READ.includes("Bugs.md"), JSON.stringify(r.res) + " read=" + READ);

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
