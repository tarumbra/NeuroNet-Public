/* Life at home (2026-10-08, Cam: "All this sounds amazing"): the hearth's pot, the dining table's Well fed, the
   forbidden archive (Grizz's key, torn pages from exploring, rewards), the reading chair, the ancient stacks'
   research, the observatory's stars. Small bonuses, one at a time. Run: node test/test_pet_home.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
C.NOVICE.splice(0);   // exact base xp here; the novice bonus is tested in test_pet_balance.js
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const MIN = 60000, HOUR = 60 * MIN;
const NOON = new Date(2026, 9, 8, 12, 0).getTime(), NIGHT = new Date(2026, 9, 8, 22, 0).getTime();
function fresh(t) { const s = C.advance(C.empty(), t || NOON); s.player.made = true; s.player.name = "Tester"; return s; }

/* ---- the hearth ---- */
{
  let s = fresh(); Object.assign(s.bag, {berry: 10, rawshrimp: 6, apple: 4});
  ok("a pot takes 3 to 8 ingredients", C.act(s, "pot", {items: {berry: 2}}, NOON).error && C.act(s, "pot", {items: {berry: 9}}, NOON).error);
  ok("  only things that go in a stew", /doesn't go in a stew/.test(C.act(Object.assign(fresh(), {bag: {stone: 5}}), "pot", {items: {stone: 3}}, NOON).error || ""));
  let r = C.act(s, "pot", {items: {rawshrimp: 3, apple: 2}}, NOON); s = r.state;
  ok("  the ingredients go in, one pot at a time", r.ok && s.bag.rawshrimp === 3 && s.bag.apple === 2 && C.act(s, "pot", {items: {berry: 3}}, NOON).error);
  ok("  not ready before 45 minutes", !C.act(s, "potcollect", {}, NOON + 30 * MIN).ok);
  r = C.act(s, "potcollect", {}, NOON + 46 * MIN); s = r.state;
  ok("  then a bowl for each ingredient, and a little Cooking xp", r.ok && s.bag.thinstew === 5 && s.player.skills.cooking > 0, JSON.stringify(s.bag));
  let s2 = fresh(); s2.bag.richfood = 0; Object.assign(s2.bag, {shrimps: 4, trout: 4});
  ok("  better ingredients, a better stew", C.act(s2, "pot", {items: {shrimps: 4}}, NOON).state.home.pot.stew === "heartystew");
  ok("  a stew heals more than the things in it, cooked", C.ITEMS.thinstew.heal > C.ITEMS.shrimps.heal && C.ITEMS.richstew.heal >= 16);
}
/* ---- the table ---- */
{
  let s = fresh(); Object.assign(s.bag, {shrimps: 2, heartystew: 1, rawshrimp: 2});
  ok("raw food isn't a meal", !!C.act(s, "dine", {food: "rawshrimp"}, NOON).error);
  let r = C.act(s, "dine", {food: "heartystew"}, NOON); s = r.state;
  ok("  a meal: Well fed for an hour, more xp for a better dish (stews a little extra)", r.ok && s.home.fed.xp === 0.08 && s.home.fed.until === NOON + HOUR, JSON.stringify(s.home.fed));
  const a = fresh(), b = fresh();
  b.home = {fed: {food: "heartystew", xp: 0.08, until: NOON + HOUR}, pages: {}, done: {}, claimed: []};
  let ra = C.act(a, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.3}, NOON).state, rb = C.act(b, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.3}, NOON).state;
  ra = C.advance(ra, NOON + 20 * MIN); rb = C.advance(rb, NOON + 20 * MIN);
  ok("  Well fed adds to your xp (8% here)", rb.player.skills.foraging > ra.player.skills.foraging * 1.06 && rb.player.skills.foraging < ra.player.skills.foraging * 1.1,
     ra.player.skills.foraging + " vs " + rb.player.skills.foraging);
  r = C.act(r.state, "dine", {food: "shrimps"}, NOON + 10 * MIN);
  ok("  one meal at a time: a new one takes over", r.state.home.fed.food === "shrimps" && r.state.home.fed.xp === 0.02);
}
/* ---- the archive ---- */
{
  let s = fresh();
  ok("the archive's locked without the key", /Grizz/.test(C.act(s, "archive", {}, NOON).error || ""));
  ok("  Grizz carries it", /archivekey = 1/.test(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8")) && /forbidden archive/.test(C.itemInfo(fresh(), "archivekey").does || JSON.stringify(C.itemInfo(fresh(), "archivekey"))));
  s.bag.archivekey = 1;
  s.home = {pages: {farmyard: NOON, pasture: NOON, meadow: NOON}, done: {}, claimed: []};
  const coins = s.coins || 0;
  let r = C.act(s, "archive", {}, NOON); s = r.state;
  ok("  the key opens it (and is used up); 3 pages already found pay out", r.ok && s.home.archive && !s.bag.archivekey && s.coins === coins + 750, s.coins);
  // a page from exploring
  let e = fresh(); e.home = {pages: {}, done: {}, claimed: [], archive: NOON};
  let found = 0;
  for (let i = 0; i < 40 && !found; i++) {
    let t = NOON + i * HOUR;
    let x = C.act(e, "explore", {region: "farmyard", roll: i / 40}, t);
    if (!x.ok) break;
    e = C.advance(x.state, t + 31 * MIN);
    found = Object.keys(e.home.pages).length;
  }
  ok("  exploring turns up a region's torn page, now and then", found === 1 && e.home.pages.farmyard);
  ok("  one page a region, eleven in all", Object.keys(C.LORE).length === 11);
}
/* ---- the reading chair ---- */
{
  let s = fresh();
  let r = C.act(s, "read", {skill: "foraging"}, NOON); s = r.state;
  ok("reading: half an hour by the fire", r.ok && s.home.reading.until === NOON + 30 * MIN);
  const x0 = s.player.skills.foraging;
  s = C.advance(s, NOON + 31 * MIN);
  ok("  then a little xp in that skill", s.player.skills.foraging - x0 === 21 && !s.home.reading, s.player.skills.foraging - x0);
  let t = C.act(fresh(), "trip", {skill: "foraging", spot: "hedgerow", roll: 0.3}, NOON).state;
  ok("  not while you're out", /come home first/.test(C.act(t, "read", {skill: "foraging"}, NOON).error || ""));
  let rd = C.act(fresh(), "read", {skill: "mining"}, NOON).state;
  rd = C.act(rd, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.3}, NOON + MIN).state;
  ok("  setting off puts the book down (no xp)", !rd.home.reading && C.advance(rd, NOON + 40 * MIN).player.skills.mining === 0);
}
/* ---- the ancient stacks ---- */
{
  let s = fresh(); s.coins = 10000; s.bag.plank = 40;
  ok("research costs coins and planks", !C.act(Object.assign(fresh(), {coins: 0}), "research", {id: "satchel"}, NOON).ok);
  ok("  (balance 2026-10-08) and a sturdy library first -- fine for level 2, grand for 3", /sturdy library/.test(C.act(s, "research", {id: "satchel"}, NOON).error || ""));
  s.house.library = 2;
  let r = C.act(s, "research", {id: "satchel"}, NOON); s = r.state;
  ok("  one project at a time", r.ok && !!C.act(s, "research", {id: "nets"}, NOON).error && s.coins === 9000 && s.bag.plank === 20);
  s = C.advance(s, NOON + 3 * HOUR + 1000);
  ok("  done after its hours: a roomier bag", s.home.done.satchel === 1 && C.bagCap(s) === 28);   // 25 + 3 (I8, 2026-10-19)
  let a = fresh(), b = fresh(); b.home = {pages: {}, done: {baskets: 3}, claimed: []};
  const ja = C.act(a, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.3}, NOON).state.player.job, jb = C.act(b, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.3}, NOON).state.player.job;
  ok("  better baskets: quicker foraging (9% at level 3)", Math.abs(ja.every / jb.every - 1.09) < 0.01, ja.every + " / " + jb.every);
  let m = fresh(); m.home = {pages: {}, done: {maps: 2}, claimed: []};
  ok("  old maps: better odds exploring", C.exploreChance(m, "farmyard") === 0.45);
}
/* ---- the observatory ---- */
{
  let s = fresh(NIGHT);
  ok("no stars by day", /too bright/.test(C.act(fresh(), "stargaze", {}, NOON).error || ""));
  let r = C.act(s, "stargaze", {roll: 0.05}, NIGHT); s = r.state;
  ok("  at night: the week's constellation, +10% to its skill until morning, and stardust from a shooting star",
     r.ok && s.home.star.until === new Date(2026, 9, 9, 6, 0).getTime() && s.bag.stardust === 2 && C.STARS.some((x) => x[1] === s.home.star.skill));
  ok("  once a night", /tonight/.test(C.act(s, "stargaze", {}, NIGHT + 3 * HOUR).error || "") && C.act(s, "stargaze", {roll: 0.9}, NIGHT + DAY()).ok);
  function DAY() { return 24 * HOUR; }
  ok("  stardust enchants gems at the enchanting table, instead of runes", C.WORKSHOPS.enchanting.recipes.some((x) => x.make === "enchantedopal" && x.needs.stardust));
  const v = C.homeView(s, NIGHT);
  ok("homeView has it all", v.stars.buff && v.archive.total === 11 && v.research.length === 7 && v.books.length > 10);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
