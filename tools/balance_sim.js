#!/usr/bin/env node
/* NeuroPets balance report (2026-10-10 audit, I-6 / MATH-8, MATH-9). Loads the real rules (ui/pet/petcore.js) and writes
   tools/balance_report.csv -- one row per gathering spot, recipe and hunting area -- then prints the outliers.

     node tools/balance_sim.js            write the report and print outliers
     node tools/balance_sim.js --check    exit 1 if an outlier isn't in tools/balance_allowlist.json (run by the tests)
     node tools/balance_sim.js --baseline write the current outliers into the allowlist (after a deliberate change)

   Nothing here touches a save: every number comes from the rules and from fixed-seed simulations. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const args = process.argv.slice(2), CHECK = args.includes("--check"), BASELINE = args.includes("--baseline");
const ALLOW = path.join(__dirname, "balance_allowlist.json");
const T0 = Date.UTC(2026, 9, 10, 2), HOUR = 3600e3;
const median = (a) => { const b = a.filter((x) => x > 0).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
const r1 = (x) => Math.round(x * 10) / 10;
const rows = [], outliers = [];

/* ---- gathering spots: xp/h, items/h, coins/h if all sold ---- */
const spots = [].concat(...C.GATHERING.map((k) => C.SKILLS[k].spots.filter((sp) => !sp.essence).map((sp) => Object.assign({skill: k}, sp))));
const perHour = {};                                  // item -> best (items an hour, spot level) from gathering
spots.forEach((sp) => {
  const acts = 3600 / sp.time, total = sp.loot.reduce((a, l) => a + l[1], 0), items = {};
  sp.loot.forEach(([id, w]) => { items[id] = acts * w / total; if (!perHour[id] || items[id] > perHour[id].n) perHour[id] = {n: items[id], level: sp.level}; });
  const coins = Object.keys(items).reduce((a, id) => a + items[id] * (C.ITEMS[id] ? C.priceOf(id) : 0), 0);
  sp.xph = sp.xp * acts;
  rows.push({kind: "spot", id: sp.skill + ":" + sp.id, level: sp.level, xph: r1(sp.xph), per: Object.keys(items).map((id) => id + " " + Math.round(items[id])).join("; "),
             rare: sp.rare ? sp.rare[0] + " 1/" + sp.rare[1] : "", coinsh: Math.round(coins)});
});
// a spot more than 1.5x the median of spots within 5 levels (fishing to 15 has +30% on purpose; runecrafting burns mined essence)
spots.forEach((sp) => {
  if (sp.skill === "runecrafting") return;
  const near = spots.filter((x) => x.skill !== "runecrafting" && Math.abs(x.level - sp.level) <= 5).map((x) => x.xph), m = median(near);
  if (sp.xph > 1.5 * m) outliers.push("spot " + sp.skill + ":" + sp.id + " " + Math.round(sp.xph) + " xp/h vs median " + Math.round(m));
});

/* ---- recipes: xp per craft, and xp per hour of the gathering its inputs take ---- */
const recipeRows = [];
Object.keys(C.WORKSHOPS).forEach((w) => {
  const ws = C.WORKSHOPS[w];
  if (ws.npc || !ws.skill) return;
  (ws.recipes || []).forEach((r) => {
    let hours = 0, known = true;
    Object.keys(r.needs || {}).forEach((id) => { if (perHour[id]) hours += r.needs[id] / perHour[id].n; else known = false; });
    const xpPerGatherHour = known && hours > 0 ? r.xp / hours : 0;
    recipeRows.push({w, skill: ws.skill, make: r.make, level: r.level || 1, xp: r.xp || 0, xpPerGatherHour});
    rows.push({kind: "recipe", id: w + ":" + r.make, level: r.level || 1, xph: known ? Math.round(xpPerGatherHour) : "", per: "xp " + (r.xp || 0) + " per craft; needs " + Object.keys(r.needs || {}).map((id) => id + " x" + r.needs[id]).join(", "), rare: "", coinsh: ""});
  });
});
// within a bench: a recipe whose xp per gathering hour is over 3x its neighbours (±5 levels)
recipeRows.filter((r) => r.xpPerGatherHour > 0).forEach((r) => {
  const near = recipeRows.filter((x) => x.w === r.w && x.xpPerGatherHour > 0 && Math.abs(x.level - r.level) <= 5).map((x) => x.xpPerGatherHour), m = median(near);
  if (near.length >= 3 && r.xpPerGatherHour > 3 * m) outliers.push("recipe " + r.w + ":" + r.make + " " + Math.round(r.xpPerGatherHour) + " xp per gathering hour vs median " + Math.round(m));
});

/* ---- hunting: an hour at each ground for a player at its level, with the best gear they can wear and food ---- */
const gearFor = (lv) => {
  const best = {};
  Object.keys(C.ITEMS).forEach((id) => {
    const g = C.ITEMS[id].gear;
    if (!g || g.who === "pet" || g.cls && g.cls !== "berserker") return;
    if (g.slot === "weapon" && g.style && g.style !== "melee") return;   // a Berserker swings: no sceptre (V17 makes casting in metal cost)
    const req = g.req || {}, okLv = Object.keys(req).every((k) => req[k] <= lv);
    const W = C.ARMOUR && C.ARMOUR.weights[C.weightOf(id)], blows = W ? Math.min(W.vs.crush, W.vs.slash, W.vs.pierce) : 1;   // V17: Defence against blows (cloth: half)
    const score = (g.att || 0) + (g.def || 0) * blows + (g.str || 0) + (g.maxhit || 0);
    if (okLv && (!best[g.slot] || score > best[g.slot].score)) best[g.slot] = {id, score};
  });
  return Object.keys(best).map((k) => best[k].id);
};
const foods = Object.keys(C.ITEMS).filter((id) => C.ITEMS[id].heal && !C.ITEMS[id].potion).sort((a, b) => C.ITEMS[a].heal - C.ITEMS[b].heal);
(C.HUNT_ORDER || Object.keys(C.HUNTS)).forEach((g) => {
  const h = C.HUNTS[g], lv = Math.max(1, h.level);
  let s = C.advance(C.empty(), T0); s.player.made = true; s.coins = 0;
  ["attack", "defence", "hitpoints", "strength"].forEach((k) => { if (k in s.player.skills || k !== "strength") s.player.skills[k] = C.XP[Math.max(lv, k === "hitpoints" ? 10 : 1)]; });
  s.player.cls = "berserker";
  gearFor(lv).forEach((id) => { s.bag[id] = 1; const r = C.act(s, "equip", {item: id}, T0); if (r.ok) s = r.state; });
  const food = foods.filter((id) => C.ITEMS[id].heal <= Math.max(3, lv)).pop() || foods[0];
  s.bag[food] = 200; s.player.food = food; s.player.eatBelow = 0.5;
  // the islands and the far regions (2026-10-12, audit OPT-6): stand on the right island, with the best ship and what the way in needs
  const reg = (C.REGIONS || {})[g] || {}, needs = reg.needs || {};
  if (reg.isle) s.player.island = reg.isle;
  s.ship = Object.assign(s.ship || {}, {tier: 4});
  [needs.item].concat(needs.also || []).filter(Boolean).forEach((k) => { s.bag[k] = (s.bag[k] || 0) + 1; });
  Object.keys(needs.skills || {}).forEach((k) => { s.player.skills[k] = Math.max(s.player.skills[k] || 0, C.XP[needs.skills[k]]); });
  const before = Object.assign({}, s.player.skills);
  const r = C.act(s, "hunt", {ground: g, roll: 0.37}, T0);
  if (!r.ok) { rows.push({kind: "hunt", id: g, level: lv, xph: "", per: "could not start: " + r.error, rare: "", coinsh: ""}); return; }
  const y = C.advance(r.state, T0 + HOUR), j = y.player.job || y.player.lastTrip || {};
  const xp = ["attack", "defence", "hitpoints"].map((k) => Math.round((y.player.skills[k] || 0) - (before[k] || 0)));
  const ate = 200 - (y.bag[food] || 0), home = y.log.find((e) => /came home|You fell/.test(e.text));
  const coinsh = Math.round((y.coins || 0) - (r.state.coins || 0));            // the purse an hour's hunting earns (audit ECO-4)
  rows.push({kind: "hunt", id: g, level: lv, xph: xp[0] + xp[1], per: `wins ${j.count || 0}; xp att/def/hp ${xp.join("/")}; ate ${ate} ${food}${home ? "; " + home.text.slice(0, 60) : ""}`, rare: "", coinsh});
  // combat against gathering at the same level (2026-10-10: combat was ~6-17x; now aimed at ~1.5x)
  const gatherBest = Math.max(...spots.filter((sp) => sp.skill !== "runecrafting" && sp.level <= lv).map((sp) => sp.xph)) * C.noviceMult(lv);
  const ratio = (xp[0] + xp[1]) / gatherBest;
  if (ratio > 2.5 || ratio < 0.5) outliers.push("hunt " + g + " " + Math.round(xp[0] + xp[1]) + " combat xp/h = " + ratio.toFixed(1) + "x gathering at level " + lv);
});

/* ---- the Farm (2026-10-12): an animal kept fed, visited every round -- Husbandry xp, coins if all sold, feed it eats ---- */
Object.keys(C.LIVESTOCK || {}).forEach((k) => {
  const L = C.LIVESTOCK[k], perH = 3600e3 / L.every, goods = perH * (L.n || 1);
  const coins = goods * C.priceOf(L.gives) + (L.extra ? perH / L.extra.each * L.extra.n * C.priceOf(L.extra.id) : 0);
  const feedCost = L.eats ? 1 / 12 * C.priceOf(L.eats) : 0;                       // bees (2026-10-13) fetch their own
  rows.push({kind: "animal", id: k, level: L.opens, xph: Math.round((perH * L.xp + 3 / 12) * (C.RANCH_PACE || 1)), per: `${(goods * 24).toFixed(1)} ${L.gives} a day; eats ${L.eats || "nothing"}; feed ${feedCost.toFixed(2)} coins/h`,
             rare: "", coinsh: Math.round((coins - feedCost) * 100) / 100});
  if (coins - feedCost < 0) outliers.push("animal " + k + " costs more to feed than it earns");
});

/* ---- write ---- */
const csv = ["kind,id,level,xp_per_hour,detail,rare,coins_per_hour"].concat(rows.map((r) => [r.kind, r.id, r.level, r.xph, `"${String(r.per).replace(/"/g, "'")}"`, r.rare, r.coinsh].join(","))).join("\n");
fs.writeFileSync(path.join(__dirname, "balance_report.csv"), csv + "\n");
const allow = fs.existsSync(ALLOW) ? JSON.parse(fs.readFileSync(ALLOW, "utf8")) : {outliers: {}};
const key = (o) => o.split(" ").slice(0, 2).join(" ");
const fresh = outliers.filter((o) => !(key(o) in allow.outliers));
if (BASELINE) {
  outliers.forEach((o) => { if (!(key(o) in allow.outliers)) allow.outliers[key(o)] = "baseline " + new Date().toISOString().slice(0, 10) + ": " + o; });
  fs.writeFileSync(ALLOW, JSON.stringify(allow, null, 2) + "\n");
  console.log(`Allowlist now has ${Object.keys(allow.outliers).length} entries.`);
}
if (!CHECK) {
  console.log(`Wrote tools/balance_report.csv: ${rows.filter((r) => r.kind === "spot").length} spots, ${recipeRows.length} recipes, ${rows.filter((r) => r.kind === "hunt").length} hunting grounds.`);
  rows.filter((r) => r.kind === "hunt").forEach((r) => console.log(`  hunt ${r.id} (level ${r.level}): ${r.per} -- ${r.coinsh} coins/h`));
  rows.filter((r) => r.kind === "animal").forEach((r) => console.log(`  animal ${r.id} (Husbandry ${r.level}): ${r.xph} xp/h, ${r.coinsh} coins/h -- ${r.per}`));
  console.log(outliers.length ? "Outliers:\n  " + outliers.map((o) => (key(o) in allow.outliers ? "(allowed) " : "") + o).join("\n  ") : "No outliers.");
}
if (CHECK && fresh.length && !BASELINE) { console.log("New balance outliers (fix them, or add them to tools/balance_allowlist.json with a reason):\n  " + fresh.join("\n  ")); process.exit(1); }
if (CHECK) console.log(`balance check: ${outliers.length} outliers, all allowed`);
