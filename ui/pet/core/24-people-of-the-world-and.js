  // ---- people of the world, and what they'd like (2026-10-07, Cam: "no 1 and 2 please" -- people
  //      and small quests in each region). One at a time, in order; a quest is a checklist (bring
  //      things, beat a boss, hunt, find secrets, reach a level) and a reward (coins, things, xp).
  var PEOPLE = CONTENT("PEOPLE");
  /** A quest's checklist, against where you are now: [{text, have, need, ok}]. */
  var questProgressHooks = [];                                          // more kinds of need (the story's "finish that quest")
  function questProgress(s, q) {
    var b = s.bag || {}, found = ((s.world || {}).found) || {}, hunt = s.hunt || {};
    var out = [];
    q.needs.forEach(function (n) {
      if (n.bring) Object.keys(n.bring).forEach(function (k) { out.push({ text: ITEMS[k].name, have: Math.min(b[k] || 0, n.bring[k]), need: n.bring[k], item: k }); });
      if (n.boss) out.push({ text: "Beat " + MONSTERS[HUNTS[n.boss].boss].name, have: Math.min(1, (hunt[n.boss] || {}).wins || 0), need: 1 });
      if (n.kills) out.push({ text: "Hunt in the " + HUNTS[n.kills[0]].name, have: Math.min(n.kills[1], (hunt[n.kills[0]] || {}).kills || 0), need: n.kills[1] });
      if (n.secrets) out.push({ text: "Secrets found in the " + REGIONS[n.secrets[0]].name, need: n.secrets[1],
                                 have: Math.min(n.secrets[1], (SECRETS[n.secrets[0]] || []).filter(function (x) { return found[x.id]; }).length) });
      if (n.level) out.push({ text: SKILLS[n.level[0]].name + " level", have: Math.min(n.level[1], levelOf(((s.player || {}).skills || {})[n.level[0]] || 0)), need: n.level[1] });
      questProgressHooks.forEach(function (h) { h(s, n, out); });
    });
    out.forEach(function (x) { x.ok = x.have >= x.need; });
    return out;
  }
  function rewardText(r) {
    var bits = [];
    if (r.coins) bits.push(r.coins + " coins");
    if (r.items) bits.push(itemsText(r.items));
    Object.keys(r.xp || {}).forEach(function (k) { bits.push(r.xp[k] + " " + SKILLS[k].name + " xp"); });
    return bits.join(", ");
  }
  function personView(s, id) {
    var per = PEOPLE[id];
    if (!per) return null;
    var done = (s && s.quests) || {}, q = per.quests.filter(function (x) { return !done[x.id] && questOpen(s, x); })[0];   // a story chapter waits its turn
    var prog = q ? questProgress(s || {}, q) : [];
    return { id: per.id, region: id, name: per.name, look: per.look, says: per.says, done: per.quests.filter(function (x) { return done[x.id]; }).length, total: per.quests.length,
             quest: q ? { id: q.id, name: q.name, text: q.text, story: q.story || 0, needs: prog, reward: rewardText(q.reward), can: prog.every(function (x) { return x.ok; }) || questFree(s), free: questFree(s) && !prog.every(function (x) { return x.ok; }) } : null };
  }
  /** The sandbox's switch: quests hand in without their needs (Cam, PT14 p2: "Sandbox should also have the ability to skip quest
   *  requirements like hunt in the forest 40 times ... Given i am the CEO and play tester"). */
  function questFree(s) { return !!(s && s.dev && s.dev.on && s.dev.questFree); }
  var EXPLORE_TIME = 30 * MIN;
  var SNIFFERS = CONTENT("SNIFFERS");                  // companions with a nose for hidden things
  function world(s) { s.world = s.world || {}; s.world.found = s.world.found || {}; s.world.explored = s.world.explored || {}; s.world.misses = s.world.misses || {}; return s.world; }
  /** Why a region is closed to you ("" if it isn't). */
  function regionLock(s, id) {
    var r = REGIONS[id], n = r && r.needs;
    var where = placeLock(s, id);                                        // on the right island? (2026-10-08)
    if (where) return where;
    if (!n) return "";
    var pl = (s && s.player) || {}, out = [];
    if (n.ship && shipTier(s) < n.ship) out.push("a " + SHIPS[n.ship].name.toLowerCase() + (n.ship === 1 ? " (Old Salt on the Coast helps you build your first)" : " (built at the Shipyard on the Coast)"));
    if (n.item && !((s.bag || {})[n.item] > 0) && !(s.dev && s.dev.infinite)) out.push(aOr(ITEMS[n.item].name.toLowerCase()) + " (" + ITEMS[n.item].from + ")");
    (n.also || []).forEach(function (k) {                                // a rope for the caves (2026-10-09): carried, not used up
      if (!((s.bag || {})[k] > 0) && !(s.dev && s.dev.infinite)) out.push(aOr(ITEMS[k].name.toLowerCase()) + " (" + ITEMS[k].from + ")"); });
    Object.keys(n.skills || {}).forEach(function (k) { if (levelOf((pl.skills || {})[k] || 0) < n.skills[k]) out.push(SKILLS[k].name + " " + n.skills[k]); });
    return out.length ? "Needs " + out.join(" and ") + " " + n.how : "";
  }
  function regionLevel(id) { return REGIONS[id].level || 1; }
  /** The chance an exploration finds the next secret: more after each miss, and with a sniffer. */
  function exploreChance(s, id) {
    var w = world(s), c = 0.35 + 0.15 * (w.misses[id] || 0);
    var p = s.pet;
    if (p && !p.away && SNIFFERS.indexOf(p.species) >= 0) c += 0.15;
    c += 0.05 * researched(s, "maps");                                // old maps from the stacks (2026-10-08)
    return Math.min(1, Math.round(c * 100) / 100);
  }
  function resolveExplore(s, at) {
    var ex = s.player.explore, id = ex.region, w = world(s), r = REGIONS[id];
    delete s.player.explore;
    w.explored[id] = (w.explored[id] || 0) + 1;
    var job = { seed: ex.seed | 0 }, left = (SECRETS[id] || []).filter(function (x) { return !w.found[x.id]; });
    // the eggs are the best thing hidden: they take finding (half the chance)
    if (left.length && rnd(job) < ex.chance * (left[0].kind === "egg" ? 0.5 : 1)) {
      var sec = left[0];                                               // in order: the easier finds first
      w.found[sec.id] = at; w.misses[id] = 0;
      var bits = [];
      if (sec.kind === "cache") {
        if (sec.coins) { s.coins = (s.coins || 0) + sec.coins; bits.push(sec.coins + " coins"); }
        Object.keys(sec.items || {}).forEach(function (k) { if (give(s, k, sec.items[k])) bits.push(itemsText(pick1(k, sec.items[k]))); });
      } else if (sec.kind === "egg") {
        if (give(s, sec.egg, 1, true)) bits.push(aOr(ITEMS[sec.egg].name.toLowerCase()) + " -- put it in the Hatchery");
      } else bits.push("a new place to gather");
      s.lastExplore = { region: id, at: at, found: sec.id };
      note(s, at, "Exploring the " + r.name + ", you found " + sec.name.toLowerCase() + "! " + sec.text + "." + (bits.length ? " (" + bits.join(", ") + ")" : "") +
                  (left.length === 1 ? " That's everything hidden in the " + r.name + "." : ""));
      findPage(s, id, rnd(job), at);                                   // a torn page, sometimes (2026-10-08)
      return;
    }
    if (left.length) w.misses[id] = (w.misses[id] || 0) + 1;
    // nothing hidden this time: a few things from around the region
    var mains = [];
    GATHERING.forEach(function (k) { SKILLS[k].spots.forEach(function (sp) { if (sp.area === id && !sp.essence && !sp.secret && !spotLock(s, k, sp)) mains.push([sp.loot[0][0], 1]); }); });
    var got = {}, n = 2 + Math.floor(rnd(job) * 3);
    for (var i = 0; i < n && mains.length; i++) { var it = pick(job, mains); got[it] = (got[it] || 0) + 1; }
    var herb = rnd(job) < 0.3 ? rollHerb(job, regionLevel(id)) : null;
    Object.keys(got).forEach(function (k) { if (!give(s, k, got[k])) delete got[k]; });
    if (herb && addUnid(s, herb, 1)) got.unidherb = 1;
    s.lastExplore = { region: id, at: at, found: "" };
    note(s, at, "You explored the " + r.name + (left.length ? " but found nothing hidden this time -- you'll know where to look next time" : " -- you know all its secrets now") +
                (Object.keys(got).length ? ". You came back with " + itemsText(got) + "." : "."));
    findPage(s, id, rnd(job), at);
  }
