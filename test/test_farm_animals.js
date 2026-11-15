/* ==========================================================================
   NeuroFarm part 2: animals, wood, the dairy, the sewing room (2026-10-07).
   ==========================================================================
   Cam: "Later levels you unlock husbandry, starts off small with chickens, you
   need to build the coop which requires materials, wood, crops, money etc.
   Later barns for cows, pastures, goats etc. Which also produce materials that
   you can then use to make other things and sell them for extra (butter,
   yoghurt, milk, cheese etc). Sheep, a shearers shed, wool (clouthes,
   blankets etc)"

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

console.log("\nNeuroFarm: animals, wood, the dairy and the sewing room\n");

/* ---- wood ---- */
{
  let s = at(farm(), 3);
  s = F.act(s, "plant", {x: 0, y: 0, tree: "apple"}, T).state;
  const h = F.act(s, "harvest", {x: 0, y: 0}, T + 121 * M);
  ok("a tree gives a little wood with its fruit", h.ok && h.state.silo.wood === 1 && /wood/.test(h.msg), h.msg);
  const c = F.act(h.state, "clear", {x: 0, y: 0}, T + 122 * M);
  ok("  chopping it down gives more", c.ok && c.state.silo.wood === 5, c.msg);
  const b = F.act(farm(), "buy", {item: "wood", n: 10}, T);
  ok("  or buy it at the market (dearer than it sells for)", b.ok && b.state.silo.wood === 10 && b.state.coins === 200 - 10 * F.SUPPLIES.wood && F.SUPPLIES.wood > F.PRICES.wood);
}

/* ---- the coop ---- */
{
  let s = at(farm(), 5); s.silo = {wood: 20, wheat: 30};
  ok("a chicken coop unlocks at level 6", /level 6/.test(F.act(s, "place", {house: "coop", x: 0, y: 0}, T).error));
  s.xp = F.XP[6];
  s = F.act(s, "plant", {x: 3, y: 3, crop: "wheat"}, T).state;
  ok("  it needs a clear 2x2 space on your land", !F.act(s, "place", {house: "coop", x: 2, y: 2}, T).ok && !F.act(s, "place", {house: "coop", x: 3, y: 0}, T).ok);
  let r = F.act(s, "place", {house: "coop", x: 0, y: 0}, T);
  ok("  built with coins, wood and wheat", r.ok && r.state.tiles["0,0"].house.kind === "coop" && r.state.tiles["1,1"].part.join() === "0,0"
    && r.state.silo.wood === 10 && r.state.coins === 100000 - 400 - 4, r.error);
  s = r.state;
  ok("  nothing grows on it", !F.act(s, "plant", {x: 1, y: 1, crop: "wheat"}, T).ok && !F.act(s, "plant", {x: 0, y: 0, crop: "wheat"}, T).ok);
  ok("  a second coop costs more", F.houseCost("coop", 1).coins > F.houseCost("coop", 0).coins && F.houseCost("coop", 1).needs.wood > 10);
  ok("  only chickens live in a coop", !F.act(s, "buyanimal", {x: 0, y: 0, animal: "cow"}, T).ok);
  for (let i = 0; i < 6; i++) s = F.act(s, "buyanimal", {x: 1, y: 0, animal: "chicken"}, T).state;
  ok("  buy chickens (click any of its tiles) -- six to a coop", s.tiles["0,0"].house.animals.length === 6 && /full/.test(F.act(s, "buyanimal", {x: 0, y: 0, animal: "chicken"}, T).error));
  ok("  a new animal is hungry", F.view(s, T).houses[0].hungry === 6);
  r = F.act(s, "gather", {x: 0, y: 0}, T);
  ok("  nothing to collect from a hungry hen", !r.ok);
  s.silo.wheat = 5;
  r = F.act(s, "feed", {x: 0, y: 0}, T);
  ok("  feed them from your silos (2 wheat each): as many as there's wheat for", r.ok && r.state.silo.wheat === 1 && F.view(r.state, T).houses[0].working === 2
    && /out of wheat/.test(r.msg), r.msg);
  s = r.state;
  ok("  eggs take 30 minutes", !F.act(s, "gather", {all: true}, T + 29 * M).ok);
  r = F.act(s, "gather", {all: true}, T + 30 * M);
  ok("  then collect them (2 eggs a hen), with xp; she's hungry again", r.ok && r.state.silo.egg === 4 && r.state.xp > s.xp && F.view(r.state, T + 30 * M).houses[0].hungry === 6);
  ok("  eggs don't go bad waiting", F.view(s, T + 9999 * M).houses[0].ready === 2);
  const sold = F.act(s, "sellanimal", {x: 0, y: 0, i: 0}, T);
  ok("  sell an animal back (half what she cost)", sold.ok && sold.state.coins === s.coins + 30);
  ok("  a building with animals can't come down", !F.act(s, "demolish", {x: 0, y: 0}, T).ok);
  let e = F.act(at(farm(), 6), "buy", {item: "wood", n: 10}, T).state; e.silo.wheat = 10;
  e = F.act(e, "place", {house: "coop", x: 2, y: 2}, T).state;
  const d = F.act(e, "demolish", {x: 3, y: 3}, T);
  ok("  an empty one can (half its wood back); the ground is clear", d.ok && d.state.silo.wood === 5 && !d.state.tiles["3,3"].part && !d.state.tiles["2,2"].house
    && F.act(d.state, "plant", {x: 2, y: 2, crop: "wheat"}, T).ok);
  ok("  'clear' leaves buildings alone", !F.act(e, "clear", {x: 2, y: 2}, T).ok);
}

/* ---- barns, pastures, sheep and the shearer's shed ---- */
{
  let s = at(farm(), 16); s.parcels = ["0,0", "1,0"]; s.silo = {wood: 200, sweetcorn: 20, wheat: 40, carrot: 10, cabbage: 10};
  let r = F.act(s, "place", {house: "barn", x: 0, y: 0}, T);
  ok("a barn (3x3) for cows", r.ok && r.state.tiles["2,2"].part.join() === "0,0", r.error);
  s = r.state;
  r = F.act(s, "place", {house: "pasture", x: 4, y: 0}, T);
  ok("a pasture (3x3) for goats and sheep", r.ok, r.error);
  s = r.state;
  ["cow", "cow"].forEach((a) => { s = F.act(s, "buyanimal", {x: 0, y: 0, animal: a}, T).state; });
  ["goat", "sheep"].forEach((a) => { s = F.act(s, "buyanimal", {x: 4, y: 0, animal: a}, T).state; });
  ok("  goats and sheep share the pasture; cows can't go in it", s.tiles["4,0"].house.animals.length === 2 && !F.act(s, "buyanimal", {x: 4, y: 0, animal: "cow"}, T).ok);
  r = F.act(s, "feed", {all: true}, T);
  ok("  'feed all' feeds every building: cows eat wheat, goats carrots, sheep cabbage", r.ok && r.state.silo.wheat === 32 && r.state.silo.carrot === 8 && r.state.silo.cabbage === 9, r.msg);
  s = r.state;
  r = F.act(s, "gather", {all: true}, T + 240 * M);
  ok("  milk and goat's milk come in -- but wool needs a shearer's shed", r.ok && r.state.silo.milk === 6 && r.state.silo.goatmilk === 1 && !r.state.silo.wool && /shearer/.test(r.msg), r.msg);
  s = r.state;
  ok("  the sheep waits, ready", F.view(s, T + 240 * M).houses[1].animals.find((a) => a.kind === "sheep").stuck);
  r = F.act(s, "build", {what: "shearshed"}, T + 240 * M);
  ok("  build the shearer's shed (level 16, wood and coins)", r.ok && r.state.shearshed, r.error);
  r = F.act(r.state, "gather", {all: true}, T + 241 * M);
  ok("  then shear her: wool", r.ok && r.state.silo.wool === 3, r.error);
}

/* ---- the dairy and the sewing room ---- */
{
  let s = at(farm(), 11); s.silo = {wood: 100, milk: 20, strawberry: 10, cotton: 20, egg: 10, cabbage: 4, wheat: 10};
  ok("the dairy needs building", /level 1 dairy/.test(F.act(s, "cook", {recipe: "butter"}, T).error));
  s = F.act(s, "build", {what: "dairy"}, T).state;
  ok("  built with wood and milk", s.dairy === 1 && s.silo.milk === 14);
  let r = F.act(s, "cook", {recipe: "butter"}, T);
  ok("  churn butter (30 minutes)", r.ok && r.state.cooking[0].maker === "dairy" && /Making butter/.test(r.msg), r.msg || r.error);
  s = r.state;
  ok("  one at a time in a level 1 dairy (the next is queued)", (() => { const q = F.act(s, "cook", {recipe: "butter"}, T);
     return q.ok && q.state.queue.length === 1 && q.state.queue[0].maker === "dairy" && q.state.cooking.length === 1; })());
  s = F.act(s, "build", {what: "kitchen"}, T).state; s.kitchen = 2;
  ok("  the kitchen works alongside it", F.act(s, "cook", {recipe: "omelette"}, T).ok);
  s = F.act(s, "cook", {recipe: "omelette"}, T).state;
  r = F.act(s, "collect", {maker: "dairy"}, T + 31 * M);
  ok("  collect from one workshop: only its things", r.ok && r.state.silo.butter === 1 && !r.state.silo.omelette && r.state.cooking.length === 1, r.msg);
  r = F.act(r.state, "collect", {}, T + 31 * M);
  ok("  or everything that's done", r.ok && r.state.silo.omelette === 1);
  let l = at(farm(), 9); l.silo = {wood: 10, cotton: 20};
  l = F.act(l, "build", {what: "loom"}, T).state;
  r = F.act(l, "cook", {recipe: "cloth"}, T);
  ok("the sewing room weaves cotton into cloth", l.loom === 1 && r.ok && F.act(r.state, "collect", {maker: "loom"}, T + 61 * M).state.silo.cloth === 1);
  ok("  wool sweaters and blankets need a better sewing room", F.RECIPES.sweater.tier === 2 && F.RECIPES.blanket.tier === 2 && F.RECIPES.quilt.tier === 3);
  ok("  every workshop's goods sell for a little more than what went in", Object.keys(F.RECIPES).every((id) => { const rr = F.RECIPES[id];
    const raw = Object.keys(rr.needs).reduce((n, i) => n + rr.needs[i] * F.PRICES[i], 0); return F.PRICES[id] > raw && F.PRICES[id] < raw * 1.35; }),
    Object.keys(F.RECIPES).filter((id) => { const rr = F.RECIPES[id]; const raw = Object.keys(rr.needs).reduce((n, i) => n + rr.needs[i] * F.PRICES[i], 0); return !(F.PRICES[id] > raw && F.PRICES[id] < raw * 1.35); }).join());
  ok("  everything has a name and a price", Object.keys(F.RECIPES).concat(Object.values(F.ANIMALS).map((a) => a.makes), ["wood"]).every((k) => F.PRICES[k] > 0 && F.nameOf(k) !== k));
}

/* ---- the request board, levels, old saves ---- */
{
  let s = at(farm(), 8); s.silo = {wood: 20, wheat: 20};
  s = F.act(s, "place", {house: "coop", x: 0, y: 0}, T).state;
  s = F.act(s, "buyanimal", {x: 0, y: 0, animal: "chicken"}, T).state;
  let saw = false;
  for (let i = 0; i < 40 && !saw; i++) { s.orders = []; s = F.advance(s, T + i); saw = s.orders.some((o) => o.wants.egg); }
  ok("with hens, the request board starts asking for eggs", saw);
  ok("husbandry fills the later levels: something new at every level to 24", Array.from({length: 23}, (_, i) => i + 2).every((l) => F.unlocksAt(l).length > 0),
    Array.from({length: 23}, (_, i) => i + 2).filter((l) => !F.unlocksAt(l).length).join());
  ok("  level 6 says so", F.unlocksAt(6).some((u) => /coop/.test(u)) && F.unlocksAt(6).some((u) => /Chickens/.test(u)));
  const old = farm(); old.cooking = [{recipe: "bread", at: T, until: T + 20 * M, done: false}]; delete old.dairy;
  const n = F.advance(old, T + 21 * M);
  ok("an old farm carries on: its kitchen's cooking still finishes; no dairy yet", n.cooking[0].maker === "kitchen" && n.cooking[0].done && n.dairy === 0 && n.loom === 0 && !n.shearshed);
  const v = F.view(at(farm(), 1), T);
  ok("the view: buildings to place, animals to buy, workshops", v.houseShop.length === 3 && v.animalShop.length === 4 && v.makers.map((m) => m.id).join() === "kitchen,dairy,loom,mill");
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
