/* ==========================================================================
   A book, as one document.
   ==========================================================================
   Cam: "add any type of note from a subsection to it and then export or
   print."

   THE RULE THIS FILE FOLLOWS: each kind of thing is rendered by whatever
   already owns it, never re-implemented here.

     a note    CC.md.render -- the Vault's own markdown renderer, so a
               printed note is the note as the Vault shows it
     a sheet   SSGrid.computeAll and SSGrid.display -- the same engine
               that draws the grid, so a printed formula is the answer
               the sheet shows, not a second opinion
     a board   SS.BoardEditor.pageSVG -- the same picture the editor
               draws and the same one the .pptx export uses
     a guide   its own body, which is already HTML

   A second renderer is a second set of bugs, and worse, a second set of
   answers: a printed total that disagrees with the one on screen is the
   kind of thing a person only finds out about from someone else.

   WHAT CANNOT BE INLINED SAYS SO. A PDF cannot be embedded into a page of
   HTML that has to print and convert to Word, so a PDF entry prints as a
   clearly marked reference -- its name and where it is -- rather than
   silently leaving a chapter out. Training does the same for the files it
   cannot inline, for the same reason: the surprise belongs on the page,
   not in the finished document.
   ========================================================================== */
(() => {
  "use strict";

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const call = (name, args, what) => SS.Store.call(name, args, what);

  /* Print styles. Deliberately plain and light: this is paper, and a page
     of the app's dark theme printed as-is is a page of black ink.

     Cam: "Please design the print pages from the notebooks to match all the
     other print and export pages." So: the shared letterhead across the top
     of the cover (NeuroNet left, the notebook's name centred, the notes mark
     right), headings in the letterhead's deep green (6.4:1 on white), and
     the two-tone rule under each chapter title that every other printout
     draws under its headings. The contents are untouched. */
  const INK = "#2E6B38", TINT = "#5FA665";
  /* The house style (print_header.py, via SS.PrintHouse) comes first -- type,
     headings, lists, tables, the title block (Cam, 2026-10-05: all printouts
     "handled in this way"). These are only a notebook's own pieces. */
  const CSS = `
    .cover { text-align: center; padding: 70px 0 20px; }
    .cover .nn-title { font-size: 34px; border-bottom: 0; }
    .cover .nn-chips { justify-content: center; }
    .contents, .chapter { page-break-before: always; break-before: page; }
    .bk-index { list-style: none; padding: 0; }
    .bk-index li { display: flex; gap: 10px; align-items: baseline; padding: 7px 0;
                   border-bottom: 1px dashed #d6d9d3; margin: 0; }
    .bk-index .n { color: #2E6B38; font-weight: 700; min-width: 26px; }
    .bk-index .k { margin-left: auto; color: #5d665f; font-size: 11.5px; }
    pre { background: #f4f6f2; border: 1px solid #d6d9d3; border-radius: 6px;
          padding: 8px 10px; font-size: 11.5px; line-height: 1.45; white-space: pre-wrap; margin: 0 0 10px; }
    code { font-size: .92em; background: #f4f6f2; padding: 0 3px; border-radius: 3px; }
    pre code { background: none; padding: 0; }
    img, svg { max-width: 100%; height: auto; }
    .gap { border: 1.5px dashed #c9cfc6; border-radius: 6px; padding: 12px 14px;
           color: #5d665f; font-style: italic; }
    .ref-card { border: 1px solid #d6d9d3; border-left: 4px solid #2E6B38; border-radius: 6px;
                padding: 12px 14px; background: #f4f6f2; }
    .sheet-name { font-size: 11px; color: #5d665f; margin: 0 0 6px; }
    table.jr-cards { border: 0; }
    .board-page svg { border: 1px solid #d6d9d3; border-radius: 6px; }`;

  /* ---- each kind of thing, rendered by whatever owns it ---------------- */

  async function noteHtml(path) {
    const text = await call("notes_read_note", [path], "Reading a note");
    if (text == null) return null;
    /* The renderer wants the set of titles that exist, so a [[link]] to a
       real note is drawn differently from one to a missing note. On paper
       neither is clickable, but the distinction still shows. */
    let titles = new Set();
    try {
      const all = await call("notes_read_all_notes", [], "Reading the vault");
      const list = (all && all.notes) || (Array.isArray(all) ? all : []);
      titles = new Set(list.map((n) =>
        String(n.path || n.name || "").replace(/\.md$/i, "")
          .split("/").pop().toLowerCase()));
    } catch (e) { /* links simply all read as unmade */ }
    return window.CC && window.CC.md
      ? window.CC.md.render(String(text), titles)
      : `<pre>${esc(String(text))}</pre>`;
  }

  async function canvasHtml(path) {
    const raw = await call("notes_read_canvas", [path], "Reading a canvas");
    if (raw == null) return null;
    let model;
    try { model = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch (e) { return `<p class="gap">This canvas could not be read.</p>`; }
    const nodes = (model && model.nodes) || [];
    if (!nodes.length) return `<p class="gap">This canvas is empty.</p>`;
    /* A canvas is an arrangement, and an arrangement does not survive
       being poured into a column of paper. What DOES survive is what the
       cards say, in reading order, which is what a book wants -- said
       outright rather than pretending the layout came across. */
    return `<p class="sheet-name">${nodes.length} card${
      nodes.length === 1 ? "" : "s"}, in reading order — a canvas's
      arrangement cannot be printed, its contents can.</p>
      <ul>${nodes.map((n) => {
        const t = n.text || n.file || n.url || n.label || "";
        return `<li>${esc(String(t).slice(0, 400))}</li>`;
      }).join("")}</ul>`;
  }

  async function sheetHtml(id) {
    const got = await call("cells_read", [id], "Reading a sheet");
    if (!got || got.error || !got.sheet) return null;
    const grid = got.sheet.grid;
    if (!grid || !window.SSGrid) return `<p class="gap">This sheet could not be read.</p>`;
    const m = window.SSGrid.normalise(grid);
    const vals = window.SSGrid.computeAll(m);
    /* Only the part that has anything in it. A sheet is 40 by 120 now, and
       printing every empty cell would be a hundred pages of ruled paper. */
    let lastRow = -1, lastCol = -1;
    for (let r = 0; r < m.rows.length; r++) {
      for (let c = 0; c < m.rows[r].length; c++) {
        if (String(m.rows[r][c] ?? "").trim() !== "") {
          if (r > lastRow) lastRow = r;
          if (c > lastCol) lastCol = c;
        }
      }
    }
    if (lastRow < 0) return `<p class="gap">This sheet is empty.</p>`;
    const cell = (r, c) => {
      const f = m.fmt[window.SSGrid.refName(c, r)] || {};
      return esc(window.SSGrid.display(vals[r][c], f.num));
    };
    const head = m.freeze ? 1 : 0;
    const rows = [];
    for (let r = head; r <= lastRow; r++) {
      rows.push(`<tr>${Array.from({length: lastCol + 1},
        (_, c) => `<td>${cell(r, c)}</td>`).join("")}</tr>`);
    }
    const header = head
      ? `<thead><tr>${Array.from({length: lastCol + 1},
          (_, c) => `<th>${cell(0, c)}</th>`).join("")}</tr></thead>`
      : "";
    return `<table>${header}<tbody>${rows.join("")}</tbody></table>`;
  }

  /* A scrapbook is drawn the same way: its pages are board pages, with
     the Scrapbook's papers and materials (SS.ScrapArt). */
  async function boardHtml(id, scrapbook) {
    const got = scrapbook ? await call("scrapbooks_read", [id], "Reading a scrapbook")
      : await call("boards_read", [id], "Reading a board");
    const board = got && !got.error && (scrapbook ? got.book : got.board);
    if (!board) return null;
    const pages = board.pages || [];
    if (!window.SS.BoardEditor || !window.SS.BoardEditor.pageSVG) {
      return `<p class="gap">Boards cannot be drawn in this build.</p>`;
    }
    if (!pages.length) return `<p class="gap">This board is empty.</p>`;
    /* The editor's own page picture, embedded. Everything it needs is
       inside it -- photos are embedded, shapes are drawn as SVG -- so
       nothing is fetched when the document is opened or converted. */
    return pages.map((_, i) => {
      const svg = window.SS.BoardEditor.pageSVG(board, i);
      return `${pages.length > 1
        ? `<p class="sheet-name">Page ${i + 1} of ${pages.length}</p>` : ""}
        <div class="board-page">${svg}</div>`;
    }).join("");
  }

  function pdfHtml(path) {
    /* Honest rather than silent. A PDF is its own document; it cannot be
       poured into this one and still print and convert to Word. */
    return `<div class="ref-card"><b>This is a PDF, kept in the vault.</b>
      It is referenced here rather than reprinted — open
      <code>${esc(path)}</code> in Notes to read it.</div>`;
  }

  function guideHtml(id) {
    const guides = (SS.Guides && SS.Guides._test && SS.Guides._test.GUIDES) || [];
    const g = guides.find((x) => x.id === id);
    return g ? g.body : null;
  }

  /** A journal entry on paper: its cards (reversed ones upside down), its
      words, its photos. The pictures travel in the page as data. */
  async function journalHtml(id) {
    const list = await call("journal_list", [], "Reading your journal");
    const e = (Array.isArray(list) ? list : []).find((x) => x.id === id);
    if (!e) return null;
    const pic = async (name) => (await call("journal_image_url", [name, false, true], "")) || "";
    const r = e.reading;
    let cards = "";
    if (r && r.cards && r.cards.length) {
      const urls = await Promise.all(r.cards.map((c) => c.image ? pic(c.image) : ""));
      cards = `<p class="sheet-name">${esc([r.spreadName, r.deckName].filter(Boolean).join(" \u00b7 "))}</p>
        <table class="jr-cards"><tr>${r.cards.map((c, i) => `<td style="border:0;text-align:center;
          width:${Math.floor(100 / r.cards.length)}%">${urls[i] ? `<img src="${urls[i]}" alt=""
          style="max-height:150pt;${c.reversed ? "transform:rotate(180deg)" : ""}">` : ""}
          <div><b>${esc(c.name)}</b>${c.reversed ? " (reversed)" : ""}</div>
          ${c.positionLabel ? `<div class="sheet-name">${esc(c.positionLabel)}</div>` : ""}</td>`).join("")}
        </tr></table>`;
    }
    const text = (e.text || "").trim()
      ? (e.text || "").split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("") : "";
    const photos = e.photos.length
      ? (await Promise.all(e.photos.map(pic))).filter(Boolean)
        .map((u) => `<img src="${u}" alt="" style="max-height:220pt;margin:0 6pt 6pt 0">`).join("") : "";
    return cards + text + (photos ? `<div>${photos}</div>` : "");
  }

  /* ---- the whole document --------------------------------------------- */

  async function chapterFor(entry) {
    const t = (SS.Notebooks._test.typeOf(entry.type) || {});
    const label = t.label || entry.type;
    let title = "", where = "", body = null;
    try {
      if (entry.type === "note") {
        title = entry.refId.split("/").pop().replace(/\.md$/i, "");
        where = entry.refId;
        body = await noteHtml(entry.refId);
      } else if (entry.type === "canvas") {
        title = entry.refId.split("/").pop().replace(/\.canvas$/i, "");
        where = entry.refId;
        body = await canvasHtml(entry.refId);
      } else if (entry.type === "pdf") {
        title = entry.refId.split("/").pop().replace(/\.pdf$/i, "");
        where = entry.refId;
        body = pdfHtml(entry.refId);
      } else if (entry.type === "sheet") {
        const got = await call("cells_read", [entry.refId], "Reading a sheet");
        if (got && got.sheet) title = got.sheet.name || entry.refId;
        body = await sheetHtml(entry.refId);
      } else if (entry.type === "board") {
        const got = await call("boards_read", [entry.refId], "Reading a board");
        if (got && got.board) title = got.board.name || entry.refId;
        body = await boardHtml(entry.refId);
      } else if (entry.type === "scrapbook") {
        const got = await call("scrapbooks_read", [entry.refId], "Reading a scrapbook");
        if (got && got.book) title = got.book.name || entry.refId;
        body = await boardHtml(entry.refId, true);
      } else if (entry.type === "guide") {
        const guides = (SS.Guides && SS.Guides._test && SS.Guides._test.GUIDES) || [];
        const g = guides.find((x) => x.id === entry.refId);
        if (g) { title = g.title; body = g.body; }
      } else if (entry.type === "journal") {
        const list = await call("journal_list", [], "Reading your journal");
        const e = (Array.isArray(list) ? list : []).find((x) => x.id === entry.refId);
        if (e) { title = e.title || e.date; where = e.date; body = await journalHtml(entry.refId); }
      }
    } catch (e) { body = null; }

    if (body == null) {
      /* A reference that has gone. A GAP ON THE PAGE, not a silent
         omission: someone reading the printed book has to be able to see
         that a chapter was meant to be there. */
      return {title: title || entry.refId, label, missing: true,
        html: `<div class="gap"><b>Missing.</b> This ${esc(label.toLowerCase())}
          — <code>${esc(entry.refId)}</code> — is not in the vault any more,
          so it could not be printed. Renaming or moving something breaks a
          book's reference to it.</div>`};
    }
    return {title: title || entry.refId, label, where, missing: false, html: body};
  }

  /** `opts.letterhead` is the shared letterhead's HTML, set across the top
      of the cover; the Word export leaves it out and has Word draw its own,
      since a converted page cannot carry the marks. */
  async function buildHtml(book, opts) {
    opts = opts || {};
    const entries = book.entries || [];
    const chapters = [];
    for (const e of entries) chapters.push(await chapterFor(e));

    const when = new Date().toLocaleDateString(undefined,
      {year: "numeric", month: "long", day: "numeric"});

    const H = SS.PrintHouse;
    await H.load();
    const cover = `${opts.letterhead || ""}
    <section class="cover">
      ${H.titleBlock(book.brand || "Notebook", book.name || "Untitled notebook", [["Items", String(chapters.length)],
        ["Printed", when]], book.subtitle || "")}
    </section>`;

    /* A contents page, but only when there is enough to need one. */
    const contents = chapters.length > 1 ? `<section class="contents">
      ${H.section("Contents")}
      <ol class="bk-index">${chapters.map((c, i) =>
        `<li><span class="n">${i + 1}</span><span>${esc(c.title)}${c.missing ? " — <i>missing</i>" : ""}</span>`
        + `<span class="k">${esc(c.label)}</span></li>`).join("")}</ol></section>` : "";

    const body = chapters.map((c, i) => `<section class="chapter">
      ${H.titleBlock(`${c.label} \u00b7 ${i + 1} of ${chapters.length}`, c.title, [], c.where || "")}
      ${c.html}
    </section>`).join("");

    return `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(book.name)}</title><style>${H.css}${CSS}</style></head>
<body><div class="bk-doc">${cover}${contents}${body}${H.foot(book.name, "notes")}</div></body></html>`;
  }

  /* Hung off the module the interface already uses, rather than a second
     global: one name for books, two files behind it. */
  const attach = () => {
    if (!SS.Notebooks) return false;
    SS.Notebooks.buildHtml = buildHtml;
    SS.Notebooks._print = {chapterFor, sheetHtml, noteHtml, pdfHtml,
                           guideHtml, canvasHtml, journalHtml, CSS};
    return true;
  };
  if (!attach()) {
    /* books.js is loaded first, so this should never fire -- but a
       script order that quietly changed would otherwise leave Print
       doing nothing, which is worse than saying so. */
    console.warn("books-print.js loaded before books.js; printing is off");
  }
})();
