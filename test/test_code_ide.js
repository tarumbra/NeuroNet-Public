/* ==========================================================================
   Code -> IDE -- Algorithm inside NeuroNet, the interface half
   ==========================================================================
   Cam (2026-10-01): "intergrate Algorithm found in /mnt/Cams_Collective into
   NeuroNet under Code main section and be in IDE sub section, there will be
   more sub sections later included guides, ebooks etc."

   The whole app booted in jsdom, its Api answered here. code_ide.py itself
   is test_code_ide.py.

   Guarded in particular:
     * Algorithm's page stays in #code-shell's shadow root: it has its own
       #app, #toast, #crumb and .sheet, and none of them may land in (or
       restyle) NeuroNet's page
     * its keys act only while the IDE is on screen -- Ctrl+S on any other
       screen is left alone (Training's keys once acted everywhere)
     * leaving hides the IDE rather than destroying it, so open files keep
       their undo history
     * every call it makes is NeuroNet's code_<name>
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

  const calls = [];
  const files = {"main.py": "def greet(name):\n    return name\n"};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}),
    set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    notes_list_tree: async () => [],
    code_get_settings: async () => ({projects_dir: "/d/code/projects", guides_dir: "/d/code/guides"}),
    code_list_projects: async () => [{name: "Demo", path: "/d/code/projects/Demo", files: 1, modified: "2026-10-01T10:00:00"}],
    code_list_guides: async () => [{name: "Loops.md", path: "/d/code/guides/Loops.md", kind: "markdown", size: 90}],
    code_read_guide: async () => ({kind: "markdown", name: "Loops.md", text:
      "# Loops\n\n<script>window.__pwned = 1</script> <img src=x onerror=\"window.__pwned = 2\"> **for** walks a list " +
      "[see](javascript:alert(1))\n\n```python\nfor bed in beds:\n    print(bed)\n```\n\n- one\n- two\n"}),
    code_list_drafts: async () => [],
    code_tree: async () => ({root: "/d/code/projects/Demo",
      tree: [{type: "file", name: "main.py", path: "main.py", size: 30, language: "python", editable: true}]}),
    code_read_file: async (p, rel) => ({text: files[rel], path: rel, language: "python", size: 30, modified: 1}),
    code_write_file: async (p, rel, text) => { files[rel] = text; return {ok: true, modified: 2}; },
    code_command_history: async () => ({}),
    code_run_suggestions: async () => [],
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => { if (n.startsWith("code_") || /^(list_projects|tree|read_file)$/.test(n)) calls.push(n);
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
  /* jsdom lays nothing out, so offsetParent is always null; "on screen" here
     is the shell shown and in the page. */
  Object.defineProperty(w.HTMLElement.prototype, "offsetParent", {
    get() { let e = this; while (e) { if (e.hidden) return null; e = e.parentElement; } return this.isConnected ? w.document.body : null; },
  });
  if (!w.CSS) w.CSS = {};
  if (!w.CSS.escape) w.CSS.escape = (s) => String(s).replace(/["\\]/g, "\\$&");
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(900);

  const doc = w.document, SS = w.SS;
  const shell = doc.getElementById("code-shell");

  /* ---- where it lives ---------------------------------------------------- */
  const appJs = fs.readFileSync(path.join(UI, "app.js"), "utf8");
  const block = appJs.slice(appJs.indexOf('{key: "code", name: "Code"'));
  const subs = [...block.slice(0, block.indexOf("]}")).matchAll(/\{key: "([a-z]+:[a-z]+)", name: "([^"]+)"/g)]
    .map((m) => m[1] + "=" + m[2]);
  ok("a Code main section with an IDE subsection first",
    subs.join(",") === "code:ide=IDE,code:guides=Guides,code:research=Research,code:structures=Data Structures,code:web=Web playground",
    subs.join(","));
  ok("  loaded by the page: Algorithm's four scripts and the shell's styles",
    ["highlight", "store", "editor", "ide"].every((n) => html.includes(`src="code/${n}.js"`))
    && html.includes('href="code/code.css"'));
  ok("  and the shell stands in the page, hidden until Code opens", shell && shell.hidden);

  /* ---- opening it ---------------------------------------------------------- */
  SS.go("code:ide"); await wait(700);
  ok("Code -> IDE opens in the Code section", SS.where().section === "code", JSON.stringify(SS.where()));
  ok("  in its shell, with NeuroNet's page area put away",
    !shell.hidden && doc.getElementById("ss-main").style.display === "none");
  const root = shell.shadowRoot;
  ok("  drawn inside the shell's shadow root", !!(root && root.getElementById("railBody")));
  ok("  so none of Algorithm's ids lands in NeuroNet's page",
    !doc.getElementById("railBody") && !doc.getElementById("paneA") && doc.querySelectorAll("#toast").length === 1);
  ok("  and its stylesheet is loaded in there, not in the page",
    !!root.querySelector('link[href$="code/ide.css"]') && !doc.querySelector('link[href$="code/ide.css"]'));
  await wait(300);
  ok("the projects are listed", /Demo/.test(root.getElementById("railBody").textContent), root.getElementById("railBody").textContent);
  ok("  every call it made was NeuroNet's code_<name>",
    calls.length > 0 && calls.every((n) => n.startsWith("code_")), calls.join(","));

  /* open a file */
  const find = (t) => [...root.querySelectorAll("#railBody *")].reverse().find((e) => e.textContent.trim() === t);
  find("Demo").click(); await wait(400);
  find("main.py").click(); await wait(400);
  const ta = root.querySelector("#paneA textarea");
  ok("a file opens in the editor", ta && ta.value === files["main.py"], ta && ta.value);
  ok("  coloured as Python", root.querySelectorAll("#paneA .t-keyword").length > 0);

  /* ---- a markdown guide beside the code ------------------------------------------
     Algorithm called renderMarkdown (and renderPdf) but never had them, so
     its guides never opened. */
  root.getElementById("toggleSplit").click(); await wait(300);
  find("Loops.md").click(); await wait(500);
  const md = root.querySelector("#paneB .guide-md");
  ok("a markdown guide opens beside the code", md && /<h1>Loops<\/h1>/.test(md.innerHTML), md && md.innerHTML.slice(0, 200));
  ok("  its code block coloured by Algorithm's highlighter", md && md.querySelector("pre .t-keyword"));
  ok("  lists and bold kept", md && md.querySelectorAll("li").length === 2 && md.querySelector("strong"));
  ok("  and nothing in it runs: no script, no image, no link to follow",
    md && !md.querySelector("script, img, a[href]") && !w.__pwned && /&lt;script&gt;/.test(md.innerHTML));
  ok("  highlighted code has no stray position classes", !root.querySelector('span[class="1"]'));

  /* ---- keys only while it's on screen ------------------------------------------ */
  const ctrlS = () => { const e = new w.KeyboardEvent("keydown", {key: "s", ctrlKey: true, bubbles: true, cancelable: true});
    doc.body.dispatchEvent(e); return e.defaultPrevented; };
  ok("Ctrl+S saves while the IDE is up", ctrlS());
  SS.go("all"); await wait(500);
  ok("leaving hides the IDE", shell.hidden);
  ok("  without destroying it: the open file is still there",
    root.querySelector("#paneA textarea") === ta && ta.value === files["main.py"]);
  ok("  and Ctrl+S on another screen is left alone", !ctrlS());
  w.dispatchEvent(new w.ErrorEvent("error", {message: "something in Photos broke"}));
  await wait(50);
  ok("another section's error isn't shown as the IDE's", root.getElementById("toast").hidden
    || !/Photos broke/.test(root.getElementById("toast").textContent));

  SS.go("code:ide"); await wait(400);
  ok("coming back shows the same editor, still open", !shell.hidden && root.querySelector("#paneA textarea") === ta);
}

run().catch((e) => { fail++; out.push("  FAIL  crashed: " + (e && e.stack || e)); })
  .finally(() => {
    console.log(out.join("\n"));
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
