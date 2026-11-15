// Pixel Pet -- the rules. (Slice 1, 2026-10-03: a Tamagotchi-style pet.)
//
// Cam's brief (Notes -> Vault -> "Pixel Pet Feature"): "start really simple.
// With all the basic funcitons of a tamagotchi style pet, then slowly layer
// on features in a logical order that build the game out slowly. Lets get the
// foundations working first." Expeditions, skills, villages, breeding and the
// rest build on what is here.
//
// BUILT FILE (2026-10-10 audit, H-1): ui/pet/petcore.js is joined from the parts in ui/pet/core/ (NN-name.js, in order) by
// tools/build_petcore.py. Edit the parts, then run `python3 tools/build_petcore.py` -- never edit petcore.js itself (the
// tests check it matches its parts). Each part is a section of the old file: a feature's data and rules together.
//
// It runs in the game's page and in node (the tests, tools/balance_sim.js), so: no modules, no DOM, and no
// randomness (the rules must give the same answer everywhere; the pet's wandering is the UI's). The desktop pet
// card that also ran it was removed 2026-10-15.
//
// TIME IS REAL TIME. Nothing ticks while nobody is looking: the saved state
// says what the stats were at `pet.at`, and advance() walks it forward to
// now in ten-minute steps, so a pet left for a weekend is as hungry as it
// should be the moment it is looked at.
//
//   state = { v: 1, pet: null | Pet, player: Player, bag: {item: count},
//             log: [{t, text}] }                              (newest log first)
//   Player = { name, made, look: {skin, hair, outfit}, skills: {skill: xp},
//              job: null | Job, lastTrip }
//   Job    = { skill, spot, since, next, until, seed, count, xp, items: {item: n} }
//   Pet   = { name, species, colour, egg, born, hatchAt, at,
//             s: {full, happy, energy, clean, health},       0..100 each
//             asleep, sick, lastMed, counts: {fed, played, cleaned, petted, ...} }

var PetCore = (function () {
  "use strict";

  var MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  var STEP = 10 * MIN;
  var CATCH_UP = 60 * DAY;          // a pet left longer than this is treated as left this long
  var EXPEDITION_AGE = 3 * DAY;     // the brief said 5 days; Cam (2026-10-06): "make expeditions availible at age 3"
  var ADULT_AGE = 20 * DAY;
  var MED_COOLDOWN = 2 * HOUR;
  var LOG_MAX = 40;
  var MASTERY = CONTENT("MASTERY");        // successes for area level 1..5

  var STATS = CONTENT("STATS");
  var STAT_NAMES = CONTENT("STAT_NAMES");

  // Every pet there is: a species in a colour (petart.js's palettes), and
  // how rare it is. More join as the game grows.
  var SPECIES = CONTENT("SPECIES");
  // hidden in the world (2026-10-07): one in every region, in an egg found only by exploring
  [["chicken", "golden"], ["sheep", "black"], ["hare", "snow"], ["deer", "white"], ["seal", "selkie"], ["fox", "silver"], ["tiger", "white"], ["snake", "emerald"]]
    .concat([["spider", "crystal"], ["crab", "coral"], ["ram", "frost"]])
    .forEach(function (x) { SPECIES[x[0]].colours.push(x[1]); });
  var PETS = CONTENT("PETS");

  // Eggs. Cam (2026-10-03): "I would like the game not to tell me what is in
  // each egg, the surprise is part of the fun ... call the egg starter. Which
  // has a list of pets and a probability of getting each one. The egg should
  // have a longer hatch time like 3 minutes for a starter egg and then goes
  // up depending on the rarity of the egg. Special obtained eggs should take
  // 2 hours to hatch." What is inside is rolled when the egg is taken and
  // kept out of view() until it hatches; every egg of a kind looks the same.
  // Only the starter egg can be taken yet -- the others will come from
  // expeditions, loot crates and breeding (`found`).
  var EGGS = CONTENT("EGGS");
  var EGG_ORDER = CONTENT("EGG_ORDER");

  /** An egg's pool -- grown by your boss wins (2026-10-03): beat Gideon once and foxes hatch from
   *  uncommon eggs; ten times and Gideon himself from rare ones. Billy: once, then fifteen. */
  function poolFor(type, s) {
    var pool = EGGS[type].pool.slice(), h = (s && s.hunt) || {};
    var won = function (g) { return (h[g] && h[g].wins) || 0; };
    if (type === "uncommon" && won("farmyard") >= 1) pool.push(["fox/red", 10]);
    if (type === "uncommon" && won("pasture") >= 1) pool.push(["ram/wool", 10]);
    if (type === "rare" && won("farmyard") >= 10) pool.push(["fox/gideon", 3]);
    if (type === "rare" && won("pasture") >= 15) pool.push(["ram/billy", 3]);
    if (type === "desert" && won("desert") >= 10) pool.push(["cat/sphynx", 4]);     // the Sphinx's cat (2026-10-08)
    if (type === "nile" && won("nile") >= 15) pool.push(["alligator/king", 3]);     // the King of the Nile himself
    if (type === "frostpeak" && won("frostpeak") >= 10) pool.push(["yeti/cub", 3]); // the Yeti's own (stage 3)
    return pool;
  }
  /** What an egg may hatch into, and the chance of each (percent). */
  function odds(type, s) {
    var e = EGGS[type];
    if (!e) return [];
    var pool = poolFor(type, s);
    if (!pool.length) return [];
    var total = pool.reduce(function (a, p) { return a + p[1]; }, 0);
    return pool.map(function (p) {
      return { pet: p[0], name: PETS[p[0]].name, rarity: PETS[p[0]].rarity, chance: Math.round(1000 * p[1] / total) / 10 };
    });
  }

  /** Which pet a roll (0 <= roll < 1) of an egg gives. */
  function rollEgg(type, roll, s) {
    var pool = poolFor(type, s), total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i][1];
    var at = Math.max(0, Math.min(0.999999, roll)) * total;
    for (i = 0; i < pool.length; i++) { at -= pool[i][1]; if (at < 0) return pool[i][0]; }
    return pool[pool.length - 1][0];
  }
  // the bag, with the sandbox's endless supply in mind
  function has(s, id, n) { return (s.dev && s.dev.infinite) || (s.bag[id] || 0) >= (n || 1); }
  function take(s, id, n) {
    if (s.dev && s.dev.infinite) return;
    s.bag[id] = (s.bag[id] || 0) - (n || 1);
    if (id === "unidherb") trimUnid(s);
  }
  /** Into the bag, if there's room (2026-10-07): a kind you already carry always fits; a new kind
   *  needs a free space, or it's left behind (s.lost, said in the diary). Herbs from anywhere but the
   *  Herb table come unidentified. `force`: always (things you packed, coming home). */
  function give(s, id, n, force) {
    n = n || 1;
    if (id === "unidherb" && !force) return addUnid(s, "herb", n);
    if (HERB_TIER_OF[id] && !force) return addUnid(s, id, n);
    if (!force && !roomFor(s, id)) { s.lost = s.lost || {}; s.lost[id] = (s.lost[id] || 0) + n; return 0; }
    var fit = force ? n : Math.min(n, stackRoom(s, id));                 // a full stack: the rest is left behind (2026-10-10)
    if (fit < n) { s.lost = s.lost || {}; s.lost[id] = (s.lost[id] || 0) + n - fit; }
    if (fit <= 0) return 0;
    s.bag[id] = (s.bag[id] || 0) + fit;
    return fit;
  }
