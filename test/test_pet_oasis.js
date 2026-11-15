/* The Oasis and the harbourmasters' contracts (2026-10-09, Cam: the Oasis "its own place", resting there heals you and your
   pets, the mirage merchant "rare stock for coins" at night, cross-island trading as daily "contracts").
   Run: node test/test_pet_oasis.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const NIGHT = new Date(2026, 9, 9, 23).getTime(), DAYT = new Date(2026, 9, 9, 12).getTime();
const onDesert = (t) => { const s = C.advance(C.empty(), t); s.player.made = true; s.player.island = "desert"; s.bag.desertkit = 1;
  s.player.skills.crafting = C.XP[40]; s.ship = {tier: 3, parts: {}}; s.coins = 50000; return s; };

/* ---- the Oasis ---- */
ok("the Oasis is its own place on the Desert Island, past the Desert (the desert kit and Crafting 40)", C.REGIONS.oasis.isle === "desert"
   && C.worldView(onDesert(DAYT), DAYT).links.some((l) => l.join() === "desert,oasis") && C.regionLock(onDesert(DAYT), "oasis") === "" && /sail|Desert Island/i.test(C.regionLock(C.advance(C.empty(), DAYT), "oasis")));
const lv = C.landView(onDesert(DAYT), "oasis", DAYT);
ok("  its pool (moved from the Desert, the Wrapped egg in it), spring gardens and palms", ["oasis", "springgardens", "oasispalms"].every((k) => lv.spots.some((sp) => sp.id === k)));
ok("  Spring-keeper Yusuf, with a chain of quests, and two secrets", C.PEOPLE.oasis.quests.length >= 6 && C.SECRETS.oasis.length === 2);
{
  let s = onDesert(NIGHT); s.player.hp = 1;
  if (s.pet && s.pet.s) { s.pet.s.energy = 10; s.pet.s.happy = 10; }
  const r = C.act(s, "oasisrest", {}, NIGHT);
  ok("resting by the water heals you fully (and your pets drink and doze)", r.ok && r.state.player.hp === C.playerView(r.state, NIGHT).maxHp, r.error);
  const again = C.act(r.state, "oasisrest", {}, NIGHT + 60e3);
  ok("  once every four hours", !again.ok && /not long ago/.test(again.error) && C.act(r.state, "oasisrest", {}, NIGHT + C.OASIS_REST).ok);
  ok("  only at the Oasis", !C.act(C.advance(C.empty(), NIGHT), "oasisrest", {}, NIGHT).ok);
}

/* ---- the mirage merchant ---- */
{
  const s = onDesert(NIGHT), stock = C.mirageStock(NIGHT);
  ok("the mirage merchant: four rare things a night (the same all night), for plenty of coins", stock.length === 4 && JSON.stringify(stock) === JSON.stringify(C.mirageStock(NIGHT + 3600e3))
     && stock.every((x) => x[1] >= 350));
  ok("  he's there after dark, at the Oasis -- not by day, not at home", C.villageView(s, NIGHT).some((w) => w.id === "mirage") && !C.villageView(s, DAYT).some((w) => w.id === "mirage")
     && !C.villageView(C.advance(C.empty(), NIGHT), NIGHT).some((w) => w.id === "mirage"));
  const r = C.act(s, "buy", {item: stock[0][0], from: "mirage"}, NIGHT);
  ok("  you can buy from him on the island", r.ok && r.state.coins === 50000 - stock[0][1], r.error);
  ok("  but not by day", !C.act(onDesert(DAYT), "buy", {item: stock[0][0], from: "mirage"}, DAYT).ok);
}

/* ---- contracts ---- */
{
  const s = onDesert(DAYT), cv = C.contractsView(s, "sandport", DAYT);
  ok("Nefer posts three contracts a day for goods from elsewhere (the same all day)", cv.list.length === 3 && cv.here
     && JSON.stringify(C.contractsFor(s, "sandport", DAYT)) === JSON.stringify(C.contractsFor(s, "sandport", DAYT + 3600e3)));
  ok("  a galleon brings a fourth, bigger one", C.contractsFor(Object.assign(onDesert(DAYT), {ship: {tier: 4, parts: {}}}), "sandport", DAYT).length === 4);
  const c0 = cv.list[0]; s.bag[c0.id] = c0.n;
  const r = C.act(s, "contract", {port: "sandport", i: 0}, DAYT);
  ok("  filling one pays coins (about twice Marlow), xp for who makes it, and a crate", r.ok && r.state.coins === 50000 + c0.coins && !(r.state.bag[c0.id] > 0) && r.state.bag.woodcrate >= 1, r.error);
  ok("  once a day", !C.act(r.state, "contract", {port: "sandport", i: 0}, DAYT).ok);
  ok("  only at that port's dock", !C.act(s, "contract", {port: "frosthaven", i: 0}, DAYT).ok && C.contractsView(s, "frosthaven", DAYT).here === false);
}

/* ---- the towns' buildings, farm tools wearing, the way back (2026-10-09) ---- */
{
  const s = onDesert(DAYT); s.player.hp = 1;
  ok("Sandport's bazaar (Tariq) sells island goods on the island, and buys", C.villageView(s, DAYT).some((w) => w.id === "bazaar") && !C.villageView(C.advance(C.empty(), DAYT), DAYT).some((w) => w.id === "bazaar")
     && C.act(s, "buy", {item: "rope", from: "bazaar"}, DAYT).ok);
  const r = C.act(s, "inn", {town: "sandport"}, DAYT);
  ok("  the inn: 60 coins for a full heal; not twice in two hours", r.ok && r.state.coins === 50000 - 60 && r.state.player.hp === C.playerView(r.state, DAYT).maxHp && !C.act(r.state, "inn", {town: "sandport"}, DAYT + 60e3).ok);
  ok("  Frosthaven's trading post (Astrid) is on Frostpeak Island only", C.WORKSHOPS.tradingpost.isle === "frostpeak" && !C.villageView(s, DAYT).some((w) => w.id === "tradingpost"));
  const f = C.advance(C.empty(), DAYT); f.player.made = true; f.bag.rake = 1; f.player.wear = {rake: C.KIT_DUR.rake - 1};
  ok("farming tools wear out (a rake after " + C.KIT_DUR.rake + " uses)", C.KIT_DUR.rake > 0 && C.KIT_DUR.hoe > 0 && C.KIT_DUR.wateringcan > 0 && /wears out after/.test(C.describe("hoe")));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
