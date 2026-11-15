/* The cart (2026-10-11, Cam: "a cart (which you can sell straight to the merchant straight from all the estate storage and
   bag) you send it off and in 4 hours receive the money when the cart comes back. Later you can upgrade the cart, get a
   horse etc." -- "Marlows full price" -- "happy with proposed cart tiers"). Run: node test/test_pet_cart.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
// where places are painted: art/places.js (2026-10-15, the place editor writes it)
const PLACES = (() => { const t = fs.readFileSync(path.join(APP, "ui", "pet", "art", "places.js"), "utf8"), at = t.indexOf("\nwindow.SCENE_PLACES = ");
  return JSON.parse(t.slice(at + "\nwindow.SCENE_PLACES = ".length).trim().replace(/;$/, "")); })();
const sameArr = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const PET = fs.readFileSync(path.join(APP, "ui", "pet", "pet.js"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const T0 = Date.UTC(2026, 9, 11, 2), HOUR = 3600e3;
const fresh = () => { const s = C.advance(C.empty(), T0); s.player.made = true; return s; };
const go = (s, a, o, t) => C.act(s, a, o || {}, t || T0);
const built = () => { const s = fresh(); s.coins = 4000; s.player.skills.construction = 1e6; s.bag.plank = 40; s.bag.ironbar = 10; return go(s, "cartbuild").state; };

/* ---- the tiers ---- */
{
  ok("hand cart, pony cart, wagon, merchant's wagon: 4/3/2/2 hours, 10/15/25/40 kinds, +10% for the last",
     C.CART.hours.slice(1).join() === "4,3,2,2" && C.CART.kinds.slice(1).join() === "10,15,25,40" && C.CART.bonus[4] === 1.1);
  const s = fresh(); s.coins = 4000; s.bag.plank = 40; s.bag.ironbar = 10;
  ok("a cart shed needs Construction 12", !go(s, "cartbuild").ok);
  const b = built();
  ok("  built: a hand cart, with Construction xp; the coins and materials are spent", b.cart.tier === 1 && b.coins === 0 && !b.bag.plank && b.player.skills.construction > 1e6);
  b.coins = 1e6; b.bag.hardplank = 30; b.bag.steel = 10;
  const r = go(b, "cartbuild");
  ok("the pony cart waits for a pony from the Farm's Stable", !r.ok && /pony in your Stable/.test(r.error), r.error);
  ok("  and says so on its card", /pony in your Stable/.test(C.cartView(b, T0).next.lock));
}

/* ---- loading and selling, at Marlow's full price ---- */
{
  let s = built();
  s.bag.bronzehelm = 3; s.bag.bronzesword = 2; s.player.gear.weapon = "bronzesword"; s.storage = {copper: 500}; s.recycle = {tier: 1, storeTier: 1, lots: [], mats: {tin: 40}};
  let r = go(s, "cartload", {id: "bronzehelm", from: "bag", n: "all"}); s = r.state;
  ok("load from the bag", r.ok && !s.bag.bronzehelm, r.error);
  r = go(s, "cartload", {id: "copper", from: "chests", n: "all"}); s = r.state;
  ok("  from the chests", r.ok && !s.storage.copper, r.error);
  r = go(s, "cartload", {id: "tin", from: "recycled", n: "all"}); s = r.state;
  ok("  and from the recycled materials", r.ok && !s.recycle.mats.tin, r.error);
  r = go(s, "cartload", {id: "bronzesword", from: "bag", n: "all"});
  ok("  but never the one you're using: of 2 swords, 1 goes", r.ok && r.state.bag.bronzesword === 1 && r.state.cart.load.bronzesword.bag === 1, r.error);
  s = r.state;
  const want = C.sellFor("bronzehelm", 3, 1) + C.sellFor("copper", 500, 1) + C.sellFor("tin", 40, 1) + C.sellFor("bronzesword", 1, 1);
  ok("the cart's worth is exactly what Marlow pays", C.cartView(s, T0).total === want, C.cartView(s, T0).total + " vs " + want);
  r = go(s, "cartsend"); s = r.state;
  ok("send it: away 4 hours", r.ok && s.cart.out && s.cart.out.back === T0 + 4 * HOUR && !Object.keys(s.cart.load).length, r.error);
  ok("  one trip at a time", !go(s, "cartsend").ok);
  const coins = s.coins;
  ok("  no coins before it's back", C.advance(s, T0 + 3.9 * HOUR).coins === coins);
  const back = C.advance(s, T0 + 4 * HOUR);
  ok("  back after 4 hours with Marlow's price", back.coins === coins + want && !back.cart.out && back.log.some((e) => /The cart's back from Marlow/.test(e.text)), back.coins - coins);
}

/* ---- taking off, limits, and what never goes ---- */
{
  let s = built(); s.bag.bronzehelm = 3; s.storage = {copper: 50};
  s = go(s, "cartload", {id: "bronzehelm", from: "bag", n: "all"}).state;
  s = go(s, "cartload", {id: "copper", from: "chests", n: "all"}).state;
  const r = go(s, "cartunload", {id: "copper"});
  ok("take something off: it goes back where it came from", r.ok && r.state.storage.copper === 50 && !r.state.cart.load.copper, r.error);
  s = built(); s.storage = {};
  Object.keys(C.ITEMS).filter((k) => !C.ITEMS[k].crate && !C.ITEMS[k].key && !C.ITEMS[k].egg && !C.ITEMS[k].learn && !C.ITEMS[k].glyph && !C.ITEMS[k].ageUp).slice(0, 11).forEach((k) => { s.storage[k] = 1; });
  Object.keys(s.storage).slice(0, 10).forEach((k) => { s = go(s, "cartload", {id: k, from: "chests", n: "all"}).state; });
  ok("10 kinds a load for a hand cart", !go(s, "cartload", {id: Object.keys(s.storage)[0], from: "chests", n: "all"}).ok);
  s = built(); const keyId = Object.keys(C.ITEMS).find((k) => C.ITEMS[k].key), crate = Object.keys(C.ITEMS).find((k) => C.ITEMS[k].crate);
  s.bag[keyId] = 1; s.bag[crate] = 1; s.bag.exoticegg = 1;
  ok("keys, crates and eggs never go on the cart", ["keyId", "crate", "exoticegg"].map((x) => x === "keyId" ? keyId : x === "crate" ? crate : x).every((k) => !go(s, "cartload", {id: k, from: "bag", n: "all"}).ok));
  s = built(); s.bag.copper = 5; s.player.island = "desert";
  ok("only at home", !go(s, "cartload", {id: "copper", from: "bag", n: "all"}).ok);
  ok("no cart until you build the shed", !go(fresh(), "cartsend").ok);
  ok("a game without a cart plays as before (no cart state made by time passing)", !("cart" in C.advance(fresh(), T0 + 30 * HOUR)));
}

/* ---- the screen ---- */
{
  ok("the Cart shed is on the estate, beside the Storeroom -- painted on since Cam's repaint (2026-10-12), so no drawn chip", sameArr(PLACES.estate.cart, {at: [1830, 817, 270, 66], o: [1830, 980]}) && PET.includes('extra: [["cart", "Cart shed"]]'));
  ok("  it opens its own sheet", PET.includes('if (key === "cart") return cartHTML(') && PET.includes("wireCart(card);"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
