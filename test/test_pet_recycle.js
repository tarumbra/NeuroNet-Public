/* The recycle stash (2026-10-11, Cam: "the ability to trash old or uneeded items. achieved by a recycle stash feature ...
   after a specified time they are broken into raw materials, which is placed into recycled materials storage ... can store
   upto 15 types of materials. It can be upgraded in size later. Also you can upgrade the recycle stash later to break items
   down faster. By default take 12 hours. The materials in the recycled materials storage can be used at the crafting
   benches on the estate"). Run: node test/test_pet_recycle.js [app dir] */
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
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 11, 2), HOUR = 3600e3;
const fresh = () => { const s = C.advance(C.empty(), T0); s.player.made = true; return s; };
const go = (s, a, o, t) => C.act(s, a, o, t || T0);

/* ---- what comes back ---- */
{
  const bar = C.WORKSHOPS.furnace.recipes.find((r) => r.make === "bronzebar");
  ok("a bronze bar breaks into half the copper and tin it was smelted from", JSON.stringify(C.salvage("bronzebar", 2)) === JSON.stringify({copper: bar.needs.copper, tin: bar.needs.tin}), JSON.stringify(C.salvage("bronzebar", 2)));
  const helm = C.salvage("bronzehelm", 10);
  ok("  ...all the way down: a bronze helmet gives copper and tin, not bars", helm.copper > 0 && helm.tin > 0 && !helm.bronzebar, JSON.stringify(helm));
  ok("raw things, food and fish give nothing back", !Object.keys(C.salvage("copper", 10)).length && !Object.keys(C.salvage("shrimps", 10)).length);
  // I4 (2026-10-19, Cam): 30 minutes a tier of the thing -- old boots 30 min, bronze 1 h, iron 1 h 30 ...
  ok("30 minutes a tier of the thing (I4), 15 kinds in the store, 20 lots at a time", C.RECYCLE.minutes === 30 && C.RECYCLE.kinds[1] === 15 && C.RECYCLE.lots === 20);
  ok("  upgrades: quicker (x0.75, x0.5, x0.35) and bigger (25, 40, 60 kinds)", C.RECYCLE.speed.slice(2).join() === "0.75,0.5,0.35" && C.RECYCLE.kinds.slice(2).join() === "25,40,60");
}

/* ---- putting things in, and what comes out ---- */
{
  let s = fresh(); s.bag.bronzehelm = 3; s.storage = {bronzeplate: 2};
  let r = go(s, "recycle", {id: "bronzehelm", n: 2, from: "bag"});
  ok("put 2 bronze helmets in from the bag", r.ok && r.state.bag.bronzehelm === 1 && r.state.recycle.lots.length === 1, r.error);
  r = go(r.state, "recycle", {id: "bronzeplate", n: "all", from: "chests"});
  ok("  and everything of a thing from the chests", r.ok && !r.state.storage.bronzeplate && r.state.recycle.lots[1].n === 2, r.error);
  s = r.state;
  ok("not done after 59 minutes (bronze: an hour)", C.advance(s, T0 + 59 * 60e3).recycle.lots.length === 2);
  const d = C.advance(s, T0 + HOUR), want = C.salvage("bronzehelm", 2), wantP = C.salvage("bronzeplate", 2);
  ok("after an hour the raw materials are in the recycled materials store", !d.recycle.lots.length && d.recycle.mats.copper === want.copper + wantP.copper && d.recycle.mats.tin === want.tin + wantP.tin, JSON.stringify(d.recycle.mats));
  ok("  and the diary says so", d.log.some((e) => /Recycled 2 × bronze helmet: \d+ copper/.test(e.text)));
  const v = C.recycleView(d, T0 + 12 * HOUR);
  ok("the view: materials, 2 of 15 kinds", v.store.used === 2 && v.store.cap === 15 && v.store.items.some((x) => x.id === "copper"));
  r = go(d, "recycletake", {id: "tin", n: "all"}, T0 + 12 * HOUR);
  ok("take a material to the bag", r.ok && r.state.bag.tin === d.recycle.mats.tin && !r.state.recycle.mats.tin, r.error);
}

/* ---- trash, take back, and what can't go in ---- */
{
  let s = fresh(); s.bag.shrimps = 4;
  let r = go(s, "recycle", {id: "shrimps", n: "all", from: "bag"});
  ok("food goes in for recycling points (2026-10-11)", r.ok && /recycling points/.test(r.msg) && !r.state.bag.shrimps, r.msg);
  const gone = C.advance(r.state, T0 + Math.max(1, C.ITEMS.shrimps.gem) * 30 * 60e3), worth = Math.floor(C.priceOf("shrimps") * 4 * 0.5 * 100) / 100;
  ok("  a tier's half-hours later: half its worth in points, no materials", !gone.recycle.lots.length && !Object.keys(gone.recycle.mats).length && gone.recycle.points === worth
     && gone.log.some((e) => /into [\d.]+ recycling points/.test(e.text)), gone.recycle.points + " vs " + worth);
  r = go(r.state, "recyclecancel", {i: 0}, T0 + 10 * 60e3);           // (before it's done: shrimps take half an hour now, I4)
  ok("changed your mind: take a lot back before it's done", r.ok && r.state.bag.shrimps === 4 && !r.state.recycle.lots.length, r.error);
  const keyId = Object.keys(C.ITEMS).find((k) => C.ITEMS[k].key), eggId = Object.keys(C.ITEMS).find((k) => C.ITEMS[k].egg);
  s = fresh(); s.bag[keyId] = 1; s.bag[eggId] = 1;
  ok("keys and eggs can't go in", !go(s, "recycle", {id: keyId, n: 1}).ok && !go(s, "recycle", {id: eggId, n: 1}).ok);
  s = fresh(); s.bag.copper = 5;
  ok("you can't put in more than you have", !go(s, "recycle", {id: "copper", n: 6}).ok);
  s = fresh(); s.bag.berry = 99; s.recycle = {tier: 1, storeTier: 1, mats: {}, lots: Array.from({length: 20}, () => ({id: "berry", n: 1, at: T0, ready: T0 + 12 * HOUR}))};
  ok("20 lots at a time", !go(s, "recycle", {id: "berry", n: 1}).ok);
  s = fresh(); s.bag.copper = 5; s.player.island = "desert";
  ok("only at home", !go(s, "recycle", {id: "copper", n: 1}).ok);
}

/* ---- recycling points buy raw materials (2026-10-11, Cam: "have them broken down into recycling points which can then be
        spent on different raw materials (this way it makes it relevent to recycle stil)") ---- */
{
  let s = fresh(); s.recycle = {tier: 1, storeTier: 1, lots: [], mats: {}, points: 50};
  const shop = C.recycleView(s, T0).shop.map((x) => x.id);
  ok("points buy what you can gather now: copper and tin at level 1", shop.includes("copper") && shop.includes("tin"));
  ok("  not what you can't reach yet (rune ore), nor junk no bench uses (old boots)", !shop.includes("runite") && !shop.includes("boot"));
  let r = go(s, "recyclebuy", {id: "copper", n: 100});
  ok("buy 100 copper ore: into the materials store, at Marlow's value in points", r.ok && r.state.recycle.mats.copper === 100 && Math.abs(r.state.recycle.points - (50 - C.priceOf("copper") * 100)) < 0.011, r.error);
  ok("  never more than your points", !go(s, "recyclebuy", {id: "copper", n: Math.ceil(51 / C.priceOf("copper"))}).ok);
  ok("  nor rune ore at level 1", !go(s, "recyclebuy", {id: "runite", n: 1}).ok);
  r = go(s, "recyclebuy", {id: "copper", n: "max"});
  ok("  Max spends what you have", r.ok && r.state.recycle.points < C.priceOf("copper"), r.error);
  s.recycle.mats = {}; Object.keys(C.ITEMS).slice(40, 55).forEach((k) => { s.recycle.mats[k] = 1; });
  ok("  not into a full store", !go(s, "recyclebuy", {id: "tin", n: 1}).ok);
  ok("the exchange is on the screen (a tab of the materials store, in the bench's look since 2026-10-20)", PET.includes('label: "Exchange"') && PET.includes('doIt("recyclebuy"'));
}

/* ---- a full store: finished lots wait ---- */
{
  let s = fresh(); s.bag.bronzebar = 4;
  s.recycle = {tier: 1, storeTier: 1, lots: [], mats: {}};
  "abcdefghijklmno".split("").forEach((c, i) => { s.recycle.mats[Object.keys(C.ITEMS)[i + 40]] = 1; });   // 15 other kinds
  s = go(s, "recycle", {id: "bronzebar", n: 4, from: "bag"}).state;
  const w = C.advance(s, T0 + 13 * HOUR);
  ok("with all 15 kinds taken, a finished lot waits in the stash", w.recycle.lots.length === 1 && w.recycle.lots[0].full && !w.recycle.mats.copper);
  ok("  the view says it's waiting", C.recycleView(w, T0 + 13 * HOUR).stash.lots[0].waiting);
  const k = Object.keys(w.recycle.mats); k.slice(0, 2).forEach((x) => delete w.recycle.mats[x]);
  const later = C.advance(w, T0 + 14 * HOUR);
  ok("  and goes in once there's room", !later.recycle.lots.length && later.recycle.mats.copper > 0);
}

/* ---- the benches use the recycled materials ---- */
{
  const s = fresh(); s.player.skills.smithing = 0; s.bag = {}; s.storage = {copper: 2, tin: 10};
  s.recycle = {tier: 1, storeTier: 1, lots: [], mats: {copper: 4}};
  const ri = C.WORKSHOPS.furnace.recipes.findIndex((r) => r.make === "bronzebar"), need = C.WORKSHOPS.furnace.recipes[ri].needs;
  const view = C.villageView(s, T0).find((w) => w.id === "furnace").recipes[ri];
  ok("a bench at home counts the recycled materials with the chests", view.needs.find((n) => n.id === "copper").have === 6 && view.can, JSON.stringify(view.needs));
  const r = go(s, "craft", {workshop: "furnace", make: "bronzebar", i: ri});
  ok("  and uses them before the chests", r.ok && !r.state.recycle.mats.copper && r.state.storage.copper === 6 - need.copper && r.state.storage.tin === 10 - need.tin,
     r.error + " " + JSON.stringify([r.state.recycle && r.state.recycle.mats, r.state.storage]));
}

/* ---- upgrades ---- */
{
  let s = fresh(); s.coins = 50000; s.player.skills.construction = 1e7; s.bag = {plank: 70, ironbar: 10, rope: 5};
  let r = go(s, "recyclebuild", {part: "stash"});
  ok("build a sturdy recycle stash: 25% quicker", r.ok && r.state.recycle.tier === 2 && /25% quicker/.test(C.recycleView(r.state, T0).stash.speed), r.error);
  r = go(r.state, "recyclebuild", {part: "store"});
  ok("build a sturdy materials store: 25 kinds", r.ok && r.state.recycle.storeTier === 2 && C.recycleView(r.state, T0).store.cap === 25, r.error);
  s = fresh(); s.bag = {plank: 40, ironbar: 10}; s.coins = 50000;
  ok("an upgrade needs its Construction level", !go(s, "recyclebuild", {part: "stash"}).ok);
  s = fresh(); s.bag.copper = 1; s.recycle = {tier: 4, storeTier: 1, lots: [], mats: {}};
  const t = go(s, "recycle", {id: "copper", n: 1});
  ok("a grand stash: copper (tier " + Math.max(1, C.ITEMS.copper.gem) + ") at 0.35 of the time", t.ok && t.state.recycle.lots[0].ready === T0 + Math.round(30 * Math.max(1, C.ITEMS.copper.gem) * 0.35 * 60e3));
  s = fresh(); s.bag.boot = 1; s.bag.ironhelm = 1;
  let b2 = go(s, "recycle", {id: "boot", n: 1}); b2 = go(b2.state, "recycle", {id: "ironhelm", n: 1});
  ok("I4: old boots 30 minutes, an iron helmet 1 h 30", b2.ok && b2.state.recycle.lots[0].ready === T0 + 30 * 60e3 && b2.state.recycle.lots[1].ready === T0 + 90 * 60e3, JSON.stringify(b2.state.recycle && b2.state.recycle.lots));
  s = fresh(); s.recycle = {tier: 1, storeTier: 1, mats: {}, lots: [{id: "bronzehelm", n: 1, at: T0, ready: T0 + 12 * HOUR}]};
  ok("  a lot put in under the old 12 hours finishes on the new time", !C.advance(s, T0 + HOUR + 1000).recycle.lots.length);
}

/* ---- the screen ---- */
{
  ok("the recycle stash and its materials store are in the store room, by the barrels (painted on since Cam's repaint, 2026-10-12)", sameArr(PLACES.storeroom.recycle, {at: [1012, 470, 240, 116], o: [1000, 720]}) && sameArr(PLACES.storeroom.recycled.at, [1243, 808, 340, 66]));
  ok("  both open their own sheet", PET.includes('if (key === "recycle") return recycleHTML(') && PET.includes('if (key === "recycled") return recycledHTML(') && PET.includes("wireRecycle(card);"));
  ok("a game without a stash plays exactly as before (no recycle state made by time passing)", !("recycle" in C.advance(fresh(), T0 + 30 * HOUR)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
