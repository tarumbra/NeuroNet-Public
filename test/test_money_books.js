/* ==========================================================================
   Money -> Books (money.js), the Money side of the desktop Bookshelf.
   ==========================================================================
   Cam chose "Add books to Money" (2026-10-01): a book of months or
   fortnights, with the Calculation sheet and savings goals, that reads on
   the Bookshelf and prints. Real app in jsdom, a fake budget.
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
process.on("unhandledRejection", (r) => asyncFailures.push(String((r && r.message) || r)));

let money = {
  templates: [{id: "rent", name: "Rent", kind: "Bill", category: "Home", amount: 450, cycle: "Fortnightly",
               start: "2026-01-02", active: true},
              {id: "pay", name: "Pay", kind: "Income", category: "Work", amount: 2100, cycle: "Fortnightly",
               start: "2026-01-08", active: true}],
  oneoffs: [], payments: {}, spendingLog: {periodStart: "", entries: []},
  goals: [{id: "g1", name: "Holiday", target: 3000, transactions: [{id: "t", date: "2026-02-01", type: "deposit", amount: 750}],
           method: "percent", percent: 10, payFrequency: "fortnight", targetDate: "2026-12-01"}],
  calc: {bills: [], income: []},
};
const saves = [], printed = [], fullscreen = [];

async function run() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; nothing here can run without it)"); return; }
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    kc_available: async () => true,
    kc_get_data: async () => ({photos: [], albums: [], photoTagList: [], folders: [], events: [], contacts: [],
      recipes: [], menus: [], shoppingLists: [], books: [], tagList: []}),
    kc_get_money: async () => JSON.parse(JSON.stringify(money)),
    kc_save_money: async (d) => { money = JSON.parse(JSON.stringify(d)); saves.push(money); return {ok: true}; },
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [], wordGuessList: [], slideImages: [], books: []}),
    print_header: async (t, o) => `<div class="LH">NeuroNet | ${t} | ${o.subtitle} | ${o.logo}</div>`,
    open_print_document: async (html, kind) => { printed.push([html, kind]); return {ok: true}; },
    reader_fullscreen: async (on) => { fullscreen.push(on); return {ok: true}; },
    stuff_load: async () => ({inventories: []}),
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = () => ({matches: false, addListener() {}, removeListener() {}});
  w.scrollTo = () => {};
  w.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  w.cancelAnimationFrame = (id) => clearTimeout(id);
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {get: (t, n) =>
    n === "getImageData" ? () => ({data: [0, 0, 0, 255]}) : n === "measureText" ? () => ({width: 5})
      : () => ({addColorStop() {}})});
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(900);
  const thrown = [];
  w.addEventListener("error", (e) => thrown.push(String(e.message || e)));
  const doc = w.document, $ = (s) => doc.querySelector(s), $$ = (s) => [...doc.querySelectorAll(s)];
  const button = (label) => $$("button").find((b) => b.textContent.trim() === label);

  /* ---- the reader can have one before Money is ever opened ----------------- */
  money.books = [{id: "mb0", name: "Early", mode: "period", from: "2026-01-01", to: "2026-02-01", calc: false, goals: false}];
  const early = await w.SS.MoneyBooks.document("mb0");
  ok("a Money book reads before Money has been opened", !!early && /January 2026/.test(early.html)
    && /February 2026/.test(early.html) && early.printKind === "money-book", early && early.html.slice(0, 120));
  delete money.books;

  /* ---- Money -> Books ---------------------------------------------------- */
  w.SS.go("money:books"); await wait(900);
  ok("Money has a Books page", w.SS._test.view === "money:books" && !!$("#mb-new"), w.SS._test.view);
  ok("  in its menu", $$("#ss-subnav-body [data-view]").some((b) => b.dataset.view === "money:books"));
  $("#mb-new").click(); await wait(200);
  $("#mb-name").value = "2026 so far";
  $("#mb-fortnight").click();
  for (let i = 0; i < 3; i++) $("#mb-to-next").click();
  ok("the dialog says what the book will hold", /4 fortnights/.test($("#mb-summary").textContent), $("#mb-summary").textContent);
  button("Make the book").click(); await wait(500);
  const b = (money.books || [])[0];
  ok("the book is saved with Money: its make-up, not a copy",
    !!b && b.name === "2026 so far" && b.mode === "fortnight" && b.calc === true && b.goals === true
      && !("html" in b), JSON.stringify(money.books));
  ok("  and listed", $$(".mb-book").length === 1 && /2026 so far/.test($(".mb-book").textContent));

  const got = await w.SS.MoneyBooks.document(b.id);
  const H = got.html;
  if (process.env.NN_DUMP) fs.writeFileSync(process.env.NN_DUMP, H);
  ok("its document: a cover with the Cashbox letterhead and its contents",
    // since 2026-10-05 the letterhead says what it is; the cover names the book
    /<section class="mb-cover"><div class="LH">NeuroNet \| Money book \|/.test(H) && /class="mb-title">2026 so far</.test(H)
      && /<ol class="mb-list"><li>Budget, by fortnight<\/li><li>Calculation<\/li><li>Savings goals<\/li><\/ol>/.test(H),
    H.slice(0, 500));
  ok("  then a page per fortnight -- Money's own printout, with its bills and income",
    (H.match(/<section class="period">/g) || []).length === 4 && /Rent/.test(H) && /Pay/.test(H));
  ok("  the Calculation sheet", /class="mb-calc"/.test(H) && /Calculation|Bills/.test(H));
  ok("  and the savings goals, with what's saved", /class="mb-goals"/.test(H) && /Holiday/.test(H) && /25%/.test(H));
  ok("each printout's styles kept to its own part (their .totals differ)",
    /\.mb-periods \.totals \{/.test(H) && /\.mb-calc \.totals \{/.test(H) && !/\n\s*\.totals \{/.test(H));
  ok("  and the printouts' 'press Ctrl+P' hints are left out of the book", !/class="hint"/.test(H));

  /* ---- read and print ---------------------------------------------------- */
  $('.mb-book [data-mb="read"]').click(); await wait(300);
  ok("Read opens it in NeuroNet's reader", w.SS.Reader.isOpen && /2026 so far/.test($("#rd-title").textContent));
  w.SS.Reader.close(); await wait(50);
  $('.mb-book [data-mb="print"]').click(); await wait(300);
  ok("Print prints the whole book, counted as a Money book",
    printed.length === 1 && printed[0][1] === "money-book" && /mb-cover/.test(printed[0][0]));
  const stats = fs.readFileSync(path.join(UI, "stats/stats.js"), "utf8");
  ok("  App stats has a name for that", /\["money-book", "Money books"\]/.test(stats));

  /* ---- edit, delete -------------------------------------------------------- */
  $('.mb-book [data-mb="edit"]').click(); await wait(200);
  $("#mb-goals").checked = false;
  $("#mb-month").click();
  button("Save").click(); await wait(400);
  ok("Edit changes the make-up", money.books[0].goals === false && money.books[0].mode === "period", JSON.stringify(money.books[0]));
  $('.mb-book [data-mb="del"]').click(); await wait(200);
  const yes = $$("#confirm-veil button").find((x) => x.textContent.trim() === "Delete");
  if (yes) { yes.click(); await wait(400); }
  ok("Delete takes the book away and nothing else", (money.books || []).length === 0
    && money.templates.length === 2 && money.goals.length === 1, JSON.stringify(money.books));

  ok("nothing threw", !thrown.length && !asyncFailures.length, thrown.concat(asyncFailures).slice(0, 3).join(" | "));
}

run().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_money_books.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
