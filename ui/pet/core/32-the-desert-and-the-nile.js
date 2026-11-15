  // ==== the Desert and the Nile as places (2026-10-08): regions, people, secrets -- and the plague tablet ============
  REGIONS.desert = CONTENT("REGIONS.desert");
  REGIONS.nile = CONTENT("REGIONS.nile");
  REGION_ORDER.push("desert", "nile");
  REGION_LINKS.push(["jungle", "desert"], ["desert", "nile"]);
  SECRETS.desert = CONTENT("SECRETS.desert");
  SECRETS.nile = CONTENT("SECRETS.nile");
  PEOPLE.desert = CONTENT("PEOPLE.desert");
  PEOPLE.nile = CONTENT("PEOPLE.nile");
  Object.assign(BOOSTS, CONTENT("more BOOSTS"));
  Object.assign(PET_ATTACKS, CONTENT("more PET_ATTACKS"));
  AREA_COINS.desert = CONTENT("AREA_COINS.desert"); AREA_COINS.nile = CONTENT("AREA_COINS.nile");
  BOSS_PURSE.desert = CONTENT("BOSS_PURSE.desert"); BOSS_PURSE.nile = CONTENT("BOSS_PURSE.nile");
  BOSS_UNLOCKS.sphinx = CONTENT("BOSS_UNLOCKS.sphinx");
  BOSS_UNLOCKS.kingnile = CONTENT("BOSS_UNLOCKS.kingnile");
  MONSTERS.sphinx.drops.push(["ancientchest", 1, 1, 0.06]); MONSTERS.kingnile.drops.push(["ancientchest", 1, 1, 0.06]);
  WEAPONS.khopesh = CONTENT("WEAPONS.khopesh");
  // the plague tablet: six glyphs, put together in the ancient stacks -> a buzzing egg (Cam: "hyraglyics which can be put
  // together at the ancient stacks back at the library and they unlock a special locus pet called plauge")
  var GLYPHS = CONTENT("GLYPHS");
  var GLYPH_FROM = CONTENT("GLYPH_FROM");
  RESEARCH.plague = CONTENT("RESEARCH.plague");
  var DECIPHER_HOURS = 12;

