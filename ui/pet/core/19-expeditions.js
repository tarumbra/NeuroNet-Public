  // ---- expeditions --------------------------------------------------------------------
  function pick(job, table) {
    var total = 0, i;
    for (i = 0; i < table.length; i++) total += table[i][1];
    var r = rnd(job) * total;
    for (i = 0; i < table.length; i++) { r -= table[i][1]; if (r < 0) return table[i][0]; }
    return table[table.length - 1][0];
  }
  function chanceFor(s, p, area, supply, now) {
    var a = AREAS[area], m = mastery(p, area);
    var c = a.base + 0.03 * (levelOf(p.xp || 0) - a.level) + (m >= 5 ? 0.2 : 0.04 * (m - 1));
    if (SUPPLIES[supply]) c += SUPPLIES[supply].bonus;
    c += gearSum(p.gear).success;
    if (p.s.happy >= 75) c += 0.05;
    if (p.s.full < 40) c -= 0.1;
    return Math.max(0.05, Math.min(0.95, Math.round(c * 100) / 100));
  }
  function itemsText(map) {
    return Object.keys(map).map(function (k) {
      if (k === "coins") return map[k] + " coin" + (map[k] === 1 ? "" : "s");
      return ITEMS[k] ? ITEMS[k].name.toLowerCase() + (map[k] > 1 ? " ×" + map[k] : "") : k;
    }).join(", ");
  }
