  // ==== the Pyramid (2026-10-09, Cam: "room by room", the traps test "your skills", the loot "a mixture of all that is
  //      random everytime you complete a pyrimid run. Think like a replayable boss which drops different loot everytime",
  //      and the sarcophagus "a 6th boss chamber" after dark). One run a day on the Desert Island: five chambers -- traps,
  //      glyph riddles and guardians -- then the treasure; at night a sixth, the Pharaoh himself. Beaten, you're thrown
  //      out for the day (never killed: the Pyramid doesn't end a game).
  var PYR_CHAMBERS = 5, PYR_COMBAT = 40;
  SPECIES.scorpion.colours.push("golden");
  PETS["scorpion/golden"] = { name: "Golden Scorpion", rarity: "Legendary" };
  EGGS.sarcophagus = CONTENT("EGGS.sarcophagus");
  Object.assign(ITEMS, CONTENT("more ITEMS"));
  Object.assign(WEAR, CONTENT("more WEAR"));
  WEAPONS.pharaohsceptre = CONTENT("WEAPONS.pharaohsceptre");
  var PHARAOH_SET = CONTENT("PHARAOH_SET");
  MONSTERS.tombguardian = CONTENT("MONSTERS.tombguardian");   // (nothing that's gathered: that keeps its price by the pace)
  MONSTERS.pharaoh = CONTENT("MONSTERS.pharaoh");
  var PYR_GUARDS = CONTENT("PYR_GUARDS");
  var PYR_TRAPS = CONTENT("PYR_TRAPS");
  var PYR_RIDDLES = CONTENT("PYR_RIDDLES");
  var PYR_GLYPHS = CONTENT("PYR_GLYPHS");
  // what a finished run gives: some of these, different every time (more and better from the Pharaoh)
  var PYR_LOOT = CONTENT("PYR_LOOT");
  /** The Pyramid's day is your own (it resets at your midnight, not at UTC's). */
  function pyrDay(now) { return Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / DAY); }
  function pyrSeed(day, k) { return { seed: (day * 9973 + k * 7919 + 31) | 0 }; }
  /** Today's chambers: kinds and what's in each (the same all day). */
  function pyrChambers(day) {
    var job = pyrSeed(day, 1), kinds = ["trap", "riddle", "guardian"], out = [];
    var order = kinds.concat([kinds[Math.floor(rnd(job) * 3)]]);
    for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(rnd(job) * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
    order.forEach(function (k) {
      if (k === "trap") out.push({ kind: "trap", trap: Math.floor(rnd(job) * PYR_TRAPS.length) });
      else if (k === "riddle") {
        var ri = Math.floor(rnd(job) * PYR_RIDDLES.length), ans = PYR_RIDDLES[ri][1], others = PYR_GLYPHS.filter(function (g) { return g !== ans; }), ch = [ans];
        while (ch.length < 4) ch.push(others.splice(Math.floor(rnd(job) * others.length), 1)[0]);
        for (var a = ch.length - 1; a > 0; a--) { var b = Math.floor(rnd(job) * (a + 1)), u = ch[a]; ch[a] = ch[b]; ch[b] = u; }
        out.push({ kind: "riddle", riddle: ri, choices: ch });
      } else out.push({ kind: "guardian", mon: PYR_GUARDS[Math.floor(rnd(job) * PYR_GUARDS.length)] });
    });
    out.push({ kind: "guardian", mon: "tombguardian", last: true });
    out.push({ kind: "guardian", mon: "pharaoh", night: true });
    return out;
  }
  function pyrState(s, now) {
    var day = pyrDay(now);
    if (!s.pyramid || s.pyramid.day !== day) s.pyramid = { day: day, at: 0, out: false, log: [], loot: null };
    return s.pyramid;
  }
  function pyrLock(s) {
    if (islandOf(s) !== "desert") return "The Pyramid is in the Desert, on the Desert Island.";
    if (regionLock(s, "desert")) return regionLock(s, "desert");
    if (combatLevel(s.player) < PYR_COMBAT) return "Its guardians would make short work of you -- come back at combat level " + PYR_COMBAT + ".";
    return "";
  }
  function pyrLoot(job, night) {
    var pool = PYR_LOOT.filter(function (x) { return ITEMS[x[0]]; }).map(function (x) {
      return [x, x[0].indexOf("pharaoh") === 0 && night ? x[3] * 3 : x[3]]; });
    var items = {}, picks = night ? 5 : 3;
    for (var i = 0; i < picks && pool.length; i++) {
      var tot = pool.reduce(function (a, p) { return a + p[1]; }, 0), r = rnd(job) * tot, k = 0;
      for (; k < pool.length - 1; k++) { r -= pool[k][1]; if (r < 0) break; }
      var L = pool.splice(k, 1)[0][0];
      items[L[0]] = L[1] + Math.floor(rnd(job) * (L[2] - L[1] + 1));
    }
    if (night && rnd(job) < 0.08) items.sarcophagusegg = 1;
    return { coins: night ? 2000 + Math.floor(rnd(job) * 1500) : 800 + Math.floor(rnd(job) * 700), items: items };
  }
  function pyrPayout(s, job, night, now) {
    var L = pyrLoot(job, night);
    s.coins = (s.coins || 0) + L.coins;
    Object.keys(L.items).forEach(function (k) { give(s, k, L.items[k], true); });            // a treasure never waits for bag room
    return L;
  }
  function endPyramidBattle(s, pl, b, res, at) {
    var mon = MONSTERS[b.mon], py = pyrState(s, at), got = {};
    pl.battle = null;
    specAfterFight(pl);
    s.lastBoss = { ground: "desert", mon: b.mon, at: at, won: res === "won", fled: res !== "won" && res !== "dead", got: got, rounds: b.rounds.slice(), pyramid: true };
    if (res !== "won") {
      if (pl.hp < 1) pl.hp = 1;                                       // the Pyramid throws you out; it doesn't end your game
      py.out = true;
      py.log.push((mon.boss ? mon.name : "The " + mon.name.toLowerCase()) + (res === "dead" ? " beat you" : " -- you ran") + ", and you were thrown out.");
      note(s, at, (res === "dead" ? mon.name + " beat you" : "You ran from " + mon.name) + " -- the Pyramid threw you out for today.");
      return;
    }
    battleXp(s, pl, b, mon, at);
    mon.drops.forEach(function (d) { if (rnd(b) < d[3]) { var n = d[1] + Math.floor(rnd(b) * (d[2] - d[1] + 1)); give(s, d[0], n, true); got[d[0]] = n; } });
    py.at = Math.max(py.at, b.pyramid);
    var L = pyrPayout(s, b, b.pyramid > PYR_CHAMBERS, at);
    py.loot = L;
    var txt = Object.keys(L.items).map(function (k) { return ITEMS[k].name.toLowerCase() + (L.items[k] > 1 ? " ×" + L.items[k] : ""); }).join(", ");
    py.log.push("You beat " + mon.name + ". " + (b.pyramid > PYR_CHAMBERS ? "The Pharaoh's treasure: " : "The treasure room: ") + L.coins + " coins, " + txt + ".");
    note(s, at, "You beat " + mon.name + "! " + (b.pyramid > PYR_CHAMBERS ? "The Pharaoh's treasure: " : "The treasure room: ") + L.coins + " coins, " + txt + ".");
  }
  function pyramidView(s, now) {
    var lock = pyrLock(s), day = pyrDay(now), py = s.pyramid && s.pyramid.day === day ? s.pyramid : { at: 0, out: false, log: [], loot: null };
    var ch = pyrChambers(day), night = isNight(now), pl = s.player || newPlayer();
    var last = night ? PYR_CHAMBERS + 1 : PYR_CHAMBERS, cur = !lock && !py.out && py.at < last ? ch[py.at] : null, c = null;
    if (cur && cur.kind === "trap") {
      var T = PYR_TRAPS[cur.trap];
      c = { kind: "trap", name: T.name, text: T.text, ways: T.ways.filter(function (w) { return SKILLS[w[0]]; }).map(function (w, i) {
        var lv = levelOf((pl.skills || {})[w[0]] || 0);
        return { i: i, skill: w[0], skillName: SKILLS[w[0]].name, req: w[1], how: w[2], level: lv, chance: pyrChance(lv, w[1]) }; }) };
    } else if (cur && cur.kind === "riddle") {
      c = { kind: "riddle", name: "The glyph door", text: PYR_RIDDLES[cur.riddle][0], choices: cur.choices.map(function (g) { return { id: g, name: ITEMS[g] ? ITEMS[g].name : g }; }) };
    } else if (cur) {
      var M = MONSTERS[cur.mon];
      c = { kind: "guardian", name: cur.night ? "The sarcophagus" : cur.last ? "The guardian's hall" : "A guarded chamber", mon: cur.mon, monName: M.name, hp: M.hp, att: M.att, def: M.def, boss: !!M.boss };
    }
    return { lock: lock, combat: PYR_COMBAT, at: py.at, out: !!py.out, fighting: !!(pl.battle && pl.battle.pyramid), log: py.log || [], loot: py.loot || null, night: night,
             chambers: ch.slice(0, PYR_CHAMBERS + 1).map(function (x, i) { return { kind: x.kind, night: !!x.night, done: i < py.at }; }),
             done: py.at >= PYR_CHAMBERS, sarcophagus: py.at > PYR_CHAMBERS, current: c, crypt: lock ? null : pyrCryptView(s, now, py),   // (the Keen Eye, 2026-10-17) hp: Math.round(pl.hp || 0), maxHp: maxHp(pl),
             set: PHARAOH_SET.map(function (k) { return { id: k, name: ITEMS[k].name, have: ((s.bag || {})[k] || 0) > 0 || Object.keys(pl.gear || {}).some(function (g) { return pl.gear[g] === k; }) }; }) };
  }
  function pyrChance(lv, req) { return Math.max(0.05, Math.min(0.95, Math.round((0.45 + 0.04 * (lv - req)) * 100) / 100)); }
  function pyramidAct(s, action, opts, now) {
    if (action !== "pyramid") return null;
    var lock = pyrLock(s);
    if (lock) return no(s, lock);
    var pl = s.player;
    if (pl.job || pl.battle || pl.explore) return no(s, "You're busy -- come back first.");
    healTo(pl, now);
    var py = pyrState(s, now), ch = pyrChambers(py.day), night = isNight(now), last = night ? PYR_CHAMBERS + 1 : PYR_CHAMBERS;
    if (py.out) return no(s, "The Pyramid threw you out today -- its doors open again tomorrow.");
    if (opts.op === "crypt") return pyrCryptAct(s, py, now, { seed: typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0) });   // the Keen Eye (2026-10-17)
    if (py.at >= last) return no(s, py.at > PYR_CHAMBERS ? "You've been through every chamber today -- even the Pharaoh's." : "Every chamber's cleared today -- the sarcophagus opens after dark (9 pm).");
    var cur = ch[py.at], job = { seed: typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0) }, mh = maxHp(pl), msg = "";
    var hurt = function (f) { pl.hp = Math.max(0, Math.round(pl.hp - Math.ceil(mh * f))); };
    if (cur.kind === "trap") {
      var T = PYR_TRAPS[cur.trap], w = T.ways[opts.way | 0];
      if (!w || !SKILLS[w[0]]) return no(s, "There's no way like that.");
      var ok = rnd(job) < pyrChance(levelOf(pl.skills[w[0]] || 0), w[1]);
      addXp(s, pl, w[0], ok ? 25 * w[1] : 6 * w[1], now);
      if (!ok) hurt(0.25);
      msg = T.name + ": " + (ok ? "you " + w[2].charAt(0).toLowerCase() + w[2].slice(1) + " -- through!" : "it didn't work, and it hurt (" + SKILLS[w[0]].name + ").");
    } else if (cur.kind === "riddle") {
      var right = opts.glyph === PYR_RIDDLES[cur.riddle][1];
      if (cur.choices.indexOf(opts.glyph) < 0) return no(s, "Pick one of the glyphs on the door.");
      if (!right) hurt(0.2);
      addXp(s, pl, "magic", right ? 800 : 150, now);
      msg = "The glyph door: " + (right ? "the " + ITEMS[opts.glyph].name.toLowerCase() + " -- the door grinds open." : "the wrong glyph -- the floor bites back, but the door gives.");
    } else if (cur.last || cur.night) {                                // the tomb guardian and the Pharaoh: a live battle
      var bm = MONSTERS[cur.mon];
      if (cur.night && !night) return no(s, "The sarcophagus only opens after dark.");
      autoEat(s, pl, 50, now, worstHit(bm, guardOf(pl)));
      if (mustFlee(pl, worstHit(bm, guardOf(pl)))) return no(s, "You're too hurt to face " + (bm.boss ? bm.name : "the " + bm.name.toLowerCase()) + " -- rest or eat first.");
      var bst = startBattle(s, pl, "boss", "desert", cur.mon, now, job);
      if (bst.out) return no(s, "You've no " + bst.out + "s for your bow.");
      pl.battle.pyramid = py.at + 1;
      if (opts.manual) { pl.battle.manual = true; pl.battle.nextRound = MANUAL_WAIT; }
      return yes(s, now, (cur.night ? "The sarcophagus lid grinds aside -- the Pharaoh rises!" : "The tomb guardian steps out of the dark -- the fight is on!") + (opts.manual ? " Your move." : ""));
    } else {
      var mon = MONSTERS[cur.mon];
      var pf = playerFighter(s, pl, job, now);
      if (pf.out) return no(s, "You're out of " + pf.out + "s -- bring more before you face " + mon.name.toLowerCase() + ".");
      var me = pf.me, r = fight(job, me, mon);
      pl.hp = Math.max(0, r.hp);
      wearSwings(s, pl, me.wid, r.rounds, now);                          // each swing wears your weapon (Battle Re-work)
      if (r.won) {
        addXp(s, pl, me.style === "defensive" ? "defence" : pf.style === "ranged" ? "ranged" : "attack", killXp(mon), now);
        addXp(s, pl, "hitpoints", Math.round(killXp(mon) / 3 * 10) / 10, now);
        mon.drops.forEach(function (d) { if (rnd(job) < d[3]) give(s, d[0], d[1] + Math.floor(rnd(job) * (d[2] - d[1] + 1)), true); });   // as a hunt's
        msg = "You beat " + (mon.boss ? mon.name : "the " + mon.name.toLowerCase()) + " (" + r.taken + " damage taken).";
      } else {
        pl.hp = Math.max(1, pl.hp); py.out = true;
        py.log.push((mon.boss ? mon.name : "The " + mon.name.toLowerCase()) + " beat you and threw you out.");
        return yes(s, now, (mon.boss ? mon.name : "The " + mon.name.toLowerCase()) + " beat you -- you were thrown out of the Pyramid for today.");
      }
    }
    if (pl.hp <= 0) { pl.hp = 1; py.out = true; py.log.push(msg); py.log.push("Too hurt to go on -- you crawled out."); return yes(s, now, msg + " Too hurt to go on -- you crawled out for today."); }
    py.log.push(msg);
    py.at++;
    if (py.at === PYR_CHAMBERS || py.at === PYR_CHAMBERS + 1) {
      var L = pyrPayout(s, job, py.at > PYR_CHAMBERS, now);
      py.loot = L;
      var txt = Object.keys(L.items).map(function (k) { return ITEMS[k].name.toLowerCase() + (L.items[k] > 1 ? " ×" + L.items[k] : ""); }).join(", ");
      msg += (py.at > PYR_CHAMBERS ? " The Pharaoh's treasure: " : " The treasure room: ") + L.coins + " coins, " + txt + ".";
      py.log.push("Treasure: " + L.coins + " coins, " + txt + ".");
    }
    return yes(s, now, msg);
  }

