/* ==========================================================================
   The Shelf, the Random movie widget, and the puzzle printouts
   ==========================================================================
   Cam: "a new sub section called Shelf ... select a type of media and it will
   be presented on a shelf ... search ... a page where i can edit and add
   movie blog, year, reflections and general notes. Also a star to add to
   favourites and a play button." Then: "a new widget called Random Movie ...
   upside down so you dont know what it is, but when clicked it flips over an
   presents the movie cover. When movie cover is clicked it opens the shelf
   entry." And: "fix the print feature for puzzle books/sheets to have this
   icon and fit the same design as the rest."

   The app booted in jsdom against a Media list kept here; test_shelf.py is
   the backend. Guarded in particular: editing a film in Stuff → Media must
   never wipe its review, star or cover -- Media's editor used to rebuild an
   item from the fields it shows.
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
const asyncFailures = [];
process.on("unhandledRejection", (r) => asyncFailures.push(String((r && r.message) || r)));

// Media v2 (15 Nov 2026): a kind with the formats it's owned in
let media = {types: [], mediaVersion: 2, items: [
  {id: "a", title: "The Ninth Gate", year: "1999", type: "film", formats: ["Blu-ray"], creator: "Roman Polanski", notes: "",
   cover: "2026-09-27T10:00:00"},
  {id: "b", title: "Send Help", year: "2026", type: "film", formats: ["DVD"], notes: ""},
  {id: "c", title: "Aliens", year: "1986", type: "film", formats: ["VHS"], notes: ""},
  {id: "d", title: "Harry Potter 2", year: "", type: "film", formats: ["DVD"], notes: ""},
  {id: "t", title: "Scorpion", year: "2014", type: "tv", formats: ["Digital"], notes: "",
   episodes: [{key: "s03e12", season: 3, episode: 12, name: "Ice Ca-Cabes"}, {key: "s03e13", season: 3, episode: 13, name: "Gone"}]},
  {id: "e", title: "Abbey Road", year: "1969", type: "music", formats: ["CD"], creator: "The Beatles", notes: ""},
]};
const FILMS = {folder: "/nn/Movies", players: ["mpv"], films: [
  {path: "The Ninth Gate (1999) [2160p]/The.Ninth.Gate.mkv", name: "The.Ninth.Gate.mkv", title: "The Ninth Gate", year: "1999", alt: "The Ninth Gate"},
  {path: "Send_Help_2026_1080p.mkv", name: "Send_Help_2026_1080p.mkv", title: "Send Help", year: "2026", alt: ""},
  {path: "Hoppers (2026)/Hoppers.mkv", name: "Hoppers.mkv", title: "Hoppers", year: "2026", alt: ""},
]};
const played = [], printed = [], coversSet = [];
const scanAsked = [], scanDone = [], pastedIn = [], clipAsked = [], urlsAsked = [], stills = [];
const CLIP = {now: {none: true}};
const SCAN = {
  "883929091270": {ok: true, code: "883929091270", found: true, type: "film", title: "Practical Magic", creator: "Griffin Dunne",
    year: "1998", format: "DVD", cover: "/cache/pm.jpg", preview: "data:image/jpeg;base64,PM", source: "UPC database"},
  "085391200000": {ok: true, code: "085391200000", found: true, type: "film", title: "The Ninth Gate", creator: "",
    year: "1999", format: "DVD", cover: "/cache/ng.jpg", preview: "", source: "UPC database"},
  "9780140328721": {ok: true, code: "9780140328721", found: true, type: "book", title: "Fantastic Mr. Fox", creator: "Roald Dahl",
    year: "1988", format: "Paperback", cover: "", preview: "", source: "Open Library"},
};
const fromPhoto = [], fromAlbum = [], stored = [];
let photos = {photos: [{storedName: "pc1.jpg", originalName: "pc1.jpg", caption: "Old sleeve", tags: ["Cover"],
  albumIds: [], folderId: "fCov"}], albums: [], folders: [{id: "fCov", name: "Covers", parentId: ""}],
  photoTagList: ["Cover"]};

async function run() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; nothing here can run without it)"); return; }

  const prefs = {dashBlocks: [{id: "b-rm", type: "randommovie", col: 0, slot: 0}]};
  let cranium = {stats: {}, saved: {}, wordLists: [], wordGuessList: [], slideImages: [], books: [
    {id: "bk1", name: "Holiday puzzles", created: "2026-09-26", puzzles: [
      {id: "p1", game: "sudoku", added: "", data: {puzzle: Array(81).fill(0).map((_, i) => i % 7 ? 0 : 5),
        solution: Array(81).fill(5), difficulty: "easy"}}]}]};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => JSON.parse(JSON.stringify(photos)),
    photo_save_data: async (d) => { photos = JSON.parse(JSON.stringify(d)); return {ok: true}; },
    photo_store: async (p) => { stored.push(p); return {storedName: "st" + stored.length + ".jpg", originalName: "x.jpg"}; },
    media_cover_file: async (id) => (id === "a" ? "/d/media_covers/a.jpg" : ""),
    media_cover_from_photo: async (id, st) => { fromPhoto.push([id, st]); return {ok: true, cover: "data:image/jpeg;base64,PHOTO"}; },
    media_cover_from_album: async (id, art) => { fromAlbum.push([id, art]); return {ok: true, cover: "data:image/jpeg;base64,ALB"}; },
    get_prefs: async () => JSON.parse(JSON.stringify(prefs)),
    set_prefs: async (p) => { Object.assign(prefs, p || {}); return {ok: true}; },
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    kc_available: async () => true,
    kc_get_data: async () => ({photos: [], albums: [], photoTagList: [], folders: [], events: [],
      contacts: [], recipes: [], menus: [], shoppingLists: [], books: [], tagList: []}),
    cranium_get_data: async () => JSON.parse(JSON.stringify(cranium)),
    cranium_save_data: async (d) => { cranium = JSON.parse(JSON.stringify(d)); return {ok: true}; },
    cranium_get_prefs: async () => ({}),
    stuff_load: async () => ({inventories: []}),
    effects_load: async () => JSON.parse(JSON.stringify(media)),
    effects_save: async (d) => { media = JSON.parse(JSON.stringify(d)); return {ok: true}; },
    media_films: async () => JSON.parse(JSON.stringify(FILMS)),
    media_covers: async (ids) => Object.fromEntries(ids.filter((i) => i === "a")
      .map((i) => [i, "data:image/jpeg;base64,COVER"])),
    media_cover_set: async (id, url) => { coversSet.push([id, url.slice(0, 20)]); return {ok: true, cover: url}; },
    media_cover_clear: async () => ({ok: true}),
    media_play: async (rel) => { played.push(rel); return {ok: true, player: "mpv"}; },
    /* 14 Nov 2026: ▶ Play opens Cinema's own player, which asks for the film */
    cinema_open: async (rel) => { played.push(rel); return {stream: "about:blank", duration: 100, resume: 0, subtitles: []}; },
    cinema_position: async () => ({ok: true}), cinema_stop: async () => ({ok: true}),
    // Aliens is only on VHS, with a video linked to it (Cam, 15 Nov 2026: "Films that are
    // only tagged VHS should still have the ability for me to link a video")
    media_links: async () => ({c: {ok: true, name: "Aliens.1986.mkv", folder: "/films"},
      "t-s03e12": {ok: true, name: "Scorpion - S03E12.mkv", folder: "/tv"}, "t-s03e13": {ok: false, name: "Scorpion - S03E13.mkv", folder: "/gone"}}),
    /* Scan (15 Nov 2026): stand-ins for barcodes.py */
    media_scan_lookup: async (code) => { scanAsked.push(code); code = code.replace(/^0(?=\d{12}$)/, ""); return SCAN[code] || {ok: true, code, found: false,
      type: "", title: "", creator: "", year: "", format: "", cover: "", preview: "", source: ""}; },
    media_scan_folder: async (read) => ({folder: "/refs/Art to Action/Barcodes", count: 2, pictures: read ? [
      {path: "/refs/Art to Action/Barcodes/b1.jpg", name: "b1.jpg", codes: ["9780140328721"], error: ""},
      {path: "/refs/Art to Action/Barcodes/b2.jpg", name: "b2.jpg", codes: [], error: "No barcode found"}] : []}),
    photo_store_data_url: async (u) => { pastedIn.push(u.slice(0, 22)); return {storedName: "paste" + pastedIn.length + ".png", originalName: "paste.png"}; },
    media_clipboard_picture: async () => { clipAsked.push(1); return CLIP.now; },
    media_picture_from_url: async (u) => { urlsAsked.push(u); return {path: "/cache/fetched.jpg"}; },
    media_film_still: async (rel) => { stills.push(rel); return {path: "/cache/still.jpg"}; },
    media_scan_done: async (p) => { scanDone.push(p); return {ok: true}; },
    print_header: async (t, o) => `<div class="LH">NeuroNet | ${t} | ${o.subtitle} | ${o.logo} ${o.name}</div>`,
    open_print_document: async (html, kind) => { printed.push([html, kind]); return {ok: true}; },
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
  w.cancelAnimationFrame = (id) => clearTimeout(id);
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {get: (t, n) =>
    n === "getImageData" ? () => ({data: [0, 0, 0, 255]}) : n === "measureText" ? () => ({width: 5})
      : () => ({addColorStop() {}})});
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(900);

  const thrown = [];
  w.addEventListener("error", (e) => thrown.push(String(e.message || e)));
  w.addEventListener("unhandledrejection", (e) =>
    thrown.push("unhandled: " + String((e.reason && e.reason.message) || e.reason)));
  const doc = w.document, $ = (s) => doc.querySelector(s), $$ = (s) => [...doc.querySelectorAll(s)];
  const SS = w.SS;
  const item = (id) => media.items.find((x) => x.id === id);

  /* ---- where it lives ------------------------------------------------------ */
  /* Shelf and Media are one page now (2026-10-02): Media opens on its covers. */
  SS.go("stuff:shelf"); await wait(900);
  ok("the old Shelf view opens Stuff → Media, on its covers",
    SS.where().view === "stuff:media" && !!$(".sh-shelf .sh-case"), SS.where().view);
  ok("  and the menu has Media but no Shelf of its own",
    $$("#ss-subnav-body [data-view]").some((b) => b.dataset.view === "stuff:media")
      && !$$("#ss-subnav-body [data-view]").some((b) => b.dataset.view === "stuff:shelf"));
  ok("  with Media's one + Add, Types, Print and Export, and Covers / List",
    ["add", "types", "print", "export"].every((k) => $(`[data-sh="${k}"]`)) && !!$('[data-mview="list"]'));

  /* ---- the shelf -------------------------------------------------------------- */
  const chips = $$("[data-type]").map((b) => b.dataset.type);
  ok("the types with something in them, films first, then Everything",
    chips.join() === "film,tv,music,*", chips.join());
  ok("  it starts on Film, every film once, alphabetical",
    $$(".sh-case .sh-cap").map((c) => c.textContent).join("|") === "Aliens|Harry Potter 2|Send Help|The Ninth Gate",
    $$(".sh-case .sh-cap").map((c) => c.textContent).join("|"));
  ok("  with the formats they're owned in to narrow it", $$(".sh-fmtchips [data-fmt]").map((b) => b.dataset.fmt).join()
    === ",DVD,Blu-ray,VHS", $$(".sh-fmtchips [data-fmt]").map((b) => b.dataset.fmt).join());
  ok("  a film in the Movies folder is marked ▶", !!$('[data-open="b"] .sh-hasfilm') && !$('[data-open="d"] .sh-hasfilm'));
  // Cam (15 Nov 2026): the ▶ plays it straight away, without opening the page
  $('[data-open="b"] [data-play]').click(); await wait(400);
  ok("  pressing the ▶ on a cover plays the film straight away, no page opened",
    played.at(-1) === FILMS.films[1].path && !!$(".cn-player") && !$(".sh-title"), played.join());
  $('[data-p="close"]').click(); await wait(700);
  ok("  and closing the player is back on the shelf", !!$(".sh-shelf") && !$(".cn-player"));
  $('.sh-fmtchips [data-fmt="Blu-ray"]').click(); await wait(400);
  ok("choosing Blu-ray shows its covers, in a Blu-ray case",
    $$(".sh-case").length === 1 && !!$('[data-open="a"] .sh-cover.sh-bluray img[src="data:image/jpeg;base64,COVER"]'));
  $('[data-type="*"]').click(); await wait(400);
  ok("  Everything shows every type", $$(".sh-case").length === 6, $$(".sh-case").length);
  ok("  and something without a cover gets its title on a plain one",
    /Aliens/.test(($('[data-open="c"] .sh-plain') || {}).textContent || ""));
  const q = $("#sh-q");
  q.value = "polanski"; q.dispatchEvent(new w.Event("input")); await wait(300);
  ok("search finds by who made it, not only the title",
    $$(".sh-case .sh-cap").map((c) => c.textContent).join() === "The Ninth Gate");
  q.value = ""; q.dispatchEvent(new w.Event("input")); await wait(300);

  /* ---- an entry ------------------------------------------------------------------- */
  $('[data-open="a"]').click(); await wait(600);
  ok("pressing a cover opens its page", /The Ninth Gate/.test(($(".sh-title") || {}).textContent || ""));
  ok("  with year, movie blog, reflections and notes",
    ["#sh-year", "#sh-review", "#sh-refl", "#sh-notes"].every((s) => $(s)));
  ok("  and it knows its film", /The\.Ninth\.Gate\.mkv/.test($("#sh-film").textContent) && !$("#sh-play").disabled);
  $("#sh-favbtn").click(); await wait(300);
  ok("the star makes it a favourite, saved", item("a").favourite === true && $("#sh-favbtn").classList.contains("on"));
  const typeIn = async (sel, v) => { const el = $(sel); el.value = v; el.dispatchEvent(new w.Event("input")); };
  await typeIn("#sh-review", "A bibliophile noir.");
  await typeIn("#sh-refl", "The woodcuts stayed with me.");
  await typeIn("#sh-notes", "4K copy.");
  await wait(1100);
  ok("what is written is saved as it is typed",
    item("a").review === "A bibliophile noir." && item("a").reflections === "The woodcuts stayed with me."
      && item("a").notes === "4K copy.", JSON.stringify(item("a")));
  $("#sh-play").click(); await wait(300);
  ok("▶ Play opens the film in Cinema's own player, right there (14 Nov 2026)",
    played.at(-1) === FILMS.films[0].path && !!$(".cn-player"), played.join());
  $('[data-p="close"]').click(); await wait(500);
  ok("  and closing the player comes back to the film's page", !!$("#sh-play") && !$(".cn-player"));
  if ($("#sh-back")) { $("#sh-back").click(); await wait(500); }
  $('[data-open="c"]').click(); await wait(600);
  ok("a film only on VHS, with a video linked, has a green Play",
    /Aliens/.test(($(".sh-title") || {}).textContent || "") && !$("#sh-play").disabled && $("#sh-play").classList.contains("sh-play-on"));
  $("#sh-play").click(); await wait(300);
  ok("  and it plays its linked video", played.at(-1) === "link:c" && !!$(".cn-player"), played.join());
  $('[data-p="close"]').click(); await wait(500);

  /* ---- Media must not wipe it -------------------------------------------------------- */
  SS.go("stuff:media"); await wait(600);
  if ($("#sh-back")) { $("#sh-back").click(); await wait(500); }
  $('[data-mview="list"]').click(); await wait(600);
  const ed = $$("button").find((b) => b.dataset && Object.values(b.dataset).includes("a")
    && /edit/i.test(b.textContent + b.title + Object.keys(b.dataset).join()));
  if (ed) {
    ed.click(); await wait(300);
    const t = $("#st-f-title"); t.value = "The Ninth Gate";
    $("#st-f-notes").value = "4K copy, boxed.";
    $$("button").find((b) => b.textContent.trim() === "Save").click(); await wait(600);
  }
  ok("editing a film in Media keeps its review, star and reflections",
    !!ed && item("a").review === "A bibliophile noir." && item("a").favourite === true
      && item("a").notes === "4K copy, boxed.", ed ? JSON.stringify(item("a")) : "no edit button");
  /* A save from a copy Media loaded before the Shelf wrote: disk wins for
     the fields Media doesn't edit. */
  item("a").reflections = "Written on the Shelf meanwhile.";
  const d2 = $$("button").find((b) => b.dataset && Object.values(b.dataset).includes("b")
    && /edit/i.test(b.textContent + b.title + Object.keys(b.dataset).join()));
  if (d2) {
    d2.click(); await wait(300);
    $$("button").find((b) => b.textContent.trim() === "Save").click(); await wait(600);
  }
  ok("  and a Media save made from an older copy doesn't undo the Shelf's writing",
    item("a").reflections === "Written on the Shelf meanwhile.", item("a").reflections);

  /* ---- Random movie ----------------------------------------------------------------- */
  SS.go("home:dashboard"); await wait(900);
  const card = $("#dash-movie-card");
  ok("Random movie deals a film face down", !!card && !card.classList.contains("turned"));
  const blockTitle = () => ($(".dash-movie .dash-card-h b") || {}).textContent;
  ok("  giving nothing away", blockTitle() === "Random movie");
  const dealt = SS.Shelf && card && (() => {
    const t = $(".dash-movie-front").textContent.trim(); return t;
  })();
  card.click(); await wait(200);
  ok("pressed, it turns over to show the cover and the title",
    card.classList.contains("turned") && ["The Ninth Gate", "Send Help", "Aliens", "Harry Potter 2"].includes(blockTitle()),
    blockTitle());
  ok("  only ever a film, never the CD", blockTitle() !== "Abbey Road");
  const title = blockTitle();
  card.click(); await wait(800);
  ok("pressed again, it opens that film's page in Media (even with Media last on List)",
    SS.where().view === "stuff:media" && ($(".sh-title") || {}).textContent === title,
    SS.where().view + " " + ($(".sh-title") || {}).textContent);

  /* ---- covers come from Photos, in the one Add dialog (2026-10-02) ------------------- */
  ok("a cover from before is moved into Photos → Covers once",
    stored.includes("/d/media_covers/a.jpg") && item("a").coverPhoto === "st1.jpg"
      && photos.photos.some((p) => p.storedName === "st1.jpg" && p.folderId === "fCov"),
    JSON.stringify({stored, coverPhoto: item("a").coverPhoto}));
  if ($("#sh-back")) { $("#sh-back").click(); await wait(500); }
  SS.go("stuff:media"); await wait(600);
  if ($('[data-mview="covers"]') && !$('[data-mview="covers"]').classList.contains("on")) {
    $('[data-mview="covers"]').click(); await wait(600);
  }
  $('[data-sh="add"]').click(); await wait(400);
  ok("+ Add asks for the cover with everything else", !!$("#sh-pick-prev") && !!$("#st-f-title")
    && !!$('[data-cv="photos"]') && !!$('[data-cv="new"]'));
  $('[data-cv="photos"]').click(); await wait(300);
  const tiles = $$("#sh-pick-grid .pick-tile");
  ok("  Choose from Photos opens inside the dialog, on Photos → Covers",
    tiles.length >= 1 && tiles.some((t) => t.dataset.stored === "pc1.jpg") && !!$("#st-f-title"),
    tiles.map((t) => t.dataset.stored).join());
  const pc = tiles.find((t) => t.dataset.stored === "pc1.jpg");
  if (pc) { pc.click(); await wait(200); }
  $("#st-f-title").value = "Rumours";
  $("#st-type").value = "music"; $("#st-type").dispatchEvent(new w.Event("change")); await wait(50);
  $('#st-formats [data-fmt="CD"]').click(); await wait(50);
  ok("  the preview takes a CD's shape", $("#sh-pick-prev").classList.contains("sh-cd"), $("#sh-pick-prev").className);
  $$("button").find((b) => b.textContent.trim() === "Add").click(); await wait(900);
  const rum = media.items.find((x) => x.title === "Rumours");
  ok("  added, with that photo as its cover", !!rum && fromPhoto.some(([id, st]) => id === rum.id && st === "pc1.jpg")
    && rum.coverPhoto === "pc1.jpg", JSON.stringify({rum, fromPhoto}));
  ok("  and the shelf shows it, on the CD shelf", !!$(`[data-open="${rum && rum.id}"]`), ($("#sh-shelf") || {}).innerHTML.slice(0, 200));
  const css = fs.readFileSync(path.join(UI, "stuff/shelf.css"), "utf8");
  ok("a CD's case is square, like an album sleeve", /\.sh-cd[,\s][^{]*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/.test(css));

  /* ---- CDs from Music ------------------------------------------------------------------- */
  const music = SS.Music;
  const songs = {al9: {name: "Tusk", artist: "Fleetwood Mac", year: "1979", art: "album_Tusk.jpg", tracks: [
    {title: "Over & Over", artist: "Fleetwood Mac", duration: 275, missing: false},
    {title: "The Ledge", artist: "Fleetwood Mac", duration: 125, missing: true},
    {title: "Think About Me", artist: "Fleetwood Mac", duration: 165, missing: false}]}};
  const playedAt = [];
  music.albumSongs = async (id) => songs[id] || null;
  music.playAlbumAt = async (id, from) => { playedAt.push([id, from]); return true; };
  const added = await SS.Stuff.media.addAlbum("al9");
  const tusk = media.items.find((x) => x.albumId === "al9");
  ok("a Music album goes onto the shelf as a CD: name, artist, year", !!tusk && tusk.type === "music" && (tusk.formats || []).includes("CD")
    && tusk.title === "Tusk" && tusk.creator === "Fleetwood Mac" && tusk.year === "1979", JSON.stringify(added));
  ok("  with the album's cover", fromAlbum.some(([id, art]) => id === (tusk || {}).id && art === "album_Tusk.jpg"));
  ok("  and only once", (await SS.Stuff.media.addAlbum("al9")).duplicate === true
    && media.items.filter((x) => x.albumId === "al9").length === 1);
  SS.Shelf.openEntry(tusk.id); await wait(900);
  const songBtns = $$("#sh-songs [data-song]");
  ok("its page lists the album's songs", $$("#sh-songs .sh-song").length === 3
    && /Over & Over/.test($("#sh-songs").textContent), ($("#sh-songs") || {}).textContent);
  ok("  a song not in the library can't be played", $$("#sh-songs .sh-song")[1].disabled);
  $$("#sh-songs .sh-song")[2].click(); await wait(200);
  ok("  pressing a song plays the album from it (counting only the playable ones)",
    JSON.stringify(playedAt.at(-1)) === JSON.stringify(["al9", 1]), JSON.stringify(playedAt));
  ok("  it's a Review, not a Movie blog", /Review/.test(($('label[for="sh-review"]') || {}).textContent || ""));
  const chordsSrc = fs.readFileSync(path.join(UI, "music/chords.js"), "utf8");
  ok("a new album goes straight onto the shelf as a CD (Albums live there since 2026-10-05)",
    /if \(media && media\.addAlbum\) await media\.addAlbum\(a\.id\);/.test(chordsSrc));
  if (songBtns.length) { /* drawn */ }

  /* ---- paste a cover into Edit (15 Nov 2026) ----------------------------------------- */
  // Cam: "if i copy Dust bunny cover have the edit window open and the window active,
  // pressing Ctrl + V will paste the photo in as the cover." Then: "I tried dragging and drop
  // from a photo on the internet didnt work, i tried copy and paste didnt work. Also remove
  // the change cover feature because it already lives in the edit details."
  {
    const m = SS.Stuff.media;
    await m.reload();
    const veilEl = () => doc.getElementById("modal-veil");
    const paste = (target, parts, data) => {
      const ev = new w.Event("paste", {bubbles: true, cancelable: true});
      ev.clipboardData = {items: parts, getData: (k) => (data || {})[k] || ""};
      target.dispatchEvent(ev);
      return ev;
    };
    const imgItem = () => ({kind: "file", type: "image/png", getAsFile: () => new w.File([new Uint8Array([137, 80, 78, 71])], "c.png", {type: "image/png"})});
    const storedNow = () => stored.length;

    m.itemDialog(m.doc.items.find((x) => x.id === "b")); await wait(300);
    ok("the Edit window says a cover can be pasted or dragged in", /Ctrl\+V/.test(veilEl().textContent) && /drag one onto this window/.test(veilEl().textContent));
    const t = $("#st-f-title");
    let ev = paste(t, [], {"text/plain": "Send Help (2026)"}); await wait(200);
    ok("  words pasted into a text box stay words", !ev.defaultPrevented && !clipAsked.length && pastedIn.length === 0);
    paste(t, [imgItem()]); await wait(400);
    ok("  a copied picture is the cover, even with the title box focused (into Photos, Covers)",
      pastedIn.length === 1 && /^data:image\/png/.test(pastedIn[0]) && !$('[data-cv="none"]').hidden
      && photos.photos.some((p) => p.storedName === "paste1.png" && p.folderId === "fCov"), pastedIn.join());
    paste(t, [], {"text/html": '<meta charset="utf-8"><img src="https://img.example/dust-bunny.jpg?w=600&amp;h=900" alt="">'}); await wait(400);
    ok("  a browser's copied picture that comes as its address is fetched",
      urlsAsked.at(-1) === "https://img.example/dust-bunny.jpg?w=600&h=900" && stored.at(-1) === "/cache/fetched.jpg", urlsAsked.join());
    CLIP.now = {path: "/cache/clip.png"};
    paste(t, [], {}); await wait(400);
    ok("  a paste the page can't see is read from the clipboard by NeuroNet itself",
      clipAsked.length === 1 && stored.at(-1) === "/cache/clip.png");
    CLIP.now = {none: true};
    const before = storedNow();
    paste(doc.body, [], {}); await wait(300);
    ok("  nothing on the clipboard: it says so, nothing changes", clipAsked.length === 2 && storedNow() === before);
    CLIP.now = {path: "/cache/clip.png"};
    doc.body.dispatchEvent(new w.KeyboardEvent("keydown", {key: "v", ctrlKey: true, bubbles: true})); await wait(500);
    ok("  Ctrl+V that fires no paste at all still reads the clipboard", clipAsked.length === 3 && storedNow() === before + 1);
    CLIP.now = {none: true};

    // drag and drop: anywhere on the window, a file or a web picture's address
    const modal = veilEl().querySelector(".modal");
    const drop = (dt) => { const e = new w.Event("drop", {bubbles: true, cancelable: true}); e.dataTransfer = dt; modal.querySelector("h3").dispatchEvent(e); return e; };
    drop({files: [], getData: (k) => (k === "text/uri-list" ? "https://img.example/db-poster.png" : "")}); await wait(400);
    ok("a picture dragged from a web page (its address) is fetched and is the cover",
      urlsAsked.at(-1) === "https://img.example/db-poster.png" && stored.at(-1) === "/cache/fetched.jpg");
    const n0 = pastedIn.length;
    drop({files: [new w.File([new Uint8Array([1, 2, 3])], "x.png", {type: "image/png"})], getData: () => ""}); await wait(400);
    ok("  a picture file dropped on it too", pastedIn.length === n0 + 1);
    const appSrc = fs.readFileSync(path.join(UI, "app.js"), "utf8");
    ok("  and the Photos import overlay keeps away while the window is open",
      /const ownDrop = \(\) => !!document\.querySelector\("#modal-veil\.open \[data-cover-drop\]"\)/.test(appSrc)
      && /if \(!hasFiles\(e\) \|\| ownDrop\(\)\) return;/.test(appSrc) && modal.hasAttribute("data-cover-drop"));
    await wait(300);
    ok("  Still from the film is here now (Send Help is in the Movies folder)", !!veilEl().querySelector('[data-cv="still"]'));
    veilEl().querySelector('[data-cv="still"]').click(); await wait(400);
    ok("    and takes a still into Photos as the cover", stills.at(-1) === "Send_Help_2026_1080p.mkv" && stored.at(-1) === "/cache/still.jpg");
    const saveB = [...veilEl().querySelectorAll(".dlg-row button")].find((b) => /Save/.test(b.textContent));
    const last = photos.photos.at(-1).storedName;
    saveB.click(); await wait(600);
    ok("saved, the last picture is the film's cover", item("b").coverPhoto === last, JSON.stringify(item("b")) + " " + last);
    const n = pastedIn.length, c = clipAsked.length;
    paste(doc.body, [imgItem()]); await wait(300);
    doc.body.dispatchEvent(new w.KeyboardEvent("keydown", {key: "v", ctrlKey: true, bubbles: true})); await wait(400);
    ok("  and once the window has closed, a paste does nothing here", pastedIn.length === n && clipAsked.length === c);

    // a CD from Music: Album cover lives in Edit now
    const cd = m.doc.items.find((x) => x.albumId);
    if (cd) {
      await m.reload();
      m.itemDialog(m.doc.items.find((x) => x.id === cd.id)); await wait(300);
      ok("a CD from Music has Album cover in Edit", !!veilEl().querySelector('[data-cv="album"]') && !veilEl().querySelector('[data-cv="still"]'));
      veilEl().querySelector(".dlg-row .btn-quiet").click(); await wait(100);
    }

    // the film's page: the cover is only a picture, no menu of its own
    SS.Shelf.openEntry("a"); await wait(700);
    const big = $("#sh-cover");
    ok("a film's page shows its cover with no Change cover on it",
      !!big && !big.querySelector(".sh-cover-hint") && !big.hasAttribute("tabindex") && !/Change cover/.test(big.textContent));
    big.click(); await wait(200);
    ok("  pressing it opens nothing", !veilEl().classList.contains("open"));
    if ($("#sh-back")) { $("#sh-back").click(); await wait(600); }

    // TV (18 Nov 2026, Cam: "add TV to media and things ... one episode of scorpion")
    SS.Shelf.openEntry("t"); await wait(700);
    const line = ($("#sh-film") || {}).textContent || "";
    ok("a TV show's page lists its episodes by season, the ones that are there playable",
       /1 episode/.test(line) && /Season 3/.test(line) && /S03 E12 · Ice Ca-Cabes/.test(line) && /1 not found/.test(line)
       && !$('[data-ep="s03e12"]').classList.contains("off") && $('[data-ep="s03e13"]').classList.contains("off"), line);
    ok("  and ▶ Play is on", $("#sh-play") && !$("#sh-play").disabled);
    const opened = [], realPlayer = SS.CinemaPlayer;
    SS.CinemaPlayer = {open: (h, o) => opened.push(o)};
    $('[data-ep="s03e12"]').click(); await wait(100);
    $("#sh-play").click(); await wait(100);
    SS.CinemaPlayer = realPlayer;
    ok("  an episode plays its own file; Play plays the ones there in order",
       opened.length === 2 && opened[0].items.length === 1 && opened[0].items[0].path === "link:t-s03e12"
       && /Scorpion S03 E12/.test(opened[0].items[0].label) && opened[1].items.map((x) => x.path).join() === "link:t-s03e12", JSON.stringify(opened));
    if ($("#sh-back")) { $("#sh-back").click(); await wait(600); }
  }

  /* ---- Scan (15 Nov 2026): a barcode into Media ------------------------------------ */
  SS.go("stuff:media"); await wait(900);
  if ($("#sh-back")) { $("#sh-back").click(); await wait(900); }     // off the album's page, back to Media
  if ($('[data-mview="covers"]') && !$('[data-mview="covers"]').classList.contains("on")) {
    ok("the List view has Scan too", !!$("[data-mscan]"));
    $('[data-mview="covers"]').click(); await wait(900);
  }
  const veil = () => doc.getElementById("modal-veil");
  const btnIn = (re) => [...veil().querySelectorAll(".dlg-row button")].find((b) => re.test(b.textContent));
  const scanBtn = $('[data-sh="scan"]');
  ok("Media's covers view has a Scan button beside + Add", !!scanBtn);
  if (scanBtn) {
    scanBtn.click(); await wait(300);
    const code = veil().querySelector("#sc-code");
    ok("  it opens on the barcode box, with photos and the Barcodes folder (2 waiting)",
      !!code && /Barcodes folder \(2\)/.test(veil().textContent) && /From photos/.test(veil().textContent));
    code.value = "0883929091270";
    btnIn(/Look up/).click(); await wait(400);
    ok("  Look up asks for the number and shows what it is, to check",
      scanAsked[0] === "0883929091270" && veil().querySelector("#sc-title").value === "Practical Magic"
      && veil().querySelector("#sc-year").value === "1998" && veil().querySelector("#sc-type").value === "film"
      && !!veil().querySelector('.sc-cover img'), scanAsked.join());
    ok("  with its format already ticked", !!veil().querySelector('#sc-formats [data-fmt="DVD"].on'));
    veil().querySelector('#sc-formats [data-fmt="VHS"]').click();
    const before = media.items.length, storedBefore = stored.length;
    btnIn(/^Add$/).click(); await wait(500);
    const pm = media.items.find((x) => x.title === "Practical Magic");
    ok("Add puts it in Media with its year, director, formats and barcode",
      media.items.length === before + 1 && pm && pm.type === "film" && pm.year === "1998" && pm.creator === "Griffin Dunne"
      && pm.formats.join() === "DVD,VHS" && (pm.barcodes || []).join() === "883929091270", JSON.stringify(pm));
    ok("  and its cover goes into Photos, Covers, and onto it",
      stored.length === storedBefore + 1 && stored.at(-1) === "/cache/pm.jpg" && pm.coverPhoto && fromPhoto.some(([id]) => id === pm.id));
    ok("  then the box is ready for the next one", !!veil().querySelector("#sc-code") && /Done: 1 in Media/.test(veil().textContent));

    // the same barcode again: the same film, nothing new
    veil().querySelector("#sc-code").value = "883929091270";
    btnIn(/Look up/).click(); await wait(400);
    ok("the same barcode again says it's already there", /Already in Media/.test(veil().textContent) && !!btnIn(/Add to it/));
    btnIn(/Add to it/).click(); await wait(400);
    ok("  and adding doesn't make a second one", media.items.filter((x) => x.title === "Practical Magic").length === 1);

    // a film already in Media, with Cam's own cover: the format goes on, the cover stays
    const ng0 = JSON.stringify(item("a").cover), photosBefore = stored.length;
    veil().querySelector("#sc-code").value = "085391200000";
    btnIn(/Look up/).click(); await wait(400);
    btnIn(/Add to it/).click(); await wait(400);
    ok("a film already there gets the new format, keeps its own cover",
      item("a").formats.join() === "Blu-ray,DVD" && JSON.stringify(item("a").cover) === ng0 && stored.length === photosBefore
      && (item("a").barcodes || []).includes("085391200000"), JSON.stringify(item("a")));

    // not found anywhere: typed in, the barcode kept
    veil().querySelector("#sc-code").value = "036000291452";
    btnIn(/Look up/).click(); await wait(400);
    ok("a barcode nobody knows opens empty, to type in", /Not found online/.test(veil().textContent)
      && veil().querySelector("#sc-title").value === "");
    veil().querySelector("#sc-title").value = "Home Movies";
    btnIn(/^Add$/).click(); await wait(400);
    ok("  and is kept with its barcode", (media.items.find((x) => x.title === "Home Movies") || {}).barcodes?.[0] === "036000291452");

    // the Barcodes folder: one read, one not
    veil().querySelector('[data-sc="folder"]').click(); await wait(500);
    ok("the Barcodes folder: the photo with a barcode comes up to check",
      veil().querySelector("#sc-title") && veil().querySelector("#sc-title").value === "Fantastic Mr. Fox"
      && /b1\.jpg/.test(veil().textContent));
    btnIn(/^Add$/).click(); await wait(500);
    ok("  added, its photo moves to the folder's Archive (the unreadable one stays)",
      media.items.some((x) => x.title === "Fantastic Mr. Fox" && x.type === "book" && x.formats.join() === "Paperback")
      && scanDone.join() === "/refs/Art to Action/Barcodes/b1.jpg", scanDone.join());
    veil().querySelector(".dlg-row button").click(); await wait(100);   // Close
  }
  const listSrc = fs.readFileSync(path.join(UI, "stuff", "stuff.js"), "utf8");
  ok("Media's List view has Scan too", /data-mscan/.test(listSrc) && /SS\.Shelf\.scanDialog\(\)/.test(listSrc));

  /* ---- puzzle printouts --------------------------------------------------------------- */
  SS.go("games:books"); await wait(1200);
  const openBk = $$("#cr-shell .bk-card[data-open]").find((x) => /Holiday/.test(x.textContent));
  if (openBk) { openBk.click(); await wait(800); }
  const pb = $$("#cr-shell button").find((x) => /Print book/.test(x.textContent));
  if (pb) { pb.click(); await wait(800); }
  const [bookHtml, kind] = printed.at(-1) || ["", ""];
  ok("a puzzle book prints on the shared letterhead with the puzzles mark",
    // since 2026-10-05 the cover's letterhead says what it is; the cover names the book
    /<div class="LH">NeuroNet \| Puzzle book \| {2}\| puzzles\.png puzzles<\/div>/.test(bookHtml) && /cover-title">Holiday puzzles</.test(bookHtml),
    bookHtml.slice(0, 300));
  ok("  every puzzle page too, named for its puzzle",
    /<div class="LH">NeuroNet \| Sudoku — easy \| Holiday puzzles \| puzzles\.png puzzles/.test(bookHtml));
  ok("  in the letterhead green, with no Cranium pink or brain left",
    /#2E6B38/.test(bookHtml) && !/C2185B/i.test(bookHtml) && !/>Cranium</.test(bookHtml));
  ok("  and still counted as a puzzle book", kind === "puzzle-book", kind);

  ok("nothing threw", !thrown.length && !asyncFailures.length, thrown.concat(asyncFailures).slice(0, 3).join(" | "));
}

run().then(() => {
  console.log("\nThe Shelf, Random movie and puzzle printouts\n");
  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
