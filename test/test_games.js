/* ==========================================================================
   Cranium inside NeuroNet.
   ==========================================================================
   Cam: "there are no cranium games".

   Two very different things are checked here, and the second is the one
   that would be expensive to lose.

   1. THE PORT DID NOT BREAK THE SHELL. Cranium brought its own chrome
      and its own generic DOM ids -- #app, #sidebar, #content, #toasts,
      #modal-veil -- every one of which NeuroNet also has. It also
      declared `$`, `data`, `view`, `toast`, `render` and `go` at top
      level, which NeuroNet declares too; a duplicate top-level const
      is a SyntaxError that kills the file outright. So: both apps still
      have their own everything, and neither one's styling leaks.

   2. THE ENGINES STILL RUN HEADLESS. This is Cranium's best property
      and the reason its generators can be trusted: every puzzle engine
      knows nothing about the DOM, so "this Sudoku has exactly one
      solution" is a thing a test can actually assert rather than a
      claim in a comment. The port moved them off `window` into a local
      namespace, which is exactly the kind of change that could have
      quietly broken it -- so the generators are run here, with no
      document at all, and their output checked.
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

function declaredScripts() {
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
}

async function boot() {
  const saved = [];
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [],
                                  photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => ({}),
    set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_save_data: async (d) => { saved.push(d); return {ok: true}; },
    cranium_get_prefs: async () => ({}),
    cranium_set_prefs: async () => ({ok: true}),
  };
  const api = new Proxy({}, {
    get: (t, n) => (typeof n === "string"
      ? async (...a) => (known[n] ? known[n](...a) : {})
      : undefined),
  });
  const dom = new JSDOM(fs.readFileSync(path.join(UI, "index.html"), "utf8"),
    {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  /* Browser pieces jsdom lacks. NeuroNet now starts the music player at
     launch (the app-wide bar needs it), so every suite that boots the app
     meets the visualiser -- copied from test_modules.js so all suites fake
     the browser the same way. */
  w.matchMedia = w.matchMedia
    || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  /* jsdom has neither of these. They are jsdom's gaps, not the app's --
     Chromium runs the visualizer fine -- so they are stubbed rather
     than worked around in the app. */
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
  w.pywebview = {api};
  w.matchMedia = w.matchMedia
    || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  for (const src of declaredScripts()) {
    w.eval(fs.readFileSync(path.join(UI, src), "utf8"));
  }
  await new Promise((r) => setTimeout(r, 250));
  return {w, saved};
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms || 80));

(async () => {
  /* ==================================================================
     1. THE ENGINES, WITH NO DOCUMENT AT ALL
     ================================================================== */
  {
    /* Just the engine block, lifted out of the bundle and run in a
       function scope of its own. Not the jsdom window: the whole claim
       is that these files never touch a document, so they are run
       somewhere there isn't one. If the port had made them depend on
       the DOM this throws, rather than quietly passing. */
    const src = fs.readFileSync(path.join(UI, "games", "cranium.js"), "utf8");
    const from = src.indexOf("const CRG = {};");
    const to = src.indexOf("/* The screens below refer to these by bare name. */");
    const engineSrc = src.slice(from, to);

    let CRG = null, threw = null;
    try {
      // eslint-disable-next-line no-new-func
      CRG = new Function(engineSrc + "\nreturn CRG;")();
    } catch (e) { threw = e; }

    ok("the puzzle engines load with no document in sight",
      !threw && CRG, threw && threw.message);

    CRG = CRG || {};
    // 15 Nov 2026: Lights Out and Hitori removed (Cam: "puzzles feels bloated")
    // 15 Nov 2026: Peg Solitaire and Mastermind removed too
    ok("  and all the engines are there",
      Object.keys(CRG).length >= 15 && !!CRG.Sudoku && !!CRG.Kakuro && !!CRG.Hangman && !!CRG.WordGuess && !CRG.LightsOut && !CRG.Hitori && !CRG.PegSolitaire && !CRG.Mastermind, Object.keys(CRG).length + " found");

    ok("  none of them landed on window",
      typeof global.Sudoku === "undefined" && typeof global.Memory === "undefined"
      && typeof global.Sliding === "undefined",
      "Memory, Sliding, Simon and Jigsaw were collisions waiting to happen");

    /* THE claim worth testing, and the reason the headless split is
       worth preserving at all: a generated Sudoku has EXACTLY ONE
       solution. A generator that just blanks cells at random produces
       genuinely ambiguous puzzles that cannot be solved by reasoning --
       the single most common way a home-made one is quietly broken.
       The engine exports countSolutions, so this is checkable rather
       than a claim in a comment. */
    if (CRG.Sudoku) {
      let cellsOk = true, uniqueOk = true, solvedOk = true;
      for (const level of ["easy", "medium", "hard", "expert"]) {
        const {puzzle, solution} = CRG.Sudoku.generate(level);
        if (puzzle.length !== 81 || solution.length !== 81) cellsOk = false;
        if (CRG.Sudoku.countSolutions(puzzle, 2) !== 1) uniqueOk = false;
        for (let r = 0; r < 9; r++) {
          if (new Set(solution.slice(r * 9, r * 9 + 9)).size !== 9) solvedOk = false;
        }
        for (let c = 0; c < 9; c++) {
          const col = new Set();
          for (let r = 0; r < 9; r++) col.add(solution[r * 9 + c]);
          if (col.size !== 9) solvedOk = false;
        }
      }
      ok("a generated Sudoku is a real 81-cell grid at every difficulty",
        cellsOk, "");
      ok("  its solution is valid — every row AND column holds 1-9",
        solvedOk, "");
      ok("  and the puzzle has EXACTLY ONE solution, not merely a solution",
        uniqueOk,
        "an ambiguous puzzle cannot be solved by reasoning; this is the "
        + "property the headless engine split exists to make testable");
    }

    if (CRG.Minesweeper) {
      /* Two wrong premises before this one. `mines` is a COUNT, not an
         array -- the cells live in `mine`. And the board comes back
         with ZERO mines placed, which looked like a bug and is the
         point: Minesweeper is FIRST-CLICK-SAFE, so it does not lay the
         mines until you reveal a cell, and then lays them around it.
         That is the property worth testing, so that is what is tested:
         a hundred boards, and the first cell clicked is never a mine. */
      const fresh = CRG.Minesweeper.create("easy");
      ok("a new Minesweeper board is the right size",
        fresh && fresh.mine.length === fresh.rows * fresh.cols,
        JSON.stringify({rows: fresh && fresh.rows, cols: fresh && fresh.cols}));
      ok("  and lays no mines until the first click",
        fresh.mine.filter(Boolean).length === 0 && fresh.seeded === false,
        fresh.mine.filter(Boolean).length + " placed before any click");

      let everDead = false, alwaysSeeded = true, countOk = true;
      for (let i = 0; i < 100; i++) {
        const g = CRG.Minesweeper.create("easy");
        const cell = Math.floor(Math.random() * g.rows * g.cols);
        CRG.Minesweeper.reveal(g, cell);
        if (g.mine[cell]) everDead = true;
        if (!g.seeded) alwaysSeeded = false;
        if (g.mine.filter(Boolean).length !== g.mines) countOk = false;
      }
      ok("  the FIRST cell clicked is never a mine, over 100 boards",
        !everDead,
        "losing on the first click is the thing first-click-safe exists "
        + "to prevent");
      ok("  and the mines are laid on that click, all of them",
        alwaysSeeded && countOk, "");
    }
    if (CRG.Kakuro && CRG.Futoshiki && CRG.Nonogram) {
      let generated = true;
      try {
        CRG.Kakuro.generate && CRG.Kakuro.generate("easy");
        CRG.Futoshiki.generate && CRG.Futoshiki.generate("easy");
        CRG.Nonogram.generate && CRG.Nonogram.generate("easy");
      } catch (e) { generated = e.message; }
      ok("the other three generators run headless too",
        generated === true, generated);
    }
  }

  /* ==================================================================
     2. THE PORT, IN A DOCUMENT SHARED WITH THE HOST
     ================================================================== */
  const {w, saved} = await boot();
  const doc = w.document;

  ok("the games module registers itself with the host",
    w.SS.Games && Array.isArray(w.SS.Games.VIEWS), typeof w.SS.Games);
  // 14 Nov 2026 (V30): Solitaire, Pyramid and Colour by Numbers joined from Cam's Collective
  // 15 Nov 2026: Lights Out and Hitori removed
  ok("  and offers all sixteen games",
    w.SS.Games.games.length === 16 && !w.SS.Games.games.some((g) => /lights|hitori|peg|mastermind/i.test((g.key || g.id) + g.name)),
    w.SS.Games.games.length);

  /* Both apps must still have their own everything. */
  for (const [host, ported] of [["ss-main", "cr-content"],
                                ["toasts", "cr-toasts"],
                                ["modal-veil", "cr-modal-veil"],
                                ["ss-sidebar", "cr-sidebar"]]) {
    ok(`#${host} and #${ported} both exist — neither app took the other's`,
      !!doc.getElementById(host) && !!doc.getElementById(ported),
      `${host}:${!!doc.getElementById(host)} ${ported}:${!!doc.getElementById(ported)}`);
  }

  ok("the host's own names survived loading Cranium",
    typeof w.SS._test.render === "function" && !!w.SS.shared,
    "a duplicate top-level const would have killed one of the two files");

  /* The shell starts away and comes back when you leave. */
  const shell = doc.getElementById("cr-shell");
  ok("Cranium's shell starts hidden", shell.hidden === true, shell.hidden);

  await w.SS.Games.mount(doc.getElementById("ss-main"), "games:home");
  await wait(400);
  ok("opening Games shows it", shell.hidden === false, "");
  ok("  and the games are on screen",
    /Sudoku/.test(doc.getElementById("cr-content").textContent)
    && /Kakuro/.test(doc.getElementById("cr-content").textContent),
    doc.getElementById("cr-content").textContent.slice(0, 80));

  w.SS._test._setView("all");
  w.SS._test.render();
  await wait(200);
  ok("going back to the photo library puts Cranium away again",
    shell.hidden === true,
    "two shells on screen at once, or the photos hidden behind a game");

  /* The data goes to Cranium's OWN file, through its OWN method. */
  {
    const calls = [];
    const realApi = w.pywebview.api;
    w.pywebview.api = new Proxy({}, {
      get: (t, n) => (typeof n === "string"
        ? async (...a) => { calls.push(n); return realApi[n](...a); }
        : undefined),
    });
    await w.SS.Games.mount(doc.getElementById("ss-main"), "games:stats");
    await wait(250);
    ok("Cranium reads through its NAMESPACED backend method",
      !calls.includes("get_data") && !calls.includes("save_data"),
      calls.join(", ") + " — a generic save_data here would overwrite "
      + "the photo library's file");
    w.pywebview.api = realApi;
  }

  /* ---- hidden must actually hide --------------------------------
     Cam: "when change to something else it forces split screen".

     `hidden` is an attribute whose only effect is display:none from the
     BROWSER's stylesheet, and any id-selector display rule beats it.
     So #cr-shell { display: flex } silently cancelled hidden: the shell
     kept its flex share, the host's page area took the rest, and the
     two sat side by side. Measured: hidden === true, box 546x900.

     jsdom does not lay anything out, so this is checked in the CSS
     source rather than the geometry: every shell that declares a
     display must also declare the [hidden] form. */
  {
    const files = fs.readdirSync(path.join(UI))
      .filter((f) => f.endsWith(".css"))
      .map((f) => path.join(UI, f));
    for (const dir of ["games", "music", "cards"]) {
      const d = path.join(UI, dir);
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d)) {
        if (f.endsWith(".css")) files.push(path.join(d, f));
      }
    }
    const offenders = [];
    for (const file of files) {
      const css = fs.readFileSync(file, "utf8");
      for (const m of css.matchAll(/(#[\w-]*-shell)\s*\{([^}]*)\}/g)) {
        if (!/display\s*:/.test(m[2])) continue;
        const esc = m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(esc + "\\[hidden\\]").test(css)) {
          offenders.push(`${m[1]} in ${path.basename(file)}`);
        }
      }
    }
    ok("every ported shell's [hidden] beats its own display rule",
      offenders.length === 0,
      offenders.length
        ? offenders.join("; ") + " — hidden will not hide it, and the "
          + "host's page area will sit beside it in a split screen"
        : files.length + " stylesheets checked");
  }

  console.log("\nNeuroNet — Cranium's games\n");
  out.forEach((l) => console.log(l));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e.stack); process.exit(1); });
