/* Field recipes, step 2 (V2, 2026-10-16, the Economist's plan): arrows and bandages for every class, learnt from recipe
   pages (Ash's and Nell's quests, or a rare find on certain creatures); one home per recipe; a bit less xp than a bench.
   Run: node test/test_pet_field_pages.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 16, 8), H = 3600e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
function player(cls, lv) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  ["attack", "ranged", "defence", "hitpoints", "magic"].forEach((k) => { s.player.skills[k] = C.XP[lv || 10]; });
  s.player.hp = C.playerView(s, T0).maxHp;
  return A(s, "class", {cls}).state;
}
const R = (id) => C.FIELD_RECIPES.list.find((r) => r.id === id);

console.log("\nKnowing a recipe\n");
{
  const p = player("paladin");
  ok("a Paladin starts with no field recipes, and four to find on pages (I11: the knapper's page holds two)", C.fieldView(p).length === 0 && C.fieldPagesLeft(p) === 4);
  Object.assign(p.bag, {cloth: 2, herb: 9, arrowshaft: 4, leaflitter: 4});
  ok("cloth with herbs before the page: not yet, and it says where it's written", /Nell's page/.test(A(p, "usewith", {item: "cloth", on: "herb"}).error || ""));
  ok("...and Use with... doesn't offer it", C.fieldPartners(p, "cloth").length === 0);
  const h = player("hunter"); h.bag.bronzeknife = 1;
  ok("a Hunter with a knife knows its four (improvised arrows among them) -- and at Ranged 10 the flint two (I11) -- but not bandages", C.fieldView(h).map((r) => r.id).join() === "whittle,carve,bonearrows,improvise,knap,flintarrows" && C.fieldPagesLeft(h) === 1);
  const h2 = player("hunter");
  ok("a Hunter without a knife: improvised arrows still need the knife or the page", !C.fieldView(h2).some((r) => r.id === "improvise"));
}

console.log("\nReading a page\n");
{
  let p = player("thief");
  Object.assign(p.bag, {pagebandage: 1, cloth: 2, herb: 9});
  let r = A(p, "learn", {item: "pagebandage"});
  ok("reading it teaches Bandages, and the page is used", !r.error && /Bandages/.test(r.msg) && !r.state.bag.pagebandage && r.state.player.fieldPages.bandage, r.error);
  p = r.state;
  ok("the bag lists it now", C.fieldView(p).some((x) => x.id === "bandage" && x.can));
  ok("Use with...: cloth lights up the herbs", C.fieldPartners(p, "cloth").some((x) => x.id === "herb"));
  p.bag.pagebandage = 1;
  ok("a second copy: you know it already", /already/.test(A(p, "learn", {item: "pagebandage"}).error || ""));
  const cx = p.player.skills.crafting || 0;
  r = A(p, "usewith", {item: "herb", on: "cloth"});
  ok("cloth and herbs, either way round: 2 bandages a cloth, 3 herbs each", !r.error && r.state.bag.bandage === 4 && !r.state.bag.cloth && r.state.bag.herb === 3, r.error || JSON.stringify(r.state.bag));
  ok("...with a little Crafting xp", r.state.player.skills.crafting > cx);
  p = r.state;
  ok("nothing left to tear: it says so", /no cloth/.test(A(p, "usewith", {item: "herb", on: "cloth"}).error || "") || /Nothing happens/.test(A(p, "usewith", {item: "herb", on: "cloth"}).error || ""));
  p.player.hp = 2;
  r = A(p, "eat", {item: "bandage"});
  ok("a bandage heals, and says it plainly", !r.error && /You bound a wound with a bandage \(\+7 health\)/.test(r.msg) && r.state.player.hp === 9, r.msg);
  let q = player("berserker");
  Object.assign(q.bag, {pageimprovise: 1, arrowshaft: 5, leaflitter: 3});
  q = A(q, "learn", {item: "pageimprovise"}).state;
  r = A(q, "usewith", {item: "arrowshaft", on: "leaflitter"});
  ok("Ash's notes: a Berserker makes improvised arrows (no knife needed)", !r.error && r.state.bag.improvisedarrow === 3 && r.state.bag.arrowshaft === 2, r.error);
  let h = player("hunter"); Object.assign(h.bag, {bronzeknife: 1, arrowshaft: 4, leaflitter: 4});
  const fx = h.player.skills.fletching || 0, old = A(h, "improvise").state;     // the Hunter's own rule, as it was
  r = A(h, "usewith", {item: "leaflitter", on: "arrowshaft"});
  ok("a Hunter's improvised arrows: as before (4 arrows, the same Fletching xp as the old button)", !r.error && r.state.bag.improvisedarrow === 4 && r.state.player.skills.fletching - fx === old.player.skills.fletching - fx && r.state.player.skills.fletching > fx, r.error);
}

console.log("\nThe team's conditions\n");
{
  const benches = new Set([].concat(...Object.keys(C.WORKSHOPS).map((w) => (C.WORKSHOPS[w].recipes || []).map((r) => r.make))));
  const field = C.FIELD_RECIPES.list.map((r) => r.makes);
  // one home per RECIPE (QA): a field recipe's ingredients make nothing the same on a bench (arrow shafts: twigs and oak in the bag, birch at the bench -- PT12 x2)
  const same = C.FIELD_RECIPES.list.filter((r) => Object.keys(C.WORKSHOPS).some((w) => (C.WORKSHOPS[w].recipes || []).some((b) => b.make === r.makes && r.on.some((k) => (b.needs || {})[k]))));
  ok("one home: no field recipe is also a bench's recipe (QA)", !same.length, same.map((r) => r.id).join());
  ok("...and the new ones aren't made on any bench at all", ["bandage", "improvisedarrow"].every((m) => !benches.has(m)));
  ok("every page names a real recipe, and every page recipe has a page item", C.FIELD_RECIPES.list.filter((r) => r.page).every((r) => C.ITEMS[r.page] && C.FIELD_RECIPES.list.some((x) => x.id === C.ITEMS[r.page].learn.field && x.page === r.page)));   // (a page may hold two: I11)
  const cloth = C.WORKSHOPS.crafting.recipes.find((r) => r.make === "cloth");
  ok("a bit less than a bench (the Mathematician): a bandage's xp a cloth is under two-thirds of what making that cloth gave", 2 * R("bandage").xp / 2 <= cloth.xp * 2 / 3 + 1e-9, cloth.xp);
  ok("worth at least its inputs (the Economist): 2 bandages >= a cloth and 3 herbs", 2 * C.priceOf("bandage") >= C.priceOf("cloth") + 3 * C.priceOf("herb"), [C.priceOf("bandage"), C.priceOf("cloth"), C.priceOf("herb")].join());
  ok("not in a boss fight (the Combat Designer)", (() => { let p = player("thief"); p.player.fieldPages = {bandage: 1}; Object.assign(p.bag, {cloth: 1, herb: 3}); p.player.battle = {kind: "boss"};
    return /boss fight/.test(A(p, "usewith", {item: "cloth", on: "herb"}).error || ""); })());
}

console.log("\nWhere pages come from\n");
{
  ok("Ranger Ash's \"Too many legs\" gives Ash's notes", C.PEOPLE.forest.quests.find((q) => q.id === "spiders").reward.items.pageimprovise === 1);
  ok("Beekeeper Nell's \"Stung\" gives her bandage page", C.PEOPLE.meadow.quests.find((q) => q.id === "stung").reward.items.pagebandage === 1);
  Object.keys(C.FIELD_PAGES).forEach((pg) => ok(`${pg}: carried by real creatures, about one kill in ${Math.round(1 / C.FIELD_PAGES[pg].chance)}`,
    C.FIELD_PAGES[pg].from.every((m) => C.MONSTERS[m]) && C.FIELD_PAGES[pg].chance > 0 && C.FIELD_PAGES[pg].chance < 0.02));
  // a Berserker hunting the Meadow (foxes, hares, wildcats, stray dogs) for a long day finds both pages, once each
  let s = player("berserker", 30);
  Object.assign(s.bag, {ironsword: 1, cookedtrout: 0});
  s = A(s, "equip", {item: "ironsword"}).state;
  let got = {pageimprovise: 0, pagebandage: 0}, kills = 0;
  for (let h = 0; h < 24 && !(got.pageimprovise && got.pagebandage); h++) {
    const r = A(s, "hunt", {ground: "meadow"}, T0 + h * H);
    if (r.error) break;
    s = C.advance(r.state, T0 + (h + 1) * H);
    const j = s.player.lastTrip || {};
    kills += j.count || 0;
    Object.keys(got).forEach((k) => { got[k] = s.bag[k] || 0; });
    s.player.hp = C.playerView(s, T0).maxHp;
  }
  ok("a day's hunting on the right ground turns up both pages", got.pageimprovise === 1 && got.pagebandage === 1, JSON.stringify(got) + " after " + kills + " kills");
  ok("...one each (no more while you carry it)", got.pageimprovise <= 1 && got.pagebandage <= 1);
  ok("...and the diary says where it came from", s.log.some((l) => /had something tucked away/.test(l.text || "")));
}

console.log("\nThe screens\n");
ok("Use with... says where a recipe's page comes from (the Kit's bag; the Bag page went 2026-10-20)", typeof C.fieldPagesLeft === "function" && PET.includes("Core.fieldWhy(s, bagUse)") && /fieldPageWhere/.test(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8")));
ok("a page reads like a scroll (Read it)", (() => { const p = player("thief"); p.bag.pagebandage = 1; const v = C.bagList ? C.bagList(p) : null; return !v || [].concat(v).some((x) => x && x.id === "pagebandage" && x.kind === "scroll"); })());

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
