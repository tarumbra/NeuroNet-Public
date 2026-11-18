/* ==========================================================================
   The Shelf -- Stuff → Shelf, and the Random Movie widget's other half.
   ==========================================================================
   Cam: "a new sub section called Shelf to be added to Main Section stuff.
   From here should be able to select a type of media and it will be
   presented on a shelf. It will be presented as the cover image for the DVD,
   VHS or Bluray. It should allow search functionality. When clicked it should
   open a page where i can edit and add movie blog, year, reflections and
   general notes. Also a star to add to favourites and a play button. Once
   play button is clicked, if the movie is located in a movie sub folder in
   Neuronet directory then it will play."

   THE SAME LIST AS MEDIA. A shelf entry is a Media item; the Shelf is another
   way of looking at personal_effects.json, and what it adds (review,
   reflections, favourite, film) is kept on the item. Every save re-reads the
   file and changes only the one item, so Media open on the other side of
   Multitask can't be overwritten, or overwrite this.

   COVERS are files the backend keeps (media_shelf.py), fetched for the
   shelf on show. Choose a picture, drop or paste one onto the cover, or take
   a still from the film itself.

   ONE PAGE WITH MEDIA (2026-10-02). Cam: "Lets combine the media and shelf,
   this will make it so there is only one add button and menu". This is now
   Stuff → Media's covers view (Media's List view is the plain list); + Add,
   Formats, Print and Export are Media's own, and the old stuff:shelf view
   opens here. "Need to have cover allocation for media items handled in the
   add media menu not the shelf. Plus the handling of images should be with
   in built photos app": a cover is chosen in the Add / Edit dialog, from
   Photos; a new picture (a file, a paste, a still from the film) goes into
   Photos → Covers first. The shelf keeps its own small copy to draw fast.
   Covers from before then move into Photos once (adoptOldCovers).

   CDS FROM MUSIC. "a CD needs to be the same shape of that from albums": a CD
   is square, like an album sleeve. A CD made from a Music album keeps its
   albumId: its page lists the album's songs, read live, and plays them.

   PLAY hands the film to mpv or VLC -- see media_shelf.py for why a player in
   the page could not play Cam's films. The film is the one chosen for the
   entry, or else the one in the Movies folder whose name gives the same
   title (and year).
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "Shelf");
  const toast = (m, k) => SS.shared.toast(m, k);
  const cmp = (a, b) => String(a || "").localeCompare(String(b || ""), undefined,
    {numeric: true, sensitivity: "base"});

  /* Film formats first -- the Shelf is mostly for those -- then anything
     else that has something in it. */
  /* Media v2 (14 Nov 2026): a film is a film whatever it's owned on (VHS
     only included), so it can always link a video. Formats are its tags. */
  const KIND_ORDER = ["film", "tv", "music", "book", "game", "other"];
  const isFilm = (it) => it.type === "film";
  const shapeOf = (it) => (SS.Stuff && SS.Stuff.coverShape ? SS.Stuff.coverShape(it) : "dvd");
  let fmt = "";                  // one format within the type ("" = all of them)

  let doc = {items: [], types: []};
  let films = null;              // {folder, films:[...], players:[...]}
  const coverCache = new Map();  // id -> data url ("" = none)
  let type = "";                 // the format on the shelf; "*" = every one
  let query = "";
  let favOnly = false;
  let openId = null;             // the entry being looked at
  /* Albums are CDs here now (Cam, 2026-10-05: "lets remove Albums and have them
     handled in the media under cds"): picking CDs to shuffle or save as a playlist */
  let picking = false;
  const picked = new Set();
  let host = null;

  /* ---- the list ---------------------------------------------------------- */

  async function load() {
    const got = await call("effects_load", [], "Your media");
    if (got && got.error) { toast(got.error, "error"); return doc; }
    doc = {items: (got && got.items) || [], types: (got && got.types) || []};
    return doc;
  }
  const typeName = (id) => {
    const all = ((SS.Stuff && SS.Stuff.MEDIA_KINDS) || []).concat(doc.types || []);
    return (all.find((t) => t.id === id) || {name: id || "Other"}).name;
  };
  const formatsLine = (it) => (it.formats || []).join(", ");

  /** Change one item, against what is on disk now. */
  async function patchItem(id, patch) {
    const got = await call("effects_load", [], "Saving");
    if (!got || got.error) { toast((got && got.error) || "Couldn't save.", "error"); return false; }
    const items = got.items || [];
    const it = items.find((x) => x.id === id);
    if (!it) { toast("That one isn't in Media any more.", "error"); return false; }
    Object.assign(it, patch, {updated: new Date().toISOString()});
    const res = await call("effects_save", [{items, types: got.types || []}], "Saving");
    if (res && res.error) { toast(res.error, "error"); return false; }
    doc = {items, types: got.types || []};
    return true;
  }

  /* linked videos (14 Nov 2026): {item id: {name, folder, ok}}, kept by the
     backend (cinema.py); the page only ever plays "link:<id>" */
  let links = {};
  async function loadFilms(force) {
    if (!films || force) {
      const [f, l] = await Promise.all([call("media_films", [], "Your films"), call("media_links", [], "Your videos")]);
      films = f || {films: []};
      links = (l && !l.error) ? l : {};
    }
    if (films.error) films = {films: [], error: films.error};
    return films;
  }

  /** The film for an entry: the one chosen for it, else the one whose name
      gives the same title (and year). Mirrors media_shelf.match. */
  const norm = (s) => String(s || "").toLowerCase().replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/^(the|a|an) /, "");
  /* The video behind an item: its own link (anywhere on the computer), else
     its film in the Movies folder. null when there's none. */
  function videoFor(it) {
    if (it.type === "tv") {                       // a show: its first episode you have (Play plays them all)
      const e = episodesOf(it)[0];
      return e ? {path: e.path, name: e.file, where: e.folder, linked: true, episodes: true} : null;
    }
    const l = links[it.id];
    if (l && l.ok) return {path: "link:" + it.id, name: l.name, where: l.folder, linked: true};
    const f = filmFor(it);
    return f ? {path: f.path, name: f.name, where: (films && films.folder) || "Movies", linked: false} : null;
  }

  /* A TV show's episodes you have (18 Nov 2026): it.episodes [{key, season, episode, name}],
     each linked as "<item id>-<key>"; only the ones whose file is there. */
  function episodesOf(it) {
    return (it.episodes || []).map((e) => {
      const l = links[it.id + "-" + e.key];
      return l && l.ok ? Object.assign({}, e, {path: "link:" + it.id + "-" + e.key, file: l.name, folder: l.folder}) : null;
    }).filter(Boolean);
  }
  const epTag = (e) => "S" + String(e.season).padStart(2, "0") + " E" + String(e.episode).padStart(2, "0");

  function filmFor(it) {
    const list = (films && films.films) || [];
    if (it.film) return list.find((f) => f.path === it.film) || null;
    const want = norm(it.title);
    if (!want) return null;
    let hits = list.filter((f) => [norm(f.title), norm(f.alt)].includes(want));
    const y = String(it.year || "").trim();
    if (y) {
      const exact = hits.filter((f) => f.year === y);
      if (exact.length) return exact[0];
      hits = hits.filter((f) => !f.year);
    }
    return hits.length === 1 ? hits[0] : null;
  }

  let shelfPaint = 0;
  async function coversFor(ids) {
    const want = ids.filter((id) => !coverCache.has(id));
    if (!want.length) return;
    const got = (await call("media_covers", [want], "Covers")) || {};
    for (const id of want) coverCache.set(id, got[id] || "");
  }

  /* A plain cover for something without a picture: its title on a colour of
     its own, so a shelf of them still reads as a shelf.

     2026-10-06, the audit: "Generated DVD covers look like placeholders." Now
     set like a printed sleeve -- who it's by along the top, the title as the
     poster's, a large faint initial behind it, and the format's band along
     the bottom with the year, as a real case carries it. */
  function plainCover(it) {
    const title = String(it.title || "");
    let h = 0;
    for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 360;
    const initial = (title.match(/[\p{L}\p{N}]/u) || [""])[0].toUpperCase();
    return `<div class="sh-plain" style="--sh-hue:${h}">
      ${initial ? `<em aria-hidden="true">${esc(initial)}</em>` : ""}
      ${it.creator ? `<span class="sh-plain-by">${esc(it.creator)}</span>` : "<span></span>"}
      <b>${esc(title)}</b>
      <i><span>${esc(formatsLine(it) || typeName(it.type))}</span>${it.year ? `<span>${esc(it.year)}</span>` : ""}</i></div>`;
  }
  const coverHtml = (it) => {
    const c = coverCache.get(it.id);
    return c ? `<img src="${esc(c)}" alt="">` : plainCover(it);
  };

  /* ======================================================================
     THE SHELF
     ====================================================================== */

  function formatsOnShelf() {
    const counts = new Map();
    for (const it of doc.items) counts.set(it.type, (counts.get(it.type) || 0) + 1);
    const rank = (k) => (KIND_ORDER.includes(k) ? KIND_ORDER.indexOf(k) : KIND_ORDER.length);
    const ids = [...counts.keys()].sort((a, b) => rank(a) - rank(b) || cmp(typeName(a), typeName(b)));
    return ids.map((id) => ({id, name: typeName(id), n: counts.get(id)}));
  }

  function shown() {
    const q = query.trim().toLowerCase();
    return doc.items.filter((it) => (type === "*" || it.type === type)
      && (!fmt || type === "*" || (it.formats || []).includes(fmt))
      && (!favOnly || it.favourite)
      && (!q || [it.title, it.creator, it.year, it.review, it.reflections, it.notes]
        .join(" ").toLowerCase().includes(q)))
      .sort((a, b) => cmp(a.title, b.title));
  }

  async function renderShelf(page) {
    await load();
    loadFilms();
    const formats = formatsOnShelf();
    if (!type || (type !== "*" && !formats.some((f) => f.id === type))) {
      type = (formats.find((f) => f.id === SS.Shelf._lastType) || formats[0] || {id: "film"}).id;
    }
    page.innerHTML = `
      <div class="sh-page">
        <div class="bd-head">
          <h2 class="page-h">Media</h2>
          <p class="stamp">Films, music, books and games, by their covers.</p>
          <div class="bd-actions">
            <button class="btn btn-primary" data-sh="add">+ Add</button>
            <button class="btn" data-sh="scan" title="Add by barcode: typed, a barcode scanner, or photos">Scan</button>
            <button class="btn btn-quiet" data-sh="types">Types</button>
            <button class="btn btn-quiet" data-sh="print">Print…</button>
            <button class="btn btn-quiet" data-sh="export">Export…</button>
            ${SS.Stuff && SS.Stuff.viewToggle ? SS.Stuff.viewToggle("covers") : ""}
          </div>
          ${type === "music" ? `<div class="bd-actions sh-cd-tools">
            <button class="btn" data-sh="newalbum" title="Make an album from songs in your music library">+ New album</button>
            <button class="btn ${picking ? "btn-primary" : "btn-quiet"}" data-sh="pick">${picking ? "Done" : "Shuffle…"}</button>
          </div>
          <div class="sh-pickbar" id="sh-pickbar"></div>` : ""}
        </div>
        <div class="sh-tools">
          <div class="sh-formats">
            ${formats.map((f) => `<button class="chip ${f.id === type ? "on" : ""}" data-type="${esc(f.id)}">
              ${esc(f.name)} <span class="pe-count">${f.n}</span></button>`).join("")}
            ${formats.length > 1 ? `<button class="chip ${type === "*" ? "on" : ""}" data-type="*">Everything</button>` : ""}
            <button class="chip sh-favchip ${favOnly ? "on" : ""}" id="sh-fav" title="Only favourites">★ Favourites</button>
          </div>
          ${type !== "*" ? (() => {
            const here = doc.items.filter((it) => it.type === type);
            // in the order the type lists them (DVD, Blu-ray, 4K UHD, VHS, Digital)
            const order = (SS.Stuff.MEDIA_FORMATS || {})[type] || [];
            const at = (x) => (order.includes(x) ? order.indexOf(x) : order.length);
            const fs = [...new Set(here.flatMap((it) => it.formats || []))].sort((a, b) => at(a) - at(b) || a.localeCompare(b));
            if (fmt && !fs.includes(fmt)) fmt = "";
            return fs.length > 1 ? `<div class="sh-formats sh-fmtchips" aria-label="Formats">
              <button class="chip ${!fmt ? "on" : ""}" data-fmt="">All</button>
              ${fs.map((x) => `<button class="chip ${fmt === x ? "on" : ""}" data-fmt="${esc(x)}">${esc(x)}
                <span class="pe-count">${here.filter((it) => (it.formats || []).includes(x)).length}</span></button>`).join("")}
            </div>` : "";
          })() : ""}
          <input class="input sh-search" id="sh-q" type="search" value="${esc(query)}"
                 placeholder="Search titles, years, reviews…" autocomplete="off">
        </div>
        <div class="sh-shelf" id="sh-shelf"></div>
      </div>`;
    page.querySelectorAll("[data-type]").forEach((b) => b.onclick = () => {
      type = b.dataset.type; fmt = ""; if (type !== "*") SS.Shelf._lastType = type;
      renderShelf(page);
    });
    page.querySelectorAll("[data-fmt]").forEach((b) => b.onclick = () => { fmt = b.dataset.fmt; renderShelf(page); });
    page.querySelector("#sh-fav").onclick = () => { favOnly = !favOnly; renderShelf(page); };
    if (SS.Stuff && SS.Stuff.wireViewToggle) SS.Stuff.wireViewToggle(page);
    const media = SS.Stuff && SS.Stuff.media;
    const act = (k, fn) => { const b = page.querySelector(`[data-sh="${k}"]`); if (b) b.onclick = fn; };
    act("add", async () => {
      if (!media) return;
      await media.reload();
      media.itemDialog(null, (item) => { coverCache.delete(item.id); type = item.type; mount(host); });
    });
    act("scan", scanDialog);
    act("types", async () => { if (media) { await media.reload(); media.typesDialog(); } });
    act("print", async () => { if (media) { await media.reload(); media.pickDialog("print"); } });
    act("export", async () => { if (media) { await media.reload(); media.pickDialog("export"); } });
    act("newalbum", () => { if (SS.Music && SS.Music.newAlbum) SS.Music.newAlbum(); });
    act("pick", () => { picking = !picking; picked.clear(); renderShelf(page); });
    adoptOldCovers();
    const q = page.querySelector("#sh-q");
    q.oninput = () => { query = q.value; paintShelf(page); };
    await paintShelf(page);
  }

  async function paintShelf(page) {
    const box = page.querySelector("#sh-shelf");
    if (!box) return;
    const list = shown();
    if (!doc.items.length) {
      box.innerHTML = `<p class="bd-empty">Nothing in Media yet. Press <b>+ Add</b> for the
        first film, album, book or game.</p>`;
      return;
    }
    if (!list.length) {
      box.innerHTML = `<p class="bd-empty">${query || favOnly ? "Nothing on this shelf matches."
        : "Nothing on this shelf yet."}</p>`;
      return;
    }
    /* Covers still to come (the first visit): the shelf shows empty cases of
       the right shapes at once, not a blank (2026-10-06, the audit: "loading
       placeholders where a page waits on files"). A newer draw wins. */
    const token = ++shelfPaint;
    if (list.some((it) => !coverCache.has(it.id))) {
      box.innerHTML = list.slice(0, 24).map((it) => `
        <span class="sh-case sh-waiting" aria-hidden="true"><span class="sh-cover sh-${esc(shapeOf(it))}"></span>
          <span class="sh-cap">&nbsp;</span></span>`).join("");
      box.setAttribute("aria-busy", "true");
    }
    await coversFor(list.map((it) => it.id));
    await loadFilms();
    if (token !== shelfPaint || !box.isConnected) return;
    box.removeAttribute("aria-busy");
    box.innerHTML = list.map((it) => `
      <button class="sh-case" data-open="${esc(it.id)}" title="${esc(it.title)}${it.year ? ` (${esc(it.year)})` : ""}">
        <span class="sh-cover sh-${esc(shapeOf(it))}">${coverHtml(it)}
          ${it.favourite ? `<span class="sh-star" title="Favourite">★</span>` : ""}
          ${videoFor(it) ? `<span class="sh-hasfilm" data-play="${esc(it.id)}" role="button" title="Play ${esc(it.title)}"
              aria-label="Play ${esc(it.title)}">▶</span>` : ""}
        </span>
        <span class="sh-cap">${esc(it.title)}</span>
      </button>`).join("");
    box.querySelectorAll("[data-open]").forEach((b) => b.onclick = (e) => {
      const it = doc.items.find((x) => x.id === b.dataset.open);
      /* Cam (15 Nov 2026): the ▶ on a cover plays the film straight away;
         anywhere else on the cover still opens its page */
      if (e && e.target.closest("[data-play]") && it && !(picking && type === "music")) {
        e.stopPropagation();
        return playEntry(it);
      }
      if (picking && type === "music") {
        if (!it || !it.albumId) { toast("That CD has no songs in your music library.", "error"); return; }
        if (picked.has(it.albumId)) picked.delete(it.albumId); else picked.add(it.albumId);
        b.classList.toggle("sh-picked", picked.has(it.albumId));
        return paintPickBar(page);
      }
      openEntry(b.dataset.open);
    });
    if (picking && type === "music") {
      box.querySelectorAll("[data-open]").forEach((b) => {
        const it = doc.items.find((x) => x.id === b.dataset.open);
        b.classList.toggle("sh-picked", !!(it && picked.has(it.albumId)));
        b.classList.add("sh-pickable");
      });
      paintPickBar(page);
    }
  }

  /** Under the CD tools while picking: how many, Shuffle play, Save as playlist. */
  function paintPickBar(page) {
    const bar = page.querySelector("#sh-pickbar");
    if (!bar) return;
    if (!picking) { bar.innerHTML = ""; return; }
    const n = picked.size;
    bar.innerHTML = `<span class="stamp">${n ? `${n} CD${n === 1 ? "" : "s"} picked` : "Pick the CDs to shuffle together."}</span>
      <button class="btn btn-primary btn-sm" id="sh-shuffle" ${n ? "" : "disabled"}>Shuffle play</button>
      <button class="btn btn-sm" id="sh-saveplay" ${n ? "" : "disabled"}>Save as playlist…</button>`;
    bar.querySelector("#sh-shuffle").onclick = async () => {
      if (SS.Music && SS.Music.shuffleAlbums && await SS.Music.shuffleAlbums([...picked])) {
        picking = false; picked.clear(); renderShelf(page);
      }
    };
    bar.querySelector("#sh-saveplay").onclick = () => {
      if (SS.Music && SS.Music.saveAlbumsAsPlaylist) SS.Music.saveAlbumsAsPlaylist([...picked], () => {
        picking = false; picked.clear(); renderShelf(page);
      });
    };
  }

  /* ======================================================================
     AN ENTRY
     ====================================================================== */

  function openEntry(id) {
    openId = id;
    const here = SS.where ? SS.where().view : "";
    if (here !== "stuff:media" && here !== "stuff:shelf") { SS.go("stuff:media"); return; }
    if (host) mount(host);
  }

  let saveTimer = null;
  let pending = {};

  async function renderEntry(page) {
    await load();
    const it = doc.items.find((x) => x.id === openId);
    if (!it) { openId = null; return renderShelf(page); }
    await Promise.all([coversFor([it.id]), loadFilms()]);
    const video = videoFor(it);
    const noPlayer = films && films.players && !films.players.length;
    page.innerHTML = `
      <div class="sh-entry">
        <button class="btn btn-quiet sh-back" id="sh-back">← Media</button>
        <div class="sh-entry-grid">
          <div class="sh-entry-side">
            <div class="sh-cover sh-big sh-${esc(shapeOf(it))}" id="sh-cover">${coverHtml(it)}</div>
            <div class="sh-actions">
              <button class="btn sh-play ${video ? "sh-play-on" : ""}" id="sh-play" ${video ? "" : "disabled"}
                title="${video ? esc(video.name) : "No video linked yet"}">▶ Play</button>
              <button class="btn sh-favbtn ${it.favourite ? "on" : ""}" id="sh-favbtn"
                aria-pressed="${it.favourite ? "true" : "false"}"
                title="${it.favourite ? "A favourite — press to take it off" : "Add to favourites"}">
                ${it.favourite ? "★" : "☆"}</button>
            </div>
            <div class="sh-film stamp" id="sh-film">${filmLine(it, video, noPlayer)}</div>
          </div>
          <div class="sh-entry-main">
            <h2 class="page-h sh-title">${esc(it.title)}</h2>
            <p class="stamp sh-meta">${esc(typeName(it.type))}${formatsLine(it) ? ` · ${esc(formatsLine(it))}` : ""}${it.creator ? ` · ${esc(it.creator)}` : ""}
              <button class="btn btn-quiet btn-sm" id="sh-edit">Edit details…</button>
              ${it.albumId ? `<button class="btn btn-quiet btn-sm" id="sh-editalbum" title="Its songs, their order, the sleeve">Edit album…</button>` : ""}</p>
            ${it.albumId ? `<div class="sh-songs" id="sh-songs"><p class="stamp">Reading the songs…</p></div>` : ""}
            <div class="sh-fields">
              <label class="dlg-label" for="sh-year">Year</label>
              <input class="input sh-year" id="sh-year" data-f="year" inputmode="numeric"
                     value="${esc(it.year || "")}" placeholder="1999">
              <label class="dlg-label" for="sh-review">${isFilm(it) ? "Movie blog" : "Review"}</label>
              <textarea class="input sh-text sh-review" id="sh-review" data-f="review" rows="8"
                placeholder="Your write-up — what it's about, what worked, what didn't…">${esc(it.review || "")}</textarea>
              <label class="dlg-label" for="sh-refl">Reflections</label>
              <textarea class="input sh-text" id="sh-refl" data-f="reflections" rows="5"
                placeholder="What stayed with you afterwards…">${esc(it.reflections || "")}</textarea>
              <label class="dlg-label" for="sh-notes">Notes</label>
              <textarea class="input sh-text" id="sh-notes" data-f="notes" rows="3"
                placeholder="Special edition, lent to James…">${esc(it.notes || "")}</textarea>
            </div>
            <p class="stamp sh-saved" id="sh-saved">${it.updated ? `Saved ${esc(new Date(it.updated).toLocaleString())}` : "Saved as you type."}</p>
          </div>
        </div>
      </div>`;
    const $ = (s) => page.querySelector(s);
    $("#sh-back").onclick = () => { flush(); openId = null; mount(host); };
    $("#sh-edit").onclick = async () => {
      const media = SS.Stuff && SS.Stuff.media;
      if (!media) return;
      await flush();
      await media.reload();
      const fresh = (media.doc.items || []).find((x) => x.id === it.id);
      if (fresh) media.itemDialog(fresh, () => { coverCache.delete(it.id); mount(host); });
    };
    if (it.albumId) drawSongs(page, it);
    if ($("#sh-editalbum")) $("#sh-editalbum").onclick = async () => {
      await flush();
      if (SS.Music && SS.Music.editAlbum) SS.Music.editAlbum(it.albumId);
    };
    $("#sh-play").onclick = () => playEntry(it);
    $("#sh-favbtn").onclick = async () => {
      const on = !it.favourite;
      if (await patchItem(it.id, {favourite: on})) {
        it.favourite = on;
        const b = $("#sh-favbtn");
        b.classList.toggle("on", on); b.textContent = on ? "★" : "☆";
        b.setAttribute("aria-pressed", String(on));
        b.title = on ? "A favourite — press to take it off" : "Add to favourites";
        toast(on ? "Added to favourites." : "Taken off favourites.", "good");
      }
    };
    page.querySelectorAll("[data-f]").forEach((el) => el.addEventListener("input", () => {
      pending[el.dataset.f] = el.value;
      $("#sh-saved").textContent = "Saving…";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, 700);
    }));
    wireFilmLine(page, it);
  }

  /* Cam (14 Nov 2026): "a play button that is a link to the videos location
     on the computer ... If a video hasnt been linked to it then the button
     will appear greyed out. When it is linked it will be green and say play".
     The video can stay wherever it's kept: "Link a video…" opens the system's
     file picker; the Movies folder still works as before. */
  function filmLine(it, video) {
    if (it.type === "tv") {
      const have = episodesOf(it), all = (it.episodes || []).length;
      if (!all) return "No episodes on this computer yet. Episodes downloaded in NeuroTV come in here.";
      const bySeason = {};
      for (const e of it.episodes) (bySeason[e.season] = bySeason[e.season] || []).push(e);
      return `<b>${have.length === 1 ? "1 episode" : have.length + " episodes"}</b>${all > have.length ? ` (${all - have.length} not found: moved, or its drive isn't plugged in)` : ""}
        ${Object.keys(bySeason).sort((a, b) => a - b).map((s) => `<div class="sh-eps"><span class="stamp">${+s ? "Season " + s : "Specials"}</span>
          ${bySeason[s].map((e) => { const ok = have.find((h) => h.key === e.key);
            return `<a href="#" class="sh-ep${ok ? "" : " off"}" data-ep="${esc(e.key)}" title="${esc(ok ? ok.file : "Not found")}">▶ ${esc(epTag(e))}${e.name ? " · " + esc(e.name) : ""}</a>`; }).join("")}</div>`).join("")}`;
    }
    const broken = links[it.id] && !links[it.id].ok;
    if (video) {
      return `Video: <span title="${esc(video.where)}">${esc(video.name)}</span>
        <br><a href="#" data-film="link">Change…</a>${video.linked ? ` · <a href="#" data-film="unlink">Unlink</a>`
          : ` · <a href="#" data-film="pick">Not this one?</a>`}`;
    }
    return `${broken ? `<b>The linked video has moved or gone.</b><br>` : ""}No video linked.
      <br><a href="#" data-film="link">Link a video…</a>${isFilm(it) ? ` · <a href="#" data-film="pick">From the Movies folder…</a>` : ""}`;
  }
  function wireFilmLine(page, it) {
    page.querySelectorAll("[data-ep]").forEach((a) => a.onclick = (e) => { e.preventDefault(); playEntry(it, a.dataset.ep); });
    page.querySelectorAll("[data-film]").forEach((a) => a.onclick = async (e) => {
      e.preventDefault();
      const what = a.dataset.film;
      if (what === "folder") return openFolder();
      if (what === "pick") return pickFilm(it);
      if (what === "unlink") {
        const r = await call("media_unlink_video", [it.id], "Unlinking");
        if (r && r.error) { toast(r.error, "error"); return; }
        await loadFilms(true); mount(host); return;
      }
      const r = await call("media_link_video", [it.id], "Linking a video");
      if (!r || r.cancelled) return;
      if (r.error) { toast(r.error, "error"); return; }
      await loadFilms(true);
      toast(`Linked ${r.name}.`, "good");
      mount(host);
    });
  }

  async function openFolder() {
    const r = await call("media_open_movies_folder", [], "Opening the folder");
    if (r && r.error) toast(r.error, "error");
  }

  /* ▶ Play opens the video in Cinema's own player, right here (14 Nov 2026) */
  function playEntry(it, onlyKey) {
    if (it.type === "tv") {                       // a show: its episodes in order (or the one picked)
      const eps = episodesOf(it).filter((e) => !onlyKey || e.key === onlyKey);
      if (!eps.length) { toast("No episodes of this on the computer.", "warn"); return; }
      if (!SS.CinemaPlayer) { toast("The player isn't loaded.", "error"); return; }
      SS.CinemaPlayer.open(host, {items: eps.map((e) => ({path: e.path, label: `${it.title} ${epTag(e)}${e.name ? " · " + e.name : ""}`})),
        onClose: () => mount(host)});
      return;
    }
    const video = videoFor(it);
    if (!video) { toast("Link a video to this first.", "warn"); return; }
    if (!SS.CinemaPlayer) { toast("The player isn't loaded.", "error"); return; }
    SS.CinemaPlayer.open(host, {items: [{path: video.path, label: it.title || video.name}],
      onClose: () => mount(host)});
  }

  async function pickFilm(it) {
    await loadFilms(true);
    const list = (films.films || []).slice().sort((a, b) => cmp(a.title, b.title));
    const d = SS.shared.openDlg(`Which film is ${it.title}?`, `
      <p class="stamp">Films in <b>${esc(films.folder || "Movies")}</b>.</p>
      ${list.length ? `<input class="input" id="sh-fq" type="search" placeholder="Filter" autocomplete="off">
        <div class="sh-filmlist" id="sh-fl"></div>`
        : `<p class="bd-empty">The Movies folder is empty. Put your films in it — in folders of
            their own is fine — and they turn up here.</p>`}`, true);
    const draw = (q) => {
      const box = d.body.querySelector("#sh-fl");
      if (!box) return;
      const hits = list.filter((f) => !q || `${f.title} ${f.year} ${f.path}`.toLowerCase().includes(q));
      box.innerHTML = hits.map((f) => `<button class="sh-filmrow ${f.path === it.film ? "on" : ""}" data-p="${esc(f.path)}">
          <b>${esc(f.title)}</b>${f.year ? ` <span>(${esc(f.year)})</span>` : ""}
          <small>${esc(f.path)}</small></button>`).join("") || `<p class="stamp">Nothing matches.</p>`;
      box.querySelectorAll("[data-p]").forEach((b) => b.onclick = async () => {
        d.close();
        if (await patchItem(it.id, {film: b.dataset.p})) { toast("Linked.", "good"); mount(host); }
      });
    };
    const fq = d.body.querySelector("#sh-fq");
    if (fq) { fq.oninput = () => draw(fq.value.trim().toLowerCase()); draw(""); fq.focus(); }
    d.btn("Open Movies folder", "btn-quiet", () => openFolder());
    if (it.film) d.btn("Unlink", "btn-quiet", async () => {
      d.close();
      if (await patchItem(it.id, {film: ""})) mount(host);
    });
    d.btn("Cancel", "btn-quiet", d.close);
  }

  async function flush() {
    clearTimeout(saveTimer);
    const patch = pending;
    pending = {};
    if (!Object.keys(patch).length || !openId) return;
    const id = openId;
    const ok = await patchItem(id, patch);
    const s = host && host.querySelector("#sh-saved");
    if (s && openId === id) s.textContent = ok ? `Saved ${new Date().toLocaleTimeString()}` : "Not saved.";
  }

  /* ---- covers ------------------------------------------------------------- */

  /* ---- a cover in the Add / Edit dialog (Media's, in stuff.js) ------------
     Drawn INSIDE that dialog: pickFromLibrary opens a dialog of its own,
     and there is one dialog layer -- it would wipe the half-filled form.
     Opens on Photos → Covers; type to search all of Photos. */
  const coverField = {
    html(model) {
      return `<label class="dlg-label">Cover <span class="stamp">(optional)</span></label>
        <div class="sh-pick">
          <span class="sh-cover sh-pick-prev sh-${esc(model.type ? shapeOf(model) : "dvd")}" id="sh-pick-prev"></span>
          <div class="sh-pick-side">
            <div class="sh-pick-btns">
              <button type="button" class="btn btn-quiet btn-sm" data-cv="photos">Choose from Photos…</button>
              <button type="button" class="btn btn-quiet btn-sm" data-cv="new">New picture…</button>
              <button type="button" class="btn btn-quiet btn-sm" data-cv="none" hidden>No cover</button>
              <span class="sh-pick-extra" id="sh-pick-extra"></span>
            </div>
            <p class="stamp sh-pick-note">Or copy a picture and press Ctrl+V, or drag one onto this window.
              New pictures go into Photos → Covers.</p>
          </div>
        </div>
        <div class="sh-pick-lib" id="sh-pick-lib" hidden>
          <input class="input" id="sh-pick-q" type="search" autocomplete="off" placeholder="Search your photos…">
          <div class="pick-grid sh-pick-grid" id="sh-pick-grid"></div>
          <p class="stamp" id="sh-pick-msg"></p>
        </div>`;
    },
    wire(d, model, getTitle, getType) {
      const state = {photo: "", clear: false, album: false};
      const $ = (q) => d.body.querySelector(q);
      const prev = $("#sh-pick-prev");
      const none = d.body.querySelector('[data-cv="none"]');
      const showPhoto = (stored) => {
        prev.innerHTML = "";
        SS.shared.thumb(stored).then((url) => { if (url && state.photo === stored) prev.innerHTML = `<img src="${esc(url)}" alt="">`; });
      };
      const showPlain = () => {
        prev.innerHTML = plainCover({title: getTitle() || "Cover", type: getType()});
      };
      const showNow = () => {
        if (state.photo) return showPhoto(state.photo);
        const c = !state.clear && model.id ? coverCache.get(model.id) : "";
        if (c) prev.innerHTML = `<img src="${esc(c)}" alt="">`; else showPlain();
        none.hidden = !c;
      };
      if (model.id && !coverCache.has(model.id)) coversFor([model.id]).then(showNow); else showNow();
      const typeSel = $("#st-type");
      /* the case takes the shape of the type and its format tags (a CD is
         square, a VHS tall): read the ticked chips each time */
      const reshape = () => {
        const formats = [...d.body.querySelectorAll("#st-formats [data-fmt].on")].map((b) => b.dataset.fmt);
        prev.className = `sh-cover sh-pick-prev sh-${shapeOf({type: typeSel.value, formats})}`;
        if (!state.photo && !(model.id && coverCache.get(model.id))) showPlain();
      };
      if (typeSel) {
        typeSel.addEventListener("change", () => setTimeout(reshape, 0));
        const box = $("#st-formats");
        if (box) box.addEventListener("click", (e) => { if (e.target.closest("[data-fmt]")) setTimeout(reshape, 0); });
      }
      const title = $("#st-f-title");
      if (title) title.addEventListener("input", () => { if (!prev.querySelector("img")) showPlain(); });
      const choose = (stored) => {
        state.photo = stored; state.clear = false; state.album = false; none.hidden = false;
        $("#sh-pick-lib").hidden = true;
        showPhoto(stored);
      };
      const lib = $("#sh-pick-lib"), grid = $("#sh-pick-grid"), msg = $("#sh-pick-msg"), q = $("#sh-pick-q");
      const paint = () => {
        const typed = q.value.trim();
        const list = typed ? SS.shared.photoSearch(typed) : SS.shared.photosInFolder("Covers");
        msg.textContent = list.length ? (typed ? `${list.length} match${list.length === 1 ? "" : "es"}.`
          : "Your covers. Type to search all of Photos.")
          : typed ? "Nothing matches that." : "No covers in Photos yet. Type to search all of Photos.";
        grid.innerHTML = list.map((p) => `<button type="button" class="pick-tile" data-stored="${esc(p.storedName)}"
            title="${esc(SS.shared.photoName(p))}"><span class="pick-thumb"></span>
            <span class="pick-name">${esc(SS.shared.photoName(p))}</span></button>`).join("");
        grid.querySelectorAll(".pick-tile").forEach((tile) => {
          SS.shared.thumb(tile.dataset.stored).then((url) => {
            const t = tile.querySelector(".pick-thumb");
            if (url && t) t.style.backgroundImage = `url("${url}")`;
          }).catch(() => {});
          tile.onclick = () => choose(tile.dataset.stored);
        });
      };
      q.oninput = paint;
      d.body.querySelector('[data-cv="photos"]').onclick = () => {
        lib.hidden = !lib.hidden;
        if (!lib.hidden) { paint(); q.focus(); }
      };
      d.body.querySelector('[data-cv="new"]').onclick = async () => {
        const picked = await SS.Store.pickPhotos();
        const path = picked && picked.paths && picked.paths[0];
        if (!path) return;
        const res = await SS.shared.addToPhotos({path, folder: "Covers", tag: "Cover", caption: getTitle()});
        if (!res || res.error) { toast((res && res.error) || "Couldn't add it to Photos.", "error"); return; }
        choose(res.storedName);
      };
      none.onclick = () => { state.photo = ""; state.clear = true; state.album = false; none.hidden = true; showPlain(); };

      /* Paste a cover (Cam, 15 Nov 2026): "if i copy Dust bunny cover have
         the edit window open and the window active, pressing Ctrl + V will
         paste the photo in as the cover." First try (the picture straight from
         the paste) didn't work in the app: Qt's web view on Wayland doesn't
         always hand a browser's copied picture to the page, and a picture
         dragged from a web page is often only its address. So: a picture in
         the paste is used; else a picture's address in it is fetched; else
         NeuroNet reads the clipboard itself (wl-paste). Text pasted into a
         text box stays text. Ctrl+V with nothing focused counts too, and a
         picture dropped anywhere on this window is the cover (the Photos
         import overlay stays away while it's up: app.js wireDrop). */
      const modal = d.body.closest(".modal") || d.body;
      modal.setAttribute("data-cover-drop", "");
      let busy = false, pasteSeen = 0;
      const takePath = async (path, how) => {
        const res = await SS.shared.addToPhotos({path, folder: "Covers", tag: "Cover", caption: getTitle()});
        if (!res || res.error) { toast((res && res.error) || "Couldn't add it to Photos.", "error"); return; }
        if (d.body.isConnected) { choose(res.storedName); toast(`Cover ${how}. Save to keep it.`, "good"); }
      };
      const run = async (job) => {
        if (busy) return;
        busy = true;
        try { await job(); } finally { busy = false; }
      };
      const takeBlob = (blob, how) => run(() => new Promise((done) => {
        const r = new FileReader();
        r.onload = async () => {
          const res = await SS.shared.addToPhotos({dataUrl: r.result, folder: "Covers", tag: "Cover", caption: getTitle()});
          if (!res || res.error) toast((res && res.error) || "Couldn't add it to Photos.", "error");
          else if (d.body.isConnected) { choose(res.storedName); toast(`Cover ${how}. Save to keep it.`, "good"); }
          done();
        };
        r.onerror = () => done();
        r.readAsDataURL(blob);
      }));
      const takeUrl = (url, how) => run(async () => {
        const got = await call("media_picture_from_url", [url], "Fetching the picture");
        if (!got || got.error || !got.path) { toast((got && got.error) || "Couldn't fetch that picture.", "error"); return; }
        await takePath(got.path, how);
      });
      const fromClipboard = (quiet) => run(async () => {
        const got = await call("media_clipboard_picture", [], "");
        if (got && got.path) { await takePath(got.path, "pasted"); return; }
        if (!quiet) toast((got && got.error) || "There's no picture on the clipboard. Copy the picture itself (right-click, Copy image).", "error");
      });
      const urlIn = (text) => {
        const t = String(text || "");
        const m = t.match(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/i);
        if (m) { const a = document.createElement("textarea"); a.innerHTML = m[1]; return a.value; }
        const line = t.split(/\r?\n/).map((x) => x.trim()).find((x) => x && !x.startsWith("#"));
        return line && /^(https?:\/\/|file:\/\/|data:image\/)\S+$/i.test(line) ? line : "";
      };
      const imageFile = (list) => [...(list || [])].map((x) => (x.getAsFile ? x.kind === "file" && x.getAsFile() : x))
        .find((x) => x && /^image\//.test(x.type));
      const onPaste = (e) => {
        if (!d.body.isConnected) { off(); return; }
        pasteSeen = Date.now();
        const cd = e.clipboardData;
        const get = (k) => { try { return (cd && cd.getData && cd.getData(k)) || ""; } catch (err) { return ""; } };
        const img = imageFile(cd && cd.items);
        const inText = !!(e.target && e.target.closest && e.target.closest("input, textarea"));
        const html = get("text/html"), text = get("text/plain");
        const htmlUrl = html && !html.replace(/<[^>]*>/g, "").trim() ? urlIn(html) : "";
        if (img) { e.preventDefault(); e.stopPropagation(); takeBlob(img, "pasted"); return; }
        if (htmlUrl) { e.preventDefault(); e.stopPropagation(); takeUrl(htmlUrl, "pasted"); return; }
        if (inText && text.trim()) return;                        // words into a text box
        e.preventDefault(); e.stopPropagation();
        fromClipboard(false);
      };
      /* Ctrl+V with nothing that takes a paste focused may fire no paste at
         all: then the clipboard is read directly. */
      const onKey = (e) => {
        if (!d.body.isConnected) { off(); return; }
        if (!(e.ctrlKey || e.metaKey) || e.altKey || String(e.key).toLowerCase() !== "v") return;
        if (e.target && e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
        const at = Date.now();
        setTimeout(() => { if (pasteSeen < at && d.body.isConnected) fromClipboard(false); }, 250);
      };
      const off = () => {
        document.removeEventListener("paste", onPaste, true);
        document.removeEventListener("keydown", onKey, true);
      };
      document.addEventListener("paste", onPaste, true);
      document.addEventListener("keydown", onKey, true);
      modal.addEventListener("dragover", (e) => { e.preventDefault(); prev.classList.add("drop"); });
      modal.addEventListener("dragleave", (e) => { if (!modal.contains(e.relatedTarget)) prev.classList.remove("drop"); });
      modal.addEventListener("drop", (e) => {
        e.preventDefault(); e.stopPropagation(); prev.classList.remove("drop");
        const dt = e.dataTransfer;
        const f = imageFile(dt && dt.files);
        if (f) { takeBlob(f, "added"); return; }
        const get = (k) => { try { return (dt && dt.getData(k)) || ""; } catch (err) { return ""; } };
        const url = urlIn(get("text/uri-list")) || urlIn(get("text/html")) || urlIn(get("text/plain"));
        if (url) takeUrl(url, "added");
        else toast("That wasn't a picture.", "error");
      });

      /* From the old cover menu on a film's page (gone, 15 Nov 2026: Cam,
         "remove the change cover feature because it already lives in the
         edit details"): a still from the film, and a CD's album cover. */
      const extra = d.body.querySelector("#sh-pick-extra");
      if (model.albumId && extra) {
        extra.insertAdjacentHTML("beforeend", `<button type="button" class="btn btn-quiet btn-sm" data-cv="album">Album cover</button>`);
        extra.querySelector('[data-cv="album"]').onclick = () => {
          state.photo = ""; state.clear = false; state.album = true; none.hidden = false;
          prev.innerHTML = `<span class="stamp">The album's cover</span>`;
        };
      }
      if (model.id && extra) loadFilms().then(() => {
        const film = filmFor(model);
        if (!film || !d.body.isConnected) return;
        extra.insertAdjacentHTML("beforeend", `<button type="button" class="btn btn-quiet btn-sm" data-cv="still">Still from the film</button>`);
        extra.querySelector('[data-cv="still"]').onclick = () => run(async () => {
          toast("Taking a still from the film…");
          const st = await call("media_film_still", [film.path], "Taking a still");
          if (!st || st.error) { toast((st && st.error) || "Couldn't take a still.", "error"); return; }
          await takePath(st.path, "taken from the film");
        });
      });
      return state;
    },
    async apply(item, state) {
      if (!state) return;
      if (state.photo) {
        const res = await call("media_cover_from_photo", [item.id, state.photo], "The cover");
        if (res && res.error) { toast(res.error, "error"); return; }
        coverCache.delete(item.id);
        await patchItem(item.id, {cover: new Date().toISOString(), coverPhoto: state.photo});
      } else if (state.album && item.albumId) {
        const songs = SS.Music && SS.Music.albumSongs ? await SS.Music.albumSongs(item.albumId) : null;
        if (!songs || !songs.art) { toast("That album has no cover in Music.", "error"); return; }
        const res = await call("media_cover_from_album", [item.id, songs.art], "The cover");
        if (res && res.error) { toast(res.error, "error"); return; }
        coverCache.delete(item.id);
        await patchItem(item.id, {cover: new Date().toISOString(), coverPhoto: ""});
      } else if (state.clear) {
        await call("media_cover_clear", [item.id], "Removing the cover");
        coverCache.set(item.id, "");
        await patchItem(item.id, {cover: "", coverPhoto: ""});
      }
    },
  };

  /* Covers from before 2026-10-02 were only the shelf's small copies: each
     goes into Photos → Covers once (its coverPhoto says so), so every cover
     can be found, kept and exported where the photos are. */
  let adopting = false;
  async function adoptOldCovers() {
    if (adopting || !(SS.shared && SS.shared.addToPhotos)) return;
    const old = doc.items.filter((it) => it.cover && !it.coverPhoto && !it.albumId);
    if (!old.length) return;
    adopting = true;
    try {
      for (const it of old) {
        const path = await call("media_cover_file", [it.id], "");
        if (!path) continue;
        const res = await SS.shared.addToPhotos({path, folder: "Covers", tag: "Cover", caption: it.title});
        if (res && res.ok) await patchItem(it.id, {coverPhoto: res.storedName});
      }
    } finally { adopting = false; }
  }

  /* ---- a CD's songs, from its Music album --------------------------------- */
  async function drawSongs(page, it) {
    const box = page.querySelector("#sh-songs");
    if (!box) return;
    const got = SS.Music && SS.Music.albumSongs ? await SS.Music.albumSongs(it.albumId) : null;
    if (!page.contains(box)) return;
    if (!got) { box.innerHTML = `<p class="stamp">Its album isn't in Music any more.</p>`; return; }
    const mins = (s) => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "";
    box.innerHTML = `<div class="sh-songs-h"><b>Songs</b>
        <button class="btn btn-quiet btn-sm" data-song="0">▶ Play album</button></div>
      <ol class="sh-songlist">${got.tracks.map((t, i) => `<li class="${t.missing ? "missing" : ""}">
        <button class="sh-song" data-song="${i}" ${t.missing ? "disabled title=\"The file isn't in your library\"" : ""}>
          <span class="sh-song-t">${esc(t.title)}</span>
          ${t.artist && t.artist !== it.creator ? `<span class="stamp">${esc(t.artist)}</span>` : ""}
          <span class="stamp sh-song-d">${mins(t.duration)}</span></button></li>`).join("")}</ol>`;
    /* playAlbum counts only the playable songs, so a missing one shifts the
       ones after it: "from" is the place among those. */
    const playable = got.tracks.map((t, i) => (t.missing ? -1 : i)).filter((i) => i >= 0);
    box.querySelectorAll("[data-song]").forEach((b) => b.onclick = async () => {
      const from = Math.max(0, playable.indexOf(Number(b.dataset.song)));
      if (!(await SS.Music.playAlbumAt(it.albumId, from))) toast("That wouldn't play.", "error");
    });
  }

  /* ======================================================================
     THE MODULE -- drawn by Stuff for stuff:shelf.
     ====================================================================== */

  async function mount(h) {
    host = h;
    h.innerHTML = "";
    const page = document.createElement("div");
    page.className = "page ss-shelf";
    h.appendChild(page);
    if (openId) return renderEntry(page);
    return renderShelf(page);
  }

  /** A film on the shelf at random, for the Random Movie widget. */
  async function randomFilm(notId) {
    await load();
    const pool = doc.items.filter(isFilm);
    const from = pool.length > 1 ? pool.filter((x) => x.id !== notId) : pool;
    const it = from[Math.floor(Math.random() * from.length)] || null;
    if (it) await coversFor([it.id]);
    return it ? {item: it, cover: coverCache.get(it.id) || "", plain: plainCover(it)} : null;
  }


  /* Media Art (15 Nov 2026). Cam: "Media Art (this is where i can put
     pictures of DVD, VHS, Vinyl, CD and more covers. Then you can action them
     and place them into the application for me on the respective film. If the
     film isnt in neuronet then you can add them into the media list as well
     as place the respective picture. This will help speed up data entry."
     neuronet-media-art (Claude, after reading the picture) hands one over:
     the item with that title and type is found (or added), the format is
     tagged, and the picture goes into Photos -> Covers and onto it. */
  async function coverFromFile(p) {
    if (!p || !String(p.path || "") || !String(p.title || "").trim()) return {error: "A picture and a title, please."};
    return takeIn(Object.assign({}, p, {formats: p.format ? [p.format] : []}));
  }

  /** One thing into Media, found or added: Media Art (a cover picture) and
      Scan (a barcode) both come here. p: {title, type, formats[], year,
      creator, barcode?, path? (a picture for its cover), keepCover? (only
      when it has none: a scan's cover never replaces Cam's own)}. The same
      barcode, else the same type and title (and artist, when both have one),
      is the same thing: what's new about it (a format, a year) goes onto it. */
  async function takeIn(p) {
    const path = String(p.path || ""), title = String(p.title || "").trim();
    const kinds = ((SS.Stuff && SS.Stuff.MEDIA_KINDS) || []).map((k) => k.id);
    const type = kinds.includes(p.type) ? p.type : "film";
    if (!title) return {error: "A title, please."};
    const got = await call("effects_load", [], "Your media");
    if (!got || got.error) return got || {error: "Media couldn't be read."};
    const items = got.items || [];
    const it0 = findSame(items, Object.assign({}, p, {type, title}));
    let it = it0;
    const added = !it;
    const year = String(p.year || "").trim(), creator = String(p.creator || "").trim();
    const code = String(p.barcode || "").trim();
    if (!it) {
      it = {id: "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), type, title,
            creator, year, notes: "", formats: [], added: new Date().toISOString()};
      items.push(it);
    }
    if (year && !it.year) it.year = year;
    if (creator && !it.creator) it.creator = creator;
    if (code) it.barcodes = [...new Set((it.barcodes || []).concat([code]))];
    it.formats = Array.isArray(it.formats) ? it.formats : [];
    const newFormats = (p.formats || []).map((x) => String(x || "").trim()).filter((x) => x && !it.formats.includes(x));
    it.formats.push(...newFormats);
    it.updated = new Date().toISOString();
    const saved = await call("effects_save", [{items, types: got.types || []}], "Saving");
    if (saved && saved.error) return saved;
    let covered = false;
    if (path && !(p.keepCover && it.cover)) {
      const photo = await SS.shared.addToPhotos({path, folder: "Covers", tag: "Cover", caption: it.title});
      if (!photo || photo.error) return photo || {error: "The picture couldn't go into Photos."};
      const cov = await call("media_cover_from_photo", [it.id, photo.storedName], "The cover");
      if (!cov || cov.error) return cov || {error: "The cover couldn't be set."};
      coverCache.set(it.id, cov.cover);
      await patchItem(it.id, {cover: new Date().toISOString(), coverPhoto: photo.storedName});
      covered = true;
    }
    if (host && host.isConnected) mount(host);
    return {ok: true, id: it.id, added, title: it.title, type: it.type, formats: it.formats, newFormats, covered};
  }

  function findSame(items, p) {
    const code = String(p.barcode || "").trim();
    if (code) {
      const byCode = items.find((x) => (x.barcodes || []).includes(code));
      if (byCode) return byCode;
    }
    const year = String(p.year || "").trim(), creator = String(p.creator || "").trim();
    const same = items.filter((x) => x.type === p.type && norm(x.title) === norm(p.title)
      && (!creator || !x.creator || norm(x.creator) === norm(creator)));
    return same.find((x) => year && String(x.year || "") === year) || same.find((x) => !year || !x.year) || null;
  }

  /* ---- Scan (15 Nov 2026) ---------------------------------------------------
     Cam chose the barcode scan from the ideas to speed up data entry: the
     number under the barcode (typed, or from a USB barcode scanner, which
     types it and presses Enter), photos of barcodes, or the Barcodes folder
     in Documents/NeuroNet Picture References/Art to Action. Each is looked
     up (barcodes.py), shown to check, and added with its format and cover;
     then the box is ready for the next one. */
  async function scanDialog() {
    const kinds = (SS.Stuff && SS.Stuff.MEDIA_KINDS) || [{id: "film", name: "Film"}];
    const formatsOf = (t) => ((SS.Stuff && SS.Stuff.MEDIA_FORMATS) || {})[t] || [];
    const d = SS.shared.openDlg("Scan a barcode", "", true);
    d.body.closest(".modal").classList.add("sc-modal");
    let queue = [], folder = {count: 0}, stage = "start", lastType = SS.Shelf._lastType || "film", done = 0;
    const row = (btns) => { d.row.innerHTML = ""; btns.forEach(([l, c, f]) => d.btn(l, c, f)); };
    const refreshFolder = async () => {
      const f = await call("media_scan_folder", [false], "");
      folder = f && !f.error ? f : {count: 0};
      if (stage === "start") start();
    };

    function start(msg, kind) {
      stage = "start";
      d.body.innerHTML = `
        <p class="stamp">Type the number under the barcode (a barcode scanner types it for you), or read
          it from photos. Films, music, books and games.</p>
        <label class="dlg-label" for="sc-code">Barcode</label>
        <input class="input sc-code" id="sc-code" inputmode="numeric" autocomplete="off" placeholder="9 780140 328721">
        ${msg ? `<p class="sc-msg ${kind === "error" ? "sc-bad" : ""}">${esc(msg)}</p>` : ""}
        <div class="sc-from">
          <button class="btn" data-sc="photos">From photos…</button>
          <button class="btn" data-sc="folder"${folder.count ? "" : " disabled"}
            title="${esc(folder.folder || "")}">Barcodes folder${folder.count ? ` (${folder.count})` : ""}</button>
          <button class="btn btn-quiet" data-sc="open" title="${esc(folder.folder || "")}">Open the folder</button>
        </div>`;
      row([["Close", "btn-quiet", d.close], ["Look up", "btn-primary", () => {
        const v = d.body.querySelector("#sc-code").value.trim();
        if (!v) { toast("Type the barcode's number first.", "error"); return; }
        queue = [{code: v}];
        next();
      }]]);
      d.body.querySelector('[data-sc="photos"]').onclick = async () => {
        const got = await call("media_scan_pictures", [], "Reading the photos");
        if (got && got.pictures) fromPictures(got.pictures, false);
      };
      d.body.querySelector('[data-sc="folder"]').onclick = async () => {
        const got = await call("media_scan_folder", [true], "Reading the Barcodes folder");
        if (got && got.pictures) fromPictures(got.pictures, true);
      };
      d.body.querySelector('[data-sc="open"]').onclick = () => call("media_scan_open_folder", [], "The folder");
      setTimeout(() => { const i = d.body.querySelector("#sc-code"); if (i) i.focus(); }, 0);
    }

    function fromPictures(pics, fromFolder) {
      const unread = pics.filter((x) => !x.codes.length);
      queue = pics.filter((x) => x.codes.length).map((x) => ({code: x.codes[0], path: x.path, name: x.name, fromFolder}));
      const note = unread.length ? `${unread.length === 1 ? `No barcode could be read in ${unread[0].name}`
        : `${unread.length} photos had no barcode that could be read`}${fromFolder ? " (left in the folder)" : ""}.` : "";
      if (!queue.length) { start(note || "No photos.", "error"); return; }
      if (note) toast(note, "error");
      next();
    }

    async function next() {
      const entry = queue.shift();
      if (!entry) { await refreshFolder(); start(done ? `Done: ${done} in Media. Next one?` : ""); return; }
      stage = "looking";
      d.body.innerHTML = `<p class="sc-msg">Looking up ${esc(entry.code)}…</p>`;
      row([["Cancel", "btn-quiet", () => { queue = []; start(); }]]);
      const res = await call("media_scan_lookup", [entry.code], "The lookup");
      if (stage !== "looking") return;
      if (!res || res.error) {
        if (queue.length) { toast(`${entry.code}: ${(res && res.error) || "no answer"}`, "error"); next(); return; }
        start((res && res.error) || "The lookup didn't answer.", "error");
        return;
      }
      review(entry, res);
    }

    async function review(entry, res) {
      stage = "review";
      const type = res.type || lastType;
      let picked = new Set(res.format ? [res.format] : []);
      const got = await call("effects_load", [], "Your media");
      const have = got && !got.error ? findSame(got.items || [], {barcode: res.code, type, title: res.title,
        year: res.year, creator: res.creator}) : null;
      d.body.innerHTML = `
        <div class="sc-found">
          <div class="sc-cover">${res.preview ? `<img src="${esc(res.preview)}" alt="">`
            : `<span class="stamp">No cover found</span>`}</div>
          <div class="sc-fields">
            <p class="stamp">${res.found ? `Found on ${esc(res.source)}` : "Not found online: fill it in, and the barcode is kept with it"}
              · ${esc(res.code)}${entry.name ? ` · ${esc(entry.name)}` : ""}${queue.length ? ` · ${queue.length} more waiting` : ""}</p>
            ${res.note ? `<p class="sc-msg sc-bad">${esc(res.note)}</p>` : ""}
            <label class="dlg-label" for="sc-title">Title</label>
            <input class="input" id="sc-title" value="${esc(res.title)}" placeholder="Aliens">
            <label class="dlg-label" for="sc-creator">By <span class="stamp">(optional)</span></label>
            <input class="input" id="sc-creator" value="${esc(res.creator)}" placeholder="Director, artist or author">
            <div class="sc-two">
              <div><label class="dlg-label" for="sc-year">Year <span class="stamp">(optional)</span></label>
                <input class="input" id="sc-year" value="${esc(res.year)}" inputmode="numeric" placeholder="1986"></div>
              <div><label class="dlg-label" for="sc-type">Type</label>
                <select class="input" id="sc-type">${kinds.map((k) => `<option value="${esc(k.id)}"${
                  k.id === type ? " selected" : ""}>${esc(k.name)}</option>`).join("")}</select></div>
            </div>
            <label class="dlg-label">Formats</label><div class="st-formats" id="sc-formats"></div>
            ${have ? `<p class="sc-have">Already in Media: <b>${esc(have.title)}</b>${(have.formats || []).length
              ? ` (${esc(have.formats.join(", "))})` : ""}. Adding puts anything new on it.</p>` : ""}
          </div>
        </div>`;
      const typeSel = d.body.querySelector("#sc-type");
      const paint = () => {
        const list = formatsOf(typeSel.value);
        picked = new Set([...picked].filter((x) => list.includes(x)));
        const box = d.body.querySelector("#sc-formats");
        box.innerHTML = list.length ? list.map((x) => `<button type="button" class="chip ${picked.has(x) ? "on" : ""}"
          data-fmt="${esc(x)}" aria-pressed="${picked.has(x)}">${esc(x)}</button>`).join("")
          : `<span class="stamp">No formats for this type.</span>`;
        box.querySelectorAll("[data-fmt]").forEach((b) => b.onclick = () => {
          if (picked.has(b.dataset.fmt)) picked.delete(b.dataset.fmt); else picked.add(b.dataset.fmt);
          paint();
        });
      };
      typeSel.onchange = paint;
      paint();
      const val = (id) => d.body.querySelector(id).value.trim();
      row([[queue.length ? "Skip" : "Back", "btn-quiet", () => (queue.length ? next() : start())],
        [have ? "Add to it" : "Add", "btn-primary", async () => {
          const title = val("#sc-title");
          if (!title) { toast("Give it a title.", "error"); return; }
          lastType = typeSel.value; SS.Shelf._lastType = lastType;
          const r = await takeIn({title, creator: val("#sc-creator"), year: val("#sc-year"), type: lastType,
            formats: [...picked], barcode: res.code, path: res.cover, keepCover: true});
          if (!r || r.error) { toast((r && r.error) || "Couldn't add it.", "error"); return; }
          if (entry.fromFolder) await call("media_scan_done", [entry.path], "");
          done++;
          toast(r.added ? `${r.title} added to Media.` : r.newFormats.length
            ? `${r.newFormats.join(", ")} added to ${r.title}.` : `${r.title} is already in Media.`);
          next();
        }]]);
      setTimeout(() => d.body.querySelector("#sc-title").focus(), 0);
    }

    start();
    refreshFolder();
  }

  SS.Shelf = {
    mount, openEntry, randomFilm, coverField, coverFromFile, takeIn, scanDialog,
    patch: (id, p) => patchItem(id, p),
    hasOpen: () => !!openId,
    /** The CD covers (where the old Albums page sends you). */
    showCDs() {
      openId = null; type = "music"; fmt = ""; SS.Shelf._lastType = "music";
      if (SS.Stuff && SS.Stuff.setMediaView) SS.Stuff.setMediaView("covers");
      const here = SS.where ? SS.where().view : "";
      if (here === "stuff:media" && host) mount(host); else SS.go("stuff:media");
    },
    /** A music album's CD page (the album editor's Back). */
    async openAlbum(albumId) {
      await load();
      const it = doc.items.find((x) => x.albumId === albumId);
      if (SS.Stuff && SS.Stuff.setMediaView) SS.Stuff.setMediaView("covers");
      if (!it) return SS.Shelf.showCDs();
      type = "music"; fmt = ""; openId = it.id;
      const here = SS.where ? SS.where().view : "";
      if (here === "stuff:media" && host) mount(host); else SS.go("stuff:media");
    },
    leave() { flush(); },
    _lastType: "",
    _test: {filmFor, shown, patchItem, loadFilms, adoptOldCovers, get openId() { return openId; },
            set films(v) { films = v; }, coverCache},
  };
})();
