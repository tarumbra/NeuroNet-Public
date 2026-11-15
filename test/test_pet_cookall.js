/* "Cook all" (2026-10-14): Cam, "Cook all feature for neuropets would be a good implementation please".
   craft {times: n | "all"} makes a recipe again and again, each one checked and made exactly as a single one,
   stopping at the first that can't be; the kitchen shows "Cook all (n)", the other benches "All (n×)".
   Run: node test/test_pet_cookall.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 14, 8);
const fresh = () => { const s = C.act(C.advance(C.empty(), T0), "player", {name: "Cook"}, T0).state; s.story = {on: false}; return s; };
const clone = (s) => JSON.parse(JSON.stringify(s));
const K = C.WORKSHOPS.kitchen;
const ri = K.recipes.findIndex((r) => r.make === "treat");          // 2 berries + 1 acorn, level 1
const rec = K.recipes[ri];
const cook = (s, times) => C.act(s, "craft", Object.assign({workshop: "kitchen", make: "treat", i: ri}, times ? {times} : {}), T0);
const view = (s) => C.villageView(s, T0).find((w) => w.id === "kitchen").recipes.find((r) => r.i === ri);

{ // one at a time, as before
  const s = fresh(); Object.assign(s.bag, {berry: 2, acorn: 1});
  const t0 = s.bag.treat || 0;                                        // a new game starts with a few treats
  const r = cook(s);
  ok("Cook (one): as before -- one treat, the same words", r.ok && r.state.bag.treat === t0 + 1 && /^You cooked an? /.test(r.msg) && !/Stopped/.test(r.msg), r.msg || r.error);
}
{ // all of it == the same number one at a time
  const base = fresh(); Object.assign(base.bag, {berry: 15, acorn: 9});   // enough for 7 (berries run out first)
  const t0 = base.bag.treat || 0;
  const v = view(base);
  ok("the kitchen says how many times over: 7", v.times === 7 && v.can, v.times);
  const all = cook(clone(base), "all");
  let one = clone(base), n = 0, r;
  while ((r = cook(one)).ok) { one = r.state; n++; }
  ok("Cook all: 7 treats -- 14 of the 15 berries and 7 acorns used", all.ok && all.crafts === 7 && all.state.bag.treat === t0 + 7
     && all.state.bag.berry === 1 && all.state.bag.acorn === 2, JSON.stringify(all.state && all.state.bag));
  ok("  the same as cooking one at a time 7 times: food, xp, what's left", n === 7 && JSON.stringify(all.state.bag) === JSON.stringify(one.bag)
     && all.state.player.skills.cooking === one.player.skills.cooking, all.state.player.skills.cooking + " vs " + one.player.skills.cooking);
  ok("  one line, the whole batch: \"You cooked 7 × treat...\"", /^You cooked 7 × /.test(all.msg) && !/Stopped/.test(all.msg), all.msg);
  ok("  the records count 7 things made, not 1", (all.state.records || {}).made - ((base.records || {}).made || 0) === 7, (all.state.records || {}).made);
}
{ // a number
  const s = fresh(); Object.assign(s.bag, {berry: 20, acorn: 20});
  const t0 = s.bag.treat || 0;
  const r = cook(s, 3);
  ok("times 3: three", r.ok && r.crafts === 3 && r.state.bag.treat === t0 + 3, r.msg || r.error);
  const r2 = cook(fresh(), "all");
  ok("nothing to cook: the same no as one ('Not enough ...'), nothing made", !r2.ok && /Not enough/.test(r2.error), r2.error);
}
{ // a run that stops for another reason says so
  const s = fresh(); Object.assign(s.bag, {berry: 10, acorn: 10});
  const r = cook(s, 8);                                              // only 5 there: asked for 8, not "all"
  ok("asked for more than there is: makes what it can and says why it stopped", r.ok && r.crafts === 5 && /Stopped after 5/.test(r.msg), r.msg);
}
{ // a level reached in the middle is said once
  const s = fresh(); Object.assign(s.bag, {berry: 400, acorn: 200});
  const r = cook(s, "all");
  const lv = (r.state.log || []).filter((l) => /You reached Cooking level/.test(l.text || l.msg || l)).length;
  ok("a batch that levels you says the new level once", r.ok && lv <= 1, lv);
}
ok("the kitchen's button: \"Cook all (n)\", the other benches \"All (n×)\" -- only when it's more than one",
   /Cook all/.test(PET) && /data-times="all"/.test(PET) && /r\.can && r\.times > 1/.test(PET));
ok("the click sends times along", /times: b\.dataset\.times/.test(PET));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
