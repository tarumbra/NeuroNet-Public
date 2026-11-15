  // ---- Battle Re-work Part 11a: battle pets and the Beast Pen (2026-10-16) ------------------------------------------------
  //      The plan (note 06): "A battle pet is a separate object, kept in s.beasts, with its own fields and rules, handled
  //      independently of companions and home pets ... a freshly hatched pet is assigned once, when it hatches: companion,
  //      home pet or battle pet ... An existing pet can be moved to the Pen for coins at the Warden, but battle pets can't
  //      go back." Cam (Q10): "Yes, for coins at the Warden, and they can't go back."
  //   - a new pet hatches with `choose` set: the Pets page asks once -- keep it at home, or the Pen (free while it's new);
  //   - a battle pet has a TYPE (BEAST_TYPE_OF), a BATTLE LEVEL from its own xp (1-50), stats from its type and level, and
  //     what idle training has added to one stat;
  //   - IDLE TRAINING: a pet put on a stat gains battle xp and that stat's xp while it's fed (feed from the Farm's Feed
  //     store), never past battle level BEAST_PEN.trainCap on its own;
  //   - REST: a fainted pet rests in the Pen (restUntil); food used there cuts it. Fights that faint them come in 11b.
  //   - the class itself, its fight, moves and tree are Part 11b.
  var BEAST_TYPES = CONTENT("BEAST_TYPES");
  var BEAST_TYPE_OF = CONTENT("BEAST_TYPE_OF");
  var BEAST_RULES = CONTENT("BEAST_RULES");
  var BEAST_PEN = CONTENT("BEAST_PEN");
  var WARDEN = CONTENT("WARDEN");
  var BEAST_STATS = ["health", "attack", "defence", "speed"];

  function beastsOf(s) { if (!Array.isArray(s.beasts)) s.beasts = []; return s.beasts; }
  function beastById(s, id) { return beastsOf(s).filter(function (b) { return b.id === id; })[0] || null; }
  /** A pet's type: its kind's (a rare, magic one), else its species'. */
  function beastType(q) { return BEAST_TYPE_OF.kinds[q.species + "/" + q.colour] || BEAST_TYPE_OF.species[q.species] || "beast"; }
  function beastLevel(b) { return Math.min(BEAST_RULES.maxLevel, levelOf(b.xp || 0)); }
  /** What training has added to a stat: +1 for every trainBonusEvery levels of that stat's xp. */
  function beastTrained(b, k) { return Math.floor((levelOf(((b.stat || {})[k]) || 0) - 1) / BEAST_RULES.trainBonusEvery); }
  /** Its health, attack, defence and speed now: its type's base, grown with its battle level, plus its training. */
  function beastStats(b) {
    var base = BEAST_RULES.base[beastType(b)], lv = beastLevel(b), out = {};
    BEAST_STATS.forEach(function (k) { out[k] = Math.round(base[k] * (1 + (lv - 1) * BEAST_RULES.grow[k])) + beastTrained(b, k); });
    return out;
  }
  function penTier(s) { return Math.min(BEAST_PEN.stalls.length - 1, (s.pen && s.pen.tier) || 0); }
  function penStalls(s) { return BEAST_PEN.stalls[penTier(s)] + Math.round(talentSum(s.player).stalls || 0); }   // (Big pen, Part 11b)
  function penRate(s) { return BEAST_PEN.train[penTier(s)] * (1 + (talentSum(s.player).trainPct || 0) + yardTrain(s)); }   // (+ the training dummy)
  function penCap(s) { return BEAST_PEN.trainCap + Math.round(talentSum(s.player).trainCap || 0); }
  function restLeft(b, now) { return Math.max(0, (b.restUntil || 0) - now); }
  /** Idle training up to `now`: battle xp (not past trainCap) and the stat's xp, for the hours it was fed. */
  function penSettle(s, b, now) {
    if (!b.train) { b.trainAt = now; return; }
    var from = b.trainAt || now, to = Math.min(now, b.fedUntil || 0);
    b.trainAt = now;
    if (to <= from) return;
    var gain = penRate(s) * (to - from) / HOUR, cap = XP[penCap(s)];
    b.xp = Math.max(b.xp || 0, Math.min(cap, (b.xp || 0) + gain));
    b.stat = b.stat || {};
    b.stat[b.train] = Math.round(((b.stat[b.train] || 0) + gain) * 10) / 10;
  }
  /** advance() calls this: every battle pet's training, up to now. */
  function resolvePen(s, now) { (s.beasts || []).forEach(function (b) { penSettle(s, b, now); }); }
  /** What moving a den pet into the Pen costs: nothing while it's new (the hatch choice), else by its rarity. */
  function penMovePrice(q) { return q.choose ? 0 : BEAST_PEN.move[rarityOf(q)] || BEAST_PEN.move.Common; }
  function penMoveWhyNot(s, q) {
    if (!q) return "That pet isn't in the den.";
    if (q === s.pet) return "That's your companion -- make another pet your companion first.";
    if (q.away) return who(q) + " is away -- wait till they're home.";
    if (q.job) return who(q) + " is out gathering -- bring them home first.";
    if (s.breeding && (s.breeding.a === q.id || s.breeding.b === q.id)) return who(q) + " is in the nursery being paired.";
    if (beastsOf(s).length >= penStalls(s)) return "The Pen's stalls are full (" + penStalls(s) + ").";
    return "";
  }
  /** A den pet, as a battle pet: its name, kind and colouring come along; its home needs, jobs and skills stay behind. */
  function toBeast(q, now) {
    var b = { id: q.id, name: q.name || "", species: q.species, colour: q.colour, born: q.born, hatchAt: q.hatchAt, joined: now,
              xp: 0, stat: {}, train: "", trainAt: now, fedUntil: 0, restUntil: 0, wins: 0, faints: 0, from: q.choose ? "hatch" : "den" };
    if (q.skin) b.skin = copy(q.skin);
    if (q.gene) b.gene = copy(q.gene);
    return b;
  }
  /** petkeep {id} -- a new pet stays a home pet · penmove {id} -- a den pet into the Pen · pentrain {id, stat} ·
   *  penfeed {} -- fill every training pet's trough · penrest {id, item} -- food cuts a fainted pet's rest ·
   *  penup {} -- more stalls · penname {id, name}. */
  function penAct(s, action, opts, now) {
    if (["petkeep", "penmove", "pentrain", "penfeed", "penrest", "penup", "penname"].indexOf(action) < 0) return null;
    if (action === "petkeep") {
      var k = denPet(s, opts.id);
      if (!k) return no(s, "That pet isn't in the den.");
      delete k.choose;
      return yes(s, now, who(k) + " stays at home.");
    }
    if (action === "penmove") {
      var q = denPet(s, opts.id) || (s.pet && s.pet.id === opts.id ? s.pet : null), why = penMoveWhyNot(s, q);
      if (why) return no(s, why);
      var price = penMovePrice(q);
      if (price && (s.coins || 0) < price && !(s.dev && s.dev.infinite)) return no(s, WARDEN.name + " asks " + price.toLocaleString() + " coins to take " + whom(q) + " into the Pen.");
      if (price && !(s.dev && s.dev.infinite)) s.coins -= price;
      s.den.splice(s.den.indexOf(q), 1);
      beastsOf(s).push(toBeast(q, now));
      return yes(s, now, who(q) + " joined the Beast Pen" + (price ? " (" + price.toLocaleString() + " coins)" : "") + ". " + (q.name ? "They" : "It") + "'s a battle pet now, for good.");
    }
    if (action === "penfeed") {
      var due = beastsOf(s).filter(function (b) { return b.train && (b.fedUntil || 0) < now + (BEAST_PEN.fullHours - BEAST_PEN.feedHours) * HOUR; });
      if (!due.length) return no(s, beastsOf(s).some(function (b) { return b.train; }) ? "Their troughs are full." : "Nobody's training -- put a pet on a stat first.");
      var used = {}, fedN = 0, inf = !!(s.dev && s.dev.infinite);
      due.forEach(function (b) {
        penSettle(s, b, now);
        var until = Math.max(now, b.fedUntil || 0), fed = false;
        while (until + BEAST_PEN.feedHours * HOUR <= now + BEAST_PEN.fullHours * HOUR) {
          var f = BEAST_PEN.feed.filter(function (id) { return inf || (s.bag[id] || 0) > 0; })[0];
          if (!f) break;
          if (!inf) take(s, f, 1);
          used[f] = (used[f] || 0) + 1; until += BEAST_PEN.feedHours * HOUR; fed = true;
        }
        if (fed) { b.fedUntil = until; fedN++; }
      });
      if (!fedN) return no(s, "You need " + BEAST_PEN.feed.map(function (id) { return ITEMS[id].name.toLowerCase(); }).join(" or ") + " -- make some at the Farm's Feed store.");
      return yes(s, now, "You filled " + (fedN === 1 ? "a trough" : fedN + " troughs") + " (" + Object.keys(used).map(function (id) { return used[id] + " × " + ITEMS[id].name.toLowerCase(); }).join(", ") + ").");
    }
    if (action === "penup") {
      var t = penTier(s), up = BEAST_PEN.up[t];
      if (!up) return no(s, "The Pen is as big as it gets.");
      if (levelOf(s.player.skills.construction || 0) < up.construction) return no(s, "More stalls need Construction " + up.construction + ".");
      if ((s.coins || 0) < up.coins && !(s.dev && s.dev.infinite)) return no(s, "More stalls cost " + up.coins.toLocaleString() + " coins.");
      beastsOf(s).forEach(function (b) { penSettle(s, b, now); });     // the old pace up to now
      if (!(s.dev && s.dev.infinite)) s.coins -= up.coins;
      s.pen = s.pen || {}; s.pen.tier = t + 1;
      return yes(s, now, "The Pen has " + penStalls(s) + " stalls now, and training goes quicker.");
    }
    var b = beastById(s, opts.id);
    if (!b) return no(s, "That pet isn't in the Pen.");
    if (action === "pentrain") {
      if (opts.stat && BEAST_STATS.indexOf(opts.stat) < 0) return no(s, "Train health, attack, defence or speed.");
      if (opts.stat && restLeft(b, now)) return no(s, who(b) + " is resting -- training waits.");
      penSettle(s, b, now);
      b.train = opts.stat || "";
      return yes(s, now, b.train ? who(b) + " trains " + BEAST_RULES.stats[b.train].toLowerCase() + (b.fedUntil > now ? "." : " -- once there's feed in the trough.") : who(b) + " rests from training.");
    }
    if (action === "penrest") {
      var it = ITEMS[opts.item];
      if (!restLeft(b, now)) return no(s, who(b) + " isn't resting.");
      if (!it || !it.heal) return no(s, "Food that heals helps a pet rest.");
      if (!has(s, opts.item)) return no(s, "There's no " + it.name.toLowerCase() + " in the bag.");
      if (!(s.dev && s.dev.infinite)) take(s, opts.item, 1);
      b.restUntil = Math.max(now, b.restUntil - it.heal * BEAST_PEN.foodMinutes * MIN);
      return yes(s, now, who(b) + " ate the " + it.name.toLowerCase() + (restLeft(b, now) ? "." : " and is ready again."));
    }
    var nm = String(opts.name || "").replace(/\s+/g, " ").trim().slice(0, 24);
    if (!nm) return no(s, "Give them a name.");
    b.name = nm;
    return yes(s, now, "Named " + nm + ".");
  }
  /** How long a fainted pet rests (11b's fights call it): longer for higher levels, shorter in a bigger Pen. */
  function restFor(s, b) { return Math.round((BEAST_PEN.restBase + BEAST_PEN.restPerLevel * beastLevel(b)) * BEAST_PEN.restMult[penTier(s)]) * MIN; }
  /** The Pen: your battle pets, what moving one in costs, the troughs and the stalls. From an advanced state. */
  function penView(s, now) {
    var t = penTier(s), up = BEAST_PEN.up[t];
    var pk = packBeasts(s, s.player);
    return { tonics: (s.bag || {}).pettonic || 0, pack: s.player.cls === "beastmaster" ? pk.map(who) : null, stalls: penStalls(s), tier: t, rate: Math.round(penRate(s)), cap: penCap(s), warden: WARDEN,
             up: up ? { construction: up.construction, coins: up.coins, stalls: BEAST_PEN.stalls[t + 1], can: levelOf(s.player.skills.construction || 0) >= up.construction && ((s.coins || 0) >= up.coins || !!(s.dev && s.dev.infinite)) } : null,
             feed: BEAST_PEN.feed.map(function (id) { return { id: id, name: ITEMS[id].name, have: s.bag[id] || 0 }; }),
             beasts: beastsOf(s).map(function (b) {
               var lv = beastLevel(b), ty = beastType(b), rl = restLeft(b, now);
               return { id: b.id, name: b.name || kindName(b), named: !!b.name, kind: kindName(b), species: b.species, colour: b.colour, skin: b.skin || null,
                        type: ty, typeName: BEAST_TYPES[ty].name, strong: BEAST_TYPES[ty].strong.map(function (x) { return BEAST_TYPES[x].name; }),
                        weak: Object.keys(BEAST_TYPES).filter(function (x) { return x !== "//" && BEAST_TYPES[x].strong.indexOf(ty) >= 0; }).map(function (x) { return BEAST_TYPES[x].name; }),
                        level: lv, progress: lv >= BEAST_RULES.maxLevel ? 1 : ((b.xp || 0) - XP[lv]) / (XP[lv + 1] - XP[lv]), stats: beastStats(b),
                        trained: BEAST_STATS.reduce(function (o, k) { o[k] = beastTrained(b, k); return o; }, {}),
                        train: b.train, fed: (b.fedUntil || 0) > now, fedLeft: Math.max(0, (b.fedUntil || 0) - now), capped: !!b.train && lv >= penCap(s), moves: beastMovesView(b, s.player),
                        resting: rl > 0, restLeft: rl, wins: b.wins || 0, faints: b.faints || 0,
                        teach: tomeTeachable(s, b), later: tomeLater(s, b), tomeMoves: (b.tomeMoves || []).length, risen: !!b.risen, loan: b.loan ? classTutor(b.loan).standIn : "" }; }),   // (lent by a class tutor, 2026-10-17)   // (move tomes, the risen: Parts 14, 13)
             yard: ["dummy", "ring"].map(function (k) { var Y = PEN_YARD[k]; return { id: k, name: Y.name, built: yardHas(s, k), construction: Y.construction, coins: Y.coins, items: itemsText(Y.items),
                     can: !yardHas(s, k) && levelOf(s.player.skills.construction || 0) >= Y.construction }; }),
             spar: yardHas(s, "ring") ? beastsOf(s).map(function (b) { return { id: b.id, name: who(b), ready: !restLeft(b, now) && !sparLeft(b, now), wait: Math.ceil(sparLeft(b, now) / MIN) }; }) : null,
             tomes: Object.keys(MOVE_TOMES.items).map(function (k) { return { id: k, name: ITEMS[k].name, have: (s.bag || {})[k] || 0 }; }), tomePrice: MOVE_TOMES.price, found: regionTomesHeld(s), tomeMax: MOVE_TOMES.max,
             den: (s.den || []).filter(function (q) { return q !== s.pet; }).map(function (q) { return { id: q.id, name: who(q), kind: kindName(q), species: q.species, colour: q.colour, skin: q.skin || null, type: BEAST_TYPES[beastType(q)].name, price: penMovePrice(q), fresh: !!q.choose, why: penMoveWhyNot(s, q) }; }) };
  }
