/* The golden game (2026-10-10 audit, H-1): a scripted day of NeuroPets -- an egg hatched, gathering, a hunt with gear and
   food, crafting, the store room, a den pet out gathering, a duplicate merged -- walked forward 24 hours with fixed seeds.
   Its fingerprint must not change when the code is reorganised. When a change is MEANT to alter the rules (balance, new
   rules), update it:  node test/test_pet_golden.js --update   and say so in the commit.
   Run: node test/test_pet_golden.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");
const args = process.argv.slice(2), UPDATE = args.includes("--update");
const APP = args.find((a) => !a.startsWith("--")) || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
C.STORY_SWITCH.gates = false;   // the golden day predates the story's gates; the story has its own tests (test_pet_story.js)
const GOLD = path.join(__dirname, "fixtures", "pet_golden.json");
const T0 = Date.UTC(2026, 9, 1, 6), MIN = 60e3, HOUR = 3600e3;
const steps = [];
let s = C.advance(C.empty(), T0);
const act = (t, a, o) => { const r = C.act(s, a, o || {}, t); steps.push(a + ":" + (r.ok ? "ok" : "no")); if (r.ok) s = r.state; return r; };

act(T0, "player", {name: "Golden", look: {skin: 1, hair: 2, outfit: 0}});
act(T0, "hatch", {egg: "starter", roll: 0.42});
s = C.advance(s, T0 + 2 * HOUR);
act(T0 + 2 * HOUR, "name", {name: "Goldie"});
act(T0 + 2 * HOUR, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.11});
s = C.advance(s, T0 + 4 * HOUR);
act(T0 + 4 * HOUR, "home");
act(T0 + 4 * HOUR, "trip", {skill: "mining", spot: "stonewall", roll: 0.23});
s = C.advance(s, T0 + 5 * HOUR);
act(T0 + 5 * HOUR, "home");
Object.assign(s.bag, {stone: 120, twigs: 200, copper: 60, tin: 60, rawshrimp: 40, cotton: 60});
act(T0 + 5 * HOUR, "craft", {workshop: "crafting", make: "stonepick"});
act(T0 + 5 * HOUR, "craft", {workshop: "furnace", make: "bronzebar"});
act(T0 + 5 * HOUR, "craft", {workshop: "spinning", make: "thread"});
act(T0 + 5 * HOUR, "craft", {workshop: "kitchen", make: "shrimps"});
act(T0 + 5 * HOUR, "store", {item: "cotton", n: "all", chest: 1});
act(T0 + 5 * HOUR, "chestname", {chest: 1, name: "Golden chest"});
s.bag.bronzesword = 1; s.bag.shrimps = 30;
act(T0 + 5 * HOUR, "equip", {item: "bronzesword"});
s.player.food = "shrimps";
act(T0 + 5 * HOUR, "hunt", {ground: "farmyard", roll: 0.57});
s = C.advance(s, T0 + 7 * HOUR);
act(T0 + 7 * HOUR, "home");
s.den.push({id: "pdupe1", species: s.pet ? s.pet.species : "chicken", colour: s.pet ? s.pet.colour : "white", hatchAt: T0, at: T0 + 7 * HOUR, xp: 30,
            s: {full: 80, happy: 80, energy: 80, clean: 80, health: 100}});
s.den.push({id: "pdupe2", species: s.pet ? s.pet.species : "chicken", colour: s.pet ? s.pet.colour : "white", hatchAt: T0, at: T0 + 7 * HOUR, xp: 10,
            s: {full: 80, happy: 80, energy: 80, clean: 80, health: 100}});
act(T0 + 7 * HOUR, "pettrip", {id: "pdupe1", skill: "foraging", spot: "hedgerow", roll: 0.31});
act(T0 + 7 * HOUR, "petmerge", {id: "pdupe2", into: s.pet ? s.pet.id : ""});
act(T0 + 7 * HOUR, "feed", {food: "kibble"});
act(T0 + 7 * HOUR, "trip", {skill: "lumbering", spot: "prunings", roll: 0.77});
s = C.advance(s, T0 + 31 * HOUR);

const views = {player: C.playerView(s, T0 + 31 * HOUR), pets: C.petsView(s, T0 + 31 * HOUR), house: C.houseView(s, T0 + 31 * HOUR),
               bench: C.villageView(s, T0 + 31 * HOUR).map((w) => [w.id, w.level, w.recipes.filter((r) => r.can).length])};
const print = JSON.stringify({steps, state: s, views});
const hash = crypto.createHash("sha256").update(print).digest("hex");
if (UPDATE) {
  fs.mkdirSync(path.dirname(GOLD), {recursive: true});
  fs.writeFileSync(GOLD, JSON.stringify({hash, steps, note: "node test/test_pet_golden.js --update after a deliberate rules change"}, null, 2) + "\n");
  console.log("  updated the golden fingerprint: " + hash.slice(0, 16));
  process.exit(0);
}
const gold = JSON.parse(fs.readFileSync(GOLD, "utf8"));
const ok = hash === gold.hash;
console.log(`  ${ok ? "ok  " : "FAIL"}  the golden day plays out exactly as before (${steps.filter((x) => x.endsWith(":ok")).length}/${steps.length} actions ok)` +
            (ok ? "" : `  -- ${hash.slice(0, 16)} vs ${gold.hash.slice(0, 16)}; steps ${JSON.stringify(steps) === JSON.stringify(gold.steps) ? "same" : "differ: " + steps.join(",")}`));
console.log(`\n  ${ok ? 1 : 0} passed, ${ok ? 0 : 1} failed\n`);
process.exit(ok ? 0 : 1);
