/* Frostpeak as a full island -- islands stage 3 (2026-10-08, Cam chose "A full island": Foothills, the Ice Cavern, the
   Summit, the Yeti, day and night snow creatures). Run: node test/test_pet_frost.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petart.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore, A = ctx.window.PetArt || ctx.PetArt;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const NOON = new Date(2026, 9, 8, 12, 0).getTime(), NIGHT = new Date(2026, 9, 8, 23, 0).getTime();
const there = () => { const s = C.advance(C.empty(), NOON); s.player.made = true; s.player.island = "frostpeak"; return s; };

{
  const s = there();
  ok("Frostpeak Island: Frosthaven, the Foothills, the Ice Cavern and the Summit", ["frosthaven", "frostpeak", "icecavern", "summit"].every((k) => C.REGIONS[k] && C.REGIONS[k].isle === "frostpeak"));
  ok("  the Foothills are open once you're there; the Ice Cavern takes a lantern (Mining 40); the Summit the climbing kit (Defence 35)",
     C.regionLock(s, "frostpeak") === "" && /lantern/.test(C.regionLock(s, "icecavern")) && /climbing kit/.test(C.regionLock(s, "summit")));
  const ids = (at) => C.huntPool(C.HUNTS.frostpeak, at).map((m) => m[0]).sort().join();
  ok("the Foothills hunting ground (level 44): leopards and foxes always, goats and yaks by day, ice wolves and snowy owls at night",
     C.HUNTS.frostpeak.level === 44 && ids(NOON) === "arcticfox,mountaingoat,snowleopard,yak" && ids(NIGHT) === "arcticfox,icewolf,snowleopard,snowyowl");
  ok("  the moonlit egg (ice wolf, snowy owl) only from the night's creatures", Object.keys(C.MONSTERS).filter((m) => C.MONSTERS[m].drops.some((d) => d[0] === "moonlitegg")).every((m) => C.MONSTERS[m].night)
     && C.EGGS.moonlit.pool.map((p) => p[0]).sort().join() === "owl/snowy,wolf/ice");
  const lv = C.landView(s, "frostpeak", NOON);
  ok("  new places: an ice-fishing hole, snowberry bushes, the frozen tundra (and the old pines, vein and shrine)",
     ["icehole", "snowberrybushes", "frozentundra", "snowypines", "frostvein"].every((k) => lv.spots.some((x) => x.id === k)));
  ok("  the Ice Cavern: frost crystals and an underground lake", ["frostcrystals", "undergroundlake"].every((k) => C.SKILLS.mining.spots.concat(C.SKILLS.fishing.spots).some((x) => x.id === k && x.area === "icecavern")));
}
{
  let s = there(); s.hunt = {frostpeak: {kills: 600, wins: 0, losses: 0}};
  for (const k of ["attack", "strength", "defence", "hitpoints", "ranged", "magic"]) if (k in s.player.skills) s.player.skills[k] = C.XP[48];
  ok("the Yeti is earned in the Foothills but lives at the Summit: no climbing kit, no fight", /Summit/.test(C.act(s, "boss", {ground: "frostpeak", roll: 0.3}, NOON).error || ""));
  s.bag.climbinggear = 1; s.player.hp = 9999; s = C.advance(s, NOON);
  const r = C.act(s, "boss", {ground: "frostpeak", roll: 0.3}, NOON);
  ok("  with the kit and Defence 35, the Yeti comes out", r.ok, r.error);
  ok("  beating it 10 times lets a Yeti cub hatch from frost eggs", !C.odds("frostpeak", {}).some((o) => o.pet === "yeti/cub") && C.odds("frostpeak", {hunt: {frostpeak: {wins: 10}}}).some((o) => o.pet === "yeti/cub"));
  ok("  the Cairn Keeper at the Summit asks you to", C.PEOPLE.summit.quests[0].needs[0].boss === "frostpeak");
}
{
  ok("each new area hides an egg: a polar bear cub (Ice Cavern), a storm owl (Summit)", C.SECRETS.icecavern.some((x) => x.egg === "rimeegg") && C.SECRETS.summit.some((x) => x.egg === "stormegg")
     && C.EGGS.rime.pool[0][0] === "bear/polar" && C.EGGS.storm.pool[0][0] === "owl/storm");
  ok("furs for you and your pet (hood, yeti-fur coat, pet coat)", ["furhood", "furcoat", "petfurcoat"].every((k) => C.ITEMS[k].gear && C.WORKSHOPS.crafting.recipes.some((r) => r.make === k)));
  ok("the Petapedia marks Frostpeak's night pets", ["wolf/ice", "owl/snowy"].every((k) => C.dexView({dex: {}}).find((d) => d.kind === k).when === "night"));
  ok("every new creature, pet and thing has a picture", ["snowleopard", "arcticfox", "mountaingoat", "yak", "icewolf", "snowyowl", "yeti"].every((m) => A.monster(m))
     && ["leopard/snow", "fox/arctic", "goat/mountain", "yak/shaggy", "wolf/ice", "owl/snowy", "yeti/cub", "bear/polar", "owl/storm"].every((k) => { const [sp, c] = k.split("/"); return A.palette(sp, c); })
     && ["snowpelt", "yetifur", "frostcrystal", "arcticchar", "mammothivory", "moonlitegg", "rimeegg", "stormegg", "frostpeakegg"].every((k) => A.itemArt(k) && A.itemArt(k).rows));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
