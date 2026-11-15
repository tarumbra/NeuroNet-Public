/* ==========================================================================
   Paper creator -- the page, in the real app (jsdom). Paper and Covers.
   ==========================================================================
   Cam (2026-10-03): "please create me a paper creator. This is a simple tool
   which will print my selected paper at my selected size. Also it will have
   a cover creator. Borrowing the tools from scrapbook i can create a cover in
   my selected size A5 - A4 or custom size (i create pocket notebooks)."
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
const covers = {};
const printed = [];
let designs = [];

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
    scrapbook_stickers: async () => ({stickers: []}),
    assets_list: async () => ({assets: []}),
    paper_designs: async () => ({designs}),
    paper_designs_save: async (d) => { designs = JSON.parse(JSON.stringify(d)); return {ok: true}; },
    covers_list: async () => Object.entries(covers).map(([id, b]) => ({id, name: b.name, spec: b.spec, w: b.w, h: b.h, pages: b.pages.length, updated: "2026-10-03"})),
    covers_read: async (id) => (covers[id] ? {book: JSON.parse(JSON.stringify(covers[id]))} : {error: "gone"}),
    covers_write: async (id, b) => { covers[id] = JSON.parse(JSON.stringify(b)); return {ok: true}; },
    covers_delete: async (id) => { delete covers[id]; return {ok: true}; },
    open_print_document: async (html, kind) => { printed.push({html, kind}); return {ok: true}; },
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
const attr = (svg, name) => (svg.match(new RegExp(`<svg[^>]*\\s${name}="([^"]+)"`)) || [])[1];
const count = (s, re) => (s.match(re) || []).length;

(async () => {
  const w = await boot();
  const SS = w.SS, P = SS.Paper._test;
  const doc = w.document;

  /* ---- 1. the paper itself, in millimetres ---- */
  const lined = P.paperSVG({...P.defaultDesign(), kind: "lined", size: "a5", spacing: 7, margin: 8});
  ok("an A5 page is exactly 148 × 210 mm", attr(lined, "width") === "148mm" && attr(lined, "height") === "210mm"
     && attr(lined, "viewBox") === "0 0 148 210");
  const rules = count(lined, /M8 [\d.]+H140/g);
  ok("lined: a rule every 7 mm between the margins (27 on A5)", rules === 27, String(rules));
  ok("landscape swaps the sides",
     attr(P.paperSVG({...P.defaultDesign(), size: "a4", landscape: true}), "width") === "297mm");
  ok("a custom size is the size typed",
     attr(P.paperSVG({...P.defaultDesign(), size: "custom", w: 90, h: 150}), "height") === "150mm");
  const grid = P.paperSVG({...P.defaultDesign(), kind: "grid", size: "a5", spacing: 5, margin: 8, major: 5});
  ok("grid: whole squares, with every fifth line bold", count(grid, /<path/g) === 2 && grid.includes('stroke-width="0.5"'));
  const dot = P.paperSVG({...P.defaultDesign(), kind: "dot", size: "a6", spacing: 5, margin: 5});
  const dots = count(dot, /h0/g);
  ok("dot grid: one dot per crossing (19 × 27 whole squares inside A6's 5 mm margins = 20 × 28 dots), all one path",
     dots === 20 * 28 && count(dot, /<path/g) === 1, String(dots));
  ok("isometric, Cornell, music and blank all draw",
     ["isometric", "cornell", "music", "blank"].every((k) => P.paperSVG({...P.defaultDesign(), kind: k}).startsWith("<svg")));
  const music = P.paperSVG({...P.defaultDesign(), kind: "music", size: "a4", spacing: 2, margin: 10});
  ok("music: staves of five lines", count(music, /H200/g) % 5 === 0 && count(music, /H200/g) >= 50, String(count(music, /H200/g)));

  /* ---- 2. on sheets: as many as fit, with cut marks ---- */
  const L1 = P.layout(105, 148, "a4");
  ok("A6 pages on A4: four to a sheet, edge to edge", L1.cols * L1.rows === 4 && L1.x0 === 0, JSON.stringify(L1));
  const L3 = P.layout(148, 210, "a4");
  ok("A5 pages on A4: two to a landscape sheet", L3.cols * L3.rows === 2 && L3.sw === 297, JSON.stringify(L3));
  ok("  with dashed cut lines between them, as there's no room for marks",
     /stroke-dasharray="2 2"/.test(P.cutMarks(L3, 148, 210)));
  const L2 = P.layout(89, 140, "a4");
  ok("pocket pages on A4: four to a sheet, centred", L2.cols * L2.rows === 4 && Math.abs(L2.x0 * 2 + L2.cols * 89 - L2.sw) < 0.01);
  ok("a page bigger than the sheet doesn't fit (null)", P.layout(297, 420, "a4") === null);
  /* Cam: "have ability to print it landscape as well" */
  const Lp = P.layout(89, 140, "a4", "portrait"), Ll = P.layout(89, 140, "a4", "landscape");
  ok("the sheet can be made portrait (pocket pages: 2 × 2)", Lp.sw === 210 && Lp.cols * Lp.rows === 4, JSON.stringify(Lp));
  ok("or landscape (pocket pages: 3 across)", Ll.sw === 297 && Ll.sh === 210 && Ll.cols === 3 && Ll.rows === 1, JSON.stringify(Ll));
  ok("A5 portrait on a portrait A4 doesn't fit two, so landscape is the best fit",
     P.layout(148, 210, "a4", "auto").sw === 297 && P.layout(148, 210, "a4", "portrait").cols * P.layout(148, 210, "a4", "portrait").rows === 1);
  const Lf = P.layout(304.8, 304.8, "a4", "landscape", true);
  ok("shrink to fit: a 12 × 12 in page on a landscape A4, one to a sheet, never enlarged",
     Lf.sw === 297 && Lf.k < 0.66 && Lf.k > 0.64 && P.layout(100, 100, "a4", "auto", true).k === 1, JSON.stringify(Lf));
  const prl = P.printHTML({pages: [dot, dot], pw: 304.8, ph: 304.8, sheet: "a4", orient: "landscape", fit: true, title: "Big"});
  ok("  and the print view's sheet is landscape A4", prl.html.includes("@page { size: 297mm 210mm") && prl.landscape && /shrunk to 65%/.test(prl.html));
  ok("on its own size it is its own sheet", P.layout(148, 210, "own").own === true);
  const pr = P.printHTML({pages: Array(10).fill(dot), pw: 105, ph: 148, sheet: "a4", marks: true, title: "Dots"});
  ok("10 A6 pages print on 3 A4 sheets, the sheet size set for the printer",
     pr.sheets === 3 && pr.html.includes("@page { size: 210mm 297mm") && count(pr.html, /class="sheet"/g) === 3);
  ok("  with the cuts marked", pr.html.includes('stroke-dasharray="2 2"'));
  const pr2 = P.printHTML({pages: [dot], pw: 89, ph: 140, sheet: "a4", marks: true, title: "Pocket"});
  ok("pocket pages leave room round the edge for real cut marks", pr2.html.includes('stroke-width="0.15"'));
  ok("  and the page tells you to print at actual size", /Actual size/.test(pr.html));
  ok("the cut marks run out from every column and row edge (3 + 3 lines, both ends)",
     count(P.cutMarks({x0: 10, y0: 10, cols: 2, rows: 2}, 50, 50), /M/g) === 12);

  /* ---- 3. the page ---- */
  SS.go("paper:make");
  await wait(250);
  const head = doc.querySelector(".pc-head");
  ok("Paper creator opens from the Vault's menu, on Paper", !!head && head.textContent.includes("Paper creator")
     && doc.querySelector("#pc-kind") && doc.querySelector("#pc-pv svg"));
  ok("every paper the reference pictures show is offered (lined, grid, dot)",
     ["lined", "grid", "dot"].every((k) => doc.querySelector(`#pc-kind [data-kind="${k}"]`)));
  ok("A5, A4, A6 and pocket sizes, and custom",
     ["a5", "a4", "a6", "pocket", "custom"].every((k) => doc.querySelector(`#pc-size [data-size="${k}"]`)));
  doc.querySelector('#pc-kind [data-kind="dot"]').click();
  doc.querySelector('#pc-size [data-size="custom"]').click();
  ok("custom shows width and height boxes", doc.querySelector("#pc-custom").hidden === false);
  const wbox = doc.querySelector("#pc-w"), hbox = doc.querySelector("#pc-h");
  wbox.value = "90"; wbox.dispatchEvent(new w.Event("input"));
  hbox.value = "140"; hbox.dispatchEvent(new w.Event("input"));
  ok("the preview follows (90 × 140 mm)", doc.querySelector("#pc-pv-cap").textContent === "90 × 140 mm"
     && doc.querySelector("#pc-pv svg").getAttribute("viewBox") === "0 0 90 140");
  ok("what was chosen is remembered for next time",
     JSON.parse(w.localStorage.getItem("nn:paper:design")).kind === "dot");
  ok("the page can be portrait or landscape, as a clear choice",
     !!doc.querySelector('#pc-land [data-orient="landscape"]') && doc.querySelector("#pc-orient-row").hidden === true);
  doc.querySelector('#pc-sheet [data-sheet="a4"]').click();
  ok("printing on A4 says how many to a sheet", /4 pages to a portrait sheet/.test(doc.querySelector("#pc-fit").textContent),
     doc.querySelector("#pc-fit").textContent);
  ok("  and offers the sheet's way up", doc.querySelector("#pc-orient-row").hidden === false);
  doc.querySelector('#pc-orient [data-orient="landscape"]').click();
  ok("  landscape: 3 to a landscape sheet", /3 pages to a landscape sheet/.test(doc.querySelector("#pc-fit").textContent),
     doc.querySelector("#pc-fit").textContent);
  doc.querySelector("#pc-print").click();
  await wait(60);
  const p1 = printed.pop();
  ok("Print opens the print view, counted as a paper print", p1 && p1.kind === "paper" && p1.html.includes('viewBox="0 0 90 140"'));
  ok("  on landscape sheets", p1.html.includes("@page { size: 297mm 210mm"));
  doc.querySelector('#pc-land [data-orient="landscape"]').click();
  ok("a landscape page turns the preview", doc.querySelector("#pc-pv svg").getAttribute("viewBox") === "0 0 140 90");
  doc.querySelector('#pc-land [data-orient="portrait"]').click();

  doc.querySelector("#pc-save").click();
  doc.querySelector("#pc-name").value = "Pocket dots";
  press(w, "Save").click();
  await wait(60);
  ok("Save keeps it in My papers", designs.length === 1 && designs[0].name === "Pocket dots" && designs[0].design.w === 90
     && doc.querySelector("#pc-saved-list").textContent.includes("Pocket dots"));
  doc.querySelector('#pc-kind [data-kind="lined"]').click();
  doc.querySelector('#pc-saved-list [data-load="0"]').click();
  await wait(80);
  ok("and choosing it brings it all back",
     doc.querySelector('#pc-kind .on').dataset.kind === "dot" && doc.querySelector("#pc-w").value === "90");

  /* ---- 4. covers ---- */
  doc.querySelector('[data-tab="covers"]').click();
  await wait(150);
  ok("Covers is the other half, with its shelf", !!doc.querySelector("#pc-new-cover"));
  doc.querySelector("#pc-new-cover").click();
  const dlg = doc.querySelector("#modal-veil .dlg-body");
  ok("New cover asks size, layout, spine, bleed and material, with a preview",
     ["#pc-cv-size", "#pc-cv-layout", "#pc-cv-spine", "#pc-cv-bleed", "#pc-cv-mat"].every((s) => dlg.querySelector(s))
     && dlg.querySelector("#pc-cv-pv svg"));
  ok("  the preview shows Back and Front either side of the fold",
     /Back/.test(dlg.querySelector("#pc-cv-pv").textContent) && /Front/.test(dlg.querySelector("#pc-cv-pv").textContent));
  dlg.querySelector("#pc-cv-name").value = "Field notes";
  dlg.querySelector('[data-mat="leather"]').click();
  press(w, "Create").click();
  await wait(300);
  const cv = covers["Field notes"];
  ok("Create saves a pocket wrap-around cover at 5 px per mm (178 × 140 mm -> 890 × 700)",
     cv && cv.kind === "cover" && cv.w === 890 && cv.h === 700 && cv.spec.material === "leather", JSON.stringify(cv && cv.spec));
  const host = doc.querySelector(".bd-ed") && doc.querySelector(".bd-ed").parentElement;
  ok("and opens it in the Scrapbook's editor", !!host && doc.querySelector("#bd-back").textContent === "← Covers");
  const groups = [...doc.querySelectorAll(".sb-mats .sb-group")].map((g) => g.dataset.group);
  ok("  with the Scrapbook's materials panel, Assets included",
     groups.join() === "photo,assets,tape,frame,sticker,emb,word", groups.join());
  ok("  and Size & material, Guides and Print", ["#pc-spec", "#pc-guides", "#pc-cover-print", "#sb-rot-l"].every((s) => doc.querySelector(s)));
  const canvas = doc.querySelector("#bd-canvas").innerHTML;
  ok("the cover's leather is behind everything", /feTurbulence/.test(canvas) && canvas.indexOf("feTurbulence") < 400);
  ok("the fold line and safe areas show on screen", /stroke-dasharray="10 7"/.test(canvas) && /Front/.test(canvas));
  const ed = {board: cv};
  ok("but never in what's printed or exported", !/stroke-dasharray="10 7"/.test(SS.BoardEditor.pageSVG(cv, 0)) && ed);
  doc.querySelector("#pc-guides").click();
  ok("Guides hides them", !/stroke-dasharray="10 7"/.test(doc.querySelector("#bd-canvas").innerHTML));
  doc.querySelector('.sb-mats [data-mat="clip:compass"]').click();
  await wait(800);
  const saved = covers["Field notes"];
  ok("clip art from the panel goes on the cover, and the cover saves",
     saved.pages[0].items.some((i) => i.k === "clip" && i.art === "compass"));

  /* changing the size keeps things where they sit on the cover */
  const before = saved.pages[0].items[0];
  doc.querySelector("#pc-spec").click();
  const sd = doc.querySelector("#modal-veil .dlg-body");
  sd.querySelector('#pc-cv-size [data-size="a6"]').click();
  press(w, "Use these").click();
  await wait(100);
  const after = covers["Field notes"];
  ok("Size & material: an A6 wrap-around is 210 × 148 mm", after.w === 1050 && after.h === 740, `${after.w}×${after.h}`);
  const it2 = after.pages[0].items[0];
  ok("  and what's on it moves with the middle of the cover",
     it2.x - before.x === (1050 - 890) / 2 && it2.y - before.y === (740 - 700) / 2);

  doc.querySelector("#pc-cover-print").click();
  await wait(30);
  const pd = doc.querySelector("#modal-veil .dlg-body");
  ok("Print offers the sheet sizes", !!pd.querySelector('#pc-pr-sheet [data-sheet="a4"]'));
  pd.querySelector('#pc-pr-sheet [data-sheet="own"]').click();
  pd.querySelector("#pc-pr-copies").value = "2";
  press(w, "Print…").click();
  await wait(60);
  const p2 = printed.pop();
  ok("the cover prints at its real size, counted as a cover print",
     p2 && p2.kind === "cover" && p2.html.includes("@page { size: 210mm 148mm") && count(p2.html, /class="sheet"/g) === 2);

  /* ---- 5. the shelf ---- */
  doc.querySelector("#bd-back").click();
  await wait(300);
  ok("back on the shelf, the cover shows as itself",
     !!doc.querySelector('.pc-covers [data-open="Field notes"] svg'));

  console.log("\nPaper creator\n");
  out.forEach((l) => console.log(l));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log(out.join("\n")); console.error(e); process.exit(1); });
