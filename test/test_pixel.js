/* ==========================================================================
   Pixel art -- the engine (node) and Creative -> Pixel art (jsdom, the real
   app), with Assets' In progress / Completed works and Game assets.
   ==========================================================================
   Cam (2026-10-04): "Create a pixel art creator in the creative section as
   well where i can make game assests think asesprite style with the side
   bars, layering, animation, colour palettes (default and ability to create
   or import palettes. Also the ability to export to asesprite or png. I can
   choose to save them as in progress or completed works. Please provide
   starting pet templates i can build off as well" -- and "add all game
   assets into assests sub section ... a folder for in progress".
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
let palettes = [];
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
    assets_list: async () => ({assets: assets.map(({dataUrl, design, ...a}) => ({...a, design: !!design, kind: design && design.kind === "pixel" ? "pixel" : (a.kind || "")}))}),
    asset_data: async (id) => { const a = assets.find((x) => x.id === id); return a ? {id, name: a.name, w: a.w, h: a.h, dataUrl: a.dataUrl} : {error: "gone"}; },
    asset_add: async (cat, name, dataUrl, design, size, stage) => {
      calls.push(["asset_add", cat, name, stage]);
      const id = "a" + String(assets.length + 1).padStart(12, "0");
      assets.unshift({id, name, cat, w: 40, h: 20, dataUrl, design: design || null, stage: stage || "done",
                      kind: design && design.kind === "pixel" ? "pixel" : ""});
      return {ok: true, id};
    },
    asset_update: async (id, ch) => { calls.push(["asset_update", id, Object.keys(ch).join()]); Object.assign(assets.find((x) => x.id === id), ch); return {ok: true}; },
    pixel_palettes: async () => ({palettes: JSON.parse(JSON.stringify(palettes))}),
    pixel_palettes_save: async (l) => { palettes = JSON.parse(JSON.stringify(l)); calls.push(["pixel_palettes_save", l.length]); return {ok: true}; },
    pixel_save_file: async (name, b64) => { calls.push(["pixel_save_file", name, b64]); return {ok: true, path: "/tmp/" + name}; },
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
const zlib = require("zlib");

/** A PNG's pixels, read back with node's own zlib (not our writer). */
function readPng(bytes) {
  const b = Buffer.from(bytes);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let o = 8, w = 0, h = 0; const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString("ascii", o + 4, o + 8), data = b.subarray(o + 8, o + 8 + len);
    const crc = b.readUInt32BE(o + 8 + len);
    if (crc !== require("zlib").crc32(b.subarray(o + 4, o + 8 + len))) throw new Error("bad crc in " + type);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    if (type === "IDAT") idat.push(data);
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) raw.copy(px, y * w * 4, y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1));
  return {w, h, px};
}

(async () => {
  /* ======================= 1. the engine, on its own (node) ======================= */
  const P = require(path.join(UI, "pixel", "pixelcore.js"));
  const vm = require("vm");
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(UI, "pet", "petart.js"), "utf8") + "\n;this.PetArt = PetArt;", ctx);
  vm.runInContext(fs.readFileSync(path.join(UI, "pet", "petcore.js"), "utf8") + "\n;this.PetCore = PetCore;", ctx);
  const PetArt = ctx.PetArt, PetCore = ctx.PetCore;
  const RED = [255, 0, 0, 255], CLEAR = [0, 0, 0, 0];
  const px = (img, w, x, y) => P.get(img, w, x, y).join();

  let img = P.blank(8, 8);
  P.line(img, 8, 8, 0, 0, 7, 7, RED, 1);
  ok("a line hits every pixel from end to end", [0, 3, 7].every((i) => px(img, 8, i, i) === RED.join()) && px(img, 8, 1, 0) === "0,0,0,0");
  img = P.blank(8, 8);
  P.rect(img, 8, 8, 1, 1, 6, 6, RED, false, 1);
  ok("a rectangle is its outline", px(img, 8, 1, 1) === RED.join() && px(img, 8, 3, 3) === "0,0,0,0");
  ok("and the bucket fills inside it, only inside", P.fill(img, 8, 8, 3, 3, [0, 0, 255, 255]) === 16 && px(img, 8, 0, 0) === "0,0,0,0");
  img = P.blank(9, 9);
  P.ellipse(img, 9, 9, 0, 0, 8, 8, RED, true, 1);
  ok("a filled ellipse is round (centre in, corners out)", px(img, 9, 4, 4) === RED.join() && px(img, 9, 0, 0) === "0,0,0,0");
  img = P.blank(8, 4);
  P.dab(img, 8, 4, 1, 1, RED, 1, true);
  ok("mirror draws the other half too", px(img, 8, 1, 1) === RED.join() && px(img, 8, 6, 1) === RED.join());
  P.dab(img, 8, 4, 4, 2, RED, 3, false);
  ok("a 3-pixel brush is 3 × 3", px(img, 8, 3, 1) === RED.join() && px(img, 8, 5, 3) === RED.join());
  ok("move shifts what's drawn", px(P.shift(img, 8, 4, 1, 0), 8, 2, 1) === RED.join());

  const p = P.newProject(4, 4, "Test");
  const L0 = p.layers[0];
  P.set(P.cel(p, L0.id, 0), 4, 4, 0, 0, RED);
  const L1 = P.addLayer(p);
  P.set(P.cel(p, L1.id, 0), 4, 4, 0, 0, [0, 0, 255, 128]);
  const comp = P.composite(p, 0);
  ok("layers stack: a half-see-through blue over red mixes", comp[0] > 100 && comp[2] > 100 && comp[3] === 255, [...comp.slice(0, 4)].join());
  L1.visible = false;
  ok("a hidden layer isn't drawn", P.composite(p, 0)[2] === 0);
  L1.visible = true;
  ok("merge down puts it onto the one below", P.mergeDown(p, 1) && p.layers.length === 1 && P.cel(p, L0.id, 0)[2] > 100);
  const f1 = P.addFrame(p, 1, 0);
  ok("a duplicated frame is a copy, not the same picture",
     f1 === 1 && px(P.cel(p, L0.id, 1), 4, 0, 0) === px(P.cel(p, L0.id, 0), 4, 0, 0) && P.cel(p, L0.id, 1) !== P.cel(p, L0.id, 0));
  P.addFrame(p);
  ok("moving a frame takes its pictures with it", P.moveFrame(p, 2, -2) === 0 && P.isEmpty(p.cels[L0.id][0]));
  ok("a sprite keeps at least one layer and one frame", !P.removeLayer(p, 0) && P.removeFrame(p, 0) && p.frames.length === 2);
  P.resize(p, 8, 6, 2, 1);
  ok("resizing keeps the picture, moved by the offset", p.w === 8 && px(P.cel(p, L0.id, 0), 8, 2, 1) !== "0,0,0,0");
  const back = P.deserialise(JSON.parse(JSON.stringify(P.serialise(p))));
  ok("a project saves to JSON and comes back exactly",
     back.w === 8 && back.frames.length === 2 && px(back.cels[L0.id][0], 8, 2, 1) === px(p.cels[L0.id][0], 8, 2, 1));

  const pr = readPng(P.png(P.composite(p, 0), 8, 6));
  ok("PNG: a real PNG (node's zlib reads it, CRCs right) with the same pixels",
     pr.w === 8 && pr.h === 6 && pr.px.equals(Buffer.from(P.composite(p, 0))));
  const big = readPng(P.png(P.scaleUp(P.composite(p, 0), 8, 6, 4), 32, 24));
  ok("  and scaled up × 4, each pixel a 4 × 4 block", big.w === 32 && big.px.readUInt32BE((4 * 32 + 8) * 4) === Buffer.from(P.composite(p, 0)).readUInt32BE((1 * 8 + 2) * 4));
  const sheet = P.spriteSheet(p);
  ok("a sprite sheet puts the frames side by side", sheet.w === 16 && sheet.h === 6);

  const ase = Buffer.from(P.aseprite(p));
  ok(".aseprite: the header says what it is", ase.readUInt32LE(0) === ase.length && ase.readUInt16LE(4) === 0xA5E0
     && ase.readUInt16LE(6) === 2 && ase.readUInt16LE(8) === 8 && ase.readUInt16LE(10) === 6 && ase.readUInt16LE(12) === 32);
  let AsepriteParser = null;
  try { AsepriteParser = require("ase-parser"); } catch (e) { /* optional */ }
  if (AsepriteParser) {
    const a = new AsepriteParser(ase, "t.aseprite"); a.parse();
    ok("  and an independent reader (ase-parser) reads its layers, frames and pixels",
       a.layers.length === 1 && a.numFrames === 2 && a.frames[1].cels.length === 1
       && a.frames[1].cels[0].rawCelData.length === a.frames[1].cels[0].w * a.frames[1].cels[0].h * 4);
  } else {
    let o = 128, frames = 0;
    while (o < ase.length) { const n = ase.readUInt32LE(o); if (ase.readUInt16LE(o + 4) !== 0xF1FA) break; o += n; frames++; }
    ok("  and its frames run exactly to the end of the file", o === ase.length && frames === 2);
  }

  const g = P.parsePalette("GIMP Palette\nName: Swamp\nColumns: 4\n#\n 26  43  60\tdark\n170 187 204\tlight\n", "x");
  ok("palettes: GIMP .gpl", g.name === "Swamp" && g.colours.join() === "#1a2b3c,#aabbcc");
  ok("  Lospec .hex", P.parsePalette("ff0044\n#68386c\n", "lospec").colours.join() === "#ff0044,#68386c");
  ok("  JASC .pal", P.parsePalette("JASC-PAL\r\n0100\r\n2\r\n255 0 0\r\n0 0 0\r\n").colours.join() === "#ff0000,#000000");
  ok("  Paint.NET .txt (AARRGGBB, ; comments)", P.parsePalette(";paint.net\nFF00FF00\nFF0000FF\n").colours.join() === "#00ff00,#0000ff");
  ok("  and back out as a .gpl", /^GIMP Palette\nName: Swamp/.test(P.gpl(g)) && P.parsePalette(P.gpl(g)).colours.join() === g.colours.join());
  ok("built-in palettes: PICO-8, DawnBringer 16, Sweetie 16, Endesga 32, Game Boy, Greys",
     P.PALETTES.map((x) => x.name + ":" + x.colours.length).join() === "PICO-8:16,DawnBringer 16:16,Sweetie 16:16,Endesga 32:32,Game Boy:4,Greys:9");

  const T = P.templates(PetArt, PetCore);
  ok("templates: every NeuroPets sprite -- pets, creatures, eggs, you, items",
     ["Pets", "Creatures", "Eggs", "People", "Items"].every((grp) => T.some((t) => t.group === grp)) && T.length > 300, String(T.length));
  ok("  named as NeuroPets names them", T.some((t) => t.name === "Copper fragment") && T.some((t) => t.name === "Ginger cat"));
  const cat = P.fromTemplate(PetArt, T.find((t) => t.id === "pet:cat/ginger"), {scale: 2, size: 48});
  ok("a pet template: a four-frame idle on Colour, Outline and Face layers",
     cat.frames.length === 4 && cat.layers.map((l) => l.name).join() === "Colour,Outline,Face" && cat.w === 48 && cat.palette.name === "NeuroPets");
  ok("  each layer only its part (no outline pixels on Colour)",
     !P.isEmpty(cat.cels[cat.layers[1].id][0]) && (() => {
       const c = cat.cels[cat.layers[0].id][0], o = cat.cels[cat.layers[1].id][0];
       for (let i = 3; i < c.length; i += 4) if (c[i] && o[i]) return false;
       return true; })());
  ok("  and the blink frame differs from the open one",
     !Buffer.from(P.composite(cat, 0)).equals(Buffer.from(P.composite(cat, 1))));

  /* ======================= 2. the page, in the real app ======================= */
  const w = await boot();
  const SS = w.SS, doc = w.document;
  w.Image = class { set src(v) { setTimeout(() => this.onerror && this.onerror(), 0); } };
  SS.go("pixel:studio");
  await wait(300);
  ok("Pixel art opens from Creative, with In progress and Completed works",
     /Pixel art/.test(doc.querySelector(".px-head").textContent) && /In progress/.test(doc.querySelector("#ss-main").textContent)
     && SS._test.sectionOf("pixel:studio") === "creative");
  doc.querySelector("#px-new").click();
  doc.querySelector('#px-n-size [data-n="16"]').click();
  press(w, "Create").click();
  await wait(100);
  const X = SS.Pixel._test;
  let S = X.state();
  ok("New sprite opens the editor: tools, canvas, preview, palette, timeline",
     S && S.p.w === 16 && ["#px-canvas", "#px-preview", "#px-swatches", "#px-cels", '[data-tool="bucket"]'].every((s) => doc.querySelector(s)));
  ok("  every tool Cam would know from Aseprite", ["pencil", "eraser", "bucket", "line", "rect", "ellipse", "picker", "move"]
     .every((k) => doc.querySelector(`[data-tool="${k}"]`)));
  S.fg = [10, 20, 30, 255];
  X.stroke([2, 2]); X.strokeMove([5, 2]); X.strokeEnd();
  const lid = () => S.p.layers[S.layer].id;
  ok("the pencil draws in the chosen colour", px(S.p.cels[lid()][0], 16, 4, 2) === "10,20,30,255");
  X.undo();
  ok("Ctrl+Z / Undo takes it back", px(S.p.cels[lid()][0], 16, 4, 2) === "0,0,0,0");
  X.redo();
  ok("  and Redo brings it back", px(S.p.cels[lid()][0], 16, 4, 2) === "10,20,30,255");
  doc.querySelector('[data-tool="picker"]').click();
  S.fg = [1, 1, 1, 255];
  X.stroke([4, 2]);
  ok("the eyedropper takes the colour under it", S.fg.join() === "10,20,30,255");
  w.dispatchEvent(new w.KeyboardEvent("keydown", {key: "g", bubbles: true}));
  ok("the tools have Aseprite's letters (G bucket)", S.tool === "bucket");
  X.stroke([10, 10]);
  ok("the bucket fills the empty area", px(S.p.cels[lid()][0], 16, 15, 15) === "10,20,30,255");
  doc.querySelector("#px-l-add").click();
  ok("+ layer adds one above, and the timeline shows it", S.p.layers.length === 2 && doc.querySelectorAll("#px-cels tr").length === 3);
  doc.querySelector("#px-f-dup").click();
  ok("Copy frame duplicates the frame (a column in the timeline)",
     S.p.frames.length === 2 && S.frame === 1 && doc.querySelectorAll("#px-cels .px-fh").length === 2);
  doc.querySelector("#px-onion").click();
  ok("onion skin and mirror switch on", S.onion === true && (doc.querySelector("#px-mirror").click(), S.mirror === true));

  /* palettes */
  ok("the palettes: NeuroPets first, then the classics", [...doc.querySelectorAll("#px-pal option")].map((o) => o.value).slice(0, 3).join() === "NeuroPets,PICO-8,DawnBringer 16");
  X.choosePalette("PICO-8");
  await X.paletteAdd();
  ok("adding a colour to a built-in palette makes it yours (“My PICO-8”) and keeps it",
     palettes.some((x) => x.name === "My PICO-8" && x.colours.includes("#0a141e")) && S.p.palette.name === "My PICO-8");
  await X.addImported(P.parsePalette("ff0044\n68386c\n", "lospec-two"));
  ok("an imported palette becomes one of yours, and is chosen", S.p.palette.name === "lospec-two" && palettes.length === 2);

  /* saving: in progress, then it saves itself */
  X.saveDialog();
  await wait(20);
  doc.querySelector("#px-s-name").value = "Slime";
  press(w, "Save").click();
  await wait(150);
  const saved = assets.find((a) => a.name === "Slime");
  ok("Save puts it into Assets → Game assets, In progress, as pixel art",
     saved && saved.cat === "game" && saved.stage === "wip" && saved.design.kind === "pixel" && saved.design.frames.length === 2);
  ok("  its picture is frame 1, enlarged to stay crisp (16 px × 16 = 256 px)", readPng(Buffer.from(saved.dataUrl.split(",")[1], "base64")).w === 256);
  S.fg = [200, 0, 0, 255];
  doc.querySelector('[data-tool="pencil"]').click();
  X.stroke([0, 0]); X.strokeEnd();
  await wait(1500);
  ok("once saved, changes save themselves", calls.some((c) => c[0] === "asset_update" && c[1] === saved.id && /design/.test(c[2])));

  /* exporting */
  X.exportDialog();
  await wait(20);
  press(w, "Export…").click();
  await wait(80);
  const ex = calls.filter((c) => c[0] === "pixel_save_file").pop();
  ok("Export: .aseprite by default, named after the sprite", ex && ex[1] === "Slime.aseprite"
     && Buffer.from(ex[2], "base64").readUInt16LE(4) === 0xA5E0);
  await X.exportAs("sheet", 2);
  const sh = calls.filter((c) => c[0] === "pixel_save_file").pop();
  const shp = readPng(Buffer.from(sh[2], "base64"));
  ok("  or a PNG sprite sheet, × 2", sh[1] === "Slime-sheet.png" && shp.w === 64 && shp.h === 32);
  await X.exportAs("png", 1);
  ok("  or this frame as a PNG", calls.filter((c) => c[0] === "pixel_save_file").pop()[1] === "Slime.png");

  /* templates */
  await X.leave();
  await wait(300);
  ok("back on the home page, the sprite is under In progress", !!doc.querySelector(`[data-open="${saved.id}"]`));
  X.templateDialog(doc.querySelector("#ss-main"));
  await wait(50);
  ok("the template picker shows NeuroPets' pets first", doc.querySelectorAll("#px-t-grid [data-t]").length >= 10
     && /cat/i.test(doc.querySelector("#px-t-grid").textContent));
  doc.querySelector('#px-t-grid [data-t="pet:bunny/pink"]').click();
  doc.querySelector("#px-t-scale").value = "2";
  press(w, "Use this template").click();
  await wait(100);
  S = X.state();
  ok("a pet template opens ready to build on: 32 × 32, three layers, four frames",
     S.p.w === 32 && S.p.layers.length === 3 && S.p.frames.length === 4 && /bunny/i.test(S.p.name));

  /* Assets: the folders, game art, and opening a sprite */
  await X.home(doc.querySelector("#ss-main"));
  SS.go("assets:library");
  await wait(250);
  doc.querySelector('[data-cat="wip"]').click();
  await wait(150);
  ok("Assets has an In progress folder, and the sprite is in it (not yet in its category)",
     !!doc.querySelector(`.as-tile[data-id="${saved.id}"]`) && /In progress/.test(doc.querySelector(`.as-tile[data-id="${saved.id}"]`).textContent));
  doc.querySelector('[data-cat="game"]').click();
  await wait(200);
  ok("Game assets shows every NeuroPets sprite, built in", doc.querySelectorAll(".as-tile.is-builtin [data-template]").length > 300);
  doc.querySelector('[data-cat="wip"]').click();
  await wait(150);
  doc.querySelector(`[data-finish="${saved.id}"]`).click();
  await wait(200);
  ok("“Completed” moves it to Completed works", assets.find((a) => a.id === saved.id).stage === "done"
     && !doc.querySelector(`.as-tile[data-id="${saved.id}"]`));
  doc.querySelector('[data-cat="game"]').click();
  await wait(200);
  ok("  where it shows in its category", !!doc.querySelector(`.as-tile[data-id="${saved.id}"]`));
  doc.querySelector(`[data-edit="${saved.id}"]`).click();
  await wait(400);
  S = X.state();
  ok("Edit on a sprite opens it in Pixel art, as it was saved", S && S.asset && S.asset.id === saved.id && S.p.frames.length === 2
     && S.p.layers.length === 2);
  await X.home(doc.querySelector("#ss-main"));
  SS.go("assets:library");
  await wait(300);
  doc.querySelector('[data-cat="game"]').click();
  await wait(300);
  const fox = doc.querySelector('.as-tile.is-builtin [data-template="creature:fox"]');
  fox.click();
  await wait(400);
  S = X.state();
  ok("“Open in Pixel art” on a game asset starts a sprite from it", S && /fox/i.test(S.p.name) && S.p.w === 16);

  console.log("\nPixel art\n");
  out.forEach((l) => console.log(l));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log(out.join("\n")); console.error(e); process.exit(1); });
