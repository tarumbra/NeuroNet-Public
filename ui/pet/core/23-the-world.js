  // ---- the world (2026-10-07, Cam: "a world exploration like neopets game world. This way we can even
  //      hide special eggs in hidden areas and some areas would have a requirement. Lets say deep jungle
  //      would require the creation of a special machete and a certain attack level") ----------------
  // A map of regions around the village. Each has its places (gathering spots, a hunting ground, an
  // expedition) and secrets, found one at a time by exploring it: caches, hidden spots, and an egg
  // that hatches a pet found nowhere else. x, y: where it sits on the map (percent).
  var REGIONS = CONTENT("REGIONS");
  var REGION_ORDER = CONTENT("REGION_ORDER");
  var REGION_LINKS = CONTENT("REGION_LINKS");
  // what's hidden where: kind cache (coins and things), spot (a gathering spot), egg (a hidden egg)
  var SECRETS = CONTENT("SECRETS");
