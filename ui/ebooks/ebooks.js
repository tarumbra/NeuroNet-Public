/* ==========================================================================
   Ebooks — Notes → Ebooks and Notes → Bookmarks.
   ==========================================================================
   Cam: "add a new sub section called ebooks. This should be an ebook library
   and reader. It should have a bookmarks feature as well and a bookmarks sub
   section. Further i want a tool where i can highlight over an ebook if
   possible. Also in multitasking mode ... an ebook open on one side and the
   vault on the other side so i can take notes at the same time."

   THE SHELF is every book, alphabetical (a leading "The" ignored), with its
   cover and how far through it Cam is.

   THE READER takes EPUB and plain text a chapter at a time -- ebooks.py hands
   over clean HTML, and the type is set here, in a size and paper colour Cam
   chooses -- and PDF page by page, drawn by the pdf.js Notes already ships,
   only as the pages come into view (a 500-page PDF drawn all at once takes
   the app with it).

   THREE KINDS OF PLACE, kept apart on purpose:
     position   where he stopped. Moves by itself as he reads.
     bookmark   a place he chose to come back to. Never moved by reading.
     highlight  a passage he marked, in a colour, with a note if he likes.
   Reading past a bookmark must never cost him the bookmark, so position is
   never written into the bookmarks, and the other way round.

   HIGHLIGHTING. Select text and a small bar offers the colours. Or turn the
   highlighter on, like picking up a pen: every selection becomes a
   highlight in the current colour until it is put down again. In a text book
   a highlight is kept as where it starts and ends in the chapter's text, plus
   the text itself (so it finds its place again if that ever shifts); in a
   PDF it is kept as the shapes it covers on the page.

   It all works on one side of Multitask, beside the Vault: the reader draws
   into whatever host it is given, and Ebooks and the Vault are different
   modules, so both can be up at once.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "Ebooks");
  const toast = (m, k) => SS.shared.toast(m, k);
  const newId = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const shortDate = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d.toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"}) : "";
  };

  const COLOURS = [
    {key: "yellow", name: "Yellow"}, {key: "green", name: "Green"},
    {key: "blue", name: "Blue"}, {key: "pink", name: "Pink"},
  ];
  const THEMES = [
    {key: "paper", name: "Paper"}, {key: "sepia", name: "Sepia"},
    {key: "night", name: "Night"}, {key: "app", name: "App"},
  ];
  const SIZES = [14, 15, 16, 17, 18, 20, 22, 24, 27, 30];

  /* ---- state ------------------------------------------------------------ */
  let books = [];
  let query = "";
  let open = null;          // {book, chapter, html} or, for a PDF, {book, pdf, pages}
  let prefs = {size: 18, theme: "paper", pdfZoom: 1, colour: "yellow"};
  let prefsLoaded = false;
  let penDown = false;      // the highlighter, picked up
  let host = null;

  async function loadPrefs() {
    if (prefsLoaded) return;
    prefsLoaded = true;
    try {
      const p = await SS.Store.getPrefs();
      if (p && p.ebookReader && typeof p.ebookReader === "object") Object.assign(prefs, p.ebookReader);
    } catch (e) { /* the defaults read fine */ }
  }
  const savePrefs = () => SS.Store.setPrefs({ebookReader: prefs});

  async function loadBooks() {
    const got = await call("ebooks_list", [], "Your ebooks");
    if (got && got.error) toast(got.error, "error");
    books = (got && got.books) || [];
    return books;
  }
  const bookById = (id) => books.find((b) => b.id === id) || null;

  /** Save part of a book (position, bookmarks, highlights) and keep the copy
      in memory in step with what was written. */
  async function saveBook(book, patch) {
    Object.assign(book, patch);
    const res = await call("ebooks_update", [book.id, patch], "Saving");
    if (res && res.error) { toast(res.error, "error"); return false; }
    return true;
  }

  /* ---- where a book is -------------------------------------------------- */

  const isPdf = (b) => b && b.format === "pdf";
  const chapterTitle = (b, i) => ((b.toc || []).find((t) => t.index === i) || {}).title
    || `${b.format === "txt" ? "Part" : "Section"} ${i + 1}`;
  const whereLabel = (b, loc) => loc && (isPdf(b)
    ? `Page ${(loc.page || 0) + 1}` : chapterTitle(b, loc.chapter || 0));
  function progressOf(b) {
    const p = b.position || {};
    if (isPdf(b)) return b.pages ? Math.min(1, ((p.page || 0) + (p.progress || 0)) / b.pages) : 0;
    return b.chapters ? Math.min(1, ((p.chapter || 0) + (p.progress || 0)) / b.chapters) : 0;
  }

  /* ======================================================================
     THE SHELF
     ====================================================================== */

  async function renderLibrary(page) {
    await loadBooks();
    const q = query.trim().toLowerCase();
    const shown = books.filter((b) => !q
      || `${b.title} ${b.author} ${b.format}`.toLowerCase().includes(q));
    const reading = [...books].filter((b) => b.opened && progressOf(b) < 0.995)
      .sort((a, b) => String(b.opened).localeCompare(String(a.opened)))[0];
    page.innerHTML = `
      <div class="eb-shelf">
        <div class="bd-head">
          <h2 class="page-h">Ebooks</h2>
          <p class="stamp">Your library — EPUB, PDF and plain text, alphabetical.
            ${books.length ? `${books.length} book${books.length === 1 ? "" : "s"}.` : ""}</p>
          <div class="bd-actions">
            <button class="btn btn-primary" id="eb-add">+ Add ebooks</button>
            <button class="btn btn-quiet" id="eb-marks">Bookmarks &amp; highlights</button>
          </div>
        </div>
        ${reading ? `<button class="eb-continue" data-open="${esc(reading.id)}">
          <span class="eb-continue-l">Continue reading</span>
          <b>${esc(reading.title)}</b>
          <span class="stamp">${esc(whereLabel(reading, reading.position))} ·
            ${Math.round(progressOf(reading) * 100)}%</span></button>` : ""}
        ${books.length > 6 ? `<div class="pe-search eb-search">
          <input class="input" id="eb-q" value="${esc(query)}" placeholder="Search titles and authors…"></div>` : ""}
        ${shown.length ? `<div class="eb-grid">${shown.map(cardHtml).join("")}</div>`
          : `<p class="bd-empty">${books.length ? "Nothing matches that search."
              : "No ebooks yet. Add EPUB, PDF or text files and they are copied into your library."}</p>`}
      </div>`;
    page.querySelector("#eb-add").onclick = addBooks;
    page.querySelector("#eb-marks").onclick = () => SS.go("ebooks:bookmarks");
    const qi = page.querySelector("#eb-q");
    if (qi) qi.oninput = () => {
      query = qi.value;
      const at = qi.selectionStart;
      renderLibrary(page).then(() => {
        const again = page.querySelector("#eb-q");
        if (again) { again.focus(); try { again.setSelectionRange(at, at); } catch (e) { /* fine */ } }
      });
    };
    page.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => openBook(b.dataset.open));
    page.querySelectorAll("[data-edit]").forEach((b) => b.onclick = (e) => {
      e.stopPropagation(); editBook(b.dataset.edit);
    });
    page.querySelectorAll("[data-del]").forEach((b) => b.onclick = (e) => {
      e.stopPropagation(); deleteBook(b.dataset.del);
    });
  }

  function cardHtml(b) {
    const pct = Math.round(progressOf(b) * 100);
    const marks = (b.bookmarks || []).length + (b.highlights || []).length;
    return `<div class="eb-card" data-open="${esc(b.id)}" role="button" tabindex="0" title="Read ${esc(b.title)}">
      <div class="eb-cover">${b.cover ? `<img src="${esc(b.cover)}" alt="">`
        : `<div class="eb-cover-plain"><b>${esc(b.title)}</b>${b.author ? `<span>${esc(b.author)}</span>` : ""}</div>`}
        <span class="eb-fmt">${esc(String(b.format).toUpperCase())}</span></div>
      <div class="eb-card-t">${esc(b.title)}</div>
      <div class="eb-card-a">${esc(b.author || " ")}</div>
      <div class="eb-prog"><span style="width:${pct}%"></span></div>
      <div class="eb-card-f">
        <span class="stamp">${pct ? `${pct}%` : "Not started"}${marks ? ` · ${marks} mark${marks === 1 ? "" : "s"}` : ""}</span>
        <button class="eb-mini" data-edit="${esc(b.id)}" title="Title and author">✎</button>
        <button class="eb-mini" data-del="${esc(b.id)}" title="Remove from the library">✕</button>
      </div>
    </div>`;
  }

  async function addBooks() {
    const res = await call("ebooks_pick", [], "Adding ebooks");
    if (!res || res.cancelled) return;
    if (res.error) { toast(res.error, "error"); return; }
    const n = (res.added || []).length;
    if (n) toast(`Added ${n} book${n === 1 ? "" : "s"}.`, "good");
    for (const s of res.skipped || []) toast(`${s.name}: ${s.why}`, "error");
    rerender();
  }

  function editBook(id) {
    const b = bookById(id);
    if (!b) return;
    const d = SS.shared.openDlg("Title and author", `
      <label class="dlg-label" for="eb-t">Title</label>
      <input class="input" id="eb-t" value="${esc(b.title)}">
      <label class="dlg-label" for="eb-a">Author</label>
      <input class="input" id="eb-a" value="${esc(b.author)}">`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save", "btn-save", async () => {
      const title = d.body.querySelector("#eb-t").value.trim() || b.title;
      if (await saveBook(b, {title, author: d.body.querySelector("#eb-a").value.trim()})) {
        d.close(); rerender();
      }
    });
  }

  async function deleteBook(id) {
    const b = bookById(id);
    if (!b) return;
    const marks = (b.bookmarks || []).length + (b.highlights || []).length;
    const yes = await SS.shared.confirm({
      title: `Remove “${b.title}”?`,
      body: `The library's copy of the file goes${marks ? `, with its ${marks} bookmark`
        + `${marks === 1 ? "" : "s"} and highlight${marks === 1 ? "" : "s"}` : ""}. `
        + "The file you added it from is not touched.",
      yes: "Remove",
    });
    if (!yes) return;
    const res = await call("ebooks_delete", [id], "Removing");
    if (res && res.error) { toast(res.error, "error"); return; }
    if (open && open.book.id === id) open = null;
    rerender();
  }

  /* ======================================================================
     THE READER
     ====================================================================== */

  async function openBook(id, loc, fromDesktop) {
    if (!books.length) await loadBooks();
    const b = bookById(id);
    if (!b) { toast("That book is not in the library.", "error"); return; }
    open = {book: b, jump: loc || b.position || null, fromDesktop: !!fromDesktop};
    saveBook(b, {opened: new Date().toISOString()});
    const here = SS.where ? SS.where().view : "";
    if (here !== "ebooks:library") { SS.go("ebooks:library"); return; }
    rerender();
  }

  function rerender() { if (host && host.isConnected) mount(host, "ebooks:library"); }

  async function renderReader(page) {
    const b = open.book;
    host.classList.add("ss-main-fills");      // the reader scrolls inside itself
    page.classList.add("eb-page-host");
    page.innerHTML = `
      <div class="eb-reader eb-theme-${esc(prefs.theme)}" style="--eb-size:${prefs.size}px">
        <div class="eb-bar">
          <button class="btn btn-quiet btn-sm" data-r="back" title="Back to the library">←<span class="eb-lbl"> Library</span></button>
          <div class="eb-bar-t"><b>${esc(b.title)}</b><span class="eb-where"></span></div>
          ${isPdf(b) ? "" : `<select class="input eb-toc" data-r="toc" title="Contents">
            ${(b.toc || []).map((t) => `<option value="${t.index}">${esc(t.title)}</option>`).join("")}</select>`}
          <span class="eb-group">
            <button class="eb-tool" data-r="prev" title="${isPdf(b) ? "Previous page" : "Previous chapter"}">‹</button>
            <button class="eb-tool" data-r="next" title="${isPdf(b) ? "Next page" : "Next chapter"}">›</button>
          </span>
          <span class="eb-group">
            <button class="eb-tool" data-r="smaller" title="Smaller">A−</button>
            <button class="eb-tool" data-r="bigger" title="Bigger">A+</button>
          </span>
          <select class="input eb-theme" data-r="theme" title="Paper">
            ${THEMES.map((t) => `<option value="${t.key}"${t.key === prefs.theme ? " selected" : ""}>${t.name}</option>`).join("")}
          </select>
          <span class="eb-group eb-pen" title="The highlighter: pick it up and every selection is highlighted">
            <button class="eb-tool eb-pen-btn ${penDown ? "on" : ""}" data-r="pen" title="Highlighter">✍<span class="eb-lbl"> Highlighter</span></button>
            ${COLOURS.map((c) => `<button class="eb-dot eb-hl-${c.key} ${prefs.colour === c.key ? "on" : ""}"
              data-colour="${c.key}" title="${c.name}"></button>`).join("")}
          </span>
          <button class="eb-tool" data-r="bookmark" title="Bookmark this place">★<span class="eb-lbl"> Bookmark</span></button>
          <button class="eb-tool" data-r="marks" title="This book's bookmarks and highlights">Marks</button>
        </div>
        <div class="eb-scroll" tabindex="0">
          <div class="eb-body">${isPdf(b) ? `<div class="eb-pdf"></div>` : `<article class="eb-text"></article>
            <div class="eb-chapnav">
              <button class="btn btn-quiet" data-r="prev2">← Previous</button>
              <span class="stamp eb-chapnum"></span>
              <button class="btn btn-quiet" data-r="next2">Next →</button></div>`}</div>
        </div>
        <div class="eb-selbar" hidden></div>
      </div>`;
    const R = (k) => page.querySelector(`[data-r="${k}"]`);
    R("back").onclick = () => {
      /* opened from the desktop Bookshelf: closing goes back to the desktop
         (Cam, 2026-10-02: "return to the desktop by default and not keep the
         notes tool open"). Only this button: leaving for Bookmarks doesn't. */
      const toDesktop = !!(open && open.fromDesktop);
      closeReader();
      rerender();
      if (toDesktop) SS.Store.call("quick_hide", [], "").catch(() => {});
    };
    R("smaller").onclick = () => setSize(-1);
    R("bigger").onclick = () => setSize(1);
    R("theme").onchange = (e) => {
      prefs.theme = e.target.value; savePrefs();
      page.querySelector(".eb-reader").className = `eb-reader eb-theme-${prefs.theme}`;
    };
    R("pen").onclick = () => { penDown = !penDown; R("pen").classList.toggle("on", penDown);
      toast(penDown ? "Highlighter on — select text to highlight it." : "Highlighter put down."); };
    page.querySelectorAll("[data-colour]").forEach((d) => d.onclick = () => {
      prefs.colour = d.dataset.colour; savePrefs();
      page.querySelectorAll("[data-colour]").forEach((x) => x.classList.toggle("on", x === d));
    });
    R("bookmark").onclick = addBookmark;
    R("marks").onclick = marksDialog;
    const scroller = page.querySelector(".eb-scroll");
    scroller.addEventListener("scroll", () => { hideSelBar(); savePositionSoon(); updateWhere(); }, {passive: true});
    page.querySelector(".eb-body").addEventListener("mouseup", onMouseUp);
    page.querySelector(".eb-body").addEventListener("click", onBodyClick);
    if (isPdf(b)) {
      R("prev").onclick = () => pdfStep(-1);
      R("next").onclick = () => pdfStep(1);
      await openPdf(page);
    } else {
      R("toc").onchange = (e) => showChapter(Number(e.target.value), 0);
      for (const k of ["prev", "prev2"]) R(k).onclick = () => showChapter(open.chapter - 1, 0);
      for (const k of ["next", "next2"]) R(k).onclick = () => showChapter(open.chapter + 1, 0);
      const j = open.jump || {};
      await showChapter(Number(j.chapter) || 0, Number(j.progress) || 0, j.highlight);
    }
    /* Ctrl+P: not a printout of someone's book, but nothing else claims it
       here, so it is left alone. */
  }

  function closeReader() {
    if (open) savePositionNow();
    open = null;
    penDown = false;
  }

  function setSize(step) {
    const i = Math.max(0, Math.min(SIZES.length - 1,
      SIZES.findIndex((s) => s >= prefs.size) + step));
    const reader = host && host.querySelector(".eb-reader");
    if (open && isPdf(open.book)) {
      prefs.pdfZoom = Math.max(0.5, Math.min(3, Math.round((prefs.pdfZoom + step * 0.15) * 100) / 100));
      savePrefs();
      const at = pdfPlace();
      layoutPdf(reader).then(() => scrollToPdf(at.page, at.progress));
      return;
    }
    const at = textProgress();
    prefs.size = SIZES[i]; savePrefs();
    if (reader) reader.style.setProperty("--eb-size", prefs.size + "px");
    requestAnimationFrame(() => scrollToProgress(at));
  }

  /* ---- a chapter (EPUB, text) ----------------------------------------------- */

  async function showChapter(index, progress, flashHl) {
    const b = open.book;
    const count = b.chapters || 1;
    if (!Number.isInteger(index) || index < 0 || index >= count) return;
    const text = host.querySelector(".eb-text");
    if (!text) return;
    savePositionNow();
    const was = open.chapter;
    open.chapter = null;                    // between chapters: no place to save
    text.innerHTML = `<p class="stamp">Opening…</p>`;
    const got = await call("ebooks_chapter", [b.id, index], "Reading");
    if (!open || open.book !== b || !text.isConnected) return;
    if (!got || got.error) {
      open.chapter = was == null ? index : was;   // Previous/Next still work
      text.innerHTML = `<p class="bd-empty">${esc((got && got.error) || "That chapter couldn't be read.")}</p>`;
      return;
    }
    open.chapter = index;
    text.innerHTML = got.html || `<p class="stamp">This section is empty.</p>`;
    applyHighlights();
    const toc = host.querySelector('[data-r="toc"]');
    if (toc) toc.value = String(index);
    const num = host.querySelector(".eb-chapnum");
    if (num) num.textContent = `${index + 1} of ${count}`;
    host.querySelector('[data-r="prev2"]').disabled = index === 0;
    host.querySelector('[data-r="next2"]').disabled = index === count - 1;
    requestAnimationFrame(() => {
      if (flashHl) {
        const m = text.querySelector(`mark[data-hl="${CSS.escape(flashHl)}"]`);
        if (m) { m.scrollIntoView({block: "center"}); m.classList.add("eb-flash"); updateWhere(); return; }
      }
      scrollToProgress(progress || 0);
      updateWhere();
      /* A new chapter is a new place even when nothing scrolls -- the top of
         one chapter to the top of the next fires no scroll event -- so it is
         saved here, not left to the scroll handler. */
      savePositionSoon();
    });
  }

  const scroller = () => host && host.querySelector(".eb-scroll");
  function textProgress() {
    const s = scroller();
    if (!s) return 0;
    const max = s.scrollHeight - s.clientHeight;
    return max > 0 ? Math.min(1, s.scrollTop / max) : 0;
  }
  function scrollToProgress(p) {
    const s = scroller();
    if (s) s.scrollTop = p * Math.max(0, s.scrollHeight - s.clientHeight);
  }

  function currentLoc() {
    /* Nothing on screen yet (a chapter still arriving), or the page already
       handed to another screen: there is no place to report, and reporting
       "the top" would overwrite the real one. */
    if (!open || !scroller()) return null;
    if (!isPdf(open.book) && open.chapter == null) return null;
    if (isPdf(open.book)) return pdfPlace();
    return {chapter: open.chapter || 0, progress: Math.round(textProgress() * 1000) / 1000};
  }

  function updateWhere() {
    const w = host && host.querySelector(".eb-where");
    if (!w || !open) return;
    const loc = currentLoc();
    if (!loc) return;
    const b = open.book;
    w.textContent = isPdf(b)
      ? `Page ${loc.page + 1}${b.pages ? ` of ${b.pages}` : ""}`
      : chapterTitle(b, loc.chapter);
  }

  let posTimer = null;
  function savePositionSoon() {
    clearTimeout(posTimer);
    posTimer = setTimeout(savePositionNow, 700);
  }
  function savePositionNow() {
    clearTimeout(posTimer);
    if (!open) return;
    const loc = currentLoc();
    if (!loc) return;
    const was = open.book.position || {};
    if (JSON.stringify(was) === JSON.stringify(loc)) return;
    saveBook(open.book, {position: loc});
  }

  /** The words at the top of the page, for a bookmark's label. */
  function excerptHere() {
    const s = scroller();
    if (!s) return "";
    const top = s.getBoundingClientRect().top;
    const blocks = s.querySelectorAll(".eb-text p, .eb-text li, .eb-text h1, .eb-text h2, .eb-text h3, .eb-text blockquote");
    for (const el of blocks) {
      const r = el.getBoundingClientRect();
      if (r.bottom > top + 8 && el.textContent.trim()) return el.textContent.trim().replace(/\s+/g, " ").slice(0, 140);
    }
    return "";
  }

  /* ---- bookmarks ------------------------------------------------------------- */

  async function addBookmark() {
    const b = open.book;
    const loc = currentLoc();
    if (!loc) return;
    const near = (b.bookmarks || []).find((m) => isPdf(b)
      ? m.page === loc.page
      : m.chapter === loc.chapter && Math.abs((m.progress || 0) - loc.progress) < 0.02);
    if (near) { toast("There is already a bookmark here."); return; }
    const mark = Object.assign({id: newId(), created: new Date().toISOString(),
      label: whereLabel(b, loc), excerpt: isPdf(b) ? "" : excerptHere()}, loc);
    const list = (b.bookmarks || []).concat([mark]);
    list.sort((x, y) => isPdf(b) ? (x.page - y.page) || (x.progress - y.progress)
      : (x.chapter - y.chapter) || (x.progress - y.progress));
    if (await saveBook(b, {bookmarks: list})) toast(`Bookmarked — ${mark.label}.`, "good");
  }

  function marksDialog() {
    const b = open.book;
    const bm = b.bookmarks || [], hl = sortedHighlights(b);
    const d = SS.shared.openDlg(`Marks in ${b.title}`, `
      <div class="eb-marks">
        <h4>Bookmarks</h4>
        ${bm.length ? bm.map((m) => `<button class="eb-markrow" data-go-bm="${esc(m.id)}">
            <b>${esc(m.label || whereLabel(b, m))}</b>
            ${m.excerpt ? `<span>${esc(m.excerpt)}</span>` : ""}</button>`).join("")
          : `<p class="stamp">None yet — ★ Bookmark saves the place you are at.</p>`}
        <h4>Highlights</h4>
        ${hl.length ? hl.map((h) => `<button class="eb-markrow" data-go-hl="${esc(h.id)}">
            <span class="eb-swatch eb-hl-${esc(h.colour)}"></span>
            <span>${esc(h.text.slice(0, 160))}${h.text.length > 160 ? "…" : ""}</span>
            ${h.note ? `<i>${esc(h.note)}</i>` : ""}</button>`).join("")
          : `<p class="stamp">None yet — select text, or pick up the highlighter.</p>`}
      </div>`, true);
    d.body.querySelectorAll("[data-go-bm]").forEach((x) => x.onclick = () => {
      const m = bm.find((y) => y.id === x.dataset.goBm); d.close(); if (m) goTo(m);
    });
    d.body.querySelectorAll("[data-go-hl]").forEach((x) => x.onclick = () => {
      const h = hl.find((y) => y.id === x.dataset.goHl); d.close(); if (h) goTo(h, h.id);
    });
    d.btn("Close", "btn-quiet", d.close);
  }

  /** Jump within the open book to a bookmark or a highlight. */
  function goTo(loc, hlId) {
    if (isPdf(open.book)) { scrollToPdf(loc.page || 0, loc.progress || 0, hlId); return; }
    if (loc.chapter === open.chapter) {
      if (hlId) {
        const m = host.querySelector(`.eb-text mark[data-hl="${CSS.escape(hlId)}"]`);
        if (m) { m.scrollIntoView({block: "center"}); m.classList.add("eb-flash"); return; }
      }
      scrollToProgress(loc.progress || 0);
      return;
    }
    showChapter(loc.chapter || 0, loc.progress || 0, hlId);
  }

  /* ---- highlights: text books ----------------------------------------------- */

  const sortedHighlights = (b) => [...(b.highlights || [])].sort((x, y) => isPdf(b)
    ? (x.page - y.page) || ((x.rects || [[0, 0]])[0][1] - (y.rects || [[0, 0]])[0][1])
    : (x.chapter - y.chapter) || (x.start - y.start));

  /** Where a point in the chapter falls, counted in characters of text. */
  function offsetIn(root, node, offset) {
    const r = document.createRange();
    r.setStart(root, 0);
    r.setEnd(node, offset);
    return r.toString().length;
  }

  /** Wrap characters [start, end) of the chapter's text in a <mark>. */
  function wrapRange(root, start, end, hl) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let pos = 0;
    const cuts = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const len = n.nodeValue.length;
      const a = Math.max(start, pos), z = Math.min(end, pos + len);
      if (a < z) cuts.push([n, a - pos, z - pos]);
      pos += len;
      if (pos >= end) break;
    }
    for (const [n, a, z] of cuts) {
      let target = n;
      if (a > 0) target = target.splitText(a);
      if (z - a < target.nodeValue.length) target.splitText(z - a);
      if (!target.nodeValue.trim() && target.parentNode && /^(TR|TBODY|TABLE|UL|OL)$/.test(target.parentNode.tagName)) continue;
      const m = document.createElement("mark");
      m.className = `eb-hl eb-hl-${hl.colour}${hl.note ? " has-note" : ""}`;
      m.dataset.hl = hl.id;
      if (hl.note) m.title = hl.note;
      target.parentNode.insertBefore(m, target);
      m.appendChild(target);
    }
    return cuts.length > 0;
  }

  function applyHighlights() {
    const b = open.book;
    const root = host.querySelector(".eb-text");
    if (!root) return;
    const full = root.textContent;
    for (const h of sortedHighlights(b).filter((x) => x.chapter === open.chapter)) {
      let {start, end} = h;
      /* The text is the check. If it is not where it was, it is looked for
         nearby -- and a highlight that cannot be found is left alone rather
         than painted over the wrong words. */
      if (full.slice(start, end) !== h.text) {
        const at = full.indexOf(h.text, Math.max(0, start - 2000));
        const found = at >= 0 ? at : full.indexOf(h.text);
        if (found < 0) continue;
        start = found; end = found + h.text.length;
      }
      wrapRange(root, start, end, h);
    }
  }

  function selectionIn(root) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!root.contains(r.commonAncestorContainer)) return null;
    const text = r.toString();
    if (!text.trim()) return null;
    return {range: r, text};
  }

  function onMouseUp(e) {
    if (!open) return;
    setTimeout(() => {
      const root = host.querySelector(isPdf(open.book) ? ".eb-pdf" : ".eb-text");
      if (!root) return;
      const s = selectionIn(root);
      if (!s) return;
      if (penDown) { highlightSelection(s, prefs.colour); return; }
      showSelBar(s);
    }, 0);
  }

  async function highlightSelection(s, colour) {
    const b = open.book;
    let h;
    if (isPdf(b)) {
      h = pdfHighlightFrom(s, colour);
      if (!h) { toast("Select text on a single page to highlight it.", "error"); return; }
    } else {
      const root = host.querySelector(".eb-text");
      const start = offsetIn(root, s.range.startContainer, s.range.startOffset);
      const end = offsetIn(root, s.range.endContainer, s.range.endOffset);
      h = {id: newId(), chapter: open.chapter, start, end,
           text: root.textContent.slice(start, end), colour, note: "",
           created: new Date().toISOString(), label: chapterTitle(b, open.chapter)};
    }
    window.getSelection().removeAllRanges();
    hideSelBar();
    const list = (b.highlights || []).concat([h]);
    if (!(await saveBook(b, {highlights: list}))) return;
    if (isPdf(b)) paintPdfHighlights(h.page);
    else wrapRange(host.querySelector(".eb-text"), h.start, h.end, h);
  }

  /* The little bar that appears over a selection. */
  function showSelBar(s) {
    const bar = host.querySelector(".eb-selbar");
    const reader = host.querySelector(".eb-reader");
    if (!bar || !reader) return;
    const rect = s.range.getBoundingClientRect();
    const box = reader.getBoundingClientRect();
    bar.innerHTML = `${COLOURS.map((c) => `<button class="eb-dot eb-hl-${c.key}" data-hlc="${c.key}" title="Highlight ${c.name.toLowerCase()}"></button>`).join("")}
      <button class="eb-selbtn" data-sel="note">Note</button>
      <button class="eb-selbtn" data-sel="copy">Copy</button>`;
    bar.hidden = false;
    bar.style.left = Math.max(8, Math.min(box.width - 260, rect.left - box.left + rect.width / 2 - 120)) + "px";
    bar.style.top = Math.max(44, rect.top - box.top - 46) + "px";
    const keep = {range: s.range.cloneRange(), text: s.text};
    bar.querySelectorAll("[data-hlc]").forEach((x) => x.onmousedown = (e) => {
      e.preventDefault(); highlightSelection(keep, x.dataset.hlc);
    });
    bar.querySelector('[data-sel="note"]').onmousedown = async (e) => {
      e.preventDefault();
      hideSelBar();
      const note = await SS.shared.promptText("Highlight with a note", "Note", "");
      if (note == null) return;
      await highlightSelection(keep, prefs.colour);
      const b = open.book;
      const last = b.highlights[b.highlights.length - 1];
      if (last && note.trim()) await setNote(last, note.trim());
    };
    bar.querySelector('[data-sel="copy"]').onmousedown = async (e) => {
      e.preventDefault(); hideSelBar();
      try { await navigator.clipboard.writeText(keep.text); toast("Copied."); }
      catch (err) { toast("The clipboard isn't available here — use Ctrl+C.", "error"); }
    };
  }
  function hideSelBar() {
    const bar = host && host.querySelector(".eb-selbar");
    if (bar) bar.hidden = true;
  }

  /* A link inside the book -- the contents page, a footnote -- is
     "chapter#anchor" (see ebooks.py); anything leading out of it was
     dropped there. */
  function followLink(a) {
    const [ch, anchor] = String(a.dataset.ebHref).split("#");
    const index = Number(ch);
    const land = () => {
      const t = anchor && host.querySelector(`.eb-text [id="${CSS.escape(anchor)}"]`);
      if (t) t.scrollIntoView({block: "start"});
      updateWhere();
    };
    if (index === open.chapter) { land(); return; }
    showChapter(index, 0).then(() => requestAnimationFrame(land));
  }

  /* Clicking a highlight: recolour it, give it a note, or take it off. */
  function onBodyClick(e) {
    if (!open) return;
    const link = e.target.closest && e.target.closest("a[data-eb-href]");
    if (link && !e.target.closest("mark[data-hl]")) { e.preventDefault(); followLink(link); return; }
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    let hl = null;
    const mark = e.target.closest && e.target.closest("mark[data-hl]");
    if (mark) hl = (open.book.highlights || []).find((h) => h.id === mark.dataset.hl);
    if (!hl && isPdf(open.book)) hl = pdfHighlightAt(e);
    if (!hl) { hideSelBar(); return; }
    highlightDialog(hl);
  }

  function highlightDialog(hl) {
    const d = SS.shared.openDlg("Highlight", `
      <blockquote class="eb-quote eb-hl-${esc(hl.colour)}">${esc(hl.text)}</blockquote>
      <div class="eb-colours">${COLOURS.map((c) => `<button class="eb-dot eb-hl-${c.key} ${
        c.key === hl.colour ? "on" : ""}" data-c="${c.key}" title="${c.name}"></button>`).join("")}</div>
      <label class="dlg-label" for="eb-note">Note</label>
      <textarea class="input" id="eb-note" rows="3" placeholder="What it made you think of…">${esc(hl.note || "")}</textarea>`);
    let colour = hl.colour;
    d.body.querySelectorAll("[data-c]").forEach((x) => x.onclick = () => {
      colour = x.dataset.c;
      d.body.querySelectorAll("[data-c]").forEach((y) => y.classList.toggle("on", y === x));
    });
    d.btn("Remove", "btn-danger", async () => { d.close(); await removeHighlight(hl); });
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save", "btn-save", async () => {
      const note = d.body.querySelector("#eb-note").value.trim();
      d.close();
      hl.colour = colour;
      await setNote(hl, note);
    });
  }

  async function setNote(hl, note) {
    hl.note = note;
    await saveBook(open.book, {highlights: open.book.highlights});
    repaintHighlights();
  }
  async function removeHighlight(hl) {
    const b = open.book;
    await saveBook(b, {highlights: (b.highlights || []).filter((h) => h.id !== hl.id)});
    repaintHighlights();
  }
  function repaintHighlights() {
    if (!open) return;
    if (isPdf(open.book)) { host.querySelectorAll(".eb-pdfpage").forEach((p) => paintPdfHighlights(Number(p.dataset.page))); return; }
    const root = host.querySelector(".eb-text");
    if (!root) return;
    root.querySelectorAll("mark[data-hl]").forEach((m) => {
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
    });
    root.normalize();
    applyHighlights();
  }

  /* ======================================================================
     PDF -- drawn by Notes' own pdf.js, a page at a time as it comes into
     view, with pdf.js's text layer over each page so text can be selected
     and highlighted.
     ====================================================================== */

  let pdfjsPromise = null;
  function pdfjs() {
    if (!pdfjsPromise) {
      // The page's base, not location: the same thing in the app, and still
      // right for a page that sets <base>.
      const base = new URL("notes/vendor/pdfjs/", document.baseURI);
      pdfjsPromise = import(new URL("pdf.min.mjs", base).href).then((mod) => {
        mod.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", base).href;
        return mod;
      });
    }
    return pdfjsPromise;
  }

  async function openPdf(page) {
    const wrap = page.querySelector(".eb-pdf");
    wrap.innerHTML = `<p class="stamp eb-pdf-status">Opening…</p>`;
    let lib, data;
    try { lib = await pdfjs(); } catch (e) {
      wrap.innerHTML = `<p class="bd-empty">The PDF reader couldn't start.</p>`; return;
    }
    const b = open.book;
    const got = await call("ebooks_pdf", [b.id], "Opening the PDF");
    if (!open || open.book !== b) return;
    if (!got || got.error) { wrap.innerHTML = `<p class="bd-empty">${esc((got && got.error) || "The PDF couldn't be read.")}</p>`; return; }
    const raw = atob(got.data.split(",")[1] || "");
    data = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
    try {
      open.pdf = await lib.getDocument({data, isEvalSupported: false}).promise;   // no eval from a PDF (CVE-2024-4367)
    } catch (e) {
      wrap.innerHTML = `<p class="bd-empty">That PDF couldn't be opened — it may be damaged or password-protected.</p>`;
      return;
    }
    open.lib = lib;
    if (b.pages !== open.pdf.numPages) saveBook(b, {pages: open.pdf.numPages});
    if (!b.cover) makePdfCover();
    await layoutPdf(page.querySelector(".eb-reader"));
    const j = open.jump || {};
    scrollToPdf(Number(j.page) || 0, Number(j.progress) || 0, j.highlight);
  }

  /** Every page as a placeholder of the right size; drawn when near view. */
  async function layoutPdf(reader) {
    if (!open || !open.pdf) return;
    const wrap = reader.querySelector(".eb-pdf");
    const first = await open.pdf.getPage(1);
    const natural = first.getViewport({scale: 1});
    const avail = Math.max(280, reader.querySelector(".eb-scroll").clientWidth - 48);
    open.scale = Math.min(avail / natural.width, 1.6) * (prefs.pdfZoom || 1);
    wrap.innerHTML = "";
    if (open.observer) open.observer.disconnect();
    open.drawn = new Set();
    for (let i = 0; i < open.pdf.numPages; i++) {
      const p = document.createElement("div");
      p.className = "eb-pdfpage";
      p.dataset.page = String(i);
      p.style.width = Math.round(natural.width * open.scale) + "px";
      p.style.height = Math.round(natural.height * open.scale) + "px";
      p.style.setProperty("--scale-factor", String(open.scale));
      p.innerHTML = `<span class="eb-pageno">${i + 1}</span>`;
      wrap.appendChild(p);
    }
    open.observer = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) drawPdfPage(Number(en.target.dataset.page));
    }, {root: reader.querySelector(".eb-scroll"), rootMargin: "900px 0px"});
    wrap.querySelectorAll(".eb-pdfpage").forEach((p) => open.observer.observe(p));
  }

  async function drawPdfPage(i) {
    if (!open || !open.pdf || open.drawn.has(i)) return;
    open.drawn.add(i);
    const holder = host.querySelector(`.eb-pdfpage[data-page="${i}"]`);
    if (!holder) return;
    const pg = await open.pdf.getPage(i + 1);
    const vp = pg.getViewport({scale: open.scale});
    holder.style.width = Math.round(vp.width) + "px";
    holder.style.height = Math.round(vp.height) + "px";
    const ratio = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vp.width * ratio);
    canvas.height = Math.floor(vp.height * ratio);
    canvas.style.width = Math.round(vp.width) + "px";
    canvas.style.height = Math.round(vp.height) + "px";
    const hlLayer = document.createElement("div");
    hlLayer.className = "eb-pdfhl";
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer eb-textlayer";
    holder.innerHTML = "";
    holder.append(canvas, hlLayer, textLayer);
    await pg.render({canvasContext: canvas.getContext("2d"), viewport: vp,
                     transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null}).promise;
    try {
      const tl = new open.lib.TextLayer({textContentSource: pg.streamTextContent(),
                                         container: textLayer, viewport: vp});
      await tl.render();
    } catch (e) { /* a page with no text still reads; it just can't be highlighted */ }
    paintPdfHighlights(i);
  }

  function pdfPlace() {
    const s = scroller();
    const pages = host ? [...host.querySelectorAll(".eb-pdfpage")] : [];
    if (!s || !pages.length) return {page: (open && open.jump && open.jump.page) || 0, progress: 0};
    const top = s.scrollTop + 4;
    let page = 0;
    for (const p of pages) { if (p.offsetTop <= top) page = Number(p.dataset.page); else break; }
    const el = pages[page];
    const progress = el ? Math.max(0, Math.min(1, (top - el.offsetTop) / el.offsetHeight)) : 0;
    return {page, progress: Math.round(progress * 1000) / 1000};
  }

  function scrollToPdf(page, progress, hlId) {
    const s = scroller();
    const el = host && host.querySelector(`.eb-pdfpage[data-page="${page}"]`);
    if (!s || !el) return;
    s.scrollTop = el.offsetTop + (progress || 0) * el.offsetHeight - 4;
    drawPdfPage(page);
    updateWhere();
    if (hlId) setTimeout(() => {
      const box = el.querySelector(`[data-hl="${CSS.escape(hlId)}"]`);
      if (box) { box.scrollIntoView({block: "center"}); box.classList.add("eb-flash"); }
    }, 400);
  }

  function pdfStep(d) {
    const at = pdfPlace();
    scrollToPdf(Math.max(0, Math.min((open.pdf ? open.pdf.numPages : 1) - 1, at.page + d)), 0);
  }

  /** A selection on one page, as rectangles in fractions of that page -- so
      the highlight lands in the same place at any zoom. */
  function pdfHighlightFrom(s, colour) {
    const startPage = s.range.startContainer.parentElement && s.range.startContainer.parentElement.closest(".eb-pdfpage");
    const endPage = s.range.endContainer.parentElement && s.range.endContainer.parentElement.closest(".eb-pdfpage");
    const pageEl = startPage || endPage;
    if (!pageEl || (startPage && endPage && startPage !== endPage)) return null;
    const box = pageEl.getBoundingClientRect();
    const rects = [...s.range.getClientRects()]
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => [(r.left - box.left) / box.width, (r.top - box.top) / box.height,
                   r.width / box.width, r.height / box.height].map((v) => Math.round(v * 10000) / 10000));
    if (!rects.length) return null;
    const page = Number(pageEl.dataset.page);
    return {id: newId(), page, rects, text: pdfRangeText(s.range) || s.text.replace(/\s+/g, " ").trim(), colour, note: "",
            created: new Date().toISOString(), label: `Page ${page + 1}`,
            progress: Math.max(0, Math.min(1, rects[0][1]))};
  }

  /** A PDF's text layer is one span per run of text with nothing between
      lines, so a plain toString() runs the last word of a line into the first
      of the next ("276Making"). Span by span, with a space between. */
  function pdfRangeText(range) {
    const root = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!range.intersectsNode(n)) continue;
      const a = n === range.startContainer ? range.startOffset : 0;
      const z = n === range.endContainer ? range.endOffset : n.nodeValue.length;
      parts.push(n.nodeValue.slice(a, z));
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  function paintPdfHighlights(i) {
    const holder = host && host.querySelector(`.eb-pdfpage[data-page="${i}"] .eb-pdfhl`);
    if (!holder) return;
    holder.innerHTML = (open.book.highlights || []).filter((h) => h.page === i)
      .map((h) => h.rects.map(([x, y, w, hh]) => `<div class="eb-hl eb-hl-${esc(h.colour)}" data-hl="${esc(h.id)}"
        style="left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${hh * 100}%"
        ${h.note ? `title="${esc(h.note)}"` : ""}></div>`).join("")).join("");
  }

  /** A click on a PDF page lands on the text layer, above the highlights:
      which highlight, if any, is under the pointer. */
  function pdfHighlightAt(e) {
    const pageEl = e.target.closest && e.target.closest(".eb-pdfpage");
    if (!pageEl) return null;
    const box = pageEl.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width, y = (e.clientY - box.top) / box.height;
    const i = Number(pageEl.dataset.page);
    return (open.book.highlights || []).find((h) => h.page === i
      && h.rects.some(([rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh)) || null;
  }

  /** A PDF has no cover image of its own; its first page becomes one. */
  async function makePdfCover() {
    try {
      const b = open.book;
      const pg = await open.pdf.getPage(1);
      const vp0 = pg.getViewport({scale: 1});
      const vp = pg.getViewport({scale: 240 / vp0.width});
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      await pg.render({canvasContext: c.getContext("2d"), viewport: vp}).promise;
      const url = c.toDataURL("image/jpeg", 0.78);
      if (url && url.length > 100 && open && open.book === b) {
        await call("ebooks_update", [b.id, {cover: url}], "");
        b.cover = url;
      }
    } catch (e) { /* the plain cover reads fine */ }
  }

  /* ======================================================================
     NOTES → BOOKMARKS -- every bookmark and highlight, in every book.
     ====================================================================== */

  let marksTab = "bookmarks";
  let marksBook = "";

  async function renderBookmarks(page) {
    await loadBooks();
    const withMarks = books.filter((b) => (b.bookmarks || []).length || (b.highlights || []).length);
    const shown = withMarks.filter((b) => !marksBook || b.id === marksBook);
    const count = (k) => shown.reduce((n, b) => n + (b[k] || []).length, 0);
    page.innerHTML = `
      <div class="eb-shelf">
        <div class="bd-head">
          <h2 class="page-h">Bookmarks</h2>
          <p class="stamp">Every place you marked and every passage you
            highlighted, book by book. Open one to go straight to it.</p>
        </div>
        <div class="eb-tabs">
          <button class="chip ${marksTab === "bookmarks" ? "on" : ""}" data-tab="bookmarks">Bookmarks <span class="pe-count">${count("bookmarks")}</span></button>
          <button class="chip ${marksTab === "highlights" ? "on" : ""}" data-tab="highlights">Highlights <span class="pe-count">${count("highlights")}</span></button>
          ${withMarks.length > 1 ? `<select class="input eb-bookpick" id="eb-bookpick">
            <option value="">Every book</option>
            ${withMarks.map((b) => `<option value="${esc(b.id)}"${b.id === marksBook ? " selected" : ""}>${esc(b.title)}</option>`).join("")}
          </select>` : ""}
        </div>
        ${shown.map((b) => {
          const list = marksTab === "bookmarks" ? (b.bookmarks || []) : sortedHighlights(b);
          if (!list.length) return "";
          return `<section class="pe-section">
            <h3 class="pe-h">${esc(b.title)} <span class="pe-count">${list.length}</span></h3>
            <div class="bd-list">${list.map((m) => marksTab === "bookmarks" ? `
              <div class="bd-row">
                <div class="bd-row-main">
                  <div class="bd-name">★ ${esc(m.label || whereLabel(b, m))}</div>
                  <div class="bd-meta">${m.excerpt ? esc(m.excerpt) + " · " : ""}${esc(shortDate(m.created))}</div>
                </div>
                <button class="btn btn-quiet" data-go="${esc(b.id)}|bm|${esc(m.id)}">Open</button>
                <button class="btn btn-quiet bd-del" data-rm="${esc(b.id)}|bm|${esc(m.id)}">Delete</button>
              </div>` : `
              <div class="bd-row">
                <span class="eb-swatch eb-hl-${esc(m.colour)}"></span>
                <div class="bd-row-main">
                  <div class="bd-name eb-hltext">${esc(m.text)}</div>
                  <div class="bd-meta">${esc(m.label || whereLabel(b, m))}${m.note ? ` · <i>${esc(m.note)}</i>` : ""} · ${esc(shortDate(m.created))}</div>
                </div>
                <button class="btn btn-quiet" data-go="${esc(b.id)}|hl|${esc(m.id)}">Open</button>
                <button class="btn btn-quiet bd-del" data-rm="${esc(b.id)}|hl|${esc(m.id)}">Delete</button>
              </div>`).join("")}</div></section>`;
        }).join("") || `<p class="bd-empty">${marksTab === "bookmarks"
          ? "No bookmarks yet. In a book, ★ Bookmark saves the place you are at."
          : "No highlights yet. In a book, select some text, or pick up the highlighter."}</p>`}
      </div>`;
    page.querySelectorAll("[data-tab]").forEach((t) => t.onclick = () => { marksTab = t.dataset.tab; renderBookmarks(page); });
    const pick = page.querySelector("#eb-bookpick");
    if (pick) pick.onchange = () => { marksBook = pick.value; renderBookmarks(page); };
    page.querySelectorAll("[data-go]").forEach((x) => x.onclick = () => {
      const [bid, kind, mid] = x.dataset.go.split("|");
      const b = bookById(bid);
      const m = b && (kind === "bm" ? b.bookmarks : b.highlights).find((y) => y.id === mid);
      if (!m) return;
      open = {book: b, jump: Object.assign({}, m, kind === "hl" ? {highlight: m.id} : {})};
      saveBook(b, {opened: new Date().toISOString()});
      SS.go("ebooks:library");
    });
    page.querySelectorAll("[data-rm]").forEach((x) => x.onclick = async () => {
      const [bid, kind, mid] = x.dataset.rm.split("|");
      const b = bookById(bid);
      if (!b) return;
      const key = kind === "bm" ? "bookmarks" : "highlights";
      const yes = await SS.shared.confirm({title: kind === "bm" ? "Delete this bookmark?" : "Delete this highlight?",
        body: "It goes from the book too.", yes: "Delete"});
      if (!yes) return;
      await saveBook(b, {[key]: (b[key] || []).filter((m) => m.id !== mid)});
      renderBookmarks(page);
    });
  }

  /* ======================================================================
     THE MODULE
     ====================================================================== */

  async function mount(h, which) {
    host = h;
    await loadPrefs();
    h.style.display = "";
    h.classList.remove("ss-main-fills");
    h.innerHTML = "";
    const page = document.createElement("div");
    page.className = "page ss-ebooks";
    h.appendChild(page);
    if (which === "ebooks:bookmarks") {
      if (open) closeReader();
      return renderBookmarks(page);
    }
    if (open) return renderReader(page);
    return renderLibrary(page);
  }

  SS.Ebooks = {
    VIEWS: ["ebooks:library", "ebooks:bookmarks"],
    PREFIX: "ebooks:",
    mount,
    /** Leaving Ebooks keeps the place: the reader saves where it is. */
    unmount() { if (open) savePositionNow(); },
    get open() { return open; },
    /** Open a book by id (NeuroNet's reader and the desktop Bookshelf). */
    openBook: (id, loc, fromDesktop) => openBook(id, loc, fromDesktop),
    _test: {offsetIn, wrapRange, openBook, closeReader, showChapter, addBookmark,
            highlightSelection, currentLoc, sortedHighlights, pdfHighlightFrom,
            progressOf, get books() { return books; }, setPen: (v) => { penDown = v; }},
  };
})();
