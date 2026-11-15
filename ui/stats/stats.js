/* ==========================================================================
   App stats — Settings → App stats.

   Cam: "In Settings menu an application stats panel that breaks down what is
   in the app and how much ... Any other stats along these lines as well,
   this will help me collect data on most used features and help direct
   future adaptations of the app. This data should also be able to be
   exported into excell, a doc or imported into the in app boards feature
   with a chart. I will use this to build a powerpoint to present."

   Two halves:

   THE TRACKER. Time in the app, time in each section, and time music played
   had never been written down, so they start being counted here. Every five
   seconds: if NeuroNet is on screen IN FRONT (its window has the focus) and
   Cam has clicked, typed or scrolled in the last five minutes, those five
   seconds count, against whichever section is open; if music is playing,
   they count as music whether or not anyone is at the keyboard.
   Focus, not just "not hidden": the quick popup is put away on a hidden
   workspace, which the page never hears about, so every quick look went on
   counting for up to five minutes after it closed (Cam, 2026-10-02: "only
   count the stats when the specific tool is actually active on screen.
   Otherwise the data will be skewed"). Putting the popup away, or clicking
   another window, takes the focus -- and the counting stops there.
   The total goes to the backend about once a minute (app_stats.py), so a
   crash costs a minute at most.

   THE PANEL. What is in the app is counted fresh from the data files each
   time it opens. The panel builds one MODEL -- titled groups of labelled
   rows, plus the charts -- and draws it; Excel and Word are built from that
   same model, and so is the board. What the screen says is what the slide
   says.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "App stats");
  const toast = (m, k) => SS.shared && SS.shared.toast(m, k);

  /* ---- the tracker ------------------------------------------------------ */

  const TICK = 5;                      // seconds
  const IDLE_AFTER = 5 * 60 * 1000;    // no input this long: not "in the app"
  const FLUSH_EVERY = 60 * 1000;

  let lastInput = Date.now();
  let pending = fresh();
  let inFront = true;               // NeuroNet's window has the focus

  /** Whether this tick counts as time in the app. */
  function onScreen() {
    const focused = inFront && (typeof document.hasFocus !== "function" || document.hasFocus());
    return document.visibilityState !== "hidden" && focused
      && Date.now() - lastInput < IDLE_AFTER;
  }

  function fresh() { return {seconds: 0, musicSeconds: 0, sections: {}}; }

  const localDay = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${
      String(d.getDate()).padStart(2, "0")}`;
  };

  function tick() {
    if (onScreen()) {
      pending.seconds += TICK;
      const where = SS.where ? SS.where() : null;
      const section = where && where.section;
      if (section) pending.sections[section] = (pending.sections[section] || 0) + TICK;
    }
    const player = SS.Music && SS.Music.Player;
    if (player && player.playing) pending.musicSeconds += TICK;
  }

  /** Hands what has built up to the backend. What is sent is taken out of
      `pending` first, so a slow reply can never send the same minute twice. */
  async function flush() {
    if (!pending.seconds && !pending.musicSeconds) return;
    const out = Object.assign(pending, {day: localDay()});
    pending = fresh();
    await call("usage_record", [out], "Recording usage");
  }

  function startTracker() {
    for (const ev of ["pointerdown", "keydown", "wheel", "pointermove", "touchstart"]) {
      window.addEventListener(ev, () => { lastInput = Date.now(); },
                              {passive: true, capture: true});
    }
    window.addEventListener("blur", () => { inFront = false; });
    window.addEventListener("focus", () => { inFront = true; lastInput = Date.now(); });
    setInterval(tick, TICK * 1000);
    setInterval(flush, FLUSH_EVERY);
    window.addEventListener("pagehide", flush);
    call("usage_launch", [], "Recording a launch");
  }

  /* ---- numbers into words ----------------------------------------------- */

  function duration(secs) {
    const s = Math.round(secs || 0);
    if (!s) return "None yet";
    if (s < 60) return "Under a minute";
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (!h) return `${m} min`;
    if (h >= 100) return `${h.toLocaleString()} hours`;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const num = (n) => Number(n || 0).toLocaleString();
  const minutes = (secs) => Math.round((secs || 0) / 60);
  const longDate = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d.toLocaleDateString(undefined,
      {day: "numeric", month: "long", year: "numeric"}) : "";
  };

  /* Printed and exported things, by the `kind` each print button sends.
     Every kind is listed even at 0 -- "Printed Programs: 0" is a finding
     too -- and a kind not listed here still shows, under its own name. */
  const PRINT_KINDS = [
    ["recipe", "Recipes"], ["recipe-book", "Recipe books"],
    ["shopping-list", "Shopping lists"],
    ["training-session", "Sessions"], ["training-circuit", "Circuits"],
    ["training-program", "Programs"], ["training-log", "Training logs"], ["training-book", "Training books"], ["money-book", "Money books"],
    ["training-guide", "Training guides"], ["training-lessonplan", "Lesson plans"],
    ["training-calendar", "Training calendars"], ["training-athlete", "Athlete profiles"],
    ["training-questionnaire", "Questionnaires"],
    ["puzzle-book", "Puzzle books"], ["word-search", "Word searches"],
    ["note-book", "Note books"], ["notes-guide", "Guides (Notes)"],
    ["stuff-media", "Media lists"], ["stuff-inventory", "Inventories"],
    ["personal-effects", "Personal effects"],
    ["money-sheet", "Money sheets"], ["money-calculation", "Money calculations"],
    ["paper", "Paper"], ["cover", "Notebook covers"], ["scrapbook", "Scrapbook pages"],
    ["app-stats", "App stats"],
  ];
  const EXPORT_NAMES = {
    "stats-xlsx": "App stats to Excel", "stats-docx": "App stats to Word",
    "guidebook-pdf": "Guidebooks to PDF",
    "fleeting-pdf": "Fleeting notes to PDF",
  };
  const PUZZLE_WIDGET = {sudoku: "Sudoku", kakuro: "Kakuro", mines: "Minesweeper",
                         words: "Word search"};

  const gameName = (key) => {
    const games = (window.CR && window.CR.GAMES) || [];
    const g = games.find((x) => x.key === key);
    return g ? g.name : key.charAt(0).toUpperCase() + key.slice(1);
  };
  const sectionName = (key) => (SS.sectionName && SS.sectionName(key))
    || key.charAt(0).toUpperCase() + key.slice(1);
  const titleCase = (k) => k.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  /* ---- the model -------------------------------------------------------- */

  /** Everything the panel, the exports and the board show. Rows are
      [label, as shown, the plain number] -- Excel gets the number, so a
      column of them still adds up. */
  function buildModel(raw) {
    const c = raw.content || {}, u = raw.usage || {}, pz = raw.puzzles || {};
    const counts = u.counts || {};
    const days = Object.keys(u.days || {}).filter((d) => u.days[d] > 0);
    const since = longDate(u.since);

    const dashboardSolved = Object.entries(counts)
      .filter(([k]) => k.startsWith("puzzle:dashboard-"));
    const dashboardTotal = dashboardSolved.reduce((s, [, n]) => s + n, 0);

    /* Music is part of M&T since 2026-10-02: time kept under "music"
       before then counts as M&T's ("stuff"). */
    const merged = {};
    for (const [k, s] of Object.entries(u.sections || {})) {
      const key = k === "music" ? "stuff" : k;
      merged[key] = (merged[key] || 0) + (Number(s) || 0);
    }
    const sections = Object.entries(merged)
      .filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
    const sectionTotal = sections.reduce((s, [, v]) => s + v, 0) || 1;

    const row = (label, value, shown) => [label, shown != null ? shown : num(value), value];
    const dur = (label, secs) => [label, duration(secs), minutes(secs)];

    const groups = [
      {title: "Usage", note: since ? `Recorded since ${since}` : "Recording starts now", rows: [
        dur("Time in the app", u.seconds),
        row("App launches", u.launches),
        row("Days used", days.length),
        dur("Average per day used", days.length ? u.seconds / days.length : 0),
        dur("Time music played", u.musicSeconds),
        dur("Time spent on puzzles", pz.seconds),
      ]},
      {title: "Time by section", note: since ? `Since ${since}` : "", rows: sections.map(([k, s]) =>
        [sectionName(k), `${duration(s)} (${Math.round((s / sectionTotal) * 100)}%)`, minutes(s)])},
      {title: "Photos & music", rows: [
        row("Photos", c.photos), row("Photo albums", c.albums),
        row("Music tracks", c.tracks), row("Playlists", c.playlists),
        row("Music albums", c.musicAlbums), row("Meditations", c.meditations),
      ]},
      {title: "Kitchen", rows: [
        row("Recipes", c.recipes), row("Menus", c.menus),
        row("Shopping lists", c.shoppingLists), row("Recipe books", c.recipeBooks),
      ]},
      {title: "Training", rows: [
        row("Sessions", c.sessions), row("Circuits", c.circuits),
        row("Programs", c.programs), row("Exercises", c.exercises),
        row("Guides", c.guides), row("Lesson plans", c.lessonPlans),
        row("Athletes", c.athletes), row("Questionnaires", c.questionnaires),
        row("Training books", c.trainingBooks),
      ]},
      {title: "Puzzles", rows: [
        row("Puzzles completed", (pz.completed || 0) + dashboardTotal),
        row("Puzzles played", (pz.played || 0) + dashboardTotal),
        ...Object.entries(pz.byGame || {}).sort((a, b) => b[1].won - a[1].won)
          .map(([k, g]) => row(`${gameName(k)} completed`, g.won)),
        row("Solved on the dashboard", dashboardTotal),
        row("Puzzle books", c.puzzleBooks),
      ]},
      {title: "Notes", rows: [
        row("Notes", c.notes), row("Canvases", c.canvases),
        row("Fleeting notes", c.fleeting), row("Boards", c.boards), row("Scrapbooks", c.scrapbooks || 0),
        row("Notebook covers", c.covers || 0), row("Assets", c.assets || 0),
        row("Spreadsheets", c.spreadsheets), row("Notebooks", c.notebooks),
      ]},
      {title: "Stuff", rows: [
        row("Media items", c.effects), row("Inventories", c.inventories),
        row("Items in inventories", c.inventoryItems),
      ]},
      {title: "Home & more", rows: [
        row("Contacts", c.contacts), row("Calendar events", c.events),
        row("Journal entries", c.journalEntries), row("Card readings", c.readings),
        row("Gratitude entries", c.gratitude),
      ]},
    ];

    const printed = PRINT_KINDS.map(([k, label]) => row(`Printed ${label.toLowerCase()}`,
      counts["print:" + k] || 0));
    for (const [k, n] of Object.entries(counts)) {
      if (k.startsWith("print:") && !PRINT_KINDS.some(([x]) => "print:" + x === k)) {
        printed.push(row(`Printed ${titleCase(k.slice(6)).toLowerCase()}`, n));
      }
    }
    groups.push({title: "Printed", note: since ? `Since ${since}` : "", rows: printed});

    const exported = Object.entries(counts).filter(([k]) => k.startsWith("export:"))
      .map(([k, n]) => {
        const key = k.slice(7);
        const name = EXPORT_NAMES[key]
          || (key.startsWith("training-") ? `Training ${key.slice(9)}s` : titleCase(key));
        return row(`Exported: ${name}`, n);
      });
    if (exported.length) groups.push({title: "Exported", note: since ? `Since ${since}` : "", rows: exported});

    /* ---- charts ---- */
    const charts = [];
    if (sections.length) {
      charts.push({title: "Time by section", unit: "Minutes",
        labels: sections.map(([k]) => sectionName(k)),
        values: sections.map(([, s]) => minutes(s))});
    }
    const headline = [["Photos", c.photos], ["Tracks", c.tracks], ["Recipes", c.recipes],
      ["Sessions", c.sessions], ["Circuits", c.circuits], ["Exercises", c.exercises],
      ["Guides", c.guides], ["Notes", c.notes], ["Puzzles done", (pz.completed || 0) + dashboardTotal]];
    charts.push({title: "What's in the app", unit: "Items",
      labels: headline.map(([l]) => l), values: headline.map(([, v]) => v || 0)});
    const printedSome = printed.filter((r) => r[2] > 0);
    if (printedSome.length) {
      charts.push({title: "Prints by kind", unit: "Prints",
        labels: printedSome.map((r) => r[0].replace(/^Printed /, "")),
        values: printedSome.map((r) => r[2])});
    }
    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${
        String(d.getDate()).padStart(2, "0")}`;
      last14.push([`${d.getDate()}/${d.getMonth() + 1}`, minutes((u.days || {})[key])]);
    }
    if (last14.some(([, v]) => v > 0)) {
      charts.push({title: "Time in the app, last 14 days", unit: "Minutes",
        labels: last14.map(([l]) => l), values: last14.map(([, v]) => v)});
    }

    return {
      title: "NeuroNet — App stats",
      generated: raw.generated,
      since: u.since || null,
      notes: [
        `Generated ${new Date().toLocaleString()}.`,
        "Counts of what is in the app are exact and include everything ever made.",
        since ? `Time, music and prints have been recorded since ${since}; `
          + "puzzles go back as far as the Puzzles section's own history."
          : "Time, music and prints are recorded from today.",
      ],
      hero: [
        ["Time in the app", duration(u.seconds)],
        ["Days used", num(days.length)],
        ["Music played", duration(u.musicSeconds)],
        ["Puzzles completed", num((pz.completed || 0) + dashboardTotal)],
      ],
      groups: groups.filter((g) => g.rows.length),
      charts,
    };
  }

  /* ---- the panel -------------------------------------------------------- */

  let lastModel = null;

  function chartHTML(ch, width, height) {
    const grid = window.SSGrid;
    if (!grid || !grid.chartSVG) return "";
    return grid.chartSVG({type: "bar", title: "", labels: ch.labels,
      series: [{name: ch.unit, values: ch.values}]}, {width, height});
  }

  /** Reset: time, music, launches, prints and exports start again from now.
      What's in the app is counted live, so it stays. The old record is kept
      beside the new one (usage.json.before-reset-...). */
  async function resetStats(host) {
    const yes = SS.shared && SS.shared.confirm ? await SS.shared.confirm({
      title: "Reset the stats?",
      body: "Time in the app, time by section, music, launches, prints and exports start again from now.",
      fine: "What's in the app (recipes, photos, songs...) is always counted fresh, so it stays. The old record is kept as a backup in NeuroNet's data folder.",
      yes: "Reset",
    }) : true;
    if (!yes) return;
    pending = fresh();
    const r = await call("usage_reset", [], "Resetting the stats");
    if (r && r.error) { toast(r.error, "error"); return; }
    toast("Stats reset. Recording starts now.");
    render(host);
  }

  /* ---- NeuroNet's health (the performance audit, 3 Nov 2026) ----------------
     Cam found NeuroNet 1.8 GB bigger by the morning with no way to see it from
     inside. Memory now (NeuroNet's own processes), how long it has run, and
     the day's line from app_health.py's five-minute samples. */
  const MB = (n) => n >= 1024 ? (n / 1024).toFixed(1) + " GB" : Math.round(n) + " MB";
  function ago(sec) {
    const m = Math.round(sec / 60);
    if (m < 60) return m + " min";
    const h = Math.floor(m / 60);
    return h < 48 ? h + " h " + (m % 60) + " min" : Math.floor(h / 24) + " days";
  }
  function sparkHTML(samples) {
    /* from nothing up (a flat line reads flat), once there are ten minutes of it */
    if (!samples || samples.length < 3 || samples[samples.length - 1][0] - samples[0][0] < 600) return "";
    const W = 560, H = 70, t0 = samples[0][0], t1 = samples[samples.length - 1][0] || t0 + 1;
    const lo = 0, hi = Math.max(...samples.map((x) => x[1])) * 1.1 || 1;
    const pts = samples.map(([t, v]) => `${((t - t0) / Math.max(1, t1 - t0) * W).toFixed(1)},${(H - (v - lo) / Math.max(1, hi - lo) * H).toFixed(1)}`).join(" ");
    return `<svg class="ap-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function healthHTML(h) {
    if (!h || h.error || !h.now) return "";
    const p = h.now.parts || {}, order = [["page", "the page"], ["app", "NeuroNet itself"], ["graphics", "graphics"], ["helpers", "helpers"]];
    const since = h.since ? new Date(h.since * 1000) : null;
    const verdict = h.steady == null ? "Watching. The line fills in every five minutes."
      : h.steady ? "Steady."
      : `Climbing about ${MB(h.perHour)} an hour. Restarting NeuroNet gives it back, and tell Claude so it can be found.`;
    return `<div class="panel ap-health">
      <div class="ap-chart-h">NeuroNet's health <span>memory, its own processes only</span></div>
      <div class="ap-health-row">
        <div class="ap-health-now"><b>${esc(MB(h.now.total))}</b><span>in use now</span></div>
        <div class="ap-health-parts">${order.filter(([k]) => p[k]).map(([k, l]) => `<span>${esc(l)} <b>${esc(MB(p[k]))}</b></span>`).join("")}</div>
        <div class="ap-health-up">${since ? `Running ${esc(ago(Date.now() / 1000 - h.since))}<span>since ${esc(since.toLocaleString())}</span>` : ""}</div>
      </div>
      ${sparkHTML(h.samples)}
      <p class="stamp ap-health-v ${h.steady === false ? "is-warn" : ""}">${esc(verdict)}</p>
    </div>`;
  }

  async function render(host) {
    if (!host) return;
    host.innerHTML = `<p class="stamp">Counting…</p>`;
    await flush();                                     // the last minute too
    const raw = await call("app_stats", [], "Reading the stats");
    if (!host.isConnected) return;
    if (!raw || raw.error) {
      host.innerHTML = `<p class="stamp">${esc((raw && raw.error) || "The stats couldn't be read.")}</p>`;
      return;
    }
    const model = lastModel = buildModel(raw);
    const health = await call("app_health", [], "Reading NeuroNet's memory");
    if (!host.isConnected) return;
    host.innerHTML = `
      <div class="ap-stats">
        ${healthHTML(health)}
        <div class="ap-bar">
          <p class="stamp ap-since">${esc(model.notes[2])}</p>
          <div class="ap-actions">
            <button class="btn btn-quiet" data-ap="refresh">Refresh</button>
            <button class="btn btn-quiet" data-ap="reset">Reset stats</button>
            <button class="btn" data-ap="print">Print</button>
            <button class="btn" data-ap="xlsx">Export to Excel</button>
            <button class="btn" data-ap="docx">Export to Word</button>
            <button class="btn btn-primary" data-ap="board">Send to Boards</button>
          </div>
        </div>

        <div class="ap-hero">
          ${model.hero.map(([label, value]) => `
            <div class="ap-tile">
              <div class="ap-tile-v">${esc(value)}</div>
              <div class="ap-tile-l">${esc(label)}</div>
            </div>`).join("")}
        </div>

        <div class="ap-charts">
          ${model.charts.map((ch) => `
            <div class="panel ap-chart">
              <div class="ap-chart-h">${esc(ch.title)} <span>${esc(ch.unit.toLowerCase())}</span></div>
              ${chartHTML(ch, 560, 240)}
            </div>`).join("")}
        </div>

        <div class="ap-groups">
          ${model.groups.map((g) => `
            <div class="panel ap-group">
              <div class="ap-group-h">${esc(g.title)}${g.note
                ? ` <span>${esc(g.note)}</span>` : ""}</div>
              ${g.rows.length ? g.rows.map(([label, shown, value]) => `
                <div class="ap-row ${value ? "" : "is-zero"}">
                  <span>${esc(label)}</span><b>${esc(shown)}</b>
                </div>`).join("")
                : `<p class="stamp">Nothing yet.</p>`}
            </div>`).join("")}
        </div>
        <p class="stamp ap-foot">Time counts while NeuroNet is in use; after five
          minutes without a click, key or scroll it stops until you are back.
          Music counts whenever it is playing.</p>
      </div>`;

    host.querySelector('[data-ap="refresh"]').onclick = () => render(host);
    host.querySelector('[data-ap="reset"]').onclick = () => resetStats(host);
    host.querySelector('[data-ap="xlsx"]').onclick = () => exportTo("xlsx");
    host.querySelector('[data-ap="docx"]').onclick = () => exportTo("docx");
    host.querySelector('[data-ap="board"]').onclick = () => sendToBoards();
    host.querySelector('[data-ap="print"]').onclick = () => printStats();
    /* Ctrl+P too, like every other page -- anchored to this panel, so it
       lapses the moment Cam leaves it. */
    if (SS.Print && SS.Print.offer) SS.Print.offer(host.querySelector(".ap-stats"), "App stats", printStats);
  }

  /* ---- print --------------------------------------------------------------

     Cam: "add a print to the stats page, presented like all the other print
     pages with the neuronet logo at top left." The letterhead is the shared
     one (print_header.py) -- NeuroNet's mark on the left, the title in the
     middle, the date on the right -- and the page is set like the Kitchen's
     printouts: serif body, green headings over a two-tone rule. */
  const BRAND = "#5FA665", INK = "#2E6B38";
  /* The house style (print_header.py, via SS.PrintHouse) goes first -- Cam,
     2026-10-05: all printouts "handled in this way". These are the stats' own. */
  const PRINT_CSS = `
    .hero { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 6px 0 8px; }
    .tile { background: #f4f6f2; border: 1px solid #d6d9d3; border-left: 4px solid ${INK};
            border-radius: 6px; padding: 9px 12px; }
    .tile b { display: block; font-size: 20px; color: #1F2A24; line-height: 1.2; }
    .tile span { font-size: 10.5px; color: #5d665f; text-transform: uppercase; letter-spacing: .08em; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .chart { border: 1px solid #d6d9d3; border-radius: 6px; padding: 8px 10px; break-inside: avoid;
             --text: #1F2A24; --text-faint: #5d665f; --border: #d6d9d3; }
    .chart h3 { margin: 0 0 4px; font-size: 12px; }
    .chart h3 small { color: #5d665f; font-weight: 400; }
    .chart svg { width: 100%; height: auto; display: block; }
    .groups { columns: 2; column-gap: 18px; }
    .group { break-inside: avoid; margin: 0 0 12px; }
    .group h3 { margin: 4px 0 4px; }
    .group table { font-size: 12px; margin: 0; }
    .group td:last-child { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    tr.zero td { color: #9aa39b; }`;

  async function printStats() {
    if (!lastModel) return;
    const m = lastModel;
    const date = new Date().toLocaleDateString(undefined, {day: "numeric", month: "long", year: "numeric"});
    let head = "";
    try {
      await SS.PrintHouse.load();
      const h = await call("print_header", ["App stats", {meta: date}], "");
      head = typeof h === "string" ? h : "";
    } catch (e) { /* a page without its letterhead still prints */ }
    const H = SS.PrintHouse;
    const green = (svg) => String(svg || "").split("#4f8cff").join(INK);    // the house green, not the screen's blue
    const body = H.titleBlock("App stats", "What is in NeuroNet, and how it is used", [["Printed", date]])
      + H.panel("", `<p>${m.notes.map(esc).join(" ")}</p>`) + `
      <div class="hero">${m.hero.map(([l, v]) =>
        `<div class="tile"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>
      ${H.section("Charts")}
      <div class="charts">${m.charts.map((ch) => `
        <div class="chart"><h3>${esc(ch.title)} <small>(${esc(ch.unit.toLowerCase())})</small></h3>
          ${green(chartHTML(ch, 520, 230))}</div>`).join("")}</div>
      ${H.section("The numbers")}
      <div class="groups">${m.groups.map((g) => `
        <div class="group"><h3>${esc(g.title)}</h3>
          ${g.note ? `<p style="margin:0 0 4px;color:#5d665f;font-size:11px">${esc(g.note)}</p>` : ""}
          <table>${g.rows.map(([l, shown, v]) =>
            `<tr class="${v ? "" : "zero"}"><td>${esc(l)}</td><td>${esc(shown)}</td></tr>`).join("")}</table>
        </div>`).join("")}</div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>App stats</title>`
      + `<style>${H.css}${PRINT_CSS}</style></head><body><div class="ap-doc">${head}${body}${H.foot("App stats")}</div></body></html>`;
    const res = await call("open_print_document", [html, "app-stats"], "Printing the stats");
    if (res && res.error) toast(res.error, "error");
  }

  async function exportTo(fmt) {
    if (!lastModel) return;
    const res = await call("stats_export", [fmt, lastModel], "Exporting the stats");
    if (!res || res.error) { toast((res && res.error) || "That export failed.", "error"); return; }
    toast(`Saved to ${res.path || "the Desktop"}.`, "good");
  }

  /* ---- onto a board ------------------------------------------------------

     Real board items, so every one can be moved, resized and recoloured, and
     the charts are Boards' own graph item -- the same one drawn by hand in the
     editor. Boards' PowerPoint export then turns each page into a slide, which
     is where Cam is taking this. */
  function boardFor(model) {
    const stamp = Date.now().toString(36);
    let n = 0;
    const id = () => `st${stamp}${n++}`;
    const text = (x, y, w, h, t, size, colour) =>
      ({id: id(), k: "text", x, y, w, h, text: t, size, stroke: colour || "#1f2430"});
    const graph = (x, y, w, h, ch) => ({id: id(), k: "graph", x, y, w, h,
      data: {type: "bar", title: ch.title, labels: ch.labels,
             series: [{name: ch.unit, values: ch.values}]}});

    const pages = [];
    // Page 1: the headline numbers and the two charts that matter most.
    const p1 = [
      text(80, 50, 1400, 60, model.title, 44),
      text(80, 118, 1400, 30, model.notes[2], 18, "#5b6070"),
      ...model.hero.flatMap(([label, value], i) => [
        {id: id(), k: "rect", x: 80 + i * 370, y: 180, w: 340, h: 150,
         fill: "#eef2f8", stroke: "#c9d2e0"},
        text(104 + i * 370, 200, 300, 56, value, 38),
        text(104 + i * 370, 272, 300, 30, label, 18, "#5b6070"),
      ]),
    ];
    const [first, second, ...rest] = model.charts;
    if (first) p1.push(graph(80, 380, 700, 560, first));
    if (second) p1.push(graph(820, 380, 700, 560, second));
    pages.push({items: p1});

    // Page 2: any further charts.
    if (rest.length) {
      pages.push({items: [
        text(80, 50, 1400, 60, "More charts", 36),
        ...rest.slice(0, 2).map((ch, i) => graph(80 + i * 740, 150, 700, 560, ch)),
      ]});
    }

    // Page 3 on: every group, as text, three to a page.
    const cols = model.groups.map((g) =>
      `${g.title}${g.note ? `  (${g.note})` : ""}\n`
      + g.rows.map(([label, shown]) => `${label}: ${shown}`).join("\n"));
    for (let i = 0; i < cols.length; i += 3) {
      pages.push({items: [
        text(80, 50, 1400, 60, i ? "The numbers (continued)" : "The numbers", 36),
        ...cols.slice(i, i + 3).map((body, j) =>
          text(80 + j * 500, 150, 460, 800, body, 22)),
      ]});
    }
    return {name: `App stats ${new Date().toISOString().slice(0, 10)}`,
            w: 1600, h: 1000, paper: "blank", pages,
            created: new Date().toISOString()};
  }

  async function sendToBoards() {
    if (!lastModel) return;
    const board = boardFor(lastModel);
    const existing = await call("boards_list", [], "Your boards");
    const taken = new Set((Array.isArray(existing) ? existing : []).map((b) => b.id));
    let boardId = board.name, n = 2;
    while (taken.has(boardId)) boardId = `${board.name} ${n++}`;
    board.name = boardId;
    const res = await call("boards_write", [boardId, board], "Making the board");
    if (res && res.error) { toast(res.error, "error"); return; }
    toast(`“${boardId}” is in Creative → Boards, ready for PowerPoint.`, "good");
  }

  SS.Stats = {render, buildModel, boardFor, flush, printStats,
              _test: {tick, get pending() { return pending; }, duration,
                      touch: () => { lastInput = Date.now(); },
                      idle: () => { lastInput = 0; },
                      onScreen, resetStats}};

  startTracker();
})();
