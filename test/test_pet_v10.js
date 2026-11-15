/* V10 (2026-10-18): the Astral egg and its eight planet pets -- from a won rematch at the mage tower, painted by Cam (pet sheet 7,
   icon sheet 106), the Astral battle type with each planet's element in its moves, and never sold or bred.
   Run: node test/test_pet_v10.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const DAY = new Date(2026, 9, 18, 12).getTime(), H = 3600e3, MIN = 60e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || DAY);
const RUNES = ["air", "water", "earth", "fire", "mind", "chaos", "nature", "death", "cosmic", "astral", "law", "blood"];
function arcane(lv) {
  let s = A(C.advance(C.empty(), DAY), "player", {name: "T"}).state; s.story = {on: false}; s.tutorial = {step: 0, done: true};
  ["magic", "defence", "hitpoints", "attack", "runecrafting", "enchanting"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, DAY).maxHp;
  s = A(s, "class", {cls: "arcane"}).state; s.player.classes.arcane.xp = C.XP[lv]; if (s.classTut) s.classTut.on = null;
  RUNES.forEach((k) => { s.bag[k + "rune"] = 900; });
  s.bag.magicwand = 1; s.player.gear.weapon = "magicwand"; s.bagSize = "rucksack";
  return s;
}
const win = (st0, t0) => { let st = st0; st.player.battle.mhp = 1; for (let t = t0; t < t0 + 60e3 && st.player.battle; t += 2400) { st = C.advance(st, t); st.player.hp = C.playerView(st, t).maxHp; } return st; };
const PLANETS = ["quickhare/mercury", "dawnmoth/venus", "globetortoise/terra", "dusthound/mars", "stormray/jupiter", "ringowl/saturn", "tiltseal/uranus", "deepserpent/neptune"];

console.log("\nThe egg and its pets\n");
{
  const E = C.EGGS.astral;
  ok("an Astral egg (never a first egg to choose), hatching one of eight planet pets", E && !C.EGG_ORDER.includes("astral") && E.pool.length === 8 && PLANETS.every((k) => E.pool.some((p) => p[0] === k) && C.PETS[k]));
  const w = Object.fromEntries(E.pool);
  ok("  Terra, Mars, Venus and Mercury the commonest; Jupiter and Saturn rarer; Uranus and Neptune the rarest",
     ["globetortoise/terra", "dusthound/mars", "dawnmoth/venus", "quickhare/mercury"].every((k) => w[k] > w["stormray/jupiter"]) && w["ringowl/saturn"] > w["tiltseal/uranus"] && w["deepserpent/neptune"] === w["tiltseal/uranus"]);
  ok("  the egg is a bound item, with its own picture", C.ITEMS.astralegg && C.ITEMS.astralegg.egg === "astral" && C.ITEMS.astralegg.bound
     && fs.existsSync(path.join(APP, "ui", "pet", "art", "icons", "astralegg.webp")));
  const man = fs.readFileSync(path.join(APP, "ui", "pet", "art", "pets", "manifest.js"), "utf8");
  const pics = JSON.parse(man.slice(man.indexOf("{"), man.lastIndexOf("}") + 1));
  ok("  every planet pet painted: portrait, side view and asleep", PLANETS.every((k) => pics[k] && pics[k].a && pics[k].side && pics[k].sleep), PLANETS.filter((k) => !(pics[k] && pics[k].side && pics[k].sleep)).join());
}

console.log("\nA won rematch, now and then (rarer at the low ranks)\n");
{
  ok("the chance climbs with the rank: 1 in 200 .. 1 in 40", C.ASTRAL.drop.slice(1).join() === "200,150,100,70,40");
  const keep = C.ASTRAL.drop[1];
  C.ASTRAL.drop[1] = 1;                                              // (a sure thing, for the test)
  let s = arcane(50); s.mageRank = 2;
  const w = win(A(s, "rank", {rematch: 1, roll: 0.3}).state, DAY);
  ok("  winning the rematch can drop the egg -- with a pop-up and the haul", w.bag.astralegg === 1 && w.lastBoss.got.astralegg === 1 && (w.unlocked || []).some((u) => /Astral egg/.test(u.title)),
     JSON.stringify([w.bag.astralegg, w.lastBoss.got]));
  C.ASTRAL.drop[1] = keep;
  let n = 0; for (let i = 0; i < 20; i++) { let q = arcane(50); q.mageRank = 2; q = A(q, "rank", {rematch: 1, roll: i / 20}).state; q.player.battle.seed = i * 7919; n += win(q, DAY).bag.astralegg || 0; }
  ok("  and at 1 in 200 it isn't every time", n < 3, n);
  let f = arcane(50); f.mageRank = 1; C.ASTRAL.drop[1] = 1;
  const fr = A(f, "rank", {roll: 0.3}), first = fr.error ? {bag: {astralegg: "error: " + fr.error}} : win(fr.state, DAY);
  C.ASTRAL.drop[1] = keep;
  ok("  never from the first win of a rank (that has its own rewards)", !first.bag.astralegg);

  const h = arcane(50); h.pet = null; h.bag.astralegg = 1;
  const r = A(h, "hatch", {egg: "astral", roll: 0.99});
  ok("hatching it: a planet pet (the last roll lands on Neptune)", !r.error && r.state.pet && PLANETS.includes(r.state.pet.species + "/" + r.state.pet.colour), r.error || JSON.stringify(r.state.pet && [r.state.pet.species, r.state.pet.colour]));
}

console.log("\nNot sold, not bred\n");
{
  const pet = (id, sp, col) => ({id, name: id, species: sp, colour: col, born: DAY - 9 * 24 * H, hatchAt: DAY - 9 * 24 * H, xp: 50});
  let s = arcane(20); s.pet = pet("Ra", "dusthound", "mars"); s.den = [pet("Io", "dusthound", "mars"), pet("Ann", "cat", "ginger")];
  ok("an Astral pet can't go for tokens", /Astral/.test(A(s, "petrelease", {id: "Io"}).error || ""), A(s, "petrelease", {id: "Io"}).error);
  ok("  nor be bred", /Astral pet can't be bred/.test(A(s, "breed", {a: "Ra", b: "Ann"}).error || ""), A(s, "breed", {a: "Ra", b: "Ann"}).error);
}

console.log("\nAs battle pets: the Astral type, their planet's element\n");
{
  ok("Astral is a seventh type, neutral: strong against nobody, nobody strong against it",
     C.BEAST_TYPES.astral && !C.BEAST_TYPES.astral.strong.length && Object.keys(C.BEAST_TYPES).every((t) => !(C.BEAST_TYPES[t].strong || []).includes("astral")));
  const b = (sp, col, lv) => ({id: "X", name: "X", species: sp, colour: col, born: DAY - 9e8, hatchAt: DAY - 9e8, joined: DAY, xp: C.XP[lv], stat: {}, train: "", trainAt: DAY, fedUntil: 0, restUntil: 0, wins: 0, faints: 0});
  ok("  every planet pet is of it", PLANETS.every((k) => C.beastType(b(k.split("/")[0], k.split("/")[1], 1)) === "astral"));
  const el = (sp, col) => C.movesLearned(b(sp, col, 50)).map((m) => C.BEAST_MOVES[m].element);
  ok("  each learns four moves of its planet's element (Mars fire, Neptune water, Saturn earth, Mercury air)",
     [["dusthound", "mars", "fire"], ["deepserpent", "neptune", "water"], ["ringowl", "saturn", "earth"], ["quickhare", "mercury", "air"]].every(([sp, c, e]) => { const x = el(sp, c); return x.length === 4 && x.every((y) => y === e); }));
  ok("  its moves are spells (magic blows), with the Arcane's effects", ["solarflare", "frostcurrent", "tectonic", "cyclone"].every((m) => C.BEAST_MOVES[m].dtype === "magic" && C.BEAST_MOVES[m].fx));
  ok("  and a rare pet's stats", C.beastStats(b("tiltseal", "uranus", 10)).health > 0);
}

console.log("\nThe Pen shows your found tomes (PT26 p2, v4)\n");
{
  const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  const bb = (id, sp, col, lv) => ({id, name: id, species: sp, colour: col, born: DAY - 9e8, hatchAt: DAY - 9e8, joined: DAY, xp: C.XP[lv], stat: {}, train: "", trainAt: DAY, fedUntil: 0, restUntil: 0, wins: 0, faints: 0});
  let s = arcane(20); s.beasts = [bb("Ares", "dusthound", "mars", 1)]; s.bag.tomestar = 1; s.storage = {tomedavyjones: 1};
  const pv = C.penView(s, DAY), card = pv.beasts[0];
  ok("a new pet too young for a found tome: its card says when (Comet at battle level 25)", !card.teach.length && card.later.some((m) => m.name === "Comet" && m.level === 25), JSON.stringify(card.later));
  ok("  the shelf lists the found tomes, and one in the bank says so", pv.found.some((t) => t.id === "tomestar" && !t.banked) && pv.found.some((t) => t.id === "tomedavyjones" && t.banked));
  ok("  drawn on the card and the shelf; an Astral pet reads neutral", /pen-later/.test(PET) && /Your found tomes/.test(PET) && /neutral: no type is strong or weak/.test(PET));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
