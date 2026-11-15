  // ==== the Oasis and the harbourmasters' contracts (2026-10-09, Cam: the Oasis "its own place", resting there "heal +
  //      pets", the mirage merchant "rare stock for coins" at night; cross-island trading as "contracts") ============
  REGIONS.oasis = CONTENT("REGIONS.oasis");
  REGION_ORDER.push("oasis");
  REGION_LINKS.push(["desert", "oasis"]);
  SECRETS.oasis = CONTENT("SECRETS.oasis");
  // (the Oasis's rare egg is the Wrapped egg, in its pool)
  PEOPLE.oasis = CONTENT("PEOPLE.oasis");
  SKILLS.foraging.spots.push({ id: "springgardens", name: "Spring gardens", area: "oasis", level: 45, time: 142, xp: 45, method: "pick",
                               loot: [["aloe", 55], ["dates", 30], ["lotus", 15]] });
  SKILLS.lumbering.spots.push({ id: "oasispalms", name: "Oasis palms", area: "oasis", level: 46, time: 145, xp: 46, method: "cut",
                                loot: [["palmlog", 80], ["dates", 20]] });
  var OASIS_REST = 4 * HOUR;
  // the mirage merchant: at the Oasis, after dark (9 pm to 5 am), four rare things a night
  WORKSHOPS.mirage = CONTENT("WORKSHOPS.mirage");
  WORKSHOP_ORDER.push("mirage");
  var MIRAGE_STOCK = CONTENT("MIRAGE_STOCK");
  function mirageStock(now) {
    var key = nightOf(now), h = 97;
    for (var ki = 0; ki < key.length; ki++) h = (h * 31 + key.charCodeAt(ki)) | 0;          // the same four all night
    var job = { seed: h }, pool = MIRAGE_STOCK.filter(function (x) { return ITEMS[x[0]]; }), out = [];
    while (out.length < 4 && pool.length) { var i = Math.floor(rnd(job) * pool.length); out.push(pool[i]); pool.splice(i, 1); }
    return out;
  }
  function atOasis(s) { return islandOf(s) === "desert" && !regionLock(s, "oasis"); }
  // contracts: each harbourmaster wants goods from elsewhere, three a day (a fourth, bigger, with a galleon); filled at that dock
  var CONTRACT_PORTS = CONTENT("CONTRACT_PORTS");   // smoked fish keeps; wool for the cold
  /** The skill a thing trains when it's delivered: the one that makes it, or gathers it -- and that xp a piece. */
  function tradeSkillOf(id) {
    var f = recipeFor(id);
    if (f && WORKSHOPS[f.ws].skill) return { skill: WORKSHOPS[f.ws].skill, xp: (f.rec.xp || 10) / (f.rec.n || 1) };
    for (var gi = 0; gi < GATHERING.length; gi++) {
      var sp = SKILLS[GATHERING[gi]].spots.filter(function (x) { return !x.essence && x.loot && x.loot[0][0] === id; })[0];
      if (sp) return { skill: GATHERING[gi], xp: sp.xp };
    }
    if (RANCH_GOODS.indexOf(id) >= 0) return { skill: "husbandry", xp: 6 };        // the Farm's goods (2026-10-13)
    return null;
  }
  function contractsFor(s, port, now) {
    var cp = CONTRACT_PORTS[port];
    if (!cp) return [];
    var day = Math.floor((now || 0) / DAY), job = { seed: (day * 7919 + port.length * 104729 + 7) | 0 };
    var pool = cp.goods.filter(function (g) { return ITEMS[g[0]]; }), out = [], big = shipTier(s) >= 4;
    for (var i = 0; i < (big ? 4 : 3) && pool.length; i++) {
      var k = Math.floor(rnd(job) * pool.length), g = pool.splice(k, 1)[0], n = g[1] * (i === 3 ? 2 : 1), ts = tradeSkillOf(g[0]);
      out.push({ id: g[0], n: n, coins: Math.ceil(priceOf(g[0]) * n * 2 * (i === 3 ? 1.5 : 1)) + (i === 3 ? 500 : 150),
                 skill: ts ? ts.skill : "", xp: ts ? Math.round(ts.xp * n * 0.5) : 0, big: i === 3 });
    }
    return out;
  }
  function contractsView(s, port, now) {
    var day = Math.floor((now || 0) / DAY), c = s.contracts && s.contracts.day === day ? s.contracts.done || {} : {}, done = c[port] || {}, b = s.bag || {};
    var cp = CONTRACT_PORTS[port], here = !!cp && islandOf(s) === cp.isle;
    var list = contractsFor(s, port, now).map(function (o, i) {
      return { i: i, id: o.id, name: ITEMS[o.id].name, n: o.n, have: b[o.id] || 0, coins: o.coins, xp: o.xp, skill: o.skill ? SKILLS[o.skill].name : "",
               big: o.big, done: !!done[i], can: here && !done[i] && (b[o.id] || 0) >= o.n };
    });
    return { port: port, who: cp ? cp.who : "", here: here, galleon: shipTier(s) >= 4, list: list,
             left: list.filter(function (o) { return !o.done; }).length };
  }
  function tradeAct(s, action, opts, now) {
    if (action === "oasisrest") {
      if (!atOasis(s)) return no(s, "The Oasis is on the Desert Island, past the Desert.");
      var pl = s.player;
      if (pl.job || pl.battle || pl.explore) return no(s, "You're busy -- come back first.");
      s.oasis = s.oasis || {};
      if (s.oasis.rested && now - s.oasis.rested < OASIS_REST) {
        var left = Math.ceil((OASIS_REST - (now - s.oasis.rested)) / MIN);
        return no(s, "You rested here not long ago -- the shade's yours again in " + (left >= 60 ? Math.floor(left / 60) + " h " + (left % 60) + " min" : left + " min") + ".");
      }
      s.oasis.rested = now;
      pl.hp = maxHp(pl);
      var perked = 0;
      [s.pet].concat(s.den || []).forEach(function (q) {
        if (!q || !q.s || q.away || stage(q, now) === "egg") return;
        q.s.energy = clamp(q.s.energy + 40); q.s.happy = clamp(q.s.happy + 30); perked++;
      });
      return yes(s, now, "You rested in the palms' shade by the cool water -- fully healed" + (perked ? ", and your pets drank and dozed (energy +40, fun +30)" : "") + ".");
    }
    if (action === "contract") {
      var port = opts.port, cp = CONTRACT_PORTS[port];
      if (!cp) return no(s, "There's no harbour like that.");
      if (islandOf(s) !== cp.isle) return no(s, cp.who + "'s contracts are filled at " + REGIONS[port].name + "'s dock.");
      var day = Math.floor(now / DAY), list = contractsFor(s, port, now), ci = opts.i | 0, ct = list[ci];
      if (!ct) return no(s, "There's no contract like that.");
      if (!s.contracts || s.contracts.day !== day) s.contracts = { day: day, done: {} };
      var done = s.contracts.done[port] = s.contracts.done[port] || {};
      if (done[ci]) return no(s, "That contract's been filled -- new ones are posted tomorrow.");
      if (!has(s, ct.id, ct.n)) return no(s, "The contract is for " + ct.n + " × " + ITEMS[ct.id].name.toLowerCase() + " -- you have " + (s.bag[ct.id] || 0) + ".");
      take(s, ct.id, ct.n);
      done[ci] = 1;
      s.coins = (s.coins || 0) + ct.coins;
      if (ct.skill && ct.xp) addXp(s, s.player, ct.skill, ct.xp, now);
      give(s, ct.big ? "ironcrate" : "woodcrate", 1);
      var all = list.every(function (x, k) { return done[k]; });
      if (all) give(s, "ironcrate", 1);
      return yes(s, now, "Contract filled: " + ct.n + " × " + ITEMS[ct.id].name.toLowerCase() + " for " + ct.coins + " coins" +
                 (ct.skill && ct.xp ? ", " + ct.xp + " " + SKILLS[ct.skill].name + " xp" : "") + " and " + (ct.big ? "an iron" : "a wooden") + " crate." +
                 (all ? " Every contract today filled -- an iron crate from " + cp.who.replace("Harbourmaster ", "") + " as thanks!" : ""));
    }
    return null;
  }

