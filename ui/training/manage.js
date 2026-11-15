/* ==========================================================================
   CF.Manage — scheduling, athletes and groups.

   The record shapes here are the original app's, exactly:

     calendar    {id, name, created, active, athleteId, entries}
     entry       {id, type: "circuit"|"session"|"program", refId}
     athlete     {id, name, email, groupIds, assignments, notes}
     assignment  {sessionId|circuitId|programId, assignedDate}
     group       {id, name}

   The assignment key is the record type with "Id" appended — that is how the
   original writes it and how its Word exporter reads it back, so it is not a
   detail worth improving on.
   ========================================================================== */
CF.Manage = (() => {
  "use strict";

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const icon = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24"><use href="#i-${n}"/></svg>`;
  const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const sheetHost = () => document.getElementById("sheetHost");
  const sheetTitle = () => document.getElementById("sheetTitle");
  const sheetBody = () => document.getElementById("sheetBody");
  const closeSheet = () => { sheetHost().hidden = true; sheetBody().innerHTML = ""; };

  function openSheet(title, build) {
    sheetTitle().textContent = title;
    sheetBody().innerHTML = "";
    build(sheetBody());
    sheetHost().hidden = false;
  }

  function sheetItem(parent, { label, sub, iconName, danger, onClick }) {
    const b = document.createElement("button");
    b.className = "sheet-item" + (danger ? " is-danger" : "");
    b.innerHTML = icon(iconName) +
      `<span class="sheet-item-text"><span>${esc(label)}</span>` +
      (sub ? `<span class="sheet-item-sub">${esc(sub)}</span>` : "") + `</span>`;
    b.addEventListener("click", onClick);
    parent.appendChild(b);
    return b;
  }

  /* ---- small form sheet ------------------------------------------------ */

  /**
   * A short form in a sheet. `fields` is a list of {key, label, type, value}.
   * Anything longer than a handful of fields belongs in a full editor pane,
   * not here — a sheet that fills the screen is just a worse dialog.
   */
  function formSheet({ title, fields, confirmLabel = "Save", onConfirm }) {
    openSheet(title, (body) => {
      body.innerHTML = fields.map((f) => `
        <div class="field">
          <label for="fs-${f.key}">${esc(f.label)}</label>
          ${f.type === "textarea"
            ? `<textarea id="fs-${f.key}" class="sheet-field is-tall" rows="3"
                 placeholder="${esc(f.placeholder || "")}">${esc(f.value || "")}</textarea>`
            : `<input id="fs-${f.key}" class="sheet-field" type="${f.type || "text"}"
                 value="${esc(f.value || "")}" placeholder="${esc(f.placeholder || "")}"
                 autocomplete="${esc(f.autocomplete || "off")}">`}
        </div>`).join("") + `
        <div class="sheet-row">
          <button class="secondary-btn" data-cancel>Cancel</button>
          <button class="primary-btn" data-ok>${esc(confirmLabel)}</button>
        </div>`;

      const values = () => Object.fromEntries(
        fields.map((f) => [f.key, body.querySelector(`#fs-${f.key}`).value.trim()]));

      body.querySelector("[data-cancel]").onclick = closeSheet;
      body.querySelector("[data-ok]").onclick = () => {
        const v = values();
        const problem = onConfirm.validate ? onConfirm.validate(v) : null;
        if (problem) { CF.toast(problem); return; }
        closeSheet();
        onConfirm(v);
      };
      setTimeout(() => {
        const first = body.querySelector(".sheet-field");
        if (first) { first.focus(); first.select && first.select(); }
      }, 70);
    });
  }

  /* ---- record picker --------------------------------------------------- */

  /** Pick one saved circuit or session, searchable. */
  async function pickRecord(collection, title, onPick) {
    const doc = await CF.Store.load();
    const all = doc[collection] || [];

    openSheet(title, (body) => {
      body.innerHTML = `
        <div class="search-wrap">
          ${icon("search", "ic search-ic")}
          <input class="search-input" id="prSearch" type="search"
            placeholder="Search" autocomplete="off" autocapitalize="off">
        </div>
        <div class="pick-list" id="prList"></div>`;
      const input = body.querySelector("#prSearch");
      const list = body.querySelector("#prList");

      function draw() {
        const q = input.value.trim().toLowerCase();
        const hits = (q ? all.filter((r) => (r.name || "").toLowerCase().includes(q)) : all)
          .slice(0, 80);
        const summary = (r) => {
          if (collection === "circuits") return `${(r.stations || []).length} stations`;
          if (collection === "sessions") return `${(r.items || []).length} exercises`;
          if (collection === "guides") return (r.tags || []).join(" · ") || "guide";
          return "";
        };
        list.innerHTML = hits.length
          ? hits.map((r, i) => `
              <button class="pick-row" data-i="${i}">
                <span class="pick-name">${esc(r.name)}</span>
                <span class="tag">${esc(summary(r))}</span>
              </button>`).join("")
          : `<p class="empty-note">Nothing saved matches that.</p>`;
        list.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => {
          closeSheet();
          onPick(hits[Number(b.dataset.i)]);
        }));
      }
      input.addEventListener("input", draw);
      draw();
      setTimeout(() => input.focus(), 70);
    });
  }

  /* ---- calendars ------------------------------------------------------- */

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` +
    `-${String(d.getDate()).padStart(2, "0")}`;
  const todayIso = () => iso(new Date());

  async function newCalendar(done) {
    formSheet({
      title: "New calendar",
      fields: [{ key: "name", label: "Calendar name", placeholder: "PT Classes" }],
      confirmLabel: "Create",
      onConfirm: Object.assign(async (v) => {
        const doc = await CF.Store.load();
        const cal = {
          id: makeId(), name: v.name, created: new Date().toISOString(),
          active: false, athleteId: null, entries: {},
        };
        doc.calendars.push(cal);
        await CF.Store.save();
        CF.toast("Calendar created");
        if (done) done(cal);
      }, { validate: (v) => (v.name ? null : "Give the calendar a name.") }),
    });
  }

  async function renameCalendar(cal, done) {
    formSheet({
      title: "Rename calendar",
      fields: [{ key: "name", label: "Calendar name", value: cal.name }],
      onConfirm: Object.assign(async (v) => {
        cal.name = v.name;
        await CF.Store.save();
        if (done) done(cal);
      }, { validate: (v) => (v.name ? null : "Give the calendar a name.") }),
    });
  }

  async function deleteCalendar(cal, done) {
    const doc = await CF.Store.load();
    doc.calendars = doc.calendars.filter((c) => c.id !== cal.id);
    await CF.Store.save();
    CF.toast("Calendar deleted");
    if (done) done();
  }

  /** Put a circuit or session on a date. */
  function schedule(cal, dateIso, done) {
    openSheet(`Add to ${formatDate(dateIso)}`, (body) => {
      sheetItem(body, {
        label: "A circuit", iconName: "circuit",
        onClick: () => {
          closeSheet();
          pickRecord("circuits", "Which circuit?", async (rec) => {
            await addEntry(cal, dateIso, "circuit", rec.id);
            if (done) done();
          });
        },
      });
      sheetItem(body, {
        label: "A session", iconName: "session",
        onClick: () => {
          closeSheet();
          pickRecord("sessions", "Which session?", async (rec) => {
            await addEntry(cal, dateIso, "session", rec.id);
            if (done) done();
          });
        },
      });
    });
  }

  async function addEntry(cal, dateIso, type, refId) {
    if (!cal.entries) cal.entries = {};
    if (!cal.entries[dateIso]) cal.entries[dateIso] = [];
    cal.entries[dateIso].push({ id: makeId(), type, refId });
    await CF.Store.save();
    CF.toast(`Added to ${formatDate(dateIso)}`);
  }

  async function removeEntry(cal, dateIso, entryId, done) {
    if (!cal.entries || !cal.entries[dateIso]) return;
    cal.entries[dateIso] = cal.entries[dateIso].filter((e) => e.id !== entryId);
    // An empty date is noise in the stored file and in the month grid.
    if (!cal.entries[dateIso].length) delete cal.entries[dateIso];
    await CF.Store.save();
    CF.toast("Removed");
    if (done) done();
  }

  /** Move an entry to another date, keeping its id. */
  async function moveEntry(cal, fromIso, entryId, toIso, done) {
    const list = (cal.entries || {})[fromIso] || [];
    const at = list.findIndex((e) => e.id === entryId);
    if (at === -1) return;
    const [entry] = list.splice(at, 1);
    if (!list.length) delete cal.entries[fromIso];
    if (!cal.entries[toIso]) cal.entries[toIso] = [];
    cal.entries[toIso].push(entry);
    await CF.Store.save();
    CF.toast(`Moved to ${formatDate(toIso)}`);
    if (done) done();
  }

  function formatDate(dateIso) {
    const d = new Date(dateIso + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  }

  /** Log dates carry the year — an adaptation history spans seasons, and
      "Sep 1" alone is ambiguous once it does. Matches what the printed
      sheet writes. */
  function formatLogDate(dateIso) {
    const text = String(dateIso || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const d = new Date(text + "T00:00:00");
    if (Number.isNaN(d.getTime())) return text;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  /** Ask for a date with the platform's own picker rather than building one. */
  function askDate(title, value, onPick) {
    formSheet({
      title,
      fields: [{ key: "date", label: "Date", type: "date", value: value || todayIso() }],
      confirmLabel: "Choose",
      onConfirm: Object.assign((v) => onPick(v.date),
        { validate: (v) => (v.date ? null : "Pick a date.") }),
    });
  }

  /* ---- adaptation log --------------------------------------------------- */

  /*
   * A dated running record on a circuit or session: what was changed, and
   * when. Stored on the record itself as logEntries, newest first, so it
   * travels with the thing it describes and appears in its export.
   *
   *   logEntry {id, date: "YYYY-MM-DD", title, text}
   *
   * The title is what the entry is called on screen and on the printed sheet.
   * It is optional — an entry with only a date and a note is still useful,
   * and forcing a heading on every one would just produce empty ones.
   */

  function sortLog(entries) {
    // Newest first, and a stable order for two entries made the same day.
    return entries.sort((a, b) => String(b.date).localeCompare(String(a.date))
      || String(b.id).localeCompare(String(a.id)));
  }

  const LOG_FIELDS = (entry) => [
    { key: "title", label: "Heading", value: entry ? entry.title || "" : "",
      placeholder: "What to call this note" },
    { key: "date", label: "Date", type: "date", value: entry ? entry.date : todayIso() },
    { key: "text", label: "Notes", type: "textarea", value: entry ? entry.text : "",
      placeholder: "Dropped to 4 rounds — squad was cooked" },
  ];

  const validateLog = (v) => {
    if (!v.date) return "Pick a date.";
    if (!v.text) return "Write the note.";
    return null;
  };

  function addLogEntry(record, done) {
    formSheet({
      title: "New note",
      fields: LOG_FIELDS(null),
      confirmLabel: "Add",
      onConfirm: Object.assign(async (v) => {
        record.logEntries = record.logEntries || [];
        record.logEntries.push({
          id: makeId(), date: v.date, title: v.title, text: v.text,
        });
        sortLog(record.logEntries);
        await CF.Store.save();
        CF.toast("Note added");
        if (done) done();
      }, { validate: validateLog }),
    });
  }

  function editLogEntry(record, entry, done) {
    formSheet({
      title: "Edit note",
      fields: LOG_FIELDS(entry),
      onConfirm: Object.assign(async (v) => {
        entry.date = v.date;
        entry.title = v.title;
        entry.text = v.text;
        sortLog(record.logEntries || []);
        await CF.Store.save();
        if (done) done();
      }, { validate: validateLog }),
    });
  }

  async function deleteLogEntry(record, id, done) {
    record.logEntries = (record.logEntries || []).filter((e) => e.id !== id);
    await CF.Store.save();
    CF.toast("Entry removed");
    if (done) done();
  }

  /**
   * pickRecord works on a collection of {id, name} records. Exercises are
   * not that — they live in a category map keyed by name — so this picks
   * from a plain list of {label, sub, value} instead.
   */
  function pickFrom({ title, items, onPick }) {
    openSheet(title, (body) => {
      const search = document.createElement("input");
      search.className = "sheet-field";
      search.placeholder = "Search";
      search.autocomplete = "off";
      body.appendChild(search);

      const list = document.createElement("div");
      list.className = "pick-list";
      body.appendChild(list);

      const draw = () => {
        const q = search.value.trim().toLowerCase();
        const hits = items.filter((i) =>
          !q || i.label.toLowerCase().includes(q)
          || String(i.sub || "").toLowerCase().includes(q));
        // Capped: a list of 456 exercises is slow to build and useless to
        // scroll. Typing narrows it.
        const shown = hits.slice(0, 60);
        list.innerHTML = shown.length
          ? shown.map((i, n) => `
              <button class="pick-row" data-n="${n}">
                <span class="pick-name">${esc(i.label)}</span>
                <span class="tag">${esc(i.sub || "")}</span>
              </button>`).join("")
            + (hits.length > shown.length
              ? `<p class="empty-note">${hits.length - shown.length} more — keep typing.</p>`
              : "")
          : `<p class="empty-note">Nothing matches that.</p>`;
        list.querySelectorAll("[data-n]").forEach((b) =>
          b.addEventListener("click", () => {
            closeSheet();
            onPick(shown[Number(b.dataset.n)].value);
          }));
      };
      search.addEventListener("input", draw);
      draw();
      setTimeout(() => search.focus(), 60);
    });
  }

  /* ---- equipment -------------------------------------------------------- */

  async function editEquipment(existing, done) {
    const doc = await CF.Store.load();
    formSheet({
      title: existing ? "Rename equipment" : "New equipment",
      fields: [{ key: "name", label: "Name", value: existing ? existing.name : "",
                 placeholder: "Kettlebells 16 kg" }],
      onConfirm: Object.assign(async (v) => {
        if (existing) existing.name = v.name;
        else {
          doc.equipment = doc.equipment || [];
          doc.equipment.push({ id: makeId(), name: v.name });
        }
        await CF.Store.save();
        CF.toast(existing ? "Saved" : "Equipment added");
        if (done) done();
      }, { validate: (v) => (v.name ? null : "Give it a name.") }),
    });
  }

  async function deleteEquipment(item, done) {
    const doc = await CF.Store.load();
    doc.equipment = (doc.equipment || []).filter(
      (e) => (e.id ? e.id !== item.id : e.name !== item.name));
    await CF.Store.save();
    CF.toast("Removed");
    if (done) done();
  }

  /* ---- athlete results -------------------------------------------------- */

  /*
   * Dated test results, stored on the athlete as `results`:
   *
   *   result {id, date: "YYYY-MM-DD", metric, detail, value, unit, note}
   *
   * `metric` comes from the catalogue below rather than being free text, so
   * that anything reading results back — the MAS sheet, the trend arrows —
   * can find what it needs without guessing at spelling. `detail` carries the
   * lift or test variant where one metric covers several (a 1RM is always a
   * 1RM of something).
   */

  const METRICS = [
    { id: "mas", name: "MAS", unit: "m/s", better: "up",
      hint: "From the 1.2 km or 1600 m field test" },
    { id: "1rm", name: "1RM", unit: "kg", better: "up", needsDetail: "Lift",
      hint: "Measured or estimated from a 3RM" },
    { id: "cmj", name: "Countermovement jump", unit: "cm", better: "up" },
    { id: "broad", name: "Broad jump", unit: "m", better: "up" },
    { id: "sprint", name: "Sprint", unit: "s", better: "down", needsDetail: "Distance" },
    { id: "cod", name: "Change of direction", unit: "s", better: "down",
      needsDetail: "Test", hint: "5-0-5, T-test, pro agility" },
    { id: "yoyo", name: "Yo-Yo / shuttle", unit: "m", better: "up" },
    { id: "reps", name: "Reps to failure", unit: "reps", better: "up", needsDetail: "Exercise" },
    { id: "hold", name: "Hold for time", unit: "s", better: "up", needsDetail: "Exercise" },
    { id: "bodyweight", name: "Bodyweight", unit: "kg", better: null },
    { id: "maxhr", name: "Max heart rate", unit: "bpm", better: null },
    { id: "restinghr", name: "Resting heart rate", unit: "bpm", better: "down" },
  ];

  const metricById = (id) => METRICS.find((m) => m.id === id) || null;

  const sortResults = (results) => results.sort(
    (a, b) => String(b.date).localeCompare(String(a.date))
      || String(b.id).localeCompare(String(a.id)));

  /** The most recent result for a metric, optionally narrowed by detail. */
  function latestResult(athlete, metricId, detail = null) {
    const all = (athlete.results || [])
      .filter((r) => r.metric === metricId)
      .filter((r) => !detail || (r.detail || "") === detail);
    return sortResults([...all])[0] || null;
  }

  /** Every distinct metric+detail an athlete has results for. */
  function resultSeries(athlete) {
    const groups = new Map();
    for (const r of athlete.results || []) {
      const key = `${r.metric}::${r.detail || ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    return [...groups.entries()].map(([key, list]) => {
      const [metric, detail] = key.split("::");
      sortResults(list);
      return { metric, detail, list, spec: metricById(metric) };
    }).sort((a, b) => (a.spec ? a.spec.name : a.metric)
      .localeCompare(b.spec ? b.spec.name : b.metric));
  }

  /**
   * Change from the previous result, and whether that change is an
   * improvement. Direction matters: a faster sprint is a smaller number, so
   * "down is better" has to be known per metric rather than assumed.
   */
  function resultChange(series) {
    if (series.list.length < 2) return null;
    const [now, before] = series.list;
    const delta = Number(now.value) - Number(before.value);
    if (!Number.isFinite(delta) || delta === 0) return null;
    const better = series.spec && series.spec.better;
    return {
      delta,
      pct: Number(before.value) ? (delta / Number(before.value)) * 100 : null,
      improved: better ? (better === "up" ? delta > 0 : delta < 0) : null,
    };
  }

  function resultFields(existing) {
    return [
      { key: "value", label: "Result", type: "text",
        value: existing ? String(existing.value) : "",
        placeholder: "The number" },
      { key: "date", label: "Date", type: "date",
        value: existing ? existing.date : todayIso() },
      { key: "note", label: "Note", type: "textarea",
        value: existing ? existing.note || "" : "",
        placeholder: "Conditions, how it felt, anything that would change how you read this later" },
    ];
  }

  function addResult(athlete, done) {
    // Metric first, on its own, because it decides whether a detail field is
    // needed at all — asking for everything at once would show a "Lift" box
    // to someone recording a jump.
    openSheet(`New result for ${athlete.name}`, (body) => {
      METRICS.forEach((m) => sheetItem(body, {
        label: m.name, sub: m.hint || m.unit, iconName: "chart",
        onClick: () => { closeSheet(); collectResult(athlete, m, null, done); },
      }));
    });
  }

  function collectResult(athlete, spec, existing, done) {
    const fields = resultFields(existing);
    if (spec.needsDetail) {
      fields.unshift({ key: "detail", label: spec.needsDetail,
        value: existing ? existing.detail || "" : "",
        placeholder: spec.needsDetail === "Distance" ? "30 m" : "" });
    }
    formSheet({
      title: `${spec.name}${spec.unit ? ` (${spec.unit})` : ""}`,
      fields,
      confirmLabel: existing ? "Save" : "Add",
      onConfirm: Object.assign(async (v) => {
        athlete.results = athlete.results || [];
        const record = {
          id: existing ? existing.id : makeId(),
          date: v.date,
          metric: spec.id,
          detail: v.detail || "",
          value: Number(v.value),
          unit: spec.unit,
          note: v.note || "",
        };
        if (existing) {
          const at = athlete.results.findIndex((r) => r.id === existing.id);
          athlete.results[at] = record;
        } else {
          athlete.results.push(record);
        }
        sortResults(athlete.results);
        await CF.Store.save();
        CF.toast(existing ? "Saved" : "Result added");
        if (done) done();
      }, {
        validate: (v) => {
          if (!v.value || !Number.isFinite(Number(v.value))) return "The result has to be a number.";
          if (Number(v.value) <= 0) return "The result has to be above zero.";
          if (!v.date) return "Pick a date.";
          if (spec.needsDetail && !v.detail) return `${spec.needsDetail} is needed.`;
          return null;
        },
      }),
    });
  }

  function editResult(athlete, result, done) {
    const spec = metricById(result.metric);
    if (!spec) return;
    collectResult(athlete, spec, result, done);
  }

  async function deleteResult(athlete, id, done) {
    athlete.results = (athlete.results || []).filter((r) => r.id !== id);
    await CF.Store.save();
    CF.toast("Result removed");
    if (done) done();
  }

  /* ---- athletes and groups --------------------------------------------- */

  async function editAthlete(existing, done) {
    const doc = await CF.Store.load();
    formSheet({
      title: existing ? "Edit athlete" : "New athlete",
      fields: [
        { key: "name", label: "Name", value: existing ? existing.name : "", autocomplete: "name" },
        { key: "email", label: "Email", type: "email", value: existing ? existing.email : "",
          placeholder: "optional", autocomplete: "email" },
        { key: "notes", label: "Notes", type: "textarea", value: existing ? existing.notes || "" : "",
          placeholder: "optional" },
      ],
      onConfirm: Object.assign(async (v) => {
        if (existing) {
          existing.name = v.name;
          existing.email = v.email;
          existing.notes = v.notes;
        } else {
          doc.athletes.push({
            id: makeId(), name: v.name, email: v.email,
            groupIds: [], assignments: [], notes: v.notes,
          });
        }
        await CF.Store.save();
        CF.toast(existing ? "Saved" : "Athlete added");
        if (done) done();
      }, { validate: (v) => (v.name ? null : "Give the athlete a name.") }),
    });
  }

  async function deleteAthlete(athlete, done) {
    const doc = await CF.Store.load();
    doc.athletes = doc.athletes.filter((a) => a.id !== athlete.id);
    await CF.Store.save();
    CF.toast("Athlete removed");
    if (done) done();
  }

  /** Assign a circuit or session, in the original's {typeId, assignedDate} shape. */
  function assign(athlete, done) {
    openSheet(`Assign to ${athlete.name}`, (body) => {
      const add = (collection, key, title) => {
        closeSheet();
        pickRecord(collection, title, async (rec) => {
          athlete.assignments = athlete.assignments || [];
          athlete.assignments.push({ [key]: rec.id, assignedDate: new Date().toISOString() });
          await CF.Store.save();
          CF.toast(`Assigned ${rec.name}`);
          if (done) done();
        });
      };
      sheetItem(body, { label: "A circuit", iconName: "circuit",
        onClick: () => add("circuits", "circuitId", "Which circuit?") });
      sheetItem(body, { label: "A session", iconName: "session",
        onClick: () => add("sessions", "sessionId", "Which session?") });
    });
  }

  async function unassign(athlete, index, done) {
    (athlete.assignments || []).splice(index, 1);
    await CF.Store.save();
    CF.toast("Removed");
    if (done) done();
  }

  /** Resolve an assignment to the record it points at, whatever its key. */
  async function resolveAssignment(assignment) {
    const doc = await CF.Store.load();
    const pairs = [
      ["circuitId", "circuits", "circuit"],
      ["sessionId", "sessions", "session"],
      ["programId", "programs", "program"],
    ];
    for (const [key, collection, type] of pairs) {
      if (!assignment[key]) continue;
      const record = (doc[collection] || []).find((r) => r.id === assignment[key]);
      return { type, record, missing: !record };
    }
    return { type: "unknown", record: null, missing: true };
  }

  async function editGroup(existing, done) {
    const doc = await CF.Store.load();
    formSheet({
      title: existing ? "Rename group" : "New group",
      fields: [{ key: "name", label: "Group name", value: existing ? existing.name : "" }],
      onConfirm: Object.assign(async (v) => {
        if (existing) existing.name = v.name;
        else doc.groups.push({ id: makeId(), name: v.name });
        await CF.Store.save();
        if (done) done();
      }, { validate: (v) => (v.name ? null : "Give the group a name.") }),
    });
  }

  async function deleteGroup(group, done) {
    const doc = await CF.Store.load();
    doc.groups = doc.groups.filter((g) => g.id !== group.id);
    // Leaving an id behind on an athlete would point at nothing.
    (doc.athletes || []).forEach((a) => {
      a.groupIds = (a.groupIds || []).filter((id) => id !== group.id);
    });
    await CF.Store.save();
    CF.toast("Group deleted");
    if (done) done();
  }

  /** Toggle which groups an athlete belongs to. */
  async function editMembership(athlete, done) {
    const doc = await CF.Store.load();
    const groups = doc.groups || [];

    openSheet(`Groups for ${athlete.name}`, (body) => {
      if (!groups.length) {
        const note = document.createElement("p");
        note.className = "sheet-note";
        note.textContent = "No groups yet. Make one from the Groups section first.";
        body.appendChild(note);
        return;
      }
      athlete.groupIds = athlete.groupIds || [];
      groups.forEach((g) => {
        const on = athlete.groupIds.includes(g.id);
        const b = sheetItem(body, {
          label: g.name, iconName: on ? "check" : "people",
          onClick: async () => {
            const at = athlete.groupIds.indexOf(g.id);
            if (at === -1) athlete.groupIds.push(g.id); else athlete.groupIds.splice(at, 1);
            await CF.Store.save();
            closeSheet();
            editMembership(athlete, done);
            if (done) done();
          },
        });
        if (on) b.classList.add("is-on");
      });
    });
  }

  return {
    makeId, iso, todayIso, formatDate, formatLogDate, askDate, pickRecord, formSheet,
    openSheet, closeSheet, sheetItem, pickFrom,
    addLogEntry, editLogEntry, deleteLogEntry, sortLog,
    editEquipment, deleteEquipment,
    METRICS, metricById, latestResult, resultSeries, resultChange,
    addResult, editResult, deleteResult, sortResults,
    newCalendar, renameCalendar, deleteCalendar, schedule, addEntry,
    removeEntry, moveEntry,
    editAthlete, deleteAthlete, assign, unassign, resolveAssignment,
    editGroup, deleteGroup, editMembership,
  };
})();
