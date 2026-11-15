/* ==========================================================================
   CL.Structures -- Code -> Data Structures.
   ==========================================================================
   Cam (2026-10-01): "a data structures sub section (This will contain common
   data structures and their implementations in Python and Javascript, more
   if reccommended by you)."

   Each structure is a folder (code_library.py): about.md -- what it is, a
   table of what each operation costs, and the design lesson it teaches --
   and one source file per language. Every implementation checks itself
   when run, so Run is a real test, and test_code_library.py runs them all.

   The page reads the explanation beside the code, and "Side by side" puts
   two languages next to each other -- the quickest way to learn the second
   one is against a first you already know. More languages (TypeScript, Rust,
   Go, C, C++, Java) can be added to any structure from its editor.
   ========================================================================== */
(() => {
  "use strict";
  const CL = window.CL = window.CL || {};
  const esc = (s) => CL.esc(s);

  const state = {items: [], hidden: [], languages: {}, open: null, query: "", lang: "python",
                 side: false, editing: null, draft: null, cache: {}};

  async function load() {
    const r = await CL.call("list", "structures");
    if (r.error) { CL.toast(r.error, "error"); return false; }
    state.items = r.items; state.hidden = r.hidden; state.languages = r.languages || {};
    state.cache = {};
    return true;
  }

  const label = (lang) => (state.languages[lang] && state.languages[lang].label) || lang;
  const hl = (lang) => (state.languages[lang] && state.languages[lang].hl) || "plain";

  async function full(slug) {
    if (!state.cache[slug]) {
      const r = await CL.call("read", "structures", slug);
      if (r.error) { CL.toast(r.error, "error"); return null; }
      state.cache[slug] = r;
    }
    return state.cache[slug];
  }

  async function mount(host) {
    host.innerHTML = `<p class="stamp">Opening the data structures…</p>`;
    if (!(await load())) { host.innerHTML = `<p class="stamp">The data structures couldn't be read.</p>`; return; }
    if (state.editing !== null) return edit(host, state.editing || null);
    render(host);
  }

  function render(host) {
    host.innerHTML = `
      <div class="cl" data-screen="structures">
        <header class="cl-head">
          <div class="cl-kicker">Code</div>
          <h2 class="page-h">Data Structures</h2>
          <p class="stamp">How each one works, what it costs, the design lesson in it — and code you can run and change.</p>
          <div class="cl-head-actions">
            <button class="btn btn-primary btn-sm" id="cs-new">New structure</button>
            ${state.hidden.length ? `<button class="btn btn-quiet btn-sm" id="cs-hidden">Show hidden (${state.hidden.length})</button>` : ""}
          </div>
        </header>
        <div class="cl-split">
          <aside class="cl-list">
            <input class="input" type="search" id="cs-q" placeholder="Search the structures" value="${esc(state.query)}" autocomplete="off">
            <div id="cs-items"></div>
          </aside>
          <article class="cl-page cl-page-wide" id="cs-page"></article>
        </div>
      </div>`;
    const items = host.querySelector("#cs-items");
    const page = host.querySelector("#cs-page");

    const show = async (summary) => {
      if (!summary) {
        page.innerHTML = `<p class="cl-empty">${state.items.length ? "Choose a data structure." : "None yet — add one with New structure."}</p>`;
        return;
      }
      state.open = summary.slug;
      items.querySelectorAll(".cl-item").forEach((b) => b.classList.toggle("on", b.dataset.slug === summary.slug));
      const s = await full(summary.slug);
      if (!s || state.open !== summary.slug) return;
      const langs = s.languages;
      if (!langs.includes(state.lang)) state.lang = langs[0];
      const other = langs.find((l) => l !== state.lang);
      page.innerHTML = `
        <div class="cl-page-top">
          <div class="cl-page-meta"><span class="cl-tag">${esc(s.category)}</span></div>
          <div class="cl-page-actions">
            <button class="btn btn-quiet btn-sm" data-act="edit">Edit</button>
            <button class="btn btn-quiet btn-sm" data-act="remove">${s.origin === "edited" ? "Back to NeuroNet's" : s.origin === "builtin" ? "Hide" : "Delete"}</button>
          </div>
        </div>
        <h3 class="cl-title">${esc(s.title)}</h3>
        ${s.blurb ? `<p class="cl-blurb">${esc(s.blurb)}</p>` : ""}
        <div class="cl-ds${state.side && other ? " side" : ""}">
          <section class="cl-prose cl-ds-about">${CL.markdown(s.text)}</section>
          <section class="cl-ds-code">
            ${langs.length ? `<div class="cl-langs">
              <div class="seg">${langs.map((l) => `<button class="seg-btn${l === state.lang ? " on" : ""}" data-lang="${esc(l)}">${esc(label(l))}</button>`).join("")}</div>
              ${other ? `<label class="cl-side"><input type="checkbox" id="cs-side"${state.side ? " checked" : ""}> Side by side</label>` : ""}
            </div>
            <div class="cl-impls${state.side && other ? " two" : ""}">
              ${[state.lang].concat(state.side && other ? [other] : []).map((l) => implBlock(s, l)).join("")}
            </div>
            <p class="stamp cl-ds-hint">Run checks the implementation against the tests at its bottom. Change it in Edit and see what breaks.</p>`
            : `<p class="cl-empty">No code yet. Add a language in Edit.</p>`}
          </section>
        </div>
        <p class="cl-origin">${esc(CL.originNote(s.origin))}</p>`;
      CL.wireCode(page);
      page.querySelectorAll(".seg-btn[data-lang]").forEach((b) => b.onclick = () => { state.lang = b.dataset.lang; show(summary); });
      const side = page.querySelector("#cs-side");
      if (side) side.onchange = () => { state.side = side.checked; show(summary); };
      page.querySelector('[data-act="edit"]').onclick = () => edit(host, s.slug);
      page.querySelector('[data-act="remove"]').onclick = () => remove(host, s);
    };

    const draw = () => {
      const q = state.query.trim().toLowerCase();
      const hits = state.items.filter((s) => !q || s.title.toLowerCase().includes(q)
        || s.blurb.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || CL.plain(s.text).includes(q));
      items.innerHTML = hits.length ? [...CL.groupBy(hits, "category")].map(([cat, ss]) => `
        <div class="cl-group">${esc(cat)}</div>
        ${ss.map((s) => `<button class="cl-item${s.slug === state.open ? " on" : ""}" data-slug="${esc(s.slug)}">
          <span class="cl-item-title">${esc(s.title)}${s.origin !== "builtin" ? ` <span class="cl-mine" title="${esc(CL.originNote(s.origin))}">●</span>` : ""}</span>
          <span class="cl-item-sub">${esc(s.blurb)}</span>
          <span class="cl-item-langs">${s.languages.map((l) => `<span>${esc(label(l))}</span>`).join("")}</span></button>`).join("")}`).join("")
        : `<p class="cl-empty">Nothing matches that.</p>`;
      items.querySelectorAll(".cl-item").forEach((b) => b.onclick = () =>
        show(state.items.find((s) => s.slug === b.dataset.slug)));
    };

    host.querySelector("#cs-q").addEventListener("input", (e) => { state.query = e.target.value; draw(); });
    host.querySelector("#cs-new").onclick = () => edit(host, null);
    const hid = host.querySelector("#cs-hidden");
    if (hid) hid.onclick = () => showHidden(host);
    draw();
    show(state.items.find((s) => s.slug === state.open) || state.items[0]);
  }

  function implBlock(s, lang) {
    const code = s.code[lang] || "";
    const runnable = ["python", "javascript", "typescript", "rust", "go", "c", "cpp", "java"].includes(lang);
    return `<div class="cl-code" data-lang="${esc(lang)}">
      <div class="cl-code-bar"><span class="cl-code-lang">${esc(label(lang))} · ${code.split("\n").length} lines</span>
        <button class="cl-code-btn" data-act="copy" title="Copy">Copy</button>
        ${runnable ? `<button class="cl-code-btn cl-run" data-act="run" title="Run it and its checks">&#9654; Run</button>` : ""}
      </div>
      <pre class="cl-numbered"><code>${numbered(code, hl(lang))}</code></pre>
      <pre class="cl-out" hidden></pre>
    </div>`;
  }

  /** Highlighted code with line numbers (a gutter the copy leaves out). */
  function numbered(code, lang) {
    return CL.highlight(code, lang).split("\n")
      .map((line, i) => `<span class="cl-ln" data-n="${i + 1}"></span>${line}`).join("\n");
  }

  async function remove(host, s) {
    const yes = await SS.shared.confirm(s.origin === "edited"
      ? {title: "Back to NeuroNet's?", body: `Your changes to "${s.title}" will be thrown away and NeuroNet's version shown again.`, yes: "Throw mine away"}
      : s.origin === "builtin"
        ? {title: "Hide this structure?", body: `"${s.title}" is one of NeuroNet's. It'll be hidden; Show hidden brings it back.`, yes: "Hide"}
        : {title: "Delete this structure?", body: `"${s.title}" and all its code will be deleted.`, fine: "This can't be undone.", yes: "Delete"});
    if (!yes) return;
    const r = await CL.call("remove", "structures", s.slug);
    if (r.error) { CL.toast(r.error, "error"); return; }
    if (r.was !== "edited") state.open = null;
    await load();
    render(host);
  }

  function showHidden(host) {
    const d = SS.shared.openDlg("Hidden data structures", `<p class="stamp">NeuroNet's structures you've hidden.</p>
      ${state.hidden.map((h) => `<div class="cl-hidden-row"><span>${esc(h.title)}</span>
        <button class="btn btn-sm" data-slug="${esc(h.slug)}">Show</button></div>`).join("")}`);
    d.btn("Done", "btn-primary", d.close);
    d.body.querySelectorAll("[data-slug]").forEach((b) => b.onclick = async () => {
      await CL.call("unhide", "structures", b.dataset.slug);
      state.open = b.dataset.slug;
      d.close();
      await load();
      render(host);
    });
  }

  /* A new structure starts with a skeleton that already has the shape every
     built-in has: the explanation's headings, and code that checks itself. */
  const ABOUT_TEMPLATE = `## What it is

## Cost of each operation

| Operation | Time | Why |
| --- | --- | --- |
|  |  |  |

## The design lesson

## Use it when
`;
  const CODE_TEMPLATE = {
    python: `"""What it is, in a line."""


class Thing:
    def __init__(self):
        pass


if __name__ == "__main__":
    t = Thing()
    assert t is not None
    print("Thing: all checks passed")
`,
    javascript: `// What it is, in a line.
"use strict";

class Thing {
  constructor() {}
}

// ---- checks ----
const assert = (cond, msg) => { if (!cond) throw new Error("check failed: " + msg); };
const t = new Thing();
assert(t, "made one");
console.log("Thing: all checks passed");
`,
  };

  /* ---- the editor ---- */
  async function edit(host, slug) {
    let s = {title: "", blurb: "", category: "", text: ABOUT_TEMPLATE, origin: "mine",
             languages: ["python", "javascript"], code: Object.assign({}, CODE_TEMPLATE)};
    if (slug) {
      const r = await full(slug);
      if (!r) { state.editing = null; return render(host); }
      s = JSON.parse(JSON.stringify(r));
    }
    if (state.draft && state.draft.slug === (slug || "")) s = Object.assign(s, JSON.parse(JSON.stringify(state.draft)));
    state.editing = slug || "";
    const original = slug ? state.cache[slug].languages.slice() : [];
    let lang = s.languages.includes(state.lang) ? state.lang : s.languages[0];
    const cats = [...CL.groupBy(state.items, "category").keys()];

    host.innerHTML = `
      <div class="cl cl-editing" data-screen="structures">
        <header class="cl-head">
          <div class="cl-kicker">Code · Data Structures</div>
          <h2 class="page-h">${slug ? "Edit " + esc(s.title) : "New data structure"}</h2>
          ${s.origin === "builtin" ? `<p class="stamp">This is one of NeuroNet's. Saving keeps your own copy; NeuroNet's stays as it was.</p>` : ""}
        </header>
        <div class="cl-form">
          <label class="label">Name<input class="input" id="se-title" value="${esc(s.title)}" placeholder="Deque"></label>
          <label class="label">One line about it<input class="input" id="se-blurb" value="${esc(s.blurb)}" placeholder="What it's for, in a sentence"></label>
          <label class="label">Category<input class="input" id="se-cat" list="se-cats" value="${esc(s.category === "Other" ? "" : s.category)}" placeholder="Linear">
            <datalist id="se-cats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></label>
        </div>
        <div class="cl-editor">
          <div class="cl-editor-pane">
            <div class="cl-editor-label">About it <span class="stamp">— markdown</span></div>
            <textarea class="cl-textarea" id="se-text">${esc(s.text)}</textarea>
          </div>
          <div class="cl-editor-pane">
            <div class="cl-editor-label cl-lang-bar">
              <div class="seg" id="se-langs"></div>
              <select class="input cl-add-lang" id="se-add"></select>
            </div>
            <textarea class="cl-textarea cl-mono" id="se-code"></textarea>
            <div class="cl-code-bar cl-editor-run">
              <button class="btn btn-quiet btn-sm" id="se-drop">Remove this language</button>
              <button class="btn btn-sm" id="se-run">&#9654; Run</button>
            </div>
            <pre class="cl-out" id="se-out" hidden></pre>
          </div>
        </div>
        <div class="cl-form-row">
          <button class="btn btn-quiet" id="se-cancel">Cancel</button>
          <button class="btn btn-primary" id="se-save">Save</button>
        </div>
      </div>`;
    const codeTa = host.querySelector("#se-code");
    const aboutTa = host.querySelector("#se-text");
    CL.codeArea(codeTa);
    CL.codeArea(aboutTa);
    const keep = () => {
      if (lang) s.code[lang] = codeTa.value;
      state.draft = {slug: slug || "", title: host.querySelector("#se-title").value,
                     blurb: host.querySelector("#se-blurb").value, category: host.querySelector("#se-cat").value,
                     text: aboutTa.value, languages: s.languages.slice(), code: Object.assign({}, s.code)};
    };
    const paintLangs = () => {
      const segs = host.querySelector("#se-langs");
      segs.innerHTML = s.languages.map((l) => `<button class="seg-btn${l === lang ? " on" : ""}" data-lang="${esc(l)}">${esc(label(l))}</button>`).join("")
        || `<span class="stamp">No languages yet</span>`;
      segs.querySelectorAll("[data-lang]").forEach((b) => b.onclick = () => { keep(); lang = b.dataset.lang; paintLangs(); });
      const add = host.querySelector("#se-add");
      const left = Object.keys(state.languages).filter((l) => !s.languages.includes(l));
      add.innerHTML = `<option value="">+ Add a language</option>` + left.map((l) => `<option value="${esc(l)}">${esc(label(l))}</option>`).join("");
      add.hidden = !left.length;
      codeTa.disabled = !lang;
      codeTa.value = lang ? (s.code[lang] || "") : "";
      host.querySelector("#se-drop").disabled = !lang;
      host.querySelector("#se-run").disabled = !lang;
      host.querySelector("#se-out").hidden = true;
    };
    host.querySelector("#se-add").onchange = (e) => {
      const l = e.target.value;
      if (!l) return;
      keep();
      s.languages.push(l);
      if (s.code[l] === undefined) s.code[l] = CODE_TEMPLATE[l] || "";
      lang = l;
      paintLangs();
      keep();
      codeTa.focus();
    };
    host.querySelector("#se-drop").onclick = async () => {
      const yes = await SS.shared.confirm({title: `Remove ${label(lang)}?`, body: `The ${label(lang)} code goes when you save.`, yes: "Remove"});
      if (!yes) return;
      s.languages = s.languages.filter((l) => l !== lang);
      delete s.code[lang];
      lang = s.languages[0] || null;
      paintLangs();
      keep();
    };
    host.querySelector("#se-run").onclick = (e) => { keep(); CL.run(lang, codeTa.value, host.querySelector("#se-out"), e.currentTarget); };
    host.querySelector(".cl-editing").addEventListener("input", keep);
    paintLangs();

    const leave = () => { state.editing = null; state.draft = null; render(host); };
    host.querySelector("#se-cancel").onclick = leave;
    const save = async () => {
      keep();
      const title = host.querySelector("#se-title").value;
      if (!title.trim()) { CL.toast("Give it a name.", "error"); host.querySelector("#se-title").focus(); return; }
      const code = {};
      for (const l of s.languages) code[l] = s.code[l] || "";
      for (const l of original) if (!s.languages.includes(l)) code[l] = null;   // taken away
      const r = await CL.call("save", "structures", slug || null, {
        title, blurb: host.querySelector("#se-blurb").value, category: host.querySelector("#se-cat").value,
        text: aboutTa.value, code, order: slug && s.order !== 1000 ? s.order : ""});
      if (r.error) { CL.toast(r.error, "error"); return; }
      state.open = r.slug;
      if (lang) state.lang = lang;
      CL.toast("Saved", "good");
      await load();
      leave();
    };
    host.querySelector("#se-save").onclick = save;
    host.querySelector(".cl-editing").addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    });
    (slug ? codeTa : host.querySelector("#se-title")).focus();
  }

  CL.Structures = {mount, _state: state};
})();
