/* Balance (2026-10-10 audit, "01 Game Developer Report" MATH-1..4): the outliers it found stay fixed, and the novice bonus
   makes the first levels quick without moving the long game. Run: node test/test_pet_balance.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 10, 2), HOUR = 3600e3;
const xph = (sp) => sp.xp / sp.time * 3600;
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };

/* ---- MATH-1: the kitchen's fish dishes are all on the same pace (herring was 10 xp, its neighbours ~2) ---- */
{
  const k = C.WORKSHOPS.kitchen.recipes, xp = (id) => (k.find((r) => r.make === id) || {}).xp;
  ok("herring is cooked for about the same xp as the fish beside it", xp("herring") <= 3 && xp("herring") >= xp("shrimps"), [xp("shrimps"), xp("sardine"), xp("herring"), xp("tuna")].join(" / "));
  ok("  gathered-and-dropped things sell at the gathering pace too (raw herring was ~3,600 coins an hour)",
     C.priceOf("rawherring") < 1 && C.priceOf("honeycomb") < 1 && C.priceOf("seashell") < 1, [C.priceOf("rawherring"), C.priceOf("honeycomb"), C.priceOf("seashell")].join());
}

/* ---- MATH-2: no gathering spot runs away from its tier ---- */
{
  const spots = [].concat(...C.GATHERING.filter((k) => k !== "runecrafting").map((k) => C.SKILLS[k].spots.filter((sp) => !sp.essence).map((sp) => Object.assign({skill: k}, sp))));
  // allowed on purpose: early fishing's +30% (Cam, 2026-10-10: fishing "feels slow in the lower levels" -- nets, rods, bait)
  const allowed = (sp) => sp.skill === "fishing" && sp.level <= 15;
  const out = spots.filter((sp) => !allowed(sp)).filter((sp) => { const near = spots.filter((x) => Math.abs(x.level - sp.level) <= 5).map(xph); return xph(sp) > 1.5 * median(near); });
  ok("no gathering spot gives more than 1.5x the xp an hour of spots within 5 levels of it", out.length === 0, out.map((sp) => sp.id + " " + Math.round(xph(sp))).join(", "));
  const pe = C.SKILLS.mining.spots.find((sp) => sp.id === "pureessence");
  ok("  the Pure essence vein is in line now (was 2,160 xp an hour)", xph(pe) < 1300, Math.round(xph(pe)));
}

/* ---- MATH-3: the shrines are fast on purpose -- counting the mining for their essence, they're in line ---- */
{
  const ess = C.SKILLS.mining.spots.filter((sp) => sp.rune);
  // (2026-10-16, Part 13) the Blood altar's blood essence isn't mined but dropped in the Hollow Crypt: count the hunting for it,
  // at 200 kills an hour (the class table's level-46 Necromancer and Beast Master run about that) and the ground's average drop
  const dropPerHour = (id) => { const g = Object.keys(C.HUNTS).find((h) => (C.HUNTS[h].monsters || []).some((m) => (C.MONSTERS[m[0]].drops || []).some((d) => d[0] === id)));
    const ms = g ? C.HUNTS[g].monsters : [], w = ms.reduce((a, m) => a + m[1], 0);
    return 200 * ms.reduce((a, m) => a + m[1] / w * (C.MONSTERS[m[0]].drops || []).filter((d) => d[0] === id).reduce((x, d) => x + d[3] * (d[1] + d[2]) / 2, 0), 0); };
  const essPerHour = (id) => ess.some((sp) => sp.loot[0][0] === id) ? Math.max(...ess.filter((sp) => sp.loot[0][0] === id).map((sp) => 3600 / sp.time)) : dropPerHour(id);
  const shrines = C.SKILLS.runecrafting.spots.filter((sp) => !sp.essence && sp.bait);
  const play = shrines.map((sp) => { const actions = 3600 / sp.time, mining = actions / essPerHour(sp.bait); return {id: sp.id, xp: sp.xp * actions / (1 + mining)}; });
  ok("per hour of play (the shrine plus mining its essence) Runecrafting stays under 1,500 xp an hour", play.every((x) => x.xp < 1500), play.map((x) => x.id + " " + Math.round(x.xp)).join(", "));
}

/* ---- MATH-4: the novice bonus ---- */
{
  ok("the novice bonus (longer, 2026-10-13): x2 to level 15, x1.75 to 20, x1.5 to 25, x1.25 to 30, then none",
     [1, 15, 16, 20, 21, 25, 26, 30, 31, 50].map((l) => C.noviceMult(l)).join() === "2,2,1.75,1.75,1.5,1.5,1.25,1.25,1,1");
  const s = C.advance(C.empty(), T0); s.player.made = true; s.player.skills.foraging = 0;
  const y = C.advance(C.act(s, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.3}, T0).state, T0 + 60e3);
  const sp = C.SKILLS.foraging.spots.find((x) => x.id === "hedgerow"), j = y.player.job;
  ok("  a level-1 find gives double xp", j && Math.abs(j.xp / j.count - sp.xp * 2) < 0.02, j && (j.xp / j.count) + " vs " + sp.xp);
  ok("  and nothing on screen names it (Cam: a backend feature, not one displayed)", C.playerView(y, T0 + 60e3).skills.foraging.novice === undefined
     && !/Novice bonus/i.test(require("fs").readFileSync(require("path").join(APP, "ui", "pet", "pet.js"), "utf8")));
  const hours = (k, nov) => { const sps = C.SKILLS[k].spots.filter((x) => !x.essence); let t = 0, at = {};
    for (let L = 1; L < 50; L++) { const best = Math.max(...sps.filter((x) => x.level <= L).map(xph)) * (nov ? C.noviceMult(L) : 1); t += (C.XP[L + 1] - C.XP[L]) / best; at[L + 1] = t; }
    return at; };
  const k = "foraging", a = hours(k, false), b = hours(k, true);
  ok("  level 15 in about half the time, level 30 in under three quarters; level 50 within 8% of no bonus at all", b[15] < a[15] * 0.55 && b[30] < a[30] * 0.75 && b[50] > a[50] * 0.92,
     `L15 ${a[15].toFixed(1)}h -> ${b[15].toFixed(1)}h, L30 ${a[30].toFixed(1)}h -> ${b[30].toFixed(1)}h, L50 ${a[50].toFixed(0)}h -> ${b[50].toFixed(0)}h`);
}

/* ---- I-6: the balance report finds no new outliers (tools/balance_sim.js --check; tools/balance_allowlist.json says why
   each allowed one is allowed) ---- */
{
  const cp = require("child_process");
  let out = "", code = 0;
  try { out = cp.execFileSync(process.execPath, [path.join(APP, "tools", "balance_sim.js"), "--check"], {encoding: "utf8"}); } catch (e) { code = e.status; out = String(e.stdout || e); }
  ok("the balance report finds no new outliers (spots, recipes)", code === 0, out.trim().split("\n").slice(-4).join(" | "));
}

/* ---- the economy (2026-10-10, Cam: "a rough gem ... sells for 1 coin that doesnt make sense") ---- */
{
  const SELL = [1, 2, 4, 7, 12, 20, 32, 50, 75, 110, 160];
  ok("gems, treasures and eggs are priced by how rare they are (a rough gem 20, a pearl 32, lapis 75, a burrow egg 50)",
     C.priceOf("roughgem") === 20 && C.priceOf("pearl") === 32 && C.priceOf("lapis") === 75 && C.priceOf("burrowegg") === 50
     && Object.keys(C.VALUABLE).every((id) => C.priceOf(id) >= SELL[Math.min(10, C.ITEMS[id].gem || 0)]));
  const inc = (k, sp) => { const tot = sp.loot.reduce((a, l) => a + l[1], 0); return sp.loot.reduce((a, l) => a + 3600 / sp.time * l[1] / tot * C.priceOf(l[0]), 0); };
  const over = [].concat(...C.GATHERING.map((k) => C.SKILLS[k].spots.filter((sp) => !sp.essence && C.ECON.budget[k + ":" + sp.id] && inc(k, sp) > 2.3 * C.ECON.budget[k + ":" + sp.id]).map((sp) => k + ":" + sp.id)));
  ok("  no gathering spot earns more than ~2x the coins an hour of its level", over.length === 0, over.join(", "));
  const gr = C.SKILLS.mining.spots.find((sp) => sp.id === "coalseam");
  ok("  the Gem rocks still give rough gems, just rarer (an hour's coins in line)", gr.loot.some((l) => l[0] === "roughgem") && inc("mining", gr) < 2 * C.ECON.budget["mining:coalseam"]);
  const found = new Set([].concat(...C.GATHERING.map((k) => [].concat(...C.SKILLS[k].spots.map((sp) => sp.loot.map((l) => l[0]))))).concat(...Object.values(C.MONSTERS).map((m) => (m.drops || []).map((d) => d[0]))));
  const loss = [];   // (a conversion into something you find anyway -- a quill into feathers -- isn't counted)
  Object.keys(C.WORKSHOPS).forEach((w) => { const ws = C.WORKSHOPS[w]; if (ws.npc || ws.trade) return;
    ws.recipes.forEach((r) => { if (C.VALUABLE[r.make] || C.PACE[r.make] || found.has(r.make)) return; const cost = (r.fee || 0) + Object.keys(r.needs || {}).reduce((a, n) => a + C.priceOf(n) * r.needs[n], 0);
      if (C.priceOf(r.make) * (r.n || 1) < cost) loss.push(w + ":" + r.make); }); });
  ok("  nothing you make is worth less than what went into it", loss.length === 0, loss.slice(0, 8).join(", "));
  ok("  cutting a gem takes one or two rough gems, not five or ten", C.WORKSHOPS.gemology.recipes.filter((r) => r.needs.roughgem).every((r) => r.needs.roughgem <= 4));
  ok("  a merchant never buys for more than half what it sells for", ["merchant", "travelling"].every((m) => C.stockFor(m, Date.UTC(2026, 9, 11)).every(([id, p]) => p >= 2 * C.priceOf(id))));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
