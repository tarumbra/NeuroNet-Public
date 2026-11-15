/* NeuroPets audit numbers (2026-10-18): content counts, code size, the XP curve, art coverage and timings, read from the
   built rules in Node. Pure: no save, no app. node tools/audit/collect_pets.js [app] > pets.json */
const vm = require("vm"), fs = require("fs"), path = require("path");
const APP = process.argv[2] || path.join(__dirname, "..", "..");
const P = (...a) => path.join(APP, "ui", "pet", ...a);
const t0 = process.hrtime.bigint();
const ctx = {window: {}, console};
vm.createContext(ctx);
const src = fs.readFileSync(P("petcore.js"), "utf8");
vm.runInContext(src, ctx);
const loadMs = Number(process.hrtime.bigint() - t0) / 1e6;
const C = ctx.window.PetCore || ctx.PetCore;
const W = ctx.window;
vm.runInContext(fs.readFileSync(P("art", "icons", "manifest.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(P("art", "pets", "manifest.js"), "utf8"), ctx);
try { vm.runInContext(fs.readFileSync(P("art", "creatures", "manifest.js"), "utf8"), ctx); } catch (e) {}
const out = {};
const lines = (f) => fs.readFileSync(f, "utf8").split("\n").length;
const dir = (d, ext) => fs.readdirSync(d).filter((f) => f.endsWith(ext)).map((f) => ({f, lines: lines(path.join(d, f)), bytes: fs.statSync(path.join(d, f)).size}));

// ---- code ------------------------------------------------------------------------------------------------------------
out.code = {
  core: dir(P("core"), ".js"), screens: dir(P("screens"), ".js"), content: dir(P("content"), ".json"),
  files: ["petcore.js", "pet.js", "petart.js", "game.js", "pet.css", "game.css", "theme.css", "index.html"].map((f) => ({f, lines: lines(P(f)), bytes: fs.statSync(P(f)).size})),
  py: ["pet.py", "neuropets.py"].map((f) => ({f, lines: lines(path.join(APP, f)), bytes: fs.statSync(path.join(APP, f)).size})),
  exports: Object.keys(C).length,
  functions: (src.match(/\bfunction\s+[A-Za-z_$][\w$]*\s*\(/g) || []).length,
  actions: (src.match(/action === "[a-z0-9_]+"/g) || []).length,
  innerHTML: (fs.readFileSync(P("pet.js"), "utf8").match(/innerHTML\s*=/g) || []).length,
};
const tests = fs.readdirSync(path.join(APP, "test")).filter((f) => /^test_pet.*\.(js|py)$/.test(f));
out.code.tests = tests.map((f) => { const t = fs.readFileSync(path.join(APP, "test", f), "utf8"); return {f, checks: (t.match(/\bok\(/g) || []).length}; });

// ---- content ---------------------------------------------------------------------------------------------------------
const n = (o) => Object.keys(o || {}).filter((k) => k !== "//").length;
const recipes = Object.values(C.WORKSHOPS).reduce((a, w) => a + (w.recipes || []).length, 0);
const spots = Object.values(C.SKILLS).reduce((a, s) => a + (s.spots || []).length, 0);
const quests = Object.values(C.PEOPLE).reduce((a, p) => a + (p.quests || []).length, 0);
const talents = Object.values(C.TALENTS).reduce((a, t) => a + (t.branches || []).reduce((b, br) => b + (br.nodes || []).length, 0), 0);
out.content = {
  items: n(C.ITEMS), recipes, workshops: n(C.WORKSHOPS), skills: n(C.SKILLS), skillReg: (C.SKILL_REG || []).length || n(C.SKILL_REG),
  gatheringSpots: spots, monsters: n(C.MONSTERS), huntingGrounds: n(C.HUNTS), regions: n(C.REGIONS), islands: n(C.ISLANDS),
  species: n(C.SPECIES), petLooks: n(C.PETS), eggs: n(C.EGGS), people: n(C.PEOPLE), quests, storyChapters: (C.STORY || []).length || n(C.STORY),
  classes: n(C.CLASSES), talents, spells: n(C.SPELLS), enchants: n(C.ENCHANTS), beastMoves: n(C.BEAST_MOVES), beastTypes: n(C.BEAST_TYPES),
  regionTomes: n(C.REGION_TOMES), mageRanks: (C.MAGE_RANKS || []).length, rooms: n(C.ROOMS), crops: n(C.CROPS), herbs: n(C.HERBS),
  livestock: n(C.LIVESTOCK), ships: n(C.SHIPS), market: n((C.MARKET || {}).stores), talks: n(C.TALKS), gearSets: C.GEAR_SETS,
  migrations: (C.MIGRATIONS || []).length, saveVersion: C.SAVE_V,
};
// items by kind
const kinds = {};
Object.keys(C.ITEMS).forEach((k) => { const it = C.ITEMS[k]; const kind = it.slot ? "gear" : it.egg ? "egg" : it.heal ? "food" : it.seed ? "seed" : it.crate ? "crate" : it.learn || it.page ? "page/book" : it.potion || it.brew ? "potion" : it.tool ? "tool" : "material"; kinds[kind] = (kinds[kind] || 0) + 1; });
out.content.itemKinds = kinds;
// skills: name + kind
out.skills = Object.keys(C.SKILLS).map((k) => ({id: k, name: C.SKILLS[k].name, spots: (C.SKILLS[k].spots || []).length}));
// XP curve
out.xp = (C.XP || []).slice(0, (C.MAX_LEVEL || 60) + 2);
out.maxLevel = C.MAX_LEVEL;

// ---- art -------------------------------------------------------------------------------------------------------------
const icons = W.PET_ICONS || {}, pics = W.PET_PICS || {};
const itemIds = Object.keys(C.ITEMS);
const painted = itemIds.filter((k) => icons[k] || (C.ITEMS[k].iconAs && icons[C.ITEMS[k].iconAs]));
const own = itemIds.filter((k) => icons[k]);
out.art = {
  items: itemIds.length, itemsOwnPainting: own.length, itemsBorrowed: painted.length - own.length, itemsPixelOnly: itemIds.length - painted.length,
  pixelOnly: itemIds.filter((k) => !painted.includes(k)).slice(0, 400),
  iconsTotal: Object.keys(icons).length, petLooks: Object.keys(C.PETS).length,
  petsPainted: Object.keys(C.PETS).filter((k) => pics[k]).length,
  petsAllPoses: Object.keys(C.PETS).filter((k) => pics[k] && pics[k].a && pics[k].side && pics[k].sleep).length,
  monsters: n(C.MONSTERS), monstersPainted: Object.keys(C.MONSTERS).filter((k) => (W.MONSTER_PICS || {})[k]).length,
};
const artDir = P("art");
let artBytes = 0, artFiles = 0;
(function walk(d) { fs.readdirSync(d, {withFileTypes: true}).forEach((e) => { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else { artBytes += fs.statSync(f).size; artFiles++; } }); })(artDir);
out.art.bytes = artBytes; out.art.files = artFiles;
out.art.byFolder = fs.readdirSync(artDir, {withFileTypes: true}).filter((e) => e.isDirectory()).map((e) => {
  let b = 0, c = 0; (function walk(d) { fs.readdirSync(d, {withFileTypes: true}).forEach((x) => { const f = path.join(d, x.name); if (x.isDirectory()) walk(f); else { b += fs.statSync(f).size; c++; } }); })(path.join(artDir, e.name));
  return {folder: e.name, bytes: b, files: c};
});

// ---- timings (pure rules, this machine) --------------------------------------------------------------------------------
const DAY = new Date(2026, 9, 18, 12).getTime();
const time = (f, reps) => { const a = process.hrtime.bigint(); for (let i = 0; i < reps; i++) f(i); return Number(process.hrtime.bigint() - a) / 1e6 / reps; };
let s = C.act(C.advance(C.empty(), DAY), "player", {name: "T"}).state; s.story = {on: false}; s.tutorial = {step: 0, done: true};
const hatched = C.act(s, "hatch", {egg: "starter", roll: 0.5}, DAY); if (!hatched.error) s = C.advance(hatched.state, DAY + 864e5 * 6);   // (a pet, five days old)
out.timing = {loadMs: Math.round(loadMs * 10) / 10};
out.timing.emptyMs = time(() => C.empty(), 50);
out.timing.advanceIdleMs = time((i) => C.advance(s, DAY + i * 1000), 200);
out.timing.playerViewMs = time((i) => C.playerView(s, DAY + i), 50);
// a gathering trip left for 1, 4 and 8 hours, then caught up at once
const spot = C.SKILLS.foraging && C.SKILLS.foraging.spots[0];
out.timing.catchUp = [];
if (spot) {
  const T1 = DAY + 864e5 * 6, g = C.act(s, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.11}, T1);
  if (!g.error) [0.25, 1, 4, 8].forEach((h) => { const st = JSON.parse(JSON.stringify(g.state)); out.timing.catchUp.push({hours: h, ms: time(() => C.advance(JSON.parse(JSON.stringify(st)), T1 + h * 3600e3), 3)}); });
  else out.timing.catchUpErr = g.error;
}
// save sizes: a fresh save and the big sample if present
out.saves = {freshBytes: JSON.stringify(s).length};
const dev = "/tmp/claude-1000/h/devsave.json";
if (fs.existsSync(dev)) out.saves.devBytes = fs.statSync(dev).size;
console.log(JSON.stringify(out, null, 1));
