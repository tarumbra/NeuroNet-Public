/* ==========================================================================
   Find — one box for the whole of NeuroNet (2026-10-06).
   ==========================================================================
   The audit (UI designer, Next tier): "give the bar a search or command box
   (jump to any recipe, note or session)". Cam approved the plan.

   Ctrl+K (when you aren't typing in a box -- in a note, Ctrl+K is still its
   link), or Find in the top bar. Type a few letters: pages, recipes, notes,
   Training's sessions, circuits and guides. ↑ ↓ to
   choose, Enter to open, Esc to close.

   Everything is read through what each section already offers (its store,
   or the backend call it uses itself), gathered once when Find opens and
   kept for a minute.
   ========================================================================== */
(() => {
  "use strict";
  const SS = window.SS;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const call = (fn, args) => (SS.Store && SS.Store.call ? SS.Store.call(fn, args || [], "") : Promise.resolve(null));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const KINDS = {
    page: "Page", recipe: "Recipe", note: "Note", sessions: "Session", circuits: "Circuit",
    guides: "Training guide",
  };

  /* ---- what can be found ---- */
  let index = null, indexAt = 0, building = null;
  async function build() {
    const out = [];
    try {
      (SS.pagesIndex ? SS.pagesIndex() : []).forEach((p) =>
        out.push({kind: "page", id: p.key, name: p.name, where: p.section}));
    } catch (e) { /* the sidebar isn't ready yet */ }
    const jobs = [
      call("kc_get_data").then((d) => ((d && d.recipes) || []).forEach((r) => r && r.id && out.push(
        {kind: "recipe", id: r.id, name: r.name || "Recipe", where: (r.tags || []).join(", ")}))),
      call("notes_list_tree").then((tree) => {
        const walk = (nodes, folder) => (nodes || []).forEach((n) => {
          if (n.type === "folder") walk(n.children, n.name);
          else if (n.type === "note") out.push({kind: "note", id: n.path, name: n.name, where: folder || "Scribe"});
        });
        walk(Array.isArray(tree) ? tree : (tree && tree.children) || [], "");
      }),
      (window.CF && CF.Store && CF.Store.load ? CF.Store.load() : call("training_load")).then((doc) => {
        for (const k of ["sessions", "circuits", "guides"]) {
          ((doc && doc[k]) || []).forEach((r) => r && r.id && out.push({kind: k, id: r.id, name: r.name || KINDS[k], where: "Training"}));
        }
      }),
      /* (Media, albums, playlists and songs went to NeuroStream, 19 Nov 2026) */
    ];
    await Promise.all(jobs.map((j) => j.catch(() => null)));
    return out;
  }
  async function ensureIndex() {
    if (index && Date.now() - indexAt < 60000) return index;
    if (!building) building = build().then((x) => { index = x; indexAt = Date.now(); building = null; return x; });
    return building;
  }

  /* ---- matching: the start of the name first, then the start of a word, then anywhere ---- */
  function rank(items, q) {
    const s = q.trim().toLowerCase();
    if (!s) return items.filter((x) => x.kind === "page").slice(0, 12);
    const words = s.split(/\s+/);
    const wordStart = new RegExp("\\b" + s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const scored = [];
    for (const it of items) {
      const name = String(it.name || "").toLowerCase();
      const hay = name + " " + String(it.where || "").toLowerCase();
      if (!words.every((w) => hay.includes(w))) continue;
      let score = name.startsWith(s) ? 0 : wordStart.test(name) ? 1 : name.includes(s) ? 2 : 3;
      if (it.kind === "page") score -= 0.5;              // a page name beats a note that mentions it
      scored.push([score, name.length, it]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return scored.slice(0, 40).map((x) => x[2]);
  }

  /* ---- opening one ---- */
  async function open(it) {
    close();
    if (it.kind === "page") return SS.go(it.id);
    if (it.kind === "recipe") return SS.openItem("recipe", {id: it.id});
    if (it.kind === "note") return SS.openItem("note", {path: it.id});
    if (KINDS[it.kind]) {                              // a Training record
      SS.go("training:" + it.kind);
      for (let i = 0; i < 60; i++) {
        if (window.CF && CF.Shell && CF.Shell.booted && CF.Shell.open && CF.Shell.open(it.kind, it.id)) return;
        await wait(100);
      }
    }
  }

  /* ---- the box ---- */
  let veil = null, results = [], sel = 0;
  function draw(list) {
    const ul = veil.querySelector(".nf-list");
    results = list;
    sel = Math.min(sel, Math.max(0, list.length - 1));
    ul.innerHTML = list.length ? list.map((it, i) => `
      <li class="nf-row ${i === sel ? "on" : ""}" data-i="${i}" role="option" aria-selected="${i === sel}">
        <span class="nf-kind">${esc(KINDS[it.kind] || it.kind)}</span>
        <span class="nf-name">${esc(it.name)}</span>
        <span class="nf-where">${esc(it.where || "")}</span>
      </li>`).join("")
      : `<li class="nf-empty">${index ? "Nothing matches." : "Gathering…"}</li>`;
    const on = ul.querySelector(".nf-row.on");
    if (on && on.scrollIntoView) on.scrollIntoView({block: "nearest"});
  }
  async function refresh() {
    const q = veil.querySelector(".nf-q").value;
    draw(rank(index || [], q));
    const all = await ensureIndex();
    if (veil && veil.querySelector(".nf-q").value === q) draw(rank(all, q));
  }
  function openFind() {
    if (veil) { veil.querySelector(".nf-q").focus(); return; }
    veil = document.createElement("div");
    veil.className = "nf-veil";
    veil.innerHTML = `<div class="nf-box" role="dialog" aria-label="Find">
        <input class="nf-q input" type="search" placeholder="Find a page, recipe, note, session…"
               aria-label="Find" autocomplete="off" spellcheck="false">
        <ul class="nf-list" role="listbox"></ul>
        <p class="nf-hint">↑ ↓ to choose · Enter to open · Esc to close · Ctrl+K from anywhere</p>
      </div>`;
    document.body.appendChild(veil);
    const q = veil.querySelector(".nf-q");
    sel = 0;
    q.addEventListener("input", () => { sel = 0; refresh(); });
    q.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); draw(results); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(results); }
      else if (e.key === "Enter") { e.preventDefault(); if (results[sel]) open(results[sel]); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    veil.addEventListener("mousedown", (e) => { if (e.target === veil) close(); });
    veil.querySelector(".nf-list").addEventListener("click", (e) => {
      const row = e.target.closest(".nf-row");
      if (row && results[+row.dataset.i]) open(results[+row.dataset.i]);
    });
    q.focus();
    refresh();
  }
  function close() {
    if (veil) { veil.remove(); veil = null; }
  }

  /* Ctrl+K, except while typing in a box (a note's own Ctrl+K makes a link) */
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || String(e.key).toLowerCase() !== "k") return;
    const t = e.target;
    if (!veil && t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    if (veil) close(); else openFind();
  });

  function wireButton() {
    const b = document.getElementById("ss-find");
    if (b && !b.dataset.wired) { b.dataset.wired = "1"; b.addEventListener("click", openFind); }
  }
  wireButton();
  document.addEventListener("DOMContentLoaded", wireButton);

  SS.Find = {open: openFind, close, _test: {rank, build, ensureIndex, forget: () => { index = null; }, get results() { return results; }}};
})();
