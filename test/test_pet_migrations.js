/* Numbered save migrations (2026-10-10, audit M-5 / SE-8): each one-off upgrade is a step a save takes once, tested here on
   a save from before it. Run: node test/test_pet_migrations.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 10, 9);
const N = C.normal;
/** A save as an older version wrote it: v 1, made from a fresh game with `fix` applied. */
const oldSave = (fix) => { const s = JSON.parse(JSON.stringify(C.advance(C.empty(), T0))); s.v = 1; s.player.made = true; fix(s); return s; };

ok("the steps are numbered 2 up, each saying what it does, and a save ends at the last", C.MIGRATIONS.slice(2).every((m, i) => m.v === i + 2 && m.what && typeof m.run === "function")
   && C.SAVE_V === C.MIGRATIONS.length - 1 && N(C.empty()).v === C.SAVE_V);
ok("a new game takes every step: its net and its purse of 100 coins", (() => { const s = N(C.empty()); return s.coins === 100 && s.bag.smallnet === 1 && s.gifts.join() === "smallnet,purse,crafters"; })());
ok("a save at the latest version takes none again (no second purse)", (() => { const s = N(C.empty()); s.coins = 7; s.gifts = []; return N(s).coins === 7; })());
ok("a save from a newer game isn't harmed", N(Object.assign(N(C.empty()), {v: 99})).coins === 100);

/* each step, on a save from before it */
ok("2. the steeper curve: xp scales so levels stay", (() => { const s = oldSave((x) => { x.curve = 1; x.player.skills.mining = 1000; }); const y = N(s); return C.XP_CURVE === 1.5 && y.curve === C.XP_CURVE && Math.abs(y.player.skills.mining - 1500) < 0.01; })());
ok("3. Herblore moved: Alchemy keeps up, known herbs in the Herbarium", (() => { const y = N(oldSave((x) => { delete x.herbsMoved; x.player.skills.herblore = C.XP[20]; x.player.skills.alchemy = 0; x.bag.mint = 2; })); return C.levelOf(y.player.skills.alchemy) === 20 && y.herbarium.mint === 1 && y.herbsMoved; })());
ok("4. the house: rooms good enough for what you could make", (() => { const y = N(oldSave((x) => { delete x.house; x.player.skills.smithing = C.XP[33]; })); return y.house.smithy === 3 && y.house.bedroom === 1; })());
ok("5. tiered herb stacks into the one stack", (() => { const y = N(oldSave((x) => { x.bag.unidherb2 = 3; })); return !y.bag.unidherb2 && y.bag.unidherb === 3; })());
ok("6. cleared areas from the pets' own records", (() => { const y = N(oldSave((x) => { delete x.cleared; x.den = [{id: "a", species: "cat", colour: "ginger", hatchAt: 0, at: 0, xp: 0, s: {}, areas: {farm: 4}}]; })); return y.cleared.farm === 4; })());
ok("7. an expedition from before stages runs as stages", (() => { const y = N(oldSave((x) => { x.pet = {id: "p", species: "cat", colour: "ginger", hatchAt: 0, at: T0, born: 0, xp: 0, s: {full: 90, happy: 90, energy: 90, clean: 90, health: 100}, away: {area: "farm", since: T0, until: T0 + 3600e3}}; })); return y.pet.away.stages > 0 && y.pet.away.hp > 0; })());
ok("8. a game that ended before falls were survivable carries on", (() => { const y = N(oldSave((x) => { x.player.dead = {by: "a rat"}; x.coins = 50; })); return !y.player.dead && y.coins === 0 && y.lastFall.by === "a rat"; })());
ok("   (but Hell mode stays ended)", (() => { const y = N(oldSave((x) => { x.player.dead = {by: "a rat"}; x.mode = "hell"; })); return !!y.player.dead; })());
ok("9. the gifts, once: a save that had none gets the net, the purse and the crafters' xp", (() => { const y = N(oldSave((x) => { x.gifts = []; x.coins = 5; x.village = {tailor: 40}; x.player.skills.crafting = 0; })); return y.coins === 105 && y.player.skills.crafting === 40 && y.gifts.length === 3; })());
ok("   and one that had them gets nothing twice", (() => { const y = N(oldSave((x) => { x.coins = 5; })); return y.coins === 5; })());
ok("10. the old single charm goes to its slot", (() => { const ring = Object.keys(C.ITEMS).find((k) => C.ITEMS[k].gear && C.ITEMS[k].gear.who === "player" && C.ITEMS[k].gear.slot === "ring"); const y = N(oldSave((x) => { x.player.charm = ring; })); return !y.player.charm && y.player.gear.ring === ring; })());
ok("11. the smaller bags: what doesn't fit goes to the Overflow chest, once", (() => { const y = N(oldSave((x) => { delete x.overflowed; x.bag.stone = 99999; })); return y.overflowed && y.overflow && y.overflow.stone > 0; })());
ok("12. a save from before the story keeps everything open", (() => { const y = N(oldSave((x) => { delete x.story; })); return y.story && y.story.on === false; })());
ok("19. loose arrows come off (N19: arrows only go in a quiver), and stay in the bag", (() => { const y = N(oldSave((x) => { x.player.gear.ammo = "bronzearrow"; delete x.player.gear.quiver; x.bag.bronzearrow = 30; x.bag.leatherquiver = 0; })); return !y.player.gear.ammo || y.player.gear.quiver; })()
   && (() => { const m = C.MIGRATIONS.find((z) => z && z.v === 19), s = {player: {gear: {ammo: "bronzearrow", quiver: "improvisedquiver"}}, bag: {bronzearrow: 30}}; m.run(s); return !s.player.gear.ammo && s.bag.bronzearrow === 30; })()
   && (() => { const m = C.MIGRATIONS.find((z) => z && z.v === 19), s = {player: {gear: {ammo: "bronzearrow", quiver: "leatherquiver"}}, bag: {bronzearrow: 30}}; m.run(s); return s.player.gear.ammo === "bronzearrow"; })());

/* the app's saver takes the new numbers */
ok("pet.py accepts a numbered save, and still not a NeuroFarm one", (() => { const p = fs.readFileSync(path.join(APP, "pet.py"), "utf8"); return /v < 1/.test(p) && /neurofarm/.test(p); })());

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
