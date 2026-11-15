/* ==========================================================================
   NeuroFarm -- the page (2026-10-07; part 2 and the new look the same day).
   ==========================================================================
   The rules are farmcore.js; this draws them and sends your clicks. Every
   change: FarmCore.act(state, action, opts, now) -> farm_save -> redraw.

   A rail down the left (Farm, Animals, Workshops, Market, Silos, Farmer), a
   bar along the top (level, coins, silos). On the Farm: the land in the
   middle, a hotbar of seeds under it, and an inspector beside it that says
   what's under your pointer -- or, with a building picked, runs it. One smart
   click does the obvious thing: plow wild land, plant your seed on bare soil,
   harvest what's ready, feed a hungry building, collect from a ready one.
   ========================================================================== */
(function () {
  "use strict";
  const F = window.FarmCore, PA = window.PetArt, FA = window.FarmArt;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ---- talking to Python (neurofarm.py Api); a test page may bring its own -------------------
  const ready = new Promise((ok) => {
    if (window.pywebview && window.pywebview.api) ok();
    else window.addEventListener("pywebviewready", () => ok(), {once: true});
  });
  const Store = window.NFStore || {
    async call(name, args) { await ready; const f = window.pywebview.api[name]; return f ? f(...(args || [])) : null; },
  };

  // page: which rail page. seed: the hotbar's pick. tool: hand | clear | a tonic | place:<house>.
  // hover: the tile under the pointer. pick: the building whose panel is open. maker: the workshop shown.
  let state = null, page = "farm", seed = "strawberry", tool = "hand", hover = null, pick = null, maker = "", sheetFresh = false, zoom = "close", findText = "";
  let queue = Promise.resolve(), timer = 0, last = null;

  // ---- pictures ------------------------------------------------------------------------------
  const pics = {};
  function draw(art, size) {
    const w = art.rows[0].length, h = art.rows.length, sc = Math.max(1, Math.floor(size / Math.max(w, h)));
    const c = document.createElement("canvas");
    c.width = w * sc; c.height = h * sc;
    PA.draw(c.getContext("2d"), art.rows, art.pal, 0, 0, sc, false);
    return c.toDataURL();
  }
  function cached(k, make) { if (pics[k] === undefined) { const a = make(); pics[k] = a && a.art ? draw(a.art, a.size) : ""; } return pics[k]; }
  const icon = (id, size) => cached(id + "@" + size, () => ({art: (FA && FA.item(id)) || (PA && (PA.itemArt(id) || PA.item(id))), size}));
  const treePic = (kind, ripe, size) => cached(`tree:${kind}:${ripe}@${size}`, () => ({art: FA.tree(kind, ripe), size}));
  const animalPic = (kind, size) => cached(`animal:${kind}@${size}`, () => ({art: PA.monster(kind), size}));
  const buildingPic = (kind, size) => cached(`bld:${kind}@${size}`, () => ({art: FA.building(kind), size}));
  const img = (src, cls) => src ? `<img alt="" src="${src}"${cls ? ` class="${cls}"` : ""}>` : "";
  // Cam's painted pictures (2026-10-09, ~/Pictures/NeuroFarm Art Assets -> ui/farm/art; art/manifest.js says which
  // there are). Anything without one keeps its pixel art.
  const ARTF = window.FarmArtFiles || {scenes: [], tiles: [], objects: [], crops: []};
  const ART_BASE = new URL("art/", (document.currentScript && document.currentScript.src) || location.href).href;
  const art = (name) => ART_BASE + name + ".webp";
  const hasArt = (kind, id) => (ARTF[kind] || []).includes(id);
  /** A crop's painted stage: 1 just planted .. 4 ready (or "" with no picture). */
  const cropArt = (id, stage) => hasArt("crops", id) ? art(`crop-${id}-${stage}`) : "";
  const growStage = (t) => t.stage === "ready" ? 4 : t.progress < 0.2 ? 1 : t.progress < 0.55 ? 2 : 3;

  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : m ? `${m}m ${String(x).padStart(2, "0")}s` : `${x}s`;
  }
  const mins = (m) => m >= 60 ? (m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`) : `${m}m`;
  const num = (n) => Number(n || 0).toLocaleString();
  const coins = (n, cls) => `<span class="nf-coin${cls ? " " + cls : ""}">${img(icon("coin", 16))}${num(n)}</span>`;
  const haveOf = (v, id) => (v.silo.find((x) => x.id === id) || {}).n || 0;
  /** A thing you need: its picture, have/need (red when short). */
  const chip = (id, need, have) => `<span class="nf-chip${have != null && have < need ? " lack" : ""}" title="${esc(F.nameOf(id))}">${img(icon(id, 16))}${have != null ? `${num(have)}/` : ""}${num(need)}</span>`;
  const costChips = (v, cost) => coins(cost.coins, v.coins < cost.coins ? "lack" : "") + Object.keys(cost.needs || {}).map((k) => chip(k, cost.needs[k], haveOf(v, k))).join("");
  const plural = (name) => name === "Sheep" ? "sheep" : name.toLowerCase() + "s";
  const bar = (p, cls) => `<span class="nf-meter${cls ? " " + cls : ""}"><span style="width:${Math.round(Math.max(0, Math.min(1, p)) * 100)}%"></span></span>`;

  function toast(msg, bad) {
    if (!msg) return;
    const el = document.createElement("div");
    el.className = "nf-toast" + (bad ? " bad" : "");
    el.textContent = msg;
    $("nf-toasts").appendChild(el);
    setTimeout(() => el.classList.add("out"), 3000);
    setTimeout(() => el.remove(), 3400);
  }

  // ---- loading, acting -------------------------------------------------------------------------
  async function load() {
    // (1.0.68: if Python never answers, say so -- the page was blank when its bridge couldn't start)
    const s = await Promise.race([Store.call("farm_load", []), new Promise((ok) => setTimeout(() => ok({error: "timeout"}), 10000))]);
    if (s && s.error === "timeout") {
      $("nf-main").innerHTML = `<section class="nf-panel nf-start"><h2>NeuroFarm couldn't reach its save</h2>
        <p class="nf-sub">The game's window started, but it can't talk to the part that keeps your farm. Close it and open it again (Super+Alt+Y).</p></section>`;
      throw new Error("NeuroFarm: no answer from farm_load");
    }
    state = s && !s.error ? s : F.empty();
  }
  function act(action, opts, quiet) {
    const run = async () => {
      const r = F.act(state, action, opts || {}, Date.now());
      if (!r.ok) { toast(r.error, true); return r; }
      const saved = await Store.call("farm_save", [r.state]);
      if (saved && saved.error) { toast(saved.error, true); return {error: saved.error}; }
      state = r.state;
      if (!quiet) toast(r.msg);
      render();
      return r;
    };
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  }

  // ---- the frame: the rail and the top bar ------------------------------------------------------
  const NAV = [
    ["farm", "Farm", () => icon("wheat", 32)],
    ["animals", "Animals", () => animalPic("chicken", 32)],
    ["make", "Workshops", () => icon("kitchen", 32)],
    ["market", "Market", () => icon("woodcrate", 32)],
    ["silo", "Silos", () => icon("silo", 32)],
    ["farmer", "Farmer", () => icon("seedling", 32)],
  ];
  function badge(k, v) {
    if (k === "farm" && v.ready) return `<span class="nf-badge go">${v.ready}</span>`;
    if (k === "farm" && v.spoiled) return `<span class="nf-badge bad">${v.spoiled}</span>`;
    if (k === "animals" && v.animalsReady) return `<span class="nf-badge go">${v.animalsReady}</span>`;
    if (k === "animals" && v.animalsHungry) return `<span class="nf-badge warn" title="Hungry">${v.animalsHungry}</span>`;
    if (k === "make") { const d = v.makers.reduce((n, m) => n + m.done, 0); if (d) return `<span class="nf-badge go">${d}</span>`; }
    if (k === "market") { const n = v.orders.filter((o) => o.can).length; if (n) return `<span class="nf-badge go">${n}</span>`; }
    if (k === "silo" && v.siloUsed >= v.siloCap) return `<span class="nf-badge bad">!</span>`;
    return "";
  }
  function frame(v) {
    $("nf-farm").textContent = v.farmName || "NeuroFarm";
    $("nf-farmer").textContent = v.farmer ? `${v.farmer}'s farm` : "A farm of your own";
    $("nf-nav").innerHTML = v.made ? NAV.map(([k, n, pic]) => `<button class="nf-navbtn${page === k ? " on" : ""}" data-page="${k}" title="${n}">
        <span class="nf-navpic">${img(pic())}${badge(k, v)}</span><span>${n}</span></button>`).join("") : "";
    const ring = 2 * Math.PI * 17, full = v.siloUsed >= v.siloCap;
    $("nf-stats").innerHTML = v.made ? `
      <span class="nf-level" title="${v.toNext ? num(v.toNext) + " xp to level " + (v.level + 1) : "The top level"}">
        <span class="nf-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" class="track"/><circle cx="20" cy="20" r="17" class="fill"
          style="stroke-dasharray:${ring.toFixed(1)};stroke-dashoffset:${(ring * (1 - v.progress)).toFixed(1)}"/></svg><b>${v.level}</b></span>
        <span><small>Level ${v.level}</small>${v.toNext ? num(v.toNext) + " xp to go" : "Top level"}</span></span>
      <span class="nf-pill">${coins(v.coins)}</span>
      <button class="nf-pill${full ? " full" : ""}" data-page="silo" title="Your silos">${img(icon("silo", 16))}<b>${v.siloUsed}</b><small>/${v.siloCap}</small>${bar(v.siloUsed / v.siloCap, full ? "bad" : "")}</button>` : "";
    document.querySelectorAll("#nf-nav [data-page], #nf-stats [data-page]").forEach((b) => b.addEventListener("click", () => { page = b.dataset.page; if (page !== "farm") tool = "hand"; render(); }));
  }

  // ---- the farm --------------------------------------------------------------------------------
  const placing = () => tool.startsWith("place:") ? tool.slice(6) : "";
  function tileHTML(t) {
    const cls = ["nf-tile"];
    let span = 1, inner = "";
    if (!t.owned) cls.push("locked"); else if (t.house) cls.push("house", "h-" + t.house.kind); else if (!t.plowed) cls.push("wild"); else cls.push("soil");
    if (t.house) {
      const h = t.house;
      span = h.size;
      if (pick && pick.x === t.x && pick.y === t.y) cls.push("picked");
      if (h.kind === "pasture") inner = `<span class="nf-pen">${h.animals.map((a) => img(animalPic(a.kind, 32), a.stage)).join("") || "<small>Empty pasture</small>"}</span>`;
      else inner = img(buildingPic(h.kind, 96), "bld") + (h.kind === "barn" ? `<span class="nf-herd">${h.animals.map((a) => img(animalPic(a.kind, 16), a.stage)).join("")}</span>` : "");
      const first = h.animals.find((a) => a.stage === "ready" && !a.stuck), hungry = h.animals.find((a) => a.stage === "hungry");
      inner += first ? `<span class="nf-bubble go">${img(icon(first.makes, 16))}${h.ready}</span>`
        : hungry ? `<span class="nf-bubble warn">${img(icon(Object.keys(hungry.eats)[0], 16))}${h.hungry}</span>`
        : !h.animals.length ? `<span class="nf-bubble">Empty</span>` : "";
    } else if (t.plant) {
      span = t.plant.size;
      cls.push(t.stage);
      let pic, painted = false;
      if (t.plant.tree) pic = treePic(t.plant.id, t.stage === "ready", 64);
      else if (t.stage === "spoiled" && hasArt("objects", "spoiled")) { pic = art("spoiled"); painted = true; }
      else if (cropArt(t.plant.id, 1) && t.stage !== "spoiled") { pic = cropArt(t.plant.id, growStage(t)); painted = true; }
      else if (t.stage === "growing" && t.progress < 0.35 && hasArt("objects", "sprout")) { pic = art("sprout"); painted = true; }
      else pic = t.stage === "growing" ? (t.progress < 0.35 ? icon("sprout", 32) : t.progress < 0.75 ? icon("seedling", 32) : icon(t.plant.item, 32)) : icon(t.plant.item, 32);
      if (!t.plant.tree) cls.push("planted");
      inner = `<img alt="" src="${pic}" class="${t.plant.tree ? "tree" : painted ? "crop painted" : "crop"}" style="${t.stage === "growing" && !t.plant.tree && !painted ? `transform:scale(${(0.55 + 0.45 * t.progress).toFixed(2)})` : ""}">`
        + (t.stage === "growing" ? `<span class="nf-grow"><span style="width:${Math.round(t.progress * 100)}%"></span></span>` : "");
    }
    return `<button class="${cls.join(" ")}" style="grid-column:${t.x + 1} / span ${span};grid-row:${t.y + 1} / span ${span}" data-x="${t.x}" data-y="${t.y}" ${t.owned ? "" : "tabindex='-1'"} aria-label="${esc(tileWords(t).title)}">${inner}</button>`;
  }
  /** What a tile is, in words: for the inspector (and screen readers). */
  function tileWords(t) {
    if (!t.owned) return {title: "Not your land yet", sub: "Buy the parcel to farm it."};
    if (t.house) {
      const h = t.house;
      return {title: h.name, sub: h.animals.length ? `${h.animals.length}/${h.cap} animals · ${h.ready} ready · ${h.hungry} hungry` : "Empty -- buy animals for it."};
    }
    if (!t.plowed) return {title: "Wild grass", sub: `Plow it to plant (${F.PLOW_COST} coins).`};
    if (!t.plant) return {title: "Bare soil", sub: "Ready to plant."};
    const n = t.plant.name;
    if (t.stage === "growing") return {title: n, sub: `Ready in ${clock(t.left)}`};
    if (t.stage === "ready") return {title: n, sub: `Ready! Spoils in ${clock(t.left)}`};
    return {title: n, sub: "Spoiled -- clear it, or use a Freshness tonic."};
  }
  function farmHTML(v) {
    const crops = v.crops.concat(v.trees), sel = crops.find((c) => c.id === seed) || crops[0];
    const pl = placing();
    const tools = [["hand", "Smart click", "wheat", "Plow, plant, harvest, feed and collect -- whatever's obvious"], ["clear", "Clear", "wood", "Pull up a crop, or chop a tree for wood"]]
      .concat(v.potions.filter((p) => p.n > 0 || v.level >= p.level).map((p) => [p.id, p.name.replace(/ tonic$/, "").replace(/ness$/, ""), p.id, `${p.name}: ${p.about}`, p.n]));
    const lots = v.parcels.filter((p) => !p.owned).map((p) => `<div class="nf-lot${p.buyable ? " buyable" : ""}" style="grid-column:${p.px * v.grid.parcel + 1} / span ${v.grid.parcel};grid-row:${p.py * v.grid.parcel + 1} / span ${v.grid.parcel}">
        ${p.buyable && hasArt("objects", "sign-forsale") ? `<img alt="" class="nf-forsale" src="${art("sign-forsale")}">` : ""}
        ${p.buyable ? (p.levelOk ? `<button class="nf-btn small${p.canAfford ? " go" : ""}" data-buy="${p.px},${p.py}">Buy land ${coins(p.cost)}</button>`
          : `<span>Level ${p.needLevel}</span>`) : ""}</div>`).join("");
    return `
      <div class="nf-farmpage">
        <section class="nf-fieldwrap">
          <div class="nf-toolbar">
            <div class="nf-seg">${tools.map(([k, n, ic, about, count]) => `<button class="${tool === k ? "on" : ""}" data-tool="${k}" title="${esc(about)}" ${count === 0 ? "disabled" : ""}>
              ${img(icon(ic, 16))}${esc(n)}${count != null ? ` <small>×${count}</small>` : ""}</button>`).join("")}</div>
            ${pl ? `<span class="nf-placing">${img(buildingPic(pl, 32) || animalPic("sheep", 16))} Placing a ${esc(F.HOUSES[pl].name.toLowerCase())} <button class="nf-btn small quiet" data-tool="hand">Cancel</button></span>` : ""}
            <span class="nf-flex"></span>
            ${hasArt("scenes", "farmland") ? `<div class="nf-seg nf-zoom" title="How much of the countryside to show">
              <button class="${zoom === "close" ? "on" : ""}" data-zoom="close">Close up</button><button class="${zoom === "whole" ? "on" : ""}" data-zoom="whole">Whole farm</button></div>` : ""}
            ${v.animalsReady ? `<button class="nf-btn go" data-all="gather">Collect animals (${v.animalsReady})</button>` : ""}
            ${v.animalsHungry ? `<button class="nf-btn" data-all="feed">Feed all (${v.animalsHungry})</button>` : ""}
            <button class="nf-btn go" data-all="harvest" ${v.ready ? "" : "disabled"}>Harvest all (${v.ready})</button>
            ${v.wild ? `<button class="nf-btn" data-all="plow">Plow all ${coins(v.wild * F.PLOW_COST)}</button>` : ""}
          </div>
          ${stripHTML(v, sel)}
          <div class="nf-land${hasArt("scenes", "farmland") ? ` painted z-${zoom}` : ""}">${hasArt("scenes", "farmland") ? `<div class="nf-landpic" style="background-image:url('${art("farmland")}')">` : ""}<div class="nf-fieldbox">
            <div class="nf-grid${pl ? " placing" : ""}" id="nf-grid" style="grid-template-columns:repeat(${v.grid.w}, var(--tile));grid-template-rows:repeat(${v.grid.h}, var(--tile))">
              ${v.tiles.filter((t) => !t.part).map(tileHTML).join("")}${lots}<div class="nf-ghost" id="nf-ghost" hidden></div>
            </div>
          </div>${hasArt("scenes", "farmland") ? "</div>" : ""}
            <aside class="nf-float" id="nf-float" hidden></aside>
            <div class="nf-hover" id="nf-hover" hidden></div>
          </div>
          <div class="nf-hotbar" id="nf-hotbar">
            ${crops.map((c) => { const i = crops.filter((q) => q.open).indexOf(c); return `<button class="nf-seed${c.id === seed && tool === "hand" ? " on" : ""}${c.open ? "" : " locked"}" data-seed="${c.id}" ${c.open ? "" : "disabled"}
                title="${esc(c.name)}${c.open ? ` -- ${c.cost} coins, ${mins(c.time)}, ${c.yield} × worth ${c.worth}` : ` -- level ${c.level}`}">
              ${i >= 0 && i < 9 ? `<kbd>${i + 1}</kbd>` : ""}${img(cropArt(c.id, 4) || icon(c.item, 32), cropArt(c.id, 4) ? "painted" : "")}<b>${esc(c.name.replace(/ tree$/, ""))}</b>
              <small>${c.open ? `${mins(c.time)}${c.size > 1 ? " · 2×2" : ""}` : `Lv ${c.level}`}</small></button>`; }).join("")}
          </div>
        </section>
      </div>`;
  }
  /** Above the field (2026-10-09, Cam: "i want the game area to be larger"): the day at a glance, as chips that go
   *  where it's happening -- this was a side panel taking a fifth of the width. */
  function stripHTML(v, sel) {
    const done = v.makers.reduce((n, m) => n + m.done, 0), fill = v.orders.filter((o) => o.can).length, going = v.cooking.filter((c) => !c.done).length;
    const chips = [
      [icon("wheat", 16), v.ready ? `${v.ready} ready to harvest` : v.tiles.some((q) => q.stage === "growing") ? "Growing" : "Nothing planted", v.ready ? "go" : "", ""],
      [animalPic("chicken", 16), v.houses.length ? `${v.animalsReady} ready · ${v.animalsHungry} hungry` : v.level >= 6 ? "Build a coop" : "Animals from level 6", v.animalsReady ? "go" : v.animalsHungry ? "warn" : "", "animals"],
      [icon("kitchen", 16), done ? `${done} finished` : going ? `${going} on the go` : "Workshops idle", done ? "go" : "", "make"],
      [icon("woodcrate", 16), fill ? `${fill} order${fill === 1 ? "" : "s"} to fill` : "No orders to fill", fill ? "go" : "", "market"],
    ];
    if (v.spoiled) chips.splice(1, 0, [icon("wheat", 16), `${v.spoiled} spoiled`, "bad", "", "A crop spoils if it isn't picked within its own growing time -- clear it, or use a Freshness tonic."]);
    return `<div class="nf-strip">${chips.map(([p, t, c, go, tip]) => go ? `<button class="nf-stat ${c}" data-page="${go}">${img(p)}${esc(t)}</button>` : `<span class="nf-stat ${c}"${tip ? ` title="${esc(tip)}"` : ""}>${img(p)}${esc(t)}</span>`).join("")}
      <span class="nf-flex"></span>
      ${sel && tool === "hand" ? `<span class="nf-hand" title="In your hand -- number keys pick seeds, Esc puts it down">${img(cropArt(sel.id, 4) || icon(sel.item, 16), cropArt(sel.id, 4) ? "painted" : "")}<b>${esc(sel.name)}</b>
        <small>${coins(sel.cost)} · ${mins(sel.time)}${sel.size > 1 ? " · 2×2" : ""} · ${sel.yield} × ${num(sel.worth)}</small></span>`
        : tool === "instanttonic" ? `<span class="nf-hand warn">Instant tonic: click a growing crop or tree, or a building with animals at work</span>` : ""}</div>`;
  }
  /** The tile under the pointer, in a caption over the bottom of the field. */
  function hoverHTML(v) {
    const t = hover && v.tiles.find((q) => q.x === hover.x && q.y === hover.y);
    const at = t && t.part ? v.tiles.find((q) => q.x === t.part[0] && q.y === t.part[1]) : t;
    if (!at) return "";
    const w = tileWords(at);
    let pic = "", meter = "";
    if (at.house) pic = at.house.kind === "pasture" ? animalPic("sheep", 32) : buildingPic(at.house.kind, 32);
    else if (at.plant) {
      pic = at.plant.tree ? treePic(at.plant.id, at.stage === "ready", 32) : cropArt(at.plant.id, at.stage === "spoiled" ? 3 : growStage(at)) || icon(at.plant.item, 32);
      if (at.stage === "growing") meter = bar(at.progress, "go");
    }
    return `${pic ? img(pic, /^(data:)/.test(pic) ? "" : "painted") : ""}<span><b>${esc(w.title)}</b><small>${esc(w.sub)}</small>${meter}</span>`;
  }

  // the floating card over the field: placing help, or the building you picked ("" for none)
  function floatHTML(v) {
    const pl = placing();
    if (pl) {
      const h = v.houseShop.find((x) => x.id === pl);
      return `<div class="nf-ins-head">${img(h.id === "pasture" ? animalPic("sheep", 64) : buildingPic(pl, 64))}<div><h3>${esc(h.name)}</h3><small>${h.size}×${h.size} · holds ${h.cap} ${esc(h.animals.map(plural).join(" or "))}</small></div></div>
        <p class="nf-sub">Click a clear ${h.size}×${h.size} spot on your land -- its top-left corner. Crops and trees are in the way; wild grass is fine.</p>
        <div class="nf-label">It takes</div><div class="nf-chips">${costChips(v, h.cost)}</div>
        <button class="nf-btn quiet" data-tool="hand">Cancel</button>`;
    }
    const ph = pick && v.houses.find((h) => h.x === pick.x && h.y === pick.y);
    return ph ? housePanel(v, ph, true) : "";
  }

  /** A building's panel: its animals, feeding, collecting, buying. On the farm (inspector) or the Animals page. */
  function housePanel(v, h, inInspector) {
    const shop = v.animalShop.filter((a) => h.can.includes(a.id));
    const feed = Object.keys(h.feedNeed);
    return `<div class="nf-housecard${inInspector ? " in" : ""}" data-hx="${h.x}" data-hy="${h.y}">
      <div class="nf-ins-head">${img(h.kind === "pasture" ? animalPic(h.animals[0] ? h.animals[0].kind : "sheep", 48) : buildingPic(h.kind, 64))}
        <div><h3>${esc(h.name)}</h3><small>${h.animals.length}/${h.cap} animals</small></div>
        ${inInspector ? `<button class="nf-x" data-unpick title="Close (Esc)">×</button>` : `<button class="nf-btn small quiet" data-show>Show on farm</button>`}</div>
      <div class="nf-animals">
        ${h.animals.map((a) => `<div class="nf-animal ${a.stage}${a.stuck ? " stuck" : ""}" title="${esc(a.name)}">
            ${img(animalPic(a.kind, 48))}
            <small>${a.stage === "hungry" ? "Hungry" : a.stage === "working" ? clock(a.left) : a.stuck ? "Shear me" : `${img(icon(a.makes, 16))}Ready`}</small>
            ${a.stage === "working" ? bar(a.progress, "go") : ""}
            <button class="nf-sell" data-sellanimal="${a.i}" title="Sell this ${esc(a.name.toLowerCase())} (half what it cost)">×</button></div>`).join("")}
        ${Array.from({length: h.cap - h.animals.length}, () => `<div class="nf-animal empty"><small>Room</small></div>`).join("")}
      </div>
      <div class="nf-row">
        <button class="nf-btn go" data-hact="gather" ${h.ready ? "" : "disabled"}>Collect${h.ready ? ` (${h.ready})` : ""}</button>
        <button class="nf-btn" data-hact="feed" ${h.canFeed ? "" : "disabled"}>Feed${feed.length ? ` ${feed.map((k) => chip(k, h.feedNeed[k], haveOf(v, k))).join("")}` : ""}</button>
      </div>
      ${h.animals.length < h.cap ? `<div class="nf-label">Buy</div><div class="nf-row">${shop.map((a) => `<button class="nf-btn small" data-buyanimal="${a.id}" ${a.open && v.coins >= a.cost ? "" : "disabled"}
          title="${a.open ? `Eats ${esc(Object.keys(a.eats).map((k) => a.eats[k] + " " + F.nameOf(k).toLowerCase()).join(", "))}; makes ${a.n} × ${esc(a.makesName.toLowerCase())} every ${mins(a.time)}` : "Level " + a.level}">
          ${img(animalPic(a.id, 16))}${esc(a.name)} ${a.open ? coins(a.cost) : `· Lv ${a.level}`}</button>`).join("")}</div>` : ""}
      ${h.animals.some((a) => a.stuck) ? `<p class="nf-note warn">Your sheep are ready to shear -- build a shearer's shed (Animals page).</p>` : ""}
      ${!h.animals.length ? `<button class="nf-btn small quiet danger" data-hact="demolish">Take it down</button>` : ""}
    </div>`;
  }
  function houseWire(host) {
    host.querySelectorAll(".nf-housecard").forEach((card) => {
      const x = +card.dataset.hx, y = +card.dataset.hy;
      card.querySelectorAll("[data-hact]").forEach((b) => b.addEventListener("click", () => {
        if (b.dataset.hact === "demolish" && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Sure? Click again"; return; }
        act(b.dataset.hact, {x, y});
      }));
      card.querySelectorAll("[data-buyanimal]").forEach((b) => b.addEventListener("click", () => act("buyanimal", {x, y, animal: b.dataset.buyanimal})));
      card.querySelectorAll("[data-sellanimal]").forEach((b) => b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (b.dataset.sure) return act("sellanimal", {x, y, i: +b.dataset.sellanimal});
        b.dataset.sure = 1; b.textContent = "Sell?"; b.classList.add("sure");
      }));
      card.querySelectorAll("[data-unpick]").forEach((b) => b.addEventListener("click", () => { pick = null; render(); }));
      card.querySelectorAll("[data-show]").forEach((b) => b.addEventListener("click", () => { pick = {x, y}; page = "farm"; render(); }));
    });
  }

  function canPlaceAt(v, kind, x, y) {
    const n = F.HOUSES[kind].size;
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
      const t = v.tiles.find((q) => q.x === x + dx && q.y === y + dy);
      if (!t || !t.owned || t.plant || t.house || t.part) return false;
    }
    return true;
  }
  function farmWire(host, v) {
    const crops = v.crops.concat(v.trees), sel = () => crops.find((c) => c.id === seed);
    const setTool = (b) => b.addEventListener("click", () => { tool = b.dataset.tool; render(); });
    host.querySelectorAll("[data-seed]").forEach((b) => b.addEventListener("click", () => { seed = b.dataset.seed; tool = "hand"; render(); }));
    host.querySelectorAll(".nf-toolbar [data-tool]").forEach(setTool);
    host.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => { const [px, py] = b.dataset.buy.split(",").map(Number); act("buyland", {px, py}); }));
    host.querySelectorAll("[data-all]").forEach((b) => b.addEventListener("click", () => act(b.dataset.all, {all: true})));
    const ghost = host.querySelector("#nf-ghost"), flo = host.querySelector("#nf-float"), cap = host.querySelector("#nf-hover");
    host.querySelectorAll("[data-zoom]").forEach((b) => b.addEventListener("click", () => { zoom = b.dataset.zoom; render(); }));
    host.querySelectorAll(".nf-strip [data-page]").forEach((b) => b.addEventListener("click", () => { page = b.dataset.page; tool = "hand"; render(); }));
    // a building you picked, or one you're placing: a card over the corner of the field (closes with ✕ or Esc)
    const card = floatHTML(v);
    flo.hidden = !card;
    if (card) {
      flo.innerHTML = (placing() ? `<button class="nf-x nf-float-x" aria-label="Cancel">✕</button>` : "") + card;
      flo.classList.toggle("left", !!pick && pick.x >= v.grid.w / 2);
      houseWire(flo); flo.querySelectorAll("[data-tool]").forEach(setTool);
      const x = flo.querySelector(".nf-float-x"); if (x) x.addEventListener("click", () => { tool = "hand"; render(); });
    }
    const showInspect = () => { const h = pick || placing() ? "" : hoverHTML(v); cap.hidden = !h; cap.innerHTML = h; };
    showInspect();
    host.querySelectorAll(".nf-tile").forEach((b) => {
      const x = +b.dataset.x, y = +b.dataset.y;
      b.addEventListener("mouseenter", () => {
        hover = {x, y};
        const pl = placing();
        if (pl) {
          const n = F.HOUSES[pl].size;
          ghost.hidden = false; ghost.style.gridColumn = `${x + 1} / span ${n}`; ghost.style.gridRow = `${y + 1} / span ${n}`;
          ghost.className = "nf-ghost " + (canPlaceAt(v, pl, x, y) ? "ok" : "bad");
        } else if (!pick) showInspect();
      });
      b.addEventListener("click", () => {
        const t = v.tiles.find((q) => q.x === x && q.y === y);
        if (!t || !t.owned) return;
        const pl = placing();
        if (pl) return act("place", {house: pl, x, y}).then((r) => { if (r && r.ok) { tool = "hand"; pick = {x, y}; render(); } });
        if (t.house) {
          pick = {x, y};
          if (tool === "instanttonic") return act("potion", {potion: tool, x, y});
          if (tool === "hand" && t.house.ready) return act("gather", {x, y});
          if (tool === "hand" && t.house.canFeed) return act("feed", {x, y});
          return render();
        }
        if (tool === "clear") return act("clear", {x, y});
        if (F.POTIONS[tool]) return act("potion", {potion: tool, x, y});
        if (!t.plowed) return act("plow", {x, y}, true);
        if (t.stage === "ready") return act("harvest", {x, y}, true);
        if (t.stage === "spoiled") return toast("This has spoiled -- clear it, or use a Freshness tonic.", true);
        if (t.stage === "growing") return toast(`Growing -- ready in ${clock(t.left)}.`);
        const c = v.crops.find((q) => q.id === seed), tr = v.trees.find((q) => q.id === seed);
        return act("plant", c ? {x, y, crop: seed} : {x, y, tree: tr && tr.id}, true);
      });
    });
    host.querySelector("#nf-grid").addEventListener("mouseleave", () => { hover = null; ghost.hidden = true; if (!pick && !placing()) showInspect(); });
  }

  // ---- animals ----------------------------------------------------------------------------------
  function animalsHTML(v) {
    const shed = v.shearshed;
    return `
      <div class="nf-pagehead"><div><h1>Animals</h1><p class="nf-sub">Their buildings stand on your land. Feed them from your silos, and in their own time they make something to collect. Nothing here spoils.</p></div>
        <div class="nf-row">${v.animalsHungry ? `<button class="nf-btn" data-all="feed">Feed all (${v.animalsHungry})</button>` : ""}
          <button class="nf-btn go" data-all="gather" ${v.animalsReady ? "" : "disabled"}>Collect all${v.animalsReady ? ` (${v.animalsReady})` : ""}</button></div></div>
      ${v.houses.length ? `<div class="nf-cards wide">${v.houses.map((h) => `<section class="nf-panel">${housePanel(v, h, false)}</section>`).join("")}</div>`
        : `<section class="nf-panel nf-empty">${img(buildingPic("coop", 96))}<div><h2>No animals yet</h2><p class="nf-sub">${v.level >= 6 ? "Build a chicken coop below, then buy hens for it." : "Husbandry starts at level 6, with a chicken coop. Keep farming!"}</p></div></section>`}
      <h2 class="nf-h2">Build</h2>
      <div class="nf-cards">
        ${v.houseShop.map((h) => `<section class="nf-panel nf-shop${h.open ? "" : " locked"}">
            <div class="nf-shoppic">${img(h.id === "pasture" ? animalPic("sheep", 64) : buildingPic(h.id, 96))}</div>
            <h3>${esc(h.name)}${h.owned ? ` <small>· you have ${h.owned}</small>` : ""}</h3>
            <p class="nf-sub">${h.size}×${h.size} on your land · up to ${h.cap} ${esc(h.animals.map(plural).join(" or "))}</p>
            ${h.open ? `<div class="nf-chips">${costChips(v, h.cost)}</div>
              <button class="nf-btn${h.can ? " go" : ""}" data-place="${h.id}" ${h.can ? "" : "disabled"}>Place on the farm</button>` : `<span class="nf-lock">Level ${h.level}</span>`}
          </section>`).join("")}
        <section class="nf-panel nf-shop${v.level >= shed.level ? "" : " locked"}">
          <div class="nf-shoppic">${img(buildingPic("shearshed", 96))}</div>
          <h3>Shearer's shed${shed.built ? " <small>· built</small>" : ""}</h3>
          <p class="nf-sub">Sheep grow wool, but it can't come off without one.</p>
          ${shed.built ? `<span class="nf-ok">Ready for shearing</span>` : v.level >= shed.level ? `<div class="nf-chips">${costChips(v, shed)}</div>
            <button class="nf-btn${shed.can ? " go" : ""}" data-build="shearshed" ${shed.can ? "" : "disabled"}>Build</button>` : `<span class="nf-lock">Level ${shed.level}</span>`}
        </section>
      </div>
      <h2 class="nf-h2">The animals</h2>
      <div class="nf-cards">
        ${v.animalShop.map((a) => `<section class="nf-panel nf-beast${a.open ? "" : " locked"}">
            ${img(animalPic(a.id, 64))}
            <div><h3>${esc(a.name)}${a.owned ? ` <small>· you have ${a.owned}</small>` : ""}</h3>
              <p class="nf-sub">Lives in a ${esc(a.houseName.toLowerCase())} · ${a.open ? coins(a.cost) : `level ${a.level}`}</p>
              <div class="nf-flow">${Object.keys(a.eats).map((k) => chip(k, a.eats[k])).join("")}<span class="nf-arrow">${mins(a.time)} →</span>${chip(a.makes, a.n)}</div>
              ${a.shears ? `<small class="nf-sub">Needs a shearer's shed</small>` : ""}</div>
          </section>`).join("")}
      </div>`;
  }
  function animalsWire(host) {
    houseWire(host);
    host.querySelectorAll("[data-all]").forEach((b) => b.addEventListener("click", () => act(b.dataset.all, {all: true})));
    host.querySelectorAll("[data-place]").forEach((b) => b.addEventListener("click", () => { tool = "place:" + b.dataset.place; pick = null; page = "farm"; render(); }));
    host.querySelectorAll("[data-build]").forEach((b) => b.addEventListener("click", () => act("build", {what: b.dataset.build})));
  }

  // ---- workshops: the kitchen, the dairy, the sewing room, the mill ------------------------------
  // Like NeuroPets' Workshop (2026-10-09, Cam: "the workshops page to be similar to the one in neuropets
  // ... so everything has a click interface ... a homely chill vibe"): a yard of workshops; click one and
  // its sheet opens -- click a recipe to make it, a finished thing to collect it, the sign to build or upgrade.
  // (`maker` is the open sheet's workshop, "" when none.)
  /** One line on what a workshop is up to, for its door in the yard. */
  function makerStatus(v, m) {
    if (!m.tier) return v.level >= m.opensAt ? {text: m.next && m.next.can ? "Ready to build" : "Not built yet", cls: m.next && m.next.can ? "go" : ""}
      : {text: `Opens at level ${m.opensAt}`, cls: "lock"};
    if (m.done) return {text: `${m.done} ready to collect`, cls: "go"};
    const busy = v.cooking.filter((c) => c.maker === m.id && !c.done).sort((a, b) => a.left - b.left)[0];
    const more = m.queue.length ? ` · ${m.queue.length} queued` : "";
    if (busy) return {text: `${m.doing} ${busy.name.toLowerCase()} · ${clock(busy.left)}${more}`, cls: "busy", progress: busy.progress};
    return {text: `Idle · ${m.free} free`, cls: "idle"};
  }
  function makeHTML(v) {
    const open = v.makers.find((x) => x.id === maker);
    return `
      <div class="nf-pagehead"><div><h1>Workshops</h1><p class="nf-sub">Turn what you grow into something special. Click a workshop to step inside.</p></div></div>
      ${hasArt("scenes", "workshops") ? yardScene(v) : `<div class="nf-yard">${v.makers.map((m) => { const st = makerStatus(v, m);
        return `<button class="nf-ws${m.tier ? "" : " unbuilt"}${st.cls === "lock" ? " locked" : ""}" data-maker="${m.id}" aria-label="${esc(m.name)}: ${esc(st.text)}">
          <span class="nf-ws-pic">${img(icon(m.id, 96))}${m.done ? `<span class="nf-badge go">${m.done}</span>` : ""}</span>
          <span class="nf-sign">${esc(m.name)}</span>
          <span class="nf-ws-line ${st.cls}">${esc(st.text)}</span>
          ${st.progress != null ? bar(st.progress, "go") : m.tier ? `<small class="nf-ws-tier">Level ${m.tier} of ${m.max}</small>` : ""}
        </button>`; }).join("")}</div>`}
      ${open ? sheetHTML(v, open) : ""}`;
  }
  // The painted yard (Cam's workshops.jpeg): each building and its sign(s) are click areas, a chip under the sign
  // says what it's up to. Shapes are in the picture's own units (1400 x 781 viewBox).
  const YARD = {
    kitchen: {shape: "0,330 110,135 165,135 175,190 290,240 410,360 395,600 150,610 20,590", signs: [[153, 655, 160, 52]], chip: [233, 716]},
    dairy: {shape: "330,215 395,125 470,120 650,215 650,410 410,425 330,390", signs: [[495, 222, 122, 72], [490, 455, 135, 52]], chip: [557, 518]},
    loom: {shape: "800,250 905,80 1080,60 1175,215 1170,460 1010,465 830,440", signs: [[835, 215, 182, 85]], chip: [925, 306]},
    mill: {shape: "1040,330 1240,255 1390,420 1390,640 1060,610", signs: [[1070, 425, 100, 60], [1148, 672, 145, 52]], chip: [1220, 734]},
  };
  function yardScene(v) {
    const spots = [], chips = [];
    v.makers.forEach((m) => {
      const y = YARD[m.id];
      if (!y) return;
      const st = makerStatus(v, m), tip = `${m.name}: ${st.text}`;
      spots.push(`<g class="nf-spot${m.done ? " ready" : ""}${st.cls === "lock" ? " locked" : ""}" data-maker="${m.id}" tabindex="0" role="button" aria-label="${esc(tip)}">
          <title>${esc(tip)}</title><polygon class="nf-spot-shape" points="${y.shape}"/>
          ${y.signs.map(([x, yy, w, h]) => `<rect class="nf-spot-sign" x="${x - 4}" y="${yy - 4}" width="${w + 8}" height="${h + 8}" rx="10"/>`).join("")}</g>`);
      const text = (st.cls === "go" && m.done ? "✓ " : st.cls === "lock" ? "🔒 " : "") + st.text, cw = 22 + 8.6 * [...text].length, [cx, cy] = y.chip;
      chips.push(`<g class="nf-chipg ${st.cls}"><rect x="${cx - cw / 2}" y="${cy}" width="${cw}" height="30" rx="15"/><text x="${cx}" y="${cy + 20.5}">${esc(text)}</text>
          ${st.progress != null ? `<rect class="nf-chipbar" x="${cx - cw / 2 + 12}" y="${cy + 25}" width="${(cw - 24) * st.progress}" height="3" rx="1.5"/>` : ""}</g>`);
    });
    return `<div class="nf-scene"><img alt="The workshops: the Kitchen, the Dairy, the Sewing room and the Mill" src="${art("workshops")}">
      <svg viewBox="0 0 1400 781" aria-label="The workshops">${spots.join("")}<g class="nf-chips-layer">${chips.join("")}</g></svg></div>`;
  }
  /** Inside a workshop: what's being made, every recipe (click to make), and building it up. */
  function sheetHTML(v, m) {
    const mine = v.cooking.filter((c) => c.maker === m.id), recipes = v.recipes.filter((r) => r.at === m.id);
    const nk = m.next, instant = (v.potions.find((p) => p.id === "instanttonic") || {}).n || 0;
    const why = (r) => {
      if (!r.open) return [m.tier < r.tier ? `Needs a level ${r.tier} ${m.name.toLowerCase()}` : "", v.level < r.level ? `Farm level ${r.level}` : ""].filter(Boolean).join(" · ");
      const short = r.needs.filter((n) => n.have < n.need).map((n) => `${n.need - n.have} more ${n.name.toLowerCase()}`);
      return short.length ? "Needs " + short.join(", ") : m.free > 0 || m.queue.length < m.queueMax ? "" : "The queue's full";
    };
    const goWord = m.free > 0 ? m.verb : "Queue";
    const upgrade = nk ? `<section class="nf-upgrade${nk.can ? " can" : ""}">
        <div><b>${m.tier ? `Upgrade to level ${nk.n}` : `Build the ${esc(m.name.toLowerCase())}`}</b>
          <small class="nf-sub">${m.tier ? `${nk.n} at a time, and more recipes.` : "Then pick something to make."}${v.level < nk.level ? ` Needs farm level ${nk.level}.` : ""}</small></div>
        <div class="nf-chips">${costChips(v, nk)}</div>
        <button class="nf-btn${nk.can ? " go" : ""}" data-build="${m.id}" ${nk.can ? "" : "disabled"}>${m.tier ? "Upgrade" : "Build"}</button></section>`
      : `<p class="nf-sub nf-maxed">As big as it gets.</p>`;
    const fresh = sheetFresh; sheetFresh = false;                // it eases in once, not on every redraw
    return `<div class="nf-sheet${fresh ? " fresh" : ""}" id="nf-sheet" role="dialog" aria-modal="true" aria-label="${esc(m.name)}">
      <div class="nf-sheet-card" id="nf-sheet-card">
        <header class="nf-sheet-head">${img(icon(m.id, 64))}
          <div><h2>${esc(m.name)}${m.tier ? ` <small>· level ${m.tier}</small>` : ""}</h2>
            <small>${m.tier ? `Makes ${m.slots} at a time${m.stoves && m.stoves.have ? ` (${m.stoves.have} extra stove${m.stoves.have === 1 ? "" : "s"})` : ""} · ${m.free} free${instant ? ` · ${instant} Instant tonic${instant === 1 ? "" : "s"}` : ""}` : "Not built yet"}</small></div>
          <button class="nf-x" data-close aria-label="Close">✕</button></header>
        ${m.tier ? `<div class="nf-label">On the go</div>
          <div class="nf-slots">${mine.map((c) => c.done
              ? `<button class="nf-slot done" data-collect="${m.id}" title="Collect">${img(icon(c.recipe, 48))}<span><b>${esc(c.name)}</b><small>Ready — click to collect</small></span></button>`
              : `<button class="nf-slot" ${instant ? `data-instant="${m.id}" title="Finish it now with an Instant tonic"` : "disabled"}>${img(icon(c.recipe, 48))}<span><b>${esc(c.name)}</b>
                  <small>${clock(c.left)}${instant ? " · click to finish now" : ""}</small>${bar(c.progress, "go")}</span></button>`).join("")}
            ${Array.from({length: Math.max(0, m.free)}, () => `<div class="nf-slot empty"><small>Free — pick something below</small></div>`).join("")}</div>
          <div class="nf-label">Queue <span class="nf-qcount">${m.queue.length}/${m.queueMax}</span></div>
          ${m.queue.length ? `<div class="nf-queue">${m.queue.map((q, i) => `<button class="nf-qitem" data-unqueue="${q.i}" title="Take ${esc(q.name.toLowerCase())} out of the queue (what it took comes back)">
              <b>${i + 1}</b>${img(icon(q.recipe, 32))}<span>${esc(q.name)}</span><i aria-hidden="true">✕</i></button>`).join("")}</div>`
            : `<p class="nf-sub nf-qempty">${m.free > 0 ? "When everything's busy, click a recipe to queue it — it starts by itself when there's room." : "Click a recipe to queue it — it starts by itself when there's room."}</p>`}
          ${m.stoves ? stovesHTML(v, m) : ""}` : upgrade}
        <div class="nf-label">${m.tier ? `${esc(m.verb)} something` : "What it makes"}</div>
        <div class="nf-recipes">${recipes.map((r) => { const w = why(r), go = r.open && !w;
          return `<button class="nf-recipe${go ? " can" : ""}${r.open ? "" : " locked"}" data-cook="${r.id}" ${go ? "" : "aria-disabled=\"true\""} title="${go ? `${goWord} ${esc(r.name.toLowerCase())}` : esc(w)}">
              <span class="nf-recipe-top">${img(icon(r.id, 48))}<span><b>${esc(r.name)}</b><small>${mins(r.time)} · ${r.xp} xp</small></span>
                <span class="nf-price">${coins(r.price)}<small>raw ${num(r.raw)}</small></span></span>
              <span class="nf-chips">${r.needs.map((n) => chip(n.id, n.need, n.have)).join("")}</span>
              <span class="nf-recipe-go${go ? (m.free > 0 ? "" : " queue") : " no"}">${go ? esc(goWord) : esc(w)}</span>
            </button>`; }).join("")}</div>
        ${m.tier ? upgrade : ""}
      </div></div>`;
  }
  /** The kitchen's stoves: one more thing cooking at once for each. */
  function stovesHTML(v, m) {
    const st = m.stoves, nx = st.next;
    return `<section class="nf-stoves">
        <div class="nf-stoverow">${Array.from({length: 1 + st.max}, (_, i) => `<span class="nf-stove${i <= st.have ? " on" : ""}" title="${i === 0 ? "The kitchen's own stove" : i <= st.have ? "An extra stove" : "Room for another stove"}">${img(icon("kitchen", 32))}</span>`).join("")}</div>
        <div><b>Stoves</b><small class="nf-sub">${nx ? `Add stove ${nx.n + 1}: cook ${m.slots + 1} things at once.${v.level < nx.level ? ` Needs farm level ${nx.level}.` : ""}` : "Every stove the kitchen can fit."}</small></div>
        ${nx ? `<div class="nf-chips">${costChips(v, nx)}</div>
          <button class="nf-btn${nx.can ? " go" : ""}" data-build="stove" ${nx.can ? "" : "disabled"}>Add a stove</button>` : ""}
      </section>`;
  }
  function makeWire(host) {
    const openIt = (k) => { maker = k; sheetFresh = true; render(); };
    host.querySelectorAll(".nf-ws[data-maker], .nf-spot[data-maker]").forEach((b) => {
      b.addEventListener("click", () => openIt(b.dataset.maker));
      b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openIt(b.dataset.maker); } });
    });
    const sheet = host.querySelector("#nf-sheet");
    if (!sheet) return;
    const close = () => { maker = ""; render(); };
    sheet.addEventListener("click", (e) => { if (e.target === sheet) close(); });
    sheet.querySelector("[data-close]").addEventListener("click", close);
    sheet.querySelectorAll("[data-build]").forEach((b) => b.addEventListener("click", () => act("build", {what: b.dataset.build})));
    sheet.querySelectorAll("[data-unqueue]").forEach((b) => b.addEventListener("click", () => act("unqueue", {maker, i: +b.dataset.unqueue})));
    sheet.querySelectorAll("[data-collect]").forEach((b) => b.addEventListener("click", () => act("collect", {maker: b.dataset.collect})));
    sheet.querySelectorAll("[data-instant]").forEach((b) => b.addEventListener("click", () => act("potion", {potion: "instanttonic", maker: b.dataset.instant})));
    // a recipe you can't make yet says why (and makes nothing)
    sheet.querySelectorAll("[data-cook]").forEach((b) => b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled")) return toast(b.title, true);
      act("cook", {recipe: b.dataset.cook});
    }));
  }

  // ---- the market --------------------------------------------------------------------------------
  function marketHTML(v) {
    return `
      <div class="nf-pagehead"><div><h1>Market</h1><p class="nf-sub">Special orders pay more than selling -- and some come with a tonic. A filled order is replaced in ${F.ORDER_WAIT / F.MIN} minutes.</p></div></div>
      <div class="nf-orders">${v.orders.map((o) => o.wants ? `<section class="nf-ticket${o.can ? " can" : ""}">
            <div class="nf-label">Wanted</div>
            <div class="nf-wants">${o.wants.map((w) => `<div class="nf-want${w.have >= w.need ? " got" : ""}">${img(icon(w.id, 32))}<span><b>${esc(w.name)}</b><small>${num(w.have)} / ${num(w.need)}</small></span></div>`).join("")}</div>
            <div class="nf-reward">${coins(o.coins)}<span>${o.xp} xp</span>${o.potion ? `<span class="nf-tonic">${img(icon(o.potionId, 16))}${esc(o.potion)}</span>` : ""}</div>
            <div class="nf-row"><button class="nf-btn${o.can ? " go" : ""}" data-order="${o.slot}" ${o.can ? "" : "disabled"}>Fill it</button><button class="nf-btn quiet" data-skip="${o.slot}">Take it down</button></div>
          </section>` : `<section class="nf-ticket empty"><small>A new order goes up in</small><b>${clock(o.wait)}</b></section>`).join("")}</div>
      <div class="nf-split">
        <section class="nf-panel">
          <div class="nf-panelhead"><h2>Sell</h2><input class="nf-input" id="nf-find" placeholder="Find…" aria-label="Find in your silos"></div>
          ${v.silo.length ? `<div class="nf-selllist">${v.silo.map((it) => `<div class="nf-sellrow" data-name="${esc(it.name.toLowerCase())}">${img(icon(it.id, 32))}
              <span><b>${esc(it.name)}</b><small>× ${num(it.n)} · ${coins(it.price)} each</small></span>
              <span class="nf-row"><button class="nf-btn small" data-sell="${it.id}" data-n="1">Sell 1</button>${it.n > 1 ? `<button class="nf-btn small" data-sell="${it.id}" data-n="all">All ${coins(it.price * it.n)}</button>` : ""}</span></div>`).join("")}</div>`
            : `<p class="nf-sub">Your silos are empty -- harvest something.</p>`}
        </section>
        <section class="nf-panel">
          <h2>Supplies</h2>
          <p class="nf-sub">Wood builds coops, barns, pastures and workshops. Your trees give a little each harvest (and more when chopped) -- or buy it here.</p>
          ${v.supplies.map((s) => `<div class="nf-sellrow">${img(icon(s.id, 32))}<span><b>${esc(s.name)}</b><small>You have ${num(s.have)} · ${coins(s.price)} each</small></span>
            <span class="nf-row"><button class="nf-btn small" data-supply="${s.id}" data-n="1">Buy 1</button><button class="nf-btn small" data-supply="${s.id}" data-n="10">10 ${coins(s.price * 10)}</button></span></div>`).join("")}
        </section>
      </div>`;
  }
  function marketWire(host) {
    host.querySelectorAll("[data-order]").forEach((b) => b.addEventListener("click", () => act("order", {slot: +b.dataset.order})));
    host.querySelectorAll("[data-skip]").forEach((b) => b.addEventListener("click", () => act("skiporder", {slot: +b.dataset.skip})));
    host.querySelectorAll("[data-sell]").forEach((b) => b.addEventListener("click", () => act("sell", {item: b.dataset.sell, n: b.dataset.n === "all" ? "all" : 1})));
    host.querySelectorAll("[data-supply]").forEach((b) => b.addEventListener("click", () => act("buy", {item: b.dataset.supply, n: +b.dataset.n})));
    const find = host.querySelector("#nf-find");
    if (find) {
      find.value = findText;
      const apply = () => { findText = find.value; const q = findText.trim().toLowerCase(); host.querySelectorAll(".nf-selllist .nf-sellrow").forEach((r) => { r.hidden = !!q && !r.dataset.name.includes(q); }); };
      find.addEventListener("input", apply); apply();
    }
  }

  // ---- silos, the farmer ---------------------------------------------------------------------------
  function siloHTML(v) {
    const ns = v.nextSilo, full = v.siloUsed >= v.siloCap;
    return `
      <div class="nf-pagehead"><div><h1>Silos</h1><p class="nf-sub">Everything you keep goes in your silos. When they're full you can't harvest or collect -- and a crop left too long spoils.</p></div></div>
      <div class="nf-split">
        <section class="nf-panel">
          <div class="nf-bigmeter${full ? " full" : ""}"><b>${num(v.siloUsed)}</b><span>of ${num(v.siloCap)} · ${v.silos} silo${v.silos === 1 ? "" : "s"}</span></div>
          ${bar(v.siloUsed / v.siloCap, full ? "bad big" : "go big")}
          ${v.silo.length ? `<div class="nf-stock">${v.silo.map((it) => `<div class="nf-stockitem" title="${esc(it.name)} -- ${it.price} coins each">${img(icon(it.id, 32))}<b>${num(it.n)}</b><small>${esc(it.name)}</small></div>`).join("")}</div>`
            : `<p class="nf-sub">Nothing yet.</p>`}
        </section>
        <section class="nf-panel nf-stack">
          <div class="nf-ins-head">${img(icon("silo", 64))}<div><h2>Build silo ${v.silos + 1}</h2><small>+${F.SILO_SIZE} room</small></div></div>
          <div class="nf-chips">${costChips(v, ns)}</div>
          <button class="nf-btn go" id="nf-build-silo">Build</button>
          <div class="nf-label">Tonics</div>
          ${v.potions.map((p) => `<div class="nf-sellrow">${img(icon(p.id, 32))}<span><b>${esc(p.name)} × ${p.n}</b><small>${esc(p.about)}</small></span></div>`).join("")}
          <p class="nf-sub">Tonics come from the request board.</p>
        </section>
      </div>`;
  }
  function farmerHTML(v) {
    const next = [];
    for (let l = v.level + 1; l <= Math.min(F.MAX_LEVEL, v.level + 8); l++) { const u = F.unlocksAt(l); if (u.length) next.push([l, u]); }
    const animals = v.houses.reduce((n, h) => n + h.animals.length, 0);
    return `
      <div class="nf-split">
        <section class="nf-panel nf-profile">
          <div class="nf-profilehead">
            <div class="nf-bigring" style="--p:${v.progress.toFixed(3)}"><b>${v.level}</b><small>level</small></div>
            <div><h1>${esc(v.farmer)}</h1><p class="nf-sub">${esc(v.farmName)} · ${v.toNext ? `${num(v.toNext)} xp to level ${v.level + 1}` : "The top level"}</p></div>
          </div>
          <div class="nf-statgrid">
            <span><b>${v.parcels.filter((p) => p.owned).length}</b><small>parcels of land</small></span>
            <span><b>${v.houses.length}</b><small>buildings</small></span>
            <span><b>${animals}</b><small>animals</small></span>
            <span><b>${v.makers.filter((m) => m.tier).length}</b><small>workshops</small></span>
          </div>
          <div class="nf-label">Coming up</div>
          <ol class="nf-timeline">${next.map(([l, u]) => `<li><b>${l}</b><span>${esc(u.join(" · "))}</span></li>`).join("") || `<li><span>You've unlocked everything in this part of the game.</span></li>`}</ol>
          <p class="nf-sub">Coming to NeuroFarm next: mass orders, and the machines -- trucks, tractors and harvesters.</p>
        </section>
        <section class="nf-panel">
          <h2>Diary</h2>
          <div class="nf-diary">${v.log.map((e) => `<p><small>${esc(new Date(e.t).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}))}</small>${esc(e.text)}</p>`).join("")}</div>
        </section>
      </div>`;
  }

  // ---- the start ---------------------------------------------------------------------------------
  function startHTML() {
    const card = startCard();
    return hasArt("scenes", "title") ? `<div class="nf-titlescreen" style="background-image:url('${art("title")}')">${card}</div>` : card;
  }
  function startCard() {
    return `<section class="nf-panel nf-start">
        <div class="nf-startpics">${["wheat", "strawberry", "pumpkin"].every((c) => hasArt("crops", c))
          ? ["wheat", "strawberry", "pumpkin"].map((c) => img(cropArt(c, 4), "painted")).join("")
          : img(icon("wheat", 64)) + img(animalPic("chicken", 64)) + img(treePic("apple", true, 64))}</div>
        <h1>A farm of your own</h1>
        <p class="nf-sub">Plant, grow and harvest -- in real time. Crops spoil if you leave them as long again as they took to grow. Later: hens, cows, goats and sheep.</p>
        <input class="nf-input" id="nf-name" placeholder="Your name" maxlength="24">
        <input class="nf-input" id="nf-farmname" placeholder="Your farm's name (optional)" maxlength="32">
        <button class="nf-btn go big" id="nf-start">Start farming</button>
      </section>`;
  }

  // ---- drawing -----------------------------------------------------------------------------------
  function render(tick) {
    if (!state) return;
    // (a tick mustn't redraw under your typing)
    if (tick === true && document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const v = F.view(state, Date.now()), host = $("nf-main");
    last = v;
    frame(v);
    if (pick && !v.houses.some((h) => h.x === pick.x && h.y === pick.y)) pick = null;
    const keep = host.scrollTop, hb = host.querySelector("#nf-hotbar"), keepH = hb ? hb.scrollLeft : 0;
    const sc = host.querySelector("#nf-sheet-card"), keepS = sc ? sc.scrollTop : 0;
    document.body.dataset.page = v.made ? page : "start";
    if (!v.made) {
      host.innerHTML = startHTML();
      host.querySelector("#nf-start").addEventListener("click", () => act("start", {farmer: host.querySelector("#nf-name").value, farm: host.querySelector("#nf-farmname").value}));
      return;
    }
    if (page === "farm") { host.innerHTML = farmHTML(v); farmWire(host, v); }
    else if (page === "animals") { host.innerHTML = animalsHTML(v); animalsWire(host); }
    else if (page === "make") { host.innerHTML = makeHTML(v); makeWire(host); }
    else if (page === "market") { host.innerHTML = marketHTML(v); marketWire(host); }
    else if (page === "silo") { host.innerHTML = siloHTML(v); const b = host.querySelector("#nf-build-silo"); if (b) b.addEventListener("click", () => act("build", {what: "silo"})); }
    else { host.innerHTML = farmerHTML(v); }
    host.scrollTop = keep;
    const hb2 = host.querySelector("#nf-hotbar"); if (hb2) hb2.scrollLeft = keepH;
    const sc2 = host.querySelector("#nf-sheet-card"); if (sc2) sc2.scrollTop = keepS;
  }

  // keys: 1-9 pick a seed, Esc puts down what you hold (or closes a building's panel)
  document.addEventListener("keydown", (e) => {
    if (!last || !last.made || /INPUT|TEXTAREA/.test((e.target || {}).tagName || "")) return;
    if (e.key === "Escape") { if (page === "make" && maker) maker = ""; else if (tool !== "hand") tool = "hand"; else pick = null; render(); return; }
    if (page === "farm" && /^[1-9]$/.test(e.key)) {
      const open = last.crops.concat(last.trees).filter((c) => c.open)[+e.key - 1];
      if (open) { seed = open.id; tool = "hand"; render(); }
    }
  });

  async function start() {
    const logo = $("nf-logo"); if (logo) logo.src = icon("wheat", 32);
    await load();
    render();
    try { await Store.call("hello", []); } catch (e) { /* a test page */ }
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden && state && state.made && page !== "farmer") render(true); }, 2000);   // crops grow by the clock
  }
  window.NF = {render, act, state: () => state, go: (p) => { page = p; render(); }, _test: {icon, load}};
  start();
})();
