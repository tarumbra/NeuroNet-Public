  // ---- the farm (2026-10-03) --------------------------------------------------------------
  // Cam: "a farm to the village where you go to plant seeds, water them (tool from farmer,
  // hoe, rake) Rake to remove weeds which go in bag and weed gathered depends on plant just
  // harvested, hoe tills the land, then plant seed and select which seed to grow, this
  // should actively grow ... at the start we can only have 1 plot but as farming skill goes
  // up we can provide farmer with materials to unlock a new plot (Soil...)". A crop grows
  // in four stages; each stage needs watering -- a dry plant waits, thirsty, until it is.
  var CROPS = CONTENT("CROPS");
  var CROP_ORDER = CONTENT("CROP_ORDER");
  var PLOT_UNLOCKS = CONTENT("PLOT_UNLOCKS");   // plots 2..6
  // herbs in pots (2026-10-03): a plant pot from your Crafting, a herb seed from foraging; no
  // watering -- they grow on the windowsill by the farm, and the pot is kept
  // Herb tiers (2026-10-06, Cam: "Herblore skill can be used to catalog unidentifed herbs which can be
  // found from digging, foraging, planted in herb pots ... The encounter rate depends on the level of the
  // area and your level in that skill"). Each tier is a pool: identifying tells you which you've got.
  var HERB_TIERS = CONTENT("HERB_TIERS");
  var HERB_TIER_OF = {};
  HERB_TIERS.forEach(function (t) { t.pool.forEach(function (h) { HERB_TIER_OF[h[0]] = t.tier; }); });
  var ALL_HERBS = Object.keys(HERB_TIER_OF);
  function herbariumView(state) {
    var hb = herbarium(state), lv = levelOf(((state && state.player) || {}).skills ? state.player.skills.herblore || 0 : 0), bag = (state && state.bag) || {};
    var usedIn = {};
    WORKSHOPS.apothecary.recipes.forEach(function (r) { Object.keys(r.needs).forEach(function (k) { if (HERB_TIER_OF[k]) (usedIn[k] = usedIn[k] || []).push(ITEMS[r.make].name); }); });
    return { level: lv, master: masterHerbalist(state), found: ALL_HERBS.filter(function (h) { return hb[h] > 0; }).length, total: ALL_HERBS.length,
      unid: bag.unidherb || 0,
      tiers: HERB_TIERS.map(function (t) { return { tier: t.tier, level: t.level, xp: t.xp, open: lv >= t.level,
        double: doubleChance(state, t.tier, lv), complete: tierComplete(state, t.tier), where: herbWhere(t.tier),
        herbs: t.pool.map(function (h) { return { id: h[0], name: ITEMS[h[0]].name, known: hb[h[0]] > 0, count: hb[h[0]] || 0, uses: hb[h[0]] > 0 ? usedIn[h[0]] || [] : [] }; }) }; }) };
  }
  // where a tier's herbs turn up: wild spots that grow them, the pots, and anywhere with luck
  function herbWhere(tier) {
    var out = [], lv = HERB_TIERS[tier - 1].level;
    ["foraging", "digging"].forEach(function (k) {
      (SKILLS[k].spots || []).forEach(function (sp) {
        if ((sp.loot || []).some(function (l) { return HERB_TIER_OF[l[0]] === tier; })) out.push(sp.name + " (" + SKILLS[k].name + " " + sp.level + ")");
      });
    });
    Object.keys(HERBS).forEach(function (h) { if (HERB_TIER_OF[h] === tier) out.push(HERBS[h].name + " in a herb pot (Farming " + HERBS[h].level + ")"); });
    out.push("most often at spots and expeditions of level " + Math.max(1, lv - 5) + "–" + (lv + 14) + ", rarely anywhere");
    return out;
  }
  /** Which herb a wild find is: tiers near the place's difficulty, now and then any (2026-10-07). */
  function rollHerb(job, level) {
    var c = 1 + (level || 1) / 12.5, w = HERB_TIERS.map(function (t) { return [t.tier, Math.pow(0.25, Math.abs(t.tier - c))]; });
    var tier = pick(job, w);
    return pick(job, HERB_TIERS[tier - 1].pool);
  }
  /** A herb found in the wild: half the time the place's own herb, otherwise one by its difficulty. */
  function wildHerb(job, herb, level) { return rnd(job) < 0.5 ? herb : rollHerb(job, level); }
  /** Into the bag as an unidentified herb -- which one, the game keeps to itself. */
  function addUnidRaw(s, herb) { s.unid = s.unid || {}; s.unid[herb] = (s.unid[herb] || 0) + 1; s.bag.unidherb = (s.bag.unidherb || 0) + 1; }
  function addUnid(s, herb, n) {
    n = n || 1;
    if (!roomFor(s, "unidherb")) { s.lost = s.lost || {}; s.lost.unidherb = (s.lost.unidherb || 0) + n; return 0; }
    var fit = Math.min(n, stackRoom(s, "unidherb"));
    if (fit < n) { s.lost = s.lost || {}; s.lost.unidherb = (s.lost.unidherb || 0) + n - fit; }
    if (fit <= 0) return 0;
    n = fit;
    s.unid = s.unid || {};
    s.unid[herb] = (s.unid[herb] || 0) + n;
    s.bag.unidherb = (s.bag.unidherb || 0) + n;
    return n;
  }
  /** Things found, into the bag: "unidherb" stands for the hidden herbs in `herbs`. */
  function giveFound(s, got, herbs) {
    Object.keys(got).forEach(function (k) {
      if (k === "unidherb" && herbs) Object.keys(herbs).forEach(function (h) { addUnid(s, h, herbs[h]); });
      else give(s, k, got[k]);
    });
  }
  function herbarium(s) { return (s && s.herbarium) || {}; }
  function tierComplete(s, tier) { return HERB_TIERS[tier - 1].pool.every(function (h) { return herbarium(s)[h[0]] > 0; }); }
  function masterHerbalist(s) { return ALL_HERBS.every(function (h) { return herbarium(s)[h] > 0; }); }
  /** The chance a gathering find also turns up an unidentified herb: more in higher areas, more as you grow. */
  function herbChance(skillLevel, spotLevel) {
    return Math.min(0.12, 0.03 + 0.0015 * spotLevel + 0.002 * Math.max(0, skillLevel - spotLevel));
  }
  /** Which tier a spot of this level gives: mostly its own tier, sometimes the ones below. */
  function herbTierAt(spotLevel, r) { return HERB_TIER_OF[rollHerb({ seed: Math.floor(r * 4294967296) | 0 }, spotLevel)]; }

  /** A chance of two from one (careful cleaning), more above the tier's level, and with the tier catalogued. */
  function doubleChance(s, tier, level) {
    return Math.round((Math.min(0.2, 0.004 * Math.max(0, level - HERB_TIERS[tier - 1].level)) + (tierComplete(s, tier) ? 0.1 : 0)) * 1000) / 1000;
  }
  var HERBS = CONTENT("HERBS");
  var HERB_ORDER = CONTENT("HERB_ORDER");
  var MAX_POTS = 6;
  var HATCHERY_SLOTS = 2;
  function newPlot() { return { state: "weedy", weed: "couchgrass", crop: "", stage: 0, stageAt: 0, watered: false }; }
  // every skill in the registry (01-a) has its entry in the skills table: name and verb from the registry, spots from its
  // content (the gathering parts fill theirs in). The crafters' skills became yours on 2026-10-04; the Arcane class
  // (2026-10-07: Magic, Runecrafting, Enchanting) and Construction (your house) came later.
  SKILL_REG.forEach(function (k) {
    if (SKILLS[k.id]) { SKILLS[k.id].name = k.name; SKILLS[k.id].verb = k.verb; }
    else SKILLS[k.id] = { name: k.name, verb: k.verb, spots: [] };
  });
  // runecrafting is a trip like gathering: each essence stone you carry becomes a handful of runes at a shrine
  var RUNE_SHRINES = CONTENT("RUNE_SHRINES");
  SKILLS.runecrafting.spots = (function () { return RUNE_SHRINES.map(function (r) {
    return { id: r[0] + "shrine", name: r[1] + " shrine", area: r[2], level: r[3], time: 25 + r[3], xp: 4 + Math.round(r[3] * 0.9), method: "craft", bait: r[5],
             yield: r[4], loot: [[r[0] + "rune", 100]] }; }); })();     // the Apothecary table (2026-10-06)
  // battle (2026-10-03): "Player will also get a health bar ... From here player battle stats will be added"
  var COMBAT = CONTENT("COMBAT");        // the fighting stats (not Magic, which casts)
  var SKILL_ORDER = SKILL_REG.map(function (k) { return k.id; });                                 // from the registry
  var GATHERING = SKILL_REG.filter(function (k) { return k.trips; }).map(function (k) { return k.id; });
  // what bare hands can't take out of a rock
  var ORE = CONTENT("ORE");

  // The village (the brief: "The village starts with NPCs who fill these roles
  // as a blacksmith, jeweler, apothacery, carpenter"). They make things from
  // what you bring; the kitchen is yours, and Cooking is your skill.
  var WORKSHOPS = CONTENT("WORKSHOPS");
  var WORKSHOP_ORDER = CONTENT("WORKSHOP_ORDER");

  // Crafters level up (Cam, 2026-10-03): "every crafter NPC should also have a skill level
  // associated and the more i get them to craft an item the more their level increases the
  // higher tier stuff i can make." The level each of their makings needs -- 1 unless said:
  // bronze up to 5, bone (one above bronze) 6-9, iron 10+. (The kitchen is yours: Cooking.)
  var CRAFT_LEVELS = CONTENT("CRAFT_LEVELS");
  WORKSHOP_ORDER.forEach(function (k) {
    if (WORKSHOPS[k].skill) return;
    WORKSHOPS[k].recipes.forEach(function (r) { r.tier = CRAFT_LEVELS[r.make] || 1; });
  });

