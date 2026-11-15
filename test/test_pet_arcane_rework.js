/* Battle Re-work Part 6 (2026-10-15): the Arcane -- each spell's element and its effect, elemental weaknesses, battle staves
   (a real bash with your Magic; elemental and enchanted ones), the Elements branch and the 4th spell slot.
   Run: node test/test_pet_arcane_rework.js [app dir] */
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
function mage(lv, weapon) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  ["magic", "defence", "hitpoints", "attack"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, T0).maxHp;
  Object.assign(s.bag, {yewbattlestaff: 1, firebattlestaff: 1, enchantedburningstaff: 1, yewwand: 1, steelsword: 1, firerune: 900, airrune: 900, mindrune: 900, chaosrune: 900, waterrune: 900, earthrune: 900});
  s = A(s, "class", {cls: "arcane"}).state;
  if (weapon) s = A(s, "equip", {item: weapon}).state;
  return s;
}
function fight(s, mon, seed) {
  s.player.job = {hunt: "deepforest", seed: seed || 5, count: 0, kills: {}, items: {}, xp: 0, since: T0, next: T0, until: T0 + 3600e3};
  C.startBattle(s, s.player, "hunt", "deepforest", mon, T0, s.player.job);
}
const round = (s, i) => C.battleRound(s, s.player, s.player.battle, T0 + 2400 * i);
const at = (s, i) => s.player.battle.rounds.filter((x) => x.t === T0 + 2400 * i);

console.log("\nThe elements\n");
ok("every spell has an element: Fire strike fire, Frost nova water, Bind earth, Storm air", C.SPELLS.firestrike.element === "fire" && C.SPELLS.frostnova.element === "water"
   && C.SPELLS.bind.element === "earth" && C.SPELLS.storm.element === "air" && Object.keys(C.SPELLS).filter((k) => C.SPELLS[k].gate === undefined).every((k) => C.SPELLS[k].element));   // (Necromancy's spells have none -- Part 13)
ok("  fire burns, water slows, earth breaks the guard, air knocks it off balance (a new effect: its blows land less often)",
   C.ELEMENTS.fire.fx === "burning" && C.ELEMENTS.water.fx === "slowed" && C.ELEMENTS.earth.fx === "brokenguard" && C.ELEMENTS.air.fx === "offbalance" && C.EFFECTS.offbalance.accMult === 0.8);
ok("  creatures are weak or resistant: spiders and the cold fear fire, the desert water; crabs shrug water off",
   C.elementMult("giantspider", "fire") === 1.3 && C.elementMult("yeti", "fire") === 1.3 && C.elementMult("camel", "water") === 1.3 && C.elementMult("crab", "water") === 0.75 && C.elementMult("deer", "fire") === 1);
{
  let hits = 0, burns = 0;
  for (let seed = 1; seed <= 40; seed++) {
    let s = mage(30, "yewwand"); s.player.loadout = ["firestrike"]; fight(s, "brownbear", seed); round(s, 1);
    const r = at(s, 1); if (r.some((x) => x.by === "you" && x.hit > 0 && x.w === "Fire strike")) hits++;
    if (r.some((x) => x.by === "fx" && x.kind === "burning" && x.on)) burns++;
  }
  ok("a fire spell that lands sets it burning now and then (about 3 times in 10)", burns > 0 && burns / Math.max(1, hits) > 0.12 && burns / Math.max(1, hits) < 0.55, [burns, hits]);
}
{
  let s = mage(30, "yewwand"); s.player.loadout = ["firestrike"]; fight(s, "brownbear");
  s.player.battle.fx = {them: [{kind: "offbalance", rounds: 3, power: 0}], you: []};
  const pv = C.playerView(s, T0);
  ok("  the Cast menu shows each spell's element, and whether this creature is weak to it", pv.battle.spells[0].element === "fire" && pv.battle.spells[0].weak === C.elementMult("brownbear", "fire") && pv.battle.spells[0].weak > 1 && /x\.weak > 1 \? "⚡"/.test(PET));   // (V6: bears fear fire now)
}

console.log("\nBattle staves\n");
{
  const R = C.WORKSHOPS.altar.recipes, E = C.WORKSHOPS.enchanting.recipes;
  ok("battle staves of oak, maple, yew and magic wood, and air, water, earth and fire ones, at the altar; enchanted ones at the enchanting table",
     ["oak", "maple", "yew", "magic", "air", "water", "earth", "fire"].every((k) => R.some((r) => r.make === k + "battlestaff")) && ["enchantedstormstaff", "enchantedfroststaff", "enchanteddrainstaff", "enchantedburningstaff"].every((k) => E.some((r) => r.make === k)));
  ok("  an elemental staff gives its runes free and makes its element likelier; an enchanted one more besides",
     C.ITEMS.firebattlestaff.gear.element === "fire" && C.ITEMS.firebattlestaff.gear.elemBoost === 0.1 && C.ITEMS.enchantedburningstaff.gear.burnPow === 2 && C.ITEMS.enchanteddrainstaff.gear.drain === 0.1);
  let s = mage(30, "steelsword"); s = A(s, "offhand", {item: "steelsword"}).state;
  ok("  two-handed: nothing in the off hand with one", A(mage(30, "yewbattlestaff"), "offhand", {item: "steelsword"}).error && /both hands/.test(A(mage(30, "yewbattlestaff"), "offhand", {item: "steelsword"}).error));
}
{
  let s = mage(30, "yewbattlestaff"); s.player.loadout = ["firestrike"]; s.bag.firerune = 0; fight(s, "brownbear");
  const me = s.player.battle.me;
  let t = mage(30, "yewwand"); t.player.loadout = ["firestrike"]; t.bag.firerune = 0; fight(t, "brownbear");
  ok("out of runes, a battle staff is a real blow -- swung with your Magic (a wand's bash is 1)", me.magic.bash >= 2 + Math.floor((30 + 16) / 4) && t.player.battle.me.magic.bash === 1 && me.magic.bashName === "Yew battle staff", [me.magic.bash, t.player.battle.me.magic.bash]);
  round(s, 1);
  ok("  and the fight says so", at(s, 1).some((x) => x.by === "you" && x.w === "Yew battle staff"), JSON.stringify(at(s, 1)));
}

console.log("\nThe tree\n");
{
  const br = C.TALENTS.arcane.branches.find((b) => b.id === "elements");
  ok("the Elements branch is in: eight nodes, Overwhelm or Spellweaver, Avatar of the elements at the bottom -- every class's tree is whole now",
     !br.later && br.nodes.length === 8 && br.nodes.find((n) => n.keystone).id === "avatar" && Object.keys(C.TALENTS).filter((k) => k !== "//").every((c) => C.TALENTS[c].branches.every((b) => !b.later)));
  let s = mage(30, "yewwand"); s.player.classes.arcane.xp = C.XP[30];
  ok("  three spells loaded as before", C.loadoutMax(s.player) === 3);
  for (const n of ["runethrift", "runethrift", "runethrift", "focus", "focus", "wellspring", "fourthsigil"]) s = A(s, "talent", {node: n}).state;
  ok("  Fourth sigil (Arcana, instead of Potency): a 4th spell", C.loadoutMax(s.player) === 4 && C.spellbookView(s).max === 4);
  s = A(s, "loadout", {spells: ["windstrike", "waterstrike", "earthstrike", "firestrike"]}).state;
  ok("  ...and the spellbook takes four", (s.player.loadout || []).length === 4, JSON.stringify(s.player.loadout));
  s.coins = 10000; const r = A(s, "respec");
  ok("  respec it away and the 4th waits (only three are cast)", r.ok && C.loadoutMax(r.state.player) === 3 && C.spellbookView(r.state).loadout.length === 3);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
