/* Battle Re-work Part 5 (2026-10-15): the Berserker -- longswords, mauls (two-handed, slow, heavy, a stun), maces, spiked
   gauntlets (no bare fists), fury (a meter built in the fight that pays for specials), Bloodlust, and the Bloodrage branch.
   Run: node test/test_pet_berserker.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 15, 8);
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
function bers(lv, weapon, cls) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  ["attack", "ranged", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, T0).maxHp;
  Object.assign(s.bag, {steelmaul: 1, steellongsword: 1, steelsword: 1, steelmace: 1, steelspikedgauntlets: 1, bronzemaul: 1});
  s = A(s, "class", {cls: cls || "berserker"}).state;
  if (weapon) s = A(s, "equip", {item: weapon}).state;
  return s;
}
function fight(s, mon, seed) {
  s.player.job = {hunt: "deepforest", seed: seed || 9, count: 0, kills: {}, items: {}, xp: 0, since: T0, next: T0, until: T0 + 3600e3};
  C.startBattle(s, s.player, "hunt", "deepforest", mon, T0, s.player.job);
}
const round = (s, i) => C.battleRound(s, s.player, s.player.battle, T0 + 2400 * (i || 1));
const mine = (s, i) => s.player.battle.rounds.filter((x) => x.t === T0 + 2400 * i);

console.log("\nThe Berserker's arms\n");
{
  const A_ = C.WORKSHOPS.anvil.recipes, has = (id) => A_.some((r) => r.make === id);
  ok("longswords, mauls and maces bronze to rune, spiked gauntlets bronze to adamant -- all at the anvil",
     ["bronze", "iron", "steel", "mithril", "adamant", "rune"].every((m) => has(m + "longsword") && has(m + "maul") && has(m + "mace"))
     && ["bronze", "steel", "mithril", "adamant"].every((m) => has(m + "spikedgauntlets")));
  ok("  a longsword is a Berserker's, a little stronger than a sword; a mace is anyone's, and crushes",
     C.ITEMS.steellongsword.gear.cls === "berserker" && C.ITEMS.steellongsword.gear.att > C.ITEMS.steelsword.gear.att && !C.ITEMS.steelmace.gear.cls && C.WEAPONS.steelmace[0] === "crush");
  ok("  each sells for more than it takes to make", ["steelmaul", "runelongsword", "adamantspikedgauntlets"].every((k) => {
       const r = A_.find((x) => x.make === k); return C.priceOf(k) >= (r.fee || 0) + Object.keys(r.needs).reduce((a, n) => a + C.priceOf(n) * r.needs[n], 0); }));
}
{
  let s = bers(30, "steelsword"); s = A(s, "offhand", {item: "steelmace"}).state;
  const r = A(s, "equip", {item: "steelmaul"});
  ok("a maul takes both hands: the off-hand mace goes back in the bag", r.ok && !r.state.player.gear.offhand && /both hands/.test(r.msg));
  ok("  and nothing goes in the off hand while you hold it", /takes both hands/.test(A(r.state, "offhand", {item: "steelmace"}).error));
  ok("  nor can a maul go in the off hand", /only be your main/.test(A(bers(30, "steelsword"), "offhand", {item: "bronzemaul"}).error));
  ok("  a Hunter can't take up a maul", /for Berserkers/.test(A(bers(30, null, "hunter"), "equip", {item: "steelmaul"}).error));
}
{
  let s = bers(30, "steelmaul"); fight(s, "brownbear");
  round(s, 1); round(s, 2);
  ok("the maul is slow: the second round is a wind-up, not a blow", mine(s, 2).some((x) => x.by === "you" && x.windup) && !mine(s, 2).some((x) => x.by === "you" && x.hit > 0));
  const me = s.player.battle.me;
  ok("  but heavy, and a big blow may stun", me.slow && me.heavy === 1.55 && me.stunBig === 0.7 && me.bigStun === 0.4);
  ok("  and each blow wears it twice as fast", C.ITEMS.steelmaul.gear.wearBy === 2);
}
{
  let s = bers(30); s = A(s, "equip", {item: "steelspikedgauntlets"}).state; delete s.player.gear.weapon;
  const me = C.playerFighter(s, s.player, {seed: 1}, T0).me;
  ok("no weapon, spiked gauntlets on: you hit with them, not bare fists -- and they can bleed", me.wname === "Steel spiked gauntlets" && me.onHit && me.onHit.chance === 0.25 && me.maxHit > 2 + Math.floor(C.levelOf(s.player.skills.attack) / 4),
     JSON.stringify([me.wname, me.onHit, me.maxHit]));
}

console.log("\nFury\n");
{
  let s = bers(30, "steellongsword"); s = A(s, "combat", {special: "cleave"}).state; s.player.spec = 100; fight(s, "brownbear");
  ok("a Berserker's specials run on fury: none yet (the special bar doesn't count)", /needs 50 fury \(0 so far\)/.test(A(s, "battle", {cmd: "special"}).error));
  round(s, 1); round(s, 2);
  const f2 = s.player.fury;
  ok("  hitting and being hit fills it", f2 > 4, f2);
  s.player.fury = 60; s = A(s, "battle", {cmd: "special"}).state; round(s, 3);
  ok("  with 50, Cleave goes, and the fury is spent", mine(s, 3).some((x) => x.spec === "Cleave") && s.player.fury < 60, JSON.stringify(mine(s, 3)));
  // PT4 (Cam): "once i go into the next battle the fury built up is gone. I would like it to stay persistent on a hunt until used"
  let p = bers(30, "steellongsword"); p = A(p, "combat", {special: "cleave"}).state;
  p = A(p, "hunt", {ground: "farmyard", roll: 0.3}).state; let t = T0;
  for (let i = 0; i < 400 && !(p.player.job && p.player.job.count >= 2 && !p.player.battle); i++) { t += 600; p = C.advance(p, t); }
  ok("fury lasts the hunt: after two fights it's still there, between fights", p.player.job && !p.player.battle && p.player.fury > 0, JSON.stringify({fury: p.player.fury, count: p.player.job && p.player.job.count}));
  p.player.fury = 70; const q = A(p, "battle", {cmd: "special"}, t);
  ok("  and between fights Special readies Cleave for the next fight's first blow", q.ok && /next fight/.test(q.msg), q.error);
  let u = q.state; for (let i = 0; i < 300 && !u.player.battle; i++) { t += 500; u = C.advance(u, t); }
  ok("  ...paid from fury when it opens", u.player.battle && u.player.battle.me.spec && u.player.battle.me.spec.name === "Cleave" && u.player.fury < 70, JSON.stringify([u.player.fury]));
  u = A(u, "home", {}, t + 10).state;
  ok("  home again, it fades", !u.player.fury);
  let h = bers(30, null, "hunter"); h.bag.shortbow = 1; h.bag.bronzearrow = 50; h.bag.leatherquiver = 1; h = A(h, "equip", {item: "shortbow"}).state; h = A(h, "equip", {item: "leatherquiver"}).state; h = A(h, "equip", {item: "bronzearrow"}).state;   // (N19: a quiver)
  h.player.spec = 100; h = A(h, "combat", {special: "aimed"}).state; fight(h, "brownbear");
  ok("  the other classes keep their special bar", A(h, "battle", {cmd: "special"}).ok);
}
{
  let s = bers(20, "steellongsword");
  ok("Bloodlust comes at Berserker level 25", /level 25/.test(A(s, "combat", {special: "bloodlust"}).error));
  s = bers(30, "steellongsword"); s = A(s, "combat", {special: "bloodlust"}).state; fight(s, "brownbear");
  s.player.hp = 10; s.player.fury = 90; s = A(s, "battle", {cmd: "special"}).state; const hp0 = s.player.hp; round(s, 1);
  const hit = mine(s, 1).filter((x) => x.by === "you" && x.hit > 0).reduce((a, x) => a + x.hit, 0), took = mine(s, 1).filter((x) => x.by === "them").reduce((a, x) => a + (x.hit || 0), 0);
  ok("  and heals a fifth of the damage you deal, for this blow and three rounds more", s.player.battle.lust && s.player.battle.lust.left === 3 && (!hit || s.player.hp > hp0 - took), JSON.stringify({hit, took, hp0, hp: s.player.hp}));
}

console.log("\nThe Bloodrage branch\n");
{
  const br = C.TALENTS.berserker.branches.find((b) => b.id === "bloodrage");
  ok("the Bloodrage branch is in: eight nodes, Bloodletter or Berserk, Red mist at the bottom", !br.later && br.nodes.length === 8
     && br.nodes.filter((n) => n.choice === "bers4").map((n) => n.id).join() === "bloodletter,berserk" && br.nodes.find((n) => n.keystone).id === "redmist");
  ok("  Momentum now gives fury, not special energy", JSON.stringify(C.TALENTS.berserker.branches[0].nodes.find((n) => n.id === "momentum").fx) === '{"furyGain":0.1}');
  let s = bers(30, "steellongsword"); s.player.classes.berserker.xp = C.XP[30];
  for (const n of ["thickblood", "thickblood", "thickblood", "secondwind"]) s = A(s, "talent", {node: n}).state;
  fight(s, "brownbear"); s.player.hp = 3; s.player.battle.fx = {them: [{kind: "stunned", rounds: 3, power: 0}], you: []};   // it can't swing
  round(s, 1); const hp1 = s.player.hp; round(s, 2);
  ok("  Second wind: once a fight, at a fifth of your health, a tenth back", mine(s, 1).some((x) => x.wind > 0) && hp1 > 3 && !mine(s, 2).some((x) => x.wind), JSON.stringify(mine(s, 1)));
  let k = bers(50, "steellongsword"); k.player.classes.berserker.xp = C.XP[50];
  for (const n of ["seething", "seething", "seething", "thickblood", "thickblood", "thickblood", "painfeeds", "painfeeds", "bloodletter", "bloodthirst", "bloodthirst", "secondwind", "redmist"]) k = A(k, "talent", {node: n}).state;
  const t = C.talentSum(k.player);
  ok("  fury talents add up: Seething, Pain feeds, Bloodletter, Bloodthirst, Red mist", Math.abs(t.furyGain - 0.3) < 1e-9 && t.furyTake === 0.5 && t.lustHeal === 0.1 && t.furyHit === 2 && t.furyDmg === 0.15, JSON.stringify(t));
}

console.log("\nThe screens\n");
ok("the fight shows fury in the special bar (its own colour), wind-ups and second winds; the Combat tab explains fury and locks Bloodlust",
   /sbar\.classList\.toggle\("fury"/.test(PET) && /You heave your/.test(PET) && /Second wind!/.test(PET) && /pv\.meter === "devotion" \? "Devotion" : "Fury"/.test(PET) && /specLocks/.test(PET));   // (the Kit's Combat tab names the bar: the paragraph explaining it went, 2026-10-20)

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
