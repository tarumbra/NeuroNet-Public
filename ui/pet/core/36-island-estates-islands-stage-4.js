  // ==== island estates -- islands stage 4 (2026-10-08, Cam: "frostpeak and the desert should have a town each ... an estate
  //      the player can purchase there and slowly build up by providing materials and coins for the different areas ...
  //      the player can select to stay there for a while and grind out the area ... A home away from home") ------------
  // s.estates[isle] = {bought, parts: {house, workshop, storeroom, quarters, garden, special}, store: {}, garden: lastPicked}
  var ESTATE_PARTS = CONTENT("ESTATE_PARTS");
  var ESTATE_PART_NAMES = CONTENT("ESTATE_PART_NAMES");
  var ESTATE_ISLE = CONTENT("ESTATE_ISLE");
  var ESTATE_BUILD = CONTENT("ESTATE_BUILD");
  // the benches an island workshop has, by tier (what it can make is capped like a home room: ROOM_CAP)
  var ESTATE_BENCHES = CONTENT("ESTATE_BENCHES");
  var SPECIAL_HEAL = CONTENT("SPECIAL_HEAL"), QUARTERS_BOOST = CONTENT("QUARTERS_BOOST"), GARDEN_EVERY = 12 * HOUR;
  var QUARTERS = 0;                                                     // your companion's lift where you are (set as the state is read)
  function estateOf(s, isle) { var e = s && s.estates && s.estates[isle]; return e && e.bought ? e : null; }
  function hereEstate(s) { var isle = islandOf(s); return isle ? estateOf(s, isle) : null; }
  function partTier(e, p) { return (e && e.parts && e.parts[p]) || 0; }
  function estateStage(e) { return e ? Math.min.apply(null, ESTATE_PARTS.map(function (p) { return partTier(e, p); })) : -1; }
  function estateBenches(e) { var t = partTier(e, "workshop"), out = []; for (var i = 1; i <= t; i++) out = out.concat(ESTATE_BENCHES[i]); return out; }
  function estateCost(isle, part, tier) {
    var b = ESTATE_BUILD[tier], ei = ESTATE_ISLE[isle], items = {};
    if (!b) return null;
    items[b.plank[0]] = b.plank[1]; items[ei.mat] = (items[ei.mat] || 0) + b.mat;
    if (part === "special") items[ei.rare] = b.rare * 2; else if (b.rare > 1) items[ei.rare] = b.rare - 1;
    if (b.rope) items.rope = b.rope;                                     // rope for the towns (2026-10-09)
    return { con: b.con, coins: b.coins, items: items, xp: b.xp };
  }
  /** Rest where you are: home, your bedroom; on an island, its estate's house and its cistern or hot spring. */
  function restHere(s) {
    var e = hereEstate(s);
    if (islandOf(s)) return e ? REST_HEAL[partTier(e, "house")] + SPECIAL_HEAL[partTier(e, "special")] : 0;
    return REST_HEAL[roomTier(s, "bedroom")];
  }
  function estateAct(s, action, opts, now) {
    var isle = islandOf(s);
    if (action !== "estatebuy" && action !== "estatebuild" && action !== "estategarden") return null;
    if (!isle) return no(s, "Your island estates are on the islands -- sail to one first.");
    var ei = ESTATE_ISLE[isle];
    s.estates = s.estates || {};
    var e = s.estates[isle] = s.estates[isle] || {};
    if (action === "estatebuy") {
      if (e.bought) return no(s, "It's yours already.");
      if ((s.coins || 0) < ei.price) return no(s, "The plot costs " + ei.price.toLocaleString() + " coins.");
      s.coins -= ei.price;
      e.bought = now; e.parts = {}; e.store = {};
      return yes(s, now, "The plot by " + REGIONS[ISLANDS[isle].town].name + " is yours! Build it up, part by part.");
    }
    if (!e.bought) return no(s, "Buy the plot first.");
    if (action === "estatebuild") {
      var part = opts.part;
      if (ESTATE_PARTS.indexOf(part) < 0) return no(s, "There's no part like that.");
      var t = partTier(e, part) + 1, cost = estateCost(isle, part, t);
      if (!cost) return no(s, "It's as grand as it gets.");
      var con = levelOf(s.player.skills.construction || 0);
      if (con < cost.con) return no(s, "That needs Construction " + cost.con + " (you're " + con + ").");
      if ((s.coins || 0) < cost.coins) return no(s, "That takes " + cost.coins.toLocaleString() + " coins.");
      for (var k in cost.items) if (!has(s, k, cost.items[k])) return no(s, "That takes " + cost.items[k] + " " + ITEMS[k].name.toLowerCase() + " (you have " + (s.bag[k] || 0) + ").");
      s.coins -= cost.coins;
      for (var k2 in cost.items) take(s, k2, cost.items[k2]);
      e.parts[part] = t;
      addXp(s, s.player, "construction", cost.xp, now);
      var nm = part === "special" ? ei.special : ESTATE_PART_NAMES[part];
      return yes(s, now, "Your " + nm.toLowerCase() + (part === "quarters" ? " are " : " is ") + HOUSE_TIERS[t].toLowerCase() + " now (" + cost.xp + " Construction xp)." +
                 (estateStage(e) === t ? " Your whole estate is " + HOUSE_TIERS[t].toLowerCase() + "!" : ""));
    }
    if (action === "estategarden") {
      var gt = partTier(e, "garden");
      if (!gt) return no(s, "Build the garden first.");
      if (e.garden && now - e.garden < GARDEN_EVERY) return no(s, "Nothing's ready -- back in " + Math.ceil((e.garden + GARDEN_EVERY - now) / HOUR) + " hours.");
      e.garden = now;
      var got = {};
      ei.produce.forEach(function (pr) { var n = pr[1] * gt; give(s, pr[0], n, true); got[pr[0]] = n; });
      return yes(s, now, "You picked the garden: " + itemsText(got) + ".");
    }
    return null;
  }
  function estateView(s, now) {
    var isle = islandOf(s);
    if (!isle) return null;
    var ei = ESTATE_ISLE[isle], e = estateOf(s, isle), con = levelOf(((s.player || {}).skills || {}).construction || 0), b = s.bag || {};
    return { isle: isle, name: ISLANDS[isle].name, town: REGIONS[ISLANDS[isle].town].name, townId: ISLANDS[isle].town, price: ei.price, bought: !!e, stage: e ? estateStage(e) : -1,
             stagePic: e ? Math.max(1, estateStage(e)) : 0,                  // the picture: 0 for sale, 1 bought (a camp) .. 4 grand
             stageName: e ? (estateStage(e) ? HOUSE_TIERS[estateStage(e)] : "Bought") : "For sale", coins: s.coins || 0,
             parts: ESTATE_PARTS.map(function (p) { var t = partTier(e, p), c = estateCost(isle, p, t + 1);
               return { id: p, name: p === "special" ? ei.special : ESTATE_PART_NAMES[p], tier: t, tierName: t ? HOUSE_TIERS[t] : "Not built",
                        perk: estatePerk(isle, p, t),
                        next: c ? { tierName: HOUSE_TIERS[t + 1], con: c.con, conOk: con >= c.con, coins: c.coins, xp: c.xp, perk: estatePerk(isle, p, t + 1),
                                    items: Object.keys(c.items).map(function (k) { return { id: k, name: ITEMS[k].name, need: c.items[k], have: b[k] || 0 }; }),
                                    can: !!e && con >= c.con && (s.coins || 0) >= c.coins && Object.keys(c.items).every(function (k) { return (b[k] || 0) >= c.items[k]; }) } : null }; }),
             benches: e ? estateBenches(e) : [], gardenIn: e && partTier(e, "garden") ? Math.max(0, Math.ceil(((e.garden || 0) + GARDEN_EVERY - now) / 1000)) : -1,
             store: e && partTier(e, "storeroom") ? { used: storeUsed(s), cap: storeCap(s) } : null };
  }
  function estatePerk(isle, p, t) {
    if (!t) return "";
    if (p === "house") return "Rest heals " + Math.round(REST_HEAL[t] * 100) + "% faster here";
    if (p === "workshop") return "Benches: " + estateBenchesAt(t).map(function (w) { return WORKSHOPS[w].name.toLowerCase(); }).join(", ") + " (up to level " + ROOM_CAP[t] + ")";
    if (p === "storeroom") return "A bank of " + BANK.kinds[t] + " kinds of things, kept on this island";
    if (p === "quarters") return "Your companion's skill bonus +" + Math.round(QUARTERS_BOOST[t] * 100) + "% here";
    if (p === "garden") return ESTATE_ISLE[isle].produce.map(function (x) { return x[1] * t + " " + ITEMS[x[0]].name.toLowerCase(); }).join(" and ") + " every 12 hours";
    if (p === "special") return "Resting heals another " + Math.round(SPECIAL_HEAL[t] * 100) + "% faster";
    return "";
  }
  function estateBenchesAt(t) { var out = []; for (var i = 1; i <= t; i++) out = out.concat(ESTATE_BENCHES[i]); return out; }

