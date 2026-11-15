/* NeuroPets content checks (2026-10-10 audit, H-1 / SE-3): every id the content names exists, levels are in range, ids are
   unique, and everything a recipe needs can be got somewhere. Run: node test/test_pet_content.js [app dir] */
const fs = require("fs"), path = require("path"), vm = require("vm");
const APP = process.argv[2] || path.join(__dirname, "..");
const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, "ui", "pet", "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log("  ok    " + name); } else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -- " + detail : "")); } };
const I = C.ITEMS, missing = [], sources = new Set();
const ref = (id, where) => { if (!I[id]) missing.push(id + " (" + where + ")"); };
const from = (id) => sources.add(id);

// gathering
const spots = [].concat(...C.GATHERING.map((k) => C.SKILLS[k].spots.map((sp) => Object.assign({skill: k}, sp))));
spots.forEach((sp) => {
  sp.loot.forEach(([id]) => { ref(id, "spot " + sp.id); from(id); });
  if (sp.rare) { ref(sp.rare[0], "rare at " + sp.id); from(sp.rare[0]); }
  if (sp.needs) ref(sp.needs, "kit for " + sp.id);
  if (sp.bait) ref(sp.bait, "bait for " + sp.id);
});
// benches, shops
Object.keys(C.WORKSHOPS).forEach((w) => {
  const ws = C.WORKSHOPS[w];
  (ws.recipes || []).forEach((r) => { ref(r.make, w + " makes"); from(r.make); Object.keys(r.needs || {}).forEach((n) => ref(n, w + ":" + r.make)); (r.uses || []).forEach((n) => ref(n, w + ":" + r.make + " uses")); });
});
[C.MERCHANT_STOCK, C.TRAVELLER_STOCK, C.MERCHANT_DAILY].forEach((st) => (Array.isArray(st) ? st : []).forEach((x) => { const id = Array.isArray(x) ? x[0] : x; if (typeof id === "string") { ref(id, "shop"); from(id); } }));
Object.values(C.ISLE_STOCK || {}).forEach((st) => (st || []).forEach((x) => { const id = Array.isArray(x) ? x[0] : x; if (typeof id === "string") { ref(id, "island shop"); from(id); } }));
(C.TOKEN_SHOP || []).forEach(([id]) => { ref(id, "token shop"); from(id); });
// creatures, quests, crates, the farm, the herb table, secrets
Object.keys(C.MONSTERS).forEach((m) => (C.MONSTERS[m].drops || []).forEach((d) => { ref(d[0], "drop of " + m); from(d[0]); }));
Object.keys(C.MASTERY_DROPS || {}).forEach((m) => { ref(C.MASTERY_DROPS[m], "mastery of " + m); from(C.MASTERY_DROPS[m]); });   // the Bestiary's keepsakes (V6)
Object.keys(C.PEOPLE || {}).forEach((r) => (C.PEOPLE[r].quests || []).forEach((q) => {
  Object.keys((q.reward || {}).items || {}).forEach((id) => { ref(id, "reward of " + q.id); from(id); });
  (q.needs || []).forEach((n) => Object.keys(n.bring || {}).forEach((id) => ref(id, "quest " + q.id + " asks for")));
}));
Object.keys(C.CRATES || {}).forEach((k) => (C.CRATES[k].loot || []).forEach((l) => { ref(l[0], "crate " + k); from(l[0]); }));
Object.keys(C.CROPS || {}).forEach((k) => { if (I[k]) from(k); });
const herbs = C.villageView(C.advance(C.empty(), Date.UTC(2026, 9, 10)), Date.UTC(2026, 9, 10)).find((w) => w.identify);
(herbs ? herbs.identify : []).forEach((t) => t.herbs.forEach((h) => from(h.id)));
Object.values(C.SECRETS || {}).forEach((list) => (list || []).forEach((x) => Object.keys(x.items || {}).forEach((id) => { ref(id, "secret"); from(id); })));
// the Farm (2026-10-12): what its animals give, and what the Feed store and the Dairy's churn make
Object.values(C.LIVESTOCK || {}).forEach((L) => { ref(L.gives, "livestock"); from(L.gives); if (L.extra) { ref(L.extra.id, "livestock"); from(L.extra.id); } });
(C.RANCH_FEED || []).concat(C.RANCH_CHURN || [], C.RANCH_CULTURE || [], ...Object.values(C.RANCH_MAKE || {}), ...Object.values(C.RANCH_SLOTS || {})).forEach((m) => { ref(m.make, "the Farm makes"); from(m.make); Object.keys(m.needs).forEach((n) => ref(n, "the Farm:" + m.make)); });
const ELSEWHERE = {stardust: "shooting stars at the observatory"};          // got some other way -- say how
Object.keys(ELSEWHERE).forEach(from);

ok("every item the content names exists", missing.length === 0, missing.slice(0, 12).join(", "));
const lv = spots.filter((sp) => !(sp.level >= 1 && sp.level <= 50)).map((sp) => sp.id)
  .concat(...Object.keys(C.WORKSHOPS).map((w) => (C.WORKSHOPS[w].recipes || []).filter((r) => r.level != null && !(r.level >= 1 && r.level <= 50)).map((r) => w + ":" + r.make)));
ok("every spot and recipe level is between 1 and 50", lv.length === 0, lv.join(", "));
const dup = [];
C.GATHERING.forEach((k) => { const ids = C.SKILLS[k].spots.map((sp) => sp.id); ids.forEach((x, i) => { if (ids.indexOf(x) !== i) dup.push(k + ":" + x); }); });
ok("spot ids are unique within each skill", dup.length === 0, dup.join(", "));
const orphan = new Set();
Object.keys(C.WORKSHOPS).forEach((w) => (C.WORKSHOPS[w].recipes || []).forEach((r) => Object.keys(r.needs || {}).forEach((n) => { if (!sources.has(n)) orphan.add(n + " (" + w + ":" + r.make + ")"); })));
ok("everything a recipe needs can be got somewhere (gathered, made, bought, dropped, grown, identified, found or rewarded)", orphan.size === 0, [...orphan].slice(0, 12).join(", "));
const noName = Object.keys(I).filter((id) => !I[id].name);
ok("every item has a name", noName.length === 0, noName.slice(0, 10).join(", "));
const regions = new Set(Object.keys(C.REGIONS));
const lost = spots.filter((sp) => sp.area && !regions.has(sp.area) && !(C.HUNTS || {})[sp.area]).map((sp) => sp.skill + ":" + sp.id + " in " + sp.area);
ok("every gathering spot is in a real region", lost.length === 0, lost.join(", "));

// petcore.js is built from ui/pet/core/ (H-1): it must match its parts exactly
{
  const cp = require("child_process");
  let code = 0, out = "";
  try { out = cp.execFileSync("python3", [path.join(APP, "tools", "build_petcore.py"), "--check"], {encoding: "utf8"}); } catch (e) { code = e.status; out = String(e.stdout || e); }
  ok("petcore.js is exactly its parts in ui/pet/core/ joined (edit the parts, then python3 tools/build_petcore.py)", code === 0, out.trim());
}
// pet.js is built from ui/pet/screens/ (2026-10-13, audit SE-13): the same rule for the screens
{
  const cp = require("child_process");
  let code = 0, out = "";
  try { out = cp.execFileSync("python3", [path.join(APP, "tools", "build_screens.py"), "--check"], {encoding: "utf8"}); } catch (e) { code = e.status; out = String(e.stdout || e); }
  ok("pet.js is exactly its parts in ui/pet/screens/ joined (edit the parts, then python3 tools/build_screens.py)", code === 0, out.trim());
}

// no part quietly changes what an earlier part defined (H-1): one-offs are folded into the first definition; the rules
// that derive content (the pace, the economy, recipe xp, the conversions) are listed with their reasons
{
  const cp = require("child_process");
  let code = 0, out = "";
  try { out = cp.execFileSync("node", [path.join(APP, "tools", "content_patches.js"), "--check"], {encoding: "utf8"}); } catch (e) { code = e.status; out = String(e.stdout || e); }
  ok("no part changes earlier content except the listed rules (tools/content_patches.json)", code === 0, out.trim());
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
