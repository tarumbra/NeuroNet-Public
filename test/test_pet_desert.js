/* The night, the Desert and the Nile (2026-10-08, Cam: "some pets can only be obtained at night or day time. Owl would be
   night only and certain scorpions ... a dessert area ... the nile ... a extremely rare mummy pet ... hyraglyics ... at the
   ancient stacks ... a special locus pet called plauge ... egyptian clouthing"). Run: node test/test_pet_desert.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petart.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore, A = ctx.window.PetArt || ctx.PetArt;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const NOON = new Date(2026, 9, 8, 12, 0).getTime(), NIGHT = new Date(2026, 9, 8, 23, 0).getTime(), HOUR = 3600e3;

/* ---- day and night ---- */
{
  const hv = C.huntsView(C.advance(C.empty(), NOON)), forest = hv.find((g) => g.id === "forest"), desert = hv.find((g) => g.id === "desert");
  ok("the owl comes out in the Forest at night only (the hunting page says so)", forest.monsters.some((m) => m.id === "owl" && m.when === "night"));
  ok("  the Desert: vipers and camel spiders always; scorpions and camels by day; deathstalkers and jackals at night",
     ["viper", "camelspider"].every((k) => desert.monsters.find((m) => m.id === k).when === "")
     && ["sandscorpion", "camel"].every((k) => desert.monsters.find((m) => m.id === k).when === "day")
     && ["deathstalker", "jackal"].every((k) => desert.monsters.find((m) => m.id === k).when === "night"));
  const ids = (g, at) => C.huntPool(C.HUNTS[g], at).map((m) => m[0]).sort().join();
  ok("  the clock at each fight decides: the Forest at noon has no owl, at 11 pm it does; the Desert swaps its day and night creatures",
     !ids("forest", NOON).includes("owl") && ids("forest", NIGHT).includes("owl")
     && ids("desert", NOON) === "camel,camelspider,sandscorpion,viper" && ids("desert", NIGHT) === "camelspider,deathstalker,jackal,viper");
  ok("  owl eggs only drop from owls -- and owls only come out at night", C.MONSTERS.owl.drops.some((d) => d[0] === "owlegg") && C.MONSTERS.owl.night
     && Object.keys(C.MONSTERS).filter((m) => C.MONSTERS[m].drops.some((d) => d[0] === "owlegg")).join() === "owl");
  ok("  the dusk egg (deathstalker, golden jackal) only from the desert's night creatures",
     Object.keys(C.MONSTERS).filter((m) => C.MONSTERS[m].drops.some((d) => d[0] === "duskegg")).every((m) => C.MONSTERS[m].night));
  ok("  the Petapedia marks the night ones and the day ones", ["jackal/golden", "owl/barn", "scorpion/deathstalker"].every((k) => C.dexView({dex: {}}).find((d) => d.kind === k).when === "night")
     && C.dexView({dex: {}}).find((d) => d.kind === "camel/desert").when === "day");
}
/* ---- the Desert and the Nile ---- */
{
  let s = C.advance(C.empty(), NOON); s.player.made = true;
  const home = C.worldView(s, NOON).regions.find((r) => r.id === "desert");
  ok("the Desert and the Nile are on the Desert Island (2026-10-08: sail there)", /Desert Island/.test(home.lock) && C.REGIONS.desert.isle === "desert" && C.REGIONS.nile.isle === "desert");
  s.player.island = "desert";
  const wv = C.worldView(s, NOON), d = wv.regions.find((r) => r.id === "desert"), n = wv.regions.find((r) => r.id === "nile");
  ok("  there, the Desert (level 44) and the Nile (50) are closed until you've a desert kit", d && n && !d.open && !n.open && /desert kit/i.test(d.lock), d.lock);
  s.bag.desertkit = 1; s.player.skills.crafting = C.XP[40]; s.player.skills.fishing = C.XP[45];
  const w2 = C.worldView(s, NOON);
  ok("  a desert kit (Crafting 40) opens the Desert; with Fishing 45 the Nile too", w2.regions.find((r) => r.id === "desert").open && w2.regions.find((r) => r.id === "nile").open);
  ok("  each has a hunting ground and a boss: the Sphinx, the King of the Nile", C.HUNTS.desert.boss === "sphinx" && C.HUNTS.nile.boss === "kingnile");
  const lv = C.landView(s, "desert", NOON), ln = C.landView(s, "nile", NOON);
  const lo = C.landView(s, "oasis", NOON);   // (2026-10-09) the Oasis pool is at the Oasis, off the Desert
  ok("  places to gather in every skill there (and a person with two quests) -- the Desert and its Oasis", ["foraging", "fishing", "mining", "lumbering", "digging"].every((k) => lv.spots.concat(lo ? lo.spots : []).some((sp) => sp.skill === k))
     && lv.person && lv.person.total >= 6 && ln.person && ln.spots.length >= 5);
  ok("  each has its secrets: a cache with a glyph, and a hidden egg (a white camel, a pygmy hippo)",
     C.SECRETS.desert.some((x) => x.items && x.items.glyphankh) && C.SECRETS.nile.some((x) => x.items && x.items.glyphlocust)
     && C.EGGS.sunbaked.pool[0][0] === "camel/white" && C.EGGS.reedwoven.pool[0][0] === "hippo/pygmy");
  const fish = C.SKILLS.fishing.spots.filter((sp) => sp.rare && sp.rare[0] === "wrappedegg");
  ok("the Oasis pool and the Nile's depths: a papyrus net, and once in a long while a wrapped egg (the mummy)",
     fish.map((sp) => sp.id).sort().join() === "niledepths,oasis" && fish.every((sp) => sp.needs === "papyrusnet" && sp.rare[1] >= 2500) && C.EGGS.wrapped.pool[0][0] === "mummy/linen");
}
/* ---- the plague tablet ---- */
{
  let s = C.advance(C.empty(), NOON); s.player.made = true;
  const glyphs = ["glyphsun", "glyphserpent", "glyphscarab", "glyphreed", "glyphankh", "glyphlocust"];
  ok("six glyphs, each from somewhere in the desert or the river", glyphs.every((g) => C.ITEMS[g] && (
     Object.values(C.MONSTERS).some((m) => m.drops.some((d) => d[0] === g)) || Object.values(C.SECRETS).some((l) => l.some((x) => x.items && x.items[g]))
     || C.SKILLS.digging.spots.some((sp) => sp.rare && sp.rare[0] === g))));
  ok("  the tablet won't read without all six", /missing/.test(C.act(s, "decipher", {}, NOON).error || ""));
  glyphs.forEach((g) => { s.bag[g] = 1; });
  let r = C.act(s, "decipher", {}, NOON); s = r.state;
  ok("  with all six: twelve hours in the ancient stacks", r.ok && s.home.research.id === "plague" && glyphs.every((g) => !s.bag[g]));
  s = C.advance(s, NOON + 12 * HOUR + 1000);
  ok("  then a buzzing egg -- Plague, the locust", s.bag.plagueegg === 1 && C.EGGS.plague.pool[0][0] === "locust/plague" && C.PETS["locust/plague"].rarity === "Legendary");
}
/* ---- Egyptian clothes, the bosses' pets, the balance ---- */
{
  ok("Egyptian clothes for you (nemes, linen robe, khopesh, ankh ring) and your pet (nemes, collar of Bastet), made from the desert's things",
     ["nemes", "linenrobe", "khopesh", "ankhring"].every((k) => C.ITEMS[k].gear.who === "player") && ["petnemes", "bastetcollar"].every((k) => C.ITEMS[k].gear.who === "pet")
     && ["nemes", "linenrobe", "khopesh", "ankhring", "petnemes", "bastetcollar"].every((k) => Object.values(C.WORKSHOPS).some((w) => (w.recipes || []).some((r) => r.make === k))));
  ok("  the khopesh sits between the adamant and the rune sword", C.ITEMS.khopesh.gear.att > C.ITEMS.adamantsword.gear.att && C.ITEMS.khopesh.gear.att < C.ITEMS.runesword.gear.att);
  ok("beating the Sphinx 10 times lets a Sphynx cat hatch from desert eggs; the King of the Nile 15 times, his own kind",
     !C.odds("desert", {}).some((o) => o.pet === "cat/sphynx") && C.odds("desert", {hunt: {desert: {wins: 10}}}).some((o) => o.pet === "cat/sphynx")
     && C.odds("nile", {hunt: {nile: {wins: 15}}}).some((o) => o.pet === "alligator/king"));
  ok("  boss, night and hidden prizes don't come from breeding two ordinary ones", !C.SPECIES.cat.colours.includes("sphynx") && !C.SPECIES.scorpion.colours.includes("deathstalker")
     && !C.SPECIES.alligator.colours.includes("king"));
  ok("  gold still sits on the price ladder (the Sphinx drops nuggets, not ore)", C.priceOf("gold") > C.priceOf("silver") && C.priceOf("gold") < C.priceOf("mithril"));
  ok("every new creature, pet and thing has a picture", ["owl", "viper", "sandscorpion", "deathstalker", "camelspider", "camel", "jackal", "sphinx", "alligator", "hippo", "flamingo", "ibis", "cobra", "kingnile"]
     .every((m) => A.monster(m)) && Object.keys(C.PETS).every((k) => { const [sp, c] = k.split("/"); return A.palette(sp, c); })
     && Object.keys(C.ITEMS).every((k) => A.itemArt(k) && A.itemArt(k).rows));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
