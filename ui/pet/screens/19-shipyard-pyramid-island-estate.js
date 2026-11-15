  // ---- the Shipyard (2026-10-08): your ship, the next one in four parts, setting sail -- and Shipwright Hal ------------
  /** Clocks on a page ([data-ends] = when, in ms): they count down, and the page redraws when one runs out. */
  function tickClocks(host, pageKey) {
    everySecond("ship");
    if (!host.querySelector("[data-ends]")) return;
    everySecond("ship", () => {
      if (!host.isConnected || page() !== pageKey) return false;
      let done = false;
      host.querySelectorAll("[data-ends]").forEach((el) => { const left = Math.ceil((+el.dataset.ends - Date.now()) / 1000); if (left <= 0) done = true; el.textContent = clock(Math.max(0, left)); });
      if (done) { render(); return false; }
    });
  }
  const SHIP_ICON = ["obj_map", "boat", "plank", "hardplank", "fineplank"];
  function renderShipyard(host) {
    const {s, now} = current(), sy = Core.shipyardView(s, now);
    const ends = (secs) => `<b data-ends="${now + secs * 1000}">${clock(secs)}</b>`;
    const away = sy.island || sy.voyage;
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${paintedHTML("shipyard", [{key: "ship", name: "Your ship", note: sy.name}, {key: "slipway", name: "The slipway", note: sy.building ? "Building" : sy.next ? "Next: " + sy.next.name : ""},
            {key: "person", name: "Shipwright Hal", ready: !!(sy.person && sy.person.quest && sy.person.quest.can)}, {key: "sail", name: "Set sail", lock: sy.tier >= 1 ? "" : "no ship yet", lockShort: "No ship"}])}
        ${away ? `<section class="pp-shop"><p>${sy.voyage ? `At sea — ${ends(sy.voyage.endsIn)} to go.` : "The Shipyard is back home on the Coast — sail home first."}</p></section>` : ""}
        <section class="pp-shop pp-ship">
          <div class="pp-skill-head"><b>Your ship: ${esc(sy.name)}</b><span class="pp-tier-dots" title="Tier ${sy.tier} of 4">${[1, 2, 3, 4].map((i) => `<span class="pp-tier-dot${i <= sy.tier ? " on" : ""}"></span>`).join("")}</span></div>
          <p class="stamp">${["Old Salt on the Coast will help you build your first boat -- then the Shipyard is yours.", "A rowboat: the Misty Isle and the coast's waters.",
            "A sailboat: your pets can go on ocean expeditions.", "A caravel: the Desert Island and Frostpeak Island are in reach.", "A galleon: the finest ship on the isle."][sy.tier]}</p>
          ${sy.building ? `<p>Building the ${esc(sy.building.part.toLowerCase())} — ${ends(sy.building.endsIn)} left.</p>` : ""}
        </section>
        ${sy.tier >= 1 && sy.next ? `<section class="pp-shop pp-ship-next">
          <b>Next: a ${esc(sy.next.name.toLowerCase())}</b> <span class="stamp">· four parts, one at a time · needs Construction ${sy.next.con}${sy.next.conOk ? " ✓" : ""}</span>
          <div class="pp-areas">${sy.next.parts.map((p) => `<div class="pp-area">
            <div class="pp-skill-head"><b>${esc(p.name)}</b><span class="pp-level">${p.done ? "✓ Done" : p.building ? "Building" : `${p.hours} h · +${p.xp} xp`}</span></div>
            ${p.done ? "" : `<div class="pp-needs"><span class="pp-need-chip${(s.coins || 0) >= p.coins ? "" : " lack"}">${coinTxt(p.coins)}</span>${p.items.map((i) =>
              `<span class="pp-need-chip${i.have >= i.need ? "" : " lack"}" data-iteminfo="${i.id}"><img alt="" src="${itemIcon(i.id, 16)}">${i.have}/${i.need}</span>`).join("")}</div>
              ${p.building ? "" : `<button class="btn btn-sm ${p.can ? "btn-primary" : ""}" data-part="${p.id}" ${p.can && !away ? "" : "disabled"}>Build</button>`}`}
          </div>`).join("")}</div>
        </section>` : ""}
        ${sy.tier >= 1 ? `<section class="pp-shop pp-ship-sail">
          <b>Set sail</b> <span class="stamp">· ${sy.mins} minutes by ${sy.tier >= 3 ? esc(sy.name.toLowerCase()) : "caravel"} -- you stay until you sail home from the island's dock</span>
          ${provisionHTML(sy.provisions)}
          <div class="pp-place-btns">${sy.islands.map((i) => `<button class="btn ${i.can ? "btn-primary" : ""}" data-sail="${i.id}" ${i.can && !away ? "" : "disabled"}
              title="${i.can ? "" : `Needs a ${esc(i.ship.toLowerCase())}`}">Sail to ${esc(i.name)}${i.can ? "" : ` (${esc(i.ship.toLowerCase())})`}</button>`).join("")}</div>
        </section>` : ""}
        ${sy.person ? personHTML(sy.person, !away) : ""}
      </div>`;
    const doIt = async (a, o) => { const r = await act(a, o); if (r && r.error) { status = r.error; toast(r.error, true); render(); } };
    host.querySelectorAll("[data-part]").forEach((b) => b.addEventListener("click", () => doIt("shipbuild", {part: b.dataset.part})));
    host.querySelectorAll("[data-sail]").forEach((b) => b.addEventListener("click", () => doIt("sail", {to: b.dataset.sail, provisions: provOn()})));
    wireProvisions(host);
    const qb = host.querySelector("#pp-quest"); if (qb) qb.addEventListener("click", () => doIt("quest", {region: "shipyard"}));
    wirePainted(host, (k) => {
      const el = k === "ship" ? host.querySelector(".pp-ship") : k === "slipway" ? host.querySelector(".pp-ship-next") : k === "sail" ? host.querySelector(".pp-ship-sail")
        : host.querySelector(".pp-person, #pp-quest");
      if (el) { el.scrollIntoView({block: "center", behavior: "smooth"}); el.classList.add("pp-flash"); setTimeout(() => el.classList.remove("pp-flash"), 1200); }
      else if (k === "slipway") toast(sy.tier ? "That's the finest ship there is." : "Old Salt on the Coast will help you build your first boat.");
    });
    tickClocks(host, "pet:shipyard");
  }
  // ---- the Pyramid (2026-10-09): one run a day, chamber by chamber -- traps, glyph riddles, guardians -- then the
  //      treasure, different every time; after dark the sixth chamber, the Pharaoh's sarcophagus ---------------------------
  function renderPyramid(host) {
    const {s, now} = current(), v = Core.pyramidView(s, now), c = v.current;
    const roman = ["I", "II", "III", "IV", "V", "VI"], icon = {trap: "⚠", riddle: "𓂀", guardian: "⚔"};
    const pct = (x) => Math.round(x * 100) + "%";
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${paintedHTML("pyramid", v.chambers.map((x, i) => ({key: "ch:" + i, name: x.night ? "The sarcophagus" : "Chamber " + roman[i],
            here: i === v.at && !!c && !v.out, hereText: "◀ You're here", note: x.done ? "✓" : "", lock: !x.done && !(i === v.at && c) ? (x.night && !v.night ? "after dark" : "ahead") : "",
            lockShort: x.night && !v.night ? "After dark" : "Ahead"})))}
        <section class="pp-shop">
          <div class="pp-skill-head"><b>The Pyramid</b><span class="pp-level">♥ ${v.hp}/${v.maxHp}</span></div>
          
          <div class="pp-pyr-track">${v.chambers.map((x, i) => `<span class="pp-pyr-room${x.done ? " done" : ""}${i === v.at && c ? " here" : ""}${x.night ? " night" : ""}"
              title="${x.night ? "The sarcophagus (after dark)" : "Chamber " + roman[i]}">${x.done ? "✓" : x.night ? "☾" : roman[i]}</span>`).join("")}</div>
        </section>
        ${v.lock ? `<section class="pp-shop"><p>🔒 ${esc(v.lock)}</p></section>`
          : v.fighting ? `<section class="pp-shop"><p>The fight is on — eat, fire your special or run, round by round.</p><button class="btn btn-primary" data-jump="pet:hunt">To the fight</button></section>`
          : v.out ? `<section class="pp-shop"><p>The Pyramid threw you out today — its doors open again tomorrow.</p></section>`
          : !c ? `<section class="pp-shop"><p>${v.sarcophagus ? "Every chamber cleared — even the Pharaoh's. Come back tomorrow." : `All five chambers cleared today.${v.night ? "" : " The sarcophagus opens after dark (9 pm)."}`}</p></section>`
          : `<section class="pp-shop pp-pyr-room-card">
              <div class="pp-skill-head"><b>${icon[c.kind]} ${c.kind === "guardian" ? esc(c.name) : esc(c.name)}</b><span class="stamp">Chamber ${roman[v.at]}</span></div>
              ${c.kind === "trap" ? `<p>${esc(c.text)}</p><div class="pp-areas">${c.ways.map((w) => `<div class="pp-area">
                  <div class="pp-skill-head"><b>${esc(w.how)}</b><span class="pp-level">${pct(w.chance)}</span></div>
                  <div class="stamp">${esc(w.skillName)} ${w.level} (wants ${w.req})</div>
                  <button class="btn btn-sm btn-primary" data-pyr-way="${w.i}">Try it</button></div>`).join("")}</div>`
                : c.kind === "riddle" ? `<p class="pp-pyr-riddle">“${esc(c.text)}”</p><p class="stamp">Touch the glyph that answers it.</p>
                  <div class="pp-place-btns">${c.choices.map((g) => `<button class="btn" data-pyr-glyph="${g.id}"><img alt="" src="${itemIcon(g.id, 24)}"> ${esc(g.name.replace(/ glyph$/, ""))}</button>`).join("")}</div>`
                : `<div class="pp-pyr-foe"><img alt="" src="${monsterURL(c.mon, 96)}"><div><b>${esc(c.monName)}</b>${c.boss ? ' <span class="pp-level">Boss</span>' : ""}
                    <div class="stamp">Health ${c.hp} · attack ${c.att} · defence ${c.def}</div>
                    <button class="btn btn-primary" id="pp-pyr-fight">Fight</button>${c.boss ? ` <span class="stamp">a live battle — eat, specials, run</span>` : ""}</div></div>`}
            </section>`}
        ${v.crypt && !v.out ? `<section class="pp-shop pp-pyr-crypt"><div class="pp-skill-head"><b>👁 Keen Eye: a sealed crypt</b><span class="stamp">Chamber ${roman[v.crypt.chamber]}</span></div>
            <p>${v.crypt.done === "opened" ? "You've emptied it today." : v.crypt.done === "sealed" ? "It bit back -- sealed for today." : "Behind a loose stone, a lock nobody else would see."}</p>
            ${v.crypt.done ? "" : `<div class="stamp">Larceny ${v.crypt.level} (wants ${v.crypt.req}) · ${pct(v.crypt.chance)}</div>
              <button class="btn btn-sm btn-primary" data-pyr-crypt ${v.crypt.level < v.crypt.req ? "disabled" : ""}>Pick the lock</button>`}</section>` : ""}
        ${v.loot ? `<section class="pp-shop"><b>Today's treasure</b><div class="pp-needs">
            <span class="pp-need-chip">${coinTxt(v.loot.coins)}</span>${Object.keys(v.loot.items).map((k) => `<span class="pp-need-chip" data-iteminfo="${k}"><img alt="" src="${itemIcon(k, 16)}">${v.loot.items[k]}</span>`).join("")}</div></section>` : ""}
        ${v.log.length ? `<section class="pp-shop"><b>Today</b>${v.log.map((t) => `<div class="stamp">· ${esc(t)}</div>`).join("")}</section>` : ""}
        <section class="pp-shop"><b>The Pharaoh's set</b> <span class="stamp">· five pieces, found in the treasure (more often in the Pharaoh's) — all five worn: +10% xp, +6 defence, +6 magic, surer hits</span>
          <div class="pp-needs">${v.set.map((x) => `<span class="pp-need-chip${x.have ? "" : " lack"}" data-iteminfo="${x.id}"><img alt="" src="${itemIcon(x.id, 16)}">${esc(x.name.replace("Pharaoh's ", ""))}</span>`).join("")}</div></section>
      </div>`;
    const go = async (o) => { const r = await act("pyramid", Object.assign({roll: Math.random(), manual: c && c.boss && bossMode && bossMode() === "manual"}, o));
      if (r && r.error) { status = r.error; toast(r.error, true); render(); } else if (r && r.msg) { toast(r.msg); if (c && c.boss) goTo("pet:hunt"); } };
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.jump)));
    host.querySelectorAll("[data-pyr-way]").forEach((b) => b.addEventListener("click", () => go({way: +b.dataset.pyrWay})));
    host.querySelectorAll("[data-pyr-glyph]").forEach((b) => b.addEventListener("click", () => go({glyph: b.dataset.pyrGlyph})));
    const f = host.querySelector("#pp-pyr-fight"); if (f) f.addEventListener("click", () => go({}));
    host.querySelectorAll("[data-pyr-crypt]").forEach((b) => b.addEventListener("click", async () => {   // (its own: never off to a boss fight)
      const r = await act("pyramid", {op: "crypt", roll: Math.random()}); if (r && r.error) { status = r.error; toast(r.error, true); render(); } else if (r && r.msg) toast(r.msg); }));
    wirePainted(host, (k) => {
      const i = +k.slice(3), card = host.querySelector(".pp-pyr-room-card");
      if (i === v.at && card) { card.scrollIntoView({block: "center", behavior: "smooth"}); card.classList.add("pp-flash"); setTimeout(() => card.classList.remove("pp-flash"), 1200); }
      else toast(i < v.at ? "Cleared today." : v.chambers[i] && v.chambers[i].night && !v.night ? "The sarcophagus opens after dark (9 pm)." : "Clear the chambers before it first.");
    });
  }
  // ---- an island estate (2026-10-08, islands stage 4): buy the plot, build its six parts, use its benches and chests ----
  function renderIslandEstate(host) {
    const {s, now} = current(), ev = Core.estateView(s, now);
    if (!ev) { host.innerHTML = `<div class="pp-page"><section class="pp-shop"><p>Your island estates are on the islands -- sail to one (the Shipyard on the Coast).</p></section></div>`; return; }
    const dots = (t) => [1, 2, 3, 4].map((i) => `<span class="pp-tier-dot${i <= t ? " on" : ""}"></span>`).join("");
    const estPlaces = ev.parts.map((p) => ({key: "part:" + p.id, name: p.name, note: p.tier ? p.tierName : ev.bought ? "Not built" : ""}))
      .concat([{key: "town", name: "To " + ev.town}], ev.bought ? [] : [{key: "forsale", name: "For sale", note: coinTxt(ev.price).replace("🪙 ", "") + " coins"}]);
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${paintedHTML("islandestate", estPlaces, `estate-${ev.isle}-${ev.stagePic}`)}
        <section class="pp-shop pp-estate-head">
          <div class="pp-skill-head"><b>Your ${esc(ev.name)} estate</b><span class="pp-level">${esc(ev.stageName)}</span></div>
          ${ev.bought ? `
              <div class="pp-place-btns">
                ${ev.store ? `<button class="btn" id="pp-est-store">Open the bank (${ev.store.used}/${ev.store.cap})</button>` : ""}
                ${ev.gardenIn >= 0 ? (ev.gardenIn ? `<button class="btn" disabled>Garden: <span data-ends="${now + ev.gardenIn * 1000}">${clock(ev.gardenIn)}</span></button>` : `<button class="btn btn-primary" id="pp-est-garden">Pick the garden</button>`) : ""}
                ${ev.benches.map((w) => `<button class="btn" data-bench="${w}">${esc(Core.WORKSHOPS[w].name)}</button>`).join("")}
              </div>`
            : `<p>A plot by ${esc(ev.town)}, for sale: <b>${coinTxt(ev.price)}</b>.</p>
               
               <button class="btn btn-primary" id="pp-est-buy" ${ev.coins >= ev.price ? "" : "disabled"}>Buy the plot</button>`}
        </section>
        ${ev.bought ? `<div class="pp-areas">${ev.parts.map((p) => `<div class="pp-area" id="pp-part-${p.id}">
          <div class="pp-skill-head"><b>${esc(p.name)}</b><span class="pp-tier-dots" title="${esc(p.tierName)}">${dots(p.tier)}</span></div>
          <div class="stamp">${p.tier ? esc(p.perk) : "Not built yet."}</div>
          ${p.next ? `<div class="stamp">Next, ${esc(p.next.tierName.toLowerCase())}: ${esc(p.next.perk)}</div>
            <div class="pp-needs"><span class="pp-need-chip${p.next.conOk ? "" : " lack"}">Construction ${p.next.con}</span><span class="pp-need-chip${ev.coins >= p.next.coins ? "" : " lack"}">${coinTxt(p.next.coins)}</span>
              ${p.next.items.map((i) => `<span class="pp-need-chip${i.have >= i.need ? "" : " lack"}" data-iteminfo="${i.id}"><img alt="" src="${itemIcon(i.id, 16)}">${i.have}/${i.need}</span>`).join("")}</div>
            <button class="btn btn-sm ${p.next.can ? "btn-primary" : ""}" data-estpart="${p.id}" ${p.next.can ? "" : "disabled"}>${p.tier ? "Build up" : "Build"} (+${p.next.xp} xp)</button>`
            : `<div class="stamp">As grand as it gets.</div>`}
        </div>`).join("")}</div>` : ""}
      </div>`;
    const doIt = async (a, o) => { const r = await act(a, o || {}); if (r && r.error) { status = r.error; toast(r.error, true); render(); } };
    const b = host.querySelector("#pp-est-buy"); if (b) b.addEventListener("click", () => doIt("estatebuy"));
    wirePainted(host, (k) => {                                         // the picture: a part's card, the plot's price, back to town
      if (k === "town") { worldRegion = ev.townId; return goTo("pet:world"); }
      const el = k === "forsale" ? host.querySelector(".pp-estate-head") : host.querySelector("#pp-" + k.replace(":", "-"));
      if (el) { el.scrollIntoView({block: "center", behavior: "smooth"}); el.classList.add("pp-flash"); setTimeout(() => el.classList.remove("pp-flash"), 1200); }
      else toast(ev.bought ? "" : "Buy the plot first -- then build it up, part by part.");
    });
    const g = host.querySelector("#pp-est-garden"); if (g) g.addEventListener("click", () => doIt("estategarden"));
    const st = host.querySelector("#pp-est-store"); if (st) st.addEventListener("click", () => showStore());
    host.querySelectorAll("[data-estpart]").forEach((x) => x.addEventListener("click", () => doIt("estatebuild", {part: x.dataset.estpart})));
    host.querySelectorAll("[data-bench]").forEach((x) => x.addEventListener("click", () => { openShop = x.dataset.bench; showShop(); }));
    if (openShop) showShop();
    if (document.querySelector(".pp-store-modal")) showStore();
    tickClocks(host, "pet:islandestate");
  }
  // The islands' painted maps (2026-10-09, Cam's pictures): each place's outline and its scroll [left, right, y], as on the main
  // island's map. A key with a colon is a page (the Pyramid), not a region.
  const ISLE_ART = {
    desert: {pic: "isle-desert", places: {
      desert: {pts: "150,520 400,470 700,330 950,330 1050,480 1000,900 800,1000 400,1000 200,900", label: [639, 898, 647]},
      oasis: {pts: "190,200 300,120 560,110 670,200 670,420 560,470 300,460 190,380", label: [300, 522, 78]},
      nile: {pts: "1000,180 1150,150 1300,250 1420,450 1420,650 1300,800 1200,1000 1000,1000 1000,600", label: [1109, 1333, 300]},
      "pet:pyramid": {pts: "1444,111 1844,111 1844,444 1444,444", label: [1509, 1794, 74], name: "The Pyramid"},
      sandport: {pts: "1255,633 1922,633 1922,1022 1255,1022", label: [1300, 1552, 1041]}}},
    frostpeak: {pic: "isle-frostpeak", places: {
      frostpeak: {pts: "220,600 400,440 650,360 900,380 1100,500 1150,650 1000,800 700,900 450,880 380,750", label: [606, 976, 624]},
      frosthaven: {pts: "790,820 1000,740 1370,760 1370,960 1100,1060 800,1000", label: [847, 1156, 1039]},
      summit: {pts: "1000,420 1100,180 1200,160 1360,300 1300,420", label: [1006, 1358, 330]},
      icecavern: {pts: "1222,367 1500,370 1722,550 1650,711 1300,711 1222,550", label: [1267, 1541, 509]}}}};
  function isleMapHTML(isle, regs) {
    const IA = ISLE_ART[isle], at = {};
    if (!IA || modPics.regions[IA.pic] === false) return "";
    regs.forEach((r) => { at[r.id] = r; });
    const keys = Object.keys(IA.places).filter((k) => k.includes(":") || at[k]);
    const view = (k) => at[k] || {id: k, name: IA.places[k].name, open: true, hub: true, busy: []};
    return `<div class="pp-world">
      <svg class="pp-world-map" viewBox="0 0 ${WORLD_W} ${WORLD_H}" role="img" aria-label="The island's map">
        <defs><filter id="pp-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter></defs>
        <image href="${modPics.regions[IA.pic] || "art/" + IA.pic + ".webp"}" x="0" y="0" width="${WORLD_W}" height="${WORLD_H}"/>
        ${lifeSVG(IA.pic)}
        ${keys.map((k) => { const r = view(k), a = IA.places[k];
          return `<g class="pp-region${r.open ? "" : " locked"}" data-isle-go="${esc(k)}" tabindex="0" role="button" aria-label="${esc(r.name)}${r.open ? "" : " (locked)"}">
            <title>${esc(r.name)}${r.open ? "" : " -- " + esc(r.lock || "locked")}</title>
            <polygon class="pp-region-area" points="${a.pts}" filter="url(#pp-soft)"/><polygon class="pp-region-hit" points="${a.pts}"/></g>`; }).join("")}
        <g class="pp-map-badges">${keys.map((k) => worldBadges(view(k), IA.places[k])).join("")}</g>
      </svg></div>`;
  }
  /** Away from the main island (or at sea): the Map is the island you're on. */
  function renderIsland(host, wv) {
    const {now} = current();
    const regs = wv.regions.filter((r) => r.isle === wv.here).sort((a, b) => (b.town ? 1 : 0) - (a.town ? 1 : 0));
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${wv.voyage ? `<section class="pp-shop pp-voyage"><b>At sea</b> <span class="stamp">bound for ${esc(wv.voyage.toName)}</span>
            <p>Land in <b data-ends="${now + wv.voyage.endsIn * 1000}">${clock(wv.voyage.endsIn)}</b>.</p></section>`
          : `<section class="pp-shop pp-voyage"><b>${esc(wv.hereName)}</b> <span class="stamp">You're staying here -- the main island's places, your benches and the shops wait at home.</span>
            ${provisionHTML(Core.shipyardView(current().s, now).provisions)}<div class="pp-place-btns"><button class="btn" id="pp-sail-home">Sail home</button></div></section>`}
        ${wv.voyage ? "" : isleMapHTML(wv.here, regs)}
        ${wv.voyage ? "" : `<div class="pp-world-list">${regs.map((r) => `
          <button class="pp-world-row${r.open ? "" : " locked"}" data-region="${r.id}">
            <img alt="" src="${regionIcon(r, 32)}">
            <span><b>${esc(r.name)}</b> <span class="stamp">${r.town ? "The town and its dock" : r.open ? `level ${r.level}+ · ${r.found}/${r.total} secrets found` : esc(r.lock)}</span>

              ${r.person ? `<span class="stamp pp-world-blurb">${r.questReady ? "❗ " : ""}${esc(r.person)}${r.questsLeft ? ` · ${r.questsLeft} quest${r.questsLeft === 1 ? "" : "s"} left` : " · all quests done"}</span>` : ""}</span>
          </button>`).join("")}</div>`}
      </div>`;
    host.querySelectorAll("[data-region]").forEach((el) => el.addEventListener("click", () => { worldRegion = el.dataset.region; status = ""; render(); }));
    const isleGo = (k) => { if (k.includes(":")) return goTo(k); worldRegion = k; status = ""; render(); };
    host.querySelectorAll("[data-isle-go]").forEach((el) => {
      el.addEventListener("click", () => isleGo(el.dataset.isleGo));
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isleGo(el.dataset.isleGo); } });
    });
    wireSeaButton(host);
    wireProvisions(host);
    const sh = host.querySelector("#pp-sail-home");
    if (sh) sh.addEventListener("click", async () => { const r = await act("sail", {to: "home", provisions: provOn()}); if (r && r.error) { status = r.error; toast(r.error, true); render(); } });
    tickClocks(host, "pet:world");
  }
