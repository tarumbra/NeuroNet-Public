  // ==== The isle without crafters (2026-10-04) ==================================================
  // Cam: "move blacksmith skills to player as new skill blacksmith and smelting. An anvil and
  // furnace can be added to the game in replacement of the blacksmith. Coins are required for
  // operation. (The idea is to replace all NPC with crafting objects and give the player the skill
  // for them). The only NPC's will be the merchant, traveling merchent ... and a Alchemist". The
  // crafters' lists above are the recipes; here they're handed to things you use, each with a
  // skill of yours, the crafter's old levels becoming the level each making needs. Metal is
  // smelted into bars first (a bronze bar is a copper and a tin ore), and "any material used to
  // make anything should be used up" -- needles and pots of water included.
  var OLD_WS = WORKSHOPS;
  var BAR_FEE = CONTENT("BAR_FEE");
  function toBars(needs) {
    var out = {}, cu = needs.copper || 0, tn = needs.tin || 0;
    if (cu || tn) out.bronzebar = Math.max(1, Math.ceil((cu + tn) / 2));
    Object.keys(needs).forEach(function (k) {
      if (k === "copper" || k === "tin" || k === "coal") return;
      if (k === "iron") out.ironbar = needs[k];
      else if (k === "silver") out.silverbar = Math.ceil(needs[k] / 2);
      else if (k === "gold") out.goldbar = Math.ceil(needs[k] / 2);
      else out[k] = needs[k];
    });
    return out;
  }
  function barFee(needs) { var f = 0; Object.keys(needs).forEach(function (k) { f += (BAR_FEE[k] || 0) * needs[k]; }); return f; }
  /** A crafter's recipe as yours: bars for ore (when `metal`), needles used up, a level and xp. */
  function mine(r, metal, feeOf) {
    var needs = metal ? toBars(r.needs) : copy(r.needs);
    (r.uses || []).forEach(function (k) { if (k !== "chisel") needs[k] = (needs[k] || 0) + 1; });
    var o = { make: r.make, needs: needs, level: r.level || CRAFT_LEVELS[r.make] || 1, xp: r.xp || craftXp(r) };
    if (r.n) o.n = r.n;
    if ((r.uses || []).indexOf("chisel") >= 0) o.uses = ["chisel"];
    var fee = feeOf ? feeOf(needs) : 0;
    if (fee) o.fee = fee;
    return o;
  }
  var isGemCut = function (r) { return (r.uses || []).indexOf("chisel") >= 0; };
  var SMELT = CONTENT("SMELT");
  var ANVIL = OLD_WS.blacksmith.recipes.filter(function (r) { return r.make !== "steel" && r.make !== "mithrilbar"; })
    .concat(OLD_WS.farmer.recipes.filter(function (r) { return /^(rake|hoe|wateringcan)$/.test(r.make); }))
    .map(function (r) {
      if (r.make === "needle") return { make: "needle", n: 5, needs: { bronzebar: 1 }, level: 1, xp: 8, fee: 1 };
      return mine(r, true, barFee);
    });
  var CRAFT = OLD_WS.crafting.recipes.filter(function (r) { return !isGemCut(r); }).map(function (r) { return mine(r); })
    .concat(OLD_WS.carpenter.recipes.map(function (r) { return mine(r, true); }))
    .concat(OLD_WS.tailor.recipes.filter(function (r) { return r.make !== "leather"; }).map(function (r) { return mine(r, true); }));
  var GEMS = OLD_WS.crafting.recipes.filter(isGemCut).map(function (r) { return mine(r); })
    .concat(OLD_WS.jeweler.recipes.map(function (r) { return mine(r, true); }));
  // The alchemist (Cam: "can turn alot of one material into one a level up, so it might cost 20
  // copper and 20 tin to create an iron ore"): a ladder each of ores, logs and cut gems -- dear
  // enough that gathering stays the better road, a way through when a level is out of reach.
  // Balance audit 2026-10-05: the old 20:1 ladders gave back a tenth of what went in. Now about
  // 3:1 for ores, logs and gems (copper and tin 2 + 2), plus a fee -- still dearer than gathering it yourself,
  // but a fair way to get a material before you can gather it.
  var ALCHEMY = [
    [{ copper: 2, tin: 2 }, "iron", 4], [{ iron: 3 }, "silver", 6], [{ silver: 3 }, "gold", 8],
    [{ gold: 3 }, "mithril", 12], [{ mithril: 3 }, "adamantite", 18], [{ adamantite: 3 }, "runite", 25],
    [{ birch: 3 }, "oak", 2], [{ oak: 3 }, "willow", 4], [{ willow: 3 }, "maple", 6], [{ maple: 3 }, "yew", 10], [{ yew: 3 }, "magiclog", 20],
    [{ opal: 3 }, "jade", 15], [{ jade: 3 }, "topaz", 25], [{ topaz: 3 }, "sapphire", 35], [{ sapphire: 3 }, "emerald", 50],
    [{ emerald: 3 }, "ruby", 70], [{ ruby: 3 }, "diamond", 100]
  ].map(function (a) { return { make: a[1], needs: a[0], level: 1, xp: 0, fee: a[2] }; });
  WORKSHOPS = {
    furnace: { name: "Furnace", who: "", skill: "smelting", icon: "obj_furnace", says: "Ore in, bars out. The fire costs a few coins to keep lit.", recipes: SMELT },
    anvil: { name: "Anvil", who: "", skill: "smithing", icon: "obj_anvil", says: "Bars hammered into tools, armour and weapons -- and worn tools mended. The forge charges by the bar.", recipes: ANVIL },
    crafting: { name: "Crafting bench", who: "", skill: "crafting", icon: "obj_bench", says: "Pottery, sewing, weaving and woodwork -- and stone tools to start with.", recipes: CRAFT },
    tanner: { name: "Tanner", who: "", skill: "crafting", icon: "obj_tanner", says: "Hides soaked and stretched into leather. The tanning pits cost coins.",
              recipes: [{ make: "leather", needs: { cowhide: 1 }, level: 1, xp: 10, fee: 5 }] },
    fletching: { name: "Fletching table", who: "", skill: "fletching", icon: "obj_fletch", says: "Shafts, strings and feathers -- bows, arrows and rods.", recipes: OLD_WS.fletcher.recipes.map(function (r) { return mine(r, true); }) },
    herblore: { name: "Herb table", who: "", skill: "herblore", icon: "obj_herbs", says: "Herbs and honey make the best medicine.", recipes: OLD_WS.apothecary.recipes.map(function (r) { return mine(r); }) },
    gemology: { name: "Gem bench", who: "", skill: "gemology", icon: "obj_gems", says: "Rough gems cut (a chisel and a pot of water), cut gems set in rings and necklaces.", recipes: GEMS },
    kitchen: OLD_WS.kitchen,
    compost: { name: "Compost bin", who: "", skill: "farming", icon: "obj_compost", says: "Dung and a little sweetness -- fertiliser for the farm.",
               recipes: OLD_WS.farmer.recipes.filter(function (r) { return /fertiliser$/.test(r.make); }).map(function (r) {
                 return { make: r.make, needs: copy(r.needs), level: r.make === "fertiliser" ? 3 : 12, xp: r.make === "fertiliser" ? 10 : 20 }; }) },
    alchemist: { name: "Alchemist", who: "Mira", npc: true, look: { skin: 1, hair: 4, outfit: 2 }, says: "A great deal of one thing, made into one of the next. For a fee.", recipes: ALCHEMY },
    merchant: { name: "Merchant", who: "Marlow", npc: true, trade: 1, look: { skin: 2, hair: 3, outfit: 3 }, says: "I'll buy what you can spare -- and I keep a few useful things.", recipes: [] },
    travelling: { name: "Travelling merchant", who: "Zeph", npc: true, trade: 1.5, sunday: true, look: { skin: 0, hair: 1, outfit: 1 },
                  says: "Sundays only! Exotic eggs from far away, and I pay half as much again for your goods.", recipes: [] },
    reskinner: { name: "Reskinner", who: "Iris", npc: true, reskin: true, look: { skin: 1, hair: 2, outfit: 2 },
                 says: "Any pet, any colour -- and a few skins nobody else has. Beat two bosses and I'll come.", recipes: [] }
  };
  // The Apothecary table (2026-10-06, Cam: "Salves will introduce the Apothacary Table and Alchemy
  // skill tree"): pet medicine -- an injured pet heals only once treated -- and draughts for the road.
  WORKSHOPS.apothecary = CONTENT("WORKSHOPS.apothecary");
  WORKSHOPS.herblore.recipes = WORKSHOPS.herblore.recipes.filter(function (r) { return r.make !== "salve"; });   // salves moved here
  CRAFT.push(
    { make: "leatherpetcap", needs: { leather: 2, thread: 1 }, level: 6, xp: 14 },
    { make: "leatherpetboots", needs: { leather: 2, thread: 1 }, level: 7, xp: 14 },
    { make: "leatherpetcoat", needs: { leather: 4, thread: 2 }, level: 9, xp: 24 });
  ANVIL.push(
    { make: "bronzepetcap", needs: { bronzebar: 2 }, level: 5, xp: 20, fee: 2 },
    { make: "bronzepetboots", needs: { bronzebar: 2 }, level: 6, xp: 20, fee: 2 },
    { make: "bronzepetcoat", needs: { bronzebar: 4 }, level: 8, xp: 36, fee: 4 },
    { make: "ironpetcap", needs: { ironbar: 2 }, level: 15, xp: 40, fee: 4 },
    { make: "ironpetboots", needs: { ironbar: 2 }, level: 16, xp: 40, fee: 4 },
    { make: "ironpetcoat", needs: { ironbar: 4 }, level: 18, xp: 70, fee: 8 },
    { make: "steelpetcap", needs: { ironbar: 2, coal: 3 }, level: 25, xp: 60, fee: 6 },
    { make: "steelpetboots", needs: { ironbar: 2, coal: 3 }, level: 26, xp: 60, fee: 6 },
    { make: "steelpetcoat", needs: { ironbar: 4, coal: 6 }, level: 28, xp: 110, fee: 12 },
    { make: "mithrilpetcap", needs: { mithrilbar: 2 }, level: 38, xp: 120, fee: 12 },
    { make: "mithrilpetboots", needs: { mithrilbar: 2 }, level: 39, xp: 120, fee: 12 },
    { make: "mithrilpetcoat", needs: { mithrilbar: 4 }, level: 41, xp: 220, fee: 24 },
    { make: "adamantpetcap", needs: { adamantbar: 2 }, level: 44, xp: 160, fee: 18 },
    { make: "adamantpetboots", needs: { adamantbar: 2 }, level: 45, xp: 160, fee: 18 },
    { make: "adamantpetcoat", needs: { adamantbar: 4 }, level: 47, xp: 300, fee: 36 },
    { make: "runepetcap", needs: { runebar: 2 }, level: 48, xp: 220, fee: 26 },
    { make: "runepetboots", needs: { runebar: 2 }, level: 49, xp: 220, fee: 26 },
    { make: "runepetcoat", needs: { runebar: 4 }, level: 50, xp: 420, fee: 50 });
  GEMS.push(
    { make: "huntercharm", needs: { bones: 10, copper: 2 }, level: 6, xp: 24 },
    { make: "wardcharm", needs: { amethyst: 1, ironbar: 1 }, level: 14, xp: 40 },
    { make: "swiftcharm", needs: { quill: 4, opal: 1 }, level: 22, xp: 60 });
  // Growing up at once (2026-10-09, Cam: "special charms, potions and food recipes you can cook to
  // age pets up straight away to expedition age"): each is used up on your pet, and a hatchling is
  // at once old enough for expeditions. An egg, or a pet that's old enough already, keeps it.
  ITEMS.seasonscharm = CONTENT("ITEMS.seasonscharm");
  ITEMS.growthelixir = CONTENT("ITEMS.growthelixir");
  ITEMS.comingofagecake = CONTENT("ITEMS.comingofagecake");
  GEMS.push({ make: "seasonscharm", needs: { amethyst: 1, honeycomb: 3, acorn: 4 }, level: 18, xp: 56 });
  WORKSHOPS.apothecary.recipes.push({ make: "growthelixir", needs: { herb: 3, honeycomb: 2, acorn: 2 }, level: 12, xp: 32 });
  WORKSHOPS.kitchen.recipes.push({ make: "comingofagecake", needs: { honeycomb: 2, berry: 4, acorn: 2 }, level: 10, xp: 20 });
  /** Why `p` can't grow up now ("" if it can). */
  function ageUpLock(p, now) {
    var ps = stage(p, now);
    if (ps === "egg") return "It's still an egg -- hatch it first.";
    if (ps !== "hatchling") return who(p) + " is old enough for expeditions already.";
    return "";
  }
  /** Straight to expedition age: as if it hatched EXPEDITION_AGE ago. */
  function ageUp(p, now) {
    var by = EXPEDITION_AGE - (now - p.hatchAt);
    if (by > 0) { p.hatchAt -= by; p.born -= by; }
  }
  WORKSHOP_ORDER = ["furnace", "anvil", "crafting", "tanner", "fletching", "herblore", "apothecary", "gemology", "kitchen", "compost",
                    "merchant", "travelling", "alchemist", "reskinner"];
  // what the merchants sell: [item, price]
  var MERCHANT_STOCK = CONTENT("MERCHANT_STOCK");
  var TRAVELLER_STOCK = CONTENT("TRAVELLER_STOCK");
  // Coin sinks that grow with you (balance audit 2026-10-05): Marlow keeps two rare things a day
  // from this list (the same two all day), and you can pay for more room (UPGRADES)
  var MERCHANT_DAILY = CONTENT("MERCHANT_DAILY");
  var UPGRADES = CONTENT("UPGRADES");
  function upgradeLevel(s, k) { return ((s && s.upgrades) || {})[k] || 0; }
  function hatchSlots(s) { return HATCHERY_SLOTS + upgradeLevel(s, "hatchery"); }
  function maxPots(s) { return MAX_POTS + 3 * upgradeLevel(s, "windowsill"); }
  // what things fetch (by how precious they are); the travelling merchant pays half as much again
  var SELL = CONTENT("SELL");
  // Prices by tier (balance audit 2026-10-05): what you gather is priced by the level of the
  // spot it mainly comes from (so mithril is worth more than gold), and what you make is worth at
  // least what went into it plus the fee. Worked out once at load (TIER_PRICE, below); the gem
  // table is the fallback for everything else (drops, gems, eggs).
  var TIER_PRICE = {};
  /** What one sells for (part of a coin, for what's quickly gathered -- 2026-10-09), and what n fetch, rounded down. */
  function eachFor(id, trade) { var e = priceOf(id) * (trade || 1); return e >= 1 ? Math.floor(e) : Math.round(e * 100) / 100; }
  function sellFor(id, n, trade) { var e = eachFor(id, trade); return e >= 1 ? e * n : Math.floor(e * n); }
  function priceOf(id) { var it = ITEMS[id]; return it ? (it.price || TIER_PRICE[id] || SELL[Math.max(0, Math.min(10, it.gem || 0))]) : 0; }
  // ---- what a store charges (2026-10-17, Cam: "Stores should price up their good so they would cost another 1 and a half on
  //      top of the costed materials to make ... do not take away the benefit of gathering, foraging or making the items").
  //      The Economist and the Mathematician (Collaboration N6, tools/balance/store_prices.js): a store's price is the higher
  //      of 2.5 x its MATERIALS (the cheapest recipe's materials at what they sell for, plus the bench's fee -- or, for a
  //      thing nobody makes, the thing itself at its value) and 2 x its value (so nothing bought sells back for more: made
  //      goods are worth far more than their materials, and 2.5 x materials alone would sell a berry tart for 3 coins).
  var STORE_RULE = 2.5, STORE_VALUE = 2, matCost = {};
  /** Coins of materials behind one `id`: the cheapest way to make it, else its own value. Worked out once (recipes are all in by then). */
  function materialCost(id, depth) {
    if (id in matCost) return matCost[id];
    matCost[id] = priceOf(id);                                           // (a loop in the recipes falls back to the value)
    if ((depth || 0) > 6) return matCost[id];
    var best = Infinity;
    WORKSHOP_ORDER.forEach(function (w) {
      if (w === "alchemist" || w === "merchant" || !WORKSHOPS[w]) return;   // the Alchemist turns lots into one: not "making"
      WORKSHOPS[w].recipes.forEach(function (r) {
        if (r.make !== id) return;
        var c = r.fee || 0;
        Object.keys(r.needs || {}).forEach(function (n) { c += materialCost(n, (depth || 0) + 1) * r.needs[n]; });
        best = Math.min(best, c / (r.n || 1));
      });
    });
    if (best < Infinity) matCost[id] = best;
    return matCost[id];
  }
  /** The least a store may ask for `id`. */
  function storeFloor(id) { return Math.max(1, Math.ceil(Math.max(materialCost(id) * STORE_RULE, priceOf(id) * STORE_VALUE))); }
  /** What a merchant sells today: [item, price]. Never less than twice what it sells for, so
   *  nothing bought can be sold (even to Zeph) or turned into something that sells for more. */
  function stockFor(seller, now) {
    if (seller === "mirage") return mirageStock(now).map(function (x) { return [x[0], Math.max(x[1], storeFloor(x[0]))]; });
    if (ISLE_STOCK[seller]) return ISLE_STOCK[seller].filter(function (x) { return ITEMS[x[0]]; }).map(function (x) { return [x[0], Math.max(x[1], storeFloor(x[0]))]; });
    var list = seller === "travelling" ? TRAVELLER_STOCK.slice() : MERCHANT_STOCK.slice();
    if (seller !== "travelling") {
      var day = Math.floor((now || 0) / (24 * 3600 * 1000)), n = MERCHANT_DAILY.length, a = day % n, b2 = (day * 7 + 3) % n;
      list.push(MERCHANT_DAILY[a]); if (b2 !== a) list.push(MERCHANT_DAILY[b2]);
    }
    return list.map(function (x) { return [x[0], Math.max(x[1], storeFloor(x[0]))]; });
  }
  function isSunday(now) { return new Date(now).getDay() === 0; }
  function bossesBeaten(s) { return Object.keys(s.hunt || {}).filter(function (g) { return (s.hunt[g].wins || 0) > 0; }).length; }
  /** Is this NPC in the village now? The travelling merchant on Sundays, the reskinner after two bosses. */
  function npcHere(s, k, now) {
    var ws = WORKSHOPS[k];
    if (ws.sunday && !isSunday(now)) return false;
    if (ws.reskin && bossesBeaten(s) < 2) return false;
    if (ws.night && !isNight(now)) return false;                       // the mirage merchant, after dark
    if (ws.region === "oasis" && !atOasis(s)) return false;            // ... and only at the Oasis
    if (ws.region === "hollowcrypt" && regionLock(s, "hollowcrypt")) return false;   // the crypt merchant (Part 13)
    if (ws.isle && islandOf(s) !== ws.isle) return false;               // an island's shops are on that island
    return true;
  }
  // Exotic reskins (2026-10-04): "the reskinner with come with exotic reskins as well, but will
  // cost a fair bit" -- palettes by the letters the pet pictures use (b body, l belly, p cheeks,
  // e eyes, o outline, s spots)
  var RESKINS = CONTENT("RESKINS");
  var RESKIN_COST = 150;           // your own colours

  // Tools wear (2026-10-04): "all material gathering items to have limited durability when
  // collecting a resource higher then itself, so bronze pick can collect copper and tin
  // indefinetly, but for level up material it will break after a while ... a repair option ...
  // it will cost half the materials to repair, but must be repaired before it breaks."
  // A tool's tier against a find's grade: at or below it, no wear; above it, (grade - tier) a find.
  // in uses: every use wears (2026-10-09); the early tiers last longer (2026-10-10, Cam: "make them more durable"): bronze
  // 3,000 -> 4,500, iron 4,000 -> 5,000, steel 5,000 -> 5,500
  var TOOL_DUR = CONTENT("TOOL_DUR");
  // grades of what's dug out of rocks and cut from trees; anything else takes its spot's
  var ITEM_GRADE = CONTENT("ITEM_GRADE");
  function spotGrade(sp) { return sp.level < 10 ? 1 : sp.level < 20 ? 2 : sp.level < 28 ? 3 : sp.level < 36 ? 4 : sp.level < 44 ? 5 : 6; }
  function gradeOf(item, sp) {
    if (ITEM_GRADE[item] !== undefined) return ITEM_GRADE[item];
    return sp && sp.loot && sp.loot[0][0] === item ? spotGrade(sp) : 0;
  }
  function toolDur(id) { var t = ITEMS[id] && ITEMS[id].tool; return t ? (t.dur || TOOL_DUR[t.tier == null ? 1 : t.tier] || 150) : 0; }
  /** The recipe a thing is made by, and where: {ws, rec} or null. */
  function recipeFor(id) {
    for (var i = 0; i < WORKSHOP_ORDER.length; i++) {
      var ws = WORKSHOPS[WORKSHOP_ORDER[i]];
      if (ws.npc) continue;
      for (var j = 0; j < ws.recipes.length; j++) if (ws.recipes[j].make === id) return { ws: WORKSHOP_ORDER[i], rec: ws.recipes[j] };
    }
    return null;
  }
  /** Mending a tool: half its making (rounded up), half the fee. */
  function repairCost(id) {
    var f = recipeFor(id);
    if (!f) return null;
    var needs = {}, n = f.rec.n || 1;
    Object.keys(f.rec.needs).forEach(function (k) { needs[k] = Math.max(1, Math.ceil(f.rec.needs[k] / n / 2)); });
    return { ws: f.ws, needs: needs, fee: Math.ceil((f.rec.fee || 0) / 2) };
  }
  // What it takes to wear things (Cam, 2026-10-03: "All equipment should have level requirement
  // to wear. Keep in mind bronze is begginer so should be lvl 1 defence same as soft leather (we
  // will also have hardened leather, studded leather, plated leather, snakes leather etc)").
  // OSRS-like tiers: bronze and soft leather 1, bone 5, iron 10; weapons by Attack or Ranged;
  // a pet's things by pet level.
