/* ==========================================================================
   SS.Notebooks — a book of anything in Notes, printed or exported as one
   document.
   ==========================================================================
   Cam: "a book feature for the Notes subsection where I can add any type
   of note from a subsection to it and then export or print. The feature
   is already present in Training."

   So this is Training's books, for Notes: a cover, an ordered contents
   list you can reorder and remove from, and one printed document at the
   end. What differs is what can go in it -- vault notes, canvases, PDFs,
   boards, sheets and guides -- and that each of those has to be RENDERED
   by whatever owns it, rather than handed to one exporter that knows
   every shape.

   A BOOK HOLDS REFERENCES, NOT COPIES:

     book  {id, name, subtitle, brand, created, updated, entries}
     entry {type: "note"|"canvas"|"pdf"|"board"|"sheet"|"guide", refId}

   Edit a note and every book containing it prints the new version, which
   is what a manual you reprint each term wants. The cost is that a
   reference can go stale -- rename a note and the book is pointing at a
   path that is not there any more. That case is not hidden: the contents
   list marks it, and the printed document prints a clearly marked gap
   rather than quietly dropping a chapter or, worse, printing a different
   one. Training made exactly the same trade for exactly the same reason.

   WHY refId IS A PATH FOR VAULT ITEMS. Notes have no ids -- they are
   files, and a file's identity is where it is. Boards and sheets have
   real ids and use them, so moving or renaming those is safe; renaming a
   note breaks the reference and the book says so. That asymmetry is the
   vault's, not this module's, and hiding it would mean maintaining a
   second identity for every file on disk.
   ========================================================================== */
(() => {
  "use strict";

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const call = (name, args, what) => SS.Store.call(name, args, what);

  const store = {
    list: () => call("notebooks_list", [], "Reading your notebooks"),
    read: (id) => call("notebooks_read", [id], "Opening a notebook"),
    write: (id, book) => call("notebooks_write", [id, book], "Saving a notebook"),
    remove: (id) => call("notebooks_delete", [id], "Deleting a notebook"),
    formats: () => call("notebooks_formats", [], "Checking what can be written"),
    exportBook: (name, html, fmt, letterhead) =>
      call("notebooks_export", [name, html, fmt, letterhead || null], "Exporting a notebook"),
  };

  /* The shared letterhead: NeuroNet left, the notebook's name centred, the
     notes mark right -- as on every printout and export in the app. */
  const LOGO = {logo: "notes.png", name: "notes"};
  const letterheadSpec = (b) => {
    const n = (b.entries || []).length;
    // the letterhead says what it is; the cover's title block names it (2026-10-05)
    return {title: "Notebook", subtitle: "", logo: LOGO.logo, name: LOGO.name, n};
  };
  async function letterheadHtml(b) {
    const spec = letterheadSpec(b);
    try {
      const h = await call("print_header", [spec.title,
        {subtitle: spec.subtitle, logo: spec.logo, name: spec.name}], "");
      return typeof h === "string" ? h : "";
    } catch (e) { return ""; }           // the notebook prints without it
  }

  /* What can go in a book, and where each kind comes from. `plural` is
     only for the wording; `source` is the real difference. */
  const TYPES = [
    {id: "note", label: "Note", from: "the vault"},
    {id: "canvas", label: "Canvas", from: "the vault"},
    {id: "pdf", label: "PDF", from: "the vault"},
    {id: "board", label: "Board", from: "Boards"},
    {id: "scrapbook", label: "Scrapbook", from: "Scrapbook"},
    {id: "sheet", label: "Sheet", from: "Cells"},
    {id: "guide", label: "Guide", from: "Guides"},
    {id: "journal", label: "Journal entry", from: "Journal"},
  ];
  const typeOf = (id) => TYPES.find((t) => t.id === id) || null;

  let books = [];          // the list, as the backend reports it
  let openId = null;       // the book being looked at
  let book = null;         // ...and its full record

  /* ------------------------------------------------------------ the list */

  async function render(host) {
    host.classList.remove("ss-main-fills");
    if (openId) {
      const got = await store.read(openId);
      if (got && got.book) { book = got.book; return showBook(host); }
      SS.shared.toast((got && got.error) || "Couldn't open that notebook.", "error");
      openId = null;
    }
    books = (await store.list()) || [];
    host.innerHTML = `
      <div class="ss-books">
        <div class="bk-head">
          <div>
            <h2 class="page-h">Notebooks</h2>
            <p class="stamp">Gather notes, canvases, PDFs, boards, sheets and
              guides into one document, then print it or export it.</p>
          </div>
          <button class="btn btn-save" id="bk-new">+ New notebook</button>
        </div>
        ${books.length
          ? `<div class="bd-list">${books.map(rowFor).join("")}</div>`
          : `<p class="bd-empty">No notebooks yet. A notebook points at things you
              already have — nothing is copied, so editing a note updates
              every notebook it is in.</p>`}
      </div>`;
    host.querySelector("#bk-new").onclick = () => newBook(host);
    host.querySelectorAll("[data-open]").forEach((b) =>
      b.onclick = () => { openId = b.dataset.open; render(host); });
    host.querySelectorAll("[data-del]").forEach((b) =>
      b.onclick = () => deleteBook(host, b.dataset.del));
  }

  function rowFor(b) {
    if (b.error) {
      return `<div class="bd-row is-broken"><div class="bd-row-main">
        <div class="bd-name">${esc(b.name)}</div>
        <div class="bd-meta">${esc(b.error)} It has been left exactly as it is.</div>
      </div></div>`;
    }
    const n = b.count || 0;
    return `<div class="bd-row">
      <div class="bd-row-main">
        <div class="bd-name">${esc(b.name)}</div>
        <div class="bd-meta">${n} item${n === 1 ? "" : "s"}${
          b.subtitle ? ` · ${esc(b.subtitle)}` : ""}${
          b.updated ? ` · ${esc(String(b.updated).slice(0, 10))}` : ""}</div>
      </div>
      <button class="btn btn-quiet" data-open="${esc(b.id)}">Open</button>
      <button class="btn btn-quiet bd-del" data-del="${esc(b.id)}">Delete</button>
    </div>`;
  }

  function idFor(name, taken) {
    const base = String(name || "book").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "book";
    let id = base, n = 2;
    while (taken.has(id)) id = `${base}-${n++}`;
    return id;
  }

  function dialog(title, body, onOk, okLabel) {
    const d = SS.shared.openDlg(title, body);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn(okLabel || "Save", "btn-save", async () => { await onOk(d.body); d.close(); });
    const first = d.body.querySelector("input");
    if (first) { first.focus(); first.select(); }
    return d;
  }

  function newBook(host) {
    dialog("New notebook", `
      <label class="dlg-label" for="bk-name">Notebook name</label>
      <input class="input" id="bk-name" value="Untitled notebook">
      <label class="dlg-label" for="bk-sub">Subtitle</label>
      <input class="input" id="bk-sub" placeholder="optional — shown under the title">
      <label class="dlg-label" for="bk-brand">Cover name</label>
      <input class="input" id="bk-brand" placeholder="optional — your name on the cover">`,
      async (body) => {
        const name = body.querySelector("#bk-name").value.trim() || "Untitled notebook";
        const id = idFor(name, new Set(books.map((b) => b.id)));
        const res = await store.write(id, {
          id, name,
          subtitle: body.querySelector("#bk-sub").value.trim(),
          brand: body.querySelector("#bk-brand").value.trim(),
          created: new Date().toISOString(), entries: [],
        });
        if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
        openId = id;
        await render(host);
      }, "Create");
  }

  function deleteBook(host, id) {
    const b = books.find((x) => x.id === id);
    dialog("Delete this notebook?",
      `<p class="stamp">“${esc((b && b.name) || id)}” goes. <b>Everything in it
        stays</b> — a notebook only points at things, it never holds a copy.</p>`,
      async () => {
        const res = await store.remove(id);
        if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
        await render(host);
      }, "Delete");
  }

  /* --------------------------------------------------------- one book */

  async function showBook(host) {
    const entries = book.entries || [];
    const resolved = await Promise.all(entries.map(resolve));
    const missing = resolved.filter((r) => !r.found).length;

    host.innerHTML = `
      <div class="ss-books">
        <div class="bk-bar">
          <button class="btn btn-quiet" id="bk-back">← Notebooks</button>
          <strong class="bk-name">${esc(book.name)}</strong>
          <div class="bk-bar-right">
            <button class="btn btn-quiet" id="bk-rename">Rename</button>
            <button class="btn btn-quiet" id="bk-print">Print</button>
            <button class="btn btn-quiet" id="bk-export">Export</button>
          </div>
        </div>

        <div class="bk-cover">
          ${book.brand ? `<div class="bk-cover-brand">${esc(book.brand)}</div>` : ""}
          <div class="bk-cover-rule"></div>
          <div class="bk-cover-title">${esc(book.name)}</div>
          ${book.subtitle ? `<div class="bk-cover-sub">${esc(book.subtitle)}</div>` : ""}
        </div>
        <p class="stamp">That is the cover page, printed first.</p>

        <h3 class="bk-h">Contents${missing
          ? ` <span class="bk-warn">${missing} missing</span>` : ""}</h3>
        ${entries.length ? `<div class="bk-items">${resolved.map((r, i) => `
          <div class="bk-item${r.found ? "" : " is-missing"}">
            <span class="bk-n">${i + 1}</span>
            <div class="bk-item-main">
              <div class="bk-item-name">${r.found ? esc(r.title)
                : `<i>Missing — this ${esc(r.typeLabel.toLowerCase())} is not
                   there any more</i>`}</div>
              <div class="bk-item-meta">${esc(r.typeLabel)}${
                r.found && r.note ? ` · ${esc(r.note)}` : ""}${
                r.found ? "" : ` · ${esc(r.ref)}`}</div>
            </div>
            <div class="bk-item-tools">
              <button class="btn btn-quiet" data-up="${i}"
                ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
              <button class="btn btn-quiet" data-down="${i}"
                ${i === entries.length - 1 ? "disabled" : ""} title="Move down">↓</button>
              <button class="btn btn-quiet bd-del" data-drop="${i}"
                title="Take out of the notebook">✕</button>
            </div>
          </div>`).join("")}</div>`
          : `<p class="bd-empty">Nothing in this notebook yet.</p>`}
        <button class="btn btn-save bk-add" id="bk-add">+ Add something</button>
      </div>`;

    host.querySelector("#bk-back").onclick = () => { openId = null; render(host); };
    host.querySelector("#bk-rename").onclick = () => renameBook(host);
    host.querySelector("#bk-add").onclick = () => addEntry(host);
    host.querySelector("#bk-print").onclick = () => printBook(host);
    host.querySelector("#bk-export").onclick = () => exportBook(host);
    host.querySelectorAll("[data-up]").forEach((b) =>
      b.onclick = () => move(host, Number(b.dataset.up), -1));
    host.querySelectorAll("[data-down]").forEach((b) =>
      b.onclick = () => move(host, Number(b.dataset.down), 1));
    host.querySelectorAll("[data-drop]").forEach((b) =>
      b.onclick = () => drop(host, Number(b.dataset.drop)));

    /* Ctrl+P prints the book, like every other page in the app. Anchored
       to the contents so the offer dies when you navigate away. */
    if (SS.Print) {
      SS.Print.offer(host.querySelector(".ss-books"), book.name,
        () => printBook(host));
    }
  }

  function renameBook(host) {
    dialog("Rename notebook", `
      <label class="dlg-label" for="bk-rn">Book name</label>
      <input class="input" id="bk-rn" value="${esc(book.name)}">
      <label class="dlg-label" for="bk-rs">Subtitle</label>
      <input class="input" id="bk-rs" value="${esc(book.subtitle || "")}">
      <label class="dlg-label" for="bk-rb">Cover name</label>
      <input class="input" id="bk-rb" value="${esc(book.brand || "")}">`,
      async (body) => {
        book.name = body.querySelector("#bk-rn").value.trim() || book.name;
        book.subtitle = body.querySelector("#bk-rs").value.trim();
        book.brand = body.querySelector("#bk-rb").value.trim();
        await save(host);
      }, "Save");
  }

  async function save(host) {
    const res = await store.write(book.id, book);
    if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
    await showBook(host);
  }

  async function move(host, i, delta) {
    const list = book.entries || [];
    const to = i + delta;
    if (to < 0 || to >= list.length) return;
    [list[i], list[to]] = [list[to], list[i]];
    await save(host);
  }

  async function drop(host, i) {
    (book.entries || []).splice(i, 1);
    await save(host);
  }

  /* ------------------------------------------------- what can be added */

  /** Everything in the vault, flat, with its kind. */
  async function vaultItems() {
    const tree = await call("notes_list_tree", [], "Reading the vault");
    const out = [];
    const walk = (nodes) => {
      for (const n of nodes || []) {
        if (n.type === "folder") walk(n.children);
        else out.push({path: n.path, name: n.name, kind: n.type});
      }
    };
    walk(Array.isArray(tree) ? tree : []);
    return out;
  }

  async function choicesFor(type) {
    if (type === "note" || type === "canvas" || type === "pdf") {
      const items = await vaultItems();
      return items.filter((i) => i.kind === type)
        .map((i) => ({value: i.path, label: i.name, sub: i.path}));
    }
    if (type === "board") {
      const list = await call("boards_list", [], "Reading your boards");
      return (list || []).filter((b) => !b.error)
        .map((b) => ({value: b.id, label: b.name, sub: `${b.pages || 1} page${
          (b.pages || 1) === 1 ? "" : "s"}`}));
    }
    if (type === "scrapbook") {
      const list = await call("scrapbooks_list", [], "Reading your scrapbooks");
      return (list || []).filter((b) => !b.error)
        .map((b) => ({value: b.id, label: b.name, sub: `${b.pages || 1} page${
          (b.pages || 1) === 1 ? "" : "s"}`}));
    }
    if (type === "sheet") {
      const list = await call("cells_list", [], "Reading your sheets");
      return (list || []).filter((s) => !s.error)
        .map((s) => ({value: s.id, label: s.name, sub: `${s.rows}×${s.cols}`}));
    }
    if (type === "guide") {
      const guides = (SS.Guides && SS.Guides._test && SS.Guides._test.GUIDES) || [];
      return guides.map((g) => ({value: g.id, label: g.title, sub: g.blurb}));
    }
    if (type === "journal") {
      const list = await call("journal_list", [], "Reading your journal");
      return (Array.isArray(list) ? list : [])
        .map((e) => ({value: e.id, label: e.title || e.date, sub: e.date}));
    }
    return [];
  }

  function addEntry(host) {
    const d = SS.shared.openDlg("Add to this notebook", `
      <p class="stamp">What kind of thing?</p>
      <div class="bk-kinds">${TYPES.map((t) => `
        <button class="btn btn-quiet bk-kind" data-kind="${t.id}">
          <b>${esc(t.label)}</b><span>from ${esc(t.from)}</span></button>`).join("")}</div>`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.body.querySelectorAll("[data-kind]").forEach((b) =>
      b.onclick = async () => {
        const kind = b.dataset.kind;
        d.close();
        const items = await choicesFor(kind);
        if (!items.length) {
          SS.shared.toast(`There are no ${typeOf(kind).label.toLowerCase()}s to add yet.`);
          return;
        }
        pick(host, kind, items);
      });
  }

  function pick(host, kind, items) {
    const t = typeOf(kind);
    const d = SS.shared.openDlg(`Which ${t.label.toLowerCase()}?`, `
      <input class="input bk-filter" id="bk-filter" type="search"
             placeholder="Filter" autocomplete="off">
      <div class="bk-picks" id="bk-picks"></div>`);
    d.btn("Cancel", "btn-quiet", d.close);
    const box = d.body.querySelector("#bk-picks");
    const draw = (q) => {
      const hits = items.filter((i) => !q
        || i.label.toLowerCase().includes(q)
        || String(i.sub || "").toLowerCase().includes(q));
      box.innerHTML = hits.length ? hits.map((i) => `
        <button class="btn btn-quiet bk-pick" data-v="${esc(i.value)}">
          <b>${esc(i.label)}</b>${i.sub ? `<span>${esc(i.sub)}</span>` : ""}
        </button>`).join("") : `<p class="stamp">Nothing matches that.</p>`;
      box.querySelectorAll("[data-v]").forEach((b) =>
        b.onclick = async () => {
          book.entries = book.entries || [];
          book.entries.push({type: kind, refId: b.dataset.v});
          d.close();
          await save(host);
          SS.shared.toast(`${t.label} added.`);
        });
    };
    d.body.querySelector("#bk-filter")
      .addEventListener("input", (e) => draw(e.target.value.trim().toLowerCase()));
    draw("");
  }

  /* ------------------------------------------ resolving an entry, today */

  /** What an entry points at right now: its title, and whether it is
      still there. Deliberately cheap -- this runs for the contents list,
      which must not read every note in the book to draw itself. */
  async function resolve(entry) {
    const t = typeOf(entry.type);
    const base = {ref: entry.refId, typeLabel: t ? t.label : entry.type,
                  type: entry.type, found: false, title: "", note: ""};
    try {
      if (["note", "canvas", "pdf"].includes(entry.type)) {
        const items = await vaultItems();
        const hit = items.find((i) => i.path === entry.refId && i.kind === entry.type);
        if (hit) Object.assign(base, {found: true, title: hit.name, note: hit.path});
      } else if (entry.type === "board") {
        const list = await call("boards_list", [], "Reading your boards");
        const hit = (list || []).find((b) => b.id === entry.refId);
        if (hit) Object.assign(base, {found: true, title: hit.name});
      } else if (entry.type === "scrapbook") {
        const list = await call("scrapbooks_list", [], "Reading your scrapbooks");
        const hit = (list || []).find((b) => b.id === entry.refId);
        if (hit) Object.assign(base, {found: true, title: hit.name});
      } else if (entry.type === "sheet") {
        const list = await call("cells_list", [], "Reading your sheets");
        const hit = (list || []).find((s) => s.id === entry.refId);
        if (hit) Object.assign(base, {found: true, title: hit.name,
                                      note: `${hit.rows}×${hit.cols}`});
      } else if (entry.type === "guide") {
        const guides = (SS.Guides && SS.Guides._test && SS.Guides._test.GUIDES) || [];
        const hit = guides.find((g) => g.id === entry.refId);
        if (hit) Object.assign(base, {found: true, title: hit.title});
      } else if (entry.type === "journal") {
        const list = await call("journal_list", [], "Reading your journal");
        const hit = (Array.isArray(list) ? list : []).find((e) => e.id === entry.refId);
        if (hit) Object.assign(base, {found: true, title: hit.title || hit.date, note: hit.date});
      }
    } catch (e) { /* a lookup that fails is a missing entry, not a crash */ }
    return base;
  }

  SS.Notebooks = {
    VIEWS: ["books:list"],
    PREFIX: "books:",
    /** A notebook's printed document by id, with its letterhead -- for
        NeuroNet's reader (the desktop Bookshelf, 2026-10-02). */
    async document(id) {
      const b = await call("notebooks_read", [id], "Opening a notebook");
      if (!b || b.error || !SS.Notebooks.buildHtml) return null;
      const html = await SS.Notebooks.buildHtml(b, {letterhead: await letterheadHtml(b)});
      return html ? {title: b.name, html, printKind: "note-book"} : null;
    },
    async mount(host) {
      host.style.display = "";
      await render(host);
    },
    _test: {TYPES, typeOf, idFor, resolve},
  };

  /* buildHtml and the two export paths live in books-print.js, which this
     file calls into -- kept apart because one is the interface and the
     other is a document builder, and they are read for different reasons. */
  async function printBook(host) {
    const html = await SS.Notebooks.buildHtml(book, {letterhead: await letterheadHtml(book)});
    if (!html) return;
    const res = await call("open_print_document", [html, "note-book"], "Printing a book");
    if (res && res.error) SS.shared.toast(res.error, "error");
  }

  async function exportBook(host) {
    const formats = (await store.formats()) || {html: true};
    const d = SS.shared.openDlg("Export this notebook", `
      <p class="stamp">HTML opens in a browser and in Word, and needs nothing
        installed.${formats.docx ? "" : ` <b>.docx isn't available on this
        machine</b> — it needs the python-docx library.`}</p>`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("HTML", "btn-quiet", async () => { d.close(); await writeOut("html"); });
    if (formats.docx) {
      d.btn("Word (.docx)", "btn-save", async () => { d.close(); await writeOut("docx"); });
    }
  }

  async function writeOut(fmt) {
    /* HTML carries the letterhead as the printout does; Word draws its own
       (see notebooks_export), because a converted page loses the marks. */
    const html = fmt === "docx"
      ? await SS.Notebooks.buildHtml(book)
      : await SS.Notebooks.buildHtml(book, {letterhead: await letterheadHtml(book)});
    if (!html) return;
    const s = letterheadSpec(book);
    const res = await store.exportBook(book.name, html, fmt,
      fmt === "docx" ? {title: s.title, subtitle: s.subtitle, right_logo: s.logo, right_name: s.name} : null);
    if (!res || res.error) {
      SS.shared.toast((res && res.error) || "That didn't work.", "error");
      return;
    }
    SS.shared.toast(`Saved to your desktop as .${fmt}.`);
  }
})();
