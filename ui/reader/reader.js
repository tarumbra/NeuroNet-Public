/* ==========================================================================
   SS.Reader -- read any book NeuroNet makes, inside NeuroNet.
   ==========================================================================
   Cam (2026-10-01/02): "a bookshelf widget for the desktop, this will present
   covers and i can read within the window or click again to enter reading
   mode ... for quickly reveiwing programs, notes, ebooks etc." and "The
   bookshelf with dekstop widget needs to have the ability to zoom in as well
   so i can focus in words."

   WHAT IT SHOWS. A book's own printed document -- the very HTML its section's
   Print button opens -- so what is read is what prints. Each section hands it
   over (PROVIDERS below); Ebooks open in their own reader instead.

   THE FRAME. The document sits in an <iframe sandbox="allow-same-origin">: it
   can't run anything, but this page can reach in to zoom it and to tell a
   double-click. Paper: Day (as printed), Sepia, Night (inverted, pictures
   turned back the right way). Zoom 50-300%, by A- / A+, Ctrl+wheel or
   Ctrl +/-/0. Both are remembered.

   CLOSING (✕ or Esc). A book opened from the desktop Bookshelf puts NeuroNet
   away as it closes -- Cam (2026-10-02): "when closing a book i want it to
   return to the desktop by default and not keep the notes tool open". One
   opened inside NeuroNet (Money -> Books -> Read) just closes.

   Reading mode (full screen, menus hidden) was here briefly and was taken
   out the same day: Cam, "reading mode doesnt really work, it doesnt allow me
   to scroll or anything. Lets just remove it."
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const toast = (m, k) => SS.shared && SS.shared.toast(m, k);
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "Reader");

  /* kind -> a function giving {title, html, printKind} for a book id. */
  const PROVIDERS = {
    training: (id) => window.CF && CF.Books && CF.Books.document ? CF.Books.document(id) : null,
    puzzles: (id) => window.CR && CR.bookDocument ? CR.bookDocument(id) : null,
    notebook: (id) => SS.Notebooks && SS.Notebooks.document ? SS.Notebooks.document(id) : null,
    recipes: (id) => SS.KitchenBooks ? SS.KitchenBooks.document(id) : null,
    money: (id) => SS.MoneyBooks ? SS.MoneyBooks.document(id) : null,
  };
  const KINDS = Object.keys(PROVIDERS).concat(["ebook"]);

  const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const PAPERS = [["day", "Day"], ["sepia", "Sepia"], ["night", "Night"]];
  const KEY = "nn:reader";
  let prefs = {zoom: 1, paper: "day"};
  try { prefs = Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* defaults */ }
  if (!ZOOMS.includes(prefs.zoom)) prefs.zoom = 1;
  if (!PAPERS.some(([k]) => k === prefs.paper)) prefs.paper = "day";
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* this session */ } };

  let box = null;          // the overlay, made on first use
  let book = null;         // {kind, id, title, html, printKind, fromDesktop}

  function build() {
    box = document.createElement("div");
    box.id = "nn-reader";
    box.className = "rd";
    box.hidden = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Reader");
    box.innerHTML = `
      <div class="rd-bar">
        <button class="btn btn-quiet rd-close" data-rd="close" title="Close (Esc)">✕</button>
        <b class="rd-title" id="rd-title"></b>
        <div class="rd-tools">
          <span class="rd-group" role="group" aria-label="Paper">
            ${PAPERS.map(([k, n]) => `<button class="chip" data-paper="${k}">${n}</button>`).join("")}
          </span>
          <span class="rd-group rd-zoom" role="group" aria-label="Zoom">
            <button class="btn btn-quiet" data-rd="out" title="Smaller (Ctrl −)">A−</button>
            <button class="btn btn-quiet rd-pct" data-rd="reset" title="Back to 100% (Ctrl 0)"></button>
            <button class="btn btn-quiet" data-rd="in" title="Bigger (Ctrl +)">A+</button>
          </span>
          <button class="btn btn-quiet" data-rd="print">Print…</button>
        </div>
      </div>
      <div class="rd-stage"><iframe class="rd-frame" sandbox="allow-same-origin" title="Book"></iframe></div>`;
    document.body.appendChild(box);
    box.addEventListener("click", (e) => {
      const p = e.target.closest("[data-paper]");
      if (p) { prefs.paper = p.dataset.paper; keep(); paint(); return; }
      const b = e.target.closest("[data-rd]");
      if (!b) return;
      const a = b.dataset.rd;
      if (a === "close") close();
      else if (a === "in") zoomBy(1);
      else if (a === "out") zoomBy(-1);
      else if (a === "reset") setZoom(1);
      else if (a === "print") printIt();
    });
    box.addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1 : -1);
    }, {passive: false});
    frame().addEventListener("load", wireFrame);
  }

  const frame = () => box.querySelector(".rd-frame");

  /* Into the frame: zoom, paper, and the keys that would otherwise stop at
     its edge. */
  function wireFrame() {
    const d = frame().contentDocument;
    if (!d) return;
    // once per page: a second load event on the same document would stack the
    // listeners, and Ctrl+wheel then zoomed two steps (125% -> 175%)
    if (d.__rdWired) { paint(); return; }
    d.__rdWired = true;
    d.addEventListener("keydown", onKey);
    d.addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1 : -1);
    }, {passive: false});
    paint();
  }

  function paint() {
    if (!box) return;
    box.querySelectorAll("[data-paper]").forEach((b) => b.classList.toggle("on", b.dataset.paper === prefs.paper));
    box.querySelector(".rd-pct").textContent = Math.round(prefs.zoom * 100) + "%";
    box.querySelector('[data-rd="out"]').disabled = prefs.zoom <= ZOOMS[0];
    box.querySelector('[data-rd="in"]').disabled = prefs.zoom >= ZOOMS[ZOOMS.length - 1];
    box.dataset.tone = prefs.paper;     // not data-paper: that marks the chips
    const d = frame().contentDocument;
    if (d && d.documentElement) {
      d.documentElement.style.zoom = String(prefs.zoom);
      let st = d.getElementById("nn-rd-style");
      if (!st) {
        st = d.createElement("style");
        st.id = "nn-rd-style";
        (d.head || d.documentElement).appendChild(st);
      }
      /* Night turns the whole page over (the frame's filter); pictures are
         turned back so a photo isn't a negative. */
      st.textContent = prefs.paper === "night"
        ? "img, svg image, video, canvas { filter: invert(1) hue-rotate(180deg); }"
        : "";
    }
  }

  function setZoom(z) {
    prefs.zoom = z; keep(); paint();
  }
  function zoomBy(step) {
    let i = ZOOMS.indexOf(prefs.zoom);
    if (i < 0) i = ZOOMS.indexOf(1);
    setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + step))]);
  }

  function onKey(e) {
    if (!box || box.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      close();
      return;
    }
    if (e.ctrlKey && (e.key === "+" || e.key === "=")) { e.preventDefault(); zoomBy(1); }
    else if (e.ctrlKey && e.key === "-") { e.preventDefault(); zoomBy(-1); }
    else if (e.ctrlKey && e.key === "0") { e.preventDefault(); setZoom(1); }
  }

  async function printIt() {
    if (!book) return;
    const r = await call("open_print_document", [book.html, book.printKind || null], "Printing");
    if (r && r.error) toast(r.error, "error");
  }

  /** Open a book: kind is training | puzzles | notebook | recipes | money |
      ebook. {fromDesktop: true} (the desktop Bookshelf): closing it puts
      NeuroNet away again. */
  async function open(kind, id, opts) {
    const o = opts || {};
    if (kind === "ebook") {
      if (!(SS.Ebooks && SS.Ebooks.openBook)) return {error: "Ebooks isn't loaded."};
      close(true);
      await SS.Ebooks.openBook(id, null, !!o.fromDesktop);
      return {ok: true};
    }
    const get = PROVIDERS[kind];
    if (!get) return {error: "NeuroNet doesn't know that kind of book."};
    const got = await get(id);
    if (!got || !got.html) {
      toast("That book isn't there any more.", "error");
      return {error: "That book isn't there any more."};
    }
    if (!box) build();
    book = Object.assign({kind, id, fromDesktop: !!o.fromDesktop}, got);
    box.querySelector("#rd-title").textContent = got.title || "Book";
    box.hidden = false;
    frame().srcdoc = got.html;
    box.querySelector(".rd-close").focus({preventScroll: true});
    return {ok: true};
  }

  /** Close the book. `quiet` (another book is about to open) keeps NeuroNet
      where it is; otherwise a book from the desktop puts NeuroNet away. */
  function close(quiet) {
    const wasOpen = !!(box && !box.hidden);
    const toDesktop = wasOpen && book && book.fromDesktop && quiet !== true;
    if (box) {
      box.hidden = true;
      frame().srcdoc = "";
    }
    book = null;
    if (toDesktop) call("quick_hide", [], "").catch(() => {});
  }

  /* Always listening, acting only while a book is open. */
  document.addEventListener("keydown", onKey, true);

  SS.Reader = {
    open, close, KINDS, ZOOMS,
    get isOpen() { return !!(box && !box.hidden); },
    get prefs() { return {...prefs}; },
    _test: {zoomBy, setZoom, onKey, get box() { return box; }},
  };
})();
