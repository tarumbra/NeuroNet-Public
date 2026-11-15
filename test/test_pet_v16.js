/* V16 (carried; Cam, I3 + Q6 q7, 2026-10-19): death with a sting -- the 3 most valuable things kept (Adventure), a gravestone
   for half an hour that costs half of what's inside to open, no one eating for you (quick-use slots), idle hunts that walk
   you home, worn gear off the bag, and more xp and rare drops in the harder modes. Run: node test/test_pet_v16.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log("  ok    " + n); } else { fail++; console.log("  FAIL  " + n + (d !== undefined ? "  -- " + d : "")); } };
const T0 = 1800000000000, MIN = 60e3;
const game = (mode) => { const s = C.advance(C.newGame({mode}, T0), T0); s.player.made = true; s.player.name = "T"; return s; };
const fall = (s) => { s.player.retreat = 0; s.hunt = {farmyard: {kills: 60, wins: 0, losses: 0}};
  s.bag.copper = 5; s.bag.ironbar = 2; s.coins = 400; s.player.gear = {helmet: "bronzehelm"}; s.bag.bronzehelm = 1;
  return C.advance(C.act(s, "boss", {ground: "farmyard", roll: 0.9}, T0).state, T0 + 5 * MIN); };

console.log("\nThe fall and the gravestone\n");
{
  const a = fall(game("adventure")), kept = Object.keys(a.lastFall.kept);
  ok("Adventure: you wake holding your 3 most valuable things", kept.length && Object.values(a.lastFall.kept).reduce((x, y) => x + y, 0) === 3, JSON.stringify(a.lastFall.kept));
  const g = C.graveView(a, T0 + 5 * MIN);
  ok("  the rest is in a gravestone where you fell, for 30 minutes", g && g.where === "Farmyard" && Math.abs(g.leftMs - 25 * MIN) < MIN && g.coins === 400, JSON.stringify(g));
  ok("  opening it costs half of what's inside (coins included)", g.fee === Math.ceil(g.worth * C.DEATH.fee));
  const r = C.act(a, "grave", {op: "open"}, T0 + 6 * MIN);
  ok("  open it: your things back, the fee paid from the grave's coins first", !r.error && !r.state.grave && r.state.bag.copper >= 5 && r.state.coins === 400 - g.fee, r.error || r.state.coins);
  const late = C.advance(fall(game("adventure")), T0 + 31 * MIN);
  ok("  after half an hour it crumbles -- gone", !late.grave && late.log.some((e) => /crumbled/.test(e.text)));
  const sea = fall(game("adventure")); sea.player.island = "frostpeak";
  ok("  you have to be there (on its island)", /go there first/.test(C.act(sea, "grave", {op: "open"}, T0 + 6 * MIN).error || ""));
  const h = fall(game("hardcore"));
  ok("Hardcore: nothing kept; a quarter of an hour", !Object.keys(h.lastFall.kept).length && Math.abs(C.graveView(h, T0 + 5 * MIN).leftMs - 10 * MIN) < MIN);
  const x = fall(game("hell"));
  ok("Hell: still the end of the run", !!x.player.dead && !x.grave);
  const k = game("adventure"); k.bag.goldenfeather = 1; const kf = fall(k);
  ok("keepsakes, keys and eggs are never lost (and don't use up the 3)", kf.bag.goldenfeather === 1 && Object.values(kf.lastFall.kept).reduce((x, y) => x + y, 0) === 3);
}
console.log("\nNo one eats for you\n");
{
  const s = game("adventure"); ["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[20]; });
  s.player.food = "shrimps"; s.bag.shrimps = 50; s.player.hp = 5;
  const r = C.act(s, "hunt", {ground: "farmyard", roll: 0.3}, T0);
  ok("you may set out hurt (your choice, PT30), and nothing eats for you", r.ok && r.state.bag.shrimps === 50, r.error);
  s.player.quick = ["shrimps"];
  const q = C.act(s, "quick", {op: "use", i: 0}, T0);
  ok("quick slot 1: you eat a shrimp by your own hand", !q.error && q.state.bag.shrimps === 49 && q.state.player.hp > 5, q.error);
  ok("  only food, draughts and traps go on a slot (N22) -- not copper", /Food, draughts, traps/.test(C.act(s, "quick", {op: "set", i: 1, item: "copper"}, T0).error || ""));
  const w = game("adventure"); ["attack", "defence", "hitpoints"].forEach((k) => { w.player.skills[k] = C.XP[5]; }); w.player.retreat = 0; w.player.hp = C.playerView(w, T0).maxHp;
  let st = C.act(w, "hunt", {ground: "jungle", roll: 0.3}, T0); st = st.error ? null : C.advance(st.state, T0 + 3 * 3600e3);
  ok("PT30: no auto running, idle or not -- a weak hunter left alone in the Jungle falls (a gravestone, not a walk home)", !st || (!!st.lastFall && st.player.lastTrip && st.player.lastTrip.why === "fell"), st && JSON.stringify(st.player.lastTrip && st.player.lastTrip.why));
}
console.log("\nWorn gear is on you, not in the bag\n");
{
  const s = game("adventure"); s.bag.bronzehelm = 2; s.player.gear = {helmet: "bronzehelm"}; s.bag.bronzepick = 1; s.player.tools = {mining: "bronzepick"};
  const list = C.bagList(s);
  ok("the bag shows the spare helmet only, and not the pick you carry", list.find((x) => x.id === "bronzehelm").count === 1 && !list.some((x) => x.id === "bronzepick"));
}
console.log("\nReasons to play harder\n");
{
  ok("Hardcore and Hell: more xp and more rare drops", C.modeBonus(game("hardcore"), "xp") === 1.25 && C.modeBonus(game("hell"), "drop") === 2 && C.modeBonus(game("adventure"), "xp") === 1);
  ok("  an old save without a chosen mode plays as before", C.modeBonus(C.empty(), "xp") === 1);
}
console.log("\nPT30: no auto running, and the sandbox\n");
{
  const s = game("adventure"); s.player.retreat = 0.5;
  ok("nothing runs for you on any ground, however low (your old retreat line is ignored)", !C.mustFlee(Object.assign({}, s.player, {hp: 1}), 99));
  const d = game("adventure"); d.dev = {on: true}; d.bag.ironbar = 5; d.player.gear = {helmet: "bronzehelm"}; d.bag.bronzehelm = 1;
  const r = C.act(d, "dev", {op: "clearbag"}, T0);
  ok("the sandbox can remove every item from your character (bag, worn, carried)", !r.error && !Object.keys(r.state.bag).length && !Object.keys(r.state.player.gear).length, r.error);
}
console.log("\nAfter a fall (PT32)\n");
{
  const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  ok("a fall you watch takes you to the Estate; in Hell, Game over", /everySecond\("fallwatch"/.test(PET) && /if \(pv\.dead\) return render\(\);/.test(PET) && /goTo\("pet:estate"\); \}\n  \}\);/.test(PET));
  ok("  Start again and a fresh sandbox start Amunet's tutorial again", /tutorStarted\.delete\(slot\); const r = await act\("restart"\)/.test(PET) && /states\.dev = fresh; tutorStarted\.delete\("dev"\)/.test(PET));
}
{
  const d = game("adventure"); d.dev = {on: true};
  const h = C.act(d, "dev", {op: "mode", mode: "hell"}, T0);
  ok("the sandbox switches difficulty any time (PT33)", !h.error && h.state.mode === "hell" && C.modeBonus(h.state, "xp") > 1, h.error);
  const x = fall(h.state), back = C.act(x, "dev", {op: "mode", mode: "adventure"}, T0 + 6 * MIN);
  ok("  Hell's fall is the end; switching out of Hell brings you back", !!x.player.dead && !back.error && !back.state.player.dead && back.state.player.hp > 0);
  const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  ok("  Dev tools → You → Difficulty", /id="dv-mode"/.test(PET) && /dev\(\{op: "mode", mode: b\.dataset\.mode\}\)/.test(PET));
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
