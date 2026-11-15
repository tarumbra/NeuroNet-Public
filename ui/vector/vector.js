/* ==========================================================================
   Vector — Creative → Vector (view vector:studio).

   Cam (2026-10-04): "please get started on the vector tool in Neuronet" --
   after being told honestly it would cover the everyday 80% and Inkscape
   the rest, so it reads and writes plain SVG for the round trip.

   Laid out the way Inkscape and Illustrator are: tools down the left, the
   artboard in the middle, Fill & Stroke / Swatches / Transform / Arrange &
   Combine / Layers down the right. The drawing is plain JSON
   (vectorcore.js, tested on its own); Paper.js (vendor/, MIT) does the two
   things that need real curve maths -- combining shapes (union, subtract,
   intersect, exclude) and reading SVG files -- plus simplify and add-node.

   A drawing is an asset (Creative → Assets): its picture is the SVG itself
   (crisp at any size on a scrapbook page or a cover), its design the
   drawing, in progress or completed, like Pixel art's sprites.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const V = () => window.VectorCore;

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const r2 = (v) => Math.round(v * 100) / 100;

  /* [key, name, shortcut, icon path] -- Illustrator/Inkscape letters */
  const TOOLS = [
    ["select", "Select", "V", '<path d="M6 3l12 9-5.5 1.2L9.5 19z"/>'],
    ["direct", "Direct select (nodes)", "A", '<path d="M6 3l12 9-5.5 1.2L9.5 19z" fill="none"/><rect x="15" y="15" width="5" height="5"/>'],
    ["pen", "Pen", "P", '<path d="M12 3l5 9-5 9-5-9zM12 3v7"/><circle cx="12" cy="12" r="1.5"/>'],
    ["pencil", "Pencil", "N", '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>'],
    ["line", "Line", "\\", '<path d="M5 19L19 5"/>'],
    ["rect", "Rectangle", "M", '<rect x="4" y="6" width="16" height="12" rx="1"/>'],
    ["ellipse", "Ellipse", "L", '<ellipse cx="12" cy="12" rx="8" ry="6"/>'],
    ["polygon", "Polygon", "Y", '<path d="M12 3l8 6-3 10H7L4 9z"/>'],
    ["star", "Star", "S", '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'],
    ["text", "Text", "T", '<path d="M5 5h14M12 5v14M9 19h6"/>'],
    ["picker", "Eyedropper (copy colours)", "I", '<path d="M14 4l6 6-2 2-6-6zM12 8L5 15v4h4l7-7"/>'],
    ["hand", "Hand (move around)", "H", '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v6M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 6-6 6-3 0-4.5-1.5-6-4l-2-3.5a1.5 1.5 0 0 1 2.5-1.5L8 13"/>'],
  ];
  const SIZES = [["512", "512 × 512", 512, 512], ["1024", "1024 × 1024", 1024, 1024], ["a4", "A4 page", 794, 1123],
                 ["hd", "1920 × 1080", 1920, 1080], ["icon", "128 × 128 icon", 128, 128]];
  const STAGES = [["wip", "In progress"], ["done", "Completed works"]];
  const UNDO_MAX = 80;

  let st = null;
  let keyListener = null;
  function dropKeys() { if (keyListener) window.removeEventListener("keydown", keyListener); keyListener = null; }

  /* ------------------------------------------------------ Paper.js, lazily */

  /* Loaded the first time Vector opens, not with the app: 200 KB nobody
     needs until they draw (and NeuroNet's page tests boot without it). */
  const PAPER_SRC = "vector/vendor/paper-core.min.js";
  let paperLoading = null;
  function ensurePaper() {
    if (window.paper) return Promise.resolve(window.paper);
    if (!paperLoading) {
      paperLoading = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = PAPER_SRC;
        s.onload = () => (window.paper ? resolve(window.paper) : reject(new Error("The vector maths library didn't start.")));
        s.onerror = () => { paperLoading = null; reject(new Error("The vector maths library couldn't be loaded.")); };
        document.head.appendChild(s);
      });
    }
    return paperLoading;
  }

  let paperReady = false;
  function P() {
    const paper = window.paper;
    if (!paper) throw new Error("The vector maths library didn't load.");
    if (!paperReady) { paper.setup(new paper.Size(1, 1)); paperReady = true; }
    return paper;
  }

  function toPaper(it) {
    const paper = P();
    const kids = it.subs.map((s) => new paper.Path({
      segments: s.nodes.map((n) => new paper.Segment(new paper.Point(n.x, n.y), new paper.Point(n.ix - n.x, n.iy - n.y),
                                                     new paper.Point(n.ox - n.x, n.oy - n.y))),
      closed: s.closed, insert: false}));
    if (kids.length === 1) return kids[0];
    return new paper.CompoundPath({children: kids, fillRule: it.rule || "nonzero", insert: false});
  }

  /** A Paper path (or compound path) back into a drawing's path. */
  function fromPaper(pp, look) {
    const kids = pp.className === "CompoundPath" ? pp.children : [pp];
    const subs = kids.filter((k) => k.segments && k.segments.length).map((k) => ({
      closed: !!k.closed,
      nodes: k.segments.map((sg) => {
        const x = sg.point.x, y = sg.point.y, hi = sg.handleIn, ho = sg.handleOut;
        const smooth = !hi.isZero() && !ho.isZero() && Math.abs(hi.angle - ho.angle) > 179 && Math.abs(hi.angle - ho.angle) < 181;
        return {x, y, ix: x + hi.x, iy: y + hi.y, ox: x + ho.x, oy: y + ho.y, smooth};
      }),
    }));
    const it = V().pathFrom(subs, look || {});
    if (pp.className === "CompoundPath") it.rule = pp.fillRule === "evenodd" ? "evenodd" : "nonzero";
    return it;
  }

  const looks = (it) => ({fill: it.fill, stroke: it.stroke, sw: it.sw, opacity: it.opacity, cap: it.cap, join: it.join, dash: it.dash});

  /** Cam's shape combining: everything chosen, in drawing order. Union,
      intersect and exclude take them all; subtract takes everything in
      front away from the one at the back (as Illustrator's Minus Front). */
  function combine(op) {
    const chosen = selectedItems().filter((i) => i.t === "path");
    if (chosen.length < 2) { SS.shared.toast("Choose two or more shapes to combine (text and pictures can't be)."); return null; }
    const order = layerItems().filter((i) => chosen.includes(i));
    const back = order[0], rest = order.slice(1);
    let res;
    try {
      let acc = toPaper(back);
      if (op === "subtract") {
        let front = toPaper(rest[0]);
        rest.slice(1).forEach((r) => { front = front.unite(toPaper(r), {insert: false}); });
        res = acc.subtract(front, {insert: false});
      } else {
        rest.forEach((r) => { acc = acc[op](toPaper(r), {insert: false}); });
        res = acc;
      }
    } catch (e) { SS.shared.toast("Those shapes couldn't be combined: " + e.message, "error"); return null; }
    push();
    const list = layerItems(), at = list.indexOf(back);
    const made = fromPaper(res, looks(back));
    if (!made.subs.length) { SS.shared.toast("Nothing is left after that — the shapes don't overlap."); st.undo.pop(); return null; }
    list.splice(at, 1, made);
    rest.forEach((r) => list.splice(list.indexOf(r), 1));
    st.sel = new Set([made.id]);
    changed(); draw();
    return made;
  }

  /** Fewer nodes, same shape (Paper's simplify). */
  function simplifySelected() {
    const paths = selectedItems().filter((i) => i.t === "path");
    if (!paths.length) { SS.shared.toast("Choose a path to simplify."); return; }
    push();
    paths.forEach((it) => {
      const pp = toPaper(it);
      (pp.children || [pp]).forEach((k) => k.simplify && k.simplify(2.5 / st.zoom));
      const made = fromPaper(pp, looks(it));
      it.subs = made.subs;
    });
    changed(); draw();
  }

  /** A new node on the path where it's nearest `pt` (direct select, double-click). */
  function addNodeAt(it, pt) {
    const pp = toPaper(it);
    const loc = pp.getNearestLocation(new (P().Point)(pt[0], pt[1]));
    if (!loc) return false;
    push();
    (loc.path || pp).divideAt(loc);
    it.subs = fromPaper(pp, looks(it)).subs;
    changed(); draw();
    return true;
  }

  /* --------------------------------------------------------- reading SVG */

  function colourOf(c) {
    if (!c) return {paint: null, alpha: 1};
    if (c.gradient) {
      const g = c.gradient, stops = g.stops.map((s) => [s.offset == null ? 0 : s.offset, s.color.toCSS(true)]);
      let angle = 0;
      if (c.origin && c.destination) angle = Math.round((Math.atan2(c.destination.y - c.origin.y, c.destination.x - c.origin.x) * 180) / Math.PI);
      return {paint: {type: g.radial ? "radial" : "linear", angle, stops}, alpha: 1};
    }
    return {paint: c.toCSS(true), alpha: c.alpha == null ? 1 : c.alpha};
  }

  /** An SVG file (Inkscape's, or anyone's) as drawing items. Shapes become
      editable paths; transforms are baked in; text stays text. */
  function importSVG(text) {
    const paper = P();
    const root = paper.project.importSVG(String(text), {insert: false, expandShapes: true});
    if (!root) throw new Error("That isn't an SVG drawing.");
    const walk = (pi) => {
      if (!pi.visible) return null;
      const cls = pi.className;
      if (cls === "Group" || cls === "Layer") {
        const items = pi.children.map(walk).filter(Boolean);
        if (pi.clipped && items.length) items.shift();                 // a clip mask: its shape, not drawn
        if (!items.length) return null;
        if (items.length === 1) return items[0];
        return {id: V().uid("g"), t: "group", items, opacity: pi.opacity};
      }
      if (cls === "Path" || cls === "CompoundPath") {
        const c = pi.clone({insert: false});
        if (pi.parent) c.transform(pi.parent.globalMatrix);
        const f = colourOf(pi.fillColor), s = colourOf(pi.strokeColor);
        const it = fromPaper(c, {fill: f.paint, stroke: pi.strokeWidth ? s.paint : null,
                                 sw: s.paint ? pi.strokeWidth * (pi.parent ? pi.parent.globalMatrix.scaling.x : 1) : 0,
                                 opacity: (pi.opacity == null ? 1 : pi.opacity) * Math.min(f.alpha, f.paint ? 1 : s.alpha),
                                 cap: pi.strokeCap || "butt", join: pi.strokeJoin || "miter",
                                 dash: pi.dashArray && pi.dashArray.length ? pi.dashArray.slice() : null});
        if (pi.fillRule === "evenodd") it.rule = "evenodd";
        return it.subs.length ? it : null;
      }
      if (cls === "PointText") {
        const m = pi.globalMatrix, p = m.transform(new paper.Point(0, 0));
        const t = V().text(p.x, p.y, pi.content, {fill: colourOf(pi.fillColor).paint || "#000000"});
        t.size = pi.fontSize * (m.scaling ? m.scaling.x : 1);
        t.font = String(pi.fontFamily || "sans-serif").split(",")[0].replace(/['"]/g, "").trim() || "sans-serif";
        t.weight = /bold/i.test(pi.fontWeight) ? 700 : Number(pi.fontWeight) || 400;
        t.rot = m.rotation || 0;
        return t;
      }
      if (cls === "Raster" && pi.source && /^data:image\//.test(pi.source)) {
        const b = pi.bounds;
        return V().image(pi.source, b.x, b.y, b.width, b.height);
      }
      if (cls === "Shape" && pi.toPath) return walk(pi.toPath(false));
      return null;
    };
    const out = walk(root);
    const items = !out ? [] : out.t === "group" && root.className === "Group" ? out.items : [out];
    const vb = /viewBox\s*=\s*["']\s*([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([\d.e]+)[\s,]+([\d.e]+)/i.exec(text);
    return {items, w: vb ? Number(vb[3]) : null, h: vb ? Number(vb[4]) : null, x: vb ? Number(vb[1]) : 0, y: vb ? Number(vb[2]) : 0};
  }

  /** Items made to fit inside the box [x, y, w, h], centred. */
  function fitInto(items, box) {
    const b = V().unionBounds(items, measure);
    if (!b || !b[2] || !b[3]) return;
    const k = Math.min(box[2] / b[2], box[3] / b[3]);
    const m = V().mul(V().translate(-b[0], -b[1]), V().mul([k, 0, 0, k, 0, 0], V().translate(box[0] + (box[2] - b[2] * k) / 2, box[1] + (box[3] - b[3] * k) / 2)));
    items.forEach((it) => V().transform(it, m));
  }

  /* --------------------------------------------------------- text width */

  let meter = null;
  function measure(it) {
    try {
      if (!meter) meter = document.createElement("canvas").getContext("2d");
      if (!meter || !meter.measureText) throw new Error("no canvas");
      meter.font = `${it.italic ? "italic " : ""}${it.weight || 400} ${it.size}px ${V().FONTS[it.font] || it.font}`;
      const w = Math.max(...String(it.text || "").split("\n").map((l) => meter.measureText(l).width));
      if (!w) throw new Error("no width");
      return w;
    } catch (e) {
      return Math.max(...String(it.text || "").split("\n").map((l) => l.length)) * it.size * 0.56;
    }
  }

  /* --------------------------------------------------------- the home page */

  async function home(host) {
    dropKeys();
    if (st) {
      clearTimeout(st.saveTimer);
      if (st.dirty && st.asset) await save();
    }
    st = null;
    const all = (SS.AssetStore ? await SS.AssetStore.list(true) : []) || [];
    const mine = all.filter((a) => a.kind === "vector");
    const tiles = (list) => list.map((a) => `
      <button class="px-tile" data-open="${esc(a.id)}" title="Open “${esc(a.name)}”">
        <span class="px-tile-img vx-tile-img"></span><span class="px-tile-name">${esc(a.name)}</span>
        <span class="px-tile-meta">${esc(a.updated ? a.updated.slice(0, 10) : "")}</span></button>`).join("");
    const wip = mine.filter((a) => a.stage === "wip"), done = mine.filter((a) => a.stage !== "wip");
    host.innerHTML = `
      <div class="bd-head px-head vx-head">
        <h2 class="page-h">Vector</h2>
        <p class="stamp">Shapes, paths and lettering that stay sharp at any size — saved into Assets as SVG,
          ready for Scrapbooks, Covers and Boards, and for Inkscape when a job needs it.</p>
        <div class="bd-actions">
          <button class="btn btn-primary" id="vx-new">+ New drawing</button>
          <button class="btn btn-quiet" id="vx-clip">Start from clip art</button>
          <button class="btn btn-quiet" id="vx-sticky" title="A design for the desktop's sticky notes">+ Sticky note</button>
          <button class="btn btn-quiet" id="vx-open-svg">Open an SVG file…</button>
        </div>
      </div>
      <h3 class="as-sec">In progress <span>${wip.length}</span></h3>
      ${wip.length ? `<div class="px-tiles">${tiles(wip)}</div>` : `<p class="bd-empty">Nothing in progress.</p>`}
      <h3 class="as-sec">Completed works <span>${done.length}</span></h3>
      ${done.length ? `<div class="px-tiles">${tiles(done)}</div>` : `<p class="bd-empty">No finished drawings yet.</p>`}`;
    host.querySelector("#vx-new").onclick = () => newDialog(host);
    host.querySelector("#vx-clip").onclick = () => clipDialog(host);
    host.querySelector("#vx-sticky").onclick = () => openEditor(host, stickyTemplate(), null);
    host.querySelector("#vx-open-svg").onclick = () => openSvgFile(host);
    host.querySelectorAll("[data-open]").forEach((b) => {
      SS.AssetStore.thumb(b.dataset.open).then((url) => {
        const s = b.querySelector(".px-tile-img");
        if (url && s) s.style.backgroundImage = `url("${url}")`;
      }).catch(() => {});
      b.onclick = () => openAsset(host, b.dataset.open);
    });
  }

  function newDialog(host) {
    const d = SS.shared.openDlg("New drawing", `
      <label class="dlg-label" for="vx-n-name">Name</label>
      <input class="input" id="vx-n-name" value="New drawing">
      <div class="dlg-label">Artboard</div>
      <div class="seg sb-seg" id="vx-n-size">${SIZES.map(([k, n], i) => `<button class="seg-btn ${i === 1 ? "on" : ""}" data-k="${k}">${esc(n)}</button>`).join("")}
        <button class="seg-btn" data-k="custom">Custom</button></div>
      <div class="pc-row" id="vx-n-custom" hidden>
        <label>Width <input class="input pc-num" id="vx-n-w" type="number" min="16" max="10000" value="800"> px</label>
        <label>Height <input class="input pc-num" id="vx-n-h" type="number" min="16" max="10000" value="600"> px</label>
      </div>`);
    let size = "1024";
    d.body.querySelector("#vx-n-size").addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]");
      if (!b) return;
      d.body.querySelectorAll("#vx-n-size .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
      size = b.dataset.k;
      d.body.querySelector("#vx-n-custom").hidden = size !== "custom";
    });
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Create", "btn-save", () => {
      const s = SIZES.find((x) => x[0] === size);
      const w = s ? s[2] : clamp(Number(d.body.querySelector("#vx-n-w").value) | 0, 16, 10000);
      const h = s ? s[3] : clamp(Number(d.body.querySelector("#vx-n-h").value) | 0, 16, 10000);
      d.close();
      openEditor(host, V().newDoc(w, h, d.body.querySelector("#vx-n-name").value.trim() || "New drawing"), null);
    });
  }

  /** A sticky note to design on (Cam, 2026-10-05: "import your own design of sticky
      note made within the app ... build a template there for me to follow"). The
      desktop stretches the saved picture to the note, so it is drawn at a note's
      shape: the top band is where the note's buttons sit, the dashed box where
      the words go. The Guide layer shows while drawing and is never saved; save
      it under Assets -> Sticky notes and it's in every note's ◐ Design list. */
  function stickyTemplate() {
    const V0 = V(), W = 600, H = 520;
    const doc = V0.newDoc(W, H, "My sticky note");
    doc.template = "sticky";
    const paper = V0.rect(0, 0, W, H, 18, {fill: "#fff3a6", stroke: null, sw: 0});
    const band = V0.rect(0, 0, W, 64, 18, {fill: "#f6e27f", stroke: null, sw: 0});
    const fold = V0.polyline([[W - 70, H], [W, H - 70], [W - 70, H - 70]], true, {fill: "#e8d36a", stroke: null, sw: 0});
    const tape = V0.rect(W / 2 - 80, 8, 160, 40, 4, {fill: "#ffffff", stroke: null, sw: 0, opacity: 0.55});
    doc.layers[0].name = "Note";
    doc.layers[0].items.push(paper, band, fold);
    doc.layers.push({id: "Ltape", name: "Tape", visible: true, locked: false, items: [tape]});
    doc.layers.push({id: "Lguide", name: "Guide (not saved)", visible: true, locked: true, guide: true, items: [
      V0.rect(32, 72, W - 64, H - 104, 8, {fill: "none", stroke: "#2E6B38", sw: 2, dash: [10, 8]}),
      V0.text(48, 116, "Writing area: keep it plain so words read", {fill: "#2E6B38", size: 22}),
      V0.text(48, 40, "Top band: the note's buttons", {fill: "#2E6B38", size: 20}),
    ]});
    return doc;
  }

  /** The built-in clip art, opened as editable shapes (Cam can build on them). */
  function clipDialog(host) {
    const list = (SS.ClipArt && SS.ClipArt.LIST) || [];
    const d = SS.shared.openDlg("Start from clip art", `
      <p class="sb-note">Every piece opens as real shapes you can reshape, recolour and combine.</p>
      <div class="px-tpl-grid">${list.map((a) => `<button class="px-tpl" data-clip="${esc(a[0])}" title="${esc(a[1])}">${SS.ClipArt.svg(a[0], null, 48)}<span>${esc(a[1])}</span></button>`).join("")}</div>`, true);
    d.body.querySelectorAll("[data-clip]").forEach((b) => b.onclick = () => {
      d.close();
      return startFromClip(host, b.dataset.clip);
    });
    d.btn("Cancel", "btn-quiet", d.close);
  }

  function startFromClip(host, id) {
    const a = SS.ClipArt.find(id);
    const doc = V().newDoc(512, 512, a[1]);
    const got = importSVG(SS.ClipArt.svg(id, null, 512));
    fitInto(got.items, [32, 32, 448, 448]);
    doc.layers[0].items = got.items;
    return openEditor(host, doc, null);
  }

  async function openSvgFile(host) {
    const got = await SS.Store.call("vector_open_svg", [], "Opening an SVG");
    if (!got || got.cancelled) return null;
    if (got.error) { SS.shared.toast(got.error, "error"); return null; }
    return openSvgText(host, got.text, got.name);
  }

  function openSvgText(host, text, name) {
    let got;
    try { got = importSVG(text); } catch (e) { SS.shared.toast(e.message, "error"); return null; }
    const b = V().unionBounds(got.items, measure) || [0, 0, 512, 512];
    const w = Math.round(got.w || b[0] + b[2] || 512), h = Math.round(got.h || b[1] + b[3] || 512);
    const doc = V().newDoc(clamp(w, 16, 10000), clamp(h, 16, 10000), name || "Imported");
    if (got.x || got.y) got.items.forEach((it) => V().transform(it, V().translate(-got.x, -got.y)));
    doc.layers[0].items = got.items;
    return openEditor(host, doc, null);
  }

  async function openAsset(host, id) {
    const got = await SS.Store.call("asset_design", [id], "Opening the drawing");
    if (!got || got.error || !got.design || got.design.kind !== "vector") {
      SS.shared.toast((got && got.error) || "That isn't a vector drawing.", "error");
      return null;
    }
    const meta = ((SS.AssetStore && await SS.AssetStore.list()) || []).find((a) => a.id === id) || {};
    const doc = got.design;
    if (meta.name) doc.name = meta.name;
    return openEditor(host, doc, {id, cat: meta.cat || "clipart", stage: meta.stage || "wip"});
  }

  /* ------------------------------------------------------------ the editor */

  function openEditor(host, doc, asset) {
    st = {
      host, doc, asset, layer: doc.layers[doc.layers.length - 1].id, sel: new Set(), tool: "select",
      zoom: 1, grid: false, snap: false, gridSize: 16, undo: [], redo: [], dirty: false, saveTimer: null,
      style: {fill: "#9ad07a", stroke: "#1f2430", sw: 3, opacity: 1, cap: "round", join: "round", dash: null},
      node: null, pen: null, drag: null, marquee: null, hover: null, toAlign: "selection",
      swatches: "Sweetie 16", polySides: 6, starPoints: 5,
    };
    build();
    fit();
    draw();
    return st;
  }

  const $ = (sel) => st.host.querySelector(sel);
  const margin = () => Math.round(Math.max(st.doc.w, st.doc.h) * 0.3);

  function build() {
    const h = st.host, d = st.doc;
    const tools = TOOLS.map(([k, name, key, path]) => `
      <button class="px-tool vx-tool ${k === st.tool ? "on" : ""}" data-tool="${k}" title="${esc(name)} (${key})" aria-label="${esc(name)}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg></button>`).join("");
    const palettes = (window.PixelCore ? PixelCore.PALETTES : []).map((p) => p.name);
    h.innerHTML = `
      <div class="px-ed vx-ed">
        <div class="px-bar">
          <button class="btn btn-quiet" id="vx-back">← Vector</button>
          <input class="input px-name" id="vx-name" value="${esc(d.name)}" aria-label="Name">
          <span class="px-chip" id="vx-stagechip"></span>
          <span class="px-dirty" id="vx-dirty"></span>
          <span class="px-grow"></span>
          <button class="btn btn-quiet" id="vx-undo" title="Undo (Ctrl+Z)">Undo</button>
          <button class="btn btn-quiet" id="vx-redo" title="Redo (Ctrl+Y)">Redo</button>
          <button class="btn btn-quiet" id="vx-zout" title="Zoom out (-)">−</button>
          <span id="vx-zoom" class="px-zoomlbl"></span>
          <button class="btn btn-quiet" id="vx-zin" title="Zoom in (+)">+</button>
          <button class="btn btn-quiet" id="vx-fit" title="Fit the artboard (0)">Fit</button>
          <button class="btn btn-quiet px-tog" id="vx-grid" title="Grid">Grid</button>
          <button class="btn btn-quiet px-tog" id="vx-snap" title="Snap to the grid">Snap</button>
          <button class="btn btn-quiet" id="vx-artboard" title="Artboard size and background">Artboard…</button>
          <button class="btn btn-quiet" id="vx-place" title="Put an asset, clip art or a photo in">Place…</button>
          <button class="btn btn-quiet" id="vx-import" title="Bring in an SVG file's shapes">Import SVG…</button>
          <button class="btn btn-quiet" id="vx-export">Export…</button>
          <button class="btn btn-primary" id="vx-save" title="Save into Assets (Ctrl+S)">Save</button>
        </div>
        <div class="px-body">
          <aside class="px-tools vx-tools" aria-label="Tools">${tools}
            <div class="px-tlbl">Shape</div>
            <label class="vx-mini" title="Sides of a polygon">Sides <input type="number" id="vx-sides" min="3" max="24" value="${st.polySides}"></label>
            <label class="vx-mini" title="Points of a star">Points <input type="number" id="vx-points" min="3" max="24" value="${st.starPoints}"></label>
          </aside>
          <div class="px-stage vx-stage" id="vx-stage"><svg id="vx-svg" class="vx-svg" xmlns="http://www.w3.org/2000/svg"></svg></div>
          <aside class="px-side vx-side">
            <div class="px-panel">
              <div class="px-ptitle">Fill &amp; stroke</div>
              <div class="vx-paint" id="vx-fill-row">
                <span class="vx-lbl">Fill</span>
                <input type="color" id="vx-fill" aria-label="Fill colour">
                <button class="btn btn-quiet vx-sm" data-fill="none" title="No fill">None</button>
                <button class="btn btn-quiet vx-sm" data-fill="linear" title="Linear gradient">Linear</button>
                <button class="btn btn-quiet vx-sm" data-fill="radial" title="Radial gradient">Radial</button>
              </div>
              <div id="vx-grad" class="vx-grad" hidden></div>
              <div class="vx-paint">
                <span class="vx-lbl">Stroke</span>
                <input type="color" id="vx-stroke" aria-label="Stroke colour">
                <button class="btn btn-quiet vx-sm" data-stroke="none" title="No stroke">None</button>
                <label class="vx-mini">Width <input type="number" id="vx-sw" min="0" max="200" step="0.5"></label>
              </div>
              <div class="vx-paint">
                <select class="input vx-sel" id="vx-dash" aria-label="Dashes"><option value="">Solid</option><option value="8 6">Dashed</option><option value="1 6">Dotted</option><option value="16 6 2 6">Dash-dot</option></select>
                <select class="input vx-sel" id="vx-cap" aria-label="Ends"><option value="round">Round ends</option><option value="butt">Flat ends</option><option value="square">Square ends</option></select>
                <select class="input vx-sel" id="vx-join" aria-label="Corners"><option value="round">Round corners</option><option value="miter">Sharp corners</option><option value="bevel">Bevelled</option></select>
              </div>
              <label class="px-row px-alpha">Opacity <input type="range" id="vx-opacity" min="0" max="100"> <span id="vx-opacity-n"></span></label>
            </div>
            <div class="px-panel">
              <div class="px-ptitle">Swatches</div>
              <select class="input" id="vx-pal" aria-label="Swatches"><option value="__doc">This drawing's colours</option>${palettes.map((n) => `<option ${n === st.swatches ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
              <div class="px-swatches" id="vx-swatches"></div>
              <p class="sb-note">Click: fill. Right-click: stroke.</p>
            </div>
            <div class="px-panel">
              <div class="px-ptitle">Transform</div>
              <div class="vx-xform">
                <label>X <input type="number" id="vx-x"></label><label>Y <input type="number" id="vx-y"></label>
                <label>W <input type="number" id="vx-w" min="0"></label><label>H <input type="number" id="vx-h" min="0"></label>
                <label>Turn <input type="number" id="vx-rot" value="0" step="15"></label>
              </div>
              <div class="px-row">
                <label class="vx-mini"><input type="checkbox" id="vx-ratio" checked> Keep proportions</label>
                <button class="btn btn-quiet vx-sm" id="vx-fliph" title="Flip across">Flip ↔</button>
                <button class="btn btn-quiet vx-sm" id="vx-flipv" title="Flip up and down">Flip ↕</button>
              </div>
            </div>
            <div class="px-panel">
              <div class="px-ptitle">Arrange &amp; combine</div>
              <div class="vx-btns">
                ${[["left", "⇤", "Align left"], ["hcentre", "↔", "Align centres across"], ["right", "⇥", "Align right"],
                   ["top", "⤒", "Align tops"], ["vcentre", "↕", "Align middles"], ["bottom", "⤓", "Align bottoms"]]
                  .map(([k, g, t]) => `<button class="btn btn-quiet vx-ic" data-align="${k}" title="${t}">${g}</button>`).join("")}
                <select class="input vx-sel" id="vx-alignto" aria-label="Align to"><option value="selection">to each other</option><option value="artboard">to the artboard</option></select>
              </div>
              <div class="vx-btns">
                <button class="btn btn-quiet vx-sm" data-dist="x" title="Even gaps across (3 or more)">Space across</button>
                <button class="btn btn-quiet vx-sm" data-dist="y" title="Even gaps down (3 or more)">Space down</button>
              </div>
              <div class="vx-btns">
                <button class="btn btn-quiet vx-sm" data-order="front" title="Bring to front (Ctrl+Shift+])">Front</button>
                <button class="btn btn-quiet vx-sm" data-order="up" title="Bring forward (Ctrl+])">Forward</button>
                <button class="btn btn-quiet vx-sm" data-order="down" title="Send backward (Ctrl+[)">Backward</button>
                <button class="btn btn-quiet vx-sm" data-order="back" title="Send to back (Ctrl+Shift+[)">Back</button>
              </div>
              <div class="vx-btns">
                <button class="btn btn-quiet vx-sm" id="vx-group" title="Group (Ctrl+G)">Group</button>
                <button class="btn btn-quiet vx-sm" id="vx-ungroup" title="Ungroup (Ctrl+Shift+G)">Ungroup</button>
                <button class="btn btn-quiet vx-sm" id="vx-simplify" title="Fewer nodes, the same shape">Simplify</button>
              </div>
              <div class="vx-btns vx-bool">
                <button class="btn btn-quiet vx-sm" data-bool="unite" title="One shape from all of them">Union</button>
                <button class="btn btn-quiet vx-sm" data-bool="subtract" title="The front ones cut out of the back one">Subtract</button>
                <button class="btn btn-quiet vx-sm" data-bool="intersect" title="Only where they overlap">Intersect</button>
                <button class="btn btn-quiet vx-sm" data-bool="exclude" title="Everything but the overlap">Exclude</button>
              </div>
            </div>
            <div class="px-panel">
              <div class="px-ptitle">Layers</div>
              <div class="vx-btns">
                <button class="btn btn-quiet vx-sm" id="vx-l-add" title="New layer">+ Layer</button>
                <button class="btn btn-quiet vx-sm" id="vx-l-up" title="Move layer up">↑</button>
                <button class="btn btn-quiet vx-sm" id="vx-l-down" title="Move layer down">↓</button>
                <button class="btn btn-quiet vx-sm" id="vx-l-del" title="Delete layer">Delete</button>
              </div>
              <div class="vx-layers" id="vx-layers"></div>
            </div>
          </aside>
        </div>
        <p class="bd-hint" id="vx-hint"></p>
      </div>`;
    wire();
  }

  function wire() {
    const h = st.host;
    $("#vx-back").onclick = () => leave();
    $("#vx-name").oninput = (e) => { st.doc.name = e.target.value; changed(); };
    h.querySelectorAll("[data-tool]").forEach((b) => b.onclick = () => setTool(b.dataset.tool));
    $("#vx-sides").onchange = (e) => { st.polySides = clamp(Number(e.target.value) | 0, 3, 24); };
    $("#vx-points").onchange = (e) => { st.starPoints = clamp(Number(e.target.value) | 0, 3, 24); };
    $("#vx-undo").onclick = () => undo();
    $("#vx-redo").onclick = () => redo();
    $("#vx-zin").onclick = () => setZoom(st.zoom * 1.25);
    $("#vx-zout").onclick = () => setZoom(st.zoom / 1.25);
    $("#vx-fit").onclick = () => { fit(); draw(); };
    $("#vx-grid").onclick = () => { st.grid = !st.grid; draw(); };
    $("#vx-snap").onclick = () => { st.snap = !st.snap; draw(); };
    $("#vx-artboard").onclick = () => artboardDialog();
    $("#vx-place").onclick = () => placeDialog();
    $("#vx-import").onclick = () => importIntoDrawing();
    $("#vx-export").onclick = () => exportDialog();
    $("#vx-save").onclick = () => saveDialog();

    /* fill & stroke: one undo step per change, live while dragging a colour */
    let live = false;
    const startLive = () => { if (!live) { push(); live = true; } };
    const endLive = () => { live = false; changed(); };
    $("#vx-fill").addEventListener("input", (e) => { startLive(); setPaint("fill", e.target.value, true); });
    $("#vx-fill").addEventListener("change", endLive);
    $("#vx-stroke").addEventListener("input", (e) => { startLive(); setPaint("stroke", e.target.value, true); });
    $("#vx-stroke").addEventListener("change", endLive);
    h.querySelectorAll("[data-fill]").forEach((b) => b.onclick = () => {
      const k = b.dataset.fill;
      if (k === "none") return setPaint("fill", null);
      const base = typeof st.style.fill === "string" ? st.style.fill : "#9ad07a";
      setPaint("fill", {type: k, angle: 90, stops: [[0, base], [1, "#1f2430"]]});
    });
    h.querySelector("[data-stroke]").onclick = () => setPaint("stroke", null);
    $("#vx-sw").onchange = (e) => setProp("sw", clamp(Number(e.target.value) || 0, 0, 200));
    $("#vx-dash").onchange = (e) => setProp("dash", e.target.value ? e.target.value.split(" ").map(Number) : null);
    $("#vx-cap").onchange = (e) => setProp("cap", e.target.value);
    $("#vx-join").onchange = (e) => setProp("join", e.target.value);
    $("#vx-opacity").addEventListener("input", (e) => { startLive(); setProp("opacity", Number(e.target.value) / 100, true); });
    $("#vx-opacity").addEventListener("change", endLive);
    $("#vx-pal").onchange = (e) => { st.swatches = e.target.value; drawSwatches(); };

    ["x", "y", "w", "h"].forEach((k) => $("#vx-" + k).onchange = (e) => setBox(k, Number(e.target.value)));
    $("#vx-rot").onchange = (e) => { const a = Number(e.target.value) || 0; e.target.value = 0; rotateSelection(a); };
    $("#vx-fliph").onclick = () => flip(true);
    $("#vx-flipv").onclick = () => flip(false);
    h.querySelectorAll("[data-align]").forEach((b) => b.onclick = () => alignSelection(b.dataset.align));
    $("#vx-alignto").onchange = (e) => { st.toAlign = e.target.value; };
    h.querySelectorAll("[data-dist]").forEach((b) => b.onclick = () => {
      const items = selectedItems();
      if (items.length < 3) { SS.shared.toast("Choose three or more to space evenly."); return; }
      push(); V().distribute(items, b.dataset.dist, measure); changed(); draw();
    });
    h.querySelectorAll("[data-order]").forEach((b) => b.onclick = () => order(b.dataset.order));
    $("#vx-group").onclick = () => group();
    $("#vx-ungroup").onclick = () => ungroup();
    $("#vx-simplify").onclick = () => simplifySelected();
    h.querySelectorAll("[data-bool]").forEach((b) => b.onclick = () => combine(b.dataset.bool));
    $("#vx-l-add").onclick = () => act(() => {
      const l = {id: V().uid("L"), name: "Layer " + (st.doc.layers.length + 1), visible: true, locked: false, items: []};
      st.doc.layers.splice(layerIndex() + 1, 0, l);
      st.layer = l.id; st.sel = new Set();
    });
    $("#vx-l-del").onclick = () => act(() => {
      if (st.doc.layers.length < 2) { SS.shared.toast("A drawing needs at least one layer."); return false; }
      const i = layerIndex();
      st.doc.layers.splice(i, 1);
      st.layer = st.doc.layers[Math.max(0, i - 1)].id; st.sel = new Set();
    });
    $("#vx-l-up").onclick = () => act(() => moveLayer(1));
    $("#vx-l-down").onclick = () => act(() => moveLayer(-1));

    const svg = $("#vx-svg");
    svg.addEventListener("mousedown", onDown);
    svg.addEventListener("dblclick", onDouble);
    svg.addEventListener("mousemove", (e) => { if (!st.drag && st.pen) { st.hover = toDoc(e); draw(); } });
    svg.addEventListener("contextmenu", (e) => e.preventDefault());
    $("#vx-stage").addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(st.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, {passive: false});
    dropKeys();
    keyListener = (e) => onKey(e);
    window.addEventListener("keydown", keyListener);
  }

  /* ---- where things are ---- */

  const layer = () => st.doc.layers.find((l) => l.id === st.layer) || st.doc.layers[0];
  const layerIndex = () => st.doc.layers.indexOf(layer());
  const layerItems = () => layer().items;
  function selectedItems() {
    const out = [];
    st.doc.layers.forEach((l) => l.items.forEach((it) => { if (st.sel.has(it.id)) out.push(it); }));
    return out;
  }
  function moveLayer(by) {
    const i = layerIndex(), j = i + by;
    if (j < 0 || j >= st.doc.layers.length) return false;
    const l = st.doc.layers.splice(i, 1)[0];
    st.doc.layers.splice(j, 0, l);
  }

  function toDoc(e) {
    const r = $("#vx-svg").getBoundingClientRect(), M = margin();
    return [(e.clientX - r.left) / st.zoom - M, (e.clientY - r.top) / st.zoom - M];
  }
  const snapPt = (p) => (st.snap ? [Math.round(p[0] / st.gridSize) * st.gridSize, Math.round(p[1] / st.gridSize) * st.gridSize] : p);

  function fit() {
    const box = $("#vx-stage");
    const W = Math.max(300, ((box && box.clientWidth) || 800) - 40), H = Math.max(240, Math.round((window.innerHeight || 900) * 0.62));
    st.zoom = clamp(Math.min(W / (st.doc.w * 1.1), H / (st.doc.h * 1.1)), 0.05, 8);
  }
  function setZoom(z) { st.zoom = clamp(z, 0.05, 16); draw(); }
  function setTool(k) {
    if (st.pen) finishPen();
    st.tool = k; st.node = null;
    if (k !== "select" && k !== "direct" && k !== "picker" && k !== "hand") st.sel = new Set();
    draw();
  }

  /* ---- drawing on screen ---- */

  function draw() {
    const d = st.doc, z = st.zoom, M = margin();
    const svg = $("#vx-svg");
    if (!svg) return;
    svg.setAttribute("viewBox", `${-M} ${-M} ${d.w + 2 * M} ${d.h + 2 * M}`);
    svg.setAttribute("width", Math.round((d.w + 2 * M) * z));
    svg.setAttribute("height", Math.round((d.h + 2 * M) * z));
    const defs = [];
    const lw = 1 / z;                                       // one screen pixel
    let body = `<defs><pattern id="vx-check" width="${16 * lw}" height="${16 * lw}" patternUnits="userSpaceOnUse">
        <rect width="${16 * lw}" height="${16 * lw}" fill="#f2f2f2"/><rect width="${8 * lw}" height="${8 * lw}" fill="#dcdcdc"/>
        <rect x="${8 * lw}" y="${8 * lw}" width="${8 * lw}" height="${8 * lw}" fill="#dcdcdc"/></pattern></defs>
      <rect x="0" y="0" width="${d.w}" height="${d.h}" fill="${d.bg ? esc(d.bg) : "url(#vx-check)"}" class="vx-board"/>`;
    d.layers.forEach((l) => {
      if (!l.visible) return;
      body += `<g data-layer="${esc(l.id)}"${l.locked ? ' pointer-events="none"' : ""}>`;
      l.items.forEach((it) => {
        const art = V().itemSVG(it, defs, {prefix: "ed"});
        const hit = it.t === "path" ? `<path d="${V().pathD(it)}" fill="none" stroke="transparent" stroke-width="${Math.max(it.sw || 0, 10 * lw)}" pointer-events="stroke"/>` : "";
        body += `<g data-id="${esc(it.id)}"${it.locked ? ' pointer-events="none"' : ""}>${art}${hit}</g>`;
      });
      body += "</g>";
    });
    if (st.grid) {
      let g = "";
      for (let x = st.gridSize; x < d.w; x += st.gridSize) g += `M${x} 0V${d.h}`;
      for (let y = st.gridSize; y < d.h; y += st.gridSize) g += `M0 ${y}H${d.w}`;
      body += `<path d="${g}" stroke="rgba(43,108,176,.18)" stroke-width="${lw}" fill="none" pointer-events="none"/>`;
    }
    body += `<rect x="0" y="0" width="${d.w}" height="${d.h}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="${lw}" pointer-events="none"/>`;
    body += overlay(lw);
    svg.innerHTML = (defs.length ? `<defs>${defs.join("")}</defs>` : "") + body;
    paintPanels();
  }

  /** Selection box and handles, nodes, the pen's line, the marquee. */
  function overlay(lw) {
    let o = "";
    const items = selectedItems();
    const hs = 8 * lw;
    if (items.length && st.tool !== "direct") {
      const b = V().unionBounds(items, measure);
      const [x, y, w, h] = b;
      o += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#2b6cb0" stroke-width="${lw}" stroke-dasharray="${4 * lw} ${3 * lw}" pointer-events="none"/>`;
      if (st.tool === "select") {
        const pts = {nw: [x, y], n: [x + w / 2, y], ne: [x + w, y], e: [x + w, y + h / 2], se: [x + w, y + h], s: [x + w / 2, y + h], sw: [x, y + h], w: [x, y + h / 2]};
        Object.entries(pts).forEach(([k, p]) => {
          o += `<rect class="vx-h vx-h-${k}" data-h="${k}" x="${p[0] - hs / 2}" y="${p[1] - hs / 2}" width="${hs}" height="${hs}" fill="#fff" stroke="#2b6cb0" stroke-width="${lw}"/>`;
        });
        o += `<line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y - 26 * lw}" stroke="#2b6cb0" stroke-width="${lw}" pointer-events="none"/>
          <circle class="vx-h vx-h-rot" data-h="rot" cx="${x + w / 2}" cy="${y - 26 * lw}" r="${5 * lw}" fill="#2b6cb0"/>`;
      }
    }
    if (st.tool === "direct" || st.tool === "pen") {
      items.filter((i) => i.t === "path").forEach((it) => {
        o += `<path d="${V().pathD(it)}" fill="none" stroke="#2b6cb0" stroke-width="${lw}" pointer-events="none"/>`;
        it.subs.forEach((s, si) => s.nodes.forEach((n, ni) => {
          const on = st.node && st.node.id === it.id && st.node.sub === si && st.node.i === ni;
          if (on || st.tool === "pen") {
            ["in", "out"].forEach((w) => {
              const hx = w === "in" ? n.ix : n.ox, hy = w === "in" ? n.iy : n.oy;
              if (hx === n.x && hy === n.y) return;
              o += `<line x1="${n.x}" y1="${n.y}" x2="${hx}" y2="${hy}" stroke="#e0789e" stroke-width="${lw}" pointer-events="none"/>
                <circle data-hd="${esc(it.id)}|${si}|${ni}|${w}" cx="${hx}" cy="${hy}" r="${4 * lw}" fill="#e0789e"/>`;
            });
          }
          o += `<rect data-node="${esc(it.id)}|${si}|${ni}" x="${n.x - 4 * lw}" y="${n.y - 4 * lw}" width="${8 * lw}" height="${8 * lw}"
            fill="${on ? "#2b6cb0" : "#fff"}" stroke="#2b6cb0" stroke-width="${lw}" ${n.smooth ? `rx="${4 * lw}"` : ""}/>`;
        }));
      });
    }
    if (st.pen && st.hover) {
      const it = st.pen.item, s = it.subs[0], last = s.nodes[s.nodes.length - 1];
      o += `<line x1="${last.x}" y1="${last.y}" x2="${st.hover[0]}" y2="${st.hover[1]}" stroke="#e0789e" stroke-width="${lw}" stroke-dasharray="${4 * lw} ${3 * lw}" pointer-events="none"/>`;
    }
    if (st.marquee) {
      const [x0, y0, x1, y1] = st.marquee;
      o += `<rect x="${Math.min(x0, x1)}" y="${Math.min(y0, y1)}" width="${Math.abs(x1 - x0)}" height="${Math.abs(y1 - y0)}" fill="rgba(43,108,176,.08)" stroke="#2b6cb0" stroke-width="${lw}" pointer-events="none"/>`;
    }
    return o;
  }

  function paintPanels() {
    const h = st.host;
    h.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === st.tool));
    $("#vx-grid").classList.toggle("on", st.grid);
    $("#vx-snap").classList.toggle("on", st.snap);
    $("#vx-zoom").textContent = Math.round(st.zoom * 100) + "%";
    $("#vx-undo").disabled = !st.undo.length;
    $("#vx-redo").disabled = !st.redo.length;
    $("#vx-stage").dataset.tool = st.tool;
    $("#vx-dirty").textContent = st.dirty ? (st.asset ? "Saving…" : "Unsaved changes") : (st.asset ? "Saved" : "");
    const chip = $("#vx-stagechip");
    chip.textContent = st.asset ? (STAGES.find((x) => x[0] === st.asset.stage) || STAGES[0])[1] : "Not saved yet";
    chip.classList.toggle("is-done", !!(st.asset && st.asset.stage === "done"));
    /* what's chosen (or what new things will be made with) */
    const items = selectedItems(), one = items[0] || st.style;
    const hex = (p) => (typeof p === "string" && /^#[0-9a-f]{6}$/i.test(p) ? p : typeof p === "string" ? "#000000" : p && p.stops ? p.stops[0][1] : "#ffffff");
    $("#vx-fill").value = hex(one.fill);
    $("#vx-stroke").value = hex(one.stroke);
    $("#vx-sw").value = r2(one.sw || 0);
    $("#vx-dash").value = one.dash ? one.dash.join(" ") : "";
    $("#vx-cap").value = one.cap || "round";
    $("#vx-join").value = one.join || "round";
    $("#vx-opacity").value = Math.round((one.opacity == null ? 1 : one.opacity) * 100);
    $("#vx-opacity-n").textContent = $("#vx-opacity").value + "%";
    h.querySelectorAll("[data-fill]").forEach((b) => b.classList.toggle("on",
      b.dataset.fill === "none" ? !one.fill : !!(one.fill && one.fill.type === b.dataset.fill)));
    h.querySelector("[data-stroke]").classList.toggle("on", !one.stroke);
    drawGradient(one);
    const b = items.length ? V().unionBounds(items, measure) : null;
    ["x", "y", "w", "h"].forEach((k, i) => { const el = $("#vx-" + k); el.value = b ? r2(b[i]) : ""; el.disabled = !b; });
    drawLayers();
    drawSwatches();
    $("#vx-hint").textContent = hintFor();
  }

  function hintFor() {
    return {
      select: "Click to choose (Shift adds), drag to move (Alt drags a copy), drag the corners to size (Shift keeps proportions), the dot above to turn. Arrows nudge; Ctrl+D duplicates; Ctrl+G groups.",
      direct: "Click a shape to see its nodes. Drag a node or a handle; Alt breaks a smooth node; double-click a node for smooth/corner, double-click the line to add a node. Delete removes the node.",
      pen: "Click for corners, drag for curves. Click the first node to close the shape; Enter or Escape to finish an open line.",
      pencil: "Draw freely — the line is smoothed when you let go. End where you started to close it.",
      text: "Click where the words go. Double-click words with Select to change them.",
      picker: "Click something to take its colours — onto whatever is chosen, and for what you draw next.",
      hand: "Drag to move around. Ctrl + scroll zooms anywhere.",
    }[st.tool] || "Drag to draw (Shift: square / circle / 45°, Alt: from the centre). A click makes one at a handy size.";
  }

  function drawGradient(one) {
    const box = $("#vx-grad"), g = one.fill && one.fill.type ? one.fill : null;
    box.hidden = !g;
    if (!g) return;
    box.innerHTML = `${g.stops.map((s, i) => `<div class="vx-stop"><input type="color" data-stop="${i}" value="${/^#[0-9a-f]{6}$/i.test(s[1]) ? s[1] : "#000000"}">
        <input type="range" data-off="${i}" min="0" max="100" value="${Math.round(s[0] * 100)}">
        ${g.stops.length > 2 ? `<button class="btn btn-quiet vx-sm" data-unstop="${i}" title="Take this colour out">×</button>` : ""}</div>`).join("")}
      <div class="px-row"><button class="btn btn-quiet vx-sm" id="vx-addstop">+ Colour</button>
      ${g.type === "linear" ? `<label class="vx-mini">Angle <input type="number" id="vx-angle" value="${g.angle || 0}" step="15"></label>` : ""}</div>`;
    const edit = (fn) => { push(); const ng = V().clone(g); fn(ng); setPaint("fill", ng, true); changed(); };
    box.querySelectorAll("[data-stop]").forEach((el) => el.onchange = () => edit((ng) => { ng.stops[Number(el.dataset.stop)][1] = el.value; }));
    box.querySelectorAll("[data-off]").forEach((el) => el.onchange = () => edit((ng) => { ng.stops[Number(el.dataset.off)][0] = Number(el.value) / 100; ng.stops.sort((a, b) => a[0] - b[0]); }));
    box.querySelectorAll("[data-unstop]").forEach((el) => el.onclick = () => edit((ng) => { ng.stops.splice(Number(el.dataset.unstop), 1); }));
    box.querySelector("#vx-addstop").onclick = () => edit((ng) => { ng.stops.push([1, "#ffffff"]); ng.stops.sort((a, b) => a[0] - b[0]); });
    const ang = box.querySelector("#vx-angle");
    if (ang) ang.onchange = () => edit((ng) => { ng.angle = Number(ang.value) || 0; });
  }

  function drawLayers() {
    const box = $("#vx-layers");
    const icon = {path: "◇", text: "T", image: "▣", group: "▤"};
    box.innerHTML = st.doc.layers.slice().reverse().map((l) => `
      <div class="vx-layer ${l.id === st.layer ? "on" : ""}" data-layer-row="${esc(l.id)}">
        <button class="px-eye ${l.visible ? "" : "off"}" data-lv="${esc(l.id)}" title="Show or hide">${l.visible ? "◉" : "○"}</button>
        <button class="px-eye ${l.locked ? "" : "off"}" data-ll="${esc(l.id)}" title="Lock (nothing on it can be chosen)">${l.locked ? "🔒" : "🔓"}</button>
        <span class="vx-lname" data-lsel="${esc(l.id)}" title="Double-click to rename">${esc(l.name)}</span>
      </div>
      ${l.id === st.layer ? `<div class="vx-objects">${l.items.slice().reverse().map((it) => `
        <button class="vx-obj ${st.sel.has(it.id) ? "on" : ""}" data-obj="${esc(it.id)}">${icon[it.t] || "·"} ${esc(it.name || (it.t === "text" ? String(it.text).slice(0, 18) : it.t))}</button>`).join("")}</div>` : ""}`).join("");
    box.querySelectorAll("[data-lsel]").forEach((s) => {
      s.onclick = () => { st.layer = s.dataset.lsel; st.sel = new Set(); draw(); };
      s.ondblclick = () => renameLayer(s.dataset.lsel);
    });
    box.querySelectorAll("[data-lv]").forEach((b) => b.onclick = () => act(() => { const l = st.doc.layers.find((x) => x.id === b.dataset.lv); l.visible = !l.visible; }));
    box.querySelectorAll("[data-ll]").forEach((b) => b.onclick = () => act(() => { const l = st.doc.layers.find((x) => x.id === b.dataset.ll); l.locked = !l.locked; st.sel = new Set(); }));
    box.querySelectorAll("[data-obj]").forEach((b) => b.onclick = (e) => {
      if (e.shiftKey) { if (st.sel.has(b.dataset.obj)) st.sel.delete(b.dataset.obj); else st.sel.add(b.dataset.obj); }
      else st.sel = new Set([b.dataset.obj]);
      if (st.tool !== "select" && st.tool !== "direct") st.tool = "select";
      draw();
    });
  }

  function renameLayer(id) {
    const l = st.doc.layers.find((x) => x.id === id);
    const d = SS.shared.openDlg("Rename layer", `<input class="input" id="vx-lrn" value="${esc(l.name)}">`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Rename", "btn-save", () => { const v = d.body.querySelector("#vx-lrn").value.trim(); if (v) act(() => { l.name = v; }); d.close(); });
  }

  function docColours() {
    const seen = new Set();
    const add = (p) => { if (typeof p === "string") seen.add(p.toLowerCase()); else if (p && p.stops) p.stops.forEach((s) => seen.add(String(s[1]).toLowerCase())); };
    const walk = (it) => { add(it.fill); add(it.stroke); (it.items || []).forEach(walk); };
    st.doc.layers.forEach((l) => l.items.forEach(walk));
    return [...seen].filter((c) => /^#[0-9a-f]{3,8}$/.test(c));
  }

  function drawSwatches() {
    const box = $("#vx-swatches");
    const pal = st.swatches === "__doc" ? docColours()
      : ((window.PixelCore && PixelCore.PALETTES.find((p) => p.name === st.swatches)) || {colours: []}).colours;
    box.innerHTML = pal.map((c) => `<button class="px-sw" data-sw="${esc(c)}" style="background:${esc(c)}" title="${esc(c)}"></button>`).join("")
      || `<p class="sb-note">No colours yet.</p>`;
    box.querySelectorAll("[data-sw]").forEach((b) => {
      b.onclick = () => setPaint("fill", b.dataset.sw);
      b.oncontextmenu = (e) => { e.preventDefault(); setPaint("stroke", b.dataset.sw); };
    });
  }

  /* ---- changing what's chosen ---- */

  function setPaint(which, value, live) {
    st.style[which] = value;
    const items = selectedItems();
    if (items.length) {
      if (!live) push();
      const go = (it) => { if (it.t === "group") it.items.forEach(go); else if (it.t !== "image") it[which] = value; };
      items.forEach(go);
      if (which === "stroke" && value && !items.every((i) => i.sw)) items.forEach((i) => { if (!i.sw && i.t === "path") i.sw = st.style.sw || 2; });
      if (!live) changed();
    }
    draw();
  }

  function setProp(k, v, live) {
    st.style[k] = v;
    const items = selectedItems();
    if (items.length) {
      if (!live) push();
      const go = (it) => { if (it.t === "group") { if (k === "opacity") it.opacity = v; else it.items.forEach(go); } else it[k] = v; };
      items.forEach(go);
      if (!live) changed();
    }
    draw();
  }

  function setBox(k, v) {
    const items = selectedItems();
    if (!items.length || !Number.isFinite(v)) return;
    const b = V().unionBounds(items, measure);
    push();
    let m;
    if (k === "x") m = V().translate(v - b[0], 0);
    else if (k === "y") m = V().translate(0, v - b[1]);
    else {
      const keep = $("#vx-ratio").checked;
      const sx = k === "w" ? (b[2] ? v / b[2] : 1) : keep && b[3] ? v / b[3] : 1;
      const sy = k === "h" ? (b[3] ? v / b[3] : 1) : keep && b[2] ? v / b[2] : 1;
      m = V().scaleAbout(sx, sy, b[0], b[1]);
    }
    items.forEach((it) => V().transform(it, m));
    changed(); draw();
  }

  function rotateSelection(deg) {
    const items = selectedItems();
    if (!items.length || !deg) return;
    const b = V().unionBounds(items, measure);
    push();
    items.forEach((it) => V().transform(it, V().rotateAbout(deg, b[0] + b[2] / 2, b[1] + b[3] / 2)));
    changed(); draw();
  }

  function flip(across) {
    const items = selectedItems();
    if (!items.length) return;
    const b = V().unionBounds(items, measure);
    push();
    items.forEach((it) => V().transform(it, V().scaleAbout(across ? -1 : 1, across ? 1 : -1, b[0] + b[2] / 2, b[1] + b[3] / 2)));
    changed(); draw();
  }

  function alignSelection(how) {
    const items = selectedItems();
    if (!items.length) { SS.shared.toast("Choose something to align."); return; }
    const to = st.toAlign === "artboard" || items.length === 1 ? [0, 0, st.doc.w, st.doc.h] : V().unionBounds(items, measure);
    push(); V().align(items, how, to, measure); changed(); draw();
  }

  function order(how) {
    const list = layerItems(), chosen = list.filter((i) => st.sel.has(i.id));
    if (!chosen.length) return;
    push();
    if (how === "front" || how === "back") {
      chosen.forEach((it) => list.splice(list.indexOf(it), 1));
      if (how === "front") list.push(...chosen); else list.unshift(...chosen);
    } else {
      const up = how === "up";
      (up ? chosen.slice().reverse() : chosen).forEach((it) => {
        const i = list.indexOf(it), j = up ? i + 1 : i - 1;
        if (j < 0 || j >= list.length || st.sel.has(list[j].id)) return;
        [list[i], list[j]] = [list[j], list[i]];
      });
    }
    changed(); draw();
  }

  function group() {
    const list = layerItems(), chosen = list.filter((i) => st.sel.has(i.id));
    if (chosen.length < 2) { SS.shared.toast("Choose two or more to group."); return; }
    push();
    const at = list.indexOf(chosen[chosen.length - 1]);
    const g = {id: V().uid("g"), t: "group", items: chosen.slice(), opacity: 1};
    list.splice(at + 1, 0, g);
    chosen.forEach((it) => list.splice(list.indexOf(it), 1));
    st.sel = new Set([g.id]);
    changed(); draw();
    return g;
  }

  function ungroup() {
    const list = layerItems(), gs = list.filter((i) => st.sel.has(i.id) && i.t === "group");
    if (!gs.length) return;
    push();
    const sel = new Set();
    gs.forEach((g) => {
      const at = list.indexOf(g);
      if (g.opacity != null && g.opacity < 1) g.items.forEach((c) => { c.opacity = (c.opacity == null ? 1 : c.opacity) * g.opacity; });
      list.splice(at, 1, ...g.items);
      g.items.forEach((c) => sel.add(c.id));
    });
    st.sel = sel;
    changed(); draw();
  }

  /* ---- undo ---- */

  function push() {
    st.undo.push(JSON.stringify({doc: st.doc, sel: [...st.sel], layer: st.layer}));
    if (st.undo.length > UNDO_MAX) st.undo.shift();
    st.redo = [];
  }
  function restore(s) {
    const o = JSON.parse(s);
    st.doc = o.doc; st.sel = new Set(o.sel); st.layer = o.layer; st.node = null;
  }
  function undo() {
    const s = st.undo.pop();
    if (!s) return;
    st.redo.push(JSON.stringify({doc: st.doc, sel: [...st.sel], layer: st.layer}));
    restore(s); changed(); draw();
  }
  function redo() {
    const s = st.redo.pop();
    if (!s) return;
    st.undo.push(JSON.stringify({doc: st.doc, sel: [...st.sel], layer: st.layer}));
    restore(s); changed(); draw();
  }
  function act(fn) {
    const before = JSON.stringify({doc: st.doc, sel: [...st.sel], layer: st.layer});
    if (fn() === false) return;
    st.undo.push(before);
    if (st.undo.length > UNDO_MAX) st.undo.shift();
    st.redo = [];
    changed(); draw();
  }

  function changed() {
    st.dirty = true;
    if (st.asset) {
      clearTimeout(st.saveTimer);
      st.saveTimer = setTimeout(() => save(), 1500);
    }
    if (st.host.querySelector(".vx-ed")) {
      $("#vx-dirty").textContent = st.asset ? "Saving…" : "Unsaved changes";
    }
  }

  /* ---- the pointer ---- */

  function onDown(e) {
    if (e.button === 1) return;
    e.preventDefault();
    const pt = toDoc(e);
    if (st.tool === "hand") {
      const box = $("#vx-stage"), sx = box.scrollLeft, sy = box.scrollTop, x0 = e.clientX, y0 = e.clientY;
      const move = (ev) => { box.scrollLeft = sx - (ev.clientX - x0); box.scrollTop = sy - (ev.clientY - y0); };
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      return;
    }
    const target = e.target;
    down(pt, {shift: e.shiftKey, alt: e.altKey, target});
    const move = (ev) => drag(toDoc(ev), {shift: ev.shiftKey, alt: ev.altKey});
    const up = (ev) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      release(toDoc(ev), {shift: ev.shiftKey, alt: ev.altKey});
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  const hitId = (target) => {
    const g = target && target.closest && target.closest("[data-id]");
    return g ? g.dataset.id : null;
  };

  /** The press: what it starts depends on the tool and what's under it.
      `opts.target` is the element under the pointer (tests pass one). */
  function down(pt, opts) {
    opts = opts || {};
    const t = opts.target, tool = st.tool;
    const handle = t && t.dataset && t.dataset.h;
    if (tool === "select") {
      if (handle) return startTransform(handle, pt, opts);
      const id = hitId(t);
      if (id) {
        if (opts.shift) { if (st.sel.has(id)) st.sel.delete(id); else st.sel.add(id); }
        else if (!st.sel.has(id)) st.sel = new Set([id]);
        push();
        if (opts.alt) {                                       // Alt-drag: a copy
          const list = layerItems(), copies = selectedItems().map((it) => V().reId(V().clone(it)));
          list.push(...copies);
          st.sel = new Set(copies.map((c) => c.id));
        }
        st.drag = {kind: "move", from: pt, orig: selectedItems().map((it) => V().clone(it)), moved: false};
        draw();
        return;
      }
      if (!opts.shift) st.sel = new Set();
      st.drag = {kind: "marquee", from: pt};
      st.marquee = [pt[0], pt[1], pt[0], pt[1]];
      draw();
      return;
    }
    if (tool === "direct") {
      const nodeRef = t && t.dataset && (t.dataset.node || t.dataset.hd);
      if (nodeRef) {
        const [id, si, ni, which] = nodeRef.split("|");
        const it = V().find(st.doc, id).item;
        st.node = {id, sub: Number(si), i: Number(ni)};
        push();
        st.drag = {kind: which ? "handle" : "node", which, it, from: pt, last: pt, brk: opts.alt};
        draw();
        return;
      }
      const id = hitId(t);
      st.sel = id ? new Set([id]) : new Set();
      st.node = null;
      if (!id) { st.drag = {kind: "marquee", from: pt}; st.marquee = [pt[0], pt[1], pt[0], pt[1]]; }
      draw();
      return;
    }
    if (tool === "picker") {
      const id = hitId(t);
      const src = id && V().find(st.doc, id) && V().find(st.doc, id).item;
      if (!src) return;
      const leaf = src.t === "group" ? src.items[0] : src;
      ["fill", "stroke", "sw"].forEach((k) => { if (leaf[k] !== undefined) st.style[k] = V().clone(leaf[k]); });
      const items = selectedItems().filter((i) => i.id !== src.id);
      if (items.length) {
        push();
        items.forEach((it) => { if (it.t !== "image") { it.fill = V().clone(leaf.fill); it.stroke = V().clone(leaf.stroke); it.sw = leaf.sw; } });
        changed();
      }
      draw();
      return;
    }
    if (tool === "text") { textDialog(null, snapPt(pt)); return; }
    if (tool === "pen") return penDown(snapPt(pt), opts);
    if (tool === "pencil") { st.drag = {kind: "pencil", pts: [pt]}; return; }
    /* the shape tools: drawn from where the press was */
    push();
    const it = makeShape(tool, snapPt(pt), snapPt(pt), opts);
    layerItems().push(it);
    st.sel = new Set([it.id]);
    st.drag = {kind: "shape", from: snapPt(pt), id: it.id};
    draw();
  }

  function makeShape(tool, a, b, opts) {
    let [x0, y0] = a, [x1, y1] = b;
    if (opts.shift && tool !== "line") {
      const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      x1 = x0 + Math.sign(x1 - x0 || 1) * s; y1 = y0 + Math.sign(y1 - y0 || 1) * s;
    }
    if (opts.shift && tool === "line") {
      const ang = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(x1 - x0, y1 - y0);
      x1 = x0 + len * Math.cos(ang); y1 = y0 + len * Math.sin(ang);
    }
    if (opts.alt && tool !== "line") { x0 = 2 * a[0] - x1; y0 = 2 * a[1] - y1; }
    const sty = V().clone(st.style);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
    if (tool === "rect") return V().rect(Math.min(x0, x1), Math.min(y0, y1), w, h, 0, sty);
    if (tool === "ellipse") return V().ellipse(cx, cy, w / 2, h / 2, sty);
    if (tool === "polygon") return V().polygon(cx, cy, Math.max(w, h) / 2, st.polySides, sty);
    if (tool === "star") return V().star(cx, cy, Math.max(w, h) / 2, Math.max(w, h) / 4.4, st.starPoints, sty);
    return V().polyline([[x0, y0], [x1, y1]], false, Object.assign(sty, {fill: null, stroke: sty.stroke || "#1f2430", sw: sty.sw || 3}));
  }

  function drag(pt, opts) {
    const d = st.drag;
    if (!d) return;
    opts = opts || {};
    if (d.kind === "move") {
      let dx = pt[0] - d.from[0], dy = pt[1] - d.from[1];
      if (opts.shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      if (st.snap) {
        const b = V().unionBounds(d.orig, measure);
        dx = Math.round((b[0] + dx) / st.gridSize) * st.gridSize - b[0];
        dy = Math.round((b[1] + dy) / st.gridSize) * st.gridSize - b[1];
      }
      selectedItems().forEach((it, i) => {
        const o = V().clone(d.orig[i]);
        V().transform(o, V().translate(dx, dy));
        Object.assign(it, o, {id: it.id});
      });
      d.moved = d.moved || Math.abs(dx) + Math.abs(dy) > 0;
    } else if (d.kind === "marquee") {
      st.marquee = [d.from[0], d.from[1], pt[0], pt[1]];
    } else if (d.kind === "shape") {
      const ref = V().find(st.doc, d.id);
      const made = makeShape(st.tool, d.from, snapPt(pt), opts);
      made.id = d.id;
      ref.list[ref.index] = made;
    } else if (d.kind === "pencil") {
      d.pts.push(pt);
      const s = layerItems();
      if (!d.id) {                                                 // the first move: one undo step, then drawn live
        push();
        const it = V().polyline(d.pts, false, Object.assign(V().clone(st.style), {fill: null, sw: st.style.sw || 3, stroke: st.style.stroke || "#1f2430"}));
        s.push(it); d.id = it.id;
      } else {
        const ref = V().find(st.doc, d.id);
        ref.item.subs = V().polyline(d.pts, false).subs;
      }
    } else if (d.kind === "node" || d.kind === "handle") {
      const it = d.it, n = it.subs[st.node.sub].nodes[st.node.i];
      const p = snapPt(pt);
      if (d.kind === "node") V().moveNode(n, p[0] - n.x, p[1] - n.y);
      else V().moveHandle(n, d.which, p[0], p[1], d.brk || opts.alt);
    } else if (d.kind === "transform") {
      transformDrag(pt, opts);
    } else if (d.kind === "pen") {
      const n = d.node;                                            // dragging out the new node's handles
      n.ox = pt[0]; n.oy = pt[1]; n.ix = 2 * n.x - pt[0]; n.iy = 2 * n.y - pt[1]; n.smooth = true;
    }
    draw();
  }

  function release(pt, opts) {
    const d = st.drag;
    st.drag = null;
    if (!d) return;
    if (d.kind === "marquee") {
      const [x0, y0, x1, y1] = st.marquee;
      st.marquee = null;
      const box = [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
      if (box[2] > 2 / st.zoom || box[3] > 2 / st.zoom) {
        layerItems().forEach((it) => {
          const b = V().bounds(it, measure);
          if (b[0] < box[0] + box[2] && b[0] + b[2] > box[0] && b[1] < box[1] + box[3] && b[1] + b[3] > box[1]) st.sel.add(it.id);
        });
      }
      draw();
      return;
    }
    if (d.kind === "move") {
      if (!d.moved && !opts.alt) st.undo.pop();                    // a plain click: nothing to undo
      else changed();
    } else if (d.kind === "shape") {
      const ref = V().find(st.doc, d.id), b = V().bounds(ref.item, measure);
      if (b[2] < 3 && b[3] < 3) {                                  // a click: a handy size
        const s = Math.round(Math.min(st.doc.w, st.doc.h) / 6);
        const made = makeShape(st.tool, [d.from[0] - s / 2, d.from[1] - s / 2], [d.from[0] + s / 2, d.from[1] + s / 2], {});
        made.id = d.id;
        ref.list[ref.index] = made;
      }
      changed();
      st.tool = "select";
    } else if (d.kind === "pencil") {
      if (d.pts.length < 2 || !d.id) { draw(); return; }
      const ref = V().find(st.doc, d.id);
      const first = d.pts[0], last = d.pts[d.pts.length - 1];
      const closed = d.pts.length > 4 && Math.hypot(last[0] - first[0], last[1] - first[1]) < 12 / st.zoom;
      const smooth = V().smoothPath(d.pts, closed, 1.5 / st.zoom, looks(ref.item));
      smooth.id = d.id;
      if (closed && !smooth.fill) smooth.fill = st.style.fill;
      ref.list[ref.index] = smooth;
      st.sel = new Set([d.id]);
      changed();
    } else if (d.kind === "node" || d.kind === "handle" || d.kind === "transform") {
      changed();
    } else if (d.kind === "pen") {
      changed();
    }
    draw();
  }

  /* ---- sizing and turning with the handles ---- */

  function startTransform(handle, pt, opts) {
    const items = selectedItems();
    if (!items.length) return;
    push();
    const b = V().unionBounds(items, measure);
    st.drag = {kind: "transform", handle, from: pt, box: b, orig: items.map((it) => V().clone(it))};
  }

  function transformDrag(pt, opts) {
    const d = st.drag, [x, y, w, h] = d.box, items = selectedItems();
    let m;
    if (d.handle === "rot") {
      const cx = x + w / 2, cy = y + h / 2;
      let a = (Math.atan2(pt[1] - cy, pt[0] - cx) - Math.atan2(d.from[1] - cy, d.from[0] - cx)) * 180 / Math.PI;
      if (opts.shift) a = Math.round(a / 15) * 15;
      m = V().rotateAbout(a, cx, cy);
    } else {
      const H = d.handle;
      const ax = H.includes("w") ? x + w : H.includes("e") ? x : x + w / 2;
      const ay = H.includes("n") ? y + h : H.includes("s") ? y : y + h / 2;
      let sx = H.includes("w") || H.includes("e") ? (w ? (H.includes("w") ? ax - pt[0] : pt[0] - ax) / w : 1) : 1;
      let sy = H.includes("n") || H.includes("s") ? (h ? (H.includes("n") ? ay - pt[1] : pt[1] - ay) / h : 1) : 1;
      if (opts.shift && H.length === 2) { const k = Math.max(Math.abs(sx), Math.abs(sy)); sx = Math.sign(sx || 1) * k; sy = Math.sign(sy || 1) * k; }
      if (Math.abs(sx) < 0.01) sx = 0.01 * Math.sign(sx || 1);
      if (Math.abs(sy) < 0.01) sy = 0.01 * Math.sign(sy || 1);
      m = V().scaleAbout(sx, sy, ax, ay);
    }
    items.forEach((it, i) => {
      const o = V().clone(d.orig[i]);
      V().transform(o, m);
      Object.assign(it, o, {id: it.id});
    });
  }

  /* ---- the pen ---- */

  function penDown(pt, opts) {
    const lw = 1 / st.zoom;
    if (st.pen) {
      const it = st.pen.item, s = it.subs[0], first = s.nodes[0];
      if (s.nodes.length > 2 && Math.hypot(pt[0] - first.x, pt[1] - first.y) < 9 * lw) {   // back to the start: closed
        s.closed = true;
        if (!it.fill) it.fill = st.style.fill;
        finishPen();
        changed(); draw();
        return;
      }
      const n = V().node(pt[0], pt[1]);
      s.nodes.push(n);
      st.drag = {kind: "pen", node: n};
      draw();
      return;
    }
    push();
    const it = V().pathFrom([{nodes: [V().node(pt[0], pt[1])], closed: false}],
      Object.assign(V().clone(st.style), {fill: null, stroke: st.style.stroke || "#1f2430", sw: st.style.sw || 3}));
    layerItems().push(it);
    st.pen = {item: it};
    st.sel = new Set([it.id]);
    st.drag = {kind: "pen", node: it.subs[0].nodes[0]};
    draw();
  }

  function finishPen() {
    if (!st.pen) return;
    const it = st.pen.item;
    st.pen = null; st.hover = null;
    if (it.subs[0].nodes.length < 2) {                     // a single dot isn't a line
      const ref = V().find(st.doc, it.id);
      if (ref) ref.list.splice(ref.index, 1);
      st.sel = new Set();
    }
    changed();
    draw();
  }

  function onDouble(e) {
    const t = e.target;
    if (st.tool === "pen") { finishPen(); return; }
    if (st.tool === "direct") {
      if (t.dataset && t.dataset.node) {
        const [id, si, ni] = t.dataset.node.split("|");
        const it = V().find(st.doc, id).item, n = it.subs[Number(si)].nodes[Number(ni)];
        act(() => { V().setSmooth(n, !n.smooth); });
        return;
      }
      const id = hitId(t);
      const ref = id && V().find(st.doc, id);
      if (ref && ref.item.t === "path") addNodeAt(ref.item, toDoc(e));
      return;
    }
    if (st.tool === "select") {
      const id = hitId(t);
      const ref = id && V().find(st.doc, id);
      if (ref && ref.item.t === "text") textDialog(ref.item);
      else if (ref && ref.item.t === "path") { st.tool = "direct"; draw(); }
    }
  }

  /* ---- words ---- */

  function textDialog(it, at) {
    const cur = it || {text: "", font: "sans-serif", size: Math.round(Math.max(24, Math.min(st.doc.w, st.doc.h) / 12)), weight: 700, italic: false};
    const d = SS.shared.openDlg(it ? "Words" : "Add words", `
      <textarea class="input vx-words" id="vx-t-words" rows="3" placeholder="Type here">${esc(cur.text)}</textarea>
      <div class="pc-row">
        <label>Font <select class="input" id="vx-t-font">${Object.keys(V().FONTS).map((f) => `<option value="${f}" ${f === cur.font ? "selected" : ""}>${esc({"sans-serif": "Sans", serif: "Serif", mono: "Typewriter", hand: "Handwritten", display: "Bold display"}[f] || f)}</option>`).join("")}</select></label>
        <label>Size <input class="input pc-num" id="vx-t-size" type="number" min="4" max="2000" value="${Math.round(cur.size)}"></label>
        <label class="vx-mini"><input type="checkbox" id="vx-t-bold" ${cur.weight >= 600 ? "checked" : ""}> Bold</label>
        <label class="vx-mini"><input type="checkbox" id="vx-t-italic" ${cur.italic ? "checked" : ""}> Italic</label>
      </div>`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn(it ? "Save" : "Add", "btn-save", () => {
      const words = d.body.querySelector("#vx-t-words").value;
      if (!words.trim()) { d.close(); return; }
      const opts = {text: words, font: d.body.querySelector("#vx-t-font").value, size: clamp(Number(d.body.querySelector("#vx-t-size").value) || 48, 4, 2000),
                    weight: d.body.querySelector("#vx-t-bold").checked ? 700 : 400, italic: d.body.querySelector("#vx-t-italic").checked};
      act(() => {
        if (it) Object.assign(it, opts);
        else {
          const t = V().text(at[0], at[1] + opts.size * 0.8, words, {fill: typeof st.style.fill === "string" ? st.style.fill : "#1f2430"});
          Object.assign(t, opts);
          layerItems().push(t);
          st.sel = new Set([t.id]);
        }
      });
      st.tool = "select";
      d.close();
      draw();
    });
    const f = d.body.querySelector("#vx-t-words");
    f.focus();
    return d;
  }

  /* ---- keys ---- */

  function onKey(e) {
    if (!st || !document.body.contains(st.host) || !st.host.querySelector(".vx-ed")) { dropKeys(); return; }
    if (document.querySelector("#modal-veil.open, #confirm-veil.open")) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "") || e.target.isContentEditable) return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    const low = k.toLowerCase();
    if (ctrl && low === "z") { e.preventDefault(); (e.shiftKey ? redo : undo)(); return; }
    if (ctrl && low === "y") { e.preventDefault(); redo(); return; }
    if (ctrl && low === "s") { e.preventDefault(); saveDialog(); return; }
    if (ctrl && low === "a") { e.preventDefault(); st.sel = new Set(layerItems().map((i) => i.id)); if (st.tool !== "direct") st.tool = "select"; draw(); return; }
    if (ctrl && low === "d") { e.preventDefault(); duplicate(); return; }
    if (ctrl && low === "g") { e.preventDefault(); (e.shiftKey ? ungroup : group)(); return; }
    if (ctrl && low === "c") { clip = selectedItems().map((i) => V().clone(i)); return; }
    if (ctrl && low === "x") { clip = selectedItems().map((i) => V().clone(i)); removeSelected(); return; }
    if (ctrl && low === "v") { e.preventDefault(); paste(); return; }
    if (ctrl && (k === "]" || k === "}")) { e.preventDefault(); order(e.shiftKey ? "front" : "up"); return; }
    if (ctrl && (k === "[" || k === "{")) { e.preventDefault(); order(e.shiftKey ? "back" : "down"); return; }
    if (ctrl) return;
    if (k === "Escape") { if (st.pen) finishPen(); else { st.sel = new Set(); st.node = null; draw(); } return; }
    if (k === "Enter" && st.pen) { e.preventDefault(); finishPen(); return; }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); if (st.tool === "direct" && st.node) removeNode(); else removeSelected(); return; }
    if (k.startsWith("Arrow")) {
      const items = selectedItems();
      if (!items.length) return;
      e.preventDefault();
      const s = e.shiftKey ? 10 : 1, dx = k === "ArrowLeft" ? -s : k === "ArrowRight" ? s : 0, dy = k === "ArrowUp" ? -s : k === "ArrowDown" ? s : 0;
      push(); items.forEach((it) => V().transform(it, V().translate(dx, dy))); changed(); draw();
      return;
    }
    if (k === "+" || k === "=") { setZoom(st.zoom * 1.25); return; }
    if (k === "-") { setZoom(st.zoom / 1.25); return; }
    if (k === "0") { fit(); draw(); return; }
    const tool = TOOLS.find((t) => t[2].toLowerCase() === low);
    if (tool && !e.altKey) { e.preventDefault(); setTool(tool[0]); }
  }

  let clip = [];
  function duplicate() {
    const items = selectedItems();
    if (!items.length) return;
    act(() => {
      const copies = items.map((it) => { const c = V().reId(V().clone(it)); V().transform(c, V().translate(16, 16)); return c; });
      layerItems().push(...copies);
      st.sel = new Set(copies.map((c) => c.id));
    });
  }
  function paste() {
    if (!clip.length) return;
    act(() => {
      const copies = clip.map((it) => { const c = V().reId(V().clone(it)); V().transform(c, V().translate(16, 16)); return c; });
      clip = copies.map((c) => V().clone(c));
      layerItems().push(...copies);
      st.sel = new Set(copies.map((c) => c.id));
    });
  }
  function removeSelected() {
    if (!st.sel.size) return;
    act(() => {
      st.doc.layers.forEach((l) => { l.items = l.items.filter((it) => !st.sel.has(it.id)); });
      st.sel = new Set();
    });
  }
  function removeNode() {
    const ref = V().find(st.doc, st.node.id);
    if (!ref) return;
    act(() => {
      const s = ref.item.subs[st.node.sub];
      s.nodes.splice(st.node.i, 1);
      if (s.nodes.length < 2) ref.item.subs.splice(st.node.sub, 1);
      if (!ref.item.subs.length) { ref.list.splice(ref.index, 1); st.sel = new Set(); }
      st.node = null;
    });
  }

  /* ---- artboard, placing, importing ---- */

  function artboardDialog() {
    const d = SS.shared.openDlg("Artboard", `
      <div class="pc-row">
        <label>Width <input class="input pc-num" id="vx-aw" type="number" min="16" max="10000" value="${st.doc.w}"> px</label>
        <label>Height <input class="input pc-num" id="vx-ah" type="number" min="16" max="10000" value="${st.doc.h}"> px</label>
      </div>
      <label class="bd-pick"><input type="checkbox" id="vx-abg" ${st.doc.bg ? "checked" : ""}><span>A background colour</span>
        <input type="color" id="vx-abgc" value="${st.doc.bg || "#ffffff"}"></label>
      <p class="sb-note">Without a background the drawing is see-through — best for stickers and clip art.</p>`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Use these", "btn-save", () => {
      act(() => {
        st.doc.w = clamp(Number(d.body.querySelector("#vx-aw").value) | 0, 16, 10000);
        st.doc.h = clamp(Number(d.body.querySelector("#vx-ah").value) | 0, 16, 10000);
        st.doc.bg = d.body.querySelector("#vx-abg").checked ? d.body.querySelector("#vx-abgc").value : null;
      });
      d.close(); fit(); draw();
    });
  }

  /** Assets (as pictures), clip art (as real shapes) or a photo, onto the drawing. */
  async function placeDialog() {
    const assets = SS.AssetStore ? (await SS.AssetStore.list()) : [];
    const clipList = (SS.ClipArt && SS.ClipArt.LIST) || [];
    const d = SS.shared.openDlg("Place", `
      <div class="dlg-label">Clip art — as shapes you can edit</div>
      <div class="px-tpl-grid vx-place-grid">${clipList.map((a) => `<button class="px-tpl" data-pclip="${esc(a[0])}" title="${esc(a[1])}">${SS.ClipArt.svg(a[0], null, 40)}<span>${esc(a[1])}</span></button>`).join("")}</div>
      <div class="dlg-label">Your assets — as pictures</div>
      <div class="px-tpl-grid vx-place-grid">${assets.map((a) => `<button class="px-tpl" data-passet="${esc(a.id)}" title="${esc(a.name)}"><span class="vx-pthumb"></span><span>${esc(a.name)}</span></button>`).join("")
        || `<p class="sb-note">No assets yet.</p>`}</div>
      <button class="btn btn-quiet" id="vx-pphoto">A photo from Photos…</button>`, true);
    d.body.querySelectorAll("[data-passet]").forEach((b) => {
      SS.AssetStore.thumb(b.dataset.passet).then((u) => { const s = b.querySelector(".vx-pthumb"); if (u && s) s.style.backgroundImage = `url("${u}")`; }).catch(() => {});
      b.onclick = async () => { d.close(); await placeAsset(b.dataset.passet); };
    });
    d.body.querySelectorAll("[data-pclip]").forEach((b) => b.onclick = () => { d.close(); placeClip(b.dataset.pclip); });
    d.body.querySelector("#vx-pphoto").onclick = async () => {
      d.close();
      const photo = await SS.shared.pickFromLibrary({title: "Choose a photo to place"});
      if (!photo) return;
      const got = await SS.shared.Store.getPhotoData(photo.storedName || photo.stored_name || photo);
      const url = got && (got.dataUrl || got.url);
      if (url) placePicture(url, photo.caption || "Photo");
    };
    d.btn("Cancel", "btn-quiet", d.close);
  }

  function placeClip(id) {
    const got = importSVG(SS.ClipArt.svg(id, null, 256));
    const s = Math.min(st.doc.w, st.doc.h) / 3;
    fitInto(got.items, [(st.doc.w - s) / 2, (st.doc.h - s) / 2, s, s]);
    act(() => { layerItems().push(...got.items); st.sel = new Set(got.items.map((i) => i.id)); });
    setTool("select");
    st.sel = new Set(got.items.map((i) => i.id));
    draw();
    return got.items;
  }

  async function placeAsset(id) {
    const got = await SS.AssetStore.data(id);
    if (!got || !got.dataUrl) { SS.shared.toast("That asset couldn't be loaded.", "error"); return null; }
    return placePicture(got.dataUrl, got.name, got.w, got.h);
  }

  function placePicture(url, name, w, h) {
    const s = Math.min(st.doc.w, st.doc.h) / 2.5;
    const k = w && h ? Math.min(s / w, s / h) : 1;
    const W = w && h ? w * k : s, H = w && h ? h * k : s;
    const it = V().image(url, (st.doc.w - W) / 2, (st.doc.h - H) / 2, W, H);
    it.name = name || "Picture";
    act(() => { layerItems().push(it); st.sel = new Set([it.id]); });
    setTool("select");
    st.sel = new Set([it.id]);
    draw();
    return it;
  }

  async function importIntoDrawing() {
    const got = await SS.Store.call("vector_open_svg", [], "Opening an SVG");
    if (!got || got.cancelled) return;
    if (got.error) { SS.shared.toast(got.error, "error"); return; }
    let imp;
    try { imp = importSVG(got.text); } catch (e) { SS.shared.toast(e.message, "error"); return; }
    if (imp.x || imp.y) imp.items.forEach((it) => V().transform(it, V().translate(-imp.x, -imp.y)));
    act(() => {
      const l = {id: V().uid("L"), name: got.name || "Imported", visible: true, locked: false, items: imp.items};
      st.doc.layers.push(l);
      st.layer = l.id;
      st.sel = new Set(imp.items.map((i) => i.id));
    });
    SS.shared.toast(`“${got.name}” came in on a layer of its own.`);
  }

  /* ---- saving into Assets ---- */

  function svgText(opts) { return V().docSVG(st.doc, Object.assign({prefix: "d"}, opts || {})); }
  function svgDataUrl() {
    const b64 = window.PixelCore ? PixelCore.toB64(new TextEncoder().encode(svgText())) : btoa(unescape(encodeURIComponent(svgText())));
    return "data:image/svg+xml;base64," + b64;
  }

  function saveDialog() {
    const a = st.asset || {cat: st.doc.template === "sticky" ? "sticky" : "clipart", stage: "wip"};
    const cats = (SS.AssetStore && SS.AssetStore.CATEGORIES) || [["clipart", "Clip art"]];
    const d = SS.shared.openDlg(st.asset ? "Save drawing" : "Save into Assets", `
      <label class="dlg-label" for="vx-s-name">Name</label>
      <input class="input" id="vx-s-name" value="${esc(st.doc.name)}">
      <label class="dlg-label" for="vx-s-cat">Category</label>
      <select class="input" id="vx-s-cat">${cats.map(([k, n]) => `<option value="${k}" ${k === a.cat ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
      <div class="dlg-label">Where it goes</div>
      <div class="seg sb-seg" id="vx-s-stage">${STAGES.map(([k, n]) => `<button class="seg-btn ${k === a.stage ? "on" : ""}" data-s="${k}">${n}</button>`).join("")}</div>
      <p class="sb-note">Saved as an SVG picture (sharp at any size on a page) with the drawing kept for editing. Once saved, it saves itself as you work.</p>`);
    let stage = a.stage;
    d.body.querySelector("#vx-s-stage").addEventListener("click", (e) => {
      const b = e.target.closest("[data-s]");
      if (!b) return;
      d.body.querySelectorAll("#vx-s-stage .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
      stage = b.dataset.s;
    });
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save", "btn-save", async () => {
      st.doc.name = d.body.querySelector("#vx-s-name").value.trim() || st.doc.name;
      $("#vx-name").value = st.doc.name;
      const res = await save({cat: d.body.querySelector("#vx-s-cat").value, stage});
      if (res && res.ok) {
        d.close();
        SS.shared.toast(`“${st.doc.name}” is in Assets → ${stage === "wip" ? "In progress" : "Completed works"}.`);
      }
    });
    return d;
  }

  async function save(opts) {
    clearTimeout(st.saveTimer);
    if (st.pen) finishPen();
    const doc = st.doc, design = V().clone(doc), url = svgDataUrl();
    let res;
    if (!st.asset) {
      if (!opts) return null;
      res = await SS.Store.call("asset_add", [opts.cat, doc.name, url, design, [doc.w, doc.h], opts.stage], "Saving the drawing");
      if (res && res.ok) st.asset = {id: res.id, cat: opts.cat, stage: opts.stage};
    } else {
      const ch = {name: doc.name, dataUrl: url, design};
      if (opts) { ch.cat = opts.cat; ch.stage = opts.stage; }
      res = await SS.Store.call("asset_update", [st.asset.id, ch], "Saving the drawing");
      if (res && res.ok && opts) Object.assign(st.asset, opts);
    }
    if (!res || res.error) { SS.shared.toast((res && res.error) || "The drawing couldn't be saved.", "error"); return res; }
    if (SS.AssetStore) SS.AssetStore.forget(st.asset.id);
    st.dirty = false;
    if (st.host && st.host.querySelector(".vx-ed")) paintPanels();
    return res;
  }

  async function leave() {
    if (st.pen) finishPen();
    if (st.dirty && !st.asset) {
      const yes = await SS.shared.confirm({title: "Leave without saving?", body: "This drawing hasn't been saved into Assets yet.", yes: "Leave it"});
      if (!yes) return;
      st.dirty = false;
    }
    home(st.host);
  }

  /* ---- exporting ---- */

  async function saveFile(name, b64) {
    const res = await SS.Store.call("creative_save_file", [name, b64], "Saving the file");
    if (!res || res.cancelled) return res;
    if (res.error) { SS.shared.toast(res.error, "error"); return res; }
    SS.shared.toast(`Saved ${res.path}`);
    return res;
  }

  /** The drawing drawn into a PNG at `scale` (the browser does the drawing). */
  function pngOf(scale) {
    const w = Math.round(st.doc.w * scale), h = Math.round(st.doc.h * scale);
    const text = svgText({width: w, height: h});
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => reject(new Error("The drawing took too long to draw.")), 15000);
      img.onload = () => {
        clearTimeout(timer);
        try {
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/png").split(",")[1]);
        } catch (e) { reject(e); }
      };
      img.onerror = () => { clearTimeout(timer); reject(new Error("The drawing couldn't be drawn.")); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
    });
  }

  function exportDialog() {
    const d = SS.shared.openDlg("Export", `
      <div class="dlg-label">As</div>
      <div class="seg sb-seg" id="vx-x-kind"><button class="seg-btn on" data-k="svg">SVG (Inkscape, the web, Cricut…)</button>
        <button class="seg-btn" data-k="png">PNG picture</button></div>
      <div class="pc-row" id="vx-x-pngrow" hidden>
        <label>Size <select class="input" id="vx-x-scale">${[0.5, 1, 2, 3, 4].map((k) => `<option value="${k}" ${k === 1 ? "selected" : ""}>× ${k} (${Math.round(st.doc.w * k)} × ${Math.round(st.doc.h * k)})</option>`).join("")}</select></label>
      </div>`);
    let kind = "svg";
    d.body.querySelector("#vx-x-kind").addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]");
      if (!b) return;
      d.body.querySelectorAll("#vx-x-kind .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
      kind = b.dataset.k;
      d.body.querySelector("#vx-x-pngrow").hidden = kind !== "png";
    });
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Export…", "btn-save", async () => {
      const res = await exportAs(kind, Number(d.body.querySelector("#vx-x-scale").value));
      if (res && res.ok) d.close();
    });
    return d;
  }

  async function exportAs(kind, scale) {
    const base = (st.doc.name || "drawing").replace(/[^\w -]/g, "").trim() || "drawing";
    if (kind === "png") {
      try { return saveFile(base + ".png", await pngOf(scale || 1)); } catch (e) { SS.shared.toast(e.message, "error"); return null; }
    }
    const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgText();
    const b64 = window.PixelCore ? PixelCore.toB64(new TextEncoder().encode(text)) : btoa(unescape(encodeURIComponent(text)));
    return saveFile(base + ".svg", b64);
  }

  /* ------------------------------------------------------------- mounting */

  SS.Vector = {
    VIEWS: ["vector:studio"],
    PREFIX: "vector:",
    async mount(host) {
      host.style.display = "";
      try { await ensurePaper(); } catch (e) {
        SS.shared.toast(e.message + " Drawing works; combining shapes and opening SVG files won't.", "error");
      }
      const job = SS.Vector._pending;
      SS.Vector._pending = null;
      await home(host);
      if (job) return job(host);
    },
    openAsset(id) { SS.Vector._pending = (host) => openAsset(host, id); SS.go("vector:studio"); },
    PAPER_SRC,
    _test: {state: () => st, ensurePaper, openEditor, down, drag, release, undo, redo, combine, group, ungroup, order, setPaint, setProp,
            setBox, flip, alignSelection, importSVG, fromPaper, toPaper, startFromClip, openSvgText, placeClip, placePicture,
            save, saveDialog, exportAs, exportDialog, svgText, textDialog, finishPen, setTool, duplicate, removeSelected,
            simplifySelected, addNodeAt, home, leave, rotateSelection, pngOf},
  };
})();
