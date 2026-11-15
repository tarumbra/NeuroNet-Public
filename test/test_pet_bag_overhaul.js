/* The Bag Overhaul (2026-10-20): B5 -- arrows a shot, and the knife or fists when they run dry; I11 -- flint arrows made in
   the bag; N22 -- the fight from the bag and the side panel (gear changed mid-fight, traps and potions on quick slots).
   Run: node test/test_pet_bag_overhaul.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 20, 8);
const A = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
function hunter(lv, arrows, extra) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  ["ranged", "attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, T0).maxHp;
  Object.assign(s.bag, {shortbow: 1, bronzearrow: arrows, leatherquiver: 1}, extra || {});
  s = A(s, "class", {cls: "hunter"}).state;
  s = A(s, "equip", {item: "shortbow"}).state; s = A(s, "equip", {item: "leatherquiver"}).state; s = A(s, "equip", {item: "bronzearrow"}).state;
  return s;
}
function fightWith(s, mon, ground) {
  s.player.job = {hunt: ground || "forest", seed: 7, count: 0, kills: {}, items: {}, xp: 0, since: T0, next: T0, until: T0 + 3600e3};
  return C.startBattle(s, s.player, "hunt", ground || "forest", mon, T0, s.player.job);
}
const round = (s, t) => C.battleRound(s, s.player, s.player.battle, t);

console.log("\nB5: arrows a shot, and the knife or fists when they run out\n");
{
  let s = hunter(20, 10);
  fightWith(s, "boar");
  ok("a fight starts without taking an arrow (all 10 loaded in the quiver: N24)", s.player.quiverN === 10 && !s.bag.bronzearrow, [s.player.quiverN, s.bag.bronzearrow]);
  let shots = 0;
  for (let i = 1; i <= 3 && s.player.battle; i++) { const before = s.player.quiverN; round(s, T0 + 2400 * i); if (s.player.quiverN === before - 1) shots++; }
  ok("  each round's shot takes one arrow from the quiver (the count drops as you shoot)", shots === 3 && s.player.quiverN === 7, [shots, s.player.quiverN]);
  ok("  and the hunt counts them for the quiver", C.huntShots(s.player.job) === 3);
}
{
  let s = hunter(30, 2, {bronzeknife: 1});
  fightWith(s, "hippo");
  let t = T0;
  for (let i = 0; i < 5 && s.player.battle; i++) round(s, t += 2400);
  const b = s.player.battle, rs = b ? b.rounds : [];
  ok("two arrows, then the bow runs dry: the fight goes on (not stopped)", !!b && s.player.quiverN === 0, [!!b, s.player.quiverN]);
  ok("  with the hunting knife from the bag", b && b.me.wid === "bronzeknife" && b.me.wfrom === "knife" && b.style !== "ranged", b && [b.me.wid, b.me.wfrom, b.style]);
  ok("  the log says so, once", rs.filter((r) => r.dry).length === 1 && rs.find((r) => r.dry).w === C.ITEMS.bronzeknife.name, JSON.stringify(rs.filter((r) => r.dry)));
  ok("  the battle view shows the knife in hand", C.playerView(s, t).battle.using === C.ITEMS.bronzeknife.name && C.playerView(s, t).battle.usingFrom === "knife");
  ok("  the screen has words for it", /r\.dry\) return `Out of/.test(PET) && /usingFrom === "knife"/.test(PET));
}
{
  let s = hunter(30, 1);
  fightWith(s, "hippo");
  let t = T0;
  for (let i = 0; i < 4 && s.player.battle; i++) round(s, t += 2400);
  const b = s.player.battle;
  ok("no knife: fists", b && b.me.wid === "" && b.me.wname === "fists", b && [b.me.wid, b.me.wname]);
}
{
  let s = hunter(20, 0);
  const st = fightWith(s, "boar");
  // (2026-10-20, Cam: "if no arrows as hunter have the hunting session still start but using the knife or fists")
  ok("a hunt with no arrows at all starts anyway, with fists (no knife here)", st.ok && s.player.battle && s.player.battle.me.wname === "fists", JSON.stringify(st));
  let k = hunter(20, 0, {bronzeknife: 1}); const kr = A(k, "hunt", {ground: "farmyard", roll: 0.3});
  ok("  with a knife in the bag, the knife -- and Hunt says so", kr.ok && /no arrows, so your bronze hunting knife for now/.test(kr.msg), kr.msg);
  let bo = hunter(20, 0); bo.hunt = {farmyard: {kills: 99}};
  ok("  a boss still wants arrows (bring some)", !A(bo, "boss", {ground: "farmyard", roll: 0.3}).ok);
  ok("  clicking a hunting ground goes straight to the fight", /else if \(p\.kind === "hunt"\) \{[^}]*goTo\("pet:hunt"\)/.test(PET));
}
{
  // the quiver's count for the hunt: an improvised quiver lets 60 go, then the knife
  let s = hunter(20, 100, {improvisedquiver: 1, improvisedarrow: 100, bronzeknife: 1});
  s = A(s, "unequip", {item: "leatherquiver"}).state; s = A(s, "equip", {item: "improvisedquiver"}).state; s = A(s, "equip", {item: "improvisedarrow"}).state;
  fightWith(s, "boar"); s.player.quiverN = 0;
  s.player.battle.n = 0; round(s, T0 + 2400);
  ok("an empty quiver (N24: only what's loaded) is dry -- the knife comes out, the bag's arrows stay put", s.player.battle && s.player.battle.me.wid === "bronzeknife" && s.bag.improvisedarrow === 40, s.player.battle && [s.player.battle.me.wid, s.bag.improvisedarrow]);
}
{
  // ran dry earlier in the hunt: the next fight starts with the knife, and the diary says so once
  let s = hunter(20, 0, {bronzeknife: 1});
  s.player.job = {hunt: "forest", seed: 7, count: 3, kills: {}, items: {}, xp: 0, since: T0, next: T0, until: T0 + 3600e3, used: {bronzearrow: 40}};
  const st = C.startBattle(s, s.player, "hunt", "forest", "boar", T0, s.player.job);
  ok("out of arrows mid-hunt: the next fight starts with the knife (the hunt goes on)", st.ok && s.player.battle.me.wid === "bronzeknife", JSON.stringify(st));
  ok("  a note says you hunt on with it", (s.notes || s.log || []).concat(s.diary || []).some ? JSON.stringify(s).includes("you hunt on with your bronze hunting knife") : false);
}

console.log("\nN24: the quiver is loaded by hand\n");
{
  let s = hunter(20, 250);
  ok("wearing arrows loads the quiver from the bag, up to what it holds (leather: 200)", s.player.quiverN === 200 && s.bag.bronzearrow === 50, [s.player.quiverN, s.bag.bronzearrow]);
  s.player.quiverN = 20;
  const p = C.fieldPartners(s, "bronzearrow").map((x) => x.id);
  ok("  arrows in the bag light up the quiver for Use with...", p.includes("leatherquiver"), p.join());
  const r = A(s, "usewith", {item: "bronzearrow", on: "leatherquiver"});
  ok("  using them with the quiver tops it up (20 -> 70, the bag's 50 in)", r.ok && r.state.player.quiverN === 70 && !r.state.bag.bronzearrow, r.error || r.msg);
  ok("  the Gear tab and the fight card show what's loaded", C.playerView(r.state, T0).ammo.count === 70 && C.playerView(r.state, T0).quiver.left === 70);
  const off = A(r.state, "unequip", {item: "leatherquiver"});
  ok("  taking the quiver off puts its arrows back in the bag", off.ok && off.state.bag.bronzearrow === 70 && !off.state.player.quiverN, JSON.stringify([off.state.bag.bronzearrow, off.state.player.quiverN]));
  let h = hunter(20, 30); h.bag.ironarrow = 5; h.player.skills.ranged = C.XP[20];
  const sw = A(h, "equip", {item: "ironarrow"});
  ok("  loading other arrows: the old ones go back to the bag first", sw.ok && sw.state.bag.bronzearrow === 30 && sw.state.player.quiverN === 5 && sw.state.player.gear.ammo === "ironarrow", sw.error || JSON.stringify([sw.state.bag.bronzearrow, sw.state.player.quiverN]));
}

{
  let o = A(C.advance(C.empty(), T0), "player", {name: "Old"}).state; o.v = 20;
  Object.assign(o.bag, {shortbow: 1, leatherquiver: 1, bronzearrow: 300}); Object.assign(o.player.gear, {weapon: "shortbow", quiver: "leatherquiver", ammo: "bronzearrow"}); o.player.skills.ranged = C.XP[10];
  const m = C.advance(o, T0 + 1000);
  ok("an old save's worn quiver starts filled from the bag (save upgrade 21)", m.player.quiverN === 200 && m.bag.bronzearrow === 100, [m.player.quiverN, m.bag.bronzearrow]);
}

console.log("\nI11: flint arrows, made in the bag\n");
{
  const R = C.FIELD_RECIPES.list, knap = R.find((r) => r.id === "knap"), fa = R.find((r) => r.id === "flintarrows");
  ok("chisel on flint makes flint arrowheads; a shaft on a flint head (and a feather) makes a flint arrow", knap && knap.use === "chisel" && knap.on[0] === "flint" && knap.makes === "flintarrowheads"
     && fa && fa.use === "arrowshaft" && fa.on[0] === "flintarrowheads" && fa.also === "feather" && fa.makes === "flintarrow");
  ok("  one home: no flint recipes at the fletching bench any more", !Object.keys(C.WORKSHOPS).some((w) => (C.WORKSHOPS[w].recipes || []).some((r) => /^flintarrow/.test(r.make))));
  ok("  a flint arrow: power 1 (above twig, beside bone) at Ranged 3, in any quiver", C.ITEMS.flintarrow.gear.power === 1 && C.WEAR.flintarrow.ranged === 3 && C.arrowTier("flintarrow") === 0
     && C.ITEMS.improvisedarrow.gear.power < C.ITEMS.flintarrow.gear.power);
  let s = hunter(2, 0, {chisel: 1, flint: 6, arrowshaft: 4, feather: 10});
  ok("a Hunter at Ranged 2 doesn't know it yet -- it says Ranged 3 (or the page)", /Ranged 3/.test(A(s, "usewith", {item: "chisel", on: "flint"}).error || ""), A(s, "usewith", {item: "chisel", on: "flint"}).error);
  s.player.skills.ranged = C.XP[3];
  let r = A(s, "usewith", {item: "flint", on: "chisel"});
  ok("at Ranged 3 a Hunter knaps all the flint into heads (either way round); the chisel stays", r.ok && r.state.bag.flintarrowheads === 6 && !r.state.bag.flint && r.state.bag.chisel === 1, r.error || JSON.stringify(r.state.bag));
  ok("  with Fletching xp, and the chisel wears a use a head", r.state.player.skills.fletching > 0 && r.state.player.wear.chisel === 6, [r.state.player.skills.fletching, (r.state.player.wear || {}).chisel]);
  s = r.state; r = A(s, "usewith", {item: "arrowshaft", on: "flintarrowheads"});
  ok("  then four flint arrows (four shafts)", r.ok && r.state.bag.flintarrow === 4 && r.state.bag.flintarrowheads === 2 && r.state.bag.feather === 6, r.error || JSON.stringify(r.state.bag));
  let t = hunter(3, 0, {flint: 2}); t.bag.chisel = 0; delete t.bag.chisel;
  ok("  no chisel, no knapping", !A(t, "usewith", {item: "flint", on: "chisel"}).ok);
}
{
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  s = A(s, "class", {cls: "berserker"}).state; Object.assign(s.bag, {chisel: 1, flint: 3, arrowshaft: 2, feather: 2});
  ok("a Berserker can't, until the knapper's page", !A(s, "usewith", {item: "chisel", on: "flint"}).ok && /knapper's page/.test(A(s, "usewith", {item: "chisel", on: "flint"}).error));
  s.bag.pageflint = 1;
  const r = A(s, "learn", {item: "pageflint"});
  ok("  reading it teaches both: the heads and the arrows", r.ok && r.state.player.fieldPages.knap && r.state.player.fieldPages.flintarrows && !r.state.bag.pageflint, r.error || r.msg);
  const r2 = A(A(r.state, "usewith", {item: "chisel", on: "flint"}).state, "usewith", {item: "flintarrowheads", on: "arrowshaft"});
  ok("  and then they make flint arrows in the bag", r2.ok && r2.state.bag.flintarrow === 2, r2.error);
  ok("  the page turns up on early creatures", C.FIELD_PAGES.pageflint.from.includes("pig") && C.FIELD_PAGES.pageflint.chance > 0);
  ok("  flint says where its arrowheads come from now", /chisel/.test(C.itemInfo(null, "flint").uses.join(" ") + " " + JSON.stringify(C.itemInfo(null, "flint"))));
}

console.log("\nN22: the fight from the bag\n");
{
  let s = hunter(30, 50, {bronzeknife: 1, ironsword: 1, bronzehelm: 1});
  fightWith(s, "hippo");
  round(s, T0 + 2400);
  const r = A(s, "equip", {item: "bronzeknife"}, T0 + 2500);
  const b = r.state.player.battle;
  ok("wearing a weapon from the bag mid-fight: you fight with it now", r.ok && b.me.wid === "bronzeknife" && b.style === "melee", r.error || [b.me.wid, b.style]);
  ok("  and it costs your next attack, like eating", b.skip && b.skipWhy === "gear" && /costs your next attack/.test(r.msg) && !/next trip/.test(r.msg), r.msg);
  s = r.state; C.battleRound(s, s.player, s.player.battle, T0 + 4800);
  ok("  the round says you changed your gear", s.player.battle.rounds.some((x) => x.gear === "gear") && /You change your gear/.test(PET));
  const r2 = A(s, "equip", {item: "bronzehelm"}, T0 + 4900);
  ok("  armour too: your Defence counts it now", r2.ok && r2.state.player.battle.me.def > s.player.battle.me.def, [r2.ok, r2.state.player.battle.me.def, s.player.battle.me.def]);
}
{
  let s = hunter(30, 50, {bronzeknife: 1, berserkerbrew: 2});
  fightWith(s, "hippo");
  const drk = Object.keys(C.ITEMS).find((k) => C.ITEMS[k].brew && C.ITEMS[k].brew.kind === "combat");
  s.bag[drk] = 2;
  const att0 = s.player.battle.me.att, r = A(s, "drink", {item: drk}, T0 + 100);
  ok("a draught from the bag mid-fight counts at once (" + drk + ")", r.ok && r.state.player.battle.skipWhy === "drink" && r.state.player.battle.me.att >= att0, r.error || [att0, r.state.player.battle.me.att]);
}
{
  let s = hunter(30, 50, {twigsnare: 4, apple: 3});
  const drk = Object.keys(C.ITEMS).find((k) => C.ITEMS[k].brew && C.ITEMS[k].brew.kind === "combat"); s.bag[drk] = 1;
  let r = A(s, "quick", {op: "set", i: 0, item: "twigsnare"});
  ok("a trap goes on a quick slot", r.ok && r.state.player.quick[0] === "twigsnare", r.error);
  s = A(A(r.state, "quick", {op: "set", i: 1, item: drk}).state, "quick", {op: "set", i: 2, item: "apple"}).state;
  ok("  so do a draught and food -- but not a sword", s.player.quick[1] === drk && s.player.quick[2] === "apple" && !A(s, "quick", {op: "set", i: 3, item: "shortbow"}).ok);
  ok("  outside a fight the trap waits", !A(s, "quick", {op: "use", i: 0}).ok);
  fightWith(s, "hippo");
  r = A(s, "quick", {op: "use", i: 0}, T0 + 100);
  ok("  in a fight, its slot lays it on your next turn (Shift+1)", r.ok && r.state.player.battle.toolNext && r.state.player.battle.toolNext.item === "twigsnare", r.error);
  r = A(r.state, "quick", {op: "use", i: 1}, T0 + 200);
  ok("  the draught's slot drinks it -- counted in the fight now", r.ok && r.state.player.brews.combat && r.state.player.battle.skipWhy === "drink", r.error);
}
{
  // a Beast Master's pack: the bag's gear doesn't remake the pets
  const src = fs.readFileSync(path.join(APP, "ui", "pet", "core", "40-zzz-zj-the-fight-from-the-bag.js"), "utf8");
  ok("a pack's fight is left alone", /b\.pack \|\| !counts/.test(src));
}


console.log("\nA combat level-up lists what it opens (2026-10-20)\n");
{
  let s = hunter(19, 10); s.player.skills.ranged = C.XP[20];
  const u = C.levelUnlocks("ranged", 20, s).map((x) => x.text);
  ok("Ranged 20: the gear that needs it, from WEAR (steel arrows, the studded quiver...)", u.some((t) => /steel arrow/i.test(t)) && u.some((t) => /studded quiver/i.test(t)), u.join(" | "));
  ok("  your class's own gear too (a Hunter's steel knife)", u.some((t) => /steel hunting knife/i.test(t)), u.join(" | "));
  let b = A(C.advance(C.empty(), T0), "player", {name: "T"}).state; b = A(b, "class", {cls: "berserker"}).state;
  ok("  not another class's (a Berserker sees no Hunter's knife)", !C.levelUnlocks("ranged", 20, b).some((x) => /hunting knife/i.test(x.text)));
  let g = hunter(17, 10); ["attack", "defence", "hitpoints"].forEach((k) => { g.player.skills[k] = C.XP[18]; });
  const was = C.combatLevel(g.player); g.player.skills.defence = C.XP[19];
  const gu = C.levelUnlocks("defence", 19, g).map((x) => x.text);
  ok("  a hunting ground the new combat level opens is listed (combat " + was + " -> " + C.combatLevel(g.player) + ")", C.combatLevel(g.player) > was ? gu.some((t) => /hunt in the/.test(t)) || !Object.values(C.HUNTS).some((h) => h.level === C.combatLevel(g.player)) : true, gu.join(" | "));
  ok("  combat level-ups show the Unlocks pop-up (waits for Continue)", /COMBAT_POP/.test(PET));
}

console.log("\nThe How to Play book (2026-10-20)\n");
{
  const G = C.HOW_TO_PLAY;
  ok("a book item, read from the bag, with a contents of chapters (each with words, most with a photo)", C.ITEMS.howtoplay && C.ITEMS.howtoplay.guide && G.chapters.length >= 12 && G.chapters.every((c) => c.title && c.paras.length));
  ok("  Amunet's farewell gifts include it, and she says a copy is in Scribe", /"howtoplay": 1/.test(fs.readFileSync(path.join(APP, "ui", "pet", "content", "40-zzz-d-the-tutorial.json"), "utf8"))
     && /a copy sits in NeuroNet's Scribe, under Ebooks/.test(fs.readFileSync(path.join(APP, "ui", "pet", "core", "40-zzz-d-the-tutorial.js"), "utf8")));
  let s = A(C.advance(C.empty(), T0), "tutorial", {op: "start"}).state;
  const k = A(s, "tutorial", {op: "skip"});
  ok("  skipping the tutorial hands it over too", k.ok && k.state.bag.howtoplay === 1 && /How to Play/.test(k.msg), k.error || k.msg);
  // an old save, past the tutorial, without the book: migration 20 gives it once
  let o = A(C.advance(C.empty(), T0), "player", {name: "Old"}).state; o.tutorial = {done: true, step: 3}; delete o.bag.howtoplay; o.v = 19;
  const m = C.advance(o, T0 + 1000);
  ok("  a save past the tutorial gets it once (save upgrade 20)", m.bag.howtoplay === 1 && C.advance(m, T0 + 2000).bag.howtoplay === 1, JSON.stringify([m.v, m.bag.howtoplay]));
  ok("  Read it opens the book in the class books' reader", /if \(a === "readguide"\) return openGuide\(\);/.test(PET) && /function openPages\(/.test(PET) && /data-bookto/.test(PET));
  const shots = path.join(APP, "ui", "pet", "art", "guide"), pdf = path.join(APP, "ui", "pet", "guide", "NeuroPets - How to Play.pdf");
  ok("  its photos are there for every chapter that names one, and in the manifest", G.chapters.filter((c) => c.shot).every((c) => fs.existsSync(path.join(shots, c.shot + ".webp")) && fs.readFileSync(path.join(shots, "manifest.js"), "utf8").includes('"' + c.shot + '"')));
  ok("  the PDF for Scribe's Ebooks shelf is there (tools/make_guide.js)", fs.existsSync(pdf) && fs.readFileSync(pdf).slice(0, 5).toString() === "%PDF-");
  ok("  the game asks NeuroNet to shelve it", /SS\.Store\.call\("guide_to_scribe"/.test(PET) && /def guide_to_scribe\(self\)/.test(fs.readFileSync(path.join(APP, "neuropets.py"), "utf8")));
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
