  // ---- a boss's own gear (2026-10-11, Cam: "Make beating the boss necessary to unlock the bosses armour set. Maybe 5 defeats
  //      to unlock its armour") -- a set made from a boss's trophy (Gideon's sly fur, Billy's ram horn, Jack's hare foot,
  //      Bambi's antler, Snapjaw's shell, Grizz's claws, the Basilisk's scales) can't be made until you've beaten that boss
  //      five times. Worked out from the data: a material only one boss drops, and no bench or gathering spot gives, is that boss's.
  var BOSS_GEAR_WINS = 5;
  var BOSS_MAT = null;                             // material -> hunting ground, for materials only a boss drops
  function bossMats() {
    if (BOSS_MAT) return BOSS_MAT;
    BOSS_MAT = {};
    var by = {}, elsewhere = {};                   // what a bench makes, or a gathering spot gives, isn't a boss's trophy
    Object.keys(MONSTERS).forEach(function (m) { (MONSTERS[m].drops || []).forEach(function (d) { (by[d[0]] = by[d[0]] || []).push(m); }); });
    Object.keys(WORKSHOPS).forEach(function (w) { (WORKSHOPS[w].recipes || []).forEach(function (r) { elsewhere[r.make] = true; }); });
    Object.keys(SKILLS).forEach(function (k) { ((SKILLS[k] && SKILLS[k].spots) || []).forEach(function (sp) {
      (sp.loot || []).forEach(function (l) { elsewhere[l[0]] = true; }); if (sp.rare) elsewhere[sp.rare] = true; }); });
    HUNT_ORDER.forEach(function (g) {
      var boss = HUNTS[g].boss;
      ((MONSTERS[boss] && MONSTERS[boss].drops) || []).forEach(function (d) { if (by[d[0]].length === 1 && !elsewhere[d[0]] && ITEMS[d[0]] && !ITEMS[d[0]].egg) BOSS_MAT[d[0]] = g; });
    });
    return BOSS_MAT;
  }
  /** The ground whose boss a recipe's gear comes from, or "". */
  function bossGearGround(rec) {
    if (!rec || !ITEMS[rec.make] || !ITEMS[rec.make].gear) return "";
    var mats = bossMats(), g = "";
    Object.keys(rec.needs || {}).forEach(function (k) { if (mats[k]) g = mats[k]; });
    return g;
  }
  /** Every piece of gear made from a ground's boss trophy. */
  function bossGearSet(ground) {
    var out = [];
    Object.keys(WORKSHOPS).forEach(function (w) { (WORKSHOPS[w].recipes || []).forEach(function (r) { if (bossGearGround(r) === ground && out.indexOf(r.make) < 0) out.push(r.make); }); });
    return out;
  }
  /** Why a recipe can't be made yet because of its boss ("" if it can). */
  function bossLock(s, rec) {
    var g = bossGearGround(rec);
    if (!g || (s && s.dev && s.dev.infinite)) return "";
    var wins = ((s && s.hunt && s.hunt[g]) || {}).wins || 0;
    return wins >= BOSS_GEAR_WINS ? "" : "Beat " + MONSTERS[HUNTS[g].boss].name + " " + BOSS_GEAR_WINS + " times first (" + wins + "/" + BOSS_GEAR_WINS + ")";
  }
