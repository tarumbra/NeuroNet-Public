/* ==========================================================================
   Coach Cam — app controller.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = {
    app: $("app"), sidebar: $("sidebar"), scrim: $("scrim"), nav: $("nav"),
    menuBtn: $("menuBtn"), collapseBtn: $("collapseBtn"),
    page: $("page"), pageTitle: $("pageTitle"), crumb: $("crumb"),
    topbarActions: $("topbarActions"), dataStamp: $("dataStamp"),
    detail: $("detail"), detailBody: $("detailBody"), detailTitle: $("detailTitle"),
    detailCrumb: $("detailCrumb"), detailActions: $("detailActions"), detailBack: $("detailBack"),
    globalSearch: $("globalSearch"), globalClear: $("globalClear"),
    searchSuggest: $("searchSuggest"),
    sheetHost: $("sheetHost"), sheetTitle: $("sheetTitle"), sheetBody: $("sheetBody"),
    toast: $("toast"), restoreInput: $("restoreInput"),
  };

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const icon = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24"><use href="#i-${n}"/></svg>`;
  const isWide = () => window.matchMedia("(min-width: 620px)").matches;
  /* At this width the detail pane sits permanently beside the list rather
     than sliding over it, which is the whole point of a desktop window. */
  /* In NeuroNet's Multitask, Training may have only one side of the window.
     Below this width its side is too narrow for a list and a record side by
     side, whatever the window's width -- multitask.css makes the same call
     at the same width, so the layout and this agree. */
  const MT_SPLIT_MIN = 760;
  const inNarrowSide = () => {
    const side = el.app && el.app.closest(".mt-body");
    return !!side && side.clientWidth < MT_SPLIT_MIN;
  };
  const isSplit = () => window.matchMedia("(min-width: 1000px)").matches && !inNarrowSide();
  const countExercises = () => Object.values(state.doc.exercises)
    .reduce((n, c) => n + Object.keys(c).length, 0);

  /* Bumped whenever the packaged build changes. Shown in Settings and
     written to the log at launch, so "which build is this?" is answerable
     without diffing files. */
  const APP_VERSION = "2026.09.27";

  const state = {
    view: "library",
    collapsed: false,
    doc: null,
    query: "",
    category: "All",
    bodyPart: "All",
    calcTab: "Strength",
    counts: {},
    globalQuery: "",
    selectMode: false,
    selection: [],
    docQuery: "",
    docCategory: null,
    hiddenSections: [],
    lastTab: {},
    calendarId: null,
    calendarMonth: null,
    tagFilter: { sessions: "All", circuits: "All" },
    runner: null,
  };

  /* ------------------------------------------------------------ feedback */

  let toastTimer = null;
  CF.toast = toast;

  /* A thrown error used to leave the interface looking simply frozen: the
     click did nothing, no sheet opened, and nothing said why. Surfacing it
     costs a line and turns a dead app into something reportable. */
  function reportError(where, err) {
    console.error(where, err);
    const message = (err && err.message) || String(err || "Unknown error");
    toast(`${where}: ${message}`);
    // Also to disk, because a message on screen is no use if the interface
    // has stopped responding. Failing to log must never itself throw.
    try {
      const detail = err && err.stack ? err.stack.split("\n").slice(0, 4).join(" | ") : message;
      CF.Store.logError(`[${state.view}] ${where}: ${detail}`).catch(() => {});
    } catch { /* nothing useful left to do */ }
  }
  window.addEventListener("error", (e) => reportError("Error", e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => reportError("Error", e.reason));

  /** Wrap a click handler so a failure inside it is reported, not swallowed. */
  const guard = (where, fn) => async (...args) => {
    try { await fn(...args); } catch (err) { reportError(where, err); }
  };
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2400);
  }

  function openSheet(title, build) {
    el.sheetTitle.textContent = title;
    el.sheetBody.innerHTML = "";
    build(el.sheetBody);
    el.sheetHost.hidden = false;
  }
  const closeSheet = () => { el.sheetHost.hidden = true; el.sheetBody.innerHTML = ""; };
  el.sheetHost.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeSheet();
  });

  function sheetItem(parent, { label, iconName, danger, onClick }) {
    const b = document.createElement("button");
    b.className = "sheet-item" + (danger ? " is-danger" : "");
    b.innerHTML = icon(iconName) + `<span>${esc(label)}</span>`;
    b.addEventListener("click", onClick);
    parent.appendChild(b);
    return b;
  }

  function confirmAction({ title, note, confirmLabel, onConfirm }) {
    openSheet(title, (body) => {
      if (note) {
        const p = document.createElement("p");
        p.className = "sheet-note";
        p.textContent = note;
        body.appendChild(p);
      }
      const row = document.createElement("div");
      row.className = "sheet-row";
      const cancel = document.createElement("button");
      cancel.className = "secondary-btn";
      cancel.textContent = "Cancel";
      cancel.onclick = closeSheet;
      const ok = document.createElement("button");
      ok.className = "primary-btn";
      ok.textContent = confirmLabel;
      ok.onclick = () => { closeSheet(); onConfirm(); };
      row.append(cancel, ok);
      body.appendChild(row);
    });
  }

  /* -------------------------------------------------------------- drawer */

  function openSidebar() {
    if (isWide()) {
      state.collapsed = false;
      el.app.classList.remove("is-collapsed");
      CF.Store.setPref("collapsed", false);
    } else {
      el.sidebar.classList.add("is-open");
      el.scrim.hidden = false;
      requestAnimationFrame(() => el.scrim.classList.add("is-visible"));
    }
  }
  function closeSidebar() {
    if (isWide()) {
      state.collapsed = true;
      el.app.classList.add("is-collapsed");
      CF.Store.setPref("collapsed", true);
    } else {
      el.sidebar.classList.remove("is-open");
      el.scrim.classList.remove("is-visible");
      setTimeout(() => { el.scrim.hidden = true; }, 220);
    }
  }
  const sidebarOpen = () => isWide() ? !state.collapsed : el.sidebar.classList.contains("is-open");

  el.menuBtn.addEventListener("click", openSidebar);
  el.collapseBtn.addEventListener("click", closeSidebar);
  el.scrim.addEventListener("click", closeSidebar);

  let touchStart = null;
  document.addEventListener("touchstart", (e) => {
    if (isWide() || e.touches.length !== 1 || !el.detail.hidden) return;
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY, edge: t.clientX < 22, open: sidebarOpen() };
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!touchStart || isWide()) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    if (Math.abs(t.clientY - touchStart.y) < 60 && Math.abs(dx) > 55) {
      if (dx > 0 && touchStart.edge && !touchStart.open) openSidebar();
      else if (dx < 0 && touchStart.open) closeSidebar();
    }
    touchStart = null;
  }, { passive: true });

  /* ---------------------------------------------------------------- nav */

  /*
   * Five sections instead of fourteen sidebar entries. The split that makes
   * this navigable is ingredients versus plans: everything in Database is
   * something you pick from when building, everything in Plan is something
   * built out of those pieces. Programs and lesson plans deliberately sit
   * outside the Database for that reason.
   *
   * Each tab id is a view key, so the existing views are reused untouched.
   */
  const SECTIONS = [
    { id: "database", label: "Database", icon: "library", tabs: [
      { id: "sessions", label: "Sessions" },
      { id: "circuits", label: "Circuits" },
      { id: "library", label: "Exercises" },
      { id: "guides", label: "Guides" },
      { id: "questionnaires", label: "Questionnaires" },
      { id: "equipment", label: "Equipment" },
      { id: "documents", label: "Document library" },
    ] },
    { id: "plan", label: "Plan", icon: "calendar", tabs: [
      { id: "calendar", label: "Calendar" },
      { id: "programs", label: "Programs" },
      { id: "lessonPlans", label: "Lesson plans" },
    ] },
    { id: "books", label: "Books", icon: "book", tabs: [
      { id: "books", label: "Books" },
    ] },
    { id: "people", label: "Athletes", icon: "people", tabs: [
      { id: "athletes", label: "Athletes" },
      { id: "groups", label: "Groups" },
    ] },
    { id: "tools", label: "Calculators", icon: "calc", tabs: [
      { id: "calculators", label: "Calculators" },
    ] },
    { id: "system", label: "Settings", icon: "settings", tabs: [
      { id: "settings", label: "Appearance" },
      { id: "backup", label: "Backup" },
    ] },
  ];

  const sectionOf = (viewId) =>
    SECTIONS.find((s) => s.tabs.some((t) => t.id === viewId)) || SECTIONS[0];

  /* Sections off by default. Everything here is real and reachable — just
     not in the way of someone who never uses it. Search still finds
     everything inside them, which is what makes hiding safe. */
  /* What Training used to hide before anyone chose. Still read, because
     it is what the one-time migration in ui/app.js copies across for
     someone upgrading; nothing in here hides anything any more. */
  const HIDDEN_BY_DEFAULT = ["plan", "programs", "lessonPlans",
                             "questionnaires", "groups", "equipment"];

  /* TRAINING NO LONGER HIDES ANYTHING ITSELF.

     Every one of its tabs is a NeuroNet subsection now, and NeuroNet
     hides subsections from its own Settings. If this still answered
     true, the damage would not be a stray pill -- it is that render()
     picks the section from visibleSections(), and boot() BOUNCES off a
     view it thinks is hidden. Cam would click Equipment in the menu,
     which NeuroNet is showing him, and land somewhere else, with the
     stale pref from a version whose switches no longer exist deciding
     that. The + button would quietly stop offering the type too.

     state.hiddenSections is still loaded, and only so the migration has
     something to read. */
  const isHidden = () => false;

  /** The sections and tabs actually shown, after the visibility settings. */
  function visibleSections() {
    return SECTIONS
      .filter((s) => !isHidden(s.id))
      .map((s) => ({ ...s, tabs: s.tabs.filter((t) => !isHidden(t.id)) }))
      .filter((s) => s.tabs.length);
  }

  /** What each view can create, for the section's + button. */
  const CREATORS = {
    sessions: { label: "Session", icon: "session",
      run: () => CF.Builders.editSession(null, afterEdit("sessions")) },
    circuits: { label: "Circuit", icon: "circuit",
      run: () => CF.Builders.editCircuit(null, afterEdit("circuits")) },
    library: { label: "Exercise", icon: "library",
      run: () => CF.Library.editExercise(null, afterExerciseEdit) },
    guides: { label: "Guide", icon: "guide",
      run: () => CF.Builders.editGuide(null, afterEdit("guides")) },
    questionnaires: { label: "Questionnaire", icon: "form",
      run: () => CF.Builders.editQuestionnaire(null, afterEdit("questionnaires")) },
    equipment: { label: "Equipment", icon: "kit",
      run: () => CF.Manage.editEquipment(null, refreshAll) },
    documents: { label: "File", icon: "file", desktopOnly: true,
      run: () => addDocumentFile() },
    programs: { label: "Program", icon: "program",
      run: () => CF.Programs.edit(null, afterEdit("programs")) },
    books: { label: "Book", icon: "book",
      run: () => CF.Books.edit(null, refreshAll) },
    lessonPlans: { label: "Lesson plan", icon: "plan",
      run: () => CF.Lessons.edit(null, afterEdit("lessonPlans")) },
    calendar: { label: "Calendar", icon: "calendar",
      run: () => CF.Manage.newCalendar(refreshAll) },
    athletes: { label: "Athlete", icon: "people",
      run: () => CF.Manage.editAthlete(null, refreshAll) },
    groups: { label: "Group", icon: "group",
      run: () => CF.Manage.editGroup(null, refreshAll) },
  };

  /* Navigate by view id without going through the sidebar. The tabs only
     exist for the current section, so there is otherwise no way to reach a
     view in another one except by clicking twice. */
  CF.go = (view) => { if (VIEWS[view]) go(view); };

  async function refreshAll() {
    state.doc = await CF.Store.load();
    render();
  }

  function renderNav() {
    const doc = state.doc;
    const counts = {
      circuits: doc.circuits.length,
      sessions: doc.sessions.length,
      programs: (doc.programs || []).length,
      lessonPlans: (doc.lessonPlans || []).length,
      books: (doc.books || []).length,
      library: countExercises(),
      guides: doc.guides.length,
      questionnaires: doc.questionnaires.length,
      athletes: doc.athletes.length,
      groups: (doc.groups || []).length,
      equipment: (doc.equipment || []).length,
      documents: (doc.documents || []).length,
      calendar: doc.calendars.length,
    };
    state.counts = counts;

    const shown = visibleSections();
    const active = sectionOf(state.view);
    /* No count on the section itself. Adding 456 exercises to 34 sessions
       produces a number that means nothing; the per-tab counts are the ones
       worth reading. */
    el.nav.innerHTML = shown.map((s) => `
        <button class="nav-btn ${s.id === active.id && state.view !== "search" ? "on" : ""}" data-section="${s.id}">
          ${icon(s.icon)}<span>${esc(s.label)}</span>
        </button>`).join("");

    el.nav.querySelectorAll("[data-section]").forEach((b) =>
      b.addEventListener("click", () => {
        const section = shown.find((s) => s.id === b.dataset.section);
        // Returning to a section lands on the tab last used there.
        go(state.lastTab[section.id] || section.tabs[0].id);
      }));
  }

  function go(view) {
    state.view = view;
    state.query = "";
    CF.Store.setPref("view", view);
    if (!isWide()) closeSidebar();
    render();
  }

  /* ------------------------------------------------------------- detail */

  /* With the detail pane permanently on screen, the list needs to show which
     row is currently in it — otherwise the two columns drift out of sync. */
  el.page.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card || !el.page.contains(card)) return;
    el.page.querySelectorAll(".card.is-selected").forEach((c) => c.classList.remove("is-selected"));
    card.classList.add("is-selected");
  });

  /* `print` is {collection, record}: what Ctrl+P should put on paper
     while this detail is the thing on screen. Every record view funnels
     through here, so registering in one place beats remembering it in
     each of the seven show* functions -- and it is anchored to
     el.detail, so a view that opens without one silently replaces the
     last offer rather than leaving it live behind the new screen. */
  function openDetail({ title, crumb = "", actions = "", html, onReady,
                        print = null }) {
    el.detailTitle.textContent = title;
    el.detailCrumb.textContent = crumb;
    el.detailActions.innerHTML = actions;
    el.detailBody.innerHTML = html;
    el.detailBody.scrollTop = 0;
    el.detail.hidden = false;
    const kind = print && DOC_KIND[print.collection];
    if (kind && print.record) {
      /* `record` may be a function, for the views whose printable
         payload is assembled from state that can change while the
         detail is open -- a book gains an entry and Ctrl+P should print
         the book as it is now, not as it was when it opened. */
      CF.offerPrint(el.detail, print.label || title, () => {
        const rec = typeof print.record === "function" ? print.record() : print.record;
        return CF.Store.printDocument(kind, kind === "program" ? { ...rec, sessionDetails: programSessionDetails(rec) } : rec);
      });
    } else {
      CF.withdrawPrint(el.detail);
    }
    if (onReady) onReady(el.detailBody, el.detailActions);
  }
  function closeDetail() {
    /* In split mode the pane stays in the document and merely empties,
       so it would still measure as visible; the offer has to be taken
       back by hand here or Ctrl+P would print what was last open. */
    CF.withdrawPrint(el.detail);
    el.detailActions.innerHTML = "";
    if (isSplit()) {
      // The pane is a permanent column here, so it rests rather than closes.
      el.detail.hidden = false;
      el.detailTitle.textContent = "";
      el.detailCrumb.textContent = "";
      el.detailBody.innerHTML = `<p class="empty-note">Pick something on the left to see it here.</p>`;
      el.page.querySelectorAll(".card.is-selected").forEach((c) => c.classList.remove("is-selected"));
      return;
    }
    el.detail.hidden = true;
    el.detailBody.innerHTML = "";
  }
  el.detailBack.addEventListener("click", closeDetail);

  /* --------------------------------------------------------------- views */

  const VIEWS = {};

  async function render() {
    closeDetail();
    renderNav();

    if (state.view === "search") {
      el.pageTitle.textContent = "Search";
      el.crumb.textContent = "";
      el.topbarActions.innerHTML = "";
      el.page.scrollTop = 0;
      el.page.innerHTML = `<div id="tabBody"></div>`;
      await VIEWS.search(el.page.querySelector("#tabBody"));
      return;
    }

    const full = sectionOf(state.view);
    const section = visibleSections().find((s) => s.id === full.id) || full;
    state.lastTab[section.id] = state.view;
    const tab = section.tabs.find((t) => t.id === state.view)
      || full.tabs.find((t) => t.id === state.view) || section.tabs[0];

    /* The heading names the TAB, always. It used to name the section
       ("Database") and leave the tab to the crumb, which worked while
       the pill row was underneath showing which of Database's seven you
       were on. With the pills gone, "Database" alone would be the only
       thing on screen naming a page that is actually Exercises. */
    el.pageTitle.textContent = tab.label;
    el.crumb.textContent = "";
    el.topbarActions.innerHTML = "";
    el.page.scrollTop = 0;

    // A way into selecting, on the tabs it applies to. Desktop only: the
    // export needs a save dialog and a PDF writer.
    if (selectableHere() && CF.Store.isDesktop() && !state.selectMode) {
      el.topbarActions.innerHTML +=
        `<button class="icon-btn" id="pickBtn" aria-label="Select several">${icon("pdf")}</button>`;
    }

    // One + per section. With several creatable types it asks which.
    const creatable = section.tabs
      .map((t) => ({ view: t.id, ...CREATORS[t.id] }))
      .filter((c) => c.label && (!c.desktopOnly || CF.Store.isDesktop()));
    if (creatable.length) {
      el.topbarActions.innerHTML +=
        `<button class="icon-btn" id="newBtn" aria-label="Add">${icon("plus")}</button>`;
      el.topbarActions.querySelector("#newBtn").addEventListener("click", guard("Add", () => {
        const here = creatable.find((c) => c.view === state.view);
        if (creatable.length === 1) return creatable[0].run();
        openSheet(`Add to ${section.label}`, (sheet) => {
          // The current tab's type first, since that is usually the one
          // wanted, then everything else the section can hold.
          const ordered = here
            ? [here, ...creatable.filter((c) => c !== here)] : creatable;
          ordered.forEach((c) => sheetItem(sheet, {
            label: c.label, iconName: c.icon,
            onClick: () => { closeSheet(); c.run(); },
          }));
        });
      }));
    }

    /* NO TAB ROW. Cam: "Type tags in Training are no longer needed for
       me, have sub sections provided for each Circuit, Sessions, Guides
       etc. It is the pill tags i want removed."

       This drew "Sessions · Circuits · Exercises · Guides · Document
       library" across the top of the page while NeuroNet's subsection
       menu said the same words a few inches to the right. Two menus for
       one set of destinations, and the pills were the ones that could
       not be reordered, hidden or favourited.

       Every tab is a subsection now (see SECTIONS in ui/app.js), so
       go() is still what moves between them -- it is simply called from
       the menu rather than from a chip. Nothing about the views
       changed. */
    el.page.innerHTML = `<div id="tabBody"></div>`;

    await VIEWS[state.view](el.page.querySelector("#tabBody"));

    const pick = document.getElementById("pickBtn");
    if (pick) pick.addEventListener("click", () => setSelectMode(true));

    if (state.selectMode && selectableHere()) {
      paintSelection();
      // While selecting, a click picks rather than opens. Capture phase, so
      // this runs before the list's own handler rather than after it.
      el.page.addEventListener("click", onSelectClick, true);
    }
    drawSelectionBar();
  }

  /** How each editable collection is displayed once saved. */
  const SHOW = {
    circuits: (r) => showCircuit(r),
    sessions: (r) => showSession(r),
    guides: (r) => showGuide(r),
    questionnaires: (r) => fillQuestionnaire(r),
    programs: (r) => showProgram(r),
    lessonPlans: (r) => showLessonPlan(r),
  };

  /** Re-read the list after an editor writes, then show the saved record so
      the change is visible rather than just asserted. */
  function afterEdit(collection) {
    return async (record) => {
      state.doc = await CF.Store.load();
      await render();
      if (!record) return;
      const fresh = state.doc[collection].find((r) => r.id === record.id);
      if (!fresh) return;
      SHOW[collection](fresh);
      const card = el.page.querySelector(`.card[data-id="${fresh.id}"]`);
      if (card) {
        card.classList.add("is-selected");
        card.scrollIntoView({ block: "nearest" });
      }
    };
  }

  /** The Edit / Duplicate / Delete menu shared by circuits and sessions. */
  const EDITORS = {
    circuits: (r, d) => CF.Builders.editCircuit(r, d),
    sessions: (r, d) => CF.Builders.editSession(r, d),
    guides: (r, d) => CF.Builders.editGuide(r, d),
    programs: (r, d) => CF.Programs.edit(r, d),
    lessonPlans: (r, d) => CF.Lessons.edit(r, d),
    questionnaires: (r, d) => CF.Builders.editQuestionnaire(r, d),
  };
  const NOUN = {
    circuits: "circuit", sessions: "session",
    guides: "guide", questionnaires: "questionnaire", programs: "program",
    lessonPlans: "lesson plan",
  };

  /** Which document kind each collection maps to in the Python host. */
  const DOC_KIND = {
    circuits: "circuit", sessions: "session",
    guides: "guide", questionnaires: "questionnaire",
    athletes: "athlete", calendars: "calendar", programs: "program",
    lessonPlans: "lessonplan", masSheet: "mas_sheet", books: "book",
  };

  /**
   * Word, Excel, PDF and print, all produced by the desktop host. Formats
   * whose library isn't installed are left out rather than offered and
   * failed, and anything the host reports back as a problem is shown as
   * given — an ImportError there is a plain sentence, not a stack trace.
   */
  function programSessionDetails(program) {
    const lib = state.doc.sessions || [], guides = state.doc.guides || [], out = {};
    (program.mesocycles || []).forEach((m) => (m.sessionGroups || []).forEach((g) => (g.sessions || []).forEach((s) => {
      const full = lib.find((x) => x.name === s.name);
      if (!full || out[s.name]) return;
      out[s.name] = {
        notes: full.notes || "", tags: full.tags || [], equipment: full.equipment || [],
        logEntries: full.logEntries || [],
        guideNames: (full.guideIds || []).map((id) => (guides.find((x) => x.id === id) || {}).name).filter(Boolean),
      };
    })));
    return out;
  }

  async function exportActions(collection, record, nameOverride) {
    const kind = DOC_KIND[collection];
    if (!kind) return;

    if (!CF.Store.isDesktop()) {
      toast("Exporting and printing need the desktop app.");
      return;
    }
    const available = await CF.Store.formats();

    // The exporter never sees ids. Resolve linked guides to names here so a
    // printed sheet names them, and a guide deleted since linking simply
    // drops out rather than printing an id.
    const guides = state.doc.guides || [];
    const guideNames = (record.guideIds || [])
      .map((id) => (guides.find((g) => g.id === id) || {}).name)
      .filter(Boolean);
    if (guideNames.length) record = { ...record, guideNames };
    // A program holds each session's name and exercises only. Its printout lays every
    // session out like the session's own sheet (2026-10-05), so send the library's
    // notes, tags, equipment and log with it, by name -- still no ids.
    if (kind === "program") record = { ...record, sessionDetails: programSessionDetails(record) };

    const safeName = String(nameOverride || record.name || kind).replace(/[\/\\:*?"<>|]/g, "-").trim();

    openSheet(record.name, (sheet) => {
      const run = async (label, fn) => {
        closeSheet();
        toast(`${label}…`);
        const result = await fn();
        if (result === true) toast(`${label} done`);
        else if (result === false) toast("Cancelled");
        else toast(String(result));
      };

      sheetItem(sheet, {
        label: "Print", iconName: "print",
        onClick: () => run("Print", () => CF.Store.printDocument(kind, record)),
      });
      if (available.docx) sheetItem(sheet, {
        label: "Save as Word", iconName: "word",
        onClick: () => run("Word export", () => CF.Store.exportDocument(kind, "docx", record, safeName)),
      });
      if (available.xlsx && kind !== "calendar") sheetItem(sheet, {
        label: "Save as Excel", iconName: "sheet",
        onClick: () => run("Excel export", () => CF.Store.exportDocument(kind, "xlsx", record, safeName)),
      });
      if (available.pdf && (kind === "session" || kind === "circuit")) sheetItem(sheet, {
        label: "Save as PDF", iconName: "pdf",
        onClick: () => run("PDF export", () => CF.Store.exportDocument(kind, "pdf", record, safeName)),
      });

      if (!available.docx && !available.xlsx && !available.pdf) {
        const note = document.createElement("p");
        note.className = "sheet-note";
        note.textContent =
          "No export libraries are installed. Run: pip install python-docx openpyxl reportlab";
        sheet.appendChild(note);
      }
    });
  }

  /* The training log (Cam, 2026-10-05): a printed sheet of a session's or a program's
     lifts with a box a week for the weight of the middle set. A session asks how many
     weeks (1-10); a program uses its own length (its blocks' weeks, or months x 4), and
     asks only when it has none. Printed, or saved to Excel to type the weights in. */
  function programWeeks(program) {
    const w = (program.mesocycles || []).reduce((n, m) => n + (m.weeks || []).length, 0);
    return w || Math.round((parseFloat(program.durationMonths) || 0) * 4);
  }
  async function logActions(collection, record) {
    if (!CF.Store.isDesktop()) { toast("Printing needs the desktop app."); return; }
    const isProgram = collection === "programs";
    const fixed = isProgram ? programWeeks(record) : 0;
    let weeks = fixed || 6;
    const available = await CF.Store.formats();
    const payload = () => {
      const p = { ...record, logWeeks: weeks };
      if (isProgram) p.sessionDetails = programSessionDetails(record);
      return p;
    };
    const safeName = String(record.name || "Log").replace(/[\/\\:*?"<>|]/g, "-").trim() + " - Log";
    openSheet(`Log — ${record.name}`, (sheet) => {
      const note = document.createElement("p");
      note.className = "sheet-note";
      note.textContent = fixed
        ? `This program runs ${fixed} week${fixed === 1 ? "" : "s"}, so the log has a column for each. Record the middle set of every lift.`
        : isProgram ? "This program has no length set. How many weeks should the log cover?"
        : "How many weeks should the log cover? Each lift gets a box a week for the weight of its middle set.";
      sheet.appendChild(note);
      if (!fixed) {
        const row = document.createElement("div");
        row.className = "chips log-weeks";
        for (let n = 1; n <= 10; n++) {
          const b = document.createElement("button");
          b.className = "chip" + (n === weeks ? " on" : "");
          b.textContent = n === 1 ? "1 week" : `${n} weeks`;
          b.addEventListener("click", () => {
            weeks = n;
            row.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b));
          });
          row.appendChild(b);
        }
        sheet.appendChild(row);
      }
      const run = async (label, fn) => {
        closeSheet();
        toast(`${label}…`);
        const result = await fn();
        if (result === true) toast(`${label} done`);
        else if (result === false) toast("Cancelled");
        else toast(String(result));
      };
      sheetItem(sheet, {
        label: "Print the log", iconName: "print",
        onClick: () => run("Print", () => CF.Store.printDocument("log", payload())),
      });
      if (available.xlsx) sheetItem(sheet, {
        label: "Save the log as Excel", iconName: "sheet",
        onClick: () => run("Excel export", () => CF.Store.exportDocument("log", "xlsx", payload(), safeName)),
      });
    });
  }

  function recordActions(collection, record) {
    const edit = EDITORS[collection];
    openSheet(record.name, (sheet) => {
      sheetItem(sheet, {
        label: "Edit", iconName: "rename",
        onClick: () => { closeSheet(); edit(record, afterEdit(collection)); },
      });
      if (DOC_KIND[collection]) sheetItem(sheet, {
        label: "Print or export", iconName: "print",
        onClick: () => { closeSheet(); exportActions(collection, record); },
      });
      if (collection === "sessions" || collection === "programs") sheetItem(sheet, {
        label: "Log", iconName: "chart",
        onClick: () => { closeSheet(); logActions(collection, record); },
      });
      sheetItem(sheet, {
        label: "Duplicate", iconName: "copy",
        onClick: async () => {
          closeSheet();
          const copy = collection === "lessonPlans"
            ? await CF.Lessons.duplicate(record.id)
            : collection === "programs"
            ? await CF.Programs.duplicate(record.id)
            : await CF.Builders.duplicateRecord(collection, record.id);
          toast(copy ? `Copied to “${copy.name}”` : "Couldn't copy that.");
          afterEdit(collection)(copy);
        },
      });
      sheetItem(sheet, {
        label: `Delete ${NOUN[collection]}`,
        iconName: "trash", danger: true,
        onClick: () => {
          closeSheet();
          confirmAction({
            title: `Delete “${record.name}”?`,
            note: "This removes it from the data file. It can't be undone.",
            confirmLabel: "Delete",
            onConfirm: async () => {
              if (collection === "lessonPlans") await CF.Lessons.remove(record.id);
              else if (collection === "programs") await CF.Programs.remove(record.id);
              else await CF.Builders.removeRecord(collection, record.id);
              state.doc = await CF.Store.load();
              closeDetail();
              toast("Deleted");
              render();
            },
          });
        },
      });
    });
  }

  /* ---- exercise library ------------------------------------------------ */

  VIEWS.library = async (page) => {
    const cats = ["All", ...(await CF.Store.categories())];
    const parts = ["All", ...(await CF.Store.bodyPartList())];

    page.innerHTML = `
      <div class="search-wrap">
        ${icon("search", "ic search-ic")}
        <input class="search-input" id="libSearch" type="search"
          placeholder="Search 422 exercises" autocomplete="off" autocapitalize="off">
      </div>
      <div class="chips is-filter" id="libCats">
        ${cats.map((c) => `<button class="chip ${c === state.category ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>
      ${parts.length > 1 ? `<div class="chips is-filter" id="libParts">
        ${parts.map((b) => `<button class="chip ${b === state.bodyPart ? "on" : ""}" data-part="${esc(b)}">${esc(b)}</button>`).join("")}
      </div>` : ""}
      <p class="count-line" id="libCount"></p>
      <div class="list" id="libList"></div>`;

    const list = page.querySelector("#libList");
    const count = page.querySelector("#libCount");
    const index = await CF.Store.exerciseIndex();

    function draw() {
      const q = state.query.trim().toLowerCase();
      const hits = index.filter((e) =>
        (state.category === "All" || e.category === state.category) &&
        (state.bodyPart === "All" || e.bodyParts.includes(state.bodyPart)) &&
        (!q || e.haystack.includes(q)));

      count.textContent = `${hits.length} exercise${hits.length === 1 ? "" : "s"}`;

      if (!hits.length) {
        list.innerHTML = `<p class="empty-note">Nothing matches those filters. Clear the search, or switch the category back to All.</p>`;
        return;
      }
      // Cap the rendered rows — 422 nodes on every keystroke is enough to
      // stutter on a phone, and nobody scrolls past a couple of hundred.
      const shown = hits.slice(0, 200);
      list.innerHTML = shown.map((e, i) => `
        <button class="card" data-i="${i}">
          <div class="card-top">
            <span class="card-title">${esc(e.name)}</span>
            <span class="tag moss">${esc(e.category)}</span>
          </div>
          ${e.instructions ? `<div class="card-sub clamp">${esc(e.instructions)}</div>` : ""}
        </button>`).join("") +
        (hits.length > shown.length
          ? `<p class="empty-note">Showing the first 200 of ${hits.length}. Narrow the search to see the rest.</p>` : "");

      list.querySelectorAll("[data-i]").forEach((b) =>
        b.addEventListener("click", () => showExercise(shown[Number(b.dataset.i)])));
    }

    page.querySelector("#libSearch").addEventListener("input", (e) => {
      state.query = e.target.value;
      draw();
    });
    page.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => {
      state.category = b.dataset.cat;
      page.querySelectorAll("[data-cat]").forEach((x) => x.classList.toggle("on", x === b));
      draw();
    }));
    page.querySelectorAll("[data-part]").forEach((b) => b.addEventListener("click", () => {
      state.bodyPart = b.dataset.part;
      page.querySelectorAll("[data-part]").forEach((x) => x.classList.toggle("on", x === b));
      draw();
    }));

    draw();
  };

  /** After the library changes, rebuild the list and reopen what was saved. */
  async function afterExerciseEdit(saved) {
    state.doc = await CF.Store.load();
    CF.Store.invalidateIndex();
    await render();
    if (!saved) return;
    const index = await CF.Store.exerciseIndex();
    const hit = index.find((e) => e.name === saved.name && e.category === saved.category);
    if (hit) showExercise(hit);
  }

  function showExercise(ex) {
    const photos = ex.photos || [];
    const legacy = ex.images || [];

    openDetail({
      title: ex.name,
      crumb: ex.category,
      actions: `<button class="icon-btn" id="exMenu" aria-label="Exercise actions">${icon("more")}</button>`,
      html: `
        ${ex.bodyParts.length ? `<div class="tag-row">${ex.bodyParts
          .map((b) => `<span class="tag">${esc(b)}</span>`).join("")}</div>` : ""}
        <div class="prose" style="margin-top:14px">
          ${ex.instructions ? `<p>${esc(ex.instructions)}</p>`
            : `<p style="color:var(--text-faint)">No instructions recorded for this one yet.</p>`}
        </div>
        ${photos.length ? `<div class="photo-grid" id="exViewPhotos">${photos
          .map((p) => `<div class="photo"><img alt="${esc(p.originalName || ex.name)}"
            data-name="${esc(p.storedName)}"></div>`).join("")}</div>` : ""}
        ${legacy.length && !photos.length ? `<p class="editor-hint">${legacy.length}
          older image reference${legacy.length === 1 ? "" : "s"} on this exercise
          (${esc(legacy.join(", "))}) — the files are not in the photo store.</p>` : ""}`,
      onReady: async (body, actions) => {
        for (const img of body.querySelectorAll("img[data-name]")) {
          const url = await CF.Library.photoUrl(img.dataset.name);
          if (url) img.src = url;
          else img.closest(".photo").classList.add("is-missing");
        }
        actions.querySelector("#exMenu").addEventListener("click", () => {
          openSheet(ex.name, (sheet) => {
            sheetItem(sheet, {
              label: "Edit", iconName: "rename",
              onClick: () => {
                closeSheet();
                CF.Library.editExercise(ex, afterExerciseEdit);
              },
            });
            sheetItem(sheet, {
              label: "Delete exercise", iconName: "trash", danger: true,
              onClick: () => {
                closeSheet();
                confirmAction({
                  title: `Delete “${ex.name}”?`,
                  note: "It stays in any circuit or session already using it, by name. This can't be undone.",
                  confirmLabel: "Delete",
                  onConfirm: () => CF.Library.deleteExercise(ex.name, ex.category, async () => {
                    state.doc = await CF.Store.load();
                    closeDetail();
                    render();
                  }),
                });
              },
            });
          });
        });
      },
    });
  }

  /** The dated record of changes made to a circuit or session over time. */
  function logSectionHtml(record) {
    const entries = record.logEntries || [];
    return `
      <p class="section-h">Post session notes</p>
      ${entries.length ? `<div class="log">${entries.map((e) => `
        <div class="log-entry" data-log="${esc(e.id)}">
          <div class="log-meta">
            ${e.title ? `<span class="log-title">${esc(e.title)}</span>` : ""}
            <span class="log-date">${esc(CF.Manage.formatLogDate(e.date))}</span>
          </div>
          <p class="log-text">${esc(e.text)}</p>
          <div class="row-tools">
            <button class="tool-btn" data-log-edit="${esc(e.id)}" aria-label="Edit note">${icon("rename")}</button>
            <button class="tool-btn is-danger" data-log-drop="${esc(e.id)}" aria-label="Remove note">${icon("trash")}</button>
          </div>
        </div>`).join("")}</div>`
        : `<p class="empty-note">Nothing written yet. Note what you changed and when, and it builds into a history of how this evolved.</p>`}
      <button class="secondary-btn add-btn" data-log-add>${icon("plus")}Add a note</button>`;
  }

  /** Wire the log controls. `reopen` redraws whichever detail is showing. */
  function wireLog(body, record, reopen) {
    const refresh = async () => {
      state.doc = await CF.Store.load();
      reopen();
    };
    const add = body.querySelector("[data-log-add]");
    if (add) add.addEventListener("click", () => CF.Manage.addLogEntry(record, refresh));

    body.querySelectorAll("[data-log-edit]").forEach((b) => b.addEventListener("click", () => {
      const entry = (record.logEntries || []).find((e) => e.id === b.dataset.logEdit);
      if (entry) CF.Manage.editLogEntry(record, entry, refresh);
    }));
    body.querySelectorAll("[data-log-drop]").forEach((b) => b.addEventListener("click", () => {
      confirmAction({
        title: "Remove this note?",
        note: "It goes from the record and from anything exported afterwards.",
        confirmLabel: "Remove",
        onConfirm: () => CF.Manage.deleteLogEntry(record, b.dataset.logDrop, refresh),
      });
    }));
  }

  /** Every tag in use in a collection, for the filter row. */
  function tagsIn(records) {
    const set = new Set();
    for (const r of records) (r.tags || []).forEach((t) => set.add(t));
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  const tagChipsHtml = (tags, active) => tags.length
    ? `<div class="filter-wrap">
        <div class="chips is-filter" id="tagFilter">
          ${["All", ...tags].map((t) => `
            <button class="chip ${t === active ? "on" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("")}
        </div>
        <button class="filter-more" id="tagMore" hidden>
          ${icon("down")}<span>Show all tags</span>
        </button>
      </div>`
    : "";

  /**
   * Show the expand control only when the row actually overflows. Measuring
   * beats guessing a tag count: it stays correct at any text size, window
   * width or number of tags.
   */
  let tagCheck = null, tagWired = false;
  function wireTagFilter(page, onPick) {
    const row = page.querySelector("#tagFilter");
    if (!row) return;
    const more = page.querySelector("#tagMore");

    const check = () => {
      const overflows = row.scrollHeight > row.clientHeight + 1;
      more.hidden = !overflows && !row.classList.contains("is-open");
    };
    // After layout, so scrollHeight is real.
    requestAnimationFrame(check);
    /* one window listener for the page on screen (the performance audit, 3 Nov): a fresh once-only listener on every visit
       kept each old page alive until the window happened to be resized */
    tagCheck = check;
    if (!tagWired) { tagWired = true; window.addEventListener("resize", () => { if (tagCheck) tagCheck(); }); }

    more.addEventListener("click", () => {
      const open = row.classList.toggle("is-open");
      more.classList.toggle("is-open", open);
      more.querySelector("span").textContent = open ? "Show fewer" : "Show all tags";
      if (!open) requestAnimationFrame(check);
    });

    row.querySelectorAll("[data-tag]").forEach((b) =>
      b.addEventListener("click", () => onPick(b.dataset.tag)));
  }

  const matchesTag = (record, active) =>
    active === "All" || (record.tags || []).includes(active);

  /** Tags shown on a record's detail, and the guides it links to. */
  function tagRowHtml(record) {
    const tags = record.tags || [];
    return tags.length
      ? `<div class="tag-row">${tags
          .map((t) => `<span class="tag moss">${esc(t)}</span>`).join("")}</div>`
      : "";
  }

  function linkedGuidesHtml(record) {
    const ids = record.guideIds || [];
    if (!ids.length) return "";
    const guides = state.doc.guides || [];
    const found = ids.map((id) => guides.find((g) => g.id === id)).filter(Boolean);
    if (!found.length) return "";
    return `
      <p class="section-h">Read first</p>
      <div class="list">${found.map((g) => `
        <button class="card" data-open-guide="${esc(g.id)}">
          <div class="card-top">${icon("guide")}
            <span class="card-title">${esc(g.name)}</span>${icon("chevron")}</div>
        </button>`).join("")}</div>`;
  }

  function wireGuideLinks(body) {
    body.querySelectorAll("[data-open-guide]").forEach((b) =>
      b.addEventListener("click", () => {
        const g = (state.doc.guides || []).find((x) => x.id === b.dataset.openGuide);
        if (g) showGuide(g);
      }));
  }

  /* ---- circuits -------------------------------------------------------- */

  VIEWS.circuits = async (page) => {
    const circuits = state.doc.circuits;
    const allTags = tagsIn(circuits);
    const active = state.tagFilter.circuits;
    page.innerHTML = `
      <div class="search-wrap">
        ${icon("search", "ic search-ic")}
        <input class="search-input" id="cSearch" type="search"
          placeholder="Search circuits" autocomplete="off" autocapitalize="off">
      </div>
      ${tagChipsHtml(allTags, active)}
      <p class="count-line" id="cCount"></p>
      <div class="list" id="cList"></div>`;

    wireTagFilter(page, (tag) => {
      state.tagFilter.circuits = tag;
      render();
    });

    const list = page.querySelector("#cList");
    const count = page.querySelector("#cCount");

    function draw() {
      const q = state.query.trim().toLowerCase();
      const hits = circuits.filter((c) => matchesTag(c, state.tagFilter.circuits)).filter((c) =>
        !q || c.name.toLowerCase().includes(q) ||
        (c.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        c.stations.some((s) => s.name.toLowerCase().includes(q)));

      count.textContent = `${hits.length} circuit${hits.length === 1 ? "" : "s"}`;
      if (!hits.length) {
        list.innerHTML = `<p class="empty-note">No circuit matches that.</p>`;
        return;
      }
      list.innerHTML = hits.map((c) => {
        const steps = CF.Timer.buildSchedule(c);
        const total = CF.Timer.totalDuration(steps);
        const rounds = Math.max(1, parseInt(c.rounds, 10) || 1);
        return `<button class="card" data-id="${esc(c.id)}">
          <div class="card-top">
            <span class="card-title">${esc(c.name)}</span>
            ${icon("chevron")}
          </div>
          <div class="card-sub">${c.stations.length} station${c.stations.length === 1 ? "" : "s"}
            &middot; ${rounds} round${rounds === 1 ? "" : "s"}
            ${total ? `&middot; ${CF.Timer.clock(total)}` : ""}
            ${c.type ? `&middot; ${esc(c.type)}` : ""}</div>
          ${(c.tags || []).length ? `<div class="tag-row">${(c.tags || [])
            .map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
        </button>`;
      }).join("");
      list.querySelectorAll("[data-id]").forEach((b) =>
        b.addEventListener("click", () => showCircuit(circuits.find((c) => c.id === b.dataset.id))));
    }

    page.querySelector("#cSearch").addEventListener("input", (e) => {
      state.query = e.target.value;
      draw();
    });
    draw();
  };

  function showCircuit(c) {
    const steps = CF.Timer.buildSchedule(c);
    const total = CF.Timer.totalDuration(steps);
    const timed = steps.some((s) => s.kind === "work");

    openDetail({
      title: c.name,
      print: {collection: "circuits", record: c},
      crumb: `${c.stations.length} stations · ${Math.max(1, parseInt(c.rounds, 10) || 1)} rounds${total ? ` · ${CF.Timer.clock(total)}` : ""}`,
      actions: `<button class="icon-btn" id="cMenu" aria-label="Circuit actions">${icon("more")}</button>`,
      html: `
        <button class="primary-btn" id="runBtn">${icon("play", "ic ic-fill")}
          ${timed ? "Run this circuit" : "Step through this circuit"}</button>
        ${c.timeCap || c.type ? `<p class="count-line" style="margin-top:12px">${
          [c.type && esc(c.type), c.timeCap && `${esc(c.timeCap)} time cap`]
            .filter(Boolean).join(" &middot; ")}</p>` : ""}
        ${tagRowHtml(c)}
        ${c.notes ? `<div class="notes-block">${icon("note")}<p>${esc(c.notes)}</p></div>` : ""}
        ${linkedGuidesHtml(c)}
        <p class="section-h">Stations</p>
        <div class="stations">
          ${c.stations.map((s, i) => `
            <div class="station">
              <span class="station-n">${i + 1}</span>
              <div class="station-main">
                <div class="station-name">${esc(s.name)}</div>
                <div class="station-meta">${stationMeta(s)}</div>
              </div>
            </div>`).join("")}
        </div>
        ${logSectionHtml(c)}`,
      onReady: (body, actions) => {
        wireGuideLinks(body);
        wireLog(body, c, () => showCircuit(c));
        body.querySelector("#runBtn").addEventListener("click", () => {
          CF.Timer.unlockAudio();
          startRunner(c);
        });
        actions.querySelector("#cMenu")
          .addEventListener("click", guard("Circuit menu", () => recordActions("circuits", c)));
      },
    });
  }

  function stationMeta(s) {
    const bits = [];
    if (s.category) bits.push(esc(s.category));
    if (s.workTime) bits.push(esc(s.workTime) + " work");
    if (s.reps) bits.push(esc(s.reps) + " reps");
    if (s.load) bits.push(esc(s.load));
    if (s.rest) bits.push(esc(s.rest) + " rest");
    return bits.join(" &middot; ") || "&mdash;";
  }

  /* ---- the runner ------------------------------------------------------ */

  function startRunner(circuit) {
    const host = document.createElement("div");
    host.className = "runner";
    host.innerHTML = `
      <div class="runner-head">
        <button class="icon-btn" id="rClose" aria-label="Stop and close">${icon("close")}</button>
        <span class="runner-name">${esc(circuit.name)}</span>
        ${circuit.notes ? `<button class="icon-btn" id="rNotes"
          aria-label="Circuit notes">${icon("note")}</button>` : ""}
      </div>
      <div class="runner-progress"><span id="rBar" style="width:0%"></span></div>
      <div class="runner-face" id="rFace">
        <div class="runner-phase" id="rPhase"></div>
        <div class="runner-clock" id="rClock">0:00</div>
        <div class="runner-station" id="rStation"></div>
        <div class="runner-detail" id="rDetail"></div>
        <div class="runner-next" id="rNext"></div>
      </div>
      <div class="runner-rounds" id="rRounds"></div>
      <div class="runner-controls">
        <button class="runner-btn" id="rPrev" aria-label="Previous step">${icon("prev", "ic ic-fill")}</button>
        <button class="runner-btn runner-btn-primary" id="rMain" aria-label="Start">${icon("play", "ic ic-fill")}</button>
        <button class="runner-btn" id="rNextBtn" aria-label="Next step">${icon("next", "ic ic-fill")}</button>
      </div>`;
    CF.uiRoot().appendChild(host);      /* not document.body — see bridge.js */

    const q = (id) => host.querySelector("#" + id);
    const timer = CF.Timer.create(circuit, { onTick: paint, onChange: paint, onFinish: onFinish });
    state.runner = {
      timer, host,
      main: () => q("rMain").click(),
      close: () => close(),
    };

    function paint(snap) {
      const s = snap.step;
      const face = q("rFace");

      if (!s) {
        face.className = "runner-face";
        q("rPhase").textContent = "Done";
        q("rClock").textContent = CF.Timer.clock(snap.totalDuration);
        q("rStation").textContent = circuit.name;
        q("rDetail").textContent = "Circuit complete.";
        q("rNext").textContent = "";
        q("rRounds").textContent = "";
        q("rBar").style.width = "100%";
        q("rMain").innerHTML = icon("check", "ic");
        q("rMain").setAttribute("aria-label", "Finished");
        return;
      }

      face.className = "runner-face is-" + s.kind;
      q("rPhase").textContent =
        s.kind === "work" ? "Work" : s.kind === "rest" ? "Rest" : "Reps — tap next when done";
      q("rClock").textContent = s.kind === "manual"
        ? (s.station.reps ? `${s.station.reps}` : "—")
        : CF.Timer.clock(snap.remaining);
      q("rStation").textContent = s.kind === "rest"
        ? (s.next ? `Next: ${s.next.name}` : "Rest")
        : s.station.name;

      const detail = [];
      if (s.kind !== "rest") {
        if (s.station.reps) detail.push(`${s.station.reps} reps`);
        if (s.station.load) detail.push(s.station.load);
        if (s.station.category) detail.push(s.station.category);
      }
      q("rDetail").textContent = detail.join(" · ");

      const upcoming = timer.steps[snap.index + 1];
      q("rNext").textContent = upcoming
        ? `Up next: ${upcoming.kind === "rest" ? "rest" : upcoming.station.name}`
        : "Last one";

      q("rRounds").textContent =
        `Round ${s.round} of ${s.rounds} · station ${s.index + 1} of ${s.stationCount}`;
      q("rBar").style.width =
        `${snap.totalDuration ? Math.min(100, snap.elapsed / snap.totalDuration * 100) : 0}%`;

      q("rMain").innerHTML = snap.running ? icon("pause") : icon("play", "ic ic-fill");
      q("rMain").setAttribute("aria-label", snap.running ? "Pause" : "Start");
    }

    function onFinish() { toast("Circuit complete"); }

    q("rMain").addEventListener("click", () => {
      const snap = timer.snapshot();
      if (snap.finished) { close(); return; }
      if (snap.step.kind === "manual") { CF.Timer.unlockAudio(); timer.advance(); return; }
      CF.Timer.unlockAudio();
      timer.toggle();
    });
    q("rNextBtn").addEventListener("click", () => timer.advance());
    q("rPrev").addEventListener("click", () => timer.back());
    q("rClose").addEventListener("click", close);

    /* Notes are reachable mid-circuit without stopping the clock — the point
       of a scaling or safety note is that it is needed while running it. */
    const notesBtn = q("rNotes");
    if (notesBtn) notesBtn.addEventListener("click", () => {
      openSheet(`${circuit.name} — notes`, (sheet) => {
        const p = document.createElement("p");
        p.className = "sheet-note";
        p.style.whiteSpace = "pre-wrap";
        p.textContent = circuit.notes;
        sheet.appendChild(p);
      });
    });

    function close() {
      timer.stop();
      host.remove();
      state.runner = null;
    }

    paint(timer.snapshot());
  }

  /* ---- sessions -------------------------------------------------------- */

  VIEWS.sessions = async (page) => {
    const sessions = state.doc.sessions;
    if (!sessions.length) {
      page.innerHTML = `<p class="empty-note">No sessions yet.</p>
        <button class="primary-btn" id="sFirst">${icon("plus")}Build a session</button>`;
      page.querySelector("#sFirst").addEventListener("click",
        () => CF.Builders.editSession(null, afterEdit("sessions")));
      return;
    }

    const allTags = tagsIn(sessions);
    const active = state.tagFilter.sessions;
    page.innerHTML = `
      <div class="search-wrap">
        ${icon("search", "ic search-ic")}
        <input class="search-input" id="sSearch" type="search"
          placeholder="Search sessions" autocomplete="off" autocapitalize="off">
      </div>
      ${tagChipsHtml(allTags, active)}
      <p class="count-line" id="sCount"></p>
      <div class="list" id="sList"></div>`;

    wireTagFilter(page, (tag) => {
      state.tagFilter.sessions = tag;
      render();
    });

    const list = page.querySelector("#sList");
    const count = page.querySelector("#sCount");

    function draw() {
      const q = state.query.trim().toLowerCase();
      const hits = sessions.filter((s) => matchesTag(s, active)).filter((s) =>
        !q || s.name.toLowerCase().includes(q) ||
        (s.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (s.items || []).some((i) => (i.name || "").toLowerCase().includes(q)));

      count.textContent = `${hits.length} session${hits.length === 1 ? "" : "s"}`;
      list.innerHTML = hits.length ? hits.map((s) => {
        const blocks = new Set((s.items || [])
          .map((i) => (i.block || "").replace(/\d+$/, "")).filter(Boolean));
        return `<button class="card" data-id="${esc(s.id)}">
          <div class="card-top"><span class="card-title">${esc(s.name)}</span>${icon("chevron")}</div>
          <div class="card-sub">${(s.items || []).length} exercise${
            (s.items || []).length === 1 ? "" : "s"}
            &middot; ${blocks.size} block${blocks.size === 1 ? "" : "s"}</div>
          ${(s.tags || []).length ? `<div class="tag-row">${(s.tags || [])
            .map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
        </button>`;
      }).join("") : `<p class="empty-note">Nothing matches that.</p>`;

      list.querySelectorAll("[data-id]").forEach((b) =>
        b.addEventListener("click", () => showSession(sessions.find((s) => s.id === b.dataset.id))));
    }

    page.querySelector("#sSearch").addEventListener("input", (e) => {
      state.query = e.target.value;
      draw();
    });
    draw();
  };

  /**
   * "3" becomes "3 sets"; "5 min", "AMRAP" and "3RM" are left alone, because
   * they already carry their own unit and appending one produces "5 min reps".
   * Singular where the count is one.
   */
  function qty(value, word) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    if (!/^\d+(\.\d+)?(\s*\/\s*\w+)?$/.test(text)) return esc(text);
    const plural = Number(text) === 1 ? word : `${word}s`;
    return `${esc(text)} ${plural}`;
  }

  /* Mirrors the exporter's mapping: A green, B amber, C rose, D blue and so
     on, with warm-up and cool-down neutral. Returns the CSS variable to use
     as this block's colour. */
  /* Warm-up and cool-down have their own colours rather than a letter's.
     They sit outside the A/B/C cycle on purpose — nothing inside them is
     paired — and their hues are chosen to stay clear of the letters
     actually in use. Same mapping as the Word exporter. */
  // Lives in blocks.js so Lens uses the same mapping; two copies would
  // drift and a session would be coloured one way in the app and another in
  // the window beside it.
  const blockColourVar = (block) => CF.Blocks.colourVar(block);

  function showSession(session) {
    // Blocks are labelled A1/A2/B1… — the letter groups them, the number
    // orders them within the group, which is how they're coached.
    const groups = new Map();
    for (const item of session.items) {
      const letter = (item.block || "?").replace(/\d+$/, "") || "?";
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter).push(item);
    }
    const notesHtml = tagRowHtml(session)
      + (session.notes
        ? `<div class="notes-block">${icon("note")}<p>${esc(session.notes)}</p></div>` : "")
      + linkedGuidesHtml(session);
    const blockName = (letter) =>
      letter === "W" ? "Warm-up" : letter === "Z" ? "Cool-down" : `Block ${letter}`;

    const html = notesHtml + [...groups.entries()].map(([letter, items]) => {
      const colour = blockColourVar(letter);
      const paired = items.length > 1 && letter !== "W" && letter !== "Z";
      return `
      <div style="--block-rgb: ${colour}">
        <p class="block-head">${esc(blockName(letter))}${
          paired ? ` <span class="block-note">alternate</span>` : ""}</p>
        <div class="stations ${paired ? "pair" : ""}">
          ${items.map((it) => `
            <div class="station">
              <span class="station-n">${esc(it.block || "")}</span>
              <div class="station-main">
                <div class="station-name">${esc(it.name)}</div>
                <div class="station-meta">${[
                  qty(it.sets, "set"),
                  qty(it.reps, "rep"),
                  it.load && esc(it.load),
                  it.rest && `${esc(it.rest)} rest`,
                  it.category && esc(it.category),
                ].filter(Boolean).join(" &middot; ") || "&mdash;"}</div>
              </div>
            </div>`).join("")}
        </div>
      </div>`;
    }).join("");

    openDetail({
      title: session.name,
      crumb: `${session.items.length} exercises`,
      print: {collection: "sessions", record: session},
      actions: `<button class="icon-btn" id="sMenu" aria-label="Session actions">${icon("more")}</button>`,
      html: html + logSectionHtml(session),
      onReady: (body, actions) => {
        wireGuideLinks(body);
        wireLog(body, session, () => showSession(session));
        actions.querySelector("#sMenu")
          .addEventListener("click", guard("Session menu", () => recordActions("sessions", session)));
      },
    });
  }

  /* ---- programs -------------------------------------------------------- */

  /* Sessions and Programs live in NeuroTrain from 10 Nov 2026 (Q19 q1: "Keep its
     guides, questionnaires, lesson plans, calculators and timer; hide its
     Sessions and Programs and link to NeuroTrain"). Only where NeuroTrain is
     installed: everywhere else the two tabs stay as they were. NeuroTrain
     reads this database (never writes it) and brings in what's new. */
  VIEWS.neurotrain = async (page) => {
    const sessions = (state.doc.sessions || []).length, programs = (state.doc.programs || []).length;
    page.innerHTML = `<div class="list"><div class="card" style="cursor:default">
      <div class="card-top"><span class="card-title">Sessions and programs are in NeuroTrain</span></div>
      <div class="card-sub">NeuroTrain is the training planner: phases and blocks on a coloured timeline, drag and drop, bulk updates and PDF exports. Super+Alt+T opens it.</div>
      <div class="card-sub">The ${sessions} session${sessions === 1 ? "" : "s"} and ${programs} program${programs === 1 ? "" : "s"} here stay as they are; NeuroTrain brings in anything new from its Settings.</div>
      <div class="card-sub">The calculators are there too (Q20 q1, 13 Nov 2026): the same eight, the same formulas and numbers.</div>
      <div style="margin-top:.8rem;display:flex;gap:.5rem;flex-wrap:wrap"><button class="primary-btn" id="ntOpen">Open NeuroTrain</button><button class="secondary-btn" id="ntCalc">Open its Calculators</button></div>
    </div></div>`;
    const open = async (pageName) => { const r = await CF.Store.openNeurotrain(pageName); if (r && r.error) toast(r.error); };
    page.querySelector("#ntOpen").addEventListener("click", () => open(""));
    page.querySelector("#ntCalc").addEventListener("click", () => open("calculators"));
  };

  VIEWS.programs = async (page) => {
    const programs = state.doc.programs || [];
    page.innerHTML = programs.length
      ? `<div class="list">${programs.map((p) => {
          const blocks = (p.mesocycles || []).length;
          const sessions = (p.mesocycles || [])
            .reduce((n, m) => n + CF.Programs.sessionsOf(m).length, 0);
          return `<button class="card" data-id="${esc(p.id)}">
            <div class="card-top"><span class="card-title">${esc(p.name)}</span>${icon("chevron")}</div>
            <div class="card-sub">${blocks} block${blocks === 1 ? "" : "s"}
              &middot; ${sessions} session${sessions === 1 ? "" : "s"}${p.durationMonths
                ? ` &middot; ${esc(p.durationMonths)} month${Number(p.durationMonths) === 1 ? "" : "s"}` : ""}</div>
          </button>`;
        }).join("")}</div>`
      : `<p class="empty-note">No programs yet. A program is a multi-block plan — mesocycles, their week-by-week intensity, and the sessions in each.</p>
         <button class="primary-btn" id="pFirst">${icon("plus")}Build a program</button>`;

    const first = page.querySelector("#pFirst");
    if (first) first.addEventListener("click", () => CF.Programs.edit(null, afterEdit("programs")));
    page.querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () =>
      showProgram(programs.find((p) => p.id === b.dataset.id))));
  };

  function showProgram(program) {
    if (!program) return;
    const overview = program.overview || {};
    const filled = CF.Programs.OVERVIEW_FIELDS
      .filter(([key]) => (overview[key] || "").trim());

    openDetail({
      title: program.name,
      print: {collection: "programs", record: program},
      crumb: `${(program.mesocycles || []).length} blocks${program.durationMonths
        ? ` · ${program.durationMonths} month${Number(program.durationMonths) === 1 ? "" : "s"}` : ""}`,
      actions: `<button class="icon-btn" id="pMenu" aria-label="Program actions">${icon("more")}</button>`,
      html: `
        ${filled.length ? `<p class="section-h">Overview</p>
          <div class="prose">${filled.map(([key, label]) =>
            `<p><b>${esc(label)}:</b> ${esc(overview[key])}</p>`).join("")}</div>` : ""}
        ${(program.mesocycles || []).map((meso) => {
          const sessions = CF.Programs.sessionsOf(meso);
          const weeks = meso.weeks || [];
          return `
            <p class="block-head">${esc(meso.name || "Mesocycle")}</p>
            ${weeks.length ? `<div class="table-scroll"><table class="out-table">
              <thead><tr><th>Week</th><th>RPE</th><th>RIR</th><th>Load</th></tr></thead>
              <tbody>${weeks.map((w) => `<tr>
                <td>${esc(w.weekNum ?? "")}</td><td>${esc(w.rpe ?? "")}</td>
                <td>${esc(w.rir ?? "")}</td>
                <td>${w.loadPercent ? `${esc(w.loadPercent)}%` : ""}</td>
              </tr>`).join("")}</tbody></table></div>` : ""}
            ${sessions.length ? `<div class="stations">${sessions.map((s, i) => `
              <div class="station">
                <span class="station-n">${i + 1}</span>
                <div class="station-main">
                  <div class="station-name">${esc(s.name || "Session")}</div>
                  <div class="station-meta">${(s.items || []).length} exercise${
                    (s.items || []).length === 1 ? "" : "s"}</div>
                </div>
              </div>`).join("")}</div>`
              : `<p class="empty-note">No sessions in this block.</p>`}`;
        }).join("")}`,
      onReady: (body, actions) => {
        actions.querySelector("#pMenu")
          .addEventListener("click", () => recordActions("programs", program));
      },
    });
  }

  /* ---- lesson plans ---------------------------------------------------- */

  VIEWS.lessonPlans = async (page) => {
    const plans = state.doc.lessonPlans || [];
    page.innerHTML = plans.length
      ? `<div class="list">${plans.map((p) => {
          const bits = [];
          if (p.date) bits.push(new Date(p.date + "T00:00:00").toLocaleDateString());
          if (p.location) bits.push(p.location);
          const refs = (p.refs || []).length;
          if (refs) bits.push(`${refs} attached`);
          if (p.layoutPhoto) bits.push("layout photo");
          return `<button class="card" data-id="${esc(p.id)}">
            <div class="card-top"><span class="card-title">${esc(p.name)}</span>${icon("chevron")}</div>
            <div class="card-sub">${bits.length ? esc(bits.join(" · ")) : "No details yet"}</div>
          </button>`;
        }).join("")}</div>`
      : `<p class="empty-note">No lesson plans yet. A plan gathers what a class needs: an overview, a photo of the layout, the sessions being run, and any notes.</p>
         <button class="primary-btn" id="lpFirst">${icon("plus")}Build a lesson plan</button>`;

    const first = page.querySelector("#lpFirst");
    if (first) first.addEventListener("click", () => CF.Lessons.edit(null, afterEdit("lessonPlans")));
    page.querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () =>
      showLessonPlan(plans.find((p) => p.id === b.dataset.id))));
  };

  function showLessonPlan(plan) {
    if (!plan) return;
    const bits = [];
    if (plan.date) bits.push(new Date(plan.date + "T00:00:00").toLocaleDateString());
    if (plan.location) bits.push(plan.location);

    openDetail({
      title: plan.name,
      print: {collection: "lessonPlans", record: plan},
      crumb: bits.join(" · "),
      actions: `<button class="icon-btn" id="lpMenu" aria-label="Plan actions">${icon("more")}</button>`,
      html: `
        ${plan.stores ? `<p class="count-line">Equipment: ${esc(plan.stores)}</p>` : ""}
        ${plan.overviewHtml ? `<div class="prose">${sanitize(plan.overviewHtml)}</div>` : ""}
        ${plan.layoutPhoto ? `<p class="section-h">Class layout</p>
          <div class="photo-grid"><div class="photo is-wide">
            <img alt="Class layout" data-name="${esc(plan.layoutPhoto.storedName)}">
          </div></div>` : ""}
        ${(plan.refs || []).length ? `<p class="section-h">Sessions and circuits</p>
          <div class="stations">${plan.refs.map((ref) => {
            const rec = ref[ref.type] || {};
            return `<div class="station">
              <span class="station-n">${icon(ref.type === "session" ? "session" : "circuit")}</span>
              <div class="station-main">
                <div class="station-name">${esc(rec.name || ref.type)}</div>
                <div class="station-meta">${ref.type === "session"
                  ? `${(rec.items || []).length} exercises`
                  : `${(rec.stations || []).length} stations`}</div>
              </div></div>`;
          }).join("")}</div>` : ""}
        ${(plan.textBoxes || []).map((box) => `
          <p class="block-head">${esc(box.title || "Note")}</p>
          <div class="prose">${sanitize(box.bodyHtml || "")}</div>`).join("")}`,
      onReady: async (body, actions) => {
        for (const img of body.querySelectorAll("img[data-name]")) {
          const url = await CF.Library.photoUrl(img.dataset.name);
          if (url) img.src = url;
          else img.closest(".photo").classList.add("is-missing");
        }
        actions.querySelector("#lpMenu")
          .addEventListener("click", () => recordActions("lessonPlans", plan));
      },
    });
  }

  /* ---- calendar -------------------------------------------------------- */

  VIEWS.calendar = async (page) => {
    const cals = state.doc.calendars;

    el.topbarActions.insertAdjacentHTML("afterbegin",
      `<button class="icon-btn" id="calMenu" aria-label="Calendar actions">${icon("more")}</button>`);
    el.topbarActions.querySelector("#calMenu")
      .addEventListener("click", guard("Calendar menu", () => calendarMenu()));

    if (!cals.length) {
      page.innerHTML = `<p class="empty-note">No calendars yet.</p>
        <button class="primary-btn" id="calFirst">${icon("plus")}Make a calendar</button>`;
      page.querySelector("#calFirst").addEventListener("click",
        () => CF.Manage.newCalendar(refreshAll));
      return;
    }

    if (!state.calendarId || !cals.some((c) => c.id === state.calendarId)) {
      state.calendarId = cals[0].id;
    }
    const cal = cals.find((c) => c.id === state.calendarId);

    // Records the entries point at, resolved once rather than per cell.
    const byId = new Map();
    state.doc.circuits.forEach((c) => byId.set(c.id, { type: "circuit", rec: c }));
    state.doc.sessions.forEach((x) => byId.set(x.id, { type: "session", rec: x }));

    const cursor = state.calendarMonth
      ? new Date(state.calendarMonth + "-01T00:00:00")
      : new Date();
    const year = cursor.getFullYear();
    const month = cursor.getMonth();

    page.innerHTML = `
      ${cals.length > 1 ? `<div class="chips">${cals.map((c) => `
        <button class="chip ${c.id === state.calendarId ? "on" : ""}"
          data-cal="${esc(c.id)}">${esc(c.name)}</button>`).join("")}</div>` : ""}
      <div class="month-head">
        <button class="icon-btn" id="mPrev" aria-label="Previous month">${icon("back")}</button>
        <span class="month-name">${cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button class="icon-btn" id="mNext" aria-label="Next month">${icon("chevron")}</button>
        <button class="secondary-btn month-today" id="mToday">Today</button>
      </div>
      <div class="month" id="month"></div>
      <button class="primary-btn" id="calAdd" style="margin-top:14px">${icon("plus")}Schedule something</button>
      <div id="dayList"></div>`;

    page.querySelectorAll("[data-cal]").forEach((b) => b.addEventListener("click", () => {
      state.calendarId = b.dataset.cal;
      render();
    }));

    const shiftMonth = (delta) => {
      const next = new Date(year, month + delta, 1);
      state.calendarMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
      render();
    };
    page.querySelector("#mPrev").addEventListener("click", () => shiftMonth(-1));
    page.querySelector("#mNext").addEventListener("click", () => shiftMonth(1));
    page.querySelector("#mToday").addEventListener("click", () => {
      state.calendarMonth = null;
      render();
    });
    page.querySelector("#calAdd").addEventListener("click", () => {
      CF.Manage.askDate("Schedule on", CF.Manage.todayIso(), (date) =>
        CF.Manage.schedule(cal, date, async () => {
          state.doc = await CF.Store.load();
          render();
        }));
    });

    drawMonth(page.querySelector("#month"), cal, year, month, byId);
    drawUpcoming(page.querySelector("#dayList"), cal, byId);
  };

  /* A real month grid: a coach reads a week shape at a glance, which an
     agenda list cannot show. Weeks start Monday, as the training week does. */
  function drawMonth(host, cal, year, month, byId) {
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7;          // Monday-first offset
    const days = new Date(year, month + 1, 0).getDate();
    const today = CF.Manage.todayIso();
    const entries = cal.entries || {};

    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(`<div class="day is-blank"></div>`);
    for (let d = 1; d <= days; d++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const list = entries[date] || [];
      cells.push(`
        <button class="day ${date === today ? "is-today" : ""} ${list.length ? "has-items" : ""}"
          data-date="${date}" aria-label="${d}, ${list.length} scheduled">
          <span class="day-n">${d}</span>
          <span class="day-dots">${list.slice(0, 3)
            .map((e) => `<span class="dot is-${esc(e.type)}"></span>`).join("")}</span>
        </button>`);
    }

    host.innerHTML =
      `<div class="dow">${["M", "T", "W", "T", "F", "S", "S"]
        .map((d) => `<span>${d}</span>`).join("")}</div>
       <div class="grid">${cells.join("")}</div>`;

    host.querySelectorAll("[data-date]").forEach((b) =>
      b.addEventListener("click", () => daySheet(cal, b.dataset.date, byId)));
  }

  /** What's on a given day, with the ways to change it. */
  function daySheet(cal, date, byId) {
    const list = (cal.entries || {})[date] || [];
    const refresh = async () => {
      state.doc = await CF.Store.load();
      await render();
    };

    openSheet(CF.Manage.formatDate(date), (body) => {
      if (!list.length) {
        const note = document.createElement("p");
        note.className = "sheet-note";
        note.textContent = "Nothing scheduled.";
        body.appendChild(note);
      }
      list.forEach((entry) => {
        const hit = byId.get(entry.refId);
        const b = sheetItem(body, {
          label: hit ? hit.rec.name : `A ${entry.type} that is no longer saved`,
          iconName: entry.type === "session" ? "session" : "circuit",
          onClick: () => {
            closeSheet();
            if (!hit) { toast("That record has been deleted."); return; }
            hit.type === "circuit" ? showCircuit(hit.rec) : showSession(hit.rec);
          },
        });
        const tools = document.createElement("span");
        tools.className = "sheet-item-tools";
        tools.innerHTML =
          `<button class="tool-btn" data-move aria-label="Move">${icon("move")}</button>` +
          `<button class="tool-btn is-danger" data-drop aria-label="Remove">${icon("trash")}</button>`;
        tools.querySelector("[data-move]").onclick = (e) => {
          e.stopPropagation();
          closeSheet();
          CF.Manage.askDate("Move to", date, (to) =>
            CF.Manage.moveEntry(cal, date, entry.id, to, refresh));
        };
        tools.querySelector("[data-drop]").onclick = (e) => {
          e.stopPropagation();
          closeSheet();
          CF.Manage.removeEntry(cal, date, entry.id, refresh);
        };
        b.appendChild(tools);
      });

      sheetItem(body, {
        label: "Add to this day", iconName: "plus",
        onClick: () => { closeSheet(); CF.Manage.schedule(cal, date, refresh); },
      });
    });
  }

  /** A short agenda under the grid — the grid shows shape, this shows detail. */
  function drawUpcoming(host, cal, byId) {
    const today = CF.Manage.todayIso();
    const dates = Object.keys(cal.entries || {}).sort().filter((d) => d >= today).slice(0, 8);
    if (!dates.length) {
      host.innerHTML = `<p class="empty-note">Nothing coming up.</p>`;
      return;
    }
    host.innerHTML = `<p class="section-h">Coming up</p>` + dates.map((date) => {
      const d = new Date(date + "T00:00:00");
      return `<div class="cal-day">
        <div class="cal-date ${date === today ? "is-today" : ""}">
          <div class="cal-dow">${d.toLocaleDateString(undefined, { weekday: "short" })}</div>
          <div class="cal-num">${d.getDate()}</div>
          <div class="cal-dow">${d.toLocaleDateString(undefined, { month: "short" })}</div>
        </div>
        <div class="cal-entries">
          ${cal.entries[date].map((entry) => {
            const hit = byId.get(entry.refId);
            return `<button class="card" data-ref="${esc(entry.refId)}">
              <div class="card-top"><span class="card-title">${
                hit ? esc(hit.rec.name) : "No longer saved"}</span>${icon("chevron")}</div>
              <div class="card-sub">${esc(entry.type)}</div></button>`;
          }).join("")}
        </div></div>`;
    }).join("");

    host.querySelectorAll("[data-ref]").forEach((b) => b.addEventListener("click", () => {
      const hit = byId.get(b.dataset.ref);
      if (!hit) return;
      hit.type === "circuit" ? showCircuit(hit.rec) : showSession(hit.rec);
    }));
  }

  /** Every month that has something scheduled, newest first, plus the month
      being viewed even if it is empty — printing a blank month to write on
      by hand is a reasonable thing to want. */
  function monthsWithEntries(cal) {
    const keys = Object.keys(cal.entries || {});
    const seen = new Map();
    for (const key of keys) {
      const m = key.match(/^(\d{4})-(\d{2})-\d{2}$/);
      if (!m) continue;
      const id = `${m[1]}-${m[2]}`;
      seen.set(id, (seen.get(id) || 0) + (cal.entries[key] || []).length);
    }
    const viewing = state.calendarMonth
      || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    if (!seen.has(viewing)) seen.set(viewing, 0);

    return [...seen.entries()]
      .map(([id, count]) => {
        const [y, m] = id.split("-").map(Number);
        return {
          id, y, m, count,
          label: new Date(y, m - 1, 1)
            .toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        };
      })
      .sort((a, b) => b.id.localeCompare(a.id));
  }

  /**
   * The exporter reads a calendar's chosen months from `printMonths`, and
   * expects each day's entry to carry the record itself rather than an id.
   * Stored entries only hold a refId, so a copy is built for printing —
   * resolved, month-filtered, and thrown away afterwards. The stored
   * calendar is never given a printMonths field it would then carry around.
   */
  function calendarPrintPayload(cal, months) {
    const byId = new Map();
    state.doc.circuits.forEach((c) => byId.set(c.id, { type: "circuit", rec: c }));
    state.doc.sessions.forEach((s) => byId.set(s.id, { type: "session", rec: s }));

    const entries = {};
    for (const [date, items] of Object.entries(cal.entries || {})) {
      if (!months.some((mo) => date.startsWith(mo.id + "-"))) continue;
      const resolved = items.map((item) => {
        const hit = byId.get(item.refId);
        return hit ? { ...item, [hit.type]: hit.rec } : { ...item };
      }).filter((item) => item.session || item.circuit);
      if (resolved.length) entries[date] = resolved;
    }

    return {
      ...cal,
      entries,
      printMonths: months.map((mo) => ({ y: mo.y, m: mo.m })),
    };
  }

  function chooseCalendarMonths(cal) {
    const months = monthsWithEntries(cal);
    const chosen = new Set([months[0] && months[0].id].filter(Boolean));

    openSheet(`Print ${cal.name}`, (sheet) => {
      const list = document.createElement("div");
      sheet.appendChild(list);

      const draw = () => {
        list.innerHTML = "";
        months.forEach((mo) => {
          const on = chosen.has(mo.id);
          const b = sheetItem(list, {
            label: mo.label,
            sub: mo.count
              ? `${mo.count} scheduled`
              : "nothing scheduled — prints as a blank month",
            iconName: on ? "check" : "calendar",
            onClick: () => {
              on ? chosen.delete(mo.id) : chosen.add(mo.id);
              draw();
            },
          });
          if (on) b.classList.add("is-on");
        });
      };
      draw();

      const row = document.createElement("div");
      row.className = "sheet-row";
      const cancel = document.createElement("button");
      cancel.className = "secondary-btn";
      cancel.textContent = "Cancel";
      cancel.onclick = closeSheet;
      const go = document.createElement("button");
      go.className = "primary-btn";
      go.textContent = "Continue";
      go.onclick = guard("Print", () => {
        if (!chosen.size) { toast("Pick at least one month."); return; }
        const picked = months.filter((mo) => chosen.has(mo.id));
        closeSheet();
        exportActions("calendars", calendarPrintPayload(cal, picked),
          `${cal.name} ${picked[picked.length - 1].label}`);
      });
      row.append(cancel, go);
      sheet.appendChild(row);
    });
  }

  function calendarMenu() {
    const cal = state.doc.calendars.find((c) => c.id === state.calendarId);
    const refresh = async () => { state.doc = await CF.Store.load(); render(); };
    openSheet(cal ? cal.name : "Calendars", (sheet) => {
      sheetItem(sheet, {
        label: "New calendar", iconName: "plus",
        onClick: () => { closeSheet(); CF.Manage.newCalendar(refresh); },
      });
      if (!cal) return;
      sheetItem(sheet, {
        label: "Rename", iconName: "rename",
        onClick: () => { closeSheet(); CF.Manage.renameCalendar(cal, refresh); },
      });
      if (CF.Store.isDesktop()) sheetItem(sheet, {
        label: "Print or export", iconName: "print",
        onClick: guard("Print", () => { closeSheet(); chooseCalendarMonths(cal); }),
      });
      sheetItem(sheet, {
        label: "Delete calendar", iconName: "trash", danger: true,
        onClick: () => {
          closeSheet();
          confirmAction({
            title: `Delete “${cal.name}”?`,
            note: "Everything scheduled on it goes too. This can't be undone.",
            confirmLabel: "Delete",
            onConfirm: () => CF.Manage.deleteCalendar(cal, refresh),
          });
        },
      });
    });
  }

  /* ---- guides ---------------------------------------------------------- */

  /** The guides carry rich HTML written in the desktop editor. It's Cam's
      own content, but it still gets parsed and stripped rather than dropped
      straight into innerHTML — scripts, styles, iframes and inline event
      handlers all come out. */
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    doc.body.querySelectorAll("script, style, iframe, object, embed, link, meta")
      .forEach((n) => n.remove());
    doc.body.querySelectorAll("*").forEach((node) => {
      [...node.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) node.removeAttribute(attr.name);
        if (name === "href" && /^\s*javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
      });
    });
    doc.body.querySelectorAll("table").forEach((t) => {
      const wrap = doc.createElement("div");
      wrap.className = "table-scroll";
      t.replaceWith(wrap);
      wrap.appendChild(t);
    });
    return doc.body.innerHTML;
  }

  VIEWS.guides = async (page) => {
    const guides = state.doc.guides;
    page.innerHTML = `
      <div class="search-wrap">
        ${icon("search", "ic search-ic")}
        <input class="search-input" id="gSearch" type="search" placeholder="Search guides" autocomplete="off">
      </div>
      <div class="list" id="gList"></div>`;
    const list = page.querySelector("#gList");

    function draw() {
      const q = state.query.trim().toLowerCase();
      const hits = guides.filter((g) =>
        !q || g.name.toLowerCase().includes(q) || (g.bodyHtml || "").toLowerCase().includes(q));
      list.innerHTML = hits.length ? hits.map((g) => {
        const text = (g.bodyHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return `<button class="card" data-id="${esc(g.id)}">
          <div class="card-top"><span class="card-title">${esc(g.name)}</span>${icon("chevron")}</div>
          ${text ? `<div class="card-sub clamp">${esc(text.slice(0, 160))}</div>` : ""}
        </button>`;
      }).join("") : `<p class="empty-note">No guide matches that.</p>`;

      list.querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () =>
        showGuide(guides.find((x) => x.id === b.dataset.id))));
    }
    page.querySelector("#gSearch").addEventListener("input", (e) => { state.query = e.target.value; draw(); });
    draw();
  };

  function showGuide(g) {
    if (!g) return;

    // The reverse of the link: what actually uses this guide. Useful when
    // deciding whether a guide is earning its place.
    const users = [
      ...(state.doc.sessions || []).map((r) => ({ r, kind: "sessions" })),
      ...(state.doc.circuits || []).map((r) => ({ r, kind: "circuits" })),
    ].filter(({ r }) => (r.guideIds || []).includes(g.id));

    openDetail({
      title: g.name,
      print: {collection: "guides", record: g},
      actions: `<button class="icon-btn" id="gMenu" aria-label="Guide actions">${icon("more")}</button>`,
      html: `<div class="prose">${sanitize(g.bodyHtml)}</div>
        ${users.length ? `<p class="section-h">Used by</p>
          <div class="list">${users.map(({ r, kind }) => `
            <button class="card" data-use="${esc(r.id)}" data-kind="${kind}">
              <div class="card-top">${icon(kind === "sessions" ? "session" : "circuit")}
                <span class="card-title">${esc(r.name)}</span>${icon("chevron")}</div>
            </button>`).join("")}</div>` : ""}`,
      onReady: (body, actions) => {
        body.querySelectorAll("[data-use]").forEach((b) =>
          b.addEventListener("click", () => {
            const list = state.doc[b.dataset.kind] || [];
            const record = list.find((x) => x.id === b.dataset.use);
            if (!record) return;
            b.dataset.kind === "sessions" ? showSession(record) : showCircuit(record);
          }));
        actions.querySelector("#gMenu")
          .addEventListener("click", () => recordActions("guides", g));
      },
    });
  }

  /* ---- questionnaires -------------------------------------------------- */

  VIEWS.questionnaires = async (page) => {
    const qs = state.doc.questionnaires;
    const filled = await CF.Store.responses();

    page.innerHTML = `
      <p class="section-h">Forms</p>
      <div class="list">${qs.map((q) => `
        <button class="card" data-id="${esc(q.id)}">
          <div class="card-top"><span class="card-title">${esc(q.name)}</span>${icon("chevron")}</div>
          <div class="card-sub">${q.questions.length} question${q.questions.length === 1 ? "" : "s"}</div>
        </button>`).join("")}</div>
      ${filled.length ? `<p class="section-h">Completed on this phone</p>
        <div class="list">${filled.map((r) => `
          <button class="card" data-resp="${esc(r.id)}">
            <div class="card-top"><span class="card-title">${esc(r.person || "Unnamed")}</span>${icon("chevron")}</div>
            <div class="card-sub">${esc(r.formName)} &middot; ${new Date(r.at).toLocaleDateString()}</div>
          </button>`).join("")}</div>` : ""}`;

    page.querySelectorAll("[data-id]").forEach((b) =>
      b.addEventListener("click", () => fillQuestionnaire(qs.find((q) => q.id === b.dataset.id))));
    page.querySelectorAll("[data-resp]").forEach((b) =>
      b.addEventListener("click", () => showResponse(filled.find((r) => r.id === b.dataset.resp))));
  };

  function fillQuestionnaire(form) {
    openDetail({
      title: form.name,
      crumb: `${form.questions.length} questions`,
      actions: `<button class="icon-btn" id="qMenu" aria-label="Questionnaire actions">${icon("more")}</button>`,
      html: `
        <div class="field"><label for="qPerson">Who is this for?</label>
          <input id="qPerson" autocomplete="name" placeholder="Name"></div>
        ${form.questions.map((q, i) => `
          <div class="q-item">
            <div class="q-text"><span class="q-num">${i + 1}.</span>${esc(q.text)}</div>
            ${q.type === "rating"
              ? `<div class="rating" data-rating="${i}" role="radiogroup" aria-label="Rating out of ten">
                   ${Array.from({ length: 10 }, (_, n) => `
                     <button class="rating-dot" data-value="${n + 1}" role="radio"
                       aria-checked="false">${n + 1}</button>`).join("")}
                 </div>
                 <input type="hidden" data-q="${i}" value="">`
              : `<textarea data-q="${i}" rows="2"></textarea>`}
          </div>`).join("")}
        <button class="primary-btn" id="qSave">${icon("check")}Save answers</button>
        <p class="sheet-note" style="padding-left:0">Saved on this device only. Export a backup to move it anywhere else.</p>`,
      onReady: (body, actions) => {
        actions.querySelector("#qMenu")
          .addEventListener("click", () => recordActions("questionnaires", form));

        body.querySelectorAll("[data-rating]").forEach((group) => {
          group.addEventListener("click", (e) => {
            const dot = e.target.closest(".rating-dot");
            if (!dot) return;
            group.querySelectorAll(".rating-dot").forEach((d) => {
              d.classList.remove("on");
              d.setAttribute("aria-checked", "false");
            });
            dot.classList.add("on");
            dot.setAttribute("aria-checked", "true");
            body.querySelector(`input[data-q="${group.dataset.rating}"]`).value = dot.dataset.value;
          });
        });

        body.querySelector("#qSave").addEventListener("click", async () => {
          const answers = [...body.querySelectorAll("[data-q]")].map((t, i) => ({
            text: form.questions[i].text,
            answer: t.value.trim(),
          }));
          if (!answers.some((a) => a.answer)) { toast("Nothing filled in yet."); return; }
          await CF.Store.addResponse({
            id: CF.Store.uid(),
            formId: form.id, formName: form.name,
            person: body.querySelector("#qPerson").value.trim(),
            at: new Date().toISOString(),
            answers,
          });
          closeDetail();
          toast("Answers saved");
          render();
        });
      },
    });
  }

  function showResponse(r) {
    if (!r) return;
    openDetail({
      title: r.person || "Unnamed",
      crumb: `${r.formName} · ${new Date(r.at).toLocaleString()}`,
      actions: `<button class="icon-btn" id="respMenu" aria-label="Actions">${icon("more")}</button>`,
      html: r.answers.map((a, i) => `
        <div class="q-item">
          <div class="q-text"><span class="q-num">${i + 1}.</span>${esc(a.text)}</div>
          <div class="card"><div class="card-sub" style="margin:0;color:var(--text)">${
            a.answer ? esc(a.answer) : "<span style='color:var(--text-faint)'>Not answered</span>"}</div></div>
        </div>`).join(""),
      onReady: (body, actions) => {
        actions.querySelector("#respMenu").addEventListener("click", () => {
          openSheet(r.person || "Response", (sheet) => {
            sheetItem(sheet, {
              label: "Delete this response", iconName: "trash", danger: true,
              onClick: () => {
                closeSheet();
                confirmAction({
                  title: "Delete response?", note: "This can't be undone.",
                  confirmLabel: "Delete",
                  onConfirm: async () => {
                    await CF.Store.deleteResponse(r.id);
                    closeDetail(); toast("Deleted"); render();
                  },
                });
              },
            });
          });
        });
      },
    });
  }

  /* ---- calculators ----------------------------------------------------- */

  VIEWS.calculators = async (page) => {
    CF.Calc.render(page, state.calcTab, (tab) => {
      state.calcTab = tab;
      CF.Store.setPref("calcTab", tab);
      VIEWS.calculators(page);
    });
  };

  /* ---- athletes and equipment ------------------------------------------ */

  /* The intervals the imported sessions actually use. Offered as presets so
     the common case is two taps, with a custom row for anything else. */
  const MAS_PRESETS = [
    { percent: 120, seconds: 15, label: "15/15 at 120%" },
    { percent: 110, seconds: 30, label: "30/30 at 110%" },
    { percent: 130, seconds: 5, label: "5/15 at 130%" },
    { percent: 125, seconds: 15, label: "15/15 at 125%" },
    { percent: 100, seconds: 60, label: "60s at 100%" },
  ];

  /**
   * A squad running sheet: every athlete's own distance for the prescribed
   * intervals. Athletes without a MAS result are left out rather than
   * printed as a zero — a blank row on the grass is worse than a short list.
   */
  function masSheet() {
    const chosen = new Set(["120-15"]);

    const build = () => {
      const athletes = (state.doc.athletes || []).map((a) => {
        const latest = CF.Manage.latestResult(a, "mas");
        return { name: a.name, mas: latest ? Number(latest.value) : 0 };
      });
      const intervals = MAS_PRESETS
        .filter((p) => chosen.has(`${p.percent}-${p.seconds}`))
        .map((p) => ({ percent: p.percent, seconds: p.seconds }));
      return { name: "MAS running sheet", athletes, intervals };
    };

    const withMas = (state.doc.athletes || [])
      .filter((a) => CF.Manage.latestResult(a, "mas")).length;
    const total = (state.doc.athletes || []).length;

    openSheet("MAS running sheet", (sheet) => {
      const note = document.createElement("p");
      note.className = "sheet-note";
      note.textContent = withMas
        ? `${withMas} of ${total} athletes have a MAS recorded. The rest are left off the sheet.`
        : "No athlete has a MAS recorded yet. Record one from an athlete's Results section first.";
      sheet.appendChild(note);
      if (!withMas) return;

      const list = document.createElement("div");
      sheet.appendChild(list);
      const draw = () => {
        list.innerHTML = "";
        MAS_PRESETS.forEach((p) => {
          const key = `${p.percent}-${p.seconds}`;
          const on = chosen.has(key);
          const b = sheetItem(list, {
            label: p.label, iconName: on ? "check" : "chart",
            onClick: () => {
              on ? chosen.delete(key) : chosen.add(key);
              draw();
            },
          });
          if (on) b.classList.add("is-on");
        });
      };
      draw();

      const row = document.createElement("div");
      row.className = "sheet-row";
      const cancel = document.createElement("button");
      cancel.className = "secondary-btn";
      cancel.textContent = "Cancel";
      cancel.onclick = closeSheet;
      const go = document.createElement("button");
      go.className = "primary-btn";
      go.textContent = "Print or export";
      go.onclick = guard("MAS sheet", () => {
        if (!chosen.size) { toast("Pick at least one interval."); return; }
        closeSheet();
        exportActions("masSheet", build(), "MAS running sheet");
      });
      row.append(cancel, go);
      sheet.appendChild(row);
    });
  }

  VIEWS.athletes = async (page) => {
    const refresh = async () => { state.doc = await CF.Store.load(); render(); };
    el.topbarActions.insertAdjacentHTML("afterbegin",
      `<button class="icon-btn" id="athSheet" aria-label="MAS running sheet">${icon("sheet-out")}</button>`);
    el.topbarActions.querySelector("#athSheet")
      .addEventListener("click", guard("MAS sheet", () => masSheet()));

    const list = state.doc.athletes;
    const groups = state.doc.groups || [];
    const groupName = (id) => (groups.find((g) => g.id === id) || {}).name;

    page.innerHTML = list.length
      ? `<div class="list">${list.map((a) => `
          <button class="card" data-id="${esc(a.id)}">
            <div class="card-top"><span class="card-title">${esc(a.name)}</span>${icon("chevron")}</div>
            <div class="card-sub">${(() => {
              const mas = CF.Manage.latestResult(a, "mas");
              return [
                mas ? `MAS ${Number(mas.value).toFixed(2)} m/s` : "no MAS recorded",
                `${(a.assignments || []).length} assigned`,
                a.email || null,
              ].filter(Boolean).map(esc).join(" &middot; ");
            })()}</div>
            ${(a.groupIds || []).length ? `<div class="tag-row">${(a.groupIds || [])
              .map((id) => groupName(id)).filter(Boolean)
              .map((n) => `<span class="tag">${esc(n)}</span>`).join("")}</div>` : ""}
          </button>`).join("")}</div>`
      : `<p class="empty-note">No athletes yet.</p>
         <button class="primary-btn" id="athFirst">${icon("plus")}Add an athlete</button>`;

    const first = page.querySelector("#athFirst");
    if (first) first.addEventListener("click", () => CF.Manage.editAthlete(null, refresh));
    page.querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () =>
      showAthlete(state.doc.athletes.find((a) => a.id === b.dataset.id))));
  };

  /** A result's change from the previous one, as an arrow and a figure. */
  function trendHtml(series) {
    const change = CF.Manage.resultChange(series);
    if (!change) return "";
    const sign = change.delta > 0 ? "+" : "";
    const figure = `${sign}${Math.abs(change.delta) < 1
      ? change.delta.toFixed(2) : change.delta.toFixed(1)}`;
    // A metric with no better direction (bodyweight, max HR) gets the figure
    // without a verdict attached to it.
    const tone = change.improved === null ? "is-flat"
      : change.improved ? "is-up" : "is-down";
    const arrow = change.delta > 0 ? "up-right" : "down-right";
    return `<span class="trend ${tone}">${icon(arrow)}${esc(figure)}${
      change.pct !== null ? ` <span class="trend-pct">${
        (change.pct > 0 ? "+" : "") + change.pct.toFixed(1)}%</span>` : ""}</span>`;
  }

  function resultsSectionHtml(athlete) {
    const series = CF.Manage.resultSeries(athlete);
    return `
      <p class="section-h">Results</p>
      ${series.length ? `<div class="list">${series.map((s) => {
        const latest = s.list[0];
        const name = (s.spec ? s.spec.name : s.metric) + (s.detail ? ` — ${s.detail}` : "");
        return `<button class="card result-card" data-series="${esc(s.metric)}::${esc(s.detail)}">
          <div class="card-top">
            <span class="card-title">${esc(name)}</span>
            <span class="result-value">${esc(String(latest.value))}
              <span class="result-unit">${esc(latest.unit || "")}</span></span>
          </div>
          <div class="card-sub">${esc(CF.Manage.formatLogDate(latest.date))}
            &middot; ${s.list.length} record${s.list.length === 1 ? "" : "s"}
            ${trendHtml(s)}</div>
        </button>`;
      }).join("")}</div>`
        : `<p class="empty-note">No results recorded. Test results entered here drive the MAS sheet and give every re-test something to compare against.</p>`}
      <button class="secondary-btn add-btn" id="aResult">${icon("chart")}Record a result</button>`;
  }

  /** The full history for one metric, with edit and delete. */
  function showResultHistory(athlete, metric, detail, refresh) {
    const series = CF.Manage.resultSeries(athlete)
      .find((s) => s.metric === metric && (s.detail || "") === (detail || ""));
    if (!series) return;
    const name = (series.spec ? series.spec.name : metric) + (detail ? ` — ${detail}` : "");

    openSheet(`${name} — ${athlete.name}`, (sheet) => {
      series.list.forEach((r) => {
        const row = sheetItem(sheet, {
          label: `${r.value} ${r.unit || ""}`.trim(),
          sub: CF.Manage.formatLogDate(r.date) + (r.note ? ` — ${r.note}` : ""),
          iconName: "chart",
          onClick: () => {},
        });
        const tools = document.createElement("span");
        tools.className = "sheet-item-tools";
        tools.innerHTML =
          `<button class="tool-btn" data-edit aria-label="Edit">${icon("rename")}</button>` +
          `<button class="tool-btn is-danger" data-drop aria-label="Remove">${icon("trash")}</button>`;
        tools.querySelector("[data-edit]").onclick = (e) => {
          e.stopPropagation();
          closeSheet();
          CF.Manage.editResult(athlete, r, refresh);
        };
        tools.querySelector("[data-drop]").onclick = (e) => {
          e.stopPropagation();
          closeSheet();
          CF.Manage.deleteResult(athlete, r.id, refresh);
        };
        row.appendChild(tools);
      });
    });
  }

  async function showAthlete(athlete) {
    if (!athlete) return;
    const refresh = async () => {
      state.doc = await CF.Store.load();
      await render();
      const fresh = state.doc.athletes.find((a) => a.id === athlete.id);
      if (fresh) showAthlete(fresh);
    };

    // Assignments are stored as ids; resolve each to whatever it points at so
    // one that has since been deleted shows as missing instead of blank.
    const resolved = [];
    for (const assignment of athlete.assignments || []) {
      resolved.push({ assignment, ...(await CF.Manage.resolveAssignment(assignment)) });
    }
    const groups = state.doc.groups || [];
    const names = (athlete.groupIds || [])
      .map((id) => (groups.find((g) => g.id === id) || {}).name).filter(Boolean);

    openDetail({
      title: athlete.name,
      print: {collection: "athletes", record: athlete},
      crumb: athlete.email || "",
      actions: `<button class="icon-btn" id="aMenu" aria-label="Athlete actions">${icon("more")}</button>`,
      html: `
        ${names.length ? `<div class="tag-row">${names
          .map((n) => `<span class="tag moss">${esc(n)}</span>`).join("")}</div>` : ""}
        ${athlete.notes ? `<div class="prose" style="margin-top:14px"><p>${esc(athlete.notes)}</p></div>` : ""}
        ${resultsSectionHtml(athlete)}
        <p class="section-h">Assigned work</p>
        ${resolved.length ? `<div class="list">${resolved.map((r, i) => `
          <div class="station">
            <span class="station-n">${icon(r.type === "session" ? "session" : "circuit")}</span>
            <div class="station-main">
              <div class="station-name">${r.record ? esc(r.record.name) : "No longer saved"}</div>
              <div class="station-meta">${esc(r.type)}${r.assignment.assignedDate
                ? ` &middot; ${new Date(r.assignment.assignedDate).toLocaleDateString()}` : ""}</div>
            </div>
            <button class="tool-btn is-danger" data-unassign="${i}" aria-label="Unassign">${icon("trash")}</button>
          </div>`).join("")}</div>`
          : `<p class="empty-note">Nothing assigned yet.</p>`}
        <button class="primary-btn" id="aAssign" style="margin-top:14px">${icon("plus")}Assign work</button>`,
      onReady: (body, actions) => {
        body.querySelector("#aAssign")
          .addEventListener("click", () => CF.Manage.assign(athlete, refresh));
        body.querySelector("#aResult")
          .addEventListener("click", () => CF.Manage.addResult(athlete, refresh));
        body.querySelectorAll("[data-series]").forEach((b) =>
          b.addEventListener("click", () => {
            const [metric, detail] = b.dataset.series.split("::");
            showResultHistory(athlete, metric, detail, refresh);
          }));
        body.querySelectorAll("[data-unassign]").forEach((b) =>
          b.addEventListener("click", () =>
            CF.Manage.unassign(athlete, Number(b.dataset.unassign), refresh)));

        actions.querySelector("#aMenu").addEventListener("click", () => {
          openSheet(athlete.name, (sheet) => {
            sheetItem(sheet, { label: "Edit details", iconName: "rename",
              onClick: () => { closeSheet(); CF.Manage.editAthlete(athlete, refresh); } });
            sheetItem(sheet, { label: "Groups", iconName: "people",
              onClick: () => { closeSheet(); CF.Manage.editMembership(athlete, refresh); } });
            if (CF.Store.isDesktop()) sheetItem(sheet, { label: "Print or export", iconName: "print",
              onClick: () => { closeSheet(); exportActions("athletes", athlete); } });
            sheetItem(sheet, {
              label: "Remove athlete", iconName: "trash", danger: true,
              onClick: () => {
                closeSheet();
                confirmAction({
                  title: `Remove “${athlete.name}”?`,
                  note: "Their assignments go too. This can't be undone.",
                  confirmLabel: "Remove",
                  onConfirm: () => CF.Manage.deleteAthlete(athlete, async () => {
                    state.doc = await CF.Store.load();
                    closeDetail();
                    render();
                  }),
                });
              },
            });
          });
        });
      },
    });
  }

  VIEWS.groups = async (page) => {
    const refresh = async () => { state.doc = await CF.Store.load(); render(); };
    const groups = state.doc.groups || [];
    const athletes = state.doc.athletes || [];
    const count = (id) => athletes.filter((a) => (a.groupIds || []).includes(id)).length;

    page.innerHTML = groups.length
      ? `<div class="list">${groups.map((g) => `
          <button class="card" data-id="${esc(g.id)}">
            <div class="card-top"><span class="card-title">${esc(g.name)}</span>${icon("more")}</div>
            <div class="card-sub">${count(g.id)} athlete${count(g.id) === 1 ? "" : "s"}</div>
          </button>`).join("")}</div>`
      : `<p class="empty-note">No groups yet. Groups let you tag athletes so they can be handled together.</p>
         <button class="primary-btn" id="grpFirst">${icon("plus")}Make a group</button>`;

    const first = page.querySelector("#grpFirst");
    if (first) first.addEventListener("click", () => CF.Manage.editGroup(null, refresh));

    page.querySelectorAll("[data-id]").forEach((b) => b.addEventListener("click", () => {
      const group = groups.find((g) => g.id === b.dataset.id);
      const members = athletes.filter((a) => (a.groupIds || []).includes(group.id));
      openSheet(group.name, (sheet) => {
        members.forEach((a) => sheetItem(sheet, {
          label: a.name, iconName: "people",
          onClick: () => { closeSheet(); go("athletes"); setTimeout(() => showAthlete(a), 220); },
        }));
        if (!members.length) {
          const note = document.createElement("p");
          note.className = "sheet-note";
          note.textContent = "Nobody in this group yet. Add people from an athlete's Groups menu.";
          sheet.appendChild(note);
        }
        sheetItem(sheet, { label: "Rename", iconName: "rename",
          onClick: () => { closeSheet(); CF.Manage.editGroup(group, refresh); } });
        sheetItem(sheet, {
          label: "Delete group", iconName: "trash", danger: true,
          onClick: () => {
            closeSheet();
            confirmAction({
              title: `Delete “${group.name}”?`,
              note: "Athletes stay; they just stop being in this group.",
              confirmLabel: "Delete",
              onConfirm: () => CF.Manage.deleteGroup(group, refresh),
            });
          },
        });
      });
    }));
  };

  VIEWS.equipment = async (page) => {
    const list = state.doc.equipment || [];
    page.innerHTML = list.length
      ? `<div class="list">${list.map((e, i) => `
          <button class="card" data-eq="${i}">
            <div class="card-top">${icon("kit")}
              <span class="card-title">${esc(e.name)}</span>${icon("more")}</div>
          </button>`).join("")}</div>`
      : `<p class="empty-note">No equipment listed. Use the + above to add what you have.</p>`;

    page.querySelectorAll("[data-eq]").forEach((b) => b.addEventListener("click", () => {
      const item = list[Number(b.dataset.eq)];
      openSheet(item.name, (sheet) => {
        sheetItem(sheet, { label: "Rename", iconName: "rename",
          onClick: () => { closeSheet(); CF.Manage.editEquipment(item, refreshAll); } });
        sheetItem(sheet, {
          label: "Remove", iconName: "trash", danger: true,
          onClick: () => {
            closeSheet();
            confirmAction({
              title: `Remove “${item.name}”?`, note: "This can't be undone.",
              confirmLabel: "Remove",
              onConfirm: () => CF.Manage.deleteEquipment(item, refreshAll),
            });
          },
        });
      });
    }));
  };

  /* ---- documents ------------------------------------------------------- */

  /** Bytes as something readable. Files here are attachments, not datasets,
      so a single decimal place is as much precision as is useful. */
  function fileSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  /* Set when the Documents view renders; the section + uses it. */
  let addDocumentFile = () => toast("Open Documents first.");

  VIEWS.documents = async (page) => {
    const refresh = async () => { state.doc = await CF.Store.load(); render(); };
    const onDesktop = CF.Store.isDesktop();

    async function addDocument() {
      const result = await CF.Store.addDocument();
      if (!result) return;
      if (result.error) { toast(result.error); return; }
      const doc = await CF.Store.load();
      doc.documents = doc.documents || [];
      doc.documents.push({
        id: CF.Manage.makeId(),
        originalName: result.originalName,
        storedName: result.storedName,
        size: result.size,
        addedDate: new Date().toISOString(),
      });
      await CF.Store.save();
      toast("File added");
      refresh();
    }

    const files = state.doc.documents || [];

    /* Categories are plain strings on the record, the same way tags are
       everywhere else in this app. Not a fixed list: a coaching library
       holds policies, forms, templates and scanned paperwork, and which of
       those matter is Cam's business rather than something to prescribe. */
    const categories = [...new Set(files.map((f) => (f.category || "").trim())
      .filter(Boolean))].sort((x, y) => x.localeCompare(y));

    if (!files.length) {
      page.innerHTML = `<p class="empty-note">${onDesktop
        ? "Nothing in the library yet. Anything you keep alongside your coaching — a policy, a consent form, a program template, a scanned certificate — can live here."
        : "Nothing in the library yet. Files are added and opened in the desktop app."}</p>
        ${onDesktop ? `<button class="primary-btn" id="docFirst">${icon("plus")}Add a file</button>` : ""}`;
      const first = page.querySelector("#docFirst");
      if (first) first.addEventListener("click", addDocument);
      addDocumentFile = addDocument;
      return;
    }

    page.innerHTML = `
      <div class="search-wrap">
        <svg class="ic search-ic" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-search"/></svg>
        <input id="docSearch" class="search-input" type="search"
          placeholder="Search the library" autocomplete="off"
          value="${esc(state.docQuery || "")}">
      </div>
      ${categories.length ? `<div class="chips is-filter" id="docCats">
        <button class="chip ${!state.docCategory ? "on" : ""}" data-cat="">All</button>
        ${categories.map((c) => `<button class="chip ${
          state.docCategory === c ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>` : ""}
      <p class="count-line" id="docCount"></p>
      <div id="docList"></div>`;

    const list = page.querySelector("#docList");
    const count = page.querySelector("#docCount");

    const draw = () => {
      const q = (state.docQuery || "").trim().toLowerCase();
      const hits = files.filter((f) => {
        if (state.docCategory && (f.category || "") !== state.docCategory) return false;
        if (!q) return true;
        // Name, category and note all searched: a scanned form is often
        // named something useless like "scan_0042.pdf", and the note is
        // where it actually says what it is.
        return [f.originalName, f.category, f.note]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      }).sort((x, y) => String(x.originalName).localeCompare(String(y.originalName)));

      count.textContent = `${hits.length} of ${files.length} file${
        files.length === 1 ? "" : "s"}`;

      list.innerHTML = hits.length
        ? `<div class="list">${hits.map((f) => `
            <button class="card" data-id="${esc(f.id)}">
              <div class="card-top">
                ${icon(docIcon(f.originalName))}
                <span class="card-title">${esc(f.originalName)}</span>
                ${icon("chevron")}
              </div>
              <div class="card-sub">${fileSize(f.size)}${f.addedDate
                ? ` &middot; added ${new Date(f.addedDate).toLocaleDateString()}` : ""}</div>
              ${f.note ? `<div class="card-sub">${esc(f.note)}</div>` : ""}
              ${f.category ? `<div class="tag-row"><span class="tag">${esc(f.category)}</span></div>` : ""}
            </button>`).join("")}</div>`
        : `<p class="empty-note">Nothing matches that.</p>`;

      list.querySelectorAll("[data-id]").forEach((b) =>
        b.addEventListener("click", () =>
          showDocument(files.find((f) => f.id === b.dataset.id), refresh)));
    };

    page.querySelector("#docSearch").addEventListener("input", (e) => {
      state.docQuery = e.target.value;
      draw();
    });
    page.querySelectorAll("[data-cat]").forEach((b) =>
      b.addEventListener("click", () => {
        state.docCategory = b.dataset.cat || null;
        render();
      }));

    draw();
    addDocumentFile = addDocument;
  };

  /** A rough icon by extension. Only the shapes this app already has. */
  function docIcon(name) {
    const ext = String(name || "").split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)) return "photo";
    if (["xlsx", "xls", "csv"].includes(ext)) return "table";
    return "file";
  }

  /* Opens in the detail pane like every other record in the Database, not
     in a sheet. A document is a record here — it has a name, a category and
     a note — and the one type that behaved differently was the one that
     felt broken. */
  function showDocument(file, refresh) {
    if (!file) return;

    openDetail({
      title: file.originalName,
      crumb: file.category || "Document",
      actions: `<button class="icon-btn" id="docMenu" aria-label="File actions">${icon("more")}</button>`,
      html: `
        <div class="doc-head">
          ${icon(docIcon(file.originalName), "ic doc-mark")}
          <div>
            <div class="doc-name">${esc(file.originalName)}</div>
            <div class="doc-meta">${fileSize(file.size)}${file.addedDate
              ? ` &middot; added ${new Date(file.addedDate).toLocaleDateString()}` : ""}</div>
          </div>
        </div>
        ${file.note ? `<div class="note-box">${esc(file.note)}</div>` : ""}
        ${file.category ? `<div class="tag-row"><span class="tag">${esc(file.category)}</span></div>` : ""}
        <div class="btn-row">
          <button class="primary-btn" id="docOpen">${icon("file")}Open the file</button>
          <button class="secondary-btn" id="docEdit">${icon("rename")}Details</button>
        </div>
        <p class="section-h">Where it lives</p>
        <p class="editor-hint">Files are copied into the vault, so moving or
          deleting the original does not affect this one.</p>
        <div class="mono-line" id="docPath">coach_cam_data/documents/${esc(file.storedName)}</div>`,

      onReady: (body, actions) => {
        const open = guard("Open", async () => {
          const result = await CF.Store.openDocument(file.storedName);
          if (result && result.error) toast(result.error);
        });
        body.querySelector("#docOpen").addEventListener("click", open);
        body.querySelector("#docEdit").addEventListener("click",
          guard("Details", () => editDocument(file, refresh)));

        actions.querySelector("#docMenu").addEventListener("click",
          guard("File menu", () => {
            openSheet(file.originalName, (sheet) => {
              sheetItem(sheet, { label: "Open", iconName: "file",
                onClick: () => { closeSheet(); open(); } });
              sheetItem(sheet, { label: "Details", iconName: "rename",
                onClick: () => { closeSheet(); editDocument(file, refresh); } });
              sheetItem(sheet, {
                label: "Remove", iconName: "trash", danger: true,
                onClick: () => {
                  closeSheet();
                  confirmAction({
                    title: `Remove “${file.originalName}”?`,
                    note: "The stored copy is deleted from disk. This can't be undone.",
                    confirmLabel: "Remove",
                    onConfirm: async () => {
                      const doc = await CF.Store.load();
                      doc.documents = (doc.documents || []).filter((f) => f.id !== file.id);
                      await CF.Store.save();
                      await CF.Store.dropDocument(file.storedName);
                      toast("Removed");
                      closeDetail();
                      refresh();
                    },
                  });
                },
              });
            });
          }));
      },
    });
  }

  function editDocument(file, refresh) {
    CF.Manage.formSheet({
      title: "File details",
      fields: [
        { key: "name", label: "Name", value: file.originalName },
        { key: "category", label: "Category", value: file.category || "",
          placeholder: "Policies, Forms, Templates…" },
        { key: "note", label: "What is it?", value: file.note || "",
          type: "textarea",
          placeholder: "optional — searched along with the name" },
      ],
      onConfirm: Object.assign(async (v) => {
        const doc = await CF.Store.load();
        const record = (doc.documents || []).find((f) => f.id === file.id);
        if (!record) return;
        // The name shown is the record's, not the file on disk: renaming
        // here must never touch the stored copy, or every other reference
        // to it would break.
        record.originalName = v.name;
        record.category = (v.category || "").trim();
        record.note = (v.note || "").trim();
        await CF.Store.save();
        toast("Saved");
        await refresh();
        // Reopen so the pane shows the new name rather than the old one.
        state.doc = await CF.Store.load();
        showDocument((state.doc.documents || []).find((f) => f.id === file.id),
                     refresh);
      }, { validate: (v) => (v.name.trim() ? null : "Give it a name.") }),
    });
  }

  /* ---- books ------------------------------------------------------------ */

  VIEWS.books = async (page) => {
    const books = state.doc.books || [];
    page.innerHTML = books.length
      ? `<div class="list">${books.map((b) => {
          const count = (b.entries || []).length;
          const missing = CF.Books.countMissing(state.doc, b);
          return `<button class="card" data-book="${esc(b.id)}">
            <div class="card-top">${icon("book")}
              <span class="card-title">${esc(b.name)}</span>${icon("chevron")}</div>
            <div class="card-sub">${count} item${count === 1 ? "" : "s"}${
              b.subtitle ? ` &middot; ${esc(b.subtitle)}` : ""}${
              missing ? ` &middot; ${missing} missing` : ""}</div>
          </button>`;
        }).join("")}</div>`
      : `<p class="empty-note">No books yet. A book gathers sessions, circuits, guides, exercises and programs into one printable document with a cover page.</p>
         <button class="primary-btn" id="bkFirst">${icon("plus")}Make a book</button>`;

    const first = page.querySelector("#bkFirst");
    if (first) first.addEventListener("click", () => CF.Books.edit(null, refreshAll));
    page.querySelectorAll("[data-book]").forEach((btn) =>
      btn.addEventListener("click", () =>
        showBook(books.find((b) => b.id === btn.dataset.book))));
  };

  function showBook(book) {
    if (!book) return;
    const entries = book.entries || [];
    const refresh = async () => {
      state.doc = await CF.Store.load();
      // Redraw the list too, not just the detail: the card behind it shows
      // the item count, which would otherwise sit there saying 0.
      await render();
      showBook((state.doc.books || []).find((b) => b.id === book.id));
    };

    openDetail({
      title: book.name,
      print: {collection: "books", label: book.name,
              record: () => CF.Books.withRecords(state.doc, book)},
      crumb: `${entries.length} item${entries.length === 1 ? "" : "s"}`,
      actions: `<button class="icon-btn" id="bkMenu" aria-label="Book actions">${icon("more")}</button>`,
      html: `
        <div class="book-cover">
          <img class="book-mark" id="bkMark" src="icons/icon-192.png" alt="">
          <div class="book-brand">${esc(CF.Books.brandOf(book))}</div>
          <div class="book-rule"></div>
          <div class="book-title">${esc(book.name)}</div>
          ${book.subtitle ? `<div class="book-sub">${esc(book.subtitle)}</div>` : ""}
        </div>
        <div class="btn-row">
          <button class="secondary-btn" id="bkLogo">${icon("photo")}${
            book.coverLogo ? "Change cover image" : "Use a different logo"}</button>
          ${book.coverLogo
            ? `<button class="secondary-btn" id="bkLogoClear">${icon("close")}Back to the app logo</button>`
            : ""}
        </div>
        <p class="editor-hint">That is the cover page, printed first. The logo
          and the name above the divider are this book's own — set them per
          book so a manual for one group is not branded as another's. Rename
          from the menu to change the cover name.</p>

        <p class="section-h">Contents</p>
        ${entries.length ? `<div class="stations">${entries.map((entry, i) => {
          const record = CF.Books.resolve(state.doc, entry);
          const type = CF.Books.typeOf(entry.type);
          // A printed book can only inline an image; other file types
          // print as a clearly marked reference. Saying so here is better
          // than the surprise appearing in the exported document.
          const flatFile = record && entry.type === "document"
            && !/\.(png|jpe?g|gif|bmp)$/i.test(record.storedName || "");
          return `<div class="station ${record ? "" : "is-missing-ref"}">
            <span class="station-n">${i + 1}</span>
            <div class="station-main">
              <div class="station-name">${record
                ? esc(record.name)
                : `<i>Missing — this ${esc(entry.type)} is no longer in the vault</i>`}</div>
              <div class="station-meta">${esc(type ? type.label : entry.type)}${
                flatFile ? " &middot; prints as a reference, not the file itself" : ""}</div>
            </div>
            <div class="row-tools">
              <button class="tool-btn" data-up="${i}" ${i === 0 ? "disabled" : ""}
                aria-label="Move up">${icon("up")}</button>
              <button class="tool-btn" data-down="${i}"
                ${i === entries.length - 1 ? "disabled" : ""}
                aria-label="Move down">${icon("down")}</button>
              <button class="tool-btn is-danger" data-drop="${i}"
                aria-label="Remove">${icon("trash")}</button>
            </div>
          </div>`;
        }).join("")}</div>`
          : `<p class="empty-note">Nothing in this book yet.</p>`}
        <button class="secondary-btn add-btn" id="bkAdd">${icon("plus")}Add something</button>`,

      onReady: async (body, actions) => {
        // A book's own cover image, if it has one. Falls back to the app
        // mark, which is already the src in the markup above.
        const mark = body.querySelector("#bkMark");
        if (book.coverLogo && book.coverLogo.storedName) {
          const url = await CF.Library.photoUrl(book.coverLogo.storedName);
          if (url) mark.src = url;
        }
        body.querySelector("#bkLogo").addEventListener("click",
          guard("Cover image", () => CF.Books.setLogo(book, refresh)));
        const clear = body.querySelector("#bkLogoClear");
        if (clear) clear.addEventListener("click",
          guard("Cover image", () => CF.Books.clearLogo(book, refresh)));

        body.querySelector("#bkAdd")
          .addEventListener("click", () => CF.Books.addEntry(book, refresh));
        body.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click",
          () => CF.Books.move(book, Number(b.dataset.up), -1, refresh)));
        body.querySelectorAll("[data-down]").forEach((b) => b.addEventListener("click",
          () => CF.Books.move(book, Number(b.dataset.down), 1, refresh)));
        body.querySelectorAll("[data-drop]").forEach((b) => b.addEventListener("click",
          () => CF.Books.removeEntry(book, Number(b.dataset.drop), refresh)));

        actions.querySelector("#bkMenu").addEventListener("click", guard("Book menu", () => {
          openSheet(book.name, (sheet) => {
            sheetItem(sheet, { label: "Rename", iconName: "rename",
              onClick: () => { closeSheet(); CF.Books.edit(book, refresh); } });
            if (CF.Store.isDesktop()) sheetItem(sheet, {
              label: "Print or export", iconName: "print",
              onClick: guard("Print", () => {
                closeSheet();
                // Entries are references; the exporter needs the records
                // themselves, resolved as they stand right now.
                exportActions("books", CF.Books.withRecords(state.doc, book), book.name);
              }),
            });
            sheetItem(sheet, {
              label: "Delete book", iconName: "trash", danger: true,
              onClick: () => {
                closeSheet();
                confirmAction({
                  title: `Delete “${book.name}”?`,
                  note: "The book goes. Everything inside it stays — a book only points at records.",
                  confirmLabel: "Delete",
                  onConfirm: () => CF.Books.remove(book, refreshAll),
                });
              },
            });
          });
        }));
      },
    });
  }

  function onSelectClick(e) {
    const card = e.target.closest(".card[data-id]");
    if (!card || !state.selectMode) return;
    const here = selectableHere();
    if (!here) return;
    e.preventDefault();
    e.stopPropagation();
    const title = card.querySelector(".card-title");
    toggleSelected(here.kind, card.dataset.id,
                   title ? title.textContent.trim() : "");
  }

  /* ---- picking several things and exporting them as one PDF ---------------

     Selection spans tabs on purpose: Cam asked to select sessions, programs,
     guides and circuits and export the lot, and those live in four different
     lists. So the selection is app-level state rather than per-view, and
     switching tabs keeps it.

     The mechanics are one delegated click handler rather than a checkbox
     added to four card renderers. Every list card already carries data-id,
     so while selecting, a click toggles instead of opening. That means
     adding a fifth selectable type later costs nothing. */

  //: Which tabs can be selected from, and what each record is called.
  const SELECTABLE = {
    sessions: { kind: "session", label: "Session", list: (d) => d.sessions || [] },
    circuits: { kind: "circuit", label: "Circuit", list: (d) => d.circuits || [] },
    guides: { kind: "guide", label: "Guide", list: (d) => d.guides || [] },
    programs: { kind: "program", label: "Program", list: (d) => d.programs || [] },
  };

  const selectableHere = () => SELECTABLE[state.view] || null;

  const isSelected = (kind, id) =>
    state.selection.some((s) => s.kind === kind && s.id === id);

  function toggleSelected(kind, id, name) {
    const at = state.selection.findIndex((s) => s.kind === kind && s.id === id);
    if (at === -1) state.selection.push({ kind, id, name });
    else state.selection.splice(at, 1);
    paintSelection();
    drawSelectionBar();
  }

  /** Mark the cards currently on screen, without re-rendering the list. */
  function paintSelection() {
    const here = selectableHere();
    if (!here) return;
    el.page.querySelectorAll(".card[data-id]").forEach((card) => {
      card.classList.toggle("is-picked",
        isSelected(here.kind, card.dataset.id));
    });
  }

  function setSelectMode(on) {
    state.selectMode = on;
    if (!on) state.selection = [];
    document.body.classList.toggle("is-selecting", on);
    render();
  }

  function drawSelectionBar() {
    let bar = document.getElementById("selBar");
    if (!state.selectMode) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "selBar";
      bar.className = "sel-bar";
      CF.uiRoot().appendChild(bar);     /* not document.body — see bridge.js */
    }
    const n = state.selection.length;
    const byKind = {};
    for (const s of state.selection) byKind[s.kind] = (byKind[s.kind] || 0) + 1;
    const summary = Object.entries(byKind)
      .map(([k, c]) => `${c} ${k}${c === 1 ? "" : "s"}`).join(" · ");

    bar.innerHTML = `
      <span class="sel-count">${n ? summary : "Nothing picked yet"}</span>
      <span class="sel-hint">Switch tabs to pick from other lists</span>
      <button class="secondary-btn" id="selClear" ${n ? "" : "disabled"}>Clear</button>
      <button class="primary-btn" id="selExport" ${n ? "" : "disabled"}>
        ${icon("pdf")}Export ${n || ""} as PDF</button>
      <button class="icon-btn" id="selDone" aria-label="Stop selecting">${icon("close")}</button>`;

    bar.querySelector("#selClear").addEventListener("click", () => {
      state.selection = [];
      paintSelection();
      drawSelectionBar();
    });
    bar.querySelector("#selDone").addEventListener("click", () => setSelectMode(false));
    bar.querySelector("#selExport").addEventListener("click",
      guard("Export", exportSelection));
  }

  async function exportSelection() {
    if (!state.selection.length) return;
    const doc = await CF.Store.load();

    // Resolved at export time, in the order they were picked, so the PDF
    // reflects what the vault says now rather than what it said when the
    // first card was clicked.
    const entries = [];
    const missing = [];
    for (const pick of state.selection) {
      const source = Object.values(SELECTABLE)
        .find((s) => s.kind === pick.kind);
      const record = source && source.list(doc).find((r) => r.id === pick.id);
      if (record) entries.push({ kind: pick.kind, record });
      else missing.push(pick.name || pick.id);
    }

    if (!entries.length) {
      toast("Nothing in that selection still exists.");
      return;
    }
    if (missing.length) {
      toast(`${missing.length} of those have been deleted — exporting the rest.`);
    }

    const name = entries.length === 1
      ? (entries[0].record.name || "Coaching")
      : `Coaching selection (${entries.length})`;
    const result = await CF.Store.exportSelection(entries, name);

    if (result === false) return;                       // the save box was cancelled
    if (typeof result === "string") { toast(result); return; }
    toast(`${entries.length} exported to one PDF`);
    setSelectMode(false);
  }

  /* ---- global search ---------------------------------------------------- */

  /*
   * Search reaches every record type, including those in sections hidden
   * from the sidebar. That is what makes hiding sections safe: nothing
   * becomes unreachable, only un-browsable.
   *
   * Opening a result shows the record in the detail pane without changing
   * section, so the results stay behind it and a hidden section never
   * appears in the sidebar as a side effect.
   */
  const OPEN_RESULT = {
    sessions: (r) => showSession(r),
    circuits: (r) => showCircuit(r),
    library: (r) => showExercise({
      name: r.name, category: r.category,
      instructions: r.instructions || "",
      bodyParts: r.bodyParts || [], photos: r.photos || [], images: r.images || [],
    }),
    guides: (r) => showGuide(r),
    questionnaires: (r) => fillQuestionnaire(r),
    programs: (r) => showProgram(r),
    lessonPlans: (r) => showLessonPlan(r),
    athletes: (r) => showAthlete(r),
    equipment: (r) => toast(r.name),
    documents: (r) => toast(r.originalName),
  };

  VIEWS.search = async (page) => {
    const query = state.globalQuery.trim();
    if (!query) {
      const labels = CF.Search.allLabels(state.doc).slice(0, 18);
      page.innerHTML = `
        <p class="count-line">Search names, notes and the text inside records.
          Start a word with <code>#</code> to match a tag, an exercise category
          or a body part — <code>#upper</code>, <code>#biceps</code>. Several
          terms narrow it down together.</p>
        ${labels.length ? `<p class="section-h">Try one of these</p>
          <div class="chips is-filter">${labels
            .map((l) => `<button class="chip" data-seed="${esc(l)}">#${esc(l)}</button>`).join("")}</div>` : ""}`;
      page.querySelectorAll("[data-seed]").forEach((b) =>
        b.addEventListener("click", () => {
          setGlobalQuery(`#${b.dataset.seed.split(/\s+/)[0]} `);
          el.globalSearch.focus();
        }));
      return;
    }

    const { groups, total } = CF.Search.run(state.doc, query);
    if (!total) {
      page.innerHTML = `<p class="empty-note">Nothing matches
        <b>${esc(query)}</b>. Tag terms match by the start of the word, so
        <code>#max</code> finds “Max strength”.</p>`;
      return;
    }

    page.innerHTML = `
      <p class="count-line">${total} match${total === 1 ? "" : "es"}</p>
      ${groups.map((g) => `
        <p class="section-h">${esc(g.type.label)}
          <span class="chip-count">${g.count}</span></p>
        <div class="list">
          ${g.hits.map((hit, i) => `
            <button class="card" data-type="${g.type.id}" data-i="${i}">
              <div class="card-top">${icon(g.type.icon)}
                <span class="card-title">${esc(hit.name)}</span>${icon("chevron")}</div>
              <div class="card-sub">${esc(g.type.sub(hit.record) || "")}</div>
              ${hit.labels.length ? `<div class="tag-row">${hit.labels.slice(0, 4)
                .map((l) => `<span class="tag">${esc(l)}</span>`).join("")}</div>` : ""}
            </button>`).join("")}
          ${g.more ? `<p class="empty-note">${g.more} more — narrow the search to see them.</p>` : ""}
        </div>`).join("")}`;

    page.querySelectorAll("[data-type]").forEach((b) =>
      b.addEventListener("click", guard("Open", () => {
        const group = groups.find((g) => g.type.id === b.dataset.type);
        const hit = group.hits[Number(b.dataset.i)];
        OPEN_RESULT[b.dataset.type](hit.record);
      })));
  };

  function setGlobalQuery(value) {
    state.globalQuery = value;
    el.globalSearch.value = value;
    el.globalClear.hidden = !value;
    drawSuggestions();
    if (value.trim() && state.view !== "search") {
      state.returnView = state.view;
      go("search");
    } else if (!value.trim() && state.view === "search") {
      go(state.returnView || "sessions");
    } else if (state.view === "search") {
      render();
    }
  }

  function drawSuggestions() {
    const suggestion = CF.Search.suggest(state.doc, state.globalQuery);
    if (!suggestion || !suggestion.options.length) {
      el.searchSuggest.hidden = true;
      return;
    }
    el.searchSuggest.innerHTML = suggestion.options.map((l) => `
      <button class="suggest-row" data-label="${esc(l)}">
        <span class="suggest-hash">#</span>${esc(l)}</button>`).join("");
    el.searchSuggest.hidden = false;
    el.searchSuggest.querySelectorAll("[data-label]").forEach((b) =>
      b.addEventListener("mousedown", (e) => {
        e.preventDefault();
        setGlobalQuery(CF.Search.complete(state.globalQuery, b.dataset.label));
        el.globalSearch.focus();
      }));
  }

  let searchTimer = null;
  el.globalSearch.addEventListener("input", (e) => {
    const value = e.target.value;
    el.globalClear.hidden = !value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setGlobalQuery(value), 160);
  });
  el.globalSearch.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!el.searchSuggest.hidden) { el.searchSuggest.hidden = true; return; }
      setGlobalQuery("");
      el.globalSearch.blur();
    }
    if (e.key === "Enter" && !el.searchSuggest.hidden) {
      const first = el.searchSuggest.querySelector("[data-label]");
      if (first) {
        e.preventDefault();
        setGlobalQuery(CF.Search.complete(state.globalQuery, first.dataset.label));
      }
    }
  });
  el.globalSearch.addEventListener("blur", () => {
    setTimeout(() => { el.searchSuggest.hidden = true; }, 120);
  });
  el.globalClear.addEventListener("click", () => {
    setGlobalQuery("");
    el.globalSearch.focus();
  });

  /* ---- settings -------------------------------------------------------- */

  const THEMES = [
    { id: "default", name: "Professional",
      note: "Warm slate and terracotta on cream. Calm, and the easiest to read in a bright room.",
      swatches: ["#F4F1EB", "#E8E3D9", "#536972", "#B87458"] },
    { id: "verdant", name: "Green on black",
      note: "The original. Dark, low glare.",
      swatches: ["#070A08", "#18211C", "#3E9E68", "#8FE3AE"] },
    { id: "aero", name: "Aero",
      note: "Windows 7's glassy blue on a light background. Gloss on the surfaces, flat measured colour on the text.",
      swatches: ["#E8EFF8", "#DCE8F6", "#1F5FA8", "#1C6E8C"] },
    { id: "win98", name: "Windows 98",
      note: "Grey chrome, navy selection, square corners and bevelled edges. The only theme that changes shape as well as colour.",
      swatches: ["#C0C0C0", "#D4D0C8", "#000080", "#FFFFFF"] },
    { id: "gelato", name: "Ice cream",
      note: "Strawberry, pistachio and blueberry on cream. Pastels fill; deepened versions of the same hues carry the text.",
      swatches: ["#FFF6F0", "#FDE9E4", "#B03A63", "#2F7D6B"] },
    { id: "contrast", name: "High contrast",
      note: "Yellow on black, heavier borders. Built for poor light and reading at distance.",
      swatches: ["#000000", "#171717", "#FFD400", "#FFFFFF"] },
    { id: "light", name: "Light green",
      note: "White and green, if you prefer the original palette on a light background.",
      swatches: ["#F7F9F7", "#E3EAE4", "#1F7A45", "#12211A"] },
  ];

  const TEXT_SIZES = [
    { id: "1", name: "Normal" },
    { id: "1.15", name: "Large" },
    { id: "1.3", name: "Larger" },
  ];

  /**
   * Applying a theme is only ever setting an attribute — every colour is a
   * variable, so nothing else has to change. The choice is mirrored into
   * localStorage as well as the vault, because the vault read is async and
   * the app would otherwise paint in the wrong theme before it returns.
   */
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme && theme !== "default") root.dataset.theme = theme;
    else delete root.dataset.theme;
    // Keep the OS-drawn surfaces in step with the app's own background.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content",
        getComputedStyle(root).getPropertyValue("--black").trim() || "#070A08");
    }
    try { localStorage.setItem("cc-theme", theme || "default"); } catch { /* private mode */ }
  }

  function applyTextScale(scale) {
    document.documentElement.style.setProperty("--text-scale", scale || "1");
    try { localStorage.setItem("cc-text-scale", scale || "1"); } catch { /* private mode */ }
  }

  VIEWS.settings = async (page) => {
    const theme = await CF.Store.getPref("theme", "default");
    const scale = String(await CF.Store.getPref("textScale", "1"));

    page.innerHTML = `
      <p class="section-h">Appearance</p>
      <div class="theme-grid">
        ${THEMES.map((t) => `
          <button class="theme-card ${t.id === theme ? "on" : ""}" data-theme-id="${t.id}">
            <span class="theme-name">${esc(t.name)}</span>
            <span class="theme-note">${esc(t.note)}</span>
            <span class="theme-swatches">${t.swatches
              .map((c) => `<span style="background:${c}"></span>`).join("")}</span>
          </button>`).join("")}
      </div>

      <p class="section-h">Text size</p>
      <div class="chips">
        ${TEXT_SIZES.map((s) => `
          <button class="chip ${s.id === scale ? "on" : ""}" data-scale="${s.id}">${esc(s.name)}</button>`).join("")}
      </div>
      <p class="editor-hint">Text size scales the whole interface, not just the
        words, so buttons and spacing grow with it.</p>

      <p class="section-h">Sections shown</p>
      <p class="editor-hint" style="margin:0 0 10px">Training's sections are
        NeuroNet subsections now, so they are turned on and off with all the
        others — Settings, at the bottom of the left menu. Whatever you had
        hidden here was carried over. Nothing is ever deleted by hiding it,
        and search still finds everything inside a hidden section.</p>

      <p class="section-h">Preview</p>
      <div class="card">
        <div class="card-top">
          <span class="card-title">Sample circuit</span>
          <span class="tag moss">AMRAP</span>
        </div>
        <div class="card-sub">8 stations &middot; 4 rounds &middot; 11:40</div>
      </div>
      <div class="btn-row">
        <button class="primary-btn">${icon("play", "ic ic-fill")}Primary action</button>
        <button class="secondary-btn">Secondary</button>
      </div>
      <p class="editor-hint">Changes apply straight away and are remembered.</p>

      <p class="section-h">About</p>
      <div class="calc">
        <table class="out-table"><tbody>
          <tr><td>Build</td><td>${APP_VERSION}</td></tr>
          <tr><td>Running as</td><td>${CF.Store.isDesktop() ? "Desktop app" : "Browser"}</td></tr>
        </tbody></table>
      </div>`;

    page.querySelectorAll("[data-theme-id]").forEach((b) =>
      b.addEventListener("click", async () => {
        applyTheme(b.dataset.themeId);
        await CF.Store.setPref("theme", b.dataset.themeId);
        render();
      }));

    /* The section toggles used to be wired here. They switched Training's
       own pill tabs on and off; the pills are gone and those destinations
       are NeuroNet subsections, hidden from NeuroNet's Settings like
       every other one. Two switches for one thing is how a setting ends
       up disagreeing with itself, so there is now one. */

    page.querySelectorAll("[data-scale]").forEach((b) =>
      b.addEventListener("click", async () => {
        applyTextScale(b.dataset.scale);
        await CF.Store.setPref("textScale", b.dataset.scale);
        render();
      }));
  };

  /* ---- backup ---------------------------------------------------------- */

  VIEWS.backup = async (page) => {
    const info = await CF.Store.meta();
    const responses = await CF.Store.responses();
    const onDesktop = CF.Store.isDesktop();

    page.innerHTML = `
      <p class="count-line">${onDesktop
        ? "Reading and writing coach_cam_data/coach_cam.json beside the app, the same file the original Coach Cam uses."
        : "Everything lives in this browser's own storage. Nothing is sent anywhere, so a backup is the only copy that survives the app being removed."}</p>
      <div class="calc">
        <h3>What's on here</h3>
        <table class="out-table"><tbody>
          <tr><td>Exercises</td><td>${countExercises()}</td></tr>
          <tr><td>Circuits</td><td>${state.doc.circuits.length}</td></tr>
          <tr><td>Sessions</td><td>${state.doc.sessions.length}</td></tr>
          <tr><td>Guides</td><td>${state.doc.guides.length}</td></tr>
          <tr><td>Questionnaires</td><td>${state.doc.questionnaires.length}</td></tr>
          <tr><td>Saved responses</td><td>${responses.length}</td></tr>
        </tbody></table>
        <p class="calc-hint" style="margin:12px 0 0">${onDesktop
          ? "Changes are written straight to disk."
          : `Loaded ${info.seededAt ? new Date(info.seededAt).toLocaleDateString() : "—"}.`}</p>
      </div>
      ${onDesktop ? `<div class="calc">
        <h3>Recent problems</h3>
        <p class="calc-hint">Anything that went wrong is written here and to
          <code>coach_cam_data/coach_cam.log</code>, which survives a restart.
          The panel above it records a heartbeat from both halves of the app,
          in <code>coach_cam_health.txt</code>. If the app stops responding,
          reopen it and send both.</p>
        <pre class="log-view" id="bHealth">Loading…</pre>
        <pre class="log-view" id="bLog">Loading…</pre>
        <div class="btn-row">
          <button class="secondary-btn" id="bLogCopy">${icon("copy")}Copy</button>
          <button class="secondary-btn" id="bLogClear">${icon("trash")}Clear</button>
        </div>
      </div>` : ""}
      <button class="primary-btn" id="bExport">${icon("backup")}Export a backup file</button>
      <div class="btn-row">
        <button class="secondary-btn" id="bRestore">${icon("restore")}Restore</button>
        <button class="secondary-btn" id="bReset">${icon("trash")}Reset</button>
      </div>`;

    if (onDesktop) {
      const healthBox = page.querySelector("#bHealth");
      CF.Store.readHealth().then((text) => {
        healthBox.textContent = (text || "").trim() || "No heartbeat recorded yet.";
      }).catch(() => { healthBox.textContent = "No heartbeat recorded yet."; });

      const logBox = page.querySelector("#bLog");
      const paint = async () => {
        const text = await CF.Store.readLog(80);
        logBox.textContent = text && text.trim()
          ? text.trim()
          : "Nothing logged. That is the good outcome.";
      };
      paint();
      page.querySelector("#bLogCopy").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(logBox.textContent);
          toast("Copied");
        } catch {
          toast("Couldn't copy — select the text instead.");
        }
      });
      page.querySelector("#bLogClear").addEventListener("click", async () => {
        await CF.Store.clearLog();
        paint();
        toast("Cleared");
      });
    }

    page.querySelector("#bExport").addEventListener("click", async () => {
      const payload = await CF.Store.exportAll();
      const name = `coach-cam-${new Date().toISOString().slice(0, 10)}.json`;
      if (onDesktop) {
        const saved = await CF.Store.writeBackupFile(name, JSON.stringify(payload, null, 2));
        toast(saved ? "Backup saved" : "Backup cancelled");
        return;
      }
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("Backup saved to your downloads");
    });

    page.querySelector("#bRestore").addEventListener("click", async () => {
      if (!onDesktop) { el.restoreInput.click(); return; }
      const text = await CF.Store.readBackupFile();
      if (!text) return;
      try {
        await CF.Store.restore(JSON.parse(text));
        state.doc = await CF.Store.load();
        toast("Backup restored");
        render();
      } catch (err) {
        toast(err.message || "That file couldn't be read.");
      }
    });

    page.querySelector("#bReset").addEventListener("click", () => {
      confirmAction({
        title: "Reset to the shipped data?",
        note: "Anything added or answered on this phone is discarded, and the library goes back to the version bundled with the app.",
        confirmLabel: "Reset",
        onConfirm: async () => {
          await CF.Store.resetToSeed();
          state.doc = await CF.Store.load();
          toast("Reset");
          render();
        },
      });
    });
  };

  el.restoreInput.addEventListener("change", async () => {
    const file = el.restoreInput.files[0];
    el.restoreInput.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      await CF.Store.restore(payload);
      state.doc = await CF.Store.load();
      toast("Backup restored");
      render();
    } catch (err) {
      toast(err.message || "That file couldn't be read.");
    }
  });

  /* ------------------------------------------------------------ resizing */

  /*
   * Column widths are two CSS variables, so dragging only has to write a
   * number — no layout code, and every rule that depends on the widths
   * (the detail pane's left edge, the resizer positions) follows for free.
   *
   * Widths are clamped so a column can never be dragged to nothing, and
   * remembered per install.
   */
  const LIMITS = {
    sidebar: { min: 190, max: 420, var: "--sidebar-w", pref: "sidebarWidth" },
    list:    { min: 260, max: 720, var: "--list-w",    pref: "listWidth" },
  };

  const clamp = (value, { min, max }) => Math.max(min, Math.min(max, Math.round(value)));

  function setWidth(which, px) {
    const limit = LIMITS[which];
    const value = clamp(px, limit);
    document.documentElement.style.setProperty(limit.var, `${value}px`);
    return value;
  }

  async function loadWidths() {
    for (const which of Object.keys(LIMITS)) {
      const stored = await CF.Store.getPref(LIMITS[which].pref, null);
      if (stored) setWidth(which, Number(stored));
    }
  }

  function wireResizer(id, which) {
    const handle = document.getElementById(id);
    if (!handle) return;
    const limit = LIMITS[which];

    // Where the column starts, so a drag can be measured from the window
    // edge rather than from wherever the pointer went down.
    /* MOVED FROM COACH CAM, with the pane's own offset added.

       This measures a drag from the window's left edge, which was right
       when Coach Cam owned the window. In KinCrux the training pane
       starts after KinCrux's own 216px sidebar, so every drag came out
       216px too wide and the divider jumped away from the pointer.

       The rest is unchanged: measuring from a fixed origin rather than
       from wherever the pointer went down is what stops the column
       drifting when you grab the handle slightly off-centre. */
    const paneLeft = () => {
      const pane = document.getElementById("cf-shell");
      return pane ? pane.getBoundingClientRect().left : 0;
    };

    const originOf = () => {
      if (which === "sidebar") return paneLeft();
      const collapsed = el.app.classList.contains("is-collapsed");
      if (collapsed) return paneLeft();
      return paneLeft() + (parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue("--sidebar-w")) || 0);
    };

    const onMove = (e) => {
      const x = (e.touches ? e.touches[0].clientX : e.clientX);
      setWidth(which, x - originOf());
    };

    const stop = async () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", stop);
      document.body.classList.remove("is-resizing");
      handle.classList.remove("is-dragging");
      const current = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue(limit.var));
      await CF.Store.setPref(limit.pref, current);
    };

    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      document.body.classList.add("is-resizing");
      handle.classList.add("is-dragging");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", stop);
    });

    // Keyboard, because a drag handle that only works with a mouse is not
    // reachable for everyone.
    handle.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 40 : 10;
      const current = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue(limit.var));
      if (e.key === "ArrowLeft") { e.preventDefault(); setWidth(which, current - step); }
      else if (e.key === "ArrowRight") { e.preventDefault(); setWidth(which, current + step); }
      else return;
      CF.Store.setPref(limit.pref,
        parseFloat(getComputedStyle(document.documentElement)
          .getPropertyValue(limit.var)));
    });

    // Double-click restores the default, which is the quickest way back from
    // a layout dragged somewhere unhelpful.
    handle.addEventListener("dblclick", async () => {
      document.documentElement.style.removeProperty(limit.var);
      await CF.Store.setPref(limit.pref, null);
    });
  }

  /* ------------------------------------------------------------ heartbeat */

  /* Ping the host on a timer. If the interface wedges, these stop while
     Python's own tick carries on, and the gap between the two in
     coach_cam_data/coach_cam_health.txt says which half stopped. */
  const HEARTBEAT_MS = 10000;

  function startHeartbeat() {
    let counter = 0;
    const beat = () => {
      /* only while Training is on screen: it diagnoses a wedged Training
         page, and pinging Python every 10 s all day did nothing else
         (2026-10-05) */
      const shell = document.getElementById("cf-shell");
      if (document.hidden || (shell && (shell.hidden || shell.offsetParent === null))) return;
      counter += 1;
      // Never let a failed ping surface as an error; it would be noise
      // exactly when something is already wrong.
      CF.Store.ping(counter, state.view).catch(() => {});
    };
    beat();
    setInterval(beat, HEARTBEAT_MS);
  }

  /* ----------------------------------------------------------------- boot */

  window.addEventListener("resize", () => {
    el.app.classList.toggle("is-collapsed", isWide() && state.collapsed);
    if (isSplit() && el.detail.hidden) closeDetail();
    if (!isSplit() && el.detail.hidden === false && !el.detailTitle.textContent) {
      el.detail.hidden = true;
    }
    if (isWide()) {
      el.sidebar.classList.remove("is-open");
      el.scrim.hidden = true;
      el.scrim.classList.remove("is-visible");
    }
  });

  document.addEventListener("keydown", (e) => {
    /* Training's keys are Training's only while Training is on screen.
       In Coach Cam this listener had the whole window to itself; inside
       NeuroNet it heard every key on every screen, so Escape blurred a
       field in Notes, Ctrl+F was swallowed on the dashboard, and 1-9
       anywhere threw. The runner lives inside the shell too, so a timer
       left running does not answer Space on another screen either. */
    const shell = document.getElementById("cf-shell");
    if (shell && shell.hidden) return;
    // The runner owns the keyboard while it's up.
    if (state.runner) {
      const r = state.runner;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); r.main(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); r.timer.advance(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); r.timer.back(); }
      else if (e.key === "Escape") { e.preventDefault(); r.close(); }
      return;
    }

    // An open editor owns the keyboard; number keys are being typed into it.
    if (CF.Lessons.isOpen()) {
      if (e.key === "Escape") CF.Lessons.close();
      return;
    }
    if (CF.Programs.isOpen()) {
      if (e.key === "Escape") CF.Programs.close();
      return;
    }
    if (CF.Library.isOpen()) {
      if (e.key === "Escape") CF.Library.close();
      return;
    }
    if (CF.Builders.isOpen()) {
      if (e.key === "Escape") CF.Builders.close();
      return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

    if (e.key === "Escape") {
      if (!el.sheetHost.hidden) closeSheet();
      else if (typing) document.activeElement.blur();
      else if (!el.detail.hidden && !isSplit()) closeDetail();
      return;
    }
    if (typing) return;

    if (e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f")) {
      const box = el.page.querySelector(".search-input");
      if (box) { e.preventDefault(); box.focus(); box.select(); }
      return;
    }
    // 1–9 jump straight to a section, in the order the sidebar lists them.
    /* Coach Cam's sidebar was its NAV list, which did not come across --
       every number key threw "NAV is not defined". The sidebar is
       NeuroNet's now, so the numbers follow the Training subsections as
       NeuroNet's menu actually shows them: its order, its hiding. */
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const items = [...document.querySelectorAll(
        '#ss-subnav-body [data-view^="training:"]')];
      const target = items[n - 1] && items[n - 1].dataset.view;
      if (target && window.SS && SS.go) SS.go(target);
    }
  });

  async function init() {
    state.doc = await CF.Store.load();
    applyTheme(await CF.Store.getPref("theme", "default"));
    await loadWidths();
    wireResizer("resizeSidebar", "sidebar");
    wireResizer("resizeList", "list");
    applyTextScale(String(await CF.Store.getPref("textScale", "1")));

    state.hiddenSections = await CF.Store.getPref("hiddenSections", null)
      || [...HIDDEN_BY_DEFAULT];

    /*
     * The document library was hidden by default in an earlier build, and
     * that choice was saved into prefs. Changing the default list did
     * nothing for anyone already running the app: their stored array still
     * named it, so it stayed hidden and looked missing.
     *
     * So it is unhidden once, and the fact that it has been done is
     * recorded. Without that flag this would re-show the library every
     * launch and fight anyone who hides it on purpose — a migration that
     * runs forever is not a migration, it is a bug with good intentions.
     */
    if (!(await CF.Store.getPref("docLibraryShown", false))) {
      const at = state.hiddenSections.indexOf("documents");
      if (at !== -1) {
        state.hiddenSections.splice(at, 1);
        await CF.Store.setPref("hiddenSections", state.hiddenSections);
      }
      await CF.Store.setPref("docLibraryShown", true);
    }
    state.collapsed = await CF.Store.getPref("collapsed", false);
    if ((await CF.Store.neurotrain()).installed) {      // Q19 q1: Sessions and Programs moved to NeuroTrain
      const db = SECTIONS.find((x) => x.id === "database"), plan = SECTIONS.find((x) => x.id === "plan");
      db.tabs = db.tabs.filter((t) => t.id !== "sessions");
      plan.tabs = plan.tabs.map((t) => (t.id === "programs" ? { id: "neurotrain", label: "NeuroTrain" } : t));
      const tools = SECTIONS.findIndex((x) => x.id === "tools");   // Q20 q1: the Calculators gave way to NeuroTrain's
      if (tools >= 0) SECTIONS.splice(tools, 1);
    }
    state.view = await CF.Store.getPref("view", "sessions");
    state.calcTab = await CF.Store.getPref("calcTab", "Strength");
    if (!VIEWS[state.view] || isHidden(state.view)
        || isHidden(sectionOf(state.view).id)
        || !SECTIONS.some((x) => x.tabs.some((t) => t.id === state.view))) {   // a tab that went (NeuroTrain's)
      const first = visibleSections()[0];
      state.view = first ? first.tabs[0].id : "settings";
    }
    el.app.classList.toggle("is-collapsed", isWide() && state.collapsed);

    const info = await CF.Store.meta();
    el.dataStamp.textContent = info.kind === "desktop"
      ? "coach_cam_data on disk"
      : (info.seededAt ? `Data loaded ${new Date(info.seededAt).toLocaleDateString()}` : "Local storage");

    await render();

    /* A start line gives every later entry a session to belong to, and makes
       a log that ends mid-session visibly a crash rather than a quiet one. */
    if (CF.Store.isDesktop()) {
      CF.Store.logError(
        `--- started, build ${APP_VERSION}, view=${state.view} ---`).catch(() => {});
      startHeartbeat();
    }

    // The service worker is what makes the browser build installable and
    // offline. In the desktop shell there is no server to register against,
    // and the files are already local, so it is skipped.
    if (!CF.Store.isDesktop() && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  /* MOVED FROM COACH CAM. One line changed in 3,519.

     Coach Cam called init() here, at parse time, because its own
     index.html was already on screen. In KinCrux this file loads with
     the rest of the app, long before the training shell is mounted, so
     every el.* lookup would come back null and init() would throw on
     its first line.

     So the boot is handed to the host instead, and the training bridge
     calls it once, after it has put the shell markup on the page.
     Everything else in this file is Coach Cam's, unchanged. */
  window.CF = window.CF || {};
  window.CF.Shell = {
    init,
    render,
    booted: false,
    /* one saved record, shown as its list shows it (NeuroNet's Find,
       2026-10-06) -- false if it isn't there */
    open(kind, id) {
      const rec = ((state.doc && state.doc[kind]) || []).find((r) => r.id === id);
      if (!rec || !SHOW[kind]) return false;
      if (VIEWS[kind] && state.view !== kind) go(kind);
      SHOW[kind](rec);
      return true;
    },
    /* which view is open. The host needs this to lay the pane out:
       some of Coach Cam's views have no detail column at all. */
    get view() { return state.view; },
  };
})();
