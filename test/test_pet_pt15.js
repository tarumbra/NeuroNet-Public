/* Cam's PT15 notes (2026-10-18, the Necromancer play test): the sandbox's sky switch (c2) and a way to lay a pet to rest (r1); Old
   Salt's boat asks the same Fishing level as the crossing to the Misty Isle, and the Coast's deep water needs a boat; a beaten
   mage at the tower has a word for you (n1). Run: node test/test_pet_pt15.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const H = 3600e3, DAY = 24 * H;
const at = (h) => new Date(2026, 9, 18, h, 0, 0).getTime();          // local hours, as the game reads them
const A = (s, a, o, t) => C.act(s, a, o || {}, t || at(12));
function fresh(dev) {
  let s = A(C.advance(C.empty(), at(12)), "player", {name: "T"}).state; s.story = {on: false}; s.tutorial = {step: 0, done: true};
  if (dev) s.dev = {on: true};
  return s;
}

console.log("\nThe sandbox's sky (PT15 c2)\n");
{
  let s = fresh(true);
  ok("by default the sandbox follows the clock", (C.advance(s, at(12)), !C.isNight(at(12))) && (C.advance(s, at(23)), C.isNight(at(23))));
  s = A(s, "dev", {op: "sky", sky: "night"}).state;
  C.advance(s, at(12));
  ok("Night: it's night at noon", C.isNight(at(12)) && s.dev.sky === "night");
  s = A(s, "dev", {op: "sky", sky: "day"}).state; C.advance(s, at(23));
  ok("Day: it's day at 11 pm", !C.isNight(at(23)));
  s = A(s, "dev", {op: "sky", sky: ""}).state; C.advance(s, at(23));
  ok("Real clock again", C.isNight(at(23)) && !s.dev.sky);
  const real = fresh(false); real.dev = {sky: "night"};               // a real game never has a sky, even with a stray setting
  C.advance(real, at(12));
  ok("the real game ignores it", !C.isNight(at(12)));
  ok("  and outside the sandbox the tool says no", A(fresh(false), "dev", {op: "sky", sky: "night"}).ok === false);
  let n = fresh(true); n = A(n, "dev", {op: "sky", sky: "night"}).state; C.advance(n, at(12));
  const mons = C.HUNTS.hollowcrypt.monsters.filter((m) => m[2] === "night").map((m) => m[0]);
  ok("  the crypt's night creatures are the ones the switch brings out", mons.includes("wraith") && mons.includes("wisp"));
  ok("  Dev tools has the switch; the scenes and the crypt's backdrop follow it", /data-sky=/.test(PET) && /function sandboxSky\(\)/.test(PET) && /Core\.isNight\(now\) \? "hollowcrypt-night"/.test(PET));
}

console.log("\nLaying a pet to rest from the sandbox (PT15 r1)\n");
{
  let s = fresh(true);
  s = A(s, "dev", {op: "flags", instantHatch: true}).state;
  let r = A(s, "hatch", {egg: "starter", roll: 0.3});
  if (r.ok) s = C.advance(r.state, at(12) + 2 * DAY);
  const had = s.pet && C.view(s, at(12) + 2 * DAY).stage !== "egg";
  if (had) {
    r = A(s, "dev", {op: "bury"}, at(12) + 2 * DAY);
    ok("your pet goes to the Graveyard, the whole pet kept for raising", r.ok && !r.state.pet && r.state.graveyard[0].pet && r.state.graveyard[0].cause === "laid to rest from the sandbox", r.error);
  } else ok("(a hatched pet to bury)", false, JSON.stringify(r.error || ""));
  s = fresh(true);
  s.beasts = [{id: "Fang", name: "Fang", species: "wolf", colour: "grey", born: at(0) - 9 * DAY, hatchAt: at(0) - 9 * DAY, joined: at(0), xp: C.XP[20], stat: {}, train: "", trainAt: 0, fedUntil: 0, restUntil: 0, wins: 0, faints: 0},
              {id: "loan-beastmaster-1", name: "Bramble", species: "bear", colour: "brown", loan: "beastmaster", xp: C.XP[5]}];
  r = A(s, "dev", {op: "bury", beast: "Fang"});
  ok("a battle pet goes to the Graveyard with its battle level", r.ok && !r.state.beasts.some((b) => b.id === "Fang") && r.state.graveyard[0].battle && r.state.graveyard[0].level >= 1, r.error);
  ok("  a tutor's loaned pet can't be", A(s, "dev", {op: "bury", beast: "loan-beastmaster-1"}).ok === false);
  ok("  only in the sandbox", A(Object.assign(fresh(false), {beasts: s.beasts}), "dev", {op: "bury", beast: "Fang"}).ok === false);
  ok("  Dev tools has the picker", /id="dv-bury"/.test(PET) && /op: "bury"/.test(PET));
}

console.log("\nOld Salt's boat and the deep water (PT15 n1)\n");
{
  const boat = C.PEOPLE.coast.quests.find((q) => q.id === "boat"), lvl = boat.needs.find((n) => n.level).level;
  ok("Old Salt's boat asks the Fishing level the crossing to the Misty Isle asks", lvl[0] === "fishing" && lvl[1] === C.REGIONS.mistyisle.needs.skills.fishing, JSON.stringify(lvl));
  const spots = C.SKILLS.fishing.spots, s = fresh(false);
  s.player.skills.fishing = C.XP[50];
  ["deepwater", "sharkreef"].forEach((id) => {
    const sp = spots.find((x) => x.id === id);
    const lock = C.spotLock(s, "fishing", sp);
    ok(sp.name + ": needs a boat, and says Old Salt helps", /rowboat|rowing boat/i.test(lock) && /Old Salt/.test(lock), lock);
    const s2 = JSON.parse(JSON.stringify(s)); s2.ship = {tier: 1, parts: {}};
    ok("  open with Old Salt's boat", C.spotLock(s2, "fishing", sp) === "", C.spotLock(s2, "fishing", sp));
  });
  const harbour = spots.find((x) => x.id === "harbour");
  ok("  tuna for his first favour still comes from the Harbour, no boat", C.spotLock(s, "fishing", harbour) === "" && harbour.loot.some((l) => l[0] === "rawtuna"));
}

console.log("\nA beaten mage's words (PT15 n1)\n");
{
  const ranks = C.MAGE_RANKS.filter((r) => r.duel);
  ok("every rank's mage has words for you, and the lower ones say your training's paying off", ranks.every((r) => r.beaten && r.beaten.length > 40)
     && ranks.slice(0, 2).every((r) => /training/.test(r.beaten)));
  ok("a won duel records its rank; the battle screen hands it to the tower's popup", /rank: b\.duel/.test(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"))
     && /towerWords\(lb, now\)/.test(PET) && /pp-mage-words/.test(PET));
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
