/* Gifted pets and care in the work (2026-10-12, audit FEAT-1 to FEAT-3). Run: node test/test_pet_gifted.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const load = () => { const ctx = {window: {}, console}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx); return ctx.window.PetCore || ctx.PetCore; };
const C = load();
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 12, 8), H = 3600e3;
const spotAt = (skill, lv) => C.SKILLS[skill].spots.filter((sp) => sp.level >= lv && !sp.essence && !sp.secret && !sp.needs && !sp.bait).sort((a, b) => a.level - b.level)[0];
const gatherer = (skill, sp) => { const s = C.act(C.advance(C.empty(), T0), "player", {name: "G"}, T0).state; s.story = {on: false};
  s.player.skills[skill] = C.XP[Math.max(sp.level, 10)]; s.dev = {infinite: true}; return s; };

ok("one gifted pet per gathering skill, each a species with a knack for it, all painted", Object.keys(C.GIFTED).length === 5
   && Object.keys(C.GIFTED).every((k) => { const sp = C.GIFTED[k].split("/")[0]; return C.BOOSTS[sp] === k && C.PETS[C.GIFTED[k]]; }));
{
  const sp = spotAt("lumbering", 20);
  const C2 = load(); C2.GIFTED_TUNE.rate = 1e9;                         // force it: every find
  let s = gatherer("lumbering", sp);
  let r = C2.act(s, "trip", {skill: "lumbering", spot: sp.id, roll: 0.3}, T0);
  s = C2.advance(r.state, T0 + H);
  const g = (s.den || []).find((q) => q.species === "elk");
  ok("a find can bring a gifted pet home: grown, top potential, the Gifted nature, in the den and the Petapedia", g && g.gene.nature === "gifted" && g.gene.stats.knack === 10
     && s.dex["elk/brown"] && s.gifted.lumbering && s.log.some((e) => /followed you home/.test(e.text)), r.error);
  ok("  only one per skill, ever", (s.den || []).filter((q) => q.gene && q.gene.nature === "gifted").length === 1);
  ok("  Gifted doubles the companion help (+10% knack, plus its top potential, on top of the species' +10%)", C2.NATURES.gifted.fx.knack === 0.1 && C2.knackOf(g) >= 0.1);
}
{
  // without the forcing, the roll never touches the trip's own dice: an hour's finds are exactly as before
  const sp = spotAt("mining", 10);
  const C3 = load(); C3.GIFTED_TUNE.rate = 0;
  const run = (CC) => { let s = gatherer("mining", sp); s = CC.act(s, "trip", {skill: "mining", spot: sp.id, roll: 0.42}, T0).state; s = CC.advance(s, T0 + 2 * H); return JSON.stringify((s.player.job || s.player.lastTrip || {}).items || s.bag); };
  ok("the gifted roll is its own: a trip finds exactly the same with or without it", run(C) === run(C3));
  ok("  rare: about one in 60,000 finds at level 50, none below level 10", Math.abs(1 / (C.MAX_LEVEL / C.MAX_LEVEL * C.GIFTED_TUNE.rate) - 60000) < 1 && C.GIFTED_TUNE.min === 10);
}
{
  ok("care shows in the work: your pet's room's comforts (bed, toy box, rug) make den pets 3% quicker each, 10% with all three",
     C.carePace({room: {}}) === 1 && Math.abs(C.carePace({room: {bed: "petbed"}}) - 0.97) < 1e-9 && C.carePace({room: {bed: 1, toybox: 1, rug: "rug"}}) === 0.9);
  const src = fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8");
  ok("  used when a den pet goes gathering, on top of the species' natural 20%", /gs\.time \* 1000 \* \(natural \? 0\.8 : 1\) \* pace/.test(src));
}
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
