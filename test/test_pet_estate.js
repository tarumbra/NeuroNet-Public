/* Island estates -- islands stage 4 (2026-10-08, Cam: "an estate the player can purchase there and slowly build up by
   providing materials and coins for the different areas ... the player can select to stay there for a while and grind out
   the area ... A home away from home"). Run: node test/test_pet_estate.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T = Date.UTC(2026, 9, 8, 2), HOUR = 3600e3;
function onIsland(isle) { const s = C.advance(C.empty(), T); s.player.made = true; s.player.island = isle; s.coins = 200000; s.player.skills.construction = C.XP[40];
  Object.assign(s.bag, {plank: 200, hardplank: 200, fineplank: 200, sandstone: 300, pine: 300, lapis: 50, frostcrystal: 50, rope: 100, berry: 5, rawshrimp: 3, twigs: 3}); return s; }

{
  let s = onIsland("desert"); s.player.island = "";
  ok("estates are on the islands", /islands/.test(C.act(s, "estatebuy", {}, T).error || ""));
  s = onIsland("desert");
  ok("  nothing to build before you buy the plot (Desert Island 25,000; Frostpeak 20,000)", /Buy the plot/.test(C.act(s, "estatebuild", {part: "house"}, T).error || "")
     && C.ESTATE_ISLE.desert.price === 25000 && C.ESTATE_ISLE.frostpeak.price === 20000);
  let r = C.act(s, "estatebuy", {}, T); s = r.state;
  ok("  buying it: the coins, and a plot of six parts, none built", r.ok && s.coins === 175000 && C.estateView(s, T).parts.length === 6 && C.estateView(s, T).stage === 0);
  ok("  away, the home benches wait -- until the estate has a workshop", /back home/.test(C.act(s, "craft", {workshop: "kitchen", make: "shrimps"}, T).error || ""));
  for (const p of C.ESTATE_PARTS) { r = C.act(s, "estatebuild", {part: p}, T); s = r.state; }
  ok("  each part built: Construction xp, and with all six the estate is Basic", C.estateView(s, T).stage === 1 && C.estateView(s, T).stageName === "Basic");
  s.player.skills.cooking = C.XP[5];
  r = C.act(s, "craft", {workshop: "kitchen", make: "shrimps"}, T);
  ok("the workshop's benches work on the island (a basic one: the kitchen and the crafting bench)", r.ok && /furnace/.test(C.act(r.state, "craft", {workshop: "furnace", make: "bronzebar"}, T).error || ""), r.error);
  s = r.state;
  r = C.act(s, "store", {item: "berry", n: "all"}, T); s = r.state;
  ok("the storeroom's chests stay on the island (not home's)", r.ok && s.estates.desert.store.berry === 5 && !(s.storage && s.storage.berry));
  s.player.island = ""; s = C.advance(s, T + 1000);
  ok("  at home, home's chests", C.houseView(s, T).storage.items.every((x) => x.id !== "berry"));
  s.player.island = "desert"; s = C.advance(s, T + 2000);
  ok("the house and the cistern make resting faster on the island", s.player.restBonus > 0);
  r = C.act(s, "estategarden", {}, T + 3000); s = r.state;
  ok("the garden gives the island's produce every 12 hours", r.ok && s.bag.dates === 3 && /back in/.test(C.act(s, "estategarden", {}, T + 4 * HOUR).error || "")
     && C.act(s, "estategarden", {}, T + 13 * HOUR).ok);
  const t4 = C.estateCost("desert", "house", 4);
  ok("a grand part costs like a grand room at home (Construction 40, fine planks, the island's stone)", t4.con === 40 && t4.items.fineplank === 25 && t4.items.sandstone === 40);
  const f = onIsland("frostpeak"); const fb = C.act(f, "estatebuy", {}, T);
  ok("Frostpeak's estate has a hot spring and builds with pine", fb.ok && C.estateView(fb.state, T).parts[5].name === "Hot spring" && C.estateCost("frostpeak", "house", 1).items.pine === 10);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
