/* Battle Re-work Part 3 (2026-10-15): class levels and skill trees. Cam: "Skill trees similar to what you would find in
   diablo should be implemented for each class"; Q2: each class its own level, switching starts a class at 1, old saves
   start at their combat skill's level. Run: node test/test_pet_talents.js [app dir] */
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
const fresh = () => { const s = C.act(C.advance(C.empty(), T0), "player", {name: "Tester"}, T0).state; s.story = {on: false}; return s; };
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
const spend = (s, ids) => { for (const id of ids) { const r = A(s, "talent", {node: id}); if (!r.ok) return [s, r.error]; s = r.state; } return [s, ""]; };

console.log("\nClass levels\n");
{
  let s = fresh(); s.player.skills.attack = C.XP[30];
  s = A(s, "class", {cls: "berserker"}).state;
  ok("your first class starts at its own combat skill's level (Attack 30: Berserker 30)", C.classLevel(s.player, "berserker") === 30);
  const sw = A(s, "class", {cls: "hunter", guild: true}); s.player.freeSwitch = 1; const sw2 = A(s, "class", {cls: "hunter", guild: true}); s = sw2.state;
  ok("  a second class starts at 1 (Cam, Q2), and the first keeps its level", sw2.ok && s.player.cls === "hunter" && C.classLevel(s.player, "hunter") === 1 && C.classLevel(s.player, "berserker") === 30, sw2.error);
  const old = JSON.parse(JSON.stringify(fresh())); old.player.cls = "arcane"; old.player.skills.magic = C.XP[22]; old.v = 13; delete old.player.classes;
  ok("  an old save: the class you are starts at its combat skill's level", C.classLevel(C.advance(old, T0).player, "arcane") === 22);
}
{
  let s = fresh(); s.player.skills.ranged = C.XP[10]; s.player.skills.hitpoints = C.XP[20]; s.player.hp = 20;
  Object.assign(s.bag, {shortbow: 1, bronzearrow: 300, leatherquiver: 1}); s = A(s, "class", {cls: "hunter"}).state;
  s = A(s, "equip", {item: "shortbow"}).state; s = A(s, "equip", {item: "leatherquiver"}).state; s = A(s, "equip", {item: "bronzearrow"}).state;
  const x0 = s.player.classes.hunter.xp, r0 = s.player.skills.ranged;
  s = A(s, "hunt", {ground: "farmyard", roll: 0.3}).state; s = C.advance(s, T0 + 20 * 60e3);
  ok("hunting as a Hunter: its class xp grows with your Ranged xp (not Hitpoints)", Math.abs((s.player.classes.hunter.xp - x0) - (s.player.skills.ranged - r0)) < 1 && s.player.classes.hunter.xp > x0,
     [s.player.classes.hunter.xp - x0, s.player.skills.ranged - r0]);
}

console.log("\nThe tree\n");
{
  let s = fresh(); s.player.skills.attack = C.XP[30]; s = A(s, "class", {cls: "berserker"}).state;
  ok("a point every 2 class levels (30: 15)", C.talentPoints(s.player, "berserker") === 15 && C.talentsView(s).left === 15);
  ok("  three branches, all filled (since Parts 4-6 every class's tree is whole)", C.talentsView(s).branches.map((b) => b.id + (b.later ? "*" : "")).join() === "slaughter,juggernaut,bloodrage" && Object.keys(C.TALENTS).filter((k) => k !== "//").every((c) => C.TALENTS[c].branches.every((b) => !b.later)));
  ok("  a deeper tier waits for points in its branch", /Spend 3 points in Slaughter/.test(A(s, "talent", {node: "cleaver"}).error));
  let [t1, e1] = spend(s, ["heavyhands", "brutal", "brutal", "brutal"]);
  ok("  ...and its parent: Cleaver needs Heavy hands, Momentum needs Brutal", !e1 && A(t1, "talent", {node: "cleaver"}).ok && A(t1, "talent", {node: "momentum"}).ok);
  ok("  a node stops at its top rank", /top rank/.test(A(t1, "talent", {node: "heavyhands"}).error));
  [t1, e1] = spend(t1, ["cleaver", "cleaver", "momentum"]);
  [t1, e1] = spend(t1, ["flurry"]);
  ok("  a choice pair: Flurry or Executioner, never both", !e1 && /one or the other/.test(A(t1, "talent", {node: "executioner"}).error));
  ok("  a Hunter's talent isn't a Berserker's", /Hunter's talent/.test(A(t1, "talent", {node: "steadyaim"}).error));
  let low = fresh(); low = A(low, "class", {cls: "berserker"}).state;
  ok("  no points, no talents", /No points/.test(A(low, "talent", {node: "heavyhands"}).error));
}
{
  let s = fresh(); s.player.skills.attack = C.XP[40]; s = A(s, "class", {cls: "berserker"}).state;
  Object.assign(s.bag, {bronzesword: 1}); s = A(s, "equip", {item: "bronzesword"}).state;
  const me0 = C.playerFighter(s, s.player, {seed: 1}, T0).me;
  const [t] = spend(s, ["heavyhands", "brutal", "brutal", "brutal", "ironskin", "ironskin"]);
  const me1 = C.playerFighter(t, t.player, {seed: 1}, T0).me;
  ok("talents show in the fight: +1 max hit, +3 attack, +4 defence", me1.maxHit === me0.maxHit + 1 && me1.att > me0.att && me1.def === me0.def + 4, JSON.stringify([me0.maxHit, me1.maxHit, me0.att, me1.att, me0.def, me1.def]));
  const sum = C.talentSum(t.player);
  ok("  and add up from one place (talentSum), capped (dodge never past 50%)", sum.maxHit === 1 && sum.att === 3 && C.TALENT_RULES.caps.dodge === 0.5);
  t.player.cls = "berserker"; t.player.combat.special = "cleave";
  ok("  a cheaper special after Cleaver (Cleave 50 -> 47 a rank)", C.specCostOf(t.player, C.CLASSES.berserker.specials.cleave) === 50 && (() => { const [u] = spend(t, ["cleaver"]); return C.specCostOf(u.player, C.CLASSES.berserker.specials.cleave) === 47; })());
}

console.log("\nRespec and builds\n");
{
  let s = fresh(); s.player.skills.attack = C.XP[14]; s = A(s, "class", {cls: "berserker"}).state;
  let [t] = spend(s, ["heavyhands", "brutal"]);
  const r = A(t, "respec");
  ok("respec is free to class level 15: every point back", r.ok && C.talentsView(r.state).spent === 0 && r.state.coins === t.coins);
  let b = fresh(); b.player.skills.attack = C.XP[30]; b = A(b, "class", {cls: "berserker"}).state; b.coins = 10000;
  [b] = spend(b, ["heavyhands"]);
  ok("  then coins: 100 a class level (30: 3,000), and half as much again each time", C.respecCost(b.player, "berserker") === 3000);
  const r2 = A(b, "respec"); [b] = spend(r2.state, ["heavyhands"]);
  ok("  (paid: 3,000 off, the next 4,500)", r2.state.coins === 7000 && C.respecCost(b.player, "berserker") === 4500);
  b.coins = 100;
  ok("  without the coins, no respec", /costs 4500 coins/.test(A(b, "respec").error));
}
{
  let s = fresh(); s.player.skills.attack = C.XP[30]; s = A(s, "class", {cls: "berserker"}).state;
  let [t] = spend(s, ["heavyhands", "brutal"]);
  t = A(t, "talentbuild", {op: "save", slot: 0, name: "Glass cannon"}).state;
  t = A(t, "respec").state; [t] = spend(t, ["ironskin"]);
  const r = A(t, "talentbuild", {op: "load", slot: 0});
  ok("two saved builds a class: save one, load it back", r.ok && r.state.player.classes.berserker.talents.heavyhands === 1 && !r.state.player.classes.berserker.talents.ironskin && /Glass cannon/.test(r.msg));
  t.player.job = {hunt: "farmyard"};
  ok("  changed at home only -- not on a trip", /at home/.test(A(t, "talentbuild", {op: "load", slot: 0}).error));
  ok("  (the House's room building still works: its action is 'build', the talents' 'talentbuild')", /room|Construction|Nothing|build/i.test(A(fresh(), "build", {room: "smithy"}).error || "ok"));
}

console.log("\nThe Talents tab\n");
ok("the Character sheet has a Talents tab: points, respec, two builds, the branches and their nodes",
   /\["talents", "Talents"\]/.test(PET) && /function talentsHTML\(tv\)/.test(PET) && /data-talent="/.test(PET) && /data-build-save/.test(PET) && /pl-respec/.test(PET));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
