/* ==========================================================================
   Stuff — inventories, and the database of all our media.
   ==========================================================================
   Cam: "a more built out personal effects feature. However lets create a new
   main section called Stuff, this will act as the section where i can make
   inventories, databases of all our media (for the media to include by
   default see currently the personal effects for a reference point) I want
   the print out to also match the others however contain the collection icon
   file. Further i want to be able to select what i print, so i can choose to
   only print DVDs, CDS or a mixture. Further i want the print outs and lists
   alphabetical when stored in the app and when printed. Also i want to be
   able to export to excell as well or cells located in the notes subsection
   of the app."

   ONE ENGINE, TWO KINDS OF LIST. Media is Personal Effects, moved: the same
   file (personal_effects.json), the same built-in formats, every item Cam
   already entered, plus a "By" field -- director, artist, author. An
   inventory is a list of Cam's own making (the garage, the camping gear)
   with categories of its own, a quantity and where it lives. Both are drawn
   by the same catalogue below, so a fix to one is a fix to both.

   ONE SORT, EVERY DESTINATION. grouped() sorts the sections and the items
   inside them, and the screen, the printout, Excel, Word and Cells all take
   that one result. The file on disk is kept in the same order too. Written
   out five times, the orders would drift, and Cam would find out in a shop.

   The duplicate warning, the formats, the "tick what to print" and the
   letterhead all carried over from Personal Effects; see effects history in
   the README.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "Stuff");
  const toast = (m, k) => SS.shared.toast(m, k);
  const cmp = (a, b) => String(a || "").localeCompare(String(b || ""), undefined,
    {numeric: true, sensitivity: "base"});
  const newId = (p) => (p || "e") + Date.now().toString(36)
    + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toLocaleDateString(undefined,
    {day: "numeric", month: "long", year: "numeric"});

  /* The formats Personal Effects shipped with -- the "reference point" Cam
     named. Ids never change (items point at them); names can. */
  const MEDIA_TYPES = [
    ["dvd", "DVD"], ["bluray", "Blu-ray"], ["vhs", "VHS"], ["cd", "CD"],
    ["cassette", "Cassette"], ["books", "Books"], ["vinyl", "Vinyl"],
    ["ps1", "PS1"], ["ps2", "PS2"], ["ps3", "PS3"], ["ps4", "PS4"],
    ["ps5", "PS5"], ["psp", "PSP"], ["psvita", "PS Vita"],
    ["xbox", "Xbox"], ["xbox360", "Xbox 360"], ["xboxone", "Xbox One"],
    ["snes", "SNES"], ["n64", "Nintendo 64"], ["gamecube", "GameCube"],
    ["wii", "Wii"], ["switch", "Switch"], ["switch2", "Switch 2"],
    ["gameboy", "Game Boy"], ["gba", "Game Boy Advance"],
    ["nds", "Nintendo DS"], ["n3ds", "Nintendo 3DS"],
    ["other", "Other"],
  ].map(([id, name]) => ({id, name, builtIn: true}));

  /* Media by WHAT a thing is, with the formats it's owned in as tags (Cam,
     14 Nov 2026): "add a movie, then click what category it is. For example
     for Practical magic ... a tag for Dvd, VHS, Blu-ray, Digital ... Same with
     music ... Cassette, Vinyl, Cd, Mp3, Flac. This way we remove the double
     ups". One Practical Magic, owned on DVD and VHS -- not two. The old
     per-format types (above) are still how a cover is shaped, and how the
     backend turned old items into these (api/effects.py, media v2). */
  // (tv: 18 Nov 2026, Cam: "add TV to medica and things ... my TV Series") -- a show, with the episodes you have
  const MEDIA_KINDS = [["film", "Film"], ["tv", "TV"], ["music", "Music"], ["book", "Book"], ["game", "Game"], ["other", "Other"]]
    .map(([id, name]) => ({id, name, builtIn: true}));
  const GAME_PLATFORMS = ["PS1", "PS2", "PS3", "PS4", "PS5", "PSP", "PS Vita", "Xbox", "Xbox 360", "Xbox One",
    "SNES", "Nintendo 64", "GameCube", "Wii", "Switch", "Switch 2", "Game Boy", "Game Boy Advance",
    "Nintendo DS", "Nintendo 3DS", "PC", "Digital"];
  const MEDIA_FORMATS = {
    film: ["DVD", "Blu-ray", "4K UHD", "VHS", "Digital"],
    tv: ["DVD", "Blu-ray", "4K UHD", "VHS", "Digital"],
    music: ["Cassette", "Vinyl", "CD", "MP3", "FLAC"],
    book: ["Hardcover", "Paperback", "eBook", "Audiobook"],
    game: GAME_PLATFORMS,
  };
  /** The cover's shape: from the old per-format looks (shelf.css) */
  function coverShape(it) {
    const f = it.formats || [];
    const has = (x) => f.includes(x);
    switch (it.type) {
      case "music": return has("Vinyl") ? "vinyl" : has("Cassette") && !has("CD") ? "cassette" : "cd";
      case "film": case "tv": return has("Blu-ray") || has("4K UHD") ? "bluray" : f.length && f.every((x) => x === "VHS") ? "vhs" : "dvd";
      case "book": return "books";
      case "game": {
        const t = MEDIA_TYPES.find((x) => f.includes(x.name));
        return t ? t.id : "other";
      }
      default: return MEDIA_TYPES.some((x) => x.id === it.type) ? it.type : "other";
    }
  }

  /* Printouts and exports carry the collection mark on the right of the
     shared letterhead, as Money carries Cashbox and the Kitchen carries its
     own. */
  const LOGO = {logo: "collection.png", name: "collection"};

  /* ======================================================================
     THE CATALOGUE -- one list of things, drawn, edited, printed, exported.
     ====================================================================== */
  function Catalogue(cfg) {
    /* cfg: {name, typeLabel, builtIn, fields, load(), save(doc), printKind,
             back?} -- fields are [{key, label, placeholder, required?}] and
       the first is always the title. */
    const self = {cfg, doc: {items: [], types: []}, deleted: new Set(), query: "", host: null,
                  lastPick: null};

    const allTypes = () => {
      const seen = new Set(cfg.builtIn.map((t) => t.id));
      return cfg.builtIn.concat((self.doc.types || [])
        .filter((t) => t && t.id && t.name && !seen.has(t.id)));
    };
    const typeName = (id) => {
      const t = allTypes().find((x) => x.id === id);
      return t ? t.name : (cfg.builtIn[cfg.builtIn.length - 1] || {name: "Other"}).name;
    };
    const titleKey = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

    /** The same title under the same type: "Alien" on VHS twice is worth a
        warning; "Alien" on VHS and on DVD is two things Cam owns. */
    function duplicateOf(title, typeId, skipId, creator) {
      const k = titleKey(title);
      if (!k) return null;
      return (self.doc.items || []).find((it) => it.id !== skipId
        && it.type === typeId && titleKey(it.title) === k
        && (creator === undefined || !creator || !it.creator || titleKey(it.creator) === titleKey(creator))) || null;
    }

    /** THE one sort: sections by name, items by title, numbers the way a
        person reads them ("Rocky 2" before "Rocky 10"). `only` is a Set of
        type ids (print and export); empty sections are dropped. */
    function grouped({only = null, search = ""} = {}) {
      const q = String(search || "").trim().toLowerCase();
      const byType = new Map();
      for (const it of self.doc.items || []) {
        if (only && !only.has(it.type)) continue;
        if (q) {
          const hay = cfg.fields.map((f) => it[f.key] || "").join(" ").toLowerCase()
            + " " + typeName(it.type).toLowerCase();
          if (!hay.includes(q)) continue;
        }
        if (!byType.has(it.type)) byType.set(it.type, []);
        byType.get(it.type).push(it);
      }
      const out = [...byType].map(([id, items]) => ({
        id, name: typeName(id), items: items.sort((a, b) => cmp(a.title, b.title)),
      }));
      return out.sort((a, b) => cmp(a.name, b.name));
    }

    /** Stored in the order it is shown: type, then title. */
    function sortedItems() {
      return [...(self.doc.items || [])].sort((a, b) =>
        cmp(typeName(a.type), typeName(b.type)) || cmp(a.title, b.title));
    }

    async function persist() {
      /* Fields this list doesn't edit come from the file as it is now, so the
         Shelf's review, favourite and cover survive a save made here from a
         copy loaded before them (Media on one side of Multitask, the Shelf on
         the other). */
      if (cfg.keepOthers) {
        const disk = await cfg.load();
        const byId = new Map(((disk && disk.items) || []).map((x) => [x.id, x]));
        const own = new Set(["id", "type", "added"].concat(cfg.formats ? ["formats"] : [], cfg.fields.map((f) => f.key)));
        self.doc.items = (self.doc.items || []).map((it) => {
          const d = byId.get(it.id);
          if (!d) return it;
          const out = {...it};
          for (const k of Object.keys(d)) if (!own.has(k)) out[k] = d[k];
          return out;
        });
        /* and an item added since this copy was loaded (a cover from Media Art,
           a CD from Music, the other side of Multitask) is kept, not dropped;
           only one deleted here stays deleted (15 Nov 2026) */
        const mine = new Set(self.doc.items.map((x) => x.id));
        for (const d of (disk && disk.items) || []) {
          if (!mine.has(d.id) && !self.deleted.has(d.id)) self.doc.items.push(d);
        }
      }
      self.doc.items = sortedItems();
      const res = await cfg.save(self.doc);
      if (res && res.error) { toast(res.error, "error"); return false; }
      return true;
    }

    /** How one item reads in a list, on screen and on paper: everything
        but the title, in field order. */
    function metaOf(it) {
      return cfg.fields.slice(1).map((f) => {
        const v = String(it[f.key] || "").trim();
        if (!v) return "";
        return f.format ? f.format(v) : v;
      }).filter(Boolean).concat(cfg.formats && (it.formats || []).length ? [it.formats.join(", ")] : []);
    }

    /* ------------------------------------------------------------ screen */

    async function render(host) {
      self.host = host;
      const got = await cfg.load();
      if (got && got.error) toast(got.error, "error");
      self.doc = got && !got.error ? {items: got.items || [], types: got.types || []}
        : (self.doc || {items: [], types: []});
      paint();
    }

    function paint() {
      const host = self.host;
      if (!host) return;
      const sections = grouped({search: self.query});
      const total = (self.doc.items || []).length;
      const showing = sections.reduce((n, s) => n + s.items.length, 0);
      const everySection = grouped({});
      host.innerHTML = `
        <div class="st-page">
        <div class="bd-head">
          ${cfg.back ? `<button class="btn btn-quiet btn-sm st-back" data-st="back">← ${esc(cfg.back.label)}</button>` : ""}
          <h2 class="page-h">${esc(cfg.name)}</h2>
          <p class="stamp">${esc(cfg.blurb || "")}
            ${total ? `${total} item${total === 1 ? "" : "s"} in ${everySection.length}
              ${everySection.length === 1 ? cfg.typeLabel.toLowerCase() : cfg.typePlural.toLowerCase()}.`
              : "Nothing in it yet."} Alphabetical, always.</p>
          <div class="bd-actions">
            <button class="btn btn-primary" data-st="add">+ Add</button>
            <button class="btn btn-quiet" data-st="types">${esc(cfg.typePlural)}</button>
            <button class="btn btn-quiet" data-st="print">Print…</button>
            <button class="btn btn-quiet" data-st="export">Export…</button>
            ${cfg.headExtra ? cfg.headExtra() : ""}
          </div>
        </div>

        <div class="pe-search">
          <input class="input" data-st="q" value="${esc(self.query)}"
                 placeholder="Search ${esc(cfg.fields.map((f) => f.label.toLowerCase()).join(", "))}…">
          ${self.query ? `<button class="btn btn-quiet btn-sm" data-st="clear">Clear</button>
            <span class="stamp">${showing} of ${total}</span>` : ""}
        </div>

        ${everySection.length > 1 && !self.query ? `<div class="st-jump">
          ${everySection.map((s) => `<button class="chip" data-jump="${esc(s.id)}">${esc(s.name)}
            <span class="pe-count">${s.items.length}</span></button>`).join("")}
        </div>` : ""}

        ${sections.length ? sections.map((s) => `
          <section class="pe-section" data-sec="${esc(s.id)}">
            <h3 class="pe-h">${esc(s.name)} <span class="pe-count">${s.items.length}</span></h3>
            <div class="bd-list">
              ${s.items.map((it) => `
                <div class="bd-row">
                  <div class="bd-row-main">
                    <div class="bd-name">${esc(it.title)}</div>
                    <div class="bd-meta">${metaOf(it).map(esc).join(" · ") || "&nbsp;"}</div>
                  </div>
                  <button class="btn btn-quiet" data-edit="${esc(it.id)}">Edit</button>
                  <button class="btn btn-quiet bd-del" data-del="${esc(it.id)}">Delete</button>
                </div>`).join("")}
            </div>
          </section>`).join("")
        : `<p class="bd-empty">${self.query ? "Nothing matches that search."
            : esc(cfg.empty || "Nothing here yet.")}</p>`}
        </div>`;

      const on = (k, fn) => { const el = host.querySelector(`[data-st="${k}"]`); if (el) el.onclick = fn; };
      on("add", () => itemDialog(null));
      on("types", typesDialog);
      on("print", () => pickDialog("print"));
      on("export", () => pickDialog("export"));
      on("clear", () => { self.query = ""; paint(); });
      on("back", () => SS.go(cfg.back.view));
      if (cfg.onPainted) cfg.onPainted(host);
      const q = host.querySelector('[data-st="q"]');
      q.oninput = () => {
        self.query = q.value;
        const at = q.selectionStart;
        paint();
        const again = self.host.querySelector('[data-st="q"]');
        again.focus();
        try { again.setSelectionRange(at, at); } catch (e) { /* fine */ }
      };
      host.querySelectorAll("[data-jump]").forEach((b) => b.onclick = () => {
        const sec = host.querySelector(`[data-sec="${CSS.escape(b.dataset.jump)}"]`);
        if (sec && sec.scrollIntoView) sec.scrollIntoView({block: "start", behavior: "smooth"});
      });
      host.querySelectorAll("[data-edit]").forEach((b) =>
        b.onclick = () => itemDialog((self.doc.items || []).find((x) => x.id === b.dataset.edit)));
      host.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => deleteItem(b.dataset.del));
      /* Ctrl+P, like every other page -- anchored to this list, so it lapses
         the moment Cam leaves it. */
      if (SS.Print && SS.Print.offer) {
        SS.Print.offer(host.querySelector(".st-page"), cfg.name, () => pickDialog("print"));
      }
    }

    /* ------------------------------------------------------------- items */

    /** Add or edit one thing. `after(item)` runs once it's saved (the
        covers view redraws itself with it). */
    function itemDialog(existing, after) {
      const types = allTypes();
      const isNew = !existing;
      /* A new one starts on the type last used: a shelf of DVDs goes in
         one after another without choosing DVD every time. */
      const model = existing || {id: "", type: types.some((t) => t.id === self.lastType)
        ? self.lastType : (types[0] || {}).id};
      let picked = new Set(model.formats || []);
      const d = SS.shared.openDlg(isNew ? `Add to ${cfg.name}` : "Edit", `
        ${cfg.fields.map((f, i) => `
          ${i === 1 ? typeField() + (cfg.formats ? `<label class="dlg-label">Formats</label><div class="st-formats" id="st-formats"></div>` : "") : ""}
          <label class="dlg-label" for="st-f-${f.key}">${esc(f.label)}${
            f.required ? "" : ` <span class="stamp">(optional)</span>`}</label>
          <input class="input" id="st-f-${f.key}" value="${esc(model[f.key] || "")}"
                 placeholder="${esc(f.placeholder || "")}"${f.numeric ? ' inputmode="numeric"' : ""}>`).join("")}
        ${cfg.cover ? cfg.cover.html(model) : ""}`);
      const coverState = cfg.cover ? cfg.cover.wire(d, model,
        () => d.body.querySelector("#st-f-title").value.trim(),
        () => d.body.querySelector("#st-type").value) : null;
      function typeField() {
        return `<label class="dlg-label" for="st-type">${esc(cfg.typeLabel)}</label>
          <select class="input" id="st-type">
            ${[...types].sort((a, b) => cmp(a.name, b.name)).map((t) => `<option value="${esc(t.id)}"${
              t.id === model.type ? " selected" : ""}>${esc(t.name)}</option>`).join("")}
          </select>`;
      }
      /* the format tags for the chosen type (Media); a type change keeps the
         tags that still apply */
      const paintFormats = () => {
        const box = d.body.querySelector("#st-formats");
        if (!box) return;
        const list = cfg.formats[d.body.querySelector("#st-type").value] || [];
        picked = new Set([...picked].filter((x) => list.includes(x)));
        box.innerHTML = list.length ? list.map((x) => `<button type="button" class="chip ${picked.has(x) ? "on" : ""}"
            data-fmt="${esc(x)}" aria-pressed="${picked.has(x)}">${esc(x)}</button>`).join("")
          : `<span class="stamp">No formats for this type.</span>`;
        box.querySelectorAll("[data-fmt]").forEach((b) => b.onclick = () => {
          if (picked.has(b.dataset.fmt)) picked.delete(b.dataset.fmt); else picked.add(b.dataset.fmt);
          paintFormats();
        });
      };
      if (cfg.formats) {
        d.body.querySelector("#st-type").addEventListener("change", paintFormats);
        paintFormats();
      }
      const save = async (force) => {
        const val = (k) => d.body.querySelector(`#st-f-${k}`).value.trim();
        const title = val("title");
        const type = d.body.querySelector("#st-type").value;
        if (!title) { toast(`Give it ${cfg.fields[0].label === "Title" ? "a title" : "a name"}.`, "error"); return; }
        const clash = duplicateOf(title, type, model.id,
          cfg.formats && d.body.querySelector("#st-f-creator") ? val("creator") : undefined);
        /* Media: the same film (or album) again is a new FORMAT of the one
           already there, not a second copy of it */
        if (clash && cfg.formats && !force) {
          const add = [...picked].filter((x) => !(clash.formats || []).includes(x));
          const yes = await SS.shared.confirm({
            title: "You already have that",
            body: `${clash.title} is already in Media${(clash.formats || []).length ? ` (${clash.formats.join(", ")})` : ""}.`,
            fine: add.length ? `Add ${add.join(", ")} to it instead of making a second one?` : "Open that one instead of making a second one?",
            yes: add.length ? "Add to it" : "OK", danger: false,
          });
          if (!yes) return;
          if (add.length) {
            clash.formats = [...(clash.formats || []), ...add];
            if (!(await persist())) return;
            toast(`Added ${add.join(", ")} to ${clash.title}.`, "good");
          }
          d.close();
          paint();
          if (after) after(clash);
          return;
        }
        if (clash && !force) {
          /* confirm, not a second openDlg: openDlg empties the one veil,
             which would destroy the half-filled form behind it. */
          const anyway = await SS.shared.confirm({
            title: "You already have that",
            body: `${clash.title} is already in your ${typeName(type)} list.`,
            fine: `The same ${cfg.fields[0].label.toLowerCase()} under a different `
              + `${cfg.typeLabel.toLowerCase()} is a different thing, and would be fine. Add another?`,
            yes: "Add it anyway",
          });
          if (!anyway) return;
          return save(true);
        }
        /* Everything the dialog doesn't show is kept: a film's review, cover
           and favourite star belong to the Shelf, and editing its title here
           must not wipe them. */
        const item = {...(model.id ? model : {}), id: model.id || newId(), type,
                      added: model.added || new Date().toISOString()};
        if (cfg.formats) item.formats = (cfg.formats[type] || []).filter((x) => picked.has(x));
        for (const f of cfg.fields) item[f.key] = val(f.key);
        self.doc.items = (self.doc.items || []).filter((x) => x.id !== item.id).concat([item]);
        if (!(await persist())) return;
        if (cfg.cover) await cfg.cover.apply(item, coverState);
        self.lastType = type;
        d.close();
        toast(isNew ? `Added to ${typeName(type)}.` : "Saved.", "good");
        paint();
        if (after) after(item);
      };
      d.btn("Cancel", "btn-quiet", d.close);
      d.btn(isNew ? "Add" : "Save", "btn-save", () => save(false));
      d.body.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); save(false); }
      });
      const first = d.body.querySelector("#st-f-title");
      if (first) { first.focus(); first.select(); }
    }

    function deleteItem(id) {
      const it = (self.doc.items || []).find((x) => x.id === id);
      if (!it) return;
      SS.shared.confirm({
        title: "Delete this?",
        body: `“${it.title}” will be removed from your ${typeName(it.type)} list. `
          + "This cannot be undone.",
        yes: "Delete",
      }).then(async (yes) => {
        if (!yes) return;
        self.doc.items = (self.doc.items || []).filter((x) => x.id !== id);
        self.deleted.add(id);
        if (await persist()) {
          if (cfg.onDelete) cfg.onDelete(id);
          paint();
        }
      });
    }

    /* ------------------------------------------------------------- types */

    function typesDialog() {
      const d = SS.shared.openDlg(cfg.typePlural, `
        <p class="stamp" style="margin:0 0 10px">What things in ${esc(cfg.name)} are filed
          under. Add your own for anything not listed.</p>
        <div class="pe-typelist">
          ${[...allTypes()].sort((a, b) => cmp(a.name, b.name)).map((t) => {
            const used = (self.doc.items || []).filter((i) => i.type === t.id).length;
            return `<div class="pe-typerow">
              <span>${esc(t.name)}</span>
              <span class="pe-count">${used}</span>
              ${t.builtIn ? `<span class="stamp">built in</span>`
                : `<button class="btn btn-quiet btn-sm" data-rmtype="${esc(t.id)}"
                     ${used ? `disabled title="Still has ${used} in it"` : ""}>Remove</button>`}
            </div>`;
          }).join("")}
        </div>
        <label class="dlg-label" for="st-newtype">Add a ${esc(cfg.typeLabel.toLowerCase())}</label>
        <div class="row" style="gap:8px">
          <input class="input" id="st-newtype" style="flex:1" placeholder="${esc(cfg.typeExample || "")}">
          <button class="btn btn-primary" id="st-addtype">Add</button>
        </div>`);
      const add = async () => {
        const name = d.body.querySelector("#st-newtype").value.trim();
        if (!name) return;
        if (allTypes().some((t) => t.name.toLowerCase() === name.toLowerCase())) {
          toast(`There is already a “${name}”.`, "error");
          return;
        }
        const id = "c" + name.toLowerCase().replace(/[^a-z0-9]+/g, "") + "-"
          + Math.random().toString(36).slice(2, 6);
        self.doc.types = (self.doc.types || []).concat([{id, name}]);
        if (!(await persist())) return;
        d.close(); paint(); typesDialog();
      };
      d.body.querySelector("#st-addtype").onclick = add;
      d.body.querySelector("#st-newtype").onkeydown = (e) => {
        if (e.key === "Enter") { e.preventDefault(); add(); }
      };
      d.body.querySelectorAll("[data-rmtype]").forEach((b) => b.onclick = async () => {
        if (b.disabled) return;
        self.doc.types = (self.doc.types || []).filter((t) => t.id !== b.dataset.rmtype);
        if (!(await persist())) return;
        d.close(); paint(); typesDialog();
      });
      d.btn("Done", "btn-quiet", d.close);
    }

    /* ---------------------------------------------- choosing what goes out

       Cam: "i want to be able to select what i print, so i can choose to
       only print DVDs, CDS or a mixture." The choice is made in the Print
       and Export dialogs themselves, every type with something in it
       listed with its count. The search box is deliberately NOT applied:
       a half-typed search quietly cutting a shopping list down is found out
       in the aisle. */
    function pickDialog(mode) {
      const all = grouped({});
      if (!all.length) { toast(`Nothing to ${mode} yet — add something first.`, "error"); return; }
      const wasPicked = self.lastPick && [...self.lastPick].some((id) => all.some((s) => s.id === id))
        ? self.lastPick : new Set(all.map((s) => s.id));
      const d = SS.shared.openDlg(mode === "print" ? `Print ${cfg.name}` : `Export ${cfg.name}`, `
        <p class="stamp" style="margin:0 0 8px">Tick what to ${mode}. Each
          ${esc(cfg.typeLabel.toLowerCase())} comes out alphabetical, in its own section.</p>
        <div class="st-picks">
          ${all.map((s) => `<label class="pe-pick">
            <input type="checkbox" data-pick="${esc(s.id)}" ${wasPicked.has(s.id) ? "checked" : ""}>
            <span>${esc(s.name)}</span><span class="pe-count">${s.items.length}</span>
          </label>`).join("")}
        </div>
        <div class="pe-pick-tools">
          <button class="btn btn-quiet btn-sm" data-all>Select all</button>
          <button class="btn btn-quiet btn-sm" data-none>Clear</button>
          <span class="stamp" data-sum></span>
        </div>`, true);
      const boxes = () => [...d.body.querySelectorAll("[data-pick]")];
      const picked = () => new Set(boxes().filter((b) => b.checked).map((b) => b.dataset.pick));
      const sum = () => {
        const p = picked();
        const n = all.filter((s) => p.has(s.id)).reduce((a, s) => a + s.items.length, 0);
        d.body.querySelector("[data-sum]").textContent =
          p.size ? `${n} item${n === 1 ? "" : "s"} from ${p.size} ticked` : "Nothing ticked";
      };
      boxes().forEach((b) => b.onchange = sum);
      d.body.querySelector("[data-all]").onclick = () => { boxes().forEach((b) => { b.checked = true; }); sum(); };
      d.body.querySelector("[data-none]").onclick = () => { boxes().forEach((b) => { b.checked = false; }); sum(); };
      sum();
      const go = (fn) => async () => {
        const p = picked();
        if (!p.size) { toast("Tick at least one.", "error"); return; }
        self.lastPick = p;
        d.close();
        await fn(grouped({only: p}));
      };
      d.btn("Cancel", "btn-quiet", d.close);
      if (mode === "print") {
        d.btn("Print", "btn-save", go(printSections));
      } else {
        d.btn("Send to Cells", "btn-quiet", go(toCells));
        d.btn("Word", "btn-quiet", go((s) => exportTo("docx", s)));
        d.btn("Excel", "btn-save", go((s) => exportTo("xlsx", s)));
      }
    }

    /* what goes on paper and into Excel/Word/Cells: the dialog's fields, with
       Media's format tags (DVD, VHS ...) after the title (15 Nov 2026) */
    const outFields = cfg.formats
      ? [cfg.fields[0], {key: "formats", label: "Formats"}, ...cfg.fields.slice(1)] : cfg.fields;
    const outVal = (it, k) => (Array.isArray(it[k]) ? it[k].join(", ") : String(it[k] || ""));

    const countOf = (sections) => sections.reduce((n, s) => n + s.items.length, 0);
    const subtitleOf = (sections) => {
      const n = countOf(sections);
      return `${n} item${n === 1 ? "" : "s"} · ${sections.map((s) => s.name).join(", ")}`;
    };

    /* ------------------------------------------------------------- paper */

    const INK = "#2E6B38", TINT = "#5FA665";
    /* The house style (print_header.py, via SS.PrintHouse) goes first; these are
       only the list's own rules (Cam, 2026-10-05: all printouts "handled in this way"). */
    const PRINT_CSS = `
      td.n { width: 38px; color: #2E6B38; font-weight: 700; }
      td.t { font-weight: 600; }
      h2 .n { color: #5d665f; font-weight: 600; letter-spacing: .04em; }`;

    function buildHtml(sections, head) {
      const H = SS.PrintHouse;
      const body = sections.map((s) => {
        // a column for each field that has something in this section (title always)
        const cols = outFields.filter((f, i) => i === 0 || s.items.some((it) => outVal(it, f.key).trim()));
        return `<section>${H.section(s.name, ` <span class="n">(${s.items.length})</span>`)}
        <table><thead><tr><th>#</th>${cols.map((f) => `<th>${esc(f.label)}</th>`).join("")}</tr></thead><tbody>
        ${s.items.map((it, i) => `<tr><td class="n">${i + 1}</td>${cols.map((f, c) =>
          `<td class="${c === 0 ? "t" : ""}">${esc(outVal(it, f.key).trim()) || "&mdash;"}</td>`).join("")}</tr>`).join("")}
        </tbody></table></section>`;
      }).join("");
      const n = countOf(sections);
      return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(cfg.name)}</title>`
        + `<style>${H.css}${PRINT_CSS}</style></head><body><div class="doc">${head || ""}`
        + H.titleBlock(cfg.name === "Media" ? "Media list" : "Inventory", cfg.name,
            [["Items", String(n)], ["Sections", sections.map((x) => x.name).join(", ")]])
        + `${body}${H.foot(`${n} item${n === 1 ? "" : "s"} across ${sections.length} section${sections.length === 1 ? "" : "s"}`, "collection")}`
        + `</div></body></html>`;
    }

    async function letterhead(sections) {
      try {
        await SS.PrintHouse.load();
        // the letterhead says what it is; the title block names it (2026-10-05)
        const h = await call("print_header", [cfg.name === "Media" ? "Media list" : "Inventory",
          {subtitle: "", logo: LOGO.logo, name: LOGO.name}], "");
        return typeof h === "string" ? h : "";
      } catch (e) { return ""; }                 // the list prints without it
    }

    async function printSections(sections) {
      const res = await call("open_print_document",
        [buildHtml(sections, await letterhead(sections)), cfg.printKind], "Printing");
      if (res && res.error) toast(res.error, "error");
    }

    /* ----------------------------------------------------------- exports */

    function payloadOf(sections) {
      return {
        title: cfg.name, subtitle: `${subtitleOf(sections)} · ${today()}`,
        logo: LOGO.logo, logoName: LOGO.name,
        columns: outFields.map((f) => ({key: f.key, label: f.label})),
        sections: sections.map((s) => ({name: s.name,
          items: s.items.map((it) => Object.fromEntries(outFields.map((f) => [f.key, outVal(it, f.key)])))})),
      };
    }

    async function exportTo(fmt, sections) {
      const res = await call("stuff_export", [fmt, payloadOf(sections)], "Exporting");
      if (!res || res.error) { toast((res && res.error) || "That didn't work.", "error"); return; }
      toast(`Saved to ${res.path || "the Desktop"}.`, "good");
    }

    /** Into Cells, as a sheet of its own: a header row, then every item with
        its type in the first column -- so Cells' own sort and filter work on
        it -- in the same alphabetical order as everywhere else. */
    async function toCells(sections) {
      const grid = window.SSGrid;
      if (!grid || !grid.blank) { toast("Cells isn't loaded.", "error"); return; }
      const cols = [cfg.typeLabel].concat(outFields.map((f) => f.label));
      const rows = [cols];
      for (const s of sections) {
        for (const it of s.items) rows.push([s.name].concat(outFields.map((f) => outVal(it, f.key))));
      }
      const model = grid.blank(Math.max(rows.length, 30), Math.max(cols.length, 8));
      rows.forEach((r, i) => r.forEach((v, j) => { model.rows[i][j] = v; }));
      model.freeze = 1;
      cols.forEach((_, j) => { model.fmt[String.fromCharCode(65 + j) + "1"] = {b: true}; });
      model.cols = model.cols.map((c, j) => ({...c, w: j === 1 ? 260 : j === cols.length - 1 ? 220 : 120}));
      const name = `${cfg.name} ${new Date().toISOString().slice(0, 10)}`;
      const existing = await call("cells_list", [], "Your sheets");
      const taken = new Set((Array.isArray(existing) ? existing : []).map((x) => x.id));
      let id = name.replace(/[^A-Za-z0-9 _-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Stuff";
      let k = 2; const base = id;
      while (taken.has(id)) id = `${base} ${k++}`;
      const res = await call("cells_write", [id, {name: id, grid: model,
        created: new Date().toISOString()}], "Making the sheet");
      if (res && res.error) { toast(res.error, "error"); return; }
      toast(`“${id}” is in Scribe → Cells.`, "good");
    }

    /** Cam: "a quick way to add a media into the data ... It only asks what
        type it is and the title ... if same title found from same type of
        media it will skip and prompt 'Already In Database'. However if a VHS
        is entered and shares a title with a DVD that is fine."

        The desktop's Quick media widget (neuronet.board) comes here, through
        SS.boardDo. The list is read fresh from disk first, so it's current
        whether or not Stuff was open; the duplicate rule is the one the Add
        dialog uses (duplicateOf); the save is the catalogue's own (persist),
        so the Shelf's covers and reviews are kept. */
    async function quickAdd(typeId, rawTitle) {
      const title = String(rawTitle || "").trim().replace(/\s+/g, " ");
      if (!title) return {error: "Give it a title first."};
      const got = await cfg.load();
      if (got && got.error) return {error: got.error};
      self.doc = {items: (got && got.items) || [], types: (got && got.types) || []};
      if (!allTypes().some((t) => t.id === typeId)) return {error: "That format isn't in Stuff."};
      const clash = duplicateOf(title, typeId);
      if (clash) return {duplicate: true, title: clash.title, type: typeName(typeId)};
      const item = {id: newId(), type: typeId, added: new Date().toISOString()};
      for (const f of cfg.fields) item[f.key] = f.key === "title" ? title : "";
      self.doc.items = self.doc.items.concat([item]);
      if (!(await persist())) return {error: "Couldn't save it."};
      paint();
      return {ok: true, title, type: typeName(typeId)};
    }

    /** The list as it is on disk now -- for a dialog opened from somewhere
        that isn't this list's own page (the covers view). */
    async function reload() {
      const got = await cfg.load();
      if (got && !got.error) self.doc = {items: got.items || [], types: got.types || []};
      return self.doc;
    }

    /** One more thing, made by code rather than the dialog (a Music album):
        saved the catalogue's own way, so nothing on disk is lost. */
    async function addItem(item) {
      await reload();
      self.doc.items = (self.doc.items || []).concat([item]);
      return (await persist()) ? item : null;
    }

    Object.assign(self, {render, paint, grouped, duplicateOf, allTypes, typeName, quickAdd,
      buildHtml, payloadOf, toCells, printSections, pickDialog, sortedItems,
      itemDialog, typesDialog, reload, addItem});
    return self;
  }

  /* ======================================================================
     THE SECTION -- Media, each inventory, and the page that manages them.
     ====================================================================== */

  const media = Catalogue({
    name: "Media",
    blurb: "Films, music, books and games.",
    typeLabel: "Type", typePlural: "Types", typeExample: "Comics",
    builtIn: MEDIA_KINDS,
    formats: MEDIA_FORMATS,
    empty: "Nothing here yet. Add the first film, album, book or game.",
    printKind: "stuff-media",
    keepOthers: true,
    /* Covers or a plain list (2026-10-02): one Media page, one Add. */
    headExtra: () => `<button class="btn" data-mscan title="Add by barcode: typed, a barcode scanner, or photos">Scan</button>`
      + viewToggle("list"),
    onPainted: (host) => {
      wireViewToggle(host);
      const b = host.querySelector("[data-mscan]");
      if (b) b.onclick = () => SS.Shelf && SS.Shelf.scanDialog && SS.Shelf.scanDialog();
    },
    get cover() { return SS.Shelf && SS.Shelf.coverField; },
    /* Its cover goes with it. */
    onDelete: (id) => call("media_cover_clear", [id], ""),
    fields: [
      {key: "title", label: "Title", placeholder: "Aliens", required: true},
      {key: "creator", label: "By", placeholder: "James Cameron — director, artist or author"},
      {key: "year", label: "Year", placeholder: "1986", numeric: true,
       format: (v) => `(${v})`},
      {key: "notes", label: "Notes", placeholder: "Special edition, lent to James…"},
    ],
    load: () => call("effects_load", [], "Your media"),
    save: (doc) => call("effects_save", [doc], "Saving"),
  });

  /* ---- Media: covers or a list ---------------------------------------------
     Cam (2026-10-02): "Lets combine the media and shelf, this will make it so
     there is only one add button and menu." Media opens on its covers (the
     Shelf, as it was); List is the plain list it had, for printing, exporting
     and quick edits. Which one is remembered on this computer. */
  const VIEW_KEY = "nn:media:view";
  let viewNow = null;                 // this session's choice; storage may refuse
  function mediaView() {
    if (viewNow) return viewNow;
    try { viewNow = localStorage.getItem(VIEW_KEY) === "list" ? "list" : "covers"; }
    catch (e) { viewNow = "covers"; }
    return viewNow;
  }
  function viewToggle(on) {
    return `<div class="st-view" role="group" aria-label="Show as">
      <button class="chip ${on === "covers" ? "on" : ""}" data-mview="covers">Covers</button>
      <button class="chip ${on === "list" ? "on" : ""}" data-mview="list">List</button></div>`;
  }
  function wireViewToggle(root) {
    root.querySelectorAll("[data-mview]").forEach((b) => b.onclick = () => {
      if (b.classList.contains("on")) return;
      viewNow = b.dataset.mview === "list" ? "list" : "covers";
      try { localStorage.setItem(VIEW_KEY, viewNow); } catch (e) { /* this session only */ }
      if (mediaHost) mount(mediaHost, "stuff:media");
    });
  }
  let mediaHost = null;

  /** A Music album onto the shelf as a CD (Music asks when one is made). Its
      songs stay the album's: the CD keeps albumId and reads them live. */
  media.addAlbum = async function (albumId) {
    const got = SS.Music && SS.Music.albumSongs ? await SS.Music.albumSongs(albumId) : null;
    if (!got) return {error: "That album isn't in Music."};
    const doc = await media.reload();
    const key = (t) => String(t || "").trim().replace(/\s+/g, " ").toLowerCase();
    if ((doc.items || []).some((x) => x.albumId === albumId)) return {duplicate: true};
    const same = (doc.items || []).find((x) => (x.type === "music" || x.type === "cd") && !x.albumId && key(x.title) === key(got.name));
    if (same) {
      if (SS.Shelf && SS.Shelf.patch) await SS.Shelf.patch(same.id, {albumId});
      return {ok: true, linked: true, id: same.id};
    }
    const item = {id: newId(), type: "music", formats: ["CD"], title: got.name, creator: got.artist || "",
                  year: got.year || "", notes: "", albumId, added: new Date().toISOString()};
    if (!(await media.addItem(item))) return {error: "Couldn't save it."};
    if (got.art) {
      const c = await call("media_cover_from_album", [item.id, got.art], "The cover");
      if (c && !c.error && SS.Shelf && SS.Shelf.patch) await SS.Shelf.patch(item.id, {cover: new Date().toISOString()});
    }
    return {ok: true, id: item.id};
  };

  let inventories = [];
  let loaded = false;
  const invCats = new Map();                  // inventory id -> its Catalogue

  const INV_FIELDS = [
    {key: "title", label: "Item", placeholder: "Cordless drill", required: true},
    {key: "quantity", label: "Qty", placeholder: "1", numeric: true, format: (v) => `× ${v}`},
    {key: "location", label: "Where", placeholder: "Garage, top shelf"},
    {key: "notes", label: "Notes", placeholder: "Battery in the kitchen drawer…"},
  ];

  async function loadInventories() {
    const got = await call("stuff_load", [], "Your inventories");
    if (got && got.error) toast(got.error, "error");
    inventories = (got && got.inventories) || [];
    loaded = true;
    inventories.sort((a, b) => cmp(a.name, b.name));
    syncMenu();
  }
  const saveInventories = () => call("stuff_save", [{inventories}], "Saving");

  function catalogueFor(inv) {
    if (!invCats.has(inv.id)) {
      invCats.set(inv.id, Catalogue({
        get name() { return inv.name; },
        blurb: "An inventory of your own.",
        typeLabel: "Category", typePlural: "Categories", typeExample: "Camping",
        builtIn: [{id: "general", name: "General", builtIn: true}],
        empty: "Nothing here yet. Add the first thing in it.",
        printKind: "stuff-inventory",
        back: {label: "Inventories", view: "stuff:inventories"},
        fields: INV_FIELDS,
        load: async () => {
          if (!loaded) await loadInventories();
          const live = inventories.find((x) => x.id === inv.id) || inv;
          return {items: live.items || [], types: live.types || []};
        },
        save: async (doc) => {
          const live = inventories.find((x) => x.id === inv.id);
          if (!live) return {error: "That inventory is gone."};
          live.items = doc.items; live.types = doc.types;
          return saveInventories();
        },
      }));
    }
    return invCats.get(inv.id);
  }

  /** The right-hand menu: Media, each inventory by name, then the page
      that makes and manages them. */
  function syncMenu() {
    if (!SS.setSectionChildren) return;
    SS.setSectionChildren("stuff", [
      {key: "stuff:media", name: "Media", icon: "i-disc"},
      ...inventories.map((inv) => ({key: "stuff:inv:" + inv.id, name: inv.name, icon: "i-box"})),
      {key: "stuff:inventories", name: "Inventories", icon: "i-kit"},
    ]);
  }

  async function renderInventories(host) {
    if (!loaded) await loadInventories();
    host.innerHTML = `
      <div class="bd-head">
        <h2 class="page-h">Inventories</h2>
        <p class="stamp">Lists of your own — the garage, the camping gear, the
          linen cupboard. Each gets its own place in the menu, its own
          categories, and prints and exports like Media.</p>
        <div class="bd-actions">
          <button class="btn btn-primary" id="st-newinv">+ New inventory</button>
        </div>
      </div>
      ${inventories.length ? `<div class="bd-list">${inventories.map((inv) => {
        const n = (inv.items || []).length;
        return `<div class="bd-row">
          <div class="bd-row-main">
            <div class="bd-name">${esc(inv.name)}</div>
            <div class="bd-meta">${n} item${n === 1 ? "" : "s"}</div>
          </div>
          <button class="btn btn-quiet" data-open="${esc(inv.id)}">Open</button>
          <button class="btn btn-quiet" data-ren="${esc(inv.id)}">Rename</button>
          <button class="btn btn-quiet bd-del" data-rm="${esc(inv.id)}">Delete</button>
        </div>`;
      }).join("")}</div>`
      : `<p class="bd-empty">No inventories yet. Make one for anything worth keeping a list of.</p>`}`;
    host.querySelector("#st-newinv").onclick = () => nameDialog("New inventory", "", async (name) => {
      const inv = {id: newId("i"), name, items: [], types: [], created: new Date().toISOString()};
      inventories.push(inv);
      inventories.sort((a, b) => cmp(a.name, b.name));
      const res = await saveInventories();
      if (res && res.error) { toast(res.error, "error"); return; }
      syncMenu();
      SS.go("stuff:inv:" + inv.id);
    });
    host.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => SS.go("stuff:inv:" + b.dataset.open));
    host.querySelectorAll("[data-ren]").forEach((b) => b.onclick = () => {
      const inv = inventories.find((x) => x.id === b.dataset.ren);
      if (!inv) return;
      nameDialog("Rename inventory", inv.name, async (name) => {
        inv.name = name;
        inventories.sort((a, b) => cmp(a.name, b.name));
        const res = await saveInventories();
        if (res && res.error) { toast(res.error, "error"); return; }
        syncMenu();
        renderInventories(host);
      });
    });
    host.querySelectorAll("[data-rm]").forEach((b) => b.onclick = async () => {
      const inv = inventories.find((x) => x.id === b.dataset.rm);
      if (!inv) return;
      const n = (inv.items || []).length;
      const yes = await SS.shared.confirm({
        title: `Delete “${inv.name}”?`,
        body: n ? `It has ${n} item${n === 1 ? "" : "s"} in it, and they go with it. This cannot be undone.`
          : "It is empty.",
        yes: "Delete",
      });
      if (!yes) return;
      inventories = inventories.filter((x) => x.id !== inv.id);
      invCats.delete(inv.id);
      const res = await saveInventories();
      if (res && res.error) { toast(res.error, "error"); return; }
      syncMenu();
      renderInventories(host);
    });
  }

  function nameDialog(title, initial, onOk) {
    const d = SS.shared.openDlg(title, `
      <label class="dlg-label" for="st-invname">Name</label>
      <input class="input" id="st-invname" value="${esc(initial)}" placeholder="Garage">`);
    const ok = async () => {
      const name = d.body.querySelector("#st-invname").value.trim();
      if (!name) { toast("Give it a name.", "error"); return; }
      if (inventories.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.name !== initial)) {
        toast(`There is already an inventory called “${name}”.`, "error");
        return;
      }
      d.close();
      await onOk(name);
    };
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn(initial ? "Rename" : "Create", "btn-save", ok);
    const input = d.body.querySelector("#st-invname");
    input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } };
    input.focus(); input.select();
  }

  async function mount(host, which) {
    host.style.display = "";
    host.innerHTML = "";
    const page = document.createElement("div");
    page.className = "page";
    host.appendChild(page);
    if (which === "stuff:inventories") return renderInventories(page);
    if (which === "stuff:shelf" || (which === "stuff:media"
        && (mediaView() === "covers" || (SS.Shelf && SS.Shelf.hasOpen && SS.Shelf.hasOpen())))) {
      mediaHost = host;
      host.innerHTML = "";
      return SS.Shelf.mount(host);
    }
    if (which === "stuff:media") mediaHost = host;
    if (String(which).startsWith("stuff:inv:")) {
      if (!loaded) await loadInventories();
      const inv = inventories.find((x) => "stuff:inv:" + x.id === which);
      if (!inv) {
        page.innerHTML = `<p class="bd-empty">That inventory is gone.</p>`;
        return;
      }
      return catalogueFor(inv).render(page);
    }
    return media.render(page);
  }

  SS.Stuff = {
    PREFIX: "stuff:",
    /* A getter: every inventory is a view of its own. */
    get VIEWS() {
      return ["stuff:media", "stuff:inventories"]
        .concat(inventories.map((inv) => "stuff:inv:" + inv.id));
    },
    mount,
    media,
    get inventories() { return inventories; },
    Catalogue, MEDIA_TYPES, MEDIA_KINDS, MEDIA_FORMATS, coverShape,
    viewToggle, wireViewToggle, mediaView,
    /** Covers or List, from code (the old Albums page sends you to the CD covers). */
    setMediaView(v) { viewNow = v === "list" ? "list" : "covers"; try { localStorage.setItem(VIEW_KEY, viewNow); } catch (e) { /* session only */ } },
    _test: {loadInventories, catalogueFor, syncMenu},
  };

  /* The menu lists the inventories by name from the start, not only after
     Stuff is first opened. */
  if (SS.Store && SS.Store.ready) SS.Store.ready.then(() => loadInventories());
})();
