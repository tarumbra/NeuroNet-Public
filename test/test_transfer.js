/* ==========================================================================
   Settings → Export & import, the page (ui/transfer/transfer.js)
   ==========================================================================
   Cam: "in settings i would like a setting to export and import data."
   The backend is test_transfer.py; this drives the page in jsdom against a
   backend kept here: the summary shown before anything is written, an export
   followed to the end, and an import confirmed, followed, and reloaded.
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

const SUMMARY = {files: 271, bytes: 485e6, areas: [
  {key: "neuronet", label: "NeuroNet — photos, ebooks", path: "/nn/neuronet_data", files: 218, bytes: 335e6},
  {key: "family", label: "Calendar, contacts and family photos", path: "/Camily/camily_data", files: 50, bytes: 150e6},
  {key: "settings", label: "Settings", path: "/nn/neuronet_prefs.json", files: 1, bytes: 400}],
  skipped: [{why: "music, films and other recordings", files: 407, bytes: 10.2e9}]};
let job = {state: "idle"};
const calls = [];

async function run() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; nothing here can run without it)"); return; }
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    data_export_summary: async () => SUMMARY,
    data_transfer_status: async () => JSON.parse(JSON.stringify(job)),
    data_export_start: async () => { calls.push("export");
      job = {state: "running", kind: "export", done: 100, total: 271, fraction: 0.4}; return {started: true}; },
    data_import_pick: async () => ({ok: true, path: "/usb/NeuroNet export.zip",
      manifest: {from: "old-laptop", created: "2026-09-20T10:00:00", files: 271, bytes: 485e6},
      targets: [{key: "neuronet", label: "NeuroNet", to: "/new/neuronet_data"},
                {key: "stranger", label: "Stranger", to: ""}]}),
    data_import_start: async (p) => { calls.push("import:" + p);
      job = {state: "running", kind: "import", done: 3, total: 271, fraction: 0.01}; return {started: true}; },
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {get: () => () => ({addColorStop() {}})});
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(900);
  const thrown = [];
  w.addEventListener("error", (e) => thrown.push(String(e.message || e)));
  const doc = w.document, $ = (s) => doc.querySelector(s), $$ = (s) => [...doc.querySelectorAll(s)];
  let reloaded = 0;
  w.SS.Transfer._reload = () => { reloaded++; };

  w.SS.go("settings:transfer"); await wait(600);
  ok("Settings has Export & import",
    $$("#ss-subnav-body [data-view]").some((b) => b.dataset.view === "settings:transfer"));
  ok("  which shows, before anything is written, every place data is and how big",
    $$(".tx-table tbody tr").length === 3 && /Camily\/camily_data/.test($(".tx-table").textContent)
      && /485 MB/.test($(".tx-table tfoot").textContent), ($("#tx-summary") || {}).textContent);
  ok("  and what is left out, with where the music is, to copy across",
    /Music, films and other recordings/.test($(".tx-left").textContent) && /10\.2 GB/.test($(".tx-left").textContent)
      && /chords\/music/.test($(".tx-left").textContent));

  $("#tx-export").click(); await wait(700);
  ok("exporting shows how far along it is",
    calls.includes("export") && /100 of 271 files · 40%/.test($("#tx-export-status").textContent)
      && $("#tx-export").disabled && $("#tx-import").disabled, $("#tx-export-status").textContent);
  job = {state: "done", kind: "export", result: {ok: true, path: "/home/cam/Desktop/NeuroNet export.zip", files: 271, bytes: 485e6}};
  await wait(700);
  ok("  and where it was saved when it's done",
    /Desktop\/NeuroNet export\.zip/.test($("#tx-export-status").textContent) && !$("#tx-export").disabled);

  $("#tx-import").click(); await wait(300);
  ok("importing first says what's in the file and where each part will go",
    /old-laptop/.test(doc.body.textContent) && /\/new\/neuronet_data/.test(doc.body.textContent)
      && /nowhere here/.test(doc.body.textContent));
  $$("button").find((b) => b.textContent.trim() === "Import").click(); await wait(600);
  ok("  and only starts when that is confirmed", calls.includes("import:/usb/NeuroNet export.zip"));
  job = {state: "done", kind: "import", result: {ok: true, written: 200, replaced: 5, same: 66,
    backup: "/new/neuronet_data/import-backups/20260926", refused: []}};
  await wait(700);
  ok("  then says what it did, what it kept aside",
    /Imported 200 files \(66 already here, unchanged\), 5 replacing/.test($("#tx-import-status").textContent)
      && /import-backups/.test($("#tx-import-status").textContent), $("#tx-import-status").textContent);
  await wait(2000);
  ok("  and reloads NeuroNet so everything shows the imported data", reloaded === 1, reloaded);
  ok("nothing threw", !thrown.length, thrown.join(" | "));
}

run().then(() => {
  console.log("\nSettings → Export & import\n");
  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
