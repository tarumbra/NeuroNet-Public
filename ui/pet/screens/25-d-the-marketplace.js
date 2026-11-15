  // ---- the Marketplace (2026-10-17) -----------------------------------------------------------------------------------------
  //      V4 + Cam's Q4: a market street off the Village. Everyone buys and sells; a Thief (or anyone with the Pickpocketing
  //      technique) picks pockets in the crowd and lifts goods from the stalls -- Larceny. The UX lead's ask: one map, and a
  //      click on a stall opens ONE card where you buy, sell and steal -- no second shop screen.
  let marketCard = "";
  function renderMarket(host) {
    const {s, now} = current(), mv = Core.marketView(s, now);
    const mins = (ms) => ms >= 60000 ? `${Math.ceil(ms / 60000)} min` : `${Math.ceil(ms / 1000)} s`;
    const spots = mv.stores.map((st) => ({key: st.id, name: `${st.keeper} -- ${st.name}`, here: st.here, hereText: "Working it",
      note: mv.canSteal ? (st.watchLeft ? "Watching you" : st.stock < 1 ? "Picked clean" : "") : st.sellPerk || st.buyPerk ? "A good price for you" : ""}))
      .concat([{key: "crowd", name: "The crowd -- pockets to pick", here: mv.marks.some((m) => m.here), hereText: "Working the crowd", note: mv.canSteal ? "" : ""},
               {key: "fence", name: `${mv.fence.name} -- ${mv.fence.where}`, note: mv.fence.worth ? `Swag: ${mv.fence.pays} for you` : ""},
               {key: "guard", name: `${mv.guard.name} -- the watch post`, note: mv.canSteal && mv.caught ? `Caught ${mv.caught}/${mv.banAfter}` : ""}]);
    host.innerHTML = `
      <div class="pp-page mk-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${mv.island ? `<p class="stamp">You're away from the main island -- the Marketplace is here when you're home.</p>` : ""}
        ${mv.banLeft ? `<p class="pp-why"><b>${esc(mv.guard.name)} threw you out of the market</b> -- back in ${mins(mv.banLeft)}. No buying, selling or anything else till then.</p>` : ""}
        ${mv.stunLeft ? `<p class="pp-why">You're still seeing stars -- ${mins(mv.stunLeft)}.</p>` : ""}
        ${paintedHTML("market", spots)}
        <section class="pp-shop mk-head">
          <div class="pp-shop-head"><img class="pp-npc" alt="" src="${avatarURL(mv.guard.look, 64)}">
            <div><b>${esc(mv.guard.name)}</b> <span class="stamp">${esc(mv.guard.title)}</span><div class="stamp">“${esc(mv.guard.says)}”</div></div></div>
          <div class="pp-row">${mv.canSteal ? `<span class="pp-level">Larceny ${mv.level}</span>
              <span class="stamp">Click a stall to buy, sell or steal; the crowd for pockets. Caught: a fine, a stun, and that keeper watches you -- ${mv.banAfter} catches in a quarter of an hour and the watch throws you out for an hour.</span>`
            : `<span class="stamp">Click a stall to buy and sell. ${mv.thief ? "" : "Thieves pick pockets and lift goods here -- or any class with the Pickpocketing technique slotted."}</span>`}</div>
          ${mv.fence.worth ? `<div class="pp-row"><span class="stamp"><b>Your swag sack</b>: worth ${mv.fence.worth} -- ${esc(mv.fence.name)} pays ${mv.fence.pays} (her cut: ${Math.round(mv.fence.cut * 100)}%).</span>
              <button class="btn btn-sm" data-mkcard="fence">To ${esc(mv.fence.where)}</button></div>` : ""}
          ${mv.job ? `<div class="pp-row mk-job"><span class="stamp"><b>Working the ${esc(mv.job.name.replace(/^A /, "").toLowerCase())}</b> while you're away: ${mv.job.count} good tr${mv.job.count === 1 ? "y" : "ies"}, ${mv.job.coins} coins${mv.job.caught ? `, caught ${mv.job.caught}` : ""}.</span>
              <button class="btn btn-sm" id="mk-stop">Stop</button></div>` : ""}
          <div class="pp-row mk-list">${mv.stores.map((st) => `<button class="btn btn-sm" data-mkcard="${st.id}">${esc(st.name)}</button>`).join(" ")}
            <button class="btn btn-sm" data-mkcard="crowd">The crowd</button></div>
        </section>
      </div>`;
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } return r; };
    wirePainted(host, (k) => openMarketCard(k));
    host.querySelectorAll("[data-mkcard]").forEach((b) => b.addEventListener("click", () => openMarketCard(b.dataset.mkcard)));
    const stop = host.querySelector("#mk-stop"); if (stop) stop.addEventListener("click", async () => err(await act("home", {})));
  }
  /** One card for a stall (buy, sell, steal), the crowd (pockets) or the watch post (the rules). */
  function openMarketCard(key) {
    const {s, now} = current(), mv = Core.marketView(s, now);
    marketCard = key;
    document.querySelectorAll(".pp-item-sheet").forEach((x) => x.remove());
    const st = mv.stores.find((x) => x.id === key);
    const stealRow = (t) => !mv.canSteal ? "" : `<div class="pp-recipe${t.why ? " short" : ""}"><div class="pp-recipe-main">
        <b>${esc(t.name)}</b> <span class="stamp">Larceny ${t.level} · ${t.chance}% · +${t.xp} xp${t.kind === "mark" ? ` · ${t.coins[0]}-${t.coins[1]} coins` : ` · ${t.stock}/${t.cap} goods`} · fine ${t.fine}</span>
        ${t.why ? `<div class="stamp">${esc(t.why)}</div>` : ""}</div>
        <span class="pp-place-btns"><button class="btn btn-sm btn-primary" data-steal="${t.id}" ${t.why ? "disabled" : ""}>${t.kind === "mark" ? "Pick a pocket" : "Lift something"}</button>
          <button class="btn btn-sm" data-stealtrip="${t.id}" ${t.why ? "disabled" : ""} title="Keep trying while you're away -- slower than doing it yourself">${t.here ? "Working it ✓" : "Keep at it"}</button></span></div>`;
    let body = "";
    if (st) {
      body = `<div class="pp-sheet-head"><img alt="" src="${avatarURL(st.look, 64)}"><div><b>${esc(st.keeper)}</b><div class="stamp">${esc(st.name)} -- “${esc(st.says)}”</div></div></div>
        ${st.buyPerk || st.sellPerk ? `<p class="pp-boost">${esc([st.buyPerk, st.sellPerk].filter(Boolean).join(" · "))}</p>` : ""}
        ${mv.canSteal ? `<div class="pp-label">Steal</div>${stealRow(st)}` : ""}
        ${gridBenchHTML("market:" + st.id, [{id: "buy", label: "Buy", items: st.sells.map((x) => ({key: "b" + x.id, icon: itemIcon(x.id, 48), name: x.name, corner: x.price, can: (s.coins || 0) >= x.price, x}))},
          st.buys ? {id: "sell", label: "Sell", items: st.buys.map((x) => ({key: "s" + x.id, icon: itemIcon(x.id, 48), name: x.name, badge: x.have, can: true, x})), empty: `Nothing in your bag ${st.keeper} wants -- ${st.buysWhat}.`} : null], (it, tab) => { const x = it.x;
          if (tab === "buy") { const max = Math.max(0, Math.min(100, Math.floor((s.coins || 0) / Math.max(1, x.price))));
            return gbHead(itemIcon(x.id, 64), esc(x.name), [`${x.price.toLocaleString()} coin${x.price === 1 ? "" : "s"} each`]) + (max > 1 ? gbAmountHTML("mkb:" + st.id + x.id, max, 1) : "")
              + `<p class="stamp pp-bget">${max ? `Cost: <b data-gbeach="${x.price}" data-gbunit="coin">${coinTxt(x.price * Math.min(max, +(gbAmt["mkb:" + st.id + x.id] || 1)))}</b>` : "Not enough coins."}</p>
              <button class="btn btn-primary pp-bmake" data-mkbuy="${x.id}" data-n="amt" ${max ? "" : "disabled"}>BUY</button>`; }
          return gbHead(itemIcon(x.id, 64), esc(x.name), [`${x.have} in your bag`, `${x.each} each`]) + (x.have > 1 ? gbAmountHTML("mks:" + st.id + x.id, x.have, x.have) : "")
            + `<div class="pp-row"><button class="btn btn-primary pp-bmake" data-mksell="${x.id}" data-n="amt">SELL</button><button class="btn" data-mksell="${x.id}" data-n="all">All ${x.have}</button></div>`; })}`;
    } else if (key === "crowd") {
      body = `<div class="pp-sheet-head"><div><b>The crowd</b><div class="stamp">Farmhands, shoppers, merchants -- and their purses.</div></div></div>
        ${mv.canSteal ? mv.marks.map(stealRow).join("") : `<p class="stamp">Only a Thief picks pockets -- or another class with the Pickpocketing technique slotted (the Thief's Light fingers talent teaches it).</p>`}`;
    } else if (key === "fence") {
      const F = mv.fence;
      body = `<div class="pp-sheet-head"><img alt="" src="${avatarURL(F.look, 64)}"><div><b>${esc(F.name)}</b><div class="stamp">${esc(F.where)} -- “${esc(F.says)}”</div></div></div>
        
        ${F.items.length || F.coins ? `<div class="pp-needs">${F.coins ? `<span class="pp-need-chip">${F.coins} coins from purses</span>` : ""}${F.items.map((x) => `<span class="pp-need-chip"><img alt="" src="${itemIcon(x.id, 16)}">${x.n} × ${esc(x.name)}</span>`).join("")}</div>
          <p>Worth ${F.worth} -- she'll give you <b>${F.pays}</b>.</p><button class="btn btn-primary" id="mk-fence">Sell it all to ${esc(F.name.split(" ")[0])}</button>`
          : `<p class="stamp">Your swag sack's empty.</p>`}`;
    } else if (key === "guard") {
      body = `<div class="pp-sheet-head"><img alt="" src="${avatarURL(mv.guard.look, 64)}"><div><b>${esc(mv.guard.name)}</b><div class="stamp">${esc(mv.guard.title)} -- “${esc(mv.guard.says)}”</div></div></div>
        <p>Caught stealing: a fine, a short stun, and that stall's keeper watches you for a while. Caught ${mv.banAfter} times in a quarter of an hour and the watch throws you out of the market for an hour. Nobody gets hurt.</p>
        ${mv.canSteal ? `<p class="stamp">Caught lately: ${mv.caught} of ${mv.banAfter}.</p>` : ""}`;
    } else return;
    const box = document.createElement("div");
    box.className = "pp-modal pp-item-sheet mk-card";
    if (st) box.classList.add("pp-bench-modal");                           // a stall: the crafting bench's wide window (2026-10-20)
    box.innerHTML = `<div class="pp-modal-card pp-sheet${st ? " pp-shop-card" : ""}" role="dialog" aria-label="${esc(st ? st.name : key)}"><button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>${body}</div>`;
    document.body.appendChild(box);
    const close = () => { marketCard = ""; box.remove(); };
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    box.querySelector(".pp-shop-x").addEventListener("click", close);
    const say = (r) => { if (r && r.error) toast(r.error, true); if (document.body.contains(box)) openMarketCard(key); };
    if (st) gridBenchWire(box, "market:" + st.id, () => openMarketCard(key));
    box.querySelectorAll("[data-mkbuy]").forEach((b) => b.addEventListener("click", async () => say(await act("market", {op: "buy", store: key, item: b.dataset.mkbuy, n: b.dataset.n === "amt" ? gbAmount(b) : +b.dataset.n}))));
    box.querySelectorAll("[data-mksell]").forEach((b) => b.addEventListener("click", async () => say(await act("market", {op: "sell", store: key, item: b.dataset.mksell, n: b.dataset.n === "all" ? "all" : b.dataset.n === "amt" ? gbAmount(b) : 1}))));
    box.querySelectorAll("[data-steal]").forEach((b) => b.addEventListener("click", async () => say(await act("steal", {target: b.dataset.steal}))));
    const fb = box.querySelector("#mk-fence"); if (fb) fb.addEventListener("click", async () => say(await act("fence", {})));
    box.querySelectorAll("[data-stealtrip]").forEach((b) => b.addEventListener("click", async () => say(await act("stealtrip", {target: b.dataset.stealtrip}))));
    const x = box.querySelector(".pp-shop-x"); if (x && !box.contains(document.activeElement)) x.focus();
  }
