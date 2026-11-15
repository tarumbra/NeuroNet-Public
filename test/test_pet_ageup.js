/* ==========================================================================
   NeuroPets: growing a pet up at once (2026-10-09).
   ==========================================================================
   Cam: "can you add special charms, potions and food recipes you can cook to
   age pets up straight away to expedition age."

   A Charm of Seasons (Gem bench), an Elixir of Growth (Apothecary table) and a
   Coming-of-age cake (Kitchen): each is used up on your pet, and a hatchling
   is at once old enough for expeditions. An egg, or a pet already old enough,
   keeps the item. The game's own rules (ui/pet/petcore.js) on made-up pets.
   ========================================================================== */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petart.js"), "utf8"), ctx);
const Art = ctx.window.PetArt || ctx.PetArt;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const T0 = Date.UTC(2026, 9, 9, 9);
const AGERS = ["seasonscharm", "growthelixir", "comingofagecake"];

/** A freshly hatched pet (a hatchling), with `bag`. */
function hatchling(bag = {}, days = 0) {
  let s = C.empty();
  s.dev = {on: true};
  s = C.act(s, "dev", {op: "flags", instantHatch: true}, T0).state;
  s = C.act(s, "hatch", {egg: "starter", roll: 0.2}, T0).state;
  if (days) s = C.act(s, "dev", {op: "age", days}, T0).state;
  s = C.advance(s, T0);
  delete s.dev;
  Object.assign(s.pet, {asleep: false, sick: false, s: {full: 100, happy: 80, energy: 90, clean: 90, health: 100}, at: T0, away: null});
  s.bag = Object.assign({}, bag);
  return s;
}
const stageOf = (s) => C.view(s, T0).stage;
const area = C.AREA_ORDER[0];

console.log("\nNeuroPets: growing up at once\n");

ok("three things that grow a pet up: a charm, a potion and a dish", AGERS.every((k) => C.ITEMS[k] && C.ITEMS[k].ageUp)
   && !C.ITEMS.seasonscharm.food && C.ITEMS.growthelixir.potion && C.ITEMS.comingofagecake.food);
const made = (w, k) => C.WORKSHOPS[w].recipes.some((r) => r.make === k);
ok("  made at the Gem bench, the Apothecary table and the Kitchen", made("gemology", "seasonscharm") && made("apothecary", "growthelixir") && made("kitchen", "comingofagecake"));
ok("  each has a picture and a price", AGERS.every((k) => (Art.itemArt ? Art.itemArt(k) || Art.item(k) : Art.item(k)) && C.priceOf(k) > 0),
   AGERS.map((k) => k + ":" + C.priceOf(k)).join(" "));
ok("  and says what it does", AGERS.every((k) => /old enough for expeditions/.test(C.describe(k))));

{
  const s = hatchling({seasonscharm: 2});
  ok("a hatchling can't go on expeditions", stageOf(s) === "hatchling" && !C.act(s, "expedition", {area, roll: 0.3}, T0).ok);
  const r = C.act(s, "use", {item: "seasonscharm"}, T0);
  ok("the Charm of Seasons grows it up at once", r.ok && C.view(r.state, T0).stage === "young" && C.view(r.state, T0).daysToExpeditions === 0, r.error || r.msg);
  ok("  and is used up", r.state.bag.seasonscharm === 1);
  ok("  then off it goes", C.act(r.state, "expedition", {area, roll: 0.3}, T0).ok, C.act(r.state, "expedition", {area, roll: 0.3}, T0).error);
  const again = C.act(r.state, "use", {item: "seasonscharm"}, T0);
  ok("a pet old enough already keeps the charm", !again.ok && /old enough/.test(again.error) && r.state.bag.seasonscharm === 1, again.error);
}
{
  const s = hatchling({growthelixir: 1});
  const r = C.act(s, "use", {item: "growthelixir"}, T0);
  ok("the Elixir of Growth does too", r.ok && C.view(r.state, T0).stage === "young" && !r.state.bag.growthelixir, r.error);
}
{
  const s = hatchling({comingofagecake: 1});
  const r = C.act(s, "feed", {food: "comingofagecake"}, T0);
  ok("the Coming-of-age cake too -- even on a full tummy", r.ok && C.view(r.state, T0).stage === "young" && !r.state.bag.comingofagecake, r.error);
  ok("  and the cake can't be 'used' like a potion", !C.act(hatchling({comingofagecake: 1}), "use", {item: "comingofagecake"}, T0).ok);
}
{
  const old = hatchling({comingofagecake: 1}, 10);
  const r = C.act(old, "feed", {food: "comingofagecake"}, T0);
  ok("an older pet keeps the cake as well", !r.ok && old.bag.comingofagecake === 1, r.error);
  const g = hatchling({growthelixir: 1}, 1);
  const before = T0 - g.pet.hatchAt, r2 = C.act(g, "use", {item: "growthelixir"}, T0);
  ok("a day-old pet is grown to exactly expedition age (not older)", r2.ok && T0 - r2.state.pet.hatchAt === C.EXPEDITION_AGE && before < C.EXPEDITION_AGE);
}
{
  let s = C.empty();
  s = C.act(s, "hatch", {egg: "starter", roll: 0.2}, T0).state;
  s.bag = {seasonscharm: 1};
  const r = C.act(s, "use", {item: "seasonscharm"}, T0);
  ok("an egg keeps it too", !r.ok && s.bag.seasonscharm === 1, r.error);
}
ok("in the bag the charm is something to give (not to wear)", C.bagList(hatchling({seasonscharm: 1})).find((b) => b.id === "seasonscharm").kind === "potion");

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
