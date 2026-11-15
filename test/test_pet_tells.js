/* Creature tells (2026-10-16, approved in note 13, built after Part 14): a boss winds up every few rounds and says what's
   coming; held, in smoke or against Aegis the move breaks (and it staggers), otherwise the blow lands harder -- by the
   boss's level, half the extra if you fight Defensively. Pack fights too. Run: node test/test_pet_tells.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 16, 8);
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
const T = C.BOSS_TELLS;

ok("every boss has a tell -- but the duelling mages and Gideon, the very first (no answers yet at combat 6)", Object.keys(C.MONSTERS).filter((m) => C.MONSTERS[m].boss && !C.MONSTERS[m].mage && m !== "gideon").every((m) => T.list[m] && T.list[m].move && T.list[m].wind) && !T.list.gideon,
   Object.keys(C.MONSTERS).filter((m) => C.MONSTERS[m].boss && !C.MONSTERS[m].mage && !T.list[m]).join());
ok("  and no ordinary creature has one", Object.keys(T.list).every((m) => C.MONSTERS[m] && C.MONSTERS[m].boss));

// a hand-made boss battle, to drive the tell step directly
const log = [], L = (o) => log.push(o);
function bossFight(mon, ground, extra) {
  const s = A(C.advance(C.empty(), T0), "player", {name: "T"}).state;
  return {s, b: Object.assign({mon, ground, n: 0, fx: null, rounds: [], me: {style: "accurate"}, seed: 7}, extra || {})};
}
{
  const {s, b} = bossFight("bambi", "forest");
  const seen = [];
  for (let n = 1; n <= 6; n++) { b.n = n; seen.push(C.bossTell(s, s.player, b, T0, L) || "-"); if (b.tellHit) b.tellHit = null; }
  ok("it winds up every 5th round, and the round after is the big blow", seen.join() === "-,-,-,-,wind,strike", seen.join());
  ok("  the wind-up says what's coming, in the boss's words", log.some((x) => x.tell === "Stampede" && /rears up/.test(x.wind)));
}
{
  const {s, b} = bossFight("basilisk", "jungle", {n: 5});
  C.bossTell(s, s.player, b, T0, L);
  b.n = 6; b.fx = {them: [{kind: "netted", rounds: 2}], you: []};
  const r = C.bossTell(s, s.player, b, T0, L);
  ok("netted when it comes: the move breaks, and it staggers", r === "broken" && log.some((x) => x.tellBroken === "Burrowing strike") && b.fx.them.some((e) => e.kind === "stunned"), r + " " + JSON.stringify(b.fx));
}
{
  const {s, b} = bossFight("grizz", "deepforest", {n: 5}); C.bossTell(s, s.player, b, T0, L); b.n = 6; b.smoke = 1;
  ok("in a Thief's smoke: broken", C.bossTell(s, s.player, b, T0, L) === "broken");
  const x = bossFight("grizz", "deepforest", {n: 5}); C.bossTell(x.s, x.s.player, x.b, T0, L); x.b.n = 6; x.b.aegis = 1;
  ok("against a raised shield (Aegis): broken", C.bossTell(x.s, x.s.player, x.b, T0, L) === "broken");
}
{
  // the blow's size by the boss's level, and Defensive halves the extra
  const mult = (ground, style) => { const {s, b} = bossFight("x", ground); b.tellHit = "X"; b.me.style = style || "accurate"; return C.tellMult(b); };
  ok("the big blow: 1.3x for the first bosses, 1.6x to level 39, 2.5x from 40 (the boss balance test's bands hold)", mult("pasture") === 1.3 && mult("forest") === 1.6 && mult("jungle") === 2.5 && mult("nile") === 2.5);
  ok("  fighting Defensively braces you: half the extra (2.5 -> 1.75)", mult("jungle", "defensive") === 1.75);
}
{
  const {s, b} = bossFight("archmagemage", "magetower", {n: 5, duel: 5});
  ok("a mage duel has no tell", C.bossTell(s, s.player, b, T0, L) === "");
  const h = bossFight("wolf", "deepforest", {n: 5});
  ok("an ordinary creature never tells", C.bossTell(h.s, h.s.player, h.b, T0, L) === "");
}
{
  // a real boss fight: tells happen, and the fight still ends
  let s = A(C.advance(C.empty(), T0), "player", {name: "T"}).state; s.story = {on: false};
  ["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[22]; });
  s.player.hp = C.playerView(s, T0).maxHp; s.bag.steelsword = 1; s = A(s, "equip", {item: "steelsword"}).state; s.player.retreat = 0;
  s.hunt = {forest: {kills: 999, wins: 0, losses: 0}};
  s = A(s, "boss", {ground: "forest", roll: 0.4}).state;
  for (let t = T0; t < T0 + 20 * 60e3 && s.player.battle; t += 2400) { s = C.advance(s, t); s.player.hp = Math.max(s.player.hp, 15); }
  ok("in a real fight Bambi tells, and the fight ends", !s.player.battle && (s.lastBoss.rounds || []).some((x) => x.tell === "Stampede"), JSON.stringify((s.lastBoss || {}).rounds && s.lastBoss.rounds.slice(0, 2)));
}

console.log("\nThe screens\n");
ok("the boss's card shows what's coming, with a pulsing warning (still with reduced motion: no pulse)", PET.includes("pp-fx-chip pp-tell") && fs.readFileSync(path.join(APP, "ui", "pet", "pet.css"), "utf8").includes("@media (prefers-reduced-motion: reduce) { .pp-fx-chip.pp-tell { animation: none; } }"));
ok("the fight says it winds up, that it broke, and the big blow", PET.includes("is coming!") && PET.includes("breaks</b>") && PET.includes("hits you for <b>"));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
