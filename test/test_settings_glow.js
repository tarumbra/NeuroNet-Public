/* ==========================================================================
   Settings -> Appearance -> Glowing window borders, and Settings -> Desktop
   widgets -> Background (the slider) -- in the real app (jsdom).
   The backend is test_window_glow.py.
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
  const calls = [];
  let glowOn = false;
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    window_glow_get: async () => ({on: glowOn, current: "nord", themes: [
      {name: "neuronet", colours: ["#5fa665", "#00e5ff"], supported: true},
      {name: "nord", colours: ["#81a1c1", "#88c0d0"], supported: true},
      {name: "brand-new", colours: ["#64e444", "#7d4cf0"], supported: false}]}),
    window_glow_set: async (on) => { calls.push(["glow", on]); glowOn = on; return {ok: true, on}; },
    screensaver_get: async () => ({using: "neuronet"}),
    screensaver_set: async (v) => { calls.push(["saver", v]); return {ok: true}; },
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
  await wait(600);
  const $ = (s) => w.document.querySelector(s);

  w.SS.go("settings:appearance");
  await wait(300);
  ok("Appearance: NeuroNet's look, then the window borders", !!$(".th-grid") && !!$("#set-glow .glow"));
  const sws = [...w.document.querySelectorAll(".glow-th")];
  ok("  every theme with its swatch, the one in use marked, a new one marked new",
     sws.length === 3 && /5fa665.*00e5ff/.test(sws[0].querySelector(".glow-sw").getAttribute("style"))
     && sws[1].classList.contains("is-now") && /new/.test(sws[2].textContent));
  ok("  off to start", !$("#set-glow [data-glow]").classList.contains("on"));
  $("#set-glow [data-glow]").click();
  await wait(150);
  ok("the switch turns it on for every theme", calls.some((c) => c[0] === "glow" && c[1] === true)
     && $("#set-glow [data-glow]").classList.contains("on"));
  $("#set-glow [data-glow]").click();
  await wait(150);
  ok("  and off again", glowOn === false);

  w.SS.go("settings:widgets");
  await wait(300);
  // (this page was Desktop widgets until they went, 3 Nov 2026: just the screensaver now)
  ok("Screensaver: the choice, and no desktop widget switches or slider",
     !!$("[data-saver=neuronet]") && $("[data-saver=neuronet]").classList.contains("btn-primary")
     && !$("#dw-glass") && !$("[data-dw]") && !$("#dw-edit"));
  $("[data-saver=omarchy]").click();
  await wait(150);
  ok("  picking Omarchy's saves it", calls.some((c) => c[0] === "saver" && c[1] === "omarchy"));
})().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_settings_glow.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
