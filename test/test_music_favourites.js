/* ==========================================================================
   Favourite songs and "add to a playlist" (chords.js) -- the app's top-bar
   player, the ♥ Favourites list, the media bus field, and the desktop/bar
   widgets' calls (music.favourite, music.playlist.add). jsdom.
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
  const writes = [], reports = [];
  const TRACKS = {"a.flac": {title: "Alpha", artist: "X", duration: 100}, "b.flac": {title: "Bravo", artist: "Y", duration: 100}};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    music_read_json: async () => ({tracks: JSON.parse(JSON.stringify(TRACKS)),
      playlists: [{id: "p1", name: "Road trip", files: ["b.flac"]}], albums: []}),
    music_write_json: async (name, data) => { writes.push(JSON.parse(JSON.stringify(data))); return {ok: true}; },
    chords_list: async () => ["a.flac", "b.flac"],
    chords_audio_url: async () => ({url: "data:audio/wav;base64,"}),
    music_mpris_update: async (s) => { reports.push(s); return null; },
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only", url: "file://" + UI + "/index.html", pretendToBeVisual: true});
  const w = dom.window;
  w.pywebview = {api};
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
  await wait(900);
  const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];
  w.SS.go("music:playlists");
  await wait(600);
  const c = w.CH.tools.chords;

  ok("nothing playing: ♥ and + wait", $("#cc-mini-fav") && $("#cc-mini-fav").disabled && $("#cc-mini-add").disabled);
  let r = await w.SS.boardDo("t", "music.favourite", "{}");
  ok("  and the desktop ♥ says so", r && r.error === "Nothing is playing.", JSON.stringify(r));

  /* play Alpha */
  w.CH.Player.playQueue([{file: "a.flac", title: "Alpha", artist: "X"}], 0);
  await wait(300);
  ok("playing: ♡ in the top bar", $("#cc-mini-fav").textContent === "♡" && !$("#cc-mini-fav").disabled);
  $("#cc-mini-fav").click();
  await wait(450);
  ok("♥ it: a favourite, kept in Music's own file", c.isFavourite("a.flac") && writes.length && writes[writes.length - 1].tracks["a.flac"].favourite === true);
  ok("  the top bar shows ♥", $("#cc-mini-fav").textContent === "♥" && $("#cc-mini-fav").classList.contains("on"));
  await wait(300);
  const last = reports[reports.length - 1];
  ok("  and the media bus hears it (for the desktop and bar widgets)", last && last.favourite === true, JSON.stringify(last));

  /* the + menu */
  $("#cc-mini-add").click();
  await wait(50);
  const items = $$(".cc-pl-menu [data-pl]").map((b) => b.textContent);
  ok("+ opens a small menu of your playlists, and New playlist…", items.length === 1 && /Road trip/.test(items[0]) && !!$(".cc-pl-menu [data-new]"));
  $('.cc-pl-menu [data-pl="p1"]').click();
  await wait(450);   // music's file is written once changes stop (300 ms, 2026-10-06)
  const p1 = writes[writes.length - 1].playlists.find((p) => p.id === "p1");
  ok("  pick one: the song goes on it, and the menu's gone", p1.files.join() === "b.flac,a.flac" && !$(".cc-pl-menu"));
  $("#cc-mini-add").click(); await wait(30);
  w.document.body.dispatchEvent(new w.MouseEvent("mousedown", {bubbles: true}));
  ok("  a click elsewhere closes it", !$(".cc-pl-menu"));

  /* ♥ Favourites in Playlists */
  w.SS.go("music:library"); await wait(200);
  w.SS.go("music:playlists"); await wait(400);
  const favItem = $('.md-item[data-id="__favourites"]');
  ok("Playlists: ♥ Favourites at the top", favItem && /Favourites/.test(favItem.textContent) && /1 track/.test(favItem.textContent));
  favItem.click(); await wait(200);
  ok("  listing the ♥'d songs", $$("#ch-pl-tracks .ch-track-t").map((e) => e.textContent).join() === "Alpha");

  /* the desktop / bar widgets' calls */
  r = await w.SS.boardDo("t", "music.favourite", JSON.stringify({on: false}));
  ok("music.favourite (the widgets' ♥): sets it as asked", r.ok && r.favourite === false && !c.isFavourite("a.flac"));
  r = await w.SS.boardDo("t", "music.favourite", "{}");
  ok("  or turns it over when not told", r.ok && r.favourite === true && c.isFavourite("a.flac"));
  r = await w.SS.boardDo("t", "music.playlist.add", JSON.stringify({id: "p1"}));
  ok("music.playlist.add (the widgets' menu): the song onto that playlist", r.ok && r.playlist === "Road trip"
     && writes[writes.length - 1].playlists.find((p) => p.id === "p1").files.slice(-1)[0] === "a.flac");
  ok("  a playlist that's gone says so", (await w.SS.boardDo("t", "music.playlist.add", JSON.stringify({id: "gone"}))).error);
})().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_music_favourites.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
