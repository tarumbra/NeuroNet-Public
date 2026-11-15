// How long each tool lasts (hours of trip) at the hardest spots it can work, and what mending costs.
const C = require("./core.js");
for (const [id, v] of Object.entries(C.ITEMS)) {
  if (!v.tool || v.tool.stone || !C.SKILLS[v.tool.skill]) continue;
  const res = [];
  for (const s of C.SKILLS[v.tool.skill].spots) {
    if (s.essence || (s.toolTier || 0) > v.tool.tier) continue;
    const tot = s.loot.reduce((a, l) => a + l[1], 0); let w = 0;
    for (const [it, q] of s.loot) w += Math.max(0, C.gradeOf(it, s) - v.tool.tier) * q / tot;
    if (w > 0) res.push(s.id + "@" + s.level + "=" + (C.toolDur(id) / w * s.time * v.tool.speed / 3600).toFixed(1) + "h");
  }
  const rc = C.repairCost(id);
  console.log(id.padEnd(15), "tier", v.tool.tier, "dur", C.toolDur(id), "repair", rc ? JSON.stringify(rc.needs) + "+" + rc.fee + "c" : "-", "| lasts:", res.slice(-4).join(" "));
}
