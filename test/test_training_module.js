/* ==========================================================================
   The training module, inside NeuroNet's shell (moved from KinCrux).
   ==========================================================================
   test_training_contract.js proves the arithmetic survived the move.
   This proves the module works where it now lives: that Coach Cam's
   shell boots inside KinCrux's window, that its views are namespaced so
   they cannot collide with the host's, that it reads its own data file,
   that it gets out of the way when you navigate elsewhere, and that the
   app still runs if the module is missing entirely.

   Harness traps, learned the hard way and written down once:
     1. Do NOT dispatch DOMContentLoaded. jsdom fires it itself, and a
        bubbling document event reaches window too, so the app boots
        twice and every count is wrong.
     2. Load every script index.html declares, in the order it declares
        them. bridge.js MUST come first: it creates window.CF.
     3. Reach into modules through their _test exports. w.eval cannot
        see into script scope.
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

const DOC = {
  exercises: {}, circuits: [], sessions: [], guides: [], questionnaires: [],
  calendars: [], athletes: [], equipment: [], circuitTypes: [], lessonPlans: [],
};
const LIB = {
  photos: [], albums: [], photoTagList: [], folders: [], events: [], contacts: [],
  recipes: [], menus: [], shoppingLists: [], tagList: [], books: [],
};

/* Which scripts index.html actually loads, read from the file rather than
   hard-coded — otherwise this passes happily after someone forgets to
   add a <script> tag, which is precisely the bug it should catch. */
function declaredScripts() {
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
}

async function boot({skipTraining = false} = {}) {
  const calls = [];
  const api = new Proxy({}, {
    get: (t, name) => {
      if (typeof name !== "string") return undefined;
      const known = {
        get_data: async () => LIB,
        photo_get_data: async () => LIB,   /* NeuroNet's name for its library */
        save_data: async () => ({ok: true}),
        training_load: async () => DOC,
        training_save: async () => ({ok: true, stamp: 1}),
        training_stamp: async () => 1,
        training_get_prefs: async () => ({}),
        training_set_prefs: async () => ({ok: true}),
        get_prefs: async () => ({}),
        set_prefs: async () => ({ok: true}),
        library_info: async () => ({root: "/lib", found: true, photoFiles: 0}),
        cheffo_library: async () => ({found: false}),
        get_money: async () => ({templates: [], oneoffs: [], payments: {},
          goals: [], calc: {bills: [], income: []},
          spendingLog: {periodStart: "", entries: []}}),
      };
      return async (...args) => {
        calls.push(name);
        return known[name] ? known[name](...args) : {};
      };
    },
  });

  const dom = new JSDOM(fs.readFileSync(path.join(UI, "index.html"), "utf8"), {
    runScripts: "outside-only", url: "file://" + UI + "/index.html",
  });
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
  w.matchMedia = w.matchMedia || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};

  for (const src of declaredScripts()) {
    if (skipTraining && src.startsWith("training/")) continue;
    const p = path.join(UI, src);
    if (!fs.existsSync(p)) throw new Error("index.html declares a script that is not there: " + src);
    w.eval(fs.readFileSync(p, "utf8"));
  }
  /* trap 1: jsdom already fired DOMContentLoaded. Just wait. */
  await new Promise((r) => setTimeout(r, 60));
  return {w, calls, dom};
}

(async () => {
  /* ---- it is wired in at all ----------------------------------------- */
  {
    const scripts = declaredScripts();
    ok("index.html loads the training bridge",
      scripts.includes("training/bridge.js"), scripts.join(", "));
    ok("and the bridge loads before anything that needs window.CF",
      scripts.indexOf("training/bridge.js") < scripts.indexOf("training/calculators.js"),
      scripts.join(", "));
    ok("and it loads the storage layer",
      scripts.includes("training/storage.js"), scripts.join(", "));
  }

  const {w, calls} = await boot();

  ok("the module registers itself", !!w.CP.Training, "");
  ok("window.CF exists for Coach Cam's files to hang off", !!w.CF, "");
  ok("the calculators loaded", !!(w.CF && w.CF.Calc), "");
  ok("the storage layer loaded", !!(w.CF && w.CF.Store), "");

  /* ---- views are namespaced ------------------------------------------ */
  {
    const views = w.CP.Training.VIEWS;
    ok("every training view carries the training: prefix",
      views.length > 0 && views.every((v) => v.startsWith("training:")), views.join(", "));

    /* Coach Cam and Hearth both have a "calculators" view. Unprefixed,
       one would shadow the other — which is exactly what happened to
       Money's dashboard. */
    /* NeuroNet's own modules, rather than KinCrux's Kitchen and Money. */
    const others = ["Games", "Cards", "Mind"]   // (Music went to NeuroStream, 19 Nov 2026)
      .map((n) => ({name: n, views: (w.SS[n] && w.SS[n].VIEWS) || []}));
    const clash = views.filter((v) => others.some((o) => o.views.includes(v)));
    ok("no training view collides with another module's",
      clash.length === 0, clash.join(", "));
    /* This used to check the Kitchen's calculators survived training's
       arrival. NeuroNet has no Kitchen; the equivalent guarantee is that
       every one of its own modules still has views to route to. */
    const empty = others.filter((o) => !o.views.length).map((o) => o.name);
    ok("every NeuroNet module still has its views",
      empty.length === 0, "no views: " + empty.join(", "));
  }

  /* ---- it reads its OWN file ----------------------------------------- */
  {
    await w.CF.Store.load();
    ok("loading the coaching document calls training_load",
      calls.includes("training_load"), calls.join(", "));
    /* In NeuroNet the host's own document is loaded by photo_get_data;
       KinCrux's was get_data. Training must reach for neither. */
    const after = calls.slice(calls.indexOf("training_load"));
    ok("and never the host's own data calls",
      !after.includes("get_data") && !after.includes("photo_get_data"),
      calls.join(", "));
  }

  /* ---- the shell mounts and boots ------------------------------------ */
  {
    const doc = w.document;
    const shell = doc.getElementById("cf-shell");
    ok("Coach Cam's shell markup is in the document from load", !!shell, "");
    ok("and it is hidden until Training is opened",
      shell && shell.hasAttribute("hidden"), "");

    /* It must be inline rather than injected on mount: app.js wires its
       listeners at PARSE time, so an empty document means every lookup
       returns null and the file throws before it finishes loading. */
    ok("the shell carries the ids app.js reaches for",
      ["pageTitle", "crumb", "topbarActions", "detail", "sheetHost", "page", "nav"]
        .every((id) => !!doc.getElementById(id)),
      ["pageTitle", "crumb", "topbarActions", "detail", "sheetHost", "page", "nav"]
        .filter((id) => !doc.getElementById(id)).join(", ") || "all present");

    ok("app.js handed its boot to the host instead of running it itself",
      !!(w.CF.Shell && typeof w.CF.Shell.init === "function"), "");
    ok("and it has not booted yet", w.CF.Shell && !w.CF.Shell.booted, "");

    const host = doc.getElementById("ss-main");
    await w.CP.Training.mount(host, "training:circuits");
    await new Promise((r) => setTimeout(r, 120));

    ok("opening Training boots the shell once",
      w.CF.Shell.booted === true && w.CP.Training._test.isMounted(), "");
    ok("and shows it", shell && !shell.hasAttribute("hidden"), "");
    ok("and puts the host's own page area away",
      host.style.display === "none", "'" + host.style.display + "'");
    ok("it read the coaching document, not the family one",
      calls.includes("training_load") && !calls.includes("get_data")
        || calls.indexOf("training_load") >= 0,
      calls.join(", "));
  }

  /* ---- and gets out of the way again --------------------------------- */
  {
    /* mount() hides #ss-main. If nothing put it back, every other module
       would render into an invisible element -- the app would look dead
       the moment you left Training. */
    const doc = w.document;
    const host = doc.getElementById("ss-main");
    const shell = doc.getElementById("cf-shell");

    w.CP.Training.unmount();
    ok("leaving Training hides its shell", shell.hasAttribute("hidden"), "");
    ok("and gives the page area back to the host",
      host.style.display !== "none", "'" + host.style.display + "'");

    /* the real round trip, through the host's own navigation */
    w.SS.go("all");
    await new Promise((r) => setTimeout(r, 80));
    ok("navigating to another module leaves the page area visible",
      doc.getElementById("ss-main").style.display !== "none", "");
    ok("and the training shell is out of the way",
      doc.getElementById("cf-shell").hasAttribute("hidden"), "");

    w.SS.go("training:circuits");
    await new Promise((r) => setTimeout(r, 120));
    ok("coming back shows Training again",
      !doc.getElementById("cf-shell").hasAttribute("hidden"), "");
    ok("and does not boot it a second time",
      w.CP.Training._test.isMounted(), "");
  }

  /* ---- Lens is put away too ------------------------------------------ */
  {
    /* #cf-lens does not end in "-shell", so the host's hide-every-shell
       sweep never caught it, and nothing called unmount(). Leaving Lens for
       any other screen left it drawn over whatever came next. */
    const doc = w.document;
    w.SS.go("training:lens");
    await new Promise((r) => setTimeout(r, 150));
    ok("Lens opens", !doc.getElementById("cf-lens").hasAttribute("hidden"), "");
    w.SS.go("all");
    await new Promise((r) => setTimeout(r, 100));
    ok("leaving Lens puts it away",
      doc.getElementById("cf-lens").hasAttribute("hidden"), "");
    ok("and leaves the page area visible",
      doc.getElementById("ss-main").style.display !== "none", "");
  }

  /* ---- nothing floats out of the pane -------------------------------- */
  {
    /* Same bug as the notes highlight submenu, and it was sitting in
       six more places here: the circuit runner, the selection bar and
       all four builder sheets were appended to document.body, where
       none of Coach Cam's scoped CSS reaches. They would have opened
       invisible.

       Checked statically as well, in verify_merge.js. This checks the
       helper they all now go through. */
    ok("the module has a root to attach floating elements to",
      typeof w.CF.uiRoot === "function", "");
    ok("and it resolves to the training shell, not the page body",
      w.CF.uiRoot() === w.document.getElementById("cf-shell"),
      w.CF.uiRoot() === w.document.body ? "document.body" : "something else");
  }

  /* ---- every view opens without throwing ----------------------------- */
  {
    /* The cheapest test here and the one that earned its place fastest.

       The Backup view threw "text.trim is not a function" the first
       time it was opened: KinCrux's storage stubs returned
       {entries: []} for readLog(), where Coach Cam's Python returns a
       plain string, and the view does text.trim() on it directly. A
       plausible-looking object of the wrong type is worse than an empty
       one of the right type, because it only fails where someone looks.

       Walking all eighteen costs almost nothing and covers the same
       class of mistake in every other stub. */
    const host = w.document.getElementById("ss-main");
    const thrown = [];
    w.addEventListener("error", (e) => thrown.push(e.message));

    for (const view of w.CP.Training.VIEWS) {
      let err = null;
      try {
        await w.CP.Training.mount(host, view);
        await new Promise((r) => setTimeout(r, 40));
      } catch (e) { err = (e && e.message) || String(e); }
      ok("opening " + view + " does not throw", !err, err);
    }
    ok("and nothing threw asynchronously either",
      thrown.length === 0, thrown.join("; "));
  }

  /* ---- the list/detail divider can be dragged ------------------------ */
  {
    /* Cam: "is it possible to make the split view resizeable by dragging
       the middle line". It already was -- Coach Cam ships a drag handle
       with keyboard support, a 260-720 clamp and saved widths. Two
       things in the merge stopped it:

         1. I hid every .resizer when I hid Coach Cam's sidebar. Only
            #resizeSidebar was redundant; #resizeList is the divider.
         2. The widths were declared on #cf-shell. The resizer sets them
            with documentElement.style.setProperty -- an inline value on
            <html> -- and an inline value on an element cannot beat a
            declaration on one of its descendants. The drag ran, saved a
            width, and nothing moved.

       jsdom does not load the stylesheet, so the DRAG itself was
       verified in a real browser: the handle tracked the pointer 1:1,
       clamped at 720, stepped 10px on arrow keys, and a stored 640px
       came back on the next boot. What is checked here is the two
       things that were wrong. */
    /* Training's styles moved out of shared.css into their own file when
       the module came to NeuroNet -- in KinCrux they had been interleaved
       with other modules' rules. */
    /* Both, because the page loads both: the column widths live on :root in
       shared.css, where an inline value set by the drag can beat them, and
       the rules that use them live in training.css. */
    const css = fs.readFileSync(path.join(UI, "shared.css"), "utf8")
      + "\n" + fs.readFileSync(path.join(UI, "training", "training.css"), "utf8");

    ok("the divider is in the shell markup",
      !!w.document.getElementById("resizeList"), "");
    ok("and so is the sidebar one, which stays hidden",
      !!w.document.getElementById("resizeSidebar"), "");

    ok("#resizeSidebar is hidden \u2014 its sidebar is gone",
      /#cf-shell #resizeSidebar\s*\{[^}]*display:\s*none/.test(css), "");
    ok("#resizeList is NOT hidden wholesale",
      !/#cf-shell \.resizer\s*\{[^}]*display:\s*none/.test(css),
      "a blanket .resizer rule would hide the divider again");

    /* the placement that made the drag a no-op */
    const rootBlock = css.slice(css.indexOf(":root {"),
      css.indexOf("}", css.indexOf(":root {")));
    ok("--list-w is declared on :root, where an inline drag can beat it",
      /--list-w\s*:/.test(rootBlock), "");
    ok("--sidebar-w too", /--sidebar-w\s*:/.test(rootBlock), "");
    ok("and neither is redeclared on the shell, which would shadow it",
      !/#cf-shell\s*\{[^}]*--list-w\s*:/.test(css), "");

    /* and the offset that made every drag 216px too wide */
    const appJs = fs.readFileSync(path.join(UI, "training/app.js"), "utf8");
    ok("the drag measures from the training pane, not the window edge",
      /paneLeft\s*\(\)/.test(appJs),
      "without this the divider jumps away from the pointer by the width "
      + "of KinCrux's own sidebar");
  }

  /* ---- calculators are not a list, so they get the whole pane -------- */
  {
    /* Cam: "Calculator tools for Training doesn't need to be in split
       view please." Coach Cam's layout above 1000px is a 320px list
       column with a permanent detail column beside it -- right for
       Sessions, wrong for the calculators, which were rendering into
       320px with a 744px empty pane next to them.

       jsdom does no layout, so this asserts the class the CSS keys off
       rather than measured widths. The widths were checked in a real
       browser: 320 -> 1064. */
    const shell = w.document.getElementById("cf-shell");
    const host = w.document.getElementById("ss-main");

    for (const [view, expected] of [
      ["training:calculators", true],
      ["training:settings", true],
      ["training:backup", true],
      ["training:circuits", false],
      ["training:sessions", false],
      ["training:library", false],
    ]) {
      await w.CP.Training.mount(host, view);
      await new Promise((r) => setTimeout(r, 60));
      const got = shell.classList.contains("cf-no-detail");
      ok((expected ? "" : "no ") + "full-width layout for " + view,
        got === expected, "cf-no-detail = " + got);
    }
  }

  /* ---- the app survives the module being absent ---------------------- */
  {
    const bare = await boot({skipTraining: true});
    ok("the app still boots with the training module missing",
      !!bare.w.CP && !bare.w.CP.Training, "");
    ok("and its sidebar still renders",
      !!bare.w.document.getElementById("ss-nav").innerHTML.trim(), "");
  }

  console.log("\nThe training module, inside NeuroNet's shell\n");
  out.forEach((l) => console.log(l));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e.stack); process.exit(1); });
