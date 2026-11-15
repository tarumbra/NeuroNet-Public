/* ==========================================================================
   Scrapbook — in Creative, beside Boards.

   Cam: "Scrapbook, which should have the same toolbar as boards, but also
   contain a collapseable scrapbook materials (this will have designed
   coloured tapes, frames, stickers (Which i can make from any photo). Any
   other common scrapbook materials you suggest) The paper will be
   selectable from different colours and will allow each page to have a
   different type of paper.) Furthermore it will have a cover which the
   material can be changed from wood, fur, colour, metal, ect. This will be
   a major release and created to be shipped in 1.0.7."

   The SAME editor as Boards (SS.BoardEditor), opened with the Scrapbook's
   extras: the materials panel on the right, Paper and Cover and Turn on the
   second bar. So every Boards tool -- text, photos, shapes, pencil, layers,
   pages, undo, snapshots, Export PNG -- is here exactly as it is there, and
   a fix to one is a fix to both.

   The materials are drawn by ui/scrapbook/materials.js (SS.ScrapArt). A
   scrapbook is one file in neuronet_data/notes/scrapbooks/, like a board;
   the sticker book is neuronet_data/notes/scrapbooks/stickers/.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const A = () => SS.ScrapArt;

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  /* 12 x 12 in is the classic scrapbook page; 8½ x 11 the album size. */
  const SIZES = [{key: "square", name: "12 × 12 square", w: 1500, h: 1500},
                 {key: "letter", name: "8½ × 11 portrait", w: 1275, h: 1650},
                 {key: "letter-land", name: "11 × 8½ landscape", w: 1650, h: 1275}];

  /** A page's real size in mm, for printing: 12 in across a square book,
      11 in along the long side of a letter one. */
  function pageMM(book) {
    const w = book.w || 1500, h = book.h || 1500;
    const k = w === h ? 304.8 / w : 279.4 / Math.max(w, h);
    return [w * k, h * k];
  }

  /** Cam (2026-10-03): "have ability to print it landscape as well for both
      paper tool and scrap book". The Paper creator's print dialog: sheet,
      which way up, shrink to fit (a 12 x 12 page is bigger than A4). */
  function printBook(ed) {
    ed.flush();
    const [wmm, hmm] = pageMM(ed.board);
    SS.Paper.printDialog({title: "Print the scrapbook", name: ed.board.name || "Scrapbook", book: ed.board,
                          pageNow: ed.page, wmm, hmm, kind: "scrapbook", sheet: "a4", fit: true});
  }

  const store = {
    async list() { return (await SS.Store.call("scrapbooks_list", [], "Your scrapbooks")) || []; },
    async read(id) { return SS.Store.call("scrapbooks_read", [id], "Opening a scrapbook"); },
    async write(id, book) { return SS.Store.call("scrapbooks_write", [id, book], "Saving a scrapbook"); },
    async remove(id) { return SS.Store.call("scrapbooks_delete", [id], "Deleting a scrapbook"); },
    async stickers() { return (await SS.Store.call("scrapbook_stickers", [], "Your sticker book")) || {stickers: []}; },
    async addSticker(name, url) { return SS.Store.call("scrapbook_sticker_add", [name, url], "Saving a sticker"); },
    async dropSticker(id) { return SS.Store.call("scrapbook_sticker_delete", [id], "Removing a sticker"); },
  };

  /** A file name from the name typed, as Boards makes one (letters, digits,
      spaces, - and _), kept unique so two books never share a file. */
  function idFor(name, taken) {
    const base = String(name || "Scrapbook").replace(/[^A-Za-z0-9 _-]/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, 60) || "Scrapbook";
    let id = base, n = 2;
    while (taken.has(id)) { id = `${base} ${n}`; n += 1; }
    return id;
  }

  /** A new scrapbook. Its own function (and tested) so the shape a book is
      made in is written down once. */
  function bookFrom({name, size, paper, paperColour, cover}) {
    const s = SIZES.find((x) => x.key === size) || SIZES[0];
    return {
      kind: "scrapbook", name, w: s.w, h: s.h,
      paper: paper || "cardstock", paperColour: paperColour || "",
      cover: {material: "wood", colour: "", title: name, ...(cover || {})},
      pages: [{items: [], paper: paper || "cardstock", paperColour: paperColour || ""}],
      created: new Date().toISOString(),
    };
  }

  let books = [];

  /* ------------------------------------------------------------ the shelf */

  async function render(host) {
    books = await store.list();
    host.innerHTML = `
      <div class="bd-head sb-head">
        <h2 class="page-h">Scrapbook</h2>
        <p class="stamp">Pages of photos, tape, stickers and words — each page on
          its own paper, each book in its own cover.</p>
        <div class="bd-actions">
          <button class="btn btn-primary" id="sb-new">+ New scrapbook</button>
        </div>
      </div>
      ${books.length ? `<div class="sb-shelf">${books.map(tile).join("")}</div>`
        : `<p class="bd-empty">No scrapbooks yet. Make one and its cover lands here.</p>`}`;
    host.querySelector("#sb-new").onclick = () => newDialog(host);
    host.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => openBook(host, b.dataset.open));
    host.querySelectorAll("[data-cover]").forEach((b) => b.onclick = () => coverFromShelf(host, b.dataset.cover));
    host.querySelectorAll("[data-rename]").forEach((b) => b.onclick = () => renameBook(host, b.dataset.rename));
    host.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => deleteBook(host, b.dataset.del));
  }

  function tile(b) {
    if (b.error) {
      return `<div class="sb-tile is-broken"><div class="sb-cover sb-cover-broken"></div>
        <div class="bd-name">${esc(b.name)}</div>
        <div class="bd-meta">${esc(b.error)} It has been left exactly as it is.</div></div>`;
    }
    const when = (b.updated || "").slice(0, 10);
    const ratio = (b.h || 1500) / (b.w || 1500);
    return `<div class="sb-tile">
      <button class="sb-cover" data-open="${esc(b.id)}" title="Open “${esc(b.name)}”">${
        A().coverSVG(b.cover || {}, 200, Math.round(200 * ratio))}</button>
      <div class="bd-name">${esc(b.name)}</div>
      <div class="bd-meta">${b.pages} page${b.pages === 1 ? "" : "s"}${when ? ` · ${esc(when)}` : ""}</div>
      <div class="sb-tile-btns">
        <button class="btn btn-quiet" data-cover="${esc(b.id)}" title="Change the cover">Cover</button>
        <button class="btn btn-quiet" data-rename="${esc(b.id)}">Rename</button>
        <button class="btn btn-quiet bd-del" data-del="${esc(b.id)}">Delete</button>
      </div>
    </div>`;
  }

  /** Tick-one-of buttons, as Boards' dialogs use. */
  function wireSegs(root) {
    root.querySelectorAll(".seg").forEach((seg) =>
      seg.addEventListener("click", (e) => {
        const b = e.target.closest(".seg-btn");
        if (!b) return;
        seg.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        seg.dispatchEvent(new CustomEvent("pick", {detail: b}));
      }));
  }
  const seg = (id, list, on, attr) => `<div class="seg sb-seg" id="${id}">${list.map(([k, name]) =>
    `<button class="seg-btn ${k === on ? "on" : ""}" data-${attr}="${esc(k)}">${esc(name)}</button>`).join("")}</div>`;
  const swatches = (id, list, on) => `<div class="sb-swatches" id="${id}">${list.map((c) =>
    `<button class="bd-sw ${c === on ? "on" : ""}" data-col="${c}" style="background:${c}" title="${c}"></button>`).join("")}
    <label class="bd-sw bd-sw-custom" title="Any colour"><input type="color" data-custom value="${esc(on && /^#[0-9a-f]{6}$/i.test(on) ? on : "#888888")}"></label></div>`;
  function wireSwatches(root, sel, onPick) {
    const box = root.querySelector(sel);
    const mark = (c) => box.querySelectorAll("[data-col]").forEach((b) => b.classList.toggle("on", b.dataset.col === c));
    box.querySelectorAll("[data-col]").forEach((b) => b.onclick = () => { mark(b.dataset.col); onPick(b.dataset.col); });
    box.querySelector("[data-custom]").oninput = (e) => { mark(""); onPick(e.target.value); };
  }

  function newDialog(host) {
    const st = {cover: {material: "wood", colour: ""}, paper: "cardstock", paperColour: "", size: "square"};
    const d = SS.shared.openDlg("New scrapbook", `
      <label class="dlg-label" for="sb-name">Name</label>
      <input class="input" id="sb-name" value="My scrapbook">
      <div class="dlg-label">Page size</div>
      ${seg("sb-size", SIZES.map((s) => [s.key, s.name]), "square", "size")}
      <div class="dlg-label">Cover</div>
      ${seg("sb-mat", A().COVERS.map(([k, n]) => [k, n]), "wood", "mat")}
      <div class="dlg-label">First page's paper</div>
      ${seg("sb-paper", A().PAPERS, "cardstock", "paper")}
      <div class="sb-new-preview" id="sb-new-preview"></div>
      <p class="stamp">The cover, and every page's paper, can be changed at any time.</p>`, true);
    const body = d.body;
    wireSegs(body);
    const preview = () => {
      const name = body.querySelector("#sb-name").value.trim() || "My scrapbook";
      const s = SIZES.find((x) => x.key === st.size);
      const pw = 150, ph = Math.round(pw * s.h / s.w);
      body.querySelector("#sb-new-preview").innerHTML =
        A().coverSVG({...st.cover, title: name}, pw, ph)
        + `<svg viewBox="0 0 ${s.w} ${s.h}" width="${pw}" height="${ph}" class="sb-paper-pv">${
          A().paperSVG(st.paper, st.paperColour, s.w, s.h)}</svg>`;
    };
    body.querySelector("#sb-size").addEventListener("pick", (e) => { st.size = e.detail.dataset.size; preview(); });
    body.querySelector("#sb-mat").addEventListener("pick", (e) => { st.cover.material = e.detail.dataset.mat; preview(); });
    body.querySelector("#sb-paper").addEventListener("pick", (e) => { st.paper = e.detail.dataset.paper; preview(); });
    body.querySelector("#sb-name").addEventListener("input", preview);
    preview();
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Create", "btn-save", async () => {
      const name = body.querySelector("#sb-name").value.trim() || "My scrapbook";
      const id = idFor(name, new Set(books.map((b) => b.id)));
      const res = await store.write(id, bookFrom({name, ...st}));
      if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
      d.close();
      await render(host);
      openBook(host, id);
    });
    const first = body.querySelector("#sb-name");
    first.focus(); first.select();
  }

  async function renameBook(host, id) {
    const got = await store.read(id);
    if (!got || got.error) { SS.shared.toast((got && got.error) || "Couldn't open that scrapbook.", "error"); return; }
    const d = SS.shared.openDlg("Rename scrapbook", `<label class="dlg-label" for="sb-rename">Name</label>
      <input class="input" id="sb-rename" value="${esc(got.book.name || "")}">
      <label class="bd-pick"><input type="checkbox" id="sb-retitle" checked><span>Put the new name on the cover too</span></label>`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Rename", "btn-save", async () => {
      const name = d.body.querySelector("#sb-rename").value.trim();
      if (!name) return;
      got.book.name = name;                  // the file keeps its id
      if (d.body.querySelector("#sb-retitle").checked) got.book.cover = {...(got.book.cover || {}), title: name};
      await store.write(id, got.book);
      d.close();
      await render(host);
    });
  }

  async function deleteBook(host, id) {
    const b = books.find((x) => x.id === id);
    const yes = await SS.shared.confirm({
      title: "Delete this scrapbook?",
      body: `“${(b && b.name) || id}” and every page in it will be gone. This one cannot be undone. `
        + "Stickers in your sticker book stay.",
      yes: "Delete"});
    if (!yes) return;
    const res = await store.remove(id);
    if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
    await render(host);
  }

  async function coverFromShelf(host, id) {
    const got = await store.read(id);
    if (!got || got.error) { SS.shared.toast((got && got.error) || "Couldn't open that scrapbook.", "error"); return; }
    coverDialog(got.book, async () => { await store.write(id, got.book); await render(host); });
  }

  /* ------------------------------------------------------------ the cover */

  /** Cam: "a cover which the material can be changed from wood, fur,
      colour, metal, ect." Material, colour and the title on its label. */
  function coverDialog(book, onSave) {
    const cv = {material: "wood", colour: "", title: book.name || "", ...(book.cover || {})};
    const ratio = (book.h || 1500) / (book.w || 1500);
    const d = SS.shared.openDlg("Cover", `
      <div class="sb-cover-ed">
        <div class="sb-cover-pv" id="sb-cv-pv"></div>
        <div class="sb-cover-opts">
          <div class="dlg-label">Material</div>
          ${seg("sb-cv-mat", A().COVERS.map(([k, n]) => [k, n]), cv.material, "mat")}
          <div class="dlg-label">Colour</div>
          ${swatches("sb-cv-col", A().COVER_COLOURS, cv.colour)}
          <button class="btn btn-quiet sb-small" id="sb-cv-natural">The material's own colour</button>
          <label class="dlg-label" for="sb-cv-title">Title on the cover</label>
          <input class="input" id="sb-cv-title" value="${esc(cv.title)}">
        </div>
      </div>`, true);
    const body = d.body;
    wireSegs(body);
    const draw = () => { body.querySelector("#sb-cv-pv").innerHTML = A().coverSVG(cv, 260, Math.round(260 * ratio)); };
    body.querySelector("#sb-cv-mat").addEventListener("pick", (e) => { cv.material = e.detail.dataset.mat; draw(); });
    wireSwatches(body, "#sb-cv-col", (c) => { cv.colour = c; draw(); });
    body.querySelector("#sb-cv-natural").onclick = () => {
      cv.colour = "";
      body.querySelectorAll("#sb-cv-col [data-col]").forEach((b) => b.classList.remove("on"));
      draw();
    };
    body.querySelector("#sb-cv-title").oninput = (e) => { cv.title = e.target.value; draw(); };
    draw();
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save cover", "btn-save", async () => {
      book.cover = {material: cv.material, colour: cv.colour, title: cv.title.trim()};
      d.close();
      await onSave();
    });
  }

  /* ------------------------------------------------------------ the paper */

  /** Cam: "The paper will be selectable from different colours and will
      allow each page to have a different type of paper." The page on
      screen, or every page at once. */
  function paperDialog(ed) {
    const book = ed.board, page = book.pages[ed.page];
    const st = {paper: page.paper || book.paper || "cardstock", colour: page.paperColour || ""};
    const d = SS.shared.openDlg(`Paper — page ${ed.page + 1}`, `
      <div class="sb-cover-ed">
        <div class="sb-cover-pv" id="sb-pp-pv"></div>
        <div class="sb-cover-opts">
          <div class="dlg-label">Type</div>
          ${seg("sb-pp-kind", A().PAPERS, st.paper, "paper")}
          <div class="dlg-label">Colour</div>
          ${swatches("sb-pp-col", A().PAPER_COLOURS, st.colour)}
          <button class="btn btn-quiet sb-small" id="sb-pp-natural">The paper's own colour</button>
          <label class="bd-pick"><input type="checkbox" id="sb-pp-all"><span>Use it on every page</span></label>
        </div>
      </div>`, true);
    const body = d.body;
    wireSegs(body);
    const draw = () => {
      const w = book.w || 1500, h = book.h || 1500, pw = 240;
      body.querySelector("#sb-pp-pv").innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${pw}" height="${Math.round(pw * h / w)}">${
        A().paperSVG(st.paper, st.colour, w, h)}</svg>`;
    };
    body.querySelector("#sb-pp-kind").addEventListener("pick", (e) => { st.paper = e.detail.dataset.paper; draw(); });
    wireSwatches(body, "#sb-pp-col", (c) => { st.colour = c; draw(); });
    body.querySelector("#sb-pp-natural").onclick = () => {
      st.colour = "";
      body.querySelectorAll("#sb-pp-col [data-col]").forEach((b) => b.classList.remove("on"));
      draw();
    };
    draw();
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Use this paper", "btn-save", () => {
      setPaper(ed, st.paper, st.colour, body.querySelector("#sb-pp-all").checked);
      d.close();
    });
  }

  /** Paper on the page on screen (or every page). Undoable like any edit,
      since the paper lives in the page. New pages take it too. */
  function setPaper(ed, paper, colour, everyPage) {
    ed.push();
    const pages = everyPage ? ed.board.pages : [ed.board.pages[ed.page]];
    for (const p of pages) { p.paper = paper; p.paperColour = colour || ""; }
    ed.board.paper = paper;
    ed.board.paperColour = colour || "";
    ed.draw();
    ed.changed(true);
  }

  /* ----------------------------------------------------- the materials panel */

  /* Where the panel's open/closed state is kept. The Scrapbook's own key
     stays as it was; Boards, Covers and the asset maker keep their own
     (makeKit's key). */
  const PANEL_KEY = "nn:scrapbook:panel";
  const panelState = (key) => {
    try { return JSON.parse(window.localStorage.getItem(key || PANEL_KEY) || "null") || null; } catch (e) { return null; }
  };
  const savePanel = (s, key) => { try { window.localStorage.setItem(key || PANEL_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } };

  /** A small picture of one material, for its button. */
  function sample(kind, style) {
    const it = A().make(kind, style);
    it.id = `pv-${kind}-${style}`;
    it.x = 0; it.y = 0; it.rot = 0;
    if (kind === "frame") it.src = "";
    const pad = 6;
    return `<svg viewBox="${-pad} ${-pad} ${it.w + pad * 2} ${it.h + pad * 2}" aria-hidden="true">${A().itemSVG(it)
      .replace(/Double-click for a photo/, "")}</svg>`;
  }

  const SECTIONS = [
    ["tape", "Tape", () => A().TAPES],
    ["frame", "Frames", () => A().FRAMES],
    ["sticker", "Stickers", null],
    ["emb", "Embellishments", () => A().EMBS],
    ["word", "Words", () => A().WORDS],
  ];

  function panelHTML(key, defaults) {
    const st = panelState(key) || {...(defaults || {})};
    const groups = SECTIONS.map(([kind, label, list]) => `
      <details class="sb-group" data-group="${kind}" ${st[kind] === false ? "" : "open"}>
        <summary>${esc(label)}</summary>
        ${kind === "sticker"
          ? `<button class="btn btn-quiet sb-small sb-make" id="sb-make">+ Make a sticker from a photo</button>
             <div class="sb-mats-grid" id="sb-stickers"><p class="sb-note">Loading your sticker book…</p></div>`
          : `<div class="sb-mats-grid">${list().map((m) => `
              <button class="sb-mat" draggable="true" data-mat="${kind}:${esc(m[0])}" title="${esc(m[1])}">
                ${sample(kind, m[0])}<span>${esc(m[1])}</span></button>`).join("")}</div>`}
      </details>`).join("");
    const photos = `
      <details class="sb-group" data-group="photo" ${st.photo === false ? "" : "open"}>
        <summary>Photos</summary>
        <input class="input sb-photo-q" id="sb-photo-q" type="search" autocomplete="off"
               placeholder="Search your photos…" aria-label="Search your photos">
        <div class="sb-mats-grid sb-photos" id="sb-photos"></div>
        <p class="sb-note" id="sb-photo-note"></p>
      </details>`;
    /* Cam (2026-10-03): assets "can then be used in projects straight from
       the app" -- the built-in clip art and everything in Assets, by category. */
    const cats = (SS.AssetStore && SS.AssetStore.CATEGORIES) || [];
    const assets = `
      <details class="sb-group" data-group="assets" ${st.assets === false ? "" : "open"}>
        <summary>Assets &amp; clip art</summary>
        <div class="sb-asset-filter">
          <select class="input" id="sb-asset-cat" aria-label="Which assets">
            <option value="">Everything</option>
            <option value="builtin">Built-in clip art</option>
            ${cats.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join("")}
          </select>
          <input class="input" id="sb-asset-q" type="search" autocomplete="off" placeholder="Search…" aria-label="Search the assets">
        </div>
        <div class="sb-mats-grid" id="sb-assets"></div>
        <p class="sb-note" id="sb-asset-note"></p>
      </details>`;
    return `<aside class="sb-mats ${st.collapsed ? "is-collapsed" : ""}" aria-label="Scrapbook materials">
      <button class="sb-mats-toggle" id="sb-mats-toggle" title="Show or hide the materials">${st.collapsed ? "‹" : "›"}</button>
      <div class="sb-mats-body">
        <div class="sb-mats-head">Materials</div>
        <p class="sb-note">Click one to put it on the page, or drag it where you want it.
          The colour palette recolours what's chosen.</p>
        ${photos}${assets}${groups}
      </div>
    </aside>`;
  }

  /* ------------------------------------------------------ assets in the panel */

  async function drawAssets(ed) {
    const grid = ed.host.querySelector("#sb-assets"), note = ed.host.querySelector("#sb-asset-note");
    if (!grid) return;
    const cat = ed.host.querySelector("#sb-asset-cat").value;
    const q = ed.host.querySelector("#sb-asset-q").value.trim().toLowerCase();
    const hit = (name, group) => !q || String(name).toLowerCase().includes(q) || String(group || "").toLowerCase().includes(q);
    const clip = (!cat || cat === "builtin" || cat === "clipart") && SS.ClipArt
      ? SS.ClipArt.LIST.filter((a) => hit(a[1], a[2])) : [];
    let mine = [];
    if (cat !== "builtin" && SS.AssetStore) {
      mine = (await SS.AssetStore.list()).filter((a) => (!cat || a.cat === cat) && hit(a.name, a.cat));
    }
    if (!ed.host.contains(grid)) return;
    grid.innerHTML = mine.map((a) => `
        <button class="sb-mat sb-asset" draggable="true" data-asset="${esc(a.id)}" title="${esc(a.name)}">
          <span class="sb-photo-th"></span><span>${esc(a.name)}</span></button>`).join("")
      + clip.map((a) => `
        <button class="sb-mat" draggable="true" data-mat="clip:${esc(a[0])}" title="${esc(a[1])} (built in)">
          ${sample("clip", a[0])}<span>${esc(a[1])}</span></button>`).join("");
    note.textContent = mine.length + clip.length ? ""
      : cat && cat !== "builtin" ? "Nothing in this category yet — add some in Creative → Assets." : "Nothing matches that.";
    grid.querySelectorAll("[data-mat]").forEach((b) => {
      b.onclick = () => placeMaterial(ed, b.dataset.mat);
      b.ondragstart = (e) => { if (e.dataTransfer) e.dataTransfer.setData("text/plain", "nn-mat:" + b.dataset.mat); };
    });
    grid.querySelectorAll("[data-asset]").forEach((b) => {
      SS.AssetStore.thumb(b.dataset.asset).then((url) => {
        const th = b.querySelector(".sb-photo-th");
        if (url && th) th.style.backgroundImage = `url("${url}")`;
      }).catch(() => {});
      b.onclick = () => placeAsset(ed, b.dataset.asset);
      b.ondragstart = (e) => { if (e.dataTransfer) e.dataTransfer.setData("text/plain", "nn-asset:" + b.dataset.asset); };
    });
  }

  /** An asset onto the page -- a copy, as a sticker is. A background fills
      the page and goes to the back; anything else comes in at a handy size. */
  async function placeAsset(ed, id, at) {
    const got = await SS.AssetStore.data(id);
    if (!got || got.error) { SS.shared.toast((got && got.error) || "That asset couldn't be loaded.", "error"); return null; }
    const meta = (await SS.AssetStore.list()).find((a) => a.id === id) || {};
    let src = got.dataUrl;
    let w = got.w || meta.w || 0, h = got.h || meta.h || 0;
    if (!w || !h) [w, h] = await naturalSize(src);
    /* a huge bought picture is kept on the page at a size that still saves
       quickly -- PNGs stay PNG, so see-through clip art stays see-through */
    if (!/^data:image\/svg/.test(src) && Math.max(w, h) > 2400) {
      src = await A().shrink(src, 2400, /^data:image\/jpeg/.test(src) ? "image/jpeg" : "image/png");
      const k = 2400 / Math.max(w, h);
      w = Math.round(w * k); h = Math.round(h * k);
    }
    const b = ed.board;
    if (meta.cat === "backgrounds") {
      const it = ed.place({k: "asset", src, name: got.name, asset: id, fit: "cover",
                           w: b.w || 1600, h: b.h || 1000}, [(b.w || 1600) / 2, (b.h || 1000) / 2]);
      ed.layer("back");
      return it;
    }
    const k = Math.min(1, 300 / Math.max(w || 300, h || 300));
    return ed.place({k: "asset", src, name: got.name, asset: id,
                     w: Math.round((w || 300) * k), h: Math.round((h || 300) * k)}, at);
  }

  function naturalSize(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve([img.naturalWidth || 300, img.naturalHeight || 300]);
      img.onerror = () => resolve([300, 300]);
      img.src = url;
    });
  }

  /* ------------------------------------------------------- the photo browser

     Cam (2026-10-02): "have the in app photo browser within the scrap book
     feature, then i can search and drag and drop onto a scrapbook, and
     dragging onto a frame will add that photo". Your newest photos until you
     search; click one to put it on the page (or into the frame that's
     chosen), or drag it -- onto a frame, it fills the frame. */
  const RECENT = 24;
  function photoList(q) {
    const sh = SS.shared;
    if (q) return sh.photoSearch(q);
    const all = (sh.data && sh.data.photos) || [];
    return all.slice(-RECENT).reverse();
  }

  function drawPhotos(ed, q) {
    const grid = ed.host.querySelector("#sb-photos"), note = ed.host.querySelector("#sb-photo-note");
    if (!grid) return;
    const list = photoList(q);
    const all = ((SS.shared.data && SS.shared.data.photos) || []).length;
    note.textContent = !all ? "No photos yet. Add some in Photos and they show up here."
      : q ? (list.length ? `${list.length} match${list.length === 1 ? "" : "es"}.` : "Nothing matches that.")
      : "Your newest photos. Click one to add it (or to fill the chosen frame), or drag it onto a frame. Right-click a photo on the page to move it in its frame.";
    grid.innerHTML = list.map((p) => `
      <button class="sb-mat sb-photo" draggable="true" data-photo="${esc(p.storedName)}"
              title="${esc(p.caption || p.originalName || "Photo")}"><span class="sb-photo-th"></span></button>`).join("");
    grid.querySelectorAll("[data-photo]").forEach((b) => {
      SS.shared.thumb(b.dataset.photo).then((url) => {
        const th = b.querySelector(".sb-photo-th");
        if (url && th) th.style.backgroundImage = `url("${url}")`;
      }).catch(() => {});
      b.onclick = () => photoClicked(ed, b.dataset.photo);
      b.ondragstart = (e) => { if (e.dataTransfer) e.dataTransfer.setData("text/plain", "nn-photo:" + b.dataset.photo); };
    });
  }

  /** The chosen frame (or photo) takes it; nothing chosen, it goes on the page. */
  function photoClicked(ed, stored) {
    const chosen = ed.sel.size === 1 ? ed.items().find((i) => ed.sel.has(i.id)) : null;
    if (chosen && (chosen.k === "frame" || chosen.k === "photo")) return ed.usePhoto(chosen, stored);
    return ed.addPhoto(stored);
  }

  /** Dropped on the page: onto a frame or photo, it fills it; else a new photo there. */
  function photoDropped(ed, stored, x, y) {
    const under = ed.itemAt(x, y);
    if (under && (under.k === "frame" || under.k === "photo")) {
      ed.sel = new Set([under.id]);
      return ed.usePhoto(under, stored);
    }
    return ed.addPhoto(stored, [x, y]);
  }

  async function drawStickers(ed) {
    const box = ed.host.querySelector("#sb-stickers");
    if (!box) return;
    const got = await store.stickers();
    const list = (got && got.stickers) || [];
    ed._stickers = list;
    box.innerHTML = list.length ? list.map((s) => `
      <div class="sb-mat sb-sticker" draggable="true" data-sticker="${esc(s.id)}" title="${esc(s.name)}">
        <img src="${esc(s.dataUrl)}" alt=""><span>${esc(s.name)}</span>
        <button class="sb-x" data-unsticker="${esc(s.id)}" title="Take it out of the sticker book">×</button>
      </div>`).join("")
      : `<p class="sb-note">Your sticker book is empty — make one from any photo.</p>`;
    box.querySelectorAll("[data-sticker]").forEach((el) => {
      el.onclick = (e) => {
        if (e.target.closest("[data-unsticker]")) return;
        placeSticker(ed, el.dataset.sticker);
      };
      el.ondragstart = (e) => { if (e.dataTransfer) e.dataTransfer.setData("text/plain", "nn-sticker:" + el.dataset.sticker); };
    });
    box.querySelectorAll("[data-unsticker]").forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const s = list.find((x) => x.id === b.dataset.unsticker);
      const yes = await SS.shared.confirm({title: "Take this sticker out of the book?",
        body: `“${(s && s.name) || "This sticker"}” leaves the sticker book. Any already on a page stay there.`,
        yes: "Take it out"});
      if (!yes) return;
      const res = await store.dropSticker(b.dataset.unsticker);
      if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
      drawStickers(ed);
    });
  }

  /** A sticker from the book, onto the page -- a copy, so the page keeps it
      even if it is later taken out of the book. */
  function placeSticker(ed, id, at) {
    const s = (ed._stickers || []).find((x) => x.id === id);
    if (!s) return null;
    const k = Math.min(1, 260 / Math.max(s.w || 260, s.h || 260));
    return ed.place({k: "sticker", src: s.dataUrl, name: s.name,
                     w: Math.round((s.w || 260) * k), h: Math.round((s.h || 260) * k)}, at);
  }

  function placeMaterial(ed, key, at) {
    const [kind, style] = String(key || "").split(":");
    const it = A().make(kind, style);
    if (!it) return null;
    return ed.place(it, at);
  }

  /* ------------------------------------------------------ making a sticker */

  /** Cam: stickers "Which i can make from any photo". Pick a photo, pick a
      shape -- or Cut out, which lifts the subject off a plain background --
      and a white die-cut border; it goes into the sticker book to use again. */
  async function stickerMaker(ed) {
    const photo = await SS.shared.pickFromLibrary({title: "Choose a photo for the sticker"});
    if (!photo) return;
    const stored = photo.storedName || photo.stored_name || photo;
    const got = await SS.shared.Store.getPhotoData(stored);
    const src = got && (got.dataUrl || got.url);
    if (!src) { SS.shared.toast("That photo could not be loaded.", "error"); return; }
    const st = {shape: "circle", border: 10, tol: 40};
    const d = SS.shared.openDlg("Make a sticker", `
      <div class="sb-cover-ed">
        <div class="sb-sticker-pv" id="sb-st-pv"><p class="sb-note">Cutting…</p></div>
        <div class="sb-cover-opts">
          <div class="dlg-label">Shape</div>
          ${seg("sb-st-shape", A().SHAPES, st.shape, "shape")}
          <label class="dlg-label" for="sb-st-border">White border</label>
          <input type="range" id="sb-st-border" min="0" max="24" step="2" value="${st.border}">
          <div id="sb-st-tolrow" hidden>
            <label class="dlg-label" for="sb-st-tol">How much counts as background</label>
            <input type="range" id="sb-st-tol" min="10" max="120" step="5" value="${st.tol}">
            <p class="sb-note">Cut out works best on a photo of one thing on a plain
              background. Slide right if bits of background are left; left if the
              thing itself is being cut away.</p>
          </div>
          <label class="dlg-label" for="sb-st-name">Name</label>
          <input class="input" id="sb-st-name" value="${esc(photo.caption || "Sticker")}">
        </div>
      </div>`, true);
    const body = d.body;
    wireSegs(body);
    let made = null, ticket = 0;
    const redo = async () => {
      const mine = ++ticket;
      body.querySelector("#sb-st-tolrow").hidden = st.shape !== "cutout";
      try {
        const url = await A().makeSticker(src, st);
        if (mine !== ticket) return;
        made = url;
        body.querySelector("#sb-st-pv").innerHTML = url
          ? `<img src="${url}" alt="The sticker">`
          : `<p class="sb-note">Nothing was left after cutting — slide “background” to the left.</p>`;
      } catch (e) {
        if (mine === ticket) body.querySelector("#sb-st-pv").innerHTML = `<p class="sb-note">${esc(e.message)}</p>`;
      }
    };
    body.querySelector("#sb-st-shape").addEventListener("pick", (e) => { st.shape = e.detail.dataset.shape; redo(); });
    body.querySelector("#sb-st-border").onchange = (e) => { st.border = Number(e.target.value); redo(); };
    body.querySelector("#sb-st-tol").onchange = (e) => { st.tol = Number(e.target.value); redo(); };
    redo();
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save to sticker book", "btn-save", async () => {
      if (!made) { SS.shared.toast("There's no sticker to save yet."); return; }
      const name = body.querySelector("#sb-st-name").value.trim() || "Sticker";
      const res = await store.addSticker(name, made);
      if (!res || res.error) { SS.shared.toast((res && res.error) || "The sticker couldn't be saved.", "error"); return; }
      d.close();
      await drawStickers(ed);
      placeSticker(ed, res.id);
      SS.shared.toast(`“${name}” is in your sticker book, and on this page.`);
    });
  }

  /* ---------------------------------------------------- editing a material */

  function editWords(ed, it) {
    const card = it.style === "card";
    const d = SS.shared.openDlg("Words", `
      <label class="dlg-label" for="sb-words">Words</label>
      ${card ? `<textarea class="input" id="sb-words" rows="5">${esc(it.text || "")}</textarea>`
        : `<input class="input" id="sb-words" value="${esc(it.text || "")}">`}`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save", "btn-save", () => {
      const text = d.body.querySelector("#sb-words").value;
      if (!text.trim()) { d.close(); return; }
      ed.push();
      /* the box follows the words, at the size it is now */
      const [ow, oh] = A().wordSize(it.style, it.text, 28);
      const [nw, nh] = A().wordSize(it.style, text, 28);
      it.w = Math.round((it.w || ow) * nw / ow);
      it.h = Math.round((it.h || oh) * nh / oh);
      it.text = text;
      d.close();
      ed.draw();
      ed.changed();
    });
    const f = d.body.querySelector("#sb-words");
    f.focus(); f.select();
  }

  function editCaption(ed, it) {
    const d = SS.shared.openDlg("Polaroid", `
      <label class="dlg-label" for="sb-cap">Written underneath</label>
      <input class="input" id="sb-cap" value="${esc(it.text || "")}" placeholder="Leave empty for none">`);
    d.btn("Choose the photo", "btn-quiet", () => { d.close(); ed.choosePhoto(it); });
    d.btn("Save", "btn-save", () => {
      ed.push();
      it.text = d.body.querySelector("#sb-cap").value.trim();
      d.close();
      ed.draw();
      ed.changed();
    });
  }

  /** Edit, Enter or a double-click on a material. -> true when it was ours. */
  function editItem(ed, it) {
    if (it.k === "word") { editWords(ed, it); return true; }
    if (it.k === "frame") {
      if (it.style === "polaroid" && it.src) editCaption(ed, it);
      else ed.choosePhoto(it);
      return true;
    }
    if (A().owns(it.k)) {
      SS.shared.toast("Drag it to move, the corner handle sizes it, Turn angles it, and the colours recolour it.");
      return true;
    }
    return false;
  }

  /* ----------------------------------------------------------- the editor */

  async function openBook(host, id) {
    const got = await store.read(id);
    if (!got || got.error) {
      SS.shared.toast((got && got.error) || "Couldn't open that scrapbook.", "error");
      return;
    }
    const book = got.book;
    for (const p of book.pages || []) if (!p.paper) { p.paper = book.paper || "cardstock"; }
    const ed = SS.BoardEditor.open(host, id, book, () => render(host), {
      saveCall: "scrapbooks_write",
      backLabel: "← Scrapbooks",
      bar2: `<button class="btn btn-quiet" id="sb-rot-l" title="Turn what is chosen 15° to the left">Turn left</button>
        <button class="btn btn-quiet" id="sb-rot-r" title="Turn what is chosen 15° to the right">Turn right</button>
        <span class="bd-sep"></span>
        <button class="btn btn-quiet" id="sb-paper" title="This page's paper">Paper</button>
        <button class="btn btn-quiet" id="sb-cover" title="The scrapbook's cover">Cover</button>
        <button class="btn btn-quiet" id="sb-print" title="Print the pages, portrait or landscape">Print…</button>`,
      ...kit,
      wire(ed2) {
        const h = ed2.host;
        h.querySelector("#sb-paper").onclick = () => paperDialog(ed2);
        h.querySelector("#sb-cover").onclick = () => coverDialog(ed2.board, () => ed2.flush());
        h.querySelector("#sb-print").onclick = () => printBook(ed2);
        kit.wire(ed2);
      },
    });
    return ed;
  }

  /** The Scrapbook's materials, for another book to open the editor with:
      the panel, its drag-and-drop, and the materials' own editing. `key`
      keeps that book's panel state apart; `defaults` is how it first looks.
      Used by the Scrapbook itself, Covers, the asset maker and Boards. */
  function makeKit(key, defaults) {
    return {
      get panel() { return panelHTML(key, defaults); },     // drawn fresh for each opening
      editItem,
      photoSrc: (url) => A().shrink(url, 1400),
      photoBox: (it) => A().photoBox(it),
      dropAt(ed2, e, x, y) {
        const k = e.dataTransfer && e.dataTransfer.getData("text/plain");
        if (!k) return;
        if (k.startsWith("nn-photo:")) photoDropped(ed2, k.slice(9), x, y);
        else if (k.startsWith("nn-sticker:")) placeSticker(ed2, k.slice(11), [x, y]);
        else if (k.startsWith("nn-mat:")) placeMaterial(ed2, k.slice(7), [x, y]);
        else if (k.startsWith("nn-asset:")) placeAsset(ed2, k.slice(9), [x, y]);
      },
      wire(ed2) { wireKit(ed2, key, defaults); },
    };
  }

  function wireKit(ed2, key, defaults) {
    const h = ed2.host;
    const state = () => panelState(key) || {...(defaults || {})};
    h.querySelector(".bd-ed").classList.add("sb-ed");
    const rl = h.querySelector("#sb-rot-l"), rr = h.querySelector("#sb-rot-r");
    if (rl) rl.onclick = () => ed2.rotate(-15);
    if (rr) rr.onclick = () => ed2.rotate(15);
    const mats = h.querySelector(".sb-mats");
    h.querySelector("#sb-mats-toggle").onclick = () => {
      const st = state();
      st.collapsed = mats.classList.toggle("is-collapsed");
      h.querySelector("#sb-mats-toggle").textContent = st.collapsed ? "‹" : "›";
      savePanel(st, key);
    };
    h.querySelectorAll(".sb-group").forEach((g) => g.addEventListener("toggle", () => {
      const st = state();
      st[g.dataset.group] = g.open;
      savePanel(st, key);
    }));
    h.querySelectorAll("[data-mat]").forEach((b) => {
      b.onclick = () => placeMaterial(ed2, b.dataset.mat);
      b.ondragstart = (e) => { if (e.dataTransfer) e.dataTransfer.setData("text/plain", "nn-mat:" + b.dataset.mat); };
    });
    h.querySelector("#sb-make").onclick = () => stickerMaker(ed2);
    drawStickers(ed2);
    drawPhotos(ed2, "");
    let typing = null;
    h.querySelector("#sb-photo-q").addEventListener("input", (e) => {
      clearTimeout(typing);
      typing = setTimeout(() => drawPhotos(ed2, e.target.value.trim()), 150);
    });
    drawAssets(ed2);
    let typingA = null;
    h.querySelector("#sb-asset-cat").onchange = () => drawAssets(ed2);
    h.querySelector("#sb-asset-q").addEventListener("input", () => {
      clearTimeout(typingA);
      typingA = setTimeout(() => drawAssets(ed2), 150);
    });
  }

  const kit = makeKit(PANEL_KEY);

  SS.Scrapbook = {
    VIEWS: ["scrapbook:shelf"],
    PREFIX: "scrapbook:",
    async mount(host) {
      host.style.display = "";
      await render(host);
    },
    makeKit,
    _test: {SIZES, pageMM, printBook, idFor, bookFrom, openBook, placeMaterial, placeSticker, setPaper, editItem,
            drawPhotos, photoClicked, photoDropped, placeAsset, drawAssets},
  };
})();
