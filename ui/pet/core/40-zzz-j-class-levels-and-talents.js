  // ---- Battle Re-work Part 3: class levels and skill trees (2026-10-15) ----------------------------------------------
  //      Cam: "Skill trees similar to what you would find in diablo should be implemented for each class" -- and (Q2) each
  //      class has its own level, from fighting as that class; switching class starts that class at 1 but keeps your
  //      combat skills. Old saves: the class you are starts at the level of its own combat skill.
  //   - CLASS XP: whatever Attack, Ranged, Magic or Defence xp you earn, your class earns too (Hitpoints doesn't count);
  //   - POINTS: one every TALENT_RULES.pointsEvery class levels, spent in TALENTS -- three branches a class; a node opens
  //     when the points in its branch reach its tier's gate and its parent has a rank; a "choice" pair takes only one;
  //     a branch marked "later" arrives with its class's own part (traps, fury, elements);
  //   - RESPEC: free to class level freeRespecTo, then coins, more each time; two saved BUILDS a class, changed at home.
  var TALENTS = CONTENT("TALENTS");
  var TALENT_RULES = CONTENT("TALENT_RULES");
  var TALENT_NODE = {};
  Object.keys(TALENTS).forEach(function (cls) {
    if (cls === "//") return;
    TALENTS[cls].branches.forEach(function (b) { b.nodes.forEach(function (n) { TALENT_NODE[n.id] = { cls: cls, branch: b, node: n }; }); });
  });
  var CLASS_SKILL = { ranged: "ranged", melee: "attack", magic: "magic" };
  var COMBAT_TRAINING = ["attack", "ranged", "magic", "defence"];
  function classBox(pl, cls) {
    pl.classes = pl.classes || {};
    var c = pl.classes[cls] = pl.classes[cls] || {};
    if (typeof c.xp !== "number") c.xp = 0;
    if (!c.talents || typeof c.talents !== "object") c.talents = {};
    if (!c.builds || typeof c.builds !== "object") c.builds = {};
    if (typeof c.respecs !== "number") c.respecs = 0;
    return c;
  }
  function classLevel(pl, cls) { return levelOf((((pl.classes || {})[cls]) || {}).xp || 0); }
  function talentPoints(pl, cls) { return Math.floor(classLevel(pl, cls) / TALENT_RULES.pointsEvery) + legacyPoints(pl, cls); }   // (+ a legacy's, Part 12)
  function spentIn(talents, branch) { return branch.nodes.reduce(function (a, n) { return a + (talents[n.id] || 0); }, 0); }
  function spentAll(talents) { return Object.keys(talents).reduce(function (a, k) { return a + (talents[k] || 0); }, 0); }
  /** Why a rank can't go on this node now ("" if it can). */
  function talentLock(pl, id) {
    var t = TALENT_NODE[id];
    if (!t) return "There's no talent like that.";
    if (pl.cls !== t.cls) return "That's a " + CLASSES[t.cls].name + "'s talent.";
    if (t.branch.needs === "necro" && !(pl.necro && pl.necro.taught)) return "Necromancy -- Sorceress Nyx teaches it, after you beat her at the mage tower.";   // (Part 13)
    var box = classBox(pl, t.cls), n = t.node, have = box.talents[id] || 0;
    if (have >= n.ranks) return "Already at its top rank.";
    var gate = TALENT_RULES.gates[n.tier] || 0, inB = spentIn(box.talents, t.branch);
    if (inB < gate) return "Spend " + gate + " points in " + t.branch.name + " first (" + inB + " so far).";
    if (n.parent && !(box.talents[n.parent] > 0)) return "Needs " + TALENT_NODE[n.parent].node.name + " first.";
    if (n.choice) {
      var other = t.branch.nodes.filter(function (m) { return m.choice === n.choice && m.id !== id && box.talents[m.id] > 0; })[0];
      if (other) return "You chose " + other.name + " -- it's one or the other.";
    }
    if (spentAll(box.talents) >= talentPoints(pl, t.cls)) return "No points to spend -- a point every " + TALENT_RULES.pointsEvery + " " + CLASSES[t.cls].name + " levels.";
    return "";
  }
  /** Your class's talents, added up (each fx times its rank) and capped. {} without a class. */
  function talentSum(pl) {
    var out = {};
    if (pl && pl.techs && pl.techs.length) addTechniques(pl, out);      // techniques from other classes, at 60% (Part 9)
    if (!pl || !pl.cls || !pl.classes || !pl.classes[pl.cls]) return out;
    var tal = pl.classes[pl.cls].talents || {};
    Object.keys(tal).forEach(function (id) {
      var t = TALENT_NODE[id], r = tal[id] || 0;
      if (!t || t.cls !== pl.cls || !r) return;
      Object.keys(t.node.fx).forEach(function (k) { out[k] = (out[k] || 0) + t.node.fx[k] * r; });
    });
    Object.keys(TALENT_RULES.caps).forEach(function (k) { if (out[k] > TALENT_RULES.caps[k]) out[k] = TALENT_RULES.caps[k]; });
    return out;
  }
  /** A special's cost after your talents. */
  function specCostOf(pl, sp) { return Math.max(1, Math.round(sp.cost * (1 - (talentSum(pl).specCost || 0)))); }
  /** Energy for a fight fought: 10, plus your talents'. */
  function specAfterFight(pl) { pl.spec = Math.min(100, (pl.spec || 0) + 10 + (talentSum(pl).specGain || 0)); }
  /** Combat xp you earned also goes to your class (and its xp talents). Called by addXp. */
  function classXp(s, w, skill, xp, at) {
    if (w !== s.player || !w.cls || !CLASSES[w.cls] || COMBAT_TRAINING.indexOf(skill) < 0 || !(xp > 0)) return;
    var box = classBox(w, w.cls), lv0 = levelOf(box.xp), p0 = talentPoints(w, w.cls);
    box.xp = Math.round((box.xp + xp * (1 + (talentSum(w).xpCls || 0))) * 10) / 10;
    var lv1 = levelOf(box.xp);
    if (lv1 > lv0) note(s, at, "Your " + CLASSES[w.cls].name + " class reached level " + lv1 + "!" +
                       (talentPoints(w, w.cls) > p0 ? " A talent point to spend (your Character sheet, Talents)." : ""));
  }
  function respecCost(pl, cls) {
    var lv = classLevel(pl, cls);
    if (lv <= TALENT_RULES.freeRespecTo) return 0;
    return Math.round(TALENT_RULES.respecPerLevel * lv * (1 + TALENT_RULES.respecStep * (classBox(pl, cls).respecs || 0)));
  }
  /** The Talents tab: your class, its level and points, and every node with what it needs. */
  function talentsView(s) {
    var pl = s.player, cls = pl.cls;
    var classes = Object.keys(CLASSES).map(function (k) { return { id: k, name: CLASSES[k].name, level: classLevel(pl, k), on: k === cls }; });
    if (!cls || !TALENTS[cls]) return { cls: "", classes: classes };
    var box = classBox(pl, cls), lv = classLevel(pl, cls), xpNow = box.xp, nextXp = XP[Math.min(MAX_LEVEL, lv + 1)] || XP[MAX_LEVEL];
    var pts = talentPoints(pl, cls), spent = spentAll(box.talents);
    return { cls: cls, name: CLASSES[cls].name, level: lv, xp: Math.floor(xpNow), next: lv >= MAX_LEVEL ? 0 : Math.ceil(nextXp - xpNow),
             progress: lv >= MAX_LEVEL ? 1 : Math.max(0, Math.min(1, (xpNow - XP[lv]) / Math.max(1, nextXp - XP[lv]))),
             points: pts, spent: spent, sandbox: !!(s.dev && s.dev.on), left: Math.max(0, pts - spent), every: TALENT_RULES.pointsEvery,
             respec: { cost: prestigeView(s).freeRespec ? 0 : respecCost(pl, cls), free: lv <= TALENT_RULES.freeRespecTo || (respecCost(pl, cls) > 0 && prestigeView(s).freeRespec),
                       marked: respecCost(pl, cls) > 0 && prestigeView(s).freeRespec, freeTo: TALENT_RULES.freeRespecTo, any: spent > 0 },
             legacyPts: legacyPoints(pl, cls),                                                  // (Part 12)
             builds: Array.apply(null, Array(TALENT_RULES.builds)).map(function (_, i) { var bd = box.builds[i]; return { slot: i, name: bd ? bd.name : "", has: !!bd, points: bd ? spentAll(bd.talents) : 0 }; }),
             sum: talentSum(pl), classes: classes,
             branches: TALENTS[cls].branches.map(function (b) {
               return { id: b.id, name: b.name, about: b.about, later: b.later || "", spent: spentIn(box.talents, b), locked: b.needs === "necro" && !(pl.necro && pl.necro.taught),
                        nodes: b.nodes.map(function (n) { var lk = talentLock(pl, n.id);
                          return { id: n.id, name: n.name, about: n.about, ranks: n.ranks, rank: box.talents[n.id] || 0, tier: n.tier, gate: TALENT_RULES.gates[n.tier] || 0,
                                   keystone: !!n.keystone, choice: n.choice || "", parent: n.parent || "", lock: lk, can: !lk }; }) };
             }) };
  }
  var TALENT_ACTS = ["talent", "respec", "talentbuild"];                // ("build" is the House's rooms)
  /** talent {node} -- one more rank · respec {} -- every point back (free to class level 15, then coins) ·
   *  talentbuild {op: "save" | "load", slot, name} -- your two saved builds (loaded at home: not on a trip or in a fight). */
  function talentAct(s, action, opts, now) {
    if (TALENT_ACTS.indexOf(action) < 0) return null;
    var pl = s.player;
    if (!pl.cls || !TALENTS[pl.cls]) return no(s, "Choose a class first -- its talents come with it.");
    var box = classBox(pl, pl.cls);
    if (action === "talent") {
      var lk = talentLock(pl, opts.node);
      if (lk) return no(s, lk);
      box.talents[opts.node] = (box.talents[opts.node] || 0) + 1;
      learnTechniques(pl, opts.node);                                    // a technique learned for good (Part 9)
      var n = TALENT_NODE[opts.node].node;
      return yes(s, now, n.name + (n.ranks > 1 ? " rank " + box.talents[opts.node] + " of " + n.ranks : "") + ": " + n.about);
    }
    if (action === "respec") {
      if (!spentAll(box.talents)) return no(s, "No points spent yet.");
      if (pl.battle) return no(s, "Not in the middle of a fight.");
      var cost = respecCost(pl, pl.cls), marked = cost > 0 && prestigeView(s).freeRespec;   // three prestige marks: one free a game (Part 12)
      if (marked) { cost = 0; pl.prestigeRespec = true; }
      if (cost && !hasCoins(s, cost)) return no(s, "A respec costs " + cost + " coins at " + CLASSES[pl.cls].name + " level " + classLevel(pl, pl.cls) + ".");
      if (cost) { spend(s, cost); box.respecs = (box.respecs || 0) + 1; }
      box.talents = {};
      return yes(s, now, "Your " + CLASSES[pl.cls].name + " points are back to spend" + (cost ? " (" + cost + " coins)." : marked ? " -- free, for your prestige marks (once a game)." : " -- free until class level " + TALENT_RULES.freeRespecTo + "."));
    }
    if (action === "talentbuild") {
      var slot = +opts.slot;
      if (!(slot >= 0 && slot < TALENT_RULES.builds)) return no(s, "There's no build like that.");
      if (opts.op === "save") {
        box.builds[slot] = { name: cleanName(opts.name || "", 30) || "Build " + "AB"[slot], talents: copy(box.talents) };
        return yes(s, now, "Saved as " + box.builds[slot].name + ".");
      }
      var bd = box.builds[slot];
      if (!bd) return no(s, "Nothing saved there yet.");
      if (pl.job || pl.battle) return no(s, "Change builds at home -- not on a trip or in a fight.");
      var ok = {};
      Object.keys(bd.talents || {}).forEach(function (k) { if (TALENT_NODE[k] && TALENT_NODE[k].cls === pl.cls) ok[k] = Math.min(bd.talents[k], TALENT_NODE[k].node.ranks); });
      if (spentAll(ok) > talentPoints(pl, pl.cls)) return no(s, "That build needs more points than you have.");
      box.talents = ok;
      return yes(s, now, "You're using " + bd.name + ".");
    }
    return null;
  }
