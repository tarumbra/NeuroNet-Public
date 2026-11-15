/* Amunet's tutorial (2026-10-11, Cam: "a pop up style tutorial which takes the player through all the basics ... a female
   character in the pharaoh outfit ... 'Hello there, welcome to Neurovale' ... 'First what is your name?' ... gifted an age up
   potion ... through expeditions ... chests, battles, stats, armour, food, stews, crafting, material gathering and NPC
   questing ... a rare egg ... 5 iron crates, experience points in a skill of your choice that will level it to ten. Also need
   an ability to delete saves.") Plays it through on a made-up game. Run: node test/test_pet_tutorial.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
let T = Date.UTC(2026, 9, 12, 2), s = C.advance(C.newGame({mode: "hardcore"}, T), T);
const go = (a, o, dt) => { T += dt || 1000; const r = C.act(s, a, o || {}, T); if (r.ok) s = r.state; return r; };
const at = () => C.tutorialView(s, T);
const next = () => go("tutorial", {op: "next"});

ok("a new game offers the tutorial; an old save doesn't", at().canStart && !C.tutorialView(Object.assign(C.advance(C.empty(), T), {player: Object.assign(C.empty().player || {}, {made: true})}), T).canStart);
go("tutorial", {op: "start"});
ok("Amunet opens: 'Hello there, welcome to Neurovale' ... in the Pharaoh's crown, robe and sandals", at().id === "hello" && /welcome to Neurovale/.test(at().say[0]) && /dangerous place/.test(at().say[1])
   && C.GUIDE.look.body === "f" && C.GUIDE.gear.helmet === "pharaohcrown" && C.GUIDE.gear.torso === "pharaohrobe");
next();
ok("'Are you a boy or a girl?' -- in her window", at().id === "body" && /boy or a girl/.test(at().say[0]) && !next().ok);
go("tutorial", {op: "body", body: "f"});
ok("'What is your name?' -- and it waits for one", at().id === "name" && /what is your name/.test(at().say[0]) && at().chosen === "f" && !next().ok);
go("player", {name: "Cam", look: {body: at().chosen}}); next();
ok("  the boy-or-girl answer is kept", s.player.look.body === "f");
ok("your egg: go and take it at the Hatchery (I6)", at().id === "egg" && !at().met && at().go === "pet:hatchery" && at().point.includes('.pp-spot[data-key="pet:hatchery"]'));
go("hatch", {egg: "starter", roll: 0.3}); ok("  taken: done", at().met); next();
ok("pets and their needs, then your stats (just explained)", at().id === "pet" && next().ok && at().id === "stats" && next().ok);
ok("gathering: to the Farmyard", at().id === "gather" && at().go === "region:farmyard" && !at().met);
go("trip", {skill: "foraging", spot: "hedgerow", roll: 0.3}); s = C.advance(s, T += 10 * 60000); ok("  you gathered: done", at().met); go("home"); next();
ok("chests: store something", at().id === "chests" && !at().met);
go("store", {item: "berry", n: 1}); ok("  stored: done", at().met, JSON.stringify(s.storage)); next();
ok("the recycle stash: old boots to put in", at().id === "recycle" && s.bag.boot === 3 && !at().met);
go("recycle", {id: "boot", n: "all", from: "bag"}); ok("  in the stash: done", at().met); next();
ok("food (and stews): raw shrimps and twigs given, and Take me there goes to the Kitchen", at().id === "food" && s.bag.rawshrimp >= 3 && s.bag.twigs >= 3 && at().go === "shop:kitchen"
   && at().say.join(" ").includes("Hearth") && at().say.join(" ").includes("stew"));
const ki = C.WORKSHOPS.kitchen.recipes.findIndex((r) => r.make === "shrimps");
go("craft", {workshop: "kitchen", make: "shrimps", i: ki}); ok("  cooked: done", at().met); next();
ok("crafting: clay given, make something", at().id === "craft" && s.bag.clay >= 10);
const bi = C.WORKSHOPS.crafting.recipes.findIndex((r) => r.make === "bowl");
const cr = go("craft", {workshop: "crafting", make: "bowl", i: bi}); ok("  a clay bowl: done", at().met, cr.error); next();
ok("fighting styles: a starter kit for melee, ranged and magic", at().id === "styles" && s.bag.bronzesword && s.bag.shortbow && s.bag.improvisedarrow >= 50 && s.bag.improvisedquiver && !s.bag.bronzearrow && s.bag.willowwand && s.bag.airrune >= 50 && s.bag.mindrune >= 50
   && /Melee/.test(at().say[0]) && /Ranged/.test(at().say[0]) && /Magic/.test(at().say[0])); next();
ok("armour: a bronze helmet given", at().id === "armour" && s.bag.bronzehelm);
go("equip", {item: "bronzesword"}); go("equip", {item: "bronzehelm"}); ok("  worn: done", at().met, JSON.stringify(s.player.gear)); next();
ok("battles: shrimps for the road; win 3 fights", at().id === "battle" && s.bag.shrimps >= 5 && !at().met);
["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[15]; }); s.player.hp = 15;
go("hunt", {ground: "farmyard", roll: 0.4}); s = C.advance(s, T += 20 * 60000); ok("  3 wins: done", at().met, JSON.stringify(s.hunt)); go("home"); next();
ok("NPC questing: Farmer Giles's first chapter", at().id === "quest" && !at().met);
s.bag.berry = 20; s.bag.twigs = 20; const q = go("quest", {region: "farmyard"}); ok("  handed in: done", at().met, q.error); next();
ok("growing up: an Elixir of Growth given", at().id === "grow" && s.bag.growthelixir === 1);
s = C.advance(s, T += 5 * 60000); const u = go("use", {item: "growthelixir"}); ok("  given to the pet: 3 days old, done", at().met, u.error); next();
ok("expeditions: opened by the tutorial (the story would wait for chapter 5)", at().id === "expedition" && !C.act(s, "expedition", {area: "nowhere"}, T).error.includes("opens in the story"));
const area = C.expeditionsView(s, T).areas ? C.expeditionsView(s, T).areas.find((a) => a.open) : null;
const ex = go("expedition", {area: area ? area.id : C.AREA_ORDER[0], roll: 0.5}); ok("  sent: done", at().met, ex.error); next();
// the Guild hall (PT9, Cam: "after sending pet on expedition then we go to the guild hall ... we also explore and it can be dangerous")
ok("the Guild hall: we explore dangerous places too -- train under a tutor", at().id === "guild" && /train under a tutor/.test(at().say.join(" ")) && !at().met);
go("guildmet", {cls: "paladin"}); ok("  talked to a tutor: done", at().met); next();
ok("the farewell explains the world is made up of many islands -- and Amunet casts Ra's Blessing of the Sun", at().id === "gift" && /many islands/.test(at().say.join(" ")) && /Blessing of the Sun/.test(at().say.join(" ")));
ok("the farewell: a rare egg, 5 iron crates, and a skill to level 10", at().id === "gift" && at().finale && at().gifts.length === 3 && !go("tutorial", {op: "finish"}).ok);
const egg = s.bag.rareegg || 0, crates = s.bag.ironcrate || 0, before = s.player.skills.mining || 0;
go("tutorial", {op: "finish", skill: "mining"});
ok("  the gifts", s.bag.rareegg === egg + 1 && s.bag.ironcrate === crates + 5 && s.player.skills.mining === before + C.XP[10] && C.levelOf(s.player.skills.mining) >= 10);
ok("  and the tutorial is done", !at().on && at().done);
go("tutorial", {op: "restart"}); const r2 = s.tutorial;
ok("restarting it from Settings never gives the gifts twice", at().on && r2.given.armour && r2.finalGiven);

ok("every step with a place to go also has a red-box trail", C.TUTORIAL.every((x) => !x.check || (x.point && x.point.length)));
// B2 (2026-10-19): the pet page left the sidebar for the House -- a red box at a sidebar link that isn't there never shows
{
  const GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8"), groups = /const GROUPS = \[([\s\S]*?)\n  \];/.exec(GAME)[1];
  const navKeys = new Set([...groups.matchAll(/"((?:pet|dev|proto):[a-z]+)"/g)].map((m) => m[1]));
  const allPoints = C.TUTORIAL.concat(...Object.values(C.CLASS_TUTORIALS || {}).map((c) => c.steps || [])).flatMap((x) => x.point || []);
  const bad = allPoints.map((p) => /#np-nav \[data-go="([^"]+)"\]/.exec(p)).filter((m) => m && !navKeys.has(m[1])).map((m) => m[1]);
  ok("every red box at the sidebar points at a page the sidebar has (B2)", navKeys.size > 0 && bad.length === 0, bad.join());
  const grow = C.TUTORIAL.find((x) => x.id === "grow");
  ok("  the Elixir of Growth step leads through the House to your pet's page", grow.point.includes('.pp-spot[data-key="pet:home"]') && grow.point.includes('.pp-spot[data-key="pet:house"]'));
}
ok("Giles's first chapter shows the Unlocks pop-up (what comes next)", (s.unlocked || []).some((u) => /Chapter 1/.test(u.title) && u.list.some((x) => /chapter 2/.test(x.text))), JSON.stringify(s.unlocked));
ok("a new game asks nothing on the character page while Amunet is asking", PET.includes("answer her questions to make your character"));
ok("the red box: grows and shrinks over the next click, following the page", PET.includes("function drawPointer()") && fs.readFileSync(path.join(APP, "ui", "pet", "theme.css"), "utf8").includes("@keyframes np-ring"));
ok("the pop-up: on every page, Take me there, Skip this step, Skip tutorial, tuck away", PET.includes("function drawTutorial()") && PET.includes("Take me there") && PET.includes("Skip this step") && PET.includes("Skip tutorial") && PET.includes("np-tutor-bubble"));
ok("delete a save: any slot, the one being played too (a fresh start, with the tutorial)", PET.includes("pp-slot-delete") && PET.includes('call("pet_newgame", [n, Core.newGame(') && /Deleting the game/.test(PET));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
