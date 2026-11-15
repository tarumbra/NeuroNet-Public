  // ---- the sandbox's tools (Developer -> NeuroPet) -------------------------------------
  // Cam (2026-10-03): "a Developer Main subsection ... where i can add items, auto
  // level pet and self and skills ... clone the game into Devtools, with instant
  // hatch, all eggs, skills and items infinate." Refused anywhere but the sandbox.
  function shift(s, ms) {
    var p = s.pet, j = s.player.job;
    if (p) {
      ["born", "hatchAt", "at"].forEach(function (k) { p[k] -= ms; });
      if (p.lastMed) p.lastMed -= ms;
      if (p.injuredUntil) p.injuredUntil -= ms;
      if (p.away) { p.away.since -= ms; p.away.until -= ms; }
    }
    if (j) { j.since -= ms; j.next -= ms; j.until -= ms; }
    (s.hatchery || []).forEach(function (h) { h.started -= ms; h.hatchAt -= ms; });
    if (s.breeding) { s.breeding.since -= ms; s.breeding.until -= ms; }
    if (s.player.battle) { s.player.battle.start -= ms; s.player.battle.nextRound -= ms; s.player.battle.rounds.forEach(function (r) { r.t -= ms; }); }
    if (s.farm) s.farm.plots.forEach(function (pl) { if (pl.state === "growing") pl.stageAt -= ms; });
    if (s.farm && s.farm.pots) s.farm.pots.forEach(function (pt) { if (pt.herb) { pt.since -= ms; pt.readyAt -= ms; } });
    [s.pet].concat(s.den || []).forEach(function (q) { if (q && q.bredAt) q.bredAt -= ms; });
    (s.den || []).forEach(function (d) {
      d.born -= ms; d.hatchAt -= ms;
      if (d.job) { d.job.since -= ms; d.job.next -= ms; d.job.until -= ms; }
    });
    // everything timed that came after the list above (Cam, 2026-10-17: the warp didn't move the Beast Pen's training on).
    // A new feature with its own clock adds its fields here; 0 means "never", so it stays 0.
    function back(o, keys) { if (o) keys.forEach(function (k) { if (typeof o[k] === "number" && o[k]) o[k] -= ms; }); }
    (s.beasts || []).forEach(function (b) { back(b, ["trainAt", "fedUntil", "restUntil", "sparAt"]); });
    back(s.player.explore, ["since", "until"]);
    back(s.player.voyage, ["since", "until"]);
    back(s.ship && s.ship.building, ["since", "until"]);
    back(s.cart && s.cart.out, ["at", "back"]);
    if (s.recycle && s.recycle.lots) s.recycle.lots.forEach(function (l) { back(l, ["at", "ready"]); });
    if (s.home) {
      back(s.home.pot, ["readyAt"]); back(s.home.fed, ["until"]);
      back(s.home.reading, ["since", "until"]); back(s.home.research, ["since", "until"]);
    }
    if (s.ranch && s.ranch.b) Object.keys(s.ranch.b).forEach(function (k) {
      var rb = s.ranch.b[k];
      back(rb, ["cleanAt", "brushAt", "showAt"]);
      (rb.animals || []).forEach(function (a) { back(a, ["t", "fedUntil", "young"]); });
      (rb.slots || []).forEach(function (sl) { back(sl, ["at", "until"]); });
      (rb.pairs || []).forEach(function (pr) { back(pr, ["at", "until"]); });
    });
    Object.keys(s.estates || {}).forEach(function (k) { back(s.estates[k], ["garden"]); });
    back(s.oasis, ["rested"]);
    back(s.player, ["stunUntil"]);                                       // the Marketplace (2026-10-17)
    back(s.player.necro, ["jarAt"]);                                     // a wisp in a jar's week (V6, 2026-10-18)
    if (s.market) {
      back(s.market, ["banUntil", "lastTry"]);
      Object.keys(s.market.watch || {}).forEach(function (k) { if (s.market.watch[k]) s.market.watch[k] -= ms; });
      Object.keys(s.market.stock || {}).forEach(function (k) { back(s.market.stock[k], ["at"]); });
      s.market.caught = (s.market.caught || []).map(function (t) { return t - ms; });
    }
  }
  function devAct(s, o, now) {
    if (!(s.dev && s.dev.on)) return no(s, "Developer tools only work in the sandbox.");
    var p = s.pet;
    switch (o.op) {
      case "flags":
        ["instantHatch", "allEggs", "infinite", "questFree"].forEach(function (k) { if (typeof o[k] === "boolean") s.dev[k] = o[k]; });
        return { ok: true, msg: "Sandbox switches saved.", state: s };
      case "give":
        if (!ITEMS[o.item]) return no(s, "There's no item like that.");
        give(s, o.item, Math.max(1, Math.min(9999, o.n | 0 || 1)), true);   // the sandbox ignores bag room (Cam, 2026-10-15)
        if (ITEMS[o.item].learn && ITEMS[o.item].learn.field) fieldPageGot(s, o.item, now);   // a recipe page: the Unlocks pop-up (PT24)
        return { ok: true, msg: "Added " + (o.n | 0 || 1) + " × " + ITEMS[o.item].name.toLowerCase() + ".", state: s };
      case "mode":                                                      // PT33 f1 (Cam: "the ability change this in sandbox tools at anytime to test different game difficulty features")
        if (!MODES[o.mode]) return no(s, "There's no mode like that.");
        s.mode = o.mode;
        if (o.mode !== "hell" && s.player && s.player.dead) { s.player.dead = null; s.player.hp = Math.max(1, Math.round(maxHp(s.player) / 2)); }   // (out of Hell: back to life)
        return { ok: true, msg: "The sandbox plays as " + MODES[o.mode].name + " now.", state: s };
      case "clearbag":                                                  // PT30 v6 (Cam: "an option in sandbox to remove all items from the character")
        s.bag = {}; s.unid = {}; if (s.player) { s.player.gear = {}; s.player.tools = {}; s.player.quick = []; }
        if (s.dev) s.dev.infinite = false;                               // (else the infinite bag shows everything again)
        return { ok: true, msg: "Everything you carried and wore is gone -- an empty bag (the bank and your coins are untouched).", state: s };
      case "coins":
        s.coins = Math.max(0, (s.coins || 0) + (o.n | 0));
        return { ok: true, msg: "You have " + s.coins + " coins.", state: s };
      case "giveall":
        Object.keys(ITEMS).forEach(function (k) { give(s, k, Math.max(1, o.n | 0 || 10), true); });   // (bag room ignored)
        return { ok: true, msg: "Added " + (o.n | 0 || 10) + " of everything.", state: s };
      case "level": {
        var lv = Math.max(1, Math.min(MAX_LEVEL, o.level | 0 || 1));
        if (o.target === "pet") { if (!p) return no(s, "There's no pet."); p.xp = XP[lv]; return { ok: true, msg: "Pet set to level " + lv + ".", state: s }; }
        if (o.target === "area") { if (!p || !AREAS[o.area]) return no(s, "No pet or no such area."); p.areas = p.areas || {}; p.areas[o.area] = MASTERY[Math.min(5, lv) - 1]; return { ok: true, msg: AREAS[o.area].name + " set to area level " + Math.min(5, lv) + ".", state: s }; }
        if (o.target === "npc") return no(s, "The crafters are gone -- set your skill instead (Smithing, Fletching ...).");
        if (o.target === "class") {                                       // your class's level -- its talent points (Cam, PT7: "assign points same way")
          if (!s.player.cls || !CLASSES[s.player.cls]) return no(s, "Choose a class first.");
          classBox(s.player, s.player.cls).xp = XP[lv];
          return { ok: true, msg: CLASSES[s.player.cls].name + " set to class level " + lv + " -- " + talentPoints(s.player, s.player.cls) + " talent points.", state: s };
        }
        if (!SKILLS[o.skill]) return no(s, "There's no skill like that.");
        s.player.skills[o.skill] = XP[lv];
        return { ok: true, msg: SKILLS[o.skill].name + " set to level " + lv + ".", state: s };
      }
      case "wearweapon": {                                               // Battle Re-work: try re-tempering and breaking without hunting hours
        var wid = (s.player.gear || {})[o.slot === "offhand" ? "offhand" : "weapon"];
        if (!isWeapon(wid)) return no(s, "There's no weapon there.");
        s.player.wear = s.player.wear || {};
        s.player.wear[wid] = Math.max(0, Math.min(weaponDur(wid) - 1, Math.round(weaponDur(wid) * (+o.share || 0.8))));
        return { ok: true, msg: "Your " + ITEMS[wid].name.toLowerCase() + " is " + Math.round((+o.share || 0.8) * 100) + "% worn." +
                 ((s.dev || {}).infinite ? " (Infinite items is on: when it breaks you'll pick up another at once -- use the Plain account to see it go.)" : ""), state: s };
      }
      case "maxall":
        SKILL_ORDER.forEach(function (k) { s.player.skills[k] = XP[MAX_LEVEL]; });
        if (p) { p.xp = XP[MAX_LEVEL]; p.areas = {}; AREA_ORDER.forEach(function (a) { if (!AREAS[a].later) p.areas[a] = MASTERY[4]; }); }
        return { ok: true, msg: "Everything at the top level.", state: s };
      case "warp": {
        var ms = Math.max(0, Math.min(60 * DAY, (+o.hours || 0) * HOUR));
        shift(s, ms);
        return { ok: true, msg: "Time moved on " + (+o.hours) + " hour" + (+o.hours === 1 ? "" : "s") + ".", state: s };
      }
      case "sky":                                                        // Cam (PT15 c2): night or day at will -- wraiths, wisps, vigils, stars
        s.dev.sky = o.sky === "night" || o.sky === "day" ? o.sky : "";
        return { ok: true, msg: s.dev.sky ? "It's " + s.dev.sky + " in the sandbox now, whatever the clock says." : "The sandbox follows the real clock again.", state: s };
      case "bury": {                                                     // Cam (PT15 r1): "sandbox option to kill pets or add to graveyard"
        if (o.beast) {
          var bst = (s.beasts || []).filter(function (x) { return x.id === o.beast; })[0];
          if (!bst) return no(s, "There's no battle pet like that.");
          if (bst.loan) return no(s, "That one's only lent to you -- it goes back to its tutor.");
          if (s.player.battle || (s.player.job && s.player.job.hunt)) return no(s, "Come home from the hunt first.");
          var wasRisen = bst.risen;
          if (wasRisen) risenFalls(s, bst, now, null);
          else beastDies(s, bst, now, { name: "the sandbox" }, { name: "Developer tools" });
          return { ok: true, msg: who(bst) + " is in the Graveyard now" + (wasRisen ? " (back to its grave)." : "."), state: s };
        }
        if (!p) return no(s, "There's no pet.");
        if (stage(p, now) === "egg") return no(s, "That's still an egg.");
        if (p.away) return no(s, "Your pet is away on an expedition.");
        var nm = who(p);
        petDies(s, p, now, AREA_ORDER[0], "laid to rest from the sandbox");
        return { ok: true, msg: nm + " is in the Graveyard now. Take another from the den, or hatch one.", state: s };
      }
      case "target": {                                                   // hunt only this creature at that ground (PT14 p4); "" = any again
        var tgH = HUNTS[o.ground];
        if (!tgH || !tgH.monsters) return no(s, "There's no hunting ground like that.");
        s.dev.target = s.dev.target || {};
        if (!o.mon) { delete s.dev.target[o.ground]; return { ok: true, msg: "The " + tgH.name + " has all its creatures again.", state: s }; }
        if (!tgH.monsters.some(function (m) { return m[0] === o.mon; })) return no(s, "That creature doesn't live there.");
        s.dev.target[o.ground] = o.mon;
        return { ok: true, msg: "Hunting at the " + tgH.name + " now meets only " + MONSTERS[o.mon].name.toLowerCase() + "s.", state: s };
      }
      case "bossready":                                                  // Cam (PT19 c5): "skip the 400 fights in developer mode"
      case "beatboss": {                                                 // ... and PT13: "a button that makes the character already have beat the basilisk"
        var hg = HUNTS[o.ground];
        if (!hg || !hg.boss || !hg.kills) return no(s, "There's no boss ground like that.");
        s.hunt = s.hunt || {};
        var hl = s.hunt[o.ground] = s.hunt[o.ground] || { kills: 0, wins: 0, losses: 0 };
        var bn = MONSTERS[hg.boss].name;
        if (o.op === "bossready") { hl.kills = Math.max(hl.kills || 0, bossNeed(hg, hl)); return { ok: true, msg: bn + " will come out at the " + hg.name + " now.", state: s }; }
        hl.wins = (hl.wins || 0) + 1; hl.unlocked = true;
        return { ok: true, msg: bn + " counts as beaten (no spoils -- fight it for those)" + (o.ground === "jungle" ? ". New Game Plus is open from this sandbox." : "."), state: s };
      }
      case "age":
        if (!p) return no(s, "There's no pet.");
        var am = Math.max(0, (+o.days || 0) * DAY);
        p.born -= am; p.hatchAt -= am;
        return { ok: true, msg: "Your pet is " + (+o.days) + " day" + (+o.days === 1 ? "" : "s") + " older.", state: s };
      case "fill":
        if (!p) { s.player.hp = maxHp(s.player); s.player.dead = null; return { ok: true, msg: "You're at full health.", state: s }; }
        s.player.hp = maxHp(s.player); s.player.dead = null;
        STATS.forEach(function (k) { p.s[k] = 100; });
        p.sick = false; p.asleep = false; p.injuredUntil = 0;
        return { ok: true, msg: "Stats full, healthy and awake.", state: s };
    }
    return no(s, "No developer tool called " + o.op + ".");
  }

