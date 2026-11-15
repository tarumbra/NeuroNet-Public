/* ==========================================================================
   Vector -- the engine (node) and Creative -> Vector (jsdom, the real app).
   ==========================================================================
   Cam (2026-10-04): "please get started on the vector tool in Neuronet" --
   the everyday 80%, with SVG in and out so Inkscape takes the rest.
   Shape combining and SVG reading are Paper.js's (ui/vector/vendor/).
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
/* an Inkscape file: namespaces, a layer moved by a transform, style attributes */
const INKSCAPE = `<?xml version="1.0"?><svg xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg"
  width="210mm" height="297mm" viewBox="0 0 210 297"><sodipodi:namedview id="nv"/>
  <g inkscape:label="Layer 1" inkscape:groupmode="layer" id="layer1" transform="translate(10,20)">
  <rect style="fill:#ff6600;stroke:#000000;stroke-width:2" width="50" height="40" x="10" y="10"/>
  <circle style="fill:#3366ff;fill-opacity:0.5" cx="100" cy="60" r="25"/>
  <path style="fill:none;stroke:#00aa00;stroke-width:3" d="m 20,120 c 30,-40 60,40 90,0"/>
  <text style="font-size:12px;font-family:serif;fill:#222222" x="20" y="200">Hello Inkscape</text></g></svg>`;
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
    assets_list: async () => ({assets: assets.map(({dataUrl, design, ...a}) => ({...a, design: !!design, kind: design && /^(pixel|vector)$/.test(design.kind) ? design.kind : (a.kind || "")}))}),
    asset_data: async (id) => { const a = assets.find((x) => x.id === id); return a ? {id, name: a.name, w: a.w, h: a.h, dataUrl: a.dataUrl} : {error: "gone"}; },
    asset_add: async (cat, name, dataUrl, design, size, stage) => {
      calls.push(["asset_add", cat, name, stage]);
      const id = "a" + String(assets.length + 1).padStart(12, "0");
      assets.unshift({id, name, cat, w: 40, h: 20, dataUrl, design: design || null, stage: stage || "done",
                      kind: design && /^(pixel|vector)$/.test(design.kind) ? design.kind : ""});
      return {ok: true, id};
    },
    asset_update: async (id, ch) => { calls.push(["asset_update", id, Object.keys(ch).join()]); Object.assign(assets.find((x) => x.id === id), ch); return {ok: true}; },
    pixel_palettes: async () => ({palettes: JSON.parse(JSON.stringify(palettes))}),
    pixel_palettes_save: async (l) => { palettes = JSON.parse(JSON.stringify(l)); calls.push(["pixel_palettes_save", l.length]); return {ok: true}; },
    pixel_save_file: async (name, b64) => { calls.push(["pixel_save_file", name, b64]); return {ok: true, path: "/tmp/" + name}; },
    creative_save_file: async (name, b64) => { calls.push(["creative_save_file", name, b64]); return {ok: true, path: "/tmp/" + name}; },
    vector_open_svg: async () => ({name: "From Inkscape", text: INKSCAPE}),
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
  /* Vector loads Paper.js itself (a <script> it adds), which jsdom doesn't
     run; here it's loaded by hand. Paper takes jsdom for node; its node
     extras aren't wanted, hence the dummy require. */
  w.require = () => () => {};
  w.eval(fs.readFileSync(path.join(UI, w.SS.Vector.PAPER_SRC), "utf8"));
  await wait(300);
  return w;
}

const press = (w, label) => [...w.document.querySelectorAll("#modal-veil .dlg-row button")].find((b) => b.textContent === label);
const near = (a, b, e) => Math.abs(a - b) <= (e || 0.01);

(async () => {
  /* ======================= 1. the engine, on its own (node) ======================= */
  const V = require(path.join(UI, "vector", "vectorcore.js"));
  const sq = V.rect(10, 10, 100, 50, 0);
  ok("a rectangle is a closed four-node path", sq.subs[0].closed && sq.subs[0].nodes.length === 4 && V.pathD(sq) === "M10 10L110 10L110 60L10 60Z");
  const rr = V.rect(0, 0, 100, 60, 10);
  ok("rounded corners are curves (8 nodes, C segments)", rr.subs[0].nodes.length === 8 && /C/.test(V.pathD(rr)));
  const el = V.ellipse(50, 50, 40, 20);
  ok("an ellipse's bounds are exact (the curve's extremes, not its handles)", V.bounds(el).map(Math.round).join() === "10,30,80,40");
  ok("a polygon and a star have their corners", V.polygon(0, 0, 10, 6).subs[0].nodes.length === 6 && V.star(0, 0, 10, 5, 5).subs[0].nodes.length === 10);
  const t = V.clone(sq);
  V.transform(t, V.rotateAbout(90, 60, 35));
  const tb = V.bounds(t);
  ok("turning 90° about the middle swaps width and height", near(tb[2], 50) && near(tb[3], 100) && near(tb[0] + tb[2] / 2, 60));
  const sc = V.clone(sq); sc.sw = 2;
  V.transform(sc, V.scaleAbout(2, 2, 10, 10));
  ok("scaling grows the shape from the anchor, and its stroke with it", V.bounds(sc).join() === "10,10,200,100" && near(sc.sw, 4));
  const tx = V.text(10, 50, "Hi");
  V.transform(tx, V.mul(V.scaleAbout(2, 2, 0, 0), V.translate(5, 0)));
  ok("text moves and grows (size, not a squash)", near(tx.x, 25) && near(tx.size, 96));
  const sm = V.smoothPath([[0, 0], [10, 0.5], [20, 0], [30, -0.5], [40, 0], [50, 30], [60, 60]], false, 1);
  ok("a freehand line is thinned and smoothed", sm.subs[0].nodes.length < 7 && sm.subs[0].nodes.some((n) => n.smooth));
  const nd = V.node(0, 0);
  V.setSmooth(nd, true);
  V.moveHandle(nd, "out", 10, 10);
  ok("a smooth node's handles stay in line", near(nd.ix, -nd.ox * Math.hypot(nd.ix, nd.iy) / Math.hypot(nd.ox, nd.oy), 0.01) && near(Math.atan2(nd.iy, nd.ix), Math.atan2(-10, -10)));
  V.moveHandle(nd, "out", 0, 20, true);
  ok("  and Alt breaks it into a corner", nd.smooth === false && nd.ox === 0 && nd.oy === 20);
  const g = {type: "linear", angle: 90, stops: [[0, "#ff0000"], [1, "#0000ff"]]};
  const doc = V.newDoc(200, 100, "Test");
  doc.layers[0].items.push(Object.assign(V.star(50, 50, 40, 20, 5), {fill: g}), V.text(100, 60, "A & B <tag>"));
  const svg = V.docSVG(doc);
  ok("the SVG: the artboard's size, a gradient defined and used, words escaped",
     /viewBox="0 0 200 100"/.test(svg) && /<linearGradient id="[^"]+" x1="0.5" y1="0" x2="0.5" y2="1">/.test(svg) && /fill="url\(#/.test(svg)
     && svg.includes("A &amp; B &lt;tag&gt;") && !svg.includes("<tag>"));
  const three = [V.rect(0, 0, 10, 10), V.rect(30, 0, 10, 10), V.rect(100, 0, 10, 10)];
  V.distribute(three, "x");
  ok("spacing three evenly", near(V.bounds(three[1])[0], 50));
  V.align(three, "top", [0, 40, 200, 10]);
  ok("aligning tops", three.every((r) => near(V.bounds(r)[1], 40)));

  /* ======================= 2. the page, in the real app ======================= */
  const w = await boot();
  const SS = w.SS, doc2 = w.document;
  w.Image = class { set src(v) { setTimeout(() => this.onerror && this.onerror(), 0); } };
  ok("Paper.js (the curve maths) is NeuroNet's own file, with its licence, loaded when Vector opens (not with the app)",
     !!w.paper && fs.existsSync(path.join(UI, w.SS.Vector.PAPER_SRC)) && fs.existsSync(path.join(UI, "vector", "vendor", "paper-LICENSE.txt"))
     && !/paper-core/.test(fs.readFileSync(path.join(UI, "index.html"), "utf8")));
  SS.go("vector:studio");
  await wait(300);
  ok("Vector opens from Creative, with In progress and Completed works",
     /Vector/.test(doc2.querySelector(".vx-head").textContent) && SS._test.sectionOf("vector:studio") === "creative");
  doc2.querySelector("#vx-new").click();
  doc2.querySelector('#vx-n-size [data-k="512"]').click();
  press(w, "Create").click();
  await wait(100);
  const X = SS.Vector._test;
  let S = X.state();
  ok("New drawing opens the editor: tools, artboard, panels",
     S && S.doc.w === 512 && ["#vx-svg", "#vx-fill", "#vx-swatches", "#vx-x", "#vx-layers", '[data-bool="unite"]'].every((s) => doc2.querySelector(s)));
  ok("  with Illustrator's tools", ["select", "direct", "pen", "pencil", "line", "rect", "ellipse", "polygon", "star", "text", "picker", "hand"]
     .every((k) => doc2.querySelector(`[data-tool="${k}"]`)));
  const items = () => S.doc.layers[S.doc.layers.length - 1].items;
  X.setTool("rect");
  X.down([100, 100], {}); X.drag([200, 150], {}); X.release([200, 150], {});
  const r1 = items()[0];
  ok("the rectangle tool draws what's dragged, then goes back to Select",
     r1 && V.bounds(r1).map(Math.round).join() === "100,100,100,50" && S.tool === "select" && S.sel.has(r1.id));
  X.setTool("ellipse");
  X.down([300, 300], {}); X.drag([340, 320], {shift: true, alt: true}); X.release([340, 320], {});
  const e1 = items()[1];
  ok("Shift makes it a circle, Alt draws it from the centre", V.bounds(e1).map(Math.round).join() === "260,260,80,80");
  X.setTool("star");
  X.down([50, 400], {}); X.release([50, 400], {});
  ok("a click with a shape tool makes one at a handy size", V.bounds(items()[2])[2] > 40);

  /* selecting, moving, sizing, turning with the real handles */
  X.setTool("select");
  const g1 = doc2.querySelector(`#vx-svg [data-id="${r1.id}"] path`);
  X.down([150, 125], {target: g1}); X.drag([170, 145], {}); X.release([170, 145], {});
  ok("clicking a shape chooses it; dragging moves it", S.sel.size === 1 && V.bounds(r1).map(Math.round).join() === "120,120,100,50");
  X.undo();
  ok("Undo puts it back", V.bounds(items()[0]).map(Math.round).join() === "100,100,100,50");
  S.sel = new Set([items()[0].id]); X.setTool("select");
  const se = doc2.querySelector('#vx-svg [data-h="se"]');
  X.down([200, 150], {target: se}); X.drag([300, 250], {shift: false}); X.release([300, 250], {});
  ok("the corner handle sizes it from the opposite corner", V.bounds(items()[0]).map(Math.round).join() === "100,100,200,150");
  const rot = doc2.querySelector('#vx-svg [data-h="rot"]');
  ok("and there's a turning handle", !!rot);
  X.rotateSelection(90);
  const rb = V.bounds(items()[0]);
  ok("Turn 90° turns it about its middle", near(rb[2], 150, 0.5) && near(rb[3], 200, 0.5));
  X.undo();
  X.down([5, 5], {target: doc2.querySelector("#vx-svg .vx-board")}); X.drag([400, 400], {}); X.release([400, 400], {});
  ok("dragging over empty space chooses everything it touches", S.sel.size === 3);

  /* fill, stroke, gradient, align, order, group */
  X.setPaint("fill", "#e0789e");
  ok("a fill colour goes onto everything chosen", items().every((i) => i.fill === "#e0789e"));
  X.setPaint("fill", {type: "radial", stops: [[0, "#ffffff"], [1, "#e0789e"]]});
  ok("  or a gradient", items().every((i) => i.fill.type === "radial") && /radialGradient/.test(X.svgText()));
  X.setProp("sw", 6);
  X.setProp("dash", [8, 6]);
  ok("stroke width and dashes", items().every((i) => i.sw === 6 && i.dash.join() === "8,6") && /stroke-dasharray="8 6"/.test(X.svgText()));
  X.alignSelection("left");
  ok("Align left lines them up", items().every((i) => near(V.bounds(i)[0], V.bounds(items()[0])[0], 0.5)));
  const grp = X.group();
  ok("Group makes one of them (Ctrl+G)", items().length === 1 && grp.t === "group" && grp.items.length === 3);
  X.ungroup();
  ok("  and Ungroup gives them back", items().length === 3 && S.sel.size === 3);
  S.sel = new Set([items()[0].id]);
  X.order("front");
  ok("Bring to front", items()[2].id === r1.id);

  /* combining shapes (Paper.js) */
  S.doc.layers[0].items = [];
  const A = V.rect(0, 0, 100, 100), B = V.ellipse(100, 100, 50, 50);
  items().push(A, B);
  S.sel = new Set([A.id, B.id]);
  const u = X.combine("unite");
  ok("Union makes one shape of two", items().length === 1 && u.t === "path" && near(V.bounds(u)[2], 150, 0.5));
  X.undo();
  S.sel = new Set(items().map((i) => i.id));
  const s = X.combine("subtract");
  ok("Subtract cuts the front one out of the back one", items().length === 1 && near(V.bounds(s)[2], 100, 0.5) && s.subs[0].nodes.length >= 5);
  X.undo();
  S.sel = new Set(items().map((i) => i.id));
  const x = X.combine("exclude");
  ok("Exclude keeps everything but the overlap (a shape with a hole: two parts)", x.subs.length >= 2);
  X.undo();
  S.sel = new Set(items().map((i) => i.id));
  const n = X.combine("intersect");
  ok("Intersect keeps only the overlap", near(V.bounds(n)[0], 50, 0.5) && near(V.bounds(n)[2], 50, 0.5));
  ok("  and the result keeps the back shape's colours", n.fill === A.fill);

  /* nodes: direct select, the pen, add-node */
  X.setTool("direct");
  S.sel = new Set([n.id]);
  X.setTool("direct");
  S.sel = new Set([n.id]);
  const before = V.pathD(n);
  const dn = doc2.querySelector("#vx-svg [data-node]");
  ok("Direct select shows a shape's nodes", !!dn);
  const [nx, ny] = [n.subs[0].nodes[0].x, n.subs[0].nodes[0].y];
  X.down([nx, ny], {target: dn}); X.drag([nx + 20, ny + 20], {}); X.release([nx + 20, ny + 20], {});
  ok("dragging a node reshapes the path", V.pathD(n) !== before && near(n.subs[0].nodes[0].x, nx + 20));
  const count = n.subs[0].nodes.length;
  X.addNodeAt(n, [75, 50]);
  ok("double-clicking the line adds a node there", n.subs[0].nodes.length === count + 1);
  X.setTool("pen");
  X.down([10, 300], {}); X.release([10, 300], {});
  X.down([110, 300], {}); X.drag([140, 260], {}); X.release([140, 260], {});
  X.down([60, 380], {}); X.release([60, 380], {});
  X.down([10.5, 300.5], {}); X.release([10.5, 300.5], {});
  const pen = items()[items().length - 1];
  ok("the pen: clicks make corners, a drag makes a curve, clicking the start closes it",
     pen.subs[0].closed && pen.subs[0].nodes.length === 3 && pen.subs[0].nodes[1].smooth && /C/.test(V.pathD(pen)));

  /* words */
  X.setTool("text");
  X.down([50, 450], {});
  await wait(20);
  doc2.querySelector("#vx-t-words").value = "Field Notes";
  doc2.querySelector("#vx-t-font").value = "serif";
  press(w, "Add").click();
  await wait(50);
  const words = items()[items().length - 1];
  ok("the text tool adds words, in the font chosen", words.t === "text" && words.text === "Field Notes" && words.font === "serif" && /Field Notes/.test(X.svgText()));

  /* clip art and Inkscape files come in as real shapes */
  const placed = X.placeClip("leaf");
  ok("placing clip art brings it in as editable shapes", placed.length >= 1 && placed.every((i) => i.t === "path"));
  const got = X.importSVG(INKSCAPE);
  const [rc, ci, cu, tx2] = got.items;
  ok("an Inkscape SVG: its layer's transform is baked in, rectangles and circles become paths",
     got.w === 210 && rc.t === "path" && V.bounds(rc).map(Math.round).join() === "20,30,50,40" && V.bounds(ci).map(Math.round).join() === "85,55,50,50");
  ok("  with their colours, see-through and strokes", rc.fill === "#ff6600" && rc.stroke === "#000000" && near(rc.sw, 2) && near(ci.opacity, 0.5)
     && cu.fill === null && cu.stroke === "#00aa00");
  ok("  and its words stay words", tx2.t === "text" && tx2.text === "Hello Inkscape" && near(tx2.x, 30) && near(tx2.y, 220));

  /* saving and exporting */
  X.saveDialog();
  await wait(20);
  doc2.querySelector("#vx-s-name").value = "Notebook badge";
  press(w, "Save").click();
  await wait(150);
  const saved = assets.find((a) => a.name === "Notebook badge");
  ok("Save puts it into Assets (Clip art, In progress) as an SVG picture, the drawing kept",
     saved && saved.cat === "clipart" && saved.stage === "wip" && /^data:image\/svg\+xml;base64,/.test(saved.dataUrl) && saved.design.kind === "vector");
  ok("  and that SVG is the drawing itself", /Field Notes/.test(Buffer.from(saved.dataUrl.split(",")[1], "base64").toString()));
  X.setTool("rect"); X.down([0, 0], {}); X.drag([20, 20], {}); X.release([20, 20], {});
  await wait(1700);
  ok("once saved, changes save themselves", calls.some((c) => c[0] === "asset_update" && c[1] === saved.id));
  await X.exportAs("svg");
  const ex = calls.filter((c) => c[0] === "creative_save_file").pop();
  const exText = Buffer.from(ex[2], "base64").toString();
  ok("Export SVG writes a real SVG file (for Inkscape)", ex[1] === "Notebook badge.svg" && /^<\?xml/.test(exText) && /<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(exText));
  ok("  without the editor's handles, checkerboard or ids", !/data-id|vx-check|data-h=/.test(exText));

  /* Assets: Edit opens it in Vector */
  await X.home(doc2.querySelector("#ss-main"));
  ok("back home, the drawing is under In progress", !!doc2.querySelector(`[data-open="${saved.id}"]`));
  SS.go("assets:library");
  await wait(250);
  doc2.querySelector('[data-cat="wip"]').click();
  await wait(150);
  doc2.querySelector(`[data-edit="${saved.id}"]`).click();
  await wait(400);
  S = X.state();
  ok("Edit in Assets opens the drawing in Vector, as it was", S && S.asset && S.asset.id === saved.id && S.doc.layers[0].items.some((i) => i.t === "text"));

  console.log("\nVector\n");
  out.forEach((l) => console.log(l));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log(out.join("\n")); console.error(e); process.exit(1); });
