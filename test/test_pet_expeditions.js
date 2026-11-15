/* ==========================================================================
   NeuroPets expeditions as runs (2026-10-06).
   ==========================================================================
   Cam: "make expeditions availible at age 3 for pet ... More of a rouge like.
   Think pets have their own battle stats ... The later expeditions need to
   carry some risk if unprepared. We want to make it beneficial to equip pets
   with potions, charms, armour and food". And: "if the pet gets injured then
   you have to craft salves before your pet can start healing ... Salves will
   introduce the Apothacary Table and Alchemy skill tree".

   The game's own rules (ui/pet/petcore.js) on made-up pets -- never the save.
   ========================================================================== */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const T0 = Date.UTC(2026, 9, 6, 9);

/** A made-up pet, hatched and grown, at `lvl`, wearing `gear`. */
function petState({lvl = 1, gear = {}, species = "cat", bag = {}} = {}) {
  let s = C.empty();
  s.dev = {on: true};
  s = C.act(s, "dev", {op: "flags", instantHatch: true}, T0).state;
  s = C.act(s, "hatch", {egg: "starter", roll: 0.2}, T0).state;
  s = C.act(s, "dev", {op: "age", days: 10}, T0).state;
  s = C.advance(s, T0);
  delete s.dev;
  Object.assign(s.pet, {xp: C.XP[lvl], species, colour: "ginger", gear: Object.assign({}, gear), asleep: false, sick: false,
                        s: {full: 90, happy: 80, energy: 90, clean: 90, health: 100}, at: T0, away: null, injury: null, injuredUntil: 0});
  s.bag = Object.assign({}, bag);
  return s;
}
function runMany(area, o, n = 160) {
  const r = {cleared: 0, fell: 0, inj: {}};
  for (let i = 0; i < n; i++) {
    const s = petState(Object.assign({bag: Object.assign({}, o.pack || {})}, o));
    const a = C.act(s, "expedition", {area, pack: o.pack || {}, roll: (i * 0.618034) % 1}, T0);
    if (!a.ok) throw new Error(a.error);
    const le = C.advance(a.state, T0 + 12 * C.HOUR).pet.lastExp;
    if (le.how === "cleared") r.cleared++;
    if (le.how === "fell") r.fell++;
    if (le.injury) r.inj[le.injury] = (r.inj[le.injury] || 0) + 1;
  }
  return {clear: Math.round(100 * r.cleared / n), fell: Math.round(100 * r.fell / n), inj: r.inj};
}
const kit = (m) => ({helmet: m + "petcap", torso: m + "petcoat", feet: m + "petboots"});

console.log("\nNeuroPets expeditions\n");

/* ---- age and stats ---- */
{
  let s = C.empty(); s.dev = {on: true};
  s = C.act(s, "dev", {op: "flags", instantHatch: true}, T0).state;
  s = C.act(s, "hatch", {egg: "starter", roll: 0.2}, T0).state;
  s = C.act(s, "dev", {op: "age", days: 2}, T0).state;
  ok("expeditions from 3 days old", /from 3 days old/.test(C.act(s, "expedition", {area: "farm"}, T0).error || ""));
  s = C.act(s, "dev", {op: "age", days: 3}, T0).state;
  ok("  at 3 days it can go", C.view(C.advance(s, T0), T0).stage === "young");
}
{
  const bare = C.runFighter(petState({lvl: 10}).pet, {});
  const armoured = C.runFighter(petState({lvl: 10, gear: Object.assign(kit("iron"), {charm: "wardcharm"})}).pet, {});
  const brewed = C.runFighter(petState({lvl: 10}).pet, {petfury: 1, petvigour: 1});
  ok("a pet has battle stats from its level and kind", bare.hp > 40 && bare.att > 10 && bare.def >= 6, JSON.stringify(bare));
  ok("  armour and a charm raise its defence and health", armoured.def > bare.def + 4 && armoured.hp > bare.hp, JSON.stringify(armoured));
  ok("  draughts: vigour more health, fury more attack", brewed.hp > bare.hp && brewed.att === bare.att + 3, JSON.stringify(brewed));
  const hungry = petState({lvl: 10}); hungry.pet.s.full = 20;
  ok("  a hungry pet has less in it", C.runFighter(hungry.pet, {}).hp < bare.hp);
}

/* ---- the curve: being prepared matters, and the deep areas still bite ---- */
const farmBare = runMany("farm", {lvl: 1});
ok("the Farm is kind to a first run (level 1, nothing packed)", farmBare.clear >= 40 && farmBare.clear <= 80, JSON.stringify(farmBare));
const forestBare = runMany("forest", {lvl: 6}), forestKit = runMany("forest", {lvl: 6, gear: kit("bronze"), pack: {roastchicken: 3, petvigour: 1}});
ok("the Forest unprepared mostly fails; with armour, food and a draught it mostly clears",
  forestBare.clear <= 20 && forestKit.clear >= 80, `${JSON.stringify(forestBare)} / ${JSON.stringify(forestKit)}`);
const cavesKit = runMany("caves", {lvl: 15, gear: kit("steel"), pack: {lobster: 3, petvigour: 1}});
ok("  the Caves, fully prepared, still bite (not a sure thing)", cavesKit.clear >= 55 && cavesKit.clear <= 92, JSON.stringify(cavesKit));
ok("injuries by area: light in the Meadow, serious in the Forest, grave in the Caves",
  Object.keys(runMany("meadow", {lvl: 3}, 60).inj).every((k) => k === "light")
  && forestBare.inj.serious > 0 && !forestBare.inj.grave && (runMany("caves", {lvl: 15}, 60).inj.grave || 0) > 0);

/* ---- the pack ---- */
{
  const s = petState({lvl: 12, gear: kit("iron"), bag: {lobster: 6, petvigour: 2, poultice: 1, rawbeef: 2}});
  const tooMany = petState({lvl: 5, bag: {lobster: 1, steak: 1, carrotsoup: 1, roastchicken: 1}});
  ok("a pack holds three kinds of thing", !C.act(tooMany, "expedition", {area: "farm", pack: {lobster: 1, steak: 1, carrotsoup: 1, roastchicken: 1}}, T0).ok);
  ok("  only food, draughts or medicine", /no use on an expedition/.test(C.act(s, "expedition", {area: "farm", pack: {rawbeef: 1}}, T0).error || ""));
  const a = C.act(s, "expedition", {area: "farm", pack: {lobster: 4, petvigour: 1, poultice: 1}, roll: 0.3}, T0);
  ok("  it comes out of the bag when the pet sets off", a.ok && a.state.bag.lobster === 2 && a.state.bag.petvigour === 1, a.error || JSON.stringify(a.state.bag));
  const home = C.advance(a.state, T0 + 3 * C.HOUR);
  const used = (home.pet.lastExp.used || {}).lobster || 0;
  ok("  and what it didn't use comes home", home.bag.lobster === 2 + (4 - used), `used ${used}, bag ${home.bag.lobster}`);
}

/* ---- injuries: treated before they heal ---- */
{
  const s = petState({lvl: 6, bag: {poultice: 2, salve: 1}});
  let st = C.act(s, "expedition", {area: "forest", roll: 0.4}, T0).state;
  st.pet.away.hp = 1; st.pet.away.retreat = 0;
  st = C.advance(st, T0 + 3 * C.HOUR);
  ok("a fall in the Forest: a serious injury, untreated", st.pet.injury && st.pet.injury.sev === "serious" && !st.pet.injury.treatedAt, JSON.stringify(st.pet.injury));
  const T1 = T0 + 3 * C.HOUR;
  ok("  it won't go out, nor heal, until it's treated", /won't heal until it's treated/.test(C.act(st, "expedition", {area: "farm"}, T1).error || ""));
  ok("  a poultice isn't strong enough for a serious injury", /isn't strong enough/.test(C.act(st, "treat", {item: "poultice"}, T1).error || ""));
  const t = C.act(st, "treat", {item: "salve"}, T1);
  ok("  a healing salve is: healing starts now (8 hours)", t.ok && Math.round((t.state.pet.injuredUntil - T1) / C.HOUR) === 8, t.error);
  const later = C.advance(t.state, T1 + 8 * C.HOUR + 1000);
  ok("  and after that it can go again", C.act(later, "expedition", {area: "farm", roll: 0.1}, T1 + 8 * C.HOUR + 1000).ok);
}
{
  const s = petState({lvl: 6, bag: {salve: 1}});
  let st = C.act(s, "expedition", {area: "forest", pack: {salve: 1}, roll: 0.4}, T0).state;
  st.pet.away.hp = 1; st.pet.away.retreat = 0;
  st = C.advance(st, T0 + 3 * C.HOUR);
  ok("a salve in the pack treats the injury on the spot", st.pet.injury && st.pet.injury.treatedAt && st.pet.injuredUntil > T0, JSON.stringify(st.pet.injury));
}
{
  const s = petState({lvl: 8});
  let st = C.act(s, "expedition", {area: "farm", roll: 0.7}, T0).state;
  st = C.advance(st, T0 + 11 * C.MIN);
  const r = C.act(st, "recall", {}, T0 + 11 * C.MIN);
  ok("calling it back keeps what it found so far", r.ok && !r.state.pet.away && r.state.pet.lastExp.how === "recalled", r.error);
}
ok("the Apothecary table is Alchemy's, and makes the salves", (() => {
  const w = C.WORKSHOPS.apothecary;
  return w && w.skill === "alchemy" && ["poultice", "salve", "strongsalve", "restorative"].every((k) => w.recipes.some((r) => r.make === k))
    && !C.WORKSHOPS.herblore.recipes.some((r) => r.make === "salve");
})());

/* ---- part 2 (2026-10-06): the later areas, death, the Graveyard, areas opening up ---- */
{
  const s = petState({lvl: 25});
  ok("a later area opens once the one before it has been cleared", /opens once a pet has cleared the Caves/.test(C.act(s, "expedition", {area: "dungeons"}, T0).error || ""));
  s.cleared = {caves: 1};
  ok("  then it's open -- for every pet", C.act(s, "expedition", {area: "dungeons", roll: 0.2}, T0).ok);
  const sky = petState({lvl: 25}); sky.cleared = {dungeons: 1};
  ok("the Sky is for flying pets", /flying pet/.test(C.act(sky, "expedition", {area: "sky"}, T0).error || ""));
  sky.pet.species = "duck";
  ok("  a duck can go", C.act(sky, "expedition", {area: "sky", roll: 0.2}, T0).ok);
}
{
  // a fall in the Void: deadly 90% of the time -- find a roll that ends in death
  let dead = null, lived = 0;
  for (let i = 0; i < 30 && !dead; i++) {
    const s = petState({lvl: 50, gear: kit("rune")}); s.cleared = {devilsplains: 1};
    s.den = [{id: "d1", species: "dog", colour: "brown", name: "Rex", xp: C.XP[5], hatchAt: T0 - 10 * C.DAY, s: {full: 90, happy: 80, energy: 90, clean: 90, health: 100}, at: T0}];
    let st = C.act(s, "expedition", {area: "void", roll: i / 30}, T0).state;
    st.pet.away.hp = 1; st.pet.away.retreat = 0;
    st = C.advance(st, T0 + 2 * C.HOUR);
    if (!st.pet) dead = st; else lived++;
  }
  ok("in the deadly areas a fall can kill the pet", !!dead);
  if (dead) {
    const g = dead.graveyard[0];
    ok("  it's in the Graveyard: its name, kind, level, age, and how and where it died",
      g && g.name && g.kind && g.level === 50 && g.ageDays >= 9 && /in the Void, stage \d+ of 8/.test(g.cause) && g.area === "Void", JSON.stringify(g));
    ok("  what it wore went with it", g.gear.length === 3 && g.gear.every((x) => /Rune/.test(x)));
    ok("  the diary says so", /died in the Void/.test(dead.log.find((l) => /died/.test(l.text)).text));
    const later = C.advance(dead, T0 + 5 * C.HOUR);
    ok("  the game goes on without a companion", !later.pet && later.graveyard.length === 1);
    const r = C.act(later, "companion", {id: "d1"}, T0 + 5 * C.HOUR);
    ok("  and a pet from the den can step up", r.ok && r.state.pet && r.state.pet.name === "Rex", r.error);
    ok("  the view lists the graves", C.graveyardView(later).length === 1);
  }
  const s2 = petState({lvl: 15, gear: kit("steel")});
  let st2 = C.act(s2, "expedition", {area: "caves", roll: 0.5}, T0).state;
  st2.pet.away.hp = 1; st2.pet.away.retreat = 0;
  st2 = C.advance(st2, T0 + 6 * C.HOUR);
  ok("the Caves and before never kill -- a grave injury at worst", st2.pet && st2.pet.injury && st2.pet.injury.sev === "grave");
}
{
  const s = petState({lvl: 15, gear: kit("steel")});
  let st = C.act(s, "expedition", {area: "caves", roll: 0.11}, T0).state;
  st.pet.away.me.att = 999; st.pet.away.hp = 9999; st.pet.away.maxHp = 9999;  // a sure clear
  st = C.advance(st, T0 + 6 * C.HOUR);
  ok("clearing the Caves opens the Dungeons, and says so", st.cleared.caves === 1 && st.log.some((l) => /The Dungeons is open now/.test(l.text)));
}

/* ---- part 3 (2026-10-06): the Bestiary, relics, the Camp ---- */
{
  const s = petState({lvl: 8, gear: kit("bronze")});
  let st = C.act(s, "expedition", {area: "farm", roll: 0.3}, T0).state;
  st = C.advance(st, T0 + 2 * C.HOUR);
  const met = Object.keys(st.bestiary || {});
  ok("the Bestiary records every creature a pet meets", met.length >= 1 && met.every((k) => st.bestiary[k].met >= 1), JSON.stringify(st.bestiary));
  const view = C.bestiaryView(st);
  ok("  shown area by area: met ones with their stats, the rest unknown",
    view.length === 13 && view[0].foes.some((f) => f.met && f.hp > 0) && view[12].foes.every((f) => !f.met && f.hp === null));
  st.bestiary = {Rat: {met: 20, beaten: 16, felled: 0}};
  ok("  beaten 5 times: studied; 15: mastered -- pets hit harder", C.knowing(st, "Rat").name === "mastered" && C.knowing(st, "Rat").dmg === 2
    && C.knowing({bestiary: {Rat: {met: 6, beaten: 6}}}, "Rat").name === "studied" && C.knowing({}, "Rat").name === "");
}
{
  const s = petState({lvl: 20, gear: kit("steel")}); s.cleared = {caves: 1};
  let st = C.act(s, "expedition", {area: "dungeons", roll: 0.41}, T0).state;
  st.pet.away.me.att = 999; st.pet.away.hp = 9999; st.pet.away.maxHp = 9999;
  st = C.advance(st, T0 + 6 * C.HOUR);
  ok("clearing a later area brings home ancient relics", (st.bag.relic || 0) >= 1, JSON.stringify(st.pet.lastExp.items));
}
{
  const s = petState({lvl: 15, bag: {relic: 40, lobster: 1, steak: 1, carrotsoup: 1, roastchicken: 1}});
  ok("the Camp: an upgrade costs relics", C.act(petState({lvl: 5}), "camp", {upgrade: "pack"}, T0).error.includes("needs 4 ancient relics"));
  let st = s;
  for (const u of ["pack", "healer", "training", "scout", "phoenix"]) st = C.act(st, "camp", {upgrade: u}, T0).state;
  ok("  bought: they're kept, and the relics spent", st.camp.pack === 1 && st.camp.phoenix === 1 && st.bag.relic === 40 - 4 - 3 - 3 - 6 - 12, JSON.stringify(st.camp));
  ok("  Bigger packs: a fourth kind of thing", C.act(st, "expedition", {area: "farm", pack: {lobster: 1, steak: 1, carrotsoup: 1, roastchicken: 1}, roll: 0.2}, T0).ok);
  const plain = C.act(petState({lvl: 15}), "expedition", {area: "farm", roll: 0.2}, T0).state.pet.away.maxHp;
  const trained = C.act(st, "expedition", {area: "farm", roll: 0.2}, T0).state.pet.away.maxHp;
  ok("  the Training ground: pets set off with more health", trained > plain, `${plain} -> ${trained}`);
  let h = JSON.parse(JSON.stringify(st)); h.pet.injury = {sev: "serious", at: T0, treatedAt: null}; h.bag.salve = 1;
  const healed = C.act(h, "treat", {item: "salve"}, T0).state;
  ok("  the Healer's hut: a treated injury heals a fifth faster", Math.round((healed.pet.injuredUntil - T0) / C.MIN) === Math.round(8 * 60 * 0.8));
  let sc = C.act(st, "expedition", {area: "caves", roll: 0.3}, T0).state;
  sc.pet.away.hp = Math.floor(sc.pet.away.maxHp * 0.3); sc.pet.away.retreat = 0; sc.pet.away.stage = sc.pet.away.stages - 1;
  sc = C.advance(sc, T0 + 6 * C.HOUR);
  ok("  the Scout's tower: too hurt for the guardian, home first and unhurt", sc.pet.lastExp.how === "scouted" && !sc.pet.injury, JSON.stringify(sc.pet.lastExp && sc.pet.lastExp.how));
  // the Phoenix shrine: a fall in the Void that would kill -- once a day it doesn't
  let saved = 0, died = 0;
  for (let i = 0; i < 20; i++) {
    let v = JSON.parse(JSON.stringify(st)); v.cleared = {devilsplains: 1}; v.pet.xp = C.XP[50]; v.camp.phoenixAt = 0;
    v = C.act(v, "expedition", {area: "void", roll: i / 20}, T0).state;
    v.pet.away.hp = 1; v.pet.away.retreat = 0; v.camp.scout = 0;
    v = C.advance(v, T0 + 8 * C.HOUR);
    if (!v.pet) died++; else if (v.camp.phoenixAt) saved++;
  }
  ok("  the Phoenix shrine: a pet that would die comes home instead", saved > 0 && died === 0, `saved ${saved}, died ${died}`);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
