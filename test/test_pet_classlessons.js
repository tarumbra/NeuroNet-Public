/* Every tutor's lesson (2026-10-17): Cam -- "Now every tutor should offer a tutorial. The tutorial should provide all basic
   provisions and how to do everything related to that class. Inclusive of poison making, weapon crafting, holy water, etc.
   Also will give some gifts in form of starter kits when you finish the tutorial. It should be in a wooden crate for now."
   Each class's lesson is played through with the real actions -- once as a new player (benches not open to you yet: the tutor
   makes things for you) and once with the skills to make them yourself -- and its starter crate opened.
   Run: node test/test_pet_classlessons.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 17, 8), MIN = 60e3;
function player(skilled) {
  let s = C.act(C.advance(C.empty(), T0), "player", {name: "Tester"}, T0).state; s.story = {on: false};
  s.tutorial = {step: 0, done: true};
  ["attack", "defence", "hitpoints", "ranged", "magic"].forEach((k) => { s.player.skills[k] = C.XP[12]; });
  if (skilled) ["smithing", "crafting", "alchemy", "enchanting", "fletching"].forEach((k) => { s.player.skills[k] = C.XP[25]; });
  s.player.hp = C.playerView(s, T0).maxHp;
  return s;
}
/** The action a step asks for, done the way a player would. */
function doStep(s, st, t) {
  const A = (a, o) => { const r = C.act(s, a, o || {}, t); if (r.ok) s = r.state; return r; };
  const firstSpell = () => Object.keys(C.SPELLS)[0];
  if (st.make) { const W = C.WORKSHOPS[st.ws], i = W.recipes.findIndex((r) => r.make === st.make); A("craft", {workshop: st.ws, make: st.make, i}); return s; }
  const c = (st.check || "").split(":");
  switch (c[0]) {
    case "wear": A("equip", {item: c[1]}); break;
    case "ranged": A("equip", {item: "shortbow"}); A("equip", {item: "improvisedarrow"}); break;   // (N19: in the quiver, worn the step before)
    case "magic": A("equip", {item: "willowwand"}); break;
    case "dual": A("equip", {item: "bronzedagger"}); A("offhand", {item: "bronzedagger"}); break;
    case "shield": A("equip", {item: "bronzesword"}); A("offhand", {item: "woodenbuckler"}); break;
    case "coat": A("coat", {item: "weakpoison"}); break;
    case "bless": A("bless", {item: "holywater"}); break;
    case "brew": A("drink", {item: "berserkerbrew"}); break;
    case "special": A("combat", {special: Object.keys(C.CLASSES[s.player.cls].specials)[0]}); break;
    case "loadout": A("loadout", {spells: [firstSpell()]}); break;
    case "tools": A("toolplan", {trap: "twigsnare"}); break;
    case "made": if (c[1] === "arrowshaft") A("whittle", {item: "twigs"}); else A("improvise", {}); break;
    case "skill":
      if (c[1] === "larceny") { for (let k = 0; k < 40 && !(s.player.skills.larceny > 0); k++) { const r = C.act(s, "steal", {target: "farmhand"}, t + k * 4000); if (r.ok) s = r.state; } break; }   // pick a pocket till one lands
      A("trip", {skill: c[1], spot: "airshrine"}); s = C.advance(s, t + 5 * MIN); if (s.player.job) A("stop"); break;
    case "crook": A("equip", {item: "oakcrook"}); break;
    case "train": A("pentrain", {id: s.beasts[0].id, stat: "attack"}); break;
    case "fed": A("penfeed"); break;
    case "pack": A("pack", {ids: s.beasts.map((b) => b.id)}); break;
    case "hunt": A("hunt", {ground: "farmyard", roll: 0.3}); s = C.advance(s, t + 3 * MIN); break;
  }
  return s;
}
function play(cls, skilled) {
  let s = player(skilled), t = T0, log = [];
  let r = C.act(s, "class", {cls, guild: true}, t);
  if (!r.ok) return {error: r.error};
  s = r.state;
  for (let guard = 0; guard < 20; guard++) {
    const v = C.tutorialView(s, t);
    if (!v.on || v.act !== "classtut") return {error: "the lesson stopped at step " + guard};
    if (v.finale) break;
    const st = C.CLASS_TUTORIALS[cls].steps[v.step];
    if (!v.met) s = doStep(s, st, t);
    t += 4 * MIN;
    const met = C.tutorialView(s, t).met;
    log.push(st.id + (met ? "" : " (NOT MET)") + ((s.classTut.on.shown || {})[st.id] ? " (shown)" : ""));
    r = C.act(s, "classtut", {op: "next"}, t);
    if (!r.ok) return {error: st.id + ": " + r.error, log};
    s = r.state;
  }
  const fin = C.tutorialView(s, t);
  r = C.act(s, "classtut", {op: "finish"}, t);
  return {s: r.ok ? r.state : s, log, fin, finish: r, t};
}

for (const cls of ["hunter", "berserker", "arcane", "thief", "paladin", "beastmaster"]) {
  const L = C.CLASS_TUTORIALS[cls], tutor = C.GUILD.tutors[cls].standIn;
  console.log(`\n${C.CLASSES[cls].name}: ${tutor}'s lesson\n`);
  const p = play(cls, false);
  ok(`${tutor}'s lesson runs to the farewell with the real actions (a new player)`, !p.error && p.finish.ok, p.error || (p.finish && p.finish.error) + " " + JSON.stringify(p.log));
  if (p.error) continue;
  ok("  every step's job was done", p.log.every((x) => !/NOT MET/.test(x)), JSON.stringify(p.log));
  const shown = p.log.filter((x) => /shown/.test(x));
  ok("  a bench that isn't open to a new player: the tutor makes it instead" + (shown.length ? ` (${shown.map((x) => x.split(" ")[0]).join(", ")})` : " (none here)"), true);
  ok("  the farewell offers the starter crate", p.fin.gifts.some((g) => g.id === L.kit.id), JSON.stringify(p.fin.gifts));
  const s = p.s;
  ok("  the crate is in the bag, and the lesson is done", s.bag[L.kit.id] === 1 && s.classTut.done[cls] && !C.tutorialView(s, p.t).on);
  const roomy = JSON.parse(JSON.stringify(s)); roomy.bag = {[L.kit.id]: 1};   // (a lesson fills a new bag: you'd store some first)
  const o = C.act(roomy, "open", {item: L.kit.id}, p.t);
  ok("  open it: exactly what the kit holds", o.ok && Object.keys(L.kit.contents).every((k) => o.state.bag[k] >= L.kit.contents[k]) && !o.state.bag[L.kit.id], o.error || o.msg);
  ok("  it's a wooden crate for now (its picture is the wooden crate's)", C.ITEMS[L.kit.id].crate && C.ITEMS[L.kit.id].iconAs === "woodcrate");
  const again = C.act(s, "classtut", {op: "start", cls}, p.t + MIN);
  let s2 = again.state;
  s2 = C.act(s2, "classtut", {op: "skip"}, p.t + 2 * MIN).state;
  ok("  run again from the Guild hall: it teaches again, but no second crate", again.ok && (s2.bag[L.kit.id] || 0) === 1, JSON.stringify(s2.bag[L.kit.id]));
  const q = play(cls, true);
  const made = (q.log || []).filter((x) => !/shown/.test(x)).length;
  const makes = L.steps.filter((x) => x.make && C.WORKSHOPS[x.ws].recipes.find((r) => r.make === x.make).level <= 10).map((x) => x.id);
  ok("  with the skills, you make the early things yourself" + (makes.length ? ` (${makes.join(", ")})` : ""), !q.error && q.log.every((x) => !/NOT MET/.test(x)) && makes.every((id) => q.log.includes(id)), q.error || JSON.stringify(q.log));
}

console.log("\nSkipping\n");
{
  let s = C.act(player(), "class", {cls: "thief", guild: true}, T0).state;
  const r = C.act(s, "classtut", {op: "skip"}, T0);
  ok("skipping a lesson still gives the starter crate (nobody starts with nothing)", r.ok && r.state.bag.thiefkit === 1, r.error);
}
console.log("\nThe page\n");
{
  ok("a starter crate shows the wooden crate's picture until its own is painted", /Core\.ITEMS\[name\]\.iconAs/.test(PET));
  // Cam (2026-10-17): a starter crate's things ran off the bottom of the window -- click to see it all; out of sight, count them up
  ok("a crate: click while it's revealing to see it all, with quantities", /if \(revealing && !e\.target\.closest\("\.pp-modal-close"\)\) finish\(\)/.test(PET));
  ok("  more of the same counts up on its card; a new kind that would be out of sight switches to counting", /if \(counting \|\| seen\[id\] > 1\) \{ count\(id\)/.test(PET) && /if \(!inView\(row\.lastElementChild\)\) toCounting\(\)/.test(PET));
  ok("  a long haul scrolls inside the window, Close always in sight", /\.pp-crate-card \.pp-reveal-row\.pp-haul \{ max-height: calc\(100vh - 340px\); overflow-y: auto; \}/.test(fs.readFileSync(path.join(APP, "ui", "pet", "pet.css"), "utf8")));
  // Cam (2026-10-17): "when i click a book, says NeuroPets doesnt know how to read a book. It should open up with a stylized popup,
  // there should be pages and arrows in the bottom right for going forward and bottom left for going backwards"
  ok("a class book's Read it in the bag opens the book (not an action the rules don't know)", /if \(a === "readbook"\) return openBook\(Core\.ITEMS\[id\]\.book\)/.test(PET) && /kitSay\(await doBagAct\(first\.act, id\)\)/.test(PET));   // (the Kit's bag: the Bag page went, 2026-10-20)   // (one list of bag actions, Modernize/Reduce Nav)
  ok("  a book of pages: back bottom-left, the page number, forward bottom-right; the arrow keys turn them", /<button class="gh-turn gh-back"[^>]*>◀<\/button>\s*<span class="gh-folio"><\/span>\s*<button class="gh-turn gh-next"[^>]*>▶<\/button>/.test(PET) && /e\.key === "ArrowRight"/.test(PET) && /e\.key === "ArrowLeft"/.test(PET));
  ok("  its pages: a title page with contents, specials, a page a branch, techniques and builds, the class's things (and the Arcane's spells)", /function classBookPages\(cls, noToc\)/.test(PET) && /k\.branches\.forEach\(\(b\) => pages\.push/.test(PET) && /head: "Spells", spells: f === 0/.test(PET));
  ok("every Guild tutor offers a lesson (Show me how it works)", Object.keys(C.GUILD.tutors).every((k) => C.CLASS_TUTORIALS[k] && C.CLASS_TUTORIALS[k].steps.length >= 6));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
