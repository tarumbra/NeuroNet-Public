  // ---- Battle Re-work Part 8: the Paladin -- shields, block, shield bash, devotion, two swords, holy water (2026-10-15) --
  //      The plan (note 03): "Paladin: the shield ... a sword ... or a shield: more Defence (it counts as armour); a block
  //      chance (the blow does nothing); Shield bash: an action that hits lightly and stuns ... on a cooldown of 4 rounds
  //      and with diminishing returns like traps. The trick: devotion. A meter that fills when you block or are hit. It
  //      powers: Lay on hands ... Smite ... Aegis."
  //   - a SHIELD lives in the off hand; it isn't a weapon, so the fight counts it as armour, and its block;
  //   - DEVOTION (pl.devotion) works as a Berserker's fury does -- built in fights, kept through the hunt (meterOf);
  //   - SHIELD BASH is the battle command "bash" (your turn), and the hunt plan's "bash when ready" for idle hunts;
  //   - TWO SWORDS: a sword in each hand stabs twice a round, each PALADIN.twin as hard (no shield, no block);
  //   - HOLY WATER blesses your blade (act "bless"): a little more on every hit, much more on the undead.
  var PALADIN_ITEMS = CONTENT("PALADIN_ITEMS");
  Object.keys(PALADIN_ITEMS).forEach(function (k) { if (k !== "//") { ITEMS[k] = PALADIN_ITEMS[k]; if (ITEMS[k].gear) WEAR[k] = copy(ITEMS[k].gear.req); } });
  var PALADIN_RECIPES = CONTENT("PALADIN_RECIPES");
  ["crafting", "anvil", "apothecary"].forEach(function (w) { PALADIN_RECIPES[w].forEach(function (r) { WORKSHOPS[w].recipes.push(r); }); });
  var PALADIN = CONTENT("PALADIN");
  CLASSES.paladin = CONTENT("PALADIN_CLASS");

  function isShield(id) { return !!(ITEMS[id] && ITEMS[id].gear && ITEMS[id].gear.shield); }
  function isSword(id) { return !!ITEMS[id] && /sword$/.test(id) && isWeapon(id); }
  /** Your shield, if one's in your off hand (and you could wear it). */
  function shieldOf(s, pl) { var id = (pl.gear || {}).offhand; return isShield(id) && !cantWear(s, id) && (canUseClass(pl, ITEMS[id].gear.cls) || bucklerOk(pl, id)) ? id : ""; }
  /** Shield training (a technique, Part 9): any class carries the wooden buckler. */
  function bucklerOk(pl, id) { return id === "woodenbuckler" && !!talentSum(pl).bucklerUse; }
  function isUndead(monId) { return PALADIN.undead.indexOf(monId) >= 0; }
  /** The end of a round: devotion from the blows you blocked and the ones that hit you. */
  function devotionAfterRound(pl, b, blocked, taken) {
    if (meterOf(pl) !== "devotion") return;
    var tl = (b.me && b.me.tal) || {};
    var g = (PALADIN.perRound + PALADIN.perBlock * blocked + PALADIN.take * taken / maxHp(pl)) * (1 + (tl.devGain || 0));
    pl.devotion = Math.min(PALADIN.max, Math.round(((pl.devotion || 0) + g) * 10) / 10);
  }
  /** Why a shield bash can't go now ("" if it can). */
  function bashWhyNot(s, pl, b) {
    if (pl.cls !== "paladin") return "Only a Paladin bashes with a shield (the others learn shield work on a class switch, later).";
    if (!shieldOf(s, pl)) return "You need a shield in your off hand.";
    if (b && b.bashCd > 0) return "Your shield arm needs " + b.bashCd + " more round" + (b.bashCd === 1 ? "" : "s") + ".";
    return "";
  }
  /** Your turn, with the shield: a light blow that stuns (diminishing returns, a boss's half), then a cooldown. */
  function useBash(s, pl, b, at, log) {
    b.bashNext = false;
    if (bashWhyNot(s, pl, b)) return false;
    var tl = (b.me && b.me.tal) || {}, sh = ITEMS[shieldOf(s, pl)], mon = MONSTERS[b.mon];
    var d = Math.max(1, PALADIN.bash[0] + Math.floor(rnd(b) * (PALADIN.bash[1] - PALADIN.bash[0] + 1)) + Math.floor((sh.gear.def || 0) / PALADIN.bashDef) + (tl.bashDmg || 0));
    d = Math.max(1, Math.round(d * mult(mon.weak, "crush") * mult(mon.resist, "crush")));
    b.mhp -= d;
    log({ by: "you", hit: d, w: sh.name, wp: true, bash: true });
    if (b.mhp > 0) addEffect(b, "them", "stunned", { rounds: 1 + (tl.bashStun || 0), lvl: classLevel(pl, pl.cls) }, at);
    b.bashCd = PALADIN.bashCooldown - (tl.bashCd || 0);
    return true;
  }
  /** bless {item}: holy water on your blade. */
  function blessAct(s, opts, now) {
    var it = ITEMS[opts.item], pl = s.player;
    if (!it || !it.bless) return no(s, "That won't bless a blade.");
    if (pl.cls !== "paladin") return no(s, "Only a Paladin can bless a blade.");
    if (!has(s, opts.item) && !(s.dev && s.dev.infinite)) return no(s, "There's no " + it.name.toLowerCase() + " in the bag.");
    if (!(s.dev && s.dev.infinite)) take(s, opts.item, 1);
    pl.bless = { id: opts.item, left: it.bless.hits };
    return yes(s, now, "Your blade is blessed for " + it.bless.hits + " hits: +" + it.bless.maxHit + " max hit, and the undead fear it.");
  }
  /** A landed hit spends a blessing's charge. */
  function blessSpend(s, pl, at) {
    if (!pl.bless || pl !== s.player) return;
    if (--pl.bless.left <= 0) { note(s, at, "The blessing on your blade has faded."); pl.bless = null; }
  }
  /** A blessed blade's damage x on this creature. */
  function blessMult(pl, b) { var bl = pl.bless && ITEMS[pl.bless.id] && ITEMS[pl.bless.id].bless; return bl && isUndead(b.mon) ? bl.undead : 1; }
  /** The hunt plan: a shield bash whenever it's ready, on any creature (PT8, Cam: "Doesn't auto work" -- it waited for
   *  dangerous ones; a bash hits too, so it's never a wasted turn). Not on one already held. */
  function planBashFor(s, pl, b) {
    var cb = pl.combat || {};
    if (b.manual || b.bashNext || b.toolNext || !cb.bashAuto || pl !== s.player || bashWhyNot(s, pl, b)) return;
    if (fxHeld(b, "them")) return;
    b.bashNext = true;
  }
  /** battle {cmd: "bash"} -- your next turn, a shield bash · bashplan {on} -- the hunt plan's · bless {item}. */
  function paladinAct(s, action, opts, now) {
    if (action === "bless") return blessAct(s, opts, now);
    if (action === "bashplan") {
      if (s.player.cls !== "paladin") return no(s, "Only a Paladin bashes with a shield.");
      s.player.combat = s.player.combat || {}; s.player.combat.bashAuto = !!opts.on;
      return { ok: true, msg: opts.on ? "Hunt plan: a shield bash whenever it's ready." : "Hunt plan: no shield bashes on their own.", state: s };
    }
    if (action !== "battle" || opts.cmd !== "bash") return null;
    var bb = s.player.battle;
    if (!bb) return no(s, "A shield bash is for a fight.");
    var why = bashWhyNot(s, s.player, bb);
    if (why) return no(s, why);
    bb.bashNext = true;
    if (bb.manual) { var mr = manualRound(s, bb, now); if (mr && mr.ok) mr.msg = "You bash with your shield." + (mr.msg ? " " + mr.msg : ""); return mr; }
    return { ok: true, msg: "Next turn: a shield bash.", state: s };
  }
