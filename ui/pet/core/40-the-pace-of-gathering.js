  // ==== the pace of gathering (2026-10-09, Cam: "in melvor idle collecting lower/mid tier materials doesnt take a long
  //      time ... most gathering spots have a 3 second timer for gathering attempts ... I would like greater emphasis on
  //      crafting so it will require a larger turn over of materials"). Last, once every spot and recipe is in: an
  //      attempt takes 3 s at level 1 up to 8 s at the top (it was 45 s up to 165 s). By the hour, the xp, rare finds
  //      (eggs too), fishing bait, gathering draughts, notice-board orders and what gathered things sell for stay as
  //      they were -- you just get far more of them. Crafting (not cooking) eats five times the raw materials, for
  //      twice the xp. PACE[item] = new time / old time where it's gathered (about 1/15).
  // (2026-10-09, after the sums: x2 a craft made an hour's gathering worth 6x the crafting xp, the kitchen 15x) -- a craft
  // keeps its old xp (3x by the hour now), and a dish a fifth of its old xp (one fish a dish still, 15x the fish: 3x too)
  // early fishing (2026-10-10, Cam: "it feels slow in the lower levels" -- the nets, rods and bait cost it time the other
  // skills don't spend): +30% xp at every fishing spot up to level 15
  var EARLY_FISH_XP = 1.3, EARLY_FISH_TO = 15;
  SKILLS.fishing.spots.forEach(function (sp) { if (!sp.essence && sp.level <= EARLY_FISH_TO) sp.xp = Math.round(sp.xp * EARLY_FISH_XP * 100) / 100; });
  // (2026-10-10 audit, MATH-3) the rune shrines stay faster than gathering on purpose: each action burns an essence you mine
  // first (~0.75 h of mining per hour at a shrine), so per hour of PLAY Runecrafting runs ~1,300 xp/h, in line with the rest.
  var PACE = {}, PACE_DUAL = {}, PACE_CRAFT = 5, PACE_CRAFT_XP = 1, PACE_COOK_XP = 0.2;
  (function () {
    var dropped = {}, lowest = {}, dual = {};
    Object.keys(MONSTERS).forEach(function (m) { (MONSTERS[m].drops || []).forEach(function (d) { dropped[d[0]] = 1; }); });
    GATHERING.forEach(function (k) {
      SKILLS[k].spots.forEach(function (sp) {
        if (sp.oldTime || sp.essence) return;                            // a skill's essence stays rare (amulets)
        var lv = Math.max(1, Math.min(50, sp.level || 1)), t = Math.round((3 + 5 * (lv - 1) / 49) * 10) / 10, f = t / sp.time;
        sp.oldTime = sp.time; sp.pace = f; sp.time = t;
        sp.xp = Math.round(sp.xp * f * 100) / 100;
        if (sp.rare) sp.rare = [sp.rare[0], Math.max(1, Math.round(sp.rare[1] / f))];
        if (sp.bait && k === "fishing") sp.baitPace = f;
        (sp.loot || []).forEach(function (l) {
          var id = l[0];
          if (!ITEMS[id]) return;
          // (2026-10-10 audit, MATH-1) gathered AND dropped by monsters: its price follows the gathering pace too (raw herring
          // sold for ~3,600 coins an hour, honeycomb ~4,700, against ~150 for sardines) -- but crafting doesn't eat five of it
          var into = dropped[id] ? dual : PACE;
          if (!(id in lowest) || sp.level < lowest[id]) { lowest[id] = sp.level; into[id] = f; if (into === PACE) delete dual[id]; else delete PACE[id]; }
        });
      });
    });
    Object.keys(PACE).concat(Object.keys(dual)).forEach(function (id) { ITEMS[id].price = Math.max(0.01, Math.round(priceOf(id) * (PACE[id] || dual[id]) * 100) / 100); });
    PACE_DUAL = dual;
    ORDER_LINES.forEach(function (o) { if (PACE[o.id]) o.xp = Math.round(o.xp * PACE[o.id] * 100) / 100; });
    Object.keys(ITEMS).forEach(function (id) { var b = ITEMS[id].brew; if (b && b.kind === "gather") b.uses *= 15; });
    var seen = [];
    Object.keys(WORKSHOPS).forEach(function (w) {
      var ws = WORKSHOPS[w];
      if (ws.npc) return;
      if (w === "kitchen") {
        (ws.recipes || []).forEach(function (r) {
          var main = r.needs && Object.keys(r.needs)[0];
          if (r.paced || !main || !(PACE[main] || PACE_DUAL[main])) return;   // its main ingredient gathered (a rabbit stew's is hunted)
          r.paced = true; r.xp = Math.max(1, Math.round((r.xp || 0) * PACE_COOK_XP * 10) / 10);
        });
        return;
      }
      (ws.recipes || []).forEach(function (r) {
        if (!r.needs || seen.indexOf(r.needs) >= 0) return;
        seen.push(r.needs);
        var hit = false;
        Object.keys(r.needs).forEach(function (k) { if (PACE[k] || HERB_TIER_OF[k]) { r.needs[k] *= PACE_CRAFT; hit = true; } });
        if (hit) r.xp = Math.round((r.xp || 0) * PACE_CRAFT_XP);
      });
    });
  })();

