// Store prices against what it costs to gather or make the thing (2026-10-17, Cam: "Stores should price up their good so
// they would cost another 1 and a half on top of the costed materials to make ... do not take away the benefit of gathering,
// foraging or making the items"). For every item a store sells: its MATERIALS in coins -- the cheapest recipe's materials at
// what they sell for, plus the bench's fee (or, for a thing nobody makes, the thing itself at its value) -- the price the rule
// asks for (x 2.5), the price the store charges now, and the most any buyer in the game pays for it (no buy-low-sell-high).
// Run: node tools/balance/store_prices.js [--all]   (--all: every row, not only the ones off the rule)
const C = require("./core.js");
const RULE = 2.5;
/** Coins of materials behind one `id`: the cheapest way to make it, else its own value. */
const memo = {};
function materials(id, depth) {
  if (id in memo) return memo[id];
  if ((depth || 0) > 6) return C.priceOf(id);
  memo[id] = C.priceOf(id);                                          // (a loop in the recipes falls back to the value)
  let best = Infinity, how = "its value";
  for (const w of C.WORKSHOP_ORDER) {
    if (w === "alchemist" || w === "merchant") continue;              // the Alchemist turns lots into one: not "making"
    for (const r of C.WORKSHOPS[w].recipes) {
      if (r.make !== id) continue;
      let c = (r.fee || 0);
      for (const [n, q] of Object.entries(r.needs || {})) c += materials(n, (depth || 0) + 1) * q;
      c /= (r.n || 1);
      if (c < best) { best = c; how = w; }
    }
  }
  const out = best < Infinity ? best : C.priceOf(id);
  memo[id] = out; memo[id + "@"] = best < Infinity ? how : "its value";
  return out;
}
/** The most anyone pays you for it: Marlow (and the other buyers) and the Marketplace with the best class perk. */
function bestSell(id) {
  let m = C.eachFor ? C.eachFor(id, 1) : C.priceOf(id);
  if (C.MARKET) for (const st of C.MARKET.stores) if (C.storeBuys(st, id)) for (const cls of Object.keys(C.CLASSES)) m = Math.max(m, C.sellEach({cls, skills: {}}, st, id));
  return m;
}
const rows = [];
const T = Date.UTC(2026, 9, 18, 12);
const shops = ["merchant", "travelling"].concat(Object.keys(C.ISLE_STOCK || {}));
for (const sh of shops) for (const [id, price] of C.stockFor(sh, T)) rows.push({shop: sh, id, price});
for (let d = 0; d < 14; d++) for (const [id, price] of C.stockFor("merchant", T + d * 864e5)) if (!rows.some((r) => r.shop === "merchant" && r.id === id)) rows.push({shop: "merchant", id, price});
if (C.MARKET) for (const st of C.MARKET.stores) for (const id of st.sells) rows.push({shop: "market:" + st.id, id, price: C.buyPrice({cls: "thief", skills: {}}, st, id)});
const all = process.argv.includes("--all");
let off = 0;
console.log("shop                 item                  value  materials (how)          rule x2.5   now   best sell  verdict");
for (const r of rows) {
  const v = C.priceOf(r.id), m = materials(r.id), want = Math.ceil(m * RULE), sell = bestSell(r.id);
  const verdict = r.price < want ? "UNDER the rule" : r.price <= sell ? "SELLS BACK FOR MORE" : r.price > want * 1.6 ? "well over" : "ok";
  if (verdict !== "ok") off++;
  if (all || verdict !== "ok")
    console.log(`${r.shop.padEnd(20)} ${r.id.padEnd(21)} ${String(+v.toFixed(2)).padStart(6)}  ${String(+m.toFixed(2)).padStart(7)} (${memo[r.id + "@"]})`.padEnd(77) +
                `${String(want).padStart(6)} ${String(r.price).padStart(6)} ${String(+sell.toFixed(2)).padStart(9)}  ${verdict}`);
}
console.log(`\n${rows.length} things for sale; ${off} off the rule (x${RULE} the materials, never at or under a sell price)`);
module.exports = {materials, bestSell, RULE};
