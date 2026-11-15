  // ---- live battles (2026-10-03) ---------------------------------------------------------
  // Cam: "the fights need to take a little more time when they are occuring to give me a chance to
  // set attacks, eat food ... Also should be a run button." A fight is a round every ROUND: your
  // blow (and your companion's), then the creature's. Between rounds you can change style, fire
  // your special, eat (it takes your next attack, as in RuneScape) or run. Left alone, it plays itself.
  var ROUND = 2400;
  // Manual fights (2026-10-06, Cam: "battles should have ability to be done manual as well as
  // auto"): a boss fight can wait for your move each round -- attack, special, eat or run -- and be
  // switched to auto at any time. While it waits, no round comes due (and time doesn't heal you).
  var MANUAL_WAIT = 8.64e15;
  function startBattle(s, pl, kind, groundId, monId, at, holder) {
    if (pl === s.player && pl.cls === "beastmaster") return startPack(s, pl, kind, groundId, monId, at, holder);   // a pack (Part 11b)
    // B5: no arrow taken up front -- the bow takes one a shot; a hunt with no arrows (from the start, 2026-10-20, Cam: "if no arrows
    // as hunter have the hunting session still start but using the knife or fists"), you fight with the knife or fists
    var pf = playerFighter(s, pl, holder, at, { noAmmo: true, dry: !!(holder && holder.hunt) });
    if (pf.out) return pf;                                                // (no arrows -- or your quiver's empty: pf.why)
    if (holder && holder.hunt && pf.me.wfrom !== "main" && pf.me.wfrom !== "offhand" && isWeapon((pl.gear || {}).weapon) && ITEMS[pl.gear.weapon].gear.style === "ranged" && !holder.dryNoted) {
      holder.dryNoted = true;
      note(s, at, "Out of arrows -- you hunt " + (huntShots(holder) > 0 ? "on " : "") + "with " + (pf.me.wfrom === "knife" ? "your " + pf.me.wname.toLowerCase() : "your fists") + ".");
    }
    useBrew(s, "combat", at);                                         // a fight of your potion used
    var me = pf.me;
    me.flee = pl.made ? 0 : (pl.retreat > 0 ? pl.retreat : 0) * maxHp(pl);   // PT30: you never run on your own -- press Run, or eat
    var ngx = (1 + 0.2 * (s.ngPlus || 0)) * rate("monsters");        // New Game Plus: tougher every cycle (and a mod's monsters)
    pl.battle = { kind: kind, ground: groundId, mon: monId, mhp: Math.round(MONSTERS[monId].hp * ngx), mhp0: Math.round(MONSTERS[monId].hp * ngx), ng: s.ngPlus || 0, start: at, nextRound: at + ROUND, n: 0,
                  rounds: [], me: me, style: pf.style, ammo: pf.ammo, seed: Math.floor(rnd(holder) * 4294967296) | 0,
                  skip: false, queued: false, rage: false, items: {} };
    return { ok: true };
  }
  /** One round. Returns "" while it goes on, or "won" | "fled" | "dead". */
  function battleRound(s, pl, b, at) {
    if (b.pack) return packRound(s, pl, b, at);                              // a Beast Master's pets fight (Part 11b)
    var mon = MONSTERS[b.mon], me = b.me, cls = pl.cls ? CLASSES[pl.cls] : null, cb = pl.combat || {};
    healTo(pl, at);
    if (!b.manual && b.n > 0 && autoRuns(b) && mustFlee(pl, worstHit(mon, b.me, b.rage))) return "fled";   // too hurt, and you didn't eat (early grounds only)
    b.n++;
    if (b.style === "ranged" && pl === s.player && !b.skip && arrowsLeft(s, pl) < 1) {   // B5: the bow's dry -- the knife, or fists, now
      var dryAmmo = ITEMS[(pl.gear || {}).ammo];
      refreshFighter(s, pl, b, at, true); me = b.me;
      b.rounds.push({ t: at, by: "you", hit: 0, dry: dryAmmo ? dryAmmo.name : "arrow", w: me.wname });
    }
    if (b.n === 1 && pl.necro) risenOpen(s, pl, b, at);                     // your risen from the last fight, or Eternal servants (Part 13)
    me.style = STYLES[cb.style] ? cb.style : "accurate";
    planToolFor(s, pl, b);                                                   // the hunt plan's trap or net (Battle Re-work Part 4)
    planBashFor(s, pl, b);                                                   // ... and its shield bash (Part 8)
    var toolTurn = !!b.toolNext && !b.skip && !(b.fx && fxHeld(b, "you"));   // a trap or a net this turn: specials and spells wait
    var bashTurn = !toolTurn && !!b.bashNext && !b.skip && !(b.fx && fxHeld(b, "you")), busyTurn = toolTurn || bashTurn;   // a shield bash
    var windup = !!me.slow && !b.skip && !busyTurn && b.n % 2 === 0 && !(b.fx && fxHeld(b, "you"));   // a maul: every other round (Part 5)
    var dealt = 0, taken = 0, blocked = 0;                                   // for fury (the killing round's too: PT4) and devotion
    var sp = null;
    if (me.spec && (b.n === 1 || b.specWait)) {                              // the special pressed between fights: this fight's first blow
      if (busyTurn || windup) b.specWait = true; else { sp = me.spec; b.specWait = false; }   // (after an opening trap, the blow after it)
    }
    var cbs = cb.special ? specOf(pl, cb.special) : null;                    // (no class needed for a weapon's own -- PT39 f4)             // (V18: a class's, a weapon's or a signature special)
    if (!sp && !busyTurn && !windup && b.queued && cbs && specFits(cls, cbs, b.style, me.wid) && specMeter(pl, b) >= specCostOf(pl, cbs) && !specialLock(pl, cbs) && !specUnlockWhy(pl, cbs)) {
      sp = cbs;                                                              // the special you pressed
      if (sp.ammo && b.style === "ranged" && arrowsLeft(s, pl) < sp.ammo) sp = null;   // (B5: its arrows go on the shot)
      if (sp) specPay(pl, b, specCostOf(pl, sp));                          // the special bar -- or a Berserker's fury
    }
    if (!busyTurn && !windup) b.queued = false;
    if (sp && sp.aegis) b.aegis = PALADIN.aegis + ((me.tal || {}).aegisRounds || 0);   // Aegis (Part 8)
    if (sp && sp.smoke) b.smoke = THIEF.smoke + ((me.tal || {}).smokeRounds || 0);    // Smoke bomb (Part 7)
    if (sp && sp.envenom) b.envenom = true;                                            // Envenom: the next hit poisons
    if (sp && sp.lust) b.lust = { left: sp.lust.rounds + 1, heal: sp.lust.heal + (((me.tal || {}).lustHeal) || 0) };   // Bloodlust
    if (sp && sp.rage) b.rage = true;
    var log = function (o) { o.t = at; b.rounds.push(o); if (b.rounds.length > 40) b.rounds.shift(); };
    var cast = null;
    if (me.magic && !b.skip && !busyTurn) {                                               // the Arcane: this round's spell (2026-10-07)
      cast = castFor(s, pl, b, sp ? sp.hits || 1 : 1);
      me.dtype = cast ? "magic" : me.magic.bashType || "crush";
      me.maxHit = cast ? cast.base + Math.floor(me.magic.lvl / 6) + me.magic.dmg : me.magic.bash;
      b.cast = cast ? cast.name : me.magic.bashName || (me.magic.wand ? "Fists" : "Staff bash");
    }
    var gd = b.fx ? fxMult(b, "them", "defMult") : 1;                      // a broken guard (Battle Re-work effects)
    var tal = me.tal || {}, caught = b.fx ? fxHeld(b, "them") : "";       // talents (Battle Re-work Part 3); a creature in your trap (Part 4)
    var mine = chance(me.att, (gd === 1 ? mon.def : mon.def * gd) * (sp && sp.ignoreDef ? 1 - sp.ignoreDef : 1)) * (me.style === "accurate" ? 1.15 : 1) * (1 + (me.acc || 0)) * (caught && tal.heldAcc ? 1 + tal.heldAcc : 1);
    var theirs = Math.max(0.05, Math.min(0.9, (mon.att + 1) / (mon.att + defVs(me, mon.atk) + 4))) * (me.style === "defensive" ? 0.8 : 1) * (b.fx ? fxMult(b, "them", "accMult") : 1);   // off balance (air)
    var hitMult = mult(mon.weak, me.dtype) * mult(mon.resist, me.dtype) * mult(mon.matWeak, me.mat)
                  * (mon.boss && tal.bossDmg ? 1 + tal.bossDmg : 1) * (tal.lowHpDmg && pl.hp < maxHp(pl) / 2 ? 1 + tal.lowHpDmg : 1)
                  * (b.n === 1 && tal.openerDmg ? 1 + tal.openerDmg : 1) * (caught && tal.heldDmg ? 1 + tal.heldDmg : 1)   // Killing ground
                  * (tal.furyDmg && (pl.fury || 0) >= 50 ? 1 + tal.furyDmg : 1)                                          // Red mist
                  * castMult(pl, b, cast) * poisonedMult(b)                                                            // elements (Part 6); Rot (Part 7)
                  * quarryDmg(s, b.mon)                                                                                // a mastered creature (V6)
                  * (tal.meleeDmg && b.style === "melee" && !cast ? 1 + tal.meleeDmg : 1)                               // Weapon mastery (Part 9)
                  * (sp && sp.smite ? (isUndead(b.mon) ? 3 / sp.dmg : 1) * (1 + (tal.smiteDmg || 0)) : 1) * blessMult(pl, b)   // Smite, holy water (Part 8)
                  * (b.avenge && tal.avenge ? 1 + tal.avenge : 1) * (tal.devDmg && (pl.devotion || 0) >= 50 ? 1 + tal.devDmg : 1);
    var hurtMult = mult(me.weak, mon.atk) * mult(me.resist, mon.atk) * (1 - Math.min(0.5, me.brace || 0)) * (1 - drVs(me, mon.atk)) * (b.rage ? 1.5 - (tal.rageCut || 0) : 1) * (1 + 0.15 * (b.ng || 0)) * (b.fx ? fxMult(b, "them", "hitMult") : 1) * rate("monsters");
    var dodgeIt = (mon.eva || 0) * Math.max(0, 1 - (me.trueStrike || 0));
    var youHeld = b.fx ? fxHeld(b, "you") : "", swung = false, layTurn = false, spLanded = false;
    if (sp && sp.heal && !b.skip && !youHeld) {                              // Lay on hands: a heal, and your turn (Mercy: not your turn)
      var lh = Math.max(1, Math.round(maxHp(pl) * (PALADIN.layHeal + (tal.layHeal || 0))));
      pl.hp = Math.min(maxHp(pl), pl.hp + lh); log({ by: "you", hit: 0, lay: lh });
      layTurn = !tal.layFree;
    }
    if (b.skip) {                                                            // eating (or a weapon swap) took your turn
      b.skip = false;
      if (b.skipWhy === "swap") log({ by: "you", hit: 0, swap: true });
      else if (b.skipWhy === "gear" || b.skipWhy === "drink") log({ by: "you", hit: 0, gear: b.skipWhy });   // changed from the bag mid-fight (N22)
      else log({ by: "you", hit: 0, ate: true });
      b.skipWhy = null;
    } else if (youHeld) log({ by: "you", hit: 0, held: youHeld });
    else if (toolTurn && useTool(s, pl, b, at, log)) { /* a trap laid or a net thrown: that was your turn */ }
    else if (windup) log({ by: "you", hit: 0, windup: true, w: me.wname });  // the maul goes up
    else if (bashTurn && useBash(s, pl, b, at, log)) { /* a shield bash: that was your turn */ }
    else if (layTurn) { /* Lay on hands took it */ }
    else if (cast && NECRO_UTIL[cast.necro]) { swung = true; necroCast(s, pl, b, cast, at, log); }   // raise, mend, army, rites (Part 13)
    else {
      swung = true;
      if (b.style === "ranged" && !cast && pl === s.player) shootArrows(s, pl, b, sp && sp.ammo ? sp.ammo : 1);   // B5: an arrow a shot
      var hits = (sp ? sp.hits || 1 : 1) + (cast && cast.hits ? cast.hits - 1 : 0) + (me.double && rnd(b) < me.double ? 1 : 0) + (me.dual && !cast ? 1 : 0);   // dual daggers: two stabs
      for (var h = 0; h < hits && b.mhp > 0; h++) {
        var sn = sp ? sp.name : cast ? cast.name : "";
        // which attack it was (2026-10-09, Cam: "Hit for 6 with wind strike or something"):
        // the special or spell by name, else your weapon (wp: say "your")
        var wn = sn || (me.magic && !cast && me.magic.bashName) || me.wname || (ITEMS[(pl.gear || {}).weapon] || {}).name || "fists", wp = !sn;   // (a fight saved before wname: the gear)
        if (rnd(b) < Math.min(0.98, mine * (sp ? sp.acc || 1 : 1) * (cast && cast.acc ? cast.acc : 1))) {   // (Bone spear, Part 13)
          if (dodgeIt && rnd(b) < dodgeIt) { log({ by: "you", hit: 0, dodged: true, spec: sn, w: wn, wp: wp }); continue; }
          var top = me.maxHit + (me.style === "aggressive" ? 1 : 0) + (tal.furyHit && (pl.fury || 0) >= 50 ? tal.furyHit : 0) + (pl.bless ? ITEMS[pl.bless.id].bless.maxHit : 0), roll = 1 + Math.floor(rnd(b) * top);
          var d = Math.max(1, Math.round(roll * hitMult * (sp ? sp.dmg || 1 : 1) * (me.heavy || 1) * (me.dual && !cast ? me.dual : 1)));   // a maul: heavy; dual daggers: softer
          dealt += Math.min(d, Math.max(0, b.mhp)); b.mhp -= d;          // fury from what it had left: no overkill (PT4)
          log({ by: "you", hit: d, spec: sn, w: wn, wp: wp });
          if (sp && !spLanded) { spLanded = true; specLanded(s, pl, b, sp, at); }   // its effect, once (V18)
          if (me.stunBig && roll >= me.stunBig * top && rnd(b) < me.bigStun && b.mhp > 0) addEffect(b, "them", "stunned", { rounds: 1, lvl: classLevel(pl, pl.cls) }, at);   // a big maul blow
          if (me.onHit && rnd(b) < me.onHit.chance && b.mhp > 0) addEffect(b, "them", "bleeding", { rounds: me.onHit.bleed[1], power: me.onHit.bleed[0] }, at);   // spiked gauntlets
          if (b.lust) pl.hp = Math.min(maxHp(pl), pl.hp + Math.max(1, Math.round(d * b.lust.heal)));   // Bloodlust
          if (!cast) { thiefOnHit(s, pl, b, at, !!b.envenom); b.envenom = false; blessSpend(s, pl, at); }   // poison on the blade (Part 7); a blessing (Part 8)
          if (cast && cast.heal) pl.hp = Math.min(maxHp(pl), pl.hp + Math.max(1, Math.round(d * cast.heal)));   // Hart's blessing
          if (cast) castLanded(s, pl, b, cast, d, at);                                                         // its element (Part 6)
          if (cast && cast.necro) necroLanded(s, pl, b, cast, d, at);                                          // a curse, a chill, a siphon (Part 13)
        } else log({ by: "you", hit: 0, spec: sn, w: wn, wp: wp });
      }
    }
    if (swung && pl === s.player) wearWeapon(s, pl, b, at, me.magic && !cast ? me.magic.bashId : me.wid);   // a swing, a shot or a cast wears it
    if (b.mhp > 0 && me.petHit) { b.mhp -= me.petHit; log({ by: "pet", hit: me.petHit }); }
    if (b.mhp > 0 && b.risen && b.risen.length) risenTurn(s, pl, b, at, log);  // the risen strike (Part 13)
    if (b.mhp <= 0) { b.mhp = 0; furyAfterRound(pl, b, dealt, taken); return "won"; }
    var tellNow = bossTell(s, pl, b, at, log);                             // a boss's tell: winding up, broken, or the big blow
    var held = b.fx ? fxHeld(b, "them") : "";
    if (tellNow === "wind" || tellNow === "broken") { /* its turn went on the tell */ }
    else if (held) log({ by: "them", hit: 0, held: held });                // trapped, netted, stunned or slowed: no turn
    else if (b.smoke > 0) log({ by: "them", hit: 0, smoke: true });       // lost in a Thief's smoke (Part 7)
    else if ((me.stun || (cast && cast.stun)) && rnd(b) < (me.stun || 0) + (cast && cast.stun || 0)) log({ by: "them", hit: 0, stunned: true });
    else if (b.risen && !b.tellHit && risenUp(b).length && rnd(b) < NECRO.target) risenHit(s, pl, b, at, log);   // it turns on one of your risen (Part 13)
    else if (rnd(b) < Math.min(0.95, theirs * tellAcc(b))) {
      if (me.dodge && rnd(b) < me.dodge) {
        log({ by: "them", hit: 0, dodged: true }); feat(pl, "dodged");
        if (tal.counter && b.mhp > 0) { var cd = Math.max(1, Math.round((1 + Math.floor(rnd(b) * me.maxHit)) * hitMult)); dealt += Math.min(cd, b.mhp); b.mhp -= cd; log({ by: "you", hit: cd, counter: true });   // Shadowstep
          if (b.mhp <= 0) { b.mhp = 0; furyAfterRound(pl, b, dealt, taken); return "won"; } }
      }
      else {
        var t = Math.max(1, Math.round((1 + Math.floor(rnd(b) * mon.maxHit)) * hurtMult * tellMult(b) * quarryVeil(s, b, b.mon)) - (me.soak || 0));   // (a wraith's veil, V6)
        if (b.aegis > 0 || (me.block && rnd(b) < me.block)) {                // a Paladin's shield (Part 8): the blow does nothing
          blocked++; feat(pl, "blocked"); log({ by: "them", hit: 0, blocked: true, aegis: b.aegis > 0 });
          if (tal.blockHeal) pl.hp = Math.min(maxHp(pl), pl.hp + tal.blockHeal);
        } else if (tal.saveOnce && !b.saved && pl.hp - t <= 0) {             // Sanctuary: the blow that would fell you, once a fight
          b.saved = true; blocked++; log({ by: "them", hit: 0, blocked: true, saved: true });
        } else {
        pl.hp = Math.max(0, pl.hp - t); taken += t;
        log({ by: "them", hit: t, tellHit: b.tellHit || undefined });
        if (me.reflect && Math.floor(t * me.reflect) >= 1) { b.mhp -= Math.floor(t * me.reflect); log({ by: "you", hit: Math.floor(t * me.reflect), reflect: true }); }
        if (b.mhp <= 0) { b.mhp = 0; furyAfterRound(pl, b, dealt, taken); return "won"; }
        }
      }
    } else log({ by: "them", hit: 0 });
    b.tellHit = null;                                                        // the big blow is spent, landed or not
    if (b.fx) {                                                              // poison, bleeding, burning; effects run down
      fxTick(s, pl, b, at);
      if (b.mhp <= 0 && pl.hp > 0) { b.mhp = 0; furyAfterRound(pl, b, dealt, taken); return "won"; }
    }
    secondWind(pl, b, log);                                                  // Bloodrage: once a fight, at a fifth
    if (pl.hp <= 0) return "dead";
    furyAfterRound(pl, b, dealt, taken);                                     // a Berserker's fury (Part 5)
    devotionAfterRound(pl, b, blocked, taken);                               // a Paladin's devotion (Part 8)
    if (b.aegis > 0) b.aegis--;
    if (b.bashCd > 0) b.bashCd--;
    b.avenge = taken > 0;                                                    // Avenger: your next blow, after you're hit
    if (tal.devRegen && (pl.devotion || 0) >= 50) pl.hp = Math.min(maxHp(pl), pl.hp + tal.devRegen);   // Serenity
    if (b.lust && --b.lust.left <= 0) b.lust = null;
    if (b.smoke > 0) b.smoke--;
    // (Battle Re-work Part 2, 2026-10-15, Cam: "auto heal should be abolished in order to make battles more active and
    //  dynamic": nothing eats for you mid-fight any more -- press Eat. Your hunt plan eats between fights.)
    // (running when one blow could finish you is checked at the START of the next round -- Battle Re-work Part 2: with
    //  nothing eating for you, the round's gap is your chance to press Eat first; left alone, you still get away before
    //  it swings again. A manual fight is yours to call: no running for you.)
    if (b.n >= 80) return "fled";                                            // a stalemate: you leave
    b.nextRound = at + ROUND;
    return "";
  }
  function battleXp(s, pl, b, mon, at) {
    if (pl.cls === "paladin" && PALADIN.xpSplit && b.style === "melee" && b.me.style !== "defensive") {   // a Paladin trains both (Part 8)
      addXp(s, pl, "attack", Math.round(killXp(mon) / 2 * 10) / 10, at); addXp(s, pl, "defence", Math.round(killXp(mon) / 2 * 10) / 10, at);
    } else
    addXp(s, pl, b.me.style === "defensive" ? "defence" : b.style === "ranged" ? "ranged" : b.style === "magic" ? "magic" : "attack", killXp(mon), at);
    addXp(s, pl, "hitpoints", Math.round(killXp(mon) / 3 * 10) / 10, at);
  }
  function endHuntBattle(s, pl, j, b, res, at) {
    var mon = MONSTERS[b.mon], ground = HUNTS[j.hunt], hl = s.hunt[j.hunt] = s.hunt[j.hunt] || { kills: 0, wins: 0, losses: 0 };
    pl.battle = null;
    toolsAfterFight(s, pl, b, res, at);                                    // nets picked up again (Battle Re-work Part 4)
    j.fight = { at: at, mon: b.mon, won: res === "won", ran: res === "ran", fled: res === "fled", beaten: res === "beaten", rounds: b.rounds.slice(-12) };
    specAfterFight(pl);
    packAfterFight(s, pl, b, res, at);                                     // a pack's health, faints and xp (Part 11b)
    risenAfterFight(s, pl, b, res, at);                                    // the risen (Part 13)
    if (res === "beaten") { note(s, at, "Your pack was beaten by the " + mon.name.toLowerCase() + "."); endTrip(s, pl, at, "pack"); return; }
    if (res === "won") {
      j.count++;
      j.kills[mon.name] = (j.kills[mon.name] || 0) + 1;
      hl.kills++;
      quarryKill(s, b.mon, at);                                             // the Bestiary (V6)
      regionTomeCheck(s, at, {ground: j.hunt});                              // a region's tome, the first win there (V11)
      quarrySpoils(s, b.mon, function () { return rnd(j); }, j.items);
      companionSteal(s, j, mon, ground, at);
      mon.drops.forEach(function (d) {
        if (rnd(j) >= Math.min(1, d[3] * rate("drops") * quarryDrops(s, b.mon))) return;
        var n = d[1] + Math.floor(rnd(j) * (d[2] - d[1] + 1));
        give(s, d[0], n);
        j.items[d[0]] = (j.items[d[0]] || 0) + n;
      });
      hunterSpoils(s, pl, j, mon, at);                                     // plucking and field dressing (Cam, Q3)
      specSkinned(s, pl, j, b, mon);                                       // a Skinner's cut (V18)
      fieldPageDrop(s, pl, j, mon, at);                                    // a recipe page, now and then (V2 step 2)
      lockedCrateDrop(s, pl, j, mon, ground, at);                          // a Thief's locked crate (the Marketplace, 2026-10-17)
      j.xp = Math.round((j.xp + killXp(mon)) * 10) / 10;
      var jc = Math.round(purse(AREA_COINS, j.hunt, rnd(j)) * rate("coins") * (1 + (talentSum(pl).coinPct || 0)));   // Light fingers (Part 7)
      if (jc) { s.coins = (s.coins || 0) + jc; j.coins = (j.coins || 0) + jc; }
      j.style = b.style;
      battleXp(s, pl, b, mon, at);
      if (b.me.regen && pl.hp > 0) pl.hp = Math.min(maxHp(pl), pl.hp + b.me.regen);   // Sylvan gear
    }
    if (res === "dead") { fallAndLose(s, pl, mon, ground, at); return; }   // PT30: a hunt can kill you too -- idle hunting is for when you're strong
    var aw = areaWorst(ground, b.me);
    autoEat(s, pl, 50, at, aw);
    // the hunt plan's last meal (V3, carried 9-0 in Part 14; C5): no food left and below its eat line -- home, not into the next fight
    // (V16: nobody eats for you, so running out of food no longer ends a hunt -- your health line does)
    // ran from a fight: your plan eats, and if that makes you safe you hunt on (Battle Re-work Part 2) -- home when it can't
    if (mustFlee(pl, aw) || (res === "fled" && !(pl.retreat > 0))) { endTrip(s, pl, at, "hurt"); return; }
    j.next = at + FIGHT_GAP + trackGap(s, j.hunt, at - b.start);   // straight on to the next (Cam, 2026-10-07: "Get rid of the timer between each fight") -- or a search, when tracking (V15)
  }
  function endBossBattle(s, pl, b, res, at) {
    toolsAfterFight(s, pl, b, res, at);                                    // nets picked up again (Battle Re-work Part 4)
    packAfterFight(s, pl, b, res, at);                                     // a pack's health, faints and xp (Part 11b)
    risenAfterFight(s, pl, b, res, at);                                    // the risen (Part 13)
    if (pl.fury) pl.fury = 0;                                             // a boss fight's fury fades with it (Part 5)
    if (pl.devotion) pl.devotion = 0;                                     // ... and devotion (Part 8)
    if (b.duel) return endDuel(s, pl, b, res, at);
    if (b.pyramid) return endPyramidBattle(s, pl, b, res, at);          // the Pyramid's guardian and the Pharaoh (2026-10-09)
    var ground = HUNTS[b.ground], mon = MONSTERS[b.mon], hl = s.hunt[b.ground] = s.hunt[b.ground] || { kills: 0, wins: 0, losses: 0 };
    pl.battle = null;
    specAfterFight(pl);
    hl.kills = 0;                                                     // "resets after you beat it or lose"
    hl.unlocked = true;                                               // ...but only to the short rematch count
    var got = {};
    s.lastBoss = { ground: b.ground, mon: b.mon, at: at, won: res === "won", fled: res === "fled" || res === "ran", got: got, rounds: b.rounds.slice() };
    if (res === "dead") { hl.losses++; fallAndLose(s, pl, mon, ground, at); return; }
    if (res !== "won") {
      hl.losses++;
      note(s, at, (res === "ran" ? "You ran from " : res === "fled" ? "Hurt, you ran from " : "You couldn't beat ") + mon.name + ". Kill " + rematchKills(ground) + " more in the " + ground.name + " to face them again.");
      return;
    }
    hl.wins++;
    quarryKill(s, b.mon, at);                                             // the Bestiary (V6)
    // the forbidden archive's key (2026-10-08): Grizz carries it, until the archive's open
    if (b.ground === "deepforest" && !(s.home && s.home.archive) && !((s.bag || {}).archivekey > 0)) { give(s, "archivekey", 1, true); got.archivekey = 1; }
    necroBossSpoils(s, b, hl, got);                                    // Morvane's Blood Book, the first time (Part 13)
    tomeBossDrop(s, b, hl, got);                                       // a move tome, now and then (Part 14)
    regionTomeCheck(s, at, {ground: b.ground}); regionTomeBossDrop(s, b, hl, got);   // its region's tome (V11)
    mon.drops.forEach(function (d) {
      if (rnd(b) >= Math.min(1, d[3] * rate("drops"))) return;
      var n = d[1] + Math.floor(rnd(b) * (d[2] - d[1] + 1));
      give(s, d[0], n); got[d[0]] = (got[d[0]] || 0) + n;
    });
    var bc = Math.round(purse(BOSS_PURSE, b.ground, rnd(b)) * rate("coins"));
    if (bc) { s.coins = (s.coins || 0) + bc; got.coins = bc; }
    companionSteal(s, b, mon, ground, at);
    Object.keys(b.items).forEach(function (k) { got[k] = (got[k] || 0) + b.items[k]; });
    battleXp(s, pl, b, mon, at);
    if (b.me.regen && pl.hp > 0) pl.hp = Math.min(maxHp(pl), pl.hp + b.me.regen);
    note(s, at, "You beat " + mon.name + "! (" + itemsText(got) + ")");
    (BOSS_UNLOCKS[ground.boss] || []).forEach(function (u) {
      if (hl.wins === u[0]) note(s, at, "Beaten " + (u[0] === 1 ? "once" : u[0] + " times") + ": " + PETS[u[1]].name + " can now hatch from " + EGGS[u[2]].name.toLowerCase() + "s!");
    });
    if (hl.wins === BOSS_GEAR_WINS && bossGearSet(b.ground).length) note(s, at, "Beaten " + BOSS_GEAR_WINS + " times: " + mon.name + "'s armour and weapons can be made now.");
    resumeHunt(s, pl, b.ground, at, (b.seed || 0) ^ hl.wins);          // straight back to hunting there
  }
  function endDuel(s, pl, b, res, at) {
    var rk = MAGE_RANKS[b.duel], mon = MONSTERS[b.mon];
    pl.battle = null;
    s.lastBoss = { ground: "magetower", mon: b.mon, at: at, won: res === "won", fled: res !== "won" && res !== "dead", got: {}, rounds: b.rounds.slice(), duel: true, rank: b.duel, rematch: !!b.rematch };
    if (res !== "won") {
      if (pl.hp < 1) pl.hp = 1;                                     // a duel stops short: you yield, you don't fall
      note(s, at, (res === "dead" ? "You yielded to " : "You stepped back from ") + mon.name + ". The rank of " + rk.name + " waits for you.");
      return;
    }
    if (b.rematch) {                                                    // a rematch (PT19 b5): xp and that rank's runes, the rank stays as it is
      var got = s.lastBoss.got;
      Object.keys(rk.rematch || {}).forEach(function (k) { give(s, k, rk.rematch[k], true); got[k] = rk.rematch[k]; });
      addXp(s, pl, "magic", killXp(mon), at);
      note(s, at, "You beat " + mon.name + " again in a practice duel (" + itemsText(rk.rematch || {}) + ").");
      regionTomeCheck(s, at, {rematch: b.duel});                           // the Star Tome (V11)
      astralDrop(s, b, b.duel, at, got);                                   // an Astral egg, now and then (V10)
      return;
    }
    s.mageRank = b.duel;
    archmageOffer(s, b.duel, at);                                     // the Archmage's offer (Part 13)
    s.coins = (s.coins || 0) + rk.coins;
    give(s, "ancientchest", 1, true);
    addXp(s, pl, "magic", killXp(mon), at);
    note(s, at, "You beat " + mon.name + "! You're " + (/^[AEIOU]/.test(rk.name) ? "an " : "a ") + rk.name + " of the mage tower now (" + rk.coins + " coins, an ancient chest)" +
                (b.duel < MAGE_RANKS.length - 1 ? "." : " -- the highest rank there is."));
  }
