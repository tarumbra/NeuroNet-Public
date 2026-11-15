  // ---- what an item is for (2026-10-07: the bag's item sheet) -- where it comes from and where it goes --------
  function itemInfo(s, id) {
    var it = ITEMS[id];
    if (!it) return null;
    var from = [], uses = [], seen = {};
    var addF = function (t) { if (!seen["f" + t]) { seen["f" + t] = 1; from.push(t); } };
    var addU = function (t) { if (!seen["u" + t]) { seen["u" + t] = 1; uses.push(t); } };
    GATHERING.forEach(function (k) {
      SKILLS[k].spots.forEach(function (sp) {
        if (sp.secret && !(((s || {}).world || {}).found || {})[sp.secret]) return;
        var main = sp.loot[0][0] === id, inLoot = sp.loot.some(function (l) { return l[0] === id; }), rare = sp.rare && sp.rare[0] === id;
        if (inLoot || rare) addF(SKILLS[k].name + " at the " + sp.name + " (" + (REGIONS[sp.area] ? REGIONS[sp.area].name : sp.area) + ", level " + sp.level + ")" + (rare && !inLoot ? " -- rarely" : main ? "" : ""));
      });
    });
    if (HERB_TIER_OF[id]) addF("Identifying unidentified herbs at the Herb table (Herblore " + HERB_TIERS[HERB_TIER_OF[id] - 1].level + ")");
    Object.keys(MONSTERS).forEach(function (m) { if ((MONSTERS[m].drops || []).some(function (d) { return d[0] === id; })) addF("Dropped by " + MONSTERS[m].name.toLowerCase() + "s" ); });
    Object.keys(AREAS).forEach(function (a) { if ((AREAS[a].loot || []).some(function (l) { return l[0] === id; }) || (AREAS[a].crate && AREAS[a].crate[0] === id) || (AREAS[a].egg && AREAS[a].egg[0] === id)) addF("Pet expeditions to the " + AREAS[a].name); });
    Object.keys(CRATES).forEach(function (c) { if ((CRATES[c].loot || []).some(function (l) { return l[0] === id; })) addF("Inside " + aOr(ITEMS[c].name.toLowerCase())); });
    WORKSHOP_ORDER.forEach(function (w) {
      var ws = WORKSHOPS[w];
      ws.recipes.forEach(function (r) {
        var where = ws.npc ? ws.who + " the " + ws.name.toLowerCase() : "the " + ws.name.toLowerCase();
        if (r.make === id) addF("Made at " + where + (ws.skill ? " (" + SKILLS[ws.skill].name + " " + (r.level || 1) + ")" : ""));
        if (r.needs[id] || (r.uses || []).indexOf(id) >= 0) addU(ITEMS[r.make].name + " (" + (ws.npc ? ws.who : ws.name) + ")");
      });
    });
    MERCHANT_STOCK.concat(MERCHANT_DAILY).forEach(function (x) { if (x[0] === id) addF("Sold by Marlow, the merchant" + (MERCHANT_DAILY.indexOf(x) >= 0 ? " (some days)" : "")); });
    TRAVELLER_STOCK.forEach(function (x) { if (x[0] === id) addF("Sold by Zeph, on Sundays"); });
    Object.keys(PEOPLE).forEach(function (r) { PEOPLE[r].quests.forEach(function (q) {
      if (q.needs.some(function (n) { return n.bring && n.bring[id]; })) addU("Quest: " + q.name + " (" + PEOPLE[r].name + ")");
      if (q.reward.items && q.reward.items[id]) addF("A reward from " + PEOPLE[r].name + " (" + q.name + ")");
    }); });
    Object.keys(SECRETS).forEach(function (r) { SECRETS[r].forEach(function (x) { if (x.egg === id || (x.items && x.items[id])) addF("Hidden somewhere in the " + REGIONS[r].name); }); });
    ROOM_BUILD.forEach(function (b, t) { if (b && b.needs[id]) addU("Building " + aOr(HOUSE_TIERS[t].toLowerCase()) + " room at home"); });
    Object.keys(REGIONS).forEach(function (r) { if (REGIONS[r].needs && REGIONS[r].needs.item === id) addU("The way into the " + REGIONS[r].name); });
    if (it.food) addU("Food for your pet");
    if (LAND.whittle[id]) addU("A Hunter with a knife whittles it into " + LAND.whittle[id] + " arrow shaft" + (LAND.whittle[id] === 1 ? "" : "s") + " (from the bag)");
    if (id === "arrowshaft" || id === "leaflitter") addU("Improvised arrows: a shaft and some leaf litter -- a Hunter with a knife, from the bag");
    if (it.coat) addU("A Thief coats their blades with it (from the bag): " + (it.coat.poison ? "poisons for " + it.coat.poison[0] + " a round, " + it.coat.poison[1] + " rounds" : it.coat.stun ? "now and then stuns" : "weakens their blows") + " -- " + it.coat.hits + " hits");
    if (id === "venomsac") addU("Strong and deadly poisons (the apothecary table)");
    if (id === "bones") addU("A Hunter with a knife carves bones into bone arrowheads (from the bag)");
    if (id === "bonearrowheads" || id === "arrowshaft" || id === "feather") addU("Bone arrows: a shaft, a bone arrowhead and a feather -- a Hunter with a knife, from the bag");
    if (id === "bonearrowheads" || id === "bonearrow") addF("Made by a Hunter with a knife, from the bag");
    if (id === "feather") addF("Plucked from the birds a Hunter kills");
    if (id === "arrowshaft" || id === "improvisedarrow") addF("Whittled by a Hunter with a knife, from twigs or a log (the bag)");
    if (it.hunterTool && it.hunterTool.kind === "throw") addU("A Thief's throwing knife: thrown in a fight (click it in your bag, or from a quick slot), it hits for " + it.hunterTool.damage.join("-") + " and carries your poison; picked up again " + Math.round(it.hunterTool.keep * 100) + "% of the time after a win");
    else if (it.hunterTool) addU(it.hunterTool.kind === "trap" ? "A Hunter's trap: laid in a fight (click it in your bag, or from a quick slot), it holds the creature " + it.hunterTool.rounds.join("-") + " round" + (it.hunterTool.rounds[1] === 1 ? "" : "s") + (it.hunterTool.spring ? ", snaps for " + it.hunterTool.spring.join("-") : "") + (it.hunterTool.bleed ? ", and it bleeds" : "")
                                                  : "A Hunter's net: thrown in a fight (click it in your bag, or from a quick slot), it holds the creature " + it.hunterTool.rounds.join("-") + " rounds" + (it.hunterTool.burn ? " and burns it" : "") + "; picked up again " + Math.round(it.hunterTool.keep * 100) + "% of the time after a win");
    if (it.heal) addU("Heals you " + it.heal + " (eat it, or pick it in your hunt plan to eat between fights)");
    if (it.treats) addU("Treats a pet's " + it.treats + " injury");
    if (it.petbrew || it.potion) addU("In a pet's expedition pack");
    if (ORDER_LINES.some(function (o) { return o.id === id; })) addU("Notice board orders, now and then");
    if (id === "relic") addU("Camp upgrades, for every pet");
    var b = (s && s.bag) || {}, st = (s && s.storage) || {};
    return { id: id, name: it.name, gem: it.gem || 0, does: describe(id), from: from.slice(0, 12), uses: uses.slice(0, 14),
             moreFrom: Math.max(0, from.length - 12), moreUses: Math.max(0, uses.length - 14),
             have: b[id] || 0, stored: st[id] || 0, price: eachFor(id, 1), sellable: !it.bagSize && !it.unid };
  }

