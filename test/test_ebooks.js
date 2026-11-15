/* ==========================================================================
   Ebooks -- the shelf, the reader, bookmarks, highlights, Notes → Bookmarks
   ==========================================================================
   Cam: "add a new sub section called ebooks. This should be an ebook library
   and reader. It should have a bookmarks feautre as well and a bookmarks sub
   section. Further i want a tool where i can highlight over an ebook if
   possible."

   The whole app booted in jsdom against a library kept in memory here, so
   what is checked is what Cam would see and what would be written to disk.
   ebooks.py itself is test_ebooks.py.

   Guarded in particular:
     * opening a book must not write "chapter 1, the top" over the place Cam
       stopped -- the first chapter load used to save before it jumped
     * a bookmark is never moved by reading, and position never by marking
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

const CHAPTERS = [
  `<h1 id="eb-top">One: Leaving</h1><p>It was <em>cold</em> at sea, and the boat was small.</p>
   <p>See <a data-eb-href="2#eb-far">the far shore</a>.</p>`,
  `<h2>Two: The Middle</h2><p>The middle of the voyage was long and quiet.</p>`,
  `<h2>Three: Arriving</h2><p>Nothing yet.</p><p id="eb-far">The far shore at last.</p>`,
];
/* In the order ebooks.py hands them over -- alphabetical is its job, and
   test_ebooks.py checks it; the shelf must keep it. */
const library = {books: [
  {id: "apple", title: "An Apple a Day", author: "B. Grower", format: "txt", cover: "",
   chapters: 1, pages: 0, opened: "", toc: [{index: 0, title: "Part 1"}],
   position: {}, bookmarks: [], highlights: []},
  {id: "sea", title: "The Sea Road", author: "A. Writer", format: "epub", cover: "",
   chapters: 3, pages: 0, opened: "2026-09-20T10:00:00",
   toc: [{index: 0, title: "One: Leaving"}, {index: 1, title: "Two: The Middle"}, {index: 2, title: "Three: Arriving"}],
   position: {chapter: 1, progress: 0}, bookmarks: [], highlights: []},
]};
const updates = [], chapterCalls = [];

async function run() {
  let JSDOM;
  try { ({JSDOM} = require("jsdom")); }
  catch (e) { out.push("  --    (jsdom not installed; nothing here can run without it)"); return; }

  const prefs = {};
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}),
    photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => JSON.parse(JSON.stringify(prefs)),
    set_prefs: async (p) => { Object.assign(prefs, p || {}); return {ok: true}; },
    read_taken_dates: async () => ({dates: {}}),
    music_read_json: async () => ({tracks: {}, playlists: [], albums: []}),
    chords_list: async () => [],
    notes_list_tree: async () => [],
    notes_read_all_notes: async () => ({notes: [], truncated: false}),
    notes_get_prefs: async () => ({}),
    ebooks_list: async () => JSON.parse(JSON.stringify(library)),
    ebooks_chapter: async (id, i) => {
      chapterCalls.push([id, i]);
      const b = library.books.find((x) => x.id === id);
      if (b.format === "txt") return {index: 0, count: 1, html: "<h2>Part 1</h2><p>An apple.</p>"};
      return CHAPTERS[i] ? {index: i, count: 3, html: CHAPTERS[i]} : {error: "There is no chapter " + (i + 1) + "."};
    },
    ebooks_update: async (id, patch) => {
      updates.push([id, JSON.parse(JSON.stringify(patch))]);
      const b = library.books.find((x) => x.id === id);
      if (!b) return {error: "That book is not in the library."};
      Object.assign(b, JSON.parse(JSON.stringify(patch)));
      return {ok: true};
    },
    ebooks_delete: async (id) => { library.books = library.books.filter((b) => b.id !== id); return {ok: true}; },
    ebooks_pick: async () => ({added: [{id: "new"}], skipped: [{name: "x.docx", why: "Only EPUB, PDF and plain text books can be read here."}]}),
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
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function () {};
  w.Element.prototype.scrollIntoView = function () { w.__scrolledTo = this; };
  w.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {}, lineTo() {},
    stroke() {}, fill() {}, save() {}, restore() {}, translate() {}, scale() {},
    createLinearGradient: () => ({addColorStop() {}}), setTransform() {}, closePath() {},
    getImageData: () => ({data: [0, 0, 0, 255]}),
  });
  if (!w.CSS) w.CSS = {};
  if (!w.CSS.escape) w.CSS.escape = (s) => String(s).replace(/["\\]/g, "\\$&");
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
  const R = (k) => $(`[data-r="${k}"]`);
  const sea0 = () => library.books.find((b) => b.id === "sea");
  const posWrites = (id) => updates.filter(([b, p]) => b === id && p.position).map(([, p]) => p.position);

  /* ---- where it lives ---------------------------------------------------- */
  const appJs = fs.readFileSync(path.join(UI, "app.js"), "utf8");
  const notesBlock = appJs.slice(appJs.indexOf('{key: "notes", name: "Scribe"'));
  const subs = [...notesBlock.slice(0, notesBlock.indexOf("]}"))
    .matchAll(/\{key: "([a-z]+:[a-z]+)", name: "([^"]+)"/g)].map((m) => m[2]);
  ok("Notes has Notebooks, Ebooks and Bookmarks",
    ["Notebooks", "Ebooks", "Bookmarks"].every((n) => subs.includes(n)) && !subs.includes("Books"), subs.join(", "));
  ok("  loaded by the page, script and styles",
    /src="ebooks\/ebooks\.js"/.test(html) && /href="ebooks\/ebooks\.css"/.test(html));

  /* ---- the shelf ----------------------------------------------------------- */
  SS.go("ebooks:library"); await wait(500);
  ok("Ebooks opens on the shelf", !!$(".ss-ebooks .eb-grid"), ($("#ss-main") || {}).innerHTML);
  ok("  under Notes in the menus", SS.where().section === "notes");
  const titles = $$(".eb-card-t").map((t) => t.textContent);
  ok("  in the library's alphabetical order", titles.join("|") === "An Apple a Day|The Sea Road", titles.join("|"));
  ok("  a book without a cover gets a plain one with its title", !!$('.eb-card[data-open="apple"] .eb-cover-plain'));
  ok("  and Continue reading goes back to the last book, where it was",
    /The Sea Road/.test(($(".eb-continue") || {}).textContent || "") && /Two: The Middle/.test($(".eb-continue").textContent));

  $("#eb-add").click(); await wait(400);
  ok("adding books says what was added and what wasn't, and why",
    /Added 1 book/.test(doc.body.textContent) && /Only EPUB, PDF and plain text/.test(doc.body.textContent));

  /* ---- the reader ---------------------------------------------------------------- */
  const beforeOpen = updates.length;
  $('.eb-card[data-open="sea"]').click(); await wait(600);
  ok("opening a book opens the reader", !!$(".eb-reader .eb-text"));
  ok("  at the chapter Cam stopped in", chapterCalls.at(-1)[1] === 1 && /The middle of the voyage/.test($(".eb-text").textContent),
    JSON.stringify(chapterCalls));
  ok("  without writing \"the start\" over that place",
    !updates.slice(beforeOpen).some(([id, p]) => id === "sea" && p.position && p.position.chapter === 0),
    JSON.stringify(updates.slice(beforeOpen)));
  ok("  and the contents list is the book's own", $$('[data-r="toc"] option').map((o) => o.textContent).join("|")
    === "One: Leaving|Two: The Middle|Three: Arriving");

  R("prev").click(); await wait(1200);
  ok("‹ goes to the chapter before", /It was cold at sea/.test($(".eb-text").textContent));
  ok("  and the new chapter is saved as the place, with no scrolling needed",
    sea0().position.chapter === 0, JSON.stringify(posWrites("sea")));

  /* A link inside the book */
  $('.eb-text a[data-eb-href]').click(); await wait(500);
  ok("a link inside the book goes to its chapter and its place",
    /The far shore at last/.test($(".eb-text").textContent) && w.__scrolledTo && w.__scrolledTo.id === "eb-far",
    w.__scrolledTo && w.__scrolledTo.outerHTML);

  R("toc").value = "0"; R("toc").dispatchEvent(new w.Event("change")); await wait(400);
  ok("the contents list jumps to a chapter", /It was cold at sea/.test($(".eb-text").textContent));

  /* ---- bookmarks ----------------------------------------------------------------- */
  R("bookmark").click(); await wait(300);
  const sea = () => library.books.find((b) => b.id === "sea");
  ok("★ Bookmark saves this place", sea().bookmarks.length === 1 && sea().bookmarks[0].chapter === 0
    && sea().bookmarks[0].label === "One: Leaving", JSON.stringify(sea().bookmarks));
  R("bookmark").click(); await wait(300);
  ok("  and the same place twice is one bookmark", sea().bookmarks.length === 1);
  R("next").click(); await wait(400);
  ok("  reading on never moves it", sea().bookmarks[0].chapter === 0 && sea().position.chapter !== undefined);

  /* ---- highlighting ---------------------------------------------------------------- */
  R("prev").click(); await wait(400);
  const text = $(".eb-text");
  const selectWords = (words) => {
    const walker = doc.createTreeWalker(text, w.NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const at = n.nodeValue.indexOf(words);
      if (at >= 0) {
        const r = doc.createRange(); r.setStart(n, at); r.setEnd(n, at + words.length);
        const sel = w.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        return true;
      }
    }
    return false;
  };
  R("pen").click();
  ok("the highlighter can be picked up", R("pen").classList.contains("on"));
  $('[data-colour="green"]').click();
  selectWords("the boat was small");
  $(".eb-body").dispatchEvent(new w.MouseEvent("mouseup", {bubbles: true})); await wait(300);
  const hl = sea().highlights[0];
  ok("with it up, a selection becomes a highlight", !!hl && hl.text === "the boat was small" && hl.colour === "green",
    JSON.stringify(sea().highlights));
  ok("  kept by where it is in the chapter", hl && hl.chapter === 0
    && text.textContent.slice(hl.start, hl.end) === "the boat was small");
  ok("  and painted on the page", ($('.eb-text mark[data-hl]') || {}).textContent === "the boat was small");

  /* Across an inline tag: "It was <em>cold</em> at" */
  selectWords("It was ");
  const sel = w.getSelection(), r0 = sel.getRangeAt(0);
  const em = text.querySelector("em");
  r0.setEnd(em.nextSibling, 3);
  $(".eb-body").dispatchEvent(new w.MouseEvent("mouseup", {bubbles: true})); await wait(300);
  ok("a highlight across emphasis keeps the words in order",
    sea().highlights[1] && sea().highlights[1].text === "It was cold at", JSON.stringify(sea().highlights[1]));
  ok("  and the emphasis is still there", !!text.querySelector("em") && text.querySelector("em").textContent === "cold");
  R("pen").click();

  /* A highlight survives leaving and coming back. */
  R("next").click(); await wait(400); R("prev").click(); await wait(400);
  ok("highlights are painted again when the chapter comes back",
    $$('.eb-text mark[data-hl]').map((m) => m.textContent).join("|") === "It was |cold| at|the boat was small",
    $$('.eb-text mark[data-hl]').map((m) => m.textContent).join("|"));

  /* A highlight whose place has shifted is found by its words, and one whose
     words are gone is left alone rather than painted over something else. */
  sea().highlights.push({id: "moved", chapter: 0, start: 2, end: 9, text: "at sea", colour: "pink", note: ""},
                        {id: "gone", chapter: 0, start: 0, end: 5, text: "not in this book", colour: "blue", note: ""});
  SS.Ebooks.open.book.highlights = sea().highlights;
  R("next").click(); await wait(400); R("prev").click(); await wait(400);
  ok("a highlight that moved is found by its words",
    ($('.eb-text mark[data-hl="moved"]') || {}).textContent === "at sea");
  ok("  and one whose words are gone paints nothing", !$('.eb-text mark[data-hl="gone"]'));

  /* Clicking a highlight: its note, its colour, or off. */
  $('.eb-text mark[data-hl]').click(); await wait(200);
  const note = $("#eb-note");
  ok("clicking a highlight opens it", !!note);
  if (note) {
    note.value = "Remember this";
    const save = $$("button").find((b) => b.textContent.trim() === "Save");
    save.click(); await wait(300);
  }
  ok("  and a note is saved on it", sea().highlights.some((h) => h.note === "Remember this"));
  ok("  shown when the pointer rests on it", $$(".eb-text mark.has-note").some((m) => m.title === "Remember this"));

  /* ---- reader settings ---------------------------------------------------------------- */
  R("bigger").click(); await wait(100);
  ok("A+ makes the type bigger, and is remembered", prefs.ebookReader && prefs.ebookReader.size === 20,
    JSON.stringify(prefs.ebookReader));
  R("theme").value = "night"; R("theme").dispatchEvent(new w.Event("change")); await wait(100);
  ok("  and so is the paper", $(".eb-reader").classList.contains("eb-theme-night") && prefs.ebookReader.theme === "night");

  /* ---- leaving and coming back -------------------------------------------------------------- */
  R("next").click(); await wait(400);
  const writes = posWrites("sea").length;
  SS.go("notes:vault"); await wait(500);
  ok("leaving Ebooks saves where the book is", posWrites("sea").length > writes
    && posWrites("sea").at(-1).chapter === 1, JSON.stringify(posWrites("sea").slice(-2)));
  await wait(900);
  ok("  and nothing afterwards writes \"the top\" over it", sea().position.chapter === 1, JSON.stringify(sea().position));
  SS.go("ebooks:library"); await wait(500);
  ok("coming back, the book is still open where it was",
    !!$(".eb-reader") && /The middle of the voyage/.test($(".eb-text").textContent));

  /* ---- Notes → Bookmarks ---------------------------------------------------------------------- */
  SS.go("ebooks:bookmarks"); await wait(500);
  ok("Bookmarks lists every bookmark, book by book",
    $$(".pe-section .pe-h").map((h) => h.childNodes[0].textContent.trim()).join("|") === "The Sea Road"
      && /One: Leaving/.test($(".pe-section").textContent));
  $('[data-tab="highlights"]').click(); await wait(300);
  const hlOrder = $$(".eb-hltext").map((h) => h.textContent);
  ok("  and every highlight, in book order, with its note",
    hlOrder.indexOf("It was cold at") < hlOrder.indexOf("the boat was small") && hlOrder.length === 4
      && /Remember this/.test($(".pe-section").textContent),
    $$(".eb-hltext").map((h) => h.textContent).join("|"));
  $$("[data-go]").find((b) => b.dataset.go.includes("|hl|"))
    .click(); await wait(700);
  ok("Open goes straight to it in the book",
    SS.where().view === "ebooks:library" && /It was cold at sea/.test(($(".eb-text") || {}).textContent || ""));

  SS.go("ebooks:bookmarks"); await wait(400);
  $('[data-tab="bookmarks"]').click(); await wait(200);
  const del = $("[data-rm]");
  del.click(); await wait(200);
  const yes = $$("button").find((b) => b.textContent.trim() === "Delete" && b.closest(".dlg, dialog, .modal, [role=dialog]"))
    || $$("button").filter((b) => b.textContent.trim() === "Delete").at(-1);
  yes.click(); await wait(400);
  ok("a bookmark deleted there is gone from the book", sea().bookmarks.length === 0, JSON.stringify(sea().bookmarks));

  /* ---- the rest ------------------------------------------------------------------------------ */
  ok("nothing threw", !thrown.length && !asyncFailures.length, thrown.concat(asyncFailures).slice(0, 3).join(" | "));
}

run().then(() => {
  console.log("\nEbooks: shelf, reader, bookmarks and highlights\n");
  console.log(out.join("\n"));
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
