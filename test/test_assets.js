/* ==========================================================================
   Assets -- the page, and assets used from the Scrapbook, Covers and Boards
   (jsdom, the real app).
   ==========================================================================
   Cam (2026-10-03): "lets add a new feature called assets, This is where i
   can go in and upload new assets into their respective categories or create
   them. So for example all the assets used in scrapbook and boards (These
   assets can then be used in projects straight from the app."
   The backend is test_paper_assets.py.
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
const assets = [];             // the fake library: {id, name, cat, w, h, dataUrl, design}
const calls = [];
const scraps = {}, boards = {};
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function declaredScripts() {
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
}

async function boot() {
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    cards_read_json: async () => ({tarotDecks: [], oracleDecks: [], lenormandDecks: [],
      tarotReadings: [], oracleReadings: [], lenormandReadings: [], meditation: [], journal: [], gratitude: []}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [], wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    scrapbook_stickers: async () => ({stickers: [{id: "s0123456789", name: "Cat sticker", w: 10, h: 10, dataUrl: PNG}]}),
    assets_list: async () => ({assets: assets.map(({dataUrl, design, ...a}) => ({...a, design: !!design}))}),
    asset_data: async (id) => { const a = assets.find((x) => x.id === id); return a ? {id, name: a.name, w: a.w, h: a.h, dataUrl: a.dataUrl} : {error: "gone"}; },
    asset_add: async (cat, name, dataUrl, design) => {
      calls.push(["asset_add", cat, name]);
      const id = "a" + String(assets.length + 1).padStart(12, "0");
      assets.unshift({id, name, cat, w: 40, h: 20, dataUrl, design: design || null});
      return {ok: true, id};
    },
    asset_update: async (id, ch) => { calls.push(["asset_update", id, Object.keys(ch).join()]); Object.assign(assets.find((x) => x.id === id), ch); return {ok: true}; },
    asset_delete: async (id) => { calls.push(["asset_delete", id]); assets.splice(assets.findIndex((x) => x.id === id), 1); return {ok: true}; },
    asset_design: async (id) => { const a = assets.find((x) => x.id === id); return a && a.design ? {design: a.design} : {error: "no design"}; },
    scrapbooks_read: async (id) => ({book: JSON.parse(JSON.stringify(scraps[id]))}),
    scrapbooks_write: async (id, b) => { scraps[id] = JSON.parse(JSON.stringify(b)); return {ok: true}; },
    boards_list: async () => [], boards_formats: async () => ({pptx: true}),
    boards_read: async (id) => ({board: JSON.parse(JSON.stringify(boards[id]))}),
    boards_write: async (id, b) => { boards[id] = JSON.parse(JSON.stringify(b)); return {ok: true}; },
  };
  const api = new Proxy({}, {
    get: (t, n) => (typeof n === "string" ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined),
  });
  const dom = new JSDOM(fs.readFileSync(path.join(UI, "index.html"), "utf8"),
    {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  const mem = {};
  Object.defineProperty(w, "localStorage", {configurable: true, value: {
    getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }}});
  w.matchMedia = w.matchMedia || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    save() {}, restore() {}, translate() {}, scale() {}, createLinearGradient: () => ({addColorStop() {}}),
    setTransform() {}, closePath() {},
  });
  w.AudioContext = w.AudioContext || class {
    createAnalyser() { return {connect() {}, fftSize: 0, frequencyBinCount: 0, getByteFrequencyData() {}}; }
    createMediaElementSource() { return {connect() {}}; }
    get destination() { return {}; }
    resume() { return Promise.resolve(); }
  };
  for (const src of declaredScripts()) w.eval(fs.readFileSync(path.join(UI, src), "utf8"));
  await wait(300);
  return w;
}

const press = (w, label) => [...w.document.querySelectorAll("#modal-veil .dlg-row button")].find((b) => b.textContent === label);

(async () => {
  const w = await boot();
  const SS = w.SS;
  const doc = w.document;
  SS.BoardEditor.pagePNG = async () => PNG;            // jsdom can't draw; the picture itself is the browser's job
  /* jsdom never loads an <img>: say so at once, so trimming and shrinking
     take their "keep it as it is" path instead of waiting out their timers */
  w.Image = class { set src(v) { setTimeout(() => this.onerror && this.onerror(), 0); } };

  /* ---- 1. the page ---- */
  SS.go("assets:library");
  await wait(250);
  ok("Assets opens from the Vault's menu", !!doc.querySelector(".as-head") && doc.querySelector(".as-head").textContent.includes("Assets"));
  const cats = [...doc.querySelectorAll(".as-cat")].map((b) => b.dataset.cat);
  ok("with In progress and Completed works, then Everything and each category down the side",
     cats.join() === "wip,done,all,clipart,stickers,backgrounds,borders,tapes,words,game,sticky,other", cats.join());   // + Sticky notes (2026-10-05)
  const built = doc.querySelectorAll(".as-tile.is-builtin").length;
  ok("everything built in is shown: clip art, and the Scrapbook's materials", built >= 62 + 10, String(built));
  ok("  the sticker book is there too", /Cat sticker/.test(doc.querySelector("#as-grid").textContent));
  doc.querySelector('[data-cat="clipart"]').click();
  await wait(100);
  ok("Clip art shows the built-in set (62 pieces)", doc.querySelectorAll(".as-tile.is-builtin").length === 62);
  const q = doc.querySelector("#as-q");
  q.value = "anchor"; q.dispatchEvent(new w.Event("input"));
  await wait(250);
  ok("search narrows it", doc.querySelectorAll(".as-tile").length === 1 && /Anchor/.test(doc.querySelector("#as-grid").textContent));

  /* ---- 2. adding: uploads and drops ---- */
  const file = (name, type) => new w.File([Buffer.from(PNG.split(",")[1], "base64")], name, {type});
  const res = await SS.Assets._test.addFiles(doc.querySelector(".as-head").parentElement,
    [file("owl_sitting.png", "image/png"), file("notes.txt", "text/plain")], "clipart");
  await wait(150);
  ok("pictures upload into the category, named from their files",
     res.added === 1 && calls.some((c) => c[0] === "asset_add" && c[1] === "clipart" && c[2] === "owl sitting"), JSON.stringify(calls));
  ok("  and a file that isn't a picture is skipped, and said", res.skipped.length === 1 && res.skipped[0] === "notes.txt");
  ok("  it appears under Yours", /Yours/.test(doc.querySelector("#as-grid").textContent)
     && !!doc.querySelector('.as-tile[data-id="a000000000001"]'));
  const main = doc.querySelector(".as-main");
  const drop = new w.Event("drop", {bubbles: true, cancelable: true});
  drop.dataTransfer = {types: ["Files"], files: [file("tape.png", "image/png")]};
  main.dispatchEvent(drop);
  await wait(200);
  ok("pictures dropped on the page are added to the category on screen",
     calls.some((c) => c[0] === "asset_add" && c[2] === "tape"));

  /* ---- 3. details and delete ---- */
  doc.querySelector('[data-details="a000000000001"]').click();
  doc.querySelector("#as-d-name").value = "Barn owl";
  doc.querySelector("#as-d-cat").value = "stickers";
  press(w, "Save").click();
  await wait(200);
  ok("Details renames and moves it", assets.find((a) => a.id === "a000000000001").cat === "stickers"
     && assets.find((a) => a.id === "a000000000001").name === "Barn owl");

  /* ---- 4. creating one ---- */
  doc.querySelector("#as-create").click();
  doc.querySelector("#as-c-name").value = "Leafy";
  doc.querySelector("#as-c-cat").value = "clipart";
  press(w, "Create").click();
  await wait(200);
  ok("Create opens the Scrapbook's editor with its materials",
     doc.querySelector("#bd-back").textContent === "← Assets" && !!doc.querySelector(".sb-mats #sb-assets"));
  ok("  on a see-through (checked) canvas", /as-checker/.test(doc.querySelector("#bd-canvas").innerHTML));
  const before = calls.length;
  await wait(900);
  ok("  nothing is saved while it's empty", calls.length === before);
  doc.querySelector('.sb-mats [data-mat="clip:leaf"]').click();
  await wait(900);
  const made = assets.find((a) => a.name === "Leafy");
  ok("once something is on it, it saves itself into Clip art, with its design",
     made && made.cat === "clipart" && made.design && made.design.pages[0].items[0].art === "leaf");
  doc.querySelector('.sb-mats [data-mat="clip:star"]').click();
  await wait(900);
  ok("  and later changes update the same asset, not a new one",
     assets.filter((a) => a.name === "Leafy").length === 1 && calls.some((c) => c[0] === "asset_update" && c[2] === "dataUrl,design"));
  ok("  the see-through background is never in the picture",
     !/as-checker/.test(SS.BoardEditor.pageSVG(made.design, 0)));
  doc.querySelector("#bd-back").click();
  await wait(300);
  const editBtn = doc.querySelector(`[data-edit="${made.id}"]`);
  ok("one made here can be opened again (Edit)", !!editBtn);
  editBtn.click();
  await wait(200);
  ok("  and it opens as it was left", doc.querySelector("#bd-canvas").innerHTML.split('data-id="').length - 1 >= 2);
  doc.querySelector("#bd-back").click();
  await wait(300);

  doc.querySelector('[data-cat="all"]').click();
  await wait(200);
  const yes = doc.querySelector(`[data-del="a000000000001"]`);
  yes.click();
  await wait(20);
  const veilYes = doc.querySelector('#confirm-veil [data-a="yes"]');
  veilYes.click();
  await wait(200);
  ok("Delete asks, then removes it", !assets.some((a) => a.id === "a000000000001"));

  /* ---- 5. used in a scrapbook ---- */
  assets.unshift({id: "a00000000bg01", name: "Linen bg", cat: "backgrounds", w: 40, h: 20, dataUrl: PNG});
  SS.AssetStore.forget();
  scraps.Trip = {kind: "scrapbook", name: "Trip", w: 1500, h: 1500, paper: "cardstock",
                 cover: {}, pages: [{items: [{id: "x1", k: "tape", style: "dots", x: 10, y: 10, w: 200, h: 40}]}]};
  const host = doc.querySelector("#ss-main") || doc.body;
  const ed = await SS.Scrapbook._test.openBook(host, "Trip");
  await wait(250);
  const tiles = [...host.querySelectorAll("#sb-assets [data-asset]")].map((b) => b.dataset.asset);
  ok("the Scrapbook's panel lists your assets", tiles.includes(made.id) && tiles.includes("a00000000bg01"), tiles.join());
  ok("  and the built-in clip art", host.querySelectorAll('#sb-assets [data-mat^="clip:"]').length === 62);
  const sel = host.querySelector("#sb-asset-cat");
  sel.value = "backgrounds"; sel.dispatchEvent(new w.Event("change"));
  await wait(150);
  ok("its category filter shows just that category",
     [...host.querySelectorAll("#sb-assets [data-asset]")].map((b) => b.dataset.asset).join() === "a00000000bg01"
     && !host.querySelector('#sb-assets [data-mat^="clip:"]'));
  host.querySelector('#sb-assets [data-asset="a00000000bg01"]').click();
  await wait(150);
  const first = ed.items()[0];
  ok("a background fills the page and goes to the back",
     first.k === "asset" && first.fit === "cover" && first.w === 1500 && first.h === 1500 && first.src === PNG);
  const it = await SS.Scrapbook._test.placeAsset(ed, made.id, [300, 300]);
  ok("any other asset is placed as a copy of its picture", it && it.k === "asset" && it.src === PNG && it.x === 300 - it.w / 2);
  ok("  drawn with no sticker shadow", !/feDropShadow/.test(SS.ScrapArt.itemSVG(it)));
  const clip = SS.Scrapbook._test.placeMaterial(ed, "clip:heart");
  ed.sel = new Set([clip.id]);
  ed.target = "stroke";
  ed.pickColour("#2b6cb0");
  ok("clip art takes the palette's colour, whichever well is chosen", clip.fill === "#2b6cb0"
     && SS.ScrapArt.itemSVG(clip).includes('fill="#2b6cb0"'));
  const drop2 = new w.Event("drop", {bubbles: true, cancelable: true});
  drop2.dataTransfer = {getData: () => "nn-asset:" + made.id};
  drop2.clientX = 0; drop2.clientY = 0;
  const n0 = ed.items().length;
  host.querySelector("#bd-canvas").dispatchEvent(drop2);
  await wait(150);
  ok("dragging an asset onto the page places it", ed.items().length === n0 + 1 && ed.items()[n0].k === "asset");
  ed.flush();
  await wait(50);
  ok("and the scrapbook keeps it", scraps.Trip.pages[0].items.some((i) => i.k === "asset"));

  /* ---- 6. and in a board ---- */
  boards.Plan = {name: "Plan", w: 1600, h: 1000, pages: [{items: []}]};
  SS.go("boards:list");
  await wait(200);
  await SS.Boards._test.openBoard(host, "Plan");
  await wait(250);
  const bm = host.querySelector(".sb-mats");
  ok("Boards has the same panel, folded away to start with",
     !!bm && bm.classList.contains("is-collapsed") && !!host.querySelector("#sb-assets"));
  host.querySelector("#sb-mats-toggle").click();
  ok("  opening it is remembered for Boards on its own",
     JSON.parse(w.localStorage.getItem("nn:boards:panel")).collapsed === false
     && JSON.parse(w.localStorage.getItem("nn:scrapbook:panel") || "{}").collapsed !== false);

  console.log("\nAssets\n");
  out.forEach((l) => console.log(l));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log(out.join("\n")); console.error(e); process.exit(1); });
