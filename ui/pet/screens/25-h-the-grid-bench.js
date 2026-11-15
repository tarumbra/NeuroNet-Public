  // ---- every bench-like window looks like the crafting bench (2026-10-20, Cam: "i want the recycle UI and all the other benches
  //      to match the UI for crafting benches now please ... the recycle UI is the old list format and i dont like that it
  //      results in excess scrolling. Please fix all instances of these types of menus"). One layout for the merchants, the
  //      Grindstone, the herb table, the notice board, the altar, the recycle stash and the cart: tabs, a search and a grid of
  //      icons on the left; the one you picked on the right -- what it is, what it takes, an amount and the button.
  //   gridBenchHTML(key, tabs, detail): tabs = [{id, label, items: [{key, icon, name, find?, badge?, corner?, lock?, can?, note?}],
  //   empty?}]; detail(item, tab) -> the right-hand side. gridBenchWire(card, key, redraw) wires tabs, picks, search and the amount.
  const gbTab = {}, gbSel = {}, gbQuery = {}, gbAmt = {};
  function gridBenchHTML(key, tabs, detail) {
    tabs = tabs.filter(Boolean);
    let tab = tabs.find((t) => t.id === gbTab[key]) || tabs.find((t) => t.items.length) || tabs[0];
    const q = (gbQuery[key] || "").trim().toLowerCase();
    let shown = tab.items;
    if (q) shown = shown.filter((x) => (x.find || x.name).toLowerCase().includes(q));
    let sel = shown.find((x) => x.key === gbSel[key]) || shown.find((x) => x.can) || shown[0] || null;
    const cell = (x) => `<button class="pp-bcell${x === sel ? " on" : ""}${x.lock ? " lock" : ""}${x.can ? " can" : ""}" data-gbsel="${esc(x.key)}" title="${esc(x.name)}${x.note ? " -- " + esc(x.note) : ""}">
        <img alt="" src="${x.icon}">${x.corner ? `<span class="lv">${esc(String(x.corner))}</span>` : ""}${x.badge ? `<span class="have">${esc(String(x.badge))}</span>` : ""}${x.lock ? `<span class="pad">${esc(x.lockWord || "locked")}</span>` : ""}</button>`;
    return `<div class="pp-bench pp-gbench" data-gb="${esc(key)}">
      <div class="pp-bleft">
        ${tabs.length > 1 ? `<div class="pp-btabs">${tabs.map((t) => `<button class="pp-btab${t === tab ? " on" : ""}" data-gbtab="${esc(t.id)}">${esc(t.label)} <small>${t.items.length}</small></button>`).join("")}</div>` : ""}
        ${tab.items.length > 10 ? `<input class="input pp-bq pp-gbq" type="search" placeholder="Find…" value="${esc(gbQuery[key] || "")}" aria-label="Find">` : ""}
        <div class="pp-bgrid">${shown.map(cell).join("") || `<p class="stamp">${esc(q ? "Nothing here matches." : tab.empty || "Nothing here yet.")}</p>`}</div>
      </div>
      <div class="pp-bright">${sel ? detail(sel, tab.id) : `<p class="stamp">${esc(tab.empty || "Nothing to pick.")}</p>`}</div></div>`;
  }
  /** The amount row of a detail (the crafting bench's): − slider + and a number, up to max. */
  function gbAmountHTML(key, max, start) {
    const v = max ? Math.max(1, Math.min(max, +(gbAmt[key] || start || max))) : 0;
    return `<div class="pp-bamt"><button class="btn btn-sm" data-bstep="-1" ${max ? "" : "disabled"} aria-label="One fewer">−</button>
      <input type="range" class="pp-bslide" min="${max ? 1 : 0}" max="${max}" value="${v}" ${max ? "" : "disabled"} aria-label="How many" data-gbamt="${esc(key)}">
      <button class="btn btn-sm" data-bstep="1" ${max ? "" : "disabled"} aria-label="One more">+</button>
      <input class="input pp-bnum" type="number" min="${max ? 1 : 0}" max="${max}" value="${v}" ${max ? "" : "disabled"} aria-label="How many, as a number"></div>`;
  }
  /** How many the amount row says (1 if there's none): el is the button pressed (its own grid) or the window around one. */
  function gbAmount(el) { const g = el.closest && el.closest(".pp-gbench"), nb = g ? g.querySelector(".pp-bnum") : el.querySelector(".pp-gbench .pp-bnum"); return nb ? Math.max(1, Math.floor(+nb.value) || 1) : 1; }
  function gridBenchWire(card, key, redraw) {
    const root = card.querySelector(`.pp-gbench[data-gb="${CSS.escape(key)}"]`);
    if (!root) return;
    root.querySelectorAll("[data-gbtab]").forEach((b) => b.addEventListener("click", () => { gbTab[key] = b.dataset.gbtab; gbQuery[key] = ""; redraw(); }));
    root.querySelectorAll("[data-gbsel]").forEach((b) => b.addEventListener("click", () => { gbSel[key] = b.dataset.gbsel; redraw(); }));
    const q = root.querySelector(".pp-gbq");
    if (q) q.addEventListener("input", () => { gbQuery[key] = q.value; const at = q.selectionStart; redraw();
      const n = card.querySelector(`.pp-gbench[data-gb="${CSS.escape(key)}"] .pp-gbq`); if (n) { n.focus(); n.setSelectionRange(at, at); } });
    const sl = root.querySelector(".pp-bslide"), nb = root.querySelector(".pp-bnum");
    const set = (v) => { if (!sl) return; const n = Math.max(+sl.min, Math.min(+sl.max, Math.floor(+v) || 0)); sl.value = nb.value = n; gbAmt[sl.dataset.gbamt] = n; root.querySelectorAll("[data-gbeach]").forEach((e) => { e.textContent = e.dataset.gbunit === "coin" ? coinTxt(Math.floor(n * +e.dataset.gbeach)) : (Math.round(n * +e.dataset.gbeach * 100) / 100).toLocaleString(); }); };
    if (sl) { sl.addEventListener("input", () => set(sl.value)); nb.addEventListener("input", () => set(nb.value)); }
    root.querySelectorAll("[data-bstep]").forEach((b) => b.addEventListener("click", () => set(+nb.value + +b.dataset.bstep)));
  }
  /** A detail's head: the picture, the name, a line or two of chips. */
  const gbHead = (icon, title, chips) => `<div class="pp-bdetail-top"><img alt="" src="${icon}"><div><b>${title}</b><div class="pp-bdoes">${(chips || []).filter(Boolean).map((t) => `<span>${t}</span>`).join("")}</div></div></div>`;
  const gbMat = (id, txt, ok) => `<div class="pp-bmat${ok === false ? " no" : ok ? " ok" : ""}" data-iteminfo="${id}" title="${esc(Core.ITEMS[id] ? Core.ITEMS[id].name : id)}"><img alt="" src="${itemIcon(id, 24)}"><span>${txt}</span></div>`;
