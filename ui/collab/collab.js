/* ==========================================================================
   Collaboration — Cam and Claude's shared desk (Scribe, 2026-10-15).

   Cam: "lets use neuronet to discuss play tests, questions and more. The
   prompts can be the main workspace where we direct work directly on the
   project. Further context will go through neuronet ... I can just say refer
   to "X", "Y" or "Z" in the app. Create a template that works best for you
   that i can fill out like a form."

   Each document is a form with a short code (PT1, Q2, B3 ...) to refer to in
   a prompt. Claude writes the play tests and questions; Cam fills them in --
   ✓ / ✗ / not tried and a note for each check, a choice and a comment for each
   question, words for each prompt -- and presses "Done — over to Claude".
   Cam starts his own Bugs, Ideas, Notes and Play-test notes from + New.
   Everything saves as you type. The rules and the files are collab.py
   (<data>/collab/<code>.json).
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const store = {
    list: () => SS.Store.call("collab_list", [], "The collaboration desk"),
    get: (ref) => SS.Store.call("collab_get", [ref], "Opening " + ref),
    add: (typ, project) => SS.Store.call("collab_new", [typ, "", project || ""], "Starting a document"),
    projects: () => SS.Store.call("collab_projects", [], "The projects"),
    newProject: (name) => SS.Store.call("collab_project_new", [name], "Starting a project"),
    renameProject: (old, name) => SS.Store.call("collab_project_rename", [old, name], "Renaming the project"),
    useProject: (name) => SS.Store.call("collab_project_use", [name], "Opening the project"),
    save: (doc) => SS.Store.call("collab_save", [doc], "Saving"),
    addPic: (ref, item, url) => SS.Store.call("collab_picture_add", [ref, item, url], "Keeping the picture"),
    pic: (name) => SS.Store.call("collab_picture", [name], "A picture"),
    removePic: (name) => SS.Store.call("collab_picture_remove", [name], "Taking the picture off"),
    remove: (ref) => SS.Store.call("collab_delete", [ref], "Deleting " + ref),
    seen: (refs) => SS.Store.call("collab_seen", [refs], "Marking it seen"),
  };
  /** I20 (8 Nov 2026): Cam has seen these -- their dots go, and the app's count with them. */
  async function seeIt(host, refs) {
    refs = refs.filter((r) => (state.list.find((x) => x.ref === r) || {}).new);
    if (!refs.length) return;
    const f = await store.seen(refs);
    state.list.forEach((x) => { if (refs.includes(x.ref)) x.new = false; });
    const pj = await store.projects();
    if (pj && Array.isArray(pj.projects)) state.projects = pj.projects;
    if (f && !f.error && SS.collabFresh) SS.collabFresh(f);
    if (host && host.isConnected) render(host);
  }
  const KIND = {playtest: "Play test", questions: "Questions", bug: "Bug", idea: "Idea", note: "Note", vote: "Vote", concern: "Concern"};
  const VOTE = {yes: "Yes", no: "No", abstain: "Abstain"};
  /** A vote's count, as collab.py's tally(): a majority of the votes cast decides (a tie is no); Cam's override decides over it. */
  function tally(d) {
    const items = d.sections.reduce((a, s) => a.concat(s.items), []), t = {yes: 0, no: 0, abstain: 0, waiting: 0};
    items.forEach((it) => { if (it.kind === "ballot") t[it.vote]++; else if (it.kind === "choice" && it.id === "cam") { if (VOTE[it.answer]) t[it.answer]++; else t.waiting++; } });
    t.result = t.yes + t.no && !t.waiting ? (t.yes > t.no ? "yes" : "no") : "";
    const ov = items.find((it) => it.kind === "choice" && it.id === "override");
    t.overridden = !!(ov && (ov.answer === "yes" || ov.answer === "no")); if (t.overridden) t.result = ov.answer;
    return t;
  }
  function tallyHTML(d) {
    const t = tally(d);
    return `<div class="cb-tally${t.result ? " cb-t-" + t.result : ""}">
            <b>${t.result ? (t.result === "yes" ? "Carried" : "Not carried") + (t.overridden ? " (your override)" : "") : "Counting"}</b>
            <span>Yes ${t.yes} · No ${t.no} · Abstain ${t.abstain}${t.waiting ? " · waiting for your vote" : ""}</span>
            <small>A majority of the votes cast decides (a tie is no); your override, if you give one, decides over the count.</small></div>`;
  }
  const fromWho = (d) => d.by ? "from the " + d.by : d.from === "claude" ? "from Claude" : "yours";
  const STATUS = {open: "Waiting for you", answered: "Over to Claude", closed: "Done"};
  const STATUS_CAM = {open: "Open", answered: "Over to Claude", closed: "Done"};
  const state = {sel: "", filter: "active", doc: null, list: [], projects: [], project: ""};
  // projects (Cam, 2026-10-17: "the ability in collaboration to be broken into projects (think vaults in the notes app)")
  const GENERAL = "General";
  const projOf = (d) => d.project || GENERAL;
  const inProject = (d) => !state.project || projOf(d) === state.project;
  let saveTimer = 0, saving = Promise.resolve();

  /** Paragraphs and bold (**x**): enough for Claude's intros, nothing that runs. A run of lines starting "> " is a
      prompt to paste somewhere else (an image tool's): a box with a Copy button (2026-10-20, Cam: "make the prompts able
      to be copied atm i have to screen shot them"). */
  function para(text) {
    return esc(text).split(/\n{2,}/).map((p) => {
      if (/^&gt; /.test(p)) {
        const body = p.split("\n").map((l) => l.replace(/^&gt; ?/, "")).join("\n");
        return `<div class="cb-prompt"><button class="btn btn-sm cb-copy" data-copy title="Copy the prompt">Copy</button><pre>${body.replace(/\*\*(.+?)\*\*/g, "$1")}</pre></div>`;
      }
      const inline = (t) => t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s.,;:)]|$)/g, "$1<i>$2</i>").replace(/\n/g, "<br>");
      let head = "";
      if (/^#{1,3} /.test(p)) { const nl = p.indexOf("\n"); head = `<h4 class="cb-h">${(nl < 0 ? p : p.slice(0, nl)).replace(/^#+ /, "").replace(/\*\*(.+?)\*\*/g, "$1")}</h4>`; p = nl < 0 ? "" : p.slice(nl + 1); }
      return head + (p ? `<p>${inline(p)}</p>` : "");
    }).join("");
  }
  /** Copy a prompt box's words: the clipboard if this window may use it, else select them for Ctrl+C. */
  async function copyPrompt(btn) {
    const pre = btn.parentElement.querySelector("pre"), text = pre.textContent;
    let done = false;
    try { await navigator.clipboard.writeText(text); done = true; } catch (e) { /* fall back below */ }
    if (!done) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(ta); ta.select();
      try { done = document.execCommand("copy"); } catch (e) { done = false; }
      ta.remove();
    }
    if (done) { btn.textContent = "Copied"; setTimeout(() => { btn.textContent = "Copy"; }, 1500); }
    else { const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); SS.shared.toast("Selected -- press Ctrl+C to copy.", "warn"); }
  }
  const when = (iso) => { try { return new Date(iso).toLocaleString([], {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}); } catch (e) { return iso; } };
  const mine = (d) => d.from === "claude" ? STATUS[d.status] : STATUS_CAM[d.status];

  function listHTML() {
    const shown = state.list.filter((d) => !d.archived).filter(inProject).filter((d) => state.filter === "all" || (state.filter === "active" ? d.status !== "closed" : d.status === state.filter));
    return shown.length ? shown.map((d) => `<button class="cb-row${d.ref === state.sel ? " on" : ""} cb-${d.status}" data-ref="${esc(d.ref)}">
        <span class="cb-ref">${esc(d.ref)}</span>
        <span class="cb-row-main"><b>${d.new ? `<i class="cb-newdot" title="New since you last looked"></i>` : ""}${esc(d.title)}</b>
          <small>${state.project ? "" : `<span class="cb-proj-tag">${esc(projOf(d))}</span> `}${esc(KIND[d.type] || d.type)} · ${esc(fromWho(d))} · ${esc(mine(d))}${d.tally && d.tally.result ? ` · <b>${d.tally.result === "yes" ? "carried" : "not carried"}</b>` : ""}${d.items ? ` · ${d.done}/${d.items}` : ""}${d.fails ? ` · <span class="cb-bad">${d.fails} ✗</span>` : ""}</small></span>
      </button>`).join("") : `<p class="stamp cb-empty">Nothing here${state.filter === "active" ? " waiting" : ""}.</p>`;
  }
  // pictures on an item (2026-10-21, Cam PT49): paste one into its notes, or pick one with the clip; click to see it big
  const picCache = {};
  const picsHTML = (it) => `<div class="cb-pics" data-pics="${esc(it.id)}">${(it.pics || []).map((n) =>
      `<span class="cb-pic"><img alt="" data-pic="${esc(n)}" src="${picCache[n] || ""}" title="${esc(n)} -- click to see it big"><button class="cb-pic-x" data-unpic="${esc(n)}" data-item="${esc(it.id)}" title="Take this picture off">×</button></span>`).join("")}
      <label class="cb-clip" title="Add a picture saved on your computer (or paste one into the notes)">📎<input type="file" accept="image/png,image/jpeg,image/webp" data-clip="${esc(it.id)}" hidden></label>
      <label class="cb-snipbox" title="There's a snip for this in NeuroNet Picture References/NeuroNet Snips"><input type="checkbox" data-snip="${esc(it.id)}"${it.snip ? " checked" : ""}> Snip</label></div>`;
  /* Cam (15 Nov 2026): "Have a check box added to collaboration questions that
     says snip (if checked you will check in the new snip folder for the snip
     for that question)": saved on the item as snip: true, for Claude to read */
  function itemHTML(it) {
    const id = esc(it.id);
    if (it.kind === "check") {
      const b = (v, label, cls) => `<button class="cb-res ${cls}${it.result === v ? " on" : ""}" data-item="${id}" data-result="${v}" title="${label}">${label}</button>`;
      return `<div class="cb-item cb-check${it.result ? " cb-r-" + it.result : ""}" data-id="${id}">
          <div class="cb-q"><span class="cb-id">${id}</span><div>${para(it.text)}${it.expect ? `<div class="cb-expect">Should: ${para(it.expect)}</div>` : ""}</div></div>
          <div class="cb-res-row">${b("pass", "✓ Works", "pass")}${b("fail", "✗ Problem", "fail")}${b("skip", "– Didn't try", "skip")}${b("unsure", "? Not sure", "unsure")}</div>
          <textarea class="input cb-note" data-item="${id}" data-field="note" rows="${it.note ? 3 : 1}" placeholder="Notes (what happened, what you'd change) -- paste a picture here">${esc(it.note)}</textarea>
          ${picsHTML(it)}</div>`;
    }
    if (it.kind === "ballot") {                                  // a stakeholder's vote and their reason: theirs, read only
      return `<div class="cb-item cb-ballot cb-v-${esc(it.vote)}" data-id="${id}">
          <div class="cb-q"><span class="cb-vote">${esc(VOTE[it.vote])}</span><div><b>${esc(it.voter)}</b>${para(it.text)}</div></div></div>`;
    }
    if (it.kind === "choice") {
      return `<div class="cb-item cb-choice${it.answer ? " cb-answered" : ""}" data-id="${id}">
          <div class="cb-q"><span class="cb-id">${id}</span><div>${para(it.text)}</div></div>
          <div class="cb-opts">${it.options.map((o) => `<label class="cb-opt${it.answer === o.id ? " on" : ""}">
              <input type="radio" name="cb-${id}" data-item="${id}" data-answer="${esc(o.id)}" ${it.answer === o.id ? "checked" : ""}>
              <span>${esc(o.label)}${o.rec ? ` <em class="cb-rec">recommended</em>` : ""}</span></label>`).join("")}</div>
          <textarea class="input cb-note" data-item="${id}" data-field="note" rows="${it.note ? 3 : 1}" placeholder="Anything to add (or your own answer) -- paste a picture here">${esc(it.note)}</textarea>
          ${picsHTML(it)}</div>`;
    }
    return `<div class="cb-item cb-text" data-id="${id}">
        ${it.text ? `<div class="cb-q"><span class="cb-id">${id}</span><div>${para(it.text)}</div></div>` : ""}
        <textarea class="input cb-answer" data-item="${id}" data-field="answer" rows="${Math.max(3, Math.min(14, (it.answer.match(/\n/g) || []).length + 2))}" placeholder="(paste a picture here too)">${esc(it.answer)}</textarea>
        ${picsHTML(it)}</div>`;
  }
  function docHTML(d) {
    if (!d) return `<div class="cb-blank"><h2 class="page-h">Collaboration</h2>
        <p>Cam and Claude's shared desk. Claude leaves <b>play tests</b> (things to try, each with ✓ / ✗ and a note) and <b>questions</b>
        (choices with a recommendation) here; you fill them in and press <b>Done — over to Claude</b>.</p>
        <p>Start your own with <b>+ New</b>: a <b>Bug</b>, an <b>Idea</b>, <b>Play-test notes</b> or a <b>Note</b>. Every document has a code
        (PT1, Q2, B3 ...): in a prompt, just say <b>"refer to PT1"</b>.</p><p class="stamp">Everything saves as you type.</p></div>`;
    const answered = d.status !== "open";
    return `<div class="cb-doc">
        <div class="cb-doc-head">
          <span class="cb-ref big">${esc(d.ref)}</span>
          <input class="input cb-title" id="cb-title" value="${esc(d.title)}" aria-label="Title">
        </div>
        <div class="cb-meta stamp">${esc(KIND[d.type])} · ${esc(fromWho(d))} ·
          <label class="cb-move">Project <select class="input cb-proj-move" id="cb-proj-move" aria-label="Move to another project">${state.projects.map((p) =>
            `<option value="${esc(p.name)}" ${p.name === projOf(d) ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label> · started ${esc(when(d.created))} · saved ${esc(when(d.updated))}</div>
        ${d.archived ? `<div class="cb-archived"><b>In the Archive</b> -- it's off the desk's lists. <button class="btn btn-sm" data-archive="0">Put it back on the desk</button></div>` : ""}
        ${d.intro ? `<div class="cb-intro">${para(d.intro)}</div>` : ""}
        ${d.type === "vote" ? tallyHTML(d) : ""}
        ${d.sections.map((s) => `<section class="cb-sec">${s.title ? `<h3>${esc(s.title)}</h3>` : ""}${s.items.map(itemHTML).join("")}</section>`).join("")}
        <div class="cb-foot">
          ${d.status === "closed" ? `<span class="stamp">Claude has dealt with this.</span><button class="btn btn-quiet" data-status="open">Reopen</button>`
            : answered ? `<span class="stamp">Over to Claude — say "refer to ${esc(d.ref)}" in a prompt.</span><button class="btn btn-quiet" data-status="open">Not finished after all</button>`
            : `<button class="btn btn-primary" data-status="answered">Done — over to Claude</button>`}
          ${d.archived ? "" : `<button class="btn btn-quiet" data-archive="1" title="Off the desk and into Scribe > Archive (it can come back)">Archive</button>`}
          ${d.from === "cam" ? `<button class="btn btn-quiet cb-del" id="cb-del">Delete</button>` : ""}
          <span class="cb-saved stamp" id="cb-saved"></span>
        </div>
      </div>`;
  }
  function render(host) {
    host.innerHTML = `
      <div class="cb-page">
        <aside class="cb-side">
          <div class="cb-projects" role="tablist" aria-label="Projects">
            <div class="cb-proj-row"><select class="input cb-proj" id="cb-proj" aria-label="Project">
              <option value="" ${state.project ? "" : "selected"}>Every project</option>
              ${state.projects.map((p) => `<option value="${esc(p.name)}" ${p.name === state.project ? "selected" : ""}>${esc(p.name)}${p.waiting ? ` (${p.waiting} waiting)` : ""}${p.fresh ? ` · ${p.fresh} new` : ""}</option>`).join("")}</select>
              <button class="btn btn-sm btn-quiet" id="cb-proj-new" title="Start a project">+ Project</button>
              ${state.project && state.project !== GENERAL ? `<button class="btn btn-sm btn-quiet" id="cb-proj-ren" title="Rename this project">Rename</button>` : ""}</div>
          </div>
          <div class="cb-new">
            <button class="btn btn-sm" data-new="bug">+ Bug</button><button class="btn btn-sm" data-new="idea">+ Idea</button>
            <button class="btn btn-sm" data-new="playtest">+ Play-test notes</button><button class="btn btn-sm" data-new="note">+ Note</button>
            <button class="btn btn-sm" data-new="questions">+ Question</button>
            <button class="btn btn-sm" data-new="vote">+ Vote</button><button class="btn btn-sm" data-new="concern">+ Concern</button>
          </div>
          ${state.list.some((d) => d.new && !d.archived && inProject(d)) ? `<button class="btn btn-sm btn-quiet cb-allseen" id="cb-allseen" title="Clear the new dots${state.project ? " in this project" : ""}">Mark all seen (${state.list.filter((d) => d.new && !d.archived && inProject(d)).length})</button>` : ""}
          <div class="cb-filters">${[["active", "Waiting"], ["answered", "Over to Claude"], ["closed", "Done"], ["all", "All"]].map(([k, n]) =>
            `<button class="cb-filter${state.filter === k ? " on" : ""}" data-filter="${k}">${n}</button>`).join("")}</div>
          <div class="cb-list" id="cb-list">${listHTML()}</div>
        </aside>
        <main class="cb-main" id="cb-main">${docHTML(state.doc)}</main>
      </div>`;
    wire(host);
  }
  function itemOf(id) { for (const s of state.doc.sections) for (const it of s.items) if (it.id === id) return it; return null; }
  function queueSave(host, now) {
    clearTimeout(saveTimer);
    const go = () => { saving = saving.then(async () => {
      const d = state.doc; if (!d) return;
      const r = await store.save(d);
      const el = host.querySelector("#cb-saved");
      if (r && r.error) { SS.shared.toast(r.error, "error"); if (el) el.textContent = "Not saved"; return; }
      if (state.doc && r && r.ref === state.doc.ref) state.doc.updated = r.updated;
      if (el) el.textContent = "Saved";
      const i = state.list.findIndex((x) => x.ref === d.ref);
      const items = d.sections.reduce((a, s) => a.concat(s.items), []);
      const sum = {ref: d.ref, type: d.type, title: d.title, project: d.project, from: d.from, status: d.status, updated: (r && r.updated) || d.updated,
        items: items.length, done: items.filter((it) => (it.kind === "check" && it.result) || (it.kind === "choice" && it.answer) || (it.kind === "text" && it.answer.trim()) || it.kind === "ballot").length,
        by: d.by || "", tally: d.type === "vote" ? tally(d) : null, archived: !!d.archived,
        fails: items.filter((it) => it.kind === "check" && it.result === "fail").length};
      if (i >= 0) state.list[i] = sum;
      const lst = host.querySelector("#cb-list"); if (lst) { lst.innerHTML = listHTML(); wireList(host); }
    }); };
    if (now) go(); else saveTimer = setTimeout(go, 600);
  }
  async function open(host, ref) {
    await saving;
    const d = await store.get(ref);
    if (!d || d.error) { SS.shared.toast((d && d.error) || "Couldn't open it.", "error"); return; }
    state.sel = ref; state.doc = d;
    render(host);
    seeIt(host, [ref]);
  }
  function wireList(host) {
    host.querySelectorAll(".cb-row").forEach((b) => b.addEventListener("click", () => open(host, b.dataset.ref)));
  }
  function wire(host) {
    wireList(host);
    const allSeen = host.querySelector("#cb-allseen");
    if (allSeen) allSeen.addEventListener("click", () => seeIt(host, state.list.filter((d) => d.new && !d.archived && inProject(d)).map((d) => d.ref)));
    host.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", () => { state.filter = b.dataset.filter; render(host); }));
    host.querySelectorAll("[data-new]").forEach((b) => b.addEventListener("click", async () => {
      const r = await store.add(b.dataset.new, state.project && state.project !== GENERAL ? state.project : "");   // into the project you're in
      if (!r || r.error) { SS.shared.toast((r && r.error) || "Couldn't start it.", "error"); return; }
      state.list = (await store.list()) || []; state.filter = "active";
      await open(host, r.ref);
      const t = host.querySelector("#cb-title"); if (t) { t.focus(); t.select(); }
    }));
    const setProjects = (r) => { if (r && Array.isArray(r.projects)) { state.projects = r.projects; state.project = r.active || ""; } return r; };
    const ps = host.querySelector("#cb-proj");
    if (ps) ps.addEventListener("change", async () => {
      setProjects(await store.useProject(ps.value));
      state.project = ps.value;
      if (state.doc && !inProject(state.doc)) { state.doc = null; state.sel = ""; }
      render(host);
    });
    const pn = host.querySelector("#cb-proj-new");
    if (pn) pn.addEventListener("click", async () => {
      const name = await SS.shared.promptText("A new project (like a vault in Notes)", "Its name", "");
      if (!name) return;
      const r = await store.newProject(name);
      if (r && r.error) { SS.shared.toast(r.error, "error"); return; }
      setProjects(r); state.doc = null; state.sel = ""; render(host);
    });
    const pr = host.querySelector("#cb-proj-ren");
    if (pr) pr.addEventListener("click", async () => {
      const name = await SS.shared.promptText(`Rename “${state.project}” (its documents move with it)`, "Its name", state.project);
      if (!name || name === state.project) return;
      const r = await store.renameProject(state.project, name);
      if (r && r.error) { SS.shared.toast(r.error, "error"); return; }
      setProjects(r); state.list = (await store.list()) || []; if (state.doc) state.doc = await store.get(state.doc.ref); render(host);
    });
    const d = state.doc;
    if (!d) return;
    const mv = host.querySelector("#cb-proj-move");
    if (mv) mv.addEventListener("change", async () => {
      d.project = mv.value === GENERAL ? "" : mv.value; queueSave(host, true); await saving;
      setProjects(await store.projects());
      SS.shared.toast(`${d.ref} is in ${projOf(d)} now.`);
      render(host);
    });
    host.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => copyPrompt(b)));
    const title = host.querySelector("#cb-title");
    title.addEventListener("input", () => { d.title = title.value; queueSave(host); });
    host.querySelectorAll("[data-result]").forEach((b) => b.addEventListener("click", () => {
      const it = itemOf(b.dataset.item); it.result = it.result === b.dataset.result ? null : b.dataset.result;
      const box = b.closest(".cb-item");
      box.className = "cb-item cb-check" + (it.result ? " cb-r-" + it.result : "");
      box.querySelectorAll("[data-result]").forEach((x) => x.classList.toggle("on", x.dataset.result === it.result));
      if (it.result === "fail" || it.result === "unsure") { const n = box.querySelector(".cb-note"); n.rows = 3; n.focus(); }
      queueSave(host);
    }));
    host.querySelectorAll("[data-answer]").forEach((r) => r.addEventListener("change", () => {
      const it = itemOf(r.dataset.item); it.answer = r.dataset.answer;
      r.closest(".cb-item").classList.add("cb-answered");
      r.closest(".cb-opts").querySelectorAll(".cb-opt").forEach((l) => l.classList.toggle("on", l.contains(r)));
      const tb = host.querySelector(".cb-tally"); if (tb && d.type === "vote") tb.outerHTML = tallyHTML(d);   // the count, at once
      queueSave(host);
    }));
    // pictures: pasted into an item's notes, or picked with its clip -> kept by NeuroNet, listed on the item
    const addPics = async (itemId, files) => {
      const it = itemOf(itemId);
      for (const f of files) {
        if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { SS.shared.toast("Pictures can be PNG, JPEG or WebP.", "error"); continue; }
        const url = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(""); r.readAsDataURL(f); });
        const res = url && await store.addPic(d.ref, itemId, url);
        if (!res || res.error) { SS.shared.toast((res && res.error) || "Couldn't keep that picture.", "error"); continue; }
        picCache[res.name] = url;
        it.pics = (it.pics || []).concat([res.name]);
      }
      queueSave(host, true);
      const row = host.querySelector(`[data-pics="${CSS.escape(itemId)}"]`);
      if (row) { row.outerHTML = picsHTML(it); wirePics(host); }
    };
    function wirePics(root) {
      root.querySelectorAll("[data-snip]").forEach((cb) => { if (cb.dataset.wired) return; cb.dataset.wired = "1";
        cb.addEventListener("change", () => { const it = itemOf(cb.dataset.snip); it.snip = cb.checked; queueSave(host); }); });
      root.querySelectorAll("[data-clip]").forEach((inp) => { if (inp.dataset.wired) return; inp.dataset.wired = "1";
        inp.addEventListener("change", () => { addPics(inp.dataset.clip, [...inp.files]); inp.value = ""; }); });
      root.querySelectorAll("img[data-pic]").forEach(async (im) => {
        if (im.dataset.wired) return; im.dataset.wired = "1";
        if (!im.getAttribute("src")) { const r = await store.pic(im.dataset.pic); if (r && r.url) { picCache[im.dataset.pic] = r.url; im.src = r.url; } }
        im.addEventListener("click", () => {
          const v = document.createElement("div"); v.className = "cb-picview"; v.innerHTML = `<img alt="" src="${im.src}"><span>${esc(im.dataset.pic)} · click to close</span>`;
          v.addEventListener("click", () => v.remove()); document.body.appendChild(v);
        });
      });
      root.querySelectorAll("[data-unpic]").forEach((b) => { if (b.dataset.wired) return; b.dataset.wired = "1";
        b.addEventListener("click", async () => {
          const it = itemOf(b.dataset.item); it.pics = (it.pics || []).filter((n) => n !== b.dataset.unpic);
          await store.removePic(b.dataset.unpic);
          queueSave(host, true);
          b.closest(".cb-pic").remove();
        }); });
    }
    wirePics(host);
    host.querySelectorAll("textarea[data-field]").forEach((t) => {
      t.addEventListener("paste", (e) => {
        const files = [...((e.clipboardData && e.clipboardData.items) || [])].filter((x) => x.kind === "file" && /^image\//.test(x.type)).map((x) => x.getAsFile()).filter(Boolean);
        if (files.length) { e.preventDefault(); addPics(t.dataset.item, files); }
      });
      t.addEventListener("input", () => { itemOf(t.dataset.item)[t.dataset.field] = t.value; queueSave(host); });
      t.addEventListener("focus", () => { if (t.rows < 3) t.rows = 3; });
    });
    host.querySelectorAll("[data-status]").forEach((b) => b.addEventListener("click", async () => {
      d.status = b.dataset.status; queueSave(host, true); await saving;
      if (d.status === "answered") SS.shared.toast(`${d.ref} is over to Claude — say "refer to ${d.ref}" in a prompt.`);
      render(host);
    }));
    // the archive (2026-11-02): off the desk's lists and into Scribe > Archive, or back again
    host.querySelectorAll("[data-archive]").forEach((b) => b.addEventListener("click", async () => {
      d.archived = b.dataset.archive === "1"; queueSave(host, true); await saving;
      SS.shared.toast(d.archived ? `${d.ref} is in Scribe > Archive now.` : `${d.ref} is back on the desk.`);
      if (d.archived) { state.doc = null; state.sel = ""; }
      setProjects(await store.projects()); render(host);
    }));
    const del = host.querySelector("#cb-del");
    if (del) del.addEventListener("click", async () => {
      const ok = await SS.shared.confirm({title: `Delete ${d.ref}?`, body: `“${d.title}” goes to the deleted folder (collab/deleted), not gone for good.`, yes: "Delete"});
      if (!ok) return;
      const r = await store.remove(d.ref);
      if (r && r.error) { SS.shared.toast(r.error, "error"); return; }
      state.doc = null; state.sel = ""; state.list = (await store.list()) || []; render(host);
    });
  }

  SS.Collab = {
    VIEWS: ["collab:board"],
    PREFIX: "collab:",
    async mount(host) {
      host.style.display = "";
      const l = await store.list();
      state.list = Array.isArray(l) ? l : [];
      const pj = await store.projects();
      if (pj && Array.isArray(pj.projects)) { state.projects = pj.projects; state.project = pj.active || ""; }   // (no projects to be had: every document, as before)
      if (state.sel && !state.list.some((x) => x.ref === state.sel)) { state.sel = ""; state.doc = null; }
      if (state.sel) { const d = await store.get(state.sel); state.doc = d && !d.error ? d : null; }
      render(host);
      if (state.doc) seeIt(host, [state.doc.ref]);             // (opened from the pop-up, or the one left open)
    },
    /** Open one by its code (for a link elsewhere in the app). */
    open: (ref) => { state.sel = ref; },
  };
})();
