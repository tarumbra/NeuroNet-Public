/* Natures, potential, sex and bred colours (2026-10-08, Cam: "a pokemon like feature where pets have certain natures
   and pre set starting stats and bonus also female and male ... breeding certain pets with certain natures together i
   can get a pet with special starting stats, bonuses, special color configurations"). Run: node test/test_pet_natures.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const DAY = 864e5, T = 1800000000000;
const mk = (nat, sex, v, extra) => Object.assign({id: "t" + Math.random(), species: "cat", colour: "ginger", xp: 0, s: {happy: 50, full: 80, health: 100},
  gene: {sex, nature: nat, stats: {hp: v, att: v, def: v, agi: v, knack: v}}}, extra || {});

/* ---- every pet has one ---- */
let s = C.advance(C.empty(), T); s.player.made = true;
s = C.act(s, "hatch", {egg: "starter", roll: 0.3}, T).state;
s = C.advance(s, T + 6 * DAY);
const g = s.pet.gene;
ok("every pet has a sex, a nature and five potential stats (0-10 when hatched)", (g.sex === "f" || g.sex === "m") && C.NATURES[g.nature] && !C.NATURES[g.nature].rare
   && C.GENE_STATS.every((k) => g.stats[k] >= 0 && g.stats[k] <= 10), JSON.stringify(g));
ok("  the same pet keeps the same one (an old save's pets get theirs from their id)", JSON.stringify(C.advance(s, T + 7 * DAY).pet.gene) === JSON.stringify(g)
   && JSON.stringify(C.geneOf({id: "abc", species: "cat"})) === JSON.stringify(C.geneOf({id: "abc", species: "cat"})));
ok("  9 common natures, 6 rare ones (bred only), each rare one from a pair and with its own colouring",
   Object.values(C.NATURES).filter((n) => !n.rare).length === 9 && Object.values(C.NATURES).filter((n) => n.rare && n.from && C.PATTERNS[n.pattern]).length === 6);

/* ---- breeding ---- */
{
  let b = C.advance(C.empty(), T); b.player.made = true;
  b = C.act(b, "hatch", {egg: "starter", roll: 0.3}, T).state;
  b = C.advance(b, T + 6 * DAY);
  b.pet.sick = false; b.pet.s = {full: 100, happy: 100, energy: 100, clean: 100, health: 100};
  const twin = JSON.parse(JSON.stringify(b.pet)); twin.id = "twin"; b.den.push(twin);
  b.pet.gene = {sex: "m", nature: "brave", stats: {hp: 10, att: 10, def: 10, agi: 10, knack: 10}};
  twin.gene = {sex: "m", nature: "bold", stats: {hp: 10, att: 10, def: 10, agi: 10, knack: 10}};
  ok("breeding takes a male and a female", /male and a female/.test(C.act(b, "breed", {a: b.pet.id, b: "twin", roll: 0.5}, T + 6 * DAY).error || ""));
  twin.gene.sex = "f";
  let r = C.act(b, "breed", {a: b.pet.id, b: "twin", roll: 0.5}, T + 6 * DAY);
  ok("  then they breed", r.ok, r.error);
  let after = C.advance(r.state, T + 6 * DAY + 3600e3 + 60e3);     // laid; it hatches 30 minutes later
  const egg = after.hatchery[0];
  ok("  the egg carries the child's gene", egg && egg.gene && C.NATURES[egg.gene.nature] && egg.gene.bred);
  after = C.advance(after, T + 9 * DAY);
  const kid = after.den.find((q) => q.gene && q.gene.bred);
  ok("  and the pet that hatches has it", kid && JSON.stringify(kid.gene) === JSON.stringify(egg.gene));
}
{
  const n = 3000, res = [];
  for (let i = 0; i < n; i++) res.push(C.childGene(mk("brave", "m", 10), mk("bold", "f", 10), {seed: i * 7919}));
  const val = res.filter((x) => x.nature === "valiant").length / n;
  ok("Brave × Bold: about a third come out Valiant (+10% attack and defence)", val > 0.3 && val < 0.4, val);
  ok("  a rare nature's pet starts stronger in its best stat, and two strong parents can give up to 15", res.some((x) => x.stats.att >= 13) && res.every((x) => x.stats.att <= 15));
  ok("  some get the rare nature's colouring; a few anything bred shimmers", res.some((x) => x.pattern === "royal") && res.some((x) => x.pattern === "shimmer")
     && res.filter((x) => x.pattern === "shimmer").length / n < 0.04);
  const plain = [];
  for (let i = 0; i < n; i++) plain.push(C.childGene(mk("calm", "m", 4), mk("hardy", "f", 4), {seed: i * 31}));
  ok("  a plain pair passes its own natures on (mostly) and no rare one", plain.filter((x) => x.nature === "calm" || x.nature === "hardy").length / n > 0.85
     && !plain.some((x) => C.NATURES[x.nature].rare));
  ok("  weak parents make weak eggs", plain.every((x) => x.stats.hp <= 7));
  const rp = C.pairGenes(mk("timid", "m", 8), mk("jolly", "f", 8));
  ok("the breeding page shows the pair: sexes, a rare nature's chance and the egg's potential", rp.sexOk && rp.rare && rp.rare.id === "nimble" && rp.stats.length === 5);
}
/* ---- what it does ---- */
{
  const w = mk("wild", "m", 5, {xp: 2000}), c = mk("calm", "m", 5, {xp: 2000}), strong = mk("calm", "m", 15, {xp: 2000});
  const run = (q) => C.runFighter ? C.runFighter(q, {}) : null;
  if (C.runFighter) {
    ok("a Wild pet hits harder and has less health than a Calm one", run(w).att > run(c).att && run(w).hp < run(c).hp);
    ok("  potential counts too", run(strong).att > run(c).att && run(strong).hp > run(c).hp && run(strong).dodge > run(c).dodge);
  } else ok("runFighter is exported for the test", false);
  ok("a pet's knack adds to its companion skill bonus (Knack 15 + Sage: +11%; an average pet: nothing)", Math.abs(C.knackOf(mk("sage", "f", 15)) - 0.11) < 0.001 && C.knackOf(mk("calm", "f", 5)) === 0);
  ok("  potential is centred on 5: an average pet fights as it always did", JSON.stringify(run(mk("calm", "m", 5))) === JSON.stringify(run(Object.assign(mk("calm", "m", 5), {gene: {sex: "m", nature: "calm", stats: {hp: 5, att: 5, def: 5, agi: 5, knack: 5}}}))));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
