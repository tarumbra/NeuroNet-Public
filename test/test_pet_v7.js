/* V7 (carried, Cam's yes; 2026-10-19): Drop from the bag in every mode, and one amount picker for drop, make, store and sell --
   with Recycle offered first. Plus OPT-A: the top bar writes only what changed (the Bag page went from 31 ms of layout a
   second to none). Run: node test/test_pet_v7.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8");
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log("  ok    " + n); } else { fail++; console.log("  FAIL  " + n + (d !== undefined ? "  -- " + d : "")); } };
const DAY = new Date(2026, 9, 19, 12).getTime();
const fresh = () => { const s = C.act(C.advance(C.empty(), DAY), "player", {name: "T"}, DAY).state; s.story = {on: false}; s.tutorial = {step: 0, done: true}; return s; };

console.log("\nDrop\n");
{
  let s = fresh(); s.bag.ironbar = 10;
  const r = C.act(s, "drop", {item: "ironbar", n: 4}, DAY);
  ok("drop some of a thing (any mode)", !r.error && r.state.bag.ironbar === 6, r.error);
  ok("  never more than you have", C.act(s, "drop", {item: "ironbar", n: 99}, DAY).state.bag.ironbar === undefined || C.act(s, "drop", {item: "ironbar", n: 99}, DAY).state.bag.ironbar === 0);
  ok("  the item sheet has Drop…, opening the picker with Recycle offered first", /data-sheet="drop"/.test(PET) && /function dropAsk/.test(PET) && /Recycle instead/.test(PET));
  ok("  precious things ask once more (type DROP)", /type DROP to be sure/.test(PET));
}
console.log("\nOne amount picker\n");
{
  ok("a slider, a number box, 1 · 10 · Half · All, and what you'd get", /function askAmount/.test(PET) && /pp-amount-slide/.test(PET) && /"Half"/.test(PET) && /pp-amount-get/.test(PET));
  ok("  used for Drop X, Deposit/Take X (askCount), making and selling (×?)", /async function askCount\(what, max, o\)[\s\S]{0,200}askAmount/.test(PET) && /data-times="ask"/.test(PET) && /function gbAmountHTML\(/.test(PET) && /data-n="amt"/.test(PET));   // (selling: the bench's amount row since 2026-10-20)
  let s = fresh(); s.bag.ironbar = 10;
  const r = C.act(s, "recycle", {id: "ironbar", n: 3}, DAY);
  ok("  Recycle instead: an iron bar's lot takes 1 h 30 (I4)", !r.error && r.state.recycle.lots[0].ready - DAY === 90 * 60e3, r.error);
}
console.log("\nOPT-A: the top bar writes only changes\n");
{
  ok("title, hint, icon and the page's accent are only written when they change", /const setText = \(el, t\) => \{ if \(el && el\.textContent !== t\)/.test(GAME) && /if \(accentNow !== P\.accent\)/.test(GAME));
  ok("  the Kit panel too", /classList\.contains\("np-kit-on"\) !== on/.test(PET));
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
