  // TIER_PRICE (see priceOf): gathered goods by spot level and time -- roughly 150 + 55 coins an
  // hour per level from the main find -- then made goods from their inputs, cheapest recipe wins
  (function () {
    var SPEED = {}, dropped = {};                     // a skill's coins an hour, from the skill registry (01-a)
    SKILL_REG.forEach(function (k) { if (k.trips) SPEED[k.id] = k.coins; });
    Object.keys(MONSTERS).forEach(function (m) { (MONSTERS[m].drops || []).forEach(function (d) { dropped[d[0]] = 1; }); });   // bones etc. keep their own price
    GATHERING.forEach(function (k) {
      SKILLS[k].spots.forEach(function (sp) {
        if (sp.essence || !sp.loot || !sp.loot.length) return;
        var top = sp.loot.slice().sort(function (a, b) { return b[1] - a[1]; })[0][0];
        var p = Math.max(1, Math.round((150 + 55 * sp.level) * sp.time * (SPEED[k] || 0.6) / 3600));
        if (!ITEMS[top].price && !dropped[top] && (!TIER_PRICE[top] || p < TIER_PRICE[top])) TIER_PRICE[top] = p;
      });
    });
    var main = {};                                   // each thing's main recipe (the first; the others are cheaper ways)
    Object.keys(WORKSHOPS).forEach(function (w) {
      if (w === "alchemist" || WORKSHOPS[w].trade) return;
      WORKSHOPS[w].recipes.forEach(function (r) { if (r.needs && !main[r.make] && !ITEMS[r.make].price) main[r.make] = r; });
    });
    for (var pass = 0; pass < 6; pass++) {
      Object.keys(main).forEach(function (k) {
        var r = main[k], cost = r.fee || 0;
        Object.keys(r.needs).forEach(function (n) { cost += priceOf(n) * r.needs[n]; });
        TIER_PRICE[k] = Math.max(SELL[Math.max(0, Math.min(10, ITEMS[k].gem || 0))], Math.ceil(cost * 1.15 / (r.n || 1)));
      });
    }
  })();

  // the wild herbs are found unidentified now (Herblore, 2026-10-06): a spot that gave a herb gives its tier
  (function () {
    // (2026-10-07: the herb itself is in the loot; find() makes it unidentified, by the spot's level)
    Object.keys(SKILLS).forEach(function (k) {
      (SKILLS[k].spots || []).forEach(function (sp) {
        if (sp.id === "wildflowers") sp.loot.push(["sage", 35]);           // tier II grows wild in the meadow
        if (sp.id === "hazelgrove") sp.loot.push(["valerian", 35]);        // tier III under the hazels
      });
    });
    // expeditions bring herbs home too, by how hard the area is (2026-10-07)
    ["forest", "caves", "dungeons", "cemetery", "volcanic", "deepforest", "darkforest", "devilsplains", "void"].forEach(function (k) {
      if (AREAS[k] && !AREAS[k].loot.some(function (l) { return l[0] === "herb"; })) AREAS[k].loot.push(["herb", 10]);
    });
  })();
