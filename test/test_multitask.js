/* ==========================================================================
   Multitask — two main sections side by side
   ==========================================================================
   Cam: "lets build a Multitask mode (Found as a icon on the top right of the
   top bar in the app) ... splitting the workspace into 2. Then i drag and
   drop the respective mainsection into the respective side. When opened in
   the side it won't have a left hand side bar but will have a collapsed
   version of the right side bar with the subsections. F9 function should
   work in this view as well but F8 should be used as the shortcut to hide
   the sidebars in the split windows ... When changing sub section or app on
   one side i don't want the other side to reset ... I want the active side
   to have a 1px highlight around it that matches the selected theme."

   Driven the way Cam drives it: the top-bar button, dragging a menu card,
   clicking a side's own strip, F8 and F9.
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
process.on("unhandledRejection", (reason) => {
  asyncFailures.push(String((reason && reason.message) || reason));
});

async function run() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; nothing here can run without it)"); return; }

  const prefs = {dashBlocks: [
    {id: "b-pz", type: "puzzle", col: 0, slot: 0},
    {id: "b-qr", type: "quickrecipe", col: 1, slot: 0},
    {id: "b-fv", type: "fleetview", col: 2, slot: 0},
    {id: "b-qn", type: "quicknote", col: 2, slot: 1},
  ]};
  /* A fleeting queue that behaves like the backend's: deleting one closes
     the numbers up behind it. */
  let fleeting = [
    {n: 1, text: "first thought", written: 1790000000},
    {n: 2, text: "second thought\n" + "a long line. ".repeat(80), written: 1790000100},
    {n: 3, text: "third thought", written: 1790000200},
  ];
  const deleted = [];
  const kitchenSaves = [];
  const kitchenDoc = {photos: [], albums: [], photoTagList: [], folders: [],
    events: [], contacts: [], recipes: [], menus: [], shoppingLists: [],
    books: [], tagList: []};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => JSON.parse(JSON.stringify(prefs)),
    set_prefs: async (p) => { Object.assign(prefs, p || {}); return {ok: true}; },
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    kc_available: async () => true,
    kc_get_data: async () => kitchenDoc,
    kc_save_data: async (d) => { kitchenSaves.push(JSON.parse(JSON.stringify(d))); return {ok: true}; },
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {}, goals: [],
      spendingLog: {periodStart: "", entries: []}, calc: {bills: [], income: []}}),
    training_load: async () => ({exercises: {}, circuits: [], sessions: [], guides: [],
      questionnaires: [], calendars: [], athletes: [], equipment: [],
      circuitTypes: [], lessonPlans: []}),
    training_get_prefs: async () => ({}),
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    notes_list_tree: async () => [],
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}),
    boards_list: async () => [], cells_list: async () => [],
    notebooks_list: async () => [],
    fleeting_list: async () => JSON.parse(JSON.stringify(fleeting)),
    fleeting_add: async (text) => {
      const n = fleeting.length + 1;
      fleeting.push({n, text, written: 1790000300});
      return {ok: true, n};
    },
    fleeting_delete: async (n) => {
      deleted.push(n);
      fleeting = fleeting.filter((x) => x.n !== n).map((x, i) => ({...x, n: i + 1}));
      return {ok: true};
    },
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only",
                               url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia
    || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {},
    lineTo() {}, stroke() {}, fill() {}, save() {}, restore() {},
    translate() {}, scale() {}, createLinearGradient: () => ({addColorStop() {}}),
    setTransform() {}, closePath() {}, getImageData: () => ({data: [0, 0, 0, 255]}),
  });
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(900);

  const thrown = [];
  w.addEventListener("error", (e) => thrown.push(String(e.message || e)));
  w.addEventListener("unhandledrejection", (e) =>
    thrown.push("unhandled: " + String((e.reason && e.reason.message) || e.reason)));
  const doc = w.document, MTa = w.SS.Multitask;
  const press = (el) => el.dispatchEvent(new w.Event("pointerdown", {bubbles: true}));
  const key = (k) => w.dispatchEvent(new w.KeyboardEvent("keydown", {key: k, bubbles: true}));
  const shownIn = (p) => [...p.querySelectorAll('[id$="-shell"], #cf-lens')]
    .filter((x) => !x.hidden).map((x) => x.id);

  w.SS.go("home:dashboard");
  await wait(900);

  /* ---- the button --------------------------------------------------------- */
  const btn = doc.getElementById("ss-multitask");
  ok("the Multitask button is on the top bar", !!btn && !!btn.closest("#ss-topbar"));
  const css = fs.readFileSync(path.join(UI, "multitask.css"), "utf8");
  ok("  drawn in the theme's accent, not in a section icon's tinted tile",
    /#ss-multitask, #ss-snip \{[^}]*color: var\(--accent\)/.test(css) && !btn.querySelector(".ss-card-ic"));   // (Snip shares it, 15 Nov 2026)
  btn.click();
  await wait(700);
  const panes = [...doc.querySelectorAll(".mt-pane")];
  ok("pressing it splits the workspace in two", MTa.on && panes.length === 2);
  ok("  what was open stays open, on the left", MTa.views[0] === "home:dashboard"
    && !!panes[0].querySelector(".ss-home .dash-blocks"));
  ok("  and the other side asks for a section", /Drag a section here/.test(panes[1].textContent));
  ok("  the button shows it is on", btn.classList.contains("on"));

  /* ---- no left bar in a side, a collapsed strip of subsections instead ---- */
  ok("a side has no left-hand bar of its own", !panes[0].querySelector("#ss-nav, .mt-nav"));
  const strip0 = panes[0].querySelectorAll(".mt-subnav [data-view]");
  ok("  but a strip of its section's subsections", strip0.length >= 3);
  ok("  each named for the hover", [...strip0].every((b) => b.title.length > 1));
  ok("  collapsed to icons", /\.mt-subnav \.ss-card > :not\(\.ss-card-ic\) \{ display: none; \}/.test(css));

  /* ---- dragging a main section onto a side --------------------------------- */
  /* With the RIGHT button held (Cam: "holding the right mouse button over an
     icon is used when rearranging"). jsdom has no layout, so it is told what
     is under the pointer. */
  const card = doc.querySelector('#ss-nav [data-drag="training"]');
  const sideBody = panes[1].querySelector(".mt-body");
  const realFromPoint = doc.elementFromPoint;
  doc.elementFromPoint = () => sideBody;
  const mouse = (el, type, o) => el.dispatchEvent(new w.MouseEvent(type,
    Object.assign({bubbles: true, cancelable: true}, o)));
  mouse(card, "mousedown", {button: 2, buttons: 2, clientX: 10, clientY: 10});
  mouse(doc, "mousemove", {button: 2, buttons: 2, clientX: 400, clientY: 300});
  ok("dragging a menu card over a side offers it as a drop",
    panes[1].classList.contains("is-drop"));
  mouse(doc, "mouseup", {button: 2, buttons: 0, clientX: 400, clientY: 300});
  doc.elementFromPoint = realFromPoint;
  await wait(1500);
  ok("  and dropping it opens that section on that side", /^training:/.test(MTa.views[1]), MTa.views.join(" | "));
  ok("  in its own shell, inside that side", shownIn(panes[1]).includes("cf-shell"));
  ok("  leaving the other side exactly where it was", MTa.views[0] === "home:dashboard"
    && !!panes[0].querySelector(".dash-blocks"));

  /* ---- the sides are independent ------------------------------------------- */
  const leftGrid = panes[0].querySelector(".dash-blocks");
  const strip1 = panes[1].querySelectorAll(".mt-subnav [data-view]");
  const target = strip1[1];
  press(target); target.click();
  await wait(900);
  ok("a side's own strip changes that side's subsection", MTa.views[1] === target.dataset.view,
    MTa.views[1] + " vs " + target.dataset.view);
  ok("  and the other side is not redrawn -- the very same elements",
    panes[0].querySelector(".dash-blocks") === leftGrid);

  /* ---- active side ------------------------------------------------------------ */
  ok("the side in use is the active one", MTa.active === 1 && panes[1].classList.contains("is-active")
    && !panes[0].classList.contains("is-active"));
  ok("  outlined by 1px in the theme's accent",
    /\.mt-pane\.is-active::before \{ border-color: var\(--accent\); \}/.test(css)
    && /\.mt-pane::before \{[^}]*border: 1px solid/.test(css));
  press(panes[0]);
  ok("pressing the other side makes it active", MTa.active === 0);
  ok("  and the shared right-hand menu follows it",
    doc.getElementById("ss-subnav-title").textContent === "Home");
  doc.querySelector('#ss-subnav [data-view="home:calendar"]').click();
  await wait(600);
  ok("  so its entries change THAT side", MTa.views[0] === "home:calendar" && /^training:/.test(MTa.views[1]));

  /* ---- F8 and F9 ---------------------------------------------------------------- */
  key("F8");
  ok("F8 hides the active side's strip", panes[0].classList.contains("subnav-hidden"));
  ok("  and only that side's", !panes[1].classList.contains("subnav-hidden"));
  key("F9");
  const app = doc.getElementById("ss-app");
  ok("F9 still hides every other bar", app.classList.contains("bars-hidden"));
  ok("  leaving the sides' strips to F8", !panes[1].classList.contains("subnav-hidden"));
  key("F9"); key("F8");
  ok("both come back", !app.classList.contains("bars-hidden") && !panes[0].classList.contains("subnav-hidden"));
  ok("the bars outside the workspace stay while Multitask is on",
    !app.classList.contains("bars-hidden") && !!doc.querySelector("#ss-nav [data-drag]"));

  /* ---- one section, one side ------------------------------------------------- */
  const tv = MTa.views[1];
  MTa.open(0, "training");
  await wait(1500);
  ok("dropping a section that is on the other side swaps the two sides",
    MTa.views[0] === tv && /^home:/.test(MTa.views[1]), MTa.views.join(" | "));
  ok("  and each shell moves with its section", shownIn(panes[0]).includes("cf-shell")
    && !shownIn(panes[1]).includes("cf-shell"));
  ok("Divination and Mindfulness count as one (they are one module)",
    MTa.clash("div:tarot", "mind:breathwork") && !MTa.clash("div:tarot", "training:sessions"));

  /* ---- every section, on either side, beside another ------------------------ */
  const sections = ["photos", "training", "stuff", "games", "divination", "mind",
                    "cookery", "money", "notes", "creative", "settings", "home"];      // stuff = M&T (Music within)
  const bad = [];
  for (const side of [0, 1]) {
    for (const sec of sections) {
      const before = thrown.length + asyncFailures.length;
      MTa.open(1 - side, sec === "home" ? "photos" : "home"); await wait(400);
      MTa.open(side, sec); await wait(700);
      const p = panes[side];
      const drawn = [p.querySelector(".mt-host")].concat(shownIn(p).map((id) => doc.getElementById(id)))
        .filter((el) => el && el.style.display !== "none")
        .map((el) => el.textContent.trim()).join("").length;
      const strays = shownIn(panes[1 - side]).length;
      if (!drawn || thrown.length + asyncFailures.length > before || strays) {
        bad.push(`${sec} on side ${side}: drawn ${drawn}, errors ${thrown.length + asyncFailures.length - before}, stray shells ${strays}`);
      }
    }
  }
  ok("every main section draws on either side, beside another", !bad.length, bad.slice(0, 3).join(" | "));
  const pairs = [["training", "stuff"], ["notes", "games"], ["divination", "training"], ["stuff", "notes"]];
  const pairBad = [];
  for (const [a, b] of pairs) {
    MTa.open(0, a); await wait(700); MTa.open(1, b); await wait(800);
    if (!shownIn(panes[0]).length || !shownIn(panes[1]).length) pairBad.push(a + "+" + b);
  }
  ok("two sections that bring their own shells show side by side", !pairBad.length, pairBad.join(", "));

  /* ---- a link to a module open on the other side ---------------------------- */
  /* Cam: "in multitasking mode i would like to be able to have 2 instances of
     the same main section open ... an ebook open on one side and the vault on
     the other side so i can take notes at the same time." What cannot be in
     two places is a MODULE (one shell, one state) -- so a link to another
     screen of the module open over there still goes over there... */
  MTa.open(0, "home"); await wait(700); MTa.open(1, "training"); await wait(900);
  const tOther = w.CP.Training.VIEWS.find((v) => v !== MTa.views[1] && !/:(lens|session)/.test(v));
  press(panes[0]);
  w.SS.go(tOther);
  await wait(700);
  ok("a link to a module already open on the other side goes to that side",
    MTa.active === 1 && MTa.views[1] === tOther && /^home:/.test(MTa.views[0]),
    tOther + " -> " + MTa.views.join(" | ") + " active " + MTa.active);

  /* ...while another part of the same main section opens right here. */
  MTa.open(0, "home"); await wait(700); MTa.open(1, "notes"); await wait(900);
  press(panes[0]);
  w.SS.go("fleeting:list");
  await wait(700);
  ok("two parts of one main section sit side by side",
    MTa.views[0] === "fleeting:list" && MTa.views[1] === "notes:vault",
    MTa.views.join(" | ") + " active " + MTa.active);
  press(panes[0]);
  w.SS.go("ebooks:library");
  await wait(700);
  ok("  an ebook on one side, the Vault on the other",
    MTa.views[0] === "ebooks:library" && MTa.views[1] === "notes:vault"
      && !!panes[0].querySelector(".ss-ebooks")
      && shownIn(panes[1]).includes("cx-shell"),
    MTa.views.join(" | ") + " shells right: " + shownIn(panes[1]).join(","));
  /* Dropping Notes on the left while the Vault is on the right opens the
     next part of Notes that can sit beside it, rather than swapping. */
  MTa.open(0, "notes"); await wait(900);
  ok("  dropping Notes beside the Vault opens another part of Notes",
    w.SS.sectionName && MTa.views[1] === "notes:vault" && MTa.views[0] && MTa.views[0] !== "notes:vault"
      && /^(boards|cells|fleeting|books|ebooks|guides):/.test(MTa.views[0]),
    MTa.views.join(" | "));

  /* ---- responsive --------------------------------------------------------------- */
  ok("each side is a container its contents lay out against",
    /\.mt-body \{[^}]*container: mtpane \/ inline-size/.test(css));
  ok("  the divider only resizes, and is remembered",
    !!doc.querySelector(".mt-gutter") && /--mt-ratio/.test(css));
  ok("  Training measures its side, not the window",
    /inNarrowSide\(\)/.test(fs.readFileSync(path.join(UI, "training/app.js"), "utf8")));

  /* ---- leaving -------------------------------------------------------------------- */
  press(panes[1]);
  const keep = MTa.views[1];
  btn.click();
  await wait(900);
  ok("pressing the button again leaves Multitask", !MTa.on && !doc.getElementById("mt-root"));
  ok("  on the side that was active", w.SS._test.view === keep, w.SS._test.view + " vs " + keep);
  ok("  and every shell is back where it lives",
    [...doc.querySelectorAll('[id$="-shell"], #cf-lens')].every((el) => el.parentNode.id === "ss-stage"));
  btn.click();
  await wait(900);
  ok("coming back brings the last layout back", MTa.on && MTa.views[1] !== "");
  btn.click();
  await wait(500);

  const broke = [...thrown, ...asyncFailures];
  ok("nothing threw along the way", broke.length === 0, broke.slice(0, 3).join(" | "));
}

run().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_multitask.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
