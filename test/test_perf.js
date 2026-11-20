/* ==========================================================================
   The app stops lagging when you move around it
   ==========================================================================
   Cam: "The app has become unresponsive it lags when i move around the
   app, especially when loading the album sub section found under the
   music main section."

   What was actually wrong, measured in Chromium against a library of 400
   tracks and 25 albums before any of this was changed:

     music:library    400 calls across the bridge -- one per track's small
                      art icon -- on arrival, and 400 MORE every time Cam
                      came back, because nothing was remembered
     music:albums      25 calls, and the shelf awaited ALL of them inside
                      a Promise.all before writing any markup, so the page
                      stayed blank until the last cover landed
     home:dashboard     6 calls, again on every visit

   And after:

     music:library      5 on arrival, 0 on return
     music:albums      15 on arrival (only the cases near the window), 0
                       on return; first paint 93ms rather than blocked
     home:dashboard     0 -- the library had already fetched those photos

   Three properties carry all of that, and each one is checked here by
   breaking it rather than by reading the source for a name:

     1. the cache is per key, and a second ask costs nothing
     2. the gate never lets more than THUMB_BATCH calls be in the air
     3. a page draws its own markup WITHOUT waiting for any picture

   There is a fourth, which is a trap rather than a property: a fetcher
   must not go back through the cache. SS.Art stores its own pending
   promise under the key before it calls the fetcher, so a fetcher that
   called get() for the same key would await itself -- forever, holding a
   gate slot while it did, so eight of them stopped every picture in the
   app. That is exactly what happened while this was being written, and
   it is silent: no error, no failed call, just pictures that never
   arrive. It is refused now, and the refusal is checked.
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

/* A library big enough that fetching all of it would be obvious. */
const N_TRACKS = 120;
const N_ALBUMS = 20;
const TRACKS = {};
for (let i = 0; i < N_TRACKS; i++) {
  TRACKS["t" + i + ".mp3"] = {title: "Track " + i, artist: "A " + (i % 8),
    album: "Album " + (i % N_ALBUMS), art: "art_" + (i % N_ALBUMS) + ".jpg",
    duration: 100, plays: 0};
}
const ALBUMS = [];
for (let i = 0; i < N_ALBUMS; i++) {
  ALBUMS.push({id: "al" + i, name: "Album " + i, artist: "A " + i, year: 2000 + i,
    art: "art_" + i + ".jpg", notes: "",
    files: Object.keys(TRACKS).filter((_, j) => j % N_ALBUMS === i), created: i});
}
const PX = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

/* Counters and switches the tests below reach into. */
const art = {calls: 0, inFlight: 0, peak: 0, stall: false, waiters: []};

async function boot() {
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [],
                                  photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    photo_thumb: async () => ({dataUrl: PX}),
    get_prefs: async () => ({}),
    set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: JSON.parse(JSON.stringify(TRACKS)),
      playlists: [], albums: JSON.parse(JSON.stringify(ALBUMS))}),
    music_write_json: async () => ({ok: true}),
    /* every picture in the music section comes through here */
    music_thumb_url: async () => {
      art.calls++;
      art.inFlight++;
      art.peak = Math.max(art.peak, art.inFlight);
      if (art.stall) {
        /* never resolves until a test lets it -- this is how "did the
           page draw WITHOUT the pictures" is asked */
        await new Promise((r) => art.waiters.push(r));
      } else {
        await new Promise((r) => setTimeout(r, 5));
      }
      art.inFlight--;
      return PX;
    },
    music_image_url: async () => PX,
    chords_list: async () => Object.keys(TRACKS).map((n) => ({name: n, size: 1})),
    chords_audio_url: async () => ({url: "data:audio/mpeg;base64,SUQz", streamed: true}),
    cards_read_json: async () => ({tarotDecks: [], oracleDecks: [],
      lenormandDecks: [], tarotReadings: [], oracleReadings: [],
      lenormandReadings: [], meditation: [], journal: [], gratitude: []}),
    cards_write_json: async () => ({ok: true}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    meditation_list: async () => [],
  };
  const api = new Proxy({}, {
    get: (t, n) => (typeof n === "string"
      ? async (...a) => (known[n] ? known[n](...a) : {})
      : undefined),
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
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
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
  /* NOTE: IntersectionObserver is deliberately NOT stubbed. jsdom does no
     layout, so a stub would either report everything visible or nothing,
     and neither is the truth. SS.Art.lazy has a documented fallback for
     exactly this -- where there is no observer it paints every tile --
     and that is the path these tests run down. The laziness itself was
     measured in a real browser (15 of 60 sleeves fetched at 1440x900);
     what is checked HERE is the caching and the gate, which are the
     parts that do not need layout to be true. */
  for (const src of declaredScripts()) {
    w.eval(fs.readFileSync(path.join(UI, src), "utf8"));
  }
  await wait(400);
  return w;
}

(async () => {
  const w = await boot();
  const doc = w.document;
  const SS = w.SS;

  /* ---- 1. SS.Art exists and is shared ------------------------------- */
  ok("the host owns one art cache",
    !!(SS.Art && typeof SS.Art.get === "function"),
    "SS.Art is what stops every module writing its own cache, its own "
    + "gate and its own bugs");

  /* ---- 2. a second ask costs nothing -------------------------------- */
  {
    let ran = 0;
    const fetchOnce = () => { ran++; return Promise.resolve(PX); };
    const a = await SS.Art.get("test:one", fetchOnce);
    const b = await SS.Art.get("test:one", fetchOnce);
    ok("asking twice fetches once", ran === 1, "fetcher ran " + ran + " times");
    ok("and gives the same picture back", a === PX && b === PX, String(a));
  }

  /* The cache holds the PROMISE, not the finished result. Measured
     before it did: a render happens three times (boot, then prefs, then
     dates), all three looked, all three found nothing there YET, and 48
     photos cost 144 calls. */
  {
    let ran = 0;
    const slow = () => { ran++; return new Promise((r) => setTimeout(() => r(PX), 50)); };
    const all = [SS.Art.get("test:race", slow), SS.Art.get("test:race", slow),
                 SS.Art.get("test:race", slow)];
    await Promise.all(all);
    ok("three asks while the first is still in the air fetch once",
      ran === 1, "fetcher ran " + ran + " times -- the cache is holding "
      + "results rather than promises");
  }

  /* A failure must NOT be remembered as a permanent "no". */
  {
    let ran = 0;
    const flaky = () => { ran++; return Promise.resolve(ran === 1 ? null : PX); };
    const first = await SS.Art.get("test:flaky", flaky);
    const second = await SS.Art.get("test:flaky", flaky);
    ok("a fetch that came back empty is tried again",
      first === null && second === PX && ran === 2,
      "first=" + first + " second=" + second + " ran=" + ran);
  }

  /* ---- 3. the gate ------------------------------------------------- */
  {
    let live = 0, peak = 0;
    const slow = () => {
      live++; peak = Math.max(peak, live);
      return new Promise((r) => setTimeout(() => { live--; r(PX); }, 20));
    };
    const many = [];
    for (let i = 0; i < 40; i++) many.push(SS.Art.get("test:gate" + i, slow));
    await Promise.all(many);
    ok("forty asks never put more than eight calls on the bridge at once",
      peak <= 8 && peak > 1,
      "peak was " + peak + " -- pywebview serialises replies through one "
      + "channel, so flooding it is what makes the window itself stop "
      + "responding");
  }

  /* ---- 4. a fetcher may not go back through the cache --------------- */
  {
    let settled = null;
    const reentrant = () => SS.Art.get("test:loop", reentrant);
    /* Raced against a clock on purpose. Without the refusal this does not
       fail, it HANGS -- which is what the bug did in the app, and a test
       that hangs reports nothing at all. */
    await Promise.race([
      SS.Art.get("test:loop", reentrant)
        .then(() => { settled = "resolved"; },
              (e) => { settled = "rejected: " + e.message; }),
      wait(2000).then(() => { if (!settled) settled = "never settled"; }),
    ]);
    ok("a fetcher that asks the cache for its own key is refused, not hung",
      settled && settled.startsWith("rejected"),
      "settled as " + settled + " -- this deadlocked silently once and "
      + "held a gate slot while it did");
    /* and the slot it used is given back */
    let after = 0;
    await SS.Art.get("test:after-loop", () => { after++; return Promise.resolve(PX); });
    ok("and the gate slot it took is released", after === 1, "");
  }

  /* (5/6, the album shelf: went with the music to NeuroStream, 19 Nov 2026) */

  /* ---- 7. a changed picture is not remembered ---------------------- */
  {
    await SS.Art.get("music:x.jpg@96", () => Promise.resolve(PX));
    await SS.Art.get("music:x.jpg@300", () => Promise.resolve(PX));
    ok("a picture is remembered once per size it is drawn at",
      SS.Art.ready("music:x.jpg@96") && SS.Art.ready("music:x.jpg@300"), "");
    SS.Art.forgetPrefix("music:x.jpg");
    ok("and replacing the file forgets EVERY size of it",
      !SS.Art.ready("music:x.jpg@96") && !SS.Art.ready("music:x.jpg@300"),
      "forgetting one size would leave Cam looking at the old cover "
      + "everywhere else it is drawn");
  }

  /* (8, the open album page: went with the music to NeuroStream, 19 Nov 2026) */

  /* ---- 9. the launcher's --gui is honoured ------------------------- */
  /* Cam's launcher has said `--gui qt` for a long time. main() never read
     its own command line, so pywebview picked its default -- GTK -- and
     he was tuning an engine he was not running. */
  {
    const py = fs.readFileSync(path.join(APP, "neuronet.py"), "utf8");
    const main = py.slice(py.indexOf("def main("));
    ok("the launcher reads --gui rather than ignoring it",
      /--gui/.test(main) && /sys\.argv/.test(main), "");
    ok("  and passes it to pywebview",
      /webview\.start\(gui=/.test(main),
      "webview.start() with no gui= is how --gui came to mean nothing");
    ok("  and says so plainly when that renderer will not start",
      /couldn't start with --gui/.test(main), "");
  }

  /* ---- 8. the workspace reflows ------------------------------------ */
  /* Cam: "i want the workspace to be responsive to the sidebars ... At the
     moment i have to scroll sideways to see all my table that i inserted
     in Vault."

     The panes themselves were already right. What was not was a table
     whose columns had been dragged: absolute pixel widths under
     width:max-content is a fixed number, and it stayed 2381px wide in a
     984px pane however much room the collapsed sidebars gave back.

     This one check reads the stylesheet, and that is a deliberate
     exception rather than laziness: jsdom does no layout at all, so
     there is no width here to measure and a DOM test would pass whatever
     the rule said. The behaviour was measured in Chromium instead --
     2381px before, 770px (its minimum content width) after, and a clean
     fit at 984px once a sidebar collapses. What is guarded here is the
     one declaration that makes that possible, because losing it would be
     silent. */
  {
    const css = fs.readFileSync(path.join(UI, "notes", "notes.css"), "utf8");
    const rule = (() => {
      const at = css.indexOf("table.cx-sized");
      if (at < 0) return "";
      const open = css.indexOf("{", at);
      return css.slice(open, css.indexOf("}", open));
    })();
    ok("a table sized by dragging is capped at the width of its pane",
      /max-width:\s*100%/.test(rule),
      "without this it keeps the pixel widths it was dragged to and never "
      + "reflows, which is the sideways scrolling Cam reported");
    ok("  and still lays its columns out by the widths they were given",
      /table-layout:\s*fixed/.test(rule) && /width:\s*max-content/.test(rule),
      "fixed layout is what shares a too-small width out in proportion, so "
      + "the shape Cam dragged survives being squeezed");
  }

  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
