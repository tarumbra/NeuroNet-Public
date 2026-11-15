/* ==========================================================================
   Music -> Visualizer (chords.js CH.Visualizer + nnviz.js) in the real app
   (jsdom). The widget half is test_visualizers.py.
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
  const published = [];
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    music_read_json: async () => ({tracks: {"t.flac": {title: "Tone", artist: "Test", duration: 2}}, playlists: [], albums: []}),
    music_viz_publish: async (d) => { published.push(d); return {ok: true}; },
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only", url: "file://" + UI + "/index.html", pretendToBeVisual: true});
  const w = dom.window;
  w.pywebview = {api};
  const mem = {};
  Object.defineProperty(w, "localStorage", {configurable: true, value: {
    getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; }}});
  w.matchMedia = w.matchMedia || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLCanvasElement.prototype.getContext = () => null;
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(700);
  const V = w.CH.Visualizer, T = V._test;

  /* the analysis: a low tone lights the low bands, a high tone the high ones */
  const rate = 22050, secs = 2;
  const tone = (hz) => { const a = new Float32Array(rate * secs); for (let i = 0; i < a.length; i++) a[i] = Math.sin(2 * Math.PI * hz * i / rate) * (i < a.length / 2 ? 0.05 : 0.8); return a; };
  const peakBand = (spec, sec) => { const b = w.NNViz.bandsAt(spec, sec); return b.indexOf(Math.max(...b)); };
  const low = await T.spectrumOf(tone(80), rate), high = await T.spectrumOf(tone(6000), rate);
  ok("the spectrum: 32 bands, 20 times a second, for the whole song", low.bands === 32 && low.fps === 20
     && low.frames > 30 && low.data.length === low.frames * 32);
  ok("  a low note lights the low end, a high note the high end", peakBand(low, 1.5) < 8 && peakBand(high, 1.5) > 22,
     [peakBand(low, 1.5), peakBand(high, 1.5)]);
  const lb = w.NNViz.bandsAt(low, 0.2), lb2 = w.NNViz.bandsAt(low, 1.5);
  ok("  and it follows the song: quiet then loud", Math.max(...lb) < Math.max(...lb2), [Math.max(...lb), Math.max(...lb2)]);

  /* the page */
  w.SS.go("music:visualizer");
  await wait(500);
  const modes = [...w.document.querySelectorAll(".viz-mode-btn")].map((b) => b.dataset.mode);
  const pals = [...w.document.querySelectorAll(".viz-pal-btn")].map((b) => b.dataset.pal);
  ok("Music -> Visualizer: the six new styles", modes.join() === "ribbons,silk,bars,dots,pulse,waves", modes.join());
  ok("  and colours: Neon (the picture's), Aurora, Sunset, or the app's theme", pals.join() === "neon,aurora,sunset,theme", pals.join());
  w.document.querySelector('[data-mode="dots"]').click();
  w.document.querySelector('[data-pal="theme"]').click();
  ok("  a choice is kept", T.style === "dots" && T.palette === "theme" && mem["nn:viz:style"] === "dots" && mem["nn:viz:palette"] === "theme");
  ok("  the theme's colours come from the theme (themeColors still the one lookup)", typeof T.themeColors().barColor === "string");
  ok("nothing playing: the quiet motion, never blank", T.bandsNow(1000).length === 32);

})().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_visualizers.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
