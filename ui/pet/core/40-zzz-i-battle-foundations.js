  // ---- Battle Re-work, Part 1: foundations (2026-10-15) --------------------------------------------------------------
  //      Cam (15 October): "secondary weapons are to be added to the game ... if they run out of runes or arrows they
  //      default to their secondary weapon. For all classes if durability of both primary and secondary weapons break
  //      then they default to fists." The whole plan is the "Battle Re-Work" notebook in Notes; this part is its Part 1:
  //   - the OFF HAND (gear slot "offhand"): a second weapon, used when the main can't be (no arrows, broken) -- or, for
  //     the Arcane out of runes, to bash with; swapped in a fight for a turn ("Swap");
  //   - WEAPON WEAR: a weapon wears by the swing, shot or cast (WEAPON_WEAR), warned at 75% and 90%, and breaks; it can
  //     be RE-TEMPERED once (Cam, Q5) for a third of what it's made of;
  //   - EFFECTS on either side of a fight (EFFECTS): lose-a-turn control (trapped, netted, stunned) with WoW's
  //     diminishing returns, damage over time (poison, bleeding, burning), slowed, weakened, broken guard. Nothing puts
  //     one on yet -- the class parts do -- so this part makes nobody stronger.
  var EFFECTS = CONTENT("EFFECTS");
  var EFFECT_RULES = CONTENT("EFFECT_RULES");
  var WEAPON_WEAR = CONTENT("WEAPON_WEAR");
  var AUTO_RUN = CONTENT("AUTO_RUN");
  /** Does this fight run for you when one more blow could finish you? Only on the early grounds (Cam, PT1): from the
   *  Forest on, you eat or press Run -- or fall. */
  function autoRuns(b) { return false; }                               // PT30 (2026-10-19, Cam: "No ambiguity no auto running, whether idle or not"): no ground runs for you any more (AUTO_RUN kept for old notes)
  /** A creature's level, as the fight screen shows it. */
  function creatureLevel(m) { return Math.max(1, Math.round((m.att + m.def) / 2 + m.hp / 8)); }

  // ---- weapons: the main hand, the off hand, and wear ----
  function isWeapon(id) { var it = ITEMS[id]; return !!(it && it.gear && it.gear.who === "player" && it.gear.slot === "weapon"); }
  /** A weapon's level: the highest skill level it asks of you. */
  function weaponLevel(id) {
    var req = WEAR[id] || MAGIC_WEAR[id] || {}, lv = 1;
    Object.keys(req).forEach(function (k) { if (SKILLS[k] && typeof req[k] === "number") lv = Math.max(lv, req[k]); });
    return lv;
  }
  function weaponDur(id) { return Math.min(WEAPON_WEAR.max, WEAPON_WEAR.base + WEAPON_WEAR.perLevel * (weaponLevel(id) - 1)); }
  /** Why this weapon can't fight now ("" if it can): "ammo" -- a bow with nothing to shoot. (What's worn counts as there,
   *  as it always has; a broken weapon leaves its slot.) */
  function weaponWhyNot(s, w, id) {
    var it = ITEMS[id];
    if (!it || !it.gear) return "none";
    if (it.gear.style === "ranged") {
      var am = ITEMS[(w.gear || {}).ammo];
      if (!am || !am.gear || am.gear.ammo !== it.gear.ammo || quiverHeld(s, w) < 1) return "ammo";   // (N24: what's loaded)
    }
    return "";
  }
  /** The weapon that fights: the main if it can, else the off hand's, else fists. "out": a bow without arrows and no
   *  second weapon -- as before the rework, the fight doesn't start (you aren't sent in bare-handed by running dry). */
  //  B5 (2026-10-20, Cam: "When arrows ran out to default to hunting knife or fists"): o.dry -- the bow ran dry in a fight (or
  //  during this hunt): the off hand, else a hunting knife from the bag, else fists -- never "out". o.noMain: the main can't
  //  shoot (no arrows, or the quiver's spent) even though it's worn.
  function pickWeapon(s, w, fists, o) {
    o = o || {};
    var g = w.gear || {}, main = g.weapon, off = isWeapon(g.offhand) ? g.offhand : "";
    if (fists) return { id: "", from: "fists" };
    var why = o.noMain ? "ammo" : main ? weaponWhyNot(s, w, main) : "none";
    if (!why) return { id: main, from: "main" };
    if (off && !weaponWhyNot(s, w, off) && !(o.noMain && ITEMS[off].gear.style === "ranged")) return { id: off, from: "offhand", why: why };
    if (why === "ammo" && o.dry) { var kn = dryKnife(s, w); return { id: kn, from: kn ? "knife" : "fists", why: why }; }
    return { id: "", from: why === "ammo" ? "out" : "fists", why: why };
  }
  /** The best hunting knife in the bag you can use (B5): what a bow-hand falls back on when the arrows are gone. */
  function dryKnife(s, w) {
    if (w !== s.player) return "";
    return Object.keys(s.bag || {}).filter(function (k) { return s.bag[k] > 0 && isWeapon(k) && ITEMS[k].gear.knife && !cantWear(s, k); })
      .sort(function (a, b) { return (ITEMS[b].gear.att || 0) - (ITEMS[a].gear.att || 0) || (a < b ? -1 : 1); })[0] || "";
  }
  /** Your gear as the fight sees it: the weapon that fights in the weapon slot, and a spare in the off hand left out (it
   *  only counts when it's the one in your hand). */
  function fightGear(w, id) {
    var eg = copy(w.gear || {});
    if (isWeapon(eg.offhand)) delete eg.offhand;
    if (id) eg.weapon = id; else delete eg.weapon;
    return eg;
  }
  /** What a re-tempering takes: a third of what the weapon is made of, where it's made -- or, when nobody makes it, a
   *  third of its price in coins at the anvil. */
  function retemperCost(id) {
    var share = WEAPON_WEAR.retemperShare, found = null;
    Object.keys(WORKSHOPS).some(function (ws) {
      var r = (WORKSHOPS[ws].recipes || []).filter(function (x) { return x.make === id && x.needs; })[0];
      if (r) found = { ws: ws, needs: {} };
      if (r) Object.keys(r.needs).forEach(function (k) { found.needs[k] = Math.max(1, Math.ceil(r.needs[k] / share)); });
      return !!r;
    });
    return found || { ws: WORKSHOPS.anvil ? "anvil" : "", needs: {}, coins: Math.max(30, Math.ceil(priceOf(id) / share)) };
  }
  function canRetemper(pl, id) {
    return isWeapon(id) && !((pl.tempered || {})[id]) && ((pl.wear || {})[id] || 0) >= weaponDur(id) * WEAPON_WEAR.retemperAt;
  }
  /** A swing (or shot, or cast) with weapon `id`: it wears, and at the end it breaks -- the next one in the bag, or the
   *  off hand's, or fists take over in the same fight. */
  function wearWeapon(s, pl, b, at, id) {
    // (wears in the sandbox too, infinite items or not -- 2026-10-15, Cam: "the sword never actually broke"; with infinite
    //  items a broken one is simply replaced from the endless bag)
    if (!id || !isWeapon(id)) return;
    pl.wear = pl.wear || {};
    var dur = weaponDur(id), was = pl.wear[id] || 0, now = was + ((ITEMS[id].gear || {}).wearBy || 1), nm = ITEMS[id].name.toLowerCase();
    if (now < dur) {
      pl.wear[id] = now;
      WEAPON_WEAR.warn.forEach(function (f) {
        if (was < dur * f && now >= dur * f) note(s, at, "Your " + nm + " is " + (f > 0.8 ? "about to break" : "wearing out") + " (" + (dur - now) + "/" + dur + " blows left)" +
                                                 (!((pl.tempered || {})[id]) ? " -- re-temper it once, on the Equipment page." : "."));
      });
      return;
    }
    pl.wear[id] = 0;
    if (pl.tempered) delete pl.tempered[id];
    take(s, id, 1);
    var more = has(s, id);
    if (!more) ["weapon", "offhand"].forEach(function (k) { if ((pl.gear || {})[k] === id) delete pl.gear[k]; });
    note(s, at, "Your " + nm + " broke" + (more ? " -- you picked up another." : "."));
    if (!b) return;                                                          // a quick fight (the Pyramid's chambers): no fight to log in
    b.rounds.push({ t: at, by: "you", hit: 0, broke: ITEMS[id].name });
    if (!more) refreshFighter(s, pl, b, at);
  }
  /** A quick fight's swings (fight(): the Pyramid's chambers) -- each wears the weapon. */
  function wearSwings(s, pl, id, rounds, at) {
    var n = (rounds || []).filter(function (r) { return r.by === "you" && !r.reflect; }).length;
    for (var i = 0; i < n && isWeapon(id) && [(pl.gear || {}).weapon, (pl.gear || {}).offhand].indexOf(id) >= 0; i++) wearWeapon(s, pl, null, at, id);
  }
  /** Your fighter again, mid-fight (a weapon broke, or you swapped): no special fired and no arrow taken for it. */
  function refreshFighter(s, pl, b, at, dry) {
    var pf = playerFighter(s, pl, pl.job || {}, at, { noSpec: true, noAmmo: true, dry: dry !== false });   // (B5: a bow with no arrows left falls back, mid-fight)
    if (pf.out) pf = playerFighter(s, pl, pl.job || {}, at, { noSpec: true, noAmmo: true, fists: true });
    pf.me.flee = b.me.flee;
    b.me = pf.me;
    b.style = pf.style;
  }

  // ---- effects ----
  function fxLog(b, at, o) { o.t = at; b.rounds.push(o); if (b.rounds.length > 40) b.rounds.shift(); }
  /** Put an effect on one side of a fight ("them" or "you"). o: {rounds: n or [min, max], power (damage a round), lvl
   *  (the level of whoever puts it on), stack (how many of it at once)}. Returns the rounds it lasts -- 0 if it didn't
   *  take (immune, or worn off by diminishing returns). */
  function addEffect(b, side, kind, o, at) {
    var E = EFFECTS[kind];
    if (!E || kind === "//") return 0;
    o = o || {};
    b.fx = b.fx || { them: [], you: [] };
    b.fx[side] = b.fx[side] || [];
    var mon = MONSTERS[b.mon], foe = side === "them", imm = foe ? mon.immune || [] : [];
    // immune: by the effect's name, or its group ("poison", "control" ...)
    if (imm.indexOf(kind) >= 0 || imm.indexOf(E.group) >= 0) { fxLog(b, at, { by: "fx", side: side, kind: kind, immune: true }); return 0; }
    var r = o.rounds, n = Array.isArray(r) ? r[0] + Math.floor(rnd(b) * (r[1] - r[0] + 1)) : (r || 1);
    if (E.control) {
      if (foe && typeof o.lvl === "number") n += Math.trunc((o.lvl - creatureLevel(mon)) / EFFECT_RULES.levelStep);
      b.dr = b.dr || { them: 0, you: 0 };
      var k = b.dr[side] || 0;
      n = Math.floor(n * EFFECT_RULES.dr[Math.min(k, EFFECT_RULES.dr.length - 1)]);
      if (foe && mon.boss) n = Math.min(EFFECT_RULES.bossMaxControl, Math.floor(n * EFFECT_RULES.bossControl));
      if (foe && mon.fxResist && mon.fxResist[kind]) n = Math.floor(n * mon.fxResist[kind]);
      if (n < 1) { fxLog(b, at, { by: "fx", side: side, kind: kind, resisted: true }); return 0; }
      b.dr[side] = k + 1;
    }
    n = Math.max(1, n);
    var same = b.fx[side].filter(function (e) { return e.kind === kind; }), cap = E.dot ? Math.min(E.stack || 1, o.stack || 1) : 1;
    if (same.length >= cap) {                                                // full: the shortest is refreshed
      var e0 = same.sort(function (x, y) { return x.rounds - y.rounds; })[0];
      e0.rounds = Math.max(e0.rounds, n); e0.power = Math.max(e0.power || 0, o.power || 0);
    } else b.fx[side].push({ kind: kind, rounds: n, power: o.power || 0 });
    fxLog(b, at, { by: "fx", side: side, kind: kind, on: n });
    return n;
  }
  /** The effect stopping this side acting this round, if any (trapped, netted, stunned; slowed on its off rounds). */
  function fxHeld(b, side) {
    var list = (b.fx && b.fx[side]) || [];
    for (var i = 0; i < list.length; i++) {
      var E = EFFECTS[list[i].kind];
      if (E && E.control && list[i].rounds > 0) return list[i].kind;
      if (E && E.slow && list[i].rounds > 0 && b.n % 2 === 0) return list[i].kind;
    }
    return "";
  }
  /** The product of an effect multiplier (hitMult, defMult) on a side -- 1 with none. */
  function fxMult(b, side, key) {
    var m = 1;
    ((b.fx && b.fx[side]) || []).forEach(function (e) { var E = EFFECTS[e.kind]; if (E && typeof E[key] === "number") m *= E[key]; });
    return m;
  }
  /** The end of a round: damage over time on each side, and every effect a round shorter. */
  function fxTick(s, pl, b, at) {
    if (!b.fx) return;
    ["them", "you"].forEach(function (side) {
      var list = b.fx[side] || [];
      list.forEach(function (e) {
        var E = EFFECTS[e.kind];
        if (E && E.dot && e.power > 0) {
          var d = e.power;
          if (side === "them") b.mhp -= d;
          else { if (!E.armourless) d = Math.max(1, Math.round(d * (1 - ((b.me || {}).dr || 0)))); pl.hp = Math.max(0, pl.hp - d); }
          fxLog(b, at, { by: "fx", side: side, kind: e.kind, hit: d });
        }
        e.rounds--;
      });
      b.fx[side] = list.filter(function (e) { return e.rounds > 0; });
    });
  }
  /** A side's effects, for the fight screen. */
  function fxView(b, side) {
    var by = {};
    ((b.fx && b.fx[side]) || []).forEach(function (e) {
      var E = EFFECTS[e.kind];
      if (!E) return;
      var v = by[e.kind] = by[e.kind] || { kind: e.kind, name: E.name, icon: E.icon, rounds: 0, stacks: 0 };
      v.rounds = Math.max(v.rounds, e.rounds); v.stacks++;
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }
  /** A weapon's wear, for the Equipment page and the fight screen. */
  function weaponView(pl, id) {
    if (!isWeapon(id)) return null;
    var dur = weaponDur(id), used = (pl.wear || {})[id] || 0;
    return { id: id, name: ITEMS[id].name, used: used, dur: dur, left: Math.max(0, dur - used), pct: Math.round(100 * used / dur),
             tempered: !!((pl.tempered || {})[id]), retemper: canRetemper(pl, id) ? retemperCost(id) : null };
  }

  // ---- the grindstone (2026-10-15, Cam: "a grind wheel might work better, placed in the furnace and anvil area, clicking it
  //      allows you to see the durability of a range of equipment and re-temper them there"): a bench in the Smithy ----
  WORKSHOPS.grindstone = CONTENT("WORKSHOPS.grindstone");
  WORKSHOP_ORDER.splice(WORKSHOP_ORDER.indexOf("anvil") + 1, 0, "grindstone");
  if (ROOMS.smithy && ROOMS.smithy.workshops.indexOf("grindstone") < 0) ROOMS.smithy.workshops.push("grindstone");
  ROOM_OF.grindstone = "smithy";
  /** Every weapon you hold or carry: where it is, its wear, and what re-tempering it would take. Worn first. */
  function grindView(state) {
    var pl = state.player, g = pl.gear || {}, b = state.bag || {}, ids = {};
    Object.keys(b).forEach(function (id) { if (b[id] > 0 && isWeapon(id)) ids[id] = 1; });
    ["weapon", "offhand"].forEach(function (k) { if (isWeapon(g[k])) ids[g[k]] = 1; });
    return Object.keys(ids).map(function (id) {
      var v = weaponView(pl, id);
      v.where = g.weapon === id ? "In your hand" : g.offhand === id ? "In your off hand" : "In the bag";
      v.count = b[id] || 0;
      v.why = v.retemper ? "" : v.tempered ? "Re-tempered once already" : "Can be re-tempered at " + Math.round(weaponDur(id) * WEAPON_WEAR.retemperAt).toLocaleString() + " blows worn (three-quarters)";
      return v;
    }).sort(function (x, y) { return y.pct - x.pct || (x.name < y.name ? -1 : 1); });
  }

  // ---- actions: the off hand, re-tempering ----
  var BATTLE_KIT_ACTS = ["offhand", "retemper"];
  /** offhand {item | ""} -- a second weapon (or nothing) in the off hand · retemper {item} -- once, at 75% worn or more. */
  function battleKitAct(s, action, opts, now) {
    if (BATTLE_KIT_ACTS.indexOf(action) < 0) return null;
    var pl = s.player;
    pl.gear = pl.gear || {};
    if (action === "offhand") {
      if (!opts.item) {
        if (!pl.gear.offhand) return no(s, "There's nothing in your off hand.");
        var was = ITEMS[pl.gear.offhand];
        delete pl.gear.offhand;
        return yes(s, now, "You put the " + (was ? was.name.toLowerCase() : "off-hand weapon") + " away.");
      }
      var it = ITEMS[opts.item];
      if (!isWeapon(opts.item) && !isShield(opts.item)) return no(s, "Only a weapon or a shield goes in your off hand.");
      if (!has(s, opts.item)) return no(s, "You don't have " + aOr(it.name) + ".");
      if (twoHanded(opts.item)) return no(s, "The " + it.name.toLowerCase() + " takes both hands -- it can only be your main weapon.");
      if (twoHanded(pl.gear.weapon)) return no(s, "Your " + ITEMS[pl.gear.weapon].name.toLowerCase() + " takes both hands: nothing goes in your off hand with it.");
      if (pl.gear.weapon === opts.item && (s.bag[opts.item] || 0) < 2 && !(s.dev && s.dev.infinite)) return no(s, "That's the one in your main hand -- you'd need a second.");
      var why = cantWear(s, opts.item);
      if (why) return no(s, "The " + it.name.toLowerCase() + " " + why + ".");
      if (it.gear.cls && !canUseClass(pl, it.gear.cls) && !bucklerOk(pl, opts.item)) return no(s, "The " + it.name.toLowerCase() + " is for " + clsPlural(it.gear.cls) + (opts.item === "woodenbuckler" ? " -- or anyone with Shield training in a technique slot." : "."));
      pl.gear.offhand = opts.item;
      if (isShield(opts.item)) return yes(s, now, "Your " + it.name.toLowerCase() + " is on your arm: it counts as armour, and blocks " + Math.round((it.gear.block || 0) * 100) + "% of blows" + (pl.cls === "paladin" ? " -- and you can bash with it." : ".") + weightWarn(pl, opts.item));   // (Part 8)
      if (pl.cls === "paladin" && isSword(pl.gear.weapon) && isSword(opts.item)) return yes(s, now, "A sword in each hand: two blows a round, each a little softer -- and no shield to block with.");
      if (isDagger(pl.gear.weapon) && isDagger(opts.item)) return yes(s, now, "A dagger in each hand: you stab twice a round (each a little softer).");   // a Thief (Part 7)
      return yes(s, now, "Your off hand: the " + it.name.toLowerCase() + " -- used when your main weapon can't be (no arrows or runes, broken).");
    }
    if (action === "retemper") {
      var id = opts.item, w = ITEMS[id];
      if (!isWeapon(id)) return no(s, "Only weapons are re-tempered.");
      if (!has(s, id)) return no(s, "You don't have " + aOr(w.name) + ".");
      if ((pl.tempered || {})[id]) return no(s, "Your " + w.name.toLowerCase() + " has been re-tempered once already -- it can't be again.");
      if (!canRetemper(pl, id)) return no(s, "It isn't worn enough yet -- a weapon is re-tempered once it's three-quarters worn.");
      var rc = retemperCost(id), inf = s.dev && s.dev.infinite;
      var short = Object.keys(rc.needs).filter(function (k) { return !has(s, k, rc.needs[k]); });
      if (short.length && !inf) return no(s, "Re-tempering it takes " + itemsText(rc.needs) + " -- not enough " + short.map(function (k) { return ITEMS[k].name.toLowerCase(); }).join(" or ") + ".");
      if (rc.coins && !hasCoins(s, rc.coins)) return no(s, "Re-tempering it costs " + rc.coins + " coins.");
      if (!inf) Object.keys(rc.needs).forEach(function (k) { take(s, k, rc.needs[k]); });
      if (rc.coins) spend(s, rc.coins);
      pl.wear = pl.wear || {}; pl.tempered = pl.tempered || {};
      pl.wear[id] = 0; pl.tempered[id] = true;
      return yes(s, now, "Re-tempered: your " + w.name.toLowerCase() + " is as good as new (" + (rc.coins ? rc.coins + " coins" : itemsText(rc.needs)) + "). It can't be again -- next time, make another.");
    }
    return null;
  }
