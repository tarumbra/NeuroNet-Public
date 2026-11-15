  // ---- Battle Re-work Part 11b: the Beast Master -- a pack of battle pets in your fights (2026-10-16) ----------------------
  //      The plan (note 06): "You choose 1 pet to start (2 at class level 15 in the Bond branch, 3 at 30). Each round: each
  //      pet in the fight uses a move you choose (or its default in idle hunts); or you use an item on a pet ... or you swap
  //      a pet from the bench ... The creature attacks a pet (the front one, or at random). You're never hurt. Every pet
  //      fainted means the fight is lost and you go home." Q11: in Hardcore and Hell, beyond the early grounds, they can die.
  //   - YOUR PACK (pl.combat.pack): battle pets in order -- the first packSize fight, up to BEAST_FIGHT.bench more wait;
  //   - MOVES: a pet learns its type's moves by battle level and uses up to 4 (b.moves); you pick a move in a fight and it
  //     repeats ("Repeat last moves", decided in Q-round 3) until you change it -- left alone, a pet picks for itself;
  //   - the fight is battleRound's, through packRound when the battle carries a pack; it ends "beaten" when every pet
  //     in it has fainted (never "dead": you aren't hurt);
  //   - Command / Rally / Wild call are the class's specials, from the special bar; a crook adds to your pets' attack and
  //     gives you a small blow of your own.
  var BEAST_MOVES = CONTENT("BEAST_MOVES");
  var BEAST_CREATURE_TYPE = CONTENT("BEAST_CREATURE_TYPE");
  var BEAST_FIGHT = CONTENT("BEAST_FIGHT");
  var BEASTMASTER_ITEMS = CONTENT("BEASTMASTER_ITEMS");
  var BEAST_PP = CONTENT("BEAST_PP");
  Object.keys(BEASTMASTER_ITEMS).forEach(function (k) { if (k !== "//") { ITEMS[k] = BEASTMASTER_ITEMS[k]; WEAR[k] = copy(ITEMS[k].gear.req); } });
  var BEASTMASTER_WEAPONS = CONTENT("BEASTMASTER_WEAPONS");
  Object.keys(BEASTMASTER_WEAPONS).forEach(function (k) { if (k !== "//") WEAPONS[k] = BEASTMASTER_WEAPONS[k]; });
  var BEASTMASTER_RECIPES = CONTENT("BEASTMASTER_RECIPES");
  BEASTMASTER_RECIPES.crafting.forEach(function (r) { WORKSHOPS.crafting.recipes.push(r); });
  CLASSES.beastmaster = CONTENT("BEASTMASTER_CLASS");
  var MOVES_BY_TYPE = {};
  var SPECIES_MOVES = {};                                                  // a species with moves of its own (the Astral egg's, V10)
  Object.keys(BEAST_MOVES).forEach(function (id) { if (id === "//") return; var t = BEAST_MOVES[id].type; (MOVES_BY_TYPE[t] = MOVES_BY_TYPE[t] || []).push(id); });
  Object.keys(MOVES_BY_TYPE).forEach(function (t) { MOVES_BY_TYPE[t].sort(function (a, b) { return BEAST_MOVES[a].level - BEAST_MOVES[b].level; }); });

  /** The moves a battle pet has learned: its type's, up to its battle level. */
  function movesLearned(bst) { var lv = beastLevel(bst); return (SPECIES_MOVES[bst.species] || MOVES_BY_TYPE[beastType(bst)] || []).filter(function (id) { return BEAST_MOVES[id].level <= lv; }).concat(tomeMovesOf(bst)); }   // (+ a tome's, Part 14)
  /** The (up to 4) moves it uses: yours, kept to what it knows, empty slots filled with what it learns next. */
  function movesOf(bst) {
    var known = movesLearned(bst), mv = (bst.moves || []).filter(function (id) { return known.indexOf(id) >= 0; });
    known.forEach(function (id) { if (mv.length < BEAST_FIGHT.slots && mv.indexOf(id) < 0) mv.push(id); });
    return mv;
  }
  function packSize(pl) { return BEAST_FIGHT.pack + Math.round(talentSum(pl).packSize || 0); }
  /** Your pack, as the battle pets themselves (in order, those that still exist). */
  function packBeasts(s, pl) { return ((pl.combat || {}).pack || []).map(function (id) { return beastById(s, id); }).filter(Boolean); }
  function crookOf(s, pl) { var w = (pl.gear || {}).weapon; return w && ITEMS[w] && ITEMS[w].gear && ITEMS[w].gear.style === "pack" && !cantWear(s, w) ? w : ""; }
  /** A battle pet's health now: what it had, plus what it's healed since (between fights). */
  function beastHp(s, pl, bst, at) {
    var mx = beastMaxHp(pl, bst);
    if (typeof bst.hp !== "number") return mx;
    var mins = Math.max(0, (at - (bst.hpAt || at)) / MIN), tl = talentSum(pl);
    return Math.min(mx, Math.floor(bst.hp + mx * (BEAST_FIGHT.regen + (tl.petRegen || 0)) * mins));
  }
  function beastMaxHp(pl, bst) { return Math.max(1, Math.round(beastStats(bst).health * (1 + (talentSum(pl).petHp || 0)))); }
  /** A battle pet ready for a fight: its fight numbers. */
  function petInFight(s, pl, bst, at) {
    var st = beastStats(bst), lv = beastLevel(bst), F = BEAST_FIGHT.fight, tl = talentSum(pl), cr = crookOf(s, pl);
    return { id: bst.id, name: bst.name || kindName(bst), species: bst.species, colour: bst.colour, type: beastType(bst), level: lv,
             att: Math.round((lv * F.attLevel + st.attack * F.attStat + (cr ? ITEMS[cr].gear.att : 0)) * (1 + (tl.petAcc || 0))),
             def: lv * F.defLevel + st.defence * F.defStat, maxHit: F.hitBase + Math.floor((lv + st.attack) / F.hitDiv),
             dodge: Math.min(F.dodgeMax, st.speed * F.dodgePerSpeed) + (tl.petDodge || 0), dtype: PET_ATTACKS[bst.species] || "crush",
             hp: beastHp(s, pl, bst, at), maxHp: beastMaxHp(pl, bst), moves: movesOf(bst), uses: {}, pp: copy(bst.pp || {}), last: "", next: "", fought: false };
  }
  function petReady(s, pl, bst, at) { return !restLeft(bst, at) && beastHp(s, pl, bst, at) > 0; }
  /** startBattle for a Beast Master: the pets in the fight and on the bench. */
  function startPack(s, pl, kind, groundId, monId, at, holder) {
    // no pack chosen yet: the Pen's ready pets go, and that's your pack now (Cam, 2026-10-17: "cant seem to add a pet to my
    // pack for hunting" -- the pack is chosen on the Combat tab, and an empty one stopped every hunt)
    if (!packBeasts(s, pl).length && beastsOf(s).some(function (bst) { return petReady(s, pl, bst, at); })) {
      pl.combat = pl.combat || {};
      pl.combat.pack = beastsOf(s).filter(function (bst) { return petReady(s, pl, bst, at); }).slice(0, packSize(pl) + BEAST_FIGHT.bench).map(function (bst) { return bst.id; });
      note(s, at, "Your pack wasn't chosen, so " + packBeasts(s, pl).map(who).join(", ") + " came along -- change it on your Character sheet's Combat tab.");
    }
    var ready = packBeasts(s, pl).filter(function (bst) { return petReady(s, pl, bst, at); }).slice(0, packSize(pl) + BEAST_FIGHT.bench);
    if (!ready.length) return { out: "battle pet", why: beastsOf(s).length ? "No battle pets ready (resting, or not in your pack -- the Combat tab)" : "No battle pets -- a Beast Master's pack lives in the Beast Pen" };
    var ngx = (1 + 0.2 * (s.ngPlus || 0)) * rate("monsters"), cb = pl.combat || {};
    var cls = CLASSES.beastmaster, sp = cls.specials[cb.special];
    pl.battle = { kind: kind, ground: groundId, mon: monId, mhp: Math.round(MONSTERS[monId].hp * ngx), mhp0: Math.round(MONSTERS[monId].hp * ngx), ng: s.ngPlus || 0, start: at, nextRound: at + ROUND, n: 0,
                  rounds: [], me: { style: "accurate", def: 0, maxHit: 0, tal: talentSum(pl) }, style: "pack", ammo: 0, seed: Math.floor(rnd(holder) * 4294967296) | 0,
                  skip: false, queued: !!(cb.queued && sp && specMeter(pl, null) >= specCostOf(pl, sp) && !specialLock(pl, sp)), rage: false, items: {},
                  pack: { size: Math.min(packSize(pl), ready.length), pets: ready.map(function (bst) { return petInFight(s, pl, bst, at); }), command: false, wild: 0, crook: crookOf(s, pl) } };
    if (cb.queued) delete cb.queued;
    return { ok: true };
  }
  function fighting(P) { return P.pets.slice(0, P.size).filter(function (p) { return p.hp > 0; }); }
  // ---- PP (V5, 2026-10-17): every move's uses, carried through a hunt; out of them, Scrap (BEAST_PP in the content) ----
  BEAST_MOVES.scrap = { name: BEAST_PP.scrap.name, about: BEAST_PP.scrap.about, power: BEAST_PP.scrap.power, level: 1, scrap: true };   // (no type: never one a pet learns)
  /** A move's PP when full: by its kind, + the talent's for the strong ones. */
  function ppMax(pl, id) {
    var M = BEAST_MOVES[id];
    if (!M || M.scrap) return Infinity;
    var base = M.uses ? BEAST_PP.strong : M.heal ? BEAST_PP.heal : !M.power ? BEAST_PP.status : M.power >= BEAST_PP.bigPower ? BEAST_PP.big : BEAST_PP.hit;
    return base + (M.uses ? Math.round((talentSum(pl).moveUses || 0) * BEAST_PP.talentPP) : 0);
  }
  /** PP left (a move it's never used is full). p: a pet in a fight or a battle pet. */
  function ppLeft(pl, p, id) { var m = ppMax(pl, id), v = (p.pp || {})[id]; return typeof v === "number" ? Math.min(m, v) : m; }
  function moveUsesLeft(pl, p, id) { return id === "scrap" || ppLeft(pl, p, id) > 0; }
  /** Fill every PP: the pack's home from a hunt, a pet's rested, a Pet tonic. */
  function ppFill(bst) { bst.pp = {}; }
  ITEMS.pettonic = BEAST_PP.tonic.item;                                    // the Pet tonic: made at the apothecary (the Economist's sink)
  WORKSHOPS.apothecary.recipes.push(BEAST_PP.tonic.recipe);
  /** A pet's own choice of move: heal when hurt, an effect the creature hasn't got, else its hardest blow. */
  function autoMove(pl, b, p) {
    var mv = p.moves.filter(function (id) { return moveUsesLeft(pl, p, id); }), on = function (k) { return ((b.fx && b.fx.them) || []).some(function (e) { return e.kind === k && e.rounds > 0; }); };
    var heal = mv.filter(function (id) { return BEAST_MOVES[id].heal; })[0];
    if (heal && p.hp < p.maxHp * 0.35) return heal;
    var fx = mv.filter(function (id) { var M = BEAST_MOVES[id]; return !M.power && M.fx && !on(M.fx.kind) && !(p.tried || {})[id]; })[0];
    if (fx) return fx;
    var hits = mv.filter(function (id) { var M = BEAST_MOVES[id]; return M.power > 0 && (!M.uses || b.mhp > p.maxHit * 3); });
    hits.sort(function (a, c) { var A = BEAST_MOVES[a], C = BEAST_MOVES[c]; return C.power * (C.acc || 1) * (C.hits || 1) - A.power * (A.acc || 1) * (A.hits || 1); });
    return hits[0] || mv[0] || "scrap";                                 // out of PP: Scrap (V5)
  }
  /** The move a pet uses this round: the one you picked (it repeats), unless it can't help now. */
  function moveNow(pl, b, p) {
    var id = p.next || p.last, M = id && BEAST_MOVES[id];
    p.next = "";
    if (!M || (p.moves.indexOf(id) < 0 && id !== "scrap") || !moveUsesLeft(pl, p, id)) return autoMove(pl, b, p);
    var on = M.fx && ((b.fx && b.fx.them) || []).some(function (e) { return e.kind === M.fx.kind && e.rounds > 0; });
    if (!M.power && ((M.fx && on) || (M.guard && p.guardR > 0) || (M.dodge && p.dodgeR > 0) || (M.heal && p.hp >= p.maxHp))) return autoMove(pl, b, p);
    return id;
  }
  function typeMult(pl, petType, monId) {
    var ct = BEAST_CREATURE_TYPE[monId] || "beast", tl = talentSum(pl);
    if (BEAST_TYPES[petType].strong.indexOf(ct) >= 0) return BEAST_RULES.strong * (1 + (tl.typeDmg || 0));
    if (BEAST_TYPES[ct] && BEAST_TYPES[ct].strong.indexOf(petType) >= 0) return BEAST_RULES.weak;
    return 1;
  }
  /** One pet's turn. */
  function petTurn(s, pl, b, p, at, log) {
    var mon = MONSTERS[b.mon], tl = b.me.tal || {}, id = moveNow(pl, b, p), M = BEAST_MOVES[id];
    p.fought = true;
    if (id !== "scrap") { p.pp = p.pp || {}; p.pp[id] = ppLeft(pl, p, id) - 1; }   // a PP spent (V5)
    if (M.heal) { var h = Math.max(1, Math.round(p.maxHp * M.heal * (1 + (tl.petHeal || 0)))); p.hp = Math.min(p.maxHp, p.hp + h); log({ by: "pet", pet: p.name, move: M.name, heal: h }); return; }
    if (M.guard) { p.guardR = M.guard.rounds; p.guardCut = M.guard.cut; log({ by: "pet", pet: p.name, move: M.name, guard: true }); return; }
    if (M.dodge) { p.dodgeR = M.dodge.rounds; p.dodgeC = M.dodge.chance; log({ by: "pet", pet: p.name, move: M.name, fade: true }); return; }
    var gd = b.fx ? fxMult(b, "them", "defMult") : 1, acc = Math.min(0.98, chance(p.att, gd === 1 ? mon.def : mon.def * gd) * (M.acc || 1));
    var tm = typeMult(pl, M.type || p.type, b.mon), dt = M.dtype || p.dtype;   // a tome's move keeps its own type (Part 14)
    if (!M.power) {
      p.tried = p.tried || {}; p.tried[id] = true;
      if (rnd(b) < acc) { addEffect(b, "them", M.fx.kind, { rounds: M.fx.rounds, power: M.fx.power || 0, lvl: p.level }, at); log({ by: "pet", pet: p.name, move: M.name, status: true }); }
      else log({ by: "pet", pet: p.name, move: M.name, hit: 0 });
      return;
    }
    for (var h2 = 0; h2 < (M.hits || 1) && b.mhp > 0; h2++) {
      if (rnd(b) >= acc) { log({ by: "pet", pet: p.name, move: M.name, hit: 0 }); continue; }
      if (mon.eva && rnd(b) < mon.eva) { log({ by: "pet", pet: p.name, move: M.name, hit: 0, dodged: true }); continue; }
      var d = Math.max(1, Math.round((1 + Math.floor(rnd(b) * p.maxHit)) * M.power * mult(mon.weak, dt) * mult(mon.resist, dt) * tm
                * (1 + (tl.petDmg || 0)) * (mon.boss ? 1 + (tl.petBoss || 0) : 1) * (b.pack.wild > 0 ? 1 + CLASSES.beastmaster.specials.wildcall.wild : 1) * poisonedMult(b)));
      b.mhp -= d;
      log({ by: "pet", pet: p.name, move: M.name, hit: d, strong: tm > 1, weak: tm < 1 });
      if (M.drain) p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round(d * M.drain)));
      if (M.fx && b.mhp > 0 && rnd(b) < (M.fx.chance || 1) * (1 + (tl.moveFx || 0))) addEffect(b, "them", M.fx.kind, { rounds: M.fx.rounds, power: M.fx.power || 0, lvl: p.level }, at);
    }
  }
  /** battleRound, for a pack. "" while it goes on, else "won" | "fled" | "beaten". */
  function packRound(s, pl, b, at) {
    var mon = MONSTERS[b.mon], P = b.pack, cls = CLASSES.beastmaster, cb = pl.combat || {}, tl = b.me.tal || {};
    var log = function (o) { o.t = at; b.rounds.push(o); if (b.rounds.length > 40) b.rounds.shift(); };
    b.n++;
    var sp = null;
    if (b.queued && cls.specials[cb.special] && specMeter(pl, b) >= specCostOf(pl, cls.specials[cb.special]) && !specialLock(pl, cls.specials[cb.special])) {
      sp = cls.specials[cb.special]; specPay(pl, b, specCostOf(pl, sp));
    }
    b.queued = false;
    if (sp && sp.command) P.command = true;
    if (sp && sp.wild) P.wild = 3;
    if (sp && sp.rally) { fighting(P).forEach(function (p) { p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round(p.maxHp * sp.rally))); }); log({ by: "you", rally: true, spec: sp.name }); }
    else if (sp) log({ by: "you", spec: sp.name, hit: 0, call: true });
    var won = function () { b.mhp = 0; return "won"; };
    var team = fighting(P);
    for (var i = 0; i < team.length && b.mhp > 0; i++) {
      var p = team[i];
      if (p.skip) { log({ by: "pet", pet: p.name, ate: p.skip === "ate", swapIn: p.skip === "swap" }); p.skip = ""; p.fought = true; continue; }
      for (var a = 0; a < (i === 0 && P.command ? 2 : 1) && b.mhp > 0; a++) petTurn(s, pl, b, p, at, log);
    }
    P.command = false;
    if (b.mhp > 0 && P.crook && rnd(b) < 0.7) {                              // your crook: a small blow of your own
      var cd = 1 + Math.floor(rnd(b) * (1 + Math.floor(ITEMS[P.crook].gear.att / 3)));
      b.mhp -= cd; log({ by: "you", hit: cd, w: ITEMS[P.crook].name, wp: true });
    }
    if (b.mhp <= 0) return won();
    // the creature's turn: the front pet, mostly
    team = fighting(P);
    var tellNow = bossTell(s, pl, b, at, log);                             // a boss's tell (creature tells)
    var held = b.fx ? fxHeld(b, "them") : "";
    if (tellNow === "wind" || tellNow === "broken") { /* its turn went on the tell */ }
    else if (held) log({ by: "them", hit: 0, held: held });
    else if (team.length) {
      var tgt = team.length > 1 && rnd(b) >= BEAST_FIGHT.front ? team[1 + Math.floor(rnd(b) * (team.length - 1))] : team[0];
      var theirs = Math.max(0.05, Math.min(0.9, (mon.att + 1) / (mon.att + tgt.def + 4))) * (b.fx ? fxMult(b, "them", "accMult") : 1);
      if (rnd(b) < Math.min(0.95, theirs * tellAcc(b))) {
        if (rnd(b) < tgt.dodge + (tgt.dodgeR > 0 ? tgt.dodgeC : 0)) log({ by: "them", hit: 0, dodged: true, pet: tgt.name });
        else {
          var t = Math.max(1, Math.round((1 + Math.floor(rnd(b) * mon.maxHit)) * (1 + 0.15 * (b.ng || 0)) * (b.fx ? fxMult(b, "them", "hitMult") : 1) * rate("monsters") * tellMult(b)
                    * (1 - (tgt.guardR > 0 ? tgt.guardCut : 0)) * (1 - Math.min(0.3, tl.petDr || 0))));
          tgt.hp = Math.max(0, tgt.hp - t);
          log({ by: "them", hit: t, pet: tgt.name, faint: tgt.hp <= 0 });
        }
      } else log({ by: "them", hit: 0, pet: tgt.name });
    }
    b.tellHit = null;
    if (b.fx) { fxTick(s, pl, b, at); if (b.mhp <= 0) return won(); }
    P.pets.forEach(function (p) { if (p.guardR > 0) p.guardR--; if (p.dodgeR > 0) p.dodgeR--; });
    if (P.wild > 0) P.wild--;
    // a fainted pet's place: the next from the bench steps in (its turn is the step)
    for (var k = 0; k < P.size; k++) {
      if (P.pets[k] && P.pets[k].hp > 0) continue;
      var bi = -1;
      for (var q = P.size; q < P.pets.length; q++) if (P.pets[q].hp > 0) { bi = q - P.size; break; }
      if (bi < 0) continue;
      var inn = P.pets.splice(P.size + bi, 1)[0], out = P.pets.splice(k, 1, inn)[0];
      P.pets.push(out); inn.skip = "swap"; log({ by: "pet", pet: inn.name, swapIn: true });
    }
    if (!fighting(P).length) return "beaten";
    if (b.n >= 80) return "fled";
    b.nextRound = at + ROUND;
    return "";
  }
  /** After a pack's fight: health kept, faints rest (or, in Hardcore and Hell beyond the early grounds, die), xp shared. */
  function packAfterFight(s, pl, b, res, at) {
    var P = b.pack;
    if (!P) return;
    var mon = MONSTERS[b.mon], tl = talentSum(pl), fought = P.pets.filter(function (p) { return p.fought; }), mode = modeOf(s);
    var ground = HUNTS[b.ground], deep = ground && ground.level > BEAST_FIGHT.safeTo, dieP = mode === "adventure" ? 0 : (BEAST_FIGHT.die[mode] || 0);   // never in Adventure (Q11)
    P.pets.forEach(function (p) {
      var bst = beastById(s, p.id);
      if (!bst) return;
      bst.hp = p.hp; bst.hpAt = at;
      bst.pp = copy(p.pp || {});                                           // PP carry to the next fight (V5) ...
      if (res === "won") Object.keys(bst.pp).forEach(function (k) { bst.pp[k] = Math.min(ppMax(pl, k), bst.pp[k] + BEAST_PP.regen); });   // ... and a win gives a breather
      if (p.hp > 0) return;
      bst.faints = (bst.faints || 0) + 1;
      if (deep && dieP && rnd(b) < dieP) { beastDies(s, bst, at, ground, mon); return; }
      bst.restUntil = at + Math.round(restFor(s, bst) * (1 - Math.min(0.5, tl.restCut || 0)));
      ppFill(bst);                                                         // resting in the Pen fills its PP (V5)
      bst.train = bst.train || "";
      note(s, at, who(bst) + " fainted and went to rest in the Beast Pen.");
    });
    if (res === "won" && pl.food && ITEMS[pl.food] && ITEMS[pl.food].heal) packEat(s, pl, at);   // the hunt plan's food, between fights
    // ... and a Pet tonic for a pet down to Scrap (PT18 p4): every move it uses out of PP, one in the bag -- it drinks before the next fight
    if (res === "won") P.pets.forEach(function (p) {
      var bst = beastById(s, p.id);
      if (!bst || p.hp <= 0 || !movesOf(bst).length || movesOf(bst).some(function (id) { return ppLeft(pl, p, id) > 0; })) return;   // (as the fight left it, before the win's breather)
      if (!has(s, "pettonic") && !(s.dev && s.dev.infinite)) return;
      if (!(s.dev && s.dev.infinite)) take(s, "pettonic", 1);
      ppFill(bst); note(s, at, who(bst) + " was down to scrapping -- it drank a Pet tonic between fights.");
    });
    if (res !== "won" || !fought.length) return;
    feat(pl, "packwins");
    var share = BEAST_FIGHT.xpShare[Math.min(fought.length, BEAST_FIGHT.xpShare.length) - 1] * (1 + (tl.petXp || 0));
    fought.forEach(function (p) {
      var bst = beastById(s, p.id);
      if (!bst) return;
      var l0 = beastLevel(bst), m0 = movesLearned(bst);
      bst.xp = Math.round(((bst.xp || 0) + killXp(mon) * share) * 10) / 10;
      bst.wins = (bst.wins || 0) + 1;
      var l1 = beastLevel(bst);
      if (l1 > l0) {
        var nw = movesLearned(bst).filter(function (id) { return m0.indexOf(id) < 0; });
        note(s, at, who(bst) + " reached battle level " + l1 + "!" + (nw.length ? " It learned " + nw.map(function (id) { return BEAST_MOVES[id].name; }).join(" and ") +
             (movesOf(bst).length >= BEAST_FIGHT.slots && nw.some(function (id) { return movesOf(bst).indexOf(id) < 0; }) ? " -- choose its four moves in the Beast Pen." : ".") : ""));
      }
    });
  }
  /** Between fights: your plan's food for every pet in the pack below the line (healing 20% less than for you). */
  function packEat(s, pl, at) {
    packBeasts(s, pl).forEach(function (bst) {
      var mx = beastMaxHp(pl, bst), hp = beastHp(s, pl, bst, at);
      while (hp > 0 && hp < mx * pl.eatBelow && has(s, pl.food)) {
        if (!(s.dev && s.dev.infinite)) take(s, pl.food, 1);
        hp = Math.min(mx, hp + Math.max(1, Math.round(ITEMS[pl.food].heal * BEAST_FIGHT.foodCut * (1 + (talentSum(pl).petFood || 0)))));
        if (s.dev && s.dev.infinite) break;
      }
      bst.hp = hp; bst.hpAt = at;
    });
  }
  /** Q11: a battle pet lost in Hardcore or Hell, beyond the early grounds -- to the Graveyard (a Necromancer may raise it, Part 13). */
  function beastDies(s, bst, at, ground, mon) {
    s.beasts.splice(s.beasts.indexOf(bst), 1);
    s.graveyard = s.graveyard || [];
    s.graveyard.unshift({ name: who(bst), kind: kindName(bst), species: bst.species, colour: bst.colour, rarity: rarityOf(bst), level: beastLevel(bst),
                          ageDays: Math.max(0, Math.round((at - (bst.hatchAt || at)) / DAY * 10) / 10), area: ground.name, cause: "fell to " + mon.name.toLowerCase() + " in a fight",
                          at: at, cleared: 0, gear: [], battle: true, pet: copy(bst) });
    if (s.graveyard.length > 200) s.graveyard.length = 200;
    var pl = s.player; if (pl.combat && pl.combat.pack) pl.combat.pack = pl.combat.pack.filter(function (id) { return id !== bst.id; });
    note(s, at, who(bst) + " fell to " + mon.name + " and didn't get up. They're in the Graveyard now.");
  }
  /** pack {ids} -- your pack, in order · penmoves {id, moves} -- a battle pet's four moves ·
   *  battle {cmd: "move", i, move} / {cmd: "petfeed", i, item} / {cmd: "petswap", i, j}. */
  function packAct(s, action, opts, now) {
    var pl = s.player;
    if (action === "pack") {
      var ids = (opts.ids || []).filter(function (id, i, a) { return beastById(s, id) && a.indexOf(id) === i; });
      var max = packSize(pl) + BEAST_FIGHT.bench;
      if (ids.length > max) return no(s, "Your pack is " + packSize(pl) + " in a fight and " + BEAST_FIGHT.bench + " on the bench.");
      pl.combat = pl.combat || {}; pl.combat.pack = ids;
      return { ok: true, msg: ids.length ? "Your pack: " + ids.map(function (id) { return who(beastById(s, id)); }).join(", ") + "." : "Your pack is empty.", state: s };
    }
    if (action === "pentonic") {                                         // a Pet tonic: fills a battle pet's PP (V5)
      var tb = beastById(s, opts.id);
      if (!tb) return no(s, "That pet isn't in the Pen.");
      if (!movesOf(tb).some(function (id) { return ppLeft(pl, tb, id) < ppMax(pl, id); })) return no(s, who(tb) + "'s moves are all full.");
      if (!has(s, "pettonic") && !(s.dev && s.dev.infinite)) return no(s, "There's no Pet tonic in the bag -- make one at the apothecary table.");
      if (!(s.dev && s.dev.infinite)) take(s, "pettonic", 1);
      ppFill(tb);
      return { ok: true, msg: who(tb) + " drank the Pet tonic: every move's PP is full again.", state: s };
    }
    if (action === "penmoves") {
      var bst = beastById(s, opts.id);
      if (!bst) return no(s, "That pet isn't in the Pen.");
      var known = movesLearned(bst), mv = (opts.moves || []).filter(function (id, i, a) { return known.indexOf(id) >= 0 && a.indexOf(id) === i; });
      if (!mv.length) return no(s, "Choose at least one move it knows.");
      if (mv.length > BEAST_FIGHT.slots) return no(s, "A pet uses " + BEAST_FIGHT.slots + " moves.");
      bst.moves = mv;
      return { ok: true, msg: who(bst) + "'s moves: " + mv.map(function (id) { return BEAST_MOVES[id].name; }).join(", ") + ".", state: s };
    }
    if (action !== "battle" || ["move", "petfeed", "pettonic", "petswap"].indexOf(opts.cmd) < 0) return null;
    var b = pl.battle, P = b && b.pack;
    if (!P) return no(s, "That's for a Beast Master's fight.");
    var p = P.pets[opts.i | 0];
    if (!p || (opts.i | 0) >= P.size || p.hp <= 0) return no(s, "That pet isn't in the fight.");
    var msg = "";
    if (opts.cmd === "move") {
      if (p.moves.indexOf(opts.move) < 0 && opts.move !== "scrap") return no(s, p.name + " doesn't know that move.");
      if (!moveUsesLeft(pl, p, opts.move)) return no(s, BEAST_MOVES[opts.move].name + " is out of PP -- another move, or Scrap.");
      p.next = opts.move; p.last = opts.move; msg = p.name + ": " + BEAST_MOVES[opts.move].name + " (it repeats until you change it).";
    } else if (opts.cmd === "pettonic") {                               // a Pet tonic in the fight (Cam, PT18 p4: "lets add it as a in hunt item")
      if (!p.moves.some(function (id) { return ppLeft(pl, p, id) < ppMax(pl, id); })) return no(s, p.name + "'s moves are all full.");
      if (!has(s, "pettonic") && !(s.dev && s.dev.infinite)) return no(s, "There's no Pet tonic in the bag -- make one at the apothecary table.");
      if (!(s.dev && s.dev.infinite)) take(s, "pettonic", 1);
      p.pp = {}; p.skip = "ate"; msg = p.name + " drank a Pet tonic: every move's PP is full again -- that's its turn.";
    } else if (opts.cmd === "petfeed") {
      var it = ITEMS[opts.item];
      if (!it || !it.heal) return no(s, "That doesn't heal.");
      if (!has(s, opts.item)) return no(s, "There's no " + it.name.toLowerCase() + " in the bag.");
      if (p.hp >= p.maxHp) return no(s, p.name + " isn't hurt.");
      if (!(s.dev && s.dev.infinite)) take(s, opts.item, 1);
      var h = Math.max(1, Math.round(it.heal * BEAST_FIGHT.foodCut * (1 + (talentSum(pl).petFood || 0))));
      p.hp = Math.min(p.maxHp, p.hp + h); p.skip = "ate"; msg = p.name + " ate the " + it.name.toLowerCase() + " (+" + h + ") -- that's its turn.";
    } else {
      var j = P.size + (opts.j | 0), q = P.pets[j];
      if (!q || q.hp <= 0) return no(s, "There's nobody ready on the bench.");
      P.pets[opts.i | 0] = q; P.pets[j] = p; q.skip = "swap"; msg = q.name + " steps in for " + p.name + ".";
    }
    if (b.manual) { var mr = manualRound(s, b, now); if (mr && mr.ok) mr.msg = msg + (mr.msg ? " " + mr.msg : ""); return mr; }
    return { ok: true, msg: msg, state: s };
  }
  /** The fight's pack, for the battle screen. */
  function packView(s, pl, b) {
    var P = b && b.pack;
    if (!P) return null;
    return { size: P.size, wild: P.wild, command: P.command, crook: P.crook ? ITEMS[P.crook].name : "",
             pets: P.pets.map(function (p, i) { return { i: i, id: p.id, name: p.name, species: p.species, colour: p.colour, type: p.type, typeName: BEAST_TYPES[p.type].name, level: p.level,
               hp: Math.max(0, Math.ceil(p.hp)), maxHp: p.maxHp, bench: i >= P.size, fainted: p.hp <= 0, last: p.last, guard: p.guardR || 0, fade: p.dodgeR || 0,
               moves: p.moves.concat(["scrap"]).map(function (id) { var M = BEAST_MOVES[id]; return { id: id, name: M.name, about: M.about, left: id === "scrap" ? null : ppLeft(pl, p, id), max: id === "scrap" ? null : ppMax(pl, id), scrap: id === "scrap",
                 mult: M.power ? typeMult(pl, p.type, b.mon) : 1 }; }) }; }),
             monType: BEAST_TYPES[BEAST_CREATURE_TYPE[b.mon] || "beast"].name };
  }
  /** The Combat tab's pack: every battle pet, which are in your pack, and how many fight. */
  function packPlanView(s, now) {
    var pl = s.player, ids = (pl.combat || {}).pack || [];
    return { size: packSize(pl), bench: BEAST_FIGHT.bench, pack: ids.slice(),
             beasts: beastsOf(s).map(function (bst) { return { id: bst.id, name: who(bst), level: beastLevel(bst), type: BEAST_TYPES[beastType(bst)].name, hp: beastHp(s, pl, bst, now), maxHp: beastMaxHp(pl, bst),
               resting: restLeft(bst, now) > 0, restLeft: restLeft(bst, now), inPack: ids.indexOf(bst.id) }; }) };
  }
  /** A battle pet's moves for the Pen: what it uses and everything it's learned (and what comes next). */
  function beastMovesView(bst, pl) {
    var use = movesOf(bst), known = movesLearned(bst);
    pl = pl || { skills: {}, classes: {} };
    return { use: use, slots: BEAST_FIGHT.slots,
             all: (SPECIES_MOVES[bst.species] || MOVES_BY_TYPE[beastType(bst)] || []).concat(tomeMovesOf(bst)).map(function (id) { var M = BEAST_MOVES[id]; return { id: id, name: M.name, about: M.about, level: M.level, known: known.indexOf(id) >= 0, used: use.indexOf(id) >= 0, uses: M.uses || 0,
               pp: ppLeft(pl, bst, id), ppMax: ppMax(pl, id) }; }) };
  }
