/* ==========================================================================
   CL.Research -- Code -> Research: mark up a codebase like a code review.
   ==========================================================================
   Cam (2026-10-01): "Algorthm research (new tool, where i can annotate,
   highlight and make text boxes around a code base i wrote and dig deeper
   into how it works, think like a code review tool)."

   A STUDY is a folder plus notes about it (code_library.py keeps one JSON
   file per study in neuronet_data/code/library/research/). The folder is
   only ever READ -- research never changes the code it's about.

   THREE KINDS OF MARK, all made by selecting code and choosing from the
   little bar that appears (or by clicking line numbers -- shift-click for a
   range):
     * Highlight -- exactly the characters selected, in a colour.
     * Note      -- a comment on some lines, like a review comment; listed
                    on the right, numbered in the gutter.
     * Box       -- a labelled outline drawn round some lines: "this is the
                    parser", "step 3: save". The label shows on the box; any
                    longer text goes in its card.
   Highlights are drawn with the CSS Custom Highlight API, so the code's own
   markup is never cut up to colour it; where that API isn't there the
   lines are tinted instead.

   WHEN THE CODE CHANGES. Each mark remembers the text it was made on (its
   quote). Opening the file again, a mark whose lines no longer hold that
   text is looked for -- the nearest place the quote now appears -- and moved
   there. If the quote is nowhere, the mark is kept, flagged "the code has
   changed", with the code it was about still shown in its card.
   ========================================================================== */
(() => {
  "use strict";
  const CL = window.CL = window.CL || {};
  const esc = (s) => CL.esc(s);

  const COLOURS = ["yellow", "green", "blue", "pink", "orange", "purple"];
  const KIND_NAME = {highlight: "Highlight", note: "Note", box: "Box"};

  const state = {
    studies: [], study: null, tree: null, file: null, text: "", lines: [], language: "plain",
    open: new Set(), filter: "", tab: "file", colour: "yellow", sel: null, editing: null,
  };
  let host = null;

  /* ---- positions: (line, col) <-> offsets in the file's text ---- */
  function starts(lines) {
    const out = [0];
    for (let i = 0; i < lines.length - 1; i++) out.push(out[i] + lines[i].length + 1);
    return out;
  }
  const toOffset = (st, p) => st[p.line - 1] + p.col;
  function toPos(st, offset) {
    let lo = 0, hi = st.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (st[mid] <= offset) lo = mid; else hi = mid - 1; }
    return {line: lo + 1, col: offset - st[lo]};
  }

  /** The text a mark covers: exact characters for a highlight, whole lines otherwise. */
  function quoteOf(text, a) {
    const lines = text.split("\n");
    if (a.kind === "highlight") {
      const st = starts(lines);
      return text.slice(toOffset(st, a.start), toOffset(st, a.end));
    }
    return lines.slice(a.start.line - 1, a.end.line).join("\n");
  }

  /** Put marks back on the code they were made on, if it moved; flag them
      if it's gone. Returns true if anything changed. Exported for the test. */
  function reanchor(text, marks) {
    const lines = text.split("\n");
    const st = starts(lines);
    let changed = false;
    for (const a of marks) {
      const inRange = a.start.line <= lines.length && a.end.line <= lines.length
        && a.start.col <= lines[a.start.line - 1].length && a.end.col <= lines[a.end.line - 1].length;
      if (inRange && quoteOf(text, a) === a.quote) {
        if (a.lost) { a.lost = false; changed = true; }
        continue;
      }
      if (!a.quote) { if (!a.lost) { a.lost = true; changed = true; } continue; }
      // every place the quote now is; the nearest to where it was wins
      let best = -1, bestDist = Infinity;
      const was = st[Math.min(a.start.line, lines.length) - 1] || 0;
      for (let at = text.indexOf(a.quote); at !== -1; at = text.indexOf(a.quote, at + 1)) {
        const s = toPos(st, at);
        if (a.kind !== "highlight") {                            // whole lines: start to end of a line
          const e = toPos(st, at + a.quote.length);
          if (s.col !== 0 || e.col !== lines[e.line - 1].length) continue;
        }
        if (Math.abs(at - was) < bestDist) { best = at; bestDist = Math.abs(at - was); }
      }
      if (best === -1) { if (!a.lost) { a.lost = true; changed = true; } continue; }
      const s = toPos(st, best), e = toPos(st, best + a.quote.length);
      a.start = s;
      a.end = a.kind === "highlight" ? e : {line: e.line, col: lines[e.line - 1].length};
      a.lost = false;
      changed = true;
    }
    return changed;
  }

  /* ---- loading ---- */
  async function loadStudies() {
    const r = await CL.call("studies");
    if (r.error) { CL.toast(r.error, "error"); return; }
    state.studies = r;
  }

  async function openStudy(slug) {
    const s = await CL.call("study", slug);
    if (s.error) { CL.toast(s.error, "error"); return; }
    state.study = s;
    state.file = null; state.text = ""; state.lines = []; state.sel = null; state.editing = null;
    try { SS.Store.setPrefs({codeResearch: slug}); } catch (e) { /* not in NeuroNet */ }
    const t = await CL.call("study_tree", slug);
    state.tree = t.error ? {found: false, tree: [], root: s.path} : t;
    draw();
    if (s.last_file) openFile(s.last_file);
  }

  async function openFile(rel) {
    const r = await CL.call("study_file", state.study.slug, rel);
    if (r.error) { CL.toast(r.error, "error"); return; }
    state.file = rel;
    state.text = r.text;
    state.lines = r.text.split("\n");
    state.language = r.language;
    state.sel = null;
    state.editing = null;
    // open the folders down to it, so the tree shows where it is
    rel.split("/").slice(0, -1).reduce((acc, part) => { const p = acc ? acc + "/" + part : part; state.open.add(p); return p; }, "");
    const marks = state.study.annotations.filter((a) => a.file === rel);
    const moved = reanchor(state.text, marks);
    if (moved || state.study.last_file !== rel) {
      state.study.last_file = rel;
      await persist(moved);
    }
    draw();
  }

  /** Save the marks (and which file is open, so the study reopens there). */
  async function persist(marks = true) {
    const changes = {last_file: state.study.last_file || ""};
    if (marks) changes.annotations = state.study.annotations;
    const r = await CL.call("study_save", state.study.slug, changes);
    if (r.error) { CL.toast(r.error, "error"); return false; }
    state.study = r;
    const row = state.studies.find((x) => x.slug === r.slug);
    if (row) row.notes = r.annotations.length;
    return true;
  }

  /* ---- the screen ---- */
  async function mount(h) {
    host = h;
    host.classList.add("ss-main-fills");
    host.innerHTML = `<p class="stamp">Opening Research…</p>`;
    await loadStudies();
    let want = state.study && state.study.slug;
    if (!want) { try { want = (await SS.Store.getPrefs()).codeResearch; } catch (e) { want = null; } }
    const known = state.studies.find((s) => s.slug === want) || state.studies[0];
    if (known) {
      const keepFile = state.study && state.study.slug === known.slug ? state.file : null;
      await openStudy(known.slug);
      if (keepFile && !state.file) openFile(keepFile);
    } else {
      state.study = null;
      draw();
    }
  }

  function draw() {
    if (!host || !host.isConnected) return;
    if (!state.study) return drawWelcome();
    const s = state.study;
    host.innerHTML = `
      <div class="cl rs" data-screen="research">
        <header class="rs-top">
          <div class="rs-title">
            <div class="cl-kicker">Code · Research</div>
            <select class="input rs-study" id="rs-study" title="Studies">
              ${state.studies.map((x) => `<option value="${esc(x.slug)}"${x.slug === s.slug ? " selected" : ""}>${esc(x.name)}</option>`).join("")}
            </select>
            <span class="stamp rs-path" title="${esc(s.path)}">${esc(s.path)}</span>
          </div>
          <div class="rs-actions">
            <button class="btn btn-sm" id="rs-new">New study</button>
            <button class="btn btn-quiet btn-sm" id="rs-export" title="Save the study as one markdown review">Export…</button>
            <button class="btn btn-quiet btn-sm" id="rs-more" title="Rename, move or delete this study">Study…</button>
          </div>
        </header>
        <div class="rs-body">
          <aside class="rs-tree">
            <input class="input" type="search" id="rs-filter" placeholder="Find a file" value="${esc(state.filter)}" autocomplete="off">
            <div class="rs-files" id="rs-files"></div>
          </aside>
          <section class="rs-view" id="rs-view"></section>
          <aside class="rs-notes" id="rs-notes"></aside>
        </div>
      </div>`;
    host.querySelector("#rs-study").onchange = (e) => openStudy(e.target.value);
    host.querySelector("#rs-new").onclick = newStudy;
    host.querySelector("#rs-export").onclick = exportStudy;
    host.querySelector("#rs-more").onclick = studyMenu;
    host.querySelector("#rs-filter").addEventListener("input", (e) => { state.filter = e.target.value; drawTree(); });
    drawTree();
    drawView();
    drawNotes();
  }

  function drawWelcome() {
    host.innerHTML = `
      <div class="cl" data-screen="research">
        <header class="cl-head">
          <div class="cl-kicker">Code</div>
          <h2 class="page-h">Research</h2>
          <p class="stamp">Study a codebase like a code review. Your notes never change the code.</p>
        </header>
        <div class="cl-page rs-welcome">
          <h3 class="cl-title">Start a study</h3>
          <p>Choose a folder of code — one of your IDE projects, NeuroNet itself, anything you wrote. Then select some code and:</p>
          <ul class="rs-how">
            <li><span class="rs-swatch" data-c="yellow"></span><b>Highlight</b> the part that matters</li>
            <li><span class="rs-swatch" data-c="blue"></span><b>Note</b> what it does, or what puzzled you</li>
            <li><span class="rs-swatch" data-c="green"></span><b>Box</b> a section with a label — “the parser”, “step 2: save”</li>
          </ul>
          <p class="stamp">Then write an overview of how it all hangs together, and export the study as one markdown review.</p>
          <button class="btn btn-primary" id="rs-new">Choose a folder to study…</button>
        </div>
      </div>`;
    host.querySelector("#rs-new").onclick = newStudy;
  }

  /* ---- the file tree ---- */
  function counts() {
    const c = {};
    for (const a of state.study.annotations) c[a.file] = (c[a.file] || 0) + 1;
    return c;
  }

  function drawTree() {
    const el = host.querySelector("#rs-files");
    if (!el) return;
    if (!state.tree.found) {
      el.innerHTML = `<p class="cl-empty">The folder isn't there any more:<br><code>${esc(state.study.path)}</code><br>Study… → Move it to point at where it is now.</p>`;
      return;
    }
    const n = counts();
    const q = state.filter.trim().toLowerCase();
    const rows = [];
    const walk = (nodes, depth) => {
      for (const node of nodes) {
        if (node.type === "folder") {
          if (q) { walk(node.children, depth); continue; }
          const open = state.open.has(node.path);
          rows.push(`<button class="rs-row rs-folder" data-folder="${esc(node.path)}" style="--d:${depth}">
            <span class="rs-caret${open ? " open" : ""}">▸</span>${esc(node.name)}</button>`);
          if (open) walk(node.children, depth + 1);
        } else {
          if (q && !node.path.toLowerCase().includes(q)) continue;
          rows.push(`<button class="rs-row rs-file${node.path === state.file ? " on" : ""}${node.readable ? "" : " off"}"
            data-file="${esc(node.path)}" style="--d:${depth}" title="${esc(node.path)}"${node.readable ? "" : " disabled"}>
            <span class="rs-fname">${esc(q ? node.path : node.name)}</span>${n[node.path] ? `<span class="rs-count">${n[node.path]}</span>` : ""}</button>`);
        }
      }
    };
    walk(state.tree.tree, 0);
    el.innerHTML = rows.join("") || `<p class="cl-empty">${q ? "No file matches." : "This folder is empty."}</p>`;
    el.querySelectorAll("[data-folder]").forEach((b) => b.onclick = () => {
      const p = b.dataset.folder;
      if (state.open.has(p)) state.open.delete(p); else state.open.add(p);
      drawTree();
    });
    el.querySelectorAll("[data-file]").forEach((b) => b.onclick = () => openFile(b.dataset.file));
  }

  /* ---- the code ---- */
  /** The file, one element per line, coloured by Algorithm's highlighter. */
  function lineHtml() {
    const name = CL.hlName(state.language);
    const out = [""];
    const tokens = name === "plain" || !window.AL ? [{type: "text", text: state.text}]
      : AL.Highlight.tokenise(state.text, name);
    for (const t of tokens) {
      const parts = t.text.split("\n");
      parts.forEach((part, i) => {
        if (i) out.push("");
        if (part) out[out.length - 1] += t.type === "text" || t.type === "space"
          ? esc(part) : `<span class="t-${t.type}">${esc(part)}</span>`;
      });
    }
    return out;
  }

  function drawView() {
    const el = host.querySelector("#rs-view");
    if (!state.file) {
      const total = state.study.annotations.length;
      el.innerHTML = `<div class="rs-blank"><p>Choose a file on the left.</p>
        <p class="stamp">${total ? `${total} mark${total === 1 ? "" : "s"} in this study so far — see “Whole study” on the right.`
          : "Select code to highlight it, note it or box it. Click a line number to pick whole lines; shift-click for a range."}</p></div>`;
      return;
    }
    const html = lineHtml();
    const marks = state.study.annotations.filter((a) => a.file === state.file && !a.lost);
    const noteNo = noteNumbers();
    const lineClass = {};
    const gutter = {};
    for (const a of marks) {
      if (a.kind === "note") {
        for (let n = a.start.line; n <= a.end.line; n++) (lineClass[n] = lineClass[n] || []).push("rs-noted rs-c-" + a.colour);
        (gutter[a.start.line] = gutter[a.start.line] || []).push(a);
      }
    }
    el.innerHTML = `
      <div class="rs-file-head"><span class="rs-file-path">${esc(state.file)}</span>
        <span class="stamp">${state.lines.length} lines · select code, or click line numbers</span></div>
      <div class="rs-scroll" id="rs-scroll">
        <div class="rs-code" id="rs-code">
          ${html.map((line, i) => `<div class="rs-line ${(lineClass[i + 1] || []).join(" ")}" data-n="${i + 1}"><span class="rs-num">${i + 1}${(gutter[i + 1] || [])
            .map((a) => `<b class="rs-pin rs-c-${a.colour}" data-id="${esc(a.id)}">${noteNo[a.id]}</b>`).join("")}</span><span class="rs-text">${line || ""}</span></div>`).join("")}
          ${marks.filter((a) => a.kind === "box").map((a) => `<div class="rs-box rs-c-${a.colour}" data-id="${esc(a.id)}">
            ${a.label ? `<span class="rs-box-label">${esc(a.label)}</span>` : ""}</div>`).join("")}
        </div>
      </div>
      <div class="rs-bar" id="rs-bar" hidden></div>`;
    placeBoxes();
    paintHighlights(marks);
    wireCode();
  }

  /** Each box from the top of its first line to the bottom of its last. */
  function placeBoxes() {
    const code = host.querySelector("#rs-code");
    if (!code) return;
    const lineAt = (n) => code.querySelector(`.rs-line[data-n="${n}"]`);
    const boxes = [...code.querySelectorAll(".rs-box")];
    // nested boxes step inwards, so a box inside a box can be seen
    const marks = boxes.map((b) => state.study.annotations.find((a) => a.id === b.dataset.id));
    // room above a labelled box's first line for its label -- before measuring
    marks.forEach((a) => { const l = a.label && lineAt(a.start.line); if (l) l.classList.add("rs-has-label"); });
    boxes.forEach((b, i) => {
      const a = marks[i];
      const first = lineAt(a.start.line), last = lineAt(a.end.line);
      if (!first || !last) { b.hidden = true; return; }
      const depth = marks.filter((o) => o !== a && o.start.line <= a.start.line && o.end.line >= a.end.line
        && (o.start.line < a.start.line || o.end.line > a.end.line)).length;
      b.style.top = (first.offsetTop - 2) + "px";
      b.style.height = (last.offsetTop + last.offsetHeight - first.offsetTop + 4) + "px";
      b.style.setProperty("--inset", (depth * 6) + "px");
    });
  }

  /** Highlights, exactly the selected characters, through CSS.highlights
      (nothing in the code's markup is cut). Without it, the lines are tinted. */
  function paintHighlights(marks) {
    const code = host.querySelector("#rs-code");
    const hs = marks.filter((a) => a.kind === "highlight");
    const supported = typeof CSS !== "undefined" && CSS.highlights && typeof window.Highlight === "function";
    if (supported) for (const c of COLOURS) CSS.highlights.delete("rs-" + c);
    if (!code) return;
    if (!supported) {
      for (const a of hs) {
        for (let n = a.start.line; n <= a.end.line; n++) {
          const line = code.querySelector(`.rs-line[data-n="${n}"]`);
          if (line) line.classList.add("rs-tint", "rs-c-" + a.colour);
        }
      }
      return;
    }
    const by = {};
    for (const a of hs) {
      const s = domPoint(code, a.start), e = domPoint(code, a.end);
      if (!s || !e) continue;
      const r = document.createRange();
      try { r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset); } catch (err) { continue; }
      (by[a.colour] = by[a.colour] || []).push(r);
    }
    for (const [c, ranges] of Object.entries(by)) CSS.highlights.set("rs-" + c, new Highlight(...ranges));
  }

  /** The text node and offset at (line, col) in the drawn code. */
  function domPoint(code, p) {
    const text = code.querySelector(`.rs-line[data-n="${p.line}"] .rs-text`);
    if (!text) return null;
    let left = p.col;
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    let last = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (left <= n.length) return {node: n, offset: left};
      left -= n.length;
      last = n;
    }
    return last ? {node: last, offset: last.length} : {node: text, offset: 0};
  }

  /** (line, col) of a selection end inside the drawn code. */
  function posOf(node, offset) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    const line = el && el.closest(".rs-line");
    if (!line) return null;
    const n = +line.dataset.n;
    const text = line.querySelector(".rs-text");
    if (!text.contains(node)) {
      // in the gutter, or between the line's own children
      const atEnd = node === line && offset > 0;
      return {line: n, col: atEnd ? state.lines[n - 1].length : 0};
    }
    const r = document.createRange();
    r.setStart(text, 0);
    r.setEnd(node, offset);
    return {line: n, col: r.toString().length};
  }

  function wireCode() {
    const code = host.querySelector("#rs-code");
    let anchor = null;
    code.addEventListener("mouseup", () => setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      if (!code.contains(r.startContainer) || !code.contains(r.endContainer)) return;
      let s = posOf(r.startContainer, r.startOffset), e = posOf(r.endContainer, r.endOffset);
      if (!s || !e) return;
      if (e.col === 0 && e.line > s.line) e = {line: e.line - 1, col: state.lines[e.line - 2].length};
      if (s.line === e.line && s.col === e.col) return;
      choose(s, e);
    }, 0));
    code.querySelectorAll(".rs-num").forEach((num) => num.addEventListener("mousedown", (ev) => {
      if (ev.target.closest(".rs-pin")) return;
      ev.preventDefault();
      const n = +num.parentElement.dataset.n;
      const from = ev.shiftKey && anchor ? Math.min(anchor, n) : n;
      const to = ev.shiftKey && anchor ? Math.max(anchor, n) : n;
      if (!ev.shiftKey) anchor = n;
      window.getSelection().removeAllRanges();
      choose({line: from, col: 0}, {line: to, col: state.lines[to - 1].length}, true);
    }));
    code.querySelectorAll(".rs-pin").forEach((p) => p.onclick = () => focusCard(p.dataset.id));
    code.querySelectorAll(".rs-box").forEach((b) => b.onclick = () => focusCard(b.dataset.id));
    const scroll = host.querySelector("#rs-scroll");
    scroll.addEventListener("scroll", () => hideBar());
  }

  /* ---- the bar that appears on a selection ---- */
  function choose(start, end, wholeLines) {
    state.sel = {start, end};
    const code = host.querySelector("#rs-code");
    code.querySelectorAll(".rs-picked").forEach((l) => l.classList.remove("rs-picked"));
    if (wholeLines) for (let n = start.line; n <= end.line; n++) code.querySelector(`.rs-line[data-n="${n}"]`).classList.add("rs-picked");
    const bar = host.querySelector("#rs-bar");
    const lines = start.line === end.line ? `line ${start.line}` : `lines ${start.line}–${end.line}`;
    bar.innerHTML = `
      <span class="rs-bar-what">${lines}</span>
      <span class="rs-dots">${COLOURS.map((c) => `<button class="rs-dot rs-c-${c}${c === state.colour ? " on" : ""}" data-c="${c}" title="${c}"></button>`).join("")}</span>
      <button class="btn btn-sm" data-k="highlight">Highlight</button>
      <button class="btn btn-sm" data-k="note">Note</button>
      <button class="btn btn-sm" data-k="box">Box</button>
      <button class="rs-bar-x" title="Close (Esc)">×</button>`;
    const view = host.querySelector("#rs-view");
    const line = code.querySelector(`.rs-line[data-n="${end.line}"]`);
    const vr = view.getBoundingClientRect(), lr = line.getBoundingClientRect();
    bar.hidden = false;
    bar.style.top = Math.max(40, Math.min(lr.bottom - vr.top + 6, vr.height - 52)) + "px";
    bar.querySelectorAll(".rs-dot").forEach((d) => d.onclick = () => {
      state.colour = d.dataset.c;
      bar.querySelectorAll(".rs-dot").forEach((x) => x.classList.toggle("on", x === d));
    });
    bar.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => mark(b.dataset.k));
    bar.querySelector(".rs-bar-x").onclick = hideBar;
  }

  function hideBar() {
    const bar = host && host.querySelector("#rs-bar");
    if (bar) bar.hidden = true;
    if (host) host.querySelectorAll(".rs-picked").forEach((l) => l.classList.remove("rs-picked"));
    state.sel = null;
  }

  async function mark(kind) {
    const {start, end} = state.sel;
    const a = {
      id: "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind, file: state.file, colour: state.colour, label: "", text: "",
      start: kind === "highlight" ? start : {line: start.line, col: 0},
      end: kind === "highlight" ? end : {line: end.line, col: state.lines[end.line - 1].length},
      created: new Date().toISOString().slice(0, 19), updated: "",
    };
    a.quote = quoteOf(state.text, a);
    if (kind === "highlight" && !a.quote.trim()) { CL.toast("Select some code to highlight.", "error"); return; }
    window.getSelection().removeAllRanges();
    hideBar();
    state.study.annotations.push(a);
    if (!(await persist())) { state.study.annotations = state.study.annotations.filter((x) => x.id !== a.id); return; }
    state.tab = "file";
    state.editing = kind === "highlight" ? null : a.id;     // a note or box wants words
    drawView();
    drawTree();
    drawNotes();
  }

  /* ---- the notes column ---- */
  function noteNumbers() {
    const out = {};
    let n = 0;
    state.study.annotations.filter((a) => a.file === state.file && a.kind === "note")
      .sort((x, y) => x.start.line - y.start.line).forEach((a) => { out[a.id] = ++n; });
    return out;
  }

  const sortMarks = (list) => list.slice().sort((x, y) => x.file.localeCompare(y.file)
    || x.start.line - y.start.line || x.start.col - y.start.col);

  function drawNotes() {
    const el = host.querySelector("#rs-notes");
    if (!el) return;
    const all = state.study.annotations;
    const here = all.filter((a) => a.file === state.file);
    el.innerHTML = `
      <div class="seg rs-tabs">
        <button class="seg-btn${state.tab === "file" ? " on" : ""}" data-tab="file">This file (${here.length})</button>
        <button class="seg-btn${state.tab === "all" ? " on" : ""}" data-tab="all">Whole study (${all.length})</button>
        <button class="seg-btn${state.tab === "overview" ? " on" : ""}" data-tab="overview">Overview</button>
      </div>
      <div class="rs-cards" id="rs-cards"></div>`;
    el.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { state.tab = b.dataset.tab; drawNotes(); });
    const cards = el.querySelector("#rs-cards");
    if (state.tab === "overview") return drawOverview(cards);
    const list = sortMarks(state.tab === "file" ? here : all);
    const nums = noteNumbers();
    let lastFile = null;
    cards.innerHTML = list.length ? list.map((a) => {
      const head = state.tab === "all" && a.file !== lastFile ? `<div class="cl-group">${esc(a.file)}</div>` : "";
      lastFile = a.file;
      return head + card(a, nums[a.id]);
    }).join("") : `<p class="cl-empty">${state.tab === "file" && state.file
      ? "Nothing marked in this file yet. Select some code to start." : "No marks yet."}</p>`;
    cards.querySelectorAll(".rs-card").forEach(wireCard);
    const editing = cards.querySelector(".rs-card.editing textarea, .rs-card.editing input");
    if (editing) editing.focus();
  }

  function card(a, num) {
    const lines = a.start.line === a.end.line ? `line ${a.start.line}` : `lines ${a.start.line}–${a.end.line}`;
    // the code without the indent its lines share, so a card doesn't open on a gap
    const raw = a.quote.replace(/\n+$/, "").split("\n");
    const indent = Math.min(...raw.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length), Infinity);
    const quote = raw.map((l) => (a.kind === "highlight" || !isFinite(indent) ? l : l.slice(indent)));
    const preview = quote.slice(0, 4).join("\n") + (quote.length > 4 ? "\n…" : "");
    const editing = state.editing === a.id;
    return `<div class="rs-card rs-c-${a.colour}${editing ? " editing" : ""}${a.lost ? " lost" : ""}" data-id="${esc(a.id)}">
      <div class="rs-card-head">
        <span class="rs-kind">${num ? `<b class="rs-pin rs-c-${a.colour}">${num}</b>` : ""}${KIND_NAME[a.kind]}${a.label && !editing ? ": " + esc(a.label) : ""}</span>
        <span class="rs-lines">${lines}</span>
      </div>
      ${a.lost ? `<p class="rs-lost">The code has changed — this mark's code isn't in the file any more.</p>` : ""}
      <pre class="rs-quote"><code>${CL.highlight(preview, state.language)}</code></pre>
      ${editing ? `
        ${a.kind === "box" ? `<input class="input" data-f="label" placeholder="Label on the box — “the parser”" value="${esc(a.label)}">` : ""}
        <textarea class="input rs-text-in" data-f="text" placeholder="${a.kind === "box" ? "More about it (optional)" : "What it does, why it's there, what puzzled you…"}">${esc(a.text)}</textarea>
        <div class="rs-card-row">
          <span class="rs-dots">${COLOURS.map((c) => `<button class="rs-dot rs-c-${c}${c === a.colour ? " on" : ""}" data-c="${c}"></button>`).join("")}</span>
          <button class="btn btn-sm btn-primary" data-act="done">Done</button>
        </div>`
      : `${a.text ? `<div class="cl-prose rs-card-text">${CL.markdown(a.text)}</div>` : ""}
        <div class="rs-card-row rs-card-tools">
          <button class="btn btn-quiet btn-sm" data-act="go">Show</button>
          <button class="btn btn-quiet btn-sm" data-act="edit">Edit</button>
          <button class="btn btn-quiet btn-sm" data-act="delete">Delete</button>
        </div>`}
    </div>`;
  }

  function wireCard(el) {
    const a = state.study.annotations.find((x) => x.id === el.dataset.id);
    const act = (name, fn) => { const b = el.querySelector(`[data-act="${name}"]`); if (b) b.onclick = fn; };
    act("go", () => goTo(a));
    act("edit", () => { state.editing = a.id; drawNotes(); });
    act("delete", async () => {
      const yes = await SS.shared.confirm({title: `Delete this ${KIND_NAME[a.kind].toLowerCase()}?`,
        body: a.text ? `"${a.text.slice(0, 80)}${a.text.length > 80 ? "…" : ""}"` : "It'll be removed from the study.", yes: "Delete"});
      if (!yes) return;
      state.study.annotations = state.study.annotations.filter((x) => x.id !== a.id);
      await persist();
      drawView(); drawTree(); drawNotes();
    });
    el.querySelectorAll(".rs-dot").forEach((d) => d.onclick = () => {
      a.colour = d.dataset.c;
      el.querySelectorAll(".rs-dot").forEach((x) => x.classList.toggle("on", x === d));
    });
    const done = async () => {
      el.querySelectorAll("[data-f]").forEach((f) => { a[f.dataset.f] = f.value; });
      a.updated = new Date().toISOString().slice(0, 19);
      state.editing = null;
      await persist();
      drawView(); drawNotes();
    };
    act("done", done);
    el.querySelectorAll("[data-f]").forEach((f) => f.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey || f.tagName === "INPUT")) { e.preventDefault(); done(); }
      if (e.key === "Escape") { e.preventDefault(); done(); }
    }));
    if (!el.classList.contains("editing")) {
      el.addEventListener("click", (e) => { if (!e.target.closest("button")) goTo(a); });
    }
  }

  async function goTo(a) {
    if (a.file !== state.file) await openFile(a.file);
    const line = host.querySelector(`#rs-code .rs-line[data-n="${a.start.line}"]`);
    if (!line) return;
    line.scrollIntoView({block: "center", behavior: "smooth"});
    const code = host.querySelector("#rs-code");
    for (let n = a.start.line; n <= a.end.line; n++) {
      const l = code.querySelector(`.rs-line[data-n="${n}"]`);
      if (l) { l.classList.remove("rs-flash"); void l.offsetWidth; l.classList.add("rs-flash"); }
    }
    host.querySelectorAll(".rs-card").forEach((c) => c.classList.toggle("on", c.dataset.id === a.id));
  }

  function focusCard(id) {
    state.tab = "file";
    drawNotes();
    const el = host.querySelector(`.rs-card[data-id="${id}"]`);
    if (el) { el.scrollIntoView({block: "nearest", behavior: "smooth"}); el.classList.add("on"); }
  }

  function drawOverview(cards) {
    const s = state.study;
    if (state.editing === "overview") {
      cards.innerHTML = `<div class="rs-card editing rs-overview">
        <p class="stamp">How it all hangs together, in your own words. Markdown.</p>
        <textarea class="input rs-text-in rs-ov-in" data-f="overview" placeholder="What it is, where it starts, how data flows through it…">${esc(s.overview)}</textarea>
        <div class="rs-card-row"><span></span><button class="btn btn-sm btn-primary" data-act="done">Done</button></div></div>`;
      const ta = cards.querySelector("textarea");
      ta.focus();
      cards.querySelector('[data-act="done"]').onclick = async () => {
        const r = await CL.call("study_save", s.slug, {overview: ta.value});
        if (r.error) { CL.toast(r.error, "error"); return; }
        s.overview = r.overview;
        state.editing = null;
        drawNotes();
      };
      return;
    }
    cards.innerHTML = `<div class="rs-card rs-overview">
      ${s.overview.trim() ? `<div class="cl-prose">${CL.markdown(s.overview)}</div>`
        : `<p class="cl-empty">No overview yet. Once you've found your way round, write how it hangs together — it's the part you'll read first next time.</p>`}
      <div class="rs-card-row"><span></span><button class="btn btn-sm" data-act="edit">${s.overview.trim() ? "Edit" : "Write the overview"}</button></div></div>`;
    cards.querySelector('[data-act="edit"]').onclick = () => { state.editing = "overview"; drawNotes(); };
  }

  /* ---- studies ---- */
  async function newStudy() {
    const api = window.pywebview && window.pywebview.api;
    let projects = [];
    if (api && api.code_list_projects) {
      try { projects = (await api.code_list_projects()) || []; } catch (e) { projects = []; }
      if (!Array.isArray(projects)) projects = [];
    }
    const d = SS.shared.openDlg("New study", `
      <label class="label">Folder of code</label>
      <div class="rs-pick"><input class="input" id="ns-path" placeholder="/path/to/your/code" style="flex:1">
        <button class="btn btn-sm" id="ns-browse">Choose…</button></div>
      ${projects.length ? `<div class="label">Or one of your IDE projects</div>
        <div class="chip-row">${projects.map((p) => `<button class="chip" data-path="${esc(p.path)}" data-name="${esc(p.name)}">${esc(p.name)}</button>`).join("")}</div>` : ""}
      <label class="label">Name of the study</label>
      <input class="input" id="ns-name" placeholder="Named after the folder" style="width:100%">
      <p class="stamp" style="margin-top:10px">The folder is only ever read. Your notes live in NeuroNet's data folder.</p>`);
    const path = d.body.querySelector("#ns-path"), name = d.body.querySelector("#ns-name");
    d.body.querySelector("#ns-browse").onclick = async () => {
      const r = await CL.call("choose_folder");
      if (r.path) { path.value = r.path; if (!name.value) name.placeholder = r.path.split("/").filter(Boolean).pop(); }
      else if (r.error) CL.toast(r.error, "error");
    };
    d.body.querySelectorAll("[data-path]").forEach((c) => c.onclick = () => {
      path.value = c.dataset.path;
      if (!name.value) name.value = c.dataset.name;
    });
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Start studying", "btn-primary", async () => {
      if (!path.value.trim()) { CL.toast("Choose a folder first.", "error"); return; }
      const r = await CL.call("study_create", name.value, path.value.trim());
      if (r.error) { CL.toast(r.error, "error"); return; }
      d.close();
      await loadStudies();
      await openStudy(r.slug);
    });
    setTimeout(() => path.focus(), 50);
  }

  async function exportStudy() {
    const r = await CL.call("export_study", state.study.slug);
    if (r.error) CL.toast(r.error, "error");
    else if (r.path) CL.toast("Saved: " + r.path, "good");
  }

  function studyMenu() {
    const s = state.study;
    const d = SS.shared.openDlg("This study", `
      <label class="label">Name</label>
      <input class="input" id="sm-name" value="${esc(s.name)}" style="width:100%">
      <label class="label">Folder</label>
      <div class="rs-pick"><input class="input" id="sm-path" value="${esc(s.path)}" style="flex:1">
        <button class="btn btn-sm" id="sm-browse">Choose…</button></div>
      <p class="stamp" style="margin-top:6px">Moved the code? Point the study at where it is now; marks find their code again by its text.</p>
      <div style="margin-top:16px"><button class="btn btn-danger btn-sm" id="sm-delete">Delete this study</button>
        <span class="stamp"> — the notes only; the code is never touched</span></div>`);
    d.body.querySelector("#sm-browse").onclick = async () => {
      const r = await CL.call("choose_folder");
      if (r.path) d.body.querySelector("#sm-path").value = r.path;
    };
    d.body.querySelector("#sm-delete").onclick = async () => {
      d.close();
      const yes = await SS.shared.confirm({title: "Delete this study?",
        body: `"${s.name}" and its ${s.annotations.length} mark${s.annotations.length === 1 ? "" : "s"} will be deleted.`,
        fine: "The folder of code is not touched.", yes: "Delete"});
      if (!yes) return;
      await CL.call("study_delete", s.slug);
      state.study = null;
      await loadStudies();
      if (state.studies[0]) await openStudy(state.studies[0].slug); else draw();
    };
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save", "btn-primary", async () => {
      const r = await CL.call("study_save", s.slug, {name: d.body.querySelector("#sm-name").value,
                                                     path: d.body.querySelector("#sm-path").value});
      if (r.error) { CL.toast(r.error, "error"); return; }
      d.close();
      await loadStudies();
      await openStudy(s.slug);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && host && host.isConnected && state.sel) hideBar();
  });
  window.addEventListener("resize", () => { if (host && host.isConnected && state.file) placeBoxes(); });

  CL.Research = {mount, _state: state, _test: {reanchor, quoteOf, starts, toPos}};
})();
