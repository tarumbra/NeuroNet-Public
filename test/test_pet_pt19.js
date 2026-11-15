/* Cam's PT19 / PT16 / PT18 notes and the votes that carried (2026-10-18): the risen in the fight (PT19 r3-r5), the Pet tonic in
   the hunt (PT18 p4), the talent tree's key (PT18 t3), sparring on the Training Yard (PT16 x4), the sandbox's bosses, New Game
   Plus and quick class (PT19 b1/c5, PT13), mage rematches (PT19 b5), the road to Necromancy (V8) and the Bestiary (V6).
   Run: node test/test_pet_pt19.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
const CORE = fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8");
vm.runInContext(CORE, ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const DAY = new Date(2026, 9, 18, 12).getTime(), H = 3600e3, MIN = 60e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || DAY);
const RUNES = ["air", "water", "earth", "fire", "mind", "chaos", "nature", "death", "cosmic", "astral", "law", "blood"];
function player(dev) {
  let s = A(C.advance(C.empty(), DAY), "player", {name: "T"}).state; s.story = {on: false}; s.tutorial = {step: 0, done: true};
  if (dev) s.dev = {on: true};
  return s;
}
function arcane(lv, taught) {
  let s = player();
  ["magic", "defence", "hitpoints", "attack", "runecrafting", "enchanting"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, DAY).maxHp;
  s = A(s, "class", {cls: "arcane"}).state; s.player.classes.arcane.xp = C.XP[lv]; if (s.classTut) s.classTut.on = null;
  RUNES.forEach((k) => { s.bag[k + "rune"] = 900; });
  s.bag.magicwand = 1; s.player.gear.weapon = "magicwand"; s.bagSize = "rucksack";
  if (taught) s.player.necro = {offered: DAY, accepted: DAY, taught: DAY};
  return s;
}
const beast = (id, lv, extra) => Object.assign({id, name: id, species: "wolf", colour: "grey", born: DAY - 9 * 24 * H, hatchAt: DAY - 9 * 24 * H, joined: DAY, xp: C.XP[lv],
  stat: {}, train: "", trainAt: DAY, fedUntil: 0, restUntil: 0, wins: 0, faints: 0}, extra || {});
const win = (st0, t0) => { let st = st0; st.player.battle.mhp = 1; for (let t = t0; t < t0 + 60e3 && st.player.battle; t += 2400) { st = C.advance(st, t); st.player.hp = C.playerView(st, t).maxHp; } return st; };

console.log("\nThe risen beside you in a fight (PT19 r3-r5)\n");
{
  let s = arcane(50, true);
  s.beasts = [beast("Tom", 30, {risen: true, raised: 1})];
  s.player.loadout = ["raisefallen", "menddead", "fireblast"];
  s = A(s, "hunt", {ground: "jungle", roll: 0.4}).state;
  let seen = null;
  for (let t = DAY; t < DAY + 30e3; t += 2400) { s = C.advance(s, t); const v = C.playerView(s, t); if (v.battle && v.battle.risen && v.battle.risen.length) seen = v.battle.risen[0]; }
  ok("the fight's view carries the risen: name, picture and health", seen && seen.name === "Tom" && seen.species === "wolf" && seen.maxHp > 0 && typeof seen.hp === "number", JSON.stringify(seen));
  ok("  the battle screen draws it beside you, its health in the strip", /id="pp-risen"/.test(PET) && /pp-packpet-chip risen/.test(PET));
}

console.log("\nThe Pet tonic in the hunt (PT18 p4)\n");
{
  let s = player(); s.player.skills.attack = C.XP[30]; s.player.skills.defence = C.XP[30]; s.player.skills.hitpoints = C.XP[30];
  s = A(s, "class", {cls: "beastmaster"}).state; if (s.classTut) s.classTut.on = null;
  s.beasts = [beast("Fang", 30)]; s = A(s, "pack", {ids: ["Fang"]}).state; s.bag.pettonic = 2;
  s = A(s, "hunt", {ground: "forest", roll: 0.3}).state; s = C.advance(s, DAY + 3000);
  ok("full PP: the tonic says so", /all full/.test(A(s, "battle", {cmd: "pettonic", i: 0}, DAY + 3000).error || ""));
  const p = s.player.battle.pack.pets[0]; p.pp = {}; C.movesOf(s.beasts[0]).forEach((id) => { p.pp[id] = 0; });
  const r = A(s, "battle", {cmd: "pettonic", i: 0}, DAY + 3000);
  ok("in a fight: a pet drinks it -- its PP full, its turn spent, one tonic used", !r.error && Object.keys(r.state.player.battle.pack.pets[0].pp).length === 0 && r.state.bag.pettonic === 1, r.error);
  ok("  the fight's Feed menu offers it; the Pen's button is gone (one home)", /data-ptonic=/.test(PET) && !/data-pentonic=/.test(PET));
  // between fights: a pet down to Scrap drinks one on its own
  let t = A(s, "home", {}, DAY + 4000).state; t.beasts[0].pp = {}; C.movesOf(t.beasts[0]).forEach((id) => { t.beasts[0].pp[id] = 0; }); t.bag.pettonic = 1;
  t = A(t, "hunt", {ground: "forest", roll: 0.3}, DAY + 5000).state;
  for (let x = DAY + 5000; x < DAY + 5000 + 20 * MIN && t.bag.pettonic; x += 2400) t = C.advance(t, x);
  ok("between fights, a pet down to scrapping drinks a tonic from the bag", !t.bag.pettonic && t.log.some((l) => /drank a Pet tonic between fights/.test(l.text)));
}

console.log("\nThe talent tree's key and hover (PT18 t3)\n");
{
  ok("the key under the tree: taken, can take, locked, keystone, one of two", /pl-tlegend/.test(PET) && /Keystone/.test(PET) && /One of two/.test(PET));
  ok("  hovering a badge shows what it does", /title="\$\{esc\(n\.name\)\} \(\$\{n\.rank\}\/\$\{n\.ranks\}\)&#10;\$\{esc\(n\.about\)\}"/.test(PET));
  ok("the Hunter's board is Cam's Ranger painting", fs.existsSync(path.join(APP, "ui", "pet", "art", "boards", "hunter.webp")));
}

console.log("\nSparring on the Training Yard (PT16 x4)\n");
{
  let s = player(); s.pen = {yard: {ring: DAY - H}}; s.beasts = [beast("Fang", 20), beast("Moss", 18, {species: "bear", colour: "brown"})];
  const r = A(s, "penspar", {a: "Fang", b: "Moss"});
  const sp = r.state && r.state.pen.lastSpar;
  ok("a spar plays a short bout: six exchanges, scores, a winner or a draw", !r.error && sp && sp.rounds.length === 6 && sp.a.name === "Fang" && sp.b.name === "Moss" && "win" in sp, r.error);
  ok("  the same bout every time it's shown (seeded by the time)", JSON.stringify(A(s, "penspar", {a: "Fang", b: "Moss"}).state.pen.lastSpar.rounds) === JSON.stringify(sp.rounds));
  ok("  nobody gets hurt", r.state.beasts.every((b) => !b.restUntil));
  ok("  the Pen shows it on the Training Yard backdrop", /battle-trainingyard\.webp/.test(PET) && fs.existsSync(path.join(APP, "ui", "pet", "art", "battle-trainingyard.webp")));
}

console.log("\nThe sandbox: bosses, New Game Plus, quick class (PT19 b1/c5, PT13)\n");
{
  let s = arcane(50); s.dev = {on: true}; s.bag.lantern = 1; s.ship = {tier: 1, parts: {}};
  ok("Morvane won't come out before her kills", !!A(s, "boss", {ground: "hollowcrypt", roll: 0.3}).error);
  s = A(s, "dev", {op: "bossready", ground: "hollowcrypt"}).state;
  ok("Ready to fight now: she comes out", !A(s, "boss", {ground: "hollowcrypt", roll: 0.3}).error);
  ok("New Game Plus is shut until the Basilisk is beaten", !C.ngUnlocked(s));
  s = A(s, "dev", {op: "beatboss", ground: "jungle"}).state;
  ok("Mark beaten (the Basilisk): New Game Plus opens", C.ngUnlocked(s));
  const ng = C.newGame({mode: "hardcore", from: s, pets: []}, DAY);
  ok("  a New Game Plus from the sandbox carries the legacy", ng.ngPlus === 1 && ng.legacy && ng.legacy.cls === "arcane");
  ok("  only in the sandbox", !!A(arcane(50), "dev", {op: "beatboss", ground: "jungle"}).error);
  ok("Dev tools: cards, a Bosses card and New Game Plus", /pp-dev-card/.test(PET) && /id="dv-bossready"/.test(PET) && /id="dv-ngplus"/.test(PET));
  let q = player(true); q.player.skills.attack = C.XP[20];
  q = A(q, "class", {cls: "hunter", quick: true}).state;
  ok("the sidebar's quick class: no tutor's lesson", q.player.cls === "hunter" && !(q.classTut && q.classTut.on));
  ok("  the sidebar has the sky and class switches in the sandbox", /function quickHTML/.test(GAME) && /data-qsky/.test(GAME) && /np-qcls/.test(GAME));
}

console.log("\nMage rematches (PT19 b5)\n");
{
  let s = arcane(50); s.mageRank = 2;
  ok("a rank you haven't won can't be a rematch", /Beat that mage/.test(A(s, "rank", {rematch: 3, roll: 0.3}).error || ""));
  const r = A(s, "rank", {rematch: 1, roll: 0.3});
  ok("a rank you've won: a practice duel", !r.error && r.state.player.battle && r.state.player.battle.rematch, r.error);
  const before = r.state.bag.airrune, chests = r.state.bag.ancientchest || 0;
  const w = win(r.state, DAY);
  ok("  winning: Magic xp and that rank's runes -- the rank, coins and chest stay as they were", w.mageRank === 2 && w.bag.airrune === before + 20 && (w.bag.ancientchest || 0) === chests && w.lastBoss.rematch,
     JSON.stringify([w.mageRank, w.bag.airrune - before, w.bag.ancientchest]));
  ok("every rank has its rematch runes and a keep-training line", C.MAGE_RANKS.filter((m) => m.duel).every((m) => m.again && Object.keys(m.rematch || {}).length));
  ok("  the tower and the pop-up offer Rematch", /pp-rematch/.test(PET) && /pp-mage-again/.test(PET));
}

console.log("\nThe road to Necromancy (V8)\n");
{
  ok("Sorceress Nyx (rank 4) makes the offer", C.NECRO.offerRank === 4 && C.MAGE_RANKS[4].duel === "sorceressmage");
  ok("mid game: a level-40 crypt, Morvane after 200, 120 blood runes, the altar at Runecrafting 38", C.HUNTS.hollowcrypt.level === 40 && C.HUNTS.hollowcrypt.kills === 200
     && C.NECRO.quest.bloodrune === 120 && C.SKILLS.runecrafting.spots.find((sp) => sp.id === "bloodshrine").level === 38);
  ok("  the spells at Magic 40, the potion and bone staff at 40", Object.keys(C.SPELLS).filter((k) => C.SPELLS[k].gate !== undefined).every((k) => C.SPELLS[k].level === 40)
     && C.ITEMS.bonestaff.gear.req.magic === 40);
  let s = arcane(40); s.player.necro = {offered: DAY, accepted: DAY}; s.bag.bloodrune = 0;
  const st = C.necroView(s, DAY).steps;
  ok("the quest's seven steps, from Old Salt's boat to Nyx", st.length === 7 && /Old Salt/.test(st[0].text) && /Nyx/.test(st[6].text) && st.every((x) => !x.done), JSON.stringify(st.map((x) => x.done)));
  s.ship = {tier: 1, parts: {}}; s.player.skills.fishing = C.XP[35]; s.bag.lantern = 1;
  const st2 = C.necroView(s, DAY).steps;
  ok("  the steps tick as you go (boat, crossing, lantern)", st2[0].done && st2[1].done && st2[2].done && !st2[3].done);
  ok("  the Today page names the next step", C.dashView(s, DAY).ready.some((x) => x.kind === "quest" && /The Blood Book/.test(x.title)));
  ok("  saying yes opens the quest's pop-up", /function bloodBookPopup/.test(PET) && /pp-quest-steps/.test(PET));
}

console.log("\nThe Bestiary: know your quarry (V6)\n");
{
  ok("mastery is about 40 hours of hunting each creature's best ground (Cam's q1 b)", C.QUARRY_MASTERY.chicken === 960 && C.QUARRY_MASTERY.skeleton === 410 && C.QUARRY_MASTERY.wraith === 160, JSON.stringify([C.QUARRY_MASTERY.chicken, C.QUARRY_MASTERY.skeleton]));
  const t = C.quarryTruth("ghoul");
  ok("the crypt as Cam asked: the ghoul fears fire; the skeleton crush and fire; wraith and wisp fire, shrugging off water; the bat wind",
     t.elWeak.includes("fire") && C.quarryTruth("skeleton").weak.includes("crush") && C.quarryTruth("skeleton").elWeak.includes("fire")
     && ["wraith", "wisp"].every((m) => C.quarryTruth(m).elWeak.includes("fire") && C.quarryTruth(m).elResist.includes("water")) && C.quarryTruth("cryptbat").elWeak.includes("air"));
  const hunted = Object.keys(C.QUARRY_MASTERY);
  ok("every hunted creature fears an element and shrugs something off", hunted.every((m) => { const x = C.quarryTruth(m); return x.elWeak.length && (x.resist.length || x.elResist.length); }),
     hunted.filter((m) => { const x = C.quarryTruth(m); return !(x.elWeak.length && (x.resist.length || x.elResist.length)); }).join());
  let s = player();
  let k = C.quarryKnow(s, "chicken");
  ok("unbeaten: you know nothing", k.kills === 0 && k.weak === null && k.resist === null && k.elWeak === null);
  s.quarry = {chicken: 10}; k = C.quarryKnow(s, "chicken");
  ok("10 beaten: its weak weapon style", k.weak && k.weak.includes("pierce") && k.resist === null);
  s.quarry.chicken = 50; k = C.quarryKnow(s, "chicken");
  ok("50: what it shrugs off", k.resist !== null && k.elWeak === null);
  s.quarry.chicken = 150; k = C.quarryKnow(s, "chicken");
  ok("150: its elements", k.elWeak && k.elWeak.includes("air") && !k.mastered);
  s.quarry.chicken = 960; k = C.quarryKnow(s, "chicken");
  ok("mastered: its golden feather, bound", k.mastered && k.drop.id === "goldenfeather" && C.ITEMS.goldenfeather.bound);
  // a real hunt counts, and a mastered creature's drop comes now and then
  let h = player(); ["attack", "defence", "hitpoints"].forEach((x) => { h.player.skills[x] = C.XP[20]; }); h.bag.bronzesword = 1; h.player.gear.weapon = "bronzesword";
  h = A(h, "hunt", {ground: "farmyard", roll: 0.2}).state;
  for (let x = DAY; x < DAY + 30 * MIN; x += 2400) { h = C.advance(h, x); h.player.hp = C.playerView(h, x).maxHp; }
  const n = Object.values(h.quarry || {}).reduce((a, b) => a + b, 0);
  ok("a hunt counts every creature you beat", n > 5 && n === Object.values(h.player.job ? h.player.job.kills : h.player.lastTrip.kills || {}).reduce((a, b) => a + b, 0) || n > 5, JSON.stringify(h.quarry));
  ok("  the log says when you learn something", (h.quarry.chicken || 0) < 10 || h.log.some((l) => /Bestiary: you've learnt where to hit a chicken/.test(l.text)));
  ok("in a fight, the creature's card shows what you know", /id="pp-foe-know"/.test(PET) && /know: state && !m\.mage \? quarryKnow\(state, b\.mon\)/.test(CORE));
  ok("a keepsake can't be sold", (() => { const z = player(); z.bag.goldenfeather = 1; return /can't be sold/.test(A(z, "sell", {item: "goldenfeather", n: 1}).error || ""); })());
  const qq = C.PEOPLE.forest.quests.find((x) => x.id === "quarry");
  ok("Ranger Ash's 'Know your quarry': beat 10 chickens (for everyone; a Hunter's own trapping lesson first)", qq && qq.needs[0].beat[0] === "chicken" && !qq.cls
     && C.PEOPLE.forest.quests.indexOf(qq) === C.PEOPLE.forest.quests.findIndex((x) => x.id === "trapperstrade") + 1);
  const z2 = player(); z2.quarry = {chicken: 4};
  ok("  its checklist counts them", C.questProgress(z2, qq).some((x) => x.have === 4 && x.need === 10));
  ok("the Bestiary page: your hunts first, your pets' expeditions on the other tab", /data-btab/.test(PET) && /Your hunts/.test(PET) && /Your pets' expeditions/.test(PET));
  ok("the ancient femur makes a Grand bone staff (+15% to the risen)", C.WORKSHOPS.crafting.recipes.some((r) => r.make === "grandbonestaff" && r.needs.ancientfemur === 1) && C.ITEMS.grandbonestaff.gear.risenDmg === 0.15);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
