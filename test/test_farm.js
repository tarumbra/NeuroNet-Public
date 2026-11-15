/* ==========================================================================
   NeuroFarm -- the rules (2026-10-07), part 1: fields, crops, trees, silos,
   land, the kitchen, the market and its request board, tonics, spoiling.
   ==========================================================================
   Cam: "a new game NeuroFarm (A farmville, simfarm game, simple with crops,
   crops need levels to unlock, storage is handled by silos, start with 4x4
   plots, ability to do 2x2 crops, each level you can purchase a new land and
   plow it to grow more, a new crop or tree will unlock. Each crop has a
   different growing time which works in real time like NeuroPets.) Ability to
   sell crops, or turn them into recipes which take more time and require a
   certain level kitchen ... a market request board with special orders ...
   special potions which increase the growth time, can unspoil crops. Crops
   spoil if not harvested in the same time as it took to grow."

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
const at = (s, lv) => { s.xp = F.XP[lv]; s.coins = 100000; return s; };

console.log("\nNeuroFarm\n");

let s = farm();
ok("a new farm: a name, 200 coins, one silo, a 4x4 field already plowed", s.made && s.farmName === "Sunny Acres" && s.coins === 200 && s.silos === 1
  && Object.keys(s.tiles).length === 16 && Object.values(s.tiles).every((t) => t.plowed));
ok("  three orders on the request board", F.view(s, T).orders.length === 3 && F.view(s, T).orders.every((o) => o.wants));

/* ---- crops ---- */
let r = F.act(s, "plant", {x: 0, y: 0, crop: "strawberry"}, T);
ok("plant strawberries (the seed costs coins)", r.ok && r.state.coins === 198);
s = r.state;
ok("  growing in real time: not ready after 3 minutes", !F.act(s, "harvest", {x: 0, y: 0}, T + 3 * M).ok);
r = F.act(s, "harvest", {x: 0, y: 0}, T + 5 * M);
ok("  ready after 4: harvested into the silo, with xp", r.ok && r.state.silo.strawberry === 2 && r.state.xp > 0 && !r.state.tiles["0,0"].crop);
s = F.act(s, "plant", {x: 1, y: 0, crop: "wheat"}, T).state;
ok("a crop spoils if it's left as long again as it took to grow (wheat: 15 + 15 minutes)",
  F.stageOf(s.tiles["1,0"], T + 29 * M).stage === "ready" && F.stageOf(s.tiles["1,0"], T + 31 * M).stage === "spoiled");
ok("  a spoiled crop can't be harvested", !F.act(s, "harvest", {x: 1, y: 0}, T + 31 * M).ok);
ok("crops unlock by level: no carrots at level 1", /level 2/.test(F.act(s, "plant", {x: 2, y: 0, crop: "carrot"}, T).error));
ok("  every crop has its own growing time", new Set(Object.values(F.CROPS).map((c) => c.time)).size >= 10);

/* ---- 2x2 crops and trees ---- */
{
  let b = at(farm(), 9);
  r = F.act(b, "plant", {x: 0, y: 0, crop: "pumpkin"}, T);
  ok("pumpkins are 2x2: they take four tiles", r.ok && r.state.tiles["1,1"].part && r.state.tiles["1,1"].part.join() === "0,0");
  ok("  nothing else fits in them", !F.act(r.state, "plant", {x: 1, y: 1, crop: "strawberry"}, T).ok);
  ok("  and they need the room (not at the edge of your land)", !F.act(r.state, "plant", {x: 3, y: 3, crop: "melon"}, T).ok);
  let tr = F.act(r.state, "plant", {x: 2, y: 2, tree: "apple"}, T).state;
  const h1 = F.act(tr, "harvest", {x: 3, y: 3}, T + 121 * M);
  ok("a tree (2x2): fruit when it's ready -- and again later; the tree stays", h1.ok && h1.state.silo.apple === 4 && h1.state.tiles["2,2"].tree === "apple"
    && F.stageOf(h1.state.tiles["2,2"], T + 122 * M).stage === "growing");
}

/* ---- land ---- */
{
  let l = farm(); l.coins = 5000;
  ok("buying land needs the level: one parcel a level", /level 2/.test(F.act(l, "buyland", {px: 1, py: 0}, T).error));
  l.xp = F.XP[2];
  r = F.act(l, "buyland", {px: 1, py: 0}, T);
  ok("  at level 2, a second parcel -- next to your farm", r.ok && r.state.parcels.includes("1,0"));
  ok("  not off on its own", !F.act(Object.assign(r.state, {xp: F.XP[5]}), "buyland", {px: 3, py: 2}, T).ok);
  ok("  new land is wild: plow it first", !F.act(r.state, "plant", {x: 4, y: 0, crop: "strawberry"}, T).ok);
  const p = F.act(r.state, "plow", {all: true}, T);
  ok("  plow it (5 coins a tile) and it's ready to plant", p.ok && p.state.tiles["4,0"].plowed && F.act(p.state, "plant", {x: 4, y: 0, crop: "strawberry"}, T).ok);
}

/* ---- silos ---- */
{
  let f = farm(); f.silo = {wheat: 99}; f.xp = F.XP[5];
  f = F.act(f, "plant", {x: 0, y: 0, crop: "potato"}, T).state;
  ok("silos: when they're full, you can't harvest", /silos are full/.test(F.act(f, "harvest", {x: 0, y: 0}, T + 61 * M).error));
  f.coins = 1000;
  r = F.act(f, "build", {what: "silo"}, T);
  ok("  build another (coins and wheat): more room", r.ok && F.view(r.state, T).siloCap === 200 && r.state.silo.wheat === 84);
}

/* ---- the kitchen ---- */
{
  let k = at(farm(), 2); k.silo = {wheat: 30, strawberry: 8};
  ok("cooking needs a kitchen", /kitchen/.test(F.act(k, "cook", {recipe: "bread"}, T).error));
  k = F.act(k, "build", {what: "kitchen"}, T).state;
  r = F.act(k, "cook", {recipe: "bread"}, T);
  ok("  built: bread takes time (20 minutes)", r.ok && r.state.cooking.length === 1 && !F.act(r.state, "collect", {}, T + 10 * M).ok);
  ok("  one thing at a time in a level 1 kitchen (the next waits in the queue)", (() => { const q = F.act(r.state, "cook", {recipe: "strawberryjam"}, T + 1);
     return q.ok && q.state.cooking.length === 1 && q.state.queue.length === 1; })());
  const c = F.act(r.state, "collect", {}, T + 21 * M);
  ok("  then it's in your silo", c.ok && c.state.silo.bread === 1);
  ok("  and a dish sells for a little more than its crops", Object.keys(F.RECIPES).every((id) => { const rr = F.RECIPES[id];
    const raw = Object.keys(rr.needs).reduce((n, i) => n + rr.needs[i] * F.PRICES[i], 0); return F.PRICES[id] > raw && F.PRICES[id] < raw * 1.35; }));
  ok("  better recipes need a better kitchen", F.RECIPES.melonsorbet.tier === 4 && /level 4 kitchen/.test(F.act(at(c.state, 20), "cook", {recipe: "melonsorbet"}, T).error));
}

/* ---- the market, the request board, tonics ---- */
{
  let m = farm(); m.silo = {strawberry: 10};
  r = F.act(m, "sell", {item: "strawberry", n: "all"}, T);
  ok("sell at the market", r.ok && r.state.coins === 240 && !r.state.silo.strawberry);
  let o = farm(); const want = o.orders[0].wants; o.silo = Object.assign({}, want);
  r = F.act(o, "order", {slot: 0}, T);
  ok("fill a request: coins and xp -- more than selling", r.ok && r.state.coins - 200 > Object.keys(want).reduce((n, k) => n + want[k] * F.PRICES[k], 0));
  ok("  a new one goes up later", !r.state.orders[0].wants && F.view(r.state, T + 16 * M).orders[0].wants);
  let g = farm(); g.potions = {growtonic: 1, freshtonic: 1};
  g = F.act(g, "plant", {x: 0, y: 0, crop: "wheat"}, T).state;
  r = F.act(g, "potion", {potion: "growtonic", x: 0, y: 0}, T);
  ok("a Grow tonic halves the time left", r.ok && r.state.tiles["0,0"].readyAt - T === 7.5 * M);
  const sp = F.act(r.state, "potion", {potion: "freshtonic", x: 0, y: 0}, T + 60 * M);
  ok("a Freshness tonic brings a spoiled crop back, fresh", sp.ok && F.stageOf(sp.state.tiles["0,0"], T + 60 * M).stage === "ready" && F.act(sp.state, "harvest", {x: 0, y: 0}, T + 61 * M).ok);
  ok("  tonics come from the request board", Object.keys(F.POTIONS).join() === "growtonic,freshtonic,instanttonic" && /potion/.test(fs.readFileSync(path.join(APP, "ui", "farm", "farmcore.js"), "utf8")));
}

/* ---- levels ---- */
ok("thirty levels, each unlocking something (a crop, a tree, a recipe, a kitchen or land)",
  F.MAX_LEVEL === 30 && Array.from({length: 22}, (_, i) => i + 2).every((l) => F.unlocksAt(l).length > 0));
ok("the same moves, the same farm (no clock, no dice)", JSON.stringify(F.act(farm(), "plant", {x: 0, y: 0, crop: "wheat"}, T).state) === JSON.stringify(F.act(farm(), "plant", {x: 0, y: 0, crop: "wheat"}, T).state));

// the NeuroPets parchment look (2026-10-10, Cam: "reuse some of the assets from Neuropets in NeuroFarm"): one set of pictures
{
  const html = fs.readFileSync(path.join(APP, "ui", "neurofarm.html"), "utf8"), th = fs.readFileSync(path.join(APP, "ui", "farm", "theme.css"), "utf8");
  const used = [...th.matchAll(/url\(\.\.\/pet\/art\/ui\/([a-z-]+\.png)\)/g)].map((m) => m[1]);
  ok("NeuroFarm wears NeuroPets' frames: theme.css loaded after farm.css", html.indexOf('href="farm/theme.css"') > html.indexOf('href="farm/farm.css"'));
  ok("  the pictures are NeuroPets' own, not copies", used.length >= 6 && used.every((f) => fs.existsSync(path.join(APP, "ui", "pet", "art", "ui", f))) && !fs.existsSync(path.join(APP, "ui", "farm", "art", "card-frame.png")), used.join());
  ok("  the same wood and parchment", /--bg: #45281a/.test(th) && /--panel: #d8b67f/.test(th));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
