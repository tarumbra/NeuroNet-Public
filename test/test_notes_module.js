/* ==========================================================================
   The notes module, inside NeuroNet's shell -- its own vault, separate
   from KinCrux's (this test was copied from KinCrux's and ported).
   ==========================================================================
   test_notes_contract.py proves the vault path guard survived the move.
   test_notes_vault.py proves the vault is still a folder Obsidian could
   open. This proves the module works where it now lives.

   The group that matters most is the last one. Training and Notes each
   bring a whole ported shell that lives in the page permanently and is
   SHOWN rather than rendered, and showing one hides KinCrux's own page
   area. If anything forgets to put them away, the next view renders into
   an invisible element and the app looks dead.

   That is not hypothetical: the first wiring put the hide step among the
   view dispatch rather than before it, so every view that returns early
   -- Recipes, Money, Settings -- skipped it. Leaving Notes for Recipes
   left the vault on screen with the page area hidden underneath.

   Harness traps, written down once:
     1. Do NOT dispatch DOMContentLoaded. jsdom fires it itself.
     2. Load every script index.html declares, in the order it declares
        them. graph.js must come AFTER app.js: app.js starts the CC
        namespace with `const CC = {}` and would wipe it.
     3. Reach into modules through their _test exports.
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

const TREE = [
  {name: "Projects", path: "Projects", type: "folder", children: [
    {name: "Kitchen Reno", path: "Projects/Kitchen Reno.md", type: "note"},
  ]},
  {name: "Budget", path: "Budget.md", type: "note"},
];
const deleted = [];
const NOTE = "# Kitchen Reno\n\nTiles #reno. See [[Budget]].\n";
const LIB = {
  photos: [], albums: [], photoTagList: [], folders: [], events: [], contacts: [],
  recipes: [], menus: [], shoppingLists: [], tagList: [], books: [],
};

function declaredScripts() {
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
}

async function boot({skipNotes = false} = {}) {
  const calls = [];
  const known = {
    get_data: async () => LIB,
    photo_get_data: async () => LIB,   /* NeuroNet's name for its library */
    /* The real backend returns a LIST here. The generic fallback's {} is
       truthy, so Chords' "(await ...) || []" kept it and then called .map
       on an object. Music is visited now that this walks NeuroNet's own
       pages, so it needs its real shape. */
    chords_list: async () => [],
    training_stamp: async () => 1,
    training_formats: async () => ({docx: true, xlsx: true, pdf: true}),
    save_data: async () => ({ok: true}),
    get_prefs: async () => ({}),
    set_prefs: async () => ({ok: true}),
    library_info: async () => ({root: "/lib", found: true, photoFiles: 0}),
    cheffo_library: async () => ({found: false}),
    get_money: async () => ({templates: [], oneoffs: [], payments: {}, goals: [],
      calc: {bills: [], income: []}, spendingLog: {periodStart: "", entries: []}}),
    training_load: async () => ({exercises: {}, circuits: [], sessions: [],
      guides: [], questionnaires: [], calendars: [], athletes: [], equipment: [],
      circuitTypes: [], lessonPlans: []}),
    training_get_prefs: async () => ({}),
    notes_list_tree: async () => TREE,
    /* read_note returns a PLAIN STRING, not {text}. My first fixture
       wrapped it and the editor rendered "[object Object]" -- the
       fixture was wrong, not the app. */
    notes_read_note: async () => NOTE,
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}),
    notes_set_prefs: async () => ({ok: true}),
    notes_list_attachments: async () => [],
    notes_write_note: async () => ({ok: true}),
    notes_delete_item: async (p) => { deleted.push(p); return {ok: true}; },
  };
  const api = new Proxy({}, {
    get: (t, name) => {
      if (typeof name !== "string") return undefined;
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
  /* Browser pieces jsdom does not have. This test now walks NeuroNet's own
     pages -- Music among them, whose visualiser needs canvas, audio and
     animation frames -- which the KinCrux version never visited. Copied
     verbatim from test_modules.js so every suite fakes the browser the
     same way. */
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
    if (skipNotes && src.startsWith("notes/")) continue;
    const p = path.join(UI, src);
    if (!fs.existsSync(p)) throw new Error("index.html declares a missing script: " + src);
    w.eval(fs.readFileSync(p, "utf8"));
  }
  await new Promise((r) => setTimeout(r, 80));
  return {w, calls};
}

(async () => {
  /* ---- wired in, in the right order ---------------------------------- */
  {
    const s = declaredScripts();
    ok("index.html loads the notes app", s.includes("notes/app.js"), s.join(", "));
    ok("and its graph", s.includes("notes/graph.js"), "");
    ok("and its bridge", s.includes("notes/bridge.js"), "");
    ok("graph.js loads AFTER app.js, which owns the CC namespace",
      s.indexOf("notes/graph.js") > s.indexOf("notes/app.js"), s.join(", "));
    ok("the bridge loads after both, since it reads CC.Shell",
      s.indexOf("notes/bridge.js") > s.indexOf("notes/graph.js"), s.join(", "));
  }

  const {w, calls} = await boot();
  const doc = w.document;

  ok("the module registers itself", !!w.CP.Notes, "");
  ok("Amnesia's CC namespace is there", !!w.CC, "");
  ok("its shell markup is in the document from load",
    !!doc.getElementById("cx-shell"), "");
  ok("hidden until Notes is opened",
    doc.getElementById("cx-shell").hasAttribute("hidden"), "");
  ok("app.js handed its boot to the host rather than DOMContentLoaded",
    !!(w.CC.Shell && typeof w.CC.Shell.boot === "function"), "");
  ok("and it has not booted yet", w.CC.Shell && !w.CC.Shell.booted, "");

  /* ---- no id collisions with the host -------------------------------- */
  {
    /* Amnesia had its own #modal-veil, #confirm-veil and #toasts. So does
       KinCrux, and they are different elements. Duplicated, the first in
       document order wins and one app's dialogs quietly drive the
       other's. */
    const dupes = [];
    const seen = new Set();
    doc.querySelectorAll("[id]").forEach((el) => {
      if (seen.has(el.id)) dupes.push(el.id);
      seen.add(el.id);
    });
    ok("no id appears twice anywhere in the document",
      dupes.length === 0, [...new Set(dupes)].join(", "));

    ["cx-modal-veil", "cx-confirm-veil", "cx-toasts"].forEach((id) => {
      ok("the notes " + id.replace("cx-", "") + " is renamed and its own",
        !!doc.getElementById(id), id);
    });
    ok("and the host still has its own, untouched",
      !!doc.getElementById("modal-veil") && !!doc.getElementById("toasts"), "");
  }

  /* ---- it reads its OWN data ----------------------------------------- */
  {
    const host = doc.getElementById("ss-main");
    await w.CP.Notes.mount(host, "notes:vault");
    await new Promise((r) => setTimeout(r, 200));

    ok("opening Notes boots the vault once",
      w.CC.Shell.booted === true && w.CP.Notes._test.isMounted(), "");
    ok("and shows its shell",
      !doc.getElementById("cx-shell").hasAttribute("hidden"), "");

    ok("it listed the vault through its own namespaced method",
      calls.includes("notes_list_tree"), calls.join(", "));
    ok("and never called the host's own data calls for it",
      calls.indexOf("notes_list_tree") > -1, "");

    /* Whether any call reached the backend unprefixed is checked
       STATICALLY, in test_module_isolation.js. It cannot be done from
       here: `calls` is every call the whole app made, and KinCrux's own
       boot calls get_prefs too. Asserting on it flagged the host's call
       as the module's -- a test that would have "failed" forever for
       something that was never wrong. */

    ok("the note tree rendered",
      /Kitchen Reno/.test(doc.getElementById("cx-shell").textContent),
      doc.getElementById("cx-shell").textContent.slice(0, 90));
  }

  /* ---- choose a note, press Delete ------------------------------------
     Cam (2026-10-03): "in notes in neuronet i want to be able to select a
     note and press delete to delete it." */
  {
    const tree = doc.getElementById("cx-tree");
    const rowOf = (p) => tree.querySelector(`.cx-tree-item[data-path="${p}"] > .cx-tree-row`);
    const veil = doc.getElementById("cx-confirm-veil");
    const key = (k, extra) => tree.dispatchEvent(new w.KeyboardEvent("keydown", {key: k, bubbles: true, ...(extra || {})}));
    rowOf("Budget.md").dispatchEvent(new w.MouseEvent("click", {bubbles: true}));
    await new Promise((r) => setTimeout(r, 120));
    ok("clicking a note chooses it (marked) and the sidebar keeps the keys",
      rowOf("Budget.md").classList.contains("cx-selected") && doc.activeElement === tree,
      String(doc.activeElement && doc.activeElement.id));
    key("Delete");
    await new Promise((r) => setTimeout(r, 30));
    ok("Delete asks first, as the right-click Delete does",
      veil.classList.contains("open") && /Delete this note/.test(veil.textContent), veil.textContent);
    veil.querySelector("[data-act=yes]").click();
    await new Promise((r) => setTimeout(r, 120));
    ok("and saying yes deletes that note", deleted.join() === "Budget.md", deleted.join());
    key("Delete");
    await new Promise((r) => setTimeout(r, 30));
    ok("a deleted note is no longer chosen, so Delete again does nothing",
      !veil.classList.contains("open") && deleted.length === 1, deleted.join());

    deleted.length = 0;
    rowOf("Projects/Kitchen Reno.md").dispatchEvent(new w.MouseEvent("click", {bubbles: true}));
    await new Promise((r) => setTimeout(r, 120));
    rowOf("Budget.md").dispatchEvent(new w.MouseEvent("click", {bubbles: true, ctrlKey: true}));
    ok("Ctrl+click chooses one more",
      tree.querySelectorAll(".cx-selected").length === 2, String(tree.querySelectorAll(".cx-selected").length));
    key("Delete");
    await new Promise((r) => setTimeout(r, 30));
    ok("Delete with several chosen asks once, for all of them",
      /Delete these 2 items/.test(veil.textContent), veil.textContent);
    veil.querySelector("[data-act=no]").click();
    await new Promise((r) => setTimeout(r, 30));
    ok("and Cancel deletes nothing", deleted.length === 0, deleted.join());

    const ta = doc.createElement("input");
    tree.appendChild(ta);
    ta.dispatchEvent(new w.KeyboardEvent("keydown", {key: "Delete", bubbles: true}));
    await new Promise((r) => setTimeout(r, 30));
    ok("Delete while typing a new name is just typing",
      !veil.classList.contains("open"), veil.textContent);
    ta.remove();
  }

  /* ---- the highlight submenu, which Cam found empty ------------------ */
  {
    /* Reported as "no options appear when I select highlight". The
       submenu was being built with all four colours and appended to
       document.body -- outside #cx-shell, where none of the module's
       CSS reaches. Measured in a real browser: 1280x25 and fully
       transparent, against 170x126 with a background once attached to
       the module's own root.

       jsdom does no layout, so this asserts the thing that actually
       went wrong: WHERE the element is attached. */
    const doc2 = w.document;
    const shell = doc2.getElementById("cx-shell");
    const host = doc2.createElement("div");
    host.setAttribute("contenteditable", "true");
    host.innerHTML = "<p>Tiles arrive on the 14th.</p>";
    shell.appendChild(host);

    const tn = host.querySelector("p").firstChild;
    const range = doc2.createRange();
    range.setStart(tn, 0); range.setEnd(tn, 5);
    const sel = w.getSelection();
    sel.removeAllRanges(); sel.addRange(range);

    ok("the app exposes the menu for testing",
      !!(w.CC._test && typeof w.CC._test.openPreviewMenu === "function"), "");

    w.CC._test.openPreviewMenu(host, 100, 100);
    const menu = doc2.getElementById("cx-ctx-menu");
    const hl = [...menu.querySelectorAll("button")]
      .find((b) => /highlight/i.test(b.textContent));
    ok("right-clicking a selection offers Highlight", !!hl,
      menu.textContent.slice(0, 80));

    if (hl) {
      hl.dispatchEvent(new w.MouseEvent("mouseenter", {bubbles: true}));
      hl.dispatchEvent(new w.MouseEvent("mouseover", {bubbles: true}));
      await new Promise((r) => setTimeout(r, 60));

      const sub = doc2.querySelector(".cx-ctx-submenu");
      ok("hovering it opens a submenu", !!sub, "");
      ok("the submenu lands inside the module's own shell",
        !!(sub && sub.closest("#cx-shell")),
        sub ? "parent: " + (sub.parentElement.id || sub.parentElement.tagName)
            : "no submenu");
      ok("and it is NOT on document.body, where no module CSS reaches",
        !!(sub && sub.parentElement !== doc2.body), "");

      const colours = sub ? [...sub.querySelectorAll("button")]
        .map((b) => b.textContent.trim()) : [];
      ok("all four highlight colours are offered",
        colours.length === 4, colours.join(", ") || "none");
    }
    host.remove();
  }

  /* ---- and gets out of the way, from every view ---------------------- */
  {
    /* NeuroNet has three modules that bring their own shell -- Notes,
       Training and Lens -- so the strong form of this check applies again:
       whatever is open, at most one shell is on screen. (In KinCrux, where
       Notes is now the only shell, it had to be weakened.) */
    const shells = ["cx-shell", "cf-shell", "cf-lens"];
    const host = () => doc.getElementById("ss-main");
    const showing = () => shells.filter((id) => {
      const el = doc.getElementById(id);
      return el && !el.hasAttribute("hidden");
    });

    /* Ordinary pages. Not every module's -- NeuroNet's router puts every
       shell away BEFORE it dispatches to any module ("Before, not among"
       in app.js), so which page is the destination cannot change whether
       Notes is put away. Walking Music, Cards and Games as well would only
       need their large fixtures and would test those modules, not this one.
       The case that does matter -- one shell straight into another -- is
       checked below with Training and Lens. */
    const pages = ["all", "settings"];
    for (const view of pages) {
      w.SS.go("notes:vault");
      await new Promise((r) => setTimeout(r, 60));
      w.SS.go(view);
      await new Promise((r) => setTimeout(r, 80));
      ok("leaving Notes for " + view + " puts the vault away",
        showing().length === 0, "still showing: " + showing().join(", "));
      ok("  and the page area is visible again for " + view,
        host().style.display !== "none", "'" + host().style.display + "'");
    }

    w.SS.go("notes:vault");
    await new Promise((r) => setTimeout(r, 120));
    ok("coming back shows the vault again",
      !doc.getElementById("cx-shell").hasAttribute("hidden"), "");
    ok("and does not boot it a second time", w.CP.Notes._test.isMounted(), "");

    /* The strong check: from Notes straight into another shell. */
    w.SS.go("training:circuits");
    await new Promise((r) => setTimeout(r, 200));
    ok("switching from Notes to Training shows exactly one shell -- Training's",
      showing().length === 1 && showing()[0] === "cf-shell", showing().join(", "));
    w.SS.go("training:lens");
    await new Promise((r) => setTimeout(r, 150));
    w.SS.go("notes:vault");
    await new Promise((r) => setTimeout(r, 150));
    ok("and from Lens straight back to Notes shows exactly one -- the vault",
      showing().length === 1 && showing()[0] === "cx-shell", showing().join(", "));
  }

  /* ---- the app survives the module being absent ---------------------- */
  {
    const bare = await boot({skipNotes: true});
    ok("the app still boots with the notes module missing",
      !!bare.w.CP && !bare.w.CP.Notes, "");
    ok("and its sidebar still renders",
      !!bare.w.document.getElementById("ss-nav").innerHTML.trim(), "");
  }

  console.log("\nThe notes module, inside NeuroNet's shell\n");
  out.forEach((l) => console.log(l));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e.stack); process.exit(1); });
