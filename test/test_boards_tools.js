/* ==========================================================================
   Boards: the side toolbar, and drawing lines, arrows and curves yourself.
   ==========================================================================
   Cam: "i can not change the direction of the arrow or line they just place
   a predefined line or arrow that all i can do is resize, i want the
   abiility to draw the line and arrow myself. Also when i select a shape and
   fill, I want to be able to select the colours for the line and fill then
   place it with those ... stay persistent until i change them (please
   include an indicator so i know what i have selected). Need more freedom
   with the curve tool ... pencil (freedraw), line tool, Arrow, a curve ...
   a side buildbar on the side of the canvas (like a photoshop, paint tool
   bar)."

   The real editor, driven with mouse events on its canvas.
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

(async () => {
  const w = await boot();
  const SS = w.SS;
  const open = (board) => {
    const host = w.document.createElement("div");
    w.document.body.appendChild(host);
    return SS.BoardEditor.open(host, "t" + Math.random(), board, () => {});
  };
  const blank = () => ({name: "Test", w: 1600, h: 1000, pages: [{items: []}]});
  /* jsdom lays nothing out, so the canvas sits at 0,0 and a client point IS
     a board point at 100% zoom. */
  const down = (ed, x, y, o = {}) => ed.svg.dispatchEvent(new w.MouseEvent("mousedown", {clientX: x, clientY: y, bubbles: true, ...o}));
  const move = (x, y, o = {}) => w.dispatchEvent(new w.MouseEvent("mousemove", {clientX: x, clientY: y, ...o}));
  const up = (x, y) => w.dispatchEvent(new w.MouseEvent("mouseup", {clientX: x, clientY: y}));
  const drag = (ed, a, b, o = {}) => { down(ed, a[0], a[1], o); move(b[0], b[1], o); up(b[0], b[1]); };
  const last = (ed) => ed.items()[ed.items().length - 1];

  /* ---- the toolbar ---- */
  let ed = open(blank());
  const side = ed.host.querySelector(".bd-side");
  const tools = side ? [...side.querySelectorAll("[data-tool]")].map((b) => b.dataset.tool) : [];
  ok("the tools are in a toolbar down the side of the canvas",
     side && tools.join() === "select,text,photo,graph,rect,square,ellipse,circle,triangle,diamond,draw,line,arrow,curve", tools.join());
  ok("  grouped (Insert / Shapes / Draw), each with a name and its key in the tooltip",
     [...side.querySelectorAll(".bd-tgroup-lbl")].map((e) => e.textContent).slice(0, 3).join() === "Insert,Shapes,Draw"
     && side.querySelector('[data-tool="line"]').title === "Line (L)");
  ok("  and the canvas sits beside it", !!ed.host.querySelector(".bd-ed-body > .bd-side + .bd-stage"));

  /* ---- lines point where they're drawn ---- */
  ed.setTool("line");
  drag(ed, [300, 300], [100, 120]);
  let it = last(ed);
  ok("a line drawn up and to the left goes up and to the left",
     it.k === "line" && JSON.stringify(it.pts) === "[[300,300],[100,120]]", JSON.stringify(it.pts));
  ok("  and is drawn that way", /d="M300 300 L 100 120"/.test(ed.svg.innerHTML));
  ok("  the Line tool stays picked for the next one", ed.tool === "line");
  drag(ed, [100, 500], [400, 512], {shiftKey: true});
  ok("Shift keeps a line to 15° steps (a near-flat line comes out flat)", last(ed).pts[1][1] === 500, JSON.stringify(last(ed).pts));
  down(ed, 700, 700); up(700, 700);
  ok("a plain click makes a 200-pixel line", JSON.stringify(last(ed).pts) === "[[700,700],[900,700]]");

  ed.setTool("arrow");
  drag(ed, [500, 100], [200, 400]);
  it = last(ed);
  ok("an arrow points at where the drag ended", it.k === "arrow" && JSON.stringify(it.pts[1]) === "[200,400]");
  ok("  its head is drawn at that end", new RegExp('points="200,400 ').test(ed.svg.innerHTML));

  /* ---- ends move one at a time ---- */
  ed.setTool("select");
  ed.sel = new Set([it.id]); ed.draw();
  const handles = [...ed.svg.querySelectorAll("[data-pt]")].map((h) => h.dataset.pt);
  ok("a selected arrow has a handle on each end", handles.join() === `${it.id}|0,${it.id}|1`, handles.join());
  const endHandle = ed.svg.querySelector(`[data-pt="${it.id}|1"]`);
  endHandle.dispatchEvent(new w.MouseEvent("mousedown", {clientX: 200, clientY: 400, bubbles: true}));
  move(260, 90); up(260, 90);
  ok("dragging the point end turns the arrow; the other end stays put",
     JSON.stringify(it.pts) === "[[500,100],[260,90]]", JSON.stringify(it.pts));

  /* ---- curves bend freely ---- */
  ed.setTool("curve");
  drag(ed, [100, 800], [500, 800]);
  it = last(ed);
  ok("a curve starts as the line you drag", it.k === "curve" && it.pts.length === 4 && it.pts[0][0] === 100 && it.pts[3][0] === 500);
  ok("  then waits for a bend", ed.curveEdit && ed.curveEdit.stage === 1);
  drag(ed, [300, 800], [300, 650]);
  const B = (t, P) => [0, 1].map((k) => (1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t ** 2 * P[2][k] + t ** 3 * P[3][k]);
  const mid = B(0.5, it.pts);
  ok("the first bend makes an arc that passes through the pointer",
     Math.abs(mid[0] - 300) <= 1 && Math.abs(mid[1] - 650) <= 1 && JSON.stringify(it.pts[1]) === JSON.stringify(it.pts[2]), JSON.stringify(mid));
  drag(ed, [400, 700], [400, 900]);
  ok("a second bend pulls the other half: an S", it.pts[1][1] < 800 && it.pts[2][1] > 800, JSON.stringify(it.pts));
  ok("  and the curve is finished and selected", !ed.curveEdit && ed.sel.has(it.id));
  ed.setTool("select"); ed.sel = new Set([it.id]); ed.draw();
  ok("a selected curve has handles on both ends and both bend points",
     ed.svg.querySelectorAll(`[data-pt^="${it.id}|"]`).length === 4 && ed.svg.querySelectorAll(".bd-pt-bend").length === 2);
  const bend = ed.svg.querySelector(`[data-pt="${it.id}|1"]`);
  const c1 = it.pts[1].slice();
  bend.dispatchEvent(new w.MouseEvent("mousedown", {clientX: c1[0], clientY: c1[1], bubbles: true}));
  move(c1[0] - 50, c1[1] - 40); up(c1[0] - 50, c1[1] - 40);
  ok("  and a bend point can be dragged anywhere", it.pts[1][0] === c1[0] - 50 && it.pts[1][1] === c1[1] - 40);
  ed.setTool("curve");
  drag(ed, [900, 300], [1200, 300]);
  w.dispatchEvent(new w.KeyboardEvent("keydown", {key: "Enter"}));
  ok("Enter finishes a curve before it's bent", !ed.curveEdit);

  /* ---- colours and width: picked first, kept ---- */
  ed.setTool("select");
  ed.sel = new Set();
  ed.host.querySelector('[data-target="fill"]').click();
  ed.host.querySelector('[data-col="#f1c40f"]').click();
  ed.host.querySelector('[data-target="stroke"]').click();
  ed.host.querySelector('[data-col="#c0392b"]').click();
  ed.host.querySelector('[data-sw="6"]').click();
  ed.setTool("rect");
  drag(ed, [50, 50], [250, 150]);
  it = last(ed);
  ok("a shape is made in the colours and width picked beforehand",
     it.k === "rect" && it.fill === "#f1c40f" && it.stroke === "#c0392b" && it.sw === 6, JSON.stringify(it));
  ed.setTool("draw");
  drag(ed, [600, 600], [660, 640]);
  ok("so is a pencil stroke (line colour and width)", last(ed).stroke === "#c0392b" && last(ed).sw === 6);
  ok("  and the pencil stays picked, drawn smooth", ed.tool === "draw");
  const wells = [".bd-well-stroke", ".bd-well-fill"].map((q) => ed.host.querySelector(q).style.getPropertyValue("--c"));
  ok("the indicator shows the line and fill colours in use", wells.join() === "#c0392b,#f1c40f", wells.join());
  const now = ed.host.querySelector("#bd-now").textContent;
  ok("  in words too, with the width", /Line #c0392b/.test(now) && /Fill #f1c40f/.test(now) && /6 px/.test(now), now);
  ok("  and the chosen swatch and width are marked",
     ed.host.querySelector('[data-col="#c0392b"]').classList.contains("on") && ed.host.querySelector('[data-sw="6"]').classList.contains("on"));
  const ed2 = open(blank());
  ok("they stay picked -- a board opened later starts with them",
     JSON.stringify(ed2.style) === JSON.stringify({stroke: "#c0392b", fill: "#f1c40f", sw: 6}), JSON.stringify(ed2.style));
  ed2.target = "fill"; ed2.pickColour("none");
  ed2.setTool("circle");
  drag(ed2, [100, 100], [200, 200]);
  ok("'no fill' makes an outline-only shape", last(ed2).fill === "none");
  ed2.target = "stroke"; ed2.pickColour("none");
  ok("  but a line can't be given no colour", ed2.style.stroke === "#c0392b");
  const sh = last(ed2);
  ed2.setTool("select"); ed2.sel = new Set([sh.id]);
  ed2.target = "stroke"; ed2.pickColour("#2b6cb0");
  ok("picking a colour with something selected recolours it too", sh.stroke === "#2b6cb0");

  /* ---- keys ---- */
  w.dispatchEvent(new w.KeyboardEvent("keydown", {key: "l"}));
  ok("a tool's letter picks it (L = Line)", ed2.tool === "line");
  w.dispatchEvent(new w.KeyboardEvent("keydown", {key: "v"}));
  ok("  V goes back to Select", ed2.tool === "select");

  /* ---- typing into a text box (Cam: "when inserting a text box and
     clicking it i cannot type anything it justs shows the placeholder
     text") ---- */
  {
    const et = open(blank());
    et.setTool("text");
    drag(et, [200, 200], [420, 240]);
    let ta = et.host.querySelector("textarea.bd-type");
    const t = last(et);
    ok("a new text box takes typing straight away (a box to type in, focused)",
       t.k === "text" && ta && w.document.activeElement === ta && ta.value === "", ta ? ta.value : "no box");
    ok("  with no placeholder word left in it", t.text === "");
    ta.value = "Big idea\nsecond line";
    ta.dispatchEvent(new w.Event("input"));
    ta.blur();
    ok("clicking away keeps what was typed", t.text === "Big idea\nsecond line" && !et.host.querySelector("textarea.bd-type"), JSON.stringify(t.text));
    ok("  and it's drawn on the board", /Big idea/.test(et.svg.innerHTML) && /second line/.test(et.svg.innerHTML));
    ok("  its box grows to fit the words", t.w > 100 && t.h > 40, t.w + "x" + t.h);
    et.setTool("text");
    drag(et, [600, 600], [700, 640]);
    const n = et.items().length;
    et.host.querySelector("textarea.bd-type").blur();
    ok("a new text box left empty is removed", et.items().length === n - 1);
    et.setTool("select");
    et.sel = new Set([t.id]); et.draw();
    const hit = [...et.svg.querySelectorAll(`[data-id="${t.id}"]`)][0];
    hit.dispatchEvent(new w.MouseEvent("mousedown", {clientX: 250, clientY: 215, bubbles: true}));
    up(250, 215);
    ta = et.host.querySelector("textarea.bd-type");
    ok("clicking a selected text box types in it, words and all", !!ta && ta.value === "Big idea\nsecond line");
    ok("  and the drawn words step aside while typing", !/Big idea/.test(et.svg.innerHTML));
    ta.value = "Changed";
    ta.dispatchEvent(new w.KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
    ok("Escape finishes and keeps it", t.text === "Changed" && !et.host.querySelector("textarea.bd-type"));
    et.undo();
    ok("  and Ctrl+Z puts the old words back", et.items().find((i) => i.id === t.id).text === "Big idea\nsecond line");
    const t2 = et.items().find((i) => i.id === t.id);
    et.sel = new Set([t2.id]);
    w.dispatchEvent(new w.KeyboardEvent("keydown", {key: "Enter"}));
    ok("Enter on a selected text box types in it too", !!et.host.querySelector("textarea.bd-type"));
    et.endTyping();
    const x0 = t2.x;
    et.sel = new Set([t2.id]); et.draw();
    const hit2 = et.svg.querySelector(`[data-id="${t2.id}"]`);
    hit2.dispatchEvent(new w.MouseEvent("mousedown", {clientX: 250, clientY: 215, bubbles: true}));
    move(300, 215); up(300, 215);
    ok("dragging a selected text box still moves it (no typing)", t2.x === x0 + 50 && !et.host.querySelector("textarea.bd-type"));
  }

  /* ---- boards saved before ---- */
  const oldBoard = {name: "Old", w: 1600, h: 1000, pages: [{items: [
    {id: "a1", k: "line", x: 100, y: 100, w: -50, h: -40, stroke: "#000", sw: 2},
    {id: "a2", k: "curve", x: 100, y: 300, w: 200, h: 90, stroke: "#000", sw: 2}]}]};
  const beforeSVG = SS.BoardEditor.pageSVG(oldBoard, 0);
  ok("an old board's line is drawn where it always was, without opening it",
     /d="M50 60 L 100 100"/.test(beforeSVG), (beforeSVG.match(/d="M[^"]*"/) || [""])[0]);
  const ed3 = open(JSON.parse(JSON.stringify(oldBoard)));
  const [l3, c3] = ed3.items();
  ok("  and opened, it gets movable ends at the same place",
     JSON.stringify(l3.pts) === "[[50,60],[100,100]]" && l3.w === undefined, JSON.stringify(l3));
  ok("  an old curve becomes the same arch, now with bend points",
     c3.pts.length === 4 && JSON.stringify(c3.pts[0]) === "[100,390]" && JSON.stringify(c3.pts[3]) === "[300,390]", JSON.stringify(c3.pts));

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
