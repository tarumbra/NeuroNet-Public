/* ==========================================================================
   Boards — the editor.

   Cam: "It should have all the tools that the other app has, including
   ability to layer, insert photos from the in built app photo section."

   Drawn as ONE SVG the size of the board. Every item is an element in one
   list, and that list IS the layer order -- last drawn is on top -- so
   "bring to front" is moving an item along a list rather than a separate
   idea that can disagree with what is on screen.

   Nothing is fetched: shapes are SVG, photos are embedded from the library,
   graphs are drawn by Grid's own chart code (SSGrid.chartSVG), so a board
   works with no network exactly like the rest of the app.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const uid = () => "i" + Math.random().toString(36).slice(2, 9);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* The tools, down the left of the canvas like a paint program's toolbar.
     Cam: "when selecting draw have the ability to sellect a pencil
     (freedraw), line tool(draw a straight Line), Arrow(draw a staright line
     with an arrow at the end), a curve(Ability to draw a curved line), i
     reckon we build a side buildbar on the side of the canvas (like a
     photoshop, paint tool bar)."
     Each: key, name, shortcut key, the size a plain click gives (null: only
     drawn), and its group in the toolbar. */
  const TOOLS = [
    ["select", "Select", "V", null, "pick"],
    ["text", "Text", "T", {w: 220, h: 40}, "insert"],
    ["photo", "Photo", "", {w: 320, h: 240}, "insert"],
    ["graph", "Graph", "", {w: 360, h: 240}, "insert"],
    ["rect", "Rectangle", "R", {w: 220, h: 130}, "shape"],
    ["square", "Square", "", {w: 160, h: 160}, "shape"],
    ["ellipse", "Ellipse", "E", {w: 220, h: 140}, "shape"],
    ["circle", "Circle", "", {w: 160, h: 160}, "shape"],
    ["triangle", "Triangle", "", {w: 180, h: 150}, "shape"],
    ["diamond", "Diamond", "", {w: 180, h: 150}, "shape"],
    ["draw", "Pencil", "P", null, "draw"],
    ["line", "Line", "L", null, "draw"],
    ["arrow", "Arrow", "A", null, "draw"],
    ["curve", "Curve", "C", null, "draw"],
  ];
  const GROUPS = [["pick", ""], ["insert", "Insert"], ["shape", "Shapes"], ["draw", "Draw"]];
  const SHAPES = new Set(["rect", "square", "ellipse", "circle", "triangle", "diamond"]);
  const LINES = new Set(["line", "arrow", "curve"]);
  /* Drawing tools stay picked after a stroke, as in any paint program; the
     others go back to Select once the thing is placed. */
  const STICKY = new Set(["draw", "line", "arrow", "curve"]);

  const ICONS = {
    select: '<path d="M6 3l12 9-5.5 1.2L9.5 19z"/>',
    text: '<path d="M5 5h14M12 5v14M9 19h6"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>',
    graph: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
    rect: '<rect x="3.5" y="6" width="17" height="12" rx="1"/>',
    square: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6"/>',
    circle: '<circle cx="12" cy="12" r="7.5"/>',
    triangle: '<path d="M12 4l8.5 15h-17z"/>',
    diamond: '<path d="M12 3l8 9-8 9-8-9z"/>',
    draw: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
    line: '<path d="M5 19L19 5"/>',
    arrow: '<path d="M5 19L19 5M11 5h8v8"/>',
    curve: '<path d="M4 18C8 3 16 21 20 6"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ""}</svg>`;

  const PALETTE = ["#1f2430", "#5b6070", "#9aa0aa", "#ffffff",
                   "#c0392b", "#e67e22", "#d98e04", "#f1c40f",
                   "#2f7d4f", "#27ae60", "#16a085", "#2b6cb0",
                   "#3498db", "#7d4fa8", "#c2185b", "#8d6e63"];
  const WIDTHS = [1, 2, 4, 6, 10];

  /* The colours and line width new things are made with. Cam: "I want to be
     able to select the colours for the line and fill then place it with
     those ... I would like the selected line and fill colour to stay
     persistent until i change them (please include an indicator so i know
     what i have selected)." Kept between boards and between runs. */
  const STYLE_KEY = "nn:boards:style";
  const DEFAULT_STYLE = {stroke: "#1f2430", fill: "#ffffff", sw: 2};
  function loadStyle() {
    try {
      const s = JSON.parse(window.localStorage.getItem(STYLE_KEY) || "null");
      if (s && typeof s.stroke === "string") {
        return {stroke: s.stroke, fill: typeof s.fill === "string" ? s.fill : "none",
                sw: WIDTHS.includes(s.sw) ? s.sw : 2};
      }
    } catch (e) { /* no storage: the defaults */ }
    return {...DEFAULT_STYLE};
  }
  function saveStyle(st) {
    try { window.localStorage.setItem(STYLE_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
  }

  class Editor {
    /* `opts` lets another book open this same editor with its own extras --
       the Scrapbook (ui/scrapbook/) does: Cam, "Scrapbook, which should have
       the same toolbar as boards". Boards passes nothing and is unchanged.
         saveCall   the Api call that writes it ("boards_write")
         backLabel  the back button's words
         bar2       extra buttons for the second bar (HTML)
         panel      a panel to the right of the canvas (HTML)
         wire(ed)   hook those up, once built
         editItem(ed, it)  Edit / double-click on a kind it owns -> true
         dropAt(ed, e, x, y)  something dragged onto the canvas
         photoSrc(url)  a photo's data URL as the book wants to keep it
         photoBox(it)  where a kind it owns shows its photo [x, y, w, h] (a frame's window)
         save(ed)     saves the book itself, in place of saveCall
         overlay(ed)  guides drawn over the page on screen only, never exported
                      (a cover's fold, spine and trim lines) */
    constructor(host, id, board, onBack, opts) {
      this.opts = opts || {};
      this.host = host;
      this.id = id;
      this.board = board;
      this.onBack = onBack;
      this.page = 0;
      this.tool = "select";
      this.sel = new Set();
      this.zoom = 1;
      this.undoStack = [];
      this.saveTimer = null;
      this.style = loadStyle();
      this.target = "stroke";          // which colour the palette sets
      this.curveEdit = null;           // a curve being bent: {it, stage}
      this.repairIds();
      this.upgradeLines();
      this.build();
      this.draw();
    }

    /** Give an id to anything on the board that has not got one.

        Cam: "when working with a mindmap template in boards i cannot move
        the boxes around? Is this and intended feature?" It was not.

        Everything on a board is found by its id: the SVG carries
        data-id, a click reads that attribute back, and startMove looks
        the item up by it. The templates built their shapes without one,
        so every shape in a mind map, a SWOT or a Kanban rendered as
        data-id="" -- esc(undefined) is an empty string -- and the lookup
        that followed found nothing. Selection, moving, recolouring and
        deleting all quietly did nothing. Only a Blank board worked,
        because you draw its shapes yourself and drawing assigns an id.

        Measured before this: seven shapes on a new mind map, every one
        with data-id="", and a 120px drag that moved the box exactly
        0 pixels.

        This runs on open rather than only at creation because Cam
        already has boards saved from those templates, and a fix that
        only helped NEW boards would leave the mind map he is looking at
        just as stuck. Nothing is saved here -- the board is repaired in
        memory and written out with the first real edit, so merely
        opening a board never rewrites it. */
    repairIds() {
      let fixed = 0;
      for (const page of this.board.pages || []) {
        for (const it of page.items || []) {
          if (!it.id) { it.id = uid(); fixed += 1; }
        }
      }
      return fixed;
    }

    /** Lines, arrows and curves are now points you can move one by one
        (Cam: "i can not change the direction of the arrow or line they just
        place a predefined line or arrow that all i can do is resize").
        Boards saved before are given points on open -- exactly the line
        they showed -- in memory only, like repairIds. */
    upgradeLines() {
      for (const page of this.board.pages || []) {
        for (const it of page.items || []) {
          if (LINES.has(it.k) && !Array.isArray(it.pts)) {
            it.pts = ptsOf(it);
            delete it.w; delete it.h;
          }
        }
      }
    }

    items() {
      const pages = this.board.pages || (this.board.pages = [{items: []}]);
      const p = pages[this.page] || (pages[this.page] = {items: []});
      return p.items || (p.items = []);
    }

    /* ------------------------------------------------------------ chrome */

    build() {
      const h = this.host;
      const groups = GROUPS.map(([g, label]) => `
        <div class="bd-tgroup-wrap">
          ${label ? `<div class="bd-tgroup-lbl">${esc(label)}</div>` : ""}
          <div class="bd-tgroup">${TOOLS.filter((t) => t[4] === g).map(([k, name, key]) => `
            <button class="bd-tool ${k === "select" ? "on" : ""}" data-tool="${k}"
              title="${esc(name)}${key ? ` (${key})` : ""}" aria-label="${esc(name)}">${icon(k)}</button>`).join("")}
          </div>
        </div>`).join("");
      h.innerHTML = `
        <div class="bd-ed">
          <div class="bd-ed-bar">
            <button class="btn btn-quiet" id="bd-back">${esc(this.opts.backLabel || "← Boards")}</button>
            <strong class="bd-ed-name">${esc(this.board.name || "Untitled board")}</strong>
            <div class="bd-ed-right">
              <button class="btn btn-quiet" id="bd-zoom-out" title="Zoom out">−</button>
              <span id="bd-zoom">100%</span>
              <button class="btn btn-quiet" id="bd-zoom-in" title="Zoom in">+</button>
              <button class="btn btn-quiet" id="bd-undo" title="Undo (Ctrl+Z)">Undo</button>
              <button class="btn btn-quiet" id="bd-snaps" title="Snapshots of this board">Snapshots</button>
              <button class="btn btn-primary" id="bd-png" title="Save this page to your Photos">Export PNG</button>
            </div>
          </div>
          <div class="bd-ed-bar bd-ed-bar2">
            <span class="bd-lbl">Layer</span>
            <button class="btn btn-quiet" data-layer="front" title="Bring to front">Front</button>
            <button class="btn btn-quiet" data-layer="up" title="Bring forward">Forward</button>
            <button class="btn btn-quiet" data-layer="down" title="Send backward">Backward</button>
            <button class="btn btn-quiet" data-layer="back" title="Send to back">Back</button>
            <span class="bd-sep"></span>
            <!-- Editing a text item must never depend on hitting it with a
                 double-click: the first click redraws the board to show the
                 selection, and a double-click across two different elements
                 is not always delivered. Select it and press this, or Enter. -->
            <button class="btn btn-quiet" id="bd-edit" title="Edit the selected item (Enter)">Edit</button>
            <button class="btn btn-quiet bd-danger" id="bd-delete" title="Delete (Del)">Delete</button>
            <span class="bd-sep"></span>
            ${this.opts.bar2 ? `${this.opts.bar2}<span class="bd-sep"></span>` : ""}
            <!-- Pages. A board is a stack of pages, and a page becomes one
                 slide when the board is exported to PowerPoint. -->
            <span class="bd-pages">
              <button class="btn btn-quiet" id="bd-page-add" title="Add a page">+ Page</button>
              <button class="btn btn-quiet" id="bd-page-prev" title="Previous page">←</button>
              <span id="bd-page-n">1/1</span>
              <button class="btn btn-quiet" id="bd-page-next" title="Next page">→</button>
              <button class="btn btn-quiet bd-danger" id="bd-page-del" title="Delete this page">Delete page</button>
            </span>
          </div>
          <div class="bd-ed-body">
            <aside class="bd-side" role="toolbar" aria-label="Drawing tools">
              ${groups}
              <div class="bd-tgroup-wrap bd-colours">
                <div class="bd-tgroup-lbl">Colours</div>
                <!-- the indicator: line colour in front, fill behind, as in
                     a paint program. Click one to choose what the palette sets. -->
                <div class="bd-wells">
                  <button class="bd-well bd-well-fill" data-target="fill" title="Fill colour — click, then pick a colour"></button>
                  <button class="bd-well bd-well-stroke" data-target="stroke" title="Line colour — click, then pick a colour"></button>
                  <button class="bd-swap" id="bd-swap" title="Swap line and fill colours">⇄</button>
                </div>
                <div class="bd-palette">${PALETTE.map((c) =>
                  `<button class="bd-sw" data-col="${c}" style="background:${c}" title="${c}"></button>`).join("")}
                  <button class="bd-sw bd-sw-none" data-col="none" title="No fill"></button>
                  <label class="bd-sw bd-sw-custom" title="Any colour"><input type="color" id="bd-custom" value="#1f2430"></label>
                </div>
                <div class="bd-tgroup-lbl">Line width</div>
                <div class="bd-widths">${WIDTHS.map((n) =>
                  `<button class="bd-width" data-sw="${n}" title="${n} px"><span style="height:${n}px"></span></button>`).join("")}
                </div>
                <div class="bd-now" id="bd-now"></div>
              </div>
            </aside>
            <div class="bd-stage" id="bd-stage">
              <svg class="bd-canvas" id="bd-canvas"></svg>
            </div>
            ${this.opts.panel || ""}
          </div>
          <p class="bd-hint" id="bd-hint"></p>
        </div>`;
      this.stage = h.querySelector("#bd-stage");
      this.svg = h.querySelector("#bd-canvas");

      h.querySelector("#bd-back").onclick = () => { this.flush(); this.onBack(); };
      h.querySelectorAll("[data-tool]").forEach((b) =>
        b.onclick = () => this.setTool(b.dataset.tool));
      h.querySelectorAll("[data-layer]").forEach((b) =>
        b.onclick = () => this.layer(b.dataset.layer));
      h.querySelectorAll("[data-target]").forEach((b) =>
        b.onclick = () => { this.target = b.dataset.target; this.paintUI(); });
      h.querySelectorAll("[data-col]").forEach((b) =>
        b.onclick = () => this.pickColour(b.dataset.col));
      h.querySelector("#bd-custom").oninput = (e) => this.pickColour(e.target.value);
      h.querySelector("#bd-swap").onclick = () => this.swapColours();
      h.querySelectorAll("[data-sw]").forEach((b) =>
        b.onclick = () => this.pickWidth(Number(b.dataset.sw)));
      h.querySelector("#bd-edit").onclick = () => this.editSelected();
      h.querySelector("#bd-delete").onclick = () => this.removeSelected();
      h.querySelector("#bd-undo").onclick = () => this.undo();
      h.querySelector("#bd-snaps").onclick = () => this.snapshots();
      h.querySelector("#bd-png").onclick = () => this.exportPNG();
      h.querySelector("#bd-page-add").onclick = () => this.addPage();
      h.querySelector("#bd-page-prev").onclick = () => this.goPage(this.page - 1);
      h.querySelector("#bd-page-next").onclick = () => this.goPage(this.page + 1);
      h.querySelector("#bd-page-del").onclick = () => this.deletePage();
      h.querySelector("#bd-zoom-in").onclick = () => this.setZoom(this.zoom + 0.25);
      h.querySelector("#bd-zoom-out").onclick = () => this.setZoom(this.zoom - 0.25);

      this.svg.addEventListener("mousedown", (e) => this.onDown(e));
      this.svg.addEventListener("dblclick", (e) => this.onDouble(e));
      // right-click a photo: move it inside its frame (startReframe)
      this.svg.addEventListener("contextmenu", (e) => e.preventDefault());
      this.svg.addEventListener("wheel", (e) => this.onWheel(e), {passive: false});
      if (this.opts.dropAt) {
        this.svg.addEventListener("dragover", (e) => e.preventDefault());
        this.svg.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();          // the page's own file drop is not for this
          this.opts.dropAt(this, e, ...this.point(e));
        });
      }
      this.keyHandler = (e) => this.onKey(e);
      window.addEventListener("keydown", this.keyHandler);
      this.paintUI();
      this.hint();
      if (this.opts.wire) this.opts.wire(this);
    }

    /* ------------------------------------------------ colours and width */

    /** The indicator and the palette show what is picked right now. */
    paintUI() {
      const h = this.host, st = this.style;
      const fillWell = h.querySelector(".bd-well-fill"), strokeWell = h.querySelector(".bd-well-stroke");
      fillWell.style.setProperty("--c", st.fill === "none" ? "transparent" : st.fill);
      fillWell.classList.toggle("is-none", st.fill === "none");
      strokeWell.style.setProperty("--c", st.stroke);
      fillWell.classList.toggle("on", this.target === "fill");
      strokeWell.classList.toggle("on", this.target === "stroke");
      const now = st[this.target];
      h.querySelectorAll("[data-col]").forEach((b) => b.classList.toggle("on", b.dataset.col === now));
      h.querySelector(".bd-sw-none").disabled = this.target === "stroke";
      h.querySelectorAll("[data-sw]").forEach((b) => b.classList.toggle("on", Number(b.dataset.sw) === st.sw));
      const name = (c) => (c === "none" ? "none" : c);
      h.querySelector("#bd-now").innerHTML =
        `<span><i style="background:${esc(st.stroke)}"></i>Line ${esc(name(st.stroke))}</span>`
        + `<span><i class="${st.fill === "none" ? "is-none" : ""}" style="background:${st.fill === "none" ? "transparent" : esc(st.fill)}"></i>Fill ${esc(name(st.fill))}</span>`
        + `<span>${st.sw} px</span>`;
      if (now && now !== "none" && /^#[0-9a-f]{6}$/i.test(now)) h.querySelector("#bd-custom").value = now;
    }

    /** A colour for what the indicator has chosen (line or fill): kept for
        everything drawn from now on, and given to anything selected. */
    pickColour(col) {
      if (col === "none" && this.target === "stroke") {
        SS.shared.toast("A line needs a colour — “none” is for fills.");
        return;
      }
      this.style[this.target] = col;
      saveStyle(this.style);
      this.paintUI();
      this.paint(this.target, col);
    }

    swapColours() {
      const st = this.style;
      if (st.fill === "none") { SS.shared.toast("Pick a fill colour first — a line needs a colour."); return; }
      [st.stroke, st.fill] = [st.fill, st.stroke];
      saveStyle(st);
      this.paintUI();
    }

    pickWidth(n) {
      this.style.sw = n;
      saveStyle(this.style);
      this.paintUI();
      this.paint("sw", n);
    }

    hint() {
      const el = this.host.querySelector("#bd-hint");
      if (!el) return;
      const t = {
        select: "Click to select, drag to move; drag empty space to select several. Handles resize, "
          + "or move the ends of a line, arrow or curve. Enter edits text. Delete removes. Ctrl+Z undoes.",
        draw: "Pencil: draw freely. The tool stays picked — press V or Escape for Select.",
        line: "Line: press where it starts and drag to where it ends, any direction. Shift keeps it to 15° steps.",
        arrow: "Arrow: press where it starts and drag to the point. Shift keeps it to 15° steps.",
        curve: "Curve: drag from start to end, then drag to bend it — once for an arc, again for an S. "
          + "Enter, Escape or a click finishes. Afterwards its ends and bend points have handles.",
      }[this.tool];
      el.textContent = t || "Drag on the board to size it, or click for a default size. "
        + "It's made in the colours and width shown in the toolbar.";
      if (this.curveEdit) {
        el.textContent = this.curveEdit.stage === 1
          ? "Now drag anywhere to bend the curve (it follows your pointer). Enter or a click finishes."
          : "Drag again to bend the other half into an S — or Enter / a click to finish.";
      }
    }

    setTool(k) {
      if (this.curveEdit) this.finishCurve();
      this.tool = k;
      this.host.querySelectorAll("[data-tool]").forEach((b) =>
        b.classList.toggle("on", b.dataset.tool === k));
      this.stage.classList.toggle("is-drawing", k !== "select");
      this.hint();
    }

    setZoom(z) {
      this.zoom = clamp(Math.round(z * 100) / 100, 0.25, 2);
      this.host.querySelector("#bd-zoom").textContent = Math.round(this.zoom * 100) + "%";
      this.draw();
    }

    /* -------------------------------------------------------------- draw */

    draw() {
      const b = this.board;
      const w = b.w || 1600, h = b.h || 1000;
      this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      this.svg.setAttribute("width", Math.round(w * this.zoom));
      this.svg.setAttribute("height", Math.round(h * this.zoom));
      const paper = paperSVG(b, w, h, (b.pages || [])[this.page], true);

      /* In list order: the last item is drawn last and so sits on top. That
         is the whole of "layering" -- one list, one truth. */
      const typing = this.typing && this.typing.it;
      const body = this.items().map((it) => (it === typing ? "" : itemSVG(it))).join("");
      const marks = [...this.sel].map((id) => {
        const it = this.items().find((x) => x.id === id);
        if (!it) return "";
        /* a line, arrow or curve: a handle on each end (and on each bend point
           of a curve), so it can point anywhere and bend any way */
        if (Array.isArray(it.pts)) {
          const P = it.pts;
          const guides = it.k === "curve" && P.length === 4
            ? `<line x1="${P[0][0]}" y1="${P[0][1]}" x2="${P[1][0]}" y2="${P[1][1]}" stroke="#2b6cb0" stroke-dasharray="4 3"/>
               <line x1="${P[3][0]}" y1="${P[3][1]}" x2="${P[2][0]}" y2="${P[2][1]}" stroke="#2b6cb0" stroke-dasharray="4 3"/>` : "";
          return `<g class="bd-selmark">${guides}${P.map(([px, py], i) => {
            const bend = it.k === "curve" && (i === 1 || i === 2);
            return bend
              ? `<rect class="bd-pt bd-pt-bend" data-pt="${esc(id)}|${i}" x="${px - 6}" y="${py - 6}" width="12" height="12"
                   fill="#ffffff" stroke="#2b6cb0" stroke-width="2" transform="rotate(45 ${px} ${py})"/>`
              : `<circle class="bd-pt" data-pt="${esc(id)}|${i}" cx="${px}" cy="${py}" r="7"
                   fill="#2b6cb0" stroke="#ffffff" stroke-width="2"/>`;
          }).join("")}</g>`;
        }
        const [x, y, w2, h2] = boxOf(it);
        return `<g class="bd-selmark"><rect x="${x - 4}" y="${y - 4}" width="${w2 + 8}" height="${h2 + 8}"
          fill="none" stroke="#2b6cb0" stroke-width="2" stroke-dasharray="6 4"/>
          <rect class="bd-handle" data-handle="${esc(id)}" x="${x + w2 - 6}" y="${y + h2 - 6}"
            width="14" height="14" fill="#2b6cb0"/></g>`;
      }).join("");
      let ghost = "";
      if (this.reframe) {
        const r = this.reframe, g = photoGeo(r, this.photoBox(r)), [bx, by, bw, bh] = this.photoBox(r);
        const turn = r.rot ? ` transform="rotate(${Number(r.rot) || 0} ${boxOf(r)[0] + boxOf(r)[2] / 2} ${boxOf(r)[1] + boxOf(r)[3] / 2})"` : "";
        // the rest of the photo, faint, around the window -- not over it
        ghost = `<g class="bd-reframe" pointer-events="none"${turn}>${g ? `<mask id="bd-rf-mask">
            <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="#fff"/>
            <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#000"/></mask>
          <image x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" href="${esc(r.src)}"
            preserveAspectRatio="none" opacity="0.4" mask="url(#bd-rf-mask)"/>` : ""}
          <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="#e8a33d" stroke-width="3"/></g>`;
      }
      const guides = this.opts.overlay ? `<g pointer-events="none">${this.opts.overlay(this) || ""}</g>` : "";
      this.svg.innerHTML = paper + body + guides + marks + ghost + (this.marquee || "");
      const n = this.host.querySelector("#bd-page-n");
      if (n) n.textContent = `${this.page + 1}/${(this.board.pages || []).length}`;
    }

    /* --------------------------------------------------------- pointing */

    point(e) {
      const r = this.svg.getBoundingClientRect();
      return [Math.round((e.clientX - r.left) / this.zoom), Math.round((e.clientY - r.top) / this.zoom)];
    }

    onDown(e) {
      const [x, y] = this.point(e);
      if (this.curveEdit) { this.bendCurve(x, y); return; }
      if (this.reframe) {
        if (this.itemAt(x, y) === this.reframe) { e.preventDefault(); this.panPhoto(this.reframe, x, y); return; }
        this.endReframe();                 // a click anywhere else: done
      }
      if (e.button === 2) {
        const it = this.itemAt(x, y);
        if (it && it.src && this.tool === "select") { e.preventDefault(); this.startReframe(it); this.panPhoto(it, x, y); }
        return;
      }
      /* A double-click, seen HERE rather than waiting for the browser's.
         The first click redraws the board (the selection), the element under
         the pointer is replaced, and the browser often never counts a second
         click -- Cam (2026-10-02): "Scrapbook has an issue when i double click
         to add photo it doesnt work". Two presses on one spot in 450 ms is a
         double-click once it's let go without moving (pressed again and
         dragged, it's still a move); the browser's own, if it does come, is
         then ignored. */
      let double = null;
      if (e.button === 0 && this.tool === "select" && !e.shiftKey) {
        const now = Date.now(), p = this.lastDown;
        this.lastDown = {t: now, x, y};
        if (p && now - p.t < 450 && Math.abs(x - p.x) < 8 && Math.abs(y - p.y) < 8) {
          const it = this.itemAt(x, y);
          if (it) {
            this.lastDown = null;
            double = () => { this.doubled = Date.now(); this.sel = new Set([it.id]); this.draw(); this.openItem(it); };
          }
        }
      }
      const pt = e.target.closest("[data-pt]");
      if (pt) {
        const [id, i] = pt.dataset.pt.split("|");
        this.startPoint(id, Number(i), x, y);
        return;
      }
      const handle = e.target.closest("[data-handle]");
      if (handle) { this.startResize(handle.dataset.handle, x, y); return; }

      if (this.tool === "select") {
        const hit = e.target.closest("[data-id]");
        if (hit) {
          const id = hit.dataset.id;
          const item = this.items().find((i) => i.id === id);
          // a second click on a selected text box types in it (no drag)
          const typeIn = !e.shiftKey && item && item.k === "text" && this.sel.size === 1 && this.sel.has(id);
          if (e.shiftKey) this.sel.has(id) ? this.sel.delete(id) : this.sel.add(id);
          else if (!this.sel.has(id)) this.sel = new Set([id]);
          this.draw();
          this.startMove(x, y, double || (typeIn ? () => this.typeInto(item) : null));
        } else if (double) {
          double();                // on the item, though not on its drawing (a frame's empty window)
        } else {
          this.sel = new Set();
          this.startMarquee(x, y);
        }
        return;
      }
      if (this.tool === "draw") { this.startFreehand(x, y); return; }
      if (this.tool === "line" || this.tool === "arrow") { this.startLine(x, y, e.shiftKey); return; }
      if (this.tool === "curve") { this.startCurve(x, y); return; }
      this.startCreate(x, y);
    }

    startMove(x0, y0, onClick) {
      const start = [...this.sel].map((id) => {
        const it = this.items().find((i) => i.id === id);
        return it && {it, x: it.x, y: it.y, points: it.points && it.points.map((p) => p.slice()),
                      pts: it.pts && it.pts.map((p) => p.slice())};
      }).filter(Boolean);
      if (!start.length) return;
      this.push();
      const move = (ev) => {
        const [x, y] = this.point(ev);
        for (const s of start) {
          s.it.x = s.x + (x - x0);
          s.it.y = s.y + (y - y0);
          if (s.points) s.it.points = s.points.map(([px, py]) => [px + (x - x0), py + (y - y0)]);
          if (s.pts) s.it.pts = s.pts.map(([px, py]) => [px + (x - x0), py + (y - y0)]);
        }
        if (x !== x0 || y !== y0) moved = true;
        this.draw();
      };
      let moved = false;
      this.dragUntilUp(move, () => {
        if (!moved) { this.undoStack.pop(); if (onClick) onClick(); }   // a click, not a move
      });
    }

    startResize(id, x0, y0) {
      const it = this.items().find((i) => i.id === id);
      if (!it) return;
      this.push();
      if (Array.isArray(it.points)) {          // a pencil stroke: scaled from its corner
        const [bx, by, bw, bh] = boxOf(it), pts0 = it.points.map((p) => p.slice());
        this.dragUntilUp((ev) => {
          const [x, y] = this.point(ev);
          const sx = Math.max(8, bw + (x - x0)) / bw, sy = Math.max(8, bh + (y - y0)) / bh;
          it.points = pts0.map(([px, py]) => [Math.round(bx + (px - bx) * sx), Math.round(by + (py - by) * sy)]);
          this.draw();
        });
        return;
      }
      const w0 = it.w || 0, h0 = it.h || 0;
      const move = (ev) => {
        const [x, y] = this.point(ev);
        it.w = Math.max(8, w0 + (x - x0));
        it.h = Math.max(it.k === "line" || it.k === "arrow" ? -4000 : 8, h0 + (y - y0));
        if (it.k === "square" || it.k === "circle") it.h = it.w;   // stays square
        this.draw();
      };
      this.dragUntilUp(move);
    }

    startMarquee(x0, y0) {
      const move = (ev) => {
        const [x, y] = this.point(ev);
        const box = [Math.min(x0, x), Math.min(y0, y), Math.abs(x - x0), Math.abs(y - y0)];
        this.marquee = `<rect class="bd-marquee" x="${box[0]}" y="${box[1]}" width="${box[2]}"
          height="${box[3]}" fill="#2b6cb022" stroke="#2b6cb0" stroke-dasharray="5 4"/>`;
        this.sel = new Set(this.items().filter((it) => overlaps(boxOf(it), box)).map((it) => it.id));
        this.draw();
      };
      this.dragUntilUp(move, () => { this.marquee = ""; this.draw(); });
    }

    startCreate(x0, y0) {
      const def = (TOOLS.find(([k]) => k === this.tool) || [])[3] || {w: 160, h: 120};
      const st = this.style;               // the colours and width in the toolbar
      const it = {id: uid(), k: this.tool, x: x0, y: y0, w: def.w, h: def.h,
                  stroke: st.stroke, fill: SHAPES.has(this.tool) ? st.fill : "none", sw: st.sw};
      if (this.tool === "text") { it.text = ""; it.size = 20; it.fill = "none"; }
      this.push();
      this.items().push(it);                  // pushed last: new things sit on top
      let dragged = false;
      const move = (ev) => {
        const [x, y] = this.point(ev);
        if (Math.abs(x - x0) > 3 || Math.abs(y - y0) > 3) dragged = true;
        if (!dragged) return;
        {
          it.x = Math.min(x0, x); it.y = Math.min(y0, y);
          it.w = Math.max(8, Math.abs(x - x0)); it.h = Math.max(8, Math.abs(y - y0));
          if (it.k === "square" || it.k === "circle") it.h = it.w;
        }
        this.draw();
      };
      this.dragUntilUp(move, () => {
        this.sel = new Set([it.id]);
        this.setTool("select");
        if (it.k === "photo") this.choosePhoto(it);
        if (it.k === "text") this.typeInto(it, true);
        this.changed();
      });
      this.draw();
    }

    /** Pencil: a free stroke in the toolbar's line colour and width, drawn
        smooth (drawPath). The tool stays picked for the next stroke. */
    startFreehand(x0, y0) {
      const it = {id: uid(), k: "draw", x: x0, y: y0, points: [[x0, y0]],
                  stroke: this.style.stroke, fill: "none", sw: this.style.sw};
      this.push();
      this.items().push(it);
      const move = (ev) => {
        const [x, y] = this.point(ev);
        const last = it.points[it.points.length - 1];
        if (Math.abs(x - last[0]) + Math.abs(y - last[1]) < 2) return;   // no jitter
        it.points.push([x, y]);
        this.draw();
      };
      this.dragUntilUp(move, () => {
        if (it.points.length === 1) it.points.push([x0 + 1, y0 + 1]);   // a dot
        this.changed();
      });
    }

    /** Line and Arrow: pressed at one end, dragged to the other -- any
        direction. Shift keeps it to 15° steps. A plain click makes a
        200-pixel line to the right. */
    startLine(x0, y0) {
      const st = this.style;
      const it = {id: uid(), k: this.tool, pts: [[x0, y0], [x0, y0]], stroke: st.stroke, fill: "none", sw: st.sw};
      this.push();
      this.items().push(it);
      let dragged = false;
      const move = (ev) => {
        let [x, y] = this.point(ev);
        if (Math.abs(x - x0) + Math.abs(y - y0) > 3) dragged = true;
        if (!dragged) return;
        if (ev.shiftKey) [x, y] = snapAngle(x0, y0, x, y);
        it.pts[1] = [x, y];
        this.draw();
      };
      this.dragUntilUp(move, () => {
        if (!dragged) it.pts[1] = [x0 + 200, y0];
        this.sel = new Set([it.id]);
        this.draw();
        this.changed();
      });
      this.draw();
    }

    /** Curve, like a paint program's: drag the line from start to end, then
        drag to bend it (the curve passes through the pointer), then drag once
        more for an S. Enter, Escape or a plain click finishes; afterwards its
        ends and bend points all have handles. Cam: "Need more freedom with
        the curve tool." */
    startCurve(x0, y0) {
      const st = this.style;
      const it = {id: uid(), k: "curve", pts: [[x0, y0], [x0, y0], [x0, y0], [x0, y0]],
                  stroke: st.stroke, fill: "none", sw: st.sw};
      this.push();
      this.items().push(it);
      let dragged = false;
      const move = (ev) => {
        let [x, y] = this.point(ev);
        if (Math.abs(x - x0) + Math.abs(y - y0) > 3) dragged = true;
        if (!dragged) return;
        if (ev.shiftKey) [x, y] = snapAngle(x0, y0, x, y);
        it.pts = straightCurve([x0, y0], [x, y]);
        this.draw();
      };
      this.dragUntilUp(move, () => {
        if (!dragged) it.pts = straightCurve([x0, y0], [x0 + 220, y0]);
        this.curveEdit = {it, stage: 1};
        this.sel = new Set([it.id]);
        this.draw();
        this.hint();
      });
      this.draw();
    }

    bendCurve(x0, y0) {
      const ce = this.curveEdit, it = ce.it;
      if (!this.items().includes(it)) { this.finishCurve(); return; }
      let dragged = false;
      const move = (ev) => {
        const [x, y] = this.point(ev);
        if (Math.abs(x - x0) + Math.abs(y - y0) > 3) dragged = true;
        if (!dragged) return;
        const [p0, c1, , p1] = it.pts;
        if (ce.stage === 1) {
          // one bend point for both halves, placed so the middle of the curve is the pointer
          const c = [(x - 0.125 * (p0[0] + p1[0])) / 0.75, (y - 0.125 * (p0[1] + p1[1])) / 0.75];
          it.pts = [p0, c.slice(), c.slice(), p1];
        } else {
          // the second half on its own: an S
          const c2 = [(x - 0.125 * p0[0] - 0.375 * c1[0] - 0.125 * p1[0]) / 0.375,
                      (y - 0.125 * p0[1] - 0.375 * c1[1] - 0.125 * p1[1]) / 0.375];
          it.pts = [p0, c1, c2, p1];
        }
        it.pts = it.pts.map(([px, py]) => [Math.round(px), Math.round(py)]);
        this.draw();
      };
      this.dragUntilUp(move, () => {
        if (!dragged || ce.stage >= 2) { this.finishCurve(); return; }
        ce.stage += 1;
        this.hint();
      });
    }

    finishCurve() {
      const ce = this.curveEdit;
      this.curveEdit = null;
      if (ce) { this.sel = new Set([ce.it.id]); this.draw(); this.changed(); }
      this.hint();
    }

    /** One end (or bend point) of a line, arrow or curve, dragged. Moving a
        curve's end takes its bend point along, so the curve keeps its shape. */
    startPoint(id, i, x0, y0) {
      const it = this.items().find((x) => x.id === id);
      if (!it || !Array.isArray(it.pts) || !it.pts[i]) return;
      this.push();
      const p0 = it.pts.map((p) => p.slice());
      const [sx, sy] = p0[i];
      const partner = it.k === "curve" ? (i === 0 ? 1 : i === 3 ? 2 : -1) : -1;
      const other = it.k === "curve" ? null : p0[i === 0 ? 1 : 0];
      const move = (ev) => {
        const [x, y] = this.point(ev);
        let nx = sx + (x - x0), ny = sy + (y - y0);
        if (ev.shiftKey && other) [nx, ny] = snapAngle(other[0], other[1], nx, ny);
        it.pts[i] = [nx, ny];
        if (partner >= 0) it.pts[partner] = [p0[partner][0] + (nx - sx), p0[partner][1] + (ny - sy)];
        this.draw();
      };
      this.dragUntilUp(move);
    }

    dragUntilUp(move, done) {
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        if (done) done();
        this.changed();
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }

    /** Which item is under the pointer, topmost first -- worked out from
        POSITION, not from the event's target.

        The first click of a double-click redraws the board to show the
        selection, so the second click lands on a brand new element. When the
        two clicks have different targets the browser reports the double-click
        on the container, which carries no item, and double-clicking text did
        nothing at all. */
    itemAt(x, y) {
      const list = this.items();
      for (let i = list.length - 1; i >= 0; i--) {
        const [bx, by, bw, bh] = boxOf(list[i]);
        if (x >= bx - 4 && x <= bx + bw + 4 && y >= by - 4 && y <= by + bh + 4) return list[i];
      }
      return null;
    }

    onDouble(e) {
      if (Date.now() - (this.doubled || 0) < 700) return;   // onDown saw it already
      const it = this.itemAt(...this.point(e));
      if (it) this.openItem(it);
    }

    /** A double-click on an item: words to type, a photo to choose. */
    openItem(it) {
      if (this.opts.editItem && this.opts.editItem(this, it)) return;
      if (it.k === "text") this.typeInto(it);
      else if (it.k === "photo") this.choosePhoto(it);
    }

    /* ---------------------------------- moving a photo inside its frame

       Cam (2026-10-02): "if i right click the photo i can move the photo
       around to choose the focus. I think canva handles this similar."
       Right-click a photo (or a frame with one): the whole photo shows faintly
       around the frame, drag it to choose what shows, scroll to zoom in. A
       click anywhere else, Esc or Enter, and it's done -- one undo. Kept on
       the item: fx / fy, where the frame sits over the photo (0..1 across
       what's left over), and zoom (1 = just fills it). */
    photoBox(it) {
      return (this.opts.photoBox && this.opts.photoBox(it)) || boxOf(it);
    }

    startReframe(it) {
      if (this.reframe === it) return;
      this.endReframe();
      this.reframe = it;
      this.reframeWas = JSON.stringify([it.fx, it.fy, it.zoom]);
      this.push();
      this.sel = new Set([it.id]);
      if (!it.nw) {
        naturalSize(it.src).then((sz) => {
          if (!sz || this.reframe !== it) return;
          it.nw = sz[0]; it.nh = sz[1];
          this.draw();
        });
      }
      this.draw();
      SS.shared.toast("Drag the photo to choose what shows. Scroll to zoom. Esc or click outside when done.");
    }

    endReframe() {
      const it = this.reframe;
      if (!it) return;
      this.reframe = null;
      if (JSON.stringify([it.fx, it.fy, it.zoom]) === this.reframeWas) this.undoStack.pop();
      else this.changed();
      this.draw();
    }

    panPhoto(it, x0, y0) {
      const g = photoGeo(it, this.photoBox(it));
      if (!g) return;
      const fx0 = it.fx == null ? 0.5 : it.fx, fy0 = it.fy == null ? 0.5 : it.fy;
      const move = (ev) => {
        const [x, y] = this.point(ev);
        if (g.ox > 0.5) it.fx = clamp01(fx0 - (x - x0) / g.ox);
        if (g.oy > 0.5) it.fy = clamp01(fy0 - (y - y0) / g.oy);
        this.draw();
      };
      this.dragUntilUp(move);
    }

    onWheel(e) {
      const it = this.reframe;
      if (!it || this.itemAt(...this.point(e)) !== it) return;
      e.preventDefault();
      const z = Math.max(1, Number(it.zoom) || 1) * (e.deltaY < 0 ? 1.1 : 1 / 1.1);
      it.zoom = Math.round(Math.min(5, Math.max(1, z)) * 100) / 100;
      this.draw();
    }

    /** Edit whatever single item is chosen: words for text, a photo for a
        photo. */
    editSelected(inPlace) {
      if (this.sel.size !== 1) {
        SS.shared.toast(this.sel.size ? "Choose one item to edit." : "Choose an item first.");
        return;
      }
      const it = this.items().find((i) => this.sel.has(i.id));
      if (!it) return;
      if (this.opts.editItem && this.opts.editItem(this, it)) return;
      if (it.k === "text") { if (inPlace) this.typeInto(it); else this.editText(it); }
      else if (it.k === "photo") this.choosePhoto(it);
      else SS.shared.toast("That one is changed with the colours and handles.");
    }

    /** Type straight into a text box, where it sits on the board.

        Cam: "when inserting a text box and clicking it i cannot type
        anything it justs shows the placeholder text". Words could only be
        changed in a dialog (Enter, a double-click or Edit). Now a new text box
        takes typing at once, as does a click on a selected one, a
        double-click, or Enter. Enter makes a new line; a click elsewhere,
        Escape or Ctrl+Enter finishes. A new box left empty is removed. The
        Edit button still opens the dialog, which also sets the size. */
    typeInto(it, isNew) {
      this.endTyping();
      if (!it || it.k !== "text") return;
      const z = this.zoom, size = it.size || 20;
      const ta = document.createElement("textarea");
      ta.className = "bd-type";
      ta.value = it.text || "";
      ta.placeholder = "Type here";
      ta.spellcheck = true;
      const left = this.svg.offsetLeft + it.x * z, top = this.svg.offsetTop + it.y * z;
      Object.assign(ta.style, {
        left: left + "px", top: top + "px",
        minWidth: Math.max(160, it.w || 0) * z + "px",
        fontSize: size * z + "px", lineHeight: "1.25",
        color: it.stroke || "#1f2430",
      });
      const fit = () => {
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
        ta.style.width = "auto";
        ta.style.width = Math.max(ta.scrollWidth + 12, Math.max(160, it.w || 0) * z) + "px";
      };
      this.stage.appendChild(ta);
      this.typing = {it, ta, isNew: !!isNew, before: it.text || ""};
      ta.addEventListener("input", fit);
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
          e.preventDefault(); e.stopPropagation(); this.endTyping();
        }
      });
      ta.addEventListener("blur", () => this.endTyping());
      this.draw();                          // the words under the box are hidden while typing
      fit();
      ta.focus();
      ta.select();
    }

    endTyping() {
      const t = this.typing;
      if (!t) return;
      this.typing = null;
      const text = t.ta.value.replace(/\s+$/, "");
      t.ta.remove();
      const list = this.items();
      if (!text.trim() && t.isNew) {
        const i = list.indexOf(t.it);
        if (i >= 0) list.splice(i, 1);
        this.sel = new Set();
      } else if (text !== t.before) {
        if (!t.isNew) this.push();
        t.it.text = text || t.before;
        const lines = t.it.text.split("\n"), size = t.it.size || 20;
        t.it.w = Math.max(40, Math.round(Math.max(...lines.map((l) => l.length)) * size * 0.55));
        t.it.h = Math.round(lines.length * size * 1.25 + size * 0.3);
      }
      this.draw();
      this.changed();
    }

    editText(it) {
      const d = SS.shared.openDlg("Text", `
        <label class="dlg-label" for="bd-text">Words</label>
        <textarea class="input" id="bd-text" rows="4">${esc(it.text || "")}</textarea>
        <label class="dlg-label" for="bd-size">Size</label>
        <input class="input" id="bd-size" type="number" min="8" max="96" value="${it.size || 20}">`);
      d.btn("Cancel", "btn-quiet", d.close);
      d.btn("Save", "btn-save", () => {
        this.push();
        it.text = d.body.querySelector("#bd-text").value;
        it.size = clamp(Number(d.body.querySelector("#bd-size").value) || 20, 8, 96);
        d.close();
        this.draw();
        this.changed();
      });
      const ta = d.body.querySelector("#bd-text");
      ta.focus(); ta.select();
    }

    /** Photos come from the app's own library -- Cam: "insert photos from the
        in built app photo section" -- not from a file dialog, so a board can
        only ever hold a photo that is already in Cam's Collective S. */
    async choosePhoto(it) {
      const photo = await SS.shared.pickFromLibrary({title: "Choose a photo for the board"});
      if (!photo) return;
      await this.usePhoto(it, photo.storedName || photo.stored_name || photo);
    }

    /** A library photo, as the board keeps it: {src, photo, nw, nh} or null. */
    async photoFor(stored) {
      const got = await SS.shared.Store.getPhotoData(stored);
      let url = got && (got.dataUrl || got.url);
      if (!url) { SS.shared.toast("That photo could not be loaded.", "error"); return null; }
      if (this.opts.photoSrc) url = await this.opts.photoSrc(url);
      const sz = await naturalSize(url);
      return {src: url, photo: String(stored || ""), nw: sz ? sz[0] : 0, nh: sz ? sz[1] : 0};
    }

    /** Put a library photo into a photo or a frame (a new photo starts
        centred, at the frame's own fit). */
    async usePhoto(it, stored) {
      const p = await this.photoFor(stored);
      if (!p) return null;
      this.push();
      Object.assign(it, p);
      delete it.fx; delete it.fy; delete it.zoom;
      this.draw();
      this.changed();
      return it;
    }

    /** A library photo onto the page as a photo of its own, its own shape. */
    async addPhoto(stored, at) {
      const p = await this.photoFor(stored);
      if (!p) return null;
      const long = 360, r = p.nw && p.nh ? p.nw / p.nh : 4 / 3;
      const w = r >= 1 ? long : Math.round(long * r), h = r >= 1 ? Math.round(long / r) : long;
      return this.place(Object.assign({k: "photo", w, h}, p), at);
    }

    /* ------------------------------------------------ layering and paint */

    layer(where) {
      const list = this.items();
      const chosen = list.filter((it) => this.sel.has(it.id));
      if (!chosen.length) return;
      this.push();
      for (const it of chosen) {
        const i = list.indexOf(it);
        list.splice(i, 1);
        if (where === "front") list.push(it);
        else if (where === "back") list.unshift(it);
        else if (where === "up") list.splice(Math.min(list.length, i + 1), 0, it);
        else list.splice(Math.max(0, i - 1), 0, it);
      }
      this.draw();
      this.changed();
    }

    paint(which, colour) {
      const chosen = this.items().filter((it) => this.sel.has(it.id));
      if (!chosen.length) return;
      this.push();
      for (const it of chosen) {
        /* clip art is one colour: line or fill, the palette recolours it */
        if (it.k === "clip" && which !== "sw") { if (colour !== "none") it.fill = colour; continue; }
        it[which] = colour;
      }
      this.draw();
      this.changed();
    }

    /** Turn what is chosen by `deg` (a scrapbook's tape sits at an angle).
        Lines and pencil strokes are their points, so they are left alone. */
    rotate(deg) {
      const chosen = this.items().filter((it) => this.sel.has(it.id) && !it.points && !it.pts);
      if (!chosen.length) { SS.shared.toast("Choose something to turn first."); return; }
      this.push();
      for (const it of chosen) it.rot = ((Math.round((it.rot || 0) + deg) % 360) + 360) % 360;
      this.draw();
      this.changed();
    }

    /** Something new, put on the page where asked -- or in the middle of
        what is on screen -- on top, and chosen. */
    place(it, at) {
      it.id = it.id || uid();
      const [cx, cy] = at || this.viewCentre();
      it.x = Math.round(cx - (it.w || 0) / 2);
      it.y = Math.round(cy - (it.h || 0) / 2);
      this.push();
      this.items().push(it);
      this.sel = new Set([it.id]);
      this.setTool("select");
      this.draw();
      this.changed();
      return it;
    }

    /** The middle of the part of the page that is on screen. */
    viewCentre() {
      const b = this.board, st = this.stage;
      const w = b.w || 1600, h = b.h || 1000;
      const vw = st.clientWidth, vh = st.clientHeight;
      if (!vw || !vh) return [w / 2, h / 2];
      return [clamp((st.scrollLeft + vw / 2) / this.zoom, 0, w), clamp((st.scrollTop + vh / 2) / this.zoom, 0, h)];
    }

    removeSelected() {
      if (!this.sel.size) return;
      this.push();
      const keep = this.items().filter((it) => !this.sel.has(it.id));
      this.board.pages[this.page].items = keep;
      this.sel = new Set();
      this.draw();
      this.changed();
    }

    /* ------------------------------------------------------------ pages */

    goPage(i) {
      const pages = this.board.pages || [];
      if (i < 0 || i >= pages.length) return;
      this.page = i;
      this.sel = new Set();
      this.draw();
    }

    addPage() {
      this.push();
      (this.board.pages = this.board.pages || []).splice(this.page + 1, 0, {items: []});
      this.page += 1;
      this.sel = new Set();
      this.draw();
      this.changed(true);
    }

    async deletePage() {
      const pages = this.board.pages || [];
      if (pages.length <= 1) {
        SS.shared.toast("A board keeps at least one page.");
        return;
      }
      const yes = await SS.shared.confirm({
        title: "Delete this page?",
        body: `Page ${this.page + 1} and everything on it will be gone. `
          + "Ctrl+Z puts it back while the board is open.",
        yes: "Delete page"});
      if (!yes) return;
      this.push();
      pages.splice(this.page, 1);
      this.page = Math.max(0, this.page - 1);
      this.sel = new Set();
      this.draw();
      this.changed(true);
    }

    /* -------------------------------------------------------- snapshots */

    /** A snapshot is a copy of every page, kept in the board itself, so it
        travels with the board rather than living somewhere else that can be
        lost. Ten are kept: enough to step back through an afternoon. */
    snapshots() {
      const list = this.board.snapshots || [];
      const rows = list.map((snap, i) => `
        <div class="bd-snap">
          <span>${esc(new Date(snap.at).toLocaleString())} · ${snap.pages.length} page${
            snap.pages.length === 1 ? "" : "s"}</span>
          <button class="btn btn-quiet" data-restore="${i}">Restore</button>
          <button class="btn btn-quiet bd-danger" data-drop="${i}">Remove</button>
        </div>`).join("");
      const d = SS.shared.openDlg("Snapshots", `
        <p class="stamp">A snapshot keeps this board exactly as it is now, so you
          can try something and come back. Restoring replaces the pages —
          Ctrl+Z undoes that too.</p>
        ${rows || `<p class="stamp">No snapshots yet.</p>`}`);
      d.body.querySelectorAll("[data-restore]").forEach((b) =>
        b.onclick = () => {
          this.push();
          this.board.pages = JSON.parse(JSON.stringify(list[Number(b.dataset.restore)].pages));
          this.page = 0;
          this.sel = new Set();
          d.close();
          this.draw();
          this.changed(true);
          SS.shared.toast("Snapshot restored — Ctrl+Z undoes it.");
        });
      d.body.querySelectorAll("[data-drop]").forEach((b) =>
        b.onclick = () => {
          list.splice(Number(b.dataset.drop), 1);
          d.close();
          this.changed(true);
          this.snapshots();
        });
      d.btn("Close", "btn-quiet", d.close);
      d.btn("Take a snapshot", "btn-save", () => {
        const snaps = this.board.snapshots = this.board.snapshots || [];
        snaps.unshift({at: new Date().toISOString(),
                       pages: JSON.parse(JSON.stringify(this.board.pages))});
        while (snaps.length > 10) snaps.pop();
        d.close();
        this.changed(true);
        SS.shared.toast("Snapshot taken.");
      });
    }

    /* ----------------------------------------------------------- export */

    /** This page as a picture, straight into the photo library.

        Cam: "when exporting a board, have the ability to save to the in built
        photos section. From there it should be able to be exported to PC."
        Once it is a library photo, the viewer's own Export button saves it
        out — the path Cam already uses, rather than a second one. */
    async exportPNG() {
      const board = this.board;
      try {
        const url = await SS.BoardEditor.pagePNG(board, this.page);
        const pages = (board.pages || []).length;
        const caption = (board.name || "Board")
          + (pages > 1 ? ` — page ${this.page + 1}` : "");
        const res = await SS.shared.addPhotoFromDataUrl(url, caption, ["board"]);
        if (!res || res.error) {
          SS.shared.toast((res && res.error) || "That page could not be saved.", "error");
          return;
        }
        SS.shared.toast(`Saved to Photos as “${caption}” — export it to your PC from there.`);
      } catch (e) {
        SS.shared.toast("That page could not be drawn: " + e.message, "error");
      }
    }

    /* ---------------------------------------------------- undo and save */

    /** A copy of the page before a change. Simple and honest: a board is
        small, and one list copied is easier to trust than a log of edits. */
    push() {
      this.undoStack.push(JSON.stringify(this.board.pages));
      if (this.undoStack.length > 60) this.undoStack.shift();
    }

    undo() {
      const prev = this.undoStack.pop();
      if (!prev) { SS.shared.toast("Nothing left to undo."); return; }
      this.board.pages = JSON.parse(prev);
      this.sel = new Set();
      this.draw();
      this.changed(true);
    }

    changed(immediate) {
      clearTimeout(this.saveTimer);
      if (immediate) { this.flush(); return; }
      this.saveTimer = setTimeout(() => this.flush(), 700);
    }

    async flush() {
      clearTimeout(this.saveTimer);
      if (this.opts.save) {                 // a book that saves its own way (an asset is a picture)
        const r = await this.opts.save(this);
        if (r && r.error) SS.shared.toast(r.error, "error");
        return;
      }
      const res = await SS.Store.call(this.opts.saveCall || "boards_write", [this.id, this.board], "Saving the board");
      if (res && res.error) SS.shared.toast(res.error, "error");
    }

    onKey(e) {
      if (!document.body.contains(this.svg)) {      // the board was left
        window.removeEventListener("keydown", this.keyHandler);
        return;
      }
      const typing = /^(INPUT|TEXTAREA)$/.test((e.target.tagName || ""))
        || e.target.isContentEditable;
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault(); this.undo(); return;
      }
      if (this.reframe && (e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault(); this.endReframe(); return;
      }
      if (this.curveEdit && (e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault(); this.finishCurve(); return;
      }
      if (e.key === "Enter") { e.preventDefault(); this.editSelected(true); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); this.removeSelected(); return; }
      if (e.key === "Escape") { this.setTool("select"); this.sel = new Set(); this.draw(); return; }
      // a tool's letter picks it, as in a paint program (V, T, R, E, P, L, A, C)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        const t = TOOLS.find((x) => x[2] && x[2] === e.key.toUpperCase());
        if (t) { e.preventDefault(); this.setTool(t[0]); }
      }
    }
  }

  /* ---------------------------------------------------------- drawing

     Kept OUT of the editor class so a page can be drawn without opening it:
     the board list renders every page this way for the PowerPoint export.
     One drawing routine, so a deck can never look different from the board. */

  /* A kind of book that draws its own background -- a notebook cover's
     material, an asset's see-through canvas. fn(board, w, h, page, onScreen):
     onScreen is true in the editor, false for what is exported or printed. */
  const BACKGROUNDS = {};

  function paperSVG(b, w, h, page, onScreen) {
    if (b && b.kind && BACKGROUNDS[b.kind]) return BACKGROUNDS[b.kind](b, w, h, page, !!onScreen);
    /* A scrapbook page has its own paper (Cam: "allow each page to have a
       different type of paper"); those papers are the Scrapbook's. */
    const own = page && page.paper;
    if (own && SS.ScrapArt && SS.ScrapArt.hasPaper(own)) {
      return SS.ScrapArt.paperSVG(own, page.paperColour, w, h);
    }
    if (!own && SS.ScrapArt && SS.ScrapArt.hasPaper(b.paper)) {
      return SS.ScrapArt.paperSVG(b.paper, b.paperColour, w, h);
    }
    const table = {
      grid: `<defs><pattern id="bd-paper" width="40" height="40" patternUnits="userSpaceOnUse">
               <path d="M40 0H0V40" fill="none" stroke="#00000018"/></pattern></defs>
             <rect width="${w}" height="${h}" fill="#fbfaf7"/>
             <rect width="${w}" height="${h}" fill="url(#bd-paper)"/>`,
      graph: `<defs><pattern id="bd-paper" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M20 0H0V20" fill="none" stroke="#2b6cb018"/></pattern></defs>
              <rect width="${w}" height="${h}" fill="#fbfdff"/>
              <rect width="${w}" height="${h}" fill="url(#bd-paper)"/>`,
      blank: `<rect width="${w}" height="${h}" fill="#ffffff"/>`,
      colour: `<rect width="${w}" height="${h}" fill="#f4efe4"/>`,
    };
    return table[b.paper || "grid"] || table.grid;
  }

  /* An item turned (it.rot, in degrees) is drawn turned about its middle. */
  function itemSVG(it) {
    const svg = itemSVGFlat(it);
    if (!it.rot || !svg || it.points || it.pts) return svg;
    const [x, y, w, h] = boxOf(it);
    return `<g transform="rotate(${Number(it.rot) || 0} ${x + w / 2} ${y + h / 2})">${svg}</g>`;
  }

  function itemSVGFlat(it) {
    const s = it.stroke || "#1f2430", f = it.fill || "none", sw = it.sw || 2;
    const common = `data-id="${esc(it.id)}" stroke="${esc(s)}" stroke-width="${sw}" fill="${esc(f)}"`;
    const [x, y, w, h] = boxOf(it);
    switch (it.k) {
      case "rect": case "square":
        return `<rect ${common} x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`;
      case "ellipse": case "circle":
        return `<ellipse ${common} cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"/>`;
      case "triangle":
        return `<polygon ${common} points="${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}"/>`;
      case "diamond":
        return `<polygon ${common} points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}"/>`;
      /* Lines, arrows and curves are their points, drawn as they were put
         down -- start to end, any direction. (They used to be squared into a
         top-left-to-bottom-right box, so every line pointed the same way.)
         A wide invisible stroke underneath makes a thin line easy to click. */
      case "line": case "arrow": case "curve": {
        const P = ptsOf(it);
        const d = it.k === "curve" && P.length === 4
          ? `M${P[0][0]} ${P[0][1]} C ${P[1][0]} ${P[1][1]}, ${P[2][0]} ${P[2][1]}, ${P[3][0]} ${P[3][1]}`
          : `M${P[0][0]} ${P[0][1]} L ${P[P.length - 1][0]} ${P[P.length - 1][1]}`;
        const a = P[0], b = P[P.length - 1];
        return `<g data-id="${esc(it.id)}"><path d="${d}" fill="none" stroke="transparent"
          stroke-width="${sw + 14}" stroke-linecap="round"/>
          <path d="${d}" fill="none" stroke="${esc(s)}" stroke-width="${sw}" stroke-linecap="round"/>
          ${it.k === "arrow" ? arrowHead(a[0], a[1], b[0], b[1], s, sw) : ""}</g>`;
      }
      case "draw":
        return `<g data-id="${esc(it.id)}"><path d="${drawPath(it.points || [])}" fill="none" stroke="transparent"
          stroke-width="${sw + 12}" stroke-linecap="round"/><path d="${drawPath(it.points || [])}"
          fill="none" stroke="${esc(s)}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/></g>`;
      case "text": {
        const size = it.size || 20;
        const lines = String(it.text || "").split("\n");
        /* An invisible panel behind the words. An SVG <text> can only be
           clicked ON its letters, so selecting or double-clicking a line of
           text meant hitting a glyph exactly -- a miss by two pixels did
           nothing at all. */
        return `<rect data-id="${esc(it.id)}" x="${x}" y="${y}" width="${Math.max(w, 20)}"
          height="${Math.max(h, size * 1.4 * lines.length)}" fill="transparent" stroke="none"/>
          <text data-id="${esc(it.id)}" x="${x}" y="${y + size}" fill="${esc(it.stroke || "#1f2430")}"
          font-size="${size}" font-family="Georgia, serif">${lines.map((l, i) =>
            `<tspan x="${x}" dy="${i ? size * 1.25 : 0}">${esc(l) || " "}</tspan>`).join("")}</text>`;
      }
      case "photo":
        return it.src
          ? photoImage(it, [x, y, w, h], `data-id="${esc(it.id)}"`, true)
          : `<g data-id="${esc(it.id)}"><rect x="${x}" y="${y}" width="${w}" height="${h}"
               fill="#eee" stroke="#999" stroke-dasharray="6 4"/>
             <text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" fill="#777"
               font-size="14">Photo missing</text></g>`;
      case "graph": {
        const data = it.data || {type: "bar", title: "", labels: ["A", "B", "C"],
                                 series: [{name: "", values: [3, 6, 4]}]};
        const svg = window.SSGrid
          ? window.SSGrid.chartSVG(data, {width: w, height: h})
          : `<svg viewBox="0 0 ${w} ${h}"><text x="8" y="20">Graph</text></svg>`;
        const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
        /* The chart writes its words in the app's theme colours -- right in
           a spreadsheet, wrong here: a graph on a board always sits on this
           white card, so in a dark theme its title and labels came out
           light-on-white, nearly invisible on screen and in PowerPoint. The
           card sets its own ink. */
        return `<g data-id="${esc(it.id)}"><rect x="${x}" y="${y}" width="${w}" height="${h}"
          fill="#ffffff" stroke="#cfcfcf"/><g transform="translate(${x},${y})"
          style="--text:#1f2430;--text-faint:#5b6070;--border:#cfcfcf">${inner}</g></g>`;
      }
    }
    /* Scrapbook materials -- tape, frames, stickers, embellishments, words
       (ui/scrapbook/materials.js). Drawn here too, so a page exports exactly
       as it looks. */
    if (SS.ScrapArt && SS.ScrapArt.owns(it.k)) return SS.ScrapArt.itemSVG(it);
    return "";
  }

  /** One page, as a standalone SVG — what is exported and what is drawn. */
  function pageSVG(board, pageIndex) {
    const w = board.w || 1600, h = board.h || 1000;
    const items = ((board.pages || [])[pageIndex] || {}).items || [];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"
      width="${w}" height="${h}">${paperSVG(board, w, h, (board.pages || [])[pageIndex])}${items.map(itemSVG).join("")}</svg>`;
  }

  /** That SVG as a PNG. Everything it needs is already inside it — photos are
      embedded, shapes are drawn here — so nothing is fetched and the canvas
      is never tainted. */
  function pngFromSVG(svgText, w, h, transparent) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!transparent) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);    // a page is paper, never transparent
        }                              // (an asset may be: clip art, stickers)
        ctx.drawImage(img, 0, 0, w, h);
        try { resolve(c.toDataURL("image/png")); } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error("The page could not be drawn."));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
    });
  }

  /* The box an item occupies -- used for selection, marquee and handles.
     Freehand drawing has no width of its own, so it is measured from the
     points; a line's box may run backwards, and is normalised here. */
  /* ---------------------------------------------- a photo in its box

     Where a photo sits in its box (a photo item, or a frame's window):
     scaled to just fill it, times `zoom`, with fx / fy (0..1) saying how far
     across the left-over part the box sits -- 0.5, 0.5 is centred, as before.
     Without its natural size (a photo placed before 2026-10-02) it's drawn
     as it always was, centred. */
  const clamp01 = (v) => Math.min(1, Math.max(0, Number(v)));
  function photoGeo(it, box) {
    const [bx, by, bw, bh] = box;
    if (!(it.nw > 0 && it.nh > 0) || !(bw > 0 && bh > 0)) return null;
    const s = Math.max(bw / it.nw, bh / it.nh) * Math.max(1, Number(it.zoom) || 1);
    const w = it.nw * s, h = it.nh * s, ox = w - bw, oy = h - bh;
    const fx = it.fx == null ? 0.5 : clamp01(it.fx), fy = it.fy == null ? 0.5 : clamp01(it.fy);
    const r = (v) => Math.round(v * 10) / 10;
    return {x: r(bx - ox * fx), y: r(by - oy * fy), w: r(w), h: r(h), ox, oy};
  }
  /** The photo's <image>. `own`: it carries its own clip (a photo item);
      a frame passes its clip-path in `attrs` instead. */
  function photoImage(it, box, attrs, own) {
    const [bx, by, bw, bh] = box, g = photoGeo(it, box);
    if (!g) {
      return `<image ${attrs || ""} x="${bx}" y="${by}" width="${bw}" height="${bh}" href="${esc(it.src)}"
        preserveAspectRatio="xMidYMid slice"/>`;
    }
    if (!own) {
      return `<image ${attrs || ""} x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" href="${esc(it.src)}"
        preserveAspectRatio="none"/>`;
    }
    return `<svg ${attrs || ""} x="${bx}" y="${by}" width="${bw}" height="${bh}" overflow="hidden"><image
      x="${Math.round((g.x - bx) * 10) / 10}" y="${Math.round((g.y - by) * 10) / 10}" width="${g.w}" height="${g.h}"
      href="${esc(it.src)}" preserveAspectRatio="none"/></svg>`;
  }
  /** A picture's natural size, [w, h] -- or null if it won't load in time. */
  function naturalSize(url) {
    return new Promise((resolve) => {
      if (!url || typeof Image === "undefined") { resolve(null); return; }
      const img = new Image();
      const t = setTimeout(() => resolve(null), 2500);
      img.onload = () => { clearTimeout(t); resolve(img.naturalWidth ? [img.naturalWidth, img.naturalHeight] : null); };
      img.onerror = () => { clearTimeout(t); resolve(null); };
      img.src = url;
    });
  }

  function boxOf(it) {
    if (LINES.has(it.k)) {
      const P = ptsOf(it);
      const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
      return [Math.min(...xs), Math.min(...ys),
              Math.max(1, Math.max(...xs) - Math.min(...xs)),
              Math.max(1, Math.max(...ys) - Math.min(...ys))];
    }
    if (it.k === "draw" && (it.points || []).length) {
      const xs = it.points.map((p) => p[0]), ys = it.points.map((p) => p[1]);
      return [Math.min(...xs), Math.min(...ys),
              Math.max(1, Math.max(...xs) - Math.min(...xs)),
              Math.max(1, Math.max(...ys) - Math.min(...ys))];
    }
    const w = it.w || 0, h = it.h || 0;
    return [w < 0 ? it.x + w : it.x, h < 0 ? it.y + h : it.y, Math.abs(w), Math.abs(h)];
  }

  /** A line, arrow or curve as points: its own, or -- for one saved before
      they had points -- the line it used to show (which was always drawn
      across its box, top left to bottom right, whatever way it was dragged;
      and a curve was an arch across that box). */
  function ptsOf(it) {
    if (Array.isArray(it.pts) && it.pts.length >= 2) return it.pts;
    const w = it.w || 0, h = it.h || 0;
    const x = w < 0 ? it.x + w : it.x, y = h < 0 ? it.y + h : it.y, W = Math.abs(w), H = Math.abs(h);
    if (it.k === "curve") {
      const p0 = [x, y + H], q = [x + W / 2, y - H / 2], p1 = [x + W, y + H];
      const c1 = [p0[0] + (q[0] - p0[0]) * 2 / 3, p0[1] + (q[1] - p0[1]) * 2 / 3];
      const c2 = [p1[0] + (q[0] - p1[0]) * 2 / 3, p1[1] + (q[1] - p1[1]) * 2 / 3];
      return [p0, c1, c2, p1].map(([a, b]) => [Math.round(a), Math.round(b)]);
    }
    return [[x, y], [x + W, y + H]];
  }

  function straightCurve(a, b) {
    const at = (t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)];
    return [a.slice(), at(1 / 3), at(2 / 3), b.slice()];
  }

  /** The end point turned to the nearest 15°, keeping its length. */
  function snapAngle(x0, y0, x, y) {
    const len = Math.hypot(x - x0, y - y0);
    const step = Math.PI / 12;
    const ang = Math.round(Math.atan2(y - y0, x - x0) / step) * step;
    return [Math.round(x0 + len * Math.cos(ang)), Math.round(y0 + len * Math.sin(ang))];
  }

  /** A pencil stroke, smoothed: each point is a control point and the path
      runs through the midpoints between them. */
  function drawPath(points) {
    if (!points.length) return "";
    if (points.length < 3) return "M" + points.map((p) => p.join(" ")).join(" L ");
    let d = `M${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i][0] + points[i + 1][0]) / 2, my = (points[i][1] + points[i + 1][1]) / 2;
      d += ` Q ${points[i][0]} ${points[i][1]} ${mx} ${my}`;
    }
    const last = points[points.length - 1];
    return d + ` L ${last[0]} ${last[1]}`;
  }

  const overlaps = (a, b) =>
    a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

  function arrowHead(x1, y1, x2, y2, colour, sw) {
    const ang = Math.atan2(y2 - y1, x2 - x1), len = 10 + sw * 2;
    const p = (a) => `${x2 - len * Math.cos(ang - a)},${y2 - len * Math.sin(ang - a)}`;
    return `<polygon points="${x2},${y2} ${p(0.4)} ${p(-0.4)}" fill="${colour}" stroke="none"/>`;
  }

  SS.BoardEditor = {
    open(host, id, board, onBack, opts) { return new Editor(host, id, board, onBack, opts); },
    pageSVG, pngFromSVG, uid, photoImage, photoGeo,
    async pagePNG(board, pageIndex, transparent) {
      return pngFromSVG(pageSVG(board, pageIndex), board.w || 1600, board.h || 1000, transparent);
    },
    addBackground(kind, fn) { BACKGROUNDS[kind] = fn; },
    _test: {boxOf, overlaps, TOOLS, ptsOf, snapAngle, drawPath, loadStyle, STYLE_KEY},
  };
})();
