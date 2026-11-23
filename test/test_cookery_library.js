/* ==========================================================================
   Kitchen -> Recipes with the cookbook library (23 Nov 2026): Cam's
   MasterCook cookbooks beside his own recipes. A cookbook picker with each
   book's own categories as the chips, cards a page at a time, and a save
   that carries only what changed (app.js kitchenPayload). jsdom; the Python
   half is test_cookery_library.py.
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

(async () => {
  const saves = [];
  const R = (id, name, extra) => Object.assign({id, name, created: "2026-11-23T00:00:00Z", tags: [], source: "", servings: "4",
    images: [], description: "", ingredients: ["1 egg"], steps: ["Whisk."], notes: ""}, extra || {});
  const lib = [];
  for (let i = 0; i < 150; i++) {
    const book = i < 100 ? "Soups and Sides" : "Happy Hour";
    lib.push(R("L" + i, `${book === "Happy Hour" ? "Drink" : "Dish"} ${String(i).padStart(3, "0")}`,
      {library: book, tags: [book === "Happy Hour" ? (i % 2 ? "Gin" : "Rum") : (i % 3 ? "Soup" : "Side Dish")],
       ingredients: i === 42 ? ["240 ml zzbouillon"] : ["240 ml stock"]}));
  }
  const doc = {recipes: [R("r1", "Pavlova", {tags: ["Sweet"]}), R("r2", "Creme Anglaise", {tags: ["Sauce"]}), ...lib],
               menus: [], shoppingLists: [], tagList: ["Sweet", "Sauce"], libraryToken: "tok1",
               books: [{id: "mcbook-happy", name: "Happy Hour", library: "Happy Hour", logo: "", notes: "",
                        recipeIds: lib.slice(100).map((r) => r.id)}]};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    kc_get_data: async () => JSON.parse(JSON.stringify(doc)),
    kc_save_data: async (d) => { saves.push(JSON.parse(JSON.stringify(d))); return {ok: true}; },
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => null;
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(800);
  const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
  const chips = () => $$("#rec-tag-filter .chip").map((c) => c.textContent.trim());
  const pick = (v) => { const s = $("#rec-book"); s.value = v; s.dispatchEvent(new w.Event("change")); };
  const type = async (q) => { const i = $("#rec-q"); i.value = q; i.dispatchEvent(new w.Event("input")); await wait(50); };

  w.SS.go("recipes");
  await wait(900);
  ok("the heading counts Cam's own and the cookbooks'", /2 of your own · 150 in 2 cookbooks/.test($(".cc-page-sub").textContent),
     $(".cc-page-sub").textContent);
  ok("only the first page of cards is painted", $$(".rk-card").length === 60, $$(".rk-card").length);
  ok("  with Show more for the rest", /92 to go/.test(($("#rec-more") || {}).textContent || ""));
  $("#rec-more").click();
  await wait(50);
  ok("Show more adds the rest to the end, nothing painted twice", $$(".rk-card").length === 152 && !$("#rec-more")
     && new Set($$(".rk-card").map((c) => c.dataset.open)).size === 152);
  ok("the chips are Cam's own tags while showing everything", chips().join() === "Sweet,Sauce", chips().join());

  pick("Happy Hour");
  await wait(50);
  ok("picking a cookbook shows just its recipes", $$(".rk-card").length === 50 && $$(".rk-card .rk-name").every((e) => /^Drink/.test(e.textContent)));
  ok("  and its own categories as the chips", chips().join() === "Gin,Rum", chips().join());
  $$("#rec-tag-filter .chip")[0].click();
  await wait(50);
  ok("  a chip narrows it within the cookbook", $$(".rk-card").length === 25 && /25 recipes/.test($(".rk-count").textContent));
  pick("own");
  await wait(50);
  ok("Your own recipes: just Cam's", $$(".rk-card .rk-name").map((e) => e.textContent).join() === "Creme Anglaise,Pavlova");
  pick("");
  await type("zzbouillon");
  ok("search finds a cookbook recipe by an ingredient", $$(".rk-card").length === 1 && $(".rk-card").dataset.open === "L42");
  await type("");

  $('.rk-heart[data-fav="L7"]').click();
  await wait(300);
  const s = saves[saves.length - 1];
  ok("♥ on a cookbook recipe saves just that one with Cam's own",
     s && s.recipes.map((r) => r.id).sort().join() === "L7,r1,r2" && s.recipes.find((r) => r.id === "L7").favourite === true,
     s && s.recipes.map((r) => r.id).join());
  ok("  no cookbook books ride along, nothing is called deleted, the token goes back",
     s && s.books.length === 0 && Array.isArray(s.libraryGone) && s.libraryGone.length === 0 && s.libraryToken === "tok1");

  const K = w.CK.shared.data;
  K.recipes = K.recipes.filter((r) => r.id !== "L9");
  await w.CK.shared.save();
  const s2 = saves[saves.length - 1];
  ok("a deleted cookbook recipe is sent as gone, not as 10 MB of what's left",
     s2.libraryGone.join() === "L9" && s2.recipes.length === 3, `${s2.libraryGone} / ${s2.recipes.length}`);

  /* add to a book: searchable, at most 200 painted, ticks kept across searches */
  K.books.push({id: "mine", name: "Mine", logo: "", notes: "", recipeIds: []});
  for (let i = 0; i < 260; i++) K.recipes.push(R("x" + i, "Extra " + i, {library: "Soups and Sides"}));
  w.SS.go("books");
  await wait(300);
  $('[data-open="mine"]').click();
  await wait(200);
  $("#bk-addrec").click();
  await wait(200);
  ok("Add recipes paints 200 rows at most and says so", $$(".bk-choose-row").length === 200 && /Type to find the rest/.test($(".dlg, .modal, body").textContent));
  const first = $(".bk-choose-row input"); first.checked = true; first.dispatchEvent(new w.Event("change", {bubbles: true}));
  const q = $("#bk-q"); q.value = "Extra 259"; q.dispatchEvent(new w.Event("input"));
  await wait(50);
  const row = $(".bk-choose-row input"); row.checked = true; row.dispatchEvent(new w.Event("change", {bubbles: true}));
  [...w.document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Add").click();
  await wait(300);
  const mine = w.CK.shared.data.books.find((b) => b.id === "mine");
  ok("  ticks are kept while searching", mine.recipeIds.length === 2 && mine.recipeIds.includes("x259"), mine.recipeIds.join());

  console.log("\ntest_cookery_library\n" + out.join("\n") + `\n\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
