  /**
   * Does `action` at `now`. Returns {ok, msg, state} or {ok: false, error, state}.
   *   hatch {egg, roll} -- take an egg (only when there is no pet); `roll`
   *                        (0..1, the caller's random number) picks what's inside
   *   name {name}       -- name the pet, once it has hatched
   *   player {name, look} -- make (or change) your character
   *   trip {skill, spot, roll} -- go gathering (ends any trip you're on); home -- come back
   *   craft {workshop, make, times?} -- the village makes something (the kitchen: you cook); times: a number, or "all" while there's enough
   *   equip / unequip {item} -- a tool or a charm, from your next trip
   *   place {item}      -- furniture into the pet's room;  use {item} -- a potion for the pet
   *   expedition {area, supply, roll} · recall -- send the pet out, or call it back
   *   open {item, roll} -- open a loot crate
   *   dev {op, ...}     -- the sandbox's tools (refused unless state.dev.on)
   *   hunt {ground, roll} · pethunt {id, ground, roll} -- fight at a hunting ground (you, or a den pet)
   *   eat {item} -- cooked food heals you · settings {retreat} · restart -- after the game is over
   *   combat {style} | {special} -- your default attack style, and the special to use
   *   combine {item, all} -- 5 fragments make an ore
   *   boss {ground, roll} -- challenge an area's boss (after enough kills there): a live fight
   *   battle {cmd: run|special} -- in a fight: run, or fire your special next round (eat: see eat)
   *   breed {a, b, roll} -- two of your pets; the egg goes into the hatchery
   *   class {cls}       -- Hunter or Berserker (Arcane: coming soon)
   *   farm {op: rake|hoe|plant|water|harvest|unlock, plot, seed, roll} -- the village farm
   *   companion {id} · petname {id, name} · pettrip {id, skill, spot, roll} · pethome {id}
   *                     -- the den (slice 5): swap your companion, name a pet, send one gathering
   *   (hatch with a pet already: the egg goes into the hatchery and hatches into the den)
   *   feed {food} · play · pet · rest · wake · clean · medicine · release
   */
  function nc0(s) { return !!(s.player && s.player.cls); }
  function act(state, action, opts, now) {
    opts = opts || {};
    var s = advance(state, now), p = s.pet;
    if (s.player.dead && action !== "restart" && action !== "dev") return no(s, "The game is over -- start again.");
    // where you are (2026-10-08): at sea, or on an island, the things at home wait
    var away = awayLock(s, action, opts);
    if (away) return no(s, away);
    var told = storyLock(s, action, opts);                              // the story opens things one at a time (2026-10-10)
    if (told) return no(s, told + ".");
    if ((action === "hunt" || action === "boss") && REGIONS[opts.ground]) { var pg = placeLock(s, opts.ground); if (pg) return no(s, pg + "."); }
    // home (2026-10-08): the hearth, the table, the archive, the reading chair, the stacks, the stars
    var hr = homeAct(s, action, opts, now);
    if (hr) return hr;
    var shr = shipAct(s, action, opts, now);                           // the Shipyard and voyages
    if (shr) return shr;
    var esr = estateAct(s, action, opts, now);                         // island estates (stage 4)
    if (esr) return esr;
    var trr = tradeAct(s, action, opts, now);                          // the Oasis and the contracts (2026-10-09)
    if (trr) return trr;
    var pyr = pyramidAct(s, action, opts, now);                        // the Pyramid (2026-10-09)
    if (pyr) return pyr;
    var inr = innAct(s, action, opts, now);                            // the towns' inns (2026-10-09)
    if (inr) return inr;
    var gvr = graveAct(s, action, opts, now) || quickAct(s, action, opts, now);   // the gravestone and the quick-use slots (V16)
    if (gvr) return gvr;
    var rcr = recycleAct(s, action, opts, now);                        // the recycle stash (2026-10-11)
    if (rcr) return rcr;
    var cgr = cartAct(s, action, opts, now);                           // the cart to Marlow (2026-10-11)
    if (cgr) return cgr;
    var pna = penAct(s, action, opts, now);                            // the Beast Pen (Battle Re-work Part 11a)
    if (pna) return pna;
    var pka = packAct(s, action, opts, now);                           // a Beast Master's pack (Part 11b)
    if (pka) return pka;
    var yda = yardAct(s, action, opts, now);                           // the Pen's training dummy and sparring ring
    if (yda) return yda;
    var tma = tomeAct(s, action, opts, now);                           // move tomes (Part 14)
    if (tma) return tma;
    regionTomeCheck(s, now, null);                                     // a sailboat built: Davy Jones' Tome (V11)
    var tka = trackAct(s, action, opts, now);                          // tracking one creature (V15)
    if (tka) return tka;
    var sna = seenAct(s, action, opts, now);                           // a talk seen (PT20)
    if (sna) return sna;
    var gsa = gearSetAct(s, action, opts, now);                        // gear sets (Modernize/Reduce Nav)
    if (gsa) return gsa;
    var nca = necroAct(s, action, opts, now);                          // the Archmage's offer, raising, the crypt merchant (Part 13)
    if (nca) return nca;
    var fca = fieldAct(s, action, opts, now);                          // using one thing with another, in the bag (V2)
    if (fca) return fca;
    var gka = guildAct(s, action, opts, now);                          // the Guild hall (Battle Re-work Part 9)
    if (gka) return gka;
    var tka = talentAct(s, action, opts, now);                         // talents, respec, builds (Battle Re-work Part 3)
    if (tka) return tka;
    if (action === "coat") return coatAct(s, opts, now);
    var pda = paladinAct(s, action, opts, now);                        // shield bash, blessing (Battle Re-work Part 8)
    if (pda) return pda;              // a Thief's poisons (Battle Re-work Part 7)
    var lda = landAct(s, action, opts, now);                           // whittling, improvised arrows (Cam, PT3)
    if (lda) return lda;
    var hka = hunterAct(s, action, opts, now);                         // traps, nets, the hunt plan's (Battle Re-work Part 4)
    if (hka) return hka;
    var bka = battleKitAct(s, action, opts, now);                      // the off hand, re-tempering (Battle Re-work, 2026-10-15)
    if (bka) return bka;
    var rnr = ranchAct(s, action, opts, now);                          // the Farm (2026-10-12)
    if (rnr) return rnr;
    var tut = tutorialAct(s, action, opts, now);                       // Amunet's tutorial (2026-10-11)
    if (tut) return tut;
    var mka = marketAct(s, action, opts, now);                         // the Marketplace: buy, sell, steal (2026-10-17)
    if (mka) return mka;
    var ctu = classTutAct(s, action, opts, now);                       // a class's tutor shows you how it works (2026-10-17)
    if (ctu) return ctu;
    if ((action === "trip" || action === "hunt" || action === "boss" || action === "explore") && s.home && s.home.reading && !s.player.explore) {
      delete s.home.reading; note(s, now, "You put your book down and set off.");
    }
    if ((action === "trip" || action === "hunt" || action === "boss") && s.player.explore)
      return no(s, "You're out exploring the " + REGIONS[s.player.explore.region].name + " -- back in " + Math.max(1, Math.ceil((s.player.explore.until - now) / MIN)) + " min.");
    if (action === "restart") {
      if (!s.player.dead && !opts.sure) return no(s, "You're still alive.");
      var fresh = normal(empty());           // a whole new game: you, a starter kit, nothing else
      fresh.player.at = now;
      fresh.mode = s.mode || "hardcore";
      if (s.dev) fresh.dev = s.dev;
      return yes(fresh, now, "A new start on the isle.");
    }
    if (action === "hatch") {
      var type = opts.egg || "starter", e = EGGS[type], found = type + "egg";
      if (!e) return no(s, "There's no egg like that.");
      // the starter egg is always there; others are ones you've found (or the sandbox's)
      var fromBag = !e.take && !(s.dev && s.dev.allEggs);
      if (fromBag && !has(s, found)) return no(s, "You haven't found " + aOr(e.name) + " yet.");
      if (p && type === "starter" && !(s.dev && s.dev.allEggs)) return no(s, "The starter egg is for your first pet.");
      if (p && s.hatchery.length + (s.breeding ? 1 : 0) >= hatchSlots(s)) return no(s, "The hatchery is full -- " + hatchSlots(s) + " eggs at a time.");
      if (fromBag) take(s, found);
      if (p) {
        // you already have a pet: the egg goes in the hatchery, and hatches into the den
        var hroll = typeof opts.roll === "number" && opts.roll >= 0 && opts.roll < 1 ? opts.roll : (now % 9973) / 9973;
        var hAt = now + (s.dev && s.dev.instantHatch ? 0 : Math.round(e.hatch / rate("hatch")));
        s.hatchery.push({ egg: type, kind: rollEgg(type, hroll, s), started: now, hatchAt: hAt });
        var hm = Math.round((hAt - now) / MIN);
        return yes(s, now, "The " + e.name.toLowerCase() + " is in the hatchery" + (hm ? " -- it hatches in " + (hm >= 60 ? hm / 60 + " hour" + (hm > 60 ? "s" : "") : hm + " minutes") + "." : "."));
      }
      var roll = typeof opts.roll === "number" && opts.roll >= 0 && opts.roll < 1 ? opts.roll : (now % 9973) / 9973;
      var kind = rollEgg(type, roll, s).split("/");
      s.pet = { id: "p" + Math.abs(now | 0).toString(36) + kind[0].charAt(0), skills: { foraging: 0, fishing: 0, mining: 0, lumbering: 0 }, job: null,
                name: "", species: kind[0], colour: kind[1], egg: type, born: now,
                hatchAt: now + (s.dev && s.dev.instantHatch ? 0 : Math.round(e.hatch / rate("hatch"))), at: now, xp: 0, areas: {}, away: null, injuredUntil: 0,
                s: { full: 80, happy: 80, energy: 90, clean: 100, health: 100 },
                asleep: false, sick: false, lastMed: 0, counts: {} };
      var mins = Math.round((s.pet.hatchAt - now) / MIN);
      return yes(s, now, "You took " + aOr(e.name) + ". " + (mins ? "It hatches in " + (mins >= 60 ? mins / 60 + " hour" + (mins > 60 ? "s" : "") : mins + " minutes") + "." : "It's hatching!"));
    }
    // you, and your trips -- these don't need a pet
    if (action === "player") {
      var pn = cleanName(opts.name, 24);
      if (!pn) return no(s, "Type your name first.");
      var lk = opts.look || {};
      s.player.name = pn;
      // a young man or a young woman (2026-10-11, Cam: "1 male character ... and 1 female"); skin, hair and outfit are shelved
      // but kept, so the villagers' painted looks and old saves stay as they were. No body yet reads as the young man.
      s.player.look = { skin: lk.skin | 0, hair: lk.hair | 0, outfit: lk.outfit | 0, body: lk.body === "f" ? "f" : "m" };
      var first = !s.player.made;
      s.player.made = true;
      if (first) s.story = { on: true };                                  // a new character: the story opens things one at a time
      return yes(s, now, first ? "Welcome to the isle, " + pn + "." : "You changed your look.");
    }
    if (action === "trip") {
      var sp = spotOf(opts.skill, opts.spot);
      if (!sp) return no(s, "There's no place like that.");
      var spw = REGIONS[sp.area] ? placeLock(s, sp.area) : "";           // on the right island? (2026-10-08)
      if (spw) return no(s, spw + ".");
      var lv = levelOf(s.player.skills[opts.skill] || 0);
      if (lv < sp.level) return no(s, "The " + sp.name + " needs " + SKILLS[opts.skill].name + " level " + sp.level + ".");
      if (spotLock(s, opts.skill, sp)) return no(s, "The " + sp.name + " opens when you " + spotLock(s, opts.skill, sp).charAt(0).toLowerCase() + spotLock(s, opts.skill, sp).slice(1) + ".");
      if (s.player.battle && s.player.battle.kind === "boss") return no(s, "Finish your fight first -- or run!");
      var need = tripNeeds(s, opts.skill, sp);
      if (need) return no(s, need);
      if (s.player.job) endTrip(s, s.player, now, "stop");
      var seed = typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0);
      // your gear, as you set off: a tool and a charm
      var toolId = toolTierOf(s, opts.skill) >= 0 ? s.player.tools[opts.skill] : "";
      var tool = ITEMS[toolId], worn = gearSum(s.player.gear);
      var sb = worn.skill[opts.skill] || { xp: 0, speed: 1 };          // an amulet for this skill
      var te = toolId && ENCH && ENCH[toolId] && ENCHANTS[ENCH[toolId]] ? ENCHANTS[ENCH[toolId]].bonus : {};   // an enchanted tool
      var speed = (tool && tool.tool ? tool.tool.speed : 1) * worn.speed * sb.speed * (te.speed || 1);
      var handFish = opts.skill === "fishing" && sp.hand && !has(s, sp.needs);
      var every = Math.round(sp.time * 1000 * speed / rate("speed") / researchSpeed(s, opts.skill) / quarrySpeed(s, sp) * (handFish ? HAND_FISH_SLOW : 1));   // (an emerald fly, V6)   // research (2026-10-08)
      s.player.job = { skill: opts.skill, spot: sp.id, since: now, next: now + every, until: now + JOB_MAX, every: every,
                       xpBonus: Math.round((worn.xp + sb.xp + (te.xp || 0)) * 100) / 100, rareMult: Math.max(worn.rare, te.rare || 1) * quarryRare(s, opts.skill), twigsOnly: opts.skill === "lumbering" && !toolId,
                       byHand: (opts.skill === "mining" && !toolId) || handFish, tool: toolId || "",
                       seed: seed, count: 0, xp: 0, items: {} };
      return yes(s, now, "You went " + SKILLS[opts.skill].verb + " at the " + sp.name + ".");
    }
    if (action === "loadout") {                                          // the spells you take into a fight, in order
      var want = (opts.spells || []).filter(function (x, i, a) { return SPELLS[x] && a.indexOf(x) === i; }).slice(0, loadoutMax(s.player));
      var bad = want.filter(function (x) { var l = spellLock(s, x); return l && !/in hand$/.test(l); });
      if (bad.length) return no(s, SPELLS[bad[0]].name + ": " + spellLock(s, bad[0]).toLowerCase() + ".");
      s.player.loadout = want;
      return yes(s, now, want.length ? "Your spells: " + want.map(function (x) { return SPELLS[x].name; }).join(", ") + "." : "No spells ready -- you'll fight with your staff or fists.");
    }
    if (action === "learn") {                                            // a scroll or a tome
      var li = ITEMS[opts.item];
      if (!li || !li.learn) return no(s, "There's nothing to learn from that.");
      if (!has(s, opts.item)) return no(s, "You don't have it.");
      if (li.learn.field) return fieldLearn(s, opts.item, now);           // a recipe page (field recipes, V2 step 2)
      if (li.learn.spell) {
        s.spellsKnown = s.spellsKnown || {};
        if (s.spellsKnown[li.learn.spell]) return no(s, "You already know " + SPELLS[li.learn.spell].name + ".");
        take(s, opts.item); s.spellsKnown[li.learn.spell] = now;
        return yes(s, now, "You learnt " + SPELLS[li.learn.spell].name + "! It's in your spellbook (Magic " + SPELLS[li.learn.spell].level + ").");
      }
      s.enchantsKnown = s.enchantsKnown || {};
      if (s.enchantsKnown[li.learn.enchant]) return no(s, "You already know the " + ENCHANTS[li.learn.enchant].name + " enchant.");
      take(s, opts.item); s.enchantsKnown[li.learn.enchant] = now;
      return yes(s, now, "You learnt the " + ENCHANTS[li.learn.enchant].name + " enchant! Put it on things at the enchanting table in your library.");
    }
    if (action === "enchant") {                                          // the altar
      var ek = ENCHANTS[opts.enchant], eid = opts.item;
      if (!ek) return no(s, "There's no enchant like that.");
      if (!(s.enchantsKnown || {})[opts.enchant]) return no(s, "You don't know that enchant -- its tome is in an ancient chest somewhere.");
      if (levelOf(s.player.skills.enchanting || 0) < ek.level) return no(s, ek.name + " needs Enchanting level " + ek.level + ".");
      var rlk2 = roomLock(s, "enchanting", ek.level);
      if (rlk2) return no(s, rlk2 + ".");
      if (!ITEMS[eid] || !enchantable(ek, eid)) return no(s, ek.name + " goes on " + enchantWhere(ek) + ".");
      if (!has(s, eid)) return no(s, "You don't have " + aOr(ITEMS[eid].name.toLowerCase()) + ".");
      var eshort = Object.keys(ek.cost).filter(function (k) { return !has(s, k, ek.cost[k]); });
      if (eshort.length) return no(s, "It takes " + itemsText(ek.cost) + " and " + ek.coins + " coins.");
      if (!hasCoins(s, ek.coins)) return no(s, "It costs " + ek.coins + " coins -- you have " + (s.coins || 0) + ".");
      Object.keys(ek.cost).forEach(function (k) { take(s, k, ek.cost[k]); });
      spend(s, ek.coins);
      s.player.enchants = s.player.enchants || {};
      var was = s.player.enchants[eid];
      s.player.enchants[eid] = opts.enchant;
      addXp(s, s.player, "enchanting", ek.xp, now);
      return yes(s, now, "Your " + ITEMS[eid].name.toLowerCase() + " glows: " + ek.name + " (" + ek.about.toLowerCase() + ")" + (was && was !== opts.enchant ? " -- it replaces " + ENCHANTS[was].name + "." : ".") + " (+" + ek.xp + " Enchanting xp)");
    }
    if (action === "rank") {                                             // the mage tower: challenge for the next rank
      // ... or a REMATCH with one you've beaten (Cam, PT19 b5: "beating a level mage is not a once off event, it enables you to
      // re-challenge them for exp and also runes of that level") -- opts.rematch: that rank's number
      var again = opts.rematch | 0;
      if (again && (again < 1 || again > (s.mageRank || 0) || !MAGE_RANKS[again])) return no(s, "Beat that mage for the rank first.");
      var rn = again || (s.mageRank || 0) + 1, rk = MAGE_RANKS[rn];
      if (!rk) return no(s, "You're an Archmage -- there's no one left to beat.");
      var rshort = again ? [] : Object.keys(rk.needs).filter(function (k) { return levelOf(s.player.skills[k] || 0) < rk.needs[k]; });
      if (rshort.length) return no(s, rk.name + " needs " + rshort.map(function (k) { return SKILLS[k].name + " " + rk.needs[k]; }).join(", ") + ".");
      if (s.player.battle && s.player.battle.kind !== "hunt") return no(s, "You're already in a fight.");
      if ((((ITEMS[(s.player.gear || {}).weapon] || {}).gear) || {}).style !== "magic") return no(s, "A duel at the tower is fought with magic -- take a wand or a staff.");
      healTo(s.player, now);
      if (s.player.job) endTrip(s, s.player, now, "stop");
      var dh = { seed: typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0) };
      var dst = startBattle(s, s.player, "boss", "magetower", rk.duel, now, dh);
      if (dst.out) return no(s, "You can't fight like that.");
      s.player.battle.duel = rn;
      if (again) s.player.battle.rematch = true;
      if (opts.manual) { s.player.battle.manual = true; s.player.battle.nextRound = MANUAL_WAIT; }
      return yes(s, now, MONSTERS[rk.duel].name + " bows. " + (again ? "A practice duel -- for the runes and the learning." : "The duel for the rank of " + rk.name + " begins!"));
    }
    if (action === "build") {                                            // a house upgrade
      var room = ROOMS[opts.room];
      if (!room) return no(s, "There's no room like that.");
      var ht = house(s), bt = ht[opts.room], bn = ROOM_BUILD[bt + 1], inf2 = s.dev && s.dev.infinite;
      if (!bn) return no(s, "Your " + room.name.toLowerCase() + " is as grand as it gets.");
      var con = levelOf(s.player.skills.construction || 0);
      if (!inf2 && con < bn.con) return no(s, aOr(HOUSE_TIERS[bt + 1] + " " + room.name.toLowerCase()) + " needs Construction level " + bn.con + " (you're " + con + ") -- saw planks at the sawbench in your shed.");
      var bshort = Object.keys(bn.needs).filter(function (k) { return !has(s, k, bn.needs[k]); });
      if (bshort.length) return no(s, "Not enough " + bshort.map(function (k) { return ITEMS[k].name.toLowerCase(); }).join(" or ") + " -- it takes " + itemsText(bn.needs) + ".");
      if (!inf2 && !hasCoins(s, bn.coins)) return no(s, "It costs " + bn.coins + " coins -- you have " + (s.coins || 0) + ".");
      Object.keys(bn.needs).forEach(function (k) { take(s, k, bn.needs[k]); });
      spend(s, bn.coins);
      ht[opts.room] = bt + 1;
      var cb = levelOf(s.player.skills.construction || 0);
      s.player.skills.construction = Math.round(((s.player.skills.construction || 0) + bn.xp * noviceMult(cb)) * 10) / 10;
      if (levelOf(s.player.skills.construction) > cb) note(s, now, "You reached Construction level " + levelOf(s.player.skills.construction) + "!");
      syncRest(s);
      return yes(s, now, "You built " + aOr(HOUSE_TIERS[bt + 1] + " " + room.name.toLowerCase()) + " (+" + bn.xp + " Construction xp): " + tierPerks(opts.room, bt + 1).toLowerCase() + ".");
    }
    if (action === "deposit") {                                          // the whole bag into the bank (Modernize/Reduce Nav: RuneScape's "deposit inventory")
      var STOd = storeHere(s), Ld = chestLayout(s), put = [], full = 0;
      if (!Ld.n) return no(s, "There's no store room here.");
      var keep = {}; Object.keys(s.player.gear || {}).forEach(function (g) { if (s.player.gear[g]) keep[s.player.gear[g]] = 1; });
      Object.keys(s.player.tools || {}).forEach(function (g) { if (s.player.tools[g]) keep[s.player.tools[g]] = 1; });
      Object.keys(s.bag || {}).filter(function (k) { return s.bag[k] > 0 && ITEMS[k] && k !== "unidherb"; }).forEach(function (k) {
        var n = s.bag[k] - (keep[k] ? 1 : 0);
        if (n <= 0) return;
        if (!(STOd[k] > 0) && storeUsed(s) >= storeCap(s)) { full++; return; }
        take(s, k, n); STOd[k] = (STOd[k] || 0) + n;
        if (!(k in Ld.of)) Ld.of[k] = typeof opts.tab === "number" && opts.tab >= 0 && opts.tab < Ld.n ? opts.tab : 0;
        put.push(k);
      });
      saveChests(Ld);
      if (!put.length) return no(s, full ? "Your bank is full (" + storeUsed(s) + "/" + storeCap(s) + " kinds) -- build a bigger store room." : "There's nothing in your bag to put away (what you wear and carry stays).");
      return yes(s, now, "You put " + put.length + " kind" + (put.length === 1 ? "" : "s") + " of things in the bank." + (full ? " " + full + " didn't fit -- the bank is full." : ""));
    }
    if (action === "drop") {                                             // throw it away (Modernize/Reduce Nav: the bag's right-click Drop)
      var di = ITEMS[opts.item];
      if (!di || !has(s, opts.item)) return no(s, "There's none of that in your bag.");
      var dworn = Object.keys(s.player.gear || {}).some(function (g) { return s.player.gear[g] === opts.item; }) || Object.keys(s.player.tools || {}).some(function (g) { return s.player.tools[g] === opts.item; });
      var dmax = s.bag[opts.item] - (dworn ? 1 : 0);
      if (dmax <= 0) return no(s, "You're using that -- take it off first.");
      var dn = opts.n === "all" ? dmax : Math.max(1, Math.min(dmax, opts.n | 0 || 1));
      take(s, opts.item, dn);
      return yes(s, now, "You dropped " + itemsText(pick1(opts.item, dn)) + ".");
    }
    if (action === "store" || action === "withdraw") {                   // the store room
      var sid = opts.item, it2 = ITEMS[sid];
      if (!it2) return no(s, "There's nothing like that.");
      var STO = storeHere(s), where = islandOf(s) ? "at your " + ISLANDS[islandOf(s)].name + " estate" : "at home";
      if (action === "store") {
        if (sid === "unidherb") return no(s, "Identify your herbs before you store them.");
        var worn = Object.keys(s.player.gear || {}).some(function (g) { return s.player.gear[g] === sid; }) || Object.keys(s.player.tools || {}).some(function (g) { return s.player.tools[g] === sid; });
        var spare = (s.bag[sid] || 0) - (worn ? 1 : 0);
        if (spare <= 0) return no(s, worn ? "You're using that -- take it off first." : "There's none in your bag.");
        var sn = opts.n === "all" ? spare : Math.max(1, Math.min(spare, opts.n | 0 || 1));
        if (!(STO[sid] > 0) && storeUsed(s) >= storeCap(s)) return no(s, "Your bank is full (" + storeUsed(s) + "/" + storeCap(s) + " kinds) -- build a bigger store room.");
        var L = chestLayout(s), ch = STO[sid] > 0 ? L.of[sid] : -1;      // a kind lives in one tab
        if (ch < 0) { var tw = typeof opts.tab === "number" ? opts.tab : opts.chest; ch = typeof tw === "number" && tw >= 0 && tw < L.n ? tw : 0; }
        take(s, sid, sn);
        STO[sid] = (STO[sid] || 0) + sn;
        L.of[sid] = ch; saveChests(L);
        return yes(s, now, "You stored " + itemsText(pick1(sid, sn)) + " in " + chestSay(L, ch) + " " + where + ".");
      }
      if (opts.from === "overflow") {                                    // the Overflow chest (2026-10-10): take only
        if (islandOf(s)) return no(s, "The Overflow chest is in your store room at home.");
        var OV = s.overflow || {}, ho = OV[sid] || 0;
        if (ho <= 0) return no(s, "There's none in the Overflow chest.");
        if (!roomFor(s, sid)) return no(s, "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + ") -- make room first.");
        var on = Math.min(opts.n === "all" ? ho : Math.max(1, Math.min(ho, opts.n | 0 || 1)), stackRoom(s, sid));
        if (on <= 0) return no(s, "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + " slots) -- no room for more " + it2.name.toLowerCase() + ".");
        OV[sid] = ho - on; if (!OV[sid]) delete OV[sid];
        if (!Object.keys(OV).length) delete s.overflow;
        give(s, sid, on, true);
        return yes(s, now, "You took " + itemsText(pick1(sid, on)) + " from the Overflow chest." + (s.overflow ? "" : " It's empty now."));
      }
      var have2 = STO[sid] || 0;
      if (have2 <= 0) return no(s, "There's none stored.");
      var wn = opts.n === "all" ? have2 : Math.max(1, Math.min(have2, opts.n | 0 || 1));
      if (!roomFor(s, sid)) return no(s, "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + ") -- make room first.");
      wn = Math.min(wn, stackRoom(s, sid));                             // as much as the stack holds (2026-10-10)
      if (wn <= 0) return no(s, "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + " slots) -- no room for more " + it2.name.toLowerCase() + ".");
      var L2 = chestLayout(s), from = chestSay(L2, L2.of[sid] || 0);
      STO[sid] = have2 - wn;
      if (!STO[sid]) { delete STO[sid]; delete L2.of[sid]; }
      saveChests(L2);
      give(s, sid, wn, true);
      return yes(s, now, "You took " + itemsText(pick1(sid, wn)) + " from " + from + ".");
    }
    if (action === "chestmove" || action === "banktab") {                // to another tab of the bank (was "one chest to another")
      var L4 = chestLayout(s), mid = opts.item, to = (typeof opts.tab === "number" ? opts.tab : opts.chest) | 0, STO4 = storeHere(s);
      if (!ITEMS[mid] || !(STO4[mid] > 0) || !(mid in L4.of)) return no(s, "There's none of that in your bank.");
      if (!(to >= 0 && to < L4.n)) return no(s, "There's no tab like that.");
      var from4 = L4.of[mid];
      if (from4 === to) return no(s, "It's already in " + chestSay(L4, to) + ".");
      L4.of[mid] = to; saveChests(L4);
      return yes(s, now, "You moved " + itemsText(pick1(mid, STO4[mid])) + " from " + chestSay(L4, from4) + " to " + chestSay(L4, to) + ".");
    }
    if (action === "chestname" || action === "tabname") {                // name a bank tab (was a chest, 2026-10-10)
      var L3 = chestLayout(s), ci = (typeof opts.tab === "number" ? opts.tab : opts.chest) | 0;
      if (!(ci >= 0 && ci < L3.n)) return no(s, "There's no tab like that.");
      var nm = cleanName(opts.name, 20);
      L3.names[ci] = nm; saveChests(L3);
      return yes(s, now, nm ? "You named tab " + (ci + 1) + " \u201c" + nm + "\u201d." : "Tab " + (ci + 1) + " has no name now.");
    }
    if (action === "quest") {                                            // hand in a quest to someone in the world
      var per = PEOPLE[opts.region];
      if (!per) return no(s, "There's nobody like that.");
      if (regionLock(s, opts.region)) return no(s, "You can't get to the " + REGIONS[opts.region].name + " yet.");
      s.quests = s.quests || {};
      var qq = per.quests.filter(function (x) { return !s.quests[x.id] && questOpen(s, x); })[0];
      if (!qq) return no(s, per.name + " has nothing more to ask of you.");
      var qp = questProgress(s, qq).filter(function (x) { return !x.ok; });
      if (qp.length && !questFree(s)) return no(s, "Not yet: " + qp.map(function (x) { return x.text.toLowerCase() + " " + x.have + "/" + x.need; }).join(", ") + ".");
      qq.needs.forEach(function (n) { Object.keys(n.bring || {}).forEach(function (k) { var tk = Math.min(n.bring[k], (s.bag || {})[k] || 0); if (tk > 0) take(s, k, tk); }); });   // (the sandbox's free quests take what you have)
      s.quests[qq.id] = now;
      var rw = qq.reward;
      if (rw.coins) s.coins = (s.coins || 0) + rw.coins;
      Object.keys(rw.items || {}).forEach(function (k) { give(s, k, rw.items[k], true); if (ITEMS[k].learn && ITEMS[k].learn.field) fieldPageGot(s, k, now); });      // a reward always fits (a recipe page: the Unlocks pop-up, PT14 p2)
      noteUnlocks(s, qq, qq.story ? STORY.filter(function (c) { return c.n === qq.story; })[0] : null, now);   // for the Unlocks pop-up (2026-10-10)
      Object.keys(rw.xp || {}).forEach(function (k) {
        var qb = levelOf(s.player.skills[k] || 0);
        s.player.skills[k] = Math.round(((s.player.skills[k] || 0) + rw.xp[k]) * 10) / 10;
        if (levelOf(s.player.skills[k]) > qb) note(s, now, "You reached " + SKILLS[k].name + " level " + levelOf(s.player.skills[k]) + "!");
      });
      var rest = per.quests.filter(function (x) { return !s.quests[x.id]; }).length;
      if (qq.story) {                                                    // a chapter of the story: what it opened
        var ch = STORY.filter(function (c) { return c.n === qq.story; })[0], opened = ch ? ch.opens.map(function (g) { return STORY_GATES[g].name; }) : [];
        var nx = STORY.filter(function (c) { return c.n === qq.story + 1; })[0];
        return yes(s, now, "Story, chapter " + qq.story + " done: " + (ch ? ch.name : qq.name) + " (" + rewardText(rw) + ")." +
                   (opened.length && storyOn(s) ? " Open to you now: " + opened.join(", ") + "." : "") +
                   (nx ? " Next: " + PEOPLE[nx.region].name + " in the " + REGIONS[nx.region].name + "." : " That's the story so far -- " + STORY_NAME + "."));
      }
      return yes(s, now, per.name + ": \"Thank you!\" Quest done -- " + qq.name + " (" + rewardText(rw) + ")." + (rest ? "" : " That's everything " + per.name + " needed."));
    }
    if (action === "explore") {                                          // the world map: explore a region
      var rg = REGIONS[opts.region];
      if (!rg || rg.hub) return no(s, "There's nowhere like that to explore.");
      var rlock = regionLock(s, opts.region);
      if (rlock) return no(s, rlock + ".");
      if (s.player.explore) return no(s, "You're already exploring the " + REGIONS[s.player.explore.region].name + ".");
      if (s.player.job) return no(s, "You're out " + (s.player.job.hunt ? "hunting" : "gathering") + " -- come home first.");
      if (s.player.battle) return no(s, "You're in the middle of a fight.");
      s.player.explore = { region: opts.region, since: now, until: now + EXPLORE_TIME, chance: exploreChance(s, opts.region),
                           seed: typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0) };
      return yes(s, now, "You set off to explore the " + rg.name + " (" + EXPLORE_TIME / MIN + " minutes).");
    }
    if (action === "order") {                                            // the notice board
      var day = Math.floor(now / DAY), ords = ordersFor(s, now), oi = opts.i | 0, od = ords[oi];
      if (!od) return no(s, "There's no order like that on the board.");
      if (!s.orders || s.orders.day !== day) s.orders = { day: day, done: {} };
      if (s.orders.done[oi]) return no(s, "That order's been filled -- new ones go up tomorrow.");
      if (!has(s, od.id, od.n)) return no(s, "The order is for " + od.n + " × " + ITEMS[od.id].name.toLowerCase() + " -- you have " + (s.bag[od.id] || 0) + ".");
      take(s, od.id, od.n);
      s.orders.done[oi] = 1;
      s.coins = (s.coins || 0) + od.coins;
      var osk = od.skill, ob4 = levelOf(s.player.skills[osk] || 0);
      s.player.skills[osk] = Math.round(((s.player.skills[osk] || 0) + od.xp) * 10) / 10;
      if (levelOf(s.player.skills[osk]) > ob4) note(s, now, "You reached " + SKILLS[osk].name + " level " + levelOf(s.player.skills[osk]) + "!");
      give(s, "woodcrate", 1);
      var all3 = ords.every(function (x, k) { return s.orders.done[k]; });
      if (all3) give(s, "ironcrate", 1);
      return yes(s, now, "You filled the order: " + od.n + " × " + ITEMS[od.id].name.toLowerCase() + " for " + od.coins + " coins, " + od.xp + " " +
                 SKILLS[osk].name + " xp and a wooden crate." + (all3 ? " Every order today filled -- an iron crate as thanks!" : ""));
    }
    if (action === "identify") {                                         // the Herb table: Herblore
      // (2026-10-07, Cam: "If i try to identify one, it will either succeed or failure and say you dont
      // have required level") -- one at a time, at random from the hidden stack; or all you can
      trimUnid(s);
      var pool = s.unid, hlv = levelOf(s.player.skills.herblore || 0), b4h = hlv, RN = ["I", "II", "III", "IV", "V"];
      var tierOf = function (h) { return HERB_TIERS[HERB_TIER_OF[h] - 1]; };
      var avail = Object.keys(pool).filter(function (k) { return pool[k] > 0 && HERB_TIER_OF[k]; });
      if (!avail.length) return no(s, "There are no unidentified herbs in the bag.");
      var holder = { seed: typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0) }, queue = [];
      if (!opts.all) {
        var one = pick(holder, avail.map(function (k) { return [k, pool[k]]; }));
        if (hlv < tierOf(one).level) return no(s, "You don't have the required level to identify this herb -- it needs Herblore " + tierOf(one).level + ".");
        queue = [one];
      } else {
        avail.forEach(function (k) { if (hlv >= tierOf(k).level) for (var qi = 0; qi < pool[k]; qi++) queue.push(k); });
        if (!queue.length) return no(s, "You don't have the required level to identify any of these herbs yet (Herblore " + hlv + ").");
      }
      var gotH = {}, newH = [], hxp = 0, hb = s.herbarium = s.herbarium || {}, full = 0, doneN = 0;
      for (var hi = 0; hi < queue.length; hi++) {
        var which = queue[hi], ht = tierOf(which);
        if (!roomFor(s, which)) { full++; continue; }                  // no room for a new kind: it stays unidentified
        pool[which]--; if (!pool[which]) delete pool[which];
        s.bag.unidherb = Math.max(0, (s.bag.unidherb || 0) - 1); doneN++;
        var two = rnd(holder) < doubleChance(s, ht.tier, levelOf(s.player.skills.herblore || 0)) ? 2 : 1;
        give(s, which, two, true); gotH[which] = (gotH[which] || 0) + two;
        var firstH = !hb[which], addH = ht.xp * (firstH ? 6 : 1) * noviceMult(levelOf(s.player.skills.herblore || 0));          // a first: six times the xp
        var wasDone = tierComplete(s, ht.tier), wasMaster = masterHerbalist(s);
        hb[which] = (hb[which] || 0) + two;
        if (firstH) newH.push({ id: which, tier: !wasDone && tierComplete(s, ht.tier) ? ht.tier : 0, master: !wasMaster && masterHerbalist(s) });
        hxp += addH;
        s.player.skills.herblore = Math.round(((s.player.skills.herblore || 0) + addH) * 10) / 10;
      }
      if (!doneN) return no(s, "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + ") -- make room for the herb first.");
      var left = (s.bag.unidherb || 0) - full;
      var hla = levelOf(s.player.skills.herblore);
      if (hla > b4h) note(s, now, "You reached Herblore level " + hla + "!");
      newH.forEach(function (h) { note(s, now, "New in your Herbarium: " + ITEMS[h.id].name + "!" + (h.tier ? " Every tier " +
        RN[h.tier - 1] + " herb catalogued -- more of them will come up in twos." : "") +
        (h.master ? " Your Herbarium is complete: you're a master herbalist (every 8th potion at the Apothecary table is free)." : "")); });
      return yes(s, now, "You identified " + itemsText(gotH) + " (+" + hxp + " Herblore xp)." +
                 (full ? " " + full + " didn't fit -- your bag is full, so no new kinds of herb." : "") +
                 (opts.all && left ? " " + left + " " + (left === 1 ? "needs" : "need") + " a higher Herblore level." : ""));
    }
    if (action === "craft") {
      var ws = WORKSHOPS[opts.workshop], rec = null;
      if (ws) for (var ri = 0; ri < ws.recipes.length; ri++) if (ws.recipes[ri].make === opts.make && !rec) rec = ws.recipes[ri];
      if (ws && typeof opts.i === "number" && ws.recipes[opts.i] && ws.recipes[opts.i].make === opts.make) rec = ws.recipes[opts.i];   // one of several ways
      if (!rec) return no(s, "Nobody in the village makes that.");
      var made = ITEMS[rec.make];
      if (ws.npc && !npcHere(s, opts.workshop, now)) return no(s, ws.who + " isn't in the village today.");
      if (ws.skill) {
        var cl = levelOf(s.player.skills[ws.skill] || 0);
        if (cl < rec.level) return no(s, made.name + " needs " + SKILLS[ws.skill].name + " level " + rec.level + ".");
      }
      var rlk = roomLock(s, opts.workshop, rec.level || 1) || bossLock(s, rec);   // a boss's set: beat it 5 times (2026-10-11)
      if (rlk) return no(s, made.name + ": " + rlk.charAt(0).toLowerCase() + rlk.slice(1) + ".");
      var fee = rec.fee || 0;
      var bsto = ws.npc ? null : benchStore(s), haveB = function (k, n) { return has(s, k, n) || ((s.bag[k] || 0) + benchStored(s, bsto, k)) >= (n || 1); };
      // times: make it again and again -- "all" while there's enough (Cam, 2026-10-14: "Cook all feature for
      // neuropets"). Each one is checked and made exactly as a single one; the run stops at the first that can't be.
      var want = opts.times === "all" ? 1000 : Math.max(1, Math.min(1000, Math.floor(+opts.times || 1)));
      var done = 0, madeAll = 0, gxAll = 0, feeAll = 0, savedAll = {}, stop = "", ranOut = false;
      var lv0 = ws.skill ? levelOf(s.player.skills[ws.skill] || 0) : 0;
      for (var t = 0; t < want; t++) {
        var why = "", out = false;
        var kit = (rec.uses || []).filter(function (k) { return !has(s, k); });
        var short = Object.keys(rec.needs).filter(function (k) { return !haveB(k, rec.needs[k]); });
        if (kit.length) why = "You need " + kit.map(function (k) { return aOr(ITEMS[k].name.toLowerCase()); }).join(" and ") + " for that" +
                              (kit.indexOf("chisel") >= 0 ? " -- smith one at the anvil (or the merchant has them)" : "") + (kit.indexOf("potofwater") >= 0 ? (kit.indexOf("chisel") >= 0 ? "; " : " -- ") + "a clay pot, filled, is made at your bench" : "") + ".";
        else if (short.length) { why = "Not enough " + short.map(function (k) { return ITEMS[k].name.toLowerCase(); }).join(" or ") + (bsto ? " (in your bag or the bank)" : "") + "."; out = true; }
        else if (stackRoom(s, rec.make) < (rec.n || 1)) why = "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + " slots) -- there's no room for " + aOr(made.name) + ". Store or sell something first.";
        else if (fee && !hasCoins(s, fee)) { why = "The " + (ws.who || ws.name.toLowerCase()) + " costs " + fee + " coin" + (fee === 1 ? "" : "s") + " -- you have " + (s.coins || 0) + ". The merchant buys what you can spare."; out = true; }
        else if (!roomFor(s, rec.make)) {                                // a new kind needs room (what's used up frees some)
          var freed = Object.keys(rec.needs).filter(function (k) { return (s.bag[k] || 0) === rec.needs[k]; }).length;
          if (bagUsed(s) - freed + 1 > bagCap(s)) why = "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + ") -- there's no room for " + aOr(made.name.toLowerCase()) + ". Sell something first, or buy a bigger bag.";
        }
        if (why) { if (!done) return no(s, why); stop = why; ranOut = out; break; }
        // a hand in the room now and then saves an ingredient (2026-10-10): 10% a craft, counted, so it's the same everywhere
        var hf = ws.npc ? { save: 0 } : handFx(s, opts.workshop), saved = "";
        if (hf.save) {
          s.handSave = s.handSave || {};
          s.handSave[opts.workshop] = (s.handSave[opts.workshop] || 0) + Math.round(hf.save * 10);    // in tenths, so it never drifts
          if (s.handSave[opts.workshop] >= 10) {
            s.handSave[opts.workshop] -= 10;
            saved = Object.keys(rec.needs).sort(function (a, b) { return rec.needs[b] - rec.needs[a]; })[0];
          }
        }
        Object.keys(rec.needs).forEach(function (k) { takeBench(s, k, rec.needs[k] - (k === saved ? Math.max(1, Math.floor(rec.needs[k] / 2)) : 0), bsto); });
        if (saved) savedAll[saved] = (savedAll[saved] || 0) + Math.max(1, Math.floor(rec.needs[saved] / 2));
        (rec.uses || []).forEach(function (k) { wearKit(s, null, k, now); });       // a chisel, a needle, a pot of water (2026-10-09)
        if (fee) { spend(s, fee); feeAll += fee; }
        var nMade = rec.n || 1;
        if (opts.workshop === "apothecary" && masterHerbalist(s)) {            // a master herbalist: every 8th potion is free
          s.potionsMade = (s.potionsMade || 0) + 1;
          if (s.potionsMade % 8 === 0) nMade++;
        }
        give(s, rec.make, nMade);
        madeAll += nMade; done++;
        if (ws.skill) {
          var gx = Math.round(rec.xp * rate("xp") * modeBonus(s, "xp") * (1 + (companion(s, now) ? boostFor(s.pet, ws.skill, now) : 0) + (ROOM_OF[opts.workshop] ? ROOM_XP[roomTier(s, ROOM_OF[opts.workshop])] : 0) + handFx(s, opts.workshop).xp) * homeXp(s, ws.skill, now) * noviceMult(levelOf(s.player.skills[ws.skill] || 0)) * 10) / 10;   // a companion's knack; a better room; a meal, the stars; novice
          s.player.skills[ws.skill] = Math.round(((s.player.skills[ws.skill] || 0) + gx) * 10) / 10;
          gxAll += gx;
        }
      }
      var many = madeAll > 1 ? madeAll + " × " + made.name.toLowerCase() : aOr(made.name);
      // how many crafts it was, for the records (actAndNote)
      var crafted = function (r) { if (r && r.ok) r.crafts = done; return r; };
      // a run of "all" ends when the ingredients (or coins) do: that's expected, not news; anything else is said
      var tail = stop && !(opts.times === "all" && ranOut) ? " Stopped after " + done + ": " + stop.charAt(0).toLowerCase() + stop.slice(1) : "";
      if (ws.npc) return crafted(yes(s, now, ws.who + " the " + ws.name.toLowerCase() + " made you " + many + (feeAll ? " (" + feeAll + " coins)." : ".") + tail));
      if (ws.skill) {
        var skn = SKILLS[ws.skill].name, af = levelOf(s.player.skills[ws.skill]);
        gxAll = Math.round(gxAll * 10) / 10;
        var savedTxt = Object.keys(savedAll).map(function (k) { return savedAll[k] + " " + ITEMS[k].name.toLowerCase(); }).join(" and ");
        var msg = (ws.skill === "cooking" ? "You cooked " : "You made ") + many
                  + " (+" + gxAll + " " + skn + " xp" + (feeAll ? ", " + feeAll + " coin" + (feeAll === 1 ? "" : "s") : "") + ")."
                  + (savedTxt ? " Your " + JOBS[ROOM_OF[opts.workshop]].name.toLowerCase() + " saved you " + savedTxt + "." : "") + tail;
        if (af > lv0) note(s, now, "You reached " + skn + " level " + af + "!");
        return crafted(yes(s, now, msg));
      }
      return no(s, "Nobody makes that.");
    }
    if (action === "repair") {
      var rt = ITEMS[opts.item], rtool = rt && rt.tool;
      if (!rtool) return no(s, "Only tools are mended.");
      if (rtool.stone) return no(s, "Stone tools can't be mended -- make another at your bench.");
      if (!has(s, opts.item)) return no(s, "You don't have " + aOr(rt.name) + ".");
      var worn = (s.player.wear || {})[opts.item] || 0;
      if (!worn) return no(s, "Your " + rt.name.toLowerCase() + " isn't worn.");
      var rc = repairCost(opts.item);
      if (!rc) return no(s, "Nobody knows how to mend that.");
      var rshort = Object.keys(rc.needs).filter(function (k) { return !has(s, k, rc.needs[k]); });
      if (rshort.length) return no(s, "Mending it takes " + itemsText(rc.needs) + " -- not enough " + rshort.map(function (k) { return ITEMS[k].name.toLowerCase(); }).join(" or ") + ".");
      if (rc.fee && !hasCoins(s, rc.fee)) return no(s, "Mending it costs " + rc.fee + " coins at the " + WORKSHOPS[rc.ws].name.toLowerCase() + ".");
      Object.keys(rc.needs).forEach(function (k) { take(s, k, rc.needs[k]); });
      if (rc.fee) spend(s, rc.fee);
      s.player.wear[opts.item] = 0;
      return yes(s, now, "Mended at the " + WORKSHOPS[rc.ws].name.toLowerCase() + ": your " + rt.name.toLowerCase() + " is as good as new (" + itemsText(rc.needs) + (rc.fee ? ", " + rc.fee + " coins" : "") + ").");
    }
    if (action === "sell") {
      var buyer = WORKSHOPS[opts.to || "merchant"];
      if (!buyer || !buyer.trade) return no(s, "Nobody here buys things.");
      if (!npcHere(s, opts.to || "merchant", now)) return no(s, buyer.who + " isn't in the village today.");
      var sid = opts.item, sit = ITEMS[sid];
      if (!sit || !has(s, sid)) return no(s, "You haven't got that.");
      if (boundWhy(sid)) return no(s, boundWhy(sid));
      var keepOne = (s.player.tools[sit.tool && sit.tool.skill] === sid) || Object.keys(s.player.gear || {}).some(function (k) { return s.player.gear[k] === sid; });
      var max = (s.bag[sid] || 0) - (keepOne ? 1 : 0);
      if (max <= 0) return no(s, "That's the " + sit.name.toLowerCase() + " you're using -- take it off first.");
      var sn = opts.n === "all" ? max : Math.max(1, Math.min(max, opts.n | 0 || 1));
      var paid = sellFor(sid, sn, buyer.trade);
      take(s, sid, sn);
      s.coins = (s.coins || 0) + paid;
      return yes(s, now, "Sold " + (sn > 1 ? sn + " × " : "") + sit.name.toLowerCase() + " to " + buyer.who + " for " + paid + " coin" + (paid === 1 ? "" : "s") + ".");
    }
    if (action === "upgrade") {
      var ug = UPGRADES[opts.what];
      if (!ug) return no(s, "There's nothing like that to build.");
      var ul = upgradeLevel(s, opts.what), ucost = ug.costs[ul];
      if (!ucost) return no(s, "That's as big as it gets.");
      if (!hasCoins(s, ucost)) return no(s, ug.name + " costs " + ucost + " coins -- you have " + (s.coins || 0) + ".");
      var ushort = Object.keys(ug.needs || {}).filter(function (k) { return !has(s, k, ug.needs[k]); });
      if (ushort.length) return no(s, ug.name + " also takes " + itemsText(ug.needs) + " (mined in the Forest and on the Coast).");
      Object.keys(ug.needs || {}).forEach(function (k) { take(s, k, ug.needs[k]); });
      spend(s, ucost);
      s.upgrades = s.upgrades || {}; s.upgrades[opts.what] = ul + 1;
      return yes(s, now, ug.name + " is built (" + ucost + " coins): " + ug.says + ".");
    }
    if (action === "buy") {
      var seller = opts.from || "merchant", stock = stockFor(seller, now);
      if (!WORKSHOPS[seller] || !WORKSHOPS[seller].trade) return no(s, "Nobody here sells things.");
      if (!npcHere(s, seller, now)) return no(s, WORKSHOPS[seller].who + " isn't in the village today.");
      var line = stock.filter(function (x) { return x[0] === opts.item; })[0];
      if (!line) return no(s, WORKSHOPS[seller].who + " doesn't sell that" + (seller === "merchant" ? " today." : "."));
      var bn = Math.max(1, Math.min(50, opts.n | 0 || 1)), cost = line[1] * bn;
      if (ITEMS[line[0]].bagSize) {                                     // a bigger bag: it replaces the one you carry
        if (ITEMS[line[0]].bagSize <= bagCap(s)) return no(s, "Your bag already has " + bagCap(s) + " slots.");
        if (!hasCoins(s, line[1])) return no(s, aOr(ITEMS[line[0]].name) + " costs " + line[1] + " coins -- you have " + (s.coins || 0) + ".");
        spend(s, line[1]);
        s.bagSize = line[0];
        return yes(s, now, "Bought " + aOr(ITEMS[line[0]].name.toLowerCase()) + " from " + WORKSHOPS[seller].who + " for " + line[1] + " coins: " + ITEMS[line[0]].bagSize + " slots, " + ITEMS[line[0]].stack + " to a stack.");
      }
      if (!roomFor(s, line[0])) return no(s, "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + ") -- sell something first, or buy a bigger bag.");
      if (stackRoom(s, line[0]) < bn) return no(s, stackRoom(s, line[0]) ? "You can only carry " + stackRoom(s, line[0]) + " more " + ITEMS[line[0]].name.toLowerCase() + " -- your bag is nearly full." : "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + " slots) -- store some at home first.");
      if (!hasCoins(s, cost)) return no(s, aOr(ITEMS[line[0]].name) + " costs " + line[1] + " coins -- you have " + (s.coins || 0) + ".");
      spend(s, cost);
      give(s, line[0], bn);
      return yes(s, now, "Bought " + (bn > 1 ? bn + " × " + ITEMS[line[0]].name.toLowerCase() : aOr(ITEMS[line[0]].name.toLowerCase())) + " from " + WORKSHOPS[seller].who + " for " + cost + " coins.");
    }
    if (action === "reskin") {
      if (!npcHere(s, "reskinner", now)) return no(s, "The reskinner comes once you've beaten two bosses.");
      var rp = findPet(s, opts.id);
      if (!rp) return no(s, "There's no pet like that.");
      if (opts.reset) { delete rp.skin; return yes(s, now, who(rp) + " has " + (rp.name ? "their" : "its") + " own colours back."); }
      var skin = null, rcost = RESKIN_COST, label = "new colours";
      if (opts.preset) {
        var pr = RESKINS[opts.preset];
        if (!pr) return no(s, "There's no skin like that.");
        skin = copy(pr.pal); rcost = pr.cost; label = "the " + pr.name + " skin";
      } else {
        skin = {};
        Object.keys(opts.skin || {}).forEach(function (k) {
          if (/^[a-z]$/.test(k) && /^#[0-9a-fA-F]{6}$/.test(String(opts.skin[k]))) skin[k] = String(opts.skin[k]).toLowerCase();
        });
        if (!Object.keys(skin).length) return no(s, "Paint a part of the pet first.");
      }
      if (!hasCoins(s, rcost)) return no(s, "That costs " + rcost + " coins -- you have " + (s.coins || 0) + ".");
      spend(s, rcost);
      rp.skin = skin;
      return yes(s, now, "Iris gave " + who(rp) + " " + label + " (" + rcost + " coins).");
    }
    if (action === "equip") {
      var eq = ITEMS[opts.item];
      if (!eq || !(eq.tool || eq.gear)) return no(s, "That can't be worn or carried.");
      if (!has(s, opts.item)) return no(s, "You don't have " + aOr(eq.name) + ".");
      if (eq.tool) {
        var tl = levelOf(s.player.skills[eq.tool.skill] || 0);
        if (tl < eq.tool.level) return no(s, "The " + eq.name.toLowerCase() + " needs " + SKILLS[eq.tool.skill].name + " level " + eq.tool.level + ".");
        s.player.tools[eq.tool.skill] = opts.item;
        return yes(s, now, "You'll take the " + eq.name.toLowerCase() + " " + SKILLS[eq.tool.skill].verb + " (from your next trip).");
      }
      var g = eq.gear, why = cantWear(s, opts.item);
      if (g.cls && !canUseClass(s.player, g.cls)) return no(s, "The " + eq.name.toLowerCase() + " is for " + clsPlural(g.cls) + ".");   // (an old class's too: New Game Plus)
      if (why) return no(s, "The " + eq.name.toLowerCase() + " " + why + ".");
      if (g.who === "pet") {
        if (!s.pet || stage(s.pet, now) === "egg") return no(s, "There's no pet to wear it yet.");
        if (petSlots(s.pet).indexOf(g.slot) < 0) return no(s, who(s.pet) + " has no " + SLOT_NAMES[g.slot].toLowerCase() + " for that.");
        s.pet.gear = s.pet.gear || {};
        s.pet.gear[g.slot] = opts.item;
        return yes(s, now, who(s.pet) + " is wearing the " + eq.name.toLowerCase() + ".");
      }
      if (g.cls && !canUseClass(s.player, g.cls)) return no(s, "The " + eq.name.toLowerCase() + " is for " + clsPlural(g.cls) + ".");
      if (g.slot === "ammo" && quiverWhyNot(s.player, opts.item)) return no(s, "Not with that quiver: " + quiverWhyNot(s.player, opts.item) + ".");   // (Part 10)
      if (g.slot === "ammo" && needsQuiver(opts.item)) return loadQuiver(s, s.player, opts.item, now);   // N24: wearing arrows loads the quiver
      if (g.slot === "quiver" && s.player.gear.ammo && needsQuiver(s.player.gear.ammo) && ITEMS[s.player.gear.ammo] && arrowTier(s.player.gear.ammo) > g.quiver.tier)   // (N19)
        return no(s, "The " + eq.name.toLowerCase() + " can't hold " + ITEMS[s.player.gear.ammo].name.toLowerCase() + "s -- take them off first, or wear a better quiver.");
      var both = g.slot === "weapon" && twoHanded(opts.item) && (isWeapon(s.player.gear.offhand) || isShield(s.player.gear.offhand)) ? ITEMS[s.player.gear.offhand].name.toLowerCase() : "";
      if (both) delete s.player.gear.offhand;                          // a maul takes both hands (Battle Re-work Part 5)
      s.player.gear[g.slot] = opts.item;
      if (both) return yes(s, now, "You take up the " + eq.name.toLowerCase() + " in both hands -- the " + both + " goes back in the bag.");
      return yes(s, now, (g.slot === "ammo" ? "You'll shoot " + eq.name.toLowerCase() + "s" : "You put on the " + eq.name.toLowerCase()) + " (from your next trip)." + weightWarn(s.player, opts.item));   // (V17)
    }
    if (action === "unequip") {
      var ue = ITEMS[opts.item];
      if (ue && ue.tool && s.player.tools[ue.tool.skill] === opts.item) { delete s.player.tools[ue.tool.skill]; return yes(s, now, "You put the " + ue.name.toLowerCase() + " away."); }
      if (ue && ue.gear && ue.gear.who === "player" && s.player.gear[ue.gear.slot] === opts.item) {
        if (ue.gear.slot === "quiver" || (ue.gear.slot === "ammo" && needsQuiver(opts.item))) { if (ue.gear.slot === "quiver") s.player.gear.quiver = opts.item; unloadQuiver(s, s.player); }   // (N24: the arrows back in the bag)
        delete s.player.gear[ue.gear.slot];
        var outA = ue.gear.slot === "quiver" && s.player.gear.ammo && needsQuiver(s.player.gear.ammo) ? ITEMS[s.player.gear.ammo] : null;   // (N19) the arrows come out with it
        if (outA) delete s.player.gear.ammo;
        return yes(s, now, "You took off the " + ue.name.toLowerCase() + (outA ? " -- and the " + outA.name.toLowerCase() + "s with it" : "") + ".");
      }
      if (ue && ue.gear && ue.gear.who === "pet" && s.pet && s.pet.gear && s.pet.gear[ue.gear.slot] === opts.item) {
        delete s.pet.gear[ue.gear.slot]; return yes(s, now, "You took the " + ue.name.toLowerCase() + " off " + whom(s.pet) + ".");
      }
      return no(s, "You aren't using that.");
    }
    if (action === "place") {
      var fu = ITEMS[opts.item];
      if (!fu || !fu.furniture) return no(s, "That doesn't go in the room.");
      // the room remembers which one is down (a woven or a floral rug, 2026-10-11); a different one swaps it, back to the bag
      var here = s.room[fu.furniture], hereId = here === true ? Object.keys(ITEMS).filter(function (k) { return ITEMS[k].furniture === fu.furniture; })[0] : here;
      if (here && hereId === opts.item) return no(s, "There's already " + aOr(fu.name.toLowerCase()) + " in the room.");
      if (!has(s, opts.item)) return no(s, "You don't have " + aOr(fu.name.toLowerCase()) + ".");
      if (here && hereId && ITEMS[hereId] && !roomFor(s, hereId)) return no(s, "Your bag has no room for the " + ITEMS[hereId].name.toLowerCase() + " that's down now.");
      take(s, opts.item);
      if (here && hereId && ITEMS[hereId]) give(s, hereId, 1);
      s.room[fu.furniture] = opts.item;
      return yes(s, now, here && hereId && ITEMS[hereId] ? "You swapped the " + ITEMS[hereId].name.toLowerCase() + " for the " + fu.name.toLowerCase() + " (the " + ITEMS[hereId].name.toLowerCase() + " is in your bag)."
                                          : "You put the " + fu.name.toLowerCase() + " in the pet's room.");
    }
    if (action === "open") {
      var cr = CRATES[opts.item];
      if (!cr) return no(s, "That doesn't open.");
      if (!has(s, opts.item)) return no(s, "You don't have " + aOr(ITEMS[opts.item].name) + ".");
      if (cr.lock && levelOf(s.player.skills.larceny || 0) < cr.lock) return no(s, "The lock needs Larceny level " + cr.lock + " to pick.");   // a locked crate (2026-10-17)
      var cj = { seed: typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0) }, got = {}, cherbs = {};
      for (var ci = 0; ci < (cr.rolls || 0); ci++) {
        var ct = pick(cj, cr.loot);
        if (HERB_TIER_OF[ct]) { var chh = rollHerb(cj, cr.level || 5); cherbs[chh] = (cherbs[chh] || 0) + 1; ct = "unidherb"; }   // unidentified (2026-10-07)
        got[ct] = (got[ct] || 0) + 1;
      }
      // room for what's inside (the crate's own space frees up if it's your last)
      var newKinds = Object.keys(got).concat(Object.keys(cr.fixed || {}).filter(function (k) { return !got[k]; }))   // (a starter crate's too)
        .filter(function (k) { return !((s.bag[k] || 0) > 0); }).length;
      if (!(s.dev && s.dev.infinite) && bagUsed(s) - ((s.bag[opts.item] || 0) === 1 ? 1 : 0) + newKinds > bagCap(s))
        return no(s, "Your bag is too full to open it (" + bagUsed(s) + "/" + bagCap(s) + ") -- make room for " + newKinds + " more kind" + (newKinds === 1 ? "" : "s") + " of thing first.");
      take(s, opts.item);
      giveFound(s, got, cherbs);
      if (cr.fixed) Object.keys(cr.fixed).forEach(function (k) { give(s, k, cr.fixed[k], true); got[k] = (got[k] || 0) + cr.fixed[k]; });   // a starter crate: exactly what's inside, herbs named (2026-10-17)
      var cc = cr.coins ? cr.coins[0] + Math.floor(rnd(cj) * (cr.coins[1] - cr.coins[0] + 1)) : 0;
      if (cc) s.coins = (s.coins || 0) + cc;
      if (cr.lock) addXp(s, s.player, "larceny", cr.lockXp, now);
      var opened = yes(s, now, (cr.lock ? "You picked the lock (+" + cr.lockXp + " Larceny xp). " : "") + "Inside the " + ITEMS[opts.item].name.toLowerCase() + ": " + itemsText(got) + (cc ? " and " + cc + " coins" : "") + ".");
      // one at a time, in the order they came out -- the popup reveals them like this
      opened.got = [];
      Object.keys(got).forEach(function (k) { for (var gi = 0; gi < got[k]; gi++) opened.got.push(k); });
      return opened;
    }
    if (action === "dev") return devAct(s, opts, now);
    if (action === "combine") {
      var fr = ITEMS[opts.item];
      if (!fr || !fr.frag) return no(s, "That doesn't combine.");
      var times = Math.max(1, opts.all ? Math.floor(((s.dev && s.dev.infinite) ? 5 : s.bag[opts.item] || 0) / 5) : 1);
      if (!has(s, opts.item, 5 * times)) return no(s, "It takes 5 " + fr.name.toLowerCase() + "s to make " + aOr(ITEMS[fr.frag].name) + ".");
      take(s, opts.item, 5 * times);
      give(s, fr.frag, times);
      return yes(s, now, "You pressed " + 5 * times + " " + fr.name.toLowerCase() + "s into " + (times > 1 ? times + " × " + ITEMS[fr.frag].name.toLowerCase() : aOr(ITEMS[fr.frag].name)) + ".");
    }
    if (action === "farm") return farmAct(s, opts, now);
    if (action === "class") {
      var cl = CLASSES[opts.cls];
      if (!cl) return no(s, "There's no class like that.");
      if (s.player.cls === opts.cls) return no(s, "You're already a " + cl.name + ".");
      var swc = switchClass(s, opts.cls, opts);                          // a switch is made at the Guild hall, and paid for (Part 9)
      if (swc.error) return no(s, swc.error);
      var off = [];
      Object.keys(s.player.gear).forEach(function (k) { var gi = ITEMS[s.player.gear[k]]; if (gi && gi.gear.cls && gi.gear.cls !== opts.cls && (s.player.oldClasses || []).indexOf(gi.gear.cls) < 0) { off.push(gi.name.toLowerCase()); delete s.player.gear[k]; } });
      var was = s.player.cls;
      var tutBye = classTutOf(s) ? classTutEnd(s, now) : "";             // leaving a class mid-lesson: the tutor says goodbye
      // your FIRST class starts at its own combat skill's level, as an old save's did; a later one starts at 1 (Cam, Q2)
      var firstCls = !was && !Object.keys(s.player.classes || {}).some(function (k) { return (s.player.classes[k] || {}).xp > 0; });
      s.player.cls = opts.cls;
      var cbx = classBox(s.player, opts.cls);
      if (firstCls && !(cbx.xp > 0)) cbx.xp = s.player.skills[CLASS_SKILL[cl.style]] || 0;
      s.player.combat.special = "";
      // (the sandbox's quick switch in the sidebar skips the lesson: PT19 b1, "quicker when i want to change in a pinch")
      var tutHi = !(opts.quick && s.dev && s.dev.on) && !((s.classTut || {}).done || {})[opts.cls] && classTutStart(s, opts.cls, now);   // its tutor's lesson, once (2026-10-17)
      return yes(s, now, (tutBye ? tutBye + " " : "") + (was ? "You changed class" + swc.paid + ": you're " : "You became ") + (/^[AEIOU]/.test(cl.name) ? "an " : "a ") + cl.name + "." + (off.length ? " You took off the " + off.join(", ") + "." : "") +
                 (tutHi ? " " + classTutor(opts.cls).standIn + " will show you how it works." : ""));
    }
    if (action === "hunt") {
      var hg = HUNTS[opts.ground];
      if (!hg) return no(s, "There's nowhere like that to hunt.");
      if (s.player.battle && s.player.battle.kind === "boss") return no(s, "Finish your fight first -- or run!");
      if (combatLevel(s.player) < hg.level) return no(s, "The " + hg.name + " needs combat level " + hg.level + ".");
      autoEat(s, s.player, 50, now, areaWorst(hg, guardOf(s.player)));
      if (mustFlee(s.player, areaWorst(hg, guardOf(s.player)))) return no(s, "You're too hurt to hunt -- rest or eat first.");
      if (s.player.job) endTrip(s, s.player, now, "stop");
      s.player.job = huntJob(opts.ground, now, typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0));
      var hw = ITEMS[(s.player.gear || {}).weapon], dryPick = hw && hw.gear.style === "ranged" && arrowsLeft(s, s.player) < 1 ? pickWeapon(s, s.player, false, { dry: true, noMain: true }) : null;
      return yes(s, now, "You went hunting at the " + hg.name + (dryPick ? " -- no arrows, so " + (dryPick.id ? "your " + ITEMS[dryPick.id].name.toLowerCase() : "your fists") + " for now" : "") + ".");   // (2026-10-20)
    }
    if ((action === "pethunt" || action === "pettrip" || action === "companion") && s.breeding && (s.breeding.a === opts.id || s.breeding.b === opts.id))
      return no(s, "That pet is busy breeding.");
    if (action === "petwork") return workAct(s, opts, now);              // a job at home (2026-10-10)
    if ((action === "pethunt" || action === "pettrip") && denPet(s, opts.id) && denPet(s, opts.id).work)
      return no(s, who(denPet(s, opts.id)) + " is working as " + aOr(JOBS[denPet(s, opts.id).work].name).toLowerCase() + " -- take them off the job first.");
    if ((action === "pethunt" || action === "pettrip" || action === "companion") && denPet(s, opts.id) && denPet(s, opts.id).away)
      return no(s, who(denPet(s, opts.id)) + " is away on an expedition.");
    if (action === "breed") {
      var ba = petById(s, opts.a), bb = petById(s, opts.b);
      if (!ba || !bb || ba === bb) return no(s, "Pick two of your pets.");
      if (s.breeding) return no(s, "A pair is already breeding.");
      var wa = cantBreed(s, ba, now), wb = cantBreed(s, bb, now);
      if (wa) return no(s, who(ba) + " " + wa + ".");
      if (wb) return no(s, who(bb) + " " + wb + ".");
      if (geneOf(ba).sex === geneOf(bb).sex) return no(s, "It takes a male and a female -- " + who(ba) + " and " + whom(bb) + " are both " + (geneOf(ba).sex === "f" ? "female" : "male") + ".");
      if (s.hatchery.length >= hatchSlots(s)) return no(s, "The hatchery is full -- the egg needs a place.");
      var sp = specialFor(ba, bb, now);
      s.breeding = { a: ba.id, b: bb.id, since: now, until: now + (s.dev && s.dev.instantHatch ? 0 : BREED_TIME),
                     special: sp ? sp.kind : "", seed: typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0) };
      return yes(s, now, who(ba) + " and " + whom(bb) + " are spending time together" + (sp ? " -- and something feels special." : "."));
    }
    if (action === "boss") return bossFight(s, opts, now);
    if (action === "battle") {
      var bb = s.player.battle;
      if (!bb && opts.cmd === "special" && s.player.job && s.player.job.hunt) {   // between fights: on the next one's first blow (2026-10-11)
        var nc = s.player.cls ? CLASSES[s.player.cls] : null, nsp = specOf(s.player, s.player.combat.special);   // (V18; PT39 f4: no class needed for a weapon's)
        if (!nsp) return no(s, nc0(s) ? "Choose a special first." : "Choose a class, or a weapon special, first (Character sheet, Combat).");
        if (specialLock(s.player, nsp) || specUnlockWhy(s.player, nsp)) return no(s, specialLock(s.player, nsp) || specUnlockWhy(s.player, nsp));
        if (usesFury(s.player) && specMeter(s.player, null) < specCostOf(s.player, nsp)) return no(s, nsp.name + " needs " + specCostOf(s.player, nsp) + " fury (" + Math.floor(s.player.fury || 0) + " so far) -- it builds as you hit and get hit.");
        if (specMeter(s.player, null) < specCostOf(s.player, nsp)) return no(s, "Your special bar needs " + specCostOf(s.player, nsp) + "%.");
        s.player.combat.queued = true;
        return yes(s, now, nsp.name + " on the first blow of your next fight!");
      }
      if (!bb && opts.cmd === "swap") {                                   // between fights: just change hands, free
        var og0 = s.player.gear || {}, mm = og0.weapon;
        if (!isWeapon(og0.offhand)) return no(s, "There's no weapon in your off hand to swap to.");
        og0.weapon = og0.offhand; if (mm) og0.offhand = mm; else delete og0.offhand;
        return yes(s, now, "You'll fight with your " + ITEMS[og0.weapon].name.toLowerCase() + (mm ? " -- the " + ITEMS[mm].name.toLowerCase() + " in your off hand." : "."));
      }
      if (!bb) return no(s, "You're not in a fight.");
      if (opts.cmd === "auto" || opts.cmd === "manual") {
        if (bb.kind !== "boss") return no(s, "Hunts fight on their own; manual is for bosses.");
        bb.manual = opts.cmd === "manual";
        bb.nextRound = bb.manual ? MANUAL_WAIT : now + ROUND;
        s.player.at = now;
        return yes(s, now, bb.manual ? "Manual: the fight waits for your move." : "Auto: the fight plays itself.");
      }
      if (opts.cmd === "attack") {
        if (!bb.manual) return no(s, "The fight is on auto -- switch to manual to choose each move.");
        return manualRound(s, bb, now);
      }
      if (opts.cmd === "run") {
        var mname = MONSTERS[bb.mon].name;
        if (bb.kind === "boss") endBossBattle(s, s.player, bb, "ran", now);
        else endHuntBattle(s, s.player, s.player.job, bb, "ran", now);
        return yes(s, now, "You got away from " + (MONSTERS[bb.mon].boss ? mname : "the " + mname.toLowerCase()) + ".");
      }
      if (opts.cmd === "cast") {                                          // pick this round's spell, like a battle move (2026-10-15)
        var csp = SPELLS[opts.spell];
        if (!bb.me || !bb.me.magic) return no(s, "You cast spells with a wand or a staff in hand.");
        if (!csp || (s.player.loadout || []).indexOf(opts.spell) < 0) return no(s, "Load that spell in your Spellbook first (up to " + loadoutMax(s.player) + ").");
        var clk = spellLock(s, opts.spell);
        if (clk) return no(s, csp.name + ": " + clk.toLowerCase() + ".");
        var ccost = spellCost(s.player, csp, 1), cshort = Object.keys(ccost).filter(function (k) { return !has(s, k, ccost[k]); });
        if (cshort.length) return no(s, csp.name + " needs " + itemsText(ccost) + " -- not enough " + cshort.map(function (k) { return ITEMS[k].name.toLowerCase(); }).join(" or ") + ".");
        bb.castNext = opts.spell;
        if (bb.manual) return manualRound(s, bb, now);
        return { ok: true, msg: "Next cast: " + csp.name + ".", state: s };
      }
      if (opts.cmd === "swap") {                                          // main and off hand change places: your next attack (Battle Re-work)
        var og = s.player.gear || {}, m0 = og.weapon;
        if (!isWeapon(og.offhand)) return no(s, "There's no weapon in your off hand to swap to.");
        og.weapon = og.offhand;
        if (m0) og.offhand = m0; else delete og.offhand;
        if (pickWeapon(s, s.player).from !== "main") {                    // e.g. a bow with no arrows: put them back
          og.offhand = og.weapon; if (m0) og.weapon = m0; else delete og.weapon;
          return no(s, "You can't fight with the " + ITEMS[og.offhand].name.toLowerCase() + " now" + (ITEMS[og.offhand].gear.style === "ranged" ? " -- no arrows for it." : "."));
        }
        refreshFighter(s, s.player, bb, now);
        bb.skip = true; bb.skipWhy = "swap";
        var swMsg = "You swap to your " + ITEMS[og.weapon].name.toLowerCase() + " -- it costs your next attack.";
        if (bb.manual) { var swr = manualRound(s, bb, now); if (swr && swr.ok) swr.msg = swMsg + (swr.msg ? " " + swr.msg : ""); return swr; }
        return yes(s, now, swMsg);
      }
      if (opts.cmd === "special") {
        var cc = s.player.cls ? CLASSES[s.player.cls] : null, spc = specOf(s.player, s.player.combat.special);   // (V18; PT39 f4)
        if (!spc) return no(s, nc0(s) ? "Choose a special first." : "Choose a class, or a weapon special, first (Character sheet, Combat).");
        if (!specFits(cc, spc, bb.style, (bb.me || {}).wid)) { var nst = spc.style || cc.style;
          return no(s, spc.name + " needs " + (spc.item ? "the " + ITEMS[spc.item].name.toLowerCase() + " in your hand" : spc.family ? aOr(SPECIALS.families[spc.family].name.toLowerCase()) + " in your hand" : nst === "ranged" ? "a bow" : cc.name === "Thief" ? "daggers" : "a melee weapon") + "."); }
        if (specialLock(s.player, spc) || specUnlockWhy(s.player, spc)) return no(s, specialLock(s.player, spc) || specUnlockWhy(s.player, spc));
        if (specMeter(s.player, bb) < specCostOf(s.player, spc)) return no(s, usesFury(s.player) ? spc.name + " needs " + specCostOf(s.player, spc) + " fury (" + Math.floor(s.player.fury || 0) + " so far) -- it builds as you hit and get hit." : "Your special bar needs " + specCostOf(s.player, spc) + "%.");
        bb.queued = true;
        if (bb.manual) return manualRound(s, bb, now);
        return { ok: true, msg: "Next attack: " + spc.name + "!", state: s };
      }
      return no(s, "Nothing to do there.");
    }
    if (action === "pethunt") {
      var hq = denPet(s, opts.id), pg = HUNTS[opts.ground];
      if (!hq) return no(s, "Only pets in the den go hunting -- your companion stays with you.");
      if (!pg) return no(s, "There's nowhere like that to hunt.");
      if (levelOf(hq.xp || 0) < pg.level) return no(s, "The " + pg.name + " needs a level " + pg.level + " pet.");
      if (hq.injuredUntil && hq.injuredUntil > now) return no(s, who(hq) + " is hurt and resting.");
      if (hq.job) endTrip(s, hq, now, "stop");
      var pev = pg.time * 1000;
      hq.job = { skill: "attack", spot: opts.ground, hunt: opts.ground, since: now, next: now, until: now + JOB_MAX, every: pev,
                 seed: typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0), count: 0, xp: 0, items: {}, kills: {},
                 petHp: 10 + levelOf(hq.xp || 0) };
      hq.job.next = now + huntWait(hq.job);
      return yes(s, now, who(hq) + " went hunting at the " + pg.name + ".");
    }
    if (action === "drink") {
      var dk = ITEMS[opts.item];
      if (!dk || !dk.brew) return no(s, "That isn't a potion you can drink.");
      if (!has(s, opts.item)) return no(s, "There's no " + dk.name.toLowerCase() + " in the bag.");
      take(s, opts.item);
      var was0 = (s.player.brews || {})[dk.brew.kind];
      s.player.brews[dk.brew.kind] = { id: opts.item, left: dk.brew.uses };
      return yes(s, now, "You drank " + aOr(dk.name.toLowerCase()) + ": " + brewText(dk.brew) + "." +
                 (was0 && was0.id !== opts.item && ITEMS[was0.id] ? " It replaces your " + ITEMS[was0.id].name.toLowerCase() + "." : ""));
    }
    if (action === "eat") {
      var ef = ITEMS[opts.item];
      if (!ef || !ef.heal) return no(s, "That won't heal you -- try fruit, or cooked food for more.");
      if (s.player.hp >= maxHp(s.player)) return no(s, "You're already at full health.");
      if (!has(s, opts.item)) return no(s, "There's no " + ef.name.toLowerCase() + " in the bag.");
      take(s, opts.item);
      s.player.hp = Math.min(maxHp(s.player), s.player.hp + Math.round(ef.heal * (1 + (talentSum(s.player).foodHeal || 0))));   // First aid (Part 8)
      if (s.player.battle) s.player.battle.skip = true;                    // eating in a fight takes your next attack
      if (s.player.battle && s.player.battle.manual) {                       // manual: that's your move, and they swing
        var ateMsg = "You " + (ef.verb || "ate") + " " + aOr(ef.name) + " (+" + ef.heal + " health).";
        var mr = manualRound(s, s.player.battle, now);
        if (mr && mr.ok) mr.msg = ateMsg + (mr.msg ? " " + mr.msg : "");
        return mr;
      }
      return yes(s, now, "You " + (ef.verb || "ate") + " " + aOr(ef.name) + " (+" + ef.heal + " health)" + (s.player.battle ? " -- it costs your next attack." : "."));
    }
    if (action === "combat") {
      if (opts.style) {
        if (!STYLES[opts.style]) return no(s, "There's no style like that.");
        s.player.combat.style = opts.style;
        return yes(s, now, "You'll fight " + STYLES[opts.style].name.toLowerCase() + ".");
      }
      if (typeof opts.autoSpec === "boolean") {                         // (Battle Re-work Part 2: specials are yours to fire)
        delete s.player.combat.autoSpec;
        return opts.autoSpec ? no(s, "Specials only go off when you press Special now -- a fight rewards playing it.") : yes(s, now, "Your special bar fills up and waits -- press Special in a fight.");
      }
      if (typeof opts.special === "string") {
        var osp = specOf(s.player, opts.special);                                                          // (V18: any special you know)
        if (opts.special && !osp) return no(s, "There's no special like that for you.");
        if (opts.special && (specialLock(s.player, osp) || specUnlockWhy(s.player, osp))) return no(s, specialLock(s.player, osp) || specUnlockWhy(s.player, osp));
        s.player.combat.special = opts.special;
        return yes(s, now, opts.special ? osp.name + " is your special" + " -- press Special in a fight when the bar allows." : "No special -- plain attacks only.");
      }
      if (Array.isArray(opts.loadout)) {                                  // V18: the specials on your side bar, from the catalogue
        var lo = opts.loadout.filter(function (id, i, a) { return typeof id === "string" && a.indexOf(id) === i; });
        if (lo.length > SPECIALS.max) return no(s, "Your side bar holds " + SPECIALS.max + " specials -- take one off first.");
        var bad = lo.filter(function (id) { return !specKnown(s.player, id); })[0];
        if (bad) { var bs = specOf(s.player, bad); return no(s, bs ? specialLock(s.player, bs) || specUnlockWhy(s.player, bs) || "Not yours yet." : "There's no special like that."); }
        s.player.combat.loadout = lo;
        return yes(s, now, lo.length ? "On your side bar: " + lo.map(function (id) { return specOf(s.player, id).name; }).join(", ") + "." : "Your side bar has no specials.");
      }
      return no(s, "Nothing to change.");
    }
    if (action === "settings") {
      if (typeof opts.food === "string") {
        if (opts.food && !(ITEMS[opts.food] && ITEMS[opts.food].heal)) return no(s, "That won't heal you.");
        s.player.food = opts.food;
        if (typeof opts.eatBelow !== "number") return { ok: true, msg: opts.food ? "Between fights you'll eat " + ITEMS[opts.food].name.toLowerCase() + " below " + Math.round(s.player.eatBelow * 100) + "% health." : "Auto-eat is off.", state: s };
      }
      if (typeof opts.eatBelow === "number") {
        s.player.eatBelow = Math.max(0.2, Math.min(0.9, opts.eatBelow));
        return { ok: true, msg: "Between fights you'll eat below " + Math.round(s.player.eatBelow * 100) + "% health.", state: s };
      }
      if (typeof opts.retreat === "number") s.player.retreat = Math.max(0, Math.min(0.9, opts.retreat));
      return { ok: true, msg: "Saved: you come home from a hunt below " + Math.round(s.player.retreat * 100) + "% health.", state: s };
    }
    if (action === "companion") {
      var np = denPet(s, opts.id);
      if (!np) return no(s, "That pet isn't in the den.");
      if (p && p.away) return no(s, who(p) + " is away on an expedition -- wait till they're home.");
      if (p && stage(p, now) === "egg") return no(s, "Your egg hasn't hatched yet.");
      if (np.job) endTrip(s, np, now, "stop");
      np.work = "";                                                       // a companion doesn't keep a job at home
      delete np.choose;                                                   // (the hatch choice is made: a companion)
      s.den.splice(s.den.indexOf(np), 1);
      if (p) { p.asleep = false; s.den.push(p); }
      np.at = now;                               // the den looked after it: its needs start from now
      s.pet = np;
      return yes(s, now, who(np) + " is your companion now" + (p ? "; " + whom(p) + " went to the den." : "."));
    }
    if (action === "petmerge" || action === "petrelease") {               // duplicates: a star, or tokens (2026-10-10)
      var dq = denPet(s, opts.id), dl = dupeLock(s, dq);
      if (dl) return no(s, dl);
      if (action === "petmerge") {
        var into = opts.into === (s.pet && s.pet.id) ? s.pet : denPet(s, opts.into);
        if (!into || into === dq || into.species !== dq.species) return no(s, "Merge it into another " + SPECIES[dq.species].name.toLowerCase() + ".");
        if ((into.stars || 0) >= STAR_MAX) return no(s, who(into) + " already has " + STAR_MAX + " stars.");
        s.den.splice(s.den.indexOf(dq), 1);
        into.stars = (into.stars || 0) + 1;
        into.xp = Math.round(((into.xp || 0) + (dq.xp || 0) / 2) * 10) / 10;     // and half of its experience
        var same = who(dq) === who(into);
        return yes(s, now, (same ? "One " + kindName(dq).toLowerCase() + " joined the other" : who(dq) + " joined " + whom(into)) + ": " + (same ? "it" : who(into)) + " has " + into.stars + " star" + (into.stars === 1 ? "" : "s") + " now (+" + Math.round(into.stars * STAR_BOOST * 100) + "% to its boost, " + into.stars + " more kind" + (into.stars === 1 ? "" : "s") + " carried).");
      }
      if (isAstral(dq.species)) return no(s, "An Astral pet came from the sky -- it isn't one to trade for tokens. Merge it into its twin for a star instead.");   // (V10: not sold)
      var tk = TOKENS_FOR[rarityOf(dq)] || 5;
      s.den.splice(s.den.indexOf(dq), 1);
      s.petTokens = (s.petTokens || 0) + tk;
      return yes(s, now, who(dq) + " went to a good home on a farm far away. You got " + tk + " pet tokens (" + s.petTokens + " now).");
    }
    if (action === "tokenbuy") {                                         // the pet token shop (2026-10-10)
      var line = TOKEN_SHOP.filter(function (x) { return x[0] === opts.item; })[0];
      if (!line) return no(s, "The token shop doesn't have that.");
      if ((s.petTokens || 0) < line[1]) return no(s, ITEMS[line[0]].name + " costs " + line[1] + " pet tokens -- you have " + (s.petTokens || 0) + ".");
      if (!roomFor(s, line[0])) return no(s, "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + ") -- make room first.");
      if (stackRoom(s, line[0]) < 1) return no(s, "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + " slots).");
      s.petTokens -= line[1];
      give(s, line[0], 1);
      return yes(s, now, "You traded " + line[1] + " pet tokens for " + aOr(ITEMS[line[0]].name) + ".");
    }
    if (action === "petname") {
      var rp = denPet(s, opts.id);
      if (!rp) return no(s, "That pet isn't in the den.");
      var rn = cleanName(opts.name, 24);
      if (!rn) return no(s, "Type a name first.");
      var rw = rp.name; rp.name = rn;
      return yes(s, now, rw ? rw + " is now called " + rn + "." : "You named your " + kindName(rp).toLowerCase() + " " + rn + ".");
    }
    if (action === "pettrip") {
      // the brief: "For pets 2 and above you can send them hunting, foraging, fishing,
      // lumbering, mining etc ... think like melvor idle"
      var gp = denPet(s, opts.id), gs = spotOf(opts.skill, opts.spot);
      if (!gp) return no(s, "Only pets in the den go gathering -- your companion stays with you.");
      if (!gs) return no(s, "There's no place like that.");
      if (gs.essence) return no(s, "Only you can gather essence.");
      if (opts.skill === "digging" && DIGGERS.indexOf(gp.species) < 0) return no(s, "Only diggers -- moles, tarantulas, anteaters -- dig. They hatch from Burrow eggs, found digging deep.");
      if (levelOf((gp.skills || {})[opts.skill] || 0) < gs.level) return no(s, "The " + gs.name + " needs " + SKILLS[opts.skill].name + " level " + gs.level + ".");
      if (gp.job) endTrip(s, gp, now, "stop");
      var natural = BOOSTS[gp.species] === opts.skill, pace = carePace(s);               // a cosy pet's room: quicker (2026-10-12)
      var gev = Math.round(gs.time * 1000 * (natural ? 0.8 : 1) * pace);
      gp.job = { skill: opts.skill, spot: gs.id, since: now, next: now + gev, until: now + JOB_MAX, every: gev, xpBonus: 0, rareMult: 1,
                 seed: typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0), count: 0, xp: 0, items: {} };
      return yes(s, now, who(gp) + " went " + SKILLS[opts.skill].verb + " at the " + gs.name + (natural ? " (a natural -- 20% faster)" : "") +
                 (pace < 1 ? (natural ? "; a cosy den makes it " : " -- a cosy den makes it ") + Math.round((1 - pace) * 100) + "% quicker." : "."));
    }
    if (action === "pethome") {
      var hp = denPet(s, opts.id);
      if (!hp || !hp.job) return no(s, "That pet isn't out gathering.");
      endTrip(s, hp, now, "stop");
      return { ok: true, msg: s.log[0].text, state: s };
    }
    if (action === "home") {
      if (!s.player.job) return no(s, "You're not out gathering.");
      endTrip(s, s.player, now, "stop");
      return { ok: true, msg: s.log[0].text, state: s };
    }
    if (!p) return no(s, "There's no pet yet.");
    if (action === "release") {
      s.pet = null;
      return yes(s, now, (stage(p, now) === "egg" ? "The egg went" : who(p) + " went") + " to live on a farm far away. Choose a new egg when you're ready.");
    }
    if (stage(p, now) === "egg") return no(s, "The egg hasn't hatched yet.");
    if (action === "camp") {                                             // a lasting upgrade, for relics
      var cu = CAMP[opts.upgrade];
      if (!cu) return no(s, "There's no upgrade like that.");
      var clv = campLevel(s, opts.upgrade);
      if (clv >= cu.costs.length) return no(s, "The " + cu.name.toLowerCase() + " is as good as it gets.");
      var cost = cu.costs[clv];
      if (!has(s, "relic", cost)) return no(s, "The " + cu.name.toLowerCase() + " needs " + cost + " ancient relics -- clear the deep areas for them.");
      take(s, "relic", cost);
      s.camp = s.camp || {};
      s.camp[opts.upgrade] = clv + 1;
      return yes(s, now, "The " + cu.name + (cu.costs.length > 1 ? " is now level " + (clv + 1) : " is built") + ": " + cu.says + ".");
    }
    if (action === "treat") {                                            // an injured pet starts to heal
      var ti = ITEMS[opts.item];
      if (!p.injury || p.injury.treatedAt) return no(s, p.injury ? who(p) + " is already treated and healing." : who(p) + " isn't hurt.");
      if (!ti || !ti.treats) return no(s, "That won't treat an injury -- the Apothecary table makes poultices, salves and balms.");
      if (INJURIES[ti.treats].rank < INJURIES[p.injury.sev].rank) return no(s, "A " + ti.name.toLowerCase() + " isn't strong enough for " + INJURIES[p.injury.sev].name + ".");
      if (!has(s, opts.item)) return no(s, "There's no " + ti.name.toLowerCase() + " in the bag.");
      take(s, opts.item);
      treatInjury(s, p, opts.item, now);
      return yes(s, now, "You treated " + whom(p) + " with a " + ti.name.toLowerCase() + ". It'll be fit again in " + Math.round((p.injuredUntil - now) / HOUR * 10) / 10 + " hours.");
    }
    if (action === "recall") {
      if (!p.away) return no(s, who(p) + " isn't out on an expedition.");
      var ra = AREAS[p.away.area].name;
      if (!p.away.stages) { p.away = null; return yes(s, now, "You called " + whom(p) + " back from the " + ra + " early."); }   // an old trip
      endRun(s, now, "recalled");                                        // home with what it found so far
      return { ok: true, msg: "You called " + whom(p) + " back from the " + ra + ".", state: s };
    }
    if (p.away && action !== "name") return no(s, who(p) + " is away on an expedition to the " + AREAS[p.away.area].name + ".");
    if (action === "expedition" && breeding(s, p)) return no(s, who(p) + " is busy breeding.");
    if (action === "expedition") {
      var ar = AREAS[opts.area];
      if (!ar) return no(s, "There's no place like that.");
      if (ar.later) return no(s, "The " + ar.name + " isn't open yet -- it's coming in a later update.");
      var lockWhy = areaLock(s, opts.area);
      if (lockWhy) return no(s, lockWhy);
      if (ar.flying && FLYING.indexOf(p.species) < 0) return no(s, "Only a flying pet can reach the " + ar.name + " -- a chicken, a duck or a gull.");
      var ps = stage(p, now);
      if (ps === "hatchling") return no(s, who(p) + " is too young -- expeditions are from " + (EXPEDITION_AGE / DAY) + " days old.");
      if (levelOf(p.xp || 0) < ar.level) return no(s, "The " + ar.name + " needs a level " + ar.level + " pet.");
      var blocked = injuryBlock(p, now);
      if (blocked) return no(s, blocked);
      if (p.asleep) return no(s, who(p) + " is asleep.");
      if (p.sick) return no(s, who(p) + " is too poorly to go.");
      if (p.s.energy < 30) return no(s, who(p) + " is too tired for an expedition.");
      if (p.s.full < 30) return no(s, who(p) + " is too hungry for an expedition.");
      // the pack (2026-10-06): food for the road, draughts drunk at the start, medicine for an injury
      var pack = {}, want = opts.pack && typeof opts.pack === "object" ? opts.pack : {};
      if (opts.supply && ITEMS[opts.supply]) want[opts.supply] = (want[opts.supply] || 0) + 1;     // older callers
      var kinds = Object.keys(want).filter(function (k) { return (want[k] | 0) > 0; });
      var party = partyOf(s, opts.area, opts.party, now);                // up to two den pets along (2026-10-10)
      if (typeof party === "string") return no(s, party + ".");
      var pfx = partyFx(party), slotsP = packSlots(s) + Math.floor(pfx.hauler);
      if (kinds.length > slotsP) return no(s, who(p) + (party.length ? " and the party" : "") + " can carry " + slotsP + " kinds of thing.");
      for (var pi = 0; pi < kinds.length; pi++) {
        var pk = kinds[pi], pn = Math.min(10, want[pk] | 0), pit = ITEMS[pk];
        if (!pit || !(pit.heal || pit.petbrew || pit.treats)) return no(s, (pit ? pit.name : "That") + " is no use on an expedition -- food, draughts or medicine.");
        if (!has(s, pk, pn)) return no(s, "There aren't " + pn + " " + pit.name.toLowerCase() + " in the bag.");
        pack[pk] = pn;
      }
      Object.keys(pack).forEach(function (k) { take(s, k, pack[k]); });
      var brews = {};
      Object.keys(pack).forEach(function (k) { if (ITEMS[k].petbrew) { brews[k] = 1; pack[k]--; } });    // one of each draught, drunk now
      var me = runFighter(p, brews), R = RUNS[opts.area];
      me.hp += pfx.hp; me.att += pfx.att; me.def += pfx.def; me.maxHit += pfx.maxHit;     // the fighters beside it
      if (campLevel(s, "training")) me.hp = Math.round(me.hp * (1 + 0.05 * campLevel(s, "training")));   // the Training ground
      var length = Math.round(ar.time * (mastery(p, opts.area) >= 5 ? 0.75 : 1));
      p.away = { area: opts.area, since: now, stage: 0, stages: R.stages, every: Math.round(length / R.stages), until: now + Math.round(length / R.stages),
                 me: me, hp: me.hp, maxHp: me.hp, pack: pack, used: {}, brews: brews, got: {}, xp: 0, log: [],
                 retreat: typeof p.retreat === "number" ? p.retreat : 0.3,
                 party: party.map(function (m) { return { id: m.q.id, role: m.role, name: who(m.q) }; }), scout: pfx.scout, hauler: pfx.hauler,
                 seed: typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) | 0 : (now | 0) };
      p.asleep = false;
      party.forEach(function (m) { m.q.away = { party: p.id, area: opts.area, role: m.role, since: now }; m.q.asleep = false; });
      return yes(s, now, who(p) + (party.length ? " and " + party.map(function (m) { return whom(m.q) + " (" + ROLES[m.role].name.toLowerCase() + ")"; }).join(" and ") : "") +
                 " set off for the " + ar.name + " -- " + R.stages + " stages, " + me.hp + " health" +
                 (kinds.length ? ", carrying " + itemsText(want) : "") + ".");
    }
    if (action === "name") {
      var nm = cleanName(opts.name, 24);
      if (!nm) return no(s, "Type a name first.");
      var was = p.name;
      p.name = nm;
      return yes(s, now, was ? was + " is now called " + nm + "." : "You named your " + kindName(p).toLowerCase() + " " + nm + ".");
    }
    var st = p.s;
    switch (action) {
      case "feed": {
        var fid = opts.food || "kibble";
        var f = FOODS[fid] || (ITEMS[fid] && ITEMS[fid].food ? { name: ITEMS[fid].name, full: ITEMS[fid].food.full,
                                                                  happy: ITEMS[fid].food.happy, clean: ITEMS[fid].food.clean } : null);
        if (!f) return no(s, "That isn't food.");
        if (p.asleep) return no(s, who(p) + " is asleep.");
        if (!FOODS[fid] && !has(s, fid)) return no(s, "There's no " + f.name.toLowerCase() + " in the bag.");
        if (ITEMS[fid] && ITEMS[fid].ageUp) {                            // a coming-of-age dish: always room for it
          var fl = ageUpLock(p, now);
          if (fl) return no(s, fl);
          take(s, fid);
          st.full = clamp(st.full + f.full); st.happy = clamp(st.happy + f.happy); st.clean = clamp(st.clean + f.clean);
          ageUp(p, now);
          bump(p, "fed");
          return yes(s, now, who(p) + " ate the " + f.name.toLowerCase() + " and grew up overnight -- old enough for expeditions now!");
        }
        if (st.full >= 95) { st.happy = clamp(st.happy - 5); return yes(s, now, who(p) + " is too full for " + f.name.toLowerCase() + "."); }
        if (!FOODS[fid]) take(s, fid);
        st.full = clamp(st.full + f.full);
        st.happy = clamp(st.happy + f.happy);
        st.clean = clamp(st.clean + f.clean);
        bump(p, "fed");
        return yes(s, now, who(p) + " ate some " + f.name.toLowerCase() + ".");
      }
      case "play":
        if (p.asleep) return no(s, who(p) + " is asleep.");
        if (p.sick) return no(s, who(p) + " is too poorly to play.");
        if (st.energy < 15) return no(s, who(p) + " is too tired to play.");
        st.happy = clamp(st.happy + 18); st.energy = clamp(st.energy - 12); st.full = clamp(st.full - 4);
        bump(p, "played");
        return yes(s, now, "You played with " + whom(p) + ".");
      case "pet":
        if (p.asleep) return no(s, "Shh… " + whom(p) + " is asleep.");
        st.happy = clamp(st.happy + 4);
        bump(p, "petted");
        return yes(s, now, who(p) + " loved the fuss.");
      case "rest":
        if (p.asleep) return no(s, who(p) + " is already asleep.");
        p.asleep = true;
        bump(p, "rested");
        return yes(s, now, who(p) + " curled up for a nap.");
      case "wake":
        if (!p.asleep) return no(s, who(p) + " is already awake.");
        p.asleep = false;
        if (st.energy < 60) st.happy = clamp(st.happy - 3);
        return yes(s, now, who(p) + " woke up" + (st.energy < 60 ? ", a bit grumpy." : "."));
      case "clean":
        if (st.clean >= 98) return no(s, who(p) + " is already clean.");
        st.clean = 100; st.happy = clamp(st.happy + 2);
        bump(p, "cleaned");
        return yes(s, now, "You cleaned up after " + whom(p) + ".");
      case "medicine":
        if (!p.sick && st.health >= 60) return no(s, who(p) + " doesn't need medicine.");
        if (now - p.lastMed < MED_COOLDOWN) return no(s, "Too soon for more medicine -- try again in " + Math.ceil((p.lastMed + MED_COOLDOWN - now) / MIN) + " min.");
        st.health = clamp(st.health + 30); p.sick = false; p.lastMed = now;
        bump(p, "medicine");
        return yes(s, now, who(p) + " took the medicine and feels better.");
    }
    if (action === "use") {
      var po = ITEMS[opts.item];
      if (!po || !(po.potion || po.ageUp) || po.food) return no(s, "That isn't something to give " + whom(p) + ".");
      if (!has(s, opts.item)) return no(s, "There's no " + po.name.toLowerCase() + " in the bag.");
      if (po.ageUp) {
        var ul = ageUpLock(p, now);
        if (ul) return no(s, ul);
        take(s, opts.item);
        if (po.potion && po.potion.happy) st.happy = clamp(st.happy + po.potion.happy);
        ageUp(p, now);
        bump(p, po.potion ? "potions" : "charms");
        return yes(s, now, (po.potion ? who(p) + " drank the " : "You held the " + po.name + " over " + whom(p) + ", and the seasons turned -- ")
          + (po.potion ? po.name.toLowerCase() + " and grew up before your eyes -- " : "") + "old enough for expeditions now!");
      }
      take(s, opts.item);
      if (po.potion.energy) st.energy = clamp(st.energy + po.potion.energy);
      if (po.potion.happy) st.happy = clamp(st.happy + po.potion.happy);
      if (po.potion.health) st.health = clamp(st.health + po.potion.health);
      if (po.potion.cure) { p.sick = false; p.injuredUntil = 0; }
      bump(p, "potions");
      return yes(s, now, who(p) + " had the " + po.name.toLowerCase() + ".");
    }
    return no(s, "NeuroPets doesn't know how to " + action + ".");
  }

