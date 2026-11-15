/* ==========================================================================
   NeuroFarm -- the rules (2026-10-07).
   ==========================================================================
   Cam: "a new game NeuroFarm (A farmville, simfarm game, simple with crops,
   crops need levels to unlock, storage is handled by silos, start with 4x4
   plots, ability to do 2x2 crops, each level you can purchase a new land and
   plow it to grow more, a new crop or tree will unlock. Each crop has a
   different growing time which works in real time like NeuroPets.) Ability to
   sell crops, or turn them into recipes which take more time and require a
   certain level kitchen then you can sell for slightly more then the raw crop
   ... There will be a market request board with special orders that you need
   to fill, you get special potions which increase the growth time, can
   unspoil crops. Crops spoil if not harvested in the same time as it took to
   grow. Example 1 hour growth time, will take 1 hour to spoil."

   Part 1 of 3: the fields, crops and trees, silos, land, the kitchen, the
   market and its request board, potions and spoiling.

   Part 2 (Cam: "Later levels you unlock husbandry, starts off small with
   chickens, you need to build the coop which requires materials, wood, crops,
   money etc. Later barns for cows, pastures, goats etc. Which also produce
   materials that you can then use to make other things and sell them for
   extra (butter, yoghurt, milk, cheese etc). Sheep, a shearers shed, wool
   (clothes, blankets etc)"): animal houses you place on your land (a coop, a
   barn, a pasture), animals you buy, feed with your crops and collect from;
   wood (from your trees, or the market); and two more workshops beside the
   kitchen -- the dairy and the sewing room -- plus the shearer's shed.
   (Mass orders and the machines are part 3.)

   Like NeuroPets' petcore.js: pure and deterministic -- no clock, no Math.random.
   Everything happens by the time passed: act(state, action, opts, now) and
   view(state, now). The page saves what act returns.
   ========================================================================== */
var FarmCore = (function () {
  "use strict";
  var MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  // ---- the land: a grid of tiles in parcels of 4x4 ------------------------------------------
  var PARCEL = 4, PARCELS_W = 4, PARCELS_H = 3;                  // 16 x 12 tiles in all
  var GRID_W = PARCEL * PARCELS_W, GRID_H = PARCEL * PARCELS_H;
  var PLOW_COST = 5;
  function parcelCost(n) { return Math.round(150 * Math.pow(1.7, n - 1) / 10) * 10; }   // the nth parcel you buy

  // ---- crops and trees ----------------------------------------------------------------------
  // time: minutes to grow (and as long again before it spoils). seed: what planting costs.
  // sell: what one is worth at the market. yield: how many a harvest gives. size 2: a 2x2 crop.
  var CROPS = {
    strawberry: { name: "Strawberries", item: "strawberry", level: 1, time: 4, seed: 2, yield: 2, xp: 1 },
    wheat: { name: "Wheat", item: "wheat", level: 1, time: 15, seed: 4, yield: 3, xp: 2 },
    carrot: { name: "Carrots", item: "carrot", level: 2, time: 30, seed: 6, yield: 3, xp: 3 },
    potato: { name: "Potatoes", item: "potato", level: 3, time: 60, seed: 10, yield: 3, xp: 5 },
    cabbage: { name: "Cabbages", item: "cabbage", level: 4, time: 120, seed: 15, yield: 2, xp: 7 },
    pumpkin: { name: "Pumpkins", item: "pumpkin", level: 5, time: 180, seed: 40, yield: 3, xp: 14, size: 2 },
    sweetcorn: { name: "Sweetcorn", item: "sweetcorn", level: 6, time: 240, seed: 22, yield: 3, xp: 10 },
    cotton: { name: "Cotton", item: "cotton", level: 8, time: 360, seed: 28, yield: 3, xp: 13 },
    melon: { name: "Melons", item: "melon", level: 9, time: 360, seed: 70, yield: 3, xp: 24, size: 2 },
    flax: { name: "Flax", item: "flax", level: 12, time: 480, seed: 35, yield: 3, xp: 16 },
    blackberry: { name: "Blackberries", item: "blackberry", level: 13, time: 300, seed: 25, yield: 3, xp: 14 },
    dragonfruit: { name: "Dragon fruit", item: "dragonfruit", level: 14, time: 600, seed: 110, yield: 3, xp: 34, size: 2 },
    starfruit: { name: "Starfruit", item: "starfruit", level: 18, time: 720, seed: 60, yield: 2, xp: 30 },
    elderberry: { name: "Elderberries", item: "elderberry", level: 20, time: 600, seed: 50, yield: 3, xp: 28 },
    // more crops (2026-10-07, Cam: "build out some more crops for the game please and their respective recipes")
    tomato: { name: "Tomatoes", item: "tomato", level: 4, time: 45, seed: 8, yield: 3, xp: 4 },
    onion: { name: "Onions", item: "onion", level: 5, time: 75, seed: 9, yield: 3, xp: 5 },
    lettuce: { name: "Lettuces", item: "lettuce", level: 7, time: 90, seed: 12, yield: 2, xp: 6 },
    beetroot: { name: "Beetroot", item: "beetroot", level: 8, time: 150, seed: 16, yield: 3, xp: 8 },
    sugarcane: { name: "Sugarcane", item: "sugarcane", level: 10, time: 200, seed: 20, yield: 3, xp: 10 },
    cucumber: { name: "Cucumbers", item: "cucumber", level: 11, time: 240, seed: 24, yield: 3, xp: 11 },
    sunflower: { name: "Sunflowers", item: "sunflower", level: 13, time: 300, seed: 30, yield: 3, xp: 13 },
    chilli: { name: "Chillies", item: "chilli", level: 15, time: 360, seed: 34, yield: 3, xp: 15 },
    rice: { name: "Rice", item: "rice", level: 17, time: 420, seed: 30, yield: 4, xp: 16 },
    grapes: { name: "Grapes", item: "grapes", level: 19, time: 480, seed: 60, yield: 3, xp: 22 },
    pineapple: { name: "Pineapples", item: "pineapple", level: 21, time: 720, seed: 140, yield: 3, xp: 40, size: 2 },
    coffee: { name: "Coffee", item: "coffeebean", level: 24, time: 600, seed: 80, yield: 3, xp: 30 },
    cocoa: { name: "Cocoa", item: "cocoa", level: 26, time: 720, seed: 100, yield: 3, xp: 36 }
  };
  // trees: planted once (a sapling), 2x2, and fruit again and again
  var TREES = {
    apple: { name: "Apple tree", item: "apple", level: 3, time: 120, sapling: 150, yield: 4, xp: 6 },
    pear: { name: "Pear tree", item: "pear", level: 7, time: 240, sapling: 320, yield: 4, xp: 10 },
    mango: { name: "Mango tree", item: "mango", level: 11, time: 360, sapling: 650, yield: 4, xp: 15 },
    banana: { name: "Banana tree", item: "banana", level: 16, time: 480, sapling: 950, yield: 5, xp: 20 },
    goldapple: { name: "Golden apple tree", item: "goldapple", level: 22, time: 1440, sapling: 2600, yield: 3, xp: 60 },
    cherry: { name: "Cherry tree", item: "cherry", level: 8, time: 180, sapling: 400, yield: 5, xp: 8 },
    orange: { name: "Orange tree", item: "orange", level: 12, time: 300, sapling: 700, yield: 4, xp: 12 },
    lemon: { name: "Lemon tree", item: "lemon", level: 14, time: 300, sapling: 750, yield: 4, xp: 12 },
    peach: { name: "Peach tree", item: "peach", level: 18, time: 420, sapling: 1200, yield: 4, xp: 18 },
    coconut: { name: "Coconut palm", item: "coconut", level: 25, time: 900, sapling: 3500, yield: 3, xp: 50 }
  };
  // the market: what each thing fetches
  var PRICES = { strawberry: 4, wheat: 5, carrot: 8, potato: 12, cabbage: 25, pumpkin: 48, sweetcorn: 28, cotton: 35, melon: 78,
                 flax: 46, dragonfruit: 120, starfruit: 110, apple: 14, pear: 26, mango: 40, banana: 48, goldapple: 260,
                 bread: 19, strawberryjam: 21, applepie: 78, carrotsoup: 36, bakedpotato: 44, cabbagesoup: 70,
                 pumpkinpie: 130, cornchowder: 110, melonsorbet: 290, fruitsalad: 260, blackberry: 30, elderberry: 60, berrytart: 260, dragonfruittart: 420, starfruitpie: 400,
                 // part 2: wood, what animals give, and what the dairy, sewing room and kitchen make of it
                 wood: 8, egg: 14, milk: 30, goatmilk: 45, wool: 40,
                 omelette: 82, pancakes: 84, cake: 165, quiche: 270,
                 butter: 75, yoghurt: 90, cheese: 150, goatcheese: 170, icecream: 210,
                 cloth: 130, linen: 172, yarn: 100, sweater: 370, blanket: 410, linenshirt: 590, quilt: 790,
                 // more crops, the mill, and their dishes
                 tomato: 14, onion: 15, lettuce: 30, beetroot: 24, sugarcane: 30, cucumber: 32, sunflower: 40, chilli: 45, rice: 34,
                 grapes: 70, pineapple: 170, coffeebean: 95, cocoa: 115, cherry: 22, orange: 42, lemon: 40, peach: 60, coconut: 220,
                 sugar: 112, orangejuice: 156, lemonade: 236, sunfloweroil: 198, grapejuice: 260, coffee: 350, coconutmilk: 540, chocolate: 600,
                 tomatosoup: 70, salad: 108, borscht: 106, cherrypie: 148, pickles: 136, chillistew: 198, lemontart: 390, pizza: 255,
                 friedrice: 178, peachcobbler: 325, pineapplecake: 395, mocha: 1240 };
  var NAMES = { strawberry: "Strawberry", wheat: "Wheat", carrot: "Carrot", potato: "Potato", cabbage: "Cabbage", pumpkin: "Pumpkin",
                sweetcorn: "Sweetcorn", cotton: "Cotton", melon: "Melon", flax: "Flax", dragonfruit: "Dragon fruit", starfruit: "Starfruit",
                apple: "Apple", pear: "Pear", mango: "Mango", banana: "Banana", goldapple: "Golden apple",
                bread: "Bread", strawberryjam: "Strawberry jam", applepie: "Apple pie", carrotsoup: "Carrot soup", bakedpotato: "Baked potato",
                cabbagesoup: "Cabbage soup", pumpkinpie: "Pumpkin pie", cornchowder: "Corn chowder", melonsorbet: "Melon sorbet",
                fruitsalad: "Fruit salad", blackberry: "Blackberry", elderberry: "Elderberry", berrytart: "Berry tart", dragonfruittart: "Dragon fruit tart", starfruitpie: "Starfruit pie",
                growtonic: "Grow tonic", freshtonic: "Freshness tonic",
                wood: "Wood", egg: "Egg", milk: "Milk", goatmilk: "Goat's milk", wool: "Wool",
                omelette: "Omelette", pancakes: "Pancakes", cake: "Strawberry cake", quiche: "Cheese quiche",
                butter: "Butter", yoghurt: "Strawberry yoghurt", cheese: "Cheese", goatcheese: "Goat's cheese", icecream: "Melon ice cream",
                cloth: "Cotton cloth", linen: "Linen", yarn: "Yarn", sweater: "Wool sweater", blanket: "Blanket", linenshirt: "Linen shirt", quilt: "Patchwork quilt",
                tomato: "Tomato", onion: "Onion", lettuce: "Lettuce", beetroot: "Beetroot", sugarcane: "Sugarcane", cucumber: "Cucumber", sunflower: "Sunflower",
                chilli: "Chilli", rice: "Rice", grapes: "Grapes", pineapple: "Pineapple", coffeebean: "Coffee beans", cocoa: "Cocoa pod", cherry: "Cherries",
                orange: "Orange", lemon: "Lemon", peach: "Peach", coconut: "Coconut",
                sugar: "Sugar", orangejuice: "Orange juice", lemonade: "Lemonade", sunfloweroil: "Sunflower oil", grapejuice: "Grape juice",
                coffee: "Ground coffee", coconutmilk: "Coconut milk", chocolate: "Chocolate",
                tomatosoup: "Tomato soup", salad: "Garden salad", borscht: "Beetroot soup", cherrypie: "Cherry pie", pickles: "Pickles",
                chillistew: "Chilli stew", lemontart: "Lemon tart", pizza: "Pizza", friedrice: "Fried rice", peachcobbler: "Peach cobbler",
                pineapplecake: "Pineapple cake", mocha: "Mocha", instanttonic: "Instant tonic" };

  // ---- workshops: the kitchen, the dairy, the sewing room ------------------------------------
  // Each is built, then upgraded: a better one makes more things, and more at once (its level).
  // A recipe takes time, needs the workshop's level, and sells for a little more than what went in.
  var KITCHEN = [
    null,
    { coins: 300, needs: { wheat: 10 }, level: 2 },
    { coins: 1500, needs: { potato: 10, carrot: 10 }, level: 6 },
    { coins: 5000, needs: { pumpkin: 4, cabbage: 10 }, level: 10 },
    { coins: 14000, needs: { melon: 4, cotton: 10 }, level: 15 }
  ];
  var MAKERS = {
    kitchen: { name: "Kitchen", verb: "Cook", doing: "Cooking", tiers: KITCHEN },
    dairy: { name: "Dairy", verb: "Make", doing: "Making", tiers: [null,
      { coins: 1500, needs: { wood: 10, milk: 6 }, level: 11 },
      { coins: 5000, needs: { wood: 25, butter: 4 }, level: 15 },
      { coins: 12000, needs: { wood: 40, cheese: 4 }, level: 21 }] },
    loom: { name: "Sewing room", verb: "Sew", doing: "Sewing", tiers: [null,
      { coins: 1200, needs: { wood: 8, cotton: 6 }, level: 9 },
      { coins: 5000, needs: { wood: 20, cloth: 5 }, level: 16 },
      { coins: 12000, needs: { wood: 35, linen: 5 }, level: 20 }] },
    // the mill and press (2026-10-07): sugar from cane, oil from sunflowers, juices, coffee, chocolate
    mill: { name: "Mill", verb: "Press", doing: "Pressing", tiers: [null,
      { coins: 2500, needs: { wood: 15, sugarcane: 10 }, level: 10 },
      { coins: 6000, needs: { wood: 25, sugar: 6 }, level: 16 },
      { coins: 14000, needs: { wood: 40, sunfloweroil: 4 }, level: 22 }] }
  };
  var MAKER_ORDER = ["kitchen", "dairy", "loom", "mill"];
  // Extra stoves and the queue (2026-10-09, Cam: "add queing in the farm and the ability to upgrade kitchen by
  // adding extra stoves so you can cook more then one thing at once"). A stove is one more thing on the go in
  // the kitchen (its level still decides what you can cook). A queue lines up what's next: what it takes comes
  // out of the silos when you queue it, and it starts by itself the moment there's room -- even while you're away.
  var STOVES = [null,
    { coins: 800, needs: { wood: 10 }, level: 4 },
    { coins: 2500, needs: { wood: 20 }, level: 8 },
    { coins: 6000, needs: { wood: 30 }, level: 13 },
    { coins: 12000, needs: { wood: 45 }, level: 18 }];
  var QUEUE_MAX = 6;                                          // waiting, per workshop
  var RECIPES = {
    bread: { at: "kitchen", tier: 1, level: 2, needs: { wheat: 3 }, time: 20, xp: 4 },
    strawberryjam: { at: "kitchen", tier: 1, level: 2, needs: { strawberry: 4 }, time: 15, xp: 3 },
    carrotsoup: { at: "kitchen", tier: 1, level: 3, needs: { carrot: 3, wheat: 1 }, time: 40, xp: 6 },
    bakedpotato: { at: "kitchen", tier: 2, level: 5, needs: { potato: 3 }, time: 60, xp: 8 },
    applepie: { at: "kitchen", tier: 2, level: 6, needs: { apple: 4, wheat: 2 }, time: 90, xp: 12 },
    cabbagesoup: { at: "kitchen", tier: 2, level: 7, needs: { cabbage: 2, carrot: 1 }, time: 120, xp: 14 },
    omelette: { at: "kitchen", tier: 2, level: 7, needs: { egg: 3, cabbage: 1 }, time: 30, xp: 8 },
    pancakes: { at: "kitchen", tier: 2, level: 10, needs: { egg: 2, milk: 1, wheat: 2 }, time: 40, xp: 9 },
    pumpkinpie: { at: "kitchen", tier: 3, level: 10, needs: { pumpkin: 2, wheat: 3 }, time: 150, xp: 22 },
    cornchowder: { at: "kitchen", tier: 3, level: 11, needs: { sweetcorn: 3, potato: 1 }, time: 180, xp: 22 },
    cake: { at: "kitchen", tier: 3, level: 12, needs: { egg: 3, milk: 2, wheat: 3, strawberry: 4 }, time: 120, xp: 18 },
    melonsorbet: { at: "kitchen", tier: 4, level: 15, needs: { melon: 3, strawberry: 6 }, time: 240, xp: 40 },
    fruitsalad: { at: "kitchen", tier: 4, level: 17, needs: { mango: 2, banana: 2, pear: 2 }, time: 240, xp: 36 },
    dragonfruittart: { at: "kitchen", tier: 4, level: 19, needs: { dragonfruit: 3, wheat: 4 }, time: 300, xp: 60 },
    starfruitpie: { at: "kitchen", tier: 4, level: 21, needs: { starfruit: 3, wheat: 4 }, time: 300, xp: 56 },
    quiche: { at: "kitchen", tier: 4, level: 22, needs: { egg: 4, cheese: 1, wheat: 2 }, time: 180, xp: 34 },
    berrytart: { at: "kitchen", tier: 4, level: 23, needs: { blackberry: 3, elderberry: 2, wheat: 3 }, time: 300, xp: 58 },
    tomatosoup: { at: "kitchen", tier: 1, level: 5, needs: { tomato: 3, onion: 1 }, time: 35, xp: 6 },
    salad: { at: "kitchen", tier: 2, level: 7, needs: { lettuce: 2, tomato: 2 }, time: 30, xp: 8 },
    borscht: { at: "kitchen", tier: 2, level: 8, needs: { beetroot: 3, onion: 1 }, time: 60, xp: 9 },
    cherrypie: { at: "kitchen", tier: 2, level: 9, needs: { cherry: 5, wheat: 2 }, time: 90, xp: 13 },
    pickles: { at: "kitchen", tier: 3, level: 11, needs: { cucumber: 3, onion: 1 }, time: 90, xp: 12 },
    chillistew: { at: "kitchen", tier: 3, level: 15, needs: { chilli: 2, tomato: 3, onion: 2 }, time: 120, xp: 17 },
    lemontart: { at: "kitchen", tier: 4, level: 15, needs: { lemon: 3, wheat: 2, butter: 1, sugar: 1 }, time: 150, xp: 26 },
    pizza: { at: "kitchen", tier: 4, level: 16, needs: { wheat: 3, tomato: 3, cheese: 1 }, time: 150, xp: 22 },
    friedrice: { at: "kitchen", tier: 3, level: 17, needs: { rice: 3, egg: 2, onion: 1 }, time: 60, xp: 15 },
    peachcobbler: { at: "kitchen", tier: 4, level: 18, needs: { peach: 3, wheat: 2, butter: 1 }, time: 180, xp: 26 },
    pineapplecake: { at: "kitchen", tier: 4, level: 22, needs: { pineapple: 1, egg: 2, wheat: 2, sugar: 1 }, time: 200, xp: 30 },
    mocha: { at: "kitchen", tier: 4, level: 27, needs: { coffee: 1, chocolate: 1, milk: 2 }, time: 120, xp: 45 },
    // the mill
    sugar: { at: "mill", tier: 1, level: 10, needs: { sugarcane: 3 }, time: 45, xp: 8 },
    orangejuice: { at: "mill", tier: 1, level: 12, needs: { orange: 3 }, time: 40, xp: 10 },
    sunfloweroil: { at: "mill", tier: 1, level: 13, needs: { sunflower: 4 }, time: 90, xp: 14 },
    lemonade: { at: "mill", tier: 2, level: 16, needs: { lemon: 2, sugar: 1 }, time: 45, xp: 12 },
    grapejuice: { at: "mill", tier: 2, level: 19, needs: { grapes: 3 }, time: 90, xp: 18 },
    coffee: { at: "mill", tier: 3, level: 24, needs: { coffeebean: 3 }, time: 120, xp: 26 },
    coconutmilk: { at: "mill", tier: 3, level: 25, needs: { coconut: 2 }, time: 150, xp: 30 },
    chocolate: { at: "mill", tier: 3, level: 26, needs: { cocoa: 3, sugar: 1, milk: 1 }, time: 180, xp: 34 },
    // the dairy
    butter: { at: "dairy", tier: 1, level: 11, needs: { milk: 2 }, time: 30, xp: 6 },
    yoghurt: { at: "dairy", tier: 1, level: 12, needs: { milk: 2, strawberry: 3 }, time: 45, xp: 7 },
    cheese: { at: "dairy", tier: 2, level: 15, needs: { milk: 4 }, time: 90, xp: 12 },
    goatcheese: { at: "dairy", tier: 2, level: 16, needs: { goatmilk: 3 }, time: 120, xp: 14 },
    icecream: { at: "dairy", tier: 3, level: 21, needs: { milk: 2, egg: 2, melon: 1 }, time: 150, xp: 18 },
    // the sewing room
    cloth: { at: "loom", tier: 1, level: 9, needs: { cotton: 3 }, time: 60, xp: 9 },
    linen: { at: "loom", tier: 1, level: 12, needs: { flax: 3 }, time: 90, xp: 12 },
    yarn: { at: "loom", tier: 2, level: 16, needs: { wool: 2 }, time: 45, xp: 8 },
    sweater: { at: "loom", tier: 2, level: 17, needs: { yarn: 3 }, time: 120, xp: 24 },
    blanket: { at: "loom", tier: 2, level: 18, needs: { yarn: 2, cloth: 1 }, time: 180, xp: 28 },
    linenshirt: { at: "loom", tier: 3, level: 20, needs: { linen: 2, cloth: 1 }, time: 150, xp: 30 },
    quilt: { at: "loom", tier: 3, level: 24, needs: { cloth: 2, yarn: 2, linen: 1 }, time: 240, xp: 40 }
  };

  // ---- animals (part 2) ------------------------------------------------------------------------
  // Their houses go on your land. An animal eats from your silos, then makes something in its own
  // time; collect it and it's hungry again. Nothing spoils here -- but nothing's made on an empty belly.
  var HOUSES = {
    coop: { name: "Chicken coop", size: 2, level: 6, cap: 6, coins: 400, needs: { wood: 10, wheat: 10 }, animals: ["chicken"] },
    barn: { name: "Barn", size: 3, level: 10, cap: 6, coins: 2000, needs: { wood: 30, sweetcorn: 10 }, animals: ["cow"] },
    pasture: { name: "Pasture", size: 3, level: 13, cap: 6, coins: 1500, needs: { wood: 20 }, animals: ["goat", "sheep"] }
  };
  var HOUSE_ORDER = ["coop", "barn", "pasture"];
  var ANIMALS = {
    chicken: { name: "Chicken", house: "coop", level: 6, cost: 60, eats: { wheat: 2 }, time: 30, makes: "egg", n: 2, xp: 2 },
    cow: { name: "Cow", house: "barn", level: 10, cost: 500, eats: { wheat: 4 }, time: 120, makes: "milk", n: 3, xp: 6 },
    goat: { name: "Goat", house: "pasture", level: 13, cost: 350, eats: { carrot: 2 }, time: 60, makes: "goatmilk", n: 1, xp: 4 },
    sheep: { name: "Sheep", house: "pasture", level: 16, cost: 650, eats: { cabbage: 1 }, time: 240, makes: "wool", n: 3, xp: 9, shears: true }
  };
  var ANIMAL_ORDER = ["chicken", "cow", "goat", "sheep"];
  // the shearer's shed: sheep's wool can't come off without it
  var SHEARSHED = { name: "Shearer's shed", coins: 3000, needs: { wood: 25 }, level: 16 };
  // the market's supplies: what you can buy (wood, for building) -- dearer than it sells for
  var SUPPLIES = { wood: 15 };
  function houseCost(kind, n) {                              // the (n+1)th of a kind: each dearer
    var h = HOUSES[kind], needs = {};
    Object.keys(h.needs).forEach(function (k) { needs[k] = Math.ceil(h.needs[k] * (1 + 0.5 * n)); });
    return { coins: Math.round(h.coins * Math.pow(1.6, n) / 50) * 50, needs: needs };
  }
  // silos hold everything you keep
  var SILO_SIZE = 100;
  function siloCost(n) { return { coins: 400 * n, needs: { wheat: 15 * n } }; }   // your nth silo

  // ---- potions, from the request board -------------------------------------------------------
  var POTIONS = {
    growtonic: { name: "Grow tonic", about: "Halves the time a crop (or a tree's fruit) has left to grow" },
    freshtonic: { name: "Freshness tonic", about: "A spoiled crop comes back, fresh and ready -- with as long again before it spoils" },
    // Cam (2026-10-07): "have an instant finish potion available later after filling requests"
    instanttonic: { name: "Instant tonic", about: "Finishes something at once: a crop or a tree's fruit, a building's animals, or what a workshop is making", level: 12 }
  };

  // ---- levels --------------------------------------------------------------------------------
  var MAX_LEVEL = 30;
  var XP = [0, 0];
  for (var lv = 2; lv <= MAX_LEVEL + 1; lv++) XP[lv] = Math.round(30 * Math.pow(lv - 1, 1.9));
  function levelOf(xp) { var l = 1; while (l < MAX_LEVEL && xp >= XP[l + 1]) l++; return l; }

  // ---- little helpers ------------------------------------------------------------------------
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function rnd(h) { h.seed = (h.seed + 0x6D2B79F5) | 0; var t = h.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function nameOf(id) { return NAMES[id] || id; }
  function itemsText(m) { return Object.keys(m).map(function (k) { return m[k] > 1 ? m[k] + " × " + nameOf(k).toLowerCase() : nameOf(k).toLowerCase(); }).join(", "); }
  function note(s, at, text) { s.log.unshift({ t: at, text: text }); if (s.log.length > 120) s.log.length = 120; }
  function no(s, msg) { return { ok: false, error: msg, state: s }; }
  function yes(s, at, msg) { note(s, at, msg); return { ok: true, msg: msg, state: s }; }
  function key(x, y) { return x + "," + y; }

  function empty() { return { v: 1, game: "neurofarm", log: [] }; }
  function normal(state) {
    var s = state && typeof state === "object" ? copy(state) : empty();
    if (!Array.isArray(s.log)) s.log = [];
    if (typeof s.coins !== "number") s.coins = 200;
    if (typeof s.xp !== "number") s.xp = 0;
    if (!s.silo || typeof s.silo !== "object") s.silo = {};
    if (typeof s.silos !== "number") s.silos = 1;
    if (!s.tiles || typeof s.tiles !== "object") {
      s.tiles = {};                                            // the first parcel: yours, and plowed
      for (var y = 0; y < PARCEL; y++) for (var x = 0; x < PARCEL; x++) s.tiles[key(x, y)] = { plowed: true };
    }
    if (!Array.isArray(s.parcels)) s.parcels = ["0,0"];
    if (typeof s.kitchen !== "number") s.kitchen = 0;
    MAKER_ORDER.forEach(function (m) { if (typeof s[m] !== "number") s[m] = 0; });     // kitchen, dairy, sewing room, mill: 0 = not built
    if (typeof s.shearshed !== "boolean") s.shearshed = false;
    if (!Array.isArray(s.cooking)) s.cooking = [];
    if (typeof s.stoves !== "number") s.stoves = 0;
    if (!Array.isArray(s.queue)) s.queue = [];
    s.cooking.forEach(function (c) { if (!c.maker) c.maker = (RECIPES[c.recipe] || {}).at || "kitchen"; });
    if (!s.potions || typeof s.potions !== "object") s.potions = {};
    if (!Array.isArray(s.orders)) s.orders = [];
    if (typeof s.seed !== "number") s.seed = 12345;
    if (typeof s.made !== "boolean") s.made = false;
    return s;
  }

  // ---- what's on a tile, at a time -----------------------------------------------------------
  function siloUsed(s) { return Object.keys(s.silo).reduce(function (n, k) { return n + (s.silo[k] > 0 ? s.silo[k] : 0); }, 0); }
  function siloCap(s) { return s.silos * SILO_SIZE; }
  function plantOf(t) { return t && (t.crop ? CROPS[t.crop] : t.tree ? TREES[t.tree] : null); }
  /** grow (planted, growing) | ready | spoiled -- and how long until the next change. */
  function stageOf(t, now) {
    var p = plantOf(t);
    if (!p) return null;
    var grow = t.readyAt - t.at, ready = t.readyAt, spoil = ready + grow;
    if (now < ready) return { stage: "growing", progress: Math.max(0, Math.min(1, (now - t.at) / Math.max(1, grow))), left: ready - now };
    if (now < spoil) return { stage: "ready", left: spoil - now };
    return { stage: "spoiled", left: 0 };
  }
  function ownedTile(s, x, y) {
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
    return s.parcels.indexOf(Math.floor(x / PARCEL) + "," + Math.floor(y / PARCEL)) >= 0;
  }
  function tileAt(s, x, y) { return s.tiles[key(x, y)] || null; }
  /** An animal: hungry (waiting to be fed), working (fed, making something) or ready. */
  function animalStage(a, now) {
    if (a.readyAt == null) return { stage: "hungry", left: 0, progress: 0 };
    if (now < a.readyAt) return { stage: "working", left: a.readyAt - now, progress: Math.max(0, Math.min(1, (now - a.at) / Math.max(1, a.readyAt - a.at))) };
    return { stage: "ready", left: 0, progress: 1 };
  }
  function eachHouse(s, fn) {
    Object.keys(s.tiles).forEach(function (k) { var t = s.tiles[k]; if (t.house) { var xy = k.split(","); fn(t.house, +xy[0], +xy[1], t); } });
  }
  function houseCount(s, kind) { var n = 0; eachHouse(s, function (h) { if (h.kind === kind) n++; }); return n; }
  function animalCount(s, kind) { var n = 0; eachHouse(s, function (h) { h.animals.forEach(function (a) { if (a.kind === kind) n++; }); }); return n; }
  /** The tile a click lands on, and the tile that holds what's there (a 2x2's top-left). */
  function anchorOf(s, x, y) {
    var t = tileAt(s, x, y);
    if (t && t.part) return { x: t.part[0], y: t.part[1], t: tileAt(s, t.part[0], t.part[1]) };
    return { x: x, y: y, t: t };
  }

  // ---- the request board ---------------------------------------------------------------------
  var ORDER_SLOTS = 3, ORDER_WAIT = 15 * MIN;
  function newOrder(s, now) {
    var h = { seed: s.seed }, lv = levelOf(s.xp);
    var pool = Object.keys(CROPS).filter(function (k) { return CROPS[k].level <= lv; }).map(function (k) { return CROPS[k].item; })
      .concat(Object.keys(TREES).filter(function (k) { return TREES[k].level <= lv; }).map(function (k) { return TREES[k].item; }))
      .concat(Object.keys(RECIPES).filter(function (k) { return RECIPES[k].level <= lv && RECIPES[k].tier <= s[RECIPES[k].at]; }))
      .concat(ANIMAL_ORDER.filter(function (k) { return animalCount(s, k) > 0 && (!ANIMALS[k].shears || s.shearshed); }).map(function (k) { return ANIMALS[k].makes; }));
    var n = 1 + Math.floor(rnd(h) * Math.min(3, 1 + Math.floor(lv / 4))), wants = {}, worth = 0;
    for (var i = 0; i < n; i++) {
      var it = pool[Math.floor(rnd(h) * pool.length)], p = PRICES[it] || 10;
      var q = Math.max(1, Math.round((6 + rnd(h) * 10) * 20 / Math.max(10, p)));
      wants[it] = (wants[it] || 0) + q; worth += q * p;
    }
    s.seed = h.seed;
    var potion = "";
    if (rnd(h) < 0.3) { var pr = rnd(h); potion = lv >= POTIONS.instanttonic.level && pr < 0.2 ? "instanttonic" : pr < 0.6 ? "growtonic" : "freshtonic"; }
    s.seed = h.seed;
    return { wants: wants, coins: Math.round(worth * 1.4 / 5) * 5 + 10, xp: Math.max(3, Math.round(worth / 12)), potion: potion, at: now };
  }
  function fillOrders(s, now) {
    while (s.orders.length < ORDER_SLOTS) s.orders.push({ wait: 0 });
    s.orders.forEach(function (o, i) {
      if (!o.wants && now >= (o.wait || 0)) s.orders[i] = newOrder(s, now);
    });
  }

  // ---- time passing: the kitchen ---------------------------------------------------------------
  function advance(state, now) {
    var s = normal(state);
    MAKER_ORDER.forEach(function (m) { startQueued(s, m, s.at && s.at < now ? s.at : now); });
    for (;;) {                                                // in the order they finish: each makes room for the queue
      var c = s.cooking.filter(function (x) { return !x.done && now >= x.until; }).sort(function (a, b) { return a.until - b.until; })[0];
      if (!c) break;
      c.done = true;
      note(s, c.until, "In the " + MAKERS[c.maker].name.toLowerCase() + ": " + nameOf(c.recipe).toLowerCase() + " is ready.");
      startQueued(s, c.maker, c.until);
    }
    if (s.made) fillOrders(s, now);
    s.at = now;
    return s;
  }

  // ---- doing things ---------------------------------------------------------------------------
  function addXp(s, xp, at) {
    var b = levelOf(s.xp);
    s.xp += xp;
    var a = levelOf(s.xp);
    if (a > b) note(s, at, "Level " + a + "! " + unlocksAt(a).join(" · "));
  }
  function unlocksAt(l) {
    var out = [];
    Object.keys(CROPS).forEach(function (k) { if (CROPS[k].level === l) out.push(CROPS[k].name + " to plant"); });
    Object.keys(TREES).forEach(function (k) { if (TREES[k].level === l) out.push(TREES[k].name + "s"); });
    HOUSE_ORDER.forEach(function (k) { if (HOUSES[k].level === l) out.push("a " + HOUSES[k].name.toLowerCase() + " to build"); });
    ANIMAL_ORDER.forEach(function (k) { if (ANIMALS[k].level === l) out.push(ANIMALS[k].name + (k === "sheep" ? "" : "s") + " to raise"); });
    if (SHEARSHED.level === l) out.push("a shearer's shed to build");
    if (POTIONS.instanttonic.level === l) out.push("Instant tonics from the request board");
    Object.keys(RECIPES).forEach(function (k) { if (RECIPES[k].level === l) out.push(nameOf(k) + " to " + MAKERS[RECIPES[k].at].verb.toLowerCase()); });
    MAKER_ORDER.forEach(function (m) { MAKERS[m].tiers.forEach(function (k, i) {
      if (k && k.level === l) out.push(i === 1 ? "a " + MAKERS[m].name.toLowerCase() + " to build" : "a level " + i + " " + MAKERS[m].name.toLowerCase() + " to build"); }); });
    if (l <= PARCELS_W * PARCELS_H) out.push("another parcel of land to buy");
    return out;
  }
  function room(s, n) { return siloUsed(s) + n <= siloCap(s); }
  function has(s, need) { return Object.keys(need).every(function (k) { return (s.silo[k] || 0) >= need[k]; }); }
  function take(s, need) { Object.keys(need).forEach(function (k) { s.silo[k] -= need[k]; if (!s.silo[k]) delete s.silo[k]; }); }
  function give(s, k, n) { s.silo[k] = (s.silo[k] || 0) + n; }

  function harvestAt(s, x, y, now) {
    var a = anchorOf(s, x, y), t = a.t, p = plantOf(t), st = stageOf(t, now);
    if (!p) return { error: "Nothing's growing there." };
    var are = /s$/.test(p.name) ? " aren't" : " isn't";
    if (st.stage === "growing") return { error: "The " + p.name.toLowerCase() + are + " ready yet." };
    if (st.stage === "spoiled") return { error: "The " + p.name.toLowerCase() + (/s$/.test(p.name) ? " have" : " has") + " spoiled -- clear it, or use a Freshness tonic." };
    if (!room(s, p.yield)) return { error: "Your silos are full (" + siloUsed(s) + "/" + siloCap(s) + ") -- sell something or build another silo.", full: true };
    give(s, p.item, p.yield);
    addXp(s, p.xp, now);
    var wood = 0;
    if (t.tree) { t.at = now; t.readyAt = now + p.time * MIN; if (room(s, 1)) { give(s, "wood", 1); wood = 1; } }   // a tree fruits again (and a branch for wood)
    else { delete t.crop; delete t.at; delete t.readyAt; clearParts(s, a.x, a.y); }
    return { item: p.item, n: p.yield, wood: wood };
  }
  function clearParts(s, ax, ay) {
    for (var dy = 0; dy < 3; dy++) for (var dx = 0; dx < 3; dx++) {
      var u = tileAt(s, ax + dx, ay + dy);
      if (u && u.part && u.part[0] === ax && u.part[1] === ay) delete u.part;
    }
  }

  function act(state, action, opts, now) {
    opts = opts || {};
    var s = advance(state, now);
    if (action === "start") {
      var who = String(opts.farmer || "").trim().slice(0, 24), farm = String(opts.farm || "").trim().slice(0, 32);
      if (!who) return no(s, "What's your name, farmer?");
      s.made = true; s.farmer = who; s.farmName = farm || who + "'s Farm";
      fillOrders(s, now);
      return yes(s, now, "Welcome to " + s.farmName + ". The first field's plowed -- plant something!");
    }
    if (!s.made) return no(s, "Start your farm first.");
    var lv = levelOf(s.xp);

    if (action === "plow") {                                   // one tile, or every wild tile you own
      var tiles = [];
      if (opts.all) { for (var py = 0; py < GRID_H; py++) for (var px = 0; px < GRID_W; px++) if (ownedTile(s, px, py) && !(tileAt(s, px, py) || {}).plowed) tiles.push([px, py]); }
      else tiles = [[opts.x | 0, opts.y | 0]];
      tiles = tiles.filter(function (p) { return ownedTile(s, p[0], p[1]) && !(tileAt(s, p[0], p[1]) || {}).plowed; });
      if (!tiles.length) return no(s, opts.all ? "There's nothing wild to plow." : ownedTile(s, opts.x | 0, opts.y | 0) ? "That's plowed already." : "That land isn't yours yet.");
      var pc = tiles.length * PLOW_COST;
      if (s.coins < pc) return no(s, "Plowing costs " + PLOW_COST + " coins a tile -- " + pc + " for that; you have " + s.coins + ".");
      s.coins -= pc;
      tiles.forEach(function (p) { s.tiles[key(p[0], p[1])] = { plowed: true }; });
      addXp(s, tiles.length, now);
      return yes(s, now, "You plowed " + tiles.length + " tile" + (tiles.length === 1 ? "" : "s") + " (" + pc + " coins).");
    }
    if (action === "plant") {
      var crop = CROPS[opts.crop], tree = TREES[opts.tree], what = crop || tree;
      if (!what) return no(s, "There's no seed like that.");
      if (lv < what.level) return no(s, what.name + (/s$/.test(what.name) ? " unlock" : " unlocks") + " at level " + what.level + ".");
      var size = tree ? 2 : crop.size || 1, x0 = opts.x | 0, y0 = opts.y | 0;
      for (var dy = 0; dy < size; dy++) for (var dx = 0; dx < size; dx++) {
        var u = tileAt(s, x0 + dx, y0 + dy);
        if (!ownedTile(s, x0 + dx, y0 + dy)) return no(s, size > 1 ? what.name + " need a 2x2 space on your land." : "That land isn't yours yet.");
        if (!u || !u.plowed) return no(s, size > 1 ? what.name + " need 2x2 plowed tiles." : "Plow it first.");
        if (u.house) return no(s, "There's a building there.");
        if (u.crop || u.tree || u.part) return no(s, "Something's already growing there.");
      }
      var cost = tree ? tree.sapling : crop.seed;
      if (s.coins < cost) return no(s, (tree ? "A sapling" : "Seed") + " costs " + cost + " coins -- you have " + s.coins + ".");
      s.coins -= cost;
      var t = tileAt(s, x0, y0);
      t.at = now; t.readyAt = now + what.time * MIN;
      if (tree) t.tree = opts.tree; else t.crop = opts.crop;
      for (dy = 0; dy < size; dy++) for (dx = 0; dx < size; dx++) if (dx || dy) tileAt(s, x0 + dx, y0 + dy).part = [x0, y0];
      return { ok: true, msg: "You planted " + what.name.toLowerCase() + " (" + cost + " coins).", state: s };
    }
    if (action === "harvest") {
      if (!opts.all) {
        var h = harvestAt(s, opts.x | 0, opts.y | 0, now);
        if (h.error) return no(s, h.error);
        return { ok: true, msg: "You harvested " + h.n + " × " + nameOf(h.item).toLowerCase() + (h.wood ? " (and some wood)" : "") + ".", state: s };
      }
      var got = {}, full = false;
      Object.keys(s.tiles).forEach(function (k) {
        var t2 = s.tiles[k], st = stageOf(t2, now);
        if (!st || st.stage !== "ready" || full) return;
        var xy = k.split(","), r = harvestAt(s, +xy[0], +xy[1], now);
        if (r.full) full = true; else if (r.item) { got[r.item] = (got[r.item] || 0) + r.n; if (r.wood) got.wood = (got.wood || 0) + 1; }
      });
      if (!Object.keys(got).length) return no(s, full ? "Your silos are full -- sell something or build another silo." : "Nothing's ready to harvest.");
      return yes(s, now, "You harvested " + itemsText(got) + "." + (full ? " Your silos filled up -- the rest is waiting." : ""));
    }
    if (action === "clear") {
      var c = anchorOf(s, opts.x | 0, opts.y | 0);
      if (c.t && c.t.house) return no(s, "That's a building -- take it down from its own panel.");
      if (!plantOf(c.t)) return no(s, "There's nothing to clear.");
      var was = plantOf(c.t).name, chopped = c.t.tree && room(s, 4) ? 4 : 0;
      delete c.t.crop; delete c.t.tree; delete c.t.at; delete c.t.readyAt; clearParts(s, c.x, c.y);
      if (chopped) give(s, "wood", chopped);
      return yes(s, now, "You cleared the " + was.toLowerCase() + (chopped ? " -- " + chopped + " wood" : "") + ".");
    }
    if (action === "potion") {
      var po = POTIONS[opts.potion];
      if (!po) return no(s, "There's no tonic like that.");
      if (!(s.potions[opts.potion] > 0)) return no(s, "You have no " + po.name.toLowerCase() + " -- the request board gives them.");
      if (opts.potion === "instanttonic" && opts.maker) {          // a workshop: the next thing it's making, done
        var job = s.cooking.filter(function (c) { return !c.done && c.maker === opts.maker; }).sort(function (a, b) { return a.until - b.until; })[0];
        if (!job) return no(s, "Nothing's being made there.");
        job.until = now; job.done = true;
        s.potions.instanttonic--;
        startQueued(s, opts.maker, now);
        return yes(s, now, "Instant tonic: " + nameOf(job.recipe).toLowerCase() + " is ready.");
      }
      var pa = anchorOf(s, opts.x | 0, opts.y | 0), ps = stageOf(pa.t, now);
      if (opts.potion === "instanttonic" && pa.t && pa.t.house) {    // a building: everyone working, done
        var hurried = 0;
        pa.t.house.animals.forEach(function (a) { if (animalStage(a, now).stage === "working") { a.readyAt = now; hurried++; } });
        if (!hurried) return no(s, "Nobody in there is working -- feed them first.");
        s.potions.instanttonic--;
        return yes(s, now, "Instant tonic: " + hurried + " animal" + (hurried === 1 ? "'s" : "s'") + " work is done.");
      }
      if (!ps) return no(s, opts.potion === "instanttonic" ? "Use it on a crop, a tree, a building with animals at work, or in a workshop." : "Use it on a crop or a tree.");
      if (opts.potion === "instanttonic") {
        if (ps.stage !== "growing") return no(s, "It's already grown.");
        var g3 = pa.t.readyAt - pa.t.at;
        pa.t.readyAt = now; pa.t.at = now - g3;
      } else if (opts.potion === "growtonic") {
        if (ps.stage !== "growing") return no(s, "It's already grown.");
        var left = pa.t.readyAt - now, grow = pa.t.readyAt - pa.t.at;
        pa.t.readyAt = now + Math.round(left / 2);
        pa.t.at = pa.t.readyAt - grow;                       // the spoil window stays as long as the growing
      } else {
        if (ps.stage !== "spoiled") return no(s, "It hasn't spoiled.");
        var g2 = pa.t.readyAt - pa.t.at;
        pa.t.readyAt = now; pa.t.at = now - g2;
      }
      s.potions[opts.potion]--;
      return yes(s, now, "You used a " + po.name.toLowerCase() + " on the " + plantOf(pa.t).name.toLowerCase() + ".");
    }
    if (action === "buyland") {
      var pk = (opts.px | 0) + "," + (opts.py | 0);
      if (opts.px < 0 || opts.py < 0 || opts.px >= PARCELS_W || opts.py >= PARCELS_H) return no(s, "There's no land there.");
      if (s.parcels.indexOf(pk) >= 0) return no(s, "That land is yours already.");
      if (s.parcels.length >= lv) return no(s, "You can buy another parcel at level " + (s.parcels.length + 1) + ".");
      var next = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return s.parcels.indexOf(((opts.px | 0) + d[0]) + "," + ((opts.py | 0) + d[1])) >= 0; });
      if (!next) return no(s, "Buy land next to your farm.");
      var lc = parcelCost(s.parcels.length);
      if (s.coins < lc) return no(s, "That parcel costs " + lc + " coins -- you have " + s.coins + ".");
      s.coins -= lc; s.parcels.push(pk);
      return yes(s, now, "You bought a new parcel of land (" + lc + " coins). Plow it to plant.");
    }
    if (action === "build") {
      if (opts.what === "silo") {
        var sc = siloCost(s.silos);
        if (s.coins < sc.coins || !has(s, sc.needs)) return no(s, "Another silo takes " + sc.coins + " coins and " + itemsText(sc.needs) + ".");
        s.coins -= sc.coins; take(s, sc.needs); s.silos++;
        addXp(s, 10 * s.silos, now);
        return yes(s, now, "You built silo " + s.silos + ": room for " + siloCap(s) + " now.");
      }
      if (opts.what === "stove") {
        var sn = (s.stoves || 0) + 1, st = STOVES[sn];
        if (!s.kitchen) return no(s, "Build the kitchen first.");
        if (!st) return no(s, "Your kitchen has all the stoves it can fit.");
        if (lv < st.level) return no(s, "Stove " + (sn + 1) + " needs farm level " + st.level + ".");
        if (s.coins < st.coins || !has(s, st.needs)) return no(s, "A stove takes " + st.coins + " coins and " + itemsText(st.needs) + ".");
        s.coins -= st.coins; take(s, st.needs); s.stoves = sn;
        addXp(s, 15 * sn, now);
        startQueued(s, "kitchen", now);
        return yes(s, now, "A new stove: your kitchen cooks " + slots(s, "kitchen") + " things at once now.");
      }
      if (MAKERS[opts.what]) {
        var mk = MAKERS[opts.what], mn = mk.name.toLowerCase(), cur = s[opts.what], kn = mk.tiers[cur + 1];
        if (!kn) return no(s, "Your " + mn + " is as big as it gets.");
        if (lv < kn.level) return no(s, "A level " + (cur + 1) + " " + mn + " needs farm level " + kn.level + ".");
        if (s.coins < kn.coins || !has(s, kn.needs)) return no(s, "It takes " + kn.coins + " coins and " + itemsText(kn.needs) + ".");
        s.coins -= kn.coins; take(s, kn.needs); s[opts.what] = cur + 1;
        addXp(s, 20 * s[opts.what], now);
        startQueued(s, opts.what, now);
        if (opts.what === "kitchen")
          return yes(s, now, s.kitchen === 1 ? "You built a kitchen: cook what you grow, and sell it for more." : "Your kitchen is level " + s.kitchen + " now: more recipes, and " + slots(s, "kitchen") + " things on the go.");
        return yes(s, now, cur === 0 ? "You built a " + mn + "." : "Your " + mn + " is level " + s[opts.what] + " now: more to make, and " + s[opts.what] + " things on the go.");
      }
      if (opts.what === "shearshed") {
        if (s.shearshed) return no(s, "You have a shearer's shed.");
        if (lv < SHEARSHED.level) return no(s, "A shearer's shed needs farm level " + SHEARSHED.level + ".");
        if (s.coins < SHEARSHED.coins || !has(s, SHEARSHED.needs)) return no(s, "It takes " + SHEARSHED.coins + " coins and " + itemsText(SHEARSHED.needs) + ".");
        s.coins -= SHEARSHED.coins; take(s, SHEARSHED.needs); s.shearshed = true;
        addXp(s, 40, now);
        return yes(s, now, "You built a shearer's shed: your sheep's wool can come off now.");
      }
      return no(s, "There's nothing like that to build.");
    }
    if (action === "cook") {
      var rc = RECIPES[opts.recipe];
      if (!rc) return no(s, "There's no recipe like that.");
      var at = rc.at, mname = MAKERS[at].name.toLowerCase(), tier = s[at];
      if (tier < rc.tier) return no(s, nameOf(opts.recipe) + " needs a level " + rc.tier + " " + mname + ".");
      if (lv < rc.level) return no(s, nameOf(opts.recipe) + " unlocks at level " + rc.level + ".");
      if (!has(s, rc.needs)) return no(s, nameOf(opts.recipe) + " takes " + itemsText(rc.needs) + ".");
      if (busy(s, at) >= slots(s, at)) {                       // no room: into the queue
        var nq = queued(s, at).length;
        if (nq >= QUEUE_MAX) return no(s, "Your " + mname + "'s queue is full -- " + QUEUE_MAX + " things waiting.");
        take(s, rc.needs);
        s.queue.push({ recipe: opts.recipe, maker: at, at: now });
        return yes(s, now, nameOf(opts.recipe) + " is queued (" + (nq + 1) + " waiting) -- it starts when there's room.");
      }
      take(s, rc.needs);
      s.cooking.push({ recipe: opts.recipe, maker: at, at: now, until: now + rc.time * MIN, done: false });
      return yes(s, now, MAKERS[at].doing + " " + nameOf(opts.recipe).toLowerCase() + " (" + rc.time + " minutes).");
    }
    if (action === "unqueue") {                               // take something out of the queue: what it took comes back
      var mq = queued(s, opts.maker), it = mq[opts.i | 0];
      if (!it) return no(s, "That isn't in the queue any more.");
      s.queue.splice(s.queue.indexOf(it), 1);
      Object.keys(RECIPES[it.recipe].needs).forEach(function (k) { give(s, k, RECIPES[it.recipe].needs[k]); });
      return yes(s, now, nameOf(it.recipe) + " taken out of the queue -- " + itemsText(RECIPES[it.recipe].needs) + " back in your silos.");
    }
    if (action === "collect") {                              // finished dishes, into the silos
      var only = opts.maker || "";
      var done = s.cooking.filter(function (x) { return x.done && (!only || x.maker === only); });
      if (!done.length) return no(s, only && only !== "kitchen" ? "Nothing's finished in the " + MAKERS[only].name.toLowerCase() + "." : "Nothing's finished cooking.");
      var took = {}, left2 = [];
      s.cooking.forEach(function (x) {
        if (!x.done || (only && x.maker !== only)) { left2.push(x); return; }
        if (!room(s, 1)) { left2.push(x); return; }
        give(s, x.recipe, 1); took[x.recipe] = (took[x.recipe] || 0) + 1; addXp(s, RECIPES[x.recipe].xp, now);
      });
      s.cooking = left2;
      if (!Object.keys(took).length) return no(s, "Your silos are full.");
      return yes(s, now, (only ? "From the " + MAKERS[only].name.toLowerCase() : "Collected") + ": " + itemsText(took) + ".");
    }
    if (action === "sell") {
      var have = s.silo[opts.item] || 0;
      if (!have) return no(s, "You have none to sell.");
      var sn = opts.n === "all" ? have : Math.max(1, Math.min(have, opts.n | 0 || 1)), each = PRICES[opts.item] || 1;
      s.silo[opts.item] -= sn; if (!s.silo[opts.item]) delete s.silo[opts.item];
      s.coins += sn * each;
      return yes(s, now, "You sold " + sn + " × " + nameOf(opts.item).toLowerCase() + " for " + sn * each + " coins.");
    }
    if (action === "order") {
      var o = s.orders[opts.slot | 0];
      if (!o || !o.wants) return no(s, "There's no order there yet.");
      if (!has(s, o.wants)) return no(s, "This order wants " + itemsText(o.wants) + ".");
      take(s, o.wants);
      s.coins += o.coins; addXp(s, o.xp, now);
      if (o.potion) s.potions[o.potion] = (s.potions[o.potion] || 0) + 1;
      s.orders[opts.slot | 0] = { wait: now + ORDER_WAIT };
      return yes(s, now, "Order filled: " + o.coins + " coins, " + o.xp + " xp" + (o.potion ? " and a " + POTIONS[o.potion].name.toLowerCase() : "") + ".");
    }
    if (action === "skiporder") {                            // not for you: a new one in a while
      if (!s.orders[opts.slot | 0] || !s.orders[opts.slot | 0].wants) return no(s, "There's no order there.");
      s.orders[opts.slot | 0] = { wait: now + ORDER_WAIT };
      return yes(s, now, "You took the order down. Another goes up in " + ORDER_WAIT / MIN + " minutes.");
    }
    if (action === "buy") {                                   // the market's supplies (wood)
      var bp = SUPPLIES[opts.item];
      if (!bp) return no(s, "The market doesn't sell that.");
      var bn = Math.max(1, opts.n | 0 || 1);
      if (s.coins < bn * bp) return no(s, bn + " × " + nameOf(opts.item).toLowerCase() + " costs " + bn * bp + " coins -- you have " + s.coins + ".");
      if (!room(s, bn)) return no(s, "Your silos are full -- there's no room for it.");
      s.coins -= bn * bp; give(s, opts.item, bn);
      return yes(s, now, "You bought " + bn + " × " + nameOf(opts.item).toLowerCase() + " for " + bn * bp + " coins.");
    }

    // ---- animals ----
    if (action === "place") {                                 // an animal house, on your land
      var hk = HOUSES[opts.house];
      if (!hk) return no(s, "There's no building like that.");
      if (lv < hk.level) return no(s, "A " + hk.name.toLowerCase() + " unlocks at level " + hk.level + ".");
      var hx = opts.x | 0, hy = opts.y | 0, hs = hk.size;
      for (var qy = 0; qy < hs; qy++) for (var qx = 0; qx < hs; qx++) {
        var q = tileAt(s, hx + qx, hy + qy);
        if (!ownedTile(s, hx + qx, hy + qy)) return no(s, "A " + hk.name.toLowerCase() + " needs a " + hs + "x" + hs + " space on your land.");
        if (q && (q.crop || q.tree || q.part || q.house)) return no(s, "There's something in the way -- a " + hk.name.toLowerCase() + " needs " + hs + "x" + hs + " clear tiles.");
      }
      var hc = houseCost(opts.house, houseCount(s, opts.house));
      if (s.coins < hc.coins || !has(s, hc.needs)) return no(s, "A " + hk.name.toLowerCase() + " takes " + hc.coins + " coins and " + itemsText(hc.needs) + ".");
      s.coins -= hc.coins; take(s, hc.needs);
      for (qy = 0; qy < hs; qy++) for (qx = 0; qx < hs; qx++) {
        s.tiles[key(hx + qx, hy + qy)] = (qx || qy) ? { plowed: true, part: [hx, hy] } : { plowed: true, house: { kind: opts.house, animals: [] } };
      }
      addXp(s, 25, now);
      return yes(s, now, "You built a " + hk.name.toLowerCase() + ". Buy " + hk.animals.map(function (a) { return ANIMALS[a].name.toLowerCase() + (a === "sheep" ? "" : "s"); }).join(" or ") + " for it.");
    }
    var hAt = opts.all ? null : anchorOf(s, opts.x | 0, opts.y | 0), house = hAt && hAt.t && hAt.t.house;
    if (action === "buyanimal") {
      var an = ANIMALS[opts.animal];
      if (!an) return no(s, "There's no animal like that.");
      if (!house) return no(s, "Choose a building for it.");
      if (HOUSES[house.kind].animals.indexOf(opts.animal) < 0) return no(s, an.name + "s don't live in a " + HOUSES[house.kind].name.toLowerCase() + ".");
      if (lv < an.level) return no(s, an.name + (opts.animal === "sheep" ? "" : "s") + " unlock at level " + an.level + ".");
      if (house.animals.length >= HOUSES[house.kind].cap) return no(s, "This " + HOUSES[house.kind].name.toLowerCase() + " is full (" + HOUSES[house.kind].cap + ") -- build another.");
      if (s.coins < an.cost) return no(s, "A " + an.name.toLowerCase() + " costs " + an.cost + " coins -- you have " + s.coins + ".");
      s.coins -= an.cost; house.animals.push({ kind: opts.animal });
      return yes(s, now, "A new " + an.name.toLowerCase() + "! Feed it " + itemsText(an.eats) + " and it makes " + nameOf(an.makes).toLowerCase() + ".");
    }
    if (action === "sellanimal") {
      if (!house || !house.animals[opts.i | 0]) return no(s, "There's no animal there.");
      var gone = house.animals.splice(opts.i | 0, 1)[0], back = Math.floor(ANIMALS[gone.kind].cost / 2);
      s.coins += back;
      return yes(s, now, "You sold a " + ANIMALS[gone.kind].name.toLowerCase() + " for " + back + " coins.");
    }
    if (action === "demolish") {
      if (!house) return no(s, "There's no building there.");
      if (house.animals.length) return no(s, "Sell its animals first.");
      var dk = HOUSES[house.kind], wb = Math.floor((dk.needs.wood || 0) / 2);
      for (qy = 0; qy < dk.size; qy++) for (qx = 0; qx < dk.size; qx++) s.tiles[key(hAt.x + qx, hAt.y + qy)] = { plowed: true };
      if (wb && room(s, wb)) give(s, "wood", wb); else wb = 0;
      return yes(s, now, "You took down the " + dk.name.toLowerCase() + (wb ? " and saved " + wb + " wood" : "") + ".");
    }
    if (action === "feed" || action === "gather") {
      var list = [];
      if (opts.all) eachHouse(s, function (hh) { list.push(hh); });
      else if (house) list.push(house);
      else return no(s, "There's no building there.");
      if (action === "feed") {
        var fed = 0, short = {};
        list.forEach(function (hh) { hh.animals.forEach(function (a) {
          var A = ANIMALS[a.kind];
          if (a.readyAt != null) return;
          if (!has(s, A.eats)) { Object.keys(A.eats).forEach(function (k) { short[k] = true; }); return; }
          take(s, A.eats); a.at = now; a.readyAt = now + A.time * MIN; fed++;
        }); });
        if (!fed) return no(s, Object.keys(short).length ? "Not enough feed -- they eat " + Object.keys(short).map(function (k) { return nameOf(k).toLowerCase(); }).join(" and ") + "." : "Nobody's hungry.");
        return yes(s, now, "You fed " + fed + " animal" + (fed === 1 ? "" : "s") + "." + (Object.keys(short).length ? " Some are still hungry -- you're out of " + Object.keys(short).map(function (k) { return nameOf(k).toLowerCase(); }).join(" and ") + "." : ""));
      }
      var gotA = {}, fullA = false, noShed = false, gxp = 0;
      list.forEach(function (hh) { hh.animals.forEach(function (a) {
        var A = ANIMALS[a.kind];
        if (animalStage(a, now).stage !== "ready") return;
        if (A.shears && !s.shearshed) { noShed = true; return; }
        if (!room(s, A.n)) { fullA = true; return; }
        give(s, A.makes, A.n); gotA[A.makes] = (gotA[A.makes] || 0) + A.n; gxp += A.xp;
        delete a.at; delete a.readyAt;
      }); });
      if (!Object.keys(gotA).length) return no(s, fullA ? "Your silos are full -- sell something or build another silo."
        : noShed ? "Your sheep need shearing -- build a shearer's shed first." : "Nothing's ready to collect yet.");
      addXp(s, gxp, now);
      return yes(s, now, "You collected " + itemsText(gotA) + "." + (fullA ? " Your silos filled up -- the rest is waiting." : "") + (noShed ? " (The sheep need a shearer's shed.)" : ""));
    }
    return no(s, "Nothing to do there.");
  }
  function busy(s, at) { return s.cooking.filter(function (x) { return !x.done && x.maker === at; }).length; }
  /** How many things a workshop has on the go at once: its level, and the kitchen's extra stoves. */
  function slots(s, m) { return (s[m] || 0) + (m === "kitchen" && s[m] ? s.stoves || 0 : 0); }
  function queued(s, m) { return s.queue.filter(function (q) { return q.maker === m; }); }
  /** The queue's next things into free room, starting at `at`. */
  function startQueued(s, m, at) {
    while (busy(s, m) < slots(s, m)) {
      var i = -1;
      for (var k = 0; k < s.queue.length; k++) if (s.queue[k].maker === m) { i = k; break; }
      if (i < 0) return;
      var q = s.queue.splice(i, 1)[0], rc = RECIPES[q.recipe];
      s.cooking.push({ recipe: q.recipe, maker: m, at: at, until: at + rc.time * MIN, done: false });
    }
  }

  // ---- views ---------------------------------------------------------------------------------
  function houseView(s, h, x, y, now) {
    var H = HOUSES[h.kind], animals = h.animals.map(function (a, i) { var A = ANIMALS[a.kind], st = animalStage(a, now);
      return { i: i, kind: a.kind, name: A.name, stage: st.stage, left: st.left, progress: st.progress, makes: A.makes, n: A.n, eats: A.eats,
               stuck: st.stage === "ready" && !!A.shears && !s.shearshed }; });
    var feedNeed = {};
    animals.forEach(function (a) { if (a.stage === "hungry") Object.keys(a.eats).forEach(function (k) { feedNeed[k] = (feedNeed[k] || 0) + a.eats[k]; }); });
    return { x: x, y: y, kind: h.kind, name: H.name, size: H.size, cap: H.cap, can: H.animals, animals: animals,
             ready: animals.filter(function (a) { return a.stage === "ready" && !a.stuck; }).length, hungry: animals.filter(function (a) { return a.stage === "hungry"; }).length,
             working: animals.filter(function (a) { return a.stage === "working"; }).length, feedNeed: feedNeed, canFeed: Object.keys(feedNeed).length > 0 && animals.some(function (a) { return a.stage === "hungry" && has(s, a.eats); }) };
  }
  function view(state, now) {
    var s = advance(state, now), lv = levelOf(s.xp);
    var tiles = [];
    for (var y = 0; y < GRID_H; y++) for (var x = 0; x < GRID_W; x++) {
      var t = tileAt(s, x, y), owned = ownedTile(s, x, y), st = stageOf(t, now), p = plantOf(t);
      tiles.push({ x: x, y: y, owned: owned, plowed: !!(t && t.plowed), part: t && t.part ? t.part : null,
                   plant: p ? { id: t.crop || t.tree, tree: !!t.tree, name: p.name, item: p.item, size: t.tree ? 2 : p.size || 1 } : null,
                   house: t && t.house ? houseView(s, t.house, x, y, now) : null,
                   stage: st ? st.stage : "", progress: st && st.progress, left: st ? st.left : 0 });
    }
    var parcels = [];
    for (var py = 0; py < PARCELS_H; py++) for (var px = 0; px < PARCELS_W; px++) {
      var k = px + "," + py, own = s.parcels.indexOf(k) >= 0;
      var nextTo = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return s.parcels.indexOf((px + d[0]) + "," + (py + d[1])) >= 0; });
      parcels.push({ px: px, py: py, owned: own, buyable: !own && nextTo, cost: parcelCost(s.parcels.length), canAfford: s.coins >= parcelCost(s.parcels.length),
                     levelOk: s.parcels.length < lv, needLevel: s.parcels.length + 1 });
    }
    var silo = Object.keys(s.silo).filter(function (k) { return s.silo[k] > 0; }).map(function (k) { return { id: k, name: nameOf(k), n: s.silo[k], price: PRICES[k] || 1 }; })
      .sort(function (a, b) { return b.price - a.price; });
    return {
      made: s.made, farmer: s.farmer || "", farmName: s.farmName || "", coins: s.coins, xp: s.xp, level: lv, toNext: lv >= MAX_LEVEL ? 0 : XP[lv + 1] - s.xp,
      progress: lv >= MAX_LEVEL ? 1 : (s.xp - XP[lv]) / (XP[lv + 1] - XP[lv]), grid: { w: GRID_W, h: GRID_H, parcel: PARCEL }, tiles: tiles, parcels: parcels,
      silo: silo, siloUsed: siloUsed(s), siloCap: siloCap(s), silos: s.silos, nextSilo: siloCost(s.silos),
      crops: Object.keys(CROPS).map(function (k) { var c = CROPS[k]; return { id: k, name: c.name, item: c.item, level: c.level, open: lv >= c.level, time: c.time, cost: c.seed, yield: c.yield, size: c.size || 1, worth: c.yield * PRICES[c.item], xp: c.xp }; }).sort(function (a, b) { return a.level - b.level; }),
      trees: Object.keys(TREES).map(function (k) { var c = TREES[k]; return { id: k, name: c.name, item: c.item, level: c.level, open: lv >= c.level, time: c.time, cost: c.sapling, yield: c.yield, size: 2, worth: c.yield * PRICES[c.item], xp: c.xp }; }).sort(function (a, b) { return a.level - b.level; }),
      kitchen: s.kitchen, nextKitchen: KITCHEN[s.kitchen + 1] ? Object.assign({ n: s.kitchen + 1 }, KITCHEN[s.kitchen + 1]) : null,
      recipes: Object.keys(RECIPES).map(function (k) { var r = RECIPES[k];
        var raw = Object.keys(r.needs).reduce(function (n, i) { return n + r.needs[i] * (PRICES[i] || 0); }, 0);
        return { id: k, name: nameOf(k), tier: r.tier, kitchen: r.tier, level: r.level, time: r.time, needs: Object.keys(r.needs).map(function (i) { return { id: i, name: nameOf(i), need: r.needs[i], have: s.silo[i] || 0 }; }),
                 at: r.at, tier: r.tier, xp: r.xp, price: PRICES[k], raw: raw, open: s[r.at] >= r.tier && lv >= r.level, can: s[r.at] >= r.tier && lv >= r.level && has(s, r.needs) }; }),
      cooking: s.cooking.map(function (c) { return { recipe: c.recipe, maker: c.maker, name: nameOf(c.recipe), done: c.done, left: Math.max(0, c.until - now), progress: Math.min(1, (now - c.at) / Math.max(1, c.until - c.at)) }; }),
      kitchenFree: slots(s, "kitchen") - busy(s, "kitchen"),
      makers: MAKER_ORDER.map(function (m) { var M = MAKERS[m], nx = M.tiers[s[m] + 1];
        var st = m === "kitchen" && s[m] ? STOVES[(s.stoves || 0) + 1] : null;
        return { id: m, name: M.name, verb: M.verb, doing: M.doing, tier: s[m], max: M.tiers.length - 1, slots: slots(s, m), free: slots(s, m) - busy(s, m),
                 queue: queued(s, m).map(function (q, i) { return { i: i, recipe: q.recipe, name: nameOf(q.recipe) }; }), queueMax: QUEUE_MAX,
                 stoves: m === "kitchen" ? { have: s.stoves || 0, max: STOVES.length - 1,
                   next: st ? { n: (s.stoves || 0) + 1, coins: st.coins, needs: st.needs, level: st.level, can: lv >= st.level && s.coins >= st.coins && has(s, st.needs) } : null } : null,
                 next: nx ? { n: s[m] + 1, coins: nx.coins, needs: nx.needs, level: nx.level, can: lv >= nx.level && s.coins >= nx.coins && has(s, nx.needs) } : null,
                 opensAt: M.tiers[1].level, done: s.cooking.filter(function (c) { return c.done && c.maker === m; }).length }; }),
      houses: (function () { var out = []; eachHouse(s, function (h, x, y) { out.push(houseView(s, h, x, y, now)); });
        return out.sort(function (a, b) { return HOUSE_ORDER.indexOf(a.kind) - HOUSE_ORDER.indexOf(b.kind) || a.y - b.y || a.x - b.x; }); })(),
      houseShop: HOUSE_ORDER.map(function (k) { var H = HOUSES[k], c = houseCost(k, houseCount(s, k));
        return { id: k, name: H.name, size: H.size, cap: H.cap, level: H.level, open: lv >= H.level, cost: c, owned: houseCount(s, k),
                 can: lv >= H.level && s.coins >= c.coins && has(s, c.needs), animals: H.animals.map(function (a) { return ANIMALS[a].name; }) }; }),
      animalShop: ANIMAL_ORDER.map(function (k) { var A = ANIMALS[k];
        return { id: k, name: A.name, house: A.house, houseName: HOUSES[A.house].name, level: A.level, open: lv >= A.level, cost: A.cost,
                 eats: A.eats, time: A.time, makes: A.makes, makesName: nameOf(A.makes), n: A.n, xp: A.xp, shears: !!A.shears, owned: animalCount(s, k) }; }),
      shearshed: { built: s.shearshed, coins: SHEARSHED.coins, needs: SHEARSHED.needs, level: SHEARSHED.level,
                   can: !s.shearshed && lv >= SHEARSHED.level && s.coins >= SHEARSHED.coins && has(s, SHEARSHED.needs) },
      supplies: Object.keys(SUPPLIES).map(function (k) { return { id: k, name: nameOf(k), price: SUPPLIES[k], have: s.silo[k] || 0 }; }),
      orders: s.orders.map(function (o, i) { return o.wants ? { slot: i, wants: Object.keys(o.wants).map(function (k) { return { id: k, name: nameOf(k), need: o.wants[k], have: s.silo[k] || 0 }; }),
                                                               coins: o.coins, xp: o.xp, potion: o.potion ? POTIONS[o.potion].name : "", potionId: o.potion || "", can: has(s, o.wants) }
                                                           : { slot: i, wait: Math.max(0, (o.wait || 0) - now) }; }),
      potions: Object.keys(POTIONS).map(function (k) { return { id: k, name: POTIONS[k].name, about: POTIONS[k].about, n: s.potions[k] || 0, level: POTIONS[k].level || 1 }; }),
      ready: tiles.filter(function (t) { return t.stage === "ready" && !t.part; }).length,
      spoiled: tiles.filter(function (t) { return t.stage === "spoiled" && !t.part; }).length,
      wild: tiles.filter(function (t) { return t.owned && !t.plowed; }).length,
      animalsReady: tiles.reduce(function (n, t) { return n + (t.house ? t.house.ready : 0); }, 0),
      animalsHungry: tiles.reduce(function (n, t) { return n + (t.house ? t.house.hungry : 0); }, 0),
      log: s.log.slice(0, 8)
    };
  }

  return {
    empty: empty, normal: normal, advance: advance, act: act, view: view, levelOf: levelOf, stageOf: stageOf, unlocksAt: unlocksAt,
    STOVES: STOVES, QUEUE_MAX: QUEUE_MAX, CROPS: CROPS, TREES: TREES, RECIPES: RECIPES, PRICES: PRICES, KITCHEN: KITCHEN, POTIONS: POTIONS, XP: XP, MAX_LEVEL: MAX_LEVEL,
    MAKERS: MAKERS, HOUSES: HOUSES, ANIMALS: ANIMALS, SHEARSHED: SHEARSHED, SUPPLIES: SUPPLIES, houseCost: houseCost, animalStage: animalStage,
    GRID_W: GRID_W, GRID_H: GRID_H, PARCEL: PARCEL, PLOW_COST: PLOW_COST, SILO_SIZE: SILO_SIZE, parcelCost: parcelCost, siloCost: siloCost,
    ORDER_WAIT: ORDER_WAIT, nameOf: nameOf, MIN: MIN, HOUR: HOUR
  };
})();
// the page and the tests find it on window
if (typeof window !== "undefined") window.FarmCore = FarmCore;
