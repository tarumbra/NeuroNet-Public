  /** Every expedition area: open or not, the chance now, area level, what it gives. */
  function expeditionsView(state, now) {
    var p = state && state.pet, st = p ? stage(p, now) : "none";
    return AREA_ORDER.map(function (k) {
      var a = AREAS[k];
      if (a.later) return { id: k, name: a.name, level: a.level, later: true, note: a.note || "" };
      var m = p ? mastery(p, k) : 1, done = p && p.areas ? p.areas[k] || 0 : 0;
      return { id: k, name: a.name, level: a.level, later: false,
               open: !!p && st !== "egg" && levelOf(p.xp || 0) >= a.level && !areaLock(state || {}, k) && (!a.flying || FLYING.indexOf(p.species) >= 0),
               chance: p && st !== "egg" ? chanceFor(state, p, k, "", now) : 0, mastery: m, successes: done,
               toNextMastery: m >= 5 ? 0 : MASTERY[m] - done,
               minutes: Math.round(a.time * (m >= 5 ? 0.75 : 1) / MIN), xp: a.xp,
               loot: a.loot.map(function (l) { return l[0]; }), crate: a.crate[0], egg: a.egg[0],
               stages: RUNS[k].stages, foes: RUNS[k].foes.map(function (f) { return f[0]; }), guardian: RUNS[k].guardian[0],
               guardianPower: { hp: RUNS[k].guardian[1], att: RUNS[k].guardian[2], def: RUNS[k].guardian[3] },
               fall: RUNS[k].fall, fallName: INJURIES[RUNS[k].fall].name, deadly: RUNS[k].deadly || 0, lock: areaLock(state || {}, k),
               flying: !!a.flying, canFly: !a.flying || (p && FLYING.indexOf(p.species) >= 0) };
    });
  }

  /** The village: each workshop, what it makes, and whether you can. */
  /** The village: your workshops (each a skill of yours) and whoever's in town today. */
  function villageView(state, now) {
    now = now || Date.now();
    var b = (state && state.bag) || {}, pl = (state && state.player) || newPlayer(), coins = (state && state.coins) || 0;
    var inf = state && state.dev && state.dev.infinite, bst = (state && benchStore(state)) || {};
    return WORKSHOP_ORDER.filter(function (k) { return !WORKSHOPS[k].npc || npcHere(state || {}, k, now); }).map(function (k) {
      var ws = WORKSHOPS[k], xpv = ws.skill ? pl.skills[ws.skill] || 0 : 0, lv = ws.skill ? levelOf(xpv) : 0;
      var out = { id: k, name: ws.name, who: ws.who, npc: !!ws.npc, region: ws.region || "", icon: ws.icon || "", look: ws.look || null, says: ws.says, skill: ws.skill || "",
                  level: lv, xp: Math.floor(xpv), toNext: !ws.skill || lv >= MAX_LEVEL ? 0 : Math.ceil(XP[lv + 1] - xpv),
                  progress: !ws.skill ? 0 : lv >= MAX_LEVEL ? 1 : (xpv - XP[lv]) / (XP[lv + 1] - XP[lv]), coins: coins,
        recipes: ws.recipes.map(function (r, ri) {
          var needs = Object.keys(r.needs).map(function (n) { var st = ws.npc ? 0 : benchStored(state || {}, bst, n);
              return { id: n, name: ITEMS[n].name, need: r.needs[n], have: inf ? 999 : (b[n] || 0) + st, stored: inf ? 0 : st }; })
            .concat((r.uses || []).map(function (n) { return { id: n, name: ITEMS[n].name + " (kept)", need: 1, have: inf ? 999 : b[n] || 0, kept: true }; }));
          var need = r.level || 1, rl = roomLock(state, k, need) || bossLock(state, r), open = (!ws.skill || lv >= need) && !rl, fee = r.fee || 0;
          return { i: ri, make: r.make, name: ITEMS[r.make].name, gem: ITEMS[r.make].gem, does: describe(r.make), needs: needs, n: r.n || 1,
                   level: need, xp: r.xp || 0, fee: fee, open: open, roomLock: rl,
                   can: open && needs.every(function (n) { return n.have >= n.need; }) && (inf || coins >= fee),
                   // how many times over you could make it now ("Cook all", 2026-10-14): what you have of each
                   // ingredient (tools are kept), and the coins for the fee
                   times: !open ? 0 : inf ? 10 : Math.min.apply(null, needs.filter(function (n) { return !n.kept; })
                     .map(function (n) { return Math.floor(n.have / n.need); }).concat(fee ? [Math.floor(coins / fee)] : [], [1000])),
                   have: b[r.make] || 0 };
        }) };
      if (ws.trade) {
        var stock = stockFor(k, now);
        out.trade = ws.trade;
        out.bag = { used: bagUsed(state), cap: bagCap(state) };
        stock = stock.filter(function (x) { return !ITEMS[x[0]].bagSize || ITEMS[x[0]].bagSize > out.bag.cap; });   // only bigger bags
        out.stock = stock.map(function (x) { return { id: x[0], name: ITEMS[x[0]].name, does: describe(x[0]), price: x[1], have: b[x[0]] || 0, can: inf || coins >= x[1] }; })
          .sort(function (a, c) { return a.name.localeCompare(c.name); });
        out.sell = Object.keys(b).filter(function (id) { return b[id] > 0 && ITEMS[id] && !ITEMS[id].crate; }).map(function (id) {
          var usedNow = (pl.tools[ITEMS[id].tool && ITEMS[id].tool.skill] === id) || Object.keys(pl.gear || {}).some(function (g) { return pl.gear[g] === id; });
          var spare = b[id] - (usedNow ? 1 : 0), each = eachFor(id, ws.trade);
          if (ITEMS[id].bound) return { id: id, name: ITEMS[id].name, count: b[id], spare: b[id], each: 0, all: 0, one: 1, bound: true };   // shown, but a keepsake (PT20 b4)
          return { id: id, name: ITEMS[id].name, count: b[id], spare: spare, each: each, all: sellFor(id, spare, ws.trade), one: Math.max(1, Math.ceil(1 / each)) };
        }).filter(function (x) { return x.spare > 0; }).sort(function (a, c) { return a.name.localeCompare(c.name); });   // A to Z (Cam, PT24: "make the shop page be alphabetical")
      }
      if (ROOM_OF[k]) { out.room = ROOM_OF[k]; out.roomName = HOUSE_TIERS[roomTier(state, ROOM_OF[k])] + " " + ROOMS[ROOM_OF[k]].name.toLowerCase(); }
      if (ws.orders) { var ov = ordersView(state, now); out.orders = ov.list; out.ordersLeft = ov.left; }
      if (ws.grind) out.grind = grindView(state);                         // the grindstone (Battle Re-work, 2026-10-15)
      if (ws.enchants) out.altar = enchantBookView(state).list.filter(function (e) { return e.known; })
        .map(function (e) { e.targets = enchantTargets(state, e.id); e.open = levelOf(pl.skills.enchanting || 0) >= e.level; e.coinsOk = inf || coins >= e.coins;
                            e.costOk = e.cost.every(function (c) { return c.have >= c.need; }); return e; });
      if (ws.identify) {                      // the Herb table: identify unidentified herbs, tier by tier
        var hv = herbariumView(state);
        out.identify = hv.tiers; out.found = hv.found; out.total = hv.total; out.master = hv.master; out.unid = hv.unid;
      }
      if (ws.reskin) {
        out.reskin = true; out.cost = RESKIN_COST;
        out.presets = Object.keys(RESKINS).map(function (r) { return { id: r, name: RESKINS[r].name, cost: RESKINS[r].cost, pal: RESKINS[r].pal, can: inf || coins >= RESKINS[r].cost }; });
      }
      return out;
    });
  }

  function skillsOf(q) {
    var out = {};
    GATHERING.forEach(function (k) {
      var xp = (q.skills || {})[k] || 0, lv = levelOf(xp), lo = XP[lv], hi = lv >= MAX_LEVEL ? lo : XP[lv + 1];
      out[k] = { name: SKILLS[k].name, level: lv, xp: Math.floor(xp), progress: lv >= MAX_LEVEL ? 1 : (xp - lo) / (hi - lo), natural: BOOSTS[q.species] === k,
                 spots: SKILLS[k].spots.filter(function (sp) { return !sp.essence; }).map(function (sp) { return { id: sp.id, name: sp.name, level: sp.level, open: lv >= sp.level }; }) };
    });
    return out;
  }
  function jobView(j, now) {
    if (!j) return null;
    var spot = placeOf(j);
    return { skill: j.skill, skillName: j.hunt ? "Hunting" : SKILLS[j.skill].name, verb: j.hunt ? "hunting" : SKILLS[j.skill].verb,
             spot: j.spot, spotName: spot ? spot.name : j.spot, area: spot && REGIONS[spot.area] ? spot.area : "", full: j.full && ITEMS[j.full] ? ITEMS[j.full].name : "", hunt: j.hunt || "", kills: j.kills || null, petHp: j.petHp, fight: j.fight || null,
             count: j.count, xp: Math.round(j.xp), items: j.items, ate: j.ate || null, nextIn: Math.max(0, Math.ceil((j.next - now) / 1000)),
             every: Math.round((j.every || (spot ? spot.time * 1000 : 0)) / 1000), endsIn: Math.max(0, Math.ceil((j.until - now) / 1000)) };
  }
  /** Your pets: the companion first, then the den. From an advanced state. */
  // duplicates (2026-10-10 audit, H-3 / PET-4: "what are ways we can deal with duplicate pets") -- merge one into another of
  // its kind for a star (up to 5: +10% to its companion boost and a kind more carried, each), or release it for pet tokens,
  // spent at the pet token shop on the Pets page. Only a pet you have more than one of, and never your companion or one
  // that's away, out on a trip, or breeding.
  var STAR_MAX = 5, STAR_BOOST = 0.1, TOKENS_FOR = CONTENT("TOKENS_FOR");
  var TOKEN_SHOP = [["treat", 2], ["salve", 4], ["poultice", 4], ["petvigour", 8], ["petfury", 8], ["petguard", 8], ["petswift", 8],
                    ["leatherpetcap", 6], ["leatherpetcoat", 6], ["leatherpetboots", 6], ["bronzepetcap", 12], ["bronzepetcoat", 12], ["bronzepetboots", 12],
                    ["ironpetcap", 25], ["ironpetcoat", 25], ["ironpetboots", 25], ["tailribbon", 10], ["bobblehat", 10], ["farmyardegg", 40], ["meadowegg", 60]]
    .filter(function (x) { return ITEMS[x[0]]; });
  function sameKind(s, q) { return allPets(s).filter(function (x) { return x && x !== q && x.species === q.species && !(x.hatchAt > (x.at || 0) && !x.xp); }).length; }
  function dupeLock(s, q) {
    if (!q) return "There's no pet like that.";
    if (q === s.pet) return "That's your companion -- make another pet your companion first.";
    if (q.away) return who(q) + " is away on an expedition.";
    if (q.job) return who(q) + " is out " + (q.job.hunt ? "hunting" : "gathering") + " -- bring them home first.";
    if (s.breeding && (s.breeding.a === q.id || s.breeding.b === q.id)) return who(q) + " is breeding.";
    if (!sameKind(s, q)) return "You only have one " + (SPECIES[q.species] || {}).name.toLowerCase() + " -- duplicates only.";
    return "";
  }
  function petsView(state, now) {
    var list = [];
    var add = function (q, companion) {
      if (!q || stage(q, now) === "egg") return;
      list.push({ id: q.id, name: q.name || kindName(q), named: !!q.name, kind: kindName(q), rarity: rarityOf(q), species: q.species, colour: q.colour, skin: q.skin || null,
                  companion: companion, level: levelOf(q.xp || 0), skills: skillsOf(q), job: jobView(q.job, now), lastTrip: q.lastTrip || null,
                  away: !!q.away, ageDays: Math.floor(Math.max(0, now - q.hatchAt) / DAY), gene: geneView(q), stars: q.stars || 0, work: q.work || "", workName: q.work && JOBS[q.work] ? JOBS[q.work].name : "",
                  party: q.away && q.away.party ? (ROLES[q.away.role] || {}).name || "" : "",
                  dupe: !companion && !!state && !dupeLock(state, q), tokens: TOKENS_FOR[rarityOf(q)] || 5,
                  choose: !companion && !!q.choose, beastType: BEAST_TYPES[beastType(q)].name });   // the hatch choice (Part 11a)
    };
    add(state && state.pet, true);
    ((state && state.den) || []).forEach(function (q) { add(q, false); });
    return list;
  }
  function hatcheryView(state, now) {
    var up = upgradeLevel(state, "hatchery"), uc = UPGRADES.hatchery.costs[up], un = UPGRADES.hatchery.needs, ub = (state && state.bag) || {};
    return { slots: hatchSlots(state), upgrade: uc ? { cost: uc, needs: itemsText(un), can: ((state && state.coins) || 0) >= uc && Object.keys(un).every(function (k) { return (ub[k] || 0) >= un[k]; }) } : null, eggs: ((state && state.hatchery) || []).map(function (h) {
      return { egg: h.egg, eggName: EGGS[h.egg].name, hatchIn: Math.max(0, Math.ceil((h.hatchAt - now) / 1000)), total: Math.round((h.hatchAt - h.started) / 1000) };
    }) };
  }
  /** Breeding: who can, what a pair might lay, the special pairings' hints. */
  function breedingView(state, now, aId, bId) {
    var s = state, pets = allPets(s).filter(function (q) { return stage(q, now) !== "egg"; });
    var out = { pets: pets.map(function (q) { return { id: q.id, name: q.name || kindName(q), kind: kindName(q), species: q.species, colour: q.colour, skin: q.skin || null,
                                                       level: plv(q), why: cantBreed(s, q, now), gene: geneView(q) }; }),
                busy: null, pair: null, hatcheryFree: hatchSlots(s) - s.hatchery.length - (s.breeding ? 1 : 0),
                book: BREEDS.map(function (r) { var found = !!(s.dex || {})[r.kind];
                  return { id: r.id, hint: r.hint, found: found, name: found ? PETS[r.kind].name : "???", kind: found ? r.kind : "" }; }) };
    if (s.breeding) {
      var a = petById(s, s.breeding.a), b = petById(s, s.breeding.b);
      out.busy = { a: a ? a.name || kindName(a) : "?", b: b ? b.name || kindName(b) : "?", layIn: Math.max(0, Math.ceil((s.breeding.until - now) / 1000)),
                   special: !!s.breeding.special };
    }
    var pa = aId && petById(s, aId), pb = bId && petById(s, bId);
    if (pa && pb && pa !== pb) out.pair = { special: !!specialFor(pa, pb, now), odds: pairOdds(pa, pb), genes: pairGenes(pa, pb) };
    out.natures = natureBook(s);
    return out;
  }

  /** The Petapedia: every pet there is; ones not hatched yet stay a mystery. */
  function dexView(state) {
    var dex = (state && state.dex) || {};
    return Object.keys(PETS).map(function (k) {
      var sp = k.split("/"), found = !!dex[k];
      return { kind: k, species: sp[0], colour: sp[1], found: found, name: found ? PETS[k].name : "???", rarity: found ? PETS[k].rarity : "",
               when: PETS[k].night ? "night" : PETS[k].day ? "day" : "",
               first: found ? dex[k].first : 0,
               eggs: found ? EGG_ORDER.filter(function (e) { return EGGS[e].pool.some(function (x) { return x[0] === k; }); }).map(function (e) { return EGGS[e].name; }) : [] };
    });
  }

  /** The hunting grounds, and what lives there. */
  function huntsView(state) {
    var cl = combatLevel((state && state.player) || newPlayer()), hs = (state && state.hunt) || {};
    return HUNT_ORDER.map(function (k) {
      var h = HUNTS[k], hl = hs[k] || { kills: 0, wins: 0, losses: 0 }, b = MONSTERS[h.boss];
      return { id: k, name: h.name, level: h.level, open: cl >= h.level, time: h.time,
               kills: hl.kills, need: bossNeed(h, hl), unlockKills: h.kills, rematch: rematchKills(h), unlocked: bossUnlocked(hl),
               wins: hl.wins, losses: hl.losses, bossReady: cl >= h.level && hl.kills >= bossNeed(h, hl),
               boss: { id: h.boss, name: b.name, hp: b.hp, att: b.att, def: b.def, atk: b.atk, eva: b.eva || 0, weak: b.weak, resist: b.resist,
                       drops: b.drops.map(function (d) { return d[0]; }),
                       unlocks: (BOSS_UNLOCKS[h.boss] || []).map(function (u) { return { wins: u[0], pet: PETS[u[1]].name, egg: EGGS[u[2]].name, done: hl.wins >= u[0] }; }) },
               monsters: h.monsters.map(function (m) { var x = MONSTERS[m[0]], when = m[2] || "";
                 return { id: m[0], name: x.name, hp: x.hp, att: x.att, def: x.def, xp: x.xp, atk: x.atk, weak: x.weak, resist: x.resist, matWeak: x.matWeak, eva: x.eva || 0,
                          drops: x.drops.map(function (d) { return d[0]; }), when: when }; }) };
    });
  }

  /** Each slot: what's worn, and what in the bag could go there. */
  function gearView(gear, slots, state, whoFor) {
    var b = (state && state.bag) || {}, inf = state && state.dev && state.dev.infinite;
    return slots.map(function (slot) {
      var id = (gear || {})[slot];
      var fits = Object.keys(ITEMS).filter(function (k) {
        var g = ITEMS[k].gear; return g && g.who === whoFor && g.slot === slot && (inf || b[k] > 0);
      }).map(function (k) { return { id: k, name: ITEMS[k].name, does: describe(k), gem: ITEMS[k].gem, why: state ? cantWear(state, k) : "" }; });
      return { slot: slot, name: SLOT_NAMES[slot], item: id && ITEMS[id] ? { id: id, name: ITEMS[id].name, does: describe(id), gem: ITEMS[id].gem } : null, fits: fits };
    });
  }

  /** What's in the bag, rarest first. */
  function bagList(state) {
    var b0 = (state && state.bag) || {}, inf = state && state.dev && state.dev.infinite, worn = state && state.player ? wornSet(state) : {};
    // V16 (Cam, I3: "If equipment is equiped it should not stay in the bag because it is on the body"): what you wear or carry
    // as a tool is on you -- the bag shows only the spares (the save keeps one count, so every rule that asks "have it?" holds)
    var b = {}; Object.keys(b0).forEach(function (k) { b[k] = b0[k] - (worn[k] ? 1 : 0); });
    return Object.keys(inf ? ITEMS : b).filter(function (k) { return ITEMS[k] && (inf || b[k] > 0); }).map(function (k) {
      var it = ITEMS[k];
      return { id: k, name: it.name, gem: it.gem, count: inf ? 999 : b[k], food: it.food || null, does: describe(k), stacks: inf ? 1 : Math.max(1, Math.ceil(b[k] / stackCap(state))), stackCap: stackCap(state),
               kind: it.ageUp && !it.food ? "potion" : it.tool ? "tool" : it.gear ? "gear" : it.potion ? "potion" : it.brew ? "brew" : it.heal && !it.food ? "heal" : it.furniture ? "furniture" : it.food ? "food"
                   : it.crate ? "crate" : it.egg ? "egg" : it.seed ? "seed" : it.frag ? "frag" : it.learn ? "scroll" : "material" };
    }).sort(function (a, b2) { return b2.gem - a.gem || a.name.localeCompare(b2.name); });
  }

  function mood(pet, now) {
    if (!pet) return "none";
    if (stage(pet, now) === "egg") return "egg";
    var s = pet.s;
    if (pet.away) return "away";
    if (pet.sick) return "sick";
    if (pet.asleep) return "asleep";
    if (s.full < 25) return "hungry";
    if (s.energy < 20) return "sleepy";
    if (s.clean < 30) return "dirty";
    if (s.happy < 35) return "sad";
    if (s.happy >= 75 && s.full >= 50) return "happy";
    return "ok";
  }

  var NEEDS = CONTENT("NEEDS");

  /** Everything a screen needs, from a state already advanced to `now`. */
  function view(state, now) {
    var p = state && state.pet;
    if (!p) return { has: false, stage: "none", mood: "none" };
    var st = stage(p, now), m = mood(p, now), age = Math.max(0, now - p.hatchAt);
    if (m !== "away" && m !== "egg" && p.injuredUntil && p.injuredUntil > now && (m === "ok" || m === "happy")) m = "injured";
    var egg = EGGS[p.egg] ? p.egg : "starter";
    if (st === "egg") {
      // what's inside stays a surprise: nothing about the pet leaves here
      return { has: true, stage: "egg", mood: "egg", egg: egg, eggName: EGGS[egg].name,
               name: EGGS[egg].name, need: "", hatchIn: Math.ceil((p.hatchAt - now) / 1000),
               hatchTotal: Math.round((p.hatchAt - p.born) / 1000), odds: odds(egg, state), poops: 0, stats: null, room: state.room || {} };
    }
    var stats = {};
    STATS.forEach(function (k) { stats[k] = Math.round(p.s[k]); });
    var c = p.s.clean;
    return {
      has: true, name: p.name || kindName(p), named: !!p.name, kind: kindName(p), rarity: rarityOf(p),
      egg: egg, species: p.species, colour: p.colour, skin: p.skin || null, room: state.room || {},
      stage: st, mood: m, need: NEEDS[m] || "", stats: stats,
      asleep: !!p.asleep, sick: !!p.sick,
      ageDays: Math.floor(age / DAY), ageHours: Math.floor(age / HOUR),
      hatchIn: 0,
      poops: c < 20 ? 3 : c < 45 ? 2 : c < 70 ? 1 : 0,
      expeditionReady: st === "young" || st === "adult",
      daysToExpeditions: Math.max(0, Math.ceil((EXPEDITION_AGE - age) / DAY)),
      canMedicine: !!p.sick || p.s.health < 60,
      level: levelOf(p.xp || 0), xp: Math.floor(p.xp || 0),
      gear: gearView(p.gear, petSlots(p), state, "pet"), worn: gearSum(p.gear),
      levelProgress: (function () { var l = levelOf(p.xp || 0); return l >= MAX_LEVEL ? 1 : ((p.xp || 0) - XP[l]) / (XP[l + 1] - XP[l]); })(),
      away: p.away ? { area: p.away.area, areaName: AREAS[p.away.area].name, backIn: Math.max(0, Math.ceil((p.away.until - now) / 1000)),
                       stage: p.away.stage || 0, stages: p.away.stages || 1, hp: Math.max(0, Math.round(p.away.hp || 0)), maxHp: p.away.maxHp || 0,
                       party: (p.away.party || []).map(function (m) { return { name: m.name, role: (ROLES[m.role] || {}).name || m.role }; }),
                       // "back in": the stages left, at the run's pace (it may end sooner)
                       endIn: Math.max(0, Math.ceil((p.away.until + ((p.away.stages || 1) - (p.away.stage || 0) - 1) * (p.away.every || 0) - now) / 1000)),
                       log: (p.away.log || []).slice(-8), pack: p.away.pack || {}, chance: p.away.chance || 0,
                       total: Math.round((p.away.until - p.away.since) / 1000) } : null,
      injuredFor: p.injuredUntil && p.injuredUntil > now ? Math.ceil((p.injuredUntil - now) / MIN) : 0,
      injury: p.injury && !(p.injury.treatedAt && !(p.injuredUntil > now)) ? { sev: p.injury.sev, name: INJURIES[p.injury.sev].name, treated: !!p.injury.treatedAt,
                healIn: p.injury.treatedAt ? Math.max(0, Math.ceil((p.injuredUntil - now) / MIN)) : 0 } : null,
      fight: runFighter(p, {}),
      retreat: typeof p.retreat === "number" ? p.retreat : 0.3,
      lastExp: p.lastExp || null,
      medReadyIn: Math.max(0, Math.ceil((p.lastMed + MED_COOLDOWN - now) / MIN))
    };
  }

  function bump(p, k) { p.counts = p.counts || {}; p.counts[k] = (p.counts[k] || 0) + 1; }
  function no(state, msg) { return { ok: false, error: msg, state: state }; }
  function yes(state, now, msg) { note(state, now, msg); flushLost(state, now); return { ok: true, msg: msg, state: state }; }

