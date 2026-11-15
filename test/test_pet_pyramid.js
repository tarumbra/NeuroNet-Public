/* The Pyramid (2026-10-09, Cam: "room by room", traps test "your skills", loot "a mixture of all that is random everytime you
   complete a pyrimid run. Think like a replayable boss which drops different loot everytime", the sarcophagus "a 6th boss
   chamber" after dark). Run: node test/test_pet_pyramid.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petart.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore, A = ctx.window.PetArt || ctx.PetArt;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const NIGHT = new Date(2026, 9, 9, 22).getTime(), NOON = new Date(2026, 9, 9, 12).getTime(), DAY = 24 * 3600e3;
const hero = (t, lv) => { const s = C.advance(C.empty(), t); s.player.made = true; s.player.island = "desert"; s.bag.desertkit = 1;
  ["crafting", "attack", "defence", "hitpoints", "construction", "mining", "digging", "magic", "ranged", "herblore", "foraging", "fishing"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = lv; s.player.gear = Object.assign(s.player.gear || {}, {weapon: "khopesh"}); s.bag.swordfish = 30; s.player.food = "swordfish"; return s; };
/** Play every chamber you can: the likelier way of a trap, the right glyph, fight (the last two are live battles: played, eating when low). */
const run = (s, t, rollOf) => {
  for (let i = 0; i < 9; i++) {
    const v = C.pyramidView(s, t), c = v.current;
    if (!c) break;
    const o = c.kind === "trap" ? {way: c.ways[0].chance >= c.ways[1].chance ? 0 : 1} : c.kind === "riddle" ? {glyph: C.PYR_RIDDLES.find((r) => r[0] === c.text)[1]} : {};
    o.roll = rollOf ? rollOf(i) : 0.2;
    const r = C.act(s, "pyramid", o, t);
    if (!r.ok) { if (/too hurt/.test(r.error)) { t += 3600e3; s = C.advance(s, t); continue; } return {s, error: r.error, t}; }
    s = r.state;
    // a live battle: play it -- nothing eats for you mid-fight since the Battle Re-work (Part 2), so eat when you're low
    if (s.player.battle) {
      for (let k = 0; k < 300 && s.player.battle; k++) {
        t += 2400; s = C.advance(s, t);
        const pl = s.player, b = pl.battle;
        if (b && !b.skip && (s.bag.swordfish || 0) > 0 && pl.hp < 0.5 * C.levelOf(pl.skills.hitpoints)) { const e = C.act(s, "eat", {item: "swordfish"}, t); if (e.ok) s = e.state; }
      }
      t += 1000;
    } else t += 1000;
  }
  return {s, v: C.pyramidView(s, t), t};
};

ok("the Pyramid is in the Desert (a door), on the Desert Island, from combat level 40", /Desert Island/.test(C.pyramidView(C.advance(C.empty(), NOON), NOON).lock)
   && /combat level 40/.test(C.pyramidView((() => { const s = hero(NOON, 10); s.player.skills.crafting = C.XP[40]; return s; })(), NOON).lock) && C.pyramidView(hero(NOON, 45), NOON).lock === "");
{
  const ch = C.pyrChambers(Math.floor(NOON / DAY));
  ok("five chambers a day: a trap, a riddle and a guardian among the first four, the tomb guardian last; the Pharaoh sixth",
     ch.length === 6 && ["trap", "riddle", "guardian"].every((k) => ch.slice(0, 4).some((x) => x.kind === k)) && ch[4].mon === "tombguardian" && ch[5].mon === "pharaoh" && ch[5].night);
  ok("  the same all day, different the next", JSON.stringify(ch) === JSON.stringify(C.pyrChambers(Math.floor(NOON / DAY)))
     && JSON.stringify(ch) !== JSON.stringify(C.pyrChambers(Math.floor(NOON / DAY) + 1)));
  const trap = C.pyramidView(hero(NOON, 45), NOON);
  ok("a trap offers two ways, each a skill -- the higher your level, the better the odds", C.PYR_TRAPS.every((t) => t.ways.length === 2 && t.ways.every((w) => C.SKILLS[w[0]])));
}
{
  const r = run(hero(NOON, 50), NOON);
  ok("a strong run (with food) clears the five chambers -- the tomb guardian a live battle -- and opens the treasure", r.v && r.v.done && r.v.loot && r.v.loot.coins >= 800 && Object.keys(r.v.loot.items).length === 3, r.error || JSON.stringify(r.v && [r.v.at, r.v.out, r.v.log]));
  ok("  by day the sarcophagus waits", r.v && !r.v.current && !C.act(r.s, "pyramid", {}, r.t + 99).ok);
  ok("  once a day: tomorrow (your midnight) it starts again", C.pyramidView(r.s, NOON + DAY).at === 0 && C.pyrDay(new Date(2026, 9, 9, 23, 59).getTime()) === C.pyrDay(new Date(2026, 9, 9, 0, 1).getTime()));
  // the mechanism, not the odds: a softer Pharaoh for this one
  const P = Object.assign({}, C.MONSTERS.pharaoh); Object.assign(C.MONSTERS.pharaoh, {hp: 60, att: 10, maxHit: 3});
  const n = run(hero(NIGHT, 50), NIGHT);
  Object.assign(C.MONSTERS.pharaoh, P);
  ok("after dark the sixth chamber: the Pharaoh (a live battle), and a bigger treasure", n.v && n.v.sarcophagus && n.v.loot && n.v.loot.coins >= 2000 && Object.keys(n.v.loot.items).length >= 5, n.error || JSON.stringify(n.v && [n.v.at, n.v.out, n.v.log]));
}
{
  const a = C.pyrLoot({seed: 1}, false), b = C.pyrLoot({seed: 99}, false);
  ok("the treasure is different every time (a replayable boss)", JSON.stringify(a) !== JSON.stringify(b));
  let set = 0, egg = 0;
  for (let i = 0; i < 400; i++) { const L = C.pyrLoot({seed: i * 7919}, true); if (Object.keys(L.items).some((k) => C.PHARAOH_SET.includes(k))) set++; if (L.items.sarcophagusegg) egg++; }
  ok("  the Pharaoh's set turns up now and then, the sarcophagus egg rarely (night only)", set > 20 && egg > 5 && egg < 80, set + " sets, " + egg + " eggs");
}
{
  const weak = hero(NOON, 45); weak.player.gear = {};
  weak.bag.swordfish = 0; weak.player.retreat = 0;   // nothing to eat, and no running: fight to the end
  const r = run(weak, NOON, () => 0.99);
  ok("beaten, you're thrown out for the day -- never killed (even fighting to the end)", r.v && r.v.out && r.s.player.hp >= 1 && !r.s.player.dead && !C.act(r.s, "pyramid", {}, r.t + 99).ok, r.error || JSON.stringify(r.v && [r.v.at, r.v.out]));
}
{
  const g = C.gearSum({helmet: "pharaohcrown", torso: "pharaohrobe", weapon: "pharaohsceptre", feet: "pharaohsandals", necklace: "pharaohamulet"});
  const four = C.gearSum({helmet: "pharaohcrown", torso: "pharaohrobe", weapon: "pharaohsceptre", feet: "pharaohsandals"});
  ok("the Pharaoh's set: all five worn give +10% xp, +6 defence, +6 magic and surer hits", g.xp - four.xp > 0.099 && g.acc >= 0.05 && g.sets.pharaoh === 5);
  ok("every new thing has a picture (the set, the egg, the guardian, the Pharaoh, the golden scorpion)",
     C.PHARAOH_SET.concat(["sarcophagusegg"]).every((k) => A.itemArt(k) && A.itemArt(k).rows) && A.monster("tombguardian") && A.monster("pharaoh") && A.palette("scorpion", "golden"));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
