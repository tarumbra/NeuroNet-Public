  // ---- Battle Re-work Part 12: New Game Plus legacies (2026-10-16) ---------------------------------------------------------
  //      Cam (note 01): "New Game Plus bonuses that depend on your class and level in the last save." The plan (note 05):
  //   - a GIFT from your last game's highest class (LEGACY.gifts; a Beast Master brings one battle pet from the old Pen);
  //   - free TALENT POINTS for that class: its level / pointsPer, up to maxPoints (pl.legacyPts, added by talentPoints);
  //   - every TECHNIQUE you learned comes with you (the extra slots at New Game Plus 1 and 3 are Part 9's techSlots);
  //   - PRESTIGE MARKS: one for each game you finished (s.marks); from freeRespecAt, one respec a game is free.
  //   newGame (27) calls applyLegacy when the game comes from a finished one.
  var LEGACY = CONTENT("LEGACY");

  /** The class you'd carry from this game: the highest class level (your current class wins a tie). null without one. */
  function legacyClass(from) {
    var pl = (from && from.player) || {}, best = null;
    Object.keys(CLASSES).forEach(function (k) {
      var lv = (((pl.classes || {})[k]) || {}).xp > 0 ? classLevel(pl, k) : 0;
      if (!lv) return;
      if (!best || lv > best.level || (lv === best.level && k === pl.cls)) best = { cls: k, level: lv };
    });
    return best;
  }
  /** What a new game from this one would bring: {cls, name, level, points, items, beast, beasts, techs, marks, line}. */
  function legacyOf(from) {
    if (!from || !ngUnlocked(from)) return null;
    var lc = legacyClass(from), pl = from.player || {}, necro = !!(lc && lc.cls === "arcane" && pl.necro && pl.necro.taught);
    var g = lc ? LEGACY.gifts[necro ? "necromancer" : lc.cls] : null;                  // an Arcane who'd learnt Necromancy: the Necromancer's gift (Part 13)
    var techs = Object.keys(TECHNIQUES.list).filter(function (id) { return techLearned(pl, id); });
    var beasts = g && g.beast ? (from.beasts || []).filter(function (b) { return b && b.id && !b.dead; })
      .map(function (b) { return { id: b.id, name: b.name || SPECIES[b.species] && SPECIES[b.species].name || b.species, level: beastLevel(b) }; })
      .sort(function (a, b) { return b.level - a.level; }) : [];
    return { cls: lc ? lc.cls : "", name: lc ? CLASSES[lc.cls].name + (necro ? " (Necromancer)" : "") : "", level: lc ? lc.level : 0,
             points: lc ? Math.min(LEGACY.maxPoints, Math.floor(lc.level / LEGACY.pointsPer)) : 0,
             items: g ? copy(g.items) : {}, beast: !!(g && g.beast), beasts: beasts, battleLevel: LEGACY.battleLevel,
             techs: techs.map(function (id) { return { id: id, name: TECHNIQUES.list[id].name }; }),
             marks: (from.marks || 0) + 1, freeRespecAt: LEGACY.freeRespecAt, line: g ? g.line : "",
             oldClasses: oldClassesOf(from).map(function (k) { return { cls: k, name: CLASSES[k].name }; }) };
  }
  /** One battle pet from the old Pen, back at the legacy's battle level: its kind and looks, none of its training. */
  function legacyBeast(b, now) {
    var q = { id: b.id, name: b.name || "", species: b.species, colour: b.colour, born: b.born, hatchAt: b.hatchAt, joined: now,
              xp: XP[LEGACY.battleLevel], stat: {}, train: "", trainAt: now, fedUntil: 0, restUntil: 0, wins: 0, faints: 0, from: "legacy" };
    if (b.skin) q.skin = copy(b.skin);
    if (b.gene) q.gene = copy(b.gene);
    if (b.moves) q.moves = b.moves.slice();
    return q;
  }
  // (2026-10-20, Cam: "when starting a new game plus, you keep your old classes ability to use those weapons as well, so this way
  //  you in theory should be able to change combat style mid hunt") -- every class you levelled in a finished game (class level
  //  LEGACY_CLASS_LEVEL or more), and every one you'd carried into it, stays yours for WEAPONS AND ARMOUR: pl.oldClasses. Talents,
  //  specials and class-only skills (a Paladin's bash, a Hunter's field crafts) stay with the class you are now.
  var LEGACY_CLASS_LEVEL = 2;
  function oldClassesOf(from) {
    var pl = (from && from.player) || {}, out = (pl.oldClasses || []).slice();
    Object.keys(CLASSES).forEach(function (k) { if ((((pl.classes || {})[k]) || {}).xp > 0 && classLevel(pl, k) >= LEGACY_CLASS_LEVEL && out.indexOf(k) < 0) out.push(k); });
    return out;
  }
  /** May you wield and wear a class's gear? Your class's, or an old class's from New Game Plus. */
  function canUseClass(pl, cls) { return !cls || (pl && (pl.cls === cls || (pl.oldClasses || []).indexOf(cls) >= 0)); }
  /** A new game from a finished one: the gift, the points, the techniques and a prestige mark. opts.beast: which battle pet. */
  function applyLegacy(s, from, opts, now) {
    var L = legacyOf(from);
    if (!L) return;
    var pl = s.player, got = [];
    s.marks = L.marks;
    var oc = oldClassesOf(from); if (oc.length) { pl.oldClasses = oc; got.push("the weapons and armour of " + oc.map(function (k) { return clsPlural(k); }).join(", ")); }
    s.legacy = { cls: L.cls, level: L.level, points: L.points, from: ((from.player || {}).name) || "" };
    if (L.cls) {
      Object.keys(L.items).forEach(function (k) { if (ITEMS[k] && L.items[k] > 0) give(s, k, L.items[k], true); });
      if (Object.keys(L.items).length) got.push(itemsText(L.items));
      if (L.points) { pl.legacyPts = {}; pl.legacyPts[L.cls] = L.points; got.push(L.points + " free " + L.name + " talent point" + (L.points === 1 ? "" : "s")); }
    }
    if (L.beast && L.beasts.length) {
      var want = (opts && opts.beast) || L.beasts[0].id;
      var b = (from.beasts || []).filter(function (x) { return x && x.id === want && !x.dead; })[0] || (from.beasts || []).filter(function (x) { return x && x.id === L.beasts[0].id; })[0];
      if (b && !beastsOf(s).some(function (x) { return x.id === b.id; })) { beastsOf(s).push(legacyBeast(b, now)); got.push(who(b) + " from your old Pen"); }
    }
    if (L.techs.length) {
      pl.techLearned = pl.techLearned || {};
      L.techs.forEach(function (t) { pl.techLearned[t.id] = true; });
      got.push("your techniques (" + L.techs.map(function (t) { return t.name; }).join(", ") + ")");
    }
    if (L.line) note(s, now, L.line);
    note(s, now, "Your legacy" + (L.name ? " as " + aOr(L.name) + " (level " + L.level + ")" : "") + ": " + (got.length ? got.join("; ") : "a prestige mark") +
                 ". Prestige mark " + L.marks + (L.marks >= LEGACY.freeRespecAt ? " -- one respec this game is free." : "."));
  }
  /** Legacy talent points for a class (talentPoints adds them). */
  function legacyPoints(pl, cls) { return ((pl && pl.legacyPts) || {})[cls] || 0; }
  /** Your prestige: the marks, and whether this game's free respec is still to use. */
  function prestigeView(s) {
    var m = (s && s.marks) || 0;
    return { marks: m, freeRespec: m >= LEGACY.freeRespecAt && !(s.player && s.player.prestigeRespec), freeRespecAt: LEGACY.freeRespecAt,
             legacy: s && s.legacy ? copy(s.legacy) : null, legacyName: s && s.legacy && s.legacy.cls ? CLASSES[s.legacy.cls].name : "" };
  }
