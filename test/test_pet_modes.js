/* ==========================================================================
   NeuroPets: game modes and New Game Plus (2026-10-07).
   ==========================================================================
   Cam: "3 different game modes, adventure (you drop only coins on death, pets
   never die), hardcore (Lose everything on death, pets can die), Hell (Player
   can die, Pets can die, have to start again). Also a new game plus mode
   which gets unlocked when you beat the last boss, you start with boosted
   stats and 3 of your choosen pets."

   Runs the game's own rules (ui/pet/petcore.js) on made-up players -- never
   the real save.
   ========================================================================== */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const T0 = 1800000000000, MIN = 60000;
function game(mode) {
  const s = C.advance(C.newGame({mode}, T0), T0);
  s.player.made = true; s.player.name = "Tester";
  return s;
}
// a sure fall: a level-1 player, no retreat, against Gideon
function fall(s) {
  s.player.retreat = 0; s.hunt = {farmyard: {kills: 60, wins: 0, losses: 0}};
  s.bag.copper = 5; s.coins = 300; s.player.gear = {helmet: "bronzehelm"}; s.bag.bronzehelm = 1;
  const r = C.act(s, "boss", {ground: "farmyard", roll: 0.9}, T0);
  return C.advance(r.state, T0 + 30 * MIN);
}

console.log("\nNeuroPets: game modes\n");

ok("three modes: Adventure, Hardcore, Hell", Object.keys(C.MODES).join() === "adventure,hardcore,hell");
ok("a game that's already going is Hardcore (how it has always played)", C.modeOf(C.advance(C.empty(), T0)) === "hardcore");

// V16 (2026-10-19): Adventure keeps the 3 most valuable things you carry; the rest (coins too) waits in a gravestone
const fallAt = (st) => { st.player.retreat = 0; st.hunt = {farmyard: {kills: 60, wins: 0, losses: 0}}; st.bag.copper = 5; st.coins = 300; st.player.gear = {helmet: "bronzehelm"}; st.bag.bronzehelm = 1;
  const r = C.act(st, "boss", {ground: "farmyard", roll: 0.9}, T0); return C.advance(r.state, T0 + 10 * MIN); };
const a = fallAt(game("adventure"));
ok("Adventure (V16): you wake holding the 3 most valuable things you carried -- the helmet you wore first", a.bag.bronzehelm === 1 && a.player.gear.helmet === "bronzehelm" && Object.values(a.lastFall.kept).reduce((x, y) => x + y, 0) === 3 && a.coins === 0 && !a.player.dead,
  JSON.stringify({c: a.coins, kept: a.lastFall.kept, g: a.player.gear}));
ok("  the rest is in a gravestone at the Farmyard, the 300 coins with it", a.grave && a.grave.where === "Farmyard" && a.grave.coins === 300 && Object.keys(a.grave.items).length > 0, JSON.stringify(a.grave));
const h = fallAt(game("hardcore"));
ok("Hardcore: a fall keeps nothing you carry (it's in the gravestone)", h.coins === 0 && !h.bag.copper && !h.player.gear.helmet && !h.player.dead && h.grave && h.grave.items.bronzehelm === 1);
const x = fall(game("hell"));
ok("Hell: you die -- the game is over", !!x.player.dead && /In Hell, that's the end/.test(x.log.map((e) => e.text).join(" ")));
ok("  nothing more can be done", !C.act(x, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.2}, T0 + 31 * MIN).ok);
const re = C.act(x, "restart", {}, T0 + 32 * MIN);
ok("  start again: a fresh game, still Hell", re.ok && !re.state.player.dead && re.state.mode === "hell" && !re.state.player.made);
ok("  and an old save's 'dead' isn't undone in Hell", C.advance(x, T0 + 40 * MIN).player.dead);

// pets: never die in Adventure
{
  const deadly = Object.keys(C.RUNS).filter((k) => C.RUNS[k].deadly);
  const src = fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8");
  ok("pets never die in Adventure (a deadly fall is an injury instead)", deadly.length > 0 && /R\.deadly && rnd\(job\) < R\.deadly && modeOf\(s\) !== "adventure"/.test(src));
}

/* ---- New Game Plus ---- */
{
  const done = game("hardcore");
  ok("New Game Plus isn't unlocked before the Basilisk", !C.ngUnlocked(done));
  done.hunt = {jungle: {kills: 0, wins: 1, losses: 0}};
  ok("  beat the Basilisk and it is", C.ngUnlocked(done));
  // three pets to bring
  let d = C.act(done, "hatch", {egg: "starter", roll: 0.4}, T0).state;
  d = C.advance(d, T0 + 10 * MIN);
  d.den = [JSON.parse(JSON.stringify(d.pet)), JSON.parse(JSON.stringify(d.pet)), JSON.parse(JSON.stringify(d.pet))];
  d.den.forEach((p, i) => { p.id = "den" + i; p.name = "Den " + i; p.xp = 5000; });
  const ng = C.newGame({mode: "adventure", from: d, pets: [d.pet.id, "den0", "den1"]}, T0 + 11 * MIN);
  ok("a New Game Plus: boosted -- every skill at 5, the fighting ones at 15, 2,000 coins", ng.ngPlus === 1 && C.levelOf(ng.player.skills.attack) === 15
    && C.levelOf(ng.player.skills.foraging) === 5 && ng.coins >= 2000);
  ok("  with the three pets you chose (levels kept)", ng.pet && ng.den.length === 2 && ng.den.every((p) => p.xp === 5000) && !ng.player.made);
  ok("  in the mode you chose", ng.mode === "adventure");
  const ng2 = C.newGame({mode: "hell", from: Object.assign(JSON.parse(JSON.stringify(ng)), {hunt: {jungle: {kills: 0, wins: 1, losses: 0}}}), pets: []}, T0);
  ok("  and again: New Game Plus 2", ng2.ngPlus === 2);
  // the monsters are tougher
  const t = Object.assign(game("hardcore"), {ngPlus: 2}); t.player.made = true;
  const r = C.act(t, "hunt", {ground: "farmyard", roll: 0.3}, T0);
  const st = C.advance(r.state, T0 + 1500);
  ok("  each cycle, the monsters are tougher (+20% health a cycle)", st.player.battle && st.player.battle.mhp === Math.round(C.MONSTERS[st.player.battle.mon].hp * 1.4),
    JSON.stringify(st.player.battle && [st.player.battle.mhp, st.player.battle.mon]));
  const plain = C.newGame({mode: "hardcore", from: game("hardcore")}, T0);
  ok("a plain new game, if the game you chose hasn't beaten the Basilisk", !plain.ngPlus && C.levelOf(plain.player.skills.attack) === 1);
}

/* ---- the save slot card ---- */
{
  const s = game("hell"); s.ngPlus = 1;
  const sum = C.slotSummary(s, T0);
  ok("a slot's card: name, mode, levels, pets", sum.name === "Tester" && sum.modeName === "Hell" && sum.ngPlus === 1 && typeof sum.combat === "number" && Array.isArray(sum.pets));
  ok("  an empty or unstarted slot has none", C.slotSummary(null, T0) === null && C.slotSummary(C.newGame({mode: "hell"}, T0), T0) === null);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
