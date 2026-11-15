  // ---- the tutorial (2026-10-11, Cam: "a pop up style tutorial which takes the player through all the basics. When starting
  //      a new game nothing even guides you where to find your first egg. Lets use a female character in the pharaoh outfit
  //      ... 'Hello there, welcome to Neurovale. This world can be a very dangerous place.' ... As a bonus you get gifted an
  //      age up potion which ages your first pet to 3 days, then the tutorial can take the player through expeditions ...
  //      chests, battles, stats, armour, food, stews, crafting, material gathering and NPC questing ... a gift at the end in
  //      the form of a rare egg and some other goodies like 5 iron crates, experience points in a skill of your choice that
  //      will level it to ten") --------------------------------------------------------------------------------------
  // Amunet, the island's keeper, walks a new player through the game one step at a time. A step either just explains (Next),
  // or waits for something done in the game (its check), with a place to go. Gifts are given once, on entering their step.
  // s.tutorial = { step, base: {...}, given: {...}, done, skipped, open: {expeditions} }. Only new games start it.
  var GUIDE = CONTENT("GUIDE");
  // `point`: where the red box goes, the click you need first -- the first of these on screen, so it follows you from the
  // Map or the Estate to the place and then the button (2026-10-11, Cam: "Have the tutorial actually tell you how to navigate
  // ... a growing and shrinking red rectangle over the spot you need to click").
  var P_ESTATE = '#np-pathbar [data-go="pet:estate"]', P_MAP = '#np-pathbar [data-go="pet:world"]', P_FARM = 'g.pp-region[data-region="farmyard"]';
  // your pet's page is a door in the House (the sidebar link went with the navigation game, B2 2026-10-19)
  var P_PET = ['.pp-spot[data-key="pet:home"]', '.pp-spot[data-key="pet:house"]', '#np-nav [data-go="pet:house"]', P_ESTATE];
  /** No name or look yet (the tutorial skipped before its first steps): a name and the young man's look, so the top bar, the Kit and
   *  the rest have someone to show (Cam, PT24: "i skipped the tutorial and didnt select a player avatar or name, have it default to
   *  any avatar and name player"). True if it gave them. */
  function defaultPlayer(s) {
    if (!s.player || s.player.made) return false;
    s.player.name = s.player.name || "Adventurer";
    s.player.look = s.player.look && s.player.look.body ? s.player.look : { skin: 0, hair: 0, outfit: 0, body: "m" };
    s.player.made = true;
    if (!s.story) s.story = { on: true };
    return true;
  }
  var TUTORIAL = [
    { id: "hello", say: ["Hello there, welcome to Neurovale!", "This world can be a very dangerous place -- wild creatures, deep caves, stormy seas. So let's get you prepared with all the basics. I'm Amunet, keeper of this island. Stick with me and you'll do just fine."] },
    { id: "body", say: ["First things first: are you a boy or a girl?"], body: true },
    { id: "name", say: ["Lovely to meet you! And what is your name?"], name: true },
    { id: "egg", say: ["Every adventurer in Neurovale needs a companion -- and every companion starts as an egg.",
        "Eggs are kept warm at the Hatchery, in the Nursery in the Village. Go there and take the Starter egg. What's inside is a surprise: a cat, a bunny, a frog... It hatches in a few minutes. Every egg you find later is hatched there too. Follow the red box -- I'll always show you where to click."],
      // (I6, 2026-10-19, Cam: "move the starter egg hatching ... to occur at the actual hatchery")
      goal: "Take your Starter egg at the Hatchery", go: "pet:hatchery", check: "egg",
      point: ["#pp-take", '.pp-egg[data-egg="starter"]', '.pp-spot[data-key="pet:hatchery"]', '.pp-spot[data-key="pet:nursery"]', 'g.pp-region[data-region="village"]', P_MAP] },
    { id: "pet", say: ["While it warms up, a word about pets. Your companion has needs -- food, play, a clean room and rest -- and a happy pet works harder.",
        "Feed it from your bag, play and pet it, and clean its room when it gets messy. A rug, a bed and a toy box in its room help. Later you'll find more eggs: they go in the Hatchery in the Nursery, and hatched pets live in the Den."],
      go: "pet:home", point: P_PET },
    { id: "stats", say: ["Now, you. Your Player page is in your House, at your Estate: the buttons above every page take you to the Map, your Estate and your Bag.",
        "It shows your skills: gathering skills like Foraging and Mining, crafting skills like Smithing and Cooking, and fighting skills -- Attack, Defence, Hitpoints, Ranged and Magic. Everything you do earns experience, and every level opens new places, recipes and gear. Your combat level decides which hunting grounds you can take on."],
      go: "pet:skills", point: ['.pp-spot[data-key="pet:skills"]', '.pp-spot[data-key="pet:house"]', P_ESTATE] },
    { id: "gather", say: ["Everything in Neurovale is made from materials, and materials come from gathering.",
        "Press Map above the page, click the Farmyard, then click the Hedgerow to pick berries. You keep gathering on your own until you stop or your bag fills up -- even while you're away."],
      goal: "Gather something (the Hedgerow in the Farmyard)", go: "region:farmyard", check: "gather", point: ['.pp-spot[data-key="foraging:hedgerow"]', P_FARM, P_MAP] },
    // (Modernize/Reduce Nav, 2026-10-18, Cam: "add this to the tutorial in place of the chests" -- the Kit and the Bank, same step)
    { id: "chests", say: ["Your bag only holds so much: each kind of thing takes a slot, and a slot holds a stack. Keep it close: your Kit sits at the side of the screen with five tabs -- your Bag, your Gear, Combat, Magic and Skills, like an adventurer's satchel.",
        "Click a thing in the Kit to use it, eat it or wear it. Right-click it for the rest: drop it, use it with something, put it in the bank, or look at it closely. Click a gear slot to change what's in it.",
        "And at your Estate, the Storeroom is your Bank -- what's in it is safe, even if you fall in battle, and the benches at home use it too. Open the bank and click something in your bag to put it in. Tabs along the top keep it sorted: drag a thing onto a tab, and right-click a tab to name it."],
      goal: "Put something in the bank", go: "pet:storeroom", check: "store", point: [".pp-bank-bag .pp-bank-cell", "#pp-open-store", '.pp-spot[data-key="room:storeroom"]', '.pp-spot[data-key="pet:storeroom"]', P_ESTATE] },
    { id: "recycle", say: ["Next to the bank, by the barrels, is the recycle stash. Put in what you don't need: a few hours later it's broken back into raw materials -- or, for things nobody makes, recycling points to spend on materials.",
        "Here are some old boots I fished out of the pond. Put them in the recycle stash."],
      goal: "Put something in the recycle stash", go: "pet:storeroom", check: "recycle", gift: { boot: 3 }, point: ['.pp-rc-put[data-id="boot"]', ".pp-rc-put", '.pp-spot[data-key="recycle"]', '.pp-spot[data-key="pet:storeroom"]', P_ESTATE] },
    { id: "food", say: ["A hungry adventurer doesn't last long. Fruit heals a little; cooked food heals much more.",
        "Here are some raw shrimps and twigs for the fire. Cook them in the Kitchen, in the Workshop at your Estate. When you want more, catch shrimps at the Duck pond in the Farmyard -- your small net does the job.",
        "Later, the Hearth in your House slow-cooks a stew while you're out -- a bowl for each ingredient you put in -- and a meal at the Dining table gives you bonus experience for a while."],
      goal: "Cook the shrimps in your Kitchen", go: "shop:kitchen", check: "cook", gift: { rawshrimp: 3, twigs: 3 },
      point: ['.pp-make[data-ws="kitchen"][data-make="shrimps"]', '.pp-spot[data-key="kitchen"]', '.pp-spot[data-key="pet:workshop"]', P_ESTATE] },
    { id: "craft", say: ["Benches turn materials into tools, gear and furniture. Each bench belongs to a skill: the crafting bench to Crafting, the anvil to Smithing, and so on.",
        "Here's some clay. Make a Clay bowl at the crafting bench in your Workshop. Better rooms in your house let the benches make better things.",
        "Some things need no bench at all -- field recipes, made right in your bag: use one thing with another. Here's a page for bandages, with a cloth and some herbs. Read the page in your bag, then use the cloth with a herb -- a bandage heals you in a fight. You'll find more pages out in the world."],
      // (PT14 p2, Cam: "Maybe have the tutorial explain field recipes and give us a free one at the start")
      goal: "Make something at the crafting bench", go: "shop:crafting", check: "craft", gift: { clay: 10, pagebandage: 1, cloth: 1, herb: 3 },
      point: ['.pp-make[data-ws="crafting"][data-make="bowl"]', '.pp-spot[data-key="crafting"]', '.pp-spot[data-key="pet:workshop"]', P_ESTATE] },
    { id: "styles", say: ["There are three ways to fight. Melee -- swords and axes, trained by Attack. Ranged -- bows and arrows, trained by Ranged. Magic -- wands and runes, trained by Magic.",
        "I'll give you a starter kit for each: a bronze sword, a short bow with 50 improvised arrows and a quiver to carry them (arrows only go in a quiver), and a willow wand with 50 air and mind runes (Wind Strike). Try them all and see what suits you.",
        "Each also fights accurate, aggressive or defensive -- which decides the skill you train -- and later a class (Hunter, Berserker or Arcane) gives you a special attack."],
      go: "pet:gear", gift: { bronzesword: 1, shortbow: 1, improvisedquiver: 1, improvisedarrow: 50, willowwand: 1, airrune: 50, mindrune: 50 } },
    { id: "armour", say: ["Before you face anything with teeth, you'll want protection. Take this bronze helmet too.",
        "Put on a weapon and the helmet on your Character sheet -- click your name at the top, then Gear, and click a slot on your figure to choose what goes in it. Armour takes damage off every blow -- and what you wear shows on you!"],
      goal: "Wear a weapon and the helmet", go: "pet:gear", check: "armour", gift: { bronzehelm: 1 },
      // (2026-10-15: Equipment is the Character sheet's Gear tab -- your name in the top bar opens it)
      // (2026-10-15: a slot on your figure opens its picker by the slot -- point at the picker's choice, else the empty slot)
      point: ['.pp-picker [data-pick="bronzesword"]', '.pp-picker [data-pick="bronzehelm"]', '.pl-tabbtn[data-tab="gear"]:not(.on)',
              '[data-pane="gear"] .pl-doll-slot[data-doll="weapon"]:not(.full)', '[data-pane="gear"] .pl-doll-slot[data-doll="helmet"]:not(.full)', '.np-me'] },
    { id: "battle", say: ["Now for a real fight. On the Map, open the Farmyard and click its hunting ground. Fights play out on their own, round by round.",
        "You fight from your Kit at the side: click food in your bag to eat (it costs your next attack), and the Combat tab has your stance, your Special and Run. Nothing eats for you, so watch your health -- put food on a quick slot (right-click it in your bag) and eat with Shift+1 to 4. A fall loses everything you carry! Take these shrimps for the road.",
        "Win enough fights in an area and its boss appears. Beat it for its trophies -- and five wins let you make its armour."],
      goal: "Win 3 fights while hunting", go: "region:farmyard", check: "hunt", gift: { shrimps: 5 }, point: ['.pp-spot[data-key="hunt"]', P_FARM, P_MAP] },
    { id: "quest", say: ["The people of Neurovale need help, and helping them is how the island's story unfolds -- and how new benches and places open up.",
        "Farmer Giles in the Farmyard has the first chapter. Open the Farmyard, click him, and bring him what he asks for."],
      goal: "Finish Farmer Giles's first quest", go: "region:farmyard", check: "quest", point: ["#pp-quest:not([disabled])", '.pp-spot[data-key="person"]', P_FARM, P_MAP] },
    { id: "grow", say: ["Your pet is growing -- but it takes 3 days before a pet is old enough for expeditions. Here's a gift to speed things up: an Elixir of Growth.",
        "Give it to your pet on its page -- potions are next to the food."],
      goal: "Give your pet the Elixir of Growth", go: "pet:home", check: "grown", gift: { growthelixir: 1 },
      point: ['[data-act="use"][data-item="growthelixir"]'].concat(P_PET) },
    { id: "expedition", say: ["Now your pet can go on expeditions! I've opened them for you. On an expedition your pet explores on its own for a few hours and comes back with loot -- materials, crates, sometimes even eggs.",
        "Expeditions are in your House. Pick an area and send your pet. Supplies keep it going; a stronger pet can take on harder areas."],
      goal: "Send your pet on an expedition", go: "pet:expeditions", check: "expedition", opens: "expeditions",
      point: [".pp-send:not([disabled])", '.pp-spot[data-key="pet:expeditions"]', '.pp-spot[data-key="pet:house"]', P_ESTATE] },
    // (PT9, Cam, 2026-10-16: "after sending pet on expedition then we go to the guild hall, with an explanation its not only our
    //  pets jobs to explore dangerous areas on expeditions. We also explore and it can be dangerous, so its important we train
    //  under a tutor and master a class, otherwise we will surely perish on our journey")
    { id: "guild", say: ["Exploring dangerous places isn't only your pet's job. You'll be out there too -- in the deep woods, on the far islands, in places that don't forgive mistakes.",
        "So you must train under a tutor and master a class, or you'll surely perish on your journey. The Guild hall is in the Village, where the old estate sign stands. Go and talk to the tutors -- each will tell you their way is best."],
      goal: "Talk to a tutor at the Guild hall", go: "pet:guild", check: "guild",
      point: ["[data-talk]", '.pp-spot[data-key="pet:guild"]', 'g.pp-region[data-region="village"]', P_MAP] },
    { id: "gift", say: ["You've learned all the basics -- I'm proud of you!",
        "One last thing: Neurovale is made up of many islands. This one is only the beginning. Build a boat with Old Salt on the Coast and you can sail to the Desert Island, Frostpeak and beyond -- each with its own towns, people, creatures and secrets.",
        "Before you go, take a Rare egg and five Iron crates. And I carry the ancient magic of Ra, the sun himself: let me cast the Blessing of the Sun on you. Choose a skill and the sun will carry it all the way to level 10. Follow Farmer Giles's story, finish your tour of the Guild, and good luck out there, adventurer!",
        "And take my notes: How to Play, everything I've shown you and more, with pictures. Read it from your bag whenever you're stuck -- and a copy sits in NeuroNet's Scribe, under Ebooks, to read beside the game."],
      finale: true }
  ];
  var TUTORIAL_FINAL = CONTENT("TUTORIAL_FINAL");
  function tutorialStep(s) { return s.tutorial && !s.tutorial.done && !s.tutorial.skipped ? TUTORIAL[s.tutorial.step] || null : null; }
  function tutorialCounts(s) {
    var sk = (s.player && s.player.skills) || {}, sum = function (list) { return list.reduce(function (a, k) { return a + (sk[k] || 0); }, 0); };
    return { gather: sum(GATHERING), cook: sk.cooking || 0, craft: sk.crafting || 0,
             kills: Object.keys(s.hunt || {}).reduce(function (a, g) { return a + ((s.hunt[g] || {}).kills || 0) + ((s.hunt[g] || {}).wins || 0); }, 0) };
  }
  /** Is a step's job done? */
  function tutorialMet(s, st, now) {
    if (!st || !st.check) return true;
    var b = s.tutorial.base || {}, c = tutorialCounts(s), p = s.pet, g = (s.player && s.player.gear) || {};
    switch (st.check) {
      case "egg": return !!p;
      case "gather": return c.gather > (b.gather || 0);
      case "store": return storeUsed(s) > 0;
      case "recycle": return !!(s.recycle && ((s.recycle.lots || []).length || Object.keys(s.recycle.mats || {}).length || s.recycle.points));
      case "cook": return c.cook > (b.cook || 0);
      case "craft": return c.craft > (b.craft || 0);
      case "armour": return !!g.weapon && !!g.helmet;
      case "hunt": return c.kills >= (b.kills || 0) + 3;
      case "quest": return storyDone(s, 1);
      case "grown": return !!p && stage(p, now) !== "egg" && now - p.hatchAt >= EXPEDITION_AGE;
      case "expedition": return !!p && (!!p.away || Object.keys(p.areas || {}).length > 0);
      case "guild": return Object.keys(((s.player || {}).guildMet) || {}).length > 0;
    }
    return true;
  }
  /** Into step i: what it gives (once), where it starts counting from, what it opens. */
  function tutorialEnter(s, i, now) {
    var T = s.tutorial;
    T.step = i;
    var st = TUTORIAL[i];
    if (!st) return;
    T.base = tutorialCounts(s);
    T.given = T.given || {};
    if (st.gift && !T.given[st.id]) {
      Object.keys(st.gift).forEach(function (k) { give(s, k, st.gift[k], true); if (ITEMS[k].learn && ITEMS[k].learn.field) fieldPageGot(s, k, now); });   // (a recipe page: the Unlocks pop-up, PT24)
      T.given[st.id] = true;
      note(s, now, "A gift from " + GUIDE.name + ": " + itemsText(st.gift) + ".");
    }
    if (st.opens) { T.open = T.open || {}; T.open[st.opens] = true; }
  }
  function tutorialView(s, now) {
    s = s || {};
    var T = s.tutorial, st = tutorialStep(s);
    if (!st) { var ctv = classTutView(s, now); if (ctv) return ctv; }   // a class's tutor, after Amunet (2026-10-17)
    if (!st) return { on: false, done: !!(T && T.done), skipped: !!(T && T.skipped), canStart: !(s.player && s.player.made) && !T };
    return { on: true, step: T.step, of: TUTORIAL.length, id: st.id, say: st.say, goal: st.goal || "", go: st.go || "", name: !!st.name, body: !!st.body,
             chosen: T.body || "", point: st.point || [],
             met: tutorialMet(s, st, now), finale: !!st.finale, guide: GUIDE,
             skills: st.finale ? SKILL_ORDER.filter(function (k) { return k !== "hitpoints"; }).map(function (k) { return { id: k, name: SKILLS[k].name, level: levelOf((s.player.skills || {})[k] || 0) }; }) : null,
             gifts: st.finale ? Object.keys(TUTORIAL_FINAL).map(function (k) { return { id: k, name: ITEMS[k].name, n: TUTORIAL_FINAL[k] }; }) : null };
  }
  /** tutorial {op: start | next | skipstep | skip | finish {skill} | restart} */
  function tutorialAct(s, action, opts, now) {
    if (action !== "tutorial") return null;
    var op = opts.op, T = s.tutorial;
    if (op === "start" || op === "restart") {
      var given = (T && T.given) || {}, open = (T && T.open) || {};
      s.tutorial = { step: 0, given: given, open: open, finalGiven: !!(T && T.finalGiven) };
      tutorialEnter(s, s.player && s.player.made ? 3 : 0, now);     // made already: straight to the egg
      return yes(s, now, op === "restart" ? GUIDE.name + " is back to show you around." : "");
    }
    if (!T || T.done || T.skipped) return no(s, "There's no tutorial going on.");
    var st = TUTORIAL[T.step];
    if (op === "skip") {
      T.skipped = true;
      if (!hasGuide(s)) give(s, HOW_TO_PLAY.item.id, 1, true);            // her notes, even so (How to Play, 2026-10-20)
      var named = defaultPlayer(s);                                       // skipped before choosing: a name and a look anyway (PT24)
      return yes(s, now, "Tutorial skipped -- you can start it again from Settings. Amunet's How to Play book is in your bag." + (named ? " You're \u201c" + s.player.name + "\u201d for now -- change it on your Character sheet." : ""));
    }
    if (op === "body") {                                               // "Are you a boy or a girl?"
      if (!st.body) return no(s, "Not now.");
      T.body = opts.body === "f" ? "f" : "m";
      tutorialEnter(s, T.step + 1, now);
      return yes(s, now, "");
    }
    if (op === "next" || op === "skipstep") {
      if (st.body && !T.body) return no(s, "Choose first.");
      if (st.name && !(s.player && s.player.made)) return no(s, "Tell " + GUIDE.name + " your name first.");
      if (op === "next" && !tutorialMet(s, st, now)) return no(s, "Not yet: " + (st.goal || "") + ".");
      if (st.check === "hunt" && s.player && s.player.job && s.player.job.hunt) endTrip(s, s.player, now, "stop");   // Amunet calls you back from the hunt (PT30: nobody runs for you)
      if (st.finale) return no(s, "Choose a skill for your gift first.");
      tutorialEnter(s, T.step + 1, now);
      return yes(s, now, "");
    }
    if (op === "finish") {
      if (!st.finale) return no(s, "Not yet.");
      if (!T.finalGiven) {
        var sk = opts.skill;
        if (!SKILLS[sk] || sk === "hitpoints") return no(s, "Choose a skill for your gift.");
        Object.keys(TUTORIAL_FINAL).forEach(function (k) { give(s, k, TUTORIAL_FINAL[k], true); });
        var b4 = levelOf(s.player.skills[sk] || 0);
        s.player.skills[sk] = (s.player.skills[sk] || 0) + XP[10];          // what it takes from level 1 to 10
        T.finalGiven = true;
        note(s, now, GUIDE.name + "'s farewell gifts: a rare egg, 5 iron crates -- and the Blessing of the Sun: " + XP[10].toLocaleString() + " " + SKILLS[sk].name + " xp" +
             (levelOf(s.player.skills[sk]) > b4 ? " -- " + SKILLS[sk].name + " level " + levelOf(s.player.skills[sk]) + "!" : "."));
      }
      T.done = true;
      return yes(s, now, "Tutorial complete -- good luck, adventurer!");
    }
    return no(s, "Nothing like that.");
  }
