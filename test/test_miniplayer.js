/* ==========================================================================
   The top bar's player works from every section, and from a cold start.
   ==========================================================================
   Cam: "the chords mini player in the top bar only works when clicked
   while Music main section is open, it doesn't work when i am in any
   other main section."

   WHAT WAS ACTUALLY WRONG, and it was not what it looked like. The
   buttons were wired everywhere: measured in both renderers -- headless
   Chromium and real WebKitGTK 2.52, the engine Cam runs -- a click at the
   button's own coordinates reached its handler in every section of the
   app, and with a queue loaded it skipped tracks from Photos, Games,
   Divination, Notes, Cells and Home just as well as from Music.

   What stopped was what the handler then DID:

       function next(auto) { if (!queue.length) return; ... }
       function toggle()   { if (!cur()) return; ... }

   and the queue is empty until something is played from inside the music
   section. So the bar did nothing everywhere -- including in Music --
   until a track was started there, and did everything everywhere
   afterwards. From outside that reads exactly as "it only works in
   Music", and every fresh launch reads that way again, because the queue
   lives in memory and starts empty.

   Pressing play on a music player's bar should play music. That is what
   is checked here, and the shape of the check matters: it presses the
   REAL button and reads the REAL player, rather than calling the
   functions directly, because "is the button wired" and "does the button
   do something" are different questions and only the second one was
   failing.
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

function declaredScripts() {
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
}

async function boot({tracks = 12} = {}) {
  const TRACKS = {};
  for (let i = 0; i < tracks; i++) {
    TRACKS[`t${i}.flac`] = {title: `Track ${i}`, artist: "A", album: "B",
                            art: "", duration: 100, plays: 0};
  }
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: JSON.parse(JSON.stringify(TRACKS)),
                                   playlists: [], albums: []}),
    music_write_json: async () => ({ok: true}),
    music_thumb_url: async () => null,
    music_image_url: async () => null,
    chords_list: async () => Object.keys(TRACKS).map((n) => ({name: n, size: 1})),
    chords_audio_url: async () => ({url: "data:audio/mpeg;base64,SUQz", streamed: true}),
    cards_read_json: async () => ({tarotDecks: [], oracleDecks: [], lenormandDecks: [],
      tarotReadings: [], oracleReadings: [], lenormandReadings: [],
      meditation: [], journal: [], gratitude: []}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    /* The Kitchen and Money halves come from KinCrux and normalise their
       own documents in Python. An empty {} is not one of those, and money
       walks data.goals on load -- so the real empty shapes are given here
       rather than letting an unrelated module throw during boot. */
    kc_available: async () => true,
    kc_get_data: async () => ({photos: [], albums: [], photoTagList: [],
      folders: [], events: [], contacts: [], recipes: [], menus: [],
      shoppingLists: [], books: [], tagList: []}),
    kc_save_data: async () => ({ok: true}),
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {},
      goals: [], spendingLog: {periodStart: "", entries: []},
      calc: {bills: [], income: []}}),
    kc_save_money: async () => ({ok: true}),
    kc_money_stamp: async () => 0,
    training_load: async () => ({exercises: {}, circuits: [], sessions: [],
      guides: [], questionnaires: [], calendars: [], athletes: [],
      equipment: [], circuitTypes: [], lessonPlans: []}),
    training_save: async () => ({ok: true}),
    training_stamp: async () => 0,
    training_get_prefs: async () => ({}),
    training_set_prefs: async () => ({ok: true}),
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    notes_list_tree: async () => [],
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}),
    boards_list: async () => [],
    cells_list: async () => [],
    notebooks_list: async () => [],
  };
  const api = new Proxy({}, {
    get: (t, n) => (typeof n === "string"
      ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined),
  });
  const dom = new JSDOM(fs.readFileSync(path.join(UI, "index.html"), "utf8"),
    {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia
    || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  /* jsdom's <audio> cannot play; the PLAYER's own logic is what is being
     tested, so the element is stubbed and its paused state kept honest. */
  w.HTMLMediaElement.prototype.play = function () {
    this.__p = true; return Promise.resolve();
  };
  w.HTMLMediaElement.prototype.pause = function () { this.__p = false; };
  w.HTMLMediaElement.prototype.load = function () {};
  Object.defineProperty(w.HTMLMediaElement.prototype, "paused", {
    get() { return !this.__p; }, configurable: true});
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
  for (const src of declaredScripts()) {
    w.eval(fs.readFileSync(path.join(UI, src), "utf8"));
  }
  await wait(600);
  return w;
}

/* Press a real button in the real bar, the way a person does. */
const press = (w, id) => {
  const b = w.document.getElementById(id);
  if (!b) return false;
  b.dispatchEvent(new w.MouseEvent("click", {bubbles: true, cancelable: true}));
  return true;
};
const P = (w) => w.SS.Music.Player;
const go = async (w, v) => { w.SS.go(v); await wait(250); };

(async () => {
  /* ---- 1. from a cold start, having never opened Music -------------- */
  {
    const w = await boot();
    ok("the bar's buttons are wired before Music has ever been opened",
      !!w.document.getElementById("cc-mini-play").onclick,
      "the top bar belongs to the whole app, not to the music section");

    await go(w, "photos");
    ok("  and nothing is queued yet, as on any fresh launch",
      P(w).queue.length === 0 && P(w).index === -1,
      JSON.stringify({q: P(w).queue.length, i: P(w).index}));

    press(w, "cc-mini-play");
    await wait(400);
    ok("pressing play from Photos starts the library",
      P(w).queue.length > 0 && P(w).index === 0,
      JSON.stringify({q: P(w).queue.length, i: P(w).index})
      + " -- this is the whole of Cam's report: the button was wired, and "
      + "then returned early because the queue was empty");
    ok("  and the bar says what is playing",
      /Track/.test(w.document.getElementById("cc-mini-title").textContent),
      w.document.getElementById("cc-mini-title").textContent);
  }

  /* ---- 2. every other section, not just Photos ---------------------- */
  {
    const SECTIONS = ["photos", "games:home", "div:tarot", "mind:meditation",
                      "notes:vault", "cells:list", "boards:list", "guides:index",
                      "books:list", "home:dashboard", "money:dashboard",
                      "training:sessions", "recipes", "music:library"];
    const dead = [];
    for (const v of SECTIONS) {
      const w = await boot();
      await go(w, v);
      press(w, "cc-mini-play");
      await wait(350);
      if (!P(w).queue.length) dead.push(v);
    }
    ok("play starts music from every section of the app", !dead.length,
      "did nothing in: " + dead.join(", "));
  }

  /* ---- 3. skipping, once something is going -------------------------- */
  {
    const w = await boot();
    await go(w, "photos");
    press(w, "cc-mini-play");
    await wait(400);
    const first = P(w).index;
    press(w, "cc-mini-next");
    await wait(350);
    ok("next moves on from another section", P(w).index === first + 1,
      `${first} -> ${P(w).index}`);
    press(w, "cc-mini-prev");
    await wait(350);
    ok("  and prev goes back", P(w).index === first, String(P(w).index));

    /* The queue must survive walking around the app -- that IS background
       play, and the audio element is on document.body for this reason. */
    const before = P(w).queue.length;
    for (const v of ["notes:vault", "games:home", "cells:list", "photos"]) {
      await go(w, v);
    }
    ok("  and the queue survives walking around the app",
      P(w).queue.length === before && P(w).index === first,
      JSON.stringify({q: P(w).queue.length, i: P(w).index}));
  }

  /* ---- 4. next and prev start it too, when nothing is going ---------- */
  {
    const w = await boot();
    await go(w, "notes:vault");
    press(w, "cc-mini-next");
    await wait(400);
    ok("next starts the library when nothing is queued",
      P(w).queue.length > 0, JSON.stringify({q: P(w).queue.length}));
  }
  {
    const w = await boot();
    await go(w, "games:home");
    press(w, "cc-mini-prev");
    await wait(400);
    ok("  and so does prev", P(w).queue.length > 0,
      JSON.stringify({q: P(w).queue.length}));
  }

  /* ---- 5. what must NOT start it ------------------------------------ */
  /* A track ending calls next(true). If that started the library out of
     nowhere, an album finishing would silently begin playing everything
     you own -- the opposite of stopping. */
  {
    const w = await boot();
    await go(w, "photos");
    const player = P(w);
    /* one track, played to its end */
    player.playQueue([{file: "t0.flac", title: "Only"}], 0);
    await wait(350);
    const audio = w.document.querySelector("audio");
    ok("there is a real audio element on the page, outside every shell",
      !!audio && audio.parentElement === w.document.body,
      "background play depends on the audio living above the shells");
    if (audio) {
      /* The branch this guards is next() with an EMPTY queue and
         auto=true: the last track removed while it played, and then it
         ends. Firing "ended" on a one-track queue never reaches it -- the
         first version of this check did that and passed while the guard
         was removed, which is to say it was checking nothing. */
      player.playQueue([], 0);
      await wait(200);
      audio.dispatchEvent(new w.Event("ended"));
      await wait(350);
      ok("a track ending does NOT start the whole library",
        P(w).queue.length === 0,
        "queue became " + P(w).queue.length + " -- playback reaching its "
        + "end must stop, never begin playing everything you own");
    }
  }

  /* ---- 6. with no music at all, it says so --------------------------- */
  /* Silence is the one answer that leaves a person wondering whether the
     button is broken, which is how this was reported in the first place. */
  {
    const w = await boot({tracks: 0});
    const said = [];
    const realToast = w.CH.toast;
    w.CH.toast = (msg, kind) => { said.push(String(msg)); return realToast(msg, kind); };
    await go(w, "photos");
    press(w, "cc-mini-play");
    await wait(400);
    ok("with no music at all, pressing play says so",
      said.some((m) => /no music/i.test(m)),
      JSON.stringify(said) + " -- doing nothing silently is what made this "
      + "look like a broken button");
    ok("  and nothing is left half-started",
      P(w).queue.length === 0 && P(w).index === -1,
      JSON.stringify({q: P(w).queue.length, i: P(w).index}));
  }

  /* ---- 7. the queue popover opens everywhere too --------------------- */
  /* Cam, after the buttons were fixed: "please fix this mini pop up, it
     only opens when in music main section."

     Same shape of fault, different mechanism. #cc-queue-pop was the first
     child of #ch-shell, and the router hides every element whose id ends
     in "-shell" the moment you leave its section. A child of a hidden
     element cannot be shown, whatever class is put on it -- so the
     popover was told to open, TOOK the class, computed display: block,
     and still measured 0x0. Measured exactly that: 330x526 in Music and
     0x0 everywhere else, hidden by "ch-shell [hidden]".

     jsdom has no layout, so a width cannot be measured here. What CAN be
     checked without layout is the thing that actually decided it: which
     element the popover lives inside, and whether anything above it is
     hidden. That is the whole bug. */
  {
    const w = await boot();
    const doc = w.document;
    const pop = doc.getElementById("cc-queue-pop");
    ok("the queue popover is in the top bar, not inside the music shell",
      !!pop && !!pop.closest("#ss-topbar") && !pop.closest("#ch-shell"),
      "parent is " + (pop && pop.parentElement ? pop.parentElement.id : "?")
      + " -- the router hides every -shell, and a child of a hidden "
      + "element cannot be shown");

    /* And prove it stays reachable as the router does its work. */
    const buried = [];
    for (const v of ["photos", "games:home", "notes:vault", "cells:list",
                     "training:sessions", "home:dashboard", "music:library"]) {
      await go(w, v);
      let hiddenBy = null;
      for (let n = pop; n && n !== doc.body; n = n.parentElement) {
        if (n.hidden) { hiddenBy = n.id || n.tagName; break; }
      }
      if (hiddenBy) buried.push(`${v} (hidden by ${hiddenBy})`);
    }
    ok("  and nothing hides it in any section", !buried.length, buried.join(", "));

    /* Pressing the button must also actually open it, from outside Music. */
    await go(w, "notes:vault");
    press(w, "cc-mini-play");
    await wait(350);
    press(w, "cc-mini-note");
    await wait(300);
    ok("  pressing the queue button from another section opens it",
      pop.classList.contains("open"), pop.className);
    ok("  and it has been filled in, not left empty",
      /ccq-now/.test(pop.innerHTML) && /ccq-controls/.test(pop.innerHTML),
      pop.innerHTML.slice(0, 60));
  }

  /* ---- 8. and it is styled where it now lives ------------------------ */
  /* Moving it broke its looks before it fixed anything: every one of its
     inner rules was written as "#ch-shell .ccq-..." and stopped matching.
     It arrived in the bar with its glass panel and none of its contents --
     unstyled grey rows in a cramped column.

     topbar.css is GENERATED from the music styles by make_topbar_css.py,
     so the fix belongs in the generator, not in the generated file. This
     checks the output has the popover's insides and not just its box. */
  {
    const bar = fs.readFileSync(path.join(UI, "topbar.css"), "utf8");
    ok("the generated bar stylesheet carries the popover's own box",
      /#ss-topbar \.cc-queue-pop\b/.test(bar)
      && /#ss-topbar \.cc-queue-pop\.open/.test(bar));
    const insides = ["ccq-now", "ccq-art", "ccq-title", "ccq-seek",
                     "ccq-controls", "ccq-list", "ccq-row", "ccq-vol"];
    const missing = insides.filter((c) => !bar.includes(c));
    ok("  and everything inside it", !missing.length,
      "not carried across: " + missing.join(", ")
      + " -- the generator's filter matched \"cc-queue\" but not \".ccq-\"");
    const gen = fs.readFileSync(path.join(APP, "make_topbar_css.py"), "utf8");
    ok("  because the generator asks for them",
      /\\.ccq-/.test(gen),
      "topbar.css is generated; a hand-edit here is undone by the next run");
  }

  /* ---- 7. the seam the fix hangs on --------------------------------- */
  {
    const w = await boot();
    ok("the player asks the library for its tracks through a hook",
      typeof P(w)._library === "function",
      "the player is defined before the library exists, so it must not "
      + "reach forward into it -- the same shape _onDuration already uses");
    ok("  which is set at startup, not when Music is first opened",
      (P(w)._library() || []).length > 0,
      "otherwise the bar could not start anything until you had visited "
      + "the music section, which is the bug this is fixing");
  }

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
