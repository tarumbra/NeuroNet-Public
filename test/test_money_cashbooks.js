/* ==========================================================================
   Money -> cash books and Compare (money.js), 2026-10-11.
   ==========================================================================
   Cam: "i want to be able to have seperate cash books. So my main one and
   then another one say a hypothetical one set up. Then i should be able to
   compare them against each other as well. With differences in incomes,
   bills, left over money etc." Real app in jsdom, a fake budget.
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
const saves = [], printed = [], fullscreen = [], prefs = {};

async function run() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; nothing here can run without it)"); return; }
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => Object.assign({}, prefs),
    set_prefs: async (p) => { Object.assign(prefs, p); return {ok: true}; },
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

  const T = w.CP.Money._test;
  w.SS.go("money:dashboard"); await wait(900);
  ok("a cash book bar above every Money page: Main, and New cash book", !!$("#cb-book") && $("#cb-book").value === "main" && !!$("#cb-book-new"));

  /* two people (2026-10-11, Cam: "2 completely different cashbooks ... for 2 different people") */
  // Main becomes Cam's: rename it
  $("#cb-book-rename").click(); await wait(200);
  $("#pt-in").value = "Cam"; button("Save").click(); await wait(500);
  ok("Main can be renamed to whose it is", money.mainName === "Cam" && $("#cb-book").selectedOptions[0].textContent === "Cam", money.mainName);

  // Sarah's book: empty by default, her own budget
  $("#cb-book-new").click(); await wait(200);
  ok("  a new cash book asks whose it is, and starts empty", /Whose cash book/.test(doc.body.textContent)
     && doc.querySelector('input[name="ncb-from"]:checked').value === "empty");
  $("#ncb-name").value = "Sarah";
  button("Make the cash book").click(); await wait(500);
  const book = (money.cashbooks || [])[0];
  ok("a new cash book: someone's own, empty, saved beside Main", !!book && book.name === "Sarah" && !book.data.templates.length
     && money.templates.length === 2, JSON.stringify(money.cashbooks && money.cashbooks.map((b) => [b.name, b.data.templates.length])));
  ok("  and it's the one open now (remembered), the bar saying each is its own budget", T.bookId === book.id && prefs.moneyCashbook === book.id
     && /Each cash book is its own budget/.test($("#cb-bookbar").textContent));
  // her own income and bills: a different wage, a different rent, a car
  T.data.templates.push({id: "wage", name: "Wage", kind: "Income", category: "Work", amount: 1500, cycle: "Fortnightly", start: "2026-01-02", active: true});
  T.data.templates.push({id: "rent", name: "Rent", kind: "Bill", category: "Housing", amount: 600, cycle: "Fortnightly", start: "2026-01-02", active: true});
  T.data.templates.push({id: "car", name: "Car loan", kind: "Bill", category: "Transport", amount: 200, cycle: "Fortnightly", start: "2026-01-02", active: true});
  await T.save();
  const main = money, hers = money.cashbooks[0].data;
  ok("each book keeps its own: Cam's rent is still 450, Sarah's is 600", main.templates.find((x) => x.id === "rent").amount === 450 && hers.templates.find((x) => x.id === "rent").amount === 600
     && !main.templates.some((x) => x.id === "car"));

  /* compare */
  T._setCompare("main", book.id, "month", {y: 2026, m: 3, d: 1});
  w.SS.go("money:compare"); await wait(600);
  const A = T.bookPeriodSummary("main", {y: 2026, m: 3, d: 1}, {y: 2026, m: 3, d: 31}), B = T.bookPeriodSummary(book.id, {y: 2026, m: 3, d: 1}, {y: 2026, m: 3, d: 31});
  ok("Compare works each book's month the same way as its own pages", A.t.income !== B.t.income && B.t.bills > A.t.bills,
     JSON.stringify([A.t, B.t]));
  const page = $("#cb-content").textContent;
  if (process.env.NN_SHOT) { [...doc.querySelectorAll("script")].forEach((x) => x.remove());
    const base = doc.createElement("base"); base.href = "file://" + UI + "/"; doc.head.prepend(base);
    fs.writeFileSync(process.env.NN_SHOT, "<!doctype html>" + doc.documentElement.outerHTML); }
  ok("  the page shows both people's income, bills and left over", /The totals/.test(page) && /Income/.test(page) && /Left over/.test(page)
     && page.includes("Sarah") && page.includes("Cam"));
  const money2 = (v) => v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  ok("  a Together column adds the two up, as a household", /Together/.test(page) && page.includes(money2(A.t.income + B.t.income)), money2(A.t.income + B.t.income));
  ok("  neutral wording: higher or lower, never who's better off", !/better off/.test(page) && !$$("#cb-content .money-up, #cb-content .money-down").length);
  ok("  line by line: rent differs, the car loan is only Sarah's", /Rent/.test(page) && /Car loan/.test(page) && /only in Sarah/.test(page));
  ok("  and bills by category", /Bills by category/.test(page) && /Transport/.test(page));
  ok("Compare is in Money's menu", $$("#ss-subnav-body [data-view]").some((b) => b.dataset.view === "money:compare"));

  /* the copy option is still there */
  $("#cb-book-new").click(); await wait(200);
  $("#ncb-name").value = "Copy"; doc.querySelector('input[name="ncb-from"][value="copy"]').checked = true;
  button("Make the cash book").click(); await wait(500);
  ok("a copy is still an option", money.cashbooks.length === 2 && money.cashbooks[1].data.templates.length === 3, JSON.stringify(money.cashbooks.map((b) => b.data.templates.length)));
  $("#cb-book-delete").click(); await wait(300);
  { const y = $$("button").find((b) => /Delete it/.test(b.textContent)); if (y) y.click(); await wait(500); }

  /* back to Cam's; delete Sarah's */
  $("#cb-book").value = "main"; $("#cb-book").dispatchEvent(new w.Event("change")); await wait(400);
  ok("switch back to Cam's: its own numbers", T.bookId === "main" && T.data.templates.find((x) => x.id === "rent").amount === 450 && prefs.moneyCashbook === "main");
  $("#cb-book").value = book.id; $("#cb-book").dispatchEvent(new w.Event("change")); await wait(400);
  $("#cb-book-delete").click(); await wait(300);
  const yes = $$("button").find((b) => /Delete it/.test(b.textContent)); if (yes) yes.click(); await wait(500);
  ok("delete a cash book: it goes, Cam's stays and opens", !(money.cashbooks || []).length && money.templates.length === 2 && T.bookId === "main", JSON.stringify(money.cashbooks));
  ok("nothing threw", !thrown.length && !asyncFailures.length, thrown.concat(asyncFailures).join(" | "));
}

run().then(() => { console.log(out.join("\n")); console.log(`\n  ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })
  .catch((e) => { console.log(out.join("\n")); console.log("  FAIL  " + e.stack); process.exit(1); });
