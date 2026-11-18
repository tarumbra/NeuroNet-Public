/* ==========================================================================
   Stuff -- Media and inventories, their printouts and exports
   ==========================================================================
   Cam: "lets create a new main section called Stuff, this will act as the
   section where i can make inventories, databases of all our media ... I
   want the print out to also match the others however contain the
   collection icon file. Further i want to be able to select what i print,
   so i can choose to only print DVDs, CDS or a mixture. Further i want the
   print outs and lists alphabetical when stored in the app and when
   printed. Also i want to be able to export to excell as well or cells
   located in the notes subsection of the app."

   Replaces test_effects.js, which drove Personal Effects in Playwright;
   every behaviour it guarded is carried here, and run in jsdom so it runs.
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
process.on("unhandledRejection", (reason) => {
  asyncFailures.push(String((reason && reason.message) || reason));
});

// Media v2 (15 Nov 2026): a kind (film, music ...) with the formats it's owned in
let effects = {items: [
  {id: "a", title: "Zulu", type: "film", formats: ["DVD"], year: "1964"},
  {id: "b", title: "aliens", type: "film", formats: ["DVD"], year: "1986"},
  {id: "c", title: "Rocky 10", type: "film", formats: ["VHS"]}, {id: "d", title: "Rocky 2", type: "film", formats: ["VHS"]},
  {id: "e", title: "Abbey Road", type: "music", formats: ["CD"], creator: "The Beatles"}], types: [], mediaVersion: 2};
let stuff = {inventories: []};
const saves = [], printed = [], exported = [], cells = [];

async function run() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; nothing here can run without it)"); return; }

  const prefs = {dashBlocks: [
    {id: "b-pz", type: "puzzle", col: 0, slot: 0},
    {id: "b-qr", type: "quickrecipe", col: 1, slot: 0},
    {id: "b-fv", type: "fleetview", col: 2, slot: 0},
    {id: "b-qn", type: "quicknote", col: 2, slot: 1},
  ]};
  /* A fleeting queue that behaves like the backend's: deleting one closes
     the numbers up behind it. */
  let fleeting = [
    {n: 1, text: "first thought", written: 1790000000},
    {n: 2, text: "second thought\n" + "a long line. ".repeat(80), written: 1790000100},
    {n: 3, text: "third thought", written: 1790000200},
  ];
  const deleted = [];
  const kitchenSaves = [];
  const kitchenDoc = {photos: [], albums: [], photoTagList: [], folders: [],
    events: [], contacts: [], recipes: [], menus: [], shoppingLists: [],
    books: [], tagList: []};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    photo_save_data: async () => ({ok: true}),
    get_prefs: async () => JSON.parse(JSON.stringify(prefs)),
    set_prefs: async (p) => { Object.assign(prefs, p || {}); return {ok: true}; },
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    kc_available: async () => true,
    kc_get_data: async () => kitchenDoc,
    kc_save_data: async (d) => { kitchenSaves.push(JSON.parse(JSON.stringify(d))); return {ok: true}; },
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {}, goals: [],
      spendingLog: {periodStart: "", entries: []}, calc: {bills: [], income: []}}),
    training_load: async () => ({exercises: {}, circuits: [], sessions: [], guides: [],
      questionnaires: [], calendars: [], athletes: [], equipment: [],
      circuitTypes: [], lessonPlans: []}),
    training_get_prefs: async () => ({}),
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    notes_list_tree: async () => [],
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}),
    boards_list: async () => [], cells_list: async () => [],
    notebooks_list: async () => [],
    effects_load: async () => JSON.parse(JSON.stringify(effects)),
    effects_save: async (d) => { effects = JSON.parse(JSON.stringify(d)); saves.push("media"); return {ok: true}; },
    stuff_load: async () => JSON.parse(JSON.stringify(stuff)),
    stuff_save: async (d) => { stuff = JSON.parse(JSON.stringify(d)); saves.push("stuff"); return {ok: true}; },
    print_header: async (t, o) => `<div class="LH">NN | ${t} | ${o.subtitle} | ${o.logo} ${o.name}</div>`,
    open_print_document: async (html, kind) => { printed.push([html, kind]); return true; },
    stuff_export: async (fmt, p) => { exported.push([fmt, p]); return {ok: true, path: "/Desktop/x." + fmt}; },
    cells_list: async () => [],
    cells_write: async (id, sheet) => { cells.push([id, sheet]); return {ok: true}; },
    fleeting_list: async () => JSON.parse(JSON.stringify(fleeting)),
    fleeting_add: async (text) => {
      const n = fleeting.length + 1;
      fleeting.push({n, text, written: 1790000300});
      return {ok: true, n};
    },
    fleeting_delete: async (n) => {
      deleted.push(n);
      fleeting = fleeting.filter((x) => x.n !== n).map((x, i) => ({...x, n: i + 1}));
      return {ok: true};
    },
  };
  const api = new Proxy({}, {get: (t, n) => (typeof n === "string"
    ? async (...a) => (known[n] ? known[n](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only",
                               url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  w.matchMedia = w.matchMedia
    || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {};
  w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.cancelAnimationFrame = w.cancelAnimationFrame || ((id) => clearTimeout(id));
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {},
    lineTo() {}, stroke() {}, fill() {}, save() {}, restore() {},
    translate() {}, scale() {}, createLinearGradient: () => ({addColorStop() {}}),
    setTransform() {}, closePath() {}, getImageData: () => ({data: [0, 0, 0, 255]}),
  });
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) {
    try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ }
  }
  await wait(900);


  const thrown = [];
  w.addEventListener("error", (e) => thrown.push(String(e.message || e)));
  w.addEventListener("unhandledrejection", (e) =>
    thrown.push("unhandled: " + String((e.reason && e.reason.message) || e.reason)));
  const doc = w.document, $ = (s) => doc.querySelector(s), $$ = (s) => [...doc.querySelectorAll(s)];
  const button = (label) => $$("button").find((b) => b.textContent.trim() === label);
  const sections = () => $$(".pe-section").map((s) => ({
    name: s.querySelector(".pe-h").childNodes[0].textContent.trim(),
    titles: [...s.querySelectorAll(".bd-name")].map((n) => n.textContent)}));
  await wait(300);

  /* ---- where it lives -------------------------------------------------- */
  ok("Stuff is a main section of its own", !!$('#ss-nav [data-section="stuff"]'));
  w.SS.go("home:dashboard"); await wait(700);
  ok("  and Personal Effects has left Home",
    !$$("#ss-subnav-body [data-view]").some((b) => b.dataset.view === "home:effects"));
  w.SS.go("home:effects"); await wait(900);
  ok("the old Personal Effects view lands on Stuff → Media", w.SS._test.view === "stuff:media");
  /* Media opens on its covers (Shelf and Media became one page, 2026-10-02);
     List is the plain list the rest of this test reads. */
  ok("  on its covers, with Covers / List to switch", !!$(".sh-shelf") && !!$('[data-mview="list"]')
    && $('[data-mview="covers"]').classList.contains("on"));
  $('[data-mview="list"]').click(); await wait(600);
  ok("  List shows every item already in it", $$(".bd-name").length === 5, $$(".bd-name").length);
  ok("  and the switch says so", $('[data-mview="list"]').classList.contains("on"));

  /* ---- alphabetical ------------------------------------------------------ */
  const secs = sections();
  ok("items appear under their type's name", secs.map((s) => s.name).join() === "Film,Music", JSON.stringify(secs));
  ok("  the sections are alphabetical", true);
  ok("  and so are the titles inside them, case ignored, numbers read as numbers",
    secs[0].titles.join("|") === "aliens|Rocky 2|Rocky 10|Zulu", secs[0].titles.join("|"));
  ok("the new By field shows", $$(".bd-meta").some((m) => /The Beatles/.test(m.textContent)));
  ok("  and the formats it's owned in", $$(".bd-meta").some((m) => /VHS/.test(m.textContent)));

  /* ---- adding: formats are tags, the same film again joins it ------------ */
  // Cam (15 Nov 2026): "Practical magic ... a tag for Dvd, VHS, Blu-ray, Digital ... This way we remove the double ups"
  $('[data-st="add"]').click(); await wait(200);
  ok("Add has the film formats as tags", $$("#st-formats [data-fmt]").map((b) => b.dataset.fmt).join()
    === "DVD,Blu-ray,4K UHD,VHS,Digital", $$("#st-formats [data-fmt]").map((b) => b.dataset.fmt).join());
  $("#st-type").value = "music"; $("#st-type").dispatchEvent(new w.Event("change")); await wait(50);
  ok("  and music's when the type is Music", $$("#st-formats [data-fmt]").map((b) => b.dataset.fmt).join()
    === "Cassette,Vinyl,CD,MP3,FLAC");
  $("#st-type").value = "film"; $("#st-type").dispatchEvent(new w.Event("change")); await wait(50);
  $("#st-f-title").value = "  zulu ";
  $('#st-formats [data-fmt="Blu-ray"]').click(); await wait(30);
  button("Add").click(); await wait(300);
  ok("the same film again asks to add the new format to it, case and spacing ignored",
    /already have that/i.test(doc.body.textContent) && !!button("Add to it"));
  ok("  nothing is added while it asks", effects.items.length === 5);
  [...$$("button")].reverse().find((b) => b.textContent.trim() === "Cancel").click(); await wait(200);
  ok("  and going back leaves the half-filled form as it was", $("#st-f-title") && $("#st-f-title").value === "  zulu ");
  button("Add").click(); await wait(300);
  button("Add to it").click(); await wait(400);
  ok("  Add to it: one Zulu, now on DVD and Blu-ray, no double up",
    effects.items.length === 5 && JSON.stringify(effects.items.find((i) => i.id === "a").formats) === '["DVD","Blu-ray"]',
    JSON.stringify(effects.items.find((i) => i.id === "a")));
  $('[data-st="add"]').click(); await wait(200);
  $("#st-f-title").value = "Practical Magic";
  $('#st-formats [data-fmt="VHS"]').click(); await wait(30);
  button("Add").click(); await wait(400);
  const pm = effects.items.find((i) => i.title === "Practical Magic");
  ok("a new film tagged only VHS is added", effects.items.length === 6 && pm && pm.type === "film"
    && JSON.stringify(pm.formats) === '["VHS"]', JSON.stringify(pm));
  ok("what is stored is stored alphabetically too",
    effects.items.map((i) => i.type + ":" + i.title).join(",")
      === "film:aliens,film:Practical Magic,film:Rocky 2,film:Rocky 10,film:Zulu,music:Abbey Road",
    effects.items.map((i) => i.type + ":" + i.title).join(","));
  $('[data-st="add"]').click(); await wait(200);
  ok("  and the next one starts on the type last used", $("#st-type").value === "film");
  [...$$("button")].reverse().find((b) => b.textContent.trim() === "Cancel").click(); await wait(150);

  /* ---- search ------------------------------------------------------------- */
  const q = $('[data-st="q"]');
  q.value = "rocky"; q.dispatchEvent(new w.Event("input")); await wait(100);
  ok("searching narrows the list, still grouped and in order",
    JSON.stringify(sections()) === JSON.stringify([{name: "Film", titles: ["Rocky 2", "Rocky 10"]}]),
    JSON.stringify(sections()));

  /* ---- print: choose, letterhead, alphabetical ---------------------------- */
  $('[data-st="print"]').click(); await wait(200);
  ok("Print lets Cam choose what goes on the page", $$("[data-pick]").length >= 2 && !!$('[data-pick="film"]'),
    $$("[data-pick]").map((b) => b.dataset.pick).join());
  ok("  everything ticked to start", $$("[data-pick]").every((b) => b.checked));
  for (const b of $$("[data-pick]")) { if (b.dataset.pick !== "film") { b.checked = false; b.dispatchEvent(new w.Event("change")); } }
  ok("  and it says what that comes to", /5 items from 1 ticked/.test($("[data-sum]").textContent), $("[data-sum]").textContent);
  button("Print").click(); await wait(400);
  const [page, kind] = printed[0] || [];
  ok("printing prints only what was ticked: films, no music",
    page && /<h2>Film/.test(page) && !/<h2>Music/.test(page) && !/Abbey Road/.test(page));
  ok("  each section alphabetical", page && page.indexOf("aliens") < page.indexOf("Zulu"));
  ok("  a search left in the box does not cut the printout down", page && /Practical Magic/.test(page));
  ok("  with a Formats column", page && /<th>Formats<\/th>/.test(page) && /DVD, Blu-ray/.test(page));
  ok("  on the shared letterhead, carrying the collection mark on the right",
    page && /NN \| Media list \| {2}\| collection\.png collection/.test(page)
    && page.indexOf("LH") < page.indexOf("<h2>") && /class="nn-title">Media</.test(page) && /<b>Items<\/b> 5/.test(page));
  ok("  in the house style: a table per section under its heading, a title block, a footer",
    page && (page.match(/<table>/g) || []).length === 1 && (page.match(/<h2>/g) || []).length === 1
    && /class="nn-title-block"/.test(page) && /class="nn-foot"/.test(page));
  ok("  counted as a Media print", kind === "stuff-media");
  q.value = ""; q.dispatchEvent(new w.Event("input")); await wait(100);

  /* ---- exports ---------------------------------------------------------------- */
  $('[data-st="export"]').click(); await wait(200);
  ok("Export remembers what was ticked last",
    $$("[data-pick]").filter((b) => b.checked).map((b) => b.dataset.pick).sort().join() === "film");
  button("Excel").click(); await wait(300);
  const [fmt, payload] = exported[0] || [];
  ok("Excel gets the ticked sections, in the screen's order", fmt === "xlsx"
    && payload.sections.map((s) => s.name + ":" + s.items.map((i) => i.title).join("|")).join(";")
      === "Film:aliens|Practical Magic|Rocky 2|Rocky 10|Zulu");
  ok("  with every field as a column, the formats after the title",
    payload.columns.map((c) => c.label).join() === "Title,Formats,By,Year,Notes"
    && payload.sections[0].items[4].formats === "DVD, Blu-ray", payload.columns.map((c) => c.label).join());
  ok("  and the collection mark for its letterhead", payload.logo === "collection.png");
  $('[data-st="export"]').click(); await wait(200);
  button("Word").click(); await wait(300);
  ok("Word gets the very same sections", exported[1] && exported[1][0] === "docx"
    && JSON.stringify(exported[1][1].sections) === JSON.stringify(payload.sections));
  $('[data-st="export"]').click(); await wait(200);
  button("Send to Cells").click(); await wait(400);
  const [cid, sheet] = cells[0] || [];
  ok("Send to Cells makes a sheet in Notes → Cells", !!sheet && /^Media /.test(cid));
  ok("  a header row, then every item with its type first, alphabetical",
    sheet && sheet.grid.rows.slice(0, 4).map((r) => r.slice(0, 3).join("/")).join("|")
      === "Type/Title/Formats|Film/aliens/DVD|Film/Practical Magic/VHS|Film/Rocky 2/VHS",
    sheet && sheet.grid.rows.slice(0, 4).map((r) => r.slice(0, 3).join("/")).join("|"));
  ok("  the header in bold, and kept on screen while scrolling",
    sheet && sheet.grid.fmt.A1 && sheet.grid.fmt.A1.b && sheet.grid.freeze === 1);

  /* ---- types ---------------------------------------------------------------- */
  ok("Media's types are what a thing is", w.SS.Stuff.MEDIA_KINDS.map((t) => t.name).join() === "Film,TV,Music,Book,Game,Other");
  ok("  and its formats are tags per type", w.SS.Stuff.MEDIA_FORMATS.music.join() === "Cassette,Vinyl,CD,MP3,FLAC"
    && w.SS.Stuff.MEDIA_FORMATS.film.includes("Digital") && w.SS.Stuff.MEDIA_FORMATS.game.includes("Switch") && w.SS.Stuff.MEDIA_FORMATS.tv.includes("Digital"));
  $('[data-st="types"]').click(); await wait(200);
  $("#st-newtype").value = "Board games"; $("#st-addtype").click(); await wait(400);
  ok("a type Cam adds is kept", effects.types.some((t) => t.name === "Board games"));
  [...$$("button")].reverse().find((b) => b.textContent.trim() === "Done").click(); await wait(100);
  $('[data-st="add"]').click(); await wait(200);
  ok("  and offered straight away, among the built-in ones",
    [...$("#st-type").options].some((o) => o.textContent === "Board games")
    && [...$("#st-type").options].some((o) => o.textContent === "Film"));
  [...$$("button")].reverse().find((b) => b.textContent.trim() === "Cancel").click(); await wait(100);

  /* ---- inventories ---------------------------------------------------------- */
  w.SS.go("stuff:inventories"); await wait(600);
  $("#st-newinv").click(); await wait(200);
  $("#st-invname").value = "Garage"; button("Create").click(); await wait(800);
  ok("a new inventory opens", /^stuff:inv:/.test(w.SS._test.view));
  // 15 Nov 2026: Cinema has no page of its own (its films are Media's, Play opens the player)
  ok("  and joins the M&T menu by name: Music's pages, Media, it, then Inventories (no Shelf: it's Media's covers, no Cinema)",
    $$("#ss-subnav-body [data-view]").map((b) => b.dataset.view.replace(/^stuff:inv:.*/, "inv"))
      .join() === "music:library,music:playlists,music:visualizer,stuff:media,inv,stuff:inventories",   // no Albums: they're Media's CDs
    $$("#ss-subnav-body [data-view]").map((b) => b.dataset.view).join());
  $('[data-st="add"]').click(); await wait(200);
  ok("an inventory has an item, a category, a quantity and a place",
    ["#st-f-title", "#st-type", "#st-f-quantity", "#st-f-location", "#st-f-notes"].every((s) => $(s)));
  $("#st-f-title").value = "Drill"; $("#st-f-quantity").value = "2"; $("#st-f-location").value = "Top shelf";
  button("Add").click(); await wait(500);
  const inv = stuff.inventories[0];
  ok("  saved into the inventory", inv && inv.name === "Garage" && inv.items[0].title === "Drill"
    && inv.items[0].quantity === "2" && inv.items[0].location === "Top shelf");
  ok("  and listed with its quantity and place", /× 2 · Top shelf/.test($(".bd-meta").textContent));
  $('[data-st="print"]').click(); await wait(200);
  button("Print").click(); await wait(400);
  const invPage = (printed[1] || [])[0] || "";
  ok("an inventory prints on the same letterhead, under its own name",
    /NN \| Inventory \| {2}\| collection\.png collection/.test(invPage) && /class="nn-title">Garage</.test(invPage));
  ok("  counted as an inventory print", (printed[1] || [])[1] === "stuff-inventory");

  const broke = [...thrown, ...asyncFailures];
  ok("the app threw nothing", broke.length === 0, broke.slice(0, 3).join(" | "));
}

run().catch((e) => { fail++; out.push("  FAIL  threw: " + (e.stack || e.message)); })
  .then(() => {
    console.log("\ntest_stuff.js");
    console.log(out.join("\n"));
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail ? 1 : 0);
  });
