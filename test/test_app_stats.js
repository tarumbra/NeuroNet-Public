/* ==========================================================================
   App stats -- Settings -> App stats, the tracker, and its three exports
   ==========================================================================
   Cam: "In Settings menu an application stats panel that breaks down what is
   in the app and how much ... exported into excell, a doc or imported into
   the in app boards feature with a chart."

   The panel is opened the way Cam opens it and every button pressed; what
   arrives at the backend is what is checked. The tracker is ticked by hand,
   so "five minutes idle" does not take five minutes.
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

/* Cam's own example figures, as the backend would hand them over. */
const RAW = {
  generated: "2026-09-26T18:00:00",
  content: {photos: 43, albums: 2, tracks: 1320, playlists: 3, musicAlbums: 5,
    meditations: 0, recipes: 100, menus: 1, shoppingLists: 0, recipeBooks: 0,
    sessions: 100, circuits: 132, programs: 0, exercises: 456, guides: 30,
    lessonPlans: 1, athletes: 1, questionnaires: 5, trainingBooks: 1, notes: 12,
    canvases: 1, fleeting: 5, boards: 1, spreadsheets: 4, notebooks: 0,
    puzzleBooks: 2, readings: 0, journal: 0, gratitude: 0, contacts: 1, events: 2,
    effects: 3},
  puzzles: {played: 1300, completed: 1232, seconds: 90000,
    byGame: {sudoku: {played: 700, won: 690, seconds: 1}, minesweeper: {played: 600, won: 542, seconds: 1}}},
  usage: {since: "2026-09-26T17:00:00", launches: 12, seconds: 400 * 3600,
    musicSeconds: 4 * 3600 + 23 * 60,
    sections: {home: 200000, training: 900000, music: 300000, games: 40000},
    days: {[new Date().toISOString().slice(0, 10)]: 3600},
    counts: {"print:recipe": 2, "print:training-circuit": 10, "print:training-session": 1,
      "print:puzzle-book": 2, "print:training-book": 5, "print:note-book": 1,
      "print:something-new": 3, "export:training-session": 4}},
};
const usageCalls = [], exportCalls = [], boardsWritten = [], printCalls = [];

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
    boards_list: async () => [{id: "App stats " + new Date().toISOString().slice(0, 10)}], cells_list: async () => [],
    notebooks_list: async () => [],
    fleeting_list: async () => JSON.parse(JSON.stringify(fleeting)),
    app_stats: async () => JSON.parse(JSON.stringify(RAW)),
    app_health: async () => ({now: {total: 1300, parts: {page: 900, app: 250, graphics: 150}}, since: Date.now() / 1000 - 3 * 3600,
      samples: [[1000, 1100], [4600, 1200], [8200, 1300]], perHour: 100, steady: false}),
    print_header: async (title) => `<div class="LETTERHEAD">NEURONET-MARK ${title}</div>`,
    open_print_document: async (html, kind) => { printCalls.push([html, kind]); return true; },
    usage_record: async (d) => { usageCalls.push(["record", d]); return {ok: true}; },
    usage_launch: async () => { usageCalls.push(["launch"]); return {ok: true}; },
    usage_count: async (k) => { usageCalls.push(["count", k]); return {ok: true}; },
    usage_reset: async () => { usageCalls.push(["reset"]); return {ok: true, kept: "usage.json.before-reset-x"}; },
    stats_export: async (fmt, model) => { exportCalls.push([fmt, model]); return {ok: true, path: "/home/cam/Desktop/NeuroNet stats." + fmt}; },
    boards_write: async (id, board) => { boardsWritten.push([id, board]); return {ok: true}; },
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
  const $ = (s) => doc.querySelector(s);
  const text = (el) => (el ? el.textContent.replace(/\s+/g, " ") : "");

  ok("the app records a launch when it starts", usageCalls.some(([k]) => k === "launch"));

  /* ---- the panel -------------------------------------------------------- */
  const inMenu = SSmenu();
  function SSmenu() {
    return (w.SS && true) && /settings:stats/.test(fs.readFileSync(path.join(UI, "app.js"), "utf8"));
  }
  ok("App stats is a Settings subsection", inMenu);
  w.SS.go("settings:stats");
  await wait(900);
  const panel = $(".ap-stats");
  ok("Settings \u2192 App stats draws the panel", !!panel, text($("#set-stats")).slice(0, 120));
  if (!panel) return;
  const all = text(panel);
  const hp = $(".ap-health");
  ok("NeuroNet's health first: memory now, its parts, how long it has run, the day's line",
    !!hp && /1\.3 GB/.test(text(hp)) && /the page 900 MB/.test(text(hp)) && /Running 3 h/.test(text(hp)) && !!hp.querySelector(".ap-spark polyline"),
    text(hp).slice(0, 200));
  ok("  climbing says so, with what to do", /Climbing about 100 MB an hour/.test(text(hp)) && hp.querySelector(".ap-health-v.is-warn"));
  const has = (label, value) => [...panel.querySelectorAll(".ap-row")].some((r) =>
    r.children[0].textContent.trim() === label && r.children[1].textContent.trim() === value);
  ok("Cam's examples read as he wrote them: Recipes 100", has("Recipes", "100"));
  ok("  Music tracks 1,320", has("Music tracks", "1,320"));
  ok("  Photos 43, Sessions 100, Circuits 132, Programs 0",
    has("Photos", "43") && has("Sessions", "100") && has("Circuits", "132") && has("Programs", "0"));
  ok("  Puzzles completed 1,232", has("Puzzles completed", "1,232"));
  ok("  Time in the app 400 hours", has("Time in the app", "400 hours"));
  ok("  Time music played 4 h 23 min", has("Time music played", "4 h 23 min"));
  ok("  Printed recipes 2, circuits 10, sessions 1, puzzle books 2, training books 5, note books 1",
    has("Printed recipes", "2") && has("Printed circuits", "10") && has("Printed sessions", "1")
    && has("Printed puzzle books", "2") && has("Printed training books", "5")
    && has("Printed note books", "1"));
  ok("  a print kind nobody named yet still shows", has("Printed something new", "3"));
  ok("  and a kind never printed says 0 rather than vanishing", has("Printed programs", "0"));
  ok("time is broken down by section, biggest first",
    /Time by section/.test(all) && [...panel.querySelectorAll(".ap-group")]
      .find((g) => /Time by section/.test(g.textContent))
      .querySelector(".ap-row span").textContent === "Training");
  /* In whatever way this machine writes a date: Cam's says 26 September. */
  const sinceWords = new w.Date("2026-09-26T17:00:00").toLocaleDateString(undefined,
    {day: "numeric", month: "long", year: "numeric"});
  ok("the panel says when usage recording began", all.includes("since " + sinceWords), all.slice(0, 160));
  ok("the charts are drawn", panel.querySelectorAll(".ap-chart svg rect").length > 4);

  /* ---- exports ---------------------------------------------------------- */
  panel.querySelector('[data-ap="xlsx"]').click();
  await wait(200);
  panel.querySelector('[data-ap="docx"]').click();
  await wait(200);
  ok("Export to Excel and Export to Word each reach the backend",
    exportCalls.map(([f]) => f).join(",") === "xlsx,docx", exportCalls.map(([f]) => f).join(","));
  const model = exportCalls.length && exportCalls[0][1];
  ok("  with the panel's own groups and numbers",
    model && model.groups.some((g) => g.rows.some((r) => r[0] === "Recipes" && r[2] === 100)));
  ok("  and its charts", model && model.charts.some((c) => c.title === "Time by section"
    && c.labels[0] === "Training"));

  panel.querySelector('[data-ap="board"]').click();
  await wait(300);
  const made = boardsWritten[0];
  ok("Send to Boards makes a board", !!made);
  if (made) {
    const [id, board] = made;
    ok("  under a name that does not overwrite one already there", / 2$/.test(id), id);
    const items = board.pages.flatMap((p) => p.items);
    const graphs = items.filter((i) => i.k === "graph");
    ok("  with real Boards graphs on it", graphs.length >= 2
      && graphs.every((g) => g.data && g.data.labels.length && g.data.series[0].values.length));
    ok("  every item with an id, so it can be selected and moved",
      items.every((i) => i.id) && new Set(items.map((i) => i.id)).size === items.length);
    ok("  and the numbers written on it too", items.some((i) => i.k === "text" && /Recipes: 100/.test(i.text)));
    /* Drawn by Boards' own code, the way the editor and the PowerPoint export draw it. */
    const svg = w.SS.BoardEditor.pageSVG(board, 0);
    ok("  and Boards draws its first page, charts and all",
      /Time by section/.test(svg) && /What&#39;s in the app|What's in the app/.test(svg)
      && (svg.match(/<rect/g) || []).length > 20, svg.length + " chars");
  }

  /* ---- print ------------------------------------------------------------ */
  panel.querySelector('[data-ap="print"]').click();
  await wait(300);
  const [printed, printKind] = printCalls[0] || [];
  ok("Print opens a print page", !!printed);
  ok("  under the shared letterhead, NeuroNet's mark top left, like every other printout",
    printed && printed.indexOf("LETTERHEAD") > -1
    && printed.indexOf("LETTERHEAD") < printed.indexOf("The numbers"));
  ok("  with the numbers, the charts drawn in ink for paper",
    printed && /Recipes<\/td><td>100/.test(printed) && /<svg/.test(printed)
    && /--text: #1F2A24/.test(printed) && !/#4f8cff/.test(printed));   // the house green, not the screen's blue (2026-10-05)
  ok("  and counted as an App stats print", printKind === "app-stats", printKind);

  /* ---- the tracker -------------------------------------------------------- */
  // NeuroNet in front: its window has the focus (jsdom's page never has)
  let focused = true;
  w.document.hasFocus = () => focused;
  const T = w.SS.Stats._test;
  const before = JSON.parse(JSON.stringify(T.pending));
  T.touch(); T.tick();
  ok("five seconds in use count as five seconds", T.pending.seconds === before.seconds + 5);
  ok("  against the section on screen", (T.pending.sections.settings || 0) === (before.sections.settings || 0) + 5,
    JSON.stringify(T.pending.sections));
  T.idle(); T.tick();
  ok("five minutes without input stops the clock", T.pending.seconds === before.seconds + 5);
  /* Cam (2026-10-02): "only count the stats when the specific tool is
     actually active on screen". The quick popup put away, or another window
     clicked: the focus goes, and so does the counting -- even straight after
     a click in NeuroNet. */
  const s0 = T.pending.seconds;
  T.touch(); focused = false; w.dispatchEvent(new w.Event("blur")); T.tick();
  ok("NeuroNet put away (no focus): the clock stops at once", T.pending.seconds === s0);
  focused = true; w.dispatchEvent(new w.Event("focus")); T.tick();
  ok("  and starts again when it's back in front", T.pending.seconds === s0 + 5);
  focused = false; T.touch(); T.tick();
  ok("  the page's own focus counts too (no blur event)", T.pending.seconds === s0 + 5);
  focused = true;
  const realMusic = w.SS.Music;
  w.SS.Music = {Player: {playing: true}};
  T.tick();
  w.SS.Music = realMusic;
  ok("music playing counts even while nobody is at the keyboard",
    T.pending.musicSeconds === before.musicSeconds + 5);
  await w.SS.Stats.flush();
  const rec = usageCalls.filter(([k]) => k === "record").pop();
  ok("a flush sends it to the backend, with the day", rec && rec[1].seconds >= 5
    && /^\d{4}-\d{2}-\d{2}$/.test(rec[1].day), JSON.stringify(rec));
  ok("  and nothing is sent twice", w.SS.Stats._test.pending.seconds === 0);

  /* Reset: asked first, then the backend starts the record again */
  T.touch(); T.tick();
  const host = w.document.createElement("div");
  w.document.body.appendChild(host);
  const resetting = T.resetStats(host);
  await wait(30);
  const yesBtn = w.document.querySelector('#confirm-veil.open [data-a="yes"]');
  ok("Reset stats asks first", !!yesBtn && /Reset/.test(yesBtn.textContent));
  ok("  nothing is reset before the answer", !usageCalls.some(([k]) => k === "reset"));
  if (yesBtn) yesBtn.click();
  await resetting;
  ok("  then the backend resets the record", usageCalls.some(([k]) => k === "reset"));
  ok("  and the time not yet sent is dropped too", T.pending.seconds === 0);

  const broke = [...thrown, ...asyncFailures];
  ok("nothing threw along the way", broke.length === 0, broke.slice(0, 3).join(" | "));
}

run().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_app_stats.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
