  // ==== the Open Sea -- islands stage 2 (2026-10-08, Cam: "The ship will be a requirement for ocean expeditions, certain
  //      fishing (add stingrangs, sharks, killer whale, whale ect."; "Catches + rare sea pets") ----------------------------
  // Out past the harbour, fished from your own ship: each spot names the ship it takes (sp.ship).
  REGIONS.opensea = CONTENT("REGIONS.opensea");
  REGION_ORDER.push("opensea");
  REGION_LINKS.push(["coast", "opensea"]);
  Object.assign(ITEMS, CONTENT("more ITEMS"));
  WORKSHOPS.kitchen.recipes.push({ make: "grilledstingray", needs: { rawstingray: 1, twigs: 1 }, level: 40, xp: 42 },
                                 { make: "hammerheadsteak", needs: { rawhammerhead: 1, twigs: 1 }, level: 45, xp: 46 },
                                 { make: "greatwhitesteak", needs: { rawgreatwhite: 1, twigs: 1 }, level: 50, xp: 50 });
  // blubber boils down to pitch: the sea pays for the next ship
  WORKSHOPS.crafting.recipes.push({ make: "pitch", needs: { orcablubber: 1 }, level: 28, xp: 30, n: 2 }, { make: "pitch", needs: { whaleblubber: 1 }, level: 28, xp: 30, n: 4 });
  SKILLS.fishing.spots.push(
    { id: "stingrayshoals", name: "Stingray shoals", area: "opensea", level: 40, ship: 2, time: 135, xp: 40, method: "harpoon", needs: "harpoon", loot: [["rawstingray", 85], ["pondweed", 15]], rare: ["shoalegg", 1500] },
    { id: "sharkwaters", name: "Shark waters", area: "opensea", level: 45, ship: 2, time: 142, xp: 44, method: "harpoon", needs: "harpoon", loot: [["rawhammerhead", 60], ["rawgreatwhite", 40]] },
    { id: "orcawaters", name: "Orca waters", area: "opensea", level: 48, ship: 3, time: 150, xp: 50, method: "harpoon", needs: "harpoon", loot: [["orcablubber", 70], ["rawgreatwhite", 30]], rare: ["orcaegg", 2000] },
    { id: "whaleroad", name: "Whale road", area: "opensea", level: 50, ship: 4, time: 165, xp: 58, method: "harpoon", needs: "harpoon", loot: [["whaleblubber", 75], ["rawgreatwhite", 23], ["ambergris", 2]], rare: ["whaleegg", 2500] });
  Object.assign(SPECIES, CONTENT("more SPECIES"));
  Object.assign(PETS, CONTENT("more PETS"));
  Object.assign(EGGS, CONTENT("more EGGS"));
  Object.assign(FIGHT_STYLE, CONTENT("more FIGHT_STYLE"));
  Object.assign(BOOSTS, CONTENT("more BOOSTS"));
  Object.assign(PET_ATTACKS, CONTENT("more PET_ATTACKS"));
  SECRETS.opensea = CONTENT("SECRETS.opensea");
  PEOPLE.opensea = CONTENT("PEOPLE.opensea");
  PEOPLE.shipyard.quests.push(
    { id: "sharkteeth", name: "Teeth for the yard", text: "\"Shark leather grips a rope like nothing else. Hammerheads, if you please.\"",
      needs: [{ bring: { rawhammerhead: 10 } }], reward: { coins: 3500, xp: { construction: 2000 } } },
    { id: "lampoil", name: "Oil for the lamps", text: "\"The yard works through the night. Orca blubber keeps the lamps lit.\"",
      needs: [{ bring: { orcablubber: 10 } }], reward: { coins: 6000, xp: { construction: 3500 } } });

