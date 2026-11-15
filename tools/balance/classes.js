// The class table (Battle Re-work, Part 1, 2026-10-15): each class hunting the ground of its level, played by the game's
// own rules -- kills, coins and combat XP an hour, food eaten, deaths, and how many hours a weapon lasts. This is the table
// the rework's targets are checked against ("Battle Re-Work" notebook in Notes, note 08 - Keeping it balanced):
//   - classes within +-15% of the average kills an hour at their level;
//   - hunting coins 1.2-1.6x gathering (after Part 2);
//   - a weapon lasting 3-6 hours of hunting.
// Two players (Part 2, no auto-heal): "idle" follows the hunt plan only (eat between fights, come home when hurt); "active"
// plays the fight too -- eats below 40% mid-fight and fires the special when the bar allows. Coins count the purse and what
// the drops sell for; "x gather" compares them with the best gathering coins an hour at that level (balance_sim's).
// Pure rules, no saves. Usage: node tools/balance/classes.js [hours] [seeds] [idle|active|both]   (writes classes.csv)
const fs = require("fs"), path = require("path");
const C = require("./core.js");
const {player, T0, foodFor, dressOwn} = require("./hunt.js");
const HOURS = +(process.argv[2] || 3), SEEDS = +(process.argv[3] || 4), MODES = (process.argv[4] || "both") === "both" ? ["idle", "active"] : [process.argv[4]];
// the best gathering coins an hour at each level (tools/balance_report.csv, from balance_sim.js)
const GATHER = (() => {
  const rows = fs.readFileSync(path.join(__dirname, "..", "balance_report.csv"), "utf8").trim().split("\n").slice(1).map((l) => l.split(","));
  // (Part 14) a shrine fed by a creature's drop (the Blood altar: blood essence from the Hollow Crypt) is hunting, not gathering --
  // the report counts its runes as if the essence were free, so it's left out of "the best gathering"
  const dropFed = new Set(C.SKILLS.runecrafting.spots.filter((sp) => sp.bait && !C.SKILLS.mining.spots.some((m) => m.loot.some((l) => l[0] === sp.bait))).map((sp) => "runecrafting:" + sp.id));
  const spots = rows.filter((r) => r[0] === "spot" && !dropFed.has(r[1])).map((r) => ({level: +r[2], coins: +r[r.length - 1]}));
  return (L) => Math.max(1, ...spots.filter((x) => x.level <= L && isFinite(x.coins)).map((x) => x.coins));
})();
const LEVELS = [10, 20, 30, 40, 50];
// "stretch" (5th argument): a ground up to 8 levels above you -- where playing the fight matters most
const STRETCH = process.argv[5] === "stretch" ? 8 : 0;
// "talents" (5th or 6th argument, Battle Re-work Part 3): every point spent, branch by branch in tree order -- the most a
// class can gain from its tree at that level, to compare with none
const TALENTED = process.argv.slice(2).includes("talents") || !!process.env.SIM_TALENTS;   // (any position: bosses_classes.js passes it too)
// "traps" (Battle Re-work Part 4): the Hunter's hunt plan lays a trap as each fight opens and nets a creature above 75%,
// with the best snare and net it could make at that level -- what they cost comes off the coins
const TRAPS = process.argv.slice(5).some((a) => /^traps|^nets/.test(a)), NETS = process.argv.slice(5).some((a) => /nets/.test(a));
// "longsword" / "maul" (Battle Re-work Part 5): the Berserker fights with the longsword or maul of its level (else a sword)
const BWEAPON = process.argv.slice(2).find((a) => a === "longsword" || a === "maul") || "";   // (any position, for bosses_classes.js too)
const METAL = (L) => L >= 50 ? "rune" : L >= 40 ? "adamant" : L >= 30 ? "mithril" : L >= 20 ? "steel" : L >= 10 ? "iron" : "bronze";
// "trapper": talents spent in the Trapper branch first (else tree order)
const TRAPPER = process.argv.slice(5).includes("trapper");
const CROOK = (L) => L >= 40 ? "magiccrook" : L >= 30 ? "yewcrook" : L >= 20 ? "maplecrook" : L >= 10 ? "willowcrook" : "oakcrook";
// the Beast Master's pet (Part 11b): pet=species/colour (default a grey wolf -- a Beast, neutral against most creatures)
const PET_KIND = (process.argv.slice(2).find((a) => a.startsWith("pet=")) || "pet=wolf/grey").slice(4);
// the Necromancer (Part 13): an Arcane who has learnt Necromancy (level 50 only -- it's learnt after Magic 50), with risen
// pets of battle level risen=N (default 30: a lost companion or a mid battle pet), Raise the fallen and Mend the dead loaded
const RISEN_LV = +((process.argv.slice(5).find((a) => a.startsWith("risen=")) || "risen=30").slice(6));
// only=hunter,beastmaster: just those classes
const ONLY = (process.argv.slice(5).find((a) => a.startsWith("only=")) || "").slice(5).split(",").filter(Boolean);
const TRAP_AT = (L) => L >= 26 ? "spikedsnare" : L >= 14 ? "ropesnare" : "twigsnare", NET_AT = (L) => L >= 28 ? "weightednet" : "twinenet";
const groundFor = (L) => C.HUNT_ORDER.filter((g) => C.HUNTS[g].level <= L + STRETCH && C.HUNTS[g].monsters.length).sort((a, b) => C.HUNTS[b].level - C.HUNTS[a].level)[0];
const WAND = [[40, "magicwand"], [30, "yewwand"], [20, "maplewand"], [10, "oakwand"], [1, "willowwand"]];
// the hardest-hitting spells a player would load (not the newest: Bind at 20 is a stun with base 2 -- Part 6)
const SPELLS_AT = (L, n) => Object.keys(C.SPELLS).filter((k) => C.SPELLS[k].level <= L && !C.SPELLS[k].heal && !C.SPELLS[k].req && !C.SPELLS[k].scroll && C.SPELLS[k].gate === undefined)   // (Necromancy's own: below)
  .sort((a, b) => C.SPELLS[b].base * (C.SPELLS[b].hits || 1) - C.SPELLS[a].base * (C.SPELLS[a].hits || 1) || C.SPELLS[b].level - C.SPELLS[a].level).slice(0, n || 3);

function setUp(cls, L) {
  const food = [foodFor(L), 400];
  let s;
  if (cls === "arcane" || cls === "necromancer") {
    s = player(L, "berserker", "accurate", null, null, food);            // armour, food; then the Arcane's own kit
    s.player.freeSwitch = 1; const r = C.act(s, "class", {cls: "arcane", guild: true}, T0); if (r.ok) s = r.state; else throw new Error(r.error);   // (a switch is made at the Guild hall since Part 9)
    s.player.skills.magic = C.XP[L];
    const wand = WAND.find((w) => w[0] <= L)[1];
    s.bag[wand] = 1; s.player.gear.weapon = wand;
    RUNES.forEach((k) => { s.bag[k + "rune"] = 900; });
    s.player.loadout = SPELLS_AT(L, 4);   // (castFor uses as many as the loadout allows)
    if (cls === "necromancer") {
      s.player.necro = {offered: T0, accepted: T0, taught: T0};
      s.beasts = [0, 1, 2].map((i) => ({id: "risen" + i, name: "Risen " + (i + 1), species: "wolf", colour: "grey", born: T0, hatchAt: T0, joined: T0, xp: C.XP[RISEN_LV], stat: {}, train: "",
                                        trainAt: T0, fedUntil: 0, restUntil: 0, wins: 0, faints: 0, risen: true, raised: 1}));
      s.player.loadout = ["raisefallen", "menddead"].concat(SPELLS_AT(L, 2));
      if (TALENTED) s.player.necroLoad = true;                             // (after the talents: Bone spear joins, see below)
      s.bag.lifeessence = 50;
    }
  } else if (cls === "paladin") {                                       // a sword and a kite shield of its level (Part 8)
    s = player(L, "berserker", "accurate", null, null, food);
    s.player.freeSwitch = 1; const r = C.act(s, "class", {cls: "paladin", guild: true}, T0); if (r.ok) s = r.state; else throw new Error(r.error);   // (a switch is made at the Guild hall since Part 9)
    s.player.skills.defence = C.XP[L]; const sw = METAL(L) + "sword", sh = METAL(L) + "kiteshield"; s.bag[sw] = 1; s.bag[sh] = 1; s.player.gear.weapon = sw; s.player.gear.offhand = sh;
    s.player.combat.bashAuto = false;   // (its damage, like the others; the bash is a choice for safety)
  } else if (cls === "thief") {                                         // two daggers of its level, coated (Part 7)
    s = player(L, "berserker", "accurate", null, null, food);
    s.player.freeSwitch = 1; const r = C.act(s, "class", {cls: "thief", guild: true}, T0); if (r.ok) s = r.state; else throw new Error(r.error);   // (a switch is made at the Guild hall since Part 9)
    const dg = METAL(L) + "dagger"; s.bag[dg] = 2; s.player.gear.weapon = dg; s.player.gear.offhand = dg;
    s.bag[POISON_AT(L)] = 50; const c = C.act(s, "coat", {item: POISON_AT(L)}, T0); if (c.ok) s = c.state;
  } else if (cls === "beastmaster") {                                   // one battle pet of its level, a crook of its level (Part 11b)
    s = player(L, "berserker", "accurate", null, null, food);
    s.player.freeSwitch = 1; const r = C.act(s, "class", {cls: "beastmaster", guild: true}, T0); if (r.ok) s = r.state; else throw new Error(r.error);
    delete s.player.gear.weapon; const ck = CROOK(L); s.bag[ck] = 1; s.player.gear.weapon = ck;
    const kind = PET_KIND.split("/");
    s.beasts = [{id: "simpet", name: "Sim", species: kind[0], colour: kind[1], born: T0, hatchAt: T0, joined: T0, xp: C.XP[L], stat: {}, train: "", trainAt: T0, fedUntil: 0, restUntil: 0, wins: 0, faints: 0}];
    s.player.combat.pack = ["simpet"];
  } else s = player(L, cls, "accurate", null, cls === "berserker" && BWEAPON ? [METAL(L) + BWEAPON] : null, food);
  // the biggest bag, so a quiver of arrows or a pouch of runes doesn't leave no room for the drops (a player would manage it)
  s.bagSize = Object.keys(C.ITEMS).filter((k) => C.ITEMS[k].bagSize).sort((a, b) => C.ITEMS[b].bagSize - C.ITEMS[a].bagSize)[0];
  if (TALENTED) {
    const c = s.player.cls; s.player.classes = s.player.classes || {}; s.player.classes[c] = s.player.classes[c] || {talents: {}, builds: {}, respecs: 0};
    s.player.classes[c].xp = C.XP[L];
    for (let guard = 0; guard < 200; guard++) {
      const first = TRAPPER ? "trapper" : cls === "necromancer" ? "necromancy" : "";                 // (a Necromancer: its own branch first)
      const order = C.TALENTS[c].branches.slice().sort((x, y) => (y.id === first) - (x.id === first));
      const next = order.flatMap((b) => b.nodes).find((n) => !C.talentLock(s.player, n.id));
      if (!next) break;
      const r = C.act(s, "talent", {node: next.id}, T0); if (!r.ok) break; s = r.state;
    }
  }
  if (s.player.necroLoad) { delete s.player.necroLoad; s.player.loadout = ["raisefallen", "menddead", "bonespear", "soulsiphon"].filter((k) => !C.spellLock || true); }
  if (TRAPS && s.player.cls === "hunter") {
    s.bag[TRAP_AT(L)] = 3000; s.bag[NET_AT(L)] = 400;
    for (const o of [{trapOpen: !process.argv.slice(5).includes("nets")}, {netAbove: NETS ? 0.75 : 0}, {trap: TRAP_AT(L)}, {net: NET_AT(L)}]) { const r = C.act(s, "toolplan", o, T0); if (r.ok) s = r.state; }
  }
  const cl = C.CLASSES[s.player.cls || cls];
  // the class's damage special (a Paladin's first is Lay on hands -- a heal a player keeps for when it's needed)
  if (cl) { const r = C.act(s, "combat", {special: s.player.cls === "paladin" ? "smite" : Object.keys(cl.specials)[0]}, T0); if (r.ok) s = r.state; }
  if (process.env.SIM_KIT === "own") dressOwn(s, cls === "necromancer" ? "arcane" : cls, L);   // V17: each class in its own weight
  return s;
}
// an Arcane's runes: a bag stack holds 1000, which a long hunt burns through -- topped up every 10 minutes, as a player
// restocking would (how fast they go is the Arcane part's question, not this table's)
const RUNES = ["air", "water", "earth", "fire", "mind", "chaos", "nature", "death", "cosmic", "astral", "law", "blood"];
const POISON_AT = (L) => L >= 36 ? "deadlypoison" : L >= 20 ? "strongpoison" : "weakpoison";
function restock(st) {
  // (Part 14 audit) archers: the best quiver and a full one, as a player would carry -- without it the sim's Hunter went out with
  // 50 loose arrows and every hunt ended in minutes (the "idle collapse" in the old tables was this, not the game)
  const am = st.player.gear && st.player.gear.ammo;
  if (am) { if (!st.player.gear.quiver) { st.bag.gatorquiver = 1; st.player.gear.quiver = "gatorquiver"; } st.bag[am] = Math.max(st.bag[am] || 0, 2000); }
  if (st.player.cls === "thief" && !st.player.coat) { const r = C.act(st, "coat", {item: Object.keys(st.bag).find((k) => /poison$/.test(k) && st.bag[k] > 0) || "weakpoison"}, T0); if (r.ok) Object.assign(st, r.state); }
  if (st.player.cls === "arcane") RUNES.forEach((k) => { st.bag[k + "rune"] = Math.max(st.bag[k + "rune"] || 0, 900); }); }
function run(cls, L, seed, mode) {
  const g = groundFor(L), s0 = setUp(cls, L);
  const xp0 = ["attack", "ranged", "magic", "defence", "hitpoints"].reduce((a, k) => a + (s0.player.skills[k] || 0), 0), coins0 = s0.coins || 0, food0 = s0.bag[foodFor(L)] || 0;
  const wid = s0.player.gear.weapon;
  const isl = (C.REGIONS[g] && C.REGIONS[g].isle) || "";                // a ground on another island: you're there
  if (isl) s0.player.island = isl;
  restock(s0);
  const r = C.act(s0, "hunt", {ground: g, roll: seed}, T0);
  if (!r.ok) return {err: r.error, g};
  let st = r.state, t = T0;
  const end = T0 + HOURS * 3600e3;
  const bag0 = Object.assign({}, st.bag);
  if (mode === "active") {                                                // play each fight: eat below 40%, fire the special
    const food = foodFor(L);
    while (t < end) {
      t = Math.min(end, t + 1200); st = C.advance(st, t); if (t % 600e3 < 1200) restock(st);
      if (!st.player.job && !st.player.battle) break;
      const b = st.player.battle;
      if (!b) continue;
      const pl = st.player, mx = C.levelOf((pl.skills || {}).hitpoints || C.XP[10]);
      if (pl.hp < 0.4 * mx && (st.bag[food] || 0) > 0 && !b.skip) { const r = C.act(st, "eat", {item: food}, t); if (r.ok) st = r.state; continue; }
      const cl = pl.cls && C.CLASSES[pl.cls], sp = cl && cl.specials[pl.combat.special];
      const meter = pl.cls === "berserker" ? pl.fury || 0 : pl.cls === "paladin" ? pl.devotion || 0 : pl.spec || 0;   // a Berserker's fury (Part 5: lasts the hunt)
      if (sp && meter >= C.specCostOf(pl, sp) && !b.queued) { const r = C.act(st, "battle", {cmd: "special"}, t); if (r.ok) st = r.state; }
    }
  } else while (t < end) { t = Math.min(end, t + 2 * 60e3); st = C.advance(st, t); restock(st); if (!st.player.job) break; }   // (every 2 minutes: runes and arrows kept up -- Part 14)
  const pl = st.player, trip = pl.job || pl.lastTrip, hrs = Math.max(1 / 60, ((pl.job ? t : (pl.lastTrip ? pl.lastTrip.ended : t)) - T0) / 3600e3);
  const xp = ["attack", "ranged", "magic", "defence", "hitpoints"].reduce((a, k) => a + (pl.skills[k] || 0), 0) - xp0;
  const worn = (pl.wear || {})[wid] || 0;
  let dropValue = 0;                                                       // what the drops sell for (food eaten aside)
  Object.keys(st.bag).forEach((k) => { const d = (st.bag[k] || 0) - (bag0[k] || 0); if (d > 0 && k !== foodFor(L)) dropValue += d * C.priceOf(k); });
  if (TRAPS) [TRAP_AT(L), NET_AT(L)].forEach((k) => { dropValue -= Math.max(0, (bag0[k] || 0) - (st.bag[k] || 0)) * C.priceOf(k); });   // traps and nets used
  return {g, hrs, dead: !!pl.dead || !!(st.lastFall && st.lastFall.at > T0), kills: trip ? trip.count : 0, coins: (st.coins || 0) - coins0 + dropValue, xp, food: food0 - (st.bag[foodFor(L)] || 0), worn, dur: C.weaponDur(wid), wid};
}
module.exports = {setUp, run};                                        // (bosses_classes.js borrows the kits, audit CMB-3)
if (require.main === module) {
const rows = [];
for (const MODE of MODES) {
console.log(`\nClass table (${MODE}): ${HOURS}h hunts, ${SEEDS} seeds each, the ground of each level, cooked food carried\n`);
console.log("class      lvl ground      kills/h  coins/h x gather  xp/h   food/h falls   weapon lasts");
for (const L of LEVELS) {
  const line = [];
  for (const cls of ["hunter", "berserker", "arcane", "thief", "paladin", "beastmaster", "necromancer"].filter((c) => !ONLY.length || ONLY.includes(c)).filter((c) => c !== "necromancer" || L >= 50)) {
    const res = []; for (let i = 0; i < SEEDS; i++) res.push(run(cls, L, 0.11 + i * 0.19, MODE));
    const ok = res.filter((x) => !x.err);
    if (!ok.length) { console.log(`${cls.padEnd(10)} ${L}  ${res[0].err}`); continue; }
    const avg = (k) => ok.reduce((a, x) => a + x[k] / x.hrs, 0) / ok.length;
    const wearH = ok.reduce((a, x) => a + x.worn / x.hrs, 0) / ok.length;
    const row = {mode: MODE, cls, level: L, ground: ok[0].g, kills_h: avg("kills"), coins_h: avg("coins"), xp_h: avg("xp"), food_h: avg("food"),
                 deaths: ok.filter((x) => x.dead).length + "/" + ok.length, weapon_hours: wearH ? ok[0].dur / wearH : Infinity, weapon: ok[0].wid};
    rows.push(row); line.push(row);
    console.log(`${cls.padEnd(10)} ${String(L).padEnd(3)} ${row.ground.padEnd(11)} ${row.kills_h.toFixed(0).padStart(7)} ${row.coins_h.toFixed(0).padStart(8)} ${(row.coins_h / GATHER(L)).toFixed(2).padStart(8)} ${row.xp_h.toFixed(0).padStart(6)} ${row.food_h.toFixed(1).padStart(7)}  ${row.deaths.padEnd(5)} ${isFinite(row.weapon_hours) ? row.weapon_hours.toFixed(1) + "h (" + row.weapon + ")" : "-"}`);
  }
  const mean = line.reduce((a, r) => a + r.kills_h, 0) / (line.length || 1);
  const out = line.filter((r) => Math.abs(r.kills_h / mean - 1) > 0.15).map((r) => `${r.cls} ${((r.kills_h / mean - 1) * 100).toFixed(0)}%`);
  console.log(`           ${out.length ? "outside +-15% of the level's average kills/h: " + out.join(", ") : "all classes within +-15% kills/h"}\n`);
}
}
const csv = ["mode,class,level,ground,kills_per_hour,coins_per_hour,xp_per_hour,food_per_hour,deaths,weapon_hours,weapon"]
  .concat(rows.map((r) => [r.mode, r.cls, r.level, r.ground, r.kills_h.toFixed(1), r.coins_h.toFixed(0), r.xp_h.toFixed(0), r.food_h.toFixed(2), r.deaths, isFinite(r.weapon_hours) ? r.weapon_hours.toFixed(2) : "", r.weapon].join(",")));
fs.writeFileSync(path.join(__dirname, "classes.csv"), csv.join("\n") + "\n");
console.log("Wrote tools/balance/classes.csv");
}
