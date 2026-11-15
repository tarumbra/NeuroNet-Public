/* ==========================================================================
   Assets — Creative → Assets.

   Cam (2026-10-03): "lets add a new feature called assets, This is where i
   can go in and upload new assets into their respective categories or create
   them. So for example all the assets used in scrapbook and boards (These
   assets can then be used in projects straight from the app."

   One page, by category: what's built in (clip art from ui/assets/clipart.js,
   and the Scrapbook's tapes, frames, papers, words and embellishments), the
   sticker book, and Cam's own pictures -- uploaded, imported by the packful
   from files, taken from Photos, or made here in the Scrapbook's editor
   (a design kept beside the picture, so it can be opened and changed again).

   SS.AssetStore is how everything else reaches them: the materials panel in
   the Scrapbook, Covers and Boards lists them and puts copies on pages.
   Files: neuronet_data/assets/ (paper_assets.py).
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const A = () => SS.ScrapArt;

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  /* the same list as paper_assets.CATEGORIES (test_paper_assets.py checks) */
  const CATEGORIES = [
    ["clipart", "Clip art"], ["stickers", "Stickers"], ["backgrounds", "Backgrounds & papers"],
    ["borders", "Borders & frames"], ["tapes", "Tapes & ribbons"], ["words", "Words & labels"],
    ["game", "Game assets"], ["sticky", "Sticky notes"], ["other", "Other"],
  ];
  const catName = (k) => (CATEGORIES.find((c) => c[0] === k) || [0, "Other"])[1];

  /* ------------------------------------------------------------ the store */

  let listCache = null;
  const dataCache = new Map(), thumbCache = new Map();

  const AssetStore = {
    CATEGORIES,
    async list(force) {
      if (!listCache || force) {
        const got = await SS.Store.call("assets_list", [], "Your assets");
        listCache = (got && got.assets) || [];
      }
      return listCache;
    },
    data(id) {
      if (!dataCache.has(id)) {
        dataCache.set(id, SS.Store.call("asset_data", [id], "Loading an asset").then((got) => {
          if (!got || got.error) dataCache.delete(id);
          return got;
        }));
      }
      return dataCache.get(id);
    },
    /** A small copy for buttons and tiles (PNG, so see-through stays so). */
    thumb(id) {
      if (!thumbCache.has(id)) {
        /* by address (2026-10-06, the audit): NeuroNet makes the small PNG
           once and the page's engine fetches and frees it; the whole picture
           no longer crosses as text for a tile. An SVG, or no Pillow: as before. */
        thumbCache.set(id, SS.Store.call("asset_thumb_url", [id], "").then((t) => {
          if (t && t.dataUrl) return t.dataUrl;
          return AssetStore.data(id).then(async (got) => {
            if (!got || !got.dataUrl) return "";
            if (/^data:image\/svg/.test(got.dataUrl) || !A()) return got.dataUrl;
            return A().shrink(got.dataUrl, 200, "image/png");
          });
        }, () => ""));
      }
      return thumbCache.get(id);
    },
    forget(id) {
      listCache = null;
      if (id) { dataCache.delete(id); thumbCache.delete(id); }
    },
  };
  SS.AssetStore = AssetStore;

  /* --------------------------------------------------------- built in

     Everything the Scrapbook already draws, shown where it belongs, so the
     Assets page is the one place to see what there is. Built-in pieces can't
     be changed or deleted -- they're part of NeuroNet. */
  function builtIns(cat) {
    const out = [];
    const sample = (kind, style) => {
      const it = A().make(kind, style);
      if (!it) return "";
      it.id = `as-${kind}-${style}`; it.x = 0; it.y = 0; it.rot = 0;
      if (kind === "frame") it.src = "";
      return `<svg viewBox="-6 -6 ${it.w + 12} ${it.h + 12}" aria-hidden="true">${A().itemSVG(it)
        .replace(/Double-click for a photo/, "")}</svg>`;
    };
    if (cat === "clipart" && SS.ClipArt) {
      SS.ClipArt.LIST.forEach((a) => out.push({key: "clip:" + a[0], name: a[1], note: a[2], art: SS.ClipArt.svg(a[0], null, 90)}));
    }
    if (!A()) return out;
    if (cat === "stickers") A().EMBS.forEach((e) => out.push({key: "emb:" + e[0], name: e[1], note: "Embellishment", art: sample("emb", e[0])}));
    if (cat === "borders") A().FRAMES.forEach((f) => out.push({key: "frame:" + f[0], name: f[1], note: "Frame", art: sample("frame", f[0])}));
    if (cat === "tapes") A().TAPES.forEach((t) => out.push({key: "tape:" + t[0], name: t[1], note: "Tape", art: sample("tape", t[0])}));
    if (cat === "words") A().WORDS.forEach((w) => out.push({key: "word:" + w[0], name: w[1], note: "Words", art: sample("word", w[0])}));
    /* Cam (2026-10-04): "add all game assets into assests sub section" --
       every NeuroPets sprite, each a starting point in Pixel art. */
    if (cat === "game" && window.PixelCore && window.PetArt && SS.Pixel) {
      PixelCore.templates(window.PetArt, window.PetCore).forEach((t) => out.push({key: t.id, name: t.name, note: "NeuroPets · " + t.group,
        art: `<img class="px-art" src="${SS.Pixel.templateThumb(t)}" alt="">`, template: t.id}));
    }
    if (cat === "backgrounds") {
      A().PAPERS.forEach(([k, n]) => out.push({key: "paper:" + k, name: n, note: "Scrapbook paper",
        art: `<svg viewBox="0 0 120 120" aria-hidden="true">${A().paperSVG(k, "", 120, 120)}</svg>`}));
      A().COVERS.forEach(([k, n]) => out.push({key: "cover:" + k, name: n, note: "Cover material",
        art: `<svg viewBox="0 0 120 120" aria-hidden="true">${A().materialSVG(k, "", 120, 120)}</svg>`}));
    }
    return out;
  }

  /* ------------------------------------------------------------ the page */

  const CAT_KEY = "nn:assets:cat";
  const getCat = () => { try { return window.localStorage.getItem(CAT_KEY) || "all"; } catch (e) { return "all"; } };
  /* Cam (2026-10-04): "create a folder for in progress in there is where my
     current works in progress go. Once completed i can simply change location
     to completed works". Two folders above the categories; a category shows
     its completed works, In progress shows what isn't finished. */
  const FOLDERS = [["wip", "In progress"], ["done", "Completed works"]];
  const STAGE_NAME = {wip: "In progress", done: "Completed works"};
  const isWip = (a) => a.stage === "wip";
  const setCat = (c) => { try { window.localStorage.setItem(CAT_KEY, c); } catch (e) { /* ignore */ } };
  let stickers = [];

  async function render(host) {
    const cat = getCat();
    const mine = await AssetStore.list(true);
    const sb = await SS.Store.call("scrapbook_stickers", [], "Your sticker book");
    stickers = (sb && sb.stickers) || [];
    const count = (k) => mine.filter((a) => a.cat === k && !isWip(a)).length + (k === "stickers" ? stickers.length : 0);
    const inFolder = (f) => mine.filter((a) => (f === "wip") === isWip(a)).length;
    host.innerHTML = `
      <div class="bd-head as-head">
        <h2 class="page-h">Assets</h2>
        <p class="stamp">Clip art, stickers, backgrounds and more — yours and NeuroNet's — ready for Scrapbooks, Boards and Covers.</p>
        <div class="bd-actions">
          <button class="btn btn-primary" id="as-add">+ Add assets</button>
          <button class="btn btn-quiet" id="as-create">Create one</button>
        </div>
      </div>
      <div class="as-layout">
        <nav class="as-cats" aria-label="Categories">
          ${FOLDERS.map(([k, n]) => `<button class="as-cat as-folder ${cat === k ? "on" : ""}" data-cat="${k}">${k === "wip" ? "✎" : "✓"} ${esc(n)} <span>${inFolder(k)}</span></button>`).join("")}
          <button class="as-cat ${cat === "all" ? "on" : ""}" data-cat="all">Everything <span>${mine.length + stickers.length}</span></button>
          ${CATEGORIES.map(([k, n]) => `<button class="as-cat ${cat === k ? "on" : ""}" data-cat="${k}">${esc(n)} <span>${count(k)}</span></button>`).join("")}
        </nav>
        <section class="as-main">
          <input class="input as-q" id="as-q" type="search" autocomplete="off" placeholder="Search the assets…" aria-label="Search the assets">
          <div class="as-drop-hint" id="as-drop-hint">Drop pictures here to add them to ${esc(catName(defaultCat()))}.</div>
          <div id="as-grid"></div>
        </section>
      </div>`;
    host.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => { setCat(b.dataset.cat); render(host); });
    host.querySelector("#as-add").onclick = () => addDialog(host);
    host.querySelector("#as-create").onclick = () => createDialog(host);
    let typing = null;
    host.querySelector("#as-q").addEventListener("input", () => {
      clearTimeout(typing);
      typing = setTimeout(() => drawGrid(host), 150);
    });
    wireDrop(host);
    drawGrid(host);
  }

  function drawGrid(host) {
    const cat = getCat();
    const q = host.querySelector("#as-q").value.trim().toLowerCase();
    const hit = (...words) => !q || words.some((w) => String(w || "").toLowerCase().includes(q));
    const inView = (a) => cat === "all" || (cat === "wip" ? isWip(a) : cat === "done" ? !isWip(a) : a.cat === cat && !isWip(a));
    const mine = (listCache || []).filter((a) => inView(a) && hit(a.name, catName(a.cat)));
    const book = cat === "all" || cat === "stickers" || cat === "done" ? stickers.filter((s) => hit(s.name, "sticker")) : [];
    /* built-ins under their category; the NeuroPets art (hundreds of sprites)
       only under Game assets, so Everything stays a page you can scroll */
    const cats = cat === "all" ? CATEGORIES.map((c) => c[0]).filter((c) => c !== "game") : FOLDERS.some((f) => f[0] === cat) ? [] : [cat];
    const built = cats.flatMap((c) => builtIns(c).map((b) => ({...b, cat: c}))).filter((b) => hit(b.name, b.note));
    const grid = host.querySelector("#as-grid");
    const section = (title, n, tiles) => (n ? `<h3 class="as-sec">${esc(title)} <span>${n}</span></h3><div class="as-grid">${tiles}</div>` : "");
    grid.innerHTML = section("Yours", mine.length, mine.map((a) => `
        <div class="as-tile" data-id="${esc(a.id)}">
          <div class="as-th"><span class="as-img"></span></div>
          <div class="as-name" title="${esc(a.name)}">${esc(a.name)}</div>
          <div class="as-meta">${esc(catName(a.cat))}${a.w ? ` · ${a.w}×${a.h}` : ""}${isWip(a) ? `<span class="as-stage">In progress</span>` : ""}</div>
          <div class="as-btns">
            ${a.design ? `<button class="btn btn-quiet" data-edit="${esc(a.id)}" title="Open it in ${a.kind === "pixel" ? "Pixel art" : a.kind === "vector" ? "Vector" : "the editor"}">Edit</button>` : ""}
            ${isWip(a) ? `<button class="btn btn-quiet" data-finish="${esc(a.id)}" title="Move it to Completed works">Completed</button>` : ""}
            <button class="btn btn-quiet" data-details="${esc(a.id)}" title="Name and category">Details</button>
            <button class="btn btn-quiet bd-del" data-del="${esc(a.id)}">Delete</button>
          </div>
        </div>`).join(""))
      + section("Sticker book", book.length, book.map((s) => `
        <div class="as-tile">
          <div class="as-th"><img src="${esc(s.dataUrl)}" alt=""></div>
          <div class="as-name" title="${esc(s.name)}">${esc(s.name)}</div>
          <div class="as-meta">Made from a photo</div>
          <div class="as-btns"><button class="btn btn-quiet bd-del" data-unsticker="${esc(s.id)}">Delete</button></div>
        </div>`).join(""))
      + section("Built in", built.length, built.map((b) => `
        <div class="as-tile is-builtin" title="${esc(b.name)} — part of NeuroNet">
          <div class="as-th">${b.art}</div>
          <div class="as-name">${esc(b.name)}</div>
          <div class="as-meta">${esc(b.note)}</div>
          ${b.template ? `<div class="as-btns"><button class="btn btn-quiet" data-template="${esc(b.template)}" title="Start a sprite from it in Pixel art">Open in Pixel art</button></div>` : ""}
        </div>`).join(""))
      + (mine.length + book.length + built.length ? ""
        : `<p class="bd-empty">${q ? "Nothing matches that." : "Nothing here yet — add some pictures, or create one."}</p>`);
    grid.querySelectorAll(".as-tile[data-id]").forEach((t) => {
      AssetStore.thumb(t.dataset.id).then((url) => {
        const img = t.querySelector(".as-img");
        if (url && img) img.style.backgroundImage = `url("${url}")`;
      }).catch(() => {});
    });
    grid.querySelectorAll("[data-details]").forEach((b) => b.onclick = () => detailsDialog(host, b.dataset.details));
    grid.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => {
      const a = (listCache || []).find((x) => x.id === b.dataset.edit);
      if (a && a.kind === "pixel" && SS.Pixel) SS.Pixel.openAsset(a.id);
      else if (a && a.kind === "vector" && SS.Vector) SS.Vector.openAsset(a.id);
      else editMade(host, b.dataset.edit);
    });
    grid.querySelectorAll("[data-finish]").forEach((b) => b.onclick = async () => {
      const res = await SS.Store.call("asset_update", [b.dataset.finish, {stage: "done"}], "Moving the asset");
      if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
      AssetStore.forget(b.dataset.finish);
      SS.shared.toast("Moved to Completed works.");
      render(host);
    });
    grid.querySelectorAll("[data-template]").forEach((b) => b.onclick = () => SS.Pixel.openTemplate(b.dataset.template));
    grid.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => deleteAsset(host, b.dataset.del));
    grid.querySelectorAll("[data-unsticker]").forEach((b) => b.onclick = async () => {
      const s = stickers.find((x) => x.id === b.dataset.unsticker);
      const yes = await SS.shared.confirm({title: "Take this sticker out of the book?",
        body: `“${(s && s.name) || "This sticker"}” leaves the sticker book. Any already on a page stay there.`, yes: "Take it out"});
      if (!yes) return;
      const res = await SS.Store.call("scrapbook_sticker_delete", [b.dataset.unsticker], "Removing a sticker");
      if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
      render(host);
    });
  }

  const catOptions = (on) => CATEGORIES.map(([k, n]) => `<option value="${k}" ${k === on ? "selected" : ""}>${esc(n)}</option>`).join("");
  const defaultCat = () => { const c = getCat(); return CATEGORIES.some((x) => x[0] === c) ? c : "clipart"; };
  const stageOptions = (on) => FOLDERS.map(([k, n]) => `<option value="${k}" ${k === on ? "selected" : ""}>${esc(n)}</option>`).join("");

  /* ---- adding ---- */

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("That file couldn't be read."));
      r.readAsDataURL(file);
    });
  }
  const nameOf = (file) => String(file.name || "Asset").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Asset";

  /** Pictures from the page (an upload or a drop) into a category. */
  async function addFiles(host, files, cat) {
    const list = [...(files || [])];
    let added = 0;
    const skipped = [];
    for (const f of list) {
      if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(f.type || "")) { skipped.push(f.name); continue; }
      try {
        const url = await readFile(f);
        const res = await SS.Store.call("asset_add", [cat, nameOf(f), url], "Adding an asset");
        if (res && res.ok) added += 1; else skipped.push(f.name + (res && res.error ? ` (${res.error})` : ""));
      } catch (e) { skipped.push(f.name); }
    }
    AssetStore.forget();
    SS.shared.toast(`${added} added to ${catName(cat)}${skipped.length ? ` — ${skipped.length} skipped (not PNG, JPEG, WebP, GIF or SVG): ${skipped.slice(0, 3).join(", ")}` : ""}.`,
      skipped.length && !added ? "error" : undefined);
    if (host.isConnected) render(host);
    return {added, skipped};
  }

  function wireDrop(host) {
    const zone = host.querySelector(".as-main");
    const hint = host.querySelector("#as-drop-hint");
    const has = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
    zone.addEventListener("dragover", (e) => { if (!has(e)) return; e.preventDefault(); e.stopPropagation(); hint.classList.add("on"); });
    zone.addEventListener("dragleave", () => hint.classList.remove("on"));
    zone.addEventListener("drop", (e) => {
      if (!has(e)) return;
      e.preventDefault(); e.stopPropagation();          // the app's own file drop is not for this
      hint.classList.remove("on");
      addFiles(host, e.dataTransfer.files, defaultCat());
    });
  }

  function addDialog(host) {
    const d = SS.shared.openDlg("Add assets", `
      <label class="dlg-label" for="as-add-cat">Into</label>
      <select class="input" id="as-add-cat">${catOptions(defaultCat())}</select>
      <div class="as-add-ways">
        <label class="btn btn-primary as-file">Choose pictures…
          <input type="file" id="as-file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden></label>
        <button class="btn btn-quiet" id="as-import">Import a pack of files…</button>
        <button class="btn btn-quiet" id="as-photo">From your Photos…</button>
      </div>
      <p class="sb-note">PNG, JPEG, WebP, GIF or SVG. Bought clip art usually comes as PNGs with see-through
        backgrounds — they stay see-through. “Import a pack” takes any number of files at once.
        You can also drop pictures straight onto the Assets page.</p>`);
    const cat = () => d.body.querySelector("#as-add-cat").value;
    d.body.querySelector("#as-file").onchange = async (e) => {
      const files = e.target.files;
      d.close();
      await addFiles(host, files, cat());
    };
    d.body.querySelector("#as-import").onclick = async () => {
      const c = cat();
      const res = await SS.Store.call("assets_import_files", [c], "Importing pictures");
      if (!res || res.cancelled) return;
      if (res.error) { SS.shared.toast(res.error, "error"); return; }
      d.close();
      AssetStore.forget();
      const sk = res.skipped || [];
      SS.shared.toast(`${(res.added || []).length} added to ${catName(c)}${sk.length ? ` — ${sk.length} skipped: ${sk.slice(0, 3).map((x) => x.name).join(", ")}` : ""}.`);
      render(host);
    };
    d.body.querySelector("#as-photo").onclick = async () => {
      const c = cat();
      d.close();
      const photo = await SS.shared.pickFromLibrary({title: "Choose a photo for your assets"});
      if (!photo) return;
      const got = await SS.shared.Store.getPhotoData(photo.storedName || photo.stored_name || photo);
      const url = got && (got.dataUrl || got.url);
      if (!url || !/^data:/.test(url)) { SS.shared.toast("That photo could not be loaded.", "error"); return; }
      const res = await SS.Store.call("asset_add", [c, photo.caption || photo.originalName || "Photo", url], "Adding an asset");
      if (!res || res.error) { SS.shared.toast((res && res.error) || "It couldn't be added.", "error"); return; }
      AssetStore.forget();
      SS.shared.toast(`Added to ${catName(c)}.`);
      render(host);
    };
    d.btn("Close", "btn-quiet", d.close);
  }

  function detailsDialog(host, id) {
    const a = (listCache || []).find((x) => x.id === id);
    if (!a) return;
    const d = SS.shared.openDlg("Asset details", `
      <label class="dlg-label" for="as-d-name">Name</label>
      <input class="input" id="as-d-name" value="${esc(a.name)}">
      <label class="dlg-label" for="as-d-cat">Category</label>
      <select class="input" id="as-d-cat">${catOptions(a.cat)}</select>
      <label class="dlg-label" for="as-d-stage">Location</label>
      <select class="input" id="as-d-stage">${stageOptions(a.stage || "done")}</select>`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save", "btn-save", async () => {
      const res = await SS.Store.call("asset_update", [id, {name: d.body.querySelector("#as-d-name").value,
        cat: d.body.querySelector("#as-d-cat").value, stage: d.body.querySelector("#as-d-stage").value}], "Saving the asset");
      if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
      d.close();
      AssetStore.forget(id);
      render(host);
    });
  }

  async function deleteAsset(host, id) {
    const a = (listCache || []).find((x) => x.id === id);
    const yes = await SS.shared.confirm({title: "Delete this asset?",
      body: `“${(a && a.name) || "This asset"}” leaves your assets. Copies already on scrapbook pages, boards and covers stay.`,
      yes: "Delete"});
    if (!yes) return;
    const res = await SS.Store.call("asset_delete", [id], "Deleting an asset");
    if (res && res.error) { SS.shared.toast(res.error, "error"); return; }
    AssetStore.forget(id);
    render(host);
  }

  /* ------------------------------------------------------- making one

     Cam: "or create them". The Scrapbook's editor on a canvas of its own,
     see-through unless it's a background. It saves itself as a picture in
     the chosen category (trimmed to what's drawn), with the design beside
     it -- so Edit opens it again exactly as it was. */
  const CANVASES = [
    ["square", "Square", 1000, 1000], ["wide", "Wide strip (tapes, banners)", 1600, 400],
    ["tall", "Tall", 800, 1200], ["page", "A4 page (backgrounds)", 1050, 1485],
  ];

  function createDialog(host) {
    const d = SS.shared.openDlg("Create an asset", `
      <label class="dlg-label" for="as-c-name">Name</label>
      <input class="input" id="as-c-name" value="My clip art">
      <label class="dlg-label" for="as-c-cat">Category</label>
      <select class="input" id="as-c-cat">${catOptions(defaultCat())}</select>
      <label class="dlg-label" for="as-c-size">Canvas</label>
      <select class="input" id="as-c-size">${CANVASES.map(([k, n, w, h]) => `<option value="${k}">${esc(n)} — ${w} × ${h}</option>`).join("")}</select>
      <label class="dlg-label" for="as-c-stage">Location</label>
      <select class="input" id="as-c-stage">${stageOptions("wip")}</select>
      <label class="bd-pick"><input type="checkbox" id="as-c-clear" checked><span>See-through background</span></label>
      <p class="sb-note">Every Scrapbook tool, material and clip art piece is there to make it with. It saves as you go.</p>`);
    const $ = (s) => d.body.querySelector(s);
    $("#as-c-cat").onchange = () => {
      const bg = $("#as-c-cat").value === "backgrounds";
      $("#as-c-clear").checked = !bg;
      if (bg) $("#as-c-size").value = "page";
    };
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Create", "btn-save", () => {
      const c = CANVASES.find((x) => x[0] === $("#as-c-size").value) || CANVASES[0];
      const board = {kind: "asset", name: $("#as-c-name").value.trim() || "My asset", cat: $("#as-c-cat").value, stage: $("#as-c-stage").value,
                     transparent: $("#as-c-clear").checked, w: c[2], h: c[3], pages: [{items: []}]};
      d.close();
      openMaker(host, board, null);
    });
    const f = $("#as-c-name");
    f.focus(); f.select();
  }

  async function editMade(host, id) {
    const got = await SS.Store.call("asset_design", [id], "Opening the design");
    if (!got || got.error || !got.design) { SS.shared.toast((got && got.error) || "That design couldn't be opened.", "error"); return; }
    const a = (listCache || []).find((x) => x.id === id);
    const board = {...got.design, kind: "asset"};
    if (a) { board.name = a.name; board.cat = a.cat; }
    openMaker(host, board, id);
  }

  /** Only what's drawn: the see-through edges cut away. */
  function trimPNG(url) {
    return new Promise((done) => {
      const img = new Image();
      const timer = setTimeout(() => done(url), 6000);        // never stuck: keep it untrimmed
      const resolve = (v) => { clearTimeout(timer); done(v); };
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const px = ctx.getImageData(0, 0, c.width, c.height).data;
          let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
          for (let y = 0; y < c.height; y++) {
            for (let x = 0; x < c.width; x++) {
              if (px[(y * c.width + x) * 4 + 3] > 8) {
                if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
              }
            }
          }
          if (x1 < 0) { resolve(url); return; }
          const pad = 4;
          x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
          x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
          const o = document.createElement("canvas");
          o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
          o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
          resolve(o.toDataURL("image/png"));
        } catch (e) { resolve(url); }
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
  }

  async function saveMade(ed) {
    const b = ed.board;
    if (!ed.assetId && !(b.pages || []).some((p) => (p.items || []).length)) return null;   // nothing made yet
    let url = await SS.BoardEditor.pagePNG(b, 0, !!b.transparent);
    if (b.transparent) url = await trimPNG(url);
    const design = JSON.parse(JSON.stringify(b));
    const res = ed.assetId
      ? await SS.Store.call("asset_update", [ed.assetId, {dataUrl: url, design}], "Saving the asset")
      : await SS.Store.call("asset_add", [b.cat || "clipart", b.name || "My asset", url, design, null, b.stage || "done"], "Saving the asset");
    if (res && res.ok && !ed.assetId) ed.assetId = res.id;
    if (res && res.ok) AssetStore.forget(ed.assetId);
    return res;
  }

  function openMaker(host, board, assetId) {
    const kit = SS.Scrapbook.makeKit("nn:assets:panel");
    const ed = SS.BoardEditor.open(host, assetId || "new-asset", board, () => render(host), {
      backLabel: "← Assets",
      bar2: `<button class="btn btn-quiet" id="sb-rot-l" title="Turn what is chosen 15° to the left">Turn left</button>
        <button class="btn btn-quiet" id="sb-rot-r" title="Turn what is chosen 15° to the right">Turn right</button>
        <span class="bd-sep"></span>
        <span class="as-made-cat">${esc(catName(board.cat))}</span>`,
      ...kit,
      save: saveMade,
      wire(ed2) {
        kit.wire(ed2);
        const hint = ed2.host.querySelector("#bd-hint");
        if (hint) hint.textContent = "Make it with any tool or material; it saves into Assets as you go"
          + (board.transparent ? ", trimmed to what's drawn, with a see-through background." : ".");
      },
    });
    ed.assetId = assetId;
    return ed;
  }

  SS.BoardEditor && SS.BoardEditor.addBackground("asset", (b, w, h, page, onScreen) => {
    if (!b.transparent) return `<rect width="${w}" height="${h}" fill="#ffffff"/>`;
    if (!onScreen) return "";
    return `<defs><pattern id="as-checker" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#f2f2f2"/><rect width="20" height="20" fill="#dcdcdc"/>
        <rect x="20" y="20" width="20" height="20" fill="#dcdcdc"/></pattern></defs>
      <rect width="${w}" height="${h}" fill="url(#as-checker)"/>`;
  });

  SS.Assets = {
    VIEWS: ["assets:library"],
    PREFIX: "assets:",
    async mount(host) {
      host.style.display = "";
      await render(host);
    },
    _test: {builtIns, addFiles, saveMade, openMaker, createDialog, render, CATEGORIES},
  };
})();
