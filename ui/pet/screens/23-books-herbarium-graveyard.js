  // ---- the spellbook and the enchant book (2026-10-07, Cam: "spellbook added to the game with a list of spells
  //      that unlock at each level ... need to be equipped before a battle (magic loadout, the runes required)") ----
  function renderSpellbook(host) {                                       // (the Arcane's book, as a page -- the Library opens it as a pop-up; C4 D5)
    host.innerHTML = `<div class="pp-page"><section class="pp-shop gh-book">${classBookHTML("arcane")}</section></div>`;
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.sheetTab) sheetTab = b.dataset.sheetTab; sheetFrom = "pet:skills"; goTo(b.dataset.jump); }));
  }
  // ---- the Spellbook as a reference (2026-10-15, Cam, Q1: "keep the spellbook in the library ... have it act like a pop up
  //      with what level each spell unlocks, what element damage it does and what runes it takes ... Setting spells should
  //      all happen on the player page") -- opened from the Library; choosing your three is the Character sheet's Combat tab
  const ELEMENTS = ["fire", "water", "earth", "air"];
  // by its name first ("Wind strike" is air, "Frost nova" water), else the element it takes most runes of
  const NAMED = [[/wind|storm|air/i, "Air"], [/water|frost/i, "Water"], [/earth|petrif|bind/i, "Earth"], [/fire|meteor/i, "Fire"]];
  function spellElement(x) {
    if (x.element) return x.element[0].toUpperCase() + x.element.slice(1) + " — " + elementDoes(x.element);   // the rules' own (Part 6)
    const nm = NAMED.find(([re]) => re.test(x.name));
    if (nm) return nm[1];
    const by = {}; x.runes.forEach((r) => { const e = r.id.replace(/rune$/, ""); if (ELEMENTS.includes(e)) by[e] = (by[e] || 0) + r.n; });
    const top = Object.keys(by).sort((a, b) => by[b] - by[a]), most = top.filter((e) => by[e] === by[top[0]]);
    return most.length ? most.map((e) => e[0].toUpperCase() + e.slice(1)).join(" and ") : "None";
  }
  // what each element does when it lands (Battle Re-work Part 6)
  function elementDoes(el) { return {fire: "may burn", water: "may slow", earth: "may break its guard", air: "may knock it off balance"}[el] || ""; }
  /** Every spell -- one list, in the Arcane's class book (C4 D5, 2026-10-16: the Library's Spellbook and the book were two). */
  /** The spells, for the Arcane's book. from/to: one page of them (the book's pages, 2026-10-17); the head and the button
   *  go on the first and the last page. */
  function spellbookRefHTML(from, to) {
    const {s} = current();
    const sb = Core.spellbookView(s), all = sb.spells.length;
    from = from || 0; to = to === undefined ? all : Math.min(all, to);
    sb.spells = sb.spells.slice(from, to);
    const runes = (x) => x.runes.map((r) => `<span class="pp-need-chip" data-iteminfo="${r.id}"><img alt="" src="${itemIcon(r.id, 16)}">${r.n} ${esc(Core.ITEMS[r.id].name.toLowerCase().replace(/ rune$/, ""))}</span>`).join("");
    return `${from ? "" : `<div class="pp-shop-head"><img class="pp-npc" alt="" src="${itemIcon("tomearcanist", 48)}"><div><b>Spellbook</b>
        <div class="stamp">Magic level ${sb.level} · ${esc(sb.rankName)} of the mage tower. Choose your ${sb.max === 3 ? "three" : sb.max} on your Character sheet (Combat).</div></div></div>`}
      <div class="pp-shop-list">${sb.spells.map((x) => `<div class="pp-recipe${x.lock && !/in hand$/.test(x.lock) ? " short" : ""}">
          <img alt="" src="${itemIcon(x.hidden ? "scrollmeteor" : (x.runes[x.runes.length - 1] || {id: "airrune"}).id, 32)}">
          <div class="pp-recipe-main">
            <div><b>${esc(x.name)}</b> <span class="stamp">· unlocks at Magic ${x.level}${x.hidden ? "" : ` · ${esc(spellElement(x))} · max hit ${x.maxHit} at your level`}${x.equipped ? " · <b>in your three</b>" : ""}</span></div>
            ${x.about ? `<div class="stamp">${esc(x.about)}</div>` : ""}
            ${x.hidden ? "" : `<div class="pp-needs">${runes(x)}</div>`}
            ${x.lock ? `<div class="stamp pp-lock">${esc(x.lock)}</div>` : ""}
          </div><span></span></div>`).join("")}</div>
      ${to < all ? "" : `<div class="pp-row"><button class="btn btn-primary" data-jump="pet:skills" data-sheet-tab="combat">Choose your spells ›</button></div>`}`;
  }
  function renderEnchants(host) {
    const {s} = current();
    const eb = Core.enchantBookView(s);
    host.innerHTML = `
      <div class="pp-page">
        <p class="stamp" style="margin:0 0 12px">Enchants are rare: each is learnt from a tome found only in <b>ancient chests</b>. Put them on things at the
          <b>enchanting table</b> in your library (Enchanting level ${eb.level}) -- tools, armour and weapons, jewellery, or your pet's gear. An enchant goes on every one of that kind of thing you own.</p>
        <div class="pp-beasts">${eb.list.map((e) => e.known ? `<div class="pp-beast"><div><img alt="" src="${itemIcon("tome" + e.id, 24)}" style="vertical-align:middle"> <b>${esc(e.name)}</b></div>
            <div class="stamp">${esc(e.about)} · on ${esc(e.slots.join(", ").toLowerCase())} · Enchanting ${e.level}</div>
            <div class="stamp">${e.on.length ? "On: " + esc(e.on.join(", ")) : "Not on anything yet"}</div></div>`
          : `<div class="pp-beast unknown"><b>???</b><div class="stamp">${esc(e.about)} · Enchanting ${e.level}</div></div>`).join("")}</div>
        <p><button class="btn" data-jump="shop:enchanting">To the enchanting table ›</button></p>
      </div>`;
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.jump)));
  }

  // ---- the Herbarium (2026-10-06, Cam: "Herblore skill can be used to catalog unidentifed herbs ...
  //      Once they are identified you can then use them for potions at the apothacery table.") ----
  function renderHerbarium(host) {
    const {s} = current();
    const hv = Core.herbariumView(s);
    host.innerHTML = `
      <div class="pp-page">
        <p class="stamp" style="margin:0 0 12px">Herbs turn up unidentified — foraging, digging, and in your herb pots. Name them at the
          <b>Herb table</b> (Herblore) and they go in here; then brew with them at the <b>Apothecary table</b> (Alchemy).
          A herb you've identified grows as itself in a pot. Catalogue a whole tier and its herbs come up in twos more often;
          catalogue all ${hv.total} and you're a <b>master herbalist</b> — every 8th potion you brew is free.</p>
        <p class="pp-status">Herblore level ${hv.level} · ${hv.found} of ${hv.total} herbs${hv.master ? " · master herbalist" : ""}${hv.unid ? ` · ${hv.unid} unidentified in your bag` : ""}</p>
        ${hv.tiers.map((t) => `<div class="pp-group"><div class="pp-label">Tier ${ROMAN[t.tier - 1]} · Herblore ${t.level}${t.complete ? " · complete ✓" : ""}</div>
          <div class="pp-beasts">${t.herbs.map((h) => h.known ? `
            <div class="pp-beast"><div><img alt="" src="${itemIcon(h.id, 24)}" style="vertical-align:middle"> <b>${esc(h.name)}</b></div>
              <div class="stamp">Identified ${h.count}</div>
              <div class="stamp">${h.uses.length ? "Brews: " + esc(h.uses.join(", ")) : "Not in any potion — but the merchant likes it"}</div></div>`
            : `<div class="pp-beast unknown"><b>???</b><div class="stamp">Not identified yet</div></div>`).join("")}</div>
          <div class="stamp" style="margin:6px 0 18px">Found: ${esc(t.where.join(" · "))}</div></div>`).join("")}
      </div>`;
  }

  // ---- the Graveyard (2026-10-06, Cam: "Have a graveyard feature that shows dead pets, how they
  //      died and their age. Think rouge like.") ------------------------------------------------
