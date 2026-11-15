  // ---- game modes (2026-10-07, Cam: "3 different game modes, adventure (you drop only coins on death, pets never
  //      die), hardcore (Lose everything on death, pets can die), Hell (Player can die, Pets can die, have to start
  //      again)") -- a game that's already going is Hardcore: that's how it has always played ---------------------
  var MODES = CONTENT("MODES");
  function modeOf(s) { return MODES[s && s.mode] ? s.mode : "hardcore"; }
  function fallAndLose(s, pl, mon, ground, at) {
    if (pl === s.player) unloadQuiver(s, pl);                              // (N24: the quiver's arrows fall with the bag)
    var fj = pl.job;                                                      // the trip you fell on: kept, so "after 23 wins" can still be told (PT30)
    if (fj && fj.hunt) pl.lastTrip = { skill: fj.skill, spot: fj.spot, hunt: fj.hunt, since: fj.since, ended: at, count: fj.count, xp: fj.xp, items: fj.items, ate: fj.ate || null, why: "fell", stolen: fj.stolen || 0 };
    if (modeOf(s) !== "hell") return graveFall(s, pl, mon, ground, at);   // V16 (2026-10-19): the gravestone -- see core/40-zzz-zh
    if (modeOf(s) === "adventure") {                                 // Adventure: only the coins (before V16)
      var lc = s.coins || 0;
      if (!(s.dev && s.dev.infinite)) s.coins = 0;
      pl.job = null; pl.battle = null; pl.dead = null;
      pl.hp = Math.max(1, Math.round(maxHp(pl) / 2)); pl.at = at;
      s.lastFall = { at: at, by: mon.name, where: ground.name, lost: { items: 0, kinds: 0, coins: lc, gear: 0, tools: 0 } };
      note(s, at, "You fell to " + aOr(mon.name) + " at the " + ground.name + " and woke at home -- you dropped your " + lc + " coin" + (lc === 1 ? "" : "s") + ".");
      return;
    }
    if (modeOf(s) === "hell") {                                      // Hell: you die
      pl.job = null; pl.battle = null; pl.hp = 0;
      pl.dead = { by: mon.name, at: at, where: ground.name };
      note(s, at, "You died to " + aOr(mon.name) + " at the " + ground.name + ". In Hell, that's the end: start again.");
      return;
    }
    var lost = { items: 0, kinds: 0, coins: s.coins || 0, gear: Object.keys(pl.gear || {}).length, tools: Object.keys(pl.tools || {}).length };
    Object.keys(s.bag || {}).forEach(function (k) { if (s.bag[k] > 0) { lost.items += s.bag[k]; lost.kinds++; } });
    if (!(s.dev && s.dev.infinite)) {
      s.bag = {}; s.unid = {};
      s.coins = 0;
      pl.gear = {};
      pl.tools = {};
      pl.wear = {};
      pl.brews = {};
    }
    pl.job = null;
    pl.battle = null;
    pl.dead = null;
    pl.hp = Math.max(1, Math.round(maxHp(pl) / 2));                      // you wake at home, hurt
    pl.at = at;
    s.lastFall = { at: at, by: mon.name, where: ground.name, lost: lost };
    note(s, at, "You fell to " + aOr(mon.name) + " at the " + ground.name + " and woke at home with nothing you'd carried" +
         " -- " + lost.items + " item" + (lost.items === 1 ? "" : "s") + ", " + lost.coins + " coin" + (lost.coins === 1 ? "" : "s") +
         (lost.gear ? ", your armour and weapon" : "") + (lost.tools ? ", your tools" : "") + " are gone.");
  }

  /** One round of a manual boss fight, now: your move (attack / special / eat), then theirs. */
  function manualRound(s, b, now) {
    var pl = s.player;
    var res = battleRound(s, pl, b, now);
    // the round is in the fight's log; the end of the fight writes its own line in the diary
    if (res) { endBossBattle(s, pl, b, res, now); return { ok: true, msg: res === "won" ? "You won!" : res === "dead" ? "You fell." : res === "beaten" ? "Your pack was beaten." : "You had to run.", state: s }; }
    b.nextRound = MANUAL_WAIT;
    return { ok: true, msg: "", state: s };
  }
  function runBoss(s, upTo) {
    var pl = s.player;
    while (pl.battle && pl.battle.kind === "boss" && !pl.battle.manual && pl.battle.nextRound <= upTo) {
      var b = pl.battle, at = b.nextRound, res = battleRound(s, pl, b, at);
      if (res) endBossBattle(s, pl, b, res, at);
    }
  }
  function endHunt(s, w, job, at, text) {
    note(s, at, text);
    w.lastTrip = { skill: job.skill, spot: job.spot, hunt: job.hunt, since: job.since, ended: at, count: job.count, xp: job.xp, items: job.items, ate: job.ate || null, stolen: job.stolen || 0 };
    w.job = null;
  }
  function hunt(s, w, job, at) {
    var ground = HUNTS[job.hunt], monId = pick(job, quarryPool(s, job.hunt, huntPool(ground, at))), mon = MONSTERS[monId], you = w === s.player, me, cb = w.combat || {};
    var hl = s.hunt[job.hunt] = s.hunt[job.hunt] || { kills: 0, wins: 0, losses: 0 };
    if (you) {
      healTo(w, at);
      var pf = playerFighter(s, w, job, at);
      if (pf.out) { endHunt(s, w, job, at, "Out of " + pf.out + "s -- you came home from the " + ground.name + " after " + job.count + " win" + (job.count === 1 ? "" : "s") + "."); return; }
      me = pf.me; var ammoUse = pf.ammo;
      me.flee = 0;                                                  // PT30: you never run on your own
      job.style = pf.style;
    } else {
      me = petFighter(w); me.hp = job.petHp;
    }
    me.vs = quarryDmg(s, monId);                                   // a mastered creature (V6)
    var hp0 = me.hp, r = fight(job, me, mon);
    if (you) w.hp = Math.max(0, r.hp); else job.petHp = Math.max(0, r.hp);
    if (you && me.regen && w.hp > 0) w.hp = Math.min(maxHp(w), w.hp + me.regen);      // Sylvan gear: heals after each fight
    // the last fight, kept for the live battle screen
    job.fight = { at: at, mon: mon === MONSTERS.chicken ? "chicken" : Object.keys(MONSTERS).filter(function (k) { return MONSTERS[k] === mon; })[0],
                  hp0: Math.round(hp0), monHp: mon.hp, rounds: r.rounds, won: r.won, spec: me.spec ? me.spec.name : "", ammo: ammoUse || 0 };
    if (you) specAfterFight(w);
    if (r.won) {
      job.count++;
      job.kills[mon.name] = (job.kills[mon.name] || 0) + 1;
      hl.kills++;                                                  // toward the area's boss
      quarryKill(s, monId, at);                                    // the Bestiary (V6)
      quarrySpoils(s, monId, function () { return rnd(job); }, job.items);
      if (you) companionSteal(s, job, mon, ground, at);
      mon.drops.forEach(function (d) {
        if (rnd(job) >= d[3] * quarryDrops(s, monId) * (d[3] <= DEATH.rare ? modeBonus(s, "drop") : 1)) return;   // (rare drops: more in Hardcore and Hell, V16)
        var n = d[1] + Math.floor(rnd(job) * (d[2] - d[1] + 1));
        give(s, d[0], n);
        job.items[d[0]] = (job.items[d[0]] || 0) + n;
      });
      job.xp = Math.round((job.xp + killXp(mon)) * 10) / 10;
      if (you) {
        // OSRS-like: your style decides where the xp goes; Hitpoints always
        addXp(s, w, me.style === "defensive" ? "defence" : job.style === "ranged" ? "ranged" : "attack", killXp(mon), at);
        addXp(s, w, "hitpoints", Math.round(killXp(mon) / 3 * 10) / 10, at);
      } else {
        var pb = levelOf(w.xp || 0);
        w.xp = (w.xp || 0) + mon.xp;
        if (levelOf(w.xp) > pb) note(s, at, who(w) + " reached level " + levelOf(w.xp) + "!");
      }
    }
    if (you && w.hp <= 0) { fallAndLose(s, w, mon, ground, at); return; }   // (PT30: a hunt can kill you)
    // (PT30: no line that brings you home -- you play on until you eat, press Run, or fall)
    if (!you && job.petHp <= 0) {
      w.injuredUntil = at + INJURY;
      endTrip(s, w, at, "hurt");
    }
  }

