/* Battle Re-work Part 4 (2026-10-15): the Hunter -- traps, nets and the hunting knife, the Trapper branch, what creatures
   shrug off, the hunt plan's traps and nets, and Ranger Ash's quest. Run: node test/test_pet_hunter.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 15, 8);
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
function hunter(lv, cls) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  ["ranged", "attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, T0).maxHp;
  Object.assign(s.bag, {shortbow: 1, bronzearrow: 500, leatherquiver: 1, ropesnare: 10, twigsnare: 10, beartrap: 5, twinenet: 10, bronzeknife: 1, ironsword: 1});
  s = A(s, "class", {cls: cls || "hunter"}).state;
  s = A(s, "equip", {item: cls === "berserker" ? "ironsword" : "shortbow"}).state;
  if (cls !== "berserker") { s = A(s, "equip", {item: "leatherquiver"}).state; s = A(s, "equip", {item: "bronzearrow"}).state; }   // (N19: the quiver first)
  return s;
}
function fightWith(s, mon, seed) {        // a hunt fight against this creature, started now
  s.player.job = {hunt: "forest", seed: seed || 7, count: 0, kills: {}, items: {}, xp: 0, since: T0, next: T0, until: T0 + 3600e3};
  const st = C.startBattle(s, s.player, "hunt", "forest", mon, T0, s.player.job);
  return st;
}
const round = (s, t) => C.battleRound(s, s.player, s.player.battle, t || T0 + 2400);

console.log("\nThe Hunter's things\n");
{
  const W = C.WORKSHOPS, at = (w, id) => W[w].recipes.find((r) => r.make === id);
  ok("snares at your crafting bench, bear traps and knives at the anvil, nets at the spinning wheel",
     at("crafting", "twigsnare") && at("crafting", "ropesnare") && at("crafting", "spikedsnare") && at("anvil", "beartrap") && at("anvil", "mithrilbeartrap")
     && at("anvil", "bronzeknife") && at("anvil", "runeknife") && at("spinning", "twinenet") && at("spinning", "weightednet") && at("spinning", "firenet"));
  ok("  a twig snare from twigs and thread at Crafting 3 (two at a time); a twine net from thread at 8",
     at("crafting", "twigsnare").level === 3 && at("crafting", "twigsnare").n === 2 && at("crafting", "twigsnare").needs.thread === 1 && at("spinning", "twinenet").level === 8);
  ok("  six knives, bronze to rune, wielded at Ranged 1 to 50 -- a Hunter's", ["bronze", "iron", "steel", "mithril", "adamant", "rune"].every((m, i) => {
       const g = C.ITEMS[m + "knife"].gear; return g.knife && g.cls === "hunter" && g.req.ranged === [1, 10, 20, 30, 40, 50][i] && C.WEAPONS[m + "knife"][0] === "slash"; }));
  ok("  every one of them says what it does", ["beartrap", "twinenet", "twigsnare"].every((k) => /Hunter's (trap|net)/.test(C.itemInfo(null, k).uses.join(" "))));
}
{
  let s = hunter(20); s.player.gear.weapon = "bronzeknife";
  const me = C.playerFighter(s, s.player, {seed: 1}, T0).me;
  s.player.skills.attack = C.XP[1];
  const me2 = C.playerFighter(s, s.player, {seed: 1}, T0).me;
  ok("the knife stabs with your Ranged hand (Attack 1 makes no difference), and now and then twice", me.att === me2.att && me.double >= 0.15, [me.att, me2.att, me.double]);
}

console.log("\nTraps and nets in a fight\n");
{
  let s = hunter(20); fightWith(s, "boar");
  const r = A(s, "battle", {cmd: "tool", item: "ropesnare"});
  ok("Tools -> a rope snare: it's your next turn", r.ok && r.state.player.battle.toolNext.item === "ropesnare", r.error);
  s = r.state; const n0 = s.bag.ropesnare; round(s);
  const b = s.player.battle, rs = b.rounds;
  ok("  you lay it (no blow), the boar is trapped and loses its turn", rs.some((x) => x.tool === "ropesnare") && !rs.some((x) => x.by === "you" && x.w && x.hit > 0 && !x.tool)
     && rs.some((x) => x.by === "fx" && x.kind === "trapped" && x.on >= 1) && rs.some((x) => x.by === "them" && x.held === "trapped") && s.bag.ropesnare === n0 - 1, JSON.stringify(rs));
  ok("  one trap a fight", /One trap a fight/.test(A(s, "battle", {cmd: "tool", item: "twigsnare"}).error));
  ok("  ...and it counts for Ranger Ash", s.player.caught === 1);
  ok("  a net isn't a trap: still yours to throw", A(s, "battle", {cmd: "tool", item: "twinenet"}).ok);
}
{
  let s = hunter(20, "berserker"); fightWith(s, "boar");
  ok("only a Hunter sets traps (the others learn it on a switch, Part 9)", /Only a Hunter/.test(A(s, "battle", {cmd: "tool", item: "ropesnare"}).error));
  ok("  and not between fights", /for a fight/.test(A(hunter(20), "battle", {cmd: "tool", item: "ropesnare"}).error));
}
{
  let s = hunter(30); fightWith(s, "brownbear");
  s = A(s, "battle", {cmd: "tool", item: "beartrap"}).state; const hp0 = s.player.battle.mhp; round(s);
  const rs = s.player.battle.rounds;
  ok("a bear trap snaps (a hit) and the creature bleeds", rs.some((x) => x.w === "Bear trap" && x.hit > 0) && rs.some((x) => x.by === "fx" && x.kind === "bleeding"), JSON.stringify(rs.slice(-5)));
}
{
  let s = hunter(20); fightWith(s, "spider");
  s = A(s, "battle", {cmd: "tool", item: "twinenet"}).state; round(s);
  ok("a spider walks out of a net (immune)", s.player.battle.rounds.some((x) => x.by === "fx" && x.kind === "netted" && x.immune));
  let t = hunter(20); fightWith(t, "bat");
  ok("  a bat isn't caught by a snare on the ground -- the Tools menu says it won't hold", C.playerView(t, T0).battle.tools.find((x) => x.id === "ropesnare").holds === 0);
  ok("  snakes slip snares; big beasts tear nets; shells don't bleed", C.MONSTERS.snake.fxResist.trapped === 0.5 && C.MONSTERS.elk.fxResist.netted === 0.5 && C.MONSTERS.crab.immune.includes("bleed"));
}
{
  let s = hunter(10); fightWith(s, "boar"); s.player.battle.dr = {them: 1, you: 0};
  ok("each 'lose a turn' on the same creature lasts half as long (diminishing returns): a twig snare after a net won't hold",
     C.playerView(s, T0).battle.tools.find((x) => x.id === "twigsnare").holds === 0);
}
{
  let s = hunter(40); s.player.skills.ranged = C.XP[40];
  s.player.combat.trapOpen = true; s.player.combat.netAbove = 0.5;
  fightWith(s, "chicken"); round(s);
  ok("the hunt plan, dangerous creatures only (the default): no trap on a chicken", !s.player.battle || !s.player.battle.rounds.some((x) => x.tool));
  let t = hunter(40); t.player.combat.trapOpen = true; t.player.combat.toolsOn = "all"; fightWith(t, "deer"); round(t);
  ok("  'every creature': the trap goes down as the fight opens", t.player.battle.rounds.some((x) => x.tool === "ropesnare"), JSON.stringify(t.player.battle.rounds));
  let u = hunter(12); u.player.combat.trapOpen = true; u.player.combat.netAbove = 0.5; u.player.hp = 30;
  u.player.job = {hunt: "deepforest", seed: 3, count: 0, kills: {}, items: {}, xp: 0, since: T0, next: T0, until: T0 + 3600e3};
  C.startBattle(u, u.player, "hunt", "deepforest", "brownbear", T0, u.player.job); C.battleRound(u, u.player, u.player.battle, T0 + 2400);
  ok("  a bear that could finish you in five blows is dangerous: trapped", u.player.battle.rounds.some((x) => x.tool), JSON.stringify(u.player.battle.rounds));
  ok("  the plan uses your cheapest unless you choose", C.toolPlanView(u, u.player).traps.length === 3 && u.player.battle.rounds.find((x) => x.tool).tool !== "beartrap");
}
{
  let s = hunter(30);
  ok("the plan's settings: dangerous or every creature, a trap as fights open, a net above a line, which ones",
     A(s, "toolplan", {toolsOn: "all"}).ok && A(s, "toolplan", {trapOpen: true}).ok && A(s, "toolplan", {netAbove: 0.75}).ok && A(s, "toolplan", {trap: "beartrap"}).ok
     && /lines/.test(A(s, "toolplan", {netAbove: 0.3}).error) && /Only a Hunter/.test(A(hunter(30, "berserker"), "toolplan", {trapOpen: true}).error));
}
{
  let s = hunter(30); s.bag.twinenet = 2000; s.player.combat.toolsOn = "all"; s.player.combat.netAbove = 0.5;
  s.player.skills.hitpoints = C.XP[60]; s.player.skills.defence = C.XP[50]; s.player.hp = 60;   // (PT30: nobody runs for you -- enough to last the hour)
  s = A(s, "hunt", {ground: "forest", roll: 0.2}).state; s = C.advance(s, T0 + 15 * 60e3);   // (a quarter of an hour: ~70 fights)
  const j = s.player.job || s.player.lastTrip, used = 2000 - (s.bag.twinenet || 0);
  ok("a won fight's net is picked up again about half the time: netting every forest creature", (s.player.job ? s.player.job.netsBack : 1) > 0 && used > 0 && used < (s.player.caught || 0) + 60,
     JSON.stringify({used, back: s.player.job && s.player.job.netsBack, caught: s.player.caught}));
}

console.log("\nThe Trapper branch\n");
{
  const br = C.TALENTS.hunter.branches.find((b) => b.id === "trapper");
  ok("the Trapper branch is in: eight nodes, Second snare or Ambush, Killing ground at the bottom", !br.later && br.nodes.length === 8
     && br.nodes.filter((n) => n.choice === "hunter4").map((n) => n.id).join() === "secondsnare,ambush" && br.nodes.find((n) => n.keystone).id === "killingground");
  let s = hunter(30); s.player.classes.hunter.xp = C.XP[30];
  for (const n of ["snarecraft", "snarecraft", "snarecraft", "barbedjaws", "barbedjaws", "barbedjaws", "secondsnare"]) s = A(s, "talent", {node: n}).state;
  ok("  Second snare: two traps a fight", C.trapsAllowed(s.player) === 2);
  fightWith(s, "boar"); s = A(s, "battle", {cmd: "tool", item: "ropesnare"}).state; round(s);
  ok("  ...so a second one can go down", A(s, "battle", {cmd: "tool", item: "twigsnare"}).ok);
  let a = hunter(30); a.player.classes.hunter.xp = C.XP[30];
  for (const n of ["netmender", "netmender", "snarecraft", "widemesh", "widemesh", "snarecraft", "ambush"]) a = A(a, "talent", {node: n}).state;
  a.player.combat.trapOpen = true; a.player.combat.toolsOn = "all"; fightWith(a, "boar"); round(a);
  const rs = a.player.battle ? a.player.battle.rounds : [];
  ok("  Ambush: the opening trap and your first blow, the same round", rs.some((x) => x.tool) && rs.some((x) => x.by === "you" && !x.tool && x.w && !x.held && x.w !== "Rope snare"), JSON.stringify(rs));
  ok("  Killing ground and Easy target are in your talents' sum", (() => { let k = hunter(50); k.player.classes.hunter.xp = C.XP[50];
       for (const n of ["snarecraft","snarecraft","snarecraft","netmender","netmender","barbedjaws","barbedjaws","barbedjaws","widemesh","secondsnare","easytarget","easytarget","easytarget","killingground"]) k = A(k, "talent", {node: n}).state;
       const t = C.talentSum(k.player); return t.heldDmg === 0.25 && Math.abs(t.heldAcc - 0.15) < 1e-9; })());
}

console.log("\nRanger Ash, the Hunter's tutor\n");
{
  let s = hunter(20);
  const ash = C.personView(s, "forest");
  ok("Ranger Ash's first quest, for Hunters: catch 5 creatures in traps or nets", ash.quest.id === "trapperstrade" && ash.quest.needs[0].need === 5);
  ok("  not for a Berserker (they go straight to his next one)", C.personView(hunter(20, "berserker"), "forest").quest.id !== "trapperstrade");
  s.player.caught = 5;
  ok("  five caught: done", C.personView(s, "forest").quest.can);
}

console.log("\nLiving off the land (Cam, PT3)\n");
{
  ok("leaf litter falls in the twiggy woods (prunings, hedge, copse, the oak forest, the ash stand)",
     ["prunings", "hedge", "copse", "forest", "ashstand"].every((id) => C.SKILLS.lumbering.spots.find((x) => x.id === id).loot.some((l) => l[0] === "leaflitter")));
  // (2026-10-19, Cam: "why cant i get leaf litter when collecting twigs from apple trees") -- with no hatchet you pick up what's on the ground
  const bare = (spot) => { let b = A(C.advance(C.empty(), T0), "player", {name: "T"}).state; b.story = {on: false}; delete b.player.tools.lumbering;
    const r = A(b, "trip", {skill: "lumbering", spot, roll: 0.3}); return r.ok ? (C.advance(r.state, T0 + 20 * 60e3).player.job || {}).items || {} : {}; };
  const ap = bare("prunings"), cp = bare("copse");
  ok("  no hatchet: twigs and leaf litter off the ground (Apple trees, Copse) -- never wood or apples", ap.twigs > 0 && ap.leaflitter > 0 && cp.leaflitter > 0 && !ap.applewood && !ap.apple, JSON.stringify(ap));
  let s = hunter(10); delete s.bag.bronzeknife; Object.assign(s.bag, {twigs: 50, oak: 4, leaflitter: 30});
  ok("  no knife, no whittling", /hunting knife/.test(A(s, "whittle", {item: "twigs"}).error));
  ok("  and only a Hunter", /Only a Hunter/.test(A(Object.assign(hunter(10, "berserker"), {}), "whittle", {item: "twigs"}).error));
  s.bag.bronzeknife = 1; const f0 = s.player.skills.fletching || 0;
  ok("  the bag: twigs and oak go with your knife (V2's Use with); birch is the fletching table's (one home)", C.fieldPartners(s, "twigs").some((x) => x.id === "bronzeknife") && C.fieldPartners(s, "oak").length && !C.fieldPartners(s, "birch").length);
  ok("    a shaft goes with leaf litter", C.fieldPartners(Object.assign({}, s, {bag: Object.assign({}, s.bag, {arrowshaft: 5})}), "arrowshaft").some((x) => x.id === "leaflitter"));
  let r = A(s, "usewith", {item: "bronzeknife", on: "twigs"}); s = r.state;
  ok("  a knife: 50 twigs make 50 arrow shafts, with Fletching xp", r.ok && s.bag.arrowshaft === 50 && !s.bag.twigs && (s.player.skills.fletching || 0) > f0, r.error);
  s = A(s, "whittle", {item: "oak"}).state;
  ok("  an oak log makes three", s.bag.arrowshaft === 62);
  r = A(s, "usewith", {item: "leaflitter", on: "arrowshaft"}); s = r.state;
  ok("  a shaft and some leaf litter make an improvised arrow -- no feathers, no heads", r.ok && s.bag.improvisedarrow === 30 && s.bag.arrowshaft === 32 && !s.bag.leaflitter, r.error);
  ok("  an arrow any bow shoots, from Ranged 1", C.ITEMS.improvisedarrow.gear.ammo === "arrow" && C.ITEMS.improvisedarrow.gear.req.ranged === 1);
  let w = hunter(10); Object.assign(w.bag, {twigs: 100}); const x0 = w.player.skills.fletching || 0; w = A(w, "whittle", {item: "twigs"}).state;
  ok("  (PT4: a twig's shaft gives less Fletching xp than the bench's -- 0.2 to 0.33; a log's the same as the bench)", w.player.skills.fletching > x0 && C.LAND.shaftXp.twigs === 0.2 && C.LAND.shaftXp.oak === 0.33
     && Math.abs(C.WORKSHOPS.fletching.recipes.find((r) => r.make === "arrowshaft").xp / 10 - 0.33) < 0.01);
  let b = hunter(10); Object.assign(b.bag, {bones: 4, arrowshaft: 10, feather: 6});
  ok("  bones go with your knife", C.fieldPartners(b, "bones").some((x) => /knife/.test(x.id)));
  b = A(b, "usewith", {item: "bones", on: "bronzeknife"}).state;
  ok("bones carve into bone arrowheads (three a bone)", b.bag.bonearrowheads === 12 && !b.bag.bones);
  const r2 = A(b, "usewith", {item: "arrowshaft", on: "bonearrowheads"}); b = r2.state;
  ok("  a shaft, a bone arrowhead and a feather make a bone arrow -- as good as bronze, no smithing", r2.ok && b.bag.bonearrow === 6 && C.ITEMS.bonearrow.gear.power === C.ITEMS.bronzearrow.gear.power, r2.error);
  ok("  a Berserker can't", /Only a Hunter/.test(A(hunter(10, "berserker"), "carve").error));
  ok("  things that don't go together: nothing happens", /Nothing happens/.test(A(b, "usewith", {item: "feather", on: "bones"}).error));
  ok("  the bag lists the field recipes you know", C.fieldView(b).map((x) => x.id).join() === "whittle,carve,bonearrows,improvise,knap,flintarrows" && !C.fieldView(hunter(10, "berserker")).length);
}
{
  let s = hunter(20); s.bag.feather = 0; s.bag.cowhide = 0;
  s = A(s, "hunt", {ground: "farmyard", roll: 0.3}).state; s = C.advance(s, T0 + 3600e3);
  const j = s.player.job || s.player.lastTrip, kills = j.kills || {};
  let b2 = hunter(20, "berserker"); b2 = A(b2, "equip", {item: "ironsword"}).state; b2 = A(b2, "hunt", {ground: "farmyard", roll: 0.3}).state; b2 = C.advance(b2, T0 + 3600e3);
  const jb = b2.player.job || b2.player.lastTrip;
  const per = (jj, k) => (jj.items[k] || 0) / Math.max(1, jj.count || 0);
  ok("a Hunter plucks the birds: more feathers a bird than a Berserker gets", per(j, "feather") > per(jb, "feather") * 1.3, JSON.stringify([per(j, "feather"), per(jb, "feather")]));
  ok("  and field dressing: more hides and meat a kill now and then (one time in ten)", C.LAND.dress.includes("cowhide") && C.LAND.dressChance === 0.1);
}

console.log("\nQuivers (Part 10, Cam PT7)\n");
{
  ok("four quivers at your crafting bench: improvised (60, your own arrows), leather (200, to iron), studded (500, to mithril), gator hide (1,000, all)",
     ["improvisedquiver", "leatherquiver", "studdedquiver", "gatorquiver"].every((k) => C.WORKSHOPS.crafting.recipes.some((r) => r.make === k))
     && C.ITEMS.improvisedquiver.gear.quiver.cap === 60 && C.ITEMS.improvisedquiver.gear.quiver.tier === 0 && C.arrowTier("improvisedarrow") === 0 && C.arrowTier("bronzearrow") === 1);
  let s = hunter(20); s.bag.improvisedquiver = 1;
  ok("  (N19) an improvised quiver won't go on over bronze arrows -- take them off first", /take them off first/.test(A(s, "equip", {item: "improvisedquiver"}).error || ""));
  const off = A(s, "unequip", {item: "leatherquiver"});
  ok("  (N19) taking the quiver off takes the arrows off with it (they stay in the bag)", off.ok && !off.state.player.gear.ammo && off.state.bag.bronzearrow === 500 && /bronze arrows with it/.test(off.msg || off.state.log[0].text));
  ok("  (N19) no quiver, no arrows: they only go in a quiver", /only go in a quiver/.test(A(off.state, "equip", {item: "bronzearrow"}).error || ""));
  s = A(off.state, "equip", {item: "improvisedquiver"}).state;
  ok("  an improvised quiver won't take bronze arrows (Cam: 'can hold only the wood arrows whittled')", /can't hold bronze arrows/.test(A(s, "equip", {item: "bronzearrow"}).error || ""), A(s, "equip", {item: "bronzearrow"}).error);
  s.bag.improvisedarrow = 500; s = A(s, "equip", {item: "improvisedarrow"}).state;
  s = A(s, "hunt", {ground: "farmyard", roll: 0.3}).state; s = C.advance(s, T0 + 0.25 * 3600e3);
  const used = 500 - s.bag.improvisedarrow;
  // (B5, 2026-10-20: an arrow a shot, and a dry quiver hands you the knife -- the hunt goes on, and the log says so)
  ok("  and empties after 60 shots: the knife comes out and the hunt goes on, and the log says why", !!s.player.job && used === 60 && s.log.some((x) => /Out of arrows -- you hunt on with your bronze hunting knife/.test(x.text)), JSON.stringify({used, job: !!s.player.job}));
  let n = hunter(20); A(n, "unequip", {item: "leatherquiver"}); n = A(n, "unequip", {item: "leatherquiver"}).state; n.player.gear.ammo = "bronzearrow"; const bag0 = n.bag.bronzearrow;
  const nh = A(n, "hunt", {ground: "farmyard", roll: 0.3}); n = C.advance(nh.ok ? nh.state : n, T0 + 10 * 60e3);
  ok("  no quiver (N19, was a loose handful): not one arrow is shot -- the hunt goes on with the knife (2026-10-20)", n.bag.bronzearrow === bag0 && bag0 === 500 && /no arrows, so your bronze hunting knife/.test(nh.msg) && n.log.some((x) => /Out of arrows -- you hunt with your bronze hunting knife/.test(x.text)), [500 - n.bag.bronzearrow, nh.msg]);
  const old = JSON.parse(JSON.stringify(hunter(30))); old.player.gear.ammo = "mithrilarrow"; old.v = 15; delete old.player.gear.quiver;
  const up = C.advance(old, T0);
  ok("an old save's archer gets a quiver that holds their arrows (mithril: studded)", up.player.gear.quiver === "studdedquiver" && up.bag.studdedquiver === 1);
}

console.log("\nThe screens\n");
ok("a hunting ground above your level says so (no battle screen); the fight has a Tools button and menu (each says how long it holds this creature); the hunt plan has the traps and nets",
   /p\.kind === "hunt" && p\.lock\) return toast/.test(PET) && /data-menu="tools"/.test(PET) && /data-tool="/.test(PET) && /won't hold this one/.test(PET) && /function toolPlanHTML/.test(PET) && /pp-toolson/.test(PET) && /pp-netabove/.test(PET) && /pp-trapopen/.test(PET));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
