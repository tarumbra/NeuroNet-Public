/* Cam's PT24 answers and V15 (2026-10-18): the risen for the whole hunt, improvised arrows with the page in your bag, the game's own
   text pop-up, shops A to Z, the Pen with nothing under its painting, a name and a look when the tutorial is skipped, recipe pages
   through the Unlocks pop-up everywhere, and tracking one creature (V15). Run: node test/test_pet_pt25.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
const CORE = fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8");
vm.runInContext(CORE, ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const DAY = new Date(2026, 9, 18, 12).getTime(), MIN = 60e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || DAY);
const fresh = () => { const s = A(C.advance(C.empty(), DAY), "player", {name: "T"}).state; s.story = {on: false}; s.tutorial = {step: 0, done: true}; return s; };
const fighter = (lv) => { const s = fresh(); ["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[lv]; }); s.bag.bronzesword = 1; s.player.gear.weapon = "bronzesword"; return s; };

console.log("\nThe risen, for the whole hunt (PT24 f1)\n");
{
  let s = fresh(); ["magic", "defence", "hitpoints", "attack"].forEach((k) => { s.player.skills[k] = C.XP[50]; }); s.player.hp = C.playerView(s, DAY).maxHp;
  s = A(s, "class", {cls: "arcane"}).state; s.player.classes.arcane.xp = C.XP[50]; if (s.classTut) s.classTut.on = null;
  ["air", "water", "earth", "fire", "mind", "chaos", "nature", "death", "cosmic", "astral", "law", "blood"].forEach((k) => { s.bag[k + "rune"] = 900; });
  s.bag.magicwand = 1; s.player.gear.weapon = "magicwand"; s.bagSize = "rucksack"; s.player.necro = {offered: DAY, accepted: DAY, taught: DAY};
  s.beasts = [{id: "Tom", name: "Tom", species: "cat", colour: "ginger", born: DAY - 9e8, hatchAt: DAY - 9e8, joined: DAY, xp: C.XP[30], stat: {}, train: "", trainAt: DAY, fedUntil: 0, restUntil: 0, wins: 0, faints: 0, risen: true, raised: 1}];
  s.player.loadout = ["raisefallen", "menddead", "fireblast"]; s = A(s, "hunt", {ground: "jungle", roll: 0.4}).state;
  const fights = new Map();
  for (let t = DAY; t < DAY + 12 * MIN; t += 2400) { s = C.advance(s, t); s.player.hp = Math.max(s.player.hp, 40); const b = s.player.battle;
    if (b) { const x = fights.get(b.start) || {stays: false}; if (b.rounds.some((r) => r.stays)) x.stays = true; if (b.rounds.some((r) => r.fell)) x.fell = true; fights.set(b.start, x); } }
  const later = [...fights.values()].slice(1, -1);   // (the last may not have had its first round yet)
  const firstGap = later.findIndex((x) => !x.stays);
  ok("raised once, it starts every next fight of the hunt already beside you (until it falls)", later.length > 2 && later.slice(0, firstGap < 0 ? later.length : firstGap).length >= 2 && (firstGap < 0 || [...fights.values()].some((x) => x.fell)), JSON.stringify([...fights.values()]));
  ok("  and the hunt remembers it between fights (shown beside you)", (s.player.job.risen || []).includes("Tom") && C.playerView(s, DAY + 12 * MIN).huntRisen.some((x) => x.id === "Tom") && /pv\.huntRisen/.test(PET));
}

console.log("\nImprovised arrows with the page in your bag (PT24 b4f)\n");
{
  let s = fresh(); s = A(s, "class", {cls: "arcane"}).state; if (s.classTut) s.classTut.on = null;
  s.bag.pageimprovise = 1; s.bag.arrowshaft = 4; s.bag.leaflitter = 4;
  ok("holding the page, the leaf litter lights up", C.fieldPartners(s, "arrowshaft").some((x) => x.id === "leaflitter"));
  const r = A(s, "usewith", {item: "arrowshaft", on: "leaflitter"});
  ok("  using them reads the page first, then makes the arrows -- any class", r.ok && /read Ash's notes/.test(r.msg) && r.state.bag.improvisedarrow === 4 && !r.state.bag.pageimprovise, r.error || r.msg);
}

console.log("\nPolish (PT24)\n");
ok("no browser text boxes: the game's own pop-up for names and amounts", !/window\.prompt\(/.test(PET) && /function askText\(o\)/.test(PET) && /title: "Name this tab"/.test(PET));
{ const s = fresh(); Object.assign(s.bag, {wool: 3, bones: 2, apple: 4, feather: 5}); const m = C.villageView(s, DAY).find((w) => w.trade && w.sell);
  const names = m.sell.map((x) => x.name), stock = m.stock.map((x) => x.name);
  ok("the merchant's lists are A to Z", names.join() === names.slice().sort((a, b) => a.localeCompare(b)).join() && stock.join() === stock.slice().sort((a, b) => a.localeCompare(b)).join()); }
ok("the Beast Pen: nothing written under its painting, only the places' sheets", !/pen-summary/.test(PET) && !/data-penopen/.test(PET));
{ let s = C.advance(C.empty(), DAY); s = A(s, "tutorial", {op: "start"}).state; const r = A(s, "tutorial", {op: "skip"});
  ok("skipping the tutorial before choosing: a name and a look anyway", r.ok && r.state.player.made && r.state.player.name === "Adventurer" && r.state.player.look.body === "m");
  const old = C.advance(C.empty(), DAY); old.tutorial = {skipped: true}; ok("  an old save that did: the same, when it loads", C.advance(old, DAY).player.made === true); }
{ let s = fresh(); s.dev = {on: true}; const r = A(s, "dev", {op: "give", item: "pagebandage", n: 1});
  ok("a recipe page from the sandbox or the tutorial: the Unlocks pop-up too", (r.state.unlocked || []).some((u) => /field recipe page/i.test(u.title)) && /fieldPageGot\(s, k, now\); \}\);   \/\/ \(a recipe page: the Unlocks pop-up, PT24\)/.test(CORE)); }

console.log("\nV15: tracking one creature\n");
{
  let s = fighter(20);
  ok("not before you've beaten the ground's boss 5 times", /Beat Gideon Fox 5 times first/.test(A(s, "track", {ground: "farmyard", mon: "pig"}).error || ""));
  let h = A(fighter(20), "class", {cls: "hunter"}).state;
  ok("  a Hunter can from the start", A(h, "track", {ground: "farmyard", mon: "pig"}).ok);
  s.hunt = {farmyard: {kills: 0, wins: 5, losses: 0}}; s = A(s, "track", {ground: "farmyard", mon: "pig"}).state;
  s = A(s, "hunt", {ground: "farmyard", roll: 0.3}).state; for (let t = DAY; t < DAY + 10 * MIN; t += 1200) { s = C.advance(s, t); s.player.hp = 60; }
  let u = fighter(20); u = A(u, "hunt", {ground: "farmyard", roll: 0.3}).state; for (let t = DAY; t < DAY + 10 * MIN; t += 1200) { u = C.advance(u, t); u.player.hp = 60; }
  const all = Object.values(u.quarry).reduce((a, b) => a + b, 0);
  ok("tracked: only that kind -- more of it than an ordinary hunt meets, but fewer kills in all (the search)", Object.keys(s.quarry).join() === "pig" && s.quarry.pig > 2 * u.quarry.pig && s.quarry.pig < all, JSON.stringify([s.quarry, all, u.quarry.pig]));
  ok("  Stop tracking", !A(s, "track", {ground: "farmyard", mon: ""}).state.track.farmyard);
  ok("  in the Bestiary: Track on a creature's card", /data-track="\$\{esc\(g\.ground\)\}" data-mon="\$\{esc\(c\.id\)\}"/.test(PET));
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
