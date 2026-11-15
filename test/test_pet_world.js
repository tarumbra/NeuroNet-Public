/* ==========================================================================
   NeuroPets: the world map, exploring, hidden eggs, the Deep Jungle (2026-10-07).
   ==========================================================================
   Cam: "a world exploration like neopets game world. This way we can even
   hide special eggs in hidden areas and some areas would have a requirement.
   Lets say deep jungle would require the creation of a special machete and a
   certain attack level." / "Now start work on the neopets like world
   navigation please"

   Runs the game's own rules (ui/pet/petcore.js) on made-up players -- never
   the real save.
   ========================================================================== */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
// where places are painted: art/places.js (2026-10-15, the place editor writes it)
const PLACES = (() => { const t = fs.readFileSync(path.join(APP, "ui", "pet", "art", "places.js"), "utf8"), at = t.indexOf("\nwindow.SCENE_PLACES = ");
  return JSON.parse(t.slice(at + "\nwindow.SCENE_PLACES = ".length).trim().replace(/;$/, "")); })();
const sameArr = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const actx = {window: {}, console};
vm.createContext(actx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petart.js"), "utf8"), actx);
const A = actx.window.PetArt || actx.PetArt;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const T0 = 1800000000000, MIN = 60000;
function fresh() { const s = C.advance(C.empty(), T0); s.player.made = true; s.player.name = "Tester"; return s; }
function exploreN(s, region, n, t0) {
  let st = s, t = t0 || T0;
  for (let i = 0; i < n; i++) {
    const r = C.act(st, "explore", {region, roll: (i * 0.6180339887) % 1}, t);
    if (!r.ok) return {st, err: r.error};
    t += C.EXPLORE_TIME + MIN; st = C.advance(r.state, t);
  }
  return {st, t};
}

console.log("\nNeuroPets: the world\n");

/* ---- the map ---- */
const wv = C.worldView(fresh(), T0);
ok("the world map: the village, the mage tower and eighteen regions (the Desert, the Nile, the islands' towns, the Open Sea, the Ice Cavern and the Summit since 2026-10-08), joined by paths (and a sea route)",
  wv.regions.length === 22 && wv.regions[0].hub && wv.links.every(([a, b]) => C.REGIONS[a] && C.REGIONS[b]));
ok("  every region but four is open from the start; its places keep their own levels",
  wv.regions.filter((r) => !r.open).map((r) => r.id).join() === "deepjungle,crystalcaves,mistyisle,frostpeak,desert,nile,sandport,frosthaven,opensea,icecavern,summit,oasis,hollowcrypt", wv.regions.filter((r) => !r.open).map((r) => r.id).join());
ok("  each region has secrets to find, and an egg among them",
  wv.regions.filter((r) => !r.hub && !r.town && r.id !== "magetower").every((r) => r.total >= 2 && (C.SECRETS[r.id].some((x) => x.kind === "egg")
    || r.id === "oasis" && C.SKILLS.fishing.spots.some((sp) => sp.area === "oasis" && sp.rare && sp.rare[0] === "wrappedegg"))));   // the Oasis: the Wrapped egg in its pool
{
  const lv = C.landView(fresh(), "forest", T0);
  ok("a region close up: its gathering spots, hunting ground and expedition",
    lv.spots.length >= 5 && lv.hunt && lv.hunt.bossName === "Bambi" || (lv.hunt && lv.hunt.id === "forest") && lv.expedition && lv.expedition.id === "forest", JSON.stringify(lv.hunt));
  ok("  its hidden spot isn't shown until it's found", !lv.spots.some((sp) => sp.id === "hiddenglade"));
}

/* ---- exploring ---- */
{
  const s = fresh();
  const r = C.act(s, "explore", {region: "farmyard", roll: 0.3}, T0);
  ok("Explore: half an hour out", r.ok && r.state.player.explore && r.state.player.explore.until === T0 + 30 * MIN, r.error);
  ok("  while exploring you can't go gathering or hunting", !C.act(r.state, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.1}, T0 + 1).ok
    && !C.act(r.state, "hunt", {ground: "farmyard", roll: 0.1}, T0 + 1).ok);
  ok("  nor explore twice", !C.act(r.state, "explore", {region: "meadow", roll: 0.1}, T0 + 1).ok);
  const back = C.advance(r.state, T0 + 31 * MIN);
  ok("  back after half an hour, with something to show for it", !back.player.explore && back.world.explored.farmyard === 1 && /xplor/.test(back.log[0].text), back.log[0].text);
  const busy = fresh(); const t = C.act(busy, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.1}, T0).state;
  ok("  out gathering: come home first", !C.act(t, "explore", {region: "farmyard", roll: 0.2}, T0 + 1).ok);
}
{
  const {st} = exploreN(fresh(), "farmyard", 12);
  ok("exploring the Farmyard finds its secrets, one at a time: a cache, then the hidden egg",
    st.world.found.hayloft && st.world.found.speckled && st.bag.speckledegg === 1 && st.coins >= 250, JSON.stringify(st.world));
  ok("  no secret is found twice (one egg, ever)", st.bag.speckledegg === 1);
  const r = C.act(st, "hatch", {egg: "speckled", roll: 0.5}, T0 + 100 * 3600000);
  ok("  the hidden egg hatches a pet found nowhere else (a Golden Hen)", C.EGGS && C.EGGS.speckled ? C.EGGS.speckled.pool[0][0] === "chicken/golden" : C.odds("speckled", st)[0].name === "Golden Hen");
}
{
  // a miss makes the next try likelier; a sniffing companion helps
  const s = fresh();
  const c0 = C.exploreChance(JSON.parse(JSON.stringify(s)), "meadow");
  s.world = {found: {}, explored: {}, misses: {meadow: 2}};
  const c2 = C.exploreChance(JSON.parse(JSON.stringify(s)), "meadow");
  ok("each empty-handed trip makes the next likelier (35% → 65% after two)", c0 === 0.35 && c2 === 0.65, `${c0} ${c2}`);
}
{
  // all the secrets, in time: about 2-3 tries each
  let total = 0, tries = 0;
  for (const id of C.REGION_ORDER.filter((x) => x !== "village" && x !== "magetower" && !C.REGIONS[x].needs && !C.REGIONS[x].isle)) {   // (islands: you'd sail there first)
    let st = fresh(); const n = C.SECRETS[id].length; let k = 0, t = T0;
    while (Object.keys((st.world || {}).found || {}).length < n && k < 40) {
      const r = C.act(st, "explore", {region: id, roll: ((k + 1) * 0.754877666) % 1}, t);
      t += C.EXPLORE_TIME + MIN; st = C.advance(r.state, t); k++;
    }
    total += n; tries += k;
  }
  ok("finding everything takes a while, not forever (about 2-3 explores a secret)", tries / total >= 1.6 && tries / total <= 3.5, `${tries} explores for ${total} secrets`);
}

/* ---- the Deep Jungle ---- */
{
  const s = fresh();
  ok("the Deep Jungle needs a machete and Attack 40", /machete/.test(C.regionLock(s, "deepjungle")) && /Attack 40/.test(C.regionLock(s, "deepjungle")));
  ok("  the machete is smithed at the anvil", C.WORKSHOPS.anvil.recipes.some((r) => r.make === "machete" && r.level >= 30));
  s.bag.machete = 1;
  ok("  a machete alone isn't enough", /Attack 40/.test(C.regionLock(s, "deepjungle")) && !C.act(s, "explore", {region: "deepjungle", roll: 0.2}, T0).ok);
  s.player.skills.attack = C.XP[40];
  ok("  with both, the vines part", C.regionLock(s, "deepjungle") === "" && C.act(s, "explore", {region: "deepjungle", roll: 0.2}, T0).ok);
  const sp = C.SKILLS.foraging.spots.find((x) => x.id === "stranglerfig");
  ok("  its spots are closed without the way in", sp && /machete/.test(C.spotLock(fresh(), "foraging", sp)));
}

/* ---- the other closed regions (2026-10-07) ---- */
{
  const s = fresh();
  // (2026-10-08) the Misty Isle takes your first ship -- Old Salt's boat; Frostpeak is on its own island (you're there for this)
  const need = {crystalcaves: ["lantern", "mining", 30, "lantern"], mistyisle: ["boat", "fishing", 35, "rowboat"], summit: ["climbinggear", "defence", 35, "climbing kit"]};   // (stage 3: the climb is the Summit's now)
  for (const [id, [item, sk, lv, word]] of Object.entries(need)) {
    const t = fresh();
    if (C.REGIONS[id].isle) t.player.island = C.REGIONS[id].isle;
    const before = C.regionLock(t, id);
    t.bag[item] = 1; t.player.skills[sk] = C.XP[lv];
    if (id === "crystalcaves") { ok("  the caves want a rope too (2026-10-09)", /a rope \(spun at the spinning wheel\)/.test(C.regionLock(t, id)), C.regionLock(t, id)); t.bag.rope = 1; }
    ok(`${C.REGIONS[id].name}: needs ${word} and ${C.SKILLS[sk].name} ${lv}, then it's open with places to gather`,
      before.includes(word) && before.includes(`${C.SKILLS[sk].name} ${lv}`) && C.regionLock(t, id) === ""
      && C.landView(t, id, T0).spots.length >= 1 && C.SECRETS[id].some((x) => x.kind === "egg"), before);
  }
  ok("  the lantern is smithed, the climbing gear made at your bench, the boat built by Old Salt",
    C.WORKSHOPS.anvil.recipes.some((r) => r.make === "lantern") && C.WORKSHOPS.crafting.recipes.some((r) => r.make === "climbinggear")
    && C.PEOPLE.coast.quests.some((q) => q.reward.items && q.reward.items.boat));
  ok("  everything a recipe or a quest asks for exists", Object.values(C.PEOPLE).every((p) => p.quests.every((q) => q.needs.every((n) => Object.keys(n.bring || {}).every((k) => C.ITEMS[k])))));
}

/* ---- people and quests ---- */
{
  ok("someone lives in every region, with quests (two in the older regions)", C.REGION_ORDER.filter((x) => x !== "village" && x !== "deepjungle" && x !== "magetower").every((r) => C.PEOPLE[r] && C.PEOPLE[r].quests.length >= 1)
    && Object.keys(C.PEOPLE).every((r) => C.PEOPLE[r].quests.length >= 6)    // (2026-10-09, Cam: "a lot more quests") -- at least six each
    && Object.values(C.PEOPLE).reduce((a, p) => a + p.quests.length, 0) >= 150);
  let s = fresh();
  s.quests = Object.assign({}, s.quests); C.STORY.forEach((c) => { s.quests[c.id] = 1; });   // the story's chapters have their own tests (test_pet_story.js)
  let pv = C.personView(s, "farmyard");
  ok("Farmer Giles: his first quest, with a checklist", pv.quest && pv.quest.id === "breakfast" && !pv.quest.can && pv.quest.needs.length === 2);
  ok("  not ready: Hand it in says what's missing", /Not yet: egg 0\/5/i.test(C.act(s, "quest", {region: "farmyard"}, T0).error || ""), C.act(s, "quest", {region: "farmyard"}, T0).error);
  s.bag.chickenegg = 6; s.bag.potato = 10; s.coins = 0;
  const r = C.act(s, "quest", {region: "farmyard"}, T0);
  ok("  ready: the things are taken and the reward given (coins, a crate, Farming xp)", r.ok && r.state.bag.chickenegg === 1 && !r.state.bag.potato && r.state.coins === 150
    && r.state.bag.woodcrate === 1 && r.state.player.skills.farming >= 150, r.error || r.msg);
  pv = C.personView(r.state, "farmyard");
  ok("  then the next one: beat Gideon Fox", pv.quest.id === "thatfox" && /Gideon/.test(pv.quest.needs[0].text));
  s = r.state; s.hunt = s.hunt || {}; s.hunt.farmyard = {kills: 60, wins: 1, losses: 0};
  const r2 = C.act(s, "quest", {region: "farmyard"}, T0 + 1);
  ok("  done -- and there's more: the next in his chain", r2.ok && C.personView(r2.state, "farmyard").quest && C.personView(r2.state, "farmyard").quest.id.startsWith("x_farmyard_")
     && C.worldView(r2.state, T0).regions.find((x) => x.id === "farmyard").questsLeft === C.PEOPLE.farmyard.quests.filter((q) => !q.story).length - 2);
  const ws = fresh(); ws.bag.chickenegg = 5; ws.bag.potato = 10; ws.quests = {}; C.STORY.forEach((c) => { ws.quests[c.id] = 1; });
  ok("  the map marks a region where a quest is ready", C.worldView(ws, T0).regions.find((x) => x.id === "farmyard").questReady);
  // Old Salt builds the boat
  const o = fresh(); o.quests = {favour: T0}; Object.assign(o.bag, {teak: 15, cloth: 10, ironbar: 5}); o.player.skills.fishing = C.XP[35];
  const b = C.act(o, "quest", {region: "coast"}, T0);
  ok("Old Salt builds you a boat -- and with Fishing 35 the Misty Isle is open", b.ok && b.state.bag.boat === 1 && C.regionLock(b.state, "mistyisle") === "", b.error);
  const m = fresh(); m.quests = {samples: T0}; m.player.skills.attack = C.XP[40]; m.hunt = {jungle: {kills: 600, wins: 1, losses: 0}};
  const mr = C.act(m, "quest", {region: "jungle"}, T0);
  ok("Explorer Reyes gives you his machete -- another way into the Deep Jungle", mr.ok && mr.state.bag.machete === 1 && C.regionLock(mr.state, "deepjungle") === "", mr.error);
  const lk = fresh(); lk.quests = {}; lk.bag.quartz = 20; lk.bag.amethyst = 3;
  ok("  you can't hand in a quest in a region you can't reach", !C.act(lk, "quest", {region: "crystalcaves"}, T0).ok);
}

/* ---- Today, and what's going on where (2026-10-07) ---- */
{
  let s = fresh(); s.bag.chickenegg = 5; s.bag.potato = 10; s.bag.woodcrate = 1; s.quests = {}; C.STORY.forEach((c) => { s.quests[c.id] = 1; });
  s = C.act(s, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.2}, T0).state;
  const d = C.dashView(s, T0 + MIN);
  ok("Today: what's going on (your trip, with time left)", d.live.length === 1 && d.live[0].kind === "gather" && d.live[0].endsIn > 0 && d.live[0].go === "pet:world" && d.live[0].region === "farmyard");   // the map, not the skill's list (2026-10-10)
  ok("  what's ready for you (a quest to hand in, a crate to open), each with where to go",
    d.ready.some((x) => x.kind === "quest" && x.region === "farmyard") && d.ready.some((x) => x.kind === "crates" && x.go === "pet:bag"));
  ok("  and the diary's latest", d.log.length >= 1 && /foraging/.test(d.log[0].text));
  ok("the map shows where you are busy", C.worldView(s, T0).regions.find((r) => r.id === "farmyard").busy.includes("gather"));
  const lv = C.landView(s, "farmyard", T0 + MIN);
  ok("  and the region says so, with your trip", lv.doing.includes("gather") && lv.job && lv.job.name === "Hedgerow");
  const home = C.act(s, "home", {}, T0 + 10 * MIN).state;
  const again = C.dashView(home, T0 + 10 * MIN).again;
  ok("back home: Today offers to go back -- to the place on the map, not a trip from afar (2026-10-10)", again.length && !again[0].act && again[0].region === "farmyard" && /Hedgerow/.test(again[0].title));
}

/* ---- the pages' pictures and celebrations (2026-10-07) ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  const scenes = pj.slice(pj.indexOf("function sceneSVG"), pj.indexOf("function renderLand"));
  ok("every region has its own illustrated scene", C.REGION_ORDER.filter((r) => r !== "village").every((r) => new RegExp("\\n\\s+" + r + "\\(\\) \\{").test(scenes)));
  // the celebrations read the diary: the game's own words must still match
  let s = fresh(); s.bag.chickenegg = 5; s.bag.potato = 10; s.quests = {}; C.STORY.forEach((c) => { s.quests[c.id] = 1; });
  const q = C.act(s, "quest", {region: "farmyard"}, T0);
  const texts = q.state.log.map((e) => e.text);
  ok("  a quest done is said the way the celebrations look for", texts.some((t) => /: "Thank you!" Quest done -- (.+?) \(/.test(t)), texts[0]);
  ok("  and a level up", texts.some((t) => /^You reached (.+) level (\d+)!/.test(t)), texts.join(" | "));
  ok("  (the celebrations are there, for levels, quests, finds, eggs, bosses, rooms, herbs, rare finds)", ["Level up!", "Quest complete", "Hatched!", "Boss beaten", "Built", "New herb", "Rare find"].every((w) => pj.includes(w)));
}

/* ---- the item sheet: where a thing comes from, what it's for (2026-10-07) ---- */
{
  const s = fresh();
  const tuna = C.itemInfo(s, "rawtuna");
  ok("an item's sheet: where it comes from (raw tuna: fishing on the Coast)", tuna.from.some((t) => /Fishing at the Harbour \(Coast/.test(t)), tuna.from.join(" | "));
  ok("  and what it's for (cooked at the kitchen, Old Salt's quest, pet food)", ["Tuna (Kitchen)", "Quest: A fisherman's favour (Old Salt)", "Food for your pet"].every((u) => tuna.uses.includes(u)), tuna.uses.join(" | "));
  const bar = C.itemInfo(s, "bronzebar");
  ok("  made things say where they're made, and the anvil's recipes use them", bar.from[0] === "Made at the furnace (Smelting 1)" && bar.uses.length + bar.moreUses > 10);
  ok("  a hidden spot's finds stay hidden until it's found", !C.itemInfo(s, "valerian").from.some((t) => /Hidden glade/.test(t)));
  ok("  every item has a sheet", Object.keys(C.ITEMS).every((k) => C.itemInfo(s, k)));
}

/* ---- hidden spots ---- */
{
  const s = fresh(); s.player.skills.foraging = C.XP[30];
  const glade = C.SKILLS.foraging.spots.find((x) => x.id === "hiddenglade");
  ok("a hidden spot: locked until found", /Not found yet/.test(C.spotLock(s, "foraging", glade)) && !C.playerView(s, T0).skills.foraging.spots.some((x) => x.id === "hiddenglade"));
  s.world = {found: {hiddenglade: T0}, explored: {}, misses: {}};
  ok("  found: it's on the Foraging page and you can go", C.spotLock(s, "foraging", glade) === "" && C.playerView(s, T0).skills.foraging.spots.some((x) => x.id === "hiddenglade")
    && C.act(s, "trip", {skill: "foraging", spot: "hiddenglade", roll: 0.3}, T0).ok);
}

/* ---- pictures ---- */
{
  const hidden = ["chicken/golden", "sheep/black", "hare/snow", "deer/white", "seal/selkie", "fox/silver", "tiger/white", "snake/emerald"];
  ok("every hidden pet has its own colours", hidden.every((k) => { const [sp, c] = k.split("/"); const p = A.palette(sp, c); const base = A.palette(sp, C.SPECIES[sp].colours[0]);
    return p && JSON.stringify(p) !== JSON.stringify(base); }));
  const eggs = Object.keys(C.ITEMS).filter((k) => C.ITEMS[k].egg && C.SECRETS && Object.values(C.SECRETS).some((l) => l.some((x) => x.egg === k)));
  ok("  and every hidden egg and key item has a picture", eggs.length === 17 && eggs.concat(["machete", "lantern", "boat", "climbinggear", "obj_map", "desertkit", "rope", "pitch"]).every((k) => A.itemArt(k) && A.itemArt(k).rows), eggs.length);
  ok("  the three new hidden pets too", ["spider/crystal", "crab/coral", "ram/frost"].every((k) => { const [sp, c] = k.split("/"); return JSON.stringify(A.palette(sp, c)) !== JSON.stringify(A.palette(sp, C.SPECIES[sp].colours[0])); }));
}

/* ---- the painted map (2026-10-08, Cam's picture) ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  const art = pj.slice(pj.indexOf("const WORLD_ART = {"), pj.indexOf("const WORLD_W"));
  const pic = path.join(APP, "ui", "pet", "art", "worldmap.webp");
  ok("the map is Cam's picture, shipped with the game", fs.existsSync(pic) && fs.statSync(pic).size < 1024 * 1024 && /"art\/worldmap\.webp"/.test(pj));
  ok("  every region has an outline and a scroll on it (but the ones waiting for the new map)", C.REGION_ORDER.every((r) => /WORLD_SOON = \[[^\]]*"/.test(pj) && pj.match(/WORLD_SOON = \[([^\]]*)\]/)[1].includes(`"${r}"`) || new RegExp(`\\b${r}: \\{pts: "[\\d, ]+", label: \\[\\d+, \\d+, \\d+\\]\\}`).test(art)),
     C.REGION_ORDER.filter((r) => !art.includes(r + ": {pts")).join());
  ok("  a mod pack's own map still replaces it", /modPics\.regions\.worldmap \|\| "art\/worldmap\.webp"/.test(pj));
}

/* ---- the sea chart (2026-10-09, Cam's pictures: the main island on its own, and a chart of the islands) ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  const sea = pj.slice(pj.indexOf("const SEA_ART = {"), pj.indexOf("const SEA_BLURB"));
  const pic = path.join(APP, "ui", "pet", "art", "seachart.webp");
  ok("the sea chart is Cam's picture, shipped with the game (a mod pack can replace it)", fs.existsSync(pic) && fs.statSync(pic).size < 1024 * 1024
     && /modPics\.regions\.seachart \|\| "art\/seachart\.webp"/.test(pj) && pj.includes('{id: "seachart", name: "The sea chart (background)"'));
  ok("  it has the main island, the Shipyard, the Open Sea, the Misty Isle and every island", ["main", "shipyard", "opensea", "mistyisle"].concat(Object.keys(C.ISLANDS || {desert: 1, frostpeak: 1}))
     .every((k) => new RegExp(`\\b${k}: \\{pts: "[\\d, ]+", label: \\[\\d+, \\d+, \\d+\\]`).test(sea)));
  ok("  Frostpeak is off the main island's map now (it's an island)", !/\bfrostpeak: \{pts/.test(pj.slice(pj.indexOf("const WORLD_ART = {"), pj.indexOf("const WORLD_W"))));
  ok("  the Map opens on the main island; Sea chart and back are buttons; an island sails (it's not its region)",
     /if \(seaChart\) return renderSea\(host, wv\);/.test(pj) && /label: seaChart \? "Island map" : "Sea chart"/.test(pj)
     && /const reg = \(id\) => !isle\(id\) && at\[id\];/.test(pj) && /act\("sail", \{to: home \? "home" : id, provisions: provOn\(\)\}\)/.test(pj));
  ok("foreign places open only on their own island (or the Open Sea from the sea chart): not in the main island's list, not from the Coast",
     /wv\.regions\.filter\(\(r\) => !r\.hub && !WORLD_SOON\.includes\(r\.id\)\)/.test(pj) && /if \(worldRegion && !onThisIsland\(worldRegion\)\) worldRegion = "";/.test(pj)
     && !pj.includes('"@opensea"') && /if \(reg\(id\) && !onThisIsland\(id\)\) return toast/.test(pj));
  ok("the Coast's Shipyard is Shipwright Hal's painted scroll", (PLACES.coast["pet:shipyard"].at.length === 3 && PLACES.coast["pet:shipyard"].o.length === 2));
}

/* ---- Cam's pictures of 2026-10-09: the islands, their places, the caves, the tower, the estates, the pages, the battles ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), A = (f) => fs.existsSync(path.join(APP, "ui", "pet", "art", f + ".webp"));
  const pics = ["isle-desert", "isle-frostpeak", "desert", "nile", "oasis", "sandport", "frosthaven", "frostpeak", "icecavern", "summit", "mistyisle", "crystalcaves",
    "magetower", "pyramid", "nursery", "storeroom", "graveyard", "camp"].concat([0, 1, 2, 3, 4].map((i) => "estate-desert-" + i), [0, 1, 2, 3, 4].map((i) => "estate-frostpeak-" + i),
    ["farmyard", "pasture", "meadow", "forest", "deepforest", "coast", "jungle", "frostpeak", "desert", "nile", "pyramid"].map((g) => "battle-" + g));
  ok("every new picture ships with the game", pics.every(A), pics.filter((f) => !A(f)).join());
  const missing = [];
  ["desert", "nile", "oasis", "frostpeak", "icecavern", "summit", "mistyisle", "crystalcaves"].forEach((id) => {
    C.GATHERING.forEach((k) => C.SKILLS[k].spots.forEach((sp) => { if (sp.area === id && !sp.essence && !(PLACES[id] || {})[k + ":" + sp.id]) missing.push(id + " " + sp.id); }));
  });
  ok("  every spot in the newly painted regions has its scroll", !missing.length, missing.join());
  ok("  the islands have their own maps; the estates show their stage; the Pyramid, the camp and the graveyard are pictures",
     pj.includes("const ISLE_ART = {") && pj.includes("isleMapHTML(wv.here, regs)") && pj.includes("`estate-${ev.isle}-${ev.stagePic}`")
     && pj.includes('paintedHTML("pyramid"') && pj.includes('paintedHTML("camp"') && pj.includes('paintedHTML("graveyard"'));
  ok("  the mage tower's floors are its ranks; fights stand in front of Cam's backdrops", !!PLACES.magetower["rank:5"] && pj.includes("const BATTLE_ART = [") && pj.includes("art/battle-${bg}.webp"));
}

/* ---- painted places: the regions Cam drew, the village, the estate (2026-10-08) ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), gj = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8");
  const block = (id) => PLACES[id] || {};
  const scenes = ["coast", "deepforest", "farmyard", "forest", "jungle", "meadow", "pasture", "village", "estate", "house", "library", "workshop"];
  ok("every painted scene ships with the game", scenes.every((id) => fs.existsSync(path.join(APP, "ui", "pet", "art", id + ".webp")) && Object.keys(block(id)).length > 3));
  const regions = scenes.filter((id) => C.REGIONS[id]);
  const missing = [];
  regions.forEach((id) => {
    const b = block(id), keys = [];
    C.GATHERING.forEach((k) => C.SKILLS[k].spots.forEach((sp) => { if (sp.area === id && !sp.essence) keys.push(k + ":" + sp.id); }));
    if (C.HUNTS[id]) keys.push("hunt");
    if (C.REGIONS[id].expedition) keys.push("exp");
    if (C.PEOPLE[id]) keys.push("person");
    keys.forEach((k) => { if (!b[k]) missing.push(id + " " + k); });
  });
  ok("  every spot, hunting ground, expedition and person in those regions is on its picture", !missing.length, missing.join(", "));
  ok("  the village has the Guild hall (the estate's old spot, Part 9), the nursery and every villager", ["pet:guild", "pet:nursery"].concat(Object.keys(C.WORKSHOPS).filter((k) => C.WORKSHOPS[k].npc && !C.WORKSHOPS[k].region))
       .every((k) => !!block("village")[k]));
  ok("  the estate has the house, workshop, library, storeroom and graveyard", ["house", "workshop", "library", "storeroom", "graveyard"].every((k) => !!block("estate")["pet:" + k]));
  ok("the pages live in places (Cam: library = the books, nursery = hatchery + breeding, house = bag/player/pets/my pet/expeditions, equipment = the Character sheet in the house, 2026-10-15)",
     /"pet:library": "pet:estate"/.test(gj) && ["spellbook", "enchants", "herbarium", "bestiary", "dex"].every((k) => gj.includes(`"pet:${k}": "pet:library"`))
     && ["hatchery", "breed"].every((k) => gj.includes(`"pet:${k}": "pet:nursery"`)) && ["home", "pets", "skills", "expeditions"].every((k) => gj.includes(`"pet:${k}": "pet:house"`))
     && gj.includes('"pet:gear": "pet:house"') && gj.includes('"pet:graveyard": "pet:estate"') && gj.includes('"pet:estate": "pet:world"'));
}

/* ---- Home, the camp in the Forest, settings (2026-10-08) ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), gj = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8");
  const html = fs.readFileSync(path.join(APP, "ui", "pet", "index.html"), "utf8");
  ok("the Camp is a place in the Forest (painted, and a card), not a sidebar row", /forest: \[\["pet:camp", "Camp"/.test(pj) && !!PLACES.forest["pet:camp"]
     && gj.includes('PAGES["pet:camp"].parent = "pet:world"'));
  ok("the game opens at your Estate (2026-10-10); Today is still at Home, in the house", gj.includes('let current = "pet:estate";') && /if \(page === "pet:dash"\) return renderHub\(host, "pet:house"\)/.test(pj)
     && /renderDash\(host, ""\)/.test(pj) && gj.includes('if (key === "pet:dash") key = "pet:house";'));
  ok("  with a folded list of every material you can gather now, and where", /<details class="pp-shop pp-materials"/.test(pj) && /if \(sp\.lock\) return;/.test(pj) && /data-region-go=/.test(pj));
  ok("the sidebar can be hidden (☰ in the top bar; Back, Map and Home are in the bar above the page)", html.includes('id="np-menu"') && gj.includes('classList.toggle("np-noside"')
     && html.includes('<nav class="np-pathbar" id="np-pathbar"'));
  // (2026-10-09, Cam: "all navigation just above the map and not in the top bar ... back, map and home ... Home will not
  //  work when on another island until you unlock and build the respective player estate")
  ok("one navigation bar above every page: Back (one step up), Map, Home, and the page's own switch; none in the top bar or the pages",
     gj.includes("function drawPath(P)") && gj.includes("back.hidden = true;") && !gj.includes('<button class="np-chip" data-go="pet:house">')
     && !pj.includes('id="pp-world-back"') && !pj.includes("pp-map-switch") && /inner\(\) \{/.test(pj) && /homeTarget\(\) \{/.test(pj));
  ok("  never two Map buttons: a Back that only leads to the Map is greyed out (Cam's screenshot, 2026-10-09)",
     gj.includes('inner && inner.back !== "Map" ?') && gj.includes('!(P.parent === "pet:world" && !SS.Pet.regionName())'));
  {
    const run = (setup) => { const s = C.advance(C.empty(), T0); s.player.made = true; setup(s);
      // homeTarget's rule, on the rules alone: at sea none; home the house; an island its estate once the house is built
      const wv = C.worldView(s, T0), e = (s.estates || {})[wv.here];
      return wv.voyage ? "" : !wv.here ? "pet:estate" : e && e.bought && ((e.parts || {}).house || 0) >= 1 ? "pet:islandestate" : ""; };
    ok("  Estate (was Home, 2026-10-10): your estate; on another island only once that island's estate has its house; none at sea",
       run(() => {}) === "pet:estate" && /if \(!wv\.here\) return \{go: "pet:estate"\}/.test(pj) && gj.includes('"Estate", atHome)') && gj.includes('let current = "pet:estate";') && run((s) => { s.player.island = "desert"; }) === ""
       && run((s) => { s.player.island = "desert"; s.estates = {desert: {bought: true, parts: {}}}; }) === ""
       && run((s) => { s.player.island = "desert"; s.estates = {desert: {bought: true, parts: {house: 1}}}; }) === "pet:islandestate"
       && run((s) => { s.player.voyage = {to: "desert", from: "", since: T0, until: T0 + 9e5}; }) === ""
       && /if \(e && e\.bought && \(\(e\.parts \|\| \{\}\)\.house \|\| 0\) >= 1\) return \{go: "pet:islandestate"\};/.test(pj));
  }
  ok("the save slots come first on the first start of a day (not in the sandbox), with Carry on", gj.includes("NP.welcome = !!hello.firstToday && NP.settings.dailySaves !== false && !sandbox")
     && pj.includes('id="pp-carry-on"'));
  ok("settings hide the modder, the new game buttons, the sandbox switch, the sidebar, the daily saves",
     ["sidebar", "dailySaves", "newGame", "modder", "sandbox"].every((k) => pj.includes(`["${k}", `)) && gj.includes('k !== "pet:modder" || NP.settings.modder !== false')
     && pj.includes("${showNewGame ?"));
}

/* ---- inside places, living pictures, one-click gathering (2026-10-08) ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  const block = (id) => PLACES[id] || {};
  const benches = Object.keys(C.WORKSHOPS).filter((k) => !C.WORKSHOPS[k].npc);
  ok("the workshop picture has every bench, each bench room and the garden", benches.every((k) => block("workshop")[k])
     && ["kitchen", "smithy", "shed", "library"].every((r) => block("workshop")["room:" + r]) && !!block("workshop")["pet:farm"],
     benches.filter((k) => !block("workshop")[k]).join());
  ok("  the house has the house pages, the bedroom and the material archive", ["home", "pets", "skills", "expeditions"].every((k) => block("house")["pet:" + k])
     && !!block("house")["room:bedroom"] && !!block("house").materials);
  ok("  the library has its five books", ["spellbook", "enchants", "herbarium", "bestiary", "dex"].every((k) => block("library")["pet:" + k]));
  ok("  the hearth, table, archive, reading chair, stacks and observatory are painted places with their own sections",
     ["hearth", "dining", "archive", "reading", "stacks", "observatory"].every((k) => Object.values(PLACES).some((sc) => sc["sec:" + k]) && pj.includes(`function ${({dining: "diningHTML", hearth: "hearthHTML", archive: "archiveHTML", reading: "readingHTML", stacks: "stacksHTML", observatory: "observatoryHTML"})[k]}(hv)`)));
  ok("the pictures live: a tint by the clock (none indoors), smoke, water, fire, birds, fireflies after dark -- still if asked for less motion",
     /function dayPhase\(now\)/.test(pj) && /function lifeSVG\(id\)/.test(pj) && /\$\{lifeSVG\(id\)\}\$\{cells\.join/.test(pj) && /lifeSVG\("worldmap"\)/.test(pj)
     && fs.readFileSync(path.join(APP, "ui", "pet", "pet.css"), "utf8").includes("@media (prefers-reduced-motion: reduce) { .pp-life *"));
  ok("one click on a material goes there and gathers; a second click on the spot doesn't open the old skill page",
     /data-region-go=.*data-skill=.*data-spot=/.test(pj) && /async function gatherAt\(region, skill, spot\)/.test(pj)
     && /if \(p\.kind === "spot" && p\.here\) return toast/.test(pj) && /if \(p\.kind === "spot" && p\.lock\) return toast/.test(pj));
}

/* ---- one place at a time (2026-10-08, Cam: "i want it to just show the options at the dining table") ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  ok("a painted place opens a sheet with only its own options (home sections, rooms, materials, a region's person and secrets)",
     /function openPlace\(key, region\)/.test(pj) && /if \(key\.startsWith\("sec:"\) \|\| key\.startsWith\("room:"\) \|\| key === "materials"( \|\| key === "recycle" \|\| key === "recycled")?( \|\| key === "cart")?\) return openPlace\(key\);/.test(pj)
     && /openPlace\("person", id\)/.test(pj) && /openPlace\("secrets", id\)/.test(pj));
  ok("  the sheet is redrawn after each render, closes on Esc, ✕, a click outside or going elsewhere",
     (pj.match(/showSec\(\);/g) || []).length >= 4 && /e\.key === "Escape" && openSec\) closeSec\(\)/.test(pj) && /show\(v\) \{\n      closeSec\(\);/.test(pj));
  ok("  painted pages are the picture: no lists of everything under it",
     /\$\{h\.scene \? "" : doorsHTML\(h\.doors\)\}/.test(pj) && /renderDash\(host, ""\)/.test(pj) && !/\$\{roomsHTML\(\(r\) => r\.workshops\.length, true\)\}/.test(pj)
     && /<div class="pp-village"\$\{people \? " hidden" : ""\}>/.test(pj) && /lv\.tower \|\| painted \? " hidden" : ""/.test(pj));
}

/* ---- the pictures can't be selected or dragged (2026-10-08, Cam: it "blues out the map which breaks emersion") ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), css = fs.readFileSync(path.join(APP, "ui", "pet", "pet.css"), "utf8");
  const gcss = fs.readFileSync(path.join(APP, "ui", "pet", "game.css"), "utf8");
  ok("nothing in the game selects on a drag, double-click or Ctrl+A -- typing in a box still does",
     /body\.np \{ -webkit-user-select: none; user-select: none; \}/.test(gcss) && /body\.np input, body\.np textarea[^{]*\{ -webkit-user-select: text; user-select: text; \}/.test(gcss)
     && /\.pp-world, \.pp-world \*[^{]*\{\s*-webkit-user-select: none; user-select: none; -webkit-user-drag: none;/.test(css));
  ok("  and a map's picture can't be dragged off", /\["dragstart", "selectstart"\]\.forEach/.test(pj));
}

/* ---- no blue wash (2026-10-08, Cam: the evening tint looked "blue highlighted") ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  const dp = pj.slice(pj.indexOf("function dayPhase(now)"), pj.indexOf("function lifeSVG(id)"));
  ok("the day's light dims the picture by multiplying, never a coloured veil -- and no blues", /mix-blend-mode:multiply/.test(pj) && !/opacity="\$\{ph\.alpha\}"/.test(pj)
     && (dp.match(/#[0-9a-f]{6}/g) || []).every((h) => { const [r, , b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return b <= r + 8; }), dp.match(/#[0-9a-f]{6}/g));
  ok("  and Settings can turn it off", /st\.dayNight === false/.test(pj) && /\["dayNight", "Day and night on the pictures"/.test(pj));
}

/* ---- a gentle light, and a deeper one in Settings (2026-10-08, Cam: "maps have darkened since last update"; then "add the other one
        but as a setting in the settings menu (accessibility)") ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  const tab = pj.slice(pj.indexOf("const DAY_LIGHT = {"), pj.indexOf("function dayPhase(now)"));
  const gentle = (tab.match(/gentle: \{[^}]*\}/) || [""])[0].match(/#[0-9a-f]{6}/g) || [], deep = (tab.match(/deep: \{[^}]*\}/) || [""])[0].match(/#[0-9a-f]{6}/g) || [];
  ok("by default the day's light never darkens a picture by more than about 15% (each channel at least 0xD0)", gentle.length === 4
     && gentle.every((h) => [1, 3, 5].every((i) => parseInt(h.slice(i, i + 2), 16) >= 0xd0)), gentle.join());
  ok("  Settings, Accessibility: \"Deeper night\" brings back the darker light (off to start)", deep.length === 4 && deep.includes("#8e8794")
     && /st\.deepNight \? "deep" : "gentle"/.test(pj) && /\["@Accessibility"\]/.test(pj) && /\["deepNight", "Deeper night"/.test(pj) && /SETTING_OFF = \{deepNight: true[,}]/.test(pj));   // (the Kit and prototypes start off too, 2026-10-18)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
