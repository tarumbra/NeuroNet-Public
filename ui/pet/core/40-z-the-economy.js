  // ==== the economy (2026-10-10, Cam: "a rough gem doesnt drop from copper and tin often but sells for 1 coin that doesnt make
  //      sense please look over the game and apply fixes from an economical perspective"). Runs once, after the pace block:
  //  1. valuables (gems, treasures, eggs) are priced by rarity tier, not by the hour -- a rare find is worth having;
  //  2. a spot's side finds (seeds, the odd eel) are worth more than its main find, by how much rarer they are (up to 4x);
  //  3. where valuables are common (the Gem rocks, the Geode chamber, the pirate beach) they're made rarer, so an hour there
  //     earns at most ~1.5x a normal spot of its level -- the rest becomes the spot's ordinary find;
  //  4. recipes that use valuables take 1 of them, not 5 (the 5x was for ore and logs);
  //  5. no recipe makes something worth less than what went into it (+10%, and the fee).
  var VALUABLE_IDS = CONTENT("VALUABLE_IDS");
  var VALUABLE = {}, ECON = CONTENT("ECON");
  (function () {
    VALUABLE_IDS.forEach(function (id) { if (ITEMS[id]) VALUABLE[id] = 1; });
    Object.keys(ITEMS).forEach(function (id) { if (ITEMS[id].egg) VALUABLE[id] = 1; });
    var tier = function (id) { return SELL[Math.max(0, Math.min(10, ITEMS[id].gem || 0))]; };
    // 1. valuables by tier
    Object.keys(VALUABLE).forEach(function (id) { ITEMS[id].price = tier(id); });
    // 2. side finds: by rarity against the spot's main find -- judged where the thing is easiest to come by (the most an hour),
    //    so a berry that's a side find somewhere is still priced as the Hedgerow's main find
    var src = {};
    GATHERING.forEach(function (k) {
      SKILLS[k].spots.forEach(function (sp) {
        if (sp.essence || !sp.loot) return;
        var total = sp.loot.reduce(function (a, l) { return a + l[1]; }, 0);
        sp.loot.forEach(function (l) {
          var perHour = 3600 / sp.time * l[1] / total;
          if (!(l[0] in src) || perHour > src[l[0]].perHour) src[l[0]] = { sp: sp, w: l[1], perHour: perHour };
        });
      });
    });
    var SPD = {}; SKILL_REG.forEach(function (k) { if (k.trips) SPD[k.id] = k.coins; });     // from the registry
    var skillOf = function (sp) { for (var k in SKILLS) if ((SKILLS[k].spots || []).indexOf(sp) >= 0) return k; return "mining"; };
    var spotIncome = function (sp) { var total = sp.loot.reduce(function (a, l) { return a + l[1]; }, 0);
      return sp.loot.reduce(function (a, l) { return a + 3600 / sp.time * l[1] / total * priceOf(l[0]); }, 0); };
    Object.keys(src).forEach(function (id) {
      if (VALUABLE[id] || !ITEMS[id] || !PACE[id]) return;
      var sp = src[id].sp, main = sp.loot[0];
      if (main[0] === id || src[id].w >= main[1]) return;
      var m = Math.max(1, Math.min(4, Math.sqrt(main[1] / src[id].w))), base = priceOf(id);
      var room = 1.5 * (150 + 55 * sp.level) * (SPD[skillOf(sp)] || 0.6) - spotIncome(sp);     // never past 1.5x that spot's coins
      if (room <= 0) return;
      m = Math.min(m, 1 + room / (src[id].perHour * base));
      ITEMS[id].price = Math.round(base * m * 100) / 100;
    });
    // 3. valuables made rarer where they're common, so an hour's coins stay in line
    var SPEED = SPD;
    GATHERING.forEach(function (k) {
      SKILLS[k].spots.forEach(function (sp) {
        if (sp.essence || !sp.loot) return;
        var total = sp.loot.reduce(function (a, l) { return a + l[1]; }, 0), finds = 3600 / sp.time;
        var budget = (150 + 55 * sp.level) * (SPEED[k] || 0.6);
        var vinc = sp.loot.reduce(function (a, l) { return a + (VALUABLE[l[0]] ? finds * l[1] / total * priceOf(l[0]) : 0); }, 0);
        ECON.budget[k + ":" + sp.id] = Math.round(budget);
        if (vinc <= 0.75 * budget) return;
        var f = 0.75 * budget / vinc, freed = 0;
        sp.loot.forEach(function (l) { if (VALUABLE[l[0]]) { var nw = Math.max(1, Math.round(l[1] * f * 10) / 10); freed += l[1] - nw; l[1] = nw; } });
        var plain = sp.loot.filter(function (l) { return !VALUABLE[l[0]]; }).sort(function (a, b) { return b[1] - a[1]; })[0];
        if (plain) plain[1] = Math.round((plain[1] + freed) * 10) / 10;
        else sp.loot.push(["stone", Math.round(freed * 10) / 10]);       // nothing ordinary there: the rest is rock
        sp.loot.sort(function (a, b) { return b[1] - a[1]; });
        ECON.scaled[k + ":" + sp.id] = Math.round(f * 1000) / 1000;
      });
    });
    // 3b. any spot still paying over 2x its level (pricey side finds at an early spot: the Hedgerow's mushrooms): those side
    //     finds turn up less, the main find more
    GATHERING.forEach(function (k) {
      SKILLS[k].spots.forEach(function (sp) {
        if (sp.essence || !sp.loot || sp.loot.length < 2) return;
        var main = sp.loot[0], budget = (150 + 55 * sp.level) * (SPEED[k] || 0.6), inc = spotIncome(sp);
        if (inc <= 2 * budget) return;
        var total = sp.loot.reduce(function (a, l) { return a + l[1]; }, 0), finds = 3600 / sp.time;
        var pricey = sp.loot.filter(function (l) { return l !== main && priceOf(l[0]) > priceOf(main[0]); });
        var extra = pricey.reduce(function (a, l) { return a + finds * l[1] / total * priceOf(l[0]); }, 0);
        if (!extra) return;
        var f = Math.max(0.1, 1 - (inc - 2 * budget) / extra), freed = 0;
        pricey.forEach(function (l) { var nw = Math.max(1, Math.round(l[1] * f * 10) / 10); freed += l[1] - nw; l[1] = nw; });
        main[1] = Math.round((main[1] + freed) * 10) / 10;
        ECON.scaled[k + ":" + sp.id] = Math.round(f * 1000) / 1000;
      });
    });
    // 4. and 5. recipes: 1 valuable, not 5; never at a loss
    var recs = [];
    Object.keys(WORKSHOPS).forEach(function (w) {
      var ws = WORKSHOPS[w];
      if (ws.npc || ws.trade) return;
      (ws.recipes || []).forEach(function (r) {
        Object.keys(r.needs || {}).forEach(function (n) { if (VALUABLE[n] && r.needs[n] % PACE_CRAFT === 0) r.needs[n] = r.needs[n] / PACE_CRAFT; });
        recs.push(r);
      });
    });
    for (var pass = 0; pass < 6; pass++) {
      recs.forEach(function (r) {
        // only things you make: a raw material that a recipe also turns out (quartz from a rough gem, a herb from a pot) keeps
        // its own price -- else that recipe would set what an hour's gathering is worth
        if (!ITEMS[r.make] || VALUABLE[r.make] || PACE[r.make] || PACE_DUAL[r.make] || src[r.make]) return;
        var cost = r.fee || 0;
        Object.keys(r.needs || {}).forEach(function (n) { cost += priceOf(n) * r.needs[n]; });
        var floor = Math.ceil(cost * 1.1 / (r.n || 1) * 100) / 100;
        if (priceOf(r.make) < floor) ITEMS[r.make].price = floor;
      });
    }
  })();
