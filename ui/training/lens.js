/* ==========================================================================
   MOVED FROM COACH CAM. Two mechanical changes, no logic touched.

   1. Every getElementById id is prefixed "lens-". Lens shipped as its own
      window, so it had its own #toast, #sheetHost, #sheetTitle and
      #sheetBody -- all of which the training shell also has. Sharing a
      document, one would have found the other's and the two would have
      fought over the same elements.

   2. Its boot is handed to the host, for the same reason app.js's is:
      this file loads with the rest of the app, and Lens's markup is
      hidden until someone opens it.

   WHAT IS NOT CHANGED is the thing that matters: there is still no save
   path anywhere in this file. That is the whole point of Lens -- it can
   be left open on a phone propped against a rack, and it cannot be the
   window that loses your work.
   ========================================================================== */
/* ==========================================================================
   Lens — pick something, look at it.

   Two dropdowns and a pane. Nothing here writes: there is no save path in
   the file at all, which is what makes it safe to leave open beside the
   main app and beside Forge. It cannot be the window that loses your work.

   It re-reads the vault every time you pick something, so a session built
   in Forge thirty seconds ago appears without restarting anything.
   ========================================================================== */
(() => {
  "use strict";

  /* the prefix again: $("what") has to find #lens-what */
  const $ = (id) => document.getElementById("lens-" + id);
  const el = { what: $("what"), which: $("which"), body: $("body"),
               status: $("status"), toast: $("toast") };

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const icon = (n, cls = "ic") =>
    `<svg class="${cls}" viewBox="0 0 24 24"><use href="#i-${n}"/></svg>`;

  let toastTimer = null;
  function toast(message) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 3000);
  }
  CF.toast = toast;

  /* Each kind: how to list it, what to call one, and how to draw it.

     The drawing is deliberately plain — a reading view, not the main app's
     editor. Lens exists to be looked at while your hands are busy, so the
     text is large and there is nothing to click by accident. */
  const KINDS = {
    sessions: {
      label: "Session", icon: "session",
      list: (d) => d.sessions || [],
      draw: (r, d) => blocksView(r, d),
    },
    circuits: {
      label: "Circuit", icon: "circuit",
      list: (d) => d.circuits || [],
      draw: (r) => `
        ${meta(r, `${(r.stations || []).length} stations`)}
        ${r.notes ? `<div class="note-box">${esc(r.notes)}</div>` : ""}
        <div class="stations">${(r.stations || []).map((s, i) => `
          <div class="station" style="--block-rgb:${
            CF.Blocks.colourVar(String.fromCharCode(65 + (i % 8)))}">
            <span class="station-n">${i + 1}</span>
            <div class="station-main">
              <div class="station-name">${esc(s.name)}</div>
              <div class="station-meta">${esc([s.work, s.rest, s.reps]
                .filter(Boolean).join(" · "))}</div>
            </div>
          </div>`).join("")}</div>`,
    },
    programs: {
      label: "Program", icon: "program",
      list: (d) => d.programs || [],
      draw: (r) => `
        ${meta(r, `${(r.mesocycles || []).length} blocks`)}
        ${(r.mesocycles || []).map((m) => `
          <p class="section-h">${esc(m.name || "Block")}</p>
          <div class="list">${(m.weeks || []).map((w, i) => `
            <div class="card"><div class="card-top">
              <span class="card-title">Week ${i + 1}</span>
              <span class="tag">${esc([w.rpe && `RPE ${w.rpe}`,
                w.rir && `RIR ${w.rir}`, w.load && `${w.load}%`]
                .filter(Boolean).join(" · ") || "—")}</span>
            </div></div>`).join("")}</div>`).join("")}`,
    },
    guides: {
      label: "Guide", icon: "guide",
      list: (d) => d.guides || [],
      draw: (r) => `<div class="prose">${r.bodyHtml || ""}</div>`,
    },
    exercises: {
      label: "Exercise", icon: "library",
      // The library is a map of category to a map of name to record, so it
      // is flattened the same way the main app's own search flattens it.
      list: (d) => {
        const out = [];
        for (const [category, items] of Object.entries(d.exercises || {})) {
          for (const [name, rec] of Object.entries(items)) {
            out.push({ id: `${category}/${name}`, name, category, ...rec });
          }
        }
        return out;
      },
      draw: (r) => `
        ${meta(r, [r.category, (r.bodyParts || []).join(", ")]
          .filter(Boolean).join(" · "))}
        ${r.instructions ? `<div class="prose"><p>${esc(r.instructions)}</p></div>`
          : `<p class="empty-note">No instructions written for this one.</p>`}`,
    },
    athletes: {
      label: "Athlete", icon: "people",
      list: (d) => d.athletes || [],
      draw: (r) => `
        ${meta(r, r.email || "")}
        ${r.notes ? `<div class="note-box">${esc(r.notes)}</div>` : ""}
        ${(r.results || []).length ? `
          <p class="section-h">Results</p>
          <div class="list">${r.results.slice(-8).reverse().map((x) => `
            <div class="card"><div class="card-top">
              <span class="card-title">${esc(x.metric || "")}</span>
              <span class="tag">${esc(String(x.value ?? ""))}</span></div>
              <div class="card-sub">${esc(x.date || "")}</div>
            </div>`).join("")}</div>` : ""}`,
    },
    documents: {
      label: "Document", icon: "file",
      list: (d) => (d.documents || []).map((f) => ({ ...f, name: f.originalName })),
      draw: (r) => `
        ${meta(r, [r.category, fileSize(r.size)].filter(Boolean).join(" · "))}
        ${r.note ? `<div class="note-box">${esc(r.note)}</div>` : ""}
        <p class="empty-note">Open it from the main app — Lens only reads.</p>`,
    },
  };

  function meta(record, line) {
    return `<p class="count-line">${esc(line || "")}</p>
      ${(record.tags || []).length ? `<div class="tag-row">${record.tags
        .map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}`;
  }

  const fileSize = (n) => {
    if (!n && n !== 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0, v = Number(n);
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    return `${v < 10 && i ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
  };

  /* A session, grouped and coloured by block exactly as the main app shows
     it — the grouping and the colours both come from CF.Blocks, so the two
     windows cannot disagree about what colour Block B is. */
  function blocksView(session) {
    const items = session.items || [];
    const groups = CF.Blocks.group(items);

    return `
      ${meta(session, `${items.length} exercises · ${groups.length} blocks`)}
      ${session.notes ? `<div class="note-box">${esc(session.notes)}</div>` : ""}
      ${groups.map((g) => blockGroupHtml(g)).join("")}`;
  }

  /** One block: a coloured heading, then its exercises. */
  function blockGroupHtml(group) {
    const colour = CF.Blocks.colourVar(group.letter);
    return `
      <p class="section-h block-h" style="--block-rgb:${colour}">
        <span class="block-dot"></span>${esc(group.title)}
        ${group.alternating ? `<span class="tag block-alt">alternate</span>` : ""}
      </p>
      <div class="stations">${group.items.map((it) => `
        <div class="station" style="--block-rgb:${colour}">
          <span class="station-n">${esc(it.block || "")}</span>
          <div class="station-main">
            <div class="station-name">${esc(it.name)}</div>
            <div class="station-meta">${esc([it.sets && `${it.sets} sets`,
              it.reps && `${it.reps} reps`, it.load, it.rest && `${it.rest} rest`]
              .filter(Boolean).join(" · "))}</div>
          </div>
        </div>`).join("")}</div>`;
  }

  /* ---- the two dropdowns -------------------------------------------------- */

  let doc = null;
  let showing = null;          // {kind, record} currently on screen

  /* What the host calls each kind when printing or exporting. Only the four
     with print sheets are offered; the rest have no sheet to produce, and a
     button that produces nothing is worse than no button. */
  const PRINTABLE = {
    sessions: "session", circuits: "circuit",
    guides: "guide", programs: "program",
  };

  function drawActions() {
    const bar = document.getElementById("lens-lensActions");
    if (!bar) return;
    const kind = showing && PRINTABLE[showing.tab];
    bar.hidden = !(kind && CF.Store.isDesktop());
    if (bar.hidden) return;
    bar.innerHTML = `
      <button class="secondary-btn" id="lensPrint">${icon("print")}Print</button>
      <button class="secondary-btn" id="lensExport">${icon("pdf")}Export</button>`;
    bar.querySelector("#lensPrint").addEventListener("click", printShowing);
    bar.querySelector("#lensExport").addEventListener("click", exportShowing);
    /* Ctrl+P while Lens is showing a session prints that session. The
       offer is thin on purpose -- the host says "Printing…" and reports
       the result, so this must not toast as well. */
    CF.offerPrint(bar.querySelector("#lensPrint"), showing.record.name || "this",
      () => CF.Store.printDocument(kind, forExport(showing.record)));
  }

  /* The exporter never sees ids, so linked guides are resolved to names
     here exactly as the main app does — otherwise a printed sheet from Lens
     would be missing the "Read first" line the same sheet carries when
     printed from the main window. */
  function forExport(record) {
    const guides = (doc && doc.guides) || [];
    const names = (record.guideIds || [])
      .map((id) => (guides.find((g) => g.id === id) || {}).name)
      .filter(Boolean);
    return names.length ? { ...record, guideNames: names } : record;
  }

  const safeName = (text, fallback) =>
    String(text || fallback).replace(/[\/\\:*?"<>|]/g, "-").trim();

  async function printShowing() {
    if (!showing) return;
    const kind = PRINTABLE[showing.tab];
    toast("Printing…");
    const result = await CF.Store.printDocument(kind, forExport(showing.record));
    if (result === true) toast("Sent to the printer");
    else if (result === false) toast("Cancelled");
    else toast(String(result));
  }

  /* The same print sheet the main app produces — this window does not have
     its own idea of what a session looks like on paper. */
  /* formats() reports which writers are installed, as {docx, xlsx, pdf} —
     not a list. Which of those suit a given kind follows the main app's own
     rules, so Lens never offers an export the main window would not. */
  async function exportShowing() {
    if (!showing) return;
    const kind = PRINTABLE[showing.tab];
    const available = (await CF.Store.formats()) || {};
    const record = forExport(showing.record);
    const name = safeName(showing.record.name, kind);

    const run = async (label, format) => {
      closeSheet();
      toast(`${label}…`);
      const result = await CF.Store.exportDocument(kind, format, record, name);
      if (result === true) toast(`${label} done`);
      else if (result === false) toast("Cancelled");
      else toast(String(result));
    };

    openSheet(showing.record.name || "Export", (sheet) => {
      sheet.innerHTML = `<p class="sheet-note">The same sheet the main app
        produces — this window has no separate idea of what a session looks
        like on paper.</p>`;

      if (available.docx) sheetItem(sheet, {
        label: "Save as Word", iconName: "file",
        onClick: () => run("Word export", "docx"),
      });
      if (available.xlsx) sheetItem(sheet, {
        label: "Save as Excel", iconName: "table",
        onClick: () => run("Excel export", "xlsx"),
      });
      // PDF only for the kinds that have a PDF builder, matching the main
      // app — offering it elsewhere would produce a failure, not a file.
      if (available.pdf && (kind === "session" || kind === "circuit")) {
        sheetItem(sheet, {
          label: "Save as PDF", iconName: "pdf",
          onClick: () => run("PDF export", "pdf"),
        });
      }
      if (!available.docx && !available.xlsx && !available.pdf) {
        const note = document.createElement("p");
        note.className = "sheet-note";
        note.textContent = "No export libraries are installed. Run: "
          + "pip install python-docx openpyxl reportlab";
        sheet.appendChild(note);
      }
    });
  }

  /* Lens borrows the main app's sheet markup, which is already in the page,
     so the export picker looks like every other picker in the suite. */
  function openSheet(title, build) {
    const host = document.getElementById("lens-sheetHost");
    document.getElementById("lens-sheetTitle").textContent = title;
    const body = document.getElementById("lens-sheetBody");
    body.innerHTML = "";
    build(body);
    host.hidden = false;
  }
  function closeSheet() {
    document.getElementById("lens-sheetHost").hidden = true;
  }
  document.getElementById("lens-sheetHost").addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeSheet();
  });

  function sheetItem(parent, { label, sub, iconName, onClick }) {
    const b = document.createElement("button");
    b.className = "sheet-item";
    b.innerHTML = (iconName ? icon(iconName) : "")
      + `<span>${esc(label)}${sub ? `<span class="sheet-item-sub">${esc(sub)}</span>` : ""}</span>`;
    b.addEventListener("click", onClick);
    parent.appendChild(b);
    return b;
  }

  el.what.addEventListener("change", async () => {
    const kind = KINDS[el.what.value];
    if (!kind) { el.which.hidden = true; showEmpty(); return; }

    // Re-read every time: something built in Forge a minute ago should be
    // here without restarting anything.
    CF.Store.invalidate();
    doc = await CF.Store.load();

    const records = kind.list(doc)
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    el.which.hidden = false;
    el.which.innerHTML = `<option value="">${records.length} ${
      kind.label.toLowerCase()}${records.length === 1 ? "" : "s"} — pick one</option>`
      + records.map((r, i) => `<option value="${i}">${esc(r.name || "Untitled")}</option>`).join("");
    el.which.dataset.kind = el.what.value;
    showEmpty(`Pick a ${kind.label.toLowerCase()} above.`);
  });

  el.which.addEventListener("change", () => {
    const kind = KINDS[el.which.dataset.kind];
    if (!kind || el.which.value === "") { showEmpty(); return; }
    const records = kind.list(doc)
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    const record = records[Number(el.which.value)];
    if (!record) { showEmpty(); return; }

    showing = { tab: el.which.dataset.kind, record };

    el.body.innerHTML = `
      <div class="lens-head">
        ${icon(kind.icon, "ic lens-mark")}
        <div>
          <div class="lens-kind">${esc(kind.label)}</div>
          <h1 class="lens-title">${esc(record.name || "Untitled")}</h1>
        </div>
      </div>
      ${kind.draw(record, doc)}`;
    el.body.scrollTop = 0;
    drawActions();
  });

  function showEmpty(message) {
    showing = null;
    drawActions();
    el.body.innerHTML = `<div class="tool-empty">
      ${icon("search", "ic tool-empty-mark")}
      <p>${esc(message || "Pick something above to read it.")}</p>
      <p class="tool-hint">Nothing here changes the vault. Leave it open
        beside the main app.</p></div>`;
  }

  /* ---- boot --------------------------------------------------------------- */

  /* Handed to the host instead of run on parse -- see the header. The
     theme line that used to be here is gone: Lens read Coach Cam's own
     theme preference and wrote it onto documentElement, which in KinCrux
     is the element KinCrux's own theme engine owns. Opening Lens would
     have re-themed the entire window, Money and the photo library
     included. KinCrux sets the theme now; Lens inherits it like every
     other view. */
  async function init() {
    await CF.Store.ready;
    if (!CF.Store.isDesktop()) {
      el.body.innerHTML = `<div class="tool-empty">
        <p>Lens works alongside the desktop app.</p></div>`;
      return;
    }
    doc = await CF.Store.load();
    el.status.textContent = `${(doc.sessions || []).length} sessions \u00b7 ${
      (doc.circuits || []).length} circuits`;
    showEmpty();
  }

  window.CF = window.CF || {};
  window.CF.Lens = {init, booted: false};
})();
