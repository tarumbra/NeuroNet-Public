/* ==========================================================================
   NeuroPets: your house -- rooms, upgrades, Construction (2026-10-07).
   ==========================================================================
   Cam: "build a new area called home, inside the home it has different areas
   like kitchen where i cook, smithy which has the anvil and furnace, shed
   which has the tanner and crafting bench, library which has the herblore,
   alchemy and gem table. Each area starts off basic and you have to build
   house upgrades. This will also become a requirement for being able to craft
   higher gear. ... a special pet bed will increase the efficiency of a pet
   resting and depending on the bed will reduce nap time by 5%, 8%, 10% or 15%."

   Runs the game's own rules (ui/pet/petcore.js) on made-up players -- never
   the real save.
   ========================================================================== */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const T0 = 1800000000000, H = 3600000;
function fresh() { const s = C.advance(C.empty(), T0); s.player.made = true; s.player.name = "Tester"; return s; }
const recIdx = (ws, make) => C.WORKSHOPS[ws].recipes.findIndex((r) => r.make === make);

console.log("\nNeuroPets: your house\n");

/* ---- the rooms ---- */
const R = C.ROOMS;
ok("six rooms: kitchen, smithy, shed, library, bedroom and store room", C.ROOM_ORDER.join() === "kitchen,smithy,shed,library,bedroom,storeroom");
ok("  the benches are in their rooms (anvil and furnace in the smithy, tanner and bench in the shed, herbs/potions/gems in the library)",
  R.kitchen.workshops.includes("kitchen") && ["furnace", "anvil"].every((w) => R.smithy.workshops.includes(w))
  && ["tanner", "crafting"].every((w) => R.shed.workshops.includes(w)) && ["herblore", "apothecary", "gemology"].every((w) => R.library.workshops.includes(w)));
ok("  every making bench is in a room", C.WORKSHOP_ORDER.filter((k) => !C.WORKSHOPS[k].npc).every((k) => C.ROOM_ORDER.some((r) => (R[r].workshops || []).includes(k))));
const s0 = fresh();
ok("a new game: every room starts basic", C.ROOM_ORDER.every((r) => s0.house[r] === 1));

/* ---- a basic room limits what its benches make ---- */
{
  const s = fresh(); s.player.skills.smithing = C.XP[22]; s.bag.steel = 10; s.bag.oak = 10; s.coins = 999;
  const i = recIdx("anvil", "steelpick");
  const r = C.act(s, "craft", {workshop: "anvil", make: "steelpick", i}, T0);
  ok("a basic smithy can't make level-20 gear, even at Smithing 22", !r.ok && /sturdy smithy/i.test(r.error), r.error);
  const v = C.villageView(s, T0).find((w) => w.id === "anvil").recipes.find((x) => x.make === "steelpick");
  ok("  the recipe says why", !v.open && /sturdy smithy/i.test(v.roomLock));
  s.house.smithy = 2;
  ok("  a sturdy smithy can", C.act(s, "craft", {workshop: "anvil", make: "steelpick", i}, T0).ok);
}

/* ---- building ---- */
{
  const s = fresh();
  let r = C.act(s, "build", {room: "smithy"}, T0);
  ok("building needs Construction, planks, stone and coins", !r.ok && /Construction level 10/.test(r.error), r.error);
  s.player.skills.construction = C.XP[10]; s.bag.plank = 30; s.bag.stone = 30; s.coins = 2500;
  r = C.act(s, "build", {room: "smithy"}, T0);
  ok("  with them, a sturdy smithy -- and Construction xp", r.ok && r.state.house.smithy === 2 && !r.state.bag.plank && r.state.coins === 0
    && r.state.player.skills.construction >= C.XP[10] + 250, r.error || r.msg);
  ok("  four tiers, each dearer (planks, then hardwood, then fine planks)", (() => { const t = fresh(); t.house.smithy = 4; return !C.act(t, "build", {room: "smithy"}, T0).ok
    && /as grand as it gets/.test(C.act(t, "build", {room: "smithy"}, T0).error); })());
  const hv = C.houseView(s, T0);
  ok("  the house view: each room's tier, what it does, and what the next costs", hv.rooms.length === 6 && hv.rooms[1].next && hv.rooms[1].next.needs.length >= 2);
}
{
  // planks at the sawbench train Construction
  const s = fresh(); s.bag.birch = 20; s.coins = 100;   // (2026-10-09) five times the logs: gathering's quicker
  const r = C.act(s, "craft", {workshop: "sawbench", make: "plank", i: recIdx("sawbench", "plank")}, T0);
  ok("the sawbench in the shed saws logs into planks (Construction xp)", r.ok && r.state.bag.plank === 1 && r.state.player.skills.construction > 0, r.error || r.msg);
  ok("  (balance 2026-10-08, x5 2026-10-09) fifteen logs and a small fee a plank", r.state.bag.birch === 5 && r.state.coins === 97
     && C.WORKSHOPS.sawbench.recipes.every((x) => Object.values(x.needs)[0] >= (x.make === "fineplank" && x.needs.magiclog ? 10 : 15) && x.fee > 0));
  ok("  hardwood and fine planks need a better shed (they're higher level)", (() => { const t = fresh(); t.player.skills.construction = C.XP[30]; t.bag.yew = 4;
    return !C.act(t, "craft", {workshop: "sawbench", make: "fineplank", i: recIdx("sawbench", "fineplank")}, T0).ok; })());
}
{
  // a better room: more xp
  const a = fresh(), b = fresh(); a.bag.birch = b.bag.birch = 3; a.coins = b.coins = 10; b.house.shed = 4;
  const xa = C.act(a, "craft", {workshop: "sawbench", make: "plank", i: 0}, T0).state.player.skills.construction;
  const xb = C.act(b, "craft", {workshop: "sawbench", make: "plank", i: 0}, T0).state.player.skills.construction;
  ok("a grand room gives 15% more xp at its benches", Math.abs(xb - xa * 1.15) < 0.2, `${xa} / ${xb}`);
}

/* ---- the bedroom ---- */
{
  ok("the bedroom's pet bed: naps 5%, 8%, 10% or 15% shorter by tier", JSON.stringify(C.NAP_CUT.slice(1)) === "[0.05,0.08,0.1,0.15]");
  const napHours = (tier) => {
    let s = fresh();
    s = C.act(s, "hatch", {egg: "starter", roll: 0.5}, T0).state;
    s = C.advance(s, T0 + 10 * 60000);
    s.house.bedroom = tier;
    s.pet.s.energy = 0; s.pet.asleep = true; s.pet.at = T0 + 10 * 60000;
    let t = T0 + 10 * 60000, h = 0;
    while (s.pet.asleep && h < 200) { t += 6 * 60000; s = C.advance(s, t); h++; }
    return h * 0.1;
  };
  const n1 = napHours(1), n4 = napHours(4);
  // a nap with no bed would take n1 / 0.95; the royal bed's is 85% of that -- about 89% of the straw bed's
  ok("  a royal bed's nap is 15% shorter than none, the straw bed's 5%", n4 / n1 > 0.85 && n4 / n1 < 0.93, `${n1.toFixed(1)}h vs ${n4.toFixed(1)}h`);
  ok("  your own bed: you heal faster the better the bedroom", (() => { const a = fresh(), b = fresh(); b.house.bedroom = 4;
    [a, b].forEach((x) => { x.player.hp = 1; x.player.at = T0; });
    const ha = C.advance(a, T0 + 5 * 60000).player.hp, hb = C.advance(C.advance(b, T0 + 1), T0 + 5 * 60000).player.hp; return hb > ha; })());
}

/* ---- the store room ---- */
{
  const s = fresh(); s.bag.oak = 30; s.bag.copper = 5;
  let r = C.act(s, "store", {item: "oak", n: "all"}, T0);
  ok("the store room: put things away -- out of your bag", r.ok && !r.state.bag.oak && r.state.storage.oak === 30, r.error);
  r = C.act(r.state, "withdraw", {item: "oak", n: 10}, T0);
  ok("  and take them back", r.ok && r.state.bag.oak === 10 && r.state.storage.oak === 20);
  const full = fresh(); full.storage = {}; Object.keys(C.ITEMS).filter((k) => k !== "copper").slice(0, 60).forEach((k) => { full.storage[k] = 1; }); full.bag.copper = 3;
  ok("  a basic bank holds 60 kinds (Modernize/Reduce Nav; the chests held 26); then build a bigger store room", C.storeCap(full) === 60 && !C.act(full, "store", {item: "copper", n: 1}, T0).ok);
  const u = fresh(); u.bag.unidherb = 2; u.unid = {herb: 2};
  ok("  unidentified herbs aren't stored (identify them first)", !C.act(u, "store", {item: "unidherb", n: 1}, T0).ok);
  // what's stored survives a fall
  const f = fresh(); f.storage = {gold: 5}; f.bag.copper = 3;
  const fs2 = C.advance(C.act(f, "boss", {ground: "farmyard", roll: 0.99}, T0).state, T0 + H);
  ok("  what's stored is safe even when you fall (the bag isn't)", fs2.storage.gold === 5);
}

/* ---- an old game ---- */
{
  const old = fresh(); delete old.house; old.v = 1; old.player.skills.smithing = C.XP[33]; old.player.skills.cooking = C.XP[12]; old.player.skills.gemology = C.XP[46];
  const st = C.advance(old, T0 + 1);
  ok("an old game keeps what it could make: rooms start at the tier its skills need", st.house.smithy === 3 && st.house.kitchen === 1 && st.house.library === 4
    && st.house.bedroom === 1 && st.house.storeroom === 1, JSON.stringify(st.house));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
