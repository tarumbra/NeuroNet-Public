/* ==========================================================================
   Photo files named like the photos: the page's part (ui/app.js).
   ==========================================================================
   Cam (2026-10-02): "when naming a photo or if it has been named within
   Neuronet application please make the name in the file explorer match now."
   The real app in jsdom; the back end renames on paper.
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

const U1 = "4df473a1cd9642c090823a3b4fe7ebe7.jpg", U2 = "227973a5a8dc439e965cc19322f65323.jpeg";
const U3 = "9589ae14978f42c99209b3357c0eafa4.jpg";
let photos = {photos: [
  {storedName: U1, originalName: "20231104_122110.jpg", caption: "Dad, Mum and Milly", tags: [], albumIds: []},
  {storedName: U2, originalName: "1526207133702.jpeg", caption: "Lounge Room Birthday", tags: [], albumIds: []},
  {storedName: U3, originalName: "IMG_1.jpg", caption: "", tags: [], albumIds: []},
  {storedName: "Beach.jpg", originalName: "Beach.jpg", caption: "Beach", tags: [], albumIds: []},
], albums: [], folders: [], photoTagList: []};
let kitchen = {photos: [{storedName: U1}], albums: [], photoTagList: [], folders: [], events: [], contacts: [],
  recipes: [{id: "r1", name: "Roast", images: [{storedName: U2, originalName: U2}]}],
  menus: [], shoppingLists: [], books: [], tagList: []};
let prefs = {};
const calls = [];
const safe = (n) => n.replace(/[^A-Za-z0-9 _.-]+/g, "").replace(/\s+/g, " ").trim();

async function run() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; nothing here can run without it)"); return; }
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 4}),
    photo_get_data: async () => JSON.parse(JSON.stringify(photos)),
    photo_save_data: async (d) => { photos = JSON.parse(JSON.stringify(d)); calls.push("save"); return {ok: true}; },
    photo_rename: async (stored, name) => {
      calls.push("rename " + stored);
      const ext = stored.slice(stored.lastIndexOf("."));
      const to = safe(name) + ext;
      return {storedName: to, originalName: to};
    },
    photo_names_backup: async (map) => { calls.push(map ? "log" : "backup"); return {ok: true, folder: "/b"}; },
    photo_refs_rename: async (map) => { calls.push("refs " + JSON.stringify(map)); return {changed: 1}; },
    get_prefs: async () => JSON.parse(JSON.stringify(prefs)),
    set_prefs: async (p) => { Object.assign(prefs, p || {}); return {ok: true}; },
    kc_available: async () => true,
    kc_get_data: async () => JSON.parse(JSON.stringify(kitchen)),
    kc_save_data: async (d) => { kitchen = JSON.parse(JSON.stringify(d)); calls.push("kitchen"); return {ok: true}; },
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [], wordGuessList: [], slideImages: [], books: []}),
    stuff_load: async () => ({inventories: []}),
    photo_store: async (p) => ({storedName: "f00dfeedf00dfeedf00dfeedf00dfeed.jpg", originalName: "x.jpg"}),
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
  await wait(5500);                       // the naming starts 4 s after boot, in the background

  const by = (n) => photos.photos.find((p) => p.caption === n);
  ok("every photo with a name has a file of that name now",
    by("Dad, Mum and Milly").storedName === "Dad Mum and Milly.jpg"
      && by("Lounge Room Birthday").storedName === "Lounge Room Birthday.jpeg", JSON.stringify(photos.photos.map((p) => p.storedName)));
  ok("  a photo with no name is left as it is", photos.photos.some((p) => p.storedName === U3) && !calls.includes("rename " + U3));
  ok("  everything was backed up before the first file moved",
    calls.indexOf("backup") >= 0 && calls.indexOf("backup") < calls.findIndex((c) => c.startsWith("rename ")), calls.join(" | "));
  ok("the Kitchen follows: its own photos and a recipe's picture",
    kitchen.photos[0].storedName === "Dad Mum and Milly.jpg"
      && kitchen.recipes[0].images[0].storedName === "Lounge Room Birthday.jpeg"
      && kitchen.recipes[0].images[0].originalName === "Lounge Room Birthday.jpeg", JSON.stringify(kitchen.recipes[0]));
  const refs = calls.find((c) => c.startsWith("refs "));
  ok("  and Media's covers and the boards are told the old -> new names",
    !!refs && refs.includes(U1) && refs.includes("Dad Mum and Milly.jpg"), refs);
  ok("  the list is kept to undo by", calls.includes("log"));
  ok("done once: remembered", !!prefs.photoFilesNamed);

  /* Naming a photo as it comes in names its file too. */
  calls.length = 0;
  const res = await w.SS.shared.addToPhotos({path: "/tmp/a.jpg", folder: "Covers", tag: "Cover", caption: "Rumours"});
  ok("a photo added with a name gets that file name straight away",
    res.ok && res.storedName === "Rumours.jpg" && photos.photos.some((p) => p.storedName === "Rumours.jpg"), JSON.stringify(res));

  ok("nothing threw", !asyncFailures.length, asyncFailures.slice(0, 3).join(" | "));
}

run().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_photo_names.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
