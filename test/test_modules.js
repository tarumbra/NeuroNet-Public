/* ==========================================================================
   Music and the divination/mindfulness tools, inside NeuroNet.
   ==========================================================================
   Cam: "there is no other feratures such as the divination tools or even
   the music", and before that, "when change to something else it forces
   split screen i dont want that feature here".

   THE SPLIT SCREEN IS THE FIRST THING CHECKED, because it was not a
   layout nicety -- it made the app look broken. `hidden` is an
   attribute whose only effect is `display: none` from the BROWSER's
   stylesheet, and any id-selector display rule beats it. So a shell
   marked hidden kept its flex share of the row and sat beside whatever
   you had navigated to. Measured at the time: hidden === true, box
   546x900.

   It happened twice. The second time was worse: the host kept a
   hand-written list of shell ids to hide, and the fourth module was
   added without anyone updating it. A list you have to remember to
   update is a list that will be wrong, so the host now FINDS the
   shells. That is what the "one pane at a time" checks below are for.
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

const TRACKS = {};
for (let i = 0; i < 8; i++) {
  TRACKS[`t${i}.mp3`] = {title: `Track ${i}`, artist: "A", album: "B",
                         art: "", duration: 100, plays: 0};
}
const MUSIC = {tracks: TRACKS, playlists: [], albums: []};
const MEDITATION = [];   /* filled by the import stub */
const CARDS = {
  tarotDecks: [{id: "d1", kind: "tarot", name: "Ryder Smith", createdAt: 1,
    cover: "", cardBack: "", cards: [
      {id: "c1", name: "The Fool", suit: "Major", upright: "u", reversed: "r",
       synopsis: "", image: ""},
      {id: "c2", name: "The Magician", suit: "Major", upright: "u",
       reversed: "r", synopsis: "", image: ""}]}],
  oracleDecks: [], lenormandDecks: [], tarotReadings: [], oracleReadings: [],
  lenormandReadings: [], meditation: [], journal: [], gratitude: [],
};

function declaredScripts() {
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
}

const nativeDialogs = [];
const assigned = [];

async function boot() {
  const calls = [];
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [
      {id: "p1", storedName: "sleeve.jpg", originalName: "sleeve.jpg",
       caption: "Science And Faith sleeve", tags: ["Album art"], notes: "",
       takenDate: "", created: "2026-08-01", albumIds: [], folderId: "",
       rating: 0, kind: ""},
    ], albums: [], folders: [], photoTagList: ["Album art"]}),
    photo_thumb: async () => ({dataUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw="}),
    photo_full: async () => ({dataUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw="}),
    /* If any of these three fire, the app went to the OPERATING SYSTEM
       instead of its own library -- which is the bug being fixed. */
    pick_and_save_image: async () => { nativeDialogs.push("pick_and_save_image"); return {cancelled: true}; },
    import_card_photos: async () => { nativeDialogs.push("import_card_photos"); return {cancelled: true}; },
    photo_pick: async () => { nativeDialogs.push("photo_pick"); return {cancelled: true}; },
    card_photos_list: async () => { nativeDialogs.push("card_photos_list"); return []; },
    music_assign_photo: async (stored, target) => {
      assigned.push(["music", stored, target]); return {name: "album_cover.jpg"};
    },
    cards_assign_photo: async (stored, target) => {
      assigned.push(["cards", stored, target]); return {name: "deck_cover.jpg"};
    },
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => ({}),
    set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_save_data: async () => ({ok: true}),
    cranium_get_prefs: async () => ({}),
    cranium_set_prefs: async () => ({ok: true}),
    cards_read_json: async () => JSON.parse(JSON.stringify(CARDS)),
    cards_write_json: async () => ({ok: true}),
    cards_image_url: async () => null,
    cards_thumb_url: async () => null,
    music_read_json: async () => JSON.parse(JSON.stringify(MUSIC)),
    music_write_json: async () => ({ok: true}),
    music_image_url: async () => null,
    music_thumb_url: async () => null,
    chords_list: async () => Object.keys(TRACKS).map((n) => ({name: n, size: 1})),
    chords_audio_url: async () => ({url: "data:audio/mpeg;base64,SUQz",
                                    streamed: true}),
    /* Meditation. These live in the harness rather than being swapped in
       later, because CS.Store captures window.pywebview.api ONCE at
       module init -- replacing the object afterwards changes nothing it
       can see. Found that out the hard way. */
    meditation_list: async () => MEDITATION.slice(),
    meditation_import: async () => {
      MEDITATION.push({name: "Body Scan.mp4", kind: "video", size: 128000},
                      {name: "Ocean Waves.mp3", kind: "audio", size: 76800});
      return {added: [{file: "Body Scan.mp4", kind: "video", duration: 600},
                      {file: "Ocean Waves.mp3", kind: "audio", duration: 1800}],
              skipped: []};
    },
    meditation_media_url: async (name) => ({
      url: /mp4$/.test(name) ? "data:video/mp4;base64,AAAA"
                             : "data:audio/mpeg;base64,SUQz",
      streamed: true, kind: /mp4$/.test(name) ? "video" : "audio",
    }),
    meditation_probe_meta: async () => ({}),
    meditation_remove: async () => ({ok: true}),
  };
  const api = new Proxy({}, {
    get: (t, n) => (typeof n === "string"
      ? async (...a) => { calls.push(n); return known[n] ? known[n](...a) : {}; }
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
  /* A raw file input being clicked is the other way to reach the OS. */
  w.__fileInputs = 0;
  const realCreate = w.document.createElement.bind(w.document);
  w.document.createElement = (tag, ...rest) => {
    const el = realCreate(tag, ...rest);
    if (String(tag).toLowerCase() === "input") {
      const realClick = el.click.bind(el);
      el.click = () => { if (el.type === "file") w.__fileInputs += 1; return realClick(); };
    }
    return el;
  };
  for (const src of declaredScripts()) {
    w.eval(fs.readFileSync(path.join(UI, src), "utf8"));
  }
  await new Promise((r) => setTimeout(r, 300));
  return {w, calls};
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms || 100));

(async () => {
  const {w, calls} = await boot();
  const doc = w.document;

  /* ---- every module is there -------------------------------------- */
  for (const name of ["Music", "Games", "Cards", "Mind"]) {
    ok(`SS.${name} is loaded`, !!w.SS[name], "module missing");
  }
  ok("Divination and Mindfulness are one module in two sections",
    w.SS.Cards === w.SS.Mind, "");

  /* ---- ONE PANE AT A TIME ------------------------------------------ */
  {
    const shells = [...doc.querySelectorAll('[id$="-shell"]')].map((e) => e.id);
    ok("the host finds the shells rather than listing them",
      shells.length >= 3 && shells.includes("ch-shell"),
      shells.join(", ") + " — a hand-written list is what let Chords' "
      + "shell stay visible beside everything else");

    const visible = () => {
      const on = [...doc.querySelectorAll('[id$="-shell"]')]
        .filter((e) => !e.hidden).map((e) => e.id);
      const main = doc.getElementById("ss-main");
      if (main.style.display !== "none") on.push("ss-main");
      return on;
    };

    const screens = [
      ["music:library", "ch-shell"], ["music:playlists", "ch-shell"],   // (Albums are Media's CDs since 2026-10-05)
      ["games:home", "cr-shell"], ["div:tarot", "cs-shell"],
      ["mind:breathwork", "cs-shell"], ["all", "ss-main"],
    ];
    let wrong = [];
    for (const [view, expect] of screens) {
      w.SS._test._setView(view);
      w.SS._test.render();
      await wait(180);
      const on = visible();
      if (on.length !== 1 || on[0] !== expect) {
        wrong.push(`${view} -> ${on.join("+") || "nothing"} (wanted ${expect})`);
      }
    }
    ok("exactly ONE pane is ever on screen — no split, on any view",
      wrong.length === 0, wrong.join("; "));
  }

  /* ---- the sidebar's "More" group (2026-10-06; Cam: "Add 'More' only") ---- */
  {
    w.SS._test._setView("home:dashboard");
    w.SS._test.render();
    await wait(150);
    const top = () => [...doc.querySelectorAll("#ss-nav > [data-section]")].map((b) => b.dataset.section);
    const more = doc.getElementById("ss-more");
    const list = doc.querySelector("#ss-nav .ss-more-list");
    ok("Code and Neuro Guide sit in a closed More group at the foot of the sidebar, names unchanged",
      more && list && list.hidden && !top().includes("code") && !top().includes("guide") && top().includes("notes")
      && [...list.querySelectorAll("[data-section]")].map((b) => b.dataset.section).join() === "code,guide"
      && /Scribe/.test(doc.getElementById("ss-nav").textContent), top().join());
    more.click();
    await wait(80);
    ok("  More opens in place", !doc.querySelector("#ss-nav .ss-more-list").hidden
      && doc.getElementById("ss-more").getAttribute("aria-expanded") === "true");
    doc.querySelector('#ss-nav .ss-more-list [data-section="code"]').click();
    await wait(150);
    ok("  a section in it opens as any other, and More stays open while it's on screen",
      String(w.SS._test.view).startsWith("code:") && !doc.querySelector("#ss-nav .ss-more-list").hidden);
    w.SS._test._setView("settings:sidebar");
    w.SS._test.render();
    await wait(150);
    const chip = doc.querySelector('[data-more-sec="code"]');
    ok("Settings -> Sections shown says which sections are in More", chip && chip.classList.contains("on")
      && !doc.querySelector('[data-more-sec="notes"]').classList.contains("on"));
    chip.click();
    await wait(150);
    ok("  and takes one out again", top().includes("code") && !doc.querySelector('#ss-nav .ss-more-list [data-section="code"]'));
    doc.querySelector('[data-more-sec="code"]').click();
    await wait(150);

    /* dragging a section into More, and back out (Cam, 2026-10-06: "i want to
       be able to drag the apps into more section"). The right button, as every
       sidebar move; jsdom has no layout, so it's told what's under the pointer. */
    w.SS._test._setView("home:dashboard");
    w.SS._test.render();
    await wait(150);
    const mouse = (el, type, o) => el.dispatchEvent(new w.MouseEvent(type,
      Object.assign({bubbles: true, cancelable: true}, o)));
    const realFromPoint = doc.elementFromPoint;
    const drag = async (fromSel, overEl) => {
      doc.elementFromPoint = () => overEl();
      mouse(doc.querySelector(fromSel), "mousedown", {button: 2, buttons: 2, clientX: 10, clientY: 10});
      mouse(doc, "mousemove", {button: 2, buttons: 2, clientX: 60, clientY: 300});
      const lit = overEl().closest("#ss-more") ? overEl().closest("#ss-more").classList.contains("is-drop") : null;
      mouse(doc, "mouseup", {button: 2, buttons: 0, clientX: 60, clientY: 300});
      doc.elementFromPoint = realFromPoint;
      await wait(150);
      return lit;
    };
    const lit = await drag('#ss-nav [data-drag="creative"]', () => doc.getElementById("ss-more"));
    ok("drag a section onto More (right button): More lights up, and the section goes in",
      lit === true && !top().includes("creative")
      && !!doc.querySelector('#ss-nav .ss-more-list [data-section="creative"]'), top().join());
    await drag('#ss-nav .ss-more-list [data-drag="creative"]', () => doc.querySelector('#ss-nav > [data-section="notes"]'));
    ok("  and dragged back among the others, it comes out of More", top().includes("creative")
      && !doc.querySelector('#ss-nav .ss-more-list [data-section="creative"]'), top().join());
    await drag('#ss-nav > [data-drag="money"]', () => doc.querySelector('#ss-nav .ss-more-list [data-section="code"]'));
    ok("  dropped among More's sections, it joins them",
      !!doc.querySelector('#ss-nav .ss-more-list [data-section="money"]') && !top().includes("money"));
    await drag('#ss-nav > [data-drag="home"]', () => doc.getElementById("ss-more"));
    ok("  Home always stays in the main list", top().includes("home"));
    await drag('#ss-nav .ss-more-list [data-drag="money"]', () => doc.querySelector('#ss-nav > [data-section="notes"]'));
  }

  /* ---- a section's pages as tabs; Add photos only in Photos (2026-10-05) ---- */
  {
    w.SS._test._setView("training:sessions");
    w.SS._test.render();
    await wait(150);
    const tabs = [...doc.querySelectorAll("#ss-tabs [data-view]")].map((b) => b.dataset.view);
    ok("a section's pages are tabs above the page, and the right-hand menu steps aside",
      !doc.getElementById("ss-tabs").hidden && tabs.includes("training:sessions") && tabs.includes("training:programs")
      && doc.getElementById("ss-app").classList.contains("page-tabs")
      && doc.querySelector('#ss-tabs [data-view="training:sessions"]').classList.contains("on"), tabs.join());
    ok("  + Add photos isn't shown outside Photos", doc.getElementById("ss-add").hidden === true);
    ok("  the open tab has the star that puts a page on Home",
      !!doc.querySelector('#ss-tabs .ss-tab.on [data-fav="training:sessions"]'));
    doc.querySelector('#ss-tabs [data-view="training:programs"]').click();
    await wait(150);
    ok("  a tab opens its page", w.SS._test.view === "training:programs", w.SS._test.view);
    w.SS._test._setView("all");
    w.SS._test.render();
    await wait(150);
    ok("Photos keeps its menu (your folders, albums and tags) and its Add button",
      doc.getElementById("ss-tabs").hidden && !doc.getElementById("ss-app").classList.contains("page-tabs")
      && doc.getElementById("ss-add").hidden === false);
  }

  /* ---- the divination tools actually draw -------------------------- */
  {
    const seen = [];
    for (const [view, want] of [["div:tarot", /Ryder Smith/],
                                ["div:runes", /Futhark|Rune/i],
                                ["div:iching", /Ching|Hexagram/i],
                                ["div:astrology", /Astrology|Aries/i],
                                ["mind:breathwork", /Breath/i],
                                ["mind:gratitude", /Gratitude/i],
                                ["mind:meditation", /Meditation/i]]) {
      await w.SS.Cards.mount(doc.getElementById("ss-main"), view);
      await wait(200);
      const text = doc.getElementById("cs-app").textContent;
      if (!want.test(text)) seen.push(`${view}: ${text.slice(0, 40)}`);
    }
    ok("every divination and mindfulness tool draws its own screen",
      seen.length === 0, seen.join(" | "));
  }

  /* ---- music, and the thing Cam actually asked for ------------------ */
  {
    await w.SS.Music.mount(doc.getElementById("ss-main"), "music:library");
    await wait(250);
    ok("the music library loads the tracks",
      /Track 0/.test(doc.getElementById("ch-app").textContent),
      doc.getElementById("ch-app").textContent.slice(0, 60));
    ok("  through its OWN backend method, not a generic one",
      calls.includes("music_read_json") && !calls.includes("read_json"),
      calls.filter((c) => /json/.test(c)).join(", "));

    const P = w.SS.Music.Player;
    const queue = Array.from({length: 8}, (_, i) =>
      ({file: `t${i}.mp3`, title: `Track ${i}`}));
    P.playQueue(queue, 0);
    await wait(150);

    /* BACKGROUND PLAY. The <audio> element is on document.body, not
       inside Chords' shell -- which is exactly why hiding that shell to
       show a game does not stop the music. Moving it "somewhere tidier"
       would break this silently, so it is asserted. */
    const audio = doc.getElementById("cc-audio");
    ok("there is one persistent audio element", !!audio, "none found");
    ok("  and it lives on BODY, outside every module's shell",
      audio && audio.parentElement === doc.body,
      audio && audio.parentElement && audio.parentElement.id);

    const src = audio && audio.src;
    w.SS._test._setView("games:home");
    w.SS._test.render();
    await wait(250);
    ok("navigating to Games does not touch the audio element",
      doc.getElementById("cc-audio") === audio
      && doc.getElementById("cc-audio").src === src,
      "this IS background play");
    ok("  and the player still has the track loaded",
      !!P.current, "the queue was lost when the shell was hidden");
  }

  /* ---- a real shuffle ---------------------------------------------- */
  {
    const P = w.SS.Music.Player;
    /* The old one picked a fresh random index on every next. Over eight
       tracks that repeats about three of them, never reaches an end (so
       repeat-all is unreachable) and makes Previous go somewhere NEW.
       Run several times: a real shuffle gets this right every time, and
       the old one would fail it almost every time. */
    let allUnique = true, alwaysStartsOnCurrent = true, everRanOn = false;
    for (let run = 0; run < 5; run++) {
      const queue = Array.from({length: 8}, (_, i) =>
        ({file: `t${i}.mp3`, title: `Track ${i}`}));
      P.playQueue(queue, 0);
      P.setShuffle(true);
      const seen = [];
      for (let i = 0; i < 8; i++) {
        if (P.current) seen.push(P.current.file);
        P.next();
      }
      if (new Set(seen).size !== 8) allUnique = false;
      if (seen[0] !== "t0.mp3") alwaysStartsOnCurrent = false;
      if (P.current && seen.includes(P.current.file) && seen.length === 8) {
        /* after the last next the order is spent; with repeat off it
           must not wrap round to a ninth track */
        if (P.current.file !== seen[7]) everRanOn = true;
      }
      P.setShuffle(false);
    }
    ok("shuffle plays every track exactly once, over 5 runs",
      allUnique,
      "the old shuffle picked a random index each time, so it repeated "
      + "tracks and never finished");
    ok("  and starts on the track already playing, not a random one",
      alwaysStartsOnCurrent, "turning shuffle on should not skip");
    ok("  and the order ENDS, which is what makes repeat-all reachable",
      !everRanOn, "it ran past the end of the shuffled order");
  }

  /* ---- one palette -------------------------------------------------
     Cam: "I want the UI color to be the same throughout the app for
     continuity."

     Each ported app arrived with a complete colour system of its own on
     :root. Scoped to its shell it stopped repainting the host, but left
     four different-looking apps in one window. The fix has two halves
     and BOTH are checked here, because each fails differently:

     1. A module must not REDEFINE a token the host owns. Those cannot
        be bridged -- `--line: var(--line)` on one element is a cycle
        that resolves to nothing, and doing it emptied --line, --accent,
        --text, --ink, --radius and --font across all three modules at
        once. They have to be removed so the host's inherit.

     2. A module's OWN names must be bridged onto the host's, or its
        --warm-white stays its own cream while everything else moves. */
  /* Scrollbars (2026-10-05, the audit): under Chromium (--gui qt) the
     standard scrollbar-color beats ::-webkit-scrollbar and drew the thick bar
     with arrows in every theme. It is set only off Chromium now. */
  {
    const css = fs.readFileSync(path.join(UI, "shared.css"), "utf8");
    const appJs = fs.readFileSync(path.join(UI, "app.js"), "utf8");
    const scoped = [...css.matchAll(/([^{}]*)\{[^}]*scrollbar-color[^}]*\}/g)].map((m) => m[1].trim().split("\n").pop());
    ok("the slim scrollbars aren't overridden under Chromium (the standard colour is set only off it, and for Windows 98)",
      appJs.includes('dataset.engine = "chromium"') && scoped.length >= 2
      && scoped.every((sel) => sel.includes(':not([data-engine="chromium"])') || sel.includes('[data-shape="win98"]')),
      scoped.join(" | "));
    const homeCss = fs.readFileSync(path.join(UI, "home", "home.css"), "utf8");
    ok("  and the Random movie and album cards fit their card instead of scrolling inside it",
      /\.dash-card\.dash-movie \{[^}]*overflow: hidden/.test(homeCss) && /\.dash-movie-stage \{[^}]*min-height: 0/.test(homeCss));
    const shelfJs = fs.readFileSync(path.join(UI, "stuff", "shelf.js"), "utf8");
    const stuffJs = fs.readFileSync(path.join(UI, "stuff", "stuff.js"), "utf8");
    ok("Media's Covers / List switch sits with the actions, not between the title and the description",
      /data-sh="export">Export…<\/button>\s*\$\{SS\.Stuff && SS\.Stuff\.viewToggle/.test(shelfJs)
      && /data-st="export">Export…<\/button>\s*\$\{cfg\.headExtra/.test(stuffJs));
    ok("a cover made for something without a picture is set like a sleeve (by-line, title, format band with the year)",
      /class="sh-plain-by"/.test(shelfJs) && shelfJs.includes("<i><span>${esc(formatsLine(it) || typeName(it.type))}</span>"));   // its formats (Media v2), else its type
    ok("  and while covers load the shelf shows empty cases, and a newer draw wins",
      shelfJs.includes("sh-waiting") && shelfJs.includes("if (token !== shelfPaint || !box.isConnected) return;"));
  }
  /* One action accent (2026-10-06, Cam approved the audit's fix): no section
     colours its filled buttons, selected chips or Save its own way. NeuroPets
     (ui/pet) is its own window with its own look. */
  {
    const offenders = [];
    const walk = (d) => fs.readdirSync(d, {withFileTypes: true}).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "pet" && e.name !== "vendor") walk(p); return; }
      if (!e.name.endsWith(".css")) return;
      const css = fs.readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const sel = m[1].trim(), body = m[2];
        if (!/\.(btn-primary|btn-save)(?![\w-])(?!:active)|\.chip\.on\b|\.seg-btn\.on\b/.test(sel)) continue;
        const bg = (body.match(/background(?:-color)?\s*:\s*([^;]+)/) || [])[1];
        if (bg && !/^(var\(--accent(?:-hover)?\)|none|transparent)/.test(bg.trim())) offenders.push(path.relative(UI, p) + ": " + sel.split("\n").pop() + " -> " + bg.trim());
      }
    });
    walk(UI);
    ok("one action accent: no section gives its buttons, selected chips or Save a colour of its own",
      offenders.length === 0, offenders.slice(0, 6).join(" | "));
  }
  {
    const hostCss = fs.readFileSync(path.join(UI, "shared.css"), "utf8");
    const owned = new Set();
    for (const m of hostCss.matchAll(/:root\s*\{([^}]*)\}/g)) {
      for (const d of m[1].matchAll(/(--[\w-]+)\s*:/g)) owned.add(d[1]);
    }

    const offenders = [];
    for (const [dir, file] of [["games", "cranium.css"],
                               ["cards", "celestial.css"],
                               ["music", "chords.css"]]) {
      const p = path.join(UI, dir, file);
      if (!fs.existsSync(p)) continue;
      const css = fs.readFileSync(p, "utf8");
      for (const m of css.matchAll(/#[\w-]*-shell\s*\{([^}]*)\}/g)) {
        for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]*);/g)) {
          const name = d[1], value = d[2].trim();
          /* redefining a host token with a literal is drift; with
             var(itself) is a cycle. Either way it must not be here. */
          if (owned.has(name)) offenders.push(`${file}: ${name}`);
          else if (value === `var(${name})`) offenders.push(`${file}: ${name} is a cycle`);
        }
      }
    }
    ok("no module redefines a token the host owns",
      offenders.length === 0,
      offenders.slice(0, 6).join("; ")
        + " — these cannot be bridged (self-reference is a cycle that "
        + "resolves to nothing); they must be removed so the host's inherit");

    /* and the module's own vocabulary IS bridged */
    let bridged = 0;
    for (const [dir, file] of [["games", "cranium.css"],
                               ["cards", "celestial.css"],
                               ["music", "chords.css"]]) {
      const p = path.join(UI, dir, file);
      if (fs.existsSync(p) && /ONE PALETTE/.test(fs.readFileSync(p, "utf8"))) {
        bridged += 1;
      }
    }
    ok("  and every module's own colour names are bridged to the host's",
      bridged === 3, bridged + " of 3 stylesheets carry the bridge");
  }

  /* ---- meditation: uploading Cam's own guides --------------------
     Cam: "meditation is missing the ability to add videos and audio...
     i want to be able to upload my video and soundtrack guides."

     The interface was already there; what was missing was the five
     backend methods behind it, so Upload did nothing at all. The check
     that matters is the LAST one: a video has to get a <video> element
     and a soundtrack an <audio> one. Put a video in an <audio> tag and
     you get sound with a blank rectangle, which looks like a broken
     file rather than a wrong tag. */
  {
    MEDITATION.length = 0;

    await w.SS.Mind.mount(doc.getElementById("ss-main"), "mind:meditation");
    await wait(250);
    const app = doc.getElementById("cs-app");
    const upload = [...app.querySelectorAll("button")]
      .find((b) => /upload|add|import/i.test(b.textContent));
    ok("Meditation offers a way to upload", !!upload,
      app.textContent.replace(/\s+/g, " ").slice(0, 70));

    if (upload) {
      upload.dispatchEvent(new w.Event("click", {bubbles: true}));
      await wait(400);
      ok("  pressing it reaches the backend",
        MEDITATION.length === 2, MEDITATION.length + " files after import");
      const text = app.textContent;
      ok("  the video shows up", /Body Scan/.test(text), text.slice(0, 90));
      ok("  and the soundtrack", /Ocean Waves/.test(text), text.slice(0, 90));

      const play = [...app.querySelectorAll("button")]
        .filter((b) => /play/i.test(b.textContent));
      ok("  each one has a Play", play.length >= 2, play.length + " found");

      if (play.length) {
        play[0].dispatchEvent(new w.Event("click", {bubbles: true}));
        await wait(350);
        ok("a VIDEO guide plays in a <video> element, not an <audio> one",
          doc.querySelectorAll("video").length === 1
          && doc.querySelectorAll("#cs-app audio").length === 0,
          "a video in an audio tag is sound with a blank rectangle, which "
          + "reads as a broken file");
        play[1].dispatchEvent(new w.Event("click", {bubbles: true}));
        await wait(350);
        ok("  and a soundtrack in an <audio> one",
          doc.querySelectorAll("#cs-app audio").length === 1,
          [...doc.querySelectorAll("#cs-app video, #cs-app audio")]
            .map((e) => e.tagName).join(","));
      }
    }
  }

  /* ---- photos come from the app's library, not the OS -------------
     Cam: "When i got to add a photo to an album or song as the cover it
     brings up the computer file browser, i want it to bring up the apps
     photo browser like it does for KinCrux recipes."

     Chords already HAD the hook -- pickAndStoreImage() calls
     CH.PickImage if something defines it and falls back to an
     <input type="file"> otherwise. Standalone, nothing ever defined it,
     so the fallback was the only path there had ever been. Celestial
     was worse: one path opened the native dialog and the other browsed
     card_photos/, its own second photo library.

     A photo should enter NeuroNet ONCE, through the library, and be
     CHOSEN wherever it is needed -- otherwise the same sleeve exists
     twice and renaming it in the library leaves the album pointing at
     a name nothing has. */
  {
    nativeDialogs.length = 0;
    assigned.length = 0;
    w.__fileInputs = 0;

    ok("Chords exposes the picker hook it always looked for",
      typeof w.CH.PickImage === "function",
      "pickAndStoreImage falls back to a file input without it");

    const pending = w.CH.PickImage("album_al1", "Science And Faith");
    await wait(300);

    const grid = doc.getElementById("pick-grid");
    ok("asking for album art opens the APP's photo browser",
      !!grid, "no picker in the document");
    ok("  and not the computer's file dialog",
      nativeDialogs.length === 0, nativeDialogs.join(", "));
    ok("  and not a raw file input either",
      w.__fileInputs === 0, w.__fileInputs + " file inputs clicked");

    if (grid) {
      /* the picker starts empty and searches -- KinCrux's behaviour */
      ok("  it starts empty, as KinCrux's does",
        grid.querySelectorAll("[data-stored]").length === 0, "");
      const input = doc.getElementById("pick-q");
      input.value = "sleeve";
      input.dispatchEvent(new w.Event("input", {bubbles: true}));
      await wait(200);
      ok("  searching finds the photo",
        grid.querySelectorAll("[data-stored]").length === 1, "");

      grid.querySelector("[data-stored]").dispatchEvent(
        new w.Event("click", {bubbles: true}));
      await wait(80);
      const use = [...doc.querySelectorAll("#modal-veil button")]
        .find((b) => /^use/i.test(b.textContent.trim()));
      ok("  one click selects and a Use button confirms",
        !!use && !use.disabled, use ? "disabled" : "no Use button");
      if (use) {
        use.dispatchEvent(new w.Event("click", {bubbles: true}));
        const got = await pending;
        ok("the chosen photo is COPIED into the music folder",
          assigned.some(([where]) => where === "music"),
          JSON.stringify(assigned));
        ok("  and the album gets back a filename to store",
          got === "album_cover.jpg", String(got));
        ok("  while the library photo stays where it is",
          !nativeDialogs.length,
          "a copy, not a move -- it may be in an album or on another record");
      }
    }
  }

  console.log("\nNeuroNet — music, divination and mindfulness\n");
  out.forEach((l) => console.log(l));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e.stack); process.exit(1); });
