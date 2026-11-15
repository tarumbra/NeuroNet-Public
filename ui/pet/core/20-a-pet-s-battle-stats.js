  // ---- a pet's battle stats, and an expedition as a run (2026-10-06) -------------------------
  /** Is an area open? The first five by pet level; each later one once the one before it has
      been cleared, by any pet (Cam: "the further we travel and play the more unlocks we achieve"). */
  function areaLock(s, area) {
    if (area === "ocean" && shipTier(s) < 2) return "The ocean needs a sailboat -- build one at the Shipyard on the Coast.";   // (2026-10-08)
    var i = AREA_ORDER.indexOf(area), a = AREAS[area];
    if (i < 0 || a.level < 20) return "";
    var prev = AREA_ORDER[i - 1];
    return ((s.cleared || {})[prev] || 0) > 0 ? "" : "The " + a.name + " opens once a pet has cleared the " + AREAS[prev].name + ".";
  }
  /** A pet lost on an expedition (2026-10-06): it goes to the Graveyard -- its name, kind, level,
      age, where and how it fell -- with what it wore. You choose another from the den, or hatch one. */
  function petDies(s, p, at, area, cause) {
    s.graveyard = s.graveyard || [];
    s.graveyard.unshift({ name: who(p), kind: kindName(p), species: p.species, colour: p.colour, rarity: rarityOf(p),
                          level: levelOf(p.xp || 0), ageDays: Math.max(0, Math.round((at - p.hatchAt) / DAY * 10) / 10),
                          area: AREAS[area].name, cause: cause, at: at, cleared: Object.keys(p.areas || {}).length,
                          gear: Object.keys(p.gear || {}).map(function (k) { return ITEMS[p.gear[k]] ? ITEMS[p.gear[k]].name : p.gear[k]; }),
                          pet: copy(p) });                                // the whole pet, for raising later (Battle Re-work)
    if (s.graveyard.length > 200) s.graveyard.length = 200;
    s.pet = null;
  }
  /** A pet as it fights: level, kind, rarity, care, what it wears and any draughts it drank. */
  function runFighter(p, brews) {
    var L = Math.max(1, levelOf(p.xp || 0)), A = FIGHT_STYLE[p.species] || {}, g = gearSum(p.gear), rar = RARITY_POWER[rarityOf(p)] || 1;
    var hp = Math.round((20 + 4 * L) * (A.hp || 1) * rar * (1 + geneOff(p, "hp") * 0.01 + natureFx(p, "hp"))) + (g.hp || 0);   // potential, nature (2026-10-08)
    var me = { hp: hp, att: Math.max(1, (2 + L + (A.att || 0) + g.att + Math.round(geneOff(p, "att") / 3)) * (1 + natureFx(p, "att"))),
               def: Math.max(0, (1 + Math.floor(L * 0.6) + g.def + Math.round(geneOff(p, "def") / 3)) * (1 + natureFx(p, "def"))),
               dodge: Math.max(0, Math.min(0.45, (A.agi || 0) * 0.04 + (g.dodge || 0) + geneOff(p, "agi") * 0.002 + natureFx(p, "dodge"))), maxHit: 2 + Math.floor(L / 4) + Math.floor((A.att || 0) / 2) };
    var st = p.s || {};
    if (st.happy >= 75) me.att += 1;                                  // a happy pet fights better
    if (st.full < 40) me.hp = Math.round(me.hp * 0.85);              // a hungry one wears out sooner
    if (st.health < 50) me.hp = Math.round(me.hp * 0.8);
    Object.keys(brews || {}).forEach(function (k) {
      var b = ITEMS[k] && ITEMS[k].petbrew; if (!b) return;
      if (b.hp) me.hp = Math.round(me.hp * (1 + b.hp));
      me.att += b.att || 0; me.def += b.def || 0; me.dodge = Math.min(0.5, me.dodge + (b.dodge || 0));
    });
    me.att = Math.round(me.att); me.def = Math.round(me.def);
    return me;
  }
  function packHeal(id) { var it = ITEMS[id]; return it && it.heal ? Math.round(it.heal * TUNE.foodHeal) : 0; }   // cooked food goes further for a pet
  /** One fight on the road. The pet eats from its pack when it's hurt (that's its move). */
  function runFight(job, foe, know) {
    var me = job.me, fhp = foe[1], rounds = 0, ate = 0;
    know = know || { hit: 0, dmg: 0 };
    while (fhp > 0 && job.hp > 0 && rounds < 40) {
      rounds++;
      var food = job.hp < job.maxHp * 0.4 && Object.keys(job.pack).filter(function (k) { return packHeal(k) && job.pack[k] > 0; })
        .sort(function (a, b) { return packHeal(b) - packHeal(a); })[0];
      if (food) { job.pack[food]--; job.used[food] = (job.used[food] || 0) + 1; job.hp = Math.min(job.maxHp, job.hp + packHeal(food)); ate++; }
      else if (rnd(job) < Math.min(0.97, chance(me.att, foe[3]) * (1 + know.hit))) fhp -= 1 + Math.floor(rnd(job) * me.maxHit) + know.dmg;
      if (fhp <= 0) break;
      if (rnd(job) < chance(foe[2], me.def) && !(me.dodge && rnd(job) < me.dodge))
        job.hp -= Math.max(1, 1 + Math.floor(rnd(job) * foe[4]) - Math.floor(me.def / TUNE.armourCut));
    }
    return { won: fhp <= 0 && job.hp > 0, rounds: rounds, ate: ate };
  }
  /** The next stage of a run, at `at`. */
  function runStage(s, at) {
    var p = s.pet, job = p.away, a = AREAS[job.area], R = RUNS[job.area], last = job.stage === job.stages - 1, line = "";
    var roll = rnd(job), kind = last ? "guardian" : roll < 0.65 ? "fight" : roll < 0.85 ? "hazard" : "find";
    if (kind === "fight" && job.scout && rnd(job) < 0.12 * job.scout) kind = "find";   // a scout finds a way round (2026-10-10)
    var loot = function (n) {
      for (var i = 0; i < n; i++) {
        var it = pick(job, a.loot);
        if (HERB_TIER_OF[it]) {                                         // unidentified, by how hard the area is
          job.herbs = job.herbs || {}; var hh = wildHerb(job, it, a.level); job.herbs[hh] = (job.herbs[hh] || 0) + 1; it = "unidherb";
        }
        job.got[it] = (job.got[it] || 0) + 1;
        if (job.hauler && it !== "unidherb" && rnd(job) < Math.min(0.9, 0.4 * job.hauler)) job.got[it]++;   // a hauler carries more home
      }
    };
    if (kind === "fight" || kind === "guardian") {
      var foe = kind === "guardian" ? R.guardian : R.foes[Math.floor(rnd(job) * R.foes.length)];
      // the Scout's tower: too hurt for the guardian? home first, unhurt
      if (kind === "guardian" && campLevel(s, "scout") && job.hp < 0.5 * job.maxHp) {
        job.log.push({ t: at, stage: job.stage + 1, text: "Scouted the " + foe[0].toLowerCase() + " and turned back", hp: job.hp });
        job.stage++;
        return endRun(s, at, "scouted");
      }
      var f = runFight(job, foe, knowing(s, foe[0]));
      s.bestiary = s.bestiary || {};
      var bx = s.bestiary[foe[0]] = s.bestiary[foe[0]] || { met: 0, beaten: 0, felled: 0, area: job.area, guardian: kind === "guardian" };
      bx.met++; if (f.won) bx.beaten++; else bx.felled++;
      if (f.won) { loot(kind === "guardian" ? 2 : 1); job.xp += Math.round(a.xp / job.stages * (kind === "guardian" ? 1.5 : 1)); }
      line = (f.won ? "Beat " : "Fell to ") + (kind === "guardian" ? "the guardian, " : "a ") + foe[0].toLowerCase() + (f.ate ? " (ate " + f.ate + ")" : "");
      if (!f.won) job.lastBlow = "fell to " + (kind === "guardian" ? foe[0] : "a " + foe[0].toLowerCase());
    } else if (kind === "hazard") {
      var hz = R.hazards[Math.floor(rnd(job) * R.hazards.length)];
      if (rnd(job) < job.me.dodge + job.me.def / (job.me.def + 20) + 0.15 * (job.scout || 0)) line = "Got past " + hz;
      else { var d = Math.max(1, Math.round(R.trap * (1 - job.me.def / (job.me.def + 30)))); job.hp -= d; line = "Hurt by " + hz + " (-" + d + ")"; job.lastBlow = "was caught by " + hz; }
    } else { loot(2); line = "Found something"; }
    job.log.push({ t: at, stage: job.stage + 1, text: line, hp: Math.max(0, job.hp) });
    job.stage++;
    if (job.hp <= 0) return endRun(s, at, "fell");
    if (last) return endRun(s, at, "cleared");
    if (job.hp < job.retreat * job.maxHp) return endRun(s, at, "retreated");
    job.until = at + job.every;
  }
  /** Home: the finds, the unused pack back in the bag, and whatever happened to the pet. */
  function endRun(s, at, how) {
    var p = s.pet, job = p.away, a = AREAS[job.area], R = RUNS[job.area], got = job.got, injury = "";
    partyHome(s, job, at, how);                                         // the party comes home with it (2026-10-10)
    var findMore = 1 + 0.5 * (job.scout || 0);
    if (how === "cleared") {
      s.cleared = s.cleared || {};
      var firstClear = !s.cleared[job.area];
      s.cleared[job.area] = (s.cleared[job.area] || 0) + 1;
      var nextArea = AREA_ORDER[AREA_ORDER.indexOf(job.area) + 1];
      if (firstClear && nextArea && AREAS[nextArea].level >= 20) note(s, at, "The " + AREAS[nextArea].name + " is open now -- for every pet.");
      var relics = R.deadly ? 1 + (rnd(job) < (a.level - 20) / 30 ? 1 : 0) : job.area === "caves" && rnd(job) < 0.3 ? 1 : 0;
      if (relics) got.relic = (got.relic || 0) + relics;
      if (rnd(job) < a.crate[1] * 2 * findMore) got[a.crate[0]] = (got[a.crate[0]] || 0) + 1;
      if (rnd(job) < a.egg[1] * 2 * findMore) got[a.egg[0]] = (got[a.egg[0]] || 0) + 1;
      expeditionLockDrop(s, a, got, job, findMore);                        // a locked crate, for the Keen Eye (the Marketplace, 2026-10-17)
      p.areas = p.areas || {};
      var mb = mastery(p, job.area);
      p.areas[job.area] = (p.areas[job.area] || 0) + 1;
      if (mastery(p, job.area) > mb) note(s, at, "The " + a.name + " is now area level " + mastery(p, job.area) + ".");
    }
    var dies = how === "fell" && R.deadly && rnd(job) < R.deadly && modeOf(s) !== "adventure";   // one roll (never in Adventure)
    var phoenix = dies && campLevel(s, "phoenix") && !(s.camp.phoenixAt > at - DAY);
    if (phoenix) {                                                      // the Phoenix shrine: not today
      s.camp.phoenixAt = at;
      note(s, at, "The Phoenix shrine brought " + who(p) + " home from the " + a.name + " -- gravely hurt, but alive. (It wakes again in a day.)");
    } else if (dies) {                                                  // the later areas: a fall can be the end
      giveFound(s, got, job.herbs);                                     // (what it found still comes home, carried by others)
      note(s, at, who(p) + " died in the " + a.name + ", at stage " + job.stage + " of " + job.stages + ". " +
                  who(p) + " was level " + levelOf(p.xp || 0) + ". Rest in the Graveyard.");
      petDies(s, p, at, job.area, (job.lastBlow || "fell") + " in the " + a.name + ", stage " + job.stage + " of " + job.stages);
      return;
    }
    if (how === "fell") injury = R.fall;
    else if (how === "retreated" && job.hp < 0.15 * job.maxHp) injury = "light";
    giveFound(s, got, job.herbs);
    Object.keys(job.pack).forEach(function (k) { if (job.pack[k] > 0) give(s, k, job.pack[k], true); });   // what you packed always comes home
    var treated = "";
    if (injury) {
      p.injury = { sev: injury, at: at, treatedAt: null };
      // a strong enough medicine in the pack is used on the spot: healing starts at once
      var med = Object.keys(job.pack).filter(function (k) { return job.pack[k] > 0 && ITEMS[k].treats && INJURIES[ITEMS[k].treats].rank >= INJURIES[injury].rank; })
        .sort(function (x, y) { return INJURIES[ITEMS[x].treats].rank - INJURIES[ITEMS[y].treats].rank; })[0];
      if (med) { take(s, med); treatInjury(s, p, med, at); treated = ITEMS[med].name; }
    }
    var before = levelOf(p.xp || 0);
    var xp = Math.round(job.xp * (1 + gearSum(p.gear).expXp));
    p.xp = (p.xp || 0) + xp;
    var said = how === "cleared" ? "cleared the " + a.name : how === "fell" ? "fell in the " + a.name : how === "retreated" ? "came home hurt from the " + a.name
      : how === "scouted" ? "turned back before the " + a.name + "'s guardian"
      : "was called back from the " + a.name;
    note(s, at, who(p) + " " + said + " (" + Math.min(job.stage, job.stages) + "/" + job.stages + " stages)" +
                (Object.keys(got).length ? " with " + itemsText(got) : "") + ". +" + xp + " xp." +
                (Object.keys(got).some(function (k) { return ITEMS[k] && ITEMS[k].egg; }) ? " Put the egg in the Hatchery (NeuroPets → Hatchery)." : "") +
                (injury ? " " + who(p) + " has " + INJURIES[injury].name + (treated ? " -- treated with the " + treated.toLowerCase() + " in its pack."
                  : " and won't heal until it's treated (Apothecary table).") : ""));
    if (levelOf(p.xp) > before) note(s, at, who(p) + " reached level " + levelOf(p.xp) + "!");
    p.lastExp = { area: job.area, at: at, won: how === "cleared", how: how, items: got, xp: xp, injured: !!injury, injury: injury,
                  stages: job.stages, reached: Math.min(job.stage, job.stages), log: job.log.slice(-12), used: job.used };
    p.away = null;
  }
  /** Treat an injury: healing starts now (a quick balm: in half the time). */
  function treatInjury(s, p, id, at) {
    var inj = p.injury, h = INJURIES[inj.sev].heal * (ITEMS[id].quick ? 0.5 : 1) * (1 - 0.2 * campLevel(s, "healer"));
    inj.treatedAt = at;
    p.injuredUntil = at + h;
  }
  /** Can the pet go out? "" or why not. */
  function injuryBlock(p, now) {
    var inj = p.injury;
    if (inj && inj.treatedAt && !(p.injuredUntil > now)) { p.injury = null; inj = null; }   // healed
    if (inj && !inj.treatedAt) return who(p) + " has " + INJURIES[inj.sev].name + " and won't heal until it's treated -- " +
      (inj.sev === "light" ? "a herbal poultice or stronger" : inj.sev === "serious" ? "a healing salve or stronger" : "a strong salve or a restorative balm") + " (Apothecary table).";
    if (p.injuredUntil && p.injuredUntil > now) return who(p) + " is healing for " + Math.ceil((p.injuredUntil - now) / MIN) + " more minutes.";
    return "";
  }
  function resolve(s, at) { return runStage(s, at); }

  /** The state walked forward to `now` (a new object; the old is untouched). */
  function advance(state, now) {
    var s = normal(state);
    var p = s.pet, start = now;
    if (p && p.at < now) {
      if (now - p.at > CATCH_UP) p.at = now - CATCH_UP;
      start = Math.min(start, p.at);
    }
    if (s.player.job && s.player.job.next <= now) start = Math.min(start, s.player.job.since);
    s.den.forEach(function (d) { if (d.job && d.job.next <= now) start = Math.min(start, d.job.since); });
    s.hatchery.forEach(function (h) { if (h.hatchAt <= now) start = Math.min(start, h.hatchAt); });
    if (s.breeding && s.breeding.until <= now) start = Math.min(start, s.breeding.until);
    if (s.player.battle && s.player.battle.nextRound <= now) start = Math.min(start, s.player.battle.nextRound);
    if (s.player.explore && s.player.explore.until <= now) start = Math.min(start, s.player.explore.until);
    s.farm.plots.forEach(function (pl) { if (pl.state === "growing" && pl.watered && pl.stageAt <= now) start = Math.min(start, pl.stageAt); });
    (s.farm.pots || []).forEach(function (pt) { if (pt.herb && !pt.ready && pt.readyAt <= now) start = Math.min(start, pt.readyAt); });
    var pl = s.player;
    if (typeof pl.at !== "number") pl.at = now;                    // your own clock: healing
    if (pl.at < now) start = Math.min(start, Math.max(pl.at, now - CATCH_UP));
    // the pet and any trip, side by side: a trip's finds use the pet's mood then
    for (var t = start; t < now;) {
      var e = Math.min(now, t + STEP);
      if (p && p.away && p.away.until > t && p.away.until < e) e = p.away.until;   // back exactly on time
      if (p && p.at < e) step(s, e - p.at);
      if (p && p.away && p.away.until <= e) { resolve(s, p.away.until); p = s.pet; }   // a run can end in a death (2026-10-06)
      if (s.player.job && !s.player.dead) runTrip(s, s.player, e);
      if (s.player.explore && s.player.explore.until <= e) resolveExplore(s, s.player.explore.until);
      if (s.player.battle && s.player.battle.kind === "boss" && !s.player.dead) {
        runBoss(s, e);
        // a won boss fight starts a hunt there (2026-10-11): let it run in this same step, or a long catch-up never gets to it
        if (!s.player.battle && s.player.job && !s.player.dead) runTrip(s, s.player, e);
      }
      healTo(pl, e);
      for (var di = 0; di < s.den.length; di++) if (s.den[di].job) runTrip(s, s.den[di], e);
      growFarm(s, e);
      layDue(s, e);
      hatchDue(s, e);
      t = e;
    }
    healTo(pl, now);
    resolveHome(s, now);                                               // a book read, research done (2026-10-08)
    resolveShip(s, now);                                               // a ship's part built, a voyage ended
    resolveRecycle(s, now);
    graveTick(s, now);                                                 // a gravestone crumbles at its hour (V16)                                            // the recycle stash's lots broken down (2026-10-11)
    resolveCart(s, now);                                               // the cart back from Marlow, with the coins
    resolveRanch(s, now);                                              // the Farm's animals (2026-10-12)
    resolvePen(s, now);                                                // battle pets in training (Part 11a)
    flushLost(s, now);
    return s;
  }

  /** You: your name and look, your skills, the trip you're on. From an advanced state. */
  function playerView(state, now) {
    var pl = (state && state.player) || newPlayer(), pet = state && state.pet;
    var skills = {}, total = 0;
    SKILL_ORDER.forEach(function (k) {
      var xp = pl.skills[k] || 0, lv = levelOf(xp);
      var lo = XP[lv], hi = lv >= MAX_LEVEL ? lo : XP[lv + 1];
      skills[k] = { name: SKILLS[k].name, xp: Math.floor(xp), level: lv, toNext: lv >= MAX_LEVEL ? 0 : Math.ceil(hi - xp),
                    progress: lv >= MAX_LEVEL ? 1 : (xp - lo) / (hi - lo), boost: boostFor(pet, k, now),
                    spots: SKILLS[k].spots.filter(function (sp) { return !sp.secret || ((state && state.world && state.world.found) || {})[sp.secret]; }).map(function (sp) { var lock = spotLock(state, k, sp);
                      return { id: sp.id, name: sp.name, level: sp.level, time: sp.time, xp: sp.xp, area: sp.area, essence: !!sp.essence, open: !lock, lock: lock,
                               method: sp.method || "", needs: sp.needs || "", hand: !!sp.hand, bait: sp.bait || "", toolTier: sp.toolTier || 0, main: sp.loot[0][0],
                               missing: state ? tripNeeds(state, k, sp) : "",
                               // wear a find here costs your tool (0: none) -- it climbs with each tier above it (2026-10-07)
                               wears: !sp.essence && !!pl.tools[k] && toolTierOf(state || {player: pl, bag: {}}, k) >= 0
                                      ? wearFor(gradeOf(sp.loot[0][0], sp) - (ITEMS[pl.tools[k]].tool.tier == null ? 1 : ITEMS[pl.tools[k]].tool.tier)) : 0,
                               loot: sp.loot.map(function (l) { return l[0]; }), rare: sp.rare ? sp.rare[0] : "" }; }) };
      total += lv;
    });
    var j = pl.job, job = null;
    if (j) {
      job = jobView(j, now);
      job.boost = j.hunt ? 0 : boostFor(pet, j.skill, now);
    }
    var tools = {};
    Object.keys(pl.tools || {}).forEach(function (k) {
      var id = pl.tools[k], t = ITEMS[id];
      if (!t) return;
      var dur = toolDur(id), used = (pl.wear || {})[id] || 0, rc = t.tool && !t.tool.stone ? repairCost(id) : null;
      tools[k] = { id: id, name: t.name, does: describe(id), dur: dur, left: Math.max(0, dur - used), worn: used, stone: !!(t.tool && t.tool.stone),
                   count: ((state && state.bag) || {})[id] || 0,
                   repair: rc && used ? { where: WORKSHOPS[rc.ws].name, needs: itemsText(rc.needs), fee: rc.fee,
                                          can: Object.keys(rc.needs).every(function (n) { return (((state && state.bag) || {})[n] || 0) >= rc.needs[n]; }) && ((state && state.coins) || 0) >= rc.fee } : null };
    });
    return { island: pl.island || "", islandName: pl.island && ISLANDS[pl.island] ? ISLANDS[pl.island].name : "", ship: shipTier(state || {}),
             voyage: pl.voyage ? { to: pl.voyage.to, toName: pl.voyage.to ? ISLANDS[pl.voyage.to].name : "home", endsIn: Math.max(0, Math.ceil((pl.voyage.until - now) / 1000)) } : null,
             name: pl.name || "You", made: !!pl.made, look: pl.look, skills: skills, totalLevel: total, job: job, coins: (state && state.coins) || 0,
             tools: tools, gear: gearView(pl.gear, PLAYER_SLOTS, state, "player"), worn: gearSum(pl.gear, pl.cls, pl.enchants), room: (state && state.room) || {},
             lastTrip: pl.lastTrip, companionSkill: pet && pet.hatchAt <= now ? (petBuffs(pet.species)[0] || {}).skill || "" : "", companionDoes: pet && pet.hatchAt <= now ? boostText(pet.species) : "",
             hp: Math.floor(pl.hp), maxHp: maxHp(pl), combatLevel: combatLevel(pl), retreat: pl.retreat, brews: (function () { var o = {}; Object.keys(pl.brews || {}).forEach(function (k) { var b = pl.brews[k];
               if (b && b.left > 0 && ITEMS[b.id]) o[k] = { id: b.id, name: ITEMS[b.id].name, left: b.left, does: brewText(ITEMS[b.id].brew) }; }); return o; })(), food: pl.food || "", eatBelow: pl.eatBelow || EAT_BELOW, regen: regenRate(pl), armourCut: armourCut(gearSum(pl.gear, pl.cls).def), dead: pl.dead || null,
             cls: pl.cls || null, combat: pl.combat || { style: "accurate", special: "" }, spec: Math.round(pl.spec || 0),
             skin: (function () { var ss = gearSum(pl.gear).sets; return Object.keys(ss).filter(function (k) { return ss[k] >= 3; })[0] || ""; })(),
             ally: (function () { var c = state && companion(state, now); if (!c) return null;
               if (c.kind === "fox/gideon") return { name: c.name, does: "steals " + (1 + Math.floor(c.level / 10)) + " thing" + (c.level >= 10 ? "s" : "") + " from each animal you beat; from bosses, sometimes their area's egg" };
               if (c.kind === "ram/billy") return { name: c.name, does: "fights at your side for " + (1 + Math.floor(c.level / 5)) + " damage a round" };
               return null; })(),
             lastBoss: (state && state.lastBoss) || null,
             // the risen with you on this hunt, between fights too (PT24 f1)
             huntRisen: state && pl.job && pl.job.hunt && pl.job.risen ? pl.job.risen.map(function (id) { var b = beastById(state, id); return b && b.risen ? { id: id, name: who(b), species: b.species, colour: b.colour, level: beastLevel(b), hp: Math.round(risenHp(b)), maxHp: risenMax(b) } : null; }).filter(Boolean) : [],
             lastFall: (state && state.lastFall) || null,
             battle: (function () { var b = pl.battle; if (!b) return null; var m = MONSTERS[b.mon], cc = pl.cls ? CLASSES[pl.cls] : null;
               var spc = specOf(pl, (pl.combat || {}).special), bwid = (b.me || {}).wid;   // (V18; no class needed for a weapon's own, PT39 f4)
               return { kind: b.kind, ground: b.ground, groundName: HUNTS[b.ground].name, mon: b.mon, monName: m.name, boss: !!m.boss, mhp: Math.max(0, Math.ceil(b.mhp)),
                        monHp: m.hp, n: b.n, start: b.start, nextIn: b.manual ? 0 : Math.max(0, b.nextRound - now), round: ROUND, rounds: b.rounds.slice(-8),
                        queued: b.queued, skip: b.skip, style: b.style, manual: !!b.manual, tell: b.tell ? { move: b.tell.move, wind: b.tell.wind, answers: BOSS_TELLS.answers } : null, cast: b.cast || "", duel: b.duel || 0, pyramid: b.pyramid || 0,
                        danger: !b.pack && (pl.hp || 0) <= worstHit(m, b.me || {}, b.rage), noRun: !autoRuns(b), pack: state ? packView(state, pl, b) : null,
                        // a Necromancer's risen, beside you with their health (Cam, PT19 r3/r4: "Have the pets image appear beside me ... Couldnt see toms health")
                        risen: (b.risen || []).map(function (p) { return { id: p.id, name: p.name, species: p.species, colour: p.colour, level: p.level, hp: Math.max(0, Math.round(p.hp)), maxHp: p.maxHp }; }),
                        special: spc ? { name: spc.name, cost: specCostOf(pl, spc), ready: specMeter(pl, b) >= specCostOf(pl, spc) && specFits(cc, spc, b.style, bwid) && !specialLock(pl, spc) && !specUnlockWhy(pl, spc), fits: specFits(cc, spc, b.style, bwid) } : null, smoke: b.smoke || 0,
                        // every special of your class, for the fight's Specials menu (PT7, Cam: "switch specials easier then having to scroll")
                        specials: specLoadout(pl).map(function (k) { var x = specOf(pl, k), c = specCostOf(pl, x);   // your side bar's (V18)
                          var fit = specFits(cc, x, b.style, bwid), lk = specialLock(pl, x) || specUnlockWhy(pl, x) || (!fit ? x.name + " needs " + (x.item ? "the " + ITEMS[x.item].name.toLowerCase() : x.family ? aOr(SPECIALS.families[x.family].name.toLowerCase()) : x.style === "ranged" ? "a bow" : "a melee weapon") + "." : "");
                          return { id: k, name: x.name, cost: c, lock: lk, ready: !lk && specMeter(pl, b) >= c, about: x.about || "", fits: fit }; }),
                        fury: meterOf(pl) ? Math.floor(pl[meterOf(pl)] || 0) : null, aegis: b.aegis || 0, bashCd: b.bashCd || 0, bash: state ? { why: bashWhyNot(state, pl, b), next: !!b.bashNext } : null, windup: !!(b.me && b.me.slow), lust: b.lust ? b.lust.left : 0,   // the Berserker (Part 5)
                        monLevel: Math.max(1, Math.round((m.att + m.def) / 2 + m.hp / 8)),
                        know: state && !m.mage ? quarryKnow(state, b.mon) : null,                // what your kills have taught you (V6)
                        fx: { them: fxView(b, "them"), you: fxView(b, "you") },                     // Battle Re-work effects
                        // your spells as battle moves (2026-10-15, Cam: "select which spell i am going to cast like when picking a
                        // pokemon fighting move"): the loadout, each with its runes and whether you can cast it now
                        magic: !!(b.me && b.me.magic), castNext: b.castNext || "",
                        spells: b.me && b.me.magic ? (pl.loadout || []).filter(function (id) { return SPELLS[id]; }).map(function (id) {
                          var sp = SPELLS[id], cost = spellCost(pl, sp, 1), lk = state ? spellLock(state, id) : "";
                          var short = state ? Object.keys(cost).filter(function (k) { return !has(state, k, cost[k]); }) : [];
                          return { id: id, name: sp.name, cost: cost, base: sp.base, lock: lk, short: short, can: !lk && !short.length, element: sp.element || "", weak: sp.element ? elementMult(b.mon, sp.element) : 1 };
                        }) : [],
                        using: b.me && b.me.wid && ITEMS[b.me.wid] ? ITEMS[b.me.wid].name : "fists", usingFrom: (b.me && b.me.wfrom) || "",
                        tools: state ? toolsView(state, pl, b) : [], toolNext: b.toolNext ? b.toolNext.item : "" }; })(),   // traps and nets (Part 4)
             toolPlan: state ? toolPlanView(state, pl) : null,
             weapons: { main: weaponView(pl, (pl.gear || {}).weapon), off: weaponView(pl, (pl.gear || {}).offhand) },   // and wear
             // your class's specials, at what they cost you after talents; your class level (Battle Re-work Part 3)
             specCosts: (function () { var t = specTable(pl), o = {}; Object.keys(t).forEach(function (k) { o[k] = specCostOf(pl, t[k]); }); return o; })(),
             specLoadout: specLoadout(pl), specCatalogue: specCatalogue(pl),                // V18
             specFitsNow: (function () { var t = specTable(pl), o = {}, c = pl.cls && CLASSES[pl.cls], w = (pl.gear || {}).weapon, st = ((ITEMS[w] || {}).gear || {}).style || "melee"; Object.keys(t).forEach(function (k) { o[k] = specFits(c, t[k], st, w); }); return o; })(),
             classLevel: pl.cls ? classLevel(pl, pl.cls) : 0,
             packPlan: state && pl.cls === "beastmaster" ? packPlanView(state, now) : null,   // a Beast Master's pack (Part 11b)
             sandbox: !!(state && state.dev && state.dev.on), freeSwitch: pl.freeSwitch || 0,   // (Part 9)
             quiver: (function () { var am = (pl.gear || {}).ammo, q = ITEMS[(pl.gear || {}).quiver]; if (!am || !ITEMS[am] || !q || !q.gear || !q.gear.quiver) return null;   // N24: what's in it
               return { name: q.name, cap: q.gear.quiver.cap, left: state ? quiverHeld(state, pl) : 0 }; })(),   // (Part 10)
             offItem: (function () { var o = (pl.gear || {}).offhand; return o && ITEMS[o] ? { id: o, name: ITEMS[o].name, shield: isShield(o) } : null; })(),   // (Part 8)
             bless: pl.bless ? { left: pl.bless.left } : null, bashAuto: !!(pl.combat || {}).bashAuto, paladin: pl.cls === "paladin",
             coat: pl.coat && ITEMS[pl.coat.id] ? { id: pl.coat.id, name: ITEMS[pl.coat.id].name, left: pl.coat.left } : null, canCoat: canCoat(pl),   // a Thief's coating (Part 7)
             fury: !!meterOf(pl), furyNow: Math.floor(pl[meterOf(pl)] || 0), meter: meterOf(pl), specLocks: (function () { var t = specTable(pl), o = {}; Object.keys(t).forEach(function (k) { var l = specialLock(pl, t[k]) || specUnlockWhy(pl, t[k]); if (l) o[k] = l; }); return o; })(),
             weapon: (function () { var wi = ITEMS[(pl.gear || {}).weapon]; return wi ? { id: pl.gear.weapon, name: wi.name, style: wi.gear.style || "melee", ammo: wi.gear.ammo || "" } : null; })(),
             ammo: (function () { var ai = ITEMS[(pl.gear || {}).ammo]; return ai ? { id: pl.gear.ammo, name: ai.name, count: state ? quiverHeld(state, pl) : 0, inBag: (state && state.bag || {})[pl.gear.ammo] || 0 } : null; })() };   // (N24: what's loaded)
  }

