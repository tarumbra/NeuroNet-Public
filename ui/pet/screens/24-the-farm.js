  // ---- the Farm (2026-10-12): Fern and her quest, then Cam's painting of the Farm with a scroll for every place, and below it
  //      a card for each building, the Feed store, and Fern's stall (with Saturday's farmers' market). Animals walk about on the
  //      painting (step 9): each building's own, in its yard.
  const RANCH_WALK = {coop: [[90, 470], [290, 470], 55], pond: [[60, 1062], [300, 1062], 52], barn: [[790, 492], [990, 492], 120],
                      shearing: [[1580, 470], [1760, 470], 92], sty: [[700, 768], [900, 768], 92], stable: [[1330, 345], [1640, 345], 115]};   // the horse field (the lower paddock is the Show ring now)
  const WALK_SIZE = {hen: 1, duck: 1, cow: 1, goat: 0.78, sheep: 1, pig: 1, pony: 0.88, drafthorse: 1.08};
  function ranchWalkers(rv) {
    const out = [];
    rv.buildings.forEach((b) => {
      const z = RANCH_WALK[b.id];
      if (!z || !b.tier) return;
      b.animals.slice(0, 3).forEach((a, i) => {
        const size = Math.round(z[2] * (WALK_SIZE[a.kind] || 1) * (a.young ? 0.6 : 1));
        const span = z[1][0] - z[0][0] - size, x = z[0][0] + Math.round(span * ((i * 0.37 + 0.1) % 0.6)), y = z[0][1] - size + i * 6;
        const pics = (window.LIVESTOCK_PICS || {})[a.art] || {}, pose = pics.walk ? "walk" : "a";
        if (!pics[pose]) return;
        out.push(`<g class="pp-walker" style="--d:${Math.max(30, Math.round(span * 0.4))}px;animation-duration:${14 + i * 5}s;animation-delay:-${i * 4}s">
          <image href="art/livestock/${a.art.replace("/", "-")}-${pose}.webp" x="${x}" y="${y}" width="${size}" height="${size}"/></g>`);
      });
    });
    return out.length ? `<g class="pp-walkers" aria-hidden="true">${out.join("")}</g>` : "";
  }
  /** The painting's places, with what's going on at each. */
  function ranchPlaces(rv) {
    const place = (b) => !b.tier ? (b.lock ? {key: b.id, name: b.name, lock: `opens at ${b.lock}`, lockShort: b.lock} : {key: b.id, name: b.name, note: "Build it", ready: !!(b.next && b.next.can)})
      : b.show ? {key: b.id, name: b.name, note: b.show.done ? "" : b.show.entrants.length ? "A show today" : "", ready: !b.show.done && !!b.show.entrants.length}
      : b.make && !b.kinds.length ? {key: b.id, name: b.name, note: b.make.some((m) => m.times) ? (b.id === "mill" ? "Ready to grind" : "Ready to churn") : ""}
      : b.slots ? {key: b.id, name: b.name, note: b.waiting ? `${b.waiting} ready` : b.slots.length ? `${b.slots.length} setting` : "Empty shelves", ready: !!b.waiting}
      : b.pairs ? {key: b.id, name: b.name, note: b.pairs.length ? `${b.pairs.length} pair${b.pairs.length === 1 ? "" : "s"} out` : rv.pairable.length ? "A pair to put out" : ""}
      : {key: b.id, name: b.name, note: b.waiting ? `${b.waiting} ready` : b.hungry ? "Hungry" : !b.animals.length ? "Empty" : b.clean ? "" : "Needs mucking out", ready: !!b.waiting || !!b.hungry};
    return rv.buildings.map(place).concat([
      {key: "feed", name: "Feed store", note: `${rv.feed} feed · ${rv.hay} hay`},
      {key: "stall", name: "Fern's stall", note: rv.market.open ? "Market day!" : rv.fern && rv.fern.quest && rv.fern.quest.can ? "Fern has an errand" : "", ready: rv.market.open},
      {key: "pet:estate", name: "Back to your estate"}]);
  }
  let ranchPick = {kind: "", a: "", b: ""};
  function renderRanch(host) {
    const {s, now} = current(), rv = Core.ranchView(s, now);
    const away = rv.here ? "" : "The Farm's back home on your estate -- you can't tend it from here.";
    const needChip = (n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}" data-iteminfo="${n.id}"><img alt="" src="${itemIcon(n.id, 16)}">${esc(n.name)} ${Math.min(n.have, 999)}/${n.need}</span>`;
    const stars = (n) => n ? ` <span class="pp-rarity r-rare" title="Bred for yield: a little more, more often">${"★".repeat(n)}</span>` : "";
    const animalRow = (a) => `<div class="pp-recipe pp-ranch-animal${a.hungry ? " short" : ""}"><img alt="" src="${livestockURL(a.art, a.pic, 32)}"${a.hungry ? ` class="pp-hungry"` : ""}>
        <div class="pp-recipe-main"><div><b>${esc(a.name)}</b> <span class="stamp">${a.young ? "young " : ""}${esc(a.kindName.toLowerCase())}${a.breed ? ` · ${esc(a.breed)}` : ""}</span>${stars(a.stars)}</div>
          <div class="stamp">${a.young ? `Growing up -- ${clock(a.young)} to go` : a.pairing ? "Out in the Paddock" : a.hungry ? "Hungry -- feed and it'll give again"
            : a.free ? (a.full ? "Busy among the flowers · full up -- collect what's waiting" : `Busy among the flowers · more in ${clock(a.nextIn)}`)
            : a.full ? `Fed for ${clock(a.fedFor)} · full up -- collect what's waiting` : `Fed for ${clock(a.fedFor)} · more in ${clock(a.nextIn)}`}${a.wins ? ` · ${a.wins} first${a.wins === 1 ? "" : "s"} in the ring` : ""}</div></div>
        <button class="btn btn-sm btn-quiet" data-ranch-sell="${a.id}" data-name="${esc(a.name)}" title="Fern takes it back for ${a.sell} coins" ${a.pairing ? "disabled" : ""}>Sell · ${coinTxt(a.sell)}</button></div>`;
    const buildCard = (b) => b.next ? `<div class="pp-area"><div class="pp-skill-head"><b>${b.tier ? `Build it ${esc(b.next.name.toLowerCase())}` : `Build the ${esc(b.name.toLowerCase())}`}</b><span class="pp-level">${
            b.next.slots ? `${b.next.cap} ${({glass: "beds", smoke: "racks"})[b.id] || "shelves"} · ` : b.next.pairs ? `room for ${b.next.cap} pair${b.next.cap === 1 ? "" : "s"} · ` : b.next.cap ? `room for ${b.next.cap} · a round every ${b.next.hours} h · ` : ""}+${b.next.xp} Construction xp</span></div>
            <div class="pp-needs"><span class="pp-need-chip${rv.hus >= b.next.hus ? "" : " lack"}">Husbandry ${b.next.hus}</span><span class="pp-need-chip${(Core.levelOf(s.player.skills.construction || 0)) >= b.next.con ? "" : " lack"}">Construction ${b.next.con}</span>
              <span class="pp-need-chip${(s.coins || 0) >= b.next.coins ? "" : " lack"}">${coinTxt(b.next.coins)}</span>${b.next.needs.map(needChip).join("")}</div>
            <button class="btn btn-sm ${b.next.can ? "btn-primary" : ""}" data-ranch="ranchbuild" data-b="${b.id}" ${b.next.can && !away ? "" : "disabled"}>Build</button></div>` : "";
    const head = (b, right) => `<div class="pp-skill-head"><b>${esc(b.name)}</b><span class="pp-level">${right}</span></div>`;
    const unbuiltHTML = (b) => `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">${head(b, b.lock ? `🔒 ${esc(b.lock)}` : "Not built")}${b.lock ? "" : buildCard(b)}</section>`;
    const BENCH = {dairy: ["the butter churn", "Churn"], hives: ["the candle bench", "Make"], mill: ["the millstones", "Grind"]};   // the Farm's benches
    // the Farm's benches, lists and stall in the crafting bench's look (2026-10-20): a grid, the one you picked, an amount, the button
    const reqs = (m) => m.needs.map((n) => gbMat(n.id, `${esc(n.name)} ${Math.min(n.have, 999)}/${n.need}`, n.have >= n.need)).join("");
    const makeDetail = (m, verb, attrs) => gbHead(itemIcon(m.make, 64), `${m.n} × ${esc(m.name)}`, [m.times ? `enough for ${m.times}` : ""])
      + `<div class="pp-label">Materials</div>${reqs(m)}${m.times > 1 ? gbAmountHTML(attrs + m.i, Math.min(50, m.times), Math.min(50, m.times)) : ""}
      <button class="btn btn-primary pp-bmake" ${attrs}="${m.i}" data-times="amt" ${m.times && !away ? "" : "disabled"}>${verb.toUpperCase()}</button>`;
    const benchList = (b) => gridBenchHTML("ranch:" + b.id, [{id: "make", label: BENCH[b.id][0], items: (b.make || []).map((m) => ({key: String(m.i), icon: itemIcon(m.make, 48), name: `${m.n} × ${m.name}`, badge: m.times || "", can: !!m.times, m}))}],
      (it) => makeDetail(it.m, BENCH[b.id][1], `data-b="${b.id}" data-ranch-churn`));
    const churnHTML = (b) => `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">${head(b, BENCH[b.id][0])}${benchList(b)}</section>`;
    const showHTML = (b) => `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">${head(b, b.show.done ? `next show in ${clock(b.show.nextIn)}` : "a show today")}
        ${b.show.shows ? `<p class="stamp">${b.show.shows} show${b.show.shows === 1 ? "" : "s"}, ${b.show.firsts} first${b.show.firsts === 1 ? "" : "s"}</p>` : ""}
        ${b.show.entrants.length ? b.show.entrants.map((a) => `<div class="pp-recipe${b.show.done ? " short" : ""}"><img alt="" src="${livestockURL(a.art, a.pic, 32)}">
          <div class="pp-recipe-main"><div><b>${esc(a.name)}</b> <span class="stamp">${esc(a.kindName.toLowerCase())}${a.champion ? " · champion" : a.wins ? ` · ${a.wins} first${a.wins === 1 ? "" : "s"}` : ""}</span></div>
            <div class="stamp">The judges' eye: ${a.score} · about ${a.odds}% for first</div></div>
          <button class="btn btn-sm" data-ranch-show="${a.id}" ${b.show.done || away ? "disabled" : ""}>Show</button></div>`).join("")
          : `<p class="stamp">Nobody to show yet: a grown animal, not out in the Paddock.</p>`}</section>`;
    const SHELF = {culture: ["Set it", "shelves"], glass: ["Plant", "beds"], smoke: ["Hang it", "racks"]};
    const cultureHTML = (b) => `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">${head(b, `${esc(b.tierName)} · ${b.slots.length}/${b.cap} ${SHELF[b.id][1]}`)}
        ${b.slots.length ? `<div class="pp-needs">${b.slots.map((x) => `<span class="pp-need-chip"><img alt="" src="${itemIcon(x.make, 16)}">${x.n} × ${esc(x.name)} · ${x.done ? "ready" : clock(x.endsIn)}</span>`).join("")}</div>` : ""}
        <div class="pp-place-btns"><button class="btn ${b.waiting ? "btn-primary" : ""}" data-ranch="ranchcollect" data-b="${b.id}" ${b.waiting && !away ? "" : "disabled"}>${b.waiting ? `Take ${b.waiting} ready` : "Nothing ready yet"}</button></div>
        ${gridBenchHTML("ranch:" + b.id, [{id: "rec", label: "What to " + SHELF[b.id][0].toLowerCase(), items: b.recipes.map((m) => ({key: String(m.i), icon: itemIcon(m.make, 48), name: `${m.n} × ${m.name}`, corner: m.hours + "h", lock: !!m.lock, can: m.can && b.free, m}))}], (it) => { const m = it.m;
          return gbHead(itemIcon(m.make, 64), `${m.n} × ${esc(m.name)}`, [`${m.hours} hours`, m.lock ? "🔒 " + esc(m.lock) : "", b.free ? "" : `no free ${SHELF[b.id][1].replace(/s$/, "")}`])
            + `<div class="pp-label">It takes</div>${reqs(m)}<button class="btn btn-primary pp-bmake" data-ranch-culture="${m.i}" data-b="${b.id}" ${m.can && b.free && !away ? "" : "disabled"}>${SHELF[b.id][0].toUpperCase()}</button>`; })}
        ${buildCard(b)}</section>`;
    const paddockHTML = (b) => {
      const grp = rv.pairable.find((g) => g.kind === ranchPick.kind) || rv.pairable[0];
      if (grp && ranchPick.kind !== grp.kind) ranchPick = {kind: grp.kind, a: "", b: ""};
      const opt = (sel) => grp.animals.map((a) => `<option value="${a.id}" ${sel === a.id ? "selected" : ""}>${esc(a.name)}${a.stars ? " " + "★".repeat(a.stars) : ""}</option>`).join("");
      return `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">${head(b, `${esc(b.tierName)} · ${b.pairs.length}/${b.cap} pairs`)}
        ${b.pairs.map((p) => `<p>${esc(p.names.join(" and "))} (${esc(p.kindName.toLowerCase())}s) -- ${p.waiting ? "the young one's waiting for room at home" : `a young one in ${clock(p.endsIn)}`}.</p>`).join("")}
        
        ${b.free && grp ? `<div class="pp-place-btns">
            <select class="input" id="pp-pair-kind">${rv.pairable.map((g) => `<option value="${g.kind}" ${g.kind === grp.kind ? "selected" : ""}>${esc(g.plural)} (${g.days} day${g.days === 1 ? "" : "s"})</option>`).join("")}</select>
            <select class="input" id="pp-pair-a"><option value="">First…</option>${opt(ranchPick.a)}</select>
            <select class="input" id="pp-pair-b"><option value="">Second…</option>${opt(ranchPick.b)}</select>
            <button class="btn btn-primary" id="pp-pair-go" ${ranchPick.a && ranchPick.b && ranchPick.a !== ranchPick.b && !away ? "" : "disabled"}>Put them out</button></div>`
          : b.free ? `<p class="stamp">You need two grown animals of a kind that aren't out already.</p>` : ""}
        ${buildCard(b)}</section>`;
    };
    const eatsOf = (b) => [...new Set(b.animals.map((a) => (rv.stall.find((x) => x.kind === a.kind) || {}).eats))].filter(Boolean).map((x) => x.toLowerCase()).join(" or ");
    const buildingHTML = (b) => !b.tier ? unbuiltHTML(b) : b.show ? showHTML(b) : b.make && !b.kinds.length ? churnHTML(b) : b.slots ? cultureHTML(b) : b.pairs ? paddockHTML(b) : `<section class="pp-shop pp-ranch-b" id="pp-ranch-${b.id}">
        ${head(b, `${esc(b.tierName)} · ${b.animals.length}/${b.cap} · a round every ${b.hours} h`)}
        <div class="pp-place-btns">
          <button class="btn ${b.waiting ? "btn-primary" : ""}" data-ranch="ranchcollect" data-b="${b.id}" ${b.waiting && !away ? "" : "disabled"}>${b.waiting ? `Collect ${b.ready.map((x) => `${x.n} ${esc(x.name.toLowerCase())}${x.n > 1 && !/s$|wool|down|hair|milk|cream|butter|cheese|yoghurt|hay|feed|honey|wax/i.test(x.name) ? "s" : ""}`).join(", ")}` : "Nothing to collect yet"}</button>
          ${b.care ? `<button class="btn ${b.hungry ? "btn-primary" : ""}" data-ranch="ranchfeed" data-b="${b.id}" ${b.feedable && !away ? "" : "disabled"}>Feed ${b.feedable ? `(${b.feedable} × ${esc(eatsOf(b))})` : "-- they've eaten"}</button>
          <button class="btn" data-ranch="ranchclean" data-b="${b.id}" ${!b.clean && !away ? "" : "disabled"}>${b.clean ? `Clean for ${clock(b.cleanIn)}` : "Muck out"}</button>
          <button class="btn" data-ranch="ranchbrush" data-b="${b.id}" ${!b.brushed && b.animals.length && !away ? "" : "disabled"}>${b.brushed ? `Brushed for ${clock(b.brushIn)}` : "Brush"}</button>` : ""}
        </div>
        ${b.animals.length ? b.animals.map(animalRow).join("") : `<p class="stamp">Empty. Fern sells ${esc(b.kinds.map((k) => (rv.stall.find((x) => x.kind === k) || {}).name || k).join(" and ").toLowerCase())}s at her stall, below.</p>`}
        ${b.make ? `<div class="pp-label">${esc(BENCH[b.id][0])}</div>${benchList(b)}` : ""}
        ${buildCard(b)}</section>`;
    const painted = rv.open ? paintedHTML("ranch", ranchPlaces(rv)).replace(`<g class="pp-map-badges">`, `${ranchWalkers(rv)}<g class="pp-map-badges">`) : "";
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <p class="stamp pp-hub-say">${rv.open ? `Husbandry level ${rv.hus}${rv.helper ? " · " + esc(rv.helper) : ""}`
          : "Past the graveyard, an old farm track runs off into long grass: a fallen fence, a coop with no roof. Someone's leaning on the gate."}</p>
        ${painted}
        ${away ? `<section class="pp-shop"><p>${esc(away)}</p></section>` : ""}
        ${rv.open ? `<div class="pp-place-btns pp-ranch-all">
            <button class="btn ${rv.waiting ? "btn-primary" : ""}" data-ranch="ranchcollect" data-b="all" ${rv.waiting && !away ? "" : "disabled"}>Collect everything${rv.waiting ? ` (${rv.waiting})` : ""}</button>
            <button class="btn ${rv.hungry ? "btn-primary" : ""}" data-ranch="ranchfeed" data-b="all" ${rv.hungry && !away ? "" : "disabled"}>Feed everyone${rv.hungry ? ` (${rv.hungry} hungry)` : ""}</button></div>`
          + rv.buildings.map(buildingHTML).join("") + `
          <section class="pp-shop pp-ranch-feed" id="pp-ranch-feed"><b>Feed store</b> <span class="stamp">· crops from your garden into feed · ${rv.feed} grain feed and ${rv.hay} hay in your bag</span>
            ${gridBenchHTML("ranch:mill", [{id: "feed", label: "Feed", items: rv.mill.map((m) => ({key: String(m.i), icon: itemIcon(m.make, 48), name: `${m.n} × ${m.name}`, badge: m.times || "", can: !!m.times, m}))}], (it) => makeDetail(it.m, "Make", "data-ranch-mill"))}
          </section>
          <section class="pp-shop pp-ranch-stall" id="pp-ranch-stall"><b>Fern's stall</b> <span class="stamp">· “${esc(rv.fern.says)}”</span>
            ${rv.fern.quest ? `<p class="stamp">Fern has an errand: <b>${esc(rv.fern.quest.name)}</b>. ${esc(rv.fern.quest.text)}</p>
              <div class="pp-needs">${rv.fern.quest.needs.map((n) => `<span class="pp-need-chip${n.ok ? "" : " lack"}">${n.item ? `<img alt="" src="${itemIcon(n.item, 16)}">` : ""}${esc(n.text)} ${n.have}/${n.need}</span>`).join("")}</div>
              <p class="stamp">Reward: ${esc(rv.fern.quest.reward)}</p><button class="btn ${rv.fern.quest.can ? "btn-primary" : ""}" id="pp-quest" ${rv.fern.quest.can && !away ? "" : "disabled"}>${rv.fern.quest.can ? "Hand it in" : "Not ready yet"}</button>` : ""}
            ${gridBenchHTML("ranch:stall", [{id: "animals", label: "Animals", items: rv.stall.map((x) => ({key: x.kind, icon: livestockURL(x.art, x.pic, 48), name: x.name, corner: "", can: x.can, x}))},
              {id: "market", label: "The farmers' market", items: rv.market.open ? rv.market.goods.map((x) => ({key: "g" + x.id, icon: itemIcon(x.id, 48), name: x.name, badge: x.have, can: true, g: x})) : [],
               empty: rv.market.open ? "Nothing from the Farm in your bag to sell." : "Saturdays: Fern's stall turns market stall, and pays half as much again as Marlow for what the Farm makes."}], (it, tab) => {
              if (tab === "market") { const x = it.g; return gbHead(itemIcon(x.id, 64), esc(x.name), [`${x.have} in your bag`, eachTxt(x.each)]) + `<button class="btn btn-primary pp-bmake" data-ranch-market="${x.id}">SELL ALL · ${coinTxt(x.all)}</button>`; }
              const x = it.x;
              return gbHead(livestockURL(x.art, x.pic, 64), esc(x.name), [coinTxt(x.price), "lives in the " + esc(x.home.toLowerCase())])
                + `<p class="stamp">${esc(x.gives)} every ${x.every} hours${x.eats ? ` while fed -- eats ${esc(x.eats.toLowerCase())}` : " -- fetches its own flowers"}.</p>${x.why ? `<p class="stamp">${esc(x.why)}</p>` : ""}
                <button class="btn btn-primary pp-bmake" data-ranch-buy="${x.kind}" ${x.can && !away ? "" : "disabled"}>BUY · ${coinTxt(x.price)}</button>`; })}
          </section>` : personHTML(rv.fern, rv.here)}
      </div>`;
    const doIt = async (a, o) => { const r = await act(a, o); if (r && r.error) { status = r.error; toast(r.error, true); render(); } };
    host.querySelectorAll("[data-ranch]").forEach((b) => b.addEventListener("click", () => doIt(b.dataset.ranch, {building: b.dataset.b})));
    host.querySelectorAll("[data-ranch-mill]").forEach((b) => b.addEventListener("click", () => doIt("ranchmill", {i: +b.dataset.ranchMill, times: b.dataset.times === "amt" ? gbAmount(b) : b.dataset.times})));
    host.querySelectorAll("[data-ranch-churn]").forEach((b) => b.addEventListener("click", () => doIt("ranchchurn", {building: b.dataset.b || "dairy", i: +b.dataset.ranchChurn, times: b.dataset.times === "amt" ? gbAmount(b) : b.dataset.times})));
    host.querySelectorAll(".pp-gbench").forEach((g) => gridBenchWire(host, g.dataset.gb, render));   // (2026-10-20)
    host.querySelectorAll("[data-ranch-culture]").forEach((b) => b.addEventListener("click", () => doIt("ranchculture", {building: b.dataset.b || "culture", i: +b.dataset.ranchCulture})));
    host.querySelectorAll("[data-ranch-show]").forEach((b) => b.addEventListener("click", () => doIt("ranchshow", {id: b.dataset.ranchShow, roll: Math.random()})));
    host.querySelectorAll("[data-ranch-market]").forEach((b) => b.addEventListener("click", () => doIt("ranchmarket", {id: b.dataset.ranchMarket, n: "all"})));
    host.querySelectorAll("[data-ranch-buy]").forEach((b) => b.addEventListener("click", () => doIt("ranchbuy", {kind: b.dataset.ranchBuy})));
    host.querySelectorAll("[data-ranch-sell]").forEach((b) => b.addEventListener("click", async () => {
      if (await askYes(`Sell ${b.dataset.name} back to Fern?`)) doIt("ranchsell", {id: b.dataset.ranchSell}); }));
    const pk = host.querySelector("#pp-pair-kind"); if (pk) pk.addEventListener("change", () => { ranchPick = {kind: pk.value, a: "", b: ""}; render(); });
    ["a", "b"].forEach((k) => { const el = host.querySelector("#pp-pair-" + k); if (el) el.addEventListener("change", () => { ranchPick[k] = el.value; render(); }); });
    const pg = host.querySelector("#pp-pair-go"); if (pg) pg.addEventListener("click", () => { const o = {a: ranchPick.a, b: ranchPick.b, roll: Math.random(), roll2: Math.random()}; ranchPick.a = ranchPick.b = ""; doIt("ranchpair", o); });
    const qb = host.querySelector("#pp-quest"); if (qb) qb.addEventListener("click", () => doIt("quest", {region: "ranch"}));
    wirePainted(host, (k) => {                                     // a scroll on the painting: its card below
      if (k === "pet:estate") return goTo(k);
      const el = host.querySelector(k === "feed" ? "#pp-ranch-feed" : k === "stall" ? "#pp-ranch-stall" : "#pp-ranch-" + k);
      if (el) el.scrollIntoView({block: "start", behavior: "smooth"});
    });
  }
  function renderGraveyard(host) {
    const {s} = current();
    const dead = Core.graveyardView(s);
    host.innerHTML = `
      <div class="pp-page">
        ${paintedHTML("graveyard", [{key: "graves", name: "Headstones", note: dead.length ? `${dead.length} remembered` : ""}, {key: "bench", name: "The willow bench"}]
          .concat(Core.necroView(s, Date.now()).taught ? [{key: "circle", name: "The Necromancer's circle", note: "Raise on a headstone"}, {key: "crypt", name: "The crypt", note: "Your risen"}]
            : [{key: "circle", name: "The Necromancer's circle", lock: "a Necromancer's place", lockShort: "Locked"}, {key: "crypt", name: "The crypt", lock: "a Necromancer's place", lockShort: "Locked"}]))}
        <p class="stamp" style="margin:0 0 12px">The pets lost on expeditions. The later areas — the Dungeons and beyond — can take
          a pet that falls; what it wore goes with it. Whatever it found still came home.</p>
        ${dead.length ? `<div class="pp-graves">${dead.map((g, i) => `
          <div class="pp-grave">
            <img class="pp-grave-pet" alt="" src="${petURL(g.species, g.colour, 64)}">
            <div class="pp-grave-text">
              <b>${esc(g.name)}</b> <span class="stamp">${esc(g.kind)} · ${esc(g.rarity)}</span>
              <div>Level ${g.level} · ${g.ageDays} day${g.ageDays === 1 ? "" : "s"} old</div>
              <div class="pp-grave-cause">${esc(g.cause.charAt(0).toUpperCase() + g.cause.slice(1))}.</div>
              <div class="stamp">${esc(new Date(g.at).toLocaleString())}${g.gear && g.gear.length ? ` · lost with it: ${esc(g.gear.join(", "))}` : ""}</div>
              ${graveRaiseHTML(s, i, Date.now())}
            </div>
          </div>`).join("")}</div>`
        : `<p class="pp-why">No graves yet. Every pet you've sent out has come home.</p>`}
        ${necroGroundHTML(s, Date.now())}
      </div>`;
    wireNecro(host);                                                    // the Necromancer's ground (Part 13)
    wirePainted(host, (k) => {
      if (k === "circle" || k === "crypt") { const g = host.querySelector(".pp-necro-ground"); if (g) return g.scrollIntoView({block: "start", behavior: "smooth"}); return toast("An old gate, chained -- this is a Necromancer's place. Sorceress Nyx could teach you."); }   // (Part 13, Cam's repaint)
      if (k === "bench") return toast(dead.length ? "You sit a while under the willow, and remember them." : "You sit a while under the willow. It's quiet -- every pet came home.");
      const el = host.querySelector(".pp-graves") || host.querySelector(".pp-why"); if (el) el.scrollIntoView({block: "center", behavior: "smooth"});
    });
  }

