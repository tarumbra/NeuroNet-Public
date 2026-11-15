/* ==========================================================================
   NeuroPets: mod packs -- rates and pets (2026-10-07).
   ==========================================================================
   Cam: "an inbuilt modders tool where assets can be changed, custom
   backgrounds for maps and custom icons can be placed into the game, rates can
   be changed. These can then be saved and when starting a new game you should
   be able to select a mod pack ... A pet modder as well where you can change
   the color of pets, their bonus and add or remove buffs."

   Runs the game's own rules (ui/pet/petcore.js) on made-up players -- never
   the real save.
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
const T0 = 1800000000000, MIN = 60000;
function game(mod) { const s = C.advance(C.newGame({mode: "hardcore", mod}, T0), T0); s.player.made = true; s.player.name = "Tester"; return s; }

console.log("\nNeuroPets: mod packs\n");

ok("the rates a pack can change: xp, coins, drops, gathering speed, hatching, monsters", Object.keys(C.MOD_RATES).join() === "xp,coins,drops,speed,hatch,monsters");
const clean = C.cleanMod({id: "x", name: "Test", rates: {xp: 2, coins: 99, drops: 0, speed: 1, junk: 3}, pets: {cat: {buffs: [{skill: "mining", amount: 5}, {skill: "nope", amount: 0.1}]}, dragon: {}}});
ok("a pack is checked: rates in range, real skills, real pets", JSON.stringify(clean.rates) === '{"xp":2}' && clean.pets.cat.buffs.length === 1
  && clean.pets.cat.buffs[0].amount === 1 && !clean.pets.dragon, JSON.stringify(clean));
const g = game({id: "easy", name: "Easy", rates: {xp: 2}});
ok("a new game keeps its pack (the rules part)", g.mod && g.mod.name === "Easy" && g.mod.rates.xp === 2);
ok("  a game without one plays as it always has", !game(null).mod);

/* ---- rates ---- */
{
  const run = (mod, skill, spot, mins) => { const s = game(mod); const r = C.act(s, "trip", {skill, spot, roll: 0.3}, T0); return C.advance(r.state, T0 + mins * MIN); };
  const a = run(null, "foraging", "hedgerow", 30), b = run({rates: {xp: 2}}, "foraging", "hedgerow", 30);
  ok("xp ×2: twice the xp for the same work", Math.abs(b.player.skills.foraging / (2 * a.player.skills.foraging) - 1) < 0.02, `${a.player.skills.foraging} / ${b.player.skills.foraging}`);
  const c = run({rates: {speed: 2}}, "foraging", "hedgerow", 30);
  ok("gathering speed ×2: twice the finds", c.player.job.count >= 2 * a.player.job.count - 1, `${a.player.job.count} / ${c.player.job.count}`);
  const hunt = (mod) => { const s = game(mod); s.player.skills.attack = C.XP[20]; s.player.skills.defence = C.XP[20]; s.player.skills.hitpoints = C.XP[20]; s.player.hp = 20;
    const r = C.act(s, "hunt", {ground: "farmyard", roll: 0.4}, T0); return C.advance(r.state, T0 + 20 * MIN); };
  const h1 = hunt(null), h2 = hunt({rates: {coins: 3}});
  ok("coins ×3: creatures drop three times the coins", h2.coins - 100 >= 2.5 * (h1.coins - 100), `${h1.coins} / ${h2.coins}`);
  const s = game({rates: {monsters: 2}});
  const r = C.act(s, "hunt", {ground: "farmyard", roll: 0.3}, T0), st = C.advance(r.state, T0 + 1500);
  ok("monsters ×2: twice the health", st.player.battle && st.player.battle.mhp === Math.round(C.MONSTERS[st.player.battle.mon].hp * 2));
  const e = game({rates: {hatch: 2}}), eh = C.act(e, "hatch", {egg: "starter", roll: 0.3}, T0);
  ok("hatching ×2: eggs hatch in half the time", eh.state.pet.hatchAt - T0 === C.EGGS.starter.hatch / 2);
}

/* ---- pets ---- */
{
  const s = game({pets: {cat: {buffs: [{skill: "mining", amount: 0.25}, {skill: "fishing", amount: 0.1}]}}});
  const buffs = C.petBuffs(s, "cat");
  ok("a pet's buffs can be changed: a cat helps mining and fishing instead", buffs.length === 2 && buffs[0].skill === "mining" && buffs[0].amount === 0.25);
  ok("  and its companion line says so", (() => { const h = C.act(s, "hatch", {egg: "starter", roll: 0.05}, T0).state; const v = C.advance(h, T0 + 10 * MIN);
    return v.pet.species !== "cat" || /Mining/.test(C.playerView(v, T0 + 10 * MIN).companionDoes); })());
  const none = game({pets: {cat: {buffs: []}}});
  ok("  or taken away altogether", C.petBuffs(none, "cat").length === 0);
  ok("  a pet without a change keeps its own knack", C.petBuffs(game(null), "cat")[0].skill === C.BOOSTS.cat);
  const col = C.cleanMod({pets: {cat: {colours: {ginger: {b: "#3a7ad8"}}}}});
  ok("  its colours are kept with the game (the page paints them)", col.pets.cat.colours.ginger.b === "#3a7ad8");
}

/* ---- pictures: the page's ---- */
{
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  ok("a pack's pictures replace items', creatures', the regions' and the map's", /if \(modPics\.items\[name\]\) return modPics\.items\[name\]/.test(pj)
    && /if \(modPics\.monsters\[id\]\) return modPics\.monsters\[id\]/.test(pj) && /modPics\.regions\[id\]/.test(pj) && /modPics\.regions\.worldmap/.test(pj));
  ok("  and the pets' colours", /modSkin\(species, colour, skin\)/.test(pj));
  ok("  pictures can come from NeuroNet's Assets (Pixel art's Game assets)", /pet_game_assets/.test(pj) && /pet_game_asset/.test(pj));
  ok("the new-game panel offers the packs", /pp-ng-mod/.test(pj) && /Core\.cleanMod\(m\)/.test(pj));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
