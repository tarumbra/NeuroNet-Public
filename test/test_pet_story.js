/* The story, "The Island Remembers" (2026-10-10, audit H-4): ten chapters from people who already live on the island, each
   opening a system -- only for games started from now on. Run: node test/test_pet_story.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 10, 2);
const newGame = () => C.act(C.advance(C.empty(), T0), "player", {name: "New"}, T0).state;

ok("two parts, eighteen chapters, each from someone who lives on the island", C.STORY.length === 18 && C.STORY.filter((c) => c.arc === 1).length === 10 && C.STORY_ARCS[2] === "The Star Chart" && C.STORY.every((c) => C.PEOPLE[c.region] && C.PEOPLE[c.region].quests[0] && C.PEOPLE[c.region].quests.some((q) => q.id === c.id)));
ok("  every gate is opened by a chapter", Object.keys(C.STORY_GATES).every((g) => C.STORY.some((c) => c.opens.includes(g))));

/* a new character: things open one at a time */
{
  let s = newGame();
  ok("a new character starts the story: the smithy waits for chapter 2, and says who to help", s.story.on
     && /The smithy opens in the story: help Farmer Giles in the Farmyard \(chapter 2, That Fox!\)/.test(C.act(s, "craft", {workshop: "furnace", make: "bronzebar"}, T0).error || ""));
  ok("  ...as do breeding, research and the Pyramid", /opens in the story/.test(C.act(s, "breed", {}, T0).error || "") && /opens in the story/.test(C.act(s, "research", {id: "nets"}, T0).error || "")
     && /opens in the story/.test(C.act(s, "pyramid", {}, T0).error || ""));
  ok("  the bench's recipes say so too", C.villageView(s, T0).find((w) => w.id === "furnace").recipes.every((r) => /opens in the story/.test(r.roomLock) && !r.can));
  ok("  the crafting bench and kitchen are open from the start", !C.villageView(s, T0).find((w) => w.id === "crafting").recipes[0].roomLock && !C.villageView(s, T0).find((w) => w.id === "kitchen").recipes[0].roomLock);
  const st = C.dashView(s, T0).story;
  ok("Today shows the chapter, who to see and where", st.chapter === 1 && st.person === "Farmer Giles" && st.region === "farmyard" && st.total === 18 && st.part === 1);
  ok("  Farmer Giles offers chapter 1 first; Shepherd Bess doesn't offer chapter 3 yet", C.personView(s, "farmyard").quest.story === 1 && C.personView(s, "pasture").quest.story !== 3);
  s.bag.berry = 10; s.bag.twigs = 10;
  let r = C.act(s, "quest", {region: "farmyard"}, T0);
  ok("chapter 1 done: said, with who's next", r.ok && /Story, chapter 1 done: A Hand on the Farm/.test(r.msg) && /Next: Farmer Giles in the Farmyard/.test(r.msg), r.error || r.msg);
  s = r.state;
  ok("  then Giles offers chapter 2", C.personView(s, "farmyard").quest.story === 2);
  s.hunt = s.hunt || {}; s.hunt.farmyard = {kills: 10, wins: 0, losses: 0};
  r = C.act(s, "quest", {region: "farmyard"}, T0); s = r.state;
  ok("chapter 2 done: the smithy and the notice board open", r.ok && /Open to you now: the smithy, the notice board/.test(r.msg) && !C.storyLock(s, "craft", {workshop: "furnace"}) && !C.storyLock(s, "order", {}), r.error || r.msg);
  ok("  but the spinning wheel still waits for Shepherd Bess", /Shepherd Bess/.test(C.storyLock(s, "craft", {workshop: "spinning"})));
  ok("  and Bess offers chapter 3 now", C.personView(s, "pasture").quest.story === 3);
  ok("chapter 7 waits for Old Salt's boat quest", C.questOpen(s, C.PEOPLE.coast.quests.find((q) => q.story === 7)) === false
     && (() => { const y = JSON.parse(JSON.stringify(s)); for (let n = 1; n <= 6; n++) y.quests["story" + n] = 1; const pv = C.personView(y, "coast"); return pv.quest.story === 7 && /Build me a boat/.test(pv.quest.needs[0].text) && !pv.quest.can; })());
}

/* saves from before the story: nothing locked, the chapters are there for the story */
{
  const old = C.advance(C.empty(), T0); old.player.made = true; delete old.story; old.v = 1;
  const y = C.advance(old, T0);
  ok("a save from before the story keeps everything open", y.story && !y.story.on && !C.storyLock(y, "craft", {workshop: "furnace"}) && !C.storyLock(y, "pyramid", {}));
  ok("  and can still play the chapters", C.personView(y, "farmyard").quest.story === 1);
}

/* the Unlocks pop-up (2026-10-10) */
{
  let s = newGame(); s.bag.berry = 10; s.bag.twigs = 10; s = C.act(s, "quest", {region: "farmyard"}, T0).state;
  // (2026-10-11, Cam: "After farmer giles quest the pop up with the unlocks didnt pop up") -- every chapter says what's next
  ok("a chapter that opens nothing still shows the pop-up, with the next chapter", (s.unlocked || []).length === 1 && /chapter 2, That Fox!/.test(s.unlocked[0].list[0].text), JSON.stringify(s.unlocked));
  s.hunt = {farmyard: {kills: 10, wins: 0, losses: 0}};
  const u = (C.act(s, "quest", {region: "farmyard"}, T0 + 1).state.unlocked || []).find((x) => x.title === "Chapter 2: That Fox!");
  ok("That Fox! records its unlocks, the bronze bar first (then what's next)", u && u.list[0].icon === "bronzebar" && u.list.length === 4 && /chapter 3/.test(u.list[3].text), JSON.stringify(u));
  const old = C.advance(C.empty(), T0); old.player.made = true; delete old.story; old.v = 1; const o = C.advance(old, T0); o.bag.berry = 10; o.bag.twigs = 10;
  ok("  an older save (nothing gated) gets no pop-up for the story", !(C.act(o, "quest", {region: "farmyard"}, T0).state.unlocked || []).length);
  const k = newGame(); k.quests = k.quests || {}; for (let n = 1; n <= 10; n++) k.quests["story" + n] = 1;
  const reyes = C.PEOPLE.jungle.quests.find((q) => (q.reward.items || {}).machete);
  C.PEOPLE.jungle.quests.forEach((q) => { if (q !== reyes) k.quests[q.id] = 1; });
  k.player.skills.attack = C.XP[40]; k.hunt = {jungle: {kills: 99, wins: 1, losses: 0}}; k.world = {found: {}};
  const r = C.act(k, "quest", {region: "jungle"}, T0);
  ok("a key item reward (Reyes' machete) shows the way it opens", r.ok && (r.state.unlocked || []).some((x) => x.list.some((y) => y.icon === "machete" && /Deep Jungle/.test(y.text))), r.error);
  ok("  the game shows each new one in the Unlocks pop-up: the first picture, Unlocks, the divider, the list", /function showUnlocks/.test(PET) && /pp-unlock-title">Unlocks</.test(PET) && /unlockCheck\(current\(\)\.s\)/.test(PET));
}

/* a level's unlocks, for the level-up celebration (2026-10-10) */
{
  const u = (k, l) => C.levelUnlocks(k, l).map((x) => x.icon);
  ok("a level up lists what it opens: Mining 15 the iron rocks and coal seam; Fishing 10 the Lake and the iron reel",
     u("mining", 15).includes("iron") && u("mining", 15).includes("coal") && u("fishing", 10).includes("trout") && u("fishing", 10).includes("ironrod"));
  ok("  recipes, gear, crops, spells and the way into a region too", u("smithing", 5).includes("bronzeplate") && u("defence", 10).includes("ironhelm")
     && u("farming", 3).includes("carrotseed") && C.levelUnlocks("magic", 5).some((x) => /Cast/.test(x.text)) && C.levelUnlocks("crafting", 40).some((x) => /The way into the Desert/.test(x.text)));
  ok("  every picture it names exists", Object.keys(C.SKILLS).every((k) => Array.from({length: 50}, (_, i) => i + 1).every((l) => C.levelUnlocks(k, l).every((x) => C.ITEMS[x.icon] || /^(obj_|tome)/.test(x.icon)))));
  ok("  the level-up pop-up shows them (five, then \"and N more\"), and stays up longer to read", /levelUnlockList\(m\[1\], \+m\[2\]\)/.test(PET) && /pp-cheer-unlocks-h">Unlocks/.test(PET) && /un\.length \? 6500 : 2400/.test(PET));
}
/* part 2: The Star Chart (2026-10-10) -- the story goes on after the Sphinx, north to Frostpeak's summit */
{
  const s = newGame(); s.quests = s.quests || {}; for (let n = 1; n <= 10; n++) s.quests["story" + n] = 1;
  const st = C.storyView(s);
  ok("after the Sphinx, part 2 begins: Kemet on the Nile has chapter 11", st.part === 2 && st.name === "The Star Chart" && st.chapter === 11 && st.person === "Kemet the fisher"
     && C.personView(s, "nile").quest.story === 11);
  ok("  the Cairn Keeper doesn't offer the last chapter yet", C.personView(s, "summit").quest.story !== 18);
  const bad = [];
  C.STORY.filter((c) => c.arc === 2).forEach((c) => {
    const y = JSON.parse(JSON.stringify(s)); for (let n = 11; n < c.n; n++) y.quests["story" + n] = 1;
    y.player.island = C.REGIONS[c.region].isle || "";
    const rn = C.REGIONS[c.region].needs || {};                       // the way in: a ship, a kit, the skills
    y.ship = {tier: 3, parts: {}}; if (rn.item) y.bag[rn.item] = 1; (rn.also || []).forEach((k) => { y.bag[k] = 1; });
    Object.keys(rn.skills || {}).forEach((k) => { y.player.skills[k] = C.XP[rn.skills[k]]; });
    c.needs.forEach((n) => {
      Object.keys(n.bring || {}).forEach((k) => { y.bag[k] = n.bring[k]; });
      if (n.kills) y.hunt[n.kills[0]] = {kills: n.kills[1], wins: 0, losses: 0};
      if (n.boss) y.hunt[n.boss] = {kills: 999, wins: 1, losses: 0};
      if (n.level) y.player.skills[n.level[0]] = C.XP[n.level[1]];
      if (n.secrets) { y.world = y.world || {}; y.world.found = y.world.found || {}; (C.SECRETS[n.secrets[0]] || []).forEach((x, i) => { y.world.found[n.secrets[0] + ":" + i] = 1; y.world.found[x.id || i] = 1; }); }
    });
    const pv = C.personView(y, c.region);
    if (!pv.quest || pv.quest.story !== c.n || !pv.quest.can) { bad.push(c.n + " not offered/can't (" + JSON.stringify(pv.quest && pv.quest.needs) + ")"); return; }
    const r = C.act(y, "quest", {region: c.region}, T0);
    if (!r.ok || !/Story, chapter/.test(r.msg)) bad.push(c.n + ": " + (r.error || r.msg));
  });
  ok("  every chapter of part 2 can be done when its needs are met", bad.length === 0, bad.join(" | "));
  const all = JSON.parse(JSON.stringify(s)); for (let n = 11; n <= 18; n++) all.quests["story" + n] = 1;
  ok("  and with all eighteen told, the story is finished", C.storyView(all).finished === true);
  ok("  the Today card says which part, and the last chapter of a part announces the next", /Part \$\{st\.part\}: /.test(PET) && /Part \$\{nx\.arc\} begins/.test(PET));
}

/* the screens */
ok("Today has a Story card that sends you to the person's region on the Map", /pp-story/.test(PET) && /data-story-region=/.test(PET) && /Find \$\{esc\(st\.person\)\} on the Map/.test(PET));
ok("  a chapter done gets its own celebration", /Story, chapter \(\\d\+\) done:/.test(PET) && /Chapter \$\{m\[1\]\} complete/.test(PET));
ok("  a recipe waiting for the story says Story, not Upgrade", /opens in the story\/\.test\(r\.roomLock\) \? "Story" : "Upgrade"/.test(PET));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
