/* ==========================================================================
   Puzzle, Quick recipe and the Fleeting viewer -- played, not read
   ==========================================================================
   Cam: "Puzzle - Ability to generate sudoku, kakuro, minesweeper and if
   possible word search on the dashboard."
   "Quick recipe - 3 simple options, each presented one at a time ... on
   pressing enter it will save it to recipes and return to the start."
   "Fleeting Note Viewer - ... navigate through the fleeting notes and read
   them from the widget window, it should be scrollable, further to view i
   should be able to delete from the viewer (Which will delete from the
   fleeting notes)."

   Each widget is booted in the real app and USED the way Cam would: digits
   typed, mines opened, a word found, a recipe entered with three Enters, a
   note stepped to and deleted. What reaches the backend is what is checked.
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

  const doc = w.document;
  const $ = (sel) => doc.querySelector(sel);
  const $$ = (sel) => [...doc.querySelectorAll(sel)];
  const key = (el, k, extra) => el.dispatchEvent(new w.KeyboardEvent("keydown",
    Object.assign({key: k, bubbles: true, cancelable: true}, extra || {})));
  const G = w.CRGames;

  w.SS.go("home:dashboard");
  await wait(1200);

  ok("all three new widgets draw", !!$("[data-pz]") && !!$("[data-qr]") && !!$("[data-fv]"),
    "missing: " + ["[data-pz]", "[data-qr]", "[data-fv]"].filter((s) => !$(s)).join(" "));
  ok("  and they are offered when adding a block",
    ["puzzle", "quickrecipe", "fleetview"].every((t) =>
      new RegExp(`\\b${t}:\\s*\\{name:`).test(fs.readFileSync(path.join(UI, "home/home.js"), "utf8"))));
  ok("Cranium's word lists reach the widget", Array.isArray(G.WS_PRESETS) && G.WS_PRESETS.length > 5);

  /* ---- Sudoku --------------------------------------------------------- */
  const pz = $("[data-pz]");
  const cellsNow = () => [...pz.querySelectorAll("[data-pz-cell]")];
  ok("the puzzle widget opens on a Sudoku", cellsNow().length === 81, cellsNow().length + " cells");
  const blank = cellsNow().find((c) => !c.classList.contains("given"));
  const blankI = Number(blank.dataset.pzCell);
  blank.click();
  key(pz, "7");
  ok("a digit typed goes into the picked Sudoku cell",
    pz.querySelector(`[data-pz-cell="${blankI}"]`).textContent.trim() === "7");
  pz.querySelector('[data-pz-digit="0"]').click();
  ok("  and the pad's clear takes it out again",
    pz.querySelector(`[data-pz-cell="${blankI}"]`).textContent.trim() === "");
  const given = cellsNow().find((c) => c.classList.contains("given"));
  const givenText = given.textContent.trim();
  given.click();
  key(pz, "1");
  ok("  a given number cannot be typed over",
    pz.querySelector(`[data-pz-cell="${given.dataset.pzCell}"]`).textContent.trim() === givenText);
  /* Solve it outright through the pad: the widget must say so. */
  const grid = cellsNow().map((c) => Number(c.textContent.trim()) || 0);
  const solved = G.Sudoku.solve(grid.slice());
  const solution = Array.isArray(solved) ? solved : grid;
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    pz.querySelector(`[data-pz-cell="${i}"]`).click();
    pz.querySelector(`[data-pz-digit="${solution[i]}"]`).click();
  }
  ok("  and a finished Sudoku says it is solved", /Solved/.test(pz.textContent),
    "solve() gave " + typeof solved);

  /* ---- Kakuro --------------------------------------------------------- */
  pz.querySelector('[data-pz-tab="kakuro"]').click();
  await wait(50);
  ok("Kakuro draws with its clues", pz.querySelectorAll(".dash-kk-clue").length > 3);
  const kkCell = pz.querySelector("[data-pz-cell]");
  kkCell.click();
  key(pz, "4");
  ok("  and takes a digit", pz.querySelector(`[data-pz-cell="${kkCell.dataset.pzCell}"]`)
    .textContent.trim() === "4");
  ok("the tab picked is remembered in the layout",
    (prefs.dashBlocks.find((b) => b.id === "b-pz") || {}).kind === "kakuro");

  /* ---- Minesweeper ---------------------------------------------------- */
  pz.querySelector('[data-pz-tab="mines"]').click();
  ok("Minesweeper is a beginner board", cellsNow().length === 81);
  cellsNow()[40].click();
  const opened = pz.querySelectorAll(".dash-ms.open").length;
  ok("  the first click opens ground and is never a mine", opened > 1 && !pz.querySelector(".boom"),
    opened + " open");
  const shut = cellsNow().find((c) => !c.classList.contains("open"));
  shut.dispatchEvent(new w.MouseEvent("contextmenu", {bubbles: true, cancelable: true}));
  ok("  right-click flags", pz.querySelector(`[data-pz-cell="${shut.dataset.pzCell}"]`)
    .classList.contains("flag"));
  ok("  and the count of mines left goes down", /Mines left <b>9<\/b>/.test(pz.innerHTML));

  /* ---- Sudoku game survived the tab changes ---------------------------- */
  pz.querySelector('[data-pz-tab="sudoku"]').click();
  ok("the Sudoku is still there after visiting the other puzzles", /Solved/.test(pz.textContent));
  pz.querySelector("[data-pz-new]").click();
  ok("  until New deals a fresh one", !/Solved/.test(pz.textContent)
    && pz.querySelectorAll(".dash-pz-cell.given").length >= 30);

  /* ---- Word search ---------------------------------------------------- */
  pz.querySelector('[data-pz-tab="words"]').click();
  ok("a word search draws, ten by ten", cellsNow().length === 100);
  const listed = [...pz.querySelectorAll(".dash-ws-list span")].map((s) => s.textContent.trim());
  ok("  with its word list under it", listed.length >= 4, listed.join(","));
  /* Find the first word by its real cells: click first letter then last. */
  const readGrid = () => {
    const g = [];
    cellsNow().forEach((c) => {
      const [r, col] = c.dataset.pzCell.split(",").map(Number);
      (g[r] = g[r] || [])[col] = c.textContent.trim();
    });
    return g;
  };
  const gridL = readGrid();
  const word = listed[0];
  let where = null;
  const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
  for (let r = 0; r < 10 && !where; r++) for (let c = 0; c < 10 && !where; c++) {
    for (const [dr, dc] of dirs) {
      let s = "";
      for (let i = 0; i < word.length; i++) s += (gridL[r + dr * i] || [])[c + dc * i] || "";
      if (s === word) { where = [[r, c], [r + dr * (word.length - 1), c + dc * (word.length - 1)]]; break; }
    }
  }
  ok("  (the test found the word in the grid itself)", !!where, word);
  if (where) {
    pz.querySelector(`[data-pz-cell="${where[0].join(",")}"]`).click();
    pz.querySelector(`[data-pz-cell="${where[1].join(",")}"]`).click();
    const struck = [...pz.querySelectorAll(".dash-ws-list span.found")].map((s) => s.textContent.trim());
    ok("clicking a word's first then last letter finds it", struck.includes(word), struck.join(","));
    ok("  and lights its letters", pz.querySelectorAll(".dash-ws.found").length >= word.length);
  }

  /* ---- Quick recipe --------------------------------------------------- */
  const qr = $("[data-qr]");
  const field = () => qr.querySelector("[data-qr-field]");
  const type = (text) => {
    field().value = text;
    field().dispatchEvent(new w.Event("input", {bubbles: true}));
  };
  ok("Quick recipe starts on the title", field().tagName === "INPUT");
  key(field(), "Enter");
  ok("  Enter with no title goes nowhere", field().tagName === "INPUT");
  type("Pancakes");
  key(field(), "Enter");
  ok("  Enter moves on to the ingredients", /Pancakes/.test(qr.textContent)
    && field().tagName === "TEXTAREA");
  type("• 2 cups flour\n- 1 egg\n\n1 cup milk");
  key(field(), "Enter", {shiftKey: true});
  ok("  Shift+Enter does not move on", /flour/.test(field().value));
  key(field(), "Enter");
  ok("  Enter moves on to the directions", field().value === ""
    && /directions/i.test(field().getAttribute("placeholder")));
  qr.querySelector("[data-qr-back]").click();
  ok("  Back returns to the ingredients with them still there", /1 egg/.test(field().value));
  key(field(), "Enter");
  type("1. Whisk everything.\n2. Fry in a hot pan.");
  key(field(), "Enter");
  await wait(150);
  const saved = kitchenSaves.length
    ? (kitchenSaves[kitchenSaves.length - 1].recipes || []).find((r) => r.name === "Pancakes") : null;
  ok("the third Enter saves it to Recipes", !!saved, kitchenSaves.length + " kitchen saves");
  if (saved) {
    ok("  ingredients one per line, bullets gone",
      JSON.stringify(saved.ingredients) === JSON.stringify(["2 cups flour", "1 egg", "1 cup milk"]),
      JSON.stringify(saved.ingredients));
    ok("  directions one per step, numbers gone",
      JSON.stringify(saved.steps) === JSON.stringify(["Whisk everything.", "Fry in a hot pan."]),
      JSON.stringify(saved.steps));
    ok("  in the shape the recipe builder saves",
      ["id", "created", "tags", "source", "servings", "images", "description", "notes"]
        .every((k) => k in saved));
  }
  ok("  and it goes back to the start, empty", field().tagName === "INPUT" && field().value === ""
    && /Saved/.test(qr.textContent));

  /* ---- Fleeting viewer ------------------------------------------------ */
  const fv = () => $("[data-fv]");
  await wait(100);
  ok("the Fleeting viewer shows the first note", /first thought/.test(fv().textContent)
    && /1 of 3/.test(fv().textContent), fv().textContent.replace(/\s+/g, " ").slice(0, 120));
  fv().querySelector('[data-fv-step="1"]').click();
  ok("  the arrow steps to the next", /second thought/.test(fv().textContent)
    && /2 of 3/.test(fv().textContent));
  ok("  and a long note scrolls inside the widget",
    !!fv().querySelector(".dash-fv-text")
    && /\.dash-fv-text \{[^}]*overflow-y: auto/.test(
      fs.readFileSync(path.join(UI, "home/home.css"), "utf8")));
  /* Cam (2026-10-02): "settings to the fleeting notes viewer so i can scale up
     the text ... scrollable so when it is to large i can scroll through it" */
  const fvSize = () => fv().querySelector(".dash-fv-text").getAttribute("style") || "";
  ok("  A− and A+ are there; the text starts at its usual size",
    !!fv().querySelector('[data-fv-size="1"]') && fv().querySelector('[data-fv-size="-1"]').disabled
    && /\* 1\)/.test(fvSize()), fvSize());
  fv().querySelector('[data-fv-size="1"]').click();
  await wait(100);
  fv().querySelector('[data-fv-size="1"]').click();
  await wait(100);
  ok("  A+ makes it bigger, still on the same note", /\* 1\.4\)/.test(fvSize())
    && /2 of 3/.test(fv().textContent), fvSize());
  ok("  and the size is kept with the dashboard",
    prefs.dashBlocks.find((b) => b.id === "b-fv").textScale === 1.4,
    JSON.stringify(prefs.dashBlocks.find((b) => b.id === "b-fv")));
  for (let i = 0; i < 8; i++) { fv().querySelector('[data-fv-size="1"]').click(); await wait(40); }
  ok("  up to a limit, where A+ stops", fv().querySelector('[data-fv-size="1"]').disabled
    && /\* 2\.4\)/.test(fvSize()), fvSize());
  ok("  the box has a ceiling, so a big note scrolls rather than growing the widget",
    /\.dash-fv-text \{[^}]*max-height:/.test(fs.readFileSync(path.join(UI, "home/home.css"), "utf8")));
  key(fv(), "ArrowRight");
  ok("  the keyboard's arrows walk it too", /3 of 3/.test(fv().textContent));
  key(fv(), "ArrowLeft");
  fv().querySelector("[data-fv-del]").click();
  await wait(150);
  const yes = [...doc.querySelectorAll("button")].find((b) => b.textContent.trim() === "Delete"
    && !b.hasAttribute("data-fv-del"));
  ok("  deleting asks first", !!yes);
  if (yes) { yes.click(); await wait(300); }
  ok("  and deletes that note from Fleeting", deleted.length === 1 && deleted[0] === 2,
    JSON.stringify(deleted));
  ok("  then shows the note that moved up into its place",
    /third thought/.test(fv().textContent) && /2 of 2/.test(fv().textContent),
    fv().textContent.replace(/\s+/g, " ").slice(0, 120));

  /* A thought jotted in Quick note appears in the viewer beside it. */
  const qn = $("#dash-qn-text");
  if (qn) {
    qn.value = "jotted just now";
    $("#dash-qn-save").click();
    await wait(300);
    fv().querySelector('[data-fv-step="1"]').click();
    ok("a quick note shows up in the viewer without a restart",
      /3 of 3/.test(fv().textContent) && /jotted just now/.test(fv().textContent),
      fv().textContent.replace(/\s+/g, " ").slice(0, 120));
  }

  const broke = [...thrown, ...asyncFailures];
  ok("nothing threw along the way", broke.length === 0, broke.slice(0, 3).join(" | "));
}

run().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_dashboard_widgets.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
