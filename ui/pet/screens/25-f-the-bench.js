  // ---- the bench, redesigned (2026-10-19; Cam, with RuneScape's Cooking screen: "reinvent it to look like this but with our
  //      design ... and still have the ability to click something and then click the work bench"; Q6: every bench, split by
  //      what it's made from, a click picks, Use with... lights the benches). Left: the bench's whole list as painted icons
  //      under tabs, locked ones greyed with their level. Right: the one you picked -- what it does, what it needs (ticked or
  //      crossed), the amount and Make. From the bag, "From your bag: X" shows what X makes here first.
  let benchTab = {}, benchSel = {}, benchFrom = "", benchQuery = {};
  const METALS = ["bronze", "iron", "steel", "mithril", "adamant", "rune", "gold", "silver", "copper", "tin"];
  const WOODS = ["oak", "willow", "maple", "yew", "magic", "teak", "mahogany", "pine", "birch", "ash", "palm"];
  const GEMS = ["opal", "jade", "topaz", "sapphire", "emerald", "ruby", "diamond", "amethyst", "quartz", "obsidian", "pearl", "onyx"];
  const FISHY = ["shrimp", "sardine", "herring", "trout", "salmon", "tuna", "pike", "perch", "lobster", "swordfish", "shark", "monkfish", "crab", "eel", "cod", "mackerel", "bass", "carp", "ray", "fish"];
  const MEATY = ["pork", "beef", "chicken", "mutton", "venison", "meat", "rabbit", "duck", "boar", "bear", "egg", "steak"];
  /** Which tab a recipe goes under: what it's made from (Q6 q2). */
  function benchGroup(w, r) {
    const ids = [r.make].concat(r.needs.map((n) => n.id)), has = (list) => list.find((x) => ids.some((k) => k.includes(x)));
    if (w.skill === "cooking") {
      const it = Core.ITEMS[r.make] || {};
      if (it.food && !it.heal) return "Pet treats";
      if (has(["tea", "juice", "milk", "cider", "coffee"])) return "Drinks";
      if (has(FISHY)) return "Fish";
      if (has(MEATY)) return "Meat and eggs";
      return "Baking and sweets";
    }
    const m = has(METALS) || has(WOODS) || has(GEMS);
    if (m) return m.charAt(0).toUpperCase() + m.slice(1);
    const n0 = r.needs[0]; return n0 ? n0.name : "Other";
  }
  /** The bench's tabs: [name, recipes], biggest first, at most 8 (+ Other). */
  function benchGroups(w) {
    const g = {};
    w.recipes.forEach((r) => { const k = benchGroup(w, r); (g[k] = g[k] || []).push(r); });
    let list = Object.entries(g).sort((a, b) => Math.min(...a[1].map((r) => r.level)) - Math.min(...b[1].map((r) => r.level)));
    if (list.length > 9) {
      const big = list.slice().sort((a, b) => b[1].length - a[1].length).slice(0, 8).map((x) => x[0]);
      const other = list.filter((x) => !big.includes(x[0])).flatMap((x) => x[1]);
      list = list.filter((x) => big.includes(x[0])).concat([["Other", other]]);
    }
    return list;
  }
  const benchVerb = (w) => w.skill === "cooking" ? "Cook" : w.npc ? "Transmute" : w.id === "furnace" ? "Smelt" : w.id === "tanner" ? "Tan" : "Make";
  /** Is a recipe one this bench can draw this way (not the grindstone, trades, orders...)? */
  function benchPlain(w) { return !w.grind && !w.trade && !w.reskin && !w.identify && !w.orders && !w.altar && (w.recipes || []).length > 0; }
  function benchHTML(w) {
    const groups = benchGroups(w), q = (benchQuery[w.id] || "").trim().toLowerCase();
    const from = benchFrom && w.recipes.some((r) => r.needs.some((n) => n.id === benchFrom)) ? benchFrom : "";
    let tab = benchTab[w.id];
    if (from) tab = "@from";
    else if (!tab || (tab !== "All" && !groups.some((g) => g[0] === tab))) tab = "All";   // (opens on the whole list)
    let shown = tab === "@from" ? w.recipes.filter((r) => r.needs.some((n) => n.id === from)) : tab === "All" ? w.recipes.slice() : (groups.find((g) => g[0] === tab) || [0, []])[1].slice();
    if (q) shown = w.recipes.filter((r) => [r.name, r.does || "", ...r.needs.map((n) => n.name)].join(" ").toLowerCase().includes(q));
    shown.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    let sel = w.recipes.find((r) => r.i === benchSel[w.id]);
    if (!sel || !shown.includes(sel)) sel = shown.find((r) => r.can) || shown.find((r) => r.open && !r.roomLock) || shown[0];
    const cell = (r) => `<button class="pp-bcell${r === sel ? " on" : ""}${r.open && !r.roomLock ? "" : " lock"}${r.can ? " can" : ""}" data-bsel="${r.i}" title="${esc(r.name)}${r.open ? "" : ` -- level ${r.level}`}">
        <img alt="" src="${itemIcon(r.make, 48)}"><span class="lv">${r.level}</span>${r.open && !r.roomLock ? "" : `<span class="pad">locked</span>`}${r.have ? `<span class="have">${r.have}</span>` : ""}</button>`;
    const tick = (ok) => `<i class="${ok ? "ok" : "no"}">${ok ? "✓" : "✕"}</i>`;
    const right = !sel ? `<p class="stamp">Nothing here matches.</p>` : (() => {
      const lacking = sel.needs.filter((n) => n.have < n.need).map((n) => n.name.toLowerCase());
      const feeOk = !sel.fee || w.coins >= sel.fee, max = Math.min(1000, sel.times || 0);
      return `<div class="pp-bdetail-top"><img alt="" src="${itemIcon(sel.make, 64)}"><div><b>${sel.n > 1 ? sel.n + " × " : ""}${esc(sel.name)}</b>
          <div class="pp-bdoes">${(sel.does || "").split(" · ").filter(Boolean).map((t) => `<span>${esc(t)}</span>`).join("")}${sel.xp ? `<span>+${sel.xp} xp each</span>` : ""}${sel.have ? `<span>${sel.have} in your bag</span>` : ""}</div></div></div>
        <div class="pp-label">Requirements</div>
        <div class="pp-breq${sel.open ? " ok" : " no"}"><span>${esc(w.skill ? Core.SKILLS[w.skill].name : w.name)} level ${sel.level}</span><b>yours: ${w.level || "—"}</b>${tick(sel.open)}</div>
        ${sel.roomLock ? `<div class="pp-breq no"><span>${esc(sel.roomLock)}</span><b></b>${tick(false)}</div>` : w.room ? `<div class="pp-breq ok"><span>${esc(w.roomName || "The room")}</span><b></b>${tick(true)}</div>` : ""}
        ${sel.fee ? `<div class="pp-breq${feeOk ? " ok" : " no"}"><span>A fee of ${coinTxt(sel.fee)}</span><b>${coinTxt(w.coins)}</b>${tick(feeOk)}</div>` : ""}
        <div class="pp-label">Materials</div>
        ${sel.needs.map((n) => `<div class="pp-bmat${n.have >= n.need ? " ok" : " no"}" data-iteminfo="${n.id}" title="${esc(n.name)}${n.stored ? ` (${n.stored.toLocaleString()} in the bank)` : ""}"><img alt="" src="${itemIcon(n.id, 24)}"><span>${esc(n.name)}</span><b>${n.have.toLocaleString()}/${n.need}</b>${tick(n.have >= n.need)}</div>`).join("")}
        <div class="pp-bamt"><button class="btn btn-sm" data-bstep="-1" ${max ? "" : "disabled"} aria-label="One fewer">−</button>
          <input type="range" class="pp-bslide" min="${max ? 1 : 0}" max="${max}" value="${max ? Math.min(max, +(benchAmt[w.id + sel.i] || max)) : 0}" ${max ? "" : "disabled"} aria-label="How many">
          <button class="btn btn-sm" data-bstep="1" ${max ? "" : "disabled"} aria-label="One more">+</button>
          <input class="input pp-bnum" type="number" min="${max ? 1 : 0}" max="${max}" value="${max ? Math.min(max, +(benchAmt[w.id + sel.i] || max)) : 0}" ${max ? "" : "disabled"} aria-label="How many, as a number"></div>
        <p class="stamp pp-bget">${max ? `Enough for ${max.toLocaleString()}.` : !sel.open ? `Train ${esc(w.skill ? Core.SKILLS[w.skill].name : "it")} to level ${sel.level} first.` : sel.roomLock ? esc(sel.roomLock) + "." : lacking.length ? `Enough for none -- missing ${esc(lacking.join(", "))}.` : !feeOk ? "Not enough coins for the fee." : "You can't make it yet."}</p>
        <button class="btn btn-primary pp-bmake" data-bmake="${sel.i}" ${max ? "" : "disabled"}>${benchVerb(w).toUpperCase()}</button>`;
    })();
    return `<div class="pp-bench">
      <div class="pp-bleft">
        ${from ? `<div class="pp-bfrom">From your bag: <b>${esc(Core.ITEMS[from].name.toLowerCase())}</b> -- what it makes here. <button class="btn btn-sm btn-quiet" data-bfromx>Show everything</button></div>` : ""}
        ${groups.length > 1 ? `<div class="pp-btabs">${(from ? [["@from", []]] : []).concat([["All", w.recipes]], groups).map(([k, v]) => k === "@from" ? `<button class="pp-btab on" data-btab="@from">${esc(Core.ITEMS[from].name)}</button>`
          : `<button class="pp-btab${k === tab ? " on" : ""}" data-btab="${esc(k)}">${esc(k)} <small>${v.length}</small></button>`).join("")}</div>` : ""}
        <input class="input pp-bq" type="search" placeholder="Find a recipe or an ingredient…" value="${esc(benchQuery[w.id] || "")}" aria-label="Find a recipe">
        <div class="pp-bgrid">${shown.map(cell).join("") || `<p class="stamp">Nothing here matches.</p>`}</div>
      </div>
      <div class="pp-bright">${right}</div></div>`;
  }
  let benchAmt = {};
  /** Wire a bench drawn by benchHTML inside `card`; `run(action, opts)` acts and redraws. */
  function benchWire(card, w, run, redraw) {
    card.querySelectorAll("[data-bsel]").forEach((b) => b.addEventListener("click", () => { benchSel[w.id] = +b.dataset.bsel; redraw(); }));
    card.querySelectorAll("[data-btab]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.btab !== "@from") { benchFrom = ""; benchTab[w.id] = b.dataset.btab; } benchQuery[w.id] = ""; redraw(); }));
    const fx = card.querySelector("[data-bfromx]"); if (fx) fx.addEventListener("click", () => { benchFrom = ""; redraw(); });
    const bq = card.querySelector(".pp-bq");
    if (bq) bq.addEventListener("input", () => { benchQuery[w.id] = bq.value; const at = bq.selectionStart; redraw(); const n = card.querySelector(".pp-bq"); if (n) { n.focus(); n.setSelectionRange(at, at); } });
    const sl = card.querySelector(".pp-bslide"), nb = card.querySelector(".pp-bnum"), mk = card.querySelector(".pp-bmake");
    const set = (v) => { if (!sl) return; const n = Math.max(+sl.min, Math.min(+sl.max, Math.floor(+v) || 0)); sl.value = nb.value = n; if (mk) benchAmt[w.id + mk.dataset.bmake] = n; };
    if (sl) { sl.addEventListener("input", () => set(sl.value)); nb.addEventListener("input", () => set(nb.value)); }
    card.querySelectorAll("[data-bstep]").forEach((b) => b.addEventListener("click", () => set(+nb.value + +b.dataset.bstep)));
    if (mk) mk.addEventListener("click", () => { const r = w.recipes.find((x) => x.i === +mk.dataset.bmake); if (r) run("craft", {workshop: w.id, make: r.make, i: r.i, times: Math.max(1, +nb.value || 1)}); });
  }
  /** Which of your own benches (the estate's) make something from `id`: [bench id]. */
  function benchesUsing(id) {
    const {s, now} = current();
    return Core.villageView(s, now).filter((w) => !w.npc && benchPlain(w) && w.recipes.some((r) => r.needs.some((n) => n.id === id))).map((w) => w.id);
  }
  /** Is `id` an ingredient at one of your own benches? (static: the recipes, worked out once -- cheap enough for every bag card) */
  let BENCH_USES = null;
  function benchUses(id) {
    if (!BENCH_USES) { BENCH_USES = new Set(); Object.values(Core.WORKSHOPS).forEach((w) => { if (!w.npc) (w.recipes || []).forEach((r) => Object.keys(r.needs || {}).forEach((k) => BENCH_USES.add(k))); }); }
    return BENCH_USES.has(id);
  }
  // ---- I5 b6 (kept in Q6): quest items show who wants them -- each person's quest in hand (the first not done that's open)
  function questWants(s) {
    const out = {}, done = s.quests || {};
    Object.keys(Core.PEOPLE).forEach((p) => {
      const P = Core.PEOPLE[p], q = (P.quests || []).find((x) => !done[x.id] && Core.questOpen(s, x));
      if (!q) return;
      (q.needs || []).forEach((n) => Object.keys(n.bring || {}).forEach((k) => { out[k] = out[k] || {person: p, name: P.name, look: P.look, quest: q.name, need: n.bring[k]}; }));
    });
    return out;
  }
  document.addEventListener("click", (e) => {
    const f = e.target.closest && e.target.closest("[data-qperson]"); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const r = f.dataset.qperson; if (Core.REGIONS[r]) { worldRegion = r; goTo("pet:world"); } else goTo("pet:world");
  }, true);
