/* ==========================================================================
   Cells — standalone spreadsheets, under Notes.

   Cam: "I want to add another sub section in Notes called Cells. This will be
   the grid based system found in the vault on the tool bar. However it will
   be a complete standalone notes page with tool bar that has
   excell/librecalc style features. It should also have the ability to import
   .csv /spreadsheets and export."

   THE SAME GRID. A sheet holds exactly the model a ```grid block holds, and
   is drawn by the same grid view. So formulas, fill, sort, filter, number
   formats, conditional colours, charts and the Excel clipboard are the ones
   already built and tested — not a second spreadsheet that drifts from the
   first. What is new here is documents of their own, and import/export.

   Sheets live in neuronet_data/notes/cells/, beside the boards and the
   vault, one file each.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const store = {
    list: () => SS.Store.call("cells_list", [], "Your sheets"),
    read: (id) => SS.Store.call("cells_read", [id], "Opening a sheet"),
    write: (id, sheet) => SS.Store.call("cells_write", [id, sheet], "Saving a sheet"),
    remove: (id) => SS.Store.call("cells_delete", [id], "Deleting a sheet"),
    formats: () => SS.Store.call("cells_formats", [], "Checking exports"),
    importFile: () => SS.Store.call("cells_import", [], "Importing a spreadsheet"),
    exportFile: (name, rows, fmt) =>
      SS.Store.call("cells_export", [name, rows, fmt], "Exporting a sheet"),
  };

  /** A file name from what Cam typed, kept unique so two sheets with the same
      name never have one quietly overwrite the other. */
  function idFor(name, taken) {
    const base = String(name || "Untitled sheet").replace(/[^A-Za-z0-9 _-]/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, 60) || "Untitled sheet";
    let id = base, n = 2;
    while (taken.has(id)) { id = `${base} ${n}`; n += 1; }
    return id;
  }

  let sheets = [];

  async function render(host) {
    sheets = (await store.list()) || [];
    host.innerHTML = `
      <div class="bd-head">
        <h2 class="page-h">Cells</h2>
        <p class="stamp">Spreadsheets of their own — the same grid as in a note,
          with formulas, sorting, filtering, formats, colours and charts, plus
          importing and exporting.</p>
        <div class="bd-actions">
          <button class="btn btn-primary" id="ce-new">+ New sheet</button>
          <button class="btn btn-quiet" id="ce-import">Import a spreadsheet</button>
        </div>
      </div>
      ${sheets.length ? `<div class="bd-list">${sheets.map(row).join("")}</div>`
        : `<p class="bd-empty">No sheets yet. Make one, or import a .csv or .xlsx.</p>`}`;
    /* The list of sheets is an ordinary page. Cleared here as well as in the
       host's render(), because "← Sheets" comes back through this function
       directly without going through the router. */
    host.classList.remove("ss-main-fills");
    host.querySelector("#ce-new").onclick = () => newSheet(host);
    host.querySelector("#ce-import").onclick = () => importSheet(host);
    host.querySelectorAll("[data-open]").forEach((b) =>
      b.onclick = () => open(host, b.dataset.open));
    host.querySelectorAll("[data-rename]").forEach((b) =>
      b.onclick = () => renameSheet(host, b.dataset.rename));
    host.querySelectorAll("[data-del]").forEach((b) =>
      b.onclick = () => deleteSheet(host, b.dataset.del));
  }

  function row(s) {
    if (s.error) {
      return `<div class="bd-row is-broken"><div class="bd-row-main">
        <div class="bd-name">${esc(s.name)}</div>
        <div class="bd-meta">${esc(s.error)} It has been left exactly as it is.</div>
      </div></div>`;
    }
    const when = (s.updated || "").slice(0, 10);
    return `<div class="bd-row">
      <div class="bd-row-main">
        <div class="bd-name">${esc(s.name)}</div>
        <div class="bd-meta">${s.rows}×${s.cols} · ${s.filled} filled${
          when ? ` · ${esc(when)}` : ""}</div>
      </div>
      <button class="btn btn-quiet" data-open="${esc(s.id)}">Open</button>
      <button class="btn btn-quiet" data-rename="${esc(s.id)}">Rename</button>
      <button class="btn btn-quiet bd-del" data-del="${esc(s.id)}">Delete</button>
    </div>`;
  }

  /* A new sheet is 40 columns by 120 rows.

     Cam: "increase the size of the workspace for cells." Making the grid
     fill its pane was half of it; the other half is having enough sheet to
     fill with. It used to start at 8 by 20, which drew a small rectangle in
     the top-left of a large empty page -- the sheet ran out well before the
     room did, and reaching column J meant pressing "+ Column" twice first.

     40 by 120 covers a maximised window on a wide screen with room to
     scroll, and is still nothing to carry: the cells are empty strings, and
     an untouched sheet of this size is about 12 KB of JSON. An imported file
     keeps its own shape, because the file is the truth about how big it is.

     These are a floor, not a ceiling -- "+ Row" and "+ Column" still work,
     and nothing here caps how far a sheet can grow. */
  const NEW_COLS = 40;
  const NEW_ROWS = 120;

  function blankSheet(name, rows) {
    const grid = window.SSGrid.blank(rows ? rows.length : NEW_ROWS,
                                     rows ? rows[0].length : NEW_COLS);
    if (rows) grid.rows = rows.map((r) => r.map((c) => (c == null ? "" : String(c))));
    return {name, grid, created: new Date().toISOString()};
  }

  function dialog(title, body, onOk, okLabel) {
    const d = SS.shared.openDlg(title, body);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn(okLabel || "Save", "btn-save", async () => { await onOk(d.body); d.close(); });
    const first = d.body.querySelector("input");
    if (first) { first.focus(); first.select(); }
    return d;
  }

  function newSheet(host) {
    dialog("New sheet", `
      <label class="dlg-label" for="ce-name">Name</label>
      <input class="input" id="ce-name" value="Untitled sheet">`,
      async (body) => {
        const name = body.querySelector("#ce-name").value.trim() || "Untitled sheet";
        const id = idFor(name, new Set(sheets.map((s) => s.id)));
        const res = await store.write(id, blankSheet(name));
        if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
        await render(host);
        open(host, id);
      }, "Create");
  }

  /** A .csv, .tsv or .xlsx becomes a sheet of its own, named after the file.
      Cells keep the text they held, so an imported "=B2*5" is still a formula
      and this grid works it out. */
  async function importSheet(host) {
    const got = await store.importFile();
    if (!got || got.cancelled) return;
    if (got.error) { SS.shared.toast(got.error, "error"); return; }
    const id = idFor(got.name, new Set(sheets.map((s) => s.id)));
    const res = await store.write(id, blankSheet(got.name, got.rows));
    if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
    SS.shared.toast(`Imported ${got.rows.length} row${got.rows.length === 1 ? "" : "s"}.`);
    await render(host);
    open(host, id);
  }

  async function renameSheet(host, id) {
    const got = await store.read(id);
    if (!got || got.error) { SS.shared.toast((got && got.error) || "Couldn't open it.", "error"); return; }
    dialog("Rename sheet", `
      <label class="dlg-label" for="ce-rename">Name</label>
      <input class="input" id="ce-rename" value="${esc(got.sheet.name || "")}">`,
      async (body) => {
        const name = body.querySelector("#ce-rename").value.trim();
        if (!name) return;
        got.sheet.name = name;
        await store.write(id, got.sheet);
        await render(host);
      }, "Rename");
  }

  async function deleteSheet(host, id) {
    const s = sheets.find((x) => x.id === id);
    dialog("Delete this sheet?",
      `<p class="stamp">“${esc((s && s.name) || id)}” and everything in it will be
        gone. This one cannot be undone.</p>`,
      async () => {
        const res = await store.remove(id);
        if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
        await render(host);
      }, "Delete");
  }

  /* ------------------------------------------------------------ the sheet */

  async function open(host, id) {
    const got = await store.read(id);
    if (!got || got.error) {
      /* A sheet that cannot be read is never replaced with a blank one. */
      SS.shared.toast((got && got.error) || "Couldn't open that sheet.", "error");
      return;
    }
    const sheet = got.sheet;
    /* A sheet IS the workspace, so it takes the pane and scrolls inside
       itself rather than making the page scroll. See cells.css. */
    host.classList.add("ss-main-fills");
    host.innerHTML = `
      <div class="ss-cells grid-page">
        <div class="ce-bar">
          <button class="btn btn-quiet" id="ce-back">← Sheets</button>
          <strong class="ce-name">${esc(sheet.name || "Untitled sheet")}</strong>
          <div class="ce-bar-right">
            <button class="btn btn-quiet" id="ce-csv">Export .csv</button>
            <button class="btn btn-quiet" id="ce-xlsx">Export .xlsx</button>
          </div>
        </div>
        <div class="ss-grid" id="ce-grid"></div>
      </div>`;

    const holder = host.querySelector("#ce-grid");
    holder.dataset.gridSrc = encodeURIComponent(window.SSGrid.serialize(sheet.grid));
    let saveTimer = null;
    const view = window.SSGridView.mount(holder, {
      editable: () => true,               // a sheet is always editable
      inNote: false,                      // and cannot be "removed from" one
      onChange: () => {
        /* The grid writes its model onto the holder; the sheet is saved from
           there, debounced, exactly as a note is. */
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
          sheet.grid = window.SSGrid.parse(decodeURIComponent(holder.dataset.gridSrc || ""));
          if (sheet.grid.error) return;   // never save over a model we cannot read
          const res = await store.write(id, sheet);
          if (res && res.error) SS.shared.toast(res.error, "error");
        }, 600);
      },
    });

    host.querySelector("#ce-back").onclick = () => { clearTimeout(saveTimer); render(host); };
    host.querySelector("#ce-csv").onclick = () => exportSheet(sheet, holder, "csv");
    host.querySelector("#ce-xlsx").onclick = () => exportSheet(sheet, holder, "xlsx");
    return view;
  }

  /** Out to the desktop as VALUES — what is on screen, worked out by the same
      engine that draws it. A formula pointing at cells another program does
      not have would arrive broken. */
  async function exportSheet(sheet, holder, fmt) {
    if (fmt === "xlsx") {
      const formats = await store.formats();
      if (!formats || !formats.xlsx) {
        SS.shared.toast("Writing .xlsx needs the openpyxl library, which isn't "
          + "installed on this machine. .csv works everywhere.", "error");
        return;
      }
    }
    const model = window.SSGrid.parse(decodeURIComponent(holder.dataset.gridSrc || ""));
    if (model.error) { SS.shared.toast(model.error, "error"); return; }
    const vals = window.SSGrid.computeAll(model);
    const rows = model.rows.map((r, ri) => r.map((_, ci) => {
      const f = model.fmt[window.SSGrid.refName(ci, ri)] || {};
      return window.SSGrid.display(vals[ri][ci], f.num);
    }));
    const res = await store.exportFile(sheet.name || "Sheet", rows, fmt);
    if (!res || res.error) { SS.shared.toast((res && res.error) || "That didn't work.", "error"); return; }
    SS.shared.toast(`Saved to your desktop as ${fmt === "csv" ? ".csv" : ".xlsx"}.`);
  }

  SS.Cells = {
    VIEWS: ["cells:list"],
    PREFIX: "cells:",
    async mount(host) {
      host.style.display = "";
      await render(host);
    },
    _test: {idFor, blankSheet},
  };
})();
