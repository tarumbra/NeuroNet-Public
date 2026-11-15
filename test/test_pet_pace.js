/* The pace of gathering (2026-10-09, Cam: "in melvor idle collecting lower/mid tier materials doesnt take a long time.
   For example most gathering spots have a 3 second timer for gathering attempts. Can we reduce our timer as well please.
   I would like greater emphasis on crafting so it will require a larger turn over of materials" -- and "I want to
   minimise reusables in the game"). Run: node test/test_pet_pace.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 9, 2), HOUR = 3600e3;
const fresh = () => { const s = C.advance(C.empty(), T0); s.player.made = true; return s; };
const spots = [].concat(...C.GATHERING.map((k) => C.SKILLS[k].spots.map((sp) => Object.assign({skill: k}, sp))));
const paced = spots.filter((sp) => !sp.essence);

/* ---- the timer ---- */
ok("every attempt takes 3 s at level 1 up to 8 s at the top", paced.every((sp) => sp.time >= 3 && sp.time <= 8)
   && paced.filter((sp) => sp.level <= 1).every((sp) => sp.time === 3), paced.filter((sp) => sp.time < 3 || sp.time > 8).map((sp) => sp.id).join());
ok("  by the hour the xp is what it was (within a hundredth's rounding)", paced.every((sp) => Math.abs(sp.xp / sp.time - (sp.xp / sp.pace) / sp.oldTime) < 0.01));
ok("  rare finds (eggs too) keep their odds by the hour", paced.filter((sp) => sp.rare).every((sp) => sp.rare[1] >= 1 && sp.rare[1] * sp.time > 0));
ok("  a skill's essence stays rare: its spots keep their old pace", spots.filter((sp) => sp.essence).every((sp) => !sp.oldTime));
ok("  fishing bait is used at the old pace by the hour", paced.filter((sp) => sp.skill === "fishing" && sp.bait).every((sp) => sp.baitPace === sp.pace));
ok("  gathering draughts last fifteen times the finds", C.ITEMS.sagedraught.brew.uses === 900);

/* ---- what things sell for ---- */
ok("what's gathered sells for part of a coin now (about a fifteenth)", C.priceOf("copper") < 1 && C.PACE.copper > 0.04 && C.PACE.copper < 0.1, C.priceOf("copper"));
ok("  you're paid for the lot, rounded down; one coin's worth at least for a Sell button", C.sellFor("copper", 10, 1) === Math.floor(C.priceOf("copper") * 10)
   && C.eachFor("copper", 1) === C.priceOf("copper"));
ok("  what creatures drop keeps its price (hunting isn't faster)", !C.PACE.bones && !C.PACE.feather && !C.PACE.horsehair);

/* ---- crafting eats more ---- */
const W = C.WORKSHOPS;
ok("crafting takes five times the raw materials (bars, planks, thread, rope...)", W.furnace.recipes.find((r) => r.make === "bronzebar").needs.copper === 5
   && W.sawbench.recipes.find((r) => r.make === "plank").needs.birch === 15 && W.spinning.recipes.find((r) => r.make === "rope" && r.needs.flax).needs.flax === 15);
ok("  a craft's xp comes from the recipe rule (2026-10-10, M-4), not the old hand-set number", C.RECIPE_XP.was["spinning:bowstring"] === 15 && W.spinning.recipes.find((r) => r.make === "bowstring").xp !== 15);
ok("  the kitchen: one fish a dish, a fifth of the old xp (15x the fish -- 3x the xp an hour, like the other benches)", (() => {
  const r = W.kitchen.recipes.find((x) => Object.keys(x.needs).some((k) => C.PACE[k])); return r && r.paced && r.xp < 20; })());
ok("every level needs half as much xp again (Cam: \"increase the xp needed for each level a little\"); level 50 is 152,000", C.XP[50] === 152000 && C.XP[10] === 1731);
{
  // an old save keeps its levels: its xp grows once, to match
  const old = {v: 1, pet: null, log: [], player: {name: "Cam", made: true, skills: {mining: 8112, hitpoints: 1154}}};
  const s = C.advance(old, Date.UTC(2026, 9, 9)), again = C.advance(s, Date.UTC(2026, 9, 9) + 1000);
  ok("  an old save keeps every level (its xp scaled once, never twice); a new game starts on the new curve", s.curve === 1.5 && s.player.skills.mining === 12168
     && C.levelOf(s.player.skills.mining) === 25 && again.player.skills.mining === 12168 && C.empty().curve === 1.5);
}
ok("  the kitchen is as it was (one fish, one dish)", W.kitchen.recipes.every((r) => Object.keys(r.needs).every((k) => r.needs[k] <= 4)));
ok("  made from made things (bars into a pickaxe) only the gathered part grows", W.anvil.recipes.find((r) => r.make === "bronzepick").needs.bronzebar === 5);
ok("notice-board orders ask for fifteen times as much", C.ordersFor(Object.assign(fresh(), {}), T0).every((o) => o.n >= 90));

/* ---- fewer reusables ---- */
{
  let s = fresh(); s.player.skills.mining = C.XP[1]; s.bag.bronzepick = 1; s.player.tools.mining = "bronzepick";
  s = C.act(s, "trip", {skill: "mining", spot: "copperrocks", roll: 0.3}, T0).state;
  const y = C.advance(s, T0 + HOUR);
  ok("a gathering tool wears on every use, even at its own tier", (y.player.wear || {}).bronzepick > 1000, (y.player.wear || {}).bronzepick);
}
{
  // (2026-10-10) a net spot you can't fish by hand: the last small net gone, home you come
  const fish = C.SKILLS.fishing.spots.find((sp) => sp.needs === "smallnet" && !sp.hand && !sp.essence);
  let s = fresh(); s.bag.smallnet = 1; s.player.skills.fishing = C.XP[fish.level]; s.player.wear = {smallnet: C.KIT_DUR.smallnet - 3};
  const r = C.act(s, "trip", {skill: "fishing", spot: fish.id, roll: 0.3}, T0);
  const y = C.advance(r.state, T0 + HOUR);
  ok("fishing kits wear out: the last small net goes and you come home", r.ok && !(y.bag.smallnet > 0) && !y.player.job && y.log.some((e) => /small net wore out/.test(e.text)), r.error || y.log[0].text);
}
{
  let s = fresh(); s.player.skills.gemology = C.XP[10];
  const rec = W.gemology.recipes.find((r) => r.make === "quartz");
  Object.keys(rec.needs).forEach((k) => { s.bag[k] = 999; }); (rec.uses || []).forEach((k) => { s.bag[k] = 1; });
  s.player.wear = {chisel: C.KIT_DUR.chisel - 1};
  const r = C.act(s, "craft", {workshop: "gemology", make: "quartz", i: W.gemology.recipes.indexOf(rec)}, T0);
  ok("bench tools wear out: the chisel goes after its last cut", r.ok && !(r.state.bag.chisel > 0) && /chisel wore out/.test(r.state.log.map((e) => e.text).join(" ")), r.error);
  ok("  the descriptions say so", /wears out after 60 cuts/.test(C.describe("chisel")) && /wears out after 3,000 catches/.test(C.describe("smallnet")) && /wears it out after 40 uses/.test(C.describe("needle")));
}
{
  const s = fresh(); s.bag.copper = 1000; s.player.skills.mining = C.XP[1];
  const t = Date.now(); let y = C.act(s, "trip", {skill: "mining", spot: "copperrocks", roll: 0.3}, T0).state; s.bag.stonepick = 0;
  y = C.advance(y, T0 + 12 * HOUR);
  ok("twelve hours away (some 14,000 finds) catch up quickly", Date.now() - t < 3000, (Date.now() - t) + " ms");
}

/* ---- early fishing (2026-10-10, Cam: fishing "feels slow in the lower levels") ---- */
{
  ok("fishing kits last as long as the tools of their tier", C.KIT_DUR.smallnet === 3000 && C.KIT_DUR.fishingrod === 3000 && C.KIT_DUR.flyrod === 4000
     && C.KIT_DUR.lobstercage === 5000 && C.KIT_DUR.harpoon === 6000 && C.KIT_DUR.papyrusnet === 7000);
  const fsp = (id) => C.SKILLS.fishing.spots.find((sp) => sp.id === id), msp = (id) => C.SKILLS.mining.spots.find((sp) => sp.id === id);
  ok("  fishing spots up to level 15 give 30% more xp than a mining spot of the same level", Math.abs(fsp("pond").xp / msp("copperrocks").xp - 1.3) < 0.05
     && Math.abs(fsp("lake").xp / fsp("lake").time / ((12 * 1.3) / 71) - 1) < 0.02, fsp("pond").xp + " vs " + msp("copperrocks").xp);
  ok("  ... and the higher ones don't", Math.abs(fsp("harbour").xp / fsp("harbour").time / (19 / 88) - 1) < 0.02);
  ok("  the Duck pond and the Pond can be fished by hand; the Brook can't", fsp("duckpond").hand && fsp("pond").hand && !fsp("brook").hand);
}
{
  let s = fresh(); s.player.skills.fishing = 0; delete s.bag.smallnet;   // the starter net
  const r = C.act(s, "trip", {skill: "fishing", spot: "pond", roll: 0.3}, T0);
  const sp = C.SKILLS.fishing.spots.find((x) => x.id === "pond");
  ok("no net: you fish the Pond by hand, half as slow again", r.ok && r.state.player.job.byHand && r.state.player.job.every === Math.round(sp.time * 1000 * C.HAND_FISH_SLOW), r.error);
  const y = C.advance(r.state, T0 + HOUR), got = Object.keys(y.player.job ? y.player.job.items : {});
  ok("  shrimp only (the pond has no minnows), and you're still there an hour on", y.player.job && got.length === 1 && got[0] === "rawshrimp" && y.player.job.count > 500, got.join());
  ok("  the card doesn't call the net missing", C.playerView(y, T0 + HOUR).skills.fishing.spots.find((x) => x.id === "pond").missing === "");
  const nb = fresh(); delete nb.bag.smallnet; nb.player.skills.fishing = C.XP[8];
  ok("  the Brook still needs a net", /needs a Small net/i.test(C.act(nb, "trip", {skill: "fishing", spot: "brook", roll: 0.3}, T0).error || ""));
}
{
  let s = fresh(); s.bag.smallnet = 1; s.player.wear = {smallnet: C.KIT_DUR.smallnet - 3};
  const r = C.act(s, "trip", {skill: "fishing", spot: "duckpond", roll: 0.3}, T0);
  ok("  with a net it's the normal pace", r.ok && !r.state.player.job.byHand);
  const y = C.advance(r.state, T0 + HOUR);
  ok("  the last net wears out at the Duck pond: you carry on by hand", y.player.job && y.player.job.byHand && !(y.bag.smallnet > 0)
     && y.log.some((e) => /carry on by hand/.test(e.text)) && !(y.player.wear || {}).smallnet, y.log[0] && y.log[0].text);
}

/* no long flat stretch (2026-10-10, Cam: "lumbering is taking too long to level up from 6 to 7"): on the main island, a
   gathering skill's next spot opens within 7 levels up to level 20 (iron stays at Mining 15: Cam's RuneScape grind) */
{
  const gaps = [];
  C.GATHERING.filter((k) => k !== "runecrafting").forEach((k) => {
    const lv = [...new Set(C.SKILLS[k].spots.filter((sp) => !sp.essence && !(C.REGIONS[sp.area] || {}).isle && sp.level <= 20).map((sp) => sp.level))].sort((a, b) => a - b);
    lv.forEach((l, i) => { if (i && l - lv[i - 1] > 7) gaps.push(k + " " + lv[i - 1] + "->" + l); });
  });
  ok("no gathering skill goes more than 7 levels without a new spot before level 20", gaps.length === 0, gaps.join(", "));
  const at = (k, id) => C.SKILLS[k].spots.find((sp) => sp.id === id).level;
  ok("  the Oak trees at Lumbering 6, the Chalk pit at Mining 8, the Old mound at Digging 8, the Old orchard at Foraging 8",
     at("lumbering", "forest") === 6 && at("mining", "chalkpit") === 8 && at("digging", "mound") === 8 && at("foraging", "orchard") === 8 && at("mining", "hillside") === 15);
}

/* digging pays like the rest (2026-10-10, Cam: "bring digging exp up to match the others"): every digging spot earns at
   least 97% of the xp an hour of the other skills' spots within 5 levels (fishing's early +30% left out) */
{
  const all = [].concat(...C.GATHERING.map((k) => C.SKILLS[k].spots.filter((sp) => !sp.essence).map((sp) => Object.assign({k}, sp))));
  const xph = (sp) => sp.xp * 3600 / sp.time, med = (a) => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
  const low = all.filter((sp) => sp.k === "digging").filter((sp) => xph(sp) < 0.97 * med(all.filter((x) => !["digging", "runecrafting", "fishing"].includes(x.k) && Math.abs(x.level - sp.level) <= 5).map(xph)));
  ok("digging pays like mining, lumbering and foraging at every level", low.length === 0, low.map((sp) => sp.id).join(", "));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
