/* ==========================================================================
   A book, built and printed.
   ==========================================================================
   Cam: "a book feature for the Notes subsection where I can add any type
   of note from a subsection to it and then export or print."

   THE CASE THAT MATTERS MOST IS THE MISSING ONE. A book holds references,
   not copies, which is what lets a manual reprint with this term's notes
   in it. The price is that renaming or deleting something breaks a
   book's reference to it, and the only unacceptable outcome is the quiet
   one: a chapter silently absent from a printed document, or worse, the
   wrong chapter in its place. So most of what is checked here is what
   happens when a reference has gone.

   The rest checks that each kind is rendered BY WHATEVER OWNS IT -- a
   sheet's totals come from the grid engine, a note from the Vault's own
   markdown renderer -- because a second renderer means a printed total
   that disagrees with the one on screen.
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

/* ---- the world the book is built out of -------------------------------- */

const NOTE_MD = `# Winter Block

The **plan** for the season.

- Lower A
- Upper B

| Week | Exercise | Sets |
|------|----------|------|
| 1 | Back squat | 5 |
`;

const SHEET = {
  name: "Loads",
  grid: {v: 1, cols: [{w: 110}, {w: 110}],
    rows: [["Week", "Load"], ["1", "82.5"], ["2", "85"], ["3", "=B2+B3"]],
    freeze: 1, fmt: {}, cond: [], filter: null, chart: null},
};
const BOARD = {name: "Layout", w: 800, h: 500,
  pages: [{items: [{id: "i1", kind: "rect", x: 40, y: 40, w: 200, h: 120}]}]};
const TREE = [
  {name: "Block 1", type: "note", path: "Block 1.md"},
  {name: "Manual", type: "pdf", path: "Manual.pdf"},
  {name: "Map", type: "canvas", path: "Map.canvas"},
];

const state = {books: {}, printed: null, exported: null, vanished: new Set()};

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

    notes_list_tree: async () => TREE.filter((n) => !state.vanished.has(n.path)),
    notes_read_note: async (p) => (state.vanished.has(p) ? null : NOTE_MD),
    notes_read_all_notes: async () => ({notes: TREE, truncated: false}),
    notes_read_canvas: async () => JSON.stringify(
      {nodes: [{id: "n1", type: "text", text: "First idea"},
               {id: "n2", type: "text", text: "Second idea"}]}),

    cells_list: async () => (state.vanished.has("sheet:loads") ? [] :
      [{id: "loads", name: "Loads", rows: 4, cols: 2, filled: 8, updated: "2026-09-25"}]),
    cells_read: async (id) => (state.vanished.has("sheet:" + id)
      ? {error: "That sheet is gone."} : {sheet: SHEET}),

    boards_list: async () => [{id: "lay", name: "Layout", pages: 1, updated: "2026-09-25"}],
    boards_read: async () => ({board: BOARD}),

    notebooks_list: async () => Object.entries(state.books).map(([id, b]) => ({
      id, name: b.name, subtitle: b.subtitle || "",
      count: (b.entries || []).length, updated: "2026-09-25"})),
    notebooks_read: async (id) => (state.books[id]
      ? {book: JSON.parse(JSON.stringify(state.books[id]))}
      : {error: "That book is gone."}),
    notebooks_write: async (id, b) => { state.books[id] = b; return {ok: true}; },
    notebooks_delete: async (id) => { delete state.books[id]; return {ok: true}; },
    notebooks_formats: async () => ({html: true, docx: true}),
    notebooks_export: async (name, html, fmt, letterhead) => {
      state.exported = {name, html, fmt, letterhead};
      return {ok: true, path: "/desktop/" + name};
    },
    open_print_document: async (html, kind) => { state.printed = html; state.printKind = kind; return {ok: true}; },
    print_header: async (t, o) => `<div class="LH">NeuroNet | ${t} | ${o.subtitle} | ${o.logo} ${o.name}</div>`,
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
  await wait(400);
  return w;
}

(async () => {
  const w = await boot();
  const SS = w.SS;

  /* ---- 1. it is there, and filed under Notes ------------------------- */
  {
    const appJs = fs.readFileSync(path.join(UI, "app.js"), "utf8");
    /* Cam: "rename the sub section books to notebooks" -- the name, not the
       view key, so every saved favourite still finds it. */
    ok("Notebooks is a subsection of Notes",
      /\{key: "books:list", name: "Notebooks"\}/.test(appJs));
    /* notes:* is the Vault's own prefix. Boards, Cells and Guides all
       learned this; a fourth one filed there would open underneath the
       editor and show nothing. */
    ok("  under its own prefix, not notes:",
      /books: "notes"/.test(appJs) && !/\{key: "notes:books"/.test(appJs));
    ok("  and the router knows about it", /SS\.Notebooks,/.test(appJs));
    ok("the module and its document builder both loaded",
      !!SS.Notebooks && typeof SS.Notebooks.buildHtml === "function",
      "buildHtml lives in books-print.js; if the script order changed, "
      + "Print would quietly do nothing");
  }

  /* ---- 2. a book of one of everything -------------------------------- */
  const book = {
    id: "winter", name: "Winter Manual", subtitle: "Pre-season",
    brand: "Coach Cam", created: "2026-09-25", entries: [
      {type: "note", refId: "Block 1.md"},
      {type: "sheet", refId: "loads"},
      {type: "board", refId: "lay"},
      {type: "guide", refId: "cells-formulas"},
      {type: "pdf", refId: "Manual.pdf"},
      {type: "canvas", refId: "Map.canvas"},
    ],
  };
  state.books.winter = book;

  const html = await SS.Notebooks.buildHtml(book);
  ok("a book builds into one document", !!html && html.length > 1000,
    String(html).slice(0, 80));
  ok("  with a cover carrying the name, the subtitle and the cover name",
    html.includes("Winter Manual") && html.includes("Pre-season")
    && html.includes("Coach Cam"));
  ok("  a contents page, because there is more than one thing in it",
    html.includes("Contents"));
  ok("  and one chapter per entry",
    (html.match(/class="chapter"/g) || []).length === book.entries.length,
    (html.match(/class="chapter"/g) || []).length + " chapters for "
    + book.entries.length + " entries");

  /* Each kind, rendered by the thing that owns it. */
  ok("a note is rendered by the Vault's own markdown renderer",
    html.includes("<strong>plan</strong>") && html.includes("<table"),
    "bold and a table should both have survived");
  ok("a sheet is worked out by the grid engine, not printed as formulas",
    html.includes("167.5") && !html.includes("=B2+B3"),
    "=B2+B3 over 82.5 and 85 is 167.5; the printed book must show the "
    + "answer the sheet shows, not the formula");
  /* Counted inside the SHEET's own chapter, not the whole document -- the
     formula guide is full of tables of its own, and counting those made
     this fail while the sheet was perfectly correct. */
  {
    /* slice(1): the first chunk is everything BEFORE the first chapter --
       the cover and the contents page, which lists "Loads" as well. Picking
       that one found a chapter with no cells in it and reported the sheet
       as empty. */
    const chapters = html.split('<section class="chapter">').slice(1);
    const sheetChapter = chapters.find((c) => c.includes('<div class="nn-title">Loads</div>')) || "";
    const cells = (sheetChapter.match(/<td>/g) || []).length;
    ok("  and only the part of the sheet that has anything in it",
      cells > 0 && cells <= 8,
      cells + " cells printed; the sheet has 4 rows of 2 and a header, so "
      + "6 are expected. A sheet is 40 by 120 now, and printing every "
      + "empty cell would be a hundred pages of ruled paper");
  }
  ok("a board is drawn with the editor's own picture",
    html.includes("<svg") && html.includes("Layout"));
  ok("a guide brings its own body", html.includes("SUM"));
  ok("a canvas prints what its cards say",
    html.includes("First idea") && html.includes("Second idea"));
  ok("  and says outright that its arrangement cannot be printed",
    /arrangement cannot be printed/i.test(html));
  ok("a PDF is referenced rather than silently left out",
    /This is a PDF/i.test(html) && html.includes("Manual.pdf"));

  /* Chapters must start on a fresh page, or a book prints as one run-on
     document. Both spellings, because the renderer may be old. */
  ok("every chapter starts on a new page",
    /page-break-before: always/.test(html) && /break-before: page/.test(html));

  /* ---- 3. a reference that has gone ---------------------------------- */
  {
    state.vanished.add("Block 1.md");      // the note was renamed or deleted
    state.vanished.add("sheet:loads");     // and so was the sheet
    const gone = await SS.Notebooks.buildHtml(book);

    ok("a missing note leaves a marked gap, not a silent hole",
      /class="gap"/.test(gone) && /Missing/.test(gone),
      "someone reading the printed book has to be able to see that a "
      + "chapter was meant to be there");
    ok("  naming what is missing and where it was",
      gone.includes("Block 1.md"));
    ok("  and still one chapter per entry, so nothing is quietly dropped",
      (gone.match(/class="chapter"/g) || []).length === book.entries.length,
      (gone.match(/class="chapter"/g) || []).length + " of " + book.entries.length);
    ok("  two gaps for two missing things",
      (gone.match(/class="gap"/g) || []).length === 2,
      (gone.match(/class="gap"/g) || []).length + " gaps");
    ok("  and the contents page says which ones",
      /<li>[^<]*Block 1[^<]*—\s*<i>missing<\/i>/.test(gone)
      || /missing<\/i>/.test(gone));
    ok("  while everything still there prints as it did",
      gone.includes("<svg") && /This is a PDF/i.test(gone));

    /* And the contents list in the app marks them too -- finding out at
       the printer is too late. */
    const r = await SS.Notebooks._test.resolve({type: "note", refId: "Block 1.md"});
    ok("the app's own contents list knows it has gone", r.found === false, JSON.stringify(r));
    const still = await SS.Notebooks._test.resolve({type: "board", refId: "lay"});
    ok("  and knows what is still there", still.found === true && still.title === "Layout",
      JSON.stringify(still));

    state.vanished.clear();
  }

  /* ---- 4. an empty book, and a book of one --------------------------- */
  {
    const empty = await SS.Notebooks.buildHtml(
      {id: "e", name: "Empty", entries: []});
    ok("an empty book still makes a cover rather than failing",
      empty.includes("Empty") && !/class="chapter"/.test(empty));
    ok("  and skips the contents page, which would list nothing",
      !empty.includes(">Contents<"));
    const one = await SS.Notebooks.buildHtml(
      {id: "o", name: "One", entries: [{type: "guide", refId: "overview"}]});
    ok("a book of one thing skips the contents page too",
      !one.includes(">Contents<") && /class="chapter"/.test(one));
  }

  /* ---- 5. the things a book can hold --------------------------------- */
  {
    const kinds = SS.Notebooks._test.TYPES.map((t) => t.id).sort();
    ok("every kind of thing in Notes can go in a book",
      JSON.stringify(kinds)
        === JSON.stringify(["board", "canvas", "guide", "journal", "note", "pdf", "scrapbook", "sheet"]),
      kinds.join(", "));
    /* Cam asked for "any type of note from a subsection", so the check
       that matters over time is against the SUBSECTIONS themselves: add a
       subsection to Notes and this goes red until a book can hold it. */
    const appJs = fs.readFileSync(path.join(UI, "app.js"), "utf8");
    const notesBlock = appJs.slice(appJs.indexOf('{key: "notes", name: "Notes"'));
    const subs = [...notesBlock.slice(0, notesBlock.indexOf("]}"))
      .matchAll(/\{key: "([a-z]+):[a-z]+", name: "([^"]+)"/g)].map((m) => m[1]);
    /* "fleeting" is carried because a fleeting note IS an ordinary note in
       a Fleeting folder of the vault -- notes_list_tree lists it as kind
       "note", so a book already holds and opens one. Nothing new had to be
       taught to books. */
    /* "ebooks" is left out on purpose, and named here so that is a decision
       rather than an oversight: an ebook is someone else's whole book, not a
       note of Cam's, and a printed notebook with a 400-page novel inside it
       is not what either was for. */
    /* "journal": an entry goes in as a chapter of its own (type "journal"),
       with its cards and photos. */
    const carried = new Set(["notes", "boards", "scrapbook", "cells", "guides", "books",
                             "fleeting", "ebooks", "journal"]);
    const unknown = subs.filter((s) => !carried.has(s));
    ok("  and a new Notes subsection would have to be added here too",
      !unknown.length, "a book cannot hold: " + unknown.join(", "));
  }

  /* ---- 5b. printed and exported on the shared letterhead --------------- */
  /* Cam: "When printing a notebook from the notes main section i want to use
     this icon ... Please design the print pages from the notebooks to match
     all the other print and export pages." */
  {
    const $ = (sel) => w.document.querySelector(sel);
    SS.go("books:list"); await wait(500);
    ok("the list is headed Notebooks", /Notebooks/.test(($(".page-h") || {}).textContent || ""));
    const openBtn = $('[data-open="winter"]');
    if (openBtn) { openBtn.click(); await wait(500); }
    const pr = $("#bk-print");
    if (pr) { pr.click(); await wait(800); }
    const p = state.printed || "";
    ok("a printed notebook opens on the shared letterhead",
      // since 2026-10-05 the letterhead says what it is, and the cover's title block names it
      /<div class="LH">NeuroNet \| Notebook \| {2}\| notes\.png notes<\/div>/.test(p) && /class="nn-title">Winter Manual</.test(p)
        && /class="nn-sub">Pre-season</.test(p),
      p.slice(0, 300));
    ok("  in the house style: a title block for every chapter, a numbered contents list, a footer",
      (p.match(/class="nn-title-block"/g) || []).length >= 6 && /class="bk-index"/.test(p) && /class="nn-foot"/.test(p));
    ok("  and counted as a notebook in App stats", state.printKind === "note-book", state.printKind);

    const exp = $("#bk-export");
    const clickDlg = async (label) => {
      const b = [...w.document.querySelectorAll("button")].find((x) => x.textContent.trim() === label);
      if (b) { b.click(); await wait(800); }
    };
    if (exp) { exp.click(); await wait(300); await clickDlg("HTML"); }
    ok("an HTML export carries the letterhead too",
      state.exported && state.exported.fmt === "html" && /class="LH"/.test(state.exported.html),
      state.exported && state.exported.fmt);
    if (exp) { exp.click(); await wait(300); await clickDlg("Word (.docx)"); }
    const lh = state.exported && state.exported.letterhead;
    ok("  and Word is asked to draw it, with the notes mark",
      state.exported && state.exported.fmt === "docx" && !/class="LH"/.test(state.exported.html)
        && lh && lh.title === "Notebook" && lh.right_logo === "notes.png",
      JSON.stringify(lh));
  }

  /* ---- 6. an id is made safely --------------------------------------- */
  {
    const idFor = SS.Notebooks._test.idFor;
    ok("a book name becomes a safe file name",
      idFor("Winter Manual", new Set()) === "winter-manual");
    ok("  with slashes and dots taken out",
      !/[\\/.]/.test(idFor("../escape/me.json", new Set())),
      idFor("../escape/me.json", new Set()));
    ok("  and never the same as one already there",
      idFor("Winter Manual", new Set(["winter-manual"])) === "winter-manual-2");
    ok("  even for a name with nothing usable in it",
      idFor("///", new Set()) === "book", idFor("///", new Set()));
  }

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
