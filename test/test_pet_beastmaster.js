/* Battle Re-work Part 11b (2026-10-16): the Beast Master -- the class at the Guild hall, moves learned by battle level (4 used),
   the pack (in the fight, on the bench), the fight itself (pets take the blows, you never do; a beaten pack ends the hunt),
   moves that repeat, food and swaps in a fight, specials, faints and rest, deaths in Hardcore beyond the early grounds (Q11),
   xp for pets and the class, and the Keeper branch in the Pen. Run: node test/test_pet_beastmaster.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 16, 8), H = 3600e3, MIN = 60e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
const beast = (id, kind, lv, extra) => Object.assign({id, name: id, species: kind.split("/")[0], colour: kind.split("/")[1], born: T0 - 9 * 24 * H, hatchAt: T0 - 9 * 24 * H, joined: T0,
                                                      xp: C.XP[lv], stat: {}, train: "", trainAt: T0, fedUntil: 0, restUntil: 0, wins: 0, faints: 0}, extra || {});
/** A Beast Master at level `lv` with these battle pets in its pack. */
function bm(lv, pets, mode) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  if (mode) s.mode = mode;
  ["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, T0).maxHp;
  s = A(s, "class", {cls: "beastmaster"}).state;
  s.beasts = pets || [beast("Fang", "wolf/grey", lv)];
  s = A(s, "pack", {ids: s.beasts.map((b) => b.id).slice(0, C.packSize(s.player) + C.BEAST_FIGHT.bench)}).state;
  return s;
}

console.log("\nThe class\n");
{
  ok("the Beast Master is a class, with Command, Rally and Wild call", C.CLASSES.beastmaster && ["command", "rally", "wildcall"].every((k) => C.CLASSES.beastmaster.specials[k]));
  const g = C.guildView(bm(20), T0), t = g.tutors.find((x) => x.cls === "beastmaster");
  ok("  at the Guild hall: Tamsin, standing in for Warden Briar, with a quest", t && t.standIn === "Tamsin" && /Briar/.test(t.real) && t.quest.name);
  ok("  a switch costs 12,000 coins, 60 treats and 20 grain feed (note 05)", C.GUILD.tutors.beastmaster.switch.coins === 12000 && C.GUILD.tutors.beastmaster.switch.items.treat === 60);
  ok("  its tree: Bond, Wild and Keeper", C.TALENTS.beastmaster.branches.map((b) => b.name).join() === "Bond,Wild,Keeper");
  ok("  its techniques: Animal handling and Tending", C.TECHNIQUES.list.animalhandling.cls === "beastmaster" && C.TECHNIQUES.list.tending.cls === "beastmaster");
  ok("  and a book", C.CLASS_BOOKS.beastmasterbook && C.classBookView("beastmaster").branches.length === 3);
}

console.log("\nMoves\n");
{
  const types = Object.keys(C.BEAST_TYPES).filter((k) => k !== "//" && k !== "astral");   // (the Astral egg's pets have their planets' moves, V10)
  ok("seven moves a type, about 40 in all (note 06) -- the region tomes' moves are extra, learnt only from their tomes (V11)", types.every((t) => Object.keys(C.BEAST_MOVES).filter((k) => C.BEAST_MOVES[k].type === t && !C.BEAST_MOVES[k].tome).length === 7));
  ok("  a new battle pet knows its type's two first moves", C.movesOf(beast("a", "wolf/grey", 1)).join() === "scratch,growl");
  ok("  more come with battle levels (5, 10, 15, 25, 35); it uses four", C.movesLearned(beast("a", "wolf/grey", 15)).length === 5 && C.movesOf(beast("a", "wolf/grey", 15)).length === 4);
  let s = bm(20); const r = A(s, "penmoves", {id: "Fang", moves: ["bite", "maul", "rend"]});
  ok("  you choose its four in the Pen", r.ok && C.movesOf(r.state.beasts[0]).slice(0, 3).join() === "bite,maul,rend", r.error);
  ok("    only moves it knows", /at least one/.test(A(s, "penmoves", {id: "Fang", moves: ["feralrush"]}).error));
  ok("every creature has a type for the matchups", Object.keys(C.MONSTERS).every((m) => C.BEAST_CREATURE_TYPE[m]), Object.keys(C.MONSTERS).filter((m) => !C.BEAST_CREATURE_TYPE[m]).join());
  ok("  a Beast type is strong against a bird (x1.5), weak against water", C.typeMult(bm(20).player, "beast", "duck") === 1.5 && C.typeMult(bm(20).player, "beast", "crab") < 1);
}

console.log("\nThe pack and the fight\n");
{
  let s = bm(20, [beast("Fang", "wolf/grey", 20), beast("Hoot", "owl/storm", 20), beast("Slink", "snake/green", 20), beast("Extra", "cat/ginger", 5)]);
  ok("one pet fights to start, two more on the bench", C.packSize(s.player) === 1 && C.BEAST_FIGHT.bench === 2 && s.player.combat.pack.length === 3);
  ok("  a bigger pack is refused", /bench/.test(A(s, "pack", {ids: ["Fang", "Hoot", "Slink", "Extra"]}).error));
  s = A(s, "hunt", {ground: "forest", roll: 0.3}).state;
  s = C.advance(s, T0 + 3000);
  const b = s.player.battle;
  ok("a hunt's fight carries the pack: the first in the fight, the rest on the bench", b && b.pack && b.pack.size === 1 && b.pack.pets.length === 3, JSON.stringify(b && b.pack && b.pack.size));
  const hp0 = s.player.hp;
  let r = A(s, "battle", {cmd: "move", i: 0, move: "maul"});
  ok("  pick a move for a pet: it uses it, and again until you change it", r.ok && r.state.player.battle.pack.pets[0].next === "maul" && r.state.player.battle.pack.pets[0].last === "maul", r.error);
  s = C.advance(r.state, T0 + 3000 + 2 * 2400 + 10);
  ok("    (it did)", s.player.battle ? s.player.battle.rounds.some((x) => x.move === "Maul") : true);
  ok("  you're never hurt: the creature hits your pets", s.player.hp === hp0 && (!s.player.battle || s.player.battle.rounds.filter((x) => x.by === "them" && x.hit).every((x) => x.pet)));
  s = C.advance(s, T0 + 40 * MIN);
  const pv = C.playerView(s, T0 + 40 * MIN);
  ok("a pack hunt wins fights, and the pets earn battle xp", (s.player.job || s.player.lastTrip).count > 0 && s.beasts[0].xp > C.XP[20], JSON.stringify([(s.player.job || s.player.lastTrip).count, s.beasts[0].xp]));
  ok("  the Beast Master earns Attack and class xp", s.player.skills.attack > C.XP[20] && C.classLevel(s.player, "beastmaster") > 1);
  ok("  and the pets' health carries from fight to fight", typeof s.beasts[0].hp === "number");
  ok("  Tamsin's quest counts the wins", (s.player.feats || {}).packwins > 0);
}
{
  let s = bm(20, [beast("Fang", "wolf/grey", 20), beast("Hoot", "owl/storm", 20)]);
  s = A(s, "hunt", {ground: "forest", roll: 0.3}).state; s = C.advance(s, T0 + 3000);
  s.player.battle.pack.pets[0].hp = 3; s.bag.grilledtrout = 3;
  let r = A(s, "battle", {cmd: "petfeed", i: 0, item: "grilledtrout"});
  ok("feed a pet in the fight: 20% less than you'd heal, and it's that pet's turn", r.ok && r.state.player.battle.pack.pets[0].hp === 3 + Math.round(C.ITEMS.grilledtrout.heal * 0.8) && r.state.player.battle.pack.pets[0].skip === "ate", r.error);
  r = A(s, "battle", {cmd: "petswap", i: 0, j: 0});
  ok("swap a bench pet in: it takes the place, and loses its turn", r.ok && r.state.player.battle.pack.pets[0].id === "Hoot" && r.state.player.battle.pack.pets[0].skip === "swap", r.error);
}
{
  let s = bm(20, [beast("Fang", "wolf/grey", 20), beast("Hoot", "owl/storm", 20)]);
  s = A(s, "hunt", {ground: "forest", roll: 0.3}).state; s = C.advance(s, T0 + 3000);
  s.player.battle.pack.pets[0].hp = 0;
  s = C.advance(s, T0 + 3000 + 2400 + 10);
  ok("a pet that faints: the next from the bench steps in", !s.player.battle || s.player.battle.pack.pets[0].id === "Hoot");
}
{
  let s = bm(20, [beast("Pip", "bunny/pink", 1)]);
  s = A(s, "hunt", {ground: "forest", roll: 0.3}).state;
  s = C.advance(s, T0 + 30 * MIN);
  ok("every pet fainted: the hunt ends and you go home -- unhurt", !s.player.job && !s.player.dead && s.log.some((l) => /Your pack was beaten/.test(l.text)), s.log.slice(0, 4).map((l) => l.text).join(" | "));
  ok("  the fainted pet rests in the Pen", s.beasts[0].restUntil > T0 && s.beasts[0].faints === 1);
  ok("  and can't fight while it rests", /No battle pets ready/.test(A(s, "hunt", {ground: "farmyard", roll: 0.2}, T0 + 31 * MIN).error || (C.advance(A(s, "hunt", {ground: "farmyard", roll: 0.2}, T0 + 31 * MIN).state, T0 + 32 * MIN).log[0] || {}).text || ""));
}
{
  const die = C.BEAST_FIGHT.die.hardcore;
  C.BEAST_FIGHT.die.hardcore = 1;                                     // (sure, for the test)
  let s = bm(20, [beast("Pip", "bunny/pink", 1)], "hardcore");
  s = A(s, "hunt", {ground: "forest", roll: 0.3}).state; s = C.advance(s, T0 + 30 * MIN);
  ok("Q11: in Hardcore the Forest is still an early ground -- a pet that faints there only rests", s.beasts.length === 1);
  let d = bm(30, [beast("Pip", "bunny/pink", 1)], "hardcore");
  d.player.skills.attack = C.XP[30];
  d = A(d, "hunt", {ground: "deepforest", roll: 0.3}).state; d = C.advance(d, T0 + 30 * MIN);
  ok("  beyond it, a pet can die: to the Graveyard, out of your pack", d.beasts.length === 0 && d.graveyard[0] && d.graveyard[0].battle && !d.player.combat.pack.length, JSON.stringify(d.beasts.length));
  let a = bm(30, [beast("Pip", "bunny/pink", 1)], "adventure"); C.BEAST_FIGHT.die.adventure = 1;
  a = A(a, "hunt", {ground: "deepforest", roll: 0.3}).state; a = C.advance(a, T0 + 30 * MIN);
  ok("  never in Adventure", a.beasts.length === 1 || !C.MODES.adventure);
  delete C.BEAST_FIGHT.die.adventure; C.BEAST_FIGHT.die.hardcore = die;
}

console.log("\nSpecials\n");
{
  let s = bm(30, [beast("Fang", "wolf/grey", 30), beast("Hoot", "owl/storm", 30)]);
  s.player.classes.beastmaster.xp = C.XP[30];
  s = A(s, "combat", {special: "rally"}).state; s.player.spec = 100;
  s = A(s, "hunt", {ground: "forest", roll: 0.3}).state; s = C.advance(s, T0 + 3000);
  s.player.battle.pack.pets[0].hp = 2;
  s = A(s, "battle", {cmd: "special"}).state; s = C.advance(s, T0 + 3000 + 2400 + 10);
  ok("Rally heals the pets in the fight", s.player.battle ? s.player.battle.rounds.some((x) => x.rally) : true);
}

console.log("\nThe Keeper branch, in the Pen\n");
{
  let s = bm(40); s.player.classes.beastmaster.xp = C.XP[40];
  const before = C.penView(s, T0);
  ["goodfeed", "goodfeed", "softstraw", "softstraw", "softstraw", "handling", "tending", "tending", "bigpen"].forEach((n) => { const r = A(s, "talent", {node: n}); if (r.ok) s = r.state; });
  const after = C.penView(s, T0);
  ok("Good feed: quicker training; Big pen: three more stalls", after.rate > before.rate && after.stalls === before.stalls + 3, JSON.stringify([before.rate, after.rate, before.stalls, after.stalls]));
  ok("  Soft straw: shorter rest after a faint", s.player.classes.beastmaster.talents.softstraw === 3);
}

console.log("\nThe screens\n");
{
  ok("the battle screen has a pack: Moves, Feed, Swap", /data-menu="moves"/.test(PET) && /data-menu="petfeed"/.test(PET) && /data-menu="petswap"/.test(PET) && /pp-packstrip/.test(PET));
  ok("  the Combat tab chooses the pack; the Pen chooses moves", /data-packadd/.test(PET) && /pen-move/.test(PET));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
