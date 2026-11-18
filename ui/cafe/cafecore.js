/* ==========================================================================
   NeuroCafe -- the rules (2026-10-20, V19: the Stage 1 demo).
   ==========================================================================
   Cam (notes N26-N30): a Cafeland-style cafe -- cook on stoves, serve to
   counters, customers buy and pay at the till, clean, earn coins and XP,
   level up, grow and arrange the cafe. Stage 1 proves the loop on a 4x4
   floor: one stove, one buffet counter and the cash register to start,
   takeaway only, eight breakfast dishes, a chef's tutorial that ends in the
   level-up that opens the 5x5 floor and a second stove and counter (then one
   more of each every 5 levels), and building mode (buy, move, turn four
   ways, store, sell back for half).

   Nothing here touches the page: act(state, action, opts, now) returns a new
   state, and the page saves it (neurocafe.py -> cafe.py). Everything runs by
   the clock, so the cafe keeps going while it's closed -- dishes finish and
   burn, customers come while there's food on the counters (V19, the
   Economist: what's earned away is only ever what was on the counters).
   ========================================================================== */
var CafeCore = (function () {
  "use strict";
  var SEC = 1000, MIN = 60 * SEC;

  // ---- the dishes ------------------------------------------------------------------------------
  // 2026-10-22 (Cam): every menu starts early and opens a dish at a time -- breakfast from level 1, lunch from 3, the
  // bakery & teas from 5, dinner from 7 -- a new dish at every level to 30, then about every other level to 100 (on the levels with nothing else new). The times are
  // still not in level order (N26). 2026-10-23 (Cam): from level 4 a good mix of times -- quick ones (30 s, a minute),
  // short (2-10 min), a half hour or so, a couple of hours, and overnight (8 hours: put it on at night, take it off in
  // the morning) -- level 4 French toast 2 h, level 7 cabbage soup 8 h, then each band comes round every few levels.
  // A serving's price follows its level (4 coins at 1, 13 at 30, 22 at 100), a coin
  // more for an hour's cook, two for three hours or more.
  // servings follow Cafeland's curve: about 10 x minutes^0.55 (a 10 second dish makes very few);
  // a dish costs 40% of what its servings sell for; XP rises with the time.
  var DISHES = [
    { id: "pancakes", name: "Pancakes", level: 1, secs: 10, price: 4 },
    { id: "waffles", name: "Waffles", level: 2, secs: 120, price: 4 },
    { id: "tomatosoup", menu: "lunch", name: "Tomato soup", level: 3, secs: 90, price: 5 },
    { id: "frenchtoast", name: "French toast", level: 4, secs: 7200, price: 6 },
    { id: "berrytart", menu: "bakery", name: "Berry tart", level: 5, secs: 600, price: 5 },
    { id: "benedict", name: "Eggs Benedict", level: 6, secs: 300, price: 6 },
    // (Cam, 25 Oct: "we also need some 6 hour recipes, change the cabbage soup to 6 hours" -- and the porridge, the hog
    // roast and the thyme-roast pork with it, so a 6-hour dish comes round every so often between the 8-hour ones)
    { id: "cabbagesoup", menu: "dinner", name: "Cabbage soup", level: 7, secs: 21600, price: 8 },
    { id: "grilledcheese", menu: "lunch", name: "Grilled cheese", level: 8, secs: 45, price: 6 },
    { id: "florentine", name: "Eggs Florentine", level: 9, secs: 1800, price: 6 },
    { id: "honeycake", menu: "bakery", name: "Honey cake", level: 10, secs: 3600, price: 8 },
    { id: "avocado", name: "Avocado toast", level: 11, secs: 30, price: 7 },
    { id: "carrotsoup", menu: "dinner", name: "Carrot soup", level: 12, secs: 14400, price: 9 },
    { id: "caesarsalad", menu: "lunch", name: "Caesar salad", level: 13, secs: 60, price: 8 },
    { id: "eggsbacon", name: "Eggs and bacon", level: 14, secs: 900, price: 8 },
    { id: "custardtart", menu: "bakery", name: "Custard tart", level: 15, secs: 28800, price: 10 },
    { id: "bakedpotato", menu: "dinner", name: "Baked potato", level: 16, secs: 5400, price: 10 },
    { id: "omelette", name: "Omelette", level: 17, secs: 300, price: 9 },
    { id: "fishchips", menu: "lunch", name: "Fish and chips", level: 18, secs: 1200, price: 9 },
    { id: "scrambled", name: "Scrambled eggs on toast", level: 19, secs: 45, price: 10 },
    { id: "carrotcake", menu: "bakery", name: "Carrot cake", level: 20, secs: 21600, price: 12 },
    { id: "duckeggomelette", menu: "dinner", name: "Duck egg omelette", level: 21, secs: 180, price: 10 },
    { id: "clubsandwich", menu: "lunch", name: "Club sandwich", level: 22, secs: 60, price: 11 },
    { id: "hashbrowns", name: "Hash browns", level: 23, secs: 600, price: 11 },
    { id: "mashedpotato", menu: "dinner", name: "Mashed potatoes", level: 24, secs: 2400, price: 11 },
    { id: "dragonfruittart", menu: "bakery", name: "Dragonfruit tart", level: 25, secs: 7200, price: 12 },
    { id: "porridge", name: "Porridge", level: 26, secs: 21600, price: 14 },
    { id: "cheeseburger", menu: "lunch", name: "Cheeseburger", level: 27, secs: 240, price: 12 },
    { id: "cheeseomelette", menu: "dinner", name: "Cheese omelette", level: 28, secs: 120, price: 12 },
    { id: "fullbreakfast", name: "Full breakfast", level: 29, secs: 1500, price: 13 },
    { id: "starfruitpie", menu: "bakery", name: "Starfruit pie", level: 30, secs: 180, price: 13 },
    { id: "burrito", name: "Breakfast burrito", level: 31, secs: 60, price: 13 },
    { id: "truffleomelette", menu: "dinner", name: "Truffle omelette", level: 33, secs: 600, price: 13 },
    { id: "strawberrycream", menu: "bakery", name: "Strawberries and cream", level: 34, secs: 30, price: 14 },
    { id: "cheeseboard", menu: "dinner", name: "Cheese board", level: 38, secs: 45, price: 14 },
    { id: "spaghetti", menu: "lunch", name: "Spaghetti bolognese", level: 39, secs: 1800, price: 14 },
    { id: "fishpie", menu: "dinner", name: "Fish pie", level: 41, secs: 7200, price: 15 },
    { id: "honeyyoghurt", menu: "bakery", name: "Honey yoghurt", level: 43, secs: 28800, price: 17 },
    { id: "shakshuka", name: "Shakshuka", level: 45, secs: 1200, price: 15 },
    { id: "cornchowder", menu: "dinner", name: "Corn chowder", level: 47, secs: 21600, price: 17 },
    { id: "chamomiletea", menu: "bakery", name: "Chamomile tea", level: 50, secs: 30, price: 16 },
    { id: "cookedsalmon", menu: "dinner", name: "Salmon fillet", level: 51, secs: 300, price: 16 },
    { id: "creamtea", menu: "bakery", name: "Cream tea", level: 53, secs: 900, price: 16 },
    { id: "grilledtrout", menu: "dinner", name: "Grilled trout", level: 54, secs: 600, price: 16 },
    { id: "lasagne", menu: "lunch", name: "Lasagne", level: 57, secs: 10800, price: 18 },
    { id: "crabcakes", menu: "dinner", name: "Crab cakes", level: 59, secs: 120, price: 17 },
    { id: "fruitoats", name: "Granola and fruit", level: 61, secs: 28800, price: 19 },
    { id: "lobster", menu: "dinner", name: "Lobster", level: 63, secs: 1800, price: 17 },
    { id: "strawberrytart", menu: "bakery", name: "Strawberry tart", level: 65, secs: 3600, price: 19 },
    { id: "roastpork", menu: "dinner", name: "Roast pork", level: 67, secs: 14400, price: 20 },
    { id: "butteredfish", menu: "dinner", name: "Buttered fish", level: 69, secs: 180, price: 18 },
    { id: "minttea", menu: "bakery", name: "Mint tea", level: 71, secs: 60, price: 18 },
    { id: "rosemarychicken", menu: "dinner", name: "Rosemary chicken", level: 73, secs: 7200, price: 20 },
    { id: "cheesepie", menu: "dinner", name: "Cheese pie", level: 74, secs: 2700, price: 19 },
    { id: "oatbowl", name: "Banana oat bowl", level: 78, secs: 45, price: 19 },
    { id: "thymepork", menu: "dinner", name: "Thyme-roast pork", level: 79, secs: 21600, price: 21 },
    { id: "pumpkinpie", menu: "bakery", name: "Pumpkin pie", level: 81, secs: 10800, price: 22 },
    { id: "rabbitstew", menu: "dinner", name: "Rabbit stew", level: 83, secs: 21600, price: 22 },
    { id: "roastchicken", menu: "dinner", name: "Roast chicken", level: 85, secs: 5400, price: 21 },
    { id: "lavendertea", menu: "bakery", name: "Lavender tea", level: 87, secs: 45, price: 20 },
    { id: "steak", menu: "dinner", name: "Steak", level: 90, secs: 240, price: 21 },
    { id: "venisonsteak", menu: "dinner", name: "Venison steak", level: 91, secs: 1200, price: 21 },
    { id: "mintlamb", menu: "dinner", name: "Minted lamb", level: 93, secs: 14400, price: 23 },
    { id: "muttonstew", menu: "dinner", name: "Mutton stew", level: 94, secs: 43200, price: 23 },
    { id: "herbstew", menu: "dinner", name: "Herb stew", level: 98, secs: 3600, price: 23 },
    { id: "trufflestew", menu: "dinner", name: "Truffle stew", level: 100, secs: 28800, price: 24 },
    // V24 step 2 (2026-10-25): the patio's outdoor cooking -- each appliance (APPLIANCES) cooks only its own book of
    // eight, opening from the appliance's level; priced like any dish of their level. A mix of times in each book.
    { id: "corncob", menu: "bbq", name: "Corn on the cob", level: 12, secs: 45, price: 7 },
    { id: "bbqsausages", menu: "bbq", name: "Grilled sausages", level: 14, secs: 300, price: 8 },
    { id: "bbqribs", menu: "bbq", name: "Barbecue ribs", level: 17, secs: 7200, price: 10 },
    { id: "bbqburger", menu: "bbq", name: "Flame-grilled burger", level: 20, secs: 600, price: 10 },
    { id: "halloumi", menu: "bbq", name: "Halloumi skewers", level: 23, secs: 120, price: 11 },
    { id: "bbqwings", menu: "bbq", name: "Sticky chicken wings", level: 27, secs: 1800, price: 12 },
    { id: "lambleg", menu: "bbq", name: "Butterflied leg of lamb", level: 32, secs: 28800, price: 15 },
    { id: "plankfish", menu: "bbq", name: "Cedar-plank salmon", level: 37, secs: 2400, price: 14 },
    { id: "garlicbread", menu: "pizza", name: "Garlic flatbread", level: 18, secs: 30, price: 9 },
    { id: "margherita", menu: "pizza", name: "Margherita pizza", level: 21, secs: 120, price: 10 },
    { id: "focaccia", menu: "pizza", name: "Rosemary focaccia", level: 25, secs: 2400, price: 11 },
    { id: "pepperoni", menu: "pizza", name: "Pepperoni pizza", level: 29, secs: 300, price: 13 },
    { id: "sourdough", menu: "pizza", name: "Slow-proved sourdough", level: 34, secs: 28800, price: 16 },
    { id: "fourcheese", menu: "pizza", name: "Four-cheese pizza", level: 39, secs: 600, price: 14 },
    { id: "roastveg", menu: "pizza", name: "Oven-roast vegetables", level: 44, secs: 7200, price: 16 },
    { id: "calzone", menu: "pizza", name: "Calzone", level: 50, secs: 1800, price: 16 },
    { id: "naan", menu: "tandoor", name: "Garlic naan", level: 24, secs: 30, price: 11 },
    { id: "paneertikka", menu: "tandoor", name: "Paneer tikka", level: 28, secs: 600, price: 12 },
    { id: "tandoorichicken", menu: "tandoor", name: "Tandoori chicken", level: 32, secs: 2400, price: 13 },
    { id: "seekh", menu: "tandoor", name: "Seekh kebabs", level: 36, secs: 120, price: 14 },
    { id: "raan", menu: "tandoor", name: "Raan (slow-roast lamb)", level: 42, secs: 28800, price: 17 },
    { id: "chickentikka", menu: "tandoor", name: "Chicken tikka", level: 48, secs: 300, price: 15 },
    { id: "lambchops", menu: "tandoor", name: "Tandoori lamb chops", level: 55, secs: 1800, price: 16 },
    { id: "tandooriprawns", menu: "tandoor", name: "Tandoori king prawns", level: 62, secs: 7200, price: 18 },
    { id: "gyros", menu: "spit", name: "Gyros pita", level: 30, secs: 120, price: 13 },
    { id: "spitpineapple", menu: "spit", name: "Spit-roast pineapple", level: 35, secs: 45, price: 14 },
    { id: "rotisserie", menu: "spit", name: "Rotisserie chicken", level: 40, secs: 2400, price: 14 },
    { id: "shawarma", menu: "spit", name: "Chicken shawarma", level: 46, secs: 600, price: 15 },
    { id: "hogroast", menu: "spit", name: "Hog roast", level: 52, secs: 21600, price: 18 },
    { id: "churrasco", menu: "spit", name: "Churrasco beef", level: 60, secs: 300, price: 17 },
    { id: "spitduck", menu: "spit", name: "Spit-roast duck", level: 68, secs: 7200, price: 19 },
    { id: "porchetta", menu: "spit", name: "Porchetta", level: 76, secs: 14400, price: 21 },
    { id: "smokedalmonds", menu: "smoker", name: "Smoked almonds", level: 40, secs: 60, price: 14 },
    { id: "smokedcheese", menu: "smoker", name: "Smoked cheese", level: 45, secs: 1800, price: 15 },
    { id: "smokedmac", menu: "smoker", name: "Smoked mac and cheese", level: 52, secs: 600, price: 16 },
    { id: "pulledpork", menu: "smoker", name: "Pulled pork", level: 58, secs: 28800, price: 19 },
    { id: "smokedsalmon", menu: "smoker", name: "Hot-smoked salmon", level: 66, secs: 2400, price: 18 },
    { id: "burntends", menu: "smoker", name: "Burnt ends", level: 75, secs: 7200, price: 20 },
    { id: "smokedturkey", menu: "smoker", name: "Smoked turkey", level: 85, secs: 14400, price: 22 },
    { id: "brisket", menu: "smoker", name: "Smoked beef brisket", level: 95, secs: 43200, price: 23 },
    // 2026-10-22 (Cam): Aunty's secret recipes -- never opened by levelling, only sent in her daily delivery (rarely; the
    // soda bread in the first box). `level` is the least she'll send it at: more of the family secrets as you grow.
    // Two coins a serving above a dish of their level. (NeuroPets' icons, Sheet 4.)
    { id: "bread", menu: "aunty", secret: true, name: "Aunty's soda bread", level: 1, secs: 45, price: 6 },
    { id: "heartystew", menu: "aunty", secret: true, name: "Hearty stew", level: 6, secs: 1500, price: 8 },
    { id: "smokedfish", menu: "aunty", secret: true, name: "Smoked fish", level: 12, secs: 5400, price: 10 },
    { id: "comingofagecake", menu: "aunty", secret: true, name: "Coming-of-age cake", level: 18, secs: 3600, price: 12 },
    { id: "richstew", menu: "aunty", secret: true, name: "Rich stew", level: 25, secs: 2400, price: 13 },
    { id: "cookedsturgeon", menu: "aunty", secret: true, name: "Grilled sturgeon", level: 35, secs: 900, price: 16 },
    { id: "grilledchar", menu: "aunty", secret: true, name: "Grilled char", level: 45, secs: 300, price: 17 },
    { id: "greatwhitesteak", menu: "aunty", secret: true, name: "Great white steak", level: 55, secs: 7200, price: 19 },
    { id: "hammerheadsteak", menu: "aunty", secret: true, name: "Hammerhead steak", level: 70, secs: 600, price: 20 },
    { id: "grilledstingray", menu: "aunty", secret: true, name: "Grilled stingray", level: 85, secs: 10800, price: 24 },
    // N47 / Cam 2026-10-24: Halloween's dishes -- unlocked with candy at the haunted house (EVENT), then yours for good
    { id: "toffeeapple", menu: "halloween", secret: true, event: "halloween", candy: 30, name: "Toffee apples", level: 1, secs: 120, price: 6 },
    { id: "witchfingers", menu: "halloween", secret: true, event: "halloween", candy: 35, name: "Witch-finger biscuits", level: 1, secs: 300, price: 6 },
    { id: "mummyhotdog", menu: "halloween", secret: true, event: "halloween", candy: 40, name: "Mummy hot dogs", level: 1, secs: 240, price: 7 },
    { id: "pumpkinsoup", menu: "halloween", secret: true, event: "halloween", candy: 45, name: "Pumpkin soup", level: 1, secs: 600, price: 7 },
    { id: "spidercupcake", menu: "halloween", secret: true, event: "halloween", candy: 50, name: "Spider cupcakes", level: 1, secs: 900, price: 8 },
    { id: "ghostmeringue", menu: "halloween", secret: true, event: "halloween", candy: 55, name: "Ghost meringues", level: 1, secs: 1800, price: 8 },
    { id: "graveyardbrownie", menu: "halloween", secret: true, event: "halloween", candy: 65, name: "Graveyard brownies", level: 1, secs: 3600, price: 10 },
    { id: "cauldronstew", menu: "halloween", secret: true, event: "halloween", candy: 80, name: "Cauldron stew", level: 1, secs: 14400, price: 12 },
    // V26 q6 (N62 Counter Sheet 1): the milkshake counter's and the sushi bar's own books -- made at the counter and
    // served on its own top. Shakes in 1-4 minutes; sushi 5-20 minutes and dearer.
    { id: "strawshake", menu: "shakes", name: "Strawberry milkshake", level: 9, secs: 60, price: 6 },
    { id: "chocshake", menu: "shakes", name: "Chocolate milkshake", level: 10, secs: 90, price: 6 },
    { id: "vanillamalt", menu: "shakes", name: "Vanilla malt", level: 12, secs: 120, price: 7 },
    { id: "bananashake", menu: "shakes", name: "Banana shake", level: 14, secs: 150, price: 7 },
    { id: "cookieshake", menu: "shakes", name: "Cookies and cream shake", level: 16, secs: 180, price: 8 },
    { id: "mintshake", menu: "shakes", name: "Mint choc chip shake", level: 18, secs: 200, price: 8 },
    { id: "caramelshake", menu: "shakes", name: "Salted caramel shake", level: 20, secs: 220, price: 9 },
    { id: "rainbowshake", menu: "shakes", name: "Rainbow sprinkle shake", level: 24, secs: 240, price: 10 },
    { id: "salmonnigiri", menu: "sushi", name: "Salmon nigiri", level: 22, secs: 300, price: 14 },
    { id: "tunamaki", menu: "sushi", name: "Tuna maki", level: 24, secs: 420, price: 15 },
    { id: "californiaroll", menu: "sushi", name: "California roll", level: 26, secs: 540, price: 15 },
    { id: "tempuraroll", menu: "sushi", name: "Prawn tempura roll", level: 28, secs: 600, price: 16 },
    { id: "dragonroll", menu: "sushi", name: "Dragon roll", level: 31, secs: 900, price: 17 },
    { id: "sashimi", menu: "sushi", name: "Sashimi platter", level: 34, secs: 720, price: 18 },
    { id: "pokebowl", menu: "sushi", name: "Salmon poke bowl", level: 37, secs: 1020, price: 18 },
    { id: "bento", menu: "sushi", name: "Bento box", level: 40, secs: 1200, price: 20 },
    // (Counter Sheet 2's coffees) 2026-11-18 (Cam, PT59 c9: "I want the esspresso machine to be a standalone counter,
    // think barista couter ... like the standalone milkshake counter"): made at the barista counter from its own book,
    // like the shakes -- they used to be brewed by an espresso machine fitted to a serving counter
    { id: "espresso", menu: "coffee", name: "Espresso", level: 7, secs: 30, price: 5 },
    { id: "flatwhite", menu: "coffee", name: "Flat white", level: 8, secs: 60, price: 5 },
    { id: "cappuccino", menu: "coffee", name: "Cappuccino", level: 9, secs: 90, price: 6 },
    { id: "latte", menu: "coffee", name: "Latte", level: 11, secs: 120, price: 6 },
    { id: "mocha", menu: "coffee", name: "Mocha", level: 13, secs: 150, price: 7 },
    { id: "icedcoffee", menu: "coffee", name: "Iced coffee", level: 15, secs: 180, price: 7 },
    { id: "macchiato", menu: "coffee", name: "Caramel macchiato", level: 18, secs: 240, price: 8 },
    { id: "affogato", menu: "coffee", name: "Affogato", level: 21, secs: 300, price: 9 }
  ];
  /** The cookbook's tabs: each dish is on one menu (breakfast unless it says). */
  var MENUS = [{ id: "breakfast", name: "Breakfast", pic: "pancakes" }, { id: "lunch", name: "Lunch", pic: "cheeseburger" },
               { id: "bakery", name: "Bakery & teas", pic: "berrytart" }, { id: "dinner", name: "Dinner", pic: "roastchicken" },
               { id: "aunty", name: "Aunty's secrets", pic: "bread" }, { id: "halloween", name: "Halloween", pic: "pumpkinsoup" },
               // V24 q9: the outdoor appliances' books, each with the appliance's picture on its tab
               { id: "bbq", name: "Barbecue grill", pic: "corncob", cooker: "bbq" }, { id: "pizza", name: "Pizza oven", pic: "margherita", cooker: "pizzaoven" },
               { id: "tandoor", name: "Tandoor", pic: "naan", cooker: "tandoor" }, { id: "spit", name: "Rotisserie spit", pic: "rotisserie", cooker: "spit" },
               { id: "smoker", name: "Smoker", pic: "brisket", cooker: "smoker" },
               // V26 q6: the two counters that cook their own book, indoors
               { id: "shakes", name: "Milkshake counter", pic: "strawshake", cooker: "shakebar", bar: true },
               { id: "coffee", name: "Barista counter", pic: "cappuccino", cooker: "coffeebar", bar: true }, { id: "sushi", name: "Sushi bar", pic: "salmonnigiri", cooker: "sushibar", bar: true }];
  var DISH = {};
  DISHES.forEach(function (d) {
    var m = d.secs / 60;
    d.servings = Math.max(4, Math.round(10 * Math.pow(m, 0.55)));
    d.cost = Math.round(d.servings * d.price * 0.4);
    d.xp = Math.round((2 + 4 * Math.pow(m, 0.6)) * (d.level > 30 ? 1 + (d.level - 30) / 15 : 1));   // (V23: more past 30)
    DISH[d.id] = d;
  });

  // ---- recipe mastery (2026-10-22, Cam): five stars a dish, earned by cooking it (a cook counts when it's served
  // onto a counter). Quick dishes take more cooks, long ones fewer -- the time's already been put in: the first star
  // takes 20 x minutes^-0.4 cooks (40 for a 10 second dish, 15 for 2 minutes, 4 for an hour, 2 for four hours), the
  // later ones 3, 6, 10 and 15 times that in all. Each star makes the dish better, for good.
  var MASTERY = {
    steps: [1, 3, 6, 10, 15],
    perks: ["10% more servings", "Sells for 10% more", "Cooks 20% faster", "15% more servings again", "Never burns"]
  };
  function masteryNeed(d) {
    var b = Math.max(2, Math.min(40, Math.round(20 * Math.pow(d.secs / 60, -0.4))));
    return MASTERY.steps.map(function (k) { return b * k; });
  }
  function cooksOf(s, id) { return (s.mastery && s.mastery[id]) || 0; }
  function starsOf(s, id) { var n = cooksOf(s, id); return masteryNeed(DISH[id]).filter(function (k) { return n >= k; }).length; }
  /** A dish as you cook it now: its stars and what they've made of it (servings, price, seconds, never burns). */
  function mastered(s, id) {
    var d = DISH[id], st = starsOf(s, id), serv = d.servings;
    if (st >= 1) serv = Math.max(d.servings + (st >= 4 ? 2 : 1), Math.round(d.servings * (st >= 4 ? 1.25 : 1.1)));
    return { stars: st, servings: serv, price: st >= 2 ? Math.max(d.price + 1, Math.round(d.price * 1.1)) : d.price,
             secs: st >= 3 ? Math.max(1, Math.round(d.secs * 0.8)) : d.secs, noburn: st >= 5 };
  }
  function priceOf(s, id) { return mastered(s, id).price; }
  /** Whether you can cook a dish: by level, or -- Aunty's secrets -- once she's sent you the recipe. */
  function canCook(s, d, lv) { return d.secret ? (s.secrets || []).indexOf(d.id) >= 0 : lv >= d.level; }

  // ---- the field across the street (2026-10-22, Cam: "farm plots across the street ... harvest the ingredients and use
  // them in cooking recipes ... If we grow and harvest all the relevant ingredients it costs nothing to cook and sells for
  // more") -- NeuroFarm's crops and their growing stages. Plots sit across the road from the door, past the far pavement,
  // a 4 x 4 field: four to start (FIELD.level), the rest bought. A crop is sown for its seed's coins, grows for its
  // minutes, and is harvested into the pantry. A dish with every ingredient in the pantry cooks for no coins (they're used
  // up) and those servings sell for FARM_X more. Seed is priced so growing a dish's ingredients costs under half what
  // cooking it with bought ones does (Cam, 2026-10-22: "seeds should cost money"; test_cafe.js checks every dish).
  var CROPS = [
    { id: "wheat", name: "Wheat", level: 3, mins: 5, seed: 6, yield: 3, xp: 1 },
    { id: "strawberry", name: "Strawberries", level: 3, mins: 3, seed: 9, yield: 3, xp: 1 },
    { id: "tomato", name: "Tomatoes", level: 3, mins: 8, seed: 12, yield: 3, xp: 2 },
    { id: "onion", name: "Onions", level: 4, mins: 10, seed: 12, yield: 3, xp: 2 },
    { id: "blackberry", name: "Blackberries", level: 5, mins: 15, seed: 24, yield: 3, xp: 3 },
    { id: "cabbage", name: "Cabbages", level: 7, mins: 20, seed: 24, yield: 3, xp: 3 },
    { id: "carrot", name: "Carrots", level: 10, mins: 12, seed: 18, yield: 3, xp: 3 },
    { id: "lettuce", name: "Lettuces", level: 12, mins: 15, seed: 18, yield: 3, xp: 3 },
    { id: "potato", name: "Potatoes", level: 14, mins: 25, seed: 30, yield: 3, xp: 4 },
    { id: "beetroot", name: "Beetroot", level: 20, mins: 30, seed: 36, yield: 3, xp: 5 },
    { id: "dragonfruit", name: "Dragon fruit", level: 25, mins: 60, seed: 90, yield: 3, xp: 8 },
    { id: "starfruit", name: "Starfruit", level: 30, mins: 90, seed: 120, yield: 3, xp: 10 },
    { id: "sweetcorn", name: "Sweetcorn", level: 40, mins: 45, seed: 45, yield: 3, xp: 6 },
    { id: "pumpkin", name: "Pumpkins", level: 60, mins: 120, seed: 150, yield: 2, xp: 12 }
  ];
  var CROP = {}; CROPS.forEach(function (c) { CROP[c.id] = c; });
  // what else goes in the pantry besides the field's crops (2026-10-23: the hens' eggs)
  var GOODS = { egg: { id: "egg", name: "Eggs" } };
  function goodName(id) { return CROP[id] ? CROP[id].name : GOODS[id] ? GOODS[id].name : id; }

  // ---- the chicken coop (2026-10-23, Cam: "a chicken coop now and 2 chickens housed in there who will produce eggs you
  // have to collect"): a farm thing on the street (NeuroPets' coop and hens). Its hens lay into the nest, one egg each
  // every COOP.lay minutes, until it holds COOP.nest -- then they stop till you collect. The first coop is a gift when
  // the farm opens (level 3); one coop for now (more animals with husbandry, later).
  // N50 q3 (Cam: "a second coop at level 10, bought"): the gift coop, and one more to buy from level COOP.second
  var COOP = { level: 3, hens: 2, lay: 30, nest: 12, xp: 1, max: 2, second: 10 };
  function coopsAllowed(s) { return levelOf(s.xp) >= COOP.second ? COOP.max : 1; }
  function layEvery() { return COOP.lay * MIN / COOP.hens; }
  /** A coop's nest now: {eggs, full, next (when the next egg comes; 0 when full)}. */
  function coopOf(o, now) {
    var since = o.since || now, k = Math.max(0, Math.floor((now - since) / layEvery())), eggs = Math.min(COOP.nest, (o.eggs || 0) + k);
    return { eggs: eggs, full: eggs >= COOP.nest, k: k, next: eggs >= COOP.nest ? 0 : since + (k + 1) * layEvery() };
  }
  /** Take the eggs out of a coop's nest into the pantry; returns how many. */
  function takeEggs(s, o, now) {
    var n = coopOf(o, now);
    if (n.eggs) s.pantry.egg = (s.pantry.egg || 0) + n.eggs;
    o.since = n.full ? now : (o.since || now) + n.k * layEvery(); o.eggs = 0;
    return n.eggs;
  }
  // the field (2026-10-22, Cam: "a plow where i can click and place a plot similar to how we place furniture"): plots
  // are dug wherever you like outside -- a tile each, off the roads and the pavements' walking lines -- the first four
  // free, more as you level, each a little dearer. Farmer Giles sells the seed (or you sow a packet you were given).
  // 2026-10-23 (Cam): a ripe crop spoils like a dish burns -- picked within the time it took to grow (FIELD.keep x that),
  // or it goes over and the plot just needs clearing. Kit to lengthen it (sprinklers ...) comes later: keepOf().
  var FIELD = { level: 3, free: 4, keep: 1 };
  var FARM_X = 1.25;                                    // farm-grown servings sell for a quarter more
  /** How many plots your level allows. */
  function plotsAllowed(lv) { return lv < FIELD.level ? 0 : lv < 6 ? 4 : lv < 12 ? 8 : lv < 20 ? 12 : lv < 30 ? 16 : lv < 45 ? 24 : 32; }
  /** What the nth plot costs to dig (the first four free). */
  function plotPrice(n) { return n < FIELD.free ? 0 : Math.round(100 * Math.pow(1.15, n - FIELD.free) / 10) * 10; }
  /** Why a plot can't be dug on the tile at (x, y) -- "" when it can. */
  function plotProblem(s, x, y, uid) {
    if (x !== Math.floor(x) || y !== Math.floor(y)) return "Plots go on whole tiles.";
    if (x < REACH[0] || y < REACH[0] || x + 1 > REACH[1] || y + 1 > REACH[1]) return "That's too far out.";
    if (x + 1 > 0 && y + 1 > 0 && x < cafeW(s) && y < s.size) return "That's inside the café.";
    var over = function (a, lo, hi) { return a < hi && a + 1 > lo; };
    if (over(x, ROADS[0], ROADS[1]) || over(y, ROADS[0], ROADS[1])) return "Not on the road.";
    if (WALKS.some(function (w) { return over(x, w - 0.3, w + 0.3) || over(y, w - 0.3, w + 0.3); })) return "Keep the pavement's middle clear for people walking.";
    if (s.field.some(function (p) { return p.uid !== uid && p.x === x && p.y === y; })) return "There's a plot there.";
    // (a fence runs along tile edges (PT56): it never stands on the tile itself, so a plot can go inside a fenced box)
    var near = (s.decor || []).filter(function (o) { var r = DECO[o.id] ? (DECO[o.id].fence ? 0 : DECO[o.id].r) : 0.3; return o.x > x - r && o.x < x + 1 + r && o.y > y - r && o.y < y + 1 + r; })[0];
    return near ? "The " + DECO[near.id].name.toLowerCase() + " is in the way." : "";
  }
  /** Whether a street thing at (x, y) would stand on a plot. */
  function onPlot(s, x, y, r) { return (s.field || []).some(function (p) { return x > p.x - r && x < p.x + 1 + r && y > p.y - r && y < p.y + 1 + r; }); }
  /** How long a ripe crop waits to be picked before it spoils (ms). */
  function keepOf(c) { return c.mins * MIN * FIELD.keep; }
  function cropOf(pl, now) {
    if (!pl || !pl.crop) return null;
    var c = CROP[pl.crop], end = pl.at + c.mins * MIN, p = Math.max(0, Math.min(1, (now - pl.at) / (c.mins * MIN))), gone = end + keepOf(c);
    return { crop: c, ready: now >= end && now < gone, spoiled: now >= gone, left: Math.max(0, end - now), spoilsIn: Math.max(0, gone - now),
             keep: keepOf(c), progress: p, stage: p >= 1 ? 4 : p >= 0.6 ? 3 : p >= 0.25 ? 2 : 1 };
  }
  // what each dish is made with from the field (crops; a cook takes about one of each per 20 servings, 1 to 6) -- and,
  // 2026-10-23, the coop's eggs
  var INGREDIENTS = {
    pancakes: ["wheat", "egg"], waffles: ["wheat", "egg"], tomatosoup: ["tomato", "onion"], frenchtoast: ["wheat", "egg"], berrytart: ["strawberry", "blackberry", "wheat"],
    benedict: ["wheat", "egg"], cabbagesoup: ["cabbage", "onion"], grilledcheese: ["wheat"], florentine: ["wheat", "egg"], honeycake: ["wheat", "egg"], avocado: ["wheat"],
    carrotsoup: ["carrot", "onion"], caesarsalad: ["lettuce", "egg"], custardtart: ["wheat", "egg"], bakedpotato: ["potato"], omelette: ["onion", "egg"],
    fishchips: ["potato"], scrambled: ["wheat", "egg"], carrotcake: ["carrot", "wheat", "egg"], clubsandwich: ["wheat", "lettuce", "tomato"],
    hashbrowns: ["potato", "onion"], dragonfruittart: ["dragonfruit", "wheat"], porridge: ["wheat"], cheeseburger: ["wheat", "lettuce", "tomato", "onion"],
    mashedpotato: ["potato"], fullbreakfast: ["tomato", "potato", "wheat", "egg"], starfruitpie: ["starfruit", "wheat"], burrito: ["tomato", "onion", "egg"],
    strawberrycream: ["strawberry"], spaghetti: ["tomato", "onion", "wheat"], fishpie: ["potato", "egg"], shakshuka: ["tomato", "onion", "egg"],
    cornchowder: ["sweetcorn", "potato", "onion"], creamtea: ["wheat", "strawberry"], lasagne: ["tomato", "onion", "wheat"],
    fruitoats: ["wheat", "strawberry"], strawberrytart: ["strawberry", "wheat"], roastpork: ["potato"], rosemarychicken: ["potato"],
    cheesepie: ["wheat"], oatbowl: ["wheat"], thymepork: ["potato"], pumpkinpie: ["pumpkin", "wheat", "egg"], rabbitstew: ["carrot", "potato"],
    roastchicken: ["potato", "carrot"], steak: ["potato"], venisonsteak: ["carrot"], mintlamb: ["potato"], muttonstew: ["potato", "carrot", "onion"],
    herbstew: ["potato", "carrot", "onion"], trufflestew: ["potato", "onion"],
    bread: ["wheat"], heartystew: ["potato", "carrot", "onion"], comingofagecake: ["wheat", "strawberry", "egg"], richstew: ["potato", "carrot", "beetroot"],
    hammerheadsteak: ["potato"], cheeseomelette: ["egg"], eggsbacon: ["egg"], duckeggomelette: ["egg"], truffleomelette: ["egg"]
  };
  DISHES.forEach(function (d) {
    var q = Math.max(1, Math.min(6, Math.round(d.servings / 20)));
    d.needs = (INGREDIENTS[d.id] || []).reduce(function (m, c) { m[c] = q; return m; }, {});
  });
  function hasAll(s, d) { var ks = Object.keys(d.needs); return ks.length > 0 && ks.every(function (c) { return (s.pantry[c] || 0) >= d.needs[c]; }); }
  /** A farm serving's price: a quarter more (at least a coin) than the dish sells for now. */
  function farmPrice(s, id) { var p = priceOf(s, id); return Math.max(p + 1, Math.round(p * FARM_X)); }
  /** Keep a plate's farm-grown count honest after servings come off it (and nothing on an empty plate). */
  function fixFarm(pl) {
    if (!pl.dish || !(pl.n > 0)) { pl.farm = 0; pl.fres = 0; return; }
    pl.farm = Math.min(pl.farm || 0, pl.n); pl.fres = Math.min(pl.fres || 0, pl.farm);
  }

  // ---- levels: XP to reach each (index = level). V22 q1: thirty levels, something new at each -- the first ten as they
  // were, then each step about 19% more than the one before (level 30 near 100,000 XP), rounded to tidy numbers
  // V23 q2: on to level 100 -- past 30 each step only a little bigger than the last (0.8%), level 100 near 1.5 million;
  // dishes past level 30 give more XP to match (DISH). The Mathematician tunes it against play.
  var MAX_LEVEL = 100;
  var XP = (function () {
    var x = [0, 0, 30, 80, 160, 280, 450, 700, 1000, 1400, 1900], step = 500;
    for (var l = 11; l <= MAX_LEVEL; l++) { step *= l <= 30 ? 1.19 : 1.008; x.push(Math.round((x[l - 1] + step) / 50) * 50); }
    return x;
  })();
  function levelOf(xp) { var l = 1; while (l < MAX_LEVEL && xp >= XP[l + 1]) l++; return l; }

  // ---- things you place (V19: stoves and counters bought; one till; the door's in the wall) -----
  var THINGS = {
    stove: { name: "Stove", price: 300 },
    counter: { name: "Serving counter", price: 200 },
    buffet: { name: "Buffet counter", price: 450, level: 3 },
    till: { name: "Cash register", price: 0 },
    // furniture (2026-10-21, PT47: "tables, chairs so people can sit... fill out more content")
    plant: { name: "Potted fern", price: 40, level: 1, furniture: true, grow: true },
    table: { name: "Café table", price: 120, level: 2, furniture: true, table: true },
    chair: { name: "Chair", price: 50, level: 2, furniture: true, seat: true },
    vending: { name: "Vending machine", price: 800, level: 4, vend: true },
    // V26 q4 (Sheet 46): more vending machines -- see VENDS for what each sells
    shakevend: { name: "Milkshake machine", price: 1000, level: 8, vend: true, turns: 4 },
    energyvend: { name: "Energy drink machine", price: 1200, level: 12, vend: true, turns: 4 },
    // V26 q3: the popcorn machine -- people come in for a bag, like a vending machine (inside or on the patio)
    popcorn: { name: "Popcorn machine", price: 1800, level: 16, machine: true, turns: 4, stall: true },
    // V26 q6: counters that cook their own book -- a stove and a counter in one, never dirty; what's made goes on its top
    // (2026-10-26, Cam: "change the other milkshake counter to just be the prep counter for milkshakes like how stoves
    // work"): prep -- it makes the shakes and they're served out, to the plain milkshake counters first (no top of its own)
    shakebar: { name: "Milkshake counter", price: 2500, level: 9, cooker: true, bar: true, prep: true, menu: "shakes", turns: 4 },
    sushibar: { name: "Sushi bar", price: 6000, level: 22, cooker: true, bar: true, prep: true, menu: "sushi", turns: 4 },   // (prep too, 26 Oct)
    // 2026-10-26 (Cam: "a plain milkshake counter same design ... with a bare top that can store 3 different types of
    // milkshakes"): it doesn't make anything -- a milkshake counter's shakes are served onto it, three kinds side by side
    shakeshelf: { name: "Plain milkshake counter", price: 1500, level: 9, shelf: "shakes", slots: 3, turns: 4 },
    // (later the same day, Cam: "lets make the sushi work the same way as the milkshake one") -- the sushi bar's own
    sushishelf: { name: "Plain sushi counter", price: 3500, level: 22, shelf: "sushi", slots: 3, turns: 4 },
    // 2026-11-18 (Cam, PT59 c9: "Have a barista counter and a coffee serving counter that works like the milkshake
    // counters and system ... remove clutter on the serving counters"): the barista counter makes the coffees (prep),
    // the coffee serving counter holds three kinds side by side
    coffeebar: { name: "Barista counter", price: 2200, level: 7, cooker: true, bar: true, prep: true, menu: "coffee", turns: 4 },
    coffeeshelf: { name: "Coffee serving counter", price: 1200, level: 7, shelf: "coffee", slots: 3, turns: 4 },
    // V22 q4: coin machines (Sheet 15, painted four ways) -- see MACHINES for how each one earns
    jukebox: { name: "Jukebox", price: 900, level: 6, machine: true, turns: 4 },
    arcade: { name: "Arcade machine", price: 1500, level: 9, machine: true, turns: 4 },
    pinball: { name: "Pinball machine", price: 1800, level: 12, machine: true, turns: 4 },
    piano: { name: "Player piano", price: 2500, level: 15, machine: true, turns: 4 },
    // Sheet 12 (N36): more tables, chairs and things to decorate with. Chairs painted from the front only turn two ways
    // (turns: 2); the stool looks the same every way; armchairs give a bigger tip.
    table_square: { name: "Square table", price: 140, level: 3, furniture: true, table: true },
    table_bistro: { name: "Marble bistro table", price: 180, level: 4, furniture: true, table: true },
    table_garden: { name: "Garden table", price: 160, level: 5, furniture: true, table: true },
    table_coffee: { name: "Coffee table", price: 150, level: 6, furniture: true, table: true },
    stool: { name: "Stool", price: 40, level: 3, furniture: true, seat: true, stool: true },
    chair_bistro: { name: "Bistro chair", price: 70, level: 4, furniture: true, seat: true, turns: 2 },
    chair_garden: { name: "Garden chair", price: 60, level: 5, furniture: true, seat: true, turns: 2 },
    armchair: { name: "Armchair", price: 150, level: 7, furniture: true, seat: true, turns: 2, tip: 2 },
    // 2026-10-24 (Cam: "have two people sit on a sofa"): two tiles long like the buffet, a place on each; a table in
    // front of either half serves both. Cam's blue sofa set (sofa-l/-r/-br/-bl), with its table and lamp.
    // (Cam, same day: "it didn't work four ways" -- sandbox only until it does: sandbox things aren't in the café's shop.)
    sofa: { name: "Two-seat sofa", price: 280, level: 8, furniture: true, seat: true, turns: 4, tip: 2, places: 2, sandbox: true, tint: "blue" },
    table_wood: { name: "Farmhouse table", price: 160, level: 8, furniture: true, table: true },
    // 2026-10-25 (Cam: "the square table ... so it can cover two tiles"): the square table made a tile longer
    // (tools/make_cafe_joins.py); a chair at either half seats at it
    table_long: { name: "Long table", price: 260, level: 5, furniture: true, table: true, turns: 2, two: true },
    // lamps glow after dark (lamp); the blue one turns by mirroring (its pull-cord swaps sides)
    lamp_blue: { name: "Blue floor lamp", price: 110, level: 8, furniture: true, lamp: true, mirror: true, tint: "blue" },
    palm: { name: "Potted palm", price: 70, level: 3, furniture: true, grow: true },
    floorlamp: { name: "Floor lamp", price: 90, level: 4, furniture: true, lamp: true },
    bookshelf: { name: "Bookshelf", price: 120, level: 5, furniture: true },
    coatstand: { name: "Coat stand", price: 60, level: 6, furniture: true },
    // (Cam, 25 Oct: "Pantry will become a cupboard object that is placed") -- click it for what's in the pantry; one each
    cupboard: { name: "Pantry cupboard", price: 150, level: 1, furniture: true, pantry: true, mirror: true },
    // N48 (V23 q8, Sheet 20): room dividers -- a one-tile length of low wall, screen or rope, turned two ways
    halfwall: { name: "White half-wall", price: 90, level: 9, furniture: true, divider: true, turns: 2 },
    halfbrick: { name: "Low brick wall", price: 120, level: 11, furniture: true, divider: true, turns: 2 },
    screen: { name: "Folding screen", price: 110, level: 12, furniture: true, divider: true, turns: 2 },
    vipropes: { name: "Velvet rope", price: 150, level: 14, furniture: true, divider: true, turns: 2 },
    planterwall: { name: "Hedge planter", price: 140, level: 16, furniture: true, divider: true, turns: 2 },
    standmirror: { name: "Standing mirror", price: 160, level: 18, furniture: true, divider: true, turns: 2 },
    lattice: { name: "Ivy trellis", price: 130, level: 20, furniture: true, divider: true, turns: 2 },
    barrier: { name: "Banner barrier", price: 100, level: 22, furniture: true, divider: true, turns: 2 },
    // N48 (V23 q9, Sheet 21): games people come in to play, like the arcade (painted front and back, N53's mirrored pairs)
    skeeball: { name: "Skee-ball lane", price: 2200, level: 17, machine: true, turns: 4 },
    basketball: { name: "Basketball hoops", price: 2600, level: 19, machine: true, turns: 4 },
    karaoke: { name: "Karaoke machine", price: 2400, level: 20, machine: true, turns: 4 },
    foosball: { name: "Foosball table", price: 2000, level: 22, machine: true, turns: 4 },
    lightgun: { name: "Light-gun arcade", price: 3000, level: 25, machine: true, turns: 4 },
    airhockey: { name: "Air hockey table", price: 3200, level: 28, machine: true, turns: 4 },
    dance: { name: "Dance machine", price: 3600, level: 32, machine: true, turns: 4 },
    whackamole: { name: "Whack-a-mole", price: 2800, level: 36, machine: true, turns: 4 },
    // N48 (Sheet 22): the big games, two tiles long -- painted lying along each way (-l along x, -r along y)
    pingpong: { name: "Table tennis", price: 2600, level: 21, machine: true, turns: 2, two: true },
    pooltable: { name: "Pool table", price: 3400, level: 26, machine: true, turns: 2, two: true },
    shuffleboard: { name: "Shuffleboard", price: 3000, level: 30, machine: true, turns: 2, two: true },
    airhockey2: { name: "Pro air hockey", price: 4200, level: 34, machine: true, turns: 2, two: true },
    // N47 (Halloween): unlocked with candy at the haunted house (EVENT), then bought for coins any time of year.
    // Painted in mirrored pairs; seasonal, so no swatches.
    jackolantern: { name: "Jack-o'-lantern", price: 120, level: 1, furniture: true, turns: 2, event: "halloween", candy: 20, lamp: true },
    pumpkinpile: { name: "Pumpkins on hay", price: 160, level: 1, furniture: true, turns: 2, event: "halloween", candy: 25 },
    blackcat: { name: "Black cat", price: 140, level: 1, furniture: true, turns: 2, event: "halloween", candy: 25 },
    cauldron: { name: "Witch's cauldron", price: 200, level: 1, furniture: true, turns: 2, event: "halloween", candy: 30 },
    witchhat: { name: "Witch's hat stand", price: 180, level: 1, furniture: true, turns: 2, event: "halloween", candy: 30 },
    candelabra: { name: "Candelabra", price: 220, level: 1, furniture: true, turns: 2, event: "halloween", candy: 35, lamp: true },
    skeleton: { name: "Skeleton on a crate", price: 240, level: 1, furniture: true, turns: 2, event: "halloween", candy: 40 },
    coffinshelf: { name: "Coffin bookshelf", price: 300, level: 1, furniture: true, turns: 2, event: "halloween", candy: 45 },
    apples: { name: "Apple bobbing", price: 1800, level: 1, machine: true, turns: 4, event: "halloween", candy: 120 },
    fortune: { name: "Fortune teller", price: 2400, level: 1, machine: true, turns: 4, event: "halloween", candy: 150 },
    claw: { name: "Claw machine", price: 2600, level: 1, machine: true, turns: 4, event: "halloween", candy: 160 },
    hauntedhouse: { name: "Haunted house ride", price: 3200, level: 1, machine: true, turns: 4, event: "halloween", candy: 200 },
    // V24 q8 (step 2): the outdoor appliances -- stoves that cook only their own book (menu), only on the patio
    // (outdoor), cleaned after every dish like a stove; one more of each every ten levels past its own
    bbq: { name: "Barbecue grill", price: 1800, level: 12, cooker: true, outdoor: true, menu: "bbq", turns: 4 },
    pizzaoven: { name: "Pizza oven", price: 2800, level: 18, cooker: true, outdoor: true, menu: "pizza", turns: 4 },
    tandoor: { name: "Tandoor", price: 3800, level: 24, cooker: true, outdoor: true, menu: "tandoor", turns: 4 },
    spit: { name: "Rotisserie spit", price: 5000, level: 30, cooker: true, outdoor: true, menu: "spit", turns: 4 },
    smoker: { name: "Smoker", price: 7000, level: 40, cooker: true, outdoor: true, menu: "smoker", turns: 4 },
    // V25 q2 (N56, Cam: "a new ground pillow seat, new low table ... so people can eat on the ground"): low tables and
    // floor cushions -- a cushion (round: no front, like the stool) seats someone only at a LOW table, and a chair
    // never does; they sit cross-legged
    table_low: { name: "Low table", price: 110, level: 6, furniture: true, table: true, low: true, turns: 2 },
    table_lowround: { name: "Low round table", price: 130, level: 9, furniture: true, table: true, low: true },
    // (Cam, 25 Oct: "for indoor potted plants i want potted version of the lavender, flowers and ferns for outside")
    pot_lavender: { name: "Potted lavender", price: 45, level: 4, furniture: true, grow: true },
    pot_flowers: { name: "Potted wildflowers", price: 40, level: 3, furniture: true, grow: true },
    pot_ferns: { name: "Potted wild ferns", price: 35, level: 2, furniture: true, grow: true },
    cushion: { name: "Floor cushion", price: 40, level: 6, furniture: true, seat: true, low: true, round: true },
    pouf: { name: "Floor pouf", price: 60, level: 9, furniture: true, seat: true, low: true, round: true },
    table_lowhw: { name: "Halloween low table", price: 160, level: 1, furniture: true, table: true, low: true, turns: 2, event: "halloween", candy: 40, lamp: true },   // (its candle lights a little)
    cushion_hw: { name: "Bat cushion", price: 70, level: 1, furniture: true, seat: true, low: true, round: true, event: "halloween", candy: 30 },
    // 2026-10-27 (Cam's Halloween furniture, N67): tables, chairs and stools like the café's own. The skull chair's backs are
    // painted (four ways), the pumpkin armchair's too; the cobweb chair turns two ways till its backs are (N67 asks again)
    table_hwpumpkin: { name: "Jack-o'-lantern table", price: 170, level: 1, furniture: true, table: true, event: "halloween", candy: 40 },
    table_hwweb: { name: "Cobweb bistro table", price: 190, level: 1, furniture: true, table: true, event: "halloween", candy: 40 },
    table_hwslime: { name: "Slimy table", price: 160, level: 1, furniture: true, table: true, event: "halloween", candy: 35 },
    table_hwskull: { name: "Skull coffee table", price: 180, level: 1, furniture: true, table: true, event: "halloween", candy: 40 },
    chair_web: { name: "Cobweb chair", price: 80, level: 1, furniture: true, seat: true, turns: 2, event: "halloween", candy: 25 },
    chair_skull: { name: "Skull chair", price: 75, level: 1, furniture: true, seat: true, turns: 2, event: "halloween", candy: 25 },
    armchair_hw: { name: "Pumpkin armchair", price: 220, level: 1, furniture: true, seat: true, turns: 2, tip: 2, event: "halloween", candy: 50 },
    stool_hwbat: { name: "Bat bar stool", price: 60, level: 1, furniture: true, seat: true, stool: true, event: "halloween", candy: 20 },
    stool_hw: { name: "Twisted stool", price: 45, level: 1, furniture: true, seat: true, stool: true, event: "halloween", candy: 15 },
    pot_hwtree: { name: "Spooky potted tree", price: 90, level: 1, furniture: true, grow: true, event: "halloween", candy: 20 },
    lamp_hw: { name: "Jack-o'-lantern lamp", price: 130, level: 1, furniture: true, lamp: true, event: "halloween", candy: 30 },
    bookshelf_hw: { name: "Haunted bookcase", price: 260, level: 1, furniture: true, event: "halloween", candy: 40 },
    coatstand_hw: { name: "Dead-tree coat stand", price: 120, level: 1, furniture: true, event: "halloween", candy: 25 },
    // V25 q3: readings -- a reader at a low table, like a coin machine with a person (MACHINES: a visitor sits on the
    // floor in front for about a minute and pays)
    crystalball: { name: "Fortune teller's table", price: 3000, level: 1, machine: true, turns: 4, reader: true, event: "halloween", candy: 180 },
    tarotreader: { name: "Tarot reader's table", price: 3600, level: 1, machine: true, turns: 4, reader: true, event: "halloween", candy: 220 }
  };
  var APPLIANCES = Object.keys(THINGS).filter(function (k) { return THINGS[k].cooker && !THINGS[k].bar; });   // (the patio's)
  var BARS = Object.keys(THINGS).filter(function (k) { return THINGS[k].bar; });
  var VENDINGS = Object.keys(THINGS).filter(function (k) { return THINGS[k].vend; });
  var COOKER_OF = {}; APPLIANCES.concat(BARS).forEach(function (k) { COOKER_OF[THINGS[k].menu] = k; });
  /** Whether a thing cooks: a stove, or one of the patio's appliances. */
  function cooks(it) { return !!it && (it.kind === "stove" || !!(THINGS[it.kind] && THINGS[it.kind].cooker)); }
  /** What a dish is cooked on: its book's appliance, or a stove. */
  function cookerOf(d) { return COOKER_OF[d.menu] || "stove"; }
  /** Whether the café has something to cook a dish on (an outdoor dish needs its appliance out on the patio). */
  function hasCooker(s, d) { var k = cookerOf(d); return k === "stove" || s.items.some(function (it) { return it.kind === k; }); }
  var FURNITURE = Object.keys(THINGS).filter(function (k) { return THINGS[k].furniture; });
  // the whole café's wallpaper and counters (N36, Sheets 10-11): bought once, then yours to switch between for free
  var WALLPAPERS = [
    { id: "plaster", name: "Plaster", level: 1, price: 0 }, { id: "stripes", name: "Cream stripes", level: 2, price: 250 },
    { id: "sage", name: "Sage and wainscot", level: 3, price: 350 }, { id: "damask", name: "Pink damask", level: 3, price: 350 },
    { id: "tiles", name: "Blue tiles", level: 4, price: 450 }, { id: "brick", name: "Red brick", level: 5, price: 500 },
    { id: "woodpanel", name: "Wood panelling", level: 6, price: 600 }, { id: "mint", name: "Mint dots", level: 6, price: 450 },
    { id: "floral", name: "Yellow floral", level: 7, price: 500 },
    // N55: Sheet 36's wallpapers
    { id: "coffee", name: "Coffee cups", level: 7, price: 450 }, { id: "subway", name: "White subway tiles", level: 8, price: 500 },
    { id: "hearts", name: "Lilac hearts", level: 9, price: 450 }, { id: "greystone", name: "Grey stone", level: 10, price: 600 },
    { id: "planks", name: "Whitewashed planks", level: 11, price: 550 }, { id: "palms", name: "Gold palms", level: 12, price: 650 },
    { id: "stars", name: "Starry navy", level: 14, price: 650 }, { id: "deco", name: "Art deco fans", level: 16, price: 800 },
    // N47: Halloween's (Gemini painted them as corners; the cutter makes panels of them) -- unlocked with candy
    { id: "bats", name: "Bats", level: 1, price: 600, event: "halloween", candy: 50 }, { id: "pumpkinstripe", name: "Pumpkin stripes", level: 1, price: 600, event: "halloween", candy: 50 },
    { id: "cobweb", name: "Cobwebbed stone", level: 1, price: 700, event: "halloween", candy: 60 }, { id: "spookydamask", name: "Spooky damask", level: 1, price: 700, event: "halloween", candy: 55 },
    { id: "moonlit", name: "Starry night", level: 1, price: 650, event: "halloween", candy: 55 }, { id: "candycorn", name: "Candy corn stripes", level: 1, price: 600, event: "halloween", candy: 50 },
    { id: "graveyard", name: "Graveyard mist", level: 1, price: 750, event: "halloween", candy: 70 }];
  var COUNTER_STYLES = [
    { id: "wood", name: "Plain wood", level: 1, price: 0 }, { id: "oak", name: "Pale oak", level: 2, price: 300 },
    { id: "walnut", name: "Dark walnut", level: 3, price: 400 }, { id: "mint", name: "Mint", level: 3, price: 350 },
    { id: "cream", name: "Cream and gold", level: 4, price: 500 }, { id: "red", name: "Cherry red", level: 5, price: 450 },
    { id: "marble", name: "White marble", level: 6, price: 700 }, { id: "pink", name: "Pastel pink", level: 6, price: 450 },
    { id: "slate", name: "Black slate", level: 8, price: 800 }];
  var STYLE_LISTS = { wall: WALLPAPERS, counters: COUNTER_STYLES };
  // ---- half walls (2026-11-08, Cam: "a half wall feature where i can build half walls ... around my kitchen area (half
  // wall swatches will become the dividers and they can be brought in the furniture store ...) ... line up on the side of
  // a box and not in the middle of it ... placed between two objects on the line of the box ... horizontal or
  // vertical"). A half wall is built in Build > Half walls, one tile-edge long, on the line BETWEEN two tiles -- never on
  // a tile -- so it fits between two things standing side by side. Its look is a style: the old dividers' pictures (and
  // their paints), bought once at the furniture store; the white one comes free with the feature. Nobody walks or sits
  // through one (walled). A wall's spot is its edge: dir 0 runs along x, from (x, y) to (x + 1, y) -- between tiles
  // (x, y - 1) and (x, y); dir 1 runs along y, from (x, y) to (x, y + 1) -- between (x - 1, y) and (x, y).
  var HALF_WALL = { level: 9, seg: 15 };
  var HALF_WALLS = [
    { id: "halfwall", name: "White half-wall", level: 9, price: 0 }, { id: "halfbrick", name: "Low brick wall", level: 11, price: 360 },
    { id: "screen", name: "Folding screen", level: 12, price: 330 }, { id: "vipropes", name: "Velvet rope", level: 14, price: 450 },
    { id: "planterwall", name: "Hedge planter", level: 16, price: 420 }, { id: "standmirror", name: "Standing mirror", level: 18, price: 480 },
    { id: "lattice", name: "Ivy trellis", level: 20, price: 390 }, { id: "barrier", name: "Banner barrier", level: 22, price: 300 }];
  var HALF_WALL_OF = {}; HALF_WALLS.forEach(function (x) { HALF_WALL_OF[x.id] = x; });
  function hwOwned(s, id) { var x = HALF_WALL_OF[id]; return !!x && eventGot(s, hwEv(x)) && (!x.price || !!(s.hwStyles && s.hwStyles[id]) || !!s.sandbox); }
  /** A railing style's event (its Halloween unlock) as eventGot reads it. */
  function hwEv(x) { return x.event ? { id: x.rail, event: x.event } : null; }
  function hwKey(x, y, dir) { return (dir ? "v" : "h") + ":" + x + "," + y; }
  /** The two tiles a wall stands between. */
  function hwSides(w) { return w.dir ? [{ x: w.x - 1, y: w.y }, { x: w.x, y: w.y }] : [{ x: w.x, y: w.y - 1 }, { x: w.x, y: w.y }]; }
  var hwSets = typeof WeakMap === "function" ? new WeakMap() : null;
  /** The café's half walls by edge (kept per array: every change makes a new one). */
  function hwSet(s) {
    var L = s.hwalls || [];
    if (hwSets && hwSets.has(L)) return hwSets.get(L);
    var m = {}; L.forEach(function (w) { m[hwKey(w.x, w.y, w.dir)] = w; });
    if (hwSets) hwSets.set(L, m);
    return m;
  }
  /** The half wall between two tiles side by side, or null. */
  function hwBetween(s, a, b) {
    if (!s.hwalls || !s.hwalls.length) return null;
    if (a.y === b.y && Math.abs(a.x - b.x) === 1) return hwSet(s)[hwKey(Math.max(a.x, b.x), a.y, 1)] || null;
    if (a.x === b.x && Math.abs(a.y - b.y) === 1) return hwSet(s)[hwKey(a.x, Math.max(a.y, b.y), 0)] || null;
    return null;
  }
  /** Where a wall's middle is (in tiles). */
  function hwMid(w) { return w.dir ? { x: w.x, y: w.y + 0.5 } : { x: w.x + 0.5, y: w.y }; }
  /** Why a half wall can't go on this edge ("" when it can). Inside the café: between two of its tiles, not on the
      patio's own wall, not through one thing standing on both sides. On the café's edge: not where its own walls are
      (the back and the left; the patio's back, by the pavement, is where its railings go). Outside (2026-11-08, Cam:
      "half walls can be placed outside and inside the cafe"): on the grass or along a pavement's edge, not down the
      middle of the pavement or the road, not through a building, and not too far out. */
  function hwEdgeProblem(s, w, items) {
    var sd = hwSides(w), inA = inside(s, sd[0].x, sd[0].y), inB = inside(s, sd[1].x, sd[1].y);
    if (inA !== inB) {
      if ((w.dir && w.x === 0) || (!w.dir && w.y === 0 && w.x < s.size)) return "That's the café's own wall.";
      return "";
    }
    if (!inA) {
      var band = function (c) { return (c.x < STREET_BAND[1] && c.x + 1 > STREET_BAND[0]) || (c.y < STREET_BAND[1] && c.y + 1 > STREET_BAND[0]); };
      if (sd.some(function (c) { return c.x < REACH[0] || c.y < REACH[0] || c.x + 1 > REACH[1] || c.y + 1 > REACH[1]; })) return "That's too far out.";
      if (band(sd[0]) && band(sd[1])) return "Not on the pavement or the road (its edge is fine).";
      var m = hwMid(w), bld = (s.decor || []).filter(function (o) { if (!FOOT[o.id]) return false; var F = footOf(o.id, o.x, o.y, o.dir); return m.x > F.x0 && m.x < F.x1 && m.y > F.y0 && m.y < F.y1; })[0];
      return bld ? "That would go through the " + DECO[bld.id].name.toLowerCase() + "." : "";
    }
    if (s.patio && w.dir && w.x === s.size) return "The patio has its own wall there.";
    var through = (items || s.items).filter(function (o) { return covers(o, sd[0].x, sd[0].y) && covers(o, sd[1].x, sd[1].y); })[0];
    return through ? "That would go through the " + ((THINGS[through.kind] || {}).name || "thing").toLowerCase() + "." : "";
  }
  // wall paintings (V22 q3, Sheet 14): one on a wall panel (not the door's); they count towards the café's looks
  var PAINTINGS = [
    { id: "coffee", name: "Coffee and croissants", level: 5, price: 150, pic: "painting-1" },
    { id: "harbour", name: "The harbour", level: 11, price: 300, pic: "painting-2" },
    { id: "sunflowers", name: "Sunflowers", level: 13, price: 350, pic: "painting-3" },
    { id: "cat", name: "Cat in a hat", level: 14, price: 400, pic: "painting-4" },
    { id: "paris", name: "A café in Paris", level: 18, price: 500, pic: "painting-5" },
    { id: "mountains", name: "Mountains at dawn", level: 21, price: 600, pic: "painting-6" },
    { id: "abstract", name: "Warm shapes", level: 23, price: 700, pic: "painting-7" },
    { id: "teapot", name: "The teapot poster", level: 30, price: 900, pic: "painting-8" }];
  // N48 (V23 q8, Sheets 17-19): windows, curtains and blinds (each with its window), clocks and wall things hang on a
  // panel like a painting -- the cutter shears each to the wall's slope with a 3D edge (wall_slant), -r mirrored
  var WALL_THINGS = [
    ["window-1", "Sash window", 6, 200], ["window-2", "Cottage window", 8, 240], ["window-3", "Porthole", 10, 260], ["window-4", "Stained-glass window", 15, 450],
    ["window-5", "Window box", 12, 320], ["window-6", "Modern window", 18, 380], ["window-7", "Bay window seat", 24, 600], ["window-8", "Shuttered window", 20, 420],
    ["curtain-1", "Red velvet curtains", 9, 300], ["curtain-2", "Lace curtains", 11, 280], ["curtain-3", "Green drapes", 13, 320], ["curtain-4", "Gingham café curtains", 7, 220],
    ["blind-1", "Roller blind", 6, 180], ["blind-2", "Wooden blinds", 10, 260], ["blind-3", "Bamboo blind", 14, 280], ["blind-4", "Pink Roman blind", 16, 300],
    ["clock-1", "Station clock", 4, 120], ["clock-2", "Cuckoo clock", 12, 350, "flat"], ["clock-3", "Sunburst clock", 16, 380, "flat"], ["clock-4", "Pendulum clock", 22, 520, "flat"],
    ["clock-5", "Tin clock", 9, 200, "flat"], ["dartboard", "Dartboard", 11, 180, "flat"], ["mirror", "Gilded mirror", 14, 320, "flat"], ["shelf", "Teacup shelf", 8, 160, "flat"],
    // 2026-10-24 (Cam: "wall sconce lights"): lights for the wall -- on and off with a click, lighting the wall round them
    ["sconce-1", "Brass candle sconce", 4, 140], ["sconce-2", "Globe sconce", 8, 180], ["sconce-3", "Lantern sconce", 11, 220], ["sconce-4", "Fan sconce", 16, 300], ["sconce-5", "Swing-arm light", 20, 340]
  ].map(function (w) { return { id: w[0], name: w[1], level: w[2], price: w[3], pic: w[0], group: w[0].split("-")[0].replace(/^(dartboard|mirror|shelf)$/, "wall"), light: /^sconce-/.test(w[0]) }; });
  // 2026-10-24 (Cam: "roof lights ... circle leds, hallogen wire inductrial lights, chandaliers and others"): lights
  // hung from the ceiling over a floor tile (s.ceil "x,y" -> {id, off}) -- they take no floor, and they're drawn
  // see-through so the café under them can still be seen and clicked. Switched all together by the switch by the door,
  // or one at a time in Build. reach: how far the light goes after dark, in tiles; tone: its colour (cafe.js LIGHT_TONE).
  var CEILING = [
    { id: "ceil-led", name: "LED ring light", level: 3, price: 160, reach: 3, tone: "cool" },
    { id: "ceil-lantern", name: "Paper lantern", level: 5, price: 120, reach: 2.6, tone: "warm" },
    { id: "ceil-cage", name: "Industrial cage pendant", level: 7, price: 220, reach: 2.8, tone: "warm" },
    { id: "ceil-wire", name: "Halogen wire lights", level: 10, price: 300, reach: 3.4, tone: "white" },
    { id: "ceil-globe", name: "Glass globe pendant", level: 13, price: 280, reach: 3, tone: "warm" },
    { id: "ceil-edison", name: "Edison bulb cluster", level: 16, price: 380, reach: 3.2, tone: "amber" },
    { id: "ceil-tiffany", name: "Tiffany pendant", level: 19, price: 480, reach: 2.8, tone: "amber" },
    { id: "ceil-chandelier", name: "Crystal chandelier", level: 24, price: 900, reach: 4.2, tone: "warm" }];
  CEILING.forEach(function (c) { c.pic = c.id; });
  var CEIL = {}; CEILING.forEach(function (c) { CEIL[c.id] = c; });
  /** Whether another of a ceiling light can go up now (held till Esc, like a painting): one in storage, or one to buy. */
  function canCeil(s, id) { var c = CEIL[id]; return !!c && (((s.cware || {})[id] || 0) > 0 || (levelOf(s.xp) >= c.level && s.coins >= c.price)); }
  // V23 q7: the fire kit hangs on a wall panel too: every day it saves `saves` dishes that would burn (they wait on the
  // stove instead), refilled at midnight; the big one at level 40 saves 10. Not decorations (they don't count as looks).
  var KITS = [{ id: "firekit", name: "Fire kit", level: 8, price: 1200, pic: "firekit", saves: 5, kit: true },
              { id: "firekit2", name: "Big fire kit", level: 40, price: 2500, pic: "firekit2", saves: 10, kit: true }];
  // 2026-10-24 (Cam: NeuroPets' weapons as wall decor -- singles and arrangements, by level, the sandbox first): hung on
  // a panel like a painting, drawn flat on the wall (tools/make_cafe_weapons.py builds wpn-<id> from the NeuroPets
  // icons). A metal a tier, opening by level; in each, a sword, mace, longsword, maul and kite shield on plaques, then
  // two longswords crossed, then the shield over crossed swords. Bows, staves and the odd ones between. Sandbox only.
  var WEAPON_TIERS = [["bronze", "Bronze", 5, 80], ["iron", "Iron", 10, 150], ["steel", "Steel", 18, 250],
                      ["mithril", "Mithril", 28, 400], ["adamant", "Adamant", 42, 600], ["rune", "Rune", 60, 900]];
  var WEAPONS = [];
  WEAPON_TIERS.forEach(function (t) {
    [["sword", "sword", 0, 1], ["mace", "mace", 1, 1.1], ["longsword", "longsword", 2, 1.3], ["maul", "maul", 3, 1.4], ["kiteshield", "kite shield", 3, 1.4],
     ["crossed", "crossed longswords", 4, 2.5], ["arms", "shield and swords", 6, 4]].forEach(function (w) {
      WEAPONS.push({ id: "w-" + t[0] + w[0], name: t[1] + " " + w[1], level: t[2] + w[2], price: Math.round(t[3] * w[3] / 10) * 10, pic: "wpn-" + t[0] + w[0], weapon: true, vale: true });
    });
  });
  [["woodenclub", "Wooden club", 3, 60], ["shortbow", "Shortbow", 7, 120], ["boneaxe", "Bone axe", 9, 160], ["longbow", "Longbow", 15, 260],
   ["firestaff", "Fire staff", 22, 380], ["fangspear", "Fang spear", 34, 520], ["yewbow", "Yew bow", 38, 560], ["stavescrossed", "Crossed staves", 50, 1500],
   ["mysticstaff", "Mystic staff", 70, 1800], ["magicbow", "Magic bow", 80, 2200]].forEach(function (w) {
    WEAPONS.push({ id: "w-" + w[0], name: w[1], level: w[2], price: w[3], pic: "wpn-" + w[0], weapon: true, vale: true });
  });
  // (Cam, 25 Oct: "add to collection logs NeuroVale and move all the mounted weapons there, the only way to get them is
  // to then receive them for filling orders for the neurovale cart ... Once unlocked they will then appear in buy menu"):
  // a weapon (vale) is won from a full NeuroVale cart -- unlocked for good (s.vale) with one in storage; the sandbox has all
  function valeHas(s, id) { return !!s.sandbox || (s.vale || []).indexOf(id) >= 0; }
  // N51 (Cam's picks): each weapon set into an empty 3D mount (Sheet 23, cut to the wall's slant) -- swords, maces and
  // mauls on the oak plaque (bronze to steel), the walnut one (mithril, adamant), the gilded frame (rune); shields on
  // the shield board; crossed pairs on the wide pegged board; bows, the spear, axe and club on the driftwood plank;
  // staves in the shadow box
  WEAPONS.forEach(function (w) {
    var k = w.id.slice(2), tier = (WEAPON_TIERS.filter(function (t) { return k.indexOf(t[0]) === 0; })[0] || [""])[0];
    w.mount = /kiteshield|arms$/.test(k) ? "mount-shield" : /crossed/.test(k) ? "mount-pegs" : /staff/.test(k) ? "mount-shadowbox"
      : /bow|spear|axe|club/.test(k) ? "mount-driftwood" : tier === "rune" ? "mount-gilded" : tier === "mithril" || tier === "adamant" ? "mount-walnut" : "mount-oak";
  });
  WEAPONS.sort(function (a, b) { return a.level - b.level || a.price - b.price; });
  // N47: Halloween's paintings (painted for the left wall like Sheet 14's, mirrored on the right) -- unlocked with candy
  var HW_PAINTINGS = [["hw1", "The haunted portrait", 40], ["hw2", "Bats across the moon", 30], ["hw3", "The castle on the hill", 35], ["hw4", "The ghost ship", 35],
                      ["hw5", "The pumpkin patch", 30], ["hw6", "Witch at full moon", 40], ["hw7", "Eyes in the woods", 35], ["hw8", "Dancing skeletons", 45]]
    .map(function (p) { return { id: "painting-" + p[0], name: p[1], level: 1, price: 300 + p[2] * 5, pic: "painting-" + p[0], event: "halloween", candy: p[2] }; });
  // Cam, 2026-10-24: your own photos in frames, from the furniture store -- a frame hangs like a painting (Sheet 23's 3D
  // mounts, cut to the wall's slant) with the photo you picked set into it (s.hangPhoto: panel -> photo id; the photos
  // themselves are kept beside the save, cafe.py)
  var PHOTO_FRAMES = [{ id: "photo-oak", name: "Oak photo frame", level: 1, price: 150, pic: "mount-oak", photo: true },
                      { id: "photo-roundel", name: "Round photo frame", level: 1, price: 180, pic: "mount-roundel", photo: true, round: true },
                      { id: "photo-walnut", name: "Walnut photo frame", level: 1, price: 220, pic: "mount-walnut", photo: true },
                      { id: "photo-shadowbox", name: "Shadow box frame", level: 1, price: 300, pic: "mount-shadowbox", photo: true },
                      { id: "photo-gilded", name: "Gilded photo frame", level: 1, price: 400, pic: "mount-gilded", photo: true },
                      // (Cam, 25 Oct: "add the vertical frame options to the photo frame builder") -- portrait ones
                      { id: "photo-oak-v", name: "Oak portrait frame", level: 1, price: 150, pic: "mount-oak-v", photo: true, portrait: true },
                      { id: "photo-walnut-v", name: "Walnut portrait frame", level: 1, price: 220, pic: "mount-walnut-v", photo: true, portrait: true },
                      { id: "photo-shadowbox-v", name: "Portrait shadow box", level: 1, price: 300, pic: "mount-shadowbox-v", photo: true, portrait: true },
                      { id: "photo-gilded-v", name: "Gilded portrait frame", level: 1, price: 400, pic: "mount-gilded-v", photo: true, portrait: true }];
  var photoIdOK = function (p) { return typeof p === "string" && /^[A-Za-z0-9-]{6,40}$/.test(p); };
  // V25 q5/q6 (N56): Halloween's things for the walls -- four cobwebs, a broom, and three tarot frames that show a Major
  // Arcana card from Cam's own decks in NeuroNet's card library (s.hangCard: panel -> card; the card pictures are read
  // from the person's NeuroNet data by neurocafe.py, never put in the game's files -- they're published decks)
  var MAJOR = ["The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor", "The Hierophant", "The Lovers", "The Chariot",
               "Strength", "The Hermit", "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance", "The Devil", "The Tower",
               "The Star", "The Moon", "The Sun", "Judgement", "The World"];
  var HW_HANG = [{ id: "web-1", name: "Round cobweb", price: 60, candy: 15 }, { id: "web-2", name: "Corner cobweb", price: 70, candy: 15 },
                 { id: "web-3", name: "Tattered cobwebs", price: 70, candy: 18 }, { id: "web-4", name: "Cobweb and spider", price: 90, candy: 25 },
                 { id: "hw_broomwall", name: "Witch's broom on pegs", price: 90, candy: 20 },
                 { id: "frame-tarotgold", name: "Gold tarot frame", price: 400, candy: 50, card: "oldschool" },
                 { id: "frame-crows", name: "Murder of crows frame", price: 450, candy: 60, card: "crows" },
                 { id: "frame-stars", name: "Starry tarot frame", price: 300, candy: 40, card: "oldschool" }]
    .map(function (p) { return Object.assign({ level: 1, pic: p.id, event: "halloween", group: p.card ? null : "wall", photo: !!p.card, portrait: !!p.card }, p); });   // (tarot frames stand tall, like the cards)
  function cardOK(c) { return MAJOR.indexOf(c) >= 0; }
  var PAINTING = {}; PAINTINGS.concat(KITS, WEAPONS, WALL_THINGS, HW_PAINTINGS, PHOTO_FRAMES, HW_HANG).forEach(function (p) { PAINTING[p.id] = p; });   // everything that hangs
  PAINTINGS.concat(HW_PAINTINGS).forEach(function (p) { p.framed = true; });   // (PT56: a painting's frame takes a paint, like a photo frame's)
  function kitSaves(s) { return Object.keys(s.hang || {}).reduce(function (n, k) { var w = PAINTING[s.hang[k]]; return Math.max(n, w && w.kit ? w.saves : 0); }, 0); }
  /** One wall panel of a wallpaper you don't own (PT52): a fifth of the whole wallpaper, to the nearest 5. */
  function panelPrice(w) { return w.price ? Math.max(5, Math.round(w.price / 5 / 5) * 5) : 0; }
  /** How many stoves (or counters) a level allows: 1, then 2 from the tutorial's level-up, then one more every 5 levels.
      A buffet counter (from level 3) is one of your counters (PT46, Cam: "have them count towards our counter count"):
      serving and buffet counters share the counters' number. */
  function allowed(kind, level) {
    if (kind === "till") return 1;
    if (kind === "buffet") return level < THINGS.buffet.level ? 0 : allowed("counter", level);
    if (THINGS[kind] && THINGS[kind].pantry) return 1;
    if (THINGS[kind] && THINGS[kind].furniture) return level < THINGS[kind].level ? 0 : 99;
    if (THINGS[kind] && THINGS[kind].vend) return level < THINGS[kind].level ? 0 : 1 + Math.floor((level - THINGS[kind].level) / 4);
    if (THINGS[kind] && (THINGS[kind].machine || THINGS[kind].cooker || THINGS[kind].shelf)) return level < THINGS[kind].level ? 0 : 1 + Math.floor((level - THINGS[kind].level) / 10);
    return level < 2 ? 1 : 2 + Math.floor((level - 2) / 5);
  }
  var COUNTERS = ["counter", "buffet"];
  /** Upgrades (2026-10-21, Cam): bought for one stove or counter at a time, from the Upgrades button or by clicking a
      counter. A fridge component makes a counter a refrigerated one: a dish waits UNDER it (one under a serving
      counter, two under a buffet) and goes up on top when the one there sells out; it doesn't spoil while it's cold.
      A self-cleaning stove is clean again by itself after every dish. Stored or sold, a thing's upgrade comes out
      and is kept as a spare part (s.parts), fitted free to the next one. */
  var UPGRADES = {
    fridge: { id: "fridge", name: "Fridge component", on: COUNTERS, price: 300, level: 2,
              says: "Keeps a dish cold under the counter -- one under a serving counter, two under a buffet -- and puts it on top when the top sells out." },
    selfclean: { id: "selfclean", name: "Self-cleaning", on: ["stove"].concat(APPLIANCES), price: 400, level: 2,
                 says: "The stove cleans itself after every dish (you still get the cleaning XP)." },
    // (V26 q5's espresso machine for a serving counter went 2026-11-18: the barista counter makes the coffees now)
    // V26 q7: the till's -- brings the coins in from the stalls outside and the popcorn machines every 10 minutes
    cashier: { id: "cashier", name: "Head cashier", on: ["till"], price: 250000, level: 40,
               says: "Every 10 minutes brings the coins from your carts, popcorn machines and the cinema into the till. It doesn't refill them -- a stall that's run dry waits for you." }
  };
  /** How many dishes wait under a counter: none without a fridge, one under a serving counter, two under a buffet. */
  function underCap(it) { return it.fridge ? (it.kind === "buffet" ? 2 : 1) : 0; }
  /** A plate on top ran out: the next dish from under the counter goes up. */
  function restock(it, t) {
    if (!it || !it.under || !it.under.length) return;
    plates(it).forEach(function (pl) {
      if (pl.dish || !it.under.length) return;
      var u = it.under.shift();
      pl.dish = u.dish; pl.n = u.n; pl.res = 0; pl.since = t; pl.farm = u.farm || 0; pl.fres = 0;
    });
  }
  /** What this café may have: the level's number, plus any counters given as a gift (s.extraCounters). */
  function allowedHere(s, kind, level) {
    if (THINGS[kind] && THINGS[kind].sandbox && !s.sandbox) return 0;
    var n = allowed(kind, level);
    return COUNTERS.indexOf(kind) >= 0 && n > 0 ? n + (s.extraCounters | 0) : n;
  }
  var SELLS = ["stove", "counter", "buffet"].concat(Object.keys(THINGS).filter(function (k) { return THINGS[k].furniture || THINGS[k].machine || THINGS[k].cooker || THINGS[k].vend || THINGS[k].shelf; }));

  // ---- sitting down (2026-10-21): a chair faces the way it's turned -- 0 down-left (+y), 1 down-right (+x), 2 up-left
  // (-x), 3 up-right (-y), as its pictures show (PT48: the back view faces up-LEFT; 2 and 3 were the wrong way round)
  // -- and is a seat when a table is right in front of it. Some customers sit to eat after paying,
  // and may leave a tip; seats bring a few more customers.
  // N42 (Cam): a tip is a coin LEFT ON THE TABLE when they get up -- you pick it up; takeaway customers don't tip, so
  // tables and chairs pay their way. Not everyone tips (TIP_CHANCE); an armchair's sitter leaves more.
  // 2026-10-24 (Cam: swatches "for the other furniture"): what each thing's recolourable part is made of -- the
  // material picks its swatch set (cafe.js SWATCH_SETS) and how its fabric layer was cut (tools/make_cafe_fabric.py)
  var MATERIAL = { armchair: "leather", table: "wood", chair: "wood", table_square: "wood", table_long: "wood", table_coffee: "wood", table_wood: "wood", stool: "wood",
                   coatstand: "wood", bookshelf: "darkwood", plant: "pot", palm: "pot", floorlamp: "shade", table_garden: "light", chair_garden: "light",
                   table_bistro: "light", chair_bistro: "dark", table_low: "wood", table_lowround: "wood", cushion: "shade", pouf: "linen",   // (V25 q2)
                   pot_lavender: "pot", pot_flowers: "pot", pot_ferns: "pot", cupboard: "shade",
                   halfwall: "white", lattice: "white", halfbrick: "wood", screen: "wood", vipropes: "velvet", planterwall: "wood", standmirror: "wood", barrier: "shade",   // (N48 dividers)
                   counter: "wood", buffet: "wood", till: "wood",
                   // (2026-11-08, Cam: "swatches for the stoves, milkshake makers and counters")
                   stove: "enamel", shakebar: "mint", shakeshelf: "mint", shakevend: "pink", sushibar: "wood", sushishelf: "wood",
                   coffeebar: "coffee", coffeeshelf: "coffee" };   // (2026-11-18: the coffee counters' brown panels)   // (PT56: the till's cabinet; its register the brass below)   // (Cam: counters by swatch -- counter styles go, the sandbox first)
  Object.keys(MATERIAL).forEach(function (k) { if (THINGS[k]) THINGS[k].tint = MATERIAL[k]; });
  // PT56 (Cam: "change color of the wood top as well for this and other 2 tone items ... the black divider with a red
  // top"): a second part with its own material and paint -- its layer <pic>-fab2, its colour the thing's tint2.
  // PARTS names the two for the swatch rows.
  // ("white": the painted dividers -- full-strength paint, PT56 Cam: "the paint still doesn't cover the whole object")
  // (2026-11-08, Cam: the velvet rope, "change the color of the poles and the ropes")
  var MATERIAL2 = { halfwall: "wood", halfbrick: "white", barrier: "dark", till: "brass", vipropes: "brass" };
  var PARTS = { halfwall: ["Panels", "Top rail"], halfbrick: ["Bricks", "Coping"], barrier: ["Banner", "Posts"], till: ["Cabinet", "Register"], vipropes: ["Rope", "Posts"] };
  Object.keys(MATERIAL2).forEach(function (k) { if (THINGS[k]) { THINGS[k].tint2 = MATERIAL2[k]; THINGS[k].parts = PARTS[k]; } });
  // ---- paints (2026-10-24, Cam: "to unlock swatches ... from levelling up, Aunty's furniture paint (comes in the box),
  // purchased from the furniture store (an actual building placed in the game)"). A paint is a swatch's NAME -- owning Red
  // gives Red on every material. Natural (a set's first, as painted) is always yours. Ten come with levels; every one is
  // sold at the furniture store, and Aunty sends a tin now and then. The paint mixer (from the store) gives the sliders.
  // (Released to the café 24 October -- the dropper went. The counter styles are sold there too, one counter at a time.)
  var PAINTS = [
    { id: "Walnut", level: 3, price: 150 }, { id: "Pale", level: 5, price: 150 }, { id: "Cream", level: 7, price: 200 }, { id: "Sage", level: 9, price: 250 },
    { id: "Red", level: 12, price: 300 }, { id: "Blue", level: 15, price: 300 }, { id: "Charcoal", level: 18, price: 350 }, { id: "Teal", level: 22, price: 400 },
    { id: "Mustard", level: 26, price: 400 }, { id: "Ebony", level: 30, price: 500 },
    { id: "Rose", price: 450 }, { id: "Plum", price: 500 }, { id: "Emerald", price: 500 }, { id: "Terracotta", price: 450 }, { id: "White wash", price: 600 }, { id: "Bronze", price: 800 }];
  var PAINT_OF = {}; PAINTS.forEach(function (p) { PAINT_OF[p.id] = p; });
  var MIXER = { name: "Paint mixer", price: 2500, says: "Mix any colour you like: the Colour, Shade and Vivid sliders." };
  /** Whether a paint is yours: bought, from Aunty, or come with your level (names that aren't paints -- Natural -- are). */
  function hasPaint(s, id) {
    var p = PAINT_OF[id];
    if (!p) return true;
    if (s.sandbox && s.dev && s.dev.allPaints) return true;
    return (s.paints || []).indexOf(id) >= 0 || (!!p.level && levelOf(s.xp || 0) >= p.level);
  }
  function hasMixer(s) { return !!s.mixer || !!(s.sandbox && s.dev && s.dev.allPaints); }
  /** The furniture store you've put outside (its paints are sold there). */
  function furnStore(s) { return (s.decor || []).filter(function (o) { return DECO[o.id] && DECO[o.id].store; })[0] || null; }
  var FACE = [[0, 1], [1, 0], [-1, 0], [0, -1]], EAT = 20 * 1000, DINE_TIP = 1, DINE_CHANCE = 0.6, TIP_CHANCE = 0.75;
  function isTable(o) { return !!(THINGS[o.kind] && THINGS[o.kind].table); }
  function isSeat(o) { return !!(THINGS[o.kind] && THINGS[o.kind].seat); }
  /** A seat with no front (the stools, the floor cushions): whoever sits turns to face the table beside it. */
  function roundSeat(o) { return !!(THINGS[o.kind] && (THINGS[o.kind].stool || THINGS[o.kind].round)); }
  /** V25 q2: low seats go with low tables, the rest with the rest. */
  function low(o) { return !!(THINGS[o.kind] && THINGS[o.kind].low); }
  function seatTable(s, ch, items) {
    var f = FACE[(ch.dir | 0) % 4], cs = cells(ch), lo = low(ch);
    // (V24, Cam: "a chair placed on the patio can be placed at a table on the inside" -- not through the café's side wall)
    return (items || s.items).filter(function (o) { return isTable(o) && low(o) === lo && cs.some(function (c) { var q = { x: c.x + f[0], y: c.y + f[1] }; return covers(o, q.x, q.y) && !walled(s, c, q); }); })[0] || null;
  }
  /** The tile of its table a seat faces (a long table covers two: the half in front of it). */
  function tableCell(s, ch) {
    var tb = seatFor(s, ch);
    if (!tb) return null;
    var ds = roundSeat(ch) ? [0, 1, 2, 3] : [(ch.dir | 0) % 4];
    for (var i = 0; i < ds.length; i++) {
      var f = FACE[ds[i]], cs = cells(ch);
      for (var j = 0; j < cs.length; j++) if (covers(tb, cs[j].x + f[0], cs[j].y + f[1]) && !walled(s, cs[j], { x: cs[j].x + f[0], y: cs[j].y + f[1] })) return { x: cs[j].x + f[0], y: cs[j].y + f[1] };
    }
    return { x: tb.x, y: tb.y };
  }
  /** How many can sit on it: a sofa two, its places on its two tiles (cells(it)[n]); any other seat one. */
  function places(it) { return (THINGS[it.kind] && THINGS[it.kind].places) || 1; }
  // a stool has no front: any table beside it will do (whoever sits turns to face it)
  function seatFor(s, ch) {
    if (!roundSeat(ch)) return seatTable(s, ch);
    for (var d = 0; d < 4; d++) { var t = seatTable(s, { kind: ch.kind, x: ch.x, y: ch.y, dir: d }); if (t) return t; }
    return null;
  }
  /** N49 i7: the way a chair put down at (x, y) should face to sit at a table beside it (null: no table there). */
  function autoFace(s, kind, x, y, uid) {
    if (!isSeat({ kind: kind }) || roundSeat({ kind: kind })) return null;
    var turns = THINGS[kind].turns || 4, rest = s.items.filter(function (o) { return o.uid !== uid; });
    for (var d = 0; d < turns; d++) if (seatTable(s, { kind: kind, x: x, y: y, dir: d }, rest)) return d;
    return null;
  }
  /** A table on the patio, by day (7 in the morning to 7 at night): a coin more in tips (V24 q6). */
  function patioDay(s, tb, t) { var h = new Date(t).getHours(); return inPatio(s, tb.x, tb.y) && h >= 7 && h < 19; }
  function seats(s) { return s.items.filter(function (o) { return isSeat(o) && seatFor(s, o); }); }
  /** Which way someone sitting on it faces (on a stool: towards its table). */
  function seatDir(s, ch) {
    if (!roundSeat(ch)) return (ch.dir | 0) % 4;
    for (var d = 0; d < 4; d++) if (seatTable(s, { kind: ch.kind, x: ch.x, y: ch.y, dir: d })) return d;
    return 0;
  }

  // ---- the vending machine (Cam's notes: a second income): it fills its own takings by the clock; click to empty it
  // and a customer now and then buys from it (sale coins each, into its takings); visitors a minute per machine
  var VEND = { every: 5 * 60 * 1000, coins: 3, max: 120, sale: 4, visitors: 0.6, chance: 0.25 };
  // V22 q4: how the coin machines earn. The jukebox and the piano: someone getting up from a seat may drop coins in
  // (sit = the chance, coin = how many). The arcade and pinball: people come in to play (like the vending machine's
  // visitors), stay a while and pay play coins. Coins wait in the machine (up to max) until you click it; each machine
  // makes the café a little more popular (pop). One of each to start, another every 10 levels.
  var MACHINES = {
    jukebox: { sit: 0.35, coin: 1, pop: 0.3 },
    arcade: { play: 2, stay: 18 * 1000, visitors: 0.4, pop: 0.3 },
    pinball: { play: 3, stay: 22 * 1000, visitors: 0.4, pop: 0.3 },
    piano: { sit: 0.3, coin: 2, pop: 0.5 },
    // N48 (Sheet 21): the games -- dearer ones pay more a play and draw a few more players (the karaoke: sitters sing)
    skeeball: { play: 3, stay: 20 * 1000, visitors: 0.4, pop: 0.3 },
    basketball: { play: 3, stay: 16 * 1000, visitors: 0.45, pop: 0.3 },
    karaoke: { sit: 0.3, coin: 3, pop: 0.5 },
    foosball: { play: 3, stay: 24 * 1000, visitors: 0.4, pop: 0.3 },
    lightgun: { play: 4, stay: 20 * 1000, visitors: 0.45, pop: 0.35 },
    airhockey: { play: 4, stay: 18 * 1000, visitors: 0.45, pop: 0.35 },
    dance: { play: 5, stay: 22 * 1000, visitors: 0.5, pop: 0.4 },
    whackamole: { play: 4, stay: 14 * 1000, visitors: 0.5, pop: 0.35 },
    pingpong: { play: 4, stay: 26 * 1000, visitors: 0.5, pop: 0.35 },
    pooltable: { play: 5, stay: 30 * 1000, visitors: 0.5, pop: 0.4 },
    shuffleboard: { play: 5, stay: 24 * 1000, visitors: 0.5, pop: 0.4 },
    airhockey2: { play: 6, stay: 20 * 1000, visitors: 0.55, pop: 0.45 },
    apples: { play: 3, stay: 16 * 1000, visitors: 0.45, pop: 0.35 },
    fortune: { play: 4, stay: 20 * 1000, visitors: 0.45, pop: 0.35 },
    claw: { play: 4, stay: 14 * 1000, visitors: 0.5, pop: 0.35 },
    hauntedhouse: { play: 5, stay: 24 * 1000, visitors: 0.5, pop: 0.4 },
    crystalball: { play: 15, stay: 60 * 1000, visitors: 0.35, pop: 0.35 },     // (V25 q3: a reading, 15 and 20 coins)
    tarotreader: { play: 20, stay: 60 * 1000, visitors: 0.35, pop: 0.4 },
    popcorn: { play: 3, stay: 6 * 1000, visitors: 0.4, pop: 0.2 }            // (V26 q3: a bag of popcorn, 3 coins)
  }, MACHINE_MAX = 150, FUN_CAP = 1.5;
  // ---- V26 (Cam, 25 Oct: "all vending machines, arcade machines, entertainment machines etc will require refilling after
  // certain amount of time"). q1: everything that takes coins runs for 3 hours of takings -- counted only while the café's
  // open (it.used, ms) -- then shows it's empty and takes nothing more. Clicked, it's refilled: the coins in it come out,
  // less a 20% cut (at least 5; under 25 coins in it, the 5 is taken from your purse). The cinema runs 3 showings a reel.
  var REFILL = { run: 3 * 60 * MIN, cut: 0.2, least: 5 };
  // q4: the vending machines -- what a sale brings, how often people come for one, and the energy drink's dark boost
  var VENDS = { vending: { sale: 4, visitors: 0.6 }, shakevend: { sale: 5, visitors: 0.6 }, energyvend: { sale: 4, visitors: 0.9, dark: 1.5 } };
  // q2: the carts -- street things that sell on their own in their hours (local time), coins every 5 minutes into the
  // cart (up to STALL_MAX), half again in their busy hours. The popcorn cart wasn't priced in the vote: evenings, like the
  // cinema it goes with.
  var STALL_MAX = 400, STALL_EVERY = 5 * MIN;
  var CARTS = {
    icecart: { coins: 8, from: 10, to: 20, busy: function (d) { var m = d.getMonth(), h = d.getHours(); return m >= 5 && m <= 7 && h >= 12 && h < 17; } },
    coffeecart: { coins: 6, from: 6, to: 18, busy: function (d) { var h = d.getHours(); return h >= 7 && h < 10; } },
    popcart: { coins: 5, from: 16, to: 24, busy: function (d) { var h = d.getHours(); return h >= 19; } }
  };
  // q3: the outdoor cinema -- a film at 7, 9 and 11 pm; each brings 4 coins for every place to sit within 4 tiles
  // (a bench 2, a picnic table 4, up to 12), 2 more a place with a popcorn cart or machine within 5 tiles. A reel lasts 3.
  var CINEMA = { shows: [19, 21, 23], near: 4, most: 12, per: 4, corn: 2, cornNear: 5, reel: 3 };
  var CASHIER_EVERY = 10 * MIN;                                   // q7: the Head cashier's round
  var RUN_BASE = null;                                            // (advance(): when its stretch of time began)
  function isVend(it) { return !!(it && THINGS[it.kind] && THINGS[it.kind].vend); }
  function isStall(o) { return !!(o && (CARTS[o.id] || o.id === "cinema")); }
  /** Whether this takes refills: a vending or coin machine, a cart or the cinema. */
  function refills(o) { return !!o && (isVend(o) || !!MACHINES[o.kind] || isStall(o)); }
  /** Whether it's run dry (at time t, inside advance(): counting the time since it began while the café's open). */
  function dryAt(s, o, t) {
    if (o.id === "cinema") return (o.shows || 0) >= CINEMA.reel;
    var used = o.used || 0;
    if (RUN_BASE != null && t != null && !s.closed) used += Math.max(0, t - RUN_BASE);
    return used >= REFILL.run;
  }
  function takingsOf(o) { return isVend(o) ? Math.min(VEND.max, o.sold || 0) : o.coins || 0; }
  /** What a refill takes: 20%, at least 5 (from your purse, if the coins inside don't cover it). */
  function refillCut(n) { return Math.max(REFILL.least, Math.round(n * REFILL.cut)); }
  function cartsAllowed(d, lv) { return lv < d.level ? 0 : 1 + Math.floor((lv - d.level) / 15); }
  /** Each local hour in [a, b): fn(date at its start, ms of it inside). */
  function hourWalk(a, b, fn) {
    for (var t = a, g = 0; t < b && g++ < 400;) { var n = new Date(t); n.setMinutes(60, 0, 0); var e = Math.min(b, n.getTime()); fn(new Date(t), e - t); t = e; }
  }
  /** What one film brings at the cinema: its places to sit near it, and popcorn nearby. */
  function showTakings(s, o) {
    var near = benchPlaces(s).filter(function (b) { return Math.hypot(b.bx - o.x, b.by - o.y) <= CINEMA.near; }).length;
    var n = Math.min(CINEMA.most, near);
    var corn = (s.decor || []).some(function (d) { return d.id === "popcart" && Math.hypot(d.x - o.x, d.y - o.y) <= CINEMA.cornNear; })
      || s.items.some(function (it) { return it.kind === "popcorn" && Math.hypot(it.x + 0.5 - o.x, it.y + 0.5 - o.y) <= CINEMA.cornNear; });
    return n * (CINEMA.per + (corn ? CINEMA.corn : 0));
  }
  /** The stretch a to b while the café's open: machines use up their run, vending machines and carts fill, films show,
      the Head cashier makes his rounds. */
  function stallsRun(s, a, b) {
    if (b > a && !s.closed) {
      s.items.forEach(function (it) {
        if (!refills(it)) return;
        var add = Math.min(b - a, REFILL.run - (it.used || 0));
        if (add <= 0) return;
        if (isVend(it)) {
          it.tick = (it.tick || 0) + add;
          var n = Math.floor(it.tick / VEND.every);
          it.tick -= n * VEND.every;
          it.sold = Math.min(VEND.max, (it.sold || 0) + n * VEND.coins);
        }
        it.used = (it.used || 0) + add;
      });
      (s.decor || []).forEach(function (o) {
        var C0 = CARTS[o.id];
        if (C0) hourWalk(a, b, function (d, ms) {
          var h = d.getHours(), go = Math.min(ms, REFILL.run - (o.used || 0));
          if (h < C0.from || h >= C0.to || go <= 0) return;
          o.tick = (o.tick || 0) + go * (C0.busy(d) ? 1.5 : 1);
          var n2 = Math.floor(o.tick / STALL_EVERY);
          o.tick -= n2 * STALL_EVERY;
          o.coins = Math.min(STALL_MAX, (o.coins || 0) + n2 * C0.coins);
          o.used = (o.used || 0) + go;
        });
        if (o.id === "cinema") {
          for (var day = new Date(a), g = 0; g++ < 9; day.setDate(day.getDate() + 1)) {
            CINEMA.shows.forEach(function (h) {
              var T = new Date(day); T.setHours(h, 0, 0, 0); T = T.getTime();
              if (T > a && T <= b && (o.shows || 0) < CINEMA.reel && T > (o.lastShow || 0)) {
                o.coins = Math.min(STALL_MAX, (o.coins || 0) + showTakings(s, o)); o.shows = (o.shows || 0) + 1; o.lastShow = T;
              }
            });
            if (day.getTime() > b) break;
          }
        }
      });
    }
    // the Head cashier (q7): the stalls' coins into the till every 10 minutes -- never a refill
    var till = s.items.filter(function (it) { return it.kind === "till"; })[0];
    if (till && till.cashier && b >= (s.cashAt || 0) + CASHIER_EVERY) {
      s.cashAt = b;
      (s.decor || []).filter(isStall).concat(s.items.filter(function (it) { return it.kind === "popcorn"; })).forEach(function (o) {
        if (o.coins > 0) { s.till += o.coins; s.stats.earned += o.coins; o.coins = 0; }
      });
    }
  }
  function machines(s, k) { return s.items.filter(function (o) { return THINGS[o.kind] && THINGS[o.kind].machine && (!k || o.kind === k); }); }
  /** Places people come in to use: vending machines, arcades and pinball machines. */
  function visitable(s, t) { return s.items.filter(function (o) { return (isVend(o) || (MACHINES[o.kind] && MACHINES[o.kind].play)) && !dryAt(s, o, t); }); }
  /** What waits in a vending machine: what it sold, and what it filled by the clock while open (stallsRun). */
  function vendTakings(it) { return Math.min(VEND.max, it.sold || 0); }

  // ---- floors (2026-10-21): bought a tile at a time; nicer ones open with levels. Cam's Sheet 02.
  var FLOORS = [
    { id: "grey", name: "Grey stone", level: 1, price: 0 }, { id: "lightgrey", name: "Pale stone", level: 1, price: 5 },
    { id: "white", name: "White tiles", level: 1, price: 6 }, { id: "checker", name: "Chequerboard", level: 2, price: 8 },
    { id: "terracotta", name: "Terracotta", level: 2, price: 8 }, { id: "paleblue", name: "Pale blue tiles", level: 3, price: 10 },
    { id: "sage", name: "Sage tiles", level: 3, price: 10 }, { id: "stone", name: "Sandstone", level: 4, price: 12 },
    { id: "oak", name: "Oak boards", level: 4, price: 14 }, { id: "walnut", name: "Walnut boards", level: 5, price: 16 },
    { id: "maple", name: "Maple boards", level: 5, price: 16 }, { id: "herringbone", name: "Herringbone", level: 6, price: 20 },
    { id: "red", name: "Red carpet", level: 6, price: 18 }, { id: "berber", name: "Berber carpet", level: 7, price: 18 },
    { id: "blue", name: "Blue carpet", level: 7, price: 18 }, { id: "green", name: "Green carpet", level: 8, price: 18 },
    { id: "turf", name: "Fake grass", level: 5, price: 15 },   // (2026-11-08, Cam: "fake grass for indoors": tools/make_cafe_turf.py)
    // V24 q10: the patio's own outdoor floors (only out there; the café's floors go there too)
    { id: "deck", name: "Decking", level: 12, price: 12, patio: true }, { id: "flagstone", name: "Flagstones", level: 12, price: 14, patio: true },
    { id: "brickpave", name: "Brick paving", level: 14, price: 16, patio: true }, { id: "gravel", name: "Patio gravel", level: 12, price: 8, patio: true },
    // N55 (Cam, 25 Oct: "more variety of floors and walls inside the cafe and the patio"): Sheet 35's café floors ...
    { id: "slate", name: "Slate tiles", level: 8, price: 18 }, { id: "marble", name: "White marble", level: 12, price: 26 },
    { id: "blackmarble", name: "Black marble", level: 18, price: 32 }, { id: "hexwhite", name: "White hexagon tiles", level: 9, price: 18 },
    { id: "mosaic", name: "Blue mosaic", level: 10, price: 20 }, { id: "encaustic", name: "Encaustic tiles", level: 14, price: 24 },
    { id: "cork", name: "Cork tiles", level: 8, price: 14 }, { id: "bamboo", name: "Bamboo strips", level: 11, price: 18 },
    { id: "cherry", name: "Cherry boards", level: 13, price: 20 }, { id: "whitewash", name: "Whitewashed boards", level: 10, price: 18 },
    { id: "greyoak", name: "Grey oak boards", level: 12, price: 20 }, { id: "chevron", name: "Chevron parquet", level: 16, price: 26 },
    { id: "cream", name: "Cream carpet", level: 9, price: 18 }, { id: "purple", name: "Purple carpet", level: 11, price: 18 },
    { id: "persian", name: "Persian carpet", level: 20, price: 30 }, { id: "concrete", name: "Polished concrete", level: 8, price: 12 },
    // ... and Sheet 37's patio floors
    { id: "ptile", name: "Terracotta pavers", level: 12, price: 12, patio: true }, { id: "slatepave", name: "Slate paving", level: 13, price: 14, patio: true },
    { id: "cobbles", name: "Cobblestones", level: 14, price: 14, patio: true }, { id: "crazypave", name: "Crazy paving", level: 15, price: 16, patio: true },
    { id: "compdeck", name: "Grey composite decking", level: 16, price: 16, patio: true }, { id: "cedar", name: "Cedar decking", level: 17, price: 18, patio: true },
    { id: "bark", name: "Bark chippings", level: 12, price: 6, patio: true }, { id: "lawn", name: "Artificial lawn", level: 13, price: 10, patio: true },
    { id: "hexpave", name: "Hexagon pavers", level: 18, price: 18, patio: true }, { id: "outmarble", name: "Outdoor marble", level: 22, price: 26, patio: true },
    { id: "medtile", name: "Mediterranean tiles", level: 20, price: 22, patio: true }, { id: "basket", name: "Basketweave brick", level: 16, price: 16, patio: true },
    { id: "setts", name: "Granite setts", level: 19, price: 18, patio: true }, { id: "pebbles", name: "Pebble mosaic", level: 24, price: 24, patio: true },
    { id: "sandslab", name: "Sandstone slabs", level: 14, price: 14, patio: true }, { id: "bamdeck", name: "Bamboo decking", level: 18, price: 18, patio: true }
  ];
  var FLOOR = {};
  FLOORS.forEach(function (f) { FLOOR[f.id] = f; });

  // ---- footprints (2026-10-21): a buffet counter is two tiles long, so everything asks which tiles a thing covers ----
  /** Which way a two-tile thing runs: turns 0 and 3 along x, 1 and 2 along y (the pictures' mirrored pairs; a sofa
      facing +y or -y lies along x, so the same rule). */
  function alongX(dir) { dir = (dir | 0) % 4; return dir === 0 || dir === 3; }
  /** The tiles a thing covers: its own, and for a buffet counter, a sofa or a big game (two) the next one along. */
  function cells(it) {
    if (it.kind !== "buffet" && it.kind !== "sofa" && !(THINGS[it.kind] && THINGS[it.kind].two)) return [{ x: it.x, y: it.y }];
    return alongX(it.dir) ? [{ x: it.x, y: it.y }, { x: it.x + 1, y: it.y }] : [{ x: it.x, y: it.y }, { x: it.x, y: it.y + 1 }];
  }
  function covers(it, x, y) { return cells(it).some(function (c) { return c.x === x && c.y === y; }); }
  /** The dishes a counter holds: a serving counter is its own one plate; a buffet counter has two. */
  function plates(it) {
    if (it.kind === "counter") return [it];
    if (it.kind === "buffet" || ownTop(it) || isShelf(it)) return it.plates || [];
    return [];
  }
  function serves(it) { return it.kind === "counter" || it.kind === "buffet" || ownTop(it) || isShelf(it); }
  /** A bar that serves onto its own top (the sushi bar); the milkshake counter is prep only (2026-10-26). */
  function ownTop(it) { return isBar(it) && !THINGS[it.kind].prep; }
  /** A plain milkshake counter (2026-10-26): a bare top for one menu's dishes only, a place for each of its slots. */
  function isShelf(it) { return !!(it && THINGS[it.kind] && THINGS[it.kind].shelf); }
  function shelfTakes(it, id) { return isShelf(it) && !!DISH[id] && DISH[id].menu === THINGS[it.kind].shelf; }
  function emptyPlates(n) { var out = []; for (var i = 0; i < n; i++) out.push({ dish: null, n: 0 }); return out; }
  /** A milkshake counter or a sushi bar (V26 q6): it cooks, and its own top is where the food goes. */
  function isBar(it) { return !!(it && THINGS[it.kind] && THINGS[it.kind].bar); }
  // the bigger floors (V22 q2): each one at its level, for its coins
  // 2026-11-01 (Cam: "we need more expansions earlier in the game so we can have a large space in the cafe"): a size
  // every 2 levels to 10x10 at 12, then 13x13 at level 22 (Cam: "13x13 should be what is unlocked at level 22 then the
  // expansions slow down again. 14x14 is to much at this level"), then one every 4 levels, 30x30 at 100; cheaper too --
  // 600 for 5x5, 16,000 for 10x10, then 20% more a size (was 7x7 at 10, 10x10 at 25 for 37,500, 13x13 at 33)
  var EXPANSIONS = [{ size: 5, level: 2, coins: 600 }, { size: 6, level: 4, coins: 1500 }, { size: 7, level: 6, coins: 3000 },
                    { size: 8, level: 8, coins: 6000 }, { size: 9, level: 10, coins: 10000 }, { size: 10, level: 12, coins: 16000 }];
  var EXPAND_LV = { 11: 15, 12: 18, 13: 22, 14: 26, 15: 30, 16: 34, 17: 38, 18: 42, 19: 46, 20: 50, 21: 54, 22: 58, 23: 62, 24: 67, 25: 72, 26: 77, 27: 82, 28: 88, 29: 94, 30: 100 };
  for (var xs = 11; xs <= 30; xs++) EXPANSIONS.push({ size: xs, level: EXPAND_LV[xs], coins: Math.round(16000 * Math.pow(1.2, xs - 10) / 500) * 500 });
  var EXPAND = EXPANSIONS[0], BIGGEST = EXPANSIONS[EXPANSIONS.length - 1].size;
  // ---- the patio (V24, 2026-10-25, Cam: "a seating area with our cafe that extends off the side and has a side door for
  // access ... this will need to expand when the cafe expands ... the tables in this area will gain tips. All inside
  // furniture can be placed here"): a strip of floor along the café's front-right side (x from the café's size, y the
  // café's length), PATIOS deep. It's part of the café -- anything that goes inside goes there -- reached only through its
  // side door (s.patio.door: the row of the doorway in the café's front edge). Railings along its back (RAILS: half-wall
  // styles since 2026-11-08, half walls on its back edge); its own outdoor floors (FLOORS .patio) or the café's. Tables there tip a coin more by day (q6).
  var PATIOS = [{ depth: 3, level: 12, coins: 6000 }, { depth: 4, level: 18, coins: 8000 }, { depth: 5, level: 24, coins: 10500 }, { depth: 6, level: 30, coins: 14000 }];
  var PATIO_TIP = 1;
  var RAILS = [
    { id: "wood", name: "Plain wood railing", level: 12, price: 0 }, { id: "picket", name: "White picket", level: 12, price: 250 },
    { id: "iron", name: "Black wrought iron", level: 14, price: 600 }, { id: "glass", name: "Glass panels", level: 18, price: 900 },
    { id: "rope", name: "Rope and posts", level: 16, price: 500 }, { id: "hedge", name: "Low hedge planter", level: 20, price: 800 },
    // (2026-10-25) Sheet 29's two spares, painted with the rest: bamboo, and Halloween's iron with pumpkins (candy, like its wallpapers)
    { id: "bamboo", name: "Bamboo railing", level: 22, price: 700 }, { id: "spooky", name: "Pumpkin iron railing", level: 1, price: 750, event: "halloween", candy: 60 },
    // N55: Sheet 38's railings
    { id: "pastel", name: "Pastel picket", level: 13, price: 400 }, { id: "wicker", name: "Wicker screen", level: 15, price: 600 },
    { id: "chain", name: "Posts and chain", level: 16, price: 550 }, { id: "trellis", name: "Rose trellis", level: 18, price: 850 },
    { id: "ivyiron", name: "Ivy iron railing", level: 20, price: 900 }, { id: "festoon", name: "Festoon-light railing", level: 22, price: 950 },
    { id: "balustrade", name: "Stone balustrade", level: 24, price: 1200 }, { id: "corten", name: "Corten steel panel", level: 26, price: 1100 }];
  var RAIL = {}; RAILS.forEach(function (r) { RAIL[r.id] = r; });
  function nextPatio(s) { var d = s.patio ? s.patio.depth : 0; return PATIOS.filter(function (p) { return p.depth > d; })[0] || null; }
  /** How far the café's floor runs along x: its own size, and the patio beyond it. */
  function cafeW(s) { return s.size + (s.patio ? s.patio.depth : 0); }
  function inPatio(s, x, y) { return !!s.patio && x >= s.size && x < s.size + s.patio.depth && y >= 0 && y < s.size; }
  // (2026-11-08, Cam: "add the railings into the half wall category ... have them all located in the half wall menu")
  // the railings are half-wall styles too, bought once at the furniture store (the plain wood one free), each painted
  // part's material for its swatches (tools/make_cafe_fabric.py cut the same)
  var RAIL_MAT = { picket: "white", chain: "white", balustrade: "white", pastel: "blue", iron: "dark", spooky: "dark", ivyiron: "dark" };
  RAILS.forEach(function (r) {
    var x = { id: "rail_" + r.id, rail: r.id, name: r.name, level: r.level, price: r.price, mat: RAIL_MAT[r.id] || "wood", event: r.event, candy: r.candy };
    HALF_WALLS.push(x); HALF_WALL_OF[x.id] = x;
  });
  /** Move half walls by where their middles are (dx(mid), dy(mid)), then drop any that can't stand there now (their
      coins back). */
  function hwShift(s, dx, dy) {
    (s.hwalls || []).forEach(function (w) { var m = hwMid(w); w.x += dx(m); w.y += dy(m); });
    hwTidy(s);
  }
  function hwTidy(s) {
    var seen = {};
    s.hwalls = (s.hwalls || []).filter(function (w) {
      var k = hwKey(w.x, w.y, w.dir), ok = !seen[k] && !hwEdgeProblem(s, w);
      seen[k] = true;
      if (!ok) s.coins += HALF_WALL.seg;
      return ok;
    });
  }
  /** The patio's railings along its back (by the pavement), in the style of the last one there (or plain wood): it
      comes with them, and a deeper patio gets more. */
  function patioRails(s) {
    if (!s.patio) return;
    var have = hwSet(s), last = null, add = [];
    for (var i = 0; i < s.patio.depth; i++) {
      var h = have[hwKey(s.size + i, 0, 0)];
      if (h) last = h; else add.push(i);
    }
    var look = last ? { style: last.style, tint: last.tint, tint2: last.tint2 } : { style: "rail_wood" };
    s.hwalls = s.hwalls.concat(add.map(function (i) { return JSON.parse(JSON.stringify(Object.assign({ x: s.size + i, y: 0, dir: 0 }, look))); }));
  }
  /** The café a size bigger (or smaller, in the sandbox): the patio and everything on it moves out with its front edge. */
  /** (later, Cam: "when the cafe or patio expands, simply push all decorations on the edge of the cafe out by the space of
      the expansion so i dont need to redo any decorations around the outside") -- everything outside past the café's
      front edges moves out with them: past its width (x >= w) by dx, past its depth (y >= h) by dy; street things, the
      tiles laid outside, painted ground and plots alike, so a garden keeps its shape. (Behind the café is the street:
      nothing there moves but along it.) Kept inside where things can go. */
  function pushOut(s, w, h, dx, dy) {
    if (!(dx > 0 || dy > 0)) return;
    var hiR = REACH[1];
    var mx = function (x) { return x >= w ? Math.min(hiR, x + dx) : x; }, my = function (y) { return y >= h ? Math.min(hiR, y + dy) : y; };
    (s.decor || []).forEach(function (o) { var nx = mx(o.x), ny = my(o.y); o.x = Math.round(nx * 100) / 100; o.y = Math.round(ny * 100) / 100; });
    var fl = {};
    Object.keys(s.outFloors || {}).forEach(function (k) { var q = k.split(",").map(Number); fl[mx(q[0]) + "," + my(q[1])] = s.outFloors[k]; });
    s.outFloors = fl;
    (s.field || []).forEach(function (p) { p.x = mx(p.x); p.y = my(p.y); });
    s.terrain = (s.terrain || []).map(function (d) { return [d[0], mx(d[1]), my(d[2])].concat(d.slice(3)); });
  }
  function setSize(s, z) {
    var dz = z - s.size, old0 = s.size;
    if (dz > 0) pushOut(s, cafeW(s), s.size, dz, dz);
    if (s.patio && dz) {
      var old = s.size;
      s.items.forEach(function (it) { if (it.x >= old) it.x += dz; });
      var fl = {};
      Object.keys(s.floors || {}).forEach(function (k) { var q = k.split(",").map(Number); fl[(q[0] >= old ? q[0] + dz : q[0]) + "," + q[1]] = s.floors[k]; });
      s.floors = fl;
    }
    s.size = z;
    // half walls: those past the café's front edges (or on them, or on the patio) move out with them
    if (dz) hwShift(s, function (m) { return m.x >= old0 ? dz : 0; }, function (m) { return m.y >= old0 ? dz : 0; });
  }
  function nextExpand(s) { return EXPANSIONS.filter(function (e) { return e.size > s.size; })[0] || null; }
  var START = { coins: 150, size: 4, door: 2 };

  // customers: how often they come (a minute), how many at once, how fast they walk (tiles a second)
  // V21 q2 (Cam): customers come for variety, seats and looks -- a popularity score on top of the base, up to max
  // 2026-10-24 (Cam: "remove the cap of 15 per minute ... make the rules stricter for entertainment, decorations, food
  // types, food quality, comfort ... food under the counter doesnt count ... cap the minimum"): customers a minute =
  // base + each part, at least min while there's food out; each part rises to its own top along max * (1 - e^(-n/k)) --
  // the first few of anything count most, so nothing runs away and nothing needs a hard cap. Parts (max, k):
  //   variety: different dishes on the counters (beyond the first); stock: full counters (beyond the first);
  //   quality: the dishes out's mastery stars, on average; comfort: the seats, each by its comfort (COMFORT);
  //   decor: furniture that isn't a seat or table, things on the walls, ceiling lights; street: things outside;
  //   fun: the machines -- a second of the same kind counts half; plus the wallpaper, counter style and floors laid;
  //   light (after dark): lights that are on against the floor's size -- a dark café puts people off.
  var RATE = { base: 2, min: 3,
               variety: [4, 4], stock: [2, 6], quality: [2.5, 2.5], comfort: [3.5, 30], decor: [3, 12], street: [1.5, 10], fun: [3, 2],
               wall: 0.5, counters: 0.3, floors: 0.8,
               light: { per: 10, ceil: 1.5, best: 1, worst: -1.5 } }, WALK = 1.6;
  var COMFORT = { stool: 1, chair: 2, chair_bistro: 2, chair_garden: 2, armchair: 4, sofa: 3.5, cushion: 2, cushion_hw: 2, pouf: 2.5,
                  stool_hw: 1, stool_hwbat: 1, chair_web: 2, chair_skull: 2, armchair_hw: 4 };   // (Halloween's, N67)
  var soft = function (part, n) { return n > 0 ? part[0] * (1 - Math.exp(-n / part[1])) : 0; };
  /** How many customers can be in at once: more with more seats and machines. */
  function crowd(s) {
    var seatN = seats(s).reduce(function (n, ch) { return n + places(ch); }, 0);
    return Math.min(24, 6 + Math.floor(seatN / 2) + Math.min(6, machines(s).length));
  }
  // how many come at once: mostly one, often two, sometimes three (PT43); the gap between them (ms)
  var GROUPS = [[1, 0.55], [2, 0.3], [3, 0.15]], GROUP_GAP = 750;
  function groupSize(s) { var x = rnd(s), a = 0; for (var i = 0; i < GROUPS.length; i++) { a += GROUPS[i][1]; if (x < a) return GROUPS[i][0]; } return 1; }
  var LOOKS = ["woman", "oldman", "boy"];
  // V25 q7 (N56, Cam: "special characters ... a dracula, frankenstein, witch, scarecrow with pumpkin head ... Once purchased
  // they will start to visit the cafe during dusk and night. They will leave a few coins extra and not spawn as freely"):
  // unlocked with candy at the haunted house, yours for good; from 6 pm to 6 am each one you have is about 1 customer in
  // 15 (all four at most 1 in 5), all year round, and they leave GUEST.extra coins on top of what they pay
  var GUESTS = [{ id: "dracula", name: "Dracula", candy: 400 }, { id: "frank", name: "Frankenstein's monster", candy: 450 },
                { id: "witch", name: "The Witch", candy: 500 }, { id: "pumpkinhead", name: "Pumpkinhead", candy: 600 }];
  var GUEST = { from: 18, to: 6, each: 1 / 15, cap: 1 / 5, extra: 3 };
  var GUEST_OF = {}; GUESTS.forEach(function (g) { GUEST_OF[g.id] = g; });
  /** Who walks in at time t: one of your Halloween guests now and then after dark, else one of the café's regulars. */
  function pickLook(s, t) {
    var h = new Date(t).getHours();
    if (h >= GUEST.from || h < GUEST.to) {
      var mine = GUESTS.filter(function (g) { return (s.eventGot || []).indexOf(g.id) >= 0; });
      if (mine.length && rnd(s) < Math.min(GUEST.cap, GUEST.each * mine.length)) return mine[Math.floor(rnd(s) * mine.length)].id;
    }
    return LOOKS[Math.floor(rnd(s) * LOOKS.length)];
  }

  // ---- the street (2026-10-21): the café sits on a corner -- a pavement runs along the back of both walls (x -0.6 and
  // y -0.6), the sandstone road beyond. Customers walk in along the pavement from one end of the street and out to an end.
  var STREET = { walk: -0.6, far: 13 };
  // 2026-10-24 (Cam: "people sit outside and use the park benches. Some customers will walk over and take their take
  // away food there or even some people will just go about their day and sit down"): the places to sit outside -- a
  // park bench two, a picnic table four (two each side, facing it). A place: where they sit (x, y), where they step up to
  // it (ax, ay), which way they face (as a chair's sitting turns: 0 down-left, 1 down-right, 2 up-left, 3 up-right).
  // A bench's facing by its turn: -l faces down-left (+y), -r up-left (-x) (its back to us), and the two mirrored.
  var BENCH = { chance: 0.35, sit: 40 * 1000 };
  var BENCH_FACE = [[0, 1, 0], [-1, 0, 2], [1, 0, 1], [0, -1, 3]];      // [fx, fy, sitting turn] by the bench's turn
  function benchPlaces(s) {
    var out = [];
    (s.decor || []).forEach(function (o) {
      var d = (o.dir | 0) % 4, f = BENCH_FACE[d], ax = [Math.abs(f[1]), Math.abs(f[0])];          // its long way: across its facing
      if (o.id === "bench") [-0.2, 0.2].forEach(function (k, i) {
        out.push({ key: o.uid + ":" + i, uid: o.uid, kind: "bench", bx: o.x, by: o.y, x: o.x + ax[0] * k + f[0] * 0.08, y: o.y + ax[1] * k + f[1] * 0.08, ax: o.x + ax[0] * k + f[0] * 0.7, ay: o.y + ax[1] * k + f[1] * 0.7, face: f[2] });
      });
      if (o.id === "picnic") {                                              // its benches along its long way (y for -l, x for -r)
        var along = d % 2 ? [1, 0] : [0, 1], side = [along[1], along[0]];   // (-l runs along y: its benches either side of it in x)
        [-1, 1].forEach(function (sd) { [-0.22, 0.22].forEach(function (k, i) {
          var x = o.x + along[0] * k + side[0] * sd * 0.32, y = o.y + along[1] * k + side[1] * sd * 0.32;
          // facing the table: towards -side*sd
          var fx = -side[0] * sd, fy = -side[1] * sd, face = fy > 0 ? 0 : fx > 0 ? 1 : fx < 0 ? 2 : 3;
          out.push({ key: o.uid + ":" + (sd > 0 ? 2 : 0) + i, uid: o.uid, kind: "picnic", bx: o.x, by: o.y, x: x, y: y, ax: x - fx * 0.55, ay: y - fy * 0.55, face: face });
        }); });
      }
    });
    return out;
  }
  /** From a place outside (x, y) to the street: straight to the nearest pavement, then along it to the far end -- the
      x pavement for anywhere left of or in front of the café, the y one for behind its right wall. */
  function benchOut(s, x, y) {
    var w = STREET.walk, P = y < 0 && x >= 0 ? { x: x, y: w } : { x: w, y: Math.max(y, w) }, leg = outWalk(s, P, { x: x, y: y });
    if (!leg) return null;
    return leg.reverse().concat([y < 0 && x >= 0 ? { x: STREET.far, y: w } : { x: w, y: STREET.far }]);
  }
  /** From the door out to a place: along the pavement, then across to it (round what's in the way). Null: no way there. */
  function benchIn(s, x, y) {
    var w = STREET.walk, d = { x: w, y: s.door + 0.5 }, P = y < 0 && x >= 0 ? { x: x, y: w } : { x: w, y: Math.max(y, w) }, leg = outWalk(s, P, { x: x, y: y });
    if (!leg) return null;
    return (y < 0 && x >= 0 ? [d, { x: w, y: w }] : [d]).concat(leg);
  }
  // ---- walking outside (2026-10-25, Cam: "outside objects that are not tables to have collision with people ... fences
  // so the people cant walk through fences, haybales, flower planters, street lights, bike racks, trees. I am happy for
  // tables, archways, bushes to have the collision off"): the grass as a quarter-tile grid, blocked where a thing stands
  // (a fence along its tile edge, a building over its footprint, anything else within most of its room r) and over the
  // café; a walk goes round, then is pulled straight wherever it can see ahead. Walked through: tables and seats, arches,
  // bushes, and what's flat or low on the ground.
  var WALK_THROUGH = { bridge: 1, rosearch: 1, hw_patch: 1, picnic: 1, bench: 1, bush: 1, hw_spiderarch: 1, rock_slab: 1, rock_pebbles: 1, plant_grass: 1, plant_flowers: 1, plant_fern: 1, plant_mushrooms: 1 };
  var GRID = 4, walkCache = { key: "", paths: {} };
  function blocksWalk(id) { return !!DECO[id] && !WALK_THROUGH[id]; }
  // (Cam, 25 Oct: "make the characters walk around the water"): painted lake and deep water is walked round, all but
  // the soft edge of each dab -- and a garden bridge over it is the way across
  function waterDabs(s) { return (s.terrain || []).filter(function (d) { return TERRAIN[d[0]] && TERRAIN[d[0]].water; }); }
  function bridged(s, x, y) { return (s.decor || []).some(function (o) { return o.id === "bridge" && Math.hypot(x - o.x, y - o.y) < DECO.bridge.r * growOf(o) + 0.15; }); }
  /** Whether the spot (x, y) outside is blocked (things only; the café is checked by the walk). */
  /** The half walls outside the café (or on its edge), as fence pieces for the walks: {x, y} the middle, dir 0 along x. */
  function hwFences(s) {
    return (s.hwalls || []).filter(function (w) { var sd = hwSides(w); return !(inside(s, sd[0].x, sd[0].y) && inside(s, sd[1].x, sd[1].y)); })
      .map(function (w) { var m = hwMid(w); return { x: m.x, y: m.y, dir: w.dir }; });
  }
  function walkBlocked(s, x, y) {
    if (x > -0.05 && y > -0.05 && x < cafeW(s) + 0.05 && y < s.size + 0.05) return true;
    if (hwFences(s).some(function (o) { var al = o.dir === 0; return al ? Math.abs(y - o.y) < 0.2 && Math.abs(x - o.x) < 0.58 : Math.abs(x - o.x) < 0.2 && Math.abs(y - o.y) < 0.58; })) return true;
    if (waterDabs(s).some(function (d) { return Math.hypot(x - d[1], y - d[2]) < d[3] * 0.85; }) && !bridged(s, x, y)) return true;
    return (s.decor || []).some(function (o) {
      if (!blocksWalk(o.id)) return false;
      var d = DECO[o.id];
      if (d.fence) {                                         // (along a tile edge: dir 0/2 runs along x at y, 1/3 along y at x)
        var along = (o.dir | 0) % 2 === 0, a = along ? x : y, b = along ? y : x, a0 = along ? o.x - 0.5 : o.y - 0.5, b0 = along ? o.y : o.x;
        return Math.abs(b - b0) < 0.2 && a > a0 - 0.08 && a < a0 + 1.08;
      }
      if (FOOT[o.id]) { var F = footOf(o.id, o.x, o.y, o.dir); return x > F.x0 && x < F.x1 && y > F.y0 && y < F.y1; }
      return Math.hypot(x - o.x, y - o.y) < d.r * growOf(o) + 0.1;
    });
  }
  /** The grass as a grid (made once for each layout of what's outside): 1 where a walk can't go. */
  function walkGrid(s, key) {
    var lo = REACH[0] - 2, n = (REACH[1] - REACH[0] + 4) * GRID, g = new Uint8Array(n * n);
    var mark = function (x0, x1, y0, y1, test) {
      var i0 = Math.max(0, Math.floor((x0 - lo) * GRID)), i1 = Math.min(n - 1, Math.ceil((x1 - lo) * GRID)), j0 = Math.max(0, Math.floor((y0 - lo) * GRID)), j1 = Math.min(n - 1, Math.ceil((y1 - lo) * GRID));
      for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) { var x = lo + (i + 0.5) / GRID, y = lo + (j + 0.5) / GRID; if (test(x, y)) g[j * n + i] = 1; }
    };
    mark(-0.05, cafeW(s) + 0.05, -0.05, s.size + 0.05, function (x, y) { return x > -0.05 && y > -0.05 && x < cafeW(s) + 0.05 && y < s.size + 0.05; });
    (s.decor || []).forEach(function (o) {
      if (!blocksWalk(o.id)) return;
      var d = DECO[o.id];
      if (d.fence) {
        var al = (o.dir | 0) % 2 === 0;
        return al ? mark(o.x - 0.6, o.x + 0.6, o.y - 0.25, o.y + 0.25, function (x, y) { return Math.abs(y - o.y) < 0.2 && Math.abs(x - o.x) < 0.58; })
          : mark(o.x - 0.25, o.x + 0.25, o.y - 0.6, o.y + 0.6, function (x, y) { return Math.abs(x - o.x) < 0.2 && Math.abs(y - o.y) < 0.58; });
      }
      if (FOOT[o.id]) { var F = footOf(o.id, o.x, o.y, o.dir); return mark(F.x0, F.x1, F.y0, F.y1, function (x, y) { return x > F.x0 && x < F.x1 && y > F.y0 && y < F.y1; }); }
      var r = d.r * growOf(o) + 0.1;                        // (its room, and half a person's width)
      mark(o.x - r, o.x + r, o.y - r, o.y + r, function (x, y) { return Math.hypot(x - o.x, y - o.y) < r; });
    });
    hwFences(s).forEach(function (o) {
      return o.dir === 0 ? mark(o.x - 0.6, o.x + 0.6, o.y - 0.25, o.y + 0.25, function (x, y) { return Math.abs(y - o.y) < 0.2 && Math.abs(x - o.x) < 0.58; })
        : mark(o.x - 0.25, o.x + 0.25, o.y - 0.6, o.y + 0.6, function (x, y) { return Math.abs(x - o.x) < 0.2 && Math.abs(y - o.y) < 0.58; });
    });
    waterDabs(s).forEach(function (d) {
      var r = d[3] * 0.85;
      mark(d[1] - r, d[1] + r, d[2] - r, d[2] + r, function (x, y) { return Math.hypot(x - d[1], y - d[2]) < r && !bridged(s, x, y); });
    });
    return { lo: lo, n: n, g: g };
  }
  /** A walk across the grass from a to b round what's in the way: points in tiles, or null when there's no way. */
  function walkKey(s) { return s.size + "," + cafeW(s) + "|" + (s.decor || []).filter(function (o) { return blocksWalk(o.id) || o.id === "bridge"; }).map(function (o) { return o.id + o.x + "," + o.y + "," + (o.dir | 0) + "," + (o.scale | 0); }).join(";")
    + "|" + waterDabs(s).map(function (d) { return d[1] + "," + d[2] + "," + d[3]; }).join(";") + "|" + hwFences(s).map(function (o) { return o.x + "," + o.y + "," + o.dir; }).join(";"); }
  function walkNow(s) { var key = walkKey(s); if (walkCache.key !== key) walkCache = { key: key, paths: {}, grid: walkGrid(s) }; return walkCache; }
  /** 2026-10-25 (Cam: "the people will need collision with the houses so they dont walk through them"): a walk along the
      street's fixed lines, each straight leg kept where nothing's in the way and taken round what is (a house set on the
      pavement with free placement, a fence across it). A leg with no way round is left as it was. */
  function streetPath(s, pts) {
    var G = walkNow(s).grid, out = [pts[0]];
    var blocked = function (x, y) { var i = Math.floor((x - G.lo) * GRID), j = Math.floor((y - G.lo) * GRID); return i >= 0 && j >= 0 && i < G.n && j < G.n && !!G.g[j * G.n + i]; };
    for (var k = 1; k < pts.length; k++) {
      var p = pts[k - 1], q = pts[k], n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) * GRID * 2), hit = false;
      for (var z = 1; z < n && !hit; z++) hit = blocked(p.x + (q.x - p.x) * z / n, p.y + (q.y - p.y) * z / n);
      var round = hit && outWalk(s, p, q);
      if (round) out = out.concat(round.slice(1)); else out.push(q);
    }
    return out;
  }
  function outWalk(s, a, b) {
    walkNow(s);
    var pk = [a.x, a.y, b.x, b.y].join(",");
    if (pk in walkCache.paths) { var hit = walkCache.paths[pk]; return hit && hit.map(function (q) { return { x: q.x, y: q.y }; }); }
    var G = walkCache.grid, lo = G.lo, W = G.n;
    var cell = function (p) { return { i: Math.floor((p.x - lo) * GRID), j: Math.floor((p.y - lo) * GRID) }; };
    var mid = function (i, j) { return { x: lo + (i + 0.5) / GRID, y: lo + (j + 0.5) / GRID }; };
    var A = cell(a), B = cell(b), freed = {};
    var inCafe = function (q) { return q.x > -0.05 && q.y > -0.05 && q.x < cafeW(s) + 0.05 && q.y < s.size + 0.05; };
    // (where they start and where they're going are open: a bench's seat, a door at a footprint's edge)
    [A, B].forEach(function (c, n) { var e = n ? b : a; for (var dj = -2; dj <= 2; dj++) for (var di = -2; di <= 2; di++) { var q = mid(c.i + di, c.j + dj); if (Math.hypot(q.x - e.x, q.y - e.y) < 0.4 && !inCafe(q)) freed[(c.j + dj) * W + c.i + di] = 1; } });
    var open = function (i, j) { if (i < 0 || j < 0 || i >= W || j >= W) return false; var k = j * W + i; return !G.g[k] || !!freed[k]; };
    var res = null;
    if (open(A.i, A.j) && open(B.i, B.j)) {
      var dist = {}, from = {}, heap = [], start = A.j * W + A.i, goal = B.j * W + B.i, D = function (k) { return k in dist ? dist[k] : Infinity; };
      var push = function (k, f) { heap.push([f, k]); var n = heap.length - 1; while (n > 0) { var p2 = (n - 1) >> 1; if (heap[p2][0] <= heap[n][0]) break; var t2 = heap[p2]; heap[p2] = heap[n]; heap[n] = t2; n = p2; } };
      var pop = function () { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var n = 0; for (;;) { var l = 2 * n + 1, r = l + 1, m2 = n; if (l < heap.length && heap[l][0] < heap[m2][0]) m2 = l; if (r < heap.length && heap[r][0] < heap[m2][0]) m2 = r; if (m2 === n) break; var t3 = heap[m2]; heap[m2] = heap[n]; heap[n] = t3; n = m2; } } return top; };
      var hEst = function (k) { return Math.hypot(k % W - B.i, Math.floor(k / W) - B.j); };
      dist[start] = 0; push(start, hEst(start));
      var steps = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]], seen = 0;
      while (heap.length && seen++ < 60000) {
        var top = pop(), k = top[1];
        if (k === goal) break;
        if (top[0] - hEst(k) > D(k) + 1e-9) continue;
        var ci = k % W, cj = Math.floor(k / W);
        for (var n2 = 0; n2 < 8; n2++) {
          var st = steps[n2], ni = ci + st[0], nj = cj + st[1];
          if (!open(ni, nj) || (st[0] && st[1] && (!open(ci + st[0], cj) || !open(ci, cj + st[1])))) continue;   // (no cutting a corner)
          var nk = nj * W + ni, nd = D(k) + st[2];
          if (nd < D(nk)) { dist[nk] = nd; from[nk] = k; push(nk, nd + hEst(nk)); }
        }
      }
      if (D(goal) < Infinity) {
        var cells = [];
        for (var c2 = goal; c2 !== undefined; c2 = from[c2]) cells.unshift(mid(c2 % W, Math.floor(c2 / W)));
        cells[0] = { x: a.x, y: a.y }; cells[cells.length - 1] = { x: b.x, y: b.y };
        // pulled straight: from each point, on to the furthest one it can walk to in a line
        var clear = function (p, q) { var n3 = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) * GRID * 2); for (var z = 1; z < n3; z++) { var u = z / n3, c3 = cell({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u }); if (!open(c3.i, c3.j)) return false; } return true; };
        res = [cells[0]];
        for (var at2 = 0; at2 < cells.length - 1;) { var far = cells.length - 1; while (far > at2 + 1 && !clear(cells[at2], cells[far])) far--; res.push(cells[far]); at2 = far; }
        res = res.map(function (q) { return { x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100 }; });
      }
    }
    walkCache.paths[pk] = res;
    return res && res.map(function (q) { return { x: q.x, y: q.y }; });
  }

  function streetRoute(s, end) {
    var w = STREET.walk, d = { x: w, y: s.door + 0.5 };
    return streetPath(s, end ? [{ x: STREET.far, y: w }, { x: w, y: w }, d] : [{ x: w, y: STREET.far }, d]);
  }
  // ---- street things (2026-10-21, Cam: "I need to place them myself"): bought, placed anywhere off the roads and the
  // walking lines, turned, stored, sold back for half; more open with levels. r is how much room each needs (tiles).
  var DECOR = [
    { id: "planter", name: "Flower planter", level: 1, price: 40, r: 0.3 },
    { id: "bin", name: "Street bin", level: 1, price: 30, r: 0.2 },
    { id: "bollard", name: "Bollard", level: 1, price: 20, r: 0.15 },
    { id: "lamp", name: "Street lamp", level: 2, price: 120, r: 0.2 },
    { id: "bench", name: "Park bench", level: 2, price: 80, r: 0.35 },
    { id: "aframe", name: "Menu board", level: 2, price: 60, r: 0.25 },
    { id: "bush", name: "Round bush", level: 3, price: 50, r: 0.35, grow: true },
    { id: "flowerbed", name: "Flower bed", level: 3, price: 60, r: 0.35 },
    { id: "hedge", name: "Hedge", level: 4, price: 70, r: 0.35, grow: true },
    { id: "tree2", name: "Silver birch", level: 4, price: 150, r: 0.45 },
    { id: "bikerack", name: "Bike rack", level: 5, price: 90, r: 0.35 },
    { id: "postbox", name: "Post box", level: 5, price: 100, r: 0.2 },
    { id: "tree", name: "Oak tree", level: 6, price: 200, r: 0.6 },
    { id: "picnic", name: "Picnic table", level: 7, price: 160, r: 0.45 },
    { id: "fence", name: "Picket fence", level: 8, price: 40, r: 0.3, fence: true },
    { id: "sign", name: "Café sign", level: 9, price: 180, r: 0.25 },
    // 2026-10-22: keepsakes from NeuroVale -- never sold in the shop; now and then a guild hall tutor leaves one when
    // they collect a request cart's order (NeuroPets' own pictures). `price` is only what one sells back for, halved.
    // 2026-10-22 (Cam: "the fence around the plots, windmills etc."): things for the farm, sold on Buy's Farm tab
    // (NeuroPets' pictures)
    { id: "farm_fence", name: "Paddock fence", level: 3, price: 40, r: 0.3, farm: true, fence: true },
    { id: "farm_can", name: "Watering can", level: 3, price: 30, r: 0.2, farm: true },
    { id: "farm_hay", name: "Hay bale", level: 4, price: 60, r: 0.3, farm: true },
    { id: "farm_compost", name: "Compost heap", level: 5, price: 90, r: 0.3, farm: true },
    { id: "farm_cart", name: "Produce cart", level: 7, price: 220, r: 0.4, farm: true },
    { id: "farm_windmill", name: "Windmill", level: 9, price: 900, r: 0.45, farm: true },
    { id: "farm_glass", name: "Greenhouse", level: 12, price: 1500, r: 0.55, farm: true },
    { id: "farm_barn", name: "Barn", level: 15, price: 2500, r: 0.7, farm: true },
    { id: "farm_coop", name: "Chicken coop", level: 3, price: 400, r: 0.5, farm: true, coop: true },
    // 2026-10-24: the furniture store -- a building on your street that sells paints and the paint mixer (sandbox only)
    // (Cam, 24 October: buildings go in the Build menu, and it's twice the price -- it'll house every style for sale)
    { id: "furnstore", name: "Furniture store", level: 6, price: 3000, r: 0.85, store: true, building: true },
    // Cam 2026-10-24: the haunted house -- built only in October; spend candy there (Oct 1 - Nov 10) to unlock
    // Halloween's things for good (EVENT). It stays on your street all year, closed till next October.
    { id: "mansion", name: "Haunted house", level: 3, price: 2500, r: 0.95, building: true, mansion: true, house: "halloween" },
    // Sheet 25 (2026-10-24, Cam: "implement the houses into the game"): the other events' houses -- built while their
    // event is on (any time in the sandbox), one each; clicked, each opens the Events book at its event's page
    { id: "santa", name: "Santa's house", level: 3, price: 2500, r: 0.85, building: true, house: "christmas" },
    { id: "warren", name: "Rabbit warren", level: 3, price: 2500, r: 0.85, building: true, house: "easter" },
    { id: "longhouse", name: "Norse longhouse", level: 3, price: 2500, r: 0.9, building: true, house: "midsummer" },
    // N47: Halloween's street things -- unlocked with candy, then in Outside like the rest
    { id: "hw_pumpkins", name: "Jack-o'-lantern pile", level: 1, price: 80, r: 0.35, event: "halloween", candy: 20 },
    { id: "hw_haybale", name: "Hay bale and pumpkin", level: 1, price: 70, r: 0.35, event: "halloween", candy: 20 },
    { id: "hw_lantern", name: "Purple lantern", level: 1, price: 140, r: 0.2, event: "halloween", candy: 25 },
    { id: "hw_crow", name: "Raven fence", level: 1, price: 50, r: 0.3, event: "halloween", candy: 25, fence: true },
    { id: "hw_witchsign", name: "Witch's sign", level: 1, price: 120, r: 0.25, event: "halloween", candy: 30 },
    { id: "hw_graves", name: "Gravestones", level: 1, price: 150, r: 0.45, event: "halloween", candy: 30 },
    { id: "hw_cauldron", name: "Bubbling cauldron", level: 1, price: 160, r: 0.3, event: "halloween", candy: 35 },
    { id: "hw_scarecrow", name: "Scarecrow", level: 1, price: 160, r: 0.3, event: "halloween", candy: 35 },
    { id: "hw_coffin", name: "Open coffin", level: 1, price: 180, r: 0.4, event: "halloween", candy: 40 },
    { id: "hw_spiderarch", name: "Cobweb arch", level: 1, price: 220, r: 0.4, event: "halloween", candy: 45 },
    { id: "hw_ghost", name: "Friendly ghost", level: 1, price: 200, r: 0.3, event: "halloween", candy: 45 },
    { id: "hw_deadtree", name: "Spooky tree", level: 1, price: 260, r: 0.55, event: "halloween", candy: 55 },
    // V25 q6 (N56, N58 "Halloween - Town 2"): more for the town -- candy, then coins
    { id: "hw_webtree", name: "Cobweb tree", level: 1, price: 280, r: 0.55, event: "halloween", candy: 60 },
    { id: "hw_weblamp", name: "Cobwebbed lamp post", level: 1, price: 180, r: 0.2, event: "halloween", candy: 40 },
    { id: "hw_bigweb", name: "Giant spider web", level: 1, price: 200, r: 0.4, event: "halloween", candy: 45 },
    { id: "hw_broom", name: "Witch's broom and stump", level: 1, price: 90, r: 0.3, event: "halloween", candy: 20 },
    { id: "hw_turnips", name: "Turnip lanterns", level: 1, price: 80, r: 0.3, event: "halloween", candy: 20 },
    { id: "hw_deckchair", name: "Skeleton in a deckchair", level: 1, price: 160, r: 0.4, event: "halloween", candy: 35 },
    { id: "hw_skulls", name: "Skulls and candles", level: 1, price: 120, r: 0.3, event: "halloween", candy: 30 },
    { id: "hw_mummy", name: "Mummy in a coffin", level: 1, price: 200, r: 0.35, event: "halloween", candy: 45 },
    { id: "hw_gargoyle", name: "Gargoyle", level: 1, price: 220, r: 0.3, event: "halloween", candy: 50 },
    { id: "hw_postbox", name: "Haunted post box", level: 1, price: 120, r: 0.25, event: "halloween", candy: 30 },
    { id: "hw_sweets", name: "Trick-or-treat cauldron", level: 1, price: 140, r: 0.3, event: "halloween", candy: 30 },
    { id: "hw_patch", name: "Pumpkin patch", level: 1, price: 100, r: 0.45, event: "halloween", candy: 25 },
    { id: "hw_barrow", name: "Wheelbarrow of pumpkins", level: 1, price: 130, r: 0.4, event: "halloween", candy: 30 },
    { id: "hw_crowpost", name: "Crow on a post", level: 1, price: 70, r: 0.2, event: "halloween", candy: 20 },
    { id: "hw_rocker", name: "Rocking chair and doll", level: 1, price: 180, r: 0.35, event: "halloween", candy: 40 },
    { id: "hw_fog", name: "Fog machine", level: 1, price: 240, r: 0.3, event: "halloween", candy: 50 },
    // 2026-10-24 (Cam: "rocks of all shapes and sizes as well, plus some dead trees and other types of trees ... layer
    // on garden design"): the garden -- stand-in pictures from tools/make_cafe_nature.py till they're painted
    { id: "rock_pebbles", name: "Pebbles", level: 1, price: 10, r: 0.15, nature: "rocks" },
    { id: "rock_small", name: "Small rock", level: 1, price: 15, r: 0.15, nature: "rocks" },
    { id: "rock_flat", name: "Flat stone", level: 2, price: 20, r: 0.25, nature: "rocks" },
    { id: "rock_round", name: "Round rock", level: 2, price: 30, r: 0.25, nature: "rocks" },
    { id: "rock_mossy", name: "Mossy rock", level: 3, price: 45, r: 0.3, nature: "rocks" },
    { id: "rock_pile", name: "Rock pile", level: 3, price: 50, r: 0.35, nature: "rocks" },
    { id: "rock_tall", name: "Standing stone", level: 5, price: 80, r: 0.25, nature: "rocks" },
    { id: "rock_boulder", name: "Boulder", level: 6, price: 120, r: 0.5, nature: "rocks" },
    { id: "rock_slab", name: "Stepping stone", level: 2, price: 15, r: 0.2, nature: "rocks", flat: true },
    { id: "tree_stump", name: "Tree stump", level: 2, price: 40, r: 0.25, nature: "trees" },
    { id: "tree_log", name: "Fallen log", level: 3, price: 50, r: 0.4, nature: "trees" },
    { id: "tree_dead", name: "Dead tree", level: 4, price: 90, r: 0.35, nature: "trees" },
    { id: "tree_dead2", name: "Gnarled dead tree", level: 6, price: 110, r: 0.4, nature: "trees" },
    { id: "tree_pine", name: "Pine tree", level: 5, price: 160, r: 0.45, nature: "trees" },
    { id: "tree_apple", name: "Apple tree", level: 8, price: 220, r: 0.5, nature: "trees" },
    { id: "tree_cherry", name: "Cherry blossom", level: 10, price: 280, r: 0.5, nature: "trees" },
    { id: "tree_maple", name: "Autumn maple", level: 12, price: 260, r: 0.5, nature: "trees" },
    { id: "tree_willow", name: "Weeping willow", level: 15, price: 340, r: 0.6, nature: "trees" },
    { id: "tree_cypress", name: "Cypress", level: 9, price: 180, r: 0.3, nature: "trees" },
    { id: "plant_fern", name: "Wild ferns", level: 2, price: 25, r: 0.25, nature: "plants", grow: true },
    { id: "plant_grass", name: "Tall grass", level: 1, price: 15, r: 0.2, nature: "plants", grow: true },
    { id: "plant_flowers", name: "Wildflowers", level: 2, price: 25, r: 0.25, nature: "plants", grow: true },
    { id: "plant_lavender", name: "Lavender", level: 4, price: 35, r: 0.25, nature: "plants", grow: true },
    { id: "plant_mushrooms", name: "Mushrooms", level: 3, price: 20, r: 0.15, nature: "plants", grow: true },
    // V26 q8 (N62 Sheet 47): ponds and garden features -- each counts towards the street's looks; all come in sizes;
    // the ponds lie flat (people walk round them)
    { id: "pond_small", name: "Small pond", level: 4, price: 150, r: 0.45, nature: "garden", grow: true, flat: true },
    { id: "pond_lily", name: "Lily pond", level: 7, price: 350, r: 0.55, nature: "garden", grow: true, flat: true },
    { id: "pond_big", name: "Big pond", level: 10, price: 600, r: 0.65, nature: "garden", grow: true, flat: true },
    { id: "pond_koi", name: "Koi pond", level: 14, price: 900, r: 0.6, nature: "garden", grow: true, flat: true },
    { id: "gnome", name: "Garden gnome", level: 2, price: 40, r: 0.15, nature: "garden", grow: true },
    { id: "birdbath", name: "Bird bath", level: 3, price: 90, r: 0.25, nature: "garden", grow: true },
    { id: "birdhouse", name: "Bird house", level: 4, price: 80, r: 0.15, nature: "garden", grow: true },
    { id: "sundial", name: "Sundial", level: 5, price: 120, r: 0.2, nature: "garden", grow: true },
    { id: "bridge", name: "Garden bridge", level: 6, price: 250, r: 0.4, nature: "garden", grow: true },
    { id: "stonelantern", name: "Stone lantern", level: 6, price: 150, r: 0.2, nature: "garden", grow: true },
    { id: "rosearch", name: "Rose arch", level: 7, price: 300, r: 0.35, nature: "garden", grow: true },
    { id: "fountain", name: "Fountain", level: 8, price: 500, r: 0.4, nature: "garden", grow: true },
    { id: "well", name: "Wishing well", level: 9, price: 600, r: 0.4, nature: "garden", grow: true },
    { id: "statue", name: "Angel statue", level: 11, price: 450, r: 0.25, nature: "garden", grow: true },
    { id: "pergola", name: "Pergola", level: 12, price: 800, r: 0.6, nature: "garden", grow: true },
    { id: "gazebo", name: "Gazebo", level: 15, price: 1200, r: 0.7, nature: "garden", grow: true },
    // V26 q2/q3 (Sheet 45): the stalls -- carts that sell on their own (CARTS) and the outdoor cinema (CINEMA); one of
    // each, one more every 15 levels past its own
    { id: "coffeecart", name: "Coffee cart", level: 10, price: 3000, r: 0.4, nature: "stalls", stall: true },
    { id: "icecart", name: "Ice cream cart", level: 14, price: 4500, r: 0.4, nature: "stalls", stall: true },
    { id: "popcart", name: "Popcorn cart", level: 16, price: 2500, r: 0.35, nature: "stalls", stall: true },
    { id: "cinema", name: "Outdoor cinema", level: 28, price: 12000, r: 0.7, nature: "stalls", stall: true },
    // (Cam: "more buildings that can be placed to create literal streets ... a house could get an icon on it for a
    // delivery request") -- homes for the street; each asks for food to be delivered (HOME)
    { id: "home_cottage", name: "Cottage", level: 4, price: 1200, r: 0.8, building: true, home: true },
    { id: "home_bungalow", name: "Bungalow", level: 6, price: 1500, r: 0.85, building: true, home: true },
    { id: "home_terrace", name: "Terraced house", level: 8, price: 1800, r: 0.7, building: true, home: true },
    { id: "home_townhouse", name: "Townhouse", level: 12, price: 2400, r: 0.8, building: true, home: true },
    { id: "home_farmhouse", name: "Stone farmhouse", level: 16, price: 3000, r: 0.9, building: true, home: true },
    { id: "home_shopfront", name: "Corner shop", level: 20, price: 3600, r: 0.85, building: true, home: true },
    { id: "vale_chest", name: "Pip's \"found\" chest", level: 1, price: 600, r: 0.35, vale: true },
    { id: "vale_dummy", name: "Wren's training dummy", level: 1, price: 600, r: 0.3, vale: true },
    { id: "vale_anvil", name: "Brakka's anvil", level: 1, price: 600, r: 0.3, vale: true },
    { id: "vale_wispjar", name: "Ilse's wisp jar", level: 1, price: 600, r: 0.2, vale: true },
    { id: "vale_grindstone", name: "Brother Aldo's grindstone", level: 1, price: 600, r: 0.35, vale: true },
    { id: "vale_hives", name: "Tamsin's beehive", level: 1, price: 600, r: 0.35, vale: true },
    { id: "vale_pond", name: "Tamsin's duck pond", level: 1, price: 800, r: 0.6, vale: true }
  ];
  var DECO = {};
  DECOR.forEach(function (d) { DECO[d.id] = d; });
  var STARTER_DECOR = { lamp: 2, planter: 1, bin: 1, aframe: 1 };
  // ---- events (Cam, 2026-10-24): Halloween. From 10 October to 31 October (Cam, 2026-11-01) candy is a second currency: one for every
  // dish served, and now and then a few left on a table by someone getting up. You spend it at the haunted house (a
  // building you can only put up while it's on) to unlock Halloween's things -- dishes, decorations, paintings,
  // wallpapers, coin games, street things -- which are yours for good: bought for coins any time after, in Buy >
  // Events > Halloween (wallpapers in Build > Walls, street things in Outside). When it ends, candy left over is turned into Halloween dishes for your counters (2026-11-01).
  // In the sandbox the dev tools can switch the event on or off (s.dev.event) to try it any time.
  var EVENT = { id: "halloween", name: "Halloween", serve: 1, tipChance: 0.3, tip: [1, 3], until: "31 October" };   // (PT56, Cam: tips of 1-3, not 3-6)
  var EVENT_ITEMS = [].concat(
    DISHES.filter(function (d) { return d.event; }).map(function (d) { return { id: d.id, kind: "dish", name: d.name, candy: d.candy, pic: "dish-" + d.id }; }),
    Object.keys(THINGS).filter(function (k) { return THINGS[k].event; }).map(function (k) { return { id: k, kind: THINGS[k].machine ? "machine" : "thing", name: THINGS[k].name, candy: THINGS[k].candy, pic: THINGS[k].turns ? k + "-l" : k }; }),
    HW_PAINTINGS.concat(HW_HANG).map(function (p) { return { id: p.id, kind: "painting", name: p.name, candy: p.candy, pic: p.pic }; }),
    WALLPAPERS.filter(function (w) { return w.event; }).map(function (w) { return { id: w.id, kind: "wall", name: w.name + " wallpaper", candy: w.candy, pic: "wall-" + w.id + "-l" }; }),
    GUESTS.map(function (g) { return { id: g.id, kind: "guest", name: g.name, candy: g.candy, pic: g.id + "-tl" }; }),
    RAILS.filter(function (r) { return r.event; }).map(function (r) { return { id: r.id, kind: "rail", name: r.name, candy: r.candy, pic: "prop-rail_" + r.id + "-l" }; }),
    DECOR.filter(function (d) { return d.event; }).map(function (d) { return { id: d.id, kind: "street", name: d.name, candy: d.candy, pic: "prop-" + d.id }; }));
  var EVENT_ITEM = {};
  EVENT_ITEMS.forEach(function (x) { EVENT_ITEM[x.id] = x; });
  function devEvent(s) { return s.sandbox && s.dev && s.dev.event; }
  // PT56 (Cam: "broken into the events: Easter, Halloween, Christmas, Thanks Giving, Midsummer, Ramadan, Chinese New
  // Year, New Years Eve"): the year's events, in calendar order, each with when it runs (local time). Halloween is the
  // one with things so far; the rest show in the events book as coming. Chinese New Year and Ramadan follow the moon:
  // their days come from a table (Ramadan's by the expected sighting, so a day either way).
  var LUNAR_NY = ["2026-02-17", "2027-02-06", "2028-01-26", "2029-02-13", "2030-02-03", "2031-01-23", "2032-02-11", "2033-01-31", "2034-02-19", "2035-02-08"];
  var RAMADAN = ["2026-02-18", "2027-02-08", "2028-01-28", "2029-01-16", "2030-01-06", "2030-12-26", "2031-12-15", "2032-12-04", "2033-11-23", "2034-11-12", "2035-11-01"];
  function easter(y) {                                        // (the Gregorian computus)
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var n = h + l - 7 * m + 114;
    return new Date(y, Math.floor(n / 31) - 1, (n % 31) + 1);
  }
  var calDay = function (y, m, d) { return new Date(y, m, d); }, plus = function (dt, n) { return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n); };
  var fromISO = function (x) { var p = x.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var CALENDAR = [
    { id: "lunarnewyear", name: "Chinese New Year", icon: "🧧", says: "Lanterns, dumplings and red envelopes, to the Lantern Festival.",
      runs: function () { return LUNAR_NY.map(function (x) { var d = fromISO(x); return [plus(d, -7), plus(d, 15)]; }); } },
    { id: "ramadan", name: "Ramadan", icon: "🌙", says: "Iftar after sunset through the month, and Eid at its end.",
      runs: function () { return RAMADAN.map(function (x) { var d = fromISO(x); return [d, plus(d, 32)]; }); } },
    { id: "easter", name: "Easter", icon: "🐣", says: "Eggs, bunnies and hot cross buns.", runs: function (y) { return [y - 1, y, y + 1].map(function (z) { var e = easter(z); return [plus(e, -14), plus(e, 7)]; }); } },
    { id: "midsummer", name: "Midsummer", icon: "☀️", says: "The longest days: flowers, bonfires and long evenings.", runs: function (y) { return [y - 1, y, y + 1].map(function (z) { return [calDay(z, 5, 14), calDay(z, 5, 28)]; }); } },
    { id: "halloween", name: "Halloween", icon: "🎃", says: "Candy for every dish, and the haunted house's things to unlock with it.", ready: true,
      runs: function (y) { return [y - 1, y, y + 1].map(function (z) { return [calDay(z, 9, 10), calDay(z, 9, 31)]; }); } },
    { id: "thanksgiving", name: "Thanksgiving", icon: "🦃", says: "A harvest table: roast turkey, pies and plenty.",
      runs: function (y) { return [y - 1, y, y + 1].map(function (z) { var n1 = calDay(z, 10, 1), th = plus(n1, (11 - n1.getDay()) % 7 + 21); return [calDay(z, 10, 11), plus(th, 3)]; }); } },
    { id: "christmas", name: "Christmas", icon: "🎄", says: "Trees, lights, mince pies and something warm to drink.", runs: function (y) { return [y - 1, y, y + 1].map(function (z) { return [calDay(z, 11, 1), calDay(z, 11, 26)]; }); } },
    { id: "newyearseve", name: "New Year's Eve", icon: "🎆", says: "Fireworks at midnight and a toast to the year.", runs: function (y) { return [y - 1, y, y + 1].map(function (z) { return [calDay(z, 11, 27), calDay(z + 1, 0, 2)]; }); } }];
  /** Each event: on now, or when it next runs ({from, to} as times; the last day runs to its midnight). */
  function calendar(s, now) {
    var y = new Date(now).getFullYear();
    return CALENDAR.map(function (ev) {
      var runs = ev.runs(y).map(function (r) { return [r[0].getTime(), plus(r[1], 1).getTime() - 1]; }).sort(function (a, b) { return a[0] - b[0]; });
      var cur = runs.filter(function (r) { return r[0] <= now && now <= r[1]; })[0], next = runs.filter(function (r) { return r[0] > now; })[0];
      var on = ev.id === EVENT.id ? eventOn(s, now) : !!cur, at = cur || next || null;
      return { id: ev.id, name: ev.name, icon: ev.icon, says: ev.says, ready: !!ev.ready, on: on, from: at ? at[0] : null, to: at ? at[1] : null };
    });
  }

  /** Candy can be earned and spent: 10 to 31 October (local time; Cam, 2026-11-01). */
  function eventOn(s, now) { var f = devEvent(s); if (f) return f === "on"; var d = new Date(now); return d.getMonth() === 9 && d.getDate() >= 10; }
  /** The haunted house can be put up: while the event is on, 10 to 31 October. */
  function mansionTime(s, now) { return eventOn(s, now); }
  // (Cam, 2026-11-01: "When halloween event ends, a pop up appears with the tarot reader ... the game then removes the
  // candy from the game and transfers your candy into that amount of serves of halloween themed food on your counters.
  // So think 50 of one dish 300 of another etc."): the first tick after Halloween with candy left, every candy becomes a
  // serving of a Halloween dish -- the ones you unlocked (else all eight), the candy split between them in uneven lots --
  // which wait in the bag and go out onto your counters as they have room (like Aunty's food). The candy's gone; the
  // farewell (s.feast) shows once.
  var HW_DISHES = DISHES.filter(function (d) { return d.event === EVENT.id; }).map(function (d) { return d.id; });
  function feastSplit(n, ids, rng) {
    ids = ids.slice();
    for (var i = ids.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
    ids = ids.slice(0, Math.max(1, Math.min(ids.length, Math.floor(n / 10))));
    var w = ids.map(function () { return 0.2 + rng(); }), W = w.reduce(function (a, b) { return a + b; }, 0), step = n >= 200 * ids.length ? 10 : 1;
    var out = ids.map(function (id, k) { return { dish: id, n: Math.floor(n * w[k] / W / step) * step }; });
    var left = n - out.reduce(function (a, o) { return a + o.n; }, 0), big = out.reduce(function (a, o) { return o.n > a.n ? o : a; }, out[0]);
    big.n += left;
    return out.filter(function (o) { return o.n > 0; }).sort(function (a, b) { return b.n - a.n; });
  }
  function halloweenOver(s, now) {
    if (!(s.candy > 0) || eventOn(s, now) || s.tut != null) return;
    var d = new Date(now), year = d.getFullYear() - (d.getMonth() >= 9 ? 0 : 1);
    var got = HW_DISHES.filter(function (id) { return (s.eventGot || []).indexOf(id) >= 0; });
    var lots = feastSplit(s.candy, got.length ? got : HW_DISHES, dayRng(s, year, "feast" + s.candy));
    lots.forEach(function (o) { s.food.push({ dish: o.dish, n: o.n }); });
    s.feast = { year: year, candy: s.candy, dishes: lots, seen: false };
    diary(s, now, { kind: "feast", who: "halloween", icon: "🎃", title: "Halloween is over", says: "Your " + s.candy + " candy was baked into Halloween treats for the counters.",
      gains: lots.map(function (o) { return { kind: "food", id: o.dish, n: o.n }; }) });
    s.candy = 0;
    unpackFood(s, now);
  }
  // ---- the event houses as businesses (Cam, 2026-11-01: "The haunted house ... Purchase for 650000 (this will open it
  // to public, so characters will walk through the webbed arch up and into the building where they dissappear, it
  // becomes a money generator that is open from 2100 - 0600. It generates some money per person that goes in there. There
  // will be a similar game feature for the other special event houses. It is intentionally priced high ... During
  // halloween it only acts as the candy store front."): bought once (s.haunts[id]), the house on your street takes a
  // visitor in every slot of HAUNT.gap seconds through its hours, each paying the fee straight into your coins -- while
  // you're away too (up to a week, like the rest). Not while its own event is on. The visitors' times come from the clock
  // alone (hauntArrive), so the page draws the same people walking in that the coins were counted for.
  var HAUNT = { mansion: { price: 650000, from: 21, to: 6, fee: 20, gap: 20, says: "the haunted house" } };   // (about 1,620 visitors, 32,400 coins a night)
  function hauntArrive(id, k) { var g = HAUNT[id].gap * SEC, h = 2166136261, key = id + k; for (var i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619); return k * g + ((h >>> 0) % 1000) / 1000 * g * 0.8; }
  function hauntHours(id, t) { var H = HAUNT[id], h = new Date(t).getHours(); return H.from > H.to ? h >= H.from || h < H.to : h >= H.from && h < H.to; }
  function hauntOn(s, id, t) {
    if (!HAUNT[id] || !s.haunts || !s.haunts[id] || !hauntHours(id, t)) return false;
    if (!(s.decor || []).some(function (o) { return o.id === id; })) return false;
    var ev = DECO[id] && DECO[id].house;
    return ev === EVENT.id ? !eventOn(s, t) : true;
  }
  function hauntRun(s, now) {
    Object.keys(s.haunts || {}).forEach(function (id) {
      var h = s.haunts[id], H = HAUNT[id];
      if (!H) return;
      var from = Math.max(h.last || now, now - 7 * 24 * 60 * MIN), g = H.gap * SEC, n = 0;
      for (var k = Math.floor(from / g); k * g <= now; k++) { var a = hauntArrive(id, k); if (a > from && a <= now && hauntOn(s, id, a)) n++; }
      h.last = now;
      if (!n) return;
      h.visitors = (h.visitors || 0) + n; h.earned = (h.earned || 0) + n * H.fee;
      s.coins += n * H.fee; s.stats.earned += n * H.fee;
    });
  }
  /** An event's house can go up: the haunted house 10-31 October; the rest while their event is on -- any time in the sandbox. */
  function houseTime(s, ev, now) {
    if (ev === EVENT.id) return mansionTime(s, now);
    if (s.sandbox) return true;
    var c = calendar(s, now).filter(function (e) { return e.id === ev; })[0];
    return !!(c && c.on);
  }
  /** V25 q1: every Halloween thing in the catalogue unlocked -- the candy store opens. */
  function catalogueDone(s) { return EVENT_ITEMS.every(function (x) { return (s.eventGot || []).indexOf(x.id) >= 0; }); }
  /** The lucky dip: a paint you haven't got, else a secret recipe Aunty hasn't sent, else a painting for the wall. */
  function luckyDip(s) {
    var paints = PAINTS.filter(function (p) { return !hasPaint(s, p.id); });
    var secrets = DISHES.filter(function (d) { return d.secret && !d.event && s.secrets.indexOf(d.id) < 0; });
    var pool = paints.map(function (p) { return ["paint", p]; }).concat(secrets.map(function (d) { return ["secret", d]; }));
    if (!pool.length) pool = PAINTINGS.map(function (p) { return ["painting", p]; });
    if (!pool.length) return null;
    var w = pool[Math.floor(rnd(s) * pool.length)];
    if (w[0] === "paint") { s.paints = s.paints || []; s.paints.push(w[1].id); return "a tin of " + w[1].id.toLowerCase() + " furniture paint"; }
    if (w[0] === "secret") { s.secrets.push(w[1].id); return "the secret recipe for " + w[1].name.toLowerCase(); }
    s.pware[w[1].id] = (s.pware[w[1].id] || 0) + 1; return w[1].name + ", a painting for your wall";
  }
  function hasMansion(s) { return (s.decor || []).some(function (o) { return DECO[o.id] && DECO[o.id].mansion; }); }
  /** Whether an event thing is yours to buy (anything that isn't an event thing always is). */
  /** Whether another painting / wall thing / photo frame id can go up now (Cam, PT56: what you're putting up stays in
      your hand till Esc, another pick or the menu closing -- while there's one to have): one in storage, or one to buy. */
  function canHang(s, id) {
    var pa = PAINTING[id];
    if (!pa || (pa.sandbox && !s.sandbox)) return false;
    if (pa.vale && !valeHas(s, pa.id) && !((s.pware || {})[pa.id] > 0)) return false;
    if (pa.kit && Object.keys(s.hang || {}).some(function (k) { return s.hang[k] === pa.id; })) return false;
    if (((s.pware || {})[pa.id] || 0) > 0) return true;
    return eventGot(s, pa) && levelOf(s.xp) >= pa.level && s.coins >= pa.price;
  }
  function eventGot(s, x) { return !x || !x.event || (s.eventGot || []).indexOf(x.id) >= 0; }
  /** Candy left on a table by someone getting up -- by the customer's number, not the café's dice, so the rest of the
      day plays out the same. */
  function tipCandy(c) { var h = ((c.id | 0) * 2654435761) % 1000; return h < EVENT.tipChance * 1000 ? EVENT.tip[0] + h % (EVENT.tip[1] - EVENT.tip[0] + 1) : 0; }
  // the ground: the roads' bands (with their kerbs), the lines people walk along, and how far out you can build
  var ROADS = [-3.72, -1.2], WALKS = [-0.6, -4.32], REACH = [-24, 52];   // (PT46: as far as you can see when zoomed out; V23: past a 30x30 café)
  function onRoad(x, y) { return (x > ROADS[0] && x < ROADS[1]) || (y > ROADS[0] && y < ROADS[1]); }
  /** Why a street thing can't stand at x, y ("" when it can): off the roads, the walking lines and the café, with room. */
  /** PT56 (Cam: "one continuous fence line ... like click and dragging a fence in a box"): a fence is a run of one-tile
      segments along the tiles' edges, post to post. A segment's spot is its middle: along x (dir 0) at (i + 0.5, j),
      along y (dir 1) at (i, j + 0.5). Any point goes to the nearest such middle for its way. */
  function fenceAt(x, y, dir) {
    var d = (dir | 0) % 2;
    return d ? { x: Math.round(x), y: Math.floor(y) + 0.5, dir: 1 } : { x: Math.floor(x) + 0.5, y: Math.round(y), dir: 0 };
  }
  // PT56 (Cam: "make it so buildings can line up on the sidewalk"): a building stands on a footprint, not a spot. Its
  // picture is drawn with its front corner on its x, y, so it covers [x - fx, x] by [y - fy, y]: fx, fy by the way it
  // faces, measured off its pictures (the door's wall is the long one). Kept off the street -- the road and both
  // pavements, the band STREET_BAND on each axis -- and the café; brought within half a tile of a pavement's edge, it
  // snaps flush against it, so buildings line up along the street.
  var FOOT = { furnstore: [[1.4, 1.05], [0.8, 1.65], [0.95, 1.55], [1.25, 1.25]], mansion: [[1.85, 1.4], [1.4, 1.85], [1.4, 1.85], [1.85, 1.4]] };
  // Sheet 25's houses (and the haunted house's new art), measured along their walls' feet the same way (a mirrored pair
  // has its two spans swapped; the cleaner side of each was taken -- porch steps and candy canes break the line)
  FOOT.mansion = [[1.32, 1.43], [1.43, 1.32], [1.65, 1.65], [1.65, 1.65]];
  FOOT.santa = [[1.47, 1.47], [1.47, 1.47], [1.39, 1.46], [1.46, 1.39]];
  FOOT.warren = [[1.6, 1.49], [1.49, 1.6], [1.61, 1.63], [1.63, 1.61]];
  FOOT.longhouse = [[1.6, 1.64], [1.64, 1.6], [1.59, 1.64], [1.64, 1.59]];
  // the homes -- 2026-10-25, measured off Sheet 34's painted homes (the front corner, the ends of the two walls' feet),
  // drawn at cafe.js NATURE_H so each covers the ground its stand-in did
  var HOME_FOOT = { home_cottage: [1.63, 1.17], home_bungalow: [2.21, 0.99], home_terrace: [1.05, 1.45], home_townhouse: [1.39, 1.21], home_farmhouse: [2.06, 1.34], home_shopfront: [1.81, 1.19] };
  Object.keys(HOME_FOOT).forEach(function (k) { var f = HOME_FOOT[k]; FOOT[k] = [[f[0], f[1]], [f[1], f[0]], [f[1], f[0]], [f[0], f[1]]]; });
  var STREET_BAND = [-4.92, 0];
  // PT56 (Cam: "a way to lay flooring on the outside of the cafe as well"): Build > Floors lays tiles outside too -- on
  // the grass, a whole tile at a time, never on the pavements or the road; outside a tile costs at least OUT_FLOOR coins
  // (the café's free grey stone included), and Grass lifts one again, for nothing.
  var OUT_FLOOR = 3;
  // 2026-10-24 (Cam: "different terrains like dirt, soil, and rocky ground think like sims games ... paint it directly
  // on the ground and not have it locked to the grid"): ground painted with a brush, free -- each dab [terrain, x, y, r]
  // in tiles (s.terrain, in the order painted; later ones on top). Grass rubs it out. Textures: tools/make_cafe_terrain.py
  // (paving and cobbles are the street's own).
  var TERRAINS = [
    { id: "dirt", name: "Dirt", level: 1 }, { id: "soil", name: "Garden soil", level: 1 }, { id: "gravel", name: "Gravel", level: 2 },
    { id: "sand", name: "Sand", level: 3 }, { id: "rocky", name: "Rocky ground", level: 4 }, { id: "mulch", name: "Bark mulch", level: 5 },
    { id: "moss", name: "Moss", level: 6 }, { id: "mud", name: "Mud", level: 7 }, { id: "paving", name: "Paving stones", level: 8 }, { id: "cobble", name: "Cobbles", level: 10 },
    // (Cam, 25 Oct: "add water to the terrain tools and a shovel which will lower the ground and a level which will level
    // the ground back out"): lake and deep water to paint, and the shovel's dug-out ground (painted with the Shovel, not
    // from the list; the page draws it sunk, with a shaded bank). The Level ("level") rubs out the dug ground and any
    // water on it, leaving the rest.
    { id: "water", name: "Lake water", level: 3, water: true }, { id: "deepwater", name: "Deep water", level: 6, water: true },
    { id: "dug", name: "Dug ground", level: 1, tool: true }];
  var TERRAIN = {}; TERRAINS.forEach(function (t) { TERRAIN[t.id] = t; });
  var TERRAIN_MAX = 6000;
  /** Why tile x, y can't be laid outside, or "". */
  function outFloorProblem(s, x, y) {
    if (x !== Math.floor(x) || y !== Math.floor(y)) return "That's not a tile.";
    if (inside(s, x, y)) return "";
    if (x < REACH[0] || y < REACH[0] || x + 1 > REACH[1] || y + 1 > REACH[1]) return "That's too far out.";
    if ((x < STREET_BAND[1] && x + 1 > STREET_BAND[0]) || (y < STREET_BAND[1] && y + 1 > STREET_BAND[0])) return "Not on the pavement or the road.";
    return "";
  }
  function footOf(id, x, y, dir) { var f = FOOT[id][((dir | 0) % 4 + 4) % 4]; return { x0: x - f[0], x1: x, y0: y - f[1], y1: y }; }
  /** Where a building goes when put at x, y facing dir: flush against a pavement's edge when it's close to one. */
  function buildingAt(id, x, y, dir) {
    if (!FOOT[id]) return { x: x, y: y };
    var f = FOOT[id][((dir | 0) % 4 + 4) % 4], near = function (v, len) {
      if (Math.abs(v - len - STREET_BAND[1]) < 0.5) return STREET_BAND[1] + len;     // (its back edge on our pavements' edge)
      if (Math.abs(v - STREET_BAND[0]) < 0.5) return STREET_BAND[0];                 // (its front edge on the far pavements' edge)
      return v;
    };
    return { x: Math.round(near(x, f[0]) * 100) / 100, y: Math.round(near(y, f[1]) * 100) / 100 };
  }
  // (2026-10-25, Cam: "the ability to scale the ferns, hedges, round bush up 2 sizes by pressing the = key and back down
  // using the - key") a plant's sizes (DECO grow): as it comes, and two bigger -- its room on the ground grows with it
  // (later, Cam: "all items that are not chairs, tables, counters, or anything characters sit down on need the ability
  // to be resized by 3 like the plants, further please add another one onto the plants so 4 times") -- plants (grow) four
  // sizes up, everything else that can three. Not seats, tables or counters, nor what joins up end to end (fences,
  // dividers) or stands on a footprint (buildings, the coop).
  var GROW = [1, 1.4, 1.8, 2.2, 2.6];
  var SEATS_OUT = { bench: 1, picnic: 1 };
  function growMax(id) {
    var d = DECO[id];
    if (!d || d.fence || d.building || d.coop || FOOT[id] || SEATS_OUT[id]) return 0;
    return d.grow ? 4 : 3;
  }
  function thingGrowMax(kind) {
    var t = THINGS[kind];
    if (!t || t.seat || t.table || t.divider || t.reader || kind === "counter" || kind === "buffet") return 0;
    return t.grow ? 4 : 3;
  }
  function growOf(o) { return (o && GROW[Math.min(o.scale | 0, o.id != null ? growMax(o.id) : thingGrowMax(o.kind))]) || 1; }
  function decorProblem(s, id, x, y, uid, dir, free, scale) {
    var d = DECO[id];
    if (!d) return "There's no such thing.";
    var me = uid != null ? (s.decor || []).filter(function (o) { return o.uid === uid; })[0] : null;
    var sc = growOf({ id: id, scale: scale != null ? scale : me ? me.scale : 0 });
    if (x < REACH[0] || y < REACH[0] || x > REACH[1] || y > REACH[1]) return "That's too far out.";
    // (2026-10-24, Cam: "move objects should be on, its the cheat for sims with allows free placement"): free placement
    // -- anywhere outside the café, overlapping whatever you like, not snapped
    if (free) {
      var F0 = FOOT[id] ? footOf(id, x, y, dir) : { x0: x - d.r * sc, x1: x + d.r * sc, y0: y - d.r * sc, y1: y + d.r * sc };
      var mid = d.fence ? 0 : 0.02;
      return F0.x0 < cafeW(s) - mid && F0.x1 > mid && F0.y0 < s.size - mid && F0.y1 > mid && (FOOT[id] || (x > 0 && y > 0 && x < cafeW(s) && y < s.size)) ? "That's inside the café." : "";
    }
    if (FOOT[id]) {
      var F = footOf(id, x, y, dir), cross = function (a0, a1, b0, b1) { return a0 < b1 - 0.01 && b0 < a1 - 0.01; };
      if (cross(F.x0, F.x1, STREET_BAND[0], STREET_BAND[1]) || cross(F.y0, F.y1, STREET_BAND[0], STREET_BAND[1])) return "Not on the pavement or the road.";
      if (cross(F.x0, F.x1, 0, cafeW(s)) && cross(F.y0, F.y1, 0, s.size)) return "That's inside the café.";
      if (onPlot(s, (F.x0 + F.x1) / 2, (F.y0 + F.y1) / 2, Math.max(F.x1 - F.x0, F.y1 - F.y0) / 2)) return "That's on one of your plots.";
      var hit = (s.decor || []).filter(function (o) {
        if (o.uid === uid || !DECO[o.id]) return false;
        if (FOOT[o.id]) { var G = footOf(o.id, o.x, o.y, o.dir); return cross(F.x0, F.x1, G.x0, G.x1) && cross(F.y0, F.y1, G.y0, G.y1); }
        var r = DECO[o.id].r * growOf(o), cx = Math.max(F.x0, Math.min(F.x1, o.x)), cy = Math.max(F.y0, Math.min(F.y1, o.y));
        return Math.hypot(o.x - cx, o.y - cy) < r;
      })[0];
      return hit ? "Too close to the " + DECO[hit.id].name.toLowerCase() + "." : "";
    }
    if (onRoad(x, y)) return "Not on the road.";
    if (WALKS.some(function (w) { return Math.abs(x - w) < 0.3 || Math.abs(y - w) < 0.3; })) return "Keep the pavement's middle clear for people walking.";
    if (x > -d.r * sc && y > -d.r * sc && x < cafeW(s) + d.r * sc && y < s.size + d.r * sc) return "That's inside the café.";
    if (onPlot(s, x, y, d.fence ? 0 : d.r * sc)) return "That's on one of your plots.";
    // (2026-10-24, Cam: "they should be able to overlap and get really close so i can build proper garden beds"): small
    // things outside may touch and overlap each other; only a building keeps its room
    var near = (s.decor || []).filter(function (o) {
      if (o.uid === uid) return false;
      if (!FOOT[o.id]) return false;
      if (FOOT[o.id]) { var G = footOf(o.id, o.x, o.y, o.dir); return Math.hypot(x - Math.max(G.x0, Math.min(G.x1, x)), y - Math.max(G.y0, Math.min(G.y1, y))) < d.r * sc; }
      return Math.hypot(o.x - x, o.y - y) < d.r + (DECO[o.id] ? DECO[o.id].r : 0.3);
    })[0];
    return near ? "Too close to the " + DECO[near.id].name.toLowerCase() + "." : "";
  }
  // ---- Build > Select (2026-10-25, Cam: "a select tool, where i can highlight an area and choose to delete, duplicate or
  // even move ... select all the farm and move it all, plots, fences, hay bales, terrain everything"): a box on the
  // ground, in tiles, and everything outside the café in it -- street things (by where they stand: a building by its
  // footprint's middle), plots and outdoor floor tiles (by their tile's middle) and the painted ground (by each dab).
  function areaBox(o) {
    var n = function (k) { return Number(o[k]); }, x0 = Math.min(n("x0"), n("x1")), x1 = Math.max(n("x0"), n("x1")), y0 = Math.min(n("y0"), n("y1")), y1 = Math.max(n("y0"), n("y1"));
    return [x0, x1, y0, y1].every(isFinite) ? { x0: x0, x1: x1, y0: y0, y1: y1 } : null;
  }
  function areaPick(s, o) {
    var b = areaBox(o), r = { decor: [], plots: [], floors: [], dabs: [] };
    if (!b) return r;
    var inB = function (x, y) { return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; };
    (s.decor || []).forEach(function (d) {
      var F = FOOT[d.id] ? footOf(d.id, d.x, d.y, d.dir) : null;
      if (F ? inB((F.x0 + F.x1) / 2, (F.y0 + F.y1) / 2) : inB(d.x, d.y)) r.decor.push(d.uid);
    });
    (s.field || []).forEach(function (p) { if (inB(p.x + 0.5, p.y + 0.5)) r.plots.push(p.uid); });
    Object.keys(s.outFloors || {}).forEach(function (k) { var q = k.split(",").map(Number); if (inB(q[0] + 0.5, q[1] + 0.5)) r.floors.push(k); });
    (s.terrain || []).forEach(function (d, i) { if (inB(d[1], d[2])) r.dabs.push(i); });
    return r;
  }
  /** "3 fences, 2 hay bales, 8 plots and the painted ground" -- what a selection holds. */
  function areaSays(s, pk) {
    var n = {}, parts = [];
    pk.decor.forEach(function (u) { var d = (s.decor || []).filter(function (o) { return o.uid === u; })[0]; if (d && DECO[d.id]) n[DECO[d.id].name] = (n[DECO[d.id].name] || 0) + 1; });
    Object.keys(n).forEach(function (k) { parts.push(n[k] + " " + k.toLowerCase() + (n[k] > 1 && !/s$/.test(k) ? "s" : "")); });
    if (pk.plots.length) parts.push(pk.plots.length + " plot" + (pk.plots.length > 1 ? "s" : ""));
    if (pk.floors.length) parts.push(pk.floors.length + " floor tile" + (pk.floors.length > 1 ? "s" : ""));
    if (pk.dabs.length) parts.push("the painted ground");
    return parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0] || "";
  }
  var snap = function (v) { return Math.round(Number(v) * 4) / 4; };
  var fine = function (v) { return Math.round(Number(v) * 100) / 100; };

  function lengthOf(pts) { var n = 0; for (var i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return n; }

  // ---- the tutorial (V19 7: a chef walks you through cook, serve, clean and money) --------------
  var TUTORIAL = [
    { id: "cook", say: "Welcome to your café! Your aunt left it to you. Let's cook -- click the stove." },
    { id: "wait", say: "Pancakes take ten seconds. Watch the stove." },
    { id: "serve", say: "They're ready! Click the stove to put them on the buffet counter -- it holds two dishes at once." },
    { id: "clean", say: "Every pan leaves the stove dirty. Click it to clean it." },
    { id: "customer", say: "Food on the counter brings customers in. Here comes one!" },
    { id: "collect", say: "They paid at the till. Click the cash register to take the coins." }
  ];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function no(s, msg) { return { ok: false, error: msg, state: s, events: [] }; }

  function empty() { return { v: 1, game: "neurocafe", log: [] }; }

  /** A new cafe: the 4x4 floor, a stove, a buffet counter (2026-10-21, Cam: two dishes at once from the start) and the
      till already placed. */
  function fresh(now) {
    return {
      v: 1, game: "neurocafe", log: [], made: true, at: now, created: now,
      name: "", coins: START.coins, till: 0, xp: 0, size: START.size, door: START.door,
      floor: "grey", seq: 4, seed: 12345,
      items: [
        { uid: 1, kind: "stove", x: 1, y: 0, dir: 1 },
        { uid: 2, kind: "buffet", x: 3, y: 1, dir: 1, plates: [{ dish: null, n: 0 }, { dish: null, n: 0 }] },
        { uid: 3, kind: "till", x: 3, y: 3, dir: 0 }
      ],
      ware: {}, customers: [], next: null, tut: 0, buffetGift: true, counterGift: true,
      stats: { cooked: 0, served: 0, burnt: 0, earned: 0 }
    };
  }

  /** The player's settings (PT52): music on by default, at a gentle volume. */
  var FX = ["full", "balanced", "light"];
  function prefs(state) {
    var p = (state && state.prefs) || {};
    // (PT56 / Q8: the jukebox -- src "radio" (the café radio) or "pl:<id>" (a playlist), shuffled or in order)
    return { music: p.music !== false, vol: typeof p.vol === "number" ? Math.max(0, Math.min(1, p.vol)) : 0.6,
             src: typeof p.src === "string" && /^(radio|game:(lofi|jazz)|pl:[a-z0-9]{6,40})$/.test(p.src) ? p.src : "radio", shuffle: !!p.shuffle,
             // (the performance audit, 3 Nov 2026; Cam, PT71: "these settings should find themselve in Neurocafe as well")
             fx: FX.indexOf(p.fx) >= 0 ? p.fx : "balanced",
             // (3 Nov 2026, Cam: "lets re use some of the sound effects" from NeuroArcana): on by default, their own volume
             sfx: p.sfx !== false, sfxVol: typeof p.sfxVol === "number" ? Math.max(0, Math.min(1, p.sfxVol)) : 0.7,
             // (2026-11-07) the random happenings (HAPPENINGS): on unless turned off in Settings
             happen: p.happen !== false };
  }
  /** Fill in anything an older save lacks. */
  function normal(state) {
    var s = state && state.game === "neurocafe" ? clone(state) : empty();
    if (!s.made) return s;
    s.items = Array.isArray(s.items) ? s.items : [];
    s.ware = s.ware || {};
    s.customers = Array.isArray(s.customers) ? s.customers : [];
    s.stats = s.stats || { cooked: 0, served: 0, burnt: 0, earned: 0 };
    s.mastery = s.mastery && typeof s.mastery === "object" ? s.mastery : {};   // cooks of each dish (recipe mastery)
    s.log = Array.isArray(s.log) ? s.log : [];
    if (typeof s.till !== "number") s.till = 0;
    if (!s.floor) s.floor = "grey";
    s.decor = Array.isArray(s.decor) ? s.decor : [];
    // PT56: fences now run along the tiles' edges -- ones put down before go onto the nearest edge their way
    s.decor.forEach(function (o) { if (DECO[o.id] && DECO[o.id].fence) { var f = fenceAt(o.x, o.y, o.dir); o.x = f.x; o.y = f.y; o.dir = f.dir; } });
    s.floors = s.floors && typeof s.floors === "object" ? s.floors : {};
    s.outFloors = s.outFloors && typeof s.outFloors === "object" ? s.outFloors : {};   // PT56: tiles laid outside the café
    s.style = s.style || {}; s.owned = s.owned || {};
    // half walls (2026-11-08): the walls on the tiles' edges and the styles bought. The dividers you had become their
    // styles, once: a stored one is a style of yours (taken out of storage); a placed one stays where it is and its
    // style is yours too
    s.hwalls = Array.isArray(s.hwalls) ? s.hwalls.filter(function (w) { return w && HALF_WALL_OF[w.style]; }) : [];
    s.hwStyles = s.hwStyles && typeof s.hwStyles === "object" ? s.hwStyles : {};
    if (!s.hwMoved) {
      HALF_WALLS.forEach(function (x) {
        if (s.ware[x.id] || s.items.some(function (it) { return it.kind === x.id; })) { if (x.price) s.hwStyles[x.id] = true; delete s.ware[x.id]; }
      });
      s.hwMoved = true;
    }
    // (2026-11-08) the patio's railings were laid panel by panel in Build > Walls: now they're half walls on its back
    // edge, and the railings you'd bought are half-wall styles of yours
    if (!s.railMoved) {
      ((s.owned || {}).rail || []).forEach(function (id) { if (HALF_WALL_OF["rail_" + id]) s.hwStyles["rail_" + id] = true; });
      if (s.patio && s.patio.depth) {
        var rh = hwSet(s);
        for (var ri = 0; ri < s.patio.depth; ri++) {
          var rid = "rail_" + (((s.patio.rails || {})["b" + ri]) || s.patio.rail || "wood");
          if (!rh[hwKey(s.size + ri, 0, 0)]) s.hwalls = s.hwalls.concat([{ x: s.size + ri, y: 0, dir: 0, style: HALF_WALL_OF[rid] ? rid : "rail_wood" }]);
        }
      }
      s.railMoved = true;
    }
    // 2026-10-24: counter styles went from the whole café to each counter -- a café's style goes onto every counter once
    if (s.style.counters && s.style.counters !== "wood" && Array.isArray(s.items)) {
      s.items.forEach(function (it) { if ((it.kind === "counter" || it.kind === "buffet") && !it.cstyle && !it.tint) it.cstyle = s.style.counters; });
      s.style.counters = "wood";
    }
    s.walls = s.walls && typeof s.walls === "object" ? s.walls : {};
    s.hang = s.hang && typeof s.hang === "object" ? s.hang : {};          // V22: "l3" -> painting id
    s.hangPhoto = s.hangPhoto && typeof s.hangPhoto === "object" ? s.hangPhoto : {};   // a photo frame's photo: "l3" -> photo id
    s.hangTint = s.hangTint && typeof s.hangTint === "object" ? s.hangTint : {};       // PT56: a photo frame's paint: "l3" -> {h, s, b, sw}
    s.hangCard = s.hangCard && typeof s.hangCard === "object" ? s.hangCard : {};       // V25 q5: a tarot frame's card: "l3" -> "The Star"
    s.inv = s.inv && typeof s.inv === "object" ? s.inv : {};              // V23: potions
    s.food = Array.isArray(s.food) ? s.food : [];                          // Aunty's food, waiting for room on a counter
    s.diary = Array.isArray(s.diary) ? s.diary : [];                       // (2026-11-07) the café diary: what happened, what came and went
    s.secrets = Array.isArray(s.secrets) ? s.secrets : [];                 // Aunty's secret recipes she's sent (and Halloween's)
    s.eventGot = Array.isArray(s.eventGot) ? s.eventGot : [];              // event things unlocked with candy, for good
    if (typeof s.candy !== "number") s.candy = 0;
    s.pantry = s.pantry && typeof s.pantry === "object" ? s.pantry : {};   // the field's harvest (crop -> how many)
    s.field = Array.isArray(s.field) ? s.field : [];                       // the plots you have, each {crop, at} or {}
    s.seeds = s.seeds && typeof s.seeds === "object" ? s.seeds : {};     // seed packets you were given (crop -> how many)
    // (1.0.134's first field had fixed plots with no uid or place: they keep the spot they had)
    s.field = s.field.map(function (p, i) { return p.uid ? p : Object.assign({}, p, { uid: ++s.seq, x: p.x != null ? p.x : -7 - Math.floor(i / 4), y: p.y != null ? p.y : i % 4 }); });
    s.pware = s.pware && typeof s.pware === "object" ? s.pware : {};      // paintings taken down, waiting
    s.hangOff = s.hangOff && typeof s.hangOff === "object" ? s.hangOff : {};   // wall lights switched off: "l3" -> true
    s.ceil = s.ceil && typeof s.ceil === "object" ? s.ceil : {};
    s.terrain = Array.isArray(s.terrain) ? s.terrain.filter(function (d) { return Array.isArray(d) && TERRAIN[d[0]]; }) : [];
    s.haunts = s.haunts && typeof s.haunts === "object" ? s.haunts : {};   // the event houses bought as businesses (HAUNT)
    s.homes = s.homes && typeof s.homes === "object" ? s.homes : {};      // each home's delivery requests (HOME)            // ceiling lights: "x,y" -> {id, off}
    Object.keys(s.ceil).forEach(function (k) { var c = s.ceil[k]; if (!c || !CEIL[c.id]) delete s.ceil[k]; });
    s.cware = s.cware && typeof s.cware === "object" ? s.cware : {};        // ceiling lights taken down, waiting
    // (V26: a vending machine's clock takings were counted from it.since -- what had built up goes in as sold; from now
    // on it fills only while the café's open, in stallsRun. Old machines start full, it.used 0.)
    s.items.forEach(function (it) {
      if (isVend(it) && it.since != null) { it.sold = Math.min(VEND.max, Math.floor(Math.max(0, (s.at || 0) - it.since) / VEND.every) * VEND.coins + (it.sold || 0)); delete it.since; }
      if (ownTop(it) && !Array.isArray(it.plates)) it.plates = [{ dish: null, n: 0 }];
      // (2026-10-26) a milkshake counter is prep only now: shakes left on its top go out to the counters like Aunty's food
      if (isBar(it) && !ownTop(it) && it.plates) { it.plates.forEach(function (pl) { if (pl.dish && DISH[pl.dish] && pl.n > 0) s.food.push({ dish: pl.dish, n: pl.n }); }); delete it.plates; }
      if (isShelf(it)) { if (!Array.isArray(it.plates)) it.plates = []; while (it.plates.length < THINGS[it.kind].slots) it.plates.push({ dish: null, n: 0 }); }
    });
    s.dware = s.dware || {};
    // the NeuroVale log (2026-10-25): what's been won from the carts -- keepsakes had before it count
    if (!Array.isArray(s.vale)) { s.vale = []; DECOR.filter(function (d) { return d.vale; }).forEach(function (d) { if ((s.dware[d.id] || 0) > 0 || (s.decor || []).some(function (o) { return o.id === d.id; })) s.vale.push(d.id); }); }
    // (2026-10-25) the pantry is a cupboard you place: every café gets one, waiting in storage
    if (!s.cupboardGift) { s.cupboardGift = true; if (!s.items.some(function (o) { return o.kind === "cupboard"; })) s.ware.cupboard = (s.ware.cupboard || 0) + 1; }
    if (!s.decorStart) { s.decorStart = true; Object.keys(STARTER_DECOR).forEach(function (k) { s.dware[k] = (s.dware[k] || 0) + STARTER_DECOR[k]; }); }
    // 2026-10-21 (Cam): new cafés start with a buffet counter; a café started before gets one more SERVING counter in
    // the warehouse, on top of what its level allows (1.0.127 gave a buffet counter -- swapped while it's still stored)
    if (!s.counterGift) {
      s.counterGift = true;
      if (!s.buffetGift) { s.buffetGift = true; s.extraCounters = (s.extraCounters | 0) + 1; s.ware.counter = (s.ware.counter || 0) + 1; }
      else if (s.extraCounters && s.ware.buffet > 0) { s.ware.buffet--; if (!s.ware.buffet) delete s.ware.buffet; s.ware.counter = (s.ware.counter || 0) + 1; }
    }
    s.parts = s.parts && typeof s.parts === "object" ? s.parts : {};      // upgrades taken out of stored/sold things
    // 2026-11-18 (PT59 c9): the espresso machine is no longer fitted to serving counters -- the barista counter makes
    // the coffees. Each one fitted or kept as a spare part is taken back for what it cost (1,500 coins); the coffees on
    // a counter stay till they sell.
    var beans = s.items.filter(function (it) { return it.espresso; }).length + (s.parts.espresso | 0);
    s.items.forEach(function (it) { if (it.espresso) { delete it.espresso; delete it.used; delete it.brewAt; } });
    delete s.parts.espresso;
    if (beans) {
      s.coins = (s.coins || 0) + beans * 1500;
      diary(s, s.at || 0, { kind: "news", who: "espresso", icon: "☕", title: "The espresso machine" + (beans > 1 ? "s" : "") + " went back",
                            says: "Coffee has its own barista counter now (Buy > Kitchen > Coffee, shakes & sushi), and a coffee serving counter to go with it. " +
                                  (beans > 1 ? "Your " + beans + " espresso machines were" : "Your espresso machine was") + " taken back for what " + (beans > 1 ? "they" : "it") + " cost.",
                            gains: [{ kind: "coins", n: beans * 1500 }] });
    }
    s.items.forEach(function (it) { if (it.kind === "buffet" && !Array.isArray(it.plates)) it.plates = [{ dish: null, n: 0 }, { dish: null, n: 0 }]; });
    // (2026-10-25) a long thing put across the patio's side wall before that was stopped: turned along the wall, inside,
    // where it fits; else into the warehouse
    var across = function (it) { var cs = cells(it); return cs.some(function (c) { return inPatio(s, c.x, c.y); }) && cs.some(function (c) { return !inPatio(s, c.x, c.y); }); };
    if (s.patio && s.items.some(across)) {
      var lifted = s.items.filter(across);
      s.items = s.items.filter(function (it) { return !across(it); });
      lifted.forEach(function (it) {
        var turned = Object.assign({}, it, { x: s.size - 1, dir: (it.dir | 0) % 4 === 3 ? 2 : 1 });
        if (!fitProblem(s, turned, s.items) && !layoutProblem(s, s.items.concat([turned]))) s.items.push(turned);
        else s.ware[it.kind] = (s.ware[it.kind] || 0) + 1;
      });
    }
    return s;
  }

  // ---- a little seeded randomness, kept in the save (so the clock replays the same) -------------
  function rnd(s) {
    var t = (s.seed = (s.seed + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function note(s, at, msg) { if (msg) { s.log.unshift({ at: at, msg: msg }); s.log = s.log.slice(0, 30); } }
  function itemAt(s, x, y, items) { items = items || s.items; for (var i = 0; i < items.length; i++) if (covers(items[i], x, y)) return items[i]; return null; }
  function byUid(s, uid) { for (var i = 0; i < s.items.length; i++) if (s.items[i].uid === uid) return s.items[i]; return null; }
  function count(s, kind) {
    if (COUNTERS.indexOf(kind) >= 0) return COUNTERS.reduce(function (n, k) { return n + s.items.filter(function (it) { return it.kind === k; }).length + (s.ware[k] || 0); }, 0);
    return s.items.filter(function (it) { return it.kind === kind; }).length + (s.ware[kind] || 0);
  }

  // ---- the floor: the door, walking, reaching things ------------------------------------------
  /** The tile inside the door (the door's in the left wall, at row s.door). */
  function entry(s) { return { x: 0, y: s.door }; }
  function inside(s, x, y) { return x >= 0 && y >= 0 && y < s.size && (x < s.size || inPatio(s, x, y)); }
  /** Whether a step between two tiles side by side crosses the café's front edge somewhere other than the patio's door. */
  function walled(s, a, b) {
    if (hwBetween(s, a, b)) return true;                   // (2026-11-08) a half wall between them
    if (!s.patio || a.y !== b.y || Math.min(a.x, b.x) !== s.size - 1 || Math.max(a.x, b.x) !== s.size) return false;
    return a.y !== s.patio.door;
  }
  /** The shortest walk between two tiles over free floor (both ends may be anything), or null. */
  function path(s, from, to, items) {
    items = items || s.items;
    var busy = {};
    items.forEach(function (it) { cells(it).forEach(function (c) { busy[c.x + "," + c.y] = true; }); });
    var start = from.x + "," + from.y, goal = to.x + "," + to.y, prev = {}, q = [from];
    prev[start] = null;
    while (q.length) {
      var p = q.shift(), k = p.x + "," + p.y;
      if (k === goal) {
        var out = [];
        for (var c = goal; c; c = prev[c]) { var xy = c.split(","); out.unshift({ x: +xy[0], y: +xy[1] }); }
        return out;
      }
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = p.x + d[0], ny = p.y + d[1], nk = nx + "," + ny;
        if (!inside(s, nx, ny) || nk in prev || (busy[nk] && nk !== goal) || walled(s, p, { x: nx, y: ny })) return;
        prev[nk] = k;
        q.push({ x: nx, y: ny });
      });
    }
    return null;
  }
  /** Where a customer stands to use a thing: the nearest free tile beside it they can walk to, or null. With `cell`
      (a buffet counter's plate), beside that tile if they can, else beside any of it. */
  function spotFor(s, it, items, cell) {
    items = items || s.items;
    var e = entry(s);
    var near = function (cs) {
      var best = null;
      cs.forEach(function (c) {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var x = c.x + d[0], y = c.y + d[1];
          if (!inside(s, x, y) || itemAt(s, x, y, items) || walled(s, c, { x: x, y: y })) return;
          var p = path(s, e, { x: x, y: y }, items);
          if (p && (!best || p.length < best.length)) best = p;
        });
      });
      return best ? best[best.length - 1] : null;
    };
    return (cell && near([cell])) || near(cells(it));
  }
  /** Why a thing can't go on these tiles ("" when it can): inside the café, and not on anything else. */
  function fitProblem(s, it, items) {
    var cs = cells(it);
    if (cs.some(function (c) { return !inside(s, c.x, c.y); })) return "That's outside the café.";
    // (2026-10-25: a buffet turned along x could stand across the patio's side wall, half in, half out)
    if (s.patio && cs.some(function (c) { return inPatio(s, c.x, c.y); }) && cs.some(function (c) { return !inPatio(s, c.x, c.y); })) return "That would stand across the patio's wall.";
    if (THINGS[it.kind] && THINGS[it.kind].outdoor && cs.some(function (c) { return !inPatio(s, c.x, c.y); })) return "The " + THINGS[it.kind].name.toLowerCase() + " only goes out on the patio.";
    if (cs.some(function (c) { return items.some(function (o) { return o.uid !== it.uid && covers(o, c.x, c.y); }); })) return "That tile's taken.";
    // (2026-11-08) a long thing can't stand across a half wall
    for (var i = 1; i < cs.length; i++) if (hwBetween(s, cs[i - 1], cs[i])) return "A half wall runs through there.";
    return "";
  }
  /** Why a layout won't do ("" when it's fine): the door's tile kept free, every counter and the till reachable. */
  function layoutProblem(s, items) {
    var e = entry(s);
    if (items.some(function (o) { return covers(o, e.x, e.y); })) return "Keep the tile inside the door free.";
    if (s.patio && items.some(function (o) { return covers(o, s.size - 1, s.patio.door) || covers(o, s.size, s.patio.door); })) return "Keep the tiles either side of the patio door free.";
    var bad = items.filter(function (o) { return (serves(o) || o.kind === "till") && !spotFor(s, o, items); })[0];
    return bad ? "Customers couldn't reach the " + THINGS[bad.kind].name.toLowerCase() + " there." : "";
  }

  // ---- stoves ------------------------------------------------------------------------------------
  /** A stove's state now: free | cooking | ready | burnt | dirty, and the times. */
  function stoveOf(it, now) {
    if (it.dirty) return { status: "dirty" };
    if (!it.dish) return { status: "free" };
    var d = DISH[it.dish], secs = it.secs || d.secs, ready = it.start + secs * SEC, burn = ready + secs * SEC;   // (it.secs: mastery's quicker cook)
    if (now < ready) return { status: "cooking", dish: d, secs: secs, paid: it.paid == null ? d.cost : it.paid, ready: ready, left: ready - now, progress: (now - it.start) / (secs * SEC) };
    if (it.safe || now < burn) return { status: "ready", dish: d, secs: secs, burn: it.safe ? 0 : burn, left: it.safe ? 0 : burn - now };
    return { status: "burnt", dish: d, secs: secs };
  }

  // ---- customers (by the clock) -----------------------------------------------------------------
  /** Every plate on every counter: {it, p (its index), pl (the plate)}. */
  function allPlates(s) {
    var out = [];
    s.items.forEach(function (it) { if (serves(it)) plates(it).forEach(function (pl, p) { out.push({ it: it, p: p, pl: pl }); }); });
    return out;
  }
  function food(s) {
    return allPlates(s).filter(function (o) { return o.pl.dish && (o.pl.n - (o.pl.res || 0)) > 0; });
  }
  // (dishes on the counters never spoil: V23 q5's spoiling was switched off 2026-10-24 and taken out 2026-11-07, Cam:
  // "spoiling food doesn't exist in the game and if it does please remove food on servery from spoiling")
  /** Put servings of a dish out: on a counter with the same dish, else an empty one ("top"), else under a fridge counter
      with the same dish or room ("cold"); null when there's nowhere. */
  function placeFood(s, id, n, now, farm) {
    farm = farm || 0;
    var all = allPlates(s).filter(function (o) { return !ownTop(o.it) && (!isShelf(o.it) || shelfTakes(o.it, id)); });
    var pick = function (L) { L = L.map(function (o) { return o.pl; }); return L.filter(function (pl) { return pl.dish === id; })[0] || L.filter(function (pl) { return !pl.dish; })[0]; };
    // (2026-10-26) a shake goes to a plain milkshake counter first -- by the same shake, or a free place -- then the others
    var to = pick(all.filter(function (o) { return isShelf(o.it); })) || pick(all.filter(function (o) { return !isShelf(o.it); }));
    if (to) { if (!to.dish) { to.farm = 0; to.fres = 0; } to.dish = id; to.n = (to.n || 0) + n; to.since = now; to.farm = (to.farm || 0) + farm; return "top"; }
    var cold = null, fr = s.items.filter(function (it) { return serves(it) && underCap(it) > 0; });
    fr.forEach(function (it) { (it.under || []).forEach(function (u) { if (!cold && u.dish === id) cold = u; }); });
    if (!cold) { var room = fr.filter(function (it) { return (it.under || []).length < underCap(it); })[0];
      if (room) { room.under = room.under || []; cold = { dish: id, n: 0 }; room.under.push(cold); } }
    if (!cold) return null;
    cold.n += n; cold.farm = (cold.farm || 0) + farm;
    return "cold";
  }
  /** Aunty's food waits in the bag until a counter (or a counter's fridge) has room, then goes out by itself. */
  function unpackFood(s, now) {
    if (!s.food || !s.food.length) return;
    s.food = s.food.filter(function (f) { return !DISH[f.dish] || !(f.n > 0) ? false : !placeFood(s, f.dish, f.n, now); });
    if (s.next == null && rate(s) > 0) s.next = now + 2 * SEC;
  }
  /** Whether it's after dark at t (evening and night, 7 pm to 5 am, as the page's sky; the sandbox can set the sky). */
  function isDark(s, t) {
    var set = s.sandbox && s.dev && s.dev.sky;
    if (set) return set === "night";
    var h = new Date(t == null ? (s.clock || s.at || 0) : t).getHours();
    return h >= 19 || h < 5;
  }
  /** What draws customers, part by part (customers a minute). Only what's out on the counters counts -- not what waits
      in a counter's fridge. */
  function popularity(s, t) {
    var full = allPlates(s).filter(function (o) { return o.pl.dish && o.pl.n > 0; }), k = {};
    full.forEach(function (o) { k[o.pl.dish] = 1; });
    var kinds = Object.keys(k), fullN = full.length, kindsN = kinds.length;
    var stars = kindsN ? kinds.reduce(function (n, id) { return n + starsOf(s, id); }, 0) / kindsN : 0;
    var sts = seats(s), seatN = sts.reduce(function (n, ch) { return n + places(ch); }, 0);
    var comfortN = sts.reduce(function (n, ch) { return n + places(ch) * (COMFORT[ch.kind] || 2); }, 0);
    var decoN = s.items.filter(function (o) { return THINGS[o.kind] && THINGS[o.kind].furniture && !THINGS[o.kind].seat && !THINGS[o.kind].table && !THINGS[o.kind].machine; }).length
      + Object.keys(s.hang || {}).filter(function (h) { var w = PAINTING[s.hang[h]]; return w && !w.kit; }).length
      + Object.keys(s.ceil || {}).length;
    var seen = {}, funN = machines(s).reduce(function (n, o) { var m = MACHINES[o.kind].pop * (seen[o.kind] ? 0.5 : 1); seen[o.kind] = 1; return n + m; }, 0);
    var tiles = s.size * s.size, laid = 0;
    for (var y = 0; y < s.size; y++) for (var x = 0; x < s.size; x++) { if ((s.floors || {})[x + "," + y] && s.floors[x + "," + y] !== "grey") laid++; }
    var styleP = (s.style && s.style.wall && s.style.wall !== "plaster" ? RATE.wall : 0) + RATE.floors * (tiles ? laid / tiles : 0)
      + (s.items.some(function (o) { return (o.kind === "counter" || o.kind === "buffet") && (o.cstyle || o.tint); }) ? RATE.counters : 0);
    // after dark: the lights that are on, against one for every ten floor tiles
    var dark = isDark(s, t), L = RATE.light, lightN = 0, light = 0;
    if (dark) {
      lightN = s.items.filter(function (o) { return THINGS[o.kind] && THINGS[o.kind].lamp && !o.off; }).length
        + Object.keys(s.hang || {}).filter(function (h) { var w = PAINTING[s.hang[h]]; return w && w.light && !(s.hangOff || {})[h]; }).length
        + L.ceil * Object.keys(s.ceil || {}).filter(function (c) { return !s.ceil[c].off; }).length;
      light = Math.max(L.worst, Math.min(L.best, (L.best - L.worst) * lightN / Math.max(1, tiles / L.per) + L.worst));
    }
    var P = {
      variety: soft(RATE.variety, kindsN - 1), stock: soft(RATE.stock, fullN - 1), quality: soft(RATE.quality, stars),
      comfort: soft(RATE.comfort, comfortN), looks: soft(RATE.decor, decoN) + soft(RATE.street, (s.decor || []).length) + styleP,
      fun: soft(RATE.fun, funN), light: light
    };
    var r = function (n) { return Math.round(n * 10) / 10; }, total = 0;
    Object.keys(P).forEach(function (key) { total += P[key]; P[key] = r(P[key]); });
    P.total = total; P.dishes = kindsN; P.full = fullN; P.seatN = seatN; P.stars = r(stars); P.dark = dark; P.lightN = lightN;
    P.seats = P.comfort;                                                   // (the old name)
    return P;
  }
  function vendings(s) { return s.items.filter(function (o) { return isVend(o) && !dryAt(s, o); }); }
  /** The rushes (2026-10-21, Cam): by the real clock -- the café's day runs on it -- twice the customers a minute.
      Hours are local time, from (inclusive) to (exclusive). */
  var RUSHES = [
    { id: "breakfast", name: "Breakfast rush", from: 7, to: 9 },
    { id: "lunch", name: "Lunch rush", from: 12, to: 14 },
    { id: "dinner", name: "Dinner rush", from: 18, to: 20 },
    { id: "latenight", name: "Late-night snack run", from: 22, to: 23 },
    { id: "midnight", name: "Midnight run", from: 0, to: 1 }
  ];
  var RUSH_X = 2;
  /** The rush on at time t (null: none). In the sandbox the dev tools can hold one on. */
  function rushAt(t, s) {
    if (s && s.sandbox && s.dev && s.dev.rush) return RUSHES[0];
    var d = new Date(t), h = d.getHours() + d.getMinutes() / 60;
    for (var i = 0; i < RUSHES.length; i++) if (h >= RUSHES[i].from && h < RUSHES[i].to) return RUSHES[i];
    return null;
  }
  /** When the rush on at t ends, or the next one starts: { rush, at } (local time today or tomorrow). */
  function nextRush(t) {
    var best = null;
    RUSHES.forEach(function (r) {
      [0, 1].forEach(function (day) {
        var d = new Date(t); d.setDate(d.getDate() + day); d.setHours(r.from, 0, 0, 0);
        if (d.getTime() > t && (!best || d.getTime() < best.at)) best = { rush: r, at: d.getTime() };
      });
    });
    return best;
  }
  function rate(s, t) {
    var r = baseRate(s, t), at = t == null ? (s.clock || s.at || 0) : t;
    return (rushAt(at, s) || boostOn(s, "crowd", at)) ? r * RUSH_X : r;      // (V25 q1: the crowd potion is a rush of your own)
  }
  /** Whether a candy-store potion's spell is on at t (s.boost: kind -> until). */
  function boostOn(s, k, t) { return !!(s.boost && s.boost[k] > t); }
  function baseRate(s, t) {
    if (s.closed) return 0;                                       // closed (2026-10-21): no one new comes in
    // (PT48: people stop by the vending machine too -- even with nothing on the counters)
    var vend = vendings(s).reduce(function (n, o) { return n + VENDS[o.kind].visitors; }, 0) + visitable(s).reduce(function (n, o) { return n + (MACHINES[o.kind] ? MACHINES[o.kind].visitors : 0); }, 0);
    var p = popularity(s, t);
    if (!p.full) return vend;
    return Math.max(RATE.min, RATE.base + p.total) + vend;
  }
  /** Someone who comes in for the vending machine (or, V22, to play the arcade or pinball): to it, buy or play, and out. */
  function spawnVend(s, at, ends) {
    var vis = visitable(s, at), vm = vis[Math.floor(rnd(s) * vis.length)];
    if (!vm) return false;
    var e = entry(s), vs = spotFor(s, vm);
    if (!vs) return false;
    var a = path(s, e, vs), o = path(s, vs, e);
    if (!a || !o) return false;
    ends = ends || [rnd(s) < 0.5 ? 0 : 1, rnd(s) < 0.5 ? 0 : 1];
    var si = streetRoute(s, ends[0]), so = streetRoute(s, ends[1]).reverse();
    var stay = MACHINES[vm.kind] ? MACHINES[vm.kind].stay / SEC : 1.2;          // a game takes a while
    var t1 = at + Math.round(((lengthOf(si) + 0.5 + a.length - 1) / WALK + stay) * SEC);
    var t3 = t1 + Math.round(((o.length - 1 + 0.5 + lengthOf(so)) / WALK) * SEC);
    s.customers.push({ id: ++s.seq, look: pickLook(s, at), vend: vm.uid, counter: 0, dish: null, price: 0,
                       at: at, take: t1, pay: t1, gone: t3, took: false, paid: false, a: a, b: [vs], o: o, si: si, so: so });
    return true;
  }
  /** One straight step p -> q a customer may take: next door with no half wall between, or across a corner with a clear way round it. */
  function slipOk(s, p, q) {
    var dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y);
    if (dx + dy === 1) return !walled(s, p, q);
    if (dx !== 1 || dy !== 1) return false;
    var c1 = { x: q.x, y: p.y }, c2 = { x: p.x, y: q.y };
    return (!walled(s, p, c1) && !walled(s, c1, q)) || (!walled(s, p, c2) && !walled(s, c2, q));
  }
  /** A half wall just built: anyone already on their way whose walk goes through it takes the way round instead (same ends). */
  function hwReroute(s) {
    (s.customers || []).forEach(function (c) {
      ["a", "b", "o", "s"].forEach(function (k) {
        var r = c[k];
        if (!Array.isArray(r) || r.length < 2 || r.every(function (p, i) { return !i || slipOk(s, r[i - 1], p); })) return;
        var n = path(s, r[0], r[r.length - 1]);
        if (n) c[k] = n;
      });
    });
  }
  function spawn(s, at, ends) {
    var f = food(s), till = s.items.filter(function (it) { return it.kind === "till"; })[0];
    var vn = visitable(s, at).length;
    if (vn && (!f.length || rnd(s) < Math.min(0.45, VEND.chance + 0.07 * (vn - 1)))) return spawnVend(s, at, ends);
    if (!f.length || !till) return false;
    var pick = f[Math.floor(rnd(s) * f.length)], c = pick.it, pl = pick.pl;
    var e = entry(s), cs = spotFor(s, c, null, cells(c)[pick.p]), ts = spotFor(s, till);
    if (!cs || !ts) return false;
    var a = path(s, e, cs), b = path(s, cs, ts), o = path(s, ts, e);
    if (!a || !b || !o) return false;                               // (walled off: no walking through half walls to get there)
    // along the pavement to the door and in; out of the door and off along the street (either end, at random)
    ends = ends || [rnd(s) < 0.5 ? 0 : 1, rnd(s) < 0.5 ? 0 : 1];
    var si = streetRoute(s, ends[0]), so = streetRoute(s, ends[1]).reverse();
    var inW = lengthOf(si) + 0.5 + (a.length - 1), outW = (o.length - 1) + 0.5 + lengthOf(so);
    var t1 = at + Math.round((inW / WALK + 0.6) * SEC), t2 = t1 + Math.round(((b.length - 1) / WALK + 0.8) * SEC), t3 = t2 + Math.round((outW / WALK) * SEC);
    // some sit down to eat: a free seat they can reach, then out from there
    var sit = null, spot = 0, sitAt = 0, up = 0, sp = null;
    if (rnd(s) < DINE_CHANCE) {
      var taken = {};
      s.customers.forEach(function (c2) { if (c2.seat) taken[c2.seat + ":" + (c2.sp || 0)] = 1; });
      seats(s).some(function (ch) {
        for (var n = 0; n < places(ch); n++) {
          if (taken[ch.uid + ":" + n]) continue;
          var at2 = cells(ch)[n], go = path(s, ts, at2), back = path(s, at2, e);
          if (!go || !back) {
            // (Cam, 2026-10-24: "they interact with a table and ... auto sit into a vacant seat. This way they dont need
            // to be able to reach every seat at the table") -- walk up to the table, then slip into the seat; out the same way
            var tc = tableCell(s, ch), toT = tc && path(s, ts, tc), fromT = tc && path(s, tc, e);
            if (!toT || !fromT) continue;
            // the slip in is one step from beside the table (or over its tile), never through a half wall
            var by = toT[toT.length - 2], off = fromT[1];
            if (by && slipOk(s, by, at2) && off && slipOk(s, at2, off)) { go = toT.slice(0, -1).concat([at2]); back = [at2].concat(fromT.slice(1)); }
            else if (slipOk(s, tc, at2)) { go = toT.concat([at2]); back = [at2].concat(fromT); }
            else continue;
          }
          sit = ch; spot = n; sp = go; o = back;
          return true;
        }
        return false;
      });
      if (sit) {
        sitAt = t2 + Math.round(((sp.length - 1) / WALK) * SEC); up = sitAt + EAT;
        outW = (o.length - 1) + 0.5 + lengthOf(so);
        t3 = up + Math.round((outW / WALK) * SEC);
      }
    }
    // takeaway (not sitting in): sometimes out to a free bench or picnic table outside to eat it, then off
    var bench = null, bsit = 0, bup = 0, bo = null, bin = null;
    var places_out = !sit && (s.decor || []).some(function (o2) { return o2.id === "bench" || o2.id === "picnic"; });   // (no bench, no dice: the rest plays out as it did)
    if (places_out && rnd(s) < BENCH.chance) {
      var busy = {};
      s.customers.forEach(function (c2) { if (c2.bench) busy[c2.bench.key] = 1; });
      var free = benchPlaces(s).filter(function (b) { return !busy[b.key]; });
      if (free.length) {
        bench = free[Math.floor(rnd(s) * free.length)];
        bin = benchIn(s, bench.ax, bench.ay); bo = benchOut(s, bench.ax, bench.ay);
        if (!bin || !bo) bench = null;                                  // (fenced in with no way through: not today)
        else {
          bsit = t2 + Math.round(((o.length - 1) + 0.5 + lengthOf(bin)) / WALK * SEC); bup = bsit + BENCH.sit;
          t3 = bup + Math.round(lengthOf(bo) / WALK * SEC);
        }
      }
    }
    pl.res = (pl.res || 0) + 1;
    var fm = (pl.farm || 0) > (pl.fres || 0);                      // a farm-grown serving while there's one (sells for more)
    if (fm) pl.fres = (pl.fres || 0) + 1;
    s.customers.push({ id: ++s.seq, look: pickLook(s, at), counter: c.uid, p: pick.p, dish: pl.dish, price: fm ? farmPrice(s, pl.dish) : priceOf(s, pl.dish), farm: fm,
                       at: at, take: t1, pay: t2, gone: t3, took: false, paid: false, a: a, b: b, o: o, si: si, so: so,
                       seat: sit ? sit.uid : 0, sp: spot, s: sp, sit: sitAt, up: up });
    if (bench) { var cb = s.customers[s.customers.length - 1]; cb.bench = bench; cb.so = bin; cb.so2 = bo; cb.bsit = bsit; cb.bup = bup; }
    return true;
  }
  /** The fire kit (V23 q7): dishes that would have burnt by now, while it has saves left for the day each would burn on
      (local midnight to midnight), wait on the stove instead -- the earliest first. */
  function dayOf(t) { var d = new Date(t); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function fireKit(s, now) {
    var cap = kitSaves(s);
    if (!cap) return;
    s.fire = s.fire || {};
    s.items.filter(function (it) { return cooks(it) && it.dish && !it.safe && !it.dirty; })
      .map(function (it) { return { it: it, at: it.start + 2 * (it.secs || DISH[it.dish].secs) * SEC }; })
      .filter(function (o) { return o.at <= now; }).sort(function (a, b) { return a.at - b.at; })
      .forEach(function (o) {
        var day = dayOf(o.at);
        if ((s.fire[day] || 0) >= cap) return;
        s.fire[day] = (s.fire[day] || 0) + 1; o.it.safe = true; o.it.saved = true;
        s.stats.saved = (s.stats.saved || 0) + 1;
      });
    Object.keys(s.fire).sort().slice(0, -7).forEach(function (k) { delete s.fire[k]; });   // a week is plenty
  }
  function nextEvent(s) {
    var t = Infinity;
    if (s.next != null) t = Math.min(t, s.next);
    s.customers.forEach(function (c) { t = Math.min(t, c.took ? (c.paid ? (c.seat && !c.tipped ? c.up : c.gone) : c.pay) : c.take); });
    return t;
  }
  /** Bring the cafe up to now: customers come, take, pay and go, in order. (Dishes cook and burn by their own times.) */
  /** The farm's housekeeping when the clock moves: crops that were ripe before they could spoil (2026-10-23) get a
      full window from now, once; and the farm's first chicken coop arrives in the street warehouse at its level. */
  function farmToday(s, now) {
    if (!s.cropKeep) {
      s.cropKeep = true;
      s.field.forEach(function (p) { var o = cropOf(p, now); if (o && (o.ready || o.spoiled)) p.at = Math.max(p.at, now - o.crop.mins * MIN); });
    }
    if (!s.coopGift && s.tut == null && levelOf(s.xp) >= COOP.level) {
      s.coopGift = true; s.dware.farm_coop = (s.dware.farm_coop || 0) + 1;
      note(s, now, "Farmer Giles dropped off a chicken coop with two hens -- it's in your street things, ready to put down.");
    }
  }
  function advance(state, now) {
    var s = normal(state);
    if (!s.made) return s;
    var from = Math.max(s.at || now, now - 7 * 24 * 60 * MIN), guard = 0;
    if (s.next == null && rate(s) > 0) s.next = from + 2 * SEC;
    fireKit(s, now);
    farmToday(s, now);
    halloweenOver(s, now);
    hauntRun(s, now);
    RUN_BASE = from;
    while (guard++ < 200000) {
      var t = nextEvent(s);
      if (!(t <= now)) break;
      s.clock = t;
      if (s.next != null && s.next === t) {
        // PT43 (Cam): people come in ones, twos and threes, at uneven times -- a group walks in together, a step apart
        var n = groupSize(s), ends = [rnd(s) < 0.5 ? 0 : 1, rnd(s) < 0.5 ? 0 : 1];
        for (var g = 0; g < n && s.customers.length < crowd(s) && rate(s) > 0; g++) spawn(s, t + g * GROUP_GAP, ends);
        var r = rate(s) * (s.dev && s.dev.busy ? 5 : 1);
        s.next = r > 0 ? t + Math.round((60 / r) * n * (0.35 + 1.3 * rnd(s)) * SEC) : null;
        continue;
      }
      for (var i = 0; i < s.customers.length; i++) {
        var c = s.customers[i];
        if (!c.took && c.take === t && c.vend) {                    // a vending machine customer buys and goes
          c.took = c.paid = true;
          var vmc = byUid(s, c.vend);
          if (vmc && isVend(vmc)) vmc.sold = Math.min(VEND.max, (vmc.sold || 0) + Math.round(VENDS[vmc.kind].sale * (VENDS[vmc.kind].dark && isDark(s, t) ? VENDS[vmc.kind].dark : 1)));
          else if (vmc && MACHINES[vmc.kind]) vmc.coins = Math.min(MACHINE_MAX, (vmc.coins || 0) + MACHINES[vmc.kind].play);
          break;
        }
        if (!c.took && c.take === t) {
          c.took = true;
          var ci = byUid(s, c.counter), it = ci && plates(ci)[c.p || 0];
          if (it && it.dish === c.dish && it.n > 0) {
            it.n--; it.res = Math.max(0, (it.res || 0) - 1);
            if (c.farm) { it.farm = Math.max(0, (it.farm || 0) - 1); it.fres = Math.max(0, (it.fres || 0) - 1); }
            fixFarm(it);
            if (!it.n) { it.dish = null; it.res = 0; fixFarm(it); restock(ci, t); unpackFood(s, t); }
          } else c.none = true;
          break;
        }
        if (c.took && !c.paid && c.pay === t) {
          c.paid = true;
          var gx = GUEST_OF[c.look] ? GUEST.extra : 0;             // (V25 q7: a Halloween guest leaves a few coins more)
          if (!c.none) { s.till += c.price + gx; s.stats.served++; s.stats.earned += c.price + gx; }
          break;
        }
        if (c.paid && c.seat && !c.tipped && c.up === t) {          // N42: getting up from the table, maybe a coin on it
          c.tipped = true;
          var seatIt = byUid(s, c.seat), tb = seatIt && seatFor(s, seatIt);
          if (!c.none && tb && rnd(s) < TIP_CHANCE) tb.tip = (tb.tip || 0) + ((THINGS[seatIt.kind].tip || DINE_TIP) + (patioDay(s, tb, t) ? PATIO_TIP : 0)) * (boostOn(s, "golden", t) ? 2 : 1);
          if (!c.none && tb && eventOn(s, t) && tipCandy(c)) tb.candy = (tb.candy || 0) + tipCandy(c);    // (Halloween)
          // V22: on the way out, a coin or two in the jukebox or the piano
          machines(s).forEach(function (m) { var M = MACHINES[m.kind]; if (M.sit && !c.none && !dryAt(s, m, t) && rnd(s) < M.sit) m.coins = Math.min(MACHINE_MAX, (m.coins || 0) + M.coin); });
          break;
        }
        if (c.paid && c.gone === t) { s.customers.splice(i, 1); break; }
      }
    }
    RUN_BASE = null;
    stallsRun(s, from, now);
    s.clock = now;
    unpackFood(s, now);
    auntyToday(s, now);
    cartToday(s, now);
    homeOrders(s, now);
    happenings(s, now);
    if (s.next == null && rate(s) > 0) s.next = now + 2 * SEC;
    s.at = now;
    return s;
  }

  // ---- levels and what they open ------------------------------------------------------------------
  /** What reaching a level opens: dishes, more stoves and counters, the bigger floor. */
  function unlocksAt(level) {
    var out = [];
    DISHES.forEach(function (d) { if (d.level === level && !d.secret) out.push({ kind: "dish", id: d.id, name: d.name }); });
    SELLS.forEach(function (k) {
      if (k === "buffet") { if (level === THINGS.buffet.level) out.push({ kind: "thing", id: k, name: "The buffet counter (it's one of your counters)" }); return; }
      if (THINGS[k].sandbox || THINGS[k].event) return;
      if (THINGS[k].divider) return;                 // (2026-11-08: half walls' styles, below)
      if (THINGS[k].furniture) { if (level === THINGS[k].level && level > 1) out.push({ kind: "thing", id: k, name: THINGS[k].name + "s" }); return; }
      var n = allowed(k, level);
      var nm = THINGS[k].name.toLowerCase();         // ("hoops": no "A" for one of a plural name; "Another", not "A another")
      if (n > allowed(k, level - 1)) out.push({ kind: "thing", id: k, name: n === 1 ? (/s$/.test(nm) ? nm.charAt(0).toUpperCase() + nm.slice(1) : "A " + nm) : (n === 2 ? "A second " : n === 3 ? "A third " : "Another ") + nm });
    });
    FLOORS.forEach(function (f) { if (f.level === level && level > 1) out.push({ kind: "floor", id: f.id, name: f.name + " floor" }); });
    DECOR.forEach(function (d) { if (d.level === level && level > 1 && !d.house) out.push({ kind: "decor", id: d.id, name: d.name }); });
    WALLPAPERS.forEach(function (w) { if (w.level === level && level > 1) out.push({ kind: "wall", id: w.id, name: w.name + " wallpaper" }); });
    COUNTER_STYLES.forEach(function (w) { if (w.level === level && level > 1) out.push({ kind: "counters", id: w.id, name: w.name + " counters (at the furniture store)" }); });
    if (level === HALF_WALL.level) out.push({ kind: "halfwall", id: "halfwall", name: "Half walls (Build > Half walls)" });
    HALF_WALLS.forEach(function (w) { if (w.level === level && (w.price || w.rail) && !w.event) out.push({ kind: "halfwall", id: w.id, name: w.rail ? w.name + " (half walls, " + (w.price ? "at the furniture store)" : "free)") : w.name + " half walls (at the furniture store)" }); });
    PAINTS.forEach(function (p) { if (p.level === level) out.push({ kind: "paint", id: p.id, name: p.id + " furniture paint" }); });   // (2026-10-24: yours, free)
    PAINTINGS.forEach(function (p) { if (p.level === level) out.push({ kind: "painting", id: p.id, name: "A painting: " + p.name }); });
    WALL_THINGS.forEach(function (w) { if (w.level === level) out.push({ kind: "painting", id: w.id, name: "For the walls: " + w.name.toLowerCase() }); });
    CEILING.forEach(function (c) { if (c.level === level) out.push({ kind: "ceil", id: c.id, name: "For the ceiling: " + c.name.toLowerCase() }); });
    // (the wall weapons are sandbox only for now: not in the level-up list)
    KITS.forEach(function (k) { if (k.level === level) out.push({ kind: "painting", id: k.id, name: "The " + k.name.toLowerCase() + " (saves " + k.saves + " burning dishes a day)" }); });
    EXPANSIONS.forEach(function (e) { if (e.level === level) out.push({ kind: "expand", id: "expand", name: "A bigger café: " + e.size + "x" + e.size }); });
    if (level === FIELD.level) out.push({ kind: "field", id: "field", name: "The plow: dig plots outside and grow your own ingredients" });
    CROPS.forEach(function (c) { if (c.level === level) out.push({ kind: "crop", id: c.id, name: c.name + " to grow" }); });
    if (level > FIELD.level && plotsAllowed(level) > plotsAllowed(level - 1)) out.push({ kind: "field", id: "plots", name: "Room for " + (plotsAllowed(level) - plotsAllowed(level - 1)) + " more plots" });
    return out;
  }
  var CLEAN_XP = 1;

  // ---- Aunty's daily delivery (2026-10-22, Cam) -------------------------------------------------------------------
  // A box every day (local midnight to midnight) once the tutorial's done: a note from Aunty and one to three gifts --
  // coins, potions, servings of a dish (into the bag, out onto the counters as they have room), something to decorate
  // with -- and now and then one of her secret recipes. The very first box always brings the soda bread. Boxes don't
  // pile up: one not opened by midnight is gone. What's in it is decided when it arrives (so the page can't reroll it).
  var AUNTY = {
    recipe: 0.04,                                           // a secret recipe in about one box in 25 (if one is open to your level)
    gifts: [["coins", 30], ["potion", 25], ["food", 30], ["decor", 15], ["seeds", 20]],
    first: "My dear, I'm so proud of you for opening your own café! Here's a little something to get you started -- and my soda bread, the way your grandmother made it. As you build your skills and the café grows, I'll share more of the family's secret recipes with you.",
    recipeSay: "I've been meaning to give you this one. It's been in the family for years -- keep it close, and don't tell your uncle I gave it away!",
    says: [
      "Just a little something to keep you going. Don't forget to eat something yourself!",
      "I told everyone at bowls about your café. Expect a few old ladies!",
      "Every big café started as a little one. I'm so proud of you.",
      "Saw this and thought of you. Keep that chin up, sweetheart.",
      "Your uncle says your pancakes are the best he's had. He's had a lot of pancakes.",
      "Remember: a clean stove is a happy stove. Here's a little help.",
      "It's raining here, so I baked. Sending some your way!",
      "Busy days are good days -- but rest when you can.",
      "You've got your grandmother's knack, you know. She'd be thrilled.",
      "A little parcel for my favourite café owner.",
      "Don't worry about the slow days. The regulars always come back.",
      "Ring me when you get a minute -- and keep going, love. You're doing wonderfully."
    ],
    sign: "Love, Aunty"
  };
  function auntyToday(s, now) {
    if (!s.made || (s.tut != null && s.tut < TUTORIAL.length)) return;
    s.aunty = s.aunty || { count: 0 };
    var day = dayOf(now);
    if (s.aunty.day === day) return;
    s.aunty.day = day; s.aunty.opened = false; s.aunty.box = auntyBox(s, levelOf(s.xp));   // (yesterday's, if unopened, is gone)
  }
  function auntyBox(s, lv) {
    var pick = function (l) { return l[Math.floor(rnd(s) * l.length)]; };
    var cash = function () { return Math.round((30 + 12 * lv) * (0.7 + 0.6 * rnd(s)) / 5) * 5; };
    if (!s.aunty.count && (s.secrets || []).indexOf("bread") < 0)
      return { say: AUNTY.first, gifts: [{ kind: "recipe", id: "bread" }, { kind: "coins", n: 100 }, { kind: "potion", id: "quick", n: 1 }] };
    var gifts = [], kinds = AUNTY.gifts.concat([["paint", 15]]), n = 1 + (rnd(s) < 0.5 ? 1 : 0) + (rnd(s) < 0.15 ? 1 : 0);
    while (gifts.length < n && kinds.length) {
      var tot = kinds.reduce(function (a, k) { return a + k[1]; }, 0), r = rnd(s) * tot, i = 0;
      while (r >= kinds[i][1]) { r -= kinds[i][1]; i++; }
      var k = kinds.splice(i, 1)[0][0];
      if (k === "coins") gifts.push({ kind: "coins", n: cash() });
      if (k === "potion") gifts.push({ kind: "potion", id: pick(["fresh", "quick", "sell"]), n: rnd(s) < 0.2 ? 2 : 1 });
      if (k === "food") {
        var dishes = DISHES.filter(function (d) { return canCook(s, d, lv) && hasCooker(s, d); }), d = pick(dishes);
        // about one and a half times a coins gift's worth, at most one cook's servings
        if (d) gifts.push({ kind: "food", id: d.id, n: Math.max(4, Math.min(d.servings, Math.round((30 + 12 * lv) * 1.5 / d.price))) });
      }
      if (k === "paint") {                                  // (2026-10-24) a tin of a paint you haven't got
        var tins = PAINTS.filter(function (p) { return !hasPaint(s, p.id); });
        if (tins.length) gifts.push({ kind: "paint", id: pick(tins).id });
      }
      if (k === "seeds") {                                  // (2026-10-22) packets of a crop you can grow, once the field's open
        var sc = CROPS.filter(function (c) { return lv >= FIELD.level && c.level <= lv; });
        if (sc.length) gifts.push({ kind: "seeds", id: pick(sc).id, n: 3 + Math.floor(rnd(s) * 4) });
      }
      if (k === "decor") {
        var deco = DECOR.filter(function (x) { return x.level <= lv && !x.vale; }).map(function (x) { return { kind: "decor", id: x.id }; })
          .concat(PAINTINGS.filter(function (x) { return x.level <= lv; }).map(function (x) { return { kind: "painting", id: x.id }; }));
        if (deco.length) gifts.push(pick(deco));
      }
    }
    var secret = DISHES.filter(function (d) { return d.secret && !d.event && d.level <= lv && (s.secrets || []).indexOf(d.id) < 0; });
    if (secret.length && rnd(s) < AUNTY.recipe) { gifts.unshift({ kind: "recipe", id: pick(secret).id }); return { say: AUNTY.recipeSay, gifts: gifts }; }
    return { say: pick(AUNTY.says), gifts: gifts };
  }
  // ---- the request cart (2026-10-22, Cam: "the first blend of the two game worlds") -----------------------------------
  // Every day from level 2 a guild hall tutor from NeuroVale (NeuroPets) drives a cart and horse up out the front with an
  // order -- so many servings of two or three dishes. Load it from the counters (and their fridges); when it's all
  // loaded they pay what it sells for plus a bonus, leave a potion -- now and then one of NeuroVale's keepsakes for the
  // street -- and go. A different tutor each day. At midnight an unfinished cart leaves, paying for what was loaded
  // (without the bonus). Later these grow into special orders.
  var CART = { level: 2, bonus: 0.5, keepsake: 0.1, weapon: 0.35, seeds: 0.4, longest: 4 * 3600 };   // (weapon: of the carts that don't leave a keepsake, 25 Oct)   // (seeds: of the carts that don't leave a keepsake, these leave seed packets)
  // (longest, 2026-10-23, Cam: the cart only asks for dishes of four hours or less -- never an overnight one; it's gone by midnight)
  var TUTORS = [
    { id: "pip", name: "Pip", title: "the Thief's tutor, for Nell the Fence", keep: ["vale_chest"],
      hello: "Don't mind the cart, it's... borrowed. Nell's throwing a party for the fence's friends and wants it fed. Quietly.",
      thanks: "Lovely. I'll tell Nell you drove a hard bargain. You didn't, but I'll tell her." },
    { id: "wren", name: "Wren", title: "the Hunter's tutor, for Ranger Ash", keep: ["vale_dummy"],
      hello: "Ash's got the whole hunting party out in the Forest for a week. They'll eat anything that doesn't run -- this is better than that.",
      thanks: "That'll keep them quiet till the snares are full. Ash sends his regards. And says don't touch his snares." },
    { id: "brakka", name: "Brakka", title: "the Berserker's tutor, for Old Thorvald", keep: ["vale_anvil"],
      hello: "Thorvald's lot trained through breakfast, lunch AND dinner. Now they want all three. Load it up. Quickly.",
      thanks: "HA! Good food. Good fighting food. Thorvald will want more. He always wants more." },
    { id: "ilse", name: "Ilse", title: "the Archmage's apprentice", keep: ["vale_wispjar"],
      hello: "The Mage Tower's study week. Nobody's left the library in days -- I calculated exactly what they'll need. Please don't round down.",
      thanks: "Precisely right. The Archmage says your cooking is 'statistically excellent'. That's high praise from her." },
    { id: "aldo", name: "Brother Aldo", title: "the Paladin's tutor, for Sister Maren", keep: ["vale_grindstone"],
      hello: "Peace be with you. Sister Maren is feeding the village after the chapel service, and she asked for you by name.",
      thanks: "Bless you, and this kitchen. The village will eat well tonight -- Sister Maren will hear of your kindness." },
    { id: "tamsin", name: "Tamsin", title: "the Beast Master's tutor, for Warden Briar", keep: ["vale_hives", "vale_pond"],
      hello: "Hello! The Beast Pen's had a busy week, and the keepers are starving. Briar says the animals eat better than they do. Can you help?",
      thanks: "Thank you! The keepers will be so happy. Briar won't say it, but she will be too. Oh -- the horse likes you." }
  ];
  var TUTOR = {}; TUTORS.forEach(function (x) { TUTOR[x.id] = x; });
  /** Whose turn it is today: one tutor a day, round the six in turn (by the local date). */
  function tutorFor(t) { var d = new Date(t), n = Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); return TUTORS[((n % TUTORS.length) + TUTORS.length) % TUTORS.length]; }
  /** Random numbers of the cart's own, from the day (and the café), so it doesn't change when customers come. */
  function dayRng(s, day, salt) {
    var h = 2166136261, key = day + "|" + salt + "|" + (s.made || 0);
    for (var i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    var o = { seed: h | 0 };
    return function () { return rnd(o); };
  }
  // ---- homes on your street (2026-10-24, Cam: "a house could get an icon on it for a delivery request asking for a
  // certain amount of food and then we have to deliver it to them. They have a new request if one is fulfilled within
  // the hour but are capped to 10 orders per house a day"): each home asks for so many servings of a dish you can cook
  // (nothing over an hour to cook); delivered, it pays HOME.pay x what they'd sell for, and asks again 10-60 minutes
  // later, up to HOME.cap a day. A new day starts them afresh; an order left at midnight is dropped.
  var HOME = { cap: 10, next: [10, 60], pay: 1.5, xp: 1.5, longest: 3600, first: 2, runFor: 90 * 1000 };
  function homeOrders(s, now) {
    if (!s.made || (s.tut != null && s.tut < TUTORIAL.length)) return;
    var day = dayOf(now), lv = levelOf(s.xp);
    (s.decor || []).forEach(function (o) {
      if (!DECO[o.id] || !DECO[o.id].home) return;
      var hs = s.homes[o.uid];
      if (!hs) hs = s.homes[o.uid] = { day: day, done: 0, next: now + HOME.first * MIN, order: null };
      if (hs.day !== day) { hs.day = day; hs.done = 0; hs.order = null; hs.next = now; }
      if (hs.order || hs.done >= HOME.cap || now < hs.next) return;
      var r = dayRng(s, day, "home" + o.uid + ":" + hs.done), pool = DISHES.filter(function (d) { return !d.secret && !d.event && d.secs <= HOME.longest && canCook(s, d, lv) && hasCooker(s, d); });
      if (!pool.length) return;
      var d = pool[Math.floor(r() * pool.length)], n = Math.max(3, Math.round(mastered(s, d.id).servings * (0.4 + r() * 0.9)));
      hs.order = { dish: d.id, n: n, value: Math.round(n * priceOf(s, d.id) * HOME.pay), xp: Math.max(1, Math.round(d.xp * n / d.servings * HOME.xp)), at: now };
    });
    Object.keys(s.homes).forEach(function (k) { if (!(s.decor || []).some(function (o) { return String(o.uid) === k; })) delete s.homes[k]; });
  }
  function cartValue(s, c) { return c.order.reduce(function (a, l) { return a + l.n * priceOf(s, l.dish); }, 0); }
  function cartToday(s, now) {
    if (!s.made || (s.tut != null && s.tut < TUTORIAL.length)) return;
    var day = dayOf(now), c = s.cart;
    if (c && c.day === day) { if (!c.done) trimCart(s, c, day, now); return; }
    if (c && !c.done) {                                   // last night it left unfinished: what was loaded is paid for
      var paid = c.order.reduce(function (a, l) { return a + l.got * priceOf(s, l.dish); }, 0);
      if (paid) { s.coins += paid; s.stats.earned += paid; note(s, now, TUTOR[c.tutor].name + " left at midnight and paid " + paid + " coins for what was loaded."); }
    }
    s.cart = levelOf(s.xp) >= CART.level ? newCart(s, day, now) : null;
  }
  /** A cart out before the overnight rule (2026-10-23): its too-long dishes come off the order (what was loaded of one
      still counts); a cart left with nothing to ask for is swapped for a new one. */
  function trimCart(s, c, day, now) {
    var long = function (l) { return !DISH[l.dish] || DISH[l.dish].secs > CART.longest; };
    if (!c.order.some(long)) return;
    c.order = c.order.filter(function (l) { return !long(l) || l.got > 0; });
    c.order.forEach(function (l) { if (long(l)) l.n = l.got; });
    if (!c.order.length) s.cart = newCart(s, day, now);
  }
  function newCart(s, day, now) {
    var lv = levelOf(s.xp), pool = DISHES.filter(function (d) { return !d.secret && d.secs <= CART.longest && canCook(s, d, lv) && hasCooker(s, d); }), order = [], r = dayRng(s, day, "cart" + (s.stats.carts || 0));
    var lines = Math.min(pool.length, lv < 4 ? 1 : lv < 10 ? 2 : r() < 0.5 ? 2 : 3);
    while (order.length < lines) {
      var d = pool.splice(Math.floor(r() * pool.length), 1)[0];
      // quick dishes in bulk, long ones by the cook or two (Cam: "200 pancake serves, 40 waffle serves and 10 omelettes")
      var cooks = d.secs <= 120 ? 5 + r() * 7 : d.secs <= 1800 ? 2 + r() * 3 : 1 + r() * 1.5;
      order.push({ dish: d.id, n: Math.max(5, Math.round(d.servings * cooks / 5) * 5), got: 0 });
    }
    return { day: day, tutor: tutorFor(now).id, order: order, done: false };
  }
  /** Servings of a dish you could load now: on top of the counters (fresh) and in their fridges. (2026-10-25, Cam: "a
      noticable delay in house orders registering what is on the servery" -- a customer who'd just come in had already
      promised a serving to themselves, so it showed on the counter but didn't count till they took it: now everything
      on the counter counts; a delivery takes the promised ones last, and that customer goes without.) */
  function loadable(s, id, now) {
    var n = 0;
    allPlates(s).forEach(function (o) { if (o.pl.dish === id) n += Math.max(0, o.pl.n); });
    s.items.forEach(function (it) { (it.under || []).forEach(function (u) { if (u.dish === id) n += u.n; }); });
    return n;
  }
  function loadCart(s, line, now) {
    var want = line.n - line.got, took = 0;
    var fromPlates = function (promised) {
      allPlates(s).forEach(function (o) {
        var pl = o.pl;
        if (took >= want || pl.dish !== line.dish) return;
        var k = Math.min(want - took, Math.max(0, promised ? pl.n : pl.n - (pl.res || 0)));
        pl.n -= k; took += k; pl.res = Math.min(pl.res || 0, pl.n); fixFarm(pl);   // (plain servings go first: farm ones keep for customers)
        if (!pl.n) { pl.dish = null; pl.res = 0; pl.since = 0; fixFarm(pl); restock(o.it, now); }
      });
    };
    fromPlates(false);
    s.items.forEach(function (it) {
      if (!it.under) return;
      it.under.forEach(function (u) { if (took < want && u.dish === line.dish) { var k = Math.min(want - took, u.n); u.n -= k; took += k; u.farm = Math.min(u.farm || 0, u.n); } });
      it.under = it.under.filter(function (u) { return u.n > 0; });
    });
    fromPlates(true);                                                      // (last, the servings customers had promised themselves)
    line.got += took;
    return took;
  }
  /** A full cart: they pay what it sells for plus the bonus, leave a potion (now and then a keepsake) and go. Returns
      what to say, or "" while it isn't full. */
  function finishCart(s, ev) {
    var cc = s.cart;
    if (!cc || cc.done || cc.order.some(function (l) { return l.got < l.n; })) return "";
    var T3 = TUTOR[cc.tutor], value = cartValue(s, cc), bonus = Math.round(value * CART.bonus), gift;
    s.coins += value + bonus; s.stats.earned += value + bonus; s.stats.served += cc.order.reduce(function (a, l) { return a + l.n; }, 0);
    s.stats.carts = (s.stats.carts || 0) + 1;
    var gr = dayRng(s, cc.day, "gift" + (s.stats.carts || 0));
    var wpool = WEAPONS.filter(function (w) { return (s.vale || []).indexOf(w.id) < 0; }), wfit = wpool.filter(function (w) { return w.level <= levelOf(s.xp); });
    if (gr() < CART.keepsake) { var kid = T3.keep[Math.floor(gr() * T3.keep.length)]; s.dware[kid] = (s.dware[kid] || 0) + 1; gift = { kind: "decor", id: kid }; if (s.vale.indexOf(kid) < 0) s.vale.push(kid); }
    else if (wpool.length && gr() < CART.weapon) {                // (a mounted weapon for the NeuroVale log: one you could use now first)
      var wp = (wfit.length ? wfit : wpool)[Math.floor(gr() * (wfit.length ? wfit : wpool).length)];
      s.vale.push(wp.id); s.pware[wp.id] = (s.pware[wp.id] || 0) + 1; gift = { kind: "weapon", id: wp.id };
    }
    else {
      var lv3 = levelOf(s.xp), sc3 = CROPS.filter(function (c) { return lv3 >= FIELD.level && c.level <= lv3; });
      if (sc3.length && gr() < CART.seeds) { var sd = sc3[Math.floor(gr() * sc3.length)]; var sn = 4 + Math.floor(gr() * 5); s.seeds[sd.id] = (s.seeds[sd.id] || 0) + sn; gift = { kind: "seeds", id: sd.id, n: sn }; }
      else { var pk3 = Object.keys(POTIONS)[Math.floor(gr() * Object.keys(POTIONS).length)]; s.inv[pk3] = (s.inv[pk3] || 0) + 1; gift = { kind: "potion", id: pk3, n: 1 }; }
    }
    cc.done = true; cc.gift = gift;
    diary(s, s.at || 0, { kind: "cart", who: T3.id, title: T3.name + "'s cart from NeuroVale", says: T3.thanks,
      gains: [{ kind: "coins", n: value + bonus }, gift.kind === "weapon" ? { kind: "painting", id: gift.id } : gift] });
    ev.push({ kind: "cart", tutor: T3.id, name: T3.name, thanks: T3.thanks, value: value, bonus: bonus, gift: gift });
    return T3.name + " paid " + (value + bonus) + " coins and set off for NeuroVale.";
  }
  function openAunty(s, now) {
    var box = s.aunty.box;
    box.gifts.forEach(function (g) {
      if (g.kind === "coins") s.coins += g.n;
      if (g.kind === "potion") s.inv[g.id] = (s.inv[g.id] || 0) + g.n;
      if (g.kind === "food") s.food.push({ dish: g.id, n: g.n });
      if (g.kind === "decor") s.dware[g.id] = (s.dware[g.id] || 0) + 1;
      if (g.kind === "painting") s.pware[g.id] = (s.pware[g.id] || 0) + 1;
      if (g.kind === "recipe" && s.secrets.indexOf(g.id) < 0) s.secrets.push(g.id);
      if (g.kind === "seeds") s.seeds[g.id] = (s.seeds[g.id] || 0) + g.n;
      if (g.kind === "paint" && (s.paints || []).indexOf(g.id) < 0) s.paints = (s.paints || []).concat([g.id]);
    });
    s.aunty.opened = true; s.aunty.count = (s.aunty.count || 0) + 1;
    diary(s, now, { kind: "aunty", who: "aunty", title: s.aunty.count === 1 ? "Aunty's first box" : "A box from Aunty", says: box.say, gains: box.gifts.slice() });
    unpackFood(s, now);
    return box;
  }
  // ---- the café diary (2026-11-07, Cam: "an event diary which has what events have occurred and what was gained or
  // lost from it ... Handy if we quickly closed the window and didn't check what we got"): every delivery, cart, level
  // reward, lucky dip and happening goes in as an entry {id, at, kind, icon, title, says, who, gains}; gains are
  // gift-shaped ({kind: "coins", n} -- n below 0 for a loss -- or potion / food / seeds / decor / painting / paint /
  // recipe / pantry / boost / text). The newest DIARY.keep are kept; s.diarySeen is the last one read, so the page can
  // count the ones still to read.
  var DIARY = { keep: 200 };
  function diary(s, at, e) {
    s.diary = Array.isArray(s.diary) ? s.diary : [];
    s.diaryN = (s.diaryN || 0) + 1;
    e.id = s.diaryN; e.at = at; e.gains = e.gains || [];
    s.diary.push(e);
    if (s.diary.length > DIARY.keep) s.diary.splice(0, s.diary.length - DIARY.keep);
    return e;
  }
  function diaryUnread(s) { var seen = s.diarySeen || 0; return (s.diary || []).filter(function (e) { return e.id > seen; }).length; }

  // ---- happenings (2026-11-07, Cam: "random events ... Customer got food sickness, Café received a donation from the
  // mayor, a stove broke and had to be repaired ... come up with more random events that would make the game more
  // dynamic"): once the tutorial's done, every 70 to 160 minutes something happens -- good or bad -- and goes in the
  // diary. Away from the café, the one that was due happens when you come back (never a pile of them). Amounts grow
  // with your level: `k` coins a level, so Cam's own figures (100,000 for the food poisoning, 10,000 from the mayor) are
  // what they come to at level 100. A loss never takes more than a third of the coins you have.
  var HAPPEN = { level: 2, gap: [70, 160], cap: 1 / 3 };
  /** The happenings' own dice (kept in s.hap), so they never change what the customers do. */
  function hapRnd(s) {
    s.hap = s.hap || {};
    if (s.hap.seed == null) s.hap.seed = (s.seed ^ 0x5bd1e995) | 0;
    var t = (s.hap.seed = (s.hap.seed + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function hapCoins(s, k) { return Math.max(10, Math.round(k * levelOf(s.xp) * (0.85 + hapRnd(s) * 0.3) / 5) * 5); }
  function hapLose(s, k) { var n = Math.min(hapCoins(s, k), Math.floor(s.coins * HAPPEN.cap)); s.coins -= n; return { kind: "coins", n: -n }; }
  function hapGain(s, k) { var n = hapCoins(s, k); s.coins += n; s.stats.earned += n; return { kind: "coins", n: n }; }
  function hapBoost(s, id, mins, now) {
    s.boost = s.boost || {}; s.boost[id] = Math.max(now, s.boost[id] || 0) + mins * MIN;
    if (id === "crowd") s.next = Math.min(s.next || now + 2 * SEC, now + 2 * SEC);
    return { kind: "boost", id: id, mins: mins };
  }
  function hapPick(s, l) { return l[Math.floor(hapRnd(s) * l.length)]; }
  function hapCooking(s, now) { return s.items.filter(function (it) { return cooks(it) && stoveOf(it, now).status === "cooking"; }); }
  function hapGrowing(s, now) { return (s.field || []).filter(function (p) { var o = cropOf(p, now); return o && !o.ready && !o.spoiled; }); }
  var HAPPENINGS = [
    // ---- the bad
    { id: "sick", icon: "🤢", w: 1, bad: true, need: function (s) { return s.stats.served > 20 && s.coins >= 300; },
      run: function (s) { return { title: "A customer got food poisoning", says: "They swore it was the eggs. To keep it out of the papers you paid their doctor's bills, and a little more for their trouble.", gains: [hapLose(s, 1000)] }; } },
    { id: "stove", icon: "🔧", w: 4, bad: true, need: function (s) { return s.coins >= 100 && s.items.some(function (it) { return it.kind === "stove"; }); },
      run: function (s, now) {
        var on = hapCooking(s, now).filter(function (it) { return it.kind === "stove"; }), st = on.length ? hapPick(s, on) : hapPick(s, s.items.filter(function (it) { return it.kind === "stove"; }));
        var g = [], d = st.dish && DISH[st.dish];
        if (on.length) { g.push({ kind: "lost", id: d.id, text: d.name + " thrown away" }); st.dish = null; st.start = 0; st.safe = false; st.paid = 0; st.farm = false; st.mx = 0; }
        g.push(hapLose(s, 12));
        return { title: "A stove broke down", says: on.length ? "It went with a bang halfway through the " + d.name.toLowerCase() + ", which had to go in the bin. The repair man fixed it, for his call-out fee." : "It wouldn't light this morning. The repair man had it going again in an hour, for his call-out fee.", gains: g };
      } },
    { id: "pipe", icon: "🚿", w: 3, bad: true, need: function (s) { return s.coins >= 100; },
      run: function (s) { return { title: "A pipe burst under the sink", says: "Water all over the kitchen floor. The plumber came straight out.", gains: [hapLose(s, 15)] }; } },
    { id: "window", icon: "⚽", w: 3, bad: true, need: function (s) { return s.coins >= 100; },
      run: function (s) { return { title: "A football came through the window", says: "The kids from down the street said sorry. The glazier still wanted paying.", gains: [hapLose(s, 10)] }; } },
    { id: "mice", icon: "🐭", w: 2, bad: true, need: function (s) { return s.coins >= 100; },
      run: function (s) { return { title: "Mice in the store room", says: "Pest control came out the same day and sealed up the holes.", gains: [hapLose(s, 12)] }; } },
    { id: "dash", icon: "🏃", w: 3, bad: true, need: function (s) { return !s.closed && s.stats.served > 0 && s.coins >= 50; },
      run: function (s) { return { title: "A table ran off without paying", says: "Four of them, out the door before the bill came. Nobody got a good look.", gains: [hapLose(s, 4)] }; } },
    { id: "power", icon: "⚡", w: 3, bad: true, need: function (s, now) { return hapCooking(s, now).length > 0; },
      run: function (s, now) { hapCooking(s, now).forEach(function (it) { it.start += 10 * MIN; }); return { title: "A power cut", says: "The whole street went dark for ten minutes.", gains: [{ kind: "text", text: "Everything cooking held up 10 minutes" }] }; } },
    { id: "crows", icon: "🐦", w: 3, bad: true, need: function (s, now) { return hapGrowing(s, now).length > 0; },
      run: function (s, now) { var p = hapPick(s, hapGrowing(s, now)); p.at = now; return { title: "Crows got into the farm", says: "They had the seed out of one of the plots before anyone noticed.", gains: [{ kind: "text", text: "The " + CROP[p.crop].name.toLowerCase() + " in one plot is growing again from the start" }] }; } },
    { id: "fox", icon: "🦊", w: 2, bad: true, need: function (s) { return (s.pantry && s.pantry.egg) >= 2; },
      run: function (s) { var n = Math.min(s.pantry.egg, 2 + Math.floor(hapRnd(s) * 5)); s.pantry.egg -= n; return { title: "A fox got into the hen house", says: "The hens are fine, if a bit shaken. The eggs weren't so lucky.", gains: [{ kind: "pantry", id: "egg", n: -n }] }; } },
    { id: "inspector", icon: "📋", w: 4, need: function (s) { return s.items.some(cooks); },
      run: function (s) {
        var all = s.items.filter(cooks), dirty = all.filter(function (it) { return it.dirty; }).length;
        if (dirty * 2 > all.length && s.coins >= 100) return { bad: true, title: "The health inspector called", says: dirty + " of your " + all.length + " stoves were waiting to be cleaned. A fine, and a warning.", gains: [hapLose(s, 20)] };
        return { title: "The health inspector called", says: "Sparkling stoves: five stars for hygiene. The council's clean kitchen award comes with a cheque.", gains: [hapGain(s, 15)] };
      } },
    // ---- the good
    { id: "mayor", icon: "🎩", w: 2, run: function (s) { return { title: "The mayor made a donation", says: "For keeping the corner lively: a gift from the town's community fund.", gains: [hapGain(s, 100)] }; } },
    { id: "critic", icon: "✒️", w: 3, need: function (s) { return !s.closed; },
      run: function (s, now) { return { title: "A food critic loved it", says: "A glowing write-up in the morning paper. People are coming to see what the fuss is about.", gains: [hapBoost(s, "crowd", 30, now)] }; } },
    { id: "coach", icon: "🚌", w: 3, need: function (s) { return !s.closed; },
      run: function (s, now) { return { title: "A coach party pulled up", says: "A coach tour stopped on the corner, and everyone on it is hungry.", gains: [hapBoost(s, "crowd", 15, now)] }; } },
    { id: "busker", icon: "🎻", w: 3, need: function (s) { return !s.closed; },
      run: function (s, now) { return { title: "A busker is playing outside", says: "A fiddler set up by the door. Everyone's in a generous mood.", gains: [hapBoost(s, "golden", 30, now)] }; } },
    { id: "supplier", icon: "📦", w: 3, need: function (s) { var lv = levelOf(s.xp); return DISHES.some(function (d) { return canCook(s, d, lv) && hasCooker(s, d); }); },
      run: function (s, now) {
        var lv = levelOf(s.xp), d = hapPick(s, DISHES.filter(function (x) { return canCook(s, x, lv) && hasCooker(s, x); }));
        var n = Math.max(4, Math.min(d.servings, Math.round((30 + 12 * lv) / d.price)));
        s.food.push({ dish: d.id, n: n }); unpackFood(s, now);
        return { title: "The supplier sent too much", says: "A van turned up with a whole order meant for the hotel. They said to keep it.", gains: [{ kind: "food", id: d.id, n: n }] };
      } },
    { id: "wallet", icon: "👛", w: 3, run: function (s) { return { title: "A lost wallet went home", says: "You handed in a wallet left on a table. Its owner sent a thank-you card, with something in it.", gains: [hapGain(s, 25)] }; } },
    { id: "wedding", icon: "💒", w: 2, need: function (s) { return levelOf(s.xp) >= 5; },
      run: function (s) { return { title: "A wedding party booked the café", says: "Cake, tea and dancing between the tables. They paid for the whole morning.", gains: [hapGain(s, 60)] }; } },
    { id: "film", icon: "🎬", w: 1, need: function (s) { return levelOf(s.xp) >= 10; },
      run: function (s) { return { title: "A film crew used the café", says: "Your café is in a scene of a television drama. The location fee was very nice.", gains: [hapGain(s, 80)] }; } },
    { id: "tipjar", icon: "🫙", w: 4, need: function (s) { return s.stats.served > 0; },
      run: function (s) { return { title: "A big tip in the jar", says: "One of your regulars stuffed a roll of notes in the tip jar on the way out.", gains: [hapGain(s, 8)] }; } },
    { id: "herbalist", icon: "🧪", w: 3,
      run: function (s) { var id = hapPick(s, ["fresh", "quick", "sell"]); s.inv[id] = (s.inv[id] || 0) + 1; return { title: "A travelling herbalist stopped by", says: "She paid for her tea with a little bottle from her bag.", gains: [{ kind: "potion", id: id, n: 1 }] }; } },
    { id: "seeds", icon: "🌱", w: 3, need: function (s) { return levelOf(s.xp) >= FIELD.level; },
      run: function (s) {
        var lv = levelOf(s.xp), c = hapPick(s, CROPS.filter(function (x) { return x.level <= lv; })), n = 3 + Math.floor(hapRnd(s) * 4);
        s.seeds[c.id] = (s.seeds[c.id] || 0) + n;
        return { title: "The neighbour shared her seeds", says: "She grew too many this year and left some packets on the step.", gains: [{ kind: "seeds", id: c.id, n: n }] };
      } },
    { id: "rain", icon: "🌦", w: 2, need: function (s, now) { return hapGrowing(s, now).length > 0; },
      run: function (s, now) { var p = hapPick(s, hapGrowing(s, now)); p.at = now - CROP[p.crop].mins * MIN; return { title: "A warm spring shower", says: "Just the rain the farm needed.", gains: [{ kind: "text", text: "The " + CROP[p.crop].name.toLowerCase() + " in one plot is ready to pick now" }] }; } }
  ];
  var HAPPENING = {}; HAPPENINGS.forEach(function (h) { HAPPENING[h.id] = h; });
  function hapGap(s) { return (HAPPEN.gap[0] + hapRnd(s) * (HAPPEN.gap[1] - HAPPEN.gap[0])) * MIN; }
  /** One happening, picked by weight from those that can happen now (or the one asked for) -- its diary entry, or null. */
  function happen(s, now, id) {
    var can = (id ? [HAPPENING[id]].filter(Boolean) : HAPPENINGS).filter(function (h) { return !h.need || h.need(s, now); });
    if (!can.length) return null;
    var tot = can.reduce(function (a, h) { return a + h.w; }, 0), r = hapRnd(s) * tot, i = 0;
    while (i < can.length - 1 && r >= can[i].w) { r -= can[i].w; i++; }
    var h = can[i], e = h.run(s, now);
    return diary(s, now, { kind: "happening", who: h.id, icon: h.icon, bad: e.bad != null ? e.bad : !!h.bad, title: e.title, says: e.says, gains: e.gains });
  }
  function happenings(s, now) {
    if (s.tut != null || levelOf(s.xp) < HAPPEN.level || prefs(s).happen === false) return;
    s.hap = s.hap || {};
    if (!s.hap.next) { s.hap.next = now + hapGap(s); return; }
    if (now < s.hap.next) return;
    s.hap.next = now + hapGap(s);
    happen(s, now);
  }
  // V23 q4: a reward with every level -- coins (40 x the level), a potion at most levels, a chest every 10th
  var POTIONS = { fresh: { name: "Fresh potion", says: "Brings a crop that's gone over in its plot back to ripe, ready to pick." },
                  quick: { name: "Quick potion", says: "A stove finishes cooking now." },
                  sell: { name: "Sell potion", says: "Sells a counter's whole dish now, into the till." },
                  // V25 q1: the candy store's own -- used from the Bag, no counter or stove needed
                  golden: { name: "Golden tips potion", says: "Every table tip is doubled for an hour.", spell: 60 * MIN },
                  crowd: { name: "Crowd potion", says: "A rush of your own: twice the customers for 15 minutes.", spell: 15 * MIN },
                  chef: { name: "Chef's potion", says: "Every stove and outdoor appliance finishes cooking now." },
                  mastery: { name: "Mastery potion", says: "Every dish cooking now counts twice towards its stars." } };
  // V25 q1 (N56, Cam: "Once you have completed the halloween catalogue, there should be a new page appear with potions
  // ... very expensive"): the Candy store, a page of the Events book once every Halloween thing is unlocked
  var CANDY_STORE = [{ id: "golden", candy: 300 }, { id: "crowd", candy: 250 }, { id: "chef", candy: 200 }, { id: "mastery", candy: 350 },
                     { id: "lucky", candy: 400, name: "Lucky dip", says: "A rare surprise: a paint, a secret recipe or a painting." },
                     { id: "fresh", candy: 60 }, { id: "quick", candy: 60 }, { id: "sell", candy: 60 }];
  CANDY_STORE.forEach(function (c) { if (POTIONS[c.id]) { c.name = POTIONS[c.id].name; c.says = POTIONS[c.id].says; } });
  function rewardFor(l) {
    if (l % 10 === 0) return { coins: 150 * l, potions: { fresh: 2, quick: 2, sell: 2 }, chest: true };
    var p = {}; if (l >= 2) p[["quick", "sell", "fresh"][l % 3]] = 1;
    return { coins: 40 * l, potions: p };
  }
  function addXp(s, n, events) {
    var before = levelOf(s.xp);
    s.xp += n;
    for (var l = before + 1; l <= levelOf(s.xp); l++) {
      var rw = rewardFor(l);
      s.coins += rw.coins;
      s.inv = s.inv || {};
      Object.keys(rw.potions).forEach(function (k) { s.inv[k] = (s.inv[k] || 0) + rw.potions[k]; });
      events.push({ kind: "level", level: l, unlocks: unlocksAt(l), reward: rw });
      diary(s, s.at || 0, { kind: "level", who: "level", icon: "⭐", title: "Level " + l, says: "Your café reached level " + l + (rw.chest ? ", and a chest came with it." : "."),
        gains: [{ kind: "coins", n: rw.coins }].concat(Object.keys(rw.potions).map(function (k) { return { kind: "potion", id: k, n: rw.potions[k] }; })) });
    }
  }

  // ---- the tutorial moves on by what's happened -----------------------------------------------------
  function tutorial(s, now, events) {
    while (s.tut != null && s.tut < TUTORIAL.length) {
      var step = TUTORIAL[s.tut].id, stove = s.items.filter(function (it) { return it.kind === "stove"; })[0];
      var st = stove ? stoveOf(stove, now) : { status: "free" };
      var done = step === "cook" ? st.status !== "free" || s.stats.cooked > 0
        : step === "wait" ? st.status !== "cooking"
        : step === "serve" ? allPlates(s).some(function (o) { return o.pl.dish; }) || s.stats.served > 0 || st.status === "dirty"
        : step === "clean" ? st.status !== "dirty"
        : step === "customer" ? s.stats.served > 0
        : !!s.collected;
      if (!done) return;
      s.tut++;
      if (s.tut >= TUTORIAL.length) finishTutorial(s, events);
    }
  }
  function finishTutorial(s, events) {
    s.tut = null;
    var need = Math.max(0, XP[2] - s.xp);
    addXp(s, need, events);
    events.push({ kind: "tutorial-done" });
  }

  // ---- what you can do ---------------------------------------------------------------------------
  function act(state, action, opts, now) {
    opts = opts || {};
    var s = advance(state, now), ev = [], lv;
    var done = function (msg) { tutorial(s, now, ev); note(s, now, msg); return { ok: true, msg: msg, state: s, events: ev }; };
    if (action === "start") {
      if (s.made) return no(s, "Your café is open already.");
      s = fresh(now);
      s.name = String(opts.name || "").trim().slice(0, 32) || "The Corner Café";
      return done("Welcome to " + s.name + ".");
    }
    if (!s.made) return no(s, "Open your café first.");
    lv = levelOf(s.xp);

    if (action === "tick") return done("");
    if (action === "lesson") {                                     // (2026-11-08) Rosa's lesson on a feature, read
      if (["halfwalls"].indexOf(opts.id) < 0) return no(s, "There's no such lesson.");
      s.lessons = s.lessons || {}; s.lessons[opts.id] = true; return done("");
    }
    if (action === "diaryRead") { s.diarySeen = s.diaryN || 0; return done(""); }   // (2026-11-07) the diary's been read
    if (action === "cartLoad") {                                   // {dish} -- or every dish on the order
      var cc = s.cart;
      if (!cc || cc.done) return no(s, "There's no cart out the front.");
      var tl = cc.order.filter(function (l) { return l.got < l.n && (!opts.dish || l.dish === opts.dish); });
      if (!tl.length) { var fin = finishCart(s, ev); return fin ? done(fin) : no(s, "That's all loaded."); }
      var loaded = tl.reduce(function (a, l) { return a + loadCart(s, l, now); }, 0);
      if (!loaded) return no(s, opts.dish ? "There's no " + DISH[opts.dish].name.toLowerCase() + " on the counters to load." : "Nothing on the counters is on the order.");
      unpackFood(s, now);
      return done(finishCart(s, ev) || "Loaded " + loaded + " servings.");
    }
    // ---- the field across the street (2026-10-22) ----
    if (action === "plow") {                                       // {x, y}: dig a plot on that tile
      if (lv < FIELD.level) return no(s, "The plow comes at level " + FIELD.level + ".");
      var pn = s.field.length, cap = plotsAllowed(lv), pc = plotPrice(pn);
      if (pn >= cap) return no(s, "Your level allows " + cap + " plots" + (cap < 32 ? " -- more as you level up." : "."));
      var px2 = Math.floor(Number(opts.x)), py2 = Math.floor(Number(opts.y)), why5 = plotProblem(s, px2, py2);
      if (why5) return no(s, why5);
      if (s.coins < pc) return no(s, "Another plot costs " + pc + " coins; you have " + s.coins + ".");
      s.coins -= pc; s.field.push({ uid: ++s.seq, x: px2, y: py2, paid: pc });
      return done(pc ? "Dug for " + pc + " coins." : "Dug.");
    }
    if (action === "plotMove" || action === "plotRemove") {          // {uid, x, y} / {uid}: a plot moves (crop and all), or goes
      var pq = s.field.filter(function (p) { return p.uid === opts.uid; })[0];
      if (!pq) return no(s, "There's no plot there.");
      if (action === "plotMove") {
        var mx = Math.floor(Number(opts.x)), my = Math.floor(Number(opts.y)), why6 = plotProblem(s, mx, my, pq.uid);
        if (why6) return no(s, why6);
        pq.x = mx; pq.y = my;
        return done("");
      }
      var back2 = Math.floor((pq.paid || 0) / 2);
      s.field = s.field.filter(function (p) { return p !== pq; }); s.coins += back2;
      return done("The plot's filled in" + (back2 ? " -- " + back2 + " coins back." : ".") + (pq.crop ? " (What was growing there is gone.)" : ""));
    }
    if (action === "plant") {                                      // {plot: uid, crop}: a packet if you have one, else Giles's seed
      var cr = CROP[opts.crop], pt = s.field.filter(function (p) { return p.uid === opts.plot; })[0];
      if (!cr) return no(s, "There's no such crop.");
      if (!pt) return no(s, "There's no plot there.");
      if (pt.crop) return no(s, "Something's growing there.");
      if (lv < cr.level) return no(s, cr.name + " come at level " + cr.level + ".");
      var packet = (s.seeds[cr.id] || 0) > 0;
      if (!packet && s.coins < cr.seed) return no(s, cr.name + " seed costs " + cr.seed + " coins; you have " + s.coins + ".");
      if (packet) { s.seeds[cr.id]--; if (!s.seeds[cr.id]) delete s.seeds[cr.id]; } else s.coins -= cr.seed;
      pt.crop = cr.id; pt.at = now; delete pt.last;
      return done(cr.name + " sown" + (packet ? " (a packet you had)." : "."));
    }
    if (action === "harvest" || action === "harvestAll") {             // {plot} -- or every ripe plot
      var mine = function (p) { return action === "harvestAll" || p.uid === opts.plot; };
      // gone over (2026-10-23): picking clears the plot, with nothing to show for it
      var over = s.field.filter(function (p) { var o = cropOf(p, now); return mine(p) && o && o.spoiled; });
      over.forEach(function (p) { p.last = p.crop; delete p.crop; delete p.at; });
      if (over.length) { s.stats.spoiledCrops = (s.stats.spoiledCrops || 0) + over.length; ev.push({ kind: "cleared", plots: over.map(function (p) { return { uid: p.uid, crop: p.last }; }) }); }
      var ripe = s.field.filter(function (p) { var o = cropOf(p, now); return mine(p) && o && o.ready; });
      var lost = over.length ? (over.length === 1 ? "The " + CROP[over[0].last].name.toLowerCase() + " had gone over -- plot cleared." : over.length + " plots had gone over -- cleared.") : "";
      if (!ripe.length) return over.length ? done(lost) : no(s, action === "harvest" ? "That isn't ready yet." : "Nothing's ready to pick.");
      var got4 = {}, xp4 = 0;
      ripe.forEach(function (p) { var c = CROP[p.crop]; got4[c.id] = (got4[c.id] || 0) + c.yield; s.pantry[c.id] = (s.pantry[c.id] || 0) + c.yield; xp4 += c.xp; delete p.crop; delete p.at; p.last = c.id; });
      addXp(s, xp4, ev);
      ev.push({ kind: "harvest", got: got4, xp: xp4, plots: ripe.map(function (p) { return { uid: p.uid, crop: p.last }; }) });
      s.stats.harvested = (s.stats.harvested || 0) + ripe.length;
      return done("Picked " + Object.keys(got4).map(function (k) { return got4[k] + " " + CROP[k].name.toLowerCase(); }).join(", ") + " -- into the pantry." + (lost ? " " + lost : ""));
    }
    if (action === "eggs") {                                         // {uid}: collect a coop's eggs
      var cp = s.decor.filter(function (o) { return o.uid === opts.uid && DECO[o.id] && DECO[o.id].coop; })[0];
      if (!cp) return no(s, "There's no coop there.");
      var ne = takeEggs(s, cp, now);
      if (!ne) return no(s, "No eggs yet -- the hens are working on it.");
      addXp(s, ne * COOP.xp, ev);
      s.stats.eggs = (s.stats.eggs || 0) + ne;
      ev.push({ kind: "eggs", uid: cp.uid, n: ne, xp: ne * COOP.xp });
      return done(ne + " egg" + (ne > 1 ? "s" : "") + " into the pantry.");
    }
    if (action === "hauntOpen") {                                  // {id}: open an event house to the public (HAUNT)
      var HH = HAUNT[opts.id];
      if (!HH) return no(s, "That house can't open to the public.");
      if (s.haunts[opts.id]) return no(s, "It's open to the public already.");
      if (!(s.decor || []).some(function (o) { return o.id === opts.id; })) return no(s, "Put " + HH.says + " on your street first.");
      if (s.coins < HH.price) return no(s, "Opening " + HH.says + " costs " + HH.price + " coins.");
      s.coins -= HH.price;
      s.haunts[opts.id] = { since: now, last: now, visitors: 0, earned: 0 };
      var hr = function (h) { return (h % 12 || 12) + (h < 12 ? " am" : " pm"); };
      return done("The doors of " + HH.says + " are open -- every night from " + hr(HH.from) + " to " + hr(HH.to) + ".");
    }
    if (action === "feastSeen") { if (s.feast) s.feast.seen = true; return done(""); }
    if (action === "aunty") {
      if (!s.aunty || !s.aunty.box) return no(s, s.tut != null ? "Aunty's first box comes after the tutorial." : "No delivery yet.");
      if (s.aunty.opened) return no(s, "You've opened today's box -- Aunty sends another tomorrow.");
      var bx = openAunty(s, now);
      ev.push({ kind: "aunty", say: bx.say, sign: AUNTY.sign, gifts: bx.gifts, first: s.aunty.count === 1 });
      return done("Aunty's box, opened.");
    }
    if (action === "skipTutorial") { if (s.tut == null) return no(s, "There's no tutorial on."); finishTutorial(s, ev); return done("Tutorial skipped."); }

    if (action === "cook") {
      var st = byUid(s, opts.uid), d = DISH[opts.dish];
      if (!cooks(st)) return no(s, "That isn't a stove.");
      if (!d) return no(s, "There's no such dish.");
      // V24 q8: an outdoor dish only on its appliance, and an appliance cooks only its own book
      if (cookerOf(d) !== st.kind) return no(s, cookerOf(d) === "stove" ? d.name + " is cooked on a stove, inside." : THINGS[cookerOf(d)].bar ? d.name + " is made at the " + THINGS[cookerOf(d)].name.toLowerCase() + "." : d.name + " is cooked on the " + THINGS[cookerOf(d)].name.toLowerCase() + ", out on the patio.");
      if (stoveOf(st, now).status !== "free") return no(s, "That stove's busy.");
      if (!canCook(s, d, lv)) return no(s, d.event ? d.name + " is unlocked with Halloween candy at the haunted house." : d.secret ? d.name + " is one of Aunty's secret recipes -- she hasn't sent it to you yet." : d.name + " comes at level " + d.level + ".");
      if (s.tut != null && s.tut < TUTORIAL.length && d.id !== "pancakes") return no(s, "Start with the pancakes.");
      var cost = d.cost, fromField = opts.field !== false && hasAll(s, d);
      // the field (2026-10-22): every ingredient in the pantry -- they're used, the dish costs nothing, its servings sell for more
      if (fromField) cost = 0;
      // never stuck: with no coins and nothing going, the cheapest dish is on the house
      if (s.coins < cost && d === DISHES[0] && !s.till && !allPlates(s).some(function (o) { return o.pl.dish; }) && !s.items.some(function (it) { return cooks(it) && it.dish; })) cost = 0;
      if (s.coins < cost) return no(s, d.name + " costs " + cost + " coins to make; you have " + s.coins + ".");
      s.coins -= cost;
      if (fromField) Object.keys(d.needs).forEach(function (c) { s.pantry[c] -= d.needs[c]; if (!s.pantry[c]) delete s.pantry[c]; });
      var ms = mastered(s, d.id);                                   // its stars, as they are when it goes on
      st.dish = d.id; st.start = now; st.paid = cost; st.last = d.id; st.secs = ms.secs; st.serv = ms.servings; st.farm = fromField;
      st.safe = ms.noburn || (s.tut != null && s.tut < TUTORIAL.length) || isBar(st);    // (V26 q6: a bar's never burns)
      if (s.sandbox && s.dev) { if (s.dev.instant) st.start = now - ms.secs * SEC; if (s.dev.noburn) st.safe = true; }
      s.stats.cooked++;
      return done("Cooking " + d.name.toLowerCase() + (fromField ? " with your own harvest -- free, and it sells for more." : "."));
    }
    if (action === "serve") {
      var sv = byUid(s, opts.uid), sx = cooks(sv) ? stoveOf(sv, now) : null;
      if (!sx || sx.status !== "ready") return no(s, "There's nothing ready on that stove.");
      var dd = sx.dish, made = sv.serv || dd.servings, where, toCart = "";
      if (ownTop(sv)) {                                            // V26 q6: onto its own top
        var top = sv.plates[0];
        if (top.dish && top.dish !== dd.id && top.n > 0) return no(s, "There's still " + DISH[top.dish].name.toLowerCase() + " on the " + THINGS[sv.kind].name.toLowerCase() + " -- it goes on when that's sold.");
        if (top.dish !== dd.id) { top.dish = dd.id; top.n = 0; top.farm = 0; top.fres = 0; top.res = 0; }
        top.n += made; top.since = now; where = "top";
      } else where = placeFood(s, dd.id, made, now, sv.farm ? made : 0);
      var onShelf = where === "top" && !ownTop(sv) ? s.items.filter(function (it2) { return shelfTakes(it2, dd.id) && it2.plates.some(function (pl) { return pl.dish === dd.id; }); })[0] : null;
      var cold = where === "cold";
      // 2026-10-22 (Cam, emergency fix): counters and fridges all full -- straight from the stove onto the request cart,
      // if its order wants this dish; the tutor buys any servings past the order at the usual price (no bonus)
      var cl = !where && s.cart && !s.cart.done ? s.cart.order.filter(function (l) { return l.dish === dd.id && l.got < l.n; })[0] : null;
      if (cl) {
        var ct = Math.min(made, cl.n - cl.got), extra = made - ct, xpay = extra * priceOf(s, dd.id), TC = TUTOR[s.cart.tutor];
        cl.got += ct;
        if (extra) { s.coins += xpay; s.stats.earned += xpay; s.stats.served += extra; }
        toCart = ct + " servings of " + dd.name.toLowerCase() + " straight onto " + TC.name + "'s cart" + (extra ? " (" + TC.name + " bought the other " + extra + " for " + xpay + " coins)" : "") + ".";
        where = "cart";
      }
      if (!where) return no(s, s.items.some(function (it) { return serves(it) && underCap(it) > 0; }) ? "No room on the counters or in their fridges -- sell what's on them, or buy another." : "No serving counter is free -- sell what's on them, buy another, or fit a fridge component (Upgrades) to keep a dish under one.");
      sv.dish = null; sv.start = 0; sv.safe = false; sv.dirty = !sv.selfclean && !isBar(sv); sv.secs = 0; sv.serv = 0; sv.farm = false;
      // mastery: this cook counts; a new star says what it brings
      var was = starsOf(s, dd.id);
      s.mastery = s.mastery || {}; s.mastery[dd.id] = cooksOf(s, dd.id) + (sv.mx || 1); sv.mx = 0;
      var now2 = starsOf(s, dd.id);
      if (now2 > was) ev.push({ kind: "mastery", dish: dd.id, name: dd.name, stars: now2, perk: MASTERY.perks[now2 - 1] });
      if (sv.selfclean || isBar(sv)) { addXp(s, CLEAN_XP, ev); ev.push({ kind: "xp", n: CLEAN_XP, uid: sv.uid }); }
      // PT50 (Cam, over V21 q1): XP comes from SERVING the dish again, and a little from cleaning the stove after it
      addXp(s, dd.xp, ev); ev.push({ kind: "xp", n: dd.xp, uid: sv.uid });
      if (eventOn(s, now)) { s.candy += EVENT.serve; ev.push({ kind: "candy", n: EVENT.serve, uid: sv.uid }); }   // (Halloween)
      if (s.next == null) s.next = now + 2 * SEC;
      if (toCart) { ev.push({ kind: "tocart", msg: toCart, uid: sv.uid }); var fin = finishCart(s, ev); return done(fin ? toCart + " " + fin : toCart); }
      return done(made + " servings of " + dd.name.toLowerCase() + (cold ? " in the fridge, under the counter." : ownTop(sv) ? " on the " + THINGS[sv.kind].name.toLowerCase() + "." : onShelf ? " on the " + THINGS[onShelf.kind].name.toLowerCase() + "." : " on the counter."));
    }
    if (action === "cancel") {                                      // 2026-10-21 (Cam): stop a dish cooking; its coins are gone
      var sk = byUid(s, opts.uid), sq2 = cooks(sk) ? stoveOf(sk, now) : null;
      if (!sq2 || sq2.status !== "cooking") return no(s, "Nothing's cooking there.");
      if (s.tut != null && s.tut < TUTORIAL.length) return no(s, "Let Rosa's pancakes finish first.");
      sk.dish = null; sk.start = 0; sk.safe = false; sk.paid = 0; sk.farm = false; sk.mx = 0;
      s.stats.cancelled = (s.stats.cancelled || 0) + 1;
      return done(sq2.dish.name + " cancelled -- the stove's free.");
    }
    if (action === "throw") {
      var sb = byUid(s, opts.uid);
      if (!cooks(sb) || stoveOf(sb, now).status !== "burnt") return no(s, "Nothing's burnt there.");
      sb.dish = null; sb.start = 0; sb.dirty = !sb.selfclean; sb.farm = false; sb.mx = 0;
      if (sb.selfclean) { addXp(s, CLEAN_XP, ev); ev.push({ kind: "xp", n: CLEAN_XP, uid: sb.uid }); }
      s.stats.burnt++;
      return done("Into the bin.");
    }
    if (action === "clean") {
      var sc = byUid(s, opts.uid);
      if (!sc || !sc.dirty) return no(s, "That's clean already.");
      sc.dirty = false;
      // PT50: a little XP for every clean -- even after a burnt dish there's something to show for it
      addXp(s, CLEAN_XP, ev); ev.push({ kind: "xp", n: CLEAN_XP, uid: sc.uid });
      return done("Sparkling.");
    }
    // ---- potions (V23 q4) and binning a spoiled dish (q5) ----
    if (action === "usePotion") {
      var pk = opts.kind, P2 = POTIONS[pk], tg = byUid(s, opts.uid);
      if (!P2) return no(s, "There's no such potion.");
      if (!(s.inv[pk] > 0)) return no(s, "You have no " + P2.name.toLowerCase() + "s -- they come with levelling up.");
      // V25 q1: the candy store's potions work on the whole café
      if (pk === "golden" || pk === "crowd") {
        s.boost = s.boost || {}; s.boost[pk] = Math.max(now, s.boost[pk] || 0) + P2.spell;
        if (pk === "crowd") s.next = Math.min(s.next || now + 2 * SEC, now + 2 * SEC);
        s.inv[pk]--;
        return done(pk === "golden" ? "Golden tips: every tip doubled for an hour." : "Here they come -- twice the customers for 15 minutes.");
      }
      if (pk === "chef" || pk === "mastery") {
        var on = s.items.filter(function (it) { return cooks(it) && stoveOf(it, now).status === "cooking"; });
        if (!on.length) return no(s, "Nothing's cooking -- put something on first.");
        on.forEach(function (it) { if (pk === "chef") it.start = now - stoveOf(it, now).secs * SEC; else it.mx = 2; });
        s.inv[pk]--;
        return done(pk === "chef" ? "Everything cooking is ready." : "Every dish cooking now counts twice towards its stars.");
      }
      // (2026-11-07, Cam: "for unspoil potion make it work for plants only"): {plot} -- a crop gone over is ripe again,
      // with its full time to be picked
      if (pk === "fresh") {
        var fp = (s.field || []).filter(function (p) { return p.uid === opts.plot; })[0], fo = cropOf(fp, now);
        if (!fo || !fo.spoiled) return no(s, "A fresh potion is for a plot whose crop has gone over.");
        fp.at = now - fo.crop.mins * MIN;
        s.inv[pk]--;
        return done("The " + fo.crop.name.toLowerCase() + " is fresh again, ready to pick.");
      }
      if (!tg) return no(s, "Use it on a stove or a counter.");
      if (pk === "quick") {
        var sq = cooks(tg) ? stoveOf(tg, now) : null;
        if (!sq || sq.status !== "cooking") return no(s, "A quick potion is for a stove that's cooking.");
        tg.start = now - sq.secs * SEC;
      } else {
        var pls = plates(tg).filter(function (pl) { return pl.dish && pl.n - (pl.res || 0) > 0; });
        if (!pls.length) return no(s, "A sell potion is for a counter with food on it.");
        var pl2 = pls[0];
        {
          var take2 = pl2.n - (pl2.res || 0), fk = Math.max(0, (pl2.farm || 0) - (pl2.fres || 0)), got3 = (take2 - fk) * priceOf(s, pl2.dish) + fk * farmPrice(s, pl2.dish);
          pl2.farm = pl2.fres || 0;
          s.till += got3; s.stats.served += take2; s.stats.earned += got3;
          pl2.n -= take2; fixFarm(pl2); if (!pl2.n) { pl2.dish = null; pl2.res = 0; pl2.since = 0; fixFarm(pl2); restock(tg, now); }
          ev.push({ kind: "coins", n: got3, uid: tg.uid });
        }
      }
      s.inv[pk]--;
      return done(pk === "quick" ? "Ready!" : "Sold -- the coins are in the till.");
    }
    if (action === "hangCard") {                                    // V25 q5: {key, card} -- the Major Arcana card in a tarot frame
      var hp3 = PAINTING[s.hang[opts.key]];
      if (!hp3 || !hp3.card) return no(s, "That's not a tarot frame.");
      if (!cardOK(opts.card)) return no(s, "There's no such card in the Major Arcana.");
      s.hangCard[opts.key] = opts.card;
      delete s.hangPhoto[opts.key];                                // (2026-10-26: picking a card puts it back in place of your photo)
      return done("");
    }
    if (action === "candyStore") {                                  // V25 q1: {id} -- a potion (or the lucky dip) for candy
      var cs2 = CANDY_STORE.filter(function (x) { return x.id === opts.id; })[0];
      if (!cs2) return no(s, "There's no such potion at the candy store.");
      if (!hasMansion(s)) return no(s, "Build the haunted house first (Build > Buildings, in October).");
      if (!eventOn(s, now)) return no(s, "The candy store is closed till next October.");
      if (!catalogueDone(s)) return no(s, "The candy store opens when everything in the Halloween catalogue is yours.");
      if (s.candy < cs2.candy) return no(s, cs2.name + " takes " + cs2.candy + " candy; you have " + s.candy + ".");
      if (cs2.id === "lucky") {
        var won = luckyDip(s);
        if (!won) return no(s, "There's nothing rare left for the lucky dip to find -- you have it all!");
        s.candy -= cs2.candy;
        ev.push({ kind: "lucky", what: won });
        diary(s, now, { kind: "lucky", who: "lucky", icon: "🎁", title: "A lucky dip", says: "From the candy store, for " + cs2.candy + " candy.", gains: [{ kind: "text", text: won.charAt(0).toUpperCase() + won.slice(1) }] });
        return done("Lucky dip: " + won + "!");
      }
      s.candy -= cs2.candy; s.inv[cs2.id] = (s.inv[cs2.id] || 0) + 1;
      return done("A " + cs2.name.toLowerCase() + " -- it's in your Bag.");
    }
    if (action === "candyBuy") {                                    // {id}: unlock a Halloween thing for good, with candy
      var ex = EVENT_ITEM[opts.id];
      if (!ex) return no(s, "There's no such thing at the mansion.");
      if (!hasMansion(s)) return no(s, "Build the haunted house first (Build > Buildings, in October).");
      if (!eventOn(s, now)) return no(s, "The haunted house is closed till next October.");
      if (s.eventGot.indexOf(ex.id) >= 0) return no(s, ex.name + " is yours already.");
      if (s.candy < ex.candy) return no(s, ex.name + " takes " + ex.candy + " candy; you have " + s.candy + ".");
      s.candy -= ex.candy; s.eventGot.push(ex.id);
      if (ex.kind === "dish" && s.secrets.indexOf(ex.id) < 0) s.secrets.push(ex.id);
      ev.push({ kind: "unlock", id: ex.id });
      return done(ex.name + " is yours for good -- " + (ex.kind === "dish" ? "it's in the cookbook's Halloween tab." : ex.kind === "wall" ? "it's in Build > Walls." : ex.kind === "rail" ? "buy it at the furniture store's Half walls page." : ex.kind === "guest" ? "look out for them at dusk and after dark." : ex.kind === "street" ? "it's in Buy > Outside." : "it's in Buy > Events > Halloween."));
    }
    if (action === "tip") {                                         // N42: the coins a sitter left on a table
      var tt = byUid(s, opts.uid);
      if (!tt || (!tt.tip && !tt.candy)) return no(s, "No tip on that table.");
      var tn = tt.tip || 0, tc = tt.candy || 0;
      s.coins += tn; s.stats.tips = (s.stats.tips || 0) + tn; delete tt.tip;
      if (tc) { s.candy += tc; delete tt.candy; ev.push({ kind: "candy", n: tc, uid: tt.uid }); }
      if (tn) ev.push({ kind: "tip", n: tn, uid: tt.uid });
      return done("");
    }
    if (action === "collect") {
      if (!s.till) return no(s, "The till's empty.");
      var got = s.till;
      s.coins += got; s.till = 0;
      ev.push({ kind: "coins", n: got });
      s.collected = true;
      return done("You took " + got + " coins from the till.");
    }
    // ---- open and closed (2026-10-21, Cam): closed, no new customers come in -- those inside finish, the stoves keep
    // cooking and the food waits on the counters; it stays closed while you're away until you open again
    if (action === "setOpen") {
      var want = !!opts.open;
      if (!want && s.tut != null && s.tut < TUTORIAL.length) return no(s, "Finish the tutorial first -- it needs a customer.");
      if (want === !s.closed) return done("");
      s.closed = !want;
      s.next = want && rate(s) > 0 ? now + 2 * SEC : null;
      return done(want ? "The café is open." : "The café is closed -- no new customers until you open again.");
    }
    // Settings (PT52): the music -- on or off, and how loud (0-1). Nothing to do with the game, kept with the save.
    if (action === "prefs") {
      var pr = prefs(s);
      if (typeof opts.music === "boolean") pr.music = opts.music;
      if (typeof opts.vol === "number" && isFinite(opts.vol)) pr.vol = Math.max(0, Math.min(1, opts.vol));
      if (typeof opts.src === "string" && /^(radio|game:(lofi|jazz)|pl:[a-z0-9]{6,40})$/.test(opts.src)) pr.src = opts.src;
      if (typeof opts.shuffle === "boolean") pr.shuffle = opts.shuffle;
      if (FX.indexOf(opts.fx) >= 0) pr.fx = opts.fx;
      if (typeof opts.sfx === "boolean") pr.sfx = opts.sfx;
      if (typeof opts.happen === "boolean") pr.happen = opts.happen;
      if (typeof opts.sfxVol === "number" && isFinite(opts.sfxVol)) pr.sfxVol = Math.max(0, Math.min(1, opts.sfxVol));
      s.prefs = pr;
      return done("");
    }
    if (action === "name") {
      var nm = String(opts.name || "").trim().slice(0, 32);
      if (!nm) return no(s, "Your café needs a name.");
      s.name = nm;
      return done("");
    }

    // ---- building mode ----
    if (action === "buy") {
      var T = THINGS[opts.kind];
      if (!T || opts.kind === "till") return no(s, "That's not for sale.");
      if (T.sandbox && !s.sandbox) return no(s, "The " + T.name.toLowerCase() + " is only in the sandbox for now.");
      if (T.divider) return no(s, "Dividers are half walls now: build them in Build > Half walls (their styles are at the furniture store).");
      if (!eventGot(s, Object.assign({ id: opts.kind }, T))) return no(s, "Unlock the " + T.name.toLowerCase() + " with candy at the haunted house first.");
      if (T.level && lv < T.level) return no(s, "The " + T.name.toLowerCase() + " comes at level " + T.level + ".");
      if (count(s, opts.kind) >= allowedHere(s, opts.kind, lv)) return no(s, COUNTERS.indexOf(opts.kind) >= 0
        ? "You have all the counters your level allows -- a buffet counter is one of them."
        : "You have all the " + T.name.toLowerCase() + "s your level allows.");
      if (s.coins < T.price) return no(s, "A " + T.name.toLowerCase() + " costs " + T.price + " coins; you have " + s.coins + ".");
      s.coins -= T.price;
      s.ware[opts.kind] = (s.ware[opts.kind] || 0) + 1;
      return done("A new " + T.name.toLowerCase() + " is in the warehouse.");
    }
    if (action === "place") {                                       // from the warehouse onto a tile
      var k = opts.kind;
      if (!s.ware[k]) return no(s, "There's no " + (THINGS[k] ? THINGS[k].name.toLowerCase() : "such thing") + " in the warehouse.");
      var it = { uid: s.seq + 1, kind: k, x: opts.x, y: opts.y, dir: (opts.dir | 0) % (THINGS[k].turns || 4) };
      if (k === "buffet") it.plates = [{ dish: null, n: 0 }, { dish: null, n: 0 }];
      if (THINGS[k].bar && !THINGS[k].prep) it.plates = [{ dish: null, n: 0 }];
      if (THINGS[k].shelf) it.plates = emptyPlates(THINGS[k].slots);
      var why = fitProblem(s, it, s.items) || layoutProblem(s, s.items.concat([it]));
      if (why) return no(s, why);
      s.seq++;
      if (thingGrowMax(k) && opts.scale > 0) it.scale = Math.min(thingGrowMax(k), opts.scale | 0);
      s.items.push(it);
      s.ware[k]--;
      if (!s.ware[k]) delete s.ware[k];
      return done("");
    }
    if (action === "scale") {                                       // {uid, by: 1 | -1}: a thing a size bigger or smaller (its tile stays its tile)
      var sz = byUid(s, opts.uid);
      if (!sz) return no(s, "There's nothing there.");
      var smax = thingGrowMax(sz.kind);
      if (!smax) return no(s, "That one only comes in the one size.");
      var sn = Math.max(0, Math.min(smax, (sz.scale | 0) + (opts.by < 0 ? -1 : 1)));
      if (sn === (sz.scale | 0)) return no(s, sn ? "That's as big as it goes." : "That's as small as it goes.");
      if (sn) sz.scale = sn; else delete sz.scale;
      return done("");
    }
    if (action === "move") {
      var mv = byUid(s, opts.uid);
      if (!mv) return no(s, "There's nothing there.");
      // 2026-10-21 (play test team): turned with the arrow keys while it's carried -- it lands facing the new way
      var mturns = THINGS[mv.kind] && THINGS[mv.kind].turns || 4;
      var there = { uid: mv.uid, kind: mv.kind, x: opts.x, y: opts.y, dir: opts.dir == null ? mv.dir : (opts.dir | 0) % mturns };
      var moved = s.items.map(function (o) { return o === mv ? there : o; });
      var why2 = fitProblem(s, there, s.items) || layoutProblem(s, moved);
      if (why2) return no(s, why2);
      mv.x = opts.x; mv.y = opts.y; mv.dir = there.dir;
      return done("");
    }
    // 2026-10-24 (Cam: swatches, a colour slider -- the sandbox first): a thing with a recolourable part (THINGS .tint:
    // its fabric, tools/make_cafe_fabric.py) keeps a colour shift -- h a hue turn in degrees, s saturation, b brightness;
    // {0, 1, 1} is as painted. Free for now. A thing stored goes back to its painted colour.
    // ---- half walls (2026-11-08): {walls: [{x, y, dir}], style, tint?, tint2?} built along the tiles' edges, HALF_WALL.seg
    // coins each -- an edge with a wall already takes the new look for nothing; {walls} taken down, their coins back.
    // Every run is checked as a whole: customers must still reach every counter and the till, and a seat at a table
    // stays one (a wall can't come between them).
    if (action === "halfWall") {
      if (lv < HALF_WALL.level && !s.sandbox) return no(s, "Half walls come at level " + HALF_WALL.level + ".");
      var hs = HALF_WALL_OF[opts.style];
      if (!hs) return no(s, "There's no such half wall.");
      if (!hwOwned(s, hs.id)) return no(s, hs.name + " isn't yours yet: buy it at the furniture store.");
      var want = (Array.isArray(opts.walls) ? opts.walls : []).slice(0, 200).map(function (w) { return { x: w.x | 0, y: w.y | 0, dir: w.dir ? 1 : 0 }; });
      if (!want.length) return no(s, "Click a line between two tiles.");
      var have = hwSet(s), seen = {}, put = [], fresh2 = 0, why = "";
      want.forEach(function (w) {
        var k = hwKey(w.x, w.y, w.dir);
        if (seen[k]) return; seen[k] = true;
        var p = hwEdgeProblem(s, w);
        if (p) { why = why || p; return; }
        put.push(w); if (!have[k]) fresh2++;
      });
      if (!put.length) return no(s, why || "There's nowhere to build there.");
      var cost = fresh2 * HALF_WALL.seg;
      if (s.coins < cost) return no(s, (fresh2 === 1 ? "A half wall costs " : fresh2 + " half walls cost ") + cost + " coins; you have " + s.coins + ".");
      var look = { style: hs.id };
      if (opts.tint && typeof opts.tint === "object") look.tint = { h: +opts.tint.h || 0, s: +opts.tint.s || 1, b: +opts.tint.b || 1, sw: opts.tint.sw ? String(opts.tint.sw).slice(0, 20) : undefined };
      if (opts.tint2 && typeof opts.tint2 === "object") look.tint2 = { h: +opts.tint2.h || 0, s: +opts.tint2.s || 1, b: +opts.tint2.b || 1, sw: opts.tint2.sw ? String(opts.tint2.sw).slice(0, 20) : undefined };
      var keys = {}; put.forEach(function (w) { keys[hwKey(w.x, w.y, w.dir)] = true; });
      var before = s.hwalls, seatsBefore = s.items.filter(function (o) { return isSeat(o) && seatFor(s, o); }).length;
      s.hwalls = before.filter(function (w) { return !keys[hwKey(w.x, w.y, w.dir)]; }).concat(put.map(function (w) { return Object.assign({ x: w.x, y: w.y, dir: w.dir }, look); }));
      var lp = layoutProblem(s, s.items);
      if (!lp && s.items.filter(function (o) { return isSeat(o) && seatFor(s, o); }).length < seatsBefore) lp = "That would come between a seat and its table.";
      if (lp) { s.hwalls = before; return no(s, lp.replace(/ there\.$/, " with a half wall there.")); }
      s.coins -= cost;
      hwReroute(s);
      return done(fresh2 ? (fresh2 === 1 ? "A half wall" : fresh2 + " half walls") + " built" + (cost ? " (" + cost + " coins)." : ".") : "Half walls changed to " + hs.name.toLowerCase() + ".");
    }
    if (action === "halfWallRemove") {
      var gone = {}; (Array.isArray(opts.walls) ? opts.walls : []).forEach(function (w) { gone[hwKey(w.x | 0, w.y | 0, w.dir ? 1 : 0)] = true; });
      var keep = s.hwalls.filter(function (w) { return !gone[hwKey(w.x, w.y, w.dir)]; }), n = s.hwalls.length - keep.length;
      if (!n) return no(s, "There's no half wall there.");
      s.hwalls = keep; s.coins += n * HALF_WALL.seg;
      return done((n === 1 ? "A half wall" : n + " half walls") + " taken down (" + n * HALF_WALL.seg + " coins back).");
    }
    if (action === "buyPaint" || action === "buyMixer" || action === "buyCounterStyle" || action === "buyHalfWall") {
      if (!furnStore(s)) return no(s, "Put a furniture store out on your street first (Buy > Outside).");
      if (action === "buyHalfWall") {
        var hb = HALF_WALL_OF[opts.id];
        if (!hb || !hb.price) return no(s, "There's no such half wall to buy.");
        if (!eventGot(s, hwEv(hb))) return no(s, "Unlock the " + hb.name.toLowerCase() + " with candy at the haunted house first.");
        if (hwOwned(s, hb.id)) return no(s, hb.name + " is yours already.");
        if (lv < hb.level) return no(s, hb.name + " comes at level " + hb.level + ".");
        if (s.coins < hb.price) return no(s, hb.name + " costs " + hb.price + " coins; you have " + s.coins + ".");
        s.coins -= hb.price; s.hwStyles[hb.id] = true;
        return done(hb.name + " is yours: build it in Build > Half walls.");
      }
      if (action === "buyCounterStyle") {                           // (Cam: "the old counter styles ... a tab at the furniture store")
        var cst = COUNTER_STYLES.filter(function (x) { return x.id === opts.id && x.price; })[0];
        if (!cst) return no(s, "There's no such counter style.");
        var cown = s.owned.counters = s.owned.counters || [];
        if (cown.indexOf(cst.id) >= 0) return no(s, cst.name + " is yours already.");
        if (lv < cst.level) return no(s, cst.name + " comes at level " + cst.level + ".");
        if (s.coins < cst.price) return no(s, cst.name + " costs " + cst.price + " coins; you have " + s.coins + ".");
        s.coins -= cst.price; cown.push(cst.id);
        return done(cst.name + " is yours: a swatch on every counter.");
      }
      if (action === "buyMixer") {
        if (s.mixer) return no(s, "You have the paint mixer.");
        if (s.coins < MIXER.price) return no(s, "The paint mixer costs " + MIXER.price + " coins; you have " + s.coins + ".");
        s.coins -= MIXER.price; s.mixer = true;
        return done("The paint mixer is yours: the colour sliders are open.");
      }
      var bp = PAINT_OF[opts.id];
      if (!bp) return no(s, "There's no such paint.");
      if (hasPaint(s, bp.id)) return no(s, bp.id + " is yours already.");
      if (s.coins < bp.price) return no(s, bp.id + " costs " + bp.price + " coins; you have " + s.coins + ".");
      s.coins -= bp.price; s.paints = (s.paints || []).concat([bp.id]);
      return done(bp.id + " is yours, for every piece of furniture.");
    }
    // a counter style on one counter (2026-10-24): one you own -- "wood" is plain, as painted. It takes the place of any paint.
    if (action === "counterStyle") {
      var cs2 = byUid(s, opts.uid), cst2 = COUNTER_STYLES.filter(function (x) { return x.id === opts.id; })[0];
      if (!cs2 || COUNTERS.indexOf(cs2.kind) < 0) return no(s, "That isn't a counter.");
      if (!cst2) return no(s, "There's no such counter style.");
      if (cst2.price && (s.owned.counters || []).indexOf(cst2.id) < 0) return no(s, cst2.name + " isn't yours yet: it's sold at the furniture store.");
      delete cs2.tint;
      if (cst2.id === "wood") delete cs2.cstyle; else cs2.cstyle = cst2.id;
      return done("");
    }
    if (action === "tint") {
      var ti = byUid(s, opts.uid);
      if (!ti || !THINGS[ti.kind] || !THINGS[ti.kind].tint) return no(s, "That can't be recoloured.");
      var two = opts.part === 2 || opts.part === "2", tk = two ? "tint2" : "tint";
      if (two && !THINGS[ti.kind].tint2) return no(s, "That has only one colour.");
      if (!two) delete ti.cstyle;                                             // (a paint over a counter style: back to plain wood, painted)
      var th = Math.round(+opts.h || 0), ts = +opts.s, tb = +opts.b;
      // (white paint and black iron are tinted first, so they need more: saturation to 4, brightness to 3.5)
      th = ((th % 360) + 360) % 360; ts = isFinite(ts) ? Math.max(0, Math.min(4, ts)) : 1; tb = isFinite(tb) ? Math.max(0.3, Math.min(3.5, tb)) : 1;
      var tsw = typeof opts.sw === "string" && /^[A-Za-z ]{1,20}$/.test(opts.sw) ? opts.sw : "";      // the swatch's name, if one was picked
      // (as painted is always yours; a swatch needs its paint; anything else is the mixer's)
      if ((th || ts !== 1 || tb !== 1) && (tsw ? !hasPaint(s, tsw) : !hasMixer(s)))
        return no(s, tsw ? tsw + " isn't yours yet: it comes " + (PAINT_OF[tsw].level ? "at level " + PAINT_OF[tsw].level + ", or " : "") + "from the furniture store or in Aunty's box."
                         : "Mixing your own colours needs the paint mixer, from the furniture store.");
      if (!th && ts === 1 && tb === 1) delete ti[tk];
      else { ti[tk] = { h: th, s: Math.round(ts * 100) / 100, b: Math.round(tb * 100) / 100 }; if (tsw) ti[tk].sw = tsw; }
      return done("");
    }
    if (action === "rotate") {
      var ro = byUid(s, opts.uid);
      if (!ro) return no(s, "There's nothing there.");
      var turns = THINGS[ro.kind] && THINGS[ro.kind].turns || 4;
      var turned = { uid: ro.uid, kind: ro.kind, x: ro.x, y: ro.y, dir: ((ro.dir | 0) + (opts.by === -1 ? turns - 1 : 1)) % turns };   // by -1: the other way
      var why3 = fitProblem(s, turned, s.items) || layoutProblem(s, s.items.map(function (o) { return o === ro ? turned : o; }));
      if (why3) return no(s, "No room to turn it there: " + why3.charAt(0).toLowerCase() + why3.slice(1));
      ro.dir = turned.dir;
      return done("");
    }
    if (action === "upgrade") {                                     // 2026-10-21 (Cam): fit an upgrade to a stove or counter
      var ug = byUid(s, opts.uid), U = UPGRADES[opts.part];
      if (!U) return no(s, "There's no such upgrade.");
      if (!ug || U.on.indexOf(ug.kind) < 0) return no(s, "The " + U.name.toLowerCase() + " goes on a " + (U.on[0] === "stove" ? "stove or an outdoor appliance." : U.on[0] === "till" ? "cash register." : "counter."));
      if (ug[U.id]) return no(s, "That has one already.");
      if (lv < U.level) return no(s, "The " + U.name.toLowerCase() + " comes at level " + U.level + ".");
      if (s.parts[U.id] > 0) { s.parts[U.id]--; if (!s.parts[U.id]) delete s.parts[U.id]; }
      else { if (s.coins < U.price) return no(s, "The " + U.name.toLowerCase() + " costs " + U.price + " coins; you have " + s.coins + "."); s.coins -= U.price; }
      ug[U.id] = true;
      if (U.id === "fridge") ug.under = ug.under || [];
      if (U.id === "selfclean" && ug.dirty) { ug.dirty = false; }
      if (U.id === "cashier") return done("Your Head cashier starts work: every 10 minutes the stalls' coins come into the till.");
      return done(U.id === "fridge" ? "Fridge fitted -- " + (underCap(ug) === 2 ? "two dishes" : "a dish") + " can wait under it." : "The stove cleans itself now.");
    }
    if (action === "store" || action === "sell") {
      var sto = byUid(s, opts.uid);
      if (!sto) return no(s, "There's nothing there.");
      if (sto.kind === "till") return no(s, "The cash register stays.");
      if (cooks(sto) && (sto.dish || sto.dirty)) return no(s, "Finish with that stove first (cook, serve and clean).");
      if (plates(sto).some(function (pl) { return pl.dish; }) || (sto.under || []).length) return no(s, "Sell what's on that counter first" + ((sto.under || []).length ? " (and in its fridge)." : "."));
      var same = COUNTERS.indexOf(sto.kind) >= 0 ? COUNTERS : [sto.kind];
      if ((sto.kind === "stove" || same === COUNTERS) && s.items.filter(function (o) { return same.indexOf(o.kind) >= 0; }).length === 1) return no(s, "Keep at least one " + (same.length > 1 ? "counter" : THINGS[sto.kind].name.toLowerCase()) + " out.");
      s.items.splice(s.items.indexOf(sto), 1);
      if (sto.tip) { s.coins += sto.tip; ev.push({ kind: "tip", n: sto.tip, uid: sto.uid }); }
      Object.keys(UPGRADES).forEach(function (u) { if (sto[u]) s.parts[u] = (s.parts[u] || 0) + 1; });   // kept as a spare part
      if (action === "store") { s.ware[sto.kind] = (s.ware[sto.kind] || 0) + 1; return done(THINGS[sto.kind].name + " stored."); }
      var back = Math.floor(THINGS[sto.kind].price / 2);
      s.coins += back;
      return done(THINGS[sto.kind].name + " sold for " + back + " coins.");
    }
    if (action === "sellWare") {
      if (!s.ware[opts.kind]) return no(s, "There's none in the warehouse.");
      s.ware[opts.kind]--;
      if (!s.ware[opts.kind]) delete s.ware[opts.kind];
      var b2 = Math.floor(THINGS[opts.kind].price / 2);
      s.coins += b2;
      return done(THINGS[opts.kind].name + " sold for " + b2 + " coins.");
    }
    // ---- the sandbox's dev tools (PT41-PT43): only ever in the sandbox (cafe.py keeps it apart from your café) ----
    if (action === "dev") {
      if (!s.sandbox) return no(s, "Dev tools are for the sandbox.");
      s.dev = s.dev || {};
      var op = opts.op, nv = Math.round(Number(opts.n) || 0);
      if (op === "level") { var L = Math.max(1, Math.min(MAX_LEVEL, nv)); if (s.tut != null) s.tut = null; s.xp = XP[L]; ev.push({ kind: "level", level: L, unlocks: [] }); return done("Level " + L + "."); }
      if (op === "coins") { s.coins = Math.max(0, nv); return done("Coins set to " + s.coins + "."); }
      if (op === "addCoins") { s.coins = Math.max(0, s.coins + nv); return done(""); }
      if (op === "paints") { s.dev.allPaints = !s.dev.allPaints; return done(s.dev.allPaints ? "Every paint and the mixer, for trying." : "Paints as you've earned them."); }
      if (op === "everything") { s.tut = null; s.dev.allPaints = true; s.xp = XP[MAX_LEVEL]; s.coins = Math.max(s.coins, 1000000); setSize(s, Math.max(s.size, BIGGEST)); return done("Everything unlocked: level " + MAX_LEVEL + ", a million coins, the biggest café."); }
      if (op === "size") { var z = EXPANSIONS.some(function (e) { return e.size === nv; }) ? nv : START.size;
        if (z < s.size && s.items.some(function (it) { return cells(it).some(function (c) { return (c.x >= z && c.x < s.size) || c.y >= z; }); })) return no(s, "Move things off the outer row first.");
        if (s.patio && s.patio.door >= z) s.patio.door = z - 1;
        setSize(s, z); clearDecor(s); clearPatio(s); return done("The café is " + z + "x" + z + "."); }
      if (op === "event") { s.dev.event = s.dev.event === "on" ? "off" : s.dev.event === "off" ? "" : "on"; return done(s.dev.event ? "Halloween " + s.dev.event + " (dev)." : "Halloween by the calendar."); }
      if (op === "candy") { s.candy = Math.max(0, s.candy + nv); return done(""); }
      if (op === "candySet") { s.candy = Math.max(0, Math.round(nv)); return done(""); }
      if (op === "instant" || op === "noburn" || op === "busy" || op === "rush") { s.dev[op] = !s.dev[op]; return done(""); }
      if (op === "seeds") { CROPS.forEach(function (c) { if (lv >= c.level) s.seeds[c.id] = (s.seeds[c.id] || 0) + 5; }); return done("Five packets of every seed you can grow."); }
      if (op === "eggs") { s.decor.forEach(function (o) { if (DECO[o.id] && DECO[o.id].coop) { o.eggs = COOP.nest; o.since = now; } }); return done("The nests are full."); }
      if (op === "over") { s.field.forEach(function (pl) { if (pl.crop) pl.at = now - CROP[pl.crop].mins * MIN - keepOf(CROP[pl.crop]) - SEC; }); return done("Everything in the field has gone over."); }
      if (op === "grow") { s.field.forEach(function (pl) { if (pl.crop) pl.at = now - CROP[pl.crop].mins * MIN; }); return done("Everything in the field is ripe."); }
      if (op === "cart") { if (s.cart) s.cart.done = true; s.cart = newCart(s, dayOf(now), now); if (opts.v && TUTOR[opts.v]) s.cart.tutor = opts.v; return done(TUTOR[s.cart.tutor].name + " has pulled up out the front."); }
      if (op === "aunty") { s.aunty = s.aunty || { count: 0 }; s.aunty.day = null; auntyToday(s, now); return done("A box from Aunty."); }
      if (op === "potions") { s.inv = s.inv || {}; ["fresh", "quick", "sell"].forEach(function (k) { s.inv[k] = (s.inv[k] || 0) + 5; }); return done("Five of each potion."); }
      if (op === "mastery") {                                       // every dish you can cook goes up a star
        DISHES.forEach(function (d) { if (canCook(s, d, lv)) { var st3 = starsOf(s, d.id); if (st3 < 5) s.mastery[d.id] = masteryNeed(d)[st3]; } });
        return done("Every dish you can cook is a star better.");
      }
      if (op === "happen") {                                        // (2026-11-07) a happening now: a random one, or {v: its id}
        var hp = happen(s, now, opts.v && HAPPENING[opts.v] ? opts.v : null);
        return hp ? done(hp.icon + " " + hp.title) : no(s, "Nothing can happen just now.");
      }
      if (op === "finish") { s.items.forEach(function (it) { if (cooks(it) && it.dish) { var sd = it.secs || DISH[it.dish].secs; if (now < it.start + sd * SEC) it.start = now - sd * SEC; it.safe = true; } }); return done("Everything on the stoves is ready."); }
      if (op === "clean") { s.items.forEach(function (it) { if (cooks(it)) { it.dirty = false; if (it.dish && stoveOf(it, now).status === "burnt") { it.dish = null; it.start = 0; } } }); return done("Every stove is clean."); }
      if (op === "fill") {
        var open = DISHES.filter(function (d) { return canCook(s, d, lv); }), k2 = 0;
        allPlates(s).forEach(function (o) { if (!o.pl.dish) { var fd = open[k2++ % open.length]; o.pl.dish = fd.id; o.pl.n = fd.servings; o.pl.res = 0; o.pl.farm = 0; o.pl.fres = 0; } });
        if (s.next == null) s.next = now + SEC;
        return done("Every counter has food on it.");
      }
      if (op === "sell" || op === "sellAll") {                // PT44: sell a dish (or everything) on the counters at once
        var sold = 0;
        allPlates(s).forEach(function (o) {
          if (!o.pl.dish || (op === "sell" && o.pl.dish !== opts.dish)) return;
          var take = o.pl.n - (o.pl.res || 0);
          if (take <= 0) return;
          var fk2 = Math.max(0, (o.pl.farm || 0) - (o.pl.fres || 0)), pp = (take - fk2) * priceOf(s, o.pl.dish) + fk2 * farmPrice(s, o.pl.dish);
          s.till += pp; s.stats.served += take; s.stats.earned += pp; sold += take;
          o.pl.n -= take; o.pl.farm = o.pl.fres || 0; fixFarm(o.pl);
          if (!o.pl.n) { o.pl.dish = null; o.pl.res = 0; fixFarm(o.pl); restock(o.it, now); }
        });
        return sold ? done(sold + " servings sold -- the coins are in the till.") : no(s, "There's nothing like that on the counters.");
      }
      if (op === "sky") { s.dev.sky = ["day", "dusk", "night"].indexOf(opts.v) >= 0 ? opts.v : ""; return done(""); }
      if (op === "customers") { if (!food(s).length) return no(s, "Put some food out first."); var cn = Math.max(1, Math.min(3, nv || 3)), en = [0, 1];
        for (var q2 = 0; q2 < cn && s.customers.length < crowd(s); q2++) spawn(s, now + q2 * GROUP_GAP, en); return done(""); }
      if (op === "skip") {                                  // time passes: everything's clock moves on
        var dt = Math.max(0, Math.min(24 * 60 * MIN, nv * SEC));
        s.items.forEach(function (it) { if (it.start) it.start -= dt; });
        s.customers.forEach(function (c) { ["at", "take", "pay", "gone"].forEach(function (f) { c[f] -= dt; }); });
        if (s.next != null) s.next -= dt;
        s.at -= dt;
        s = advance(s, now);
        return done("");
      }
      return no(s, "That dev tool doesn't exist.");
    }
    if (action === "machineCollect") {
      var mc = byUid(s, opts.uid);
      if (!mc || !MACHINES[mc.kind]) return no(s, "That isn't a coin machine.");
      if (!mc.coins) return no(s, MACHINES[mc.kind].play ? "No one's played it yet." : "No coins in it yet -- people drop some in when they get up from a seat.");
      var mn = mc.coins; mc.coins = 0;
      s.coins += mn; s.stats.earned += mn;
      ev.push({ kind: "coins", n: mn, uid: mc.uid });
      return done("The " + THINGS[mc.kind].name.toLowerCase() + " had " + mn + " coins in it.");
    }
    if (action === "vendCollect") {
      var vm = byUid(s, opts.uid);
      if (!isVend(vm)) return no(s, "That isn't a vending machine.");
      var got2 = vendTakings(vm);
      if (!got2) return no(s, "Nothing in it yet -- it fills " + VEND.coins + " coins every " + VEND.every / 60000 + " minutes while you're open.");
      vm.sold = 0;
      s.coins += got2; s.stats.earned += got2;
      ev.push({ kind: "coins", n: got2, uid: vm.uid });
      return done("The " + THINGS[vm.kind].name.toLowerCase() + " had " + got2 + " coins in it.");
    }
    // ---- V26: refill a machine, a cart or the cinema's reel (q1) ----
    if (action === "refill") {
      var rf = opts.decor != null ? (s.decor || []).filter(function (o) { return o.uid === opts.decor; })[0] : byUid(s, opts.uid);
      if (!refills(rf)) return no(s, "That doesn't take refills.");
      var rname = rf.id ? DECO[rf.id].name.toLowerCase() : THINGS[rf.kind].name.toLowerCase();
      if (!dryAt(s, rf)) return no(s, "The " + rname + " isn't empty yet.");
      var rin = takingsOf(rf), net = rin - refillCut(rin);
      if (net < 0 && s.coins < -net) return no(s, "Refilling the " + rname + " costs " + (-net) + " coins; you have " + s.coins + ".");
      if (isVend(rf)) rf.sold = 0; else rf.coins = 0;
      rf.used = 0; rf.tick = 0; if (rf.id === "cinema") rf.shows = 0;
      s.coins += net; if (net > 0) s.stats.earned += net;
      s.stats.refills = (s.stats.refills || 0) + 1;
      if (net) ev.push({ kind: "coins", n: net, uid: rf.id ? 0 : rf.uid, decor: rf.id ? rf.uid : 0 });
      var what = rf.id === "cinema" ? "A new film reel in" : CARTS[rf.id] ? "Restocked the" : "Refilled the";
      return done(what + " " + rname + (net > 0 ? " -- " + net + " coins out (" + (rin - net) + " for the refill)." : net < 0 ? " for " + (-net) + " coins." : "."));
    }
    if (action === "stallCollect") {                               // a cart's or the cinema's coins, before it runs dry
      var sc = (s.decor || []).filter(function (o) { return o.uid === opts.uid; })[0];
      if (!isStall(sc)) return no(s, "That isn't a stall.");
      if (!sc.coins) return no(s, sc.id === "cinema" ? "No film's been shown yet -- they're at 7, 9 and 11 pm." : "Nothing sold yet.");
      var sn = sc.coins; sc.coins = 0;
      s.coins += sn; s.stats.earned += sn;
      ev.push({ kind: "coins", n: sn, decor: sc.uid });
      return done("The " + DECO[sc.id].name.toLowerCase() + " had " + sn + " coins in it.");
    }
    // ---- the café's wallpaper and counter style (N36): buy once, then switch freely between those you own ----
    if (action === "style") {
      if (opts.what === "counters") return no(s, "Counter styles are at the furniture store now, a counter at a time.");
      var list = STYLE_LISTS[opts.what], st2 = list && list.filter(function (x) { return x.id === opts.id; })[0];
      if (!st2) return no(s, "There's no such style.");
      if (!eventGot(s, st2)) return no(s, "Unlock " + st2.name.toLowerCase() + " with candy at the haunted house first.");
      if (lv < st2.level) return no(s, st2.name + " comes at level " + st2.level + ".");
      var own = s.owned[opts.what] = s.owned[opts.what] || [];
      if (own.indexOf(st2.id) < 0 && st2.price) {
        if (s.coins < st2.price) return no(s, st2.name + " costs " + st2.price + " coins; you have " + s.coins + ".");
        s.coins -= st2.price; own.push(st2.id);
      }
      s.style[opts.what] = st2.id;
      if (opts.what === "wall") s.walls = {};                     // the whole café: every panel, as one
      return done("");
    }
    // ---- wallpaper a panel at a time (N43, Cam: "walls should allow this as well" -- like the floors). PT52 (Cam: "I still
    // have to buy the whole wallpaper set before I can use it"): a panel costs its own price (panelPrice, a fifth of the
    // wallpaper's), like a floor tile; a wallpaper you own -- bought for the whole café -- is laid for free. Panels: "l<row>" along the left wall (the
    // door's included), "r<column>" along the right; unpapered ones show the café's wallpaper.
    // ---- paintings (V22 q3): hung on a panel -- from storage if there's one, else bought; taken down to storage, moved,
    // or sold for half. Not on the door's panel, one to a panel.
    var panelOK = function (side, i) { return (side === "l" || side === "r") && i >= 0 && i < s.size && !(side === "l" && i === s.door); };
    if (action === "hang") {
      var pa = PAINTING[opts.id], hk = opts.side + (opts.i | 0);
      if (!pa) return no(s, "There's no such painting.");
      if (pa.sandbox && !s.sandbox) return no(s, pa.name + " is only in the sandbox for now.");
      if (pa.vale && !valeHas(s, pa.id) && !((s.pware || {})[pa.id] > 0)) return no(s, "Win the " + pa.name.toLowerCase() + " from a NeuroVale order first.");
      if (!panelOK(opts.side, opts.i | 0)) return no(s, "Paintings go on a wall panel -- not the door.");
      if (s.hang[hk]) return no(s, "There's a painting there already.");
      if (pa.kit && Object.keys(s.hang).some(function (k) { return s.hang[k] === pa.id; })) return no(s, "You have a " + pa.name.toLowerCase() + " up already.");
      var inStore = (s.pware[pa.id] || 0) > 0;
      if (!inStore) {
        if (!eventGot(s, pa)) return no(s, "Unlock " + pa.name + " with candy at the haunted house first.");
        if (lv < pa.level) return no(s, pa.name + " comes at level " + pa.level + ".");
        if (s.coins < pa.price) return no(s, pa.name + " costs " + pa.price + " coins; you have " + s.coins + ".");
        s.coins -= pa.price;
      } else { s.pware[pa.id]--; if (!s.pware[pa.id]) delete s.pware[pa.id]; }
      s.hang[hk] = pa.id;
      if (pa.photo && photoIdOK(opts.photo)) s.hangPhoto[hk] = opts.photo;   // (a photo frame: the photo you picked in it)
      return done("");
    }
    if (action === "hangTint") {                                   // PT56 (Cam: "photo frames to have swatches"): {key, h, s, b, sw}
      var hk2 = String(opts.key || ""), hp = s.hang[hk2];
      if (!hp || !PAINTING[hp] || !(PAINTING[hp].photo || PAINTING[hp].framed)) return no(s, "Only a framed picture takes a paint.");
      var hh = ((Math.round(+opts.h || 0) % 360) + 360) % 360, hs = isFinite(+opts.s) ? Math.max(0, Math.min(4, +opts.s)) : 1, hb = isFinite(+opts.b) ? Math.max(0.3, Math.min(3.5, +opts.b)) : 1;
      var hsw = typeof opts.sw === "string" && /^[A-Za-z ]{1,20}$/.test(opts.sw) ? opts.sw : "";
      if ((hh || hs !== 1 || hb !== 1) && (hsw ? !hasPaint(s, hsw) : !hasMixer(s)))
        return no(s, hsw ? hsw + " isn't yours yet: it comes " + (PAINT_OF[hsw].level ? "at level " + PAINT_OF[hsw].level + ", or " : "") + "from the furniture store or in Aunty's box."
                         : "Mixing your own colours needs the paint mixer, from the furniture store.");
      if (!hh && hs === 1 && hb === 1) delete s.hangTint[hk2];
      else { s.hangTint[hk2] = { h: hh, s: Math.round(hs * 100) / 100, b: Math.round(hb * 100) / 100 }; if (hsw) s.hangTint[hk2].sw = hsw; }
      return done("");
    }
    if (action === "halfWallTint") {                               // 2026-11-08 (Cam: "change the indoor half walls with different
      var hw = hwSet(s)[hwKey(opts.x | 0, opts.y | 0, opts.dir ? 1 : 0)];   // colors as i could with the old dividers"): one
      if (!hw) return no(s, "There's no half wall there.");          // piece's paint, {x, y, dir, part, h, s, b, sw}, free like a thing's
      var hk = opts.part === 2 || opts.part === "2" ? "tint2" : "tint";
      var hh = ((Math.round(+opts.h || 0) % 360) + 360) % 360, hs2 = isFinite(+opts.s) ? Math.max(0, Math.min(5, +opts.s)) : 1, hb2 = isFinite(+opts.b) ? Math.max(0.3, Math.min(3.5, +opts.b)) : 1;
      var hsw = typeof opts.sw === "string" && /^[A-Za-z ]{1,20}$/.test(opts.sw) ? opts.sw : "";
      if (hsw && PAINT_OF[hsw] && !hasPaint(s, hsw)) return no(s, hsw + " isn't yours yet: it comes " + (PAINT_OF[hsw].level ? "at level " + PAINT_OF[hsw].level + ", or " : "") + "from the furniture store or in Aunty's box.");
      if (!hsw && (hh || hs2 !== 1 || hb2 !== 1) && !hasMixer(s)) return no(s, "Mixing your own colours needs the paint mixer, from the furniture store.");
      var nw = Object.assign({}, hw);
      if (!hh && hs2 === 1 && hb2 === 1 && (!hsw || hsw === "Natural")) delete nw[hk];
      else { nw[hk] = { h: hh, s: Math.round(hs2 * 100) / 100, b: Math.round(hb2 * 100) / 100 }; if (hsw) nw[hk].sw = hsw; }
      s.hwalls = s.hwalls.map(function (w) { return w === hw ? nw : w; });
      return done("");
    }
    if (action === "wallTint") {                                   // 2026-10-25 (Cam: "edit swatches for the half wall"): the patio's
      if (!s.patio) return no(s, "You haven't a patio yet.");          // brick side wall, painted like a low brick wall: {part, h, s, b, sw}
      var wk = opts.part === 2 || opts.part === "2" ? "tint2" : "tint";
      var wh = ((Math.round(+opts.h || 0) % 360) + 360) % 360, ws = isFinite(+opts.s) ? Math.max(0, Math.min(4, +opts.s)) : 1, wb = isFinite(+opts.b) ? Math.max(0.3, Math.min(3.5, +opts.b)) : 1;
      var wsw = typeof opts.sw === "string" && /^[A-Za-z ]{1,20}$/.test(opts.sw) ? opts.sw : "";
      if ((wh || ws !== 1 || wb !== 1) && (wsw ? !hasPaint(s, wsw) : !hasMixer(s)))
        return no(s, wsw ? wsw + " isn't yours yet: it comes " + (PAINT_OF[wsw].level ? "at level " + PAINT_OF[wsw].level + ", or " : "") + "from the furniture store or in Aunty's box."
                         : "Mixing your own colours needs the paint mixer, from the furniture store.");
      if (!wh && ws === 1 && wb === 1) delete s.patio[wk];
      else { s.patio[wk] = { h: wh, s: Math.round(ws * 100) / 100, b: Math.round(wb * 100) / 100 }; if (wsw) s.patio[wk].sw = wsw; }
      return done("");
    }
    if (action === "unhang" || action === "sellHang" || action === "moveHang") {
      var fk = opts.from || (opts.side + (opts.i | 0)), pid2 = s.hang[fk];
      if (!pid2) return no(s, "There's no painting there.");
      if (action === "moveHang") {
        var tk = opts.side + (opts.i | 0);
        if (tk === fk) return done("");
        if (!panelOK(opts.side, opts.i | 0)) return no(s, "Paintings go on a wall panel -- not the door.");
        if (s.hang[tk]) return no(s, "There's a painting there already.");
        s.hang[tk] = pid2; delete s.hang[fk];
        if (s.hangPhoto[fk]) { s.hangPhoto[tk] = s.hangPhoto[fk]; delete s.hangPhoto[fk]; }
        if (s.hangCard[fk]) { s.hangCard[tk] = s.hangCard[fk]; delete s.hangCard[fk]; }
        if (s.hangTint[fk]) { s.hangTint[tk] = s.hangTint[fk]; delete s.hangTint[fk]; }
        if (s.hangOff[fk]) { s.hangOff[tk] = true; delete s.hangOff[fk]; }
        return done("");
      }
      delete s.hang[fk]; delete s.hangPhoto[fk]; delete s.hangTint[fk]; delete s.hangOff[fk]; delete s.hangCard[fk];
      if (action === "unhang") { s.pware[pid2] = (s.pware[pid2] || 0) + 1; return done(PAINTING[pid2].name + " is in storage."); }
      var half = Math.floor(PAINTING[pid2].price / 2);
      s.coins += half;
      return done(PAINTING[pid2].name + " sold for " + half + " coins.");
    }
    // ---- lights (2026-10-24): on and off -- a lamp (its pull cord), a wall light, one ceiling light, or all of the
    // ceiling's at once (the switch by the door: any on -> all off, else all on)
    if (action === "light") {
      if (opts.uid != null) {
        var lmp = byUid(s, opts.uid);
        if (!lmp || !THINGS[lmp.kind] || !THINGS[lmp.kind].lamp) return no(s, "That isn't a lamp.");
        if (lmp.off) delete lmp.off; else lmp.off = true;
        return done("");
      }
      if (opts.hang) {
        var wl = PAINTING[s.hang[opts.hang]];
        if (!wl || !wl.light) return no(s, "That isn't a wall light.");
        if (s.hangOff[opts.hang]) delete s.hangOff[opts.hang]; else s.hangOff[opts.hang] = true;
        return done("");
      }
      if (opts.ceil) {
        var cl = s.ceil[opts.ceil];
        if (!cl) return no(s, "There's no light there.");
        if (cl.off) delete cl.off; else cl.off = true;
        return done("");
      }
      if (opts.all === "ceil") {
        var cks = Object.keys(s.ceil);
        if (!cks.length) return no(s, "No ceiling lights yet -- they're in Buy, under Lighting.");
        var anyOn = cks.some(function (k) { return !s.ceil[k].off; });
        cks.forEach(function (k) { if (anyOn) s.ceil[k].off = true; else delete s.ceil[k].off; });
        return done(anyOn ? "Ceiling lights off." : "Ceiling lights on.");
      }
      return no(s, "Which light?");
    }
    // ---- ceiling lights: put up over a floor tile (from storage if there's one, else bought), moved, taken down, sold
    var ceilKey = function (x, y) { x = +x; y = +y; return x === Math.floor(x) && y === Math.floor(y) && x >= 0 && y >= 0 && x < s.size && y < s.size ? x + "," + y : ""; };
    if (action === "ceilPut") {
      var cp = CEIL[opts.id], ck = ceilKey(opts.x, opts.y);
      if (!cp) return no(s, "There's no such light.");
      if (!ck) return no(s, "Ceiling lights go over the café's floor.");
      if (s.ceil[ck]) return no(s, "There's a light there already.");
      if ((s.cware[cp.id] || 0) > 0) { s.cware[cp.id]--; if (!s.cware[cp.id]) delete s.cware[cp.id]; }
      else {
        if (lv < cp.level) return no(s, cp.name + " comes at level " + cp.level + ".");
        if (s.coins < cp.price) return no(s, cp.name + " costs " + cp.price + " coins; you have " + s.coins + ".");
        s.coins -= cp.price;
      }
      s.ceil[ck] = { id: cp.id };
      return done("");
    }
    if (action === "ceilMove" || action === "ceilTake" || action === "ceilSell") {
      var cf = s.ceil[opts.from];
      if (!cf) return no(s, "There's no light there.");
      if (action === "ceilMove") {
        var ct = ceilKey(opts.x, opts.y);
        if (!ct) return no(s, "Ceiling lights go over the café's floor.");
        if (ct === opts.from) return done("");
        if (s.ceil[ct]) return no(s, "There's a light there already.");
        s.ceil[ct] = cf; delete s.ceil[opts.from];
        return done("");
      }
      delete s.ceil[opts.from];
      if (action === "ceilTake") { s.cware[cf.id] = (s.cware[cf.id] || 0) + 1; return done(CEIL[cf.id].name + " is in storage."); }
      var chalf = Math.floor(CEIL[cf.id].price / 2);
      s.coins += chalf;
      return done(CEIL[cf.id].name + " sold for " + chalf + " coins.");
    }
    if (action === "sellCware") {
      if (!s.cware[opts.id]) return no(s, "There's none in storage.");
      s.cware[opts.id]--; if (!s.cware[opts.id]) delete s.cware[opts.id];
      var ch2 = Math.floor(CEIL[opts.id].price / 2);
      s.coins += ch2;
      return done(CEIL[opts.id].name + " sold for " + ch2 + " coins.");
    }
    if (action === "terrain") {                                    // {t: terrain id or "grass" (rubs out), r, pts: [[x, y], ...]}
      var tr = Math.max(0.2, Math.min(3, +opts.r || 1)), tp = (Array.isArray(opts.pts) ? opts.pts : []).slice(0, 600)
        .map(function (q) { return [fine(q[0]), fine(q[1])]; }).filter(function (q) { return isFinite(q[0]) && isFinite(q[1]) && q[0] > REACH[0] - 3 && q[1] > REACH[0] - 3 && q[0] < REACH[1] + 3 && q[1] < REACH[1] + 3; });
      if (!tp.length) return no(s, "Nowhere to paint.");
      if (opts.t === "level") {                                    // the Level: dug ground and water back to the ground's level
        var lv0 = s.terrain.length;
        s.terrain = s.terrain.filter(function (d) { return !((d[0] === "dug" || TERRAIN[d[0]].water) && tp.some(function (q) { return Math.hypot(d[1] - q[0], d[2] - q[1]) < tr * 0.8 + d[3] * 0.3; })); });
        return lv0 === s.terrain.length ? no(s, "") : done("");
      }
      if (opts.t === "grass") {
        var before = s.terrain.length;
        s.terrain = s.terrain.filter(function (d) { return !tp.some(function (q) { return Math.hypot(d[1] - q[0], d[2] - q[1]) < tr * 0.8 + d[3] * 0.3; }); });
        return before === s.terrain.length ? no(s, "") : done("");
      }
      var tt = TERRAIN[opts.t];
      if (!tt) return no(s, "There's no such ground.");
      if (lv < tt.level && !s.sandbox) return no(s, tt.name + " comes at level " + tt.level + ".");
      // (a dab painted over smaller ones it covers takes their place: the list stays short)
      s.terrain = s.terrain.filter(function (d) { return !tp.some(function (q) { return d[3] <= tr && Math.hypot(d[1] - q[0], d[2] - q[1]) + d[3] < tr * 0.9; }); });
      tp.forEach(function (q) { s.terrain.push([tt.id, q[0], q[1], Math.round(tr * 100) / 100]); });
      if (s.terrain.length > TERRAIN_MAX) s.terrain = s.terrain.slice(s.terrain.length - TERRAIN_MAX);
      return done("");
    }
    if (action === "deliver") {                                    // {uid}: a home's request, from the counters
      var hm = (s.decor || []).filter(function (o) { return o.uid === opts.uid && DECO[o.id] && DECO[o.id].home; })[0], hs = hm && s.homes[hm.uid];
      if (!hs || !hs.order) return no(s, "Nobody there's asked for anything right now.");
      var od = hs.order, have = loadable(s, od.dish, now);
      if (have < od.n) return no(s, "They want " + od.n + " " + DISH[od.dish].name.toLowerCase() + " -- you have " + have + " on the counters.");
      loadCart(s, { dish: od.dish, n: od.n, got: 0 }, now);
      s.coins += od.value; s.stats.earned += od.value; s.stats.served += od.n; s.stats.deliveries = (s.stats.deliveries || 0) + 1;
      addXp(s, od.xp, ev);
      hs.done = (hs.done || 0) + 1; hs.order = null;
      var hr = dayRng(s, hs.day, "next" + hm.uid + ":" + hs.done);
      hs.next = now + Math.round((HOME.next[0] + hr() * (HOME.next[1] - HOME.next[0])) * MIN);
      s.runs = (s.runs || []).filter(function (r2) { return now - r2.at < HOME.runFor; }).concat([{ to: hm.uid, x: hm.x, y: hm.y, at: now }]);
      ev.push({ kind: "delivered", uid: hm.uid, n: od.value, xp: od.xp });
      return done("Delivered " + od.n + " " + DISH[od.dish].name.toLowerCase() + ": +" + od.value + " coins, +" + od.xp + " XP." + (hs.done >= HOME.cap ? " That's all they'll order today." : ""));
    }
    if (action === "sellPware") {
      if (!s.pware[opts.id]) return no(s, "There's none in storage.");
      s.pware[opts.id]--; if (!s.pware[opts.id]) delete s.pware[opts.id];
      var h2 = Math.floor(PAINTING[opts.id].price / 2);
      s.coins += h2;
      return done(PAINTING[opts.id].name + " sold for " + h2 + " coins.");
    }
    if (action === "wallPaint") {
      var wpp = WALLPAPERS.filter(function (x) { return x.id === opts.id; })[0], side = opts.side, wi = opts.i | 0;
      if (!wpp) return no(s, "There's no such wallpaper.");
      if ((side !== "l" && side !== "r") || wi < 0 || wi >= s.size) return no(s, "That's not one of the café's walls.");
      if (lv < wpp.level) return no(s, wpp.name + " comes at level " + wpp.level + ".");
      var ownw = s.owned.wall || [], wkey = side + wi, now0 = s.walls[wkey] || s.style.wall || "plaster";
      if (now0 === wpp.id) return done("");
      var wcost = wpp.price && ownw.indexOf(wpp.id) < 0 ? panelPrice(wpp) : 0;
      if (s.coins < wcost) return no(s, "A panel of " + wpp.name.toLowerCase() + " costs " + wcost + " coins; you have " + s.coins + ".");
      s.coins -= wcost;
      if (wpp.id === (s.style.wall || "plaster")) delete s.walls[wkey]; else s.walls[wkey] = wpp.id;
      return done("");
    }
    // ---- floors ----
    if (action === "floorPaint" || action === "floorAll") {
      if (action === "floorPaint" && !inside(s, opts.x, opts.y)) {   // PT56: outside the café
        var ow = outFloorProblem(s, opts.x, opts.y), okey = opts.x + "," + opts.y;
        if (ow) return no(s, ow);
        if (opts.id === "grass") { delete s.outFloors[okey]; return done(""); }
        var of2 = FLOOR[opts.id];
        if (!of2) return no(s, "There's no such floor.");
        if (lv < of2.level) return no(s, of2.name + " comes at level " + of2.level + ".");
        if (s.outFloors[okey] === of2.id) return done("");
        var ocost = Math.max(OUT_FLOOR, of2.price);
        if (s.coins < ocost) return no(s, "A tile of " + of2.name.toLowerCase() + " outside costs " + ocost + " coins; you have " + s.coins + ".");
        s.coins -= ocost;
        s.outFloors[okey] = of2.id;
        return done("");
      }
      var fl = FLOOR[opts.id];
      if (!fl) return no(s, opts.id === "grass" ? "Grass only goes outside." : "There's no such floor.");
      if (fl.patio && (action === "floorAll" || !inPatio(s, opts.x, opts.y))) return no(s, fl.name + " is for the patio.");
      if (lv < fl.level) return no(s, fl.name + " comes at level " + fl.level + ".");
      var tiles = [];
      if (action === "floorAll") { for (var fy = 0; fy < s.size; fy++) for (var fx = 0; fx < s.size; fx++) tiles.push(fx + "," + fy); }
      else tiles.push(opts.x + "," + opts.y);
      tiles = tiles.filter(function (k3) { var q3 = k3.split(",").map(Number); return (s.floors[k3] || (inPatio(s, q3[0], q3[1]) ? "deck" : s.floor || "grey")) !== fl.id; });
      if (!tiles.length) return done("");
      var fcost = tiles.length * fl.price;
      if (s.coins < fcost) return no(s, (tiles.length > 1 ? tiles.length + " tiles of " : "") + fl.name.toLowerCase() + " cost" + (tiles.length > 1 ? "" : "s") + " " + fcost + " coins; you have " + s.coins + ".");
      s.coins -= fcost;
      tiles.forEach(function (k3) { s.floors[k3] = fl.id; });
      return done("");
    }
    // ---- Build > Select: {op: "move" | "copy" | "remove", x0, y0, x1, y1 (the box, in tiles), dx, dy (whole tiles), free} ----
    if (action === "area") {
      var pk = areaPick(s, opts), any = pk.decor.length + pk.plots.length + pk.floors.length + pk.dabs.length;
      if (!any) return no(s, "There's nothing outside the café in that box.");
      var sd = s.decor.filter(function (o) { return pk.decor.indexOf(o.uid) >= 0; }), sp = s.field.filter(function (p) { return pk.plots.indexOf(p.uid) >= 0; });
      if (opts.op === "remove") {                                  // street things to storage, plots filled in (half back), the rest back to grass
        var back3 = 0;
        sd.forEach(function (o) { if (DECO[o.id].coop) takeEggs(s, o, now); s.dware[o.id] = (s.dware[o.id] || 0) + 1; });
        sp.forEach(function (p) { back3 += Math.floor((p.paid || 0) / 2); });
        var lost = sp.some(function (p) { return p.crop; });
        s.decor = s.decor.filter(function (o) { return sd.indexOf(o) < 0; });
        s.field = s.field.filter(function (p) { return sp.indexOf(p) < 0; });
        pk.floors.forEach(function (k) { delete s.outFloors[k]; });
        s.terrain = s.terrain.filter(function (d, i) { return pk.dabs.indexOf(i) < 0; });
        s.coins += back3;
        return done("Cleared" + (sd.length ? " -- the street things are in storage" : "") + (back3 ? ", " + back3 + " coins back for the plots" : "") + "." + (lost ? " (What was growing there is gone.)" : ""));
      }
      if (opts.op !== "move" && opts.op !== "copy") return no(s, "Move, copy or clear?");
      var dx = Math.round(Number(opts.dx) || 0), dy = Math.round(Number(opts.dy) || 0), copy = opts.op === "copy", afree = !!opts.free;
      if (!dx && !dy) return copy ? no(s, "Drag the copy to where it goes.") : done("");
      // what each moved or copied thing is checked against: everything else (a copy: the originals too); the selection
      // keeps its own spacing, so it isn't checked against itself
      var t = copy ? s : Object.assign({}, s, { decor: s.decor.filter(function (o) { return sd.indexOf(o) < 0; }), field: s.field.filter(function (p) { return sp.indexOf(p) < 0; }) });
      var skip = [], plotsSkip = 0, cost = 0, coops = s.decor.filter(function (o) { return DECO[o.id] && DECO[o.id].coop; }).length, plotsN = s.field.length;
      var cd = sd.filter(function (o) {
        if (!copy) return true;
        var d = DECO[o.id], why0 = d.store || d.mansion || d.house ? "you can only have one" : d.vale ? "it only comes from NeuroVale" : lv < d.level ? "it comes at level " + d.level
          : d.sandbox && !s.sandbox ? "it's only in the sandbox" : !eventGot(s, d) ? "it's unlocked at the haunted house" : d.coop && coops >= coopsAllowed(s) ? "that's all the coops for now" : "";
        if (why0) { var sk = d.name.toLowerCase() + " (" + why0 + ")"; if (skip.indexOf(sk) < 0) skip.push(sk); return false; }
        if (d.coop) coops++;
        cost += d.price;
        return true;
      });
      for (var ai = 0; ai < cd.length; ai++) {
        var ao = cd[ai], aw = decorProblem(t, ao.id, ao.x + dx, ao.y + dy, copy ? undefined : ao.uid, ao.dir, afree);
        if (aw) return no(s, "The " + DECO[ao.id].name.toLowerCase() + " can't go there: " + aw.charAt(0).toLowerCase() + aw.slice(1));
      }
      var cp = sp.filter(function (p) {
        if (!copy) return true;
        if (plotsN >= plotsAllowed(lv)) { plotsSkip++; return false; }
        cost += plotPrice(plotsN++);
        return true;
      });
      if (plotsSkip) skip.push(plotsSkip + " plot" + (plotsSkip > 1 ? "s" : "") + " (that's all your level allows)");
      for (var aj = 0; aj < cp.length; aj++) {
        var aq = plotProblem(t, cp[aj].x + dx, cp[aj].y + dy, copy ? undefined : cp[aj].uid);
        if (aq) return no(s, "A plot can't go there: " + aq.charAt(0).toLowerCase() + aq.slice(1));
      }
      for (var ak = 0; ak < pk.floors.length; ak++) {
        var fq = pk.floors[ak].split(",").map(Number), fx2 = fq[0] + dx, fy2 = fq[1] + dy;
        var fw = inside(s, fx2, fy2) ? "That's inside the café." : outFloorProblem(s, fx2, fy2);
        if (fw) return no(s, "A floor tile can't go there: " + fw.charAt(0).toLowerCase() + fw.slice(1));
        if (copy) cost += Math.max(OUT_FLOOR, (FLOOR[s.outFloors[pk.floors[ak]]] || {}).price || 0);
      }
      if (copy && s.coins < cost) return no(s, "Copying that costs " + cost + " coins; you have " + s.coins + ".");
      var floors2 = {};
      pk.floors.forEach(function (k) { var q = k.split(",").map(Number); floors2[(q[0] + dx) + "," + (q[1] + dy)] = s.outFloors[k]; });
      var inReach = function (d) { return d[1] > REACH[0] - 3 && d[2] > REACH[0] - 3 && d[1] < REACH[1] + 3 && d[2] < REACH[1] + 3; };
      var dabs2 = pk.dabs.map(function (i) { var d = s.terrain[i]; return [d[0], fine(d[1] + dx), fine(d[2] + dy), d[3]]; }).filter(inReach);
      if (copy) {
        s.coins -= cost;
        cd.forEach(function (o) {
          var no2 = clone(o);                                     // (its paint, a lamp on or off ... -- not its eggs)
          delete no2.eggs; delete no2.since;
          Object.assign(no2, { uid: ++s.seq, x: fine(o.x + dx), y: fine(o.y + dy) });
          if (DECO[o.id].coop) Object.assign(no2, { since: now, eggs: 0 });
          if (DECO[o.id].home) s.homes[no2.uid] = { day: dayOf(now), done: 0, next: now + HOME.first * MIN, order: null };
          s.decor.push(no2);
        });
        var pn2 = s.field.length;
        cp.forEach(function (p) { s.field.push({ uid: ++s.seq, x: p.x + dx, y: p.y + dy, paid: plotPrice(pn2++) }); });
        s.terrain = s.terrain.concat(dabs2);
        if (s.terrain.length > TERRAIN_MAX) s.terrain = s.terrain.slice(s.terrain.length - TERRAIN_MAX);
      } else {
        sd.forEach(function (o) { o.x = fine(o.x + dx); o.y = fine(o.y + dy); });
        sp.forEach(function (p) { p.x += dx; p.y += dy; });
        pk.floors.forEach(function (k) { delete s.outFloors[k]; });
        s.terrain = s.terrain.filter(function (d, i) { return pk.dabs.indexOf(i) < 0; }).concat(dabs2);
      }
      Object.keys(floors2).forEach(function (k) { s.outFloors[k] = floors2[k]; });
      var res = done(copy ? "Copied" + (cost ? " for " + cost + " coins" : "") + "." + (skip.length ? " Not copied: " + skip.join(", ") + "." : "") : "");
      res.cost = cost;
      return res;
    }
    // ---- street things ----
    if (action === "decorPlace") {                                // from the warehouse if there's one, else bought
      var dd2 = DECO[opts.id];
      if (!dd2) return no(s, "There's no such thing.");
      if (lv < dd2.level) return no(s, dd2.name + " comes at level " + dd2.level + ".");
      if (dd2.vale && !(s.dware[dd2.id] > 0)) return no(s, dd2.name + " only comes from NeuroVale -- a tutor leaves one now and then.");
      if (dd2.sandbox && !s.sandbox) return no(s, "The " + dd2.name.toLowerCase() + " is only in the sandbox for now.");
      if (dd2.store && furnStore(s)) return no(s, "You have a furniture store already.");
      if (dd2.mansion && hasMansion(s)) return no(s, "You have a haunted house already.");
      if (dd2.mansion && !mansionTime(s, now) && !(s.dware[dd2.id] > 0)) return no(s, "The haunted house can only be built in October.");
      if (dd2.house && !dd2.mansion && (s.decor || []).some(function (o) { return o.id === dd2.id; })) return no(s, "You have " + (dd2.id === "santa" ? "Santa's house" : "a " + dd2.name.toLowerCase()) + " already.");
      if (dd2.house && !dd2.mansion && !houseTime(s, dd2.house, now) && !(s.dware[dd2.id] > 0)) {
        var hc = CALENDAR.filter(function (e) { return e.id === dd2.house; })[0];
        return no(s, dd2.name + " can only be built while " + (hc ? hc.name : "its event") + " is on.");
      }
      if (!eventGot(s, dd2) && !(s.dware[dd2.id] > 0)) return no(s, "Unlock the " + dd2.name.toLowerCase() + " with candy at the haunted house first.");
      var free = !!opts.free, px = free ? fine(opts.x) : snap(opts.x), py = free ? fine(opts.y) : snap(opts.y);
      if (dd2.fence && !free) { var fs = fenceAt(px, py, opts.dir); px = fs.x; py = fs.y; opts.dir = fs.dir; }
      if (FOOT[dd2.id] && !free) { var ba = buildingAt(dd2.id, px, py, opts.dir); px = ba.x; py = ba.y; }
      var why4 = decorProblem(s, dd2.id, px, py, undefined, opts.dir, free, growMax(dd2.id) ? opts.scale | 0 : 0);
      if (why4) return no(s, why4);
      if (dd2.stall && s.decor.filter(function (o) { return o.id === dd2.id; }).length >= cartsAllowed(dd2, lv)) return no(s, "Another " + dd2.name.toLowerCase() + " comes at level " + (dd2.level + 15 * cartsAllowed(dd2, lv)) + ".");
      if (dd2.coop && s.decor.filter(function (o) { return DECO[o.id] && DECO[o.id].coop; }).length >= coopsAllowed(s))
        return no(s, coopsAllowed(s) < COOP.max ? "A second chicken coop comes at level " + COOP.second + "." : "Two chicken coops is the most for now -- more animals come later.");
      var stored = (s.dware[dd2.id] || 0) > 0;
      if (!stored && s.coins < dd2.price) return no(s, "A " + dd2.name.toLowerCase() + " costs " + dd2.price + " coins; you have " + s.coins + ".");
      if (stored) { s.dware[dd2.id]--; if (!s.dware[dd2.id]) delete s.dware[dd2.id]; } else s.coins -= dd2.price;
      s.decor.push({ uid: ++s.seq, id: dd2.id, x: px, y: py, dir: (opts.dir | 0) % 4 });
      if (growMax(dd2.id) && opts.scale > 0) s.decor[s.decor.length - 1].scale = Math.min(growMax(dd2.id), opts.scale | 0);
      if (dd2.coop) Object.assign(s.decor[s.decor.length - 1], { since: now, eggs: 0 });
      if (dd2.home) s.homes[s.seq] = { day: dayOf(now), done: 0, next: now + HOME.first * MIN, order: null };   // (its first order soon)
      return done("");
    }
    if (action === "decorMove" || action === "decorTurn" || action === "decorStore" || action === "decorSell" || action === "decorScale") {
      var dc = s.decor.filter(function (o) { return o.uid === opts.uid; })[0];
      if (!dc) return no(s, "There's nothing there.");
      if (action === "decorScale") {                             // {uid, by: 1 | -1}: a plant a size bigger or smaller
        if (!growMax(dc.id)) return no(s, "That one only comes in the one size.");
        var ns = Math.max(0, Math.min(growMax(dc.id), (dc.scale | 0) + (opts.by < 0 ? -1 : 1)));
        if (ns === (dc.scale | 0)) return no(s, ns ? "That's as big as it grows." : "That's as small as it goes.");
        var was = dc.scale; dc.scale = ns;
        if (ns > (was | 0) && decorProblem(s, dc.id, dc.x, dc.y, dc.uid, dc.dir, !!opts.free)) { dc.scale = was; return no(s, "There's no room for it to grow here."); }
        if (!ns) delete dc.scale;
        return done("");
      }
      if (action === "decorTurn") {
        var nd = ((dc.dir | 0) + (opts.by === -1 ? 3 : 1)) % 4;
        if (FOOT[dc.id]) {                                   // (a building's footprint turns with it -- flush to the pavement it was against)
          var of = footOf(dc.id, dc.x, dc.y, dc.dir), nf = FOOT[dc.id][nd], tx = Math.abs(of.x0) < 0.01 ? nf[0] : dc.x, ty = Math.abs(of.y0) < 0.01 ? nf[1] : dc.y;
          if (decorProblem(s, dc.id, tx, ty, dc.uid, nd, !!opts.free)) return no(s, "There's no room to turn it here.");
          dc.x = tx; dc.y = ty;
        }
        dc.dir = nd; return done("");
      }
      if (action === "decorMove") {
        var mfree = !!opts.free, mx = mfree ? fine(opts.x) : snap(opts.x), my = mfree ? fine(opts.y) : snap(opts.y), md = opts.dir != null ? opts.dir : dc.dir;
        if (DECO[dc.id] && DECO[dc.id].fence && !mfree) { var fm = fenceAt(mx, my, md); mx = fm.x; my = fm.y; md = fm.dir; }
        if (FOOT[dc.id] && !mfree) { var bm = buildingAt(dc.id, mx, my, md); mx = bm.x; my = bm.y; }
        var why5 = decorProblem(s, dc.id, mx, my, dc.uid, md, mfree);
        if (why5) return no(s, why5);
        dc.x = mx; dc.y = my; if (md != null) dc.dir = (md | 0) % 4;
        return done("");
      }
      s.decor.splice(s.decor.indexOf(dc), 1);
      if (DECO[dc.id] && DECO[dc.id].coop) takeEggs(s, dc, now);          // (the eggs in the nest come with you)
      if (action === "decorStore") { s.dware[dc.id] = (s.dware[dc.id] || 0) + 1; return done(DECO[dc.id].name + " stored."); }
      var half = Math.floor(DECO[dc.id].price / 2);
      s.coins += half;
      return done(DECO[dc.id].name + " sold for " + half + " coins.");
    }
    // ---- the patio (V24) ----
    if (action === "patio") {                                      // buy it, or make it a tile deeper
      var np = nextPatio(s);
      if (!np) return no(s, "Your patio's as deep as it gets.");
      if (lv < np.level) return no(s, (s.patio ? "A " + np.depth + "-tile deep patio" : "The patio") + " comes at level " + np.level + ".");
      if (s.coins < np.coins) return no(s, (s.patio ? "A deeper patio" : "The patio") + " costs " + np.coins + " coins; you have " + s.coins + ".");
      var was = s.patio;
      var trial = clone(s); trial.patio = was ? Object.assign({}, was, { depth: np.depth }) : { depth: np.depth, door: Math.min(s.size - 1, Math.max(0, s.size - 2)), rail: "wood", rails: {} };
      // (plots where it goes move out of its way with everything else outside: pushOut)
      if (!was && s.items.some(function (o) { return covers(o, s.size - 1, trial.patio.door); })) {
        for (var dy2 = 0; dy2 < s.size; dy2++) if (!s.items.some(function (o) { return covers(o, s.size - 1, dy2); })) { trial.patio.door = dy2; break; }
        if (s.items.some(function (o) { return covers(o, s.size - 1, trial.patio.door); })) return no(s, "Clear one tile along the café's front-right side first, for the patio's door.");
      }
      s.coins -= np.coins;
      pushOut(s, cafeW(s), s.size, np.depth - (was ? was.depth : 0), 0);    // (the street things past it move out with it)
      var wasW = cafeW(s), dd = np.depth - (was ? was.depth : 0);
      (s.hwalls || []).forEach(function (w) { if (hwMid(w).x >= wasW) w.x += dd; });           // (and the half walls past it)
      s.patio = trial.patio;
      patioRails(s); hwTidy(s);
      if (!s.owned.rail) s.owned.rail = ["wood"];
      clearDecor(s); clearPatio(s);
      ev.push({ kind: "patio", depth: s.patio.depth });
      return done(was ? "Your patio is " + s.patio.depth + " tiles deep now!" : "Your patio's open! Customers can eat outside -- put tables and chairs out there.");
    }
    if (action === "patioDoor") {                                  // {y}: the side door along the café's front edge
      if (!s.patio) return no(s, "Build the patio first.");
      var py3 = Math.round(Number(opts.y));
      if (!(py3 >= 0 && py3 < s.size)) return no(s, "That's not along the café's side.");
      var t4 = clone(s); t4.patio.door = py3;
      var why7 = layoutProblem(t4, t4.items);
      if (why7) return no(s, why7);
      s.patio.door = py3;
      return done("");
    }
    if (action === "expand") {
      var nx = nextExpand(s);
      if (!nx) return no(s, "Your café's as big as it gets.");
      if (lv < nx.level) return no(s, "A " + nx.size + "x" + nx.size + " café comes at level " + nx.level + ".");
      if (s.coins < nx.coins) return no(s, "A " + nx.size + "x" + nx.size + " café costs " + nx.coins + " coins; you have " + s.coins + ".");
      s.coins -= nx.coins;
      setSize(s, nx.size);                                       // (the patio moves out with the front edge, V24)
      clearDecor(s); clearPatio(s);
      ev.push({ kind: "expand", size: s.size });
      return done("Your café is " + s.size + "x" + s.size + " now!");
    }
    return no(s, "NeuroCafe doesn't know how to do that.");
  }

  /** What the patio has grown over: outdoor floor tiles go back to grass; plots are filled in, half back (a café
      expansion can't wait on them). */
  function clearPatio(s) {
    if (!s.patio) return;
    Object.keys(s.outFloors || {}).forEach(function (k) { var q = k.split(",").map(Number); if (inPatio(s, q[0], q[1])) delete s.outFloors[k]; });
    s.field = (s.field || []).filter(function (p) { if (!inPatio(s, p.x, p.y)) return true; s.coins += Math.floor((p.paid || 0) / 2); return false; });
  }
  /** Street things the café has grown over go back to the warehouse. */
  function clearDecor(s) {
    s.decor = s.decor.filter(function (o) {
      var r = DECO[o.id] ? DECO[o.id].r : 0.3;
      if (!(o.x > -r && o.y > -r && o.x < cafeW(s) + r && o.y < s.size + r)) return true;
      s.dware[o.id] = (s.dware[o.id] || 0) + 1;
      return false;
    });
  }

  /** A sandbox made from a café (a copy of it) or a fresh one: marked, so it can only be kept as the sandbox. */
  function sandbox(state, now, fresh_) {
    var s = fresh_ || !state || !state.made ? fresh(now) : advance(state, now);
    s = clone(s);
    if (fresh_ || !state || !state.made) s.name = "Sandbox café";
    s.sandbox = true; s.dev = s.dev || {};
    note(s, now, "A sandbox to try things in.");
    return s;
  }

  /** Everything the page shows, worked out for now. */
  function view(state, now) {
    var s = advance(state, now);
    if (!s.made) return { made: false };
    tutorial(s, now, []);
    var lv = levelOf(s.xp || 0);
    return {
      made: true, name: s.name, open: !s.closed, popularity: popularity(s, now), perMin: Math.round(rate(s, now) * 10) / 10, rush: (function () { var r = rushAt(now, s); if (!r) return null; var e = new Date(now); e.setHours(r.to, 0, 0, 0); return { id: r.id, name: r.name, x: RUSH_X, ends: e.getTime() }; })(), nextRush: nextRush(now), coins: s.coins, till: s.till, xp: s.xp, level: lv, max: lv >= MAX_LEVEL,
      xpFrom: XP[lv], xpTo: lv >= MAX_LEVEL ? XP[lv] : XP[lv + 1], size: s.size, door: s.door, floor: s.floor,
      patio: s.patio ? { depth: s.patio.depth, door: s.patio.door, tint: s.patio.tint || null, tint2: s.patio.tint2 || null } : null,
      patioNext: (function () { var np = nextPatio(s); return np ? { depth: np.depth, level: np.level, coins: np.coins, open: lv >= np.level, first: !s.patio } : null; })(),
      patios: PATIOS.map(function (p) { return { depth: p.depth, level: p.level, coins: p.coins, done: !!s.patio && s.patio.depth >= p.depth, open: lv >= p.level }; }),
      cafeW: cafeW(s),
      items: s.items.map(function (it) {
        var o = { uid: it.uid, kind: it.kind, x: it.x, y: it.y, dir: it.dir | 0 };
        if (it.scale) o.scale = it.scale;
        if (it.tint) o.tint = it.tint;
        if (it.tint2) o.tint2 = it.tint2;
        if (it.off) o.off = true;                                   // (a lamp switched off)
        if (it.cstyle) o.cstyle = it.cstyle;
        if (cooks(it)) { o.stove = stoveOf(it, now); o.selfclean = !!it.selfclean; o.last = it.last && DISH[it.last] ? it.last : null; }
        if (serves(it)) { o.fridge = !!it.fridge; o.cap = underCap(it); o.under = (it.under || []).map(function (u) { return { dish: DISH[u.dish], n: u.n }; }); }
        if (it.kind === "counter") { o.dish = it.dish ? DISH[it.dish] : null; o.n = it.n || 0; }
        if (isSeat(it)) { var tb = tableCell(s, it); o.seat = !!tb; o.sitDir = seatDir(s, it); o.table = tb; }
        if (isVend(it)) o.vend = vendTakings(it);
        if (MACHINES[it.kind]) o.coins = it.coins || 0;
        if (refills(it)) { o.dry = dryAt(s, it); o.runLeft = Math.max(0, REFILL.run - (it.used || 0)); }
        if (it.cashier) o.cashier = true;
        if (ownTop(it)) o.plates = it.plates.map(function (pl) { return { dish: pl.dish ? DISH[pl.dish] : null, n: pl.n || 0 }; });
        if (isShelf(it)) o.plates = it.plates.map(function (pl) { return { dish: pl.dish && pl.n > 0 ? DISH[pl.dish] : null, n: pl.n || 0 }; });
        if (it.tip) o.tip = it.tip;
        if (it.candy) o.candy = it.candy;
        if (it.kind === "buffet") o.plates = it.plates.map(function (pl) { return { dish: pl.dish ? DISH[pl.dish] : null, n: pl.n || 0 }; });
        o.cells = cells(it);
        return o;
      }),
      customers: s.customers.map(function (c) { return { id: c.id, look: c.look, dish: c.dish, counter: c.counter, vend: c.vend || 0, p: c.p || 0, si: c.si, so: c.so, seat: c.seat || 0, sp: c.sp || 0, s: c.s, sit: c.sit, up: c.up, at: c.at, take: c.take, pay: c.pay, gone: c.gone, a: c.a, b: c.b, o: c.o, bench: c.bench || null, so2: c.so2 || null, bsit: c.bsit || 0, bup: c.bup || 0 }; }),
      ware: s.ware, rate: rate(s, now),
      cookbook: DISHES.map(function (d) { var ms = mastered(s, d.id);
        return { id: d.id, menu: d.menu || "breakfast", name: d.name, level: d.level, secs: ms.secs, servings: ms.servings, cost: d.cost, price: ms.price, xp: d.xp, open: canCook(s, d, lv), on: cookerOf(d), secret: !!d.secret, afford: s.coins >= d.cost,
                 stars: ms.stars, cooks: cooksOf(s, d.id), need: masteryNeed(d), noburn: ms.noburn,
                 needs: Object.keys(d.needs).map(function (c) { return { crop: c, name: goodName(c), n: d.needs[c], have: s.pantry[c] || 0 }; }), field: canCook(s, d, lv) && hasAll(s, d), farmPrice: farmPrice(s, d.id) }; }),
      shop: SELLS.filter(function (k) { return !THINGS[k].sandbox || s.sandbox; }).map(function (k) { return { kind: k, name: THINGS[k].name, price: THINGS[k].price, level: THINGS[k].level || 1, have: count(s, k), allowed: allowedHere(s, k, lv), ware: s.ware[k] || 0 }; }),
      expand: (function () { var e = nextExpand(s); return e ? { size: e.size, level: e.level, coins: e.coins, open: lv >= e.level } : null; })(),
      expansions: EXPANSIONS.map(function (e) { return { size: e.size, level: e.level, coins: e.coins, done: s.size >= e.size, open: lv >= e.level }; }),
      terrain: s.terrain, terrainShop: TERRAINS.filter(function (t) { return !t.tool; }).map(function (t) { return { id: t.id, name: t.name, level: t.level, open: lv >= t.level || !!s.sandbox }; }),
      homes: (function () { var o = {}; Object.keys(s.homes).forEach(function (k) { var h = s.homes[k]; o[k] = { done: h.done || 0, next: h.next, order: h.order ? { dish: DISH[h.order.dish], n: h.order.n, value: h.order.value, xp: h.order.xp, have: loadable(s, h.order.dish, now) } : null }; }); return o; })(),
      runs: (s.runs || []).filter(function (r2) { return now - r2.at < HOME.runFor; }), homeCap: HOME.cap,
      hang: s.hang, pware: s.pware, hangOff: s.hangOff, ceil: s.ceil, cware: s.cware, inv: s.inv,
      ceilShop: CEILING.map(function (c) { return { id: c.id, name: c.name, level: c.level, price: c.price, pic: c.pic, open: lv >= c.level, stored: s.cware[c.id] || 0 }; }), food: s.food.map(function (f) { return { dish: DISH[f.dish], n: f.n }; }),
      field: lv >= FIELD.level ? { plots: s.field.map(function (pl) { var o = cropOf(pl, now);
          return { uid: pl.uid, x: pl.x, y: pl.y, crop: o ? o.crop.id : null, name: o ? o.crop.name : "", stage: o ? o.stage : 0, ready: !!(o && o.ready), left: o ? o.left : 0,
                   spoiled: !!(o && o.spoiled), spoilsIn: o ? o.spoilsIn : 0, keep: o ? o.keep : 0, progress: o ? o.progress : 0, last: pl.last || null, paid: pl.paid || 0 }; }),
        have: s.field.length, allowed: plotsAllowed(lv), price: plotPrice(s.field.length), nextAt: (function () { for (var l = lv + 1; l <= MAX_LEVEL; l++) if (plotsAllowed(l) > plotsAllowed(lv)) return l; return 0; })(),
        crops: CROPS.map(function (c) { return { id: c.id, name: c.name, level: c.level, mins: c.mins, seed: c.seed, yield: c.yield, xp: c.xp, open: lv >= c.level, have: s.pantry[c.id] || 0, packets: s.seeds[c.id] || 0 }; }) } : null,
      seeds: s.seeds,
      pantry: s.pantry,
      cart: s.cart && !s.cart.done ? (function (c) { var T4 = TUTOR[c.tutor], val = cartValue(s, c);
        return { day: c.day, tutor: { id: T4.id, name: T4.name, title: T4.title, hello: T4.hello }, value: val, bonus: Math.round(val * CART.bonus),
                 order: c.order.map(function (l) { return { dish: DISH[l.dish], n: l.n, got: l.got, have: loadable(s, l.dish, now) }; }) }; })(s.cart) : null,
      diary: (s.diary || []).slice().reverse(), diaryNew: diaryUnread(s), happen: prefs(s).happen,
      aunty: s.aunty && s.aunty.box ? { waiting: !s.aunty.opened, count: s.aunty.count || 0, secrets: s.secrets.filter(function (id) { return DISH[id] && !DISH[id].event; }).length, of: DISHES.filter(function (d) { return d.secret && !d.event; }).length } : null, potions: POTIONS, parts: s.parts || {}, upgrades: UPGRADES,
      kit: (function () { var cap = kitSaves(s); return cap ? { saves: cap, left: Math.max(0, cap - ((s.fire || {})[dayOf(now)] || 0)) } : null; })(),
      kitShop: KITS.map(function (k) { return { id: k.id, name: k.name, level: k.level, price: k.price, pic: k.pic, saves: k.saves, open: lv >= k.level, up: Object.keys(s.hang).some(function (h) { return s.hang[h] === k.id; }), stored: s.pware[k.id] || 0 }; }),
      weaponShop: WEAPONS.filter(function (p) { return valeHas(s, p.id) || (s.pware[p.id] || 0) > 0; }).map(function (p) { return { id: p.id, name: p.name, level: p.level, price: p.price, pic: p.pic, open: lv >= p.level, stored: s.pware[p.id] || 0 }; }),
      vale: { weapons: WEAPONS.map(function (p) { return { id: p.id, name: p.name, pic: p.pic, price: p.price, got: valeHas(s, p.id) }; }),
              keeps: DECOR.filter(function (d) { return d.vale; }).map(function (d) { return { id: d.id, name: d.name, got: (s.vale || []).indexOf(d.id) >= 0 }; }) },
      wallShop: WALL_THINGS.map(function (p) { return { id: p.id, name: p.name, level: p.level, price: p.price, pic: p.pic, group: p.group, open: lv >= p.level, stored: s.pware[p.id] || 0 }; }),
      // Halloween (EVENT): the candy, whether it's on, the mansion's list and what's yours
      haunts: Object.keys(HAUNT).map(function (id) { var H = HAUNT[id], h = s.haunts[id]; return { id: id, name: DECO[id].name, price: H.price, fee: H.fee, gap: H.gap, from: H.from, to: H.to,
        bought: !!h, placed: (s.decor || []).some(function (o) { return o.id === id; }), on: hauntOn(s, id, now), hours: hauntHours(id, now), visitors: h ? h.visitors : 0, earned: h ? h.earned : 0 }; }),
      feast: s.feast && !s.feast.seen ? { year: s.feast.year, candy: s.feast.candy, dishes: s.feast.dishes.map(function (o) { return { id: o.dish, name: DISH[o.dish].name, n: o.n }; }) } : null,
      candy: s.candy, calendar: calendar(s, now), event: { id: EVENT.id, name: EVENT.name, on: eventOn(s, now), build: mansionTime(s, now), until: EVENT.until, mansion: hasMansion(s),
        items: EVENT_ITEMS.map(function (x) { return Object.assign({}, x, { got: s.eventGot.indexOf(x.id) >= 0 }); }),
        paintings: HW_PAINTINGS.concat(HW_HANG).map(function (p) { return { id: p.id, name: p.name, level: 1, price: p.price, pic: p.pic, open: s.eventGot.indexOf(p.id) >= 0, stored: s.pware[p.id] || 0, candy: p.candy }; }) },
      hangPhoto: s.hangPhoto, hangTint: s.hangTint, hangCard: s.hangCard, major: MAJOR,
      candyStore: catalogueDone(s) ? CANDY_STORE : null, boost: s.boost || {}, frameShop: PHOTO_FRAMES.concat(HW_HANG.filter(function (p) { return p.photo && eventGot(s, p); })).map(function (p) { return { id: p.id, name: p.name, price: p.price, pic: p.pic, round: !!p.round, portrait: !!p.portrait, stored: s.pware[p.id] || 0, event: p.event || null }; }),   // (2026-10-26, Cam: an event's frames you've unlocked are photo frames too)
      paintShop: PAINTINGS.map(function (p) { return { id: p.id, name: p.name, level: p.level, price: p.price, pic: p.pic, open: lv >= p.level, stored: s.pware[p.id] || 0 }; }),
      tut: s.tut != null && s.tut < TUTORIAL.length ? { step: s.tut, id: TUTORIAL[s.tut].id, say: TUTORIAL[s.tut].say, of: TUTORIAL.length } : null,
      style: s.style, styles: ["wall", "counters"].reduce(function (m, w) { m[w] = STYLE_LISTS[w].filter(function (x) { return eventGot(s, x); }).map(function (x) { return { id: x.id, name: x.name, level: x.level, price: x.price, panel: panelPrice(x), open: lv >= x.level, owned: !x.price || (s.owned[w] || []).indexOf(x.id) >= 0, on: (s.style[w] || STYLE_LISTS[w][0].id) === x.id }; }); return m; }, {}),
      walls: s.walls, floors: s.floors, outFloors: s.outFloors, outFloor: OUT_FLOOR, floorShop: FLOORS.filter(function (f) { return !f.patio || s.patio; }).map(function (f) { return { id: f.id, name: f.name, level: f.level, price: f.price, open: lv >= f.level, patio: !!f.patio }; }),
      decor: s.decor.map(function (o) { var d = { uid: o.uid, id: o.id, x: o.x, y: o.y, dir: o.dir | 0 }; if (o.scale) d.scale = o.scale;
        if (isStall(o)) d.stall = { coins: o.coins || 0, dry: dryAt(s, o), shows: o.shows || 0, selling: o.id === "cinema" || (function () { var h = new Date(now).getHours(); return h >= CARTS[o.id].from && h < CARTS[o.id].to; })() };
        if (DECO[o.id] && DECO[o.id].coop) { var n = coopOf(o, now); d.coop = { eggs: n.eggs, full: n.full, nest: COOP.nest, hens: COOP.hens, next: n.next }; }
        return d; }), dware: s.dware,
      // (2026-10-24) the paints: which are yours, the store's list, the mixer
      paints: { owned: PAINTS.filter(function (p) { return hasPaint(s, p.id); }).map(function (p) { return p.id; }), mixer: hasMixer(s), store: !!furnStore(s),
        shop: PAINTS.map(function (p) { return { id: p.id, level: p.level || 0, price: p.price, have: hasPaint(s, p.id) }; }), mixerPrice: MIXER.price,
        counters: COUNTER_STYLES.map(function (x) { return { id: x.id, name: x.name, level: x.level, price: x.price, open: lv >= x.level, owned: !x.price || (s.owned.counters || []).indexOf(x.id) >= 0 }; }) },
      // (2026-11-08) the half walls: where they stand, and their styles (yours, or the furniture store's)
      hwalls: clone(s.hwalls || []), halfWalls: { open: lv >= HALF_WALL.level || !!s.sandbox, level: HALF_WALL.level, seg: HALF_WALL.seg, lesson: !(s.lessons && s.lessons.halfwalls),
        styles: HALF_WALLS.filter(function (x) { return eventGot(s, hwEv(x)); }).map(function (x) { return { id: x.id, name: x.name, level: x.level, price: x.price, rail: x.rail || null, mat: x.mat || null, open: lv >= x.level || !!s.sandbox, owned: hwOwned(s, x.id) }; }) },
      decorShop: DECOR.filter(function (d) { return !d.vale && (!d.sandbox || s.sandbox) && (eventGot(s, d) || s.dware[d.id] > 0); }).map(function (d) { return { id: d.id, name: d.name, level: d.level, price: d.price, open: lv >= d.level, ware: s.dware[d.id] || 0, farm: !!d.farm, building: !!d.building, nature: d.nature || "", home: !!d.home, mansion: !!d.mansion, house: d.house || "", houseOn: d.house ? houseTime(s, d.house, now) : false }; }),
      stats: s.stats, log: s.log.slice(0, 8), sandbox: !!s.sandbox, dev: s.sandbox ? clone(s.dev || {}) : null
    };
  }

  return {
    empty: empty, fresh: fresh, sandbox: sandbox, popularity: popularity, WALLPAPERS: WALLPAPERS, COUNTER_STYLES: COUNTER_STYLES, isSeat: isSeat, isTable: isTable, places: places, VEND_: null, FLOORS: FLOORS, FLOOR: FLOOR, FACE: FACE, seats: seats, seatTable: seatTable, tableCell: tableCell, inside: inside, inPatio: inPatio, cafeW: cafeW, walled: walled, RAILS: RAILS, RAIL: RAIL, PATIOS: PATIOS, nextPatio: nextPatio, PATIO_TIP: PATIO_TIP, setSize: setSize, areaPick: areaPick, areaSays: areaSays, VEND: VEND, VENDS: VENDS, REFILL: REFILL, CARTS: CARTS, CINEMA: CINEMA, STALL_MAX: STALL_MAX, BARS: BARS, VENDINGS: VENDINGS, isBar: isBar, ownTop: ownTop, isShelf: isShelf, shelfTakes: shelfTakes, isVend: isVend, machines: machines, food: food, refills: refills, refillCut: refillCut, EAT: EAT, DINE_TIP: DINE_TIP, TIP_CHANCE: TIP_CHANCE, CLEAN_XP: CLEAN_XP, COUNTERS: COUNTERS, MENUS: MENUS, POTIONS: POTIONS, KITS: KITS, HAPPENINGS: HAPPENINGS, HAPPENING: HAPPENING, HAPPEN: HAPPEN, DIARY: DIARY, rewardFor: rewardFor, prefs: prefs, MACHINES: MACHINES, PAINTINGS: PAINTINGS, WALL_THINGS: WALL_THINGS, PAINTING: PAINTING, EVENT: EVENT, EVENT_ITEMS: EVENT_ITEMS, HW_PAINTINGS: HW_PAINTINGS, PHOTO_FRAMES: PHOTO_FRAMES, eventOn: eventOn, mansionTime: mansionTime, HAUNT: HAUNT, hauntArrive: hauntArrive, hauntOn: hauntOn, WEAPONS: WEAPONS, PAINTS: PAINTS, PAINT_OF: PAINT_OF, MIXER: MIXER, hasPaint: hasPaint, EXPANSIONS: EXPANSIONS, panelPrice: panelPrice, DECOR: DECOR, DECO: DECO, decorProblem: decorProblem, fenceAt: fenceAt, HALF_WALL: HALF_WALL, HALF_WALLS: HALF_WALLS, hwSides: hwSides, hwEdgeProblem: hwEdgeProblem, hwBetween: hwBetween, hwMid: hwMid, HALF_WALL_OF: HALF_WALL_OF, STARTER_DECOR: STARTER_DECOR, UPGRADES: UPGRADES, underCap: underCap, autoFace: autoFace, RUSHES: RUSHES, RUSH_X: RUSH_X, rushAt: rushAt, nextRush: nextRush, baseRate: baseRate, GROUPS: GROUPS, GROUP_GAP: GROUP_GAP, normal: normal, advance: advance, act: act, view: view, levelOf: levelOf, unlocksAt: unlocksAt, CALENDAR: CALENDAR, calendar: calendar, easter: easter, FOOT: FOOT, buildingAt: buildingAt, OUT_FLOOR: OUT_FLOOR, outFloorProblem: outFloorProblem, canHang: canHang, CEILING: CEILING, CEIL: CEIL, canCeil: canCeil, houseTime: houseTime, GROW: GROW, growOf: growOf, growMax: growMax, thingGrowMax: thingGrowMax,
    stoveOf: stoveOf, cooks: cooks, cookerOf: cookerOf, hasCooker: hasCooker, APPLIANCES: APPLIANCES, path: path, spotFor: spotFor, layoutProblem: layoutProblem, fitProblem: fitProblem, cells: cells, covers: covers, plates: plates, alongX: alongX, STREET: STREET, streetRoute: streetRoute, lengthOf: lengthOf, rate: rate, allowed: allowed, entry: entry,
    DISHES: DISHES, DISH: DISH, MASTERY: MASTERY, AUNTY: AUNTY, canCook: canCook, CART: CART, TUTORS: TUTORS, tutorFor: tutorFor, CROPS: CROPS, CROP: CROP, FIELD: FIELD, keepOf: keepOf, GOODS: GOODS, goodName: goodName, COOP: COOP, coopOf: coopOf, coopsAllowed: coopsAllowed, FARM_X: FARM_X, plotsAllowed: plotsAllowed, plotPrice: plotPrice, plotProblem: plotProblem, onPlot: onPlot, farmPrice: farmPrice, INGREDIENTS: INGREDIENTS, placeFood: placeFood, masteryNeed: masteryNeed, mastered: mastered, starsOf: starsOf, XP: XP, MAX_LEVEL: MAX_LEVEL, THINGS: THINGS, EXPAND: EXPAND, START: START, TUTORIAL: TUTORIAL,
    RATE: RATE, COMFORT: COMFORT, TERRAINS: TERRAINS, TERRAIN: TERRAIN, HOME: HOME, HOME_FOOT: HOME_FOOT, BENCH: BENCH, benchPlaces: benchPlaces, benchIn: benchIn, REACH: REACH, GUESTS: GUESTS, GUEST: GUEST, GUEST_OF: GUEST_OF, pickLook: pickLook, CANDY_STORE: CANDY_STORE, catalogueDone: catalogueDone, boostOn: boostOn, MAJOR: MAJOR, HW_HANG: HW_HANG, roundSeat: roundSeat, outWalk: outWalk, streetPath: streetPath, footOf: footOf, walkBlocked: walkBlocked, WALK_THROUGH: WALK_THROUGH, benchOut: benchOut, crowd: crowd, isDark: isDark, WALK: WALK, SEC: SEC, MIN: MIN
  };
})();
if (typeof window !== "undefined") window.CafeCore = CafeCore;
