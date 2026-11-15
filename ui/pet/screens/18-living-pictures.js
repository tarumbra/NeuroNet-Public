  // ---- living pictures (2026-10-08, Cam liked "a day/night tint on the pictures that follows your clock" and
  //      "little moving touches on the scenes"): smoke from chimneys and fires, water glinting, fires and lamps
  //      flickering, birds crossing the sky, fireflies after dark. Positions are on the 2000x1116 pictures.
  //      smoke [x,y] · water [x,y] · fire [x,y,r] · glow [x,y,r,colour] · birds n · flies n (after dark; always if `dark`)
  const SCENE_LIFE = {
    ranch: {birds: 3, water: [[150, 1050], [300, 1080]]},                           // the Farm (2026-10-12): the duck pond
    worldmap: {birds: 3, water: [[120, 60], [1850, 150], [1920, 900], [40, 700], [700, 1095], [1300, 1100]], smoke: [[668, 245]]},   // (the estate's chimney, 2026-10-16)
    seachart: {birds: 2, water: [[60, 420], [1650, 560], [1950, 300], [1300, 1090], [700, 40]]},
    // Cam's pictures, 2026-10-09: the day/night light outdoors (and a little life); indoors and underground, none
    "isle-desert": {birds: 3, water: [[80, 300], [1950, 500], [700, 1080]]}, "isle-frostpeak": {birds: 2, water: [[200, 500], [1800, 400], [500, 1050]]},
    desert: {birds: 1}, nile: {birds: 3, water: [[600, 650], [1150, 800], [1550, 900]]}, oasis: {birds: 2, water: [[700, 640], [850, 700]]},
    sandport: {birds: 3, water: [[150, 300], [100, 700], [500, 1080]]}, frosthaven: {birds: 1, smoke: [[575, 165], [860, 300]]},
    frostpeak: {birds: 1}, summit: {birds: 2}, mistyisle: {birds: 2, water: [[300, 1000], [1700, 900], [150, 650]]},
    icecavern: {indoor: true}, crystalcaves: {indoor: true}, nursery: {indoor: true}, storeroom: {indoor: true}, pyramid: {indoor: true},
    opensea: {birds: 3, water: [[900, 700], [1300, 500], [600, 400], [1100, 1000]]}, deepjungle: {flies: 8, dark: true}, shipyard: {birds: 2, water: [[200, 950], [700, 1050]]},
    magetower: {}, graveyard: {flies: 14, dark: true}, camp: {fire: [[1227, 751, 40]], flies: 10}, islandestate: {birds: 2},
    estate: {birds: 2, smoke: [[1140, 320], [975, 715], [205, 660]], water: [[160, 610], [420, 480], [90, 650]], fire: [[200, 770, 40], [970, 935, 25]]},
    village: {birds: 2, smoke: [[1840, 400], [370, 145], [1690, 820]], fire: [[1700, 860, 30]]},
    farmyard: {birds: 3, water: [[230, 620], [330, 690], [1000, 720], [1080, 650]], smoke: [[1890, 560]]},
    pasture: {birds: 3, water: [[300, 560], [1240, 650], [300, 960], [800, 1010], [1000, 300]]},
    meadow: {birds: 2, water: [[250, 1020], [400, 950], [1010, 580], [700, 560]]},
    forest: {birds: 1, water: [[330, 420], [230, 790], [200, 700], [270, 860]], fire: [[1130, 690, 45]], smoke: [[1130, 660]], flies: 12},
    deepforest: {water: [[720, 620], [1040, 570], [1100, 640]], fire: [[1800, 640, 40], [1770, 1000, 35]], smoke: [[1800, 610]],
                 glow: [[680, 330, 120, "#5ff0d8"]], flies: 16, dark: true},
    jungle: {birds: 2, water: [[640, 370], [1100, 620], [1000, 520], [950, 660]], fire: [[215, 290, 40], [1770, 1000, 35]], smoke: [[1770, 970]],
             glow: [[1470, 150, 140, "#d070ff"]], flies: 12},
    coast: {birds: 4, water: [[1500, 500], [1000, 1000], [600, 950], [1650, 200], [150, 600], [1200, 880]], glow: [[1935, 330, 60, "#ffe28a"]]},
    house: {indoor: true, fire: [[1035, 470, 70]], smoke: [[1040, 420]], glow: [[520, 265, 40, "#ffd58a"]]},
    library: {indoor: true, fire: [[650, 880, 60]], glow: [[330, 310, 90, "#b070ff"], [640, 420, 90, "#8a7aff"], [150, 330, 30, "#ffd58a"], [560, 235, 30, "#ffd58a"],
              [795, 285, 30, "#ffd58a"], [1190, 740, 25, "#ffd58a"], [1620, 730, 25, "#ffd58a"], [525, 860, 30, "#ffd58a"], [790, 850, 30, "#ffd58a"]]},
    workshop: {birds: 1, fire: [[1470, 250, 70], [440, 185, 40], [230, 270, 30], [1715, 875, 25], [1805, 830, 25], [1910, 895, 25], [1815, 1020, 25]],
               smoke: [[1430, 40], [310, 330]], glow: [[1550, 640, 60, "#c070ff"], [1770, 1000, 70, "#c070ff"]]}};
  /** The time of day, by the clock: a colour over the picture (none by day), and whether it's dark. */
  // (2026-10-08, Cam: the evening's navy wash looked like the map was "blue highlighted") -- the light now dims the
  // picture by multiplying (its own colours stay, darker and warmer), never a coloured veil over it; Settings can
  // turn it off
  // (2026-10-08, Cam: "maps have darkened since last update" -> a gentle night by default; then "add the other one but as a
  // setting in the settings menu (accessibility)" -> Settings, Accessibility: "Deeper night" brings back the darker light)
  const DAY_LIGHT = {
    gentle: {night: "#dcd6e0", dawn: "#fdf0e4", dusk: "#fef0dc", evening: "#f2e6da"},
    deep: {night: "#8e8794", dawn: "#fbe2cf", dusk: "#fde3bf", evening: "#d9bfa8"}};
  /** The sandbox's sky switch (PT15): "night", "day", or "" for the real clock -- the real game always has "". */
  function sandboxSky() { const d = slot === "dev" && states.dev && states.dev.dev; return d && (d.sky === "night" || d.sky === "day") ? d.sky : ""; }
  function dayPhase(now) {
    const sky = sandboxSky();
    const h = sky === "night" ? 23 : sky === "day" ? 12 : new Date(now || Date.now()).getHours() + new Date(now || Date.now()).getMinutes() / 60;
    const st = (window.NP && NP.settings) || {};
    if (st.dayNight === false) return {fill: "", dark: false, name: "day"};
    const L = DAY_LIGHT[st.deepNight ? "deep" : "gentle"];
    if (h >= 21 || h < 5) return {fill: L.night, dark: true, name: "night"};
    if (h < 7) return {fill: L.dawn, dark: false, name: "dawn"};
    if (h < 17) return {fill: "", dark: false, name: "day"};
    if (h < 19) return {fill: L.dusk, dark: false, name: "dusk"};
    return {fill: L.evening, dark: false, name: "evening"};
  }
  /** The tint and the moving things for scene `id` (an SVG fragment, drawn over the picture, under the places). */
  function lifeSVG(id) {
    const L = SCENE_LIFE[id];
    if (!L) return "";
    const ph = L.indoor ? {fill: "", dark: false} : dayPhase();
    let seed = [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 11);
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const out = [];
    if (ph.fill) out.push(`<rect class="pp-tint" width="${WORLD_W}" height="${WORLD_H}" fill="${ph.fill}" style="mix-blend-mode:multiply"/>`);
    (L.water || []).forEach(([x, y]) => { for (let i = 0; i < 3; i++) {
      const dx = Math.round((rnd() - 0.5) * 90), dy = Math.round((rnd() - 0.5) * 30);
      out.push(`<ellipse class="pp-glint" cx="${x + dx}" cy="${y + dy}" rx="${10 + Math.round(rnd() * 10)}" ry="3" style="animation-delay:-${(rnd() * 4).toFixed(1)}s"/>`); } });
    (L.smoke || []).forEach(([x, y]) => { for (let i = 0; i < 4; i++)
      out.push(`<circle class="pp-smoke" cx="${x}" cy="${y}" r="14" style="animation-delay:-${(i * 1.6 + rnd()).toFixed(1)}s"/>`); });
    (L.fire || []).forEach(([x, y, r]) => out.push(`<circle class="pp-fire" cx="${x}" cy="${y}" r="${r * (ph.dark ? 1.5 : 1)}" style="animation-delay:-${(rnd() * 2).toFixed(1)}s"/>`));
    (L.glow || []).forEach(([x, y, r, col]) => out.push(`<circle class="pp-glow" cx="${x}" cy="${y}" r="${r * (ph.dark ? 1.4 : 1)}" fill="${col}" style="animation-delay:-${(rnd() * 3).toFixed(1)}s"/>`));
    for (let i = 0; i < (L.birds || 0) && !ph.dark; i++) {
      const y = 60 + Math.round(rnd() * 240), dur = 40 + Math.round(rnd() * 30);
      out.push(`<g class="pp-bird" style="animation-duration:${dur}s;animation-delay:-${Math.round(rnd() * dur)}s"><g transform="translate(0 ${y})">
        <path class="pp-wings" d="M-14 0 q7 -9 14 0 q7 -9 14 0" style="animation-delay:-${(rnd()).toFixed(2)}s"/></g></g>`);
    }
    if (L.flies && (ph.dark || L.dark)) for (let i = 0; i < L.flies; i++)
      out.push(`<circle class="pp-firefly" cx="${Math.round(100 + rnd() * 1800)}" cy="${Math.round(300 + rnd() * 760)}" r="5" style="animation-delay:-${(rnd() * 6).toFixed(1)}s;animation-duration:${(5 + rnd() * 4).toFixed(1)}s"/>`);
    return `<g class="pp-life" aria-hidden="true">${out.join("")}</g>`;
  }
  /** A painted scene: the picture, a click area on each place (its scroll and the thing it names), fog on what's
   *  locked and a badge for what's going on. places: [{key, name, lock, here, ready, note}] -- keys not painted
   *  are left to the cards under the picture. */
  function paintedHTML(id, places, pic) {
    const art = SCENE_ART[id], cells = [], badges = [];
    places.forEach((p) => {
      [p.key, p.key + "#2"].filter((k) => art[k]).forEach((k) => {
        const a = art[k], [cx, cy, w, h = 56] = a.at, o = a.o;
        const tip = `${p.name}${p.lock ? " -- " + p.lock : ""}`;
        cells.push(`<g class="pp-spot${p.lock ? " locked" : ""}${p.here ? " here" : ""}${p.ready ? " ready" : ""}" data-key="${esc(p.key)}" tabindex="0" role="button" aria-label="${esc(tip)}">
          <title>${esc(tip)}</title>
          ${o ? `<ellipse class="pp-spot-thing" cx="${o[0]}" cy="${o[1]}" rx="110" ry="80"/>` : ""}
          <rect class="pp-spot-label" x="${cx - w / 2 - 8}" y="${cy - h / 2 - 6}" width="${w + 16}" height="${h + 12}" rx="14"/>
          ${a.chip ? `<g class="pp-map-chip find"><rect x="${cx - w / 2}" y="${cy - 24}" width="${w}" height="48" rx="12"/><text x="${cx}" y="${cy + 9}">${esc(a.chip)}</text></g>` : ""}
        </g>`);
        if (k !== p.key) return;
        const top = cy + h / 2 + 44 > WORLD_H ? cy - h / 2 - 40 : cy + h / 2 + 4;     // near the bottom edge: above the scroll
        const chip = (text, cls) => { const cw = 28 + 14 * [...text].length;
          badges.push(`<g class="pp-map-chip ${cls}"><rect x="${cx - cw / 2}" y="${top}" width="${cw}" height="36" rx="18"/><text x="${cx}" y="${top + 26}">${esc(text)}</text></g>`); };
        if (p.lock) chip("🔒 " + (p.lockShort || p.lock), "lock");
        else if (p.here) chip(p.hereText || "You're here", "busy");
        else if (p.note) chip(p.note, "");
        if (p.ready) badges.push(`<g class="pp-quest-mark"><circle cx="${cx + w / 2 + 6}" cy="${cy - h / 2 - 2}" r="22"/><text x="${cx + w / 2 + 6}" y="${cy - h / 2 + 8}">!</text></g>`);
      });
    });
    return `<div class="pp-world pp-painted">
      <svg class="pp-world-map" viewBox="0 0 ${WORLD_W} ${WORLD_H}" role="img" aria-label="${esc(id)}">
        <image href="art/${pic || id}.webp" x="0" y="0" width="${WORLD_W}" height="${WORLD_H}"/>
        ${lifeSVG(id)}${cells.join("")}<g class="pp-map-badges">${badges.join("")}</g>
      </svg></div>`;
  }
  /** Click / Enter on a painted place calls go(key). */
  function wirePainted(host, go) {
    host.querySelectorAll(".pp-spot").forEach((el) => {
      el.addEventListener("click", () => go(el.dataset.key));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(el.dataset.key); } });
    });
  }
  function regionIcon(r, size) {
    // a region's own animal: the painted pet that hides there (2026-10-11, Cam: "why are these still pixel art?" -- the old
    // ids were pixel-only drawings, not creatures, so they had no painting)
    const ownPet = {deepjungle: ["snake", "emerald"], crystalcaves: ["spider", "crystal"], mistyisle: ["crab", "coral"], frostpeak: ["ram", "frost"]};
    if (r.hub) return itemIcon("obj_village", size);
    if (ownPet[r.id]) return petURL(ownPet[r.id][0], ownPet[r.id][1], size, "ok");
    if (r.id === "magetower") return monsterURL("archmagemage", size);
    return r.boss ? monsterURL(r.boss, size) : itemIcon("obj_map", size);
  }
  // the badges under/around a region's painted scroll: lock or secrets found, a quest waiting, who's out there
  function worldBadges(r, art) {
    const [x1, x2, y] = art.label, mid = (x1 + x2) / 2;
    const chip = (text, cls, cx, cy) => { const w = 24 + 15 * [...text].length;
      return `<g class="pp-map-chip ${cls}"><rect x="${cx - w / 2}" y="${cy - 19}" width="${w}" height="38" rx="19"/><text x="${cx}" y="${cy + 9}">${esc(text)}</text></g>`; };
    const busy = r.busy.map((k) => ({gather: "⛏", hunt: "⚔", explore: "🧭", pet: "🐾"})[k] || "").join("");
    return (r.hub || (r.open && !r.total) ? "" : r.open ? chip(`${r.found}/${r.total} secrets`, "", mid, y + 58) : chip("🔒 Locked", "lock", mid, y + 58))
      + (busy ? chip(busy, "busy", x1 + 10, y - 46) : "")
      + (r.questReady ? `<g class="pp-quest-mark"><circle cx="${x2 + 8}" cy="${y - 30}" r="22"/><text x="${x2 + 8}" y="${y - 20}">!</text></g>` : "");
  }
