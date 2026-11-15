/* Recipe xp from one rule (2026-10-10, audit M-4 / MATH-6): a craft's xp is the hours its materials take to gather, times
   the gathering xp an hour earns at the recipe's level. Run: node test/test_pet_recipe_xp.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const load = () => { const ctx = {window: {}, console}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx); return ctx.window.PetCore || ctx.PetCore; };
const C = load(), R = C.RECIPE_XP, W = C.WORKSHOPS;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const rec = (w, m) => W[w].recipes.find((r) => r.make === m);
const spots = [].concat(...C.GATHERING.map((k) => C.SKILLS[k].spots.filter((sp) => !sp.essence).map((sp) => Object.assign({k}, sp))));
const near = (lv) => { const a = spots.filter((x) => x.k !== "runecrafting" && Math.abs((x.level || 1) - lv) <= 5).map((x) => x.xp * 3600 / x.time).sort((p, q) => p - q); return a[a.length >> 1]; };

const ruled = Object.keys(R.was);
ok("every recipe that gives xp takes it from the rule (none kept by hand)", ruled.length > 400 && R.kept.length === 0, R.kept.join(", "));
ok("  the same numbers every time the rules load", JSON.stringify(load().RECIPE_XP.was) === JSON.stringify(R.was)
   && ruled.every((k) => { const [w, m] = k.split(":"); return rec(w, m).xp === load().WORKSHOPS[w].recipes.find((r) => r.make === m).xp; }));
const off = [];
ruled.forEach((k) => {
  const [w, m] = k.split(":"), r = rec(w, m);
  let h = 0; for (const n in r.needs) h += C.recipeEffort(n) * r.needs[n];
  const want = Math.max(0.1, Math.round(R.rate * near(r.level || 1) * Math.min(R.cap, h) * 10) / 10);
  if (Math.abs(want - r.xp) > 0.05) off.push(k + " " + r.xp + " vs " + want);
});
ok("each craft is its materials' gathering hours x the xp an hour at its level", off.length === 0, off.slice(0, 5).join("; "));
ok("a bronze bar: five copper and five tin's hours, at level 1", Math.abs(rec("furnace", "bronzebar").xp - near(1) * (C.recipeEffort("copper") * 5 + C.recipeEffort("tin") * 5)) < 0.06);
ok("made things carry what went into them (a bronze sword counts its bars' ore)", C.recipeEffort("bronzebar") > C.recipeEffort("copper") * 5);
ok("by-products count a half: a cow hide from hunting is worth less than its gathering time", R.byproduct === 0.5 && C.recipeEffort("cowhide") > 0);
ok("no craft is worth more than a quarter hour of gathering at its level (the trophy armours)",
   ruled.every((k) => { const [w, m] = k.split(":"), r = rec(w, m); return r.xp <= near(r.level || 1) * R.cap + 0.1; }));
const spread = Object.keys(W).filter((w) => !W[w].npc && W[w].skill).map((w) => {
  const a = (W[w].recipes || []).filter((r) => R.was[w + ":" + r.make] != null && r.level <= 10 && Object.keys(r.needs).every((n) => C.recipeEffort(n) != null))
    .map((r) => { let h = 0; for (const n in r.needs) h += C.recipeEffort(n) * r.needs[n]; return h < R.cap ? r.xp / h / near(r.level || 1) : null; }).filter((x) => x);
  return a.length ? [w, Math.min(...a), Math.max(...a)] : null; }).filter((x) => x);
ok("every bench pays the same for an hour's gathering (it was 0.2x to 4x)", spread.every(([, lo, hi]) => lo > 0.85 && hi < 1.15), JSON.stringify(spread.filter(([, lo, hi]) => lo <= 0.85 || hi >= 1.15)));
ok("the old hand-set numbers are kept for the record", R.was["spinning:bowstring"] === 15 && R.was["furnace:bronzebar"] === 6);
ok("deeper recipes pay more: a rune platebody beats a bronze one", rec("anvil", "runeplate").xp > rec("anvil", "bronzeplate").xp * 5);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
