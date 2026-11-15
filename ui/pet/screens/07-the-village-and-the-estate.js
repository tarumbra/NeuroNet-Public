  // ---- the village (slice 3) ------------------------------------------------------------
  // Cam (2026-10-03): "Have the village screen prsented as cards, so then when i click on a card it
  // pops up with the respective menu. So only when i click on Bram will it pop up with brams
  // crafting menu."
  let openShop = "", shopQuery = "", shopQueryFor = "";
  // where each of your making skills is done
  const SKILL_SHOP = Object.fromEntries(Core.SKILL_REG.filter((k) => k.bench).map((k) => [k.id, k.bench]));   // a making skill's bench
  const coinTxt = (n) => `🪙 ${Number(n).toLocaleString()}`;
  // a price under a coin reads as so much per 100 (2026-10-10, audit MATH-5: "17 old boots for 1 coin" looked broken)
  const eachTxt = (n) => n > 0 && n < 1 ? `${coinTxt(Math.round(n * 100 * 100) / 100)} per 100` : `${coinTxt(n)} each`;
  function shopIcon(w, size) { return w.icon ? itemIcon(w.icon, size) : avatarURL(w.look, size); }
  function shopRecipesHTML(w) {
    return w.recipes.slice().sort((a, b) => a.level - b.level).map((r) => `
      <div class="pp-recipe${r.can ? "" : " short"}" data-find="${esc([r.name, r.does || "", ...r.needs.map((n) => n.name)].join(" ").toLowerCase())}">
        <img alt="" src="${itemIcon(r.make, 32)}">
        <div class="pp-recipe-main">
          <div><b>${r.n > 1 ? r.n + " × " : ""}${esc(r.name)}</b>${r.have ? ` <span class="pp-count">${r.have}</span>` : ""}
            <span class="stamp">${r.roomLock ? ` · <b class="pp-lock">${esc(r.roomLock.replace(" (build it at home)", ""))}</b>` : !r.open ? ` · <b class="pp-lock">needs level ${r.level}</b>` : ""}${r.xp ? ` · +${r.xp} xp` : ""}</span></div>
          <div class="stamp">${esc(r.does)}</div>
          <div class="pp-needs">${r.needs.map((n) => `<span class="pp-need-chip${n.have >= n.need ? "" : " lack"}" title="${esc(n.name)}${n.stored ? ` (${n.stored.toLocaleString()} of them in the bank)` : ""} -- click for where to get it" data-iteminfo="${n.id}">
            <img alt="" src="${itemIcon(n.id, 16)}">${n.have}/${n.need}</span>`).join("")}
            ${r.fee ? `<span class="pp-need-chip${w.coins >= r.fee ? "" : " lack"}" title="Coins">${coinTxt(r.fee)}</span>` : ""}</div>
        </div>
        <span class="pp-sellbtns">
        <button class="btn btn-sm pp-make" data-ws="${w.id}" data-make="${r.make}" data-i="${r.i}" ${r.can ? "" : "disabled"}>
          ${r.roomLock ? (/opens in the story/.test(r.roomLock) ? "Story" : "Upgrade") : !r.open ? `Level ${r.level}` : w.skill === "cooking" ? "Cook" : w.npc ? "Transmute" : w.id === "furnace" ? "Smelt" : w.id === "tanner" ? "Tan" : "Make"}</button>
        ${r.can && r.times > 1 ? `<button class="btn btn-sm btn-quiet pp-make" data-ws="${w.id}" data-make="${r.make}" data-i="${r.i}" data-times="all"
          title="Make it as many times as you have the ingredients for${w.npc ? " and the coins" : ""} — ${r.times}">${w.skill === "cooking" ? "Cook all" : "All"} (${r.times}${w.skill === "cooking" ? "" : "×"})</button>
        <button class="btn btn-sm btn-quiet pp-make" data-ws="${w.id}" data-make="${r.make}" data-i="${r.i}" data-times="ask" data-max="${Math.min(1000, r.times)}" data-name="${esc(r.name || Core.ITEMS[r.make].name)}" data-xp="${r.xp || 0}" title="Choose how many (V7)">×?</button>` : ""}
        </span>
      </div>`).join("");
  }
  // the Herb table (Herblore, 2026-10-06): unidentified herbs in, named herbs out -- and into the Herbarium
  const ROMAN = ["I", "II", "III", "IV", "V"];
  // (2026-10-20: these four in the crafting bench's look -- a grid on the left, the one you picked on the right)
  function identifyHTML(w) {
    const known = (t) => t.herbs.find((h) => h.known);
    const items = [{key: "unid", icon: itemIcon("unidherb", 48), name: "Unidentified herbs", badge: w.unid || "", can: !!w.unid}]
      .concat(w.identify.map((t) => ({key: "t" + t.tier, icon: itemIcon(known(t) ? known(t).id : "unidherb", 48), name: `Tier ${ROMAN[t.tier - 1]}`, corner: ROMAN[t.tier - 1], lock: !t.open, lockWord: `lv ${t.level}`, t})));
    return gridBenchHTML("herbs", [{id: "herbs", label: "Herbs", items}], (it) => {
      if (it.key === "unid") return gbHead(itemIcon("unidherb", 64), "Unidentified herbs", [`${w.unid || 0} in your bag`, `Herbarium ${w.found}/${w.total}`])
        + `
        <div class="pp-row"><button class="btn btn-primary pp-bmake pp-identify" ${w.unid ? "" : "disabled"}>IDENTIFY</button>${w.unid > 1 ? `<button class="btn pp-identify" data-all="1">All ${w.unid}</button>` : ""}</div>`;
      const t = it.t;
      return gbHead(itemIcon(known(t) ? known(t).id : "unidherb", 64), `Tier ${ROMAN[t.tier - 1]}`, [`Herblore ${t.level}`, `+${t.xp} xp each`, t.double ? `${Math.round(t.double * 100)}% in twos` : ""])
        + `<div class="pp-label">Its herbs</div>${t.herbs.map((h) => h.known ? gbMat(h.id, esc(h.name), true) : `<div class="pp-bmat no"><span>? ? ? -- not yet identified</span></div>`).join("")}`;
    });
  }
  // the notice board (2026-10-07): three orders a day, for the things you've plenty of
  function ordersHTML(w) {
    const items = w.orders.map((o) => ({key: "o" + o.i, icon: itemIcon(o.id, 48), name: `${o.n} × ${o.name}`, badge: o.done ? "✓" : `${o.have}/${o.n}`, can: o.can, o}));
    return gridBenchHTML("orders", [{id: "orders", label: "Orders", items, empty: "Nothing on the board yet — go gathering first."}], (it) => { const o = it.o;
      return gbHead(itemIcon(o.id, 64), `${o.n} × ${esc(o.name)}`, [coinTxt(o.coins), `+${o.xp} ${esc(o.skill)} xp`, "a wooden crate"])
        + `${gbMat(o.id, `${o.have}/${o.n}`, o.have >= o.n)}
        <button class="btn btn-primary pp-bmake pp-order" data-i="${o.i}" ${o.can ? "" : "disabled"}>${o.done ? "FILLED ✓" : "FILL"}</button>`; });
  }
  // the grindstone (2026-10-15): every weapon you hold or carry -- where it is, how worn, and its one re-tempering
  function grindHTML(w) {
    const items = w.grind.map((x) => ({key: x.id, icon: itemIcon(x.id, 48), name: x.name, badge: `${100 - x.pct}%`, can: !!x.retemper, x}));
    return gridBenchHTML("grind", [{id: "grind", label: "Weapons", items, empty: "No weapons on you. Every weapon you hold or carry shows here, with how worn it is."}], (it) => { const x = it.x;
      return gbHead(itemIcon(x.id, 64), esc(x.name), [esc(x.where) + (x.count > 1 ? ` (×${x.count})` : ""), x.tempered ? "re-tempered" : ""])
        + `<div class="pp-slot-wear"><span class="pp-wear" title="${x.left} of ${x.dur} blows left"><span style="width:${100 - x.pct}%" class="${x.pct >= 90 ? "low" : x.pct >= 75 ? "mid" : ""}"></span></span>
          <span class="stamp">${x.left.toLocaleString()} of ${x.dur.toLocaleString()} blows left</span></div>
        ${x.retemper ? `<div class="pp-label">Re-tempering takes</div>${x.retemper.coins ? `<div class="pp-bmat"><span>${coinTxt(x.retemper.coins)}</span></div>` : Object.keys(x.retemper.needs).map((k) => gbMat(k, `${x.retemper.needs[k]} ${esc(Core.ITEMS[k].name.toLowerCase())}`)).join("")}` : `<p class="stamp">${esc(x.why)}</p>`}
        
        <button class="btn btn-primary pp-bmake pp-grind" data-item="${esc(x.id)}" ${x.retemper ? "" : "disabled"}>RE-TEMPER</button>`; });
  }
  // the altar: the enchants you've learnt (what in your bag they go on), and the gems it cuts in the bench's own look
  let altarTab = "enchants";
  function altarHTML(w) {
    const seg = w.recipes.length ? `<div class="pp-btabs pp-altar-tabs"><button class="pp-btab${altarTab !== "gems" ? " on" : ""}" data-altartab="enchants">Enchants <small>${w.altar.length}</small></button>
      <button class="pp-btab${altarTab === "gems" ? " on" : ""}" data-altartab="gems">Enchanting gems <small>${w.recipes.length}</small></button></div>` : "";
    if (altarTab === "gems" && w.recipes.length) return seg + benchHTML(w);
    const items = w.altar.map((e) => ({key: e.id, icon: itemIcon("tome" + e.id, 48), name: e.name, corner: e.level, lock: !e.open, can: e.open && e.costOk && e.coinsOk && e.targets.length > 0, e}));
    return seg + gridBenchHTML("altar", [{id: "ench", label: "Enchants", items, empty: "You don't know any enchants yet. Their tomes are found in ancient chests: bosses drop them now and then, the mage tower gives one for each rank."}], (it) => { const e = it.e;
      return gbHead(itemIcon("tome" + e.id, 64), esc(e.name), [`Enchanting ${e.level}`, "on " + esc(e.slots.join(", ").toLowerCase())])
        + `<p class="stamp">${esc(e.about)}</p>
        <div class="pp-label">It takes</div>${e.cost.map((c) => gbMat(c.id, `${c.have}/${c.need}`, c.have >= c.need)).join("")}
        <div class="pp-bmat${e.coinsOk ? " ok" : " no"}"><span>${coinTxt(e.coins)}</span></div>
        ${e.on.length ? `<p class="stamp">On now: ${esc(e.on.join(", "))}</p>` : ""}
        ${e.targets.length ? `<div class="pp-label">Put it on</div><select class="input pp-ench-pick" data-ench="${e.id}">${e.targets.map((t) => `<option value="${t.id}">${esc(t.name)}${t.has ? ` (${esc(t.has)})` : ""}</option>`).join("")}</select>
          <button class="btn btn-primary pp-bmake pp-enchant" data-ench="${e.id}" ${e.open && e.costOk && e.coinsOk ? "" : "disabled"}>ENCHANT</button>` : `<p class="stamp">Nothing in your bag it can go on.</p>`}`; });
  }
  function shopHeadHTML(w) {
    return `<div class="pp-shop-head">
        <img class="pp-npc" alt="" src="${shopIcon(w, 48)}">
        <div><b>${esc(w.npc ? `${w.who} the ${w.name.toLowerCase()}` : w.name)}</b>
          ${w.skill ? `<span class="pp-level">${esc(Core.SKILLS[w.skill].name)} level ${w.level}</span>` : ""}
          <span class="pp-level pp-coins">${coinTxt(w.coins)}</span>
          <div class="stamp">“${esc(w.says)}”</div></div>
      </div>
      ${w.skill ? `<div class="pp-npc-level"><span class="pp-bar"><span style="width:${Math.round(w.progress * 100)}%"></span></span>
        <span class="stamp">${w.toNext ? `${w.toNext.toLocaleString()} xp to level ${w.level + 1}` : "top level"} (your ${esc(Core.SKILLS[w.skill].name)})</span></div>` : ""}`;
  }
  // Cam (2026-10-04): "move all craft benchs to a new menu called workshop ... Village stays and is the
  // place you can find all the NPC" -- one page draws both, the workshops or the people.
  // painted in the village but not always there (petcore npcHere)
  const VILLAGE_AWAY = [["travelling", "only in town on Sundays", "Sundays"], ["reskinner", "comes once you've beaten two bosses", "After 2 bosses"]];
  function renderVillage(host, mode) {
    const {s, now} = current();
    const people = mode !== "workshop";
    const shops = Core.villageView(s, now).filter((w) => w.npc === people && !w.region);   // (the mirage merchant is at the Oasis)
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${people ? "" : ``}
        ${people ? paintedHTML("village", ["pet:guild", "pet:nursery", "pet:market"].map((k) => ({key: k, name: {"pet:guild": "The Guild hall", "pet:nursery": "The Nursery", "pet:market": "The Marketplace"}[k]}))
            .concat(shops.map((w) => ({key: w.id, name: `${w.who} -- ${w.name}`,
              note: w.orders ? (w.ordersLeft ? `${w.ordersLeft} order${w.ordersLeft === 1 ? "" : "s"} today` : "") : w.identify && w.unid ? `${w.unid} to identify` : ""})), VILLAGE_AWAY.filter(([k]) => !shops.some((w) => w.id === k))
              .map(([k, lock, short]) => ({key: k, name: `${Core.WORKSHOPS[k].who} -- ${Core.WORKSHOPS[k].name}`, lock, lockShort: short})))) : ""}
        <div class="pp-village"${people ? " hidden" : ""}>${shops.map((w) => {
          const can = w.identify ? (w.unid ? 1 : 0) : w.orders ? w.orders.filter((o) => o.can).length : w.recipes.filter((r) => r.can).length;
          const sub = w.npc ? w.name : `${Core.SKILLS[w.skill].name} · level ${w.level}`;
          const line = w.orders ? (w.ordersLeft ? `${w.ordersLeft} order${w.ordersLeft === 1 ? "" : "s"} today` : "All filled — more tomorrow") : w.identify ? (can ? `${w.unid} herb${w.unid === 1 ? "" : "s"} to identify · Herbarium ${w.found}/${w.total}` : `Herbarium ${w.found}/${w.total} · find herbs foraging and digging`) : w.trade ? (w.id === "travelling" ? "Exotic eggs · pays more" : "Buy and sell") : w.reskin ? "Recolour a pet"
            : w.npc && !can ? "Lots of one thing into one better"
            : can ? `${can} thing${can === 1 ? "" : "s"} you can make now` : "Nothing you can make yet";
          return `<button class="pp-villager${w.npc ? " is-npc" : ""}" data-ws="${w.id}">
            <img alt="" src="${shopIcon(w, 64)}">
            <b>${esc(w.npc ? w.who : w.name)}</b><span class="stamp">${esc(sub)}</span>
            ${w.skill ? `<span class="pp-bar"><span style="width:${Math.round(w.progress * 100)}%"></span></span>` : ""}
            <span class="stamp">${esc(line)}</span></button>`;
        }).join("")}</div>
      </div>`;
    host.querySelectorAll(".pp-villager[data-ws]").forEach((b) => b.addEventListener("click", () => { openShop = b.dataset.ws; showShop(); }));
    host.querySelectorAll("[data-door]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.door)));
    wirePainted(host, (key) => { if (key.startsWith("pet:")) return goTo(key);
      const away = VILLAGE_AWAY.find(([k]) => k === key && !shops.some((w) => w.id === k));
      if (away) return toast(`${Core.WORKSHOPS[key].who} isn't here -- ${away[1]}.`, true);
      openShop = key; showShop(); });
    if (openShop) showShop();
  }
  // ---- the estate and its buildings, and the nursery (2026-10-08, Cam: "workshop is where all the workshop
  //      stuff will live, the library is where all the books will live ... nursery is where Hatchery and breeding
  //      will be. Equipment, storeroom will live in storeroom. Bag, player, pets, my pet, expeditions will be at
  //      home ... This is all to move to a navigation style game.") -- each is a place with doors to the pages
  const HUBS = {
    "pet:estate": {scene: "estate", say: "Your own corner of the isle: the house, the workshop, the library, the store room -- and the graveyard.",
                   doors: ["pet:house", "pet:workshop", "pet:library", "pet:storeroom", "pet:graveyard", "pet:ranch", "pet:pen"], extra: [["cart", "Cart shed"]]},
    "pet:house": {scene: "house", say: "Home. Your pet, your bag, you -- and the bedroom, where a rest heals you faster.",
                  doors: ["pet:home", "pet:pets", "pet:bag", "pet:skills", "pet:expeditions"], room: "bedroom",
                  extra: [["room:bedroom", "Bedroom"], ["materials", "Material archive"], ["sec:hearth"], ["sec:dining"]], secs: ["hearth", "dining"]},
    "pet:library": {scene: "library", say: "Every book you keep: spells, enchants, herbs, creatures and pets.",
                    doors: ["pet:spellbook", "pet:enchants", "pet:herbarium", "pet:bestiary", "pet:dex"],
                    extra: [["sec:archive"], ["sec:reading"], ["sec:stacks"], ["sec:observatory"]], secs: ["archive", "reading", "stacks", "observatory"]},
    // (Equipment left the Storeroom for the Character sheet, 2026-10-15)
    "pet:storeroom": {scene: "storeroom", say: "The bank -- what's stored here is safe, even if you fall. The recycle stash by the barrels breaks old things down.",
                      doors: [], room: "storeroom", extra: [["room:storeroom", "Bank"], ["recycle", "Recycle stash"], ["recycled", "Recycled materials"]]},
    "pet:nursery": {scene: "nursery", say: "Where eggs are kept warm and pets are paired up.", doors: ["pet:hatchery", "pet:breed"], extra: [["pet:village", "Village"]]}};
