/* ==========================================================================
   CL.Web -- Code -> Web playground: HTML and CSS on the left, the page on
   the right, as you type.

   Cam (2026-10-02): "Is there the possibility tro create an environment that
   i can code html and css in where it will have one side of the screen for my
   code and the other to run a live environment where it can show me my
   changes instantly or when pressing a refresh key ... take the perspective
   of a senior cyber security expert to ensure there is no chance for remote
   code execution within the application."

   SECURITY. The preview is an <iframe sandbox=""> -- every restriction on:
     * no scripts at all (a <script>, an onclick=, a javascript: link: none
       of them run), so nothing in a page can reach NeuroNet's page or its
       bridge to the computer (window.pywebview.api);
     * a unique origin: it can't read NeuroNet's page, storage or files;
     * no forms, no pop-ups, no new windows, no taking over the window;
     * its own Content-Security-Policy: nothing is fetched from anywhere
       (no web fonts, pictures, trackers) -- inline CSS and data: pictures
       only; and NeuroNet's window refuses to let any frame load a web page
       (navigation_verdict in neuronet.py).
   The page reaches the preview as text (srcdoc), never by a file:// URL. HTML
   and CSS only -- that is the whole point; it's never eval'd, never served,
   never opened in a browser by NeuroNet. Pages are saved by id
   (code_web.py), never by a path from here.
   ========================================================================== */
(function () {
  "use strict";
  const CL = window.CL = window.CL || {};
  const esc = (s) => CL.esc(s);
  const call = async (name, ...args) => {
    const api = window.pywebview && window.pywebview.api;
    const fn = api && api["code_web_" + name];
    if (typeof fn !== "function") return {error: "This needs NeuroNet's window."};
    try { return (await fn(...args)) || {}; } catch (e) { return {error: (e && e.message) || String(e)}; }
  };

  /* The preview's own rules: nothing loads from anywhere, nothing runs. */
  const PREVIEW_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; "
    + "font-src data:; media-src data:; form-action 'none'; base-uri 'none'";
  const SANDBOX = "";              // sandbox="" -- every restriction (see above)

  const STARTER = {
    name: "My first page",
    html: `<main class="card">
  <h1>Hello, NeuroNet</h1>
  <p>Change this HTML on the left, or the CSS, and watch the page change here.</p>
  <a class="btn" href="#">A button</a>
</main>`,
    css: `body {
  font-family: system-ui, sans-serif;
  background: #0d1510;
  color: #cfe6d4;
  display: grid;
  place-items: center;
  min-height: 100vh;
  margin: 0;
}
.card {
  padding: 32px 40px;
  border-radius: 16px;
  background: #13201a;
  box-shadow: 0 0 0 1px #5fa66544, 0 12px 40px #0008;
}
h1 { color: #5fa665; margin-top: 0; }
.btn {
  display: inline-block;
  padding: 10px 18px;
  border-radius: 10px;
  background: #5fa665;
  color: #04110a;
  text-decoration: none;
  font-weight: 700;
}`,
  };

  const state = {host: null, pages: [], page: null, tab: "html", live: true, dirty: false};
  let saveTimer = null, drawTimer = null;

  /** The text the preview frame is given. */
  function previewDoc(html, css) {
    return `<!doctype html><html><head><meta charset="utf-8">`
      + `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`
      + `<style>${String(css || "").replace(/<\/style/gi, "<\\/style")}</style></head>`
      + `<body>${String(html || "")}</body></html>`;
  }

  function draw() {
    const f = state.host && state.host.querySelector("#wp-frame");
    if (!f || !state.page) return;
    f.setAttribute("sandbox", SANDBOX);      // set again every time: it is never loosened
    f.srcdoc = previewDoc(state.page.html, state.page.css);
    const s = state.host.querySelector("#wp-stamp");
    if (s) s.textContent = "Shown " + new Date().toLocaleTimeString();
  }

  function scheduleSave() {
    state.dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 800);
  }
  async function save() {
    clearTimeout(saveTimer);
    if (!state.page || !state.dirty) return;
    state.dirty = false;
    const p = state.page;
    const r = await call("write", p.id || "", {name: p.name, html: p.html, css: p.css});
    if (r.error) { CL.toast(r.error, "error"); state.dirty = true; return; }
    if (!p.id) { p.id = r.id; await loadList(); paintList(); }
  }

  async function loadList() {
    const r = await call("list");
    state.pages = Array.isArray(r) ? r : [];
  }

  async function open(id) {
    await save();
    const r = await call("read", id);
    if (r.error) { CL.toast(r.error, "error"); return; }
    state.page = r;
    paint();
  }

  async function newPage(blank) {
    await save();
    state.page = blank ? {id: "", name: "Untitled page", html: "", css: ""}
      : {id: "", name: STARTER.name, html: STARTER.html, css: STARTER.css};
    state.dirty = true;
    await save();
    paint();
  }

  function paintList() {
    const sel = state.host.querySelector("#wp-pages");
    if (!sel) return;
    sel.innerHTML = state.pages.map((p) => `<option value="${esc(p.id)}" ${state.page && p.id === state.page.id ? "selected" : ""}>${esc(p.name)}</option>`).join("");
  }

  function paint() {
    const h = state.host, p = state.page;
    h.innerHTML = `
      <div class="cl wp" data-screen="web">
        <header class="cl-head">
          <div class="cl-kicker">Code</div>
          <h2 class="page-h">Web playground</h2>
          <p class="stamp">HTML and CSS on the left, the page on the right. Scripts never run here —
            the preview is sealed off from NeuroNet and from the internet.</p>
        </header>
        <div class="wp-bar">
          <select class="input wp-pages" id="wp-pages" aria-label="Your pages"></select>
          <input class="input wp-name" id="wp-name" value="${esc(p.name)}" aria-label="Page name">
          <button class="btn btn-quiet" id="wp-new">New</button>
          <span class="wp-gap"></span>
          <label class="wp-live"><input type="checkbox" id="wp-live" ${state.live ? "checked" : ""}> Live</label>
          <button class="btn btn-quiet" id="wp-refresh" title="Ctrl+Enter">Refresh</button>
          <button class="btn btn-quiet" id="wp-export">Export .html</button>
          <button class="btn btn-quiet" id="wp-delete">Delete</button>
        </div>
        <div class="wp-split">
          <section class="wp-code">
            <div class="wp-tabs" role="tablist">
              <button class="wp-tab ${state.tab === "html" ? "on" : ""}" data-tab="html" role="tab">HTML</button>
              <button class="wp-tab ${state.tab === "css" ? "on" : ""}" data-tab="css" role="tab">CSS</button>
            </div>
            <textarea class="wp-ed" id="wp-ed" spellcheck="false" autocomplete="off" autocapitalize="off"
                      aria-label="${state.tab === "html" ? "HTML" : "CSS"}"></textarea>
          </section>
          <section class="wp-view">
            <div class="wp-view-h"><span>The page</span><span class="stamp" id="wp-stamp"></span></div>
            <iframe class="wp-frame" id="wp-frame" sandbox="" title="Your page"
                    referrerpolicy="no-referrer"></iframe>
          </section>
        </div>
      </div>`;
    paintList();
    const ed = h.querySelector("#wp-ed");
    ed.value = p[state.tab];

    ed.addEventListener("input", () => {
      p[state.tab] = ed.value;
      scheduleSave();
      if (state.live) { clearTimeout(drawTimer); drawTimer = setTimeout(draw, 250); }
    });
    ed.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); draw(); return; }
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey) {          // two spaces, not the next field
        e.preventDefault();
        const a = ed.selectionStart, b = ed.selectionEnd;
        ed.setRangeText("  ", a, b, "end");
        ed.dispatchEvent(new Event("input"));
      }
    });
    h.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
      state.tab = b.dataset.tab;
      h.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("on", x === b));
      ed.value = p[state.tab];
      ed.setAttribute("aria-label", state.tab === "html" ? "HTML" : "CSS");
      ed.focus();
    }));
    h.querySelector("#wp-name").addEventListener("input", (e) => { p.name = e.target.value; scheduleSave(); });
    h.querySelector("#wp-name").addEventListener("change", async () => { await save(); await loadList(); paintList(); });
    h.querySelector("#wp-pages").addEventListener("change", (e) => open(e.target.value));
    h.querySelector("#wp-new").addEventListener("click", () => newPage(true));
    h.querySelector("#wp-live").addEventListener("change", (e) => { state.live = e.target.checked; if (state.live) draw(); });
    h.querySelector("#wp-refresh").addEventListener("click", draw);
    h.querySelector("#wp-export").addEventListener("click", async () => {
      await save();
      const r = await call("export", p.id);
      if (r.error) CL.toast(r.error, "error");
      else if (r.ok) CL.toast("Saved as " + r.path);
    });
    h.querySelector("#wp-delete").addEventListener("click", async () => {
      const yes = await SS.shared.confirm({title: `Delete “${p.name}”?`, body: "The page and its CSS are deleted.", yes: "Delete"});
      if (!yes) return;
      clearTimeout(saveTimer);
      state.dirty = false;
      if (p.id) await call("delete", p.id);
      await loadList();
      if (state.pages.length) await open(state.pages[0].id); else await newPage(false);
    });
    draw();
  }

  async function mount(host) {
    state.host = host;
    await loadList();
    if (state.page && state.pages.some((x) => x.id === state.page.id)) { paint(); return; }
    if (state.pages.length) await open(state.pages[0].id);
    else await newPage(false);           // a first page to start from
  }

  CL.Web = {mount, _test: {previewDoc, PREVIEW_CSP, SANDBOX, state, save, draw}};
})();
