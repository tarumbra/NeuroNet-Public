/* ==========================================================================
   Algorithm — the interface. NeuroNet: Code -> IDE.

   Ported from Algorithm's ui/app.js with as little changed as possible:
     * it runs when Code is first opened (AL.start), inside #code-shell's
       shadow root -- Algorithm and NeuroNet share ids (app, toast, crumb,
       sheetHost) and class names (.sheet, .topbar, .pane), and a shadow root
       keeps each one's styles and lookups to itself; so `$` looks in the
       root, and the focused element is the root's;
     * its keys (Ctrl+S, Ctrl+F/H, Ctrl+Enter, Ctrl+`, Escape) act only
       while the IDE is on screen (Training's keys once acted on every
       screen -- the same mistake isn't made twice);
     * the window-wide error catcher is gone: in NeuroNet it would have
       toasted every other section's errors in here;
     * renderPdf and renderMarkdown, which Algorithm called but never had
       (so its guides never opened), draw a PDF guide with the pdf.js Notes
       already ships, and a markdown one safely escaped.
   The SS.Code module that NeuroNet's router talks to is at the bottom.

   A rail on the left holding projects, the file tree and guides; a work
   area on the right holding one or two panes. A pane shows either a file
   being edited or a guide being read, which is the whole point of the split
   — reference on one side, code on the other.
   ========================================================================== */
AL.start = (root) => {
  "use strict";

  const APP_VERSION = "2026.09.20";

  const $ = (id) => root.getElementById(id);
  const el = {
    railBody: $("railBody"), railFoot: $("railFoot"),
    pageTitle: $("pageTitle"), crumb: $("crumb"),
    topbarActions: $("topbarActions"),
    paneA: $("paneA"), paneB: $("paneB"), paneSplit: $("paneSplit"),
    sheetHost: $("sheetHost"), sheetTitle: $("sheetTitle"),
    sheetBody: $("sheetBody"), toast: $("toast"),
  };

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const icon = (n, cls = "ic") =>
    `<svg class="${cls}" viewBox="0 0 24 24"><use href="#i-${n}"/></svg>`;

  const state = {
    projects: [],
    project: null,
    panes: { A: { items: [], active: -1 }, B: { items: [], active: -1 } },
    search: { needle: "", results: null, caseSensitive: false, busy: false },
    tree: [],
    guides: [],
    open: { A: null, B: null },   // {kind:"file"|"guide", ...}
    split: false,
    expanded: new Set(),
  };

  /* ---- helpers ----------------------------------------------------------- */

  let toastTimer = null;
  function toast(message) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 3000);
  }
  AL.toast = toast;

  function report(where, err) {
    console.error(where, err);
    const message = (err && err.message) || String(err || "Unknown error");
    toast(`${where}: ${message}`);
    if (AL.Store.isDesktop()) AL.Store.call("log_error", `${where}: ${message}`);
  }

  const guard = (where, fn) => async (...args) => {
    try { await fn(...args); } catch (err) { report(where, err); }
  };

  function failed(result, where) {
    if (result && result.error) { toast(`${where}: ${result.error}`); return true; }
    return false;
  }

  function openSheet(title, build) {
    el.sheetTitle.textContent = title;
    el.sheetBody.innerHTML = "";
    build(el.sheetBody);
    el.sheetHost.hidden = false;
  }
  function closeSheet() { el.sheetHost.hidden = true; }
  el.sheetHost.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeSheet();
  });

  function sheetItem(parent, { label, sub, iconName, danger, onClick }) {
    const b = document.createElement("button");
    b.className = "sheet-item" + (danger ? " is-danger" : "");
    b.innerHTML = (iconName ? icon(iconName) : "")
      + `<span>${esc(label)}${sub ? `<span class="sheet-item-sub">${esc(sub)}</span>` : ""}</span>`;
    b.addEventListener("click", onClick);
    parent.appendChild(b);
    return b;
  }

  function ask({ title, label, value = "", placeholder = "", confirm = "Save", onOk }) {
    openSheet(title, (sheet) => {
      sheet.innerHTML = `<div class="field">
        <label for="askInput">${esc(label)}</label>
        <input id="askInput" value="${esc(value)}" placeholder="${esc(placeholder)}"
          autocomplete="off" spellcheck="false"></div>`;
      const row = document.createElement("div");
      row.className = "sheet-row";
      row.innerHTML = `<button class="secondary-btn" data-close>Cancel</button>
        <button class="primary-btn" id="askOk">${esc(confirm)}</button>`;
      sheet.appendChild(row);
      row.querySelector("[data-close]").addEventListener("click", closeSheet);
      const go = () => {
        const v = sheet.querySelector("#askInput").value.trim();
        if (!v) { toast("Give it a name."); return; }
        closeSheet();
        onOk(v);
      };
      row.querySelector("#askOk").addEventListener("click", guard(title, go));
      sheet.querySelector("#askInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); go(); }
      });
      setTimeout(() => sheet.querySelector("#askInput").focus(), 60);
    });
  }

  /* ---- the rail ---------------------------------------------------------- */

  function renderRail() {
    const parts = [];

    parts.push(`<div class="rail-section">Projects
      <button id="newProject" title="New project">${icon("plus")}</button></div>`);
    parts.push(state.projects.length
      ? `<div>${state.projects.map((p) => `
          <button class="tree-row ${p.name === state.project ? "on" : ""}"
            data-project="${esc(p.name)}">
            ${icon("folder")}<span class="tree-name">${esc(p.name)}</span>
          </button>`).join("")}</div>`
      : `<p class="empty" style="padding:14px 8px">No projects yet.</p>`);

    if (state.project) {
      parts.push(`<div class="rail-section">Files
        <button id="newFile" title="New file">${icon("plus")}</button></div>`);
      parts.push(`
        <div class="rail-search">
          ${icon("search", "ic")}
          <input id="projSearch" placeholder="Search this project"
            autocomplete="off" spellcheck="false" value="${esc(state.search.needle)}">
          <button class="find-btn find-case ${state.search.caseSensitive ? "on" : ""}"
            id="projCase" title="Match case">Aa</button>
        </div>`);
      // While searching, results take the tree's place rather than sitting
      // beside it: two lists of files in one narrow column is one too many.
      parts.push(state.search.results
        ? `<div id="searchResults">${renderSearchResults()}</div>`
        : `<div id="treeRoot">${renderTree(state.tree)}</div>`);
    }

    parts.push(`<div class="rail-section">Guides
      <button id="addGuide" title="Add a guide">${icon("plus")}</button></div>`);
    parts.push(state.guides.length
      ? `<div>${state.guides.map((g) => `
          <button class="tree-row" data-guide="${esc(g.name)}">
            ${icon("book")}<span class="tree-name">${esc(g.name)}</span>
          </button>`).join("")}</div>`
      : `<p class="empty" style="padding:12px 8px;font-size:12px">
           PDFs and markdown you want beside your code.</p>`);

    el.railBody.innerHTML = parts.join("");
    wireRail();
  }

  function renderSearchResults() {
    const r = state.search.results;
    if (state.search.busy) {
      return `<p class="empty" style="padding:14px 8px;font-size:12px">Searching…</p>`;
    }
    if (r.error) {
      return `<p class="empty" style="padding:14px 8px;font-size:12px">${esc(r.error)}</p>`;
    }
    if (!r.hits) {
      return `<p class="empty" style="padding:14px 8px;font-size:12px">
        Nothing matches that.</p>`;
    }
    return `
      <p class="search-summary">${r.hits} hit${r.hits === 1 ? "" : "s"} in
        ${r.files} file${r.files === 1 ? "" : "s"}${
        r.truncated ? " — showing the first of them" : ""}</p>
      ${r.results.map((file) => `
        <div class="search-file">
          <div class="search-path">${icon("file")}<span>${esc(file.path)}</span></div>
          ${file.matches.map((m) => `
            <button class="search-hit" data-hit="${esc(file.path)}"
              data-offset="${m.offset}" data-len="${state.search.needle.length}">
              <span class="search-line">${m.line}</span>
              <span class="search-text">${markHit(m.text)}</span>
            </button>`).join("")}
        </div>`).join("")}`;
  }

  /* The needle is marked in the preview line so the eye finds it without
     counting columns. Escaped first, then marked, so a match containing
     angle brackets cannot inject markup. */
  function markHit(text) {
    const needle = state.search.needle;
    const safe = esc(text);
    if (!needle) return safe;
    const escNeedle = esc(needle);
    const pattern = new RegExp(escNeedle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      state.search.caseSensitive ? "g" : "gi");
    return safe.replace(pattern, (hit) => `<mark>${hit}</mark>`);
  }

  function renderTree(nodes, depth = 0) {
    return nodes.map((node) => {
      if (node.type === "folder") {
        const open = state.expanded.has(node.path);
        return `
          <button class="tree-row" data-folder="${esc(node.path)}">
            ${icon(open ? "chevron" : "chevron", "ic" + (open ? " open" : ""))}
            ${icon("folder")}<span class="tree-name">${esc(node.name)}</span>
          </button>
          ${open ? `<div class="tree-children">
            ${renderTree(node.children || [], depth + 1)}</div>` : ""}`;
      }
      const active = ["A", "B"].some((p) => {
        const item = activeItem(p);
        return item && item.kind === "file" && item.path === node.path;
      });
      return `
        <button class="tree-row ${active ? "on" : ""}" data-file="${esc(node.path)}"
          ${node.editable ? "" : 'data-locked="1"'}>
          ${icon("file")}<span class="tree-name">${esc(node.name)}</span>
        </button>`;
    }).join("");
  }

  function wireRail() {
    const on = (sel, handler) => el.railBody.querySelectorAll(sel)
      .forEach((b) => b.addEventListener("click", handler(b)));

    const newProject = $("newProject");
    if (newProject) newProject.addEventListener("click", () => ask({
      title: "New project", label: "Name", placeholder: "My tool",
      confirm: "Create",
      onOk: guard("New project", async (name) => {
        const result = await AL.Store.call("create_project", name);
        if (failed(result, "New project")) return;
        await loadProjects();
        await openProject(result.name);
      }),
    }));

    const newFile = $("newFile");
    if (newFile) newFile.addEventListener("click", () => ask({
      title: "New file", label: "Path inside the project",
      placeholder: "src/main.py", confirm: "Create",
      onOk: guard("New file", async (path) => {
        const result = await AL.Store.call("create_file", state.project, path);
        if (failed(result, "New file")) return;
        await loadTree();
        openFile("A", path);
      }),
    }));

    const addGuide = $("addGuide");
    if (addGuide) addGuide.addEventListener("click",
      guard("Guides", async () => {
        const result = await AL.Store.call("import_guide");
        if (result.cancelled) return;
        if (failed(result, "Guides")) return;
        await loadGuides();
        renderRail();
        toast(`${result.added.length} added`);
      }));

    const projSearch = $("projSearch");
    if (projSearch) {
      let searchTimer = null;
      projSearch.addEventListener("input", () => {
        state.search.needle = projSearch.value;
        clearTimeout(searchTimer);
        // Debounced: a project-wide walk on every keystroke would fight
        // with the typing.
        searchTimer = setTimeout(guard("Search", runProjectSearch), 220);
      });
      projSearch.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          state.search.needle = "";
          state.search.results = null;
          renderRail();
        }
      });
      const caseBtn = $("projCase");
      if (caseBtn) caseBtn.addEventListener("click", guard("Search", () => {
        state.search.caseSensitive = !state.search.caseSensitive;
        return runProjectSearch();
      }));
    }

    el.railBody.querySelectorAll("[data-hit]").forEach((b) =>
      b.addEventListener("click", guard("Open", async () => {
        await openFile("A", b.dataset.hit);
        const item = activeItem("A");
        if (item && item.editor) {
          item.editor.selectRange(Number(b.dataset.offset),
            Number(b.dataset.offset) + Number(b.dataset.len));
        }
      })));

    on("[data-project]", (b) => guard("Project", () => openProject(b.dataset.project)));
    on("[data-folder]", (b) => () => {
      const path = b.dataset.folder;
      state.expanded.has(path) ? state.expanded.delete(path)
                               : state.expanded.add(path);
      renderRail();
    });
    on("[data-file]", (b) => guard("Open", () => {
      if (b.dataset.locked) {
        toast("That file is not editable as text.");
        return;
      }
      // With the split open, a new file goes to whichever pane is not
      // already showing it, so opening two files side by side is one click
      // each rather than a mode switch.
      // With the split open, a file opens in whichever pane is not already
      // showing it, so two files side by side is one click each.
      const target = state.split && pane("A").items.length ? "B" : "A";
      return openFile(target, b.dataset.file);
    }));
    on("[data-guide]", (b) => guard("Guide", () => {
      const target = state.split ? "B" : (pane("A").items.length ? "B" : "A");
      if (target === "B" && !state.split) setSplit(true);
      return openGuide(target, b.dataset.guide);
    }));
  }

  async function runProjectSearch() {
    const needle = state.search.needle.trim();
    if (needle.length < 2) {
      state.search.results = null;
      renderRail();
      return;
    }
    state.search.busy = true;
    state.search.results = {};
    renderRail();
    const result = await AL.Store.call("search_project", state.project,
      needle, state.search.caseSensitive);
    state.search.busy = false;
    state.search.results = result;
    renderRail();
  }

  /* ---- panes and tabs ------------------------------------------------------

     Each pane holds a list of open items and an index into it. An item is a
     file being edited or a guide being read, and each keeps its own DOM
     alive while it is open — hidden, not destroyed.

     That matters more than it sounds: destroying an editor to switch tabs
     would throw away its undo history and scroll position, so coming back to
     a file you were halfway through editing would lose your ability to undo
     what you just did. Keeping the DOM costs a little memory and keeps
     everything that makes a tab feel like the thing you left.
  */

  function pane(which) {
    return state.panes[which];
  }

  function activeItem(which) {
    const p = pane(which);
    return p.items[p.active] || null;
  }

  function paneRoot(which) {
    return which === "A" ? el.paneA : el.paneB;
  }

  function ensurePaneShell(which) {
    const root = paneRoot(which);
    if (root.querySelector(".tabs")) return root;
    root.innerHTML = `
      <div class="tabs" data-tabs="${which}"></div>
      <div class="pane-stack" data-stack="${which}"></div>`;
    return root;
  }

  function renderTabs(which) {
    const p = pane(which);
    const root = paneRoot(which);
    const strip = root.querySelector(`[data-tabs="${which}"]`);
    if (!strip) return;

    strip.innerHTML = p.items.map((item, i) => `
      <button class="tab ${i === p.active ? "on" : ""}" data-tab="${i}"
        title="${esc(item.kind === "file" ? item.path : item.name)}">
        ${icon(item.kind === "file" ? "file" : "book")}
        <span class="tab-name">${esc(item.kind === "file"
          ? item.path.split("/").pop() : item.name)}</span>
        <span class="tab-dot" ${item.dirty ? "" : "hidden"}>●</span>
        <span class="tab-close" data-close-tab="${i}" role="button"
          aria-label="Close">×</span>
      </button>`).join("")
      + `<div class="tab-spacer"></div>
         ${p.items.length ? `<button class="tab-tool" data-save-pane="${which}"
           title="Save (Ctrl+S)">${icon("save")}</button>` : ""}`;

    strip.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", (e) => {
        if (e.target.closest("[data-close-tab]")) return;
        setActive(which, Number(b.dataset.tab));
      }));
    strip.querySelectorAll("[data-close-tab]").forEach((b) =>
      b.addEventListener("click", guard("Close", (e) => {
        e.stopPropagation();
        return closeTab(which, Number(b.dataset.closeTab));
      })));
    // Middle-click closes, as every other tabbed thing does.
    strip.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("auxclick", guard("Close", (e) => {
        if (e.button !== 1) return;
        e.preventDefault();
        return closeTab(which, Number(b.dataset.tab));
      })));
    const save = strip.querySelector(`[data-save-pane="${which}"]`);
    if (save) save.addEventListener("click", guard("Save", () => saveFile(which)));
  }

  function setActive(which, index) {
    const p = pane(which);
    if (index < 0 || index >= p.items.length) return;
    p.active = index;
    p.items.forEach((item, i) => {
      item.host.hidden = i !== index;
    });
    renderTabs(which);
    renderTopbar();
    renderRail();
    const item = p.items[index];
    if (item && item.editor) item.editor.focus();
  }

  function findTab(which, match) {
    return pane(which).items.findIndex(match);
  }

  function setSplit(on) {
    state.split = on;
    el.paneB.hidden = !on;
    el.paneSplit.hidden = !on;
    if (!on) {
      pane("B").items.forEach((item) => {
        if (item.kind === "file") {
          AL.Store.call("clear_draft", state.project, item.path);
        }
      });
      state.panes.B = { items: [], active: -1 };
      el.paneB.innerHTML = "";
      reportDirty();
    }
    renderTopbar();
  }

  async function openFile(which, path) {
    if (which === "B" && !state.split) setSplit(true);

    // Already open in this pane: just go to it, rather than opening a
    // second tab onto the same file and letting the two drift apart.
    const existing = findTab(which,
      (i) => i.kind === "file" && i.path === path);
    if (existing !== -1) { setActive(which, existing); return; }

    const result = await AL.Store.call("read_file", state.project, path);
    if (failed(result, "Open")) return;

    const root = ensurePaneShell(which);
    const stack = root.querySelector(`[data-stack="${which}"]`);
    const host = document.createElement("div");
    host.className = "pane-body";
    stack.appendChild(host);

    const item = {
      kind: "file", path, language: result.language,
      modified: result.modified, dirty: false, host,
    };

    item.editor = AL.Editor.create(host, {
      language: result.language,
      text: result.text,
      onChange: () => {
        markDirty(which, item, true);
        scheduleDraft(which, item);
      },
      onSave: () => saveFile(which),
      onReplaceAll: (count) => toast(
        `${count} replacement${count === 1 ? "" : "s"} — one undo takes them all back`),
    });

    if (item.editor.isPlain()) {
      toast("Large file — highlighting is off so typing stays responsive.");
    }

    pane(which).items.push(item);
    setActive(which, pane(which).items.length - 1);
  }

  async function openGuide(which, name) {
    if (which === "B" && !state.split) setSplit(true);

    const existing = findTab(which, (i) => i.kind === "guide" && i.name === name);
    if (existing !== -1) { setActive(which, existing); return; }

    const result = await AL.Store.call("read_guide", name);
    if (failed(result, "Guide")) return;

    const root = ensurePaneShell(which);
    const stack = root.querySelector(`[data-stack="${which}"]`);
    const host = document.createElement("div");
    host.className = "pane-body";
    stack.appendChild(host);

    const item = { kind: "guide", name, host, dirty: false };

    if (result.kind === "markdown") {
      host.innerHTML = `<div class="guide-md">${renderMarkdown(result.text)}</div>`;
    } else {
      host.innerHTML = `<div class="pdf-wrap"><p class="empty">Rendering…</p></div>`;
      renderPdf(host.querySelector(".pdf-wrap"), result.dataUrl);
    }

    pane(which).items.push(item);
    setActive(which, pane(which).items.length - 1);
  }

  /* A markdown guide. Algorithm called this but never had it either, so its
     markdown guides never opened. Small on purpose -- headings, paragraphs,
     lists, quotes, rules, **bold**, *italic*, `code` and fenced blocks
     (coloured by Algorithm's own highlighter). Everything is escaped before
     it is marked, so a guide can't put markup into the page; a link shows
     its address rather than leaving the app (it would navigate NeuroNet's
     own window away). */
  function renderMarkdown(src) {
    const inline = (text) => String(text).split(/(`[^`]+`)/).map((part) => {
      if (/^`[^`]+`$/.test(part)) return `<code>${esc(part.slice(1, -1))}</code>`;
      return esc(part)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a title="$2">$1</a>');
    }).join("");
    const LANG = { py: "python", python: "python", js: "javascript", javascript: "javascript",
                   rs: "rust", rust: "rust", html: "html", css: "css" };
    const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let para = [], list = null;
    const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`); para = []; };
    const flushList = () => { if (list) out.push(`<${list.tag}>${list.items.map((t) => `<li>${inline(t)}</li>`).join("")}</${list.tag}>`); list = null; };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fence = line.match(/^\s*(```+|~~~+)\s*([\w+-]*)/);
      if (fence) {
        flushPara(); flushList();
        const body = [];
        for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) body.push(lines[i]);
        const lang = LANG[fence[2].toLowerCase()] || "plain";
        const code = body.join("\n");
        const html = lang === "plain" ? esc(code) : AL.Highlight.toHtml(code, lang);
        out.push(`<pre><code>${html}</code></pre>`);
        continue;
      }
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      const item = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
      if (h) { flushPara(); flushList(); const n = Math.min(3, h[1].length); out.push(`<h${n}>${inline(h[2])}</h${n}>`); }
      else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); flushList(); out.push("<hr>"); }
      else if (/^\s*>/.test(line)) { flushPara(); flushList(); out.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`); }
      else if (item) {
        flushPara();
        const tag = /\d/.test(item[1]) ? "ol" : "ul";
        if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
        list.items.push(item[2]);
      } else if (!line.trim()) { flushPara(); flushList(); }
      else { flushList(); para.push(line.trim()); }
    }
    flushPara(); flushList();
    return out.join("\n");
  }

  /* A PDF guide, page by page, drawn only as each page comes near view (a
     textbook drawn all at once takes the app with it). Algorithm called
     this but never had it, so its guides PDFs never opened; this is the
     pdf.js Notes and Ebooks already use. */
  let pdfjsPromise = null;
  function pdfjs() {
    if (!pdfjsPromise) {
      const base = new URL("notes/vendor/pdfjs/", document.baseURI);
      pdfjsPromise = import(new URL("pdf.min.mjs", base).href).then((mod) => {
        mod.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", base).href;
        return mod;
      });
    }
    return pdfjsPromise;
  }

  async function renderPdf(wrap, dataUrl) {
    let doc;
    try {
      const lib = await pdfjs();
      const raw = atob(String(dataUrl).split(",")[1] || "");
      const data = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
      doc = await lib.getDocument({ data, isEvalSupported: false }).promise;   // no eval from a PDF (CVE-2024-4367)
    } catch (err) {
      wrap.innerHTML = `<p class="empty">That PDF couldn't be opened — ${esc((err && err.message) || err)}</p>`;
      return;
    }
    const first = await doc.getPage(1);
    const natural = first.getViewport({ scale: 1 });
    const width = Math.max(320, wrap.clientWidth - 28);
    const scale = Math.min(width / natural.width, 1.6);
    const ratio = window.devicePixelRatio || 1;
    wrap.innerHTML = "";
    const drawn = new Set();
    const draw = async (n, canvas) => {
      if (drawn.has(n)) return;
      drawn.add(n);
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: scale * ratio });
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    };
    const seen = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) draw(Number(en.target.dataset.n), en.target);
    }, { root: wrap.closest(".pane-body"), rootMargin: "900px 0px" });
    for (let n = 1; n <= doc.numPages; n++) {
      const c = document.createElement("canvas");
      c.className = "pdf-page";
      c.dataset.n = String(n);
      c.style.width = `${Math.round(natural.width * scale)}px`;
      c.style.height = `${Math.round(natural.height * scale)}px`;
      wrap.appendChild(c);
      seen.observe(c);
    }
  }

  function markDirty(which, item, dirty) {
    if (!item || item.dirty === dirty) return;
    item.dirty = dirty;
    renderTabs(which);
    reportDirty();
    if (!dirty && item.kind === "file") {
      AL.Store.call("clear_draft", state.project, item.path);
    }
  }

  function reportDirty() {
    const entries = [];
    for (const which of ["A", "B"]) {
      for (const item of pane(which).items) {
        if (item.kind === "file" && item.dirty) {
          entries.push({ project: state.project, path: item.path });
        }
      }
    }
    AL.Store.call("set_dirty", entries);
  }

  const DRAFT_DELAY = 1500;
  function scheduleDraft(which, item) {
    clearTimeout(item.draftTimer);
    item.draftTimer = setTimeout(guard("Draft", async () => {
      if (!item.dirty || !item.editor) return;
      await AL.Store.call("save_draft", state.project, item.path,
        item.editor.value);
    }), DRAFT_DELAY);
  }

  async function saveFile(which, item = null) {
    const target = item || activeItem(which);
    if (!target || target.kind !== "file") return;

    const result = await AL.Store.call("write_file", state.project,
      target.path, target.editor.value, target.modified);

    if (result.conflict) {
      openSheet("This file changed on disk", (sheet) => {
        sheet.innerHTML = `<p class="sheet-note">${esc(result.error)}</p>`;
        sheetItem(sheet, {
          label: "Overwrite with what is on screen", danger: true,
          iconName: "save",
          onClick: guard("Save", async () => {
            closeSheet();
            const forced = await AL.Store.call("write_file", state.project,
              target.path, target.editor.value, null);
            if (failed(forced, "Save")) return;
            target.modified = forced.modified;
            markDirty(which, target, false);
            toast("Saved, overwriting the other change");
          }),
        });
        sheetItem(sheet, {
          label: "Reload from disk", sub: "Loses what is on screen",
          iconName: "back",
          onClick: guard("Reload", async () => {
            closeSheet();
            const fresh = await AL.Store.call("read_file", state.project,
              target.path);
            if (failed(fresh, "Reload")) return;
            target.editor.value = fresh.text;
            target.modified = fresh.modified;
            markDirty(which, target, false);
            toast("Reloaded");
          }),
        });
      });
      return;
    }

    if (failed(result, "Save")) return;
    target.modified = result.modified;
    markDirty(which, target, false);
    toast("Saved");
  }

  async function closeTab(which, index) {
    const p = pane(which);
    const item = p.items[index];
    if (!item) return;

    if (item.dirty) {
      openSheet("Unsaved changes", (sheet) => {
        sheet.innerHTML = `<p class="sheet-note">
          <b>${esc(item.path)}</b> has changes that have not been saved.</p>`;
        sheetItem(sheet, { label: "Save and close", iconName: "save",
          onClick: guard("Save", async () => {
            closeSheet();
            await saveFile(which, item);
            if (!item.dirty) dropTab(which, item);
          }) });
        sheetItem(sheet, { label: "Close without saving", danger: true,
          iconName: "close",
          onClick: () => { closeSheet(); dropTab(which, item); } });
      });
      return;
    }
    dropTab(which, item);
  }

  function dropTab(which, item) {
    const p = pane(which);
    const index = p.items.indexOf(item);
    if (index === -1) return;

    if (item.kind === "file") {
      AL.Store.call("clear_draft", state.project, item.path);
    }
    clearTimeout(item.draftTimer);
    item.host.remove();
    p.items.splice(index, 1);
    // Land on the neighbour rather than jumping to the first tab.
    p.active = Math.min(index, p.items.length - 1);

    reportDirty();

    if (!p.items.length) {
      if (which === "B") { setSplit(false); renderRail(); renderTopbar(); return; }
      paneRoot("A").innerHTML = "";
      // The right pane becomes the only one rather than leaving an empty
      // half where the left used to be.
      if (state.split && pane("B").items.length) {
        const moved = pane("B").items.slice();
        state.panes.B = { items: [], active: -1 };
        el.paneB.innerHTML = "";
        setSplit(false);
        (async () => {
          for (const m of moved) {
            if (m.kind === "file") await openFile("A", m.path);
            else await openGuide("A", m.name);
          }
        })();
        return;
      }
      showWelcome();
      renderRail();
      renderTopbar();
      return;
    }
    setActive(which, p.active);
  }

  /* ---- top bar ------------------------------------------------------------ */

  function renderTopbar() {
    el.pageTitle.textContent = state.project || "IDE";
    const open = activeItem("A");
    el.crumb.textContent = open
      ? (open.kind === "file" ? open.path : open.name) : "";

    el.topbarActions.innerHTML = `
      <button class="icon-btn ${state.split ? "on" : ""}" id="toggleSplit"
        title="Split the view">${icon("split")}</button>
      ${state.project
        ? `<button class="icon-btn" id="exportBtn" title="Export as markdown">
             ${icon("export")}</button>` : ""}
      <button class="icon-btn" id="settingsBtn" title="Settings">
        ${icon("settings")}</button>`;

    $("toggleSplit").addEventListener("click", () => {
      setSplit(!state.split);
      if (state.split && !pane("B").items.length) {
        el.paneB.innerHTML = `<div class="empty">${icon("split")}
          <p>Pick a file or a guide to show here.</p></div>`;
      }
    });
    const exportBtn = $("exportBtn");
    if (exportBtn) exportBtn.addEventListener("click",
      guard("Export", exportSheet));
    $("settingsBtn").addEventListener("click", guard("Settings", settingsSheet));
  }

  /* ---- export ------------------------------------------------------------- */

  async function exportSheet() {
    const preview = await AL.Store.call("export_preview", state.project);
    if (failed(preview, "Export")) return;

    openSheet(`Export ${state.project}`, (sheet) => {
      sheet.innerHTML = `
        <p class="sheet-note">One markdown file: every source file under its
          own heading, in a fenced block tagged with its language. That is
          the shape Amnesia reads, so it can be imported there as a note.
          <br><br>About ${Math.round(preview.bytes / 1024)} KB.</p>
        <div class="mono-block">${esc(preview.text)}${
          preview.truncated ? "\n\n… (preview truncated)" : ""}</div>`;
      const row = document.createElement("div");
      row.className = "sheet-row";
      row.innerHTML = `<button class="secondary-btn" data-close>Cancel</button>
        <button class="primary-btn" id="doExport">Write the file</button>`;
      sheet.appendChild(row);
      row.querySelector("[data-close]").addEventListener("click", closeSheet);
      row.querySelector("#doExport").addEventListener("click",
        guard("Export", async () => {
          const result = await AL.Store.call("export_markdown", state.project);
          if (failed(result, "Export")) return;
          closeSheet();
          toast(`Written to ${result.path}`);
        }));
    });
  }

  async function settingsSheet() {
    const settings = await AL.Store.call("get_settings");
    openSheet("Settings", (sheet) => {
      sheet.innerHTML = `
        <p class="sheet-note">Projects are real folders of real files —
          runnable, compilable and committable without Algorithm being
          involved.</p>
        <div class="field"><label>Projects folder</label>
          <input value="${esc(settings.projects_dir || "")}" readonly></div>
        <div class="field"><label>Guides folder</label>
          <input value="${esc(settings.guides_dir || "")}" readonly></div>`;
      sheetItem(sheet, {
        label: "Change where projects live", iconName: "folder",
        onClick: guard("Settings", async () => {
          const picked = await AL.Store.call("choose_folder");
          if (picked.cancelled) return;
          if (failed(picked, "Settings")) return;
          await AL.Store.call("set_setting", "projects_dir", picked.path);
          closeSheet();
          await loadProjects();
          toast("Projects folder changed");
        }),
      });
      if (state.project) {
        sheetItem(sheet, {
          label: `Delete “${state.project}”`, danger: true, iconName: "trash",
          sub: "Removes the folder and everything in it",
          onClick: guard("Delete", async () => {
            closeSheet();
            const name = state.project;
            const result = await AL.Store.call("delete_project", name);
            if (failed(result, "Delete")) return;
            state.project = null;
            state.tree = [];
            state.panes = { A: { items: [], active: -1 },
                            B: { items: [], active: -1 } };
            el.paneA.innerHTML = "";
            setSplit(false);
            await loadProjects();
            showWelcome();
            toast(`${name} deleted`);
          }),
        });
      }
      const about = document.createElement("p");
      about.className = "sheet-note";
      about.style.marginTop = "12px";
      about.textContent = `Build ${APP_VERSION}`;
      sheet.appendChild(about);
    });
  }

  /* ---- data --------------------------------------------------------------- */

  async function loadHistory(project) {
    const all = await AL.Store.call("command_history");
    term.history = (all && all[project]) || [];
    term.historyAt = -1;
  }

  async function loadProjects() {
    const result = await AL.Store.call("list_projects");
    state.projects = Array.isArray(result) ? result : [];
    renderRail();
  }

  async function loadGuides() {
    const result = await AL.Store.call("list_guides");
    state.guides = Array.isArray(result) ? result : [];
  }

  async function loadTree() {
    if (!state.project) { state.tree = []; return; }
    const result = await AL.Store.call("tree", state.project);
    if (failed(result, "Project")) return;
    state.tree = result.tree || [];
    renderRail();
  }

  async function openProject(name) {
    state.project = name;
    loadHistory(name);
    state.expanded = new Set();
    state.search = { needle: "", results: null,
                     caseSensitive: state.search.caseSensitive, busy: false };
    await loadTree();
    renderTopbar();
    if (!pane("A").items.length) showWelcome();
  }

  function showWelcome() {
    state.panes.A = { items: [], active: -1 };
    el.paneA.innerHTML = `<div class="empty">
      ${icon("algo")}
      <p>${state.project
        ? "Pick a file on the left, or make a new one."
        : "Make a project to start, or pick one on the left."}</p>
      <p>Open a guide beside your code with the split button above.</p>
    </div>`;
  }

  /* Dragging the divider between panes. Stored as a flex ratio rather than
     pixels so it survives the window being resized. */
  (function wireSplitDrag() {
    let dragging = false;
    el.paneSplit.addEventListener("pointerdown", (e) => {
      dragging = true;
      el.paneSplit.classList.add("is-dragging");
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
    document.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const rect = $("panes").getBoundingClientRect();
      const ratio = Math.min(0.8, Math.max(0.2,
        (e.clientX - rect.left) / rect.width));
      el.paneA.style.flex = `${ratio}`;
      el.paneB.style.flex = `${1 - ratio}`;
    });
    document.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      el.paneSplit.classList.remove("is-dragging");
      document.body.style.userSelect = "";
    });
  })();

  document.addEventListener("keydown", (e) => {
    if (!AL.visible()) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      // Ctrl+S anywhere saves the focused pane, not only inside the editor.
      const which = root.activeElement
        && el.paneB.contains(root.activeElement) ? "B" : "A";
      const item = activeItem(which);
      if (item && item.kind === "file") {
        e.preventDefault();
        saveFile(which);
      }
    }
    if (e.key === "Escape" && !el.sheetHost.hidden) closeSheet();
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (term.lastCommand) runCommand(term.lastCommand);
      else runSheet();
    }
    if ((e.ctrlKey || e.metaKey) && "fh".includes(e.key.toLowerCase())
        && !(e.composedPath()[0].closest && e.composedPath()[0].closest(".find"))) {
      const which = el.paneB.contains(root.activeElement) ? "B" : "A";
      const item = activeItem(which);
      if (item && item.editor) {
        e.preventDefault();
        item.editor.openFind(e.key.toLowerCase() === "h");
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "`") {
      e.preventDefault();
      setTerminal(!term.open);
    }
  });

  /* ---- terminal ------------------------------------------------------------
     Collapsed to its bar by default. The bar is both the status line and the
     way back, so the panel can never be lost off the bottom of the window.

     Output is polled while something is running and the poll stops when it
     finishes — pywebview has no channel from Python to JavaScript, and an
     idle app should not be waking up several times a second. Only the new
     bytes are fetched each time, using the offset the last call returned.
  */

  const term = {
    open: false,
    running: false,
    session: null,
    since: 0,
    timer: null,
    lastCommand: null,
    history: [],
    historyAt: -1,      // -1 means "not walking the history"
    draft: "",          // what was typed before walking into it
  };

  const termEl = {
    panel: $("term"), out: $("termOut"), split: $("termSplit"),
    bar: $("termBar"), toggle: $("termToggle"),
    label: $("termToggleLabel"), status: $("termStatus"),
    run: $("termRun"), stop: $("termStop"), clear: $("termClear"),
    form: $("termForm"), input: $("termInput"),
  };

  function setTerminal(open) {
    term.open = open;
    termEl.panel.hidden = !open;
    termEl.split.hidden = !open;
    termEl.toggle.setAttribute("aria-expanded", String(open));
    termEl.label.textContent = open ? "Hide terminal" : "Terminal";
    if (open) termEl.out.scrollTop = termEl.out.scrollHeight;
  }

  termEl.toggle.addEventListener("click", () => setTerminal(!term.open));

  /* ANSI SGR to spans. Only colour and the three text styles; everything
     else was already stripped on the Python side. Written as a small state
     machine rather than a regex replace so an unterminated sequence cannot
     leave the rest of the output inside a stray span. */
  function ansiToHtml(text) {
    let html = "";
    let openSpans = 0;
    let index = 0;
    const pattern = /\x1b\[([0-9;]*)m/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      html += esc(text.slice(index, match.index));
      index = match.index + match[0].length;
      const codes = (match[1] || "0").split(";").filter(Boolean).map(Number);
      if (!codes.length || codes.includes(0)) {
        html += "</span>".repeat(openSpans);
        openSpans = 0;
        continue;
      }
      const classes = [];
      for (const code of codes) {
        if (code === 1) classes.push("a-b");
        else if (code === 3) classes.push("a-i");
        else if (code === 4) classes.push("a-u");
        else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
          classes.push(`a-${code}`);
        }
      }
      if (classes.length) {
        html += `<span class="${classes.join(" ")}">`;
        openSpans += 1;
      }
    }
    html += esc(text.slice(index));
    html += "</span>".repeat(openSpans);
    return html;
  }

  function termWrite(html) {
    // Only autoscroll when already at the bottom, so scrolling back to read
    // an earlier error is not yanked away by continuing output.
    const atBottom = termEl.out.scrollHeight - termEl.out.scrollTop
      - termEl.out.clientHeight < 40;
    termEl.out.insertAdjacentHTML("beforeend", html);
    if (atBottom) termEl.out.scrollTop = termEl.out.scrollHeight;
  }

  function setRunning(running) {
    term.running = running;
    termEl.stop.hidden = !running;
    termEl.status.classList.toggle("is-running", running);
    termEl.input.placeholder = running
      ? "Type here to send input"
      : "Type a command and press Enter";
  }

  async function runCommand(command) {
    if (!state.project) { toast("Open a project first."); return; }

    // Save anything unsaved first: running the file you can see, not the one
    // on disk from ten minutes ago, is the only behaviour that makes sense.
    for (const which of ["A", "B"]) {
      for (const item of pane(which).items) {
        if (item.kind === "file" && item.dirty) await saveFile(which, item);
      }
    }

    const result = await AL.Store.call("run_command", state.project, command);
    if (failed(result, "Run")) return;

    AL.Store.call("remember_command", state.project, command);
    term.history = [command, ...term.history.filter((c) => c !== command)]
      .slice(0, 40);
    term.historyAt = -1;

    term.session = result.id;
    term.since = 0;
    term.lastCommand = command;
    setTerminal(true);
    termWrite(`<span class="term-cmd">\n› ${esc(command)}</span>\n`);
    termEl.status.textContent = command;
    termEl.status.classList.remove("is-bad");
    setRunning(true);
    pollTerminal();
  }

  function pollTerminal() {
    clearTimeout(term.timer);
    term.timer = setTimeout(guard("Terminal", async () => {
      if (!term.session) return;
      const snap = await AL.Store.call("run_output", term.session, term.since);
      if (snap.error) { setRunning(false); return; }
      if (snap.chunk) {
        term.since = snap.since;
        termWrite(ansiToHtml(snap.chunk));
      }
      if (snap.running) {
        termEl.status.textContent = `${term.lastCommand} — ${snap.elapsed}s`;
        pollTerminal();
      } else {
        setRunning(false);
        const ok = snap.exit_code === 0;
        termWrite(`<span class="${ok ? "exit-ok" : "exit-bad"}">`
          + `[${ok ? "finished" : `exit ${snap.exit_code}`} in ${snap.elapsed}s]`
          + `</span>\n`);
        termEl.status.textContent = ok
          ? `${term.lastCommand} — done in ${snap.elapsed}s`
          : `${term.lastCommand} — exit ${snap.exit_code}`;
        termEl.status.classList.toggle("is-bad", !ok);
      }
    }), 180);
  }

  termEl.run.addEventListener("click", guard("Run", runSheet));
  termEl.stop.addEventListener("click", guard("Stop", async () => {
    if (!term.session) return;
    await AL.Store.call("run_stop", term.session);
  }));
  termEl.clear.addEventListener("click", () => {
    termEl.out.innerHTML = "";
    termEl.status.textContent = "";
    termEl.status.classList.remove("is-bad");
  });

  /* Up and down walk the history, the way every shell does. What was
     already typed is kept and handed back on the way past the bottom, so
     reaching for an old command does not lose the half-written one. */
  termEl.input.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (term.running) return;          // typing here is input, not a command
    if (!term.history.length) return;
    e.preventDefault();

    if (e.key === "ArrowUp") {
      if (term.historyAt === -1) term.draft = termEl.input.value;
      term.historyAt = Math.min(term.historyAt + 1, term.history.length - 1);
    } else {
      term.historyAt -= 1;
      if (term.historyAt < 0) {
        term.historyAt = -1;
        termEl.input.value = term.draft;
        return;
      }
    }
    termEl.input.value = term.history[term.historyAt];
    // Caret to the end, so editing the recalled command is immediate.
    const end = termEl.input.value.length;
    requestAnimationFrame(() => termEl.input.setSelectionRange(end, end));
  });

  termEl.form.addEventListener("submit", guard("Input", async (e) => {
    e.preventDefault();
    const text = termEl.input.value;
    termEl.input.value = "";
    // Only send as input while something is actually running. A finished
    // session still has an id, and sending to it swallowed the text — so
    // typing a command after a run appeared to do nothing at all.
    if (!term.session || !term.running) {
      if (text.trim()) await runCommand(text);
      return;
    }
    await AL.Store.call("run_input", term.session, text + "\n");
  }));

  async function runSheet() {
    if (!state.project) { toast("Open a project first."); return; }
    const active = activeItem("A");
    const open = active && active.kind === "file" ? active : null;
    const result = await AL.Store.call("run_suggestions",
      open ? open.language : "plain", open ? open.path : null);
    const commands = (result && result.commands) || [];

    openSheet("Run", (sheet) => {
      sheet.innerHTML = `<p class="sheet-note">Runs in
        <code>${esc(state.project)}</code>. Anything unsaved is saved
        first.</p>`;
      commands.forEach((c) => sheetItem(sheet, {
        label: c, iconName: "play",
        onClick: guard("Run", () => { closeSheet(); return runCommand(c); }),
      }));

      const field = document.createElement("div");
      field.className = "field";
      field.style.marginTop = "12px";
      field.innerHTML = `<label for="runCmd">Or a command of your own</label>
        <input id="runCmd" placeholder="python3 -m pytest -q"
          autocomplete="off" spellcheck="false"
          value="${esc(term.lastCommand || "")}">`;
      sheet.appendChild(field);

      const row = document.createElement("div");
      row.className = "sheet-row";
      row.innerHTML = `<button class="secondary-btn" data-close>Cancel</button>
        <button class="primary-btn" id="runGo">Run</button>`;
      sheet.appendChild(row);
      row.querySelector("[data-close]").addEventListener("click", closeSheet);
      const go = guard("Run", () => {
        const command = sheet.querySelector("#runCmd").value.trim();
        if (!command) { toast("Type a command."); return; }
        closeSheet();
        return runCommand(command);
      });
      row.querySelector("#runGo").addEventListener("click", go);
      sheet.querySelector("#runCmd").addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); go(); }
      });
    });
  }

  /* Dragging the terminal's top edge. Height in pixels rather than a ratio:
     a terminal is read in lines, so a fixed number of them is what is
     wanted as the window changes size. */
  (function wireTermDrag() {
    let dragging = false;
    termEl.split.addEventListener("pointerdown", (e) => {
      dragging = true;
      termEl.split.classList.add("is-dragging");
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
    document.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const rect = $("stack").getBoundingClientRect();
      const height = Math.min(rect.height - 140, Math.max(90,
        rect.bottom - e.clientY - 32));
      termEl.panel.style.height = `${Math.round(height)}px`;
    });
    document.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      termEl.split.classList.remove("is-dragging");
      document.body.style.userSelect = "";
    });
  })();

  /* ---- boot --------------------------------------------------------------- */

  (async function init() {
    await AL.Store.ready;

    if (AL.Store.isDesktop()) {
      await Promise.all([loadProjects(), loadGuides()]);
      const settings = await AL.Store.call("get_settings");
      el.railFoot.textContent = settings.projects_dir || "neuronet_data/code";
      AL.Store.call("log_error", `--- started, build ${APP_VERSION} ---`);
    } else {
      el.railFoot.textContent = "browser preview";
    }

    renderRail();
    renderTopbar();
    showWelcome();

    if (AL.Store.isDesktop()) offerDrafts();
  })();

  /* If Algorithm closed with unsaved work, offer it back. Restoring puts
     the text in the editor unsaved rather than writing it to the file: the
     decision to overwrite what is on disk stays with the person who can
     see both. */
  async function offerDrafts() {
    const drafts = await AL.Store.call("list_drafts");
    if (!Array.isArray(drafts) || !drafts.length) return;

    openSheet("Unsaved work recovered", (sheet) => {
      sheet.innerHTML = `<p class="sheet-note">
        The IDE closed with ${drafts.length}
        file${drafts.length === 1 ? "" : "s"} unsaved. The text is still
        here. Opening one puts it back in the editor, still unsaved, so you
        can compare it against what is on disk before keeping it.</p>`;
      drafts.forEach((d) => sheetItem(sheet, {
        label: d.path, sub: `${d.project} · ${d.saved.replace("T", " ")}`,
        iconName: "file",
        onClick: guard("Recover", async () => {
          closeSheet();
          await openProject(d.project);
          await openFile("A", d.path);
          const item = activeItem("A");
          if (item && item.editor) {
            item.editor.value = d.text;
            markDirty("A", item, true);
          }
          toast("Recovered — not saved yet");
        }),
      }));
      const row = document.createElement("div");
      row.className = "sheet-row";
      row.innerHTML = `<button class="secondary-btn" id="dropDrafts">
        Discard them</button>`;
      sheet.appendChild(row);
      row.querySelector("#dropDrafts").addEventListener("click",
        guard("Discard", async () => {
          for (const d of drafts) {
            await AL.Store.call("clear_draft", d.project, d.path);
          }
          closeSheet();
          toast("Discarded");
        }));
    });
  }
};

/* ==========================================================================
   SS.Code -- Code -> IDE for NeuroNet's router (app.js).

   #code-shell stands in the page (index.html) like the other ported shells:
   NeuroNet hides every [id$="-shell"] before drawing a screen, so leaving
   the IDE hides it rather than destroying it -- open tabs keep their undo
   history and a running command keeps running, as in Algorithm. The IDE is
   drawn into the shell's shadow root once, the first time Code opens.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const ICONS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <g id="i-algo"><path d="M8 6L3 12l5 6M16 6l5 6-5 6M13.5 4l-3 16"/></g>
  <g id="i-folder"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></g>
  <g id="i-file"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></g>
  <g id="i-book"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M8 7h8M8 11h6"/></g>
  <g id="i-split"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/></g>
  <g id="i-export"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></g>
  <g id="i-settings"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></g>
  <g id="i-plus"><path d="M12 5v14M5 12h14"/></g>
  <g id="i-close"><path d="M6 6l12 12M18 6L6 18"/></g>
  <g id="i-chevron"><path d="M9 6l6 6-6 6"/></g>
  <g id="i-trash"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></g>
  <g id="i-save"><path d="M5 5h11l3 3v11H5z"/><path d="M9 5v5h6V5M9 19v-5h6v5"/></g>
  <g id="i-play"><path d="M8 5l11 7-11 7z"/></g>
  <g id="i-stop"><rect x="6" y="6" width="12" height="12" rx="2"/></g>
  <g id="i-term"><path d="M5 7l5 5-5 5M13 17h6"/></g>
  <g id="i-back"><path d="M15 6l-6 6 6 6"/></g>
</defs></svg>`;
  /* Algorithm's page, as its index.html had it -- the brand header left
     out: NeuroNet's own menus say where you are. */
  const MARKUP = `
<div class="app" id="app">
  <aside class="rail" id="rail">
    <div class="rail-body" id="railBody"></div>
    <footer class="rail-foot" id="railFoot"></footer>
  </aside>
  <main class="work">
    <header class="topbar">
      <div class="topbar-title">
        <span class="crumb" id="crumb"></span>
        <span class="page-title" id="pageTitle">IDE</span>
      </div>
      <div class="topbar-actions" id="topbarActions"></div>
    </header>
    <div class="stack" id="stack">
      <div class="panes" id="panes">
        <section class="pane" id="paneA"></section>
        <div class="pane-split" id="paneSplit" hidden></div>
        <section class="pane" id="paneB" hidden></section>
      </div>
      <div class="term-split" id="termSplit" hidden></div>
      <section class="term" id="term" hidden>
        <div class="term-out" id="termOut"></div>
        <form class="term-input-row" id="termForm">
          <span class="term-prompt">&rsaquo;</span>
          <input class="term-input" id="termInput" autocomplete="off"
                 spellcheck="false" placeholder="Type here to send input">
        </form>
      </section>
      <footer class="term-bar" id="termBar">
        <button class="term-toggle" id="termToggle" aria-expanded="false">
          <svg class="ic" viewBox="0 0 24 24"><use href="#i-chevron"/></svg>
          <span id="termToggleLabel">Terminal</span>
        </button>
        <span class="term-status" id="termStatus"></span>
        <div class="term-bar-actions">
          <button class="term-btn" id="termRun" title="Run">
            <svg class="ic" viewBox="0 0 24 24"><use href="#i-play"/></svg>Run</button>
          <button class="term-btn" id="termStop" title="Stop" hidden>
            <svg class="ic" viewBox="0 0 24 24"><use href="#i-stop"/></svg>Stop</button>
          <button class="term-btn" id="termClear" title="Clear">Clear</button>
        </div>
      </footer>
    </div>
  </main>
</div>
<div class="sheet-host" id="sheetHost" hidden>
  <div class="sheet-scrim" data-close></div>
  <div class="sheet" role="dialog" aria-modal="true">
    <div class="sheet-grip" aria-hidden="true"></div>
    <h2 class="sheet-title" id="sheetTitle"></h2>
    <div class="sheet-body" id="sheetBody"></div>
  </div>
</div>
<div class="toast" id="toast" hidden></div>`;

  let root = null;

  /** On screen: the shell shown and in the page (Multitask may have moved it). */
  AL.visible = () => {
    const shell = document.getElementById("code-shell");
    return !!(shell && !shell.hidden && shell.isConnected && shell.offsetParent !== null);
  };

  function startOnce(shell) {
    if (root) return;
    root = shell.attachShadow({ mode: "open" });
    root.innerHTML = `<link rel="stylesheet" href="${new URL("code/ide.css", document.baseURI).href}">`
      + ICONS + MARKUP;
    AL.start(root);
  }

  SS.Code = {
    /* Cam (2026-10-01): guides, a research tool and data structures join the
       IDE. Those three are NeuroNet screens drawn in the main pane
       (ui/code/library.js); only the IDE lives in #code-shell. */
    VIEWS: ["code:ide", "code:guides", "code:research", "code:structures", "code:web"],
    PREFIX: "code:",
    mount(host, view) {
      if (view && view !== "code:ide" && window.CL && CL.mount(host, view)) return;
      const shell = document.getElementById("code-shell");
      if (!shell) return;
      host.style.display = "none";
      shell.hidden = false;
      startOnce(shell);
    },
    get root() { return root; },
  };
})();
