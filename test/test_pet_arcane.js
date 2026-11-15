/* ==========================================================================
   NeuroPets: the Arcane class -- magic, runes, spells, the mage tower and
   enchanting (2026-10-07).
   ==========================================================================
   Cam: "Get rid of the timer between each fight. Also start the arcane class
   now so we have another way to use up materials. This should also see
   spellbook added to the game with a list of spells that unlock at each level
   (some with special requirements, like beating a boss and a specific wand).
   Also wands, hats, cloaks, staffs, runes (runecrafting, essence stones,
   shrines). A mage tower where you can pass through the levels of mage like
   adept, etc (each with a pre-requirement and the need to beat a mage before
   progressing. Spells should have the ability to be casted and need to be
   equipped before a battle (magic loadout, the runes required ect. When
   running out of runes for any spells, you default to a staff bash for
   staves or fists when using a wand). This should also add special enchants
   to the game (which also has a book) These should be very difficult to
   obtain and the enchantment recipe is only obtained from rare chests (same
   as some spells). The new enchanting table and alter should be placed in the
   library section of the house, gems will also be used in crafting magic
   equipment. The bedroom has no icon it shows that it is broken please fix
   that as well."

   Runs the game's own rules (ui/pet/petcore.js) on made-up players -- never
   the real save.
   ========================================================================== */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const actx = {window: {}, console};
vm.createContext(actx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petart.js"), "utf8"), actx);
const A = actx.window.PetArt || actx.PetArt;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok    " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
};
const T0 = 1800000000000, MIN = 60000;
function fresh() { const s = C.advance(C.empty(), T0); s.player.made = true; s.player.name = "Tester"; return s; }
function mage(level, weapon, runes) {
  let s = fresh();
  s.player.skills.magic = C.XP[level]; s.player.skills.hitpoints = C.XP[Math.max(10, level)]; s.player.hp = C.levelOf(s.player.skills.hitpoints);
  s = C.act(s, "class", {cls: "arcane"}, T0).state;
  s.bag[weapon] = 1; s.player.gear.weapon = weapon;
  Object.assign(s.bag, runes || {});
  return s;
}

console.log("\nNeuroPets: the Arcane\n");

/* ---- no wait between fights ---- */
{
  const s = fresh();
  const r = C.act(s, "hunt", {ground: "farmyard", roll: 0.3}, T0);
  ok("hunting: the first fight starts at once, and each next a second after the last", r.ok && r.state.player.job.next === T0 + 1000);
}

/* ---- the class, the skills ---- */
ok("the Arcane is a class: magic, with its own specials", C.CLASSES.arcane.style === "magic" && Object.keys(C.CLASSES.arcane.specials).length === 3   /* (V18: Arcane lance at class level 25) */ && !C.CLASSES.arcane.soon);
ok("three new skills: Magic, Runecrafting and Enchanting", ["magic", "runecrafting", "enchanting"].every((k) => C.SKILLS[k]));
ok("  Magic counts toward your combat level", (() => { const s = fresh(); const b = C.combatLevel(s.player); s.player.skills.magic = C.XP[40]; return C.combatLevel(s.player) > b; })());

/* ---- runes ---- */
{
  ok("essence stones are mined (Essence rocks, Meadow; pure essence in the Crystal Caves)",
    C.SKILLS.mining.spots.some((x) => x.loot[0][0] === "runeessence") && C.SKILLS.mining.spots.some((x) => x.loot[0][0] === "pureessence" && x.area === "crystalcaves"));
  ok("twelve shrines across the map (the Blood altar since Part 13), each making its rune", C.SKILLS.runecrafting.spots.length === 12 && C.SKILLS.runecrafting.spots.every((x) => C.REGIONS[x.area] && C.ITEMS[x.loot[0][0]].rune));
  let s = fresh(); s.bag.runeessence = 20;
  const r = C.act(s, "trip", {skill: "runecrafting", spot: "airshrine", roll: 0.2}, T0);
  const st = C.advance(r.state, T0 + 3600000);
  ok("  runecrafting: each essence stone becomes a handful of runes, until the stones run out", r.ok && st.bag.airrune === 100 && !st.bag.runeessence && !st.player.job, `${st.bag.airrune}`);
  const n = fresh();
  ok("  no stones, no runes", !C.act(n, "trip", {skill: "runecrafting", spot: "airshrine", roll: 0.2}, T0).ok);
}

/* ---- the spellbook ---- */
{
  const s = mage(1, "willowwand");
  const sb = C.spellbookView(s);
  ok("the spellbook: spells unlock by Magic level, from 1 to 50", sb.spells.length >= 15 && sb.spells[0].level === 1 && Math.max(...sb.spells.map((x) => x.level)) === 50);
  ok("  some need a boss beaten and a certain wand or staff", ["hartsblessing", "tricksterflurry", "petrify"].every((k) => C.SPELLS[k].req && C.SPELLS[k].req.boss && C.SPELLS[k].req.weapon));
  ok("  and some are only learnt from a scroll (in an ancient chest)", ["frostnova", "storm", "meteor"].every((k) => C.SPELLS[k].scroll)
    && sb.spells.filter((x) => x.hidden).length === 3);
  let t = mage(40, "slywand"); t.hunt = {farmyard: {kills: 0, wins: 3, losses: 0}};
  ok("  Trickster's flurry: Gideon beaten ten times, with the sly wand", /Beat Gideon Fox 10 times/.test(C.spellLock(t, "tricksterflurry")));
  t.hunt.farmyard.wins = 10;
  ok("    then it's yours", C.spellLock(t, "tricksterflurry") === "");
  t.player.gear.weapon = "oakwand";
  ok("    but only with the sly wand in hand", /sly wand/.test(C.spellLock(t, "tricksterflurry")));
  const sc = fresh(); sc.bag.scrollmeteor = 1;
  const l = C.act(sc, "learn", {item: "scrollmeteor"}, T0);
  ok("reading a scroll teaches its spell (and uses it up)", l.ok && l.state.spellsKnown.meteor && !l.state.bag.scrollmeteor);
}

/* ---- the loadout, casting, running out ---- */
{
  let s = mage(13, "willowwand", {airrune: 40, mindrune: 6, firerune: 300});
  let r = C.act(s, "loadout", {spells: ["firestrike", "windstrike", "waterstrike", "earthstrike"]}, T0);
  ok("a loadout: up to three spells, in order", r.ok && r.state.player.loadout.length === 3);
  ok("  a spell above your level can't be equipped", !C.act(s, "loadout", {spells: ["fireblast"]}, T0).ok);
  s = C.act(s, "loadout", {spells: ["firestrike", "windstrike"]}, T0).state;
  s = C.act(s, "hunt", {ground: "farmyard", roll: 0.4}, T0).state;
  const st = C.advance(s, T0 + 10 * MIN), hv = (x, k) => (x.bag[k] || 0) + ((x.grave && x.grave.items[k]) || 0);   // (PT30: nobody runs for you -- a fall puts the runes in the grave)
  ok("casting uses runes (each spell its own)", hv(st, "mindrune") === 0 && hv(st, "airrune") < 40 && hv(st, "firerune") < 300, JSON.stringify({a: st.bag.airrune, m: st.bag.mindrune, f: st.bag.firerune}));
  const kills = (st.player.job || st.player.lastTrip || {}).count || 0;
  ok("  out of runes, you fight on with your fists (a wand)", kills > 6 && st.log.some((e) => /Farmyard/.test(e.text)), String(kills));
  // a staff pays its own element
  let f = mage(1, "airstaff", {mindrune: 50});
  f = C.act(f, "loadout", {spells: ["windstrike"]}, T0).state;
  f = C.act(f, "hunt", {ground: "farmyard", roll: 0.5}, T0).state;
  const fs2 = C.advance(f, T0 + 3 * MIN);
  ok("a staff of air: wind strike costs only its mind rune", hv(fs2, "mindrune") < 50 && !hv(fs2, "airrune"), JSON.stringify({m: fs2.bag.mindrune, a: fs2.bag.airrune}));
  const fs1 = C.advance(f, T0 + 8000);
  ok("  and the battle says what was cast", fs1.player.battle && fs1.player.battle.rounds.some((x) => x.spec === "Wind strike") && C.playerView(fs1, T0 + 8000).battle.cast === "Wind strike");
  ok("  each of your blows says which attack it was (Cam: \"Hit for 6 with wind strike\")",
    fs1.player.battle.rounds.filter((x) => x.by === "you" && !x.ate && !x.reflect).every((x) => x.w === "Wind strike" && !x.wp), JSON.stringify(fs1.player.battle.rounds));
  ok("Magic xp for fighting with spells", fs2.player.skills.magic > C.XP[1]);
}
{
  const s = fresh(); s.player.gear = {weapon: "bronzesword"}; s.player.made = true;
  const st = C.advance(C.act(s, "hunt", {ground: "farmyard", roll: 0.5}, T0).state, T0 + 8000);
  const mine = st.player.battle ? st.player.battle.rounds.filter((x) => x.by === "you" && !x.ate && !x.reflect) : [];
  ok("  a plain blow names your weapon (\"with your Bronze sword\")", mine.length && mine.every((x) => x.w === C.ITEMS.bronzesword.name && x.wp), JSON.stringify(mine));
}

/* ---- gear ---- */
{
  ok("wands, staffs, hats and cloaks -- a new cloak slot", C.PLAYER_SLOTS.includes("cloak") && ["willowwand", "magicwand", "airstaff", "mysticstaff", "wizardhat", "archmagecirclet", "apprenticecloak", "archmagecloak"].every((k) => C.ITEMS[k] && C.ITEMS[k].gear));
  const lib = C.ROOMS.library.workshops;
  ok("  made at the altar in your library -- with gems; the enchanting table is there too (swapped, 2026-10-07)", lib.includes("enchanting") && lib.includes("altar")
    && C.WORKSHOPS.enchanting.recipes.every((r) => /^enchanted/.test(r.make)) && C.WORKSHOPS.enchanting.enchants && C.WORKSHOPS.altar.recipes.filter((r) => Object.keys(r.needs).some((k) => ["quartz", "amethyst", "opal", "pearl", "jade", "ruby", "sapphire", "emerald", "topaz", "diamond"].includes(k))).length >= 12);
  const s = fresh(); s.player.skills.magic = C.XP[20]; s.bag.adeptcloak = 1;
  ok("  the better ones need a rank at the mage tower", /rank of Adept/.test(C.act(s, "equip", {item: "adeptcloak"}, T0).error || ""));
  s.mageRank = 2;
  ok("    then you can wear them", C.act(s, "equip", {item: "adeptcloak"}, T0).ok);
}

/* ---- the mage tower ---- */
{
  ok("the mage tower: Apprentice, Adept, Mage, Sorcerer, Archmage -- each a mage to beat", C.MAGE_RANKS.slice(1).map((r) => r.name).join() === "Apprentice,Adept,Mage,Sorcerer,Archmage"
    && C.MAGE_RANKS.slice(1).every((r) => C.MONSTERS[r.duel] && C.MONSTERS[r.duel].mage) && C.REGIONS.magetower);
  let s = mage(10, "oakwand", {airrune: 999, mindrune: 999, firerune: 999, earthrune: 999, waterrune: 999});
  ok("  a rank needs its levels first", /Runecrafting 5/.test(C.act(s, "rank", {roll: 0.3}, T0).error || ""));
  s.player.skills.runecrafting = C.XP[5];
  const melee = JSON.parse(JSON.stringify(s)); melee.player.gear.weapon = "bronzesword"; melee.bag.bronzesword = 1;
  ok("  and a duel is fought with magic", /wand or a staff/.test(C.act(melee, "rank", {roll: 0.3}, T0).error || ""));
  s.player.loadout = ["firestrike", "earthstrike", "windstrike"]; s.player.skills.magic = C.XP[13];
  s.player.skills.defence = C.XP[10]; s.player.skills.hitpoints = C.XP[12]; s.player.hp = 12;
  let won = null, lost = null;
  for (let i = 0; i < 30 && (!won || !lost); i++) {
    const t = JSON.parse(JSON.stringify(s)); if (!won) { t.bag.tuna = 10; t.player.food = "tuna"; }   // with food to win; without, to lose
    const r = C.act(t, "rank", {roll: (i * 0.618) % 1}, T0);
    const e = C.advance(r.state, T0 + 30 * MIN);
    if (e.mageRank === 1) won = won || e; else lost = lost || e;
  }
  ok("  win the duel: the rank, coins and an ancient chest", won && won.bag.ancientchest === 1 && won.log.some((e) => /Apprentice of the mage tower/.test(e.text)));
  ok("  lose it: you yield -- you don't fall (your bag is safe)", lost && lost.player.hp >= 1 && lost.bag.airrune > 0 && !lost.lastFall);
}

/* ---- enchants ---- */
{
  ok("thirteen enchants, each learnt only from a tome -- and the tomes are only in ancient chests",
    Object.keys(C.ENCHANTS).length === 13 && Object.keys(C.ENCHANTS).every((k) => C.CRATES.ancientchest.loot.some((l) => C.ITEMS[l[0]].learn && C.ITEMS[l[0]].learn.enchant === k)));
  ok("  ancient chests: from bosses (rarely), the far regions' caches and the mage tower", ["gideon", "basilisk"].every((b) => C.MONSTERS[b].drops.some((d) => d[0] === "ancientchest" && d[3] < 0.1))
    && ["deepjungle", "frostpeak"].every((r) => C.SECRETS[r].some((x) => x.items && x.items.ancientchest)));
  let s = fresh(); s.player.skills.enchanting = C.XP[20]; s.house.library = 2;
  Object.assign(s.bag, {bronzesword: 1, firerune: 60, ruby: 1}); s.coins = 600;
  ok("an enchant you don't know can't be put on", !C.act(s, "enchant", {enchant: "flaming", item: "bronzesword"}, T0).ok);
  s.bag.tomeflaming = 1; s = C.act(s, "learn", {item: "tomeflaming"}, T0).state;
  ok("  read its tome and it's in your enchant book", C.enchantBookView(s).list.find((e) => e.id === "flaming").known);
  const r = C.act(s, "enchant", {enchant: "flaming", item: "bronzesword"}, T0);
  ok("  at the enchanting table: runes, a gem and coins, and it's on (Enchanting xp)", r.ok && r.state.player.enchants.bronzesword === "flaming" && !r.state.bag.ruby && r.state.player.skills.enchanting > C.XP[20], r.error);
  ok("  and it counts in a fight (+2 max hit)", C.gearSum({weapon: "bronzesword"}, null, r.state.player.enchants).maxHit === 2);
}

/* ---- the enchanting table's reach (2026-10-07, Cam: "Enchanting table is for enchanting tools, equipment, pet equipment") ---- */
{
  let s = fresh(); s.player.skills.enchanting = C.XP[40]; s.house.library = 3;
  Object.assign(s.bag, {tomeswift: 1, tomewanderer: 1, bronzepick: 1, ironpethelm: 1, airrune: 200, topaz: 2, naturerune: 50, opal: 2}); s.coins = 5000;
  s = C.act(s, "learn", {item: "tomeswift"}, T0).state; s = C.act(s, "learn", {item: "tomewanderer"}, T0).state;
  const t = C.act(s, "enchant", {enchant: "swift", item: "bronzepick"}, T0);
  ok("a tool can be enchanted (Swiftness)", t.ok && t.state.player.enchants.bronzepick === "swift", t.error);
  let m = t.state; m.player.tools = {mining: "bronzepick"}; m.player.skills.mining = C.XP[5];
  const plain = fresh(); plain.bag.bronzepick = 1; plain.player.tools = {mining: "bronzepick"};
  const e1 = C.act(m, "trip", {skill: "mining", spot: "copperrocks", roll: 0.3}, T0).state.player.job.every;
  const e0 = C.act(plain, "trip", {skill: "mining", spot: "copperrocks", roll: 0.3}, T0).state.player.job.every;
  ok("  and works 15% faster on a trip", Math.abs(e1 / e0 - 0.85) < 0.02, `${e0} / ${e1}`);
  const p = C.act(t.state, "enchant", {enchant: "wanderer", item: "ironpethelm"}, T0);
  ok("a pet's gear can be enchanted (Wanderer's)", p.ok && p.state.player.enchants.ironpethelm === "wanderer", p.error);
  ok("  and a pet wearing it does better on expeditions", (() => { C.advance(p.state, T0); return C.gearSum({helmet: "ironpethelm"}).success > C.gearSum({helmet: "ironpethelm"}, null, {}).success; })());
  ok("an enchant only goes where it fits (Swiftness isn't for a pet's helmet)", !C.act(p.state, "enchant", {enchant: "swift", item: "ironpethelm"}, T0).ok);
}
{
  const E = C.ENCHANTS, armour = ["helmet", "torso", "arms", "legs", "feet"];
  ok("armour: every piece can be enchanted (Warding, Thorns, Fortified)", ["warding", "thorns", "fortified"].every((k) => armour.every((sl) => E[k].slots.includes(sl))));
  ok("jewellery: rings and necklaces (Vitality, Focus, Fortune's, Sage's)", ["vitality", "focus", "fortune", "sage"].every((k) => E[k].slots.includes("ring") && E[k].slots.includes("necklace")));
  ok("gems: the enchanting table enchants opal, sapphire, emerald, ruby and diamond", ["opal", "sapphire", "emerald", "ruby", "diamond"].every((g) => C.WORKSHOPS.enchanting.recipes.some((r) => r.make === "enchanted" + g && r.needs[g])));
  ok("  and the strongest enchants and the top wizardry gear need them", ["arcanist", "fortune", "sage", "thorns", "fortified", "vitality", "focus"].every((k) => Object.keys(E[k].cost).some((c) => /^enchanted/.test(c)))
    && ["archmagecirclet", "archmagecloak", "mysticstaff", "sorcerercrown"].every((m) => Object.keys(C.WORKSHOPS.altar.recipes.find((r) => r.make === m).needs).some((c) => /^enchanted/.test(c))));
  let s = fresh(); s.player.skills.enchanting = C.XP[40]; s.house.library = 3;
  Object.assign(s.bag, {tomethorns: 1, bronzegloves: 1, chaosrune: 50, enchantedopal: 1}); s.coins = 2000;
  s = C.act(s, "learn", {item: "tomethorns"}, T0).state;
  const r = C.act(s, "enchant", {enchant: "thorns", item: "bronzegloves"}, T0);
  ok("  e.g. Thorns on your gauntlets: hits you take go back at them", r.ok && C.gearSum({arms: "bronzegloves"}, null, r.state.player.enchants).reflect === 0.1, r.error);
}
ok("the gem bench cuts quartz and amethyst too", ["quartz", "amethyst"].every((g) => C.WORKSHOPS.gemology.recipes.some((r) => r.make === g && r.needs.roughgem)));
{
  const s = fresh();
  const err = C.act(s, "trip", {skill: "runecrafting", spot: "airshrine", roll: 0.2}, T0).error || "";
  ok("a shrine without essence says where to mine it (not bait, not chickens)", /Essence rocks/.test(err) && !/bait|chickens/.test(err), err);
}

/* ---- pictures, the bedroom ---- */
{
  const ids = Object.keys(C.ITEMS).filter((k) => C.ITEMS[k].rune || C.ITEMS[k].learn || (C.ITEMS[k].gear && (C.ITEMS[k].gear.style === "magic" || C.ITEMS[k].gear.slot === "cloak" || C.ITEMS[k].gear.mag)))
    .concat(["runeessence", "pureessence", "ancientchest"]);
  ok("every rune, wand, staff, hat, cloak, scroll and tome has a picture", ids.every((k) => A.itemArt(k) && A.itemArt(k).rows), ids.filter((k) => !A.itemArt(k)).join());
  ok("  and every duelling mage", C.MAGE_RANKS.slice(1).every((r) => A.monster(r.duel)));
  const pj = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
  const icon = (pj.match(/bedroom: "(\w+)"/) || [])[1];
  ok("the bedroom has a picture (the pet bed's)", icon && A.itemArt(icon), icon);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
