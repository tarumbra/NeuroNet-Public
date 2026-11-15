/* ==========================================================================
   Notes → Journal, the dashboard's Random pull, and the rest of 2026-09-28's
   round: Divination's Readings removed, album auto-fill, press-and-sweep
   selection in Music and Photos.

   Cam: "a random pull widget for the dashboard, where i select the type of
   deck and it pulls a random card ... upside down then i click to flip (it
   can be either upright or reversed). From here i can add a quick journel
   entry, which will be entered into a new sub section of notes called
   journal." -- "remove the readings sub section from divination ... and just
   have the entry save to journal in the Notes main section under journal
   subsection (with the card images) ... i should also have the ability to
   add photos to jounral entries." -- "when creating an album in the music
   album section, have the cover and track auto fill" -- "a click and drag
   feature when in the select tool ... please also have this feature in
   photos when in select mode."

   Boots the real app in jsdom against a fake backend that records calls.
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

  const prefs = {dashBlocks: [{id: "b-rp", type: "randompull", col: 0, slot: 0}]};
  const calls = [];
  let journal = [
    {id: "jn-1", created: "2026-08-22T12:00:00", date: "2026-08-22",
     title: "Know Thyself · Wonderland", text: "Very accurate reading for me.",
     photos: ["beach.jpg"],
     reading: {kind: "tarot", deckName: "Wonderland", spreadName: "Know Thyself",
       cards: [{name: "The Hermit", image: "h.jpg", reversed: false, positionLabel: "Who am I?", meaning: "Solitude"},
               {name: "Justice", image: "j.jpg", reversed: true, positionLabel: "How?", meaning: "Unfair"}]}},
    {id: "jn-2", created: "2026-09-01T09:00:00", date: "2026-09-01",
     title: "", text: "A quiet day at the lake.", photos: [], reading: null},
  ];
  const celestial = {tarotDecks: [{id: "d1", name: "Crows", cover: null, cardBack: null, cards: [
    {id: "fool", name: "The Fool", suit: "Major", image: "fool.jpg", upright: "Leap", reversed: "Look first", synopsis: ""},
    {id: "magician", name: "The Magician", suit: "Major", image: "mag.jpg", upright: "Make", reversed: "Trick", synopsis: ""},
  ]}], oracleDecks: [], lenormandDecks: []};
  const photoDoc = {photos: ["a", "b", "c", "d", "e"].map((x, i) => ({
    id: "p" + x, storedName: x + ".jpg", originalName: x + ".jpg", caption: x, tags: [],
    albumIds: [], folderId: "", rating: 0, takenDate: "", created: "2026-09-0" + (i + 1), kind: ""})),
    albums: [], folders: [], photoTagList: []};
  let musicDoc = {tracks: {
    "Band - 02. Second.mp3": {title: "Second", artist: "Band", album: "Rumours", art: "rumours.jpg"},
    "Band - 01. First.mp3": {title: "First", artist: "Band", album: "Rumours", art: "rumours.jpg"},
    "Band - 03. Third.mp3": {title: "Third", artist: "Band", album: "Rumours", art: "single.jpg"},
    "Other - Song.mp3": {title: "Song", artist: "Other", album: "Elsewhere"},
  }, playlists: [], albums: []};
  const kitchenDoc = {photos: [], albums: [], photoTagList: [], folders: [],
    events: [], contacts: [], recipes: [], menus: [], shoppingLists: [], books: [], tagList: []};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 5}),
    photo_get_data: async () => JSON.parse(JSON.stringify(photoDoc)),
    photo_save_data: async () => ({ok: true}),
    photo_thumb: async () => ({dataUrl: "data:image/png;base64,AA=="}),
    get_prefs: async () => JSON.parse(JSON.stringify(prefs)),
    set_prefs: async (p) => { Object.assign(prefs, p || {}); return {ok: true}; },
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => JSON.parse(JSON.stringify(musicDoc)),
    music_write_json: async (n, d) => { musicDoc = JSON.parse(JSON.stringify(d)); return {ok: true}; },
    chords_list: async () => Object.keys(musicDoc.tracks).map((name) => ({name, size: 1000})),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [], wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    kc_available: async () => true,
    kc_get_data: async () => kitchenDoc,
    kc_save_data: async () => ({ok: true}),
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {}, goals: [],
      spendingLog: {periodStart: "", entries: []}, calc: {bills: [], income: []}}),
    training_load: async () => ({exercises: {}, circuits: [], sessions: [], guides: [],
      questionnaires: [], calendars: [], athletes: [], equipment: [], circuitTypes: [], lessonPlans: []}),
    training_get_prefs: async () => ({}),
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    notes_list_tree: async () => [],
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}),
    boards_list: async () => [], cells_list: async () => [], notebooks_list: async () => [],
    fleeting_list: async () => [],
    cards_read_json: async () => JSON.parse(JSON.stringify(celestial)),
    cards_thumb_url: async (n) => "data:image/png;base64,CARD-" + n,
    journal_list: async () => JSON.parse(JSON.stringify(journal)),
    journal_image_url: async (n) => "data:image/png;base64,J-" + n,
    journal_save: async (e) => {
      calls.push(["save", JSON.parse(JSON.stringify(e))]);
      const entry = Object.assign({id: "jn-new", created: "2026-09-28T10:00:00", reading: null}, e,
        {id: e.id || "jn-new"});
      journal = journal.filter((x) => x.id !== entry.id).concat([entry]);
      return {ok: true, entry};
    },
    journal_delete: async (id) => { calls.push(["delete", id]); journal = journal.filter((x) => x.id !== id); return {ok: true}; },
    journal_add_reading: async (reading, text, title) => {
      calls.push(["reading", JSON.parse(JSON.stringify({reading, text, title}))]);
      return {ok: true, entry: {id: "jn-r"}};
    },
    journal_pick_photos: async () => ({names: ["picked.jpg"], skipped: []}),
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((f) => setTimeout(f, 16));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{isIntersecting: true, target: el}]); } unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {}, lineTo() {}, stroke() {},
    fill() {}, save() {}, restore() {}, translate() {}, scale() {},
    createLinearGradient: () => ({addColorStop() {}}), setTransform() {}, closePath() {},
    getImageData: () => ({data: [0, 0, 0, 255]})});
  w.HTMLElement.prototype.scrollIntoView = function () {};
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(900);
  const doc = w.document, SS = w.SS;
  const $ = (sel, root) => (root || doc).querySelector(sel);
  const mouse = (el, type, o) => el.dispatchEvent(new w.MouseEvent(type,
    Object.assign({bubbles: true, cancelable: true}, o)));
  const btnByText = (text, root) => [...(root || doc).querySelectorAll("button")]
    .find((b) => b.textContent.trim() === text);
  const main = () => $("#ss-main");

  /* ---- the menus -------------------------------------------------------- */
  const sections = SS._test && SS._test.SECTIONS;
  const appJs = fs.readFileSync(path.join(UI, "app.js"), "utf8");
  const block = (key) => { const b = appJs.slice(appJs.indexOf(`{key: "${key}", name:`)); return b.slice(0, b.indexOf("]}")); };
  /* Cam: "fully migrate the journal to live in mindfullness, change the name
     from thought journal to just be journal." */
  ok("Mindfulness has the Journal, in Thought Journal's place",
    /\{key: "mind:journal", name: "Journal"\}/.test(block("mind"))
    && !/name: "Thought Journal"/.test(block("mind")));
  ok("  and Notes no longer does", !/journal/.test(block("notes")));
  ok("Divination has no Readings subsection any more", !block("divination").includes("div:readings"));
  void sections;
  SS.go("mind:journal");
  await wait(700);
  ok("Mindfulness → Journal opens the Journal", !!$(".jn-page", main())
    && $("#cs-shell").hidden !== false);
  ok("  under Mindfulness in the right-hand menu",
    /Mindfulness/i.test($("#ss-subnav-title").textContent));
  for (const old of ["div:readings", "journal:list"]) {
    SS.go(old);
    await wait(500);
    ok(`  the old ${old} view opens it too, under Mindfulness`, !!$(".jn-page", main())
      && !!$('#ss-subnav [data-view="mind:journal"].on'));
  }

  /* ---- the journal ------------------------------------------------------ */
  SS.go("mind:journal");
  await wait(700);
  const rows = [...main().querySelectorAll(".jn-row")];
  ok("entries are listed newest first", rows.length === 2
    && /quiet day/.test(rows[0].textContent) && /Know Thyself/.test(rows[1].textContent),
    rows.map((r) => r.textContent.replace(/\s+/g, " ").trim()).join(" | "));
  rows[1].click();
  await wait(300);
  const entry = $(".jn-entry", main());
  ok("a reading entry shows its cards", entry && entry.querySelectorAll(".jn-rc").length === 2);
  ok("  a reversed card is drawn upside down",
    entry && entry.querySelectorAll(".jn-rc-art.rev").length === 1
    && /Justice/.test(entry.querySelectorAll(".jn-rc")[1].textContent));
  ok("  with the card faces the journal kept", entry
    && entry.querySelector(".jn-rc img").src.includes("J-h.jpg"));
  ok("  and its photos", entry && entry.querySelectorAll(".jn-pic img").length === 1);
  const q = $("#jn-q", main());
  q.value = "hermit"; q.dispatchEvent(new w.Event("input"));
  ok("searching finds an entry by a card in it",
    main().querySelectorAll(".jn-row").length === 1);
  q.value = ""; q.dispatchEvent(new w.Event("input"));

  $("#jn-new", main()).click();
  await wait(200);
  ok("+ New entry opens a blank entry dated today", !!$("#jn-form", main())
    && $("#jn-date", main()).value === new Date().toISOString().slice(0, 10)
      .replace(/^(\d+)-(\d+)-(\d+)$/, (m) => {
        const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }));
  $("#jn-text", main()).value = "Wrote something personal.";
  $("#jn-add-file", main()).click();
  await wait(200);
  ok("photos from the computer are added to the entry",
    main().querySelectorAll(".jn-pics-edit .jn-pic").length === 1
    && $("#jn-text", main()).value === "Wrote something personal.");
  $("#jn-form", main()).dispatchEvent(new w.Event("submit", {cancelable: true}));
  await wait(300);
  const saved = calls.find((c) => c[0] === "save");
  ok("Save sends the entry with its words and photos",
    saved && saved[1].text === "Wrote something personal." && saved[1].photos[0] === "picked.jpg");

  /* ---- Divination saves to the journal ----------------------------------- */
  ok("Divination's pull says Save to Journal",
    fs.readFileSync(path.join(UI, "cards", "celestial.js"), "utf8").includes('id="pull-add-reading">Save to Journal'));
  const r = w.CS && w.CS.readingForJournal
    ? w.CS.readingForJournal("tarot", celestial.tarotDecks[0], "Two Card", [
      {cardId: "fool", name: "The Fool", image: "fool.jpg", reversed: true, positionLabel: "Past."},
      {cardId: "magician", name: "The Magician", image: "mag.jpg", reversed: false, positionLabel: "Now."}])
    : null;
  ok("a pull goes to the journal with each card's face and meaning the way it fell",
    r && r.kind === "tarot" && r.deckName === "Crows" && r.spreadName === "Two Card"
    && r.cards[0].meaning === "Look first" && r.cards[1].meaning === "Make"
    && r.cards[0].image === "fool.jpg", JSON.stringify(r));

  /* ---- the dashboard's Random pull --------------------------------------- */
  SS.go("home:dashboard");
  await wait(900);
  let card = $("#dash-pull-card", main());
  ok("Random pull deals a card face down", card && !card.classList.contains("turned")
    && /press to turn it over/.test($(".dash-pull", main()).textContent));
  ok("  from the kind of deck chosen on its tabs",
    main().querySelectorAll("[data-pull-kind]").length === 3
    && $("[data-pull-kind].on", main()).dataset.pullKind === "tarot");
  card.click();
  await wait(900);
  const open = $(".dash-pull-open", main());
  ok("pressing it turns it over: upright or reversed, with what it means",
    open && /^(Upright|Reversed)$/.test($(".dash-pull-way", open).textContent)
    && /(Leap|Look first|Make|Trick)/.test($(".dash-pull-meaning", open).textContent));
  const reversed = $(".dash-pull-way", open).textContent === "Reversed";
  ok("  a reversed card's face is upside down",
    $(".dash-pull-front", open).classList.contains("rev") === reversed);
  const note = $("#dash-pull-note", open);
  note.value = "Feels right today."; note.dispatchEvent(new w.Event("input"));
  $("#dash-pull-save", open).click();
  await wait(400);
  const pulled = calls.find((c) => c[0] === "reading");
  ok("Save to Journal sends the card, which way up, and the entry",
    pulled && pulled[1].text === "Feels right today." && pulled[1].reading.kind === "tarot"
    && pulled[1].reading.cards.length === 1 && pulled[1].reading.cards[0].reversed === reversed
    && /^(fool|mag)\.jpg$/.test(pulled[1].reading.cards[0].image), JSON.stringify(pulled && pulled[1]));
  ok("  and says it's saved", /Saved to your journal/.test(main().textContent));
  $('[data-pull-kind="oracle"]', main()).click();
  await wait(700);
  ok("choosing another kind is remembered on the widget",
    prefs.dashBlocks.find((b) => b.id === "b-rp").deckKind === "oracle");
  ok("  and a kind with no decks says so", /No oracle decks/.test($(".dash-pull", main()).textContent));

  /* ---- Music: a new album fills itself in ------------------------------- */
  /* Albums are Media's CDs since 2026-10-05: "+ New album" there opens this dialog */
  SS.go("music:library");
  await wait(900);
  const newAlbum = SS.Music && SS.Music.newAlbum;
  if (newAlbum) {
    await SS.Music.newAlbum();
    await wait(200);
    const input = $("#ch-an");
    input.value = "rumours"; input.dispatchEvent(new w.Event("input"));
    ok("naming an album that's on your songs says what will be filled in",
      /3 songs are already tagged/.test($("#ch-an-hint").textContent));
    btnByText("Create").click();
    await wait(400);
    const a = musicDoc.albums.find((x) => x.name === "rumours");
    ok("  the album is made with those tracks, in track order",
      a && JSON.stringify(a.files) === JSON.stringify(
        ["Band - 01. First.mp3", "Band - 02. Second.mp3", "Band - 03. Third.mp3"]), a && a.files.join(", "));
    ok("  with the cover most of them share, and their artist",
      a && a.art === "rumours.jpg" && a.artist === "Band");
  } else {
    ok("Music offers New album to Media's CDs", false);
  }

  /* ---- Music: press and sweep in select mode ------------------------------ */
  SS.go("music:library");
  await wait(900);
  $("#ch-select-toggle").click();
  await wait(300);
  let trackRows = [...doc.querySelectorAll("#ch-page [data-file], [data-file].ch-track")];
  trackRows = trackRows.filter((x, i, arr) => arr.indexOf(x) === i);
  const realFromPoint = doc.elementFromPoint;
  if (trackRows.length >= 3) {
    doc.elementFromPoint = () => trackRows[2];
    mouse(trackRows[0], "mousedown", {button: 0, buttons: 1});
    mouse(doc, "mousemove", {buttons: 1, clientX: 5, clientY: 200});
    mouse(doc, "mouseup", {button: 0});
    doc.elementFromPoint = realFromPoint;
    const picked = trackRows.filter((x) => x.classList.contains("ch-track-selected")).length;
    ok("Music: pressing a track and sweeping over two more selects all three", picked === 3, picked);
    ok("  and the bar counts them", /3 selected/.test(doc.body.textContent));
    doc.elementFromPoint = () => trackRows[1];
    mouse(trackRows[0], "mousedown", {button: 0, buttons: 1});
    mouse(doc, "mousemove", {buttons: 1, clientX: 5, clientY: 100});
    mouse(doc, "mouseup", {button: 0});
    doc.elementFromPoint = realFromPoint;
    ok("  a sweep that starts on a selected track clears instead",
      trackRows.filter((x) => x.classList.contains("ch-track-selected")).length === 1);
  } else {
    ok("Music: the library lists the tracks", false, trackRows.length);
  }
  $("#ch-select-toggle").click();
  await wait(200);

  /* ---- Photos: press and sweep in select mode ------------------------------ */
  SS.go("all");
  await wait(900);
  const sel = $("#ss-select");
  if (sel) {
    sel.click();
    await wait(200);
    const tiles = [...main().querySelectorAll("[data-photo]")];
    doc.elementFromPoint = () => tiles[3];
    mouse(tiles[1], "mousedown", {button: 0, buttons: 1});
    mouse(doc, "mousemove", {buttons: 1, clientX: 300, clientY: 100});
    mouse(doc, "mouseup", {button: 0});
    tiles[1].click();                 // the click that follows the press
    doc.elementFromPoint = realFromPoint;
    const picked = tiles.filter((t) => t.classList.contains("picked")).map((t) => t.dataset.photo);
    const run3 = tiles.slice(1, 4).map((t) => t.dataset.photo).sort().join(",");
    ok("Photos: pressing a photo and sweeping selects the run",
      picked.slice().sort().join(",") === run3 && picked.length === 3, picked.join(","));
    ok("  the click after the press doesn't undo it", tiles[1].classList.contains("picked"));
    ok("  and the selection bar counts them", /3 selected/.test(main().textContent));
  } else {
    ok("Photos has a Select button", false);
  }
}

run().then(() => {
  console.log("\nJournal, Random pull, album auto-fill, sweep selection\n");
  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}, (e) => {
  console.log(out.join("\n"));
  console.log("  FAIL  threw: " + (e && e.stack || e));
  process.exit(1);
});
