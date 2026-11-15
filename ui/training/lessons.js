/* ==========================================================================
   CF.Lessons — building lesson plans.

   The record shape comes from build_lessonplan_docx in documents.py:

     plan        {id, name, created, favorite, date, location, stores,
                  overviewHtml, layoutPhoto, refs, textBoxes}
     layoutPhoto {storedName, originalName} or null
     ref         {type: "session"|"circuit", session|circuit: <embedded copy>}
     textBox     {title, bodyHtml}

   Worth being explicit, because it is easy to assume otherwise from the name:
   there are no coordinates anywhere in this record. The class layout is a
   photograph, and the text boxes are titled blocks of rich text in order.
   Nothing here is positioned on a canvas.

   Attached sessions and circuits are embedded copies, matching what the
   exporter reads and matching programs — a plan already handed out should not
   change because the session it was built from was edited afterwards.
   ========================================================================== */
CF.Lessons = (() => {
  "use strict";

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const icon = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24"><use href="#i-${n}"/></svg>`;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let host = null;
  const isOpen = () => !!host;
  function close() { if (host) { host.remove(); host = null; } }
  const q = (sel) => host.querySelector(sel);

  function edit(existing, done) {
    close();
    const isNew = !existing;
    const model = existing ? clone(existing) : {
      id: makeId(), name: "", created: new Date().toISOString(), favorite: false,
      date: "", location: "", stores: "", overviewHtml: "",
      layoutPhoto: null, refs: [], textBoxes: [],
    };
    if (!Array.isArray(model.refs)) model.refs = [];
    if (!Array.isArray(model.textBoxes)) model.textBoxes = [];

    // The photo file is left on disk until Save, so cancelling never destroys
    // an image the stored record still points at.
    const pendingPhotoDeletes = [];
    // Rich text controllers, one per box, plus the overview.
    let overview = null;
    const boxes = new Map();

    host = document.createElement("div");
    host.className = "editor-pane";
    host.innerHTML = `
      <header class="topbar">
        <button class="icon-btn" data-cancel aria-label="Cancel">${icon("close")}</button>
        <div class="topbar-title">
          <span class="crumb">${esc(isNew ? "" : existing.name)}</span>
          <span class="page-title">${isNew ? "New lesson plan" : "Edit lesson plan"}</span>
        </div>
        <button class="topbar-save" data-save>Save</button>
      </header>
      <div class="editor-body">
        <div class="field">
          <label for="lpName">Plan name</label>
          <input id="lpName" value="${esc(model.name)}" placeholder="Name it" autocomplete="off">
        </div>
        <div class="field-pair">
          <div class="field"><label for="lpDate">Date</label>
            <input id="lpDate" type="date" value="${esc(model.date || "")}"></div>
          <div class="field"><label for="lpLoc">Location</label>
            <input id="lpLoc" value="${esc(model.location || "")}"
              placeholder="optional" autocomplete="off"></div>
        </div>
        <div class="field">
          <label for="lpStores">Equipment</label>
          <input id="lpStores" value="${esc(model.stores || "")}"
            placeholder="What to draw from stores" autocomplete="off">
        </div>

        <p class="section-h">Overview</p>
        ${CF.Builders.richTextToolbar("lpOverview")}
        <div class="rte is-short" id="lpOverviewBody" contenteditable="true"
          spellcheck="true" role="textbox" aria-multiline="true" aria-label="Overview"></div>

        <p class="section-h">Class layout</p>
        <div id="lpPhoto"></div>

        <p class="section-h">Attached sessions and circuits</p>
        <div class="rows" id="lpRefs"></div>
        <div class="btn-row">
          <button class="secondary-btn add-btn" id="lpAddSession">${icon("session")}Add a session</button>
          <button class="secondary-btn add-btn" id="lpAddCircuit">${icon("circuit")}Add a circuit</button>
        </div>

        <p class="section-h">Notes</p>
        <div id="lpBoxes"></div>
        <button class="secondary-btn add-btn" id="lpAddBox">${icon("plus")}Add a note box</button>
        <p class="editor-hint">Attached sessions and circuits are copies, so
          editing the original later will not change a plan you have already
          printed.</p>
      </div>`;
    CF.uiRoot().appendChild(host);      /* not document.body — see bridge.js */

    overview = CF.Builders.wireRichText(
      q('[data-rte-tools="lpOverview"]'), q("#lpOverviewBody"), model.overviewHtml);

    /* -- class layout photo -- */
    async function drawPhoto() {
      const box = q("#lpPhoto");
      const photo = model.layoutPhoto;
      if (!photo || !photo.storedName) {
        box.innerHTML =
          `<button class="secondary-btn add-btn" id="lpPhotoAdd">${icon("photo")}Attach a layout photo</button>`;
      } else {
        box.innerHTML = `
          <div class="photo-grid">
            <div class="photo is-wide">
              <img alt="${esc(photo.originalName || "Class layout")}" id="lpPhotoImg">
              <button class="photo-drop" id="lpPhotoDrop" aria-label="Remove photo">${icon("close")}</button>
            </div>
          </div>`;
        const url = await CF.Library.photoUrl(photo.storedName);
        const img = q("#lpPhotoImg");
        if (url) img.src = url;
        else img.closest(".photo").classList.add("is-missing");
      }

      const add = q("#lpPhotoAdd");
      if (add) add.addEventListener("click", async () => {
        if (!CF.Store.isDesktop()) { CF.toast("Attaching photos needs the desktop app."); return; }
        const result = await CF.Store.addPhoto();
        if (!result) return;
        if (result.error) { CF.toast(result.error); return; }
        model.layoutPhoto = result;
        drawPhoto();
      });
      const drop = q("#lpPhotoDrop");
      if (drop) drop.addEventListener("click", () => {
        pendingPhotoDeletes.push(model.layoutPhoto.storedName);
        model.layoutPhoto = null;
        drawPhoto();
      });
    }
    drawPhoto();

    /* -- attached sessions and circuits -- */
    function refName(ref) {
      const rec = ref[ref.type];
      return (rec && rec.name) || `A ${ref.type}`;
    }

    function drawRefs() {
      const box = q("#lpRefs");
      box.innerHTML = model.refs.length
        ? model.refs.map((ref, i) => `
            <div class="station">
              <span class="station-n">${icon(ref.type === "session" ? "session" : "circuit")}</span>
              <div class="station-main">
                <div class="station-name">${esc(refName(ref))}</div>
                <div class="station-meta">${esc(ref.type)}</div>
              </div>
              <div class="row-tools">
                <button class="tool-btn" data-rup="${i}" ${i === 0 ? "disabled" : ""}
                  aria-label="Move up">${icon("up")}</button>
                <button class="tool-btn" data-rdown="${i}"
                  ${i === model.refs.length - 1 ? "disabled" : ""}
                  aria-label="Move down">${icon("down")}</button>
                <button class="tool-btn is-danger" data-rdrop="${i}"
                  aria-label="Remove">${icon("trash")}</button>
              </div>
            </div>`).join("")
        : `<p class="empty-note">Nothing attached.</p>`;

      box.querySelectorAll("[data-rup]").forEach((b) => b.addEventListener("click", () => {
        const i = Number(b.dataset.rup);
        [model.refs[i - 1], model.refs[i]] = [model.refs[i], model.refs[i - 1]];
        drawRefs();
      }));
      box.querySelectorAll("[data-rdown]").forEach((b) => b.addEventListener("click", () => {
        const i = Number(b.dataset.rdown);
        [model.refs[i + 1], model.refs[i]] = [model.refs[i], model.refs[i + 1]];
        drawRefs();
      }));
      box.querySelectorAll("[data-rdrop]").forEach((b) => b.addEventListener("click", () => {
        model.refs.splice(Number(b.dataset.rdrop), 1);
        drawRefs();
      }));
    }
    drawRefs();

    const attach = (type) => CF.Manage.pickRecord(
      type === "session" ? "sessions" : "circuits",
      type === "session" ? "Which session?" : "Which circuit?",
      (rec) => {
        model.refs.push({ type, [type]: clone(rec) });
        drawRefs();
      });
    q("#lpAddSession").addEventListener("click", () => attach("session"));
    q("#lpAddCircuit").addEventListener("click", () => attach("circuit"));

    /* -- note boxes --
       Each carries its own rich text editor. They are appended rather than
       redrawn on add, because rebuilding the list would blow away the
       contenteditable state of every box already being typed into. */
    function addBoxElement(box, index) {
      const wrap = document.createElement("div");
      wrap.className = "row-card note-box";
      wrap.dataset.index = index;
      wrap.innerHTML = `
        <div class="row-head">
          <input class="meso-name" data-title value="${esc(box.title || "")}"
            placeholder="Note title" aria-label="Note title" autocomplete="off">
          <div class="row-tools">
            <button class="tool-btn is-danger" data-drop aria-label="Remove note">${icon("trash")}</button>
          </div>
        </div>
        ${CF.Builders.richTextToolbar(`lpBox${index}`)}
        <div class="rte is-short" contenteditable="true" spellcheck="true"
          role="textbox" aria-multiline="true" aria-label="Note body"></div>`;
      q("#lpBoxes").appendChild(wrap);

      const controller = CF.Builders.wireRichText(
        wrap.querySelector(".rte-tools"), wrap.querySelector(".rte"), box.bodyHtml);
      boxes.set(wrap, { box, controller });

      wrap.querySelector("[data-title]").addEventListener("input", (e) => {
        box.title = e.target.value;
      });
      wrap.querySelector("[data-drop]").addEventListener("click", () => {
        boxes.delete(wrap);
        wrap.remove();
        const at = model.textBoxes.indexOf(box);
        if (at !== -1) model.textBoxes.splice(at, 1);
      });
    }

    model.textBoxes.forEach((box, i) => addBoxElement(box, i));

    q("#lpAddBox").addEventListener("click", () => {
      const box = { title: "", bodyHtml: "" };
      model.textBoxes.push(box);
      addBoxElement(box, model.textBoxes.length - 1);
      const last = q("#lpBoxes").lastElementChild;
      last.querySelector("[data-title]").focus();
      last.scrollIntoView({ block: "nearest" });
    });

    /* -- saving -- */
    q("[data-cancel]").addEventListener("click", close);

    q("[data-save]").addEventListener("click", async () => {
      model.name = q("#lpName").value.trim();
      model.date = q("#lpDate").value;
      model.location = q("#lpLoc").value.trim();
      model.stores = q("#lpStores").value.trim();
      model.overviewHtml = overview.isEmpty() ? "" : overview.html();

      // Read each note box back out of its own editor.
      for (const [, { box, controller }] of boxes) {
        box.bodyHtml = controller.isEmpty() ? "" : controller.html();
      }
      model.textBoxes = model.textBoxes.filter(
        (b) => (b.title || "").trim() || (b.bodyHtml || "").trim());

      if (!model.name) { CF.toast("Give the plan a name."); return; }

      const doc = await CF.Store.load();
      doc.lessonPlans = doc.lessonPlans || [];
      const at = doc.lessonPlans.findIndex((p) => p.id === model.id);
      if (at === -1) doc.lessonPlans.push(model); else doc.lessonPlans[at] = model;

      await CF.Store.save();
      for (const storedName of pendingPhotoDeletes) await CF.Store.dropPhoto(storedName);
      close();
      CF.toast(isNew ? "Lesson plan saved" : "Changes saved");
      if (done) done(model);
    });

    setTimeout(() => q("#lpName").focus(), 80);
  }

  async function remove(id, done) {
    const doc = await CF.Store.load();
    const plan = (doc.lessonPlans || []).find((p) => p.id === id);
    const stored = plan && plan.layoutPhoto && plan.layoutPhoto.storedName;
    doc.lessonPlans = (doc.lessonPlans || []).filter((p) => p.id !== id);
    await CF.Store.save();

    // A duplicated plan shares its original's photo file. Deleting the file
    // whenever one of them goes would pull the image out from under the
    // other, so it only goes once nothing references it.
    if (stored && !photoStillUsed(doc, stored)) await CF.Store.dropPhoto(stored);

    CF.toast("Lesson plan deleted");
    if (done) done();
  }

  function photoStillUsed(doc, storedName) {
    return (doc.lessonPlans || []).some(
      (p) => p.layoutPhoto && p.layoutPhoto.storedName === storedName);
  }

  async function duplicate(id, done) {
    const doc = await CF.Store.load();
    const source = (doc.lessonPlans || []).find((p) => p.id === id);
    if (!source) return null;
    const copy = clone(source);
    copy.id = makeId();
    copy.name = `${source.name} copy`;
    copy.created = new Date().toISOString();
    // The copy points at the same photo file, which is fine — remove() only
    // deletes a file once no plan references it.
    copy.layoutPhoto = source.layoutPhoto ? clone(source.layoutPhoto) : null;
    doc.lessonPlans.push(copy);
    await CF.Store.save();
    if (done) done(copy);
    return copy;
  }

  return { edit, remove, duplicate, isOpen, close };
})();
