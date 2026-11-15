  // ---- Know your quarry (V6, carried 10-0 and Cam's yes, 2026-10-18) -------------------------------------------------------
  // Cam (PT15 c3): "with any weakness or resistence in the game, you have to vs the monster first in order to learn its weakness and
  // resistence ... special drops from normal monsters that unlocks after you beat a large amount of those creatures ... maybe the
  // hunter can present the beastiary". Every creature beaten is counted in s.quarry[monster] (you, your pack, your pets' hunts);
  // knowledge fills in at QUARRY.tiers; MASTERY is about QUARRY.hours of hunting the ground it shows up most on (Cam's q1 b).
  var QUARRY = CONTENT("QUARRY");
  var MASTERY_DROPS = CONTENT("MASTERY_DROPS");
  var QUARRY_ITEMS = CONTENT("QUARRY_ITEMS");
  Object.keys(QUARRY_ITEMS).forEach(function (k) { ITEMS[k] = QUARRY_ITEMS[k]; });
  var QUARRY_RECIPES = CONTENT("QUARRY_RECIPES");
  Object.keys(QUARRY_RECIPES).forEach(function (w) { QUARRY_RECIPES[w].forEach(function (r) { WORKSHOPS[w].recipes.push(r); }); });
  // (Ranger Ash's "Know your quarry" is in his list, content/24; the Combat Designer's elements in ELEMENT_WEAK, content/40-zzz-m)
  // a quest need: beat N of a creature
  questProgressHooks.push(function (s, n, out) {
    if (n.beat) out.push({ text: "Beat " + MONSTERS[n.beat[0]].name.toLowerCase() + "s", have: Math.min(n.beat[1], quarryKills(s, n.beat[0])), need: n.beat[1] });
  });
  /** Mastery, per creature: QUARRY.hours of hunting at the ground where it comes most often (kills an hour = 3600 / the ground's
   *  fight time x its share of that ground's creatures, day and night apart). Bosses and the tower's mages aren't hunted. */
  var QUARRY_MASTERY = (function () {
    var best = {};
    Object.keys(HUNTS).forEach(function (g) {
      var h = HUNTS[g];
      if (!h.monsters || !h.monsters.length || !h.time) return;
      ["day", "night"].forEach(function (when) {
        var pool = h.monsters.filter(function (m) { return !m[2] || m[2] === when; }), tot = pool.reduce(function (a, m) { return a + m[1]; }, 0);
        pool.forEach(function (m) { var perHour = 3600 / h.time * m[1] / tot; if (!best[m[0]] || perHour > best[m[0]]) best[m[0]] = perHour; });
      });
    });
    var out = {};
    Object.keys(best).forEach(function (m) {
      out[m] = Math.max(QUARRY.min, Math.min(QUARRY.max, Math.round(best[m] * QUARRY.hours / QUARRY.round) * QUARRY.round));
    });
    return out;
  })();
  function quarryKills(s, mon) { return ((s && s.quarry) || {})[mon] || 0; }
  function quarryNeed(mon) { return QUARRY_MASTERY[mon] || 0; }
  function quarryMastered(s, mon) { return !!quarryNeed(mon) && quarryKills(s, mon) >= quarryNeed(mon); }
  /** What a creature fears and shrugs off: weapon styles, then elements. */
  function quarryTruth(mon) {
    var M = MONSTERS[mon] || {}, keys = function (o, up) { return Object.keys(o || {}).filter(function (k) { return up ? o[k] > 1 : o[k] < 1; }); };
    var els = Object.keys(ELEMENT_WEAK).filter(function (el) { return ELEMENT_WEAK[el] && typeof ELEMENT_WEAK[el] === "object" && ELEMENT_WEAK[el].weak; });
    return { weak: keys(M.weak, true), resist: keys(M.resist, false),
             elWeak: els.filter(function (el) { return ELEMENT_WEAK[el].weak.indexOf(mon) >= 0; }),
             elResist: els.filter(function (el) { return (ELEMENT_WEAK[el].resist || []).indexOf(mon) >= 0; }) };
  }
  /** What YOU know of it: only what your kills have taught you (null = not yet). */
  function quarryKnow(s, mon) {
    var n = quarryKills(s, mon), T = QUARRY.tiers, t = quarryTruth(mon), need = quarryNeed(mon), d = MASTERY_DROPS[mon];
    return { kills: n, weak: n >= T.style ? t.weak : null, resist: n >= T.resist ? t.resist : null,
             elWeak: n >= T.elements ? t.elWeak : null, elResist: n >= T.elements ? t.elResist : null,
             next: n < T.style ? T.style : n < T.resist ? T.resist : n < T.elements ? T.elements : need && n < need ? need : 0,
             mastery: need, mastered: quarryMastered(s, mon), drop: d ? { id: d, name: ITEMS[d].name, about: ITEMS[d].about || "" } : null };
  }
  /** A creature beaten: counted, and a line in the log when you learn something. */
  function quarryKill(s, mon, at) {
    if (!MONSTERS[mon] || MONSTERS[mon].mage) return;
    s.quarry = s.quarry || {};
    var n = (s.quarry[mon] || 0) + 1, T = QUARRY.tiers, t = quarryTruth(mon), name = MONSTERS[mon].name;
    s.quarry[mon] = n;
    var list = function (a) { return a.length ? a.join(" and ") : "nothing in particular"; };
    if (n === T.style) note(s, at, "Bestiary: you've learnt where to hit " + aOr(name.toLowerCase()) + " -- it's weak to " + list(t.weak) + ".");
    else if (n === T.resist) note(s, at, "Bestiary: " + aOr(name.toLowerCase()) + " shrugs off " + list(t.resist) + ".");
    else if (n === T.elements) note(s, at, "Bestiary: " + aOr(name.toLowerCase()) + " fears " + list(t.elWeak) + " and shrugs off " + list(t.elResist) + " (elements).");
    if (quarryNeed(mon) && n === quarryNeed(mon)) note(s, at, "Bestiary: you've MASTERED the " + name.toLowerCase() + " -- +" + Math.round(QUARRY.bonus.dmg * 100) + "% damage and drops against it" +
      (MASTERY_DROPS[mon] ? ", and now and then its " + ITEMS[MASTERY_DROPS[mon]].name.toLowerCase() + "." : ", and a trophy in your Bestiary."));
  }
  /** A mastered creature: its own drop, now and then (r: the fight's dice). */
  function quarrySpoils(s, mon, r, got) {
    var d = MASTERY_DROPS[mon];
    if (!d || !quarryMastered(s, mon) || r() >= QUARRY.dropChance) return;
    give(s, d, 1, true); if (got) got[d] = (got[d] || 0) + 1;
  }
  function quarryDmg(s, mon) { return quarryMastered(s, mon) ? 1 + QUARRY.bonus.dmg : 1; }
  function quarryDrops(s, mon) { return quarryMastered(s, mon) ? 1 + QUARRY.bonus.drops : 1; }
  // ---- the mastery drops' small effects (the Game Developer's list) ----
  /** Emerald fly: quicker at fly-fishing spots (a divisor for a find's time). */
  function quarrySpeed(s, sp) { return sp && sp.method === "fly" && has(s, "emeraldfly") ? 1.05 : 1; }
  /** Lucky trotter: a few more rare finds digging (x the rare chance). */
  function quarryRare(s, skill) { return skill === "digging" && has(s, "luckytrotter") ? 1.02 : 1; }
  /** Echo bell: the crypt's night creatures come a tenth more often. */
  // ---- TRACKING (V15, carried with Cam's yes, 2026-10-18): hunt only one kind on a ground -- anyone once they've beaten its boss
  //      TRACK.bossWins times, a Hunter from the start; a search between fights (TRACK.search of the ground's fight time) keeps it
  //      to quests, mastery and the drop you want, not more coins an hour (the Mathematician's 1.5x).
  var TRACK = { bossWins: 5, search: 0.5 };
  function trackWhy(s, groundId) {
    var h = HUNTS[groundId]; if (!h || !h.monsters) return "There's nothing to track there.";
    if ((s.player || {}).cls === "hunter") return "";
    var w = (((s.hunt || {})[groundId]) || {}).wins || 0;
    return w >= TRACK.bossWins ? "" : "Beat " + MONSTERS[h.boss].name + " " + TRACK.bossWins + " times first (" + w + "/" + TRACK.bossWins + ") -- or be a Hunter";
  }
  /** track {ground, mon} -- follow one kind there; mon "" stops. */
  function trackAct(s, action, opts, now) {
    if (action !== "track") return null;
    var h = HUNTS[opts.ground]; if (!h || !h.monsters) return no(s, "There's no hunting ground like that.");
    s.track = s.track || {};
    if (!opts.mon) { delete s.track[opts.ground]; return yes(s, now, "You stop tracking at the " + h.name + "."); }
    if (!h.monsters.some(function (m) { return m[0] === opts.mon; })) return no(s, "That creature doesn't live there.");
    var why = trackWhy(s, opts.ground); if (why) return no(s, why + ".");
    s.track[opts.ground] = opts.mon;
    return yes(s, now, "You'll track " + MONSTERS[opts.mon].name.toLowerCase() + "s at the " + h.name + " -- a little slower, but only them.");
  }
  /** The pause between fights while tracking: looking for that one kind -- half as long again as the fight that just ended. */
  function trackGap(s, groundId, fightMs) { return (s.track || {})[groundId] && HUNTS[groundId] ? Math.round(Math.max(0, fightMs || 0) * TRACK.search) : 0; }
  function quarryPool(s, groundId, pool) {
    var tr = s && (s.track || {})[groundId];                              // tracking (V15)
    if (tr && pool.some(function (m) { return m[0] === tr; })) return [[tr, 1]];
    // the sandbox: hunt only one creature here (Cam, PT14 p4: "the ability to target a specific mob in a specific area")
    var tg = s && s.dev && s.dev.on && (s.dev.target || {})[groundId];
    if (tg && pool.some(function (m) { return m[0] === tg; })) return [[tg, 1]];
    if (groundId !== "hollowcrypt" || !has(s, "echobell")) return pool;
    return pool.map(function (m) { return m[2] === "night" ? [m[0], m[1] * 1.1, m[2]] : m; });
  }
  /** Wraith's veil: the undead's first hit in a fight, halved. */
  function quarryVeil(s, b, mon) {
    if (!b || b.veiled || !has(s, "wraithveil") || !isUndead(mon)) return 1;
    b.veiled = true;
    return 0.5;
  }
  /** Wisp in a jar: one vigil a week always meets a wisp. */
  function quarrySureVigil(s, now) {
    var pl = s.player;
    if (!has(s, "wispjar") || (pl.necro.jarAt || 0) > now - 7 * DAY) return false;
    pl.necro.jarAt = now;
    return true;
  }
  /** Why a thing can't be sold ("" if it can): mastery drops are bound (the Economist). */
  function boundWhy(id) { return ITEMS[id] && ITEMS[id].bound ? "The " + ITEMS[id].name.toLowerCase() + " is yours -- a mastery's keepsake can't be sold." : ""; }
  /** The Bestiary's hunting side (one page with the pets' side, the Library's): ground by ground, what you know. */
  function quarryView(s) {
    return HUNT_ORDER.filter(function (g) { return HUNTS[g] && HUNTS[g].monsters && HUNTS[g].monsters.length; }).map(function (g) {
      var h = HUNTS[g], seen = {};
      var mons = h.monsters.map(function (m) { return m[0]; }).concat(h.boss && !MONSTERS[h.boss].mage ? [h.boss] : []).filter(function (m) { if (seen[m]) return false; seen[m] = 1; return true; });
      return { ground: g, name: h.name, level: h.level, trackWhy: trackWhy(s, g), creatures: mons.map(function (m) {
        var k = quarryKnow(s, m);
        return { id: m, name: MONSTERS[m].name, boss: !!MONSTERS[m].boss, night: h.monsters.some(function (x) { return x[0] === m && x[2] === "night"; }), know: k,
                 tracked: (s.track || {})[g] === m, canTrack: !MONSTERS[m].boss && !trackWhy(s, g) };
      }) };
    });
  }
