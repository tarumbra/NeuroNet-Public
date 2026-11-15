/* ==========================================================================
   NeuroFarm: the workshops' queues and the kitchen's extra stoves (2026-10-09).
   ==========================================================================
   Cam: "add queing in the farm and the ability to upgrade kitchen by adding
   extra stoves so you can cook more then one thing at once."

   A workshop with no room queues what you pick (up to QUEUE_MAX): what it takes
   comes out of the silos then, and it starts by itself the moment there's room
   -- even while you're away. Taking one out gives it all back. A stove is one
   more thing cooking at once (the kitchen's level still decides the recipes).
   The game's own rules (ui/farm/farmcore.js) on made-up farms.
   ========================================================================== */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "farm", "farmcore.js"), "utf8"), ctx);
const F = ctx.window.FarmCore || ctx.FarmCore;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const T = Date.UTC(2026, 9, 9, 9), M = 60e3;
function farm(o = {}) {
  const s = F.act(F.empty(), "start", {farmer: "Tester"}, T).state;
  return Object.assign(s, {xp: F.XP[o.level || 10], coins: 50000, kitchen: o.kitchen == null ? 1 : o.kitchen, silo: Object.assign({wheat: 60, wood: 60}, o.silo || {})});
}
const kit = (s) => F.view(s, T).makers.find((m) => m.id === "kitchen");
const cook = (s, r = "bread", at = T) => F.act(s, "cook", {recipe: r}, at);

console.log("\nNeuroFarm: queues and stoves\n");

{
  let s = cook(farm()).state;
  const r = cook(s);
  ok("no room: what you pick is queued, not refused", r.ok && /queued/.test(r.msg) && r.state.queue.length === 1, r.error || r.msg);
  ok("  and what it takes comes out of the silos now", r.state.silo.wheat === 54);
  s = cook(r.state).state;
  ok("  the view shows the queue, in order", kit(s).queue.map((q) => q.recipe).join() === "bread,bread" && kit(s).free === 0);
  const a = F.advance(s, T + 45 * M);
  ok("while you're away, each starts the moment there's room (bread at 0, 20 and 40 minutes)",
     a.queue.length === 0 && a.cooking.filter((c) => c.done).length === 2 && a.cooking.find((c) => !c.done).at === T + 40 * M,
     JSON.stringify(a.cooking.map((c) => [(c.at - T) / M, c.done])));
  const u = F.act(s, "unqueue", {maker: "kitchen", i: 1}, T);
  ok("take one out of the queue: all it took comes back", u.ok && u.state.queue.length === 1 && u.state.silo.wheat === s.silo.wheat + 3, u.error);
  ok("  (a stale one says so)", !F.act(s, "unqueue", {maker: "kitchen", i: 5}, T).ok);
  let f = s;
  while (f.queue.length < F.QUEUE_MAX) f = cook(f).state;
  const full = cook(f);
  ok(`a queue holds ${F.QUEUE_MAX}; then it says it's full (and takes nothing)`, !full.ok && /full/.test(full.error) && f.silo.wheat === full.state.silo.wheat);
  ok("each workshop has its own queue", kit(f).queue.length === F.QUEUE_MAX && F.view(f, T).makers.find((m) => m.id === "dairy").queue.length === 0);
}
{
  let s = cook(cook(farm()).state).state;
  s.potions = {instanttonic: 1};
  const r = F.act(s, "potion", {potion: "instanttonic", maker: "kitchen"}, T + 5 * M);
  ok("an Instant tonic finishes one, and the next in the queue starts", r.ok && r.state.queue.length === 0 && r.state.cooking.filter((c) => !c.done).length === 1);
}
{
  const s = farm({level: 2});
  ok("stoves are for the kitchen", F.view(s, T).makers.filter((m) => m.stoves).map((m) => m.id).join() === "kitchen" && F.STOVES.length - 1 === 4);
  ok("  a stove needs its farm level", !F.act(s, "build", {what: "stove"}, T).ok);
  ok("  and a kitchen", !F.act(farm({kitchen: 0}), "build", {what: "stove"}, T).ok);
  let k = cook(cook(farm()).state).state;
  const coins = k.coins, r = F.act(k, "build", {what: "stove"}, T + M);
  ok("add a stove: one more thing cooking at once -- and the queue's next starts on it", r.ok && kit(r.state).slots === 2 && r.state.queue.length === 0
     && r.state.cooking.filter((c) => !c.done).length === 2, r.error || r.msg);
  ok("  it costs coins and wood", r.state.coins === coins - F.STOVES[1].coins && r.state.silo.wood === 60 - F.STOVES[1].needs.wood);
  let all = farm({level: 30, silo: {wood: 200}});
  for (let i = 1; i < F.STOVES.length; i++) all = F.act(all, "build", {what: "stove"}, T).state;
  ok("  four extra stoves at most", all.stoves === 4 && !F.act(all, "build", {what: "stove"}, T).ok && kit(all).slots === 5);
  ok("the kitchen's level still decides the recipes (a stove doesn't open them)", !F.act(all, "cook", {recipe: "pumpkinpie"}, T).ok);
  let up = cook(cook(farm({silo: {potato: 10, carrot: 10}})).state).state;
  up = F.act(up, "build", {what: "kitchen"}, T).state;
  ok("upgrading a workshop starts its queue too", up.kitchen === 2 && up.queue.length === 0 && up.cooking.length === 2);
}
{
  const old = F.advance({v: 1, game: "neurofarm", log: [], made: true, kitchen: 1, cooking: []}, T);
  ok("an older save gets no stoves and an empty queue", old.stoves === 0 && Array.isArray(old.queue) && old.queue.length === 0);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
