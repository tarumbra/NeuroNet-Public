/* Battle Re-work Part 11a (2026-10-16): battle pets and the Beast Pen -- the hatch choice (home pet or battle pet, once),
   Warden Briar moving den pets in for coins (Q10: they can't go back), types, battle levels and stats, idle training on fed
   hours (never past battle level 30 on its own), rest cut short by food, more stalls. Run: node test/test_pet_beastpen.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
const PLACES = fs.readFileSync(path.join(APP, "ui", "pet", "art", "places.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 16, 8), H = 3600e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
/** A game with a companion and `kinds` freshly hatched in the den. */
function game(kinds) {
  let s = A(C.advance(C.empty(), T0 - 3 * 24 * H), "player", {name: "Tester"}, T0 - 3 * 24 * H).state; s.story = {on: false};
  s = A(s, "hatch", {egg: "starter", roll: 0.3}, T0 - 3 * 24 * H).state;
  (kinds || []).forEach((k, i) => s.hatchery.push({kind: k, egg: "starter", started: T0 - 24 * H, hatchAt: T0 - 1000 * (i + 1)}));
  return C.advance(s, T0);
}

console.log("\nThe hatch choice\n");
{
  let s = game(["cat/ginger", "wolf/grey"]);
  ok("a newly hatched pet arrives in the den asking: home pet or battle pet", s.den.length === 2 && s.den.every((q) => q.choose) && C.petsView(s, T0).filter((p) => p.choose).length === 2);
  ok("  the companion isn't asked", !C.petsView(s, T0).find((p) => p.companion).choose);
  ok("  the hatch note says so", s.log.some((l) => /keep it at home, or send it to the Beast Pen/.test(l.text)));
  const id = s.den[0].id;
  let r = A(s, "petkeep", {id});
  ok("Keep at home: it stays, and isn't asked again", r.ok && !r.state.den.find((q) => q.id === id).choose);
  ok("  then moving it to the Pen costs coins (it isn't new any more)", C.penMovePrice(r.state.den.find((q) => q.id === id)) === C.BEAST_PEN.move.Common);
  const id2 = s.den[1].id;
  r = A(s, "penmove", {id: id2});
  ok("To the Beast Pen while it's new: free", r.ok && r.state.coins === s.coins && r.state.beasts.length === 1 && !r.state.den.find((q) => q.id === id2), r.error);
  const b = r.state.beasts[0];
  ok("  a battle pet keeps its kind and colouring, starts at battle level 1, and leaves its home needs behind", b.species === "wolf" && b.colour === "grey" && C.beastLevel(b) === 1 && !b.s && !b.skills);
  ok("  there's no way back to the den (Q10)", !Object.keys(C).some((k) => /^penback|^beastHome/.test(k)) && A(r.state, "petkeep", {id: id2}).error);
  let s2 = A(game(["cat/ginger"]), "companion", {id: game(["cat/ginger"]).den[0].id}).state;
  ok("making a new pet your companion answers the question too", !s2.pet.choose);
}

console.log("\nWarden Briar: moving a den pet in\n");
{
  let s = game(["snake/green"]); const id = s.den[0].id;
  s = A(s, "petkeep", {id}).state;
  ok("an old den pet costs coins by its rarity", A(s, "penmove", {id}).error && /coins/.test(A(s, "penmove", {id}).error));
  s.coins = 5000;
  const price = C.penMovePrice(s.den[0]);
  let r = A(s, "penmove", {id});
  ok("  with the coins: it moves in, and they're paid", r.ok && r.state.coins === 5000 - price && r.state.beasts.length === 1, r.error);
  ok("  your companion can't be moved", /companion/.test(A(s, "penmove", {id: s.pet.id}).error));
  s.den[0].job = {skill: "foraging"};
  ok("  nor a pet that's out gathering", /gathering/.test(A(s, "penmove", {id}).error));
  let f = game(["cat/ginger"]); f.beasts = Array.from({length: 6}, (_, i) => ({id: "b" + i, species: "cat", colour: "ginger", xp: 0}));
  ok("  nor any when the stalls are full (6 to start)", /full/.test(A(f, "penmove", {id: f.den[0].id}).error));
}

console.log("\nTypes, levels and stats\n");
{
  const six = Object.keys(C.BEAST_TYPES).filter((k) => k !== "//" && k !== "astral");   // (plus the Astral egg's neutral type, V10)
  ok("six types, each strong against two", six.length === 6 && six.every((k) => C.BEAST_TYPES[k].strong.length === 2) && !C.BEAST_TYPES.astral.strong.length);
  const weakTo = (t) => Object.keys(C.BEAST_TYPES).filter((k) => k !== "//" && C.BEAST_TYPES[k].strong.includes(t));
  ok("  and each weak to two -- kept small, so it can be learned", six.every((k) => weakTo(k).length === 2) && !weakTo("astral").length);
  const all = new Set(); Object.keys(C.PETS).forEach((k) => all.add(k.split("/")[0]));
  ok("  every species has a type", [...all].every((sp) => C.BEAST_TYPE_OF.species[sp]), [...all].filter((sp) => !C.BEAST_TYPE_OF.species[sp]).join(","));
  ok("  a rare, magic kind is Spirit (a storm owl), its plain kin are not", C.beastType({species: "owl", colour: "storm"}) === "spirit" && C.beastType({species: "owl", colour: "brown"}) === "bird");
  const lo = C.beastStats({species: "wolf", colour: "grey", xp: 0}), hi = C.beastStats({species: "wolf", colour: "grey", xp: C.XP[30]});
  ok("stats grow with battle level", ["health", "attack", "defence", "speed"].every((k) => hi[k] > lo[k]), JSON.stringify([lo, hi]));
}

console.log("\nIdle training and feed\n");
{
  let s = game(["wolf/grey"]); const id = s.den[0].id;
  s = A(s, "penmove", {id}).state;
  s = A(s, "pentrain", {id, stat: "attack"}).state;
  let later = C.advance(s, T0 + 10 * H);
  ok("training without feed does nothing", (later.beasts[0].xp || 0) === 0);
  ok("  filling the troughs with nothing to fill them says where feed comes from", /Feed store/.test(A(s, "penfeed").error));
  s.bag.grainfeed = 10;
  let r = A(s, "penfeed");
  ok("fill the troughs: a day's feed, one per 6 hours", r.ok && r.state.bag.grainfeed === 6 && r.state.beasts[0].fedUntil === T0 + 24 * H, r.error || r.state.beasts[0].fedUntil);
  s = r.state;
  later = C.advance(s, T0 + 10 * H);
  const b10 = later.beasts[0];
  ok("  10 fed hours: battle xp and that stat's xp, at the Pen's rate", Math.abs(b10.xp - 10 * C.BEAST_PEN.train[0]) < 1 && Math.abs(b10.stat.attack - 10 * C.BEAST_PEN.train[0]) < 1, JSON.stringify(b10));
  later = C.advance(s, T0 + 40 * H);
  ok("  it stops when the feed runs out (24 hours)", Math.abs(later.beasts[0].xp - 24 * C.BEAST_PEN.train[0]) < 1);
  let cap = JSON.parse(JSON.stringify(s)); cap.beasts[0].xp = C.XP[30] - 10; cap.beasts[0].fedUntil = T0 + 1000 * H;
  cap = C.advance(cap, T0 + 500 * H);
  ok("idle training never takes a pet past battle level 30 (note 06)", C.beastLevel(cap.beasts[0]) === 30 && cap.beasts[0].xp <= C.XP[30]);
  ok("  the trained stat goes up as its training does", C.penView(cap, T0 + 500 * H).beasts[0].trained.attack > 0);
  // Cam (2026-10-17): fed for 23 h, warped an hour in the sandbox, came back -- nothing had moved
  let w = JSON.parse(JSON.stringify(s)); w.dev = {on: true};
  const wr = A(w, "dev", {op: "warp", hours: 1}), wa = C.advance(wr.state, T0);
  ok("the sandbox's time warp moves the Pen on: an hour's training, an hour less feed",
     wr.ok && Math.abs(wa.beasts[0].xp - C.BEAST_PEN.train[0]) < 1 && C.penView(wa, T0).beasts[0].fedLeft === 23 * H, wr.error || JSON.stringify(wa.beasts[0]));
  let rest = JSON.parse(JSON.stringify(s)); rest.dev = {on: true}; rest.beasts[0].restUntil = T0 + 2 * H;
  ok("  and a resting pet's rest", C.penView(A(rest, "dev", {op: "warp", hours: 1}).state, T0).beasts[0].restLeft === H);
}

console.log("\nRest, stalls, names\n");
{
  let s = game(["wolf/grey"]); const id = s.den[0].id;
  s = A(s, "penmove", {id}).state;
  s.beasts[0].restUntil = T0 + C.restFor(s, s.beasts[0]);
  ok("a fainted pet rests: 30 minutes and more for higher levels", C.restFor(s, s.beasts[0]) >= 30 * 60e3 && C.restFor(s, {xp: C.XP[40]}) > C.restFor(s, s.beasts[0]));
  ok("  it can't train while resting", /resting/.test(A(s, "pentrain", {id, stat: "speed"}).error));
  s.bag.grilledtrout = 3;
  const before = s.beasts[0].restUntil, r = A(s, "penrest", {id, item: "grilledtrout"});
  ok("  food used in the Pen cuts its rest", r.ok && r.state.beasts[0].restUntil < before && r.state.bag.grilledtrout === 2, r.error);
  ok("more stalls need Construction and coins", /Construction 20/.test(A(s, "penup").error));
  s.player.skills.construction = C.XP[20]; s.coins = 6000;
  const u = A(s, "penup");
  ok("  with both: 12 stalls, and training goes quicker", u.ok && C.penView(u.state, T0).stalls === 12 && C.penView(u.state, T0).rate > C.BEAST_PEN.train[0], u.error);
  ok("name a battle pet", A(s, "penname", {id, name: "Fang"}).state.beasts[0].name === "Fang");
}

console.log("\nThe page\n");
{
  ok("the Beast Pen is a place at the estate, with Warden Briar", /"pet:pen": \{"at"/.test(PLACES) && /function renderPen/.test(PET) && C.WARDEN.name === "Warden Briar");
  ok("  the Pets page asks the hatch choice", /data-petkeep/.test(PET) && /data-topen/.test(PET));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
