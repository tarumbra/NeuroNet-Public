/* Battle Re-work, Part 1 (2026-10-15): foundations. Cam: "secondary weapons ... if they run out of runes or arrows they
   default to their secondary weapon. For all classes if durability of both primary and secondary weapons break then they
   default to fists." The off hand, falling back, weapon wear and re-tempering (Cam's Q5), the swap, and the effects later
   parts put on fights (traps, nets, stuns, poison ...) with diminishing returns. The plan: the "Battle Re-Work" notebook.
   Run: node test/test_pet_battle_foundations.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 15, 8);
const fresh = () => { const s = C.act(C.advance(C.empty(), T0), "player", {name: "Tester"}, T0).state; s.story = {on: false};
  ["attack", "ranged", "defence", "magic"].forEach((k) => { s.player.skills[k] = C.XP[20]; }); s.player.skills.hitpoints = C.XP[30]; s.player.hp = 30; return s; };
const fight = (s, mon, hp) => { const holder = {seed: 4242}; const r = C.startBattle(s, s.player, "hunt", "farmyard", mon || "pig", T0, holder);
  if (r.out) return r; const b = s.player.battle; b.mhp = hp || 999; return b; };
const round = (s, b, n) => { let res = ""; for (let i = 0; i < (n || 1) && !res; i++) { s.player.hp = 30; res = C.battleRound(s, s.player, b, T0 + i * 2400); } return res; };

console.log("\nThe off hand\n");
{
  let s = fresh(); Object.assign(s.bag, {bronzesword: 1, ironsword: 1, shortbow: 1, logs: 5});
  s = C.act(s, "equip", {item: "bronzesword"}, T0).state;
  ok("a stone or a log won't go in the off hand -- only a weapon", /Only a weapon/.test(C.act(s, "offhand", {item: "logs"}, T0).error));
  ok("  nor your main weapon, unless you have a second", /you'd need a second/.test(C.act(s, "offhand", {item: "bronzesword"}, T0).error));
  const r = C.act(s, "offhand", {item: "ironsword"}, T0);
  ok("a second weapon goes in the off hand", r.ok && r.state.player.gear.offhand === "ironsword" && /off hand/i.test(r.msg));
  s = r.state;
  const g1 = C.gearSum(s.player.gear, s.player.cls), g0 = C.gearSum({weapon: "bronzesword"}, s.player.cls);
  ok("  a spare weapon there adds nothing to your gear (it only counts in your hand)", JSON.stringify(g1) === JSON.stringify(g0));
  ok("  and it can be put away", C.act(s, "offhand", {item: ""}, T0).state.player.gear.offhand === undefined);
  const v = C.playerView(s, T0);
  ok("the view has both weapons with their wear", v.weapons.main.id === "bronzesword" && v.weapons.off.id === "ironsword" && v.weapons.main.dur === C.weaponDur("bronzesword") && v.weapons.off.left === C.weaponDur("ironsword"));
}

console.log("\nFalling back: main, then the off hand, then fists\n");
{
  let s = fresh(); Object.assign(s.bag, {shortbow: 1, bronzesword: 1});
  s.player.gear = {weapon: "shortbow"};
  ok("a bow with no arrows and nothing else: no fight, as before", !!C.startBattle(s, s.player, "hunt", "farmyard", "pig", T0, {seed: 1}).out);
  s.player.gear.offhand = "bronzesword";
  const b = fight(s);
  ok("  with a sword in the off hand: the fight starts, and you fight with the sword", !b.out && b.me.wid === "bronzesword" && b.me.wfrom === "offhand" && b.me.dtype === "slash", JSON.stringify(b.me && {wid: b.me.wid, from: b.me.wfrom}));
  round(s, b);
  ok("  the fight log names the sword", s.player.battle.rounds.some((x) => x.by === "you" && x.w === "Bronze sword"));
  let s2 = fresh(); s2.player.gear = {};
  const b2 = fight(s2);
  ok("no weapon at all: fists", b2.me.wid === "" && b2.me.wname === "fists");
}
{
  let s = fresh(); Object.assign(s.bag, {oakwand: 1, bronzesword: 1});
  s.player.skills.magic = C.XP[20]; s.player.gear = {weapon: "oakwand", offhand: "bronzesword"}; s.player.loadout = ["windstrike"];
  const b = fight(s); round(s, b, 2);
  const mine = s.player.battle.rounds.filter((x) => x.by === "you");
  ok("the Arcane out of runes bashes with the off hand's sword, not fists", s.player.battle.cast === "Bronze sword" && mine.every((x) => x.w === "Bronze sword"), JSON.stringify(mine.slice(0, 2)));
  ok("  and it's the sword that wears", (s.player.wear || {}).bronzesword === 2 && !(s.player.wear || {}).oakwand, JSON.stringify(s.player.wear));
}

console.log("\nWeapon wear\n");
{
  ok("a weapon lasts longer the higher its level (bronze, steel, a boss's)", C.weaponDur("bronzesword") < C.weaponDur("steelsword") && C.weaponDur("steelsword") < C.weaponDur("khopesh") && C.weaponDur("khopesh") <= C.WEAPON_WEAR.max);
  let s = fresh(); Object.assign(s.bag, {bronzesword: 1});
  s.player.gear = {weapon: "bronzesword"};
  const b = fight(s); round(s, b, 3);
  ok("each blow wears it by one", s.player.wear.bronzesword === 3);
  const dur = C.weaponDur("bronzesword");
  s.player.wear.bronzesword = Math.ceil(dur * 0.75) - 1; round(s, s.player.battle);
  ok("  warned at three-quarters", s.log.some((l) => /bronze sword is wearing out/i.test(l.text || l.msg || JSON.stringify(l))), JSON.stringify(s.log[0]));
}
{
  let s = fresh(); Object.assign(s.bag, {bronzesword: 1, ironsword: 1});
  s.player.gear = {weapon: "bronzesword", offhand: "ironsword"};
  const b = fight(s); s.player.wear = {bronzesword: C.weaponDur("bronzesword") - 1};
  round(s, b);
  ok("worn out, it breaks: gone from the bag and your hand", !s.bag.bronzesword && s.player.gear.weapon === undefined && s.player.battle.rounds.some((x) => x.broke === "Bronze sword"));
  ok("  and the off hand's sword takes over in the same fight", s.player.battle.me.wid === "ironsword" && s.player.battle.me.wfrom === "offhand");
  s.player.wear.ironsword = C.weaponDur("ironsword") - 1; round(s, s.player.battle);
  ok("  both broken: fists", s.player.battle.me.wid === "" && !s.player.gear.offhand && s.player.battle.me.wname === "fists");
}
{
  let s = fresh(); Object.assign(s.bag, {bronzesword: 2});
  s.player.gear = {weapon: "bronzesword"};
  const b = fight(s); s.player.wear = {bronzesword: C.weaponDur("bronzesword") - 1}; round(s, b);
  ok("a spare of the same in the bag: you pick it up and fight on", s.bag.bronzesword === 1 && s.player.gear.weapon === "bronzesword" && s.player.wear.bronzesword === 0);
}

console.log("\nRe-tempering (once)\n");
{
  let s = fresh(); Object.assign(s.bag, {bronzesword: 1, bronzebar: 10, oak: 10});
  s.player.gear = {weapon: "bronzesword"};
  ok("not before it's three-quarters worn", /isn't worn enough/.test(C.act(s, "retemper", {item: "bronzesword"}, T0).error));
  const dur = C.weaponDur("bronzesword"); s.player.wear = {bronzesword: Math.ceil(dur * 0.8)};
  const rc = C.retemperCost("bronzesword"), bars0 = s.bag.bronzebar;
  const r = C.act(s, "retemper", {item: "bronzesword"}, T0);
  ok("at 75% or more: as good as new, for a third of its bars", r.ok && r.state.player.wear.bronzesword === 0 && r.state.player.tempered.bronzesword === true
     && Object.keys(rc.needs).length && r.state.bag.bronzebar === bars0 - rc.needs.bronzebar, JSON.stringify(rc) + " " + (r.error || ""));
  s = r.state; s.player.wear.bronzesword = Math.ceil(dur * 0.8);
  ok("  only once", /can't be again|once already/.test(C.act(s, "retemper", {item: "bronzesword"}, T0).error));
  ok("  a weapon nobody makes costs a third of its price in coins", C.retemperCost("khopesh").coins > 0 || Object.keys(C.retemperCost("khopesh").needs).length > 0);
  ok("  and the Equipment page says it's ready; the Grindstone does it (one home, C4 D3)", C.playerView(fresh(), T0).weapons.main === null && /pp-retemper-at/.test(PET) && !/data-retemper/.test(PET) && /pp-grind/.test(PET) && /slot === "offhand"/.test(PET) && /function openSlotPicker/.test(PET));
}

console.log("\nSwapping in a fight\n");
{
  let s = fresh(); Object.assign(s.bag, {bronzesword: 1, ironsword: 1});
  s.player.gear = {weapon: "bronzesword"};
  fight(s);
  ok("no off-hand weapon: nothing to swap to", /no weapon in your off hand/.test(C.act(s, "battle", {cmd: "swap"}, T0).error));
  { let q = fresh(); Object.assign(q.bag, {bronzesword: 1, ironsword: 1}); q.player.gear = {weapon: "bronzesword", offhand: "ironsword"};
    const r0 = C.act(q, "battle", {cmd: "swap"}, T0);
    ok("between fights, Swap just changes hands for the next fight", r0.ok && r0.state.player.gear.weapon === "ironsword" && r0.state.player.gear.offhand === "bronzesword"); }
  s.player.gear.offhand = "ironsword";
  const r = C.act(s, "battle", {cmd: "swap"}, T0);
  ok("Swap: the off hand's weapon in your hand, the other in the off hand", r.ok && r.state.player.gear.weapon === "ironsword" && r.state.player.gear.offhand === "bronzesword" && r.state.player.battle.me.wid === "ironsword");
  s = r.state; round(s, s.player.battle);
  ok("  it costs your next attack", s.player.battle.rounds.some((x) => x.by === "you" && x.swap) && !s.player.battle.rounds.some((x) => x.by === "you" && x.w));
  let s2 = fresh(); Object.assign(s2.bag, {bronzesword: 1, shortbow: 1}); s2.player.gear = {weapon: "bronzesword", offhand: "shortbow"}; fight(s2);
  ok("  a bow with no arrows can't be swapped to", /no arrows/.test(C.act(s2, "battle", {cmd: "swap"}, T0).error) && s2.player.gear.weapon === "bronzesword");
}

console.log("\nEffects\n");
{
  let s = fresh(); const b = fight(s, "pig");
  ok("nothing puts an effect on yet: a fight has none", !b.fx || (!b.fx.them.length && !b.fx.you.length));
  const n = C.addEffect(b, "them", "netted", {rounds: 2}, T0);
  round(s, b, 2);
  const theirs = b.rounds.filter((x) => x.by === "them");
  ok("netted for 2: the creature loses its next 2 turns", n === 2 && theirs.length === 2 && theirs.every((x) => x.held === "netted"), JSON.stringify(theirs));
  round(s, b);
  ok("  then it acts again", !b.rounds.filter((x) => x.by === "them").slice(-1)[0].held);
  ok("diminishing returns: the second lasts half, the third a quarter (none of 2)", C.addEffect(b, "them", "trapped", {rounds: 2}, T0) === 1 && C.addEffect(b, "them", "stunned", {rounds: 2}, T0) === 0
     && b.rounds.some((x) => x.resisted));
  let sb = fresh(); const bb = fight(sb, "gideon");
  ok("a boss: half as long, and never more than 2 rounds", C.addEffect(bb, "them", "trapped", {rounds: 6}, T0) === 2 && C.addEffect(bb, "them", "netted", {rounds: 4}, T0) === 1);
  let sl = fresh(); const bl = fight(sl, "chicken");
  ok("your level against the creature's: a round more for each 10 levels above it", C.addEffect(bl, "them", "netted", {rounds: 1, lvl: 21}, T0) === 3);
  C.MONSTERS.pig.immune = ["poison", "control"];
  let si = fresh(); const bi = fight(si, "pig");
  ok("immune creatures shrug it off (poison, or anything that holds them)", C.addEffect(bi, "them", "poisoned", {power: 3}, T0) === 0 && C.addEffect(bi, "them", "stunned", {rounds: 2}, T0) === 0 && bi.rounds.some((x) => x.immune));
  delete C.MONSTERS.pig.immune;
}
{
  let s = fresh(); const b = fight(s, "pig", 100);
  C.addEffect(b, "them", "poisoned", {rounds: 3, power: 4, stack: 2}, T0);
  C.addEffect(b, "them", "poisoned", {rounds: 3, power: 4, stack: 2}, T0);
  C.addEffect(b, "them", "poisoned", {rounds: 3, power: 4, stack: 2}, T0);
  ok("poison stacks up to its cap (here 2); one more only refreshes", b.fx.them.filter((e) => e.kind === "poisoned").length === 2);
  const before = b.mhp; C.fxTick(s, s.player, b, T0);
  ok("  each round, each stack hurts", b.mhp === before - 8 && b.rounds.filter((x) => x.by === "fx" && x.hit === 4).length === 2);
  C.addEffect(b, "you", "poisoned", {rounds: 2, power: 3}, T0); s.player.hp = 20; C.fxTick(s, s.player, b, T0);
  ok("  on you too, and armour doesn't help against poison", s.player.hp === 17);
  C.addEffect(b, "them", "weakened", {rounds: 3}, T0); C.addEffect(b, "them", "brokenguard", {rounds: 3}, T0);
  ok("weakened: its blows x0.85; broken guard: its defence x0.8", C.fxMult(b, "them", "hitMult") === 0.85 && C.fxMult(b, "them", "defMult") === 0.8);
  const v = C.playerView(s, T0).battle.fx.them.map((e) => e.kind + ":" + e.stacks);
  ok("the fight's view lists each side's effects, with stacks and rounds left", v.includes("poisoned:2") && v.includes("weakened:1"), v.join());
  let s2 = fresh(); const b2 = fight(s2, "pig"); C.addEffect(b2, "them", "slowed", {rounds: 4}, T0); round(s2, b2, 4);
  const acts = b2.rounds.filter((x) => x.by === "them").map((x) => x.held ? "-" : "x").join("");
  ok("slowed: it acts every other round", acts === "x-x-" || acts === "-x-x", acts);
}
{
  const a = fresh(), b = fresh();
  const fa = fight(a, "pig"), fb = fight(b, "pig");
  C.addEffect(fa, "them", "netted", {rounds: [1, 4]}, T0); C.addEffect(fb, "them", "netted", {rounds: [1, 4]}, T0);
  ok("a random length comes from the fight's own seed: the same fight, the same rounds", fa.fx.them[0].rounds === fb.fx.them[0].rounds && fa.fx.them[0].rounds >= 1 && fa.fx.them[0].rounds <= 4);
}

console.log("\nOld saves, the graveyard, the screens\n");
{
  const old = JSON.parse(JSON.stringify(fresh())); old.v = 12; delete old.beasts; delete old.player.tempered;
  const n = C.advance(old, T0);
  ok("an old save gets room for battle pets and its weapons' re-tempering record", Array.isArray(n.beasts) && n.beasts.length === 0 && typeof n.player.tempered === "object" && n.v === C.SAVE_V);
  ok("a pet that dies is kept whole in the graveyard (to be raised later)", /pet: copy\(p\)/.test(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8")));
  ok("the fight screen shows effects, both weapons with their wear, and Swap", /id="pp-foe-fx"/.test(PET) && /id="pp-you-weapons"/.test(PET) && /data-swap="1"/.test(PET) && /function fxText\(r, b\)/.test(PET));
}

console.log("\nPart 2: no auto-heal, the hunt plan, the purse\n");
{
  let s = fresh(); const b = fight(s, "pig"); C.addEffect(b, "them", "netted", {rounds: 3}, T0);
  s.player.hp = 10; s.player.at = T0;
  C.battleRound(s, s.player, b, T0 + 60000); C.battleRound(s, s.player, b, T0 + 120000);
  ok("in a fight, time doesn't heal you (Cam's Q3) -- two minutes of rounds, the creature netted, still 10", s.player.hp === 10, s.player.hp);
  s.player.battle = null; s.player.at = T0 + 120000; const v = C.advance(s, T0 + 300000).player;
  ok("  out of it, it does", v.hp > 10, v.hp);
}
{
  let s = fresh(); s.bag.tuna = 30; s.player.food = "tuna"; s.player.eatBelow = 0.5; s.player.retreat = 0.3;
  const b = fight(s, "pig"); b.mhp = 9999; s.player.hp = 6;
  for (let i = 0; i < 6 && s.player.battle; i++) C.battleRound(s, s.player, b, T0 + i * 2400);
  ok("nothing eats for you mid-fight: low on health, the tuna stays in the bag", s.bag.tuna === 30 && !b.rounds.some((x) => x.ate));
}
{
  let s = fresh(); s.bag.tuna = 40; s.player.food = "tuna"; s.player.eatBelow = 0.2; s.player.retreat = 0.3; s.player.hp = 8;   // above the 20% line, below safe
  const r = C.act(s, "hunt", {ground: "farmyard", roll: 0.3}, T0);
  // V16 (2026-10-19, Cam: "I want gone with auto heal, auto eat"): nobody eats for you now -- below your line you rest or eat by hand
  ok("between fights nothing eats for you (V16), and nothing stops you setting out hurt (PT30)", r.ok && r.state.bag.tuna === 40, r.error || r.state.player.hp);
  let h = fresh(); h.bag.shrimps = 30; h.player.food = "shrimps"; h.player.skills.attack = C.XP[3]; h.player.skills.defence = C.XP[3]; h.player.skills.hitpoints = C.XP[10]; h.player.hp = 10; h.player.retreat = 0.3;
  h = C.act(h, "hunt", {ground: "farmyard", roll: 0.57}, T0).state;
  const later = C.advance(h, T0 + 2 * 3600e3), trip = later.player.job || later.player.lastTrip;
  ok("  left alone it hunts on until it falls (PT30) -- the food uneaten, in the grave", !later.player.job && later.lastFall && ((later.bag.shrimps || 0) + ((later.grave && later.grave.items.shrimps) || 0)) === 30 || (later.grave === null && !later.bag.shrimps), JSON.stringify({wins: trip && trip.count, why: trip && trip.why}));
}
{
  const AC = Object.assign({}, require(path.join(APP, "ui", "pet", "content", "12-fighting.json")).AREA_COINS, {nile: require(path.join(APP, "ui", "pet", "content", "32-the-desert-and-the-nile.json"))["AREA_COINS.nile"]});
  const mid = (g) => (AC[g][0] + AC[g][1]) / 2;
  ok("the purse a kill drops is lower: hunting pays ~1.4x gathering, drops included (the Jungle 9 a kill, was 23)", mid("jungle") <= 12 && mid("meadow") <= 2 && mid("nile") <= 15);
  ok("  the plan (V16, PT30): quick-use slots (Shift+1 to 4), and nobody runs or eats for you", /"np-kit-sub">Quick slots</.test(PET) && /function quickSlotsHTML\(s\)/.test(PET) && !/Nobody runs or eats for you/.test(PET));   // (the Kit's Combat tab is their home: PT38 q1)   // (2026-10-20: no explaining writing -- the tutorial and How to Play say it)
}

console.log("\nCam's play-test report (2026-10-15): spells as moves, the grindstone, wear in the sandbox\n");
{
  let s = fresh(); s.player.skills.magic = C.XP[20]; s.bag.oakwand = 1; s.player.gear = {weapon: "oakwand"};
  Object.assign(s.bag, {airrune: 50, mindrune: 50, waterrune: 50, earthrune: 1}); s.player.loadout = ["windstrike", "waterstrike", "earthstrike"];
  const b = fight(s, "pig");
  const sv = C.playerView(s, T0).battle;
  ok("a magic fight lists your loadout as moves, each castable or not (Earth strike: not enough earth runes)", sv.magic && sv.spells.map((x) => x.id + ":" + x.can).join() === "windstrike:true,waterstrike:true,earthstrike:false");
  const r = C.act(s, "battle", {cmd: "cast", spell: "waterstrike"}, T0);
  s = r.state; round(s, s.player.battle);
  ok("  picking Water strike: it's the next cast, then back to your loadout's order", r.ok && s.player.battle.rounds.filter((x) => x.by === "you")[0].w === "Water strike" && !s.player.battle.castNext);
  ok("  a spell you can't pay for is refused, saying what's short", /not enough earth rune/.test(C.act(s, "battle", {cmd: "cast", spell: "earthstrike"}, T0).error));
  ok("  a spell not in your loadout is refused", /Spellbook/.test(C.act(s, "battle", {cmd: "cast", spell: "firestrike"}, T0).error));
  let m = fresh(); Object.assign(m.bag, {bronzesword: 1}); m.player.gear = {weapon: "bronzesword"}; fight(m, "pig");
  ok("  with a sword, there's nothing to cast", /wand or a staff/.test(C.act(m, "battle", {cmd: "cast", spell: "windstrike"}, T0).error));
  ok("  the fight screen has Cast and a menu of your spells", /data-menu="cast"/.test(PET) && /data-cast="/.test(PET));
}
{
  let s = fresh(); Object.assign(s.bag, {bronzesword: 1, ironsword: 2, shortbow: 1}); s.player.gear = {weapon: "bronzesword"};
  s.player.wear = {ironsword: C.weaponDur("ironsword") - 100};
  const gw = C.villageView(s, T0).find((w) => w.id === "grindstone");
  ok("the grindstone is a Smithy bench, beside the furnace and anvil", gw && gw.room === "smithy" && C.WORKSHOP_ORDER.indexOf("grindstone") === C.WORKSHOP_ORDER.indexOf("anvil") + 1);
  ok("  it lists every weapon you hold or carry, most worn first, with where it is", gw.grind.map((x) => x.id + "/" + x.where).join() === "ironsword/In the bag,bronzesword/In your hand,shortbow/In the bag", gw.grind.map((x) => x.id).join());
  ok("  and offers re-tempering only where it can be (with what it costs)", gw.grind[0].retemper && !gw.grind[1].retemper && /three-quarters/.test(gw.grind[1].why));
  ok("  it's on the workshop picture (painted by Cam, 16 October -- its scroll placed, no stand-in chip)", /"grindstone": \{"at": \[\d+, \d+, \d+, \d+\], "o": \[\d+, \d+\]\}/.test(fs.readFileSync(path.join(APP, "ui", "pet", "art", "places.js"), "utf8")) && /function grindHTML\(w\)/.test(PET));
}
{
  let s = fresh(); s.dev = {on: true, infinite: true}; Object.assign(s.bag, {bronzesword: 1}); s.player.gear = {weapon: "bronzesword"};
  const b = fight(s, "pig"); round(s, b, 2);
  ok("weapons wear in the sandbox too, infinite items or not (Cam: \"the sword never actually broke\")", s.player.wear.bronzesword === 2);
  s.player.wear.bronzesword = C.weaponDur("bronzesword") - 1; round(s, s.player.battle);
  ok("  with infinite items a broken one is replaced at once (the Plain sandbox shows it go)", s.player.wear.bronzesword === 0 && s.player.battle.rounds.some((x) => x.broke));
}

console.log("\nPT1's answer: the run on low health, early grounds only\n");
{
  const hurt = (ground, mon) => { let s = fresh(); s.player.retreat = 0.3; s.player.skills.hitpoints = C.XP[30];
    const r = C.startBattle(s, s.player, "hunt", ground, mon, T0, {seed: 9}); const b = s.player.battle; b.mhp = 999; b.n = 1; s.player.hp = 1;
    return [C.battleRound(s, s.player, b, T0 + 2400), C.playerView(s, T0).battle]; };
  const [low] = hurt("meadow", "chicken"), [high, hv] = hurt("forest", C.HUNTS.forest.monsters[0][0]);
  // PT30 (2026-10-19, Cam: "No ambiguity no auto running, whether idle or not"): no ground runs for you any more
  ok("one blow from the end, nothing runs for you -- not in the Meadow either (PT30)", low !== "fled", low);
  ok("  nor in the Forest", high !== "fled", high);
  ok("  and the fight warns you: nothing runs for you", hv && hv.noRun === true && /nothing runs for you\. Eat or Run!/.test(PET));
}

{
  // the sandbox ignores bag room when you add things (Cam, 2026-10-15: "at the moment it wont add it if my bag is full")
  let s = fresh(); s.dev = {on: true};
  const kinds = Object.keys(C.ITEMS).filter((k) => !C.ITEMS[k].gear && !C.ITEMS[k].tool).slice(0, C.bagCap(s) + 5);
  kinds.forEach((k) => { s.bag[k] = 1; });
  const full = C.bagUsed(s) >= C.bagCap(s);
  const r = C.act(s, "dev", {op: "give", item: "steelsword", n: 3}, T0);
  ok("the sandbox adds items even with a full bag", full && r.ok && r.state.bag.steelsword === 3, JSON.stringify([full, r.error, r.ok && r.state.bag.steelsword]));
  const g = C.act(r.state, "dev", {op: "giveall", n: 2}, T0);
  ok("  ...everything too", g.ok && g.state.bag.runeknife >= 2 && g.state.bag.bonearrow >= 2);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
