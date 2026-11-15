/* Battle Re-work Part 9 (2026-10-16): the Guild hall -- the tutors and the tour, switching class (paid; half back; one free
   for old saves; free in a sandbox), techniques (learned for good, two slots, 60%), the tutors' quests, class benches and
   class books (V1). Run: node test/test_pet_guild.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
const PLACES = fs.readFileSync(path.join(APP, "ui", "pet", "art", "places.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 16, 8);
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
function player(lv) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  ["attack", "ranged", "magic", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, T0).maxHp; return s;
}

console.log("\nThe Guild hall\n");
{
  const g = C.guildView(player(10), T0);
  ok("the Guildmaster and six tutors' stand-ins (Tamsin for the Beast Master since Part 11b), each with an introduction, a boast and a line about the others",
     g.guildmaster.name && g.tutors.length === 6 && g.tutors.every((t) => t.standIn && t.intro && t.smug && t.banter && t.quest.name));
  ok("  in the Village, where the estate stood (Cam, Q2)", /"pet:guild": \{"at": \[340, 70/.test(PLACES) && /pet:guild/.test(PET));
}
{
  let s = player(20);
  ok("your first class: a free choice, anywhere", A(s, "class", {cls: "hunter"}).ok);
  s = A(s, "class", {cls: "hunter"}).state;
  ok("  after it, a switch is made at the Guild hall", /Guild hall/.test(A(s, "class", {cls: "berserker"}).error));
  ok("  ...and paid for: 8,000 coins and the tutor's materials", /costs 8,000 coins/.test(A(s, "class", {cls: "berserker", guild: true}).error));
  s.coins = 20000; Object.assign(s.bag, {steel: 25, yakhide: 2});
  let r = A(s, "class", {cls: "berserker", guild: true});
  ok("  with them, you switch -- and they're spent", r.ok && r.state.player.cls === "berserker" && r.state.coins === 12000 && !r.state.bag.steel, r.error);
  s = r.state; s.coins = 3000; Object.assign(s.bag, {cowhide: 20, rope: 10, spikedsnare: 1});
  const p = C.switchPrice(s, "hunter");
  ok("  going back to a class you've played costs half (Q7)", p.coins === 2500 && p.items.cowhide === 20 && p.back);
  ok("  not from another island", (() => { const t = JSON.parse(JSON.stringify(s)); t.player.island = "desert"; return /main island/.test(A(t, "class", {cls: "hunter", guild: true}).error); })());
}
{
  const old = JSON.parse(JSON.stringify(player(20))); old.player.cls = "thief"; old.v = 14; delete old.player.freeSwitch;
  const s = C.advance(old, T0);
  ok("an old save with a class gets one free switch (C1)", s.player.freeSwitch === 1 && C.switchPrice(s, "paladin").free === "your free switch");
  const r = A(s, "class", {cls: "paladin", guild: true});
  ok("  used once", r.ok && r.state.player.freeSwitch === 0 && C.switchPrice(r.state, "thief").coins > 0);
  let d = player(20); d = A(d, "class", {cls: "hunter"}).state; d.dev = {on: true};
  ok("in a sandbox, switching is free and instant -- from the Character sheet too (C1)", A(d, "class", {cls: "arcane"}).ok);
}

console.log("\nTechniques\n");
{
  let s = player(30); s = A(s, "class", {cls: "thief"}).state; s.player.classes.thief.xp = C.XP[30];
  ok("not learned until a point goes in the node", !C.techLearned(s.player, "poisoncraft"));
  s = A(s, "talent", {node: "toxic"}).state;
  ok("  a point in Toxic: Poison-crafting is learned for good", C.techLearned(s.player, "poisoncraft") && s.player.techLearned.poisoncraft);
  ok("  your own class's technique doesn't go in a slot -- you have it at full strength", /already, at full strength/.test(A(s, "technique", {id: "poisoncraft", on: true}).error));
  s.player.freeSwitch = 1; s = A(s, "class", {cls: "berserker", guild: true}).state; s.player.classes.thief.talents = {};
  ok("  switch class and respec: still learned", C.techLearned(s.player, "poisoncraft"));
  s.bag.weakpoison = 2;
  ok("  a Berserker can't coat a blade -- until the technique is slotted", /technique slot/.test(A(s, "coat", {item: "weakpoison"}).error));
  const r = A(s, "technique", {id: "poisoncraft", on: true}); s = r.state;
  ok("  slotted (at 60%): now it can", r.ok && /60%/.test(r.msg) && A(s, "coat", {item: "weakpoison"}).ok);
  s.player.techLearned.pickpocket = true; s.player.techLearned.trapmaking = true;
  s = A(s, "technique", {id: "pickpocket", on: true}).state;
  ok("  two slots: a third is refused", /Both slots are full/.test(A(s, "technique", {id: "trapmaking", on: true}).error));
  ok("  and a slotted one adds at 60% (Pickpocketing: +6% coins)", Math.abs(C.talentSum(s.player).coinPct - 0.06) < 1e-9);
  ok("  New Game Plus 1 gives a third slot", (() => { const t = JSON.parse(JSON.stringify(s)); t.ngPlus = 1; return C.techniquesView(t).slots === 3; })());
}

console.log("\nThe tutors' quests, benches and books\n");
{
  let s = player(30); s = A(s, "class", {cls: "paladin"}).state; s.coins = 0;
  ok("Brother Aldo's quest is for Paladins: block 5 blows", /Not yet: blows blocked 0\/5/.test(A(s, "guildquest", {cls: "paladin"}).error));
  s.player.feats = {blocked: 5};
  const r = A(s, "guildquest", {cls: "paladin"});
  ok("  five blocks: done, with its reward", r.ok && r.state.coins === 800 && r.state.bag.holywater === 5);
  ok("  a Berserker's quest isn't a Paladin's", /teaches Berserkers/.test(A(s, "guildquest", {cls: "berserker"}).error));
  let t = player(10);
  ok("the Guildmaster's tour: talk to every tutor first", /still to meet/.test(A(t, "guildquest", {cls: "tour"}).error));
  ["hunter", "berserker", "arcane", "thief", "paladin", "beastmaster"].forEach((c) => { t = A(t, "guildmet", {cls: c}).state; });
  ok("  then it's done", A(t, "guildquest", {cls: "tour"}).ok);
  const g = C.guildView(player(30), T0), hb = g.benches.find((b) => b.cls === "hunter"), tb = g.benches.find((b) => b.cls === "thief");
  ok("class benches show only the class's own things", hb.recipes.some((r) => r.make === "beartrap") && !hb.recipes.some((r) => r.make === "steelsword") && tb.recipes.some((r) => r.make === "weakpoison") && tb.recipes.some((r) => r.make === "throwingknife"));
  let b = player(10); b.coins = 1000;
  const r2 = A(b, "guildbuy", {item: "hunterbook"});
  ok("a class book: 400 coins, into your bag", r2.ok && r2.state.bag.hunterbook === 1 && r2.state.coins === 600);
  const k = C.classBookView("thief");
  ok("  made from the game's data: every node with its numbers, every special, the techniques, two builds", k.branches.reduce((a, x) => a + x.nodes.length, 0) === 24 && k.specials.length === 4 && k.techniques   /* (V18: Fan of knives) */.length === 2 && k.builds.length === 2 && /\+5% poison chance/.test(k.branches[0].nodes[0].perRank), k.branches[0].nodes[0].perRank);
}

console.log("\nThe screens\n");
ok("the Guild hall page: tutors (talk, become, quests), class benches, class books; a book reads from the bag; techniques on the Talents tab; the Character sheet sends you to the hall",
   /function renderGuild/.test(PET) && /data-become=/.test(PET) && /data-gmake=/.test(PET) && /data-gbuy=/.test(PET) && /"readbook"/.test(PET) && /function techniquesHTML/.test(PET) && /pp-class-guild/.test(PET));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
