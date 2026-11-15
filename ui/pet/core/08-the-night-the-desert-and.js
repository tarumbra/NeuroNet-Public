  // ==== the night, the Desert and the Nile (2026-10-08, Cam: "some pets can only be obtained at night or day time. Owl
  //      would be night only and certain scorpions ... a dessert area with vipers, scorpions, camel spiders, camels ... a
  //      pyrimid ... sphix boss ... nile river which is a sub area within the dessert where there are alligators,
  //      flamingoes, hippo ... a special fishing option both at the nile and oasis where you can collect a extremely rare
  //      mummy pet, a king of nile alligator boss, hyraglyics which can be put together at the ancient stacks ... a special
  //      locus pet called plauge ... egyptian clouthing for pet and player")
  // A creature in a hunting ground can come out by day or by night only: [id, weight, "day"|"night"]; the clock at each
  // fight decides (the same rule offline, so an hour away overnight brings owls).
  Object.assign(MONSTERS, CONTENT("more MONSTERS"));
  HUNTS.forest.monsters.push(["owl", 15, "night"]);
  HUNTS.deepforest.monsters.push(["owl", 12, "night"]);
  HUNTS.desert = CONTENT("HUNTS.desert");
  HUNTS.nile = CONTENT("HUNTS.nile");
  HUNT_ORDER.push("desert", "nile");
  /** A hunting ground's creatures right now: day ones by day, night ones at night (night: 9 pm to 5 am). */
  function huntPool(ground, at) {
    var night = isNight(at), out = ground.monsters.filter(function (m) { return !m[2] || (m[2] === "night") === night; });
    return out.length ? out : ground.monsters;
  }

  // the pets: by day and by night, from the desert and the river -- and two that only the Nile's deepest
  // fishing and the old tablets give
  Object.assign(SPECIES, CONTENT("more SPECIES"));
  Object.assign(PETS, CONTENT("more PETS"));
  Object.assign(EGGS, CONTENT("more EGGS"));
  Object.assign(FIGHT_STYLE, CONTENT("more FIGHT_STYLE"));

  // the things they give, and what's found there
  Object.assign(ITEMS, CONTENT("more ITEMS"));
  Object.assign(WEAR, CONTENT("more WEAR"));
  WORKSHOPS.crafting.recipes.push(
    { make: "desertkit", needs: { cloth: 6, leather: 4, gold: 2 }, level: 40, xp: 140 },
    { make: "papyrusnet", needs: { papyrus: 12, silk: 4 }, level: 45, xp: 150 },
    { make: "petnemes", needs: { cloth: 4, goldbar: 1, lapis: 1 }, level: 44, xp: 160 },
    { make: "linenrobe", needs: { cloth: 10, goldbar: 1, lapis: 1 }, level: 46, xp: 180 },
    { make: "nemes", needs: { cloth: 8, goldbar: 2, lapis: 2 }, level: 48, xp: 200 },
    { make: "bastetcollar", needs: { gatorhide: 3, goldbar: 2, lapis: 1 }, level: 50, xp: 220 });
  WORKSHOPS.anvil.recipes.push({ make: "khopesh", needs: { adamantbar: 3, goldbar: 2 }, level: 46, xp: 110, fee: 24 });
  WORKSHOPS.gemology.recipes.push({ make: "ankhring", needs: { lapis: 2, goldbar: 1 }, level: 50, xp: 160 });
  WORKSHOPS.kitchen.recipes.push({ make: "grilledtilapia", needs: { tilapia: 1, twigs: 1 }, level: 44, xp: 40 },
                                 { make: "grillednileperch", needs: { nileperch: 1, twigs: 1 }, level: 48, xp: 48 });
  // the places to gather (the Oasis pool and the Nile's depths take a papyrus net -- and once in a long while,
  // a wrapped egg comes up in it)
  SKILLS.foraging.spots.push(
    { id: "datepalms", name: "Date palms", area: "desert", level: 44, time: 140, xp: 44, method: "pick", loot: [["dates", 80], ["aloe", 20]] },
    { id: "cactus", name: "Cactus garden", area: "desert", level: 47, time: 146, xp: 47, method: "pick", loot: [["cactusfruit", 75], ["aloe", 25]] },
    { id: "papyrusreeds", name: "Papyrus reeds", area: "nile", level: 45, time: 142, xp: 45, method: "pick", loot: [["papyrus", 85], ["lotus", 15]] },
    { id: "lotuspools", name: "Lotus pools", area: "nile", level: 49, time: 150, xp: 50, method: "pick", loot: [["lotus", 80], ["papyrus", 20]] });
  SKILLS.fishing.spots.push(
    { id: "oasis", name: "Oasis pool", area: "oasis", level: 46, time: 142, xp: 44, method: "net", needs: "papyrusnet", loot: [["tilapia", 85], ["pondweed", 15]], rare: ["wrappedegg", 3000] },
    { id: "nileshallows", name: "Nile shallows", area: "nile", level: 45, time: 140, xp: 45, method: "cage", needs: "lobstercage", loot: [["tilapia", 55], ["catfish", 45]] },
    { id: "niledepths", name: "Nile depths", area: "nile", level: 50, time: 155, xp: 52, method: "net", needs: "papyrusnet", loot: [["nileperch", 85], ["catfish", 15]], rare: ["wrappedegg", 2500] });
  SKILLS.mining.spots.push(
    { id: "sandstonecliff", name: "Sandstone cliffs", area: "desert", level: 44, time: 140, xp: 44, method: "mine", toolTier: 4, loot: [["sandstone", 70], ["gold", 30]] },
    { id: "lapisvein", name: "Lapis vein", area: "desert", level: 48, time: 150, xp: 49, method: "mine", toolTier: 4, loot: [["lapis", 35], ["sandstone", 65]], rare: ["sapphire", 600] });
  SKILLS.lumbering.spots.push(
    { id: "acaciatrees", name: "Acacia trees", area: "desert", level: 44, time: 140, xp: 44, method: "cut", loot: [["acacia", 85], ["twigs", 15]] },
    { id: "palmgrove", name: "Palm grove", area: "desert", level: 48, time: 150, xp: 49, method: "cut", loot: [["palmlog", 85], ["dates", 15]] });
  SKILLS.digging.spots.push(
    { id: "dunes", name: "Shifting dunes", area: "desert", level: 44, time: 140, xp: 44, method: "dig", loot: [["sand", 50], ["potshard", 30], ["scarab", 15], ["oldcoin", 5]], rare: ["lapis", 400] },
    { id: "buriedtomb", name: "Buried tomb", area: "desert", level: 48, time: 150, xp: 49, method: "dig", loot: [["oldcoin", 35], ["scarab", 30], ["bones", 20], ["goldnugget", 15]], rare: ["glyphscarab", 150] },
    { id: "nilemud", name: "Riverbank mud", area: "nile", level: 47, time: 146, xp: 47, method: "dig", loot: [["clay", 50], ["soil", 25], ["potshard", 20], ["scarab", 5]], rare: ["glyphreed", 200] });
