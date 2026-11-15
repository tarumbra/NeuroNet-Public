/* Pets at work at home, and expedition parties (2026-10-10, audit M-1 and M-2). Run: node test/test_pet_jobs.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
C.STORY_SWITCH.gates = false;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 10, 9);
const stats = () => ({full: 90, happy: 80, energy: 90, clean: 90, health: 100});

/** A grown companion and some grown den pets: [species, level]. */
function game(den = [], {lvl = 6, bedroom = 1} = {}) {
  let s = C.empty();
  s.dev = {on: true};
  s = C.act(s, "dev", {op: "flags", instantHatch: true}, T0).state;
  s = C.act(s, "hatch", {egg: "starter", roll: 0.2}, T0).state;
  s = C.act(s, "dev", {op: "age", days: 10}, T0).state;
  s = C.advance(s, T0);
  delete s.dev;
  s.player.made = true;
  Object.assign(s.pet, {xp: C.XP[lvl], species: "fox", colour: "red", gear: {}, asleep: false, sick: false, s: stats(), at: T0, away: null, injury: null, injuredUntil: 0});
  den.forEach(([sp, l], i) => s.den.push({id: "d" + i, species: sp, colour: C.SPECIES[sp].colours[0], hatchAt: T0 - 20 * 864e5, at: T0, xp: C.XP[l || 1], s: stats()}));
  s.house = Object.assign(s.house || {}, {bedroom});
  return s;
}
const act = (s, a, o, t = T0) => C.act(s, a, o, t);

/* jobs at home */
{
  let s = game([["cow", 3], ["chicken", 3], ["wolf", 3]]);
  ok("a basic bedroom has room for one working pet", C.jobSlots(s) === 1 && C.jobsView(s).slots === 1);
  let r = act(s, "petwork", {id: "d0", work: "gardener"});
  ok("a den pet takes a job", r.ok && r.state.den[0].work === "gardener" && /gardener now/.test(r.msg), r.error);
  s = r.state;
  ok("  a second one doesn't fit until the bedroom is better", /room for 1 working pet/.test(act(s, "petwork", {id: "d1", work: "kitchen"}).error || ""));
  s.house.bedroom = 3;
  ok("  a tier 3 bedroom has room for three", act(s, "petwork", {id: "d1", work: "kitchen"}).ok);
  s = act(s, "petwork", {id: "d1", work: "kitchen"}).state;
  ok("  a one-pet job is taken", /job is taken/.test(act(s, "petwork", {id: "d2", work: "kitchen"}).error || ""));
  ok("  the companion can't work", /Only pets in the den/.test(act(s, "petwork", {id: s.pet.id, work: "keeper"}).error || ""));
  ok("  there's no job like that", /no job like that/.test(act(s, "petwork", {id: "d2", work: "pirate"}).error || ""));
  ok("a cow gardens twice as well (its knack is farming): water, and 20% faster", (() => { const g = C.gardenFx(s); return (g.water && Math.abs(g.speed - 0.8) < 1e-9); })());
  const jv = C.jobsView(s);
  ok("the jobs view lists who does what", jv.used === 2 && jv.jobs.find((j) => j.id === "gardener").who[0].id === "d0" && jv.jobs.length === 6);
  ok("  the pets view says so", C.petsView(s, T0).find((q) => q.id === "d1").workName === "Kitchen hand");
  ok("a working pet can't go gathering", !act(s, "pettrip", {id: "d0", skill: "foraging", spot: "hedgerow", roll: 0.3}).ok);
  r = act(s, "petwork", {id: "d0", work: ""});
  ok("  stopping work frees it", r.ok && !r.state.den[0].work && /stopped working/.test(r.msg), r.error);
  // a store keeper: one more chest
  let k = game([["wolf", 3]]), before = C.houseView(k, T0);
  k = act(k, "petwork", {id: "d0", work: "keeper"}).state;
  ok("a store keeper looks after one more chest", JSON.stringify(C.houseView(k, T0)) !== JSON.stringify(before));
}

/* a hand at the bench: more xp, and an ingredient saved every so often */
{
  const craft = (s) => act(s, "craft", {workshop: "kitchen", make: "shrimps"});
  let plain = game([["chicken", 3]]); plain.bag = {rawshrimp: 40, twigs: 40};
  let hand = game([["chicken", 3]]); hand.bag = {rawshrimp: 40, twigs: 40};
  hand = act(hand, "petwork", {id: "d0", work: "kitchen"}).state;
  const xp = (s) => s.player.skills.cooking || 0;
  const a = craft(plain), b = craft(hand);
  ok("a kitchen hand (a chicken: twice as good) gives more cooking xp", a.ok && b.ok && xp(b.state) > xp(a.state), (a.error || "") + (b.error || "") + " " + xp(a.state) + " vs " + xp(b.state));
  let y = hand, saved = 0;
  for (let i = 0; i < 10; i++) { const r = craft(y); if (!r.ok) break; if (/saved/i.test(r.msg)) saved++; y = r.state; }
  ok("  and saves an ingredient twice in ten crafts (20%), counted the same every time", saved === 2, saved);
  ok("  the counter is whole numbers", Number.isInteger((y.handSave || {}).kitchen));
}

/* parties */
{
  let s = game([["wolf", 6], ["bunny", 6], ["cat", 1], ["chicken", 6]]);
  ok("a pet too low for the area can't go along", /needs to be level/.test(C.partyLock(s, s.den[2], "deepforest", T0) || ""));
  ok("  nor one that can't fly to the Sky", (() => { const w = Object.assign({}, s.den[0], {xp: C.XP[30]}); return /can't fly/.test(C.partyLock(s, w, "sky", T0) || ""); })());
  s.den[3].work = "gardener";
  ok("  nor one at work", /working as/.test(C.partyLock(s, s.den[3], "farm", T0) || ""));
  ok("a party is at most your companion and two", !act(s, "expedition", {area: "farm", party: [{id: "d0", role: "fighter"}, {id: "d1", role: "scout"}, {id: "d3", role: "hauler"}]}).ok);
  ok("  each pet needs a role", /Pick a role/.test(act(s, "expedition", {area: "farm", party: [{id: "d0", role: "boss"}]}).error || ""));
  ok("  and only once", /same pet twice/.test(act(s, "expedition", {area: "farm", party: [{id: "d0", role: "scout"}, {id: "d0", role: "fighter"}]}).error || ""));
  const r = act(s, "expedition", {area: "farm", party: [{id: "d0", role: "fighter"}, {id: "d1", role: "scout"}], roll: 0.4});
  ok("a party sets off, each with its role", r.ok && r.state.den[0].away && r.state.den[0].away.role === "fighter" && r.state.den[1].away.role === "scout", r.error);
  ok("  and the message names them", /fighter/.test(r.msg) && /scout/.test(r.msg), r.msg);
  ok("  party pets can't be sent elsewhere meanwhile", /away/.test(act(r.state, "pettrip", {id: "d0", skill: "foraging", spot: "hedgerow", roll: 0.3}).error || ""));
  ok("  the pets view shows each one's role", C.petsView(r.state, T0).find((q) => q.id === "d0").party === "Fighter");
  const y = C.advance(r.state, T0 + 12 * C.HOUR), w = y.den[0], b = y.den[1];
  ok("they come home with the companion and share the xp", !w.away && !b.away && w.xp > C.XP[6] && b.xp > C.XP[6]);
  ok("  the diary says so", y.log.some((e) => /The party came home too/.test(e.text)));
  // a fighter makes the party stronger: more Forest clears than alone
  const runs = (party) => { let c = 0; for (let i = 0; i < 60; i++) { const g = game([["wolf", 8], ["bunny", 8]], {lvl: 6}); const a = act(g, "expedition", {area: "forest", party, roll: (i * 0.618034) % 1}); if (!a.ok) throw new Error(a.error); if (C.advance(a.state, T0 + 12 * C.HOUR).pet.lastExp.how === "cleared") c++; } return c; };
  const alone = runs([]), withF = runs([{id: "d0", role: "fighter"}]);
  ok("a fighter helps the companion clear harder places", withF > alone, alone + " vs " + withF);
}

/* old saves */
{
  const s = game([["wolf", 6]]); s.den[0].away = {party: "nobody", area: "farm", role: "scout", since: T0}; s.pet.away = null;
  const y = C.advance(s, T0 + C.HOUR);
  ok("a party pet left away with no expedition comes home on load", !y.den[0].away);
}

/* the screens */
ok("the Expeditions page picks the party: a pet and a role each, sent with the expedition",
   /pp-party-pet/.test(PET) && /pp-party-role/.test(PET) && /party[,:]/.test(PET));
ok("the Pets page has Jobs at home, and a job picker on each den pet", /Jobs at home/.test(PET) && /pp-work-pick/.test(PET) && /"petwork"/.test(PET));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
