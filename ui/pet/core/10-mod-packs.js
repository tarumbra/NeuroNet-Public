  // ---- mod packs (2026-10-07, Cam: "an inbuilt modders tool where assets can be changed, custom backgrounds for maps
  //      and custom icons can be placed into the game, rates can be changed ... when starting a new game you should
  //      be able to select a mod pack ... A pet modder as well where you can change the color of pets, their bonus
  //      and add or remove buffs"). A game started with a pack keeps its rules part in s.mod -- {id, name, rates,
  //      pets} -- and every rule reads it through MOD (set as the state is read: normal()). The pictures stay in
  //      the pack's file; the page draws them.
  var MOD = null, ENCH = null;                                          // (ENCH: your enchants, 2026-10-07)
  var MOD_RATES = CONTENT("MOD_RATES");
  function useMod(s) { MOD = s && s.mod && typeof s.mod === "object" ? s.mod : null; ENCH = (s && s.player && s.player.enchants) || null; }
  function rate(k) { var r = MOD && MOD.rates && MOD.rates[k]; return typeof r === "number" && r > 0 && r <= 20 ? r : 1; }
  /** A kind of pet's companion buffs: [{skill, amount}] -- the mod's, or its own knack. */
  function petBuffs(species) {
    var pm = MOD && MOD.pets && MOD.pets[species];
    if (pm && Array.isArray(pm.buffs)) return pm.buffs.filter(function (b) { return b && (SKILLS[b.skill] || FIGHT_BOOSTS[b.skill]) && b.amount > 0; });
    return BOOSTS[species] ? [{ skill: BOOSTS[species], amount: 0.1 }] : [];
  }
  function boostFor(pet, skill, now) {
    if (!pet) return 0;
    var bf = petBuffs(pet.species).filter(function (b) { return b.skill === skill; })[0];
    if (!bf) return 0;
    var m = mood(pet, now);
    if (m === "egg" || m === "sick" || m === "asleep") return 0;
    return Math.max(0, Math.round((bf.amount * (1 + STAR_BOOST * (pet.stars || 0)) * (pet.s.happy >= 75 ? 2 : 1) + (FIGHT_BOOSTS[skill] ? 0 : knackOf(pet) + QUARTERS)) * 1000) / 1000);   // + its knack (2026-10-08); its stars (2026-10-10)
  }

  // you heal with time: brought up to `at` exactly (before each fight too), so a hunt
  // comes out the same however often it's looked at
  function healTo(pl, at) {
    if (!(at > pl.at)) return;
    // in a fight, time doesn't heal you (Battle Re-work Part 2, Cam's Q3: "only during a fight" -- between hunts, at home
    // and in your bed it does); a manual fight waits as before
    if (pl.battle) { pl.at = at; return; }

    if (!pl.dead && pl.hp < maxHp(pl)) pl.hp = Math.min(maxHp(pl), pl.hp + (at - pl.at) / REGEN * regenRate(pl) * (1 + (pl.restBonus || 0)));   // your bed at home
    pl.at = at;
  }
  /** Health back a minute (balance audit 2026-10-05: it grows with Hitpoints -- 1.4 at 10, 3 at 50). */
  function regenRate(pl) { return Math.round((1 + maxHp(pl) / 25) * 10) / 10; }
  /** Share of each blow your armour takes away: its Defence over 120, at most 40% (mithril, all five: a third). */
  function armourCut(def) { return Math.min(0.4, Math.max(0, def || 0) / 120); }
  /** The hardest a creature can hit you, after your armour and resistances. */
  function worstHit(mon, me, rage) {
    var m = mult(me.weak, mon.atk) * mult(me.resist, mon.atk) * (1 - Math.min(0.5, me.brace || 0)) * (1 - drVs(me, mon.atk)) * (rage ? 1.5 : 1);
    return Math.max(1, Math.round(mon.maxHit * m) - (me.soak || 0));
  }
  /** The worst any creature of an area can do to you. */
  function areaWorst(ground, me) {
    return Math.max.apply(null, ground.monsters.map(function (m) { return worstHit(MONSTERS[m[0]], me); }));
  }
  /** Auto-eat (balance audit 2026-10-05, Melvor-style): your chosen food, eaten on its own whenever
      your health is below your eat line -- in a fight (at most `most`) and between fights. */
  // (Battle Re-work Part 2, 2026-10-15: only ever between fights now -- your hunt plan. `worst`: the hardest blow ahead;
  //  you eat on past your line until it couldn't finish you, so a hunt doesn't end "hurt" with food still in the bag.)
  var DANGER_ROUNDS = 5, DANGER_TO = 0.9;
  function autoEat(s, pl, most, at, worst) {
    var id = pl.food, f = ITEMS[id], n = 0;
    if (pl === s.player) return 0;                                    // V16: you eat by your own hand now (the quick-use slots)
    if (!f || !f.heal || pl.dead) return 0;
    var line = (pl.eatBelow || EAT_BELOW) * maxHp(pl);
    if (worst > 0 && pl.retreat > 0) line = Math.max(line, worst + 1, pl.retreat * maxHp(pl) + 1);
    // C5 q2 (2026-10-17, the team's recommendation -- Cam: "complete all parts of the re-work"): on a ground where one long fight could
    // finish you (its hardest blow, DANGER_ROUNDS times), eat up to DANGER_TO before the next fight -- never mid-fight (Q1 kept)
    if (worst > 0 && worst * DANGER_ROUNDS >= pl.hp) line = Math.max(line, DANGER_TO * maxHp(pl));
    while (pl.hp < line && pl.hp < maxHp(pl) && n < most && has(s, id)) {
      take(s, id);
      pl.hp = Math.min(maxHp(pl), pl.hp + f.heal);
      n++;
    }
    if (n && pl.job) { pl.job.ate = pl.job.ate || {}; pl.job.ate[id] = (pl.job.ate[id] || 0) + n; }
    if (n && !has(s, id)) note(s, at, "That was your last " + f.name.toLowerCase() + " -- your hunt plan has nothing left to eat.");
    return n;
  }
  /** A brew's effect in words. */
  function brewText(b) {
    var bits = [];
    if (b.att) bits.push("Attack +" + b.att);
    if (b.rng) bits.push("Ranged +" + b.rng);
    if (b.def) bits.push("Defence +" + b.def);
    if (b.maxHit) bits.push("max hit +" + b.maxHit);
    if (b.xp) bits.push("+" + Math.round(b.xp * 100) + "% gathering xp");
    if (b.double) bits.push(Math.round(b.double * 100) + "% chance of a double find");
    return bits.join(", ") + " for " + b.uses + (b.kind === "combat" ? " fights" : " finds");
  }
  /** The brew of a kind ("combat" | "gather") you're under, or null. */
  function brewOf(s, kind) {
    var b = ((s.player || {}).brews || {})[kind];
    return b && b.left > 0 && ITEMS[b.id] && ITEMS[b.id].brew ? ITEMS[b.id].brew : null;
  }
  /** One fight (or find) of a brew used up. Run out: another from the bag if there is one, else it's gone. */
  function useBrew(s, kind, at) {
    var b = (s.player.brews || {})[kind];
    if (!b || !(b.left > 0)) return;
    b.left--;
    if (b.left > 0) return;
    var it = ITEMS[b.id];
    if (it && has(s, b.id)) { take(s, b.id); b.left = it.brew.uses; note(s, at, "Your " + it.name.toLowerCase() + " wore off -- you drank another."); return; }
    delete s.player.brews[kind];
    if (it) note(s, at, "Your " + it.name.toLowerCase() + " wore off.");
  }
  /** What your armour and class do against blows, without readying a fight (no ammo used). */
  function guardOf(pl) {
    var g = gearSum(pl.gear, pl.cls, pl.enchants), cls = pl.cls ? CLASSES[pl.cls] : null;
    var dby = defByOf(g, g.def);                                        // Defence by kind of attack (V17)
    return { weak: cls ? cls.weak : null, resist: cls ? cls.resist : null, brace: g.brace, dr: armourCut(g.def), drBy: dby.dr, soak: Math.floor(g.soak + 1e-9) };
  }
  /** Is it time to get away? Below your retreat line, or low enough that one blow could end you.
      A retreat of 0 is a fight to the death: neither applies. */
  function mustFlee(pl, worst) {
    if (pl.made) return false;                                        // PT30 (2026-10-19, Cam: "No ambiguity no auto running, whether idle or not"): you never run on your own -- pets on their jobs still do
    if (!(pl.retreat > 0)) return false;
    return pl.hp <= pl.retreat * maxHp(pl) || pl.hp <= worst;
  }
  function maxHp(pl) { return levelOf((pl.skills || {}).hitpoints || XP[10]); }
  function combatLevel(pl) {
    var sk = pl.skills || {};
    var hit = Math.max(levelOf(sk.attack || 0), levelOf(sk.ranged || 0), levelOf(sk.magic || 0));
    return Math.max(1, Math.floor((hit + levelOf(sk.defence || 0)) / 2 + levelOf(sk.hitpoints || XP[10]) / 4));
  }
  function newPlayer() {
    return { name: "", made: false, look: { skin: 0, hair: 0, outfit: 0 },
             skills: { foraging: 0, fishing: 0, mining: 0, lumbering: 0, cooking: 0 }, job: null, lastTrip: null,
             tools: {}, gear: {} };
  }

  // Per hour. Awake, then asleep.
  var AWAKE = CONTENT("AWAKE");
  var ASLEEP = CONTENT("ASLEEP");

  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function hasCoins(s, n) { return (s.dev && s.dev.infinite) || (s.coins || 0) >= n; }
  function spend(s, n) { if (!(s.dev && s.dev.infinite)) s.coins = Math.max(0, (s.coins || 0) - n); }
  function findPet(s, id) {
    if (s.pet && (!id || s.pet.id === id)) return s.pet;
    return (s.den || []).filter(function (q) { return q.id === id; })[0] || null;
  }
  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function empty() { return { v: 1, pet: null, log: [], curve: XP_CURVE }; }

  // ---- save migrations, numbered (2026-10-10, audit M-5 / SE-8) ------------------------------------------------------
  //  Each one-off upgrade of an older save is a numbered step; a save remembers the last it had (s.v), and only later steps
  //  run. A new game starts at v 1 and takes every step (the gifts are how it gets its net and purse). Every step keeps
  //  its own check, so a save from before the numbering (all v 1) passes through the ones it already had untouched.
  //  ADD A STEP: append it to MIGRATIONS (never renumber or remove one); test it in test/test_pet_migrations.js.
  //  A future XP curve change needs a new step calling rescaleCurve.
  function rescaleCurve(s) {                    // the steeper curve (2026-10-09): you keep every level -- xp grows to match
    if (s.curve === XP_CURVE) return;
    var cf = XP_CURVE / (s.curve || 1), up = function (x) { return typeof x === "number" ? Math.round(x * cf * 100) / 100 : x; };
    if (s.player && s.player.skills) Object.keys(s.player.skills).forEach(function (k) { s.player.skills[k] = up(s.player.skills[k]); });
    [s.pet].concat(Array.isArray(s.den) ? s.den : []).forEach(function (q) {
      if (!q || typeof q !== "object") return;
      if (typeof q.xp === "number") q.xp = up(q.xp);
      if (q.skills) Object.keys(q.skills).forEach(function (k) { q.skills[k] = up(q.skills[k]); });
    });
    s.curve = XP_CURVE;
  }
  var MIGRATIONS = [
    null, null,                                                         // 0 and 1: every save starts at 1
    { v: 2, early: true, what: "The steeper XP curve: xp scaled so you keep your levels (2026-10-09)", run: rescaleCurve },
    { v: 3, what: "Herblore redesign: potions moved to the Apothecary; known herbs into the Herbarium (2026-10-06)", run: function (s) {
      if (s.herbsMoved) return;
      var sk0 = s.player.skills;                                       // the potions you could brew, you still can
      if (sk0.herblore > (sk0.alchemy || 0)) sk0.alchemy = sk0.herblore;
      s.herbarium = s.herbarium || {};
      Object.keys(HERB_TIER_OF).forEach(function (h) { if ((s.bag || {})[h] > 0 && !s.herbarium[h]) s.herbarium[h] = 1; });
      s.herbsMoved = 1;
    } },
    { v: 4, what: "The house: a game already going gets rooms good enough for what it could make (2026-10-07)", run: function (s) {
      if (s.house) return;
      s.house = {};
      ROOM_ORDER.forEach(function (r) {
        var top = 1;
        (ROOMS[r].workshops || []).forEach(function (w) { var sk = WORKSHOPS[w] && WORKSHOPS[w].skill; if (sk) top = Math.max(top, levelOf(s.player.skills[sk] || 0)); });
        var t = 1; while (ROOM_CAP[t] < top && t < 4) t++;
        s.house[r] = ROOMS[r].workshops ? t : 1;
      });
    } },
    { v: 5, what: "Unidentified herbs in one stack, the tiers hidden in it (2026-10-07)", run: function (s) {
      if (!s.bag || typeof s.bag !== "object") return;
      [1, 2, 3, 4, 5].forEach(function (t) {
        var n = s.bag["unidherb" + t] || 0, pool = HERB_TIERS[t - 1].pool;
        delete s.bag["unidherb" + t];
        for (var ui = 0; ui < n; ui++) addUnidRaw(s, pool[ui % pool.length][0]);
      });
    } },
    { v: 6, what: "Areas cleared: from each pet's own record into the game's (2026-10-06)", run: function (s) {
      if (s.cleared) return;
      s.cleared = {};
      [s.pet].concat(s.den || []).forEach(function (q) { Object.keys((q && q.areas) || {}).forEach(function (k) { s.cleared[k] = Math.max(s.cleared[k] || 0, q.areas[k]); }); });
    } },
    { v: 7, what: "An expedition from before stages: run as one stage (2026-10-06)", run: function (s) {
      if (!(s.pet && s.pet.away && !s.pet.away.stages && RUNS[s.pet.away.area])) return;
      var oa = s.pet.away, oR = RUNS[oa.area], ome = runFighter(s.pet, {}), olen = Math.max(1, oa.until - oa.since);
      oa.stage = 0; oa.stages = oR.stages; oa.every = Math.round(olen / oR.stages); oa.until = oa.since + oa.every;
      oa.me = ome; oa.hp = ome.hp; oa.maxHp = ome.hp; oa.pack = {}; oa.used = {}; oa.brews = {}; oa.got = {}; oa.xp = 0; oa.log = []; oa.retreat = 0.3;
      oa.seed = oa.seed || 1;
    } },
    { v: 8, what: "A game that ended before falls were survivable carries on, from nothing (2026-10-06)", run: function (s) {
      if (!s.player.dead || s.mode === "hell") return;
      var dby = s.player.dead.by || "a creature";
      s.player.dead = null; s.player.job = null; s.player.battle = null;
      s.bag = {}; s.unid = {}; s.coins = 0; s.player.gear = {}; s.player.tools = {}; s.player.wear = {}; s.player.brews = {};
      s.player.hp = Math.max(1, Math.round(maxHp(s.player) / 2));
      s.lastFall = { at: 0, by: dby, where: "", lost: null };
    } },
    { v: 9, what: "Gifts: a small net (fishing needs one), a purse of 100 coins, and the crafters' xp (2026-10-04)", run: function (s) {
      if (!s.bag || typeof s.bag !== "object") s.bag = copy(STARTER_BAG);  // a starter kit, once
      if (!Array.isArray(s.gifts)) s.gifts = [];
      if (s.gifts.indexOf("smallnet") < 0) { s.gifts.push("smallnet"); s.bag.smallnet = (s.bag.smallnet || 0) + 1; }
      if (typeof s.coins !== "number") s.coins = 0;
      if (s.gifts.indexOf("purse") < 0) { s.gifts.push("purse"); s.coins += 100; }
      if (s.gifts.indexOf("crafters") < 0) {                            // the crafters left the isle; what they'd learned is yours
        s.gifts.push("crafters");
        var vx = s.village || {}, sk = s.player.skills;
        [["blacksmith", "smithing"], ["blacksmith", "smelting", 0.5], ["fletcher", "fletching"], ["apothecary", "herblore"],
         ["jeweler", "gemology"], ["tailor", "crafting"], ["carpenter", "crafting"], ["farmer", "farming", 0.5]].forEach(function (m) {
          if (vx[m[0]]) sk[m[1]] = Math.round(((sk[m[1]] || 0) + vx[m[0]] * (m[2] || 1)) * 10) / 10;
        });
      }
    } },
    { v: 10, what: "The one charm of slice 3 into its gear slot", run: function (s) {
      if (!s.player.charm) return;
      if (!s.player.gear || typeof s.player.gear !== "object") s.player.gear = {};
      var oc = ITEMS[s.player.charm];
      if (oc && oc.gear && oc.gear.who === "player") s.player.gear[oc.gear.slot] = s.player.charm;
      else if (oc && oc.gear && s.pet) { s.pet.gear = s.pet.gear || {}; s.pet.gear.charm = s.player.charm; }
      delete s.player.charm;
    } },
    { v: 11, late: true, what: "The smaller bags: what no longer fits goes to an Overflow chest (2026-10-10)", run: function (s) {
      if (!s.overflowed) overflowBag(s);
    } },
    { v: 12, late: true, what: "The story: a save from before it keeps everything open (2026-10-10)", run: function (s) {
      if (!s.story) s.story = { on: false };
    } },
    { v: 13, what: "Battle Re-work Part 1: room for battle pets, worn weapons, the off hand (2026-10-15)", run: function (s) {
      if (!Array.isArray(s.beasts)) s.beasts = [];
      if (s.player && (!s.player.tempered || typeof s.player.tempered !== "object")) s.player.tempered = {};
    } },
    { v: 14, what: "Battle Re-work Part 3: class levels -- the class you are starts at its own combat skill's level (Cam, Q2)", run: function (s) {
      var pl = s.player;
      if (!pl || !pl.cls || !CLASSES[pl.cls]) return;
      var box = classBox(pl, pl.cls), sk = CLASS_SKILL[CLASSES[pl.cls].style];
      if (sk && !(box.xp > 0)) box.xp = (pl.skills || {})[sk] || 0;
    } },
    { v: 15, what: "Battle Re-work Part 9: switching class costs now -- a save that already has a class gets one free switch (C1)", run: function (s) {
      var pl = s.player;
      if (pl && pl.cls && !(pl.freeSwitch >= 0)) pl.freeSwitch = 1;
    } },
    { v: 16, what: "Battle Re-work Part 10: quivers -- an archer gets a quiver that holds the arrows they use (PT7)", run: function (s) {
      var pl = s.player, am = pl && pl.gear && pl.gear.ammo;
      if (!am || !ITEMS[am] || pl.gear.quiver) return;
      var t = arrowTier(am), q = t <= 2 ? "leatherquiver" : t <= 4 ? "studdedquiver" : "gatorquiver";
      s.bag = s.bag || {}; s.bag[q] = (s.bag[q] || 0) + 1; pl.gear.quiver = q;
    } },
    { v: 17, what: "Talent ids made unique (2026-10-16): the Beast Master's Thick hide and Shield wall had the Hunter's and the Paladin's ids", run: function (s) {
      var t = s.player && s.player.classes && s.player.classes.beastmaster && s.player.classes.beastmaster.talents;
      if (!t) return;
      [["thickhide", "bmthickhide"], ["shieldwall", "bmshieldwall"]].forEach(function (r) { if (t[r[0]]) { t[r[1]] = (t[r[1]] || 0) + t[r[0]]; delete t[r[0]]; } });
    } },
    { v: 18, what: "C6 (2026-10-17): spiked gauntlets are worn on your arms, like gloves -- the old 'gloves' slot your figure didn't show", run: function (s) {
      var g = s.player && s.player.gear;
      if (!g || !g.gloves) return;
      if (g.arms && g.arms !== g.gloves) { s.bag = s.bag || {}; s.bag[g.arms] = (s.bag[g.arms] || 0) + 1; }   // what was on your arms goes to the bag
      g.arms = g.gloves; delete g.gloves;
    } },
    { v: 19, what: "N19 (2026-10-19): arrows only go in a quiver -- loose arrows, or ones the quiver can't hold, come off (they stay in the bag)", run: function (s) {
      var pl = s.player, am = pl && pl.gear && pl.gear.ammo;
      if (am && ITEMS[am] && needsQuiver(am) && quiverWhyNot(pl, am)) delete pl.gear.ammo;
    } },
    { v: 20, what: "2026-10-20: Amunet's How to Play book, for a game that's past the tutorial (or skipped it)", run: function (s) {
      var T = s.tutorial;
      if (!(s.player && s.player.made) || !T || !(T.done || T.skipped) || hasGuide(s)) return;
      give(s, HOW_TO_PLAY.item.id, 1, true);
    } },
    { v: 21, what: "N24 (2026-10-20): arrows live in the quiver -- a worn quiver starts filled from the bag with the arrows you'd chosen", run: function (s) {
      var pl = s.player, am = pl && pl.gear && pl.gear.ammo, q = am && ITEMS[pl.gear.quiver];
      if (!am || !ITEMS[am] || !needsQuiver(am) || !q || !q.gear || !q.gear.quiver || quiverWhyNot(pl, am) || pl.quiverN) return;
      var n = Math.min(q.gear.quiver.cap, (s.bag || {})[am] || 0);
      if (n > 0) { s.bag[am] -= n; if (s.bag[am] <= 0) delete s.bag[am]; pl.quiverN = n; }
    } }
  ];
  var SAVE_V = MIGRATIONS.length - 1;
  function migrate(s, phase) {
    var from = typeof s.v === "number" && s.v >= 1 ? s.v : 1;
    for (var n = from + 1; n <= SAVE_V; n++) {
      var m = MIGRATIONS[n];
      if ((phase === "early") === !!m.early && (phase === "late") === !!m.late) m.run(s);
    }
  }

  function normal(state) {
    var s = state && typeof state === "object" ? copy(state) : empty();
    useMod(s);
    migrate(s, "early");
    if (!Array.isArray(s.log)) s.log = [];
    if (!s.pet || typeof s.pet !== "object") s.pet = null;
    if (!s.player || typeof s.player !== "object") s.player = newPlayer();
    if (!s.player.skills) s.player.skills = newPlayer().skills;
    SKILL_ORDER.forEach(function (k) { if (typeof s.player.skills[k] !== "number") s.player.skills[k] = k === "hitpoints" ? XP[10] : 0; });
    if (typeof s.player.hp !== "number") s.player.hp = maxHp(s.player);
    if (typeof s.player.retreat !== "number") s.player.retreat = RETREAT;
    if (typeof s.player.food !== "string") s.player.food = "";
    if (typeof s.player.eatBelow !== "number") s.player.eatBelow = EAT_BELOW;
    if (!s.player.brews || typeof s.player.brews !== "object") s.player.brews = {};
    if (s.player.dead === undefined) s.player.dead = null;
    migrate(s, "main");
    s.player.restBonus = restHere(s);                                   // home's bedroom, or an island estate's house (2026-10-08)
    QUARTERS = (function () { var e = hereEstate(s); return e ? QUARTERS_BOOST[partTier(e, "quarters")] : 0; })();
    SKY = s.dev && s.dev.on && (s.dev.sky === "night" || s.dev.sky === "day") ? s.dev.sky : "";
    if (s.tutorial && s.tutorial.skipped && s.player && !s.player.made) defaultPlayer(s);   // an old save that skipped before choosing (PT24)   // the sandbox's day / night switch (PT15)
    if (s.bag && typeof s.bag === "object" && ((s.bag.unidherb || 0) > 0 || s.unid)) trimUnid(s);
    if (!s.cleared) s.cleared = {};
    if (!Array.isArray(s.graveyard)) s.graveyard = [];
    if (s.player.cls === undefined) s.player.cls = null;
    if (!s.player.combat || typeof s.player.combat !== "object") s.player.combat = { style: "accurate", special: "" };
    if (typeof s.player.spec !== "number") s.player.spec = 100;
    if (!s.farm || !Array.isArray(s.farm.plots)) s.farm = { plots: [newPlot()] };
    if (!Array.isArray(s.farm.pots)) s.farm.pots = [];
    if (!s.bag || typeof s.bag !== "object") s.bag = {};
    if (!Array.isArray(s.gifts)) s.gifts = [];
    if (typeof s.coins !== "number") s.coins = 0;
    if (!s.player.tools || typeof s.player.tools !== "object") s.player.tools = {};
    if (!s.player.gear || typeof s.player.gear !== "object") s.player.gear = {};
    delete s.player.charm;
    if (s.pet && (!s.pet.gear || typeof s.pet.gear !== "object")) s.pet.gear = {};
    // slice 5: more pets -- the den (pets that aren't your companion), the hatchery, the Petapedia
    if (!Array.isArray(s.den)) s.den = [];
    if (!Array.isArray(s.hatchery)) s.hatchery = [];
    if (!s.dex || typeof s.dex !== "object") s.dex = {};
    if (s.breeding === undefined) s.breeding = null;
    if (!s.village || typeof s.village !== "object") s.village = {};       // each crafter's xp
    if (!s.hunt || typeof s.hunt !== "object") s.hunt = {};                 // per area: kills toward the boss, wins, losses
    if (s.lastBoss === undefined) s.lastBoss = null;
    [s.pet].concat(s.den).forEach(function (q) {
      if (!q) return;
      if (!q.id) q.id = "p" + Math.abs(q.born | 0).toString(36) + (q.species || "x").charAt(0);
      if (!q.skills) q.skills = { foraging: 0, fishing: 0, mining: 0, lumbering: 0 };
      if (q.hatchAt <= (q.at || 0) && !s.dex[q.species + "/" + q.colour]) s.dex[q.species + "/" + q.colour] = { first: q.hatchAt };
    });
    if (!s.room || typeof s.room !== "object") s.room = {};
    allPets(s).forEach(geneOf);                                         // natures, potential, sex (2026-10-08)
    shipOf(s);                                                          // your ship (Old Salt's rowing boat is the first)
    if (typeof s.player.island !== "string") s.player.island = "";      // where you are: "" = the main island
    migrate(s, "late");
    s.v = SAVE_V;
    (s.den || []).forEach(function (q) {                                // a party member whose expedition is over comes home (2026-10-10)
      if (q && q.away && q.away.party && !(s.pet && s.pet.away && (s.pet.away.party || []).some(function (m) { return m.id === q.id; }))) q.away = null;
    });
    return s;
  }
  /** Saves from before the smaller bags (2026-10-10 audit, I-4): what no longer fits goes, once, into an Overflow chest in the
      home store room -- nothing is lost. You keep tools and gear, then food and potions, then your rarest things; a stack over
      its limit leaves the rest in the chest. The Overflow chest can only be emptied, and goes when it's empty. */
  function overflowBag(s) {
    s.overflowed = true;
    if (!s.player || !s.player.made || (s.dev && s.dev.infinite)) return;
    var cap = bagCap(s), stack = stackCap(s), b = s.bag, over = {}, moved = 0;
    var worn = {};
    Object.keys(s.player.gear || {}).forEach(function (k) { if (s.player.gear[k]) worn[s.player.gear[k]] = 1; });
    Object.keys(s.player.tools || {}).forEach(function (k) { if (s.player.tools[k]) worn[s.player.tools[k]] = 1; });
    var rank = function (id) { var it = ITEMS[id] || {}; return it.tool || it.gear || it.kit ? 0 : it.food || it.heal ? 1 : it.potion || it.brew || it.petbrew ? 2 : 3; };
    var kinds = Object.keys(b).filter(function (k) { return b[k] > 0 && ITEMS[k] && !worn[k]; })
      .sort(function (x, y) { return (x === "unidherb" ? -1 : 0) - (y === "unidherb" ? -1 : 0) || rank(x) - rank(y) || (ITEMS[y].gem || 0) - (ITEMS[x].gem || 0) || (x < y ? -1 : 1); });
    kinds.forEach(function (k, i) {
      if (i >= cap && k !== "unidherb") { over[k] = b[k]; moved += b[k]; delete b[k]; return; }
      if (k !== "unidherb" && b[k] > stack) { over[k] = b[k] - stack; moved += b[k] - stack; b[k] = stack; }
    });
    if (!moved) return;
    s.overflow = over;
    s.log = s.log || [];
    s.log.unshift({ t: (s.log[0] && s.log[0].t) || s.player.at || 0, text: "Bags are smaller now: " + Object.keys(over).length + " kinds of things (" + moved.toLocaleString() +
                    " in all) that didn't fit went into an Overflow chest in your store room at home. Nothing is lost -- take them out as you need them." });
  }

  function note(state, t, text) {
    state.log.unshift({ t: t, text: text });
    if (state.log.length > LOG_MAX) state.log.length = LOG_MAX;
  }

  function stage(pet, now) {
    if (!pet) return "none";
    if (now < pet.hatchAt) return "egg";
    var age = now - pet.hatchAt;
    return age < EXPEDITION_AGE ? "hatchling" : age < ADULT_AGE ? "young" : "adult";
  }

  // One step of `ms` (at most STEP) -- every rule about time is here.
  function step(state, ms) {
    var p = state.pet, s = p.s, h = ms / HOUR, end = p.at + ms;
    if (end <= p.hatchAt) { p.at = end; return; }        // still an egg: nothing changes
    if (p.at <= p.hatchAt) {                             // (<=: an egg the sandbox hatched at once)
      note(state, p.hatchAt, "Your egg hatched -- it's a " + kindName(p) + "! (" + rarityOf(p) + ")");
      discover(state, p, p.hatchAt);
      h = (end - p.hatchAt) / HOUR;                      // only the time since hatching counts
    }
    var r = p.away ? AWAY : p.asleep ? ASLEEP : AWAKE, room = state.room || {};
    s.full = clamp(s.full + r.full * h);
    s.energy = clamp(s.energy + r.energy * h * (p.asleep ? napSpeed(state) : 1));   // the bedroom's pet bed (2026-10-07)
    s.clean = clamp(s.clean + r.clean * h * (room.rug ? 1 - ((ITEMS[room.rug] || ITEMS.rug).cleaner || 0.25) : 1));
    var fun = r.happy * (room.toybox ? 0.75 : 1);
    if (s.full < 25 || s.clean < 25) fun -= 3;          // hungry or grubby: no fun
    if (p.sick) fun -= 3;
    s.happy = clamp(s.happy + fun * h);
    // health: falls while starving or filthy, mends slowly while looked after
    if (s.full <= 0 || s.clean <= 10) s.health = clamp(s.health - 4 * h);
    else if (p.sick) s.health = clamp(s.health - 1 * h);
    else if (s.full > 40 && s.clean > 40) s.health = clamp(s.health + 2 * h);
    if (!p.sick && s.health < 40) { p.sick = true; note(state, end, who(p) + " is feeling poorly."); }
    // sleep: worn out, it drops off; rested, it wakes (not while out on an expedition)
    if (p.away) { p.at = end; return; }
    if (!p.asleep && s.energy <= 0) { p.asleep = true; note(state, end, who(p) + " was worn out and fell asleep."); }
    else if (p.asleep && s.energy >= 100) { p.asleep = false; note(state, end, who(p) + " woke up, rested."); }
    p.at = end;
  }

  /** The state walked forward to `now` (a new object; the old is untouched). */
