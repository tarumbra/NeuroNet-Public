  // ---- life at home, on the page (2026-10-08): the hearth and the table at Home; the archive, the reading chair,
  //      the stacks and the observatory in the Library. The painted places scroll to these sections.
  const SECTIONS = {hearth: "Hearth", dining: "Dining table", archive: "Forbidden archive", reading: "Cozy hearth", stacks: "Ancient stacks", observatory: "Astro observatory"};
  let potPick = {};
  /** A painted section's badge: what's going on there now. */
  function secPlace(k) {
    const {s, now} = current(), hv = Core.homeView(s, now), p = {key: "sec:" + k, name: SECTIONS[k]};
    if (k === "hearth") { if (hv.pot) { p.note = hv.pot.ready ? "Stew's ready" : "Cooking"; p.ready = hv.pot.ready; } }
    if (k === "dining" && hv.fed) p.note = `Well fed +${Math.round(hv.fed.xp * 100)}%`;
    if (k === "archive") { if (!hv.archive.open) { if (hv.archive.key) { p.note = "You have the key"; p.ready = true; } else { p.lock = "locked -- Grizz carries the key"; p.lockShort = "Locked"; } }
      else p.note = `${hv.archive.found}/${hv.archive.total} pages`; }
    if (k === "reading" && hv.reading) p.note = "Reading";
    if (k === "stacks" && hv.researching) p.note = "Researching";
    if (k === "observatory") { if (hv.stars.buff) p.note = hv.stars.buff.name; else if (hv.stars.night && !hv.stars.looked) { p.note = "Stars are out"; p.ready = true; } }
    return p;
  }
  const secHead = (k, extra) => `<section class="pp-shop pp-home-sec" id="pp-sec-${k}"><b>${esc(SECTIONS[k])}</b>${extra ? ` <span class="stamp">${extra}</span>` : ""}`;
  function hearthHTML(hv) {
    const n = Object.values(potPick).reduce((a, b) => a + b, 0);
    return `${secHead("hearth", "· a slow-cooked stew while you're out")}
      ${hv.pot ? (hv.pot.ready ? `<p>The ${esc(hv.pot.name.toLowerCase())} is ready -- ${hv.pot.n} bowls.</p><button class="btn btn-primary" data-home="potcollect">Ladle it out</button>`
          : `<p>${esc(hv.pot.name)} for ${hv.pot.n} on the hearth -- ready in <b>${clock(hv.pot.readyIn)}</b>.</p>`)
        : `<p class="stamp">Put ${hv.potMin} to ${hv.potMax} ingredients in the pot; ${hv.potMins} minutes later, a bowl of stew for each.
            The better the ingredients, the better the stew: ${hv.stews.map((x) => `${esc(x.name.toLowerCase())} (heals ${x.heal})`).join(", ")}.</p>
          ${hv.ingredients.length ? `<div class="pp-pot-pick">${hv.ingredients.map((x) => `<button class="pp-need-chip pp-pot-add" data-pot="${x.id}" ${(potPick[x.id] || 0) >= x.have || n >= hv.potMax ? "disabled" : ""}
              title="Worth ${x.worth} in a stew"><img alt="" src="${itemIcon(x.id, 16)}">${esc(x.name)} ${potPick[x.id] ? `<b>${potPick[x.id]}</b>/` : ""}${x.have}</button>`).join("")}</div>
            <div class="pp-place-btns"><button class="btn btn-primary" data-home="pot" ${n >= hv.potMin ? "" : "disabled"}>Start the pot (${n})</button>
              ${n ? `<button class="btn btn-quiet" id="pp-pot-clear">Clear</button>` : ""}</div>`
          : `<p class="stamp">Nothing in your bag for a stew -- fruit, vegetables, raw fish or meat.</p>`}`}
      </section>`;
  }
  function diningHTML(hv) {
    return `${secHead("dining", "· sit down to a proper meal")}
      ${hv.fed ? `<p>Well fed (${esc(hv.fed.name.toLowerCase())}): <b>+${Math.round(hv.fed.xp * 100)}% xp</b> for another ${clock(hv.fed.endsIn)}.</p>` : ""}
      <p class="stamp">A meal at the table heals you, cheers your pet, and gives you xp for an hour -- the better the dish, the more (a stew a little extra).
        One meal at a time: a new one takes over.</p>
      ${hv.meals.length ? `<div class="pp-pot-pick">${hv.meals.slice(0, 16).map((x) => `<button class="pp-need-chip" data-dine="${x.id}"><img alt="" src="${itemIcon(x.id, 16)}">${esc(x.name)} ×${x.have} · +${Math.round(x.xp * 100)}%</button>`).join("")}</div>`
        : `<p class="stamp">Nothing cooked in your bag -- the kitchen or the hearth will fix that.</p>`}
      </section>`;
  }
  function archiveHTML(hv) {
    const a = hv.archive;
    return `${secHead("archive", `· ${a.found}/${a.total} torn pages found`)}
      ${a.open ? `<p class="stamp">Torn pages turn up now and then when you explore -- one in each region. Put them back together for what's pressed between them:
          ${a.rewards.map((r) => `${r.got ? "✓ " : ""}${r.at} pages: ${esc(r.what)}`).join(" · ")}.</p>
          <div class="pp-beasts">${a.pages.map((p) => p.found ? `<div class="pp-beast"><b>${esc(p.name)}</b><div class="stamp">${esc(p.text)}</div></div>`
            : `<div class="pp-beast unknown"><b>???</b><div class="stamp">A page from the ${esc(p.name)}</div></div>`).join("")}</div>`
        : a.key ? `<p>The archive key fits the gate.</p><button class="btn btn-primary" data-home="archive">Unlock the archive</button>`
        : `<p class="stamp">Behind the gate, shelves of torn books. The key's said to be with Grizz, in the Deep Forest -- and you've found ${a.found} torn page${a.found === 1 ? "" : "s"} already, exploring.</p>`}
      </section>`;
  }
  function readingHTML(hv) {
    return `${secHead("reading", "· read when you're home and idle")}
      ${hv.reading ? `<p>Reading about ${esc(hv.reading.name.toLowerCase())} -- ${hv.reading.xp} xp in <b>${clock(hv.reading.endsIn)}</b>.</p><button class="btn btn-quiet" data-home="stopread">Put the book down</button>`
        : `
          <div class="pp-place-btns"><select class="input" id="pp-read-skill">${hv.books.map((b) => `<option value="${b.skill}">${esc(b.name)} (+${b.xp} xp)</option>`).join("")}</select>
            <button class="btn btn-primary" id="pp-read-go" ${hv.busy ? "disabled" : ""}>Read (${hv.readMins} min)</button></div>
          ${hv.busy ? `<p class="stamp">${esc(hv.busy)}</p>` : ""}`}
      </section>`;
  }
  function stacksHTML(hv) {
    return `${secHead("stacks", hv.researching ? `· researching ${esc(hv.researching.name.toLowerCase())}${hv.researching.id === "plague" ? "" : " " + hv.researching.level} -- ${clock(hv.researching.endsIn)} left` : "· one project at a time")}
      <div class="pp-area pp-tablet"><div class="pp-skill-head"><b>The plague tablet</b><span class="pp-level">${hv.glyphs.filter((g) => g.have).length}/6 glyphs</span></div>
        <div class="stamp">Six glyphs from the desert and the river. Read together here (${hv.decipherHours} hours), they wake something.${hv.plagues ? ` You've read it ${hv.plagues}×.` : ""}</div>
        <div class="pp-needs">${hv.glyphs.map((g) => `<span class="pp-need-chip${g.have ? "" : " lack"}" data-iteminfo="${g.id}" title="${esc(g.from)}"><img alt="" src="${itemIcon(g.id, 16)}">${esc(g.name)}</span>`).join("")}</div>
        <button class="btn btn-sm ${hv.canDecipher ? "btn-primary" : ""}" data-home="decipher" ${hv.canDecipher ? "" : "disabled"}>Decipher</button></div>
      <div class="pp-areas">${hv.research.map((r) => `<div class="pp-area">
        <div class="pp-skill-head"><b>${esc(r.name)}</b><span class="pp-level">Level ${r.level} of ${r.max}</span></div>
        <div class="stamp">${esc(r.says)}.</div>
        ${r.next ? `<div class="pp-needs"><span class="pp-need-chip${r.next.libraryOk ? "" : " lack"}">${esc(r.next.library)} library</span><span class="pp-need-chip">${coinTxt(r.next.coins)}</span>${r.next.items.map((i) => `<span class="pp-need-chip${i.have >= i.need ? "" : " lack"}" data-iteminfo="${i.id}"><img alt="" src="${itemIcon(i.id, 16)}">${i.have}/${i.need}</span>`).join("")}
            <span class="pp-need-chip">${r.next.hours} h</span></div>
          <button class="btn btn-sm ${r.next.can ? "btn-primary" : ""}" data-research="${r.id}" ${r.next.can ? "" : "disabled"}>Research</button>` : `<div class="stamp">Done.</div>`}
      </div>`).join("")}</div>
      </section>`;
  }
  function observatoryHTML(hv) {
    const st = hv.stars;
    return `${secHead("observatory", `· this week: ${esc(st.name)} (${esc(st.skill)})`)}
      ${st.buff ? `<p>${esc(st.buff.name)} is with you: <b>+10% ${esc(st.buff.skill)} xp</b> until morning.</p>` : ""}
      
      ${st.night ? (st.looked ? `<p class="stamp">You've looked tonight. Come back tomorrow night.</p>` : `<button class="btn btn-primary" data-home="stargaze">Look at the stars</button>`)
        : `<p class="stamp">The sky's too bright -- come back after 9 at night.</p>`}
      </section>`;
  }
  function wireHome(host) {
    const doIt = async (a, o) => { const r = await act(a, Object.assign({roll: Math.random()}, o || {})); if (r && r.error) { status = r.error; toast(r.error, true); render(); } };
    host.querySelectorAll("[data-home]").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.home === "pot") { const items = potPick; potPick = {}; return doIt("pot", {items}); }
      doIt(b.dataset.home);
    }));
    host.querySelectorAll(".pp-pot-add").forEach((b) => b.addEventListener("click", () => { potPick[b.dataset.pot] = (potPick[b.dataset.pot] || 0) + 1; render(); }));
    const pc = host.querySelector("#pp-pot-clear"); if (pc) pc.addEventListener("click", () => { potPick = {}; render(); });
    host.querySelectorAll("[data-dine]").forEach((b) => b.addEventListener("click", () => doIt("dine", {food: b.dataset.dine})));
    host.querySelectorAll("[data-research]").forEach((b) => b.addEventListener("click", () => doIt("research", {id: b.dataset.research})));
    const rg = host.querySelector("#pp-read-go"); if (rg) rg.addEventListener("click", () => doIt("read", {skill: host.querySelector("#pp-read-skill").value}));
  }
  /** A painted place for a hub: a door (page), or one of extra [key, name]. */
  function hubPlace(k, name) {
    if (k.startsWith("sec:")) return secPlace(k.slice(4));
    if (k === "cart") {                                             // the cart: out on the road, or waiting to be loaded
      const {s, now} = current(), cv = Core.cartView(s, now), p = {key: k, name};
      if (!cv.tier) p.note = "Build one";
      else if (cv.out) p.note = `Out · back in ${clock(cv.out.backIn)}`;
      else if (cv.load.length) { p.note = `${cv.load.length} loaded`; p.ready = true; }
      return p;
    }
    if (k === "pet:ranch") {                                        // the Farm (2026-10-12): Fern waiting, eggs ready, hens hungry
      const {s, now} = current(), rv = Core.ranchView(s, now), p = {key: k, name: "The Farm"};
      if (!rv.open) { p.note = rv.fern && rv.fern.quest && rv.fern.quest.can ? "Fern's waiting" : "Overgrown"; p.ready = !!(rv.fern && rv.fern.quest && rv.fern.quest.can); }
      else if (rv.waiting) { p.note = `${rv.waiting} ready`; p.ready = true; }
      else if (rv.hungry) p.note = "Hungry";
      return p;
    }
    if (k === "recycle" || k === "recycled") {                      // the recycle stash: what's breaking down, what's ready to use
      const {s, now} = current(), rv = Core.recycleView(s, now), p = {key: k, name};
      if (k === "recycle" && rv.stash.lots.length) { p.note = rv.stash.lots.some((l) => l.waiting) ? "Store full" : `${rv.stash.lots.length} breaking down`; }
      if (k === "recycled" && (rv.store.used || rv.points >= 1)) { p.note = [rv.store.used ? `${rv.store.used}/${rv.store.cap} kinds` : "", rv.points >= 1 ? `♻ ${Math.floor(rv.points)}` : ""].filter(Boolean).join(" · "); p.ready = rv.store.used >= rv.store.cap; }
      return p;
    }
    return {key: k, name: name || doorOf(k)[0]};
  }
  /** A click on a hub's painted place: a page, a room (scroll to it), the materials list, or what's to come. */
  function hubGo(host, key) {
    if (key === "pet:spellbook") return openBook("arcane", "spells");  // a pop-up in the Library: the Arcane's book, at its spells (C4 D5)
    if (key.startsWith("pet:")) return goTo(key);
    if (key === "room:storeroom") return showStore();                  // the Bank, straight away (Modernize/Reduce Nav: one click, not two)
    if (key.startsWith("sec:") || key.startsWith("room:") || key === "materials" || key === "recycle" || key === "recycled" || key === "cart") return openPlace(key);
  }
  /** A door: what a page is called, its picture and a line about it now. */
  function doorOf(key) {
    const {s, v, now} = current(), pl = s.player || {};
    const pic = v.has && v.stage !== "egg" ? petURL(v.species, v.colour, 48, "ok", v.skin) : itemIcon("starteregg", 48);
    const D = {
      "pet:estate": ["Your estate", itemIcon("obj_house", 48), "House, workshop, library, storeroom, graveyard"],
      "pet:nursery": ["The Nursery", itemIcon("commonegg", 48), (() => { const n = Core.hatcheryView(s, now).eggs.length; return n ? `Hatching and breeding · ${n} egg${n === 1 ? "" : "s"}` : "Hatching and breeding"; })()],
      "pet:house": ["House", itemIcon("obj_house", 48), "Your pet, your bag and you"],
      "pet:workshop": ["Workshop", itemIcon("obj_anvil", 48), "Every bench: cooking, smithing, crafting and more"],
      "pet:library": ["Library", itemIcon("tomekeen", 48), "Spellbook, enchants, Herbarium, Bestiary, Petapedia"],
      "pet:storeroom": ["Storeroom", itemIcon("woodcrate", 48), "The bank and the recycle stash"],
      "pet:graveyard": ["Graveyard", itemIcon("bones", 48), "The pets lost on expeditions"],
      "pet:pen": ["Beast Pen", itemIcon("grainfeed", 48), "Battle pets: stalls, training and rest"],
      "pet:ranch": ["The Farm", itemIcon("obj_ranch", 48), Core.ranchOpen(s) ? "Your hens, the Feed store and Fern's stall" : "An overgrown track -- Fern has an idea"],
      "pet:home": [v.has && v.name ? v.name : "My pet", pic, v.has ? (v.need || "Feed, play and keep clean") : "Choose an egg"],
      "pet:pets": ["Pets", pic, "Your companion and the den"],
      "pet:bag": ["Bag", itemIcon("willowbasket", 48), `${Core.bagUsed(s)}/${Core.bagCap(s)} slots`],
      "pet:skills": ["Character", youURL(pl.look), `Total level ${Core.playerView(s, now).totalLevel}`],
      "pet:expeditions": ["Expeditions", itemIcon("woodcrate", 48), v.away ? `${v.name} is away: ${v.away.areaName}` : "Send your pet exploring"],
      "pet:spellbook": ["Spellbook", itemIcon("tomearcanist", 48), "Spells, runes and your three for a fight"],
      "pet:enchants": ["Enchant book", itemIcon("tomeflaming", 48), "The enchants you've learnt"],
      "pet:herbarium": ["Herbarium", itemIcon("herb", 48), "Every herb you've identified"],
      "pet:bestiary": ["Bestiary", itemIcon("batwing", 48), "Every creature you and your pets have met"],
      "pet:dex": ["Petapedia", itemIcon("clover", 48), "Every pet on the isle"],
      "pet:gear": ["Equipment", itemIcon("bronzehelm", 48), "What you and your pet wear"],
      "pet:hatchery": ["Hatchery", itemIcon("commonegg", 48), (() => { const n = Core.hatcheryView(s, now).eggs.length; return n ? `${n} egg${n === 1 ? "" : "s"} keeping warm` : "Eggs hatch here"; })()],
      "pet:breed": ["Breeding", itemIcon("heart", 48), "Two pets, an hour together, an egg"]};
    return D[key] || [key, itemIcon("obj_map", 48), ""];
  }
  function doorsHTML(keys) {
    return `<div class="pp-village pp-places">${keys.map((k) => { const [name, pic, line] = doorOf(k);
      return `<button class="pp-villager pp-place-card pp-door" data-door="${k}"><img alt="" src="${pic}"><b>${esc(name)}</b><span class="stamp pp-place-line">${esc(line)}</span></button>`; }).join("")}</div>`;
  }
  // ---- Home (2026-10-08, Cam: "start at home when the game first loads, which will have the today features, also it
  //      should have a collapsed menu that shows all unlocked materials and where to get them") -------------------------
  let materialsOpen = false, materialsQuery = "";
  /** Every material you can gather now (open region, spot not locked), by skill, and where. */
  function materialsList() {
    const {s, now} = current(), bySkill = {};
    Core.REGION_ORDER.forEach((r) => {
      const lv = Core.landView(s, r, now);
      if (!lv || !lv.open) return;
      lv.spots.forEach((sp) => {
        if (sp.lock) return;
        const def = Core.SKILLS[sp.skill].spots.find((x) => x.id === sp.id);
        const items = bySkill[sp.skill] = bySkill[sp.skill] || {};
        ((def && def.loot) || []).forEach((l) => { const id = l[0];
          if (!Core.ITEMS[id]) return;
          (items[id] = items[id] || []).push({region: r, regionName: lv.name, spot: sp.name, skill: sp.skill, spotId: sp.id}); });
      });
    });
    return Core.GATHERING.filter((k) => bySkill[k]).map((k) => ({skill: k, name: Core.SKILLS[k].name,
      items: Object.keys(bySkill[k]).map((id) => ({id, name: Core.ITEMS[id].name, where: bySkill[k][id]})).sort((a, b) => a.name.localeCompare(b.name))}));
  }
  function materialsHTML(inSheet) {
    const list = materialsList(), n = new Set([].concat(...list.map((g) => g.items.map((x) => x.id)))).size;
    return `<details class="pp-shop pp-materials" id="pp-materials"${materialsOpen || inSheet ? " open" : ""}>
      <summary><b>Materials you can gather</b> <span class="stamp">${n} kinds — and where</span></summary>
      <input class="input" id="pp-mat-q" type="search" placeholder="Find a material…" value="${esc(materialsQuery)}" aria-label="Find a material">
      ${list.map((g) => `<div class="pp-mat-group"><div class="pp-label">${esc(g.name)}</div>
        ${g.items.map((x) => `<div class="pp-mat-row" data-name="${esc(x.name.toLowerCase())}"><img alt="" src="${itemIcon(x.id, 24)}" data-iteminfo="${x.id}"><b data-iteminfo="${x.id}">${esc(x.name)}</b>
          <span class="pp-mat-where">${x.where.map((w) => `<button class="pp-need-chip" data-region-go="${w.region}" data-skill="${w.skill}" data-spot="${w.spotId}" title="Go there and gather">${esc(w.regionName)} · ${esc(w.spot)}</button>`).join("")}</span></div>`).join("")}</div>`).join("")}
    </details>`;
  }
  /** Go to a region and start gathering at one of its spots (already there: just go). */
  async function gatherAt(region, skill, spot) {
    closeSec();
    const {s} = current(), j = s.player && s.player.job;
    worldRegion = region;
    if (!(j && !j.hunt && j.spot === spot && j.skill === skill)) {
      const r = await act("trip", {skill, spot, roll: Math.random()});
      if (r && r.error) toast(r.error, true);
    }
    goTo("pet:world");
  }
  function wireMaterials(host) {
    const d = host.querySelector("#pp-materials");
    if (!d) return;
    d.addEventListener("toggle", () => { materialsOpen = d.open; });
    const q = d.querySelector("#pp-mat-q");
    const filter = () => { const t = materialsQuery.trim().toLowerCase();
      d.querySelectorAll(".pp-mat-group").forEach((g) => { let any = false;
        g.querySelectorAll(".pp-mat-row").forEach((r) => { r.hidden = !!t && !r.dataset.name.includes(t); any = any || !r.hidden; });
        g.hidden = !any; }); };
    q.addEventListener("input", () => { materialsQuery = q.value; filter(); });
    filter();
    // one click: off you go, gathering there (Cam, 2026-10-08: "when i click it once it just goes there and starts gathering")
    d.querySelectorAll("[data-region-go]").forEach((b) => b.addEventListener("click", () => gatherAt(b.dataset.regionGo, b.dataset.skill, b.dataset.spot)));
  }
  function renderHub(host, page) {
    const h = HUBS[page];
    const places = h.doors.map((k) => hubPlace(k)).concat((h.extra || []).map(([k, name]) => hubPlace(k, name)));
    if (page === "pet:house") {
      renderDash(host, "");                                        // Home: the house, then Today -- each place opens on its own
      const dash = host.querySelector(".pp-dash");
      if (dash) dash.insertAdjacentHTML("afterbegin", paintedHTML("house", places));
      wirePainted(host, (k) => hubGo(host, k));
      showSec();
      return;
    }
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${h.scene ? paintedHTML(h.scene, places) : ""}
        
        ${h.scene ? "" : doorsHTML(h.doors)}
        ${h.room && !h.scene ? roomsHTML((r) => r.id === h.room) : ""}
      </div>`;
    host.querySelectorAll("[data-door]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.door)));
    wirePainted(host, (k) => hubGo(host, k));
    if (h.room && !h.scene) wireRooms(host);
    showSec();
  }
  // a merchant (2026-10-20: the crafting bench's look -- Buy and Sell tabs, a grid, the one you picked with an amount)
  function tradeHTML(w) {
    const buy = w.stock.map((x) => ({key: "b:" + x.id, icon: itemIcon(x.id, 48), name: x.name, find: x.name + " " + (x.does || ""), badge: x.have || "", can: x.can, x}));
    const sell = w.sell.map((x) => ({key: "s:" + x.id, icon: itemIcon(x.id, 48), name: x.name, badge: x.spare.toLocaleString(), can: !x.bound && x.spare >= x.one, lock: !!x.bound, lockWord: "kept", x}));
    const bagLine = w.bag ? `<p class="stamp${w.bag.used > w.bag.cap ? " pp-over" : ""}">Your bag: ${w.bag.used}/${w.bag.cap} slots${w.bag.used >= w.bag.cap ? " — full: sell what you can spare to make room" : ""}.</p>` : "";
    return bagLine + gridBenchHTML("trade:" + w.id, [
      {id: "buy", label: w.id === "travelling" ? "Zeph has" : "Buy", items: buy, empty: "Nothing for sale today."},
      {id: "sell", label: w.trade > 1 ? "Sell (half as much again)" : "Sell", items: sell, empty: "Nothing spare to sell."}], (it, tab) => {
      const x = it.x;
      if (tab === "buy") {
        const max = Core.ITEMS[x.id].bagSize ? (x.can ? 1 : 0) : x.can ? Math.max(1, Math.min(50, Math.floor((w.coins || 0) / Math.max(1, x.price)))) : 0;
        return gbHead(itemIcon(x.id, 64), esc(x.name), [`${coinTxt(x.price)} each`, x.have ? `${x.have} in your bag` : ""])
          + `<p class="stamp">${esc(x.does || "")}</p>${max > 1 ? gbAmountHTML("buy:" + w.id + x.id, max, 1) : ""}
          <p class="stamp pp-bget">${max ? `Cost: <b data-gbeach="${x.price}" data-gbunit="coin">${coinTxt(x.price * Math.min(max, +(gbAmt["buy:" + w.id + x.id] || 1)))}</b>` : (w.coins || 0) < x.price ? "Not enough coins." : "Your bag has no room for it."}</p>
          <button class="btn btn-primary pp-bmake pp-buy" data-item="${x.id}" data-amt="1" ${max ? "" : "disabled"}>BUY</button>`;
      }
      if (x.bound) return gbHead(itemIcon(x.id, 64), esc(x.name), [`${x.spare} spare`]) + `<p class="stamp">A mastery's keepsake -- it can't be sold.</p>`;
      const max = x.spare;
      return gbHead(itemIcon(x.id, 64), esc(x.name), [eachTxt(x.each), `${x.spare.toLocaleString()} spare`])
        + (max > 1 ? gbAmountHTML("sell:" + w.id + x.id, max, max) : "")
        + `<p class="stamp pp-bget">You get about <b data-gbeach="${x.each}" data-gbunit="coin">${coinTxt(Math.floor(x.each * Math.min(max, +(gbAmt["sell:" + w.id + x.id] || max))))}</b></p>
        <div class="pp-row"><button class="btn btn-primary pp-bmake pp-sell" data-item="${x.id}" data-n="amt" ${x.spare >= x.one ? "" : "disabled"}>SELL</button>
          ${x.spare > 1 && x.all >= 1 ? `<button class="btn pp-sell" data-item="${x.id}" data-n="all">All · ${coinTxt(x.all)}</button>` : ""}</div>`;
    });
  }
  // the reskinner's paint: a pet, a colour, click a part of it
  let reskin = {id: "", paint: {}, colour: "#e0789e"};
  const PAINT = ["#f2b46d", "#fbe3c0", "#b9b6c9", "#f6c6d0", "#9ad07a", "#b9a3e3", "#6fa8dc", "#e0789e", "#c0392b", "#f2c43c",
                 "#2f7d4f", "#2a5ad8", "#7d4fa8", "#8d6e63", "#ffffff", "#1f2430"];
  function reskinPets() {
    const {s, now} = current();
    return Core.petsView(s, now).filter((p) => !p.egg);
  }
  function paintPal(p) { return Art.palette(p.species, p.colour, Object.assign({}, p.skin || {}, reskin.paint)); }
  function reskinHTML(w) {
    const pets = reskinPets();
    if (!pets.length) return `<p class="stamp">You've no pet to recolour yet.</p>`;
    if (!pets.some((p) => p.id === reskin.id)) { reskin.id = pets[0].id; reskin.paint = {}; }
    const p = pets.find((x) => x.id === reskin.id);
    return `<div class="pp-row"><select class="input" id="pp-rs-pet">${pets.map((q) => `<option value="${q.id}" ${q.id === p.id ? "selected" : ""}>${esc(q.name)}</option>`).join("")}</select></div>
      <div class="pp-reskin">
        <canvas id="pp-rs-canvas" width="160" height="160" title="Click a part of your pet to paint it"></canvas>
        <div class="pp-reskin-side">
          <div class="pp-label">Paint (click a part of your pet)</div>
          <div class="pp-rs-colours">${PAINT.map((c) => `<button class="pp-rs-sw${c === reskin.colour ? " on" : ""}" data-col="${c}" style="background:${c}"></button>`).join("")}
            <input type="color" id="pp-rs-custom" value="${reskin.colour}" title="Any colour"></div>
          <div class="pp-row"><button class="btn btn-sm" id="pp-rs-apply" ${Object.keys(reskin.paint).length && w.coins >= w.cost ? "" : "disabled"}>Keep these colours · ${coinTxt(w.cost)}</button>
            <button class="btn btn-sm btn-quiet" id="pp-rs-undo">Start again</button>
            ${p.skin ? `<button class="btn btn-sm btn-quiet" id="pp-rs-reset">Its own colours (free)</button>` : ""}</div>
        </div>
      </div>
      <div class="pp-label">Exotic skins</div>
      <div class="pp-rs-presets">${w.presets.map((x) => `<div class="pp-rs-preset"><img alt="" src="${petURL(p.species, p.colour, 64, "ok", x.pal)}">
        <b>${esc(x.name)}</b><button class="btn btn-sm pp-rs-buy" data-preset="${x.id}" ${x.can ? "" : "disabled"}>${coinTxt(x.cost)}</button></div>`).join("")}</div>`;
  }
  function wireReskin(card, w) {
    const pets = reskinPets(), p = pets.find((x) => x.id === reskin.id);
    if (!p) return;
    const cv = card.querySelector("#pp-rs-canvas"), rows = Art.frame(p.species, "ok"), SC = 10;
    const paint = () => { const ctx = cv.getContext("2d"); ctx.clearRect(0, 0, 160, 160); Art.draw(ctx, rows, paintPal(p), 0, 0, SC, false); };
    paint();
    cv.addEventListener("click", (e) => {
      const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / (r.width / 16)), y = Math.floor((e.clientY - r.top) / (r.height / 16));
      const ch = (rows[y] || "").charAt(x);
      if (!ch || ch === ".") return;
      reskin.paint[ch] = reskin.colour;          // the whole part: every pixel of that colour, in every pose
      showShop();
    });
    card.querySelector("#pp-rs-pet").addEventListener("change", (e) => { reskin.id = e.target.value; reskin.paint = {}; showShop(); });
    card.querySelectorAll(".pp-rs-sw").forEach((b) => b.addEventListener("click", () => { reskin.colour = b.dataset.col; showShop(); }));
    card.querySelector("#pp-rs-custom").addEventListener("change", (e) => { reskin.colour = e.target.value; showShop(); });
    card.querySelector("#pp-rs-undo").addEventListener("click", () => { reskin.paint = {}; showShop(); });
    const done = async (opts) => { const r = await act("reskin", Object.assign({id: p.id}, opts)); if (r && r.error) { status = r.error; toast(r.error, true); } else reskin.paint = {}; showShop(); };
    card.querySelector("#pp-rs-apply").addEventListener("click", () => done({skin: Object.assign({}, p.skin || {}, reskin.paint)}));
    const rs = card.querySelector("#pp-rs-reset");
    if (rs) rs.addEventListener("click", () => done({reset: true}));
    card.querySelectorAll(".pp-rs-buy").forEach((b) => b.addEventListener("click", () => done({preset: b.dataset.preset})));
  }
  function showShop() {
    let box = document.querySelector(".pp-modal.pp-shop-modal");
    const {s, now} = current();
    const w = Core.villageView(s, now).find((x) => x.id === openShop);
    if (!w) { if (box) box.remove(); openShop = ""; return; }
    if (!box) {
      box = document.createElement("div");
      box.className = "pp-modal pp-shop-modal";
      box.innerHTML = `<div class="pp-modal-card pp-shop-card" role="dialog"></div>`;
      document.body.appendChild(box);
      box.addEventListener("click", (e) => { if (e.target === box) closeShop(); });
      box.addEventListener("keydown", (e) => { if (e.key === "Escape") closeShop(); });
    }
    const card = box.querySelector(".pp-shop-card");
    const keep = card.querySelector(".pp-shop-list") ? card.querySelector(".pp-shop-list").scrollTop : 0;
    // a search box on a bench (2026-10-10, Cam: "search feature on craft tables to be able to find recipes faster"):
    // by name, what it does, or what goes into it ("oak" finds everything made with oak); kept for each bench while you craft
    if (shopQueryFor !== w.id) { shopQuery = ""; shopQueryFor = w.id; }
    const gridded = !!(w.grind || w.trade || w.identify || w.orders || w.altar);   // (2026-10-20: the crafting bench's look, every one but the reskinner's paint)
    const searchable = !w.reskin && !gridded && w.recipes.length > 3 && !benchPlain(w);   // (the new bench has its own search)
    box.classList.toggle("pp-bench-modal", benchPlain(w) || gridded);
    const hadFocus = document.activeElement && document.activeElement.id === "pp-shop-q";
    card.innerHTML = `<button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
      ${shopHeadHTML(w)}
      ${w.id === "cryptmerchant" ? `<button class="btn btn-sm btn-quiet" data-talk="hobb">Ask about life essence</button>` : ""}
      ${searchable ? `<input class="input pp-shop-q" id="pp-shop-q" type="search" placeholder="Find a recipe, or an ingredient…" value="${esc(shopQuery)}" aria-label="Find a recipe">` : ""}
      <p class="pp-status" id="pp-shop-status">${esc(status)}</p>
      <div class="pp-shop-list">${w.grind ? grindHTML(w) : w.trade ? tradeHTML(w) : w.reskin ? reskinHTML(w) : w.identify ? identifyHTML(w) : w.orders ? ordersHTML(w) : w.altar ? altarHTML(w) : benchPlain(w) ? benchHTML(w) : shopRecipesHTML(w)}</div>`;
    const list = card.querySelector(".pp-shop-list"), sq = card.querySelector("#pp-shop-q");
    card.querySelectorAll("[data-talk]").forEach((b) => b.addEventListener("click", () => talkPopup(b.dataset.talk)));
    if (w.id === "cryptmerchant") setTimeout(() => talkPopup("hobb", true), 200);   // (PT20 c6: "maybe [Sexton] can explain again")
    const findRecipes = () => {
      const words = shopQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      list.querySelectorAll(".pp-recipe[data-find]").forEach((r) => { r.hidden = words.length > 0 && !words.every((x) => r.dataset.find.includes(x)); if (!r.hidden) shown++; });
      let none = list.querySelector(".pp-shop-none");
      if (!none) { none = document.createElement("p"); none.className = "stamp pp-shop-none"; list.appendChild(none); }
      none.textContent = `Nothing here matches “${shopQuery.trim()}”.`;
      none.hidden = !words.length || shown > 0;
    };
    if (sq) {
      findRecipes();
      sq.addEventListener("input", () => { shopQuery = sq.value; findRecipes(); list.scrollTop = 0; });
      sq.addEventListener("keydown", (e) => { if (e.key === "Escape" && sq.value) { e.stopPropagation(); sq.value = shopQuery = ""; findRecipes(); } });
      if (hadFocus) { sq.focus(); sq.setSelectionRange(sq.value.length, sq.value.length); }
    }
    list.scrollTop = keep;
    card.querySelector(".pp-shop-x").addEventListener("click", closeShop);
    const run = async (a, o) => { const r = await act(a, o); if (r && r.error) { status = r.error; toast(r.error, true); } showShop(); };
    // "Cook all" / "All" (2026-10-14) asks for as many as there's enough for
    if (benchPlain(w) || (w.altar && altarTab === "gems" && w.recipes.length)) benchWire(card, w, run, showShop);   // the redesigned bench (2026-10-19, Q6)
    card.querySelectorAll(".pp-gbench").forEach((g) => gridBenchWire(card, g.dataset.gb, showShop));    // ... and the rest in its look (2026-10-20)
    card.querySelectorAll("[data-altartab]").forEach((b) => b.addEventListener("click", () => { altarTab = b.dataset.altartab; showShop(); }));
    card.querySelectorAll(".pp-make").forEach((b) => b.addEventListener("click", async () => {
      let times = b.dataset.times;
      if (times === "ask") {                                              // V7: the amount picker -- how many to make
        const xp = +b.dataset.xp || 0, nm = b.dataset.name.toLowerCase();
        times = await askCount(`${nm} to ${w.skill === "cooking" ? "cook" : "make"}`, +b.dataset.max, {ok: w.skill === "cooking" ? "Cook" : "Make",
          preview: (n) => `<b>${n.toLocaleString()} × ${esc(nm)}</b>${xp ? ` · about +${Math.round(n * xp).toLocaleString()} xp` : ""}`});
        if (!times) return;
      }
      run("craft", {workshop: b.dataset.ws, make: b.dataset.make, i: +b.dataset.i, ...(times ? {times} : {})});
    }));
    card.querySelectorAll(".pp-identify").forEach((b) => b.addEventListener("click", () => run("identify", {all: !!b.dataset.all, roll: Math.random()})));
    card.querySelectorAll(".pp-grind").forEach((b) => b.addEventListener("click", () => run("retemper", {item: b.dataset.item})));
    card.querySelectorAll(".pp-order").forEach((b) => b.addEventListener("click", () => run("order", {i: +b.dataset.i})));
    card.querySelectorAll(".pp-enchant").forEach((b) => b.addEventListener("click", () => {
      const sel = card.querySelector(`select[data-ench="${b.dataset.ench}"]`);   // (the picked enchant's target)
      if (sel && sel.value) run("enchant", {enchant: b.dataset.ench, item: sel.value});
    }));
    card.querySelectorAll(".pp-buy").forEach((b) => b.addEventListener("click", () => run("buy", {item: b.dataset.item, from: w.id, n: b.dataset.amt ? gbAmount(b) : 1})));
    card.querySelectorAll(".pp-sell").forEach((b) => b.addEventListener("click", async () => {
      let n = b.dataset.n === "all" ? "all" : b.dataset.n === "amt" ? gbAmount(b) : +b.dataset.n || 1;
      if (b.dataset.n === "ask") {                                        // V7: the amount picker -- how many to sell, and for what
        const each = +b.dataset.each || 0;
        n = await askCount(b.dataset.name.toLowerCase() + " to sell", +b.dataset.max, {ok: "Sell", preview: (k) => `<b>${k.toLocaleString()} sold</b> · about ${coinTxt(Math.floor(k * each))}`});
        if (!n) return;
      }
      run("sell", {item: b.dataset.item, n, to: w.id});
    }));
    if (w.reskin) wireReskin(card, w);
  }
