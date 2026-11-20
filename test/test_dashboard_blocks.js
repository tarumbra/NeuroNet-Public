/* ==========================================================================
   More than one countdown, and Puzzles opens where Cam asked
   ==========================================================================
   Cam: "On the dashboard i want to be able to add more then one countdown
   timer. At the moment i can only add one. Plus the puzzle Main section i
   want it to default to the stats page, then to access the puzzles i want
   to select from the sub section. At the moment it shows cards of all the
   puzzles when the puzzles main section is clicked on."

   ---- the countdown ----------------------------------------------------

   Adding a block offered only types that were not already on the board,
   with `frame` written in as the one exception. That is the wrong shape
   of rule. It asks "is this type already here", when the question is
   whether a second one would SAY ANYTHING DIFFERENT.

   Four block types carry their own settings -- a countdown its date, a
   notice its text, an album which album, a frame its photos -- so two of
   them are two different things: a countdown to a birthday beside a
   countdown to a holiday. The other ten draw from one source and always
   show the same thing, so a second "On this day" is the first one again
   in another square. The rule is now that distinction, and the list that
   expresses it is the same list that decides which blocks get a settings
   gear, because those are the same four for the same reason.

   THE BUG THAT CAME WITH IT, which is the part worth having a test for.
   A block's id was "b-" + Date.now().toString(36) -- the clock, nothing
   else. That was safe while a type could appear once. It is not safe now:
   the gear and the remove cross both find a block BY id, so two blocks
   sharing one would mean pressing the second countdown's cross deletes
   the first. Measured, making 500 ids the old way as fast as possible
   gives 1 unique id out of 500; the new way gives 500. Cam clicks slower
   than that, which is exactly why this would have sat there unnoticed
   until the day it lost him a block.

   ---- Puzzles ----------------------------------------------------------

   A section opened on whichever subsection was listed first, with Photos
   hardcoded by name as the exception. SECTION_META already carried a
   `first` field saying where Photos should land -- it was never read, so
   the hardcoded line did the work and the field looked functional. It is
   read now, which is what lets Puzzles say where it opens without adding
   a second name to that function.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const APP = process.argv[2] || path.join(__dirname, "..");
const UI = path.join(APP, "ui");
const read = (f) => fs.readFileSync(path.join(UI, f), "utf8");

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms || 60));

/* Registered BEFORE the app boots. A block that throws inside an async
   function -- which is how the photo frame failed -- surfaces as an unhandled
   rejection, and node kills the process on one by default: the suite saw a
   stack trace instead of a named failing check. */
const asyncFailures = [];
process.on("unhandledRejection", (reason) => {
  asyncFailures.push(String((reason && reason.message) || reason));
});

const homeSrc = read("home/home.js");
const shellSrc = read("app.js");

/* ---- the rule, read from the real file -------------------------------- */

function configurableList() {
  const m = homeSrc.match(/const CONFIGURABLE = \[([^\]]+)\]/);
  return m ? [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]) : null;
}
function blockTypes() {
  const i = homeSrc.indexOf("const BLOCK_TYPES = {");
  const j = homeSrc.indexOf("\n  };", i);
  return [...homeSrc.slice(i, j).matchAll(/^\s{4}(\w+):\s*\{/gm)].map((m) => m[1]);
}

const conf = configurableList();
const types = blockTypes();

ok("there is one list of the blocks you can set up", conf && conf.length > 0);
ok("countdown is one of them", conf && conf.includes("countdown"));
ok("  as are the other blocks that hold their own settings",
  conf && ["frame", "notice", "album"].every((t) => conf.includes(t)), String(conf));

/* The same list must drive all three places, or a fifth configurable type
   added to one and not the others is a block with a gear that does
   nothing, or one you can only ever have one of. */
ok("that list decides which blocks can be added again",
  /\.filter\(\(\[key\]\) => CONFIGURABLE\.includes\(key\) \|\| !present\.has\(key\)\)/.test(homeSrc),
  "the add dialog still filters by a hand-written exception");
ok("  and which blocks get a settings gear",
  /\$\{CONFIGURABLE\.includes\(b\.type\)/.test(homeSrc));
ok("  and no hand-written copy of it is left behind",
  !/\["frame", "countdown", "notice", "album"\]\.includes/.test(homeSrc),
  "a second copy of the list will drift from the first");

/* A block that always shows the same thing must still be once-only --
   otherwise this stopped being a rule and became "anything goes". */
const alwaysSame = types.filter((t) => !conf.includes(t));
ok("blocks that always show the same thing are still once-only",
  alwaysSame.length > 0 && alwaysSame.includes("onthisday"),
  "nothing is left that a second copy would duplicate: " + String(alwaysSame));

/* ---- the id ------------------------------------------------------------ */

ok("a new block's id is not the clock alone",
  !/id: "b-" \+ Date\.now\(\)\.toString\(36\)/.test(homeSrc),
  "two blocks made in the same millisecond would share an id, and the "
  + "gear and the remove cross both find a block by id");
ok("  it uses the id maker that already has a random part",
  /id: "b-" \+ newId\(\)/.test(homeSrc));

/* Proved rather than asserted: the old scheme really does collide. */
(() => {
  const oldWay = () => "b-" + Date.now().toString(36);
  const newWay = () => "b-x" + Date.now().toString(36)
    + Math.random().toString(36).slice(2, 7);
  const uniq = (f, n) => { const s = new Set();
    for (let i = 0; i < n; i++) s.add(f()); return s.size; };
  const oldU = uniq(oldWay, 500), newU = uniq(newWay, 500);
  ok("  and the old way demonstrably collides, which is why it changed",
    oldU < 500 && newU === 500,
    `old ${oldU}/500 unique, new ${newU}/500 — if the old way came back `
    + "clean this check proves nothing and should be rewritten, not deleted");
})();

/* ---- where a section opens --------------------------------------------- */

ok("Puzzles says where it opens",
  /games: \{[^}]*first: "games:stats"/.test(shellSrc),
  "SECTION_META for games has no first view");
ok("  and something actually reads that",
  /\(SECTION_META\[key\] \|\| \{\}\)\.first/.test(shellSrc),
  "the field existed for Photos all along and was never read, so it "
  + "looked like it worked while a hardcoded line did the job");
ok("  Photos is no longer hardcoded into it",
  !/if \(key === "photos"\) return "all";/.test(shellSrc));
ok("  and a hidden subsection cannot be opened onto",
  /kids\.some\(\(c\) => c\.key === wanted\)/.test(shellSrc),
  "hiding Stats in Settings would otherwise leave Puzzles opening on a "
  + "page that is not in the menu");
ok("Stats is still a real Puzzles subsection",
  /\{key: "games:stats", name: "Stats"\}/.test(shellSrc));

/* ---- and now as behaviour ---------------------------------------------- */

async function booted() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; source checks above still ran)"); return; }

  /* Every kind of block, in prefs BEFORE the app boots. Home reads the saved
     layout once when it mounts (that read is what makes a layout survive a
     restart), so setting it afterwards would change nothing. */
  const ALL_BLOCK_TYPES = ["today", "upcoming", "photos", "phonebook", "onthisday",
                           "countdown", "notice", "week", "album", "quickadd",
                           "frame", "music", "circuit", "quicknote",
                           "puzzle", "quickrecipe", "fleetview"];
  const prefs = {dashBlocks: ALL_BLOCK_TYPES.map((type, i) => {
    const b = {id: "b-run-" + i, type};
    if (type === "frame") { b.title = "Photo frame"; b.random = true; b.photoIds = []; b.seconds = 8; }
    if (type === "countdown") { b.title = "Countdown"; b.mode = "birthday"; }
    if (type === "notice") { b.title = "Notice board"; b.text = ""; }
    if (type === "album") { b.title = "Album"; b.albumId = null; }
    return b;
  })};
  const saved = {};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => JSON.parse(JSON.stringify(prefs)),
    set_prefs: async (p) => { Object.assign(prefs, p || {}); return {ok: true}; },
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    music_write_json: async () => ({ok: true}),
    chords_list: async () => [],
    cards_read_json: async () => ({tarotDecks: [], oracleDecks: [], lenormandDecks: [],
      tarotReadings: [], oracleReadings: [], lenormandReadings: [],
      meditation: [], journal: [], gratitude: []}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    kc_available: async () => true,
    kc_get_data: async () => ({photos: [], albums: [], photoTagList: [], folders: [],
      events: [], contacts: [], recipes: [], menus: [], shoppingLists: [],
      books: [], tagList: []}),
    kc_save_data: async (d) => { saved.data = d; return {ok: true}; },
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {}, goals: [],
      spendingLog: {periodStart: "", entries: []}, calc: {bills: [], income: []}}),
    kc_save_money: async () => ({ok: true}),
    kc_money_stamp: async () => 0,
    training_load: async () => ({exercises: {}, circuits: [], sessions: [], guides: [],
      questionnaires: [], calendars: [], athletes: [], equipment: [],
      circuitTypes: [], lessonPlans: []}),
    training_save: async () => ({ok: true}),
    training_stamp: async () => 0,
    training_get_prefs: async () => ({}),
    training_set_prefs: async () => ({ok: true}),
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    notes_list_tree: async () => [],
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}),
    boards_list: async () => [], cells_list: async () => [],
    notebooks_list: async () => [],
    fleeting_list: async () => [],
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

  /* ---- every block type is RUN, not read ------------------------------

     Cam: "when adding a photo frame to the dashboard it gets stuck on
     loading and no photo appears." advanceFrame called framePhotosFor on
     its first line; that function never came across when Home was lifted
     out of KinCrux, so the frame threw before it could draw and sat on
     "Loading..." for ever. Two earlier sweeps of the source missed it --
     one matched "function x(" only, the next added "async function x(",
     and fileNameOf is a const arrow that neither looked for.

     So this does not read the source. It DRAWS every kind of block and
     watches for a thrown error, which is the thing that actually goes
     wrong and the only check that cannot be outwitted by a name written
     in a new shape. */
  {
    const thrown = [];
    w.addEventListener("error", (e) => thrown.push(String(e.message || e)));
    /* A block that throws inside an async function -- which is how the photo
       frame failed -- surfaces as an unhandled rejection and takes the whole
       process down with it. Caught here so the suite reports WHICH block
       broke instead of printing a stack trace and stopping. */
    w.addEventListener("unhandledrejection", (e) =>
      thrown.push("unhandled: " + String((e.reason && e.reason.message) || e.reason)));
    const original = w.console.error;
    w.console.error = (...a) => { thrown.push(a.map(String).join(" ")); };

    const types = ALL_BLOCK_TYPES;
    w.SS._test._setView("home:dashboard");
    w.SS._test.render();
    await wait(1200);

    /* .dash-block, not any [data-block]: the music block's own tabs carry
       that attribute too, so the looser selector counted 16 of 14. */
    const drawn = w.document.querySelectorAll(".dash-block[data-block]").length;
    const broke = [...thrown, ...asyncFailures];
    ok("every kind of block draws without throwing", broke.length === 0,
      broke.slice(0, 3).join(" | "));
    ok("  and all of them are on the page, but a saved Music widget (gone to NeuroStream, 19 Nov 2026) is left out", drawn === types.length - 1,
      drawn + " of " + types.length);

    /* The photo frame specifically: it must get PAST "Loading...". */
    const frame = w.document.querySelector("[data-frame]");
    await wait(800);
    ok("the photo frame gets past Loading",
      !!frame && !/Loading/.test(frame.innerHTML),
      frame ? frame.innerHTML.slice(0, 60) : "no frame block");
    w.console.error = original;
  }

  /* Puzzles opens where Cam asked. Clicked, not called, because what he
     described is clicking the section in the left menu. */
  const nav = [...w.document.querySelectorAll("#ss-nav [data-section]")]
    .find((e) => e.dataset.section === "games");
  ok("the Puzzles section is in the menu", !!nav);
  if (nav) {
    nav.click();
    await wait(500);
    /* SS._test.view is a getter, not a function -- reading it as a call
       threw, and a thrown check is not a passing one. */
    const view = w.SS && w.SS._test ? w.SS._test.view : null;
    const crumb = (w.document.querySelector("#ss-crumb") || {}).textContent || "";
    ok("clicking Puzzles opens Stats, not the grid of every puzzle",
      /Stats/.test(crumb) || view === "games:stats",
      "landed on: " + (view || crumb));
    ok("  and All puzzles is still there to choose",
      [...w.document.querySelectorAll("#ss-subnav-body [data-view]")]
        .some((e) => e.dataset.view === "games:home"),
      "it was not removed, only stopped being the landing page");
  }

  /* The dashboard offers Countdown again once one is already on it. */
  w.SS.go("home:dashboard");
  await wait(700);
  const edit = w.document.querySelector("#dash-edit");
  ok("the dashboard has an edit mode", !!edit);
  if (edit) {
    edit.click();
    await wait(250);
    const add = w.document.querySelector("#dash-add");
    ok("  with a way to add a block", !!add);
    if (add) {
      let seen = 0;
      for (let round = 1; round <= 2; round++) {
        w.document.querySelector("#dash-add").click();
        await wait(300);
        const opt = w.document.querySelector('[data-add="countdown"]');
        ok(`Countdown is offered when ${seen} are already on the board`, !!opt,
          "this is the whole ask: it used to disappear after the first");
        if (!opt) break;
        opt.click();
        await wait(400);
        const save = [...w.document.querySelectorAll("button")]
          .find((b) => b.textContent.trim() === "Save");
        if (save) { save.click(); await wait(400); }
        seen = w.document.querySelectorAll(".countdown-card").length;
        if (!w.document.querySelector("#dash-add")) {
          const e2 = w.document.querySelector("#dash-edit");
          if (e2) { e2.click(); await wait(250); }
        }
      }
      ok("two countdowns end up on the dashboard", seen >= 2, "there are " + seen);
      /* .dash-block: the music block's tabs carry data-block as well, and
         three tabs pointing at one block are not three blocks. */
      const ids = [...w.document.querySelectorAll(".dash-block[data-block]")]
        .map((e) => e.dataset.block);
      ok("  and every block on it has an id of its own",
        new Set(ids).size === ids.length,
        "two blocks sharing an id means the wrong one gets removed");
    }
  }
}

booted().catch((e) => { fail++; out.push("  FAIL  booting threw: " + e.message); })
  .then(() => {
    console.log("\ntest_dashboard_blocks.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
