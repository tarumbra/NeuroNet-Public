  // ---- expeditions (slice 4) -----------------------------------------------------------
  // The brief: "Pets go on expeditions", "(farm, medow, forest, ocean, caves,
  // dungeons, sky(flying pets), volcanic islands, cemetary, deep forest, dark
  // forest, devils planes, void)", "Each expedition has an exp bar ... When
  // leveled up an expedition that can go to level 5, once you reach level 5 the
  // expedition time is reduced by 1/4 and success rate is high", "the chance of
  // success is also attributed to your pets level, stats, equipment, and one time
  // use item", "On each successful expedition there is a chance for you to collect
  // an egg and loot crates", "your pet can come back injured ... locked out from
  // going on expeditions for a while". The first five areas are open; the rest
  // say what level they will need.
  var AREA_NAMES = CONTENT("AREA_NAMES");
  var FLYING = CONTENT("FLYING");
  var AREAS = {
    farm: { name: "Farm", level: 1, time: 30 * MIN, base: 0.8, xp: 40, rolls: [2, 3],
            loot: [["berry", 25], ["herb", 20], ["acorn", 15], ["apple", 15], ["twigs", 10], ["cotton", 15]], crate: ["woodcrate", 0.15], egg: ["commonegg", 0.03] },
    meadow: { name: "Meadow", level: 3, time: 60 * MIN, base: 0.75, xp: 70, rolls: [2, 4],
              loot: [["flower", 25], ["berry", 25], ["herb", 20], ["honeycomb", 15], ["clover", 2]], crate: ["woodcrate", 0.2], egg: ["commonegg", 0.05] },
    forest: { name: "Forest", level: 6, time: 2 * HOUR, base: 0.7, xp: 120, rolls: [3, 4],
              loot: [["oak", 25], ["mushroom", 25], ["acorn", 20], ["sap", 15], ["nest", 3]], crate: ["woodcrate", 0.25], egg: ["uncommonegg", 0.04] },
    ocean: { name: "Ocean", level: 10, time: 3 * HOUR, base: 0.65, xp: 180, rolls: [3, 5],
             loot: [["trout", 25], ["perch", 20], ["pondweed", 20], ["boot", 10], ["pearl", 3]], crate: ["ironcrate", 0.2], egg: ["uncommonegg", 0.05] },
    caves: { name: "Caves", level: 15, time: 4 * HOUR, base: 0.6, xp: 260, rolls: [3, 5],
             loot: [["iron", 25], ["coal", 25], ["stone", 20], ["roughgem", 5], ["amethyst", 3]], crate: ["ironcrate", 0.3], egg: ["rareegg", 0.03] },
    dungeons: { name: AREA_NAMES.dungeons, level: 20, time: 150 * MIN, base: 0.5, xp: 389, rolls: [3, 6],
            loot: [["bones", 25], ["iron", 20], ["coal", 20], ["oldcoin", 15], ["silver", 12], ["amethyst", 4]], crate: ["ironcrate", 0.3], egg: ["rareegg", 0.04] },
    sky: { name: AREA_NAMES.sky, level: 25, time: 3 * HOUR, base: 0.5, xp: 532, rolls: [3, 6],
            loot: [["feather", 30], ["quill", 20], ["pearl", 10], ["opal", 10], ["sapphire", 4]], crate: ["ironcrate", 0.3], egg: ["exoticegg", 0.03], flying: true, note: "flying pets" },
    volcanic: { name: AREA_NAMES.volcanic, level: 30, time: 210 * MIN, base: 0.5, xp: 686, rolls: [3, 6],
            loot: [["obsidian", 25], ["coal", 25], ["gold", 15], ["topaz", 8], ["ruby", 3]], crate: ["ironcrate", 0.35], egg: ["exoticegg", 0.04] },
    cemetery: { name: AREA_NAMES.cemetery, level: 34, time: 4 * HOUR, base: 0.5, xp: 818, rolls: [3, 6],
            loot: [["bones", 30], ["oldcoin", 20], ["glowcap", 15], ["jade", 10], ["emerald", 3]], crate: ["ironcrate", 0.35], egg: ["rareegg", 0.06] },
    deepforest: { name: AREA_NAMES.deepforest, level: 38, time: 270 * MIN, base: 0.5, xp: 955, rolls: [3, 6],
            loot: [["yew", 25], ["truffle", 15], ["orchid", 15], ["mithril", 10], ["emerald", 4]], crate: ["ironcrate", 0.4], egg: ["exoticegg", 0.05] },
    darkforest: { name: AREA_NAMES.darkforest, level: 42, time: 5 * HOUR, base: 0.5, xp: 1099, rolls: [3, 6],
            loot: [["magiclog", 20], ["saffron", 15], ["royaljelly", 10], ["adamantite", 10], ["ruby", 4]], crate: ["ironcrate", 0.45], egg: ["exoticegg", 0.06] },
    devilsplains: { name: AREA_NAMES.devilsplains, level: 46, time: 330 * MIN, base: 0.5, xp: 1248, rolls: [3, 6],
            loot: [["obsidian", 25], ["runite", 10], ["diamond", 3], ["gold", 20], ["ruby", 8]], crate: ["ironcrate", 0.5], egg: ["exoticegg", 0.07] },
    void: { name: AREA_NAMES.void, level: 50, time: 6 * HOUR, base: 0.5, xp: 1403, rolls: [3, 6],
            loot: [["runite", 15], ["diamond", 6], ["magiclog", 15], ["royaljelly", 15], ["sapphire", 10]], crate: ["ironcrate", 0.6], egg: ["exoticegg", 0.1] }
  };
  // Runs (2026-10-06, Cam: "More of a rouge like ... pets have their own battle stats ... The later
  // expeditions need to carry some risk if unprepared"): an expedition is a run of stages -- fights,
  // hazards and finds, a guardian at the end -- on the pet's own health. foes: [name, hp, att, def, maxHit].
  // fall: what a pet that drops in this area comes home with (the later areas, slice 2: death).
  // Tuned over 300 runs an area at its entry level (2026-10-06): unprepared, only the Farm is kind
  // (58% clear at level 1); with that tier's pet armour, 3 cooked food and a vigour draught: Farm and
  // Meadow ~100%, Forest ~93%, Ocean ~95%, Caves ~70% -- the deep ones still bite.
  var RUNS = CONTENT("RUNS");
  var INJURIES = CONTENT("INJURIES");
  var PACK_SLOTS = 3;                                                     // kinds of thing a pet can carry (more with the Camp)
  // The Camp (2026-10-06, part 3; Cam: "the further on we travel and play the more unlocks we achieve,
  // the better our next run is"): lasting upgrades for every pet, bought with relics from the deep areas.
  var CAMP = CONTENT("CAMP");
  function campLevel(s, k) { return ((s && s.camp) || {})[k] || 0; }
  function packSlots(s) { return PACK_SLOTS + campLevel(s, "pack"); }
  // The Bestiary: beat a creature 5 times and your pets know it (studied); 15, they've mastered it.
  var STUDY = CONTENT("STUDY");
  function knowing(s, name) {
    var b = ((s && s.bestiary) || {})[name], n = b ? b.beaten || 0 : 0;
    for (var i = 0; i < STUDY.length; i++) if (n >= STUDY[i][0]) return { hit: STUDY[i][1], dmg: STUDY[i][2], name: STUDY[i][3] };
    return { hit: 0, dmg: 0, name: b ? "met" : "" };
  }
  var TUNE = CONTENT("TUNE");              // a cooked food heals a pet x1.5; def/8 off each blow
  // combat xp (2026-10-10, Cam: "the combat xp as well"): a kill gave ~6-17x the xp an hour of gathering at the same level
  // (a level-1 fighter ~8,900 Attack xp an hour against ~1,000 gathering) -- scaled to ~1.1x (low) to ~2x (high), ~1.5x overall
  function killXp(mon) { return Math.max(1, Math.round(mon.xp * TUNE.combatXp * 10) / 10); }
  // how each kind of animal fights: hp (a share), att, agi (dodge, 4% a point)
  var FIGHT_STYLE = CONTENT("FIGHT_STYLE");
  var RARITY_POWER = CONTENT("RARITY_POWER");
  var AREA_ORDER = CONTENT("AREA_ORDER");
  var CRATES = CONTENT("CRATES");
  // one-time supplies: a better chance; the salve also keeps a pet from harm
  var SUPPLIES = CONTENT("SUPPLIES");
  var INJURY = 6 * HOUR;

