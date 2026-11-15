/* Class tutorials (2026-10-17): Cam -- "when choosing a class there should be a seperate tutorial which goes thorugh an
   explanation how it works. The tutorial will provide all starting requirements but once over they will say sorry i have to
   depart now with my pack, i bid you goodluck with starting your own pack. There parting gift will be 2 eggs." Tamsin, the
   Beast Master's tutor, lends two pets, a crook and feed; the last step (or skipping, or leaving the class) sends her off
   with them and leaves two eggs. Also: an empty pack no longer stops a Beast Master's hunt ("cant seem to add a pet to my
   pack for hunting"). Run: node test/test_pet_classtut.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 17, 8), H = 3600e3, MIN = 60e3;
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
/** A new player, Amunet's tutorial over, at combat level `lv`, who hasn't chosen a class. */
function player(lv) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  s.tutorial = {step: 0, done: true};
  ["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[lv || 10]; });
  s.player.hp = C.playerView(s, T0).maxHp;
  return s;
}
const tv = (s, t) => C.tutorialView(s, t || T0);

console.log("\nTamsin's lesson\n");
{
  let r = A(player(), "class", {cls: "beastmaster", guild: true});
  let s = r.state, v = tv(s);
  ok("becoming a Beast Master starts Tamsin's lesson, in the tutorial window", r.ok && v.on && v.act === "classtut" && v.guide.name === "Tamsin" && v.step === 0, JSON.stringify(v).slice(0, 200));
  ok("  it opens with her offer: nothing lent yet (taking a class never fills your bag by itself)", v.id === "offer" && !(s.beasts || []).length && !s.bag.oakcrook);
  s = A(s, "classtut", {op: "next"}).state; v = tv(s);
  ok("  the class message says so", /Tamsin will show you how it works/.test(r.msg), r.msg);
  ok("  her painted portrait is the window's picture", v.guide.look.pic === "tamsin" && fs.existsSync(path.join(APP, "ui", "pet", "art", "icons", "obj_ptamsin.webp")));
  ok("she lends two battle pets (Bramble and Hoot) to start with", s.beasts.length === 2 && s.beasts.every((b) => b.loan === "beastmaster") && s.beasts.map((b) => b.name).join() === "Bramble,Hoot");
  ok("  and gives a crook, grain feed and shrimps", s.bag.oakcrook === 1 && s.bag.grainfeed === 12 && s.bag.shrimps >= 6);
  ok("  the Pen marks them as hers", C.penView(s, T0).beasts.every((b) => b.loan === "Tamsin"));
  s = A(s, "tutorial", {op: "next"}).state;           // Amunet's act doesn't move it
  ok("  (Amunet's buttons don't drive it -- it has its own act)", tv(s).step === 1);
  s = A(s, "classtut", {op: "next"}).state;
  ok("step: hold the crook -- not yet", tv(s).id === "crook" && !tv(s).met && A(s, "classtut", {op: "next"}).error);
  s = A(s, "equip", {item: "oakcrook"}).state;
  ok("  wear it: done", tv(s).met, JSON.stringify(s.player.gear));
  s = A(s, "classtut", {op: "next"}).state;
  ok("step: set a pet training in the Pen", tv(s).id === "pen" && !tv(s).met);
  s = A(s, "pentrain", {id: s.beasts[0].id, stat: "attack"}).state;
  ok("  done", tv(s).met);
  s = A(s, "classtut", {op: "next"}).state;
  ok("step: fill the troughs (with her feed)", tv(s).id === "feed" && !tv(s).met);
  s = A(s, "penfeed").state;
  ok("  done", tv(s).met);
  s = A(s, "classtut", {op: "next"}).state;
  ok("step: put a pet in your pack (the Combat tab)", tv(s).id === "pack" && !tv(s).met && tv(s).go === "sheet:combat");
  s = A(s, "pack", {ids: s.beasts.map((b) => b.id)}).state;
  ok("  done", tv(s).met);
  s = A(s, "classtut", {op: "next"}).state;
  ok("step: make an oak crook at the crafting bench (or Tamsin makes one, if you can't yet)", tv(s).id === "crookmake" && tv(s).met !== undefined);
  s = A(s, "classtut", {op: "skipstep"}).state;
  ok("step: moves, feeding, swapping, specials -- just Next", tv(s).id === "moves" && tv(s).met);
  s = A(s, "classtut", {op: "next"}).state;
  ok("step: win 3 fights with the pack in the Farmyard", tv(s).id === "hunt" && !tv(s).met);
  s = A(s, "hunt", {ground: "farmyard", roll: 0.3}).state;
  s = C.advance(s, T0 + 3 * MIN);
  ok("  her lent pets win them", tv(s, T0 + 3 * MIN).met, JSON.stringify(s.hunt && s.hunt.farmyard));
  s = A(s, "classtut", {op: "next"}, T0 + 3 * MIN).state;
  v = tv(s, T0 + 3 * MIN);
  ok("the farewell: \"Sorry, I have to depart now with my pack ... good luck with starting your own pack\"", v.finale && /depart now with my pack/.test(v.say.join(" ")) && /good luck with starting your own pack/.test(v.say.join(" ")));
  ok("  her parting gift: 2 eggs, and the Beast Master's starter crate", v.gifts.some((g) => /egg/.test(g.id) && g.n === 2) && v.gifts.some((g) => g.id === "beastmasterkit"));
  const eggs = s.bag.uncommonegg || 0;
  s = C.advance(s, T0 + 3 * MIN + 2500);                  // still hunting, mid-fight
  ok("  (still out hunting, in a fight, with her pets)", s.player.job && s.player.battle && s.player.battle.pack, JSON.stringify([!!s.player.job, !!s.player.battle]));
  r = A(s, "classtut", {op: "finish"}, T0 + 3 * MIN + 2500);
  s = r.state;
  ok("Thank you, Tamsin: Bramble and Hoot leave with her, the eggs are yours", r.ok && s.beasts.length === 0 && (s.bag.uncommonegg || 0) === eggs + 2, r.error || r.msg);
  ok("  mid-hunt, the pack is called home first (no waiting for a gap between fights)", /called the pack home/.test(r.msg) && !s.player.job && !s.player.battle, r.msg);
  ok("  they're out of your pack too", (s.player.combat.pack || []).length === 0);
  ok("  the crook and what's left of the feed stay", s.player.gear.weapon === "oakcrook");
  ok("  the lesson is over, and done for good", !tv(s, T0 + 3 * MIN).on && s.classTut.done.beastmaster);
  s.dev = {on: true};                                      // (the sandbox: switching class is free)
  r = A(A(s, "class", {cls: "hunter", guild: true}, T0 + 31 * MIN).state, "class", {cls: "beastmaster", guild: true}, T0 + 32 * MIN);
  ok("  coming back to the class later doesn't lend the pets again", r.ok && !tv(r.state, T0 + 32 * MIN).on && r.state.beasts.length === 0, r.error);
  ok("  but her card at the Guild hall can run it again", A(r.state, "classtut", {op: "start", cls: "beastmaster"}, T0 + 33 * MIN).ok);
}
{
  let s = A(player(), "class", {cls: "beastmaster", guild: true}).state; s = A(s, "classtut", {op: "next"}).state;
  const r = A(s, "classtut", {op: "skip"});
  ok("skipping the lesson: she still leaves with her pets and leaves the eggs (nobody is left with nothing)", r.ok && r.state.beasts.length === 0 && r.state.bag.uncommonegg === 2 && !tv(r.state).on, r.error);
  s = A(player(), "class", {cls: "beastmaster", guild: true}).state; s = A(s, "classtut", {op: "next"}).state; s.dev = {on: true};
  s = A(s, "class", {cls: "hunter", guild: true}).state;
  ok("leaving the class mid-lesson: the same goodbye (then the new class's tutor offers theirs)", s.beasts.length === 0 && s.bag.uncommonegg === 2 && tv(s).cls === "hunter" && tv(s).id === "offer" && s.player.cls === "hunter");
  ok("only a Beast Master can ask for the lesson", /Become a Beast Master/.test(A(player(), "classtut", {op: "start", cls: "beastmaster"}).error));
  let am = A(player(), "class", {cls: "beastmaster", guild: true}).state; am = A(am, "classtut", {op: "next"}).state; am.tutorial = {step: 3, given: {}, open: {}};
  ok("Amunet's tutorial comes first; Tamsin's waits for it", tv(am).act === undefined && tv(am).on);
}

console.log("\nThe pack (Cam: \"cant seem to add a pet to my pack for hunting\")\n");
{
  let s = A(player(), "class", {cls: "beastmaster", guild: true}).state;
  s = A(s, "classtut", {op: "skip"}).state;
  s.beasts = [{id: "Fang", name: "Fang", species: "wolf", colour: "grey", born: T0 - 9 * 24 * H, hatchAt: T0 - 9 * 24 * H, joined: T0, xp: C.XP[8], stat: {}, train: "", trainAt: T0, fedUntil: 0, restUntil: 0, wins: 0, faints: 0}];
  ok("(no pack chosen)", !(s.player.combat.pack || []).length);
  s = A(s, "hunt", {ground: "farmyard", roll: 0.3}).state;
  s = C.advance(s, T0 + 3000);
  ok("hunting with no pack chosen: your ready battle pets go, and that's your pack now", s.player.battle && s.player.battle.pack && s.player.combat.pack.join() === "Fang", JSON.stringify([s.player.combat.pack, !!s.player.battle]));
  ok("  the log says so, and where to change it", s.log.some((l) => /pack wasn't chosen.*Combat tab/.test(l.text)));
  ok("the Beast Pen shows your pack, with a button to choose it", /id="pen-pack"/.test(PET) && C.penView(s, T0 + 3000).pack.join() === "Fang");
}

console.log("\nThe page\n");
{
  ok("the tutorial window drives a class tutor's lesson with its own act", /const ta = tv\.act \|\| "tutorial"/.test(PET) && /act\(ta, \{op: "finish"/.test(PET));
  ok("  a farewell has no skill to choose", /tv\.finale && !tv\.skills/.test(PET));
  ok("  Take me there opens the Combat tab", /go === "sheet:combat"/.test(PET));
  ok("the Guild hall: Show me how it works, on your own class's tutor", /data-glesson/.test(PET));
  ok("Tamsin's look is her painted portrait", C.GUILD.tutors.beastmaster.look.pic === "tamsin");
  // Cam (2026-10-17): Pip's and Wren's paintings too, and "make the character image bigger. It is to small"
  ok("every Guild tutor has a painted portrait (Cam's improved set, 17 October)", Object.keys(C.GUILD.tutors).every((k) => C.GUILD.tutors[k].look.pic && fs.existsSync(path.join(APP, "ui", "pet", "art", "icons", "obj_p" + C.GUILD.tutors[k].look.pic + ".webp"))));
  ok("Pip and Wren have their painted portraits", C.GUILD.tutors.thief.look.pic === "pip" && C.GUILD.tutors.hunter.look.pic === "wren"
     && ["pip", "wren"].every((n) => fs.existsSync(path.join(APP, "ui", "pet", "art", "icons", "obj_p" + n + ".webp"))));
  const PEOPLE = fs.readFileSync(path.join(APP, "ui", "pet", "art", "people", "manifest.js"), "utf8");
  ok("  each has a full-height portrait for the tutorial window (art/people)", ["tamsin", "pip", "wren", "brakka", "aldo", "ilse"].every((n) => PEOPLE.includes('"' + n + '"') && fs.existsSync(path.join(APP, "ui", "pet", "art", "people", n + ".webp"))));
  ok("  the game loads them, and the window shows the big one, big", /art\/people\/manifest\.js/.test(fs.readFileSync(path.join(APP, "ui", "pet", "index.html"), "utf8"))
     && /np-tutor-pic painted big/.test(PET) && /\.np-tutor-pic\.painted\.big \{ width: 170px; height: 276px; \}/.test(fs.readFileSync(path.join(APP, "ui", "pet", "theme.css"), "utf8")));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
