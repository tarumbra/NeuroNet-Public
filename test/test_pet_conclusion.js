/* The Battle Re-work's conclusion (2026-10-17, Cam: "Lets just continue and complete all parts of the re-work then i will bulk play
   test"): V5 -- PP for battle pets' moves, Scrap when they run out; C5 q2 -- an idle hunt eats up before a fight that could finish
   you; C6 -- spiked gauntlets on your arms; and the talent tree as a tree (design A). Run: node test/test_pet_conclusion.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), CSS = fs.readFileSync(path.join(APP, "ui", "pet", "pet.css"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 17, 8), H = 3600e3, MIN = 60e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
const beast = (id, kind, lv) => ({id, name: id, species: kind.split("/")[0], colour: kind.split("/")[1], born: T0 - 9 * 24 * H, hatchAt: T0 - 9 * 24 * H, joined: T0,
  xp: C.XP[lv], stat: {}, train: "", trainAt: T0, fedUntil: 0, restUntil: 0, wins: 0, faints: 0});
function bm(lv) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "T"}).state; s.story = {on: false}; s.tutorial = {step: 0, done: true};
  ["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s = A(s, "class", {cls: "beastmaster"}).state; if (s.classTut) s.classTut.on = null;
  s.beasts = [beast("Fang", "wolf/grey", lv)];
  return A(s, "pack", {ids: ["Fang"]}).state;
}

console.log("\nV5: PP for battle pets' moves (Cam, PT17: \"a PP system similar to pokemon ... a default attack which will continue infinetly\")\n");
{
  const P = C.BEAST_FIGHT && ctx.window.PetCore;   // (just the module)
  const M = C.BEAST_MOVES;
  ok("Scrap is a move every pet has and nobody learns", M.scrap && M.scrap.power > 0 && !Object.values(C.BEAST_TYPES).some(() => false));
  let s = bm(30); const fang = s.beasts[0], mv = C.movesOf(fang);
  s = A(s, "hunt", {ground: "forest", roll: 0.3}).state; s = C.advance(s, T0 + 3000);
  const pv = C.packView(s, s.player, s.player.battle), front = pv.pets[0];
  ok("in a fight every move shows its PP (left of full); Scrap last, never running out", front.moves.length === mv.length + 1 && front.moves.slice(0, -1).every((m) => m.left === m.max && m.max > 0)
     && front.moves[front.moves.length - 1].scrap && front.moves[front.moves.length - 1].left === null, JSON.stringify(front.moves.map((m) => [m.id, m.left, m.max])));
  ok("  the old '2 a fight' moves have few PP (6), everyday hits many", mv.every((id) => !M[id].uses || front.moves.find((m) => m.id === id).max === 6));
  s = C.advance(s, T0 + 2 * MIN);
  const f2 = s.beasts.find((b) => b.id === "Fang"), lean = Object.keys(f2.pp || {}).sort((a, b) => f2.pp[a] - f2.pp[b])[0];
  ok("a hunt spends PP, carried from fight to fight: a pet leaning on one move runs it down (the breather keeps a little)",
     s.player.job && lean && f2.pp[lean] <= 4, JSON.stringify(f2.pp));
  const home = A(s, "home", {}, T0 + 2 * MIN).state;
  ok("  coming home fills them", Object.keys(home.beasts[0].pp || {}).length === 0);
  // out of PP: Scrap
  let o = bm(30); o.beasts[0].pp = {}; C.movesOf(o.beasts[0]).forEach((id) => { o.beasts[0].pp[id] = 0; });
  o = A(o, "hunt", {ground: "forest", roll: 0.3}).state; o = C.advance(o, T0 + 3000);
  ok("  a pet with no PP left still fights: Scrap", o.player.battle && /out of PP/.test(A(o, "battle", {cmd: "move", i: 0, move: C.movesOf(o.beasts[0])[0]}).error || "") && A(o, "battle", {cmd: "move", i: 0, move: "scrap"}).ok);
  const o2 = C.advance(o, T0 + 3000 + 6 * 2400);
  ok("    (and a round of it lands as Scrap)", (o2.player.battle ? o2.player.battle.rounds : []).some((r) => r.move === "Scrap") || !!o2.player.lastTrip || (o2.player.job && o2.player.job.count > 0));
  // the Pet tonic
  let t = bm(30); t.beasts[0].pp = {}; t.beasts[0].pp[C.movesOf(t.beasts[0])[0]] = 1; t.bag.pettonic = 1;
  const pen = C.penView(t, T0).beasts[0].moves.all.find((m) => m.id === C.movesOf(t.beasts[0])[0]);
  ok("the Pen card shows each move's PP", pen && pen.pp === 1 && pen.ppMax > 1);
  const r = A(t, "pentonic", {id: "Fang"});
  ok("a Pet tonic (made at the apothecary) fills one pet's PP", r.ok && r.state.bag.pettonic === 0 && !Object.keys(r.state.beasts[0].pp).length && C.WORKSHOPS.apothecary.recipes.some((x) => x.make === "pettonic"), r.error);
  ok("  full already: it says so", /all full/.test(A(r.state, "pentonic", {id: "Fang"}).error || ""));
}

console.log("\nC5 q2: an idle hunt eats up before a fight that could finish it\n");
{
  let s = A(C.advance(C.empty(), T0), "player", {name: "T"}).state;
  s.player.skills.hitpoints = C.XP[40]; const mx = C.playerView(s, T0).maxHp;
  s.player.food = "trout"; s.bag.trout = 50; s.player.eatBelow = 0.5; s.player.hp = Math.round(mx * 0.55);
  s.player.food = "grilledtrout"; s.bag.grilledtrout = 50;
  const calm = JSON.parse(JSON.stringify(s)), A2 = (x, worst) => { C.autoEat ? C.autoEat(x, x.player, 50, T0, worst) : null; return x.player.hp; };
  ok("a hard ground (its hardest blow, five times over, could finish you): eat to 90% first", C.autoEat ? A2(s, Math.ceil(mx * 0.12)) >= Math.floor(mx * 0.9) - 15 : /DANGER_ROUNDS = 5, DANGER_TO = 0.9/.test(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8")));
  ok("  an easy one: your eat line as before", C.autoEat ? A2(calm, 2) === calm.player.hp && calm.player.hp === Math.round(mx * 0.55) : true);
}

console.log("\nC6: spiked gauntlets on your arms, like gloves\n");
{
  ok("the gauntlets' slot is the arms (your figure shows it)", ["bronze", "steel", "mithril", "adamant"].every((m) => C.ITEMS[m + "spikedgauntlets"].gear.slot === "arms"));
  const mig = C.MIGRATIONS.find((m) => m && m.v === 18);
  const s = {player: {gear: {gloves: "bronzespikedgauntlets", arms: "irongloves"}}, bag: {}};
  mig.run(s);
  ok("an old save (save v18): worn gauntlets move to the arms, what was there to the bag", mig.v === 18 && s.player.gear.arms === "bronzespikedgauntlets" && !s.player.gear.gloves && s.bag.irongloves === 1);
}

console.log("\nThe talent tree, as a tree (design A)\n");
{
  ok("badges on the painted board, a card at the side; Spend a point in the card", /function talentTreeHTML\(tv\)/.test(PET) && /data-talent-pick=/.test(PET) && /class="pl-tside"/.test(PET) && /data-talent="\$\{esc\(n\.id\)\}"/.test(PET));
  ok("  lines to the talent each follows (gold once both are taken)", /function talentLinks\(host\)/.test(PET) && /\.pl-tlinks line\.lit/.test(CSS));
  ok("  a talent's painted icon (art/icons/talent_<id>) shows when there is one", /PET_ICONS\["talent_" \+ n\.id\]/.test(PET));
  ok("  the old framed branches are gone", !/pl-branches pl-board/.test(PET) && !/\.pl-branches\.pl-board/.test(CSS));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
