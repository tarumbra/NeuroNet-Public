/* Ships, the Shipyard and the islands -- stage 1 (2026-10-08, Cam: "split frostpeak mountains and desert from the initial
   island ... gotten to by ship (unlock a shipyard) ... starts off as a simple row boat, then tiers up slowly ... ship building
   should be apart of the construction skill ... only from the shipyard at the coast area next to the harbour ... a new NPC who
   handles the ship yard"). Run: node test/test_pet_ships.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petart.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore, A = ctx.window.PetArt || ctx.PetArt;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 8, 2), HOUR = 3600e3, MIN = 60e3;
const fresh = () => { const s = C.advance(C.empty(), T0); s.player.made = true; return s; };

/* ---- the first ship ---- */
{
  let s = fresh();
  ok("four ships: a rowboat, a sailboat (Construction 25), a caravel (40), a galleon (50, the top)", C.SHIPS.map((x) => x.name).slice(1).join() === "Rowboat,Sailboat,Caravel,Galleon"
     && [2, 3, 4].map((t) => C.SHIPS[t].con).join() === "25,40,50");
  ok("  no ship to start; the Shipyard waits for Old Salt's boat", s.ship.tier === 0 && /Old Salt/.test(C.act(s, "shipbuild", {part: "hull"}, T0).error || ""));
  s.bag.boat = 1; s = C.advance(s, T0);
  ok("  Old Salt's rowing boat is your first ship (an old save's boat too)", s.ship.tier === 1 && !s.bag.boat);
  ok("  the Misty Isle needs it (with Fishing 35)", C.REGIONS.mistyisle.needs.ship === 1 && !/rowboat/.test(C.worldView(s, T0).regions.find((r) => r.id === "mistyisle").lock));
}
/* ---- building at the Shipyard ---- */
{
  let s = fresh(); s.ship = {tier: 1, parts: {}}; s.coins = 100000; s.player.skills.construction = C.XP[24];
  Object.assign(s.bag, {hardplank: 40, ironbar: 20, maple: 10, sailcloth: 12, rope: 30});
  ok("a sailboat needs Construction 25", /Construction 25/.test(C.act(s, "shipbuild", {part: "hull"}, T0).error || ""));
  s.player.skills.construction = C.XP[25];
  const con0 = s.player.skills.construction;
  let r = C.act(s, "shipbuild", {part: "hull"}, T0); s = r.state;
  ok("  in four parts, one at a time, each taking hours", r.ok && /busy/.test(C.act(s, "shipbuild", {part: "mast"}, T0).error || "") && s.ship.building.until === T0 + 3 * HOUR);
  let t = T0;
  for (const p of ["mast", "sails", "rigging"]) { t += 4 * HOUR; s = C.advance(s, t); r = C.act(s, "shipbuild", {part: p}, t); s = r.state; }
  t += 4 * HOUR; s = C.advance(s, t);
  ok("  all four done: a sailboat, and Construction xp for each part", s.ship.tier === 2 && s.player.skills.construction >= con0 + 1150, s.player.skills.construction - con0);
  {
    let e = C.advance(C.empty(), T0); e.player.made = true; e = C.act(e, "hatch", {egg: "starter", roll: 0.3}, T0).state;
    e = C.advance(e, T0 + 9 * 864e5); e.pet.xp = C.XP[20]; e.pet.sick = false;
    const ocean = (st) => [].concat(C.expeditionsView(st, T0 + 9 * 864e5).areas || C.expeditionsView(st, T0 + 9 * 864e5)).find((a) => a.id === "ocean").open;
    const before = ocean(e); e.ship.tier = 2;
    ok("  ocean expeditions open with the sailboat (not before)", !before && ocean(e));
  }
  ok("ships are built at the Shipyard by Shipwright Hal, who has quests", C.PEOPLE.shipyard.name === "Shipwright Hal" && C.PEOPLE.shipyard.quests.length >= 2);
  ok("  rope, sailcloth and pitch are made at your benches", ["rope", "sailcloth", "pitch"].every((k) => Object.values(C.WORKSHOPS).some((w) => (w.recipes || []).some((x) => x.make === k))));
}
/* ---- voyages and islands ---- */
{
  let s = fresh(); s.ship = {tier: 2, parts: {}};
  ok("the islands are too far for a sailboat (they take a caravel)", /caravel/.test(C.act(s, "sail", {to: "desert"}, T0).error || ""));
  ok("  from home, the Desert, the Nile, Sandport and Frostpeak say they're on their islands",
     ["desert", "nile", "sandport", "frostpeak", "frosthaven"].every((k) => /^On /.test(C.worldView(s, T0).regions.find((r) => r.id === k).lock)));
  s.ship.tier = 3;
  let r = C.act(s, "sail", {to: "desert"}, T0); s = r.state;
  ok("  a caravel sails there: fifteen minutes at sea", r.ok && s.player.voyage.until === T0 + 15 * MIN);
  ok("  at sea you can't gather, hunt, make or shop", ["trip", "hunt", "craft", "sell"].every((a) => /at sea/.test(C.act(s, a, {skill: "foraging", spot: "hedgerow", ground: "farmyard", workshop: "kitchen", make: "shrimps", item: "berry"}, T0 + MIN).error || "")));
  s = C.advance(s, T0 + 16 * MIN);
  ok("  then you land at Sandport and stay", s.player.island === "desert" && !s.player.voyage && /Sandport/.test(s.log[0].text));
  ok("  the main island's places, benches and shops wait at home", /main island/.test(C.act(s, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.3}, T0 + 17 * MIN).error || "")
     && /back home/.test(C.act(s, "craft", {workshop: "kitchen", make: "shrimps"}, T0 + 17 * MIN).error || "") && /main island/.test(C.act(s, "hunt", {ground: "farmyard", roll: 0.3}, T0 + 17 * MIN).error || ""));
  s.bag.desertkit = 1; s.player.skills.crafting = C.XP[40]; s.player.skills.foraging = C.XP[48];
  r = C.act(s, "trip", {skill: "foraging", spot: "datepalms", roll: 0.3}, T0 + 17 * MIN);
  ok("  the island's places are yours (the Desert still wants its kit)", r.ok, r.error);
  ok("  you can't sail while you're out gathering", /come back first/.test(C.act(r.state, "sail", {to: "home"}, T0 + 18 * MIN).error || ""));
  s = C.act(r.state, "home", {}, T0 + 18 * MIN).state;
  s = C.act(s, "sail", {to: "home"}, T0 + 18 * MIN).state;
  s = C.advance(s, T0 + 40 * MIN);
  ok("  sailing home brings you back to the Shipyard", s.player.island === "" && /Home again/.test(s.log[0].text));
  ok("each island has a town with its dock and a harbourmaster with quests", ["sandport", "frosthaven"].every((k) => C.REGIONS[k].town && C.PEOPLE[k] && C.PEOPLE[k].quests.length >= 2)
     && C.ISLANDS.desert.town === "sandport" && C.ISLANDS.frostpeak.town === "frosthaven");
  ok("the new things have pictures", ["rope", "sailcloth", "pitch", "boat"].every((k) => A.itemArt(k) && A.itemArt(k).rows));
}

/* ---- the Open Sea: stage 2 (2026-10-08, Cam: "certain fishing (add stingrangs, sharks, killer whale, whale"; "Catches + rare sea pets") ---- */
{
  let s = fresh(); s.player.skills.fishing = C.XP[60]; s.bag.harpoon = 1; s.ship = {tier: 1, parts: {}};
  ok("the Open Sea takes a sailboat", /sailboat/.test(C.regionLock(s, "opensea")) && C.REGIONS.opensea.sea);
  s.ship.tier = 2;
  const spots = () => C.landView(s, "opensea", T0).spots;
  ok("  stingrays and sharks from a sailboat; orcas need a caravel, whales a galleon",
     spots().filter((x) => !x.lock).map((x) => x.id).join() === "stingrayshoals,sharkwaters"
     && /caravel/.test(spots().find((x) => x.id === "orcawaters").lock) && /galleon/.test(spots().find((x) => x.id === "whaleroad").lock));
  ok("  and the trip checks it too", /galleon/.test(C.act(s, "trip", {skill: "fishing", spot: "whaleroad", roll: 0.3}, T0).error || "") && C.act(s, "trip", {skill: "fishing", spot: "stingrayshoals", roll: 0.3}, T0).ok);
  const fish = C.SKILLS.fishing.spots.filter((x) => x.area === "opensea" && !x.essence);
  ok("rare catches are eggs: a baby stingray, an orca calf, a whale calf", ["shoalegg", "orcaegg", "whaleegg"].every((e) => fish.some((x) => x.rare && x.rare[0] === e))
     && C.EGGS.orca.pool[0][0] === "orca/calf" && C.EGGS.whale.pool[0][0] === "whale/calf" && C.EGGS.shoal.pool[0][0] === "stingray/sea");
  ok("  and a white whale hides out there (a secret)", C.SECRETS.opensea.some((x) => x.egg === "pearlescentegg") && C.EGGS.pearlescent.pool[0][0] === "whale/white");
  ok("sharks and stingrays cook into strong food; blubber boils into pitch for the next ship",
     ["grilledstingray", "hammerheadsteak", "greatwhitesteak"].every((k) => C.ITEMS[k].heal >= 20 && C.WORKSHOPS.kitchen.recipes.some((r) => r.make === k))
     && C.WORKSHOPS.crafting.recipes.some((r) => r.make === "pitch" && r.needs.whaleblubber));
  ok("Hal has ocean quests; an old mariner lives out there", C.PEOPLE.shipyard.quests.some((q) => q.needs.some((n) => n.bring && n.bring.rawhammerhead))
     && C.PEOPLE.opensea && C.PEOPLE.opensea.quests.length >= 6);
  ok("  the sea's new things and pets have pictures", ["rawstingray", "orcablubber", "ambergris", "shoalegg", "whaleegg"].every((k) => A.itemArt(k) && A.itemArt(k).rows)
     && ["stingray/sea", "orca/calf", "whale/calf", "whale/white"].every((k) => { const [sp, c] = k.split("/"); return A.palette(sp, c); }));
}

/* ---- nothing above the level cap (2026-10-08: the Desert's first spots were set at 52-56, past 50 -- they could never open) ---- */
{
  const cap = C.MAX_LEVEL || 50, over = [];
  Object.keys(C.SKILLS).forEach((k) => (C.SKILLS[k].spots || []).forEach((sp) => { if (sp.level > cap) over.push(k + ":" + sp.id + " " + sp.level); }));
  Object.keys(C.WORKSHOPS).forEach((w) => (C.WORKSHOPS[w].recipes || []).forEach((r) => { if (r.level > cap) over.push(w + ":" + r.make + " " + r.level); }));
  Object.keys(C.REGIONS).forEach((id) => { const n = C.REGIONS[id].needs; Object.keys((n && n.skills) || {}).forEach((k) => { if (n.skills[k] > cap) over.push(id + " needs " + k + " " + n.skills[k]); }); });
  C.SHIPS.forEach((x) => { if ((x.con || 0) > cap) over.push(x.name + " Construction " + x.con); });
  ok("every spot, recipe, region and ship can be reached: nothing asks for a skill above the cap (" + cap + ")", !over.length, over.join(", "));
}

/* ---- one place for each string, and rope everywhere (2026-10-09, Cam: "Remove the horsehair bowstring, only spinning wheel
   for thread and crossbow string ... rope ... a requirement for caving, ship building, material for towns, gather quests ...
   made of horse hair at the spinning wheel") ---- */
{
  const where = (make) => Object.keys(C.WORKSHOPS).filter((w) => (C.WORKSHOPS[w].recipes || []).some((r) => r.make === make));
  const rec = (w, make) => C.WORKSHOPS[w].recipes.filter((r) => r.make === make);
  ok("bow strings, crossbow strings and thread are made only at the spinning wheel", ["bowstring", "crossbowstring", "thread"].every((k) => where(k).join() === "spinning"),
     ["bowstring", "crossbowstring", "thread"].map((k) => k + ":" + where(k)).join(" "));
  ok("  bow strings from flax only (no horsehair); thread from cotton (from the start) or silk",
     rec("spinning", "bowstring").every((r) => r.needs.flax && !r.needs.horsehair) && rec("spinning", "thread").some((r) => r.needs.cotton && r.level === 1));
  ok("rope is spun from flax, cotton or horsehair", ["flax", "cotton", "horsehair"].every((k) => rec("spinning", "rope").some((r) => r.needs[k])) && C.ITEMS.rope.from);
  ok("  the caves want a rope (carried, not used up): the Crystal Caves and the Ice Cavern", ["crystalcaves", "icecavern"].every((id) => (C.REGIONS[id].needs.also || []).includes("rope")));
  ok("  the climbing kit is made with rope", rec("crafting", "climbinggear")[0].needs.rope === 3);
  ok("  ships and island estates take rope", C.SHIP_BUILD.slice(2).every((b) => b.sails.items.rope && b.rigging.items.rope)
     && [1, 2, 3, 4].every((t) => C.estateCost("desert", "house", t).items.rope > 0));
  ok("  and people ask for it: Brokk in the caves, Ingrid in Frosthaven, Shipwright Hal", ["crystalcaves", "frosthaven", "shipyard"].every((p) =>
     C.PEOPLE[p].quests.some((q) => q.needs.some((n) => n.bring && n.bring.rope))));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
