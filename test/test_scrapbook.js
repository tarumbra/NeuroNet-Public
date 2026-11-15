/* ==========================================================================
   Scrapbook -- the page, in the real app (jsdom).
   ==========================================================================
   Cam (2026-10-02): "Scrapbook, which should have the same toolbar as boards,
   but also contain a collapseable scrapbook materials (this will have designed
   coloured tapes, frames, stickers (Which i can make from any photo) ...) The
   paper will be selectable from different colours and will allow each page to
   have a different type of paper. Furthermore it will have a cover which the
   material can be changed from wood, fur, colour, metal, ect."
   And the desktop Drop zone's page side (file.drop). The backend is
   test_scrapbook.py.
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
const saved = {};
const calls = [];
let stickers = [];

function declaredScripts() {
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
}



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
    boards_list: async () => Object.entries(saved).map(([id, b]) => ({
      id, name: b.name, pages: (b.pages || []).length, updated: "2026-09-25"})),
    boards_read: async (id) => ({board: JSON.parse(JSON.stringify(saved[id]))}),
    boards_write: async (id, b) => { saved[id] = b; return {ok: true}; },
    boards_formats: async () => ({pptx: true}),
    scrapbooks_list: async () => Object.entries(saved).map(([id, b]) => ({
      id, name: b.name, w: b.w, h: b.h, cover: b.cover || {}, pages: (b.pages || []).length, updated: "2026-10-02"})),
    scrapbooks_read: async (id) => (saved[id] ? {book: JSON.parse(JSON.stringify(saved[id]))} : {error: "gone"}),
    scrapbooks_write: async (id, b) => { calls.push(["scrapbooks_write", id]); saved[id] = JSON.parse(JSON.stringify(b)); return {ok: true}; },
    scrapbook_stickers: async () => ({stickers}),
    open_print_document: async (html, kind) => { calls.push(["print", kind, html]); return {ok: true}; },
    fleeting_add: async (text) => { calls.push(["fleeting_add", text]); return {ok: true, n: 3}; },
    drop_route: async (p) => { calls.push(["drop_route", p]);
      if (p.endsWith(".md")) return {kind: "text", name: "idea.md", path: p, text: "Buy tape"};
      if (p.endsWith(".pdf")) return {kind: "ebook", name: "Book.pdf", path: p};
      if (p.endsWith(".png")) return {kind: "photo", name: "Cat.png", path: p};
      return {error: "NeuroNet doesn't take .flac files yet."}; },
    ebooks_import_paths: async (paths) => { calls.push(["ebooks_import_paths", paths]);
      return paths[0].includes("again") ? {added: [], skipped: [{name: "x", why: "It is already in the library."}]}
        : {added: [{id: "b1"}], skipped: []}; },
    photo_store: async (p) => { calls.push(["photo_store", p]); return {storedName: "Cat.png", originalName: "Cat.png"}; },
  };
  const api = new Proxy({}, {
    get: (t, n) => (typeof n === "string"
      ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined),
  });
  const dom = new JSDOM(fs.readFileSync(path.join(UI, "index.html"), "utf8"),
    {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  const mem = {};
  Object.defineProperty(w, "localStorage", {configurable: true, value: {
    getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }}});
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
  await wait(300);
  return w;
}

const PX = (w, h, fill) => { const a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) a.set(fill(i % w, (i / w) | 0), i * 4); return a; };
const count = (m) => m.reduce((s, v) => s + v, 0);
const press = (w, label) => [...w.document.querySelectorAll("#modal-veil .dlg-row button")].find((b) => b.textContent === label);

(async () => {
  const w = await boot();
  const SS = w.SS, A = SS.ScrapArt;

  /* ---- 1. the shelf, and a new scrapbook ---- */
  SS.go("scrapbook:shelf");
  await wait(200);
  const main = w.document.querySelector(".sb-head");
  ok("Scrapbook opens from the Vault's menu, with its shelf", !!main && main.textContent.includes("Scrapbook"));
  w.document.querySelector("#sb-new").click();
  const dlg = w.document.querySelector("#modal-veil .dlg-body");
  ok("New scrapbook asks for size, cover and paper, with a preview",
     dlg && dlg.querySelector("#sb-size") && dlg.querySelector("#sb-mat") && dlg.querySelector("#sb-paper")
     && dlg.querySelectorAll("#sb-new-preview svg").length === 2);
  dlg.querySelector('[data-mat="metal"]').click();
  dlg.querySelector('[data-paper="kraft"]').click();
  dlg.querySelector("#sb-name").value = "Summer trip";
  press(w, "Create").click();
  await wait(300);
  const book = saved["Summer trip"];
  ok("Create saves a scrapbook with its cover and first page's paper",
     book && book.kind === "scrapbook" && book.cover.material === "metal" && book.cover.title === "Summer trip"
     && book.pages.length === 1 && book.pages[0].paper === "kraft" && book.w === 1500 && book.h === 1500, JSON.stringify(book && book.cover));

  /* ---- 2. the editor: Boards' toolbar, plus the materials ---- */
  const host = w.document.querySelector(".sb-ed") && w.document.querySelector(".sb-ed").parentElement;
  ok("it opens straight into the editor", !!host);
  const tools = [...host.querySelectorAll(".bd-side [data-tool]")].map((b) => b.dataset.tool);
  ok("with the same toolbar as Boards", tools.join() === SS.BoardEditor._test.TOOLS.map((t) => t[0]).join() && tools.length === 14);
  ok("  and Boards' layers, pages, undo, snapshots and Export PNG",
     ["[data-layer=front]", "#bd-page-add", "#bd-undo", "#bd-snaps", "#bd-png"].every((s) => host.querySelector(s)));
  ok("  and its own back button, Turn, Paper and Cover",
     host.querySelector("#bd-back").textContent === "← Scrapbooks"
     && ["#sb-rot-l", "#sb-rot-r", "#sb-paper", "#sb-cover"].every((s) => host.querySelector(s)));
  const mats = host.querySelector(".bd-ed-body > .bd-stage + .sb-mats");
  ok("the materials panel sits to the right of the canvas", !!mats);
  const groups = [...mats.querySelectorAll(".sb-group")].map((g) => g.dataset.group);
  ok("  with your photos, assets, tape, frames, stickers, embellishments and words",
     groups.join() === "photo,assets,tape,frame,sticker,emb,word", groups.join());
  ok("  every material has a picture of itself",
     [...mats.querySelectorAll("[data-mat]")].every((b) => b.querySelector("svg [data-id]")));
  host.querySelector("#sb-mats-toggle").click();
  ok("the panel collapses, and remembers", mats.classList.contains("is-collapsed")
     && JSON.parse(w.localStorage.getItem("nn:scrapbook:panel")).collapsed === true);
  host.querySelector("#sb-mats-toggle").click();
  ok("  and opens again", !mats.classList.contains("is-collapsed"));

  /* ---- printing, portrait or landscape (Cam, 2026-10-03: "have ability to
     print it landscape as well for both paper tool and scrap book") ---- */
  ok("the scrapbook has Print, and a landscape page size",
     !!host.querySelector("#sb-print") && SS.Scrapbook._test.SIZES.some((x) => x.key === "letter-land" && x.w > x.h));
  ok("a 12 × 12 page is 304.8 mm square; a landscape letter page 279.4 × 215.9 mm",
     SS.Scrapbook._test.pageMM({w: 1500, h: 1500}).every((v) => Math.abs(v - 304.8) < 0.01)
     && Math.abs(SS.Scrapbook._test.pageMM({w: 1650, h: 1275})[1] - 215.9) < 0.01);
  host.querySelector("#sb-print").click();
  await wait(50);
  const pdlg = w.document.querySelector("#modal-veil .dlg-body");
  ok("Print asks for the sheet and which way up, shrinking to fit by default",
     !!pdlg.querySelector('#pc-pr-orient [data-orient="landscape"]') && pdlg.querySelector("#pc-pr-fitbox").checked);
  pdlg.querySelector('#pc-pr-orient [data-orient="landscape"]').click();
  ok("  and says what it will do", /landscape sheet, shrunk to 65%/.test(pdlg.querySelector("#pc-pr-fit").textContent),
     pdlg.querySelector("#pc-pr-fit").textContent);
  press(w, "Print…").click();
  await wait(80);
  const pr = calls.filter((c) => c[0] === "print").pop();
  ok("  it prints on landscape A4, counted as scrapbook pages",
     pr && pr[1] === "scrapbook" && pr[2].includes("@page { size: 297mm 210mm"));

  /* the editor object, from the page: reopen through the module to hold it */
  const ed = await SS.Scrapbook._test.openBook(host, "Summer trip");
  await wait(50);

  /* ---- 3. putting materials on the page ---- */
  const before = ed.items().length;
  let placed = 0, drawn = 0;
  for (const b of ed.host.querySelectorAll("[data-mat]")) {
    b.click();
    const it = ed.items()[ed.items().length - 1];
    if (it && it.id && ed.sel.has(it.id)) placed += 1;
    if (ed.svg.querySelector(`[data-id="${it.id}"]`)) drawn += 1;
  }
  const n = ed.host.querySelectorAll("[data-mat]").length;
  ok(`a click puts each of the ${n} materials on the page, chosen`, placed === n && ed.items().length === before + n, placed);
  ok("  and every one is drawn on the canvas", drawn === n, drawn);
  const kinds = new Set(ed.items().map((i) => i.k));
  ok("  tape, frames, embellishments and words", ["tape", "frame", "emb", "word"].every((k) => kinds.has(k)));
  const svgText = SS.BoardEditor.pageSVG(ed.board, 0);
  ok("Export draws the page the same way (materials and paper are in the exported picture)",
     svgText.includes("sa-tp-") && svgText.includes("Double-click for a photo") && /sa-paper|sa-pn/.test(svgText));
  ok("everything saves through scrapbooks_write, never boards_write",
     calls.some((c) => c[0] === "scrapbooks_write") && !Object.keys(saved).some((k) => saved[k].kind !== "scrapbook"));

  /* ---- 4. Turn ---- */
  ed.sel = new Set(); ed.draw();
  ed.host.querySelector('[data-mat="tape:dots"]').click();
  const tape = ed.items()[ed.items().length - 1];
  ok("tape goes on at a slight angle, like real tape", tape.rot === -8);
  ed.host.querySelector("#sb-rot-r").click();
  ok("Turn right turns what's chosen 15°", tape.rot === 7);
  ok("  and it is drawn turned about its middle", new RegExp(`rotate\\(7 ${tape.x + tape.w / 2} ${tape.y + tape.h / 2}\\)`).test(ed.svg.innerHTML));
  ed.undo();
  ok("  undoable", ed.items().find((i) => i.id === tape.id).rot === -8);

  /* ---- 5. recolouring with Boards' palette ---- */
  ed.sel = new Set([tape.id]);
  ed.target = "fill";
  ed.pickColour("#2f7d4f");
  ok("Boards' colour palette recolours tape", ed.items().find((i) => i.id === tape.id).fill === "#2f7d4f");

  /* ---- 6. paper per page ---- */
  SS.Scrapbook._test.setPaper(ed, "linen", "#dcebf5", false);
  ed.addPage();
  SS.Scrapbook._test.setPaper(ed, "dotted", "", false);
  ok("each page keeps its own paper", ed.board.pages[0].paper === "linen" && ed.board.pages[0].paperColour === "#dcebf5"
     && ed.board.pages[1].paper === "dotted");
  ed.goPage(0);
  ok("  and the page on screen is drawn on its paper", ed.svg.innerHTML.includes("#dcebf5"));
  ed.host.querySelector("#sb-paper").click();
  let pd = w.document.querySelector("#modal-veil .dlg-body");
  ok("Paper opens a picker with types, colours and a preview",
     pd.querySelectorAll("[data-paper]").length === A.PAPERS.length && pd.querySelector("#sb-pp-col") && pd.querySelector("#sb-pp-pv svg"));
  pd.querySelector('[data-paper="watercolour"]').click();
  pd.querySelector("#sb-pp-all").checked = true;
  press(w, "Use this paper").click();
  ok("  “every page” puts it on them all", ed.board.pages.every((p) => p.paper === "watercolour"));

  /* ---- 7. the cover ---- */
  ed.host.querySelector("#sb-cover").click();
  const cd = w.document.querySelector("#modal-veil .dlg-body");
  ok("Cover offers every material", A.COVERS.every(([k]) => cd.querySelector(`[data-mat="${k}"]`)) && cd.querySelector("#sb-cv-pv svg"));
  cd.querySelector('[data-mat="fur"]').click();
  cd.querySelector('#sb-cv-col [data-col="#c2185b"]').click();
  press(w, "Save cover").click();
  await wait(50);
  ok("  and saves the one chosen", saved["Summer trip"].cover.material === "fur" && saved["Summer trip"].cover.colour === "#c2185b");
  ok("every cover material draws", A.COVERS.every(([k]) => /<svg[\s\S]*<\/svg>/.test(A.coverSVG({material: k, title: "T"}, 120, 120))));

  /* ---- 8. words and frames are edited their own way ---- */
  ed.host.querySelector('[data-mat="word:label"]').click();
  const word = ed.items()[ed.items().length - 1];
  const w0 = word.w;
  ed.editSelected();
  const wd = w.document.querySelector("#modal-veil #sb-words");
  ok("Edit on words asks for the words", !!wd);
  wd.value = "OUR SUMMER HOLIDAY";
  press(w, "Save").click();
  ok("  and the label grows to fit them", word.text === "OUR SUMMER HOLIDAY" && word.w > w0, word.w + " vs " + w0);
  let asked = 0;
  SS.shared.pickFromLibrary = async () => { asked += 1; return null; };
  ed.host.querySelector('[data-mat="frame:film"]').click();
  ed.editSelected();
  await wait(20);
  ok("Edit on an empty frame asks for a photo", asked === 1);

  /* ---- 9. dragging a material onto the canvas ---- */
  const dropAt = (key, x, y) => {
    const e = new w.MouseEvent("drop", {clientX: x, clientY: y, bubbles: true, cancelable: true});
    Object.defineProperty(e, "dataTransfer", {value: {getData: () => key, files: []}});
    ed.svg.dispatchEvent(e);
  };
  dropAt("nn-mat:emb:button", 400, 300);
  const btn = ed.items()[ed.items().length - 1];
  ok("a material dragged onto the page lands where it's let go", btn.style === "button"
     && btn.x + btn.w / 2 === 400 && btn.y + btn.h / 2 === 300, JSON.stringify([btn.x, btn.y]));

  /* ---- 10. the sticker book ---- */
  stickers = [{id: "s0123456789", name: "Dog", w: 400, h: 200, dataUrl: "data:image/png;base64,AAAA"}];
  const ed2 = await SS.Scrapbook._test.openBook(host, "Summer trip");
  await wait(50);
  const tile = ed2.host.querySelector('[data-sticker="s0123456789"]');
  ok("saved stickers are in the panel", tile && tile.textContent.includes("Dog"));
  tile.click();
  const st = ed2.items()[ed2.items().length - 1];
  ok("  a click puts a copy on the page, the right shape", st.k === "sticker" && st.src === "data:image/png;base64,AAAA"
     && st.w === 260 && st.h === 130);

  /* ---- 11. Boards is unchanged ---- */
  const bh = w.document.createElement("div"); w.document.body.appendChild(bh);
  SS.BoardEditor.open(bh, "b", {name: "B", w: 1600, h: 1000, paper: "grid", pages: [{items: []}]}, () => {});
  ok("a board has no materials, and its own back button",
     !bh.querySelector(".sb-mats") && bh.querySelector("#bd-back").textContent === "← Boards" && !bh.querySelector("#sb-paper"));
  ok("  and its own grid paper", bh.querySelector("#bd-canvas").innerHTML.includes('id="bd-paper"'));

  /* ---- 12. stickers from photos: the cut-out ---- */
  const W = 20, H = 20;
  const px = PX(W, H, (x, y) => (x >= 6 && x < 14 && y >= 6 && y < 14 ? [200, 30, 30, 255] : [245, 245, 240, 255]));
  const keep = A.cutoutMask(px, W, H, 40);
  ok("Cut out keeps the thing and drops a plain background", count(keep) === 64 && keep[10 * W + 10] === 1 && keep[0] === 0, count(keep));
  const ring = A.grow(keep, W, H, 2);
  ok("  the die-cut border grows round it", count(ring) > 64 && ring[10 * W + 5] === 1 && ring[10 * W + 3] === 0);
  const specks = new Uint8Array(W * H); specks[0] = 1; specks[5 * W + 5] = 1;
  for (let y = 10; y < 15; y++) for (let x = 10; x < 15; x++) specks[y * W + x] = 1;
  ok("  stray specks are dropped", count(A.dropSpecks(specks, W, H, 4)) === 25);
  const sp = A.stickerPixels(px, W, H, {shape: "cutout", border: 2, tol: 40});
  const at = (x, y) => [...sp.pixels.slice((y * W + x) * 4, (y * W + x) * 4 + 4)];
  ok("  the sticker: the photo inside, white border, clear outside",
     at(10, 10).join() === "200,30,30,255" && at(5, 10).join() === "255,255,255,255" && at(1, 1)[3] === 0);
  const circle = A.shapeMask("circle", 40, 40, 4);
  ok("shapes: a circle keeps its middle, not its corners", circle[20 * 40 + 20] === 1 && circle[0] === 0 && circle[5 * 40 + 5] === 0);
  ok("  every shape gives a shape", A.SHAPES.filter(([k]) => k !== "cutout").every(([k]) => {
    const m = A.shapeMask(k, 40, 40, 4); return count(m) > 200 && count(m) < 1600; }));
  ok("a photo all one colour leaves nothing to cut out (said, not a blank sticker)",
     A.stickerPixels(PX(W, H, () => [9, 9, 9, 255]), W, H, {shape: "cutout", border: 2, tol: 40}).empty === true);

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log(out.join("\n")); console.error(e); process.exit(1); });
