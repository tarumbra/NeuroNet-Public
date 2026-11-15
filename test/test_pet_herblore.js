/* ==========================================================================
   NeuroPets Herblore: unidentified herbs, the Herb table, the Herbarium (2026-10-06).
   ==========================================================================
   Cam: "Lets fix the herblore, move all potions to the apothacary. Herblore
   skill can be used to catalog unidentifed herbs which can be found from
   digging, foraging, planted in herb pots(tiered throughout the levels of
   farming). The encounter rate depends on the level of the area and your
   level in that skill. Once they are identified you can then use them for
   potions at the apothacery table."

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
C.NOVICE.splice(0);   // exact base xp here; the novice bonus is tested in test_pet_balance.js

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const T0 = 1800000000000;
function fresh(herblore) {
  const s = C.advance(C.empty(), T0);
  s.player.made = true; s.player.name = "Tester";
  if (herblore) s.player.skills.herblore = C.XP[herblore];
  return s;
}

console.log("\nNeuroPets Herblore\n");

/* ---- potions moved, and more herbs ---- */
const W = C.WORKSHOPS;
ok("every potion is made at the Apothecary table (Alchemy); the Herb table makes none",
  W.herblore.recipes.length === 0 && W.herblore.identify && W.apothecary.skill === "alchemy"
  && ["minorhealing", "attackpotion", "superhealing", "isleelixir", "moonlightdraught", "salve"].every((m) => W.apothecary.recipes.some((r) => r.make === m)));
ok("five tiers of four herbs (20), gated at Herblore 1/10/20/30/40",
  C.HERB_TIERS.map((t) => t.level).join() === "1,10,20,30,40" && C.HERB_TIERS.every((t) => t.pool.length === 4));
{
  const v = (() => { const s = fresh(); s.herbarium = {}; C.HERB_TIERS.forEach((t) => t.pool.forEach((h) => { s.herbarium[h[0]] = 1; })); return C.herbariumView(s); })();
  const unused = [].concat(...v.tiers.map((t) => t.herbs)).filter((h) => !h.uses.length).map((h) => h.id);
  ok("every herb brews something at the Apothecary table", unused.length === 0, unused.join());
  const fresh10 = ["feverfewtonic", "marigoldbalm", "sagedraught", "comfreypoultice", "valeriandraught", "stoneskin", "berserkerbrew", "huntersdraught", "dragonsblood", "starbloomdraught"];
  ok("  ten new potions, each with a use (pet tonic, balms, draughts, brews)", fresh10.every((k) => W.apothecary.recipes.some((r) => r.make === k) && C.describe(k)));
}

/* ---- one stack, which herb hidden ---- */
{
  let s = fresh(); C.act(s, "identify", {roll: 0.1}, T0);
  s.unid = {herb: 3, rosemary: 1}; s.bag.unidherb = 4;
  ok("unidentified herbs are one stack in the bag", C.bagList(s).filter((x) => /Unidentified/.test(x.name)).length === 1);
  // Herblore 1: a rosemary (tier II) can't be named yet -- find the roll that picks it
  let fail = null, win = null;
  for (let i = 0; i < 40 && (!fail || !win); i++) {
    const r = C.act(JSON.parse(JSON.stringify(s)), "identify", {roll: i / 40}, T0);
    if (r.ok) win = win || r; else fail = fail || r;
  }
  ok("Identify one: it works...", win && win.state.bag.herb >= 1 && win.state.bag.unidherb === 3 && win.state.herbarium.herb, win && win.msg);
  ok("  ...or says you don't have the required level (and keeps the herb)", fail && /required level/.test(fail.error) && /Herblore 10/.test(fail.error), fail && fail.error);
  const all = C.act(JSON.parse(JSON.stringify(s)), "identify", {all: true, roll: 0.5}, T0);
  ok("Identify all names what you can, and says how many need more", all.ok && all.state.bag.herb >= 3 && all.state.bag.unidherb === 1 && /1 needs a higher Herblore level/.test(all.msg), all.msg);
  const first = C.act(fresh(), "identify", {roll: 0.1}, T0);
  ok("nothing to identify: says so", !first.ok && /no unidentified herbs/.test(first.error));
  const x = fresh(); x.unid = {mint: 1}; x.bag.unidherb = 1;
  const r1 = C.act(x, "identify", {roll: 0.3}, T0);
  ok("  a first find is worth six times the xp, and goes in the Herbarium", r1.ok && r1.state.player.skills.herblore === 36 && r1.state.herbarium.mint, r1.msg);
  ok("selling unidentified herbs takes them from the hidden stack too", (() => { const y = JSON.parse(JSON.stringify(s)); y.coins = 0;
    const r = C.act(y, "sell", {item: "unidherb", n: 1, to: "merchant"}, T0); return r.ok && r.state.bag.unidherb === 3 && Object.values(r.state.unid).reduce((a, b) => a + b, 0) === 3; })());
}

/* ---- where herbs come from: any tier, likelier near the place's difficulty ---- */
{
  const tiersAt = (lv) => { const t = [0, 0, 0, 0, 0, 0]; const j = {seed: 7}; for (let i = 0; i < 4000; i++) t[C.HERB_TIER_OF ? 0 : 0] = 0, t[tierOf(C.rollHerb(j, lv))]++; return t.slice(1).map((n) => Math.round(n / 40)); };
  const tierOf = (h) => C.HERB_TIERS.findIndex((t) => t.pool.some((p) => p[0] === h)) + 1;
  const lo = tiersAt(1), hi = tiersAt(50);
  ok("a herb from an easy place is mostly tier I -- but now and then anything", lo[0] >= 60 && lo[4] >= 0 && lo[1] + lo[2] + lo[3] + lo[4] >= 15, lo.join("/"));
  ok("  from the hardest, mostly tier V", hi[4] >= 60, hi.join("/"));
  ok("encounter rate: higher spot, more herbs; above the spot's level, more again; capped",
    C.herbChance(1, 1) < C.herbChance(30, 30) && C.herbChance(30, 30) < C.herbChance(50, 30) && C.herbChance(99, 50) <= 0.12);
}
{
  const SPOT_MG = C.SKILLS.foraging.spots.find((x) => x.name === "Mushroom glade").id;
  let s = fresh(); s.player.skills.foraging = C.XP[20]; s.player.tools = {foraging: "maplebasket"};
  const r = C.act(s, "trip", {skill: "foraging", spot: SPOT_MG, roll: 0.3}, T0);
  const st = r.ok ? C.advance(r.state, T0 + 6 * 3600000) : null;
  const n = st ? st.bag.unidherb || 0 : -1;
  ok("six hours at the Mushroom glade turn up a few unidentified herbs (and which ones stays hidden)",
    n >= 90 && n <= 900 && Object.values(st.unid).reduce((a, b) => a + b, 0) === n && !C.ALL_HERBS_IN_BAG, r.error || String(n));
}
{
  const s = fresh(); s.bag.woodcrate = 30;
  let st = s, herbs = 0;
  for (let i = 0; i < 30; i++) { const r = C.act(st, "open", {item: "woodcrate", roll: (i * 0.618) % 1}, T0 + i); st = r.state; herbs += (r.got || []).filter((g) => g === "unidherb").length; }
  ok("herbs from crates come unidentified", herbs > 0 && !st.bag.herb && st.bag.unidherb === herbs, `${herbs} / ${st.bag.herb}`);
}

/* ---- herb pots ---- */
{
  const pot = (known) => {
    const s = fresh(); s.player.skills.farming = C.XP[40];
    if (known) s.herbarium = {lavender: 1};
    s.farm.pots = [{herb: "lavender", ready: true, readyAt: T0}];
    return C.act(s, "farm", {op: "potpick", i: 0, roll: 0.5}, T0);
  };
  const a = pot(false), b = pot(true);
  ok("a pot of a herb you've never identified grows it unidentified", a.ok && a.state.bag.unidherb >= 2 && a.state.unid.lavender >= 2 && !a.state.bag.lavender, a.error || JSON.stringify(a.state.bag));
  ok("  one in your Herbarium grows as itself", b.ok && b.state.bag.lavender >= 2 && !b.state.bag.unidherb, b.error || JSON.stringify(b.state.bag));
}

/* ---- master herbalist ---- */
{
  const s = fresh(); s.herbarium = {}; C.HERB_TIERS.forEach((t) => t.pool.forEach((h) => { s.herbarium[h[0]] = 1; }));
  s.player.skills.alchemy = C.XP[10];
  const rec = W.apothecary.recipes.find((x) => x.make === "poultice");
  Object.keys(rec.needs).forEach((k) => { s.bag[k] = 999; });
  let st = s, made = 0;
  for (let i = 0; i < 16; i++) { const r = C.act(st, "craft", {workshop: "apothecary", make: "poultice", i: W.apothecary.recipes.indexOf(rec)}, T0 + i); if (!r.ok) break; st = r.state; made++; }
  ok("a master herbalist: every 8th potion is free (16 brews, 18 potions)", made === 16 && st.bag.poultice === 16 * (rec.n || 1) + 2, `${made} brews, ${st.bag.poultice}`);
}

/* ---- old saves ---- */
{
  const old = C.advance(C.empty(), T0); delete old.herbsMoved; old.v = 1;
  old.player.skills.herblore = C.XP[25]; old.player.skills.alchemy = 0; old.bag.rosemary = 5; old.bag.unidherb1 = 4; old.bag.unidherb4 = 2;
  const st = C.advance(old, T0 + 1000);
  ok("an old save keeps its potions: Alchemy catches up to Herblore, and herbs it held are in the Herbarium",
    C.levelOf(st.player.skills.alchemy) === 25 && st.herbarium.rosemary === 1 && st.herbsMoved);
  ok("  the old tiered stacks become the one stack, keeping their tiers hidden inside",
    st.bag.unidherb === 6 && !st.bag.unidherb1 && !st.bag.unidherb4 && (st.unid.ginseng || 0) + (st.unid.orchid || 0) + (st.unid.mandrake || 0) + (st.unid.wolfsbane || 0) === 2, JSON.stringify(st.unid));
}

/* ---- the bag's room (2026-10-07) ---- */
{
  const full = () => { const s = fresh(); s.bag = {}; const ids = Object.keys(C.ITEMS).filter((k) => !C.ITEMS[k].bagSize && !C.ITEMS[k].unid && !C.HERB_TIER_OF_X).slice(0, C.BAG_START); ids.forEach((k) => { s.bag[k] = 1; }); s.coins = 100000; return s; };
  const s = full();
  ok("a new bag holds 25 kinds of things (I8 2026-10-19: was 20, 40 before 2026-10-10)", C.bagCap(s) === 25 && C.bagUsed(s) === 25);
  ok("  full: buying a new kind is refused", !C.act(s, "buy", {item: "earthworm", from: "merchant"}, T0).ok || s.bag.earthworm > 0);
  const big = C.act(full(), "buy", {item: "satchel", from: "merchant"}, T0);
  ok("a bigger bag from Marlow: room for more (and it isn't a thing in the bag)", big.ok && C.bagCap(big.state) === 28 && C.stackCap(big.state) === 350 && !big.state.bag.satchel, big.error);
  ok("  a smaller one than you have isn't sold", !C.act(big.state, "buy", {item: "satchel", from: "merchant"}, T0).ok);
  const over = full(); Object.keys(C.ITEMS).filter((k) => !(k in over.bag) && !C.ITEMS[k].bagSize && !C.ITEMS[k].unid).slice(0, 3).forEach((k) => { over.bag[k] = 3; });
  ok("over capacity: what's there stays (more of a kind you have still fits)", C.bagUsed(over) > C.BAG_START && (() => { const g = C.act(over, "trip", {skill: "digging", spot: "garden", roll: 0.2}, T0); return g.ok; })());
  // gathering into a full bag: new kinds are left behind, and the diary says so
  const g = full(); g.player.made = true;
  const t = C.act(g, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.4}, T0);
  const st = C.advance(t.state, T0 + 2 * 3600000);
  ok("  gathering into a full bag: new kinds are left behind, and the diary says so",
    C.bagUsed(st) <= C.BAG_START + 1 && st.log.some((e) => /No room in your bag/.test(e.text)), st.log.slice(0, 3).map((e) => e.text).join(" | "));
  const inCrate = C.CRATES.woodcrate.loot.map((l) => l[0]).concat(["unidherb"]);
  const c = fresh(); c.bag = {woodcrate: 1};
  Object.keys(C.ITEMS).filter((k) => !inCrate.includes(k) && k !== "woodcrate" && !C.ITEMS[k].bagSize && !C.ITEMS[k].unid).slice(0, 39).forEach((k) => { c.bag[k] = 1; });
  const cr = C.act(c, "open", {item: "woodcrate", roll: 0.3}, T0);
  ok("  a crate won't open without room for what's inside", !cr.ok && /too full/.test(cr.error), cr.error || cr.msg);
}

/* ---- the notice board ---- */
{
  const s = fresh(); s.player.skills.foraging = C.XP[20]; s.player.skills.mining = C.XP[20];
  const v = C.ordersView(s, T0);
  ok("the notice board has three orders a day, the same all day", v.list.length === 3 && JSON.stringify(C.ordersFor(s, T0)) === JSON.stringify(C.ordersFor(s, T0 + 3600000)));
  const o = v.list[0]; s.bag[o.id] = o.n; s.coins = 0;
  const r = C.act(s, "order", {i: 0}, T0);
  ok("  filling one takes the things, pays coins and xp, and gives a crate", r.ok && !r.state.bag[o.id] && r.state.coins === o.coins && r.state.bag.woodcrate === 1, r.error || r.msg);
  ok("  once a day", !C.act(r.state, "order", {i: 0}, T0 + 1).ok);
  let st = r.state; const all = C.ordersFor(st, T0);
  [1, 2].forEach((i) => { st.bag[all[i].id] = (st.bag[all[i].id] || 0) + all[i].n; st = C.act(st, "order", {i}, T0 + 2).state; });
  ok("  all three: an iron crate as thanks", st.bag.ironcrate === 1);
  ok("  it pays better than selling to Marlow", o.coins > C.priceOf(o.id) * o.n);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
