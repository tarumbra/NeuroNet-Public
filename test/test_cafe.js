/* NeuroCafe's rules (2026-10-20, V19: the Stage 1 demo) -- ui/cafe/cafecore.js.
   Run: node test/test_cafe.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "cafe", "cafecore.js"), "utf8"), ctx);
const C = ctx.window.CafeCore;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 20, 9);
const S = C.SEC;
const A = (s, a, o, t) => C.act(s, a, o || {}, t);
// (2026-11-08) dividers aren't sold any more (half walls took their place): a test that needs one placed gets it from
// storage, as an old save has it
const stock = (s, kind) => { const q = JSON.parse(JSON.stringify(s)); q.hwMoved = true; q.ware = Object.assign({}, q.ware, {[kind]: ((q.ware || {})[kind] || 0) + 1}); return {ok: true, state: q}; };
// (2026-11-07) the happenings are off for the rules' tests -- they'd turn up in any long stretch away; live() has them on
const open = (t) => { const s = A(C.empty(), "start", {name: "Test Café"}, t || T0).state; s.prefs = Object.assign({}, s.prefs, {happen: false}); return s; };
const skipped = (t) => A(open(t), "skipTutorial", {}, t || T0).state;
const stove = (s) => s.items.find((i) => i.kind === "stove");
// the start before 2026-10-21 (a one-tile serving counter at (3,1)) -- for the layout tests written round it
const classic = (s) => { s.items = s.items.map((i) => i.kind === "buffet" && i.uid === 2 ? {uid: 2, kind: "counter", x: 3, y: 1, dir: 0} : i); return s; };
// the first plate on the first counter: a serving counter is its own plate; a new café's buffet counter has two
const live = (t) => { const s = skipped(t); delete s.prefs.happen; return s; };
const counter = (s) => { const c = s.items.find((i) => i.kind === "counter" || i.kind === "buffet"); return c && (c.kind === "buffet" ? c.plates[0] : c); };

console.log("\nThe dishes\n");
{
  const order = C.DISHES.filter((d) => !d.secret && C.cookerOf(d) === "stove" && !d.brew).slice().sort((a, b) => a.level - b.level).map((d) => d.secs);
  ok("the first eight dishes, by level: 10 s, 2 min, 90 s, 2 h, 10 min, 5 min, 6 h (Cam, 25 Oct: the cabbage soup), 45 s -- not in time order (V19 q5)", order.slice(0, 8).join() === "10,120,90,7200,600,300,21600,45", order.join());
  // 2026-10-23 (Cam): from level 4 a mix of times -- every ten levels from 4 has something quick, short, middling, long and overnight
  const band = (s) => s <= 60 ? 0 : s <= 600 ? 1 : s < 3600 ? 2 : s < 6 * 3600 ? 3 : 4;
  ok("  from level 4, every ten levels has a quick (a minute or less), a short, a middling, a long (1-5 h) and an overnight (6 h+) dish",
     [4, 14, 24, 34, 44, 54, 64, 74, 84].every((lo) => new Set(C.DISHES.filter((d) => !d.secret && d.level >= lo && d.level < lo + 10 + (lo > 30 ? 10 : 0)).map((d) => band(d.secs))).size === 5)
     && C.DISHES.filter((d) => !d.secret && d.level <= 7).some((d) => d.secs >= 6 * 3600));
  const first = (m) => Math.min(...C.DISHES.filter((d) => (d.menu || "breakfast") === m).map((d) => d.level));
  ok("  every menu starts early (2026-10-22): breakfast at 1, lunch 3, bakery & teas 5, dinner 7", first("breakfast") === 1 && first("lunch") === 3 && first("bakery") === 5 && first("dinner") === 7);
  ok("  a new dish at every level to 30, and each menu keeps opening dishes after", Array.from({length: 30}, (_, i) => i + 1).every((l) => C.DISHES.filter((d) => d.level === l && !d.secret && !d.brew && C.cookerOf(d) === "stove").length === 1)
     && C.MENUS.filter((m) => m.id !== "aunty" && m.id !== "halloween" && !m.bar).every((m) => C.DISHES.some((d) => (d.menu || "breakfast") === m.id && d.level > 30)));
  ok("  a serving's price follows its level: 4 at 1, 13 at 30, about 22 at 100", C.DISH.pancakes.price === 4 && C.DISH.starfruitpie.price === 13 && C.DISHES.every((d) => d.price >= 4 && d.price <= 24));
  ok("  Lunch: eight dishes on their own menu (V22 q6)", C.DISHES.filter((d) => d.menu === "lunch").length === 8 && C.MENUS.some((m) => m.id === "lunch"));
  ok("  sixteen breakfasts, and every dish painted cooking, served and burnt (V22)", C.DISHES.filter((d) => !d.menu).length === 16
     && C.DISHES.every((d) => (d.secret ? ["dish"] : ["cook", "dish", "burnt"]).every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", `${k}-${d.id}.webp`)))));
  ok("servings follow the curve (about 10 x minutes^0.55): longer makes more, the 10 second dish very few",
     C.DISH.pancakes.servings === 4 && C.DISH.caesarsalad.servings === 10 && C.DISH.honeycake.servings === 95 && C.DISH.florentine.servings === 65);
  ok("  but slower than time: an hour's dish isn't 360 times a 10 second one", C.DISH.honeycake.servings / C.DISH.pancakes.servings < 30);
  ok("every dish makes a profit, and costs less than its servings sell for", C.DISHES.filter((d) => !d.brew).every((d) => d.cost > 0 && d.cost < d.servings * d.price));
  ok("XP rises with the time (up to level 30; past it, higher dishes give more as well)", C.DISHES.filter((d) => d.level <= 30 && !d.brew).sort((a, b) => a.secs - b.secs).every((d, i, a) => !i || d.xp >= a[i - 1].xp));
}

console.log("\nA new café\n");
{
  const s = open();
  ok("4x4, grey floor, the door in the left wall", s.size === 4 && s.floor === "grey" && s.door >= 0 && s.door < 4);
  ok("one stove, one buffet counter (two dishes at once, 2026-10-21) and the cash register already placed", ["stove", "buffet", "till"].every((k) => s.items.filter((i) => i.kind === k).length === 1));
  ok("  every counter and the till can be reached from the door", !C.layoutProblem(s, s.items));
  ok("named as asked", s.name === "Test Café");
  ok("the tutorial is on", C.view(s, T0).tut.id === "cook");
  ok("junk isn't a café", !C.normal({pet: 1}).made && C.normal(null).game === "neurocafe");
}

console.log("\nThe tutorial (cook, serve, clean, money -> level 2)\n");
{
  let s = open(), t = T0;
  ok("only the pancakes during the tutorial", !A(s, "cook", {uid: stove(s).uid, dish: "waffles"}, t).ok);
  let r = A(s, "cook", {uid: stove(s).uid, dish: "pancakes"}, t); s = r.state;
  ok("cook: pancakes on the stove, paid for", r.ok && s.coins === C.START.coins - C.DISH.pancakes.cost && C.view(s, t).tut.id === "wait");
  t += 10 * S;
  ok("ten seconds later: ready, and the chef says serve", C.view(s, t).items.find((i) => i.kind === "stove").stove.status === "ready" && C.view(s, t).tut.id === "serve");
  ok("  the tutorial's pancakes never burn", C.stoveOf(stove(s), t + 3600e3).status === "ready");
  r = A(s, "serve", {uid: stove(s).uid}, t); s = r.state;
  ok("serve: four servings on the counter, XP for it, the stove dirty", r.ok && counter(s).n === 4 && s.xp === C.DISH.pancakes.xp && stove(s).dirty && C.view(s, t).tut.id === "clean");
  r = A(s, "clean", {uid: stove(s).uid}, t); s = r.state;
  ok("clean: the chef waits for a customer", r.ok && !stove(s).dirty && C.view(s, t).tut.id === "customer");
  t += 20 * S;
  ok("a customer comes, takes a serving and pays at the till", C.view(s, t).till > 0 && C.view(s, t).till % C.DISH.pancakes.price === 0 && C.view(s, t).tut.id === "collect", JSON.stringify(C.view(s, t).tut));
  r = A(s, "collect", {}, t); s = r.state;
  const lv = r.events.find((e) => e.kind === "level");
  ok("collect: the coins are yours and the tutorial ends in a level-up", r.ok && s.till === 0 && s.tut == null && lv && lv.level === 2 && C.levelOf(s.xp) === 2);
  ok("  level 2 opens the 5x5 café, a second stove, a second counter and waffles",
     ["expand", "stove", "counter", "waffles"].every((k) => lv.unlocks.some((u) => u.id === k)), JSON.stringify(lv.unlocks));
  ok("skipping the tutorial also gives level 2", C.levelOf(skipped().xp) === 2);
}

console.log("\nCooking, burning, cleaning\n");
{
  let s = skipped(), t = T0, st = stove(s).uid;
  ok("a free stove cooks; a busy one doesn't", A(s, "cook", {uid: st, dish: "waffles"}, t).ok && !A(A(s, "cook", {uid: st, dish: "waffles"}, t).state, "cook", {uid: st, dish: "pancakes"}, t).ok);
  ok("a dish above your level waits", /level 9/.test(A(s, "cook", {uid: st, dish: "florentine"}, t).error || ""));
  s = A(s, "cook", {uid: st, dish: "waffles"}, t).state;
  ok("cooking for its time", C.stoveOf(stove(s), t + 119 * S).status === "cooking" && C.stoveOf(stove(s), t + 120 * S).status === "ready");
  ok("ready food burns if it isn't served within its own cook time", C.stoveOf(stove(s), t + 239 * S).status === "ready" && C.stoveOf(stove(s), t + 240 * S).status === "burnt");
  ok("  burnt food can't be served", !A(s, "serve", {uid: st}, t + 241 * S).ok);
  let r = A(s, "throw", {uid: st}, t + 241 * S);
  ok("  thrown away: the stove's dirty", r.ok && r.state.items.find((i) => i.uid === st).dirty && r.state.stats.burnt === 1);
  ok("  a dirty stove won't cook until it's cleaned", !A(r.state, "cook", {uid: st, dish: "pancakes"}, t + 242 * S).ok && A(A(r.state, "clean", {uid: st}, t + 242 * S).state, "cook", {uid: st, dish: "pancakes"}, t + 243 * S).ok);
  // serving stacks on a counter with the same dish; a different dish needs a free counter
  let u = skipped(), uid = stove(u).uid;
  u = A(u, "cook", {uid, dish: "pancakes"}, t).state; u = A(u, "serve", {uid}, t + 10 * S).state; u = A(u, "clean", {uid}, t + 10 * S).state;
  u = A(u, "cook", {uid, dish: "pancakes"}, t + 10 * S).state; r = A(u, "serve", {uid}, t + 20 * S);
  ok("the same dish again: added to its counter", r.ok && counter(r.state).n > 4, counter(r.state).n);
  u = A(r.state, "clean", {uid}, t + 20 * S).state; u = A(u, "cook", {uid, dish: "waffles"}, t + 20 * S).state;
  r = A(u, "serve", {uid}, t + 141 * S);
  ok("  another dish goes on the buffet counter's second plate (a new café serves two dishes at once)", r.ok && r.state.items.find((i) => i.kind === "buffet").plates[1].dish === "waffles", r.error);
  u.items.find((i) => i.kind === "buffet").plates[1] = {dish: C.DISHES[2].id, n: 3};
  r = A(u, "serve", {uid}, t + 141 * S);
  ok("  another dish with every counter taken: no room", !r.ok && /No serving counter/.test(r.error), r.error);
  // never stuck: broke, with nothing going, pancakes are free
  let b = skipped(); b.coins = 0;
  ok("broke with nothing on: the pancakes are on the house", A(b, "cook", {uid: stove(b).uid, dish: "pancakes"}, t).ok && !A(b, "cook", {uid: stove(b).uid, dish: "waffles"}, t).ok);
}

console.log("\nCustomers, and the café while you're away\n");
{
  let s = skipped(), t = T0, uid = stove(s).uid;
  s = A(s, "cook", {uid, dish: "waffles"}, t).state; s = A(s, "serve", {uid}, t + 120 * S).state;
  ok("food on the counter: customers come", C.baseRate(s) > 0 && C.view(s, t + 124 * S).customers.length >= 1);
  const later = C.advance(s, t + 3 * 3600e3);
  ok("three hours away: the counter sells out and no more", counter(later).dish === null && later.till === C.DISH.waffles.servings * C.DISH.waffles.price, later.till);
  ok("  never more than was on the counters (the Economist's cap)", later.stats.served === C.DISH.waffles.servings);
  ok("  and nobody's left waiting inside", later.customers.length === 0 && later.next == null);
  ok("the same clock gives the same café (the seed's in the save)", JSON.stringify(C.advance(s, t + 900 * S)) === JSON.stringify(C.advance(s, t + 900 * S)));
  ok("a cooking dish finishes, and burns, while you're away", C.view(A(s, "clean", {uid}, t + 121 * S).state, t + 121 * S).items.find((i) => i.uid === uid).stove.status === "free");
  // busier with more full counters and more kinds
  let m = skipped(); m.coins = 5000;
  const r1 = C.baseRate(Object.assign(C.normal(m), {items: m.items.map((i) => i.kind === "counter" ? Object.assign({}, i, {dish: "pancakes", n: 4}) : i)}));
  m = A(m, "buy", {kind: "counter"}, t).state; m = A(m, "place", {kind: "counter", x: 3, y: 0}, t).state;
  m.items.filter((i) => i.kind === "counter").forEach((c, i) => { c.dish = i ? "waffles" : "pancakes"; c.n = 10; });
  ok("two full counters with two dishes bring more customers than one", C.baseRate(m) > r1, C.baseRate(m) + " vs " + r1);
}

console.log("\nLevels and what they open\n");
{
  ok("stoves and counters: 1, then 2 at level 2, then one more every 5 levels", C.allowed("stove", 1) === 1 && C.allowed("stove", 2) === 2 && C.allowed("stove", 6) === 2 && C.allowed("counter", 7) === 3);
  ok("levels 1 to 100 (V23 q2), the first ten as before, each step bigger after; level 30 near 100,000, 100 near 1.5 million", C.levelOf(0) === 1 && C.levelOf(C.XP[10]) === 10 && C.XP[10] === 1900 && C.levelOf(1e12) === C.MAX_LEVEL && C.MAX_LEVEL === 100
     && C.XP.slice(11).every((x, i) => x - C.XP[10 + i] >= C.XP[10 + i] - C.XP[9 + i] - 50) && C.XP[30] > 80000 && C.XP[30] < 130000 && C.XP[100] > 1e6 && C.XP[100] < 2.5e6, C.XP[30] + " / " + C.XP[100]);
  ok("  something new at every level from 2 to 100", Array.from({length: 99}, (_, i) => i + 2).every((l) => C.unlocksAt(l).length > 0), Array.from({length: 99}, (_, i) => i + 2).filter((l) => !C.unlocksAt(l).length).join());
  ok("  NeuroPets' dishes: Bakery & teas and Dinner, from early on up to level 100, every one painted three ways (V23 q11)", C.DISHES.filter((d) => d.menu === "bakery").length === 14 && C.DISHES.filter((d) => d.menu === "dinner").length === 27
     && Math.max(...C.DISHES.map((d) => d.level)) === 100
     && C.DISHES.every((d) => (d.secret ? ["dish"] : ["cook", "dish", "burnt"]).every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", `${k}-${d.id}.webp`)))));
  ok("level 7: a third stove and counter", C.unlocksAt(7).filter((u) => u.kind === "thing" && ["stove", "counter"].includes(u.id)).length === 2);
}

console.log("\nBuilding: buy, place, move, turn, store, sell, grow\n");
{
  let s = skipped(), t = T0;
  s.coins = 5000;
  let r = A(s, "buy", {kind: "stove"}, t); s = r.state;
  ok("buy a stove: it waits in the warehouse", r.ok && s.ware.stove === 1 && s.coins === 5000 - C.THINGS.stove.price);
  ok("  but not a third at level 2", /level allows/.test(A(s, "buy", {kind: "stove"}, t).error || ""));
  ok("the till isn't for sale", !A(s, "buy", {kind: "till"}, t).ok);
  ok("placing on a taken tile: no", !A(s, "place", {kind: "stove", x: stove(s).x, y: stove(s).y}, t).ok);
  const e = C.entry(s);
  ok("  nor on the tile inside the door", /door/.test(A(s, "place", {kind: "stove", x: e.x, y: e.y}, t).error || ""));
  r = A(s, "place", {kind: "stove", x: 0, y: 0, dir: 1}, t); s = r.state;
  ok("placed: on the floor, out of the warehouse", r.ok && s.items.filter((i) => i.kind === "stove").length === 2 && !s.ware.stove);
  const till = s.items.find((i) => i.kind === "till");
  // wall the till in: stoves on every free side of it
  let w = JSON.parse(JSON.stringify(s));
  const blocked = w.items.concat([{uid: 98, kind: "stove", x: till.x - 1, y: till.y}, {uid: 99, kind: "stove", x: till.x, y: till.y - 1}]);
  ok("a layout that walls the till in is refused", /reach the cash register/.test(C.layoutProblem(w, blocked)), C.layoutProblem(w, blocked));
  const mv = s.items.find((i) => i.kind === "stove" && i.uid === 1);
  r = A(s, "move", {uid: mv.uid, x: 1, y: 3}, t);
  ok("move: to a free tile", r.ok && r.state.items.find((i) => i.uid === mv.uid).x === 1);
  let d = s;
  for (let i = 0; i < 4; i++) d = A(d, "rotate", {uid: mv.uid}, t).state;
  ok("turn: four ways round and back", d.items.find((i) => i.uid === mv.uid).dir === (mv.dir | 0) && A(s, "rotate", {uid: mv.uid}, t).state.items.find((i) => i.uid === mv.uid).dir === ((mv.dir | 0) + 1) % 4);
  r = A(s, "store", {uid: s.items.find((i) => i.kind === "stove" && i.x === 0).uid}, t);
  ok("store: back to the warehouse", r.ok && r.state.ware.stove === 1);
  const coins = s.coins;
  r = A(s, "sell", {uid: s.items.find((i) => i.kind === "stove" && i.x === 0).uid}, t);
  ok("sell: back for half", r.ok && r.state.coins === coins + C.THINGS.stove.price / 2);
  ok("the till stays", !A(s, "sell", {uid: till.uid}, t).ok);
  let one = skipped();
  ok("the last stove stays out", /at least one/.test(A(one, "store", {uid: stove(one).uid}, t).error || ""));
  let busy = A(skipped(), "cook", {uid: 1, dish: "pancakes"}, t).state;
  busy.coins = 5000; busy = A(busy, "buy", {kind: "stove"}, t).state; busy = A(busy, "place", {kind: "stove", x: 0, y: 0}, t).state;
  ok("a stove with a dish on it can't be put away", /Finish/.test(A(busy, "store", {uid: 1}, t).error || ""));
  ok("ware sold from the warehouse for half", (() => { const k = skipped(); k.coins = 1000; const x = A(k, "buy", {kind: "counter"}, t); const c0 = x.state.coins; const y = A(x.state, "sellWare", {kind: "counter"}, t); return y.ok && y.state.coins === c0 + 100; })());
  let g = open();
  g.coins = 5000;
  ok("a bigger café waits for level 2", /level 2/.test(A(g, "expand", {}, t).error || ""));
  g = skipped(); g.coins = 500;
  ok("  and costs 600 (2026-11-01, Cam: more expansions earlier -- was 900)", /600/.test(A(g, "expand", {}, t).error || ""));
  g.coins = 2000;
  r = A(g, "expand", {}, t);
  ok("  5x5 when you can", r.ok && r.state.size === 5 && r.state.coins === 1400 && !A(r.state, "expand", {}, t).ok);
  ok("  the rest cheaper too: 1,500 for 6x6, 16,000 for 10x10, under 650,000 for 30x30", C.EXPANSIONS[1].coins === 1500 && C.EXPANSIONS[5].coins === 16000 && C.EXPANSIONS[C.EXPANSIONS.length - 1].coins < 650000);
  ok("  and things go on the new row", A(A(r.state, "buy", {kind: "stove"}, t).state, "place", {kind: "stove", x: 4, y: 4}, t).ok);
}

console.log("\nStarting with a buffet counter (2026-10-21, Cam: two dishes at once from the start)\n");
{
  const t = T0;
  let s = open(t);
  const bu = s.items.find((i) => i.kind === "buffet");
  ok("a new café's buffet counter has two empty plates, on the floor and reachable", bu && bu.plates.length === 2 && !C.layoutProblem(s, s.items) && C.cells(bu).every((c) => c.x < s.size && c.y < s.size));
  ok("  it's the café's one counter at level 1 -- no gift on top", s.buffetGift && !s.extraCounters && !s.ware.buffet && !A(s, "buy", {kind: "counter"}, t).ok);
  // the tutorial's serve step moves on when the dish is on the buffet counter
  let r = A(s, "cook", {uid: 1, dish: "pancakes"}, t); r = A(r.state, "serve", {uid: 1}, t + 10 * S);
  ok("  the tutorial's serve step moves on with the dish on the buffet", r.ok && C.view(r.state, t + 10 * S).tut.id === "clean", JSON.stringify(C.view(r.state, t + 10 * S).tut));
  let k = skipped(t); k.coins = 5000;
  ok("  at level 2 a second counter can be bought, as before", A(k, "buy", {kind: "counter"}, t).ok);
  // a café started before: one more SERVING counter, once (Cam: "only wanted a normal counter")
  let old = classic(skipped(t)); delete old.buffetGift; delete old.counterGift; old.coins = 5000;
  const g = C.normal(old);
  ok("a café started before gets a serving counter in the warehouse, on top of its level's counters", g.ware.counter === 1 && !g.ware.buffet && g.extraCounters === 1 && g.buffetGift && g.counterGift);
  ok("  only once", C.normal(g).ware.counter === 1 && C.normal(g).extraCounters === 1);
  r = A(old, "place", {kind: "counter", x: 1, y: 2, dir: 0}, t);
  ok("  it can be placed", r.ok, r.error);
  ok("  and the level's own second counter can still be bought", A(r.state, "buy", {kind: "counter"}, t).ok && C.view(r.state, t).shop.find((x) => x.kind === "counter").allowed === 3);
  // a café that 1.0.127 gave a buffet counter: swapped for a serving counter while it's still stored
  let o127 = classic(skipped(t)); delete o127.counterGift; o127.extraCounters = 1; o127.ware = {buffet: 1};
  const sw = C.normal(o127);
  ok("  1.0.127's gift buffet, still stored, becomes a serving counter", sw.ware.counter === 1 && !sw.ware.buffet && sw.extraCounters === 1);
  ok("  a new café gets no gift", !C.normal(open(t)).ware.counter && !C.normal(open(t)).extraCounters);
}

console.log("\nUpgrades: the fridge component and the self-cleaning stove (2026-10-21, Cam)\n");
{
  const t = T0;
  // a closed café with its one serving counter (classic) full of pancakes
  const base = () => { const b = classic(skipped(t)); b.customers = []; b.next = null; b.closed = true; b.coins = 1e5; b.xp = C.XP[10]; b.cart = C.advance(b, t).cart; b.cart.done = true; Object.assign(counter(b), {dish: "pancakes", n: 4, since: t}); return b; };   // (no request cart: it would take a dish the counters can't)
  const cookServe = (st, dish, at) => { let r = A(st, "cook", {uid: 1, dish}, at); if (!r.ok) return r; r = A(r.state, "serve", {uid: 1}, at + C.DISH[dish].secs * S); return r; };
  let r = cookServe(base(), "waffles", t);
  ok("no room on the counter and no fridge: the dish can't be served, and Upgrades is suggested", !r.ok && /fridge component/.test(r.error), r.error);
  let b = base();
  ok("the fridge component goes on counters, not stoves", !A(b, "upgrade", {uid: 1, part: "fridge"}, t).ok && !A(b, "upgrade", {uid: 2, part: "selfclean"}, t).ok);
  r = A(b, "upgrade", {uid: 2, part: "fridge"}, t);
  ok("bought for its price", r.ok && r.state.coins === b.coins - C.UPGRADES.fridge.price && r.state.items.find((i) => i.uid === 2).fridge, r.error);
  ok("  only once on a counter", !A(r.state, "upgrade", {uid: 2, part: "fridge"}, t).ok);
  ok("  not before level 2", !A(Object.assign(JSON.parse(JSON.stringify(b)), {xp: 0, tut: null}), "upgrade", {uid: 2, part: "fridge"}, t).ok);
  b = r.state;
  r = cookServe(b, "waffles", t);
  const ctr = (st) => st.items.find((i) => i.uid === 2);
  ok("with a fridge, a dish with no room on top waits under the counter", r.ok && ctr(r.state).dish === "pancakes" && ctr(r.state).under.length === 1 && ctr(r.state).under[0].dish === "waffles", r.error);
  ok("  the view shows it", C.view(r.state, t + 200 * S).items.find((i) => i.uid === 2).under[0].dish.id === "waffles" && C.view(r.state, t + 200 * S).items.find((i) => i.uid === 2).cap === 1);
  let f = r.state;
  f = A(f, "clean", {uid: 1}, t + 200 * S).state;
  r = cookServe(f, "waffles", t + 200 * S);
  ok("  the same dish again stacks under it", r.ok && ctr(r.state).under.length === 1 && ctr(r.state).under[0].n === 2 * C.DISH.waffles.servings, r.error);
  f = A(r.state, "clean", {uid: 1}, t + 400 * S).state;
  r = cookServe(f, "frenchtoast", t + 400 * S);
  ok("  one dish under a serving counter -- a third kind has no room", !r.ok && /fridges/.test(r.error), r.error);
  // the top sells out: the cold dish goes up
  let g = JSON.parse(JSON.stringify(f)); g.closed = false; g.next = t + 401 * S;
  let later = g;
  for (let m = 1; m < 600 && ctr(later).under.length; m++) later = C.advance(g, t + 401 * S + m * 60 * S);
  ok("when the top sells out, the dish from under goes up", ctr(later).dish === "waffles" && ctr(later).n > 0 && !ctr(later).under.length && later.stats.served > f.stats.served, JSON.stringify(ctr(later)));
  ok("  and its spoil clock starts when it goes up (it doesn't spoil while cold)", ctr(later).since > t + 401 * S);
  // a sell potion empties the top: the next goes up at once
  let p = JSON.parse(JSON.stringify(f)); p.inv = {sell: 1};
  r = A(p, "usePotion", {kind: "sell", uid: 2}, t + 500 * S);
  ok("  a sell potion empties the top: the cold dish goes up at once", r.ok && ctr(r.state).dish === "waffles" && !ctr(r.state).under.length);
  // a buffet holds two under it
  let bf = base();
  bf = A(A(bf, "buy", {kind: "buffet"}, t).state, "place", {kind: "buffet", x: 1, y: 2, dir: 0}, t).state;
  const bu = bf.items.find((i) => i.kind === "buffet");
  bu.plates = [{dish: "eggsbacon", n: 3, since: t}, {dish: "frenchtoast", n: 3, since: t}];
  bf = A(bf, "upgrade", {uid: bu.uid, part: "fridge"}, t).state;
  r = cookServe(bf, "waffles", t); r = A(r.state, "clean", {uid: 1}, t + 200 * S); r = cookServe(r.state, "tomatosoup", t + 200 * S);
  const bun = r.state.items.find((i) => i.kind === "buffet");
  ok("a buffet counter's fridge holds two dishes", r.ok && bun.under.length === 2 && C.underCap(bun) === 2, r.error || JSON.stringify(bun.under));
  ok("a counter with something in its fridge can't be put away", !A(f, "store", {uid: 2}, t).ok);
  // stored or sold: the fridge comes out as a spare part, fitted free next time
  let q = base(); q.xp = C.XP[2]; q = A(A(q, "buy", {kind: "counter"}, t).state, "place", {kind: "counter", x: 1, y: 2, dir: 0}, t).state;
  const c2 = q.items.find((i) => i.kind === "counter" && i.uid !== 2).uid;
  q = A(q, "upgrade", {uid: c2, part: "fridge"}, t).state;
  q = A(q, "sell", {uid: c2}, t).state;
  ok("sold, its fridge is kept as a spare part", q.parts.fridge === 1);
  r = A(q, "upgrade", {uid: 2, part: "fridge"}, t);
  ok("  and fitted free to the next counter", r.ok && r.state.coins === q.coins && !r.state.parts.fridge);
  // the self-cleaning stove
  let sc = base(); sc.items.find((i) => i.uid === 2).dish = null; sc.items.find((i) => i.uid === 2).n = 0;
  r = A(sc, "upgrade", {uid: 1, part: "selfclean"}, t);
  ok("a self-cleaning stove, bought for its price", r.ok && r.state.coins === sc.coins - C.UPGRADES.selfclean.price && r.state.items.find((i) => i.uid === 1).selfclean);
  const x0 = r.state.xp;
  r = cookServe(r.state, "pancakes", t);
  ok("  after serving it's clean straight away, with the cleaning XP", r.ok && !r.state.items.find((i) => i.uid === 1).dirty && r.state.xp === x0 + C.DISH.pancakes.xp + C.CLEAN_XP);
  let bt = A(r.state, "cook", {uid: 1, dish: "pancakes"}, t + 20 * S).state; bt = A(bt, "throw", {uid: 1}, t + 60 * S).state;
  ok("  and after throwing a burnt dish away", !bt.items.find((i) => i.uid === 1).dirty && A(bt, "cook", {uid: 1, dish: "pancakes"}, t + 61 * S).ok);
}

console.log("\nTurning what you hold with the keys (2026-10-21, the play test team)\n");
{
  const t = T0;
  let s = classic(skipped(t)); s.coins = 5000;
  let r = A(s, "move", {uid: 1, x: 0, y: 1, dir: 3}, t);
  ok("a thing moved with a new facing lands turned", r.ok && r.state.items.find((i) => i.uid === 1).dir === 3 && r.state.items.find((i) => i.uid === 1).x === 0, r.error);
  r = A(s, "move", {uid: 1, x: 0, y: 1}, t);
  ok("  moved without one, it keeps its own", r.ok && r.state.items.find((i) => i.uid === 1).dir === s.items.find((i) => i.uid === 1).dir);
  const d0 = s.items.find((i) => i.uid === 1).dir | 0;
  ok("turning a picked thing the other way (by -1)", A(s, "rotate", {uid: 1, by: -1}, t).state.items.find((i) => i.uid === 1).dir === (d0 + 3) % 4);
  ok("  and back again", A(A(s, "rotate", {uid: 1, by: -1}, t).state, "rotate", {uid: 1}, t).state.items.find((i) => i.uid === 1).dir === d0);
  // a buffet turned while carried: its new tiles are checked where it lands
  s.xp = C.XP[3]; s = A(A(s, "buy", {kind: "buffet"}, t).state, "place", {kind: "buffet", x: 0, y: 3, dir: 0}, t).state;
  const bu = s.items.find((i) => i.kind === "buffet");
  ok("  a buffet turned to run off the floor where it lands is refused", !A(s, "move", {uid: bu.uid, x: 1, y: 3, dir: 1}, t).ok);
  // street things
  let q = A(s, "decorPlace", {id: "lamp", x: 6, y: -1, dir: 0}, t);
  const dc = q.ok && q.state.decor[q.state.decor.length - 1];
  ok("a street thing turns the other way too, and moves with a new facing", !!dc
     && A(q.state, "decorTurn", {uid: dc.uid, by: -1}, t).state.decor.find((x) => x.uid === dc.uid).dir === 3
     && (() => { const m = A(q.state, "decorMove", {uid: dc.uid, x: dc.x, y: dc.y, dir: 2}, t); return m.ok && m.state.decor.find((x) => x.uid === dc.uid).dir === 2; })(), q.error);
}

console.log("\nN49: building without the buttons (2026-10-21, Cam: release all of them)\n");
{
  const t = T0;
  let s = classic(skipped(t)); s.coins = 20000; s.xp = C.XP[4];
  s = A(A(s, "buy", {kind: "table"}, t).state, "place", {kind: "table", x: 1, y: 3, dir: 0}, t).state;
  const ch = Object.keys(C.THINGS).find((k) => C.THINGS[k].seat && k !== "stool");
  const d = C.autoFace(s, ch, 2, 3);
  ok("a chair put beside a table faces it by itself (i7)", d != null && C.seatTable(s, {x: 2, y: 3, dir: d}) && C.seatTable(s, {x: 2, y: 3, dir: d}).kind === "table", d);
  ok("  with no table beside it, it's left as you turned it", C.autoFace(s, ch, 3, 2) === null && C.autoFace(s, "stove", 2, 3) === null);
  let r = A(s, "cook", {uid: 1, dish: "pancakes"}, t);
  ok("a stove remembers the dish it cooked last (i9: same again)", r.state.items.find((i) => i.uid === 1).last === "pancakes" && C.view(r.state, t).items.find((i) => i.uid === 1).last === "pancakes");
}

console.log("\nThe clock and the rushes (2026-10-21, Cam)\n");
{
  const at = (h, m) => { const d = new Date(T0); d.setHours(h, m || 0, 0, 0); return d.getTime(); };
  ok("five rushes: breakfast, lunch, dinner, the late-night snack run and the midnight run", C.RUSHES.map((r) => r.id).join() === "breakfast,lunch,dinner,latenight,midnight");
  ok("  by the clock: 7:30 breakfast, 12:59 lunch, 19:00 dinner, 22:15 late-night, 0:30 midnight", C.rushAt(at(7, 30)).id === "breakfast" && C.rushAt(at(12, 59)).id === "lunch" && C.rushAt(at(19)).id === "dinner" && C.rushAt(at(22, 15)).id === "latenight" && C.rushAt(at(0, 30)).id === "midnight");
  ok("  and none between (10:00, 16:00, 23:30, 3:00; 9:00 is just after breakfast)", [at(10), at(16), at(23, 30), at(3), at(9)].every((t) => !C.rushAt(t)));
  let s = classic(skipped(T0)); s.customers = []; s.next = null;
  Object.assign(counter(s), {dish: "pancakes", n: 50, since: 0});      // (no spoil clock: fresh at any hour)
  const quiet = C.rate(s, at(10)), busy = C.rate(s, at(12, 30));
  ok("in a rush, twice the customers a minute", quiet > 0 && busy === quiet * C.RUSH_X && C.RUSH_X === 2, quiet + " / " + busy);
  ok("  the view says which rush and when it ends; and the next one when there's none", (() => { const v = C.view(s, at(12, 30)), w = C.view(s, at(10)); return v.rush && v.rush.id === "lunch" && v.rush.ends === at(14) && !w.rush && w.nextRush.rush.id === "lunch" && w.nextRush.at === at(12); })());
  ok("  the next one after the late-night run is the midnight run, tomorrow", (() => { const n = C.nextRush(at(23, 30)); const d = new Date(at(23, 30)); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); return n.rush.id === "midnight" && n.at === d.getTime(); })());
  // more customers really come: an hour of lunch against an hour mid-morning
  const run = (from) => { let x = JSON.parse(JSON.stringify(s)); x.at = from; x.clock = from; x.next = from + 2000; counter(x).n = 5000; counter(x).since = from; x = C.advance(x, from + 3600 * 1000); return x.stats.served; };
  ok("  an hour of lunch rush serves about twice the customers of an hour mid-morning", (() => { const a = run(at(10)), b = run(at(12)); return b > a * 1.5; })(), run(at(10)) + " / " + run(at(12)));
  let sb = C.sandbox(s, T0); sb = A(sb, "dev", {op: "rush"}, at(10)).state;
  ok("  the sandbox's dev tools can hold a rush on", !!C.rushAt(at(10), sb) && !C.rushAt(at(10), s));
}

console.log("\nThe buffet counter, footprints and the street (2026-10-21)\n");
{
  const t = T0;
  let s = classic(skipped());
  s.coins = 5000;
  ok("the buffet counter waits for level 3", /level 3/.test(A(s, "buy", {kind: "buffet"}, t).error || "") && C.allowed("buffet", 2) === 0 && C.allowed("buffet", 3) === C.allowed("counter", 3));
  ok("  and level 3 says it opens", C.unlocksAt(3).some((u) => u.id === "buffet"));
  s.xp = C.XP[3];
  let r = A(s, "buy", {kind: "buffet"}, t);
  ok("bought at level 3, into the warehouse", r.ok && r.state.ware.buffet === 1);
  s = r.state;
  ok("it covers two tiles: along x for turns 0 and 3, along y for 1 and 2",
     JSON.stringify(C.cells({kind: "buffet", x: 1, y: 1, dir: 0})) === '[{"x":1,"y":1},{"x":2,"y":1}]' && JSON.stringify(C.cells({kind: "buffet", x: 1, y: 1, dir: 1})) === '[{"x":1,"y":1},{"x":1,"y":2}]'
     && C.alongX(3) && !C.alongX(2));
  // the start: stove (1,0), counter (3,1), till (3,3), door at (0,2)
  ok("  not with its second tile on something", /taken/.test(A(s, "place", {kind: "buffet", x: 2, y: 1, dir: 0}, t).error || ""));
  ok("  nor hanging off the floor", /outside/.test(A(s, "place", {kind: "buffet", x: 3, y: 2, dir: 0}, t).error || ""));
  r = A(s, "place", {kind: "buffet", x: 1, y: 2, dir: 0}, t);
  ok("placed on two free tiles; nothing else can go on either", r.ok && !A(A(r.state, "buy", {kind: "stove"}, t).state, "place", {kind: "stove", x: 2, y: 2}, t).ok, r.error);
  s = r.state;
  const bu = s.items.find((i) => i.kind === "buffet");
  ok("customers walk round both its tiles", !C.path(s, {x: 0, y: 2}, {x: 2, y: 2}).slice(1, -1).some((p) => C.covers(bu, p.x, p.y)));
  ok("turning checks the new tiles: (1,2) along y needs (1,3) free", A(s, "rotate", {uid: bu.uid}, t).ok);
  // two dishes on it: the first serve fills the serving counter, the second dish the buffet, a third its other plate
  const cook = (st, dish, at) => { st.coins = 5000; const c = A(st, "cook", {uid: 1, dish}, at).state; const ready = at + C.DISH[dish].secs * S; return A(c, "serve", {uid: 1}, ready).state; };
  let f = JSON.parse(JSON.stringify(s));
  Object.assign(counter(f), {dish: "pancakes", n: 400});                // the serving counter's full: the rest goes on the buffet
  f = cook(f, "waffles", t + 20 * S);
  f = A(f, "clean", {uid: 1}, t + 200 * S).state;
  f = cook(f, "tomatosoup", t + 200 * S);
  const pl = f.items.find((i) => i.kind === "buffet").plates;
  ok("a buffet counter holds two different dishes", pl[0].dish === "waffles" && pl[1].dish === "tomatosoup", JSON.stringify(pl));
  ok("  and a dish already on it stacks there", (() => { let g = JSON.parse(JSON.stringify(f)); g.items = g.items.filter((i) => i.kind !== "till"); g.customers = [];   // no till, no customers: just the stacking
    g = A(g, "clean", {uid: 1}, t + 300 * S).state; g = cook(g, "waffles", t + 300 * S); const p = g.items.find((i) => i.kind === "buffet").plates; return p[0].dish === "waffles" && p[0].n > C.DISH.waffles.servings && p[1].dish !== "waffles"; })());
  ok("  the view shows both plates and which tiles it covers", (() => { const v = C.view(f, t + 240 * S).items.find((i) => i.kind === "buffet"); return v.plates.length === 2 && v.plates[1].dish.id === "tomatosoup" && v.cells.length === 2; })());
  ok("a counter with food on it can't be put away", /Sell what's on/.test(A(f, "store", {uid: bu.uid}, t + 240 * S).error || ""));
  // customers take from the buffet's plates too, and walk in from the street
  const later = C.advance(f, t + 12 * 3600 * S);
  ok("customers clear both plates (and no more)", later.items.find((i) => i.kind === "buffet").plates.every((p) => !p.dish) && later.stats.served === 400 + C.DISH.waffles.servings + C.DISH.tomatosoup.servings, later.stats.served);
  const mid = C.advance(f, t + 300 * S), c = mid.customers[0];   // (2026-10-24: the stricter popularity -- 3 a minute here)
  ok("a customer walks in along the pavement, from one end of the street, to the door", c && c.si && c.si[0].x === C.STREET.walk || c.si[0].y === C.STREET.walk, c && JSON.stringify(c.si));
  ok("  and the walk takes its time: at least the street's length", c && c.take - c.at >= (C.STREET.far / C.WALK) * S);
  ok("  and out to an end of the street", c && c.so && (c.so[c.so.length - 1].x === C.STREET.far || c.so[c.so.length - 1].y === C.STREET.far));
  ok("old saves' buffets get their two plates", C.normal(Object.assign({}, f, {items: f.items.map((i) => i.kind === "buffet" ? {uid: i.uid, kind: "buffet", x: i.x, y: i.y, dir: 0} : i)})).items.find((i) => i.kind === "buffet").plates.length === 2);
}

console.log("\nCustomers in groups; the sandbox and its dev tools (2026-10-21)\n");
{
  const t = T0;
  // a busy café for a day: count who walks in together
  let s = skipped();
  Object.assign(counter(s), {dish: "pancakes", n: 100000});
  const seen = {};
  for (let k = 0; k < 600; k++) { s = C.advance(s, t + k * 20 * S); s.customers.forEach((c) => { seen[c.id] = c.at; }); }
  const ats = Object.values(seen).sort((a, b) => a - b), sizes = [];
  for (let i = 0; i < ats.length;) { let j = i + 1; while (j < ats.length && ats[j] - ats[j - 1] <= C.GROUP_GAP) j++; sizes.push(j - i); i = j; }
  ok("people come in ones, twos and threes", [1, 2, 3].every((n) => sizes.includes(n)) && Math.max(...sizes) <= 3, JSON.stringify(sizes.slice(0, 30)));
  ok("  mostly ones", sizes.filter((n) => n === 1).length > sizes.length / 3);
  const gaps = []; for (let i = 1; i < ats.length; i++) if (ats[i] - ats[i - 1] > C.GROUP_GAP) gaps.push(ats[i] - ats[i - 1]);
  ok("  at uneven times", Math.max(...gaps) > 3 * Math.min(...gaps), Math.min(...gaps) + " .. " + Math.max(...gaps));

  const mine = skipped();
  ok("dev tools don't work in your café", /sandbox/.test(A(mine, "dev", {op: "coins", n: 99999}, t).error || ""));
  let b = C.sandbox(mine, t);
  ok("a sandbox is a copy of your café, marked as the sandbox", b.sandbox === true && b.items.length === mine.items.length && C.view(b, t).sandbox && !C.view(mine, t).sandbox);
  ok("  or a fresh one", C.sandbox(mine, t, true).coins === C.START.coins && C.sandbox(mine, t, true).sandbox);
  let r = A(b, "dev", {op: "level", n: 7}, t);
  ok("set the level", r.ok && C.levelOf(r.state.xp) === 7);
  r = A(b, "dev", {op: "coins", n: 12345}, t);
  ok("set the coins", r.ok && r.state.coins === 12345 && A(r.state, "dev", {op: "addCoins", n: 1000}, t).state.coins === 13345);
  r = A(b, "dev", {op: "everything"}, t);
  ok("everything unlocked: top level, a million coins, the biggest café", r.ok && C.levelOf(r.state.xp) === C.MAX_LEVEL && r.state.coins >= 1e6 && r.state.size === 30);
  b = A(r.state, "dev", {op: "instant"}, t).state;
  r = A(b, "cook", {uid: 1, dish: "eggsbacon"}, t);
  ok("instant cooking: an hour's dish is ready at once", r.ok && C.stoveOf(r.state.items.find((i) => i.uid === 1), t).status === "ready");
  let c2 = A(A(b, "dev", {op: "instant"}, t).state, "cook", {uid: 1, dish: "omelette"}, t).state;
  r = A(c2, "dev", {op: "finish"}, t + 5 * S);
  ok("finish now: what's cooking is ready, and won't burn", r.ok && C.stoveOf(r.state.items.find((i) => i.uid === 1), t + 99 * 3600 * S).status === "ready");
  r = A(b, "dev", {op: "fill"}, t);
  ok("fill the counters", r.ok && r.state.items.filter((i) => i.kind === "counter").every((i) => i.dish && i.n > 0));
  const filled = r.state;
  r = A(filled, "dev", {op: "customers", n: 3}, t);
  ok("send three customers now", r.ok && r.state.customers.length >= 3);
  r = A(filled, "dev", {op: "skip", n: 3600}, t);
  ok("an hour passes in a click: customers buy, money's in the till", r.ok && r.state.till > 0);
  ok("the café back to 4x4 only when the outer row's clear", A(C.sandbox(skipped(), t), "dev", {op: "size", n: 4}, t).ok);
}

console.log("\nCounters and buffets share a number; selling now; the sky (PT44-PT46)\n");
{
  const t = T0;
  let s = skipped();
  s.xp = C.XP[3]; s.coins = 5000;
  // level 3 allows two counters: the serving counter you have, plus one more of either kind
  let r = A(s, "buy", {kind: "buffet"}, t);
  ok("a buffet counter is one of your counters (PT46)", r.ok && /counters your level allows -- a buffet/.test(A(r.state, "buy", {kind: "counter"}, t).error || "") && /buffet/.test(A(r.state, "buy", {kind: "buffet"}, t).error || ""));
  ok("  so the shop shows them sharing one number", (() => { const v = C.view(r.state, t); const a = v.shop.find((x) => x.kind === "counter"), b = v.shop.find((x) => x.kind === "buffet"); return a.have === 2 && b.have === 2 && a.allowed === 2 && b.allowed === 2; })());
  ok("  and a level only offers 'another counter', not another buffet too", !C.unlocksAt(8).some((u) => u.id === "buffet") && C.unlocksAt(3).some((u) => u.id === "buffet"));
  let b = C.sandbox(skipped(), t);
  Object.assign(counter(b), {dish: "pancakes", n: 12});
  r = A(b, "dev", {op: "sell", dish: "pancakes"}, t);
  ok("dev tools: sell a dish now -- all its servings, the coins into the till (PT44)", r.ok && !counter(r.state).dish && r.state.till === 12 * C.DISH.pancakes.price);
  ok("  nothing of that dish: says so", /nothing like that/.test(A(b, "dev", {op: "sell", dish: "waffles"}, t).error || ""));
  ok("  sell everything", A(b, "dev", {op: "sellAll"}, t).state.till === 12 * C.DISH.pancakes.price);
  ok("the sky: clock, day, dusk or night, sandbox only (PT45)", A(b, "dev", {op: "sky", v: "night"}, t).state.dev.sky === "night" && A(b, "dev", {op: "sky", v: "x"}, t).state.dev.sky === "");
}

console.log("\nFurniture, seats, floors and the vending machine (2026-10-21, PT47)\n");
{
  const t = T0;
  let s = classic(skipped());
  s.coins = 20000; s.xp = C.XP[4];
  // the start: stove (1,0), counter (3,1), till (3,3), door at (0,2); a table at (1,3) with a chair at (2,3) turned to face it
  const put = (st, kind, x, y, dir) => { let r = A(st, "buy", {kind}, t); if (!r.ok) throw new Error(r.error); r = A(r.state, "place", {kind, x, y, dir}, t); if (!r.ok) throw new Error(r.error); return r.state; };
  s = put(s, "table", 1, 3, 0);
  s = put(s, "chair", 2, 3, 2);   // turn 2: facing up-left (-x), where the table is
  ok("a chair facing a table is a seat; turned away it isn't", C.seats(s).length === 1 && C.view(s, t).items.find((i) => i.kind === "chair").seat
     && !C.seats(A(s, "rotate", {uid: s.items.find((i) => i.kind === "chair").uid}, t).state).length);
  ok("tables, chairs and ferns come from level 2 (ferns at 1), as many as fit", C.allowed("table", 1) === 0 && C.allowed("table", 2) === 99 && C.allowed("plant", 1) === 99 && C.unlocksAt(2).some((u) => u.id === "table"));
  ok("seats bring a few more customers (comfort)", C.popularity(Object.assign({}, s, {items: s.items.map((i) => i.kind === "counter" ? Object.assign({}, i, {dish: "pancakes", n: 5}) : i)})).comfort > C.popularity(Object.assign({}, s, {items: s.items.filter((i) => i.kind !== "chair").map((i) => i.kind === "counter" ? Object.assign({}, i, {dish: "pancakes", n: 5}) : i)})).comfort);
  Object.assign(counter(s), {dish: "pancakes", n: 400});
  let sat = null, k = 0, cur = s;
  while (!sat && k++ < 200) { cur = C.advance(cur, t + k * 30 * S); sat = cur.customers.find((c) => c.seat); }
  ok("customers sit down to eat after paying: walk to the seat, eat, then leave", sat && sat.sit > sat.pay && sat.up === sat.sit + C.EAT && sat.gone > sat.up, sat && JSON.stringify([sat.pay, sat.sit, sat.up, sat.gone]));
  ok("  two never take the same seat", !cur.customers.some((c, i) => c.seat && cur.customers.some((d, j) => j !== i && d.seat === c.seat)));
  // N42: no tip in the till -- a sitter may leave a coin on the table when they get up; you pick it up
  const tbl = () => cur.items.find((i) => i.kind === "table");
  ok("  they pay just the price at the till", (() => { const o = JSON.parse(JSON.stringify(cur)); const c = o.customers.find((x) => x.id === sat.id); Object.assign(c, {took: true, paid: false, none: false, pay: o.at + 1}); o.customers = [c]; o.next = null; o.closed = true; o.till = 0; return C.advance(o, o.at + 2).till === sat.price; })());
  let tipped = 0, tries = 0, tg = cur;
  while (!tipped && tries++ < 400) { tg = C.advance(tg, t + (k + tries) * 30 * S); tipped = tg.items.find((i) => i.kind === "table").tip || 0; }
  ok("  a sitter leaves a coin on the table when they get up (most do)", tipped >= C.DINE_TIP, tries);
  const tp = A(tg, "tip", {uid: tg.items.find((i) => i.kind === "table").uid}, tg.at);
  ok("  click: the tip is yours and the table's clear", tp.ok && tp.state.coins === tg.coins + tipped && !tp.state.items.find((i) => i.kind === "table").tip && tp.events.some((e) => e.kind === "tip"));
  ok("  no tip, nothing to pick up", !A(tp.state, "tip", {uid: tp.state.items.find((i) => i.kind === "table").uid}, tg.at).ok);
  ok("  takeaway customers never leave one", (() => { let o = JSON.parse(JSON.stringify(s)); o.items = o.items.filter((i) => i.kind !== "chair"); o = C.advance(o, t + 60 * 60 * S); return !o.items.find((i) => i.kind === "table").tip; })());
  ok("  storing a table hands you its tip", (() => { const o = JSON.parse(JSON.stringify(tg)), tb = o.items.find((i) => i.kind === "table"); o.customers = []; const r2 = A(o, "store", {uid: tb.uid}, tg.at); return r2.ok && r2.state.coins === o.coins + tipped; })());
  void tbl;
  // the vending machine
  let v = A(put(s, "vending", 0, 0, 0), "setOpen", {open: false}, t).state;      // closed: just the clock's takings
  ok("people come in for the vending machine and buy (its takings grow by more than the clock)", (() => {
    let o = put(s, "vending", 0, 0, 0); o.customers = []; o.items.forEach((i) => { if (i.kind === "counter") i.dish = null; });
    const later = C.advance(o, t + 20 * 60 * S), vmIt = later.items.find((i) => i.kind === "vending");
    return (vmIt.sold || 0) > 0 && C.view(later, t + 20 * 60 * S).items.find((i) => i.kind === "vending").vend > 4 * C.VEND.coins; })());
  const vm = v.items.find((i) => i.kind === "vending");
  // (V26: the clock's takings only while the café's open -- closed, nothing builds up)
  ok("the vending machine fills nothing by the clock while the café's closed (V26)", C.view(v, t + 3 * C.VEND.every).items.find((i) => i.kind === "vending").vend === 0);
  v = JSON.parse(JSON.stringify(v)); v.closed = false; v.customers = []; v.next = t + 1e12;           // open, nobody coming in
  ok("  open, it fills its own takings by the clock", C.view(v, t + 3 * C.VEND.every).items.find((i) => i.kind === "vending").vend === 3 * C.VEND.coins);
  ok("  for 3 hours of opening, then it's run dry and takes no more (V26 q1)", (() => { const x = C.view(v, t + 10 * 3600 * S).items.find((i) => i.kind === "vending");
    return x.vend === C.REFILL.run / C.VEND.every * C.VEND.coins && x.dry; })());
  const r = A(v, "vendCollect", {uid: vm.uid}, t + 3 * C.VEND.every);
  ok("  click: the coins are yours and it starts again", r.ok && r.state.coins === v.coins + 3 * C.VEND.coins && C.view(r.state, t + 3 * C.VEND.every).items.find((i) => i.kind === "vending").vend === 0);
  // floors
  let f = A(s, "floorPaint", {id: "oak", x: 0, y: 0}, t);
  ok("a floor tile laid for its price", f.ok && f.state.floors["0,0"] === "oak" && f.state.coins === s.coins - C.FLOOR.oak.price);
  ok("  the same again costs nothing", A(f.state, "floorPaint", {id: "oak", x: 0, y: 0}, t).state.coins === f.state.coins);
  ok("  the whole floor: every tile not already that floor", A(f.state, "floorAll", {id: "oak"}, t).state.coins === f.state.coins - (s.size * s.size - 1) * C.FLOOR.oak.price);
  ok("  nicer floors wait for levels", /level 8/.test(A(s, "floorPaint", {id: "green", x: 0, y: 0}, t).error || "") && C.unlocksAt(6).some((u) => u.kind === "floor"));
}

console.log("\nWall weapons from NeuroPets (2026-10-24, the sandbox first)\n");
{
  const t = T0;
  let s = classic(skipped());
  s.coins = 100000; s.xp = C.XP[20];
  const W = C.WEAPONS, lvOf = (id) => C.PAINTING[id].level;
  ok("singles and arrangements in every metal, opening a tier at a time: bronze, iron, steel, mithril, adamant, rune",
     W.length === 52 && ["bronze", "iron", "steel", "mithril", "adamant", "rune"].every((m, i, a) => !i || lvOf("w-" + m + "sword") > lvOf("w-" + a[i - 1] + "arms") - 5 && lvOf("w-" + m + "sword") > lvOf("w-" + a[i - 1] + "sword"))
     && W.every((w) => lvOf(w.id) >= 1 && lvOf(w.id) <= C.MAX_LEVEL));
  ok("  in a tier, a single first and the shield and swords last", lvOf("w-ironsword") < lvOf("w-ironcrossed") && lvOf("w-ironcrossed") < lvOf("w-ironarms") && C.PAINTING["w-ironarms"].price > C.PAINTING["w-ironsword"].price);
  ok("won from NeuroVale only (Cam, 25 Oct): not in your café's shop till won, can't be hung, not in the level-up list",
     !C.view(s, t).weaponShop.length && /NeuroVale order first/.test(A(s, "hang", {id: "w-bronzesword", side: "l", i: 0}, t).error || "")
     && !C.unlocksAt(5).some((u) => u.id === "w-bronzesword") && C.view(s, t).vale.weapons.length === 52 && !C.view(s, t).vale.weapons.some((w) => w.got));
  { const won = JSON.parse(JSON.stringify(s)); won.vale = ["w-bronzesword"];
    ok("  once won, it's in the Buy menu and can be hung", C.view(won, t).weaponShop.length === 1 && A(won, "hang", {id: "w-bronzesword", side: "l", i: 0}, t).ok); }
  s.sandbox = true;
  const v = C.view(s, t);
  ok("  in the sandbox they're in the shop, open by level", v.weaponShop.length === 52 && v.weaponShop.find((x) => x.id === "w-steelsword").open && !v.weaponShop.find((x) => x.id === "w-runesword").open);
  const before = C.popularity(s, t).looks;
  let r = A(s, "hang", {id: "w-bronzearms", side: "r", i: 1}, t);
  ok("buy one and it hangs on a wall panel like a painting", r.ok && r.state.hang.r1 === "w-bronzearms" && r.state.coins === s.coins - C.PAINTING["w-bronzearms"].price, r.error);
  ok("  it counts towards the café's looks", C.popularity(r.state, t).looks > before);
  ok("  not a level it hasn't reached", /level 60/.test(A(s, "hang", {id: "w-runesword", side: "r", i: 2}, t).error || ""));
  const st = A(r.state, "unhang", {from: "r1"}, t);
  ok("  taken down it's stored, and hangs again free", st.ok && st.state.pware["w-bronzearms"] === 1 && A(st.state, "hang", {id: "w-bronzearms", side: "l", i: 0}, t).state.coins === st.state.coins);
}

console.log("\nSwatches: recolouring furniture (2026-10-24; in the café from the same day)\n");
{
  const t = T0;
  let s = classic(skipped());
  s.coins = 20000; s.xp = C.XP[8];
  let r = A(A(s, "buy", {kind: "lamp_blue"}, t).state, "place", {kind: "lamp_blue", x: 1, y: 3, dir: 0}, t);
  const lamp = () => r.state.items.find((i) => i.kind === "lamp_blue");
  // (released to the café 24 October: no sandbox needed)
  // (paints and the mixer, 2026-10-24: a level 8 café owns neither Red nor the mixer)
  ok("a paint that isn't yours: no; the sliders without the mixer: no; as painted: always", /Red isn't yours yet: it comes at level 12/.test(A(r.state, "tint", {uid: lamp().uid, h: 160, s: 1.8, b: 0.9, sw: "Red"}, t).error || "")
     && /paint mixer/.test(A(r.state, "tint", {uid: lamp().uid, h: 33, s: 1, b: 1}, t).error || "") && A(r.state, "tint", {uid: lamp().uid, h: 0, s: 1, b: 1}, t).ok
     && A(r.state, "tint", {uid: lamp().uid, h: 0, s: 0.55, b: 1.3, sw: "Pale"}, t).ok);
  r.state.mixer = true; r.state.paints = ["Red"];
  const red = A(r.state, "tint", {uid: lamp().uid, h: 160, s: 1.8, b: 0.9}, t);
  ok("a swatch: the thing keeps its colour (a hue turn, saturation, brightness), and the page is told", red.ok && JSON.stringify(red.state.items.find((i) => i.kind === "lamp_blue").tint) === '{"h":160,"s":1.8,"b":0.9}'
     && C.view(red.state, t).items.find((i) => i.kind === "lamp_blue").tint.h === 160);
  ok("  kept in bounds (a turn of 400 is 40; saturation 0-4, brightness 0.3-3.5)", JSON.stringify(A(red.state, "tint", {uid: lamp().uid, h: 400, s: 9, b: 0}, t).state.items.find((i) => i.kind === "lamp_blue").tint) === '{"h":40,"s":4,"b":0.3}');
  ok("  a swatch's name is kept with it (the dropper matches by it between materials)", A(red.state, "tint", {uid: lamp().uid, h: 160, s: 1.8, b: 0.9, sw: "Red"}, t).state.items.find((i) => i.kind === "lamp_blue").tint.sw === "Red"
     && !A(red.state, "tint", {uid: lamp().uid, h: 160, s: 1.8, b: 0.9, sw: "<b>"}, t).state.items.find((i) => i.kind === "lamp_blue").tint.sw);
  // 2026-10-24 (Cam: "implement for the other furniture"): every piece of furniture has a material
  const mats = {blue: ["sofa", "lamp_blue"], leather: ["armchair"], wood: ["table", "chair", "table_square", "table_coffee", "table_wood", "stool", "coatstand"], darkwood: ["bookshelf"],
                pot: ["plant", "palm"], shade: ["floorlamp"], light: ["table_garden", "chair_garden", "table_bistro"], dark: ["chair_bistro"]};
  ok("every piece of furniture can be recoloured, each by its material", Object.keys(mats).every((m) => mats[m].every((k) => C.THINGS[k].tint === m))
     && Object.keys(C.THINGS).filter((k) => C.THINGS[k].furniture && !C.THINGS[k].event).every((k) => C.THINGS[k].tint));   // (Halloween's are seasonal: no swatches)
  ok("  (Cam, 8 Nov) the stove, the milkshake counters and machine and the sushi counters take swatches too, each picture with its layer", (() => {
    const want = {stove: "enamel", shakebar: "mint", shakeshelf: "mint", shakevend: "pink", sushibar: "wood", sushishelf: "wood"}, art = path.join(APP, "ui", "cafe", "art");
    const st = red.state.items.find((i) => i.kind === "stove"), r2 = A(red.state, "tint", {uid: st.uid, h: 200, s: 1, b: 1}, t);
    return Object.keys(want).every((k) => C.THINGS[k].tint === want[k]) && r2.ok && r2.state.items.find((i) => i.uid === st.uid).tint.h === 200
      && ["stove-l", "stove-r", "stove-dirty-l", "stove-dirty-r"].concat(...["shakebar", "shakeshelf", "shakevend", "sushibar", "sushishelf"].map((k) => ["l", "r", "bl", "br"].map((s) => `${k}-${s}`)))
        .every((p) => fs.existsSync(path.join(art, p + "-fab.webp")));
  })());
  ok("  back to as painted: no tint kept", !A(red.state, "tint", {uid: lamp().uid, h: 0, s: 1, b: 1}, t).state.items.find((i) => i.kind === "lamp_blue").tint);
  ok("  only things with a fabric layer can be recoloured", Object.keys(C.THINGS).filter((k) => !C.THINGS[k].tint).every((k) => !A(Object.assign(JSON.parse(JSON.stringify(red.state)), {items: red.state.items.concat([{uid: 999, kind: k, x: 0, y: 0, dir: 0}])}), "tint", {uid: 999, h: 90}, t).ok) && C.THINGS.sofa.tint && C.THINGS.lamp_blue.tint);
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), man = fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8");
  ok("the page: the fabric drawn over the picture with the colour shift; swatches and Colour / Shade / Vivid sliders on a picked thing",
     /function fabHTML/.test(page) && page.includes("hue-rotate(${t.h}deg) saturate(${t.s}) brightness(${t.b})") && /data-tk="h"/.test(page) && /data-tk="b"/.test(page) && /data-tk="s"/.test(page)
     && ["sofa-l-fab", "sofa-r-fab", "sofa-bl-fab", "sofa-br-fab", "lamp_blue-fab"].every((k) => man.includes('"' + k + '"')));
  ok("  every furniture picture has its fabric layer", ["armchair-l", "armchair-bl", "armchair-br", "table", "chair-fl", "chair-bl", "table_square", "table_coffee", "table_wood", "stool", "coatstand", "bookshelf",
     "fern", "palm", "floorlamp", "table_garden", "chair_garden-l", "chair_garden-bl", "chair_garden-br", "table_bistro", "chair_bistro-l", "chair_bistro-bl", "chair_bistro-br"].every((k) => man.includes('"' + k + '-fab"')));
  ok("  a swatch set for every material (black iron tinted first, white paint painted through a mask); no dropper (Cam: removed)",
     ["blue", "leather", "wood", "darkwood", "pot", "shade", "light", "white", "dark"].every((m) => new RegExp(`\\b${m}: `).test(page)) && /const SEPIA = \{ dark: 1 \}, PAINT = \{ light: 1, white: 1 \}/.test(page) && /function paintCSS|const paintCSS/.test(page)
     && !/dropper/i.test(page) && !/dropper/i.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8")));
  ok("a painted piece's colour layer sits under what's on it (the fridge badge, the dish, the count) -- Cam's walnut counter", /\.nc-thing > \.nc-fab \{ z-index: 0; \}/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8"))
     && /\.nc-thing > \.nc-fab ~ :not\(\.nc-lampglow\):not\(\.nc-mglow\) \{ z-index: 1; \}/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8")));
  ok("right-click a piece (outside Build mode): your swatches in a see-through parchment pop-up by it", /function swatchPop/.test(page) && /swatchPop\(\+th\.dataset\.uid, e\.clientX, e\.clientY\)/.test(page)
     && /filter\(\(s\) => s\.mine\)/.test(page) && /\.nc-swpop \{[^}]*rgba\(244, 228, 196, \.84\)/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8")));
}

console.log("\nUnlocking paints: levels, Aunty's tins, the furniture store (2026-10-24)\n");
{
  const t = T0;
  let s = classic(skipped());
  s.coins = 50000; s.xp = C.XP[6]; s.size = 6;
  ok("a paint comes with its level; the store-only ones don't", C.hasPaint(s, "Walnut") && C.hasPaint(s, "Pale") && !C.hasPaint(s, "Cream") && !C.hasPaint(Object.assign({}, s, {xp: C.XP[100]}), "Rose")
     && C.hasPaint(Object.assign({}, s, {xp: C.XP[100]}), "Ebony") && C.hasPaint(s, "Natural"));
  ok("  sixteen paints, ten by level, every one for sale", C.PAINTS.length === 16 && C.PAINTS.filter((p) => p.level).length === 10 && C.PAINTS.every((p) => p.price > 0));
  ok("no buying paint without a furniture store on the street", /furniture store/.test(A(s, "buyPaint", {id: "Rose"}, t).error || ""));
  ok("  the store is a building (Build > Buildings), at 3,000 -- not with Outside's things", C.view(s, t).decorShop.some((d) => d.id === "furnstore" && d.building) && C.DECO.furnstore.price === 3000
     && /v\.decorShop\.filter\(\(o\) => !o\.farm && !o\.building && inCat\(o\)\)/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8")) && /\["buildings", "Buildings"\]/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8")));
  let r = A(s, "decorPlace", {id: "furnstore", x: 8, y: 2, dir: 0}, t);
  ok("  put one out (one only)", r.ok && r.state.decor.some((o) => o.id === "furnstore") && /already/.test(A(r.state, "decorPlace", {id: "furnstore", x: 2, y: 8, dir: 0}, t).error || ""), r.error);
  const b = A(r.state, "buyPaint", {id: "Rose"}, t);
  ok("then buy a paint: yours on every material", b.ok && C.hasPaint(b.state, "Rose") && b.state.coins === r.state.coins - C.PAINT_OF.Rose.price && C.view(b.state, t).paints.owned.includes("Rose"));
  ok("  not twice; not one you have by level", !A(b.state, "buyPaint", {id: "Rose"}, t).ok && /yours already/.test(A(b.state, "buyPaint", {id: "Walnut"}, t).error || ""));
  const m = A(b.state, "buyMixer", {}, t);
  ok("the paint mixer opens the sliders", m.ok && m.state.mixer && C.view(m.state, t).paints.mixer && !A(m.state, "buyMixer", {}, t).ok);
  // Aunty's box: a tin of paint you haven't got
  let tins = 0;
  for (let i = 0; i < 60 && !tins; i++) { const o = JSON.parse(JSON.stringify(s)); o.seed = 1000 + i; o.aunty = {count: 3}; o.aunty.day = null; const box = C.act(o, "dev", {op: "aunty"}, t).state.aunty.box; tins += box.gifts.filter((g) => g.kind === "paint" && !C.hasPaint(o, g.id)).length; }
  ok("Aunty's box sometimes has a tin of furniture paint you haven't got", tins > 0);
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("the page: the store's shop, locked swatches saying where they come from, the sliders only with the mixer, Aunty's tin",
     /function furnitureStore/.test(page) && /act\("buyPaint"/.test(page) && /act\("buyMixer"/.test(page) && /x\.mine \? x\.name : x\.why/.test(page) && /mixer \? `<label>Colour/.test(page)
     && /g\.kind === "paint" \? paintTin\(g\.id\)/.test(page) && fs.existsSync(path.join(APP, "ui", "cafe", "art", "prop-furnstore.webp")));
  ok("the store's catalogue is a book like the cookbook (2026-10-24): a tab for each section down its left edge, the section's pieces as pictures on the left page, the one picked with its swatches to buy on the right",
     /function bookSections/.test(page) && /function bookTabs/.test(page) && /bookTabs\(secs\.map/.test(page) && /bookTile\("bpick"/.test(page) && /const md = bookModal\(tabs, left, right, "store:" \+ bookAt\.sec, rtabs\)/.test(page)
     && /\.nc-book \{/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8")));
  ok("  the Events book too: a tab for each event, its things as pictures, the one picked on the right", /bookTabs\(cal\.map/.test(page) && /bookTile\("evpick"/.test(page) && /bookModal\(tabs, left, right, "events:" \+ evAt\)/.test(page));
  ok("the dev tools can give every paint and the mixer (the sandbox's only)", (() => { const o = A(Object.assign({}, s, {sandbox: true, dev: {}}), "dev", {op: "paints"}, t).state; return C.hasPaint(o, "Bronze") && C.view(o, t).paints.mixer; })()
     && !A(s, "dev", {op: "paints"}, t).ok);
  // counter styles (Cam, 24 October: "have them as a tab at the furniture store you can buy for your counter (they get added into the swatches)")
  ok("counters take paints (wood) and counter styles, each counter its own; the Buy menu has no Counter styles", C.THINGS.counter.tint === "wood" && C.THINGS.buffet.tint === "wood"
     && !/name: "Counter styles"/.test(page) && /act\("counterStyle", \{ uid, id: sw\.style \}\)/.test(page) && /data-cstyle=/.test(page) && /function face\(kind, dir, dirtyStove, cstyle\)/.test(page));
  const ctr = () => r2.state.items.find((i) => i.kind === "counter");
  let r2 = A(m.state, "buyCounterStyle", {id: "marble"}, t);
  ok("  buy a counter style at the store: yours for every counter", r2.ok && r2.state.owned.counters.includes("marble") && r2.state.coins === m.state.coins - C.COUNTER_STYLES.find((x) => x.id === "marble").price
     && /yours already/.test(A(r2.state, "buyCounterStyle", {id: "marble"}, t).error || "") && /furniture store/.test(A(s, "buyCounterStyle", {id: "oak"}, t).error || ""));
  const st = A(r2.state, "counterStyle", {uid: ctr().uid, id: "marble"}, t);
  ok("  one counter in it -- the others as they were", st.ok && st.state.items.find((i) => i.kind === "counter").cstyle === "marble" && C.view(st.state, t).items.find((i) => i.kind === "counter").cstyle === "marble"
     && /isn't yours/.test(A(r2.state, "counterStyle", {uid: ctr().uid, id: "slate"}, t).error || ""));
  ok("  a paint over it takes its place, and plain wood clears it", (() => { const p1 = A(Object.assign({}, st.state, {mixer: true}), "tint", {uid: ctr().uid, h: 0, s: 0.55, b: 1.3, sw: "Pale"}, t).state.items.find((i) => i.kind === "counter");
     return p1.tint && !p1.cstyle; })() && !A(st.state, "counterStyle", {uid: ctr().uid, id: "wood"}, t).state.items.find((i) => i.kind === "counter").cstyle);
  ok("  the old whole-café counter style is refused: the store's now", /furniture store/.test(A(st.state, "style", {what: "counters", id: "marble"}, t).error || ""));
  ok("  an old café's counter style goes onto each of its counters, once", (() => { const o = JSON.parse(JSON.stringify(s)); o.style = {counters: "walnut"}; o.owned = {counters: ["walnut"]};
     const n = C.normal(o); return n.items.filter((i) => i.kind === "counter" || i.kind === "buffet").every((i) => i.cstyle === "walnut") && n.style.counters === "wood"; })());
}

console.log("\nThe two-seat sofa (2026-10-24, Cam: two people sit on a sofa)\n");
{
  const t = T0;
  let s = classic(skipped());
  s.coins = 20000; s.xp = C.XP[8]; s.size = 6;
  const put = (st, kind, x, y, dir) => { let r = A(st, "buy", {kind}, t); if (!r.ok) throw new Error(r.error); r = A(r.state, "place", {kind, x, y, dir}, t); if (!r.ok) throw new Error(r.error); return r.state; };
  ok("a sofa covers two tiles, lying across the way it faces", JSON.stringify(C.cells({kind: "sofa", x: 1, y: 4, dir: 3})) === '[{"x":1,"y":4},{"x":2,"y":4}]'
     && JSON.stringify(C.cells({kind: "sofa", x: 1, y: 1, dir: 1})) === '[{"x":1,"y":1},{"x":1,"y":2}]');
  // (Cam: "remove the sofa from the main café catalogue, leave it in the sandbox")
  ok("the sofa is sandbox only: not in your café's shop, not for sale there, not in the level-up list",
     !C.view(s, t).shop.some((x) => x.kind === "sofa") && /only in the sandbox/.test(A(s, "buy", {kind: "sofa"}, t).error || "") && !C.unlocksAt(8).some((u) => u.id === "sofa"));
  s.sandbox = true;
  ok("  in the sandbox it's in the shop", C.view(s, t).shop.some((x) => x.kind === "sofa"));
  ok("the blue floor lamp is in your café's shop (it glows after dark)", (() => { const o = JSON.parse(JSON.stringify(s)); o.sandbox = false; return C.view(o, t).shop.some((x) => x.kind === "lamp_blue"); })() && C.THINGS.lamp_blue.lamp);
  s = put(s, "sofa", 1, 4, 3);     // facing up-right (-y): its two halves at (1,4) and (2,4)
  ok("  nothing else goes on its second tile", !A(A(s, "buy", {kind: "plant"}, t).state, "place", {kind: "plant", x: 2, y: 4, dir: 0}, t).ok);
  ok("  no table in front: not a seat", !C.seats(s).length);
  s = put(s, "table", 2, 3, 0);    // in front of its far half only
  ok("a table in front of either half makes it a seat for two", C.seats(s).length === 1 && C.places(C.seats(s)[0]) === 2);
  ok("  it counts as two seats for popularity", C.popularity(s, t).seatN === 2);
  const vs = C.view(s, t).items.find((i) => i.kind === "sofa");
  ok("  the page is told its two tiles and its table", vs.seat && vs.cells.length === 2 && vs.table && vs.table.x === 2 && vs.table.y === 3);
  ok("  a sofa put down beside a table faces it by itself", C.autoFace(s, "sofa", 1, 1, -1) === null
     && (() => { const o = JSON.parse(JSON.stringify(s)); o.items = o.items.filter((i) => i.kind !== "sofa"); return C.autoFace(o, "sofa", 1, 4, -1) === 3; })());
  Object.assign(counter(s), {dish: "pancakes", n: 2000});
  let both = null, k = 0, cur = s, clash = false;
  while (!both && k++ < 3000) {
    const at = t + k * 5 * S;
    cur = C.advance(cur, at);
    const on = cur.customers.filter((c) => c.seat && c.sit <= at && at < c.up);
    if (on.some((c, i) => on.some((d, j) => j !== i && d.sp === c.sp))) clash = true;
    if (on.length === 2) both = on;
  }
  ok("two customers sit on the sofa at once, one on each half", both && both[0].sp !== both[1].sp, k);
  ok("  never two on the same half", !clash);
  ok("  each walks to their own half", both && both.every((c) => { const e = c.s[c.s.length - 1], h = C.cells(cur.items.find((i) => i.kind === "sofa"))[c.sp]; return e.x === h.x && e.y === h.y; }));
  ok("  the view says which half", both && C.view(cur, t + k * 5 * S).customers.filter((c) => c.seat).map((c) => c.sp).sort().join() === "0,1");
  let tipped = 0, n = 0, tg = cur;
  while (!tipped && n++ < 400) { tg = C.advance(tg, t + (k + n) * 5 * S); tipped = tg.items.find((i) => i.kind === "table").tip || 0; }
  ok("  sofa sitters tip on the shared table, like an armchair's", tipped >= C.THINGS.sofa.tip, n);
}

console.log("\nXP from serving and cleaning (PT50), customers for variety, seats and looks (V21)\n");
{
  const t = T0;
  let s = skipped();
  const xp0 = s.xp;
  s.coins = 1000;
  s = A(s, "cook", {uid: 1, dish: "pancakes"}, t).state;
  s = A(s, "serve", {uid: 1}, t + 10 * S).state;
  ok("serving the dish gives its XP (PT50, over V21 q1)", s.xp === xp0 + C.DISH.pancakes.xp);
  s.customers = []; s.next = null;
  const later = C.advance(s, t + 30 * 60 * S);
  ok("  customers buying it give none", later.stats.served > s.stats.served && later.xp === s.xp);
  const cl = A(s, "clean", {uid: 1}, t + 11 * S);
  ok("cleaning the stove gives a little", cl.ok && cl.state.xp === s.xp + C.CLEAN_XP && C.CLEAN_XP > 0 && C.CLEAN_XP < C.DISH.pancakes.xp);
  ok("  even after a burnt dish: thrown away, then cleaned", (() => { let b = A(Object.assign(JSON.parse(JSON.stringify(cl.state)), {coins: 1000}), "cook", {uid: 1, dish: "pancakes"}, t + 20 * S).state; b = A(b, "throw", {uid: 1}, t + 20 * S + 30 * S).state; const x = b.xp; return A(b, "clean", {uid: 1}, t + 60 * S).state.xp === x + C.CLEAN_XP; })());
  // cancelling a dish (2026-10-21, Cam): the stove is free again, no coins back
  {
    let b = JSON.parse(JSON.stringify(cl.state)); b.coins = 1000;
    b = A(b, "cook", {uid: 1, dish: "pancakes"}, t + 20 * S).state;
    const paid = 1000 - b.coins, r = A(b, "cancel", {uid: 1}, t + 25 * S);
    ok("cancelling a cooking dish frees the stove", r.ok && C.stoveOf(r.state.items.find((i) => i.uid === 1), t + 25 * S).status === "free" && paid > 0);
    ok("  and gives no coins back (and no XP)", r.ok && r.state.coins === b.coins && r.state.xp === b.xp);
    ok("  the stove can cook again straight away", A(r.state, "cook", {uid: 1, dish: "pancakes"}, t + 26 * S).ok);
    ok("  only while it's cooking -- not when it's ready", !A(b, "cancel", {uid: 1}, t + 31 * S).ok && !A(r.state, "cancel", {uid: 1}, t + 26 * S).ok);
    let tu = open(t); tu = A(tu, "cook", {uid: 1, dish: "pancakes"}, t).state;
    ok("  not in the tutorial (Rosa's pancakes finish)", !A(tu, "cancel", {uid: 1}, t + 2 * S).ok);
  }
  ok("a dish already on a counter keeps stacking, as high as you like", (() => { let b = JSON.parse(JSON.stringify(cl.state)); b.coins = 1e6; b.customers = []; b.next = null; b.closed = true; Object.assign(counter(b), {dish: "pancakes", n: 900}); b = A(b, "cook", {uid: 1, dish: "pancakes"}, t + 70 * S).state; b = A(b, "serve", {uid: 1}, t + 81 * S).state; return counter(b).n === 900 + C.DISH.pancakes.servings; })());
  // popularity (2026-10-24: no top rate; each part rises to its own ceiling; at least RATE.min with food out; after
  // dark the lights count)
  const NOON = new Date(2026, 9, 20, 12).getTime(), NIGHT = new Date(2026, 9, 20, 22).getTime();
  let p = classic(skipped());
  Object.assign(counter(p), {dish: "pancakes", n: 50});
  const base = C.baseRate(p, NOON);
  ok("one dish out: the minimum rate (V21 q2; 2026-10-24 the floor)", base === C.RATE.min, base);
  p.coins = 50000; p.xp = C.XP[6];
  p = A(A(p, "buy", {kind: "counter"}, t).state, "place", {kind: "counter", x: 3, y: 0}, t).state;
  p.items.filter((i) => i.kind === "counter")[1].dish = "waffles"; p.items.filter((i) => i.kind === "counter")[1].n = 50;
  const two = C.popularity(p, NOON);
  ok("  a second, different dish adds variety and stock", two.variety > 0.8 && two.stock > 0.2, JSON.stringify(two));
  p = A(p, "style", {what: "wall", id: "brick"}, t).state;
  p = A(p, "floorAll", {id: "oak"}, t).state;
  ok("  so do the café's looks (wallpaper, floors)", C.popularity(p, NOON).looks > two.looks + 1, JSON.stringify(C.popularity(p, NOON)));
  ok("  every part flattens out: twenty dishes are worth less than five times four", (() => { const v = (n) => C.RATE.variety[0] * (1 - Math.exp(-n / C.RATE.variety[1])); return v(19) < 5 * v(3) && v(1000) <= C.RATE.variety[0]; })());
  ok("  no top rate any more", C.RATE.max === undefined);
  ok("  after dark a café with no lights loses customers; lit, it gains", C.popularity(p, NIGHT).light < 0 && C.popularity(p, NOON).light === 0
     && C.popularity(Object.assign({}, p, {ceil: {"0,0": {id: "ceil-led"}, "1,1": {id: "ceil-led"}}}), NIGHT).light > C.popularity(p, NIGHT).light);
  ok("  but never below the minimum while there's food out", C.baseRate(p, NIGHT) >= C.RATE.min);
}

console.log("\nWalls a panel at a time (N43)\n");
{
  const t = T0;
  let s = skipped(); s.xp = C.XP[5]; s.coins = 5000;
  const price = C.WALLPAPERS.find((w) => w.id === "brick").price;
  const pp = C.panelPrice(C.WALLPAPERS.find((w) => w.id === "brick"));
  let r = A(s, "wallPaint", {id: "brick", side: "l", i: 1}, t);
  ok("a panel papered for a panel's price -- no need to buy the whole wallpaper (PT52)", r.ok && r.state.walls.l1 === "brick" && Object.keys(r.state.walls).length === 1 && r.state.coins === 5000 - pp && pp < price && pp > 0);
  r = A(r.state, "wallPaint", {id: "brick", side: "r", i: 0}, t);
  ok("  each panel costs its own", r.ok && r.state.walls.r0 === "brick" && r.state.coins === 5000 - 2 * pp);
  ok("  the same again costs nothing", A(r.state, "wallPaint", {id: "brick", side: "r", i: 0}, t).state.coins === r.state.coins);
  ok("  a wallpaper you own (bought for all walls) is free on any panel", (() => { let q = A(s, "style", {what: "wall", id: "brick"}, t).state; q = A(q, "style", {what: "wall", id: "plaster"}, t).state; const c = q.coins; return A(q, "wallPaint", {id: "brick", side: "l", i: 0}, t).state.coins === c; })());
  ok("  back to the café's own wallpaper: the panel follows the café again", (() => { const q = A(r.state, "wallPaint", {id: "plaster", side: "l", i: 1}, t); return q.ok && !("l1" in q.state.walls); })());
  ok("  the whole café at once clears the single panels", (() => { const q = A(r.state, "style", {what: "wall", id: "brick"}, t); return q.ok && q.state.style.wall === "brick" && !Object.keys(q.state.walls).length; })());
  ok("  not a wall, not a wallpaper, not yet: refused", !A(s, "wallPaint", {id: "brick", side: "x", i: 0}, t).ok && !A(s, "wallPaint", {id: "brick", side: "l", i: 9}, t).ok
     && !A(s, "wallPaint", {id: "nope", side: "l", i: 0}, t).ok && /level/.test(A(Object.assign(JSON.parse(JSON.stringify(s)), {xp: 0}), "wallPaint", {id: "brick", side: "l", i: 0}, t).error || ""));
  ok("  an old save has no single panels", JSON.stringify(C.normal(Object.assign(JSON.parse(JSON.stringify(s)), {walls: undefined})).walls) === "{}");
}

console.log("\nBuilding out (V22): expansions, paintings, coin machines\n");
{
  const t = T0;
  let s = skipped(); s.coins = 1e6; s.customers = []; s.next = null;
  // expansions, in order, each at its level
  s.xp = C.XP[4];
  let r = A(s, "expand", {}, t);
  ok("expansions one after another: 5x5, then 6x6 at level 4", r.ok && r.state.size === 5 && A(r.state, "expand", {}, t).state.size === 6);
  ok("  the next waits for its level", /level 6/.test(A(A(r.state, "expand", {}, t).state, "expand", {}, t).error || ""));
  ok("  10x10 at level 12, 13x13 at 22 (not 14x14 till 26), 20x20 at 50, and on up to 30x30 at level 100 (V23 q3; Cam 2026-11-01)", (() => { const grow = (lvl) => { let q = Object.assign(JSON.parse(JSON.stringify(s)), {xp: C.XP[lvl], coins: 1e9}); for (let i = 0; i < 40; i++) { const x = A(q, "expand", {}, t); if (x.ok) q = x.state; } return q.size; };
     return grow(12) === 10 && grow(11) === 9 && grow(22) === 13 && grow(25) === 13 && grow(26) === 14 && grow(50) === 20 && grow(99) === 29 && grow(100) === 30 && C.EXPANSIONS.every((e, i, a) => !i || (e.size === a[i - 1].size + 1 && e.level >= a[i - 1].level && e.coins > a[i - 1].coins)); })());
  // paintings
  let p = Object.assign(JSON.parse(JSON.stringify(s)), {xp: C.XP[11]});
  r = A(p, "hang", {id: "coffee", side: "l", i: 1}, t);
  ok("a painting bought and hung on a wall panel", r.ok && r.state.hang.l1 === "coffee" && r.state.coins === p.coins - C.PAINTING.coffee.price);
  ok("  not on the door, not on a panel that has one, not before its level", !A(r.state, "hang", {id: "harbour", side: "l", i: r.state.door}, t).ok
     && !A(r.state, "hang", {id: "harbour", side: "l", i: 1}, t).ok && /level/.test(A(r.state, "hang", {id: "teapot", side: "r", i: 0}, t).error || ""));
  const dn = A(r.state, "unhang", {side: "l", i: 1}, t);
  ok("  taken down into storage, hung again for nothing", dn.ok && !dn.state.hang.l1 && dn.state.pware.coffee === 1 && (() => { const h = A(dn.state, "hang", {id: "coffee", side: "r", i: 2}, t); return h.ok && h.state.coins === dn.state.coins && !h.state.pware.coffee; })());
  ok("  moved to another panel, or sold for half", A(r.state, "moveHang", {from: "l1", side: "r", i: 0}, t).state.hang.r0 === "coffee" && A(r.state, "sellHang", {side: "l", i: 1}, t).state.coins === r.state.coins + Math.floor(C.PAINTING.coffee.price / 2));
  ok("  paintings make the café look better (popularity)", C.popularity(r.state).looks > C.popularity(p).looks);
  // machines
  let m = Object.assign(JSON.parse(JSON.stringify(s)), {xp: C.XP[15]});
  ok("four coin machines at levels 6, 9, 12 and 15; another of each every 10 levels", ["jukebox", "arcade", "pinball", "piano"].map((k) => C.THINGS[k].level).join() === "6,9,12,15"
     && C.allowed("jukebox", 5) === 0 && C.allowed("jukebox", 6) === 1 && C.allowed("jukebox", 16) === 2);
  const putStored = (st, kind, x, y) => { const q = A(stock(st, kind).state, "place", {kind, x, y, dir: 0}, t); if (!q.ok) throw new Error(q.error); return q.state; };
  const put = (st, kind, x, y) => { let q = A(st, "buy", {kind}, t); if (!q.ok) throw new Error(q.error); q = A(q.state, "place", {kind, x, y, dir: 0}, t); if (!q.ok) throw new Error(q.error); return q.state; };
  m.size = 6; m = put(m, "arcade", 5, 5);
  ok("  machines make the café more popular", C.popularity(m).fun > 0);
  let later = C.advance(Object.assign(JSON.parse(JSON.stringify(m)), {next: t}), t + 30 * 60 * S), arc = later.items.find((i) => i.kind === "arcade");
  ok("  people come in to play the arcade and pay into it", arc.coins > 0 && arc.coins % C.MACHINES.arcade.play === 0, arc.coins);
  const col = A(later, "machineCollect", {uid: arc.uid}, later.at);
  ok("  click: the coins are yours", col.ok && col.state.coins === later.coins + arc.coins && !col.state.items.find((i) => i.kind === "arcade").coins);
  // N48 / N53 (2026-10-24): the games (Sheet 21, painted front and back, mirrored for the other turns), the dividers
  // (Sheet 20, two ways), and windows, curtains, clocks and wall things (Sheets 17-19)
  const man48 = fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8");
  const GAMES = ["skeeball", "basketball", "karaoke", "foosball", "lightgun", "airhockey", "dance", "whackamole"], DIVS = ["halfwall", "halfbrick", "screen", "vipropes", "planterwall", "standmirror", "lattice", "barrier"];
  ok("eight games, coin machines turning four ways, each painted all four ways", GAMES.every((k) => C.THINGS[k].machine && C.THINGS[k].turns === 4 && C.MACHINES[k] && ["l", "r", "bl", "br"].every((d) => man48.includes(`"${k}-${d}"`))));
  let g = Object.assign(JSON.parse(JSON.stringify(s)), {xp: C.XP[40], coins: 1e6, size: 8});
  g = put(g, "whackamole", 7, 7); g = put(g, "karaoke", 6, 7);
  const gl = C.advance(Object.assign(JSON.parse(JSON.stringify(g)), {next: t}), t + 30 * 60 * S), wm = gl.items.find((i) => i.kind === "whackamole");
  ok("  people come in to play them and pay into them; they can be sold", wm.coins > 0 && wm.coins % C.MACHINES.whackamole.play === 0 && A(g, "sell", {uid: g.items.find((i) => i.kind === "karaoke").uid}, t).ok);
  ok("eight dividers, furniture turning two ways, each painted both ways and recolourable", DIVS.every((k) => C.THINGS[k].furniture && C.THINGS[k].divider && C.THINGS[k].turns === 2 && C.THINGS[k].tint && man48.includes(`"${k}-l"`) && man48.includes(`"${k}-r"`)));
  ok("  one placed (from storage: no longer sold)", (() => { const q = putStored(Object.assign(JSON.parse(JSON.stringify(s)), {xp: C.XP[30], coins: 1e5, size: 6}), "lattice", 4, 4), it = q.items.find((i) => i.kind === "lattice"); return !!it; })());
  // (2026-10-24: and five wall lights, drawn for the left wall and mirrored on the right)
  const N48 = C.WALL_THINGS.filter((w) => !w.light);
  ok("windows, curtains and blinds, clocks and wall things: 24 to hang, each cut to the wall's slant for both walls", N48.length === 24 && N48.every((w) => C.PAINTING[w.id] && man48.includes(`"${w.pic}"`) && man48.includes(`"${w.pic}-r"`))
     && N48.every((w) => ["window", "curtain", "blind", "clock", "wall"].includes(w.group)));
  ok("every wall weapon has its mount (N51), cut for both walls", C.WEAPONS.length > 40 && C.WEAPONS.every((w) => /^mount-/.test(w.mount) && man48.includes(`"${w.mount}"`))
     && C.PAINTING["w-runesword"].mount === "mount-gilded" && C.PAINTING["w-ironkiteshield"].mount === "mount-shield" && C.PAINTING["w-firestaff"].mount === "mount-shadowbox" && C.PAINTING["w-longbow"].mount === "mount-driftwood");
  let h = Object.assign(JSON.parse(JSON.stringify(s)), {xp: C.XP[12], coins: 5000});
  r = A(h, "hang", {id: "window-1", side: "l", i: 1}, t);
  ok("  a window hangs on a panel like a painting, counts for the looks, and opens with its level", r.ok && r.state.hang.l1 === "window-1" && C.popularity(r.state).looks > C.popularity(h).looks
     && /level/.test(A(h, "hang", {id: "window-7", side: "r", i: 0}, t).error || "") && A(r.state, "hang", {id: "clock-1", side: "r", i: 0}, t).ok);
  ok("  they show in the level-up list and the shop", C.unlocksAt(6).some((u) => u.id === "window-1") && C.view(h, t).wallShop.length === C.WALL_THINGS.length);
}

console.log("\nThe long game, part 1 (V23): rewards, potions, spoiling, the fire kit\n");
{
  const t = T0;
  // rewards
  let s = classic(skipped()); s.customers = []; s.next = null; s.closed = true;
  const c0 = s.coins, i0 = JSON.stringify(s.inv || {});
  s.xp = C.XP[10] - 1; s.coins = 1000;
  let r = A(s, "cook", {uid: 1, dish: "pancakes"}, t); r = A(r.state, "serve", {uid: 1}, t + 10 * S);
  const lv = r.events.find((e) => e.kind === "level");
  const inv0 = Object.assign({fresh: 0, quick: 0, sell: 0}, s.inv);
  ok("a level-up brings a reward: level 10's chest -- coins and two of each potion", lv && lv.level === 10 && lv.reward.chest && lv.reward.coins === 1500
     && ["fresh", "quick", "sell"].every((k) => (r.state.inv[k] || 0) - inv0[k] === 2), JSON.stringify(lv && lv.reward));
  ok("  other levels: 40 x the level in coins and a potion", C.rewardFor(7).coins === 280 && Object.values(C.rewardFor(7).potions).reduce((a, b) => a + b, 0) === 1 && !C.rewardFor(7).chest);
  // potions, on a closed café with the counter set up directly
  const base = () => { const b = classic(JSON.parse(JSON.stringify(skipped()))); b.customers = []; b.next = null; b.closed = true; b.coins = 1e5; b.inv = {fresh: 1, quick: 1, sell: 1}; return b; };
  let p = A(base(), "cook", {uid: 1, dish: "waffles"}, t).state;
  r = A(p, "usePotion", {kind: "quick", uid: 1}, t + S);
  ok("Quick potion: the stove is ready now, one potion used", r.ok && C.view(r.state, t + S).items.find((i) => i.uid === 1).stove.status === "ready" && r.state.inv.quick === 0);
  ok("  not on a stove that isn't cooking", !A(r.state, "usePotion", {kind: "quick", uid: 1}, t + S).ok);
  p = base(); const ctr = counter(p); Object.assign(ctr, {dish: "waffles", n: 12, since: t});
  r = A(p, "usePotion", {kind: "sell", uid: ctr.uid}, t + S);
  ok("Sell potion: the counter's whole dish sold into the till", r.ok && r.state.till === p.till + 12 * C.DISH.waffles.price && !counter(r.state).dish, r.error);
  // spoiling: off since 2026-10-24, taken out 2026-11-07 (Cam: "remove food on servery from spoiling")
  ok("dishes on the counters never spoil: a dish out a week still sells, and nothing's left of the rules", !C.SPOIL && !C.spoilAfter && !C.view(p, t + 7 * 86400 * S).items.find((i) => i.uid === ctr.uid).spoiled
     && (() => { const o = C.advance(Object.assign(JSON.parse(JSON.stringify(p)), {closed: false, next: t + 7 * 86400 * S}), t + 7 * 86400 * S + 30 * 60 * S); return counter(o).n < 12; })()
     && !A(p, "binPlate", {uid: ctr.uid}, t + 7 * 86400 * S).ok);
  const later = t + 2 * 3600 * S + S;
  ok("  the Fresh potion isn't for counters any more (it's for the farm)", /plot/.test(A(p, "usePotion", {kind: "fresh", uid: ctr.uid}, t + S).error || "") && /crop/.test(C.POTIONS.fresh.says));
  const q = p;
  // the fire kit
  let f = JSON.parse(JSON.stringify(q)); f.xp = C.XP[8]; f.coins = 5000; counter(f).dish = null;
  r = A(f, "hang", {id: "firekit", side: "r", i: 1}, later);
  ok("the fire kit hangs on a wall panel (level 8), one only, and isn't a decoration", r.ok && r.state.hang.r1 === "firekit" && !A(r.state, "hang", {id: "firekit", side: "r", i: 2}, later).ok
     && C.popularity(r.state).looks === C.popularity(f).looks);
  let k = A(A(r.state, "clean", {uid: 1}, later).state, "cook", {uid: 1, dish: "pancakes"}, later).state;
  const burnt = later + 25 * S;
  ok("  a dish that would burn waits on the stove instead", C.view(k, burnt).items.find((i) => i.uid === 1).stove.status === "ready" && C.view(k, burnt).kit.left === 4, JSON.stringify(C.view(k, burnt).kit));
  ok("  without it, it burns", C.view(A(f, "cook", {uid: 1, dish: "pancakes"}, later).state, burnt).items.find((i) => i.uid === 1).stove.status !== "ready" || f.items.find((i) => i.uid === 1).dirty);
}

console.log("\nSettings (PT52)\n");
{
  const s = skipped();
  ok("music on at a gentle volume to start", C.prefs(s).music === true && C.prefs(s).vol > 0 && C.prefs(s).vol < 1);
  const r = A(s, "prefs", {music: false, vol: 3}, T0);
  ok("  turned off, the volume kept between 0 and 1, kept with the save", r.ok && C.prefs(r.state).music === false && C.prefs(r.state).vol === 1);
  // graphics (the performance audit, 3 Nov 2026; Cam, PT71)
  ok("graphics: Balanced to start; Full, Balanced or Light kept; anything else refused", C.prefs(s).fx === "balanced"
     && C.prefs(A(s, "prefs", {fx: "light"}, T0).state).fx === "light" && C.prefs(A(s, "prefs", {fx: "sparkly"}, T0).state).fx === "balanced"
     && C.prefs({prefs: {fx: "full"}}).fx === "full");
  {
    const page = fs.readFileSync(path.join(__dirname, "..", "ui", "cafe", "cafe.js"), "utf8");
    ok("  in Settings; resting (Light, or Balanced while another window is in use) stops the beat and slows the clock to once a second",
       /data-fx=/.test(page) && /function resting\(\)/.test(page) && /if \(resting\(\)\) return;/.test(page)
       && /!focused && C\.prefs\(state\)\.fx !== "full"/.test(page) && /window\.NCFocus = /.test(page));
     // sound effects (3 Nov 2026, Cam: NeuroArcana's victory, click and Moonstones, and the rest the Sound Engineer picked)
    const want = [...page.matchAll(/"(click|place|pick|no|page|bell|coin|heal|tear|keeper|rare|unlock|victory|sizzle|clean|plate|blend)"/g)].map((m) => m[1]);
    ok("  sound effects in Settings; each one the page can play is in cafe/sfx; a level up is the victory, coins the Moonstones",
       /data-sfx /.test(page) && /data-sfxvol/.test(page) && want.every((n) => fs.existsSync(path.join(__dirname, "..", "ui", "cafe", "sfx", n + ".ogg")))
       && /level: "victory"/.test(page) && /coins: "coin", tip: "coin", delivered: "coin"/.test(page));
    ok("  Cam's café recordings (3 Nov): a dish sizzles, a stove scrubs clean, serving clinks a fork on a plate; nothing plays by itself (no door chime, no eating)",
       /cook: "sizzle", clean: "clean"/.test(page) && /serve: "plate"/.test(page) && !/"chime"|"eating"|function ambient/.test(page));
    ok("  the milkshake counter blends (Cam, 8 Nov): a shake started there plays the blender once, a short cut, never a loop",
       /action === "cook" && \(before\.items\.find\(\(i\) => i\.uid === \(opts \|\| \{\}\)\.uid\) \|\| \{\}\)\.kind === "shakebar" \? "blend"/.test(page)
       && fs.existsSync(path.join(__dirname, "..", "ui", "cafe", "sfx", "blend.ogg")) && !/loop = true|\.loop\b/.test(page.slice(page.indexOf("function sfx("), page.indexOf("function sfx(") + 700)));
    ok("  the café radio has the jazz too, and the lofi and the jazz are stations of their own",
       fs.existsSync(path.join(__dirname, "..", "ui", "cafe", "music", "jazz.ogg")) && /url: "cafe\/music\/jazz\.ogg"/.test(page)
       && C.prefs(A(s, "prefs", {src: "game:jazz"}, T0).state).src === "game:jazz" && C.prefs({prefs: {src: "game:rock"}}).src === "radio");
    ok("  the click (Cam, 3 Nov): faint, only in the menus, never on the play area", /click: \.035/.test(page) && /!el\.closest\(MENUS\) \|\| el\.closest\("#nc-world"\)/.test(page));
  }
  ok("sound effects on at their own volume to start; turned off, the volume kept between 0 and 1", C.prefs(s).sfx === true && C.prefs(s).sfxVol === 0.7
     && C.prefs(A(s, "prefs", {sfx: false, sfxVol: -2}, T0).state).sfx === false && C.prefs(A(s, "prefs", {sfx: false, sfxVol: -2}, T0).state).sfxVol === 0
     && C.prefs(A(s, "prefs", {music: false}, T0).state).sfx === true);
}

console.log("\nOpen and closed (2026-10-21)\n");
{
  const t = T0;
  ok("can't close during the tutorial (it needs a customer)", /tutorial/.test(A(open(), "setOpen", {open: false}, t).error || ""));
  let s = skipped();
  Object.assign(counter(s), {dish: "pancakes", n: 400});
  s = C.advance(s, t + 60 * S);
  const inside = s.customers.length;
  let r = A(s, "setOpen", {open: false}, t + 60 * S);
  ok("closed: the view says so, and no one new comes in", r.ok && !C.view(r.state, t + 60 * S).open && C.baseRate(r.state) === 0);
  const later = C.advance(r.state, t + 3 * 3600 * S);
  ok("  those inside finish, then the café is empty however long it's closed", later.customers.length === 0 && later.stats.served <= s.stats.served + inside && counter(later).n > 300);
  r = A(later, "setOpen", {open: true}, t + 3 * 3600 * S);
  ok("open again: customers come", r.ok && C.view(r.state, t + 3 * 3600 * S + 60 * S).customers.length > 0);
}

console.log("\nStreet things you place yourself (2026-10-21)\n");
{
  const t = T0;
  let s = skipped();
  ok("every café starts with a few in the warehouse (lamps, a planter, a bin, a menu board), none put out for you", Object.keys(C.STARTER_DECOR).every((k) => s.dware[k] === C.STARTER_DECOR[k]) && s.decor.length === 0);
  ok("  given once, not every load", C.normal(C.normal(s)).dware.lamp === C.STARTER_DECOR.lamp);
  let r = A(s, "decorPlace", {id: "lamp", x: 6, y: -1, dir: 0}, t);
  ok("a lamp from the warehouse onto the pavement's kerb side: free", r.ok && r.state.dware.lamp === 1 && r.state.coins === s.coins && r.state.decor[0].x === 6 && r.state.decor[0].y === -1, r.error);
  s = r.state;
  ok("not on the road", /road/.test(A(s, "decorPlace", {id: "bin", x: 5, y: -2.5}, t).error || ""));
  ok("not on the line people walk along", /middle clear/.test(A(s, "decorPlace", {id: "bin", x: 5, y: -0.5}, t).error || ""));
  ok("not inside the café", /inside the café/.test(A(s, "decorPlace", {id: "bin", x: 1, y: 1}, t).error || ""));
  ok("small things may touch and overlap (2026-10-24, Cam: garden beds)", A(s, "decorPlace", {id: "planter", x: 6.25, y: -1}, t).ok);
  ok("on a quarter-tile grid", A(s, "decorPlace", {id: "planter", x: 7.13, y: 2.9}, t).state.decor.some((o) => o.x === 7.25 && o.y === 3));
  ok("level-locked things wait (an oak tree at level 6)", /level 6/.test(A(s, "decorPlace", {id: "tree", x: 8, y: 8}, t).error || "") && C.unlocksAt(6).some((u) => u.kind === "decor" && u.id === "tree"));
  s.coins = 1000;
  r = A(s, "decorPlace", {id: "bench", x: 8, y: 3, dir: 1}, t);
  ok("with none stored, it's bought", r.ok && r.state.coins === 1000 - C.DECO.bench.price, r.error);
  s = r.state;
  const bench = s.decor.find((o) => o.id === "bench");
  ok("turned four ways", [1, 2, 3].reduce((x) => A(x, "decorTurn", {uid: bench.uid}, t).state, s).decor.find((o) => o.uid === bench.uid).dir === 0);
  ok("moved, with the same checks", A(s, "decorMove", {uid: bench.uid, x: 9, y: 3}, t).ok && !A(s, "decorMove", {uid: bench.uid, x: 9, y: -2}, t).ok);
  ok("stored back in the warehouse", A(s, "decorStore", {uid: bench.uid}, t).state.dware.bench === 1);
  ok("sold for half", A(s, "decorSell", {uid: bench.uid}, t).state.coins === s.coins + C.DECO.bench.price / 2);
  let g = A(s, "decorPlace", {id: "planter", x: 4.5, y: 2}, t).state;
  g.xp = C.XP[2]; g.coins = 5000;
  g = A(g, "expand", {}, t).state;
  ok("the café growing moves one past its edge out with it (Cam: \"push all decorations on the edge of the cafe out\")", g.decor.some((o) => o.id === "planter" && o.x === 5.5 && o.y === 2));
}

console.log("\nRecipe mastery: five stars a dish (2026-10-22, Cam)\n");
{
  const need = (id) => C.masteryNeed(C.DISH[id]).join();
  ok("quick dishes need more cooks: pancakes 40/120/240/400/600, an hour's honey cake 4/12/24/40/60, four hours 2 to 30",
     need("pancakes") === "40,120,240,400,600" && need("honeycake") === "4,12,24,40,60" && need("carrotsoup") === "2,6,12,20,30", need("pancakes") + " | " + need("honeycake") + " | " + need("carrotsoup"));
  ok("  the longer the dish, never more cooks for its first star", C.DISHES.slice().sort((a, b) => a.secs - b.secs).every((d, i, l) => !i || C.masteryNeed(d)[0] <= C.masteryNeed(l[i - 1])[0]));
  // cook and serve pancakes 40 times: the 40th serve earns the first star
  let s = skipped(), t = T0, st = stove(s).uid, evs = [];
  s.coins = 100000;
  for (let i = 0; i < 40; i++) {
    let r = A(s, "cook", {uid: st, dish: "pancakes"}, t); r = A(r.state, "serve", {uid: st}, t + 10 * S); r = A(r.state, "clean", {uid: st}, t + 11 * S);
    s = r.state; evs = evs.concat(A(s, "tick", {}, t).events || []); t += 12 * S;
  }
  ok("a cook counts when it's served; the 40th pancakes earn the first star", s.mastery.pancakes === 40 && C.starsOf(s, "pancakes") === 1);
  ok("  the cookbook card says so: stars, cooks and what the next star takes", (() => { const d = C.view(s, t).cookbook.find((x) => x.id === "pancakes"); return d.stars === 1 && d.cooks === 40 && d.need[1] === 120 && d.servings === 5; })());
  const one = (() => { let g = JSON.parse(JSON.stringify(s)); g.mastery.pancakes = 39; let r = A(g, "cook", {uid: st, dish: "pancakes"}, t); r = A(r.state, "serve", {uid: st}, t + 10 * S); return r; })();
  ok("  a new star tells you what it brings", (one.events || []).some((e) => e.kind === "mastery" && e.dish === "pancakes" && e.stars === 1 && /more servings/.test(e.perk)));
  ok("  burnt and cancelled dishes don't count", (() => { let g = JSON.parse(JSON.stringify(s)); let r = A(g, "cook", {uid: st, dish: "pancakes"}, t); r = A(r.state, "throw", {uid: st}, t + 25 * S); return r.ok && r.state.mastery.pancakes === 40; })());
  // the perks, star by star (waffles: 2 min, 5 servings... 15 cooks a star)
  const at = (n) => { const g = JSON.parse(JSON.stringify(s)); g.mastery.waffles = n; return g; }, W = C.DISH.waffles, nw = C.masteryNeed(W);
  const m = (n) => C.mastered(at(n), "waffles");
  ok("  1 star: 10% more servings (at least one more)", m(nw[0] - 1).servings === W.servings && m(nw[0]).servings === Math.max(W.servings + 1, Math.round(W.servings * 1.1)));
  ok("  2 stars: sells for 10% more (at least a coin)", m(nw[1] - 1).price === W.price && m(nw[1]).price === Math.max(W.price + 1, Math.round(W.price * 1.1)));
  ok("  3 stars: cooks 20% faster -- the stove's ready sooner", m(nw[2]).secs === 96 && (() => { const g = A(at(nw[2]), "cook", {uid: st, dish: "waffles"}, t).state; return C.stoveOf(stove(g), t + 95 * S).status === "cooking" && C.stoveOf(stove(g), t + 96 * S).status === "ready" && C.stoveOf(stove(g), t + 192 * S).status === "burnt"; })());
  ok("  4 stars: 25% more servings in all", m(nw[3]).servings === Math.max(W.servings + 2, Math.round(W.servings * 1.25)));
  ok("  5 stars: never burns", m(nw[4]).noburn && (() => { const g = A(at(nw[4]), "cook", {uid: st, dish: "waffles"}, t).state; return C.stoveOf(stove(g), t + 48 * 3600 * S).status === "ready"; })());
  ok("  the cost to cook stays the same -- the extra servings are profit", C.view(at(nw[4]), t).cookbook.find((x) => x.id === "waffles").cost === W.cost);
  ok("  customers pay the mastered price", (() => { let g = at(nw[1]); g.items.forEach((it) => { if (it.kind === "buffet") { it.plates[0] = {dish: "waffles", n: 5, since: t}; } if (it.kind === "counter") { it.dish = "waffles"; it.n = 5; it.since = t; } });
    g.customers = []; g.next = t; g = C.advance(g, t + 60 * S); return g.customers.length > 0 && g.customers.every((c) => c.price === m(nw[1]).price); })());
  ok("  a dish on the stove keeps what it was cooked with (a star mid-cook changes the next one)", (() => { let g = A(at(nw[2] - 1), "cook", {uid: st, dish: "waffles"}, t).state; g.mastery.waffles = nw[2]; return C.stoveOf(stove(g), t + 119 * S).status === "cooking"; })());
  ok("  an old save's stove (no stored time) still cooks for the dish's time", (() => { const g = JSON.parse(JSON.stringify(s)); Object.assign(stove(g), {dish: "waffles", start: t, dirty: false}); delete stove(g).secs; return C.stoveOf(stove(g), t + 119 * S).status === "cooking" && C.stoveOf(stove(g), t + 120 * S).status === "ready"; })());
  ok("  old saves start with no mastery", JSON.stringify(C.normal(Object.assign(JSON.parse(JSON.stringify(s)), {mastery: undefined})).mastery) === "{}");
  ok("the dev tools' mastery button is for the sandbox only, and adds a star to every open dish", !A(s, "dev", {op: "mastery"}, t).ok
     && (() => { const g = A(C.sandbox(s, t, false), "dev", {op: "mastery"}, t).state; return C.starsOf(g, "pancakes") === 2 && C.starsOf(g, "waffles") === 1; })());
}

console.log("\nAunty's daily delivery and her secret recipes (2026-10-22, Cam)\n");
{
  const DAY = 24 * 3600 * S;
  ok("no box during the tutorial", !A(open(), "aunty", {}, T0).ok && !open().aunty);
  let s = skipped(), t = T0;
  s = C.advance(s, t);
  ok("a box waits once the tutorial's done", s.aunty && s.aunty.box && !s.aunty.opened && C.view(s, t).aunty.waiting);
  ok("  Aunty's secrets don't open by levelling: not in any level's unlocks, locked in the cookbook, can't be cooked",
     C.DISHES.filter((d) => d.secret && !d.event).length === 10 && Array.from({length: 100}, (_, i) => i + 1).every((l) => !C.unlocksAt(l).some((u) => C.DISH[u.id] && C.DISH[u.id].secret))
     && !C.view(s, t).cookbook.find((d) => d.id === "bread").open && /Aunty's secret recipes/.test(A(s, "cook", {uid: stove(s).uid, dish: "bread"}, t).error || ""));
  const coins0 = s.coins, quick0 = s.inv.quick || 0;
  let r = A(s, "aunty", {}, t + 60 * S);
  const e1 = (r.events || []).find((e) => e.kind === "aunty");
  ok("the first box: her soda bread, 100 coins and a quick potion, and a note that she'll share more secrets as you grow",
     r.ok && e1 && e1.first && /secret recipes/.test(e1.say) && e1.sign === "Love, Aunty" && r.state.secrets.join() === "bread" && r.state.coins === coins0 + 100 && r.state.inv.quick === quick0 + 1);
  ok("  the soda bread cooks now, and its card is open", A(r.state, "cook", {uid: stove(r.state).uid, dish: "bread"}, t + 61 * S).ok && C.view(r.state, t).cookbook.find((d) => d.id === "bread").open);
  ok("  one box a day: opened, there's no other until tomorrow", !A(r.state, "aunty", {}, t + 2 * 3600 * S).ok && !C.view(r.state, t).aunty.waiting);
  s = C.advance(r.state, t + DAY);
  ok("  tomorrow brings a new one", s.aunty.box && !s.aunty.opened && A(s, "aunty", {}, t + DAY).ok);
  // boxes don't pile up: skip three days, there's still just today's
  s = C.advance(s, t + DAY + 60 * S); const n0 = s.aunty.count;
  s = C.advance(s, t + 4 * DAY);
  ok("  a box not opened is gone at midnight: after three days away there's one box, not three", A(s, "aunty", {}, t + 4 * DAY).ok && !A(A(s, "aunty", {}, t + 4 * DAY).state, "aunty", {}, t + 4 * DAY).ok && s.aunty.count === n0);
  // a year of boxes at level 40: what comes, and how often a recipe
  let y = JSON.parse(JSON.stringify(s)); y.xp = C.XP[40]; y.coins = 0;
  const kinds = {}; let recipes = 0, sizes = new Set(), tooHigh = false;
  for (let d = 5; d < 370; d++) {
    const at = t + d * DAY; y = C.advance(y, at);
    const rr = A(y, "aunty", {}, at); if (!rr.ok) continue;
    const ev = rr.events.find((e) => e.kind === "aunty"); y = rr.state;
    ev.gifts.forEach((g) => { kinds[g.kind] = (kinds[g.kind] || 0) + 1; if (g.kind === "recipe") { recipes++; if (C.DISH[g.id].level > 40) tooHigh = true; } });
    sizes.add(ev.gifts.filter((g) => g.kind !== "recipe").length);
  }
  ok("a year of boxes brings coins, potions, food and decorations", ["coins", "potion", "food"].every((k) => kinds[k] > 30) && (kinds.decor || 0) + (kinds.painting || 0) > 15, JSON.stringify(kinds));
  ok("  one to three gifts a box", [...sizes].every((n) => n >= 1 && n <= 3) && sizes.has(1) && sizes.has(3), [...sizes].join());
  ok("  secret recipes are rare (a handful a year) and never above your level", recipes >= 2 && recipes <= 50 && !tooHigh && y.secrets.every((id) => C.DISH[id].level <= 40), recipes + " recipes");
  ok("  decorations go in the bag (the warehouses), potions in the bag", Object.keys(y.dware).length + Object.keys(y.pware).length > 0 && Object.values(y.inv).some((n) => n > 0));
  // food: into the bag, then out onto the counters when there's room
  let f = JSON.parse(JSON.stringify(r.state)); f.customers = []; f.next = null; f.closed = true;
  const plates = (st) => st.items.filter((i) => i.kind === "counter" || i.kind === "buffet").flatMap((i) => i.kind === "buffet" ? i.plates : [i]);
  plates(f).forEach((pl, i) => { pl.dish = i ? "frenchtoast" : "pancakes"; pl.n = 50; pl.since = t; });
  f = C.advance(f, t + DAY); f.aunty.box = {say: "Here you go.", gifts: [{kind: "food", id: "waffles", n: 12}]};
  r = A(f, "aunty", {}, t + DAY + S);
  ok("food waits in the bag while the counters are full", r.ok && r.state.food.length === 1 && r.state.food[0].dish === "waffles" && C.view(r.state, t + DAY + S).food[0].n === 12);
  const g = JSON.parse(JSON.stringify(r.state)); plates(g)[1].dish = null; plates(g)[1].n = 0;
  const g2 = C.advance(g, t + DAY + 2 * S);
  ok("  and goes out by itself when a counter has room", !g2.food.length && plates(g2).some((pl) => pl.dish === "waffles" && pl.n === 12));
  const h = JSON.parse(JSON.stringify(r.state)); plates(h)[0].dish = "waffles"; plates(h)[0].n = 3;
  ok("  or onto a counter with the same dish", (() => { const h2 = C.advance(h, t + DAY + 2 * S); return !h2.food.length && plates(h2)[0].n === 15; })());
  ok("the sandbox's dev tools send a box now", !A(r.state, "dev", {op: "aunty"}, t).ok && (() => { const sb = C.sandbox(r.state, t + DAY, false); sb.aunty.opened = true; return A(A(sb, "dev", {op: "aunty"}, t + DAY).state, "aunty", {}, t + DAY).ok; })());
}

console.log("\nThe request cart from NeuroVale (2026-10-22, Cam: the first blend of the two game worlds)\n");
{
  const DAY = 24 * 3600 * S;
  ok("no cart before level 2", !C.advance(open(), T0).cart);
  let s = C.advance(skipped(), T0), t = T0;
  ok("a cart waits once the tutorial's done (level 2), with a guild hall tutor", s.cart && !s.cart.done && C.TUTORS.some((x) => x.id === s.cart.tutor) && C.view(s, t).cart.order.length >= 1);
  ok("  a different tutor each day, round all six", (() => { const ids = Array.from({length: 6}, (_, d) => C.tutorFor(T0 + d * DAY).id); return new Set(ids).size === 6 && C.tutorFor(T0 + 6 * DAY).id === ids[0]; })());
  ok("  quick dishes in bulk: pancakes by the 20 to 50", (() => { const l = s.cart.order.find((o) => o.dish === "pancakes"); return !l || (l.n >= 20 && l.n <= 50 && l.n % 5 === 0); })());
  ok("  never an overnight dish (2026-10-23): a year of carts at level 100 asks only for dishes of four hours or less", (() => { let g = JSON.parse(JSON.stringify(s)); g.xp = C.XP[100]; for (let i = 0; i < 365; i++) { g.cart = null; g.stats.carts = i; g = C.advance(g, t + i * DAY); if (g.cart.order.some((l) => C.DISH[l.dish].secs > 4 * 3600)) return false; } return true; })());
  ok("  a cart already out loses its overnight dishes; what was loaded of one still counts", (() => { let g = JSON.parse(JSON.stringify(s)); g.cart.order = [{dish: "cabbagesoup", n: 300, got: 0}, {dish: "porridge", n: 300, got: 40}, {dish: "waffles", n: 20, got: 0}]; g = C.advance(g, t + S);
     const o = g.cart.order; return o.length === 2 && o[0].dish === "porridge" && o[0].n === 40 && o[1].dish === "waffles"; })());
  ok("  and one with only an overnight dish is swapped for a new cart", (() => { let g = JSON.parse(JSON.stringify(s)); g.cart.order = [{dish: "cabbagesoup", n: 300, got: 0}]; g = C.advance(g, t + S); return g.cart.order.length >= 1 && g.cart.order.every((l) => C.DISH[l.dish].secs <= 4 * 3600); })());
  ok("  higher levels order two or three dishes", (() => { let g = JSON.parse(JSON.stringify(s)); g.xp = C.XP[20]; g.cart = null; g = C.advance(g, t + DAY); return g.cart.order.length >= 2 && g.cart.order.length <= 3 && new Set(g.cart.order.map((l) => l.dish)).size === g.cart.order.length; })());
  // an order of 20 waffles and 10 pancakes, loaded from the counters
  s = JSON.parse(JSON.stringify(s)); s.customers = []; s.closed = true; s.next = null;
  s.cart.order = [{dish: "waffles", n: 20, got: 0}, {dish: "pancakes", n: 10, got: 0}];
  const plates = (st) => st.items.filter((i) => i.kind === "counter" || i.kind === "buffet").flatMap((i) => i.kind === "buffet" ? i.plates : [i]);
  plates(s)[0].dish = "waffles"; plates(s)[0].n = 12; plates(s)[0].since = t;
  plates(s)[1].dish = "pancakes"; plates(s)[1].n = 30; plates(s)[1].since = t;
  ok("the view says what's on the counters for each line", (() => { const v = C.view(s, t).cart; return v.order[0].have === 12 && v.order[1].have === 30 && v.value === 20 * C.DISH.waffles.price + 10 * C.DISH.pancakes.price && v.bonus === Math.round(v.value / 2); })());
  let r = A(s, "cartLoad", {dish: "waffles"}, t);
  ok("  loading a dish takes it off the counter, up to what's wanted", r.ok && r.state.cart.order[0].got === 12 && !plates(r.state)[0].dish && !r.state.cart.done);
  ok("  nothing to load: says so", !A(r.state, "cartLoad", {dish: "waffles"}, t).ok);
  const coins0 = r.state.coins;
  r = A(r.state, "cartLoad", {}, t);
  ok("  'load everything' fills the rest it can (the pancakes; the counter keeps its extra 20)", r.ok && r.state.cart.order[1].got === 10 && plates(r.state)[1].n === 20 && !r.state.cart.done);
  // the last waffles from a counter's fridge
  const f = JSON.parse(JSON.stringify(r.state)), bf = f.items.find((i) => i.kind === "buffet");
  bf.fridge = true; bf.under = [{dish: "waffles", n: 9}];
  r = A(f, "cartLoad", {}, t);
  const ce = (r.events || []).find((e) => e.kind === "cart");
  const value = 20 * C.DISH.waffles.price + 10 * C.DISH.pancakes.price;
  ok("full (the last from a counter's fridge): they pay what it sells for plus half again, and go", r.ok && ce && r.state.cart.done && r.state.coins - coins0 === value + Math.round(value / 2) + 0 && ce.bonus === Math.round(value / 2) && bf.under && r.state.items.find((i) => i.kind === "buffet").under[0].n === 1 && !C.view(r.state, t).cart, r.error);
  ok("  and leave a potion -- or now and then a NeuroVale keepsake for the street", ce && ((ce.gift.kind === "potion" && r.state.inv[ce.gift.id] > 0) || (ce.gift.kind === "decor" && r.state.dware[ce.gift.id] === 1)));
  ok("  keepsakes are rare (about one cart in ten) and match the tutor", (() => { let k = 0, match = true; for (let i = 0; i < 400; i++) { const g = JSON.parse(JSON.stringify(f)); g.stats.carts = i; const e = (A(g, "cartLoad", {}, t).events || []).find((x) => x.kind === "cart"); if (e.gift.kind === "decor") { k++; if (!C.TUTORS.find((x) => x.id === g.cart.tutor).keep.includes(e.gift.id)) match = false; } } return k > 15 && k < 80 && match; })());
  ok("  keepsakes aren't sold in the shop, and can't be bought", !C.view(s, t).decorShop.some((d) => /^vale_/.test(d.id)) && /NeuroVale/.test(A(Object.assign(JSON.parse(JSON.stringify(s)), {coins: 99999}), "decorPlace", {id: "vale_pond", x: -8, y: -8}, t).error || ""));
  ok("  but one you've been given goes out on the street", (() => { const g = JSON.parse(JSON.stringify(s)); g.dware.vale_pond = 1; return A(g, "decorPlace", {id: "vale_pond", x: -8, y: 8}, t).ok; })());
  ok("  the cart's gone till tomorrow; then a new one comes", !A(r.state, "cartLoad", {}, t).ok && (() => { const g = C.advance(r.state, t + DAY); return g.cart && !g.cart.done && g.cart.tutor === C.tutorFor(t + DAY).id; })());
  // left at midnight half-loaded: paid for what was loaded, no bonus
  const h = JSON.parse(JSON.stringify(s)); h.cart.order[0].got = 10;
  const h2 = C.advance(h, t + DAY);
  ok("an unfinished cart leaves at midnight, paying for what was loaded (no bonus)", h2.coins === h.coins + 10 * C.DISH.waffles.price && h2.cart.day !== h.cart.day);
  ok("customers aren't changed by the cart (its own random numbers)", (() => { const a = C.advance(JSON.parse(JSON.stringify(skipped())), T0 + 3600 * S), b = JSON.parse(JSON.stringify(skipped())); b.xp = 0; const b2 = C.advance(b, T0 + 3600 * S); return a.stats.served === b2.stats.served; })());
  // 2026-10-22 (Cam, emergency fix): counters and fridges full -- a ready dish goes straight from the stove to the cart
  const full = (() => { const g = JSON.parse(JSON.stringify(s)); g.coins = 5000; plates(g).forEach((pl) => { pl.dish = "frenchtoast"; pl.n = 50; pl.since = t; }); return g; })();
  const cookIt = (g, dish) => { const st = stove(g).uid; let x = A(g, "cook", {uid: st, dish}, t); return A(x.state, "serve", {uid: st}, t + C.DISH[dish].secs * S); };
  r = cookIt(full, "waffles");
  ok("counters full: a ready dish the cart wants goes straight from the stove onto the cart", r.ok && r.state.cart.order[0].got === C.DISH.waffles.servings && /cart/.test(r.msg) && !stove(r.state).dish && r.events.some((e) => e.kind === "tocart"), r.error || r.msg);
  ok("  and still counts: XP and a mastery cook", r.ok && r.state.xp > full.xp && r.state.mastery.waffles === 1);
  const near = JSON.parse(JSON.stringify(full)); near.cart.order[0].got = 18; near.cart.order[1].got = 10;
  r = cookIt(near, "waffles");
  const ce2 = (r.events || []).find((e) => e.kind === "cart");
  ok("  past what the order wants: the tutor buys the rest at the usual price, and a full cart pays and goes", r.ok && ce2 && r.state.cart.done
     && r.state.coins === near.coins - C.DISH.waffles.cost + (C.DISH.waffles.servings - 2) * C.DISH.waffles.price + ce2.value + ce2.bonus, r.error || r.msg);
  ok("  a dish the cart doesn't want, or no cart: still no room", (() => { const g = JSON.parse(JSON.stringify(full)); g.cart.order = [{dish: "pancakes", n: 20, got: 0}];
    return !cookIt(g, "waffles").ok && (() => { const g = JSON.parse(JSON.stringify(full)); g.cart.done = true; return !cookIt(g, "waffles").ok; })(); })());
  ok("  with room on the counters it goes on the counters as before", (() => { const g = JSON.parse(JSON.stringify(s)); g.coins = 5000; const x = cookIt(g, "waffles"); return x.ok && x.state.cart.order[0].got === 0; })());
  ok("the sandbox's dev tools bring a cart now (the tutor you ask for)", !A(s, "dev", {op: "cart"}, t).ok && A(C.sandbox(s, t, false), "dev", {op: "cart", v: "pip"}, t).state.cart.tutor === "pip");
}

console.log("\nThe chicken coop (2026-10-23, Cam: two hens that lay eggs you collect, used in recipes)\n");
{
  const MIN_ = 60 * S, t = T0;
  let s = skipped(); s.coins = 5000;
  ok("no coop before the farm (level 3)", !(C.advance(s, t).dware.farm_coop > 0));
  s.xp = C.XP[3]; s = C.advance(s, t);
  ok("at level 3 Farmer Giles leaves a coop in the street things (once)", s.dware.farm_coop === 1 && s.coopGift && C.advance(s, t + MIN_).dware.farm_coop === 1);
  let r = A(s, "decorPlace", {id: "farm_coop", x: -7.5, y: 2.5}, t);
  ok("  put it down free from the warehouse: an empty nest", r.ok && r.state.coins === s.coins && !r.state.dware.farm_coop && C.view(r.state, t).decor.find((d) => d.id === "farm_coop").coop.eggs === 0);
  const u = r.state.decor.find((d) => d.id === "farm_coop").uid, cp = (st, at) => C.view(st, at).decor.find((d) => d.uid === u).coop;
  ok("  one coop till level 10", /second chicken coop comes at level 10/.test(A(r.state, "decorPlace", {id: "farm_coop", x: -10.5, y: 2.5}, t).error || ""));
  ok("  N50 q3: a second, bought, at level 10 -- and no third", (() => { const q = Object.assign(JSON.parse(JSON.stringify(r.state)), {xp: C.XP[10], coins: 5000});
       const x = A(q, "decorPlace", {id: "farm_coop", x: -10.5, y: 2.5}, t); return x.ok && x.state.coins === 5000 - C.DECO.farm_coop.price
       && /Two chicken coops/.test(A(x.state, "decorPlace", {id: "farm_coop", x: -13.5, y: 2.5}, t).error || ""); })());
  ok("two hens: an egg every 15 minutes between them", C.COOP.hens === 2 && cp(r.state, t + 15 * MIN_ - S).eggs === 0 && cp(r.state, t + 15 * MIN_).eggs === 1 && cp(r.state, t + 60 * MIN_).eggs === 4);
  ok("  a full nest (12) and they stop laying till you collect", cp(r.state, t + 3 * 60 * MIN_).full && cp(r.state, t + 9 * 60 * MIN_).eggs === 12);
  ok("  nothing to collect yet: says so", !A(r.state, "eggs", {uid: u}, t + MIN_).ok);
  let e = A(r.state, "eggs", {uid: u}, t + 50 * MIN_);
  ok("collect: the eggs into the pantry, a little XP", e.ok && e.state.pantry.egg === 3 && e.state.xp === r.state.xp + 3 && e.events.some((x) => x.kind === "eggs" && x.n === 3));
  ok("  the next egg keeps its place (no time lost)", cp(e.state, t + 60 * MIN_ - S).eggs === 0 && cp(e.state, t + 60 * MIN_).eggs === 1);
  const full = A(r.state, "eggs", {uid: u}, t + 6 * 60 * MIN_).state;
  ok("  from a full nest the hens start again from then", cp(full, t + 6 * 60 * MIN_ + 15 * MIN_).eggs === 1);
  ok("storing the coop brings its eggs with it", (() => { const x = A(r.state, "decorStore", {uid: u}, t + 60 * MIN_); return x.ok && x.state.pantry.egg === 4 && x.state.dware.farm_coop === 1; })());
  ok("eggs are an ingredient: Eggs Benedict, cakes, pancakes ...", ["benedict", "honeycake", "carrotcake", "pancakes", "omelette", "custardtart"].every((d) => C.DISH[d].needs.egg > 0) && !C.DISH.tomatosoup.needs.egg && C.goodName("egg") === "Eggs");
  ok("  the cookbook shows the eggs a dish needs", C.view(e.state, t).cookbook.find((d) => d.id === "pancakes").needs.some((n) => n.crop === "egg" && n.name === "Eggs" && n.have === 3));
  ok("  with the eggs and the wheat in the pantry, pancakes cook free", (() => { const g = JSON.parse(JSON.stringify(e.state)); g.pantry.wheat = 5; const x = A(g, "cook", {uid: stove(g).uid, dish: "pancakes"}, t + 50 * MIN_); return x.ok && x.state.coins === g.coins && x.state.pantry.egg === 2 && x.state.pantry.wheat === 4; })());
  ok("the sandbox's dev tools fill the nests", (() => { const sb = C.sandbox(r.state, t, false); const x = A(sb, "dev", {op: "eggs"}, t); return x.ok && C.view(x.state, t).decor.find((d) => d.id === "farm_coop").coop.full; })());
  ok("the coop, its hens and the egg are painted", ["prop-farm_coop", "hen-white", "hen-brown", "item-egg"].every((id) => fs.existsSync(path.join(APP, "ui", "cafe", "art", id + ".webp"))));
}

console.log("\nThe farm: plots dug with the plow, Farmer Giles's seeds, cooking with the harvest (2026-10-22, Cam)\n");
{
  const MIN_ = 60 * S;
  ok("no farm before level 3", !C.view(skipped(), T0).field && !A(skipped(), "plow", {x: -7, y: 1}, T0).ok);
  let s = skipped(), t = T0; s.xp = C.XP[5]; s.coins = 1000; s = C.normal(s);
  ok("at level 3 the plow: no plots until you dig them (no grid, no for-sale sign)", s.field.length === 0 && C.view(s, t).field.allowed === 4 && C.unlocksAt(3).some((u) => u.kind === "field"));
  let r = A(s, "plow", {x: -7, y: 1}, t);
  ok("dig a plot on any free tile outside: the first four free", r.ok && r.state.field.length === 1 && r.state.field[0].x === -7 && r.state.field[0].y === 1 && r.state.coins === 1000);
  ok("  not on the road, the pavement's walking line, inside the café, another plot, or a street thing", /road/.test(A(s, "plow", {x: -3, y: 1}, t).error || "") && /pavement/.test(A(s, "plow", {x: -5, y: 1}, t).error || "")
     && /inside/.test(A(s, "plow", {x: 1, y: 1}, t).error || "") && /plot there/.test(A(r.state, "plow", {x: -7, y: 1}, t).error || "")
     && (() => { const g = JSON.parse(JSON.stringify(s)); g.decor.push({uid: 9991, id: "bench", x: -8.5, y: 2.5, dir: 0}); return /bench/.test(A(g, "plow", {x: -9, y: 2}, t).error || ""); })());
  ok("  plots in front of the café are fine too", A(s, "plow", {x: 2, y: s.size + 2}, t).ok);
  ok("  street things can't go on a plot", /plot/.test(A(Object.assign(JSON.parse(JSON.stringify(r.state)), {coins: 999}), "decorPlace", {id: "bin", x: -6.5, y: 1.5}, t).error || ""));
  let f = r.state; for (const [x, y] of [[-7, 2], [-8, 1], [-8, 2]]) f = A(f, "plow", {x, y}, t).state;
  ok("  your level's number: four at level 3, eight from 6, more later", f.field.length === 4 && /allows 4/.test(A(f, "plow", {x: -9, y: 1}, t).error || "") && C.plotsAllowed(6) === 8 && C.plotsAllowed(20) === 16 && C.plotsAllowed(50) === 32);
  ok("  after the first four each costs a little more", (() => { const g = JSON.parse(JSON.stringify(f)); g.xp = C.XP[6]; const x = A(g, "plow", {x: -9, y: 1}, t); return x.ok && x.state.coins === g.coins - C.plotPrice(4) && C.plotPrice(5) > C.plotPrice(4) && x.state.field[4].paid === C.plotPrice(4); })());
  ok("  a plot moves (crop and all) and fills in, giving back half what it cost", (() => { let g = A(f, "plant", {plot: f.field[0].uid, crop: "wheat"}, t).state; const u = g.field[0].uid; g = A(g, "plotMove", {uid: u, x: -9, y: 3}, t).state; const moved = g.field[0].x === -9 && g.field[0].crop === "wheat"; const x = A(g, "plotRemove", {uid: u}, t); return moved && x.ok && x.state.field.length === 3 && x.state.coins === g.coins; })());
  // sowing: Giles's seed for coins, or a packet you were given
  const P = f.field.map((p) => p.uid);
  r = A(f, "plant", {plot: P[0], crop: "strawberry"}, t);
  ok("sowing buys the seed from Farmer Giles", r.ok && r.state.coins === f.coins - C.CROP.strawberry.seed && r.state.field[0].crop === "strawberry");
  ok("  a seed packet sows for free (and is used up)", (() => { const g = JSON.parse(JSON.stringify(f)); g.seeds = {wheat: 2}; const x = A(g, "plant", {plot: P[1], crop: "wheat"}, t); return x.ok && x.state.coins === g.coins && x.state.seeds.wheat === 1; })());
  ok("  crops wait for their level; one crop a plot; there's no sow-on-every-plot", /level 10/.test(A(f, "plant", {plot: P[1], crop: "carrot"}, t).error || "") && !A(r.state, "plant", {plot: P[0], crop: "wheat"}, t).ok && !A(f, "plantAll", {crop: "wheat"}, t).ok);
  const stages = [0, 0.3, 0.7, 1].map((x) => C.view(r.state, t + x * C.CROP.strawberry.mins * MIN_).field.plots[0].stage);
  ok("  it grows through NeuroFarm's four stages", stages.join() === "1,2,3,4", stages.join());
  ok("  not ready, not picked", !A(r.state, "harvest", {plot: P[0]}, t + MIN_).ok);
  const xp0 = r.state.xp;
  r = A(r.state, "harvest", {plot: P[0]}, t + C.CROP.strawberry.mins * MIN_);
  ok("ripe: picked into the pantry, a little XP, the plot empty again", r.ok && r.state.pantry.strawberry === 3 && r.state.xp > xp0 && !r.state.field[0].crop && r.state.field[0].last === "strawberry" && r.events.some((e) => e.kind === "harvest"));
  let h = r.state; P.forEach((u) => { h = A(h, "plant", {plot: u, crop: "blackberry"}, t).state; });
  r = A(h, "harvestAll", {}, t + C.CROP.blackberry.mins * MIN_);
  ok("  pick every ripe plot at once (Shift-click)", r.ok && r.state.pantry.blackberry === 12);
  // 2026-10-23 (Cam): a ripe crop spoils if it isn't picked within the time it took to grow
  {
    const sw = A(f, "plant", {plot: P[0], crop: "strawberry"}, t).state, grow = C.CROP.strawberry.mins * MIN_;
    const at = (x) => C.view(sw, t + x).field.plots[0];
    ok("a ripe crop waits as long again as it took to grow, then goes over", at(grow).ready && !at(grow).spoiled && at(2 * grow - S).ready && at(2 * grow).spoiled && !at(2 * grow).ready && at(grow).spoilsIn === grow);
    const cl = A(sw, "harvest", {plot: P[0]}, t + 2 * grow);
    ok("  picking one gone over clears the plot -- nothing into the pantry, no XP", cl.ok && !cl.state.field[0].crop && !(cl.state.pantry.strawberry > (sw.pantry.strawberry || 0)) && cl.state.xp === sw.xp && cl.events.some((e) => e.kind === "cleared"));
    let two = A(sw, "plant", {plot: P[1], crop: "wheat"}, t).state;
    const all = A(two, "harvestAll", {}, t + 2 * grow + 1000);   // strawberries gone over, the wheat (5 min) ripe
    ok("  picking everything picks the ripe and clears the gone-over", all.ok && all.state.field.slice(0, 2).every((p) => !p.crop) && all.state.pantry.wheat === (two.pantry.wheat || 0) + C.CROP.wheat.yield);
    const old = JSON.parse(JSON.stringify(sw)); delete old.cropKeep;
    // (2026-11-07, Cam: "for unspoil potion make it work for plants only")
    const fr = JSON.parse(JSON.stringify(sw)); fr.inv = {fresh: 1};
    const fp = A(fr, "usePotion", {kind: "fresh", plot: P[0]}, t + 2 * grow + S);
    ok("a Fresh potion on a plot gone over: ripe again, with its whole time to be picked", fp.ok && fp.state.inv.fresh === 0 && (() => { const pl = C.view(fp.state, t + 2 * grow + S).field.plots[0]; return pl.ready && !pl.spoiled && pl.spoilsIn === grow; })(), fp.error);
    ok("  not on a plot still growing or ripe", !A(fr, "usePotion", {kind: "fresh", plot: P[0]}, t + S).ok && !A(fr, "usePotion", {kind: "fresh", plot: P[0]}, t + grow).ok);
    ok("  the page: a potion stays in hand after each use until Esc or the last one (16 Nov)", /function potionUsed\(r\) \{[^]*?state\.inv\[potionMode\][^]*?if \(left > 0\) return toast[^]*?potionMode = null/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"))
       && (fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8").match(/act\("usePotion", \{ kind: potionMode[^\n]*\n[^\n]*potionUsed\(r\)/g) || []).length === 2);
    ok("  the page: clicking a plot with a potion in hand uses it there", /potionMode && !build\) \{[^]*?act\("usePotion", \{ kind: potionMode, plot:/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8")));
    ok("  a crop that was ripe before the rule gets a full window from now (once)", (() => { const g = C.advance(old, t + 10 * grow); const pl = C.view(g, t + 10 * grow).field.plots[0]; return pl.ready && pl.spoilsIn === grow && g.cropKeep; })());
  }
  ok("the farm things for round the plots: fences, a windmill, a barn ... on Buy's Farm tab", C.DECOR.filter((d) => d.farm).length === 9 && C.view(s, t).decorShop.some((d) => d.id === "farm_windmill" && d.farm)
     && C.DECOR.filter((d) => d.farm).every((d) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "prop-" + d.id + ".webp"))));
  // seeds cost money, but growing a dish's ingredients costs under half of cooking it with bought ones (Cam)
  // (eggs come free from the hens: only the crops' seed counts)
  const ratio = (d) => Object.keys(d.needs).filter((k) => C.CROP[k]).reduce((a, k) => a + d.needs[k] * C.CROP[k].seed / C.CROP[k].yield, 0) / d.cost;
  const withNeeds = C.DISHES.filter((d) => Object.keys(d.needs).some((k) => C.CROP[k]));
  ok("every dish grown from seed costs under half what it costs with bought ingredients -- but not nothing", withNeeds.every((d) => ratio(d) < 0.5) && Math.max(...withNeeds.map(ratio)) > 0.3, Math.max(...withNeeds.map(ratio)).toFixed(2));
  // cooking with the harvest: berry tart is strawberries, blackberries and wheat
  ok("dishes list their ingredients: berry tart is strawberries, blackberries and wheat", Object.keys(C.DISH.berrytart.needs).sort().join() === "blackberry,strawberry,wheat");
  let k = JSON.parse(JSON.stringify(r.state)); k.pantry = {strawberry: 3, blackberry: 12};
  const card = (st) => C.view(st, t).cookbook.find((d) => d.id === "berrytart");
  ok("  the cookbook shows what you have of each, and whether it's all there", card(k).needs.length === 3 && !card(k).field && card(k).needs.find((n) => n.crop === "wheat").have === 0);
  const coins1 = k.coins;
  let c1 = A(k, "cook", {uid: stove(k).uid, dish: "berrytart"}, t);
  ok("  missing one: it costs coins as usual, and the pantry's untouched", c1.ok && c1.state.coins === coins1 - C.DISH.berrytart.cost && c1.state.pantry.strawberry === 3);
  k.pantry.wheat = 5;
  ok("  a dish above your level never says free, whatever's in the pantry", (() => { const g = JSON.parse(JSON.stringify(k)); g.pantry = {wheat: 50}; return !C.view(g, t).cookbook.find((d) => d.id === "custardtart").field; })());
  ok("  all there: the card says free, and the farm price", card(k).field && card(k).farmPrice === Math.max(C.DISH.berrytart.price + 1, Math.round(C.DISH.berrytart.price * 1.25)));
  c1 = A(k, "cook", {uid: stove(k).uid, dish: "berrytart"}, t);
  ok("  cooking it uses the ingredients and no coins", c1.ok && c1.state.coins === coins1 && c1.state.pantry.wheat === 5 - C.DISH.berrytart.needs.wheat && /harvest/.test(c1.msg));
  let g = JSON.parse(JSON.stringify(c1.state)); g.customers = []; g.next = null;
  const plates = (st) => st.items.filter((i) => i.kind === "counter" || i.kind === "buffet").flatMap((i) => i.kind === "buffet" ? i.plates : [i]);
  plates(g).forEach((pl) => { pl.dish = null; pl.n = 0; });
  g = A(g, "serve", {uid: stove(g).uid}, t + C.DISH.berrytart.secs * S).state;
  const pl = plates(g).find((p) => p.dish === "berrytart");
  ok("served: the plate knows its servings are farm-grown", pl && pl.farm === pl.n && pl.n === C.DISH.berrytart.servings);
  g.next = t + C.DISH.berrytart.secs * S + 1000;
  ok("  customers pay the farm price for them (a quarter more)", (() => { const h2 = C.advance(JSON.parse(JSON.stringify(g)), t + C.DISH.berrytart.secs * S + 3 * MIN_); const n = h2.stats.served - g.stats.served;
    return n > 0 && h2.till - g.till === n * C.farmPrice(h2, "berrytart") && C.farmPrice(h2, "berrytart") > C.DISH.berrytart.price; })());
  ok("  a plain cook of the same dish on top: farm servings sell first, the rest at the usual price", (() => { const h2 = JSON.parse(JSON.stringify(g)); const p2 = plates(h2).find((p) => p.dish === "berrytart"); p2.n += 10; h2.customers = []; h2.next = t + C.DISH.berrytart.secs * S + 1000;
    const h3 = C.advance(h2, t + C.DISH.berrytart.secs * S + 90 * MIN_), n = h3.stats.served - h2.stats.served, fp = C.farmPrice(h3, "berrytart"), pp = C.DISH.berrytart.price;
    return n === p2.n && h3.till - h2.till === p2.farm * fp + (p2.n - p2.farm) * pp; })());
  // seeds as gifts: Aunty's box and the cart
  ok("Aunty's box can bring seed packets", (() => { let y = JSON.parse(JSON.stringify(f)); y.xp = C.XP[20]; let seen = 0; for (let d = 1; d < 120; d++) { const at = t + d * 864e5; y = C.advance(y, at); const x = A(y, "aunty", {}, at); if (!x.ok) continue; y = x.state; if (x.events.find((e) => e.kind === "aunty").gifts.some((gg) => gg.kind === "seeds")) seen++; } return seen > 5 && Object.values(y.seeds).some((n) => n > 0); })());
  ok("the request cart can leave seed packets (and still sometimes a potion or a keepsake)", (() => {
    const base = C.advance(JSON.parse(JSON.stringify(f)), t); base.customers = []; base.closed = true;
    base.cart.order = [{dish: "pancakes", n: 5, got: 0}];
    base.items.filter((i) => i.kind === "counter" || i.kind === "buffet").flatMap((i) => i.kind === "buffet" ? i.plates : [i]).forEach((p) => { p.dish = "pancakes"; p.n = 50; p.since = t; });
    const kinds = {};
    for (let i = 0; i < 200; i++) { const y = JSON.parse(JSON.stringify(base)); y.stats.carts = i; const x = A(y, "cartLoad", {}, t); const e = x.ok && x.events.find((ev) => ev.kind === "cart"); if (e) { kinds[e.gift.kind] = (kinds[e.gift.kind] || 0) + 1; if (e.gift.kind === "seeds" && !(x.state.seeds[e.gift.id] >= e.gift.n)) return false; } }
    return kinds.seeds > 40 && kinds.potion > 60 && kinds.decor > 5;
  })());
  ok("the sandbox's dev tools ripen the field and give seed packets", (() => { const sb = C.sandbox(f, t, false); let x = A(sb, "plant", {plot: sb.field[0].uid, crop: "wheat"}, t); x = A(x.state, "dev", {op: "grow"}, t); const y = A(x.state, "dev", {op: "seeds"}, t); return x.ok && C.view(x.state, t).field.plots[0].ready && y.ok && y.state.seeds.wheat === 5; })());
  ok("1.0.134's first field (fixed plots) keeps its plots, each given a place and a uid", (() => { const g = JSON.parse(JSON.stringify(f)); g.field = [{crop: "wheat", at: t}, {}]; const h2 = C.normal(g); return h2.field.length === 2 && h2.field.every((p) => p.uid && p.x != null && p.y != null) && h2.field[0].crop === "wheat"; })());
}

console.log("\nThe page\n");
{
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("the coop on the page: hens by it, the eggs waiting, click to collect; gone-over crops look it", /function henHTML/.test(page) && /function coopTap/.test(page) && /nc-eggs/.test(page) && /\.gone/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8")));
  ok("the farm: plots drawn where dug, the plow on Buy's Farm tab, Farmer Giles's seeds in cookbook cards, ingredients on dish cards, the pantry (a cupboard since 25 Oct)",
     /function seedShop/.test(page) && /function plotTap/.test(page) && /function dropPlotAt/.test(page) && /\{ id: "farm", name: "Farm" \}/.test(page) && /tab\("field"/.test(page) && /nc-rc-needs/.test(page) && /function pantryBook/.test(page)
     && !/data-sowall/.test(page) && ["field-soil", "field-plow", "giles"].every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", k + ".webp"))));
  { const css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8");
    const order = [...page.matchAll(/\+ (?:\(v\.\w+ \? )?tab\("(\w+)"/g)].map((m) => m[1]);
    ok("the menu (Cam, 25 Oct): see-through round buttons down the top left like the eye, in his order -- Buy, Build, Farm, Upgrades, Cookbook, Diary (2026-11-07), Bag, Settings (Aunty's a crate on the street since)",
       /const items = tab\("buy"/.test(page) && JSON.stringify(order.slice(0, 7)) === JSON.stringify(["build", "field", "upgrades", "book", "diary", "bag", "settings"])
       && /#nc-fab \{ position: fixed; left: 14px; top: 64px;/.test(css) && /\.nc-tab:hover \.nc-tab-l/.test(css) && !/round\("menu"/.test(page), order.join());
    ok("  a pop-up drawn again while it's open doesn't pop in again (Cam: the cookbook \"refreshing\" on every click)", /const still = !m\.hidden && m\.dataset\.cls === \(cls \|\| ""\)/.test(page) && /\.nc-card-pop\.still \{ animation: none; \}/.test(css)); }
  ok("the request cart: drawn out the front (cart, horse and tutor), its order sheet with Load buttons, a thank-you; the pictures are in",
     /function cartSheet/.test(page) && /function cartThanks/.test(page) && /data-cart/.test(page) && /act\("cartLoad"/.test(page)
     && ["cart-vale", "tutor-pip", "tutor-wren", "tutor-brakka", "tutor-ilse", "tutor-aldo", "tutor-tamsin", "prop-vale_pond"].every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", k + ".webp"))));
  ok("Aunty's box: a crate on the pavement by the door (Cam, 25 Oct: no button), the box pop-up and her letter; her book and recipe page in the cookbook", !/tab\("aunty"/.test(page) && /class="nc-crate-st" data-aunty/.test(page) && /function auntyDoor/.test(page) && /function auntyLetter/.test(page) && /e\.kind === "aunty"/.test(page)
     && ["icon-crate", "aunty-book", "aunty-page"].every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "ui", k + ".webp"))) && /A family secret/.test(page) && /servings from Aunty/.test(page));
  ok("recipe mastery on every cookbook card: five stars, a hover bubble with each star's cooks and perk, a toast for a new star", /function masteryHTML/.test(page) && /\$\{masteryHTML\(d\)\}/.test(page) && /e\.kind === "mastery"/.test(page)
     && /\.nc-rc-stars:hover \.nc-rc-mastery \{ display: block; \}/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8")));
  const man = fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8");
  const files = JSON.parse(man.split("window.CafeArtFiles = ")[1].split(";\n")[0]);
  const need = ["wall-l", "wall-r", "door-l", "floor-grey", "stove-l", "stove-r", "stove-dirty-l", "stove-dirty-r", "counter-l", "counter-r", "till-l", "till-r",
                "chef-l", "chef-r", "chef-stir", "chef-plate", "book-open", "book-closed", "panel"]
    .concat(...C.DISHES.map((d) => d.secret ? ["dish-" + d.id] : ["cook-" + d.id, "dish-" + d.id, "burnt-" + d.id]))   // (Aunty's: pans wait for Gemini)
    .concat(...["woman", "oldman", "boy"].map((p) => ["tl", "tr", "al", "ar"].map((k) => p + "-" + k)));
  const missing = need.filter((id) => !files[id] || !fs.existsSync(path.join(APP, "ui", "cafe", "art", id + ".webp")));
  ok("every picture the café draws is cut (cooking, served and burnt for every dish; Aunty's secrets served)", !missing.length, missing.join());
  const meta = JSON.parse(man.split("window.CafeArtMeta = ")[1].split(";\n")[0]);
  ok("walls and doors (V20) are cut by the template: all the same size, the face's corners measured, so they join",
     ["wall-l", "wall-r", "door-l", "door-r"].every((id) => JSON.stringify(files[id]) === JSON.stringify(files["wall-l"]) && meta[id] && meta[id].yl > 0 && meta[id].yr > 0)
     && meta["wall-l"].yl > meta["wall-l"].yr && meta["wall-r"].yl < meta["wall-r"].yr && meta["door-l"].yl === meta["wall-l"].yl);
  ok("  placed by those corners, one panel per tile edge, the door's panel in place of a wall panel", /META\[id\]/.test(page) && /r === v\.door \? "door-l" : "wall-l"/.test(page));
  ok("single counters (V20 q3): one floor tile wide, the dish on the counter's top", ["counter-l", "counter-r", "till-l", "till-r"].every((id) => meta[id] && meta[id].tile > 0.9 && meta[id].tile < 1.2)
     && /class="nc-plate" alt="" src="\$\{art\("dish-" \+ it\.dish\.id\)\}" style="top:/.test(page));
  ok("no spoiled dishes on the page any more: no Spoiled picture, no bin, no sandbox spoiling (2026-11-07)", !/spoil-/.test(page) && !/binPlate/.test(page) && !/nospoil/.test(page) && !/\.nc-plate\.spoiled/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8")));
  ok("the Bag (NeuroPets' satchel): potions to use, stored things -- no longer in the Buy tabs (V23 q6)", /tab\("bag"/.test(page) && /function bag\(\)/.test(page) && /act\("usePotion"/.test(page) && !/ware/.test(page.split("function catCards")[1].split("function drawDrawer")[0])
     && ["icon-bag", "potion-fresh", "potion-quick", "potion-sell"].every((f) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "ui", f + ".webp"))));
  ok("the level-up card shows its reward", /nc-lv-reward/.test(page) && /x\.reward && x\.reward\.chest/.test(page));
  ok("one click does the obvious thing on a stove: cook, serve, throw, clean", /if \(!last\) return cookbook\(uid\)/.test(page) && /act\("serve"/.test(page) && /act\("throw"/.test(page) && /act\("clean"/.test(page) && /act\("cancel", \{ uid \}\)/.test(page));
  ok("turned things are the painted facing mirrored (V19 q3)", /flip: dir >= 2/.test(page));
  ok("pop-ups are the game's own (no window.confirm)", !/window\.confirm|\balert\(/.test(page));
  ok("the buffet counter's picture is made (both facings), one tile longer than a single counter", ["buffet-l", "buffet-r"].every((id) => files[id] && meta[id] && Math.abs(meta[id].tile - meta["counter-l"].tile - 1) < 0.15));
  ok("people stand with their feet on their spot (not half a tile up)", /el\.style\.top = Math\.round\(xy\.y - s\.h \* foot \+ 3/.test(page));
  const css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8"), html = fs.readFileSync(path.join(APP, "ui", "neurocafe.html"), "utf8");
  ok("the NeuroPets frames are NeuroCafe's own copies (art/ui), not reached across into ui/pet",
     ["popup-frame", "title-ribbon"].every((n) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "ui", n + ".png")) && css.includes(`art/ui/${n}.png`)) && !/\.\.\/pet\//.test(css + page));
  ok("the cookbook: a book -- menu tabs off its left edge, the dishes' pictures on the left page, the one picked on the right with Cook (Cam, 2026-10-24)",
     /class="nc-cb-tabs2"/.test(page) && /data-pick=/.test(page) && /class="nc-cb-detail"/.test(page) && /data-dish="\$\{d\.id\}"/.test(page) && /data-sort=/.test(page) && /"book cookbook"/.test(page) && /\.nc-card-pop \{[^}]*popup-frame/.test(css));
  ok("the sandbox: a button to switch, the dev tools panel only there, saved to its own slot",
     /data-slot/.test(page) && /Store\.call\("cafe_save", \[snap, into\]\)/.test(page) && /id="nc-dev"/.test(html) && /act\("dev"/.test(page));
  ok("Sheet 06's painted street textures and Sheet 07's street things are cut, and used when there",
     ["tex-grass", "tex-pavement", "tex-road"].every((id) => files[id]) && ["lamp", "tree", "bench", "bin", "aframe"].every((id) => files["prop-" + id])
     && /tex\("tex-grass"/.test(page) && /function propFace/.test(page));
  ok("walking frames (Characters Sheet 02): the woman and the old man, both ways; as many frames as were painted, each as tall as standing",
     ["woman-ar", "oldman-tl", "oldman-ar", "boy-tl", "boy-ar"].every((k) => files[k + "-1"] && files[k + "-2"]) && /while \(has\(`\$\{who\}-\$\{base\}-\$\{n \+ 1\}`\)\) n\+\+/.test(page) && /stand\.h \/ tall/.test(page));
  ok("no sidebar: round buttons instead -- Cookbook, Build (a maul) and Buy (the old coin) bottom left, Settings bottom right with the sandbox (PT52)",
     !/nc-side/.test(html) && !/nc-side/.test(css) && /id="nc-fab-r"/.test(html) && /tab\("book"/.test(page) && /icon-maul/.test(page) && /icon-coin/.test(page)
     && /tab\("settings"/.test(page) && /function settings\(\)/.test(page) && fs.existsSync(path.join(APP, "ui", "cafe", "art", "ui", "icon-coin.webp")) && fs.existsSync(path.join(APP, "ui", "cafe", "art", "ui", "icon-maul.webp")));
  ok("the confirm buttons only light up on hover -- the sidebar's dark row style no longer lands on them (N44)", !/\.nc-row:hover/.test(css));
  ok("the build menu stays where it's scrolled when a sale redraws it (PT52)", /function keepScroll/.test(page) && (page.match(/if \(!keepScroll\(d, html\)\)/g) || []).length === 2);
  ok("music: Cam's lofi, quiet, round again when it ends, a Settings volume, paused while hidden (V22 q5)", fs.existsSync(path.join(APP, "ui", "cafe", "music", "lofi.ogg")) && /addEventListener\("ended", next\)/.test(page) && /data-vol/.test(page) && /visibilitychange/.test(page));
  ok("the jukebox (Q8): the café radio (shuffled) or a playlist (in order, or shuffled), from right-clicking a jukebox or Settings; remembered as prefs",
     /function jukebox\(/.test(page) && /th\.dataset\.kind === "jukebox"\) return jukebox\(\)/.test(page) && /data-jukebox/.test(page) && /src === "radio" \|\| shuffle \? mixed\(list\)/.test(page)
     && C.prefs({prefs: {src: "pl:abcdef123456", shuffle: true}}).src === "pl:abcdef123456" && C.prefs({prefs: {src: "../x"}}).src === "radio" && /media-src 'self' http:\/\/127\.0\.0\.1:\*/.test(html));
  ok("Build (floors, walls, expansions) and Buy (furniture, decor, stoves, counters, outside) tabs (N43; tabs since 2026-10-24)",
     /id="nc-fab"/.test(html) && /tab\("build"/.test(page) && /tab\("buy"/.test(page) && /\["floors", "Floors"\], \["walls", "Walls"\], \["hwalls", "Half walls"\], \["terrain", "Terrain"\], \["expand", "Expansions"\]/.test(page)
     && /const BUY_TABS = SECTIONS\.map/.test(page) && /\.nc-tab \{/.test(css));
  // 2026-10-24 (Cam: "redesign the buy menu ... sections, then each section broken into categories", Cafeland / the Sims 3)
  ok("the Buy menu: sections along the top, each split into categories (a row of pictures, All first), then the cards",
     ["kitchen", "dining", "decor", "lighting", "fun", "outside", "farm"].every((k) => new RegExp(`id: "${k}", name: "`).test(page))
     && ["stoves", "counters", "safety", "tables", "chairs", "stools", "sofas", "paintings", "weapons", "plants", "stands", "lamps", "machines", "vending"].every((k) => new RegExp(`\\{ id: "${k}", name: "`).test(page))
     && /catBtn\("all", "All", ALL_STAR\)/.test(page) && /data-cat=/.test(page) && /\.nc-dcats \{/.test(css) && /filter\(\(x\) => x\.cards\)/.test(page));
  ok("walls papered a panel at a time, click or drag (N43)", /data-wall="\$\{key\}"/.test(page) && /act\("wallPaint"/.test(page) && /nc-papering/.test(css));
  ok("street build mode: place on the ground, pick one to move, turn, store or sell", /act\("decorPlace"/.test(page) && /"decorTurn"/.test(page) && /"decorStore"/.test(page) && /"decorSell"/.test(page) && /function groundAt/.test(page));
  ok("the wheel zooms towards the pointer, from 0.45x to 5x", /Math\.max\(0\.45, Math\.min\(5,/.test(page));
  ok("day and night by the clock, the café cut out of the dusk and lit; lamps glow after dark; the sandbox sets the sky (PT45)",
     /function skyNow/.test(page) && /clip-path:polygon\(evenodd/.test(page) && /nc-lampglow/.test(page) && /data-dv="sky"/.test(page) && /mix-blend-mode: multiply/.test(css));
  ok("dev tools sell a dish now, or everything (PT44)", /data-dv="sell"/.test(page) && /data-dv="sellAll"/.test(page));
  ok("a smaller window: the top bar tightens (PT44)", /@media \(max-width: 760px\)/.test(css));
  ok("walking frames for all three both ways (the woman's towards ones drawn one at a time from pose pictures, N37)",
     ["woman", "oldman", "boy"].every((w) => [1, 2, 3, 4].every((i) => files[`${w}-tl-${i}`] && files[`${w}-ar-${i}`])));
  ok("someone sitting with their back to us is behind the chair's back (PT49) -- but never behind a stool's (N41)", /\(ch >= 2 && !stool && !lowSeat \? -1 : 7\)/.test(page));
  ok("chairs turn four ways: front, front mirrored, back up-left (-bl), back up-right (-br) -- as C.FACE (N39)", /d < 2 \? kind \+ "-l" : kind \+ \(d === 2 \? "-bl" : "-br"\)/.test(page) && /flip: d === 1/.test(page));
  ok("no endless CSS animations: the page's clock steps them (N40)", !/infinite/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8")) && /nc-sway/.test(page) && /document\.hidden/.test(page));
  ok("numbers changing swap just those things, not the whole café (N40)", /function patchThings/.test(page) && /if \(!patchThings\(v\)\) drawWorld\(v\)/.test(page));
  ok("the coin machines are sold in Buy > Fun (PT53: they had no tab)", /name: "Coin machines", pic: "jukebox-l", thing: \(k, T\) => T\.machine/.test(page));
  ok("a tip on a table shows and is picked up with a click (N42)", /act\("tip", \{ uid \}\)/.test(page));
  ok("an Upgrades round button; clicking a counter opens its sheet with the fridge component (2026-10-21)", /tab\("upgrades"/.test(page) && /return counterSheet\(uid\)/.test(page) && /act\("upgrade", \{ uid: \+b\.dataset\.uid, part: b\.dataset\.upg \}\)/.test(page));
  ok("  a fridge counter shows what's cold under it", /class="nc-cold"/.test(page));
  ok("the clock: the real time, top centre, see-through, with the rush under it (2026-10-21)", /id="nc-clock"/.test(html) && /function drawClock/.test(page) && /\.nc-clock \{ position: absolute; top: 10px; left: 50%/.test(css) && /rgba\(255, 255, 255, \.42\)/.test(css) && /data-dv="rush"/.test(page));
  ok("N49 i1: another of the same stays in your hand while there's one to have (bought as it's put down)", /function canHave/.test(page) && /build = canHave\(vv, kind\) \? \{ on: true, place: kind/.test(page) && /act\("buy", \{ kind \}\)/.test(page));
  ok("N49 i2: Shift+arrows move what you hold a tile, Enter puts it down", /function nudge/.test(page) && /arrow && e\.shiftKey/.test(page) && /function dropHeld/.test(page));
  ok("N49 i3: drag a thing in Build to move it", /thingDrag = \{ uid: \+th\.dataset\.uid/.test(page) && /dropItemAt\(tileAt\(v, e\)\)/.test(page));
  ok("N49 i4: a right-click turns what you hold, or backs out (outside Build mode, on furniture: its swatches)", /if \(!turnHeld\(1\)\) back\(\);/.test(page) && /const th = !build && !hold && e\.target\.closest/.test(page));
  ok("N49 i5: a red ghost says why", /function ghostWhy/.test(page) && /class="nc-why"/.test(page) && /\.nc-why/.test(css));
  ok("N49 i6: the customers' walks show while you hold something", /function walkHTML/.test(page) && /nc-walk/.test(css));
  ok("N49 i7: chairs face a table by themselves until turned", /C\.autoFace\(state, kind, hover\.x, hover\.y/.test(page) && /build\.turned = true/.test(page));
  ok("N49 i8: keys for the round buttons (F for the field; none for Aunty) and for a picked thing (T stores)", /const MENU_KEYS = \{ b: "build", u: "buy", c: "book", g: "bag", p: "upgrades", f: "field", l: "diary" \}/.test(page) && /m: "move", t: "store", delete: "sell"/.test(page));
  ok("WASD pans the camera (held keys glide the view)", /const PAN_KEYS = \{ w: \[0, 1\], s: \[0, -1\], a: \[1, 0\], d: \[-1, 0\] \}/.test(page) && page.includes("requestAnimationFrame(panStep)"));
  ok("N49 i9: double-click or Space on a free stove cooks the same again", /function sameAgain/.test(page) && /stoveTap/.test(page) && /e\.key === " "/.test(page));
  ok("N49 i10: sweep over the stoves to serve and clean", /sweep = new Set/.test(page) && /act\("serve", \{ uid \}\); else if \(st === "dirty"\) act\("clean"/.test(page));
  ok("N49 i11: Ctrl+Z in Build, cleared when Build closes", /function undoLast/.test(page) && /UNDOABLE/.test(page) && /if \(!build\) \{ undo\.length = 0/.test(page));
  ok("N49 i12: a floor, wallpaper or painting card tried on in place (counter styles: at the furniture store now)", /function peeked/.test(page) && /function setPeek/.test(page) && /\{ hang: b\.dataset\.hangbuy \}/.test(page));
  ok("N49 i13: Alt+click picks up a copy", /e\.altKey && it\.kind !== "till"/.test(page) && /e\.altKey && dc/.test(page));
  ok("the arrow keys (or R) turn what you're holding, live, in build mode (play test team)", /ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1/.test(page) && /function turnHeld/.test(page) && /dir: heldDir\(v\)/.test(page) && /dir: build\.dir, free: freePlace \}\)/.test(page));
  ok("the top bar shows customers a minute, with what draws them", /nc-pop/.test(page) && /p\.variety/.test(page) && /function popTip/.test(page));
  ok("build mode hears the pointer over the whole view, not just the café's box (PT47)", /view_\.onclick = /.test(page) && /view_\.onmousemove = /.test(page));
  ok("street things painted both ways (Sheets 08-09), one facing mirrored where only one came", ["bench", "aframe", "bikerack", "picnic", "fence", "planter", "hedge", "bin", "postbox"].every((id) => files[`prop-${id}-l`] && files[`prop-${id}-r`]) && files["prop-sign-l"]);
  ok("the Open / Closed sign in the top bar", /data-sign/.test(page) && /act\("setOpen"/.test(page));
  ok("the café is on its corner: grass, pavements and the road under it, and people walking by", /function groundSVG/.test(page) && /nc-brick/.test(page) && /const WALKS/.test(page) && !/function streetPlan/.test(page));
}

console.log("\nHalloween: candy, the haunted mansion, things yours for good (Cam, 2026-10-24)\n");
{
  const man = fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8");
  const OCT = Date.UTC(2026, 9, 20, 9), OCT9 = new Date(2026, 9, 9, 12).getTime(), OCT10 = new Date(2026, 9, 10, 0, 1).getTime(), OCT31 = new Date(2026, 9, 31, 23).getTime(), NOV1 = new Date(2026, 10, 1, 0, 1).getTime(), DEC = Date.UTC(2026, 11, 5, 12);
  const put = (st, kind, x, y, t) => { let q = A(st, "buy", {kind}, t); if (!q.ok) throw new Error(q.error); q = A(q.state, "place", {kind, x, y, dir: 0}, t); if (!q.ok) throw new Error(q.error); return q.state; };
  const base = (t) => Object.assign(skipped(t), {xp: C.XP[20], coins: 1e6, size: 8});
  ok("93 Halloween things to unlock (V25: + low furniture, readers, 16 town things, 8 for the walls, 4 guests; N67: 13 pieces of furniture), each pictured (dishes cook, serve and burn)", C.EVENT_ITEMS.length === 93 && C.EVENT_ITEMS.every((x) => x.candy > 0 && man.includes(`"${x.pic}"`))
     && C.DISHES.filter((d) => d.event).every((d) => ["cook", "dish", "burnt"].every((k) => man.includes(`"${k}-${d.id}"`))) && man.includes('"wall-bats-r"') && man.includes('"door-graveyard-l"'));
  const s0 = base(OCT);
  ok("candy and the mansion from 10 to 31 October (Cam, 2026-11-01)", C.eventOn(s0, OCT) && C.eventOn(s0, OCT10) && C.eventOn(s0, OCT31) && !C.eventOn(s0, OCT9) && !C.eventOn(s0, NOV1) && !C.eventOn(s0, DEC)
     && C.mansionTime(s0, OCT) && !C.mansionTime(s0, OCT9) && !C.mansionTime(s0, NOV1));
  let s = A(s0, "cook", {uid: stove(s0).uid, dish: "pancakes"}, OCT).state, r = A(s, "serve", {uid: stove(s).uid}, OCT + 12 * S);
  ok("  a candy for every dish served in the season", r.ok && r.state.candy === 1 && r.events.some((e) => e.kind === "candy"));
  const d0 = base(DEC), dr = A(A(d0, "cook", {uid: stove(d0).uid, dish: "pancakes"}, DEC).state, "serve", {uid: stove(d0).uid}, DEC + 12 * S);
  ok("  none in December", dr.ok && dr.state.candy === 0);
  ok("the mansion can't go up in December", /October/.test(A(d0, "decorPlace", {id: "mansion", x: -6, y: 3}, DEC).error || ""));
  s = A(s0, "decorPlace", {id: "mansion", x: -6, y: 3}, OCT).state;
  ok("  in October it can, once", s.decor.some((o) => o.id === "mansion") && /already/.test(A(s, "decorPlace", {id: "mansion", x: -9, y: 6}, OCT).error || ""));
  ok("Halloween things are locked till unlocked with candy", /candy/.test(A(s, "buy", {kind: "jackolantern"}, OCT).error || "") && /candy/.test(A(s, "style", {what: "wall", id: "bats"}, OCT).error || "")
     && /candy/.test(A(s, "hang", {id: "painting-hw1", side: "r", i: 1}, OCT).error || "") && /candy/.test(A(s, "decorPlace", {id: "hw_ghost", x: -6, y: 6}, OCT).error || "")
     && !C.view(s, OCT).cookbook.find((d) => d.id === "pumpkinsoup").open && !C.view(s, OCT).decorShop.some((o) => o.id === "hw_ghost"));
  ok("  not enough candy: no", /candy/.test(A(s, "candyBuy", {id: "jackolantern"}, OCT).error || ""));
  s.candy = 500;
  ok("  no haunted house, no shop", /haunted house/.test(A(Object.assign(base(OCT), {candy: 500}), "candyBuy", {id: "jackolantern"}, OCT).error || ""));
  ["jackolantern", "bats", "painting-hw1", "hw_ghost", "pumpkinsoup", "fortune"].forEach((id) => { const q = A(s, "candyBuy", {id}, OCT); if (!q.ok) throw new Error(q.error); s = q.state; });
  ok("  unlocked: the candy's spent and they're yours", s.candy === 500 - [20, 50, 40, 45, 45, 150].reduce((a, b) => a + b, 0) && /yours already/.test(A(s, "candyBuy", {id: "bats"}, OCT).error || ""));
  ok("  yours for good, for coins, even after the season", (() => { let q = put(s, "jackolantern", 5, 5, DEC); q = A(q, "style", {what: "wall", id: "bats"}, DEC).state; q = A(q, "hang", {id: "painting-hw1", side: "r", i: 1}, DEC).state;
       q = A(q, "decorPlace", {id: "hw_ghost", x: -6, y: 6}, DEC).state; return q.items.some((i) => i.kind === "jackolantern") && q.style.wall === "bats" && q.hang.r1 === "painting-hw1" && q.decor.some((o) => o.id === "hw_ghost")
       && C.view(q, DEC).cookbook.find((d) => d.id === "pumpkinsoup").open && A(q, "cook", {uid: stove(q).uid, dish: "pumpkinsoup"}, DEC).ok; })());
  ok("  the mansion's closed after 31 October", /closed/.test(A(s, "candyBuy", {id: "cauldron"}, DEC).error || ""));
  const tb = Object.assign(JSON.parse(JSON.stringify(s)), {}); tb.items.push({uid: 900, kind: "table", x: 6, y: 6, dir: 0, candy: 4, tip: 2});
  r = A(tb, "tip", {uid: 900}, OCT);
  ok("candy left on a table is picked up with its tip", r.ok && r.state.candy === tb.candy + 4 && r.state.coins === tb.coins + 2);
  ok("Halloween's things never show in a level's unlocks, and Aunty never sends its dishes", Array.from({length: 100}, (_, i) => i + 1).every((l) => !C.unlocksAt(l).some((u) => (C.THINGS[u.id] && C.THINGS[u.id].event) || (C.DISH[u.id] && C.DISH[u.id].event) || u.id === "mansion")));
  ok("the sandbox's dev tools switch Halloween on or off", (() => { const sb = Object.assign(base(DEC), {sandbox: true}); const on = A(sb, "dev", {op: "event"}, DEC).state; const off = A(on, "dev", {op: "event"}, DEC).state; return C.eventOn(on, DEC) && !C.eventOn(off, OCT); })());
}

console.log("\nN47 a6: fences drag in a line\n");
ok("the fences are fences (the drag tool's), the rest aren't", ["fence", "farm_fence", "hw_crow"].every((id) => C.DECO[id].fence) && !C.DECO.lamp.fence
   && fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8").includes("function lineDrop"));
{
  const t = T0; let s = Object.assign(skipped(t), {xp: C.XP[30], coins: 1e6, size: 6});
  ok("PT56: a fence goes onto the nearest tile edge its way (along x at i+0.5, along y at j+0.5)", JSON.stringify(C.fenceAt(-6.2, 4.4, 0)) === '{"x":-6.5,"y":4,"dir":0}' && JSON.stringify(C.fenceAt(-6.2, 4.4, 3)) === '{"x":-6,"y":4.5,"dir":1}');
  // a box: x from -9 to -7, y from 4 to 6 -- segments on its four sides, corners shared
  const box = [[-8.5, 4, 0], [-7.5, 4, 0], [-8.5, 6, 0], [-7.5, 6, 0], [-9, 4.5, 1], [-9, 5.5, 1], [-7, 4.5, 1], [-7, 5.5, 1]];
  box.forEach(([x, y, dir]) => { const r = A(s, "decorPlace", {id: "farm_fence", x, y, dir}, t); if (!r.ok) throw new Error(r.error); s = r.state; });
  ok("  a fenced box: eight segments round it, meeting at the corners", s.decor.filter((o) => o.id === "farm_fence").length === 8);
  ok("  plots dig inside it, right up to the fence", ["plow"].every(() => { let q = s; for (const [x, y] of [[-9, 4], [-8, 4], [-9, 5], [-8, 5]]) { const r = A(q, "plow", {x, y}, t); if (!r.ok) return false; q = r.state; } return q.field.length === 4; }));
  ok("  and a fence can run along a plot's edge", (() => { const q = A(Object.assign(skipped(t), {xp: C.XP[30], coins: 1e6, size: 6}), "plow", {x: -9, y: 8}, t).state; return A(q, "decorPlace", {id: "fence", x: -8.5, y: 8, dir: 0}, t).ok && A(q, "decorPlace", {id: "fence", x: -8.5, y: 8.5, dir: 0}, t).ok; })());
  ok("  old fences go onto an edge when the café loads", (() => { const q = JSON.parse(JSON.stringify(s)); q.decor.push({uid: 999, id: "fence", x: -12.25, y: 7.75, dir: 2}); const o = C.normal(q).decor.find((d) => d.uid === 999); return o.x === -12.5 && o.y === 8 && o.dir === 0; })());
}

console.log("\nPT56: two-tone things and photo frame paints\n");
{
  const t = T0; let s = Object.assign(skipped(t), {xp: C.XP[80], coins: 1e6, size: 8}); s.dev = Object.assign(s.dev || {}, {allPaints: true});
  s = A(stock(s, "halfwall").state, "place", {kind: "halfwall", x: 4, y: 4, dir: 0}, t).state;
  const u = s.items.find((i) => i.kind === "halfwall").uid;
  s = A(A(s, "tint", {uid: u, h: 0, s: 0.2, b: 0.5, sw: "Charcoal"}, t).state, "tint", {uid: u, part: 2, h: 340, s: 1.5, b: 0.9, sw: "Red"}, t).state;
  const it = C.view(s, t).items.find((i) => i.uid === u);
  ok("the half wall: black panels with a red top rail -- two paints, kept apart", it.tint.sw === "Charcoal" && it.tint2.sw === "Red" && C.THINGS.halfwall.parts[1] === "Top rail");
  ok("  a one-colour thing has no second part", /only one colour/.test(A(A(stock(s, "lattice").state, "place", {kind: "lattice", x: 6, y: 6, dir: 0}, t).state, "tint", {uid: s.seq + 1, part: 2, h: 10, s: 1, b: 1}, t).error || ""));
  ok("  the two-tone layers are cut (half wall, brick wall, banner)", ["halfwall-l", "halfwall-r", "halfbrick-l", "halfbrick-r", "barrier-l", "barrier-r"].every((id) => fs.existsSync(path.join(APP, "ui", "cafe", "art", id + "-fab2.webp"))));
  s = A(s, "hang", {id: "photo-oak", side: "l", i: 1, photo: "abc123def"}, t).state;
  s = A(s, "hangTint", {key: "l1", h: 150, s: 1.1, b: 0.95, sw: "Teal"}, t).state;
  ok("a photo frame takes a paint, and keeps it when moved", C.view(s, t).hangTint.l1.sw === "Teal" && A(s, "moveHang", {from: "l1", side: "r", i: 2}, t).state.hangTint.r2.sw === "Teal");
  ok("  taking it down clears it; a window can't be painted", !A(s, "unhang", {from: "l1"}, t).state.hangTint.l1 && /Only a framed picture/.test(A(A(s, "hang", {id: "window-1", side: "r", i: 1}, t).state, "hangTint", {key: "r1", h: 10, s: 1, b: 1}, t).error || ""));
  const sp = A(A(s, "hang", {id: "coffee", side: "r", i: 1}, t).state, "hangTint", {key: "r1", h: 30, s: 1, b: 0.6, sw: "Walnut"}, t);
  ok("  a painting's frame takes a paint too (PT56: \"not the other ones\"), its frame cut as a layer", sp.ok && sp.state.hangTint.r1.sw === "Walnut" && C.PAINTINGS.concat(C.HW_PAINTINGS).every((p) => p.framed && fs.existsSync(path.join(APP, "ui", "cafe", "art", p.pic + "-fab.webp"))), sp.error);
}

console.log("\nPT56 round 2: paint, frames, level-ups\n");
{
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8");
  ok("the painted dividers take full-strength paint (their own set, the swatch's own colour laid)", C.THINGS.halfwall.tint === "white" && C.THINGS.lattice.tint === "white" && C.THINGS.halfbrick.tint2 === "white"
     && /white: \[NATURAL/.test(page) && /const paintCSS = \(t, mat\) =>/.test(page));
  ok("  a two-tone thing's swatch rows each have their name on top", /class="nc-sw-part"><em>/.test(page) && /\.nc-sw-part > em/.test(css));
  ok("a photo frame's paints by right-click, any time (not only in Build)", /function framePop/.test(page) && /\.nc-art\.frame \{ pointer-events: auto; \}/.test(css) && /closest\("\.nc-art\.frame"\)/.test(page));
  ok("the menus' scroll bars: brown on parchment", /\.nc ::-webkit-scrollbar-thumb \{[^}]*#7a421c/.test(css) && !/scrollbar-color/.test(css));
  ok("level-ups: unlocks by kind in a scrolling grid, levels that come together in one pop-up", /levelsShown = levelsShown\.filter/.test(page) && /\.nc-lv-body \{[^}]*overflow-y: auto/.test(css) && /LV_GROUPS/.test(page));
  const cal = C.calendar({}, Date.UTC(2026, 9, 24, 12)), byId = {}; cal.forEach((e) => { byId[e.id] = e; });
  ok("the events book: the year's eight events in calendar order, Halloween on (24 October) and the only one with things so far",
     cal.map((e) => e.id).join() === "lunarnewyear,ramadan,easter,midsummer,halloween,thanksgiving,christmas,newyearseve" && byId.halloween.on && byId.halloween.ready && cal.filter((e) => e.ready).length === 1 && cal.filter((e) => e.on).length === 1);
  ok("  dates: Easter by the computus (5 April 2026, 28 March 2027), Christmas next from 1 December, New Year's Eve across the new year",
     C.easter(2026).getDate() === 5 && C.easter(2026).getMonth() === 3 && C.easter(2027).getDate() === 28 && new Date(byId.christmas.from).getMonth() === 11 && new Date(byId.christmas.from).getDate() === 1
     && new Date(byId.newyearseve.to).getFullYear() === 2027 && new Date(byId.newyearseve.to).getDate() === 2);
  ok("  the haunted mansion opens the events book at Halloween, its things unlocked there with candy; Buy > Events keeps its cards", /function mansionShop\(\) \{ evAt = "halloween"; eventBook\(\); \}/.test(page)
     && /data-evunlock/.test(page) && /act\("candyBuy"/.test(page) && /function eventCards/.test(page) && !/k === "events"/.test(page));
  ok("  candy tips are 1-3 (Cam), from about 3 tables in 10", C.EVENT.tip.join() === "1,3" && C.EVENT.tipChance === 0.3);
  ok("  unlock names read right (no 'A another', no 'A basketball hoops')", C.unlocksAt(19).concat(C.unlocksAt(17), C.unlocksAt(40)).every((u) => !/^A another|^A [a-z ]*hoops/.test(u.name)));
}

console.log("\nPT56: buildings line up along the pavement\n");
{
  const t = T0; let s = Object.assign(skipped(t), {xp: C.XP[80], coins: 1e6, size: 8});
  const r = A(s, "decorPlace", {id: "furnstore", x: 11, y: 1.3, dir: 0}, t), st = r.state.decor.find((o) => o.id === "furnstore");
  ok("a building put near the pavement snaps flush against its edge (its back on ours, its front on the far side's)", r.ok && st.y === 1.05 && C.buildingAt("furnstore", 12, -5.2, 0).y === -4.92 && C.buildingAt("furnstore", 12, 3, 0).y === 3);
  ok("  its footprint stays off the pavement and the road", /pavement or the road/.test(C.decorProblem(s, "furnstore", 12, 0.5, -1, 0)) && /pavement or the road/.test(C.decorProblem(s, "mansion", 12, -4, -1, 0)) && !C.decorProblem(s, "furnstore", 12, 1.05, -1, 0));
  const s2 = r.state;
  ok("  another thing can't stand in it (its footprint, not a spot)", /furniture store/.test(C.decorProblem(s2, "bench", 10.3, 0.6, -1, 0) || C.decorProblem(s2, "farm_hay", 10.3, 0.6, -1, 0) || ""));
  ok("  turning it turns its footprint (refused where it won't fit)", A(s2, "decorTurn", {uid: st.uid}, t).ok);
}

console.log("\nPT56 round 4: floors outside, straight buildings, painting frames\n");
{
  const t = T0; let s = Object.assign(skipped(t), {xp: C.XP[20], coins: 1000, size: 8});
  const a = A(s, "floorPaint", {id: "terracotta", x: 3, y: 9}, t);
  ok("Build > Floors lays a tile outside on the grass, at least " + C.OUT_FLOOR + " coins (and across the street)", a.ok && a.state.outFloors["3,9"] === "terracotta" && a.state.coins === 1000 - Math.max(C.OUT_FLOOR, C.FLOOR.terracotta.price)
     && A(s, "floorPaint", {id: "grey", x: -8, y: 2}, t).state.coins === 1000 - C.OUT_FLOOR);
  ok("  never on the pavement or the road, or too far out", /pavement or the road/.test(A(s, "floorPaint", {id: "white", x: 3, y: -1}, t).error) && /pavement or the road/.test(A(s, "floorPaint", {id: "white", x: -5, y: 3}, t).error)
     && /too far/.test(A(s, "floorPaint", {id: "white", x: 60, y: 3}, t).error));
  ok("  Grass lifts it again, for nothing -- and only goes outside", (function () { const g = A(a.state, "floorPaint", {id: "grass", x: 3, y: 9}, t); return g.ok && !g.state.outFloors["3,9"] && g.state.coins === a.state.coins; })()
     && /only goes outside/.test(A(s, "floorPaint", {id: "grass", x: 1, y: 1}, t).error));
  ok("  the café's own floor is untouched by it", !a.state.floors["3,9"] && C.view(a.state, t).outFloors["3,9"] === "terracotta");
  const man = fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8");
  ok("every painting has its frame cut out to take a paint", C.PAINTINGS.concat(C.HW_PAINTINGS).filter((p) => p.framed).every((p) => man.includes(`"${p.pic}-fab"`)));
  {
    const s5 = Object.assign(skipped(t), {xp: C.XP[20], coins: 1000, size: 8}), P = C.PAINTINGS.find((p) => !p.kit && !p.event && !p.sandbox && p.level <= 20);
    ok("a painting stays in your hand for another while there's one to have (stored, or coins enough)", C.canHang(s5, P.id) && !C.canHang(Object.assign({}, s5, {coins: 0}), P.id)
       && C.canHang(Object.assign({}, s5, {coins: 0, pware: {[P.id]: 1}}), P.id) && !C.canHang(s5, C.HW_PAINTINGS[0].id));
  }
  {
    const man = fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8"), s6 = Object.assign(skipped(t), {xp: C.XP[20], coins: 1000, size: 8});
    const tu = s6.items.find((i) => i.kind === "till").uid, r6 = A(s6, "tint", {uid: tu, part: 2, h: 0, s: 0.05, b: 1.35, sw: "Silver"}, t);
    ok("the cash register is two-tone: its cabinet (wood) and the register on it (brass), each with its own layer", C.THINGS.till.tint === "wood" && C.THINGS.till.tint2 === "brass"
       && C.THINGS.till.parts.join() === "Cabinet,Register" && ["till-l-fab", "till-l-fab2", "till-r-fab", "till-r-fab2"].every((k) => man.includes(`"${k}"`))
       && r6.ok && r6.state.items.find((i) => i.uid === tu).tint2.sw === "Silver");
  }
  {
    const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
    ok("a catalogue drawn again after a click keeps its pages' scroll (the same page: its key)", /function modal\(html, cls, key\)/.test(page) && /"events:" \+ evAt/.test(page) && /"store:" \+ bookAt\.sec/.test(page) && /m\.dataset\.key === key/.test(page));
    ok("the round buttons are only rebuilt when something on them changed (no flashing each tick)", /if \(lastFab === fabHTML\) return;/.test(page));
  }
  ok("the brick wall's coping is cut by place, sides and all (round 5)", /def cap\(pic\)/.test(fs.readFileSync(path.join(APP, "tools", "make_cafe_fabric.py"), "utf8")));
  ok("the jack-o'-lantern's turned picture is the first one mirrored (no candelabra in it)", /jackolantern-l:pair, -,/.test(fs.readFileSync(path.join(APP, "tools", "cafe_sheets.txt"), "utf8")));
  ok("the buildings' pictures straightened by the cutter (the house flag)", /4x1 holes house/.test(fs.readFileSync(path.join(APP, "tools", "cafe_sheets.txt"), "utf8")) && /def true_house/.test(fs.readFileSync(path.join(APP, "tools", "cut_cafe_art.py"), "utf8")));
}

console.log("\nSheet 25: the event houses (Cam, 2026-10-24)\n");
{
  const man = fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8"), NOV = new Date(2026, 10, 20, 12).getTime(), MAY = new Date(2026, 4, 3, 12).getTime();
  const H = ["mansion", "santa", "warren", "longhouse"];
  ok("four event houses, painted four ways, each a building with its own footprint and event", H.every((id) => C.DECO[id].building && C.DECO[id].house && C.FOOT[id] && ["", "-l", "-r", "-bl", "-br"].every((s) => man.includes(`"prop-${id}${s}"`)))
     && C.DECO.mansion.name === "Haunted house" && C.DECO.mansion.house === "halloween" && C.DECO.santa.house === "christmas" && C.DECO.warren.house === "easter" && C.DECO.longhouse.house === "midsummer");
  const s = Object.assign(skipped(NOV), {xp: C.XP[30], coins: 1e6, size: 8});
  ok("  built while its event is on (Santa's house in December, not November), one each", /while Christmas is on/.test(A(s, "decorPlace", {id: "santa", x: 11, y: 1.3}, NOV).error || "")
     && (function () { const D = new Date(2026, 11, 5, 12).getTime(), r = A(Object.assign(skipped(D), {xp: C.XP[30], coins: 1e6, size: 8}), "decorPlace", {id: "santa", x: 11, y: 1.3}, D); return r.ok && /already/.test(A(r.state, "decorPlace", {id: "santa", x: 14, y: 1.3}, D).error || ""); })());
  ok("  any time in the sandbox", A(Object.assign(skipped(MAY), {xp: C.XP[30], coins: 1e6, size: 8, sandbox: true}), "decorPlace", {id: "longhouse", x: 11, y: 1.3}, MAY).ok);
  ok("  each snaps flush against the pavement like the furniture store", H.every((id) => Math.abs(C.buildingAt(id, 12, C.FOOT[id][0][1] + 0.3, 0).y - C.FOOT[id][0][1]) < 1e-6));
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("  clicked, a house opens the Events book at its event", /evAt = im\.dataset\.house \|\| "halloween"; return eventBook\(\);/.test(page) && /data-house="\$\{haunt\}"/.test(page));
}

console.log("\nSheet 22: the big games, two tiles long\n");
{
  const man = fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8");
  const t = T0, BIG = ["pingpong", "pooltable", "shuffleboard", "airhockey2"];
  ok("four big games, two tiles each, painted both ways", BIG.every((k) => C.THINGS[k].two && C.THINGS[k].turns === 2 && C.MACHINES[k].play && man.includes(`"${k}-l"`) && man.includes(`"${k}-r"`)));
  let s = Object.assign(skipped(t), {xp: C.XP[40], coins: 1e6, size: 8});
  s = A(A(s, "buy", {kind: "pooltable"}, t).state, "place", {kind: "pooltable", x: 2, y: 6, dir: 0}, t).state;
  const pt = s.items.find((i) => i.kind === "pooltable");
  ok("  one covers its tile and the next along", JSON.stringify(C.cells(pt)) === '[{"x":2,"y":6},{"x":3,"y":6}]' && JSON.stringify(C.cells(Object.assign({}, pt, {dir: 1}))) === '[{"x":2,"y":6},{"x":2,"y":7}]'
     && !A(stock(s, "halfwall").state, "place", {kind: "halfwall", x: 3, y: 6, dir: 0}, t).ok);
}

console.log("\nLights: lamps on and off, wall lights, the ceiling's, the dim café (Cam, 2026-10-24)\n");
{
  const man = fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8"), t = T0;
  const SC = C.WALL_THINGS.filter((w) => w.light);
  ok("five wall lights and eight ceiling lights, each with its picture", SC.length === 5 && SC.every((w) => w.group === "sconce" && man.includes(`"${w.pic}"`))
     && C.CEILING.length === 8 && C.CEILING.every((c) => c.reach > 0 && man.includes(`"${c.pic}"`)) && man.includes('"lightswitch-on"') && man.includes('"lightswitch-off"'));
  let s = Object.assign(skipped(t), {xp: C.XP[30], coins: 1e5, size: 8});
  s = A(A(s, "buy", {kind: "floorlamp"}, t).state, "place", {kind: "floorlamp", x: 6, y: 6, dir: 0}, t).state;
  const lamp = s.items.find((i) => i.kind === "floorlamp");
  let r = A(s, "light", {uid: lamp.uid}, t);
  ok("  a lamp's pull cord: off, and on again", r.ok && C.view(r.state, t).items.find((i) => i.uid === lamp.uid).off === true
     && !C.view(A(r.state, "light", {uid: lamp.uid}, t).state, t).items.find((i) => i.uid === lamp.uid).off
     && !A(s, "light", {uid: s.items.find((i) => i.kind === "stove").uid}, t).ok);
  r = A(s, "hang", {id: "sconce-2", side: "r", i: 2}, t);
  ok("  a wall light hangs like a painting and switches off and on", r.ok && r.state.hang.r2 === "sconce-2" && A(r.state, "light", {hang: "r2"}, t).state.hangOff.r2 === true
     && !A(A(r.state, "light", {hang: "r2"}, t).state, "light", {hang: "r2"}, t).state.hangOff.r2);
  let m = A(A(r.state, "light", {hang: "r2"}, t).state, "moveHang", {from: "r2", side: "r", i: 4}, t).state;
  ok("    moved, it stays off; taken down, the switch goes with it", m.hangOff.r4 && !m.hangOff.r2 && !A(m, "unhang", {from: "r4"}, t).state.hangOff.r4);
  r = A(s, "ceilPut", {id: "ceil-chandelier", x: 2, y: 2}, t);
  ok("  a ceiling light goes up over a floor tile, bought (and counts for the looks)", r.ok && r.state.ceil["2,2"].id === "ceil-chandelier" && r.state.coins === s.coins - C.CEIL["ceil-chandelier"].price
     && C.popularity(r.state).looks > C.popularity(s).looks);
  ok("    not off the floor, not two on a tile, not before its level", /floor/.test(A(s, "ceilPut", {id: "ceil-led", x: 8, y: 0}, t).error || "") && /already/.test(A(r.state, "ceilPut", {id: "ceil-led", x: 2, y: 2}, t).error || "")
     && /level/.test(A(Object.assign({}, s, {xp: 0}), "ceilPut", {id: "ceil-chandelier", x: 1, y: 1}, t).error || ""));
  ok("    it takes no floor: a table still goes on the tile under it", A(A(r.state, "buy", {kind: "table"}, t).state, "place", {kind: "table", x: 2, y: 2, dir: 0}, t).ok);
  const two = A(r.state, "ceilPut", {id: "ceil-led", x: 4, y: 4}, t).state;
  let sw = A(two, "light", {all: "ceil"}, t);
  ok("  the switch by the door: all off, then all on", sw.ok && Object.values(sw.state.ceil).every((c) => c.off) && Object.values(A(sw.state, "light", {all: "ceil"}, t).state.ceil).every((c) => !c.off)
     && /No ceiling lights/.test(A(s, "light", {all: "ceil"}, t).error || ""));
  m = A(two, "ceilMove", {from: "2,2", x: 5, y: 1}, t).state;
  const st = A(m, "ceilTake", {from: "5,1"}, t).state, back = A(st, "ceilPut", {id: "ceil-chandelier", x: 0, y: 0}, t).state;
  ok("  moved, taken down to storage, put up again free; sold for half", m.ceil["5,1"] && !m.ceil["2,2"] && st.cware["ceil-chandelier"] === 1 && back.coins === st.coins && !back.cware["ceil-chandelier"]
     && A(back, "ceilSell", {from: "0,0"}, t).state.coins === back.coins + C.CEIL["ceil-chandelier"].price / 2);
  ok("  the level-up list has them; a save without lights loads", C.unlocksAt(24).some((u) => u.kind === "ceil" && u.id === "ceil-chandelier") && C.unlocksAt(4).some((u) => u.id === "sconce-1")
     && (function () { const o = JSON.parse(JSON.stringify(s)); delete o.ceil; delete o.hangOff; delete o.cware; const n = C.normal(o); return JSON.stringify(n.ceil) === "{}" && JSON.stringify(n.cware) === "{}"; })());
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("  the page: the café dims after dark for everyone (not only the sandbox), lit by every light that's on", /if \(!sky\.dark\) return "";/.test(page) && !/!v\.sandbox \|\| !sky\.dark/.test(page) && /function lightPools/.test(page));
}

console.log("\nSitting at a table: a seat boxed in is taken from the table (Cam, 2026-10-24)\n");
{
  const t = T0;
  let s = Object.assign(skipped(t), {xp: C.XP[30], coins: 1e6, size: 8});
  const put = (st, kind, x, y, dir) => A(A(st, "buy", {kind}, t).state, "place", {kind, x, y, dir}, t).state;
  // a table at (5,5); a chair at (6,5) facing it (-x), boxed in by tables behind and to the sides
  s = put(s, "table", 5, 5, 0); s = put(s, "chair", 6, 5, 2); s = put(s, "table", 7, 5, 0); s = put(s, "table", 6, 4, 0); s = put(s, "table", 6, 6, 0);
  const ch = s.items.find((i) => i.kind === "chair");
  ok("  the boxed-in chair is a seat at its table", C.view(s, t).items.find((i) => i.uid === ch.uid).seat === true);
  let sat = null;
  s.sandbox = true; s.customers = [];
  const bf = s.items.find((i) => i.kind === "buffet"); bf.plates[0] = Object.assign({}, bf.plates[0], {dish: "pancakes", n: 99, since: t});
  for (let k = 0; k < 60 && !sat; k++) { const r = A(s, "dev", {op: "customers", n: 1}, t); if (!r.ok) { console.log(r.error); break; } sat = r.state.customers.find((c) => c.seat === ch.uid); s.customers = []; }
  ok("  a customer still sits in it: up to the table, then into the seat", !!sat && sat.s[sat.s.length - 1].x === 6 && sat.s[sat.s.length - 1].y === 5 && sat.o[0].x === 6 && sat.o[0].y === 5);
}

console.log("\nOutside: benches and picnic tables (Cam, 2026-10-24)\n");
{
  const t = T0;
  let s = Object.assign(skipped(t), {xp: C.XP[30], coins: 1e6, size: 8, sandbox: true, customers: []});
  s.decor = [{uid: 501, id: "bench", x: -3.4, y: 4, dir: 1}, {uid: 502, id: "picnic", x: 4, y: 11, dir: 0}];
  const P = C.benchPlaces(s);
  ok("a park bench seats two, a picnic table four (two each side, facing it)", P.filter((b) => b.uid === 501).length === 2 && P.filter((b) => b.uid === 502).length === 4
     && new Set(P.filter((b) => b.uid === 502).map((b) => b.face)).size === 2 && P.filter((b) => b.uid === 502).every((b) => Math.hypot(b.x - 4, b.y - 11) < 0.5));
  ok("  the way out from a bench goes to the pavement, then along it", (() => { const r = C.benchOut(s, -3, 4); return r[1].x === C.STREET.walk && r[r.length - 1].y === C.STREET.far; })());
  const bf = s.items.find((i) => i.kind === "buffet"); bf.plates[0] = Object.assign({}, bf.plates[0], {dish: "pancakes", n: 99, since: t});
  let got = null;
  for (let k = 0; k < 80 && !got; k++) { const r = A(s, "dev", {op: "customers", n: 1}, t); if (!r.ok) break; got = r.state.customers.find((c) => c.bench); s = Object.assign(r.state, {customers: []}); }
  ok("  some takeaway customers eat it on a bench: out to it, sit a while, then off", !!got && !got.seat && got.bsit > got.pay && got.bup - got.bsit === C.BENCH.sit && got.gone > got.bup && got.so2.length >= 2);
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("  passers-by stop for a sit too (the page, by the clock)", /function benchSitters/.test(page) && /benchSitters\(v, t, takenB\)/.test(page));
  ok("  the Halloween pumpkins and scarecrow glow after dark; the pink fringe is gone from the Halloween pictures", /hw_pumpkins: \["255,150,40"/.test(page) && /def dehalo/.test(fs.readFileSync(path.join(APP, "tools", "cut_cafe_art.py"), "utf8")));
}

console.log("\nWorld building: painted ground, free placement, the garden, homes and deliveries (Cam, 2026-10-24)\n");
{
  const t = T0;
  let s = Object.assign(skipped(t), {xp: C.XP[20], coins: 1e6, size: 8});
  let r = A(s, "terrain", {t: "dirt", r: 1, pts: [[10.3, 4.27], [11, 4.5]]}, t);
  ok("paint the ground anywhere, off the grid: each dab where it was put", r.ok && r.state.terrain.length === 2 && r.state.terrain[0][1] === 10.3 && r.state.terrain[0][0] === "dirt");
  ok("  grass rubs it out; a ground above your level can't be painted", A(r.state, "terrain", {t: "grass", r: 1, pts: [[10.4, 4.3]]}, t).state.terrain.length < 2
     && /level/.test(A(Object.assign({}, s, {xp: 0}), "terrain", {t: "cobble", r: 1, pts: [[10, 4]]}, t).error || ""));
  ok("  a big dab over small ones takes their place (the list stays short)", A(A(s, "terrain", {t: "dirt", r: 0.3, pts: [[12, 5]]}, t).state, "terrain", {t: "sand", r: 2, pts: [[12, 5]]}, t).state.terrain.length === 1);
  ok("  ten grounds (and since 25 Oct water, deep water and the shovel's dug ground), each with its texture", C.TERRAINS.length === 13 && C.TERRAINS.filter((x) => !["paving", "cobble"].includes(x.id)).every((x) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "tex-" + x.id + ".webp"))));
  s.decor = [];
  r = A(s, "decorPlace", {id: "rock_boulder", x: 10.37, y: 3.13, dir: 0, free: true}, t);
  const r2 = r.ok && A(r.state, "decorPlace", {id: "rock_small", x: 10.4, y: 3.2, dir: 0, free: true}, t);
  ok("free placement: not snapped, and things can overlap", r.ok && r.state.decor[0].x === 10.37 && r2.ok && A(r.state, "decorPlace", {id: "rock_small", x: 10.4, y: 3.2, dir: 0}, t).state.decor.slice(-1)[0].x === 10.5);
  ok("  but never inside the café", /inside the café/.test(A(s, "decorPlace", {id: "rock_small", x: 2, y: 2, dir: 0, free: true}, t).error || ""));
  const garden = C.DECOR.filter((d) => d.nature);
  ok("the garden: rocks, trees and plants, each with its picture", garden.filter((d) => d.nature === "rocks").length >= 8 && garden.filter((d) => d.nature === "trees").length >= 10 && garden.filter((d) => d.nature === "plants").length >= 5
     && garden.every((d) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "prop-" + d.id + ".webp"))));
  const homes = C.DECOR.filter((d) => d.home);
  ok("homes for the street: buildings, both facings drawn, their footprints", homes.length === 6 && homes.every((d) => d.building && C.HOME_FOOT[d.id] && ["-l", "-r"].every((x) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "prop-" + d.id + x + ".webp")))));
  r = A(s, "decorPlace", {id: "home_cottage", x: 12, y: 4, dir: 0}, t);
  let h = r.state, uid = h.decor.find((o) => o.id === "home_cottage").uid;
  ok("  a new home asks for its first order a couple of minutes after it's built", r.ok && !C.view(h, t).homes[uid].order && !!C.view(h, t + 3 * 60000).homes[uid].order);
  h = C.advance(h, t + 3 * 60000);
  const od = h.homes[uid].order, bf = h.items.find((i) => i.kind === "buffet");
  ok("  the order: a dish you can cook, some servings, paying more than the counter would", !!C.DISH[od.dish] && od.n >= 3 && od.value >= Math.round(od.n * C.DISH[od.dish].price * 1.5) - 1);
  ok("  not enough on the counters: can't deliver", /on the counters/.test(A(h, "deliver", {uid}, t + 3 * 60000).error || ""));
  bf.plates[0] = Object.assign({}, bf.plates[0], {dish: od.dish, n: od.n + 2, since: t});
  const c0 = h.coins, d1 = A(h, "deliver", {uid}, t + 3 * 60000);
  ok("  delivered: taken off the counters, paid, XP, and the next order comes within the hour", d1.ok && d1.state.coins === c0 + od.value && d1.state.items.find((i) => i.kind === "buffet").plates[0].n === 2
     && !d1.state.homes[uid].order && d1.state.homes[uid].next - (t + 3 * 60000) <= 60 * 60000 && d1.state.homes[uid].next - (t + 3 * 60000) >= 10 * 60000 && d1.state.runs.length === 1);
  ok("  ten orders a day at most", (() => { const g = JSON.parse(JSON.stringify(d1.state)); g.homes[uid].done = C.HOME.cap; return !C.view(g, t + 64 * 60000).homes[uid].order && !!C.view(d1.state, t + 64 * 60000).homes[uid].order; })());
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("  the page: Build > Terrain with a brush, free placement switch, Outside in categories, the order bubble and sheet, the delivery walk",
     /\["terrain", "Terrain"\]/.test(page) && /function terrainSVG/.test(page) && /data-free/.test(page) && /data-ocat/.test(page) && /function homeSheet/.test(page) && /data-order=/.test(page) && /\(v\.runs \|\| \[\]\)\.forEach/.test(page));
}

console.log("\nThe long table and counters that join (2026-10-25)\n");
{
  const t = T0 + 3 * S;
  let s = skipped(); s.xp = 50000; s.coins = 5000; s.size = 8;
  ok("the long table: the square table a tile longer, two ways round, a table", C.THINGS.table_long.two && C.THINGS.table_long.table && C.THINGS.table_long.turns === 2
     && C.cells({kind: "table_long", x: 4, y: 4, dir: 0}).length === 2 && C.covers({kind: "table_long", x: 4, y: 4, dir: 1}, 4, 5));
  const b = A(s, "buy", {kind: "table_long"}, t), p = b.ok && A(b.state, "place", {kind: "table_long", x: 4, y: 4, dir: 0}, t);
  ok("  bought and put down across two tiles", b.ok && p.ok && p.state.items.some((i) => i.kind === "table_long" && i.x === 4 && i.y === 4), (p || b).msg);
  s = p.state;
  const tb = s.items.find((i) => i.kind === "table_long");
  s.items.push({uid: 900, kind: "chair", x: 4, y: 3, dir: 0}, {uid: 901, kind: "chair", x: 5, y: 3, dir: 0}, {uid: 902, kind: "chair", x: 5, y: 5, dir: 3});
  ok("  a chair at either half is a seat at it (the far half too)", [900, 901, 902].every((u) => C.seatTable(s, s.items.find((i) => i.uid === u)) === tb));
  const v = C.view(s, t), at = (u) => v.items.find((i) => i.uid === u).table;
  ok("  each sitter's plate goes on the half in front of them", at(900).x === 4 && at(901).x === 5 && at(902).x === 5 && at(902).y === 4);
  ok("  the long table's pictures (and its colour layers) are made", ["table_long-l", "table_long-r", "table_long-l-fab", "table_long-r-fab"].every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", k + ".webp"))));
  const man = fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8");
  ok("counters in a row: far-open, reaching and both pictures for every counter and buffet, both facings, with colour layers, in the manifest",
     ["counter", "buffet"].every((k) => ["l", "r"].every((sd) => ["jf", "jn", "jfn"].every((j) => [`${k}-${sd}-${j}`, `${k}-${sd}-${j}-fab`].every((id) => man.includes(`"${id}":`) && fs.existsSync(path.join(APP, "ui", "cafe", "art", id + ".webp")))))));
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("  the page joins a counter to ones running the same way, in front of and behind it, and draws the longer picture from the same corner -- always the -l painting, so a row of mixed facings lines up",
     /function joinOf\(v, it, cs\)/.test(page) && /C\.alongX\(o\.dir\) === ax && C\.covers\(o, x, y\)/.test(page) && /const jn = joinOf\(v, it, C\.cells\(it\)\), jbase = jn && f\.id\.replace\(\/-\[lr\]\$\/, "-l"\)/.test(page) && /flip: !C\.alongX\(it\.dir\)/.test(page) && /const jid = f\.id \+ jn/.test(page) && /--jl:/.test(page)
     && /\.nc-thing\.joined > \.nc-body/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8")));
}

console.log("\nJust looking, and photos (2026-10-25)\n");
{
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8");
  ok("the eye at the top right puts the page in look mode; the camera shows only then", /function drawLook\(\)/.test(page) && /classList\.toggle\("nc-look", looking\)/.test(page)
     && /looking \? `<button class="nc-lookbtn" data-snap/.test(page) && /\.nc-lookbar \{ position: fixed; top: 64px; right: 14px/.test(css));
  ok("  looking hides the counts, the fridge badges, the bubbles (money, candy, timers), the rings and the buttons -- not the paint layers",
     ["nc-bub", "nc-count", "nc-cold", "nc-ring", "nc-burnbar", "nc-cart-bub", "nc-float", "nc-clock", "nc-tut"].every((k) => css.includes("body.nc-look ." + k))
     && css.includes("body.nc-look #nc-fab,") && !css.includes("body.nc-look .nc-fab,") && css.includes("body.nc-look .nc-hud { display: none"));
  ok("  a photo frames the café wherever you've scrolled, hides what's outside it, then puts the view back",
     /view\.z = 1; view\.x = 0; view\.y = 0; fit\(\);/.test(page) && /Object\.assign\(view, keep\); fit\(\);/.test(page)
     && ["nc-out", "nc-outdoor", "nc-cart", "nc-sky", "nc-groundbox"].every((k) => css.includes("body.nc-snapping ." + k)) && css.includes("body.nc-snapping [data-decor]"));
}

console.log("\nBuild > Select: a box outside, moved, copied or cleared (2026-10-25)\n");
{
  const t = T0 + 3 * S;
  let s = skipped(); s.xp = 40000; s.coins = 50000;
  // a little farm across the street: plots, fences round it, a hay bale, painted ground and a floor tile
  s.field = [{uid: 801, x: -14, y: 3, paid: 0, crop: "wheat"}, {uid: 802, x: -13, y: 3, paid: 100}];
  s.decor = s.decor.concat([{uid: 811, id: "farm_fence", x: -15, y: 3.5, dir: 1}, {uid: 812, id: "farm_hay", x: -12.5, y: 4.5, dir: 0}]).filter((o) => C.DECO[o.id]);
  s.terrain = [["dirt", -13.5, 3.5, 1], ["dirt", 20, 20, 1]];
  s.outFloors = {"-12,2": "oak"};
  s.seq = 900;
  const box = {x0: -15.2, x1: -11.2, y0: 1.8, y1: 5};
  const pk = C.areaPick(s, box);
  ok("a box picks what's outside in it: street things by where they stand, plots and floor tiles by their middle, the painted ground by its dabs",
     pk.plots.length === 2 && pk.decor.length === s.decor.filter((o) => o.uid > 800).length && pk.floors.join() === "-12,2" && pk.dabs.join() === "0", JSON.stringify(pk));
  ok("  and says what that is", /2 plots/.test(C.areaSays(s, pk)) && /painted ground/.test(C.areaSays(s, pk)), C.areaSays(s, pk));
  const mv = A(s, "area", Object.assign({op: "move", dx: 0, dy: 2}, box), t);
  ok("  moved, all together: plots (crop and all), things, the floor tile and the painted ground, whole tiles", mv.ok
     && mv.state.field.find((p) => p.uid === 801).y === 5 && mv.state.field.find((p) => p.uid === 801).crop === "wheat"
     && mv.state.outFloors["-12,4"] === "oak" && !mv.state.outFloors["-12,2"] && mv.state.terrain.some((d) => d[2] === 5.5) && mv.state.terrain.some((d) => d[1] === 20)
     && mv.state.decor.filter((o) => o.uid > 800).every((o) => o.y === s.decor.find((q) => q.uid === o.uid).y + 2), mv.error);
  ok("  not onto the road (refused, nothing moved), not into the café", !A(s, "area", Object.assign({op: "move", dx: 11, dy: 0}, box), t).ok
     && !A(s, "area", Object.assign({op: "move", dx: 14, dy: -1}, box), t).ok);
  const cp = A(s, "area", Object.assign({op: "copy", dx: 0, dy: 4}, box), t);
  ok("  copied: new plots (empty, at the next plot's price), new things (bought), the floor and the ground -- the originals stay",
     cp.ok && cp.state.field.length === 4 && cp.state.field.filter((p) => p.y === 7).every((p) => !p.crop) && cp.state.coins === s.coins - cp.cost && cp.cost > 0
     && cp.state.outFloors["-12,2"] && cp.state.outFloors["-12,6"] && cp.state.terrain.length === 3, cp.error);
  ok("  a copy over the originals is refused (a plot on a plot)", !A(s, "area", Object.assign({op: "copy", dx: 1, dy: 0}, box), t).ok);
  const poor = Object.assign(JSON.parse(JSON.stringify(s)), {coins: 1});
  ok("  copying costs what buying would -- refused without the coins", !A(poor, "area", Object.assign({op: "copy", dx: 0, dy: 4}, box), t).ok);
  const rm = A(s, "area", Object.assign({op: "remove"}, box), t);
  ok("  cleared: things into storage, plots filled in (half back), the ground back to grass; what's outside the box stays",
     rm.ok && rm.state.field.length === 0 && rm.state.coins === s.coins + 50 && !rm.state.outFloors["-12,2"] && rm.state.terrain.length === 1
     && rm.state.decor.every((o) => o.uid < 800) && Object.values(rm.state.dware).reduce((a, b) => a + b, 0) >= pk.decor.length, rm.error);
  ok("  an empty box says so", !A(s, "area", {op: "move", x0: 30, x1: 31, y0: 30, y1: 31, dx: 1, dy: 0}, t).ok);
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("the page: a Select tab in Build; drag a box, drag inside it to move or copy (tried first: shown as it would be, red where it can't), Delete asks first, undo",
     /\["select", "Select"\]/.test(page) && /function selTry\(\)/.test(page) && /peek = r\.ok \? \{ area: C\.view\(r\.state, now\(\)\) \}/.test(page) && /if \(peek\.area\) return peek\.area;/.test(page)
     && /data-b="seldel"/.test(page) && /confirmBox\(`Delete \$\{C\.areaSays/.test(page) && /"terrain", "area"\]\);/.test(page));
}

console.log("\nWalking round things outside (2026-10-25)\n");
{
  const s = skipped(); s.decor = [{uid: 999, id: "bench", x: -6, y: 5, dir: 0}];
  for (let y = 2; y < 9; y++) s.decor.push({uid: 900 + y, id: "farm_fence", x: -3, y: y + 0.5, dir: 1});
  const hit = (pts, test) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 20); for (let k = 0; k <= n; k++) if (test(a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n)) return true; } return false; };
  const r = C.benchIn(s, -6, 5.2);
  ok("people walk round a fence to a bench, not through it", r && !hit(r.slice(1), (x, y) => Math.abs(x + 3) < 0.05 && y > 2 && y < 9), JSON.stringify(r));
  const box = JSON.parse(JSON.stringify(s)); box.decor = [{uid: 999, id: "bench", x: -6, y: 5, dir: 0}];
  let u = 1000; for (let k = 0; k < 4; k++) box.decor.push({uid: u++, id: "farm_fence", x: -8 + k + 0.5, y: 3, dir: 0}, {uid: u++, id: "farm_fence", x: -8 + k + 0.5, y: 7, dir: 0}, {uid: u++, id: "farm_fence", x: -8, y: 3 + k + 0.5, dir: 1}, {uid: u++, id: "farm_fence", x: -4, y: 3 + k + 0.5, dir: 1});
  ok("  fenced all round: no way in (no one sits there); a gap in the fence: in through the gap", C.benchIn(box, -6, 5.2) === null && C.benchOut(box, -6, 5.2) === null
     && (() => { box.decor = box.decor.filter((o) => !(o.x === -4 && o.y === 5.5)); const g = C.benchIn(box, -6, 5.2); return g && hit(g, (x, y) => Math.abs(x + 4) < 0.05 && y > 5 && y < 6); })());
  const hay = JSON.parse(JSON.stringify(s)); hay.decor = [{uid: 1, id: "picnic", x: -6, y: 5, dir: 0}, {uid: 2, id: "farm_hay", x: -4.5, y: 5.1, dir: 0}];
  const hr = C.benchIn(hay, -6, 5.1);
  ok("  round a hay bale (Cam's Halloween seating), and the picnic table itself is walked up to", hr && !hit(hr.slice(1), (x, y) => Math.hypot(x + 4.5, y - 5.1) < 0.2));
  ok("  walked through: tables, benches, arches, bushes and what's flat on the ground; blocking: fences, hay, planters, lamps, bike racks, trees",
     ["picnic", "bench", "hw_spiderarch", "bush", "rock_slab"].every((k) => C.WALK_THROUGH[k]) && ["farm_fence", "fence", "farm_hay", "planter", "lamp", "bikerack", "tree", "tree2"].every((k) => !C.WALK_THROUGH[k] && C.DECO[k]));
  const t0 = Date.now(); for (let i = 0; i < 40; i++) C.benchOut(Object.assign({}, s, {decor: s.decor.concat([{uid: 5000 + i, id: "farm_hay", x: -10 - i * 0.25, y: 12, dir: 0}])}), -6, 5.2);
  ok("  quick: forty fresh walks (a new layout each) in well under a second", Date.now() - t0 < 1000, (Date.now() - t0) + " ms");
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8");
  ok("a copy's price shows on it while it's dragged, and placing one always asks with the price (free says so)",
     /class="nc-selcost"/.test(page) && /if \(sel\.mode === "copy"\) \{ draw\(\); return confirmBox\(`Put a copy here \$\{d\.r\.cost \? `for/.test(page) && /\(it's free\)/.test(page));
  ok("  and are always the same height -- the tallest tab's (Cam, 25 Oct) -- scrolling inside if ever more", /\.nc-drawer \{ height: min\(328px, 60vh\); overflow-y: auto; \}/.test(css));
  ok("the build and buy menus always span the screen (Cam, 25 Oct), whatever is in them", /\.nc-drawer \{ box-sizing: border-box; width: calc\(100vw - 32px\); min-width: 0; max-width: none; \}/.test(css));
}

console.log("\nThe patio (V24 step 1, 2026-10-25)\n");
{
  const t = T0 + 3 * S;
  let s = skipped(); s.xp = 20000; s.coins = 100000; s.size = 6;
  const lvl = C.levelOf(s.xp);
  const low = JSON.parse(JSON.stringify(s)); low.xp = 0;
  ok("the patio opens at level 12 for 6,000 (Build > Expansions); deeper ones after", !A(low, "patio", {}, t).ok && C.PATIOS[0].level === 12 && C.PATIOS[0].coins === 6000 && C.PATIOS.map((p) => p.depth).join() === "3,4,5,6", lvl);
  s.decor.push({uid: 4001, id: "planter", x: 7.5, y: 2.5, dir: 0});
  const b = A(s, "patio", {}, t);
  const backRails = (st) => st.hwalls.filter((w) => w.y === 0 && w.dir === 0 && w.x >= st.size).sort((a, c) => a.x - c.x);
  ok("  bought: 3 deep along the front-right side, a side door, wooden railings (half walls on its back); street things past it move out with it", b.ok && b.state.patio.depth === 3
     && backRails(b.state).map((w) => w.x + w.style).join() === "6rail_wood,7rail_wood,8rail_wood"
     && b.state.patio.door >= 0 && b.state.patio.door < 6 && b.state.decor.some((o) => o.uid === 4001 && o.x === 10.5 && o.y === 2.5) && b.state.coins === s.coins - 6000, b.error);
  s = b.state;
  ok("  it's floor of the café: inside() covers it, and street things, plots and outdoor floors keep off", C.inside(s, 7, 2) && !C.inside(s, 9, 2) && C.inPatio(s, 8, 5) && !C.inPatio(s, 5, 5)
     && /inside the café/.test(C.decorProblem(s, "planter", 7.5, 2.5)) && !A(s, "plow", {x: 7, y: 2}, t).ok);
  const door = s.patio.door, other = (door + 2) % 6;
  ok("  people only cross into it through the side door", C.walled(s, {x: 5, y: other}, {x: 6, y: other}) && !C.walled(s, {x: 5, y: door}, {x: 6, y: door})
     && C.path(s, C.entry(s), {x: 7, y: other}).some((q, i, a) => i && a[i - 1].x === 5 && q.x === 6 && q.y === door));
  const put = (st, kind, x, y, dir) => { let r = A(st, "buy", {kind}, t); r = A(r.state, "place", {kind, x, y, dir}, t); return r; };
  let r = put(s, "table_square", 7, other, 0); r = put(r.state, "chair", 7, (other + 5) % 6 === other - 1 ? other - 1 : other + 1, (other + 5) % 6 === other - 1 ? 0 : 3);
  ok("  anything that goes inside goes there: a table and a chair out there make a seat", r.ok && C.seats(r.state).some((c) => c.x === 7), r.error);
  // (Cam, 25 Oct: a patio chair facing a table just inside sat at it through the side wall)
  const across = (() => { let q = put(s, "table_square", 5, other, 0); q = put(q.state, "chair", 6, other, 2); return q; })();
  const atDoor = (() => { const ss = JSON.parse(JSON.stringify(s)); ss.patio.door = (other + 3) % 6; let q = put(ss, "table_square", 5, other, 0); q = put(q.state, "chair", 6, other, 2); return q.ok ? C.seats(q.state).some((c) => c.x === 6) : null; })();
  ok("  a chair on the patio isn't a seat at a table inside -- the glass side wall's between them", across.ok && !C.seats(across.state).some((c) => c.x === 6) && atDoor === false);
  const st = put(s, "stove", 8, other, 0);
  ok("  even a stove (q5)", st.ok, st.error);
  ok("  the tiles either side of the door stay free", !put(s, "plant", 6, door, 0).ok && !put(s, "plant", 5, door, 0).ok);
  const md = A(s, "patioDoor", {y: other}, t);
  ok("  the door moves along the side (Build > Walls)", md.ok && md.state.patio.door === other);
  ok("  a patio table tips a coin more by day, not at night", C.PATIO_TIP === 1 && /patioDay\(s, tb, t\) \? PATIO_TIP : 0/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafecore.js"), "utf8")));
  // a café expansion takes the patio (and what's on it) out with its front edge
  const tb = r.state.items.find((i) => i.kind === "table_square" && i.x === 7), big = Object.assign(JSON.parse(JSON.stringify(r.state)), {coins: 1e7, xp: 1e7});
  big.floors["7," + other] = "flagstone";
  const ex = A(big, "expand", {}, t);
  ok("  an expansion moves the patio out: its things and floors go with it, nothing is left behind or overlapping", ex.ok && ex.state.size === 7
     && ex.state.items.find((i) => i.uid === tb.uid).x === 8 && ex.state.floors["8," + other] === "flagstone" && !ex.state.floors["7," + other] && backRails(ex.state).map((w) => w.x).join() === "7,8,9" && ex.state.hwalls.length === backRails(r.state).length, ex.error);
  const rl = A(Object.assign(JSON.parse(JSON.stringify(s)), {hwStyles: {rail_picket: true}}), "halfWall", {style: "rail_picket", walls: [{x: 7, y: 0, dir: 0}]}, t);
  ok("  its railings are half walls: built over in another style (free on the same edge), and a deeper patio gets more in the last one's", rl.ok && rl.state.coins === s.coins
     && backRails(rl.state).map((w) => w.style).join() === "rail_wood,rail_picket,rail_wood"
     && backRails(A(Object.assign(JSON.parse(JSON.stringify(s)), {xp: 1e7, coins: 1e7}), "patio", {}, t).state).map((w) => w.x).join() === "6,7,8,9");
  ok("  its own outdoor floors (only out there), the café's too", !A(s, "floorPaint", {id: "deck", x: 2, y: 2}, t).ok && A(s, "floorPaint", {id: "flagstone", x: 7, y: 1}, t).ok && A(s, "floorPaint", {id: "oak", x: 7, y: 1}, t).ok);
  const dp = A(s, "patio", {}, t);
  ok("  4 deep next, at level 18", (lvl >= 18) === dp.ok && (!dp.ok || dp.state.patio.depth === 4));
  ok("  an old save (no patio) is just as it was", C.normal(JSON.parse(JSON.stringify(skipped()))).patio == null && C.cafeW(skipped()) === skipped().size);
  // (Cam, 25 Oct: "i should be able to edit swatches for the half wall as well") -- the brick side wall's two paints
  const pw = (() => { const q = JSON.parse(JSON.stringify(s)); q.sandbox = true; q.dev = Object.assign(q.dev || {}, {allPaints: true}); return q; })();
  const wt = A(A(pw, "wallTint", {h: 0, s: 0.3, b: 0.42, sw: "Ebony"}, t).state, "wallTint", {part: 2, h: 216, s: 2.52, b: 0.57, sw: "Blue"}, t);
  ok("  the brick side wall takes paints like a low brick wall: bricks and coping, kept apart, and through a deeper patio", wt.ok && C.view(wt.state, t).patio.tint.sw === "Ebony" && C.view(wt.state, t).patio.tint2.sw === "Blue"
     && A(Object.assign(wt.state, {xp: C.XP[30], coins: 1e6}), "patio", {}, t).state.patio.tint2.sw === "Blue", wt.error);
  ok("  back to as painted clears it; a paint you haven't got, or no patio, is refused", !A(wt.state, "wallTint", {part: 2, h: 0, s: 1, b: 1}, t).state.patio.tint2
     && /paint mixer/.test(A(s, "wallTint", {h: 123, s: 1.7, b: 0.8}, t).error || "") && /haven't a patio/.test(A(skipped(t), "wallTint", {h: 0, s: 1, b: 1}, t).error || ""));
  ok("  its pieces: the low brick wall run on, with swatch layers", ["brickrun-r", "brickrun-r-near", "brickrun-r-far"].every((id) => ["", "-fab", "-fab2"].every((x) => fs.existsSync(path.join(APP, "ui", "cafe", "art", id + x + ".webp")))));
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("the page: the patio's floor (decking to start), the side door's frame, its cards, the door in Build > Walls (its railings are half walls), the photo takes it in",
     /c >= v\.size \? "deck"/.test(page) && /function patioHTML\(v\)/.test(page) && /const bid = "halfbrick-r"/.test(page) && /swatchPop\("pwall"/.test(page) && /act\("wallTint"/.test(page) && /function doorFrame\(v, r, T, z\)/.test(page) && /class="nc-pframe"/.test(page) && /DOOR\.posts/.test(page) && /data-patio/.test(page) && !/data-railall/.test(page) && /data-b="pdoor1"/.test(page)
     && /if \(v\.patio\) \{ const W = z \+ v\.patio\.depth/.test(page)
     && ["wood", "picket", "iron", "glass", "rope", "hedge"].every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", `prop-rail_${k}-l.webp`)))
     && ["deck", "flagstone", "brickpave", "gravel"].every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", `floor-${k}.webp`))));
}

console.log("\nOutdoor cooking (V24 step 2, 2026-10-25)\n");
{
  const t = T0 + 3 * S;
  let s = skipped(); s.xp = C.XP[45]; s.coins = 1e6; s.size = 6;
  s = A(s, "patio", {}, t).state;
  const door = s.patio.door, row = (door + 2) % 6;
  const put = (st, kind, x, y, dir) => { let r = A(st, "buy", {kind}, t); return r.ok ? A(r.state, "place", {kind, x, y, dir: dir || 0}, t) : r; };
  ok("five appliances, opening at 12, 18, 24, 30 and 40 (q8), each with its own book of eight (q9)", C.APPLIANCES.join() === "bbq,pizzaoven,tandoor,spit,smoker"
     && C.APPLIANCES.map((k) => C.THINGS[k].level).join() === "12,18,24,30,40"
     && C.APPLIANCES.every((k) => C.DISHES.filter((d) => d.menu === C.THINGS[k].menu).length === 8 && C.MENUS.some((m) => m.id === C.THINGS[k].menu && m.cooker === k))
     && C.APPLIANCES.every((k) => Math.min(...C.DISHES.filter((d) => d.menu === C.THINGS[k].menu).map((d) => d.level)) === C.THINGS[k].level));
  ok("  every outdoor book has a mix of times: something quick, short, middling, long and overnight", C.APPLIANCES.every((k) => { const ds = C.DISHES.filter((d) => d.menu === C.THINGS[k].menu);
     return ds.some((d) => d.secs <= 120) && ds.some((d) => d.secs > 120 && d.secs <= 600) && ds.some((d) => d.secs > 600 && d.secs < 3600) && ds.some((d) => d.secs >= 3600 && d.secs < 6 * 3600) && ds.some((d) => d.secs >= 6 * 3600); }));
  ok("  and every one of their dishes is pictured cooking, served and burnt, and every appliance clean and dirty, both ways",
     C.DISHES.filter((d) => C.cookerOf(d) !== "stove").every((d) => ["cook", "dish", "burnt"].every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", `${k}-${d.id}.webp`))))
     && C.APPLIANCES.every((k) => ["-l", "-r", "-dirty-l", "-dirty-r"].every((x) => fs.existsSync(path.join(APP, "ui", "cafe", "art", k + x + ".webp")))));
  ok("  only on the patio", /only goes out on the patio/.test(put(s, "bbq", 2, 2).error || "") && put(s, "bbq", 7, row).ok);
  let r = put(s, "bbq", 7, row); s = r.state;
  const bbq = s.items.find((i) => i.kind === "bbq"), st = stove(s);
  ok("  the barbecue cooks only its own book, and a stove can't cook it", /barbecue grill, out on the patio/.test(A(s, "cook", {uid: st.uid, dish: "corncob"}, t).error || "")
     && /cooked on a stove/.test(A(s, "cook", {uid: bbq.uid, dish: "pancakes"}, t).error || "")
     && /pizza oven/.test(A(s, "cook", {uid: bbq.uid, dish: "margherita"}, t).error || ""));
  r = A(s, "cook", {uid: bbq.uid, dish: "corncob"}, t);
  const t2 = t + C.DISH.corncob.secs * S + 10;
  const sv = r.ok && A(r.state, "serve", {uid: bbq.uid}, t2);
  ok("  cooked, served onto a counter like any dish, and dirty after -- clean it like a stove", r.ok && sv.ok && sv.state.items.find((i) => i.uid === bbq.uid).dirty
     && A(sv.state, "clean", {uid: bbq.uid}, t2).ok, r.error || (sv && sv.error));
  ok("  it burns like a stove's dish", r.ok && C.stoveOf(r.state.items.find((i) => i.uid === bbq.uid), t + 3 * C.DISH.corncob.secs * S).status === "burnt");
  ok("  the self-cleaning upgrade fits it", A(s, "upgrade", {uid: bbq.uid, part: "selfclean"}, t).ok);
  ok("  one of each to start, another every ten levels past its own", C.allowed("bbq", 11) === 0 && C.allowed("bbq", 12) === 1 && C.allowed("bbq", 22) === 2);
  ok("  the cookbook says what each dish is cooked on", C.view(s, t).cookbook.find((d) => d.id === "corncob").on === "bbq" && C.view(s, t).cookbook.find((d) => d.id === "pancakes").on === "stove");
  const noBbq = skipped(); noBbq.xp = C.XP[45];
  ok("  orders and gifts only ask for dishes you have something to cook on", !C.hasCooker(noBbq, C.DISH.corncob) && C.hasCooker(s, C.DISH.corncob) && C.hasCooker(noBbq, C.DISH.pancakes));
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("the page: appliances drawn (dirty too), clicked like a stove, an Outdoor cooking shop group, the cookbook opens on the appliance's own book",
     /C\.THINGS\[kind\]\.cooker && !C\.THINGS\[kind\]\.bar\) \{ const lr/.test(page) && /if \(C\.cooks\(it\)\) \{/.test(page) && /id: "outdoor", name: "Outdoor cooking"/.test(page) && /if \(own && cookFor !== cbFor\) cbMenu = own;/.test(page));
}

console.log("\nThe painted garden, homes and railings (N54, 2026-10-25)\n");
{
  const t = T0 + 3 * S;
  let s = skipped(); s.xp = C.XP[45]; s.coins = 1e6; s.size = 6;
  s = A(s, "patio", {}, t).state;
  const art = (id) => fs.existsSync(path.join(APP, "ui", "cafe", "art", id + ".webp"));
  ok("Sheet 29's spares are railings too (half-wall styles): bamboo by level, Halloween's iron with candy (not before)", C.view(s, t).halfWalls.styles.some((r) => r.id === "rail_bamboo" && r.open)
     && /candy/.test(A(A(s, "decorPlace", {id: "furnstore", x: 14, y: 1.05, dir: 0}, t).state, "buyHalfWall", {id: "rail_spooky"}, t).error || "") && !C.view(s, t).halfWalls.styles.some((r) => r.id === "rail_spooky")
     && C.EVENT_ITEMS.some((x) => x.id === "spooky" && x.kind === "rail") && ["bamboo", "spooky"].every((k) => art(`prop-rail_${k}-l`) && art(`prop-rail_${k}-r`)));
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), tool = fs.readFileSync(path.join(APP, "tools", "fix_cafe_trees.py"), "utf8");
  ok("  the painted railings: -r runs along x, -l along y (the other way round from the street's fence stand-ins)", /prop-rail_\$\{R\}-\$\{r \? "l" : "r"\}/.test(page));
  ok("the homes' footprints measured off their paintings, drawn from their front corner", C.HOME_FOOT.home_bungalow.join() === "2.21,0.99" && /const HOME_FRONT = \{/.test(page) && /left = Math\.round\(p\.x - w \* fr\)/.test(page));
  ok("the garden keeps its on-screen sizes whatever the pictures' sizes (NATURE_H); the trees' clutter has a fix-up tool", /const NATURE_H = \{/.test(page) && /PROP_H\[o\.id\] \|\| NATURE_H\[o\.id\]/.test(page) && /def fix\(pid\)/.test(tool) && /PINKED = \["prop-rock_slab"\]/.test(tool));
}

console.log("\nPeople round the houses (2026-10-25)\n");
{
  const t = T0 + 3 * S;
  const s = skipped();
  const line = [{x: -0.6, y: 15}, {x: -0.6, y: -15}];
  ok("an empty pavement: the walk is the straight line", C.streetPath(s, line).length === 2);
  s.decor.push({uid: 5001, id: "home_cottage", x: 0, y: 8, dir: 0});
  const F = C.footOf("home_cottage", 0, 8, 0), w = C.streetPath(s, line);
  const inside = (q) => q.x > F.x0 && q.x < F.x1 && q.y > F.y0 && q.y < F.y1;
  const through = w.some((q, i) => i && Array.from({length: 40}, (_, k) => ({x: w[i - 1].x + (q.x - w[i - 1].x) * k / 40, y: w[i - 1].y + (q.y - w[i - 1].y) * k / 40})).some(inside));
  ok("  a house set on the pavement: the walk goes round it, never through it", w.length > 2 && !through && w[0].y === 15 && w[w.length - 1].y === -15, JSON.stringify(w));
  ok("  customers coming along the street go round it too", (() => { const r = C.streetRoute(s, 0); return r.length > 2; })());
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("the page: walkers re-routed when what's outside changes, and drawn over a house in front of it, under it behind", /function walkRoutes\(v\)/.test(page) && /function byHouses\(p, outside, z\)/.test(page) && /el\.style\.zIndex = byHouses\(/.test(page));
}

console.log("\nV25: the candy store, eating on the floor, readings, tarot frames, the Halloween guests (2026-10-25)\n");
{
  const OCT = new Date(2026, 9, 20, 12).getTime(), NIGHT = new Date(2026, 9, 20, 21).getTime(), DEC = new Date(2026, 11, 5, 21).getTime();
  const base = (t) => Object.assign(skipped(t), {xp: C.XP[20], coins: 1e6, size: 8});
  let s = A(base(OCT), "decorPlace", {id: "mansion", x: -6, y: 3}, OCT).state;
  ok("the candy store opens only when the whole catalogue (80 things) is yours", !C.catalogueDone(s) && /catalogue/.test(A(Object.assign(JSON.parse(JSON.stringify(s)), {candy: 1e4}), "candyStore", {id: "golden"}, OCT).error || "") && !C.view(s, OCT).candyStore);
  s.eventGot = C.EVENT_ITEMS.map((x) => x.id); s.candy = 5000;
  let r = A(s, "candyStore", {id: "golden"}, OCT);
  ok("  then: dear potions for candy, into the Bag (Golden tips 300)", C.catalogueDone(s) && r.ok && r.state.candy === 4700 && r.state.inv.golden === 1 && C.view(s, OCT).candyStore.length === 8);
  ok("  closed after the season", /closed/.test(A(s, "candyStore", {id: "golden"}, DEC).error || ""));
  s = r.state;
  r = A(s, "usePotion", {kind: "golden"}, OCT);
  ok("Golden tips: on for an hour, no target needed", r.ok && C.boostOn(r.state, "golden", OCT + 59 * 60000) && !C.boostOn(r.state, "golden", OCT + 61 * 60000));
  ok("  and it doubles a table's tip", /\* \(boostOn\(s, "golden", t\) \? 2 : 1\)/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafecore.js"), "utf8")));
  s.inv.crowd = 1; const before = C.rate(s, OCT); r = A(s, "usePotion", {kind: "crowd"}, OCT);
  ok("Crowd potion: twice the customers for 15 minutes", r.ok && Math.abs(C.rate(r.state, OCT + 60000) - before * C.RUSH_X) < 1e-9 && C.rate(r.state, OCT + 16 * 60000) === before);
  s.inv.chef = 1; s.inv.mastery = 1;
  let c1 = A(s, "cook", {uid: stove(s).uid, dish: "waffles"}, OCT).state;
  ok("Chef's potion: everything cooking is ready now (nothing cooking: no)", /Nothing's cooking/.test(A(s, "usePotion", {kind: "chef"}, OCT).error || "")
     && C.stoveOf(stove(A(c1, "usePotion", {kind: "chef"}, OCT + 1000).state), OCT + 1000).status === "ready");
  const m1 = A(c1, "usePotion", {kind: "mastery"}, OCT).state, sv = A(m1, "serve", {uid: stove(m1).uid}, OCT + 130 * S);
  ok("Mastery potion: a dish cooking counts twice towards its stars", sv.ok && sv.state.mastery.waffles === (c1.mastery && c1.mastery.waffles || 0) + 2);
  const lk = A(Object.assign(JSON.parse(JSON.stringify(s)), {candy: 400}), "candyStore", {id: "lucky"}, OCT);
  ok("the lucky dip: something rare at once (a paint, a secret recipe or a painting)", lk.ok && lk.state.candy === 0 && lk.events.some((e) => e.kind === "lucky"));
  ok("Aunty's box only ever has the three everyday potions", /pick\(\["fresh", "quick", "sell"\]\)/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafecore.js"), "utf8")));
  // eating on the floor
  let f = Object.assign(skipped(OCT), {xp: C.XP[20], coins: 1e5, size: 8});
  const put = (st, kind, x, y, d) => { let q = A(st, "buy", {kind}, OCT); if (!q.ok) throw new Error(kind + ": " + q.error); q = A(q.state, "place", {kind, x, y, dir: d || 0}, OCT); if (!q.ok) throw new Error(kind + ": " + q.error); return q.state; };
  f = put(f, "table_low", 5, 5); f = put(f, "cushion", 5, 4); f = put(f, "chair", 4, 5, 1); f = put(f, "table", 2, 6); f = put(f, "cushion", 2, 5);
  const seatAt = (x, y) => C.seats(f).some((c) => c.x === x && c.y === y);
  ok("a floor cushion seats someone at a low table, whichever side (it has no front)", seatAt(5, 4));
  ok("  but a chair isn't a seat at a low table, nor a cushion at a café table", !seatAt(4, 5) && !seatAt(2, 5));
  ok("low tables and cushions in Buy > Dining (the café's own from level 6 and 9; Halloween's with candy)", C.THINGS.table_low.level === 6 && C.THINGS.pouf.level === 9 && C.THINGS.table_lowhw.event === "halloween" && C.THINGS.cushion_hw.candy === 30);
  // Cam's Halloween furniture (N67)
  const HW = ["table_hwpumpkin", "table_hwweb", "table_hwslime", "table_hwskull", "chair_web", "chair_skull", "armchair_hw", "stool_hwbat", "stool_hw", "pot_hwtree", "lamp_hw", "bookshelf_hw", "coatstand_hw"];
  const hwArt = JSON.parse(fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8").split("window.CafeArtFiles = ")[1].split(";\n")[0]);
  ok("Halloween furniture: 13 things for candy, each painted, each in the haunted house's list", HW.every((k) => C.THINGS[k].event === "halloween" && C.THINGS[k].candy > 0 && hwArt[C.THINGS[k].turns ? k + "-l" : k] && C.EVENT_ITEMS.some((x) => x.id === k)));
  ok("  the skull chair and the pumpkin armchair have their backs (four ways); the cobweb chair waits for its own", ["chair_skull", "armchair_hw"].every((k) => hwArt[k + "-bl"] && hwArt[k + "-br"]) && !hwArt["chair_web-bl"]);
  ok("  any chair whose backs are painted turns four ways", /T\.seat && T\.turns === 2 && has\(k \+ "-bl"\) && has\(k \+ "-br"\)\) T\.turns = 4/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8")));
  let hw = Object.assign(skipped(OCT), {xp: C.XP[20], coins: 1e5, size: 8, candy: 5000});
  hw.eventGot = C.EVENT_ITEMS.map((x) => x.id);
  const hwPut = (st, kind, x, y, d) => { let q = A(st, "buy", {kind}, OCT); if (!q.ok) throw new Error(kind + ": " + q.error); q = A(q.state, "place", {kind, x, y, dir: d || 0}, OCT); if (!q.ok) throw new Error(kind + ": " + q.error); return q.state; };
  hw = hwPut(hw, "table_hwpumpkin", 5, 5); hw = hwPut(hw, "stool_hwbat", 6, 5); hw = hwPut(hw, "chair_skull", 5, 4);
  const hwSeat = (x, y) => C.seats(hw).some((c) => c.x === x && c.y === y);
  ok("  the bat stool has no front, like the stool (sits at the table beside it); the skull chair sits facing its table", hwSeat(6, 5) && hwSeat(5, 4) && C.THINGS.stool_hwbat.stool && C.THINGS.stool.stool);
  // Cam's Haunted Faves: 16 dishes painted for Halloween (cooking, served, burnt), shown while it's on
  const HF = ["cabbagesoup", "carrotsoup", "cornchowder", "bakedpotato", "mashedpotato", "cheeseomelette", "duckeggomelette", "truffleomelette", "cheesepie", "cheeseboard", "fishpie", "butteredfish", "grilledtrout", "crabcakes", "cookedsalmon", "lobster"];
  ok("Haunted Faves: 16 dishes with haunted pictures for all three states, each a dish in the game", HF.every((id) => C.DISHES.some((d) => d.id === id) && ["cook", "dish", "burnt"].every((p) => hwArt[`${p}-${id}-hw`])));
  ok("  shown in place of the usual ones while Halloween is on (art() swaps, signature() follows the event)", /if \(haunted && \/\^\(dish\|cook\|burnt\)-\/\.test\(id\) && ART\[id \+ "-hw"\]\) id \+= "-hw"/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8")) && /haunted = !!\(v\.event && v\.event\.on\)/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8")));
  // readers
  ok("the readers' tables: coin machines with a person -- 15 and 20 coins a reading, about a minute; candy 180 and 220", C.MACHINES.crystalball.play === 15 && C.MACHINES.tarotreader.play === 20
     && C.MACHINES.crystalball.stay === 60000 && C.THINGS.crystalball.candy === 180 && C.THINGS.tarotreader.candy === 220 && C.THINGS.crystalball.reader);
  // tarot frames
  let h = Object.assign(base(OCT), {eventGot: ["frame-tarotgold", "frame-crows"]});
  h = A(h, "hang", {id: "frame-tarotgold", side: "r", i: 1}, OCT).state;
  r = A(h, "hangCard", {key: "r1", card: "The Star"}, OCT);
  ok("a tarot frame shows the Major Arcana card you pick (22 of them), kept with the frame when it's moved", C.MAJOR.length === 22 && r.ok && r.state.hangCard.r1 === "The Star"
     && A(r.state, "moveHang", {from: "r1", side: "r", i: 2}, OCT).state.hangCard.r2 === "The Star" && !A(r.state, "hangCard", {key: "r1", card: "The Joker"}, OCT).ok);
  // (2026-10-26, Cam: unlocked event frames become frames in the picture frame builder, for your own photos)
  ok("  unlocked tarot frames are in the frame builder too, under their event; locked ones aren't", (() => { const fs2 = C.view(h, OCT).frameShop;
    return fs2.some((f) => f.id === "frame-crows" && f.event === "halloween") && !fs2.some((f) => f.id === "frame-stars") && fs2.filter((f) => !f.event).length === 9
      && !fs2.some((f) => /^web-|broom/.test(f.id)); })());
  ok("  one hangs with your own photo in it, and picking a card puts the card back", (() => { let q = A(h, "hang", {id: "frame-crows", side: "r", i: 3, photo: "abc123def"}, OCT); if (!q.ok || q.state.hangPhoto.r3 !== "abc123def") return false;
    q = A(q.state, "hangCard", {key: "r3", card: "The Moon"}, OCT); return q.ok && !q.state.hangPhoto.r3 && q.state.hangCard.r3 === "The Moon"; })());
  ok("cooking and growing times show one decimal at most -- 200 s is 3.3 min, not 3.3333333333333335 (Cam, 26 Oct)", (() => {
    const pg = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), m = pg.match(/const dp1 = [^\n]*\n\s*const secs = [^\n]*/);
    if (!m) return false; const f = new Function(m[0] + "; return secs;")();
    return f(200) === "3.3 min" && f(240) === "4 min" && f(5400) === "1.5 h" && f(30) === "30 s" && C.DISHES.every((d) => !/\.\d\d/.test(f(d.secs))); })());
  ok("the night sky from 8 pm (Cam, 26 Oct)", /if \(h >= 20 \|\| h < 5\) return \{ name: "night"/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8")));
  ok("  the page: the frame builder's right-hand tabs, by event, with the event's icon", (() => { const pg = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"); return /bookTabs\(fsecs, ftab, "ftab"\)/.test(pg) && /nc-cb-tabs2 r/.test(pg); })() && /\.nc-cb-tabs2\.r \{/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8")));
  ok("  the card pictures are never in the game's files (published decks, read from NeuroNet's card library)", !fs.readdirSync(path.join(APP, "ui", "cafe", "art")).some((n) => /tarot|crows -|old school/i.test(n) && !/^frame-|^tarotreader/.test(n)));
  // guests
  const g = Object.assign(base(NIGHT), {eventGot: ["dracula", "frank", "witch", "pumpkinhead"]});
  const looks = Array.from({length: 400}, () => C.pickLook(g, NIGHT)), share = looks.filter((l) => C.GUEST_OF[l]).length / looks.length;
  const day = Array.from({length: 200}, () => C.pickLook(g, OCT)).filter((l) => C.GUEST_OF[l]).length;
  ok("the Halloween guests visit after dark -- all four at most 1 customer in 5 -- never by day, and only once they're yours",
     share > 0.1 && share < 0.3 && day === 0 && Array.from({length: 200}, () => C.pickLook(base(NIGHT), NIGHT)).every((l) => !C.GUEST_OF[l]));
  ok("  unlocked with candy (400 to 600), and they leave 3 coins extra", C.GUESTS.map((x) => x.candy).join() === "400,450,500,600" && C.GUEST.extra === 3
     && C.EVENT_ITEMS.filter((x) => x.kind === "guest").length === 4 && /s\.till \+= c\.price \+ gx/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafecore.js"), "utf8")));
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("the page: guests drawn as themselves, cross-legged on a cushion, reader visitors sat on the floor, the card picker, the candy store page, Bag potions with no target, spells by the clock",
     /dracula: "dracula"/.test(page) && /const lowSeat =/.test(page) && /C\.THINGS\[ci\.kind\]\.reader/.test(page) && /function cardPop/.test(page) && /data-candystore/.test(page)
     && /\["golden", "crowd", "chef", "mastery"\]\.includes\(b2\.dataset\.potion\)/.test(page) && /min left<\/span>/.test(page) && /id: "low", name: "Low tables & cushions"/.test(page));
}

console.log("\nCam's fixes, 25 October evening: tall frames, night everywhere, potted plants, swatches\n");
{
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), art = (id) => fs.existsSync(path.join(APP, "ui", "cafe", "art", id + ".webp"));
  ok("tarot frames stand tall (portrait), the card fitted to their window", C.HW_HANG.filter((p) => p.card).every((p) => p.portrait) && /P\.portrait \? "vmount" : "mount"/.test(page) && /fw \* 0\.74 \* 1\.7/.test(page));
  ok("  and portrait photo frames at the furniture store (oak, walnut, shadow box, gilded)", ["oak", "walnut", "shadowbox", "gilded"].every((m) => C.PAINTING["photo-" + m + "-v"] && C.PAINTING["photo-" + m + "-v"].portrait && art("mount-" + m + "-v")));
  ok("the night covers the whole map, not a fixed square round the café", /const RE = C\.REACH \|\| \[-24, 52\]/.test(page) && Array.isArray(C.REACH));
  ok("potted lavender, wildflowers and wild ferns for indoors (Buy > Decor > Plants), recoloured by their pots", ["pot_lavender", "pot_flowers", "pot_ferns"].every((k) => C.THINGS[k] && C.THINGS[k].furniture && C.THINGS[k].tint === "pot" && art(k) && art(k + "-fab"))
     && /const NOT_STAND = \["plant", "palm", "pot_lavender", "pot_flowers", "pot_ferns"\]/.test(page));
  ok("the floor cushions, pouf and low tables take swatches (their colour layers made)", ["cushion", "pouf", "table_low-l", "table_low-r", "table_lowround"].every((id) => art(id + "-fab")));
}

console.log("\nN55/N57/N58 art cut in (25 October, late)\n");
{
  const art = (id) => fs.existsSync(path.join(APP, "ui", "cafe", "art", id + ".webp")), page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  const plan = fs.readFileSync(path.join(APP, "tools", "cafe_sheets.txt"), "utf8");
  ok("Sheet 35's 16 café floors and Sheet 37's 16 patio floors in the shop, each pictured", C.FLOORS.filter((f) => !f.patio).length >= 32 && C.FLOORS.filter((f) => f.patio).length === 20
     && C.FLOORS.every((f) => art("floor-" + f.id)));
  ok("  Sheet 36's 8 wallpapers (laid into the stripes panel, doors too) and Sheet 38's 8 railings", ["subway", "palms", "greystone", "deco", "hearts", "stars", "planks", "coffee"].every((w) => C.WALLPAPERS.some((x) => x.id === w) && art(`wall-${w}-l`) && art(`door-${w}-r`))
     && ["balustrade", "ivyiron", "wicker", "corten", "trellis", "festoon", "chain", "pastel"].every((r) => C.RAIL[r] && art(`prop-rail_${r}-l`) && art(`prop-rail_${r}-r`)));
  ok("the guests painted: no recoloured walking frames left over the paintings, -tr/-al mirrored", ["dracula", "frank", "witch", "pumpkinhead"].every((g) => !art(g + "-tl-1") && art(g + "-tr") && art(g + "-al") && art(g + "-floor-f") && art(g + "-stool-b")));
  ok("  sat on the floor: the cross-legged pose, shorter than a chair's (0.68 since Cam, 25 Oct: a little bigger)", /sid\.includes\("-floor-"\) \? 0\.68 : 0\.74/.test(page) && art("woman-floor-f") && art("boy-floor-b"));
  ok("N61's wall lights (no guide boxes, the painted glow taken off before the slant) and detailed clocks cut in; their glows placed off the paintings",
     /^Building\/Icon - Sheet 39 - Wall lights\.jpeg \| 4x4 holes unglow slant=0\.07/m.test(plan) && /^Building\/Icon - Sheet 19 - Clocks and wall things 2\.jpeg/m.test(plan)
     && /measured off N61's painted lights/.test(page) && ["sconce-1", "clock-2", "mirror", "pot_ferns", "witch-al", "pumpkinhead-ar"].every(art));
  ok("the stand-in makers never paint over a picture that's there (they're painted now)", ["make_cafe_halloween2.py", "make_cafe_outdoor.py", "make_cafe_pots.py"].every((t) => /never over a picture that's there/.test(fs.readFileSync(path.join(APP, "tools", t), "utf8"))));
}

console.log("\nCam, 25 Oct night: whole poufs, fog, little lights\n");
{
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8");
  ok("the round low table and the pouf are whole (cut by taller boxes, the grid line under them taken off)", /free holes gridfill \| 300 \| table_lowround/.test(fs.readFileSync(path.join(APP, "tools", "cafe_sheets.txt"), "utf8")) && C.THINGS.pouf.tint === "linen");
  ok("the fog machine is smaller and rolls out mist (stepped by the clock, no endless animation)", /hw_fog: 40/.test(page) && /function fogHTML/.test(page) && /\.nc-fog \{/.test(css) && !/\.nc-fog[^}]*transition/.test(css));
  ok("turnip lanterns, skull candles, the pumpkin patch and the cobweb lamp glow after dark; the Halloween low table's candle lights the room", /hw_turnips: \["255,150,40"/.test(page) && /hw_skulls: \["255,200,110"/.test(page) && C.THINGS.table_lowhw.lamp);
}

console.log("\nWall lights on and off (Cam, 25 Oct)\n");
{
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8");
  let s = Object.assign(skipped(), {xp: C.XP[30], coins: 1e5, size: 6});
  s = A(s, "hang", {id: "sconce-2", side: "r", i: 2}, T0).state;
  const off = A(s, "light", {hang: "r2"}, T0), on = off.ok && A(off.state, "light", {hang: "r2"}, T0);
  ok("a click switches a wall light off, another on again", off.ok && off.state.hangOff.r2 && on.ok && !on.state.hangOff.r2);
  ok("  and you can see which way it is by day too (off dimmed, on a soft glow), with a message", /\.nc-art\.light\.off \{ filter: brightness\(\.62\)/.test(css) && /\.nc-art\.light\.on:not\(\.lit\)/.test(css) && /\? "off" : "on"\}`\)/.test(page));
}

console.log("\nThe performance pass (2026-10-25)\n");
{
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8");
  ok("the world is NOT a layer of its own (Cam, 25 Oct: zooming out flashed the day map -- measured: no flashes without it)", !/\.nc-world \{ will-change: transform; \}/.test(css) && !/body\.nc-rerast \.nc-world/.test(css)
     && /rerast = setTimeout\(/.test(page) && /let rasterSc = 0, groundSc = 0, rerast = 0;/.test(page));
  ok("  the ground is a layer of its own, drawn afresh only after a big change of zoom", /\.nc-groundbox \{ will-change: transform; \}/.test(css) && /sc \/ groundSc > 1\.6/.test(page));
  ok("  the things that move every tick are layers of their own", /\.nc-person, \.nc-bub, \.nc-lampglow, \.nc-hen, \.nc-hord, \.nc-ring, \.nc-burnbar, \.nc-pglow, \.nc-mglow\.jukebox \{ will-change: transform; \}/.test(css));
  ok("no endless animation: the jukebox glow's hue has no transition, and is stepped on the glow (not the page)", !/transition: filter 1s linear/.test(css) && /\.nc-mglow\.jukebox"\)\.forEach\(\(g\) =>/.test(page) && !/body\.style\.setProperty\("--nc-hue"/.test(page));
  ok("the clock's tick writes timers only when they change", /if \(e\.textContent !== c\) e\.textContent = c;/.test(page) && /if \(e\.style\.getPropertyValue\("--p"\) !== p\)/.test(page) && /if \(e\.firstChild\.style\.width !== w\)/.test(page));
}

console.log("\nCam's fixes, 25 Oct late: railings, lights, the farmhouse, the round table, buffets by the wall, house orders, plant sizes\n");
{
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), sheets = fs.readFileSync(path.join(APP, "tools", "cafe_sheets.txt"), "utf8");
  const cutter = fs.readFileSync(path.join(APP, "tools", "cut_cafe_art.py"), "utf8"), fabric = fs.readFileSync(path.join(APP, "tools", "make_cafe_fabric.py"), "utf8");
  ok("a painted railing stands on its edge: its near post's foot on the edge's near end, one tile long", /P = r \? at\(v, w\.x \+ t \/ 2, w\.y \+ 1\) : at\(v, w\.x \+ 1, w\.y \+ t \/ 2\)/.test(page));
  ok("the ceiling lights lose the sheet's magenta (unpink: the fringe off, the tint through glass made neutral)", /def unpink\(pic\)/.test(cutter) && /Sheet 40 - Ceiling lights\.jpeg \| 4x4 holes unpink/.test(sheets));
  ok("the farmhouse is cut from its own box, down past its cell's bottom line, and drawn the same size", /prop-home_farmhouse-l:pair@0:516:512:1080/.test(sheets) && /home_farmhouse: 229/.test(page));
  ok("a grid line under a painting is cleared only outside the thing (no notches in the round table's top)", /the thing's edge across it runs straight from where it/.test(cutter));
  ok("the floor cushion's swatches cover its shaded sides too", /FABRIC\["cushion"\] = \("hue", 10, 56/.test(fabric));
  ok("a long thing along the patio wall, inside, is drawn under the wall", /cs\.every\(\(c\) => c\.x === v\.size - 1\)\) z = Math\.min\(z, 10 \+ \(v\.size - 1 \+ Math\.min/.test(page));

  let s = Object.assign(skipped(), {xp: C.XP[40], coins: 1e7, size: 6});
  s = A(s, "patio", {}, T0).state;
  s.items = s.items.filter((i) => i.x < 4);
  s = A(s, "buy", {kind: "buffet"}, T0).state;
  const across = A(s, "place", {kind: "buffet", x: 5, y: 1, dir: 0}, T0), along = A(s, "place", {kind: "buffet", x: 5, y: 1, dir: 1}, T0);
  ok("a buffet can't stand across the patio's wall, half in and half out; along it, inside, it can", !across.ok && /across the patio's wall/.test(across.error) && along.ok);
  const old = JSON.parse(JSON.stringify(s));
  old.items.push({uid: 9001, kind: "buffet", x: 5, y: 1, dir: 0, plates: [{dish: null, n: 0}, {dish: null, n: 0}]});
  const fixed = C.normal(old).items.find((i) => i.uid === 9001);
  ok("  one put across it before is turned along the wall on load", fixed && fixed.x === 5 && fixed.dir === 1);

  // a house order counts every serving on the counters -- the ones a customer who just came in has promised themselves too
  let h = Object.assign(skipped(), {xp: C.XP[20], coins: 1e7});
  h.decor.push({uid: 8001, id: "home_cottage", x: -4, y: 2, dir: 0});
  const bf = h.items.find((i) => i.kind === "buffet"), dish = C.DISHES.find((d) => !d.secret && !d.event && d.level <= 2).id;
  bf.plates[0] = {dish, n: 10, res: 4, since: T0};
  const dd = new Date(T0); h.homes = {8001: {day: dd.getFullYear() + "-" + (dd.getMonth() + 1) + "-" + dd.getDate(), done: 0, next: T0, order: {dish, n: 8, value: 100, xp: 5, at: T0}}};
  const hv = C.view(h, T0).homes[8001].order;
  ok("a house order counts what's on the counter at once, servings promised to a customer included", hv.have === 10);
  const dl = A(h, "deliver", {uid: 8001}, T0), left = dl.ok && dl.state.items.find((i) => i.uid === bf.uid).plates[0];
  ok("  delivering takes the free ones first, the promised ones last", dl.ok && left.n === 2 && left.res === 2);

  // plant sizes: = and - (C.GROW)
  let g = Object.assign(skipped(), {xp: C.XP[30], coins: 1e7});
  ["plant_fern", "hedge", "bush", "plant_lavender", "plant_flowers", "plant_grass", "plant_mushrooms"].forEach((id) => ok("  " + id + " grows", !!C.DECO[id].grow));
  g = A(g, "decorPlace", {id: "bush", x: 1, y: 6, dir: 0, free: true, scale: 4}, T0).state;
  const bush = g.decor[g.decor.length - 1];
  const up = A(g, "decorScale", {uid: bush.uid, by: 1, free: true}, T0), down = A(g, "decorScale", {uid: bush.uid, by: -1, free: true}, T0);
  ok("a bush (a plant) placed four sizes up; = past that says it's as big as it grows; - takes it a size down", bush.scale === 4 && !up.ok && /as big as it grows/.test(up.error) && down.ok && down.state.decor.find((o) => o.uid === bush.uid).scale === 3);
  g = A(g, "decorPlace", {id: "bench", x: 3, y: 7, dir: 0, free: true}, T0).state;
  const bench = g.decor[g.decor.length - 1], nb = A(g, "decorScale", {uid: bench.uid, by: 1}, T0);
  ok("  a bench comes in one size", bench.id === "bench" && !nb.ok);
  ok("  bigger, it's drawn bigger, takes more room and people walk round more of it", C.growOf(down.state.decor.find((o) => o.uid === bush.uid)) === C.GROW[3] && /\* C\.growOf\(o\)\)/.test(page) && /d\.r \* growOf\(o\) \+ 0\.1/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafecore.js"), "utf8")));
  ok("  = and - (and the drawer's Smaller / Bigger buttons) size what you hold, move or have picked", /e\.key === "=" \|\| e\.key === "\+" \|\| e\.key === "-"/.test(page) && /function growHeld\(by\)/.test(page) && /\$\{a\}="bigger"/.test(page));
}

console.log("\nCam, 25 Oct night: webs, everything sized, the doll, the map's edge, expansions push things out\n");
{
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), cutter = fs.readFileSync(path.join(APP, "tools", "cut_cafe_art.py"), "utf8");
  ok("the cobwebs' magenta made neutral (silk: nothing taken away, so thin strands stay)", /def silk\(pic\)/.test(cutter) && /--silk/.test(cutter));
  ok("plants go four sizes up, other street things three; seats, fences and buildings stay one size",
     C.growMax("bush") === 4 && C.growMax("plant_fern") === 4 && C.growMax("tree") === 3 && C.growMax("hw_rocker") === 3 && C.growMax("lamp") === 3
     && !C.growMax("bench") && !C.growMax("picnic") && !C.growMax("fence") && !C.growMax("home_cottage") && !C.growMax("farm_coop") && !C.growMax("mansion"));
  ok("inside: potted plants four sizes, machines, lamps and the rest three; chairs, tables, counters, dividers and the readers' tables one",
     C.thingGrowMax("plant") === 4 && C.thingGrowMax("pot_ferns") === 4 && C.thingGrowMax("jukebox") === 3 && C.thingGrowMax("stove") === 3 && C.thingGrowMax("floorlamp") === 3
     && !C.thingGrowMax("chair") && !C.thingGrowMax("table") && !C.thingGrowMax("counter") && !C.thingGrowMax("buffet") && !C.thingGrowMax("halfwall") && !C.thingGrowMax("crystalball") && !C.thingGrowMax("cushion"));
  let s = Object.assign(skipped(), {xp: C.XP[30], coins: 1e7, size: 6});
  s = A(s, "buy", {kind: "jukebox"}, T0).state;
  const pl = A(s, "place", {kind: "jukebox", x: 2, y: 2, dir: 0, scale: 2}, T0), jb = pl.ok && pl.state.items.find((i) => i.kind === "jukebox");
  const up = A(pl.state, "scale", {uid: jb.uid, by: 1}, T0), up2 = A(up.state, "scale", {uid: jb.uid, by: 1}, T0);
  const chair = pl.state.items.find((i) => i.kind === "chair") || (() => { const b2 = A(A(pl.state, "buy", {kind: "chair"}, T0).state, "place", {kind: "chair", x: 0, y: 3, dir: 0}, T0); return b2.ok && b2.state.items.find((i) => i.kind === "chair"); })();
  ok("a jukebox placed two sizes up, then one more; past three it says so; its tile stays its tile", jb.scale === 2 && up.ok && up.state.items.find((i) => i.uid === jb.uid).scale === 3 && !up2.ok && C.cells(jb).length === 1);
  ok("  a chair comes in one size", !chair || !A(pl.state, "scale", {uid: chair.uid, by: 1}, T0).ok);
  ok("  drawn from its feet up, bigger; = and - work inside too (what you hold, move or have picked)", /const grow = C\.growOf\(it\);/.test(page) && /act\("scale", \{ uid, by \}\)/.test(page) && /C\.thingGrowMax\(build\.place\)/.test(page));
  ok("the rocking chair and doll start a size down", /hw_rocker: 64,/.test(page));
  ok("the ground is drawn over exactly where things can go (C.REACH), no further", /const RE = C\.REACH \|\| \[-24, 52\], lo = RE\[0\]/.test(page) && /<clipPath id="nc-lot"><rect x="\$\{lo\}" y="\$\{lo\}"/.test(page) && !/Math\.max\(44, v\.size \+ 24\)/.test(page));

  // expansions push what's outside past the front edges out by as much
  let e = Object.assign(skipped(), {xp: C.XP[40], coins: 1e7});
  const z0 = e.size;
  e.decor.push({uid: 5001, id: "lamp", x: z0 + 1.5, y: 1, dir: 0}, {uid: 5002, id: "bush", x: 1, y: z0 + 2, dir: 0}, {uid: 5003, id: "bush", x: z0 + 1, y: z0 + 1, dir: 0}, {uid: 5004, id: "bin", x: -2, y: 1, dir: 0});
  e.outFloors = {}; e.outFloors[(z0 + 1) + ",1"] = "deck";
  e.terrain = [["paving", z0 + 2, 0.5, 0.6]];
  const x1 = A(e, "expand", {}, T0), d = x1.ok && x1.state.size - z0, at = (u) => x1.state.decor.find((o) => o.uid === u);
  ok("the café growing: things past its width move out by as much, past its depth too, the corner both ways; behind it nothing moves",
     x1.ok && at(5001).x === z0 + 1.5 + d && at(5001).y === 1 && at(5002).y === z0 + 2 + d && at(5002).x === 1 && at(5003).x === z0 + 1 + d && at(5003).y === z0 + 1 + d && at(5004).x === -2, x1.error);
  ok("  laid tiles and painted ground with them", x1.ok && x1.state.outFloors[(z0 + 1 + d) + ",1"] === "deck" && x1.state.terrain[0][1] === z0 + 2 + d);
}

console.log("\nV26: refills, carts, the cinema, drinks machines, the bars and the Head cashier\n");
{
  const L = (h, m) => new Date(2026, 9, 20, h, m || 0).getTime();     // (carts and films go by local time)
  const t = L(9);
  const base = () => { let b = classic(skipped(t)); b.coins = 1e6; b.xp = C.XP[40]; C.setSize(b, 7); b.closed = false; b.customers = []; b.next = t + 1e12; b.cart = C.advance(b, t).cart; b.cart.done = true; return b; };
  const put = (st, kind, x, y, dir, at) => { let r = A(st, "buy", {kind}, at || t); if (!r.ok) throw new Error(r.error); r = A(r.state, "place", {kind, x, y, dir}, at || t); if (!r.ok) throw new Error(r.error); return r.state; };
  const out = (st, id, x, y, at) => { const r = A(st, "decorPlace", {id, x, y, dir: 0, free: true}, at || t); if (!r.ok) throw new Error(id + ": " + r.error); return r.state; };
  const thing = (st, kind) => st.items.find((i) => i.kind === kind);
  const stall = (st, id) => st.decor.find((o) => o.id === id);
  // q1: the run
  let s = put(base(), "arcade", 5, 5, 0);
  let c = JSON.parse(JSON.stringify(s)); c.closed = true;
  ok("a closed café doesn't use up a machine's run (q1)", !C.view(c, t + 10 * 3600 * S).items.find((i) => i.kind === "arcade").dry);
  ok("  open, it runs 3 hours, then it's dry", !C.view(s, t + 2.9 * 3600 * S).items.find((i) => i.kind === "arcade").dry && C.view(s, t + 3.1 * 3600 * S).items.find((i) => i.kind === "arcade").dry);
  ok("  old saves start every machine full (no run used)", !C.view(base(), t).items.some((i) => i.dry));
  let d = C.advance(s, t + 4 * 3600 * S); thing(d, "arcade").coins = 100;
  ok("  not before it's dry", !A(s, "refill", {uid: thing(s, "arcade").uid}, t).ok);
  let r = A(d, "refill", {uid: thing(d, "arcade").uid}, t + 4 * 3600 * S);
  ok("  refilled: the coins out less a 20% cut, and it runs again", r.ok && r.state.coins === d.coins + 80 && thing(r.state, "arcade").coins === 0 && !C.view(r.state, t + 4 * 3600 * S).items.find((i) => i.kind === "arcade").dry, r.error);
  thing(d, "arcade").coins = 10; r = A(d, "refill", {uid: thing(d, "arcade").uid}, t + 4 * 3600 * S);
  ok("  under 25 coins in it, the cut is 5", r.ok && r.state.coins === d.coins + 5);
  thing(d, "arcade").coins = 0; r = A(d, "refill", {uid: thing(d, "arcade").uid}, t + 4 * 3600 * S);
  ok("  with none in it, the 5 comes from your purse", r.ok && r.state.coins === d.coins - 5);
  d.coins = 3; ok("  and not without 5 coins", !A(d, "refill", {uid: thing(d, "arcade").uid}, t + 4 * 3600 * S).ok);
  ok("  the cut: at least 5, 20% above 25, never more than what's in it from 25 up", Array.from({length: 400}, (_, n) => n).every((n) => C.refillCut(n) >= 5 && (n < 25 || C.refillCut(n) <= n * 0.2 + 0.5)));
  const dm = C.advance(put(base(), "jukebox", 5, 5, 0), t + 4 * 3600 * S); dm.coins = 0;
  ok("  a dry jukebox takes no coins from people getting up", C.machines(dm).every((m) => C.view(dm, t + 4 * 3600 * S).items.find((i) => i.uid === m.uid).dry));
  // q4: the drinks machines
  ok("milkshake and energy drink machines: vending machines at 8 and 12 (q4)", C.THINGS.shakevend.vend && C.THINGS.shakevend.level === 8 && C.THINGS.energyvend.level === 12 && C.VENDS.shakevend.sale === 5 && C.VENDS.energyvend.dark === 1.5);
  ok("  one to start, another every 4 levels", C.allowed("shakevend", 8) === 1 && C.allowed("shakevend", 12) === 2 && C.allowed("energyvend", 11) === 0);
  // q2: carts
  s = out(base(), "icecart", 8, 8);
  ok("an ice cream cart sells on its own in its hours: 8 coins every 5 minutes (q2)", stall(C.advance(s, L(11)), "icecart").coins === 96);
  ok("  nothing outside its hours (10 am - 8 pm)", !stall(C.advance(out(base(), "icecart", 8, 8, L(21)), L(23)), "icecart").coins);
  let ic = C.advance(s, L(19, 30));
  ok("  3 hours of selling, then it's dry and stops", stall(ic, "icecart").coins === 36 * 8 && C.view(ic, L(19, 30)).decor.find((o) => o.id === "icecart").stall.dry);
  r = A(ic, "refill", {decor: stall(ic, "icecart").uid}, L(19, 30));
  ok("  restocked: its coins less the cut, and it sells again", r.ok && r.state.coins === ic.coins + 288 - Math.round(288 * 0.2) && !C.view(r.state, L(19, 30)).decor.find((o) => o.id === "icecart").stall.dry);
  ok("  one of each, another every 15 levels", !A(Object.assign(JSON.parse(JSON.stringify(s)), {xp: C.XP[28]}), "decorPlace", {id: "icecart", x: 9, y: 9, dir: 0, free: true}, t).ok && (() => { const q = JSON.parse(JSON.stringify(s)); q.xp = C.XP[29]; return A(q, "decorPlace", {id: "icecart", x: 9, y: 9, dir: 0, free: true}, t).ok; })());
  let cc = C.advance(out(base(), "coffeecart", 8, 8, L(6)), L(8));
  ok("  the coffee cart: 6 coins every 5 minutes from 6 am, half again 7-10", stall(cc, "coffeecart").coins === 12 * 6 + 18 * 6);
  ok("  a cart's coins collected before it's dry", A(cc, "stallCollect", {uid: stall(cc, "coffeecart").uid}, L(8)).state.coins === cc.coins + 180);
  // q3: the cinema
  let k = out(base(), "cinema", 10, 10, L(18));
  k = out(k, "picnic", 11, 10, L(18)); k = out(k, "bench", 10, 12, L(18));
  let k2 = C.advance(k, L(23, 30));
  ok("the cinema: 3 films an evening, 4 coins a place within 4 tiles (q3)", stall(k2, "cinema").coins === 3 * 6 * 4 && stall(k2, "cinema").shows === 3, stall(k2, "cinema").coins);
  ok("  a reel lasts 3 -- then it's dry till refilled", C.view(k2, L(23, 30)).decor.find((o) => o.id === "cinema").stall.dry && stall(C.advance(k2, L(23, 30) + 24 * 3600 * S), "cinema").coins === 72);
  let k3 = k; [12, 13, 14].forEach((y) => { k3 = out(k3, "picnic", 8, y, L(18)); });
  ok("  every place counted once, up to 12", stall(C.advance(k3, L(19, 30)), "cinema").coins === 12 * 4);
  ok("  a popcorn cart nearby: 2 more a place", stall(C.advance(out(k, "popcart", 9, 11, L(18)), L(19, 30)), "cinema").coins === 6 * 6);
  // q7: the Head cashier
  let h = out(base(), "icecart", 8, 8, L(10));
  r = A(h, "upgrade", {uid: thing(h, "till").uid, part: "cashier"}, L(10));
  ok("the Head cashier: fitted to the till at level 40 for 250,000 (q7)", r.ok && r.state.coins === h.coins - 250000 && !A(Object.assign(JSON.parse(JSON.stringify(h)), {xp: C.XP[39]}), "upgrade", {uid: thing(h, "till").uid, part: "cashier"}, L(10)).ok);
  let h2 = C.advance(r.state, L(11));
  ok("  every 10 minutes the stalls' coins go into the till", stall(h2, "icecart").coins < 20 && h2.till >= 80);
  let h3 = C.advance(r.state, L(17));
  ok("  and it never refills: a dry cart stays dry", C.view(h3, L(17)).decor.find((o) => o.id === "icecart").stall.dry && !stall(C.advance(h3, L(18)), "icecart").coins);
  // q5: the espresso machine
  let e = base(); e.items.find((i) => i.kind === "counter").dish = null;
  r = A(e, "upgrade", {uid: thing(e, "counter").uid, part: "espresso"}, t);
  let e2 = C.advance(r.state, t + 60 * S), ec = thing(e2, "counter");
  ok("an espresso machine on a counter brews 6 coffees onto its empty top (q5)", r.ok && C.DISH[ec.dish] && C.DISH[ec.dish].brew && ec.n === 6, r.error);
  ec.dish = null; ec.n = 0;
  ok("  not again before 15 minutes", !thing(C.advance(e2, t + 5 * 60 * S), "counter").dish && !!thing(C.advance(e2, t + 16 * 60 * S), "counter").dish);
  ok("  coffees aren't cooked or in the cookbook's menus", !C.canCook(e, C.DISH.latte, 99) && !C.MENUS.some((m) => m.id === "coffee"));
  ok("  its beans last 3 hours of opening", C.view(C.advance(e2, t + 3.2 * 3600 * S), t + 3.2 * 3600 * S).items.find((i) => i.kind === "counter").dry);
  // q6: the bars
  let b = put(base(), "shakebar", 5, 5, 0);
  r = A(b, "cook", {uid: thing(b, "shakebar").uid, dish: "strawshake"}, t);
  ok("the milkshake counter makes its own book (q6)", r.ok && !A(b, "cook", {uid: thing(b, "shakebar").uid, dish: "pancakes"}, t).ok && !A(b, "cook", {uid: thing(b, "stove").uid, dish: "strawshake"}, t).ok, r.error);
  let b2 = r.state, rt = t + 61 * S;
  ok("  never burns", C.view(b2, t + 3600 * S).items.find((i) => i.kind === "shakebar").stove.status === "ready");
  r = A(b2, "serve", {uid: thing(b2, "shakebar").uid}, rt);
  // (2026-10-26, Cam: "just be the prep counter for milkshakes like how stoves work")
  ok("  prep only: served out to the counters like a stove's dish, never dirty, no top of its own", r.ok && !thing(r.state, "shakebar").plates && C.food(r.state).some((o) => o.pl.dish === "strawshake") && C.stoveOf(thing(r.state, "shakebar"), rt).status === "free", r.error);
  ok("  people don't buy from it", !C.food(r.state).some((o) => o.it.kind === "shakebar"));
  ok("  no places on it to sell from", !C.plates(thing(r.state, "shakebar")).length);
  ok("  the sushi bar the same (later that day): prep only, its sushi onto a plain sushi counter, never a plain milkshake counter", (() => {
    let q = put(put(put(base(), "sushibar", 5, 5, 0), "sushishelf", 5, 3, 0), "shakeshelf", 3, 5, 0); const u = thing(q, "sushibar").uid, d = C.DISHES.find((x) => x.menu === "sushi");
    q = A(q, "cook", {uid: u, dish: d.id}, t).state; const z = A(q, "serve", {uid: u}, t + (d.secs + 1) * S);
    return z.ok && !thing(z.state, "sushibar").plates && thing(z.state, "sushishelf").plates[0].dish === d.id && thing(z.state, "shakeshelf").plates.every((x) => !x.dish) && /plain sushi counter/.test(z.msg || ""); })());
  ok("  the plain sushi counter at 22, painted four ways", C.THINGS.sushishelf.level === 22 && C.THINGS.sushishelf.slots === 3
    && ["l", "r", "bl", "br"].every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "sushishelf-" + k + ".webp"))));
  ok("  shakes left on an old milkshake counter's top go out to the counters", (() => { const q = JSON.parse(JSON.stringify(b)); thing(q, "shakebar").plates = [{dish: "chocshake", n: 7}]; const n = C.normal(q); return !thing(n, "shakebar").plates && n.food.some((f) => f.dish === "chocshake" && f.n === 7); })());
  // (2026-10-26, Cam) the plain milkshake counter: a bare top for three kinds of shake, served onto from a milkshake counter
  {
    let p = put(put(base(), "shakebar", 5, 5, 0), "shakeshelf", 5, 3, 0);
    const bar = () => thing(p, "shakebar"), shelf = () => thing(p, "shakeshelf");
    ok("a plain milkshake counter: level 9, three empty places on its top", C.THINGS.shakeshelf.level === 9 && shelf().plates.length === 3 && shelf().plates.every((x) => !x.dish));
    let at = t;
    const make = (dish) => { let q = A(p, "cook", {uid: bar().uid, dish}, at); if (!q.ok) return q; at += 400 * S; q = A(q.state, "serve", {uid: bar().uid}, at); if (q.ok) p = q.state; return q; };
    ok("  a shake from the milkshake counter goes onto it", make("strawshake").ok && shelf().plates[0].dish === "strawshake");
    ok("  the same shake again joins its place", make("strawshake").ok && shelf().plates[0].n === 2 * C.DISH.strawshake.servings && !shelf().plates[1].dish);
    ok("  three different shakes side by side", make("chocshake").ok && make("vanillamalt").ok && shelf().plates.map((x) => x.dish).join() === "strawshake,chocshake,vanillamalt", JSON.stringify(shelf().plates));
    ok("  a fourth kind goes on an ordinary counter, like a stove's dish", (() => { const q = make("bananashake"); return q.ok && C.food(p).some((o) => !C.isShelf(o.it) && o.pl.dish === "bananashake"); })());
    ok("  people buy from all three", ["strawshake", "chocshake", "vanillamalt"].every((id) => C.food(p).some((o) => o.it.kind === "shakeshelf" && o.pl.dish === id)));
    ok("  a stove's dishes never go on it", (() => { const q = JSON.parse(JSON.stringify(p)); thing(q, "shakeshelf").plates.forEach((x) => { x.dish = null; x.n = 0; });
      q.items.filter((i) => i.kind === "counter" || i.kind === "buffet").forEach((i) => { i.dish = "pancakes"; i.n = 5; (i.plates || []).forEach((x) => { x.dish = "pancakes"; x.n = 5; }); });
      C.placeFood(q, "eggs", 5, t); return thing(q, "shakeshelf").plates.every((x) => !x.dish); })());
    ok("  sold like the rest, and painted four ways", C.view(p, at).items.find((i) => i.kind === "shakeshelf").plates.length === 3
      && ["l", "r", "bl", "br"].every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "shakeshelf-" + k + ".webp"))));
  }
  ok("  the sushi bar at 22, one more every ten levels", C.THINGS.sushibar.level === 22 && C.allowed("sushibar", 32) === 2 && C.DISHES.filter((x) => x.menu === "sushi").length === 8);
  // q8 and the art
  const garden = ["pond_small", "pond_big", "pond_koi", "pond_lily", "fountain", "birdbath", "well", "bridge", "gazebo", "pergola", "rosearch", "sundial", "gnome", "statue", "birdhouse", "stonelantern"];
  ok("ponds and garden features outside, all in sizes (q8)", garden.every((id) => C.DECO[id] && C.DECO[id].nature === "garden" && C.DECO[id].grow));
  ok("  every new thing painted", garden.concat(["icecart", "coffeecart", "popcart", "cinema"]).every((id) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "prop-" + id + ".webp")))
     && ["icecart-shut", "coffeecart-shut", "popcart-shut", "cinema-on"].every((id) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "prop-" + id + ".webp")))
     && ["shakevend", "energyvend", "popcorn", "shakebar", "sushibar", "espresso"].every((k) => fs.existsSync(path.join(APP, "ui", "cafe", "art", k + "-l.webp")))
     && C.DISHES.filter((x) => x.menu === "shakes" || x.menu === "sushi" || x.brew).every((x) => ["dish", "cook", "burnt"].every((p) => fs.existsSync(path.join(APP, "ui", "cafe", "art", p + "-" + x.id + ".webp")))));
}

console.log("\nThe shovel, the level and water (Cam, 25 Oct)\n");
{
  const t = T0 + 5 * S;
  let s = skipped(); s.xp = C.XP[10]; s.terrain = [];
  s = A(s, "terrain", {t: "sand", r: 1, pts: [[12, 12]]}, t).state;
  s = A(s, "terrain", {t: "dug", r: 1, pts: [[14, 14]]}, t).state;
  s = A(s, "terrain", {t: "water", r: 0.8, pts: [[14, 14]]}, t).state;
  ok("the shovel digs the ground lower, and lake water goes in it", s.terrain.some((d) => d[0] === "dug") && s.terrain.some((d) => d[0] === "water"));
  ok("  water and deep water are grounds you paint (from levels 3 and 6); the dug ground isn't in the list", C.TERRAIN.water.water && C.TERRAIN.deepwater.level === 6
     && !C.view(s, t).terrainShop.some((x) => x.id === "dug") && C.view(s, t).terrainShop.some((x) => x.id === "deepwater"));
  const lv = A(s, "terrain", {t: "level", r: 1.8, pts: [[14, 14], [12, 12]]}, t);
  ok("  the level fills it back in: the dug ground and its water go, the sand stays", lv.ok && lv.state.terrain.length === 1 && lv.state.terrain[0][0] === "sand");
  ok("  painted in two frames that the page swaps", ["water", "water-2", "deepwater", "deepwater-2", "dug"].every((id) => fs.existsSync(path.join(APP, "ui", "cafe", "art", "tex-" + id + ".webp"))));
}

console.log("\nWalking round water (Cam, 25 Oct)\n");
{
  const t = T0 + 7 * S;
  let s = skipped(); s.terrain = []; s.decor = []; s.xp = C.XP[10];
  const a = {x: 12, y: 6}, b = {x: 12, y: 14};
  const wet = (w) => w.some((q, i) => i && [0.25, 0.5, 0.75].some((u) => { const p = w[i - 1], x = p.x + (q.x - p.x) * u, y = p.y + (q.y - p.y) * u; return Math.hypot(x - 12, y - 10) < 1.2; }));
  ok("dry grass: a straight walk", C.outWalk(s, a, b).length === 2);
  s = A(s, "terrain", {t: "water", r: 1.8, pts: [[12, 10]]}, t).state;
  const w = C.outWalk(s, a, b);
  ok("  lake water in the way: they walk round it", w && w.length > 2 && !wet(w));
  let br = JSON.parse(JSON.stringify(s)); br.decor.push({uid: 99999, id: "bridge", x: 12, y: 10, dir: 0, scale: 2});
  br.terrain = [["water", 12, 10, 1.8]];
  ok("  a garden bridge over it is the way across", C.walkBlocked(s, 12, 10) && !C.walkBlocked(br, 12, 10));
}

{
  // (Cam, 25 Oct: "when clicking the pop corn cart i cant collect my coins") -- outside things ignore clicks unless they opt in
  const css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8");
  ok("carts and the cinema take clicks outside Build (to collect or restock)", /\.nc-prop\.nc-stall \{[^}]*pointer-events: auto/.test(css));
}

{
  // (Cam, 25 Oct: "light encroaching on the outside") -- the wall lights' glows are cut to the café's floor and walls
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("the wall lights' glows stay inside the café (cut to its outline)", /class="nc-glowclip" style="clip-path:polygon\(\$\{ring\}\)"/.test(page));
}

{
  // (Cam, 25 Oct) the Bag a book; storage in Build; the pantry a cupboard; 6-hour dishes
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  ok("the Bag is a book: Potions, Items and Collectibles (Aunty's secret recipes, the events' things)", /let bagAt = \{ sec: "potions"/.test(page) && /id: "collect", name: "Collectibles"/.test(page) && /\["Aunty's secret recipes", secrets\]/.test(page));
  ok("  storage is in Build", /\["storage", "Storage"\]/.test(page) && /function storedCards/.test(page));
  const s = C.advance(open(T0), T0 + 1000);
  ok("the pantry is a cupboard you place: one each, every café given one in storage", C.THINGS.cupboard.pantry && C.allowed("cupboard", 50) === 1 && s.ware.cupboard === 1 && fs.existsSync(path.join(APP, "ui", "cafe", "art", "cupboard.webp")));
  ok("6-hour dishes: the cabbage soup, porridge, hog roast and thyme-roast pork", ["cabbagesoup", "porridge", "hogroast", "thymepork"].every((id) => C.DISH[id].secs === 6 * 3600));
}

{
  // (Cam, 25 Oct: "check the performance of the water") -- its frames swap by the clock, no fade (a fade redrew the ground every frame)
  const css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8"), page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  // (2026-10-26 performance, Cam: "happy if the water isnt animated"): still water, and the beat's classes never on <body>
  // -- a class flipped on <body> made the browser redraw the whole painted ground every beat
  ok("the water is still (one frame), and nothing flips classes on <body> on the beat", !/nc-wf2|nc-wave/.test(css + page) && !/body\.nc-(up|sway)/.test(css) && !/body\.classList\.toggle\("nc-(up|sway)"/.test(page));
}

{
  // (Cam, 25 Oct) surprises: what's locked is a question mark; unlocking an event thing turns it over; the NeuroVale log
  const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8");
  const mc = (h) => { const m = page.match(/const mysteryCards = \(html\) => html\.replace\((\/.*\/g), `\$1\$\{QM\}\$2<b>\?\?\?<\/b>`\);/); return m ? h.replace(eval(m[1]), "$1?$2<b>???</b>") : h; };
  ok("locked cards in the Buy and Build catalogues show a question mark and no name (not the café's sizes)",
     mc('<div class="nc-card locked"><img alt="" src="a.webp"><b>Gazebo</b>') === '<div class="nc-card locked">?<b>???</b>' && mc('<div class="nc-card nc-noq locked"><img alt="" src="a.webp"><b>8x8 café</b>').includes("8x8")
     && mc('<div class="nc-card"><img alt="" src="a.webp"><b>Chair</b>').includes("Chair") && (page.match(/html = mysteryCards\(html\);/g) || []).length === 2);
  ok("  the cookbook (every tab and book), the seed book, the events book and the Bag's collections too", /const hidden = !x\.open;/.test(page) && /A recipe still to come/.test(page) && /A crop still to come/.test(page) && /<h2>A surprise<\/h2>/.test(page) && /qmark: !w\.got/.test(page));
  ok("  unlocked at the haunted house, it turns over in colour", /evFlip = evPick = b\.dataset\.evunlock/.test(page) && /\.nc-reveal \{ animation: nc-flip/.test(css));
  ok("the NeuroVale log in the Bag: the mounted weapons and the keepsakes", /\{ id: "vale", name: "NeuroVale"/.test(page) && /\["Mounted weapons", vale\.weapons\], \["Keepsakes", vale\.keeps\]/.test(page));
  let s = classic(skipped(T0)); s.vale = []; s.dware.vale_chest = 1;
  delete s.vale; s = C.advance(s, T0 + 1000);
  ok("  keepsakes had before count in it; a full cart can leave a weapon (35% of the carts without a keepsake)", s.vale.includes("vale_chest") && C.CART.weapon === 0.35);
}

console.log("\nHalloween's farewell: the candy left becomes Halloween dishes (Cam, 2026-11-01)\n");
{
  const OCT20 = new Date(2026, 9, 20, 12).getTime(), NOV2 = new Date(2026, 10, 2, 12).getTime(), HW = C.DISHES.filter((d) => d.event === "halloween").map((d) => d.id);
  const s0 = Object.assign(skipped(OCT20), {candy: 2766});
  ok("candy keeps while Halloween is on", C.advance(s0, OCT20 + 1000).candy === 2766 && !C.view(C.advance(s0, OCT20 + 1000), OCT20 + 1000).feast);
  const s1 = C.advance(s0, NOV2), lots = s1.feast.dishes, total = lots.reduce((a, o) => a + o.n, 0);
  ok("  after it: the candy's gone, every one a serving of a Halloween dish, in uneven lots of several dishes",
     s1.candy === 0 && total === 2766 && lots.length >= 3 && lots.every((o) => HW.includes(o.dish) && o.n > 0) && new Set(lots.map((o) => o.n)).size > 1);
  const onCounters = s1.items.reduce((a, it) => a + [].concat(it.plates || [], it.under || []).filter((p) => p && HW.includes(p.dish)).reduce((b, p) => b + p.n, 0), 0) + s1.food.filter((f) => HW.includes(f.dish)).reduce((a, f) => a + f.n, 0);
  ok("  the servings are on the counters (or waiting in the bag for room)", onCounters === 2766);
  const v1 = C.view(s1, NOV2);
  ok("  the farewell shows once: in the view till seen", v1.feast && v1.feast.candy === 2766 && v1.feast.dishes.length === lots.length && !C.view(A(s1, "feastSeen", {}, NOV2).state, NOV2).feast);
  ok("  only the dishes you unlocked when you have some", (() => { const q = C.advance(Object.assign(skipped(OCT20), {candy: 500, eventGot: ["pumpkinsoup", "toffeeapple"]}), NOV2); return q.feast.dishes.every((o) => ["pumpkinsoup", "toffeeapple"].includes(o.dish)) && q.feast.dishes.reduce((a, o) => a + o.n, 0) === 500; })());
  ok("  no candy, no farewell", !C.advance(skipped(OCT20), NOV2).feast);
}

console.log("\nThe haunted house open to the public (Cam, 2026-11-01)\n");
{
  const NOV2 = new Date(2026, 10, 2, 12).getTime(), N21 = new Date(2026, 10, 2, 21, 0).getTime(), N06 = new Date(2026, 10, 3, 6, 0).getTime(), OCT20 = new Date(2026, 9, 20, 21).getTime();
  const H = C.HAUNT.mansion, base = (t) => Object.assign(skipped(t), {xp: C.XP[40], coins: 700000});
  let s = base(NOV2);
  ok("650,000 to open, 9 pm to 6 am", H.price === 650000 && H.from === 21 && H.to === 6);
  ok("  not without the house on your street", /street/.test(A(s, "hauntOpen", {id: "mansion"}, NOV2).error || ""));
  s.decor.push({uid: 9001, id: "mansion", x: -6, y: 3, dir: 0});
  ok("  not without the coins", /650000/.test(A(Object.assign(JSON.parse(JSON.stringify(s)), {coins: 1000}), "hauntOpen", {id: "mansion"}, NOV2).error || ""));
  const r = A(s, "hauntOpen", {id: "mansion"}, NOV2);
  ok("  bought: the coins go, the house is open", r.ok && r.state.coins === 50000 && r.state.haunts.mansion && /already/.test(A(r.state, "hauntOpen", {id: "mansion"}, NOV2).error || ""));
  const day = C.advance(r.state, N21 - 60000);
  ok("  nobody in the daytime", day.coins === 50000 && day.haunts.mansion.visitors === 0 && !C.hauntOn(day, "mansion", NOV2));
  const night = C.advance(day, N06 + 60000), n = night.haunts.mansion.visitors, per = Math.round(9 * 3600 / H.gap);
  ok("  through the night a visitor about every " + H.gap + " s, each paying " + H.fee + " (" + n + " visitors)", n >= per - 2 && n <= per + 2 && night.haunts.mansion.earned === n * H.fee && night.coins >= 50000 + n * H.fee);
  ok("  the view says so", C.view(night, N21 + 3600000).haunts.find((x) => x.id === "mansion").bought && C.view(day, N21 + 3600000).haunts[0].on);
  const hw = Object.assign(JSON.parse(JSON.stringify(r.state)), {});
  ok("  in Halloween it's the candy store only: no visitors", !C.hauntOn(hw, "mansion", OCT20) && C.advance(Object.assign(hw, {at: OCT20 - 3600000}), OCT20 + 3600000).haunts.mansion.visitors === 0);
  ok("  the same times every time (the page draws the visitors the coins were counted for)", C.hauntArrive("mansion", 12345) === C.hauntArrive("mansion", 12345));
}

console.log("\nA narrow, tall window (Cam, 2026-11-01)\n");
{
  const css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8"), narrow = css.slice(css.lastIndexOf("a narrow, tall window"));
  ok("narrow: the books show both pages at once, each scrolling, the tabs in a sideways row; the clock clear of the buttons",
     /\.nc-cookbook \{ height: calc\(100vh/.test(narrow) && /grid-template-rows: minmax\(0, 1\.2fr\) minmax\(0, 1fr\)/.test(narrow)
     && /\.nc-cb-tabs2, \.nc-cb-tabs2\.r \{[^}]*overflow-x: auto/.test(narrow) && /\.nc-clock \{ left: 62px; right: 62px/.test(narrow));
  ok("  the top bar fits: the name and the rush tag go, the pills shrink", /\.nc-name b \{ display: none; \}/.test(narrow) && /\.nc-pop \.nc-rushx \{ display: none; \}/.test(narrow));
  const app = path.join(APP, "neurocafe.py");
  ok("  the window can be made narrow (360 x 480)", !fs.existsSync(app) || /min_size=\(360, 480\)/.test(fs.readFileSync(app, "utf8")));
}

console.log("\nThe café diary and the happenings (2026-11-07, Cam)\n");
{
  const t = T0, MIN_ = 60 * S, page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
  // Aunty's box goes in the diary
  let s = live(t); s = C.advance(s, t + S);
  ok("a new café's diary has just the tutorial's level-up in it", C.view(s, t + S).diary.length === 1 && C.view(s, t + S).diary[0].title === "Level 2");
  s = A(s, "diaryRead", {}, t + S).state;
  let r = A(s, "aunty", {}, t + 2 * S);
  let d = r.state.diary[r.state.diary.length - 1];
  ok("opening Aunty's box writes it in the diary: her note and every gift", r.ok && d && d.kind === "aunty" && d.says === r.events[0].say && JSON.stringify(d.gains) === JSON.stringify(r.events[0].gifts) && d.at === t + 2 * S, JSON.stringify(d));
  ok("  it's waiting to be read, and reading the diary clears the count", C.view(r.state, t + 2 * S).diaryNew === 1 && C.view(A(r.state, "diaryRead", {}, t + 3 * S).state, t + 3 * S).diaryNew === 0);
  // a level's reward
  let L = JSON.parse(JSON.stringify(classic(skipped(t)))); L.customers = []; L.next = null; L.closed = true; L.xp = C.XP[10] - 1; L.coins = 1000;
  r = A(L, "cook", {uid: 1, dish: "pancakes"}, t); r = A(r.state, "serve", {uid: 1}, t + 10 * S);
  d = r.state.diary.find((e) => e.title === "Level 10");
  ok("a level-up writes its reward: the coins and the potions", d && d.title === "Level 10" && d.gains[0].n === 1500 && d.gains.filter((g) => g.kind === "potion").length === 3, JSON.stringify(d));
  // a full NeuroVale cart
  let cs = JSON.parse(JSON.stringify(skipped(t))); cs.sandbox = true; cs.closed = true; cs.customers = []; cs.next = null;
  cs = A(cs, "dev", {op: "cart"}, t).state; cs.cart.order.forEach((l) => { l.got = l.n; });
  r = A(cs, "cartLoad", {}, t + S);
  d = r.state.diary.find((e) => e.kind === "cart");
  ok("a full NeuroVale cart writes who it was, what they paid and what they left", r.ok && d && d.who === cs.cart.tutor && d.gains[0].kind === "coins" && d.gains[0].n > 0 && d.gains[1] && d.gains[1].kind !== "weapon", JSON.stringify(d));
  // the diary keeps the newest DIARY.keep, the view newest first
  const many = JSON.parse(JSON.stringify(s)); for (let i = 0; i < C.DIARY.keep + 5; i++) many.diary.push({id: i + 1, at: t + i, kind: "happening", title: "x" + i, gains: []}); many.diaryN = C.DIARY.keep + 5;
  const mv = C.view(C.normal(many), t);
  ok("  the diary keeps the newest " + C.DIARY.keep + ", newest first", mv.diary[0].title === "x" + (C.DIARY.keep + 4) && (() => { const g = A(many, "aunty", {}, t + 2 * S).state; return g.diary.length === C.DIARY.keep && g.diary[0].id === 7; })());
  // happenings: one every 70 to 160 minutes once the tutorial's done
  let h = live(t); h.closed = true; h.customers = []; h.next = null; h = C.advance(h, t + S);
  const due = h.hap && h.hap.next;
  ok("happenings: the first is booked 70 to 160 minutes out", due >= t + S + 70 * MIN_ && due <= t + S + 160 * MIN_, due && (due - t) / MIN_);
  const h1 = C.advance(JSON.parse(JSON.stringify(h)), due - S), h2 = C.advance(JSON.parse(JSON.stringify(h)), due + S);
  const haps = (g) => g.diary.filter((e) => e.kind === "happening");
  ok("  nothing before it's due; when it is, one goes in the diary and the next is booked", haps(h1).length === 0 && haps(h2).length === 1 && haps(h2)[0].icon && haps(h2)[0].title && h2.hap.next >= due + S + 70 * MIN_);
  const away = C.advance(JSON.parse(JSON.stringify(h)), due + 5 * 24 * 60 * MIN_);
  ok("  away for days: just the one that was due, never a pile", away.diary.filter((e) => e.kind === "happening").length === 1);
  const off = JSON.parse(JSON.stringify(h)); off.prefs.happen = false;
  ok("  switched off in Settings: none", !haps(C.advance(off, due + S)).length && C.prefs(off).happen === false && C.prefs(h).happen === true && C.prefs(C.empty()).happen === true && A(h, "prefs", {happen: false}, t + 2 * S).state.prefs.happen === false);
  const tut = open(t);
  delete tut.prefs.happen;
  ok("  none in the tutorial", !haps(C.advance(tut, t + 3 * 24 * 60 * MIN_)).length);
  // every happening, on a café where each can happen
  const rich = () => {
    let g = JSON.parse(JSON.stringify(skipped(t))); g.xp = C.XP[20]; g.coins = 1e5; g.closed = false; g.stats.served = 100; g.customers = []; g.next = null;
    g = C.normal(g); g.inv = {}; g.pantry = {egg: 10}; g.seeds = {};
    g.items.find((i) => i.kind === "stove").dish = "honeycake"; g.items.find((i) => i.kind === "stove").start = t - S;
    g.field = [{uid: 900, x: -7, y: 1, crop: "wheat", at: t - S}];
    return g;
  };
  const results = C.HAPPENINGS.map((x) => { const g = rich(); const need = !x.need || x.need(g, t); let e = null, err = ""; try { e = x.run(g, t); } catch (ex) { err = ex.message; } return {x, g, e, need, err}; });
  ok("every happening can happen on a busy café, and says what came and went", results.every((o) => o.need && o.e && o.e.title && o.e.says && o.e.gains.length && !/--/.test(o.e.title + o.e.says)), results.filter((o) => !(o.need && o.e && o.e.gains.length)).map((o) => o.x.id + " " + o.err).join());
  ok("  " + C.HAPPENINGS.length + " of them, good and bad, every one with its own id and sign", C.HAPPENINGS.length >= 20 && new Set(C.HAPPENINGS.map((x) => x.id)).size === C.HAPPENINGS.length && C.HAPPENINGS.every((x) => x.icon && x.w > 0)
     && C.HAPPENINGS.filter((x) => x.bad).length >= 8 && C.HAPPENINGS.filter((x) => !x.bad).length >= 8);
  ok("  the coins that came or went are the coins the café has", results.every((o) => { const c = o.e.gains.filter((g2) => g2.kind === "coins").reduce((a, g2) => a + g2.n, 0); return o.g.coins === 1e5 + c; }));
  const mayor = results.find((o) => o.x.id === "mayor").e.gains[0].n, sick = results.find((o) => o.x.id === "sick").e.gains[0].n;
  ok("  amounts grow with the level: at level 20 the mayor gives about 2,000, the food poisoning costs about 20,000", mayor >= 1700 && mayor <= 2300 && sick <= -17000 && sick >= -23000, mayor + " " + sick);
  const st = results.find((o) => o.x.id === "stove");
  ok("  the broken stove: the dish cooking on it thrown away, the call-out paid", !st.g.items.find((i) => i.kind === "stove").dish && st.e.gains.some((g2) => g2.kind === "lost" && g2.id === "honeycake") && st.e.gains.some((g2) => g2.kind === "coins" && g2.n < 0));
  ok("  the power cut holds the cooking up ten minutes", results.find((o) => o.x.id === "power").g.items.find((i) => i.kind === "stove").start === t - S + 10 * MIN_);
  ok("  the fox takes eggs; the crows start a plot again; the rain ripens one", results.find((o) => o.x.id === "fox").g.pantry.egg < 10 && results.find((o) => o.x.id === "crows").g.field[0].at === t
     && C.view(results.find((o) => o.x.id === "rain").g, t).field.plots[0].ready);
  ok("  the coach party and the critic bring a crowd, the busker golden tips", results.find((o) => o.x.id === "coach").g.boost.crowd === t + 15 * MIN_ && results.find((o) => o.x.id === "critic").g.boost.crowd === t + 30 * MIN_ && results.find((o) => o.x.id === "busker").g.boost.golden === t + 30 * MIN_);
  const poor = rich(); poor.coins = 300; const pe = C.HAPPENING.sick.run(poor, t);
  ok("  a loss never takes more than a third of your coins", pe.gains[0].n === -100 && poor.coins === 200);
  ok("  the inspector fines dirty kitchens and rewards clean ones", (() => { const a = rich(); a.items.filter(C.cooks).forEach((i) => { i.dirty = true; }); const b = rich(); return C.HAPPENING.inspector.run(a, t).bad === true && C.HAPPENING.inspector.run(b, t).gains[0].n > 0; })());
  // the sandbox's button
  const sb = JSON.parse(JSON.stringify(skipped(t))); sb.sandbox = true;
  r = A(sb, "dev", {op: "happen", v: "mayor"}, t + S);
  ok("the sandbox: Happen now (any, or the one picked)", r.ok && r.state.diary.slice(-1)[0].who === "mayor" && A(sb, "dev", {op: "happen"}, t + S).ok && !A(skipped(t), "dev", {op: "happen"}, t).ok
     && /Nothing can happen/.test(A(sb, "dev", {op: "happen", v: "crows"}, t + S).error || ""));
  // the page
  ok("the page: a Diary button with the count still to read (L), the book like the cookbook", /tab\("diary", DIARY_IC, "Diary"[^\n]*v\.diaryNew\)/.test(page) && /function diaryBook\(\)/.test(page) && /bookModal\(tabs, left, right, "diary"\)/.test(page) && /l: "diary"/.test(page));
  ok("  opening it reads them; a happening says so once, as it comes", /act\("diaryRead", \{\}, true\)/.test(page) && /function diaryNews\(v\)/.test(page) && /diaryNews\(v\);/.test(page));
  ok("  Settings can switch the happenings off", /data-happen/.test(page) && /setPrefs\(\{ happen: e\.target\.checked \}\)/.test(page));
  ok("  every kind of thing in an entry has a picture and a name", ["coins", "pantry", "boost", "lost", "text"].every((k) => page.includes(`g.kind === "${k}"`)));
}

console.log("\nHalf walls: built on the lines between tiles (2026-11-08, Cam)\n");
{
  const t = T0, W = (x, y, dir) => ({x, y, dir});
  let s = Object.assign(skipped(t), {xp: C.XP[22], coins: 5000, size: 8});
  ok("not before level 9", /level 9/.test(A(Object.assign(JSON.parse(JSON.stringify(s)), {xp: C.XP[8]}), "halfWall", {style: "halfwall", walls: [W(3, 3, 0)]}, t).error || ""));
  let r = A(s, "halfWall", {style: "halfwall", walls: [W(3, 3, 0), W(5, 2, 1)]}, t);
  ok("the white one comes free with them: a horizontal and a vertical one, 15 coins each", r.ok && r.state.hwalls.length === 2 && r.state.coins === s.coins - 2 * C.HALF_WALL.seg
     && r.state.hwalls.some((w) => w.x === 3 && w.y === 3 && w.dir === 0) && r.state.hwalls.some((w) => w.x === 5 && w.y === 2 && w.dir === 1), r.error);
  const s2 = r.state;
  ok("  it stands between two tiles: nobody steps across it, both ways", C.walled(s2, {x: 3, y: 2}, {x: 3, y: 3}) && C.walled(s2, {x: 3, y: 3}, {x: 3, y: 2})
     && C.walled(s2, {x: 4, y: 2}, {x: 5, y: 2}) && !C.walled(s2, {x: 4, y: 3}, {x: 5, y: 3}) && !C.walled(s2, {x: 2, y: 2}, {x: 2, y: 3}));
  ok("  and the tiles either side stay free for things (a wall fits between two of them)", !C.hwEdgeProblem(s2, W(3, 3, 0)) && C.hwSides(W(3, 3, 0)).map((c) => c.x + "," + c.y).join(" ") === "3,2 3,3"
     && C.hwSides(W(5, 2, 1)).map((c) => c.x + "," + c.y).join(" ") === "4,2 5,2");
  ok("  not on the café's own walls (the back and the left)", /café's own wall/.test(A(s, "halfWall", {style: "halfwall", walls: [W(2, 0, 0)]}, t).error || "")
     && /café's own wall/.test(A(s, "halfWall", {style: "halfwall", walls: [W(0, 2, 1)]}, t).error || ""));
  // outside (Cam, 8 Nov: "half walls can be placed outside an inside the cafe")
  r = A(s, "halfWall", {style: "halfwall", walls: [W(2, 8, 0), W(8, 3, 1), W(10, 10, 0), W(3, 12, 1)]}, t);
  ok("outside too: along the café's open front edges and out on the grass", r.ok && r.state.hwalls.length === 4, r.error);
  ok("  not down the pavement or the road (its edge is fine), nor too far out", /pavement or the road/.test(A(s, "halfWall", {style: "halfwall", walls: [W(3, -2, 0)]}, t).error || "")
     && A(s, "halfWall", {style: "halfwall", walls: [W(3, 0, 0)].map((w) => ({x: w.x + 9, y: 0, dir: 0}))}, t).ok && /too far out/.test(A(s, "halfWall", {style: "halfwall", walls: [W(60, 3, 1)]}, t).error || ""));
  ok("  people walking outside go round them, like a fence", /hwFences\(s\)\.some/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafecore.js"), "utf8")) && /hwFences\(s\)\.forEach/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafecore.js"), "utf8")));
  ok("  swatches: each piece keeps the colours it was built in (and building over it in new ones repaints it, free)", (() => {
    const red = {h: 340, s: 1.5, b: 0.9, sw: "Red"}, a = A(s, "halfWall", {style: "halfwall", walls: [W(3, 3, 0)], tint: red}, t), b2 = A(a.state, "halfWall", {style: "halfwall", walls: [W(3, 3, 0)]}, t);
    return a.ok && a.state.hwalls[0].tint.sw === "Red" && b2.ok && b2.state.coins === a.state.coins && !b2.state.hwalls[0].tint; })());
  const grown = A(Object.assign(JSON.parse(JSON.stringify(r.state)), {coins: 1e7, xp: 1e7}), "expand", {}, t).state, gk = (w) => w.x + "," + w.y + "," + w.dir;
  ok("  an expansion takes the ones past the front edges out with them (inside ones stay)", grown.size === 9 && ["2,9,0", "9,3,1", "11,11,0", "3,13,1"].every((k) => grown.hwalls.some((w) => gk(w) === k)));
  const run = []; for (let x = 1; x < 6; x++) run.push(W(x, 6, 0));
  r = A(s, "halfWall", {style: "halfwall", walls: run}, t);
  ok("a dragged run is built in one go", r.ok && r.state.hwalls.length === 5 && r.state.coins === s.coins - 5 * C.HALF_WALL.seg, r.error);
  ok("  built again on the same edges in another look: no charge", (() => { const q = A(Object.assign(r.state, {hwStyles: {screen: true}}), "halfWall", {style: "screen", walls: run}, t); return q.ok && q.state.coins === r.state.coins && q.state.hwalls.every((w) => w.style === "screen"); })());
  const rm = A(r.state, "halfWallRemove", {walls: run.slice(0, 2)}, t);
  ok("  the velvet rope in two parts: its rope and its posts each take their own colour (a layer each, both pictures)", (() => {
    const T = C.THINGS.vipropes, art = path.join(APP, "ui", "cafe", "art");
    return T.tint === "velvet" && T.tint2 === "brass" && T.parts.join() === "Rope,Posts" && /velvet: \[NATURAL\(/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"))
      && ["l", "r"].every((s) => fs.existsSync(path.join(art, `vipropes-${s}-fab.webp`)) && fs.existsSync(path.join(art, `vipropes-${s}-fab2.webp`)));
  })());
  ok("  taken down: gone, the coins back", rm.ok && rm.state.hwalls.length === 3 && rm.state.coins === r.state.coins + 2 * C.HALF_WALL.seg, rm.error);
  // the till at 3,3 (skipped's café): walled in on all four sides, nobody could pay
  const till = s.items.find((i) => i.kind === "till"), box = [W(till.x, till.y, 0), W(till.x, till.y + 1, 0), W(till.x, till.y, 1), W(till.x + 1, till.y, 1)];
  r = A(s, "halfWall", {style: "halfwall", walls: box}, t);
  ok("never so customers can't reach a counter or the till -- nothing's built, nothing's paid", !r.ok && /couldn't reach the cash register/.test(r.error) && r.state.coins === s.coins && !(r.state.hwalls || []).length, r.error);
  ok("  three sides are fine (the kitchen's open side is its way in)", A(s, "halfWall", {style: "halfwall", walls: box.slice(0, 3)}, t).ok);
  {
    // an hour of customers past a run of half walls (Cam: "make sure colission is on with the half walls so the customers walk around them")
    let g = A(s, "halfWall", {style: "halfwall", walls: box.slice(0, 3).concat([W(1, 5, 0), W(2, 5, 0), W(3, 5, 0), W(4, 5, 0), W(5, 3, 1), W(5, 4, 1)])}, t).state;
    g.closed = false; g.coins = 1e5; g.customers = []; g.at = g.clock = t; g.next = t + 2000; Object.assign(counter(g), {dish: "pancakes", n: 5000, since: t});
    const seen = {}, bad = [];
    const crosses = (r) => (r || []).some((p, i) => i && (Math.abs(p.x - r[i - 1].x) + Math.abs(p.y - r[i - 1].y) === 1 ? C.walled(g, r[i - 1], p)
      : C.walled(g, r[i - 1], {x: p.x, y: r[i - 1].y}) && C.walled(g, r[i - 1], {x: r[i - 1].x, y: p.y})));
    for (let m = 1; m <= 60; m++) {
      g = C.advance(g, t + m * 60 * S);
      g.customers.forEach((c) => { seen[c.id] = 1; ["a", "b", "o", "s"].forEach((k) => { if (crosses(c[k])) bad.push(c.id + k); }); });
    }
    ok("  customers walk round them: an hour of comings and goings, not one step through a half wall", Object.keys(seen).length > 5 && !bad.length, Object.keys(seen).length + " seen, " + bad.join(" "));
    // already on their way when it goes up: the walk goes round it instead
    let h = JSON.parse(JSON.stringify(s)); h.closed = false; h.customers = []; h.at = h.clock = t; h.next = t + 2000; Object.assign(counter(h), {dish: "pancakes", n: 5000, since: t});
    h = C.advance(h, t + 5 * 60 * S);
    const c0 = h.customers.find((c) => c.o && c.o.length > 3), mid = c0 && c0.o[1], nx = c0 && c0.o[2];
    const cut = mid && (mid.x === nx.x ? W(mid.x, Math.max(mid.y, nx.y), 0) : W(Math.max(mid.x, nx.x), mid.y, 1));
    const hr = cut && A(h, "halfWall", {style: "halfwall", walls: [cut]}, t + 5 * 60 * S);
    ok("  someone already on their way when one goes up across it: they go round it", !!(hr && hr.ok) && (() => { const g2 = hr.state, c1 = g2.customers.find((c) => c.id === c0.id); g = g2; return c1 && !crosses(c1.o) && c1.o[0].x === c0.o[0].x && c1.o[c1.o.length - 1].y === c0.o[c0.o.length - 1].y; })(), hr && hr.error);
  }
  // a chair facing a table across the line
  let d = A(stock(s, "table").state, "place", {kind: "table", x: 5, y: 5, dir: 0}, t).state;
  d = A(A(d, "buy", {kind: "chair"}, t).state, "place", {kind: "chair", x: 5, y: 4, dir: 0}, t).state;
  const ch = d.items.find((i) => i.kind === "chair");
  ok("  nor between a seat and its table", !!C.seatTable(d, ch) && /between a seat and its table/.test(A(d, "halfWall", {style: "halfwall", walls: [W(5, 5, 0)]}, t).error || ""));
  // a buffet counter covers two tiles: no wall through it, and none can stand across a wall
  const bf = s.items.find((i) => i.kind === "buffet"), cs = C.cells(bf), e = cs[0].x === cs[1].x ? W(cs[0].x, Math.max(cs[0].y, cs[1].y), 0) : W(Math.max(cs[0].x, cs[1].x), cs[0].y, 1);
  ok("  never through a thing standing on both sides", /go through the buffet counter/.test(A(s, "halfWall", {style: "halfwall", walls: [e]}, t).error || ""));
  ok("  and a long thing can't be put down across one", (() => {
    const w = A(s, "halfWall", {style: "halfwall", walls: [W(6, 4, 0)]}, t).state, q = A(w, "move", {uid: bf.uid, x: 6, y: 3, dir: 1}, t);
    return !q.ok && /half wall runs through/.test(q.error || "") && A(w, "move", {uid: bf.uid, x: 6, y: 3, dir: 0}, t).ok; })());
  // the styles: the old dividers' pictures, bought at the furniture store
  ok("the styles: the eight old dividers and the sixteen railings (the white half-wall and plain wood railing free, the rest bought)", C.HALF_WALLS.length === 24 && C.HALF_WALLS.slice(0, 8).every((x) => C.THINGS[x.id] && C.THINGS[x.id].divider)
     && C.HALF_WALLS.slice(8).every((x) => x.rail && x.mat && x.id === "rail_" + x.rail) && C.HALF_WALLS.filter((x) => !x.price).map((x) => x.id).join() === "halfwall,rail_wood");
  ok("  one not yours can't be built", /isn't yours yet/.test(A(s, "halfWall", {style: "lattice", walls: [W(3, 3, 0)]}, t).error || ""));
  ok("  bought only at the furniture store", /furniture store out/.test(A(s, "buyHalfWall", {id: "lattice"}, t).error || ""));
  const st = A(Object.assign(JSON.parse(JSON.stringify(s)), {coins: 20000}), "decorPlace", {id: "furnstore", x: 11, y: 1.05, dir: 0}, t).state;
  r = A(st, "buyHalfWall", {id: "lattice"}, t);
  ok("  there: paid once, then it's yours to build", r.ok && r.state.coins === st.coins - 390 && A(r.state, "halfWall", {style: "lattice", walls: [W(3, 3, 0)]}, t).ok
     && /yours already/.test(A(r.state, "buyHalfWall", {id: "lattice"}, t).error || ""), r.error);
  ok("  each at its own level", /level 22/.test(A(Object.assign(JSON.parse(JSON.stringify(st)), {xp: C.XP[20]}), "buyHalfWall", {id: "barrier"}, t).error || ""));
  ok("  the view has them: where they stand, the styles, yours or not", (() => { const v = C.view(r.state, t); return v.halfWalls.open && v.halfWalls.seg === 15 && v.halfWalls.styles.find((x) => x.id === "lattice").owned && !v.halfWalls.styles.find((x) => x.id === "screen").owned && Array.isArray(v.hwalls); })());
  ok("dividers aren't sold any more", /half walls now/.test(A(s, "buy", {kind: "lattice"}, t).error || ""));
  ok("  the level-up card says so: half walls at 9, the styles at theirs -- not dividers", C.unlocksAt(9).some((u) => u.kind === "halfwall" && /Build > Half walls/.test(u.name)) && C.unlocksAt(20).some((u) => u.id === "lattice" && u.kind === "halfwall") && !C.unlocksAt(20).some((u) => u.kind === "thing" && u.id === "lattice"));
  // an old save: a stored low brick wall and folding screen (as Cam's had) become styles of yours
  const old = JSON.parse(JSON.stringify(s)); delete old.hwMoved; delete old.hwStyles; old.ware = Object.assign({}, old.ware, {halfbrick: 1, screen: 1});
  const n = C.normal(old);
  ok("an old save's dividers become its half-wall styles (out of storage), once", n.hwStyles.halfbrick && n.hwStyles.screen && !n.ware.halfbrick && !n.ware.screen && !n.hwStyles.lattice && n.hwMoved
     && JSON.stringify(C.normal(Object.assign(n, {ware: Object.assign({}, n.ware, {lattice: 1})})).ware.lattice) === "1");
  {
    const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8"), css = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.css"), "utf8");
    ok("the page: a Half walls tab in Build (lit as Build), and no Dividers in Buy", /\["hwalls", "Half walls"\]/.test(page) && /b\.hwalls \|\| b\.expand/.test(page) && !/id: "dividers"/.test(page));
    ok("  the nearest line under the pointer decides across or down; a drag runs straight along it", /function edgeAt\(v, ev\)[^]*?Math\.abs\(c - Math\.round\(c\)\) < Math\.abs\(r - Math\.round\(r\)\)/.test(page) && /function hwRun\(a, p\)/.test(page)
       && /hwDo\(hwRun\(d\.a, d\.p\)\)/.test(page) && /act\("halfWall", Object\.assign\(\{ walls: run \}, hwLook\(\)\)\)/.test(page));
    ok("  drawn on the line with the divider's own run, a ghost (red where it can't go), right-click takes one down", /const hw = hwallsHTML\(v\)/.test(page) && /\$\{st\.back\}\$\{hw\.back\}/.test(page) && /C\.hwEdgeProblem\(state, w, state\.items\) \? "ghost bad" : "ghost"/.test(page)
       && /act\("halfWallRemove", \{ walls: \[\{ x: h\.x, y: h\.y, dir: h\.dir \}\] \}\)/.test(page) && /\.nc-hwall \{ pointer-events: none/.test(css));
    ok("  the furniture store has a Half walls section that sells the styles", /id: "halfwalls", name: "Half walls"[^]*?hw: true/.test(page) && /act\("buyHalfWall", \{ id: b\.dataset\.hwbuy \}\)/.test(page));
    ok("  Rosa explains them the first time the tab opens", /const HW_SAY = \[/.test(page) && /act\("lesson", \{ id: "halfwalls" \}, true\)/.test(page) && /v\.halfWalls\.lesson\) return hwLesson|v\.halfWalls\.lesson;/.test(page));
  }
  {
    const o2 = JSON.parse(JSON.stringify(s)); delete o2.railMoved; o2.patio = {depth: 3, door: 2, rail: "picket", rails: {b1: "iron"}}; o2.owned = Object.assign({}, o2.owned, {rail: ["wood", "picket", "iron"]});
    const n2 = C.normal(o2), back = n2.hwalls.filter((w) => w.y === 0 && w.x >= 8).sort((a, c) => a.x - c.x).map((w) => w.style).join();
    ok("an old save's patio railings become half walls on its back, its railings half-wall styles of its own, once", back === "rail_picket,rail_iron,rail_picket" && n2.hwStyles.rail_picket && n2.hwStyles.rail_iron && n2.railMoved
       && C.normal(n2).hwalls.length === n2.hwalls.length);
  }
  {
    // (Cam, 8 Nov: "change the indoor half walls with different colors as i could with the old dividers")
    const b0 = A(s, "halfWall", {style: "halfwall", walls: [W(3, 3, 0), W(4, 3, 0)]}, t).state;
    const p1 = A(b0, "halfWallTint", {x: 3, y: 3, dir: 0, part: 1, h: 0, s: 0.12, b: 0.5, sw: "Charcoal"}, t), p2 = A(p1.state, "halfWallTint", {x: 3, y: 3, dir: 0, part: 2, h: 0, s: 1, b: 1, sw: "Natural"}, t);
    ok("one half wall painted on its own, free (its two parts each their own), the next one left as it was", p1.ok && p1.state.coins === b0.coins && p1.state.hwalls.find((w) => w.x === 3).tint.sw === "Charcoal"
       && !p1.state.hwalls.find((w) => w.x === 4).tint && p2.ok && !p2.state.hwalls.find((w) => w.x === 3).tint2);
    ok("  not in a paint that isn't yours, and not where there's no wall", /isn't yours yet/.test(A(b0, "halfWallTint", {x: 3, y: 3, dir: 0, h: 0, s: 0.36, b: 0.3, sw: "Ebony"}, t).error || "")
       && /no half wall/.test(A(b0, "halfWallTint", {x: 5, y: 5, dir: 0, sw: "Red", h: 340, s: 1.5, b: 0.9}, t).error || ""));
    const page = fs.readFileSync(path.join(APP, "ui", "cafe", "cafe.js"), "utf8");
    ok("  the page: right-click a half wall (in play or Build) for its swatches, like a thing's", /const hwEl = !holding && hwAt\(e\.clientX, e\.clientY\)/.test(page) && /swatchPop\("hw:" \+ hwEl\.dataset\.hw/.test(page)
       && /if \(it\.hw\) return act\("halfWallTint"/.test(page) && /data-hw="\$\{w\.x\},\$\{w\.y\},\$\{w\.dir\}"/.test(page));
  }
  ok("fake grass, a floor for inside (its own tile, mower stripes)", C.FLOOR.turf && C.FLOOR.turf.name === "Fake grass" && !C.FLOOR.turf.patio && fs.existsSync(path.join(APP, "ui", "cafe", "art", "floor-turf.webp"))
     && /"floor-turf":\[256,202\]/.test(fs.readFileSync(path.join(APP, "ui", "cafe", "art", "manifest.js"), "utf8")) && A(s, "floorPaint", {id: "turf", x: 2, y: 2}, t).ok);
  ok("Rosa's lesson the first time, then not again", C.view(s, t).halfWalls.lesson && !C.view(A(s, "lesson", {id: "halfwalls"}, t).state, t).halfWalls.lesson && !A(s, "lesson", {id: "nope"}, t).ok);
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
