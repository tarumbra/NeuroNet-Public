/* ==========================================================================
   Archive — Scribe's attic (2026-11-02).

   Cam: "implement an archive in the scribe app, which contains all archived
   notes, collabs etc this will stop cluttering the main apps".

   Collaboration documents marked "archived" (collab.py) and notes or folders
   moved into a vault's hidden .archive folder (notes_backend.py) are listed
   here together, with a search; the right-hand side shows the one chosen and
   puts it back where it came from. Archiving is done where the thing lives:
   a document's Archive button, a note's right-click menu.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "The archive");
  const KIND = {playtest: "Play test", questions: "Questions", bug: "Bug", idea: "Idea", note: "Note", vote: "Vote", concern: "Concern"};
  const STATUS = {open: "was open", answered: "was over to Claude", closed: "was done"};
  const state = {filter: "all", q: "", sel: "", items: [], preview: null};
  const keyOf = (it) => it.src === "collab" ? "c:" + it.ref : "n:" + it.vault + ":" + it.path;
  const when = (t) => { try { return new Date(t).toLocaleDateString([], {day: "numeric", month: "short", year: "numeric"}); } catch (e) { return ""; } };

  async function load() {
    const [docs, notes] = await Promise.all([call("collab_list", [], "The collaboration desk"), call("notes_archive_list", [], "Archived notes")]);
    const c = (Array.isArray(docs) ? docs : []).filter((d) => d.archived).map((d) => ({src: "collab", ref: d.ref, title: d.title, project: d.project || "General",
      kind: d.type, status: d.status, when: d.updated, text: (d.ref + " " + d.title + " " + (d.project || "")).toLowerCase()}));
    const n = (Array.isArray(notes) ? notes : []).map((x) => ({src: "notes", vault: x.vault, vaultName: x.vaultName, path: x.path, title: x.name, kind: x.type,
      count: x.count, when: x.when * 1000, text: (x.name + " " + x.path + " " + x.vaultName).toLowerCase()}));
    state.items = c.concat(n);
  }
  const shown = () => state.items.filter((it) => (state.filter === "all" || it.src === state.filter) && (!state.q || state.q.split(/\s+/).every((w) => it.text.includes(w))));

  function rowHTML(it) {
    const sub = it.src === "collab" ? `${esc(it.project)} · ${esc(KIND[it.kind] || it.kind)}`
      : `${esc(it.vaultName)} · ${esc(it.path.includes("/") ? it.path.slice(0, it.path.lastIndexOf("/")) : "top of the vault")}`;
    const tag = it.src === "collab" ? `<span class="ar-ref">${esc(it.ref)}</span>` : `<span class="ar-ref ar-note">${it.kind === "folder" ? "▤" : "✎"}</span>`;
    return `<button class="ar-row${keyOf(it) === state.sel ? " on" : ""}" data-key="${esc(keyOf(it))}">${tag}<span class="ar-row-main"><b>${esc(it.title)}</b><small>${sub}</small></span></button>`;
  }
  function listHTML() {
    const list = shown();
    if (!list.length) return `<p class="stamp ar-empty">${state.items.length ? "Nothing archived matches that." : "Nothing archived yet. Archive a Collaboration document with its Archive button, or a note from its right-click menu."}</p>`;
    const group = (src, name) => { const g = list.filter((x) => x.src === src); return g.length ? `<h4 class="ar-group">${name} <small>${g.length}</small></h4>${g.map(rowHTML).join("")}` : ""; };
    return group("collab", "Collaboration") + group("notes", "Notes");
  }
  function previewHTML() {
    const it = state.items.find((x) => keyOf(x) === state.sel), p = state.preview;
    if (!it) return `<div class="ar-blank"><h2 class="page-h">Archive</h2><p>Everything put away from Collaboration and Notes, out of the way but kept.
      Pick one on the left to read it, or put it back where it came from.</p><p class="stamp">${state.items.length} archived.</p></div>`;
    if (it.src === "collab") {
      const d = p && p.ref === it.ref ? p : null;
      return `<div class="ar-doc"><div class="ar-head"><span class="ar-ref big">${esc(it.ref)}</span><h2>${esc(it.title)}</h2></div>
        <div class="stamp">${esc(KIND[it.kind] || it.kind)} · ${esc(it.project)} · ${esc(STATUS[it.status] || it.status)} · last changed ${esc(when(it.when))}</div>
        <div class="ar-acts"><button class="btn btn-primary" data-act="restore">Put back on the desk</button><button class="btn" data-act="opencollab">Open in Collaboration</button></div>
        ${d ? `<div class="ar-body">${d.intro ? `<div class="ar-intro">${esc(d.intro).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split(/\n{2,}/).map((x) => `<p>${x.replace(/\n/g, "<br>")}</p>`).join("")}</div>` : ""}
          ${d.sections.map((s) => `<h3>${esc(s.title || "")}</h3><ul>${s.items.map((x) => `<li>${esc(x.text || x.voter || "")}${x.result ? ` <b>(${esc(x.result)})</b>` : ""}${x.answer && x.kind === "choice" ? ` <b>→ ${esc(((x.options || []).find((o) => o.id === x.answer) || {}).label || x.answer)}</b>` : ""}${x.kind === "text" && x.answer ? `<div class="ar-ans">${esc(x.answer)}</div>` : ""}${x.note ? `<div class="ar-ans">${esc(x.note)}</div>` : ""}</li>`).join("")}</ul>`).join("")}</div>` : `<p class="stamp">Opening…</p>`}</div>`;
    }
    const body = !p ? `<p class="stamp">Opening…</p>` : p.error ? `<p class="stamp">${esc(p.error)}</p>`
      : p.type === "folder" ? `<p>${p.files.length} file${p.files.length === 1 ? "" : "s"} inside:</p><ul class="ar-files">${p.files.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`
      : p.type === "note" ? `<div class="ar-md">${window.CC && window.CC.md ? window.CC.md.render(p.text, new Set()) : `<pre>${esc(p.text)}</pre>`}</div>`
      : `<p class="stamp">Put it back to open it.</p>`;
    return `<div class="ar-doc"><div class="ar-head"><span class="ar-ref big ar-note">${it.kind === "folder" ? "▤" : "✎"}</span><h2>${esc(it.title)}</h2></div>
      <div class="stamp">${esc(it.vaultName)} · ${esc(it.path)} · archived ${esc(when(it.when))}</div>
      <div class="ar-acts"><button class="btn btn-primary" data-act="restore">Put back in ${esc(it.vaultName)}</button><button class="btn btn-quiet ar-del" data-act="delete">Delete for good</button></div>
      <div class="ar-body">${body}</div></div>`;
  }
  function render(host) {
    host.innerHTML = `<div class="ar-page">
        <aside class="ar-side">
          <input class="input ar-search" id="ar-search" type="search" placeholder="Search the archive" value="${esc(state.q)}" aria-label="Search the archive">
          <div class="ar-filters">${[["all", "All"], ["collab", "Collaboration"], ["notes", "Notes"]].map(([k, n]) => `<button class="ar-filter${state.filter === k ? " on" : ""}" data-filter="${k}">${n}</button>`).join("")}</div>
          <div class="ar-list" id="ar-list">${listHTML()}</div>
        </aside>
        <main class="ar-main" id="ar-main">${previewHTML()}</main></div>`;
    wire(host);
  }
  const redrawList = (host) => { host.querySelector("#ar-list").innerHTML = listHTML(); wireRows(host); };
  function wireRows(host) {
    host.querySelectorAll(".ar-row").forEach((b) => b.addEventListener("click", () => pick(host, b.dataset.key)));
  }
  async function pick(host, key) {
    state.sel = key; state.preview = null; render(host);
    const it = state.items.find((x) => keyOf(x) === key); if (!it) return;
    const p = it.src === "collab" ? await call("collab_get", [it.ref], "Opening " + it.ref) : await call("notes_archive_read", [it.vault, it.path], "Opening the note");
    if (state.sel !== key) return;
    state.preview = it.src === "collab" ? Object.assign({ref: it.ref}, p) : p;
    host.querySelector("#ar-main").innerHTML = previewHTML(); wireActs(host);
  }
  function wireActs(host) {
    const it = state.items.find((x) => keyOf(x) === state.sel); if (!it) return;
    host.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", async () => {
      const act = b.dataset.act;
      if (act === "opencollab") { SS.Collab.open(it.ref); SS.go("collab:board"); return; }
      if (act === "delete") {
        const ok = await SS.shared.confirm({title: `Delete “${it.title}” for good?`, body: it.kind === "folder" ? "The folder and everything in it are deleted. This can't be undone." : "This can't be undone.", yes: "Delete", danger: true});
        if (!ok) return;
        const r = await call("notes_archive_delete", [it.vault, it.path], "Deleting");
        if (r && r.error) { SS.shared.toast(r.error, "error"); return; }
        SS.shared.toast("Deleted.");
      } else if (it.src === "collab") {
        const d = await call("collab_get", [it.ref], "Opening " + it.ref);
        if (!d || d.error) { SS.shared.toast((d && d.error) || "Couldn't open it.", "error"); return; }
        d.archived = false;
        const r = await call("collab_save", [d], "Putting it back");
        if (r && r.error) { SS.shared.toast(r.error, "error"); return; }
        SS.shared.toast(`${it.ref} is back on the Collaboration desk.`);
      } else {
        const r = await call("notes_archive_restore", [it.vault, it.path], "Putting it back");
        if (r && r.error) { SS.shared.toast(r.error, "error"); return; }
        SS.shared.toast(`Back in ${it.vaultName}: ${r.path}`);
      }
      state.sel = ""; state.preview = null; await load(); render(host);
    }));
  }
  function wire(host) {
    wireRows(host); wireActs(host);
    const q = host.querySelector("#ar-search");
    q.addEventListener("input", () => { state.q = q.value.trim().toLowerCase(); redrawList(host); });
    host.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { state.filter = b.dataset.filter; render(host); }));
  }

  SS.Archive = {
    VIEWS: ["archive:list"],
    PREFIX: "archive:",
    async mount(host) {
      host.style.display = "";
      await load();
      if (state.sel && !state.items.some((x) => keyOf(x) === state.sel)) { state.sel = ""; state.preview = null; }
      render(host);
      if (state.sel) pick(host, state.sel);
    },
  };
})();
