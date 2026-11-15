/* Battle Re-work Part 14 (2026-10-16, PT11 x6): move tomes -- one per type, each teaching a battle pet a move of that type
   (not its own), up to its battle level, two a pet; the move keeps its own type in the matchups; Warden Briar sells them;
   a boss leaves one now and then. Run: node test/test_pet_tomes.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 16, 8), H = 3600e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
const beast = (id, lv, extra) => Object.assign({id, name: id, species: "wolf", colour: "grey", born: T0, hatchAt: T0, joined: T0, xp: C.XP[lv], stat: {}, train: "", trainAt: T0,
                                                fedUntil: 0, restUntil: 0, wins: 0, faints: 0}, extra || {});
function game(coins) { let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false}; s.coins = coins || 0; s.beasts = [beast("Fang", 12)]; return s; }

console.log("\nThe tomes\n");
ok("six, one a type", Object.keys(C.MOVE_TOMES.items).length === 6 && ["beast", "bird", "bug", "reptile", "spirit", "water"].every((t) => Object.values(C.MOVE_TOMES.items).some((x) => x.moveTome === t)));
{
  let s = game(10000);
  let r = A(s, "penbuy", {item: "tomebird"});
  ok("Warden Briar sells them (2,500 coins)", !r.error && r.state.bag.tomebird === 1 && r.state.coins === 7500, r.error); s = r.state;
  ok("  not without the coins", /2,500 coins/.test(A(game(100), "penbuy", {item: "tomebird"}).error));
  ok("  and nothing else", !!A(s, "penbuy", {item: "bronzesword"}).error);
  const t = C.tomeTeachable(s, s.beasts[0]);
  ok("a Bird tome offers a wolf (a Beast) the Bird moves up to its battle level (12)", t.length && t.every((x) => x.type === "bird" && x.level <= 12) && t.some((x) => x.move === "peck"), JSON.stringify(t.map((x) => x.move)));
  s.bag.tomebeast = 1;
  ok("  never its own type's (it learns those anyway)", !C.tomeTeachable(s, s.beasts[0]).some((x) => x.type === "beast"));
  r = A(s, "penteach", {id: "Fang", move: "peck"});
  ok("teaching uses the tome; the move is learnt", !r.error && !r.state.bag.tomebird && (r.state.beasts[0].tomeMoves || []).join() === "peck", r.error); s = r.state;
  ok("  it can be among its four", (() => { const x = A(s, "penmoves", {id: "Fang", moves: ["scratch", "peck"]}); return !x.error && x.state.beasts[0].moves.join() === "scratch,peck"; })());
  ok("  a move above its level can't be taught", (() => { const z = game(); z.bag.tomebird = 1; return !!A(z, "penteach", {id: "Fang", move: C.Object ? "" : Object.keys(C.BEAST_MOVES).find((k) => C.BEAST_MOVES[k].type === "bird" && C.BEAST_MOVES[k].level > 12)}).error; })());
  s.bag.tomebug = 2;
  s = A(s, "penteach", {id: "Fang", move: C.tomeTeachable(s, s.beasts[0]).find((x) => x.type === "bug").move}).state;
  s.bag.tomespirit = 1; s = A(s, "penteach", {id: "Fang", move: C.tomeTeachable(s, s.beasts[0]).find((x) => x.type === "spirit").move}).state;   // (V11: three a pet)
  ok("three tome moves a pet, then no more (V11; it was two)", (s.beasts[0].tomeMoves || []).length === 3 && C.tomeTeachable(s, s.beasts[0]).length === 0 && /as many as a pet can/.test(A(s, "penteach", {id: "Fang", move: "dive"}).error || ""));
}

console.log("\nIn a fight\n");
{
  // the move's own type in the matchups: Peck (Bird) against a Reptile is strong, though the pet is a Beast (weak to Reptiles)
  const pk = ctx.window.PetCore;
  const rep = Object.keys(C.BEAST_CREATURE_TYPE).find((m) => C.BEAST_CREATURE_TYPE[m] === "reptile");
  ok("a tome's move uses its own type against the creature (Bird beats a Reptile; a Beast's own moves are weak to it)", C.typeMult({}, "bird", rep) > 1 && C.typeMult({}, "beast", rep) < 1, rep);
  const src = fs.readFileSync(path.join(APP, "ui", "pet", "core", "40-zzz-s-the-beast-master.js"), "utf8");
  ok("  (petTurn reads the move's type)", /typeMult\(pl, M\.type \|\| p\.type, b\.mon\)/.test(src));
  void pk;
}

console.log("\nFrom bosses\n");
{
  let got = 0;
  for (let i = 0; i < 400; i++) { const g = {}; const s = game(); C.tomeBossDrop(s, {seed: i * 7919 + 13}, {wins: 1 + (i % 9)}, g); if (Object.keys(g).length) got++; }
  ok("a boss leaves a tome about one win in 25 (4%)", got >= 6 && got <= 30, got + "/400");
}

console.log("\nThe screens\n");
ok("the Pen sells tomes and each pet card can be taught from one", PET.includes("data-penbuy=") && PET.includes("data-teach=") && PET.includes("Teach from a tome"));
ok("the Pen no longer says the Beast Master comes 'in the next part'", !PET.includes("come in the next part"));
ok("a risen in the Pen says so", PET.includes(">Risen</span>"));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
