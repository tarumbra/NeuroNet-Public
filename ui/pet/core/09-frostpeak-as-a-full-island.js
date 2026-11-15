  // ==== Frostpeak as a full island -- islands stage 3 (2026-10-08, Cam chose "A full island": a hunting ground and boss (a
  //      Yeti), day and night creatures (snow leopards, mountain goats, yaks; a snowy owl and wolves at night), a hidden egg,
  //      an ice-fishing spot, a person with quests, and sub-areas: the Ice Cavern and the Summit) ------------------------
  Object.assign(MONSTERS, CONTENT("more MONSTERS"));
  HUNTS.frostpeak = CONTENT("HUNTS.frostpeak");
  HUNT_ORDER.splice(HUNT_ORDER.indexOf("desert"), 0, "frostpeak");      // between the Jungle (40) and the Desert (48)
  Object.assign(SPECIES, CONTENT("more SPECIES"));
  SPECIES.leopard.colours.push("snow"); SPECIES.fox.colours.push("arctic"); SPECIES.goat.colours.push("mountain");
  Object.assign(PETS, CONTENT("more PETS"));
  Object.assign(EGGS, CONTENT("more EGGS"));
  Object.assign(FIGHT_STYLE, CONTENT("more FIGHT_STYLE"));
  Object.assign(ITEMS, CONTENT("more ITEMS"));
  Object.assign(WEAR, CONTENT("more WEAR"));
  WORKSHOPS.crafting.recipes.push({ make: "furhood", needs: { snowpelt: 4, leather: 2 }, level: 42, xp: 150 },
                                  { make: "petfurcoat", needs: { snowpelt: 5, yakhide: 2 }, level: 44, xp: 160 },
                                  { make: "furcoat", needs: { yetifur: 4, yakhide: 3, frostcrystal: 1 }, level: 48, xp: 210 });
  WORKSHOPS.kitchen.recipes.push({ make: "grilledchar", needs: { arcticchar: 1, twigs: 1 }, level: 42, xp: 38 },
                                 { make: "grilledcavefish", needs: { cavefish: 1, twigs: 1 }, level: 47, xp: 45 });
  SKILLS.fishing.spots.push(
    { id: "icehole", name: "Ice-fishing hole", area: "frostpeak", level: 42, time: 135, xp: 40, method: "bait", needs: "fishingrod", bait: "earthworm", loot: [["arcticchar", 60], ["icetrout", 40]] },
    { id: "undergroundlake", name: "Underground lake", area: "icecavern", level: 47, time: 146, xp: 46, method: "net", needs: "smallnet", loot: [["cavefish", 85], ["pondweed", 15]], rare: ["pearl", 600] });
  SKILLS.foraging.spots.push(
    { id: "snowberrybushes", name: "Snowberry bushes", area: "frostpeak", level: 42, time: 135, xp: 40, method: "pick", loot: [["snowberries", 70], ["frostlichen", 30]] });
  SKILLS.digging.spots.push(
    { id: "frozentundra", name: "Frozen tundra", area: "frostpeak", level: 44, time: 140, xp: 43.5, method: "dig", loot: [["soil", 40], ["fossil", 30], ["bones", 25], ["mammothivory", 5]], rare: ["relic", 500] });
  SKILLS.mining.spots.push(
    { id: "summitridge", name: "Summit ridge", area: "summit", level: 48, time: 150, xp: 48, method: "mine", toolTier: 4, loot: [["adamantite", 50], ["stone", 30], ["frostcrystal", 20]], rare: ["diamond", 500] },
    { id: "frostcrystals", name: "Frost-crystal formations", area: "icecavern", level: 46, time: 145, xp: 45, method: "mine", toolTier: 4, loot: [["frostcrystal", 30], ["quartz", 50], ["stone", 20]], rare: ["diamond", 700] });
  // Cam (2026-10-03): "When you beat a boss in that area 50 times, it will unlock one unique spot where
  // you can gather a special resource (skill essence of that type ...)". One per skill in every area:
  // the area's level in that skill, slow, and nothing but essence.
  var ESSENCE_WINS = 50;
  var ESSENCE_SPOTS = CONTENT("ESSENCE_SPOTS");
  GATHERING.filter(function (k) { return ESSENCE_SPOTS[k]; }).forEach(function (k) {     // (not runecrafting: its shrines are its own)
    HUNT_ORDER.forEach(function (a, i) {
      SKILLS[k].spots.push({ id: "essence-" + a, name: HUNTS[a].name + " " + ESSENCE_SPOTS[k].toLowerCase(), area: a, essence: true,
                             level: HUNTS[a].level, time: 180 + i * 30, xp: 20 + i * 15, loot: [[k + "essence", 1]] });
    });
  });
  var TIER_NAMES = CONTENT("TIER_NAMES");
  /** The tier of what you carry for a skill: -1 for nothing; stone 0, bronze 1 ... mithril 4. */
  function toolTierOf(s, skill) {
    var id = (s.player.tools || {})[skill], t = ITEMS[id];
    if (!t || !t.tool || !has(s, id)) return -1;
    return t.tool.tier == null ? 1 : t.tool.tier;
  }
  /** What a spot still needs from you: its fishing tool, its bait, a good enough pickaxe or hatchet. "" if nothing. */
  function tripNeeds(s, skill, sp) {
    if (sp.needs && !has(s, sp.needs) && !(skill === "fishing" && sp.hand)) return "The " + sp.name + " needs " + aOr(ITEMS[sp.needs].name) + " -- " + FISH_MAKER[sp.needs] + ".";
    if (sp.bait === "bloodessence" && !has(s, sp.bait)) return "The " + sp.name + " takes blood essence -- the Hollow Crypt's dead drop it.";   // (Part 13)
    if (sp.bait && skill === "runecrafting" && !has(s, sp.bait))           // (Cam, 2026-10-07: the shrines aren't fishing)
      return "The " + sp.name + " turns " + ITEMS[sp.bait].name.toLowerCase() + "s into runes -- mine them at the " +
             (sp.bait === "pureessence" ? "Pure essence vein (Crystal Caves, Mining 30)" : "Essence rocks (Meadow)") + ".";
    if (sp.bait && !has(s, sp.bait)) return "The " + sp.name + " needs " + ITEMS[sp.bait].name.toLowerCase() + "s for bait" + (sp.bait === "earthworm" ? " -- digging finds them." : " -- chickens drop them.");
    if (skill === "foraging" && sp.toolTier && toolTierOf(s, "foraging") < sp.toolTier) {
      return "The " + sp.name + " needs " + aOr(BASKET_NAMES[sp.toolTier]) + " or better -- woven at your Crafting bench.";
    }
    if (skill !== "mining" && skill !== "lumbering") return "";
    var tier = toolTierOf(s, skill), what = skill === "mining" ? "pickaxe" : "hatchet";
    if (skill === "mining" && tier < 0 && !sp.hand) {
      return "The " + sp.name + " needs a pickaxe -- make a stone one at your Crafting bench (stone and twigs: the Stone wall gives stone by hand), or smelt bronze bars at the furnace and smith one at the anvil.";
    }
    if (tier < 0) return "";                         // bare hands: stone and clay, or twigs
    var min = Math.max(sp.toolTier || 0, sp.soft ? 0 : 1);
    if (tier < min) {
      return "The " + sp.name + " needs " + aOr(TIER_NAMES[min] + " " + what) + " or better -- " +
             (min === 1 && tier === 0 ? "stone is too soft for it; " : "") + "you smith them at the anvil.";
    }
    return "";
  }

  /** A tool used once on `item` (2026-10-04). At or below its tier: no wear. Above: (grade - tier)
      of its durability. Worn out, it breaks (one of the stack); warned at three quarters and nine
      tenths so it can be mended first. The last one gone: no more ore, or only twigs. */
  // Kits and bench tools wear out too (2026-10-09, Cam: "I want to minimise reusables in the game to have more emphasis
  // on crafting"): nets, rods, cages and harpoons by the catch, chisels, needles and pots of water by the craft. Worn
  // out, one of them goes; no mending -- you make another.
  // (2026-10-10, Cam: fishing "feels slow in the lower levels") -- the fishing kits last as long as the tools of their tier
  var KIT_DUR = CONTENT("KIT_DUR");          // farming tools by the use (2026-10-09)
  // no net: the Duck pond and the Pond by hand (2026-10-10) -- slower, and only shrimp and minnows
  var HAND_FISH_SLOW = 1.5, HAND_CATCH = CONTENT("HAND_CATCH");
  function wearKit(s, job, id, at) {
    var dur = KIT_DUR[id], nm = ITEMS[id].name.toLowerCase();
    if (!dur || (s.dev && s.dev.infinite)) return;
    s.player.wear = s.player.wear || {};
    var was = s.player.wear[id] || 0, now = was + 1;
    if (now < dur) {
      s.player.wear[id] = now;
      if (was < dur * 0.9 && now >= dur * 0.9 && (s.bag[id] || 0) <= 1) note(s, at, "Your " + nm + " is wearing thin (" + (dur - now) + "/" + dur + " uses left) -- make another before it goes.");
      return;
    }
    s.player.wear[id] = 0;
    take(s, id, 1);
    var spot = job && spotOf(job.skill, job.spot), bare = job && !has(s, id) && job.skill === "fishing" && spot && spot.hand;
    note(s, at, "Your " + nm + " wore out" + (has(s, id) ? " -- you picked up a fresh one." : bare ? " -- you carry on by hand." : "."));
    if (bare) { job.byHand = true; job.every = Math.round((job.every || spot.time * 1000) * HAND_FISH_SLOW); }
    else if (job && !has(s, id)) endTrip(s, s.player, at, "broke");
  }
  function wearFor(above) { return above <= 0 ? 0 : above * (above + 1) / 2; }
  function wearTool(s, job, item, at) {
    var id = job.tool, def = ITEMS[id] && ITEMS[id].tool;
    if (!def || item === "twigs") return;
    var above = gradeOf(item, spotOf(job.skill, job.spot)) - (def.tier == null ? 1 : def.tier);
    // the further above the tool's tier, the faster it wears, and it climbs with each tier
    // (Cam, 2026-10-07): one tier above 1 a find, two 3, three 6, four 10
    // (2026-10-09, Cam: "Gathering tools always wear"): one a use at or below its tier, more above it
    var cost = def.stone ? wearFor(above) : 1 + Math.ceil(1.25 * wearFor(above));   // stone: only above its tier, as before
    s.player.wear = s.player.wear || {};
    var dur = toolDur(id), was = s.player.wear[id] || 0, now = was + cost;
    s.player.wear[id] = now;
    // nine tenths worn, and it's your last: you come home before it breaks. Mending is yours to do,
    // at the workshop (Cam, 2026-10-07: "Tools shouldnt auto repair ... Auto repair can become a tool
    // enchantment later")
    if (!def.stone && now < dur && was < dur * 0.9 && now >= dur * 0.9 && job.skill && (s.bag[id] || 0) <= 1) {
      var am = repairCost(id);
      note(s, at, "Your " + ITEMS[id].name.toLowerCase() + " is about to break (" + (dur - now) + "/" + dur + ") -- you came home before it did." +
           (am ? " Mend it at the " + WORKSHOPS[am.ws].name.toLowerCase() + " (" + itemsText(am.needs) + (am.fee ? ", " + am.fee + " coins" : "") + ")." : ""));
      endTrip(s, s.player, at, "worn");
      return;
    }
    if (!def.stone && now < dur) {
      [0.75, 0.9].forEach(function (f) {
        if (was < dur * f && now >= dur * f) {
          var rc = repairCost(id);
          note(s, at, "Your " + ITEMS[id].name.toLowerCase() + " is " + (f > 0.8 ? "about to break" : "wearing out") + " (" + (dur - now) + "/" + dur + ")"
               + (rc ? " -- mend it at the " + WORKSHOPS[rc.ws].name.toLowerCase() + " before it goes." : "."));
        }
      });
    }
    if (now < dur) return;
    s.player.wear[id] = 0;
    take(s, id, 1);
    note(s, at, "Your " + ITEMS[id].name.toLowerCase() + (def.stone ? " crumbled" : " broke") + (has(s, id) ? " -- you picked up another." : "."));
    if (has(s, id)) return;
    s.player.tools[job.skill] = null;
    if (job.skill === "lumbering") {
      job.twigsOnly = true; job.tool = "";
      note(s, at, "Your last " + ITEMS[id].name.toLowerCase() + " broke -- only twigs now, until you make another.");
      return;
    }
    if (job.skill === "mining") {
      note(s, at, "Your last " + ITEMS[id].name.toLowerCase() + " broke.");
      endTrip(s, s.player, at, "broke");
      return;
    }
    job.tool = "";                                     // a reel or a basket: on without it
  }

  /** Is this spot open to you? Your level -- and, for an essence spot, the area's boss beaten enough. */
  function spotLock(state, skill, sp) {
    if (sp.secret && !(state && state.world && state.world.found && state.world.found[sp.secret])) return "Not found yet -- explore the " + REGIONS[sp.area].name;
    var rl = REGIONS[sp.area] ? regionLock(state, sp.area) : "";      // its needs, and being on the right island
    if (rl) return rl;
    // the Open Sea (2026-10-08); the Coast's deep water and reef need a boat too (Cam, PT15: "rowboat should be a requirement for
    // fishing locations like deep ocean") -- the first one is Old Salt's
    if (sp.ship && shipTier(state) < sp.ship) return "Needs a " + SHIPS[sp.ship].name.toLowerCase() + (sp.ship === 1 ? " (Old Salt on the Coast helps you build one)" : " (the Shipyard on the Coast)");
    var lv = levelOf(((state && state.player && state.player.skills) || {})[skill] || 0);
    if (lv < sp.level) return SKILLS[skill].name + " level " + sp.level;
    if (sp.essence) {
      var wins = ((state && state.hunt && state.hunt[sp.area]) || {}).wins || 0;
      if (wins < ESSENCE_WINS) return "Beat " + MONSTERS[HUNTS[sp.area].boss].name + " " + ESSENCE_WINS + " times (" + wins + "/" + ESSENCE_WINS + ")";
    }
    return "";
  }
  var REGEN = MIN;                         // you heal 1 health a minute
  var RETREAT = 0.3;                       // ...and come home from a hunt below 30% (a setting)
  var EAT_BELOW = 0.5;                     // auto-eat your chosen food below half health (a setting)
  var AWAY = CONTENT("AWAY");     // per hour, out on an expedition
  var FURNITURE = CONTENT("FURNITURE");

  /** What a thing does, in a few words. */
  function describe(id) {
    var it = ITEMS[id];
    if (!it) return "";
    if (it.bagSize) return "A bag with " + it.bagSize + " slots, " + it.stack + " to a stack (you start with " + BAG_START + " slots, " + STACK_START + " to a stack)";
    if (it.petbrew) {                         // a pet's draught, for an expedition pack
      var pb = it.petbrew, bits = [];
      if (pb.hp) bits.push("+" + Math.round(pb.hp * 100) + "% health");
      if (pb.att) bits.push("+" + pb.att + " attack");
      if (pb.def) bits.push("+" + pb.def + " defence");
      if (pb.dodge) bits.push("+" + Math.round(pb.dodge * 100) + "% dodge");
      return "For a pet's expedition pack: " + bits.join(", ") + " for the run";
    }
    if (id === "archivekey") return "Opens the forbidden archive in your library";
    if (id === "stardust") return "From a shooting star: the enchanting table takes it instead of runes, for opals and sapphires";
    if (it.key) { var kr = REGIONS[it.key], ks = (kr.needs && kr.needs.skills) || {}; return "Opens the " + kr.name + Object.keys(ks).map(function (k) { return " (with " + SKILLS[k].name + " " + ks[k] + ")"; }).join(""); }
    if (it.rune) return "A rune: spells use it (see your spellbook)";
    if (it.hunterTool && it.hunterTool.kind === "throw") return "A Thief's throwing knife: hits for " + it.hunterTool.damage.join("-") + ", carries your poison -- picked up again half the time";
    if (it.coat) return it.coat.poison ? "Coats a blade: poisons for " + it.coat.poison[0] + " a round, " + it.coat.poison[1] + " rounds -- " + it.coat.hits + " hits" : it.coat.stun ? "Coats a blade: a hit may stun -- " + it.coat.hits + " hits" : "Coats a blade: their blows land softer -- " + it.coat.hits + " hits";
    if (it.hunterTool) { var ht = it.hunterTool, hr = ht.rounds[0] === ht.rounds[1] ? ht.rounds[0] : ht.rounds.join("-");   // traps and nets (Battle Re-work Part 4)
      return "A Hunter's " + ht.kind + ": holds a creature " + hr + " round" + (ht.rounds[1] === 1 ? "" : "s") + (ht.spring ? ", snaps for " + ht.spring.join("-") : "") +
             (ht.bleed ? ", bleeds " + ht.bleed[0] + " a round" : "") + (ht.burn ? ", burns " + ht.burn[0] + " a round" : "") + (ht.keep ? " -- picked up again " + Math.round(ht.keep * 100) + "% of the time after a win" : " -- used up") + (ht.kind === "trap" ? "; one a fight" : ""); }
    if (it.learn && it.learn.field) return "Read it to learn a field recipe -- made right in your bag";   // a recipe page (V2 step 2)
    if (it.learn) return it.learn.spell ? "Read it to learn " + SPELLS[it.learn.spell].name + " (Magic " + SPELLS[it.learn.spell].level + ")"
                                         : "Read it to learn the " + ENCHANTS[it.learn.enchant].name + " enchant (Enchanting " + ENCHANTS[it.learn.enchant].level + ") -- for the enchanting table";
    if (id === "runeessence" || id === "pureessence") return "Take it to a shrine: it becomes runes (Runecrafting)";
    if (it.unid) return "Which herb? Identify it at the Herb table (Herblore) -- it might need a higher level";
    if (it.tool && it.tool.wear) {
      return it.tool.skill === "mining" ? "Mines copper and tin (and stone and clay) -- one pickaxe is used up by each copper or tin ore"
        : "Cuts the softest trees (apple, hedge, copse) -- lasts " + it.tool.wear.uses + " logs";
    }
    if (it.tool && it.tool.stone) return it.tool.skill === "mining" ? "Mines copper and tin -- crumbles after " + toolDur(id) + " of them (stone, clay and flint don't wear it)"
                                        : "Cuts proper logs -- crumbles after " + toolDur(id) + " of them (twigs don't wear it)";   // (2026-10-10)
    if (it.tool) return SKILLS[it.tool.skill].name + " " + Math.round((1 - it.tool.speed) * 100) + "% faster" + (it.tool.level > 1 ? " (level " + it.tool.level + ")" : "")
      + (it.tool.skill === "mining" && it.tool.tier >= 3 ? " -- strong enough for " + (it.tool.tier === 3 ? "adamantite" : "runite") + (it.tool.tier >= 5 ? ", and wears " + (it.tool.tier >= 6 ? "on nothing" : "slowly on runite") : "") : "")
      + (it.tool.skill === "lumbering" && it.tool.tier >= 3 ? " -- strong enough for the magic tree" : "");
    if (it.brew) return brewText(it.brew);
    if (it.heal && !it.food) return "Heals you " + it.heal + " (eat it, or pick it in your hunt plan to eat between fights)";
    if (it.ageUp) return "Grows a hatchling up at once: old enough for expeditions (" + (EXPEDITION_AGE / DAY) + " days)" + (it.food ? " -- and a good meal" : "");
    if (it.potion) return it.potion.cure ? "Health +" + it.potion.health + ", cures illness" : it.potion.energy ? "Energy +" + it.potion.energy : "Fun +" + it.potion.happy;
    if (it.kit === "fishing") return "A fishing tool -- wears out after " + KIT_DUR[id].toLocaleString() + " catches" + (FISH_BAIT[id] ? " -- " + FISH_BAIT[id] : "");
    if (id === "chisel") return "For cutting rough gems at the gem bench -- wears out after " + KIT_DUR.chisel + " cuts";
    if (id === "potofwater") return "Cools a gem as you cut it -- used up by most cuts; quartz and amethyst wear it out after " + KIT_DUR.potofwater;
    if (it.kit) return id === "needle" ? "The tailor sews with it -- wears out after " + KIT_DUR.needle + " uses" : "A farming tool -- wears out after " + (KIT_DUR[id] || 100) + " uses";
    if (id === "claypot") return "Fill it at your Crafting bench: a pot of water, for cutting gems";
    if (id === "oldcoin") return "Old money -- the merchant pays well for it";
    if (id === "steel" || id === "mithrilbar") return "Smith " + (id === "steel" ? "steel" : "mithril") + " tools, armour and swords from it at the anvil";
    if (["opal", "jade", "topaz", "sapphire", "emerald", "ruby", "diamond"].indexOf(id) >= 0) return "A cut gem -- set it into a ring or a necklace at the gem bench";
    if (id === "roughgem") return "Cut it at the gem bench (a chisel and a pot of water)";
    if (/bar$/.test(id) || id === "steel") return "Smelted at the furnace -- smith it at the anvil";
    if (id === "exoticegg") return "From far away -- rare, special and now and then legendary pets hatch from it";
    if (id === "needle") return "Used up by each thing you sew -- knitting wears it out after " + KIT_DUR.needle + " uses";
    if (it.seed) return "Plant it on the farm (Farming " + CROPS[it.seed].level + ")";
    if (it.fert) return "On a growing crop: the rest of its growing " + Math.round((1 - it.fert) * 100) + "% quicker";
    if (it.herbseed) return "Plant it in a pot on the farm's windowsill (Farming " + HERBS[it.herbseed].level + ")";
    if (HERBS[id]) return "A herb from your pots -- the kitchen cooks and brews with it";
    if (id === "bowl" || id === "mug" || id === "piedish") return "The kitchen bakes pies (pie dish), serves stews (bowl) and teas (mug) in it";
    if (id === "plantpot") return "Set it on the farm's windowsill and grow herbs in it";
    if (it.essence) return "The essence of " + SKILLS[it.essence].name + " -- the gem bench enchants an amulet of " + SKILLS[it.essence].name.toLowerCase() + " with it";
    if (id === "dung") return "The compost bin turns it into fertiliser";
    if (id === "flint") return "Knapped into arrowheads with a chisel, right in your bag (a Hunter from Ranged 3, or the knapper's page)";   // (I11)
    if (it.frag) return "5 make " + aOr(ITEMS[it.frag].name);
    if (it.food) return "Food +" + it.food.full + (it.food.happy ? " · Fun +" + it.food.happy : "") + (it.heal ? " · heals you " + it.heal : "");
    if (it.gear) {
      var g = it.gear, bits = [];
      if (g.xp) bits.push("+" + Math.round(g.xp * 100) + "% gathering xp");
      if (g.boost) bits.push(SKILLS[g.boost.skill].name + ": +" + Math.round(g.boost.xp * 100) + "% xp, " + Math.round((1 - g.boost.speed) * 100) + "% faster");
      if (g.speed) bits.push("finds " + Math.round((1 - g.speed) * 100) + "% faster");
      if (g.rare) bits.push("rare finds twice as likely");
      if (g.success) bits.push("+" + Math.round(g.success * 100) + "% expedition success");
      if (g.expXp) bits.push("+" + Math.round(g.expXp * 100) + "% expedition xp");
      if (g.att) bits.push("+" + g.att + (g.slot === "weapon" ? " attack" : " melee attack"));   // armour's Attack: melee only (V17)
      if (g.def) bits.push("+" + g.def + " defence");
      if (g.trueStrike) bits.push("creatures dodge " + Math.round(g.trueStrike * 100) + "% less");
      if (g.brace) bits.push(Math.round(g.brace * 100) + "% less damage taken");
      if (g.dodge) bits.push("you dodge " + Math.round(g.dodge * 100) + "% of hits");
      if (g.regen) bits.push("heals you " + g.regen + " after each fight");
      if (g.quiver) bits.push("holds " + g.quiver.cap + " arrows or bolts a hunt, up to " + ["your own (improvised, bone, flint)", "bronze", "iron", "steel", "mithril", "adamant", "rune"][g.quiver.tier]);   // a quiver (Part 10)
      if (g.maxHit) bits.push("+" + g.maxHit + " max hit");
      if (g.reflect) bits.push("reflects " + Math.round(g.reflect * 100) + "% of damage");
      if (g.acc) bits.push("+" + Math.round(g.acc * 100) + "% accuracy");
      if (g.stun) bits.push(Math.round(g.stun * 100) + "% chance to stun");
      if (g.double) bits.push(Math.round(g.double * 100) + "% chance of a second " + (g.style === "melee" ? "hit" : "shot"));
      if (g.soak) bits.push("a hard shell: " + g.soak + " off every blow (the whole set: 1)");
      if (g.rng) bits.push("+" + g.rng + " ranged");
      if (g.style === "ranged") bits.push("shoots " + g.ammo + "s");
      if (typeof g.power === "number") bits.push(g.ammo + ", power " + g.power + " (one per fight)");
      if (g.cls) bits.push(clsPlural(g.cls) + " only");
      if (weightOf(id)) bits.push(weightText(id));                       // its weight (V17)
      if (g.style === "magic") bits.push(g.element ? "casts spells -- its " + g.element + " runes are free" : "casts spells");
      if (g.mag) bits.push("+" + g.mag + " magic accuracy");
      if (g.magDmg) bits.push("+" + g.magDmg + " spell damage");
      if (g.req) Object.keys(g.req).forEach(function (k) { bits.push(k === "pet" ? "pet level " + g.req.pet : k === "rank" ? MAGE_RANKS[g.req.rank].name + " rank" : SKILLS[k].name + " " + g.req[k]); });
      var t = bits.join(", ");
      return SLOT_NAMES[g.slot] + (g.who === "pet" ? " (pet)" : "") + ": " + t;
    }
    if (it.furniture === "rug" && it.cleaner) return it.name + ": stays clean " + Math.round(it.cleaner * 100) + "% longer";   // woven 25%, floral 30%
    if (it.furniture) return FURNITURE[it.furniture];
    if (it.crate) return "Open it to see what's inside";
    if (it.egg) return "Hatches in " + Math.round(EGGS[it.egg].hatch / MIN) + " minutes -- when there's room for another pet";
    return "";
  }

  // the companion's gift: a bunny forages, a frog fishes, a cat climbs trees. Every kind has one
  // (balance audit 2026-10-05): a gathering or making skill's xp +10% (+20% while happy), or in
  // a fight Attack, Ranged or Defence +2 (+4) or max hit +1 (+2)
  var BOOSTS = CONTENT("BOOSTS");
  var FIGHT_BOOSTS = CONTENT("FIGHT_BOOSTS");
  /** What a kind of pet does for you as your companion, in words. */
  function boostText(species) {
    return petBuffs(species).map(function (b) {
      var k = b.skill, x = Math.round(b.amount * 10);
      if (FIGHT_BOOSTS[k]) return FIGHT_BOOSTS[k] + (k === "maxhit" ? " +" + x + " (+" + 2 * x + " while happy)" : " +" + 2 * x + " (+" + 4 * x + " while happy)") + " in a fight";
      return "+" + Math.round(b.amount * 100) + "% " + SKILLS[k].name + " xp (+" + Math.round(b.amount * 200) + "% while happy)";
    }).join("; ");
  }

  // RuneScape's curve: XP[L] is the experience level L needs.
  // (2026-10-09, Cam: "i breezed through the levels ... increase the xp needed for each level a little") -- half as much
  // again for every level (XP_CURVE). An old save's xp is scaled up once (normal()), so no one loses a level.
  var XP = [0, 0], XP_CURVE = 1.5;
  (function () {
    var pts = 0;
    for (var l = 1; l < 99; l++) { pts += Math.floor(l + 300 * Math.pow(2, l / 7)); XP.push(Math.floor(pts / 4 * XP_CURVE)); }
  })();
  // the novice bonus (2026-10-10 audit, MATH-4: a level-1 action gave ~0.33 xp, so level 10 took 3-5 h a skill, against
  // ~20-30 min in RuneScape) -- by the skill's OWN level, so a new skill always starts quick: x2 to 10, x1.5 to 15, x1.25
  // to 20. Levels 1-20 are ~6% of the xp to 50, so the long game barely moves. Quest and order rewards don't get it.
  // Longer (2026-10-13, Cam: "the early game grind can get quite tedious" -- and "dont call it that in the game, keep it as a
  // backend feature not one displayed"): x2 to 15, x1.75 to 20, x1.5 to 25, x1.25 to 30. Level 30 comes ~a quarter sooner
  // (about 18 h a gathering skill, was 23 h); level 50 only ~4% sooner. Nothing on screen names it.
  var NOVICE = CONTENT("NOVICE");
  function noviceMult(lv) { for (var i = 0; i < NOVICE.length; i++) if (lv <= NOVICE[i][0]) return NOVICE[i][1]; return 1; }
  function levelOf(xp) {
    var l = 1;
    while (l < MAX_LEVEL && xp >= XP[l + 1]) l++;
    return l;
  }
  // spots renamed since a trip set off there (the Quarry became Copper rocks and Tin rocks)
  var MOVED_SPOTS = CONTENT("MOVED_SPOTS");
  function spotOf(skill, id) {
    if (skill === "larceny") return marketTarget(id);                   // a stealing trip: a market stall or a mark (2026-10-17)
    var sk = SKILLS[skill];
    if (!sk) return null;
    id = (MOVED_SPOTS[skill] || {})[id] || id;
    for (var i = 0; i < sk.spots.length; i++) if (sk.spots[i].id === id) return sk.spots[i];
    return null;
  }

  // one stream of chance per trip (mulberry32), kept in the trip, so a trip
  // finds the same things however often it is looked at
  function rnd(job) {
    job.seed = (job.seed + 0x6D2B79F5) | 0;
    var t = job.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** The companion's boost to a skill right now (0, 0.1 or 0.2). */
