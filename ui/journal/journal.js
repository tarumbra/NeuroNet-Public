/* ==========================================================================
   Journal — Mindfulness → Journal.

   Cam: "a new sub section of notes called journal", "the journal will act as
   a place i can write anything, that note section will be more personal and
   i should also have the ability to add photos to journal entries." Then:
   "fully migrate the journal to live in mindfullness, change the name from
   thought journal to just be journal." So it has Thought Journal's place and
   view (mind:journal), and what was written there was brought in.

   Divination saves here too. A reading pulled in Divination, or the one card
   turned on the dashboard, becomes an entry with its cards drawn at the top
   (reversed ones upside down, as they were dealt) and Cam's words under them.
   Divination no longer keeps readings of its own.

   The store is journal.py. Every picture in an entry is the journal's own
   copy, so an entry keeps its photos and cards whatever happens elsewhere.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const longDate = (iso) => {
    const d = new Date(String(iso || "").slice(0, 10) + "T12:00:00");
    return isNaN(d) ? String(iso || "")
      : d.toLocaleDateString(undefined, {weekday: "long", day: "numeric", month: "long", year: "numeric"});
  };
  const KIND_LABEL = {tarot: "Tarot", oracle: "Oracle", lenormand: "Lenormand"};

  const call = (name, args, what) => SS.Store.call(name, args || [], what || "The journal");
  const store = {
    list: () => call("journal_list", [], "Reading your journal"),
    save: (e) => call("journal_save", [e], "Saving the entry"),
    remove: (id) => call("journal_delete", [id], "Deleting the entry"),
    addReading: (reading, text, title) =>
      call("journal_add_reading", [reading, text || "", title || ""], "Saving to the journal"),
    libraryPhoto: (storedName) => call("journal_add_library_photo", [storedName], "Adding a photo"),
    pickPhotos: () => call("journal_pick_photos", [], "Adding photos"),
  };

  /* Pictures, remembered: an entry is drawn many times while it is open and
     edited, and the list redraws on every save. */
  const urls = new Map();
  function imageURL(name, thumb) {
    const key = (thumb ? "t:" : "f:") + name;
    if (!urls.has(key)) {
      urls.set(key, Promise.resolve(call("journal_image_url", [name, !!thumb], ""))
        .then((u) => u || null, () => null));
    }
    return urls.get(key);
  }
  /** Fills every [data-jimg] under `root` with its picture. */
  function paint(root) {
    root.querySelectorAll("img[data-jimg]").forEach((img) => {
      if (img.dataset.painted) return;
      img.dataset.painted = "1";
      imageURL(img.dataset.jimg, img.dataset.thumb === "1").then((u) => {
        if (u) img.src = u; else img.closest(".jn-pic, .jn-rc-art")?.classList.add("jn-missing");
      });
    });
  }

  /** A reading's cards, as the journal and the dashboard both draw them. */
  function readingHTML(r) {
    if (!r || !r.cards || !r.cards.length) return "";
    const kind = KIND_LABEL[r.kind] || "Reading";
    return `<div class="jn-reading">
      <p class="jn-reading-h">${esc(kind)}${r.spreadName ? ` · ${esc(r.spreadName)}` : ""}${
        r.deckName ? ` · ${esc(r.deckName)}` : ""}</p>
      <div class="jn-cards">${r.cards.map((c, i) => `
        <figure class="jn-rc">
          <div class="jn-rc-art ${c.reversed ? "rev" : ""}">${c.image
            ? `<img data-jimg="${esc(c.image)}" data-thumb="1" alt="">` : ""}</div>
          <figcaption>
            ${r.cards.length > 1 || c.positionLabel
              ? `<span class="jn-rc-pos">${i + 1}. ${esc(c.positionLabel || "")}</span>` : ""}
            <b>${esc(c.name)}</b>
            <span class="jn-rc-way">${c.reversed ? "Reversed" : "Upright"}</span>
          </figcaption>
        </figure>`).join("")}</div>
      ${r.cards.some((c) => c.meaning) ? `<details class="jn-meanings">
        <summary>What the cards say</summary>
        ${r.cards.filter((c) => c.meaning).map((c) =>
          `<p><b>${esc(c.name)}${c.reversed ? " (reversed)" : ""}.</b> ${esc(c.meaning)}</p>`).join("")}
      </details>` : ""}
    </div>`;
  }

  /* ---- state ------------------------------------------------------------ */
  let entries = [];
  let selId = null;         // the entry on the right
  let draft = null;         // an entry being written or edited, else null
  let query = "";
  let hostEl = null;

  async function load() {
    const got = await store.list();
    entries = (Array.isArray(got) ? got : []).slice().sort((a, b) =>
      String(b.date).localeCompare(String(a.date))
      || String(b.created).localeCompare(String(a.created)));
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => [e.title, e.text, e.date,
      e.reading && e.reading.deckName, e.reading && e.reading.spreadName,
      ...(e.reading ? e.reading.cards.map((c) => c.name) : [])]
      .some((x) => String(x || "").toLowerCase().includes(q)));
  }

  /* ---- drawing ---------------------------------------------------------- */
  function render() {
    const host = hostEl;
    if (!host) return;
    const list = filtered();
    if (!draft && selId && !entries.some((e) => e.id === selId)) selId = null;
    if (!draft && !selId && list.length) selId = list[0].id;
    host.innerHTML = `
      <div class="jn-page">
        <div class="jn-head">
          <div>
            <h2 class="page-h">Journal</h2>
            <p class="stamp">Anything you want to keep. Readings from Divination land
              here with their cards.</p>
          </div>
          <button class="btn btn-primary" id="jn-new">+ New entry</button>
        </div>
        <div class="jn-layout ${draft || selId ? "has-detail" : ""}">
          <aside class="jn-list">
            <input class="input jn-search" id="jn-q" type="search" autocomplete="off"
                   placeholder="Search the journal" aria-label="Search the journal"
                   value="${esc(query)}">
            <div class="jn-items" id="jn-items">${list.map(rowHTML).join("") || `
              <p class="jn-empty">${entries.length ? "Nothing matches that."
                : "No entries yet. Write one, or pull a reading in Divination."}</p>`}</div>
          </aside>
          <section class="jn-detail" id="jn-detail">${draft ? editorHTML(draft)
            : selId ? viewHTML(entries.find((e) => e.id === selId)) : ""}</section>
        </div>
      </div>`;
    wire(host);
    paint(host);
  }

  function rowHTML(e) {
    const snippet = (e.text || "").replace(/\s+/g, " ").trim().slice(0, 90);
    const badge = e.reading ? `<span class="jn-badge">${esc(KIND_LABEL[e.reading.kind] || "Reading")}</span>` : "";
    const pics = e.photos.length ? `<span class="jn-count" title="Photos">\u{1F4F7} ${e.photos.length}</span>` : "";
    return `<button class="jn-row ${!draft && selId === e.id ? "on" : ""}" data-entry="${esc(e.id)}">
      <span class="jn-row-date">${esc(longDate(e.date))}</span>
      <span class="jn-row-title">${esc(e.title || snippet || "Untitled")}</span>
      ${e.title && snippet ? `<span class="jn-row-snip">${esc(snippet)}</span>` : ""}
      ${badge || pics ? `<span class="jn-row-meta">${badge}${pics}</span>` : ""}
    </button>`;
  }

  function viewHTML(e) {
    if (!e) return "";
    return `<article class="jn-entry">
      <div class="jn-entry-top">
        <button class="btn btn-quiet jn-back" id="jn-back">← All entries</button>
        <span class="jn-entry-date">${esc(longDate(e.date))}</span>
        <button class="btn btn-quiet btn-sm" id="jn-edit">Edit</button>
        <button class="btn btn-quiet btn-sm jn-del" id="jn-delete">Delete</button>
      </div>
      ${e.title ? `<h3 class="jn-entry-title">${esc(e.title)}</h3>` : ""}
      ${readingHTML(e.reading)}
      ${e.text.trim() ? `<div class="jn-text">${esc(e.text)}</div>`
        : e.reading ? "" : `<p class="jn-empty">Nothing written.</p>`}
      ${e.photos.length ? `<div class="jn-pics">${e.photos.map((p) => `
        <button class="jn-pic" data-open-pic="${esc(p)}" title="Open">
          <img data-jimg="${esc(p)}" data-thumb="1" alt=""></button>`).join("")}</div>` : ""}
    </article>`;
  }

  function editorHTML(d) {
    return `<form class="jn-editor" id="jn-form" autocomplete="off">
      <div class="jn-entry-top">
        <button type="button" class="btn btn-quiet jn-back" id="jn-back">← All entries</button>
        <strong>${d.id ? "Edit entry" : "New entry"}</strong>
      </div>
      <div class="jn-fields">
        <label class="label" for="jn-date">Date</label>
        <input class="input jn-date" id="jn-date" type="date" value="${esc(d.date)}">
        <label class="label" for="jn-title">Title</label>
        <input class="input" id="jn-title" value="${esc(d.title)}" placeholder="Optional">
      </div>
      ${readingHTML(d.reading)}
      <label class="label" for="jn-text">Entry</label>
      <textarea class="input jn-textarea" id="jn-text" rows="12"
        placeholder="Write anything…">${esc(d.text)}</textarea>
      <div class="jn-photos-h">
        <span class="label">Photos</span>
        <button type="button" class="btn btn-quiet btn-sm" id="jn-add-lib">Add from Photos</button>
        <button type="button" class="btn btn-quiet btn-sm" id="jn-add-file">Add from computer</button>
      </div>
      <div class="jn-pics jn-pics-edit">${d.photos.map((p) => `
        <div class="jn-pic"><img data-jimg="${esc(p)}" data-thumb="1" alt="">
          <button type="button" class="jn-pic-x" data-rm-pic="${esc(p)}"
                  aria-label="Remove this photo" title="Remove">×</button></div>`).join("")
        || `<p class="jn-empty jn-nopics">No photos yet.</p>`}</div>
      <div class="dlg-row jn-actions">
        <span class="stamp">Ctrl+Enter saves</span>
        <button type="button" class="btn btn-quiet" id="jn-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="jn-save">Save</button>
      </div>
    </form>`;
  }

  /* ---- behaviour -------------------------------------------------------- */
  function readForm(host) {
    if (!draft) return;
    const q = (id) => host.querySelector(id);
    if (q("#jn-date")) draft.date = q("#jn-date").value || draft.date;
    if (q("#jn-title")) draft.title = q("#jn-title").value;
    if (q("#jn-text")) draft.text = q("#jn-text").value;
  }

  function startNew() {
    draft = {id: null, date: today(), title: "", text: "", photos: [], reading: null};
    render();
    const t = hostEl.querySelector("#jn-text");
    if (t) t.focus();
  }

  function wire(host) {
    const q = (id) => host.querySelector(id);
    q("#jn-new").onclick = () => { if (!draft) startNew(); };
    const search = q("#jn-q");
    search.addEventListener("input", () => {
      query = search.value;
      const box = q("#jn-items");
      const list = filtered();
      box.innerHTML = list.map(rowHTML).join("")
        || `<p class="jn-empty">Nothing matches that.</p>`;
      wireRows(host);
    });
    wireRows(host);
    const back = q("#jn-back");
    if (back) back.onclick = async () => {
      if (draft && !(await leaveDraft())) return;
      draft = null; selId = null;
      host.querySelector(".jn-layout").classList.remove("has-detail");
      host.querySelector("#jn-detail").innerHTML = "";
    };

    if (!draft && selId) {
      const e = entries.find((x) => x.id === selId);
      q("#jn-edit").onclick = () => {
        draft = JSON.parse(JSON.stringify(e));
        render();
      };
      q("#jn-delete").onclick = async () => {
        const yes = await SS.shared.confirm({title: "Delete this entry?",
          body: `${e.title || longDate(e.date)} will be gone, with its photos.`,
          yes: "Delete"});
        if (!yes) return;
        const res = await store.remove(e.id);
        if (!res || res.error) { SS.shared.toast((res && res.error) || "That didn't work.", "error"); return; }
        selId = null;
        await load();
        render();
        SS.shared.toast("Entry deleted.");
      };
      host.querySelectorAll("[data-open-pic]").forEach((b) =>
        b.onclick = () => openPhoto(b.dataset.openPic));
    }

    if (draft) {
      const form = q("#jn-form");
      form.addEventListener("submit", (ev) => { ev.preventDefault(); saveDraft(host); });
      form.addEventListener("keydown", (ev) => {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); saveDraft(host); }
      });
      q("#jn-cancel").onclick = async () => {
        if (!(await leaveDraft())) return;
        draft = null;
        render();
      };
      q("#jn-add-lib").onclick = async () => {
        readForm(host);
        const picked = await SS.shared.pickFromLibrary({title: "Add a photo to this entry"});
        if (!picked) return;
        const res = await store.libraryPhoto(picked.storedName);
        if (!res || res.error) { SS.shared.toast((res && res.error) || "Couldn't add that photo.", "error"); return; }
        draft.photos.push(res.name);
        render();
      };
      q("#jn-add-file").onclick = async () => {
        readForm(host);
        const res = await store.pickPhotos();
        if (!res || res.cancelled) return;
        if (res.error) { SS.shared.toast(res.error, "error"); return; }
        draft.photos.push(...(res.names || []));
        if (res.skipped && res.skipped.length) {
          SS.shared.toast(`${res.skipped.length} file${res.skipped.length === 1 ? " wasn't an image" : "s weren't images"}.`, "error");
        }
        render();
      };
      host.querySelectorAll("[data-rm-pic]").forEach((b) => b.onclick = () => {
        readForm(host);
        draft.photos = draft.photos.filter((p) => p !== b.dataset.rmPic);
        render();
      });
    }
  }

  function wireRows(host) {
    host.querySelectorAll("[data-entry]").forEach((b) => b.onclick = async () => {
      if (draft && !(await leaveDraft())) return;
      draft = null;
      selId = b.dataset.entry;
      render();
    });
  }

  /** True when it is fine to drop what is being written. */
  async function leaveDraft() {
    if (!draft) return true;
    readForm(hostEl);
    const old = draft.id ? entries.find((e) => e.id === draft.id) : null;
    const changed = old
      ? old.title !== draft.title || old.text !== draft.text || old.date !== draft.date
        || old.photos.join("|") !== draft.photos.join("|")
      : !!(draft.title.trim() || draft.text.trim() || draft.photos.length);
    if (!changed) return true;
    return SS.shared.confirm({title: "Leave without saving?",
      body: "What you've written in this entry will be lost.", yes: "Leave"});
  }

  async function saveDraft(host) {
    readForm(host);
    const res = await store.save(draft);
    if (!res || res.error) { SS.shared.toast((res && res.error) || "That didn't save.", "error"); return; }
    selId = res.entry.id;
    draft = null;
    await load();
    render();
    SS.shared.toast("Saved to your journal.");
  }

  async function openPhoto(name) {
    const d = SS.shared.openDlg("Photo", `<div class="jn-photo-big"><img alt=""></div>`, true);
    d.btn("Close", "btn-quiet", d.close);
    const u = await imageURL(name, false);
    const img = d.body.querySelector("img");
    if (img && u) img.src = u;
  }

  SS.Journal = {
    VIEWS: ["mind:journal"],
    PREFIX: "mind:journal",
    async mount(host) {
      hostEl = host;
      host.style.display = "";
      await load();
      render();
    },
    /* For Divination and the dashboard: save a reading, and draw one. */
    addReading: (reading, text, title) => store.addReading(reading, text, title),
    readingHTML,
    paint,
    /** Opens the journal on a given entry (after a reading is saved). */
    open(entryId) {
      selId = entryId || null;
      draft = null;
      SS.go("mind:journal");
    },
    _test: {normalizeQuery: (q) => { query = q; return filtered(); },
            setEntries: (list) => { entries = list; }, longDate},
  };
})();
