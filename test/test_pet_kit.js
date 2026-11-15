/* Modernize/Reduce Nav (2026-10-18, Cam's N9): the Kit -- a side panel with your bag, gear and magic, RuneScape-style, a right-click
   menu for the bag (drop, use with, bank, examine); the store room as a bank with tabs; the tutorial's chests step now the Kit and
   the Bank. The rules (bank, deposit, drop) are tested in test_pet_storage.js. Run: node test/test_pet_kit.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8");
const HTML = fs.readFileSync(path.join(APP, "ui", "pet", "index.html"), "utf8"), GCSS = fs.readFileSync(path.join(APP, "ui", "pet", "game.css"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };

console.log("\nThe Kit\n");
ok("a panel beside the page, with a Kit button in the top bar", /<aside class="np-kit" id="np-kit"/.test(HTML) && /data-kittoggle/.test(GAME) && /kitToggle\(\) \{ kitSet\(!kitOpen\(\)\); \}/.test(PET));
ok("  five tabs: Bag, Gear, Combat, Magic, Skills (N22) -- remembered", /\["bag", "Bag", "obj_chest"\], \["gear", "Gear", "bronzehelm"\], \["combat", "Combat", "bronzesword"\], \["magic", "Magic", "willowwand"\], \["skills", "Skills", "tomekeen"\]/.test(PET) && /localStorage\.setItem\("np:kitTab"/.test(PET));
ok("  open by default on a wide window; a drawer over the page on a narrow one", /if \(kitWide\(\)\) return true;/.test(PET) && /@media \(max-width: 1100px\)[^]*\.np-kit \{ position: fixed/.test(GCSS));
ok("the bag: a click does the obvious thing; a right click (or the menu key) opens the menu", /addEventListener\("contextmenu", \(e\) => \{ e\.preventDefault\(\); bagMenu\(id/.test(PET) && /e\.key === "ContextMenu"/.test(PET));
ok("  the menu: its uses, Use with…, Put in the bank, Drop 1/all/X, Examine", /label: "Put in the bank"/.test(PET) && /label: "Drop 1"/.test(PET) && /label: "Drop X…"/.test(PET) && /label: "Examine"/.test(PET));
ok("  dropping something precious asks first", /it\.gem >= 6 \|\| it\.bound\) && !await askYes/.test(PET));
ok("  Use with: the partners light up, a click on one combines", /use-ok/.test(PET) && /act\("usewith", \{item: bagUse, on: id\}\)/.test(PET));
ok("the gear: RuneScape's shape; a click opens the slot's picker, a right click takes it off", /\[null, "helmet", null\]/.test(PET) && /openSlotPicker\(b, "player", k\)/.test(PET) && /label: k === "offhand" \? "Put away" : "Take off"/.test(PET));
ok("the magic: your loadout and spells; a click puts one in or takes it out", /act\("loadout", \{spells: lo\}\)/.test(PET));
ok("one list of bag actions for the bag, the item sheet and the Kit", /function bagActs\(/.test(PET) && /async function doBagAct\(/.test(PET));
ok("the right-click menu works with the keyboard (arrows, Escape)", /e\.key === "ArrowDown" \|\| e\.key === "ArrowUp"/.test(PET) && /role="menuitem"/.test(PET));

console.log("\nGear sets (the team's addition)\n");
{
  const T = Date.UTC(2026, 9, 18, 10);
  let s = C.act(C.advance(C.empty(), T), "player", {name: "T"}, T).state; s.story = {on: false}; s.tutorial = {step: 0, done: true};
  ["attack", "defence"].forEach((k) => { s.player.skills[k] = C.XP[20]; }); Object.assign(s.bag, {bronzesword: 1, bronzehelm: 1, ironsword: 1});
  s = C.act(s, "equip", {item: "bronzesword"}, T).state; s = C.act(s, "equip", {item: "bronzehelm"}, T).state;
  ok("an empty set can't be put on", /empty/.test(C.act(s, "gearset", {op: "load", n: 1}, T).error || ""));
  let r = C.act(s, "gearset", {op: "save", n: 0, name: "Bronze"}, T); s = r.state;
  ok("save what you're wearing as a set, with a name", r.ok && s.player.gearSets[0].name === "Bronze" && s.player.gearSets[0].gear.weapon === "bronzesword");
  s = C.act(s, "equip", {item: "ironsword"}, T).state;
  r = C.act(s, "gearset", {op: "load", n: 0}, T);
  ok("  put it back on in one go", r.ok && r.state.player.gear.weapon === "bronzesword" && r.state.player.gear.helmet === "bronzehelm", r.error);
  ok("  the view says you're wearing it", C.gearSetsView(r.state)[0].on && C.gearSetsView(r.state)[1].empty);
  const gone = JSON.parse(JSON.stringify(s)); delete gone.bag.bronzesword; gone.player.gear.weapon = "ironsword";
  ok("  a piece you no longer have is skipped, and said", (() => { const x = C.act(gone, "gearset", {op: "load", n: 0}, T); return !x.ok && /Couldn't put on bronze sword/.test(x.error); })());
  ok("  three sets, in the Kit's Gear tab (click to put on, right-click to save over, rename, clear)", C.GEAR_SETS === 3 && /data-kset=/.test(PET) && /"Save what I'm wearing over it"/.test(PET));
}

console.log("\nThe bank\n");
ok("the store room's painted Bank opens the bank in one click", /if \(key === "room:storeroom"\) return showStore\(\);/.test(PET));
ok("  the store room's upgrade is a link from the bank", /id="pp-bank-room"/.test(PET));
ok("  the island estates' banks too", /Open the bank \(\$\{ev\.store\.used\}/.test(PET) && !/Organize chests/.test(PET));
ok("  a bigger store room: 60 / 100 / 160 / 240 kinds", C.BANK.kinds.join() === "0,60,100,160,240" && C.BANK.tabs === 9);

console.log("\nThe tutorial\n");
const T = /\{ id: "chests", say: \[([^\]]*)\]/.exec(fs.readFileSync(path.join(APP, "ui", "pet", "core", "40-zzz-d-the-tutorial.js"), "utf8"));
ok("the chests step is now the Kit and the Bank (same step, so saves mid-tutorial don't shift)", T && /your Kit/.test(T[1]) && /Right-click/.test(T[1]) && /your Bank/.test(T[1]) && !/chests/.test(T[1]));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
