  // ==== recipe xp from one rule (2026-10-10, audit M-4 / MATH-6 -- Cam: "lets work on 5 and 6"). Last, once every spot,
  //      recipe, pace and price is in. Instead of 447 hand-set numbers (an hour's gathering crafted into anything from
  //      0.2x to 4x that hour's xp), a craft's xp is what its materials cost to gather, in hours, times the gathering xp an
  //      hour earns at the recipe's level: an hour of gathering crafts into about an hour of crafting xp, at every bench.
  //   - gathered things: their best spot; identified herbs: their tier's unidentified herbs, by the herb's share;
  //   - made things: what went into them, through every bench before;
  //   - by-products count a half (byproduct), because what made them already paid its own xp: hides, meat and trophies
  //     from hunting (combat runs ~1.5x gathering, so 1.5 + 0.5 = an hour gathering then crafting), crops (farming xp);
  //   - one craft is worth at most CAP hours of gathering (a 24-scale gorgon plate is a trophy, not a day's xp);
  //   - a recipe whose materials come from nowhere the rule can see keeps its own number (RECIPE_XP.kept lists them).
  // fights: your live fights run about ten to a hunting ground's round (7-12x; tools/balance_sim.js measured it 2026-10-10)
  var RECIPE_XP = CONTENT("RECIPE_XP");
  var recipeEffort = (function () {
    var R = RECIPE_XP, gather = {}, side = {};                           // id -> hours for one, gathered / as a by-product
    var spots = [];
    GATHERING.forEach(function (k) { SKILLS[k].spots.forEach(function (sp) { if (!sp.essence && sp.loot) spots.push({ k: k, sp: sp }); }); });
    var perHour = function (sp) { var total = sp.loot.reduce(function (a, l) { return a + l[1]; }, 0);
      return sp.loot.map(function (l) { return [l[0], 3600 / sp.time * l[1] / total]; }); };
    var best = function (into, id, n) { if (n > 0 && (!(id in into) || 1 / n < into[id])) into[id] = 1 / n; };
    var tierRate = {};
    spots.forEach(function (x) { perHour(x.sp).forEach(function (l) {
      best(gather, l[0], l[1]);
      var t = HERB_TIER_OF[l[0]];
      if (t) tierRate[t] = Math.max(tierRate[t] || 0, l[1]);
    }); });
    HERB_TIERS.forEach(function (T) {                                    // a herb: its tier's finds, by its share of the pool
      var total = T.pool.reduce(function (a, p) { return a + p[1]; }, 0);
      if (tierRate[T.tier]) T.pool.forEach(function (p) { best(gather, p[0], tierRate[T.tier] * p[1] / total); });
    });
    Object.keys(HUNTS).forEach(function (g) {                            // drops: kills an hour x how often x how many
      var h = HUNTS[g], tw = h.monsters.reduce(function (a, m) { return a + m[1]; }, 0);
      h.monsters.forEach(function (m) { ((MONSTERS[m[0]] || {}).drops || []).forEach(function (d) {
        best(side, d[0], 3600 * R.fights / h.time * m[1] / tw * (d[1] + d[2]) / 2 * (d[3] == null ? 1 : d[3]));
      }); });
    });
    Object.keys(CROPS).forEach(function (c) {                            // a crop: four stages, its yield, on every plot
      var C = CROPS[c]; if (ITEMS[c]) best(side, c, (C.yield[0] + C.yield[1]) / 2 * R.plots / (4 * C.stage / HOUR));
    });
    var maker = {};
    Object.keys(WORKSHOPS).forEach(function (w) { var ws = WORKSHOPS[w]; if (ws.npc || ws.trade) return;
      (ws.recipes || []).forEach(function (r) { if (r.needs && (!maker[r.make] || (r.level || 1) < (maker[r.make].level || 1))) maker[r.make] = r; }); });
    var memo = {}, busy = {};
    /** Hours of gathering one of this item is worth to a recipe (null: the rule can't tell). */
    function effort(id) {
      if (id in memo) return memo[id];
      if (busy[id]) return null;                                         // a loop (a herb from a pot, a pot from herbs)
      busy[id] = 1;
      var h = null;
      if (id in gather) h = gather[id];
      else if (maker[id]) h = needsEffort(maker[id].needs) / (maker[id].n || 1);
      else if (id in side) h = side[id] * R.byproduct;
      else if (ITEMS[id] && priceOf(id) > 0) h = priceOf(id) / ((150 + 55) * 0.6) * R.byproduct;    // a trophy or a rare find: by its worth, in coins of an early hour
      delete busy[id];
      if (h != null && !isFinite(h)) h = null;
      memo[id] = h;
      return h;
    }
    function needsEffort(needs) {
      var h = 0;
      for (var k in needs) { var e = effort(k); if (e == null) return null; h += e * needs[k]; }
      return h;
    }
    var near = function (lv) {                                           // the gathering xp an hour earns around this level
      var a = spots.filter(function (x) { return x.k !== "runecrafting" && Math.abs((x.sp.level || 1) - lv) <= 5; })
                   .map(function (x) { return x.sp.xp * 3600 / x.sp.time; }).sort(function (p, q) { return p - q; });
      return a.length ? a[a.length >> 1] : 0;
    };
    var xph = {};
    Object.keys(WORKSHOPS).forEach(function (w) {
      var ws = WORKSHOPS[w];
      if (ws.npc || ws.trade || !ws.skill) return;
      (ws.recipes || []).forEach(function (r) {
        if (!r.xp || !r.needs) return;
        var lv = r.level || 1, h = needsEffort(r.needs);
        if (h == null || !(h > 0)) { R.kept.push(w + ":" + r.make); return; }
        if (!(lv in xph)) xph[lv] = near(lv);
        R.was[w + ":" + r.make] = r.xp;
        r.xp = Math.max(0.1, Math.round(R.rate * xph[lv] * Math.min(R.cap, h) * 10) / 10);
      });
    });
    return function (id) { return effort(id); };
  })();
