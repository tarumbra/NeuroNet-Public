  // ---- leathers for class building (2026-10-04) ------------------------------------------------
  // Roles (balance audit 2026-10-05): metal is the all-rounder -- solid Defence for its tier and gathering xp;
  // boss sets are side-grades -- a little less Defence than metal at their level, plus their effect; class
  // leathers are the best pick for their own class (Defence, and the class bonus on top); cloth and soft
  // leather are light -- you gather a little quicker in them.
  // Hard leather for anyone; snake leather helps a Hunter, armadillo a Berserker, bat leather the Arcane
  // (when it opens): anyone may wear them, but the class it suits gets more from each piece (`clsBonus`).
  // Tanned at the tanner, sewn at your Crafting bench (a needle each, used up).
  var LEATHER_SETS = CONTENT("LEATHER_SETS");
  var LEATHER_SLOTS = CONTENT("LEATHER_SLOTS");
  var LEATHER_WEAR = {};
  LEATHER_SETS.forEach(function (L) {
    LEATHER_SLOTS.forEach(function (sl, i) {
      var id = L[1] + sl[1], g = { who: "player", slot: sl[0], def: L[3][i] };
      Object.keys(L[6]).forEach(function (k) { g[k] = L[6][k]; });
      if (L[7]) g.clsBonus = copy(L[7]);
      ITEMS[id] = { name: L[2][i], gem: ITEMS[L[0]].gem + (i === 1 ? 1 : 0), gear: g };
      LEATHER_WEAR[id] = copy(L[4]);
      var needs = {}; needs[L[0]] = sl[2]; needs.thread = sl[3]; needs.needle = 1;
      WORKSHOPS.crafting.recipes.push({ make: id, needs: needs, level: L[5] + i, xp: Math.round(craftXp({ make: id }) * 1.5) });
    });
  });
  WORKSHOPS.tanner.recipes.push(
    { make: "hardleather", needs: { cowhide: 1 }, level: 15, xp: 18, fee: 12 },
    { make: "snakeleather", needs: { snakeskin: 1 }, level: 25, xp: 25, fee: 15 },
    { make: "batleather", needs: { batwing: 2 }, level: 25, xp: 25, fee: 15 },
    { make: "armadilloleather", needs: { armadillohide: 1 }, level: 32, xp: 32, fee: 20 },
    { make: "tigerleather", needs: { bigcatpelt: 1 }, level: 35, xp: 35, fee: 25 },       // C8 (2026-10-20): Light armour to Defence 30 and 40
    { make: "frostleather", needs: { snowpelt: 1 }, level: 42, xp: 42, fee: 30 });
  // Herblore to 50 (balance audit 2026-10-05): your own potions
  WORKSHOPS.herblore.recipes.push(
    { make: "minorhealing", needs: { herb:  3,  mint:  1 }, level: 8, xp: 22 },
    { make: "attackpotion", needs: { herb:  4,  rosemary:  2 }, level: 10, xp: 30 },
    { make: "gatherdraught", needs: { mint:  2,  flower:  2,  honeycomb:  1 }, level: 13, xp: 38 },
    { make: "defencepotion", needs: { herb:  4,  thyme:  2,  moss:  1 }, level: 16, xp: 44 },
    { make: "rangingpotion", needs: { herb:  4,  chamomile:  2,  seaweed:  2 }, level: 19, xp: 50 },
    { make: "healingpotion", needs: { herb:  4,  lavender:  2,  honeycomb:  1 }, level: 22, xp: 58 },
    { make: "strengthpotion", needs: { herb:  4,  ginseng:  2 }, level: 25, xp: 66 },
    { make: "superdraught", needs: { ginseng:  2,  honeycomb:  2,  lavender:  1 }, level: 28, xp: 76 },
    { make: "fortunedraught", needs: { glowcap:  3,  flower:  2 }, level: 31, xp: 84 },
    { make: "superattack", needs: { truffle:  1,  rosemary:  3,  ginseng:  1 }, level: 34, xp: 94 },
    { make: "superdefence", needs: { truffle:  1,  thyme:  3,  moss:  2 }, level: 37, xp: 104 },
    { make: "superhealing", needs: { orchid:  2,  lavender:  2,  honeycomb:  2 }, level: 40, xp: 114 },
    { make: "superranging", needs: { orchid:  2,  chamomile:  3,  seaweed:  2 }, level: 43, xp: 126 },
    { make: "superstrength", needs: { saffron:  1,  ginseng:  2,  vanilla:  1 }, level: 46, xp: 140 },
    { make: "isleelixir", needs: { saffron:  2,  vanilla:  1,  truffle:  1,  royaljelly:  1 }, level: 50, xp: 170 });
  // Farming to 50 (balance audit 2026-10-05): the steel can, flax bowstrings, the new crops in the kitchen
  WORKSHOPS.anvil.recipes.push({ make: "steelwateringcan", needs: { steel: 3 }, level: 22, xp: 40, fee: 9 });
  WORKSHOPS.anvil.recipes.push({ make: "machete", needs: { mithrilbar: 2, leather: 1 }, level: 35, xp: 120, fee: 12 });   // the way into the Deep Jungle
  WORKSHOPS.anvil.recipes.push({ make: "lantern", needs: { ironbar: 2, quartz: 1 }, level: 25, xp: 80, fee: 6 });          // ... the Crystal Caves
  WORKSHOPS.crafting.recipes.push({ make: "climbinggear", needs: { rope: 3, steel: 2, leather: 2 }, level: 30, xp: 110 });   // ... Frostpeak
  WORKSHOPS.kitchen.recipes.push(
    { make: "cabbagesoup", needs: { cabbage: 2, herb: 1 }, level: 25, xp: 52 },
    { make: "cornchowder", needs: { sweetcorn: 2, goatmilk: 1 }, level: 30, xp: 64 },
    { make: "dragonfruittart", needs: { dragonfruit: 2, piedish: 1 }, level: 42, xp: 90 },
    { make: "starfruitpie", needs: { starfruit: 2, chickenegg: 1, piedish: 1 }, level: 48, xp: 110 });
  // uses for what could only be sold (balance audit 2026-10-05)
  WORKSHOPS.tanner.recipes.push(
    { make: "leather", n: 2, needs: { foxpelt: 1 }, level: 5, xp: 12, fee: 4 },
    { make: "hardleather", needs: { wolfpelt: 1 }, level: 15, xp: 20, fee: 10 },
    { make: "leather", n: 3, needs: { sealskin: 1 }, level: 20, xp: 24, fee: 8 },
    { make: "hardleather", n: 2, needs: { bearpelt: 1 }, level: 22, xp: 32, fee: 18 },
    { make: "hardleather", n: 3, needs: { bigcatpelt: 1 }, level: 30, xp: 40, fee: 24 });
  // The spinning wheel (Cam, 2026-10-05: "add a spinning wheel ... spin flax into bow strings, wool
  // in balls of wool ... look at how runescape does it ... if you find flax is too easy then have it
  // mix with sap"). RuneScape: wool -> ball of wool at Crafting 1, flax -> bow string at 10. Flax is
  // picked in a field here as there, so a string takes sap as well to keep it from being free.
  WORKSHOPS.spinning = CONTENT("WORKSHOPS.spinning");
  WORKSHOP_ORDER.splice(WORKSHOP_ORDER.indexOf("crafting") + 1, 0, "spinning");
  WORKSHOPS.sawbench = CONTENT("WORKSHOPS.sawbench");
  WORKSHOP_ORDER.splice(WORKSHOP_ORDER.indexOf("spinning") + 1, 0, "sawbench");
  // the library's magic (2026-10-07): the enchanting table makes wands, staffs, hats and cloaks (gems in them);
  // the altar puts enchants on things (only the ones you've learnt from a tome)
  // (Cam, 2026-10-07: "Enchanting table needs to swap with alter. Alter is used to make wizardry equipment wands,
  //  staves, hats etc. Enchanting table is for enchanting tools, equipment, pet equipment, items etc.")
  WORKSHOPS.altar = CONTENT("WORKSHOPS.altar");
  WORKSHOPS.enchanting = CONTENT("WORKSHOPS.enchanting");
  WORKSHOP_ORDER.splice(WORKSHOP_ORDER.indexOf("gemology") + 1, 0, "enchanting", "altar");
  // (Cam, 2026-10-07: "Quartz cutting is missing from gem table") -- quartz and amethyst cut here too, like the others
  WORKSHOPS.gemology.recipes.unshift({ make: "quartz", needs: { roughgem: 1 }, uses: ["chisel", "potofwater"], level: 1, xp: 10, n: 2 },
                                     { make: "amethyst", needs: { roughgem: 1 }, uses: ["chisel", "potofwater"], level: 3, xp: 15 });
  // knitting at your bench: a rug and warm things for your pet
  WORKSHOPS.crafting.recipes.push(
    { make: "rug", needs: { ballofwool: 4 }, level: 4, xp: 14 },
    { make: "bobblehat", needs: { ballofwool: 2 }, uses: ["needle"], level: 6, xp: 12 },
    { make: "woollyjumper", needs: { ballofwool: 4 }, uses: ["needle"], level: 9, xp: 20 });
  WORKSHOPS.fletching.recipes.push(
    { make: "feather", n: 5, needs: { quill: 1 }, level: 5, xp: 6 },
    { make: "arrowshaft", n: 10, needs: { applewood: 1 }, level: 1, xp: 5 },
    { make: "arrowshaft", n: 15, needs: { ash: 1 }, level: 12, xp: 10 },
    { make: "arrowshaft", n: 15, needs: { driftwood: 1 }, level: 15, xp: 11 },
    { make: "arrowshaft", n: 20, needs: { pine: 1 }, level: 22, xp: 16 });
  // bow strings are spun from flax at the spinning wheel, never sewn from thread here (Cam, 2026-10-09)
  WORKSHOPS.furnace.recipes.push(
    { make: "goldbar", needs: { goldnugget: 2 }, level: 20, xp: 20, fee: 4 },
    { make: "adamantbar", needs: { adamantite: 1, coal: 3, sulphur: 1 }, level: 40, xp: 60, fee: 7 },
    { make: "runebar", needs: { runite: 1, coal: 4, sulphur: 2 }, level: 48, xp: 80, fee: 9 });
  WORKSHOPS.compost.recipes.push(
    { make: "fertiliser", needs: { pondweed: 4, dung: 1 }, level: 5, xp: 10 },
    { make: "fertiliser", needs: { chalk: 2, dung: 2 }, level: 8, xp: 12 },
    { make: "richfertiliser", needs: { peat: 2, dung: 2 }, level: 20, xp: 22 });
  WORKSHOPS.gemology.recipes.push(
    { make: "quartzring", needs: { quartz: 3, silverbar: 1 }, level: 20, xp: 40 },
    { make: "obsidiannecklace", needs: { obsidian: 3, goldbar: 1 }, level: 40, xp: 80 },
    { make: "foragingamulet", needs: { foragingessence: 10, goldbar: 1, sapphire: 1 }, level: 32, xp: 90 },
    { make: "fishingamulet", needs: { fishingessence: 10, goldbar: 1, sapphire: 1 }, level: 32, xp: 90 },
    { make: "miningamulet", needs: { miningessence: 10, goldbar: 1, sapphire: 1 }, level: 32, xp: 90 },
    { make: "lumberingamulet", needs: { lumberingessence: 10, goldbar: 1, sapphire: 1 }, level: 32, xp: 90 },
    { make: "diggingamulet", needs: { diggingessence: 10, goldbar: 1, sapphire: 1 }, level: 32, xp: 90 });
  // a Hunter's road to 50 (balance audit 2026-10-05)
  WORKSHOPS.anvil.recipes.push(
    { make: "steelarrowheads", n: 10, needs: { steel: 1 }, level: 22, xp: 18, fee: 3 },
    { make: "mithrilarrowheads", n: 10, needs: { mithrilbar: 1 }, level: 32, xp: 30, fee: 5 },
    { make: "adamantarrowheads", n: 10, needs: { adamantbar: 1 }, level: 42, xp: 40, fee: 7 },
    { make: "adamantpick", needs: { adamantbar: 3, teak: 2 }, level: 40, xp: 96, fee: 21 },
    { make: "adamanthatchet", needs: { adamantbar: 3, teak: 2 }, level: 40, xp: 96, fee: 21 },
    { make: "adamanthelm", needs: { adamantbar: 2 }, level: 40, xp: 64, fee: 14 },
    { make: "adamantplate", needs: { adamantbar: 5 }, level: 43, xp: 160, fee: 35 },
    { make: "adamantgloves", needs: { adamantbar: 2 }, level: 41, xp: 64, fee: 14 },
    { make: "adamantlegs", needs: { adamantbar: 3 }, level: 42, xp: 96, fee: 21 },
    { make: "adamantboots", needs: { adamantbar: 2 }, level: 40, xp: 64, fee: 14 },
    { make: "adamantsword", needs: { adamantbar: 3, teak: 1 }, level: 42, xp: 96, fee: 21 },
    { make: "runepick", needs: { runebar: 3, mahogany: 2 }, level: 48, xp: 120, fee: 27 },
    { make: "runehatchet", needs: { runebar: 3, mahogany: 2 }, level: 48, xp: 120, fee: 27 },
    { make: "runehelm", needs: { runebar: 2 }, level: 48, xp: 80, fee: 18 },
    { make: "runeplate", needs: { runebar: 5 }, level: 50, xp: 200, fee: 45 },
    { make: "runegloves", needs: { runebar: 2 }, level: 49, xp: 80, fee: 18 },
    { make: "runelegs", needs: { runebar: 3 }, level: 50, xp: 120, fee: 27 },
    { make: "runeboots", needs: { runebar: 2 }, level: 48, xp: 80, fee: 18 },
    { make: "runesword", needs: { runebar: 3, mahogany: 1 }, level: 50, xp: 120, fee: 27 },
    { make: "runearrowheads", n: 10, needs: { runebar: 1 }, level: 49, xp: 50, fee: 9 },
    // reels past iron and a digging line (balance audit 2026-10-05: Fishing and Digging ran at base speed)
    { make: "bronzetrowel", needs: { bronzebar: 1, twigs: 2 }, level: 1, xp: 12, fee: 1 },
    { make: "irontrowel", needs: { ironbar: 1, oak: 1 }, level: 10, xp: 20, fee: 2 },
    { make: "steelrod", needs: { steel: 2, willow: 2 }, level: 20, xp: 50, fee: 6 },
    { make: "steelspade", needs: { steel: 2, oak: 2 }, level: 20, xp: 50, fee: 6 },
    { make: "mithrilrod", needs: { mithrilbar: 2, maple: 2 }, level: 30, xp: 70, fee: 10 },
    { make: "mithrilspade", needs: { mithrilbar: 2, willow: 2 }, level: 30, xp: 70, fee: 10 },
    { make: "adamantrod", needs: { adamantbar: 2, teak: 2 }, level: 40, xp: 70, fee: 14 },
    { make: "adamantspade", needs: { adamantbar: 2, teak: 2 }, level: 40, xp: 70, fee: 14 },
    { make: "runerod", needs: { runebar: 2, mahogany: 2 }, level: 48, xp: 90, fee: 18 },
    { make: "runespade", needs: { runebar: 2, mahogany: 2 }, level: 48, xp: 90, fee: 18 });
  WORKSHOPS.fletching.recipes.push(
    { make: "steelcrossbow", needs: { crossbowstock: 1, crossbowstring: 1, steel: 2 }, level: 25, xp: 40 },
    { make: "steelarrow", n: 10, needs: { arrowshaft: 10, steelarrowheads: 10, feather: 10 }, level: 27, xp: 45 },
    { make: "steelbolt", n: 10, needs: { arrowshaft: 5, steelarrowheads: 10 }, level: 29, xp: 45 },
    { make: "yewbow", needs: { yew: 3, bowstring: 1 }, level: 33, xp: 60 },
    { make: "mithrilcrossbow", needs: { crossbowstock: 1, crossbowstring: 1, mithrilbar: 2 }, level: 35, xp: 60 },
    { make: "mithrilarrow", n: 10, needs: { arrowshaft: 10, mithrilarrowheads: 10, feather: 10 }, level: 37, xp: 65 },
    { make: "mithrilbolt", n: 10, needs: { arrowshaft: 5, mithrilarrowheads: 10 }, level: 39, xp: 65 },
    { make: "magicbow", needs: { magiclog: 3, bowstring: 2 }, level: 43, xp: 85 },
    { make: "adamantcrossbow", needs: { teak: 2, crossbowstring: 1, adamantbar: 2 }, level: 45, xp: 85 },
    { make: "adamantarrow", n: 10, needs: { arrowshaft: 10, adamantarrowheads: 10, feather: 10 }, level: 47, xp: 90 },
    { make: "adamantbolt", n: 10, needs: { arrowshaft: 5, adamantarrowheads: 10 }, level: 49, xp: 90 },
    { make: "runearrow", n: 10, needs: { arrowshaft: 10, runearrowheads: 10, feather: 10 }, level: 50, xp: 110 },
    { make: "runebolt", n: 10, needs: { arrowshaft: 5, runearrowheads: 10, mahogany: 1 }, level: 50, xp: 115 });
  // baskets for the higher foraging spots
  WORKSHOPS.crafting.recipes.push(
    { make: "maplebasket", needs: { maple: 4, sap: 2 }, level: 22, xp: 34 },
    { make: "yewbasket", needs: { yew: 4, sap: 3 }, level: 32, xp: 46 },
    { make: "magicbasket", needs: { magiclog: 4, sap: 4 }, level: 42, xp: 70 });
  var BASKET_NAMES = CONTENT("BASKET_NAMES");

  var WEAR = CONTENT("WEAR");
  Object.keys(LEATHER_WEAR).forEach(function (k) { WEAR[k] = LEATHER_WEAR[k]; });
  var MAGIC_WEAR = CONTENT("MAGIC_WEAR");
  Object.keys(MAGIC_WEAR).forEach(function (k) { WEAR[k] = MAGIC_WEAR[k]; });
  Object.keys(WEAR).forEach(function (k) { ITEMS[k].gear.req = WEAR[k]; });
  /** Why you (or your pet) can't wear it yet, or "". */
  function cantWear(s, id) {
    var req = (ITEMS[id] && ITEMS[id].gear && ITEMS[id].gear.req) || {}, out = "";
    Object.keys(req).forEach(function (k) {
      if (out) return;
      if (k === "pet") { if (!s.pet || levelOf(s.pet.xp || 0) < req.pet) out = "needs a level " + req.pet + " pet"; }
      else if (k === "rank") { if ((s.mageRank || 0) < req.rank) out = "needs the rank of " + MAGE_RANKS[req.rank].name + " (the mage tower)"; }
      else if (levelOf(s.player.skills[k] || 0) < req[k]) out = "needs " + SKILLS[k].name + " " + req[k];
    });
    return out;
  }

  /** A crafter's xp for making something: more for rarer things. */
  function craftXp(rec) { return 8 + 4 * ITEMS[rec.make].gem; }

  // Equipment slots. Cam: "for pet charm, helmet, torso, feet (not all pets will be
  // same, some will have tail, wings, fin etc.) Human should have the usual arms,
  // legs, feet, torso, helmet, ring, necklace."
  var PLAYER_SLOTS = CONTENT("PLAYER_SLOTS");
  var PET_SLOTS = CONTENT("PET_SLOTS");
  var SLOT_NAMES = CONTENT("SLOT_NAMES");
  function petSlots(p) { return p ? PET_SLOTS[p.species] || ["charm", "helmet", "torso", "feet"] : []; }
  /** What someone's worn things add up to. */
  function gearSum(gear, cls, enchants) {
    var t = { xp: 0, speed: 1, rare: 1, success: 0, expXp: 0, att: 0, def: 0, rng: 0, mag: 0, magDmg: 0,
              trueStrike: 0, brace: 0, dodge: 0, regen: 0, maxHit: 0, reflect: 0, acc: 0, stun: 0, double: 0, soak: 0, hp: 0, sets: {}, clsBonus: 0, skill: {},
              armAtt: 0, styleAcc: { melee: 0, ranged: 0, magic: 0 }, defVs: { crush: 0, slash: 0, pierce: 0, magic: 0 }, fit: 0, fitDef: 0, weights: {} };   // armour weights (V17)
    Object.keys(gear || {}).forEach(function (k) {
      var it = ITEMS[gear[k]], g0 = it && it.gear, g = g0;
      if (!g) return;
      if (k === "offhand" && g0.slot === "weapon") return;               // a spare weapon counts only in your hand (Battle Re-work)
      // a piece that suits your class gives its class bonus on top
      if (g0.clsBonus && cls && g0.clsBonus.cls === cls) {
        g = copy(g0);
        Object.keys(g0.clsBonus).forEach(function (b) { if (b !== "cls") g[b] = (g[b] || 0) + g0.clsBonus[b]; });
        t.clsBonus++;
      }
      t.xp += g.xp || 0; t.speed *= g.speed || 1; t.rare = Math.max(t.rare, g.rare || 1);
      t.success += g.success || 0; t.expXp += g.expXp || 0; t.def += g.def || 0; t.rng += g.rng || 0;
      if (g.slot !== "weapon" && g.slot !== "ammo") { t.att += g.att || 0; t.armAtt += g.att || 0; }     // a weapon's own power is used in the fight; armour's: melee only (V17)
      t.trueStrike += g.trueStrike || 0; t.brace += g.brace || 0; t.dodge += g.dodge || 0; t.regen += g.regen || 0;
      t.hp += g.hp || 0;
      t.maxHit += g.maxHit || 0; t.reflect += g.reflect || 0; t.acc += g.acc || 0; t.stun += g.stun || 0; t.double += g.double || 0; t.soak += g.soak || 0;
      t.mag += g.mag || 0; t.magDmg += g.magDmg || 0;
      var em = enchants || ENCH, en = em && em[gear[k]] && ENCHANTS[em[gear[k]]];   // an enchant on it (2026-10-07)
      if (en) Object.keys(en.bonus).forEach(function (b) { if (b === "rare") t.rare = Math.max(t.rare, en.bonus.rare); else t[b] = (t[b] || 0) + en.bonus[b]; });
      if (g.set) t.sets[g.set] = (t.sets[g.set] || 0) + 1;
      if (g.boost) t.skill[g.boost.skill] = { xp: g.boost.xp, speed: g.boost.speed };
      weighPiece(t, gear[k], g, cls);                                    // its weight: style accuracy, Defence by kind, class fit (V17)
    });
    if ((t.sets.pharaoh || 0) >= 5) { t.xp += 0.1; t.def += 6; t.mag += 6; t.acc += 0.05; }      // the Pharaoh's set, all five (2026-10-09)
    weighDone(t);
    t.xp = Math.round(t.xp * 100) / 100; t.success = Math.round(t.success * 100) / 100; t.expXp = Math.round(t.expXp * 100) / 100;
    ["trueStrike", "brace", "dodge", "reflect", "acc", "stun", "double", "soak"].forEach(function (k) { t[k] = Math.round(t[k] * 100) / 100; });
    return t;
  }

