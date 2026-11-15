/* ==========================================================================
   Grid — on screen. The spreadsheet a ```grid block becomes inside a note.

   All the arithmetic lives in grid.js (SSGrid). This file only draws what
   that computes and turns clicks and keys into changes to the model.

   HOW A CHANGE IS SAVED. The grid never touches the note's text itself. It
   writes its model back onto its own holder (data-grid-src) and calls the
   onChange it was given — which is Notes' own onViewEditInput, the same
   path as typing a letter. Notes then rebuilds the note from the page, and
   serializeBlock writes the grid out verbatim from that attribute. So a
   grid edit is saved, autosaved and undoable exactly like any other edit.

   KEEPING TO ITSELF. The grid sits inside the note's editable area, and
   Notes listens there for typing. An input event from a cell's text box
   would bubble up and Notes would rebuild the WHOLE NOTE from that little
   box — erasing everything else in it. So every key, input, paste and
   clipboard event stops at the grid's edge. test_grid_view.js checks that
   typing in a cell leaves the rest of the note untouched.

   A BLOCK THAT CANNOT BE READ is shown as it is, with the reason, and is
   never replaced: the grid only writes back a model it successfully read.
   ========================================================================== */
(function () {
  "use strict";
  const G = window.SSGrid;

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  /* Events that must never reach the note around the grid. */
  const CONTAINED = ["keydown", "keyup", "keypress", "input", "beforeinput",
    "paste", "cut", "copy", "compositionstart", "compositionupdate",
    "compositionend", "drop", "dragover",
    /* Presses too. Notes has its own resizable tables and listens for a
       pointer going down near a table's column edge -- and a grid IS a
       table. Without these, dragging a grid column let Notes' resizer take
       the drag and save the grid's cell text over the whole note. Only the
       presses are stopped: moves and releases still reach the window,
       where this grid's own drags listen for them. */
    "pointerdown", "mousedown"];

  function mount(holder, opts) {
    if (holder._ssGrid) { holder._ssGrid.refresh(); return holder._ssGrid; }
    const src = decodeURIComponent(holder.dataset.gridSrc || "");
    const parsed = G.parse(src);

    if (parsed.error) {
      holder.innerHTML = `<div class="ssg-broken">
        <strong>This grid could not be read.</strong> ${esc(parsed.error)}
        It has been left exactly as it was — nothing here is saved over it.
        <pre>${esc(src)}</pre></div>`;
      return null;
    }

    const view = new GridView(holder, parsed, opts || {});
    holder._ssGrid = view;
    return view;
  }

  class GridView {
    constructor(holder, model, opts) {
      this.holder = holder;
      /* A grid inside a note can be removed from it; a sheet cannot -- it is
         the page. Cells says so when it mounts. */
      this.inNote = (opts || {}).inNote !== false;
      this.model = model;
      this.opts = opts;
      this.sel = {r: model.freeze, c: 0, r2: model.freeze, c2: 0};
      this.editing = null;          // {r, c, input} while a cell is being typed in
      this.build();
      this.render();
    }

    canEdit() { return !!(this.opts.editable && this.opts.editable()); }

    /* -------------------------------------------------------------- shell */

    build() {
      const h = this.holder;
      h.innerHTML = `
        <div class="ssg" tabindex="0" role="grid" aria-label="Grid">
          <!-- Something to actually grab. Choosing the whole grid by clicking
               its frame meant hitting a few pixels of edge, and the bar below
               is mostly the box you type formulas into. -->
          <div class="ssg-grip" title="Select this grid — then press Delete to remove it"
               aria-label="Select this grid"></div>
          <div class="ssg-bar">
            <span class="ssg-addr"></span>
            <input class="ssg-formula" spellcheck="false" aria-label="Cell contents">
          </div>
          <div class="ssg-scroll"><table class="ssg-table"></table></div>
          <div class="ssg-tools">
            <button type="button" data-act="row-add" title="Insert a row below">+ Row</button>
            <button type="button" data-act="col-add" title="Insert a column to the right">+ Column</button>
            <button type="button" data-act="row-del" title="Delete the selected rows">− Row</button>
            <button type="button" data-act="col-del" title="Delete the selected columns">− Column</button>
            <span class="ssg-sep"></span>
            <button type="button" data-act="fill-down" title="Fill down (Ctrl+D) — continues a series like 1, 2, 3">Fill down</button>
            <button type="button" data-act="fill-right" title="Fill right (Ctrl+R)">Fill right</button>
            <span class="ssg-sep"></span>
            <button type="button" data-act="freeze" class="ssg-toggle" title="Keep the first row in view while scrolling">Freeze header</button>
            <span class="ssg-sep"></span>
            <!-- Only inside a note: on a Cells page the grid IS the page,
                 and "remove" would leave an empty sheet with no way back. -->
            ${this.inNote ? `<button type="button" data-act="remove" class="ssg-remove"
                    title="Remove this grid from the note (Ctrl+Z puts it back)">Remove grid</button>` : ""}
          </div>
          <div class="ssg-tools ssg-fmt">
            <button type="button" data-act="bold" title="Bold (Ctrl+B)"><b>B</b></button>
            <button type="button" data-act="italic" title="Italic (Ctrl+I)"><i>I</i></button>
            <button type="button" data-pop="fill" title="Fill colour">Fill</button>
            <button type="button" data-pop="text" title="Text colour">Text</button>
            <button type="button" data-act="align-left" title="Align left">⟸</button>
            <button type="button" data-act="align-center" title="Centre">≡</button>
            <button type="button" data-act="align-right" title="Align right">⟹</button>
            <select class="ssg-numfmt" title="Number format" aria-label="Number format"></select>
            <span class="ssg-sep"></span>
            <button type="button" data-act="sort-asc" title="Sort the rows by this column, smallest first">Sort ↑</button>
            <button type="button" data-act="sort-desc" title="Sort the rows by this column, largest first">Sort ↓</button>
            <button type="button" data-pop="filter" title="Show only the rows that match">Filter</button>
            <button type="button" data-pop="rules" title="Colour cells automatically, e.g. red if over target">Rules</button>
            <button type="button" data-pop="chart" title="Chart the selected cells">Chart</button>
          </div>
          <div class="ssg-chart" hidden></div>
          <div class="ssg-status" hidden></div>
          <div class="ssg-pop" hidden></div>
        </div>`;
      this.root = h.querySelector(".ssg");
      this.table = h.querySelector(".ssg-table");
      this.scroll = h.querySelector(".ssg-scroll");
      this.formula = h.querySelector(".ssg-formula");
      this.addr = h.querySelector(".ssg-addr");

      // Nothing leaves the grid: see "KEEPING TO ITSELF" above.
      for (const ev of CONTAINED) {
        this.root.addEventListener(ev, (e) => e.stopPropagation());
      }

      this.root.addEventListener("keydown", (e) => this.onKey(e));
      /* A press on the grid's frame -- its bar, its edges, anywhere that is
         not a cell, a button or a box to type in -- chooses the whole grid. */
      this.root.addEventListener("mousedown", (e) => {
        const onGrip = !!e.target.closest(".ssg-grip");
        const onChrome = e.target === this.root;
        this.selectBlock(onGrip || onChrome);
      });
      this.root.addEventListener("copy", (e) => this.onCopy(e, false));
      this.root.addEventListener("cut", (e) => this.onCopy(e, true));
      this.root.addEventListener("paste", (e) => this.onPaste(e));
      this.table.addEventListener("mousedown", (e) => this.onMouseDown(e));
      this.table.addEventListener("dblclick", (e) => {
        const cell = e.target.closest("td[data-r]");
        if (cell && this.canEdit()) this.startEdit(false);
      });

      this.formula.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); this.commitFormulaBar(); this.move(1, 0); this.root.focus(); }
        if (e.key === "Escape") { e.preventDefault(); this.render(); this.root.focus(); }
      });
      this.formula.addEventListener("blur", () => this.commitFormulaBar());

      h.querySelectorAll(".ssg-tools").forEach((bar) => bar.addEventListener("click", (e) => {
        if (!this.canEdit()) return;
        const b = e.target.closest("[data-act]");
        if (b) { this.act(b.dataset.act); return; }
        const p = e.target.closest("[data-pop]");
        if (p) this.openPop(p.dataset.pop, p);
      }));
      this.numfmt = h.querySelector(".ssg-numfmt");
      this.numfmt.innerHTML = Object.entries(G.NUM_FORMATS)
        .map(([k, f]) => `<option value="${k}">${esc(f.name)}</option>`).join("");
      this.numfmt.addEventListener("change", () => this.setFmt({num: this.numfmt.value === "general" ? null : this.numfmt.value}));
      this.chartEl = h.querySelector(".ssg-chart");
      this.pop = h.querySelector(".ssg-pop");
      this.status = h.querySelector(".ssg-status");
      /* A press anywhere outside an open panel closes it -- including
         inside the grid itself. Two listeners are needed: presses inside
         the grid never reach the document, because the grid stops them at
         its edge (see "KEEPING TO ITSELF"), so that one is on the grid and
         runs in the CAPTURE phase, before the stopping. Without it, clicking
         a cell left the panel open and the next press on its button just
         toggled it shut -- which looked like the button doing nothing. */
      const closeIfOutside = (e) => {
        if (!this.pop.hidden && !this.pop.contains(e.target)
            && !e.target.closest("[data-pop]")) this.closePop();
      };
      this.root.addEventListener("mousedown", closeIfOutside, true);
      document.addEventListener("mousedown", closeIfOutside);
    }

    /* ------------------------------------------------------------- draw */

    render() {
      const m = this.model;
      const vals = this.vals = G.computeAll(m);
      const editable = this.canEdit();
      this.root.classList.toggle("is-readonly", !editable);
      this.formula.readOnly = !editable;

      const visible = G.visibleRows(m, vals);
      const cols = m.cols.length;
      const colgroup = `<colgroup><col class="ssg-rownum-col">${
        m.cols.map((c) => `<col style="width:${Math.max(40, c.w | 0)}px">`).join("")}</colgroup>`;
      const head = `<tr class="ssg-head"><th class="ssg-corner"></th>${
        m.cols.map((c, i) => `<th class="ssg-colh" data-c="${i}">${G.colName(i)}<span class="ssg-resize" data-c="${i}"></span></th>`).join("")}</tr>`;

      const [r1, r2, c1, c2] = this.bounds();
      let body = "";
      for (const r of visible) {
        const frozen = r < m.freeze;
        let tds = "";
        for (let c = 0; c < cols; c++) {
          const v = vals[r][c];
          const f = m.fmt[G.refName(c, r)] || {};
          const cond = G.condStyle(m, c, r, vals);
          const isNum = typeof v === "number";
          const style = [];
          const bg = (cond && cond.bg) || f.bg;
          // A fill with no text colour chosen gets dark or light text by the
          // fill's own brightness -- pale yellow in a dark theme would
          // otherwise leave light text on a light cell.
          const fg = (cond && cond.color) || f.color || (bg ? readableOn(bg) : null);
          // background-COLOR, not the background shorthand: the shorthand
          // also resets background-image, which is the selection tint.
          if (bg) style.push(`background-color:${bg}`);
          if (fg) style.push(`color:${fg}`);
          if (f.b) style.push("font-weight:700");
          if (f.i) style.push("font-style:italic");
          if (f.align) style.push(`text-align:${f.align}`);
          const cls = ["ssg-cell"];
          if (isNum) cls.push("is-num");
          if (G.isErr(v)) cls.push("is-err");
          if (r >= r1 && r <= r2 && c >= c1 && c <= c2) cls.push("is-sel");
          if (r === this.sel.r && c === this.sel.c) cls.push("is-active");
          tds += `<td class="${cls.join(" ")}" data-r="${r}" data-c="${c}"${
            style.length ? ` style="${style.join(";")}"` : ""}>${esc(G.display(v, f.num))}</td>`;
        }
        body += `<tr class="${frozen ? "ssg-frozen" : ""}"><th class="ssg-rowh">${r + 1}</th>${tds}</tr>`;
      }
      const hidden = m.rows.length - visible.length;
      this.table.innerHTML = colgroup + `<thead>${head}</thead><tbody>${body}</tbody>`;
      this.table.dataset.hidden = hidden;
      /* A filter must never look like lost rows: say how many are hidden,
         and offer the way back, every time it is on. */
      if (m.filter) {
        const f = m.filter;
        this.status.hidden = false;
        this.status.innerHTML = `Filtered on column ${G.colName(f.col)} (${esc(f.op)}${
          f.op.endsWith("blank") ? "" : " " + esc(f.value)}) — ${hidden} row${hidden === 1 ? "" : "s"} hidden, none deleted.
          <button type="button" class="ssg-clear-filter">Show all rows</button>`;
        this.status.querySelector(".ssg-clear-filter").onclick = () => {
          if (!this.canEdit()) return;
          this.model.filter = null; this.commit();
        };
      } else {
        this.status.hidden = true;
      }
      this.drawChart(vals);
      this.stickFrozen();
      this.showActive();
      this.holder.querySelector('[data-act="freeze"]')
        .classList.toggle("on", m.freeze > 0);
    }

    /* Frozen rows stay in view: each is pinned just below the rows above it.
       Offsets are measured, not assumed, so a tall header row still works. */
    stickFrozen() {
      const headRow = this.table.querySelector("thead tr");
      let top = headRow ? headRow.getBoundingClientRect().height : 0;
      this.table.querySelectorAll("tr.ssg-frozen").forEach((tr) => {
        tr.querySelectorAll("td, th").forEach((cell) => { cell.style.top = top + "px"; });
        top += tr.getBoundingClientRect().height;
      });
    }

    showActive() {
      const {r, c} = this.sel;
      this.addr.textContent = G.refName(c, r);
      if (this.numfmt) this.numfmt.value = (this.model.fmt[G.refName(c, r)] || {}).num || "general";
      const raw = (this.model.rows[r] || [])[c];
      if (document.activeElement !== this.formula) this.formula.value = raw == null ? "" : raw;
    }

    bounds() {
      const s = this.sel;
      return [Math.min(s.r, s.r2), Math.max(s.r, s.r2), Math.min(s.c, s.c2), Math.max(s.c, s.c2)];
    }

    /* -------------------------------------------------------------- save */

    /** The one place a change leaves the grid. Writes the model onto the
        holder, redraws, and hands the note its normal edit signal. */
    commit() {
      this.holder.dataset.gridSrc = encodeURIComponent(G.serialize(this.model));
      this.render();
      if (this.opts.onChange) this.opts.onChange();
    }

    setCell(r, c, raw) {
      const m = this.model;
      while (r >= m.rows.length) m.rows.push(Array(m.cols.length).fill(""));
      while (c >= m.cols.length) { m.cols.push({w: 110}); m.rows.forEach((row) => row.push("")); }
      m.rows[r][c] = raw;
    }

    /* ------------------------------------------------------- selecting */

    onMouseDown(e) {
      const resize = e.target.closest(".ssg-resize");
      if (resize) { this.startResize(e, Number(resize.dataset.c)); return; }
      const cell = e.target.closest("td[data-r]");
      if (!cell) return;
      e.preventDefault();
      if (this.editing) this.commitEdit();
      const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
      if (e.shiftKey) { this.sel.r2 = r; this.sel.c2 = c; }
      else this.sel = {r, c, r2: r, c2: c};
      this.root.focus();
      this.render();
      // Drag to select a block.
      const move = (ev) => {
        const t = document.elementFromPoint(ev.clientX, ev.clientY);
        const over = t && t.closest && t.closest("td[data-r]");
        if (!over || !this.table.contains(over)) return;
        const r2 = Number(over.dataset.r), c2 = Number(over.dataset.c);
        if (r2 !== this.sel.r2 || c2 !== this.sel.c2) { this.sel.r2 = r2; this.sel.c2 = c2; this.render(); }
      };
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }

    move(dr, dc, extend = false) {
      const m = this.model;
      const visible = G.visibleRows(m, this.vals);
      const rowPos = (r) => Math.max(0, visible.indexOf(r));
      if (extend) {
        const i = Math.min(visible.length - 1, Math.max(0, rowPos(this.sel.r2) + dr));
        this.sel.r2 = visible[i];
        this.sel.c2 = Math.min(m.cols.length - 1, Math.max(0, this.sel.c2 + dc));
      } else {
        const i = Math.min(visible.length - 1, Math.max(0, rowPos(this.sel.r) + dr));
        const r = visible[i], c = Math.min(m.cols.length - 1, Math.max(0, this.sel.c + dc));
        this.sel = {r, c, r2: r, c2: c};
      }
      this.render();
      const cell = this.table.querySelector(`td[data-r="${this.sel.r2}"][data-c="${this.sel.c2}"]`);
      if (cell && cell.scrollIntoView) cell.scrollIntoView({block: "nearest", inline: "nearest"});
    }

    /* ---------------------------------------------------------- keyboard */

    onKey(e) {
      if (this.editing) return;            // the cell's own box handles keys
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (this.blockSelected) {
        if ((k === "Delete" || k === "Backspace") && this.canEdit()) {
          e.preventDefault(); this.removeSelf(); return;
        }
        if (k === "Escape") { e.preventDefault(); this.selectBlock(false); return; }
        this.selectBlock(false);           // any other key goes back to cells
      }
      const nav = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]};
      if (nav[k]) { e.preventDefault(); this.move(...nav[k], e.shiftKey); return; }
      if (k === "Tab") { e.preventDefault(); this.move(0, e.shiftKey ? -1 : 1); return; }
      if (k === "Enter") { e.preventDefault(); this.move(e.shiftKey ? -1 : 1, 0); return; }
      if (!this.canEdit()) return;
      if (ctrl && k.toLowerCase() === "d") { e.preventDefault(); this.act("fill-down"); return; }
      if (ctrl && k.toLowerCase() === "b") { e.preventDefault(); this.act("bold"); return; }
      if (ctrl && k.toLowerCase() === "i") { e.preventDefault(); this.act("italic"); return; }
      if (ctrl && k.toLowerCase() === "r") { e.preventDefault(); this.act("fill-right"); return; }
      if (k === "F2") { e.preventDefault(); this.startEdit(false); return; }
      /* Escape steps out of the cells and chooses the whole grid, so it can
         be removed from the keyboard alone. */
      if (k === "Escape") { e.preventDefault(); this.selectBlock(true); return; }
      if (k === "Delete" || k === "Backspace") { e.preventDefault(); this.clearSelection(); return; }
      if (!ctrl && !e.altKey && k.length === 1) {
        e.preventDefault();
        this.startEdit(true, k);           // typing replaces, as in Excel
      }
    }

    /* ---------------------------------------------------------- editing */

    startEdit(replace, firstChar = "") {
      if (!this.canEdit()) return;
      const {r, c} = this.sel;
      const td = this.table.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
      if (!td) return;
      const input = document.createElement("input");
      input.className = "ssg-edit";
      input.spellcheck = false;
      input.value = replace ? firstChar : ((this.model.rows[r] || [])[c] || "");
      td.textContent = "";
      td.appendChild(input);
      this.editing = {r, c, input};
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      input.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); this.commitEdit(); this.move(e.shiftKey ? -1 : 1, 0); this.root.focus(); }
        else if (e.key === "Tab") { e.preventDefault(); this.commitEdit(); this.move(0, e.shiftKey ? -1 : 1); this.root.focus(); }
        else if (e.key === "Escape") { e.preventDefault(); this.editing = null; this.render(); this.root.focus(); }
      });
      input.addEventListener("input", () => { this.formula.value = input.value; });
      input.addEventListener("blur", () => { if (this.editing && this.editing.input === input) this.commitEdit(); });
    }

    commitEdit() {
      const ed = this.editing;
      if (!ed) return;
      this.editing = null;
      const before = (this.model.rows[ed.r] || [])[ed.c] || "";
      if (ed.input.value !== before) {
        this.setCell(ed.r, ed.c, ed.input.value);
        this.commit();
      } else {
        this.render();
      }
    }

    commitFormulaBar() {
      if (!this.canEdit()) return;
      const {r, c} = this.sel;
      const before = (this.model.rows[r] || [])[c] || "";
      if (this.formula.value !== before) { this.setCell(r, c, this.formula.value); this.commit(); }
    }

    clearSelection() {
      const [r1, r2, c1, c2] = this.bounds();
      let changed = false;
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        if (this.model.rows[r][c] !== "") { this.model.rows[r][c] = ""; changed = true; }
      }
      if (changed) this.commit();
    }

    /* ------------------------------------------------------ the toolbar */

    act(what) {
      const m = this.model;
      const [r1, r2, c1, c2] = this.bounds();
      switch (what) {
        case "row-add":
          m.rows.splice(r2 + 1, 0, Array(m.cols.length).fill(""));
          this.sel = {r: r2 + 1, c: c1, r2: r2 + 1, c2: c1};
          break;
        case "col-add":
          m.cols.splice(c2 + 1, 0, {w: 110});
          m.rows.forEach((row) => row.splice(c2 + 1, 0, ""));
          this.sel = {r: r1, c: c2 + 1, r2: r1, c2: c2 + 1};
          break;
        case "row-del":
          if (m.rows.length - (r2 - r1 + 1) < 1) return;
          m.rows.splice(r1, r2 - r1 + 1);
          m.freeze = Math.min(m.freeze, m.rows.length);
          this.sel = {r: Math.min(r1, m.rows.length - 1), c: c1, r2: Math.min(r1, m.rows.length - 1), c2: c1};
          break;
        case "col-del":
          if (m.cols.length - (c2 - c1 + 1) < 1) return;
          m.cols.splice(c1, c2 - c1 + 1);
          m.rows.forEach((row) => row.splice(c1, c2 - c1 + 1));
          this.sel = {r: r1, c: Math.min(c1, m.cols.length - 1), r2: r1, c2: Math.min(c1, m.cols.length - 1)};
          break;
        case "fill-down": {
          if (r2 === r1) return;
          for (let c = c1; c <= c2; c++) {
            // The seed is the filled cells at the top of the selection:
            // 1, 2 then blanks continues 3, 4 …
            const col = [];
            for (let r = r1; r <= r2; r++) col.push(m.rows[r][c]);
            let n = 0;
            while (n < col.length && col[n] !== "") n++;
            if (!n) continue;
            const seed = col.slice(0, n);
            const out = G.fillSeries(seed, col.length - n, "down");
            out.forEach((v, k) => { m.rows[r1 + n + k][c] = v; });
          }
          break;
        }
        case "fill-right": {
          if (c2 === c1) return;
          for (let r = r1; r <= r2; r++) {
            const row = m.rows[r].slice(c1, c2 + 1);
            let n = 0;
            while (n < row.length && row[n] !== "") n++;
            if (!n) continue;
            const out = G.fillSeries(row.slice(0, n), row.length - n, "right");
            out.forEach((v, k) => { m.rows[r][c1 + n + k] = v; });
          }
          break;
        }
        case "freeze":
          m.freeze = m.freeze > 0 ? 0 : 1;
          break;
        case "remove": this.removeSelf(); return;
        case "bold": case "italic": {
          const key = what === "bold" ? "b" : "i";
          const on = !(m.fmt[G.refName(this.sel.c, this.sel.r)] || {})[key];
          this.setFmt({[key]: on || null}); return;
        }
        case "align-left": this.setFmt({align: null}); return;
        case "align-center": this.setFmt({align: "center"}); return;
        case "align-right": this.setFmt({align: "right"}); return;
        case "sort-asc": case "sort-desc":
          this.model = G.sortRows(m, this.sel.c, what === "sort-asc" ? "asc" : "desc");
          this.sel = {r: this.model.freeze, c: this.sel.c, r2: this.model.freeze, c2: this.sel.c};
          break;
        default:
          return;
      }
      this.commit();
    }

    /* ------------------------------------------------------ the clipboard */

    /** Copies what you SEE — the values, formatted — so pasting into Excel
        or a message gives numbers, not this grid's formulas pointing at
        cells that do not exist there. */
    onCopy(e, cut) {
      if (this.editing) return;
      const [r1, r2, c1, c2] = this.bounds();
      const rows = [];
      for (let r = r1; r <= r2; r++) {
        const row = [];
        for (let c = c1; c <= c2; c++) {
          const f = this.model.fmt[G.refName(c, r)] || {};
          row.push(G.display(this.vals[r][c], f.num));
        }
        rows.push(row);
      }
      e.preventDefault();
      if (e.clipboardData) e.clipboardData.setData("text/plain", G.toTSV(rows));
      if (cut && this.canEdit()) this.clearSelection();
    }

    /** Excel's copied cells arrive as tab-separated text; they land from
        the selected cell, and the grid grows to fit them. */
    onPaste(e) {
      if (this.editing || !this.canEdit()) return;
      const text = e.clipboardData && e.clipboardData.getData("text/plain");
      if (text == null) return;
      e.preventDefault();
      const rows = G.fromTSV(text);
      if (!rows.length) return;
      const {r, c} = this.sel;
      rows.forEach((row, i) => row.forEach((v, j) => this.setCell(r + i, c + j, v)));
      this.sel = {r, c, r2: r + rows.length - 1,
                  c2: c + Math.max(...rows.map((x) => x.length)) - 1};
      this.commit();
    }

    /* ----------------------------------------------------- column widths */

    startResize(e, c) {
      if (!this.canEdit()) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX, startW = this.model.cols[c].w;
      const colEl = this.table.querySelectorAll("colgroup col")[c + 1];
      const move = (ev) => {
        const w = Math.max(40, Math.round(startW + ev.clientX - startX));
        this.model.cols[c].w = w;
        if (colEl) colEl.style.width = w + "px";      // live, without a full redraw
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        if (this.model.cols[c].w !== startW) this.commit();
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }

    drawChart(vals) {
      const ch = this.model.chart;
      if (!ch) { this.chartEl.hidden = true; this.chartEl.innerHTML = ""; return; }
      const data = G.chartData(this.model, vals);
      this.chartEl.hidden = false;
      this.chartEl.innerHTML = G.chartSVG(data, {width: 680, height: 260})
        + (this.canEdit() ? `<button type="button" class="ssg-chart-x" title="Remove the chart">Remove chart</button>` : "");
      const x = this.chartEl.querySelector(".ssg-chart-x");
      if (x) x.onclick = () => { this.model.chart = null; this.commit(); };
    }

    /** Take the whole grid out of the note.

        Cam: "i found a bug in vaults app i cant delete it. I want to be able
        to select and click delete." Deleting a grid meant putting the caret
        exactly after it and pressing Backspace -- and clicking the grid and
        pressing Delete cleared CELLS instead, because the grid keeps those
        keys to itself. So there are now two plain ways: this button, and
        selecting the grid as a block (click its frame) then Delete.

        Nothing is lost for good: removing it is one edit to the note, so
        Ctrl+Z brings it back, grid and all. */
    removeSelf() {
      const holder = this.holder;
      holder._ssGrid = null;
      holder.remove();
      if (this.opts.onChange) this.opts.onChange();
    }

    /** The whole grid chosen as one block, ready for Delete. */
    selectBlock(on) {
      this.blockSelected = !!on;
      this.root.classList.toggle("is-block-selected", this.blockSelected);
      if (this.blockSelected) this.root.focus();
    }

    /** Apply format keys to every selected cell. null removes a key, so a
        cell with nothing left carries no entry in the saved text at all. */
    setFmt(patch) {
      const [r1, r2, c1, c2] = this.bounds();
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const key = G.refName(c, r);
        const f = Object.assign({}, this.model.fmt[key] || {}, patch);
        for (const k of Object.keys(f)) if (f[k] === null || f[k] === undefined) delete f[k];
        if (Object.keys(f).length) this.model.fmt[key] = f;
        else delete this.model.fmt[key];
      }
      this.commit();
    }

    /* ------------------------------------------------------ small panels */

    closePop() { this.pop.hidden = true; this.pop.innerHTML = ""; }

    openPop(kind, anchor) {
      if (!this.pop.hidden && this.pop.dataset.kind === kind) { this.closePop(); return; }
      this.pop.dataset.kind = kind;
      const m = this.model;
      const col = this.sel.c;
      if (kind === "fill" || kind === "text") {
        const key = kind === "fill" ? "bg" : "color";
        this.pop.innerHTML = `<div class="ssg-pop-h">${kind === "fill" ? "Fill colour" : "Text colour"}</div>
          <div class="ssg-swatches">${SWATCHES.map((c) =>
            `<button type="button" class="ssg-sw" data-col="${c}" style="background:${c}" title="${c}"></button>`).join("")}</div>
          <button type="button" class="ssg-pop-btn" data-col="">No colour</button>`;
        this.pop.onclick = (e) => {
          const b = e.target.closest("[data-col]"); if (!b) return;
          this.closePop(); this.setFmt({[key]: b.dataset.col || null});
        };
      } else if (kind === "filter") {
        const f = m.filter && m.filter.col === col ? m.filter : {op: "=", value: ""};
        this.pop.innerHTML = `<div class="ssg-pop-h">Show rows where column ${G.colName(col)}</div>
          ${opSelect(f.op)}<input class="ssg-pop-val" value="${esc(f.value || "")}" placeholder="value">
          <div class="ssg-pop-row"><button type="button" class="ssg-pop-btn is-primary" data-go="apply">Filter</button>
          <button type="button" class="ssg-pop-btn" data-go="clear">Show all rows</button></div>
          <p class="ssg-pop-note">Filtering only hides rows — it never deletes any.</p>`;
        this.pop.onclick = (e) => {
          const go = e.target.closest("[data-go]"); if (!go) return;
          if (go.dataset.go === "clear") m.filter = null;
          else m.filter = {col, op: this.pop.querySelector(".ssg-pop-op").value,
                           value: this.pop.querySelector(".ssg-pop-val").value};
          this.closePop(); this.commit();
        };
      } else if (kind === "rules") {
        const [r1, r2, c1, c2] = this.bounds();
        const range = G.refName(c1, r1) + (r1 === r2 && c1 === c2 ? "" : ":" + G.refName(c2, r2));
        const list = (m.cond || []).map((rule, i) => `<div class="ssg-rule">
            <span class="ssg-rule-sw" style="background:${esc(rule.bg || "transparent")};color:${esc(rule.color || "inherit")}">Aa</span>
            ${esc(rule.range)}: ${esc(rule.op)} ${esc(rule.value || "")}
            <button type="button" class="ssg-rule-x" data-del="${i}" title="Remove this rule">×</button></div>`).join("");
        this.pop.innerHTML = `<div class="ssg-pop-h">Colour ${esc(range)} automatically</div>
          ${opSelect(">")}<input class="ssg-pop-val" placeholder="e.g. 100">
          <div class="ssg-swatches">${SWATCHES.map((c) =>
            `<button type="button" class="ssg-sw" data-rule-col="${c}" style="background:${c}" title="${c}"></button>`).join("")}</div>
          <p class="ssg-pop-note">Pick a colour to add the rule.</p>
          ${list ? `<div class="ssg-pop-h">Rules in this grid</div>${list}` : ""}`;
        this.pop.onclick = (e) => {
          const del = e.target.closest("[data-del]");
          if (del) { m.cond.splice(Number(del.dataset.del), 1); this.closePop(); this.commit(); return; }
          const sw = e.target.closest("[data-rule-col]"); if (!sw) return;
          m.cond.push({range, op: this.pop.querySelector(".ssg-pop-op").value,
                       value: this.pop.querySelector(".ssg-pop-val").value, bg: sw.dataset.ruleCol});
          this.closePop(); this.commit();
        };
      }
      else if (kind === "chart") {
        const [r1, r2, c1, c2] = this.bounds();
        const many = c2 > c1;
        const block = r2 > r1 || c2 > c1;
        /* A block selected means "chart these cells": the first column names
           the points and the rest are the numbers, as in Excel. With only
           ONE cell selected and a chart already here, the ranges are left
           alone and this just changes its type or title -- changing the type
           should not quietly re-point the chart at whatever cell the cursor
           happens to be on. */
        const keep = !block && this.model.chart;
        const labels = keep ? this.model.chart.labels
          : G.refName(c1, r1) + ":" + G.refName(c1, r2);
        let series;
        if (keep) series = this.model.chart.series;
        else {
          series = [];
          for (let c = many ? c1 + 1 : c1; c <= c2; c++) {
            series.push(G.refName(c, r1) + ":" + G.refName(c, r2));
          }
        }
        this.pop.innerHTML = `<div class="ssg-pop-h">${keep
            ? "This chart" : "Chart " + esc(G.refName(c1, r1)) + ":" + esc(G.refName(c2, r2))}</div>
          <p class="ssg-pop-note">${keep
            ? `Keeping ${esc(labels)} and ${series.length} column${series.length === 1 ? "" : "s"} — select cells first to chart something else.`
            : many
              ? `Column ${G.colName(c1)} names the points; ${series.length} column${series.length === 1 ? "" : "s"} charted.`
              : `One column selected, so the points are numbered.`}</p>
          <input class="ssg-pop-val" placeholder="Title (optional)" value="${esc((this.model.chart || {}).title || "")}">
          <div class="ssg-pop-row">
            <button type="button" class="ssg-pop-btn is-primary" data-chart="bar">Bars</button>
            <button type="button" class="ssg-pop-btn is-primary" data-chart="line">Line</button>
            ${this.model.chart ? `<button type="button" class="ssg-pop-btn" data-chart="">Remove</button>` : ""}
          </div>`;
        this.pop.onclick = (e) => {
          const b = e.target.closest("[data-chart]"); if (!b) return;
          const type = b.dataset.chart;
          this.model.chart = type
            ? {type, labels, series, title: this.pop.querySelector(".ssg-pop-val").value}
            : null;
          this.closePop(); this.commit();
        };
      }
      // Place it under the button that opened it, inside the grid.
      const a = anchor.getBoundingClientRect(), r = this.root.getBoundingClientRect();
      this.pop.style.left = Math.max(0, a.left - r.left) + "px";
      this.pop.style.top = (a.bottom - r.top + 4) + "px";
      this.pop.hidden = false;
      const first = this.pop.querySelector("input, select");
      if (first) first.focus();
    }

    refresh() { this.render(); }
  }

  /* Fills chosen to read in light AND dark themes, a mix of strong and pale
     so the automatic text colour has real work to do on both. */
  const SWATCHES = ["#e8f5e9", "#fff3c4", "#ffe0cc", "#fde2e4", "#e3ecff", "#efe3ff",
                    "#2e7d32", "#f9a825", "#e65100", "#c62828", "#1565c0", "#6a1b9a"];

  function opSelect(selected) {
    const names = {"=": "equals", "<>": "is not", ">": "greater than", "<": "less than",
      ">=": "at least", "<=": "at most", "contains": "contains", "blank": "is blank", "not blank": "is not blank"};
    return `<select class="ssg-pop-op">${G.FILTER_OPS.map((o) =>
      `<option value="${esc(o)}"${o === selected ? " selected" : ""}>${esc(names[o] || o)}</option>`).join("")}</select>`;
  }

  /** Dark or light text for a fill, by WCAG relative luminance: whichever
      of near-black and near-white contrasts more with it. */
  function readableOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255);
    const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const dark = 0.0137, light = 0.9387;         // #1f1f1f and #f7f7f7
    return contrast(L, dark) >= contrast(L, light) ? "#1f1f1f" : "#f7f7f7";
  }

  window.SSGridView = {mount};
})();
