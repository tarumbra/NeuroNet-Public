  // ---- Battle Re-work Part 7: the Thief -- daggers, throwing knives, poisons (2026-10-15) ----------------------------
  //      The plan (note 03): "Thief: the poisoner (ranged or dual daggers) ... The trick: poison. A coated weapon has a
  //      chance per hit to poison the target ... Poison ignores armour but not immunity." Cam (Q4): "bow or dual daggers".
  //   - a class can fight more than one way now (CLASSES[c].styles; clsFits) -- the Thief's daggers train Attack, a bow
  //     Ranged; a special may need one of them (sp.style);
  //   - DUAL DAGGERS: a dagger in your hand and another in your off hand stab twice a round, each THIEF.dual as hard;
  //   - COATING (act "coat"): a poison or venom from the bag coats your weapon for so many hits (pl.coat {id, left});
  //     each hit that lands may poison (stacking with Virulence), stun (paralytic) or weaken (weakening);
  //   - THROWING KNIVES are the Thief's Tools (the Hunter's traps' machinery, kind "throw"): a throw is your turn, it
  //     hits, it carries your poison, and half come back after a win.
  var THIEF_ITEMS = CONTENT("THIEF_ITEMS");
  Object.keys(THIEF_ITEMS).forEach(function (k) {
    if (k === "//") return;
    ITEMS[k] = THIEF_ITEMS[k];
    if (ITEMS[k].gear) WEAR[k] = copy(ITEMS[k].gear.req);
    if (ITEMS[k].hunterTool) TOOL_IDS.push(k);
  });
  var THIEF_RECIPES = CONTENT("THIEF_RECIPES");
  ["anvil", "apothecary"].forEach(function (w) { THIEF_RECIPES[w].forEach(function (r) { WORKSHOPS[w].recipes.push(r); }); });
  var THIEF_TYPES = CONTENT("THIEF_TYPES");
  Object.keys(THIEF_TYPES).forEach(function (k) { if (k !== "//") WEAPONS[k] = THIEF_TYPES[k]; });
  var VENOM_DROPS = CONTENT("VENOM_DROPS");
  Object.keys(VENOM_DROPS).forEach(function (m) {
    if (m !== "//" && MONSTERS[m] && !MONSTERS[m].drops.some(function (d) { return d[0] === "venomsac"; })) MONSTERS[m].drops.push(["venomsac", 1, 1, VENOM_DROPS[m]]);
  });
  var THIEF = CONTENT("THIEF");
  CLASSES.thief = CONTENT("THIEF_CLASS");

  /** A class's name for more than one ("Thieves", "Hunters"). */
  function clsPlural(c) { var n = CLASSES[c] ? CLASSES[c].name : c; return /f$/.test(n) ? n.slice(0, -1) + "ves" : n + "s"; }
  /** This class fights this way (a Thief: daggers or a bow). */
  function clsFits(cls, style) { return !!cls && (cls.styles || [cls.style]).indexOf(style) >= 0; }
  /** This special, for this class, fought this way. */
  function specFits(cls, sp, style, wid) {
    if (sp && (sp.family || sp.item)) return specFitsWeapon(sp, wid);      // a weapon's or a signature special: the weapon in hand (V18)
    return clsFits(cls, style) && (!sp || !sp.style || sp.style === style);
  }
  function isDagger(id) { return !!(ITEMS[id] && ITEMS[id].gear && ITEMS[id].gear.dagger); }
  function canCoat(pl) { return !!pl && (THIEF.classes.indexOf(pl.cls) >= 0 || !!talentSum(pl).coatUse); }   // (Poison-crafting: a technique, Part 9)
  /** coat {item}: a poison or venom on your weapon (a Thief's, for now). */
  function coatAct(s, opts, now) {
    var it = ITEMS[opts.item], pl = s.player;
    if (!it || !it.coat) return no(s, "That isn't a poison or a venom.");
    if (!canCoat(pl)) return no(s, "Only a Thief knows how to coat a blade -- or another class with Poison-crafting in a technique slot.");
    if (!has(s, opts.item) && !(s.dev && s.dev.infinite)) return no(s, "There's no " + it.name.toLowerCase() + " in the bag.");
    if (!(s.dev && s.dev.infinite)) take(s, opts.item, 1);
    var hits = Math.round(it.coat.hits * (1 + (talentSum(pl).coatLast || 0)));
    var was = pl.coat && ITEMS[pl.coat.id] ? ITEMS[pl.coat.id].name.toLowerCase() : "";
    pl.coat = { id: opts.item, left: hits };
    return yes(s, now, "You coat your weapons with " + it.name.toLowerCase() + ": " + hits + " hits" + (was && pl.coat.id !== opts.item ? " (it replaces the " + was + ")" : "") + ".");
  }
  /** A hit landed: your coating's poison or venom, now and then (Envenom: for sure); Numbing, Thousand cuts. */
  function thiefOnHit(s, pl, b, at, forced) {
    if (pl !== s.player || b.mhp <= 0) return;
    var tl = (b.me && b.me.tal) || {}, c = pl.coat && ITEMS[pl.coat.id] && ITEMS[pl.coat.id].coat, lvl = classLevel(pl, pl.cls);
    if (!c && forced && canCoat(pl)) c = ITEMS.weakpoison.coat;                   // Envenom with nothing on: a weak poison
    if (c && canCoat(pl)) {
      if (pl.coat && pl.coat.left > 0 && --pl.coat.left <= 0) { note(s, at, "The " + ITEMS[pl.coat.id].name.toLowerCase() + " on your blade has worn off."); pl.coat = null; }
      var own = THIEF.classes.indexOf(pl.cls) >= 0 ? 1 : TECHNIQUES.offClass;   // another class's coating: 60% as often
      if (c.poison && (forced || rnd(b) < (THIEF.poisonChance + (tl.poisonChance || 0)) * own))
        addEffect(b, "them", "poisoned", { rounds: c.poison[1] + (tl.poisonRounds || 0), power: Math.round((c.poison[0] + (tl.poisonPow || 0)) * (1 + (tl.poisonMult || 0))),
                                           stack: THIEF.poisonStack + (tl.poisonStack || 0) }, at);
      if (c.stun && rnd(b) < c.stun) addEffect(b, "them", "stunned", { rounds: 1, lvl: lvl }, at);
      if (c.weaken && (forced || rnd(b) < THIEF.weakenChance)) addEffect(b, "them", "weakened", { rounds: c.weaken }, at);
    }
    var poisoned = ((b.fx && b.fx.them) || []).some(function (e) { return e.kind === "poisoned" && e.rounds > 0; });
    if (tl.poisonStun && poisoned && rnd(b) < tl.poisonStun) addEffect(b, "them", "stunned", { rounds: 1, lvl: lvl }, at);   // Numbing
    if (tl.bleedChance && rnd(b) < tl.bleedChance) addEffect(b, "them", "bleeding", { rounds: 3, power: 2 }, at);        // Thousand cuts
  }
  /** Damage x on a poisoned creature (Rot). */
  function poisonedMult(b) {
    var tl = (b.me && b.me.tal) || {};
    return tl.poisonedDmg && ((b.fx && b.fx.them) || []).some(function (e) { return e.kind === "poisoned" && e.rounds > 0; }) ? 1 + tl.poisonedDmg : 1;
  }
  /** Dual daggers: your main and your off hand both daggers (and the off-hand one fit to use). */
  function dualOf(s, pl, pickFrom) {
    var g = pl.gear || {};
    if (pickFrom !== "main" || weaponWhyNot(s, pl, g.offhand || "")) return 0;
    if (pl.cls === "paladin" && isSword(g.weapon) && isSword(g.offhand)) return PALADIN.twin + (talentSum(pl).twinDmg || 0);   // two swords (Part 8)
    if (!isDagger(g.weapon) || !isDagger(g.offhand)) return 0;
    return THIEF.dual + (talentSum(pl).dualDmg || 0);
  }
