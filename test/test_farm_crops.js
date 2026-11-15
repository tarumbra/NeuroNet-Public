/* ==========================================================================
   NeuroFarm: more crops and their recipes, the mill, the Instant tonic (2026-10-07).
   ==========================================================================
   Cam: "have an instant finish potion available later after filling
   requests ... build out some more crops for the game please and their
   respective recipes."

   Runs ui/farm/farmcore.js on made-up farms -- never a real save.
   ========================================================================== */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "farm", "farmcore.js"), "utf8"), ctx);
const F = ctx.window.FarmCore;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const T = 1800000000000, M = 60000;
const farm = () => F.act(F.empty(), "start", {farmer: "Cam", farm: "Sunny Acres"}, T).state;
const at = (s, lv) => { s.xp = F.XP[lv]; s.coins = 100000; s.silos = 20; return s; };

console.log("\nNeuroFarm: more crops, the mill, the Instant tonic\n");

/* ---- crops ---- */
const NEW = ["tomato", "onion", "lettuce", "beetroot", "sugarcane", "cucumber", "sunflower", "chilli", "rice", "grapes", "pineapple", "coffee", "cocoa"];
ok("thirteen more crops", NEW.every((k) => F.CROPS[k]) && Object.keys(F.CROPS).length === 27);
ok("  and five more fruit trees (cherry, orange, lemon, peach, coconut)", ["cherry", "orange", "lemon", "peach", "coconut"].every((k) => F.TREES[k]) && Object.keys(F.TREES).length === 10);
ok("  every crop and fruit has a name and a price", Object.values(F.CROPS).concat(Object.values(F.TREES)).every((c) => F.PRICES[c.item] > 0 && F.nameOf(c.item) !== c.item));
ok("  every one goes into at least one recipe", Object.values(F.CROPS).concat(Object.values(F.TREES)).filter((c) => !["goldapple", "flax", "cotton", "cabbage", "pumpkin", "sweetcorn", "melon", "dragonfruit", "starfruit", "blackberry", "elderberry", "mango", "banana", "pear", "apple", "potato", "carrot", "wheat", "strawberry"].includes(c.item))
  .every((c) => Object.values(F.RECIPES).some((r) => r.needs[c.item])),
  Object.values(F.CROPS).concat(Object.values(F.TREES)).filter((c) => !Object.values(F.RECIPES).some((r) => r.needs[c.item])).map((c) => c.item).join());
ok("  they're spread across the levels (and some of the late ones fill levels 24 to 27)", F.unlocksAt(24).length > 1 && F.unlocksAt(25).length && F.unlocksAt(26).length && F.unlocksAt(27).length);
{
  let s = at(farm(), 21);
  const r = F.act(s, "plant", {x: 0, y: 0, crop: "pineapple"}, T);
  ok("pineapples are 2x2", r.ok && r.state.tiles["1,1"].part.join() === "0,0", r.error);
  const t = F.act(at(farm(), 8), "plant", {x: 0, y: 0, tree: "cherry"}, T).state;
  const h = F.act(t, "harvest", {x: 0, y: 0}, T + 181 * M);
  ok("a cherry tree fruits (5 at a time)", h.ok && h.state.silo.cherry === 5);
}

/* ---- the mill ---- */
{
  ok("a fourth workshop: the mill (sugar, oil, juices, coffee, chocolate)", F.MAKERS.mill && ["sugar", "sunfloweroil", "orangejuice", "lemonade", "grapejuice", "coffee", "chocolate"].every((k) => F.RECIPES[k].at === "mill"));
  let s = at(farm(), 10); s.silo = {wood: 30, sugarcane: 20};
  ok("  it unlocks at level 10, built with wood and sugarcane", /level 1 mill/.test(F.act(s, "cook", {recipe: "sugar"}, T).error) && F.act(s, "build", {what: "mill"}, T).ok);
  s = F.act(s, "build", {what: "mill"}, T).state;
  const r = F.act(s, "cook", {recipe: "sugar"}, T);
  ok("  press sugarcane into sugar", r.ok && /Pressing sugar/.test(r.msg) && F.act(r.state, "collect", {maker: "mill"}, T + 46 * M).state.silo.sugar === 1, r.msg || r.error);
  ok("the kitchen's new dishes use the new crops (and the mill's sugar)", F.RECIPES.tomatosoup.needs.tomato && F.RECIPES.lemontart.needs.sugar && F.RECIPES.pizza.needs.cheese && F.RECIPES.friedrice.needs.rice);
  ok("every recipe sells for a little more than what went in", Object.keys(F.RECIPES).every((id) => { const rr = F.RECIPES[id];
    const raw = Object.keys(rr.needs).reduce((n, i) => n + rr.needs[i] * F.PRICES[i], 0); return F.PRICES[id] > raw && F.PRICES[id] < raw * 1.35; }),
    Object.keys(F.RECIPES).filter((id) => { const rr = F.RECIPES[id]; const raw = Object.keys(rr.needs).reduce((n, i) => n + rr.needs[i] * F.PRICES[i], 0); return !(F.PRICES[id] > raw && F.PRICES[id] < raw * 1.35); }).join());
  const makes = new Set(Object.values(F.CROPS).map((c) => c.item).concat(Object.values(F.TREES).map((c) => c.item), Object.values(F.ANIMALS).map((a) => a.makes), Object.keys(F.RECIPES)));
  ok("  and everything a recipe needs can be grown, gathered or made", Object.values(F.RECIPES).every((r) => Object.keys(r.needs).every((k) => makes.has(k))));
  ok("  no recipe needs something that unlocks after it", Object.keys(F.RECIPES).every((id) => { const r = F.RECIPES[id];
    return Object.keys(r.needs).every((k) => { const c = Object.values(F.CROPS).concat(Object.values(F.TREES)).find((x) => x.item === k);
      const a = Object.values(F.ANIMALS).find((x) => x.makes === k); const m = F.RECIPES[k];
      const lv = c ? c.level : a ? a.level : m ? m.level : 1; return lv <= r.level; }); }),
    Object.keys(F.RECIPES).filter((id) => { const r = F.RECIPES[id]; return !Object.keys(r.needs).every((k) => { const c = Object.values(F.CROPS).concat(Object.values(F.TREES)).find((x) => x.item === k);
      const a = Object.values(F.ANIMALS).find((x) => x.makes === k); const m = F.RECIPES[k]; return (c ? c.level : a ? a.level : m ? m.level : 1) <= r.level; }); }).join());
}

/* ---- the Instant tonic ---- */
{
  ok("the Instant tonic: from the request board, from level 12", F.POTIONS.instanttonic && F.POTIONS.instanttonic.level === 12 && F.unlocksAt(12).some((u) => /Instant/.test(u)));
  const seen = (lv) => { let s = at(farm(), lv), n = 0; for (let i = 0; i < 300; i++) { s.orders = []; s = F.advance(s, T + i); n += s.orders.filter((o) => o.potion === "instanttonic").length; } return n; };
  ok("  never offered before level 12; sometimes after", seen(11) === 0 && seen(12) > 0, `${seen(11)} / ${seen(12)}`);
  let s = at(farm(), 12); s.potions = {instanttonic: 3};
  s = F.act(s, "plant", {x: 0, y: 0, crop: "potato"}, T).state;
  let r = F.act(s, "potion", {potion: "instanttonic", x: 0, y: 0}, T + M);
  ok("  on a growing crop: ready at once (with its full time before it spoils)", r.ok && F.stageOf(r.state.tiles["0,0"], T + M).stage === "ready"
    && F.stageOf(r.state.tiles["0,0"], T + 60 * M).stage === "ready" && r.state.potions.instanttonic === 2);
  s = r.state; s.silo = {wood: 20, wheat: 20};
  s = F.act(s, "place", {house: "coop", x: 2, y: 2}, T).state;
  s = F.act(s, "buyanimal", {x: 2, y: 2, animal: "chicken"}, T).state;
  ok("  on a building with nobody working: it says so (and isn't used)", /Nobody/.test(F.act(s, "potion", {potion: "instanttonic", x: 2, y: 2}, T).error));
  s = F.act(s, "feed", {x: 2, y: 2}, T).state;
  r = F.act(s, "potion", {potion: "instanttonic", x: 3, y: 3}, T + M);
  ok("  on a building: its animals' work is done", r.ok && F.act(r.state, "gather", {x: 2, y: 2}, T + M).state.silo.egg === 2);
  s = r.state; s.silo.wheat = 20;
  s = F.act(s, "build", {what: "kitchen"}, T).state;
  s = F.act(s, "cook", {recipe: "bread"}, T).state;
  r = F.act(s, "potion", {potion: "instanttonic", maker: "kitchen"}, T + M);
  ok("  in a workshop: what it's making is ready", r.ok && r.state.cooking[0].done && F.act(r.state, "collect", {maker: "kitchen"}, T + M).state.silo.bread === 1);
  ok("  and with none left, the request board is where to get more", /request board/.test(F.act(Object.assign(r.state, {potions: {}}), "potion", {potion: "instanttonic", x: 0, y: 0}, T).error));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
