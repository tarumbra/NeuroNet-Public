  // ---- the Arcane (2026-10-07, Cam: "start the arcane class now ... spellbook added to the game with a list of
  //      spells that unlock at each level (some with special requirements, like beating a boss and a specific
  //      wand). Also wands, hats, cloaks, staffs, runes (runecrafting, essence stones, shrines). A mage tower where
  //      you can pass through the levels of mage ... Spells should have the ability to be casted and need to be
  //      equipped before a battle (magic loadout, the runes required ect. When running out of runes for any
  //      spells, you default to a staff bash for staves or fists when using a wand). This should also add special
  //      enchants to the game (which also has a book) These should be very difficult to obtain and the
  //      enchantment recipe is only obtained from rare chests (same as some spells). The new enchanting table and
  //      alter should be placed in the library") ---------------------------------------------------------------
  var SPELLS = CONTENT("SPELLS");
  var SPELL_ORDER = Object.keys(SPELLS);
  var LOADOUT_MAX = 3;
  var ENCHANTS = CONTENT("ENCHANTS");
  // the mage tower: a rank at a time -- the levels, then a duel with that rank's mage
  var MAGE_RANKS = CONTENT("MAGE_RANKS");
  // (tuned 2026-10-07: at a rank's levels, with its tier of wand, hat and cloak, about two duels in three with
  //  ten good fish -- and hardly ever with none)
  [["apprenticemage", "Apprentice Corin", 35, 13, 13, 6, 160], ["adeptmage", "Adept Selene", 150, 29, 22, 9, 320], ["magusmage", "Magus Orrin", 204, 34, 30, 13, 600],
   ["sorceressmage", "Sorceress Nyx", 300, 45, 35, 16, 1000], ["archmagemage", "Archmage Vale", 414, 55, 39, 18, 1600]].forEach(function (m) {
    MONSTERS[m[0]] = { name: m[1], boss: true, mage: true, hp: m[2], att: m[3], def: m[4], maxHit: m[5], xp: m[6], atk: "magic", weak: { slash: 1.2 }, resist: { magic: 0.85 }, drops: [] };
  });
  HUNTS.magetower = CONTENT("HUNTS.magetower");
  function runeId(r) { return r + "rune"; }
  /** Why you can't cast this spell ("" if you can, runes apart). */
  function spellLock(s, id) {
    var sp = SPELLS[id], pl = s.player;
    if (!sp) return "No such spell";
    if (levelOf(pl.skills.magic || 0) < sp.level) return "Magic level " + sp.level;
    if (sp.gate !== undefined) { var nl = necroSpellLock(s, sp); if (nl) return nl; }   // Necromancy (Battle Re-work Part 13)
    if (sp.scroll && !(s.spellsKnown || {})[id]) return "Learnt only from a scroll (in an ancient chest)";
    if (sp.req) {
      var won = ((s.hunt || {})[sp.req.boss] || {}).wins || 0;
      if (won < sp.req.wins) return "Beat " + MONSTERS[HUNTS[sp.req.boss].boss].name + (sp.req.wins > 1 ? " " + sp.req.wins + " times (" + won + "/" + sp.req.wins + ")" : "");
      if ((pl.gear || {}).weapon !== sp.req.weapon) return "Cast with " + aOr(ITEMS[sp.req.weapon].name.toLowerCase()) + " in hand";
    }
    return "";
  }
  /** The runes a spell costs you: your staff's element is free. */
  function spellCost(pl, sp, times) {
    var el = ((ITEMS[(pl.gear || {}).weapon] || {}).gear || {}).element, out = {};
    Object.keys(sp.runes).forEach(function (r) { if (r !== el) out[runeId(r)] = sp.runes[r] * (times || 1); });
    return out;
  }
  /** This round's spell: the one you picked, else the first in your loadout you can cast and pay for. */
  function castFor(s, pl, b, times) {
    var order = (b.castNext ? [b.castNext] : []).concat((pl.loadout || []).slice(0, loadoutMax(pl)));
    b.castNext = "";
    for (var i = 0; i < order.length; i++) {
      var sp = SPELLS[order[i]];
      if (!sp || spellLock(s, order[i])) continue;
      if (sp.necro && !necroUseful(s, pl, b, sp)) continue;              // a Necromancy spell with nothing to do (Part 13)
      var cost = spellCost(pl, sp, times);
      if (!Object.keys(cost).every(function (k) { return has(s, k, cost[k]); })) continue;
      var rs = talentSum(pl).runeSave;                                  // Rune thrift (Battle Re-work Part 3): now and then, free
      if (!(rs && rnd(b) < rs)) Object.keys(cost).forEach(function (k) { take(s, k, cost[k]); b.items = b.items || {}; b.runes = b.runes || {}; b.runes[k] = (b.runes[k] || 0) + cost[k]; });
      return sp;
    }
    return null;
  }
  function spellbookView(s) {
    var pl = s.player, b = s.bag || {}, inf = s.dev && s.dev.infinite;
    var runes = Object.keys(ITEMS).filter(function (k) { return ITEMS[k].rune; }).map(function (k) { return { id: k, name: ITEMS[k].name, have: inf ? 999 : b[k] || 0 }; });
    return { level: levelOf(pl.skills.magic || 0), rank: s.mageRank || 0, rankName: MAGE_RANKS[s.mageRank || 0].name, loadout: (pl.loadout || []).slice(0, loadoutMax(pl)), max: loadoutMax(pl),
             weapon: (pl.gear || {}).weapon || "", magicWeapon: (((ITEMS[(pl.gear || {}).weapon] || {}).gear || {}).style === "magic"), runes: runes,
             spells: SPELL_ORDER.map(function (id) {
               var sp = SPELLS[id], lock = spellLock(s, id), hidden = sp.scroll && !(s.spellsKnown || {})[id];
               var cost = spellCost(pl, sp, 1), casts = Object.keys(cost).reduce(function (m, k) { return Math.min(m, Math.floor((inf ? 999 : b[k] || 0) / cost[k])); }, Infinity);
               return { id: id, name: hidden ? "???" : sp.name, level: sp.level, about: hidden ? "A spell only found on a scroll" : sp.about || "",
                        runes: hidden ? [] : Object.keys(sp.runes).map(function (r) { return { id: runeId(r), n: sp.runes[r], free: !cost[runeId(r)] }; }),
                        maxHit: sp.base + Math.floor(levelOf(pl.skills.magic || 0) / 6), lock: lock, element: sp.element || "", special: !!sp.req, scroll: !!sp.scroll, hidden: hidden,
                        casts: casts === Infinity ? 999 : casts, equipped: (pl.loadout || []).indexOf(id) >= 0 };
             }) };
  }
  function enchantWhere(e) {
    return e.slots.map(function (x) { return x === "tool" ? "tools" : SLOT_NAMES[x].toLowerCase(); }).concat(e.pet ? ["a pet's gear"] : []).join(", ");
  }
  function enchantBookView(s) {
    var known = s.enchantsKnown || {}, lv = levelOf(s.player.skills.enchanting || 0), b = s.bag || {}, inf = s.dev && s.dev.infinite;
    return { level: lv, list: Object.keys(ENCHANTS).map(function (k) {
      var e = ENCHANTS[k], kn = !!known[k];
      return { id: k, known: kn, name: kn ? e.name : "???", about: kn ? e.about : "A tome in an ancient chest teaches it", level: e.level, slots: [enchantWhere(e)],
               cost: kn ? Object.keys(e.cost).map(function (c) { return { id: c, name: ITEMS[c].name, need: e.cost[c], have: inf ? 999 : b[c] || 0 }; }) : [], coins: kn ? e.coins : 0,
               on: Object.keys(s.player.enchants || {}).filter(function (it) { return s.player.enchants[it] === k; }).map(function (it) { return ITEMS[it] ? ITEMS[it].name : it; }) };
    }) };
  }
  /** Things in your bag (or worn) an enchant can go on. */
  function enchantable(e, id) {
    var it = ITEMS[id], g = it && it.gear;
    if (it && it.tool && !it.tool.wear) return e.slots.indexOf("tool") >= 0;
    if (!g) return false;
    return g.who === "pet" ? !!e.pet : e.slots.indexOf(g.slot) >= 0;
  }
  function enchantTargets(s, k) {
    var e = ENCHANTS[k], b = s.bag || {};
    return Object.keys(b).filter(function (id) { return b[id] > 0 && enchantable(e, id); })
      .map(function (id) { return { id: id, name: ITEMS[id].name, has: (s.player.enchants || {})[id] || "" }; });
  }
  function towerView(s) {
    var r = s.mageRank || 0, pl = s.player;
    return { rank: r, rankName: MAGE_RANKS[r].name, ranks: MAGE_RANKS.map(function (m, i) {
      if (!i) return { n: 0, name: m.name, done: true };
      var needs = Object.keys(m.needs).map(function (k) { return { skill: SKILLS[k].name, need: m.needs[k], have: levelOf(pl.skills[k] || 0) }; });
      return { n: i, name: m.name, done: r >= i, next: r === i - 1, needs: needs, ready: r === i - 1 && needs.every(function (x) { return x.have >= x.need; }),
               mage: MONSTERS[m.duel].name, duel: m.duel, coins: m.coins, rematch: r >= i ? itemsText(m.rematch || {}) : "" };
    }) };
  }

