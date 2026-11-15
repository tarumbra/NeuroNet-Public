/* ==========================================================================
   CF.Builders — creating and editing circuits and sessions.

   Everything here edits a deep copy and only writes it back on Save, so
   backing out of an editor leaves the stored document untouched. That
   matters more than usual: this is the same coach_cam.json the original
   desktop app reads, and a half-applied edit would show up there too.

   New records are given the original app's own id format
   (milliseconds-base36suffix) rather than a UUID, so records made here and
   records made there are indistinguishable to either app.
   ========================================================================== */
CF.Builders = (() => {
  "use strict";

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const icon = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24"><use href="#i-${n}"/></svg>`;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  /** The id shape the original Coach Cam generates. */
  function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  let host = null;      // the editor overlay, while one is open
  let onDone = null;    // called after a successful save or delete

  function close() {
    if (host) { host.remove(); host = null; }
  }

  /** True while an editor is open — app.js checks this before handling
      keyboard shortcuts that would otherwise fire mid-typing. */
  const isOpen = () => !!host;

  function shell({ title, subtitle, body, saveLabel = "Save" }) {
    close();
    host = document.createElement("div");
    host.className = "editor-pane";
    host.innerHTML = `
      <header class="topbar">
        <button class="icon-btn" data-cancel aria-label="Cancel">${icon("close")}</button>
        <div class="topbar-title">
          <span class="crumb">${esc(subtitle || "")}</span>
          <span class="page-title">${esc(title)}</span>
        </div>
        <button class="topbar-save" data-save>${saveLabel}</button>
      </header>
      <div class="editor-body">${body}</div>`;
    CF.uiRoot().appendChild(host);      /* not document.body — see bridge.js */
    return host;
  }

  const q = (sel) => host.querySelector(sel);
  const qa = (sel) => [...host.querySelectorAll(sel)];

  /* ---- the exercise picker -------------------------------------------- */

  /** A searchable list of the library, offered as a sheet. `onPick` gets
      {name, category}; a name typed by hand comes back with no category. */
  async function pickExercise(onPick) {
    const index = await CF.Store.exerciseIndex();
    const sheetHost = document.getElementById("sheetHost");
    const sheetTitle = document.getElementById("sheetTitle");
    const sheetBody = document.getElementById("sheetBody");

    sheetTitle.textContent = "Add an exercise";
    sheetBody.innerHTML = `
      <div class="search-wrap">
        ${icon("search", "ic search-ic")}
        <input class="search-input" id="pickSearch" type="search"
          placeholder="Search the library" autocomplete="off" autocapitalize="off">
      </div>
      <div class="pick-list" id="pickList"></div>`;
    sheetHost.hidden = false;

    const input = sheetBody.querySelector("#pickSearch");
    const list = sheetBody.querySelector("#pickList");

    const closeSheet = () => { sheetHost.hidden = true; sheetBody.innerHTML = ""; };

    function draw() {
      const query = input.value.trim();
      const lower = query.toLowerCase();
      /* Rank by how the match was made, not alphabetically: an exact name
         first, then names starting with the query, then names containing it,
         then instruction-text matches. Typing "Pushup" should not lead with
         "Alternating Pushup". */
      const rank = (e) => {
        if (e.nameLower === lower) return 0;
        if (e.nameLower.startsWith(lower)) return 1;
        if (e.nameLower.includes(lower)) return 2;
        return 3;
      };
      const hits = (lower
        ? index.filter((e) => e.haystack.includes(lower))
            .sort((a, b) => rank(a) - rank(b) ||
              a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
        : index
      ).slice(0, 60);

      const exact = hits.some((e) => e.nameLower === lower);
      list.innerHTML =
        (query && !exact
          ? `<button class="pick-row is-new" data-custom="1">
               ${icon("note-plus")}<span>Use “${esc(query)}” as typed</span></button>`
          : "") +
        (hits.length
          ? hits.map((e, i) => `
              <button class="pick-row" data-i="${i}">
                <span class="pick-name">${esc(e.name)}</span>
                <span class="tag moss">${esc(e.category)}</span>
              </button>`).join("")
          : (query ? "" : `<p class="empty-note">The library is empty.</p>`));

      list.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => {
        const e = hits[Number(b.dataset.i)];
        closeSheet();
        onPick({ name: e.name, category: e.category });
      }));
      const custom = list.querySelector("[data-custom]");
      if (custom) custom.addEventListener("click", () => {
        closeSheet();
        onPick({ name: query, category: "" });
      });
    }

    input.addEventListener("input", draw);
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const first = list.querySelector(".pick-row");
      if (first) first.click();
    });
    draw();
    setTimeout(() => input.focus(), 80);
  }

  /* ---- tags and guide links ------------------------------------------- */

  /*
   * Tags and linked guides are both stored on the record itself — `tags` as
   * plain strings, `guideIds` as guide ids. Strings rather than ids for tags
   * is deliberate: a tag has no life of its own, and a separate tag table
   * would need managing, migrating and garbage-collecting for no gain.
   *
   * The original app ignores both fields and preserves them, because it
   * assigns known fields onto the existing record rather than rebuilding it.
   */

  /** Every tag in use across sessions and circuits, for suggestions. */
  async function knownTags() {
    const doc = await CF.Store.load();
    const set = new Set();
    for (const list of [doc.sessions || [], doc.circuits || []]) {
      for (const record of list) (record.tags || []).forEach((t) => set.add(t));
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  function tagsMarkup(id) {
    return `
      <div class="chips" data-tag-list="${id}"></div>
      <div class="field-pair" style="margin-top:6px">
        <div class="field">
          <input data-tag-input="${id}" list="tagOptions-${id}"
            placeholder="Add a tag" autocomplete="off">
          <datalist id="tagOptions-${id}"></datalist>
        </div>
        <button class="secondary-btn" data-tag-add="${id}" style="flex:none">Add</button>
      </div>`;
  }

  /** Wire the tag editor to a record's tags array. */
  async function wireTags(scope, id, tags) {
    const list = scope.querySelector(`[data-tag-list="${id}"]`);
    const input = scope.querySelector(`[data-tag-input="${id}"]`);
    const options = scope.querySelector(`#tagOptions-${id}`);

    const suggestions = await knownTags();
    options.innerHTML = suggestions.map((t) => `<option value="${esc(t)}">`).join("");

    function draw() {
      list.innerHTML = tags.length
        ? tags.map((t, i) => `
            <button class="chip on" data-drop-tag="${i}" title="Remove">
              ${esc(t)} <span aria-hidden="true">&times;</span>
            </button>`).join("")
        : `<span class="chip is-empty">No tags yet</span>`;
      list.querySelectorAll("[data-drop-tag]").forEach((b) =>
        b.addEventListener("click", () => {
          tags.splice(Number(b.dataset.dropTag), 1);
          draw();
        }));
    }
    draw();

    const add = () => {
      const value = input.value.trim();
      if (!value) return;
      // Case-insensitive match against what is already in use, so "Max
      // strength" and "max strength" never both exist as separate filters.
      const existing = suggestions.find((t) => t.toLowerCase() === value.toLowerCase());
      const tag = existing || value;
      if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
      input.value = "";
      draw();
    };
    scope.querySelector(`[data-tag-add="${id}"]`).addEventListener("click", add);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); add(); }
    });
  }

  function guidesMarkup(id) {
    return `
      <div class="rows" data-guide-list="${id}"></div>
      <button class="secondary-btn add-btn" data-guide-add="${id}">
        ${icon("guide")}Link a guide</button>`;
  }

  /** Wire the linked-guides editor to a record's guideIds array. */
  async function wireGuides(scope, id, guideIds) {
    const doc = await CF.Store.load();
    const list = scope.querySelector(`[data-guide-list="${id}"]`);

    function draw() {
      const guides = doc.guides || [];
      list.innerHTML = guideIds.length
        ? guideIds.map((gid, i) => {
            const g = guides.find((x) => x.id === gid);
            return `<div class="station">
              <span class="station-n">${icon("guide")}</span>
              <div class="station-main">
                <div class="station-name">${esc(g ? g.name : "A guide that is no longer saved")}</div>
              </div>
              <button class="tool-btn is-danger" data-drop-guide="${i}"
                aria-label="Unlink">${icon("trash")}</button>
            </div>`;
          }).join("")
        : `<p class="empty-note">No guides linked.</p>`;
      list.querySelectorAll("[data-drop-guide]").forEach((b) =>
        b.addEventListener("click", () => {
          guideIds.splice(Number(b.dataset.dropGuide), 1);
          draw();
        }));
    }
    draw();

    scope.querySelector(`[data-guide-add="${id}"]`).addEventListener("click", () => {
      CF.Manage.pickRecord("guides", "Which guide?", (g) => {
        if (!guideIds.includes(g.id)) guideIds.push(g.id);
        draw();
      });
    });
  }

  /* ---- shared row plumbing -------------------------------------------- */

  /**
   * Rows are re-rendered wholesale after a structural change (add, remove,
   * reorder) but never while typing — rebuilding the DOM under a focused
   * input would drop the caret and the keyboard. Text edits write straight
   * into the model and leave the DOM alone.
   */
  function bindRows(container, model, redraw) {
    container.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        model[Number(input.dataset.row)][input.dataset.field] = input.value;
      });
    });
    container.querySelectorAll("[data-up]").forEach((b) =>
      b.addEventListener("click", () => {
        const i = Number(b.dataset.up);
        if (i === 0) return;
        [model[i - 1], model[i]] = [model[i], model[i - 1]];
        redraw();
      }));
    container.querySelectorAll("[data-down]").forEach((b) =>
      b.addEventListener("click", () => {
        const i = Number(b.dataset.down);
        if (i >= model.length - 1) return;
        [model[i + 1], model[i]] = [model[i], model[i + 1]];
        redraw();
      }));
    container.querySelectorAll("[data-remove]").forEach((b) =>
      b.addEventListener("click", () => {
        model.splice(Number(b.dataset.remove), 1);
        redraw();
      }));
    container.querySelectorAll("[data-rename]").forEach((b) =>
      b.addEventListener("click", () => {
        pickExercise((picked) => {
          const row = model[Number(b.dataset.rename)];
          row.name = picked.name;
          if (picked.category) row.category = picked.category;
          redraw();
        });
      }));
  }

  const fieldCell = (row, field, label, value, hint = "") => `
    <label class="cell">
      <span class="cell-label">${esc(label)}</span>
      <input data-row="${row}" data-field="${field}" value="${esc(value || "")}"
        placeholder="${esc(hint)}" autocomplete="off" autocapitalize="off">
    </label>`;

  const rowControls = (i, total) => `
    <div class="row-tools">
      <button class="tool-btn" data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move up">${icon("up")}</button>
      <button class="tool-btn" data-down="${i}" ${i === total - 1 ? "disabled" : ""} aria-label="Move down">${icon("down")}</button>
      <button class="tool-btn is-danger" data-remove="${i}" aria-label="Remove">${icon("trash")}</button>
    </div>`;

  /* ---- circuit editor -------------------------------------------------- */

  async function editCircuit(existing, done) {
    onDone = done;
    const isNew = !existing;
    /* The original writes circuits with type, notes, parts and equipment
       alongside the obvious fields, and its exporter renders all of them. A
       new circuit is given the whole shape so it is indistinguishable from
       one built there; an edited circuit keeps whatever it already had,
       including parts and equipment, which this editor does not surface. */
    const model = existing
      ? clone(existing)
      : {
          id: makeId(), name: "", type: "", rounds: "1", timeCap: "",
          created: new Date().toISOString(), notes: "",
          parts: [], stations: [], equipment: [], logEntries: [],
          tags: [], guideIds: [],
        };
    if (!Array.isArray(model.stations)) model.stations = [];
    if (!Array.isArray(model.parts)) model.parts = [];
    if (!Array.isArray(model.equipment)) model.equipment = [];
    if (!Array.isArray(model.tags)) model.tags = [];
    if (!Array.isArray(model.guideIds)) model.guideIds = [];

    const circuitTypes = ((await CF.Store.load()).circuitTypes) || [];

    shell({
      title: isNew ? "New circuit" : "Edit circuit",
      subtitle: isNew ? "" : existing.name,
      body: `
        <div class="field">
          <label for="cName">Circuit name</label>
          <input id="cName" value="${esc(model.name)}" placeholder="Name this circuit" autocomplete="off">
        </div>
        <div class="field-pair">
          <div class="field"><label for="cRounds">Rounds</label>
            <input id="cRounds" value="${esc(model.rounds || "1")}" inputmode="numeric"></div>
          <div class="field"><label for="cCap">Time cap</label>
            <input id="cCap" value="${esc(model.timeCap || "")}" placeholder="optional"></div>
        </div>
        <div class="field">
          <label for="cType">Type</label>
          <input id="cType" value="${esc(model.type || "")}" list="cTypes"
            placeholder="optional — AMRAP, EMOM, Chipper…" autocomplete="off">
          <datalist id="cTypes">${circuitTypes
            .map((t) => `<option value="${esc(t)}">`).join("")}</datalist>
        </div>
        <div class="field">
          <label for="cNotes">Notes</label>
          <textarea id="cNotes" class="q-text-input" rows="3"
            placeholder="Anything to remember when running it — scaling, setup, safety">${esc(model.notes || "")}</textarea>
        </div>
        <p class="section-h">Tags</p>
        ${tagsMarkup("circuit")}
        <p class="section-h">Stations</p>
        <div class="rows" id="cRows"></div>
        <button class="secondary-btn add-btn" id="cAdd">${icon("note-plus")}Add a station</button>
        <p class="section-h">Linked guides</p>
        ${guidesMarkup("circuit")}
        <p class="editor-hint">Work and rest accept whatever you already write —
          <code>40 S</code>, <code>1:30</code>, <code>90</code>. Anything the timer
          can read becomes a countdown; anything else becomes a tap-to-advance step.</p>`,
    });

    wireTags(host, "circuit", model.tags);
    wireGuides(host, "circuit", model.guideIds);

    const rows = q("#cRows");

    function draw() {
      rows.innerHTML = model.stations.length
        ? model.stations.map((s, i) => `
            <div class="row-card">
              <div class="row-head">
                <span class="station-n">${i + 1}</span>
                <button class="row-name" data-rename="${i}">
                  <span>${esc(s.name || "Choose an exercise")}</span>
                  ${s.category ? `<span class="tag moss">${esc(s.category)}</span>` : ""}
                </button>
                ${rowControls(i, model.stations.length)}
              </div>
              <div class="cells">
                ${fieldCell(i, "workTime", "Work", s.workTime, "40 S")}
                ${fieldCell(i, "reps", "Reps", s.reps, "12")}
                ${fieldCell(i, "load", "Load", s.load, "20 kg")}
                ${fieldCell(i, "rest", "Rest", s.rest, "20 S")}
              </div>
            </div>`).join("")
        : `<p class="empty-note">No stations yet.</p>`;
      bindRows(rows, model.stations, draw);
    }
    draw();

    q("#cAdd").addEventListener("click", () => {
      pickExercise((picked) => {
        // A new station inherits the previous one's timings — circuits are
        // usually uniform, and retyping 40/20 per station is tedious.
        const last = model.stations[model.stations.length - 1];
        model.stations.push({
          name: picked.name, category: picked.category,
          workTime: last ? last.workTime : "",
          reps: "", load: "",
          rest: last ? last.rest : "",
        });
        draw();
      });
    });

    wireSave(() => {
      model.name = q("#cName").value.trim();
      model.rounds = q("#cRounds").value.trim() || "1";
      model.timeCap = q("#cCap").value.trim();
      model.type = q("#cType").value.trim();
      model.notes = q("#cNotes").value;
      if (!model.name) return "Give the circuit a name first.";
      if (!model.stations.length) return "Add at least one station.";
      if (model.stations.some((s) => !s.name.trim())) return "Every station needs an exercise.";
      return { collection: "circuits", record: model, isNew };
    });
  }

  /* ---- session editor -------------------------------------------------- */

  /** Blocks run A1, A2, B1… — a new item continues the current letter. */
  function nextBlock(items) {
    if (!items.length) return "A1";
    const last = String(items[items.length - 1].block || "A1");
    const m = last.match(/^([A-Za-z]+)(\d+)$/);
    if (!m) return "A1";
    return `${m[1]}${Number(m[2]) + 1}`;
  }

  function nextLetter(items) {
    if (!items.length) return "A1";
    const letters = items
      .map((i) => String(i.block || "").match(/^([A-Za-z]+)/))
      .filter(Boolean).map((m) => m[1].toUpperCase());
    if (!letters.length) return "A1";
    const highest = letters.sort().pop();
    return `${String.fromCharCode(highest.charCodeAt(0) + 1)}1`;
  }

  function editSession(existing, done) {
    onDone = done;
    const isNew = !existing;
    const model = existing
      ? clone(existing)
      : {
          id: makeId(), name: "", created: new Date().toISOString(),
          notes: "", parts: [], items: [], equipment: [], logEntries: [],
          tags: [], guideIds: [],
        };
    if (!Array.isArray(model.items)) model.items = [];
    if (!Array.isArray(model.parts)) model.parts = [];
    if (!Array.isArray(model.equipment)) model.equipment = [];
    if (!Array.isArray(model.tags)) model.tags = [];
    if (!Array.isArray(model.guideIds)) model.guideIds = [];

    shell({
      title: isNew ? "New session" : "Edit session",
      subtitle: isNew ? "" : existing.name,
      body: `
        <div class="field">
          <label for="sName">Session name</label>
          <input id="sName" value="${esc(model.name)}" placeholder="Name this session" autocomplete="off">
        </div>
        <div class="field">
          <label for="sNotes">Notes</label>
          <textarea id="sNotes" class="q-text-input" rows="3"
            placeholder="Anything to remember when running it">${esc(model.notes || "")}</textarea>
        </div>
        <p class="section-h">Tags</p>
        ${tagsMarkup("session")}
        <p class="section-h">Exercises</p>
        <div class="rows" id="sRows"></div>
        <div class="btn-row">
          <button class="secondary-btn add-btn" id="sAdd">${icon("note-plus")}Add to block</button>
          <button class="secondary-btn add-btn" id="sAddBlock">${icon("note-plus")}Start new block</button>
        </div>
        <p class="section-h">Linked guides</p>
        ${guidesMarkup("session")}
        <p class="editor-hint">Blocks group what's performed together —
          <code>A1</code> and <code>A2</code> alternate, then <code>B1</code> starts
          the next group. Add to block continues the current letter.</p>`,
    });

    wireTags(host, "session", model.tags);
    wireGuides(host, "session", model.guideIds);

    const rows = q("#sRows");

    function draw() {
      rows.innerHTML = model.items.length
        ? model.items.map((it, i) => `
            <div class="row-card">
              <div class="row-head">
                <input class="block-input" data-row="${i}" data-field="block"
                  value="${esc(it.block || "")}" aria-label="Block" autocomplete="off">
                <button class="row-name" data-rename="${i}">
                  <span>${esc(it.name || "Choose an exercise")}</span>
                  ${it.category ? `<span class="tag moss">${esc(it.category)}</span>` : ""}
                </button>
                ${rowControls(i, model.items.length)}
              </div>
              <div class="cells">
                ${fieldCell(i, "sets", "Sets", it.sets, "3")}
                ${fieldCell(i, "reps", "Reps", it.reps, "12")}
                ${fieldCell(i, "load", "Load", it.load, "20 kg")}
                ${fieldCell(i, "rest", "Rest", it.rest, "60s")}
              </div>
            </div>`).join("")
        : `<p class="empty-note">Nothing in this session yet.</p>`;
      bindRows(rows, model.items, draw);
    }
    draw();

    const addItem = (block) => pickExercise((picked) => {
      const last = model.items[model.items.length - 1];
      model.items.push({
        name: picked.name, category: picked.category, block,
        sets: last ? last.sets : "",
        reps: "", load: "",
        rest: last ? last.rest : "",
      });
      draw();
    });

    q("#sAdd").addEventListener("click", () => addItem(nextBlock(model.items)));
    q("#sAddBlock").addEventListener("click", () => addItem(nextLetter(model.items)));

    wireSave(() => {
      model.name = q("#sName").value.trim();
      model.notes = q("#sNotes").value;
      if (!model.name) return "Give the session a name first.";
      if (!model.items.length) return "Add at least one exercise.";
      if (model.items.some((it) => !it.name.trim())) return "Every row needs an exercise.";
      return { collection: "sessions", record: model, isNew };
    });
  }


  /* ---- guide editor ---------------------------------------------------- */

  /*
   * The original app's Word exporter parses a deliberately narrow set of
   * tags: p/div, br, b/strong, i/em, u, li, and span/font carrying an inline
   * color or a font-size in px. Anything else it does not know about is
   * dropped. So this editor is built to emit exactly that set — headings are
   * a bold span at 20px inside a paragraph, which is what the desktop
   * editor already produces and what the stored guides already contain.
   * Emitting <h2> here would look right on screen and vanish in Word.
   */
  const HEADING_PX = 20;

  /** execCommand is deprecated, but it is still the only thing that edits a
      contenteditable and leaves the browser's own undo stack intact. Bold and
      friends must emit tags, not CSS, so styleWithCSS is flipped per command:
      b/i/u as tags, colour as a styled span. */
  function exec(command, value = null, useCss = false) {
    try {
      document.execCommand("styleWithCSS", false, useCss);
      document.execCommand(command, false, value);
    } catch { /* nothing sensible to do if the browser refuses */ }
  }

  /** The block element the caret currently sits in, within `root`. */
  function currentBlock(root) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node !== root) {
      if (/^(P|DIV|LI|H[1-6])$/.test(node.nodeName)) return node;
      node = node.parentNode;
    }
    return null;
  }

  const isHeadingBlock = (block) => {
    if (!block) return false;
    const span = block.querySelector(`span[style*="font-size"]`);
    return !!(span && block.querySelector("b, strong"));
  };

  /** Turn the caret's paragraph into a heading, or back into body text. */
  function toggleHeading(root) {
    const block = currentBlock(root);
    if (!block) return;
    if (isHeadingBlock(block)) {
      block.innerHTML = block.textContent;
    } else {
      const text = block.textContent;
      if (!text.trim()) return;
      block.innerHTML =
        `<b><span style="font-size: ${HEADING_PX}px;">${esc(text)}</span></b>`;
    }
  }

  /*
   * Applying a colour over text that is already bold makes the browser put
   * the colour on the <b> itself — <b style="color: ...">. On screen that
   * looks correct, but the desktop app's Word exporter only reads colour and
   * size from span and font tags, so the colour would silently disappear on
   * export. Move any such style onto a wrapping span, which the exporter does
   * read. Runs after every colour command and again before saving.
   */
  function normaliseInlineStyles(root) {
    root.querySelectorAll("[style]").forEach((node) => {
      if (/^(SPAN|FONT)$/.test(node.nodeName)) return;
      const colour = node.style.color;
      const size = node.style.fontSize;
      if (!colour && !size) return;

      node.style.removeProperty("color");
      node.style.removeProperty("font-size");
      if (!node.getAttribute("style")) node.removeAttribute("style");

      const span = document.createElement("span");
      if (colour) span.style.color = colour;
      if (size) span.style.fontSize = size;
      while (node.firstChild) span.appendChild(node.firstChild);
      node.appendChild(span);
    });
  }

  const GUIDE_TOOLS = [
    { cmd: "bold", icon: "bold", label: "Bold" },
    { cmd: "italic", icon: "italic", label: "Italic" },
    { cmd: "underline", icon: "underline", label: "Underline" },
    { cmd: "heading", icon: "heading", label: "Heading" },
    { cmd: "insertUnorderedList", icon: "ul", label: "Bulleted list" },
    { cmd: "insertOrderedList", icon: "ol", label: "Numbered list" },
    { cmd: "removeFormat", icon: "clear", label: "Clear formatting" },
  ];

  const GUIDE_COLOURS = ["#DCE7DF", "#8FE3AE", "#E0B45F", "#E0785F", "#7FB2E0"];

  /** The toolbar markup, so anything else needing rich text gets the same
      one rather than a second, subtly different implementation. */
  function richTextToolbar(id) {
    return `<div class="rte-tools" data-rte-tools="${id}">
      ${GUIDE_TOOLS.map((t) => `
        <button class="tool-btn" data-cmd="${t.cmd}" aria-label="${esc(t.label)}"
          title="${esc(t.label)}">${icon(t.icon)}</button>`).join("")}
      <span class="tool-sep" aria-hidden="true"></span>
      ${GUIDE_COLOURS.map((c) => `
        <button class="swatch" data-colour="${c}" style="background:${c}"
          aria-label="Text colour ${c}" title="Text colour"></button>`).join("")}
    </div>`;
  }

  /** Wire a toolbar to its editable region. Returns a getter that normalises
      the markup on the way out, so every caller gets export-safe HTML. */
  function wireRichText(toolsEl, bodyEl, initialHtml) {
    bodyEl.innerHTML = initialHtml || "<p><br></p>";

    toolsEl.addEventListener("mousedown", (e) => {
      // Keep the caret in the body; a toolbar that steals focus loses the
      // selection the command is meant to apply to.
      if (e.target.closest("button")) e.preventDefault();
    });
    toolsEl.addEventListener("click", (e) => {
      const tool = e.target.closest("[data-cmd]");
      const swatch = e.target.closest("[data-colour]");
      bodyEl.focus();
      if (swatch) {
        exec("foreColor", swatch.dataset.colour, true);
        normaliseInlineStyles(bodyEl);
        return;
      }
      if (!tool) return;
      if (tool.dataset.cmd === "heading") toggleHeading(bodyEl);
      else exec(tool.dataset.cmd);
    });

    return {
      html() {
        normaliseInlineStyles(bodyEl);
        return bodyEl.innerHTML.trim();
      },
      isEmpty: () => !bodyEl.textContent.trim(),
    };
  }

  function editGuide(existing, done) {
    onDone = done;
    const isNew = !existing;
    const model = existing
      ? clone(existing)
      : { id: makeId(), name: "", bodyHtml: "", entries: [], created: new Date().toISOString() };

    shell({
      title: isNew ? "New guide" : "Edit guide",
      subtitle: isNew ? "" : existing.name,
      body: `
        <div class="field">
          <label for="gName">Guide name</label>
          <input id="gName" value="${esc(model.name)}" placeholder="Name this guide" autocomplete="off">
        </div>
        <div class="rte-tools" id="gTools">
          ${GUIDE_TOOLS.map((t) => `
            <button class="tool-btn" data-cmd="${t.cmd}" aria-label="${esc(t.label)}"
              title="${esc(t.label)}">${icon(t.icon)}</button>`).join("")}
          <span class="tool-sep" aria-hidden="true"></span>
          ${GUIDE_COLOURS.map((c) => `
            <button class="swatch" data-colour="${c}" style="background:${c}"
              aria-label="Text colour ${c}" title="Text colour"></button>`).join("")}
        </div>
        <div class="rte" id="gBody" contenteditable="true" spellcheck="true"
          role="textbox" aria-multiline="true" aria-label="Guide body"></div>
        <p class="editor-hint">Formatting is kept to what the desktop app's Word
          export understands — bold, italic, underline, colour, size and lists.
          A heading is a bold line at ${HEADING_PX}px, the same as the guides
          already saved.</p>`,
    });

    const body = q("#gBody");
    // Set as a property rather than in the template: the stored HTML is Cam's
    // own and must go in as markup, but it should not be re-parsed as part of
    // the surrounding template string.
    body.innerHTML = model.bodyHtml || "<p><br></p>";

    q("#gTools").addEventListener("mousedown", (e) => {
      // Keep the caret in the body; a toolbar that steals focus loses the
      // selection the command is supposed to apply to.
      if (e.target.closest("button")) e.preventDefault();
    });

    q("#gTools").addEventListener("click", (e) => {
      const tool = e.target.closest("[data-cmd]");
      const swatch = e.target.closest("[data-colour]");
      body.focus();
      if (swatch) {
        exec("foreColor", swatch.dataset.colour, true);
        normaliseInlineStyles(body);
        return;
      }
      if (!tool) return;
      if (tool.dataset.cmd === "heading") toggleHeading(body);
      else exec(tool.dataset.cmd);
    });

    wireSave(() => {
      model.name = q("#gName").value.trim();
      normaliseInlineStyles(body);
      model.bodyHtml = body.innerHTML.trim();
      if (!model.name) return "Give the guide a name first.";
      if (!body.textContent.trim()) return "The guide is empty.";
      return { collection: "guides", record: model, isNew };
    });
  }

  /* ---- questionnaire editor -------------------------------------------- */

  /* The original offers exactly two kinds of question, and the stored data
     only ever contains these two. Adding a third here would produce records
     the desktop app could not render. */
  const QUESTION_TYPES = [
    { value: "short", label: "Short answer" },
    { value: "rating", label: "Rating 1–10" },
  ];

  function editQuestionnaire(existing, done) {
    onDone = done;
    const isNew = !existing;
    const model = existing
      ? clone(existing)
      : { id: makeId(), name: "", questions: [], created: new Date().toISOString() };
    if (!Array.isArray(model.questions)) model.questions = [];

    shell({
      title: isNew ? "New questionnaire" : "Edit questionnaire",
      subtitle: isNew ? "" : existing.name,
      body: `
        <div class="field">
          <label for="qName">Questionnaire name</label>
          <input id="qName" value="${esc(model.name)}" placeholder="Name this form" autocomplete="off">
        </div>
        <p class="section-h">Questions</p>
        <div class="rows" id="qRows"></div>
        <button class="secondary-btn add-btn" id="qAdd">${icon("note-plus")}Add a question</button>
        <p class="editor-hint">Short answer gives a free-text box. Rating gives a
          1–10 scale. These are the two the desktop app understands.</p>`,
    });

    const rows = q("#qRows");

    function draw() {
      rows.innerHTML = model.questions.length
        ? model.questions.map((question, i) => `
            <div class="row-card">
              <div class="row-head">
                <span class="station-n">${i + 1}</span>
                <select class="type-select" data-row="${i}" data-field="type" aria-label="Question type">
                  ${QUESTION_TYPES.map((t) => `
                    <option value="${t.value}" ${question.type === t.value ? "selected" : ""}>${t.label}</option>`).join("")}
                </select>
                ${rowControls(i, model.questions.length)}
              </div>
              <textarea class="q-text-input" data-row="${i}" data-field="text" rows="2"
                placeholder="Type the question">${esc(question.text || "")}</textarea>
            </div>`).join("")
        : `<p class="empty-note">No questions yet.</p>`;

      // Selects and textareas use the same data-field plumbing as the other
      // editors, so they bind the same way.
      rows.querySelectorAll("[data-field]").forEach((input) => {
        input.addEventListener("input", () => {
          model.questions[Number(input.dataset.row)][input.dataset.field] = input.value;
        });
        input.addEventListener("change", () => {
          model.questions[Number(input.dataset.row)][input.dataset.field] = input.value;
        });
      });
      bindRows(rows, model.questions, draw);
    }
    draw();

    q("#qAdd").addEventListener("click", () => {
      const last = model.questions[model.questions.length - 1];
      model.questions.push({ text: "", type: last ? last.type : "short" });
      draw();
      const boxes = rows.querySelectorAll(".q-text-input");
      const added = boxes[boxes.length - 1];
      if (added) added.focus();
    });

    wireSave(() => {
      model.name = q("#qName").value.trim();
      if (!model.name) return "Give the questionnaire a name first.";
      if (!model.questions.length) return "Add at least one question.";
      if (model.questions.some((question) => !String(question.text).trim())) {
        return "Every question needs text.";
      }
      return { collection: "questionnaires", record: model, isNew };
    });
  }

  /* ---- committing ------------------------------------------------------ */

  /** `validate` returns either a message string (a problem) or the record to
      write. Nothing reaches disk until it returns a record. */
  function wireSave(validate) {
    q("[data-save]").addEventListener("click", async () => {
      const result = validate();
      if (typeof result === "string") { CF.toast(result); return; }

      const doc = await CF.Store.load();
      const list = doc[result.collection];
      const at = list.findIndex((r) => r.id === result.record.id);
      if (at === -1) list.push(result.record); else list[at] = result.record;

      await CF.Store.save();
      close();
      CF.toast(result.isNew ? "Saved" : "Changes saved");
      if (onDone) onDone(result.record);
    });

    q("[data-cancel]").addEventListener("click", close);
  }

  /* ---- delete and duplicate ------------------------------------------- */

  async function removeRecord(collection, id) {
    const doc = await CF.Store.load();
    doc[collection] = doc[collection].filter((r) => r.id !== id);
    await CF.Store.save();
  }

  async function duplicateRecord(collection, id) {
    const doc = await CF.Store.load();
    const source = doc[collection].find((r) => r.id === id);
    if (!source) return null;
    const copy = clone(source);
    copy.id = makeId();
    copy.name = `${source.name} copy`;
    copy.created = new Date().toISOString();
    doc[collection].push(copy);
    await CF.Store.save();
    return copy;
  }

  return {
    editCircuit, editSession, editGuide, editQuestionnaire,
    richTextToolbar, wireRichText, HEADING_PX, knownTags,
    removeRecord, duplicateRecord,
    pickExercise, makeId, close, isOpen, QUESTION_TYPES,
  };
})();
