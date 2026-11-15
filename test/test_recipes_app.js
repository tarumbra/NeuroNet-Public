/* ==========================================================================
   Kitchen -> Recipes, 2026-10-02: photo cards, favourites first, the modern
   recipe page, and the desktop Recipes widget's page side (recipe.favourite,
   recipe.print). jsdom; the widget itself is test_recipes_card.py.
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
  const saves = [], prints = [];
  const R = (id, name, extra) => Object.assign({id, name, created: "2026-09-01T00:00:00Z", tags: ["Sauce"], source: "", servings: "4",
    images: [{storedName: id + ".jpg"}], description: "", ingredients: ["1 egg", "Milk"], steps: ["Whisk.", "Heat."], notes: ""}, extra || {});
  const doc = {recipes: [R("r1", "Pizza"), R("r2", "aioli"), R("r3", "Waffles", {favourite: true})], menus: [], books: [], tagList: ["Sauce"],
               shoppingLists: []};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    kc_get_data: async () => JSON.parse(JSON.stringify(doc)),
    kc_save_data: async (d) => { saves.push(JSON.parse(JSON.stringify(d))); return {ok: true}; },
    photo_thumb: async () => ({dataUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw="}),
    photo_full: async () => ({dataUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw="}),
    open_print_document: async (html, kind) => { prints.push([html, kind]); return true; },
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

  w.SS.go("recipes");
  await wait(900);
  const names = () => $$(".rk-card .rk-name").map((e) => e.textContent);
  ok("Recipes: photo cards, not a table", $$(".rk-card").length === 3 && !$(".detail-table"));
  ok("  favourites first, then A to Z (whatever the case)", names().join() === "Waffles,aioli,Pizza", names().join());
  ok("  in their own Favourites row", /Favourites/.test(($(".rk-section") || {}).textContent || ""));
  await wait(200);
  ok("  each card shows its photo", $$(".rk-card .rk-img").length === 3);
  $('.rk-heart[data-fav="r1"]').click();
  await wait(300);
  ok("♥ on a card: a favourite, saved, and up it goes", saves.length === 1 && saves[0].recipes.find((r) => r.id === "r1").favourite === true
     && names().join() === "Pizza,Waffles,aioli", names().join());

  /* the recipe page */
  $('[data-open="r2"]').click();
  await wait(400);
  ok("a recipe opens beside the list, its photo across the top with its name over it",
     $("#cc-split-pane.open .rk-hero .rk-title") && $(".rk-hero .rk-title").textContent === "aioli");
  ok("  ingredients to tick off, numbered method, and the old buttons where they were",
     $$(".rk-ings input[type=checkbox]").length === 2 && $$(".rk-method li").length === 2
     && ["#split-edit-recipe", "#split-print-recipe", "#split-book-recipe", "#split-del-recipe", "#split-x"].every((s) => $(s)));
  const box = $(".rk-ings input"); box.checked = true; box.dispatchEvent(new w.Event("change"));
  ok("  a ticked ingredient is crossed off", box.closest("li").classList.contains("done"));
  $("#split-fav-recipe").click();
  await wait(300);
  ok("  ♥ there too", saves[saves.length - 1].recipes.find((r) => r.id === "r2").favourite === true);

})().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_recipes_app.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
