/* Battle Re-work Part 13 (2026-10-16): the Necromancer -- the Hollow Crypt (wisps and life essence, blood essence and the
   Blood altar, Morvane and the Blood Book, Sexton Hobb's stall), the Archmage's offer and quest, the Necromancy branch and
   spells, raising from the graveyard (old graves too, Q9), the risen in a fight, falling again, the vigil, the legacy.
   Run: node test/test_pet_necromancer.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const DAY = new Date(2026, 9, 16, 12).getTime(), NIGHT = new Date(2026, 9, 16, 23).getTime(), H = 3600e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || DAY);
const RUNES = ["air", "water", "earth", "fire", "mind", "chaos", "nature", "death", "cosmic", "astral", "law", "blood"];
function arcane(lv, taught) {
  let s = A(C.advance(C.empty(), DAY), "player", {name: "Tester"}).state; s.story = {on: false};
  ["magic", "defence", "hitpoints", "attack"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, DAY).maxHp;
  s = A(s, "class", {cls: "arcane"}).state; s.player.classes.arcane.xp = C.XP[lv];
  RUNES.forEach((k) => { s.bag[k + "rune"] = 900; });
  s.bag.magicwand = 1; s.player.gear.weapon = "magicwand"; s.bagSize = "rucksack";
  if (taught) s.player.necro = {offered: DAY, accepted: DAY, taught: DAY};
  return s;
}
const risen = (id, lv, extra) => Object.assign({id, name: id, species: "wolf", colour: "grey", born: DAY - 9 * 24 * H, hatchAt: DAY - 9 * 24 * H, joined: DAY, xp: C.XP[lv],
                                                stat: {}, train: "", trainAt: DAY, fedUntil: 0, restUntil: 0, wins: 0, faints: 0, risen: true, raised: 1}, extra || {});
const grave = (o) => Object.assign({name: "Fang", kind: "Wolf", species: "wolf", colour: "grey", rarity: "Common", level: 30, ageDays: 4, area: "the Jungle", cause: "fell", at: DAY - 9e7, cleared: 0, gear: []}, o);

console.log("\nThe Hollow Crypt (13a)\n");
{
  ok("a new region down from the Misty Isle, with a hunting ground at 40 (V8: mid game) and Morvane the Lich after 200 kills", C.REGIONS.hollowcrypt && C.HUNTS.hollowcrypt.level === 40 && C.HUNTS.hollowcrypt.kills === 200 && C.HUNTS.hollowcrypt.boss === "morvane"
     && C.worldView(C.advance(C.empty(), DAY), DAY).links.some(([a, b]) => a === "mistyisle" && b === "hollowcrypt"));
  ok("it needs the boat and a lantern", /lantern/.test(C.regionLock(C.advance(C.empty(), DAY), "hollowcrypt")));
  ok("wisps come out at night, and only wisps carry life essence (Cam's rule)", C.HUNTS.hollowcrypt.monsters.some((m) => m[0] === "wisp" && m[2] === "night")
     && Object.keys(C.MONSTERS).filter((m) => (C.MONSTERS[m].drops || []).some((d) => d[0] === "lifeessence")).join() === "wisp");
  ok("  about one in eight; they dodge and shrug off blades (magic and nets do best)", C.MONSTERS.wisp.drops.find((d) => d[0] === "lifeessence")[3] === 0.125 && C.MONSTERS.wisp.eva >= 0.4 && C.MONSTERS.wisp.resist.slash < 1 && C.MONSTERS.wisp.weak.magic > 1);
  ok("the crypt's dead drop blood essence; the Blood altar (Runecrafting 38, V8) makes blood runes from it", ["skeleton", "ghoul", "cryptbat", "wraith"].every((m) => C.MONSTERS[m].drops.some((d) => d[0] === "bloodessence"))
     && C.SKILLS.runecrafting.spots.some((sp) => sp.id === "bloodshrine" && sp.name === "Blood altar" && sp.area === "hollowcrypt" && sp.level === 38 && sp.bait === "bloodessence" && sp.loot[0][0] === "bloodrune"));
  ok("  and says where blood essence comes from", /Hollow Crypt's dead/.test(C.tripNeeds(arcane(46), "runecrafting", C.SKILLS.runecrafting.spots.find((sp) => sp.id === "bloodshrine"))));
  ok("Smite knows the crypt's undead (the Paladin's tripled blow)", ["skeleton", "ghoul", "wraith", "morvane"].every((m) => C.isUndead(m)));
  ok("every crypt creature has a type for the Beast Master", ["skeleton", "ghoul", "cryptbat", "wraith", "wisp", "morvane"].every((m) => C.BEAST_CREATURE_TYPE[m]));
  ok("Sexton Hobb lives there, with six quests", C.PEOPLE.hollowcrypt.quests.length >= 6);
}

console.log("\nMorvane and the Blood Book\n");
{
  let s = arcane(50); s.bag.lantern = 1; s.bag.boat = 1; s.ship = {tier: 1, parts: {}};
  s.hunt = {hollowcrypt: {kills: 200, wins: 0, losses: 0}};
  const r = A(s, "boss", {ground: "hollowcrypt", roll: 0.3});
  ok("Morvane can be fought once the crypt has had enough of you", !r.error, r.error);
  // (the fight itself is any boss fight; what's tested is the reward: she's down to her last breath)
  const win = (st0, t0) => { let st = st0; st.player.battle.mhp = 1; for (let t = t0; t < t0 + 60e3 && st.player.battle; t += 2400) { st = C.advance(st, t); st.player.hp = C.playerView(st, t).maxHp; } return st; };
  let st = win(r.state, DAY);
  ok("beating her the first time gives the Blood Book", st.lastBoss && st.lastBoss.won && st.bag.bloodbook === 1, JSON.stringify(st.lastBoss && st.lastBoss.got));
  st.hunt.hollowcrypt.kills = 200; st.bag.bloodbook = 0;
  const r2 = A(st, "boss", {ground: "hollowcrypt", roll: 0.7}, DAY + H);
  const s2 = win(r2.state, DAY + H);
  ok("  after that it's a rare drop (3%), not a sure one", s2.lastBoss.won && C.MONSTERS.morvane.drops.some((d) => d[0] === "bloodbook" && d[3] === 0.03) && (s2.lastBoss.got.bloodbook || 0) <= 1);
}

console.log("\nSorceress Nyx's offer (13b, V8: was the Archmage's)\n");
{
  let s = arcane(50);
  ok("no offer before you beat her", /Beat Sorceress Nyx/.test(A(s, "necro", {op: "accept"}).error));
  C.archmageOffer(s, 3, DAY);
  ok("beating the Mage (rank 3) isn't enough", !s.player.necro || !s.player.necro.offered);
  C.archmageOffer(s, 4, DAY);
  ok("beating Sorceress Nyx (rank 4): her offer, in her words", C.NECRO.offerRank === 4 && s.player.necro.offered && s.log.some((l) => /older line of magic/.test(l.text)));
  const old = arcane(50); C.archmageOffer(old, C.MAGE_RANKS.length - 1, DAY);
  ok("  (beating the Archmage still makes it, for a save that skipped past her)", old.player.necro && old.player.necro.offered);
  let r = A(s, "necro", {op: "decline"});
  ok("No -- and the offer stands (Q15)", !r.error && /offer stands/.test(r.msg)); s = r.state;
  ok("  the tower shows it", C.necroView(s, DAY).declined && C.necroView(s, DAY).offered);
  r = A(s, "necro", {op: "accept"}); s = r.state;
  ok("Yes, later: she names the book, the Lich and the crypt", !r.error && /Morvane/.test(r.msg) && /Hollow Crypt/.test(r.msg));
  ok("bringing too little: she says what's short", /short of the blood book/i.test(A(s, "necro", {op: "learn"}).error));
  s.bag.bloodbook = 1; s.bag.bloodrune = 170;
  r = A(s, "necro", {op: "learn"});
  ok("the Blood Book and 120 blood runes (V8, was 200): Necromancy", !r.error && r.state.player.necro.taught && !r.state.bag.bloodbook && r.state.bag.bloodrune === 50, r.error);
  s = r.state;
  ok("  the Necromancy branch opens on the Arcane tree", C.talentsView(s).branches.some((b) => b.id === "necromancy" && !b.locked));
  const t2 = arcane(50);
  ok("  (locked for an Arcane who hasn't learnt it, and says why)", C.talentsView(t2).branches.find((b) => b.id === "necromancy").locked && /Nyx/.test(C.talentLock(t2.player, "gravewhispers")));
}

console.log("\nThe spells\n");
{
  let s = arcane(50, true);
  const lock = (k) => C.spellLock(s, k);
  ok("eight Necromancy spells", Object.keys(C.SPELLS).filter((k) => C.SPELLS[k].gate !== undefined).length === 8);
  ok("Raise the fallen, Mend the dead and Wither are there at once", !lock("raisefallen") && !lock("menddead") && !lock("wither"));
  ok("the others wait for points in Necromancy (Bone spear 3, Grave chill 6, Army 9, Last rites 12)", /3 points in Necromancy/.test(lock("bonespear")) && /6 points/.test(lock("gravechill")) && /9 points/.test(lock("armydead")) && /12 points/.test(lock("lastrites")));
  ["gravewhispers", "gravewhispers", "gravewhispers"].forEach((n) => { s = A(s, "talent", {node: n}).state; });
  ok("  3 points in: Bone spear", !C.spellLock(s, "bonespear"));
  const b = arcane(50, true); b.player.cls = "berserker";
  ok("only an Arcane casts them", /Arcane's magic/.test(C.spellLock(b, "raisefallen")));
  ok("not without learning them", /Nyx teaches/.test(C.spellLock(arcane(50), "raisefallen")));
}

console.log("\nRaising the dead\n");
{
  let s = arcane(50, true);
  s.graveyard = [grave({battle: true, level: 30, pet: {id: "Fang", name: "Fang", species: "wolf", colour: "grey", xp: C.XP[30], moves: ["bite"]}}),
                 grave({name: "Mittens", kind: "Cat", species: "cat", colour: "tabby", rarity: "Rare", level: 22}),
                 grave({name: "Old Tom", kind: "Cat", species: "cat", colour: "tabby", rarity: "Common", level: 3})];
  const nv = C.necroView(s, DAY);
  ok("a battle pet's grave costs its level / 5 in life essence (30: 6)", nv.graves[0].level === 30 && nv.graves[0].cost === 6);
  ok("an old grave (Q9): half its level plus its rarity's bonus (22, Rare: 15 -- 3 essence)", nv.graves[1].level === 15 && nv.graves[1].cost === 3);
  ok("  never below 5", nv.graves[2].level === 5);
  ok("no life essence: it says where it comes from", /wisps carry it/.test(A(s, "raise", {i: 0}).error));
  s.bag.lifeessence = 20;
  let r = A(s, "raise", {i: 0});
  ok("raising: the grave empties, a risen joins your battle pets, and says so in its kind's own way", !r.error && r.state.bag.lifeessence === 14 && r.state.graveyard.length === 2 && r.state.beasts.some((x) => x.risen && x.id === "Fang") && /leans against your leg/.test(r.msg), r.error);   // (a Beast's own line)
  s = r.state;
  const f = s.beasts.find((x) => x.id === "Fang");
  ok("  it keeps its battle level and its moves", C.levelOf(f.xp) === 30 && (f.moves || []).join() === "bite");
  const sw = arcane(50, true); sw.graveyard = [grave({})]; sw.bag.lifeessence = 9; sw.player.cls = "paladin";
  ok("not unless you're an Arcane", /Arcane/.test(A(sw, "raise", {i: 0}).error));
  // falling again
  C.risenFalls(s, f, DAY + H, C.MONSTERS.skeleton);
  ok("a risen that falls goes back to its grave, keeping its level", !s.beasts.some((x) => x.id === "Fang") && s.graveyard[0].risen && s.graveyard[0].level === 30 && s.graveyard[0].raised === 1);
  ok("  and costs 50% more to raise again (9)", C.necroView(s, DAY).graves[0].cost === 9);
  ok("  no permadeath for the risen -- it can always be raised again", !A(Object.assign(s, {bag: Object.assign(s.bag, {lifeessence: 20})}), "raise", {i: 0}).error);
}

console.log("\nThe risen in a fight\n");
{
  let s = arcane(50, true);
  s.beasts = [risen("Fang", 30), risen("Bones", 20)];
  s.player.loadout = ["raisefallen", "menddead", "fireblast"]; s.bag.cookedshark = 0;
  let r = A(s, "hunt", {ground: "jungle", roll: 0.4}); s = r.state;
  let b = null;
  for (let t = DAY; t < DAY + 30e3; t += 2400) { s = C.advance(s, t); if (s.player.battle && s.player.battle.rounds.length) b = s.player.battle; }   // (a fight with rounds in it, not one just begun)
  ok("Raise the fallen brings the best one in first", b && b.risen && b.risen[0].id === "Fang" && b.rounds.some((x) => x.rose || x.stays)   /* (later fights: it stays from the last, PT24) */, JSON.stringify(b && b.rounds.slice(0, 3)));
  ok("  only one at a time without Second risen", b && b.risen.length === 1);
  ok("  it strikes each round", b && b.rounds.some((x) => x.risen && x.move === "Strike"));
  for (let t = DAY + 30e3; t < DAY + 20 * 60e3; t += 2400) { s = C.advance(s, t); s.player.hp = Math.max(s.player.hp, 40); }
  const all = [];
  ok("the creature sometimes turns on it (it took blows)", (s.beasts.find((x) => x.id === "Fang").hp || 0) < C.necroView(s, DAY).risen.find((x) => x.id === "Fang").maxHp || s.beasts.find((x) => x.id === "Fang").wins > 0);
  ok("its health stays down between fights (no healing on its own)", (() => { const x = s.beasts.find((y) => y.id === "Fang"); const h0 = C.necroView(s, DAY + 21 * 60e3).risen.find((y) => y.id === "Fang").hp; return C.necroView(s, DAY + 10 * H).risen.find((y) => y.id === "Fang").hp === h0; })());
  ok("it earns battle xp from wins, at half a battle pet's", s.beasts.find((x) => x.id === "Fang").xp > C.XP[30] && C.NECRO.xpShare === 0.5);
  void all;
  // the potion
  const p = arcane(50, true); p.beasts = [risen("Fang", 30, {hp: 10})]; p.bag.lifepotion = 1;
  r = A(p, "risenpotion", {id: "Fang"});
  ok("a potion of life essence mends a risen by half", !r.error && C.necroView(r.state, DAY).risen[0].hp === 10 + Math.round(C.necroView(r.state, DAY).risen[0].maxHp * 0.5), r.error);
  ok("  food does nothing for them (the plan's food goes to you)", C.ITEMS.lifepotion.risenHeal === 0.5 && !C.ITEMS.cookedshark || !C.ITEMS.cookedshark.risenHeal);
  // a Berserker's fight has no risen, and its dice are untouched
  const z = arcane(50); z.beasts = [risen("Fang", 30)]; z.player.loadout = ["fireblast"];
  let zz = A(z, "hunt", {ground: "jungle", roll: 0.4}).state; for (let t = DAY; t < DAY + 30e3; t += 2400) zz = C.advance(zz, t);
  ok("an Arcane who hasn't learnt Necromancy fights alone, even with risen in the crypt", !(zz.player.battle && zz.player.battle.risen));
}

console.log("\nThe talents\n");
{
  let s = arcane(50, true);
  ["gravewhispers", "gravewhispers", "gravewhispers", "secondrisen"].forEach((n) => { s = A(s, "talent", {node: n}).state; });
  ok("Second risen: two at once", C.risenSlots(s.player) === 2);
  ["bonemending", "bonemending", "deathless", "deathless", "deathless", "lingeringcurse", "lingeringcurse"].forEach((n) => { s = A(s, "talent", {node: n}).state; });
  let r = A(s, "talent", {node: "sacrifice"});
  ok("Sacrifice: a place given up for 15% on your spells", !r.error && C.risenSlots(r.state.player) === 1 && C.talentsView(r.state).sum.magPct >= 0.15, r.error);
  ok("  it's that or Third risen", /one or the other/.test(A(r.state, "talent", {node: "thirdrisen"}).error || ""));
  ok("taking less is capped (30%)", C.TALENT_RULES.caps.risenDr === 0.3);
}

console.log("\nThe crypt merchant and the vigil\n");
{
  let s = arcane(50, true); s.bag.lantern = 1; s.ship = {tier: 1, parts: {}}; s.coins = 50000;
  const stock = C.stockFor("cryptmerchant", DAY);
  ok("Sexton Hobb sells life essence, dear", stock.length === 1 && stock[0][0] === "lifeessence" && stock[0][1] >= 3000);
  let r = A(s, "buy", {from: "cryptmerchant", item: "lifeessence", n: 5});
  ok("three a day at most", !r.error && r.state.bag.lifeessence === 3 && r.state.coins === 50000 - 9000, r.error);
  ok("  then: come back tomorrow", /tomorrow/.test(A(r.state, "buy", {from: "cryptmerchant", item: "lifeessence"}).error));
  ok("  and tomorrow, three more", !A(r.state, "buy", {from: "cryptmerchant", item: "lifeessence"}, DAY + 24 * H).error);
  const no = arcane(50); no.coins = 50000;
  ok("not without reaching the crypt", !!A(no, "buy", {from: "cryptmerchant", item: "lifeessence"}).error);
  ok("the vigil: after dark only", /after dark/.test(A(s, "vigil", {}, DAY).error));
  let got = 0, kept = 0;
  for (let d = 0; d < 20; d++) { const v = A(s, "vigil", {}, NIGHT + d * 24 * H); if (!v.error) { kept++; s = v.state; if (/wisp drifts/.test(v.msg)) got++; } }
  ok("once a night; a wisp comes some nights (about a third)", kept === 20 && got >= 3 && got <= 12, got + "/" + kept);
  ok("  twice in one night: no", /tonight's vigil/.test(A(s, "vigil", {}, NIGHT + 19 * 24 * H + 60e3).error));
}

console.log("\nThe legacy (Part 12)\n");
{
  const s = arcane(50, true); s.hunt = {jungle: {wins: 1, kills: 1}};
  const L = C.legacyOf(s), n = C.newGame({mode: "adventure", from: s, pets: []}, DAY);
  ok("an Arcane who learnt Necromancy leaves the Necromancer's gift: 3 life essence and a bone staff", L.name === "Arcane (Necromancer)" && n.bag.lifeessence === 3 && n.bag.bonestaff === 1);
}

console.log("\nThe screens\n");
ok("the mage tower shows the offer, with Yes and No, and the quest", PET.includes("function necroOfferHTML") && PET.includes('data-necro="accept"') && PET.includes('data-necro="learn"') && PET.includes("necroOfferHTML(s, now)"));
ok("the graveyard is the Necromancer's ground: graves with Raise, the risen with a potion, the vigil -- a chained gate before", PET.includes("necroGroundHTML(s, Date.now())") && PET.includes("data-raise=") && PET.includes("data-risenpotion=") && PET.includes("data-vigil") && PET.includes("An old gate, chained"));
ok("the fight says what the risen do", PET.includes("rises to fight beside you") && PET.includes("Mend the dead") && PET.includes("goes back to rest in the graveyard"));
ok("the Misty Isle has a way down; the crypt a way up and Hobb's stall", /mistyisle: \[\["@hollowcrypt"/.test(PET) && /hollowcrypt: \[\["shop:cryptmerchant"/.test(PET));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
