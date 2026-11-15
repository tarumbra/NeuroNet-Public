  // ---- new games, and New Game Plus (2026-10-07, Cam: "a new game plus mode which gets unlocked when you beat
  //      the last boss, you start with boosted stats and 3 of your choosen pets") ------------------------------
  var LAST_BOSS = "jungle";                                           // the Basilisk
  function ngUnlocked(s) { return !!(s && s.hunt && s.hunt[LAST_BOSS] && s.hunt[LAST_BOSS].wins > 0); }
  /** A fresh game: a mode, and -- for New Game Plus -- a finished game to bring 3 pets from. */
  function newGame(opts, now) {
    opts = opts || {};
    var s = normal(empty());
    s.mode = MODES[opts.mode] ? opts.mode : "hardcore";
    if (opts.mod && typeof opts.mod === "object") s.mod = cleanMod(opts.mod);
    s.player.at = now || 0;
    var from = opts.from;
    if (from && ngUnlocked(from)) {
      s.ngPlus = (from.ngPlus || 0) + 1;
      // boosted: every skill at level 5, the fighting ones at 15, a purse of coins
      SKILL_ORDER.forEach(function (k) { s.player.skills[k] = Math.max(s.player.skills[k] || 0, XP[["attack", "ranged", "magic", "defence", "hitpoints"].indexOf(k) >= 0 ? 15 : 5]); });
      s.player.hp = maxHp(s.player);
      s.coins = (s.coins || 0) + 2000;
      var pool = [from.pet].concat(from.den || []).filter(function (p) { return p && p.id; });
      var picked = (opts.pets || []).slice(0, 3).map(function (id) { return pool.filter(function (p) { return p.id === id; })[0]; }).filter(Boolean);
      picked.forEach(function (p, i) {
        var q = JSON.parse(JSON.stringify(p));
        q.away = null; q.job = null; q.injury = null; q.asleep = false; q.sick = false; q.at = now || 0;
        if (!s.pet) s.pet = q; else s.den.push(q);
      });
      s.carried = picked.map(function (p) { return who(p); });
      applyLegacy(s, from, opts, now || 0);                            // the class's gift, points, techniques, a mark (Part 12)
    }
    note(s, now || 0, "A new game on the isle -- " + MODES[s.mode].name + (s.ngPlus ? ", New Game Plus " + s.ngPlus + " (the monsters are tougher; you're stronger" +
                       (s.carried && s.carried.length ? ", and " + s.carried.join(", ") + " came with you" : "") + ")" : "") + ".");
    return s;
  }
  /** A mod pack's rules part, checked: rates in range, pets' buffs real. */
  function cleanMod(m) {
    var out = { id: String(m.id || "").slice(0, 60), name: String(m.name || "Mod pack").slice(0, 80), rates: {}, pets: {} };
    Object.keys(MOD_RATES).forEach(function (k) { var r = Number((m.rates || {})[k]); if (r > 0 && r <= 20 && r !== 1) out.rates[k] = Math.round(r * 100) / 100; });
    Object.keys(m.pets || {}).forEach(function (sp) {
      if (!SPECIES[sp]) return;
      var pm = m.pets[sp] || {}, o = {};
      if (Array.isArray(pm.buffs)) o.buffs = pm.buffs.filter(function (b) { return b && (SKILLS[b.skill] || FIGHT_BOOSTS[b.skill]); })
        .slice(0, 4).map(function (b) { return { skill: b.skill, amount: Math.max(0.01, Math.min(1, Number(b.amount) || 0.1)) }; });
      if (pm.colours && typeof pm.colours === "object") o.colours = pm.colours;
      out.pets[sp] = o;
    });
    return out;
  }
  /** A save slot's card: who, what mode, how far. */
  function slotSummary(s, now) {
    if (!s || !s.player || !s.player.made) return null;
    var pv = playerView(normal(s), now);
    return { name: pv.name, mode: modeOf(s), modeName: MODES[modeOf(s)].name, ngPlus: s.ngPlus || 0, combat: pv.combatLevel, total: pv.totalLevel,
             coins: s.coins || 0, pet: s.pet ? who(s.pet) : "", dead: !!(s.player && s.player.dead), ngUnlocked: ngUnlocked(s), mod: s.mod ? s.mod.name : "",
             legacy: legacyOf(s), marks: s.marks || 0,                                        // (Part 12)
             pets: [s.pet].concat(s.den || []).filter(function (p) { return p && p.id; }).map(function (p) { return { id: p.id, name: who(p), kind: kindName(p), level: levelOf(p.xp || 0) }; }),
             last: (s.log && s.log[0] && s.log[0].t) || 0 };
  }
  function pick1(k, n) { var o = {}; o[k] = n; return o; }
  /** What's going on where: {region: ["gather"|"hunt"|"explore"|"pet"]}. */
  function activityByRegion(s) {
    var out = {}, add = function (r, k) { if (r && REGIONS[r]) (out[r] = out[r] || []).push(k); };
    var pl = (s && s.player) || {};
    if (pl.job) {
      if (pl.job.hunt) add(pl.job.hunt, "hunt");
      else { var sp = spotOf(pl.job.skill, pl.job.spot); add(sp && sp.area, "gather"); }
    }
    if (pl.battle && pl.battle.ground) add(pl.battle.ground, "hunt");
    if (pl.explore) add(pl.explore.region, "explore");
    var p = s && s.pet;
    if (p && p.away) Object.keys(REGIONS).forEach(function (r) { if (REGIONS[r].expedition === p.away.area) add(r, "pet"); });
    return out;
  }
  /** The world map: every region, open or not, and how much of it you've found. */
  function worldView(s, now) {
    var acts = activityByRegion(s);
    var w = (s && s.world) || {}, found = w.found || {};
    return { regions: REGION_ORDER.map(function (id) {
               var r = REGIONS[id], sec = SECRETS[id] || [], lock = regionLock(s, id), h = HUNTS[id];
               var pv = personView(s, id);
               return { id: id, name: r.name, blurb: r.blurb, x: r.x, y: r.y, hub: !!r.hub, island: !!r.island, isle: r.isle || "", town: !!r.town, level: r.level || 0, open: !lock, lock: lock,
                        person: pv ? pv.name : "", questReady: !!(pv && pv.quest && pv.quest.can && !lock), questsLeft: pv ? pv.total - pv.done : 0, busy: acts[id] || [],
                        found: sec.filter(function (x) { return found[x.id]; }).length, total: sec.length, boss: h ? h.boss : "",
                        explored: (w.explored || {})[id] || 0 };
             }),
             links: REGION_LINKS,
             // where you are (2026-10-08): "" the main island, or an island; and a voyage under way
             here: islandOf(s), hereName: islandOf(s) ? ISLANDS[islandOf(s)].name : "", hereTown: islandOf(s) ? ISLANDS[islandOf(s)].town : "",
             voyage: s && s.player && s.player.voyage ? { to: s.player.voyage.to, toName: s.player.voyage.to ? ISLANDS[s.player.voyage.to].the : "home",
                                                          endsIn: Math.max(0, Math.ceil((s.player.voyage.until - now) / 1000)) } : null,
             exploring: s && s.player && s.player.explore ? { region: s.player.explore.region, name: REGIONS[s.player.explore.region].name,
                          endsIn: Math.max(0, Math.ceil((s.player.explore.until - now) / 1000)) } : null };
  }
  /** One region, close up: its places, its hunting ground and expedition, its secrets. */
  function landView(s, id, now) {
    var r = REGIONS[id];
    if (!r || r.hub) return null;
    var w = (s && s.world) || {}, found = w.found || {}, pl = (s && s.player) || newPlayer();
    var spots = [];
    GATHERING.forEach(function (k) {
      SKILLS[k].spots.forEach(function (sp) {
        if (sp.area !== id || sp.essence || (sp.secret && !found[sp.secret])) return;
        spots.push({ skill: k, skillName: SKILLS[k].name, id: sp.id, name: sp.name, level: sp.level, main: sp.loot[0][0], lock: spotLock(s, k, sp), secret: !!sp.secret,
                     here: !!(pl.job && !pl.job.hunt && pl.job.spot === sp.id) });
      });
    });
    spots.sort(function (a, b) { return a.level - b.level; });
    var h = HUNTS[id] && !HUNTS[id].tower ? HUNTS[id] : null, cl = combatLevel(pl), a = r.expedition && AREAS[r.expedition];
    var busy = pl.explore ? "You're already exploring the " + REGIONS[pl.explore.region].name + "."
      : pl.job ? "You're out " + (pl.job.hunt ? "hunting" : SKILLS[pl.job.skill] ? SKILLS[pl.job.skill].verb : "gathering") + " -- come home first."
      : pl.battle ? "You're in a fight." : "";
    var lock = regionLock(s, id), secs = SECRETS[id] || [];
    var nextSec = secs.filter(function (x) { return !found[x.id]; })[0];
    return { id: id, name: r.name, blurb: r.blurb, level: r.level || 0, open: !lock, lock: lock, spots: spots,
             hunt: h ? { id: id, name: h.name, level: h.level, open: cl >= h.level, boss: h.boss, bossName: MONSTERS[h.boss].name } : null,
             expedition: a ? { id: r.expedition, name: a.name, level: a.level } : null,
             secrets: secs.map(function (x) { return found[x.id] ? { id: x.id, kind: x.kind, name: x.name, text: x.text, found: true } : { kind: "", found: false }; }),
             found: secs.filter(function (x) { return found[x.id]; }).length, total: secs.length,
             explored: (w.explored || {})[id] || 0, time: EXPLORE_TIME / 1000,
             chance: Math.round((s ? exploreChance(JSON.parse(JSON.stringify(s)), id) : 0.35) * (nextSec && nextSec.kind === "egg" ? 0.5 : 1) * 100) / 100,
             exploring: pl.explore && pl.explore.region === id ? { endsIn: Math.max(0, Math.ceil((pl.explore.until - now) / 1000)) } : null,
             busy: lock || busy, person: personView(s, id), doing: activityByRegion(s)[id] || [], tower: r.tower ? towerView(s) : null,
             job: pl.job ? { hunt: pl.job.hunt || "", skill: pl.job.skill, spot: pl.job.spot, name: pl.job.hunt ? (HUNTS[pl.job.hunt] || {}).name : (spotOf(pl.job.skill, pl.job.spot) || {}).name,
                             count: pl.job.count || 0, endsIn: Math.max(0, Math.ceil((pl.job.until - now) / 1000)) } : null,
             bossReady: h ? (function () { var hl = (s.hunt || {})[id] || { kills: 0, wins: 0 }; return cl >= h.level && hl.kills >= bossNeed(h, hl); })() : false };
  }

