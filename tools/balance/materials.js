// Items no recipe, spot, crop or slot uses: sell-only (or dead) content.
const C = require("./core.js");
const used = new Set();
for (const w of C.WORKSHOP_ORDER) for (const r of C.WORKSHOPS[w].recipes) { if (w === "alchemist") continue; Object.keys(r.needs).forEach((k) => used.add(k)); (r.uses || []).forEach((k) => used.add(k)); }
for (const k of C.GATHERING) for (const s of C.SKILLS[k].spots) { if (s.needs) used.add(s.needs); if (s.bait) used.add(s.bait); }
Object.keys(C.CROPS).forEach((c) => used.add(C.CROPS[c].seed)); Object.keys(C.HERBS).forEach((h) => used.add(C.HERBS[h].seed));
Object.keys(C.SUPPLIES).forEach((k) => used.add(k));
// used by actions rather than recipes: farm tools (rake, hoe, watering cans), upgrades, fragments ("combine"), the plant pot
["rake", "hoe", "wateringcan", "steelwateringcan", "plantpot"].forEach((k) => used.add(k));
Object.keys(C.UPGRADES || {}).forEach((u) => Object.keys(C.UPGRADES[u].needs || {}).forEach((k) => used.add(k)));   // hatchery nest, windowsill shelf
Object.keys(C.ITEMS).filter((k) => C.ITEMS[k].frag).forEach((k) => used.add(k));
const dead = [];
for (const [k, v] of Object.entries(C.ITEMS)) {
  if (used.has(k) || v.gear || v.tool || v.food || v.heal || v.brew || v.potion || v.seed || v.herbseed || v.fert || v.furniture || /egg$/.test(k) || v.crate) continue;
  dead.push(k + "(" + C.priceOf(k) + "c)");
}
console.log("SELL-ONLY / no use:", dead.length + "\n" + dead.join(" "));
// never dropped, gathered or made (a fixed list of other sources would go here as they appear)
const { t } = require("./cost.js");
console.log("\nNO SOURCE in the cost model (bosses, farm, pets and eggs come from elsewhere -- check by hand):\n" + Object.keys(C.ITEMS).filter((k) => !(k in t)).join(" "));
