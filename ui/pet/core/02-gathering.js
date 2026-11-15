  // ---- gathering (slice 2) ----------------------------------------------------------
  // The brief: "Skills - Lumbering, Mining, Fishing, Foraging ...", "Player
  // Avatar (Player can also level up and complete skills as well, this is
  // pertinent at the start of the game as you dont have many pets)", "think
  // like melvor idle. They gather items slowly, which are stored at your isle
  // village", "Item rarity system - Gems 0-10", "Levels can go upto 50 ...
  // each 5 has a minor unlock every 10 major unlock ... take inspiration from
  // old school runescape level syystem". And the companion "imbues the player
  // with skill boosts depending on the pet".
  var MAX_LEVEL = 50;
  var JOB_MAX = 12 * HOUR;           // a trip lasts at most this long, then they come home
  var STARTER_BAG = CONTENT("STARTER_BAG");

  // gem: the brief's rarity, 0 (everyday) .. 10. food: what it does for the pet.
  var ITEMS = CONTENT("ITEMS");

  // Each skill's spots: a new one at levels 5 and 10 (the brief's unlocks). Every spot is in one of
  // the hunt's areas (Cam, 2026-10-03: "areas will be broken down into sub areas like the 3 we have at
  // the moment would be in pasture") -- more sub-areas come to the other areas later.
  // time: seconds a find takes; rare: [item, one in N].
  // (2026-10-10, Cam: "lumbering is taking too long to level up from 6 to 7") -- no long flat stretch early on: the next spot
  // opens within ~4 levels (Oak trees 6, Willow 10; Chalk pit 8 -- iron stays at 15, Cam's RuneScape grind; Old mound 8;
  // Old orchard 8). A spot's xp an hour doesn't depend on its level (the pace step), so this only brings it sooner.
  var SKILLS = CONTENT("SKILLS");
  var DIGGERS = CONTENT("DIGGERS");
  // what a fishing tool needs, and who makes it
  var FISH_BAIT = CONTENT("FISH_BAIT");
  var FISH_MAKER = CONTENT("FISH_MAKER");

  // Classes (2026-10-03): "Hunter, Berzerker and Arcane". A Hunter shoots (bows, arrows,
  // Ranged), a Berserker fights up close; each is 20% better with its own way of
  // fighting, and only they wear their class's sets. Arcane waits for runes, staffs,
  // wands and spellbooks.
  var CLASSES = CONTENT("CLASSES");

