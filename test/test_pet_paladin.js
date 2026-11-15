/* Battle Re-work Part 8 (2026-10-15): the Paladin -- shields (armour + block) in the off hand, the shield bash, devotion
   and its specials (Lay on hands, Smite, Aegis), two swords, holy water, Attack and Defence trained together, and the
   Crusade, Bulwark and Grace branches. Run: node test/test_pet_paladin.js [app dir] */
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
function pal(lv, cls) {
  let s = A(C.advance(C.empty(), T0), "player", {name: "Tester"}).state; s.story = {on: false};
  ["attack", "defence", "hitpoints", "ranged"].forEach((k) => { s.player.skills[k] = C.XP[lv]; });
  s.player.hp = C.playerView(s, T0).maxHp;
  Object.assign(s.bag, {steelsword: 2, steelkiteshield: 1, holywater: 2, steelmaul: 1, apple: 10});
  s = A(s, "class", {cls: cls || "paladin"}).state;
  s = A(s, "equip", {item: "steelsword"}).state;
  return s;
}
function fight(s, mon, seed, ground) {
  s.player.job = {hunt: ground || "deepforest", seed: seed || 7, count: 0, kills: {}, items: {}, xp: 0, since: T0, next: T0, until: T0 + 3600e3};
  C.startBattle(s, s.player, "hunt", ground || "deepforest", mon, T0, s.player.job);
}
const round = (s, i) => C.battleRound(s, s.player, s.player.battle, T0 + 2400 * i);
const at = (s, i) => s.player.battle.rounds.filter((x) => x.t === T0 + 2400 * i);

console.log("\nThe Paladin\n");
{
  const P = C.CLASSES.paladin;
  ok("a new class: a sword and a shield, and devotion -- Lay on hands, Smite, Aegis", P && ["layonhands", "smite", "aegis"].every((k) => P.specials[k]));
  ok("  its tree: Crusade, Bulwark, Grace (each with a keystone you can reach)", C.TALENTS.paladin.branches.map((b) => b.id).join() === "crusade,bulwark,grace" && C.TALENTS.paladin.branches.every((b) => b.nodes.some((n) => n.keystone)));
  ok("  a wooden buckler at your bench, kite shields bronze to rune at the anvil, holy water at the apothecary table",
     C.WORKSHOPS.crafting.recipes.some((r) => r.make === "woodenbuckler") && ["bronze", "rune"].every((m) => C.WORKSHOPS.anvil.recipes.some((r) => r.make === m + "kiteshield"))
     && C.WORKSHOPS.apothecary.recipes.some((r) => r.make === "holywater"));
}
{
  let s = pal(30); const r = A(s, "offhand", {item: "steelkiteshield"}); s = r.state;
  ok("a shield goes in the off hand: armour, and a block", r.ok && /blocks 8%/.test(r.msg) && s.player.gear.offhand === "steelkiteshield");
  const me = C.playerFighter(s, s.player, {seed: 1}, T0).me, me0 = C.playerFighter(pal(30), pal(30).player, {seed: 1}, T0).me;
  ok("  the fight counts its defence and its block", me.block === 0.08 && me.def > me0.def, [me.block, me.def, me0.def]);
  ok("  a maul clears it from your arm", (() => { let m = JSON.parse(JSON.stringify(s)); m.player.cls = "berserker"; const q = A(m, "equip", {item: "steelmaul"}); return q.ok && !q.state.player.gear.offhand; })());
  ok("  another class can't carry a kite shield yet", /for Paladins/.test(A(pal(30, "berserker"), "offhand", {item: "steelkiteshield"}).error || ""));
  let blocks = 0, swings = 0;
  for (let seed = 1; seed <= 40; seed++) { const t = JSON.parse(JSON.stringify(s)); fight(t, "brownbear", seed); for (let i = 1; i <= 3 && t.player.battle; i++) { if (round(t, i)) break; const r2 = at(t, i); swings += r2.filter((x) => x.by === "them" && (x.hit > 0 || x.blocked)).length; blocks += r2.filter((x) => x.blocked).length; } }
  ok("  and blocks now and then (about 8% of the blows that would land)", blocks > 0 && blocks / Math.max(1, swings) < 0.25, [blocks, swings]);
}
{
  let s = pal(30); s = A(s, "offhand", {item: "steelkiteshield"}).state; fight(s, "brownbear");
  ok("Bash: only with a shield, only for a Paladin", /shield in your off hand/.test(A((() => { const t = pal(30); fight(t, "brownbear"); return t; })(), "battle", {cmd: "bash"}).error));
  s = A(s, "battle", {cmd: "bash"}).state; round(s, 1);
  ok("  a light blow with the shield that stuns", at(s, 1).some((x) => x.by === "you" && x.w === "Steel kite shield" && x.hit > 0) && at(s, 1).some((x) => x.by === "fx" && x.kind === "stunned" && x.on));
  ok("  then the arm rests (4 rounds)", /3 more rounds/.test(A(s, "battle", {cmd: "bash"}).error || ""), A(s, "battle", {cmd: "bash"}).error);
  let p = pal(40); p = A(p, "offhand", {item: "steelkiteshield"}).state; p = A(p, "bashplan", {on: true}).state; p.player.combat.toolsOn = "all"; fight(p, "deer", 2, "forest"); round(p, 1);
  ok("  the hunt plan bashes on its own when it's ready", at(p, 1).some((x) => x.w === "Steel kite shield"), JSON.stringify(at(p, 1)));
}
{
  let s = pal(30); s = A(s, "offhand", {item: "steelkiteshield"}).state; fight(s, "brownbear", 3);
  round(s, 1); round(s, 2); round(s, 3);
  ok("devotion builds as you block and are hit -- and lasts the hunt", s.player.devotion > 2 && C.playerView(s, T0).furyNow === Math.floor(s.player.devotion), s.player.devotion);
  s.player.devotion = 100; s.player.hp = 5; s = A(s, "combat", {special: "layonhands"}).state; s = A(s, "battle", {cmd: "special"}).state; round(s, 4);
  ok("  Lay on hands: a third of your health back -- your turn", at(s, 4).some((x) => x.lay >= Math.round(C.playerView(s, T0).maxHp * 0.3)) && !at(s, 4).some((x) => x.by === "you" && x.hit > 0) && s.player.devotion < 50);
  let a = pal(30); a = A(a, "offhand", {item: "steelkiteshield"}).state; a = A(a, "combat", {special: "aegis"}).state; fight(a, "brownbear", 5); a.player.devotion = 100; a = A(a, "battle", {cmd: "special"}).state;
  round(a, 1); round(a, 2);
  ok("  Aegis: nothing gets through for 3 rounds", ![1, 2].some((i) => at(a, i).some((x) => x.by === "them" && x.hit > 0)) && a.player.battle.aegis > 0);
  ok("  Smite: three times as hard against the undead", C.PALADIN.undead.includes("pharaoh") && /3 \/ sp\.dmg/.test(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8")));
}
{
  let s = pal(30); const r = A(s, "offhand", {item: "steelsword"}); s = r.state;
  ok("two swords: two blows a round, a little softer, no shield", /sword in each hand/.test(r.msg) && C.playerFighter(s, s.player, {seed: 1}, T0).me.dual === 0.55 && !C.playerFighter(s, s.player, {seed: 1}, T0).me.block);
  let b = pal(30); const q = A(b, "bless", {item: "holywater"}); b = q.state;
  ok("holy water blesses your blade: 30 hits, +1 max hit", q.ok && b.player.bless.left === 30);
  ok("  (only a Paladin)", /Only a Paladin/.test(A(pal(30, "berserker"), "bless", {item: "holywater"}).error));
  let x = pal(30); x.bag.cookedmeat = 50; const a0 = x.player.skills.attack, d0 = x.player.skills.defence;
  x = A(x, "hunt", {ground: "farmyard", roll: 0.4}).state; x = C.advance(x, T0 + 20 * 60e3);
  const da = x.player.skills.attack - a0, dd = x.player.skills.defence - d0;
  ok("a Paladin trains Attack and Defence together (half each)", da > 0 && dd > 0 && Math.abs(da - dd) < 0.5, [da, dd]);
}

console.log("\nFrom PT7 and PT8 (2026-10-16)\n");
{
  let p = pal(20); p = A(p, "offhand", {item: "steelkiteshield"}).state; p = A(p, "bashplan", {on: true}).state; fight(p, "chicken", 2, "farmyard"); round(p, 1);
  ok("the plan's shield bash goes off on any creature now (PT8 s4: it waited for dangerous ones)", at(p, 1).some((x) => x.w === "Steel kite shield"), JSON.stringify(at(p, 1)));
  let q = pal(30); q.player.combat.special = "smite"; q = A(q, "offhand", {item: "steelkiteshield"}).state; fight(q, "brownbear");
  const sv = C.playerView(q, T0).battle.specials;
  ok("the fight lists every special for the Specials menu (cost, ready, what locks it)", sv.map((x) => x.id).join() === "layonhands,smite,aegis,lunge" && sv.every(   /* (V18: the side bar -- the unlocked class specials, then the sword's) */(x) => typeof x.cost === "number" && "ready" in x));
  let d = pal(20); d.dev = {on: true}; const r = A(d, "dev", {op: "level", target: "class", level: 40});
  ok("the sandbox sets your class level -- and so your talent points (PT7 k3)", r.ok && C.classLevel(r.state.player, "paladin") === 40 && C.talentsView(r.state).points === 20 && C.talentsView(r.state).sandbox);
}

console.log("\nThe screens\n");
ok("what's on you, bottom left of the fight: arrows, a blade's poison or blessing, potions (PT7, PT8)", /id="pp-you-buffs"/.test(PET) && /hits left/.test(PET) && /pv\.ammo\.count/.test(PET));
ok("  a Specials button opens them all; a pick makes it yours and fires it if it can (PT7 k2)", /data-menu="specials"/.test(PET) && /data-spec-pick=/.test(PET));
ok("  the Talents tab's class level is a button in the sandbox", /pl-tal-setlv/.test(PET));
ok("a Bash button in fights; shields in the off-hand picker; blocks, Aegis and Lay on hands in the log; the plan's bash line; holy water's Bless button",
   /data-bash="1"/.test(PET) && /Core\.isShield\(x\.id\)/.test(PET) && /You block \$\{theName\(b\)\}'s blow/.test(PET) && /Lay on hands: \+/.test(PET) && /pp-bashauto/.test(PET) && /"Bless your blade"/.test(PET));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
