/* Cam's PT14 / PT20 answers and V11 / V12 (2026-10-18): the fixes (the risen always beside you, the Pet tonic always in Feed, a
   one-click Basilisk, keepsakes shown at the merchant), people explaining things (Ranger Ash, Sexton Hobb, the talent tree),
   field recipes (Use with on anything in one, why not, the Unlocks pop-up, a free page in the tutorial), the fight menus keeping
   their place, the bank's order, the sandbox's free quests and one-creature hunts, region tomes (V11) and the Pen in its places
   (V12). Run: node test/test_pet_pt24.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T = Date.UTC(2026, 9, 18, 10), H = 3600e3, MIN = 60e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T);
const fresh = (dev) => { const s = A(C.advance(C.empty(), T), "player", {name: "T"}).state; s.story = {on: false}; s.tutorial = {step: 0, done: true}; if (dev) s.dev = {on: true}; return s; };
const beast = (id, lv, x) => Object.assign({id, name: id, species: "wolf", colour: "grey", born: T - 9e8, hatchAt: T - 9e8, joined: T, xp: C.XP[lv], stat: {}, train: "", trainAt: T, fedUntil: 0, restUntil: 0, wins: 0, faints: 0}, x || {});

console.log("\nPT20's fixes\n");
ok("the risen stays beside you while it's in the fight -- lying down, dim, once fallen", /rs\.find\(\(x\) => x\.hp > 0\) \|\| rs\[0\]/.test(PET) && /ri\.classList\.toggle\("down", rUp\.hp <= 0\)/.test(PET));
ok("the Pet tonic is always in the fight's Feed menu, greyed with why", /none in your bag -- the apothecary table makes them/.test(PET) && /its PP are full/.test(PET));
ok("New Game Plus has its own 'Mark the Basilisk beaten' button", /id="dv-ngbeat"/.test(PET) && /op: "beatboss", ground: "jungle"/.test(PET));
{ const s = fresh(); s.bag.goldenfeather = 1; const m = C.villageView(s, T).find((w) => w.trade && w.sell);
  ok("a keepsake shows at the merchant, marked as one that can't be sold", m && m.sell.some((x) => x.id === "goldenfeather" && x.bound) && /A mastery's keepsake -- it can't be sold/.test(PET)); }

console.log("\nPeople explaining things\n");
{ const s = fresh(); s.player.cls = "hunter";
  const q = C.talkView(s, "quarry"), h = C.talkView(s, "hobb"), t = C.talkView(s, "talents");
  ok("Ranger Ash explains the Bestiary and shows the golden feather", q.name === "Ranger Ash" && q.show.includes("goldenfeather") && q.lines.length === 3 && /Bestiary/.test(q.lines[0]));
  ok("Sexton Hobb explains life essence, its price and the daily three", h.name === "Sexton Hobb" && /3,000 coins/.test(h.lines[2]) && /3 a day/.test(h.lines[2]));
  ok("your class tutor explains the talent tree (keystones, one of two, respec)", t.name === "Wren" && /keystones/.test(t.lines[2]) && /one of two/.test(t.lines[2]) && /class level 15/.test(t.lines[2]));
  const r = A(s, "seen", {key: "talents"});
  ok("  each comes by itself once, then a button brings it back", r.ok && C.talkView(r.state, "talents").seen && /talkPopup\("talents", true\)/.test(PET) && /data-talk="talents"/.test(PET) && /data-talk="hobb"/.test(PET) && /talkPopup\("quarry"\)/.test(PET)); }

console.log("\nField recipes (PT14)\n");
{ const s = fresh(); s.player.cls = "arcane"; s.bag.twigs = 3; s.bag.arrowshaft = 2;
  ok("Use with is offered on anything in a field recipe, known or not", C.fieldInvolved("twigs") && C.fieldInvolved("arrowshaft") && /Core\.fieldInvolved\(it\.id\)( \|\| benchUses\(it\.id\))?\) return b\("usewith"/.test(PET));
  const why = C.fieldWhy(s, "arrowshaft");
  ok("  and when nothing lights up, it says why (a Hunter's skill; the page you need)", why.some((x) => /Only a Hunter/.test(x)) && why.some((x) => /you need its page/.test(x)), why.join(" | ")); }
{ const s = fresh(); s.bag.pagebandage = 1;
  const r = A(s, "learn", {item: "pagebandage"});
  ok("reading a page: the Unlocks pop-up says what you learnt", r.ok && (r.state.unlocked || []).some((u) => /A new field recipe: Bandages/i.test(u.title)), JSON.stringify((r.state.unlocked || []).map((u) => u.title))); }
{ const s = fresh(); s.quests = {}; const nell = Object.keys(C.PEOPLE).find((k) => C.PEOPLE[k].quests.some((q) => (q.reward.items || {}).pagebandage || (q.reward.items || {}).pageimprovise));
  ok("  a page as a quest reward: the Unlocks pop-up too", !!nell && /if \(ITEMS\[k\]\.learn && ITEMS\[k\]\.learn\.field\) fieldPageGot\(s, k, now\)/.test(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"))); }
ok("the tutorial explains field recipes and gives a bandage page, cloth and herbs", /gift: \{ clay: 10, pagebandage: 1, cloth: 1, herb: 3 \}/.test(fs.readFileSync(path.join(APP, "ui", "pet", "core", "40-zzz-d-the-tutorial.js"), "utf8")));
ok("a fight's menu keeps its place in its list (after a kill, and when you reopen it)", /const menuScroll = \{\}/.test(PET) && /box\.scrollTop = menuScroll\[arenaMenu\] \|\| 0/.test(PET));
ok("the bank can be ordered like the bag (rarest, A to Z, most)", /id="pp-bank-order"/.test(PET) && /bankSort === "name"/.test(PET));

console.log("\nThe sandbox (PT14)\n");
{ const s = fresh(true); s.dev.questFree = true;
  const r = A(s, "quest", {region: "farmyard"});
  ok("Quests hand in without their needs (a switch)", r.ok, r.error);
  ok("  only in the sandbox", !A(Object.assign(fresh(), {dev: {questFree: true}}), "quest", {region: "farmyard"}).ok); }
{ let s = fresh(true); ["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[20]; }); s.bag.bronzesword = 1; s.player.gear.weapon = "bronzesword";
  s = A(s, "dev", {op: "target", ground: "farmyard", mon: "duck"}).state; s = A(s, "hunt", {ground: "farmyard", roll: 0.4}).state;
  for (let t = T; t < T + 10 * MIN; t += 2400) { s = C.advance(s, t); s.player.hp = 60; }
  ok("Hunt one creature: a ground meets only the one you picked", Object.keys(s.quarry || {}).join() === "duck", JSON.stringify(s.quarry)); }

console.log("\nV11: region tomes\n");
{ let s = fresh(); s.beasts = [beast("Fang", 30)];
  ok("seven region tomes, each with its moves", Object.keys(C.REGION_TOMES).length === 7 && ["tomedavyjones", "tomecleopatra", "tomeredriver", "tomeundead", "tomefrostbite", "tomecanopy", "tomestar"].every((k) => C.ITEMS[k]));
  s.ship = {tier: 2, parts: {}}; s = A(s, "pet", {}).state;
  ok("  Davy Jones' Tome comes with a sailboat, once, with the Unlocks pop-up", s.bag.tomedavyjones === 1 && s.tomesGot.tomedavyjones && (s.unlocked || []).some((u) => /Davy Jones/.test(u.title)));
  const tt = C.tomeTeachable(s, s.beasts[0]).filter((x) => x.tome === "tomedavyjones");
  ok("  any pet can learn its moves, up to its battle level", tt.map((x) => x.move).join() === "riptide,barnacleshell", tt.map((x) => x.move).join());
  ok("  the base game's own moves are untouched (no clashing ids)", C.BEAST_MOVES.undertow && C.BEAST_MOVES.undertow.type === "water" && !C.BEAST_MOVES.undertow.tome);
  ok("a first win in the Jungle gives the Canopy Tome", /regionTomeCheck\(s, at, \{ground: j\.hunt\}\)/.test(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8")) && C.REGION_TOMES.tomecanopy.ground === "jungle");
  ok("three tome moves a pet now", C.MOVE_TOMES.max === 3); }

console.log("\nV12: the Pen in its places\n");
ok("the painting is the page, each place opens its own sheet (the line under it went in PT24)", !/pen-summary/.test(PET) && /function penSheetHTML\(key/.test(PET) && /wirePainted\(host, \(k\) => \{ penPlace = k; penPlaceShow\(\); \}\)/.test(PET)
   && !/class="pen-places"/.test(PET));   // (PT27: the sheets are built, never left under the painting)
ok("  six places: stalls, barn, yard, ring, feed, the warden (his tome shelf, the den, your pack)", ["stalls", "barn", "yard", "ring", "feed", "warden"].every((k) => new RegExp('key === "' + k + '"').test(PET)));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
