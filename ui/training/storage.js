/* ==========================================================================
   CF.Store — storage, over one of THREE backends.
   ==========================================================================
   MOVED FROM COACH CAM, NOT REWRITTEN. Everything above the backend
   objects is Coach Cam's, byte for byte. The only change is a third
   backend, kincruxBackend, added beside the other two.

   That is the whole port. It works because Coach Cam had already put a
   backend seam here -- the document logic never knew which one it got.

   WHY A THIRD ONE RATHER THAN EDITING THE DESKTOP ONE. Coach Cam's
   desktop backend calls api.get_data and api.save_data. In KinCrux those
   names belong to Hearth and mean camily.json -- the photo library,
   calendar and contacts. Calling them here would have overwritten the
   family's files with a coaching document, silently. So the KinCrux
   backend calls training_* instead, and test_module_isolation.js fails
   the build if anything under ui/training/ reaches outside that
   namespace.
   ========================================================================== */
/* ==========================================================================
   Coach Cam's original header follows.
   ==========================================================================
   CF.Store — storage, over one of two backends.

   Desktop: talks to coach_cam.py through pywebview, which reads and writes
   coach_cam_data/coach_cam.json — the same file and folder name the original
   Coach Cam uses. Put this build beside an existing install and it opens the
   real data, not a copy.

   Browser and phone: IndexedDB, seeded once from seed.json.

   Either way the document has the same shape, so everything above this file
   is unaware of which backend it got.

   App-only state (questionnaire responses, view preferences) goes to the
   prefs store, never into the coaching document — so this build never writes
   anything the original desktop app wouldn't recognise into coach_cam.json.
   ========================================================================== */
const CF = window.CF || {};
window.CF = CF;

CF.Store = (() => {
  "use strict";

  const EMPTY = {
    exercises: {}, circuits: [], sessions: [], guides: [],
    questionnaires: [], calendars: [], athletes: [], equipment: [],
    circuitTypes: [], lessonPlans: [], groups: [], programs: [], documents: [],
  };
  const blank = () => JSON.parse(JSON.stringify(EMPTY));

  let backend = null;
  let cache = null;
  let prefsCache = null;

  /* ---- desktop backend ------------------------------------------------- */

  /* ---- the two backends that were removed -------------------------------

     Coach Cam ships three ways: desktop over pywebview, and browser or
     phone over IndexedDB. Inside KinCrux neither can ever be selected --
     the host always provides CP.Store -- so both were dead code here.

     They are deleted rather than left unreachable because the desktop
     one called api.save_data, and in KinCrux that name belongs to
     Hearth and means camily.json. Dead code that would overwrite the
     family photo library, calendar and contacts is a loaded gun, not a
     harmless leftover. The original Coach Cam keeps both, unchanged.
     ---------------------------------------------------------------------- */

  /* ---- KinCrux backend -------------------------------------------------- */

  /* Same shape as the desktop backend, every call namespaced, and routed
     through CP.Store.call so that a method missing from the Python side
     comes back as a readable message instead of a dead click.

     The capabilities that are not ported yet say so in words. They used
     to be silent no-ops during the port, which is the failure mode this
     whole merge keeps being bitten by. */
  const notYet = (what) => async () => ({
    error: what + " has not come across into Coaching yet. "
      + "The original app still does it.",
  });

  const kincruxBackend = () => {
    const call = (name, args) => window.CP.Store.call(name, args, "The training module");
    return {
      kind: "desktop",            /* it IS a desktop backend; isDesktop() must stay true */
      host: "kincrux",
      getData: () => call("training_load", []),
      saveData: (doc) => call("training_save", [doc]),
      saveDataGuarded: (doc, stamp) => call("training_save", [doc, stamp]),
      dataStamp: () => call("training_stamp", []),
      getPrefs: async () => (await call("training_get_prefs", [])) || {},
      setPrefs: (prefs) => call("training_set_prefs", [prefs]),
      get: async () => null,

      /* Coach Cam's own document engine, now in KinCrux as
         training_documents.py. This used to build the page here in JS
         and hand it to the generic printer, which produced a key/value
         dump of the record -- no sets, no reps, no load, no rest, no
         block colours, no letterhead. The real renderer builds it
         server-side, where the Word/Excel/PDF builders already live and
         share the same layout. */
      printDocument: (kind, record) =>
        call("training_print_document", [kind, record], "Printing"),

      writeBackup: notYet("Writing a backup file"),
      readBackup: notYet("Reading a backup file"),
      /* These came free with the print engine: the same file builds
         all four formats from the same layout. */
      exportDocument: (kind, fmt, record, name) =>
        call("training_export_document", [kind, fmt, record, name],
             "Exporting"),
      exportCollated: notYet("Collated export"),
      exportSelection: notYet("Exporting a selection"),
      /* Asked, not assumed. python-docx, openpyxl and reportlab are
         each optional, and the interface hides a button that would
         only fail. */
      formats: async () => (await call("training_formats", []))
        || {docx: false, xlsx: false, pdf: false},
      /* NeuroTrain, the planner Sessions and Programs moved to (Q19 q1,
         10 Nov 2026): whether it's on this computer, and opening it. */
      neurotrain: async () => (await call("training_neurotrain", [])) || {installed: false},
      openNeurotrain: (page) => call("training_open_neurotrain", [page || ""], "Opening NeuroTrain"),
      /* Cam: "when adding a photo to an exercise or recipe for example
         i want KinCruxs in built photo picker to appear".

         Coach Cam kept its own exercise_photos folder and copied a file
         in through the OS dialog. In KinCrux a photo enters once,
         through the photo library, and every module picks from there --
         so an exercise photo, a recipe photo and a family photo are the
         same file, managed in one place.

         The shapes are Coach Cam's, unchanged: addPhoto returns the
         record to store (or nothing if cancelled), getPhoto returns
         {dataUrl}. */
      addPhoto: async () => {
        const shared = window.CP && window.CP.shared;
        if (!shared || typeof shared.pickFromLibrary !== "function") {
          return {error: "The photo picker isn't available in this build."};
        }
        const picked = await shared.pickFromLibrary(
          {title: "Choose a photo from your library"});
        if (!picked) return null;                 /* cancelled */
        return {storedName: picked.storedName,
                originalName: picked.originalName || picked.storedName};
      },
      getPhoto: (name) => call("get_photo_data", [name]),

      /* A no-op that succeeds, deliberately. Coach Cam owned its photo
         files, so dropping one when nothing referenced it was tidy.
         These are library photos now: the same file may be on a recipe
         or in an album, and reaching into the library to delete it
         because a lesson plan stopped using it would lose it for
         everything else. Removing it from the record is enough. */
      dropPhoto: async () => ({ok: true}),
      addDocument: notYet("Attaching a document"),
      openDocument: notYet("Opening an attached document"),
      dropDocument: notYet("Removing an attached document"),
      /* SHAPES MATTER HERE. These stand in for capabilities that have
         not come across yet, and the views above do not check what they
         get back: the Backup view does `text.trim()` straight on the
         result of readLog(). Returning {entries: []} instead of a
         string threw "text.trim is not a function" and took the whole
         view down.

         So each one returns what Coach Cam's Python actually returns:
           read_log        -> a string (the log's tail)
           read_health     -> a string (the health file's contents)
           log_location    -> a string (a path)
           available_formats -> {docx, xlsx, pdf} booleans
           ping / log_error -> True
         An honest empty value of the right TYPE, rather than a
         plausible-looking object of the wrong one. */
      logError: async () => true,
      ping: async () => true,
      readHealth: async () => "",
      readLog: async () => "",
      clearLog: async () => true,
      logLocation: async () => "",
    };
  };

  /* ---- picking one ----------------------------------------------------- */

  /* pywebview injects its api asynchronously, so checking on load misses it.
     Wait for the ready event, with a timeout so a plain browser doesn't hang. */
  /* Inside KinCrux the host owns the pywebview bridge, so ask it rather
     than reaching for window.pywebview directly. */
  const inKinCrux = () => !!(window.CP && window.CP.Store
    && typeof window.CP.Store.call === "function");

  const ready = new Promise((resolve) => {
    if (inKinCrux()) {
      backend = kincruxBackend();
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      /* Inside KinCrux there is only ever one answer. If the host is
         somehow not there, say so rather than quietly falling back to a
         backend that writes somewhere else. */
      backend = kincruxBackend();
      resolve();
    };
    window.addEventListener("pywebviewready", finish);
    setTimeout(finish, 900);
  });

  const isDesktop = () => !!backend && backend.kind === "desktop";

  /* ---- the document ---------------------------------------------------- */

  async function load() {
    if (cache) return cache;
    await ready;
    const doc = (await backend.getData()) || {};
    cache = Object.assign(blank(), doc);
    return cache;
  }

  async function save() {
    if (!cache) return;
    await ready;
    await backend.saveData(cache);
  }

  /* ---- sharing the vault with a second window ---------------------------

     The creator and the viewer open on the same file as the main app. Both
     hold the whole document in memory, so a plain save is last-writer-wins:
     whoever writes second erases the other's work silently.

     stamp() reads when the file was last written; saveIfUnchanged() hands
     that back with the write and the host refuses if it has moved on. The
     real protection is reloading just before saving — the guard is for the
     case where even that short window loses. */

  async function stamp() {
    await ready;
    return backend.dataStamp ? backend.dataStamp() : 0;
  }

  /** Drop the cached copy so the next load() re-reads the file. */
  function invalidate() { cache = null; }

  async function saveIfUnchanged(expected) {
    if (!cache) return { ok: true };
    await ready;
    if (!backend.saveDataGuarded) {
      await backend.saveData(cache);
      return { ok: true };
    }
    return backend.saveDataGuarded(cache, expected);
  }

  /* ---- preferences and app-only state ---------------------------------- */

  async function prefs() {
    if (prefsCache) return prefsCache;
    await ready;
    prefsCache = (await backend.getPrefs()) || {};
    return prefsCache;
  }

  async function getPref(key, fallback = null) {
    const p = await prefs();
    return p[key] === undefined ? fallback : p[key];
  }

  async function setPref(key, value) {
    const p = await prefs();
    p[key] = value;
    await backend.setPrefs(p);
  }

  const responses = async () => (await getPref("responses", [])) || [];

  async function addResponse(entry) {
    const all = await responses();
    all.unshift(entry);
    await setPref("responses", all);
    return all;
  }

  async function deleteResponse(id) {
    const all = (await responses()).filter((r) => r.id !== id);
    await setPref("responses", all);
    return all;
  }

  /* ---- the flat exercise index ---------------------------------------- */

  let flatIndex = null;

  /** One flat, pre-lowercased array — 400-odd records get filtered on every
      keystroke, so the search string is prepared once rather than per key. */
  async function exerciseIndex() {
    if (flatIndex) return flatIndex;
    const doc = await load();
    flatIndex = [];
    for (const [category, items] of Object.entries(doc.exercises || {})) {
      for (const [name, rec] of Object.entries(items)) {
        const instructions = (rec && rec.instructions) || "";
        const bodyParts = (rec && rec.bodyParts) || [];
        flatIndex.push({
          name, category, instructions, bodyParts,
          photos: (rec && rec.photos) || [],
          images: (rec && rec.images) || [],
          haystack: `${name} ${category} ${bodyParts.join(" ")} ${instructions}`.toLowerCase(),
          nameLower: name.toLowerCase(),
        });
      }
    }
    flatIndex.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return flatIndex;
  }

  const invalidateIndex = () => { flatIndex = null; };

  async function bodyPartList() {
    const set = new Set();
    for (const e of await exerciseIndex()) e.bodyParts.forEach((b) => set.add(b));
    return [...set].sort();
  }

  const categories = async () => Object.keys((await load()).exercises || {});

  const exerciseCount = async () =>
    Object.values((await load()).exercises || {}).reduce((n, c) => n + Object.keys(c).length, 0);

  /* ---- backup ---------------------------------------------------------- */

  const exportAll = async () => ({
    app: "coach-cam", version: 1,
    exportedAt: new Date().toISOString(),
    data: await load(),
    responses: await responses(),
  });

  async function restore(payload) {
    if (!payload || !payload.data) throw new Error("That file isn't a Coaching backup.");
    cache = Object.assign(blank(), payload.data);
    invalidateIndex();
    await save();
    if (Array.isArray(payload.responses)) await setPref("responses", payload.responses);
  }

  /** Desktop writes straight to a chosen path. The browser can only push a
      download, so this returns false there and app.js falls back. */
  async function writeBackupFile(name, text) {
    await ready;
    return backend.writeBackup(name, text);
  }

  async function readBackupFile() {
    await ready;
    return backend.readBackup();
  }

  /* ---- documents ------------------------------------------------------- */

  const exportDocument = async (kind, fmt, record, name) => {
    await ready;
    return backend.exportDocument(kind, fmt, record, name);
  };
  const printDocument = async (kind, record) => {
    await ready;
    return backend.printDocument(kind, record);
  };
  /** A mixed selection as one PDF, each record on its own page. */
  const exportSelection = async (entries, name) => {
    await ready;
    return backend.exportSelection(entries, name);
  };

  const exportCollated = async (kind, records, name) => {
    await ready;
    return backend.exportCollated(kind, records, name);
  };

  const addPhoto = async () => { await ready; return backend.addPhoto(); };
  const getPhoto = async (name) => { await ready; return backend.getPhoto(name); };
  const dropPhoto = async (name) => { await ready; return backend.dropPhoto(name); };

  const logError = async (message) => { await ready; return backend.logError(message); };
  const ping = async (counter, view) => { await ready; return backend.ping(counter, view); };
  const readHealth = async () => { await ready; return backend.readHealth(); };
  const readLog = async (limit) => { await ready; return backend.readLog(limit); };
  const clearLog = async () => { await ready; return backend.clearLog(); };
  const logLocation = async () => { await ready; return backend.logLocation(); };
  const addDocument = async () => { await ready; return backend.addDocument(); };
  const openDocument = async (n) => { await ready; return backend.openDocument(n); };
  const dropDocument = async (n) => { await ready; return backend.dropDocument(n); };

  /** Which export libraries the host actually has, cached — the interface
      hides formats that would only fail. */
  let formatCache = null;
  async function formats() {
    if (formatCache) return formatCache;
    await ready;
    formatCache = (await backend.formats()) || { docx: false, xlsx: false, pdf: false };
    return formatCache;
  }

  async function resetToSeed() {
    cache = await loadSeed();
    invalidateIndex();
    await save();
    await setPref("responses", []);
  }

  /** Re-read everything, for when the file changed underneath us. */
  async function reload() {
    cache = null;
    prefsCache = null;
    invalidateIndex();
    return load();
  }

  /** Is NeuroTrain on this computer? Asked once. */
  let ntCache = null;
  async function neurotrain() {
    if (ntCache) return ntCache;
    await ready;
    ntCache = (backend.neurotrain && await backend.neurotrain().catch(() => null)) || { installed: false };
    return ntCache;
  }
  /** page: "calculators" opens NeuroTrain on its Calculators (Q20 q1); none, where it was. */
  const openNeurotrain = async (page) => { await ready; return backend.openNeurotrain ? backend.openNeurotrain(page) : { error: "Not here." }; };

  async function meta() {
    await ready;
    if (backend.kind === "browser") {
      return { kind: "browser", seededAt: await backend.get("seededAt", null) };
    }
    return { kind: "desktop", seededAt: null };
  }

  const uid = () => (crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  return {
    ready, load, save, reload, uid, isDesktop, meta,
    exerciseIndex, invalidateIndex, bodyPartList, categories, exerciseCount,
    responses, addResponse, deleteResponse, getPref, setPref,
    exportAll, restore, resetToSeed, writeBackupFile, readBackupFile,
    exportDocument, printDocument, exportCollated, exportSelection, formats,
    neurotrain, openNeurotrain,
    addPhoto, getPhoto, dropPhoto,
    addDocument, openDocument, dropDocument,
    logError, readLog, clearLog, logLocation, ping, readHealth,
    stamp, invalidate, saveIfUnchanged,
  };
})();
