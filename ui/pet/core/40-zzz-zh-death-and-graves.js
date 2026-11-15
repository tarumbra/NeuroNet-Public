  // ---- V16: death with a sting (2026-10-19) --------------------------------------------------------------------------
  //      Fall in Adventure and you wake at home holding the 3 most valuable things you carried; the rest -- coins too -- is
  //      in a gravestone where you fell, for half an hour (Hardcore: everything, a quarter of an hour). Go back and open it:
  //      it costs half of what's inside. After that it crumbles. Nobody eats for you any more: food goes on the quick-use
  //      slots (keys 1-4), and an idle hunt never kills you -- it walks you home below your health line. Hardcore and Hell
  //      give more xp and more rare drops, for the risk.
  var DEATH = CONTENT("DEATH");
  function modeBonus(s, k) { if (!(s && MODES[s.mode])) return 1; var b = DEATH.bonus[s.mode] || {}; return b[k] || 1; }   // (a mode you chose: an old save without one plays as before)
  /** Things a death never takes: keepsakes, keys, eggs, tomes, glyphs (what the stash won't take either). */
  function deathKeeps(id) { var it = ITEMS[id] || {}; return !!(it.bound || recycleKeeps(id)); }
  function graveWorth(g) { return (g.coins || 0) + Object.keys(g.items || {}).reduce(function (a, k) { return a + priceOf(k) * g.items[k]; }, 0); }
  function graveFee(g) { return Math.ceil(graveWorth(g) * DEATH.fee); }
  /** The fall (Adventure and Hardcore): who keeps what, the gravestone, the diary. */
  function graveFall(s, pl, mon, ground, at) {
    var mode = modeOf(s), inf = s.dev && s.dev.infinite, keepN = DEATH.keep[mode] || 0;
    var units = [];                                                    // every single thing you carry, by value (worn and bag)
    Object.keys(s.bag || {}).forEach(function (k) { if (s.bag[k] > 0 && ITEMS[k] && !deathKeeps(k)) for (var i = 0; i < Math.min(s.bag[k], 50); i++) units.push(k); });
    units.sort(function (a, b) { return priceOf(b) - priceOf(a); });
    var kept = units.slice(0, keepN), keptCount = {};
    kept.forEach(function (k) { keptCount[k] = (keptCount[k] || 0) + 1; });
    var grave = { ground: ground.id || Object.keys(HUNTS).filter(function (k) { return HUNTS[k] === ground; })[0] || "", where: ground.name, isle: islandOf(s),
                  at: at, until: at + (DEATH.grave[mode] || 30) * MIN, items: {}, coins: s.coins || 0, by: mon.name };
    if (!inf) {
      Object.keys(s.bag || {}).forEach(function (k) {
        if (!(s.bag[k] > 0) || !ITEMS[k] || deathKeeps(k)) return;
        var lose = s.bag[k] - (keptCount[k] || 0);
        if (lose > 0) { grave.items[k] = lose; s.bag[k] -= lose; if (s.bag[k] <= 0) delete s.bag[k]; }
      });
      s.coins = 0;
      ["gear", "tools"].forEach(function (part) { Object.keys(pl[part] || {}).forEach(function (sl) { if (!has(s, pl[part][sl])) delete pl[part][sl]; }); });
      pl.brews = {};
    }
    var any = grave.coins > 0 || Object.keys(grave.items).length;
    if (s.grave && s.grave.until > at) note(s, at, "Your older gravestone at the " + s.grave.where + " crumbled -- only one grave stands at a time.");
    s.grave = any ? grave : null;
    pl.job = null; pl.battle = null; pl.dead = null;
    pl.hp = Math.max(1, Math.round(maxHp(pl) / 2)); pl.at = at;
    var keptNames = Object.keys(keptCount).map(function (k) { return (keptCount[k] > 1 ? keptCount[k] + " × " : "") + ITEMS[k].name.toLowerCase(); });
    s.lastFall = { at: at, by: mon.name, where: ground.name, kept: keptCount, grave: any ? { until: grave.until, worth: Math.round(graveWorth(grave)), fee: graveFee(grave) } : null,
                   lost: { items: Object.keys(grave.items).reduce(function (a, k) { return a + grave.items[k]; }, 0), kinds: Object.keys(grave.items).length, coins: grave.coins, gear: 0, tools: 0 } };
    note(s, at, "You fell to " + aOr(mon.name) + " at the " + ground.name + " and woke by the fire" + (keptNames.length ? ", still holding " + keptNames.join(", ") : " with nothing") + ". " +
         (any ? "Everything else is in a gravestone there for " + (DEATH.grave[mode] || 30) + " minutes -- go back and open it, for half of what's inside." : ""));
  }
  /** grave {op: "open"} -- you're on its island, not at sea; it costs DEATH.fee of what's in it. */
  function graveAct(s, action, opts, now) {
    if (action !== "grave") return null;
    var g = s.grave, pl = s.player;
    if (!g || g.until <= now) return no(s, "There's no gravestone of yours standing.");
    if (pl.voyage) return no(s, "You're at sea.");
    if ((g.isle || "") !== islandOf(s)) return no(s, "Your gravestone is on " + (g.isle ? ISLANDS[g.isle].the : "the main island") + " -- go there first.");
    if (pl.battle && pl.battle.kind === "boss") return no(s, "Not in the middle of a fight.");
    var fee = graveFee(g), fromGrave = Math.min(g.coins || 0, fee), rest = fee - fromGrave;
    if (rest > (s.coins || 0)) return no(s, "Opening it costs " + fee.toLocaleString() + " coins (half of what's inside) -- the grave's own " + (g.coins || 0).toLocaleString() + " and " + rest.toLocaleString() + " of yours; you have " + (s.coins || 0).toLocaleString() + ".");
    var back = [], left = {};
    Object.keys(g.items).forEach(function (k) { var got = give(s, k, g.items[k]); if (got < g.items[k]) left[k] = g.items[k] - got; if (got) back.push(got + " × " + ITEMS[k].name.toLowerCase()); });
    s.coins = (s.coins || 0) - rest + ((g.coins || 0) - fromGrave);
    s.grave = Object.keys(left).length ? Object.assign(g, { items: left, coins: 0 }) : null;
    return yes(s, now, "You opened your gravestone for " + fee.toLocaleString() + " coins: " + (back.length ? back.join(", ") : "only coins") + ((g.coins || 0) - fromGrave > 0 ? " and " + ((g.coins || 0) - fromGrave).toLocaleString() + " coins" : "") + " back." +
               (Object.keys(left).length ? " Your bag is full -- the rest waits in the grave." : ""));
  }
  /** Time passing: a gravestone crumbles at its hour. */
  function graveTick(s, now) {
    if (s.grave && s.grave.until <= now) { note(s, s.grave.until, "Your gravestone at the " + s.grave.where + " crumbled -- what was in it is gone."); s.grave = null; }
  }
  function graveView(s, now) {
    var g = s.grave; if (!g || g.until <= now) return null;
    return { where: g.where, ground: g.ground, isle: g.isle, leftMs: g.until - now, worth: Math.round(graveWorth(g)), fee: graveFee(g), coins: g.coins || 0,
             items: Object.keys(g.items).map(function (k) { return { id: k, name: ITEMS[k].name, n: g.items[k] }; }).sort(function (a, b) { return priceOf(b.id) - priceOf(a.id); }),
             here: (g.isle || "") === islandOf(s) && !(s.player && s.player.voyage) };
  }
  /** What you'd keep if you fell now (for the boss's "before you go in" line): [{id, name}]. */
  function wouldKeep(s) {
    var n = DEATH.keep[modeOf(s)] || 0, units = [];
    Object.keys(s.bag || {}).forEach(function (k) { if (s.bag[k] > 0 && ITEMS[k] && !deathKeeps(k)) for (var i = 0; i < Math.min(s.bag[k], n); i++) units.push(k); });
    return units.sort(function (a, b) { return priceOf(b) - priceOf(a); }).slice(0, n).map(function (k) { return { id: k, name: ITEMS[k].name }; });
  }
  // ---- the quick-use slots: food and potions by your own hand (no one eats for you now) ----
  /** quick {op: "set", i, item} | {op: "use", i} -- four slots; using one eats or drinks it now. */
  function quickAct(s, action, opts, now) {
    if (action !== "quick") return null;
    var pl = s.player; pl.quick = pl.quick || [];
    var i = opts.i | 0; if (i < 0 || i >= DEATH.quick) return no(s, "There are " + DEATH.quick + " quick slots.");
    if (opts.op === "set") {
      if (opts.item && !quickFits(opts.item)) return no(s, "Food, draughts, traps, nets and throwing knives go on a quick slot.");   // (N22: not just food)
      pl.quick[i] = opts.item || null;
      return yes(s, now, opts.item ? ITEMS[opts.item].name + " is on quick slot " + (i + 1) + "." : "Quick slot " + (i + 1) + " is empty.");
    }
    var id = pl.quick[i], f = ITEMS[id];
    if (!f) return no(s, "Quick slot " + (i + 1) + " is empty -- put a food on it from your bag.");
    if (!has(s, id)) return no(s, "You're out of " + f.name.toLowerCase() + ".");
    if (f.hunterTool) return hunterAct(s, "battle", { cmd: "tool", item: id }, now);   // a trap, a net, a knife: your next turn (N22)
    if (f.brew && !f.heal) {                                                          // a draught: drunk now (and mid-fight, it counts now)
      take(s, id);
      var was0 = (pl.brews || {})[f.brew.kind]; pl.brews = pl.brews || {};
      pl.brews[f.brew.kind] = { id: id, left: f.brew.uses };
      var dr = yes(s, now, "You drank " + aOr(f.name.toLowerCase()) + ": " + brewText(f.brew) + "." + (was0 && was0.id !== id && ITEMS[was0.id] ? " It replaces your " + ITEMS[was0.id].name.toLowerCase() + "." : ""));
      dr.fightGear = "drink";
      return dr;
    }
    if (pl.hp >= maxHp(pl)) return no(s, "You're at full health.");
    take(s, id);
    var before = pl.hp; pl.hp = Math.min(maxHp(pl), pl.hp + f.heal);
    var b = pl.battle; if (b && typeof b.php === "number") b.php = pl.hp;
    return yes(s, now, "You " + (/potion|tonic|draught|brew/i.test(f.name) ? "drank" : "ate") + " " + aOr(f.name.toLowerCase()) + " (+" + Math.round(pl.hp - before) + " health).");
  }
