/* ==========================================================================
   Boards — freeform drawing boards, in Creative (under Notes until 2026-10-03).

   Cam: "i want to add a boards feature, that mimics the one from the old
   Cam's Collective app ... This is a feature i use alot when designing UI or
   powerpoints. It should have all the tools that the other app has, including
   ability to layer, insert photos from the in built app photo section."

   Built in stages: this file is the BOARD LIST and the New board dialog. The
   editor (tools, layering, pages) and the exports (PNG into Photos, out to
   the PC, and PowerPoint) follow.

   A board is one file in neuronet_data/notes/boards/. Its own view name
   ("boards:list"), not "notes:…", because Notes shows and hides its whole
   shell for anything called notes:* — a board would have opened underneath
   Notes' editor. sectionOf() files it under Creative in the menus.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const SIZES = [{w: 1600, h: 1000}, {w: 2400, h: 1500}];
  const PAPERS = [["grid", "Grid"], ["graph", "Graph paper"],
                  ["blank", "Blank"], ["colour", "Colour"]];

  /* Templates are a head start and nothing more: every piece they drop on the
     board is an ordinary item that can be moved, recoloured or deleted --
     which is what the old app's dialog promised, and worth keeping true. */
  const TEMPLATES = {
    blank: {name: "Blank", items: () => []},
    mindmap: {
      name: "Mind map",
      items: () => [
        {k: "ellipse", x: 660, y: 430, w: 280, h: 140, fill: "#f2e9c9", stroke: "#8a7a3d"},
        {k: "text", x: 700, y: 485, w: 200, h: 30, text: "Central idea", size: 20},
        ...[[300, 200], [1100, 200], [300, 700], [1100, 700]].map(([x, y], i) => ({
          k: "rect", x, y, w: 220, h: 90, fill: "#e8eef7", stroke: "#5b6b82",
          _branch: i,
        })),
      ],
    },
    swot: {
      name: "SWOT analysis",
      items: () => {
        const cells = [["Strengths", 120, 120, "#e6f2e6"], ["Weaknesses", 820, 120, "#f7e9e9"],
                       ["Opportunities", 120, 560, "#e7eef8"], ["Threats", 820, 560, "#f8f1e2"]];
        return cells.flatMap(([label, x, y, fill]) => [
          {k: "rect", x, y, w: 660, h: 380, fill, stroke: "#6b6b6b"},
          {k: "text", x: x + 20, y: y + 20, w: 300, h: 34, text: label, size: 22},
        ]);
      },
    },
    kanban: {
      name: "Kanban",
      items: () => ["To do", "Doing", "Done"].flatMap((label, i) => {
        const x = 120 + i * 480;
        return [
          {k: "rect", x, y: 120, w: 420, h: 800, fill: "#f2f2f4", stroke: "#8a8a8a"},
          {k: "text", x: x + 20, y: 140, w: 300, h: 34, text: label, size: 22},
        ];
      }),
    },
  };

  /* SS.Store.call takes its arguments as an ARRAY, and a "what for" used in
     the message if the build is out of step. */
  const store = {
    async list() { return (await SS.Store.call("boards_list", [], "Your boards")) || []; },
    async read(id) { return SS.Store.call("boards_read", [id], "Opening a board"); },
    async write(id, board) { return SS.Store.call("boards_write", [id, board], "Saving a board"); },
    async remove(id) { return SS.Store.call("boards_delete", [id], "Deleting a board"); },
  };

  /** A file name from what Cam typed: letters, digits, spaces, - and _ only,
      since that is all a board id may be. Kept unique so naming two boards
      the same never has one quietly overwrite the other. */
  function idFor(name, taken) {
    let base = String(name || "Untitled board").replace(/[^A-Za-z0-9 _-]/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, 60) || "Untitled board";
    let id = base, n = 2;
    while (taken.has(id)) { id = `${base} ${n}`; n += 1; }
    return id;
  }

  let boards = [];

  async function render(host) {
    boards = await store.list();
    host.innerHTML = `
      <div class="bd-head">
        <h2 class="page-h">Boards</h2>
        <p class="stamp">Freeform boards for mind maps, wireframes and planning —
          the place to sketch a screen or a slide before building it.</p>
        <div class="bd-actions">
          <button class="btn btn-primary" id="bd-new">+ New board</button>
          <button class="btn btn-quiet" id="bd-pptx">Export PowerPoint</button>
        </div>
      </div>
      ${boards.length ? `<div class="bd-list">${boards.map(row).join("")}</div>`
        : `<p class="bd-empty">No boards yet. Make one and it lands here.</p>`}`;

    host.querySelector("#bd-new").onclick = () => newBoardDialog(host);
    host.querySelector("#bd-pptx").onclick = () => exportPowerPoint();
    host.querySelectorAll("[data-open]").forEach((b) =>
      b.onclick = () => openBoard(host, b.dataset.open));
    host.querySelectorAll("[data-rename]").forEach((b) =>
      b.onclick = () => renameBoard(host, b.dataset.rename));
    host.querySelectorAll("[data-del]").forEach((b) =>
      b.onclick = () => deleteBoard(host, b.dataset.del));
  }

  function row(b) {
    if (b.error) {
      return `<div class="bd-row is-broken">
        <div><div class="bd-name">${esc(b.name)}</div>
        <div class="bd-meta">${esc(b.error)} It has been left exactly as it is.</div></div>
      </div>`;
    }
    const when = (b.updated || "").slice(0, 10);
    return `<div class="bd-row">
      <div class="bd-row-main">
        <div class="bd-name">${esc(b.name)}</div>
        <div class="bd-meta">${b.w}×${b.h} · ${b.items} item${b.items === 1 ? "" : "s"}${
          b.pages > 1 ? ` · ${b.pages} pages` : ""}${when ? ` · ${esc(when)}` : ""}</div>
      </div>
      <button class="btn btn-quiet" data-open="${esc(b.id)}">Open</button>
      <button class="btn btn-quiet" data-rename="${esc(b.id)}" title="Rename this board">Rename</button>
      <button class="btn btn-quiet bd-del" data-del="${esc(b.id)}" title="Delete this board">Delete</button>
    </div>`;
  }

  function newBoardDialog(host) {
    const html = `
      <label class="dlg-label" for="bd-name">Name</label>
      <input class="input" id="bd-name" value="Untitled board">
      <div class="dlg-label">Size</div>
      <div class="seg" id="bd-size">${SIZES.map((s, i) =>
        `<button class="seg-btn ${i === 0 ? "on" : ""}" data-size="${i}">${s.w}×${s.h}</button>`).join("")}</div>
      <div class="dlg-label">Start from</div>
      <div class="seg" id="bd-template">${Object.entries(TEMPLATES).map(([k, t], i) =>
        `<button class="seg-btn ${i === 0 ? "on" : ""}" data-template="${k}">${esc(t.name)}</button>`).join("")}</div>
      <div class="dlg-label">Paper</div>
      <div class="seg" id="bd-paper">${PAPERS.map(([k, label], i) =>
        `<button class="seg-btn ${i === 0 ? "on" : ""}" data-paper="${k}">${esc(label)}</button>`).join("")}</div>
      <p class="stamp">Templates are just a head start — every piece is an
        ordinary item you can move, recolour or delete.</p>`;
    openDialog("New board", html, async (body) => {
      const pick = (sel) => body.querySelector(`${sel} .seg-btn.on`);
      const size = SIZES[Number(pick("#bd-size").dataset.size)];
      const template = pick("#bd-template").dataset.template;
      const paper = pick("#bd-paper").dataset.paper;
      const name = body.querySelector("#bd-name").value.trim() || "Untitled board";
      const id = idFor(name, new Set(boards.map((b) => b.id)));
      const board = boardFrom(template, {name, size, paper});
      const res = await store.write(id, board);
      if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
      await render(host);
      openBoard(host, id);
    }, "Create");
  }

  /** A new board, from a template.

      Its own function, and exposed for testing, because the id it puts on
      every item is load-bearing and was once missing. Everything on a
      board is found BY ITS ID -- the SVG carries data-id, a click reads
      that attribute back, and the move looks the item up by it. The
      templates were written without ids, so every shape in a mind map, a
      SWOT or a Kanban rendered as data-id="" and the lookup found
      nothing: selecting, moving, recolouring and deleting all quietly did
      nothing at all. Cam: "i cannot move the boxes around? Is this and
      intended feature?"

      A test that builds its board the way this does, rather than calling
      this, is a test that passes while the app is broken -- which is
      exactly what happened the first time it was written. So there is one
      of these and both use it. */
  function boardFrom(template, {name, size, paper}) {
    const stamp = Date.now().toString(36);
    return {
      name, w: size.w, h: size.h, paper,
      pages: [{items: (TEMPLATES[template] || TEMPLATES.blank).items()
        .map((it, i) => ({id: `t${stamp}${i}`, ...it}))}],
      created: new Date().toISOString(),
    };
  }

  /** The app's own dialog, so a Boards dialog looks and behaves like every
      other one in Cam's Collective S rather than being a second kind. */
  function openDialog(title, bodyHTML, onOk, okLabel) {
    const d = SS.shared.openDlg(title, bodyHTML);
    d.body.querySelectorAll(".seg").forEach((seg) =>
      seg.addEventListener("click", (e) => {
        const b = e.target.closest(".seg-btn");
        if (!b) return;
        seg.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
      }));
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn(okLabel || "Save", "btn-save", async () => {
      await onOk(d.body);
      d.close();
    });
    const first = d.body.querySelector("input");
    if (first) { first.focus(); first.select(); }
    return d;
  }

  /** Boards to PowerPoint: one slide per page, in the order they are listed.

      Cam: "This is a feature i use alot when designing UI or powerpoints."
      Each page is drawn to a picture by the same code that draws it on
      screen, so a slide cannot look different from the board it came from. */
  async function exportPowerPoint() {
    if (!boards.length) { SS.shared.toast("There are no boards to export."); return; }
    const formats = await SS.Store.call("boards_formats", [], "Checking exports");
    if (!formats || !formats.pptx) {
      SS.shared.toast("PowerPoint export needs the python-pptx library, which "
        + "isn't installed on this machine.", "error");
      return;
    }
    const usable = boards.filter((b) => !b.error);
    const d = SS.shared.openDlg("Export to PowerPoint", `
      <p class="stamp">One slide per page, boards in this order — untick any you
        don't want. A board with several pages becomes several slides in a row.</p>
      ${usable.map((b) => `<label class="bd-pick">
        <input type="checkbox" data-board="${esc(b.id)}" checked>
        <span>${esc(b.name)}</span>
        <em>${b.pages > 1 ? `${b.pages} pages` : `${b.items} item${b.items === 1 ? "" : "s"}`}</em>
      </label>`).join("")}`, true);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Export", "btn-save", async () => {
      const chosen = [...d.body.querySelectorAll("[data-board]:checked")].map((c) => c.dataset.board);
      d.close();
      if (!chosen.length) { SS.shared.toast("Nothing was ticked."); return; }
      SS.shared.toast(`Drawing ${chosen.length} board${chosen.length === 1 ? "" : "s"}…`);
      const slides = [];
      for (const id of chosen) {
        const got = await store.read(id);
        if (!got || got.error) continue;          // a broken board is skipped,
        const board = got.board;                  // never stops the whole export
        for (let i = 0; i < (board.pages || []).length; i++) {
          try {
            slides.push({name: board.name, dataUrl: await SS.BoardEditor.pagePNG(board, i)});
          } catch (e) { /* that page could not be drawn; the rest still go */ }
        }
      }
      if (!slides.length) { SS.shared.toast("None of those pages could be drawn.", "error"); return; }
      const res = await SS.Store.call("boards_export_pptx",
        ["Boards", slides], "Building the deck");
      if (!res || res.error) { SS.shared.toast((res && res.error) || "That didn't work.", "error"); return; }
      SS.shared.toast(`Saved ${res.slides} slide${res.slides === 1 ? "" : "s"} to your desktop.`);
    });
  }

  async function renameBoard(host, id) {
    const got = await store.read(id);
    if (!got || got.error) { SS.shared.toast((got && got.error) || "Couldn't open that board.", "error"); return; }
    openDialog("Rename board",
      `<label class="dlg-label" for="bd-rename">Name</label>
       <input class="input" id="bd-rename" value="${esc(got.board.name || "")}">`,
      async (body) => {
        const name = body.querySelector("#bd-rename").value.trim();
        if (!name) return;
        got.board.name = name;              // the file keeps its id; only the
        await store.write(id, got.board);   // name Cam sees changes
        await render(host);
      }, "Rename");
  }

  async function deleteBoard(host, id) {
    const b = boards.find((x) => x.id === id);
    openDialog("Delete this board?",
      `<p class="stamp">“${esc((b && b.name) || id)}” and everything drawn on it
        will be gone. This one cannot be undone.</p>`,
      async () => {
        const res = await store.remove(id);
        if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
        await render(host);
      }, "Delete");
  }

  async function openBoard(host, id) {
    const got = await store.read(id);
    if (!got || got.error) {
      /* A board that cannot be read is never replaced with a blank one:
         it is said plainly and the file is left exactly as it is. */
      SS.shared.toast((got && got.error) || "Couldn't open that board.", "error");
      return;
    }
    /* Cam (2026-10-03): assets "used in scrapbook and boards ... can then be
       used in projects straight from the app" -- the Scrapbook's materials
       panel (Assets, clip art, photos, tapes...), folded away until wanted.
       Boards' photos are kept as they always were (no photoSrc). */
    const kit = SS.Scrapbook && SS.Scrapbook.makeKit("nn:boards:panel", {collapsed: true});
    SS.BoardEditor.open(host, id, got.board, () => render(host), kit ? {
      panel: kit.panel, editItem: kit.editItem, photoBox: kit.photoBox,
      dropAt: kit.dropAt, wire: kit.wire,
    } : undefined);
  }

  SS.Boards = {
    VIEWS: ["boards:list"],
    PREFIX: "boards:",
    async mount(host) {
      host.style.display = "";
      await render(host);
    },
    _test: {TEMPLATES, idFor, boardFrom, SIZES, openBoard},
  };
})();
