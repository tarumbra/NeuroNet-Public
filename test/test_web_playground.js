/* ==========================================================================
   Code -> Web playground (ui/code/web.js), in the real app (jsdom).
   The preview must be sealed: sandbox="" (no scripts, its own origin, no
   forms or pop-ups) and its own CSP (nothing loaded from anywhere).
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms || 60));

(async () => {
  const pages = {};
  const writes = [];
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    code_web_list: async () => Object.entries(pages).map(([id, p]) => ({id, name: p.name, updated: p.updated})),
    code_web_read: async (id) => (pages[id] ? Object.assign({id}, pages[id]) : {error: "gone"}),
    code_web_write: async (id, doc) => {
      id = id || doc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      writes.push([id, JSON.parse(JSON.stringify(doc))]);
      pages[id] = Object.assign({updated: new Date().toISOString()}, doc);
      return {ok: true, id, name: doc.name};
    },
    code_web_delete: async (id) => { delete pages[id]; return {ok: true}; },
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => null;
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(700);
  const $ = (s) => w.document.querySelector(s);

  const menu = fs.readFileSync(path.join(UI, "app.js"), "utf8");
  ok("Code has a Web playground page", /\{key: "code:web", name: "Web playground"\}/.test(menu));
  w.SS.go("code:web");
  await wait(1500);
  ok("it opens on a first page to start from, saved", !!$(".wp") && writes.length === 1 && writes[0][1].html.includes("<h1>"),
     JSON.stringify(writes.slice(0, 1)));
  const f = $("#wp-frame");
  ok("SECURITY: the preview is sandbox=\"\" -- no scripts, its own origin, no forms or pop-ups",
     f && f.hasAttribute("sandbox") && f.getAttribute("sandbox") === "");
  const doc = f ? f.getAttribute("srcdoc") || f.srcdoc : "";
  ok("SECURITY: and its own CSP -- nothing is loaded from anywhere",
     /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;/.test(doc)
     && doc.indexOf("Content-Security-Policy") < doc.indexOf("<style>"));
  ok("the page is drawn from the code: HTML in the body, CSS in the head", /<style>[^]*\.card[^]*<\/style><\/head><body><main class="card">/.test(doc));
  ok("  given as text (srcdoc), never a file:// URL", !f.getAttribute("src"));

  /* live: typing redraws */
  const ed = $("#wp-ed");
  ed.value = "<p id=x>Changed</p><script>parent.pywebview.api.code_run('rm -rf ~')</script>";
  ed.dispatchEvent(new w.Event("input"));
  await wait(400);
  const live = $("#wp-frame").srcdoc;
  ok("Live: what you type shows a moment later", live.includes("<p id=x>Changed</p>"));
  ok("  a <script> in it is only text in a sealed frame (sandbox still \"\")", $("#wp-frame").getAttribute("sandbox") === "");
  await wait(900);
  ok("  and the page is saved as you type", writes.some(([, d]) => d.html.includes("Changed")));

  /* CSS tab */
  $('[data-tab="css"]').click();
  ok("the CSS tab shows the CSS", $("#wp-ed").value.includes("body {"));
  $("#wp-ed").value = "p { color: rebeccapurple; }";
  $("#wp-ed").dispatchEvent(new w.Event("input"));
  await wait(400);
  ok("  and changing it redraws", $("#wp-frame").srcdoc.includes("rebeccapurple"));
  ok("  a </style> in CSS can't break out of the style", w.CL.Web._test.previewDoc("", "a{} </style><script>x</script>")
     .includes("<\\/style><script>x</script></style>"));

  /* Live off: only Refresh / Ctrl+Enter */
  $("#wp-live").checked = false;
  $("#wp-live").dispatchEvent(new w.Event("change"));
  $("#wp-ed").value = "p { color: tomato; }";
  $("#wp-ed").dispatchEvent(new w.Event("input"));
  await wait(400);
  ok("Live off: the page waits", !$("#wp-frame").srcdoc.includes("tomato"));
  $("#wp-ed").dispatchEvent(new w.KeyboardEvent("keydown", {key: "Enter", ctrlKey: true, bubbles: true, cancelable: true}));
  ok("  Ctrl+Enter shows it", $("#wp-frame").srcdoc.includes("tomato"));

  /* Tab key types spaces */
  const e2 = $("#wp-ed"); e2.value = "a"; e2.selectionStart = e2.selectionEnd = 1;
  e2.dispatchEvent(new w.KeyboardEvent("keydown", {key: "Tab", bubbles: true, cancelable: true}));
  ok("Tab indents (two spaces) instead of leaving the box", e2.value === "a  ");

  /* New */
  $("#wp-new").click();
  await wait(500);
  ok("New: an empty page of its own", $("#wp-ed").value === "" && Object.keys(pages).length === 2);
})().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_web_playground.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
