/* ==========================================================================
   NeuroPets battles: balance, auto-eat, and manual fights (2026-10-06).
   ==========================================================================
   Cam: "Can you check over the battle system for me, for example i only had a
   helmet on and i was level 6 and i beat gideon fox ... rectify any battle
   balance issues now. Furthermore battles should have ability to be done
   manual as well as auto."

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
const T0 = 1800000000000;
const combat = (a, d, h) => Math.max(1, Math.floor((a + d) / 2 + h / 4));
const statsFor = (L) => { for (let x = 1; x < 99; x++) { const h = Math.max(10, x); if (combat(x, x, h) >= L) return [x, x, h]; } };
const set = (m, w) => ({helmet: m + "helm", torso: m + "plate", arms: m + "gloves", legs: m + "legs", feet: m + "boots", weapon: w});

/** A made-up player ready to face `ground`'s boss. */
function player({level, gear, food, foodN, ground, retreat = 0.3, manual = false}) {
  let s = C.advance(C.empty(), T0);
  const [a, d, h] = statsFor(level), p = s.player;
  Object.assign(p, {made: true, name: "Tester", cls: null, retreat, combat: {style: "accurate", special: ""}, gear: Object.assign({}, gear || {}),
                    eatBelow: 0.5, food: food || null, at: T0, brews: {}});
  p.skills.attack = C.XP[a]; p.skills.defence = C.XP[d]; p.skills.hitpoints = C.XP[h]; p.skills.ranged = 0;
  p.hp = C.levelOf(p.skills.hitpoints);
  s.bag = s.bag || {};
  if (food) s.bag[food] = foodN;
  s.hunt = s.hunt || {};
  s.hunt[ground] = {kills: 999, wins: 0, losses: 0};
  return s;
}
// Battle Re-work Part 2 (2026-10-15): nothing eats for you mid-fight -- so the player here plays it: below half health,
// they press Eat (as auto-eat used to, one bite a round, costing the attack). o.idle: a player who doesn't (never eats).
function bossWins(o, n = 200) {
  let won = 0;
  for (let i = 0; i < n; i++) {
    const s = player(o), now = T0 + i * 1000;
    const r = C.act(s, "boss", {ground: o.ground, roll: (i * 0.6180339887) % 1}, now);
    if (!r.ok) throw new Error(r.error);
    let st = r.state, t = now;
    for (let k = 0; k < 200 && st.player.battle; k++) {
      t += 2400; st = C.advance(st, t);
      const pl = st.player, b = pl.battle;
      if (!o.idle && b && !b.skip && o.food && (st.bag[o.food] || 0) > 0 && pl.hp < 0.5 * C.levelOf(pl.skills.hitpoints)) {
        const e = C.act(st, "eat", {item: o.food}, t); if (e.ok) st = e.state;
      }
    }
    st = C.advance(st, t + 60000);
    if (st.lastBoss && st.lastBoss.won && !st.player.dead) won++;
  }
  return Math.round(100 * won / n);
}

console.log("\nNeuroPets battles\n");

/* ---- Cam's question: Gideon, at combat 6, a helmet and nothing else ---- */
const helm = {helmet: "bronzehelm"};
const g0 = bossWins({level: 6, gear: helm, ground: "farmyard"});
const g5 = bossWins({level: 6, gear: helm, food: "honeycomb", foodN: 5, ground: "farmyard"});
const g20 = bossWins({level: 6, gear: helm, food: "honeycomb", foodN: 20, ground: "farmyard"});
// (Battle Re-work Part 2: nothing eats for you mid-fight -- you eat between rounds, so a little food helps less than
//  auto-eat's bite-in-the-round did; plenty still carries you)
ok("Gideon at combat 6 with only a helmet: rarely without food, sometimes with some, more often than not with plenty",
  g0 <= 15 && g5 >= 10 && g5 <= 60 && g20 >= 50, `${g0}% / ${g5}% / ${g20}%`);

/* ---- the curve: each boss at its area's entry level, with that tier's gear ---- */
const CURVE = [
  ["pasture", 5, set("bronze", "bronzesword"), "bakedpotato"],
  ["meadow", 10, set("iron", "ironsword"), "roastchicken"],
  ["forest", 18, set("steel", "steelsword"), "steak"],
  ["coast", 22, set("steel", "steelsword"), "lobster"],
  ["deepforest", 28, set("mithril", "mithrilsword"), "swordfish"],
  ["jungle", 40, set("adamant", "adamantsword"), "shark"],
];
for (const [g, L, gear, food] of CURVE) {
  const w5 = bossWins({level: L, gear, food, foodN: 5, ground: g}, 120);
  const w20 = bossWins({level: L, gear, food, foodN: 20, ground: g}, 120);
  const name = C.MONSTERS[C.HUNTS[g].boss].name;
  // hard on arrival (bosses +8% after falls stopped ending the game), never a wall or a walkover
  ok(`${name} (${C.HUNTS[g].name}, level ${L}): challenging, neither a wall nor a walkover`, w5 <= 85 && w20 >= 30, `${w5}% with 5 food, ${w20}% with 20`);
}

/* ---- no auto-heal (Battle Re-work Part 2): a fight left to itself never eats, so a boss needs you ---- */
{
  const s = player({level: 6, gear: helm, food: "honeycomb", foodN: 20, ground: "farmyard"});
  const r = C.act(s, "boss", {ground: "farmyard", roll: 0.3}, T0);
  const st = C.advance(r.state, T0 + 10 * 60000);                          // (inside the gravestone's quarter hour, PT30)
  const rounds = (st.lastBoss || {}).rounds || [];
  ok("left to itself, a fight never eats for you (Cam: \"auto heal should be abolished\")", !rounds.some((x) => x.ate) && (st.bag.honeycomb || 0) + ((st.grave && st.grave.items.honeycomb) || 0) === 20, `ate ${rounds.filter((x) => x.ate).length}`);
  const idle = bossWins({level: 22, gear: set("steel", "steelsword"), food: "lobster", foodN: 20, ground: "coast", idle: true}, 60);
  const played = bossWins({level: 22, gear: set("steel", "steelsword"), food: "lobster", foodN: 20, ground: "coast"}, 60);
  ok("  a boss played (eating when low) is won far more often than one left to itself", played >= idle + 25, `${played}% played, ${idle}% left alone`);
}

/* ---- manual fights ---- */
{
  let s = player({level: 9, gear: helm, food: "honeycomb", foodN: 10, ground: "farmyard"});
  let r = C.act(s, "boss", {ground: "farmyard", roll: 0.5, manual: true}, T0);
  ok("a boss can be challenged in manual", r.ok && r.state.player.battle && r.state.player.battle.manual, r.error || r.msg);
  s = r.state;
  const hp0 = s.player.hp, mhp0 = s.player.battle.mhp;
  s = C.advance(s, T0 + 10 * 60000);
  ok("  it waits for your move: ten minutes on, no round has been fought", s.player.battle && s.player.battle.n === 0 && s.player.battle.mhp === mhp0);
  ok("  and time doesn't heal you while it waits", s.player.hp === hp0);
  const v = C.playerView(s, T0 + 10 * 60000);
  ok("  the game shows it as manual, with no countdown", v.battle && v.battle.manual === true && v.battle.nextIn === 0);
  r = C.act(s, "battle", {cmd: "attack"}, T0 + 10 * 60000 + 1);
  ok("Attack fights one round: your blow, then theirs", r.ok && r.state.player.battle && r.state.player.battle.n === 1
    && r.state.player.battle.rounds.some((x) => x.by === "you") && r.state.player.battle.rounds.some((x) => x.by === "them"));
  s = r.state;
  s.player.hp = 3;
  r = C.act(s, "eat", {item: "honeycomb"}, T0 + 10 * 60000 + 2);
  ok("Eat is your move: you heal, it uses your attack, and they swing",
    r.ok && /You ate/.test(r.msg) && r.state.player.battle.n === 2
    && r.state.player.battle.rounds.slice(-2)[0].ate === true, r.msg);
  s = r.state;
  r = C.act(s, "battle", {cmd: "auto"}, T0 + 10 * 60000 + 3);
  ok("  and auto-eat leaves a manual fight to you (no meal slipped in for your next attack)",
    !r.state.player.battle.rounds.some((x) => x.ate && x.auto));
  ok("switched to Auto, it plays itself from there", r.ok && !r.state.player.battle.manual);
  const st = C.advance(r.state, T0 + 40 * 60000);
  ok("  to the end", !st.player.battle && st.lastBoss && typeof st.lastBoss.won === "boolean");
  {
    let m = player({level: 6, gear: helm, ground: "farmyard", retreat: 0.3});
    m = C.act(m, "boss", {ground: "farmyard", roll: 0.4, manual: true}, T0).state;
    m.player.hp = 1;
    const mv = C.playerView(m, T0 + 1);
    ok("manual: the game warns when one blow could finish you", mv.battle.danger === true);
    const after = C.act(m, "battle", {cmd: "attack"}, T0 + 2);
    ok("  and doesn't run for you -- it's your call (attack, eat or run)",
      after.state.player.battle ? after.state.player.battle.manual : !(after.state.lastBoss && after.state.lastBoss.fled && !after.state.player.dead));
  }
  let h = player({level: 6, gear: helm, ground: "farmyard"});
  h = C.act(h, "boss", {ground: "farmyard", roll: 0.2}, T0).state;
  ok("Attack on an auto fight says to switch to manual first", !C.act(h, "battle", {cmd: "attack"}, T0 + 1).ok);
}

/* ---- a fall costs what you carry, not the game; coins from fights (2026-10-06) ---- */
{
  const s = player({level: 5, gear: helm, ground: "pasture", retreat: 0});
  s.coins = 500; s.bag.copper = 20; s.player.tools = {mining: "bronzepick"};
  const before = JSON.stringify(s.player.skills);
  const r = C.act(s, "boss", {ground: "pasture", roll: 0.9}, T0);
  ok("(Billy the Kid, at combat 5 with a helmet and no food or retreat)", r.ok, r.error);
  // a fall
  const st = C.advance(r.state, T0 + 30 * 60000);
  ok("falling to a boss: you wake at home, hurt, and play on", !st.player.dead && !st.player.battle && st.player.hp > 0 && st.lastFall && st.lastFall.by === "Billy the Kid");
  ok("  everything you carried is gone: bag, coins, armour, tools",
    Object.keys(st.bag).length === 0 && st.coins === 0 && Object.keys(st.player.gear).length === 0 && Object.keys(st.player.tools).length === 0,
    JSON.stringify({bag: st.bag, coins: st.coins, gear: st.player.gear}));
  ok("  what you are stays: skills and levels", JSON.stringify(st.player.skills) === before);
  ok("  and the diary says what went (V16: a gravestone, then it crumbles in Hardcore's quarter hour)", st.log.some((e) => /woke by the fire with nothing\. Everything else is in a gravestone/.test(e.text)) && st.log.some((e) => /gravestone at the Pasture crumbled/.test(e.text)), st.log.slice(0, 3).map((e) => e.text).join(" | "));
}
{
  const hourCoins = (g, L, gear, food) => {
    const s = player({level: L, gear, food, foodN: 400, ground: g});
    s.coins = 0; s.hunt[g].kills = 0;
    const r = C.act(s, "hunt", {ground: g, roll: 0.37}, T0);
    const e = C.advance(r.state, T0 + 10 * 60000), t = e.player.job || e.player.lastTrip || {};   // (ten minutes: inside a gravestone's time if it falls, PT30)
    return (e.coins + ((e.grave && e.grave.coins) || 0)) / Math.max(1, t.count || 0);   // (a fall puts the purse in the grave, PT30)                        // (V16: no eating for you, so a hunt's length varies -- coins a win)
  };
  const farm = hourCoins("farmyard", 20, helm, "honeycomb"), jungle = hourCoins("jungle", 40, set("adamant", "adamantsword"), "shark");
  // (Battle Re-work Part 2: purses lowered so hunting pays ~1.4x gathering, drops included -- the purse is a smaller share)
  ok("creatures drop coins, more the further out (a win: Farmyard vs Jungle)", farm > 0 && jungle > 3 * farm, `${farm} / ${jungle}`);
  const s = player({level: 12, gear: helm, food: "honeycomb", foodN: 40, ground: "farmyard"});
  s.coins = 0;
  const st = C.advance(C.act(s, "boss", {ground: "farmyard", roll: 0.2}, T0).state, T0 + 30 * 60000);
  // the boss's own purse (2026-10-11: after a win you hunt on, and those kills drop coins too)
  ok("a boss drops a purse", st.lastBoss && st.lastBoss.won ? st.lastBoss.got.coins >= 30 && st.lastBoss.got.coins <= 60 + 2 : true, String(st.lastBoss && st.lastBoss.got.coins));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
