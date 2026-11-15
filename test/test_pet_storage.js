/* The bag, the store room's chests and crafting from them (2026-10-10, Cam: "Bag should be accessible from anywhere like
   the navigation buttons on top of the map ... Chests in storeroom should be able to be named. When at player estate (only)
   all crafting stations should be able to auto detect materials in the storeroom. Bag sizes should be reduced ... Remove the
   number to make underneath the crafting stations scroll. Potions should be accessible on companion pet page like food but
   seperate."). Run: node test/test_pet_storage.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8"), GAME = fs.readFileSync(path.join(APP, "ui", "pet", "game.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 10, 2), HOUR = 3600e3;
const fresh = () => { const s = C.advance(C.empty(), T0); s.player.made = true; return s; };

/* ---- the bag ---- */
{
  const s = fresh();
  ok("a new bag: 25 slots, 250 to a stack (I8)", C.bagCap(s) === 25 && C.stackCap(s) === 250);
  ok("  bigger bags: 28/350, 36/500, 45/750, 60/1000", ["satchel", "rucksack", "explorerpack", "bottomlessbag"].map((k) => C.ITEMS[k].bagSize + "/" + C.ITEMS[k].stack).join() === "28/350,36/500,45/750,60/1000");
  s.bag.twigs = 249;
  s.player.skills.lumbering = 0;
  const t = C.act(s, "trip", {skill: "lumbering", spot: "copse", roll: 0.3}, T0);
  const y = C.advance(t.state, T0 + HOUR);
  ok("  more than a stack starts another stack in another slot (2026-10-10)", t.ok && y.bag.twigs > 250 && C.slotsOf(y, "twigs") === Math.ceil(y.bag.twigs / 250), [t.error, y.bag.twigs].join());
  const f = fresh(); f.bag = {}; Object.keys(C.ITEMS).filter((k) => !C.ITEMS[k].bagSize && !C.ITEMS[k].unid && !C.ITEMS[k].tool && k !== "twigs").slice(0, C.BAG_START - 1).forEach((k) => { f.bag[k] = 1; }); f.bag.twigs = 249;
  const fy = C.advance(C.act(f, "trip", {skill: "lumbering", spot: "copse", roll: 0.3}, T0).state, T0 + HOUR);
  ok("  ...but with every slot taken, the last stack fills and the rest is left behind (the diary says so)", fy.bag.twigs === 250 && C.bagUsed(fy) === C.BAG_START && fy.log.some((e) => /No room in your bag/.test(e.text)), fy.bag.twigs);
  const b = fresh(); b.storage = {flint: 300}; b.bag.flint = 200;
  const w = C.act(b, "withdraw", {item: "flint", n: "all"}, T0);
  ok("  taking from the chests can fill several stacks", w.ok && w.state.bag.flint === 500 && !w.state.storage.flint && C.slotsOf(w.state, "flint") === 2, w.error);
}

/* ---- the bank (Modernize/Reduce Nav, 2026-10-18: the store room's chests became one bank with tabs) ---- */
{
  const s = fresh();
  let L = C.chestLayout(s);
  ok("a basic store room is a bank of 60 kinds (the chests held 26), in 9 tabs", L.n === 9 && C.BANK.kinds.join() === "0,60,100,160,240" && C.houseView(s, T0).storage.cap === 60);
  let r = C.act(s, "tabname", {tab: 1, name: "  Ores   and bars  "}, T0);
  ok("  a tab takes a name (tidied, 20 letters at most)", r.ok && C.houseView(r.state, T0).storage.chests[1].name === "Ores and bars", r.error);
  ok("  (the old chestname still works, for old buttons)", C.act(s, "chestname", {chest: 2, name: "Wood"}, T0).ok);
  let x = r.state; x.bag.copper = 10; x.bag.tin = 5;
  r = C.act(x, "store", {item: "copper", n: "all", tab: 1}, T0); x = r.state;
  ok("  you choose the tab a new kind goes in", r.ok && /Ores and bars tab/.test(r.message || x.log[0].text) && C.chestLayout(x).of.copper === 1, r.error);
  r = C.act(x, "store", {item: "tin", n: "all"}, T0); x = r.state;
  ok("  no tab picked: the main one", r.ok && C.chestLayout(x).of.tin === 0);
  x.bag.copper = 4;
  r = C.act(x, "store", {item: "copper", n: "all", tab: 0}, T0); x = r.state;
  ok("  a kind you've stored already goes where it is", r.ok && C.chestLayout(x).of.copper === 1 && x.storage.copper === 14);
  const many = Object.keys(C.ITEMS).filter((k) => !C.ITEMS[k].bagSize && !C.ITEMS[k].unid && !C.ITEMS[k].tool && !C.ITEMS[k].gear && k !== "copper" && k !== "tin").slice(0, 58);
  many.forEach((k) => { x.bag[k] = 1; x = C.act(x, "store", {item: k, n: 1, tab: 1}, T0).state; });
  x.bag.clay = 3;
  r = C.act(x, "store", {item: "clay", n: 1}, T0);
  ok("  a tab has no limit of its own; a full bank says so", C.chestLayout(x).used[1] > 13 && !r.ok && /^Your bank is full \(60\/60/.test(r.error), r.error);
  r = C.act(x, "withdraw", {item: "copper", n: "all"}, T0);
  ok("  emptied, a kind leaves its tab", r.ok && !(r.state.storage.copper > 0) && !("copper" in C.chestLayout(r.state).of));
  const old = fresh(); old.storage = {poultice: 1, cottonseed: 129, flower: 130}; delete old.chests;
  const ol = C.chestLayout(old);
  ok("  an old save's stored things are in the main tab, with nothing lost", ol.of.poultice === 0 && ol.of.cottonseed === 0 && ol.of.flower === 0 && C.houseView(old, T0).storage.chests[0].items.length === 3);
  const ch = fresh(); ch.storage = {clay: 2, flint: 3, oak: 4}; ch.chests = {names: ["", "Ores", "", "", "", "", "", "", "", "", "", "", "Herbs"], of: {clay: 0, flint: 1, oak: 12}};
  const cl = C.chestLayout(ch);
  ok("  the old chests became tabs, names and all (past the ninth, into the last)", cl.names[1] === "Ores" && cl.of.flint === 1 && cl.of.oak === 8 && cl.of.clay === 0);
  const v = fresh(); v.player.voyage = {to: "desert", at: T0, until: T0 + HOUR};
  ok("  at sea you can't name a tab", !C.act(v, "tabname", {tab: 0, name: "x"}, T0).ok);
  let d = fresh(); d.bag.copper = 7; d.bag.flint = 3; d.bag.bronzesword = 1; d.player.gear.weapon = "bronzesword";
  r = C.act(d, "deposit", {}, T0);
  ok("Deposit bag: everything goes in, what you wear stays", r.ok && r.state.storage.copper === 7 && r.state.storage.flint === 3 && r.state.bag.bronzesword === 1 && !r.state.storage.bronzesword, r.error);
  d = fresh(); d.bag.copper = 7;
  r = C.act(d, "drop", {item: "copper", n: 3}, T0);
  ok("Drop: gone, as many as you say", r.ok && r.state.bag.copper === 4 && !(r.state.storage || {}).copper, r.error);
  ok("  all of it", C.act(r.state, "drop", {item: "copper", n: "all"}, T0).state.bag.copper === undefined || !C.act(r.state, "drop", {item: "copper", n: "all"}, T0).state.bag.copper);
  d.bag.bronzesword = 1; d.player.gear.weapon = "bronzesword";
  ok("  not what you're wearing", /take it off first/.test(C.act(d, "drop", {item: "bronzesword", n: 1}, T0).error || ""));
}

/* ---- crafting from the chests ---- */
{
  const s = fresh(); s.player.skills.crafting = 0; s.bag.cotton = 5; s.storage = {cotton: 20};
  const rec = C.WORKSHOPS.spinning.recipes.find((r) => r.make === "thread" && r.needs.cotton);
  const view = C.villageView(s, T0).find((w) => w.id === "spinning").recipes.find((r) => r.make === "thread" && r.needs.find((n) => n.id === "cotton"));
  ok("at home, a bench counts what's in your chests", view.can && view.needs[0].have === 25 && view.needs[0].stored === 20, JSON.stringify(view.needs));
  const r = C.act(s, "craft", {workshop: "spinning", make: "thread", i: C.WORKSHOPS.spinning.recipes.indexOf(rec)}, T0);
  ok("  and uses the bag first, then the chests", r.ok && !(r.state.bag.cotton > 0) && r.state.storage.cotton === 25 - rec.needs.cotton, r.error + " " + JSON.stringify(r.state && r.state.storage));
  const away = fresh(); away.player.island = "desert"; away.storage = {cotton: 99};
  ok("  on another island your home chests don't count", C.benchStore(away) === null);
  const npc = C.villageView(s, T0).filter((w) => w.npc).every((w) => w.recipes.every((r) => r.needs.every((n) => !n.stored)));
  ok("  a village trader doesn't reach into your chests", npc);
}

/* ---- every egg you can carry can go in the hatchery (2026-10-11, Cam: "i got an exotic egg and cant put it in the hatchery") ---- */
{
  const carried = new Set();
  ["exoticegg"].concat(Object.keys(C.ITEMS).filter((k) => /egg$/.test(k) && C.EGGS[k.slice(0, -3)])).forEach((k) => carried.add(k));
  const bad = [...carried].filter((k) => C.ITEMS[k] && C.ITEMS[k].egg !== k.slice(0, -3));
  ok("every egg item names its egg, so the Hatchery lists it", !bad.length, bad.join(", "));
  const s = fresh(); s.bag.exoticegg = 1;
  ok("  an exotic egg in the bag shows in the Hatchery's list", C.bagList(s).some((b) => b.id === "exoticegg" && b.kind === "egg"));
}

/* ---- two rugs (2026-10-11, Cam: "woven rug is doubled up at crafting bench, keep the one made of wool as the woven rug and
        rename the other one made with flowers and call it floral rug, 30% cleaner rather then 25% ... a fair bit more expensive") ---- */
{
  const R = C.WORKSHOPS.crafting.recipes, woven = R.filter((r) => r.make === "rug"), floral = R.filter((r) => r.make === "floralrug");
  ok("one Woven rug (wool) and one Floral rug (flowers) at the bench", woven.length === 1 && woven[0].needs.ballofwool && floral.length === 1 && floral[0].needs.flower,
     JSON.stringify([woven.map((r) => r.needs), floral.map((r) => r.needs)]));
  const cost = (r) => Object.keys(r.needs).reduce((a, k) => a + r.needs[k] * C.priceOf(k), 0);
  ok("  the floral one costs a fair bit more (at least 4x the materials, and a higher level)", cost(floral[0]) >= 4 * cost(woven[0]) && floral[0].level > (woven[0].level || 1),
     Math.round(cost(floral[0])) + " vs " + Math.round(cost(woven[0])));
  ok("  25% and 30% cleaner, and each says so", C.ITEMS.rug.cleaner === 0.25 && C.ITEMS.floralrug.cleaner === 0.3 && /30% longer/.test(C.describe("floralrug")) && /25% longer/.test(C.describe("rug")));
  let s = fresh(); s.bag.rug = 1; s.bag.floralrug = 1;
  s = C.act(s, "place", {item: "rug"}, T0).state;
  const sw = C.act(s, "place", {item: "floralrug"}, T0);
  ok("  a floral rug swaps the woven one (back to your bag)", sw.ok && sw.state.room.rug === "floralrug" && sw.state.bag.rug === 1 && /swapped/.test(sw.msg), sw.error || sw.msg);
  const loss = (rug) => { let x = fresh(); x = C.act(x, "hatch", {egg: "starter", roll: 0.5}, T0).state; x = C.advance(x, T0 + 10 * 60000);
    x.pet.s.clean = 100; x.room = rug === null ? {} : {rug}; return Math.round((100 - C.advance(x, T0 + 10 * 60000 + 6 * HOUR).pet.s.clean) * 100) / 100; };
  const none = loss(null);
  ok("  over 6 hours: a woven rug (or an old save's rug) loses 25% less clean, a floral rug 30% less",
     loss("rug") === none * 0.75 && loss(true) === none * 0.75 && Math.abs(loss("floralrug") - none * 0.7) < 0.01, [none, loss("rug"), loss(true), loss("floralrug")].join(" / "));
}
ok("messages show above the crafting window (and every pop-up)", /\.np-toasts \{[^}]*z-index: 9500/.test(fs.readFileSync(path.join(APP, "ui", "pet", "game.css"), "utf8")));

/* ---- the screens ---- */
ok("no Bag button above the pages now: the bag is the Kit's, and any old link to it opens the Kit (2026-10-20)", !/btn\('data-go="pet:bag"', "Bag"/.test(GAME) && /if \(key === "pet:bag"\) \{ if \(SS\.Pet && SS\.Pet\.kitShow\) SS\.Pet\.kitShow\("bag"\); return; \}/.test(GAME));
ok("the painted benches don't say how many things you can make", !/note: can \? `\$\{can\} to make`/.test(PET));
ok("the pet page has its own Potions, apart from Feed", /<div class="pp-label">Potions<\/div>/.test(PET) && /b\.kind === "potion" && !Core\.ITEMS\[b\.id\]\.ageUp/.test(PET));
ok("the bank: tabs (All, yours, one to start), a grid, Deposit bag, and your bag below", /pp-bank-tabs/.test(PET) && /data-btab="0"/.test(PET) && /id="pp-bank-deposit"/.test(PET) && /pp-bank-bag/.test(PET)
   && /"tabname"/.test(PET) && /"banktab"/.test(PET));

/* ---- the parchment look (2026-10-10): NeuroPets only ---- */
{
  const html = fs.readFileSync(path.join(APP, "ui", "pet", "index.html"), "utf8"), th = fs.readFileSync(path.join(APP, "ui", "pet", "theme.css"), "utf8");
  ok("theme.css is loaded last, after pet.css and game.css", html.indexOf('href="theme.css"') > html.indexOf('href="game.css"') && html.indexOf('href="game.css"') > html.indexOf('href="pet.css"'));
  ok("  dark brown behind, parchment cards, dark ink on them", /--bg: #45281a/.test(th) && /--panel: #d8b67f/.test(th) && /--ink: #3b2213/.test(th));
  ok("  words on the wood are light, words on a card dark", /\.np-host \{[^}]*--ink: #f1dcb4/.test(th) && /\.pp-modal-card[\s\S]*?--ink: #3b2213/.test(th));
}

/* ---- the carved frames (2026-10-10, Cam's Parchment UI pictures) ---- */
{
  const th = fs.readFileSync(path.join(APP, "ui", "pet", "theme.css"), "utf8"), UI = path.join(APP, "ui", "pet", "art", "ui");
  const pics = ["card-frame", "popup-frame", "title-ribbon", "button", "button-on", "item-slot", "divider", "planks"];
  ok("every frame picture is there and used", pics.every((n) => fs.existsSync(path.join(UI, n + ".png")) && th.includes("art/ui/" + n + ".png")), pics.filter((n) => !fs.existsSync(path.join(UI, n + ".png"))).join());
  ok("  small files (cut to their real pixel size)", pics.every((n) => fs.statSync(path.join(UI, n + ".png")).size < 60000));
  ok("  nothing painted is made pixel-crisp: only buttons, the top bar and window headings", !/:is\([^)]*\)[^{]*\{[^}]*image-rendering/.test(th));
}

/* ---- what this trip has found, under a region's picture, live (2026-10-10) ---- */
{
  const s = fresh(); s.player.skills.digging = 0;
  let r = C.act(s, "trip", {skill: "digging", spot: "garden", roll: 0.3}, T0);
  const y = C.advance(r.state, T0 + 10 * 60000), pj = C.playerView(y, T0 + 10 * 60000).job, lv = C.landView(y, "pasture", T0 + 10 * 60000);
  ok("a trip keeps what it has found so far, kind by kind (earthworms among them)", r.ok && pj && pj.items && pj.items.earthworm > 0 && lv.job && lv.job.count > 100, JSON.stringify(pj && pj.items));
  ok("  the region page lists those finds, with what's in the bag on hover", /function landTripHTML/.test(PET) && /this trip · \$\{\(bag\[k\] \|\| 0\)/.test(PET));
  ok("  and redraws them every second while you watch (and the page when the trip ends)", /function landTripClock/.test(PET) && /landTripClock\(host, id\)/.test(PET));
}

/* ---- no shortcuts past the world (2026-10-10, Cam: the trip chip "takes away the need to navigate the gameworld ...
   and doesnt allow the player to have to learn where everything is") ---- */
{
  const s = fresh(); s.player.skills.digging = C.XP[3];                   // the Chicken run is Digging 3
  const y = C.act(s, "trip", {skill: "digging", spot: "chickenrun", roll: 0.3}, T0).state;
  ok("your trip knows its region (the Chicken run is in the Farmyard)", C.playerView(y, T0 + 1000).job.area === "farmyard");
  const g = C.dashView(y, T0 + 1000).live.find((x) => x.kind === "gather");
  ok("  Today's trip card opens that region on the map, not the digging list", g && g.go === "pet:world" && g.region === "farmyard", JSON.stringify(g));
  ok("  the top bar's trip chip opens it too", /data-place="\$\{esc\(j\.area\)\}"/.test(GAME) && /SS\.Pet\.toRegion\(pl\.dataset\.place\)/.test(GAME) && !/data-go="pet:\$\{j\.skill\}"/.test(GAME));
  ok("  and the Player page's gathering skills open the Map", /Core\.GATHERING\.includes\(k\) \? "pet:world"/.test(PET));
}

/* ---- earthworms: next likeliest after soil (2026-10-10) ---- */
{
  const worms = C.SKILLS.digging.spots.filter((sp) => sp.loot.some((l) => l[0] === "earthworm"));
  const w = (sp, id) => (sp.loot.find((l) => l[0] === id) || [0, 0])[1];
  ok("wherever earthworms turn up, they're just under soil (and above everything else but the Muck heap's dung)", worms.length === 5
    && worms.every((sp) => w(sp, "earthworm") < w(sp, "soil") && w(sp, "soil") - w(sp, "earthworm") <= 6
      && sp.loot.every((l) => l[0] === "soil" || l[0] === "earthworm" || (sp.id === "muckheap" && l[0] === "dung") || l[1] < w(sp, "earthworm"))),
    worms.map((sp) => sp.id + " " + w(sp, "earthworm") + "/" + w(sp, "soil")).join(", "));
}
/* ---- the bank's clicks and drags (Modernize/Reduce Nav) ---- */
ok("the bank: a click takes one, a right click Take 1/5/10/all/X and Move to a tab", /take\(id, 1, ov\)/.test(PET) && /"Take X…"/.test(PET) && /"Move to "/.test(PET));
ok("  drag a bag thing onto the bank or a tab to put it all in; a bank thing onto a tab moves it, onto your bag takes it", /storeIt\(id, "all", tab >= 0 \? tab : undefined\)/.test(PET) && /moveTo\(id, tab\) : take\(id, "all"\)/.test(PET) && /draggable="true"/.test(PET));
{
  let s = fresh(); s.storage = {flint: 5, clay: 3};
  let r = C.act(s, "banktab", {item: "flint", tab: 1}, T0);
  ok("a kind moves to another tab, all of it", r.ok && C.chestLayout(r.state).of.flint === 1 && r.state.storage.flint === 5 && /flint ×5 from the bank to the bank's tab 2/.test(r.message || r.state.log[0].text), r.error || (r.state && r.state.log[0].text));
  ok("  not into the tab it's in", !C.act(r.state, "banktab", {item: "flint", tab: 1}, T0).ok);
  const v = fresh(); v.storage = {flint: 1}; v.player.voyage = {to: "desert", at: T0, until: T0 + HOUR};
  ok("  only at home (not at sea)", !C.act(v, "banktab", {item: "flint", tab: 1}, T0).ok);
}

/* ---- finding a recipe at a bench (2026-10-10) ---- */
ok("a bench with more than a few recipes has a search box: the name, what it does, or an ingredient",
  /id="pp-shop-q"/.test(PET) && /data-find="\$\{esc\(\[r\.name, r\.does \|\| "", \.\.\.r\.needs\.map\(\(n\) => n\.name\)\]/.test(PET));
ok("  every word has to match; the search stays while you craft (one per bench); nothing found says so",
  /words\.every\(\(x\) => r\.dataset\.find\.includes\(x\)\)/.test(PET) && /if \(shopQueryFor !== w\.id\)/.test(PET) && /Nothing here matches/.test(PET));

/* ---- no emojis just for decoration (2026-10-10, Cam: "remove unnecessary emojis for like navigation bar, chest menu and
   anywhere they are not adding value") -- the ones that say something stay: ✓ done, ✕ close, 🔒 locked, ♥ health, 🪙 coins,
   ❗ a quest ready, ☀/🌙 day and night creatures, the pyramid's chamber marks, ✨ rare breeding, the celebrations ---- */
{
  const deco = /[🗺🏡🎒🗃⛵🏝🧭🔎🔨🚪🏺🌱🏪⛏📍]/u, code = (src) => src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const busyMarks = /\{gather: "⛏", hunt: "⚔", explore: "🧭", pet: "🐾"\}/;
  const strip = (src) => code(src).replace(busyMarks, "").replace(/\(m\) => \["[^"]+",/g, "").replace(/x\.kind === "egg" \? "🥚" : x\.kind === "spot" \? "📍" : "💰"/g, "");
  ok("no decorative emojis in the navigation bar, the chest window, buttons and status lines", !deco.test(strip(GAME)) && !deco.test(strip(PET)),
     (strip(PET) + strip(GAME)).split("\n").filter((l) => deco.test(l)).map((l) => l.trim().slice(0, 80)).join(" || "));
  ok("  the ones that say something stay", /🔒/.test(PET) && /🪙/.test(PET) && /❗/.test(PET) && /✓/.test(PET));
}

/* ---- the Overflow chest (2026-10-10 audit, I-4): saves from before the smaller bags lose nothing ---- */
{
  const s = fresh(); delete s.overflowed; s.v = 1; s.bagSize = "rucksack";
  const ids = Object.keys(C.ITEMS).filter((k) => !C.ITEMS[k].bagSize && !C.ITEMS[k].unid && !C.ITEMS[k].tool && !C.ITEMS[k].gear && !C.ITEMS[k].kit).slice(0, 50);
  ids.forEach((k, i) => { s.bag[k] = i === 0 ? 1221 : 3; });
  const tot = (o) => Object.values(o || {}).reduce((a, v) => a + (v > 0 ? v : 0), 0), before = tot(s.bag);
  const y = C.advance(s, T0);
  ok("an over-full bag is trimmed once into an Overflow chest: back within its kinds and stacks, nothing lost",
     C.bagUsed(y) <= C.bagCap(y) && Object.values(y.bag).every((n) => !(n > C.stackCap(y))) && tot(y.bag) + tot(y.overflow) === before && y.overflowed,
     [C.bagUsed(y), C.bagCap(y), tot(y.bag) + tot(y.overflow), before].join());
  ok("  the diary explains it; it runs only once", y.log.some((e) => /Overflow chest in your store room/.test(e.text)) && JSON.stringify(C.advance(y, T0 + 1000).overflow) === JSON.stringify(y.overflow));
  const first = Object.keys(y.overflow)[0];
  let r = C.act(y, "withdraw", {item: first, n: "all", from: "overflow"}, T0);
  ok("  you take things out of it (only out)", r.ok || /full|room/.test(r.error), r.error);
  const one = fresh(); one.overflow = {flint: 2}; one.overflowed = true;
  r = C.act(one, "withdraw", {item: "flint", n: "all", from: "overflow"}, T0);
  ok("  ...gone once empty", r.ok && !r.state.overflow && r.state.bag.flint === 2 && /It's empty now/.test(r.message || r.state.log[0].text));
  ok("  and a fresh game never gets one", !fresh().overflow);
}
/* ---- a full stack (2026-10-10 audit, I-5): said once, shown on the trip; the trip carries on for the xp ---- */
{
  const s = fresh(); const sp = C.SKILLS.foraging.spots.find((x) => x.id === "hedgerow"), main = sp.loot[0][0];
  s.bag = {}; Object.keys(C.ITEMS).filter((k) => !C.ITEMS[k].bagSize && !C.ITEMS[k].unid && !C.ITEMS[k].tool && k !== main && !C.ITEMS[k].gear).slice(0, C.BAG_START - 1).forEach((k) => { s.bag[k] = 1; });
  s.bag[main] = C.stackCap(s) - 2;                                       // the last slot, nearly full
  const y = C.advance(C.act(s, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.3}, T0).state, T0 + HOUR);
  const said = y.log.filter((e) => /Your bag is full .*no room for more /.test(e.text));   // (B1: whichever find didn't fit first)
  ok("when the spot's main find won't fit (the bag full): the diary says so once, the trip shows it, and you keep earning xp",
     !!y.player.job && y.bag[main] === C.stackCap(y) && said.length === 1 && C.playerView(y, T0 + HOUR).job.full === C.ITEMS[main].name && y.player.job.xp > 100);
  const s2 = fresh(); s2.bag = {mushroom: 1};
  const y2 = C.advance(C.act(s2, "trip", {skill: "foraging", spot: "hedgerow", roll: 0.3}, T0).state, T0 + 10 * 60e3);
  ok("  a side find isn't flagged", !!y2.player.job && !C.playerView(y2, T0 + 10 * 60e3).job.full);
  // B1 (2026-10-19): a find that isn't the spot's main one says so too -- twigs at the Apple trees without a hatchet
  const s3 = fresh(); s3.bag = {}; Object.keys(C.ITEMS).filter((k) => !C.ITEMS[k].bagSize && !C.ITEMS[k].unid && !C.ITEMS[k].tool && !C.ITEMS[k].gear && k !== "twigs").slice(0, C.BAG_START).forEach((k) => { s3.bag[k] = 1; });
  delete s3.player.tools.lumbering;
  const t3 = C.act(s3, "trip", {skill: "lumbering", spot: "prunings", roll: 0.3}, T0), y3 = t3.ok && C.advance(t3.state, T0 + 10 * 60e3);
  ok("  a full bag with no room for twigs (no hatchet, Apple trees): the trip says \"bag full\" -- the pop-up's cue (B1)", !!y3 && C.playerView(y3, T0 + 10 * 60e3).job.full === "Twigs"
     && y3.log.filter((e) => /Your bag is full/.test(e.text)).length === 1, t3.error || (y3 && JSON.stringify(y3.player.job && y3.player.job.full)));
  ok("  the trip card, the region's live list and the top bar say \"bag full\"", /Bag full: no more/.test(PET) && /bag full: no more/.test(PET) && /j\.full \? "bag full"/.test(GAME));
}

/* ---- the pack pet (2026-10-10 audit, H-2 / PET-1) ---- */
{
  const withPet = (species, lvl, away) => { const s = fresh(); s.pet = {id: "p1", species, colour: 0, hatchAt: T0 - 1000, at: T0, xp: C.XP[lvl || 1], s: {full: 80, happy: 80, energy: 80, clean: 80, health: 100}}; if (away) s.pet.away = {area: "farmyard"}; return s; };
  const base = fresh();
  ok("your companion carries part of the load: small +3 kinds/+50, medium +6/+100, large +10/+200",
     C.bagCap(withPet("frog")) === C.bagCap(base) + 3 && C.stackCap(withPet("frog")) === C.stackCap(base) + 50
     && C.bagCap(withPet("fox")) === C.bagCap(base) + 6 && C.bagCap(withPet("horse")) === C.bagCap(base) + 10 && C.stackCap(withPet("horse")) === C.stackCap(base) + 200);
  ok("  a kind more every 5 levels", C.bagCap(withPet("frog", 10)) === C.bagCap(base) + 5);
  ok("  not while it's away on an expedition, or still an egg", C.bagCap(withPet("horse", 1, true)) === C.bagCap(base)
     && (() => { const e = withPet("horse"); e.pet.hatchAt = T0 + 1e9; return C.bagCap(e) === C.bagCap(base); })());
  ok("  every species has a size", Object.keys(C.SPECIES).every((k) => ["small", "medium", "large"].includes(C.sizeOf(k))));
  ok("  the bag and pet pages say what it carries", /carries \$\{pk\.kinds\} (bag )?slots and \+\$\{pk\.stack\} a stack/.test(PET));
}

/* ---- duplicate pets (2026-10-10 audit, H-3 / PET-4) ---- */
{
  const pet = (id, species, colour) => ({id, species, colour, hatchAt: T0 - 1e6, at: T0, xp: 40, s: {full: 80, happy: 80, energy: 80, clean: 80, health: 100}});
  const s = fresh(); s.pet = pet("p0", "cat", "ginger"); s.den = [pet("p1", "frog", "lilac"), pet("p2", "frog", "lilac"), pet("p3", "frog", "green"), pet("p4", "bunny", "pink")];
  const v = C.petsView(s, T0);
  ok("only pets you have more than one of can be merged or released (never the companion)", v.filter((p) => p.dupe).map((p) => p.id).join() === "p1,p2,p3");
  let r = C.act(s, "petmerge", {id: "p2", into: "p1"}, T0);
  ok("  merge: the duplicate is gone, the other gains a star and half its experience", r.ok && r.state.den.length === 3 && r.state.den.find((p) => p.id === "p1").stars === 1 && r.state.den.find((p) => p.id === "p1").xp === 60, r.error);
  ok("  a star adds 10% to the companion boost and a kind carried", (() => { const y = JSON.parse(JSON.stringify(r.state)); const f = y.den.find((p) => p.id === "p1"); const b0 = C.bagCap(y); y.den.push(y.pet); y.pet = f; y.den.splice(y.den.indexOf(f), 1);
    return C.bagCap(y) === b0 - 3 + 3 + 1 && C.packOf(y).kinds === 4; })());
  r = C.act(r.state, "petrelease", {id: "p3"}, T0);
  ok("  release: tokens by rarity (green frog: uncommon, 10)", r.ok && r.state.petTokens === 10 && !r.state.den.some((p) => p.id === "p3"));
  ok("  your last of a kind can't go", /only have one/.test(C.act(r.state, "petrelease", {id: "p1"}, T0).error || ""));
  r.state.petTokens = 3;
  ok("  the token shop sells pet things for tokens", C.act(r.state, "tokenbuy", {item: "treat"}, T0).ok && !C.act(r.state, "tokenbuy", {item: "ironpetcoat"}, T0).ok && C.TOKEN_SHOP.length >= 10);
  const m = fresh(); m.pet = pet("p0", "cat", "ginger"); m.den = [pet("p1", "frog", "lilac"), pet("p2", "frog", "lilac")]; m.den[0].stars = C.STAR_MAX;
  ok("  up to 5 stars", /already has 5 stars/.test(C.act(m, "petmerge", {id: "p2", into: "p1"}, T0).error || ""));
  ok("  the Pets page has Merge, Release and the token shop, and asks first", /pp-merge"/.test(PET) && /pp-release-dupe/.test(PET) && /Pet token shop/.test(PET) && /askYes\(`Release/.test(PET));
}

/* ---- hunting and the skill pages go through the world too (2026-10-10 audit, H-5) ---- */
ok("the Hunting page shows only the ground you're at (or last hunted), with no Hunt here buttons for elsewhere",
   /grounds\.filter\(\(g\) => sess && g\.id === sess\.hunt\)/.test(PET) && !/class="btn btn-sm btn-primary pp-hunt"/.test(PET) && !/travel to a region on the Map and press <b>Hunt here<\/b>/.test(PET));   // (the explaining line went, 2026-10-20)
ok("  a skill's page is a guide: a card says which region the place is in, and starts nothing",
   /travel there on the Map to/.test(PET) && !/const r = await act\("trip", \{skill: k, spot: b\.dataset\.spot/.test(PET));

/* ---- painted item icons drop in (2026-10-10 audit, H-6) ---- */
{
  const html = fs.readFileSync(path.join(APP, "ui", "pet", "index.html"), "utf8"), man = fs.readFileSync(path.join(APP, "ui", "pet", "art", "icons", "manifest.js"), "utf8");
  const listed = JSON.parse((man.match(/window\.PET_ICONS = (\{.*\});/) || [0, "{}"])[1]);
  ok("a painted icon (art/icons/<id>.webp, listed in the manifest) replaces the pixel one; the rest stay pixel",
     /window\.PET_ICONS && window\.PET_ICONS\[name\]\) return "art\/icons\/" \+ name \+ "\.webp"/.test(PET) && html.indexOf("art/icons/manifest.js") < html.indexOf("pet.js")
     && Object.keys(listed).every((id) => (C.ITEMS[id] || /^(obj_[a-z]+|heart|tome|starteregg|specialegg|bredegg|coastegg|poop)$/.test(id) || /^(spec|talent)_[a-z0-9]+$/.test(id)) && fs.existsSync(path.join(APP, "ui", "pet", "art", "icons", id + ".webp"))));
  ok("  tools/cut_icon_sheet.py cuts a Gemini sheet into icons", fs.existsSync(path.join(APP, "tools", "cut_icon_sheet.py")));
  const plan = fs.readdirSync(path.join(APP, "tools", "icon_sheets")).filter((f) => f.endsWith(".txt")).map((f) => fs.readFileSync(path.join(APP, "tools", "icon_sheets", f), "utf8")).join("\n");
  const planned = [].concat(...plan.split("\n").filter((l) => /^\d+\s*(\[\d+x\d+\])?\s*(\{[^}]*\})?\s*:/.test(l)).map((l) => l.split("#")[0].split(":")[1].split(",").map((x) => x.trim()).filter((x) => x && x !== "-")));
  ok("  every icon sheet (done and planned) names real items, each once, and between them they cover every item",
     planned.every((id) => C.ITEMS[id] || /^(obj_[a-z]+|heart|tome|starteregg|specialegg|bredegg|coastegg|poop)$/.test(id) || /^talent_[a-z0-9]+$/.test(id) || /^spec_[a-z]+$/.test(id))   /* (+ the talent tree's badges, 2026-10-17; the specials', V18) */ && new Set(planned).size === planned.length && Object.keys(C.ITEMS).every((id) => planned.includes(id)),
     planned.filter((id) => !C.ITEMS[id] && !/^talent_/.test(id) && !/^spec_/.test(id) && !/^obj_/.test(id)).concat(Object.keys(C.ITEMS).filter((id) => !planned.includes(id))).slice(0, 10).join(", "));
}

/* ---- painted pets (2026-10-10) ---- */
{
  const dir = path.join(APP, "ui", "pet", "art", "pets"), man = fs.readFileSync(path.join(dir, "manifest.js"), "utf8");
  const pics = JSON.parse((man.match(/window\.PET_PICS = (\{.*\});/) || [0, "{}"])[1]);
  const looks = [].concat(...Object.keys(C.SPECIES).map((k) => (C.SPECIES[k].colours || []).map((c) => k + "/" + c)));
  ok("every pet look has a painted portrait, side view and sleeper", looks.every((k) => pics[k] && pics[k].a && pics[k].side && pics[k].sleep
     && ["a", "side", "sleep"].every((p) => fs.existsSync(path.join(dir, k.replace("/", "-") + "-" + p + ".webp")))), looks.filter((k) => !pics[k] || !pics[k].sleep).join(", "));
  ok("  every picture of a pet uses its portrait (asleep: the sleeper); the room its side view; a reskinned pet keeps its own colours",
     /const painted = paintedPet\(species, colour, mood === "asleep" \? "sleep" : "a", skin\)/.test(PET) && /paintedPet\(v\.species, v\.colour, v\.asleep \? "sleep" : "side", v\.skin\)/.test(PET)
     && /if \(skin \|\| modSkin\(species, colour, null\)\) return "";/.test(PET) && fs.readFileSync(path.join(APP, "ui", "pet", "index.html"), "utf8").includes("art/pets/manifest.js"));
}

/* ---- painted creatures (2026-10-10) ---- */
{
  const dir = path.join(APP, "ui", "pet", "art", "creatures"), man = fs.readFileSync(path.join(dir, "manifest.js"), "utf8");
  const pics = JSON.parse((man.match(/window\.MONSTER_PICS = (\{.*\});/) || [0, "{}"])[1]);
  // (2026-10-16, Battle Re-work Part 13) a new creature waits on a planned sheet -- "(not painted yet" on the line above it in
  // tools/creature_sheets/plan.txt -- with a pixel stand-in, as items do on their icon sheets
  const artOf = () => { const c2 = {window: {}, console}; vm.createContext(c2); vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petart.js"), "utf8"), c2); return c2.window.PetArt || c2.PetArt; };
  const planLines = fs.readFileSync(path.join(APP, "tools", "creature_sheets", "plan.txt"), "utf8").split("\n");
  const waiting = [].concat(...planLines.map((l, i) => i && /not painted yet/.test(planLines[i - 1]) && /^\d+\s*:/.test(l) ? l.split(":")[1].split("#")[0].split(",").map((x) => x.trim()) : []));
  ok("every creature has a painted picture (or waits on a planned sheet, drawn in pixels till then)", Object.keys(C.MONSTERS).every((id) => (pics[id] && fs.existsSync(path.join(dir, id + ".webp"))) || (waiting.includes(id) && artOf().monster(id))),
     Object.keys(C.MONSTERS).filter((id) => !pics[id] && !waiting.includes(id)).join(", "));
  ok("  used for every creature picture (stored facing left, never mirrored)",
     /if \(window\.MONSTER_PICS && window\.MONSTER_PICS\[id\]\) return "art\/creatures\/" \+ id \+ "\.webp"/.test(PET) && fs.readFileSync(path.join(APP, "ui", "pet", "index.html"), "utf8").includes("art/creatures/manifest.js"));
}

/* ---- the last art: the player, the top bar and bench icons, eggs, the mess (2026-10-10) ---- */
{
  const dir = path.join(APP, "ui", "pet", "art", "player"), man = fs.readFileSync(path.join(dir, "manifest.js"), "utf8");
  const pics = JSON.parse((man.match(/window\.PLAYER_PICS = (\{.*\});/) || [0, "{}"])[1]);
  const looks = []; for (let s = 0; s < 3; s++) for (let h = 0; h < 5; h++) for (let o = 0; o < 4; o++) looks.push(`${s}-${h}-${o}`);
  ok("every look (3 skins x 5 hair x 4 tunics) has a painted portrait and a fighting stance", looks.every((k) => pics[k] && pics[k].a && pics[k].fight), looks.filter((k) => !pics[k] || !pics[k].fight).join(", "));
  // villagers keep these looks; you are a young man or a young woman since 2026-10-11 (test_pet_bodies.js)
  ok("  villagers use them; a reskinned look keeps its pixels; you fight as your body", /const painted = paintedLook\(lk, pose \|\| "a", skin\)/.test(PET) && /youHTML\(pv\.look, "fight", pv\.gear/.test(PET)
     && fs.readFileSync(path.join(APP, "ui", "pet", "index.html"), "utf8").includes("art/player/manifest.js"));
  const icons = JSON.parse((fs.readFileSync(path.join(APP, "ui", "pet", "art", "icons", "manifest.js"), "utf8").match(/window\.PET_ICONS = (\{.*\});/) || [0, "{}"])[1]);
  ok("  the top bar, bench and place icons, the tome, the eggs and the mess are painted",
     ["obj_sun", "obj_house", "obj_map", "obj_village", "obj_furnace", "obj_anvil", "obj_bench", "obj_tanner", "obj_fletch", "obj_herbs", "obj_gems", "obj_kitchen", "obj_compost", "obj_wheel", "obj_chest", "heart", "tome", "starteregg", "specialegg", "bredegg", "coastegg", "poop"].every((k) => icons[k]));
}

ok("the pet's room is painted (and the bed, toy box and rug in it)",
   fs.existsSync(path.join(APP, "ui", "pet", "art", "petroom.webp")) && /petImage\("art\/petroom\.webp"\)/.test(PET) && /placed\("petbed"/.test(PET));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
