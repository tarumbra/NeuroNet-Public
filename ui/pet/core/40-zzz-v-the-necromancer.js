  // ---- Battle Re-work Part 13: the Necromancer (2026-10-16) ----------------------------------------------------------------
  //      Cam: "a later game class that derives as a skill tree unlock from the Arcane Class ... bring back dead pets for combat
  //      ... a way we can use fallen pets again." Q8: an Arcane specialisation. Q9: pets lost before can be raised. Q15: the
  //      Archmage's offer can be taken later. Note 07 is the plan.
  //   13a -- THE HOLLOW CRYPT (under the Misty Isle): its dead drop blood essence (blood runes at the Blood altar), its wisps
  //          (at night) the only life essence, and Morvane the Lich keeps the Blood Book (the first win gives it); Sexton Hobb
  //          sells a little life essence, dear, three a day.
  //   13b -- THE OFFER (V8: Sorceress Nyx's, was the Archmage's): beat her and she offers (yes / no / yes later); bring the Blood Book and 120 blood runes and
  //          an Arcane learns Necromancy (pl.necro): the Necromancy branch on the Arcane's tree, its eight spells (each waits
  //          for points in that branch), and RAISING -- at the Necromancer's ground (the graveyard), life essence brings a lost
  //          pet back as a RISEN battle pet (s.beasts, risen: true). In a fight, Raise the fallen brings one in; it strikes each
  //          round and takes some of the creature's blows; only Necromancy and the potion heal it; if it falls it goes back to
  //          the graveyard, keeping its level, dearer to raise next time. It trains at half a battle pet's rate.
  var NECRO = CONTENT("NECRO");
  var NECRO_ITEMS = CONTENT("NECRO_ITEMS");
  Object.keys(NECRO_ITEMS).forEach(function (k) {
    ITEMS[k] = NECRO_ITEMS[k];
    if (ITEMS[k].gear) { WEAR[k] = copy(ITEMS[k].gear.req); WEAPONS[k] = ["crush", "wood"]; }
  });
  var CRYPT_MONSTERS = CONTENT("CRYPT_MONSTERS");
  Object.keys(CRYPT_MONSTERS).forEach(function (k) { MONSTERS[k] = CRYPT_MONSTERS[k]; });
  REGIONS.hollowcrypt = CONTENT("REGIONS.hollowcrypt");
  REGION_ORDER.push("hollowcrypt");
  REGION_LINKS.push(["mistyisle", "hollowcrypt"]);
  HUNTS.hollowcrypt = CONTENT("HUNTS.hollowcrypt");
  HUNT_ORDER.splice(HUNT_ORDER.indexOf("jungle") + 1, 0, "hollowcrypt");               // by level: after the Jungle (40 -- V8, was after the Frostpeak at 46)
  SECRETS.hollowcrypt = CONTENT("SECRETS.hollowcrypt");
  PEOPLE.hollowcrypt = CONTENT("PEOPLE.hollowcrypt");
  WORKSHOPS.cryptmerchant = CONTENT("WORKSHOPS.cryptmerchant");
  AREA_COINS.hollowcrypt = CONTENT("AREA_COINS.hollowcrypt"); BOSS_PURSE.hollowcrypt = CONTENT("BOSS_PURSE.hollowcrypt");
  var NECRO_RECIPES = CONTENT("NECRO_RECIPES");
  Object.keys(NECRO_RECIPES).forEach(function (w) { NECRO_RECIPES[w].forEach(function (r) { WORKSHOPS[w].recipes.push(r); }); });
  // the Blood altar: a rune shrine fed with blood essence, already at the pace of gathering's speed for its level (that step
  // ran before this part): a level-45 shrine's 7.5 s and its xp scaled the same way
  (function () { var lv = 38, old = 25 + lv,                           // (V8: Runecrafting 38, was 45 -- Necromancy is mid game)
    t = Math.round((3 + 5 * (lv - 1) / 49) * 10) / 10;
    SKILLS.runecrafting.spots.push({ id: "bloodshrine", name: "Blood altar", area: "hollowcrypt", level: lv, time: t, oldTime: old, pace: t / old, xp: Math.round((4 + Math.round(lv * 0.9)) * t / old * 100) / 100,
                                     method: "craft", bait: "bloodessence", yield: 2, loot: [["bloodrune", 100]] }); })();
  var CRYPT_STOCK = CONTENT("CRYPT_STOCK");
  ISLE_STOCK.cryptmerchant = Object.keys(CRYPT_STOCK).map(function (k) { return [k, CRYPT_STOCK[k].price]; });   // (his stall's list; the buy is necroAct's)
  var NECRO_SPELLS = CONTENT("NECRO_SPELLS");
  Object.keys(NECRO_SPELLS).forEach(function (k) { SPELLS[k] = NECRO_SPELLS[k]; SPELL_ORDER.push(k); });
  var NECRO_UTIL = { raise: 1, mend: 1, army: 1, rites: 1 };                          // spells that take your turn and deal nothing

  /** Necromancy works for an Arcane who has learnt it. */
  function necroOn(pl) { return !!(pl && pl.necro && pl.necro.taught && pl.cls === "arcane"); }
  function necroBranchSpent(pl) {
    var box = ((pl.classes || {}).arcane) || {}, br = TALENTS.arcane.branches.filter(function (b) { return b.id === "necromancy"; })[0];
    return br ? spentIn(box.talents || {}, br) : 0;
  }
  /** Why a Necromancy spell can't be cast ("" if it can, runes apart) -- spellLock asks. */
  function necroSpellLock(s, sp) {
    var pl = s.player;
    if (!(pl.necro && pl.necro.taught)) return "Necromancy -- Sorceress Nyx teaches it, after you beat her at the mage tower";
    if (pl.cls !== "arcane") return "Necromancy is an Arcane's magic";
    if (necroBranchSpent(pl) < sp.gate) return sp.gate + " points in Necromancy (you have " + necroBranchSpent(pl) + ")";
    return "";
  }

  // ---- the risen -------------------------------------------------------------------------------------------------------
  function risenOf(s) { return beastsOf(s).filter(function (b) { return b.risen; }); }
  function risenSlots(pl) { return Math.max(1, NECRO.slots + Math.round(talentSum(pl).risenSlots || 0)); }
  function risenMax(bst) { return Math.max(1, beastStats(bst).health); }
  function risenHp(bst) { return typeof bst.hp === "number" ? Math.max(0, Math.min(risenMax(bst), bst.hp)) : risenMax(bst); }   // no healing on its own
  /** What raising this grave's pet costs in life essence: its battle level / perLevel, rounded up, x step a time before. */
  function graveLevel(g) {
    if (g.battle || g.risen) return Math.max(1, g.level || 1);
    var O = NECRO.oldGrave;                                                           // a companion or home pet, or an old grave (Q9)
    return Math.max(O.min, Math.min(O.max, Math.round((g.level || 1) / 2) + (O.rarity[g.rarity] || 0)));
  }
  function raiseCost(g) { return Math.ceil(Math.ceil(graveLevel(g) / NECRO.raise.perLevel) * Math.pow(NECRO.raise.step, g.raised || 0)); }
  /** A grave's pet, risen: its kind, looks and battle level; whatever it learnt as a battle pet (its moves) comes too. */
  function toRisen(g, at) {
    var p = g.pet || {}, b = { id: p.id || ("r" + Math.abs(at | 0).toString(36) + (g.species || "x").charAt(0)), name: p.name || (g.name && g.name.indexOf("Your ") !== 0 ? g.name : ""),
      species: g.species, colour: g.colour, born: p.born || g.at, hatchAt: p.hatchAt || g.at, joined: at, xp: XP[Math.min(BEAST_RULES.maxLevel, graveLevel(g))], stat: (g.battle && p.stat) ? copy(p.stat) : {},
      train: "", trainAt: at, fedUntil: 0, restUntil: 0, wins: p.wins || 0, faints: p.faints || 0, risen: true, raised: (g.raised || 0) + 1, hp: null };
    if (g.battle && p.moves) b.moves = p.moves.slice();
    if (p.skin) b.skin = copy(p.skin);
    if (p.gene) b.gene = copy(p.gene);
    return b;
  }
  /** A risen that falls again: back to its grave, keeping its level and how often it has been raised. */
  function risenFalls(s, bst, at, mon) {
    s.beasts.splice(s.beasts.indexOf(bst), 1);
    s.graveyard = s.graveyard || [];
    s.graveyard.unshift({ name: who(bst), kind: kindName(bst), species: bst.species, colour: bst.colour, rarity: rarityOf(bst), level: beastLevel(bst),
                          ageDays: Math.max(0, Math.round((at - (bst.hatchAt || at)) / DAY * 10) / 10), area: "the Hollow Crypt", cause: "fell again, to " + (mon ? mon.name.toLowerCase() : "a creature"),
                          at: at, cleared: 0, gear: [], battle: true, risen: true, raised: bst.raised || 1, pet: copy(bst) });
    if (s.graveyard.length > 200) s.graveyard.length = 200;
    note(s, at, who(bst) + " fell again and went back to rest. You can raise them once more -- it costs a little more each time.");
  }
  /** A risen's fight numbers (the Beast Master's, without his talents) -- its health doesn't come back on its own. */
  function risenInFight(s, pl, bst, at) {
    var p = petInFight(s, pl, bst, at);
    p.hp = risenHp(bst); p.maxHp = risenMax(bst); p.risen = true;
    return p;
  }
  function risenUp(b) { return (b.risen || []).filter(function (p) { return p.hp > 0; }); }
  /** The best risen not in this fight yet, and still standing. */
  function risenToRaise(s, pl, b) {
    var inFight = (b.risen || []).map(function (p) { return p.id; });
    return risenOf(s).filter(function (r) { return inFight.indexOf(r.id) < 0 && risenHp(r) > 0; })
      .sort(function (x, y) { return beastLevel(y) - beastLevel(x); })[0] || null;
  }
  /** Would this Necromancy spell do anything now? (castFor skips it if not -- idle hunts don't waste runes.) */
  function necroUseful(s, pl, b, sp) {
    if (!sp.necro || !NECRO_UTIL[sp.necro]) return true;
    var up = risenUp(b);
    if (sp.necro === "raise") return up.length < risenSlots(pl) && !!risenToRaise(s, pl, b);
    if (sp.necro === "mend") return up.some(function (p) { return p.hp < p.maxHp * 0.6; });
    if (sp.necro === "army") return up.length > 0 && !b.army;
    if (sp.necro === "rites") return up.length > 0 && !b.rites && !b.ritesUsed && Object.keys(sp.needs || {}).every(function (k) { return has(s, k, sp.needs[k]); });
    return true;
  }
  /** A risen comes into the fight. */
  function risenRise(s, pl, b, at, log) {
    var bst = risenToRaise(s, pl, b);
    if (!bst) return false;
    b.risen = b.risen || [];
    var p = risenInFight(s, pl, bst, at);
    b.risen.push(p);
    log({ by: "pet", pet: p.name, risen: true, rose: true });
    return true;
  }
  /** Raise, mend, army, rites: your turn, no damage (battleRound calls it). */
  function necroCast(s, pl, b, cast, at, log) {
    var tl = (b.me && b.me.tal) || {}, up = risenUp(b);
    if (cast.necro === "raise") return risenRise(s, pl, b, at, log);
    if (cast.necro === "mend") {
      var low = up.slice().sort(function (x, y) { return x.hp / x.maxHp - y.hp / y.maxHp; })[0];
      if (!low) return false;
      var h = Math.max(1, Math.round(low.maxHp * 0.25 * (1 + (tl.mendPct || 0))));
      low.hp = Math.min(low.maxHp, low.hp + h);
      log({ by: "pet", pet: low.name, risen: true, mended: h });
      return true;
    }
    if (cast.necro === "army") { b.army = true; log({ by: "pet", pet: "Your risen", risen: true, army: true }); return true; }
    if (cast.necro === "rites") {
      Object.keys(cast.needs || {}).forEach(function (k) { take(s, k, cast.needs[k]); b.items = b.items || {}; });
      b.rites = true; b.ritesUsed = true;
      log({ by: "pet", pet: "Your risen", risen: true, ritesOn: true });
      return true;
    }
    return false;
  }
  /** A Necromancy spell that hit: its curse, its chill, its siphon. */
  function necroLanded(s, pl, b, cast, d, at) {
    if (!cast.necro || b.mhp <= 0) return;
    var tl = (b.me && b.me.tal) || {};
    if (cast.necro === "wither") addEffect(b, "them", "weakened", { rounds: 4 + (tl.curseRounds || 0) }, at);
    if (cast.necro === "chill") addEffect(b, "them", "slowed", { rounds: 2 + (tl.curseRounds || 0) }, at);
    if (cast.necro === "siphon") {
      var low = risenUp(b).sort(function (x, y) { return x.hp / x.maxHp - y.hp / y.maxHp; })[0];
      if (low) low.hp = Math.min(low.maxHp, low.hp + Math.max(1, Math.round(d / 2)));
    }
  }
  /** As a fight opens: Eternal servants raises your first risen on its own. */
  function risenOpen(s, pl, b, at) {
    // the risen you raised stay with you for the whole hunt (Cam, PT24 f1: "I want my rissen pet to stay there for the whole hunt")
    if (necroOn(pl) && pl.job && pl.job.hunt && (pl.job.risen || []).length && !(b.risen && b.risen.length)) {
      b.risen = [];
      pl.job.risen.forEach(function (id) {
        var bst = beastById(s, id);
        if (!bst || !bst.risen || risenHp(bst) <= 0 || b.risen.length >= risenSlots(pl)) return;
        var p = risenInFight(s, pl, bst, at); b.risen.push(p);
        b.rounds.push({ by: "pet", pet: p.name, risen: true, stays: true, t: at });
      });
      if (b.risen.length) return;
    }
    if (!necroOn(pl) || !(talentSum(pl).autoRaise > 0) || (b.risen && b.risen.length)) return;
    risenRise(s, pl, b, at, function (o) { o.t = at; b.rounds.push(o); });
  }
  /** The risen's turn: each strikes once (twice with Army of the dead). */
  function risenTurn(s, pl, b, at, log) {
    var mon = MONSTERS[b.mon], tl = b.me.tal || {}, gd = b.fx ? fxMult(b, "them", "defMult") : 1;
    var staff = ((ITEMS[(pl.gear || {}).weapon] || {}).gear || {}).risenDmg || 0;
    risenUp(b).forEach(function (p) {
      for (var n = 0; n < (b.army ? 2 : 1) && b.mhp > 0; n++) {
        var acc = Math.min(0.98, chance(p.att, gd === 1 ? mon.def : mon.def * gd));
        if (rnd(b) >= acc) { log({ by: "pet", pet: p.name, risen: true, move: "Strike", hit: 0 }); continue; }
        if (mon.eva && rnd(b) < mon.eva) { log({ by: "pet", pet: p.name, risen: true, move: "Strike", hit: 0, dodged: true }); continue; }
        var d = Math.max(1, Math.round((1 + Math.floor(rnd(b) * p.maxHit)) * mult(mon.weak, p.dtype) * mult(mon.resist, p.dtype) * NECRO.risenDmg * (1 + (tl.risenDmg || 0) + staff) * poisonedMult(b)));
        b.mhp -= d;
        log({ by: "pet", pet: p.name, risen: true, move: "Strike", hit: d });
      }
    });
    b.army = false;
  }
  /** The creature turns on a risen (NECRO.target of its turns, while one stands). */
  function risenHit(s, pl, b, at, log) {
    var mon = MONSTERS[b.mon], up = risenUp(b), p = up[Math.floor(rnd(b) * up.length)], tl = b.me.tal || {};
    var theirs = Math.max(0.05, Math.min(0.9, (mon.att + 1) / (mon.att + p.def + 4))) * (b.fx ? fxMult(b, "them", "accMult") : 1);
    if (rnd(b) < p.dodge) { log({ by: "them", hit: 0, dodged: true, pet: p.name }); return; }
    if (rnd(b) >= theirs) { log({ by: "them", hit: 0, pet: p.name }); return; }
    var t = Math.max(1, Math.round((1 + Math.floor(rnd(b) * mon.maxHit)) * (1 - Math.min(TALENT_RULES.caps.risenDr, tl.risenDr || 0)) * (b.fx ? fxMult(b, "them", "hitMult") : 1)));
    p.hp = Math.max(0, p.hp - t);
    log({ by: "them", hit: t, pet: p.name });
    if (p.hp > 0) return;
    if (b.rites) { b.rites = false; p.hp = Math.max(1, Math.round(p.maxHp * 0.3)); log({ by: "pet", pet: p.name, risen: true, rites: true }); return; }
    log({ by: "pet", pet: p.name, risen: true, fell: true });
  }
  /** After any fight: the risen's health kept, the fallen back to their graves, half a battle pet's xp for a win. */
  function risenAfterFight(s, pl, b, res, at) {
    if (!b.risen || !b.risen.length) return;
    if (pl.job && pl.job.hunt) pl.job.risen = b.risen.filter(function (p) { return p.hp > 0; }).map(function (p) { return p.id; });   // ...into the next fight (PT24 f1)
    var mon = MONSTERS[b.mon];
    b.risen.forEach(function (p) {
      var bst = beastById(s, p.id);
      if (!bst) return;
      bst.hp = Math.max(0, p.hp); bst.hpAt = at;
      if (p.hp <= 0) { risenFalls(s, bst, at, mon); return; }
      if (res !== "won") return;
      var l0 = beastLevel(bst);
      bst.xp = Math.round(((bst.xp || 0) + killXp(mon) * NECRO.xpShare) * 10) / 10;
      bst.wins = (bst.wins || 0) + 1;
      if (beastLevel(bst) > l0) note(s, at, who(bst) + " (risen) reached battle level " + beastLevel(bst) + ".");
    });
  }
  /** Morvane's first defeat gives the Blood Book (endBossBattle asks). */
  function necroBossSpoils(s, b, hl, got) {
    if (b.ground !== "hollowcrypt" || hl.wins !== 1 || (s.bag || {}).bloodbook > 0 || (s.player.necro && s.player.necro.taught)) return;
    give(s, "bloodbook", 1, true); got.bloodbook = (got.bloodbook || 0) + 1;
  }
  /** Beating the mage who teaches it (endDuel asks): the offer. V8 (2026-10-18): Sorceress Nyx, rank 4 -- it was the Archmage;
   *  a save he'd already offered it in keeps that offer (offered is set either way). */
  function archmageOffer(s, rank, at) {
    if (rank < (NECRO.offerRank || MAGE_RANKS.length - 1)) return;
    var pl = s.player;
    pl.necro = pl.necro || {};
    if (pl.necro.offered) return;
    pl.necro.offered = at;
    note(s, at, NECRO.offer + " -- answer her at the mage tower.");
  }
  function cryptDay(now) { return Math.floor((now || 0) / DAY); }

  /** necro {op: "accept" | "decline" | "learn"} -- Nyx's offer and her quest (V8) · raise {i} -- a grave's pet, risen ·
   *  risenpotion {id} -- a potion of life essence on a risen · vigil {} -- a night at the graves · buy from the crypt merchant. */
  function necroAct(s, action, opts, now) {
    var pl = s.player;
    if (action === "buy" && opts.from === "cryptmerchant") {
      var line = CRYPT_STOCK[opts.item];
      if (!line) return null;                                            // the rest of his stock: the usual buy
      if (!npcHere(s, "cryptmerchant", now)) return no(s, "Sexton Hobb keeps his stall in the Hollow Crypt.");
      var day = cryptDay(now), cb = s.cryptBought && s.cryptBought.day === day ? s.cryptBought : { day: day, n: 0 }, n = Math.max(1, Math.min(line.daily - cb.n, opts.n | 0 || 1));
      if (cb.n >= line.daily) return no(s, "\"That's all I'll part with today. Come back tomorrow.\" (" + line.daily + " a day)");
      if (!hasCoins(s, line.price * n)) return no(s, "Life essence is " + line.price.toLocaleString() + " coins -- you have " + (s.coins || 0).toLocaleString() + ".");
      if (!roomFor(s, opts.item) || stackRoom(s, opts.item) < n) return no(s, "Your bag is full.");
      spend(s, line.price * n); give(s, opts.item, n); cb.n += n; s.cryptBought = cb;
      return yes(s, now, "Bought " + n + " life essence from Sexton Hobb for " + (line.price * n).toLocaleString() + " coins.");
    }
    if (["necro", "raise", "risenpotion", "vigil"].indexOf(action) < 0) return null;
    pl.necro = pl.necro || {};
    if (action === "necro") {
      if (!pl.necro.offered) return no(s, "Nobody has offered you anything. Beat Sorceress Nyx at the mage tower first.");
      if (pl.necro.taught) return no(s, "You know Necromancy already.");
      if (opts.op === "decline") { pl.necro.declined = now; pl.necro.accepted = 0; return yes(s, now, NECRO.declined); }
      if (opts.op === "accept") { pl.necro.accepted = now; delete pl.necro.declined; return yes(s, now, NECRO.accepted); }
      if (opts.op === "learn") {
        if (!pl.necro.accepted) return no(s, "Say yes to her first.");
        var short = Object.keys(NECRO.quest).filter(function (k) { return !has(s, k, NECRO.quest[k]); });
        if (short.length) return no(s, "She wants " + itemsText(NECRO.quest) + " -- you're short of " + short.map(function (k) { return ITEMS[k].name.toLowerCase(); }).join(" and ") + ".");
        Object.keys(NECRO.quest).forEach(function (k) { take(s, k, NECRO.quest[k]); });
        pl.necro.taught = now;
        return yes(s, now, NECRO.taught + " You know Necromancy: its branch is on your Arcane tree, its spells in your Spellbook, and the Necromancer's ground is in your graveyard.");
      }
      return no(s, "Yes, or no?");
    }
    if (!(pl.necro && pl.necro.taught)) return no(s, "Only a Necromancer can do that -- Sorceress Nyx teaches it.");
    if (action === "raise") {
      if (pl.cls !== "arcane") return no(s, "Necromancy is an Arcane's magic -- you'd need to be one again.");
      if (pl.job || pl.battle) return no(s, "Raise them at home, at the Necromancer's ground.");
      var g = (s.graveyard || [])[opts.i | 0];
      if (!g) return no(s, "There's no grave like that.");
      if (beastsOf(s).length >= penStalls(s)) return no(s, "The crypt door and the Beast Pen are full (" + penStalls(s) + " places between them).");
      var cost = raiseCost(g);
      if (!has(s, "lifeessence", cost) && !(s.dev && s.dev.infinite)) return no(s, "Raising " + g.name + " takes " + cost + " life essence -- wisps carry it, in the Hollow Crypt at night.");
      if (!(s.dev && s.dev.infinite)) take(s, "lifeessence", cost);
      s.graveyard.splice(opts.i | 0, 1);
      var bst = toRisen(g, now);
      beastsOf(s).push(bst);
      return yes(s, now, g.name + " " + (NECRO.raisedBy[beastType(bst)] || NECRO.raised) + " (" + cost + " life essence; battle level " + beastLevel(bst) + "). Raise the fallen brings them into a fight.");
    }
    if (action === "risenpotion") {
      var r = beastById(s, opts.id);
      if (!r || !r.risen) return no(s, "That isn't one of your risen.");
      if (!has(s, "lifepotion")) return no(s, "You need a potion of life essence (the apothecary table, Herblore 40).");
      if (risenHp(r) >= risenMax(r)) return no(s, who(r) + " is whole.");
      take(s, "lifepotion");
      r.hp = Math.min(risenMax(r), risenHp(r) + Math.round(risenMax(r) * ITEMS.lifepotion.risenHeal)); r.hpAt = now;
      return yes(s, now, who(r) + " drinks the light in: " + risenHp(r) + " / " + risenMax(r) + ".");
    }
    if (action === "vigil") {
      if (!isNight(now)) return no(s, "The wisps only come after dark (9 pm to 5 am).");
      var night = Math.floor((now - NECRO.vigil.hours[1] * HOUR) / DAY);
      if (pl.necro.vigil === night) return no(s, "You've kept tonight's vigil.");
      pl.necro.vigil = night;
      var h = Math.imul(night + 7, 2654435761) ^ (s.graveyard || []).length, roll = ((h ^ (h >>> 15)) >>> 0) % 1000 / 1000;
      if (roll >= NECRO.vigil.chance && !quarrySureVigil(s, now)) return yes(s, now, "You keep a vigil among the lanterns. Nothing comes tonight.");   // (a wisp in a jar, V6)
      give(s, "lifeessence", 1);
      return yes(s, now, "A wisp drifts in among the graves and settles in your hand: 1 life essence.");
    }
    return null;
  }
  /** The Necromancer's ground: the graves you could raise (and what each costs), your risen, the lanterns. */
  function necroView(s, now) {
    var pl = s.player, on = !!(pl.necro && pl.necro.taught);
    return { offered: !!(pl.necro && pl.necro.offered), accepted: !!(pl.necro && pl.necro.accepted), declined: !!(pl.necro && pl.necro.declined), taught: on, arcane: pl.cls === "arcane",
             quest: Object.keys(NECRO.quest).map(function (k) { return { id: k, name: ITEMS[k].name, need: NECRO.quest[k], have: (s.bag || {})[k] || 0 }; }),
             essence: (s.bag || {}).lifeessence || 0, slots: risenSlots(pl), room: Math.max(0, penStalls(s) - beastsOf(s).length), night: isNight(now),
             vigilDone: on && pl.necro.vigil === Math.floor((now - NECRO.vigil.hours[1] * HOUR) / DAY),
             graves: (s.graveyard || []).map(function (g, i) { return { i: i, name: g.name, species: g.species, colour: g.colour, level: graveLevel(g), cost: raiseCost(g), raised: g.raised || 0, risen: !!g.risen }; }),
             risen: risenOf(s).map(function (b) { return { id: b.id, name: who(b), kind: kindName(b), species: b.species, colour: b.colour, level: beastLevel(b), hp: risenHp(b), maxHp: risenMax(b), raised: b.raised || 1 }; }),
             lanterns: risenOf(s).length + (s.graveyard || []).filter(function (g) { return g.risen; }).length,
             offer: NECRO.offer, accept: NECRO.accepted, ilse: NECRO.ilse, steps: necroSteps(s) };
  }
  /** The quest "The Blood Book" (V8, Cam: "a necromancy quest ... to explain the details ... the requirements like rowboat, quests
   *  etc"): every step from the boat to Nyx, ticked from the save as you go. */
  function necroSteps(s) {
    var pl = s.player, hl = (s.hunt || {}).hollowcrypt || {}, salt = (PEOPLE.coast.quests.filter(function (q) { return q.id === "boat"; })[0] || {}).needs || [];
    var fishNeed = ((salt.filter(function (n) { return n.level; })[0] || {}).level || ["fishing", 35])[1], bring = (salt.filter(function (n) { return n.bring; })[0] || {}).bring || {};
    var boat = shipTier(s) >= 1, book = has(s, "bloodbook") || !!(pl.necro && pl.necro.taught), runes = (s.bag || {}).bloodrune || 0, rq = NECRO.quest.bloodrune;
    return [
      { id: "boat", done: boat, text: "Old Salt's boat -- help him on the Coast (Fishing " + fishNeed + ", " + itemsText(bring) + ")" },
      { id: "isle", done: boat && levelOf(pl.skills.fishing || 0) >= REGIONS.mistyisle.needs.skills.fishing, text: "Cross to the Misty Isle (Fishing " + REGIONS.mistyisle.needs.skills.fishing + ")" },
      { id: "lantern", done: has(s, "lantern") || (hl.kills || 0) > 0, text: "A miner's lantern, to see where the steps go" },
      { id: "crypt", done: (hl.kills || 0) > 0 || book, text: "Down into the Hollow Crypt (a level-" + HUNTS.hollowcrypt.level + " hunting ground)" },
      { id: "morvane", done: book || (hl.wins || 0) > 0, text: "Beat Morvane the Lich for the Blood Book (she comes out after " + HUNTS.hollowcrypt.kills + " kills there)" },
      { id: "runes", done: runes >= rq || !!(pl.necro && pl.necro.taught), text: rq + " blood runes, from the crypt's Blood altar (Runecrafting 38) -- " + Math.min(runes, rq) + "/" + rq },
      { id: "nyx", done: !!(pl.necro && pl.necro.taught), text: "Back to Sorceress Nyx with the book and the runes" }];
  }
