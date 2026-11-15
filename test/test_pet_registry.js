/* The skill registry (2026-10-11, audit FUT-1) and checkpoint saves (audit OPT-1). Every skill declares itself once in
   ui/pet/core/01-a-the-skill-registry.js; the rules' lists, the skills table, the economy and the screens read it.
   Run: node test/test_pet_registry.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const load = (src) => { const ctx = {window: {}, console}; vm.createContext(ctx); vm.runInContext(src, ctx); return ctx.window.PetCore || ctx.PetCore; };
const SRC = fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), C = load(SRC);
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };

/* ---- one source ---- */
ok("24 skills, in the Player page's order (+ Larceny, 2026-10-17)", C.SKILL_REG.length === 24 && C.SKILL_ORDER.join() === C.SKILL_REG.map((k) => k.id).join());
ok("GATHERING is the registry's trip skills", C.GATHERING.join() === C.SKILL_REG.filter((k) => k.trips).map((k) => k.id).join() && C.GATHERING.length === 6);
ok("the skills table's names and verbs come from it", C.SKILL_REG.every((k) => C.SKILLS[k.id] && C.SKILLS[k.id].name === k.name && C.SKILLS[k.id].verb === k.verb));
ok("  and every skill in the table is in the registry", Object.keys(C.SKILLS).every((k) => C.SKILL_BY[k]));
ok("every making skill names a real bench that trains it", C.SKILL_REG.filter((k) => k.group === "making").every((k) => C.WORKSHOPS[k.bench] && C.WORKSHOPS[k.bench].skill === k.id),
   C.SKILL_REG.filter((k) => k.group === "making" && !(C.WORKSHOPS[k.bench] && C.WORKSHOPS[k.bench].skill === k.id)).map((k) => k.id).join());
ok("every skill's icon is a painted picture", (() => { const I = JSON.parse(fs.readFileSync(path.join(APP, "ui", "pet", "art", "icons", "manifest.js"), "utf8").match(/PET_ICONS = (\{.*\});/)[1]);
   return C.SKILL_REG.every((k) => I[k.icon] && (!k.pageIcon || I[k.pageIcon])); })());
ok("the shell's skill pages are made from it (19 pages: + the Marketplace)", Object.keys(C.skillPages()).length === 19 && GAME.includes("Object.assign(PAGES, Core.skillPages());") && !/"pet:foraging": \{name:/.test(GAME));
ok("the Player page's columns, icons and benches are made from it", PET.includes("const SKILL_ICON = Object.fromEntries(Core.SKILL_REG") && PET.includes("Core.SKILL_REG.filter((k) => k.group === g)")
   && PET.includes("const SKILL_SHOP = Object.fromEntries(Core.SKILL_REG.filter((k) => k.bench)") && !/foraging: "berry", fishing: "trout"/.test(PET));
ok("no other hand-written list of skills is left in the rules", !/var (SKILL_ORDER|GATHERING) = \[/.test(SRC) && !/SKILLS\.(cooking|attack|farming) = \{/.test(SRC));

/* ---- adding a skill: one registry entry (2026-10-15: one entry in ui/pet/content/01-a-the-skill-registry.json; a made-up
   Beekeeping -- Husbandry, the first example, is a real skill now) ---- */
{
  const entry = `{"id": "beekeeping", "name": "Beekeeping", "verb": "keeping bees", "group": "gathering", "icon": "honey", "accent": "#c9a46a", "hint": "Hives"}, `;
  const at = SRC.indexOf('{"id": "farming"');
  const H = load(SRC.slice(0, at) + entry + SRC.slice(at));
  ok("a new skill: one entry, and it's in the skill order, the skills table and the Player page's Gathering column",
     at > 0 && H.SKILL_ORDER.includes("beekeeping") && H.SKILLS.beekeeping && H.SKILLS.beekeeping.name === "Beekeeping" && H.SKILL_REG.filter((k) => k.group === "gathering").some((k) => k.id === "beekeeping"));
  const s = H.advance(H.empty(), Date.UTC(2026, 9, 12));
  ok("  an old save gets it at level 1, with nothing else to do", s.player.skills.beekeeping === 0 && H.playerView(s, Date.UTC(2026, 9, 12)).skills.beekeeping.level === 1);
  ok("  and the shell gets its page", H.skillPages()["pet:beekeeping"] && H.skillPages()["pet:beekeeping"].name === "Beekeeping");
  ok("  nothing else changed: every price and every spot the same", Object.keys(C.ITEMS).every((k) => C.priceOf(k) === H.priceOf(k)));
}

/* ---- checkpoints (OPT-1) ---- */
{
  let s = C.advance(C.empty(), 1.8e12); s.player.made = true;
  ["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[30]; }); s.player.hp = 30;
  s = C.act(s, "hunt", {ground: "farmyard", roll: 0.3}, 1.8e12).state;
  const later = 1.8e12 + 8 * 3600e3;
  let t = process.hrtime.bigint(); C.advance(s, later); const fromSave = Number(process.hrtime.bigint() - t) / 1e6;
  const cp = C.advance(s, later);
  t = process.hrtime.bigint(); C.advance(cp, later + 1000); const fromCheckpoint = Number(process.hrtime.bigint() - t) / 1e6;
  ok("a checkpointed save is cheap to redraw (8 hours AFK: " + fromSave.toFixed(1) + " ms from the save, " + fromCheckpoint.toFixed(2) + " ms from a checkpoint)", fromCheckpoint * 10 < fromSave);
  ok("checkpoints: on opening, every 3 minutes, back in view, and on switching slots -- through the action queue",
     PET.includes("const CHECKPOINT_MS = 3 * 60 * 1000;") && PET.includes('document.addEventListener("visibilitychange"') && PET.includes("checkpoint().then(() => render());               // opened")
     && PET.includes('checkpoint("main").then(() => render());') && /const p = queue\.then\(run, run\);\s*queue = p\.catch/.test(PET.slice(PET.indexOf("function checkpoint("))));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
