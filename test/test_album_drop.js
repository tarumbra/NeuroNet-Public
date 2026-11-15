/* ==========================================================================
   Dragging photos onto an album files them there
   ==========================================================================
   Cam: "I want to be able to drag and drop photos into an album icon on the
   right side panel to add to an album."

   Then: "Bug found, i click hold and the cursor changes to hold it. But
   when i move off the photo it lets go."

   WHY THE FIRST VERSION OF THIS FILE DID NOT CATCH THAT, which is the
   reason the rest of it is written the way it is.

   It dispatched DragEvents by hand -- new DragEvent('dragstart'), then
   dragover, then drop -- and checked what the handlers did with them.
   Every one passed. But synthesising a drag event is not the same as
   asking the engine to START a drag, and starting was the part that
   failed on Cam's machine. The test proved the handlers were correct and
   said nothing at all about whether a person could ever reach them. A
   test that supplies its own version of the thing under test passes for
   the wrong reason; this is that mistake wearing a different hat.

   So every drag here is a REAL pointer: mouse.down, a series of
   mouse.move, mouse.up. If a press and a drag cannot reach the album,
   these fail.

   AND THE FEATURE ITSELF CHANGED for the same reason. It was built on
   HTML5 drag-and-drop, which renderers implement inconsistently -- it
   worked in WebKitGTK 2.52 and Chromium, both measured with a real
   pointer, and not for Cam, who runs QtWebEngine via `--gui qt`. It is
   now mousedown/mousemove/mouseup with a ghost the app positions itself,
   which no engine can implement differently. These tests pass against
   either implementation, because they press and move and look at what
   ended up in the album rather than at which events fired.

   WHAT IS BEING DRAGGED follows the selection:

     nothing selected        the one photo picked up
     it IS in the selection  the whole selection
     it is NOT in it         only that photo, and the selection is untouched

   The middle rule is the feature -- filing forty holiday photos in one
   drag is the point. The third is what stops it being dangerous: without
   it, picking up any stray photo while a selection exists silently files
   a pile of others Cam never pointed at.

   A PRESS THAT DOES NOT MOVE IS STILL A CLICK. There is a threshold, and
   it is checked here, because a photo library where tapping a photo
   files it instead of opening it would be worse than no drag at all.
   ========================================================================== */
"use strict";
const path = require("path");
const fs = require("fs");

const APP = process.argv[2] || path.join(__dirname, "..");
const UI = path.join(APP, "ui");

let chromium;
try {
  ({chromium} = require("playwright"));
} catch (e) {
  try {
    ({chromium} = require(require("child_process")
      .execSync("npm root -g").toString().trim() + "/playwright"));
  } catch (e2) {
    console.log("test_album_drop: Playwright isn't installed, so dragging "
      + "photos onto an album can't be checked here.");
    console.log("  (npm install -g playwright — jsdom has no usable "
      + "DragEvent or DataTransfer.)");
    process.exit(0);
  }
}

let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const same = (a, b) => JSON.stringify([...(a || [])].sort())
  === JSON.stringify([...(b || [])].sort());

function stub() {
  const px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABL"
    + "bSncAAAAEUlEQVR4nGN4VqGBFTEMLQkASIJhgeSB83sAAAAASUVORK5CYII=";
  const photos = [];
  for (let i = 0; i < 8; i++) {
    photos.push({id: "p" + i, storedName: "p" + i + ".jpg",
      originalName: "Photo " + i + ".jpg", caption: "Photo " + i, tags: [],
      notes: "", takenDate: "", created: "2026-08-0" + (i + 1),
      albumIds: [], folderId: "", rating: 0, kind: ""});
  }
  const albums = [{id: "a1", name: "Dad", created: "2026-01-01"},
                  {id: "a2", name: "Holidays", created: "2026-01-02"}];
  const api = {
    ping: async () => ({ok: true}),
    library_info: async () => ({root: "/d", found: true, photoFiles: photos.length}),
    photo_get_data: async () => JSON.parse(JSON.stringify(
      {photos, albums, folders: [], photoTagList: []})),
    photo_save_data: async (d) => {
      window.__saved = JSON.parse(JSON.stringify(d));
      window.__saves = (window.__saves || 0) + 1;
      return {ok: true};
    },
    photo_thumb: async () => ({dataUrl: px}),
    photo_full: async () => ({dataUrl: px}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    cards_read_json: async () => ({tarotDecks: [], oracleDecks: [], lenormandDecks: [],
      tarotReadings: [], oracleReadings: [], lenormandReadings: [],
      meditation: [], journal: [], gratitude: []}),
    cranium_get_data: async () => ({stats: {}, saved: {}, wordLists: [],
      wordGuessList: [], slideImages: [], books: []}),
    cranium_get_prefs: async () => ({}),
    kc_available: async () => true,
    kc_get_data: async () => ({photos: [], albums: [], photoTagList: [], folders: [],
      events: [], contacts: [], recipes: [], menus: [], shoppingLists: [],
      books: [], tagList: []}),
    kc_get_money: async () => ({templates: [], oneoffs: [], payments: {}, goals: [],
      spendingLog: {periodStart: "", entries: []}, calc: {bills: [], income: []}}),
    kc_money_stamp: async () => 0,
    training_load: async () => ({exercises: {}, circuits: [], sessions: [], guides: [],
      questionnaires: [], calendars: [], athletes: [], equipment: [],
      circuitTypes: [], lessonPlans: []}),
    training_get_prefs: async () => ({}), training_stamp: async () => 0,
    training_formats: async () => ({docx: false, xlsx: false, pdf: false}),
    notes_list_tree: async () => [],
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}), boards_list: async () => [],
    cells_list: async () => [], notebooks_list: async () => [],
  };
  window.pywebview = {api: new Proxy(api, {get: (t, n) => (n in t ? t[n]
    : (typeof n === "string" ? async () => ({}) : undefined))})};
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(stub);
  await page.goto("file://" + path.join(UI, "index.html"));
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.SS.go("all"));
  await page.waitForTimeout(1000);

  const boxOf = async (sel) => {
    const el = await page.$(sel);
    return el ? el.boundingBox() : null;
  };
  const filed = (albumId) => page.evaluate((a) => {
    const s = window.__saved;
    if (!s) return [];
    return s.photos.filter((x) => (x.albumIds || []).includes(a)).map((x) => x.id);
  }, albumId);
  const selected = () => page.evaluate(() =>
    [...document.querySelectorAll(".tile.picked")].map((t) => t.dataset.photo));
  /* A real press and release, not element.click(). A synthetic click has
     no mousedown in front of it, which is not how a person ticks a photo
     and hid a bug the first time round: the flag that swallows the click
     after a drag is cleared on mousedown, so only a real press clears it. */
  const clickTile = async (id) => {
    const b = await boxOf(`.tile[data-photo="${id}"]`);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(30);
    await page.mouse.up();
    await page.waitForTimeout(120);
  };
  const toggleSelect = async () => {
    const b = await boxOf("#ss-select");
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(300);
  };
  const onScreen = (b) => b && b.y > 0 && b.y + b.height < 900;

  /** A REAL drag: press on the photo, move across in steps, release.
      Returns whether the album was lit at the moment before release. */
  async function dragTo(photoId, albumName, {release = true} = {}) {
    const tb = await boxOf(`.tile[data-photo="${photoId}"]`);
    if (!onScreen(tb)) throw new Error(`tile ${photoId} is not on screen (${JSON.stringify(tb)})`);
    const ab = await page.evaluate((name) => {
      const c = [...document.querySelectorAll('[data-view^="album:"]')]
        .find((e) => new RegExp(name).test(e.textContent));
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return {x: r.x, y: r.y, width: r.width, height: r.height};
    }, albumName);
    if (!ab) throw new Error("no album called " + albumName);
    const sx = tb.x + tb.width / 2, sy = tb.y + tb.height / 2;
    const ex = ab.x + ab.width / 2, ey = ab.y + ab.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.waitForTimeout(60);
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(sx + (ex - sx) * i / 12, sy + (ey - sy) * i / 12);
      await page.waitForTimeout(18);
    }
    await page.waitForTimeout(120);
    const state = await page.evaluate(() => ({
      lit: !!document.querySelector(".ss-drop-album"),
      ghost: !!document.querySelector(".ss-drag-ghost"),
      faded: document.querySelectorAll(".tile.is-dragging").length,
    }));
    if (release) { await page.mouse.up(); await page.waitForTimeout(700); }
    return state;
  }

  ok("the gallery has photos in it",
    (await page.evaluate(() => document.querySelectorAll(".tile[data-photo]").length)) === 8);
  ok("the albums are in the menu",
    (await page.evaluate(() =>
      document.querySelectorAll('[data-view^="album:"]').length)) === 2);

  /* ---- 1. a real drag, nothing selected -------------------------------- */
  const one = await dragTo("p3", "Dad");
  ok("a press and a move actually starts a drag", one.ghost,
    "the photo being carried is drawn by the app itself; no ghost means "
    + "nothing started, which is exactly the bug Cam hit");
  ok("  the photo being carried is shown as picked up", one.faded === 1);
  ok("  and the album lights up, and STAYS lit", one.lit,
    "the HTML5 version lost the highlight whenever the cursor crossed the "
    + "album's icon or its label, because dragleave fires for children");
  ok("dragging one photo files that photo", same(await filed("a1"), ["p3"]),
    JSON.stringify(await filed("a1")));
  ok("  and the ghost is cleaned up afterwards",
    await page.evaluate(() => !document.querySelector(".ss-drag-ghost")));

  /* ---- 2. drag one OF a selection: the whole selection goes ------------- */
  await toggleSelect();
  for (const id of ["p0", "p1", "p2"]) await clickTile(id);
  await page.waitForTimeout(250);
  ok("three photos can be selected", (await selected()).length === 3);
  const many = await dragTo("p1", "Holidays");
  ok("  all three are shown as being carried", many.faded === 3, String(many.faded));
  ok("dragging one OF the selection files all of it",
    same(await filed("a2"), ["p0", "p1", "p2"]),
    JSON.stringify(await filed("a2")) + " — filing a whole selection in one "
    + "drag is the point of the feature");

  /* ---- 3. drag one NOT in the selection: only that one ------------------ */
  await toggleSelect();
  await toggleSelect();
  for (const id of ["p5", "p6"]) await clickTile(id);
  await page.waitForTimeout(250);
  ok("a different selection is in place", (await selected()).length === 2);
  await dragTo("p7", "Dad");
  ok("dragging a photo that is NOT selected files only that photo",
    same(await filed("a1"), ["p3", "p7"]),
    JSON.stringify(await filed("a1")) + " — p5 and p6 were selected and must "
    + "NOT have been swept along; that would file photos Cam never pointed at");

  /* ---- 4. a press without a move is still a click ---------------------- */
  await toggleSelect();
  await page.waitForTimeout(200);
  const tapBox = await boxOf('.tile[data-photo="p4"]');
  await page.mouse.move(tapBox.x + tapBox.width / 2, tapBox.y + tapBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(600);
  ok("tapping a photo still opens it rather than starting a drag",
    await page.evaluate(() => !!document.querySelector(".pv, .viewer, #photo-viewer")
      || !!document.querySelector(".pv-nav")),
    "a library where a tap files a photo instead of opening it would be "
    + "worse than having no drag at all");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  /* ---- 5. dropping on nothing files nothing ---------------------------- */
  const beforeStray = await filed("a1");
  const strayBox = await boxOf('.tile[data-photo="p0"]');
  await page.mouse.move(strayBox.x + strayBox.width / 2, strayBox.y + strayBox.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(strayBox.x + 40 + i * 20, strayBox.y + 300);
    await page.waitForTimeout(18);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  ok("letting go over nothing files nothing", same(await filed("a1"), beforeStray),
    "a drag abandoned in the middle of the page must be a no-op, not a "
    + "guess at the nearest album");
  ok("  and leaves no ghost stuck to the cursor",
    await page.evaluate(() => !document.querySelector(".ss-drag-ghost")));

  /* ---- 6. Escape gives up --------------------------------------------- */
  const escBefore = await filed("a1");
  const escState = await dragTo("p1", "Dad", {release: false});
  ok("a drag in progress can be seen", escState.ghost);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("Escape abandons the drag", await page.evaluate(() =>
    !document.querySelector(".ss-drag-ghost")
    && !document.querySelector(".ss-drop-album")));
  await page.mouse.up();
  await page.waitForTimeout(500);
  ok("  and files nothing", same(await filed("a1"), escBefore),
    JSON.stringify(await filed("a1")));

  /* ---- 7. dropping twice does not double up ---------------------------- */
  const savesBefore = await page.evaluate(() => window.__saves || 0);
  await dragTo("p3", "Dad");
  ok("a photo already in the album is not added twice",
    same(await filed("a1"), escBefore), JSON.stringify(await filed("a1")));
  ok("  and nothing is saved when nothing changed",
    (await page.evaluate(() => window.__saves || 0)) === savesBefore,
    "a save that writes the same thing back still costs a write and a "
    + "redraw of the whole gallery");

  /* ---- 8. the menu's own drag is untouched ----------------------------- */
  const order = await page.evaluate(() =>
    [...document.querySelectorAll("#ss-subnav-body [data-view]")].map((e) => e.dataset.view));
  await dragTo("p4", "Dad");
  const orderAfter = await page.evaluate(() =>
    [...document.querySelectorAll("#ss-subnav-body [data-view]")].map((e) => e.dataset.view));
  ok("carrying a photo over the menu does not rearrange it",
    JSON.stringify(order) === JSON.stringify(orderAfter),
    "the menu cards have their own drag for reordering; a photo crossing "
    + "them must not move Cam's menu about");

  /* ---- 9. one code path ------------------------------------------------ */
  const src = fs.readFileSync(path.join(UI, "app.js"), "utf8");
  ok("filing a photo happens in one place",
    (src.match(/albumIds\.push\(/g) || []).length === 1,
    "the selection bar's dialog and the drag both call addToAlbum; written "
    + "out twice they drift, and a photo in an album by one route and not "
    + "the other looks like a bug in the album");
  ok("the drag does not depend on HTML5 drag-and-drop",
    !/draggable="true"[\s\S]{0,80}data-photo/.test(src)
    && src.includes("wirePhotoDragGlobals"),
    "it is built from mousedown/mousemove/mouseup precisely because "
    + "renderers disagree about the HTML5 kind, and Cam's is one of them");

  ok("the app threw nothing", errs.length === 0, errs.slice(0, 3).join(" | "));

  console.log("\ntest_album_drop.js");
  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
