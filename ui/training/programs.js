/* ==========================================================================
   CF.Programs — building programs and their mesocycles.

   The record shape is dictated by the exporter in documents.py, which is the
   original app's own code:

     program    {id, name, durationMonths, overview, mesocycles, created}
     overview   {sessionBreakdown, objective, outcome, experienceLevel,
                 usageGuidelines, coachingNotes}
     mesocycle  {name, weeks, sessionGroups}
     week       {weekNum, rpe, rir, loadPercent}
     group      {name, sessions}
     session    {name, items}   — an embedded copy, not a reference

   Sessions inside a program are copies. That is what the exporter reads, and
   it is also right: editing a saved session months later should not silently
   rewrite a program already handed out.

   The one simplification: each mesocycle is written with a single session
   group. The exporter loops groups then sessions, so one group produces
   identical output, and program > mesocycle > group > session is a level of
   nesting too deep to navigate on a phone.
   ========================================================================== */
CF.Programs = (() => {
  "use strict";

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const icon = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24"><use href="#i-${n}"/></svg>`;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const OVERVIEW_FIELDS = [
    ["sessionBreakdown", "Session breakdown"],
    ["objective", "Objective"],
    ["outcome", "Intended outcome"],
    ["experienceLevel", "Experience level"],
    ["usageGuidelines", "Usage guidelines"],
    ["coachingNotes", "Coaching notes"],
  ];

  let host = null;
  const isOpen = () => !!host;
  function close() { if (host) { host.remove(); host = null; } }
  const q = (sel) => host.querySelector(sel);

  /** Sessions live under one group per mesocycle; this is the accessor. */
  function sessionsOf(meso) {
    if (!Array.isArray(meso.sessionGroups) || !meso.sessionGroups.length) {
      meso.sessionGroups = [{ name: "", sessions: [] }];
    }
    // Older records, or ones made in the original app, may carry several
    // groups. Flatten on read so nothing is hidden from view.
    if (meso.sessionGroups.length > 1) {
      meso.sessionGroups = [{
        name: "",
        sessions: meso.sessionGroups.flatMap((g) => g.sessions || []),
      }];
    }
    if (!Array.isArray(meso.sessionGroups[0].sessions)) meso.sessionGroups[0].sessions = [];
    return meso.sessionGroups[0].sessions;
  }

  function edit(existing, done) {
    close();
    const isNew = !existing;
    const model = existing ? clone(existing) : {
      id: makeId(), name: "", durationMonths: "",
      overview: {}, mesocycles: [], created: new Date().toISOString(),
    };
    model.overview = model.overview || {};
    if (!Array.isArray(model.mesocycles)) model.mesocycles = [];

    // Which mesocycle blocks are expanded; collapsed by default so a long
    // program is navigable rather than one enormous scroll.
    const openBlocks = new Set(model.mesocycles.length ? [0] : []);

    host = document.createElement("div");
    host.className = "editor-pane";
    host.innerHTML = `
      <header class="topbar">
        <button class="icon-btn" data-cancel aria-label="Cancel">${icon("close")}</button>
        <div class="topbar-title">
          <span class="crumb">${esc(isNew ? "" : existing.name)}</span>
          <span class="page-title">${isNew ? "New program" : "Edit program"}</span>
        </div>
        <button class="topbar-save" data-save>Save</button>
      </header>
      <div class="editor-body">
        <div class="field">
          <label for="pName">Program name</label>
          <input id="pName" value="${esc(model.name)}" placeholder="Name it" autocomplete="off">
        </div>
        <div class="field">
          <label for="pMonths">Duration in months</label>
          <input id="pMonths" value="${esc(model.durationMonths || "")}"
            inputmode="numeric" placeholder="optional">
        </div>

        <p class="section-h">Overview</p>
        ${OVERVIEW_FIELDS.map(([key, label]) => `
          <div class="field">
            <label for="ov-${key}">${esc(label)}</label>
            <textarea id="ov-${key}" class="q-text-input" rows="2"
              placeholder="optional">${esc(model.overview[key] || "")}</textarea>
          </div>`).join("")}

        <p class="section-h">Mesocycles</p>
        <div class="rows" id="pMesos"></div>
        <button class="secondary-btn add-btn" id="pMesoAdd">${icon("plus")}Add a mesocycle</button>
        <p class="editor-hint">A mesocycle is a training block. Its weeks carry the
          intensity progression — RPE, RIR, load percentage — and its sessions are
          copies, so editing a saved session later will not rewrite a program you
          have already handed out.</p>
      </div>`;
    CF.uiRoot().appendChild(host);      /* not document.body — see bridge.js */

    /* -- mesocycles -- */
    function draw() {
      const host2 = q("#pMesos");
      if (!model.mesocycles.length) {
        host2.innerHTML = `<p class="empty-note">No blocks yet.</p>`;
        return;
      }
      host2.innerHTML = model.mesocycles.map((meso, i) => {
        const sessions = sessionsOf(meso);
        const weeks = meso.weeks || [];
        const isOpenBlock = openBlocks.has(i);
        return `
          <div class="row-card meso ${isOpenBlock ? "is-open" : ""}">
            <div class="row-head">
              <button class="meso-toggle" data-toggle="${i}" aria-expanded="${isOpenBlock}">
                ${icon("chevron", "ic twist")}
              </button>
              <input class="meso-name" data-meso="${i}" value="${esc(meso.name || "")}"
                placeholder="Block name" aria-label="Mesocycle name" autocomplete="off">
              <div class="row-tools">
                <button class="tool-btn" data-mup="${i}" ${i === 0 ? "disabled" : ""}
                  aria-label="Move up">${icon("up")}</button>
                <button class="tool-btn" data-mdown="${i}"
                  ${i === model.mesocycles.length - 1 ? "disabled" : ""}
                  aria-label="Move down">${icon("down")}</button>
                <button class="tool-btn is-danger" data-mdrop="${i}"
                  aria-label="Remove block">${icon("trash")}</button>
              </div>
            </div>
            <p class="meso-summary">${weeks.length} week${weeks.length === 1 ? "" : "s"}
              &middot; ${sessions.length} session${sessions.length === 1 ? "" : "s"}</p>

            ${isOpenBlock ? `
              <div class="meso-body">
                <p class="sub-h">Weeks</p>
                ${weeks.length ? `<div class="weeks">
                  <div class="week-head"><span>Wk</span><span>RPE</span><span>RIR</span><span>Load %</span><span></span></div>
                  ${weeks.map((w, wi) => `
                    <div class="week-row">
                      <input data-w="${i}" data-wi="${wi}" data-wf="weekNum"
                        value="${esc(w.weekNum ?? "")}" inputmode="numeric" aria-label="Week number">
                      <input data-w="${i}" data-wi="${wi}" data-wf="rpe"
                        value="${esc(w.rpe ?? "")}" inputmode="decimal" aria-label="RPE">
                      <input data-w="${i}" data-wi="${wi}" data-wf="rir"
                        value="${esc(w.rir ?? "")}" inputmode="decimal" aria-label="RIR">
                      <input data-w="${i}" data-wi="${wi}" data-wf="loadPercent"
                        value="${esc(w.loadPercent ?? "")}" inputmode="decimal" aria-label="Load percent">
                      <button class="tool-btn is-danger" data-wdrop="${i}:${wi}"
                        aria-label="Remove week">${icon("trash")}</button>
                    </div>`).join("")}
                </div>` : `<p class="empty-note">No weeks set.</p>`}
                <button class="secondary-btn add-btn" data-wadd="${i}">${icon("plus")}Add a week</button>

                <p class="sub-h">Sessions</p>
                ${sessions.length ? `<div class="stations">
                  ${sessions.map((s, si) => `
                    <div class="station">
                      <span class="station-n">${si + 1}</span>
                      <div class="station-main">
                        <div class="station-name">${esc(s.name || "Session")}</div>
                        <div class="station-meta">${(s.items || []).length} exercise${
                          (s.items || []).length === 1 ? "" : "s"}</div>
                      </div>
                      <div class="row-tools">
                        <button class="tool-btn" data-sup="${i}:${si}" ${si === 0 ? "disabled" : ""}
                          aria-label="Move up">${icon("up")}</button>
                        <button class="tool-btn" data-sdown="${i}:${si}"
                          ${si === sessions.length - 1 ? "disabled" : ""}
                          aria-label="Move down">${icon("down")}</button>
                        <button class="tool-btn is-danger" data-sdrop="${i}:${si}"
                          aria-label="Remove session">${icon("trash")}</button>
                      </div>
                    </div>`).join("")}
                </div>` : `<p class="empty-note">No sessions in this block.</p>`}
                <button class="secondary-btn add-btn" data-sadd="${i}">${icon("plus")}Add a session</button>
              </div>` : ""}
          </div>`;
      }).join("");

      bind();
    }

    const pair = (value) => value.split(":").map(Number);

    function bind() {
      const scope = q("#pMesos");

      scope.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
        const i = Number(b.dataset.toggle);
        openBlocks.has(i) ? openBlocks.delete(i) : openBlocks.add(i);
        draw();
      }));
      scope.querySelectorAll("[data-meso]").forEach((input) =>
        input.addEventListener("input", () => {
          model.mesocycles[Number(input.dataset.meso)].name = input.value;
        }));

      scope.querySelectorAll("[data-mup]").forEach((b) => b.addEventListener("click", () => {
        const i = Number(b.dataset.mup);
        [model.mesocycles[i - 1], model.mesocycles[i]] = [model.mesocycles[i], model.mesocycles[i - 1]];
        openBlocks.clear();
        draw();
      }));
      scope.querySelectorAll("[data-mdown]").forEach((b) => b.addEventListener("click", () => {
        const i = Number(b.dataset.mdown);
        [model.mesocycles[i + 1], model.mesocycles[i]] = [model.mesocycles[i], model.mesocycles[i + 1]];
        openBlocks.clear();
        draw();
      }));
      scope.querySelectorAll("[data-mdrop]").forEach((b) => b.addEventListener("click", () => {
        model.mesocycles.splice(Number(b.dataset.mdrop), 1);
        openBlocks.clear();
        draw();
      }));

      scope.querySelectorAll("[data-wf]").forEach((input) =>
        input.addEventListener("input", () => {
          const meso = model.mesocycles[Number(input.dataset.w)];
          meso.weeks[Number(input.dataset.wi)][input.dataset.wf] = input.value;
        }));
      scope.querySelectorAll("[data-wadd]").forEach((b) => b.addEventListener("click", () => {
        const meso = model.mesocycles[Number(b.dataset.wadd)];
        meso.weeks = meso.weeks || [];
        const last = meso.weeks[meso.weeks.length - 1];
        meso.weeks.push({
          weekNum: String(meso.weeks.length + 1),
          rpe: last ? last.rpe : "", rir: last ? last.rir : "",
          loadPercent: last ? last.loadPercent : "",
        });
        draw();
      }));
      scope.querySelectorAll("[data-wdrop]").forEach((b) => b.addEventListener("click", () => {
        const [i, wi] = pair(b.dataset.wdrop);
        model.mesocycles[i].weeks.splice(wi, 1);
        draw();
      }));

      scope.querySelectorAll("[data-sadd]").forEach((b) => b.addEventListener("click", () => {
        const meso = model.mesocycles[Number(b.dataset.sadd)];
        CF.Manage.pickRecord("sessions", "Which session?", (rec) => {
          // A copy, not a reference — see the note at the top of this file.
          sessionsOf(meso).push({ name: rec.name, items: clone(rec.items || []) });
          draw();
        });
      }));
      scope.querySelectorAll("[data-sup]").forEach((b) => b.addEventListener("click", () => {
        const [i, si] = pair(b.dataset.sup);
        const list = sessionsOf(model.mesocycles[i]);
        [list[si - 1], list[si]] = [list[si], list[si - 1]];
        draw();
      }));
      scope.querySelectorAll("[data-sdown]").forEach((b) => b.addEventListener("click", () => {
        const [i, si] = pair(b.dataset.sdown);
        const list = sessionsOf(model.mesocycles[i]);
        [list[si + 1], list[si]] = [list[si], list[si + 1]];
        draw();
      }));
      scope.querySelectorAll("[data-sdrop]").forEach((b) => b.addEventListener("click", () => {
        const [i, si] = pair(b.dataset.sdrop);
        sessionsOf(model.mesocycles[i]).splice(si, 1);
        draw();
      }));
    }

    draw();

    q("#pMesoAdd").addEventListener("click", () => {
      model.mesocycles.push({
        name: `Block ${model.mesocycles.length + 1}`,
        weeks: [], sessionGroups: [{ name: "", sessions: [] }],
      });
      openBlocks.add(model.mesocycles.length - 1);
      draw();
    });

    q("[data-cancel]").addEventListener("click", close);

    q("[data-save]").addEventListener("click", async () => {
      model.name = q("#pName").value.trim();
      const months = q("#pMonths").value.trim();
      // The exporter compares durationMonths against 1 to pluralise, so it
      // wants a number, not the string an input hands back.
      model.durationMonths = months ? Number(months) || months : "";
      OVERVIEW_FIELDS.forEach(([key]) => {
        model.overview[key] = q(`#ov-${key}`).value.trim();
      });

      if (!model.name) { CF.toast("Give the program a name."); return; }
      if (!model.mesocycles.length) { CF.toast("Add at least one mesocycle."); return; }

      const doc = await CF.Store.load();
      doc.programs = doc.programs || [];
      const at = doc.programs.findIndex((p) => p.id === model.id);
      if (at === -1) doc.programs.push(model); else doc.programs[at] = model;

      await CF.Store.save();
      close();
      CF.toast(isNew ? "Program saved" : "Changes saved");
      if (done) done(model);
    });

    setTimeout(() => q("#pName").focus(), 80);
  }

  async function remove(id, done) {
    const doc = await CF.Store.load();
    doc.programs = (doc.programs || []).filter((p) => p.id !== id);
    await CF.Store.save();
    CF.toast("Program deleted");
    if (done) done();
  }

  async function duplicate(id, done) {
    const doc = await CF.Store.load();
    const source = (doc.programs || []).find((p) => p.id === id);
    if (!source) return null;
    const copy = clone(source);
    copy.id = makeId();
    copy.name = `${source.name} copy`;
    copy.created = new Date().toISOString();
    doc.programs.push(copy);
    await CF.Store.save();
    if (done) done(copy);
    return copy;
  }

  return { edit, remove, duplicate, isOpen, close, sessionsOf, OVERVIEW_FIELDS };
})();
