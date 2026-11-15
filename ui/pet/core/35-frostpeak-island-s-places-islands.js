  // ==== Frostpeak Island's places -- islands stage 3 (2026-10-08): the Foothills (the old Frostpeak), the Ice Cavern, the Summit
  // (the Foothills -- the old Frostpeak -- and the climbing kit's way to the Summit are in their first definitions now)
  REGIONS.icecavern = CONTENT("REGIONS.icecavern");
  REGIONS.summit = CONTENT("REGIONS.summit");
  REGION_ORDER.push("icecavern", "summit");
  REGION_LINKS.push(["frostpeak", "icecavern"], ["frostpeak", "summit"]);
  SECRETS.icecavern = CONTENT("SECRETS.icecavern");
  SECRETS.summit = CONTENT("SECRETS.summit");
  PEOPLE.icecavern = CONTENT("PEOPLE.icecavern");
  PEOPLE.summit = CONTENT("PEOPLE.summit");
  Object.assign(BOOSTS, CONTENT("more BOOSTS"));
  Object.assign(PET_ATTACKS, CONTENT("more PET_ATTACKS"));
  AREA_COINS.frostpeak = CONTENT("AREA_COINS.frostpeak"); BOSS_PURSE.frostpeak = CONTENT("BOSS_PURSE.frostpeak");
  BOSS_UNLOCKS.yeti = CONTENT("BOSS_UNLOCKS.yeti");
  MONSTERS.yeti.drops.push(["ancientchest", 1, 1, 0.06]);

