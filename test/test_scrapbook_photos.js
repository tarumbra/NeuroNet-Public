/* ==========================================================================
   Scrapbook -- photos: the photo browser in the materials panel, double-click
   for a photo, and moving a photo inside its frame (jsdom).
   ==========================================================================
   Cam (2026-10-02): "Scrapbook has an issue when i double click to add photo
   it doesnt work. When it does work i want the in app photo selector to open
   up, if you recommend another option we could do is have the in app photo
   browser within the scrap book feature, then i can search and drag and drop
   onto a scrapbook, and dragging onto a frame will add that photo, then if i
   right click the photo i can move the photo around to choose the focus. I
   think canva handles this similar."
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

const PHOTOS = [
  {storedName: "beach.jpg", caption: "Beach day", tags: ["summer"]},
  {storedName: "dog.jpg", caption: "Dog"},
  {storedName: "tall.jpg", caption: "Tower"},
];
const SIZE = {"beach.jpg": [1200, 800], "dog.jpg": [800, 800], "tall.jpg": [600, 1200]};
const urlOf = (n) => "data:image/jpeg;base64," + n;
const saved = {
  Trip: {kind: "scrapbook", name: "Trip", w: 1500, h: 1500, paper: "kraft",
         cover: {material: "wood", colour: "", title: "Trip"},
         pages: [{paper: "kraft", items: [
           {id: "f1", k: "frame", style: "mat", fill: "#f4efe4", x: 100, y: 100, w: 400, h: 400},
           {id: "f2", k: "frame", style: "polaroid", fill: "#ffffff", x: 800, y: 100, w: 300, h: 360},
         ]}]},
};

async function boot() {
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 3}),
    photo_get_data: async () => ({photos: JSON.parse(JSON.stringify(PHOTOS)), albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    photo_full: async (n) => ({dataUrl: urlOf(n)}),
    photo_thumb: async (n) => ({dataUrl: urlOf(n)}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    scrapbooks_read: async (id) => ({book: JSON.parse(JSON.stringify(saved[id]))}),
    scrapbooks_write: async (id, b) => { saved[id] = JSON.parse(JSON.stringify(b)); return {ok: true}; },
    scrapbook_stickers: async () => ({stickers: []}),
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
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
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => null;
  // jsdom loads no pictures: this one "loads" at the photo's real size
  w.Image = class {
    set src(u) {
      this._src = u;
      const n = String(u).split(",")[1] || "";
      const sz = SIZE[n];
      setTimeout(() => { if (sz) { this.naturalWidth = sz[0]; this.naturalHeight = sz[1]; this.onload && this.onload(); }
                         else if (this.onerror) this.onerror(); }, 1);
    }
    get src() { return this._src; }
  };
  for (const src of [...fs.readFileSync(path.join(UI, "index.html"), "utf8").matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    w.eval(fs.readFileSync(path.join(UI, src), "utf8"));
  }
  await wait(400);
  return w;
}

(async () => {
  const w = await boot();
  const SS = w.SS, doc = w.document;
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const ed = await SS.Scrapbook._test.openBook(host, "Trip");
  await wait(100);
  const item = (id) => ed.items().find((i) => i.id === id);

  /* ---- the photo browser ---- */
  const tiles = () => [...host.querySelectorAll("#sb-photos [data-photo]")].map((b) => b.dataset.photo);
  ok("the materials panel starts with your photos", host.querySelector('.sb-group[data-group="photo"] #sb-photos') !== null
     && host.querySelector(".sb-group").dataset.group === "photo");
  ok("  your newest first", tiles().join() === "tall.jpg,dog.jpg,beach.jpg", tiles().join());
  ok("  each one drags", [...host.querySelectorAll("#sb-photos [data-photo]")].every((b) => b.draggable));
  const q = host.querySelector("#sb-photo-q");
  q.value = "summer"; q.dispatchEvent(new w.Event("input"));
  await wait(250);
  ok("search finds them by caption, tag, name", tiles().join() === "beach.jpg", tiles().join());
  q.value = ""; q.dispatchEvent(new w.Event("input"));
  await wait(250);

  /* click with nothing chosen: a photo of its own, its own shape */
  ed.sel = new Set();
  const n0 = ed.items().length;
  host.querySelector('[data-photo="beach.jpg"]').click();
  await wait(80);
  const added = ed.items()[ed.items().length - 1];
  ok("click a photo: it goes on the page", ed.items().length === n0 + 1 && added.k === "photo" && added.photo === "beach.jpg");
  ok("  its own shape (3:2), with its size kept for framing", added.w === 360 && added.h === 240
     && added.nw === 1200 && added.nh === 800, JSON.stringify([added.w, added.h, added.nw, added.nh]));

  /* click with a frame chosen: the frame takes it */
  ed.sel = new Set(["f1"]);
  host.querySelector('[data-photo="dog.jpg"]').click();
  await wait(80);
  ok("click a photo with a frame chosen: the frame takes it", item("f1").src === urlOf("dog.jpg") && item("f1").photo === "dog.jpg"
     && ed.items().length === n0 + 1);

  /* drag onto a frame / onto the page */
  const dropped = (key) => ({dataTransfer: {getData: () => key}, preventDefault() {}, stopPropagation() {}});
  ed.opts.dropAt(ed, dropped("nn-photo:tall.jpg"), 900, 200);
  await wait(80);
  ok("drag a photo onto a frame: it fills the frame", item("f2").photo === "tall.jpg" && ed.items().length === n0 + 1);
  ed.opts.dropAt(ed, dropped("nn-photo:dog.jpg"), 700, 1200);
  await wait(80);
  const onPage = ed.items()[ed.items().length - 1];
  ok("  onto the page: a new photo where it was dropped", onPage.k === "photo" && onPage.photo === "dog.jpg"
     && Math.abs(onPage.x + onPage.w / 2 - 700) <= 1 && Math.abs(onPage.y + onPage.h / 2 - 1200) <= 1);

  /* ---- double-click an empty frame: the in-app photo picker ---- */
  ed.board.pages[0].items.push({id: "f3", k: "frame", style: "round", fill: "#fff", x: 300, y: 800, w: 300, h: 300});
  ed.sel = new Set(); ed.draw();
  const Z = ed.zoom;
  const down = (x, y, button) => {
    const el = ed.svg.querySelector('[data-id="f3"]') || ed.svg;
    el.dispatchEvent(new w.MouseEvent("mousedown", {clientX: x * Z, clientY: y * Z, button: button || 0, bubbles: true, cancelable: true}));
  };
  const up = (x, y) => w.dispatchEvent(new w.MouseEvent("mouseup", {clientX: x * Z, clientY: y * Z, bubbles: true}));
  const moveTo = (x, y) => w.dispatchEvent(new w.MouseEvent("mousemove", {clientX: x * Z, clientY: y * Z, bubbles: true}));
  down(450, 950); up(450, 950);
  ok("one click on an empty frame just chooses it", ed.sel.has("f3") && !doc.querySelector("#modal-veil.open #pick-q"));
  down(450, 950); up(450, 950);       // the second press lands on a NEW element (the board redrew)
  await wait(30);
  ok("double-click it: the in-app photo picker opens", !!doc.querySelector("#modal-veil.open #pick-q"));
  const cancel = [...doc.querySelectorAll("#modal-veil .dlg-row button")].find((b) => b.textContent === "Cancel");
  if (cancel) cancel.click();
  await wait(30);
  const fx0 = item("f3").x;
  down(450, 950); up(450, 950); await wait(5);
  down(450, 950); moveTo(500, 950); up(500, 950);
  ok("pressed again and dragged, it's a move, not a double-click", item("f3").x === fx0 + 50
     && !doc.querySelector("#modal-veil.open #pick-q"));

  /* ---- right-click a photo: move it in its frame ---- */
  const f1 = item("f1");                 // dog.jpg (square) in a 400 mat: no room left over until zoomed
  ok("a photo fills its frame, centred, as before", f1.fx == null && f1.fy == null);
  const f2 = item("f2");                 // tall.jpg in a polaroid: room to move up and down
  const box = SS.ScrapArt.photoBox(f2);
  const g0 = SS.BoardEditor.photoGeo(f2, box);
  ok("  a tall photo in a wide window sits centred", g0 && Math.abs(g0.y - (box[1] - g0.oy / 2)) < 0.2, JSON.stringify(g0));
  const cx = box[0] + box[2] / 2, cy = box[1] + box[3] / 2;
  ed.svg.dispatchEvent(new w.MouseEvent("mousedown", {clientX: cx * Z, clientY: cy * Z, button: 2, bubbles: true, cancelable: true}));
  ok("right-click it: moving mode, the rest of the photo shown faintly", ed.reframe === f2
     && !!ed.svg.querySelector(".bd-reframe image") && !!ed.svg.querySelector("#bd-rf-mask"));
  moveTo(cx, cy + 60); up(cx, cy + 60);
  ok("  drag down: the photo moves down in the window (shows more of its top)", f2.fy < 0.5 && f2.fy > 0,
     JSON.stringify([f2.fx, f2.fy]));
  const fyAfter = f2.fy;
  ed.svg.dispatchEvent(new w.WheelEvent("wheel", {clientX: cx * Z, clientY: cy * Z, deltaY: -100, bubbles: true, cancelable: true}));
  ok("  scroll: zooms in", f2.zoom > 1, String(f2.zoom));
  const drawn = ed.svg.querySelector('[data-id="f2"] image');
  ok("  and the page draws it there", drawn && drawn.getAttribute("preserveAspectRatio") === "none"
     && Math.abs(Number(drawn.getAttribute("height")) - SS.BoardEditor.photoGeo(f2, box).h) < 0.2);
  w.dispatchEvent(new w.KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
  ok("Esc: done", ed.reframe === null && !ed.svg.querySelector(".bd-reframe"));
  await wait(1300);
  const kept = saved.Trip.pages[0].items.find((i) => i.id === "f2");
  ok("  and it's saved with the page", kept && kept.fy === fyAfter && kept.zoom === f2.zoom, JSON.stringify(kept && [kept.fy, kept.zoom]));
  ed.undo();
  const back = item("f2");
  ok("  one undo puts it back as it was", back.fy == null && back.zoom == null, JSON.stringify([back.fy, back.zoom]));

  /* right-click, no drag, click elsewhere: nothing to undo */
  const stack = ed.undoStack.length;
  ed.svg.dispatchEvent(new w.MouseEvent("mousedown", {clientX: cx * Z, clientY: cy * Z, button: 2, bubbles: true, cancelable: true}));
  up(cx, cy);
  ed.svg.dispatchEvent(new w.MouseEvent("mousedown", {clientX: 1400 * Z, clientY: 1400 * Z, bubbles: true, cancelable: true}));
  up(1400, 1400);
  ok("right-click and click away without moving it: no empty undo step", ed.reframe === null && ed.undoStack.length === stack,
     `${stack} -> ${ed.undoStack.length}`);

  /* a photo placed before this has no size: drawn as it always was */
  const old = {id: "o1", k: "photo", x: 0, y: 0, w: 100, h: 100, src: urlOf("dog.jpg")};
  ok("an older photo (no size kept) is drawn as before, centred",
     /preserveAspectRatio="xMidYMid slice"/.test(SS.BoardEditor.photoImage(old, [0, 0, 100, 100], "")));
})().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_scrapbook_photos.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
