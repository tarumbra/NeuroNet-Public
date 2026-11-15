/* ==========================================================================
   Code -> Guides, Research, Data Structures -- the interface half
   ==========================================================================
   Cam (2026-10-01): "Code mainsection is also going to have guides (built
   out like Neuro guides ...). Algorthm research (... annotate, highlight
   and make text boxes around a code base i wrote ... think like a code
   review tool). Also then a data structures sub section ... All guides,
   data structures ect. Need to have the ability to add more."

   The whole app booted in jsdom, its Api answered here by a small library
   kept in memory (code_library.py itself is test_code_library.py).

   Guarded in particular:
     * the three are Code's subsections, drawn as NeuroNet screens -- the
       IDE's shell is put away while they're up
     * a guide's markdown can't put markup into the page; its code is
       coloured, and a `run` block runs
     * guides and structures can be added and edited -- and what's being
       typed survives leaving the screen and coming back
     * Research: a mark is made from a selection or from line numbers, saved
       with the code it's about, and found again when the code moves
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

async function run() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; nothing here can run without it)"); return; }

  /* ---- a library in memory, shaped like code_library.py's answers ---- */
  const calls = [];
  const guides = {
    "py-loops": {slug: "py-loops", title: "Python loops", blurb: "for and while", topic: "Python", level: "", order: 1, origin: "builtin",
      text: "## Loops\n\n<script>window.__pwned = 1</script> <img src=x onerror=\"window.__pwned = 2\"> **for** walks\n\n" +
            "| Op | Time |\n| --- | --- |\n| get | O(1) |\n\n> A callout\n\n```python run\nprint('hi')\n```\n\n[see](javascript:alert(1))"},
    "js-maps": {slug: "js-maps", title: "Maps", blurb: "key to value", topic: "JavaScript", level: "", order: 2, origin: "mine",
      text: "````\n```python\nnested\n```\n````\n\nafter"},
  };
  const structures = {
    stack: {slug: "stack", title: "Stack", blurb: "LIFO", category: "Linear", order: 1, origin: "builtin",
      languages: ["python", "javascript"], text: "## What it is\n\nA pile.",
      code: {python: "class Stack:\n    pass\nprint('Stack: all checks passed')", javascript: "class Stack {}\nconsole.log('ok')"}},
  };
  const LANGS = {python: {label: "Python", hl: "python"}, javascript: {label: "JavaScript", hl: "javascript"},
                 rust: {label: "Rust", hl: "rust"}};
  const FILE = "def main():\n    load()\n    save()\n\ndef load():\n    return 1\n";
  let study = null;
  const summary = (o) => { const c = Object.assign({}, o); delete c.code; return c; };
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}),
    set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    notes_list_tree: async () => [],
    code_list_projects: async () => [{name: "Demo", path: "/d/code/projects/Demo"}],
    code_lib_list: async (kind) => kind === "guides"
      ? {items: Object.values(guides).map(summary), hidden: [], languages: LANGS}
      : {items: Object.values(structures).map(summary), hidden: [{slug: "trie", title: "Trie"}], languages: LANGS},
    code_lib_read: async (kind, slug) => JSON.parse(JSON.stringify((kind === "guides" ? guides : structures)[slug])),
    code_lib_save: async (kind, slug, data) => {
      const lib = kind === "guides" ? guides : structures;
      const s = slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const was = lib[s] || {};
      const item = Object.assign({}, was, data, {slug: s, origin: was.origin === "builtin" ? "edited" : (was.origin || "mine")});
      if (kind === "structures") {
        item.code = Object.assign({}, was.code || {});
        for (const [l, t] of Object.entries(data.code || {})) { if (t === null) delete item.code[l]; else item.code[l] = t; }
        item.languages = Object.keys(item.code);
      }
      lib[s] = item;
      return JSON.parse(JSON.stringify(item));
    },
    code_lib_remove: async () => ({ok: true, was: "builtin"}),
    code_lib_run: async (lang, text) => ({ok: true, output: `ran ${lang}: ${text.split("\n")[0]}`}),
    code_lib_studies: async () => (study ? [{slug: study.slug, name: study.name, path: study.path, found: true,
                                             notes: study.annotations.length}] : []),
    code_lib_study_create: async (name, p) => {
      study = {slug: "my-app", name: name || "my-app", path: p, overview: "", annotations: []};
      return JSON.parse(JSON.stringify(study));
    },
    code_lib_study: async () => JSON.parse(JSON.stringify(study)),
    code_lib_study_tree: async () => ({found: true, root: study.path, tree: [
      {type: "folder", name: "src", path: "src", children: [
        {type: "file", name: "main.py", path: "src/main.py", size: 60, readable: true}]},
      {type: "file", name: "logo.png", path: "logo.png", size: 9, readable: false}]}),
    code_lib_study_file: async () => ({path: "src/main.py", text: FILE, language: "python"}),
    code_lib_study_save: async (slug, changes) => {
      for (const k of ["annotations", "overview", "name", "last_file"]) if (k in changes) study[k] = changes[k];
      return JSON.parse(JSON.stringify(study));
    },
    code_lib_export_study: async () => ({path: "/home/cam/my-app-research.md"}),
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => { if (n.startsWith("code_")) calls.push([n, a]);
                        return known[n] ? known[n](...a) : {}; } : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only", url: "file://" + UI + "/index.html", pretendToBeVisual: true});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {}, lineTo() {},
    stroke() {}, fill() {}, save() {}, restore() {}, translate() {}, scale() {},
    createLinearGradient: () => ({addColorStop() {}}), setTransform() {}, closePath() {},
    getImageData: () => ({data: [0, 0, 0, 255]}),
  });
  let clip = null;
  Object.defineProperty(w.navigator, "clipboard", {value: {writeText: async (t) => { clip = t; }}});
  if (!w.CSS) w.CSS = {};
  if (!w.CSS.escape) w.CSS.escape = (s) => String(s).replace(/["\\]/g, "\\$&");
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(900);

  const doc = w.document, SS = w.SS;
  const main = doc.getElementById("ss-main");
  const $ = (sel) => main.querySelector(sel);
  const confirmYes = async () => { await wait(30); const b = doc.querySelector('#confirm-veil [data-a="yes"]'); if (b) b.click(); await wait(200); };
  const type = (el, value) => { el.value = value; el.dispatchEvent(new w.Event("input", {bubbles: true})); };

  /* ---- where they live ---------------------------------------------------- */
  ok("the page loads the library's scripts and styles",
    ["library", "guides", "research", "structures"].every((n) => html.includes(`src="code/${n}.js"`))
    && html.includes('href="code/library.css"'));
  ok("  Guides, Research and Data Structures are Code's views", ["code:guides", "code:research", "code:structures"]
    .every((v) => SS.Code.VIEWS.includes(v)));

  /* ---- Guides ------------------------------------------------------------- */
  SS.go("code:guides"); await wait(400);
  ok("Code -> Guides opens in the Code section", SS.where().section === "code", JSON.stringify(SS.where()));
  ok("  as a NeuroNet screen, with the IDE's shell put away",
    main.style.display !== "none" && doc.getElementById("code-shell").hidden && $('[data-screen="guides"]'));
  ok("  the guides listed, grouped by topic",
    [...main.querySelectorAll(".cl-group")].map((g) => g.textContent).join() === "Python,JavaScript"
    && main.querySelectorAll(".cl-item").length === 2);
  ok("  and the first one open", /Python loops/.test($("#cg-page").textContent));
  const page = $("#cg-page");
  ok("its markdown: a table, a callout, a heading",
    page.querySelector(".cl-table td") && page.querySelector(".cl-callout") && page.querySelector("h3"));
  ok("  nothing in it runs: no script, no image, no link to follow",
    !page.querySelector(".cl-prose script, .cl-prose img, .cl-prose a[href]") && !w.__pwned
    && /&lt;script&gt;/.test(page.innerHTML));
  ok("  its code coloured by Algorithm's highlighter", page.querySelector(".cl-code .t-builtin, .cl-code .t-string"));
  const runBtn = page.querySelector('.cl-code [data-act="run"]');
  ok("  a `python run` block has a Run button", !!runBtn);
  runBtn.click(); await wait(150);
  ok("  which runs it and shows what it printed",
    /ran python: print\('hi'\)/.test(page.querySelector(".cl-out").textContent) && !page.querySelector(".cl-out").hidden);
  page.querySelector('.cl-code [data-act="copy"]').click(); await wait(50);
  ok("  Copy copies the code", clip === "print('hi')", clip);

  main.querySelectorAll(".cl-item")[1].click(); await wait(100);
  const nested = $("#cg-page pre code");
  ok("a longer fence holds a shorter one (how the writing guide shows fences)",
    nested && /```python/.test(nested.textContent) && /after/.test($("#cg-page").textContent), nested && nested.textContent);

  type($("#cg-q"), "walks");
  ok("search looks inside the guides", main.querySelectorAll(".cl-item").length === 1);
  type($("#cg-q"), "");
  main.querySelector('[data-topic="JavaScript"]').click();
  ok("  a topic chip narrows the list", main.querySelectorAll(".cl-item").length === 1
    && /Maps/.test(main.querySelector(".cl-item").textContent));
  main.querySelector('[data-topic=""]').click();

  /* new guide */
  $("#cg-new").click(); await wait(150);
  ok("New guide opens the editor", $("#ge-text") && $("#ge-preview"));
  type($("#ge-title"), "List slicing");
  type($("#ge-topic"), "Python");
  type($("#ge-text"), "## Slices\n\n```python\nnums[1:3]\n```");
  await wait(300);
  ok("  the preview follows the markdown", /Slices/.test($("#ge-preview").innerHTML) && $("#ge-preview .t-number"));
  SS.go("all"); await wait(300);
  SS.go("code:guides"); await wait(400);
  ok("leaving and coming back keeps what was typed",
    $("#ge-title") && $("#ge-title").value === "List slicing" && /Slices/.test($("#ge-text").value));
  $("#ge-save").click(); await wait(300);
  const saved = calls.filter((c) => c[0] === "code_lib_save").pop();
  ok("Save sends the guide", saved && saved[1][0] === "guides" && saved[1][1] === null
    && saved[1][2].title === "List slicing" && saved[1][2].topic === "Python", JSON.stringify(saved));
  ok("  and it's in the list, open", main.querySelectorAll(".cl-item").length === 3 && /List slicing/.test($("#cg-page").textContent));

  main.querySelector('.cl-item[data-slug="py-loops"]').click(); await wait(100);
  ok("one of NeuroNet's offers Hide, not Delete", $('#cg-page [data-act="remove"]').textContent === "Hide");
  $('#cg-page [data-act="remove"]').click(); await confirmYes();
  ok("  and hiding it asks the back end", calls.some((c) => c[0] === "code_lib_remove" && c[1][1] === "py-loops"));

  /* ---- Data Structures ---------------------------------------------------- */
  SS.go("code:structures"); await wait(500);
  ok("Code -> Data Structures lists them by category",
    $('[data-screen="structures"]') && [...main.querySelectorAll(".cl-group")].map((g) => g.textContent).join() === "Linear");
  ok("  hidden ones can be shown again", /Show hidden \(1\)/.test($("#cs-hidden").textContent));
  ok("  the explanation beside the code, with line numbers",
    /A pile/.test($(".cl-ds-about").textContent) && main.querySelectorAll(".cl-impl, .cl-ds-code .cl-code").length === 1
    && main.querySelector(".cl-ln"));
  ok("  in Python first", /^Python/.test($(".cl-ds-code .cl-code-lang").textContent));
  main.querySelector('.seg-btn[data-lang="javascript"]').click(); await wait(100);
  ok("  the language tabs switch it", /^JavaScript/.test($(".cl-ds-code .cl-code-lang").textContent));
  $("#cs-side").checked = true; $("#cs-side").dispatchEvent(new w.Event("change")); await wait(100);
  ok("  Side by side shows two languages", main.querySelectorAll(".cl-impls.two .cl-code").length === 2);
  main.querySelector('.cl-ds-code [data-act="copy"]').click(); await wait(50);
  ok("  Copy leaves the line numbers out", clip === structures.stack.code.javascript, clip);
  main.querySelector('.cl-ds-code [data-act="run"]').click(); await wait(150);
  ok("  Run runs it", /ran javascript/.test($(".cl-ds-code .cl-out").textContent));

  $('#cs-page [data-act="edit"]').click(); await wait(200);
  ok("Edit opens the structure's editor", $("#se-code") && $("#se-title").value === "Stack");
  const add = $("#se-add");
  ok("  offering the languages it hasn't got", [...add.options].map((o) => o.value).join() === ",rust");
  add.value = "rust"; add.dispatchEvent(new w.Event("change")); await wait(50);
  type($("#se-code"), "fn main() {}");
  main.querySelector('#se-langs [data-lang="python"]').click(); await wait(50);
  $("#se-drop").click(); await confirmYes();
  ok("  a language can be taken away", ![...main.querySelectorAll("#se-langs [data-lang]")].some((b) => b.dataset.lang === "python"));
  $("#se-save").click(); await wait(300);
  const ss = calls.filter((c) => c[0] === "code_lib_save" && c[1][0] === "structures").pop();
  ok("Save sends the new language, and the removed one as null",
    ss && ss[1][1] === "stack" && ss[1][2].code.rust === "fn main() {}" && ss[1][2].code.python === null, JSON.stringify(ss && ss[1][2].code));

  $("#cs-new").click(); await wait(150);
  ok("a new structure starts from a skeleton that checks itself",
    /all checks passed/.test($("#se-code").value) && /Cost of each operation/.test($("#se-text").value));
  $("#se-cancel").click(); await wait(100);

  /* ---- Research: the marks find their code again --------------------------- */
  const R = w.CL.Research._test;
  const mk = (kind, s, e, quote) => ({id: "x", kind, file: "f", start: s, end: e, quote, colour: "blue"});
  let marks = [mk("note", {line: 5, col: 0}, {line: 6, col: 12}, "def load():\n    return 1")];
  R.reanchor("# new line\n" + FILE, marks);
  ok("a mark follows its code when lines are added above it",
    marks[0].start.line === 6 && marks[0].end.line === 7 && !marks[0].lost, JSON.stringify(marks[0]));
  marks = [mk("highlight", {line: 2, col: 4}, {line: 2, col: 10}, "load()")];
  R.reanchor("def main():\n  x = 1\n  load()\n", marks);
  ok("  a highlight finds its exact characters", marks[0].start.line === 3 && marks[0].start.col === 2 && marks[0].end.col === 8);
  marks = [mk("note", {line: 1, col: 0}, {line: 1, col: 11}, "def main():")];
  R.reanchor("print('gone')\n", marks);
  ok("  and is kept, flagged, when its code is gone", marks[0].lost === true);
  marks = [mk("box", {line: 1, col: 0}, {line: 1, col: 4}, "load")];
  R.reanchor("x\nload()\n", marks);
  ok("  a box only lands on whole lines", marks[0].lost === true);

  /* ---- Research: the screen ----------------------------------------------- */
  SS.go("code:research"); await wait(400);
  ok("Code -> Research with no studies says how to start", /Start a study/.test(main.textContent) && $("#rs-new"));
  ok("  and fills the pane", main.classList.contains("ss-main-fills"));
  $("#rs-new").click(); await wait(200);
  ok("New study offers the IDE's projects", doc.querySelector('#modal-veil [data-path="/d/code/projects/Demo"]'));
  doc.querySelector("#modal-veil #ns-path").value = "/home/cam/my-app";
  [...doc.querySelectorAll("#modal-veil .dlg-row .btn")].pop().click(); await wait(500);
  ok("  and starts one on the folder", study && study.path === "/home/cam/my-app" && $('[data-screen="research"]'));
  ok("its files are listed; a binary one can't be opened",
    /src/.test($("#rs-files").textContent) && $('[data-file="logo.png"]') && $('[data-file="logo.png"]').disabled);
  $('[data-folder="src"]').click(); await wait(50);
  $('[data-file="src/main.py"]').click(); await wait(300);
  const code = $("#rs-code");
  ok("a file opens with line numbers, coloured",
    code && code.querySelectorAll(".rs-line").length === FILE.split("\n").length && code.querySelector(".t-keyword"));

  // line numbers: 1, then shift+5 -> lines 1-5
  const num = (n) => code.querySelector(`.rs-line[data-n="${n}"] .rs-num`);
  num(1).dispatchEvent(new w.MouseEvent("mousedown", {bubbles: true}));
  num(3).dispatchEvent(new w.MouseEvent("mousedown", {bubbles: true, shiftKey: true}));
  await wait(50);
  ok("clicking line numbers picks lines and brings up the bar",
    !$("#rs-bar").hidden && /lines 1–3/.test($("#rs-bar").textContent));
  $('#rs-bar .rs-dot[data-c="green"]').click();
  $('#rs-bar [data-k="box"]').click(); await wait(300);
  let a = study.annotations[0];
  ok("Box saves the lines, the colour and the code it's about",
    a && a.kind === "box" && a.start.line === 1 && a.end.line === 3 && a.colour === "green"
    && a.quote === "def main():\n    load()\n    save()", JSON.stringify(a));
  const card = $(".rs-card.editing");
  ok("  and opens its card for a label", card && card.querySelector('[data-f="label"]'));
  card.querySelector('[data-f="label"]').value = "Entry point";
  card.querySelector('[data-f="text"]').value = "Where it **starts**.";
  card.querySelector('[data-act="done"]').click(); await wait(300);
  ok("  Done saves the label and the words", study.annotations[0].label === "Entry point"
    && study.annotations[0].text === "Where it **starts**.");
  ok("  the box is drawn round the code, labelled", /Entry point/.test(($("#rs-code .rs-box-label") || {}).textContent || ""));
  ok("  and the card shows the words as markdown", $(".rs-card strong") && /starts/.test($(".rs-card strong").textContent));

  // a selection inside line 2 -> a highlight of exactly those characters
  const textNode = (n) => { const el = code.ownerDocument.querySelector(`#rs-code .rs-line[data-n="${n}"] .rs-text`);
    const walker = doc.createTreeWalker(el, 4); const nodes = []; for (let t = walker.nextNode(); t; t = walker.nextNode()) nodes.push(t); return nodes; };
  const line2 = textNode(2);          // "    ", "load", "()" ...
  const loadNode = line2.find((t) => t.data === "load");
  const sel = w.getSelection();
  const range = doc.createRange();
  range.setStart(loadNode, 0);
  range.setEnd(line2[line2.length - 1], line2[line2.length - 1].length);
  sel.removeAllRanges(); sel.addRange(range);
  $("#rs-code").dispatchEvent(new w.MouseEvent("mouseup", {bubbles: true})); await wait(80);
  ok("selecting code brings up the bar", !$("#rs-bar").hidden && /line 2/.test($("#rs-bar").textContent));
  $('#rs-bar [data-k="highlight"]').click(); await wait(300);
  a = study.annotations.find((x) => x.kind === "highlight");
  ok("Highlight saves exactly the characters chosen",
    a && a.start.line === 2 && a.start.col === 4 && a.end.col === 10 && a.quote === "load()", JSON.stringify(a));
  ok("  and colours them (lines tinted where CSS highlights aren't there)",
    $('#rs-code .rs-line[data-n="2"]').classList.contains("rs-tint"));

  num(5).dispatchEvent(new w.MouseEvent("mousedown", {bubbles: true})); await wait(50);
  $('#rs-bar [data-k="note"]').click(); await wait(300);
  const noteCard = $(".rs-card.editing");
  noteCard.querySelector('[data-f="text"]').value = "Why does this return 1?";
  noteCard.querySelector('[data-act="done"]').click(); await wait(300);
  ok("Note: numbered in the gutter beside its line", $('#rs-code .rs-line[data-n="5"] .rs-pin')
    && $('#rs-code .rs-line[data-n="5"]').classList.contains("rs-noted"));
  ok("  and the tree counts the marks in each file", ($('[data-file="src/main.py"] .rs-count') || {}).textContent === "3");
  ok("the marks are listed in line order", [...main.querySelectorAll(".rs-card .rs-lines")].map((e) => e.textContent).join("|")
    === "lines 1–3|line 2|line 5");

  main.querySelector('[data-tab="overview"]').click(); await wait(50);
  main.querySelector('.rs-overview [data-act="edit"]').click(); await wait(50);
  main.querySelector(".rs-ov-in").value = "It loads, then saves.";
  main.querySelector('.rs-overview [data-act="done"]').click(); await wait(200);
  ok("the overview is written and kept", study.overview === "It loads, then saves." && /loads, then saves/.test($("#rs-notes").textContent));

  $("#rs-export").click(); await wait(100);
  ok("Export saves the study as a review", calls.some((c) => c[0] === "code_lib_export_study"));

  SS.go("all"); await wait(300);
  ok("leaving Research gives the pane back", !main.classList.contains("ss-main-fills"));
  SS.go("code:research"); await wait(500);
  ok("coming back reopens the study at the same file", $("#rs-code") && /src\/main\.py/.test($(".rs-file-path").textContent));

  SS.go("code:ide"); await wait(500);
  ok("and the IDE still opens in its own shell", !doc.getElementById("code-shell").hidden);
}

run().catch((e) => { fail++; out.push("  FAIL  crashed: " + (e && e.stack || e)); })
  .finally(() => {
    console.log(out.join("\n"));
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
