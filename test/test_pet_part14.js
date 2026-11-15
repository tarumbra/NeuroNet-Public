/* Battle Re-work Part 14 (2026-10-16): final balance and polish -- the hunt plan's last meal (V3), the three tuned numbers
   (the Thief's iron daggers, the Paladin's True edge), effect chips readable without colour, a small window.
   Run: node test/test_pet_part14.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), CSS = fs.readFileSync(path.join(APP, "ui", "pet", "pet.css"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 16, 8);
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);

console.log("\nThe hunt plan's last meal (V3)\n");
function hunter(food) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  ["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[20]; });
  s.bag.ironsword = 1; s = A(s, "equip", {item: "ironsword"}).state;
  s.bag.tuna = food; s = A(s, "settings", {food: "tuna"}).state;
  return s;
}
{
  // out of food and below the eat line after a fight: home, saying why
  let s = hunter(0); s.player.food = "tuna";
  s = A(s, "hunt", {ground: "forest", roll: 0.3}).state;
  s.player.hp = Math.floor(C.playerView(s, T0).maxHp * 0.3);
  let t = T0; for (; t < T0 + 20 * 60e3 && s.player.job; t += 2400) { s = C.advance(s, t); if (s.player.battle) s.player.battle.mhp = Math.min(s.player.battle.mhp, 1); }
  // V16 + PT30 (2026-10-19): nobody eats or runs for you -- low on health, a hunt left alone fights on, and can fall
  ok("low on health and left alone: no running for you -- it fights on, and here it falls (PT30)", !s.player.job && s.player.lastTrip && s.player.lastTrip.why === "fell" && !!s.lastFall, JSON.stringify(s.player.lastTrip && s.player.lastTrip.why));
  let f = hunter(30); f = A(f, "hunt", {ground: "forest", roll: 0.3}).state; f.player.hp = Math.floor(C.playerView(f, T0).maxHp * 0.3);
  for (let u = T0; u < T0 + 5 * 60e3; u += 2400) { f = C.advance(f, u); if (f.player.battle) f.player.battle.mhp = Math.min(f.player.battle.mhp, 1); }
  ok("  food in the bag doesn't change it: nobody eats it for you", (f.bag.tuna || 0) + ((f.grave && f.grave.items.tuna) || 0) === 30 || !!f.player.job);
  // healthy, without food: hunts on
  let h = hunter(0); h.player.food = "tuna"; h = A(h, "hunt", {ground: "forest", roll: 0.3}).state;
  for (let u = T0; u < T0 + 60e3; u += 2400) { h = C.advance(h, u); if (h.player.battle) h.player.battle.mhp = Math.min(h.player.battle.mhp, 1); h.player.hp = C.playerView(h, u).maxHp; }
  ok("healthy without food: it hunts on (the Combat Designer's condition)", !!h.player.job);
  ok("a trip that ends remembers why (lastTrip.why)", (() => { let x = hunter(5); x = A(x, "hunt", {ground: "farmyard", roll: 0.3}).state; x = A(x, "home").state; return x.player.lastTrip && typeof x.player.lastTrip.why === "string"; })());
}

console.log("\nThe tuned numbers (the class table's outliers)\n");
ok("the Thief's iron daggers: attack 4 (the Thief at level 10 ran 18% over)", C.ITEMS.irondagger.gear.att === 4);
ok("the Paladin's late tree: Valor +12% a rank, Avenger +50% (at 50 with its tree it ran 17% under; True edge stays +1, so the low levels don't move)", (() => { const ns = C.TALENTS.paladin.branches.flatMap((b) => b.nodes), f = (id) => ns.find((x) => x.id === id);
  return f("valor").fx.openerDmg === 0.12 && f("avenger").fx.avenge === 0.5 && f("edge").fx.maxHit === 1 && /12%/.test(f("valor").about) && /50%/.test(f("avenger").about); })());

console.log("\nReadable, and in a small window\n");
ok("effect chips: a shape and a number, and a label a screen reader reads", /class="pp-fx-chip" role="img" aria-label="/.test(PET) && Object.values(C.EFFECTS).filter((e) => e && e.icon).every((e) => e.icon && e.name));
ok("every effect has its own shape (no two the same)", (() => { const ic = Object.values(C.EFFECTS).filter((e) => e && e.icon).map((e) => e.icon); return new Set(ic).size === ic.length; })());
ok("a narrow window: the title can't hide under the chips", /@media \(max-width: 900px\)[\s\S]*\.np-top-title h1 \{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/.test(CSS));
ok("a short window: the fight scene gives up height so its buttons show", /@media \(max-height: 680px\) \{ \.pp-arena \{ height: 210px; \} \}/.test(CSS));

console.log("\nThe pieces filled in after the audit\n");
{
  const T1 = Date.UTC(2026, 9, 16, 8);
  let s = A(C.advance(C.empty(), T1), "player", {name: "Y"}).state; s.story = {on: false}; s.coins = 50000; s.player.skills.construction = C.XP[40]; Object.assign(s.bag, {plank: 100, rope: 20});
  const bst = (id, lv) => ({id, name: id, species: "wolf", colour: "grey", born: T1, hatchAt: T1, joined: T1, xp: C.XP[lv], stat: {}, train: "", trainAt: T1, fedUntil: 0, restUntil: 0, wins: 0, faints: 0});
  s.beasts = [bst("A", 10), bst("B", 12)];
  ok("the Pen's sparring needs the ring", /sparring ring/.test(A(s, "penspar", {a: "A", b: "B"}).error));
  const before = C.PEN_YARD && C.PetCore ? 0 : 0; void before;
  s = A(s, "penbuild", {what: "dummy"}).state;
  ok("the training dummy: built once (Construction 25, coins, planks and rope)", s.pen.yard.dummy && s.coins === 44000 && s.bag.plank === 80 && !!A(s, "penbuild", {what: "dummy"}).error);
  s = A(s, "penbuild", {what: "ring"}).state;
  const x0 = s.beasts[0].xp, r = A(s, "penspar", {a: "A", b: "B"});
  ok("sparring: both pets gain a little battle xp, nobody's hurt", !r.error && r.state.beasts[0].xp > x0 && /nobody gets hurt/.test(r.msg), r.error);
  ok("  once every 4 hours a pet", /again in/.test(A(r.state, "penspar", {a: "A", b: "B"}).error || ""));
  const capped = bst("C", 30); r.state.beasts.push(capped, bst("D", 30));
  const r2 = A(r.state, "penspar", {a: "C", b: "D"});
  ok("  never past the Pen's training cap (30)", !r2.error && C.levelOf(r2.state.beasts.find((b) => b.id === "C").xp) <= 30);
  const nec = C.NECRO.raisedBy;
  ok("a raised pet says it in its kind's own way (six lines, one a type)", ["beast", "bird", "water", "reptile", "bug", "spirit"].every((k) => nec[k] && nec[k].length > 20));
  ok("the Hell mode says only a Necromancer can bring a lost pet back", /only a Necromancer can bring one back/.test(C.MODES.hell.about));
  ok("the risen look ghostly wherever their picture shows (the Graveyard, the Pen): Cam's painted spirit, or the tint", /function risenPicHTML/.test(PET) && (PET.match(/risenPicHTML\(/g) || []).length >= 3 && PET.includes("art/pets/spectral/"));
}

console.log("\nTalent ids\n");
{
  const ids = {}; Object.keys(C.TALENTS).filter((c) => c !== "//").forEach((c) => C.TALENTS[c].branches.forEach((b) => b.nodes.forEach((n) => (ids[n.id] = ids[n.id] || []).push(c))));
  const dup = Object.keys(ids).filter((k) => ids[k].length > 1);
  ok("every talent's id is its own (two classes sharing one broke the Hunter's Thick hide and the Paladin's Shield wall)", !dup.length, dup.join());
  const h = A(A(C.advance(C.empty(), T0), "player", {name: "H"}).state, "class", {cls: "hunter"}).state; h.player.classes.hunter.xp = C.XP[20];
  ok("  a Hunter can take Thick hide again", !C.talentLock(h.player, "thickhide"), C.talentLock(h.player, "thickhide"));
  const old = {v: 16, player: {made: true, name: "B", cls: "beastmaster", classes: {beastmaster: {xp: C.XP[20], talents: {thickhide: 2, shieldwall: 1}, builds: {}, respecs: 0}}, skills: {}}, pet: null, log: []};
  const n = C.normal(old).player.classes.beastmaster.talents;
  ok("  an old save's Beast Master keeps the points it spent (moved to the new ids)", n.bmthickhide === 2 && n.bmshieldwall === 1 && !n.thickhide && !n.shieldwall, JSON.stringify(n));
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
