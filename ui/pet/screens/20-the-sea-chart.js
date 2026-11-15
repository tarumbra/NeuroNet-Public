  // ---- the sea chart (2026-10-09, Cam's picture) -------------------------------------------------------------------
  let seaChart = false;
  function wireSeaButton(host) {
    host.querySelectorAll("[data-sea]").forEach((b) => b.addEventListener("click", () => { seaChart = b.dataset.sea === "1"; closeSeaSheet(); status = ""; render(); }));
  }
  function renderSea(host, wv) {
    const {s, now} = current(), sy = Core.shipyardView(s, now), at = {};
    wv.regions.forEach((r) => { at[r.id] = r; });
    const where = wv.voyage ? "" : wv.here || "main";
    const chip = (text, cls, cx, cy) => { const w = 24 + 15 * [...text].length;
      return `<g class="pp-map-chip ${cls}"><rect x="${cx - w / 2}" y="${cy - 19}" width="${w}" height="38" rx="19"/><text x="${cx}" y="${cy + 9}">${esc(text)}</text></g>`; };
    const isle = (id) => sy.islands.find((i) => i.id === id);
    const reg = (id) => !isle(id) && at[id];            // the Open Sea and the Misty Isle are regions; an island (frostpeak too) is a voyage
    const locked = (id) => reg(id) ? !reg(id).open : isle(id) ? !isle(id).can : false;
    const badges = (id) => { const a = SEA_ART[id], [x1, x2, y] = a.label, mid = (x1 + x2) / 2, below = y + 50;
      if (reg(id)) return worldBadges(reg(id), a);
      const bound = wv.voyage && (wv.voyage.to || "main") === id;
      const txt = where === id ? "You're here" : bound ? `Landing in ${clock(wv.voyage.endsIn)}` : isle(id) && !isle(id).can ? `🔒 Needs a ${isle(id).ship.toLowerCase()}` : "";
      return (a.chip ? chip(a.chip, "", mid, y) : "") + (txt ? chip(txt, where === id || bound ? "busy" : "lock", mid, a.chip ? y + 46 : below) : ""); };
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${wv.voyage ? `<p class="pp-world-now">At sea, bound for <b>${esc(wv.voyage.toName)}</b> — land in <b data-ends="${now + wv.voyage.endsIn * 1000}">${clock(wv.voyage.endsIn)}</b></p>` : ""}
        <div class="pp-world">
          <svg class="pp-world-map" viewBox="0 0 ${WORLD_W} ${WORLD_H}" role="img" aria-label="The sea chart">
            <defs><filter id="pp-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter></defs>
            <image href="${modPics.regions.seachart || "art/seachart.webp"}" x="0" y="0" width="${WORLD_W}" height="${WORLD_H}" preserveAspectRatio="xMidYMid slice"/>
            ${lifeSVG("seachart")}
            ${Object.keys(SEA_ART).map((id) => { const name = reg(id) ? reg(id).name : id === "main" ? "The Main Island" : id === "shipyard" ? "The Shipyard" : isle(id).name;
              return `<g class="pp-region${locked(id) ? " locked" : ""}" data-sea-go="${id}" tabindex="0" role="button" aria-label="${esc(name)}${locked(id) ? " (locked)" : ""}">
                <title>${esc(name)}</title>
                <polygon class="pp-region-area" points="${SEA_ART[id].pts}" filter="url(#pp-soft)"/>
                <polygon class="pp-region-hit" points="${SEA_ART[id].pts}"/>
              </g>`; }).join("")}
            <g class="pp-map-badges">${Object.keys(SEA_ART).map(badges).join("")}</g>
          </svg>
        </div>
      </div>`;
    const go = (id) => {
      if (id === "shipyard") return goTo("pet:shipyard");
      if (reg(id) && !onThisIsland(id)) return toast(wv.voyage ? "You're at sea -- land first." : "That's off the main island -- sail home first.", true);
      if (reg(id)) { seaChart = false; worldRegion = id; status = ""; return render(); }
      if (id === where) { seaChart = false; return render(); }
      showSeaSheet(id);
    };
    host.querySelectorAll("[data-sea-go]").forEach((el) => {
      el.addEventListener("click", () => go(el.dataset.seaGo));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(el.dataset.seaGo); } });
    });
    wireSeaButton(host);
    tickClocks(host, "pet:world");
  }
  function closeSeaSheet() { const m = document.querySelector(".pp-modal.pp-sea-modal"); if (m) m.remove(); }
  /** An island on the sea chart (or the main island, from away): where it is, and Set sail. */
  function showSeaSheet(id) {
    closeSeaSheet();
    const {s, now} = current(), sy = Core.shipyardView(s, now), wv = Core.worldView(s, now);
    const home = id === "main", isle = sy.islands.find((i) => i.id === id);
    const name = home ? "The Main Island" : isle.name;
    const why = wv.voyage ? `You're at sea -- you land in ${clock(wv.voyage.endsIn)}.`
      : !home && !isle.can ? (sy.tier ? `It's too far for your ${sy.name.toLowerCase()} -- it takes a ${isle.ship.toLowerCase()}. Ships are built at the Shipyard on the Coast.`
                                       : "You need a ship first -- Old Salt on the Coast will help you build one.") : "";
    const box = document.createElement("div");
    box.className = "pp-modal pp-sea-modal";
    box.innerHTML = `<div class="pp-modal-card pp-shop-card pp-sec-card" role="dialog" aria-label="${esc(name)}">
      <button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
      <section class="pp-shop"><b>${esc(name)}</b>
        
        ${why ? `<p>${esc(why)}</p>` : `<p>${sy.mins} minutes by ${esc(sy.name.toLowerCase())}${home ? ", to the Shipyard" : " -- you stay until you sail home from its dock"}.</p>`}
        <div class="pp-place-btns">
          ${why ? "" : `${sy.provisions ? provisionHTML(sy.provisions) : ""}<button class="btn btn-primary" id="pp-sea-sail">${home ? "Sail home" : `Set sail for ${esc(name)}`}</button>`}
          ${why && sy.tier && !wv.here && !wv.voyage ? `<button class="btn" id="pp-sea-yard">Go to the Shipyard</button>` : ""}
        </div></section></div>`;
    document.body.appendChild(box);
    box.addEventListener("click", (e) => { if (e.target === box) closeSeaSheet(); });
    box.querySelector(".pp-shop-x").addEventListener("click", closeSeaSheet);
    wireProvisions(box);
    const y = box.querySelector("#pp-sea-yard"); if (y) y.addEventListener("click", () => { closeSeaSheet(); goTo("pet:shipyard"); });
    const b = box.querySelector("#pp-sea-sail");
    if (b) b.addEventListener("click", async () => {
      closeSeaSheet();
      const r = await act("sail", {to: home ? "home" : id, provisions: provOn()});
      if (r && r.error) { status = r.error; toast(r.error, true); }
      render();
    });
  }
  /** A region you can open from where you are: one on the island you're on (Cam, 2026-10-09: "I should not be able to
   *  click any foreign location ... underneath the main island"). The Open Sea opens from the sea chart, at home. */
  function onThisIsland(id) {
    const r = Core.REGIONS[id], {s} = current(), here = Core.islandOf(s) || "";
    return !!r && (r.isle || "") === here && !(here && id === "opensea") && !(s.player && s.player.voyage);
  }
  // your estate on the main island's map (2026-10-13, Cam: "the estate on the main island to be located on the main map and
  // not hidden in the village (only for the main island not the desert or frostpeak)"): a drawn marker on the grass between
  // the Mage tower's path and the Village until it's painted in; the island estates stay in their own towns
  // your estate, painted on the map since Cam's new picture (2026-10-16): an outline over it, glowing like a region's
  const ESTATE_ART = {pts: "520,270 600,240 720,240 840,300 840,390 780,460 540,465 505,390"};
  function estateSpotSVG() {
    return `<g class="pp-region pp-estate-spot" data-region="estate" tabindex="0" role="button" aria-label="Your estate: house, workshop, library, store room, graveyard and the Farm">
      <title>Your estate</title>
      <polygon class="pp-region-area" points="${ESTATE_ART.pts}" filter="url(#pp-soft)"/>
      <polygon class="pp-region-hit" points="${ESTATE_ART.pts}"/>
    </g>`;
  }
  function renderWorld(host) {
    everySecond("world");
    if (worldRegion && !onThisIsland(worldRegion)) worldRegion = "";
    if (worldRegion && worldRegion !== "village") return renderLand(host, worldRegion);
    const {s, now} = current();
    const wv = Core.worldView(s, now), at = {};
    wv.regions.forEach((r) => { at[r.id] = r; });
    if (seaChart) return renderSea(host, wv);
    if (wv.here || wv.voyage) return renderIsland(host, wv);              // on an island, or at sea (2026-10-08)
    const drawn = Object.keys(WORLD_ART).filter((id) => at[id]);
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${wv.exploring ? `<p class="pp-world-now">Exploring the <b>${esc(wv.exploring.name)}</b> — back in <span id="pp-explore-clock">${clock(wv.exploring.endsIn)}</span></p>` : ""}
        <div class="pp-world">
          <svg class="pp-world-map" viewBox="0 0 ${WORLD_W} ${WORLD_H}" role="img" aria-label="The world map">
            <defs><filter id="pp-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter></defs>
            <image href="${modPics.regions.worldmap || "art/worldmap.webp"}" x="0" y="0" width="${WORLD_W}" height="${WORLD_H}" preserveAspectRatio="xMidYMid slice"/>
            ${lifeSVG("worldmap")}
            ${drawn.map((id) => { const r = at[id];
              return `<g class="pp-region${r.open ? "" : " locked"}${wv.exploring && wv.exploring.region === id ? " exploring" : ""}" data-region="${id}" tabindex="0" role="button" aria-label="${esc(r.name)}${r.open ? "" : " (locked)"}">
                <title>${esc(r.name)}${r.open ? "" : " -- " + esc(r.lock || "locked")}</title>
                <polygon class="pp-region-area" points="${WORLD_ART[id].pts}" filter="url(#pp-soft)"/>
                <polygon class="pp-region-hit" points="${WORLD_ART[id].pts}"/>
              </g>`; }).join("")}
            ${estateSpotSVG()}
            <g class="pp-map-badges">${drawn.map((id) => worldBadges(at[id], WORLD_ART[id])).join("")}</g>
          </svg>
        </div>
        <div class="pp-world-list"><button class="pp-world-row" data-region="estate">
            <img alt="" src="${itemIcon("obj_house", 32)}">
            <span><b>Your estate</b> <span class="stamp">home</span>
</span>
          </button>${wv.regions.filter((r) => !r.hub && !WORLD_SOON.includes(r.id)).map((r) => `
          <button class="pp-world-row${r.open ? "" : " locked"}" data-region="${r.id}">
            <img alt="" src="${regionIcon(r, 32)}">
            <span><b>${esc(r.name)}</b> <span class="stamp">${r.open ? `level ${r.level}+ · ${r.found}/${r.total} secrets found${r.explored ? ` · explored ${r.explored}×` : ""}` : esc(r.lock)}</span>

              ${r.person ? `<span class="stamp pp-world-blurb">${r.questReady ? "❗ " : ""}${esc(r.person)}${r.questsLeft ? ` · ${r.questsLeft} quest${r.questsLeft === 1 ? "" : "s"} left` : " · all quests done"}</span>` : ""}</span>
          </button>`).join("")}</div>
      </div>`;
    const go = (id) => { if (id === "village") return goTo("pet:village"); if (id === "estate") return goTo("pet:estate"); worldRegion = id; status = ""; render(); };
    wireSeaButton(host);
    host.querySelectorAll("[data-region]").forEach((el) => {
      el.addEventListener("click", () => go(el.dataset.region));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(el.dataset.region); } });
    });
    exploreClock(host);
  }
  // what this trip has found so far, live (2026-10-10, Cam: "i would like a list of what i have gathered at the current
  // spot to be shown live updating as i gather ... i need to collect more earthworms before i can go to the river")
  function landTripHTML(lv, s, now) {
    const j = lv.job, pj = Core.playerView(s, now).job, bag = s.bag || {};
    const found = pj && !pj.hunt ? pj.items || {} : {};
    const ids = Object.keys(found).filter((k) => Core.ITEMS[k] && found[k] > 0).sort((a, b) => found[b] - found[a]);
    return `<span>${j.hunt ? "Hunting" : "Gathering"} at the <b>${esc(j.name || "")}</b> · ${j.count} ${j.hunt ? "fights" : "finds"} so far${pj && !pj.hunt ? ` · +${pj.xp} xp` : ""}${pj && pj.full ? ` · <b class="pp-trip-full">bag full: no more ${esc(pj.full.toLowerCase())} fits</b>` : ""}</span>
      ${j.hunt ? "" : `<div class="pp-finds pp-land-finds">${ids.length ? ids.map((k) => `<span class="pp-find" title="${esc(Core.ITEMS[k].name)}: ${found[k].toLocaleString()} this trip · ${(bag[k] || 0).toLocaleString()} in your bag">
          <img alt="" src="${itemIcon(k, 20)}">${esc(Core.ITEMS[k].name)} <b>${found[k].toLocaleString()}</b></span>`).join("") : `<span class="stamp">Nothing yet — the first find is on its way.</span>`}</div>`}`;
  }
  function landTripClock(host, id) {
    everySecond("land");
    everySecond("land", () => {
      const box = host.querySelector("#pp-land-trip");
      if (!host.isConnected || !box || page() !== "pet:world" || worldRegion !== id) return false;
      const c = current(), lv = Core.landView(c.s, id, c.now);
      if (!lv || !lv.job) { render(); return false; }     // the trip ended: draw the page again
      const html = landTripHTML(lv, c.s, c.now);
      if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
    });
  }
  function exploreClock(host) {
    everySecond("world", () => {
      if (!host.isConnected || page() !== "pet:world") return false;
      const c = current(), w = Core.worldView(c.s, c.now);
      const el = host.querySelector("#pp-explore-clock");
      if (!w.exploring || w.exploring.endsIn <= 0) { if (el) render(); return false; }
      if (el) el.textContent = clock(w.exploring.endsIn);
    });
  }
  // someone who lives there, and what they'd like
