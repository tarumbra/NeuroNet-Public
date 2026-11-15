/* V17 (carried, every answer (a); Cam, 2026-10-20: "armour should give class specific bonuses and anti bonus ... How old school
   runescape handles armour"): every armour piece is Heavy, Light or Cloth -- attack by style (plate costs Magic), Defence by
   kind of attack (plate half against magic, robes half against blows), and a class fit (+10% Defence, +1 accuracy a piece).
   Run: node test/test_pet_v17.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log("  ok    " + n); } else { fail++; console.log("  FAIL  " + n + (d !== undefined ? "  -- " + d : "")); } };
const T0 = 1800000000000;
const RUNE = ["runehelm", "runeplate", "runegloves", "runelegs", "runeboots"];
const ROBES = ["archmagecirclet", "archmagecloak", "linenrobe"];
const game = (cls) => { const s = C.advance(C.newGame({mode: "adventure"}, T0), T0); s.player.made = true; s.player.name = "T"; s.player.cls = cls;
  ["attack", "ranged", "magic", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[50]; }); s.player.hp = 50; s.mageRank = 5; return s; };
const wear = (s, ids) => { s.player.gear = Object.assign({}, s.player.gear); ids.forEach((id) => { s.bag[id] = 1; s.player.gear[C.ITEMS[id].gear.slot] = id; }); return s; };
const mage = (ids) => { const s = wear(game("arcane"), ids); s.bag.magicwand = 1; s.player.gear.weapon = "magicwand"; return C.playerFighter(s, s.player, null, T0).me; };

console.log("\nEvery piece has a weight\n");
{
  const unweighed = Object.keys(C.ITEMS).filter((k) => { const g = C.ITEMS[k].gear; return g && g.who === "player" && ["helmet", "torso", "arms", "legs", "feet", "cloak"].includes(g.slot) && !C.weightOf(k); });
  ok("every player armour piece is heavy, light or cloth", !unweighed.length, unweighed.join(", "));
  ok("every listed id is a real item", Object.values(C.ARMOUR.items).every((l) => l.every((id) => C.ITEMS[id])));
  ok("jewellery, quivers and pets' things have none", !C.weightOf("rubyring") && !C.weightOf("leatherquiver") && !C.weightOf("runepetcoat"));
  ok("kite shields are heavy", C.weightOf("runekiteshield") === "heavy");
}
console.log("\nAttack by style\n");
{
  const plate = RUNE.reduce((a, id) => a + C.weightAcc(id).magic, 0);
  ok("full rune costs 42 Magic (helm, gloves, boots -6; plate and legs -12)", plate === -42, plate);
  ok("bronze plate: Magic -2, Ranged -1", C.weightAcc("bronzeplate").magic === -2 && C.weightAcc("bronzeplate").ranged === -1);
  ok("light: +1 Ranged on body and legs; the body costs a little Magic", C.weightAcc("snakechaps").ranged === 1 && C.weightAcc("snakebody").magic < 0 && C.weightAcc("snakebody").magic >= -3);
  ok("bat leather (made for the Arcane) costs no Magic", C.weightAcc("batbody").magic === 0);
  ok("cloth costs nothing", ROBES.every((id) => { const a = C.weightAcc(id); return !a.magic && !a.ranged && !a.melee; }));
  const inPlate = mage(RUNE), inRobes = mage(ROBES);
  ok("an Arcane in rune plate casts with far less accuracy than in robes", inPlate.magic.att < inRobes.magic.att - 40, inPlate.magic.att + " vs " + inRobes.magic.att);
  const b = wear(game("berserker"), ["runeplate"]); b.bag.runesword = 1; b.player.gear.weapon = "runesword";
  const b0 = wear(game("berserker"), []); b0.bag.runesword = 1; b0.player.gear.weapon = "runesword";
  ok("a Berserker in rune plate loses no melee accuracy (and gains the fit)", C.playerFighter(b, b.player, null, T0).me.att >= C.playerFighter(b0, b0.player, null, T0).me.att + 1);
  const h = wear(game("hunter"), ["armadillobody"]); const h0 = wear(game("hunter"), []);
  [h, h0].forEach((s) => { s.bag.magicbow = 1; s.bag.runearrow = 100; s.bag.gatorquiver = 1; Object.assign(s.player.gear, {weapon: "magicbow", ammo: "runearrow", quiver: "gatorquiver"}); s.player.quiverN = 100; });   // (N24: a loaded quiver)
  const fh = C.playerFighter(h, h.player, null, T0, {noAmmo: true}).me, fh0 = C.playerFighter(h0, h0.player, null, T0, {noAmmo: true}).me;
  ok("armour's Attack counts for melee only: armadillo's +att doesn't help a bow", fh.att <= fh0.att, fh.att + " vs " + fh0.att);
}
console.log("\nDefence by kind of attack\n");
{
  const p = C.gearSum(wear(game(null), RUNE).player.gear, null);
  ok("plate: full against blows, half against magic", p.defVs.crush === p.def && p.defVs.magic === p.def - Math.round(60 / 2), JSON.stringify(p.defVs) + " def " + p.def);
  const r = C.gearSum(wear(game(null), ROBES).player.gear, null);
  ok("robes: half against blows, more against magic", r.defVs.slash < r.def && r.defVs.magic > r.def, JSON.stringify(r.defVs) + " def " + r.def);
  const s = wear(game("berserker"), RUNE); s.bag.runesword = 1; s.player.gear.weapon = "runesword";
  const me = C.playerFighter(s, s.player, null, T0).me;
  const mon = (atk) => ({name: "M", hp: 30, att: 30, def: 10, maxHit: 20, atk});
  ok("a magic attacker hits a plate wearer harder than a slasher does", C.worstHit(mon("magic"), me) > C.worstHit(mon("slash"), me), C.worstHit(mon("magic"), me) + " vs " + C.worstHit(mon("slash"), me));
}
console.log("\nClass fit\n");
{
  const fitB = C.gearSum(wear(game("berserker"), RUNE).player.gear, "berserker"), fitA = C.gearSum(wear(game("arcane"), RUNE).player.gear, "arcane");
  ok("a Berserker in rune: 5 pieces fit, +10% Defence", fitB.fit === 5 && fitB.def === fitA.def + 6, fitB.fit + " " + fitB.def + " vs " + fitA.def);
  ok("an Arcane in rune: no fit", fitA.fit === 0);
  ok("Hunter, Thief and Beast Master fit light; Arcane cloth; Paladin heavy",
     C.ARMOUR.fit.hunter === "light" && C.ARMOUR.fit.thief === "light" && C.ARMOUR.fit.beastmaster === "light" && C.ARMOUR.fit.arcane === "cloth" && C.ARMOUR.fit.paladin === "heavy");
  const snake = C.gearSum(wear(game("hunter"), ["snakebody"]).player.gear, "hunter");
  ok("old class bonuses still stack (snakeskin on a Hunter)", snake.clsBonus === 1 && snake.fit === 1);
  ok("class-locked pieces stay locked (bone plate is for Berserkers)", /Berserkers/.test(C.act(Object.assign(game("arcane"), {bag: {boneplate: 1}}), "equip", {item: "boneplate"}, T0).error || ""));
}
console.log("\nTold, not stopped\n");
{
  const s = game("arcane"); s.bag.runeplate = 1;
  const r = C.act(s, "equip", {item: "runeplate"}, T0);
  ok("an Arcane may put on rune plate, and is told what it costs", !r.error && /Magic −12/.test(r.msg) && /spells will miss more/.test(r.msg), r.error || r.msg);
  const b = game("berserker"); b.bag.runeplate = 1;
  ok("a Berserker isn't warned", !/miss more/.test(C.act(b, "equip", {item: "runeplate"}, T0).msg));
  ok("the item's words give its weight", /Heavy armour: Magic −12, Ranged −3; Defence half against magic; suits Berserkers and Paladins/.test(C.describe ? C.describe("runeplate") : C.itemInfo(s, "runeplate").does), C.itemInfo(s, "runeplate").does);
  const av = C.armourView(wear(game("arcane"), RUNE).player);
  ok("the stats grid: attack by style, Defence by kind", av.att.magic === -42 && av.defVs.magic < av.defVs.crush && av.types.length === 4, JSON.stringify(av.att));
  const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  ok("the Gear card shows it (one table, penalties in red with a minus sign)", /armourGridHTML\(Core\.armourView\(s\.player\)\)/.test(PET) && /class="pl-astats"/.test(PET) && /"−" \+ Math\.abs\(v\)/.test(PET));
}
console.log("\nC8: Light and Cloth to the top\n");
{
  const rec = (id) => { for (const w in C.WORKSHOPS) { const r = (C.WORKSHOPS[w].recipes || []).find((x) => x.make === id); if (r) return Object.assign({w}, r); } return null; };
  ok("tiger hide (Defence 30) and frost hide (Defence 40): Light, sewn at the Crafting bench",
     ["tiger", "frost"].every((p, i) => ["cap", "body", "vambraces", "chaps", "boots"].every((x) => { const it = C.ITEMS[p + x]; return it && C.weightOf(p + x) === "light" && it.gear.req.defence === 30 + 10 * i && rec(p + x).w === "crafting"; })));
  ok("  tanned from big cat pelts (Jungle) and snow pelts (Frostpeak)", rec("tigerleather").needs.bigcatpelt === 1 && rec("frostleather").needs.snowpelt === 1);
  ok("  more Defence than snakeskin, a piece", C.ITEMS.tigerbody.gear.def > C.ITEMS.snakebody.gear.def && C.ITEMS.frostbody.gear.def > C.ITEMS.tigerbody.gear.def);
  const P = ["apprentice", "adept", "mage", "sorcerer", "archmage"];
  ok("robes for every mage rank: top, bottoms, gloves, boots -- Cloth, made at the altar, needing the rank",
     P.every((p, i) => ["robetop", "robebottoms", "gloves", "boots"].every((x) => { const it = C.ITEMS[p + x]; return it && C.weightOf(p + x) === "cloth" && it.gear.req.rank === i + 1 && it.gear.req.magic === 10 * (i + 1) && rec(p + x).w === "altar"; })));
  ok("  each rank's robes beat the last", P.slice(1).every((p, i) => C.ITEMS[p + "robetop"].gear.def > C.ITEMS[P[i] + "robetop"].gear.def && C.ITEMS[p + "robetop"].gear.mag > C.ITEMS[P[i] + "robetop"].gear.mag));
  const arch = C.gearSum({helmet: "archmagecirclet", cloak: "archmagecloak", torso: "archmagerobetop", legs: "archmagerobebottoms", arms: "archmagegloves", feet: "archmageboots"}, "arcane");
  ok("  a full Archmage's set: no Magic cost, strong against magic", arch.styleAcc.magic === 0 && arch.defVs.magic > 70 && arch.fit === 6, JSON.stringify(arch.defVs));
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
