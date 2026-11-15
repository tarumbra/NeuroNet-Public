/* V18 (2026-10-20): specials by weapon and level, the catalogue, and your own side bar.
   Run: node test/test_pet_v18.js [app dir] */
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
function hunter(lv, clsLv) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  ["ranged", "attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, T0).maxHp;
  Object.assign(s.bag, {shortbow: 1, bronzearrow: 200, leatherquiver: 1, bronzeknife: 1, grizzclaws: 1});
  s = A(s, "class", {cls: "hunter"}).state;
  s.player.classes.hunter.xp = C.XP[clsLv || 1];
  s = A(s, "equip", {item: "shortbow"}).state; s = A(s, "equip", {item: "leatherquiver"}).state; s = A(s, "equip", {item: "bronzearrow"}).state;
  return s;
}
const fight = (s, mon) => { s.player.job = {hunt: "pasture", seed: 3, count: 0, kills: {}, items: {}, xp: 0, since: T0, next: T0, until: T0 + 3600e3}; return C.startBattle(s, s.player, "hunt", "pasture", mon, T0, s.player.job); };

console.log("\nThe specials\n");
{
  ok("weapon kinds: the knife, sword, mace, maul, longsword, dagger, bow, crossbow and battle staff", ["bronzeknife", "bronzesword", "bronzemace", "bronzemaul", "bronzelongsword", "bronzedagger", "shortbow", "crossbow", "oakbattlestaff"]
     .map(C.weaponFamily).join() === "knife,sword,mace,maul,longsword,dagger,bow,crossbow,battlestaff");
  ok("the knife's three: Double slash, Deep stab, Skinner's cut", ["doubleslash", "deepstab", "skinnerscut"].every((k) => C.SPECIALS.weapon[k].family === "knife"));
  ok("eight signature specials, one for each boss weapon", Object.keys(C.SPECIALS.signature).length === 8 && Object.values(C.SPECIALS.signature).every((x) => C.ITEMS[x.item]));
  ok("every class has more now, unlocking by class level", C.CLASSES.hunter.specials.pinningshot.minLevel === 25 && C.CLASSES.hunter.specials.volley.minLevel === 10 && !C.CLASSES.hunter.specials.aimed.minLevel);
}
{
  let s = hunter(20, 1);
  ok("a level 1 Hunter's side bar: Aimed shot (Volley waits for class level 10), then the bow's Snapshot", C.specLoadout(s.player).join() === "aimed,snapshot", C.specLoadout(s.player).join());
  s.player.classes.hunter.xp = C.XP[12];
  ok("  at class level 12: Volley too", C.specLoadout(s.player).includes("volley"));
  const cat = C.specCatalogue(s.player);
  ok("the catalogue: the class's, every weapon's and every signature special, the locked ones saying why", cat.some((x) => x.kind === "class") && cat.some((x) => x.kind === "weapon") && cat.filter((x) => x.kind === "signature").length === 8
     && /Pinning shot comes at Hunter level 25/.test(cat.find((x) => x.id === "pinningshot").lock) && cat.find((x) => x.id === "skinnerscut").lock === "", JSON.stringify(cat.find((x) => x.id === "pinningshot")));
  let r = A(s, "combat", {loadout: ["aimed", "doubleslash", "deepstab", "skinnerscut", "volley"]});
  ok("five won't fit on the side bar", !r.ok && /holds 4/.test(r.error));
  r = A(s, "combat", {loadout: ["pinningshot"]});
  ok("  nor a special you haven't unlocked", !r.ok && /level 25/.test(r.error));
  r = A(s, "combat", {loadout: ["aimed", "doubleslash", "deepstab", "skinnerscut"]});
  ok("  four you know: your side bar", r.ok && C.specLoadout(r.state.player).join() === "aimed,doubleslash,deepstab,skinnerscut", r.error);
  s = r.state;
  let lo = A(hunter(5, 1), "combat", {loadout: ["deepstab"]});
  ok("a weapon special waits for its skill: Deep stab at Ranged 10", !lo.ok && /Ranged 10/.test(lo.error), lo.error);
}
{
  // the knife in hand: the bow's specials can't go, the knife's can -- and fire
  let s = hunter(20, 12); s = A(s, "combat", {loadout: ["aimed", "doubleslash", "deepstab", "skinnerscut"]}).state;
  s = A(s, "equip", {item: "bronzeknife"}).state; s.player.spec = 100;
  fight(s, "cow");
  const bv = C.playerView(s, T0).battle;
  ok("knife out: the fight's specials fit or not -- Aimed shot hidden, the knife's three there", !bv.specials.find((x) => x.id === "aimed").fits && ["doubleslash", "deepstab", "skinnerscut"].every((k) => bv.specials.find((x) => x.id === k).fits), JSON.stringify(bv.specials.map((x) => [x.id, x.fits])));
  let r = A(s, "combat", {special: "doubleslash"}); r = A(r.state, "battle", {cmd: "special"});
  ok("Double slash with the knife: it goes off", r.ok, r.error);
  s = r.state; C.battleRound(s, s.player, s.player.battle, T0 + 2400);
  const rs = s.player.battle ? s.player.battle.rounds : [];
  ok("  two cuts, by name", rs.filter((x) => x.spec === "Double slash").length === 2, JSON.stringify(rs));
  const t = hunter(20, 12); t.player.spec = 100;
  fight(t, "cow"); t.player.combat.special = "aimed";
  ok("Aimed shot with the bow still goes", A(t, "battle", {cmd: "special"}).ok);
  let k = hunter(20, 12); k = A(k, "equip", {item: "bronzeknife"}).state; k.player.spec = 100; fight(k, "cow"); k.player.combat.special = "aimed";
  ok("  but not with the knife in hand -- it says what it needs", /needs a bow/.test(A(k, "battle", {cmd: "special"}).error || ""), A(k, "battle", {cmd: "special"}).error);
}
{
  // Deep stab bleeds; Skinner's cut dresses one more hide
  let s = hunter(30, 12); s = A(s, "equip", {item: "bronzeknife"}).state; s.player.spec = 100;
  fight(s, "cow"); s.player.combat.special = "deepstab"; s = A(s, "battle", {cmd: "special"}).state;
  let landed = false;
  for (let i = 1; i < 6 && s.player.battle && !landed; i++) { C.battleRound(s, s.player, s.player.battle, T0 + 2400 * i); landed = (s.player.battle || {fx: {them: []}}).fx && (s.player.battle.fx.them || []).some((e) => e.kind === "bleeding"); if (!landed && s.player.battle && !s.player.battle.queued) { s.player.spec = 100; s = A(s, "battle", {cmd: "special"}).state; } }
  ok("Deep stab: the cow bleeds", landed);
  const src = fs.readFileSync(path.join(APP, "ui", "pet", "core", "40-zzz-zl-specials-by-weapon.js"), "utf8");
  ok("Skinner's cut: a win dresses one more hide or meat", /function specSkinned/.test(src) && /specSkinned\(s, pl, j, b, mon\)/.test(fs.readFileSync(path.join(APP, "ui", "pet", "core", "13-live-battles.js"), "utf8")));
  let g = hunter(30, 12); g.player.skills.attack = C.XP[30]; g = A(g, "equip", {item: "grizzclaws"}).state;
  ok("a signature special fits only its weapon: Rend with Grizz's claws, not with a sword", C.specFits(C.CLASSES.hunter, C.SPECIALS.signature.rend, "melee", "grizzclaws") && !C.specFits(C.CLASSES.hunter, C.SPECIALS.signature.rend, "melee", "bronzesword"));
  ok("  and it's on the side bar of whoever holds them (until they choose)", C.specLoadout(g.player).includes("rend"), C.specLoadout(g.player).join());
}
{
  ok("the screens: the catalogue on the Combat tab, the Kit showing only what fits", /function specCatalogueHTML\(pv\)/.test(PET) && /data-speccat=/.test(PET) && /\(b\.specials \|\| \[\]\)\.filter\(\(x\) => x\.fits\)/.test(PET));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
