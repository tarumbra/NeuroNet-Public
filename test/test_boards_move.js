/* ==========================================================================
   Everything on a board can be picked up and moved.
   ==========================================================================
   Cam: "when working with a mindmap template in boards i cannot move the
   boxes around? Is this and intended feature?"

   It was not. Everything on a board is found by its id -- the SVG carries
   data-id, a click reads that attribute back, and startMove looks the
   item up by it. The templates built their shapes WITHOUT an id, so every
   shape in a mind map, a SWOT or a Kanban rendered as data-id="" (esc of
   undefined is an empty string) and the lookup that followed found
   nothing. Selecting, moving, recolouring and deleting all quietly did
   nothing at all. Only a Blank board worked, because you draw its shapes
   yourself and drawing assigns an id.

   Measured in a real browser before the fix: seven shapes on a new mind
   map, every one with data-id="", and a 120-pixel drag that moved the box
   exactly zero pixels.

   THE OLD TEST PASSED THROUGH ALL OF THAT. It read the source for
   `k: "rect"` and concluded templates were "ordinary items, not a special
   kind" -- true, and useless, because being an ordinary item is not the
   same as being a usable one. This file asks the question the other way
   round: it builds each template, hands it to the real editor, and drags
   something.
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms || 40));

function declaredScripts() {
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
}

const saved = {};

async function boot() {
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    cards_read_json: async () => ({tarotDecks: [], oracleDecks: [], lenormandDecks: [],
      tarotReadings: [], oracleReadings: [], lenormandReadings: [],
      meditation: [], journal: [], gratitude: []}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    boards_list: async () => Object.entries(saved).map(([id, b]) => ({
      id, name: b.name, pages: (b.pages || []).length, updated: "2026-09-25"})),
    boards_read: async (id) => ({board: JSON.parse(JSON.stringify(saved[id]))}),
    boards_write: async (id, b) => { saved[id] = b; return {ok: true}; },
    boards_formats: async () => ({pptx: true}),
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
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
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
  await wait(300);
  return w;
}

(async () => {
  const w = await boot();
  const SS = w.SS;
  const TEMPLATES = SS.Boards._test.TEMPLATES;

  /* ---- 1. a template's shapes are usable things ---------------------- */
  const named = Object.keys(TEMPLATES).filter((k) => k !== "blank");
  ok("there are templates to check", named.length >= 3, named.join(", "));

  /* Built by THE APP'S OWN function, not by a copy of it here. Writing the
     id-assigning line out again in the test was the first attempt, and it
     passed happily with the bug put straight back into boards.js -- the
     test was only ever checking itself. */
  const boardFrom = SS.Boards._test.boardFrom;
  const SIZES = SS.Boards._test.SIZES;
  ok("the app exposes the one function that builds a board",
    typeof boardFrom === "function",
    "if the test builds its own board it is testing nothing");
  const built = {};
  for (const key of named) {
    built[key] = boardFrom(key, {name: key, size: SIZES[0], paper: "grid"});
  }
  for (const key of named) {
    const items = built[key].pages[0].items;
    ok(`a new ${key} board gives every shape an id`,
      items.length > 0 && items.every((it) => it.id),
      items.filter((it) => !it.id).length + " of " + items.length + " without one");
    ok(`  and no two the same`,
      new Set(items.map((it) => it.id)).size === items.length,
      "two shapes sharing an id move together and delete together");
  }

  /* ---- 2. the editor repairs boards saved before the fix ------------- */
  /* Cam already has mind maps on disk with no ids in them. A fix that only
     helped NEW boards would leave the one he is looking at just as stuck. */
  {
    const old = {name: "Map one", w: 1600, h: 1000, paper: "grid",
      pages: [{items: TEMPLATES.mindmap.items()}], created: "2026-09-20"};
    ok("a board saved by the old build really has no ids",
      old.pages[0].items.every((it) => !it.id),
      "if this ever fails the rest of this section is testing nothing");

    saved["Map one"] = old;
    const host = w.document.createElement("div");
    w.document.body.appendChild(host);
    const ed = w.SS.BoardEditor.open(host, "Map one",
      JSON.parse(JSON.stringify(old)), () => {});
    const items = ed.board.pages[0].items;
    ok("  and opening it in the editor gives every shape one",
      items.length > 0 && items.every((it) => it.id),
      items.filter((it) => !it.id).length + " still without one");
    ok("  all different", new Set(items.map((i) => i.id)).size === items.length);

    /* Opening must not rewrite the file. The repair is in memory; the
       first real edit is what saves it. */
    ok("  without rewriting the saved board just for being opened",
      saved["Map one"].pages[0].items.every((it) => !it.id),
      "merely opening a board should never write to disk");

    /* ---- 3. and now the thing Cam could not do -------------------- */
    const target = items.find((it) => it.k === "rect");
    ok("there is a box to move", !!target, "the mind map has no rect in it");
    if (target) {
      const x0 = target.x, y0 = target.y;
      ed.sel = new Set([target.id]);
      ed.startMove(0, 0);
      /* startMove listens on the document for the move and the release. */
      const ev = (type, x, y) => {
        const e = new w.MouseEvent(type, {clientX: x, clientY: y, bubbles: true});
        w.document.dispatchEvent(e);
      };
      ev("mousemove", 120, 80);
      ev("mouseup", 120, 80);
      ok("a box on a template board moves when it is dragged",
        target.x === x0 + 120 && target.y === y0 + 80,
        `asked for +120,+80 and got ${target.x - x0},${target.y - y0} `
        + "-- the lookup by id is what used to find nothing here");

      /* The real failure was upstream of the arithmetic: the item could
         not be FOUND. Prove the lookup is what is being tested. */
      ed.sel = new Set(["no-such-id"]);
      const before = JSON.stringify(items.map((i) => [i.x, i.y]));
      ed.startMove(0, 0);
      ev("mousemove", 50, 50);
      ev("mouseup", 50, 50);
      ok("  and an id that matches nothing moves nothing, rather than throwing",
        JSON.stringify(items.map((i) => [i.x, i.y])) === before);
    }

    /* Selecting is the same lookup, so it broke the same way: with no id,
       nothing was ever selected and the resize handles never appeared. */
    if (target) {
      ed.sel = new Set([target.id]);
      ed.draw();
      const handles = ed.svg.querySelectorAll("[data-handle]").length;
      ok("a selected shape gets its resize handle", handles > 0,
        "no handle means nothing was really selected");
      const drawn = [...ed.svg.querySelectorAll("[data-id]")]
        .map((e) => e.getAttribute("data-id"));
      ok("  and every shape on the canvas carries a real id",
        drawn.length > 0 && drawn.every((d) => d && d.length > 1),
        JSON.stringify(drawn.slice(0, 5))
        + ' -- data-id="" is what an item with no id renders as');
    }
  }

  /* ---- 4. every template, not just the one Cam noticed --------------- */
  /* He reported the mind map. SWOT and Kanban were built the same way and
     were just as frozen, so they are checked too -- and so is any template
     added later, because this walks the list rather than naming three. */
  for (const key of named) {
    const host = w.document.createElement("div");
    w.document.body.appendChild(host);
    const ed = w.SS.BoardEditor.open(host, key,
      {name: key, w: 1600, h: 1000, pages: [{items: TEMPLATES[key].items()}]},
      () => {});
    const items = ed.board.pages[0].items;
    const movable = items.find((it) => it.k !== "text") || items[0];
    const x0 = movable.x;
    ed.sel = new Set([movable.id]);
    ed.startMove(0, 0);
    const ev = (type, x, y) => w.document.dispatchEvent(
      new w.MouseEvent(type, {clientX: x, clientY: y, bubbles: true}));
    ev("mousemove", 40, 0);
    ev("mouseup", 40, 0);
    ok(`${key}: its shapes move`, movable.x === x0 + 40,
      `moved ${movable.x - x0} of 40`);
  }

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
