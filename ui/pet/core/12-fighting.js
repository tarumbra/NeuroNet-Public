  // ---- fighting ---------------------------------------------------------------------------
  // Cam (2026-10-03): "Each creature should have weakness and resistence to certain attack types
  // and equipment. Also each class should provide special attacks but also come with their own
  // resistence and weakness ... select a default attack to use or a special attack."
  // Attacks are slash, crush or pierce; a weapon's material counts against some creatures. Your
  // style: accurate (more hits; trains Attack/Ranged), aggressive (harder hits; trains Attack/
  // Ranged), defensive (they hit less; trains Defence) -- Hitpoints always. A special uses the
  // special bar (+10 a fight, to 100) and fires on its own when it's full enough.
  var STYLES = CONTENT("STYLES");
  // what each weapon hits with, and what it's made of (a bow: its ammo's material)
  var WEAPONS = CONTENT("WEAPONS");
  var DTYPES = CONTENT("DTYPES");
  function mult(table, k) { return (table && table[k]) || 1; }
  function chance(att, def) { return Math.max(0.1, Math.min(0.95, (att + 3) / (att + def + 6))); }
  /** One fight, round by round -- every blow kept for the battle screen. */
  function fight(job, me, mon) {
    var mhp = mon.hp, hp = me.hp, taken = 0, rounds = [], n = 0, fled = false;
    var mine = chance(me.att, mon.def) * (me.style === "accurate" ? 1.15 : 1) * (1 + (me.acc || 0));
    var theirs = Math.max(0.05, Math.min(0.9, (mon.att + 1) / (mon.att + defVs(me, mon.atk) + 4))) * (me.style === "defensive" ? 0.8 : 1);
    var hitMult = mult(mon.weak, me.dtype) * mult(mon.resist, me.dtype) * mult(mon.matWeak, me.mat) * (me.vs || 1);   // (me.vs: a mastered creature, V6)
    var hurtMult = mult(me.weak, mon.atk) * mult(me.resist, mon.atk) * (1 - Math.min(0.5, me.brace || 0));
    // evasion: fast creatures dodge a share of the hits that land; Nimble Fox gear takes it away
    // (Cam: "Gideons armour mitigates against this and ensures you hit the boss every turn")
    var dodgeIt = (mon.eva || 0) * Math.max(0, 1 - (me.trueStrike || 0));
    var sp = me.spec;                                         // a special: fired in the first round
    while (mhp > 0 && hp > 0 && n < 80) {
      n++;
      var hits = (sp && n === 1 ? sp.hits || 1 : 1) + (me.double && rnd(job) < me.double ? 1 : 0);
      for (var h = 0; h < hits && mhp > 0; h++) {
        var acc = mine * (sp && n === 1 ? sp.acc || 1 : 1);
        if (rnd(job) < Math.min(0.98, acc)) {
          if (dodgeIt && rnd(job) < dodgeIt) { rounds.push({ by: "you", hit: 0, dodged: true, spec: sp && n === 1 ? sp.name : "" }); continue; }
          var d = (1 + Math.floor(rnd(job) * (me.maxHit + (me.style === "aggressive" ? 1 : 0)))) * hitMult * (sp && n === 1 ? sp.dmg || 1 : 1);
          d = Math.max(1, Math.round(d));
          mhp -= d;
          rounds.push({ by: "you", hit: d, spec: sp && n === 1 ? sp.name : "" });
        } else rounds.push({ by: "you", hit: 0, spec: sp && n === 1 ? sp.name : "" });
      }
      // a fighting companion (Billy): a set hit every round
      if (mhp > 0 && me.petHit) { mhp -= me.petHit; rounds.push({ by: "pet", hit: me.petHit }); }
      if (mhp <= 0) break;
      if (me.stun && rnd(job) < me.stun) { rounds.push({ by: "them", hit: 0, stunned: true }); continue; }
      if (rnd(job) < theirs) {
        if (me.dodge && rnd(job) < me.dodge) { rounds.push({ by: "them", hit: 0, dodged: true }); continue; }
        var t = Math.max(1, Math.round((1 + Math.floor(rnd(job) * mon.maxHit)) * hurtMult * (sp && sp.rage ? 1.5 : 1)));
        hp -= t; taken += t;
        rounds.push({ by: "them", hit: t });
        if (me.reflect) { var back = Math.floor(t * me.reflect * 10) / 10; if (back >= 1) { mhp -= Math.floor(back); rounds.push({ by: "you", hit: Math.floor(back), reflect: true }); } }
        if (me.flee && hp > 0 && hp <= me.flee && mhp > 0) { fled = true; break; }   // hurt: get away
      } else rounds.push({ by: "them", hit: 0 });
    }
    return { won: mhp <= 0, hp: hp, taken: taken, rounds: rounds, fled: fled };
  }
  function addXp(s, w, skill, xp, at) {
    w.skills[skill] = w.skills[skill] || (skill === "hitpoints" ? XP[10] : 0);
    if (w === s.player) xp *= homeXp(s, skill, at) * noviceMult(levelOf(w.skills[skill]));   // a good meal, tonight's stars; the novice bonus
    xp = Math.round(xp * rate("xp") * (w === s.player ? modeBonus(s, "xp") : 1) * 10) / 10;   // (Hardcore and Hell: more, V16)
    var b = levelOf(w.skills[skill]);
    w.skills[skill] = Math.round((w.skills[skill] + xp) * 10) / 10;
    var a = levelOf(w.skills[skill]);
    if (a > b) note(s, at, (w === s.player ? "You" : who(w)) + " reached " + SKILLS[skill].name + " level " + a + "!");
    classXp(s, w, skill, xp, at);                                       // your class learns from it too (Battle Re-work Part 3)
  }
  // a pet fights with what nature gave it
  var PET_ATTACKS = CONTENT("PET_ATTACKS");
  function petFighter(q) {
    var lv = levelOf(q.xp || 0), g = gearSum(q.gear);
    return { att: Math.max(1, Math.round((1 + lv + Math.round(g.success * 20) + Math.round(geneOff(q, "att") / 3)) * (1 + natureFx(q, "att")))),
             def: Math.max(0, Math.round((Math.floor(lv / 2) + Math.round(g.success * 10) + Math.round(geneOff(q, "def") / 3)) * (1 + natureFx(q, "def")))), maxHit: 2 + Math.floor(lv / 4),
             dtype: PET_ATTACKS[q.species] || "crush", mat: "", style: "accurate" };
  }
  /** You, ready to fight: your weapon, its ammo, your class and gear, and your companion's help. */
  // (Battle Re-work Part 1, 2026-10-15: the weapon that fights is pickWeapon's -- the main, else the off hand's, else fists;
  //  o: {noSpec, noAmmo, fists} for a fighter remade mid-fight, after a break or a swap; B5: a live fight passes noAmmo -- its
  //  bow takes an arrow a shot in battleRound -- and dry: arrows gone falls back to the knife or fists, not "out")
  function playerFighter(s, w, job, at, o) {
    o = o || {};
    var pick = pickWeapon(s, w, o.fists, o);
    if (pick.from === "out") return { out: ITEMS[w.gear.weapon].gear.ammo };     // no arrows and no second weapon: as before
    var tl = talentSum(w);                                              // your class's talents (Battle Re-work Part 3)
    var cb = w.combat || {}, g = gearSum(fightGear(w, pick.id), w.cls, w.enchants), wid = pick.id, wpn = ITEMS[wid], wg = wpn && wpn.gear ? wpn.gear : { att: 0, style: "melee" };
    var style = wg.style || "melee", power = wg.att || 0, wt = WEAPONS[wid] || ["crush", "fist"], mat = wt[1] || "";
    var fist = !wid ? fistGear(w) : "";                                 // spiked gauntlets: what you hit with, not bare fists (Part 5)
    if (fist) { power = ITEMS[fist].gear.fist.att; wt = WEAPONS[fist] || wt; mat = wt[1] || ""; }
    ["att", "def", "maxHit", "acc", "dodge", "brace", "double", "stun", "soak", "trueStrike", "magDmg"].forEach(function (k) { if (tl[k]) g[k] = (g[k] || 0) + tl[k]; });
    var cls = w.cls ? CLASSES[w.cls] : null, spec = null, ammoUse = 0;
    // the special goes off on its own only if you asked it to (2026-10-11, Cam: "The special bar never actually fills and i
    // cannot use the cleave attack") -- otherwise the bar fills and waits for you to press Special in a fight
    var cbs = cb.special ? specOf(w, cb.special) : null;                     // (no class: a weapon's own specials still go -- PT39 f4)              // (V18: a class's, a weapon's or a signature special)
    if (!o.noSpec && cbs && cb.queued && specFits(cls, cbs, style, wid) && specMeter(w, null) >= specCostOf(w, cbs) && !specialLock(w, cbs) && !specUnlockWhy(w, cbs)) spec = cbs;
    if (cb.queued && !o.noSpec) delete cb.queued;                                    // pressed between fights: this fight's first blow
    if (style === "ranged") {
      // a bow needs its ammo: one arrow (or bolt) a fight -- more for some specials
      var am = ITEMS[(w.gear || {}).ammo], dryOut = null;
      if (!am || !am.gear || am.gear.ammo !== wg.ammo) dryOut = { out: wg.ammo };
      else if (w === s.player && quiverWhyNot(w, w.gear.ammo)) dryOut = { out: wg.ammo, why: "Your " + am.name.toLowerCase() + "s need a quiver that holds them" };   // (N19)
      else if (quiverHeld(s, w) < 1) dryOut = { out: wg.ammo, why: w === s.player && needsQuiver(w.gear.ammo) && w.gear.quiver ? "Your " + ITEMS[w.gear.quiver].name.toLowerCase() + " is empty -- load it from your bag" : "" };   // (N24: only what's loaded)
      if (dryOut) {                                                       // B5: run dry mid-fight (or mid-hunt) -- the knife, or fists
        if (o.dry && !o.noMain) { var o2 = copy(o); o2.noMain = true; return playerFighter(s, w, job, at, o2); }
        return dryOut;
      }
      if (!o.noAmmo) {
        ammoUse = 1;
        if (spec && spec.ammo) { if (quiverHeld(s, w) >= spec.ammo) ammoUse = spec.ammo; else spec = null; }
        if (tl.ammoSave && job && typeof job.seed === "number" && rnd(job) < tl.ammoSave) ammoUse = 0;   // Quiver craft: this one's free
        if (ammoUse) takeArrows(s, w, ammoUse);                            // (N24: out of the quiver)
        if (job) { job.used = job.used || {}; job.used[w.gear.ammo] = (job.used[w.gear.ammo] || 0) + ammoUse; }
      }
      power += am.gear.power + g.rng;
      mat = w.gear.ammo.replace(/(arrow|bolt)$/, "");
    }
    var lvl = levelOf(w.skills[style === "ranged" || wg.knife ? "ranged" : style === "magic" ? "magic" : "attack"] || 0);   // a hunting knife: the Ranged hand (Part 4)
    if (style === "magic") { power += g.mag + 2 * (s.mageRank || 0); mat = ""; wt = [wg.wand ? "crush" : "crush", wg.wand ? "fist" : "wood"]; }
    var me = { att: lvl + power + g.att - (style !== "melee" ? g.armAtt : 0), def: levelOf(w.skills.defence || 0) + g.def, maxHit: 2 + Math.floor((lvl + power) / 4) + g.maxHit, hp: w.hp,
               dtype: wt[0], mat: mat, style: STYLES[cb.style] ? cb.style : "accurate", spec: spec,
               resist: cls ? cls.resist : null, weak: cls ? cls.weak : null,
               trueStrike: g.trueStrike, brace: g.brace, dodge: Math.min(0.5, g.dodge), regen: g.regen, reflect: g.reflect,
               acc: g.acc, stun: g.stun, double: g.double, dr: armourCut(g.def), soak: Math.floor(g.soak + 1e-9),
               wname: wpn && !wg.wand ? wpn.name : "fists",                   // what you hit with, for the fight's messages
               wid: wid || "", wfrom: pick.from, tal: tl };                            // and which weapon wears (Battle Re-work)
    if (wg.slow) { me.slow = true; me.heavy = wg.heavy || 1; me.stunBig = wg.stunBig || 0; me.bigStun = wg.bigStun || 0; }   // a maul
    if (fist) { var fg = ITEMS[fist].gear.fist; me.wname = ITEMS[fist].name; me.onHit = { bleed: fg.bleed, chance: fg.bleedChance }; }
    var bc = brewOf(s, "combat");                                       // a combat potion
    if (bc) { me.att += style === "ranged" ? bc.rng || 0 : bc.att || 0; me.def += bc.def || 0; me.maxHit += bc.maxHit || 0; }
    if (cls && clsFits(cls, style)) { me.att = Math.round(me.att * 1.2); me.maxHit += 1; }   // your class's own way (a Thief: two ways)
    me.att = Math.max(1, me.att + styleAccOf(g, cls, style));               // armour weights: style accuracy and class fit (V17)
    var dby = defByOf(g, g.def); me.defBy = dby.by; me.drBy = dby.dr;        // and Defence by kind of attack
    if (w === s.player) me.dual = dualOf(s, w, pick.from);                    // dual daggers (Part 7), two swords (Part 8)
    var shd = w === s.player ? shieldOf(s, w) : "";
    if (shd || tl.block) me.block = Math.min(0.6, (shd ? (ITEMS[shd].gear.block || 0) * (w.cls === "paladin" ? 1 : TECHNIQUES.offClass) : 0) + (tl.block || 0));   // a shield's block (Part 8; another class's buckler: 60%)
    if (spec && !o.noSpec) specPay(w, null, specCostOf(w, spec));      // the special bar, or a Berserker's fury
    var c = companion(s, at);
    if (c && c.kind === "ram/billy") me.petHit = 1 + Math.floor(c.level / 5);   // Billy fights at your side
    var fbb = c ? petBuffs(s.pet.species).filter(function (x) { return FIGHT_BOOSTS[x.skill]; })[0] : null;
    var fb = fbb && fbb.skill, fbv = fb ? Math.round(boostFor(s.pet, fb, at) * 10) : 0;   // 1 or 2 (a mod's buff: more)
    if (fbv) {
      if (fb === "maxhit") me.maxHit += fbv;
      else if (fb === "defence") me.def += 2 * fbv;
      else if ((fb === "ranged") === (style === "ranged")) me.att += 2 * fbv;
    }
    if (style === "magic") {                                            // spells, round by round; when out of runes, a bash
      me.magic = { lvl: lvl, att: me.att, dmg: g.magDmg + (cls && cls.style === "magic" ? 1 : 0), element: wg.element || "", wand: !!wg.wand,
                   bash: wg.wand ? 1 : wg.battle ? 2 + Math.floor((lvl + wg.bashAtt) / 4) : 1 + Math.floor(power / 6), bashId: wg.wand ? "" : wid };
      if (wg.battle) { me.magic.bashName = wpn.name; me.magic.bashType = "crush"; }      // a battle staff: a real blow, with your Magic (Part 6)
      me.elemEl = wg.element || ""; me.elemBoost = wg.elemBoost || 0; me.burnPow = wg.burnPow || 0; me.slowRounds = wg.slowRounds || 0; me.drain = wg.drain || 0;
      // out of runes with a melee weapon in the off hand: you fight with that (Battle Re-work, 2026-10-15)
      var offB = (w.gear || {}).offhand, ob = isWeapon(offB) && ITEMS[offB].gear;
      if (pick.from === "main" && ob && ob.style !== "magic" && ob.style !== "ranged" && !weaponWhyNot(s, w, offB)) {
        var alv = levelOf(w.skills.attack || 0);
        me.magic.bash = Math.max(me.magic.bash, 2 + Math.floor((alv + (ob.att || 0)) / 4));
        me.magic.bashId = offB; me.magic.bashName = ITEMS[offB].name; me.magic.bashType = (WEAPONS[offB] || ["crush"])[0];
      }
      me.maxHit = me.magic.bash;
    }
    return { me: me, style: style, ammo: ammoUse };
  }
  /** Your companion, if it's at your side (hatched, at home): its kind and level. */
  function companion(s, at) {
    var p = s.pet;
    if (!p || p.away || at < p.hatchAt) return null;
    return { kind: p.species + "/" + p.colour, level: levelOf(p.xp || 0), name: who(p) };
  }
  // Gideon steals: once a fight, more as he levels; from a boss, sometimes that area's egg
  function companionSteal(s, job, mon, ground, at) {
    var c = companion(s, at);
    if (!c || c.kind !== "fox/gideon") return;
    if (mon.boss) {
      if (ground.egg && rnd(job) < 0.25) {
        give(s, ground.egg + "egg", 1);
        job.items[ground.egg + "egg"] = (job.items[ground.egg + "egg"] || 0) + 1;
        note(s, at, c.name + " stole " + aOr(EGGS[ground.egg].name) + " from " + mon.name + "!");
      }
      return;
    }
    var steals = 1 + Math.floor(c.level / 10);
    for (var i = 0; i < steals; i++) {
      var d = mon.drops[Math.floor(rnd(job) * mon.drops.length)];
      give(s, d[0], d[1]);
      job.items[d[0]] = (job.items[d[0]] || 0) + d[1];
      job.stolen = (job.stolen || 0) + d[1];
    }
  }
  // Coins from fights (2026-10-06, Cam: "add coins as drops from monsters ensure you keep it
  // balance economically"). A fall now costs every coin you carry, so creatures pay a little to
  // start again with -- more the further out, so the dangerous areas earn the most an hour
  // (measured: drops alone sold for 300-670 an hour and the Farmyard paid best). [least, most] a kill.
  // the purse a kill drops (Battle Re-work Part 2, 2026-10-15: lowered so hunting pays ~1.4x the best gathering at its level,
  // counting what the drops sell for -- it was 2-6x; tools/balance/classes.js measures it. Cam: "money from hunting is more
  // profitable then gathering", so farming creatures should be slower)
  var AREA_COINS = CONTENT("AREA_COINS");
  var BOSS_PURSE = CONTENT("BOSS_PURSE");
  function purse(table, groundId, r) {
    var c = table[groundId];
    return c ? c[0] + Math.floor(r * (c[1] - c[0] + 1)) : 0;
  }
  var BOSS_UNLOCKS = CONTENT("BOSS_UNLOCKS");
  // Balance audit (2026-10-05): the full kill count is a one-time unlock. After the first challenge, a
  // rematch needs only a short count (a twentieth of it, 10 to 25), win or lose.
  function rematchKills(ground) { return Math.max(10, Math.min(25, Math.round(ground.kills / 20))); }
  function bossUnlocked(hl) { return !!(hl && (hl.unlocked || hl.wins > 0 || hl.losses > 0)); }
  /** Kills still wanted before the area's boss shows up: the full count the first time, a short one after. */
  function bossNeed(ground, hl) { return bossUnlocked(hl) ? rematchKills(ground) : ground.kills; }
  /** Challenge an area's boss -- once you've killed enough there. Win or lose, the count starts again. */
  /** A hunt at a ground, starting now: the job the hunt action and a won boss fight both start. */
  function huntJob(ground, at, seed) {
    return { skill: "attack", spot: ground, hunt: ground, since: at, next: at + FIGHT_GAP, until: at + JOB_MAX, every: HUNTS[ground].time * 1000,
             seed: seed | 0, count: 0, xp: 0, items: {}, kills: {} };
  }
  /** After beating a boss, straight back to hunting there (2026-10-11, Cam: "when beating the boss i cannot just roll back
      into hunting in the hunting grounds ... i want it to roll straight back into hunting") -- unless you're too hurt. */
  function resumeHunt(s, pl, ground, at, seed) {
    var hg = HUNTS[ground];
    if (!hg || pl.job || pl.battle || pl.dead) return;
    autoEat(s, pl, 50, at, areaWorst(hg, guardOf(pl)));
    if (mustFlee(pl, areaWorst(hg, guardOf(pl)))) { note(s, at, "Too hurt to hunt on in the " + hg.name + " -- rest or eat, then hunt again."); return; }
    pl.job = huntJob(ground, at, seed);
    note(s, at, "Back to hunting in the " + hg.name + ".");
  }
  function bossFight(s, o, now) {
    var ground = HUNTS[o.ground];
    if (!ground || !ground.boss) return no(s, "There's no boss there.");
    // the Yeti lives at the Summit: you earn it in the Foothills, you fight it up there (2026-10-08)
    if (o.ground === "frostpeak" && REGIONS.summit && regionLock(s, "summit")) return no(s, "The Yeti lives at the Summit -- " + regionLock(s, "summit").charAt(0).toLowerCase() + regionLock(s, "summit").slice(1) + ".");
    var mon = MONSTERS[ground.boss], hl = s.hunt[o.ground] = s.hunt[o.ground] || { kills: 0, wins: 0, losses: 0 };
    if (combatLevel(s.player) < ground.level) return no(s, "The " + ground.name + " needs combat level " + ground.level + ".");
    var need = bossNeed(ground, hl);
    if (hl.kills < need) return no(s, mon.name + " shows up after " + need + " kills in the " + ground.name + " (" + hl.kills + " so far).");
    var pl = s.player;
    if (pl.battle && pl.battle.kind !== "hunt") return no(s, "You're already in a fight.");   // a hunt's fight: you walk away from it (no gap between fights now)
    healTo(pl, now);
    autoEat(s, pl, 50, now, worstHit(mon, guardOf(pl)));
    if (mustFlee(pl, worstHit(mon, guardOf(pl)))) return no(s, "You're too hurt to face " + mon.name + " -- rest or eat first.");
    var holder = { seed: typeof o.roll === "number" ? Math.floor(o.roll * 4294967296) | 0 : (now | 0) };
    if (pl.job) endTrip(s, pl, now, "stop");                            // you stop hunting to face the boss
    var st = startBattle(s, pl, "boss", o.ground, ground.boss, now, holder);
    if (st.out) return no(s, st.why ? st.why + "." : "You've no " + st.out + "s for your bow.");
    if (o.manual) { pl.battle.manual = true; pl.battle.nextRound = MANUAL_WAIT; }
    return yes(s, now, mon.name + " appears -- the fight is on!" + (o.manual ? " Your move." : ""));
  }
