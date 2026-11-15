  // ==== the towns' painted buildings (2026-10-09, Cam: "make the painted buildings work"): the bazaar in Sandport, the
  //      trading post in Frosthaven -- each sells its island's goods and buys anything -- and each town's inn (a paid rest)
  WORKSHOPS.bazaar = CONTENT("WORKSHOPS.bazaar");
  WORKSHOPS.tradingpost = CONTENT("WORKSHOPS.tradingpost");
  WORKSHOP_ORDER.push("bazaar", "tradingpost");
  var ISLE_STOCK = CONTENT("ISLE_STOCK");
  var INNS = CONTENT("INNS"), INN_REST = 2 * HOUR;
  function innAct(s, action, opts, now) {
    if (action !== "inn") return null;
    var town = opts.town, inn = INNS[town], pl = s.player;
    if (!inn) return no(s, "There's no inn like that.");
    if (islandOf(s) !== REGIONS[town].isle || pl.voyage) return no(s, "The inn is in " + REGIONS[town].name + ".");
    if (pl.job || pl.battle || pl.explore) return no(s, "You're busy -- come back first.");
    s.inn = s.inn || {};
    if (s.inn[town] && now - s.inn[town] < INN_REST) return no(s, "Your room's still warm -- come back in " + Math.ceil((INN_REST - (now - s.inn[town])) / MIN) + " minutes.");
    if (!hasCoins(s, inn.cost)) return no(s, "A night at " + inn.name + " is " + inn.cost + " coins -- you have " + (s.coins || 0) + ".");
    spend(s, inn.cost);
    s.inn[town] = now;
    pl.hp = maxHp(pl);
    [s.pet].concat(s.den || []).forEach(function (q) { if (q && q.s && !q.away && stage(q, now) !== "egg") { q.s.energy = clamp(q.s.energy + 40); q.s.full = clamp(q.s.full + 30); } });
    return yes(s, now, "A hot meal and a soft bed at " + inn.name + " (" + inn.cost + " coins): fully healed, and your pets fed and rested.");
  }

