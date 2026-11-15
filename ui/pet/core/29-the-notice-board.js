  // ---- the notice board (2026-10-07, Cam: "can you think of any system that will work into the game
  //      to use up items and make use of older materials?") -- three orders a day from the villagers,
  //      for things you gather, mostly from the spots you've outgrown. They pay better than Marlow,
  //      give back some of the skill's xp, and a crate; all three in a day, an iron crate too.
  WORKSHOPS.board = CONTENT("WORKSHOPS.board");
  WORKSHOP_ORDER.splice(WORKSHOP_ORDER.indexOf("merchant") + 1, 0, "board");
  var ORDER_PER_DAY = 3, ORDER_LINES = [];
  HUNT_ORDER.forEach(function (g) { MONSTERS[HUNTS[g].boss].drops.push(["ancientchest", 1, 1, 0.06]); });
  [["deepjungle", "lastcamp"], ["frostpeak", "yetihoard"], ["mistyisle", "bottle"], ["crystalcaves", "lostpack"]].forEach(function (x) {
    var c = SECRETS[x[0]].filter(function (y) { return y.id === x[1]; })[0]; if (c) c.items.ancientchest = 1; });
  GATHERING.forEach(function (k) {
    SKILLS[k].spots.forEach(function (sp) {
      var main = sp.loot && sp.loot[0] && sp.loot[0][0];
      if (sp.essence || !main || !ITEMS[main] || HERB_TIER_OF[main] || ORDER_LINES.some(function (o) { return o.id === main; })) return;
      ORDER_LINES.push({ id: main, skill: k, level: sp.level, xp: sp.xp });
    });
  });
  function orderQty(id) { var g = ITEMS[id].gem || 0; return (g <= 1 ? 40 : g === 2 ? 30 : g === 3 ? 20 : g === 4 ? 12 : 6) * 15; }   // x15: gathering's pace (2026-10-09)
  /** Today's orders for you: [{id, skill, level, n, coins, xp}] -- the same all day. */
  function ordersFor(s, now) {
    var day = Math.floor((now || 0) / DAY), pl = (s && s.player) || newPlayer();
    var lines = ORDER_LINES.filter(function (o) { return levelOf((pl.skills || {})[o.skill] || 0) >= o.level; });
    var job = { seed: (day * 7919 + 13) | 0 }, out = [];
    for (var i = 0; i < ORDER_PER_DAY && lines.length; i++) {
      // the further below you a spot is, the likelier its things are wanted (old materials)
      var w = lines.map(function (o) { return [o, 1 + Math.max(0, levelOf(pl.skills[o.skill] || 0) - o.level) / 5]; });
      var o = pick(job, w); lines = lines.filter(function (x) { return x !== o; });
      var n = orderQty(o.id);
      out.push({ id: o.id, skill: o.skill, n: n, coins: Math.ceil(priceOf(o.id) * n * 1.8) + 20, xp: Math.round(o.xp * n * 0.5) });
    }
    return out;
  }
  function ordersView(s, now) {
    var day = Math.floor((now || 0) / DAY), done = s.orders && s.orders.day === day ? s.orders.done || {} : {}, b = s.bag || {};
    var list = ordersFor(s, now).map(function (o, i) {
      return { i: i, id: o.id, name: ITEMS[o.id].name, n: o.n, have: b[o.id] || 0, coins: o.coins, xp: o.xp, skill: SKILLS[o.skill].name,
               done: !!done[i], can: !done[i] && (b[o.id] || 0) >= o.n };
    });
    return { list: list, left: list.filter(function (o) { return !o.done; }).length, allDone: list.length && list.every(function (o) { return o.done; }) };
  }
  // every potion is made at the Apothecary table now (Alchemy); the Herb table identifies herbs (Herblore)
  WORKSHOPS.apothecary.recipes = WORKSHOPS.apothecary.recipes.concat(WORKSHOPS.herblore.recipes)
    .concat([{ make: "moonlightdraught", needs: { moonpetal: 2, honeycomb: 1 }, level: 48, xp: 150 },
             // the new herbs' brews (2026-10-07)
             { make: "feverfewtonic", needs: { feverfew: 2, berry: 2 }, level: 4, xp: 16 },
             { make: "marigoldbalm", needs: { marigold: 2, honeycomb: 1 }, level: 6, xp: 20 },
             { make: "sagedraught", needs: { sage: 2, flower: 2, honeycomb: 1 }, level: 15, xp: 42 },
             { make: "comfreypoultice", needs: { comfrey: 2, sap: 1, herb: 2 }, level: 18, xp: 46 },
             { make: "valeriandraught", needs: { valerian: 2, honeycomb: 1, berry: 2 }, level: 26, xp: 64 },
             { make: "stoneskin", needs: { yarrow: 2, moss: 2, herb: 2 }, level: 29, xp: 72 },
             { make: "berserkerbrew", needs: { mandrake: 1, rosemary: 2, truffle: 1 }, level: 36, xp: 98 },
             { make: "huntersdraught", needs: { wolfsbane: 2, honeycomb: 1 }, level: 39, xp: 108 },
             { make: "dragonsblood", needs: { dragonroot: 2, orchid: 1, honeycomb: 2 }, level: 44, xp: 132 },
             { make: "starbloomdraught", needs: { starbloom: 2, moonpetal: 1, royaljelly: 1 }, level: 49, xp: 160 }])
    .sort(function (a, b) { return (a.level || 1) - (b.level || 1); });
  WORKSHOPS.herblore.recipes = [];
  WORKSHOPS.herblore.identify = true;
  WORKSHOPS.herblore.says = "Unidentified herbs, cleaned and named -- and every one you find goes in your Herbarium.";

