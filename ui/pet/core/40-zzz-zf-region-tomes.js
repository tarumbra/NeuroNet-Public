  // ---- V11: region tomes (2026-10-18; Cam, PT16 t2: "Davy Jones Tome (Deep Sea Expedition unlocks), Cleopatras Tome (Desert unlock),
  //      Red River Tome (Nile Unlock), Undead Tome (Crypt Unlock) and more that you can think of for unlocking ... locked behind pets
  //      levels, ensure the PP matches the power of the move"). Earned, not bought: the first win at its place gives it (a sailboat
  //      for the sea, a rematch for the Star Tome); its boss leaves one now and then. Any battle pet can learn its moves.
  var REGION_TOMES = CONTENT("REGION_TOMES");
  var REGION_MOVE_OF = {};                                                // move -> its tome
  Object.keys(REGION_TOMES).forEach(function (k) {
    var T = REGION_TOMES[k];
    ITEMS[k] = { name: T.name, gem: T.gem, iconAs: "tomebeast", regionTome: true, about: T.lore + " Teaches any battle pet: " + Object.keys(T.moves).map(function (m) { return T.moves[m].name; }).join(", ") + " (Beast Pen → a pet's card → Teach from a tome)." };
    Object.keys(T.moves).forEach(function (m) {
      if (BEAST_MOVES[m]) throw new Error("A region tome's move " + m + " has the id of a move pets already learn");   // (an id must be new: it would replace the type's own)
      BEAST_MOVES[m] = T.moves[m]; T.moves[m].tome = k; REGION_MOVE_OF[m] = k;   // (not in MOVES_BY_TYPE: only a tome teaches them)
    });
  });
  /** A tome's moves a pet could learn now: [{move, name, type, typeName, level, tome, about}] (tomeTeachable adds these). */
  function regionTomeTeachable(s, bst) {
    var lv = beastLevel(bst), out = [];
    Object.keys(REGION_TOMES).forEach(function (k) {
      if (!((s.bag || {})[k] > 0)) return;
      Object.keys(REGION_TOMES[k].moves).forEach(function (m) {
        var M = BEAST_MOVES[m];
        if (M.level <= lv && (bst.tomeMoves || []).indexOf(m) < 0 && movesOf(bst).indexOf(m) < 0) out.push({ move: m, name: M.name, type: M.type, typeName: BEAST_TYPES[M.type].name, level: M.level, tome: k, about: M.about });
      });
    });
    return out;
  }
  /** The first time: the tome, and the Unlocks pop-up. why: "ground:<id>" / "ship" / "rematch". */
  function regionTomeGive(s, k, at) {
    s.tomesGot = s.tomesGot || {};
    if (s.tomesGot[k]) return;
    s.tomesGot[k] = at;
    give(s, k, 1, true);
    var T = REGION_TOMES[k];
    s.unlocked = (s.unlocked || []).concat([{ at: at + 0.5, title: "A move tome: " + T.name, list: [{ icon: k, text: T.lore }].concat(Object.keys(T.moves).map(function (m) {
      return { icon: k, text: T.moves[m].name + " (" + BEAST_TYPES[T.moves[m].type].name + ", battle level " + T.moves[m].level + "): " + T.moves[m].about }; })) }]).slice(-5);
    note(s, at, "You found " + T.name + " -- any battle pet can learn its moves (Beast Pen → Teach from a tome).");
  }
  /** After a won hunt fight / boss fight / rematch, and whenever the ship grows: has a tome been earned? */
  function regionTomeCheck(s, at, ctx) {
    Object.keys(REGION_TOMES).forEach(function (k) {
      var T = REGION_TOMES[k];
      if (T.ground && ctx && ctx.ground === T.ground) regionTomeGive(s, k, at);
      if (T.ship && shipTier(s) >= T.ship) regionTomeGive(s, k, at);
      if (T.rematch && ctx && ctx.rematch === T.rematch) regionTomeGive(s, k, at);
    });
  }
  /** A boss's fight won: its own tome, now and then, once you have had the first (MOVE_TOMES.bossChance, on its own dice). */
  function regionTomeBossDrop(s, b, hl, got) {
    var k = Object.keys(REGION_TOMES).filter(function (x) { return REGION_TOMES[x].boss === b.mon; })[0];
    if (!k || !(s.tomesGot || {})[k]) return;
    var h = Math.imul(((b.seed | 0) ^ (hl.wins * 104729)) + 31, 2654435761), roll = ((h ^ (h >>> 15)) >>> 0) % 100000 / 100000;
    if (roll < MOVE_TOMES.bossChance && give(s, k, 1, true)) got[k] = (got[k] || 0) + 1;
  }
