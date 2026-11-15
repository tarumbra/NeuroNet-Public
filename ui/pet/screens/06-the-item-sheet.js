  // ---- the item sheet (2026-10-07): what a thing does, where it comes from, what it's for, and what you can
  //      do with it -- from the bag, or any ingredient chip ----------------------------------------------
  // at the bank: its window is open, or you're in a store room (I8, 2026-10-19, Cam: "shouldnt be able to put something in the
  // bank from anywhere") -- the bank's buttons are only offered there
  const atBank = () => !!document.querySelector(".pp-store-modal") || view === "pet:storeroom" || view === "pet:islandestate";
  function showItem(id) {
    const {s, v, now} = current();
    const info = Core.itemInfo(s, id);
    if (!info) return;
    document.querySelectorAll(".pp-item-sheet").forEach((x) => x.remove());
    const pv = Core.playerView(s, now), it = Core.bagList(s).find((x) => x.id === id);
    const act1 = it ? bagAction(it, pv, v.has && v.stage !== "egg", v) : "";
    const box = document.createElement("div");
    box.className = "pp-modal pp-item-sheet";
    box.innerHTML = `<div class="pp-modal-card pp-sheet" role="dialog" aria-label="${esc(info.name)}">
        <button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
        <div class="pp-sheet-head gem-${Math.min(info.gem, 7)}"><img alt="" src="${itemIcon(id, 64)}">
          <div><b>${esc(info.name)}</b><div class="stamp"><span class="pp-gem">◆ ${info.gem}</span> · in your bag: ${info.have.toLocaleString()}${info.stored ? ` · stored at home: ${info.stored.toLocaleString()}` : ""}${info.sellable ? ` · Marlow pays about ${eachTxt(info.price)}` : ""}</div>
            ${info.does ? `<div class="pp-sheet-does">${esc(info.does)}</div>` : ""}</div></div>
        <p class="pp-status" id="pp-sheet-status"></p>
        ${act1 || info.have || (info.stored && atBank()) ? `<div class="pp-sheet-acts">${act1}
          ${info.have && id !== "unidherb" && atBank() ? `<button class="btn btn-sm" data-sheet="store">Put in the bank</button>` : ""}
          ${info.stored && atBank() ? `<button class="btn btn-sm" data-sheet="withdraw">Take from the bank</button>` : ""}
          ${info.have && info.sellable ? `<button class="btn btn-sm btn-quiet" data-sheet="sell">Sell at Marlow's ›</button>` : ""}
          ${info.have ? `<button class="btn btn-sm btn-quiet pp-drop" data-sheet="drop" title="Throw it away, or recycle it">Drop…</button>` : ""}</div>` : ""}
        <div class="pp-sheet-cols">
          <section><h4>Where it comes from</h4>${info.from.length ? `<ul>${info.from.map((t) => `<li>${esc(t)}</li>`).join("")}${info.moreFrom ? `<li class="stamp">…and ${info.moreFrom} more</li>` : ""}</ul>` : `<p class="stamp">Nowhere you know of yet.</p>`}</section>
          <section><h4>What it's for</h4>${info.uses.length ? `<ul>${info.uses.map((t) => `<li>${esc(t)}</li>`).join("")}${info.moreUses ? `<li class="stamp">…and ${info.moreUses} more</li>` : ""}</ul>` : `<p class="stamp">Selling, mostly.</p>`}</section>
        </div>
      </div>`;
    document.body.appendChild(box);
    const close = () => { box.remove(); };
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    box.querySelector(".pp-shop-x").addEventListener("click", close);
    box.querySelector(".pp-shop-x").focus();
    const said = (r) => { if (r && r.error) { box.querySelector("#pp-sheet-status").textContent = r.error; toast(r.error, true); } else { close(); } };
    box.querySelectorAll(".pp-bag-act").forEach((b) => b.addEventListener("click", async () => {
      const a = b.dataset.act;
      if (a === "open" || a === "readbook" || a === "usewith") { close(); return doBagAct(a, id); }
      said(await doBagAct(a, id));
    }));
    box.querySelectorAll("[data-sheet]").forEach((b) => b.addEventListener("click", async () => {
      const a = b.dataset.sheet;
      if (a === "sell") { close(); return goTo("shop:merchant"); }
      if (a === "drop") { close(); return dropAsk(id, info.have); }        // V7: the amount picker, Recycle offered first
      said(await act(a, {item: id, n: "all"}));
    }));
  }
  // any [data-iteminfo] opens its sheet (the bag's cards, ingredient chips) -- but not its own buttons
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("[data-iteminfo]");
    if (!el || e.target.closest("button")) return;
    showItem(el.dataset.iteminfo);
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".pp-item[data-iteminfo]")) { e.preventDefault(); showItem(e.target.dataset.iteminfo); }
  });
  // "Use with..." (V2, the UX lead's condition: "a clear 'Use with...' step that lights up only the items that combine")
  let bagUse = "";
  /** Into "Use with" -- only when something in the bag (or your knife) goes with it; else just say why (I5 x1, 2026-10-19). */
  function startUse(id) {
    const {s} = current(), partners = Core.fieldPartners(s, id), benches = benchesUsing(id);
    if (!partners.length) {
      if (benches.length) { benchFrom = id; goTo("pet:workshop"); return false; }   // (Q6 q4: the benches that use it light up)
      toast(Core.fieldWhy(s, id)[0] || "Nothing in your bag goes with that yet.", true); return false;
    }
    bagUse = id; return true;
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && bagUse && !document.querySelector(".pp-modal")) { bagUse = ""; render(); } });

