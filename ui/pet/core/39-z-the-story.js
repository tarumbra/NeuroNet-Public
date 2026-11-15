  // ==== the story: "The Island Remembers" (2026-10-10, audit H-4 -- Cam: "Lets go with the quest path"). RuneScape's way:
  //      quests are the story and the gate. Ten chapters from people who already live on the island, each opening a system
  //      because someone needs it, instead of every bench and system being open in the first hour. Only games started
  //      from now on are gated (s.story.on, set when you make your character); older saves keep everything open and can
  //      still play the chapters for the story and the rewards. Each chapter is a quest at the front of its person's
  //      list, offered only once the chapter before it is done. -----------------------------------------------------
  var STORY_NAME = "The Island Remembers";
  var STORY = [
    { n: 1, region: "farmyard", id: "story1", name: "A Hand on the Farm",
      text: "You washed up at the farm with nothing but an egg. Farmer Giles will give you a bed if you'll fetch berries and twigs for the stove.",
      needs: [{ bring: { berry: 10, twigs: 10 } }], reward: { coins: 50, xp: { foraging: 60 } }, opens: [] },
    { n: 2, region: "farmyard", id: "story2", name: "That Fox!",
      text: "A fox raids the coop every night. Hunt in the Farmyard until it's had enough -- and Giles will lend you his old forge for something sharp.",
      needs: [{ kills: ["farmyard", 10] }], reward: { coins: 100, xp: { attack: 40 } }, opens: ["smithy", "board"] },
    { n: 3, region: "pasture", id: "story3", name: "Shearing Season",
      text: "Bess needs cotton spun and hides tanned before the frost -- and your house needs a proper roof before winter.",
      needs: [{ bring: { cotton: 30 } }], reward: { coins: 150, xp: { crafting: 60 } }, opens: ["shed", "build"] },
    { n: 4, region: "meadow", id: "story4", name: "Flowers for the Hives",
      text: "Nell's bees are failing. Bring wildflowers, and she'll teach you which herbs heal and which harm -- and how a breeding pair rebuilds a hive.",
      needs: [{ bring: { flower: 20 } }], reward: { coins: 200, xp: { herblore: 60 } }, opens: ["herbs", "breeding"] },
    { n: 5, region: "forest", id: "story5", name: "The White Hart",
      text: "Ash found an old explorer's journal in the woods, and your pet has picked up a trail it describes. Bring oak for a reading desk, and the journal is yours to study.",
      needs: [{ bring: { oak: 20 } }], reward: { coins: 300, items: { relic: 1 } }, opens: ["study", "expeditions"] },
    { n: 6, region: "deepforest", id: "story6", name: "Tell Me What You Saw",
      text: "Old Mab reads your dreams in the stars, over a pot of mushroom soup, and tells you the island is older than the village knows.",
      needs: [{ bring: { mushroom: 30 } }], reward: { coins: 400, xp: { magic: 80 } }, opens: ["stars", "tower"] },
    { n: 7, region: "coast", id: "story7", name: "Build Me a Boat",
      text: "The journal's next pages are across the water. Old Salt will help you build a boat -- help him first.",
      needs: [{ quest: "boat" }], reward: { coins: 500 }, opens: [] },
    { n: 8, region: "crystalcaves", id: "story8", name: "Shiny Things",
      text: "Brokk's lantern shows gems glittering in the dark. Bring him rough gems and he'll teach you to cut them -- and what the old stones can hold.",
      needs: [{ bring: { roughgem: 5 } }], reward: { coins: 600, xp: { gemology: 100 } }, opens: ["gems"] },
    { n: 9, region: "jungle", id: "story9", name: "Into the Green",
      text: "Reyes swears the journal's last pages lead over the sea, to a desert and a river. Bring mangoes for the voyage.",
      needs: [{ bring: { mango: 10 } }], reward: { coins: 800 }, opens: [] },
    { n: 10, region: "desert", id: "story10", name: "The Riddle of the Sphinx",
      text: "The journal ends at the Pyramid -- and the Sphinx guards the way. Beat it, and the Pyramid's doors are open to you.",
      needs: [{ boss: "desert" }], reward: { coins: 1500 }, opens: ["pyramid"] },
    // ---- part 2: The Star Chart (2026-10-10, Cam: "lets start the next area quest line so the story continues"). The
    //      Pyramid's last chamber held a chart of the northern stars, and the journal's author never came back from where
    //      it points: the cairn on Frostpeak's summit, left by the island's first keepers. Nothing more to unlock -- every
    //      system is open by now; these chapters are the story, and the rewards.
    { n: 11, arc: 2, region: "nile", id: "story11", name: "Reading the Stars",
      text: "The chart from the Pyramid crumbles at a touch. Kemet's people copy old things onto fresh reeds -- bring papyrus, and fish for his family while he works.",
      needs: [{ bring: { papyrus: 30, nileperch: 10 } }], reward: { coins: 2000, xp: { crafting: 1500 } }, opens: [] },
    { n: 12, arc: 2, region: "sandport", id: "story12", name: "Passage North",
      text: "The copy points north, past the ice. Nefer won't send a ship that far without rope and pitch for the hull -- and she wants it in writing that you'll come back.",
      needs: [{ bring: { rope: 30, pitch: 10 } }], reward: { coins: 2500, xp: { construction: 1500 } }, opens: [] },
    { n: 13, arc: 2, region: "opensea", id: "story13", name: "Steering by the Stars",
      text: "Old Mariner Wren has sailed by those stars before, once. He'll show you how -- if you can feed the crew from the open water.",
      needs: [{ bring: { rawstingray: 10 } }, { level: ["fishing", 45] }], reward: { coins: 3000, xp: { fishing: 2500 } }, opens: [] },
    { n: 14, arc: 2, region: "mistyisle", id: "story14", name: "Lights in the Fog",
      text: "Finn swears he saw the journal's author on the Misty Isle, years ago, chasing lights in the fog. Find what the island hides, and you'll find where they went.",
      needs: [{ secrets: ["mistyisle", 2] }], reward: { coins: 3500, items: { relic: 1 } }, opens: [] },
    { n: 15, arc: 2, region: "frosthaven", id: "story15", name: "Dressed for the Cold",
      text: "Ingrid takes one look at you and laughs. Nobody climbs in that. A yeti-fur coat, and pine for the fires on the way up.",
      needs: [{ bring: { furcoat: 1, pine: 30 } }], reward: { coins: 4000, xp: { crafting: 2000 } }, opens: [] },
    { n: 16, arc: 2, region: "frostpeak", id: "story16", name: "The Long Climb",
      text: "Sigrun knows the old path -- and what waits on it. Clear the way through the Foothills, and be hard enough to take the cold.",
      needs: [{ kills: ["frostpeak", 100] }, { level: ["defence", 40] }], reward: { coins: 5000, xp: { defence: 3000 } }, opens: [] },
    { n: 17, arc: 2, region: "icecavern", id: "story17", name: "A Light Under the Ice",
      text: "Hermit Bjorn found the author's lantern in the Ice Cavern, its glass cracked. Frost crystals make a light that never freezes -- and he'll want feeding.",
      needs: [{ bring: { frostcrystal: 10, cavefish: 10 } }], reward: { coins: 6000, items: { ancientchest: 1 } }, opens: [] },
    { n: 18, arc: 2, region: "summit", id: "story18", name: "What the Island Remembers",
      text: "The cairn stands at the top, and something guards it. Beat it, and the Cairn Keeper will show you what the first keepers left -- and whose name is the last one carved there.",
      needs: [{ boss: "frostpeak" }], reward: { coins: 8000, items: { ancientchest: 2, relic: 2 } }, opens: [] }
  ].filter(function (c) { return PEOPLE[c.region]; });
  var STORY_ARCS = CONTENT("STORY_ARCS");
  STORY.forEach(function (c) { if (!c.arc) c.arc = 1; });
  // what each chapter opens: benches (workshop ids) and actions
  var STORY_GATES = CONTENT("STORY_GATES");
  // what each gate opens, to show in the Unlocks pop-up (2026-10-10, Cam: "a popup ... once i complete a quest that has an
  // unlock assigned ... a Bronze bar on the left, title says Unlocks then the divider and the unlocks there"): [picture, words]
  var GATE_UNLOCKS = CONTENT("GATE_UNLOCKS");
  /** Remember what a quest just opened, for the Unlocks pop-up: the story's gates, and the way into a region a key item opens. */
  function noteUnlocks(s, quest, chapter, at) {
    var list = [];
    if (chapter && storyOn(s)) chapter.opens.forEach(function (g) { (GATE_UNLOCKS[g] || []).forEach(function (u) { list.push({ icon: u[0], text: u[1] }); }); });
    Object.keys((quest.reward || {}).items || {}).forEach(function (k) {
      var key = ITEMS[k] && ITEMS[k].key;
      if (key && REGIONS[key]) list.push({ icon: k, text: "The way into the " + REGIONS[key].name + " (" + ITEMS[k].name.toLowerCase() + ")" });
    });
    // every chapter says what comes next, so the pop-up shows even when it opens nothing new (2026-10-11, Cam: "After farmer
    // giles quest the pop up with the unlocks didnt pop up")
    var nx = chapter && STORY.filter(function (c) { return c.n === chapter.n + 1; })[0];
    if (nx && PEOPLE[nx.region] && storyOn(s)) list.push({ icon: "tome", text: "The story goes on: chapter " + nx.n + ", " + nx.name + " -- see " + PEOPLE[nx.region].name + " in the " + REGIONS[nx.region].name });
    if (!list.length) return;
    s.unlocked = (s.unlocked || []).concat([{ at: at, title: chapter ? "Chapter " + chapter.n + ": " + chapter.name : quest.name, list: list }]).slice(-5);
  }
  var STORY_SWITCH = CONTENT("STORY_SWITCH");                                   // tests of other things switch the gates off
  STORY.forEach(function (c) {
    PEOPLE[c.region].quests.unshift({ id: c.id, name: "Story, chapter " + c.n + ": " + c.name, text: c.text, needs: c.needs, reward: c.reward, story: c.n });
  });
  function storyDone(s, n) { return n <= 0 || !!((s && s.quests) || {})["story" + n]; }
  /** Is a quest offered yet? A chapter waits for the one before it. */
  function questOpen(s, q) { return (!q.story || storyDone(s, q.story - 1)) && (!q.cls || !!(s && s.player && s.player.cls === q.cls)); }   // a class's own quest (Battle Re-work Part 4)
  function storyOn(s) { return STORY_SWITCH.gates && !!(s && s.story && s.story.on); }
  function gateChapter(g) { for (var i = 0; i < STORY.length; i++) if (STORY[i].opens.indexOf(g) >= 0) return STORY[i]; return null; }
  /** Why an action or bench is waiting for the story ("" if it isn't). */
  function storyLock(s, action, opts) {
    if (!storyOn(s) || (s.dev && s.dev.infinite)) return "";
    var ws = action === "craft" ? opts && opts.workshop : "";
    for (var g in STORY_GATES) {
      var G = STORY_GATES[g], hit = (ws && (G.workshops || []).indexOf(ws) >= 0) || (!ws && (G.actions || []).indexOf(action) >= 0);
      if (!hit) continue;
      var c = gateChapter(g);
      if (s.tutorial && s.tutorial.open && s.tutorial.open[g]) continue;   // the tutorial opened it (2026-10-11)
      if (c && !storyDone(s, c.n)) return storyLockText(G, c);
    }
    return "";
  }
  function storyLockText(G, c) {
    var per = PEOPLE[c.region];
    return G.name.charAt(0).toUpperCase() + G.name.slice(1) + " opens in the story: help " + per.name + " in the " + REGIONS[c.region].name + " (chapter " + c.n + ", " + c.name + ")";
  }
  /** A bench's story lock, for the bench's recipes. */
  function benchStoryLock(s, ws) { return storyLock(s, "craft", { workshop: ws }); }
  /** Where the story is: the chapter you're on, who to see, where. */
  function storyView(s) {
    var next = null;
    for (var i = 0; i < STORY.length; i++) if (!storyDone(s, STORY[i].n)) { next = STORY[i]; break; }
    var done = STORY.filter(function (c) { return storyDone(s, c.n); }).length;
    if (!next) return { name: STORY_ARCS[STORY[STORY.length - 1].arc], done: done, total: STORY.length, finished: true };
    var per = PEOPLE[next.region];
    return { name: STORY_ARCS[next.arc] || STORY_NAME, part: next.arc, done: done, total: STORY.length, chapter: next.n, title: next.name, person: per.name, region: next.region,
             regionName: REGIONS[next.region].name, text: next.text, gated: storyOn(s),
             opens: next.opens.map(function (g) { return STORY_GATES[g].name; }) };
  }
  questProgressHooks.push(function (s, n, out) {                        // a chapter that waits for another quest
    if (n.quest) {
      var q = null;
      Object.keys(PEOPLE).forEach(function (r) { PEOPLE[r].quests.forEach(function (x) { if (x.id === n.quest) q = x; }); });
      out.push({ text: "Quest: " + (q ? q.name : n.quest), have: ((s.quests || {})[n.quest]) ? 1 : 0, need: 1 });
    }
  });
