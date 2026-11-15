/* Q6 (2026-10-19, Cam's picks): every bench as a grid of what it makes beside the one you picked; Use with... lights the benches
   that use a thing; you, coins and the trip at the top of the left panel; the bag helps when a trip fills it; quest items show
   who wants them. Run: node test/test_pet_bench.js [app] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8"), HTML = fs.readFileSync(path.join(APP, "ui", "pet", "index.html"), "utf8");
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log("  ok    " + n); } else { fail++; console.log("  FAIL  " + n + (d !== undefined ? "  -- " + d : "")); } };

console.log("\nThe bench\n");
ok("one layout for every plain bench: tabs, a search, an icon grid, and the one you picked", /function benchHTML/.test(PET) && /pp-btabs/.test(PET) && /pp-bgrid/.test(PET) && /pp-bdetail-top/.test(PET) && /benchPlain\(w\) \? benchHTML\(w\)/.test(PET));
ok("  requirements and materials ticked or crossed; materials open where to get them", /pp-breq/.test(PET) && /class="pp-bmat/.test(PET) && /no"}" data-iteminfo="\$\{n\.id\}"/.test(PET));
ok("  the amount: − slider + and a number box, then Cook / Smelt / Make", /pp-bslide/.test(PET) && /data-bstep/.test(PET) && /benchVerb/.test(PET));
ok("  split by what it's made from (the Kitchen: fish, meat, baking, drinks, pet treats; metals and woods elsewhere)", /function benchGroup/.test(PET) && /"Meat and eggs"/.test(PET) && /const METALS/.test(PET));
ok("Use with… a bench: the benches that use it glow on the workshop painting, and open on what it makes", /benchFrom = id; goTo\("pet:workshop"\)/.test(PET) && /hereText: "Uses "/.test(PET) && /From your bag:/.test(PET));
ok("  offered on anything a bench uses (raw pork...)", /benchUses\(it\.id\)\) return b\("usewith"/.test(PET) && C.WORKSHOPS.kitchen.recipes.some((r) => r.needs.rawpork));
console.log("\nThe left panel and the bag\n");
ok("you, coins, health and the trip at the top of the left panel (the top bar only while it's hidden)", /class="np-side-chips" id="np-chips"/.test(HTML) && /id="np-chips-top"/.test(HTML) && /np-noside/.test(GAME));
ok("the bag fills on a trip: a pop-up with the cheapest stacks to drop, recycle or bank", /function bagFullPop/.test(PET) && /everySecond\("bagfull"/.test(PET) && /The least valuable stacks/.test(PET));
ok("quest items show who wants them (click: to them on the map)", /function questWants/.test(PET) && /np-kit-qface/.test(PET) && /data-qperson/.test(PET));   // (in the Kit's bag since the Bag page went, 2026-10-20)
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
