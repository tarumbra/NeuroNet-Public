  // ==== more quests (2026-10-09, Cam: "create a lot more quests for NPCs i don't like that there is only 2 availible") --
  //      every person gets their own chain of at least seven, built from what their place has: its materials (plenty,
  //      at today's pace), something made from them, its hunting ground and boss, a level to reach. Their ids never
  //      change, so a save keeps what it's done.
  (function () {
    var SOURCES = { sandport: ["desert", "nile", "oasis"], frosthaven: ["frostpeak", "icecavern", "summit"], shipyard: ["coast", "opensea"] };
    var LINES = {
      gather: ["\"I'm running low on %s. Bring me %n and I'll see you right.\"", "\"%N of %s, if you'd be so kind -- there's never enough.\"",
               "\"Everyone wants %s and nobody brings it. Be the one who does: %n.\""],
      fine: ["\"The good stuff now: %n of %s. Not everyone can get it.\"", "\"I've a buyer for %s -- %n, and quickly.\""],
      made: ["\"Raw's no use to me -- I need %s, made properly. %N of them.\"", "\"Could you make me %n of %s? My hands aren't what they were.\""],
      hunt: ["\"The %g is crawling with them. Clear %n out for me.\"", "\"Thin them out in the %g -- %n should do it.\""],
      boss: ["\"%b. You know the one. Put it down, once, and I'll owe you.\"", "\"They say no one beats %b. Prove them wrong.\""],
      level: ["\"Come back when your %s is %n. Then we'll talk about the real work.\"", "\"I only trust a %s of %n or better with this.\""] };
    var CRATE = function (i) { return i >= 4 ? "ironcrate" : "woodcrate"; };
    function line(kind, seed, vars) {
      var L = LINES[kind], t = L[Math.abs(seed) % L.length];
      return t.replace("%N", String(vars.n).charAt(0).toUpperCase() + String(vars.n).slice(1)).replace("%n", vars.n).replace("%s", vars.s || "").replace("%g", vars.g || "").replace("%b", vars.b || "");
    }
    function amount(id) { var g = (ITEMS[id] || {}).gem || 0; return g <= 1 ? 300 : g === 2 ? 200 : g === 3 ? 120 : g === 4 ? 60 : g <= 6 ? 30 : 12; }
    function madeFrom(id) {
      var MAKERS = ["furnace", "sawbench", "spinning", "tanner", "crafting", "fletching", "gemology"];          // honest makings, not enchants or brews
      for (var i = 0; i < MAKERS.length; i++) { var ws = WORKSHOPS[MAKERS[i]]; if (!ws) continue;
        for (var j = 0; j < ws.recipes.length; j++) { var r = ws.recipes[j]; if (r.needs && r.needs[id] && !ITEMS[r.make].gear && !ITEMS[r.make].tool && !ITEMS[r.make].key) return { make: r.make, skill: ws.skill, xp: r.xp || 10 }; } }
      return null;
    }
    Object.keys(PEOPLE).forEach(function (pid) {
      var P = PEOPLE[pid], regs = SOURCES[pid] || [pid], spots = [], seed = 0;
      for (var c = 0; c < pid.length; c++) seed = (seed * 31 + pid.charCodeAt(c)) | 0;
      GATHERING.filter(function (k) { return k !== "runecrafting"; }).forEach(function (k) { SKILLS[k].spots.forEach(function (sp) { if (regs.indexOf(sp.area) >= 0 && !sp.essence && !sp.secret && sp.loot && ITEMS[sp.loot[0][0]] && !HERB_TIER_OF[sp.loot[0][0]]) spots.push({ skill: k, sp: sp, id: sp.loot[0][0] }); }); });
      spots.sort(function (a, b) { return a.sp.level - b.sp.level; });
      var taken = {}; P.quests.forEach(function (q) { q.needs.forEach(function (n) { Object.keys(n.bring || {}).forEach(function (k) { taken[k] = 1; }); }); });
      var add = [], push = function (q) { if (!P.quests.some(function (x) { return x.id === q.id; })) add.push(q); };
      var uniq = spots.filter(function (x, i) { return !taken[x.id] && spots.findIndex(function (y) { return y.id === x.id; }) === i; });
      // 1-3: materials, low to high
      [uniq[0], uniq[Math.floor(uniq.length / 2)], uniq[uniq.length - 1]].filter(function (x, i, a) { return x && a.indexOf(x) === i; }).forEach(function (x, i) {
        var n = amount(x.id), bring = {}; bring[x.id] = n;
        push({ id: "x_" + pid + "_g" + i, name: i === 2 ? "The finest " + ITEMS[x.id].name.toLowerCase() : "A load of " + ITEMS[x.id].name.toLowerCase(),
               text: line(i === 2 ? "fine" : "gather", seed + i, { n: n, s: ITEMS[x.id].name.toLowerCase() }), needs: [{ bring: bring }],
               reward: { coins: Math.ceil(priceOf(x.id) * n * 2.5) + 150 * (i + 1), xp: (function () { var o = {}; o[x.skill] = Math.round(x.sp.xp * n * 0.6); return o; })(), items: (function () { var o = {}; o[CRATE(i + 2)] = 1; return o; })() } });
      });
      // 4: something made from them
      var mk = null; for (var mi = spots.length - 1; mi >= 0 && !mk; mi--) { mk = madeFrom(spots[mi].id); if (mk && taken[mk.make]) mk = null; }   // from the best material down
      if (mk) { var mn = Math.max(5, Math.round(amount(mk.make) / 6)), mb = {}; mb[mk.make] = mn;
        push({ id: "x_" + pid + "_m", name: "Made by hand", text: line("made", seed + 3, { n: mn, s: ITEMS[mk.make].name.toLowerCase() }), needs: [{ bring: mb }],
               reward: { coins: Math.ceil(priceOf(mk.make) * mn * 2.5) + 400, xp: (function () { var o = {}; o[mk.skill] = Math.round(mk.xp * mn * 0.6); return o; })(), items: { woodcrate: 2 } } }); }
      // 5-6: the hunting ground and its boss
      var hg = HUNTS[pid] && !HUNTS[pid].tower && !SOURCES[pid] ? pid : "";            // their own ground only (not the towns', not the yard's)
      var has0 = function (key) { return P.quests.some(function (q) { return q.needs.some(function (n) { return n[key] && (n[key] === hg || n[key][0] === hg); }); }); };
      if (hg && !has0("kills")) {
        var kn = HUNTS[hg].level >= 40 ? 150 : 100;
        push({ id: "x_" + pid + "_h", name: "Thinning them out", text: line("hunt", seed + 4, { n: kn, g: HUNTS[hg].name + " hunting ground" }), needs: [{ kills: [hg, kn] }],
               reward: { coins: 300 + 25 * HUNTS[hg].level, xp: { attack: 40 * HUNTS[hg].level, hitpoints: 15 * HUNTS[hg].level }, items: { woodcrate: 1 } } });
        if (HUNTS[hg].boss && !has0("boss")) push({ id: "x_" + pid + "_b", name: "The big one", text: line("boss", seed + 5, { b: MONSTERS[HUNTS[hg].boss].name }), needs: [{ boss: hg }],
               reward: { coins: 800 + 60 * HUNTS[hg].level, items: { ironcrate: 1 } } });
      }
      // 7: a level to reach, in the place's main skill
      var top = spots[spots.length - 1];
      if (top) { var lvq = Math.min(MAX_LEVEL, Math.max(10, top.sp.level + 3));
        push({ id: "x_" + pid + "_l", name: "A master's hand", text: line("level", seed + 6, { n: lvq, s: SKILLS[top.skill].name }), needs: [{ level: [top.skill, lvq] }],
               reward: { coins: 200 + 40 * lvq, items: { ironcrate: 1, ancientchest: lvq >= 40 ? 1 : 0 } } }); }
      // the place's secrets, all of them
      var secs = (SECRETS[pid] || []).length;
      if (secs >= 2 && !P.quests.some(function (q) { return q.needs.some(function (n) { return n.secrets; }); }))
        push({ id: "x_" + pid + "_sec", name: "Every secret", text: "\"There's more here than meets the eye. Find all of it -- every last secret -- and come back.\"",
               needs: [{ secrets: [pid, secs] }], reward: { coins: 600 + 200 * secs, items: { ironcrate: 1 } } });
      // a small place still gets a full chain: the rest of its materials, more of the first
      spots.filter(function (x, i) { return spots.findIndex(function (y) { return y.id === x.id; }) === i; }).forEach(function (x, i) { if (P.quests.length + add.length >= 7) return; var n = amount(x.id) * 2, b = {}; b[x.id] = n;
        push({ id: "x_" + pid + "_more" + i, name: "More " + ITEMS[x.id].name.toLowerCase(), text: line("gather", seed + 20 + i, { n: n, s: ITEMS[x.id].name.toLowerCase() }),
               needs: [{ bring: b }], reward: { coins: Math.ceil(priceOf(x.id) * n * 2.5) + 500, xp: (function () { var o = {}; o[x.skill] = Math.round(x.sp.xp * n * 0.6); return o; })(), items: { ironcrate: 1 } } }); });
      // the shipyard's own: what ships are made of
      if (pid === "shipyard") [["plank", 150], ["hardplank", 100], ["sailcloth", 60], ["pitch", 60], ["fineplank", 60]].forEach(function (x, i) {
        var b = {}; b[x[0]] = x[1];
        push({ id: "x_shipyard_s" + i, name: "Stock for the yard", text: line("made", seed + 10 + i, { n: x[1], s: ITEMS[x[0]].name.toLowerCase() }), needs: [{ bring: b }],
               reward: { coins: Math.ceil(priceOf(x[0]) * x[1] * 2.5) + 500, xp: { construction: 200 * (i + 2) }, items: { woodcrate: 1 } } }); });
      add.forEach(function (q) { if (q.reward.items) Object.keys(q.reward.items).forEach(function (k) { if (!q.reward.items[k]) delete q.reward.items[k]; }); });
      P.quests = P.quests.concat(add);
    });
  })();

  return {
    PACE: PACE, KIT_DUR: KIT_DUR, HAND_FISH_SLOW: HAND_FISH_SLOW, EARLY_FISH_XP: EARLY_FISH_XP, ISLE_STOCK: ISLE_STOCK, INNS: INNS, eachFor: eachFor, sellFor: sellFor,
    pyramidView: pyramidView, pyrChambers: pyrChambers, pyrDay: pyrDay, pyrLoot: pyrLoot, PYR_TRAPS: PYR_TRAPS, PYR_RIDDLES: PYR_RIDDLES, PHARAOH_SET: PHARAOH_SET, PYR_CHAMBERS: PYR_CHAMBERS,
    contractsFor: contractsFor, contractsView: contractsView, CONTRACT_PORTS: CONTRACT_PORTS, mirageStock: mirageStock, OASIS_REST: OASIS_REST, atOasis: atOasis,
    estateView: estateView, ESTATE_PARTS: ESTATE_PARTS, ESTATE_ISLE: ESTATE_ISLE, estateCost: estateCost,
    SHIPS: SHIPS, SHIP_BUILD: SHIP_BUILD, PROVISIONS: PROVISIONS, ISLANDS: ISLANDS, shipyardView: shipyardView, placeLock: placeLock, islandOf: islandOf, shipTier: shipTier, HOME_ACTS: HOME_ACTS,
    huntPool: huntPool, GLYPHS: GLYPHS,
    NATURES: NATURES, PATTERNS: PATTERNS, GENE_STATS: GENE_STATS, geneOf: geneOf, geneView: geneView, childGene: childGene, pairGenes: pairGenes, natureBook: natureBook, knackOf: knackOf,
    homeView: homeView, LORE: LORE, RESEARCH: RESEARCH, STARS: STARS, stewWorth: stewWorth, isNight: isNight,
    advance: advance, view: view, act: actAndNote, empty: empty, stage: stage, mood: mood,
    HERB_TIERS: HERB_TIERS, herbChance: herbChance, herbTierAt: herbTierAt, doubleChance: doubleChance, masterHerbalist: masterHerbalist,
    ROOMS: ROOMS, ROOM_ORDER: ROOM_ORDER, ROOM_CAP: ROOM_CAP, ROOM_XP: ROOM_XP, NAP_CUT: NAP_CUT, houseView: houseView, roomLock: roomLock, napSpeed: napSpeed, storeCap: storeCap,
    herbWhere: herbWhere, rollHerb: rollHerb, REGIONS: REGIONS, REGION_ORDER: REGION_ORDER, SECRETS: SECRETS, worldView: worldView, landView: landView,
    dashView: dashView, itemInfo: itemInfo, regionLock: regionLock, MODES: MODES, MOD_RATES: MOD_RATES, cleanMod: cleanMod, petBuffs: function (s, sp) { useMod(s); return petBuffs(sp); },
    FIGHT_BOOSTS: FIGHT_BOOSTS, modeOf: modeOf, newGame: newGame, slotSummary: slotSummary, ngUnlocked: ngUnlocked, SPELLS: SPELLS, ENCHANTS: ENCHANTS, MAGE_RANKS: MAGE_RANKS, spellbookView: spellbookView,
    enchantBookView: enchantBookView, enchantTargets: enchantTargets, combatLevel: combatLevel, towerView: towerView, spellLock: spellLock, LOADOUT_MAX: LOADOUT_MAX, exploreChance: exploreChance, EXPLORE_TIME: EXPLORE_TIME, PEOPLE: PEOPLE, personView: personView, questProgress: questProgress, bagCap: bagCap, bagUsed: bagUsed, BAG_START: BAG_START, levelUnlocks: levelUnlocks, JOBS: JOBS, JOB_ORDER: JOB_ORDER, ROLES: ROLES, PARTY_MAX: PARTY_MAX, jobsView: jobsView, partyView: partyView, jobSlots: jobSlots, gardenFx: gardenFx, MIGRATIONS: MIGRATIONS, SAVE_V: SAVE_V, XP_CURVE: XP_CURVE, normal: normal, RECIPE_XP: RECIPE_XP, recipeEffort: recipeEffort, partyLock: partyLock, keeperChests: keeperChests, VALUABLE: VALUABLE, ECON: ECON, STORY: STORY, STORY_ARCS: STORY_ARCS, STORY_GATES: STORY_GATES, GATE_UNLOCKS: GATE_UNLOCKS, STORY_SWITCH: STORY_SWITCH, storyView: storyView, storyLock: storyLock, questOpen: questOpen, TOKEN_SHOP: TOKEN_SHOP, TOKENS_FOR: TOKENS_FOR, STAR_MAX: STAR_MAX, packOf: packOf, sizeOf: sizeOf, PACK: PACK, noviceMult: noviceMult, NOVICE: NOVICE, stackCap: stackCap, slotsOf: slotsOf, STACK_START: STACK_START, BANK: BANK, chestLayout: chestLayout, benchStore: benchStore, ordersFor: ordersFor, ordersView: ordersView,
    herbariumView: herbariumView,
    priceOf: priceOf, repairCost: repairCost, toolDur: toolDur, gradeOf: gradeOf, isSunday: isSunday, bossesBeaten: bossesBeaten,
    RESKINS: RESKINS, MERCHANT_STOCK: MERCHANT_STOCK, TRAVELLER_STOCK: TRAVELLER_STOCK, MERCHANT_DAILY: MERCHANT_DAILY, stockFor: stockFor, UPGRADES: UPGRADES, hatchSlots: hatchSlots, TOOL_DUR: TOOL_DUR, wearFor: wearFor,
    odds: odds, rollEgg: rollEgg, playerView: playerView, bagList: bagList, levelOf: levelOf, villageView: villageView, describe: describe,
    WORKSHOPS: WORKSHOPS, WORKSHOP_ORDER: WORKSHOP_ORDER, GATHERING: GATHERING, CRAFT_LEVELS: CRAFT_LEVELS,
    PLAYER_SLOTS: PLAYER_SLOTS, PET_SLOTS: PET_SLOTS, SLOT_NAMES: SLOT_NAMES, gearSum: gearSum,
    HERBS: HERBS, HERB_ORDER: HERB_ORDER, MAX_POTS: MAX_POTS,
    FISH_BAIT: FISH_BAIT, tripNeeds: tripNeeds,
    huntsView: huntsView, MONSTERS: MONSTERS, HUNTS: HUNTS, HUNT_ORDER: HUNT_ORDER, ESSENCE_WINS: ESSENCE_WINS, spotLock: spotLock, COMBAT: COMBAT, REGEN: REGEN, regenRate: regenRate, brewText: brewText, armourCut: armourCut, worstHit: worstHit, BOSS_UNLOCKS: BOSS_UNLOCKS, rematchKills: rematchKills, bossNeed: bossNeed,
    STYLES: STYLES, WEAPONS: WEAPONS, DTYPES: DTYPES, WEAR: WEAR, ROUND: ROUND,
    BOOSTS: BOOSTS, boostText: boostText, CLASSES: CLASSES, CROPS: CROPS, CROP_ORDER: CROP_ORDER, PLOT_UNLOCKS: PLOT_UNLOCKS, farmView: farmView, DIGGERS: DIGGERS,
    breedingView: breedingView, BREEDS: BREEDS, BREED_TIME: BREED_TIME, BREED_REST: BREED_REST,
    petsView: petsView, hatcheryView: hatcheryView, dexView: dexView, HATCHERY_SLOTS: HATCHERY_SLOTS,
    graveyardView: function (state) { return ((state && state.graveyard) || []).slice(); }, FLYING: FLYING, areaLock: areaLock,
    CAMP: CAMP, packSlots: packSlots, knowing: knowing,
    campView: function (state, now) {
      var relics = ((state && state.bag) || {}).relic || 0;
      return { relics: relics, upgrades: Object.keys(CAMP).map(function (k) { var c = CAMP[k], lv = campLevel(state, k);
        return { id: k, name: c.name, says: c.says, level: lv, max: c.costs.length, cost: lv < c.costs.length ? c.costs[lv] : 0, can: lv < c.costs.length && relics >= c.costs[lv] }; }),
        phoenixReady: campLevel(state, "phoenix") > 0 && !((state.camp || {}).phoenixAt > (now || 0) - DAY) };
    },
    /** Every creature of the runs, area by area: what you know of it. */
    bestiaryView: function (state) {
      var b = (state && state.bestiary) || {};
      return AREA_ORDER.map(function (k) { var R = RUNS[k];
        return { area: k, name: AREAS[k].name, foes: R.foes.map(function (f) { return [f, false]; }).concat([[R.guardian, true]]).map(function (x) {
          var f = x[0], e = b[f[0]], kn = knowing(state, f[0]);
          return { name: f[0], guardian: x[1], met: e ? e.met : 0, beaten: e ? e.beaten : 0, felled: e ? e.felled : 0, know: kn.name,
                   hp: e ? f[1] : null, att: e ? f[2] : null, def: e ? f[3] : null, maxHit: e ? f[4] : null,
                   toNext: !e ? 0 : e.beaten >= 15 ? 0 : e.beaten >= 5 ? 15 - e.beaten : 5 - e.beaten }; }) }; });
    },
    expeditionsView: expeditionsView, EXPEDITION_DAYS: EXPEDITION_AGE / DAY, AREAS: AREAS, AREA_ORDER: AREA_ORDER, RUNS: RUNS, INJURIES: INJURIES, PACK_SLOTS: PACK_SLOTS, runFighter: runFighter, TUNE: TUNE, SUPPLIES: SUPPLIES, CRATES: CRATES, MASTERY: MASTERY, INJURY: INJURY,
    ITEMS: ITEMS, SKILLS: SKILLS, SKILL_ORDER: SKILL_ORDER, BOOSTS: BOOSTS, XP: XP, MAX_LEVEL: MAX_LEVEL, JOB_MAX: JOB_MAX,
    SPECIES: SPECIES, PETS: PETS, EGGS: EGGS, EGG_ORDER: EGG_ORDER, FOODS: FOODS, STATS: STATS, STAT_NAMES: STAT_NAMES,
    EXPEDITION_AGE: EXPEDITION_AGE, DAY: DAY, HOUR: HOUR, MIN: MIN,
    RECYCLE: RECYCLE, recycleView: recycleView, salvage: salvage, CART: CART, cartView: cartView,
    EFFECTS: EFFECTS, TOOL_RULES: TOOL_RULES, FIELD_RECIPES: FIELD_RECIPES, fieldPartners: fieldPartners, fieldView: fieldView, fieldPagesLeft: fieldPagesLeft, FIELD_PAGES: FIELD_PAGES, BEAST_MOVES: BEAST_MOVES, BEAST_CREATURE_TYPE: BEAST_CREATURE_TYPE, BEAST_FIGHT: BEAST_FIGHT, movesOf: movesOf, movesLearned: movesLearned, packSize: packSize, packView: packView, packPlanView: packPlanView, beastMovesView: beastMovesView, typeMult: typeMult, BEAST_TYPES: BEAST_TYPES, BEAST_TYPE_OF: BEAST_TYPE_OF, BEAST_RULES: BEAST_RULES, BEAST_PEN: BEAST_PEN, WARDEN: WARDEN, beastType: beastType, beastLevel: beastLevel, beastStats: beastStats, penView: penView, penMovePrice: penMovePrice, restFor: restFor, QUIVERS: QUIVERS, arrowTier: arrowTier, quiverCap: quiverCap, huntShots: huntShots, arrowsLeft: arrowsLeft, quiverHeld: quiverHeld, quickFits: quickFits, SPECIALS: SPECIALS, specOf: specOf, specTable: specTable, specLoadout: specLoadout, specCatalogue: specCatalogue, weaponFamily: weaponFamily, specFits: specFits, HOW_TO_PLAY: HOW_TO_PLAY, hasGuide: hasGuide, canUseClass: canUseClass, oldClassesOf: oldClassesOf, needsQuiver: needsQuiver, quiverWhyNot: quiverWhyNot, GUILD: GUILD, TECHNIQUES: TECHNIQUES, CLASS_BOOKS: CLASS_BOOKS, guildView: guildView, classBookView: classBookView, techniquesView: techniquesView, switchPrice: switchPrice, techLearned: techLearned, itemClass: itemClass, isShield: isShield, PALADIN: PALADIN, clsPlural: clsPlural, SPELL_ELEMENT: SPELL_ELEMENT, ELEMENTS: ELEMENTS, ELEMENT_WEAK: ELEMENT_WEAK, elementMult: elementMult, loadoutMax: loadoutMax, LAND: LAND, CREATURE_GUARDS: CREATURE_GUARDS, NET_PLAN: NET_PLAN, isTool: isTool, toolsView: toolsView, toolPlanView: toolPlanView, toolWhyNot: toolWhyNot, trapsAllowed: trapsAllowed, EFFECT_RULES: EFFECT_RULES, WEAPON_WEAR: WEAPON_WEAR, addEffect: addEffect, fxHeld: fxHeld, fxView: fxView, fxMult: fxMult, fxTick: fxTick, weaponDur: weaponDur, weaponLevel: weaponLevel, weaponView: weaponView, pickWeapon: pickWeapon, isWeapon: isWeapon, retemperCost: retemperCost, grindView: grindView, TALENTS: TALENTS, TALENT_RULES: TALENT_RULES, talentsView: talentsView, talentSum: talentSum, talentLock: talentLock, classLevel: classLevel, talentPoints: talentPoints, respecCost: respecCost, specCostOf: specCostOf, autoRuns: autoRuns, AUTO_RUN: AUTO_RUN, startBattle: startBattle, battleRound: battleRound, playerFighter: playerFighter, creatureLevel: creatureLevel, RANCH: RANCH, RANCH_ORDER: RANCH_ORDER, RANCH_PACE: RANCH_PACE, LIVESTOCK: LIVESTOCK, recordsView: recordsView, goalsView: goalsView, GIFTED: GIFTED, GIFTED_TUNE: GIFTED_TUNE, giftedView: giftedView, carePace: carePace, comfortsOf: comfortsOf, RANCH_FEED: RANCH_FEED, RANCH_CHURN: RANCH_CHURN, RANCH_CULTURE: RANCH_CULTURE, RANCH_MAKE: RANCH_MAKE, RANCH_SLOTS: RANCH_SLOTS, RANCH_SHOW: RANCH_SHOW, showScore: showScore, LIVESTOCK_ORDER: LIVESTOCK_ORDER, RANCH_GOODS: RANCH_GOODS, ranchCount: ranchCount, ranchUnlocks: ranchUnlocks, ranchDash: ranchDash, RANCH_QUEST: RANCH_QUEST, RANCH_FED: RANCH_FED, ranchView: ranchView, ranchOpen: ranchOpen,
    BOSS_GEAR_WINS: BOSS_GEAR_WINS, bossLock: bossLock, bossGearSet: bossGearSet,
    TUTORIAL: TUTORIAL, tutorialView: tutorialView, GUIDE: GUIDE, CLASS_TUTORIALS: CLASS_TUTORIALS, classTutView: classTutView,
    MARKET: MARKET, LOCKED_CRATES: LOCKED_CRATES, materialCost: materialCost, storeFloor: storeFloor, autoEat: autoEat, swagWorth: swagWorth, fencePays: fencePays, STORE_RULE: STORE_RULE, marketView: marketView, stealChance: stealChance, canSteal: canSteal, buyPrice: buyPrice, sellEach: sellEach, storeBuys: storeBuys,
    LEGACY: LEGACY, legacyOf: legacyOf, prestigeView: prestigeView,
    PEN_YARD: PEN_YARD,
    BOSS_TELLS: BOSS_TELLS, bossTell: bossTell, tellMult: tellMult,
    MOVE_TOMES: MOVE_TOMES, tomeTeachable: tomeTeachable, tomeMovesOf: tomeMovesOf, tomeBossDrop: tomeBossDrop,
    QUARRY: QUARRY, QUARRY_MASTERY: QUARRY_MASTERY, MASTERY_DROPS: MASTERY_DROPS, quarryView: quarryView, quarryKnow: quarryKnow, quarryKills: quarryKills, quarryTruth: quarryTruth, necroSteps: necroSteps,   // the Bestiary (V6), the Blood Book (V8)
    gearSetsView: gearSetsView, GEAR_SETS: GEAR_SETS, talkView: talkView, TALKS: TALKS, fieldWhy: fieldWhy, fieldInvolved: fieldInvolved, REGION_TOMES: REGION_TOMES, ASTRAL: ASTRAL, isAstral: isAstral, DEATH: DEATH, mustFlee: mustFlee, graveView: graveView, wouldKeep: wouldKeep, modeBonus: modeBonus, graveFee: graveFee, trackWhy: trackWhy, TRACK: TRACK,   // gear sets (Modernize/Reduce Nav)
    NECRO: NECRO, necroView: necroView, raiseCost: raiseCost, archmageOffer: archmageOffer, risenFalls: risenFalls, isUndead: isUndead, graveLevel: graveLevel, risenSlots: risenSlots, CRYPT_STOCK: CRYPT_STOCK,
    ARMOUR: ARMOUR, weightOf: weightOf, weightAcc: weightAcc, weightText: weightText, armourView: armourView, armourFits: armourFits,   // armour weights (V17)
    SKILL_REG: SKILL_REG, SKILL_BY: SKILL_BY, skillPages: skillPages
  };
})();
