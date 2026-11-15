/* ==========================================================================
   CL.Guides -- Code -> Guides: snippets, tutorials and design notes.
   ==========================================================================
   Cam (2026-10-01): "guides (built out like Neuro guides, but where i will
   place code snippet guides and tutorials)".

   So it is the Neuro Guide's split -- the guides listed on the left
   (searchable, grouped by topic), the chosen one read on the right -- in
   Code's indigo. The difference is that these are Cam's to add to: each is a
   markdown file (code_library.py), NeuroNet's starter set plus his own, and
   any of them can be edited. Code blocks are coloured, copyable, and run
   when the fence says so (CL.codeBlock).
   ========================================================================== */
(() => {
  "use strict";
  const CL = window.CL = window.CL || {};
  const esc = (s) => CL.esc(s);

  /* `editing` is the slug being edited ("" for a new one) and `draft` what's
     been typed, so leaving for another screen and coming back keeps it. */
  const state = {items: [], hidden: [], open: null, query: "", topic: "", editing: null, draft: null};

  async function load() {
    const r = await CL.call("list", "guides");
    if (r.error) { CL.toast(r.error, "error"); return false; }
    state.items = r.items; state.hidden = r.hidden;
    return true;
  }

  function matches(g) {
    const q = state.query.trim().toLowerCase();
    if (state.topic && g.topic !== state.topic) return false;
    return !q || g.title.toLowerCase().includes(q) || g.blurb.toLowerCase().includes(q)
      || g.topic.toLowerCase().includes(q) || CL.plain(g.text).includes(q);
  }

  async function mount(host) {
    host.innerHTML = `<p class="stamp">Opening the guides…</p>`;
    if (!(await load())) { host.innerHTML = `<p class="stamp">The guides couldn't be read.</p>`; return; }
    if (state.editing !== null) return edit(host, state.editing || null);
    render(host);
  }

  function render(host) {
    const topics = [...CL.groupBy(state.items, "topic").keys()];
    if (state.topic && !topics.includes(state.topic)) state.topic = "";
    host.innerHTML = `
      <div class="cl" data-screen="guides">
        <header class="cl-head">
          <div class="cl-kicker">Code</div>
          <h2 class="page-h">Guides</h2>
          <p class="stamp">Snippets, tutorials and the why behind good code. Add your own with New guide.</p>
          <div class="cl-head-actions">
            <button class="btn btn-primary btn-sm" id="cg-new">New guide</button>
            ${state.hidden.length ? `<button class="btn btn-quiet btn-sm" id="cg-hidden">Show hidden (${state.hidden.length})</button>` : ""}
          </div>
        </header>
        <div class="cl-split">
          <aside class="cl-list">
            <input class="input" type="search" id="cg-q" placeholder="Search the guides" value="${esc(state.query)}" autocomplete="off">
            <div class="chip-row cl-chips">
              <button class="chip${state.topic ? "" : " on"}" data-topic="">All</button>
              ${topics.map((t) => `<button class="chip${t === state.topic ? " on" : ""}" data-topic="${esc(t)}">${esc(t)}</button>`).join("")}
            </div>
            <div id="cg-items"></div>
          </aside>
          <article class="cl-page" id="cg-page"></article>
        </div>
      </div>`;
    const items = host.querySelector("#cg-items");
    const page = host.querySelector("#cg-page");

    const show = (g) => {
      if (!g) {
        page.innerHTML = `<p class="cl-empty">${state.items.length ? "Choose a guide." : "No guides yet — make the first with New guide."}</p>`;
        return;
      }
      state.open = g.slug;
      page.innerHTML = `
        <div class="cl-page-top">
          <div class="cl-page-meta"><span class="cl-tag">${esc(g.topic)}</span>${g.level ? `<span class="cl-tag cl-tag-quiet">${esc(g.level)}</span>` : ""}</div>
          <div class="cl-page-actions">
            <button class="btn btn-quiet btn-sm" data-act="edit">Edit</button>
            <button class="btn btn-quiet btn-sm" data-act="remove">${g.origin === "edited" ? "Back to NeuroNet's" : g.origin === "builtin" ? "Hide" : "Delete"}</button>
          </div>
        </div>
        <h3 class="cl-title">${esc(g.title)}</h3>
        ${g.blurb ? `<p class="cl-blurb">${esc(g.blurb)}</p>` : ""}
        <div class="cl-prose">${CL.markdown(g.text)}</div>
        <p class="cl-origin">${esc(CL.originNote(g.origin))}</p>`;
      CL.wireCode(page);
      page.querySelector('[data-act="edit"]').onclick = () => edit(host, g.slug);
      page.querySelector('[data-act="remove"]').onclick = () => remove(host, g);
      items.querySelectorAll(".cl-item").forEach((b) => b.classList.toggle("on", b.dataset.slug === g.slug));
    };

    const draw = () => {
      const hits = state.items.filter(matches);
      const groups = CL.groupBy(hits, "topic");
      items.innerHTML = hits.length ? [...groups].map(([topic, gs]) => `
        <div class="cl-group">${esc(topic)}</div>
        ${gs.map((g) => `<button class="cl-item${g.slug === state.open ? " on" : ""}" data-slug="${esc(g.slug)}">
          <span class="cl-item-title">${esc(g.title)}${g.origin !== "builtin" ? ` <span class="cl-mine" title="${esc(CL.originNote(g.origin))}">●</span>` : ""}</span>
          <span class="cl-item-sub">${esc(g.blurb)}</span></button>`).join("")}`).join("")
        : `<p class="cl-empty">No guide mentions that.</p>`;
      items.querySelectorAll(".cl-item").forEach((b) => b.onclick = () =>
        show(state.items.find((g) => g.slug === b.dataset.slug)));
    };

    host.querySelector("#cg-q").addEventListener("input", (e) => { state.query = e.target.value; draw(); });
    host.querySelectorAll("[data-topic]").forEach((c) => c.onclick = () => {
      state.topic = c.dataset.topic;
      host.querySelectorAll("[data-topic]").forEach((x) => x.classList.toggle("on", x === c));
      draw();
    });
    host.querySelector("#cg-new").onclick = () => edit(host, null);
    const hid = host.querySelector("#cg-hidden");
    if (hid) hid.onclick = () => showHidden(host);
    draw();
    show(state.items.find((g) => g.slug === state.open) || state.items[0]);
  }

  async function remove(host, g) {
    const yes = await SS.shared.confirm(g.origin === "edited"
      ? {title: "Back to NeuroNet's?", body: `Your changes to "${g.title}" will be thrown away and NeuroNet's version shown again.`, yes: "Throw mine away"}
      : g.origin === "builtin"
        ? {title: "Hide this guide?", body: `"${g.title}" is one of NeuroNet's. It'll be hidden; Show hidden brings it back.`, yes: "Hide"}
        : {title: "Delete this guide?", body: `"${g.title}" will be deleted.`, fine: "This can't be undone.", yes: "Delete"});
    if (!yes) return;
    const r = await CL.call("remove", "guides", g.slug);
    if (r.error) { CL.toast(r.error, "error"); return; }
    if (r.was !== "edited") state.open = null;
    await load();
    render(host);
  }

  function showHidden(host) {
    const d = SS.shared.openDlg("Hidden guides", `<p class="stamp">NeuroNet's guides you've hidden. Show one to put it back in the list.</p>
      ${state.hidden.map((h) => `<div class="cl-hidden-row"><span>${esc(h.title)}</span>
        <button class="btn btn-sm" data-slug="${esc(h.slug)}">Show</button></div>`).join("")}`);
    d.btn("Done", "btn-primary", d.close);
    d.body.querySelectorAll("[data-slug]").forEach((b) => b.onclick = async () => {
      await CL.call("unhide", "guides", b.dataset.slug);
      state.open = b.dataset.slug;
      d.close();
      await load();
      render(host);
    });
  }

  /* ---- the editor: the guide's details, its markdown, and how it'll look ---- */
  async function edit(host, slug) {
    let g = {title: "", blurb: "", topic: state.topic || "", level: "", text: "", origin: "mine"};
    if (slug) {
      const r = await CL.call("read", "guides", slug);
      if (r.error) { CL.toast(r.error, "error"); state.editing = null; return render(host); }
      g = r;
    }
    if (state.draft && state.draft.slug === (slug || "")) g = Object.assign({}, g, state.draft);
    state.editing = slug || "";
    const topics = [...CL.groupBy(state.items, "topic").keys()];
    host.innerHTML = `
      <div class="cl cl-editing" data-screen="guides">
        <header class="cl-head">
          <div class="cl-kicker">Code · Guides</div>
          <h2 class="page-h">${slug ? "Edit guide" : "New guide"}</h2>
          ${g.origin === "builtin" ? `<p class="stamp">This is one of NeuroNet's. Saving keeps your own copy; NeuroNet's stays as it was.</p>` : ""}
        </header>
        <div class="cl-form">
          <label class="label">Title<input class="input" id="ge-title" value="${esc(g.title)}" placeholder="Python list slicing"></label>
          <label class="label">One line about it<input class="input" id="ge-blurb" value="${esc(g.blurb)}" placeholder="What it's for, in a sentence"></label>
          <label class="label">Topic<input class="input" id="ge-topic" list="ge-topics" value="${esc(g.topic === "Other" ? "" : g.topic)}" placeholder="Python">
            <datalist id="ge-topics">${topics.map((t) => `<option value="${esc(t)}">`).join("")}</datalist></label>
          <label class="label">Level<input class="input" id="ge-level" list="ge-levels" value="${esc(g.level)}" placeholder="optional">
            <datalist id="ge-levels"><option value="Beginner"><option value="Intermediate"><option value="Advanced"></datalist></label>
        </div>
        <div class="cl-editor">
          <div class="cl-editor-pane">
            <div class="cl-editor-label">Markdown <span class="stamp">— fence code with \`\`\`python, or \`\`\`python run to give it a Run button</span></div>
            <textarea class="cl-textarea" id="ge-text" placeholder="## Write here">${esc(g.text)}</textarea>
          </div>
          <div class="cl-editor-pane">
            <div class="cl-editor-label">How it'll look</div>
            <div class="cl-page cl-preview"><div class="cl-prose" id="ge-preview"></div></div>
          </div>
        </div>
        <div class="cl-form-row">
          <button class="btn btn-quiet" id="ge-cancel">Cancel</button>
          <button class="btn btn-primary" id="ge-save">Save guide</button>
        </div>
      </div>`;
    const ta = host.querySelector("#ge-text");
    CL.codeArea(ta);
    const preview = host.querySelector("#ge-preview");
    let timer = null;
    const paint = () => { preview.innerHTML = CL.markdown(ta.value); CL.wireCode(preview); };
    ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(paint, 180); });
    paint();
    const fields = () => ({title: host.querySelector("#ge-title").value, blurb: host.querySelector("#ge-blurb").value,
                           topic: host.querySelector("#ge-topic").value, level: host.querySelector("#ge-level").value,
                           text: ta.value});
    host.querySelector(".cl-editing").addEventListener("input", () => {
      state.draft = Object.assign(fields(), {slug: slug || ""});
    });
    const leave = () => { state.editing = null; state.draft = null; render(host); };
    host.querySelector("#ge-cancel").onclick = leave;
    const save = async () => {
      const data = Object.assign(fields(), {order: slug && g.order !== 1000 ? g.order : ""});
      if (!data.title.trim()) { CL.toast("Give it a title.", "error"); host.querySelector("#ge-title").focus(); return; }
      const r = await CL.call("save", "guides", slug || null, data);
      if (r.error) { CL.toast(r.error, "error"); return; }
      state.open = r.slug;
      state.query = "";
      state.topic = "";
      CL.toast("Saved", "good");
      await load();
      leave();
    };
    host.querySelector("#ge-save").onclick = save;
    host.querySelector(".cl-editing").addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    });
    (slug ? ta : host.querySelector("#ge-title")).focus();
  }

  CL.Guides = {mount, _state: state};
})();
