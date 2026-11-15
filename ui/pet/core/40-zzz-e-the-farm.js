  // ---- the Farm (2026-10-12, Cam: "a new map area which will be called farm denoted by a sign on the path next to the
  //      graveyard at the estate ... livestock, which generate materials like wool, milk etc. A livestock breeding feature
  //      and husbandry skill (unlocked by a quest)" -- then "Lets get started on the farm", "do steps 2 and 3", and "continue
  //      please work on all the steps"). On screen it's "The Farm"; in the code `ranch`, so it never mixes with the garden plots
  //      (`farm`). Fern, the farmer of old, waits at the overgrown track on your estate; her quest opens the Farm with a Basic
  //      chicken coop and two hens. Animals give while they're fed; what they give waits in their building (three rounds an
  //      animal at most) until you collect it. Nothing dies: a hungry animal just waits. Tended at home only, like the cart.
  //      The plan, step by step: Notes vault "NeuroPets Farm" -> "06 - Farm workflow (step by step)".
  //   1 coop and hens · 2 feed crops and the Feed store · 3 the Barn (cows, goats) and the Dairy's churn · 4 the Duck pond and
  //   the Shearing shed · 5 the Culture room (cheese, yoghurt) and the Pigsty (truffles) · 6 the Stable (ponies, draft horses:
  //   the bigger carts) · 7 care (mucking out, brushing) and the Today page · 8 the Paddock: breeding, breeds and yield stars
  //   · 9 animals walking about on the painted Farm (pet.js) · 10 a dog makes shearing quicker, a cat makes feed last, the
  //   well and trough (feed and collect everyone at once), and Saturday's farmers' market at Fern's stall.
  //   · 11 the extras, once Cam painted them (2026-10-13, Art 9): the Beehives (bee colonies need no feeding: honey, wax, candles),
  //   the Windmill (flour, for bread), the Greenhouse (tomatoes and garden crops on shelves), the Smokehouse (fish that heals
  //   more) and the Show ring (an animal a day for rosettes; three wins make a champion and a silver cup).
  var RANCH_QUEST = "farmofyourown";
  var RANCH_FED = 12 * HOUR;                          // one bag of feed keeps an animal fed this long (a cat companion: longer)
  var RANCH_WAIT = 3;                                 // rounds a building keeps waiting for you, per animal
  var RANCH_CLEAN = DAY;                              // mucking out lasts a day
  var RANCH_BRUSH = DAY;                              // so does a brushing (step 7); both once a day
  var RANCH_XP = CONTENT("RANCH_XP");   // collecting: LIVESTOCK xp
  // Husbandry's pace (2026-10-15, Cam: ~10 weeks to 50 was too much): every Farm xp grant x3 -- a full farm reaches 50 in ~2 weeks,
  // a normal one ~3-4. Quest rewards aren't scaled.
  var RANCH_PACE = 3;
  var RANCH_MARKET = 1.5;                             // Saturday's farmers' market pays half as much again as Marlow
  var LIVESTOCK = CONTENT("LIVESTOCK");
  var LIVESTOCK_ORDER = CONTENT("LIVESTOCK_ORDER");
  // tiers: [null, Basic, Sturdy, Fine, Grand]. A tier with no `needs` comes another way (the coop: Fern's quest).
  var ANIMAL_TIERS = function (o, c, coins) { return [null,
    { cap: 2, speed: 1, hus: o, con: c, coins: coins, needs: { plank: 60, rope: 10 }, xp: 500 },
    { cap: 4, speed: 0.9, hus: o + 7, con: c + 8, coins: coins * 2.4, needs: { hardplank: 40, rope: 15 }, xp: 1000 },
    { cap: 6, speed: 0.8, hus: o + 15, con: c + 18, coins: coins * 5.6, needs: { fineplank: 40, rope: 20 }, xp: 2000 },
    { cap: 8, speed: 0.7, hus: Math.min(MAX_LEVEL, o + 25), con: Math.min(MAX_LEVEL, c + 28), coins: coins * 12, needs: { fineplank: 80, rope: 30 }, xp: 3500 }]; };
  var RANCH = {
    coop: { name: "Chicken coop", says: "Hens lay while they're fed. Muck it out once a day for more eggs.", opens: 1, kinds: ["hen"],
      tiers: [null,
        { cap: 2, speed: 1 },
        { cap: 4, speed: 0.9, hus: 6, con: 15, coins: 1500, needs: { plank: 30, rope: 5 }, xp: 300 },
        { cap: 6, speed: 0.8, hus: 14, con: 25, coins: 5000, needs: { hardplank: 30, rope: 10 }, xp: 900 },
        { cap: 8, speed: 0.7, hus: 24, con: 35, coins: 12000, needs: { fineplank: 30, rope: 15 }, xp: 2000 }] },
    barn: { name: "Barn", says: "Cows and goats, on hay. Milk in the pail every round they're fed.", opens: 5, kinds: ["cow", "goat"], tiers: ANIMAL_TIERS(5, 12, 2500) },
    pond: { name: "Duck pond", says: "Ducks on grain feed: duck eggs, and soft down now and then.", opens: 8, kinds: ["duck"], tiers: ANIMAL_TIERS(8, 12, 1200) },
    dairy: { name: "Dairy", says: "The butter churn: milk into cream, cream into butter.", opens: 10, kinds: [],
      tiers: [null, { cap: 0, speed: 1, hus: 10, con: 15, coins: 4000, needs: { plank: 40, ironbar: 5, rope: 5 }, xp: 600 }] },
    shearing: { name: "Shearing shed", says: "Sheep on hay, sheared once a day: a good armful of wool each.", opens: 15, kinds: ["sheep"], tiers: ANIMAL_TIERS(15, 18, 5000) },
    culture: { name: "Culture room", says: "Cool and dark: milk set to cheese and yoghurt, a day or half a day at a time.", opens: 20, kinds: [], slots: true,
      tiers: [null,
        { cap: 2, speed: 1, hus: 20, con: 22, coins: 8000, needs: { plank: 60, ironbar: 10, rope: 10 }, xp: 1200 },
        { cap: 4, speed: 1, hus: 30, con: 32, coins: 20000, needs: { hardplank: 60, steel: 10 }, xp: 2400 }] },
    sty: { name: "Pigsty", says: "Pigs on potatoes, rooting about: a truffle now and then.", opens: 25, kinds: ["pig"], tiers: ANIMAL_TIERS(25, 25, 9000) },
    stable: { name: "Stable", says: "Ponies on hay and draft horses on oats: horsehair -- and they pull your bigger carts.", opens: 30, kinds: ["pony", "drafthorse"],
              tiers: ANIMAL_TIERS(30, 30, 15000) },
    paddock: { name: "Paddock", says: "Two of a kind out to grass together come home with a young one.", opens: 35, kinds: [], pairs: true,
      tiers: [null,
        { cap: 1, speed: 1, hus: 35, con: 35, coins: 20000, needs: { fineplank: 40, rope: 20 }, xp: 2500 },
        { cap: 2, speed: 1, hus: 42, con: 42, coins: 50000, needs: { fineplank: 80, rope: 40 }, xp: 4000 }] },
    // the extras (step 11, Art 9). `care: false`: nothing to muck out or brush. `make`: a bench like the Dairy's churn (RANCH_MAKE).
    hives: { name: "Beehives", says: "Bees fetch their own flowers: honey every half a day, wax now and then. The candle bench is beside them.",
             opens: 4, kinds: ["bee"], care: false, make: true,
      tiers: [null,
        { cap: 2, speed: 1, hus: 4, con: 8, coins: 600, needs: { plank: 20 }, xp: 200 },
        { cap: 4, speed: 0.9, hus: 12, con: 16, coins: 2500, needs: { plank: 40, rope: 5 }, xp: 600 },
        { cap: 6, speed: 0.8, hus: 22, con: 26, coins: 7000, needs: { hardplank: 40, rope: 10 }, xp: 1400 },
        { cap: 8, speed: 0.7, hus: 32, con: 36, coins: 16000, needs: { fineplank: 40, rope: 15 }, xp: 2400 }] },
    mill: { name: "Windmill", says: "Grain in at the top, flour out at the bottom -- for the kitchen's bread.", opens: 12, kinds: [], make: true,
      tiers: [null, { cap: 0, speed: 1, hus: 12, con: 20, coins: 6000, needs: { stone: 60, plank: 40, cloth: 8, rope: 10 }, xp: 900 }] },
    glass: { name: "Greenhouse", says: "Warm under glass: tomatoes, and garden crops that grow on a shelf while you're away -- no watering.",
             opens: 18, kinds: [], slots: true,
      tiers: [null,
        { cap: 2, speed: 1, hus: 18, con: 24, coins: 9000, needs: { plank: 50, ironbar: 10 }, xp: 1300 },
        { cap: 4, speed: 1, hus: 28, con: 34, coins: 22000, needs: { hardplank: 50, steel: 10 }, xp: 2600 }] },
    smoke: { name: "Smokehouse", says: "Fish hung in oak smoke: it keeps, and it heals more than fresh-cooked.", opens: 22, kinds: [], slots: true,
      tiers: [null,
        { cap: 2, speed: 1, hus: 22, con: 26, coins: 10000, needs: { plank: 50, stone: 30, ironbar: 5 }, xp: 1400 },
        { cap: 4, speed: 1, hus: 32, con: 36, coins: 24000, needs: { hardplank: 60, ironbar: 15 }, xp: 2600 }] },
    showring: { name: "Show ring", says: "One animal a day in the ring. Brushed, mucked out, bred for yield or a rare breed: the judges notice.",
                opens: 28, kinds: [], show: true,
      tiers: [null, { cap: 0, speed: 1, hus: 28, con: 28, coins: 12000, needs: { plank: 80, rope: 20, cloth: 10 }, xp: 1500 }] }
  };
  var RANCH_ORDER = CONTENT("RANCH_ORDER");
  // the Feed store: crops from your garden into feed -- grain feed, hay from meadow grass (step 2)
  var RANCH_FEED = CONTENT("RANCH_FEED");
  // the Dairy's churn (step 3)
  var RANCH_CHURN = CONTENT("RANCH_CHURN");
  // the Culture room (step 5): slow, a shelf each, like the hearth's pot
  var RANCH_CULTURE = CONTENT("RANCH_CULTURE");
  // the extras' benches and shelves (step 11). A shelf recipe's `farm` is the Farming level it asks.
  var RANCH_MAKE = { dairy: RANCH_CHURN,
    hives: [{ make: "candle", n: 2, needs: { beeswax: 3, thread: 1 } }],
    mill: [{ make: "flour", n: 2, needs: { oats: 3 } }] };
  var RANCH_SLOTS = { culture: RANCH_CULTURE,
    glass: [{ make: "tomato", n: 8, needs: { tomatoseed: 1 }, hours: 8 }, { make: "strawberry", n: 8, needs: { strawberryseed: 1 }, hours: 10, farm: 10 },
            { make: "pumpkin", n: 4, needs: { pumpkinseed: 1 }, hours: 12, farm: 15 }, { make: "melon", n: 4, needs: { melonseed: 1 }, hours: 16, farm: 35 }],
    smoke: [{ make: "smokedfish", n: 3, needs: { trout: 3, oak: 1 }, hours: 6 }, { make: "smokedfish", n: 3, needs: { rawherring: 3, oak: 1 }, hours: 6 },
            { make: "smokedfish", n: 5, needs: { salmon: 3, oak: 1 }, hours: 8 }] };
  // the Show ring (step 11): one entry a day; the odds grow with care, stars and a rare breed; three firsts make a champion
  var RANCH_SHOW = CONTENT("RANCH_SHOW");
  // the Paddock (step 8): a rare breed's chance, a yield star's chance, stars up to 3 (an extra round's worth every 4th/3rd/2nd round)
  var RANCH_RARE = 0.12, RANCH_STAR = 0.3, RANCH_STARS = 3;
  var RANCH_GOODS = CONTENT("RANCH_GOODS");

  PEOPLE.ranch = { id: "fern", name: "Fern the farmer", look: { skin: 1, hair: 1, outfit: 1 },
    says: "There was a farm here once, you know. Hens in the yard, a cow in the barn. It could be again.", quests: [
      { id: RANCH_QUEST, name: "A farm of your own", text: "\"Clear the old track and mend the coop, and I'll find you a couple of hens. The rest you'll learn as you go.\"",
        needs: [{ level: ["farming", 10] }, { level: ["construction", 10] }, { bring: { plank: 40, rope: 10, potato: 30 } }],
        reward: { items: { grainfeed: 6 }, xp: { husbandry: 300 } } },
      // then her farm's own errands, one at a time (the people of the world have six or more each)
      { id: "fern_eggs", name: "Eggs for the village", text: "\"Folk in the village haven't had a fresh egg in years. Thirty, and they'll sing your name.\"",
        needs: [{ bring: { chickenegg: 30 } }], reward: { coins: 400, items: { woodcrate: 1 }, xp: { husbandry: 300 } } },
      { id: "fern_feed", name: "Feed in store", text: "\"Never let the bin run dry. Mill me forty bags and I'll rest easy.\"",
        needs: [{ bring: { grainfeed: 40 } }], reward: { coins: 500, xp: { husbandry: 400, farming: 300 } } },
      { id: "fern_hand", name: "A farmer's hand", text: "\"You're getting the knack of it. Show me you can keep a coop.\"",
        needs: [{ level: ["husbandry", 6] }], reward: { coins: 600, items: { ironcrate: 1 } } },
      { id: "fern_honey", name: "Sweet as anything", text: "\"Twenty jars of honey for the baker. The bees do the work -- you do the carrying.\"",
        needs: [{ bring: { honey: 20 } }], reward: { coins: 800, xp: { husbandry: 600 } } },
      { id: "fern_feathers", name: "Feathers for the fletchers", text: "\"The arrow-makers pay well for good feathers. Forty should do.\"",
        needs: [{ bring: { feather: 40 } }], reward: { coins: 700, xp: { fletching: 300, husbandry: 300 } } },
      { id: "fern_dozen", name: "A dozen dozen", text: "\"A hundred and forty-four eggs. Don't ask what for -- it's a surprise.\"",
        needs: [{ bring: { chickenegg: 144 } }, { level: ["husbandry", 10] }], reward: { coins: 1500, items: { ironcrate: 1 }, xp: { cooking: 500 } } },
      // the rest of the farm (steps 3-8)
      { id: "fern_milk", name: "A pail a day", text: "\"Twenty pints of milk for the school. They've been on water and hope.\"",
        needs: [{ bring: { milk: 20 } }], reward: { coins: 1200, xp: { husbandry: 800 } } },
      { id: "fern_bread", name: "Daily bread", text: "\"Ten good loaves for the harvest supper -- from your own flour, mind.\"",
        needs: [{ bring: { bread: 10 } }, { level: ["husbandry", 12] }], reward: { coins: 1500, xp: { husbandry: 1000, cooking: 500 } } },
      { id: "fern_wool", name: "Before the frost", text: "\"Forty armfuls of wool, and the village sleeps warm this winter.\"",
        needs: [{ bring: { wool: 40 } }, { level: ["husbandry", 16] }], reward: { coins: 2500, items: { ironcrate: 1 }, xp: { husbandry: 1500, crafting: 600 } } },
      { id: "fern_cheese", name: "A proper cheese", text: "\"Ten good cheeses for the harvest feast. Mind they're ripe.\"",
        needs: [{ bring: { cheese: 10 } }], reward: { coins: 3500, xp: { husbandry: 2500, cooking: 800 } } },
      { id: "fern_smoke", name: "For the long voyage", text: "\"The harbour wants fish that keeps. Twenty smoked, and they'll stop asking me.\"",
        needs: [{ bring: { smokedfish: 20 } }, { level: ["husbandry", 22] }], reward: { coins: 3000, xp: { husbandry: 2000, fishing: 800 } } },
      { id: "fern_truffles", name: "The pigs know best", text: "\"Truffles! Twelve, and the inn will pay a king's ransom. Well -- a farmer's.\"",
        needs: [{ bring: { truffle: 12 } }, { level: ["husbandry", 26] }], reward: { coins: 5000, items: { ancientchest: 1 }, xp: { husbandry: 4000 } } },
      { id: "fern_show", name: "Best in show", text: "\"Win a blue rosette at the show ring and I'll hang it over the stall for all to see.\"",
        needs: [{ bring: { rosette: 1 } }, { level: ["husbandry", 28] }], reward: { coins: 4000, items: { ironcrate: 1 }, xp: { husbandry: 3000 } } },
      { id: "fern_foal", name: "New life", text: "\"Raise me something born on this farm. There's nothing like it.\"",
        needs: [{ level: ["husbandry", 36] }, { bred: 1 }], reward: { coins: 8000, xp: { husbandry: 8000 } } }] };
  questProgressHooks.push(function (s, n, out) {                       // "raise one on the farm": young born in the Paddock
    if (n.bred) out.push({ text: "Animals born on your Farm", have: Math.min(n.bred, (s.ranch && s.ranch.born) || 0), need: n.bred });
  });

  function ranchOpen(s) { return !!(s && s.quests && s.quests[RANCH_QUEST]); }
  function ranchBox(s) { s.ranch = s.ranch || {}; s.ranch.b = s.ranch.b || {}; s.ranch.next = s.ranch.next || 1; return s.ranch; }
  function ranchBuilding(s, id) {
    var b = ranchBox(s).b;
    b[id] = b[id] || { tier: 0, animals: [], ready: {}, cleanAt: 0 };
    if (RANCH[id].slots && !b[id].slots) b[id].slots = [];
    if (RANCH[id].pairs && !b[id].pairs) b[id].pairs = [];
    return b[id];
  }
  function newAnimal(s, kind, at, traits) {
    var r = ranchBox(s), L = LIVESTOCK[kind], n = r.next++;
    var a = { id: "a" + n, kind: kind, name: L.names[(n - 1) % L.names.length], t: at, prog: 0, fedUntil: 0, n: 0 };
    if (traits) { a.breed = traits.breed; a.stars = traits.stars || 0; if (traits.young) a.young = traits.young; }
    return a;
  }
  function ranchHelper(s) { var p = s.pet; return p && p.species && !p.away && p.stage !== "egg" ? p.species : ""; }
  function fedFor(s) { return ranchHelper(s) === "cat" ? Math.round(RANCH_FED * 1.25) : RANCH_FED; }   // a barn cat guards the feed
  function roundTime(s, bid, b, L) {
    var t = L.every * RANCH[bid].tiers[b.tier].speed;
    if (bid === "shearing" && ranchHelper(s) === "dog") t *= 0.8;          // a sheepdog: the sheep come in quicker
    return Math.round(t);
  }
  function artOf(a) { return a.breed || LIVESTOCK[a.kind].art; }
  function isRare(a) { return !!(a.breed && a.breed !== LIVESTOCK[a.kind].art); }
  function animalPrice(a) { var L = LIVESTOCK[a.kind]; return Math.round(L.sell * (1 + 0.5 * (a.stars || 0)) * (isRare(a) ? 1.5 : 1)); }
  function readyOf(b) { return Object.keys(b.ready || {}).reduce(function (a, k) { return a + (b.ready[k] || 0); }, 0); }
  /** The rounds a building keeps waiting at most: three for each grown animal in it (a bonus doesn't count). */
  function waitCap(b) { return RANCH_WAIT * b.animals.filter(function (a) { return !a.young; }).length; }
  function isFull(b) { return (b.rounds || 0) >= waitCap(b); }
  /** How many grown animals of a kind you have (the carts ask for ponies and draft horses). */
  function ranchCount(s, kind) {
    var L = LIVESTOCK[kind], b = s && s.ranch && s.ranch.b && s.ranch.b[L.home];
    return b ? b.animals.filter(function (a) { return a.kind === kind && !a.young; }).length : 0;
  }
  var GOOD_XP = {};
  Object.keys(LIVESTOCK).forEach(function (k) { var L = LIVESTOCK[k]; GOOD_XP[L.gives] = Math.max(GOOD_XP[L.gives] || 0, L.xp / (L.n || 1)); });
  function breedName(art) {
    return ({ "cow/jersey": "a Jersey", "cow/highland": "a Highland", "goose/grey": "a grey goose", "sheep/black": "a black sheep", "pony/shetland": "a Shetland",
              "drafthorse/grey": "a dapple grey" })[art] || "";
  }
  /** Work the Farm forward to now: a round of goods for each full round an animal was fed (while there's room to keep them),
   *  cultures set, young ones born and grown. */
  function resolveRanch(s, now) {
    if (!s.ranch) {
      if (!ranchOpen(s)) return;
      ranchBox(s);
    }
    var r = ranchBox(s);
    if (ranchOpen(s) && !r.opened) {                                   // Fern's quest done: the coop, and two hens to start
      var at = Math.min(now, s.quests[RANCH_QUEST] || now), coop = ranchBuilding(s, "coop");
      r.opened = at;
      if (!coop.tier) coop.tier = 1;
      while (coop.animals.length < 2) { var h = newAnimal(s, "hen", at); h.fedUntil = at + RANCH_FED; coop.animals.push(h); }
    }
    RANCH_ORDER.forEach(function (bid) {
      var b = r.b[bid];
      if (!b || !b.tier) return;
      b.animals.forEach(function (a) {
        var L = LIVESTOCK[a.kind];
        if (a.young) {                                                   // a young one grows; it gives nothing yet
          if (a.young <= now) { note(s, a.young, a.name + " the " + L.name.toLowerCase() + " has grown up."); a.t = Math.max(a.t, a.young); delete a.young; }
          else { a.t = now; return; }
        }
        var every = roundTime(s, bid, b, L), end = L.eats ? Math.min(now, a.fedUntil || 0) : now;   // bees fetch their own
        if (end > a.t) {
          var cur = a.t - a.prog;
          while (cur + every <= end) {
            cur += every;
            if (isFull(b)) { cur = end; break; }                         // full: the round's lost, and the clock waits
            a.n++;
            b.rounds = (b.rounds || 0) + 1;
            var more = (b.cleanAt && cur - b.cleanAt < RANCH_CLEAN && a.n % 4 === 2 ? 1 : 0) +            // mucked out
                       (b.brushAt && cur - b.brushAt < RANCH_BRUSH && a.n % 4 === 0 ? 1 : 0) +            // brushed
                       (a.stars && a.n % (5 - a.stars) === 0 ? 1 : 0);                                    // bred for yield
            b.ready[L.gives] = (b.ready[L.gives] || 0) + (L.n || 1) + more;
            if (L.extra && a.n % L.extra.each === 0) b.ready[L.extra.id] = (b.ready[L.extra.id] || 0) + L.extra.n;
          }
          a.prog = isFull(b) ? 0 : end - cur;
        }
        a.t = Math.max(a.t, now);
      });
      (b.slots || []).forEach(function (sl) {                            // the Culture room, Greenhouse, Smokehouse: a shelf's batch set
        if (!sl.done && sl.until <= now) { sl.done = true; note(s, sl.until, "In the " + RANCH[bid].name + ": " + sl.n + " × " + ITEMS[sl.make].name.toLowerCase() + " ready."); }
      });
      (b.pairs || []).slice().forEach(function (pr) {                    // the Paddock: a young one, into its home when there's room
        if (pr.until > now) return;
        var L = LIVESTOCK[pr.kind], home = ranchBuilding(s, L.home), T = RANCH[L.home].tiers[home.tier];
        if (!home.tier || !T || home.animals.length >= T.cap) {
          if (!pr.waited) { pr.waited = true; note(s, pr.until, "A young " + L.name.toLowerCase() + " is waiting in the Paddock -- the " + RANCH[L.home].name.toLowerCase() + " is full."); }
          return;
        }
        var born = pr.until;
        var y = newAnimal(s, pr.kind, now, { breed: pr.child.breed, stars: pr.child.stars, young: pr.until + L.breed * DAY });
        y.fedUntil = now + RANCH_FED;
        if (y.young <= now) delete y.young;
        home.animals.push(y);
        r.born = (r.born || 0) + 1;
        b.pairs.splice(b.pairs.indexOf(pr), 1);
        note(s, born, "Born on your Farm: " + y.name + ", a young " + L.name.toLowerCase() + (isRare(y) ? " -- " + breedName(y.breed) + "!" : "") +
             (y.stars ? " (" + y.stars + "★ yield)" : "") + ". It grows up in " + L.breed + " day" + (L.breed === 1 ? "" : "s") + ".");
      });
    });
  }
  function needsOf(m, b, inf) {
    var needs = Object.keys(m.needs).map(function (k) { return { id: k, name: ITEMS[k].name, need: m.needs[k], have: inf ? 999 : b[k] || 0 }; });
    return { needs: needs, times: inf ? 10 : Math.min.apply(null, needs.map(function (n) { return Math.floor(n.have / n.need); })) };
  }
  /** The Show ring's judges: 1 to start, +1 a yield star, +2 a rare breed, +1 each for its home brushed and mucked out today. */
  function showScore(a, home, now) {
    return 1 + (a.stars || 0) + (isRare(a) ? 2 : 0) + (home.brushAt && now - home.brushAt < RANCH_BRUSH ? 1 : 0) + (home.cleanAt && now - home.cleanAt < RANCH_CLEAN ? 1 : 0);
  }
  function showOdds(score) { return Math.min(0.6, 0.05 + 0.07 * score); }                   // a first; a second is the next quarter
  function showView(s, r, now) {
    var ring = (r.b || {}).showring || {}, pairs = (((r.b || {}).paddock || {}).pairs || []), out = [];
    LIVESTOCK_ORDER.forEach(function (k) {
      var L = LIVESTOCK[k], home = (r.b || {})[L.home];
      if (!L.breed || !home) return;                                     // bees don't go in the ring
      home.animals.forEach(function (a) {
        if (a.kind !== k || a.young || pairs.some(function (p) { return p.a === a.id || p.b === a.id; })) return;
        var sc = showScore(a, home, now);
        out.push({ id: a.id, name: a.name, kindName: L.name, art: artOf(a), pic: L.pic, score: sc, odds: Math.round(showOdds(sc) * 100), wins: a.wins || 0, champion: (a.wins || 0) >= RANCH_SHOW.champion });
      });
    });
    var done = !!(ring.showAt && now - ring.showAt < DAY);
    return { done: done, nextIn: done ? Math.ceil((ring.showAt + DAY - now) / 1000) : 0, entrants: out, shows: r.shows || 0, firsts: r.firsts || 0 };
  }
  function isSaturday(now) { return new Date(now).getDay() === 6; }
  function ranchView(s, now) {
    s = s || {};
    var pl = s.player || {}, b = s.bag || {}, inf = s.dev && s.dev.infinite, open = ranchOpen(s), r = s.ranch || { b: {} };
    var hus = levelOf((pl.skills || {}).husbandry || 0), con = levelOf((pl.skills || {}).construction || 0);
    var pairsNow = (((r.b || {}).paddock || {}).pairs || []);
    var buildings = RANCH_ORDER.map(function (bid) {
      var R = RANCH[bid], bb = (r.b || {})[bid] || { tier: 0, animals: [], ready: {}, cleanAt: 0 }, T = R.tiers[bb.tier] || null, nx = R.tiers[bb.tier + 1], next = null;
      if (nx && nx.needs) {                                            // (the coop's first tier comes with Fern's quest)
        var needs = Object.keys(nx.needs).map(function (k) { return { id: k, name: ITEMS[k].name, need: nx.needs[k], have: inf ? 999 : b[k] || 0 }; });
        next = { tier: bb.tier + 1, name: HOUSE_TIERS[bb.tier + 1], cap: nx.cap, hus: nx.hus, con: nx.con, coins: nx.coins, xp: nx.xp, needs: needs,
                 hours: R.kinds.length ? Math.round(LIVESTOCK[R.kinds[0]].every * nx.speed / HOUR * 10) / 10 : 0, slots: !!R.slots, pairs: !!R.pairs,
                 can: (inf || (hus >= nx.hus && con >= nx.con && (s.coins || 0) >= nx.coins)) && needs.every(function (n) { return n.have >= n.need; }) };
      }
      var animals = bb.animals.map(function (a) {
        var L = LIVESTOCK[a.kind], fed = !L.eats || (a.fedUntil || 0) > (now || 0), every = T ? roundTime(s, bid, bb, L) : L.every, full = isFull(bb);
        return { id: a.id, kind: a.kind, kindName: L.name, name: a.name, pic: L.pic, art: artOf(a), breed: isRare(a) ? breedName(a.breed) : "", stars: a.stars || 0,
                 young: a.young ? Math.max(1, Math.ceil((a.young - now) / 1000)) : 0, sell: animalPrice(a),
                 fed: fed, fedFor: fed && L.eats ? Math.ceil((a.fedUntil - now) / 1000) : 0, free: !L.eats,
                 hungry: !fed && !a.young, full: full, nextIn: fed && !full && !a.young ? Math.max(1, Math.ceil((every - a.prog) / 1000)) : 0,
                 feedable: !!L.eats && !a.young && (a.fedUntil || 0) - (now || 0) < RANCH_FED / 2, wins: a.wins || 0,
                 pairing: pairsNow.some(function (p) { return p.a === a.id || p.b === a.id; }) };
      });
      var v = { id: bid, name: R.name, says: R.says, opens: R.opens, lock: hus < R.opens ? "Husbandry " + R.opens : "", tier: bb.tier, tierName: bb.tier ? HOUSE_TIERS[bb.tier] : "Not built",
               cap: T ? T.cap : 0, animals: animals, hours: T && R.kinds.length ? Math.round(LIVESTOCK[R.kinds[0]].every * T.speed / HOUR * 10) / 10 : 0,
               kinds: R.kinds.slice(), care: R.care !== false,
               ready: Object.keys(bb.ready || {}).filter(function (k) { return bb.ready[k] > 0; }).map(function (k) { return { id: k, name: ITEMS[k].name, n: bb.ready[k] }; }),
               waiting: readyOf(bb), hungry: animals.filter(function (a) { return a.hungry; }).length, feedable: animals.filter(function (a) { return a.feedable; }).length,
               clean: !!(bb.cleanAt && (now || 0) - bb.cleanAt < RANCH_CLEAN), cleanIn: bb.cleanAt ? Math.max(0, Math.ceil((bb.cleanAt + RANCH_CLEAN - (now || 0)) / 1000)) : 0,
               brushed: !!(bb.brushAt && (now || 0) - bb.brushAt < RANCH_BRUSH), brushIn: bb.brushAt ? Math.max(0, Math.ceil((bb.brushAt + RANCH_BRUSH - (now || 0)) / 1000)) : 0,
               next: next };
      if (RANCH_MAKE[bid]) v.make = RANCH_MAKE[bid].map(function (m, i) { var x = needsOf(m, b, inf); return { i: i, make: m.make, name: ITEMS[m.make].name, n: m.n, needs: x.needs, times: x.times }; });
      if (R.slots) {
        v.recipes = RANCH_SLOTS[bid].map(function (m, i) { var x = needsOf(m, b, inf), fl = m.farm && !inf && levelOf((pl.skills || {}).farming || 0) < m.farm;
          return { i: i, make: m.make, name: ITEMS[m.make].name, n: m.n, hours: m.hours, needs: x.needs, can: x.times > 0 && !fl, lock: fl ? "Farming " + m.farm : "" }; });
        v.slots = (bb.slots || []).map(function (sl, i) { return { i: i, make: sl.make, name: ITEMS[sl.make].name, n: sl.n, done: !!sl.done || sl.until <= now, endsIn: Math.max(0, Math.ceil((sl.until - now) / 1000)) }; });
        v.free = Math.max(0, v.cap - v.slots.length);
        v.waiting = v.slots.filter(function (x) { return x.done; }).length;
      }
      if (R.pairs) {
        v.pairs = (bb.pairs || []).map(function (p) { var L = LIVESTOCK[p.kind];
          return { kind: p.kind, kindName: L.name, endsIn: Math.max(0, Math.ceil((p.until - now) / 1000)), waiting: p.until <= now, names: [p.aName, p.bName] }; });
        v.free = Math.max(0, v.cap - v.pairs.length);
      }
      if (R.show) v.show = showView(s, r, now);
      return v;
    });
    var all = [].concat.apply([], buildings.map(function (x) { return x.animals; }));
    var pairable = LIVESTOCK_ORDER.filter(function (k) { return LIVESTOCK[k].breed; }).map(function (k) {
      var free = all.filter(function (a) { return a.kind === k && !a.young && !a.pairing; });
      return { kind: k, name: LIVESTOCK[k].name, plural: LIVESTOCK[k].plural, days: LIVESTOCK[k].breed,
               animals: free.map(function (a) { return { id: a.id, name: a.name, stars: a.stars, breed: a.breed }; }) };
    }).filter(function (x) { return x.animals.length >= 2; });
    return {
      open: open, here: !!(s.player && !pl.island && !pl.voyage), hus: hus, fern: personView(s, "ranch"), feed: b.grainfeed || 0, hay: b.hay || 0,
      buildings: buildings, pairable: pairable, born: r.born || 0,
      churn: RANCH_CHURN.map(function (m, i) { var x = needsOf(m, b, inf); return { i: i, make: m.make, name: ITEMS[m.make].name, n: m.n, needs: x.needs, times: x.times }; }),
      culture: RANCH_CULTURE.map(function (m, i) { var x = needsOf(m, b, inf); return { i: i, make: m.make, name: ITEMS[m.make].name, n: m.n, hours: m.hours, needs: x.needs, can: x.times > 0 }; }),
      mill: RANCH_FEED.map(function (m, i) { var x = needsOf(m, b, inf); return { i: i, make: m.make, name: ITEMS[m.make].name, n: m.n, needs: x.needs, times: x.times }; }),
      stall: LIVESTOCK_ORDER.map(function (k) {
        var L = LIVESTOCK[k], home = buildings.filter(function (x) { return x.id === L.home; })[0];
        var why = !open ? "Help Fern first" : hus < L.opens ? "Husbandry " + L.opens : !home || !home.tier ? "Build the " + RANCH[L.home].name.toLowerCase() + " first"
          : home.animals.length >= home.cap ? "The " + RANCH[L.home].name.toLowerCase() + " is full" : (s.coins || 0) < L.buy && !inf ? "Not enough coins" : "";
        return { kind: k, name: L.name, pic: L.pic, art: L.art, price: L.buy, sell: L.sell, home: RANCH[L.home].name, every: L.every / HOUR, gives: ITEMS[L.gives].name,
                 eats: L.eats ? ITEMS[L.eats].name : "", can: !why, why: why };
      }),
      market: { open: isSaturday(now || 0), rate: RANCH_MARKET, goods: RANCH_GOODS.filter(function (k) { return (b[k] || 0) > 0; }).map(function (k) {
        return { id: k, name: ITEMS[k].name, have: b[k], each: Math.round(priceOf(k) * RANCH_MARKET * 100) / 100, all: Math.floor(priceOf(k) * RANCH_MARKET * b[k]) }; }) },
      helper: ranchHelper(s) === "dog" ? "Your dog brings the sheep in: shearing's a fifth quicker." : ranchHelper(s) === "cat" ? "Your cat keeps the mice off the feed: it lasts a quarter longer." : "",
      waiting: buildings.reduce(function (a, x) { return a + (x.waiting || 0); }, 0), hungry: buildings.reduce(function (a, x) { return a + x.hungry; }, 0)
    };
  }
  function ranchXp(s, xp, now) { addXp(s, s.player, "husbandry", Math.round(xp * RANCH_PACE), now); }
  var RANCH_ACTS = CONTENT("RANCH_ACTS");
  /** ranchbuy {kind} · ranchsell {id} · ranchfeed/ranchcollect {building | "all"} · ranchclean/ranchbrush {building} · ranchmill/ranchchurn {i, times}
   *  · ranchculture {building, i} · ranchpair {a, b, roll, roll2} · ranchbuild {building} · ranchmarket {id, n} · ranchshow {id, roll}
   *  (ranchchurn takes a `building` too -- the Dairy, the Beehives' candle bench, the Windmill) */
  function ranchAct(s, action, opts, now) {
    if (RANCH_ACTS.indexOf(action) < 0) return null;
    if (!ranchOpen(s)) return no(s, "The Farm's all overgrown -- Fern wants a word first.");
    resolveRanch(s, now);
    var inf = s.dev && s.dev.infinite, hus = levelOf(s.player.skills.husbandry || 0);
    if ((action === "ranchfeed" || action === "ranchcollect") && opts.building === "all") {          // the well and trough: everyone at once
      var got = 0, msgs = [];
      RANCH_ORDER.forEach(function (bid) {
        var bb = (s.ranch.b || {})[bid];
        if (!bb || !bb.tier || (!RANCH[bid].kinds.length && !(action === "ranchcollect" && RANCH[bid].slots))) return;
        var r1 = ranchAct(s, action, { building: bid }, now);
        if (r1 && r1.ok) { got++; msgs.push(r1.msg); s = r1.state; }
      });
      if (!got) return no(s, action === "ranchfeed" ? "Nobody's hungry -- or there's no feed for them." : "Nothing's ready on the Farm yet.");
      return { ok: true, msg: msgs.join(" "), state: s };
    }
    var bid = action === "ranchshow" ? "showring" : opts.building || "coop", R = RANCH[bid], b = R ? ranchBuilding(s, bid) : null;
    if (action === "ranchmill" || action === "ranchchurn") {
      var churn = action === "ranchchurn", mb = churn ? (RANCH_MAKE[opts.building] ? opts.building : "dairy") : "", MR = RANCH[mb];
      var m = (churn ? RANCH_MAKE[mb] : RANCH_FEED)[opts.i | 0];
      if (churn && !(ranchBuilding(s, mb).tier)) return no(s, hus < MR.opens ? "The " + MR.name + " opens at Husbandry " + MR.opens + "." : "Build the " + MR.name + " first.");
      if (!m) return no(s, churn ? "The " + MR.name + " doesn't make that." : "The Feed store doesn't make that.");
      var times = Math.max(1, Math.min(50, opts.times === "all" ? 50 : Math.floor(+opts.times || 1)));
      Object.keys(m.needs).forEach(function (k) { if (!inf) times = Math.min(times, Math.floor((s.bag[k] || 0) / m.needs[k])); });
      if (times < 1) return no(s, "It takes " + itemsText(m.needs) + ".");
      if (!roomFor(s, m.make) || stackRoom(s, m.make) < m.n) return no(s, "Your bag has no room for the " + ITEMS[m.make].name.toLowerCase() + ".");
      times = Math.min(times, Math.floor(stackRoom(s, m.make) / m.n));
      Object.keys(m.needs).forEach(function (k) { take(s, k, m.needs[k] * times); });
      give(s, m.make, m.n * times);
      ranchXp(s, churn ? RANCH_XP.churn * times : RANCH_XP.mill * m.n * times, now);
      return yes(s, now, churn ? (mb === "dairy" ? "You churned " : mb === "mill" ? "You ground " : "You made ") + m.n * times + " × " + ITEMS[m.make].name.toLowerCase() + " at the " + MR.name + "."
                               : "You made " + m.n * times + " × " + ITEMS[m.make].name.toLowerCase() + " at the Feed store.");
    }
    if (action === "ranchmarket") {                                      // Saturday's farmers' market, at Fern's stall
      if (!isSaturday(now)) return no(s, "The farmers' market is on Saturdays -- Marlow buys the rest of the week.");
      var gid = opts.id, have = (s.bag || {})[gid] || 0;
      if (RANCH_GOODS.indexOf(gid) < 0) return no(s, "The market only takes what the Farm makes.");
      var mn = opts.n === "all" ? have : Math.min(have, Math.floor(+opts.n || 1));
      if (mn < 1) return no(s, "You haven't any " + ITEMS[gid].name.toLowerCase() + ".");
      var pay = Math.floor(priceOf(gid) * RANCH_MARKET * mn);
      take(s, gid, mn); s.coins = (s.coins || 0) + pay;
      return yes(s, now, "Sold " + mn + " × " + ITEMS[gid].name.toLowerCase() + " at the farmers' market for " + pay + " coins.");
    }
    if (action === "ranchbuy") {
      var L = LIVESTOCK[opts.kind];
      if (!L) return no(s, "Fern hasn't got any of those.");
      if (hus < L.opens) return no(s, "Fern says " + L.plural + " need Husbandry level " + L.opens + " (you're " + hus + ").");
      var home = ranchBuilding(s, L.home), T = RANCH[L.home].tiers[home.tier];
      if (!home.tier) return no(s, "Build the " + RANCH[L.home].name.toLowerCase() + " first.");
      if (home.animals.length >= T.cap) return no(s, "The " + RANCH[L.home].name.toLowerCase() + " is full (" + T.cap + "). Build it bigger for more.");
      if (!inf && !hasCoins(s, L.buy)) return no(s, "A " + L.name.toLowerCase() + " costs " + L.buy + " coins -- you have " + (s.coins || 0) + ".");
      spend(s, L.buy);
      var a = newAnimal(s, opts.kind, now);
      home.animals.push(a);
      return yes(s, now, "Fern brought you " + a.name + ", a " + L.name.toLowerCase() + ". She'll want feeding.");
    }
    var find = function (id) { var out = null; RANCH_ORDER.forEach(function (k) { var bb = (s.ranch.b || {})[k]; if (bb) bb.animals.forEach(function (x, i) { if (x.id === id) out = { b: bb, i: i, a: x }; }); }); return out; };
    var inPaddock = function (id) { return (((s.ranch.b || {}).paddock || {}).pairs || []).some(function (p) { return p.a === id || p.b === id; }); };
    if (action === "ranchsell") {
      var hit = find(opts.id);
      if (!hit) return no(s, "There's no animal like that on your Farm.");
      if (inPaddock(opts.id)) return no(s, hit.a.name + " is out in the Paddock -- wait till the young one comes.");
      var price = animalPrice(hit.a);
      hit.b.animals.splice(hit.i, 1);
      s.coins = (s.coins || 0) + price;
      return yes(s, now, "Fern took " + hit.a.name + " back to her own yard, and gave you " + price + " coins.");
    }
    if (action === "ranchpair") {                                        // the Paddock (step 8)
      var pd = ranchBuilding(s, "paddock");
      if (!pd.tier) return no(s, hus < RANCH.paddock.opens ? "The Paddock opens at Husbandry " + RANCH.paddock.opens + "." : "Build the Paddock first.");
      var pcap = RANCH.paddock.tiers[pd.tier].cap;
      if (pd.pairs.length >= pcap) return no(s, "The Paddock has room for " + pcap + " pair" + (pcap === 1 ? "" : "s") + " -- wait for the young one.");
      var ha = find(opts.a), hb = find(opts.b);
      if (!ha || !hb || ha.a === hb.a) return no(s, "Pick two animals.");
      var pa = ha.a, pb = hb.a;
      if (pa.kind !== pb.kind) return no(s, "Two of a kind -- a " + LIVESTOCK[pa.kind].name.toLowerCase() + " and a " + LIVESTOCK[pb.kind].name.toLowerCase() + " won't do.");
      if (pa.young || pb.young) return no(s, "They have to be grown up.");
      if (inPaddock(pa.id) || inPaddock(pb.id)) return no(s, "One of them's out in the Paddock already.");
      if (!LIVESTOCK[pa.kind].breed) return no(s, "Bees make their own queens -- they don't go out in the Paddock.");
      var PL = LIVESTOCK[pa.kind], roll = typeof opts.roll === "number" ? opts.roll : 0.5, roll2 = typeof opts.roll2 === "number" ? opts.roll2 : 0.5;
      var child = (PL.rare || []).length && roll < RANCH_RARE ? PL.rare[Math.floor(roll / RANCH_RARE * PL.rare.length) % PL.rare.length] : roll < 0.56 ? artOf(pa) : artOf(pb);
      var stars = Math.min(RANCH_STARS, Math.max(pa.stars || 0, pb.stars || 0) + (roll2 < RANCH_STAR ? 1 : 0));
      pd.pairs.push({ kind: pa.kind, a: pa.id, b: pb.id, aName: pa.name, bName: pb.name, at: now, until: now + PL.breed * DAY, child: { breed: child, stars: stars } });
      ranchXp(s, RANCH_XP.pair, now);
      return yes(s, now, pa.name + " and " + pb.name + " are out in the Paddock together -- a young one in " + PL.breed + " day" + (PL.breed === 1 ? "" : "s") + ".");
    }
    if (!R) return no(s, "There's nothing like that on your Farm.");
    if (action === "ranchbuild") {
      var nt = R.tiers[b.tier + 1];
      if (!inf && hus < R.opens) return no(s, "The " + R.name.toLowerCase() + " opens at Husbandry " + R.opens + " (you're " + hus + ").");
      if (!nt) return no(s, "The " + R.name.toLowerCase() + " is as grand as it gets.");
      if (!nt.needs) return no(s, "The " + R.name.toLowerCase() + " comes with Fern's quest.");
      var cl = levelOf(s.player.skills.construction || 0);
      if (!inf && hus < nt.hus) return no(s, "That needs Husbandry level " + nt.hus + " (you're " + hus + ").");
      if (!inf && cl < nt.con) return no(s, "That needs Construction level " + nt.con + " (you're " + cl + ").");
      var short = Object.keys(nt.needs).filter(function (q) { return !has(s, q, nt.needs[q]); });
      if (short.length) return no(s, "Not enough " + short.map(function (q) { return ITEMS[q].name.toLowerCase(); }).join(" or ") + " -- it takes " + itemsText(nt.needs) + ".");
      if (!inf && !hasCoins(s, nt.coins)) return no(s, "It costs " + nt.coins + " coins -- you have " + (s.coins || 0) + ".");
      Object.keys(nt.needs).forEach(function (q) { take(s, q, nt.needs[q]); });
      spend(s, nt.coins);
      b.tier++;
      addXp(s, s.player, "construction", nt.xp, now);
      ranchXp(s, RANCH_XP.build, now);
      if (!R.kinds.length) return yes(s, now, "You built " + (b.tier > 1 ? aOr(HOUSE_TIERS[b.tier]) + " " : "the ") + R.name.toLowerCase() + " (+" + nt.xp + " Construction xp)" +
                                       (R.slots ? ": room for " + nt.cap + " batches at a time." : R.pairs ? ": room for " + nt.cap + " pair" + (nt.cap === 1 ? "" : "s") + " at a time." : "."));
      return yes(s, now, "You built " + aOr(HOUSE_TIERS[b.tier]) + " " + R.name.toLowerCase() + " (+" + nt.xp + " Construction xp): room for " + nt.cap + " " +
                 R.kinds.map(function (k) { return LIVESTOCK[k].plural; }).join(" and ") + ", a round every " + Math.round(LIVESTOCK[R.kinds[0]].every * nt.speed / HOUR * 10) / 10 + " hours.");
    }
    if (!b.tier) return no(s, "The " + R.name.toLowerCase() + " isn't built yet.");
    if (action === "ranchculture") {                                     // the Culture room (step 5), the Greenhouse and the Smokehouse (11)
      if (!R.slots) return no(s, "Shelves are in the Culture room, the Greenhouse and the Smokehouse.");
      var cm = RANCH_SLOTS[bid][opts.i | 0];
      if (!cm) return no(s, "The " + R.name + " doesn't make that.");
      if (cm.farm && !inf && levelOf(s.player.skills.farming || 0) < cm.farm) return no(s, "That needs Farming level " + cm.farm + ".");
      if (b.slots.length >= R.tiers[b.tier].cap) return no(s, "Every shelf's taken -- collect what's ready, or wait.");
      if (!inf && Object.keys(cm.needs).some(function (k) { return !has(s, k, cm.needs[k]); })) return no(s, "It takes " + itemsText(cm.needs) + ".");
      Object.keys(cm.needs).forEach(function (k) { take(s, k, cm.needs[k]); });
      b.slots.push({ make: cm.make, n: cm.n, at: now, until: now + cm.hours * HOUR });
      ranchXp(s, RANCH_XP.culture, now);
      return yes(s, now, (bid === "glass" ? "You planted " : bid === "smoke" ? "You hung " : "You set ") + itemsText(cm.needs) + (bid === "culture" ? " to " : " for ") +
                 ITEMS[cm.make].name.toLowerCase() + " -- ready in " + cm.hours + " hours.");
    }
    if (action === "ranchcollect" && R.slots) {
      var done = b.slots.filter(function (x) { return x.done; }), took = [];
      if (!done.length) return no(s, "Nothing's ready yet in the " + R.name + ".");
      done.forEach(function (x) { if (roomFor(s, x.make) && stackRoom(s, x.make) >= x.n) { give(s, x.make, x.n); took.push(x); } });
      if (!took.length) return no(s, "Your bag has no room -- store things at home first.");
      b.slots = b.slots.filter(function (x) { return took.indexOf(x) < 0; });
      ranchXp(s, RANCH_XP.shelf * took.length, now);                   // taking a batch down pays too (2026-10-13)
      if (bid === "smoke") addXp(s, s.player, "cooking", took.reduce(function (t, x) { return t + 6 * x.n; }, 0), now);
      if (bid === "glass") addXp(s, s.player, "farming", took.reduce(function (t, x) { return t + 3 * x.n; }, 0), now);
      return yes(s, now, "You took " + took.map(function (x) { return x.n + " × " + ITEMS[x.make].name.toLowerCase(); }).join(", ") + " from the " + R.name + ".");
    }
    if (action === "ranchshow") {                                        // the Show ring (step 11)
      if (!R.show) return no(s, "Shows are held in the Show ring.");
      if (b.showAt && now - b.showAt < DAY) return no(s, "One show a day -- the judges are back in " + Math.ceil((b.showAt + DAY - now) / HOUR) + " hours.");
      var sh = find(opts.id);
      if (!sh) return no(s, "Pick an animal to show.");
      var SL = LIVESTOCK[sh.a.kind];
      if (!SL.breed) return no(s, "Bees don't go in the ring.");
      if (sh.a.young) return no(s, sh.a.name + " is too young to show.");
      if (inPaddock(sh.a.id)) return no(s, sh.a.name + " is out in the Paddock.");
      if (!roomForKinds(s, ["rosette", "redrosette"].concat((sh.a.wins || 0) === RANCH_SHOW.champion - 1 ? ["trophy"] : [])))
        return no(s, "Make room in your bag for a prize first.");
      var sc = showScore(sh.a, sh.b, now), sroll = typeof opts.roll === "number" ? opts.roll : 0.5, odds = showOdds(sc);
      var place = sroll < odds ? "first" : sroll < odds + RANCH_SHOW.second_odds ? "second" : "";
      var P = place ? RANCH_SHOW[place] : RANCH_SHOW.also, rb = ranchBox(s), extra = "";
      b.showAt = now; rb.shows = (rb.shows || 0) + 1;
      if (P.item) give(s, P.item, 1);
      if (P.coins) s.coins = (s.coins || 0) + P.coins;
      ranchXp(s, P.xp, now);
      if (place === "first") {
        rb.firsts = (rb.firsts || 0) + 1;
        sh.a.wins = (sh.a.wins || 0) + 1;
        if (sh.a.wins === RANCH_SHOW.champion) {
          var TR = RANCH_SHOW.trophy;
          give(s, TR.item, 1); s.coins += TR.coins; ranchXp(s, TR.xp, now);
          extra = " Three firsts: " + sh.a.name + " is a champion! A silver cup and " + TR.coins + " coins.";
        }
      }
      return yes(s, now, (place === "first" ? sh.a.name + " took first prize! A blue rosette and " + P.coins + " coins."
                        : place === "second" ? sh.a.name + " came second: a red rosette and " + P.coins + " coins."
                        : sh.a.name + " was commended -- the judges liked the " + SL.name.toLowerCase() + ", but not quite enough.") + extra);
    }
    if (!R.kinds.length) return no(s, "There are no animals in the " + R.name.toLowerCase() + ".");
    if (action === "ranchcollect") {
      var got2 = [], left = 0, xp = 0;
      Object.keys(b.ready).forEach(function (k) {
        var n = b.ready[k] || 0, fit = roomFor(s, k) ? Math.min(n, stackRoom(s, k)) : 0;
        if (fit > 0) { give(s, k, fit); got2.push(fit + " × " + ITEMS[k].name.toLowerCase()); if (GOOD_XP[k]) xp += GOOD_XP[k] * fit; }
        b.ready[k] = n - fit; left += n - fit;
        if (!b.ready[k]) delete b.ready[k];
      });
      if (!got2.length) return no(s, left ? "Your bag has no room -- store things at home first." : "Nothing's ready in the " + R.name.toLowerCase() + " yet.");
      b.rounds = Math.min(b.rounds || 0, R.kinds.reduce(function (a, k) { return a + Math.ceil((b.ready[LIVESTOCK[k].gives] || 0) / (LIVESTOCK[k].n || 1)); }, 0));   // what's left still counts
      if (xp) ranchXp(s, Math.round(xp), now);
      return yes(s, now, "You collected " + got2.join(" and ") + " from the " + R.name.toLowerCase() + "." + (left ? " The rest waits -- your bag's full." : ""));
    }
    if (action === "ranchfeed") {
      var want = b.animals.filter(function (x) { return LIVESTOCK[x.kind].eats && !x.young && (x.fedUntil || 0) - now < RANCH_FED / 2 && (!opts.id || x.id === opts.id); });
      if (!want.length) return no(s, R.care === false ? "Bees fetch their own flowers -- no feeding." : b.animals.length ? "They've all eaten -- come back in a few hours." : "There's nobody in the " + R.name.toLowerCase() + " to feed.");
      var fedN = 0, used = [], shortOf = [], fed = fedFor(s), last = null;                 // each kind on its own feed
      want.forEach(function (x) {
        var eats = LIVESTOCK[x.kind].eats;
        if (!inf && !(s.bag[eats] > 0)) { if (shortOf.indexOf(eats) < 0) shortOf.push(eats); return; }
        take(s, eats, 1); x.fedUntil = now + fed; fedN++; last = x;
        var u = used.filter(function (y) { return y.id === eats; })[0]; if (u) u.n++; else used.push({ id: eats, n: 1 });
      });
      if (!fedN) return no(s, "You need " + shortOf.map(function (k) { return ITEMS[k].name.toLowerCase(); }).join(" and ") +
                              (shortOf.some(function (k) { return k === "potato" || k === "oats"; }) ? " -- from your garden, or the Feed store." : " -- make some at the Feed store."));
      ranchXp(s, RANCH_XP.feed * fedN, now);
      return yes(s, now, "You fed " + (fedN === 1 ? last.name : fedN + " animals") + " (" + used.map(function (u) { return u.n + " × " + ITEMS[u.id].name.toLowerCase(); }).join(", ") + ")" +
                 (shortOf.length ? " -- there wasn't enough for the rest." : "."));
    }
    if (action === "ranchclean" || action === "ranchbrush") {
      if (R.care === false) return no(s, "The bees keep their own hives -- nothing to muck out or brush.");
      var brush = action === "ranchbrush", key = brush ? "brushAt" : "cleanAt", last2 = b[key], span = brush ? RANCH_BRUSH : RANCH_CLEAN;
      if (last2 && now - last2 < span) return no(s, brush ? "They're still glossy -- brush them again in " + Math.ceil((last2 + span - now) / HOUR) + " hours."
                                                         : "It's still clean -- muck out again in " + Math.ceil((last2 + span - now) / HOUR) + " hours.");
      if (brush && !b.animals.length) return no(s, "There's nobody to brush.");
      b[key] = now;
      if (!brush) give(s, "dung", 3);
      ranchXp(s, brush ? RANCH_XP.brush * Math.max(1, b.animals.length) : RANCH_XP.clean, now);
      return yes(s, now, brush ? "You brushed everyone in the " + R.name.toLowerCase() + ". Happy animals give a little more for a day."
                               : "You mucked out the " + R.name.toLowerCase() + " (3 × dung for the garden). Clean straw means more for a day.");
    }
    return null;
  }
  /** What a Husbandry level opens, for the level-up pop-up. */
  function ranchUnlocks(level) {
    var out = [];
    RANCH_ORDER.forEach(function (k) { if (RANCH[k].opens === level && level > 1) out.push({ icon: "obj_" + k, text: "Build the " + RANCH[k].name.toLowerCase() + " on your Farm" }); });
    LIVESTOCK_ORDER.forEach(function (k) { var L = LIVESTOCK[k]; if (L.opens === level && level > 1) out.push({ icon: L.gives, text: "Keep " + L.plural + " (Fern's stall)" }); });
    return out;
  }
  /** The Farm on the Today page (step 7): what's ready, who's hungry. */
  function ranchDash(s, now) {
    if (!ranchOpen(s)) return [];
    var v = ranchView(s, now), out = [];
    if (v.waiting) out.push({ kind: "ranch", icon: "obj_ranch", title: v.waiting + " thing" + (v.waiting === 1 ? "" : "s") + " ready on the Farm", sub: "Through your estate", go: "pet:estate" });
    if (v.hungry) out.push({ kind: "ranchhungry", icon: "grainfeed", title: v.hungry + " hungry animal" + (v.hungry === 1 ? "" : "s") + " on the Farm", sub: "Through your estate", go: "pet:estate" });
    return out;
  }
