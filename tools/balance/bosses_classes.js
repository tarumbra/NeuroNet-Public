// Boss wins by CLASS and level (audit CMB-3, 2026-10-19): the old bosses.js plays a Berserker in metal armour, which
// predates classes, talents and the islands. This borrows classes.js's kit for each class (weapon, armour, food, the
// class's own set-up) and fights each boss 8 times per level step -- the islands' bosses too (core.js sails there).
//     node tools/balance/bosses_classes.js [seeds=8] [only=jungle,desert]
const C = require("./core.js"), {T0} = require("./hunt.js"), {setUp} = require("./classes.js");
const SEEDS = +(process.argv[2] || 8), ONLY = (process.argv.slice(2).find((a) => a.startsWith("only=")) || "").slice(5).split(",").filter(Boolean);
const CLASSES = ["hunter", "berserker", "arcane", "thief", "paladin", "beastmaster", "necromancer"];
// "sets": the previous armour set a player would have by then (C7: the Basilisk with Grizzly; the later bosses with Gorgon)
const SETS = process.argv.includes("sets"), EAT = !process.argv.includes("noeat");
const ARMOUR = {grizzly: ["grizzlyhelm", "grizzlyplate", "grizzlygauntlets", "grizzlygreaves", "grizzlyboots"], gorgon: ["gorgonhelm", "gorgonplate", "gorgongauntlets", "gorgongreaves", "gorgonboots"]};
const SET_FOR = {jungle: "grizzly", hollowcrypt: "gorgon", frostpeak: "gorgon", desert: "gorgon", nile: "gorgon"};
function fight(cls, L, g, seed) {
  let s; try { s = setUp(cls, L); } catch (e) { return {err: e.message}; }
  if (SETS && SET_FOR[g]) ARMOUR[SET_FOR[g]].forEach((k) => { s.bag[k] = 1; const r = C.act(s, "equip", {item: k}, T0); if (r.ok) s = r.state; });
  const PACK = +((process.argv.find((a) => a.startsWith("pack=")) || "pack=1").slice(5));   // a Beast Master's pack of n (copies of its pet)
  if (cls === "beastmaster" && PACK > 1 && s.beasts && s.beasts[0]) { const b0 = s.beasts[0]; s.beasts = Array.from({length: PACK}, (_, i) => Object.assign({}, b0, {id: "simpet" + i, name: "Sim " + (i + 1)})); s.player.combat.pack = s.beasts.map((b) => b.id); }
  const WPN = (process.argv.find((a) => a.startsWith("weapon=")) || "").slice(7);   // a weapon for the boss's weakness (C7: the fang spear's pierce for the King of the Nile)
  if (WPN && cls === "berserker") { s.bag[WPN] = 1; const r = C.act(s, "equip", {item: WPN}, T0); if (r.ok) s = r.state; }
  if (EAT) { const f = Object.keys(s.bag).filter((k) => C.ITEMS[k] && C.ITEMS[k].heal && !C.ITEMS[k].potion).sort((a, b) => C.ITEMS[b].heal - C.ITEMS[a].heal)[0]; if (f) s.player.quick = [f]; }
  s.hunt = s.hunt || {}; s.hunt[g] = {kills: 99999, wins: 0, losses: 0};
  if (g === "frostpeak") s.bag.climbinggear = 1;                      // (the Yeti is at the Summit: a climbing kit)
  s.player.hp = C.playerView(s, T0).maxHp;
  const r = C.act(s, "boss", {ground: g, roll: seed}, T0); if (!r.ok) return {err: r.error};
  // V16: nobody eats for you -- an attentive player eats from quick slot 1 below half health
  let st = r.state;
  for (let t = T0 + 2400; t <= T0 + 30 * 60e3 && st.player.battle; t += 2400) {
    st = C.advance(st, t);
    if (EAT && st.player.battle && st.player.hp < 0.5 * C.playerView(st, t).maxHp) { const q = C.act(st, "quick", {op: "use", i: 0}, t); if (q.ok) st = q.state; }
  }
  const lb = st.lastBoss || {};
  return {won: !!lb.won};
}
const rows = [];
for (const g of C.HUNT_ORDER.filter((x) => !ONLY.length || ONLY.includes(x))) {
  const H = C.HUNTS[g], AT = process.argv.find((a) => a === "at+10"), L0 = AT ? Math.min(60, H.level + 10) : Math.max(10, Math.ceil(H.level / 5) * 5);
  for (const cls of CLASSES) {
    const out = [];
    for (let L = L0; L <= (AT ? L0 : 50); L += 5) {
      if (cls === "necromancer" && L < 50) continue;
      let w = 0, err = "";
      for (let i = 0; i < SEEDS; i++) { const r = fight(cls, L, g, 0.05 + i * 0.113); if (r.err) { err = r.err; break; } if (r.won) w++; }
      if (err) { out.push(`lv${L}: ${err.slice(0, 40)}`); break; }
      out.push(`lv${L}:${w}/${SEEDS}`); rows.push([g, H.boss, cls, L, w / SEEDS].join(","));
      if (w === SEEDS) break;
    }
    console.log(g.padEnd(11), String(H.boss).padEnd(9), cls.padEnd(12), out.join("  "));
  }
}
require("fs").writeFileSync(require("path").join(__dirname, "bosses_classes.csv"), "ground,boss,class,level,win_rate\n" + rows.join("\n") + "\n");
console.log("Wrote tools/balance/bosses_classes.csv");
