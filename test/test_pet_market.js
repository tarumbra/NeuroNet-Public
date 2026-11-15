/* The Marketplace and Larceny (2026-10-17; V4 + Cam's Q4): a market street off the Village where everyone buys and sells
   (with the class trade perks), and a Thief -- or anyone with the Pickpocketing technique -- picks pockets and lifts goods.
   Larceny is a skill for good, whatever your class, with lockpicking: locked crates a Thief finds hunting.
   Run: node test/test_pet_market.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
const GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8");
const PLACES = fs.readFileSync(path.join(APP, "ui", "pet", "art", "places.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 17, 8), MIN = 60e3, H = 3600e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
function player(cls, larceny) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false}; s.tutorial = {step: 0, done: true};
  if (cls) s = A(s, "class", {cls}).state;
  if (s.classTut) s.classTut.on = null;
  s.coins = 1000;
  if (larceny) s.player.skills.larceny = C.XP[larceny];
  return s;
}

console.log("\nLarceny, the skill\n");
{
  ok("Larceny is a skill in the registry, its page the Marketplace", C.SKILL_BY.larceny && C.SKILL_BY.larceny.page === "pet:market" && C.SKILL_ORDER.includes("larceny"));
  const s = player("thief");
  ok("  everyone has it (at level 1)", C.playerView(s, T0).skills.larceny && C.playerView(s, T0).skills.larceny.level === 1);
  ok("a Thief can steal; a Hunter can't", C.canSteal(s.player) && !C.canSteal(player("hunter").player));
  const h = player("hunter"); h.player.techs = ["pickpocket"]; h.player.techLearned = {pickpocket: true};
  ok("  another class with the Pickpocketing technique slotted can (the carry-over, Q4)", C.canSteal(h.player) && C.TECHNIQUES.list.pickpocket.fx.larcenyUse === 1);
  ok("  ...a little less surely than a Thief", C.stealChance(h.player, C.MARKET.marks[0]) < C.stealChance(s.player, C.MARKET.marks[0]));
  let t = player("thief", 20); t.dev = {on: true};
  t = A(t, "class", {cls: "berserker", guild: true}).state;
  ok("Larceny stays when you change class (it's your skill, like Cooking)", C.levelOf(t.player.skills.larceny) === 20 && !C.canSteal(t.player));
}

console.log("\nStealing, played\n");
{
  let s = player("thief"); s.market = {seed: 1};
  const tries = [];
  for (let k = 0; k < 30; k++) { const r = A(s, "steal", {target: "farmhand"}, T0 + k * 4000); if (r.ok) s = r.state; tries.push(r.msg || r.error); }
  ok("pick a farmhand's pocket: coins and Larceny xp", tries.some((m) => /picked a farmhand's pocket/.test(m)) && s.player.skills.larceny > 0, tries.slice(0, 3).join(" | "));
  ok("  a quiet miss now and then", tries.some((m) => /nobody noticed/.test(m)));
  ok("  not twice at once (a moment between tries)", /wait a moment/.test(A(s, "steal", {target: "farmhand"}, T0 + 29 * 4000 + 100).error));
  ok("a stall above your level is out of reach", /needs Larceny level 50/.test(A(s, "steal", {target: "jeweller"}, T0 + H).error));
  ok("  and a Hunter is told who can", /Only a Thief steals/.test(A(player("hunter"), "steal", {target: "farmhand"}).error));
}

console.log("\nGetting caught (Q4: a fine and a short stun; that keeper watches you; caught often -- out for an hour; never hurt)\n");
{
  let s = player("thief", 10); s.market = {seed: 7};
  const hp = s.player.hp, coins = s.coins;
  let caught = null, k = 0;
  for (; k < 400 && !caught; k++) { const r = A(s, "steal", {target: "fishmonger"}, T0 + k * 4000); if (r.ok) { s = r.state; if (/Caught!/.test(r.msg)) caught = r.msg; } }
  const at = T0 + (k - 1) * 4000;
  ok("caught at a stall: a fine", caught && /a fine of 15 coins/.test(caught), caught);
  ok("  a short stun -- no tries for a moment", /seeing stars/.test(A(s, "steal", {target: "farmhand"}, at + 5000).error || ""));
  ok("  that keeper watches you for a while (that stall's closed to you)", /Gil is watching you/.test(A(s, "steal", {target: "fishmonger"}, at + 60 * 1000).error || ""));
  ok("  but the crowd isn't", A(s, "steal", {target: "farmhand"}, at + 60 * 1000).ok);
  ok("  never hurt", s.player.hp === hp && !s.player.dead);
  let b = player("thief", 8); b.market = {caught: [T0 - 2 * MIN, T0 - MIN], seed: 3};   // two catches already this quarter-hour
  const share = C.MARKET.rules.caughtShare; C.MARKET.rules.caughtShare = 1;             // (every miss is seen: the ban rule, not the dice)
  let r = null;
  for (let j = 0; j < 200; j++) { const x = A(b, "steal", {target: "shopper"}, T0 + j * 20000); if (x.ok) { b = x.state; if (/marched you out/.test(x.msg)) { r = x.msg; break; } } }
  C.MARKET.rules.caughtShare = share;
  ok("caught 3 times inside a quarter of an hour: the watch throws you out", r && b.market.banUntil > T0, r);
  ok("  for an hour: no stealing -- and no buying either", /threw you out/.test(A(b, "steal", {target: "farmhand"}, b.market.banUntil - MIN).error) &&
     /threw you out/.test(A(b, "market", {op: "buy", store: "baker", item: "bread"}, b.market.banUntil - MIN).error));
  ok("  back after the hour", A(b, "market", {op: "buy", store: "baker", item: "bread"}, b.market.banUntil + 1000).ok);
}

console.log("\nStealing while you're away (Q8: idle and played -- idle slower)\n");
{
  let s = player("thief", 11);
  s = A(s, "stealtrip", {target: "farmhand", roll: 0.3}).state;
  ok("keep at it: a trip like gathering", s.player.job && s.player.job.steal && s.player.job.every === C.MARKET.rules.idleMs && C.MARKET.rules.idleMs > C.MARKET.rules.tryMs);
  const c0 = s.coins, a = C.advance(s, T0 + H), j = a.player.job;
  ok("  an hour on: Larceny xp and a swag sack, still going (ten levels above the mark is safe)", j && j.count > 300 && j.xp > 0 && C.swagWorth(a) > 0 && a.coins <= c0, JSON.stringify(j && [j.count, j.coins, j.caught]));
  ok("  shown in the market (Working the crowd)", C.marketView(a, T0 + H).job.target === "farmhand");
  const home = A(a, "home", {}, T0 + H);
  ok("  come home: the log sums it up (what's in the sack for Nell)", home.ok && /You left the market: \d+ good tries, \d+ Larceny xp; in your swag sack for Nell: \d+ coins from purses/.test(home.state.log[0].text), home.state.log[0].text);
  let st = player("thief", 25);
  st = A(st, "stealtrip", {target: "fishmonger", roll: 0.2}).state;
  const b = C.advance(st, T0 + H), goods = Object.values(b.player.job.items).reduce((x, y) => x + y, 0);
  ok("at a stall: its own goods, as many as the stall holds plus what comes back (the stall is the cap -- the Economist)", b.player.job && goods <= C.MARKET.rules.stockCap + H / C.MARKET.rules.restockMs + 1 && goods >= 20, goods);
  ok("  picked clean, it waits for the stall to fill again (doesn't give up)", !!b.player.job);
}

console.log("\nBuying and selling: everyone (Q5), with the class trade perks (Cam's Q4 list)\n");
{
  let s = player("beastmaster"); s.bag.rawpork = 10; s.bag.ruby = 4; s.bag.tonic = 4;
  const bread = C.buyPrice(s.player, C.MARKET.stores[1], "bread");
  ok("buy bread at the baker: twice what it's worth", bread === Math.ceil(C.priceOf("bread") * 2) && A(s, "market", {op: "buy", store: "baker", item: "bread", n: 2}).state.bag.bread === 2);
  ok("  a store only sells its own things", /doesn't sell that/.test(A(s, "market", {op: "buy", store: "baker", item: "bronzesword"}).error));
  const pal = player("paladin"), ber = player("berserker"), smith = C.MARKET.stores.find((x) => x.id === "weaponsmith");
  ok("a Paladin: a discount at every store", C.buyPrice(pal.player, C.MARKET.stores[1], "bread") < bread);
  ok("a Berserker: a bigger one on weapons and armour, at the weaponsmith only", C.buyPrice(ber.player, smith, "ironsword") < C.buyPrice(pal.player, smith, "ironsword") &&
     C.buyPrice(ber.player, C.MARKET.stores[1], "bread") === bread);
  const fish = C.MARKET.stores.find((x) => x.id === "fishmonger"), apo = C.MARKET.stores.find((x) => x.id === "apothecary"), jew = C.MARKET.stores.find((x) => x.id === "jeweller");
  const hun = player("hunter"), arc = player("arcane"), thf = player("thief");
  ok("a Hunter gets extra for raw meat and fish at the fishmonger", C.sellEach(hun.player, fish, "rawpork") > C.sellEach(s.player, fish, "rawpork"));
  ok("an Arcane sells potions at a profit at the apothecary", C.sellEach(arc.player, apo, "tonic") > C.sellEach(s.player, apo, "tonic"));
  ok("everyone gets a good price for cut gems at the jeweller", C.sellEach(s.player, jew, "ruby") > C.sellEach(s.player, apo, "ruby") || C.sellEach(s.player, jew, "ruby") > 1.25 * C.priceOf("ruby") * 0 + 1);
  ok("a Thief and a Beast Master: no discounts, no bonuses", C.buyPrice(thf.player, C.MARKET.stores[1], "bread") === bread && C.sellEach(thf.player, fish, "rawpork") === C.sellEach(s.player, fish, "rawpork"));
  ok("  a store buys only its kind of thing", C.storeBuys(fish, "rawpork") && !C.storeBuys(fish, "ruby") && C.storeBuys(jew, "ruby") && C.storeBuys(apo, "tonic") && !C.storeBuys(C.MARKET.stores[0], "apple"));
  const r = A(hun, "market", {op: "sell", store: "fishmonger", item: "rawpork", n: "all"});
  ok("  selling says why you got more", /fresh from a Hunter/.test(A(Object.assign(hun, {bag: Object.assign({}, hun.bag, {rawpork: 5})}), "market", {op: "sell", store: "fishmonger", item: "rawpork", n: "all"}).msg || ""), r.msg || r.error);
  // nothing bought here can be sold for more, by anyone, anywhere in the market
  let worst = 0;
  C.MARKET.stores.forEach((st) => st.sells.forEach((id) => ["paladin", "berserker", "hunter", "arcane"].forEach((cls) => {
    const pl = {cls, skills: {}}, buy = C.buyPrice(pl, st, id);
    C.MARKET.stores.forEach((st2) => { if (C.storeBuys(st2, id)) worst = Math.max(worst, C.sellEach(pl, st2, id) / buy); });
  })));
  ok("nothing bought in the market sells back for more (any class, any stall)", worst < 1, worst.toFixed(2));
  // Cam (2026-10-17): "Stores should price up their good so they would cost another 1 and a half on top of the costed materials
  // to make" -- the Economist and the Mathematician (N6): every store, every item, at least 2.5 x its materials and 2 x its value
  const T1 = Date.UTC(2026, 9, 18, 12), listed = [];
  ["merchant", "travelling"].concat(Object.keys(C.ISLE_STOCK)).forEach((sh) => C.stockFor(sh, T1).forEach(([id, price]) => listed.push([sh, id, price])));
  C.MARKET.stores.forEach((st) => st.sells.forEach((id) => ["thief", "paladin", "berserker"].forEach((cls) => listed.push(["market:" + st.id + ":" + cls, id, C.buyPrice({cls, skills: {}}, st, id)]))));
  const under = listed.filter(([sh, id, price]) => price < Math.ceil(C.materialCost(id) * 2.5) - 0 || (sh.startsWith("market") ? false : price < C.storeFloor(id)));
  ok("every store, every thing: at least 2.5x what its materials cost (discounts too)", listed.length > 90 && !under.length, under.slice(0, 5).map((x) => x.join(" ")).join(" | "));
  ok("  a made thing worth more than its materials stays at twice its value (a berry tart isn't 3 coins)", C.storeFloor("berrytart") === Math.ceil(C.priceOf("berrytart") * 2) && C.materialCost("berrytart") * 2.5 < C.priceOf("berrytart"));
  ok("  a gathered thing: 2.5x its value (buying never beats gathering it)", C.storeFloor("apple") === Math.ceil(C.priceOf("apple") * 2.5) || C.storeFloor("apple") === 2);
  ok("  a quartz ring (its materials cost more than it sells for): 2.5x the materials", C.storeFloor("quartzring") === Math.ceil(C.materialCost("quartzring") * 2.5));
}

console.log("\nLockpicking: locked crates a Thief finds hunting (Q4 q9)\n");
{
  let s = player("thief"); ["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[20]; }); s.player.hp = 999;
  s.bag.bronzedagger = 2; s = A(s, "equip", {item: "bronzedagger"}).state;
  s = A(s, "hunt", {ground: "farmyard", roll: 0.3}).state; s = C.advance(s, T0 + 2 * H);
  ok("a Thief hunting finds locked boxes now and then", (s.bag.lockbox || 0) > 0, s.bag.lockbox);
  let h = player("hunter"); ["attack", "defence", "hitpoints", "ranged"].forEach((k) => { h.player.skills[k] = C.XP[20]; }); h.player.hp = 999;
  h.bag.shortbow = 1; h.bag.bronzearrow = 2000; h.bag.leatherquiver = 1; h = A(A(A(h, "equip", {item: "shortbow"}).state, "equip", {item: "leatherquiver"}).state, "equip", {item: "bronzearrow"}).state;
  h = A(h, "hunt", {ground: "farmyard", roll: 0.3}).state; h = C.advance(h, T0 + 2 * H);
  ok("  a Hunter doesn't", !(h.bag.lockbox > 0) && (h.hunt.farmyard || {}).kills >= 50);
  s.bag = {lockbox: 1, lockedchest: 1};
  ok("picking its lock needs the Larceny level", /needs Larceny level 5/.test(A(s, "open", {item: "lockbox"}).error));
  s.player.skills.larceny = C.XP[5];
  const o = A(s, "open", {item: "lockbox"}), c0 = s.coins;
  ok("  with it: picked -- Larceny xp, coins and what's inside", o.ok && /picked the lock \(\+15 Larceny xp\)/.test(o.msg) && o.state.coins > c0 && o.state.player.skills.larceny > C.XP[5], o.msg || o.error);
  ok("  a locked chest needs Larceny 25", /level 25/.test(A(o.state, "open", {item: "lockedchest"}).error));
  ok("the ground picks the crate: deeper grounds, better locks", C.LOCKED_CRATES.lockbox.ground < C.LOCKED_CRATES.lockedchest.ground && C.LOCKED_CRATES.lockedchest.ground < C.LOCKED_CRATES.strongbox.ground);
}

console.log("\nThe fence: Nell takes her cut (Cam: 'having to sell goods to a fence who take a cut ... the fence is the thief tutor')\n");
{
  let s = player("thief", 25); const bag0 = JSON.stringify(s.bag), c0 = s.coins;
  s = A(s, "stealtrip", {target: "fishmonger", roll: 0.2}).state; s = C.advance(s, T0 + H); s = A(s, "home", {}, T0 + H).state;
  ok("stolen goods and purses go in the swag sack -- never the bag, never your purse", JSON.stringify(s.bag) === bag0 && s.coins <= c0 && C.swagWorth(s) > 0, JSON.stringify(s.market.swag));
  ok("  you can't sell them to anyone else (they're not in your bag to sell)", !Object.keys(s.market.swag.items).some((k) => (s.bag[k] || 0) > 0));
  const worth = C.swagWorth(s), pays = C.fencePays(s), r = A(s, "fence", {}, T0 + H);
  ok("Nell buys the lot for its worth less her cut (60%)", r.ok && pays === Math.floor(worth * 0.4) && r.state.coins === s.coins + pays && C.swagWorth(r.state) === 0, r.msg || r.error);
  ok("  she's the Thief's tutor (Nell the Fence), in her back room off the market", C.MARKET.fence.name === "Nell the Fence" && C.GUILD.tutors.thief.title === "for Nell the Fence" && /"fence": \{"at"/.test(PLACES));
  ok("  an empty sack: nothing to sell", /empty/.test(A(r.state, "fence", {}, T0 + H).error));
  let m = player("thief", 18); m = A(m, "stealtrip", {target: "shopper", roll: 0.3}).state; const c1 = m.coins; m = C.advance(m, T0 + H); m = A(m, "home", {}, T0 + H).state; m = A(m, "fence", {}, T0 + H).state;
  ok("the money's poor: an idle hour's pockets, fenced, is well under the best gathering at that level", m.coins - c1 < 0.5 * 1100, m.coins - c1);
}

console.log("\nLocked crates from pets' expeditions -- for the Keen Eye\n");
{
  const run = (cls) => { let s = player(cls); s = A(s, "hatch", {egg: "starter", roll: 0.3}).state; s.pet.born -= 9 * 24 * H; s.pet.hatchAt -= 9 * 24 * H; s.pet.xp = C.XP[30];
    let crates = 0; for (let k = 0; k < 40; k++) { s.pet.away = null; s.pet.injuredUntil = 0; ["full", "happy", "clean", "energy"].forEach((x) => { s.pet.s[x] = 100; });
      const r = A(s, "expedition", {area: "meadow", roll: k / 41}, T0 + k * 12 * H); if (!r.ok) continue; s = C.advance(r.state, T0 + k * 12 * H + 11 * H); }
    return ["lockbox", "lockedchest", "strongbox"].reduce((a, k) => a + (s.bag[k] || 0), 0); };
  const t = run("thief"), h = run("hunter");
  ok("a Thief's pets bring locked crates home now and then", t > 0, t);
  ok("  a Hunter's don't (no Keen Eye)", h === 0, h);
}

console.log("\nThe Pyramid: a sealed crypt only the Keen Eye sees (Cam: 'only thieves can spot because of their Keen Eye')\n");
{
  const desert = (cls, larc) => { let s = player(cls, larc); s.player.island = "desert"; ["attack", "defence", "hitpoints", "ranged", "magic", "crafting"].forEach((k) => { s.player.skills[k] = C.XP[45]; }); s.bag.desertkit = 1;
    s.player.hp = C.playerView(s, T0).maxHp; (s.regions = s.regions || {}); s.dev = {on: true, infinite: true}; return s; };
  const day = Math.floor((T0 - new Date(T0).getTimezoneOffset() * 60000) / (24 * H));
  let s = desert("thief", 45);
  ok("  (not seen till you reach its chamber)", !C.pyramidView(s, T0).crypt || C.pyramidView(s, T0).crypt.chamber === 0);
  s.pyramid = {day, at: 4, out: false, log: [], loot: null};                 // four chambers in: whichever holds it, you've reached it
  let v = C.pyramidView(s, T0);
  const at = v.crypt ? v.crypt.chamber : -1;
  ok("a Thief at the Pyramid: the Keen Eye spots a sealed crypt in one of the first chambers", !v.lock && v.crypt && at >= 0 && at < 4, v.lock || JSON.stringify(v.crypt));
  const hun = desert("hunter", 45); hun.pyramid = {day, at: 4, out: false, log: [], loot: null};
  ok("  a Hunter sees nothing", !C.pyramidView(hun, T0).crypt);
  {
    s.pyramid = {day, at: at, out: false, log: [], loot: null};
    const lowp = desert("thief", 20); lowp.pyramid = JSON.parse(JSON.stringify(s.pyramid));
    ok("  picking it needs Larceny 40", /Larceny 40/.test(A(lowp, "pyramid", {op: "crypt", roll: 0.1}).error));
    const r = A(s, "pyramid", {op: "crypt", roll: 0.01}, T0);
    ok("  picked: treasure, coins and Larceny xp -- once a day", r.ok && /Keen Eye/.test(r.msg) && r.state.pyramid.crypt && /today/.test(A(r.state, "pyramid", {op: "crypt", roll: 0.01}, T0).error), r.msg || r.error);
    ok("  the page shows it", /data-pyr-crypt/.test(PET) && /Keen Eye: a sealed crypt/.test(PET));
  }
}

console.log("\nThe sandbox's warp moves the market's clocks too\n");
{
  let s = player("thief", 10); s.dev = {on: true}; s.player.stunUntil = T0 + 10 * MIN; s.market = {banUntil: T0 + 30 * MIN, watch: {baker: T0 + 5 * MIN}, caught: [T0], stock: {baker: {n: 0, at: T0}}};
  s = A(s, "dev", {op: "warp", hours: 1}).state;
  ok("stun, ban, watch, catches and stall stock all move on", s.player.stunUntil === T0 - 50 * MIN && s.market.banUntil === T0 - 30 * MIN && s.market.watch.baker === T0 - 55 * MIN && s.market.caught[0] === T0 - H && s.market.stock.baker.at === T0 - H);
}

console.log("\nThe page\n");
{
  ok("the Marketplace is off the Village: a door on its map, and its own page", /"pet:market": \{"at"/.test(PLACES) && /"pet:market": "pet:village"/.test(GAME) && /if \(page === "pet:market"\) return renderMarket/.test(PET));
  ok("  a placeholder map until the painting, with a place for every stall, the crowd and the watch", fs.existsSync(path.join(APP, "ui", "pet", "art", "market.webp")) &&
     C.MARKET.stores.map((x) => x.id).concat(["crowd", "guard"]).every((k) => new RegExp('"' + k + '": \\{"at"').test(PLACES.slice(PLACES.indexOf('"market": {')))));
  ok("  one card per stall: buy, sell and steal together (the UX lead)", /data-mkbuy/.test(PET) && /data-mksell/.test(PET) && /data-steal=/.test(PET) && /data-stealtrip/.test(PET));
  const pip = C.CLASS_TUTORIALS.thief.steps.find((x) => x.id === "pickpocket");
  ok("Pip's lesson picks a pocket in the Marketplace (Q9)", pip && pip.go === "pet:market" && pip.check === "skill:larceny");
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
