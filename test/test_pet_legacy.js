/* Battle Re-work Part 12 (2026-10-16): New Game Plus legacies -- the gift from your last game's highest class, free talent
   points for it (a point every 10 levels, up to 5), your techniques, a Beast Master's battle pet back at level 5, prestige
   marks and the free respec at three. Run: node test/test_pet_legacy.js [app dir] */
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
const J = (x) => JSON.parse(JSON.stringify(x));

/** A finished game (the Basilisk beaten): this class at this level, and maybe others. */
function finished(cls, lv, more) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Old"}).state; s.story = {on: false};
  s = A(s, "class", {cls}).state;
  s.player.classes[cls].xp = C.XP[lv];
  Object.keys(more || {}).forEach((k) => { s.player.classes[k] = {xp: C.XP[more[k]], talents: {}, builds: {}, respecs: 0}; });
  s.hunt = {jungle: {wins: 1, kills: 20}};
  return s;
}
const fresh = (from, o) => C.newGame(Object.assign({mode: "adventure", from, pets: []}, o || {}), T0);

console.log("\nWho gets a legacy\n");
{
  const s = finished("hunter", 30); s.hunt = {};
  ok("no legacy from a game that hasn't beaten the Basilisk", C.legacyOf(s) === null);
  const n = fresh(s);
  ok("...and a new game from it is a plain one", !n.ngPlus && !n.marks && !n.legacy);
  const old = finished("hunter", 30); delete old.player.classes; delete old.player.cls;
  const L = C.legacyOf(old);
  ok("a finished game with no class: no gift, no points, still a mark", L && !L.cls && L.points === 0 && L.marks === 1, J(L));
  const g = fresh(old);
  ok("...and the new game starts fine", g.ngPlus === 1 && g.marks === 1 && !g.player.legacyPts, J(g.legacy));
}

console.log("\nThe class's gift\n");
Object.keys(C.LEGACY.gifts).filter((k) => k !== "//" && k !== "necromancer").forEach((cls) => {   // (the Necromancer's: test_pet_necromancer.js)
  const g = C.LEGACY.gifts[cls];
  Object.keys(g.items).forEach((k) => ok(`${cls}: the gift's ${k} is a real item`, !!C.ITEMS[k]));
  const n = fresh(finished(cls, 25));
  ok(`${cls}: every gift item is in the new bag`, Object.keys(g.items).every((k) => (n.bag[k] || 0) >= g.items[k]), J(n.bag));
  ok(`${cls}: the giver's line is in the diary`, n.log.some((l) => (l.text || l) === g.line));
});
ok("every class has a gift", Object.keys(C.CLASSES).every((k) => C.LEGACY.gifts[k]), Object.keys(C.CLASSES).filter((k) => !C.LEGACY.gifts[k]).join(","));
{
  // the Mathematician's guard: a gift is a quicker start, not an easier game -- worth less than the 2,000-coin purse
  const worth = (cls) => Object.entries(C.LEGACY.gifts[cls].items).reduce((a, [k, n]) => a + C.priceOf(k) * n, 0);
  Object.keys(C.CLASSES).forEach((cls) => ok(`${cls}: the gift is worth under 2,000 coins (${worth(cls)})`, worth(cls) < 2000));
}

console.log("\nThe highest class and its points\n");
{
  const s = finished("berserker", 22, {hunter: 41});
  const L = C.legacyOf(s);
  ok("the highest class level is the legacy (Hunter 41 over the Berserker you are)", L.cls === "hunter" && L.level === 41, J(L));
  ok("a point for every 10 levels: 41 gives 4", L.points === 4);
  ok("capped at 5 (level 50)", C.legacyOf(finished("arcane", 50)).points === 5);
  ok("under 10: no points", C.legacyOf(finished("thief", 9)).points === 0);
  const t = finished("paladin", 30, {hunter: 30});
  ok("a tie goes to the class you are", C.legacyOf(t).cls === "paladin");
  let n = fresh(s);
  ok("the new game holds the points for the Hunter", n.player.legacyPts && n.player.legacyPts.hunter === 4);
  n = A(n, "class", {cls: "hunter"}).state;
  // New Game Plus starts your class at its combat skill's level (15: 7 points of its own); the legacy's 4 go on top
  const view = viewTalents(n), plain = viewTalents(A(fresh(finished("berserker", 9)), "class", {cls: "hunter"}).state);
  ok("the legacy's 4 points come on top of the class's own", view.points === plain.points + 4 && view.left === view.points && view.legacyPts === 4, J({p: view.points, plain: plain.points}));
  const node = view.branches[0].nodes.find((x) => x.can);
  const r = A(n, "talent", {node: node.id});
  ok("...and can spend one", !r.error && (r.state.player.classes.hunter.talents[node.id] || 0) === 1, r.error);
  let b = fresh(s); b = A(b, "class", {cls: "berserker"}).state;
  ok("another class doesn't get them", viewTalents(b).points === plain.points && !viewTalents(b).legacyPts, viewTalents(b).points);
}
function viewTalents(s) {
  // the Talents tab's view, through the page's state call
  return C.talentsView ? C.talentsView(s) : vm.runInContext("talentsView", ctx)(s);
}

console.log("\nTechniques\n");
{
  const s = finished("hunter", 30);
  s.player.techLearned = {};
  const T = C.TECHNIQUES ? C.TECHNIQUES.list : vm.runInContext("TECHNIQUES", ctx).list;
  const ids = Object.keys(T).filter((id) => T[id].cls === "hunter" || T[id].cls === "thief");
  ids.forEach((id) => { s.player.techLearned[id] = true; });
  const L = C.legacyOf(s);
  ok("every learned technique is in the legacy", ids.every((id) => L.techs.some((t) => t.id === id)), J(L.techs));
  const n = fresh(s);
  ok("...and learned in the new game", ids.every((id) => n.player.techLearned && n.player.techLearned[id]));
  ok("New Game Plus 1 has a third technique slot (Part 9)", C.techniquesView ? C.techniquesView(n).slots === 3 : vm.runInContext("techSlots", ctx)(n) === 3);
}

console.log("\nThe Beast Master's battle pet\n");
{
  const s = finished("beastmaster", 35);
  const bst = (id, lv) => ({id, name: id, species: "wolf", colour: "grey", born: T0 - 9 * 24 * H, hatchAt: T0 - 9 * 24 * H, joined: T0, xp: C.XP[lv],
                            stat: {attack: 5000}, train: "attack", trainAt: T0, fedUntil: T0 + 5 * H, restUntil: T0 + H, wins: 40, faints: 2, moves: ["bite"]});
  s.beasts = [bst("Fang", 20), bst("Ash", 33)];
  const L = C.legacyOf(s);
  ok("the old Pen's pets are offered, highest first", L.beast && L.beasts.map((b) => b.id).join() === "Ash,Fang", J(L.beasts));
  let n = fresh(s);
  ok("by default the highest comes back", n.beasts.length === 1 && n.beasts[0].id === "Ash");
  n = fresh(s, {beast: "Fang"});
  const b = n.beasts[0];
  ok("the chosen one comes back", b.id === "Fang");
  ok("...at battle level 5", C.levelOf(b.xp) === C.LEGACY.battleLevel);
  ok("...untrained, rested, not training, no record", !b.train && !b.restUntil && !b.fedUntil && !b.wins && !b.faints && !Object.keys(b.stat).length, J(b));
  ok("...its looks and kind kept", b.species === "wolf" && b.colour === "grey");
  ok("the old game's pets are left alone", s.beasts[1].wins === 40 && C.levelOf(s.beasts[1].xp) === 33);
  const e = finished("beastmaster", 35); e.beasts = [];
  ok("an empty Pen: no pet, no error", fresh(e).beasts.length === 0);
}

console.log("\nPrestige marks and the free respec\n");
{
  let s = finished("hunter", 30);
  let n = fresh(s);
  ok("the first New Game Plus: mark 1", n.marks === 1);
  n.hunt = {jungle: {wins: 1, kills: 20}};
  let n2 = fresh(n); n2.hunt = {jungle: {wins: 1, kills: 20}};
  let n3 = fresh(n2);
  ok("each finished game adds one (3 by the third)", n2.marks === 2 && n3.marks === 3);
  ok("with 3 marks the free respec is waiting", C.prestigeView(n3).freeRespec === true && C.prestigeView(n2).freeRespec === false);
  // a Hunter past the free respec level, with points spent
  n3 = A(n3, "class", {cls: "hunter"}).state;
  n3.player.classes.hunter.xp = C.XP[30];
  const v0 = viewTalents(n3), node = v0.branches[0].nodes.find((x) => x.can);
  n3 = A(n3, "talent", {node: node.id}).state;
  const v1 = viewTalents(n3);
  ok("the Talents tab shows it free (marked)", v1.respec.marked && v1.respec.cost === 0, J(v1.respec));
  const coins = n3.coins;
  let r = A(n3, "respec");
  ok("the respec costs nothing", !r.error && r.state.coins === coins, r.error);
  ok("...and says why", /prestige/.test(r.msg || ""), r.msg);
  let m = A(r.state, "talent", {node: node.id}).state;
  const v2 = viewTalents(m);
  ok("only once a game: the next one costs coins", !v2.respec.marked && v2.respec.cost > 0, J(v2.respec));
  m.coins = 0;
  ok("...and is refused without them", !!A(m, "respec").error);
  ok("two marks: no free respec", !C.prestigeView(n2).freeRespec);
}

console.log("\nOn the screens\n");
ok("the New Game Plus form shows the legacy", PET.includes("Your legacy") && PET.includes("pp-ng-beast"));
ok("the battle pet's choice goes to newGame", /Core\.newGame\(\{mode: newGameMode, from, pets: ngPets, beast: ngBeast/.test(PET));
ok("the You tab shows prestige marks", PET.includes("Core.prestigeView(s)") && PET.includes("<span>Prestige</span>"));
ok("the Talents tab says the legacy's points and the free respec", PET.includes("from your legacy") && PET.includes("your prestige marks, once a game"));
ok("slot cards carry the legacy", (() => { const s = finished("thief", 20); return C.slotSummary(s, T0).legacy.cls === "thief"; })());


console.log("\nNew Game Plus keeps your old classes' weapons (2026-10-20)\n");
{
  const old = finished("hunter", 30, {berserker: 12, paladin: 1});
  const L = C.legacyOf(old);
  ok("the legacy lists every class you levelled (Hunter 30, Berserker 12 -- not a Paladin left at 1)", L.oldClasses.map((x) => x.cls).sort().join() === "berserker,hunter", JSON.stringify(L.oldClasses));
  let s = fresh(old); s.story = {on: false};
  ok("  the new game remembers them", J(s.player.oldClasses).sort().join() === "berserker,hunter", J(s.player.oldClasses));
  s = A(s, "class", {cls: "arcane"}).state;
  ["attack", "ranged", "magic", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[30]; });
  const cls = (c) => Object.keys(C.ITEMS).find((k) => C.ITEMS[k].gear && C.ITEMS[k].gear.cls === c && C.ITEMS[k].gear.slot === "weapon" && !(C.WEAR[k] && Object.values(C.WEAR[k]).some((v) => v > 30)));
  const hw = cls("hunter"), bw = cls("berserker"), pw = cls("paladin");
  Object.assign(s.bag, {[hw]: 1, [bw]: 1, [pw]: 1});
  ok("  as an Arcane now, a Hunter's weapon still goes on (" + hw + ")", A(s, "equip", {item: hw}).ok, A(s, "equip", {item: hw}).error);
  ok("  and a Berserker's (" + bw + ")", A(s, "equip", {item: bw}).ok, A(s, "equip", {item: bw}).error);
  ok("  but not a Paladin's: you never levelled one (" + pw + ")", !A(s, "equip", {item: pw}).ok);
  ok("  the old classes' weapons stay on when you switch class", (() => { let t = A(s, "equip", {item: bw}).state; t.player.freeSwitch = true; t = A(t, "class", {cls: "thief", guild: true}).state; return t.player.gear.weapon === bw; })());
  let n = fresh(finished("hunter", 30, {berserker: 12})); n.story = {on: false}; n = A(n, "class", {cls: "arcane"}).state;
  const n2 = fresh(J(Object.assign(J(n), {hunt: {jungle: {wins: 1, kills: 20}}})));
  ok("  carried on through the next New Game Plus too (and that game's own class joins them)", ["hunter", "berserker"].every((k) => n2.player.oldClasses.includes(k)), J(n2.player.oldClasses));
  ok("  the save slot's legacy card says so", /The weapons and armour of every class you levelled/.test(PET));
}
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
