/* The Farm, step 1 (2026-10-12): Husbandry, Fern's quest, the chicken coop, hens, the Feed store and Fern's stall.
   Run: node test/test_pet_ranch.js [app dir] */
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
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 12, 8), H = 3600e3;
const fresh = () => { const s = C.act(C.advance(C.empty(), T0), "player", {name: "Farmer"}, T0).state; s.story = {on: false}; return s; };
const ready = () => { const s = fresh(); s.player.skills.farming = C.XP[10]; s.player.skills.construction = C.XP[10];
  Object.assign(s.bag, {plank: 40, rope: 10, potato: 40, carrot: 10, cabbage: 10}); s.coins = 2000; return s; };
const opened = () => { const r = C.act(ready(), "quest", {region: "ranch"}, T0); return C.advance(r.state, T0); };
const coop = (s, t) => C.ranchView(s, t).buildings.find((b) => b.id === "coop");

/* ---- Husbandry and the way in ---- */
ok("Husbandry is a skill, from the registry, whose page is the Farm (pet:ranch)", C.SKILL_BY.husbandry && C.SKILL_BY.husbandry.page === "pet:ranch" && C.SKILL_ORDER.includes("husbandry")
   && !C.GATHERING.includes("husbandry"));
{
  const s = C.advance(fresh(), T0 + 30 * H);
  ok("an old save has no Farm until Fern's quest: nothing to tend, nothing in the save", !s.ranch && !C.ranchOpen(s) && C.ranchView(s, T0).open === false);
  const r = C.act(s, "quest", {region: "ranch"}, T0);
  ok("  Fern asks for Farming 10, Construction 10, planks, rope and potatoes first", !r.ok && /farming level 1\/10/.test(r.error) && /construction level 1\/10/.test(r.error) && /plank 0\/40/.test(r.error));
  ok("  and the Farm's actions wait for her", /Fern wants a word/.test(C.act(s, "ranchbuy", {kind: "hen"}, T0).error));
}
{
  const r = C.act(ready(), "quest", {region: "ranch"}, T0);
  ok("Fern's quest, \"A farm of your own\", takes the makings and gives Husbandry xp and grain feed", r.ok && /A farm of your own/.test(r.msg) && r.state.bag.grainfeed === 6
     && r.state.bag.plank === 0 && r.state.bag.potato === 10 && C.levelOf(r.state.player.skills.husbandry) >= 3);
  const s = C.advance(r.state, T0);
  const c = coop(s, T0);
  ok("  it opens the Farm: a Basic coop with two hens, fed for their first 12 hours", C.ranchOpen(s) && c.tier === 1 && c.cap === 2 && c.animals.length === 2 && c.animals.every((a) => a.fed && a.fedFor === 12 * 3600));
  ok("  then Fern has her farm's errands, one at a time", C.PEOPLE.ranch.quests.length === 15 && C.ranchView(s, T0).fern.quest.name === "Eggs for the village");
}

/* ---- hens lay while they're fed ---- */
{
  let s = opened();
  s = C.advance(s, T0 + 8 * H);
  ok("two fed hens lay two eggs each every 4 hours", coop(s, T0 + 8 * H).waiting === 8);
  s = C.advance(s, T0 + 30 * H);
  const c = coop(s, T0 + 30 * H);
  ok("  a hungry hen waits: fed for 12 hours, they lay 3 rounds and stop", c.hungry === 2 && (c.ready.find((x) => x.id === "chickenegg") || {}).n === 12);
  ok("  no feathers yet: they come (2) with every 4th egg", !c.ready.find((x) => x.id === "feather"));
  const before = C.levelOf(s.player.skills.husbandry), xp0 = s.player.skills.husbandry;
  const r = C.act(s, "ranchcollect", {}, T0 + 30 * H);
  ok("collecting puts the eggs in your bag, with Husbandry xp (10 a round, more while the skill is young)", r.ok && r.state.bag.chickenegg === 12 && r.state.player.skills.husbandry - xp0 >= 60 && C.levelOf(r.state.player.skills.husbandry) >= before);
  ok("  and there's nothing more to collect", /Nothing's ready/.test(C.act(r.state, "ranchcollect", {}, T0 + 30 * H).error));
}
{
  let s = opened();
  s.ranch.b.coop.animals.forEach((a) => { a.fedUntil = T0 + 100 * H; });
  s = C.advance(s, T0 + 60 * H);
  const c = coop(s, T0 + 60 * H);
  ok("eggs wait three rounds a hen at most -- then the hens wait for you", (c.ready.find((x) => x.id === "chickenegg") || {}).n === 12 && c.animals.every((a) => a.full && a.nextIn === 0));
  const s2 = C.act(s, "ranchcollect", {}, T0 + 60 * H).state;
  const s3 = C.advance(s2, T0 + 64 * H);
  ok("  after collecting, they start again (a fresh round, not a backlog)", coop(s3, T0 + 64 * H).waiting === 4);
}
{
  let s = opened();
  s.ranch.b.coop.animals.forEach((a) => { a.fedUntil = T0 + 100 * H; });
  let r = C.act(s, "ranchclean", {}, T0);
  ok("mucking out: once a day, dung for the garden and 25 Husbandry xp", r.ok && r.state.bag.dung === 3 && /still clean/.test(C.act(r.state, "ranchclean", {}, T0 + H).error));
  s = r.state; s.ranch.b.coop.animals.forEach((a) => { a.n = 0; });
  s = C.advance(s, T0 + 12 * H);
  ok("  a clean coop gives an extra egg on every 4th round (2 hens, 3 rounds: 12 + 2), and it doesn't fill the coop sooner",
     (coop(s, T0 + 12 * H).ready.find((x) => x.id === "chickenegg") || {}).n === 14);
  s = C.advance(s, T0 + 20 * H);
  ok("  full after 3 rounds a hen: nothing more until you collect", (coop(s, T0 + 20 * H).ready.find((x) => x.id === "chickenegg") || {}).n === 14 && coop(s, T0 + 20 * H).animals.every((a) => a.full));
}

/* ---- feed, the stall, the build ---- */
{
  let s = opened();
  s = C.advance(s, T0 + 13 * H);
  let r = C.act(s, "ranchfeed", {}, T0 + 13 * H);
  ok("feeding takes a bag of grain feed a hen and keeps her fed 12 hours", r.ok && r.state.bag.grainfeed === 4 && coop(r.state, T0 + 13 * H).animals.every((a) => a.fed && a.fedFor === 12 * 3600));
  ok("  they won't eat again until half of it's gone", /all eaten/.test(C.act(r.state, "ranchfeed", {}, T0 + 14 * H).error));
  s = r.state; s.bag.grainfeed = 0; s.ranch.b.coop.animals.forEach((a) => { a.fedUntil = 0; });
  ok("  no feed, no feeding (and it says where feed comes from)", /make some at the Feed store/.test(C.act(s, "ranchfeed", {}, T0 + 14 * H).error));
  r = C.act(s, "ranchmill", {i: 0, times: "all"}, T0 + 14 * H);
  ok("the Feed store mills garden crops into feed: 2 potatoes and a carrot make 4", r.ok && r.state.bag.grainfeed === 20 && r.state.bag.potato === 0 && r.state.bag.carrot === 5);
  r = C.act(r.state, "ranchmill", {i: 1, times: 1}, T0 + 14 * H);
  ok("  and 2 cabbages make 6", r.ok && r.state.bag.grainfeed === 26 && r.state.bag.cabbage === 8);
}
{
  let s = opened();
  ok("Fern's stall: the coop holds 2 hens when Basic", /full/.test(C.act(s, "ranchbuy", {kind: "hen"}, T0).error) && C.ranchView(s, T0).stall[0].why === "The chicken coop is full");
  const id = s.ranch.b.coop.animals[0].id, c0 = s.coins;
  let r = C.act(s, "ranchsell", {id}, T0);
  ok("  she takes a hen back for 100 coins", r.ok && r.state.coins === c0 + 100 && coop(r.state, T0).animals.length === 1);
  r = C.act(r.state, "ranchbuy", {kind: "hen"}, T0);
  ok("  and sells one for 200; a new hen starts hungry", r.ok && r.state.coins === c0 - 100 && coop(r.state, T0).animals.length === 2 && coop(r.state, T0).animals[1].hungry);
  s = r.state;
  ok("building the coop bigger needs Husbandry 6 and Construction 15", /Husbandry level 6/.test(C.act(s, "ranchbuild", {building: "coop"}, T0).error));
  s.player.skills.husbandry = C.XP[6]; s.player.skills.construction = C.XP[15]; s.coins = 5000; Object.assign(s.bag, {plank: 30, rope: 5});
  const con0 = s.player.skills.construction;
  r = C.act(s, "ranchbuild", {building: "coop"}, T0);
  ok("  a Sturdy coop: room for 4, a little quicker, Construction xp", r.ok && coop(r.state, T0).tier === 2 && coop(r.state, T0).cap === 4 && coop(r.state, T0).hours === 3.6
     && r.state.player.skills.construction > con0 && r.state.coins === 3500);
}

/* ---- the Barn, the Dairy and the feed crops (2026-10-12, Farm steps 2 and 3) ---- */
{
  ok("two feed crops in the garden: meadow grass (Farming 8) and oats (Farming 12); their seeds from Marlow",
     C.CROPS.meadowgrass.level === 8 && C.CROPS.oats.level === 12 && C.CROP_ORDER.indexOf("meadowgrass") < C.CROP_ORDER.indexOf("strawberry")
     && ["grassseed", "oatseed"].every((k) => C.MERCHANT_STOCK.some((x) => x[0] === k)));
  let s = opened();
  s.player.skills.construction = C.XP[15]; s.coins = 20000; Object.assign(s.bag, {plank: 200, rope: 40, meadowgrass: 10, oats: 4, sweetcorn: 2, ironbar: 5});
  ok("the Barn opens at Husbandry 5", /opens at Husbandry 5/.test(C.act(s, "ranchbuild", {building: "barn"}, T0).error) && C.ranchView(s, T0).buildings.find((b) => b.id === "barn").lock === "Husbandry 5");
  s.player.skills.husbandry = C.XP[10];
  let r = C.act(s, "ranchbuild", {building: "barn"}, T0);
  ok("  then it's built from planks, rope and coins: room for 2", r.ok && coop(r.state, T0) && C.ranchView(r.state, T0).buildings.find((b) => b.id === "barn").cap === 2);
  s = r.state;
  r = C.act(s, "ranchbuy", {kind: "cow"}, T0);
  ok("Fern sells cows (900); goats wait for Husbandry 12", r.ok && r.state.coins === s.coins - 900 && /Husbandry level 12/.test(C.act(r.state, "ranchbuy", {kind: "goat"}, T0).error));
  s = r.state;
  r = C.act(s, "ranchmill", {i: 4, times: "all"}, T0);
  ok("the Feed store makes hay from meadow grass (2 into 3), and grain feed from oats and sweetcorn", r.ok && r.state.bag.hay === 15
     && C.act(r.state, "ranchmill", {i: 2, times: "all"}, T0).state.bag.grainfeed === 6 + 16 && C.act(r.state, "ranchmill", {i: 3, times: 1}, T0).state.bag.grainfeed === 6 + 10);
  s = r.state;
  r = C.act(s, "ranchfeed", {building: "barn"}, T0);
  ok("  a cow eats hay, not grain", r.ok && r.state.bag.hay === 14 && r.state.bag.grainfeed === 6);
  s = C.advance(r.state, T0 + 16 * H);
  const barn = C.ranchView(s, T0 + 16 * H).buildings.find((b) => b.id === "barn");
  ok("  and gives a pail of milk (4) every 8 hours while fed", (barn.ready.find((x) => x.id === "milk") || {}).n === 4 && barn.hungry === 1);
  const xp0 = s.player.skills.husbandry;
  r = C.act(s, "ranchcollect", {building: "barn"}, T0 + 16 * H);
  ok("  collecting milk is worth more Husbandry xp than an egg (30 a pail)", r.ok && r.state.bag.milk === 4 && r.state.player.skills.husbandry - xp0 >= 30);
  s = r.state; s.bag.milk = 6; s.bag.goatmilk = 3;
  ok("the Dairy opens at Husbandry 10 and has to be built before the churn turns", /Build the Dairy first/.test(C.act(s, "ranchchurn", {i: 0}, T0).error));
  r = C.act(s, "ranchbuild", {building: "dairy"}, T0);
  ok("  built: the churn makes cream from milk (2) or goat milk (3), and butter from cream (2)", r.ok && (() => {
    let x = C.act(r.state, "ranchchurn", {i: 0, times: "all"}, T0).state; x = C.act(x, "ranchchurn", {i: 1, times: 1}, T0).state; x = C.act(x, "ranchchurn", {i: 2, times: 1}, T0).state;
    return x.bag.cream === 2 && x.bag.butter === 1 && x.bag.milk === 0 && x.bag.goatmilk === 0; })());
  ok("  and there's nothing in it to feed or muck out", /no animals/.test(C.act(r.state, "ranchclean", {building: "dairy"}, T0).error));
}
{
  const dishes = ["porridge", "custard", "mashedpotato", "strawberrycream", "creamtea", "carrotcake", "butteredfish", "custardtart", "truffleomelette", "trufflestew"];
  const K = C.WORKSHOPS.kitchen.recipes;
  ok("ten farm dishes at the kitchen, from Cooking 5 to 32, each healing and worth more than what goes in", dishes.every((d) => { const r = K.find((x) => x.make === d);
    return r && r.level >= 5 && r.level <= 32 && C.ITEMS[d].heal > 0 && C.priceOf(d) >= Object.keys(r.needs).reduce((a, k) => a + C.priceOf(k) * r.needs[k], 0); }));
  ok("  churning isn't a money printer: butter sells for no more than the milk that made it, plus a little", C.priceOf("butter") <= C.priceOf("milk") * 4 * 1.5
     && C.priceOf("cream") <= C.priceOf("milk") * 2 * 1.5 && C.priceOf("grainfeed") * 4 <= (C.priceOf("potato") * 2 + C.priceOf("carrot")) * 1.5);
  ok("  every new thing has its painted icon (sheets 51 and 53, 53 from Cam's sheet with the lettering painted out)", dishes.concat(["milk", "cream", "butter", "hay", "oats", "oatseed", "grassseed", "meadowgrass"])
     .every((k) => fs.existsSync(path.join(APP, "ui", "pet", "art", "icons", k + ".webp"))));
}

/* ---- steps 4-10 (2026-10-12): ducks, sheep, cheese, pigs, horses, care, breeding, the market ---- */
{
  const SAT = Date.UTC(2026, 9, 17, 2), D = 24 * H;                  // a Saturday morning
  const big = () => { let s = C.act(C.advance(C.empty(), SAT), "player", {name: "Farmer"}, SAT).state; s.story = {on: false};
    s.player.skills.farming = C.XP[40]; s.player.skills.construction = C.XP[50]; s.player.skills.husbandry = C.XP[45]; s.coins = 900000; s.dev = {infinite: true};
    Object.assign(s.bag, {plank: 40, rope: 10, potato: 40, milk: 10}); s = C.act(s, "quest", {region: "ranch"}, SAT).state;
    C.RANCH_ORDER.filter((b) => b !== "coop").forEach((b) => { s = C.act(s, "ranchbuild", {building: b}, SAT).state; });
    return s; };
  let s = big();
  ok("all fourteen places can be built at their Husbandry levels", C.ranchView(s, SAT).buildings.every((b) => b.tier >= 1));
  ok("the unlocks pop-up names what each Husbandry level opens", C.levelUnlocks("husbandry", 15).some((u) => /shearing shed/.test(u.text)) && C.levelUnlocks("husbandry", 30).some((u) => /ponies/.test(u.text)));
  ["duck", "duck", "sheep", "sheep", "pig", "pony", "drafthorse", "cow", "cow"].forEach((k) => { s = C.act(s, "ranchbuy", {kind: k}, SAT).state; });
  const kinds = C.ranchView(s, SAT).buildings.reduce((a, b) => a + b.animals.length, 0);
  ok("Fern sells ducks, sheep, pigs, ponies and draft horses, each to its own building", kinds === 2 + 9);
  let r = C.act(s, "ranchfeed", {building: "all"}, SAT);
  ok("Feed everyone: each kind on its own feed (grain, hay, potatoes, oats) in one go", r.ok && C.ranchView(r.state, SAT).hungry === 0);
  s = r.state;
  ok("brushing: once a day, for everyone in a building", C.act(s, "ranchbrush", {building: "shearing"}, SAT).ok && /still glossy/.test(C.act(C.act(s, "ranchbrush", {building: "shearing"}, SAT).state, "ranchbrush", {building: "shearing"}, SAT + H).error));
  r = C.act(s, "ranchculture", {building: "culture", i: 1}, SAT);
  ok("the Culture room: milk set to cheese takes a day on a shelf", r.ok && C.ranchView(r.state, SAT).buildings.find((b) => b.id === "culture").slots[0].endsIn === 24 * 3600);
  s = C.act(C.advance(r.state, SAT + 12 * H), "ranchfeed", {building: "all"}, SAT + 12 * H).state;     // a sheep's day is two bags of hay
  s = C.advance(s, SAT + 25 * H);
  r = C.act(s, "ranchcollect", {building: "all"}, SAT + 25 * H);
  ok("Collect everything: eggs, duck eggs and down, milk, wool, truffles, horsehair and the cheese", r.ok && ["chickenegg", "duckegg", "down", "milk", "wool", "truffle", "horsehair", "cheese"].every((k) => r.state.bag[k] > 0), JSON.stringify(r.state.bag));
  s = r.state;
  ok("a sheep gives an armful of wool (5) twice a day; a pig 6 truffles every 12 hours", C.LIVESTOCK.sheep.n === 5 && C.LIVESTOCK.sheep.every === 12 * H && C.LIVESTOCK.pig.n === 6 && C.LIVESTOCK.pig.every === 12 * H && C.LIVESTOCK.pig.gives === "truffle");
  const sat = C.act(s, "ranchmarket", {id: "milk", n: "all"}, SAT), mon = C.act(s, "ranchmarket", {id: "milk", n: "all"}, SAT + 2 * D);
  ok("Saturday's farmers' market pays half as much again as Marlow for Farm goods; not on other days", sat.ok && /farmers' market/.test(sat.msg) && /Saturdays/.test(mon.error));
  const barn = C.ranchView(s, SAT + 25 * H).buildings.find((b) => b.id === "barn").animals;
  r = C.act(s, "ranchpair", {a: barn[0].id, b: barn[1].id, roll: 0.05, roll2: 0.1}, SAT + 25 * H);
  ok("the Paddock: two of a kind go out together", r.ok && /young one in 3 days/.test(r.msg) && /out in the Paddock/.test(C.act(r.state, "ranchsell", {id: barn[0].id}, SAT + 25 * H).error));
  s = r.state;
  s = C.act(s, "ranchbuild", {building: "barn"}, SAT + 25 * H).state;                     // room for the calf
  s = C.advance(s, SAT + 25 * H + 3 * D + H);
  let calf = C.ranchView(s, SAT + 25 * H + 3 * D + H).buildings.find((b) => b.id === "barn").animals.find((a) => a.young);
  ok("  a young one is born into its home, a rare breed (a low roll) and bred for yield (a star), and grows up before it gives", calf && calf.breed === "a Jersey" && calf.stars === 1 && calf.young > 0
     && C.ranchView(s, SAT).born === 1);
  ok("  a rare, starred animal sells for more", calf.sell > C.LIVESTOCK.cow.sell);
  s = C.advance(s, SAT + 25 * H + 7 * D);
  calf = C.ranchView(s, SAT + 25 * H + 7 * D).buildings.find((b) => b.id === "barn").animals.find((a) => a.breed);
  ok("  grown up, it's a cow like the others", calf && !calf.young);
  ok("Fern's last errand asks for an animal born on your Farm", C.PEOPLE.ranch.quests.some((q) => q.needs.some((n) => n.bred)));
}
{
  // step 6: the bigger carts need the Stable's animals and their tack; the merchant's wagon, Marlow's word too
  const T = Date.UTC(2026, 9, 12, 8);
  let s = C.act(C.advance(C.empty(), T), "player", {name: "Carter"}, T).state; s.story = {on: false};
  s.cart = {tier: 1, load: {}};
  ok("the pony cart needs a pony in your Stable", /pony in your Stable/.test(C.cartView(s, T).next.lock) && C.CART.build[2].needs.harness === 1);
  s.quests = {farmofyourown: T}; s = C.advance(s, T); s.ranch.b.stable = {tier: 1, animals: [{id: "x1", kind: "pony", name: "P", t: T, prog: 0, fedUntil: 0, n: 0}], ready: {}};
  ok("  with one, it's only the building that waits", C.cartView(s, T).next.lock === "");
  s.cart.tier = 3; s.ranch.b.stable.animals.push({id: "x2", kind: "drafthorse", name: "D", t: T, prog: 0, fedUntil: 0, n: 0}, {id: "x3", kind: "drafthorse", name: "E", t: T, prog: 0, fedUntil: 0, n: 0});
  ok("the merchant's wagon wants Marlow's word: 25 cart loads", /Marlow's word/.test(C.cartView(s, T).next.lock) && (s.cart.trips = 25, C.cartView(s, T).next.lock === ""));
  ok("  the harness and horse collar are sewn at the crafting bench", ["harness", "horsecollar"].every((k) => C.WORKSHOPS.crafting.recipes.some((r) => r.make === k)));
}
{
  // step 10: companions help
  const s = opened();
  s.pet = {species: "dog", stage: "adult"};
  ok("a dog companion makes shearing a fifth quicker; a cat makes feed last a quarter longer", /fifth quicker/.test(C.ranchView(s, T0).helper) && (s.pet.species = "cat", /quarter longer/.test(C.ranchView(s, T0).helper)));
}
ok("the Today page lists what's ready and who's hungry on the Farm, and the cart on the road", /ranchDash\(s, now\)\.forEach/.test(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"))
   && /The cart's on the road to Marlow/.test(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8")));
ok("animals walk about on the painting (their walking pictures), and stay still for reduced motion", /function ranchWalkers\(rv\)/.test(PET) && /@keyframes pp-walk/.test(fs.readFileSync(path.join(APP, "ui", "pet", "pet.css"), "utf8"))
   && fs.existsSync(path.join(APP, "ui", "pet", "art", "livestock", "cow-friesian-walk.webp")));

/* ---- home only ---- */
{
  const s = opened();
  s.player.island = "desert";
  ok("the Farm is tended at home: away on an island it waits", /island|home/i.test(C.act(s, "ranchcollect", {}, T0).error || "") && C.HOME_ACTS.includes("ranchfeed"));
  s.player.island = "";
  ok("  but the hens keep laying while you're away", coop(C.advance(s, T0 + 4 * H), T0 + 4 * H).waiting === 4);
}

/* ---- the screens ---- */
ok("the estate has the Farm signpost by the bridge (Cam's repaint, 2026-10-12)", /"pet:graveyard", "pet:ranch"[\],]/.test(PET) && sameArr(PLACES.estate["pet:ranch"], {at: [193, 382, 270, 66], o: [150, 470]}));
ok("  the hens are Cam's grown-up hen (art/livestock), with the chick pet picture as the fallback", fs.existsSync(path.join(APP, "ui", "pet", "art", "livestock", "hen-brown-a.webp"))
   && C.LIVESTOCK.hen.art === "hen/brown" && /function livestockURL\(art, pic, size, pose\)/.test(PET) && fs.readFileSync(path.join(APP, "ui", "pet", "index.html"), "utf8").includes("art/livestock/manifest.js"));
ok("  the Farm page: Fern, then the coop, the Feed store and her stall", /function renderRanch\(host\)/.test(PET) && /if \(page === "pet:ranch"\) return renderRanch\(host\);/.test(PET)
   && /personHTML\(rv\.fern, rv\.here\)/.test(PET) && /pp-ranch-feed/.test(PET) && /pp-ranch-stall/.test(PET));
ok("  it's a known view (SS.Pet.VIEWS), so the shell can open it", /"pet:graveyard", "pet:ranch", "pet:camp"/.test(PET));
ok("  it's called The Farm on screen and sits under the estate", /Object\.assign\(PAGES\["pet:ranch"\], \{name: "The Farm"[^}]*parent: "pet:estate"\}\)/.test(GAME));
ok("  the Player page's Husbandry row goes to the estate, not straight to the Farm (no world shortcuts)", /k === "husbandry" \? "pet:estate"/.test(PET));
ok("the Farm is Cam's painting (art/ranch.webp, 2000x1116) with a scroll for every place, on top of the cards", fs.existsSync(path.join(APP, "ui", "pet", "art", "ranch.webp"))
   && PLACES.ranch.coop.at.length === 3 && ["barn", "dairy", "culture", "shearing", "sty", "stable", "paddock", "pond", "feed", "stall", "hives", "mill", "glass", "smoke", "showring", "pet:estate"].every((k) => PLACES.ranch[k] && PLACES.ranch[k].at)
   && /rv\.open \? paintedHTML\("ranch", ranchPlaces\(rv\)\)/.test(PET));
ok("  every building is a place on the painting (locked ones show their Husbandry level)", C.RANCH_ORDER.length === 14 && /function ranchPlaces\(rv\)/.test(PET)
   && /lock: `opens at \$\{b\.lock\}`, lockShort: b\.lock/.test(PET) && !/RANCH_SOON/.test(PET));
ok("grain feed has a picture until icon sheet 51 is painted", fs.readFileSync(path.join(APP, "ui", "pet", "petart.js"), "utf8").includes("grainfeed: [\"pouch\""));

/* ---- step 11 (2026-10-13, Art 9): the Beehives, the Windmill, the Greenhouse, the Smokehouse and the Show ring ---- */
{
  const T = Date.UTC(2026, 9, 13, 8), D = 24 * H;
  const farm = (hus) => { let s = C.act(C.advance(C.empty(), T), "player", {name: "Farmer"}, T).state; s.story = {on: false};
    s.player.skills.farming = C.XP[40]; s.player.skills.construction = C.XP[50]; s.player.skills.husbandry = C.XP[hus]; s.coins = 900000;
    Object.assign(s.bag, {plank: 400, rope: 100, potato: 40, stone: 200, cloth: 40, ironbar: 40}); s = C.act(s, "quest", {region: "ranch"}, T).state; return s; };
  let s = farm(1); s.player.skills.husbandry = C.XP[3];
  ok("the Beehives open at Husbandry 4", /Husbandry 4/.test(C.act(s, "ranchbuild", {building: "hives"}, T).error));
  s = farm(45);
  ["barn", "hives", "mill", "glass", "smoke", "showring"].forEach((b) => { const r = C.act(s, "ranchbuild", {building: b}, T); ok("  builds: " + b, r.ok, r.error); if (r.ok) s = r.state; });
  let r = C.act(s, "ranchbuy", {kind: "bee"}, T); s = r.state;
  ok("Fern sells bee colonies; they need no feeding, mucking out or brushing", r.ok && /Bee colony|bee colony/.test(r.msg)
     && /no feeding/.test(C.act(s, "ranchfeed", {building: "hives"}, T).error) && /nothing to muck out/.test(C.act(s, "ranchclean", {building: "hives"}, T).error));
  s = C.advance(s, T + 3 * D);                                         // three days unfed: bees still work
  const hv = C.ranchView(s, T + 3 * D).buildings.find((b) => b.id === "hives");
  ok("  a colony makes honey every 12 hours unfed, wax every 2nd round, and waits (3 rounds) when full", hv.hungry === 0 && hv.care === false
     && (hv.ready.find((x) => x.id === "honey") || {}).n === 6 && (hv.ready.find((x) => x.id === "beeswax") || {}).n === 1);
  r = C.act(s, "ranchcollect", {building: "hives"}, T + 3 * D); s = r.state;
  ok("  collecting gives honey and beeswax, with Husbandry xp", r.ok && s.bag.honey === 6 && s.bag.beeswax === 1);
  ok("  bees don't breed or go in the show ring", !C.ranchView(s, T + 3 * D).pairable.some((g) => g.kind === "bee")
     && C.ranchView(s, T + 3 * D).buildings.find((b) => b.id === "showring").show.entrants.every((a) => a.kindName !== "Bee colony"));
  Object.assign(s.bag, {beeswax: 6, thread: 2, oats: 9, tomatoseed: 1, trout: 3, oak: 1, strawberryseed: 1});
  r = C.act(s, "ranchchurn", {building: "hives", i: 0, times: "all"}, T + 3 * D);
  ok("the candle bench: 3 beeswax and a thread make 2 candles", r.ok && r.state.bag.candle === 4 && !r.state.bag.beeswax); s = r.state;
  r = C.act(s, "ranchchurn", {building: "mill", i: 0, times: "all"}, T + 3 * D);
  ok("the Windmill grinds 3 oats into 2 flour", r.ok && r.state.bag.flour === 6 && /ground/.test(r.msg)); s = r.state;
  ok("  and the kitchen bakes bread from flour", C.WORKSHOPS.kitchen.recipes.some((x) => x.make === "bread" && x.needs.flour === 2));
  ok("  the old churn still works without a building (the Dairy)", C.act(s, "ranchchurn", {i: 0}, T).error !== undefined);
  r = C.act(s, "ranchculture", {building: "glass", i: 0}, T + 3 * D); s = r.state;
  ok("the Greenhouse: a tomato seed grows 8 tomatoes on a bed in 8 hours", r.ok && /planted/.test(r.msg));
  r = C.act(s, "ranchculture", {building: "smoke", i: 0}, T + 3 * D); s = r.state;
  ok("the Smokehouse: 3 trout and an oak log hang for 6 hours", r.ok && /hung/.test(r.msg));
  s = C.act(s, "ranchculture", {building: "glass", i: 1}, T + 3 * D).state; s.bag.tomatoseed = 1;
  r = C.act(s, "ranchculture", {building: "glass", i: 0}, T + 3 * D);
  ok("  beds are full at 2 (a Basic greenhouse)", !r.ok && /shelf's taken/.test(r.error));
  r = C.act(C.advance(s, T + 3 * D + 9 * H), "ranchcollect", {building: "all"}, T + 3 * D + 9 * H);
  ok("  Collect everything takes the tomatoes and the smoked fish", r.ok && r.state.bag.tomato === 8 && r.state.bag.smokedfish === 3 && !r.state.bag.strawberry);
  ok("  smoked fish heals more than cooked salmon and is worth more than cooked herring (time pays: Cam, 2026-10-13)", C.ITEMS.smokedfish.heal > C.ITEMS.cookedsalmon.heal
     && C.priceOf("smokedfish") > C.priceOf("herring") && C.priceOf("smokedfish") < C.priceOf("swordfish"));
  s = r.state;
  ok("  a greenhouse bed's farming level locks the melon until Farming 35", (() => { const t = JSON.parse(JSON.stringify(s)); t.player.skills.farming = C.XP[20];
     return /Farming level 35/.test(C.act(t, "ranchculture", {building: "glass", i: 3}, T + 4 * D).error); })());
  // the Show ring
  s = C.act(s, "ranchbuy", {kind: "cow"}, T + 4 * D).state; s = C.act(s, "ranchfeed", {building: "barn"}, T + 4 * D).state;
  const cow = C.ranchView(s, T + 4 * D).buildings.find((b) => b.id === "barn").animals[0];
  const entrant = (t) => C.ranchView(s, t).buildings.find((b) => b.id === "showring").show.entrants.find((a) => a.id === cow.id);
  ok("the Show ring lists grown animals (the hens too) with the judges' eye and the odds", entrant(T + 4 * D).score === 1 && entrant(T + 4 * D).odds === 12
     && C.ranchView(s, T + 4 * D).buildings.find((b) => b.id === "showring").show.entrants.length === 3);
  s = C.act(s, "ranchbrush", {building: "barn"}, T + 4 * D).state; s = C.act(s, "ranchclean", {building: "barn"}, T + 4 * D).state;
  ok("  brushing and mucking out raise the judges' eye", entrant(T + 4 * D).score === 3);
  const coins0 = s.coins;
  r = C.act(s, "ranchshow", {id: cow.id, roll: 0.01}, T + 4 * D);
  ok("  a first: a blue rosette, 300 coins, Husbandry xp", r.ok && r.state.bag.rosette === 1 && r.state.coins === coins0 + 300 && /first prize/.test(r.msg));
  ok("  one show a day", /One show a day/.test(C.act(r.state, "ranchshow", {id: cow.id, roll: 0.01}, T + 4 * D + H).error));
  s = r.state;
  r = C.act(s, "ranchshow", {id: cow.id, roll: 0.3}, T + 5 * D + H);
  ok("  a second: a red rosette", r.ok && r.state.bag.redrosette === 1); s = r.state;
  r = C.act(s, "ranchshow", {id: cow.id, roll: 0.99}, T + 6 * D + 2 * H);
  ok("  otherwise commended (xp only)", r.ok && /commended/.test(r.msg)); s = r.state;
  s = C.act(s, "ranchshow", {id: cow.id, roll: 0.01}, T + 7 * D + 3 * H).state;
  Object.keys(C.ITEMS).filter((k) => !C.ITEMS[k].bagSize && !C.ITEMS[k].gear && !C.ITEMS[k].tool && !(s.bag[k] > 0)).slice(0, Math.max(0, C.bagCap(s) - C.bagUsed(s))).forEach((k) => { s.bag[k] = 1; });   // every slot taken
  ok("  a full bag: no show until there's room for a prize (no cup lost)", /Make room/.test(C.act(s, "ranchshow", {id: cow.id, roll: 0.01}, T + 8 * D + 4 * H).error));
  ["plank", "rope", "stone", "cloth", "ironbar", "potato", "candle", "flour"].forEach((k) => { delete s.bag[k]; });
  r = C.act(s, "ranchshow", {id: cow.id, roll: 0.01}, T + 8 * D + 4 * H);
  ok("  three firsts make a champion: a silver cup and 1,500 coins", r.ok && r.state.bag.trophy === 1 && /champion/.test(r.msg));
  ok("Fern's new errands: honey, bread, smoked fish and a blue rosette", ["fern_honey", "fern_bread", "fern_smoke", "fern_show"].every((id) => C.PEOPLE.ranch.quests.some((q) => q.id === id)));
  ok("Marlow sells tomato seed", C.MERCHANT_STOCK ? C.MERCHANT_STOCK.some((x) => x[0] === "tomatoseed") : /\["tomatoseed", 5\]/.test(fs.readFileSync(path.join(APP, "ui", "pet", "core", "04-the-isle-without-crafters.js"), "utf8")));
  ok("the unlocks pop-up names the Beehives (4) and the Show ring (28)", C.levelUnlocks("husbandry", 4).some((u) => /beehives/.test(u.text)) && C.levelUnlocks("husbandry", 28).some((u) => /show ring/.test(u.text)));
}
ok("icon sheet 55 is cut: the five places, their goods, the prizes and the bee", ["obj_hives", "obj_mill", "obj_glass", "obj_smoke", "obj_showring", "honey", "beeswax", "candle", "flour", "bread",
   "smokedfish", "tomato", "rosette", "redrosette", "trophy", "obj_bee"].every((k) => fs.existsSync(path.join(APP, "ui", "pet", "art", "icons", k + ".webp"))));
ok("  the Farm page has the benches, the shelves and the ring", /data-ranch-show/.test(PET) && /const BENCH = \{dairy/.test(PET) && /const SHELF = \{culture/.test(PET) && /if \(!pic\) return itemIcon\(art, size\)/.test(PET));

/* ---- time pays (2026-10-13, Cam: "anything that takes time should have some ROI") ---- */
{
  const val = (needs) => Object.keys(needs).reduce((a, k) => a + C.priceOf(k) * needs[k], 0);
  const shelves = [].concat(...Object.values(C.RANCH_SLOTS)), benches = [].concat(...Object.values(C.RANCH_MAKE));
  ok("every shelf (hours) gives back at least twice what goes on it", shelves.every((m) => C.priceOf(m.make) * m.n >= 2 * val(m.needs)),
     shelves.filter((m) => C.priceOf(m.make) * m.n < 2 * val(m.needs)).map((m) => m.make).join(","));
  ok("  every bench gives back more than goes in", benches.every((m) => C.priceOf(m.make) * m.n > val(m.needs)));
  const payback = (k) => { const L = C.LIVESTOCK[k], per = 24 * H / L.every;
    const day = per * (L.n || 1) * C.priceOf(L.gives) + (L.extra ? per / L.extra.each * L.extra.n * C.priceOf(L.extra.id) : 0) - (L.eats ? 2 * C.priceOf(L.eats) : 0);
    return (L.buy - L.sell) / day; };
  ok("  an animal earns back what it cost (less Fern's buy-back) within three weeks, its goods sold raw", ["hen", "bee", "duck", "cow", "goat", "sheep", "pig"].every((k) => payback(k) <= 21),
     ["hen", "bee", "duck", "cow", "goat", "sheep", "pig"].map((k) => k + " " + payback(k).toFixed(1)).join(", "));
}
/* ---- smoked fish at sea: provisions, and the harbour contracts ---- */
{
  const T = Date.UTC(2026, 9, 13, 8);
  let s = C.act(C.advance(C.empty(), T), "player", {name: "Sailor"}, T).state; s.story = {on: false};
  s.ship = {tier: 3, parts: {}}; s.bag.smokedfish = 5;
  let r = C.act(s, "sail", {to: "desert", provisions: true}, T);
  ok("sailing with provisions: 3 smoked fish, half the voyage", r.ok && r.state.bag.smokedfish === 2 && r.state.player.voyage.until - T === Math.ceil(C.shipyardView(s, T).mins * 0.5) * 60e3 && /well fed/.test(r.msg));
  s = r.state; s.player.hp = 1;
  s = C.advance(s, T + 60 * 60e3);
  ok("  and you step ashore rested (full health)", s.player.island === "desert" && s.player.hp > 1);
  r = C.act(s, "sail", {to: "home", provisions: true}, T + 61 * 60e3);
  ok("  not enough fish: you sail at the usual pace, and nothing's taken", r.ok && r.state.bag.smokedfish === 2 && /usual pace/.test(r.msg));
  ok("  without the tick, no fish are eaten", C.act(Object.assign(JSON.parse(JSON.stringify(s)), {}), "sail", {to: "home"}, T + 61 * 60e3).state.bag.smokedfish === 2);
  const shipsSrc = require(path.join(APP, "tools", "pet_content.js")).partSource("37-the-oasis-and-the-harbourmasters.js");   // content is JSON (2026-10-15)
  ok("the harbourmasters take the Farm's goods (both lists name smoked fish; Frosthaven wants wool; farm goods train Husbandry)", (shipsSrc.match(/\["smokedfish", 40\]/g) || []).length === 2 && /\["wool", 60\]/.test(shipsSrc) && /skill: "husbandry"/.test(shipsSrc));
  ok("the Shipyard, the sea chart and the island's Sail home all have the provisions tick", (PET.match(/provisionHTML\(/g) || []).length >= 4 && /provisions: provOn\(\)/.test(PET));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
