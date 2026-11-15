/* ==========================================================================
   Pixel art — Creative → Pixel art (view pixel:studio).

   Cam (2026-10-04): "Create a pixel art creator in the creative section as
   well where i can make game assests think asesprite style with the side
   bars, layering, animation, colour palettes (default and ability to create
   or import palettes. Also the ability to export to asesprite or png. I can
   choose to save them as in progress or completed works. Please provide
   starting pet templates i can build off as well :)"

   Aseprite's layout: tools down the left, the sprite in the middle, preview,
   colour and palette down the right, and the timeline along the bottom --
   layers as rows, frames as columns. The picture work is PixelCore
   (pixelcore.js, tested on its own); this file draws and listens.

   A sprite is an asset (Creative → Assets): its picture (frame 1, enlarged so
   it stays crisp on a page) plus the whole project as the asset's design, in
   progress or completed. Templates are every NeuroPets sprite (ui/pet/
   petart.js); pets come as a four-frame idle on three layers.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const C = () => window.PixelCore;

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* [key, name, shortcut, icon path] -- Aseprite's letters where it has them */
  const TOOLS = [
    ["pencil", "Pencil", "B", '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>'],
    ["eraser", "Eraser", "E", '<path d="M4 16l8-8 8 8-4 4H8zM12 8l4 4"/>'],
    ["bucket", "Paint bucket", "G", '<path d="M5 11l7-7 7 7-7 7zM19 15c1 2 2 3 2 4a2 2 0 0 1-4 0c0-1 1-2 2-4z"/>'],
    ["line", "Line", "L", '<path d="M5 19L19 5"/>'],
    ["rect", "Rectangle", "U", '<rect x="4" y="6" width="16" height="12"/>'],
    ["ellipse", "Ellipse", "O", '<ellipse cx="12" cy="12" rx="8" ry="6"/>'],
    ["picker", "Eyedropper", "I", '<path d="M14 4l6 6-2 2-6-6zM12 8L5 15v4h4l7-7"/>'],
    ["move", "Move", "V", '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'],
  ];
  const SIZES = [16, 24, 32, 48, 64, 128];
  const STAGES = [["wip", "In progress"], ["done", "Completed works"]];
  const UNDO_MAX = 60;

  let st = null;           // the open sprite and everything about the editor
  let customPalettes = [];
  let keyListener = null;  // the editor's keys, while it's on screen
  function dropKeys() { if (keyListener) window.removeEventListener("keydown", keyListener); keyListener = null; }

  const store = {
    list: async () => ((SS.AssetStore ? await SS.AssetStore.list(true) : []) || []).filter((a) => a.kind === "pixel"),
    palettes: async () => ((await SS.Store.call("pixel_palettes", [], "Your palettes")) || {}).palettes || [],
    savePalettes: (list) => SS.Store.call("pixel_palettes_save", [list], "Saving your palettes"),
  };

  function allPalettes() {
    const np = window.PetArt ? [{name: "NeuroPets", colours: C().neuroPetsPalette(window.PetArt), builtin: true}] : [];
    return [...np, ...C().PALETTES.map((p) => ({...p, builtin: true})), ...customPalettes];
  }

  /* --------------------------------------------------------- the home page */

  async function home(host) {
    dropKeys();
    if (st) {                                  // a saved sprite's last changes are never lost
      clearTimeout(st.saveTimer);
      if (st.playing) clearTimeout(st.playing);
      if (st.dirty && st.asset) await save();
    }
    st = null;
    customPalettes = await store.palettes();
    const mine = await store.list();
    const tiles = (list) => list.map((a) => `
      <button class="px-tile" data-open="${esc(a.id)}" title="Open “${esc(a.name)}”">
        <span class="px-tile-img"></span><span class="px-tile-name">${esc(a.name)}</span>
        <span class="px-tile-meta">${esc(a.updated ? a.updated.slice(0, 10) : "")}</span></button>`).join("");
    const wip = mine.filter((a) => a.stage === "wip"), done = mine.filter((a) => a.stage !== "wip");
    host.innerHTML = `
      <div class="bd-head px-head">
        <h2 class="page-h">Pixel art</h2>
        <p class="stamp">Sprites and game assets, Aseprite-style: layers, frames, palettes. Saved into Assets,
          exported as PNG or .aseprite.</p>
        <div class="bd-actions">
          <button class="btn btn-primary" id="px-new">+ New sprite</button>
          <button class="btn btn-quiet" id="px-tpl">Start from a NeuroPets template</button>
        </div>
      </div>
      <h3 class="as-sec">In progress <span>${wip.length}</span></h3>
      ${wip.length ? `<div class="px-tiles">${tiles(wip)}</div>` : `<p class="bd-empty">Nothing in progress.</p>`}
      <h3 class="as-sec">Completed works <span>${done.length}</span></h3>
      ${done.length ? `<div class="px-tiles">${tiles(done)}</div>` : `<p class="bd-empty">No finished sprites yet.</p>`}`;
    host.querySelector("#px-new").onclick = () => newDialog(host);
    host.querySelector("#px-tpl").onclick = () => templateDialog(host);
    host.querySelectorAll("[data-open]").forEach((b) => {
      SS.AssetStore.thumb(b.dataset.open).then((url) => {
        const s = b.querySelector(".px-tile-img");
        if (url && s) s.style.backgroundImage = `url("${url}")`;
      }).catch(() => {});
      b.onclick = () => openAsset(host, b.dataset.open);
    });
  }

  function newDialog(host) {
    const d = SS.shared.openDlg("New sprite", `
      <label class="dlg-label" for="px-n-name">Name</label>
      <input class="input" id="px-n-name" value="New sprite">
      <div class="dlg-label">Size (pixels)</div>
      <div class="seg sb-seg" id="px-n-size">${SIZES.map((n) => `<button class="seg-btn ${n === 32 ? "on" : ""}" data-n="${n}">${n} × ${n}</button>`).join("")}
        <button class="seg-btn" data-n="custom">Custom</button></div>
      <div class="pc-row" id="px-n-custom" hidden>
        <label>Width <input class="input pc-num" id="px-n-w" type="number" min="1" max="512" value="32"></label>
        <label>Height <input class="input pc-num" id="px-n-h" type="number" min="1" max="512" value="32"></label>
      </div>`);
    let size = 32;
    d.body.querySelector("#px-n-size").addEventListener("click", (e) => {
      const b = e.target.closest("[data-n]");
      if (!b) return;
      d.body.querySelectorAll("#px-n-size .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
      size = b.dataset.n === "custom" ? "custom" : Number(b.dataset.n);
      d.body.querySelector("#px-n-custom").hidden = size !== "custom";
    });
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Create", "btn-save", () => {
      const w = size === "custom" ? clamp(Number(d.body.querySelector("#px-n-w").value) | 0, 1, 512) : size;
      const h = size === "custom" ? clamp(Number(d.body.querySelector("#px-n-h").value) | 0, 1, 512) : size;
      const p = C().newProject(w, h, d.body.querySelector("#px-n-name").value.trim() || "New sprite");
      d.close();
      openEditor(host, p, null);
    });
  }

  /** The NeuroPets sprites to start from (Cam: "starting pet templates i can
      build off"). */
  function templateDialog(host) {
    const list = C().templates(window.PetArt, window.PetCore);
    const groups = [...new Set(list.map((t) => t.group))];
    const d = SS.shared.openDlg("Start from a NeuroPets template", `
      <div class="seg sb-seg" id="px-t-group">${groups.map((g, i) => `<button class="seg-btn ${i ? "" : "on"}" data-g="${esc(g)}">${esc(g)}</button>`).join("")}</div>
      <input class="input" id="px-t-q" type="search" placeholder="Search…" autocomplete="off">
      <div class="px-tpl-grid" id="px-t-grid"></div>
      <div class="pc-row">
        <label>Scale <select class="input" id="px-t-scale"><option value="1">× 1 (16 px)</option><option value="2">× 2 (32 px)</option>
          <option value="3">× 3 (48 px)</option><option value="4">× 4 (64 px)</option></select></label>
        <label>Canvas <select class="input" id="px-t-size"><option value="0">Just the sprite</option><option value="32">32 × 32</option>
          <option value="48">48 × 48</option><option value="64">64 × 64</option><option value="128">128 × 128</option></select></label>
      </div>
      <p class="sb-note">Pets come as a little idle animation (open, blink, open, happy) on three layers — Colour,
        Outline and Face — so you can recolour or redraw a face without touching the rest.</p>`, true);
    let group = groups[0], chosen = null;
    const draw = () => {
      const q = d.body.querySelector("#px-t-q").value.trim().toLowerCase();
      const shown = list.filter((t) => (q ? t.name.toLowerCase().includes(q) : t.group === group)).slice(0, 240);
      d.body.querySelector("#px-t-grid").innerHTML = shown.map((t) => `
        <button class="px-tpl ${chosen === t.id ? "on" : ""}" data-t="${esc(t.id)}" title="${esc(t.name)}">
          <img src="${templateThumb(t)}" alt=""><span>${esc(t.name)}</span></button>`).join("")
        || `<p class="sb-note">Nothing matches that.</p>`;
      d.body.querySelectorAll("[data-t]").forEach((b) => {
        b.onclick = () => { chosen = b.dataset.t; draw(); };
        b.ondblclick = () => { chosen = b.dataset.t; go(); };
      });
    };
    d.body.querySelector("#px-t-group").addEventListener("click", (e) => {
      const b = e.target.closest("[data-g]");
      if (!b) return;
      d.body.querySelectorAll("#px-t-group .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
      group = b.dataset.g; draw();
    });
    d.body.querySelector("#px-t-q").addEventListener("input", draw);
    const go = () => {
      const t = list.find((x) => x.id === chosen);
      if (!t) { SS.shared.toast("Choose a template first."); return; }
      const p = C().fromTemplate(window.PetArt, t, {scale: Number(d.body.querySelector("#px-t-scale").value),
                                                    size: Number(d.body.querySelector("#px-t-size").value)});
      d.close();
      openEditor(host, p, null);
    };
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Use this template", "btn-save", go);
    draw();
    return d;
  }

  const thumbCache = new Map();
  function templateThumb(t) {
    if (!thumbCache.has(t.id)) {
      const art = C().templateArt(window.PetArt, t);
      const r = C().fromRows(art.rows, art.pal);
      thumbCache.set(t.id, C().pngDataUrl(C().scaleUp(r.img, r.w, r.h, 4), r.w * 4, r.h * 4));
    }
    return thumbCache.get(t.id);
  }

  async function openAsset(host, id) {
    const got = await SS.Store.call("asset_design", [id], "Opening the sprite");
    if (!got || got.error || !got.design || got.design.kind !== "pixel") {
      SS.shared.toast((got && got.error) || "That isn't a pixel-art sprite.", "error");
      return null;
    }
    const meta = ((SS.AssetStore && await SS.AssetStore.list()) || []).find((a) => a.id === id) || {};
    let p;
    try { p = C().deserialise(got.design); } catch (e) { SS.shared.toast(e.message, "error"); return null; }
    if (meta.name) p.name = meta.name;
    return openEditor(host, p, {id, cat: meta.cat || "game", stage: meta.stage || "wip"});
  }

  /* ------------------------------------------------------------ the editor */

  function openEditor(host, p, asset) {
    st = {
      host, p, asset, layer: p.layers.length - 1, frame: 0, tool: "pencil",
      fg: [74, 52, 56, 255], bg: [0, 0, 0, 0], size: 1, mirror: false, fillShapes: false,
      grid: true, onion: false, zoom: 0, undo: [], redo: [], dirty: false, playing: null,
      palette: p.palette || allPalettes()[0] || C().PALETTES[0], pick: -1, saveTimer: null,
    };
    if (!p.palette) p.palette = {name: st.palette.name, colours: st.palette.colours.slice()};
    build();
    fitZoom();
    drawAll();
    return st;
  }

  function build() {
    const h = st.host, p = st.p;
    const tools = TOOLS.map(([k, name, key, path]) => `
      <button class="px-tool ${k === st.tool ? "on" : ""}" data-tool="${k}" title="${esc(name)} (${key})" aria-label="${esc(name)}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg></button>`).join("");
    h.innerHTML = `
      <div class="px-ed">
        <div class="px-bar">
          <button class="btn btn-quiet" id="px-back">← Pixel art</button>
          <input class="input px-name" id="px-name" value="${esc(p.name)}" aria-label="Name">
          <span class="px-chip" id="px-stage"></span>
          <span class="px-dirty" id="px-dirty"></span>
          <span class="px-grow"></span>
          <button class="btn btn-quiet" id="px-undo" title="Undo (Ctrl+Z)">Undo</button>
          <button class="btn btn-quiet" id="px-redo" title="Redo (Ctrl+Y)">Redo</button>
          <button class="btn btn-quiet" id="px-zout" title="Zoom out (-)">−</button>
          <span id="px-zoom" class="px-zoomlbl"></span>
          <button class="btn btn-quiet" id="px-zin" title="Zoom in (+)">+</button>
          <button class="btn btn-quiet px-tog" id="px-grid" title="Pixel grid">Grid</button>
          <button class="btn btn-quiet px-tog" id="px-onion" title="Onion skin: the frames either side, faint">Onion</button>
          <button class="btn btn-quiet px-tog" id="px-mirror" title="Mirror: draw both halves at once">Mirror</button>
          <button class="btn btn-quiet" id="px-canvas-size" title="Canvas size">Canvas…</button>
          <button class="btn btn-quiet" id="px-import" title="A PNG as a new layer">Import PNG…</button>
          <button class="btn btn-quiet" id="px-export">Export…</button>
          <button class="btn btn-primary" id="px-save" title="Save into Assets (Ctrl+S)">Save</button>
        </div>
        <div class="px-body">
          <aside class="px-tools" aria-label="Tools">
            ${tools}
            <div class="px-tlbl">Brush</div>
            <div class="px-sizes">${[1, 2, 3, 4].map((n) => `<button class="px-size ${n === 1 ? "on" : ""}" data-size="${n}" title="${n} px">${n}</button>`).join("")}</div>
            <label class="px-fillshapes" title="Rectangles and ellipses filled"><input type="checkbox" id="px-fillshapes"> Fill</label>
            <div class="px-tlbl">Colours</div>
            <div class="px-wells">
              <button class="px-well px-well-bg" id="px-bg" title="Background colour (right button draws with it)"></button>
              <button class="px-well px-well-fg" id="px-fg" title="Foreground colour"></button>
              <button class="px-swap" id="px-swap" title="Swap (X)">⇄</button>
            </div>
          </aside>
          <div class="px-stage" id="px-stage-box"><canvas id="px-canvas" class="px-canvas"></canvas></div>
          <aside class="px-side">
            <div class="px-panel">
              <div class="px-ptitle">Preview</div>
              <canvas id="px-preview" class="px-preview"></canvas>
              <div class="px-row"><button class="btn btn-quiet" id="px-play" title="Play the animation (Enter)">▶ Play</button>
                <span class="sb-note" id="px-info"></span></div>
            </div>
            <div class="px-panel">
              <div class="px-ptitle">Colour</div>
              <div class="px-row"><input type="color" id="px-col" aria-label="Colour">
                <input class="input px-hex" id="px-hex" aria-label="Hex colour" spellcheck="false"></div>
              <label class="px-row px-alpha">Alpha <input type="range" id="px-alpha" min="0" max="255"> <span id="px-alpha-n"></span></label>
            </div>
            <div class="px-panel">
              <div class="px-ptitle">Palette</div>
              <select class="input" id="px-pal" aria-label="Palette"></select>
              <div class="px-swatches" id="px-swatches"></div>
              <div class="px-row px-palbtns">
                <button class="btn btn-quiet" id="px-pal-add" title="Add the foreground colour">+</button>
                <button class="btn btn-quiet" id="px-pal-del" title="Take out the chosen colour">−</button>
                <button class="btn btn-quiet" id="px-pal-new" title="A new palette">New…</button>
                <button class="btn btn-quiet" id="px-pal-imp" title="GIMP .gpl, .hex (Lospec), JASC .pal, Paint.NET .txt, or a picture">Import…</button>
                <button class="btn btn-quiet" id="px-pal-exp" title="Save the palette as a GIMP .gpl file">Export</button>
              </div>
            </div>
          </aside>
        </div>
        <div class="px-timeline">
          <div class="px-tbar">
            <span class="px-tlbl2">Layers</span>
            <button class="btn btn-quiet" id="px-l-add" title="New layer">+</button>
            <button class="btn btn-quiet" id="px-l-dup" title="Duplicate layer">Copy</button>
            <button class="btn btn-quiet" id="px-l-del" title="Delete layer">Delete</button>
            <button class="btn btn-quiet" id="px-l-up" title="Move layer up">↑</button>
            <button class="btn btn-quiet" id="px-l-down" title="Move layer down">↓</button>
            <button class="btn btn-quiet" id="px-l-merge" title="Merge down">Merge down</button>
            <label class="px-op">Opacity <input type="range" id="px-l-op" min="0" max="255"></label>
            <span class="bd-sep"></span>
            <span class="px-tlbl2">Frames</span>
            <button class="btn btn-quiet" id="px-f-add" title="New empty frame">+</button>
            <button class="btn btn-quiet" id="px-f-dup" title="Duplicate frame (Alt+N)">Copy</button>
            <button class="btn btn-quiet" id="px-f-del" title="Delete frame">Delete</button>
            <button class="btn btn-quiet" id="px-f-left" title="Move frame left">←</button>
            <button class="btn btn-quiet" id="px-f-right" title="Move frame right">→</button>
            <label class="px-op">Duration <input class="input pc-num" type="number" id="px-f-dur" min="10" max="10000" step="10"> ms</label>
          </div>
          <div class="px-grid-wrap"><table class="px-cels" id="px-cels"></table></div>
        </div>
        <p class="bd-hint" id="px-hint">B pencil · E eraser · G bucket · L line · U rectangle · O ellipse · I eyedropper (or Alt+click) · V move ·
          X swap colours · [ ] brush · , . frames · Enter play · right button draws with the background colour</p>
      </div>`;
    wire();
  }

  const $ = (sel) => st.host.querySelector(sel);

  function wire() {
    const h = st.host;
    $("#px-back").onclick = () => leave();
    $("#px-name").oninput = (e) => { st.p.name = e.target.value; changed(); };
    h.querySelectorAll("[data-tool]").forEach((b) => b.onclick = () => setTool(b.dataset.tool));
    h.querySelectorAll("[data-size]").forEach((b) => b.onclick = () => setSize(Number(b.dataset.size)));
    $("#px-fillshapes").onchange = (e) => { st.fillShapes = e.target.checked; };
    $("#px-swap").onclick = () => swapColours();
    $("#px-fg").onclick = () => $("#px-col").click();
    $("#px-bg").onclick = () => { st.bg = st.bg[3] ? [0, 0, 0, 0] : st.fg.slice(); paintWells(); };
    $("#px-col").oninput = (e) => { const c = C().hexToRgba(e.target.value); c[3] = st.fg[3] || 255; setFg(c); };
    $("#px-hex").onchange = (e) => { const c = C().hexToRgba(e.target.value); if (c[3] || /^#?[0-9a-f]{8}$/i.test(e.target.value)) setFg(c); };
    $("#px-alpha").oninput = (e) => { st.fg[3] = Number(e.target.value); paintWells(); };
    $("#px-undo").onclick = () => undo();
    $("#px-redo").onclick = () => redo();
    $("#px-zin").onclick = () => setZoom(st.zoom + (st.zoom >= 8 ? 4 : 1));
    $("#px-zout").onclick = () => setZoom(st.zoom - (st.zoom > 8 ? 4 : 1));
    $("#px-grid").onclick = () => { st.grid = !st.grid; drawAll(); };
    $("#px-onion").onclick = () => { st.onion = !st.onion; drawAll(); };
    $("#px-mirror").onclick = () => { st.mirror = !st.mirror; drawAll(); };
    $("#px-canvas-size").onclick = () => canvasDialog();
    $("#px-import").onclick = () => importPng();
    $("#px-export").onclick = () => exportDialog();
    $("#px-save").onclick = () => saveDialog();
    $("#px-play").onclick = () => togglePlay();
    $("#px-pal").onchange = (e) => choosePalette(e.target.value);
    $("#px-pal-add").onclick = () => paletteAdd();
    $("#px-pal-del").onclick = () => paletteDel();
    $("#px-pal-new").onclick = () => paletteNew();
    $("#px-pal-imp").onclick = () => paletteImport();
    $("#px-pal-exp").onclick = () => paletteExport();
    $("#px-l-add").onclick = () => act(() => { C().addLayer(st.p, null, st.layer + 1); st.layer += 1; });
    $("#px-l-dup").onclick = () => act(() => { C().duplicateLayer(st.p, st.layer); st.layer += 1; });
    $("#px-l-del").onclick = () => act(() => {
      if (!C().removeLayer(st.p, st.layer)) { SS.shared.toast("A sprite needs at least one layer."); return false; }
      st.layer = Math.max(0, st.layer - 1);
    });
    $("#px-l-up").onclick = () => act(() => { st.layer = C().moveLayer(st.p, st.layer, 1); });
    $("#px-l-down").onclick = () => act(() => { st.layer = C().moveLayer(st.p, st.layer, -1); });
    $("#px-l-merge").onclick = () => act(() => {
      if (!C().mergeDown(st.p, st.layer)) { SS.shared.toast("There's no layer below to merge into."); return false; }
      st.layer -= 1;
    });
    $("#px-l-op").onchange = (e) => act(() => { st.p.layers[st.layer].opacity = Number(e.target.value); });
    $("#px-f-add").onclick = () => act(() => { st.frame = C().addFrame(st.p, st.frame + 1); });
    $("#px-f-dup").onclick = () => act(() => { st.frame = C().addFrame(st.p, st.frame + 1, st.frame); });
    $("#px-f-del").onclick = () => act(() => {
      if (!C().removeFrame(st.p, st.frame)) { SS.shared.toast("A sprite needs at least one frame."); return false; }
      st.frame = Math.min(st.frame, st.p.frames.length - 1);
    });
    $("#px-f-left").onclick = () => act(() => { st.frame = C().moveFrame(st.p, st.frame, -1); });
    $("#px-f-right").onclick = () => act(() => { st.frame = C().moveFrame(st.p, st.frame, 1); });
    $("#px-f-dur").onchange = (e) => act(() => { st.p.frames[st.frame].dur = clamp(Number(e.target.value) | 0, 10, 10000); });

    const cv = $("#px-canvas");
    cv.addEventListener("mousedown", onDown);
    cv.addEventListener("mousemove", onHover);
    cv.addEventListener("mouseleave", () => { st.hover = null; drawCanvas(); });
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    $("#px-stage-box").addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(st.zoom + (e.deltaY < 0 ? 1 : -1));
    }, {passive: false});
    dropKeys();
    keyListener = (e) => onKey(e);
    window.addEventListener("keydown", keyListener);
    fillPaletteSelect();
  }

  /* ---- drawing on screen ---- */

  function fitZoom() {
    const box = $("#px-stage-box");
    const room = Math.max(200, Math.min((box && box.clientWidth) || 640, 900) - 40);
    /* the timeline must stay in view below it: about half the window */
    const roomH = Math.max(160, Math.round((window.innerHeight || 900) * 0.48) - 40);
    st.zoom = clamp(Math.floor(Math.min(room / st.p.w, roomH / st.p.h)), 1, 48);
  }
  function setZoom(z) { st.zoom = clamp(z | 0, 1, 64); drawAll(); }

  function drawAll() {
    paintToolbar();
    paintWells();
    drawCanvas();
    drawPreview();
    drawTimeline();
    drawSwatches();
  }

  function paintToolbar() {
    const h = st.host;
    h.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === st.tool));
    h.querySelectorAll("[data-size]").forEach((b) => b.classList.toggle("on", Number(b.dataset.size) === st.size));
    $("#px-grid").classList.toggle("on", st.grid);
    $("#px-onion").classList.toggle("on", st.onion);
    $("#px-mirror").classList.toggle("on", st.mirror);
    $("#px-zoom").textContent = st.zoom * 100 + "%";
    $("#px-undo").disabled = !st.undo.length;
    $("#px-redo").disabled = !st.redo.length;
    const stage = st.asset ? (STAGES.find((s) => s[0] === st.asset.stage) || STAGES[0])[1] : "Not saved yet";
    $("#px-stage").textContent = stage;
    $("#px-stage").classList.toggle("is-done", !!(st.asset && st.asset.stage === "done"));
    $("#px-dirty").textContent = st.dirty ? (st.asset ? "Saving…" : "Unsaved changes") : (st.asset ? "Saved" : "");
    $("#px-info").textContent = `${st.p.w} × ${st.p.h} · frame ${st.frame + 1}/${st.p.frames.length}`;
    const l = st.p.layers[st.layer];
    if (l) $("#px-l-op").value = l.opacity;
    $("#px-f-dur").value = (st.p.frames[st.frame] || {}).dur || 100;
  }

  function paintWells() {
    const css = (c) => `rgba(${c[0]},${c[1]},${c[2]},${(c[3] / 255).toFixed(3)})`;
    $("#px-fg").style.setProperty("--c", css(st.fg));
    $("#px-bg").style.setProperty("--c", css(st.bg));
    $("#px-bg").classList.toggle("is-clear", !st.bg[3]);
    $("#px-col").value = C().rgbaToHex([st.fg[0], st.fg[1], st.fg[2], 255]);
    $("#px-hex").value = C().rgbaToHex(st.fg);
    $("#px-alpha").value = st.fg[3];
    $("#px-alpha-n").textContent = st.fg[3];
  }

  /** The sprite at st.zoom: a checkerboard, the frames either side (onion),
      the frame, the grid, and where the brush is. */
  function drawCanvas() {
    const p = st.p, z = st.zoom, cv = $("#px-canvas");
    if (!cv) return;
    cv.width = p.w * z; cv.height = p.h * z;
    const ctx = cv.getContext && cv.getContext("2d");
    if (!ctx || !ctx.putImageData || typeof document.createElement("canvas").getContext !== "function") return;
    try {
      ctx.imageSmoothingEnabled = false;
      const cs = Math.max(4, Math.round(z * Math.max(1, p.w / 32)) );
      for (let y = 0; y < cv.height; y += cs) for (let x = 0; x < cv.width; x += cs) {
        ctx.fillStyle = ((x / cs + y / cs) & 1) ? "#cfcfd6" : "#e9e9ee";
        ctx.fillRect(x, y, cs, cs);
      }
      const put = (img, alpha) => {
        const off = document.createElement("canvas");
        off.width = p.w; off.height = p.h;
        const o = off.getContext("2d");
        const id = o.createImageData(p.w, p.h);
        id.data.set(img);
        o.putImageData(id, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.drawImage(off, 0, 0, p.w * z, p.h * z);
        ctx.globalAlpha = 1;
      };
      if (st.onion && !st.playing) {
        if (st.frame > 0) put(C().composite(p, st.frame - 1), 0.28);
        if (st.frame < p.frames.length - 1) put(C().composite(p, st.frame + 1), 0.14);
      }
      put(C().composite(p, st.frame), 1);
      if (st.grid && z >= 6) {
        ctx.strokeStyle = "rgba(0,0,0,.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 1; x < p.w; x++) { ctx.moveTo(x * z + 0.5, 0); ctx.lineTo(x * z + 0.5, p.h * z); }
        for (let y = 1; y < p.h; y++) { ctx.moveTo(0, y * z + 0.5); ctx.lineTo(p.w * z, y * z + 0.5); }
        ctx.stroke();
      }
      if (st.mirror) {
        ctx.strokeStyle = "rgba(224,120,158,.8)";
        ctx.beginPath(); ctx.moveTo(p.w * z / 2 + 0.5, 0); ctx.lineTo(p.w * z / 2 + 0.5, p.h * z); ctx.stroke();
      }
      if (st.hover && !st.playing && st.tool !== "move" && st.tool !== "bucket") {
        const s = st.tool === "picker" ? 1 : st.size, o = Math.floor((s - 1) / 2);
        ctx.strokeStyle = "#e0789e";
        ctx.strokeRect((st.hover[0] - o) * z + 0.5, (st.hover[1] - o) * z + 0.5, s * z - 1, s * z - 1);
      }
    } catch (e) { /* a page without a real canvas (tests): nothing to show */ }
  }

  function drawPreview() {
    const cv = $("#px-preview"), p = st.p;
    if (!cv) return;
    const k = clamp(Math.floor(180 / Math.max(p.w, p.h)), 1, 8);
    cv.width = p.w * k; cv.height = p.h * k;
    try {
      const ctx = cv.getContext("2d");
      if (!ctx || !ctx.putImageData) return;
      const id = ctx.createImageData(p.w * k, p.h * k);
      id.data.set(C().scaleUp(C().composite(p, st.frame), p.w, p.h, k));
      ctx.putImageData(id, 0, 0);
    } catch (e) { /* no canvas */ }
  }

  function drawTimeline() {
    const p = st.p, t = $("#px-cels");
    const head = `<tr><th class="px-lh"></th>${p.frames.map((f, i) => `<th class="px-fh ${i === st.frame ? "on" : ""}" data-f="${i}" title="${f.dur} ms">${i + 1}</th>`).join("")}</tr>`;
    const rows = p.layers.map((l, li) => ({l, li})).reverse().map(({l, li}) => `
      <tr class="${li === st.layer ? "on" : ""}">
        <th class="px-lname">
          <button class="px-eye ${l.visible ? "" : "off"}" data-eye="${li}" title="Show or hide">${l.visible ? "◉" : "○"}</button>
          <span data-lsel="${li}" title="Double-click to rename">${esc(l.name)}</span></th>
        ${p.frames.map((_, fi) => {
          const c = (p.cels[l.id] || [])[fi];
          return `<td class="px-cel ${li === st.layer && fi === st.frame ? "on" : ""} ${fi === st.frame ? "col" : ""}" data-cel="${li}:${fi}">${c && !C().isEmpty(c) ? "●" : "○"}</td>`;
        }).join("")}
      </tr>`).join("");
    t.innerHTML = head + rows;
    t.querySelectorAll("[data-cel]").forEach((td) => td.onclick = () => {
      const [li, fi] = td.dataset.cel.split(":").map(Number);
      st.layer = li; st.frame = fi; drawAll();
    });
    t.querySelectorAll("[data-f]").forEach((th) => th.onclick = () => { st.frame = Number(th.dataset.f); drawAll(); });
    t.querySelectorAll("[data-lsel]").forEach((s) => {
      s.onclick = () => { st.layer = Number(s.dataset.lsel); drawAll(); };
      s.ondblclick = () => renameLayer(Number(s.dataset.lsel));
    });
    t.querySelectorAll("[data-eye]").forEach((b) => b.onclick = () => act(() => {
      const l = st.p.layers[Number(b.dataset.eye)]; l.visible = !l.visible;
    }));
  }

  function renameLayer(li) {
    const l = st.p.layers[li];
    const d = SS.shared.openDlg("Rename layer", `<input class="input" id="px-lrn" value="${esc(l.name)}">`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Rename", "btn-save", () => {
      const v = d.body.querySelector("#px-lrn").value.trim();
      if (v) act(() => { l.name = v; });
      d.close();
    });
  }

  /* ---- palettes ---- */

  function fillPaletteSelect() {
    const list = allPalettes();
    const cur = st.p.palette || {};
    const known = list.some((x) => x.name === cur.name);
    $("#px-pal").innerHTML = (known ? "" : `<option value="__sprite">${esc(cur.name || "This sprite's")}</option>`)
      + list.map((x) => `<option value="${esc(x.name)}" ${x.name === cur.name ? "selected" : ""}>${esc(x.name)}${x.builtin ? "" : " (yours)"}</option>`).join("");
  }

  function choosePalette(name) {
    const found = allPalettes().find((x) => x.name === name);
    if (!found) return;
    st.p.palette = {name: found.name, colours: found.colours.slice()};
    st.pick = -1;
    changed();
    drawSwatches();
  }

  const isMine = () => customPalettes.some((x) => x.name === (st.p.palette || {}).name);

  function drawSwatches() {
    const box = $("#px-swatches"), cols = (st.p.palette && st.p.palette.colours) || [];
    box.innerHTML = cols.map((hx, i) => `<button class="px-sw ${i === st.pick ? "on" : ""}" data-sw="${i}" style="background:${esc(hx)}" title="${esc(hx)}"></button>`).join("")
      || `<p class="sb-note">An empty palette — + adds the colour you're drawing with.</p>`;
    box.querySelectorAll("[data-sw]").forEach((b) => {
      b.onclick = () => { st.pick = Number(b.dataset.sw); setFg(C().hexToRgba(cols[st.pick])); drawSwatches(); };
      b.oncontextmenu = (e) => { e.preventDefault(); st.bg = C().hexToRgba(cols[Number(b.dataset.sw)]); paintWells(); };
    });
    $("#px-pal-del").disabled = !isMine() || st.pick < 0;
  }

  /** Changing a built-in palette makes it yours: a copy, named "My …". */
  function ownPalette() {
    if (isMine()) return customPalettes.find((x) => x.name === st.p.palette.name);
    let name = "My " + (st.p.palette.name || "palette"), n = 2;
    while (customPalettes.some((x) => x.name === name)) name = "My " + st.p.palette.name + " " + n++;
    const mine = {name, colours: st.p.palette.colours.slice()};
    customPalettes.push(mine);
    st.p.palette = {name, colours: mine.colours.slice()};
    fillPaletteSelect();
    return mine;
  }

  async function keepPalettes() {
    const res = await store.savePalettes(customPalettes);
    if (res && res.error) SS.shared.toast(res.error, "error");
  }

  async function paletteAdd() {
    const mine = ownPalette(), hx = C().rgbaToHex(st.fg);
    if (!mine.colours.includes(hx)) mine.colours.push(hx);
    st.p.palette.colours = mine.colours.slice();
    st.pick = mine.colours.indexOf(hx);
    changed(); drawSwatches();
    await keepPalettes();
  }

  async function paletteDel() {
    if (!isMine() || st.pick < 0) return;
    const mine = ownPalette();
    mine.colours.splice(st.pick, 1);
    st.p.palette.colours = mine.colours.slice();
    st.pick = -1;
    changed(); drawSwatches();
    await keepPalettes();
  }

  function paletteNew() {
    const d = SS.shared.openDlg("New palette", `
      <label class="dlg-label" for="px-pn">Name</label><input class="input" id="px-pn" value="My palette">
      <div class="dlg-label">Start with</div>
      <div class="seg sb-seg" id="px-pfrom"><button class="seg-btn on" data-from="empty">Nothing</button>
        <button class="seg-btn" data-from="sprite">The colours in this sprite</button>
        <button class="seg-btn" data-from="current">A copy of this palette</button></div>`);
    let from = "empty";
    d.body.querySelector("#px-pfrom").addEventListener("click", (e) => {
      const b = e.target.closest("[data-from]");
      if (!b) return;
      d.body.querySelectorAll("#px-pfrom .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
      from = b.dataset.from;
    });
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Create", "btn-save", async () => {
      let name = d.body.querySelector("#px-pn").value.trim() || "My palette";
      while (allPalettes().some((x) => x.name === name)) name += " 2";
      let colours = [];
      if (from === "current") colours = (st.p.palette.colours || []).slice();
      if (from === "sprite") {
        const seen = new Set();
        st.p.frames.forEach((_, f) => C().paletteFromImage(C().composite(st.p, f)).forEach((c) => seen.add(c)));
        colours = [...seen].slice(0, 256);
      }
      customPalettes.push({name, colours});
      st.p.palette = {name, colours: colours.slice()};
      d.close();
      fillPaletteSelect(); changed(); drawSwatches();
      await keepPalettes();
    });
  }

  async function paletteImport() {
    const got = await SS.Store.call("pixel_open_palette_file", [], "Opening a palette");
    if (!got || got.cancelled) return;
    if (got.error) { SS.shared.toast(got.error, "error"); return; }
    let pal;
    if (got.image) {
      const img = await decodeImage(got.image);
      if (!img) { SS.shared.toast("That picture couldn't be read.", "error"); return; }
      pal = {name: got.name, colours: C().paletteFromImage(img.data)};
    } else {
      pal = C().parsePalette(got.text, got.name);
    }
    return addImported(pal);
  }

  async function addImported(pal) {
    if (!pal.colours.length) { SS.shared.toast("No colours were found in that file.", "error"); return null; }
    let name = pal.name || "Imported";
    while (allPalettes().some((x) => x.name === name)) name += " 2";
    customPalettes.push({name, colours: pal.colours});
    st.p.palette = {name, colours: pal.colours.slice()};
    fillPaletteSelect(); changed(); drawSwatches();
    await keepPalettes();
    SS.shared.toast(`“${name}” — ${pal.colours.length} colours — is in your palettes.`);
    return name;
  }

  async function paletteExport() {
    const pal = st.p.palette || {name: "Palette", colours: []};
    const text = C().gpl(pal);
    const b64 = C().toB64(new TextEncoder().encode(text));
    return saveFile((pal.name || "palette").replace(/[^\w -]/g, "") + ".gpl", b64);
  }

  function decodeImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => resolve(null), 6000);
      img.onload = () => {
        clearTimeout(timer);
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve({w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data});
        } catch (e) { resolve(null); }
      };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = url;
    });
  }

  /* ---- colours ---- */

  function setFg(c) { st.fg = [c[0], c[1], c[2], c[3] === undefined ? 255 : c[3]]; paintWells(); }
  function swapColours() { [st.fg, st.bg] = [st.bg, st.fg]; if (!st.fg[3]) st.fg = [st.fg[0], st.fg[1], st.fg[2], 0]; paintWells(); }
  function setTool(k) { st.tool = k; paintToolbar(); }
  function setSize(n) { st.size = clamp(n, 1, 8); paintToolbar(); }

  /* ---- undo ---- */

  function snapshot() {
    const p = st.p, cels = {};
    Object.keys(p.cels).forEach((id) => { cels[id] = p.cels[id].map((c) => (c ? new Uint8ClampedArray(c) : null)); });
    return {w: p.w, h: p.h, layers: p.layers.map((l) => ({...l})), frames: p.frames.map((f) => ({...f})), cels,
            layer: st.layer, frame: st.frame};
  }
  function restore(s) {
    Object.assign(st.p, {w: s.w, h: s.h, layers: s.layers, frames: s.frames, cels: s.cels});
    st.layer = clamp(s.layer, 0, s.layers.length - 1);
    st.frame = clamp(s.frame, 0, s.frames.length - 1);
  }
  function push() {
    st.undo.push(snapshot());
    if (st.undo.length > UNDO_MAX) st.undo.shift();
    st.redo = [];
  }
  function undo() {
    const s = st.undo.pop();
    if (!s) return;
    st.redo.push(snapshot());
    restore(s); changed(); drawAll();
  }
  function redo() {
    const s = st.redo.pop();
    if (!s) return;
    st.undo.push(snapshot());
    restore(s); changed(); drawAll();
  }

  /** A change to the sprite's structure: undoable, then everything redrawn.
      `fn` returning false means nothing happened. */
  function act(fn) {
    const before = snapshot();
    if (fn() === false) return;
    st.undo.push(before);
    if (st.undo.length > UNDO_MAX) st.undo.shift();
    st.redo = [];
    changed();
    drawAll();
  }

  /** Saved sprites save themselves a moment after each change. */
  function changed() {
    st.dirty = true;
    if (st.asset) {
      clearTimeout(st.saveTimer);
      st.saveTimer = setTimeout(() => save(), 1200);
    }
    paintToolbar();
  }

  /* ---- pointing and drawing ---- */

  function at(e) {
    const r = $("#px-canvas").getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / st.zoom), Math.floor((e.clientY - r.top) / st.zoom)];
  }

  function onHover(e) {
    const pt = at(e);
    if (!st.hover || st.hover[0] !== pt[0] || st.hover[1] !== pt[1]) { st.hover = pt; if (!st.stroke) drawCanvas(); }
  }

  function onDown(e) {
    if (st.playing) togglePlay();
    e.preventDefault();
    const pt = at(e), right = e.button === 2;
    stroke(pt, {right, alt: e.altKey});
    const move = (ev) => strokeMove(at(ev));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      strokeEnd();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  /** The start of a stroke, at pixel `pt`. Exposed for the tests. */
  function stroke(pt, opts) {
    opts = opts || {};
    const p = st.p, l = p.layers[st.layer];
    const tool = opts.alt ? "picker" : st.tool;
    if (tool === "picker") {
      const c = C().get(C().composite(p, st.frame), p.w, pt[0], pt[1]);
      if (opts.right) st.bg = c; else setFg(c);
      paintWells();
      return;
    }
    if (!l.visible) { SS.shared.toast("That layer is hidden — show it (◉) to draw on it."); return; }
    push();
    const img = C().cel(p, l.id, st.frame);
    const colour = tool === "eraser" ? [0, 0, 0, 0] : opts.right ? st.bg : st.fg;
    st.stroke = {tool, start: pt, last: pt, colour, base: new Uint8ClampedArray(img), img};
    if (tool === "bucket") {
      C().fill(img, p.w, p.h, pt[0], pt[1], colour);
      st.stroke = null; changed(); drawAll();
      return;
    }
    if (tool === "pencil" || tool === "eraser") C().dab(img, p.w, p.h, pt[0], pt[1], colour, st.size, st.mirror);
    drawCanvas();
  }

  function strokeMove(pt) {
    const s = st.stroke;
    if (!s) return;
    const p = st.p, img = s.img;
    if (s.tool === "pencil" || s.tool === "eraser") {
      C().line(img, p.w, p.h, s.last[0], s.last[1], pt[0], pt[1], s.colour, st.size, st.mirror);
    } else {
      img.set(s.base);                         // shapes and moves redraw from the start
      if (s.tool === "line") C().line(img, p.w, p.h, s.start[0], s.start[1], pt[0], pt[1], s.colour, st.size, st.mirror);
      if (s.tool === "rect") C().rect(img, p.w, p.h, s.start[0], s.start[1], pt[0], pt[1], s.colour, st.fillShapes, st.size, st.mirror);
      if (s.tool === "ellipse") C().ellipse(img, p.w, p.h, s.start[0], s.start[1], pt[0], pt[1], s.colour, st.fillShapes, st.size, st.mirror);
      if (s.tool === "move") img.set(C().shift(s.base, p.w, p.h, pt[0] - s.start[0], pt[1] - s.start[1]));
    }
    s.last = pt;
    st.hover = pt;
    drawCanvas();
  }

  function strokeEnd() {
    if (!st.stroke) return;
    st.stroke = null;
    changed();
    drawAll();
  }

  /* ---- playing ---- */

  function togglePlay() {
    if (st.playing) {
      clearTimeout(st.playing); st.playing = null;
      $("#px-play").textContent = "▶ Play";
      drawAll();
      return;
    }
    $("#px-play").textContent = "■ Stop";
    const tick = () => {
      if (!st || !document.body.contains($("#px-canvas"))) return;
      st.frame = (st.frame + 1) % st.p.frames.length;
      drawCanvas(); drawPreview(); paintToolbar();
      st.playing = setTimeout(tick, st.p.frames[st.frame].dur || 100);
    };
    st.playing = setTimeout(tick, st.p.frames[st.frame].dur || 100);
  }

  /* ---- keys ---- */

  function onKey(e) {
    if (!st || !document.body.contains(st.host) || !st.host.querySelector(".px-ed")) { dropKeys(); return; }
    if (document.querySelector("#modal-veil.open, #confirm-veil.open")) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "") || e.target.isContentEditable) return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k.toLowerCase() === "z") { e.preventDefault(); (e.shiftKey ? redo : undo)(); return; }
    if (ctrl && k.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
    if (ctrl && k.toLowerCase() === "s") { e.preventDefault(); saveDialog(); return; }
    if (ctrl) return;
    if (e.altKey && k.toLowerCase() === "n") { e.preventDefault(); act(() => { st.frame = C().addFrame(st.p, st.frame + 1, st.frame); }); return; }
    const tool = TOOLS.find((t) => t[2].toLowerCase() === k.toLowerCase());
    if (tool && !e.altKey) { e.preventDefault(); setTool(tool[0]); return; }
    if (k === "x" || k === "X") { swapColours(); return; }
    if (k === "[") { setSize(st.size - 1); return; }
    if (k === "]") { setSize(st.size + 1); return; }
    if (k === ",") { st.frame = (st.frame - 1 + st.p.frames.length) % st.p.frames.length; drawAll(); return; }
    if (k === ".") { st.frame = (st.frame + 1) % st.p.frames.length; drawAll(); return; }
    if (k === "+" || k === "=") { setZoom(st.zoom + 1); return; }
    if (k === "-") { setZoom(st.zoom - 1); return; }
    if (k === "Enter") { e.preventDefault(); togglePlay(); }
  }

  /* ---- canvas size, importing ---- */

  function canvasDialog() {
    const p = st.p;
    const d = SS.shared.openDlg("Canvas size", `
      <div class="pc-row">
        <label>Width <input class="input pc-num" id="px-cw" type="number" min="1" max="512" value="${p.w}"></label>
        <label>Height <input class="input pc-num" id="px-ch" type="number" min="1" max="512" value="${p.h}"></label>
      </div>
      <div class="dlg-label">Keep the picture</div>
      <div class="seg sb-seg" id="px-anchor"><button class="seg-btn on" data-a="c">In the middle</button><button class="seg-btn" data-a="tl">Top left</button></div>`);
    let anchor = "c";
    d.body.querySelector("#px-anchor").addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]");
      if (!b) return;
      d.body.querySelectorAll("#px-anchor .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
      anchor = b.dataset.a;
    });
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Resize", "btn-save", () => {
      const w = clamp(Number(d.body.querySelector("#px-cw").value) | 0, 1, 512), hh = clamp(Number(d.body.querySelector("#px-ch").value) | 0, 1, 512);
      act(() => C().resize(st.p, w, hh, anchor === "c" ? Math.floor((w - p.w) / 2) : 0, anchor === "c" ? Math.floor((hh - p.h) / 2) : 0));
      d.close();
      fitZoom(); drawAll();
    });
  }

  function importPng() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/png,image/gif,image/webp,image/jpeg";
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(f); });
      const img = await decodeImage(url);
      if (!img) { SS.shared.toast("That picture couldn't be read.", "error"); return; }
      importPixels(img, f.name.replace(/\.[^.]+$/, ""));
    };
    input.click();
  }

  /** A picture as a new layer on this frame (top-left; bigger is cropped). */
  function importPixels(img, name) {
    act(() => {
      const l = C().addLayer(st.p, name || "Imported", st.layer + 1);
      st.p.cels[l.id][st.frame] = C().place(new Uint8ClampedArray(img.data), img.w, img.h, st.p.w, st.p.h, 0, 0);
      st.layer += 1;
    });
    if (img.w > st.p.w || img.h > st.p.h) SS.shared.toast(`The picture is ${img.w} × ${img.h}; the canvas is ${st.p.w} × ${st.p.h} — use Canvas… to make room.`);
  }

  /* ---- saving into Assets ---- */

  /** The picture an asset shows: frame 1, enlarged so it stays crisp. */
  function previewUrl() {
    const p = st.p, k = Math.max(1, Math.floor(256 / Math.max(p.w, p.h)));
    return C().pngDataUrl(C().scaleUp(C().composite(p, 0), p.w, p.h, k), p.w * k, p.h * k);
  }

  function saveDialog() {
    const a = st.asset || {cat: "game", stage: "wip"};
    const cats = (SS.AssetStore && SS.AssetStore.CATEGORIES) || [["game", "Game assets"]];
    const d = SS.shared.openDlg(st.asset ? "Save sprite" : "Save into Assets", `
      <label class="dlg-label" for="px-s-name">Name</label>
      <input class="input" id="px-s-name" value="${esc(st.p.name)}">
      <label class="dlg-label" for="px-s-cat">Category</label>
      <select class="input" id="px-s-cat">${cats.map(([k, n]) => `<option value="${k}" ${k === a.cat ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
      <div class="dlg-label">Where it goes</div>
      <div class="seg sb-seg" id="px-s-stage">${STAGES.map(([k, n]) => `<button class="seg-btn ${k === a.stage ? "on" : ""}" data-s="${k}">${n}</button>`).join("")}</div>
      <p class="sb-note">In progress waits in Assets → In progress; move it to Completed works when it's done.
        Once saved, it saves itself as you work.</p>`);
    let stage = a.stage;
    d.body.querySelector("#px-s-stage").addEventListener("click", (e) => {
      const b = e.target.closest("[data-s]");
      if (!b) return;
      d.body.querySelectorAll("#px-s-stage .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
      stage = b.dataset.s;
    });
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save", "btn-save", async () => {
      st.p.name = d.body.querySelector("#px-s-name").value.trim() || st.p.name;
      $("#px-name").value = st.p.name;
      const res = await save({cat: d.body.querySelector("#px-s-cat").value, stage});
      if (res && res.ok) {
        d.close();
        SS.shared.toast(`“${st.p.name}” is in Assets → ${stage === "wip" ? "In progress" : "Completed works"}.`);
      }
    });
    return d;
  }

  async function save(opts) {
    clearTimeout(st.saveTimer);
    const p = st.p, design = C().serialise(p), url = previewUrl();
    let res;
    if (!st.asset) {
      if (!opts) return null;                        // never saved: only from the dialog
      res = await SS.Store.call("asset_add", [opts.cat, p.name, url, design, [p.w, p.h], opts.stage], "Saving the sprite");
      if (res && res.ok) st.asset = {id: res.id, cat: opts.cat, stage: opts.stage};
    } else {
      const ch = {name: p.name, dataUrl: url, design};
      if (opts) { ch.cat = opts.cat; ch.stage = opts.stage; }
      res = await SS.Store.call("asset_update", [st.asset.id, ch], "Saving the sprite");
      if (res && res.ok && opts) Object.assign(st.asset, opts);
    }
    if (!res || res.error) { SS.shared.toast((res && res.error) || "The sprite couldn't be saved.", "error"); return res; }
    if (SS.AssetStore) SS.AssetStore.forget(st.asset.id);
    st.dirty = false;
    if (st.host && st.host.querySelector(".px-ed")) paintToolbar();
    return res;
  }

  async function leave() {
    if (st.playing) togglePlay();
    if (st.dirty && !st.asset) {
      const yes = await SS.shared.confirm({title: "Leave without saving?", body: "This sprite hasn't been saved into Assets yet.",
                                           yes: "Leave it"});
      if (!yes) return;
    } else if (st.dirty) {
      await save();
    }
    dropKeys();
    home(st.host);
  }

  /* ---- exporting ---- */

  async function saveFile(name, b64) {
    const res = await SS.Store.call("pixel_save_file", [name, b64], "Saving the file");
    if (!res || res.cancelled) return res;
    if (res.error) { SS.shared.toast(res.error, "error"); return res; }
    SS.shared.toast(`Saved ${res.path}`);
    return res;
  }

  function exportDialog() {
    const p = st.p;
    const d = SS.shared.openDlg("Export", `
      <div class="dlg-label">As</div>
      <div class="seg sb-seg" id="px-x-kind">
        <button class="seg-btn on" data-k="ase">Aseprite (.aseprite)</button>
        <button class="seg-btn" data-k="png">PNG — this frame</button>
        <button class="seg-btn" data-k="sheet">PNG — sprite sheet</button>
      </div>
      <div class="pc-row" id="px-x-png" hidden>
        <label>Scale <select class="input" id="px-x-scale">${[1, 2, 4, 8, 10, 16].map((n) => `<option value="${n}">× ${n} (${p.w * n} × ${p.h * n})</option>`).join("")}</select></label>
        <label id="px-x-colsrow" hidden>Columns <input class="input pc-num" id="px-x-cols" type="number" min="1" max="${p.frames.length}" value="${p.frames.length}"></label>
      </div>
      <p class="sb-note" id="px-x-note">Layers, frames, timings and the palette — opens in Aseprite (and LibreSprite).</p>`);
    let kind = "ase";
    const notes = {ase: "Layers, frames, timings and the palette — opens in Aseprite (and LibreSprite).",
                   png: "The frame on screen, every visible layer flattened, see-through where nothing's drawn.",
                   sheet: `All ${p.frames.length} frame${p.frames.length === 1 ? "" : "s"} side by side (or in columns) — a sprite sheet for a game.`};
    d.body.querySelector("#px-x-kind").addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]");
      if (!b) return;
      d.body.querySelectorAll("#px-x-kind .seg-btn").forEach((x) => x.classList.toggle("on", x === b));
      kind = b.dataset.k;
      d.body.querySelector("#px-x-png").hidden = kind === "ase";
      d.body.querySelector("#px-x-colsrow").hidden = kind !== "sheet";
      d.body.querySelector("#px-x-note").textContent = notes[kind];
    });
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Export…", "btn-save", async () => {
      const res = await exportAs(kind, Number(d.body.querySelector("#px-x-scale").value), Number(d.body.querySelector("#px-x-cols").value));
      if (res && res.ok) d.close();
    });
    return d;
  }

  function exportBytes(kind, scale, cols) {
    const p = st.p, k = Math.max(1, scale | 0 || 1);
    if (kind === "ase") return C().aseprite(p);
    if (kind === "sheet") {
      const s = C().spriteSheet(p, cols);
      return C().png(C().scaleUp(s.img, s.w, s.h, k), s.w * k, s.h * k);
    }
    return C().png(C().scaleUp(C().composite(p, st.frame), p.w, p.h, k), p.w * k, p.h * k);
  }

  function exportAs(kind, scale, cols) {
    const base = (st.p.name || "sprite").replace(/[^\w -]/g, "").trim() || "sprite";
    const name = kind === "ase" ? base + ".aseprite" : kind === "sheet" ? base + "-sheet.png" : base + ".png";
    return saveFile(name, C().toB64(exportBytes(kind, scale, cols)));
  }

  /* ------------------------------------------------------------- mounting */

  SS.Pixel = {
    VIEWS: ["pixel:studio"],
    PREFIX: "pixel:",
    async mount(host) {
      host.style.display = "";
      if (SS.Pixel._pending) {
        const job = SS.Pixel._pending;
        SS.Pixel._pending = null;
        await home(host);
        return job(host);
      }
      await home(host);
    },
    /** From Assets: open a sprite, or start from a NeuroPets template. */
    openAsset(id) { SS.Pixel._pending = (host) => openAsset(host, id); SS.go("pixel:studio"); },
    openTemplate(tid, opts) {
      SS.Pixel._pending = (host) => {
        const t = C().templates(window.PetArt, window.PetCore).find((x) => x.id === tid);
        return t ? openEditor(host, C().fromTemplate(window.PetArt, t, opts || {}), null) : null;
      };
      SS.go("pixel:studio");
    },
    templateThumb,
    _test: {state: () => st, openEditor, stroke, strokeMove, strokeEnd, undo, redo, save, saveDialog, exportBytes, exportAs,
            exportDialog, templateDialog, newDialog, addImported, importPixels, act, setTool, choosePalette, paletteAdd,
            paletteDel, home, openAsset, leave, togglePlay},
  };
})();
