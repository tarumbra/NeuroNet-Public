/* Battle Re-work Part 7 (2026-10-15): the Thief -- daggers (two at once), a bow too, throwing knives, poisons and venoms
   coating your blades, Backstab / Envenom / Smoke bomb, and the Venom, Shadows and Blades branches.
   Run: node test/test_pet_thief.js [app dir] */
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
function thief(lv, cls) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  ["attack", "ranged", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, T0).maxHp;
  Object.assign(s.bag, {steeldagger: 2, steelsword: 1, weakpoison: 3, strongpoison: 2, paralyticvenom: 1, weakeningvenom: 1, throwingknife: 10, shortbow: 1, bronzearrow: 100, leatherquiver: 1});
  s = A(s, "class", {cls: cls || "thief"}).state;
  return s;
}
function fight(s, mon, seed) {
  s.player.job = {hunt: "deepforest", seed: seed || 7, count: 0, kills: {}, items: {}, xp: 0, since: T0, next: T0, until: T0 + 3600e3};
  C.startBattle(s, s.player, "hunt", "deepforest", mon, T0, s.player.job);
}
const round = (s, i) => C.battleRound(s, s.player, s.player.battle, T0 + 2400 * i);
const at = (s, i) => s.player.battle.rounds.filter((x) => x.t === T0 + 2400 * i);

console.log("\nThe Thief\n");
{
  const T = C.CLASSES.thief;
  ok("a new class: daggers or a bow (Attack or Ranged), three specials", T && T.styles.join() === "melee,ranged" && ["backstab", "envenom", "smokebomb"].every((k) => T.specials[k]) && T.specials.backstab.style === "melee");
  ok("  with its own tree: Venom, Shadows, Blades (eight nodes each, a keystone at the bottom)",
     C.TALENTS.thief.branches.map((b) => b.id).join() === "venom,shadows,blades" && C.TALENTS.thief.branches.every((b) => b.nodes.length === 8 && b.nodes.some((n) => n.keystone)));
  const W = C.WORKSHOPS;
  ok("  daggers bronze to rune and throwing knives at the anvil; poisons and venoms at the apothecary table",
     ["bronze", "iron", "steel", "mithril", "adamant", "rune"].every((m) => W.anvil.recipes.some((r) => r.make === m + "dagger")) && W.anvil.recipes.some((r) => r.make === "throwingknife")
     && ["weakpoison", "strongpoison", "deadlypoison", "paralyticvenom", "weakeningvenom"].every((k) => W.apothecary.recipes.some((r) => r.make === k)));
  ok("  snakes and spiders drop venom sacs (strong and deadly poisons need them)", C.MONSTERS.snake.drops.some((d) => d[0] === "venomsac") && C.MONSTERS.giantspider.drops.some((d) => d[0] === "venomsac"));
  ok("  a Hunter can't take a dagger", /for Thiefs|for Thieves|Thief/.test(A(thief(20, "hunter"), "equip", {item: "steeldagger"}).error || ""));
}
{
  let s = thief(30); s = A(s, "equip", {item: "steeldagger"}).state; const r = A(s, "offhand", {item: "steeldagger"}); s = r.state;
  ok("a dagger in each hand: two stabs a round, each a little softer", /each hand/.test(r.msg) && C.playerFighter(s, s.player, {seed: 1}, T0).me.dual === 0.5);
  fight(s, "brownbear"); round(s, 1);
  ok("  (in a fight: two blows from your daggers in one round)", at(s, 1).filter((x) => x.by === "you" && x.w === "Steel dagger").length >= 2, JSON.stringify(at(s, 1)));
  let o = thief(30); o = A(o, "equip", {item: "steeldagger"}).state; o.bag.steeldagger = 1; o = A(o, "offhand", {item: "steelsword"}).state;
  ok("  one dagger and a sword in the off hand: just the one stab (the sword is a spare)", !C.playerFighter(o, o.player, {seed: 1}, T0).me.dual);
  let b = thief(30); b = A(b, "equip", {item: "shortbow"}).state; b = A(b, "equip", {item: "leatherquiver"}).state; b = A(b, "equip", {item: "bronzearrow"}).state;
  const mb = C.playerFighter(b, b.player, {seed: 1}, T0).me, mh = (() => { let h = thief(30, "hunter"); h = A(h, "equip", {item: "shortbow"}).state; h = A(h, "equip", {item: "leatherquiver"}).state; h = A(h, "equip", {item: "bronzearrow"}).state; return C.playerFighter(h, h.player, {seed: 1}, T0).me; })();
  ok("  a Thief with a bow gets the class's way with it too (as a Hunter does)", mb.att === mh.att, [mb.att, mh.att]);
}

console.log("\nPoison\n");
{
  let s = thief(30); s = A(s, "equip", {item: "steeldagger"}).state;
  ok("only a Thief coats a blade (for now)", /Only a Thief/.test(A(thief(30, "berserker"), "coat", {item: "weakpoison"}).error));
  const r = A(s, "coat", {item: "weakpoison"}); s = r.state;
  ok("  coat it from the bag: 20 hits of weak poison", r.ok && s.player.coat.id === "weakpoison" && s.player.coat.left === 20 && s.bag.weakpoison === 2);
  let poisoned = 0, landed = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const t = JSON.parse(JSON.stringify(s)); fight(t, "brownbear", seed); round(t, 1);
    const rs = at(t, 1); landed += rs.filter((x) => x.by === "you" && x.hit > 0).length; if (rs.some((x) => x.by === "fx" && x.kind === "poisoned" && x.on)) poisoned++;
  }
  ok("  a coated hit poisons now and then (about a third)", poisoned > 3 && poisoned < 20, [poisoned, landed]);
  let e = JSON.parse(JSON.stringify(s)); e.player.combat.special = "envenom"; e.player.spec = 100; fight(e, "brownbear", 3);
  e = A(e, "battle", {cmd: "special"}).state; round(e, 1);
  const hitE = at(e, 1).some((x) => x.by === "you" && x.hit > 0);
  ok("  Envenom: your next hit poisons for sure", !hitE || at(e, 1).some((x) => x.by === "fx" && x.kind === "poisoned" && x.on), JSON.stringify(at(e, 1)));
  let k = JSON.parse(JSON.stringify(s)); fight(k, "deer", 3); k = A(k, "battle", {cmd: "tool", item: "throwingknife"}).state; round(k, 1);
  ok("throwing knives are a Thief's Tools: a throw hits", at(k, 1).some((x) => x.by === "you" && x.w === "Throwing knives" && x.hit > 0));
  ok("  (a Hunter doesn't throw them)", /Only a Thief/.test(A((() => { let h = thief(30, "hunter"); fight(h, "deer"); return h; })(), "battle", {cmd: "tool", item: "throwingknife"}).error));
  let m = JSON.parse(JSON.stringify(s)); m.player.combat.special = "smokebomb"; m.player.spec = 100; fight(m, "brownbear", 4);
  m = A(m, "battle", {cmd: "special"}).state; round(m, 1); round(m, 2);
  ok("Smoke bomb: the creature can't find you for 2 rounds", at(m, 1).some((x) => x.by === "them" && x.smoke) && at(m, 2).some((x) => x.by === "them" && x.smoke));
}
{
  let s = thief(50); s.player.classes.thief.xp = C.XP[50];
  for (const n of ["toxic", "toxic", "toxic", "potent", "potent", "lingering", "lingering", "thickcoat", "virulence", "rot", "rot", "rot", "blackblood"]) s = A(s, "talent", {node: n}).state;
  const t = C.talentSum(s.player);
  ok("the Venom branch adds up: likelier, stronger, longer, three at once, Black blood", Math.abs(t.poisonChance - 0.15) < 1e-9 && t.poisonPow === 2 && t.poisonRounds === 2 && t.poisonStack === 2 && t.poisonMult === 0.5, JSON.stringify(t));
  s = A(s, "coat", {item: "weakpoison"}).state;
  ok("  Thick coat: a coating lasts longer", s.player.coat.left === 25);
}

console.log("\nThe screens\n");
ok("poisons have a Coat button in the bag; the Combat tab shows your coating; the fight says when it's lost in the smoke",
   /"Coat your blades"/.test(PET) && /Your blades: <b>/.test(PET) && /can't find you in the smoke/.test(PET) && /You throw a knife/.test(PET));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
