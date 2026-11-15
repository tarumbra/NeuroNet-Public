  // ---- one place at a time (2026-10-08, Cam: "when i click on ... the dining table it shows everything else as
  //      well, i want it to just show the options at the dining table") -- a painted place opens this sheet with
  //      only its own options: a home section (sec:...), a room (room:...), the material archive, a region's person
  //      or its secrets. It's redrawn after every render, so what you do in it shows at once.
  let openSec = "", secLand = "";
  function closeSec() { openSec = ""; const m = document.querySelector(".pp-modal.pp-sec-modal"); if (m) m.remove(); }
  // ---- the recycle stash and the recycled materials store (2026-10-11), in the store room by the barrels ----
  const needChips = (list) => list.map((x) => `<span class="pp-need-chip" data-iteminfo="${x.id}" title="${esc(x.name)}"><img alt="" src="${itemIcon(x.id, 16)}">${x.n}</span>`).join("");
  function recycleBuildHTML(part, nx) {
    const {s} = current(), con = Core.recycleView(s, Date.now()).con;
    if (!nx) return `<p class="stamp pp-room-done">As grand as it gets.</p>`;
    return `<div class="pp-room-next">
      <div><b>Build ${esc(nx.name.toLowerCase())} ${part === "store" ? "materials store" : "recycle stash"}</b> <span class="stamp">· ${esc(nx.does)} · +${nx.xp} Construction xp</span></div>
      <div class="pp-needs">
        <span class="pp-need-chip${con >= nx.con ? "" : " lack"}">Construction ${con}/${nx.con}</span>
        <span class="pp-need-chip${(s.coins || 0) >= nx.coins ? "" : " lack"}">${coinTxt(nx.coins)}</span>
        ${nx.needs.map((n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}" title="${esc(n.name)}" data-iteminfo="${n.id}"><img alt="" src="${itemIcon(n.id, 16)}">${n.have}/${n.need}</span>`).join("")}
      </div>
      <button class="btn btn-sm ${nx.can ? "btn-primary" : ""} pp-rc-build" data-part="${part}" ${nx.can ? "" : "disabled"}>Build</button>
    </div>`;
  }
  // (2026-10-20, Cam: "the recycle UI is the old list format and i dont like that it results in excess scrolling" -- now the
  //  crafting bench's look: tabs and a grid, the one you picked on the right, an amount and the button)
  const rcEach = (x) => x.each.length ? x.each.map((e) => gbMat(e.id, `${e.n} ${esc(e.name.toLowerCase())} each`)).join("") : x.points ? `<div class="pp-bmat"><span>♻ ${x.points} recycling points each</span></div>` : `<div class="pp-bmat no"><span>Worth nothing -- it's thrown away</span></div>`;
  function recycleHTML(rv) {
    const st = rv.stash;
    const can = rv.can.map((x) => ({key: x.id, icon: itemIcon(x.id, 48), name: x.name, badge: ((x.bag || 0) + (x.stored || 0)).toLocaleString(), can: !!(x.each.length || x.points), x}));
    const lots = st.lots.map((l) => ({key: "l" + l.i, icon: itemIcon(l.id, 48), name: `${l.n} × ${l.name}`, badge: l.waiting ? "full" : clock(l.readyIn), l}));
    return `<section class="pp-shop pp-recycle"><b>Recycle stash</b>
      <span class="stamp">· ${esc(st.tierName)} · breaks things down ${esc(st.speed)} · ${st.lots.length}/${st.max} lots · half comes back as materials, or as recycling points</span>
      ${gridBenchHTML("recycle", [{id: "put", label: "Put in", items: can, empty: "Nothing to put in."}, {id: "lots", label: "Breaking down", items: lots, empty: "Nothing breaking down."}], (it, tab) => {
        if (tab === "lots") { const l = it.l;
          return gbHead(itemIcon(l.id, 64), `${l.n} × ${esc(l.name)}`, [l.waiting ? "done -- waiting for room in the materials store" : `ready in ${clock(l.readyIn)}`])
            + `<div class="pp-label">Gives</div>${l.gives.length ? l.gives.map((e) => gbMat(e.id, `${e.n} ${esc(e.name.toLowerCase())}`)).join("") : l.points ? `<div class="pp-bmat"><span>♻ ${l.points} points</span></div>` : `<p class="stamp">Nothing -- it's thrown away.</p>`}
            <button class="btn pp-rc-cancel" data-i="${l.i}">Take it back</button>`; }
        const x = it.x;
        return gbHead(itemIcon(x.id, 64), esc(x.name), [x.bag ? `${x.bag} in your bag` : "", x.stored ? `${x.stored} in the bank` : "", `takes ${esc(x.takes)}`])
          + `<div class="pp-label">Each gives about</div>${rcEach(x)}
          ${x.bag > 1 ? gbAmountHTML("rc:" + x.id, x.bag, x.bag) : ""}
          <div class="pp-row">${x.bag ? `<button class="btn btn-primary pp-bmake pp-rc-put" data-id="${x.id}" data-n="amt" data-from="bag" ${st.lots.length < st.max ? "" : "disabled"}>RECYCLE</button>` : ""}
            ${x.stored ? `<button class="btn pp-rc-put" data-id="${x.id}" data-n="all" data-from="chests" title="Everything of it in the bank">All ${x.stored} from the bank</button>` : ""}</div>
          ${st.lots.length >= st.max ? `<p class="stamp">The stash is full -- wait for a lot to finish, or build it bigger.</p>` : ""}`;
      })}
      ${recycleBuildHTML("stash", st.next)}
    </section>`;
  }
  function recycledHTML(rv) {
    const m = rv.store;
    const mats = m.items.map((x) => ({key: x.id, icon: itemIcon(x.id, 48), name: x.name, badge: x.n.toLocaleString(), can: true, x}));
    const shop = rv.shop.map((x) => ({key: x.id, icon: itemIcon(x.id, 48), name: x.name, badge: x.have ? x.have.toLocaleString() : "", corner: "♻" + x.price, can: !!x.can, x}));
    return `<section class="pp-shop pp-recycled"><b>Recycled materials</b> <span class="stamp">· ${esc(m.tierName)} · ${m.used}/${m.cap} kinds · <b>♻ ${rv.points}</b> recycling points · your benches at home use these</span>
      ${gridBenchHTML("recycled", [{id: "mats", label: "Materials", items: mats, empty: "Empty -- put something in the recycle stash."}, {id: "shop", label: "Exchange", items: shop, empty: "Nothing to buy with points yet."}], (it, tab) => {
        const x = it.x;
        if (tab === "mats") return gbHead(itemIcon(x.id, 64), esc(x.name), [`${x.n.toLocaleString()} in the store`]) + `
          <button class="btn btn-primary pp-bmake pp-rc-take" data-id="${x.id}" data-n="all">TAKE TO BAG</button>`;
        return gbHead(itemIcon(x.id, 64), esc(x.name), [`♻ ${x.price} each`, x.have ? `${x.have.toLocaleString()} in the store` : ""]) + `
          ${x.can > 1 ? gbAmountHTML("pt:" + x.id, x.can, Math.min(x.can, 10)) : ""}
          <p class="stamp pp-bget">${x.can ? `Costs ♻ <b data-gbeach="${x.price}">${(x.price * Math.min(x.can, +(gbAmt["pt:" + x.id] || Math.min(x.can, 10)))).toLocaleString()}</b>` : "Not enough points."}</p>
          <button class="btn btn-primary pp-bmake pp-pt-buy" data-id="${x.id}" data-n="amt" ${x.can ? "" : "disabled"}>BUY</button>`;
      })}
      ${recycleBuildHTML("store", m.next)}
    </section>`;
  }
  function wireRecycle(host) {
    const doIt = async (a, o) => { const r = await act(a, o); if (r && r.error) { status = r.error; toast(r.error, true); } showSec(); };
    host.querySelectorAll(".pp-rc-put").forEach((b) => b.addEventListener("click", () => doIt("recycle", {id: b.dataset.id, n: b.dataset.n === "all" ? "all" : b.dataset.n === "amt" ? gbAmount(b) : +b.dataset.n, from: b.dataset.from})));
    host.querySelectorAll(".pp-rc-cancel").forEach((b) => b.addEventListener("click", () => doIt("recyclecancel", {i: +b.dataset.i})));
    host.querySelectorAll(".pp-rc-take").forEach((b) => b.addEventListener("click", () => doIt("recycletake", {id: b.dataset.id, n: "all"})));
    host.querySelectorAll(".pp-rc-build").forEach((b) => b.addEventListener("click", () => doIt("recyclebuild", {part: b.dataset.part})));
    host.querySelectorAll(".pp-pt-buy").forEach((b) => b.addEventListener("click", () => doIt("recyclebuy", {id: b.dataset.id, n: b.dataset.n === "max" ? "max" : b.dataset.n === "amt" ? gbAmount(b) : +b.dataset.n})));
    host.querySelectorAll(".pp-recycle .pp-gbench, .pp-recycled .pp-gbench").forEach((g) => gridBenchWire(host, g.dataset.gb, showSec));
  }
  // ---- the cart (2026-10-11): load it from the bag, the chests and the recycled materials; Marlow pays when it's back ----
  function cartHTML(cv) {
    const {s} = current(), nx = cv.next;
    const build = nx ? `<div class="pp-room-next">
        <div><b>${cv.tier ? "Build the " + esc(nx.name.toLowerCase()) : "Build a cart shed"}</b> <span class="stamp">· pulled by ${esc(nx.pulled)} · ${nx.kinds} kinds a load · ${nx.hours} hours${nx.bonus > 1 ? ` · +${Math.round((nx.bonus - 1) * 100)}% on every sale` : ""} · +${nx.xp} Construction xp</span></div>
        ${nx.lock ? `<p class="stamp">🔒 ${esc(nx.lock)}.</p>` : `<div class="pp-needs">
          <span class="pp-need-chip${cv.con >= nx.con ? "" : " lack"}">Construction ${cv.con}/${nx.con}</span>
          <span class="pp-need-chip${(s.coins || 0) >= nx.coins ? "" : " lack"}">${coinTxt(nx.coins)}</span>
          ${nx.needs.map((n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}" title="${esc(n.name)}" data-iteminfo="${n.id}"><img alt="" src="${itemIcon(n.id, 16)}">${n.have}/${n.need}</span>`).join("")}
        </div>
        <button class="btn btn-sm ${nx.can ? "btn-primary" : ""} pp-cart-build" ${nx.can ? "" : "disabled"}>Build</button>`}
      </div>` : `<p class="stamp pp-room-done">As grand as it gets.</p>`;
    if (!cv.tier) return `<section class="pp-shop pp-cart"><b>Cart shed</b>
      ${build}</section>`;
    // (2026-10-20: the crafting bench's look -- Load and On the cart, a grid, the one you picked on the right)
    const can = cv.can.map((x) => ({key: x.id, icon: itemIcon(x.id, 48), name: x.name, badge: ((x.bag || 0) + (x.chests || 0) + (x.recycled || 0)).toLocaleString(), can: true, x}));
    const load = cv.load.map((r) => ({key: "c" + r.id, icon: itemIcon(r.id, 48), name: `${r.n.toLocaleString()} × ${r.name}`, badge: r.n.toLocaleString(), r}));
    return `<section class="pp-shop pp-cart"><b>${esc(cv.name)}</b>
      <span class="stamp">· pulled by ${esc(cv.pulled)} · ${cv.kinds} kinds a load · ${cv.hours} hours to Marlow and back${cv.bonus > 1 ? ` · +${Math.round((cv.bonus - 1) * 100)}%` : ""}</span>
      <div class="pp-row pp-cart-go"><span class="stamp">${cv.out ? `On the road -- back in <b>${clock(cv.out.backIn)}</b> with <b>${coinTxt(cv.out.pay)}</b>. Load the next trip meanwhile.` : `On the cart: ${cv.load.length}/${cv.kinds} kinds · ${coinTxt(cv.total)}`}</span>
        <button class="btn ${cv.load.length && !cv.out ? "btn-primary" : ""}" id="pp-cart-send" ${cv.load.length && !cv.out ? "" : "disabled"}>${cv.out ? "The cart's out" : `Send it to Marlow · ${coinTxt(cv.total)}`}</button></div>
      ${gridBenchHTML("cart", [{id: "load", label: "Load", items: can, empty: "Nothing to sell."}, {id: "on", label: "On the cart", items: load, empty: "Nothing loaded yet."}], (it, tab) => {
        if (tab === "on") { const r = it.r; return gbHead(itemIcon(r.id, 64), `${r.n.toLocaleString()} × ${esc(r.name)}`, [coinTxt(r.pay)]) + `<button class="btn pp-cart-unload" data-id="${r.id}">Take it off</button>`; }
        const x = it.x;
        return gbHead(itemIcon(x.id, 64), esc(x.name), [eachTxt(x.each)]) + `<div class="pp-label">Load all of it from</div>
          <div class="pp-row">${[["bag", "your bag"], ["chests", "the bank"], ["recycled", "recycled"]].filter(([k]) => x[k] > 0)
            .map(([k, label]) => `<button class="btn pp-cart-load" data-id="${x.id}" data-from="${k}">${x[k].toLocaleString()} from ${label}</button>`).join("")}</div>
          ${cv.load.length >= cv.kinds && !cv.load.some((r) => r.id === x.id) ? `<p class="stamp">The cart takes ${cv.kinds} kinds a load -- it's full.</p>` : ""}`;
      })}
      ${build}
    </section>`;
  }
  function wireCart(host) {
    const doIt = async (a, o) => { const r = await act(a, o || {}); if (r && r.error) { status = r.error; toast(r.error, true); } showSec(); };
    host.querySelectorAll(".pp-cart-build").forEach((b) => b.addEventListener("click", () => doIt("cartbuild")));
    host.querySelectorAll(".pp-cart-load").forEach((b) => b.addEventListener("click", () => doIt("cartload", {id: b.dataset.id, from: b.dataset.from, n: "all"})));
    host.querySelectorAll(".pp-cart-unload").forEach((b) => b.addEventListener("click", () => doIt("cartunload", {id: b.dataset.id})));
    const send = host.querySelector("#pp-cart-send"); if (send) send.addEventListener("click", () => doIt("cartsend"));
    if (host.querySelector(".pp-cart .pp-gbench")) gridBenchWire(host, "cart", showSec);
  }
  function openPlace(key, region) { openSec = key; secLand = region || ""; showSec(); }
  /** What a sheet shows: its inner HTML, or "" when there's nothing (the sheet closes). */
  function secSheetHTML(key) {
    const {s, now} = current();
    if (key.startsWith("sec:")) {
      const hv = Core.homeView(s, now), k = key.slice(4);
      const f = {hearth: hearthHTML, dining: diningHTML, archive: archiveHTML, reading: readingHTML, stacks: stacksHTML, observatory: observatoryHTML}[k];
      return f ? f(hv) : "";
    }
    if (key.startsWith("room:")) return roomsHTML((r) => r.id === key.slice(5));
    if (key === "materials") return materialsHTML(true);
    if (key === "recycle") return recycleHTML(Core.recycleView(s, now));
    if (key === "cart") return cartHTML(Core.cartView(s, now));
    if (key === "recycled") return recycledHTML(Core.recycleView(s, now));
    const lv = secLand && Core.landView(s, secLand, now);
    if (!lv) return "";
    if (key === "person") return lv.person ? personHTML(lv.person, lv.open) : "";
    if (key === "contracts") return contractsHTML(Core.contractsView(s, secLand, now));
    if (key === "secrets") return secretsHTML(lv);
    return "";
  }
  /** A harbourmaster's contracts (2026-10-09): goods from the other islands, three a day (four with a galleon). */
  function contractsHTML(cv) {
    return `<section class="pp-shop"><b>${esc(cv.who)}'s contracts</b>
      
      ${gridBenchHTML("contracts:" + cv.port, [{id: "c", label: "Contracts", items: cv.list.map((o) => ({key: String(o.i), icon: itemIcon(o.id, 48), name: `${o.n.toLocaleString()} × ${o.name}`, badge: o.done ? "✓" : `${o.have.toLocaleString()}/${o.n.toLocaleString()}`, corner: o.big ? "G" : "", can: o.can, o}))}], (it) => { const o = it.o;
        return gbHead(itemIcon(o.id, 64), `${o.n.toLocaleString()} × ${esc(o.name)}`, [coinTxt(o.coins), o.xp ? `+${o.xp.toLocaleString()} ${esc(o.skill)} xp` : "", o.big ? "Galleon · an iron crate" : "a crate"])
          + gbMat(o.id, `${o.have.toLocaleString()}/${o.n.toLocaleString()}`, o.have >= o.n)
          + `<button class="btn btn-primary pp-bmake pp-contract" data-port="${cv.port}" data-i="${o.i}" ${o.can ? "" : "disabled"}>${o.done ? "FILLED ✓" : "DELIVER"}</button>`; })}</section>`;
  }
  function showSec() {
    if (!openSec) return;
    const html = secSheetHTML(openSec);
    if (!html) return closeSec();
    let box = document.querySelector(".pp-modal.pp-sec-modal");
    if (!box) {
      box = document.createElement("div");
      box.className = "pp-modal pp-sec-modal";
      box.innerHTML = `<div class="pp-modal-card pp-shop-card pp-sec-card" role="dialog"></div>`;
      document.body.appendChild(box);
      box.addEventListener("click", (e) => { if (e.target === box) closeSec(); });
    }
    box.classList.toggle("pp-bench-modal", ["recycle", "recycled", "cart", "contracts"].includes(openSec));   // (the wide bench window, 2026-10-20)
    const card = box.querySelector(".pp-sec-card"), keep = card.scrollTop;
    card.innerHTML = `<button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>${html}`;
    card.scrollTop = keep;
    card.querySelector(".pp-shop-x").addEventListener("click", closeSec);
    wireHome(card);
    wireMaterials(card);
    wireRecycle(card);
    wireCart(card);
    // a room: its benches open their own window, the store room its chests
    card.querySelectorAll(".pp-room .pp-villager").forEach((b) => b.addEventListener("click", () => { closeSec(); openShop = b.dataset.ws; showShop(); }));
    card.querySelectorAll(".pp-build").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("build", {room: b.dataset.room});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
    }));
    card.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => {
      closeSec();
      if (b.dataset.sheetTab) { sheetTab = b.dataset.sheetTab; sheetFrom = b.dataset.jump; }   // straight to a Character sheet tab
      goTo(b.dataset.jump);
    }));
    const st = card.querySelector("#pp-open-store"); if (st) st.addEventListener("click", () => { closeSec(); showStore(); });
    card.querySelectorAll(".pp-gbench[data-gb^='contracts:']").forEach((g) => gridBenchWire(card, g.dataset.gb, showSec));   // (2026-10-20)
    card.querySelectorAll(".pp-contract").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("contract", {port: b.dataset.port, i: +b.dataset.i});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
    }));
    const qb = card.querySelector("#pp-quest");
    if (qb) qb.addEventListener("click", async () => {
      const had = !!((current().s.quests || {}).quarry);
      const r = await act("quest", {region: secLand});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
      else if (!had && (current().s.quests || {}).quarry) talkPopup("quarry");   // Ranger Ash explains the Bestiary (PT20 b1)
    });
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openSec) closeSec(); });
  // no dragging a picture off a map, and a double-click doesn't start a selection there (2026-10-08)
  ["dragstart", "selectstart"].forEach((ev) => document.addEventListener(ev, (e) => {
    const el = e.target && e.target.nodeType === 3 ? e.target.parentElement : e.target;
    if (el && el.closest && el.closest(".pp-world, .pp-arena, .pp-land-painted")) e.preventDefault();
  }));
  document.addEventListener("mousedown", (e) => { if (e.detail > 1 && e.target.closest && e.target.closest(".pp-world, .pp-arena")) e.preventDefault(); });
  function secretsHTML(lv) {
    return `<section class="pp-shop">
      <b>Secrets of the ${esc(lv.name)}</b> <span class="stamp">${lv.found}/${lv.total} found</span>
      <div class="pp-beasts">${lv.secrets.map((x) => x.found ? `<div class="pp-beast"><div><b>${x.kind === "egg" ? "🥚" : x.kind === "spot" ? "📍" : "💰"} ${esc(x.name)}</b></div>
          <div class="stamp">${esc(x.text)}</div></div>` : `<div class="pp-beast unknown"><b>???</b><div class="stamp">Still hidden</div></div>`).join("")}</div>
    </section>`;
  }
  function personHTML(pp, open) {
    const q = pp.quest;
    return `<section class="pp-shop pp-person" id="pp-person">
      <div class="pp-shop-head"><img class="pp-npc" alt="" src="${avatarURL(pp.look, 48)}">
        <div><b>${esc(pp.name)}</b> <span class="stamp">${pp.done}/${pp.total} quests done</span><div class="stamp">“${esc(pp.says)}”</div></div></div>
      ${q ? `<div class="pp-quest"><div><b>${esc(q.name)}</b></div><p class="stamp">${esc(q.text)}</p>
          <div class="pp-needs">${q.needs.map((n) => `<span class="pp-need-chip${n.ok ? "" : " lack"}"${n.item ? ` data-iteminfo="${n.item}"` : ""}>${n.item ? `<img alt="" src="${itemIcon(n.item, 16)}">` : ""}${esc(n.text)} ${n.have}/${n.need}</span>`).join("")}</div>
          <p class="stamp">Reward: ${esc(q.reward)}</p>
          <button class="btn ${q.can ? "btn-primary" : ""}" id="pp-quest" ${q.can && open ? "" : "disabled"}>${q.can ? "Hand it in" : "Not ready yet"}</button></div>`
        : `<p class="stamp">“You've done more than enough. Thank you.”</p>`}
    </section>`;
  }
