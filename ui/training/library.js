/* ==========================================================================
   CF.Library — editing the exercise library.

   Exercises are stored the way the original stores them: a map of category
   to a map of exercise name to its record. The name is the key, so renaming
   is a delete-and-reinsert and changing category is a move between maps —
   both handled here so nothing above has to know.

   Records carry fields this build does not surface: `images` (legacy
   filenames from before the photo store existed) and `videos`. Editing an
   exercise preserves them untouched. Dropping a field merely because this
   interface has no screen for it would quietly destroy data the original app
   still reads.
   ========================================================================== */
CF.Library = (() => {
  "use strict";

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const icon = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24"><use href="#i-${n}"/></svg>`;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  /* Body parts the original offers. Free text is allowed too — this is a
     convenience list, not a constraint. */
  const COMMON_PARTS = [
    "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Core",
    "Glutes", "Quads", "Hamstrings", "Calves", "Hips", "Full Body",
  ];

  let host = null;
  const isOpen = () => !!host;
  function close() { if (host) { host.remove(); host = null; } }

  const q = (sel) => host.querySelector(sel);

  /* ---- photos ---------------------------------------------------------- */

  /** Fetch a stored photo as a data URL. Cached — the host re-encodes the
      file on every call, and a grid of thumbnails would refetch constantly. */
  const photoCache = new Map();

  async function photoUrl(storedName) {
    if (photoCache.has(storedName)) return photoCache.get(storedName);
    const result = await CF.Store.getPhoto(storedName);
    const url = result && result.dataUrl ? result.dataUrl : null;
    photoCache.set(storedName, url);
    return url;
  }

  /* ---- the editor ------------------------------------------------------ */

  /**
   * `existing` is {name, category, ...record} as the library view holds it,
   * or null for a new exercise. `done` is called with the saved name and
   * category so the caller can reopen it.
   */
  async function editExercise(existing, done) {
    close();
    const doc = await CF.Store.load();
    const categories = Object.keys(doc.exercises || {});
    const isNew = !existing;

    // Start from the stored record so unknown fields ride along untouched.
    const stored = existing
      ? clone((doc.exercises[existing.category] || {})[existing.name] || {})
      : {};
    const model = {
      name: existing ? existing.name : "",
      category: existing ? existing.category : (categories[0] || ""),
      record: Object.assign({ instructions: "", bodyParts: [], photos: [] }, stored),
    };
    if (!Array.isArray(model.record.bodyParts)) model.record.bodyParts = [];
    if (!Array.isArray(model.record.photos)) model.record.photos = [];

    const originalName = model.name;
    const originalCategory = model.category;

    host = document.createElement("div");
    host.className = "editor-pane";
    host.innerHTML = `
      <header class="topbar">
        <button class="icon-btn" data-cancel aria-label="Cancel">${icon("close")}</button>
        <div class="topbar-title">
          <span class="crumb">${esc(isNew ? "" : originalName)}</span>
          <span class="page-title">${isNew ? "New exercise" : "Edit exercise"}</span>
        </div>
        <button class="topbar-save" data-save>Save</button>
      </header>
      <div class="editor-body">
        <div class="field">
          <label for="exName">Exercise name</label>
          <input id="exName" value="${esc(model.name)}" placeholder="Name it" autocomplete="off">
        </div>
        <div class="field">
          <label for="exCat">Category</label>
          <input id="exCat" value="${esc(model.category)}" list="exCats"
            placeholder="Push, Pull, Core…" autocomplete="off">
          <datalist id="exCats">${categories.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
        </div>
        <div class="field">
          <label for="exInstr">Instructions</label>
          <textarea id="exInstr" class="q-text-input" rows="5"
            placeholder="How it is performed">${esc(model.record.instructions || "")}</textarea>
        </div>

        <p class="section-h">Body parts</p>
        <div class="chips" id="exParts"></div>
        <div class="field-pair" style="margin-top:6px">
          <div class="field">
            <input id="exPartAdd" placeholder="Add another" autocomplete="off">
          </div>
          <button class="secondary-btn" id="exPartBtn" style="flex:none">Add</button>
        </div>

        <p class="section-h">Photos</p>
        <div class="photo-grid" id="exPhotos"></div>
        <button class="secondary-btn add-btn" id="exPhotoAdd">${icon("photo")}Attach a photo</button>
        <p class="editor-hint" id="exPhotoHint"></p>
      </div>`;
    CF.uiRoot().appendChild(host);      /* not document.body — see bridge.js */

    /* -- body parts -- */
    function drawParts() {
      const chosen = model.record.bodyParts;
      const offered = [...new Set([...chosen, ...COMMON_PARTS])];
      q("#exParts").innerHTML = offered.map((part) => `
        <button class="chip ${chosen.includes(part) ? "on" : ""}"
          data-part="${esc(part)}">${esc(part)}</button>`).join("");
      q("#exParts").querySelectorAll("[data-part]").forEach((b) =>
        b.addEventListener("click", () => {
          const at = chosen.indexOf(b.dataset.part);
          if (at === -1) chosen.push(b.dataset.part); else chosen.splice(at, 1);
          drawParts();
        }));
    }
    drawParts();

    const addPart = () => {
      const value = q("#exPartAdd").value.trim();
      if (!value) return;
      if (!model.record.bodyParts.includes(value)) model.record.bodyParts.push(value);
      q("#exPartAdd").value = "";
      drawParts();
    };
    q("#exPartBtn").addEventListener("click", addPart);
    q("#exPartAdd").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addPart(); }
    });

    /* -- photos -- */
    async function drawPhotos() {
      const grid = q("#exPhotos");
      const hint = q("#exPhotoHint");
      const legacy = model.record.images || [];

      if (!model.record.photos.length && !legacy.length) {
        grid.innerHTML = `<p class="empty-note" style="grid-column:1/-1">No photos attached.</p>`;
      } else {
        grid.innerHTML =
          model.record.photos.map((photo, i) => `
            <div class="photo" data-i="${i}">
              <img alt="${esc(photo.originalName || "Photo")}" data-name="${esc(photo.storedName)}">
              <button class="photo-drop" data-drop="${i}" aria-label="Remove photo">${icon("close")}</button>
            </div>`).join("") +
          legacy.map((name) => `
            <div class="photo is-legacy" title="${esc(name)}">
              <span class="photo-missing">${icon("photo")}<span>${esc(name)}</span></span>
            </div>`).join("");

        // Load each thumbnail from the host, one at a time.
        for (const img of grid.querySelectorAll("img[data-name]")) {
          const url = await photoUrl(img.dataset.name);
          if (url) img.src = url;
          else img.closest(".photo").classList.add("is-missing");
        }
        grid.querySelectorAll("[data-drop]").forEach((b) =>
          b.addEventListener("click", async () => {
            const [removed] = model.record.photos.splice(Number(b.dataset.drop), 1);
            // The file is left on disk until Save, so cancelling doesn't
            // destroy a photo that is still referenced by the stored record.
            pendingDeletes.push(removed.storedName);
            drawPhotos();
          }));
      }

      hint.textContent = legacy.length
        ? `${legacy.length} older image reference${legacy.length === 1 ? "" : "s"} shown greyed out. ` +
          `Those name files that predate the photo store; drop them into the ` +
          `exercise_photos folder under that name, or attach them again here.`
        : "";
    }
    const pendingDeletes = [];
    drawPhotos();

    q("#exPhotoAdd").addEventListener("click", async () => {
      if (!CF.Store.isDesktop()) { CF.toast("Attaching photos needs the desktop app."); return; }
      const result = await CF.Store.addPhoto();
      if (!result) return;
      if (result.error) { CF.toast(result.error); return; }
      model.record.photos.push(result);
      drawPhotos();
    });

    /* -- saving -- */
    q("[data-cancel]").addEventListener("click", close);

    q("[data-save]").addEventListener("click", async () => {
      const name = q("#exName").value.trim();
      const category = q("#exCat").value.trim();
      model.record.instructions = q("#exInstr").value.trim();

      if (!name) { CF.toast("Give the exercise a name."); return; }
      if (!category) { CF.toast("Give it a category."); return; }

      const live = await CF.Store.load();
      if (!live.exercises[category]) live.exercises[category] = {};

      // A different exercise already under that name in that category would
      // be silently overwritten, so refuse instead.
      const clash = live.exercises[category][name];
      const sameRecord = name === originalName && category === originalCategory;
      if (clash && !sameRecord) {
        CF.toast(`“${name}” already exists in ${category}.`);
        return;
      }

      if (!isNew && !sameRecord) delete live.exercises[originalCategory][originalName];
      live.exercises[category][name] = model.record;

      // An emptied category would linger as a filter chip with nothing in it.
      if (!isNew && originalCategory !== category &&
          !Object.keys(live.exercises[originalCategory] || {}).length) {
        delete live.exercises[originalCategory];
      }

      await CF.Store.save();
      for (const storedName of pendingDeletes) await CF.Store.dropPhoto(storedName);
      CF.Store.invalidateIndex();
      close();
      CF.toast(isNew ? "Exercise added" : "Saved");
      if (done) done({ name, category });
    });

    setTimeout(() => q("#exName").focus(), 80);
  }

  /* ---- delete ---------------------------------------------------------- */

  async function deleteExercise(name, category, done) {
    const doc = await CF.Store.load();
    const record = (doc.exercises[category] || {})[name];
    delete (doc.exercises[category] || {})[name];
    if (!Object.keys(doc.exercises[category] || {}).length) delete doc.exercises[category];
    await CF.Store.save();

    for (const photo of (record && record.photos) || []) {
      await CF.Store.dropPhoto(photo.storedName);
    }
    CF.Store.invalidateIndex();
    CF.toast("Exercise removed");
    if (done) done();
  }

  return { editExercise, deleteExercise, photoUrl, isOpen, close, COMMON_PARTS };
})();
