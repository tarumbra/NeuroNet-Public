  // ---- Battle Re-work Part 14: move tomes (2026-10-16, PT11 x6 -- "Later (Part 14's polish)") -----------------------------
  //      Note 06: a pet learns its own type's moves by battle level, "and from move tomes (drops and shops)". A tome teaches
  //      one move of ITS type -- another type than the pet's -- up to the pet's battle level; MOVE_TOMES.max a pet. The move
  //      keeps its own type in the matchups (petTurn uses the move's type). Warden Briar sells them; bosses leave one now and
  //      then, on dice of their own (a fight plays out the same).
  var MOVE_TOMES = CONTENT("MOVE_TOMES");
  Object.keys(MOVE_TOMES.items).forEach(function (k) { ITEMS[k] = MOVE_TOMES.items[k]; });
  var TOME_OF = {};
  Object.keys(MOVE_TOMES.items).forEach(function (k) { TOME_OF[MOVE_TOMES.items[k].moveTome] = k; });
  /** The moves a tome taught this pet (still within its battle level). movesLearned adds them. */
  function tomeMovesOf(bst) { return (bst.tomeMoves || []).filter(function (id) { return BEAST_MOVES[id] && BEAST_MOVES[id].level <= beastLevel(bst); }); }
  /** What a tome in your bag could teach this pet now: [{move, name, type, level, tome}]. */
  function tomeTeachable(s, bst) {
    if ((bst.tomeMoves || []).length >= MOVE_TOMES.max) return [];
    var own = beastType(bst), lv = beastLevel(bst), out = [];
    Object.keys(MOVES_BY_TYPE).forEach(function (t) {
      if (t === own || !((s.bag || {})[TOME_OF[t]] > 0)) return;
      MOVES_BY_TYPE[t].forEach(function (id) {
        var M = BEAST_MOVES[id];
        if (M.level <= lv && (bst.tomeMoves || []).indexOf(id) < 0) out.push({ move: id, name: M.name, type: t, typeName: BEAST_TYPES[t].name, level: M.level, tome: TOME_OF[t], about: M.about });
      });
    });
    return out.concat(regionTomeTeachable(s, bst));                        // and the region tomes' (V11)
  }
  /** The moves of the region tomes you hold that this pet is too young for yet: [{name, level, tome}] (PT26: a new pet's card showed no
   *  tome at all, so a found tome looked lost -- now it says when). */
  function tomeLater(s, bst) {
    if ((bst.tomeMoves || []).length >= MOVE_TOMES.max) return [];
    var lv = beastLevel(bst), out = [], bag = s.bag || {};               // (the found region tomes: a bought tome's list is long, and on its button)
    Object.keys(REGION_TOMES).forEach(function (k) {
      if (!(bag[k] > 0)) return;
      Object.keys(REGION_TOMES[k].moves).forEach(function (m) { if (BEAST_MOVES[m].level > lv && (bst.tomeMoves || []).indexOf(m) < 0) out.push({ name: BEAST_MOVES[m].name, level: BEAST_MOVES[m].level, tome: k }); });
    });
    return out.sort(function (a, b) { return a.level - b.level; });
  }
  /** The region tomes you have, for the Pen's shelf: [{id, name, have, banked, moves: "Comet (25), ..."}] -- one in the bank
   *  says so (a pet learns only from a tome in your bag). */
  function regionTomesHeld(s) {
    var bank = s.storage || {};
    return Object.keys(REGION_TOMES).filter(function (k) { return ((s.bag || {})[k] || 0) > 0 || (bank[k] || 0) > 0; }).map(function (k) {
      return { id: k, name: ITEMS[k].name, have: (s.bag || {})[k] || 0, banked: !((s.bag || {})[k] > 0), moves: Object.keys(REGION_TOMES[k].moves).map(function (m) { return BEAST_MOVES[m].name + " (battle level " + BEAST_MOVES[m].level + ")"; }).join(", ") }; });
  }
  /** A boss you beat may leave a tome (endBossBattle asks): its own dice, a type picked the same way. */
  function tomeBossDrop(s, b, hl, got) {
    var h = Math.imul(((b.seed | 0) ^ (hl.wins * 7919)) + 13, 2654435761), roll = ((h ^ (h >>> 16)) >>> 0) % 100000 / 100000;
    if (roll >= MOVE_TOMES.bossChance) return;
    var types = Object.keys(TOME_OF), k = TOME_OF[types[((h >>> 7) >>> 0) % types.length]];
    if (give(s, k, 1, true)) got[k] = (got[k] || 0) + 1;
  }
  /** penteach {id, move} -- a tome's move to a battle pet · penbuy {item} -- a tome from Warden Briar. */
  function tomeAct(s, action, opts, now) {
    if (action === "penbuy") {
      var it = ITEMS[opts.item];
      if (!it || !it.moveTome) return no(s, WARDEN.name + " doesn't sell that.");
      if (!hasCoins(s, MOVE_TOMES.price)) return no(s, aOr(it.name) + " is " + MOVE_TOMES.price.toLocaleString() + " coins.");
      if (!roomFor(s, opts.item)) return no(s, "Your bag is full.");
      spend(s, MOVE_TOMES.price); give(s, opts.item, 1);
      return yes(s, now, "Bought " + aOr(it.name.toLowerCase()) + " from " + WARDEN.name + " (" + MOVE_TOMES.price.toLocaleString() + " coins).");
    }
    if (action !== "penteach") return null;
    var bst = beastById(s, opts.id);
    if (!bst) return no(s, "That pet isn't in the Pen.");
    var t = tomeTeachable(s, bst).filter(function (x) { return x.move === opts.move; })[0];
    if ((bst.tomeMoves || []).length >= MOVE_TOMES.max) return no(s, who(bst) + " has learnt " + MOVE_TOMES.max + " moves from tomes -- that's as many as a pet can.");
    if (!t) return no(s, who(bst) + " can't learn that -- it needs the move's tome in your bag, a move of another type than its own, at its battle level or below.");
    take(s, t.tome);
    bst.tomeMoves = (bst.tomeMoves || []).concat([t.move]);
    return yes(s, now, who(bst) + " learnt " + t.name + " (" + t.typeName + ") from the tome. Choose it among its four moves.");
  }
