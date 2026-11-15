  // ---- Battle Re-work Part 4: the Hunter -- traps, nets and the hunting knife (2026-10-15) --------------------------
  //      Cam: "Hunter: traps, nets, hunting knife ... a trapped or netted creature loses its turns for a random number of
  //      rounds, dependent on player class level and monster level." The plan (note 03): snares and bear traps are laid
  //      (once a fight), nets are thrown (picked up again half the time); both cost your attack, like eating. They work
  //      through the effects of Part 1 -- diminishing returns, a boss's half, a round more or less for each 10 levels
  //      between your class and the creature, and what a creature shrugs off (CREATURE_GUARDS).
  //   - FIGHTS: the battle command "tool" {item} readies it for your next turn (a manual fight: it is your move);
  //   - THE HUNT PLAN (Cam's Q1: "net creatures above Y"): lay a trap as each fight opens, and throw a net when the
  //     creature's above a line -- so idle hunts use them too;
  //   - THE KNIFE: a Hunter's off-hand weapon for when the arrows run out: the Ranged hand, a second stab now and then.
  var HUNTER_ITEMS = CONTENT("HUNTER_ITEMS");
  Object.keys(HUNTER_ITEMS).forEach(function (k) { if (k !== "//") ITEMS[k] = HUNTER_ITEMS[k]; });
  var HUNTER_RECIPES = CONTENT("HUNTER_RECIPES");
  Object.keys(HUNTER_RECIPES).forEach(function (w) { if (w !== "//") HUNTER_RECIPES[w].forEach(function (r) { WORKSHOPS[w].recipes.push(r); }); });
  var KNIFE_TYPES = CONTENT("KNIFE_TYPES");
  Object.keys(KNIFE_TYPES).forEach(function (k) { if (k !== "//") { WEAPONS[k] = KNIFE_TYPES[k]; WEAR[k] = copy(ITEMS[k].gear.req); } });
  var TOOL_RULES = CONTENT("TOOL_RULES");
  var CREATURE_GUARDS = CONTENT("CREATURE_GUARDS");
  Object.keys(CREATURE_GUARDS).forEach(function (m) {
    var g = CREATURE_GUARDS[m], mon = MONSTERS[m];
    if (m === "//" || !mon) return;
    if (g.immune) mon.immune = (mon.immune || []).concat(g.immune.filter(function (x) { return (mon.immune || []).indexOf(x) < 0; }));
    if (g.resist) { mon.fxResist = mon.fxResist || {}; Object.keys(g.resist).forEach(function (k) { mon.fxResist[k] = g.resist[k]; }); }
  });
  var NET_PLAN = CONTENT("NET_PLAN");
  var TOOL_IDS = Object.keys(HUNTER_ITEMS).filter(function (k) { return k !== "//" && HUNTER_ITEMS[k].hunterTool; });

  function isTool(id) { return !!(ITEMS[id] && ITEMS[id].hunterTool); }
  function canUseTools(pl) { return !!pl && TOOL_RULES.classes.indexOf(pl.cls) >= 0; }
  /** This class uses this kind of tool (traps and nets: the Hunter; throwing knives: the Thief -- Part 7). */
  function toolKindOk(pl, kind) {
    var c = TOOL_RULES.kinds[kind];
    if (pl && (kind === "trap" || kind === "net") && talentSum(pl).trapUse) return true;   // Trap-making, a technique (Part 9)
    return !!pl && !!c && c.indexOf(pl.cls) >= 0;
  }
  /** Traps a fight: one, two with Second snare. */
  function trapsAllowed(pl) { return TOOL_RULES.trapsPerFight + (talentSum(pl).traps || 0); }
  /** Your traps or nets in the bag, best first. */
  function toolsHeld(s, kind) {
    return TOOL_IDS.filter(function (k) { return ITEMS[k].hunterTool.kind === kind && ((s.bag || {})[k] > 0 || (s.dev && s.dev.infinite)); })
                   .sort(function (a, b) { return ITEMS[b].hunterTool.tier - ITEMS[a].hunterTool.tier; });
  }
  /** The one your plan uses: the one you chose if you have it, else your cheapest (a fight a trap adds up: the dear ones
   *  are yours to choose). */
  function planTool(s, pl, kind) {
    var want = (pl.combat || {})[kind], have = toolsHeld(s, kind);
    return want && have.indexOf(want) >= 0 ? want : have.slice().sort(function (a, b) { return priceOf(a) - priceOf(b); })[0] || "";
  }
  /** Why this tool can't be used in this fight now ("" if it can). */
  function toolWhyNot(s, pl, b, id) {
    var it = ITEMS[id];
    if (!it || !it.hunterTool) return "That isn't a trap or a net.";
    if (!toolKindOk(pl, it.hunterTool.kind)) return it.hunterTool.kind === "throw" ? "Only a Thief throws knives." : "Only a Hunter knows how to set traps and throw nets.";
    if (!has(s, id) && !(s.dev && s.dev.infinite)) return "There's no " + it.name.toLowerCase() + " in the bag.";
    if (b && it.hunterTool.kind === "trap" && (b.traps || 0) >= trapsAllowed(pl)) return trapsAllowed(pl) > 1 ? "You've laid your " + trapsAllowed(pl) + " traps this fight." : "One trap a fight (Second snare, in the Trapper branch, gives you two).";
    return "";
  }
  /** The most rounds this trap or net could hold this creature now (0: it can't -- immune, a boss's half, too far above
   *  you, or caught too often already): addEffect's sums, at their best roll. */
  function toolHolds(s, pl, b, id) {
    var T = ITEMS[id].hunterTool, kind = T.kind === "trap" ? "trapped" : "netted", mon = MONSTERS[b.mon], E = EFFECTS[kind], tl = talentSum(pl);
    if ((mon.immune || []).indexOf(kind) >= 0 || (mon.immune || []).indexOf(E.group) >= 0) return 0;
    var n = T.rounds[1] + ((T.kind === "trap" ? tl.trapRound : tl.netRound) > 0 ? 1 : 0) + Math.trunc((classLevel(pl, pl.cls) - creatureLevel(mon)) / EFFECT_RULES.levelStep);
    n = Math.floor(n * EFFECT_RULES.dr[Math.min((b.dr || {}).them || 0, EFFECT_RULES.dr.length - 1)]);
    if (mon.boss) n = Math.min(EFFECT_RULES.bossMaxControl, Math.floor(n * EFFECT_RULES.bossControl));
    if (mon.fxResist && mon.fxResist[kind]) n = Math.floor(n * mon.fxResist[kind]);
    return Math.max(0, n);
  }
  /** Your turn, with a trap or a net instead of a blow. Returns true if it took your attack (Ambush: a trap that opens a
   *  fight doesn't). Called by battleRound with the round's log. */
  function useTool(s, pl, b, at, log) {
    var id = b.toolNext && b.toolNext.item, it = ITEMS[id];
    b.toolNext = null;
    if (!it || toolWhyNot(s, pl, b, id)) return false;                    // gone since you picked it: you just attack
    var T = it.hunterTool, tl = (b.me && b.me.tal) || talentSum(pl), mon = MONSTERS[b.mon];
    if (!(s.dev && s.dev.infinite)) take(s, id, 1);
    if (T.kind === "trap") b.traps = (b.traps || 0) + 1;
    if (T.keep) (b.nets = b.nets || []).push(id);                         // a net, a bear trap: picked up after a win, mostly
    log({ by: "you", tool: id, kind: T.kind, w: it.name });
    if (T.kind === "throw") {                                               // a Thief's throwing knife: a hit, and your poison (Part 7)
      var td = Math.max(1, T.damage[0] + Math.floor(rnd(b) * (T.damage[1] - T.damage[0] + 1)) + (tl.throwDmg || 0));
      td = Math.max(1, Math.round(td * mult(mon.weak, "pierce") * mult(mon.resist, "pierce")));
      b.mhp -= td;
      log({ by: "you", hit: td, w: it.name, wp: true });
      thiefOnHit(s, pl, b, at, false);
      return true;
    }
    var bonus = rnd(b) < (T.kind === "trap" ? tl.trapRound || 0 : tl.netRound || 0) ? 1 : 0;   // Snarecraft, Wide mesh
    var n = addEffect(b, "them", T.kind === "trap" ? "trapped" : "netted", { rounds: [T.rounds[0] + bonus, T.rounds[1] + bonus], lvl: classLevel(pl, pl.cls) }, at);
    if (n > 0) pl.caught = (pl.caught || 0) + 1;                             // for Ranger Ash
    var hurt = 1 + (tl.trapDmg || 0);                                       // Barbed jaws
    if (n > 0 && T.spring) {                                                // the bear trap's snap
      var d = Math.max(1, Math.round((T.spring[0] + Math.floor(rnd(b) * (T.spring[1] - T.spring[0] + 1))) * hurt * mult(mon.weak, "pierce") * mult(mon.resist, "pierce")));
      b.mhp -= d;
      log({ by: "you", hit: d, w: it.name, wp: true });
    }
    if (n > 0 && T.bleed) addEffect(b, "them", "bleeding", { rounds: T.bleed[1], power: Math.round(T.bleed[0] * hurt) }, at);
    if (n > 0 && T.burn) addEffect(b, "them", "burning", { rounds: T.burn[1], power: T.burn[0] }, at);
    return !(T.kind === "trap" && b.n === 1 && tl.ambush);
  }
  /** A creature worth a trap: a boss, or one that could finish you in TOOL_RULES.toughBlows of its best blows. */
  function toughFoe(pl, b) {
    var mon = MONSTERS[b.mon];
    return !!mon.boss || worstHit(mon, b.me || {}, b.rage) * TOOL_RULES.toughBlows >= maxHp(pl);
  }
  /** The hunt plan (not in a manual fight): a trap as each fight opens; a net when the creature's above your line --
   *  on dangerous creatures only (the plan's default: a trap on a rabbit costs your first blow for nothing), or on all. */
  function planToolFor(s, pl, b) {
    if (b.manual || b.toolNext || !canUseTools(pl) || pl !== s.player) return;
    var cb = pl.combat || {}, id;
    if (cb.toolsOn !== "all" && !toughFoe(pl, b)) return;
    if (b.n === 1 && cb.trapOpen && (id = planTool(s, pl, "trap")) && !toolWhyNot(s, pl, b, id) && toolHolds(s, pl, b, id)) { b.toolNext = { item: id, plan: true }; return; }
    var max = b.mhp0 || MONSTERS[b.mon].hp;
    if (cb.netAbove > 0 && !b.planNet && b.mhp / max >= cb.netAbove && !fxHeld(b, "them") && (id = planTool(s, pl, "net")) && !toolWhyNot(s, pl, b, id) && toolHolds(s, pl, b, id)) {
      b.toolNext = { item: id, plan: true }; b.planNet = true;
    }
  }
  /** After a fight you won: nets and bear traps picked up again (each its keep; Net mender more for a net). */
  function toolsAfterFight(s, pl, b, res, at) {
    if (!b || !b.nets || !b.nets.length || res !== "won") return;
    var back = {}, nk = talentSum(pl).netKeep || 0;
    b.nets.forEach(function (id) { var T = ITEMS[id].hunterTool; if (rnd(b) < Math.min(0.95, T.keep + (T.kind === "net" ? nk : 0))) back[id] = (back[id] || 0) + 1; });
    Object.keys(back).forEach(function (id) { if (!(s.dev && s.dev.infinite)) give(s, id, back[id]); });
    if (b.kind === "hunt" && pl.job) { var j = pl.job; j.netsBack = (j.netsBack || 0) + Object.keys(back).reduce(function (a, k) { return a + back[k]; }, 0); }
  }
  /** The fight screen's Tools menu. */
  function toolsView(s, pl, b) {
    return TOOL_IDS.filter(function (k) { return toolKindOk(pl, ITEMS[k].hunterTool.kind) && ((s.bag || {})[k] > 0 || (s.dev && s.dev.infinite)); }).map(function (k) {
      var T = ITEMS[k].hunterTool, why = toolWhyNot(s, pl, b, k);
      return { id: k, name: ITEMS[k].name, kind: T.kind, keep: T.keep || 0, holds: T.kind === "throw" ? 0 : b ? toolHolds(s, pl, b, k) : T.rounds[1], damage: T.damage || null, count: (s.dev && s.dev.infinite) ? 999 : s.bag[k], rounds: T.rounds, spring: T.spring || null,
               bleed: T.bleed || null, burn: T.burn || null, can: !why, why: why };
      }).sort(function (x, y) { return x.kind === y.kind ? ITEMS[y.id].hunterTool.tier - ITEMS[x.id].hunterTool.tier : x.kind === "trap" ? -1 : 1; });
  }
  /** The hunt plan's traps and nets, for the Hunting page and the sheet's Combat tab. */
  function toolPlanView(s, pl) {
    var cb = pl.combat || {};
    return { can: canUseTools(pl), trapOpen: !!cb.trapOpen, netAbove: cb.netAbove || 0, above: NET_PLAN.above,
             trap: cb.trap || "", net: cb.net || "", toolsOn: cb.toolsOn === "all" ? "all" : "tough", toughBlows: TOOL_RULES.toughBlows, traps: toolsHeld(s, "trap").map(function (k) { return { id: k, name: ITEMS[k].name, count: (s.bag || {})[k] || 0 }; }),
             nets: toolsHeld(s, "net").map(function (k) { return { id: k, name: ITEMS[k].name, count: (s.bag || {})[k] || 0 }; }),
             caught: pl.caught || 0, perFight: trapsAllowed(pl) };
  }
  // Ranger Ash's quest: "catch N creatures in your traps or nets"
  questProgressHooks.push(function (s, n, out) {
    if (n.caught) out.push({ text: "Creatures caught in a trap or a net", have: Math.min(n.caught, (s.player || {}).caught || 0), need: n.caught });
  });
  /** battle {cmd: "tool", item} -- a trap or a net on your next turn ·  toolplan {trapOpen, netAbove, trap, net} -- the hunt plan's. */
  function hunterAct(s, action, opts, now) {
    if (action === "battle" && opts.cmd === "tool") {
      var bb = s.player.battle;
      if (!bb) return no(s, "Traps and nets are for a fight -- your hunt plan lays them on its own.");
      var why = toolWhyNot(s, s.player, bb, opts.item);
      if (why) return no(s, why);
      bb.toolNext = { item: opts.item };
      var T = ITEMS[opts.item].hunterTool, verb = T.kind === "trap" ? "lay" : "throw";
      if (bb.manual) { var mr = manualRound(s, bb, now); if (mr && mr.ok) mr.msg = "You " + verb + " " + aOr(ITEMS[opts.item].name.toLowerCase()) + "." + (mr.msg ? " " + mr.msg : ""); return mr; }
      return { ok: true, msg: "Next turn: you " + verb + " " + aOr(ITEMS[opts.item].name.toLowerCase()) + ".", state: s };
    }
    if (action !== "toolplan") return null;
    var cb = s.player.combat = s.player.combat || {};
    if (!canUseTools(s.player)) return no(s, "Only a Hunter sets traps and throws nets.");
    var bits = [];
    if (opts.toolsOn === "all" || opts.toolsOn === "tough") { cb.toolsOn = opts.toolsOn; bits.push(opts.toolsOn === "all" ? "on every creature" : "on dangerous creatures only"); }
    if (typeof opts.trapOpen === "boolean") { cb.trapOpen = opts.trapOpen; bits.push(opts.trapOpen ? "you'll lay a trap as each fight opens" : "no traps on their own"); }
    if (typeof opts.netAbove === "number") {
      if (NET_PLAN.above.indexOf(opts.netAbove) < 0) return no(s, "Pick one of the lines.");
      cb.netAbove = opts.netAbove; bits.push(opts.netAbove ? "you'll throw a net when a creature's above " + Math.round(opts.netAbove * 100) + "% health" : "no nets on their own");
    }
    ["trap", "net"].forEach(function (k) {
      if (typeof opts[k] !== "string") return;
      if (opts[k] && !(isTool(opts[k]) && ITEMS[opts[k]].hunterTool.kind === k)) return;
      cb[k] = opts[k]; bits.push(opts[k] ? "your " + k + ": " + ITEMS[opts[k]].name.toLowerCase() : "your best " + k);
    });
    if (!bits.length) return no(s, "Nothing to change.");
    return { ok: true, msg: "Hunt plan: " + bits.join("; ") + ".", state: s };
  }
  // ---- living off the land (Cam, PT3, 2026-10-15): leaf litter from the twiggy woods; a Hunter with a knife whittles
  //      twigs and logs into arrow shafts, and a shaft and some leaf litter into an improvised arrow -- from the bag ----
  var LAND = CONTENT("LIVING_OFF_THE_LAND");
  Object.keys(LAND.items).forEach(function (k) { ITEMS[k] = LAND.items[k]; });
  Object.keys(LAND.litter).forEach(function (id) {
    var sp = SKILLS.lumbering.spots.filter(function (x) { return x.id === id; })[0];
    if (sp && !sp.loot.some(function (l) { return l[0] === "leaflitter"; })) sp.loot.push(["leaflitter", LAND.litter[id]]);
  });
  /** A hunting knife in your bag or your hands. */
  function hasKnife(s, pl) {
    var g = pl.gear || {}, k = function (id) { return !!(ITEMS[id] && ITEMS[id].gear && ITEMS[id].gear.knife); };
    return k(g.weapon) || k(g.offhand) || Object.keys(s.bag || {}).some(function (id) { return s.bag[id] > 0 && k(id); });
  }
  /** Why you can't whittle or fletch in the bag ("" if you can). */
  function landWhyNot(s, pl) {
    if (pl.cls !== "hunter") return "Only a Hunter knows how to make arrows from what the woods give.";
    if (!hasKnife(s, pl)) return "You need a hunting knife (smithed at the anvil).";
    return "";
  }
  /** whittle {item}: twigs or a log into arrow shafts -- as many as you have (up to LAND.most shafts) ·
   *  improvise {}: shafts and leaf litter into improvised arrows · carve {}: bones into bone arrowheads ·
   *  bonearrows {}: a shaft, a bone arrowhead and a feather into a bone arrow. */
  function landAct(s, action, opts, now) {
    if (action === "carve" || action === "bonearrows") return boneAct(s, action, now);
    if (action !== "whittle" && action !== "improvise") return null;
    var pl = s.player, why = landWhyNot(s, pl);
    if (why) return no(s, why);
    var bag = s.bag || {}, n, made;
    if (action === "whittle") {
      var per = LAND.whittle[opts.item];
      if (!per) return no(s, "That won't make arrow shafts -- twigs, birch or oak will.");
      if (!(bag[opts.item] > 0)) return no(s, "There's no " + ITEMS[opts.item].name.toLowerCase() + " in the bag.");
      n = Math.min(bag[opts.item], Math.floor(Math.min(LAND.most, roomFor(s, "arrowshaft") ? stackRoom(s, "arrowshaft") : 0) / per));
      if (n < 1) return no(s, "No room in the bag for arrow shafts.");
      take(s, opts.item, n); made = n * per;
      give(s, "arrowshaft", made);
      addXp(s, pl, "fletching", Math.round(made * LAND.shaftXp[opts.item] * 10) / 10, now);
      return yes(s, now, "You whittled " + n + " " + ITEMS[opts.item].name.toLowerCase() + " into " + made + " arrow shaft" + (made === 1 ? "" : "s") + ".");
    }
    n = Math.min(bag.arrowshaft || 0, bag.leaflitter || 0, LAND.most, roomFor(s, "improvisedarrow") ? stackRoom(s, "improvisedarrow") : 0);
    if (n < 1 && bag.arrowshaft && bag.leaflitter) return no(s, "No room in the bag for arrows.");
    if (n < 1) return no(s, "Improvised arrows take an arrow shaft and some leaf litter each" + (bag.arrowshaft ? " -- no leaf litter (it falls in the twiggy woods)." : " -- whittle some twigs first."));
    take(s, "arrowshaft", n); take(s, "leaflitter", n);
    give(s, "improvisedarrow", n);
    addXp(s, pl, "fletching", Math.round(n * LAND.xp.arrow * 10) / 10, now);
    return yes(s, now, "You made " + n + " improvised arrow" + (n === 1 ? "" : "s") + ": a shaft, and leaf litter for the flights.");
  }
  /** Bones into arrowheads, and bone arrows (Cam, Q3: "bone arrowheads" -- early arrows with a head, no smithing). */
  function boneAct(s, action, now) {
    var pl = s.player, why = landWhyNot(s, pl), bag = s.bag || {}, n;
    if (why) return no(s, why);
    if (action === "carve") {
      if (!(bag.bones > 0)) return no(s, "There are no bones in the bag -- every creature leaves some.");
      n = Math.min(bag.bones, Math.floor(Math.min(LAND.most, roomFor(s, "bonearrowheads") ? stackRoom(s, "bonearrowheads") : 0) / LAND.carve));
      if (n < 1) return no(s, "No room in the bag for arrowheads.");
      take(s, "bones", n); give(s, "bonearrowheads", n * LAND.carve);
      addXp(s, pl, "fletching", Math.round(n * LAND.carve * LAND.xp.head * 10) / 10, now);
      return yes(s, now, "You carved " + n + " bone" + (n === 1 ? "" : "s") + " into " + n * LAND.carve + " bone arrowheads.");
    }
    n = Math.min(bag.arrowshaft || 0, bag.bonearrowheads || 0, bag.feather || 0, LAND.most, roomFor(s, "bonearrow") ? stackRoom(s, "bonearrow") : 0);
    if (n < 1) return no(s, "A bone arrow takes an arrow shaft, a bone arrowhead and a feather" + ["arrowshaft", "bonearrowheads", "feather"].filter(function (k) { return !(bag[k] > 0); }).map(function (k, i) { return (i ? ", " : " -- no ") + ITEMS[k].name.toLowerCase(); }).join("") + ".");
    take(s, "arrowshaft", n); take(s, "bonearrowheads", n); take(s, "feather", n);
    give(s, "bonearrow", n);
    addXp(s, pl, "fletching", Math.round(n * LAND.xp.bonearrow * 10) / 10, now);
    return yes(s, now, "You made " + n + " bone arrow" + (n === 1 ? "" : "s") + ".");
  }
  /** A Hunter's kill: birds plucked for feathers, hides and meat dressed for a little more (Cam, Q3). */
  function hunterSpoils(s, pl, j, mon, at) {
    var dress = pl.cls === "hunter" ? LAND.dressChance : talentSum(pl).dressChance || 0;   // Field dressing, a technique (Part 9)
    if (pl !== s.player || !dress) return;
    var id = Object.keys(MONSTERS).filter(function (k) { return MONSTERS[k] === mon; })[0], bird = LAND.birds[id];
    var add = function (k, n) { var got = give(s, k, n); if (got) j.items[k] = (j.items[k] || 0) + got; };
    if (bird && pl.cls === "hunter") add("feather", bird[0] + Math.floor(rnd(j) * (bird[1] - bird[0] + 1)));
    (mon.drops || []).forEach(function (d) { if (LAND.dress.indexOf(d[0]) >= 0 && (j.items[d[0]] || 0) > 0 && rnd(j) < dress) add(d[0], 1); });
  }
