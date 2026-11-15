"""Pixel Pet, slice 1 (2026-10-03): a Tamagotchi-style pet, in NeuroNet
(ui/pet/, pet.py).

Cam (Notes -> Vault -> "Pixel Pet Feature"): "start really simple. With all
the basic funcitons of a tamagotchi style pet ... Lets get the foundations
working first." And the desktop widget "acts like quick feeder ... The
companion pet will appear in the desktop window and freely move back and
forth in there".

  * the rules (petcore.js) and pictures (petart.js) are ONE file each, the
    same in NeuroNet and on the desktop;
  * the rules, run in node: hatching, real-time hunger/fun/energy/clean,
    falling asleep and waking, getting ill and medicine, feeding, playing,
    a weekend away, starting over;
  * pet.py keeps the save safely (checks it, keeps the copy before);
  * it's wired in: a main section, its page, the desktop's pet.act;
  * the desktop card loads in Quickshell and asks NeuroNet to feed the pet
    (it never writes the file itself).

Nothing of Cam's is read or written: the store runs in a temp folder and the
card in a throwaway `qs` with a made-up HOME.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
PLUG = os.path.join(APP, "system", "omarchy", "plugins", "neuronet.board")
UI = os.path.join(APP, "ui")
sys.path.insert(0, APP)
passed = failed = 0


def xpless(msg):
    """A craft's message without its xp figure: recipe xp comes from one rule now (2026-10-10, M-4; test_pet_recipe_xp.js)."""
    return re.sub(r"\(\+[0-9.]+ (\w+) xp", r"(+N \1 xp", msg) if isinstance(msg, str) else msg


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def read(*p):
    with open(os.path.join(*p), encoding="utf-8") as f:
        return f.read()


print("\nNeuroPets (was Pixel Pet, then NeuroPet)\n")

# ---- one set of rules, one set of pictures --------------------------------------
core_src = read(UI, "pet", "petcore.js")
ok("the rules have no randomness (the same answer everywhere)", "Math.random" not in core_src)
ok("  and run in a browser and node (no .pragma, no modules)",
   not re.search(r"^\s*(\.pragma|import |export )", core_src, re.M))

# ---- the rules, in node ---------------------------------------------------------
node = shutil.which("node")
RULES = r'''
const fs = require("fs"), vm = require("vm");
const cx = {}; vm.createContext(cx);
vm.runInContext(fs.readFileSync(%s, "utf8") + ";this.C = PetCore;", cx);
vm.runInContext(fs.readFileSync(%s, "utf8") + ";this.A = PetArt;", cx);
const C = cx.C, A = cx.A, H = C.HOUR, D = C.DAY, out = {};
C.NOVICE.splice(0);   // these checks pin exact base xp; the novice bonus (2026-10-10) has its own tests in test_pet_balance.js
C.STORY_SWITCH.gates = false;   // nothing waits for the story here; the story (2026-10-10) has its own tests in test_pet_story.js
// the house (2026-10-07) limits what a workshop room can make; these older checks are about the recipes
// themselves, so they start with grand workshops (test_pet_house.js checks the rooms)
{ const e0 = C.empty; C.empty = () => Object.assign(e0(), {house: {kitchen: 4, smithy: 4, shed: 4, library: 4, bedroom: 1, storeroom: 1}});
  C.ROOM_XP[2] = C.ROOM_XP[3] = C.ROOM_XP[4] = 0; }
// the five gathering skills these checks were written for (Runecrafting joined them, 2026-10-07: its shrines are its own)
const G5 = C.GATHERING.filter((k) => k !== "runecrafting");   // (and without the rooms' extra xp, so the xp sums are the recipes' own)
let t = Date.UTC(2026, 9, 3, 9, 0, 0), s = C.empty();
const at = (ms) => C.view(C.advance(s, ms), ms);
const go = (a, o, ms) => { const r = C.act(s, a, o, ms); if (r.ok) s = r.state; return r; };

out.noPet = C.view(s, t);
out.feedNone = go("feed", {}, t).error;
// the eggs: a list of pets and their chances, a hatch time by rarity
out.eggs = C.EGG_ORDER.map((k) => [k, C.EGGS[k].hatch / C.MIN, !!C.EGGS[k].take,
  Math.round(C.odds(k).reduce((a, o) => a + o.chance, 0))]);
out.starterOdds = C.odds("starter").map((o) => [o.name, o.rarity, o.chance]);
out.rolls = [0, 0.239, 0.24, 0.5, 0.95, 0.9999].map((r) => C.rollEgg("starter", r));
out.locked = C.act(C.empty(), "hatch", {egg: "special", roll: 0.5}, t).error;
out.hatch = go("hatch", {egg: "starter", roll: 0.99}, t).msg;      // the last 6%%: a lilac frog
out.second = go("hatch", {egg: "starter", roll: 0.1}, t).error;
out.egg = at(t + 60000);
out.eggSecret = ["species", "colour", "kind", "rarity", "stats"].filter((k) => out.egg[k] != null);
out.eggFeed = go("feed", {}, t + 60000).error;
out.eggName = go("name", {name: "Early"}, t + 60000).error;
out.stillEgg = at(t + 179000).stage;
t += 3 * C.MIN + 1000;
out.hatched = at(t);
out.revealLog = C.advance(s, t).log[0].text;
out.unnamedMsg = C.act(s, "play", {}, t).msg;
out.named = go("name", {name: "  Mochi  "}, t).msg;
out.renamed = C.act(s, "name", {name: "Moch"}, t).msg;
out.oldSave = (() => { const old = {v: 1, log: [], pet: {name: "Ribbit", species: "frog", colour: "green", born: 1, hatchAt: 2, at: 3,
  s: {full: 90, happy: 90, energy: 90, clean: 90, health: 100}, asleep: false, sick: false, lastMed: 0, counts: {}}};
  const v = C.view(C.advance(old, 4), 4); return [v.name, v.named, v.kind, v.egg, v.stage]; })();
out.later12 = at(t + 12 * H);
s = C.advance(s, t + 12 * H); t += 12 * H;
out.fed = go("feed", {food: "kibble"}, t);
out.fullAfter = at(t).stats.full;
out.treatClean = (() => { const b = at(t).stats.clean; go("feed", {food: "treat"}, t); return [b, at(t).stats.clean]; })();
for (let i = 0; i < 4; i++) go("feed", {food: "kibble"}, t);
out.tooFull = go("feed", {food: "berry"}, t).msg;
out.play = go("play", {}, t);
out.rest = go("rest", {}, t).msg;
out.feedAsleep = go("feed", {}, t).error;
out.asleepView = at(t + 1000);
out.wokeAlone = at(t + 8 * H);                 // 16/h back to 100 -> wakes on its own
s = C.advance(s, t + 8 * H); t += 8 * H;
out.logHasWoke = s.log.some((e) => /woke up, rested/.test(e.text));
out.cleanNot = go("clean", {}, t);
// a weekend away: starving and filthy, so ill
const away = t + 2.5 * D;
out.weekend = at(away);
s = C.advance(s, away); t = away;
out.medicine = go("medicine", {}, t);
out.medAgain = go("medicine", {}, t + 30 * C.MIN).error;
out.playSick = (() => { const v = at(t); return v.sick ? go("play", {}, t).error : "not sick"; })();
// a month away is only counted up to sixty days: still a sensible pet
out.yearAway = at(t + 365 * D);
out.ageReady = at(s.pet.hatchAt + 5 * D + H);
out.deterministic = JSON.stringify(C.advance(s, t + 3 * D)) === JSON.stringify(C.advance(s, t + 3 * D));
out.untouched = (() => { const before = JSON.stringify(s); C.advance(s, t + D); C.act(s, "feed", {}, t + D); return before === JSON.stringify(s); })();
out.unknown = go("dance", {}, t).error;
out.release = go("release", {}, t).msg;
out.afterRelease = C.view(s, t).has;
out.noRoll = (() => { const r = C.act(C.empty(), "hatch", {egg: "starter"}, t); return !!(r.ok && C.PETS[r.state.pet.species + "/" + r.state.pet.colour]); })();
// the pictures: every species and mood is 16 x 16, every item drawable
const moods = ["ok", "happy", "sad", "hungry", "sleepy", "dirty", "sick", "asleep"];
out.sizes = [];
for (const sp of Object.keys(C.SPECIES)) for (const m of moods) for (const chew of [false, true]) {
  const f = A.frame(sp, m, false, chew); out.sizes.push(f.length + "x" + [...new Set(f.map((r) => r.length))].join("/"));
  for (const col of C.SPECIES[sp].colours) { const p = A.palette(sp, col); if (!p || !p.o || Object.keys(p).length < 3) out.badPal = sp + col; }
}
out.eggLooks = C.EGG_ORDER.map((k) => A.item("egg", k).pal.s);
out.items = ["egg", "poop", "heart", "kibble", "berry", "treat", "pill", "soap"].map((n) => {
  const it = A.item(n, "cat", "ginger"); let cells = 0, missing = [];
  it.rows.forEach((r) => [...r].forEach((ch) => { if (ch !== ".") { cells++; if (!it.pal[ch]) missing.push(ch); } }));
  return [n, cells, missing.join("")];
});
// ---- slice 2: you, gathering, the bag --------------------------------------------
{
  let g = C.empty(), T = Date.UTC(2026, 9, 4, 8, 0, 0);
  const G = (a, o, ms) => { const r = C.act(g, a, o, ms); if (r.ok) g = r.state; return r; };
  out.bag0 = C.bagList(C.advance(g, T)).map((b) => b.id + ":" + b.count);
  out.noName = G("player", {name: "  "}, T).error;
  out.made = G("player", {name: "Cam", look: {skin: 1, hair: 2, outfit: 3}}, T).msg;
  out.pv0 = C.playerView(C.advance(g, T), T);
  out.spotLocked = G("trip", {skill: "mining", spot: "cave", roll: 0.2}, T).error;
  out.noPick = G("trip", {skill: "mining", spot: "copperrocks", roll: 0.2}, T).error;
  out.went = G("trip", {skill: "digging", spot: "garden", roll: 0.2}, T).msg;
  const h1 = T + C.HOUR;
  out.hour = C.playerView(C.advance(g, h1), h1);
  out.hourBag = Object.values(C.playerView(C.advance(g, h1), h1).job.items).reduce((a, b) => a + b, 0);
  out.split = JSON.stringify(C.advance(C.advance(C.advance(g, T + 0.3 * C.HOUR), T + 5 * C.HOUR), T + 13 * C.HOUR).bag)
          === JSON.stringify(C.advance(g, T + 13 * C.HOUR).bag);
  const after = C.advance(g, T + 13 * C.HOUR);
  out.after = C.playerView(after, T + 13 * C.HOUR);
  out.afterLog = after.log.map((e) => e.text);
  // home early: the trip so far is kept
  let g2 = C.act(C.act(C.empty(), "player", {name: "Cam"}, T).state, "trip", {skill: "foraging", spot: "meadow", roll: 0.7}, T).state;
  const home = C.act(g2, "home", {}, T + 10 * C.MIN + 1000);
  out.home = [home.msg, C.playerView(home.state, T + 11 * C.MIN).lastTrip.count];
  out.notOut = C.act(home.state, "home", {}, T + 11 * C.MIN).error;
  // the companion: a frog boosts Fishing (+10%%, +20%% happy); a cat does not
  const fishXP = (sp, roll, happy) => {
    let x = C.act(C.empty(), "player", {name: "Cam"}, T).state;
    if (sp) { x = C.act(x, "hatch", {egg: "starter", roll}, T - 3 * C.HOUR).state; x = C.advance(x, T); x.pet.s.happy = happy; x.pet.gene = {sex: "f", nature: "calm", stats: {hp: 5, att: 5, def: 5, agi: 5, knack: 5}}; }   // an average pet: no knack either way
    x = C.act(x, "trip", {skill: "fishing", spot: "pond", roll: 0.5}, T).state;
    return C.playerView(C.advance(x, T + 30 * C.MIN + 1000), T + 30 * C.MIN + 1000).skills.fishing.xp;
  };
  out.boost = [fishXP(false), fishXP(true, 0.95, 60), fishXP(true, 0.95, 100), fishXP(true, 0.01, 100)];   // none, frog, happy frog, cat
  // feeding from the bag
  let f = C.act(C.empty(), "hatch", {egg: "starter", roll: 0.5}, T - C.HOUR).state;
  f = C.act(f, "feed", {food: "berry"}, T).state;
  out.berryLeft = f.bag.berry;
  f.bag.treat = 0;
  out.noTreat = C.act(f, "feed", {food: "treat"}, T).error;
  out.notFood = C.act(f, "feed", {food: "stone"}, T).error;
  out.kibble = C.act(f, "feed", {food: "kibble"}, T).ok;
  f.bag.trout = 2;
  f.pet.s.full = 10;
  const tr = C.act(f, "feed", {food: "trout"}, T);
  out.trout = [tr.msg, tr.state.bag.trout, Math.round(C.view(tr.state, T).stats.full)];
  out.xp50 = [C.XP[2], C.XP[10], C.XP[50], C.levelOf(10 ** 9)];
  out.spots = G5.map((k) => C.SKILLS[k].spots.filter((x) => !x.essence && x.area === "pasture").map((x) => x.area + " " + x.level).join(","));
  // every area has its own sub-areas now (2026-10-03), rising in level area by area
  out.subareas = G5.map((k) => C.HUNT_ORDER.filter((a) => a !== "hollowcrypt").map((a) => C.SKILLS[k].spots.filter((x) => !x.essence && !x.secret && !x.rune && x.area === a).map((x) => x.level).join("/")).join(" "));   // (hidden spots: the world map's, 2026-10-07)
  out.subLoot = C.GATHERING.every((k) => C.SKILLS[k].spots.every((x) => x.loot.every((l) => C.ITEMS[l[0]] && A.itemArt(l[0])) && (!x.rare || A.itemArt(x.rare[0]))));
  // Cam: "i cant get mushrooms" -- Foraging 4 had none (only the Woodland edge, level 5); now from level 1
  out.mushroomsAt = Math.min(...C.SKILLS.foraging.spots.filter((x) => x.loot.some((l) => l[0] === "mushroom")).map((x) => x.level));
  // essence spots: one per skill in every area, opened by beating its boss 50 times (2026-10-03)
  {
    const Es = out.ess = {};
    Es.spots = G5.map((k) => C.SKILLS[k].spots.filter((x) => x.essence).map((x) => x.area).join(","));
    Es.items = G5.map((k) => [C.ITEMS[k + "essence"] && C.ITEMS[k + "essence"].name, !!A.itemArt(k + "essence")]);
    let e = C.act(C.empty(), "player", {name: "E"}, 0).state;
    Es.locked = C.act(e, "trip", {skill: "foraging", spot: "essence-farmyard", roll: 0.3}, 0).error;
    Es.lockView = C.playerView(e, 0).skills.foraging.spots.find((x) => x.id === "essence-farmyard").lock;
    e.hunt = {farmyard: {kills: 0, wins: 50, losses: 0}};
    Es.levelLock = C.act(e, "trip", {skill: "foraging", spot: "essence-pasture", roll: 0.3}, 0).error;
    e = C.act(e, "trip", {skill: "foraging", spot: "essence-farmyard", roll: 0.3}, 0).state;
    const eh = C.advance(e, C.HOUR);
    Es.got = [eh.bag.foragingessence, Object.keys(eh.player.job.items)];
    Es.describe = C.describe("miningessence");
    Es.petNo = C.SKILLS.fishing.spots.filter((x) => x.essence).length;
  }
  out.loot = C.GATHERING.every((k) => C.SKILLS[k].spots.every((x) => x.loot.every((l) => C.ITEMS[l[0]]) && (!x.rare || C.ITEMS[x.rare[0]])));
  out.gems = Object.values(C.ITEMS).every((i) => Number.isInteger(i.gem) && i.gem >= 0 && i.gem <= 10);
  out.noArt = Object.keys(C.ITEMS).filter((k) => !A.itemArt(k));
  out.avatars = [];
  for (let sk = 0; sk < 3; sk++) for (let h = 0; h < 5; h++) for (let o = 0; o < 4; o++) {
    const av = A.avatar({skin: sk, hair: h, outfit: o});
    if (av.rows.length !== 16 || av.rows.some((r) => r.length !== 16) || av.rows.join("").split("").some((ch) => ch !== "." && !av.pal[ch])) out.avatars.push([sk, h, o]);
  }
}
// ---- slice 3: the village -----------------------------------------------------------
{
  let v = C.act(C.empty(), "player", {name: "Cam"}, 0).state, T = 0;
  const V = (a, o) => { const r = C.act(v, a, o, T); if (r.ok) v = r.state; return r; };
  out.v = {};
  /* the isle without crafters (2026-10-04): ore smelted into bars at the furnace, bars smithed
     at the anvil -- your Smelting and Smithing, and coins for the fire */
  out.v.short = V("craft", {workshop: "anvil", make: "bronzepick"}).error;
  out.v.nobody = V("craft", {workshop: "anvil", make: "fishpie"}).error;
  Object.assign(v.bag, {copper: 25, tin: 25, twigs: 20});    // five of each a bar (2026-10-09)
  out.v.coins0 = v.coins;
  out.v.smelt = V("craft", {workshop: "furnace", make: "bronzebar"}).msg;
  for (let i = 0; i < 4; i++) V("craft", {workshop: "furnace", make: "bronzebar"});
  out.v.made = V("craft", {workshop: "anvil", make: "bronzepick"}).msg;
  out.v.used = [v.bag.copper, v.bag.tin, v.bag.twigs, v.bag.bronzebar, v.bag.bronzepick, v.coins];
  out.v.ironLocked = (() => { v.bag.ironpick = 1; return V("equip", {item: "ironpick"}).error; })();
  out.v.equip = V("equip", {item: "bronzepick"}).msg;
  V("trip", {skill: "mining", spot: "copperrocks", roll: 0.2});
  T = C.HOUR;
  out.v.fasterFinds = C.playerView(C.advance(v, T), T).job.count;
  out.v.gear = C.playerView(v, T).tools.mining;
  // the kitchen: Cooking is a skill, recipes open by level
  out.v.cookLocked = V("craft", {workshop: "kitchen", make: "grilledtrout"}).error;
  Object.assign(v.bag, {berry: 40, acorn: 20});
  out.v.cooked = V("craft", {workshop: "kitchen", make: "berrytart"}).msg;
  out.v.cookXP = C.playerView(v, T).skills.cooking.xp;
  for (let i = 0; i < 10; i++) V("craft", {workshop: "kitchen", make: "treat"});   // 12 + 80 xp: level 2 at 83
  out.v.cookLevel = C.playerView(v, T).skills.cooking.level;
  // equipment: a ring, a necklace, armour -- one per slot; they change the next trip
  Object.assign(v.bag, {copperring: 1, amethystcharm: 1, pearlcharm: 1, bronzehelm: 1, ironplate: 1});
  out.v.ironPlateLocked = V("equip", {item: "ironplate"}).error;                     // iron: Defence 10
  v.player.skills.defence = C.XP[10];
  V("equip", {item: "copperring"}); V("equip", {item: "amethystcharm"});            // both rings: the second replaces the first
  V("equip", {item: "pearlcharm"}); V("equip", {item: "bronzehelm"}); V("equip", {item: "ironplate"});
  out.v.worn = v.player.gear;
  V("home"); V("trip", {skill: "mining", spot: "copperrocks", roll: 0.2});
  out.v.trip = [v.player.job.rareMult, v.player.job.xpBonus, v.player.job.every];
  out.v.unequip = V("unequip", {item: "amethystcharm"}).msg;
  v.bag.leafhat = 1;
  out.v.petNone = V("equip", {item: "leafhat"}).error;
  // an old save's one charm finds its slot
  const old = C.advance({v: 1, log: [], bag: {}, pet: null, player: {name: "Cam", made: true, skills: {}, charm: "pearlcharm"}}, 0);
  out.v.migrated = [old.player.gear.necklace, "charm" in old.player];
  // potions and furniture for the pet
  v = C.act(v, "hatch", {egg: "starter", roll: 0.5}, T - 5 * C.HOUR).state; v = C.advance(v, T);
  v.pet.s.energy = 10; v.pet.sick = true; v.pet.s.health = 30;
  Object.assign(v.bag, {tonic: 1, salve: 1, petbed: 1, toybox: 1});
  out.v.tonic = [V("use", {item: "tonic"}).ok, Math.round(v.pet.s.energy)];
  out.v.salve = [V("use", {item: "salve"}).ok, v.pet.sick, Math.round(v.pet.s.health)];
  out.v.noTonic = V("use", {item: "tonic"}).error;
  out.v.place = [V("place", {item: "petbed"}).msg, V("place", {item: "petbed"}).error, v.room];
  // a toy box: fun falls slower
  const fun = (box) => { let x = C.act(C.empty(), "hatch", {egg: "starter", roll: 0.5}, 0).state; x = C.advance(x, 4 * 60e3);
    x.pet.s.happy = 90; x.pet.s.full = 90; x.pet.s.clean = 90; x.pet.at = 4 * 60e3; if (box) x.room = {toybox: true};
    return Math.round(C.advance(x, 4 * 60e3 + 4 * C.HOUR).pet.s.happy); };
  out.v.toybox = [fun(false), fun(true)];
  out.v.village = C.villageView(v, new Date(2026, 9, 5, 12).getTime()).map((w) => [w.id, w.recipes.length]);
  out.v.recipesReal = C.WORKSHOP_ORDER.every((k) => C.WORKSHOPS[k].recipes.every((r) => C.ITEMS[r.make] && Object.keys(r.needs).every((n) => C.ITEMS[n])));
  out.v.room = (() => { const calls = []; const cx = {set fillStyle(x) { calls.push(x); }, fillRect() { calls.push("r"); }};
    A.drawRoom(cx, 300, 100, 3, {bed: true, toybox: true, rug: true}); return calls.filter((c) => c === "r").length; })();
}
// ---- equipment for pets: slots by body ----
{
  const Q = out.q = {};
  let x = C.empty(); x.dev = {on: true, instantHatch: true};
  x = C.act(x, "hatch", {egg: "starter", roll: 0.95}, 0).state;           // a frog: no tail
  Object.assign(x.bag, {tailribbon: 1, leafhat: 1, wovenvest: 1, pawboots: 1, clovercharm: 1});
  x.pet.xp = C.XP[5];                                                 // the clover charm needs a level 5 pet
  Q.noTail = C.act(x, "equip", {item: "tailribbon"}, 1000).error;
  for (const k of ["leafhat", "wovenvest", "pawboots", "clovercharm"]) x = C.act(x, "equip", {item: k}, 1000).state;
  Q.frogSlots = C.view(x, 1000).gear.map((g) => g.slot);
  Q.worn = C.view(x, 1000).worn;
  x = C.act(x, "dev", {op: "age", days: 5}, 1000).state;
  x = C.act(x, "dev", {op: "fill"}, 1000).state; x.pet.s.happy = 50;
  Q.chance = C.expeditionsView(x, 1000)[0].chance;
  let cat = C.act(Object.assign(C.empty(), {dev: {on: true, instantHatch: true}}), "hatch", {egg: "starter", roll: 0.01}, 0).state;
  cat.bag.tailribbon = 1; cat.pet.xp = C.XP[3];
  Q.catSlots = C.view(cat, 1000).gear.map((g) => g.slot);
  Q.catTail = C.act(cat, "equip", {item: "tailribbon"}, 1000).msg;
  Q.playerSlots = C.PLAYER_SLOTS;
}
// ---- slice 5: the hatchery, the den, your companion, the Petapedia ------------------------
{
  const H = out.h = {};
  let x = C.empty(), T = Date.UTC(2026, 9, 6, 9);
  x.dev = {on: true, instantHatch: true};
  const X = (a, o, at) => { const r = C.act(x, a, o, at == null ? T : at); if (r.ok) x = r.state; return r; };
  X("hatch", {egg: "starter", roll: 0.95}); X("name", {name: "Ribbit"});
  x.dev.instantHatch = false;
  Object.assign(x.bag, {commonegg: 2, rareegg: 1});
  H.inHatchery = X("hatch", {egg: "common", roll: 0.1}).msg;
  X("hatch", {egg: "rare", roll: 0.5});
  H.full = X("hatch", {egg: "common", roll: 0.6}).error;
  H.eggsLeft = x.bag.commonegg;
  H.hv = C.hatcheryView(x, T + 60e3);
  H.secret = JSON.stringify(H.hv).includes("cat") || JSON.stringify(H.hv).includes("frog");
  const later = C.advance(x, T + 61 * C.MIN);
  H.hatched = later.log.slice(0, 2).map((e) => e.text);
  H.pets = C.petsView(later, T + 61 * C.MIN).map((p) => [p.name, p.companion, p.kind]);
  H.dex = C.dexView(later).map((d) => d.found ? d.name : "?");
  H.dexHides = C.dexView(later).filter((d) => !d.found).every((d) => d.name === "???" && !d.rarity && !d.eggs.length);
  x = later; T += 61 * C.MIN;
  const cat = C.petsView(x, T)[1];
  H.natural = [cat.skills.lumbering.natural, cat.skills.foraging.natural];
  H.compTrip = X("pettrip", {id: C.petsView(x, T)[0].id, skill: "mining", spot: "copperrocks"}).error;
  H.sent = X("pettrip", {id: cat.id, skill: "lumbering", spot: "copse", roll: 0.4}).msg;
  H.closed = X("pettrip", {id: cat.id, skill: "mining", spot: "cave", roll: 0.4}).error;
  const g = C.advance(x, T + C.HOUR);
  H.gathered = [C.petsView(g, T + C.HOUR)[1].job.count, C.petsView(g, T + C.HOUR)[1].skills.lumbering.level];
  H.named = X("petname", {id: cat.id, name: "Mochi"}).msg;
  H.swap = X("companion", {id: cat.id}, T + 10 * C.MIN).msg;
  H.after = C.petsView(x, T + 10 * C.MIN).map((p) => [p.name, p.companion, !!p.job]);
  H.lastTrip = C.petsView(x, T + 10 * C.MIN)[0].lastTrip.count;
  // the warp moves the hatchery and the den on too
  x.bag.commonegg = 1;
  X("hatch", {egg: "common", roll: 0.2}, T + 10 * C.MIN);
  X("dev", {op: "warp", hours: 1}, T + 10 * C.MIN);
  H.warped = C.petsView(C.advance(x, T + 10 * C.MIN), T + 10 * C.MIN).length;
}
// ---- the tailor, the hunt, your health, game over ------------------------------------------
{
  const K = out.k = {};
  let x = C.act(C.empty(), "player", {name: "Cam"}, 0).state, T = 0;
  x.player.skills.crafting = C.XP[10];                          // the tailor's work is your Crafting now
  const X = (a, o) => { const r = C.act(x, a, o, T); if (r.ok) x = r.state; return r; };
  K.meadowCotton = C.SKILLS.foraging.spots.some((sp) => sp.level <= 2 && sp.loot[0][0] === "cotton");
  Object.assign(x.bag, {cotton: 30, cowhide: 1});     // fifteen cotton a thread (2026-10-09)
  K.thread = X("craft", {workshop: "spinning", make: "thread"}).msg;     // thread is spun (2026-10-09)
  X("craft", {workshop: "spinning", make: "thread"});
  K.cloth = X("craft", {workshop: "crafting", make: "cloth"}).msg;
  K.leather = X("craft", {workshop: "tanner", make: "leather"}).msg;
  Object.assign(x.bag, {cloth: 3});
  K.noNeedle = X("craft", {workshop: "crafting", make: "cottonshirt"}).error;
  Object.assign(x.bag, {copper: 5, tin: 5});
  X("craft", {workshop: "furnace", make: "bronzebar"});
  K.needles = X("craft", {workshop: "anvil", make: "needle"}).msg;
  K.shirt = X("craft", {workshop: "crafting", make: "cottonshirt"}).msg;
  K.needleKept = x.bag.needle;
  K.petClothesMoved = ["wovenvest", "pawboots", "tailribbon", "cottonshirt", "leathertunic"].every((k) => C.WORKSHOPS.crafting.recipes.some((r) => r.make === k));
  const pv = C.playerView(C.advance(x, T), T);
  K.start = [pv.hp, pv.maxHp, pv.combatLevel, pv.skills.hitpoints.level, pv.retreat];
  K.pastureLocked = X("hunt", {ground: "pasture", roll: 0.3}).error;
  K.went = X("hunt", {ground: "farmyard", roll: 0.3}).msg;
  const h = C.advance(x, T + 5 * C.MIN);                                     // (PT30: nobody runs for you -- a short hunt, before a new player tires)
  const hv = C.playerView(h, T + 5 * C.MIN);
  const ht = hv.job || h.player.lastTrip || {count: 0, items: {}}, hi = (h.player.job || h.player.lastTrip || {}).items || {};   // (what the trip found: a fall puts the bag in the grave, PT30)
  K.hunted = [ht.count, (hi.feather || 0) > 0, (hi.rawpoultry || 0) > 0];
  K.split = JSON.stringify(C.advance(C.advance(x, T + 2 * C.MIN), T + 5 * C.MIN).bag) === JSON.stringify(h.bag);
  const hurt = JSON.parse(JSON.stringify(x)); hurt.player.hp = 3.4;          // one bad fight from the end
  const hurtLater = C.advance(hurt, T + C.HOUR);
  K.retreated = hurtLater.log.some((e) => /^You fell to /.test(e.text)) && !!hurtLater.lastFall;   // PT30: no running for you -- you fall
  const later = C.advance(x, T + 3 * C.HOUR);
  const rested = C.advance(hurt, T + 3 * C.HOUR);                            // home since the retreat: healed
  K.healed = [C.playerView(rested, T + 3 * C.HOUR).hp, C.playerView(rested, T + 3 * C.HOUR).maxHp];
  // eating
  x = later; T += 3 * C.HOUR; x.player.hp = 3; x.player.at = T;
  x.bag.steak = 1;
  K.eat = [X("eat", {item: "steak"}).msg, Math.floor(x.player.hp), Math.min(13, C.playerView(x, T).maxHp)];
  K.notFood = X("eat", {item: "stone"}).error;
  // death: no retreat, a weak player among the cows
  X("settings", {retreat: 0});
  x.player.skills.attack = C.XP[10]; x.player.skills.defence = C.XP[5];
  X("hunt", {ground: "pasture", roll: 0.5});
  x.player.hp = 1;
  const skillsBefore = JSON.stringify(x.player.skills), petBefore = !!x.pet;
  const dead = C.advance(x, T + 4 * C.HOUR);
  // a fall (2026-10-06): everything carried is gone, you wake at home and play on
  K.dead = [C.playerView(dead, T + 4 * C.HOUR).dead, dead.log[0].text];
  K.fell = [Object.keys(dead.bag).length, dead.coins, Object.keys(dead.player.gear).length, Object.keys(dead.player.tools).length,
            !!dead.player.job, dead.player.hp > 0, !!(dead.lastFall && dead.lastFall.lost), petBefore === !!dead.pet];
  K.overFeed = C.act(dead, "feed", {}, T + 4 * C.HOUR).error;
  K.playsOn = C.act(dead, "hunt", {ground: "farmyard", roll: 0.2}, T + 4 * C.HOUR).ok;
  const again = C.act(dead, "restart", {}, T + 4 * C.HOUR);
  K.restart = [again.msg, again.error || ""];
  K.aliveRestart = C.act(C.act(C.empty(), "player", {name: "A"}, 0).state, "restart", {}, 0).error;
  // balance audit 2026-10-05: regen grows with Hitpoints, armour takes a share off, auto-eat, one-blow retreat
  {
    const P = (lv) => { const z = C.act(C.empty(), "player", {name: "B"}, 0).state;
      Object.assign(z.player.skills, {attack: C.XP[lv], defence: C.XP[lv], hitpoints: C.XP[Math.max(10, lv)]}); z.player.hp = Math.max(10, lv); z.player.at = 0; return z; };
    K.regen = [C.regenRate(P(1).player), C.regenRate(P(50).player)];
    K.cut = [C.armourCut(40), C.armourCut(1000), C.armourCut(0)];
    let z = P(20); const Z = (a, o, t) => { const r = C.act(z, a, o, t || 0); if (r.ok) z = r.state; return r; };
    z.bag.tuna = 40;
    K.foodBad = Z("settings", {food: "stone"}).error;
    K.foodOk = Z("settings", {food: "tuna"}).msg;
    K.below = Z("settings", {eatBelow: 0.6}).msg;
    Z("hunt", {ground: "meadow", roll: 0.4});   // (2026-10-15: the Meadow -- from the Forest on, nothing runs for you mid-fight)
    z.player.hp = 5;
    const zh = C.advance(z, 2 * C.HOUR), trip = zh.player.job || zh.player.lastTrip || {};
    K.ate = [trip.ate ? trip.ate.tuna : 0, (zh.bag.tuna || 0) + ((zh.grave && zh.grave.items.tuna) || 0), Math.round(zh.player.hp), !zh.player.dead];   // (PT30: it may fall -- the tuna's then in the grave, uneaten)
    // one blow from the end: you run, whatever your retreat line says
    let deaths = 0, fled = 0;
    for (let i = 0; i < 24; i++) {
      let g = P(1); g.hunt = {farmyard: {kills: 999, wins: 0, losses: 0}};
      g = C.act(g, "boss", {ground: "farmyard", roll: 0.01 + i * 0.04}, 0).state;
      const gd = C.advance(g, 30 * C.MIN);
      if (gd.player.dead || (gd.lastFall && gd.lastFall.by === "Gideon Fox")) deaths++;   // (PT30: a fall counts -- nobody runs for you)
      if (gd.lastBoss && gd.lastBoss.fled) fled++;
    }
    K.gideon = [deaths, fled];
    let w = P(1); w.player.retreat = 0.1; w.player.hp = 2;
    K.tooHurt = C.act(w, "hunt", {ground: "farmyard", roll: 0.3}, 0).error || "";
    // the boss gate: the full count once, then a short rematch count (2026-10-05)
    let q = P(20); q.hunt = {farmyard: {kills: 49, wins: 0, losses: 0}};
    K.gate0 = C.act(q, "boss", {ground: "farmyard", roll: 0.2}, 0).error;
    q.hunt.farmyard.kills = 50;
    q = C.act(q, "boss", {ground: "farmyard", roll: 0.2}, 0).state;
    for (let t = 1000; q.player.battle && t < 30 * C.MIN; t += 1000) q = C.advance(q, t);      // to the end of the fight...
    if (q.player.job && q.player.job.hunt) q = C.act(q, "home", {}, q.player.at || 0).state;    // ...where hunting goes on (2026-10-11): stop it
    q = C.advance(q, 30 * C.MIN);
    const hv0 = C.huntsView(q).find((g) => g.id === "farmyard");
    K.gate1 = [q.hunt.farmyard.kills, hv0.need, hv0.unlocked, C.rematchKills(C.HUNTS.jungle), C.rematchKills(C.HUNTS.farmyard)];
    q.hunt.farmyard.kills = 10;
    K.gate2 = C.act(q, "boss", {ground: "farmyard", roll: 0.3}, 30 * C.MIN).msg || "";
    K.oldSave = C.bossNeed(C.HUNTS.coast, {kills: 0, wins: 3, losses: 0});
    K.bossDrops = ["gideon", "billy", "jack", "bambi", "snapjaw", "grizz", "basilisk"].map((b) => C.MONSTERS[b].drops[0].slice(1, 3).join("-"));
    // Snapjaw's set: snapshell at the anvil, a hard shell that takes 1 off every blow in full
    const sn = ["snapshellhelm", "snapshellplate", "snapshellgauntlets", "snapshellgreaves", "snapshellboots", "snappincers"];
    K.snapRecipes = sn.every((k) => C.WORKSHOPS.anvil.recipes.some((r) => r.make === k && r.needs.snapshell > 0));
    let sj = P(30); sj.player.skills.defence = C.XP[30];
    sn.forEach((k) => { sj.bag[k] = 1; const r = C.act(sj, "equip", {item: k}, 0); if (r.ok) sj = r.state; });
    const SET = (pre, sl) => sl.map((x) => pre + x), LS = ["cap", "body", "vambraces", "chaps", "boots"];
    const gsum = (ids, cls) => { const gg = {}; ids.forEach((k) => { gg[C.ITEMS[k].gear.slot] = k; }); return C.gearSum(gg, cls); };
    const mith = gsum(SET("mithril", ["helm", "plate", "gloves", "legs", "boots"]), "berserker");
    K.roles = [gsum(SET("armadillo", LS), "berserker").def > mith.def, gsum(SET("armadillo", LS), "hunter").def,
               gsum(SET("snake", LS), "hunter").rng, gsum(SET("snake", LS), "hunter").def, gsum(SET("bat", LS), "arcane").dodge,
               gsum(SET("grizzly", ["helm", "plate", "gauntlets", "greaves", "boots"])).def < mith.def, mith.xp > 0, C.ITEMS.leathercap.gear.speed < 1];
    const rngAt = (lv, kind) => Object.keys(C.ITEMS).filter((k) => { const g = C.ITEMS[k].gear; return g && g.who === "player" && (g.req || {}).ranged === lv && (kind === "bow" ? g.slot === "weapon" : g.slot === "ammo"); });
    K.hunter = [20, 30, 40].map((lv) => [rngAt(lv, "bow").length > 0, rngAt(lv, "ammo").length]);
    const att = (k) => C.ITEMS[k].gear.att, rq = (k) => C.ITEMS[k].gear.req.attack;
    K.swords = [["ironsword", "slystriker"], ["ironsword", "hornmaul"], ["steelsword", "snappincers"], ["mithrilsword", "grizzclaws"]].every((p2) => rq(p2[1]) < rq(p2[0]) || att(p2[0]) >= att(p2[1]));
    K.adamant = C.WORKSHOPS.furnace.recipes.some((r) => r.make === "adamantbar" && r.level === 40) && C.WORKSHOPS.fletching.recipes.some((r) => r.make === "magicbow" && r.needs.magiclog);
    // potions (2026-10-05): a combat brew lasts fights, a gathering one finds; another is drunk when one wears off
    let pt = P(20); const PT = (a2, o, t) => { const r = C.act(pt, a2, o, t || 0); if (r.ok) pt = r.state; return r; };
    pt.bag.attackpotion = 2; pt.bag.gatherdraught = 1;
    K.notPotion = PT("drink", {item: "stone"}).error;
    K.drank = PT("drink", {item: "attackpotion"}).msg;
    pt.player.brews.combat.left = 1;
    PT("hunt", {ground: "farmyard", roll: 0.2});
    const ptx = C.advance(pt, 90000);   // (no wait between fights now, 2026-10-07: a minute and a half is plenty)
    K.renew = [ptx.bag.attackpotion || 0, ptx.player.brews.combat ? ptx.player.brews.combat.id : "", ptx.log.some((e) => /attack potion wore off -- you drank another/.test(e.text))];
    let gd = P(10); gd.player.skills.foraging = C.XP[10]; gd.bag.gatherdraught = 1;
    gd = C.act(gd, "drink", {item: "gatherdraught"}, 0).state;
    let gn = P(10); gn.player.skills.foraging = C.XP[10];
    const gTrip = (z2) => C.advance(C.act(z2, "trip", {skill: "foraging", spot: "meadow", roll: 0.3}, 0).state, C.HOUR);
    const ga = gTrip(gd), gb = gTrip(gn);
    K.gatherXp = [Math.round(ga.player.skills.foraging - C.XP[10]), Math.round(gb.player.skills.foraging - C.XP[10]), ga.player.brews.gather ? ga.player.brews.gather.left : 0];
    K.herbTop = Math.max.apply(null, C.WORKSHOPS.apothecary.recipes.map((r) => r.level || 1));   // potions at the Apothecary table (2026-10-06)
    K.healPot = C.describe("superhealing");
    K.runeLine = ["adamantpick", "runepick", "adamanthelm", "runeplate", "adamantsword", "runesword", "runearrow", "runebolt"].every((k) =>
                   C.WORKSHOPS.anvil.recipes.concat(C.WORKSHOPS.fletching.recipes).some((r) => r.make === k))
                 && C.WORKSHOPS.furnace.recipes.some((r) => r.make === "runebar") && C.ITEMS.runepick.tool.tier === 6 && C.TOOL_DUR[6] > C.TOOL_DUR[4]
                 && C.WORKSHOPS.anvil.recipes.some((r) => r.make === "adamantpick" && r.needs.teak) && C.WORKSHOPS.anvil.recipes.some((r) => r.make === "runesword" && r.needs.mahogany);
    // Farming to 50 (2026-10-05): crops to 48, plots 5 and 6, a steel can that keeps a crop watered, Water all
    K.cropTop = Math.max.apply(null, C.CROP_ORDER.map((k) => C.CROPS[k].level));
    K.cropUse = ["flax", "cabbage", "sweetcorn", "dragonfruit", "starfruit"].every((k) => Object.keys(C.WORKSHOPS).some((w) => C.WORKSHOPS[w].recipes.some((r) => r.needs && r.needs[k])));
    K.cropSeeds = C.CROP_ORDER.every((k) => C.SKILLS.foraging.spots.some((sp) => sp.loot.some((l) => l[0] === C.CROPS[k].seed)) || C.MERCHANT_STOCK.some((m) => m[0] === C.CROPS[k].seed) || ["potato", "carrot", "cotton", "strawberry", "pumpkin"].indexOf(k) >= 0);
    let fm = P(1); fm.player.skills.farming = C.XP[40]; Object.assign(fm.bag, {rake: 1, hoe: 1, steelwateringcan: 1, soil: 400, potatoseed: 2});
    const FM = (o, t) => { const r = C.act(fm, "farm", Object.assign({roll: 0.5}, o), t || 0); if (r.ok) fm = r.state; return r; };
    for (let i = 0; i < 5; i++) FM({op: "unlock"});
    [0, 1].forEach((i) => { FM({op: "rake", plot: i}); FM({op: "hoe", plot: i}); FM({op: "plant", plot: i, seed: "potatoseed"}); });
    K.farm = [fm.farm.plots.length, FM({op: "waterall"}).msg];
    fm = C.advance(fm, 3 * C.HOUR);
    K.farm.push(fm.farm.plots[0].state, FM({op: "waterall"}).error);
    // tools at nine tenths: home before your last one breaks; never mended by itself (2026-10-07: mending is yours to do)
    const wearRun = (stock) => {
      let w = P(1); w.player.skills.mining = C.XP[20]; w.bag.bronzepick = 1; w.player.tools.mining = "bronzepick";
      Object.assign(w.bag, stock); w.player.wear = {bronzepick: Math.ceil(C.toolDur("bronzepick") * 0.9) - 2};
      const sp = C.SKILLS.mining.spots.find((x) => x.id === "ironoutcrop");
      w = C.act(w, "trip", {skill: "mining", spot: sp.id, roll: 0.3}, 0).state; w = C.advance(w, 2 * C.HOUR);
      return [w.bag.bronzepick || 0, !!w.player.job, (w.player.wear || {}).bronzepick || 0, w.log.map((e) => e.text).filter((t) => /bronze pickaxe/.test(t)).pop() || "", w.bag.bronzebar || 0];
    };
    K.mend = wearRun({bronzebar: 3, twigs: 2}); K.home = wearRun({});
    // wear climbs with each tier above the tool (2026-10-07): 1, 3, 6, 10 a find
    K.wearUp = [0, 1, 2, 3, 4].map((n) => C.wearFor(n));
    K.newTools = ["steelrod", "mithrilrod", "adamantrod", "runerod", "bronzetrowel", "irontrowel", "steelspade", "mithrilspade", "adamantspade", "runespade"]
      .every((k) => C.ITEMS[k].tool && C.WORKSHOPS.anvil.recipes.some((r) => r.make === k)) && C.ITEMS.magicbasket.tool.tier === 5;
    // pets (2026-10-05): every kind has a knack; boss pets only from their boss; diggers from the Burrow egg
    K.allBoost = Object.keys(C.SPECIES).filter((k) => !C.BOOSTS[k]);
    K.exoticBoss = C.odds("exotic", {}).filter((o) => o.rarity === "Legendary").length;
    K.burrow = C.odds("burrow", {}).map((o) => o.pet.split("/")[0]).every((k) => C.DIGGERS.indexOf(k) >= 0)
      && C.SKILLS.digging.spots.some((sp) => sp.level >= 30 && sp.loot.some((l) => l[0] === "burrowegg")) && A.ITEM_ART && A.palette("mole", "velvet") !== null;
    const withPet = (species, colour) => { let q = P(20); q.dev = {on: true, instantHatch: true}; q = C.act(q, "hatch", {egg: "starter", roll: 0.5}, 0).state; delete q.dev;
      q.pet.species = species; q.pet.colour = colour; q.pet.s.happy = 50; q.pet.gene = {sex: "f", nature: "calm", stats: {hp: 5, att: 5, def: 5, agi: 5, knack: 5}}; return q; };
    const ck = withPet("chicken", "white"); ck.player.skills.cooking = C.XP[5]; ck.bag.rawshrimp = 1; ck.bag.twigs = 1;
    const ckr = C.act(ck, "craft", {workshop: "kitchen", make: "shrimps"}, 0);
    K.chickenCook = ckr.ok ? ckr.msg : ckr.error;
    K.companionDoes = [C.playerView(withPet("wolf", "grey"), 0).companionDoes, C.playerView(ck, 0).companionDoes];
    // uses for sell-only things (2026-10-05): pelts tan, sulphur fluxes, essences enchant amulets, nests open; a recipe by its index
    let am = P(1); am.player.skills.gemology = C.XP[32]; am.player.skills.foraging = C.XP[30]; Object.assign(am.bag, {foragingessence: 10, goldbar: 1, sapphire: 1});
    const amr = C.act(am, "craft", {workshop: "gemology", make: "foragingamulet"}, 0); am = amr.state || am;
    am = C.act(am, "equip", {item: "foragingamulet"}, 0).state;
    const amt = C.act(am, "trip", {skill: "foraging", spot: "meadow", roll: 0.3}, 0).state.player.job;
    const sp0 = C.SKILLS.foraging.spots.find((x) => x.id === "meadow");
    K.amulet = [amr.ok, amt.xpBonus, amt.every / (sp0.time * 1000), C.describe("foragingamulet")];
    let tn = P(1); tn.player.skills.crafting = C.XP[20]; tn.bag.sealskin = 1; tn.coins = 100;
    const ti = C.WORKSHOPS.tanner.recipes.findIndex((r) => r.needs.sealskin);
    tn = C.act(tn, "craft", {workshop: "tanner", make: "leather", i: ti}, 0).state;
    let tc = P(1); tc.bag.cowhide = 1; tc.coins = 100;
    tc = C.act(tc, "craft", {workshop: "tanner", make: "leather"}, 0).state;
    K.tanned = [tn.bag.leather, tn.bag.sealskin || 0, tc.bag.leather, tc.bag.cowhide || 0];
    let ns = P(1); ns.bag.nest = 1;
    const nr = C.act(ns, "open", {item: "nest", roll: 0.4}, 0);
    K.nest = nr.ok && nr.got.length === 2 && nr.got.every((k) => C.ITEMS[k].seed || k === "acorn");
    // the spinning wheel (2026-10-05): flax picked in a field, spun with sap into bow strings; wool into balls for knitting
    let sw = P(1); sw.player.skills.crafting = C.XP[10]; Object.assign(sw.bag, {flax: 10, sap: 5, wool: 4, needle: 1});   // x5 (2026-10-09)
    const SW = (o) => { const r = C.act(sw, "craft", o, 0); if (r.ok) sw = r.state; return r.ok ? r.msg : r.error; };
    K.wheel = [SW({workshop: "spinning", make: "bowstring"}), SW({workshop: "spinning", make: "bowstring"}),
               ...[0, 1, 2, 3].map(() => SW({workshop: "spinning", make: "ballofwool"})), SW({workshop: "crafting", make: "woollyjumper"}),
               sw.bag.bowstring, sw.bag.flax, C.SKILLS.foraging.spots.some((x) => x.id === "flaxfield" && x.level === 10 && x.loot[0][0] === "flax"),
               C.WORKSHOPS.crafting.recipes.some((r) => r.make === "bowstring")];
    K.snapWorn = [Object.values(sj.player.gear).filter((k) => /^snap/.test(k)).length, C.describe("snapshellplate"), C.describe("snappincers"),
                  C.worstHit(C.MONSTERS.crab, {dr: 0, soak: 1}), C.worstHit(C.MONSTERS.crab, {dr: 0})];
  }
  // a den pet hunts; loses -> hurt, home
  let y = C.empty(); y.dev = {on: true, instantHatch: true};
  y = C.act(y, "hatch", {egg: "starter", roll: 0.5}, 0).state;
  y = C.act(y, "hatch", {egg: "starter", roll: 0.2}, 0).state;          // (allEggs off: refused)
  y.dev.allEggs = true;
  y = C.act(y, "hatch", {egg: "starter", roll: 0.2}, 0).state;
  y = C.advance(y, 1000);
  const dp = C.petsView(y, 1000).find((p) => !p.companion);
  y = C.act(y, "pethunt", {id: dp.id, ground: "farmyard", roll: 0.4}, 1000).state;
  const yh = C.advance(y, 1000 + C.HOUR);
  const dq = yh.den[0];
  K.petHunt = [dq.xp > 0, !!(dq.lastTrip || dq.job), yh.log.some((e) => / (came home|was hurt and came home) from the Farmyard| reached level /.test(e.text)) || !!dq.job];
  K.monsters = Object.keys(C.MONSTERS);
}
// ---- breeding -------------------------------------------------------------------------------
{
  const B = out.b = {};
  let x = C.empty(), T = Date.UTC(2026, 9, 7, 9);
  x.dev = {on: true, instantHatch: true, allEggs: true};
  const X = (a, o, at) => { const r = C.act(x, a, o, at == null ? T : at); if (r.ok) x = r.state; return r; };
  X("hatch", {egg: "starter", roll: 0.01}); X("hatch", {egg: "starter", roll: 0.6});
  x = C.advance(x, T + 1000); T += 1000;
  const [a, b] = C.petsView(x, T).map((p) => p.id);
  B.young = X("breed", {a, b}).error;
  for (const q of [x.pet, x.den[0]]) { q.born -= 6 * C.DAY; q.hatchAt -= 6 * C.DAY; }
  x.pet.gene.sex = "m"; x.den[0].gene.sex = "f";                   // it takes a male and a female (2026-10-08)
  B.odds = C.breedingView(x, T, a, b).pair;
  B.same = X("breed", {a, b: a}).error;
  x.dev.instantHatch = false;
  B.started = X("breed", {a, b, roll: 0.4}).msg;
  B.busy = [C.breedingView(x, T).busy.layIn, X("breed", {a, b}).error, X("pettrip", {id: b, skill: "foraging", spot: "meadow"}).error,
            C.breedingView(x, T).hatcheryFree];
  const laid = C.advance(x, T + C.HOUR + 1000);
  B.laid = [laid.log[0].text, laid.hatchery.length && laid.hatchery[0].egg];
  B.secret = !JSON.stringify(C.hatcheryView(laid, T + C.HOUR + 1000)).includes("cat/");
  const hatched = C.advance(x, T + 2 * C.HOUR);
  B.hatched = hatched.log[0].text;
  x = hatched; T += 2 * C.HOUR;
  B.rest = X("breed", {a, b}).error;
  // a special pairing: two cats, level 5 each, one Lumbering 10 -> a Special egg -> a Golden Cat
  x.pet.bredAt = x.den[0].bredAt = 0;
  x.pet.xp = C.XP[5]; x.den[0].xp = C.XP[5];
  B.notYet = C.breedingView(x, T, a, b).pair.special;
  x.den[0].skills.lumbering = C.XP[10];
  B.special = C.breedingView(x, T, a, b).pair;
  B.specialMsg = X("breed", {a, b, roll: 0.2}).msg;
  const sp = C.advance(x, T + C.HOUR + 1000);
  B.specialEgg = sp.hatchery.find((h) => h.egg === "special") ? C.EGGS.special.hatch / C.HOUR : 0;
  const gold = C.advance(x, T + 4 * C.HOUR);
  B.golden = [gold.log[0].text, C.dexView(gold).filter((d) => d.found).map((d) => d.name).includes("Golden Cat")];
  B.book = C.breedingView(gold, T + 4 * C.HOUR).book.map((r) => [r.id, r.name]);
  B.specials = C.EGGS.special.pool.map((p) => p[0]);
}
// ---- classes, the fletcher, bones, seeds, the farm, digging ---------------------------------
{
  const F = out.f = {};
  let x = C.act(C.empty(), "player", {name: "Cam"}, 0).state, T = 0;
  const X = (a, o) => { const r = C.act(x, a, o, T); if (r.ok) x = r.state; return r; };
  F.arcane = C.act(JSON.parse(JSON.stringify(x)), "class", {cls: "arcane"}, T).msg;   // the Arcane is here (2026-10-07)
  F.hunter = X("class", {cls: "hunter"}).msg;
  x.player.skills.fletching = C.XP[10]; x.player.skills.smithing = C.XP[10]; x.player.skills.crafting = C.XP[10];
  Object.assign(x.bag, {birch: 15, flax: 5, sap: 5, copper: 5, tin: 5, feather: 10});
  F.shafts = X("craft", {workshop: "fletching", make: "arrowshaft"}).msg;
  F.fletchString = C.WORKSHOPS.fletching.recipes.some((r) => r.make === "bowstring");   // spun from flax only (2026-10-09)
  X("craft", {workshop: "spinning", make: "bowstring"}); X("craft", {workshop: "fletching", make: "shortbow"});
  X("craft", {workshop: "furnace", make: "bronzebar"});
  F.heads = X("craft", {workshop: "anvil", make: "bronzearrowheads"}).msg;
  F.arrows = [X("craft", {workshop: "fletching", make: "bronzearrow"}).msg, x.bag.bronzearrow];
  F.noAmmoBow = (() => { const y = JSON.parse(JSON.stringify(x)); y.player.gear.weapon = "shortbow";
    const h = C.act(y, "hunt", {ground: "farmyard", roll: 0.3}, 0).state; return C.advance(h, 2 * C.MIN).log[0].text; })();
  x.bag.leatherquiver = 1; x.player.skills.ranged = Math.max(x.player.skills.ranged || 0, C.XP[5]); X("equip", {item: "shortbow"}); X("equip", {item: "leatherquiver"}); X("equip", {item: "bronzearrow"});   // (N19: arrows only in a quiver)
  x.bag.boneaxe = 1;
  F.wrongClass = X("equip", {item: "boneaxe"}).error;
  x.player.skills.defence = C.XP[30]; x.player.skills.hitpoints = C.XP[40]; x.player.hp = C.playerView(x, 0).maxHp;   // sturdy enough to use up the arrows (and, B5, to fight on with fists)
  X("hunt", {ground: "farmyard", roll: 0.4});
  const h = C.advance(x, 30 * C.MIN);
  // (B5, 2026-10-20: an arrow a shot; out of them, your fists -- the hunt goes on, and the log says so)
  F.hunt = [h.bag.bronzearrow, h.bag.bones, (h.log.map((l) => l.text).find((t) => /Out of arrows/.test(t)) || ""), C.playerView(h, 30 * C.MIN).skills.ranged.xp > 0, C.playerView(h, 30 * C.MIN).skills.attack.xp];
  F.allBones = Object.keys(C.MONSTERS).filter((k) => !C.MONSTERS[k].mage).every((k) => C.MONSTERS[k].drops.some((d) => d[0] === "bones" && d[3] === 1));
  F.bonePlate = C.WORKSHOPS.anvil.recipes.find((r) => r.make === "boneplate").needs;
  F.boneVest = C.WORKSHOPS.crafting.recipes.find((r) => r.make === "bonevest").needs;
  F.boneDef = [C.ITEMS.boneplate.gear.def, C.ITEMS.bronzeplate.gear.def, C.ITEMS.boneplate.gear.cls, C.ITEMS.bonevest.gear.cls];
  F.switchOff = (() => { const y = JSON.parse(JSON.stringify(x)); y.player.gear.weapon = "bonebow"; y.player.freeSwitch = 1; return C.act(y, "class", {cls: "berserker", guild: true}, 0).msg; })();
  // seeds: uncommon and up; from foraging and the hunt
  F.seedGems = ["potatoseed", "carrotseed", "cottonseed", "strawberryseed", "pumpkinseed"].map((k) => C.ITEMS[k].gem);
  F.seedFrom = [C.SKILLS.foraging.spots.some((sp) => sp.loot.some((l) => C.ITEMS[l[0]].seed)),
                Object.keys(C.MONSTERS).some((k) => C.MONSTERS[k].drops.some((d) => C.ITEMS[d[0]].seed))];
  // the farm
  let g = C.act(C.empty(), "player", {name: "Cam"}, 0).state; T = 0;
  const G = (o) => { const r = C.act(g, "farm", o, T); if (r.ok) g = r.state; return r; };
  F.oneplot = g.farm ? g.farm.plots.length : C.farmView(C.advance(g, 0), 0).plots.length;
  F.noRake = G({op: "rake", plot: 0}).error;
  Object.assign(g.bag, {rake: 1, hoe: 1, wateringcan: 1, potatoseed: 1, strawberryseed: 1});
  F.raked = G({op: "rake", plot: 0, roll: 0.5}).msg;
  F.order = G({op: "plant", plot: 0, seed: "potatoseed"}).error;
  G({op: "hoe", plot: 0});
  F.locked = G({op: "plant", plot: 0, seed: "strawberryseed"}).error;
  F.planted = G({op: "plant", plot: 0, seed: "potatoseed"}).msg;
  T = 40 * C.MIN;
  F.thirsty = C.farmView(C.advance(g, T), T).plots[0];
  for (let i = 0; i < 4; i++) { G({op: "water", plot: 0}); T += 16 * C.MIN; g = C.advance(g, T); }
  F.ripe = [C.farmView(g, T).plots[0].state, g.log[0].text];
  F.harvest = G({op: "harvest", plot: 0, roll: 0.5}).msg;
  F.after = [C.farmView(g, T).plots[0].state, C.farmView(g, T).plots[0].weed];
  F.weeds = (G({op: "rake", plot: 0, roll: 0.9}).msg || "");
  F.unlockLevel = G({op: "unlock"}).error;
  g.player.skills.farming = C.XP[5];
  F.unlockSoil = G({op: "unlock"}).error;
  g.bag.soil = 10;
  F.unlocked = [G({op: "unlock"}).msg, C.farmView(g, T).plots.length, g.bag.soil];
  // digging finds soil; only digger pets dig
  F.soilFrom = C.SKILLS.digging.spots[0].loot[0][0];
  let d = C.empty(); d.dev = {on: true, instantHatch: true, allEggs: true};
  d = C.act(d, "hatch", {egg: "starter", roll: 0.1}, 0).state; d = C.act(d, "hatch", {egg: "starter", roll: 0.1}, 0).state; d = C.advance(d, 1000);
  F.petDig = C.act(d, "pettrip", {id: d.den[0].id, skill: "digging", spot: "garden"}, 1000).error;
  // 2026-10-03: cows drop no seeds; digging finds dung (and early things); dung -> fertiliser
  F.cowSeeds = C.MONSTERS.cow.drops.filter((x) => C.ITEMS[x[0]].seed).length;
  F.pumpkinFrom = C.SKILLS.foraging.spots.concat(C.SKILLS.digging.spots).some((sp) => sp.loot.some((l) => l[0] === "pumpkinseed"));
  F.digLoot = C.SKILLS.digging.spots[0].loot.map((l) => l[0]);
  F.fertRecipes = C.WORKSHOPS.compost.recipes.filter((r) => C.ITEMS[r.make].fert).map((r) => [r.make, r.needs]);
  let fz = C.act(C.empty(), "player", {name: "Cam"}, 0).state; T = 0;
  Object.assign(fz.bag, {rake: 1, hoe: 1, wateringcan: 1, potatoseed: 2, fertiliser: 1});
  for (const o of [{op: "rake", plot: 0, roll: 0.3}, {op: "hoe", plot: 0}, {op: "plant", plot: 0, seed: "potatoseed"}, {op: "water", plot: 0}])
    fz = C.act(fz, "farm", o, 0).state;
  F.fertNotGrowing = C.act(C.act(C.empty(), "player", {name: "C"}, 0).state, "farm", {op: "fertilise", plot: 0, item: "fertiliser"}, 0).error;
  const fr = C.act(fz, "farm", {op: "fertilise", plot: 0, item: "fertiliser"}, 0);
  F.fert = [fr.msg, C.act(fr.state, "farm", {op: "fertilise", plot: 0, item: "fertiliser"}, 0).error];
  F.fertStage = [C.farmView(C.advance(fr.state, 12 * C.MIN), 12 * C.MIN).plots[0].stage, C.farmView(C.advance(fz, 12 * C.MIN), 12 * C.MIN).plots[0].stage];
  // flint: arrows before metal
  // (I11, 2026-10-20: made in the bag now -- chisel on flint, then shaft + head + feather; none at the fletching bench)
  F.flint = C.FIELD_RECIPES.list.filter((r) => r.makes.startsWith("flint")).map((r) => [r.makes, r.n, Object.keys(r.needs).sort().join("+")])
            .concat(C.WORKSHOPS.fletching.recipes.filter((r) => r.make.startsWith("flint")).map((r) => ["bench:" + r.make]));
}
// ---- your making skills level up (2026-10-04: they were the crafters' levels) ----------------
{
  const N = out.n = {};
  let x = C.act(C.empty(), "player", {name: "Cam"}, 0).state;
  x.coins = 1000;
  Object.assign(x.bag, {bronzebar: 300, ironbar: 20, oak: 5});
  N.locked = C.act(x, "craft", {workshop: "anvil", make: "bronzeplate"}, 0).error;
  N.view0 = C.villageView(x, 0).find((w) => w.id === "anvil").recipes.find((r) => r.make === "bronzeplate");
  for (let i = 0; i < 300 && C.villageView(x, 0).find((w) => w.id === "anvil").level < 5; i++) { x = C.act(x, "craft", {workshop: "anvil", make: "bronzearrowheads"}, 0).state; delete x.bag.bronzearrowheads; }   // until level 5 (recipe xp from one rule, 2026-10-10); put away each time: a stack holds 250
  N.level = C.villageView(x, 0).find((w) => w.id === "anvil").level;
  N.log = x.log.find((e) => /Smithing level 5!/.test(e.text)).text;
  N.nowPlate = C.act(x, "craft", {workshop: "anvil", make: "bronzeplate"}, 0).ok;
  N.ironLocked = C.act(x, "craft", {workshop: "anvil", make: "ironplate"}, 0).error;
  N.tiers = [C.CRAFT_LEVELS.bronzeplate, C.CRAFT_LEVELS.boneplate, C.CRAFT_LEVELS.ironplate, C.CRAFT_LEVELS.compoundbow];
  N.allSkills = C.WORKSHOP_ORDER.filter((k) => !C.WORKSHOPS[k].npc).every((k) => C.SKILLS[C.WORKSHOPS[k].skill]
    && C.WORKSHOPS[k].recipes.every((r) => r.level >= 1));
  N.kitchen = C.villageView(x, 0).find((w) => w.id === "kitchen").skill;
  let d = C.empty(); d.dev = {on: true};
  N.dev = C.act(d, "dev", {op: "level", skill: "fletching", level: 20}, 0).msg;
  /* an old save: what the crafters had learned is yours */
  N.migrated = C.advance({v: 1, pet: null, log: [], player: {name: "Old", made: true, skills: {}, tools: {}, gear: {}}, bag: {},
                          village: {blacksmith: C.XP[10], fletcher: C.XP[5], jeweler: C.XP[3], tailor: 100, carpenter: 50}, gifts: ["smallnet"]}, 0);
  N.migratedLv = ["smithing", "fletching", "gemology", "crafting"].map((k) => C.playerView(N.migrated, 0).skills[k].level).concat([N.migrated.coins]);
  delete N.migrated;
}
// ---- 2026-10-03: fragments, tools first, wear levels, combat types and specials -------------
{
  const M = out.m = {};
  let x = C.act(C.empty(), "player", {name: "Cam"}, 0).state;
  M.quarryTin = (() => { const t = C.SKILLS.mining.spots.find((x) => x.id === "tinrocks"); return !!t && t.level === 1 && t.loot[0][0] === "tin"; })();
  M.digFrags = ["copperfrag", "tinfrag"].every((k) => C.SKILLS.digging.spots[0].loot.some((l) => l[0] === k));
  x.bag.copperfrag = 12;
  M.combine = C.act(x, "combine", {item: "copperfrag", all: true}, 0);
  M.combined = [M.combine.msg, M.combine.state.bag.copper, M.combine.state.bag.copperfrag];
  M.notEnough = C.act(C.act(x, "combine", {item: "copperfrag", all: true}, 0).state, "combine", {item: "copperfrag"}, 0).error;
  M.pickCost = C.WORKSHOPS.anvil.recipes.find((r) => r.make === "bronzepick").needs;
  // lumbering: twigs only without a hatchet
  let l = C.act(x, "trip", {skill: "lumbering", spot: "copse", roll: 0.3}, 0).state;
  M.twigs = Object.keys(C.playerView(C.advance(l, C.HOUR), C.HOUR).job.items);
  l = JSON.parse(JSON.stringify(x)); l.bag.bronzehatchet = 1; l.player.tools.lumbering = "bronzehatchet";
  l = C.act(l, "trip", {skill: "lumbering", spot: "copse", roll: 0.3}, 0).state;
  M.withAxe = Object.keys(C.playerView(C.advance(l, C.HOUR), C.HOUR).job.items).sort();
  // what it takes to wear things
  M.wear = ["bronzeplate", "leathertunic", "boneplate", "ironplate", "bonebow", "compoundbow", "tailribbon"].map((k) => C.ITEMS[k].gear.req);
  M.softLeather = C.ITEMS.leather.name;
  // creatures: weaknesses and resistances; classes too; styles and specials
  M.cow = [C.MONSTERS.cow.atk, C.MONSTERS.cow.weak, C.MONSTERS.cow.resist];
  M.classes = ["hunter", "berserker"].map((k) => [Object.keys(C.CLASSES[k].specials), C.CLASSES[k].resist, C.CLASSES[k].weak]);
  const fightWith = (wpn, roll) => {
    let y = C.act(C.empty(), "player", {name: "T"}, 0).state;
    y.player.skills.attack = C.XP[10]; y.player.skills.defence = C.XP[10];
    y = C.act(y, "class", {cls: "berserker"}, 0).state;
    y.bag[wpn] = 1; y = C.act(y, "equip", {item: wpn}, 0).state;
    y.player.skills.attack = C.XP[1]; y.player.skills.defence = C.XP[25]; y.player.skills.hitpoints = C.XP[30]; y.player.hp = 30;
    y = C.act(y, "hunt", {ground: "pasture", roll}, 0).state;
    y.player.job.every = 5000;                                   // no waiting about: the fights decide it
    y = C.advance(y, 2 * C.HOUR);
    return (y.player.job || y.player.lastTrip).count;
  };
  // a sword (slash) does better against cows (weak to slash) than a club (crush, resisted)
  M.slashVsCrush = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((r) => [fightWith("bronzesword", r), fightWith("woodenclub", r)]);
  let z = C.act(C.empty(), "player", {name: "H"}, 0).state;
  z = C.act(z, "class", {cls: "hunter"}, 0).state;
  Object.assign(z.bag, {shortbow: 1, bronzearrow: 300, leatherquiver: 1}); z.player.skills.ranged = Math.max(z.player.skills.ranged || 0, C.XP[5]);
  z = C.act(z, "equip", {item: "shortbow"}, 0).state; z = C.act(z, "equip", {item: "leatherquiver"}, 0).state; z = C.act(z, "equip", {item: "bronzearrow"}, 0).state;
  M.badSpecial = C.act(z, "combat", {special: "cleave"}, 0).error;
  z = C.act(z, "combat", {special: "aimed"}, 0).state;
  z = C.act(z, "combat", {style: "defensive"}, 0).state;
  z.player.skills.hitpoints = C.XP[25]; z.player.hp = 25;                   // (PT30: nobody runs for you -- enough health for eight minutes)
  z = C.act(z, "hunt", {ground: "farmyard", roll: 0.3}, 0).state;
  const zh = C.advance(z, 8 * C.MIN), zv = C.playerView(zh, 8 * C.MIN);
  const zt = zh.player.job || zh.player.lastTrip, zf = (zh.player.job || {}).fight;
  M.hunter = [300 - (zh.bag.bronzearrow || 0) - ((zh.grave && zh.grave.items.bronzearrow) || 0) >= zt.count, zv.skills.defence.xp > 0, (zh.player.skills.ranged || 0) - (z.player.skills.ranged || 0), zt.count > 0,
              !zf || (zf.rounds.length > 0 && "won" in zf)];
}
// ---- the hunt built out: areas, bosses, unlocks, boss pets, evasion, boss sets ---------------
{
  const B2 = out.b2 = {};
  B2.areas = C.HUNT_ORDER.map((k) => [k, C.HUNTS[k].level, C.HUNTS[k].boss, C.HUNTS[k].kills]);
  B2.farmyard = C.HUNTS.farmyard.monsters.map((m) => m[0]); B2.pasture = C.HUNTS.pasture.monsters.map((m) => m[0]);
  B2.art = Object.keys(C.MONSTERS).filter((k) => !A.monster(k)).concat(Object.keys(C.PETS).filter((k) => { const [sp, c] = k.split("/");
    return A.frame(sp, "ok").length !== 16 || !A.palette(sp, c); }));
  const strong = () => { let x = C.act(C.empty(), "player", {name: "Cam"}, 0).state;
    Object.assign(x.player.skills, {attack: C.XP[20], defence: C.XP[20], hitpoints: C.XP[25]}); x.player.hp = 25;
    x = C.act(x, "class", {cls: "berserker"}, 0).state; x.bag.woodenclub = 1; return C.act(x, "equip", {item: "woodenclub"}, 0).state; };
  let x = strong();
  B2.early = C.act(x, "boss", {ground: "farmyard", roll: 0.3}, 0).error;
  x.hunt = {farmyard: {kills: 50, wins: 0, losses: 0}};
  // a boss is a live fight now: challenge, then let the rounds play out
  // (2026-10-11: a won boss fight goes straight back to hunting -- stop that hunt the moment the fight ends, so these
  // checks look at the boss alone; test_pet_hunting_fixes.js checks the hunting on)
  const bossGo = (st, o, at) => { const rr = C.act(st, "boss", o, at); if (!rr.ok) return rr;
    let s2 = rr.state, t2 = at;
    while (s2.player.battle && s2.player.battle.kind === "boss" && t2 < at + 30 * C.MIN) { t2 += 1000; s2 = C.advance(s2, t2); }
    if (s2.player.job && s2.player.job.hunt) s2 = C.act(s2, "home", {}, t2).state;
    rr.state = C.advance(s2, at + 30 * C.MIN); return rr; };
  let r = bossGo(x, {ground: "farmyard", roll: 0.3}, 0);
  B2.first = [(r.state.log.find((e) => e.text.startsWith("You beat")) || {}).text || r.state.log[0].text, r.state.hunt.farmyard.kills, r.state.hunt.farmyard.wins, !!r.state.lastBoss.rounds.length];
  x = r.state;
  B2.foxUnlocked = [r.state.log.some((e) => e.text === "Beaten once: Fox can now hatch from uncommon eggs!"),
                    C.odds("uncommon", x).some((o) => o.pet === "fox/red"), C.odds("uncommon", C.empty()).some((o) => o.pet === "fox/red")];
  x.hunt.farmyard.wins = 10;
  B2.gideonEgg = C.odds("rare", x).some((o) => o.pet === "fox/gideon");
  x.hunt.pasture = {kills: 0, wins: 15, losses: 0};
  B2.billyEgg = [C.odds("uncommon", x).some((o) => o.pet === "ram/wool"), C.odds("rare", x).some((o) => o.pet === "ram/billy")];
  // losing (or running) resets the count too
  let w = C.act(C.empty(), "player", {name: "Weak"}, 0).state;
  w.hunt = {farmyard: {kills: 50, wins: 0, losses: 0}};
  r = bossGo(w, {ground: "farmyard", roll: 0.5}, 0);
  B2.lose = [r.state.hunt.farmyard.kills, r.state.hunt.farmyard.losses, r.state.lastBoss.fled, !!r.state.player.dead];
  // kills in an area count toward its boss
  let k = strong(); k = C.act(k, "hunt", {ground: "farmyard", roll: 0.2}, 0).state;
  B2.counted = C.huntsView(C.advance(k, 30 * C.MIN))[0].kills;
  // Gideon as your companion steals; Billy fights at your side
  const withPet = (kind, lv) => { let y = strong(); y.dev = {on: true, instantHatch: true};
    y = C.act(y, "hatch", {egg: "starter", roll: 0.1}, 0).state; y = C.advance(y, 1000);
    const [sp, c] = kind.split("/"); y.pet.species = sp; y.pet.colour = c; y.pet.xp = C.XP[lv];
    y.bag.tuna = 60; y.player.food = "tuna"; return y; };   // food to eat between fights (Battle Re-work Part 2: nothing heals mid-hunt)
  let g = withPet("fox/gideon", 10); g.player.hp = C.playerView(g, 1000).maxHp; g = C.act(g, "hunt", {ground: "farmyard", roll: 0.4}, 1000).state;
  const gs = C.advance(g, 1000 + 20 * C.MIN); B2.stole = (gs.player.job || gs.player.lastTrip || {}).stolen || 0;   // (V16: the hunt may have come home -- the trip keeps the count)
  let b = withPet("ram/billy", 10); b = C.act(b, "hunt", {ground: "pasture", roll: 0.4}, 1000).state;
  const ba = C.advance(b, 1000 + 2 * C.MIN), bf = ((ba.player.job || {}).fight || {rounds: []}).rounds.concat(ba.player.battle ? ba.player.battle.rounds : []);
  B2.billy = bf.filter((x) => x.by === "pet").map((x) => x.hit);
  B2.ally = [C.playerView(g, 1000).ally && C.playerView(g, 1000).ally.does, C.playerView(b, 1000).ally && C.playerView(b, 1000).ally.does];
  // Gideon steals area eggs from bosses
  let ge = withPet("fox/gideon", 20); ge.hunt = {farmyard: {kills: 50, wins: 0, losses: 0}};
  let eggs = 0;
  for (let i = 0; i < 12; i++) { ge.hunt.farmyard.kills = 50; ge.player.hp = 25; ge.player.dead = null; const rr = bossGo(ge, {ground: "farmyard", roll: i / 12 + 0.01}, 1000 + i * C.HOUR); if (rr.ok) ge = rr.state; }
  B2.eggs = ge.bag.farmyardegg || 0;
  B2.areaEgg = C.odds("farmyard").map((o) => o.pet);
  // evasion: Bambi dodges a lot; a full Nimble Fox set takes it away
  const vsBambi = (nimble) => { let y = strong(); y.player.skills.defence = C.XP[30]; y.player.skills.attack = C.XP[30]; y.player.skills.hitpoints = C.XP[40]; y.player.hp = 40;
    if (nimble) for (const piece of ["nimblehood", "nimblejerkin", "nimblegloves", "nimblebreeches", "nimbleboots"]) { y.bag[piece] = 1; y = C.act(y, "equip", {item: piece}, 0).state; }
    y.hunt = {forest: {kills: 300, wins: 0, losses: 0}}; y.player.skills.attack = C.XP[30];
    const rr = bossGo(y, {ground: "forest", roll: 0.37}, 0); return rr.state.lastBoss.rounds.filter((x) => x.dodged && x.by === "you").length; };
  B2.dodges = [vsBambi(false), vsBambi(true)];
  // boss sets: crafted from boss materials, special effects, a special look with 3+ pieces
  B2.setRecipe = C.WORKSHOPS.crafting.recipes.find((rr) => rr.make === "nimblejerkin");
  B2.setLevel = C.CRAFT_LEVELS.nimblejerkin;
  let sk = strong(); for (const piece of ["nimblehood", "nimblejerkin", "nimblegloves"]) { sk.bag[piece] = 1; sk = C.act(sk, "equip", {item: piece}, 0).state; }
  B2.skin = C.playerView(sk, 0).skin;
  B2.sets = ["slystriker", "hornmaul", "quickshotbow", "antlerbow", "grizzclaws", "fangspear"].every((k) => C.ITEMS[k] && C.ITEMS[k].gear.req);
}
// ---- looking for prey takes 5 s to the area's cap, at random -------------------------------
{
  let y = C.act(C.empty(), "player", {name: "W"}, 0).state;
  Object.assign(y.player.skills, {attack: C.XP[30], defence: C.XP[30], hitpoints: C.XP[40]}); y.player.hp = 40;
  y = C.act(y, "hunt", {ground: "farmyard", roll: 0.6}, 0).state;
  const first = y.player.job.next;
  const later = C.advance(y, 2 * C.HOUR);
  const gaps = [];
  let t = first;
  const fights = later.player.job.count;
  out.wait = { first, fights, every: later.player.job.every,
               split: JSON.stringify(C.advance(C.advance(y, 37 * C.MIN), 2 * C.HOUR).bag) === JSON.stringify(later.bag) };
}
// ---- live battles: a round every 2.4 s; eat, special, run (2026-10-03) ---------------------
{
  const L = out.live = {};
  const mk = () => { let y = C.act(C.empty(), "player", {name: "L"}, 0).state;
    Object.assign(y.player.skills, {attack: C.XP[10], defence: C.XP[10], hitpoints: C.XP[20]}); y.player.hp = 20; return y; };
  let y = C.act(mk(), "hunt", {ground: "farmyard", roll: 0.6}, 0).state;
  const t0 = y.player.job.next;
  L.before = !!C.advance(y, t0 - 1).player.battle;
  const b1 = C.advance(y, t0 + 10).player.battle;
  L.started = b1 && [b1.kind, b1.n, b1.nextRound - t0];
  const b2 = C.advance(y, t0 + C.ROUND + 10).player.battle;
  L.round = b2 ? b2.n : "over";
  L.round1 = (C.advance(y, t0 + C.ROUND + 10).player.job.fight || b2) ? true : false;
  // split-safe: second by second, the same as one jump
  let step = y; for (let t = 0; t <= 6 * C.MIN; t += 1700) step = C.advance(step, t);
  step = C.advance(step, 6 * C.MIN);
  const jump = C.advance(y, 6 * C.MIN);
  L.split = JSON.stringify([step.bag, step.player.skills, Math.round(step.player.hp * 1000)]) === JSON.stringify([jump.bag, jump.player.skills, Math.round(jump.player.hp * 1000)]);
  // the view
  let f = C.advance(y, t0 + 10);
  const bv = C.playerView(f, t0 + 10).battle;
  L.view = bv && [bv.kind, bv.monName.length > 0, bv.mhp === bv.monHp, bv.nextIn > 0 && bv.nextIn <= C.ROUND, bv.groundName];
  // eat: heals by the food, and costs your next attack
  f.player.hp = 5; f.bag.apple = 1; f.bag.steak = 1;
  let r = C.act(f, "eat", {item: "apple"}, t0 + 20); f = r.state;
  L.ateApple = [r.msg, Math.floor(f.player.hp), f.player.battle.skip];
  r = C.act(f, "eat", {item: "steak"}, t0 + 30); f = r.state;
  L.ateSteak = Math.floor(f.player.hp);
  const fr = C.advance(f, t0 + C.ROUND + 10), fb = fr.player.battle || {rounds: (fr.player.job.fight || {}).rounds};
  L.lostTurn = fb.rounds.some((x) => x.ate);
  L.raw = C.act(f, "eat", {item: "stone"}, t0 + 40).error;
  // the special: needs a class, then the bar
  L.noClass = C.act(f, "battle", {cmd: "special"}, t0 + 40).error;
  // run: the fight's gone, the hunt goes on, you look for the next one
  r = C.act(f, "battle", {cmd: "run"}, t0 + 50);
  L.ran = [r.msg, !!r.state.player.battle, !!r.state.player.job, r.state.player.job.next >= t0 + 50 + 1000, r.state.player.job.fight.ran];
  L.notIn = C.act(r.state, "battle", {cmd: "run"}, t0 + 60).error;
  // going home mid-fight ends it
  L.home = !!C.act(C.advance(y, t0 + 10), "home", {}, t0 + 20).state.player.battle;
  // a Berserker with a full bar can set Cleave for the next round
  let z = mk(); z = C.act(z, "class", {cls: "berserker"}, 0).state; z.bag.bronzesword = 1; z = C.act(z, "equip", {item: "bronzesword"}, 0).state;
  z = C.act(z, "hunt", {ground: "farmyard", roll: 0.6}, 0).state;
  z = C.advance(z, z.player.job.next + 10); z.player.combat.special = "cleave"; z.player.fury = 20;   // fury since Part 5
  L.lowBar = C.act(z, "battle", {cmd: "special"}, z.player.job.next + 20).error;
  z.player.fury = 100;
  r = C.act(z, "battle", {cmd: "special"}, z.player.job.next + 20);
  L.queued = [r.msg, r.state.player.battle.queued];
  const zz = C.advance(r.state, r.state.player.battle.nextRound + 1);
  L.cleaved = [(zz.player.battle || zz.player.job.fight).rounds.some((x) => x.spec === "Cleave"), zz.player.fury < 100];
  // a boss: a live fight; the hunt trip ends; running counts as a loss and resets the count
  let k = mk(); k.hunt = {farmyard: {kills: 50, wins: 0, losses: 0}};
  k = C.act(k, "hunt", {ground: "farmyard", roll: 0.2}, 0).state;
  r = C.act(k, "boss", {ground: "farmyard", roll: 0.3}, 1000);
  L.boss = [r.msg, r.state.player.battle.kind, !!r.state.player.job, C.act(r.state, "boss", {ground: "farmyard"}, 1100).error,
            C.act(r.state, "hunt", {ground: "farmyard"}, 1100).error];
  const run = C.act(r.state, "battle", {cmd: "run"}, 2000).state;
  L.bossRun = [run.hunt.farmyard.kills, run.hunt.farmyard.losses, run.lastBoss.fled, !!run.player.battle];
  // the sandbox's time warp moves a fight on too
  let d = C.advance(y, t0 + 10); d.dev = {on: true}; const nr = d.player.battle.nextRound;
  d = C.act(d, "dev", {op: "warp", hours: 1}, t0 + 10).state;
  L.warp = d.player.battle ? d.player.battle.nextRound === nr - C.HOUR : "gone";
  // food heals: fruit a little, cooked food more
  L.heals = ["berry", "apple", "goatmilk", "goldapple", "steak", "pumpkinpie"].map((k) => C.ITEMS[k].heal);
}
// ---- Crafting: pottery; bowls and mugs for the kitchen; herb pots on the farm (2026-10-03) ----
{
  const Cr = out.craft = {};
  let x = C.act(C.empty(), "player", {name: "P"}, 0).state;
  const X = (a, o, t) => { const r = C.act(x, a, o, t || 0); if (r.ok) x = r.state; return r; };
  Cr.skill = [C.SKILL_ORDER.includes("crafting"), C.playerView(x, 0).skills.crafting.level];
  Cr.recipes = C.WORKSHOPS.crafting.recipes.map((r) => [r.make, r.level]);
  Cr.short = X("craft", {workshop: "crafting", make: "bowl"}).error;
  x.bag.clay = 100; x.bag.soil = 25;    // x5 (2026-10-09)
  Cr.bowl = X("craft", {workshop: "crafting", make: "bowl"}).msg;
  Cr.potLocked = X("craft", {workshop: "crafting", make: "plantpot"}).error;
  x.player.skills.crafting = C.XP[5];
  Cr.pot = X("craft", {workshop: "crafting", make: "plantpot"}).msg;
  Cr.bag = [x.bag.bowl, x.bag.plantpot, x.bag.clay];
  // the kitchen: rabbit stew needs a bowl (and uses it)
  x.player.skills.cooking = C.XP[10];
  Object.assign(x.bag, {rawrabbit: 2, potato: 2, carrot: 2});
  Cr.stew = X("craft", {workshop: "kitchen", make: "rabbitstew"}).msg;
  Cr.noBowl = X("craft", {workshop: "kitchen", make: "rabbitstew"}).error;
  Cr.pies = ["fishpie", "pumpkinpie"].map((k) => C.WORKSHOPS.kitchen.recipes.find((r) => r.make === k).needs.piedish);
  Cr.heals = ["rabbitstew", "rosemarychicken", "minttea", "chamomiletea"].map((k) => C.ITEMS[k].heal);
  // the windowsill: a pot, a herb seed, wait, pick; the pot stays
  Cr.noPot = X("farm", {op: "potplant", pot: 0, seed: "mintseed"}).error;
  Cr.added = X("farm", {op: "addpot"}).msg;
  Cr.noSeed = X("farm", {op: "potplant", pot: 0, seed: "mintseed"}).error;
  x.bag.mintseed = 1; x.bag.chamomileseed = 1;
  Cr.lowLevel = X("farm", {op: "potplant", pot: 0, seed: "chamomileseed"}).error;
  Cr.planted = X("farm", {op: "potplant", pot: 0, seed: "mintseed"}).msg;
  Cr.early = X("farm", {op: "potpick", pot: 0, roll: 0.5}, 10 * C.MIN).error;
  x = C.advance(x, 21 * C.MIN);
  Cr.readyNote = x.log[0].text;
  const fv = C.farmView(x, 21 * C.MIN);
  Cr.view = [fv.pots.length, fv.pots[0].ready, fv.herbSeeds.map((h) => h.herb)];
  x.herbarium = {mint: 1};                    // a herb you've identified grows as itself (Herblore, 2026-10-06)
  Cr.picked = X("farm", {op: "potpick", pot: 0, roll: 0.5}, 21 * C.MIN).msg;
  Cr.after = [x.bag.mint, x.farm.pots.length, x.farm.pots[0].herb];
  x.bag.mug = 1;
  x.player.skills.cooking = C.XP[10];
  Cr.tea = X("craft", {workshop: "kitchen", make: "minttea"}, 22 * C.MIN).msg;
  Cr.seedsFrom = ["mintseed", "rosemaryseed", "thymeseed", "chamomileseed", "lavenderseed"].every((k) => C.GATHERING.some((g) => C.SKILLS[g].spots.some((sp) => sp.loot.some((l) => l[0] === k))));
  Cr.art = ["bowl", "mug", "piedish", "plantpot", "mint", "rosemary", "thyme", "chamomile", "lavender", "mintseed", "lavenderseed", "rabbitstew", "herbstew",
            "rosemarychicken", "thymepork", "mintlamb", "minttea", "chamomiletea", "lavendertea"].filter((k) => !A.itemArt(k));
  const garden = C.SKILLS.digging.spots.find((sp) => sp.id === "garden").loot;
  Cr.tin = [garden.find((l) => l[0] === "tinfrag")[1], garden.find((l) => l[0] === "copperfrag")[1]];
}
// ---- tiers, RuneScape-style: fishing methods, bait, cooked fish, iron tools, the Coast (2026-10-03) ----
{
  const Ti = out.tiers = {};
  const fishOrder = C.SKILLS.fishing.spots.filter((x) => !x.essence).slice().sort((a, b) => a.level - b.level).map((x) => x.loot[0][0]);
  Ti.ladder = ["rawshrimp", "rawsardine", "rawherring", "rawanchovy", "trout", "pike", "salmon", "rawtuna", "rawrainbow", "rawlobster", "rawswordfish", "rawmonkfish", "sturgeon", "rawshark", "rawdarkcrab", "rawmanta"]
    .every((f) => fishOrder.includes(f));
  Ti.methods = [...new Set(C.SKILLS.fishing.spots.filter((x) => !x.essence).map((x) => x.method + ":" + x.needs + ":" + (x.bait || "")))].sort();
  const heal = (k) => C.ITEMS[k].heal || 0;
  Ti.rawHeals = ["rawshrimp", "trout", "rawshark"].map(heal);
  Ti.cookedHeals = ["shrimps", "sardine", "herring", "grilledtrout", "cookedpike", "cookedsalmon", "tuna", "lobster", "swordfish", "shark", "mantaray"].map(heal);
  Ti.cookRecipes = ["shrimps", "tuna", "shark", "mantaray"].map((k) => { const r = C.WORKSHOPS.kitchen.recipes.find((x) => x.make === k); return r && r.level; });
  Ti.makers = ["smallnet", "fishingrod", "flyrod", "lobstercage", "harpoon"].map((k) => C.WORKSHOP_ORDER.find((w) => C.WORKSHOPS[w].recipes.some((r) => r.make === k)));
  let y = C.act(C.empty(), "player", {name: "F"}, 0).state;
  Object.assign(y.player.skills, {fishing: C.XP[20], mining: C.XP[30], lumbering: C.XP[30]});
  Ti.noRod = C.act(y, "trip", {skill: "fishing", spot: "river", roll: 0.3}, 0).error;
  y.bag.fishingrod = 1;
  Ti.noBait = C.act(y, "trip", {skill: "fishing", spot: "river", roll: 0.3}, 0).error;
  y.bag.earthworm = 3;
  y = C.act(y, "trip", {skill: "fishing", spot: "river", roll: 0.3}, 0).state;
  const yh = C.advance(y, C.HOUR);
  Ti.bait = [yh.bag.earthworm || 0, !!yh.player.job, yh.log[0].text, Object.keys(yh.player.lastTrip.items).includes("earthworm")];
  y.bag.bronzepick = 1; y = C.act(y, "equip", {item: "bronzepick"}, 0).state;
  Ti.ironTool = C.act(y, "trip", {skill: "mining", spot: "silvervein", roll: 0.3}, 0).error;
  y.bag.ironpick = 1; y = C.act(y, "equip", {item: "ironpick"}, 0).state;
  Ti.ironOk = C.act(y, "trip", {skill: "mining", spot: "silvervein", roll: 0.3}, 0).msg;
  Ti.coast = [C.HUNTS.coast.boss, C.HUNTS.coast.monsters.map((m) => m[0]), C.EGGS.coast.pool.map((p) => p[0]), ["crab", "gull", "seal", "snapjaw"].every((m) => A.monster(m))];
  Ti.netForAll = C.act(C.empty(), "player", {name: "N"}, 0).state.bag.smallnet;
}
// ---- slice 4: expeditions, crates, found eggs; the sandbox's tools --------------------
{
  const E = out.e = {};
  let x = C.empty(), T = Date.UTC(2026, 9, 5, 9);
  const X = (a, o, at) => { const r = C.act(x, a, o, at == null ? T : at); if (r.ok) x = r.state; return r; };
  E.realDev = C.act(x, "dev", {op: "maxall"}, T).error;
  x.dev = {on: true};
  X("dev", {op: "flags", instantHatch: true});
  E.instant = X("hatch", {egg: "starter", roll: 0.95}).msg;
  E.instantLog = C.advance(x, T + 1000).log[0].text;
  E.young = X("expedition", {area: "farm", roll: 0.1}).error;
  X("dev", {op: "age", days: 3});
  E.stage = C.view(C.advance(x, T), T).stage;
  E.needLevel = X("expedition", {area: "meadow", roll: 0.1}).error;
  E.later = X("expedition", {area: "void", roll: 0.1}).error;
  x.pet.s.happy = 50;
  // runs (2026-10-06): stages on the pet's own health, a pack of food
  x.bag.carrotsoup = 5;
  E.sent = X("expedition", {area: "farm", pack: {carrotsoup: 3}, roll: 0.01}).msg;
  E.packTaken = x.bag.carrotsoup;
  const away = C.view(C.advance(x, T + 60e3), T + 60e3);
  E.away = [away.mood, away.away && away.away.areaName, away.away && away.away.backIn, away.away && away.away.stages];
  E.busy = X("feed", {}).error;
  E.back = C.view(C.advance(x, T + 31 * C.MIN), T + 31 * C.MIN);
  E.backLog = C.advance(x, T + 31 * C.MIN).log[0].text;
  E.same = JSON.stringify(C.advance(C.advance(x, T + 10 * C.MIN), T + 31 * C.MIN).bag) === JSON.stringify(C.advance(x, T + 31 * C.MIN).bag);
  x = C.advance(x, T + 31 * C.MIN); T += 31 * C.MIN;
  // a fall: the pet comes home injured, and won't heal until it's treated
  x.pet.s.full = 90; x.pet.s.energy = 90;
  X("expedition", {area: "farm", roll: 0.5});
  x.pet.away.hp = 1;                         // (one blow from the end)
  x.pet.away.retreat = 0;
  const fell = C.advance(x, T + 31 * C.MIN);
  E.fell = [fell.pet.lastExp.how, fell.pet.lastExp.injury, !!fell.pet.injury, fell.pet.injury && fell.pet.injury.treatedAt];
  x = fell; T += 31 * C.MIN;
  E.untreated = X("expedition", {area: "farm", roll: 0.1}).error;
  x.bag.poultice = 1;
  E.weak = X("treat", {item: "tonic"}).error;
  E.treated = X("treat", {item: "poultice"}).msg;
  E.healing = X("expedition", {area: "farm", roll: 0.1}).error;
  T += 2 * C.HOUR + 60e3; x = C.advance(x, T); x.pet.s.full = 90; x.pet.s.energy = 90;
  E.mended = X("expedition", {area: "farm", roll: 0.2}).ok;
  E.recall = X("recall", {}).msg;
  // area levels: 2 wins = area level 2, and at 5 trips are a quarter shorter
  X("dev", {op: "level", target: "area", area: "farm", level: 5});
  E.mastered = C.expeditionsView(x, T)[0];
  X("dev", {op: "fill"});
  X("expedition", {area: "farm", roll: 0.2});
  E.shorter = Math.round(x.pet.away.every * x.pet.away.stages / C.MIN);
  X("recall", {});
  // the pet's level, and the dev level tool
  X("dev", {op: "level", target: "pet", level: 15});
  E.petLevel = C.view(x, T).level;
  E.caves = C.expeditionsView(x, T).find((a) => a.id === "caves").open;
  E.areas = C.expeditionsView(x, T).map((a) => [a.id, a.later ? "later" : a.level]);
  // crates
  x.bag.ironcrate = 1;
  const opened = X("open", {item: "ironcrate", roll: 0.3});
  E.crate = opened.msg;
  E.crateGot = [opened.got.length, opened.got.every((k) => C.ITEMS[k])];
  E.crateGone = x.bag.ironcrate;
  // found eggs: hatched when there's no pet (after starting over)
  X("release", {});
  x.dev.instantHatch = false;
  E.noEgg = X("hatch", {egg: "rare", roll: 0.5}).error;
  x.bag.rareegg = 1;
  E.foundEgg = [X("hatch", {egg: "rare", roll: 0.5}).msg, x.bag.rareegg];
  // the sandbox's tools
  X("release", {});
  X("dev", {op: "flags", allEggs: true, instantHatch: true});
  E.allEggs = X("hatch", {egg: "special", roll: 0.5}).ok;
  X("dev", {op: "warp", hours: 2});
  E.warpAge = C.view(C.advance(x, T), T).ageHours;
  X("dev", {op: "flags", infinite: true});
  E.infinite = [C.bagList(x).length === Object.keys(C.ITEMS).length, X("craft", {workshop: "anvil", make: "bronzepick"}).ok];
  X("dev", {op: "give", item: "pearl", n: 7});
  x.dev.infinite = false;
  E.gave = x.bag.pearl;
  X("dev", {op: "maxall"});
  E.maxed = [C.playerView(x, T).totalLevel, C.view(x, T).level];
  X("player", {name: "Cam"}); X("trip", {skill: "digging", spot: "garden", roll: 0.5});
  X("dev", {op: "warp", hours: 1});
  E.warpTrip = C.playerView(C.advance(x, T), T).job.count;
}
// ---- stone tools, copper and tin rocks, iron at 15, steel and mithril, gem cutting (2026-10-04) ----
{
  const St = out.stone = {};
  let x = C.act(C.empty(), "player", {name: "P"}, 0).state;
  const X = (a, o, t) => { const r = C.act(x, a, o, t || 0); if (r.ok) x = r.state; return r; };
  const ids = C.SKILLS.mining.spots.map((sp) => sp.id);
  St.split = ["copperrocks", "tinrocks"].map((id) => { const sp = C.SKILLS.mining.spots.find((q) => q.id === id); return [sp.level, sp.loot[0][0], !!sp.soft]; });
  St.noQuarry = !ids.includes("quarry");
  St.iron = C.SKILLS.mining.spots.find((q) => q.id === "hillside").level;
  St.noPick = X("trip", {skill: "mining", spot: "tinrocks", roll: 0.2}).error;
  St.byHand = X("trip", {skill: "mining", spot: "stonewall", roll: 0.2}).msg;
  const H2 = 2 * C.HOUR;
  St.handItems = C.advance(x, H2).player.job.items;
  X("home", {}, 1);
  St.costs = ["stonepick", "stonehatchet"].map((k) => C.WORKSHOPS.crafting.recipes.find((r) => r.make === k).needs);
  Object.assign(x.bag, {stone: 150, twigs: 75});      // x5 (2026-10-09)
  St.made = [X("craft", {workshop: "crafting", make: "stonepick"}).msg, X("craft", {workshop: "crafting", make: "stonepick"}).msg];
  St.equip = X("equip", {item: "stonepick"}).msg;
  x.player.skills.mining = C.XP[15];
  St.tooSoft = X("trip", {skill: "mining", spot: "hillside", roll: 0.2}).error;
  St.went = X("trip", {skill: "mining", spot: "tinrocks", roll: 0.2}).msg;
  const after = C.advance(x, 2 * C.HOUR);
  St.after = [after.player.job, after.bag.stonepick || 0, after.bag.tin || 0, after.player.tools.mining,
              after.log.some((e) => /last stone pickaxe broke/.test(e.text))];
  /* a stone hatchet: fifteen logs, then twigs only */
  Object.assign(x.bag, {stone: 40, twigs: 30});
  X("craft", {workshop: "crafting", make: "stonehatchet"});
  X("equip", {item: "stonehatchet"});
  x.player.skills.lumbering = C.XP[8];
  St.oakSoft = X("trip", {skill: "lumbering", spot: "forest", roll: 0.2}).error;
  X("trip", {skill: "lumbering", spot: "copse", roll: 0.3});
  const lj = C.advance(x, 3 * C.HOUR);
  St.hatchet = [lj.bag.stonehatchet || 0, lj.player.tools.lumbering, (lj.player.job || lj.player.lastTrip).items.birch || 0,
                lj.log.some((e) => /only twigs now/.test(e.text))];
  /* steel and mithril at your furnace; tiers on the deep rocks */
  x.player.skills.smelting = C.XP[30]; x.player.skills.smithing = C.XP[1]; x.coins = 100;
  Object.assign(x.bag, {iron: 20, coal: 100, mithril: 10, oak: 20, willow: 20});   // x5 (2026-10-09)
  St.steel = X("craft", {workshop: "furnace", make: "steel"}).msg;
  St.steelBag = [x.bag.steel, x.bag.iron, x.bag.coal, x.coins];
  St.mithril = X("craft", {workshop: "furnace", make: "mithrilbar"}).msg;
  St.tiers = ["silvervein", "crystalcave", "goldseam"].map((id) => C.SKILLS.mining.spots.find((q) => q.id === id).toolTier);
  St.toolsNew = ["steelpick", "mithrilpick", "steelhatchet", "mithrilhatchet"].map((k) => [C.ITEMS[k].tool.tier, C.ITEMS[k].tool.level]);
  St.wear = ["steelplate", "mithrilplate", "steelsword", "mithrilsword"].map((k) => C.ITEMS[k].gear.req);
  /* Gemology: a chisel (kept) and a pot of water (used up) per gem */
  x.player.skills.gemology = C.XP[20]; x.player.skills.crafting = C.XP[5];
  x.bag.roughgem = 30;
  St.cutNoKit = X("craft", {workshop: "gemology", make: "opal"}).error;
  x.bag.clay = 20;
  St.pot = [X("craft", {workshop: "crafting", make: "claypot"}).msg, X("craft", {workshop: "crafting", make: "potofwater"}).msg];
  X("craft", {workshop: "crafting", make: "claypot"}); X("craft", {workshop: "crafting", make: "potofwater"});
  x.bag.bronzebar = 1;
  St.chisel = X("craft", {workshop: "anvil", make: "chisel"}).msg;
  St.cut = [X("craft", {workshop: "gemology", make: "opal"}).msg, X("craft", {workshop: "gemology", make: "sapphire"}).msg,
            X("craft", {workshop: "gemology", make: "emerald"}).error];
  St.cutBag = [x.bag.opal, x.bag.sapphire, x.bag.roughgem, x.bag.chisel, x.bag.potofwater || 0];
  St.noWater = X("craft", {workshop: "gemology", make: "opal"}).error;
  St.ring = C.WORKSHOPS.gemology.recipes.some((r) => r.make === "sapphirering" && r.needs.sapphire === 1);
  St.art = Object.keys(C.ITEMS).filter((k) => !A.itemArt(k) && !A.item(k));
  /* an old save, mid-trip at the Quarry */
  let o = C.act(C.empty(), "player", {name: "Old"}, 0).state;
  o.bag.bronzepick = 1; o.player.tools.mining = "bronzepick";
  o.player.job = {skill: "mining", spot: "quarry", since: 0, next: 60000, until: 12 * C.HOUR, every: 60000, seed: 5, count: 0, xp: 0, items: {}};
  St.oldTrip = Object.keys(C.advance(o, C.HOUR).player.job.items);
}
// ---- 2026-10-04: no crafters -- your skills, objects in the village, coins, wear and mending ----
{
  const Ec = out.econ = {};
  let x = C.act(C.empty(), "player", {name: "Cam"}, 0).state;
  const X = (a, o, t) => { const r = C.act(x, a, o, t || 0); if (r.ok) x = r.state; return r; };
  Ec.coins0 = x.coins;
  /* a bronze pickaxe: copper and tin forever; iron wears it */
  Object.assign(x.player.skills, {mining: C.XP[20], smithing: C.XP[10]});
  x.bag.bronzepick = 1; x.player.tools.mining = "bronzepick";
  X("trip", {skill: "mining", spot: "copperrocks", roll: 0.4});
  let y = C.advance(x, 6 * C.HOUR);
  Ec.copperWear = [(y.player.wear || {}).bronzepick || 0, y.bag.bronzepick];
  Ec.ironSpot = "hillside";
  x.player.job = null; x.player.lastTrip = null;
  X("trip", {skill: "mining", spot: Ec.ironSpot, roll: 0.4});
  Ec.durs = [C.toolDur("bronzepick"), C.toolDur("ironpick"), C.toolDur("stonepick")];
  y = C.advance(x, 2.3 * C.HOUR);
  Ec.ironWear = [(y.player.wear || {}).bronzepick || 0, y.bag.bronzepick, y.bag.iron];
  Ec.warned = y.log.some((e) => /bronze pickaxe is wearing out .* mend it at the anvil/.test(e.text));
  /* mend before it breaks: half the bars, half the fee */
  Ec.repairCost = C.repairCost("bronzepick");
  x = y; x.player.job = null;
  Ec.noBars = C.act(x, "repair", {item: "bronzepick"}, 0).error;
  x.bag.bronzebar = 3; x.bag.twigs = 10; x.coins = 10;
  Ec.mended = X("repair", {item: "bronzepick"}).msg;
  Ec.after = [(x.player.wear || {}).bronzepick || 0, x.bag.bronzebar || 0, x.bag.twigs || 0, x.coins];
  Ec.notWorn = C.act(x, "repair", {item: "bronzepick"}, 0).error;
  Ec.stoneNo = C.act(Object.assign(JSON.parse(JSON.stringify(x)), {}), "repair", {item: "stonepick"}, 0).error;
  /* left alone it breaks: the last one ends the trip */
  x.player.wear = {bronzepick: C.toolDur("bronzepick") - 1};
  X("trip", {skill: "mining", spot: Ec.ironSpot, roll: 0.4});
  y = C.advance(x, 3 * C.HOUR);
  Ec.broke = [y.bag.bronzepick || 0, y.player.tools.mining || null, !y.player.job, y.log.some((e) => /last bronze pickaxe broke/.test(e.text))];
  /* needles and pots of water are used up */
  x = y;
  Ec.needleItem = [C.ITEMS.needle.kit || false, C.ITEMS.potofwater.kit || false];
  /* the merchant buys and sells; you can't sell what you're using */
  x.bag.copper = 30; x.bag.bronzepick = 1; x.player.tools.mining = "bronzepick"; x.coins = 0;
  Ec.sell = X("sell", {item: "copper", n: 10}).msg;
  Ec.sellAll = X("sell", {item: "copper", n: "all"}).msg;
  Ec.coinsAfterSell = [x.coins, x.bag.copper || 0, C.priceOf("copper")];
  Ec.inUse = C.act(x, "sell", {item: "bronzepick"}, 0).error;
  x.coins = 10;
  Ec.buy = X("buy", {item: "needle", n: 2}).msg;
  Ec.poor = C.act(x, "buy", {item: "chisel"}, 0).error;
  Ec.fee = (() => { const z = JSON.parse(JSON.stringify(x)); z.coins = 0; z.bag.copper = 5; z.bag.tin = 5; z.player.skills.smelting = 1; return C.act(z, "craft", {workshop: "furnace", make: "bronzebar"}, 0).error; })();
  /* Zeph, Sundays only: exotic eggs, and he pays better */
  let sun = 0, mon = 0;
  for (let d = 0; d < 7; d++) { const t = new Date(2026, 9, 1 + d, 12).getTime(); if (new Date(t).getDay() === 0) sun = t; else if (!mon) mon = t; }
  Ec.zephDays = [C.villageView(x, sun).some((w) => w.id === "travelling"), C.villageView(x, mon).some((w) => w.id === "travelling")];
  Ec.zephAway = C.act(x, "buy", {item: "exoticegg", from: "travelling"}, mon).error;
  x.coins = 2600; x.bag.copper = 10;
  Ec.zephSell = X("sell", {item: "copper", n: 10, to: "travelling"}, sun).msg;
  Ec.zephBuy = X("buy", {item: "exoticegg", from: "travelling"}, sun).msg;
  Ec.exotic = [x.bag.exoticegg, !!C.EGGS.exotic, C.ITEMS.exoticegg ? C.ITEMS.exoticegg.name : ""];
  /* Mira: lots of one thing into one of the next, for coins (no xp) */
  x.bag.copper = 2; x.bag.tin = 2; x.coins = 20; delete x.bag.iron;   // room on the stack (250 a stack, 2026-10-10)
  const ironRec = C.WORKSHOPS.alchemist.recipes.find((r) => r.make === "iron");
  Ec.ironRec = [ironRec.needs, ironRec.fee];
  Ec.alch = X("craft", {workshop: "alchemist", make: "iron"}).msg;
  Ec.alchBag = [x.bag.iron, x.bag.copper || 0, x.bag.tin || 0, x.coins];
  Ec.ladders = ["runite", "magiclog", "diamond"].every((k) => C.WORKSHOPS.alchemist.recipes.some((r) => r.make === k));
  /* prices by tier (2026-10-05): each step up the ladder is worth more; made things are worth their inputs */
  const pr = C.priceOf;
  Ec.tiers = [["copper", "iron", "silver", "gold", "mithril", "adamantite", "runite"], ["birch", "oak", "willow", "maple", "yew", "magiclog"]]
    .map((l) => l.every((k, i) => !i || pr(k) > pr(l[i - 1])));
  Ec.madeWorth = ["bronzepick", "ironbar", "steelsword", "leather"].every((k) => {
    const r = Object.keys(C.WORKSHOPS).map((w) => C.WORKSHOPS[w].recipes.find((q) => q.make === k)).filter(Boolean)[0];
    return pr(k) * (r.n || 1) >= Object.keys(r.needs).reduce((a, n) => a + pr(n) * r.needs[n], r.fee || 0); });
  /* nothing bought can be sold for more, even to Zeph; Marlow has two rare things a day */
  Ec.noArb = [mon, sun].every((t) => ["merchant", "travelling"].every((w) => C.stockFor(w, t).every((l) => Math.floor(pr(l[0]) * 1.5) < l[1])));
  const d1 = C.stockFor("merchant", mon), d2 = C.stockFor("merchant", mon + 24 * 3600e3);
  Ec.daily = [d1.length - C.MERCHANT_STOCK.length, JSON.stringify(d1) !== JSON.stringify(d2), JSON.stringify(d1) === JSON.stringify(C.stockFor("merchant", mon + 3600e3)) || new Date(mon).getUTCHours() > 22];
  const dailyItem = d1[d1.length - 1][0];
  Ec.notToday = C.act(x, "buy", {item: C.MERCHANT_DAILY.map((m) => m[0]).find((k) => !d1.some((l) => l[0] === k))}, mon).error;
  /* coin sinks: a nest for the hatchery, a shelf for the windowsill */
  x.coins = 3000; x.bag.granite = 15;
  Ec.nest = [C.hatcheryView(x, 0).slots, C.hatcheryView(x, 0).upgrade.cost, X("upgrade", {what: "hatchery"}).msg, C.hatcheryView(x, 0).slots, x.coins, C.hatcheryView(x, 0).upgrade.cost];
  Ec.shelf = [C.act(x, "upgrade", {what: "windowsill"}, 0).error, C.farmView(x, 0).maxPots];
  /* Iris, the reskinner, after two bosses */
  x.dev = {on: true, instantHatch: true}; x = C.act(x, "hatch", {egg: "starter", roll: 0.5}, 0).state; delete x.dev;
  Ec.irisAway = [C.villageView(x, mon).some((w) => w.id === "reskinner"), C.act(x, "reskin", {preset: "lava"}, 0).error];
  x.hunt = {forest: {wins: 1}, meadow: {wins: 2}};
  Ec.irisHere = C.villageView(x, mon).some((w) => w.id === "reskinner");
  x.coins = 2000;
  const pid = x.pet ? x.pet.id : null;
  Ec.reskin = C.act(x, "reskin", {id: pid, preset: "lava"}, 0);
  Ec.reskinOk = [Ec.reskin.ok, Ec.reskin.ok && 2000 - Ec.reskin.state.coins, Ec.reskin.ok && !!Ec.reskin.state.pet.skin];
  Ec.paint = C.act(x, "reskin", {id: pid, skin: {b: "#ff0000", l: "javascript:x", zz: "#00ff00"}}, 0);
  Ec.paintOk = Ec.paint.ok ? [2000 - Ec.paint.state.coins, Ec.paint.state.pet.skin] : Ec.paint.error;
  Ec.palSkin = Ec.reskin.ok ? A.palette("cat", "ginger", {b: "#ff0000"}).b : "";
  delete Ec.reskin; delete Ec.paint;
}
// ---- 2026-10-04b: class leathers, bats and armadillos, foraging like mining ----------------------
{
  const Lc = out.leather = {};
  let x = C.act(C.empty(), "player", {name: "Cam"}, 0).state;
  const X = (a, o, t) => { const r = C.act(x, a, o, t || 0); if (r.ok) x = r.state; return r; };
  Lc.tanner = C.WORKSHOPS.tanner.recipes.map((r) => [r.make, r.level, Object.keys(r.needs).join("+"), r.fee]);
  Lc.sets = ["hard", "snake", "bat", "armadillo"].map((p) => ["cap", "body", "vambraces", "chaps", "boots"].every((sl) => C.ITEMS[p + sl] && C.ITEMS[p + sl].gear
    && C.WORKSHOPS.crafting.recipes.some((r) => r.make === p + sl && r.needs.needle === 1)));
  Lc.bonus = ["snakebody", "batbody", "armadillobody", "hardbody"].map((k) => (C.ITEMS[k].gear.clsBonus || {}).cls || "");
  Lc.req = ["hardbody", "snakebody", "armadillobody"].map((k) => C.ITEMS[k].gear.req);
  Lc.drops = ["bat", "armadillo", "snake"].map((m) => C.MONSTERS[m].drops.map((d) => d[0]).filter((d) => d !== "bones")[0]);
  Lc.where = ["bat", "armadillo"].map((m) => C.HUNT_ORDER.filter((a) => C.HUNTS[a].monsters.some((q) => q[0] === m)).join("/"));
  /* a Hunter in snakeskin gets more from it than a Berserker does */
  Object.assign(x.player.skills, {defence: C.XP[30], ranged: C.XP[30], attack: C.XP[30], crafting: C.XP[30]});
  for (const sl of ["cap", "body", "vambraces", "chaps", "boots"]) { x.bag["snake" + sl] = 1; X("equip", {item: "snake" + sl}); }
  X("class", {cls: "hunter"});
  const hunter = C.playerView(x, 0).worn;
  x.player.cls = "berserker";
  const bers = C.playerView(x, 0).worn;
  Lc.snake = [hunter.rng, bers.rng, hunter.clsBonus, bers.clsBonus, hunter.acc];
  /* tanning and sewing */
  x.coins = 100; Object.assign(x.bag, {snakeskin: 2, thread: 5, needle: 2});
  Lc.tan = X("craft", {workshop: "tanner", make: "snakeleather"}).msg;
  x.bag.snakeleather = 4;
  Lc.sew = X("craft", {workshop: "crafting", make: "snakebody"}).msg;
  Lc.after = [x.bag.needle, x.bag.snakeleather, x.coins];
  /* foraging: a card per material, the dearest highest, the top ones need a better basket */
  const F = C.SKILLS.foraging.spots.filter((q) => !q.essence && !q.secret && !(C.REGIONS[q.area] || {}).needs);   // not the world map's hidden or gated spots
  Lc.mains = F.map((q) => q.loot[0][1] >= 60).every(Boolean);
  Lc.top = F.slice().sort((a, b) => b.level - a.level).slice(0, 3).map((q) => [q.loot[0][0], q.level, q.toolTier || 0]);
  Lc.valuable = ["ginseng", "royaljelly", "saffron"].map((k) => C.ITEMS[k].gem);
  x.player.skills.foraging = C.XP[50]; x.bag.willowbasket = 1; x.player.tools.foraging = "willowbasket";
  Lc.needBasket = C.act(x, "trip", {skill: "foraging", spot: "saffron", roll: 0.3}, 0).error;
  x.bag.yewbasket = 1; x.player.tools.foraging = "yewbasket";
  Lc.withYew = C.act(x, "trip", {skill: "foraging", spot: "saffron", roll: 0.3}, 0).ok;
  Lc.baskets = ["maplebasket", "yewbasket"].map((k) => [C.ITEMS[k].tool.tier, C.WORKSHOPS.crafting.recipes.find((r) => r.make === k).level]);
  Lc.oldIds = ["meadow", "woodland", "orchard", "hedgerow", "kitchengarden", "wildflowers", "brambles", "glade", "hazelgrove", "hollow",
               "eldergrove", "canopy", "orchids", "seaweed", "dunes"].every((id) => F.some((q) => q.id === id));
  Lc.art = ["bat", "armadillo"].every((m) => A.monster(m));
}
const calls = []; const ctx = {set fillStyle(v) { calls.push(v); }, fillRect() { calls.push("r"); }};
A.draw(ctx, A.frame("cat", "ok"), A.palette("cat", "ginger"), 0, 0, 2, true);
out.drawUses = calls.filter((c) => c === "r").length;
console.log(JSON.stringify(out));
''' % (json.dumps(os.path.join(UI, "pet", "petcore.js")), json.dumps(os.path.join(UI, "pet", "petart.js")))

if not node:
    print("  skip  the rules (needs node)")
else:
    r = subprocess.run([node, "-e", RULES], capture_output=True, text=True, timeout=60)
    R = json.loads(r.stdout) if r.returncode == 0 else None
    ok("the rules run", R is not None, r.stderr[-800:])
    if R:
        ok("no pet yet: nothing to show, nothing to feed", R["noPet"]["has"] is False and "no pet" in R["feedNone"])
        E = {k: (mins, take, total) for k, mins, take, total in R["eggs"]}
        ok("eggs hatch slower the rarer they are: starter 3 min ... special 2 hours (Cam's times)",
           E["starter"][0] == 3 and E["special"][0] == 120
           and [m for m, _, _ in E.values()] == sorted(m for m, _, _ in E.values()), E)
        ok("  every egg's chances add up to 100%", all(t == 100 for _, _, t in E.values()), E)
        ok("  only the starter egg can be taken yet (the rest are found later)",
           [k for k, v in E.items() if v[1]] == ["starter"] and "haven't found a special egg" in R["locked"], R["locked"])
        ok("the starter egg's list: six pets, commons likeliest, the lilac frog rare",
           len(R["starterOdds"]) == 6 and R["starterOdds"][-1] == ["Lilac Frog", "Rare", 6]
           and all(r == "Common" for _, r, _ in R["starterOdds"][:3]), R["starterOdds"])
        ok("  a roll lands on the pet its chance covers", R["rolls"] == ["cat/ginger", "cat/ginger", "bunny/pink", "cat/grey",
           "frog/lilac", "frog/lilac"], R["rolls"])
        ok("take an egg: it hatches in 3 minutes", R["hatch"] == "You took a starter egg. It hatches in 3 minutes.", R["hatch"])
        ok("  the starter egg is only for your first pet", "starter egg is for your first pet" in R["second"], R["second"])
        ok("what's inside is a SURPRISE: the egg's view says nothing about the pet",
           R["egg"]["stage"] == "egg" and R["egg"]["name"] == "Starter egg" and R["eggSecret"] == []
           and 110 <= R["egg"]["hatchIn"] <= 120 and len(R["egg"]["odds"]) == 6, (R["egg"], R["eggSecret"]))
        ok("  an egg can't be fed or named", "hasn't hatched" in R["eggFeed"] and "hasn't hatched" in R["eggName"])
        ok("  still an egg a second before three minutes", R["stillEgg"] == "egg")
        ok("then it hatches -- a lilac frog (rare!), healthy, waiting for a name",
           R["hatched"]["stage"] == "hatchling" and R["hatched"]["kind"] == "Lilac Frog" and R["hatched"]["rarity"] == "Rare"
           and R["hatched"]["named"] is False and R["hatched"]["name"] == "Lilac Frog"
           and R["hatched"]["stats"]["health"] == 100 and R["hatched"]["poops"] == 0, R["hatched"])
        ok("  the diary says what hatched", R["revealLog"] == "Your egg hatched -- it's a Lilac Frog! (Rare)", R["revealLog"])
        ok("  unnamed, it's 'your lilac frog'", R["unnamedMsg"] == "You played with your lilac frog.", R["unnamedMsg"])
        ok("name it (tidied), and rename it later", R["named"] == "You named your lilac frog Mochi."
           and R["renamed"] == "Mochi is now called Moch.", (R["named"], R["renamed"]))
        ok("a pet from before eggs (Ribbit) carries on as it was", R["oldSave"] == ["Ribbit", True, "Green Frog", "starter", "hatchling"],
           R["oldSave"])
        L = R["later12"]
        ok("twelve hours later it's hungry, tired, and there's mess (real time)",
           L["stats"]["full"] < 25 and L["mood"] == "hungry" and L["need"] == "I'm hungry!" and L["poops"] >= 1, L)
        ok("feeding fills it up", R["fed"]["ok"] and R["fullAfter"] >= 40 and "ate some kibble" in R["fed"]["msg"], (R["fed"], R["fullAfter"]))
        ok("  treats make a mess", R["treatClean"][1] < R["treatClean"][0], R["treatClean"])
        ok("  and a full pet won't eat", "too full" in R["tooFull"], R["tooFull"])
        ok("playing is fun (and tiring)", R["play"]["ok"] and "played with Mochi" in R["play"]["msg"], R["play"])
        ok("rest: it sleeps, and can't be fed asleep", "nap" in R["rest"] and "asleep" in R["feedAsleep"]
           and R["asleepView"]["mood"] == "asleep" and R["asleepView"]["need"] == "Zzz…", R["asleepView"])
        ok("  rested, it wakes up by itself", R["wokeAlone"]["asleep"] is False and R["logHasWoke"], R["wokeAlone"])
        ok("a weekend away: starving, grubby and ill",
           R["weekend"]["sick"] and R["weekend"]["mood"] == "sick" and R["weekend"]["stats"]["full"] == 0
           and R["weekend"]["poops"] == 3 and R["weekend"]["canMedicine"], R["weekend"])
        ok("  medicine makes it better; not again straight away",
           R["medicine"]["ok"] and "Too soon" in R["medAgain"], (R["medicine"], R["medAgain"]))
        ok("a year away is counted as sixty days, and the numbers stay 0..100",
           all(0 <= v <= 100 for v in R["yearAway"]["stats"].values()), R["yearAway"])
        ok("at five days old it's ready for expeditions (the brief's age)",
           R["ageReady"]["expeditionReady"] and R["ageReady"]["stage"] == "young", R["ageReady"])
        ok("the same time gives the same pet, and nothing changes what it was given",
           R["deterministic"] and R["untouched"])
        ok("an unknown action is refused politely", "doesn't know how to dance" in R["unknown"], R["unknown"])
        ok("start over: the pet goes, a new egg can be chosen", "farm" in R["release"] and R["afterRelease"] is False)
        ok("  no roll given: still a real pet from the list", R["noRoll"] is True)
        ok("each kind of egg has its own look -- never the colour of what's inside", len(set(R["eggLooks"])) == 5, R["eggLooks"])
        ok("every species, mood and mouth is 16 x 16", set(R["sizes"]) == {"16x16"}, set(R["sizes"]))
        ok("  every colour has a palette", "badPal" not in R, R.get("badPal"))
        ok("every item has a colour for every pixel", all(c > 10 and not m for _, c, m in R["items"]), R["items"])
        ok("drawing needs only fillStyle and fillRect (browser and QML Canvas)", R["drawUses"] > 150, R["drawUses"])
        print()
        ok("slice 2 -- a starter kit in the bag: 5 berries, 3 treats, a small net (fishing needs one)", sorted(R["bag0"]) == ["berry:5", "smallnet:1", "treat:3"], R["bag0"])
        ok("make your character (a name is needed)", "name first" in R["noName"] and R["made"] == "Welcome to the isle, Cam."
           and R["pv0"]["made"] and R["pv0"]["look"] == {"skin": 1, "hair": 2, "outfit": 3, "body": "m"} and R["pv0"]["totalLevel"] == 33, R["pv0"])   # + Larceny (2026-10-17)   # + Construction (2026-10-07), + Husbandry (the Farm, 2026-10-12)   # 14 skills at 1 (Alchemy joined 2026-10-06) (the crafters' 5 joined), attack, ranged, defence at 1, hitpoints 10
        ok("  five gathering skills (Digging joined), each with spots opening at levels 1, 5 and 8-10 -- all in the Pasture (no long flat stretch, 2026-10-10)"
           " (mining: copper and tin at 1, iron at RuneScape's 15, silver 18 -- 2026-10-04)",
           R["spots"] == ["pasture 1,pasture 2,pasture 5,pasture 8", "pasture 1,pasture 5,pasture 10", "pasture 1,pasture 1,pasture 15,pasture 18",
           "pasture 1,pasture 6,pasture 10", "pasture 1,pasture 5,pasture 8"], R["spots"])
        ok("every area has its own sub-areas for every gathering skill, rising in level (Farmyard 1/3 ... Jungle; Foraging a card per material up to Saffron at 50)",
           R["subareas"] == ["1/3 1/2/5/8 10/12/14/16 20/24/28 20/24/32 30/34/38 40/44/47/50 42 44/47 45/49", "1/3 1/5/10 8/13 15/19 18/20/25/38 30/33 40/44 42  45/50",
                             "1/3 1/1/15/18 8/15 20/24 22/26 28/35 40/44 42 44/48 ", "1/3 1/6/10 13/16 18/22 20 27/30 36/44 40 44/48 ",
                             "1/3 1/5/8 12/15 20/24 20/26 30/35 42/46 44 44/48 47"] and R["subLoot"], R["subareas"])   # + the Desert and the Nile (2026-10-08)
        ok("  mushrooms from Foraging level 1 (Cam: \"i cant get mushrooms\")", R["mushroomsAt"] == 1, R["mushroomsAt"])
        Es = R["ess"]
        ok("essence spots: one per gathering skill in every area", Es["spots"] == [",".join(["farmyard", "pasture", "meadow", "forest", "coast", "deepforest", "jungle", "frostpeak", "desert", "nile"])] * 5
           and all(n and art for n, art in Es["items"]), Es)
        ok("  locked until you beat the area's boss 50 times (and at the area's level)",
           "beat Gideon Fox 50 times (0/50)" in Es["locked"] and Es["lockView"] == "Beat Gideon Fox 50 times (0/50)" and "Foraging level 5" in Es["levelLock"], Es)
        ok("  then it gives essence (slowly: 20 an hour), and nothing else", Es["got"] == [20, ["foragingessence"]] and "Mining" in Es["describe"], Es)
        ok("  a spot above your level is closed", R["spotLocked"] == "The Cave mouth needs Mining level 18.", R["spotLocked"])
        ok("go gathering: an hour at the Garden patch is 1200 finds (3 s each at level 1, 2026-10-09), ~400 xp -- level 3 on the steeper curve",
           R["went"] == "You went digging at the Garden patch." and R["hour"]["job"]["count"] == 1200 and 390 <= R["hour"]["job"]["xp"] <= 400
           and R["hour"]["skills"]["digging"]["level"] == 3 and 1000 <= R["hourBag"] <= 1400, [R["hour"]["job"]["count"], R["hour"]["job"]["xp"], R["hourBag"]])   # + a few unidentified herbs (Herblore, 2026-10-06); soil stops at a 250 stack (2026-10-10)
        ok("  mining ore needs a pickaxe -- a stone one from your bench will do", "needs a pickaxe" in R["noPick"] and "stone one" in R["noPick"], R["noPick"])
        ok("  the levels: RuneScape's table, half as much again (2026-10-09), top level 50 for now", R["xp50"] == [124, 1731, 152000, 50], R["xp50"])
        ok("  it carries on while nobody looks, and finds the same things however it's looked at", R["split"])
        ok("  after 12 hours you come home by yourself, with a summary in the diary",
           R["after"]["job"] is None and R["after"]["lastTrip"]["count"] == 14400
           and any(t.startswith("Home from the Garden patch with 4752 Digging xp (") for t in R["afterLog"]), R["afterLog"][:3])
        ok("  level-ups are in the diary, and say when a new spot opens",
           any(t == "You reached Digging level 5! The Riverbank is open to you now." for t in R["afterLog"]), R["afterLog"])
        ok("come home early: what you found so far is kept (the diary says the xp and the items, not a count of finds)",
       R["home"][0].startswith("You left the Herb patch with 66 Foraging xp (") and "unidentified herb ×" in R["home"][0]
           and R["home"][1] == 200 and "not out gathering" in R["notOut"], R["home"])
        ok("your companion helps: a frog gives +10% Fishing xp (+20% happy); a cat doesn't",
           R["boost"] == [258, 282, 312, 258], R["boost"])   # 3 s finds, a hundredth of a point each (2026-10-09); early fishing +30% (2026-10-10)
        ok("food from the bag: a berry is used up; none left, none given; stones aren't food; kibble always",
           R["berryLeft"] == 4 and "no treat in the bag" in R["noTreat"] and R["notFood"] == "That isn't food." and R["kibble"], R)
        ok("  a caught trout feeds the pet", R["trout"][0].endswith("ate some raw trout.") and R["trout"][1] == 1 and R["trout"][2] == 35, R["trout"])
        ok("every item has a picture, gems 0-10, and every spot's loot is a real item",
           R["noArt"] == [] and R["gems"] and R["loot"], R["noArt"])
        ok("every look of your character is 16 x 16 and fully coloured", R["avatars"] == [], R["avatars"])
        print()
        Vl = R["v"]
        ok("the village (2026-10-04): no crafters -- your furnace, anvil, bench, tanner, fletching table, herb table, gem bench,"
           " kitchen and compost bin; the merchant and the alchemist (the travelling merchant on Sundays, the reskinner later)",
           [w for w, _ in Vl["village"]] == ["furnace", "anvil", "grindstone", "crafting", "spinning", "sawbench", "tanner", "fletching", "herblore", "apothecary", "gemology", "enchanting", "altar", "kitchen", "compost",
                                             "merchant", "board", "alchemist", "chapel"] and Vl["recipesReal"], Vl["village"])   # + the notice board (2026-10-07), the grindstone (2026-10-15), the chapel (2026-10-16)
        ok("  you start with 100 coins; ore is smelted into bars (a copper and a tin a bronze bar, a coin for the fire)",
           Vl["coins0"] == 100 and xpless(Vl["smelt"]) == xpless("You made a bronze bar (+6 Smelting xp, 1 coin)."), Vl)   # x5 ore, the old xp (2026-10-09)
        ok("  bars are smithed at the anvil; everything is used up, the forge charges by the bar",
           Vl["short"].startswith("Not enough") and "Nobody" in Vl["nobody"]
           and xpless(Vl["made"]) == xpless("You made a bronze pickaxe (+16 Smithing xp, 5 coins).") and Vl["used"] == [0, 0, 0, 0, 1, 90], Vl)
        ok("a tool makes finds faster (bronze: 1411 an hour at the Copper rocks, not 1200); iron needs level 10",
           Vl["fasterFinds"] == 1411 and Vl["gear"]["id"] == "bronzepick" and "level 10" in Vl["ironLocked"]
           and "from your next trip" in Vl["equip"], Vl)
        ok("the kitchen: Cooking levels up, better dishes need a level",
           "needs Cooking level 8" in Vl["cookLocked"] and xpless(Vl["cooked"]) == xpless("You cooked a berry tart (+2.4 Cooking xp).")      # a fifth: 15x the berries (2026-10-09)
           and Vl["cookXP"] == 2 and Vl["cookLevel"] == 1, Vl)
        ok("equipment: one per slot (a second ring replaces the first)",
           Vl["worn"] == {"ring": "amethystcharm", "necklace": "pearlcharm", "helmet": "bronzehelm", "torso": "ironplate"}, Vl["worn"])
        ok("  it changes the next trip: rare finds x2 (ring), +6% xp (armour), 5% faster (necklace; with the bronze pickaxe: 3 s x .85 x .95)",
           Vl["trip"] == [2, 0.06, 2423] and "took off the amethyst ring" in Vl["unequip"]
           and Vl["ironPlateLocked"] == "The iron chestplate needs Defence 10.", Vl)
        ok("  a pet's things need a pet", "pet" in Vl["petNone"], Vl["petNone"])
        ok("  an old save's charm moves to its slot", Vl["migrated"] == ["pearlcharm", False], Vl["migrated"])
        ok("potions for the pet: a tonic for energy, a salve heals and cures; used up",
           Vl["tonic"] == [True, 50] and Vl["salve"][0] and Vl["salve"][1] is False and Vl["salve"][2] >= 70
           and "no energy tonic" in Vl["noTonic"], Vl)
        ok("furniture goes in the pet's room, one of each", Vl["place"][0] == "You put the pet bed in the pet's room."
           and "already" in Vl["place"][1] and Vl["place"][2].get("bed") == "petbed", Vl["place"])   # the room remembers which (2026-10-11)
        ok("  a toy box keeps the fun up longer", Vl["toybox"][1] > Vl["toybox"][0], Vl["toybox"])
        ok("  and the room is drawn with it", Vl["room"] > 60, Vl["room"])
        print()
        Q = R["q"]
        ok("pets wear things by their body: a frog has no tail; a cat does",
           Q["frogSlots"] == ["charm", "helmet", "torso", "feet"] and "no tail" in Q["noTail"]
           and Q["catSlots"] == ["charm", "helmet", "torso", "feet", "tail"] and "wearing the tail ribbon" in Q["catTail"], Q)
        ok("  your slots: helmet, necklace, cloak (2026-10-07), torso, arms, ring, legs, feet (and a weapon, ammo and a quiver, for the hunt)",
           Q["playerSlots"] == ["helmet", "necklace", "cloak", "torso", "arms", "ring", "legs", "feet", "weapon", "ammo", "quiver"], Q["playerSlots"])
        ok("  a pet's equipment raises expedition success and xp (+11%, +10%)",
           Q["worn"]["success"] == 0.11 and Q["worn"]["expXp"] == 0.1 and Q["chance"] == 0.95, (Q["worn"], Q["chance"]))   # level 5 pet: capped
        print()
        H = R["h"]
        ok("slice 5 -- with a pet, a found egg goes in the hatchery (two at a time)",
           H["inHatchery"] == "The common egg is in the hatchery -- it hatches in 10 minutes." and "hatchery is full" in H["full"]
           and H["eggsLeft"] == 1 and len(H["hv"]["eggs"]) == 2, H)
        ok("  what's inside stays a surprise there too", H["secret"] is False, H["hv"])
        ok("  they hatch into the den, said in the diary",
           all(t.startswith("In the hatchery: the ") and t.endswith("It's in the den: keep it at home, or send it to the Beast Pen.") for t in H["hatched"]) and len(H["pets"]) == 3
           and H["pets"][0] == ["Ribbit", True, "Lilac Frog"], H)
        ok("the Petapedia: the ones hatched are named; the rest stay ??? with nothing given away",
           sorted(n for n in H["dex"] if n != "?") == ["Ginger Cat", "Lilac Frog"] and H["dex"].count("?") == len(H["dex"]) - 2 and H["dexHides"], H["dex"])
        ok("den pets go gathering (your companion stays with you); a cat's natural skill is lumbering",
           "companion stays with you" in H["compTrip"] and H["sent"].endswith("(a natural -- 20% faster).")
           and "needs Mining level 18" in H["closed"] and H["natural"] == [True, False], H)
        ok("  20% faster: 1500 finds an hour at the Copse, not 1200", H["gathered"][0] == 1500, H["gathered"])
        ok("name a den pet; make it your companion (its trip ends, the old one goes to the den)",
           H["named"] == "You named your ginger cat Mochi." and H["swap"] == "Mochi is your companion now; Ribbit went to the den."
           and H["after"][0] == ["Mochi", True, False] and H["lastTrip"] == 250, H)
        ok("  the sandbox's warp hatches the hatchery too", H["warped"] == 4, H["warped"])
        print()
        K = R["k"]
        ok("sewing is your Crafting now: cotton -> thread -> cloth; the tanner tans a cow hide into leather for 5 coins",
           K["meadowCotton"] and xpless(K["thread"]) == xpless("You made a thread (+12 Crafting xp).") and xpless(K["cloth"]) == xpless("You made a cloth (+16 Crafting xp).")
           and xpless(K["leather"]) == xpless("You made a soft leather (+10 Crafting xp, 5 coins)."), K)
        ok("  sewing uses up a needle (five from a bronze bar at the anvil)",
           "needle" in K["noNeedle"] and K["needles"].startswith("You made 5 × needle") and xpless(K["shirt"]) == xpless("You made a cotton shirt (+16 Crafting xp).")
           and K["needleKept"] == 4, K)
        ok("  the tailor's and carpenter's makings are all at your bench", K["petClothesMoved"])
        ok("you start with 10 health (Hitpoints 10), combat level 3, home below 30%", K["start"] == [10, 10, 3, 10, 0.3], K["start"])
        ok("hunting: the Pasture (cows) needs combat 5; the Farmyard gives feathers and poultry",
           "combat level 5" in K["pastureLocked"] and K["went"] == "You went hunting at the Farmyard."
           and K["hunted"][0] > 0 and K["hunted"][1] and K["hunted"][2], K)
        ok("  fights come out the same however they're looked at", K["split"])
        ok("  hurt, nobody runs for you: you fall (PT30) -- and heal at home with time", K["retreated"] and K["healed"][0] == K["healed"][1], K)
        ok("cooked food heals you; raw things don't", K["eat"][0] == "You ate a steak (+10 health)." and K["eat"][1] == K["eat"][2]
           and "cooked food" in K["notFood"], K)
        # 2026-10-06, Cam: lose everything you carry instead of the game
        # V16 (2026-10-19): a hunt never kills you -- below your health line you come home hurt, carrying everything
        ok("a weak hunter at 1 health, no running (PT30): falls, wakes at home, plays on -- a gravestone, not the end",
           K["dead"][0] is None and K["fell"][4] is False and K["fell"][5] is True and K["fell"][6] is True and K["fell"][7] is True
           and K["playsOn"] is True
           and K["restart"][1] == "You're still alive." and K["aliveRestart"] == "You're still alive.", {k: K[k] for k in ("dead", "fell", "playsOn", "restart")})
        ok("health comes back faster with more Hitpoints: 1.4 a minute at 10, 3 at 50", K["regen"] == [1.4, 3], K["regen"])
        ok("  armour takes a share off each blow: a third in full mithril (Defence 40), never more than 40%",
           abs(K["cut"][0] - 1 / 3) < 1e-9 and K["cut"][1] == 0.4 and K["cut"][2] == 0, K["cut"])
        ok("the hunt plan's food (it must heal): nobody eats it for you now -- the tuna stays, you come home alive (V16)",
           K["foodBad"] == "That won't heal you." and K["foodOk"].startswith("Between fights you'll eat tuna below 50%") and K["below"] == "Between fights you'll eat below 60% health."
           and K["ate"][0] == 0, K)
        ok("no running for you, even one blow from the end (PT30): at combat 1, Gideon wins (24 tries)", K["gideon"][0] > 0 and K["gideon"][1] == 0, K["gideon"])
        ok("  and you may set out hurt -- your choice", K["tooHurt"] == "", K["tooHurt"])
        ok("a boss's kill count is a one-time unlock: then a short rematch count (a twentieth, 10 to 25)",
           "after 50 kills" in K["gate0"] and K["gate1"] == [0, 10, True, 25, 10] and "appears" in K["gate2"] and K["oldSave"] == 18, K)
        ok("  bosses drop 6 to 10 of their special material", K["bossDrops"] == ["6-10"] * 7, K["bossDrops"])
        ok("Snapjaw's set: snapshell armour and pincers at the anvil; a hard shell takes 1 off every blow in full",
           K["snapRecipes"] and K["snapWorn"][0] == 6 and "hard shell" in K["snapWorn"][1] and "second hit" in K["snapWorn"][2]
           and K["snapWorn"][3] == K["snapWorn"][4] - 1, K["snapWorn"])
        ok("gear roles: class leathers beat metal for their own class; boss sets trade Defence for effects; metal keeps gathering xp; soft leather is light",
           K["roles"] == [True, 40, 10, 33, 0.25, True, True, True], K["roles"])   # (snakeskin on a Hunter: 30 + the V17 class fit, 10%)
        ok("a Hunter's road to 50: a bow and arrows and bolts at Ranged 20, 30 and 40 (yew, magic); adamant bars at the furnace",
           K["hunter"] == [[True, 2], [True, 2], [True, 2]] and K["adamant"], K)
        ok("  smithed swords hit at least as hard as the boss weapons that come with them", K["swords"])
        ok("potions: drink a combat brew -- it lasts fights, and another is drunk from the bag when it wears off",
           K["notPotion"] == "That isn't a potion you can drink." and K["drank"].startswith("You drank an attack potion: Attack +3 for 30 fights")
           and K["renew"][0] == 0 and K["renew"][1] == "attackpotion" and K["renew"][2], K)
        ok("  a gathering draught adds xp for a number of finds; the Apothecary has recipes to 50; healing potions are eaten",
           K["gatherXp"][0] > K["gatherXp"][1] and K["gatherXp"][2] < 60 and K["herbTop"] == 50 and "Heals you 24" in K["healPot"], K)
        ok("adamant (40) and rune (50): bars, tools, armour, swords and rune ammo; teak and mahogany handles", K["runeLine"])
        ok("Farming to 50: crops to 48 with a use and a seed source, plots 5 and 6, Water all, the steel can keeps a crop watered",
           K["cropTop"] == 48 and K["cropUse"] and K["cropSeeds"] and K["farm"] == [6, "You watered 2 plots.", "ripe", "Nothing needs water."], K)
        ok("tools at nine tenths: never mended by themselves (even carrying the makings) -- you come home before your last one breaks",
           K["mend"][0] == 1 and not K["mend"][1] and "came home before it did" in K["mend"][3] and K["mend"][4] == 3
           and "mended on the way" not in K["mend"][3]
           and K["home"][0] == 1 and not K["home"][1] and "came home before it did" in K["home"][3], K)
        ok("  a tool wears faster the further above its tier you work, climbing each tier (1, 3, 6, 10 a find)", K["wearUp"] == [0, 1, 3, 6, 10], K["wearUp"])
        ok("  reels from steel to rune, trowels and spades for digging, a magic basket", K["newTools"])
        ok("every kind of pet has a companion knack; boss pets don't hatch from the exotic egg; diggers hatch from the Burrow egg",
           K["allBoost"] == [] and K["exoticBoss"] == 0 and K["burrow"], K)
        ok("  a chicken helps you cook (+10% xp); a wolf helps you fight",
           xpless(K["chickenCook"]) == xpless("You cooked a shrimps (+1.3 Cooking xp).") and K["companionDoes"] == ["Attack +2 (+4 while happy) in a fight", "+10% Cooking xp (+20% while happy)"], K)
        ok("essence amulets: +15% xp and 10% faster for one gathering skill, enchanted at the gem bench",
           K["amulet"][0] and K["amulet"][1] == 0.15 and abs(K["amulet"][2] - 0.9) < 0.01 and "Foraging: +15% xp, 10% faster" in K["amulet"][3], K["amulet"])
        ok("  pelts tan into leather (a recipe picked by its place in the list); cow hide is still the first way; a bird's nest holds seeds",
           K["tanned"] == [3, 0, 1, 0] and K["nest"], K)
        ok("the spinning wheel: flax and sap make a bow string (Crafting 10), wool a ball of wool to knit pet clothes and rugs; flax is picked at Foraging 10",
           xpless(K["wheel"][0]) == xpless("You made a bow string (+15 Crafting xp).") and "sap" in K["wheel"][1].lower() and xpless(K["wheel"][5]) == xpless("You made a ball of wool (+3 Crafting xp).")
           and xpless(K["wheel"][6]) == xpless("You made a woolly jumper (+20 Crafting xp).") and K["wheel"][7:] == [1, 5, True, False], K["wheel"])
        ok("den pets hunt too (pet xp; hurt pets come home)", all(K["petHunt"]), K["petHunt"])
        ok("  the low-level animals: chickens, ducks, pigs, foxes; cows, goats, sheep, horses, cattle dogs",
           all(k in K["monsters"] for k in ["chicken", "duck", "pig", "fox", "cow", "goat", "sheep", "horse", "cattledog"]), K["monsters"])
        print()
        B = R["b"]
        ok("breeding: two pets at least 5 days old (not one pet with itself)", "too young" in B["young"] and "two of your pets" in B["same"], B)
        ok("  a pair's chances take after the parents", B["odds"]["special"] is False
           and sorted((o["kind"], o["chance"]) for o in B["odds"]["odds"]) == [("cat/ginger", 50), ("cat/grey", 50)], B["odds"])
        ok("  an hour together; one pair at a time; the pets are busy; the egg's place is kept",
           B["started"].endswith("are spending time together.") and B["busy"][0] == 3600 and "already breeding" in B["busy"][1]
           and "busy breeding" in B["busy"][2] and B["busy"][3] == 1, B["busy"])
        ok("  the egg goes into the hatchery, still a surprise, and hatches into the den",
           B["laid"][0].endswith("laid a bred egg. It's in the hatchery.") and B["laid"][1] == "bred" and B["secret"]
           and B["hatched"].startswith("In the hatchery: the bred egg hatched"), B)
        ok("  each parent rests a day after", "needs rest" in B["rest"], B["rest"])
        ok("a special pairing (two cats at level 5, one with Lumbering 10) lays a Special egg -- 2 hours -- a Golden Cat",
           B["notYet"] is False and B["special"]["special"] is True and "something feels special" in B["specialMsg"]
           and B["specialEgg"] == 2 and "Golden Cat! (Special)" in B["golden"][0] and B["golden"][1], B)
        ok("  the breeding book: three special pets, the unfound ones ???",
           B["book"] == [["goldencat", "Golden Cat"], ["moonbunny", "???"], ["emberfrog", "???"]]
           and B["specials"] == ["cat/golden", "bunny/moon", "frog/ember"], B["book"])
        print()
        F = R["f"]
        ok("classes: Hunter, Berserker or Arcane (2026-10-07)", F["arcane"].startswith("You became an Arcane.") and F["hunter"].startswith("You became a Hunter."), F)   # (+ the tutor's offer, 2026-10-17)
        ok("Fletching (your skill now): shafts from logs (10 at a time), bows; arrows from heads smithed at the anvil, shafts and feathers",
           xpless(F["shafts"]) == xpless("You made 10 × arrow shaft (+8 Fletching xp).") and xpless(F["heads"]) == xpless("You made 10 × bronze arrowheads (+12 Smithing xp, 1 coin).")
           and [xpless(F["arrows"][0]), F["arrows"][1]] == [xpless("You made 10 × bronze arrow (+12 Fletching xp)."), 10], F)
        ok("  bow strings are spun from flax at the spinning wheel, never sewn from thread at the fletching table (2026-10-09)", F["fletchString"] is False, F)
        ok("a bow needs its arrows -- one a shot (B5) -- and trains Ranged; run dry, you hunt on with your fists",
           F["noAmmoBow"].startswith("Out of arrows") and not F["hunt"][0] and F["hunt"][2].startswith("Out of arrows -- you hunt on with your fists")
           and F["hunt"][3], F)
        ok("every kill drops bones", F["allBones"] and F["hunt"][1] >= 10, F["hunt"])
        ok("bone sets, a step above bronze: the Berserker's needs bronze, the Hunter's leather; class only",
           F["bonePlate"] == {"bones": 6, "bronzeplate": 1} and F["boneVest"] == {"bones": 4, "leather": 2, "needle": 1}
           and F["boneDef"] == [3, 2, "berserker", "hunter"] and "for Berserkers" in F["wrongClass"]
           and "took off the bone bow" in F["switchOff"], F)
        ok("seeds: uncommon and up (gems 3..6), from foraging and the hunt",
           F["seedGems"] == [3, 3, 4, 5, 6] and all(F["seedFrom"]), F)
        ok("the farm: one plot; the rake (weeds to the bag), then the hoe, then a seed (by Farming level)",
           F["oneplot"] == 1 and "need a rake" in F["noRake"] and F["raked"].startswith("You raked plot 1:")
           and "Till plot 1" in F["order"] and "Farming level 10" in F["locked"] and F["planted"].startswith("You planted potato"), F)
        ok("  it grows in four stages; unwatered, it waits thirsty", F["thirsty"]["thirsty"] and F["thirsty"]["stage"] == 0
           and F["ripe"] == ["ripe", "Plot 1: the potatoes are ready to harvest."], F)
        ok("  harvest; the weeds that come back depend on what grew (nettles after potatoes)",
           F["harvest"].startswith("You harvested") and F["after"] == ["weedy", "Nettle"] and "nettle" in F["weeds"], F)
        ok("more plots: Farming level and soil", "Farming level 5" in F["unlockLevel"] and "10 soil" in F["unlockSoil"]
           and F["unlocked"] == ["You dug plot 2 with your soil.", 2, 0], F["unlocked"])
        ok("digging finds soil; only digger pets (moles, ...) dig", F["soilFrom"] == "soil" and "Only diggers" in F["petDig"], F)
        ok("cows drop no seeds (pumpkin seeds come from the orchard and the old mound instead)",
           F["cowSeeds"] == 0 and F["pumpkinFrom"], F)
        ok("digging finds dung -- and early things: earthworms, flint, an odd old coin",
           all(k in F["digLoot"] for k in ("dung", "earthworm", "flint", "oldcoin")), F["digLoot"])
        ok("the compost bin makes fertiliser from dung and fruit (or honeycomb)",
           F["fertRecipes"][:2] == [["fertiliser", {"dung": 15, "apple": 5}], ["richfertiliser", {"dung": 20, "honeycomb": 1}]], F["fertRecipes"])
        ok("  on a growing crop it's 25% quicker (once a crop)", "goes on a growing crop" in F["fertNotGrowing"]
           and F["fert"][0].endswith("25% quicker.") and "already fertilised" in F["fert"][1] and F["fertStage"] == [1, 0], F)
        ok("flint arrowheads and arrows: a Hunter's start before metal",
           F["flint"] == [["flintarrowheads", 1, "flint"], ["flintarrow", 1, "arrowshaft+feather+flintarrowheads"]], F["flint"])
        print()
        N = R["n"]
        ok("every workshop is a skill of yours (Smelting, Smithing, Crafting, Fletching, Herblore, Gemology, Cooking, Farming);"
           " a beginner makes only the basics",
           N["locked"] == "Bronze chestplate needs Smithing level 5." and N["view0"]["open"] is False
           and N["view0"]["level"] == 5 and N["allSkills"], N)
        ok("  every making teaches you: batches of arrowheads -> Smithing level 5",
           N["level"] == 5 and N["log"] == "You reached Smithing level 5!" and N["nowPlate"], N)
        ok("  the tiers (the crafters' old levels): bronze to 5, bone 6-9, iron 10+, the compound bow 20",
           N["tiers"] == [5, 8, 15, 20] and "level 15" in N["ironLocked"], N)
        ok("  your kitchen is your Cooking; the sandbox sets any skill", N["kitchen"] == "cooking" and N["dev"] == "Fletching set to level 20.", N)
        ok("  an old save: the crafters' levels become yours (Bram's Smithing, Fen's Fletching ...), and a purse of 100 coins",
           N["migratedLv"] == [10, 5, 3, 2, 100], N["migratedLv"])
        print()
        M = R["m"]
        ok("tin from level 1, on rocks of its own (Cam: no tin at levels 1-4; then copper and tin split)", M["quarryTin"], M)
        ok("digging finds copper and tin fragments; 5 make an ore", M["digFrags"]
           and M["combined"] == ["You pressed 10 copper fragments into 2 × copper ore.", 2, 2] and "takes 5" in M["notEnough"], M)
        ok("bronze tools: five bronze bars at the anvil, twig handles", M["pickCost"] == {"bronzebar": 5, "twigs": 20}, M["pickCost"])
        ok("lumbering gives only what's on the ground -- twigs and leaf litter -- until you have a hatchet", set(M["twigs"]) <= {"twigs", "leaflitter"} and "twigs" in M["twigs"] and "birch" in M["withAxe"], M)
        ok("everything worn has a level: bronze and soft leather Defence 1, bone 5, iron 10; bows by Ranged; pet things by pet level",
           M["wear"] == [{"defence": 1}, {"defence": 1}, {"defence": 5}, {"defence": 10}, {"ranged": 5}, {"ranged": 20}, {"pet": 3}]
           and M["softLeather"] == "Soft leather", M)
        ok("creatures hit with a type and have weaknesses and resistances (a cow: crush; weak to slash, resists crush)",
           M["cow"] == ["crush", {"slash": 1.5}, {"crush": 0.75}], M["cow"])
        ok("  so a sword beats a club against cows (over several hunts)", sum(a for a, _ in M["slashVsCrush"]) > 1.3 * sum(b for _, b in M["slashVsCrush"]), M["slashVsCrush"])
        ok("classes have specials and their own resistances and weaknesses",
           M["classes"] == [[["aimed", "volley", "pinningshot", "rainofarrows"], {"pierce": 0.8}, {"crush": 1.25}], [["cleave", "rage", "bloodlust", "skullsplitter"], {"crush": 0.8, "slash": 0.8}, {"pierce": 1.25}]], M["classes"])   # (V18: more by class level)
        ok("your style and special: a Hunter can't Cleave; Aimed shot uses extra arrows; Defensive trains Defence; fights are kept blow by blow",
           "no special like that" in M["badSpecial"] and all(M["hunter"][:2]) and M["hunter"][2] == 0 and M["hunter"][3] and M["hunter"][4], M["hunter"])
        print()
        B2 = R["b2"]
        ok("eleven hunting areas, each with a boss and a kill count (Farmyard 50, Pasture 120 ... the Coast 350 ... the Nile 600; the Hollow Crypt since Part 13, mid game since V8)",
           B2["areas"] == [["farmyard", 1, "gideon", 50], ["pasture", 5, "billy", 120], ["meadow", 10, "jack", 200], ["forest", 18, "bambi", 300], ["coast", 22, "snapjaw", 350],
                           ["deepforest", 28, "grizz", 400], ["jungle", 40, "basilisk", 500], ["hollowcrypt", 40, "morvane", 200], ["frostpeak", 44, "yeti", 500], ["desert", 48, "sphinx", 550], ["nile", 50, "kingnile", 600]], B2["areas"])
        ok("  pigs and foxes in the Farmyard; goats, sheep, horses and cattle dogs in the Pasture",
           {"pig", "fox"} <= set(B2["farmyard"]) and {"goat", "sheep", "horse", "cattledog"} <= set(B2["pasture"]), B2)
        ok("  every creature and every pet has a picture", B2["art"] == [], B2["art"])
        ok("a boss needs its area's kills; beating it resets the count",
           "after 50 kills" in B2["early"] and B2["first"][0].startswith("You beat Gideon Fox!") and B2["first"][1:] == [0, 1, True], B2)
        ok("  losing (or running) resets it too", B2["lose"][0] == 0 and B2["lose"][1] == 1, B2["lose"])
        ok("  kills in the area count toward the boss", B2["counted"] > 0, B2["counted"])
        ok("beat Gideon: foxes hatch from uncommon eggs (not before); 10 times: Gideon from rare ones",
           B2["foxUnlocked"] == [True, True, False] and B2["gideonEgg"], B2)
        ok("  Billy: once -- rams from uncommon eggs; 15 times -- Billy from rare ones", B2["billyEgg"] == [True, True], B2["billyEgg"])
        ok("Gideon as your companion steals from animals (more as he levels)", B2["stole"] > 0 and "steals 2 things" in B2["ally"][0], B2)
        ok("  and steals the area's egg from bosses sometimes -- which hatches into that area's animals",
           B2["eggs"] > 0 and B2["areaEgg"] == ["chicken/white", "duck/mallard", "pig/pink", "fox/red"], (B2["eggs"], B2["areaEgg"]))
        ok("Billy fights at your side for a set hit that grows with his level (level 10: 3)",
           len(B2["billy"]) > 0 and set(B2["billy"]) == {3} and "3 damage a round" in B2["ally"][1], B2["billy"])
        ok("evasion: Bambi dodges your hits; a full Nimble Fox set means you hit every time",
           B2["dodges"][0] > 0 and B2["dodges"][1] == 0, B2["dodges"])
        ok("boss sets: lots of boss material, a crafter level, special effects, a special look at 3 pieces",
           B2["setRecipe"]["needs"]["slyfur"] == 12 and B2["setLevel"] == 10 and B2["skin"] == "nimble" and B2["sets"], B2)
        Wt = R["wait"]
        ok("your fights come back to back -- a second's breath between them (Cam, 2026-10-07: \"Get rid of the timer between each fight\")",
           Wt["first"] == 1000 and Wt["fights"] > 1440, Wt)
        ok("  and still the same however often it's looked at", Wt["split"], Wt)
        St = R["stone"]
        ok("mining: copper and tin on rocks of their own, both level 1 (Cam: \"split copper and tin ore to have their own cards\")",
           St["split"] == [[1, "copper", True], [1, "tin", True]] and St["noQuarry"], St)
        ok("  iron at level 15, RuneScape's grind", St["iron"] == 15, St["iron"])
        ok("  ore needs a pickaxe; stone, flint and clay come by hand (never ore)",
           "needs a pickaxe" in St["noPick"] and St["byHand"].startswith("You went mining") and set(St["handItems"]) <= {"stone", "flint"}
           and St["handItems"].get("stone", 0) > 80, St)
        ok("stone tools cost a fair bit of stone and twigs, made at your bench",
           St["costs"] == [{"stone": 50, "twigs": 25}, {"stone": 40, "twigs": 30}] and all(m.startswith("You made a stone pickaxe") for m in St["made"]), St)
        ok("  a stone pickaxe is too soft for iron", "bronze pickaxe or better" in St["tooSoft"] and "too soft" in St["tooSoft"], St["tooSoft"])
        ok("  and is worn by each copper or tin ore: two pickaxes (300 ore each, 2026-10-10): 600 tin, then home (the last one broke)",
           St["after"][0] is None and St["after"][1] == 0 and St["after"][2] == 600 and St["after"][3] is None and St["after"][4], St["after"])
        ok("a stone hatchet: only the softest trees; 300 logs each (2026-10-10, was 15), then twigs only",
           "bronze hatchet or better" in St["oakSoft"] and St["hatchet"][0] == 0 and St["hatchet"][1] is None
           and St["hatchet"][2] == 300 and St["hatchet"][3], St)
        ok("steel (an iron ore and two coal) and mithril bars at your furnace, for a few coins",
           St["steel"].startswith("You made a steel bar (+") and St["steelBag"] == [1, 15, 90, 97]
           and "mithril bar" in St["mithril"], St)
        ok("  steel and mithril tools (tiers 3 and 4); adamantite needs steel, runite mithril",
           St["toolsNew"] == [[3, 20], [4, 30], [3, 20], [4, 30]] and St["tiers"] == [2, 3, 4], St)
        ok("  steel and mithril armour and swords (Defence/Attack 20 and 30)",
           St["wear"] == [{"defence": 20}, {"defence": 30}, {"attack": 20}, {"attack": 30}], St["wear"])
        ok("gem cutting is Gemology: a chisel and a pot of water (a clay pot, filled)",
           "chisel" in St["cutNoKit"] and St["pot"][0].startswith("You made a clay pot")
           and St["pot"][1].startswith("You made a pot of water") and "chisel" in St["chisel"], St)
        ok("  finer gems take more rough gems and a higher level; the chisel is kept, each pot of water used up",
           St["cut"][0].startswith("You made an opal") and St["cut"][1].startswith("You made a sapphire") and "level 24" in St["cut"][2]
           and St["cutBag"] == [1, 1, 27, 1, 0] and "pot of water" in St["noWater"], St)   # 1 and 2 rough gems a cut (the economy, 2026-10-10)
        ok("  Gemology sets cut gems into rings and necklaces", St["ring"])
        ok("  every new thing has a picture", St["art"] == [], St["art"])
        ok("an old save mid-trip at the Quarry carries on at the Copper rocks", "copper" in St["oldTrip"], St["oldTrip"])
        Lc = R["leather"]
        ok("the tanner: hard leather (cow hide, Crafting 15), snake leather and bat leather (25), armadillo leather (32), for coins",
           Lc["tanner"][1:5] == [["hardleather", 15, "cowhide", 12], ["snakeleather", 25, "snakeskin", 15], ["batleather", 25, "batwing", 15],
                                ["armadilloleather", 32, "armadillohide", 20]], Lc["tanner"])
        ok("  a full set of each, sewn at your bench (a needle each, used up)", Lc["sets"] == [True] * 4
           and Lc["tan"].startswith("You made a snake leather") and Lc["sew"].startswith("You made a snakeskin body")
           and Lc["after"] == [1, 0, 85], Lc)
        ok("  snakeskin suits a Hunter, bat leather the Arcane, armadillo a Berserker; hard leather anyone",
           Lc["bonus"] == ["hunter", "arcane", "berserker", ""] and Lc["req"] == [{"defence": 10}, {"defence": 20, "ranged": 20}, {"defence": 30, "attack": 25}], Lc)
        ok("  worn by its class, each piece gives more (a Hunter: +2 ranged a piece and accuracy; a Berserker only the base)",
           Lc["snake"] == [10, 5, 5, 0, 0.1], Lc["snake"])
        ok("new creatures: bats (Forest, Deep Forest) drop bat wings, armadillos (Deep Forest, Jungle) hides; snakes their skins",
           Lc["drops"] == ["batwing", "armadillohide", "snakeskin"] and Lc["where"] == ["forest/deepforest", "deepforest/jungle"] and Lc["art"], Lc)
        ok("foraging works like mining: a card per material (each mostly its own thing), the dearest highest up",
           Lc["mains"] and Lc["top"] == [["saffron", 50, 4], ["vanilla", 47, 3], ["orchid", 44, 3]]
           and Lc["valuable"] == [5, 6, 8] and Lc["oldIds"], Lc)
        ok("  the top spots need a better basket (maple tier 3, yew tier 4, woven at your bench)",
           "yew basket or better" in Lc["needBasket"] and Lc["withYew"] and Lc["baskets"] == [[3, 22], [4, 32]], Lc)
        Ec = R["econ"]
        ok("a new player has 100 coins", Ec["coins0"] == 100, Ec["coins0"])
        ok("a bronze pickaxe wears a little on every copper and tin (2026-10-09: one a find; six hours leave it whole)",
           0 < Ec["copperWear"][0] < Ec["durs"][0] and Ec["copperWear"][1] == 1, Ec["copperWear"])
        ok("  iron (a level up) wears it three a find; bronze lasts 4500 uses, iron 5000, a stone pick 300 ore above it (2026-10-10)",
           Ec["ironWear"][0] >= 3 * Ec["ironWear"][2] and Ec["ironWear"][1] == 1 and Ec["durs"] == [4500, 5000, 300], Ec)
        ok("  a warning at 75% worn says to mend it at the anvil", Ec["warned"], Ec)
        ok("  mending costs half the materials and half the fee, and resets it",
           Ec["repairCost"] == {"ws": "anvil", "needs": {"bronzebar": 3, "twigs": 10}, "fee": 3} and "not enough bronze bar" in Ec["noBars"]
           and Ec["mended"].startswith("Mended at the anvil") and Ec["after"] == [0, 0, 0, 7] and "isn't worn" in Ec["notWorn"], Ec)
        ok("  stone tools can't be mended", "can't be mended" in Ec["stoneNo"], Ec["stoneNo"])
        ok("  left unmended it breaks; the last one ends the trip", Ec["broke"] == [0, None, True, True], Ec["broke"])
        ok("needles and pots of water are used up (not kit)", Ec["needleItem"] == [False, False], Ec["needleItem"])
        ok("Marlow buys what you can spare and sells basics; not the tool you're using",
           Ec["sell"] == "Sold 10 × copper ore to Marlow for 1 coin." and Ec["coinsAfterSell"] == [3, 0, 0.13]   # a fifteenth of a find's old worth (2026-10-09); 0.13 since the Stone wall stopped giving copper (2026-10-20)
           and "using" in Ec["inUse"] and Ec["buy"] == "Bought 2 × needle from Marlow for 8 coins." and "30 coins" in Ec["poor"], Ec)
        ok("  the furnace and anvil need coins to run", Ec["fee"].startswith("The furnace costs 1 coin"), Ec["fee"])
        ok("Zeph the travelling merchant: Sundays only, pays half again more, sells exotic eggs",
           Ec["zephDays"] == [True, False] and "isn't in the village" in Ec["zephAway"]
           and Ec["zephSell"] == "Sold 10 × copper ore to Zeph for 2 coins."   # (half again more on 0.13 a copper, 2026-10-20) and Ec["zephBuy"].startswith("Bought an exotic egg")
           and Ec["exotic"] == [1, True, "Exotic egg"], Ec)
        ok("prices by tier: each ore and log up the ladder is worth more; made things are worth what went in",
           Ec["tiers"] == [True, True] and Ec["madeWorth"], Ec)
        ok("  nothing from a merchant sells for more than it cost; Marlow has two rare things a day",
           Ec["noArb"] and Ec["daily"] == [2, True, True] and "today" in Ec["notToday"], Ec)
        ok("  coin sinks: another nest for the hatchery (3,000 then 8,000), a shelf for the windowsill",
           Ec["nest"] == [2, 3000, "Another nest in the hatchery is built (3000 coins): one more egg at a time.", 3, 0, 8000]
           and "2500 coins" in Ec["shelf"][0] and Ec["shelf"][1] == 6, Ec)
        ok("Mira the alchemist: 2 copper + 2 tin (+4 coins) -> an iron ore; ladders up to runite, magic logs, diamonds",
           Ec["ironRec"] == [{"copper": 2, "tin": 2}, 4] and Ec["alch"] == "Mira the alchemist made you an iron ore (4 coins)."
           and Ec["alchBag"][1:] == [0, 0, 16] and Ec["ladders"], Ec)
        ok("Iris the reskinner comes after two bosses: exotic skins and your own paint (bad colours dropped)",
           Ec["irisAway"][0] is False and "two bosses" in Ec["irisAway"][1] and Ec["irisHere"]
           and Ec["reskinOk"] == [True, 900, True] and Ec["paintOk"] == [150, {"b": "#ff0000"}] and Ec["palSkin"] == "#ff0000", Ec)
        Cr = R["craft"]
        ok("Crafting: a new skill and a village workshop -- pottery (bowl 1, mug 3, pie dish 4, plant pot 5)",
           Cr["skill"] == [True, 1] and [r for r in Cr["recipes"] if r[0] in ("bowl", "mug", "piedish", "plantpot")] == [["bowl", 1], ["mug", 3], ["piedish", 4], ["plantpot", 5]]
           and Cr["short"].startswith("Not enough")
           and xpless(Cr["bowl"]) == xpless("You made a clay bowl (+10 Crafting xp).") and "Crafting level 5" in Cr["potLocked"] and Cr["pot"].startswith("You made a plant pot")
           and Cr["bag"] == [1, 1, 70], Cr)
        ok("  the kitchen's rabbit stew needs a bowl (and uses it); herb dishes and teas heal more",
           xpless(Cr["stew"]) == xpless("You cooked a rabbit stew (+34 Cooking xp).") and "clay bowl" in Cr["noBowl"] and Cr["heals"] == [15, 10, 4, 6], Cr)
        ok("  herb pots on the farm: a plant pot, a herb seed (by Farming level), then pick -- the pot stays",
           "plant pot" in Cr["noPot"] or "no pot" in Cr["noPot"].lower(), Cr["noPot"])
        ok("    planting, growing, picking", Cr["added"] == "You set pot 1 on the windowsill." and "mint seed" in Cr["noSeed"] and "Farming level 8" in Cr["lowLevel"]
           and Cr["planted"] == "You planted mint in pot 1." and "isn't ready" in Cr["early"] and Cr["readyNote"] == "Pot 1: the mint is ready to pick."
           and Cr["view"] == [1, True, ["mint", "rosemary", "thyme", "chamomile", "lavender", "ginseng", "saffron"]] and Cr["picked"].startswith("You picked 3 × mint")
           and Cr["after"] == [3, 1, ""] and xpless(Cr["tea"]) == xpless("You cooked a mint tea (+10 Cooking xp)."), Cr)
        ok("  pies (fish, pumpkin) need a pie dish from your potter's wheel", Cr["pies"] == [1, 1], Cr["pies"])
        ok("  herb seeds come from foraging; every new thing has a picture", Cr["seedsFrom"] and Cr["art"] == [], Cr)
        ok("tin fragments are as common as copper at the Garden patch", Cr["tin"][0] == Cr["tin"][1], Cr["tin"])
        Ti = R["tiers"]
        ok("fishing tiers, RuneScape-style: shrimp and sardines up to sharks and manta rays", Ti["ladder"], Ti)
        ok("  by method: small net, rod and earthworms, fly rod and feathers, lobster cage, harpoon",
           Ti["methods"] == ["bait:fishingrod:earthworm", "cage:lobstercage:", "fly:flyrod:feather", "harpoon:harpoon:", "net:papyrusnet:", "net:smallnet:"], Ti["methods"])
        ok("  raw fish don't heal; cooked fish heal more the better the fish (shrimps 3 ... manta ray 18)",
           Ti["rawHeals"] == [0, 0, 0] and Ti["cookedHeals"] == sorted(Ti["cookedHeals"]) and Ti["cookedHeals"][0] == 3 and Ti["cookedHeals"][-1] == 18
           and Ti["cookRecipes"] == [1, 15, 33, 40], Ti)
        ok("  you make the tools: the net and cage at your bench, rods by fletching, the harpoon at the anvil",
           Ti["makers"] == ["crafting", "fletching", "fletching", "crafting", "anvil"] and Ti["netForAll"] == 1, Ti["makers"])
        ok("  a spot needs its tool and bait; bait is used one a catch, and you come home when it runs out",
           "fishing rod" in Ti["noRod"] and "earthworms for bait" in Ti["noBait"] and Ti["bait"][0] == 0 and Ti["bait"][1] is False
           and Ti["bait"][2].startswith("Out of earthworms") and Ti["bait"][3] is False, Ti)
        ok("  mithril and up (and yew and up) need an iron tool", "iron pickaxe" in Ti["ironTool"] and Ti["ironOk"] == "You went mining at the Mithril rocks.", Ti)
        ok("the Coast: crabs, seagulls and seals, Snapjaw the boss, its own egg and pets",
           Ti["coast"] == ["snapjaw", ["crab", "gull", "seal"], ["crab/red", "gull/white", "seal/grey"], True], Ti["coast"])
        L = R["live"]
        ok("live battles: a fight starts when you find prey, a round every 2.4 s", L["before"] is False and L["started"] == ["hunt", 0, 2400] and L["round"] in (1, "over"), L)
        ok("  the same fight however often it's looked at", L["split"], L)
        ok("  the battle screen sees it (who, health, the next round)", L["view"] and L["view"][0] == "hunt" and all(L["view"][1:4]) and L["view"][4] == "Farmyard", L["view"])
        ok("eating in a fight heals by the food and costs your next attack",
           L["ateApple"][0] == "You ate an apple (+2 health) -- it costs your next attack." and L["ateApple"][1:] == [7, True]
           and L["ateSteak"] == 17 and L["lostTurn"] and "won't heal" in L["raw"], L)
        ok("  fruit heals a little, cooked food more", L["heals"] == [1, 2, 2, 6, 10, 14], L["heals"])
        ok("run: the fight ends, the hunt goes on (you look for more)",
           L["ran"][0].startswith("You got away from the ") and L["ran"][1:] == [False, True, True, True] and L["notIn"] == "You're not in a fight."
           and L["home"] is False, L)
        ok("the special: a class, a full enough bar, then it fires next round",
           "class" in L["noClass"] and "needs" in L["lowBar"] and L["queued"] == ["Next attack: Cleave!", True] and L["cleaved"] == [True, True], L)
        ok("a boss is a live fight: the hunt trip ends; no new trip mid-fight; running loses and resets the count",
           L["boss"][0] == "Gideon Fox appears -- the fight is on!" and L["boss"][1:3] == ["boss", False] and L["boss"][3] == "You're already in a fight."
           and "Finish your fight" in L["boss"][4] and L["bossRun"] == [0, 1, True, False], L)
        ok("  the sandbox's time warp moves a fight on too", L["warp"] is True, L["warp"])
        print()
        E = R["e"]
        ok("slice 4 -- developer tools are refused outside the sandbox", E["realDev"] == "Developer tools only work in the sandbox.", E["realDev"])
        ok("the sandbox's instant hatch (and the diary still says what hatched)",
           E["instant"] == "You took a starter egg. It's hatching!" and E["instantLog"].startswith("Your egg hatched"), (E["instant"], E["instantLog"]))
        ok("expeditions are from 3 days old (Cam, 2026-10-06)", "too young" in E["young"] and "from 3 days old" in E["young"] and E["stage"] == "young", E)
        ok("  each area needs a pet level; each later one opens when the one before it has been cleared",
           E["needLevel"] == "The Meadow needs a level 3 pet." and E["later"] == "The Void opens once a pet has cleared the Devil's plains.", E)
        ok("all 13 areas from the brief, all of them real now (2026-10-06)", [a for a, _ in E["areas"]] == ["farm", "meadow", "forest", "ocean", "caves",
           "dungeons", "sky", "volcanic", "cemetery", "deepforest", "darkforest", "devilsplains", "void"]
           and [l for _, l in E["areas"]] == [1, 3, 6, 10, 15, 20, 25, 30, 34, 38, 42, 46, 50], E["areas"])
        ok("send it: a run of stages, its pack taken from the bag, the pet away (no feeding)",
           "set off for the Farm -- 3 stages" in E["sent"] and "carrying carrot soup ×3" in E["sent"] and E["packTaken"] == 2
           and E["away"][0] == "away" and E["away"][1] == "Farm" and E["away"][3] == 3 and 500 < E["away"][2] <= 600
           and "away on an expedition" in E["busy"], E)
        ok("  home with what it found, its stages in the diary", E["back"]["away"] is None and E["back"]["lastExp"]["reached"] >= 1
           and "the Farm" in E["backLog"] and "stages)" in E["backLog"], (E["back"]["lastExp"], E["backLog"]))
        ok("  the same run gives the same things however it's looked at", E["same"])
        ok("a fall: home with an injury that won't heal untreated (Cam's salves, the Apothecary table)",
           E["fell"] == ["fell", "light", True, None] and "won't heal until it's treated" in E["untreated"], (E["fell"], E["untreated"]))
        ok("  treated with something strong enough, it heals -- then it can go again",
           "won't treat" in E["weak"] and E["treated"].startswith("You treated") and "healing for" in E["healing"] and E["mended"]
           and "called" in E["recall"], E)
        ok("area level 5: mastered, a quarter shorter",
           E["mastered"]["mastery"] == 5 and E["mastered"]["minutes"] == 23 and abs(E["shorter"] - 23) <= 1, (E["mastered"], E["shorter"]))
        ok("the pet levels up (dev: level 15 opens the Caves)", E["petLevel"] == 15 and E["caves"] is True, E)
        ok("loot crates open into several things, listed one by one (for the popup)",
           E["crate"].startswith("Inside the iron crate: ") and not E["crateGone"] and E["crateGot"] == [4, True], (E["crate"], E["crateGot"]))
        ok("found eggs: hatched when there's room, used up", "haven't found a rare egg" in E["noEgg"]
           and E["foundEgg"] == ["You took a rare egg. It hatches in 1 hour.", 0], E)
        ok("sandbox: every egg, time warp, infinite items, give, max everything",
           E["allEggs"] and E["warpAge"] == 2 and E["infinite"] == [True, True] and E["gave"] == 7
           and E["maxed"] == [1200, 50] and E["warpTrip"] == 1200, E)

# ---- the save -------------------------------------------------------------------
import pet  # noqa: E402
tmp = tempfile.mkdtemp(prefix="nn-pet-")
try:
    pet.DATA_DIR_PROVIDER = lambda: tmp
    ok("no save yet: an empty state", pet.load() == {"v": 1, "pet": None, "log": []})
    good = {"v": 1, "log": [], "pet": {"name": "Mochi", "species": "bunny", "colour": "pink", "born": 1, "hatchAt": 2, "at": 3,
                                       "s": {"full": 50, "happy": 50, "energy": 50, "clean": 50, "health": 50}}}
    ok("a pet is saved", pet.save(good) == {"ok": True} and pet.load() == good)
    good2 = json.loads(json.dumps(good)); good2["pet"]["s"]["full"] = 90
    pet.save(good2)
    ok("  the save before is kept beside it", json.load(open(os.path.join(tmp, "pet", "pet.json.bak"))) == good)
    bad = json.loads(json.dumps(good)); bad["pet"]["s"]["full"] = 140
    ok("nonsense isn't saved (stats out of range, not a pet, no name)",
       "error" in pet.save(bad) and "error" in pet.save({"hello": 1}) and "error" in pet.save({"v": 1, "pet": {"species": "cat"}})
       and pet.load() == good2)
    open(os.path.join(tmp, "pet", "pet.json"), "w").write("{broken")
    ok("a damaged save falls back to the copy before", pet.load() == good)
    ok("  no stray temp files", not [f for f in os.listdir(os.path.join(tmp, "pet")) if f.startswith(".pet-")])
    dev = json.loads(json.dumps(good)); dev["dev"] = {"on": True}
    ok("the sandbox has its own save, and can't be saved over the real game",
       pet.save(dev, "dev") == {"ok": True} and os.path.exists(os.path.join(tmp, "pet", "pet-dev.json"))
       and "error" in pet.save(dev, "main") and pet.load("dev")["dev"] == {"on": True} and "dev" not in pet.load("main"))
finally:
    shutil.rmtree(tmp, ignore_errors=True)

# ---- wired in -------------------------------------------------------------------
app = read(UI, "app.js")
index = read(UI, "index.html")
nn = __import__("backend_src").backend_source(APP)
# NeuroPets is its own game since 2026-10-03 (Cam: "NeuroPet will eventually migrate off the
# NeuroNet app and become a fully standalone game that will have its own short cut ... If you
# think that is better to do now then do it please"): its own window, launcher and sandbox.
game_html = read(UI, "pet", "index.html")
game_js = read(UI, "pet", "game.js")
np_py = read(APP, "neuropets.py")
ok("NeuroPets is its own app: neuropets.py and its own page (rules, art, pages, then the shell)",
   os.path.isfile(os.path.join(APP, "neuropets.py")) and 'BUS_NAME = "org.neuropets.App"' in np_py
   and game_html.index('src="petcore.js"') < game_html.index('src="petart.js"') < game_html.index('src="pet.js"') < game_html.index('src="game.js"')
   and 'href="pet.css"' in game_html and 'href="game.css"' in game_html and "Content-Security-Policy" in game_html
   and "script-src 'self'" in game_html)
ok("  NeuroNet no longer carries it (no section, scripts or save of its own -- the game is the only writer)",
   '{key: "pet"' not in app and '{key: "dev"' not in app and "SS.Pet" not in app
   # Pixel art (1.0.12) reads the ART and the item names for its templates --
   # the two pure files only, never the game's page or anything that saves
   and set(re.findall(r'src="pet/([^"]+)"', index)) <= {"petart.js", "petcore.js"}
   and "def pet_load" not in nn and "def pet_save" not in nn and "pet.DATA_DIR_PROVIDER = lambda: data_dir()" in nn)
ok("  its own shortcut: the neuropets command, an app icon, Super+Alt+G",
   os.access(os.path.join(APP, "neuropets"), os.X_OK)
   and " neuropets " in read(APP, "system", "bin", "neuronet-setup")
   and "Exec=neuropets" in read(APP, "system", "templates", "NeuroPets.desktop.in")
   and os.path.isfile(os.path.join(APP, "icons", "NeuroPets.png"))
   and 'o.bind("SUPER + ALT + G", "NeuroPets' in read(APP, "system", "hypr", "bindings.lua.block"))
ok("  the key tucks it away again, like NeuroNet's (neuropets toggle); the app icon only ever shows it",
   '"neuropets toggle")' in read(APP, "system", "hypr", "bindings.lua.block") and "Exec=neuropets show" in read(APP, "system", "templates", "NeuroPets.desktop.in")
   and 'workspace = \\"special:$SPECIAL\\", follow = false' in read(APP, "neuropets") and 'toggle)  here yes ;;' in read(APP, "neuropets"))
# Cam (2026-10-03): "I cant see any of the other pages" -- sectionOf() didn't know
# "pet:", so Pixel Pet's pages had no subsection menu. Every section's views must map.
sec_map = dict(re.findall(r'(\w+): "(\w+)"', app.split("function sectionOf(v)", 1)[1].split("}[prefix]", 1)[0]))
section_keys = re.findall(r'\{key: "(\w+)", name: "[^"]+", children: \[', app)
unmapped = []
for sec in section_keys:
    body = app.split('{key: "%s", name: ' % sec, 1)[1].split("]},", 1)[0]
    for child in re.findall(r'key: "(\w+):[\w-]+"', body):
        if child not in ("settings",) and sec_map.get(child) != sec and sec not in ("settings", "photos"):
            unmapped.append("%s:... -> %s" % (child, sec))
ok("every section's pages are known to sectionOf (else no subsection menu)", not unmapped, unmapped)
pj = read(UI, "pet", "pet.js")
ok("the Hatchery is its own page (Cam: \"i cant find the hatchery\"), and My pet points to it",
   '"pet:hatchery": {name: "Hatchery"' in game_js and "function renderHatchery(host)" in pj
   and "${hatcheryNote(" in pj and "Put the egg in the Hatchery" in core_src)
groups = game_js[game_js.index("const GROUPS = ["):game_js.index("];", game_js.index("const GROUPS = ["))]
ok("the sidebar: Home and the Map -- everything else is a place (2026-10-08: a navigation game; the Camp is in the Forest)",
   '["", ["pet:house", "pet:world"]]' in groups and "pet:camp" not in groups and "pet:bag" not in groups and "pet:workshop" not in groups and "pet:mining" not in groups and "shop:" not in groups
   and "pet:outskirts" not in groups and "pet:hunt" not in groups and "pet:village" not in groups
   and '"pet:skills": {name: "Character"' in game_js and "Object.assign(PAGES, Core.skillPages());" in game_js    # skill pages from the registry (2026-10-11)
   and all({"id": k, "name": k.capitalize()}.items() <= e.items() for k in ["foraging", "fishing", "mining", "lumbering", "digging"]
           for e in json.load(open(os.path.join(APP, "ui", "pet", "content", "01-a-the-skill-registry.json"), encoding="utf-8"))["SKILL_REG"] if e["id"] == k) and "Core.GATHERING.includes(page.slice(4))" in pj and "function renderGather(host, k)" in pj
   and "function renderOutskirts(host)" in pj and "if (page === \"pet:workshop\") return renderHouse(host);" in pj   # the Workshop is your house now (2026-10-07)
   and ".filter((w) => w.npc === people && !w.region)" in pj and 'PAGES[k].parent = "pet:world"' in game_js
   and "classHTML(pv)" in pj[pj.index("function renderSkills"):pj.index("function renderOutskirts")])
ok("  Hunting: areas folded on the left, the battle window on the right; no class picker there",
   'class="pp-hunt-layout"' in pj and '<details class="pp-hunt-fold' in pj
   and "classHTML(" not in pj[pj.index("function renderHunt"):pj.index("let huntTimer")])
ok("  messages are toasts, the page intros are gone (decluttered), each skill has a LEVEL / XP panel",
   "SS.toast = " in game_js and ".pp-status { display: none" in read(UI, "pet", "game.css")
   and pj.count('class="page-h"') <= 5 and "function skillPanel(" in pj)
ok("the Developer sandbox lives in the game: a switch, its own save, its own tools page",
   "NP.sandbox = async" in game_js and '"dev:tools"' in pj and '"--sandbox" in argv' in np_py
   and 'slot === "dev" ? renderDev(host)' in pj)
# the app's Python side, on a scratch folder (never the real save)
sys.path.insert(0, APP)
import neuropets  # noqa: E402
tmp2 = tempfile.mkdtemp(prefix="nn-np-")
try:
    neuropets.pet.DATA_DIR_PROVIDER = lambda: tmp2
    api = neuropets.Api()
    st = json.loads(json.dumps(good))
    saved = api.pet_save(st, "main")
    ok("neuropets.Api keeps the game through pet.py (and says hello)", saved == {"ok": True} and api.pet_load("main") == st
       and os.path.exists(os.path.join(tmp2, "pet", "pet.json")) and "version" in api.hello(), saved)
finally:
    shutil.rmtree(tmp2, ignore_errors=True)
ok("no desktop pet card any more (removed 2026-10-15; the whole desktop board went 3 Nov 2026)",
   not os.path.exists(PLUG)
   and not os.path.exists(os.path.join(APP, "neuropets-call")) and "boardDo" not in game_js and '"Do"' not in np_py)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
