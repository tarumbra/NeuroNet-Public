  // ==== natures, potential and bred colours (2026-10-08, Cam: "a pokemon like feature where pets have certain natures
  //      and pre set starting stats and bonus also female and male. Then when breeding certain pets with certain natures
  //      together i can get a pet with special starting stats, bonuses, special color configurations") ----------------
  // Every pet has q.gene = {sex: "m"|"f", nature, stats: {hp, att, def, agi, knack}, pattern?}. A hatched pet's
  // potential is 0-10 in each; a bred one can reach 15. A nature trades a little of one thing for another; the rare
  // ones (only bred, from the right pair) are better and come with their own colouring.
  var GENE_STATS = CONTENT("GENE_STATS");
  var GENE_NAMES = CONTENT("GENE_NAMES");
  var NATURES = CONTENT("NATURES");
  var NATURE_ORDER = Object.keys(NATURES), COMMON_NATURES = NATURE_ORDER.filter(function (k) { return !NATURES[k].rare; });
  // the colourings only breeding gives (letters as the reskinner's: body, light, stripes/spots, pink, outline, eyes)
  var PATTERNS = CONTENT("PATTERNS");
  var SHIMMER_CHANCE = 0.02, RARE_NATURE_CHANCE = 0.35;
  /** A number from a string (a pet's id): the same pet always gets the same gene. */
  function hashOf(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
  function wildGene(seed) {
    var job = { seed: seed | 0 }, st = {};
    GENE_STATS.forEach(function (k) { st[k] = Math.floor(rnd(job) * 11); });
    return { sex: rnd(job) < 0.5 ? "f" : "m", nature: COMMON_NATURES[Math.floor(rnd(job) * COMMON_NATURES.length)], stats: st };
  }
  function geneOf(q) {
    if (!q) return null;
    if (!q.gene || typeof q.gene !== "object" || !NATURES[q.gene.nature]) q.gene = wildGene(hashOf(String(q.id || "") + "/" + (q.species || "")));
    return q.gene;
  }
  /** Potential above or below the middle (5): an average pet is as it always was; a well-bred one is better. */
  function geneOff(q, k) { return geneStat(q, k) - 5; }
  function natureFx(q, k) { var g = q && q.gene; return g && NATURES[g.nature] ? NATURES[g.nature].fx[k] || 0 : 0; }
  function geneStat(q, k) { var g = q && q.gene; return g && g.stats ? g.stats[k] || 0 : 0; }
  /** A pet's companion knack: added to its skill boost (Knack 15 and a Sage nature: +12.5%). */
  function knackOf(q) { return Math.round((geneOff(q, "knack") * 0.003 + natureFx(q, "knack")) * 1000) / 1000; }
  function rarePair(a, b) {
    for (var k in NATURES) { var f = NATURES[k].from; if (f && ((f[0] === a && f[1] === b) || (f[0] === b && f[1] === a))) return k; }
    return "";
  }
  /** The egg a pair lays: the child's gene and colouring, chosen now (they're in the egg). */
  function childGene(a, b, job) {
    var ga = geneOf(a), gb = geneOf(b), mom = ga.sex === "f" ? ga : gb, dad = ga.sex === "f" ? gb : ga;
    var rare = rarePair(ga.nature, gb.nature), r = rnd(job), nature;
    if (rare && r < RARE_NATURE_CHANCE) nature = rare;
    else if (NATURES[ga.nature].rare && r < 0.25) nature = ga.nature;
    else if (NATURES[gb.nature].rare && r < 0.5) nature = gb.nature;
    else if (ga.nature === gb.nature && r < 0.6) nature = ga.nature;
    else { var r2 = rnd(job); nature = r2 < 0.45 ? mom.nature : r2 < 0.9 ? dad.nature : COMMON_NATURES[Math.floor(rnd(job) * COMMON_NATURES.length)]; }
    var st = {};
    GENE_STATS.forEach(function (k) {
      var v = Math.round((ga.stats[k] + gb.stats[k]) / 2) + Math.floor(rnd(job) * 6) - 2;   // -2 .. +3 on the parents' average
      if (ga.stats[k] >= 10 && gb.stats[k] >= 10) v += 1;                                       // two strong parents: stronger still
      st[k] = Math.max(0, Math.min(15, v));
    });
    var nat = NATURES[nature];
    if (nat.rare && nat.best) st[nat.best] = Math.min(15, st[nat.best] + 2);                // a rare nature's special start
    var pattern = "", rp = rnd(job);
    if (nat.rare && nat.pattern && rp < 0.4) pattern = nat.pattern;
    else if (ga.pattern && ga.pattern === gb.pattern && rp < 0.5) pattern = ga.pattern;
    else if ((ga.pattern || gb.pattern) && rp < 0.25) pattern = ga.pattern || gb.pattern;
    else if (rp > 1 - SHIMMER_CHANCE) pattern = "shimmer";
    var gene = { sex: rnd(job) < 0.5 ? "f" : "m", nature: nature, stats: st, bred: true };
    if (pattern) gene.pattern = pattern;
    return gene;
  }
  /** A pet's gene, for the page. */
  function geneView(q) {
    var g = geneOf(q), nat = NATURES[g.nature];
    return { sex: g.sex, sexName: g.sex === "f" ? "female" : "male", sign: g.sex === "f" ? "♀" : "♂", nature: g.nature, natureName: nat.name, rare: !!nat.rare,
             natureText: natureText(g.nature), stats: GENE_STATS.map(function (k) { return { id: k, name: GENE_NAMES[k], value: g.stats[k], max: g.bred ? 15 : 10 }; }),
             total: GENE_STATS.reduce(function (a, k) { return a + g.stats[k]; }, 0), bred: !!g.bred,
             pattern: g.pattern ? PATTERNS[g.pattern].name : "", knack: knackOf(q) };
  }
  function natureText(k) {
    var fx = NATURES[k].fx, bits = [];
    if (fx.hp) bits.push((fx.hp > 0 ? "+" : "") + Math.round(fx.hp * 100) + "% health");
    if (fx.att) bits.push((fx.att > 0 ? "+" : "") + Math.round(fx.att * 100) + "% attack");
    if (fx.def) bits.push((fx.def > 0 ? "+" : "") + Math.round(fx.def * 100) + "% defence");
    if (fx.dodge) bits.push("+" + Math.round(fx.dodge * 100) + "% dodge");
    if (fx.knack) bits.push("+" + Math.round(fx.knack * 100) + "% to its skill bonus");
    return bits.length ? bits.join(", ") : "Even-tempered: no ups or downs";
  }
  /** What a pair might give, nature-wise -- for the breeding page. */
  function pairGenes(a, b) {
    var ga = geneOf(a), gb = geneOf(b), rare = rarePair(ga.nature, gb.nature);
    return { a: geneView(a), b: geneView(b), sexOk: ga.sex !== gb.sex, rare: rare ? { id: rare, name: NATURES[rare].name, text: natureText(rare), chance: Math.round(RARE_NATURE_CHANCE * 100),
                                                                                      pattern: PATTERNS[NATURES[rare].pattern].name } : null,
             stats: GENE_STATS.map(function (k) { var m = Math.round((ga.stats[k] + gb.stats[k]) / 2), bonus = ga.stats[k] >= 10 && gb.stats[k] >= 10 ? 1 : 0;
               return { id: k, name: GENE_NAMES[k], lo: Math.max(0, m - 2 + bonus), hi: Math.min(15, m + 3 + bonus) }; }) };
  }
  /** The nature book: every rare nature, its pair, whether you've bred one. */
  function natureBook(s) {
    var seen = (s && s.natures) || {};
    return NATURE_ORDER.map(function (k) { var n = NATURES[k];
      return { id: k, name: n.name, rare: !!n.rare, text: natureText(k), from: n.from ? n.from.map(function (x) { return NATURES[x].name; }) : null,
               pattern: n.pattern ? PATTERNS[n.pattern].name : "", seen: !!seen[k] }; });
  }

