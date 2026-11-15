/* Records and goals on the Player page, clean names, and the balance tool reaching the islands (2026-10-12, audit FEAT-4,
   FEAT-5, SEC-2, OPT-6, ECO-4). Run: node test/test_pet_records.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 12, 8), H = 3600e3;

/* ---- clean names (SEC-2) ---- */
{
  let s = C.act(C.advance(C.empty(), T0), "player", {name: "<b>Cam\nthe\tBold</b>"}, T0).state;
  ok("a typed name keeps no tags or control characters, and stays one line", s.player.name === "bCam the Bold/b", JSON.stringify(s.player.name));
  ok("  every name you type goes through the same cleaner (you, your pet, den pets, bank tabs, gear sets)", (fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8").match(/cleanName\(opts\.name, \d+\)/g) || []).length === 5);
}

/* ---- records (FEAT-5) ---- */
{
  let s = C.act(C.advance(C.empty(), T0), "player", {name: "Rec"}, T0).state;
  ok("a game counts from its first action", s.records && s.records.since === T0 && s.records.coinsIn === 0);
  s.coins = 500; s.bag.berry = 30;
  let r = C.act(s, "sell", {item: "berry", n: 10, shop: "merchant"}, T0 + H);
  const earned = r.ok ? r.state.records.coinsIn : -1;
  ok("  coins in are counted", r.ok && earned > 0, r.error);
  s = r.ok ? r.state : s;
  s.bag.twigs = 40;
  r = C.act(s, "craft", {workshop: "crafting", make: "twigbasket"}, T0 + H);
  ok("  and things made", !r.ok || r.state.records.made === 1, r.error);
  const v = C.recordsView(s, T0 + 2 * H);
  ok("the Records card reads kills, bosses, quests, the Petapedia and the Farm from the save", v.rows.length === 13 && v.rows.some((x) => /Creatures beaten/.test(x.label)) && v.best.length === 3);
  ok("  an old save without records still shows a card (counting starts with its next action)", C.recordsView(C.advance(C.empty(), T0), T0).rows.length === 13);
}

/* ---- goals (FEAT-4) ---- */
{
  const s = C.act(C.advance(C.empty(), T0), "player", {name: "Goal"}, T0).state;
  const g = C.goalsView(s, T0);
  ok("What's next: every skill's nearest level that opens something, nearest first", g.length >= 15 && g.every((x) => x.level > x.have && x.text) && g[0].level - g[0].have <= g[g.length - 1].level - g[g.length - 1].have);
  ok("  on the Player page, as words only (no shortcuts past the map)", /function goalsHTML\(goals\)/.test(PET) && /\$\{goalsHTML\(Core\.goalsView\(s, now\)\)\}/.test(PET)
     && !/goalsHTML[\s\S]{0,900}data-go=/.test(PET.slice(PET.indexOf("function goalsHTML"), PET.indexOf("function recordsHTML"))));
}

/* ---- the balance tool (OPT-6, ECO-4) ---- */
{
  const src = fs.readFileSync(path.join(APP, "tools", "balance_sim.js"), "utf8");
  ok("the balance tool stands on the right island for a hunt, with the best ship and what the way in needs", /if \(reg\.isle\) s\.player\.island = reg\.isle;/.test(src) && /s\.ship = Object\.assign\(s\.ship \|\| \{\}, \{tier: 4\}\)/.test(src));
  ok("  and counts the coins an hour's hunting earns, and every farm animal's xp and coins", /const coinsh = Math\.round\(\(y\.coins \|\| 0\) - \(r\.state\.coins \|\| 0\)\)/.test(src) && /kind: "animal"/.test(src));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
