/* Hunting fixes (2026-10-11, Cam's note "NeuroPets - Hunting Bugs Found"):
   1. "Farmyard navigation button doesnt work when in hunting ground ... it takes me back to the main island map"
   2. "when beating the boss i cannot just roll back into hunting ... i want it to roll straight back into hunting"
   3. "Make beating the boss necessary to unlock the bosses armour set. Maybe 5 defeats to unlock its armour"
   4. "remove the warning note which comes up when challenging the boss, that way it is a single click"
   5. "The special bar never actually fills and i cannot use the cleave attack."
   Run: node test/test_pet_hunting_fixes.js [app dir] -- made-up players only, never the real save. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = 1800000000000, MIN = 60000;

/** A strong made-up player at the farmyard, ready for Gideon. */
function strong() {
  const s = C.advance(C.empty(), T0); s.player.made = true;
  const p = s.player;
  ["attack", "defence", "hitpoints", "strength"].forEach((k) => { if (k in p.skills) p.skills[k] = C.XP[40]; });
  p.hp = 40; p.gear = {helmet: "ironhelm", torso: "ironplate", arms: "irongloves", legs: "ironlegs", feet: "ironboots", weapon: "ironsword"};
  s.bag.ironsword = 1; s.bag.shrimps = 20;
  s.hunt = {farmyard: {kills: 999, wins: 0, losses: 0}};
  return s;
}

/* ---- 1: "‹ Farmyard" goes back to the Farmyard ---- */
ok("1. the back button to a region keeps that region open (the Map button still shows the whole map)",
   GAME.includes('data-go="${P.parent}" data-back-region="1"') && GAME.includes("!el.dataset.backRegion && SS.Pet.mapHome"));

/* ---- 2: after beating a boss, straight back to hunting ---- */
{
  let won = null;
  for (let i = 0; i < 20 && !won; i++) {
    let s = strong(), t = T0 + i * 1000;
    s = C.act(s, "hunt", {ground: "farmyard", roll: 0.3}, t).state;
    const r = C.act(s, "boss", {ground: "farmyard", roll: (i * 0.618) % 1}, t);
    if (!r.ok) { ok("2. a strong player can challenge Gideon", false, r.error); break; }
    const after = C.advance(r.state, t + 20 * MIN);
    if (after.lastBoss && after.lastBoss.won) won = {before: r.state, after};
  }
  ok("2. a won boss fight (the test player wins one)", !!won);
  if (won) {
    ok("   ...and you're hunting in the Farmyard again, not stuck on the end screen", won.after.player.job && won.after.player.job.hunt === "farmyard",
       JSON.stringify(won.after.player.job && won.after.player.job.hunt));
    ok("   ...the diary says so", won.after.log.some((e) => /Back to hunting in the Farmyard/.test(e.text)));
    ok("   ...and the hunt goes on: wins on this hunt after the boss", (won.after.player.job || {}).count > 0, JSON.stringify(won.after.player.job && won.after.player.job.count));
    // the screen works forward from the save in one go: the hunt must carry on in a single long catch-up too (2026-10-11,
    // Cam: "the battles continue but the battle screen doesnt get refreshed")
    const one = C.advance(won.before, T0 + 25 * MIN);
    ok("   ...in one long catch-up from the boss's start too (as the battle screen does)", one.player.job && one.player.job.count > 0 && (one.player.job.next > T0 + 24 * MIN || one.player.battle),
       JSON.stringify(one.player.job && {count: one.player.job.count, nextIn: Math.round((one.player.job.next - T0 - 25 * MIN) / 1000)}));
  }
}

/* ---- 3: a boss's set needs 5 wins over it ---- */
{
  ok("3. 5 wins", C.BOSS_GEAR_WINS === 5);
  const sets = {farmyard: "nimblejerkin", pasture: "brawlerplate", meadow: "fleettunic", forest: "sylvanmail", coast: "snapshellplate", deepforest: "grizzlyplate", jungle: "gorgonplate"};
  ok("   every boss set (and its weapons) is covered", Object.keys(sets).every((g) => C.bossGearSet(g).includes(sets[g])) && C.bossGearSet("deepforest").includes("grizzclaws"));
  ok("   jewellery, bars and island gear are not", !["farmyard", "pasture", "meadow", "forest", "coast", "deepforest", "jungle", "desert", "nile"].some((g) => C.bossGearSet(g).some((k) => /ring|necklace|amulet|bar$|nemes|linenrobe/.test(k))));
  const s = strong(); s.player.skills.crafting = C.XP[30]; s.bag.slyfur = 50; s.bag.leather = 10; s.bag.needle = 3;
  s.hunt.farmyard.wins = 4;
  const i = C.WORKSHOPS.crafting.recipes.findIndex((r) => r.make === "nimblejerkin");
  const v = C.villageView(s, T0).find((w) => w.id === "crafting").recipes[i];
  ok("   at 4 wins the bench says why and won't make it", !v.open && /Beat Gideon Fox 5 times first \(4\/5\)/.test(v.roomLock) && !C.act(s, "craft", {workshop: "crafting", make: "nimblejerkin", i}, T0).ok, v.roomLock);
  s.hunt.farmyard.wins = 5;
  const r = C.act(s, "craft", {workshop: "crafting", make: "nimblejerkin", i}, T0);
  ok("   at 5 wins it's made", r.ok && r.state.bag.nimblejerkin === 1, r.error);
  ok("   the 5th win says the set is open", (() => { const t = fs.readFileSync(path.join(APP, "ui", "pet", "core", "13-live-battles.js"), "utf8");
    return /hl\.wins === BOSS_GEAR_WINS && bossGearSet\(b\.ground\)\.length/.test(t); })());
}

/* ---- 4: one click to challenge a boss ---- */
ok("4. no warning before a boss fight: one click", !/window\.confirm\(`Challenge \$\{g\.boss\.name\}/.test(PET) && PET.includes('act("boss", {ground: b.dataset.ground, roll: Math.random()'));

/* ---- 5: the special bar fills, and Special works ---- */
{
  let s = strong(); s.player.cls = "berserker"; s.player.combat = {style: "accurate", special: "cleave"}; s.player.spec = 0;
  s = C.act(s, "hunt", {ground: "farmyard", roll: 0.4}, T0).state;
  const later = C.advance(s, T0 + 30 * MIN);
  ok("5. with a special chosen, the bar fills up (it isn't spent on its own any more)", later.player.spec >= 60, later.player.spec);
  ok("   ...to 100 and stays there", C.advance(s, T0 + 120 * MIN).player.spec === 100);
  // Battle Re-work Part 2 (2026-10-15): specials are yours to fire -- "use it on its own" is gone (idle fights use only
  // basic attacks, so playing a fight is always better)
  let a = strong(); a.player.cls = "berserker"; a.player.combat = {style: "accurate", special: "cleave", autoSpec: true}; a.player.spec = 0;
  a = C.act(a, "hunt", {ground: "farmyard", roll: 0.4}, T0).state;
  ok("   an old 'use it on its own' setting no longer fires it: the bar fills and waits for you", C.advance(a, T0 + 120 * MIN).player.spec === 100);
  const t = C.act(strong(), "combat", {autoSpec: true}, T0);
  ok("   and the setting can't be switched back on", !t.ok && /press Special/.test(t.error));
  ok("   the Hunting page says to press Special (no tick box)", !PET.includes("pp-autospec-box") && !PET.includes("it never goes off on its own"));   // (no tick box -- and no explaining paragraph, 2026-10-20)
}

/* ---- the special button: a yellow flash when ready, and usable between fights (2026-10-11, Cam: "when battleing the cleave
        flashes but it is greyed out i want it to flash yellow when ready") ---- */
{
  const CSS = fs.readFileSync(path.join(APP, "ui", "pet", "pet.css"), "utf8");
  ok("6. a ready special flashes yellow with its own animation (three rules were all 'pp-glow'; the map's faint pulse won)",
     /\.pp-cmd\.special\.ready \{ animation: pp-spec-ready /.test(CSS) && (CSS.match(/@keyframes pp-spec-ready/g) || []).length === 1 && /#ffe066/.test(CSS.slice(CSS.indexOf("@keyframes pp-spec-ready"))));
  // (a Hunter since Battle Re-work Part 5: a Berserker's specials run on fury, built in the fight -- test_pet_berserker.js)
  let s = strong(); s.player.cls = "hunter"; s.player.skills.ranged = C.XP[40]; Object.assign(s.bag, {shortbow: 1, bronzearrow: 200, leatherquiver: 1});
  s.player.gear.weapon = "shortbow"; s.player.gear.quiver = "leatherquiver"; s.player.gear.ammo = "bronzearrow"; s.player.quiverN = 200; s.player.combat = {style: "accurate", special: "aimed"}; s.player.spec = 100;   // (N24: loaded)
  s = C.act(s, "hunt", {ground: "farmyard", roll: 0.4}, T0).state;
  const q = C.act(s, "battle", {cmd: "special"}, T0 + 500);
  ok("   pressed between fights: it goes off on the next fight's first blow", q.ok && q.state.player.combat.queued === true && /next fight/.test(q.msg), q.error || q.msg);
  let used = q.state;
  for (let t = T0 + 1000; !used.player.battle && t < T0 + 3 * MIN; t += 500) used = C.advance(used, t);   // to the next fight
  const me = used.player.battle && used.player.battle.me;
  ok("   ...and is spent there: the next fight opens with Aimed shot", me && me.spec && me.spec.name === "Aimed shot" && used.player.spec === 50 && !used.player.combat.queued,
     JSON.stringify([me && me.spec && me.spec.name, used.player.spec, used.player.combat.queued]));
  ok("   the button lights up between fights too, and says Ready!", PET.includes('!!(pv.job && pv.job.hunt && sp && (pv.fury ? pv.furyNow : pv.spec) >= spCost && !nextFight') && PET.includes('ready ? "Ready!"'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
