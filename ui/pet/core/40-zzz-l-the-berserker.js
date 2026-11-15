  // ---- Battle Re-work Part 5: the Berserker -- longswords, mauls, maces, spiked gauntlets, fury, Bloodlust (2026-10-15) --
  //      The plan (note 03): "the heavy hitter ... The trick: fury. A second meter that fills as you take and deal damage
  //      and empties after a fight. Specials use fury rather than energy ... Bloodlust: heal for 20% of the damage you deal
  //      for three rounds. This is the Berserker's only self-heal, and it's earned by fighting, not automatic."
  //   - FURY (pl.fury) builds in fights and lasts the hunt until you spend it -- it fades when you come home (Cam, PT4:
  //     "I would like it to stay persistent on a hunt until used"); like the special bar it can be pressed between fights
  //     for the next fight's first blow. The special bar (pl.spec) is the other classes';
  //   - THE MAUL is two-handed (no off-hand weapon) and slow: a blow every other round (b.n even: the wind-up), each
  //     heavy x the damage, and a big blow may stun;
  //   - SPIKED GAUNTLETS are worn (on your arms, like gloves -- C6, 2026-10-17; they were a "gloves" slot your figure didn't show): with no weapon to hand you hit with them, not bare fists, and they may bleed.
  var BERSERKER_ITEMS = CONTENT("BERSERKER_ITEMS");
  Object.keys(BERSERKER_ITEMS).forEach(function (k) { if (k !== "//") { ITEMS[k] = BERSERKER_ITEMS[k]; WEAR[k] = copy(ITEMS[k].gear.req); } });
  var BERSERKER_RECIPES = CONTENT("BERSERKER_RECIPES");
  BERSERKER_RECIPES.anvil.forEach(function (r) { WORKSHOPS.anvil.recipes.push(r); });
  var BERSERKER_TYPES = CONTENT("BERSERKER_TYPES");
  Object.keys(BERSERKER_TYPES).forEach(function (k) { if (k !== "//") WEAPONS[k] = BERSERKER_TYPES[k]; });
  var FURY = CONTENT("FURY");
  var BLOODLUST = CONTENT("BLOODLUST");
  CLASSES.berserker.specials.bloodlust = { name: BLOODLUST.name, cost: BLOODLUST.cost, dmg: BLOODLUST.dmg, lust: { rounds: BLOODLUST.rounds, heal: BLOODLUST.heal },
                                           minLevel: BLOODLUST.minLevel, about: BLOODLUST.about };

  function usesFury(pl) { return !!pl && FURY.classes.indexOf(pl.cls) >= 0; }
  /** What a special is paid from now: fury in a Berserker's fight, the special bar otherwise. */
  /** The meter a class's specials run on: "fury" (the Berserker), "devotion" (the Paladin, Part 8), else "" (the bar). */
  function meterOf(pl) { return !pl ? "" : usesFury(pl) ? "fury" : pl.cls === "paladin" ? "devotion" : ""; }
  function specMeter(pl, b) { var m = meterOf(pl); return m ? pl[m] || 0 : pl.spec || 0; }
  function specPay(pl, b, n) { var m = meterOf(pl); if (m) pl[m] = Math.max(0, Math.round(((pl[m] || 0) - n) * 10) / 10); else pl.spec = (pl.spec || 0) - n; }
  /** Why this special can't be chosen at all ("" if it can): a class level it waits for (Bloodlust). */
  function specialLock(pl, sp) {
    return sp && sp.minLevel && classLevel(pl, pl.cls) < sp.minLevel ? sp.name + " comes at " + CLASSES[pl.cls].name + " level " + sp.minLevel + "." : "";
  }
  /** The end of a round: fury from what you dealt and took (and a round fought). */
  function furyAfterRound(pl, b, dealt, taken) {
    if (!usesFury(pl)) return;
    var tl = (b.me && b.me.tal) || {}, max = b.mhp0 || MONSTERS[b.mon].hp;
    var g = (FURY.perRound + FURY.deal * dealt / max + FURY.take * taken / maxHp(pl) * (1 + (tl.furyTake || 0))) * (1 + (tl.furyGain || 0));
    var was = pl.fury || 0;
    pl.fury = Math.min(FURY.max, Math.round(((pl.fury || 0) + g) * 10) / 10);
    if (pl.fury >= FURY.max && was < FURY.max) feat(pl, "furyFull");           // for Brakka's quest (Part 9)
  }
  /** Wielding a two-handed weapon: nothing else in your hands. */
  function twoHanded(id) { return !!(ITEMS[id] && ITEMS[id].gear && ITEMS[id].gear.twoHanded); }
  /** Your spiked gauntlets, if you wear a pair (they're what you hit with when there's no weapon). */
  function fistGear(pl) { var id = (pl.gear || {}).arms; return id && ITEMS[id] && ITEMS[id].gear && ITEMS[id].gear.fist ? id : ""; }
  /** Second wind (the Bloodrage branch): once a fight, at a fifth of your health or less, a tenth of it back. */
  function secondWind(pl, b, log) {
    var tl = (b.me && b.me.tal) || {};
    if (!tl.secondWind || b.windUsed || pl.hp <= 0 || pl.hp > maxHp(pl) * 0.2) return;
    b.windUsed = true;
    var h = Math.max(1, Math.round(maxHp(pl) * tl.secondWind));
    pl.hp = Math.min(maxHp(pl), pl.hp + h);
    log({ by: "you", wind: h });
  }
