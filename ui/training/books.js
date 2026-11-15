/* ==========================================================================
   CF.Books — an ordered collection of existing records, printed as one
   document with a cover page.

   A book stores REFERENCES, not copies:

     book  {id, name, subtitle, created, entries}
     entry {type: "circuit"|"session"|"guide"|"exercise"|"program", refId}

   So a book always prints whatever those records say today, which is what a
   coaching manual reprinted each season wants. The trade-off is real and
   worth stating: a book is a view of the vault, not a snapshot of it. Edit a
   session and every book containing it changes too.

   Exercises are the exception on identity. They live in a category map keyed
   by name rather than carrying ids, so an exercise entry stores
   "Category/Name" and is resolved by that. Renaming an exercise therefore
   breaks the reference — the book shows it as missing rather than silently
   printing the wrong thing.
   ========================================================================== */
CF.Books = (() => {
  "use strict";

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const icon = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24"><use href="#i-${n}"/></svg>`;
  const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const TYPES = [
    { id: "session", label: "Session", plural: "sessions", icon: "session" },
    { id: "circuit", label: "Circuit", plural: "circuits", icon: "circuit" },
    { id: "guide", label: "Guide", plural: "guides", icon: "guide" },
    { id: "exercise", label: "Exercise", plural: "library", icon: "library" },
    { id: "program", label: "Program", plural: "programs", icon: "program" },
    { id: "document", label: "Document", plural: "documents", icon: "file" },
  ];

  const typeOf = (id) => TYPES.find((t) => t.id === id) || null;

  /** Resolve one entry to the record it points at, or null if it has gone. */
  function resolve(doc, entry) {
    if (entry.type === "exercise") {
      const [category, name] = String(entry.refId || "").split("/");
      const bucket = (doc.exercises || {})[category];
      if (!bucket || !bucket[name]) return null;
      return { name, category, ...bucket[name] };
    }
    const type = typeOf(entry.type);
    if (!type) return null;
    const list = doc[type.plural] || [];
    const found = list.find((r) => r.id === entry.refId) || null;
    if (!found) return null;
    // A library file carries its display name as originalName. Giving it a
    // `name` too means every caller — the contents list, the export, the
    // reorder rows — can treat it like any other record.
    if (entry.type === "document" && !found.name) {
      return { ...found, name: found.originalName };
    }
    return found;
  }

  /** The book with every entry resolved, ready for the exporter. */
  function withRecords(doc, book) {
    return {
      ...book,
      entries: (book.entries || [])
        .map((e) => ({ type: e.type, record: resolve(doc, e) }))
        .filter((e) => e.record),
    };
  }

  const countMissing = (doc, book) =>
    (book.entries || []).filter((e) => !resolve(doc, e)).length;

  async function save() { await CF.Store.save(); }

  async function edit(existing, done) {
    const doc = await CF.Store.load();
    CF.Manage.formSheet({
      title: existing ? "Rename book" : "New book",
      fields: [
        { key: "name", label: "Book name", value: existing ? existing.name : "",
          placeholder: "Winter Block Manual" },
        { key: "subtitle", label: "Subtitle", value: existing ? existing.subtitle || "" : "",
          placeholder: "optional — shown under the title on the cover" },
        { key: "brand", label: "Cover name",
          value: existing ? existing.brand || "" : "",
          placeholder: "Coaching" },
      ],
      onConfirm: Object.assign(async (v) => {
        if (existing) {
          existing.name = v.name;
          existing.subtitle = v.subtitle;
          // Blank means "use the app's own name", not an empty cover.
          existing.brand = (v.brand || "").trim();
        } else {
          doc.books = doc.books || [];
          doc.books.push({
            id: makeId(), name: v.name, subtitle: v.subtitle,
            brand: (v.brand || "").trim(),
            coverLogo: null,
            created: new Date().toISOString(), entries: [],
          });
        }
        await save();
        CF.toast(existing ? "Saved" : "Book created");
        if (done) done();
      }, { validate: (v) => (v.name ? null : "Give the book a name.") }),
    });
  }

  /* ---- the cover's own mark --------------------------------------------
     A book with no logo of its own falls back to the app mark rather than
     storing a copy of it, so changing the app icon still updates every book
     that never overrode it. */

  const DEFAULT_BRAND = "Coaching";
  const brandOf = (book) => (book.brand || "").trim() || DEFAULT_BRAND;

  async function setLogo(book, done) {
    if (!CF.Store.isDesktop()) {
      CF.toast("Choosing a cover image needs the desktop app.");
      return;
    }
    const result = await CF.Store.addPhoto();
    if (!result) return;
    if (result.error) { CF.toast(result.error); return; }
    const previous = book.coverLogo && book.coverLogo.storedName;
    book.coverLogo = result;
    await save();
    // Only now that the new one is saved is the old one safe to drop.
    if (previous && !logoStillUsed(await CF.Store.load(), previous)) {
      await CF.Store.dropPhoto(previous);
    }
    CF.toast("Cover image set");
    if (done) done();
  }

  async function clearLogo(book, done) {
    const stored = book.coverLogo && book.coverLogo.storedName;
    book.coverLogo = null;
    await save();
    if (stored && !logoStillUsed(await CF.Store.load(), stored)) {
      await CF.Store.dropPhoto(stored);
    }
    CF.toast("Back to the app logo");
    if (done) done();
  }

  /** A duplicated or hand-edited book could point at the same file. */
  function logoStillUsed(doc, storedName) {
    return (doc.books || []).some(
      (b) => b.coverLogo && b.coverLogo.storedName === storedName);
  }

  async function remove(book, done) {
    const doc = await CF.Store.load();
    const stored = book.coverLogo && book.coverLogo.storedName;
    doc.books = (doc.books || []).filter((b) => b.id !== book.id);
    await save();
    if (stored && !logoStillUsed(doc, stored)) await CF.Store.dropPhoto(stored);
    CF.toast("Book deleted");
    if (done) done();
  }

  /** Add something to a book: pick a type, then pick the record. */
  function addEntry(book, done) {
    CF.Manage.openSheet(`Add to ${book.name}`, (sheet) => {
      TYPES.forEach((t) => CF.Manage.sheetItem(sheet, {
        label: t.label, iconName: t.icon,
        onClick: () => {
          CF.Manage.closeSheet();
          if (t.id === "exercise") return pickExercise(book, done);
          if (t.id === "document") return pickDocument(book, done);
          CF.Manage.pickRecord(t.plural, `Which ${t.label.toLowerCase()}?`, (rec) => {
            book.entries = book.entries || [];
            book.entries.push({ type: t.id, refId: rec.id });
            save().then(() => { CF.toast(`${t.label} added`); if (done) done(); });
          });
        },
      }));
    });
  }

  /** Exercises are keyed by category and name rather than by id. */
  async function pickExercise(book, done) {
    const doc = await CF.Store.load();
    const all = [];
    for (const [category, items] of Object.entries(doc.exercises || {})) {
      for (const name of Object.keys(items)) all.push({ category, name });
    }
    CF.Manage.pickFrom({
      title: "Which exercise?",
      items: all.map((e) => ({
        label: e.name, sub: e.category, value: `${e.category}/${e.name}`,
      })),
      onPick: (value) => {
        book.entries = book.entries || [];
        book.entries.push({ type: "exercise", refId: value });
        save().then(() => { CF.toast("Exercise added"); if (done) done(); });
      },
    });
  }

  /** Library files are picked by their own display name and category. */
  async function pickDocument(book, done) {
    const doc = await CF.Store.load();
    const files = doc.documents || [];
    if (!files.length) {
      CF.toast("The document library is empty.");
      return;
    }
    CF.Manage.pickFrom({
      title: "Which document?",
      items: files.map((f) => ({
        label: f.originalName, sub: f.category || "", value: f.id,
      })),
      onPick: (value) => {
        book.entries = book.entries || [];
        book.entries.push({ type: "document", refId: value });
        save().then(() => { CF.toast("Document added"); if (done) done(); });
      },
    });
  }

  async function removeEntry(book, index, done) {
    (book.entries || []).splice(index, 1);
    await save();
    if (done) done();
  }

  async function move(book, index, delta, done) {
    const list = book.entries || [];
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    [list[index], list[to]] = [list[to], list[index]];
    await save();
    if (done) done();
  }

  /** A book's printed page by id, its records as they are today -- for
      NeuroNet's reader (the desktop Bookshelf, 2026-10-02). */
  async function document(id) {
    const doc = await CF.Store.load();
    const book = ((doc && doc.books) || []).find((b) => b.id === id);
    if (!book) return null;
    const got = await window.SS.Store.call("training_document_html", ["book", withRecords(doc, book)], "Opening a book");
    return got && got.html ? {title: book.name || "Book", html: got.html, printKind: "training-book"} : null;
  }

  return { TYPES, typeOf, resolve, withRecords, countMissing, document,
           edit, remove, addEntry, removeEntry, move,
           setLogo, clearLogo, brandOf, DEFAULT_BRAND, pickDocument };
})();
