  // ---- home (2026-10-07, Cam: "build a new area called home, inside the home it has different areas like
  //      kitchen where i cook, smithy ..., shed ..., library ... Each area starts off basic and you have to
  //      build house upgrades") -- the Workshop page is your house now: its rooms, their benches, upgrades
  const ROOM_ICON = {kitchen: "obj_kitchen", smithy: "obj_anvil", shed: "obj_bench", library: "obj_herbs", bedroom: "petbed", storeroom: "woodcrate"};
  let storeQuery = "", storeDrag = "", storeOverflow = false, bankTab = 0, bankSort = "rare";   // bankSort: like the bag's Order (PT14 b3)      // the bank (Modernize/Reduce Nav): 0 = every tab, 1..9 a tab
  // 2026-10-08 (Cam: "workshop is where all the workshop stuff will live ... Equipment, storeroom will live in
  // storeroom"): the Workshop shows the bench rooms; the House and the Storeroom hubs show their own room
  function renderHouse(host) {
    // the painted workshop (2026-10-08): every bench, each room's upgrade, and the garden
    const {s, now} = current(), hv = Core.houseView(s, now), shops = {};
    Core.villageView(s, now).forEach((w) => { shops[w.id] = w; });
    const places = hv.rooms.filter((r) => r.workshops.length).map((r) => ({key: "room:" + r.id, name: `${r.tierName} ${r.name.toLowerCase()}`,
        note: r.tier > 1 ? "Now " + r.tierName.toLowerCase() : "", ready: !!(r.next && r.next.can)}))
      // (2026-10-10, Cam: "Remove the number to make underneath the crafting stations scroll") -- just the bench's name
      .concat(Object.keys(shops).filter((k) => !shops[k].npc).map((k) => ({key: k, name: shops[k].name,
        ...(benchFrom && shops[k].recipes && shops[k].recipes.some((r) => r.needs.some((n) => n.id === benchFrom)) ? {here: true, hereText: "Uses " + Core.ITEMS[benchFrom].name.toLowerCase()} : {})})), [{key: "pet:farm", name: "The garden"}]);
    host.innerHTML = `<div class="pp-page"><p class="pp-status" id="pp-status">${esc(status)}</p>
      ${benchFrom ? `<div class="pp-bfrom pp-bfrom-hub">Using <b>${esc(Core.ITEMS[benchFrom].name.toLowerCase())}</b>: the glowing benches make something from it -- click one. <button class="btn btn-sm btn-quiet" id="pp-bfrom-x">Cancel</button></div>` : ""}
      ${paintedHTML("workshop", places)}
      </div>`;
    const bx = host.querySelector("#pp-bfrom-x"); if (bx) bx.addEventListener("click", () => { benchFrom = ""; render(); });
    wirePainted(host, (k) => { if (k.startsWith("pet:") || k.startsWith("room:")) { benchFrom = ""; return hubGo(host, k); } openShop = k; showShop(); });
    if (openShop) showShop();
    if (document.querySelector(".pp-store-modal")) showStore();
    showSec();
  }
  function roomsHTML(want, intro) {
    const {s, now} = current();
    const hv = Core.houseView(s, now), shops = {};
    Core.villageView(s, now).forEach((w) => { shops[w.id] = w; });
    const card = (w) => {
      const can = w.identify ? (w.unid ? 1 : 0) : w.recipes.filter((r) => r.can).length;
      return `<button class="pp-villager" data-ws="${w.id}">
        <img alt="" src="${shopIcon(w, 48)}">
        <b>${esc(w.name)}</b><span class="stamp">${esc(Core.SKILLS[w.skill].name)} · level ${w.level}</span>
        <span class="pp-bar"><span style="width:${Math.round(w.progress * 100)}%"></span></span>
        <span class="stamp">${w.grind ? (w.grind.length ? `${w.grind.length} weapon${w.grind.length === 1 ? "" : "s"}${w.grind.some((x) => x.retemper) ? " · one to re-temper" : ""}` : "No weapons on you") : w.altar ? (w.altar.length ? `${w.altar.length} enchant${w.altar.length === 1 ? "" : "s"} known` : "No enchants known yet") : w.identify ? (w.unid ? `${w.unid} herbs to identify` : "Nothing to identify") : can ? `${can} thing${can === 1 ? "" : "s"} you can make` : "Nothing you can make yet"}</span></button>`;
    };
    const tierDots = (t) => [1, 2, 3, 4].map((i) => `<span class="pp-tier-dot${i <= t ? " on" : ""}"></span>`).join("");
    return `
        <p class="stamp"${intro ? "" : " hidden"}>Every room starts basic — build it up to make better things (a workshop room limits the level of what its benches make).
          Building trains <b>Construction</b> (level ${hv.con}); saw planks at the sawbench in your shed. ${coinTxt(s.coins || 0)}</p>
        <div class="pp-rooms">${hv.rooms.filter(want).map((r) => `
          <section class="pp-room room-${r.id}">
            <header class="pp-room-head">
              <img alt="" src="${itemIcon(ROOM_ICON[r.id], 40)}">
              <div><b>${esc(r.tierName)} ${esc(r.name.toLowerCase())}</b> <span class="pp-tier-dots" title="Tier ${r.tier} of 4">${tierDots(r.tier)}</span>
                <div class="stamp">${esc(r.perks)}</div></div>
            </header>
            ${r.workshops.length ? `<div class="pp-village pp-room-benches">${r.workshops.filter((k) => shops[k]).map((k) => card(shops[k])).join("")}</div>` : ""}
            ${r.id === "storeroom" ? `<p class="stamp">${hv.storage.used}/${hv.storage.cap} kinds in the bank</p>
              <button class="btn" id="pp-open-store">Open the bank</button>` : ""}
            ${r.id === "bedroom" ? `` : ""}
            ${r.id === "shed" ? `<button class="btn btn-quiet" data-jump="pet:farm">The garden: plots and herb pots</button>` : ""}
            ${r.next ? `<div class="pp-room-next">
                <div><b>Build ${esc(r.next.name.toLowerCase())} ${esc(r.name.toLowerCase())}</b> <span class="stamp">· ${esc(r.next.perks)} · +${r.next.xp} Construction xp</span></div>
                <div class="pp-needs">
                  <span class="pp-need-chip${hv.con >= r.next.con ? "" : " lack"}">Construction ${hv.con}/${r.next.con}</span>
                  <span class="pp-need-chip${(s.coins || 0) >= r.next.coins ? "" : " lack"}">${coinTxt(r.next.coins)}</span>
                  ${r.next.needs.map((n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}" title="${esc(n.name)}" data-iteminfo="${n.id}"><img alt="" src="${itemIcon(n.id, 16)}">${n.have}/${n.need}</span>`).join("")}
                </div>
                <button class="btn btn-sm ${r.next.can ? "btn-primary" : ""} pp-build" data-room="${r.id}" ${r.next.can ? "" : "disabled"}>Build</button>
              </div>` : `<p class="stamp pp-room-done">As grand as it gets.</p>`}
          </section>`).join("")}</div>`;
  }
  function wireRooms(host) {
    host.querySelectorAll(".pp-room .pp-villager").forEach((b) => b.addEventListener("click", () => { openShop = b.dataset.ws; showShop(); }));
    host.querySelectorAll(".pp-build").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("build", {room: b.dataset.room});
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
    }));
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.jump)));
    const st = host.querySelector("#pp-open-store");
    if (st) st.addEventListener("click", () => showStore());
    if (openShop) showShop();
    if (document.querySelector(".pp-store-modal")) showStore();
  }
  // ---- the bank (Modernize/Reduce Nav, 2026-10-18, Cam's N9: "a bank utilising the storeroom but allow better base storage size,
  //      and a way to tab and organise items same as runescapes bank ... reduce clicks and navigation options in the form of
  //      multiple chests"). RuneScape's layout: tabs along the top (All, then yours), the bank's things as a grid, your bag below.
  //      A click withdraws one (or deposits one from the bag); a right click has the rest; drag a thing onto a tab to move it.
  function showStore() {
    let box = document.querySelector(".pp-modal.pp-store-modal");
    const {s, now} = current();
    const hv = Core.houseView(s, now), bag = Core.bagList(s).filter((x) => x.id !== "unidherb");
    if (!box) {
      box = document.createElement("div");
      box.className = "pp-modal pp-store-modal";
      box.innerHTML = `<div class="pp-modal-card pp-shop-card pp-bank" role="dialog" aria-label="Bank"></div>`;
      document.body.appendChild(box);
      box.addEventListener("click", (e) => { if (e.target === box) { box.remove(); render(); } });
      box.addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.querySelector(".np-ctx")) { box.remove(); render(); } });
    }
    const card = box.querySelector(".pp-shop-card");
    const keep = card.querySelector(".pp-bank-grid") ? card.querySelector(".pp-bank-grid").scrollTop : 0;
    const typing = document.activeElement && document.activeElement.id === "pp-store-q";
    const q = storeQuery.trim().toLowerCase(), hit = (n) => !q || n.toLowerCase().includes(q);
    const tabs = hv.storage.chests || [], ovRows = hv.storage.overflow || [];
    if (!ovRows.length) storeOverflow = false;
    if (bankTab > tabs.length) bankTab = 0;
    // the tabs you've started (named, or with something in them), and one more to start
    const live = tabs.filter((t) => t.i === 0 || t.named || t.used), next = tabs.find((t) => t.i > 0 && !t.named && !t.used);
    const tabBtn = (t) => `<button class="pp-bank-tab${!storeOverflow && bankTab === t.i + 1 ? " on" : ""}" data-btab="${t.i + 1}" title="${esc(t.name)} -- ${t.used} kind${t.used === 1 ? "" : "s"}. Drop things here to move them; right-click to rename">
        ${t.items[0] ? `<img alt="" src="${itemIcon(t.items[0].id, 24)}">` : ""}<span>${esc(t.name)}</span></button>`;
    const cell = (x, tab) => `<button class="pp-bank-cell" draggable="true" data-bitem="${esc(x.id)}" data-btabof="${tab}" title="${esc(x.name)} × ${x.count.toLocaleString()} -- click: take 1 · right-click: more">
        <img alt="" src="${itemIcon(x.id, 32)}"><span class="np-kit-n">${kitCount(x.count) || ""}</span></button>`;
    const order = (list) => list.slice().sort(bankSort === "name" ? (a, c) => a.name.localeCompare(c.name) : bankSort === "most" ? (a, c) => c.count - a.count || a.name.localeCompare(c.name) : (a, c) => c.gem - a.gem || a.name.localeCompare(c.name));
    const shown = storeOverflow ? null : bankTab ? tabs.filter((t) => t.i === bankTab - 1) : tabs.filter((t) => t.items.length);
    const grid = storeOverflow ? `<div class="pp-bank-sec">${ovRows.filter((x) => hit(x.name)).map((x) => cell(x, "ov")).join("") || `<p class="stamp">Nothing here matches.</p>`}</div>`
      : shown.map((t) => { const its = order(t.items.filter((x) => hit(x.name)));
          // (I9, 2026-10-19, Cam: "when in All view to drag and drop from one organized tab to another") -- each tab's part of All is a drop target
          const sec = its.length ? `<div class="pp-bank-sec">${its.map((x) => cell(x, t.i)).join("")}</div>` : "";
          return bankTab ? sec : its.length ? `<div class="pp-bank-group" data-bsec="${t.i}" title="Drop things here to move them to ${esc(t.name)}"><div class="pp-bank-divider">${esc(t.name)}</div>${sec}</div>` : ""; }).join("")
        || `<p class="stamp">${q ? "Nothing in the bank matches." : bankTab ? "This tab is empty -- drag things onto it, or deposit from your bag below." : "The bank is empty -- click things in your bag below to put them in."}</p>`;
    card.innerHTML = `<button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
      <div class="pp-shop-head"><img class="pp-npc" alt="" src="${itemIcon("obj_chest", 48)}">
        <div><b>Bank${hv.storage.here && hv.storage.here !== "home" ? ` · ${esc(hv.storage.here)}` : ""}</b> <span class="pp-level">${hv.storage.used}/${hv.storage.cap} kinds</span>
          <div class="stamp">What's here is safe, even if you fall -- and the benches here use it. Click to take one; right-click for more; drag onto a tab to sort.</div>
          ${hv.storage.here === "home" ? `<button class="btn btn-sm btn-quiet" id="pp-bank-room" title="Build a bigger store room for a bigger bank">The store room ›</button>` : ""}</div></div>
      <nav class="pp-bank-tabs" aria-label="Bank tabs">
        <button class="pp-bank-tab${!storeOverflow && !bankTab ? " on" : ""}" data-btab="0" title="Everything, tab by tab">All</button>
        ${live.map(tabBtn).join("")}
        ${next ? `<button class="pp-bank-tab add" data-btab="${next.i + 1}" title="A new tab: drop something on it">+</button>` : ""}
        ${ovRows.length ? `<button class="pp-bank-tab ov${storeOverflow ? " on" : ""}" data-bov="1" title="What didn't fit when bags got smaller -- take only">Overflow</button>` : ""}
      </nav>
      <div class="pp-bank-tools"><input class="input" id="pp-store-q" type="search" placeholder="Search the bank…" value="${esc(storeQuery)}" aria-label="Search the bank">
        <select class="input pp-bank-order" id="pp-bank-order" aria-label="Order">${[["rare", "Rarest first"], ["name", "A to Z"], ["most", "Most first"]].map(([k, n]) => `<option value="${k}" ${bankSort === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <button class="btn btn-sm" id="pp-bank-deposit" title="Everything in your bag goes in (what you wear and carry stays)">Deposit bag</button></div>
      <p class="pp-status" id="pp-shop-status">${esc(status)}</p>
      <div class="pp-bank-grid pp-drop" data-drop="bank">${grid}</div>
      <div class="pp-bank-bag pp-drop" data-drop="bag">
        <div class="pp-label">Your bag <span class="stamp">${Core.bagUsed(s)}/${Core.bagCap(s)} slots · click to put one in, right-click for more</span></div>
        <div class="pp-bank-sec">${bag.map((x) => `<button class="pp-bank-cell" draggable="true" data-bbag="${esc(x.id)}" title="${esc(x.name)} × ${x.count.toLocaleString()} -- click: put 1 in · right-click: more">
            <img alt="" src="${itemIcon(x.id, 32)}"><span class="np-kit-n">${kitCount(x.count) || ""}</span></button>`).join("") || `<p class="stamp">Your bag is empty.</p>`}</div></div>`;
    const g = card.querySelector(".pp-bank-grid"); if (g) g.scrollTop = keep;
    card.querySelector(".pp-shop-x").addEventListener("click", () => { box.remove(); render(); });
    const qi = card.querySelector("#pp-store-q");
    qi.addEventListener("input", () => { storeQuery = qi.value; showStore(); const n = document.querySelector("#pp-store-q"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
    if (typing) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
    const said = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); } else status = ""; showStore(); };
    const take = async (id, n, ov) => said(await act("withdraw", ov ? {item: id, n, from: "overflow"} : {item: id, n}));
    const moveTo = async (id, tab) => said(await act("banktab", {item: id, tab}));
    card.querySelector("#pp-bank-order").addEventListener("change", (e) => { bankSort = e.target.value; showStore(); });
    const br = card.querySelector("#pp-bank-room"); if (br) br.addEventListener("click", () => { box.remove(); openPlace("room:storeroom"); });
    card.querySelector("#pp-bank-deposit").addEventListener("click", async () => said(await act("deposit", {tab: bankTab > 0 ? bankTab - 1 : 0})));
    card.querySelectorAll("[data-btab]").forEach((b) => {
      b.addEventListener("click", () => { storeOverflow = false; bankTab = +b.dataset.btab; showStore(); });
      if (+b.dataset.btab > 0) b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const i = +b.dataset.btab - 1, t = tabs[i];
        ctxMenu(e.clientX, e.clientY, t.name, [
          {label: "Rename…", fn: async () => { const nm = await askText({title: "Name this tab", label: "Blank for none", value: t.named ? t.name : "", max: 20, ok: "Save"}); if (nm !== null) said(await act("tabname", {tab: i, name: nm})); }},
          {label: "Clear the name", off: !t.named, fn: async () => said(await act("tabname", {tab: i, name: ""}))}]);
      });
    });
    const ovb = card.querySelector("[data-bov]"); if (ovb) ovb.addEventListener("click", () => { storeOverflow = true; showStore(); });
    // the bank's things: click takes one; right click has the rest
    card.querySelectorAll("[data-bitem]").forEach((b) => {
      const id = b.dataset.bitem, ov = b.dataset.btabof === "ov", have = ov ? (ovRows.find((x) => x.id === id) || {}).count || 0 : (tabs.flatMap((t) => t.items).find((x) => x.id === id) || {}).count || 0;
      b.addEventListener("click", () => take(id, 1, ov));
      b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const nm = Core.ITEMS[id].name, items = [{label: "Take 1", fn: () => take(id, 1, ov)}];
        if (have > 5) items.push({label: "Take 5", fn: () => take(id, 5, ov)});
        if (have > 10) items.push({label: "Take 10", fn: () => take(id, 10, ov)});
        if (have > 1) { items.push({label: "Take all", fn: () => take(id, "all", ov)}); items.push({label: "Take X…", fn: async () => { const n = await askCount(nm.toLowerCase(), have); if (n) take(id, n, ov); }}); }
        if (!ov) { items.push({sep: true}); tabs.filter((t) => (t.i === 0 || t.named || t.used || t === next) && t.i !== +b.dataset.btabof).forEach((t) => items.push({label: "Move to " + (t.named || t.i === 0 ? t.name : "a new tab"), fn: () => moveTo(id, t.i)})); }
        items.push({sep: true}, {label: "Examine", fn: () => showItem(id)});
        ctxMenu(e.clientX, e.clientY, nm + " (" + have.toLocaleString() + ")", items);
      });
      b.addEventListener("keydown", (e) => { if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); const r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent("contextmenu", {clientX: r.left, clientY: r.bottom, bubbles: true})); } });
      b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", (ov ? "withdraw" : "move") + ":" + id); e.dataTransfer.effectAllowed = "move"; storeDrag = ov ? "withdraw" : "move"; bankDragFrom = ov ? -1 : +b.dataset.btabof; });
    });
    // your bag: click puts one in (into the open tab); right click has the rest (the side panel's menu)
    card.querySelectorAll("[data-bbag]").forEach((b) => {
      const id = b.dataset.bbag;
      b.addEventListener("click", () => storeIt(id, 1));
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); bagMenu(id, e.clientX, e.clientY); });
      b.addEventListener("keydown", (e) => { if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); const r = b.getBoundingClientRect(); bagMenu(id, r.left, r.bottom); } });
      b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", "store:" + id); e.dataTransfer.effectAllowed = "move"; storeDrag = "store"; });
    });
    // drag and drop: a bag thing onto the bank or a tab stores it (all of it); a bank thing onto a tab moves it, onto the bag takes it
    let bankDragFrom = -1;
    const wants = (t, kind) => t.dataset.bsec !== undefined ? kind === "store" || (kind === "move" && +t.dataset.bsec !== bankDragFrom)
      : t.dataset.btab !== undefined ? (kind === "store" || kind === "move") && +t.dataset.btab > 0 || (kind === "store" && t.dataset.btab === "0")
      : t.dataset.drop === "bank" ? kind === "store" : t.dataset.drop === "bag" ? kind === "move" || kind === "withdraw" : false;
    card.querySelectorAll(".pp-bank-tab[data-btab], .pp-drop, [data-bsec]").forEach((t) => {
      t.addEventListener("dragover", (e) => { if (!wants(t, storeDrag)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; t.classList.add("over"); });
      t.addEventListener("dragleave", (e) => { if (!t.contains(e.relatedTarget)) t.classList.remove("over"); });
      t.addEventListener("drop", (e) => {
        t.classList.remove("over");
        const [kind, id] = (e.dataTransfer.getData("text/plain") || "").split(":");
        if (!id || !wants(t, kind)) return;
        e.preventDefault(); e.stopPropagation();
        const tab = t.dataset.bsec !== undefined ? +t.dataset.bsec : t.dataset.btab !== undefined ? +t.dataset.btab - 1 : -1;
        if (kind === "store") return storeIt(id, "all", tab >= 0 ? tab : undefined);
        if (kind === "move") return tab >= 0 ? moveTo(id, tab) : take(id, "all");
        return take(id, "all", true);
      });
    });
  }
  function closeShop() {
    openShop = "";
    const box = document.querySelector(".pp-modal.pp-shop-modal");
    if (box) box.remove();
    render();
  }


