  // ---- specials by weapon and level, a catalogue, and your own side bar (V18, 2026-10-20) ------------------------------------
  //      Cam: "there needs to be specific equipment attacks for the bar that fills during combat ... i want the hunting knife to have
  //      its own skills as well that can be used like double slash, deep stab etc ... different specials which get unlocked as you
  //      level the class ... the skills that you want to appear on the combat side bar screen can be adjusted from a catalogue in
  //      the player screen under combat." Carried 12-0 (all answers as recommended):
  //   - CLASS specials unlock by class level (minLevel); each class gets more (SPECIALS.classNew);
  //   - WEAPON specials belong to a kind of weapon (weaponFamily), unlock with the skill it trains, and work for anyone holding one;
  //   - SIGNATURE specials: one for each boss weapon, with that weapon in hand;
  //   - one bar pays for all; up to SPECIALS.max on the Kit's side bar (pl.combat.loadout), the ones that don't suit the weapon in
  //     hand hidden there (Q5). specFits judges a weapon special by the weapon, not the class's style.
  var SPECIALS = CONTENT("SPECIALS");
  Object.keys(SPECIALS.classNew).forEach(function (c) { if (CLASSES[c]) Object.keys(SPECIALS.classNew[c]).forEach(function (k) { CLASSES[c].specials[k] = SPECIALS.classNew[c][k]; }); });
  /** A weapon's kind, for its specials: "knife", "sword", "bow" ... ("" for none). */
  function weaponFamily(id) {
    var g = ITEMS[id] && ITEMS[id].gear;
    if (!g || g.slot !== "weapon") return "";
    if (g.knife) return "knife";
    if (g.dagger) return "dagger";
    if (g.wand) return "wand";
    if (g.battle) return "battlestaff";
    if (g.style === "magic") return "staff";
    if (g.slow) return "maul";
    if (/longsword$/.test(id)) return "longsword";
    if (/sword$/.test(id)) return "sword";
    if (/mace$/.test(id)) return "mace";
    if (/crossbow$/.test(id)) return "crossbow";
    if (/bow$/.test(id)) return "bow";
    return "";
  }
  /** Every special you could ever have: your class's, every weapon kind's, every signature weapon's -- by id. */
  function specTable(pl) {
    var t = {}, c = pl && pl.cls && CLASSES[pl.cls];
    if (c) Object.keys(c.specials).forEach(function (k) { t[k] = c.specials[k]; });
    Object.keys(SPECIALS.weapon).forEach(function (k) { t[k] = SPECIALS.weapon[k]; });
    Object.keys(SPECIALS.signature).forEach(function (k) { t[k] = SPECIALS.signature[k]; });
    return t;
  }
  function specOf(pl, id) { return id ? specTable(pl)[id] || null : null; }
  /** Does this special go with the weapon in your hand (a weapon or signature special), or your style (a class special)? */
  function specFitsWeapon(sp, wid) { return sp.item ? wid === sp.item : weaponFamily(wid) === sp.family; }
  /** Not yet: the level it waits for ("" when it's yours). */
  function specUnlockWhy(pl, sp) {
    if (!sp) return "";
    if (sp.unlock) {
      var k = Object.keys(sp.unlock).filter(function (s) { return levelOf((pl.skills || {})[s] || 0) < sp.unlock[s]; })[0];
      return k ? sp.name + " comes at " + SKILLS[k].name + " " + sp.unlock[k] + "." : "";
    }
    return "";
  }
  /** Is it yours to put on the bar (unlocked; a class special of your class)? */
  function specKnown(pl, id) {
    var sp = specOf(pl, id);
    return !!sp && !specialLock(pl, sp) && !specUnlockWhy(pl, sp);
  }
  /** What's on your side bar: your choice, or (until you choose) your unlocked class specials and the weapon in hand's. */
  function specLoadout(pl) {
    var cb = pl.combat || {}, max = SPECIALS.max;
    if (Array.isArray(cb.loadout)) return cb.loadout.filter(function (id) { return specKnown(pl, id); }).slice(0, max);
    var c = pl.cls && CLASSES[pl.cls], out = [], wid = (pl.gear || {}).weapon;
    if (c) Object.keys(c.specials).forEach(function (k) { if (out.length < max && specKnown(pl, k)) out.push(k); });
    Object.keys(SPECIALS.weapon).concat(Object.keys(SPECIALS.signature)).forEach(function (k) { var sp = specOf(pl, k); if (out.length < max && specFitsWeapon(sp, wid) && specKnown(pl, k)) out.push(k); });
    return out;
  }
  /** The catalogue (the Character sheet's Combat tab): every special, with where it comes from and whether it's yours yet. */
  function specCatalogue(pl) {
    var on = specLoadout(pl), c = pl.cls && CLASSES[pl.cls], out = [];
    var row = function (id, sp, kind, icon, from) {
      var lock = specialLock(pl, sp) || specUnlockWhy(pl, sp);
      out.push({ id: id, name: sp.name, about: sp.about || "", cost: specCostOf(pl, sp), kind: kind, icon: icon, from: from, lock: lock,
                 level: sp.minLevel || (sp.unlock ? sp.unlock[Object.keys(sp.unlock)[0]] : 0), on: on.indexOf(id) >= 0 });
    };
    if (c) Object.keys(c.specials).forEach(function (k) { row(k, c.specials[k], "class", (ITEMS[pl.cls + "book"] ? pl.cls + "book" : "tome"), c.name); });
    Object.keys(SPECIALS.weapon).forEach(function (k) { var sp = SPECIALS.weapon[k], f = SPECIALS.families[sp.family]; row(k, sp, "weapon", f.icon, f.name); });
    Object.keys(SPECIALS.signature).forEach(function (k) { var sp = SPECIALS.signature[k]; row(k, sp, "signature", sp.item, ITEMS[sp.item] ? ITEMS[sp.item].name : sp.item); });
    return out;
  }
  /** A special landed: its effect on the creature, and a Skinner's cut remembered for the win. */
  function specLanded(s, pl, b, sp, at) {
    if (sp.fx) addEffect(b, "them", sp.fx.kind, { rounds: sp.fx.rounds, power: sp.fx.power, lvl: classLevel(pl, pl.cls) }, at);
    if (sp.skin) b.skinned = true;
  }
  /** Skinner's cut: the win dresses one more of the creature's hides or meat. */
  function specSkinned(s, pl, j, b, mon) {
    if (!b.skinned) return;
    var d = (mon.drops || []).filter(function (x) { return LAND.dress.indexOf(x[0]) >= 0; })[0];
    if (d && give(s, d[0], 1)) { j.items[d[0]] = (j.items[d[0]] || 0) + 1; }
  }
