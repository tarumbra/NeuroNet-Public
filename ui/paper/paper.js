/* ==========================================================================
   Paper creator — Creative → Paper creator. Two halves: Paper and Covers.

   Cam (2026-10-03): "please create me a paper creator. This is a simple tool
   which will print my selected paper at my selected size. Also it will have
   a cover creator. Borrowing the tools from scrapbook i can create a cover in
   my selected size A5 - A4 or custom size (i create pocket notebooks). I want
   to be able to design them within our app."
   His reference pictures (~/Pictures/Paper tool): square grid, dot grid and
   plain lined paper.

   PAPER is drawn in millimetres (an SVG whose viewBox is the page in mm), so
   what prints is exactly the size chosen: the print view's @page is that
   size, or an A4/A3/Letter sheet with as many pages as fit and cut marks
   between them -- a pocket notebook's pages, ready for the guillotine.

   COVERS are the Scrapbook's editor (SS.BoardEditor + the materials panel,
   SS.Scrapbook.makeKit) on a board measured at PX_PER_MM, with the cover's
   material behind everything, fold/spine/trim guides drawn over it on screen
   only, and the same print view. A cover is one file in
   neuronet_data/notes/covers/.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const A = () => SS.ScrapArt;

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const num = (v, lo, hi, dflt) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
  };
  const r2 = (n) => Math.round(n * 100) / 100;

  /* [key, name, width mm, height mm] -- portrait; "custom" takes its own. */
  const SIZES = [
    ["a4", "A4", 210, 297], ["a5", "A5", 148, 210], ["a6", "A6", 105, 148],
    ["b6", "B6", 125, 176], ["pocket", "Pocket (3½ × 5½ in)", 89, 140],
    ["passport", "Passport", 89, 125], ["travelers", "Traveler's notebook", 110, 210],
    ["letter", "US Letter", 216, 279], ["half-letter", "Half letter", 140, 216],
    ["custom", "Custom size", 0, 0],
  ];
  /* What a page can be printed on. "own": a sheet the page's own size. */
  const SHEETS = [["own", "Its own size"], ["a4", "A4 sheets"], ["a3", "A3 sheets"], ["letter", "Letter sheets"]];
  const SHEET_MM = {a4: [210, 297], a3: [297, 420], letter: [216, 279]};
  const SHEET_MARGIN = 6;
  /* which way up the sheet goes in the printer. Cam (2026-10-03): "have
     ability to print it landscape as well for both paper tool and scrap book" */
  const ORIENTS = [["auto", "Best fit"], ["portrait", "Portrait"], ["landscape", "Landscape"]];              // mm a home printer can't reach, and room for cut marks

  const KINDS = [
    ["lined", "Lined"], ["grid", "Grid"], ["dot", "Dot grid"], ["isometric", "Isometric dots"],
    ["cornell", "Cornell notes"], ["music", "Music staves"], ["blank", "Blank"],
  ];
  /* sensible spacings (mm) a kind starts with */
  const SPACING = {lined: 7, grid: 5, dot: 5, isometric: 5, cornell: 7, music: 2, blank: 5};
  const LINE_COLOURS = ["#9db7d5", "#7a8fa6", "#b5b5b5", "#3d3d3d", "#000000", "#2b6f6b", "#c9a14a", "#d98e9c"];
  const PAPER_COLOURS = ["#ffffff", "#fbf8f1", "#f6efdf", "#eef4ea", "#eaf1f8", "#f8e9ec", "#26272b"];

  function sizeOf(d) {
    let w, h;
    if (d.size === "custom") { w = num(d.w, 30, 600, 148); h = num(d.h, 30, 600, 210); }
    else { const s = SIZES.find((x) => x[0] === d.size) || SIZES[1]; w = s[2]; h = s[3]; }
    return d.landscape ? [Math.max(w, h), Math.min(w, h)] : [Math.min(w, h), Math.max(w, h)];
  }

  function defaultDesign() {
    return {kind: "lined", size: "a5", w: 148, h: 210, landscape: false,
            spacing: 7, weight: 0.25, colour: "#9db7d5", paper: "#ffffff",
            margin: 8, marginLine: false, header: false, major: 5,
            pages: 10, sheet: "own", marks: true};
  }

  /* ------------------------------------------------------------ the paper

     One page, as an SVG measured in millimetres. Lines and dots are each ONE
     path (a dot is a zero-length stroke with round ends), so a 200-page
     print stays small. */
  function paperSVG(d, wAttr, hAttr) {
    const [W, H] = sizeOf(d);
    const m = num(d.margin, 0, Math.min(W, H) / 3, 8);
    const sp = num(d.spacing, 1, 40, SPACING[d.kind] || 5);
    const sw = num(d.weight, 0.05, 2, 0.25);
    const col = esc(d.colour || "#9db7d5");
    const bg = `<rect width="${W}" height="${H}" fill="${esc(d.paper || "#ffffff")}"/>`;
    const stroke = (dd, wgt, extra) => dd
      ? `<path d="${dd}" fill="none" stroke="${col}" stroke-width="${r2(wgt)}" ${extra || ""}/>` : "";
    let top = m;
    let body = "";
    if (d.header && d.kind !== "blank" && d.kind !== "cornell") {
      /* a title line across the top, with a short date line at its end */
      const y = m + 9;
      body += stroke(`M${m} ${r2(y)}H${r2(W - m - 38)}M${r2(W - m - 30)} ${r2(y)}H${r2(W - m)}`, sw * 1.6)
        + `<text x="${r2(W - m - 30)}" y="${r2(y - 1.4)}" font-size="2.6" fill="${col}"
             font-family="Helvetica, Arial, sans-serif">Date</text>`;
      top = y + 5;
    }
    const lines = (x0, x1, y0, y1, gap) => {
      let p = "";
      for (let y = y0 + gap; y <= y1 + 0.001; y += gap) p += `M${r2(x0)} ${r2(y)}H${r2(x1)}`;
      return p;
    };
    switch (d.kind) {
      case "lined": {
        body += stroke(lines(m, W - m, top, H - m, sp), sw);
        if (d.marginLine) {
          const x = m + Math.min(20, W * 0.15);
          body += `<path d="M${r2(x)} ${r2(top)}V${r2(H - m)}" stroke="#d9534f" stroke-opacity=".7" stroke-width="${r2(sw)}"/>`;
        }
        break;
      }
      case "grid": case "dot": {
        /* whole squares only, centred in the space inside the margins */
        const cols = Math.max(1, Math.floor((W - 2 * m) / sp + 0.001));
        const rows = Math.max(1, Math.floor((H - top - m) / sp + 0.001));
        const x0 = (W - cols * sp) / 2, y0 = top + (H - top - m - rows * sp) / 2;
        if (d.kind === "dot") {
          let p = "";
          for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) p += `M${r2(x0 + i * sp)} ${r2(y0 + j * sp)}h0`;
          body += `<path d="${p}" stroke="${col}" stroke-width="${r2(Math.max(0.3, sw * 2.2))}" stroke-linecap="round"/>`;
        } else {
          const major = Math.round(num(d.major, 0, 20, 5));
          let minor = "", big = "";
          for (let i = 0; i <= cols; i++) {
            const seg = `M${r2(x0 + i * sp)} ${r2(y0)}V${r2(y0 + rows * sp)}`;
            if (major && (i % major === 0 || i === cols)) big += seg; else minor += seg;
          }
          for (let j = 0; j <= rows; j++) {
            const seg = `M${r2(x0)} ${r2(y0 + j * sp)}H${r2(x0 + cols * sp)}`;
            if (major && (j % major === 0 || j === rows)) big += seg; else minor += seg;
          }
          body += stroke(minor, sw) + stroke(big, major ? sw * 2 : sw);
        }
        break;
      }
      case "isometric": {
        const dy = sp * Math.sqrt(3) / 2;
        let p = "";
        for (let j = 0, y = top; y <= H - m + 0.001; j++, y += dy) {
          for (let x = m + (j % 2 ? sp / 2 : 0); x <= W - m + 0.001; x += sp) p += `M${r2(x)} ${r2(y)}h0`;
        }
        body += `<path d="${p}" stroke="${col}" stroke-width="${r2(Math.max(0.3, sw * 2.2))}" stroke-linecap="round"/>`;
        break;
      }
      case "cornell": {
        /* title band, a cue column on the left, a summary box along the foot */
        const band = m + 12, foot = H - m - Math.max(30, H * 0.18), cue = m + Math.max(25, (W - 2 * m) * 0.3);
        body += stroke(`M${m} ${r2(band)}H${r2(W - m)}M${r2(cue)} ${r2(band)}V${r2(foot)}M${m} ${r2(foot)}H${r2(W - m)}`, sw * 2);
        body += stroke(lines(cue + 3, W - m, band, foot - 2, sp), sw);
        body += stroke(lines(m, W - m, foot + 4, H - m, sp), sw * 0.8);
        body += `<text x="${m}" y="${r2(foot + 4)}" font-size="2.6" fill="${col}" font-family="Helvetica, Arial, sans-serif">Summary</text>`
          + `<text x="${m}" y="${r2(band + 4)}" font-size="2.6" fill="${col}" font-family="Helvetica, Arial, sans-serif">Cues</text>`;
        break;
      }
      case "music": {
        /* five-line staves; `spacing` is the gap between a staff's lines */
        const gap = num(d.spacing, 1.2, 4, 2), staff = gap * 4, between = gap * 6;
        let p = "";
        for (let y = top + gap * 2; y + staff <= H - m + 0.001; y += staff + between) {
          for (let k = 0; k < 5; k++) p += `M${m} ${r2(y + k * gap)}H${r2(W - m)}`;
        }
        body += stroke(p, sw);
        break;
      }
      default: break;                                       // blank
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
      width="${wAttr || W + "mm"}" height="${hAttr || H + "mm"}">${bg}${body}</svg>`;
  }

  /* -------------------------------------------------------- the print view

     Pages laid out on sheets. `pages` is a list of standalone SVG strings
     (any viewBox: paper's is mm, a cover's is the editor's pixels), each
     pw x ph mm. On "own" sheets each page is its own sheet; otherwise as many
     as fit go on each sheet, butted together, with cut marks in the margin
     at every edge. */
  /** `orient` (auto | portrait | landscape) says which way up the sheet may
      go; `fit` puts ONE page on each sheet, shrunk if it must be (a 12 x 12
      in scrapbook page on A4), never enlarged. */
  function layout(pw, ph, sheet, orient, fit) {
    if (sheet === "own" || !SHEET_MM[sheet]) return {sw: pw, sh: ph, cols: 1, rows: 1, x0: 0, y0: 0, k: 1, own: true};
    const [a, b] = SHEET_MM[sheet];                      // portrait: a < b
    const ways = orient === "portrait" ? [[a, b]] : orient === "landscape" ? [[b, a]] : [[a, b], [b, a]];
    if (fit) {
      let best = null;
      for (const [sw, sh] of ways) {
        const k = Math.min(1, (sw - 2 * SHEET_MARGIN) / pw, (sh - 2 * SHEET_MARGIN) / ph);
        if (!best || k > best.k + 1e-9) best = {sw, sh, cols: 1, rows: 1, k, x0: (sw - pw * k) / 2, y0: (sh - ph * k) / 2, fit: true};
      }
      return best;
    }
    /* with room round the edge for cut marks if that loses nothing; edge to
       edge when that fits more (two A5s or four A6s on an A4 exactly) */
    let best = null;
    for (const margin of [SHEET_MARGIN, 0]) {
      for (const [sw, sh] of ways) {
        const cols = Math.floor((sw - 2 * margin) / pw + 1e-6), rows = Math.floor((sh - 2 * margin) / ph + 1e-6);
        if (cols < 1 || rows < 1) continue;
        if (!best || cols * rows > best.cols * best.rows) {
          best = {sw, sh, cols, rows, k: 1, x0: (sw - cols * pw) / 2, y0: (sh - rows * ph) / 2};
        }
      }
    }
    return best;                       // null: the page is bigger than the sheet
  }

  function placed(svg, x, y, w, h) {
    return svg.replace(/^\s*<svg\b([^>]*)>/, (all, attrs) => {
      const kept = attrs.replace(/\s(width|height|x|y)="[^"]*"/g, "");
      return `<svg${kept} x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}">`;
    });
  }

  function cutMarks(L, pw, ph) {
    const len = 4, gap = 1.2;
    const right = L.x0 + L.cols * pw, bottom = L.y0 + L.rows * ph;
    if (Math.min(L.x0, L.y0) < gap + 2) {
      /* no room outside the pages: faint dashed lines along the cuts between
         them instead (the outer edges are the sheet's own) */
      let q = "";
      for (let i = 1; i < L.cols; i++) q += `M${r2(L.x0 + i * pw)} 0V${r2(L.sh)}`;
      for (let j = 1; j < L.rows; j++) q += `M0 ${r2(L.y0 + j * ph)}H${r2(L.sw)}`;
      return q ? `<path d="${q}" stroke="#888" stroke-width="0.12" stroke-dasharray="2 2" fill="none"/>` : "";
    }
    let p = "";
    for (let i = 0; i <= L.cols; i++) {
      const x = r2(L.x0 + i * pw);
      p += `M${x} ${r2(L.y0 - gap)}v${-len}M${x} ${r2(bottom + gap)}v${len}`;
    }
    for (let j = 0; j <= L.rows; j++) {
      const y = r2(L.y0 + j * ph);
      p += `M${r2(L.x0 - gap)} ${y}h${-len}M${r2(right + gap)} ${y}h${len}`;
    }
    return `<path d="${p}" stroke="#000" stroke-width="0.15" fill="none"/>`;
  }

  /** The whole print document. -> {html, sheets} or {error}. */
  function printHTML({pages, pw, ph, sheet, marks, title, orient, fit}) {
    const L = layout(pw, ph, sheet, orient, fit);
    if (!L) {
      return {error: `A ${Math.round(pw)} × ${Math.round(ph)} mm page doesn't fit on that sheet${orient && orient !== "auto" ? ` (${orient})` : ""}`
        + " — try the other way up, its own size, or a bigger sheet."};
    }
    if (L.k < 1) { pw *= L.k; ph *= L.k; marks = false; }   // shrunk to fit: no cutting to do
    const per = L.cols * L.rows;
    const sheets = [];
    for (let i = 0; i < pages.length; i += per) {
      const chunk = pages.slice(i, i + per);
      const inner = chunk.map((svg, k) => placed(svg, L.x0 + (k % L.cols) * pw, L.y0 + Math.floor(k / L.cols) * ph, pw, ph)).join("");
      sheets.push(`<div class="sheet"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(L.sw)} ${r2(L.sh)}"
        width="${r2(L.sw)}mm" height="${r2(L.sh)}mm">${inner}${marks && !L.own ? cutMarks(L, pw, ph) : ""}</svg></div>`);
    }
    const sheetName = L.own ? `${r2(pw)} × ${r2(ph)} mm` : `${(SHEETS.find((s) => s[0] === sheet) || [0, sheet])[1].replace(/ sheets$/, "")}`
      + `${L.sw > L.sh ? " landscape" : " portrait"}, ${per} to a sheet${L.k < 1 ? `, shrunk to ${Math.round(L.k * 100)}%` : ""}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: ${r2(L.sw)}mm ${r2(L.sh)}mm; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  .sheet { width: ${r2(L.sw)}mm; height: ${r2(L.sh)}mm; overflow: hidden; break-after: page; page-break-after: always; }
  .sheet:last-child { break-after: auto; page-break-after: auto; }
  .sheet > svg { display: block; }
  .bar { font: 14px/1.4 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; background: #2f3a4f; color: #fff;
         padding: 10px 16px; display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
  .bar button { font: inherit; padding: 6px 14px; border: 0; border-radius: 6px; background: #5fa665; color: #fff; cursor: pointer; }
  @media screen {
    body { background: #6b6f78; }
    .sheet { margin: 12px auto; background: #fff; box-shadow: 0 4px 18px rgba(0,0,0,.4); }
  }
  @media print { .bar { display: none; } }
</style></head><body>
<div class="bar"><strong>${esc(title)}</strong>
  <span>${sheets.length} sheet${sheets.length === 1 ? "" : "s"} · ${esc(sheetName)}.
  In the print dialog choose that paper size and <b>Actual size / 100%</b> (not “Fit to page”), margins none.</span>
  <button id="print-now">Print</button></div>
${sheets.join("\n")}
<script>document.getElementById("print-now").addEventListener("click", function () { window.print(); });</script>
</body></html>`;
    return {html, sheets: sheets.length, perSheet: per, landscape: L.sw > L.sh, scale: L.k};
  }

  async function sendToPrinter(res, kind) {
    if (res.error) { SS.shared.toast(res.error, "error"); return false; }
    const got = await SS.Store.call("open_print_document", [res.html, kind], "Opening the print view");
    if (got && got.error) { SS.shared.toast(got.error, "error"); return false; }
    SS.shared.toast(`The print view is open in your browser — ${res.sheets} sheet${res.sheets === 1 ? "" : "s"}.`);
    return true;
  }

  /* ------------------------------------------------------------ the page */

  const TAB_KEY = "nn:paper:tab", DESIGN_KEY = "nn:paper:design";
  const getLS = (k, d) => { try { const v = JSON.parse(window.localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const setLS = (k, v) => { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };

  async function render(host) {
    const tab = getLS(TAB_KEY, "paper") === "covers" ? "covers" : "paper";
    host.innerHTML = `
      <div class="bd-head pc-head">
        <h2 class="page-h">Paper creator</h2>
        <p class="stamp">Paper printed at exactly the size you choose, and covers to wrap it in.</p>
        <div class="seg pc-tabs" role="tablist">
          <button class="seg-btn ${tab === "paper" ? "on" : ""}" data-tab="paper" role="tab">Paper</button>
          <button class="seg-btn ${tab === "covers" ? "on" : ""}" data-tab="covers" role="tab">Covers</button>
        </div>
      </div>
      <div id="pc-body"></div>`;
    host.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { setLS(TAB_KEY, b.dataset.tab); render(host); });
    const body = host.querySelector("#pc-body");
    if (tab === "covers") await renderCovers(host, body);
    else await renderPaper(body);
  }

  /* ---- Paper ---- */

  let saved = [];

  const seg = (id, list, on, attr) => `<div class="seg sb-seg" id="${id}">${list.map(([k, name]) =>
    `<button class="seg-btn ${String(k) === String(on) ? "on" : ""}" data-${attr}="${esc(k)}">${esc(name)}</button>`).join("")}</div>`;
  const swatches = (id, list, on) => `<div class="sb-swatches" id="${id}">${list.map((c) =>
    `<button class="bd-sw ${c === on ? "on" : ""}" data-col="${c}" style="background:${c}" title="${c}"></button>`).join("")}
    <label class="bd-sw bd-sw-custom" title="Any colour"><input type="color" data-custom value="${esc(/^#[0-9a-f]{6}$/i.test(on || "") ? on : "#888888")}"></label></div>`;

  async function renderPaper(body) {
    const d = {...defaultDesign(), ...getLS(DESIGN_KEY, {})};
    const got = await SS.Store.call("paper_designs", [], "Your papers");
    saved = (got && got.designs) || [];
    body.innerHTML = `
      <div class="pc-paper">
        <div class="pc-opts">
          <div class="dlg-label">Paper</div>
          ${seg("pc-kind", KINDS, d.kind, "kind")}
          <div class="dlg-label">Size</div>
          ${seg("pc-size", SIZES.map((s) => [s[0], s[1]]), d.size, "size")}
          <div class="pc-row" id="pc-custom" ${d.size === "custom" ? "" : "hidden"}>
            <label>Width <input class="input pc-num" id="pc-w" type="number" min="30" max="600" step="1" value="${esc(d.w)}"> mm</label>
            <label>Height <input class="input pc-num" id="pc-h" type="number" min="30" max="600" step="1" value="${esc(d.h)}"> mm</label>
          </div>
          <div class="dlg-label">Page</div>
          ${seg("pc-land", [["portrait", "Portrait"], ["landscape", "Landscape"]], d.landscape ? "landscape" : "portrait", "orient")}
          <div class="pc-row">
            <label><span id="pc-sp-lbl">Spacing</span> <input class="input pc-num" id="pc-sp" type="number" min="1" max="40" step="0.5" value="${esc(d.spacing)}"> mm</label>
            <label>Margin <input class="input pc-num" id="pc-m" type="number" min="0" max="60" step="1" value="${esc(d.margin)}"> mm</label>
            <label>Line <input class="input pc-num" id="pc-sw" type="number" min="0.05" max="2" step="0.05" value="${esc(d.weight)}"> mm</label>
          </div>
          <div class="pc-row" id="pc-extra"></div>
          <div class="dlg-label">Line colour</div>
          ${swatches("pc-col", LINE_COLOURS, d.colour)}
          <div class="dlg-label">Paper colour</div>
          ${swatches("pc-bg", PAPER_COLOURS, d.paper)}
          <p class="sb-note">Most printers can't print a colour right to the edge — white paper with a white page is the safe choice.</p>
          <div class="pc-print">
            <div class="dlg-label">Print</div>
            <div class="pc-row">
              <label>Pages <input class="input pc-num" id="pc-pages" type="number" min="1" max="200" step="1" value="${esc(d.pages)}"></label>
            </div>
            ${seg("pc-sheet", SHEETS, d.sheet, "sheet")}
            <div id="pc-orient-row" ${d.sheet === "own" ? "hidden" : ""}>
              <div class="dlg-label">Sheet</div>
              ${seg("pc-orient", ORIENTS, d.orient || "auto", "orient")}
            </div>
            <label class="bd-pick"><input type="checkbox" id="pc-marks" ${d.marks ? "checked" : ""}><span>Cut marks between pages</span></label>
            <p class="sb-note" id="pc-fit"></p>
            <button class="btn btn-primary" id="pc-print">Print…</button>
          </div>
          <div class="pc-saved">
            <div class="dlg-label">My papers</div>
            <div id="pc-saved-list"></div>
            <button class="btn btn-quiet sb-small" id="pc-save">Save this paper…</button>
          </div>
        </div>
        <div class="pc-preview"><div class="pc-sheet" id="pc-pv"></div><p class="sb-note pc-pv-cap" id="pc-pv-cap"></p></div>
      </div>`;
    const $ = (s) => body.querySelector(s);
    wireSegs(body);
    const extra = () => {
      $("#pc-sp-lbl").textContent = d.kind === "music" ? "Staff line gap" : d.kind === "lined" || d.kind === "cornell" ? "Line height" : "Spacing";
      $("#pc-extra").innerHTML = (d.kind === "lined"
        ? `<label class="bd-pick"><input type="checkbox" id="pc-ml" ${d.marginLine ? "checked" : ""}><span>Margin line</span></label>` : "")
        + (d.kind === "grid"
          ? `<label>Bold every <input class="input pc-num" id="pc-major" type="number" min="0" max="20" step="1" value="${esc(d.major)}"> squares</label>` : "")
        + (["lined", "grid", "dot", "isometric", "music"].includes(d.kind)
          ? `<label class="bd-pick"><input type="checkbox" id="pc-head" ${d.header ? "checked" : ""}><span>Title and date line</span></label>` : "");
      const ml = $("#pc-ml"), mj = $("#pc-major"), hd = $("#pc-head");
      if (ml) ml.onchange = () => { d.marginLine = ml.checked; draw(); };
      if (mj) mj.oninput = () => { d.major = num(mj.value, 0, 20, 5); draw(); };
      if (hd) hd.onchange = () => { d.header = hd.checked; draw(); };
    };
    const draw = () => {
      setLS(DESIGN_KEY, d);
      const [W, H] = sizeOf(d);
      const box = 420, k = Math.min(box / W, box / H);
      $("#pc-pv").innerHTML = paperSVG(d, Math.round(W * k), Math.round(H * k));
      $("#pc-pv-cap").textContent = `${r2(W)} × ${r2(H)} mm`;
      const L = layout(W, H, d.sheet, d.orient);
      $("#pc-fit").textContent = !L ? "That page doesn't fit on that sheet this way up — try the other way, or a bigger sheet."
        : L.own ? `${d.pages} sheet${d.pages === 1 ? "" : "s"}, each ${r2(W)} × ${r2(H)} mm.`
        : `${L.cols * L.rows} page${L.cols * L.rows === 1 ? "" : "s"} to a ${L.sw > L.sh ? "landscape" : "portrait"} sheet → ${Math.ceil(d.pages / (L.cols * L.rows))} sheet${Math.ceil(d.pages / (L.cols * L.rows)) === 1 ? "" : "s"}.`;
    };
    $("#pc-kind").addEventListener("pick", (e) => {
      d.kind = e.detail.dataset.kind;
      d.spacing = SPACING[d.kind];
      $("#pc-sp").value = d.spacing;
      extra(); draw();
    });
    $("#pc-size").addEventListener("pick", (e) => {
      d.size = e.detail.dataset.size;
      $("#pc-custom").hidden = d.size !== "custom";
      draw();
    });
    $("#pc-sheet").addEventListener("pick", (e) => {
      d.sheet = e.detail.dataset.sheet;
      $("#pc-orient-row").hidden = d.sheet === "own";
      draw();
    });
    $("#pc-orient").addEventListener("pick", (e) => { d.orient = e.detail.dataset.orient; draw(); });
    $("#pc-w").oninput = () => { d.w = num($("#pc-w").value, 30, 600, 148); draw(); };
    $("#pc-h").oninput = () => { d.h = num($("#pc-h").value, 30, 600, 210); draw(); };
    $("#pc-land").addEventListener("pick", (e) => { d.landscape = e.detail.dataset.orient === "landscape"; draw(); });
    $("#pc-sp").oninput = () => { d.spacing = num($("#pc-sp").value, 1, 40, SPACING[d.kind]); draw(); };
    $("#pc-m").oninput = () => { d.margin = num($("#pc-m").value, 0, 60, 8); draw(); };
    $("#pc-sw").oninput = () => { d.weight = num($("#pc-sw").value, 0.05, 2, 0.25); draw(); };
    $("#pc-pages").oninput = () => { d.pages = Math.round(num($("#pc-pages").value, 1, 200, 10)); draw(); };
    $("#pc-marks").onchange = () => { d.marks = $("#pc-marks").checked; };
    wireSwatches(body, "#pc-col", (c) => { d.colour = c; draw(); });
    wireSwatches(body, "#pc-bg", (c) => { d.paper = c; draw(); });
    $("#pc-print").onclick = () => printPaper(d);
    $("#pc-save").onclick = () => savePaper(body, d);
    drawSaved(body, d);
    extra();
    draw();
  }

  function kindName(k) { return (KINDS.find((x) => x[0] === k) || [0, k])[1]; }
  function sizeName(d) {
    const [W, H] = sizeOf(d);
    return d.size === "custom" ? `${r2(W)} × ${r2(H)} mm` : (SIZES.find((s) => s[0] === d.size) || [0, d.size])[1];
  }

  function printPaper(d) {
    const [W, H] = sizeOf(d);
    const one = paperSVG(d);
    const pages = Array.from({length: Math.round(num(d.pages, 1, 200, 1))}, () => one);
    return sendToPrinter(printHTML({pages, pw: W, ph: H, sheet: d.sheet, orient: d.orient, marks: d.marks,
      title: `${kindName(d.kind)} paper — ${sizeName(d)}`}), "paper");
  }

  function drawSaved(body, d) {
    const box = body.querySelector("#pc-saved-list");
    box.innerHTML = saved.length ? saved.map((p, i) => `
      <div class="pc-saved-row">
        <button class="btn btn-quiet" data-load="${i}" title="Use this paper">${esc(p.name)}</button>
        <span class="sb-note">${esc(kindName(p.design.kind))}, ${esc(sizeName(p.design))}</span>
        <button class="sb-x pc-x" data-unsave="${i}" title="Forget this paper">×</button>
      </div>`).join("") : `<p class="sb-note">Save a paper you like and it waits here.</p>`;
    box.querySelectorAll("[data-load]").forEach((b) => b.onclick = () => {
      setLS(DESIGN_KEY, {...defaultDesign(), ...saved[Number(b.dataset.load)].design});
      renderPaper(body);
    });
    box.querySelectorAll("[data-unsave]").forEach((b) => b.onclick = async () => {
      const p = saved[Number(b.dataset.unsave)];
      const yes = await SS.shared.confirm({title: "Forget this paper?", body: `“${p.name}” leaves My papers.`, yes: "Forget it"});
      if (!yes) return;
      saved.splice(Number(b.dataset.unsave), 1);
      const res = await SS.Store.call("paper_designs_save", [saved], "Saving your papers");
      if (res && res.error) SS.shared.toast(res.error, "error");
      drawSaved(body, d);
    });
  }

  function savePaper(body, d) {
    const dlg = SS.shared.openDlg("Save this paper", `
      <label class="dlg-label" for="pc-name">Name</label>
      <input class="input" id="pc-name" value="${esc(`${sizeName(d)} ${kindName(d.kind).toLowerCase()}`)}">`);
    dlg.btn("Cancel", "btn-quiet", dlg.close);
    dlg.btn("Save", "btn-save", async () => {
      const name = dlg.body.querySelector("#pc-name").value.trim();
      if (!name) return;
      saved = saved.filter((p) => p.name !== name);           // same name: replaced
      saved.unshift({name, design: {...d}});
      const res = await SS.Store.call("paper_designs_save", [saved], "Saving your papers");
      if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
      dlg.close();
      drawSaved(body, d);
      SS.shared.toast(`“${name}” is in My papers.`);
    });
    const f = dlg.body.querySelector("#pc-name");
    f.focus(); f.select();
  }

  function wireSegs(root) {
    root.querySelectorAll(".seg").forEach((sg) => {
      if (sg.classList.contains("pc-tabs")) return;
      sg.addEventListener("click", (e) => {
        const b = e.target.closest(".seg-btn");
        if (!b) return;
        sg.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        sg.dispatchEvent(new CustomEvent("pick", {detail: b}));
      });
    });
  }
  function wireSwatches(root, sel, onPick) {
    const box = root.querySelector(sel);
    const mark = (c) => box.querySelectorAll("[data-col]").forEach((b) => b.classList.toggle("on", b.dataset.col === c));
    box.querySelectorAll("[data-col]").forEach((b) => b.onclick = () => { mark(b.dataset.col); onPick(b.dataset.col); });
    box.querySelector("[data-custom]").oninput = (e) => { mark(""); onPick(e.target.value); };
  }

  /* ------------------------------------------------------------ Covers */

  const PX_PER_MM = 5;                 // a cover board's pixels per millimetre
  const LAYOUTS = [["front", "Front only"], ["wrap", "Wrap-around (back, spine, front)"]];
  const BLEEDS = [[0, "None"], [3, "3 mm"]];

  /** A cover's measurements from what was chosen: the trimmed cover (tw x th
      mm) and the whole board including bleed (w x h px). */
  function coverGeometry(spec) {
    const [fw, fh] = sizeOf(spec);
    const spine = spec.layout === "wrap" ? num(spec.spine, 0, 60, 0) : 0;
    const tw = spec.layout === "wrap" ? fw * 2 + spine : fw, th = fh;
    const bleed = num(spec.bleed, 0, 10, 0);
    return {fw, fh, spine, tw, th, bleed, wmm: tw + 2 * bleed, hmm: th + 2 * bleed,
            w: Math.round((tw + 2 * bleed) * PX_PER_MM), h: Math.round((th + 2 * bleed) * PX_PER_MM)};
  }

  function newCoverSpec() {
    return {size: "pocket", w: 89, h: 140, landscape: false, layout: "wrap", spine: 0, bleed: 0,
            material: "kraft", colour: ""};
  }

  /* the cover's material behind everything; "white" is plain card */
  function coverBackground(b, w, h) {
    const sp = b.spec || {};
    if (sp.material === "white") return `<rect width="${w}" height="${h}" fill="${esc(sp.colour || "#ffffff")}"/>`;
    return A().materialSVG(sp.material || "kraft", sp.colour || "", w, h);
  }

  /** Fold, spine, trim and safe-area lines -- on screen only. */
  function coverGuides(b) {
    const g = coverGeometry(b.spec || {}), k = PX_PER_MM, bl = g.bleed * k;
    const line = (x1, y1, x2, y2, extra) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}/>`;
    const dash = `stroke="#e8a33d" stroke-width="2" stroke-dasharray="10 7" vector-effect="non-scaling-stroke"`;
    const safe = `stroke="#2b6cb0" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="3 6" fill="none" vector-effect="non-scaling-stroke"`;
    const label = (x, txt) => `<text x="${x}" y="${bl + 22}" text-anchor="middle" font-size="18" font-family="Helvetica, Arial, sans-serif"
      fill="#e8a33d" fill-opacity=".9" paint-order="stroke" stroke="#000" stroke-opacity=".35" stroke-width="3">${txt}</text>`;
    let out = "";
    if (bl) out += `<rect x="${bl}" y="${bl}" width="${g.tw * k}" height="${g.th * k}" fill="none" stroke="#c0392b" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    const s = 5 * k;                                       // 5 mm safe area inside each panel
    if ((b.spec || {}).layout === "wrap") {
      const xBack = bl, xSpine = bl + g.fw * k, xFront = xSpine + g.spine * k;
      out += line(xSpine, 0, xSpine, b.h, dash);
      if (g.spine) out += line(xFront, 0, xFront, b.h, dash);
      out += `<rect x="${xBack + s}" y="${bl + s}" width="${g.fw * k - 2 * s}" height="${g.th * k - 2 * s}" ${safe}/>`
        + `<rect x="${xFront + s}" y="${bl + s}" width="${g.fw * k - 2 * s}" height="${g.th * k - 2 * s}" ${safe}/>`
        + label(xBack + (g.fw * k) / 2, "Back") + label(xFront + (g.fw * k) / 2, "Front")
        + (g.spine ? label(xSpine + (g.spine * k) / 2, "Spine") : "");
    } else {
      out += `<rect x="${bl + s}" y="${bl + s}" width="${g.tw * k - 2 * s}" height="${g.th * k - 2 * s}" ${safe}/>`
        + label(bl + (g.tw * k) / 2, "Front");
    }
    return out;
  }

  let covers = [];
  const coverStore = {
    async list() { return (await SS.Store.call("covers_list", [], "Your covers")) || []; },
    async read(id) { return SS.Store.call("covers_read", [id], "Opening a cover"); },
    async write(id, b) { return SS.Store.call("covers_write", [id, b], "Saving a cover"); },
    async remove(id) { return SS.Store.call("covers_delete", [id], "Deleting a cover"); },
  };

  function idFor(name, taken) {
    const base = String(name || "Cover").replace(/[^A-Za-z0-9 _-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Cover";
    let id = base, n = 2;
    while (taken.has(id)) { id = `${base} ${n}`; n += 1; }
    return id;
  }

  function coverFrom(name, spec) {
    const g = coverGeometry(spec);
    return {kind: "cover", name, spec: {...spec}, w: g.w, h: g.h, mm: PX_PER_MM,
            pages: [{items: []}], created: new Date().toISOString()};
  }

  function specText(spec) {
    const g = coverGeometry(spec);
    return `${sizeName(spec)}${spec.layout === "wrap" ? `, wrap-around${g.spine ? ` with a ${g.spine} mm spine` : ""}` : ", front"}`
      + ` · ${r2(g.tw)} × ${r2(g.th)} mm`;
  }

  async function renderCovers(host, body) {
    covers = await coverStore.list();
    body.innerHTML = `
      <div class="bd-actions pc-cover-actions">
        <button class="btn btn-primary" id="pc-new-cover">+ New cover</button>
        <span class="sb-note">The Scrapbook's tools, materials, your Assets and clip art — at the size of your notebook.</span>
      </div>
      ${covers.length ? `<div class="sb-shelf pc-covers">${covers.map(coverTile).join("")}</div>`
        : `<p class="bd-empty">No covers yet. Make one for your next notebook.</p>`}`;
    body.querySelector("#pc-new-cover").onclick = () => newCoverDialog(host);
    body.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => openCover(host, b.dataset.open));
    body.querySelectorAll("[data-print]").forEach((b) => b.onclick = async () => {
      const got = await coverStore.read(b.dataset.print);
      if (got && got.book) printCoverDialog(got.book, 0);
    });
    body.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
      const c = covers.find((x) => x.id === b.dataset.del);
      const yes = await SS.shared.confirm({title: "Delete this cover?",
        body: `“${(c && c.name) || b.dataset.del}” will be gone. This one cannot be undone.`, yes: "Delete"});
      if (!yes) return;
      const res = await coverStore.remove(b.dataset.del);
      if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
      render(host);
    });
    /* each tile's picture is the cover itself, drawn small */
    for (const c of covers.filter((x) => !x.error)) {
      coverStore.read(c.id).then((got) => {
        const slot = [...body.querySelectorAll("[data-open]")].find((x) => x.dataset.open === c.id);
        if (!slot || !got || !got.book) return;
        const b = got.book, k = 200 / Math.max(b.w || 1, b.h || 1);
        slot.innerHTML = placed(SS.BoardEditor.pageSVG(b, 0), 0, 0, Math.round(b.w * k), Math.round(b.h * k))
          .replace(/ x="0" y="0"/, "");
      }).catch(() => {});
    }
  }

  function coverTile(c) {
    if (c.error) {
      return `<div class="sb-tile is-broken"><div class="sb-cover sb-cover-broken"></div>
        <div class="bd-name">${esc(c.name)}</div><div class="bd-meta">${esc(c.error)}</div></div>`;
    }
    return `<div class="sb-tile">
      <button class="sb-cover pc-cover-th" data-open="${esc(c.id)}" title="Open “${esc(c.name)}”"></button>
      <div class="bd-name">${esc(c.name)}</div>
      <div class="bd-meta">${esc(specText(c.spec || {}))}</div>
      <div class="sb-tile-btns">
        <button class="btn btn-quiet" data-print="${esc(c.id)}">Print</button>
        <button class="btn btn-quiet bd-del" data-del="${esc(c.id)}">Delete</button>
      </div></div>`;
  }

  /** The size, layout and material of a cover: for a new one, or changing one. */
  function specDialog(title, spec, okLabel, onOk, withName) {
    const st = {...spec};
    const MATS = [["white", "Plain card"], ...A().COVERS.map(([k, n]) => [k, n])];
    const d = SS.shared.openDlg(title, `
      <div class="sb-cover-ed">
        <div class="sb-cover-pv pc-spec-pv" id="pc-cv-pv"></div>
        <div class="sb-cover-opts">
          ${withName ? `<label class="dlg-label" for="pc-cv-name">Name</label>
            <input class="input" id="pc-cv-name" value="My notebook">` : ""}
          <div class="dlg-label">Notebook size</div>
          ${seg("pc-cv-size", SIZES.map((s) => [s[0], s[1]]), st.size, "size")}
          <div class="pc-row" id="pc-cv-custom" ${st.size === "custom" ? "" : "hidden"}>
            <label>Width <input class="input pc-num" id="pc-cv-w" type="number" min="30" max="600" value="${esc(st.w)}"> mm</label>
            <label>Height <input class="input pc-num" id="pc-cv-h" type="number" min="30" max="600" value="${esc(st.h)}"> mm</label>
          </div>
          ${seg("pc-cv-land", [["portrait", "Portrait"], ["landscape", "Landscape"]], st.landscape ? "landscape" : "portrait", "orient")}
          <div class="dlg-label">Layout</div>
          ${seg("pc-cv-layout", LAYOUTS, st.layout, "layout")}
          <div class="pc-row" id="pc-cv-spine-row" ${st.layout === "wrap" ? "" : "hidden"}>
            <label>Spine <input class="input pc-num" id="pc-cv-spine" type="number" min="0" max="60" step="0.5" value="${esc(st.spine)}"> mm</label>
            <span class="sb-note">0 for a stapled or stitched pocket notebook (it just folds).</span>
          </div>
          <div class="dlg-label">Bleed</div>
          ${seg("pc-cv-bleed", BLEEDS, st.bleed, "bleed")}
          <div class="dlg-label">Material</div>
          ${seg("pc-cv-mat", MATS, st.material, "mat")}
          <div class="dlg-label">Colour</div>
          ${swatches("pc-cv-col", ["#ffffff", ...A().COVER_COLOURS], st.colour)}
          <button class="btn btn-quiet sb-small" id="pc-cv-natural">The material's own colour</button>
          <p class="sb-note" id="pc-cv-size-note"></p>
        </div>
      </div>`, true);
    const $ = (s) => d.body.querySelector(s);
    wireSegs(d.body);
    const draw = () => {
      const g = coverGeometry(st), k = 300 / Math.max(g.w, g.h);
      const fake = {kind: "cover", spec: st, w: g.w, h: g.h, pages: [{items: []}]};
      $("#pc-cv-pv").innerHTML = `<svg viewBox="0 0 ${g.w} ${g.h}" width="${Math.round(g.w * k)}" height="${Math.round(g.h * k)}">
        ${coverBackground(fake, g.w, g.h)}${coverGuides(fake)}</svg>`;
      $("#pc-cv-size-note").textContent = `The whole cover: ${r2(g.wmm)} × ${r2(g.hmm)} mm.`;
    };
    $("#pc-cv-size").addEventListener("pick", (e) => { st.size = e.detail.dataset.size; $("#pc-cv-custom").hidden = st.size !== "custom"; draw(); });
    $("#pc-cv-w").oninput = () => { st.w = num($("#pc-cv-w").value, 30, 600, 89); draw(); };
    $("#pc-cv-h").oninput = () => { st.h = num($("#pc-cv-h").value, 30, 600, 140); draw(); };
    $("#pc-cv-land").addEventListener("pick", (e) => { st.landscape = e.detail.dataset.orient === "landscape"; draw(); });
    $("#pc-cv-layout").addEventListener("pick", (e) => { st.layout = e.detail.dataset.layout; $("#pc-cv-spine-row").hidden = st.layout !== "wrap"; draw(); });
    $("#pc-cv-spine").oninput = () => { st.spine = num($("#pc-cv-spine").value, 0, 60, 0); draw(); };
    $("#pc-cv-bleed").addEventListener("pick", (e) => { st.bleed = Number(e.detail.dataset.bleed); draw(); });
    $("#pc-cv-mat").addEventListener("pick", (e) => { st.material = e.detail.dataset.mat; draw(); });
    wireSwatches(d.body, "#pc-cv-col", (c) => { st.colour = c; draw(); });
    $("#pc-cv-natural").onclick = () => {
      st.colour = "";
      d.body.querySelectorAll("#pc-cv-col [data-col]").forEach((b) => b.classList.remove("on"));
      draw();
    };
    draw();
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn(okLabel, "btn-save", async () => {
      const name = withName ? ($("#pc-cv-name").value.trim() || "My notebook") : "";
      if (await onOk(st, name) !== false) d.close();
    });
    if (withName) { const f = $("#pc-cv-name"); f.focus(); f.select(); }
    return d;
  }

  function newCoverDialog(host) {
    specDialog("New cover", newCoverSpec(), "Create", async (spec, name) => {
      const id = idFor(name, new Set(covers.map((c) => c.id)));
      const res = await coverStore.write(id, coverFrom(name, spec));
      if (res && res.error) { SS.shared.toast(res.error, "error"); return false; }
      await render(host);
      openCover(host, id);
      return true;
    }, true);
  }

  /** Changing the size keeps everything on it, moved so it sits where it did
      relative to the cover's middle. */
  function respec(ed, spec) {
    const b = ed.board, g = coverGeometry(spec);
    const dx = (g.w - b.w) / 2, dy = (g.h - b.h) / 2;
    ed.push();
    for (const p of b.pages || []) {
      for (const it of p.items || []) {
        if (typeof it.x === "number") it.x = Math.round(it.x + dx);
        if (typeof it.y === "number") it.y = Math.round(it.y + dy);
        if (Array.isArray(it.points)) it.points = it.points.map(([x, y]) => [x + dx, y + dy]);
        if (Array.isArray(it.pts)) it.pts = it.pts.map(([x, y]) => [x + dx, y + dy]);
      }
    }
    b.spec = {...spec};
    b.w = g.w; b.h = g.h;
    ed.draw();
    ed.changed(true);
  }

  async function openCover(host, id) {
    const got = await coverStore.read(id);
    if (!got || got.error) { SS.shared.toast((got && got.error) || "Couldn't open that cover.", "error"); return null; }
    const book = got.book;
    const kit = SS.Scrapbook.makeKit("nn:covers:panel");
    let guides = getLS("nn:covers:guides", true);
    const ed = SS.BoardEditor.open(host, id, book, () => render(host), {
      saveCall: "covers_write",
      backLabel: "← Covers",
      bar2: `<button class="btn btn-quiet" id="sb-rot-l" title="Turn what is chosen 15° to the left">Turn left</button>
        <button class="btn btn-quiet" id="sb-rot-r" title="Turn what is chosen 15° to the right">Turn right</button>
        <span class="bd-sep"></span>
        <button class="btn btn-quiet" id="pc-spec" title="Size, layout and material">Size &amp; material</button>
        <button class="btn btn-quiet ${guides ? "on" : ""}" id="pc-guides" title="Fold, spine and safe-area lines (never printed)">Guides</button>
        <button class="btn btn-primary" id="pc-cover-print" title="Print this cover at its real size">Print…</button>`,
      ...kit,
      overlay: (ed2) => (guides ? coverGuides(ed2.board) : ""),
      wire(ed2) {
        const h = ed2.host;
        h.querySelector("#pc-spec").onclick = () =>
          specDialog("Size & material", ed2.board.spec || newCoverSpec(), "Use these", (spec) => { respec(ed2, spec); });
        h.querySelector("#pc-guides").onclick = (e) => {
          guides = !guides;
          setLS("nn:covers:guides", guides);
          e.currentTarget.classList.toggle("on", guides);
          ed2.draw();
        };
        h.querySelector("#pc-cover-print").onclick = () => { ed2.flush(); printCoverDialog(ed2.board, ed2.page); };
        kit.wire(ed2);
        /* the whole cover in view to start with -- a wrap-around is wide */
        const room = ed2.stage && ed2.stage.clientWidth;
        if (room && room < ed2.board.w) ed2.setZoom(Math.max(0.25, Math.floor(((room - 24) / ed2.board.w) * 20) / 20));
        const hint = h.querySelector("#bd-hint");
        if (hint && !ed2.board.pages.some((p) => (p.items || []).length)) {
          hint.textContent = "Your cover at its real size. The dashed lines are folds, the dotted ones keep words clear of the edge "
            + "(neither prints). Add a page for the inside of the cover.";
        }
      },
    });
    return ed;
  }

  function printCoverDialog(book, pageNow) {
    const g = coverGeometry(book.spec || {});
    return printDialog({title: "Print the cover", name: book.name || "Cover", book, pageNow, wmm: g.wmm, hmm: g.hmm,
                        kind: "cover", sheet: "a4", inside: "Outside and inside",
                        note: "For the inside, put the printed sheet back in the printer, turned over."});
  }

  /** Printing a book's pages (a cover, a scrapbook): which pages, on which
      sheet, which way up, how many copies; shrinking to fit when the page is
      bigger than the sheet. Every page is the editor's own drawing. */
  function printDialog({title, name, book, pageNow, wmm, hmm, kind, sheet, inside, note, fit}) {
    const many = (book.pages || []).length > 1;
    const st = {sheet: sheet || "a4", orient: "auto", which: "all", fit: !!fit};
    const d = SS.shared.openDlg(title, `
      <p class="stamp">${esc(name)} — ${r2(wmm)} × ${r2(hmm)} mm a page.</p>
      <div class="dlg-label">Print on</div>
      ${seg("pc-pr-sheet", SHEETS, st.sheet, "sheet")}
      <div id="pc-pr-orient-row" ${st.sheet === "own" ? "hidden" : ""}>
        <div class="dlg-label">Sheet</div>
        ${seg("pc-pr-orient", ORIENTS, "auto", "orient")}
      </div>
      ${many ? `<div class="dlg-label">Pages</div>${seg("pc-pr-which", [["all", inside || "Every page"], ["this", "The page on screen"]], "all", "which")}
        ${note ? `<p class="sb-note">${esc(note)}</p>` : ""}` : ""}
      <div class="pc-row"><label>Copies <input class="input pc-num" id="pc-pr-copies" type="number" min="1" max="50" value="1"></label></div>
      <label class="bd-pick"><input type="checkbox" id="pc-pr-fitbox" ${st.fit ? "checked" : ""}><span>Shrink to fit the sheet (one to a sheet)</span></label>
      <label class="bd-pick"><input type="checkbox" id="pc-pr-marks" checked><span>Cut marks</span></label>
      <p class="sb-note" id="pc-pr-fit"></p>`);
    const $ = (s) => d.body.querySelector(s);
    wireSegs(d.body);
    const fitText = () => {
      const L = layout(wmm, hmm, st.sheet, st.orient, st.fit);
      $("#pc-pr-fit").textContent = !L ? "It doesn't fit on that sheet this way up — try the other way, “Shrink to fit”, or a bigger sheet."
        : L.own ? "One to a sheet of its own size."
        : L.fit ? `One to a ${L.sw > L.sh ? "landscape" : "portrait"} sheet${L.k < 1 ? `, shrunk to ${Math.round(L.k * 100)}%` : ", at its real size"}.`
        : `${L.cols * L.rows} to a ${L.sw > L.sh ? "landscape" : "portrait"} sheet.`;
    };
    $("#pc-pr-sheet").addEventListener("pick", (e) => {
      st.sheet = e.detail.dataset.sheet;
      $("#pc-pr-orient-row").hidden = st.sheet === "own";
      fitText();
    });
    $("#pc-pr-orient").addEventListener("pick", (e) => { st.orient = e.detail.dataset.orient; fitText(); });
    $("#pc-pr-fitbox").onchange = () => { st.fit = $("#pc-pr-fitbox").checked; fitText(); };
    if (many) $("#pc-pr-which").addEventListener("pick", (e) => { st.which = e.detail.dataset.which; });
    fitText();
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Print…", "btn-save", async () => {
      const copies = Math.round(num($("#pc-pr-copies").value, 1, 50, 1));
      const idx = st.which === "this" ? [pageNow || 0] : (book.pages || [{}]).map((_, i) => i);
      /* the copies of a page go together, so with several to a sheet the
         inside pages land on sheets of their own */
      const ordered = idx.flatMap((i) => Array.from({length: copies}, () => SS.BoardEditor.pageSVG(book, i)));
      const ok = await sendToPrinter(printHTML({pages: ordered, pw: wmm, ph: hmm, sheet: st.sheet, orient: st.orient,
        fit: st.fit, marks: $("#pc-pr-marks").checked, title: `${name} — ${kind === "cover" ? "cover" : "pages"}`}), kind);
      if (ok) d.close();
    });
    return d;
  }

  SS.BoardEditor && SS.BoardEditor.addBackground("cover", (b, w, h) => coverBackground(b, w, h));

  SS.Paper = {
    VIEWS: ["paper:make"],
    PREFIX: "paper:",
    async mount(host) {
      host.style.display = "";
      await render(host);
    },
    SIZES, KINDS, PX_PER_MM, ORIENTS, printDialog,
    _test: {paperSVG, layout, printHTML, printPaper, sizeOf, defaultDesign, coverGeometry, coverFrom,
            coverGuides, coverBackground, openCover, respec, newCoverSpec, placed, cutMarks},
  };
})();
