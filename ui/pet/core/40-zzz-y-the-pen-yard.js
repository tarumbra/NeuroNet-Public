  // ---- The Beast Pen's yard: a training dummy and a sparring ring (2026-10-16; note 06's "later upgrades") -----------------
  var PEN_YARD = CONTENT("PEN_YARD");
  function yardHas(s, k) { return !!(s.pen && s.pen.yard && s.pen.yard[k]); }
  /** The dummy's share of idle training (penRate adds it). */
  function yardTrain(s) { return yardHas(s, "dummy") ? PEN_YARD.dummy.trainPct : 0; }
  function sparLeft(b, now) { return Math.max(0, (b.sparAt || 0) + PEN_YARD.spar.every * HOUR - now); }
  /** penbuild {what: "dummy" | "ring"} · penspar {a, b} -- two battle pets spar. */
  function yardAct(s, action, opts, now) {
    if (action === "penbuild") {
      var Y = PEN_YARD[opts.what];
      if (!Y || opts.what === "spar") return no(s, "There's nothing like that to build.");
      if (yardHas(s, opts.what)) return no(s, "The " + Y.name.toLowerCase() + " is built.");
      if (levelOf(s.player.skills.construction || 0) < Y.construction) return no(s, Y.name + " needs Construction " + Y.construction + ".");
      var inf = s.dev && s.dev.infinite, short = Object.keys(Y.items).filter(function (k) { return !has(s, k, Y.items[k]); });
      if (!inf && short.length) return no(s, Y.name + " takes " + itemsText(Y.items) + " and " + Y.coins.toLocaleString() + " coins.");
      if (!inf && (s.coins || 0) < Y.coins) return no(s, Y.name + " costs " + Y.coins.toLocaleString() + " coins.");
      beastsOf(s).forEach(function (b) { penSettle(s, b, now); });       // training at the old pace up to now
      if (!inf) { s.coins -= Y.coins; Object.keys(Y.items).forEach(function (k) { take(s, k, Y.items[k]); }); }
      s.pen = s.pen || {}; s.pen.yard = s.pen.yard || {}; s.pen.yard[opts.what] = now;
      return yes(s, now, WARDEN.name + " looks it over. \"" + (opts.what === "dummy" ? "That'll do. They'll train quicker for it." : "Good. Now they can knock each other about properly.") + "\" (" + Y.name + " built.)");
    }
    if (action !== "penspar") return null;
    if (!yardHas(s, "ring")) return no(s, "Sparring needs a sparring ring in the Pen's yard.");
    var a = beastById(s, opts.a), b = beastById(s, opts.b);
    if (!a || !b || a === b) return no(s, "Choose two different battle pets.");
    var who2 = [a, b].filter(function (x) { return restLeft(x, now) > 0 || sparLeft(x, now) > 0; })[0];
    if (who2) return no(s, who(who2) + (restLeft(who2, now) > 0 ? " is resting." : " sparred not long ago -- again in " + Math.ceil(sparLeft(who2, now) / MIN) + " minutes."));
    var cap = XP[penCap(s)], got = [];
    [a, b].forEach(function (x) {
      penSettle(s, x, now);
      var before = x.xp || 0;
      x.xp = Math.max(before, Math.min(cap, before + penRate(s) * PEN_YARD.spar.hours));
      x.sparAt = now;
      got.push(who(x) + (x.xp > before ? " +" + Math.round(x.xp - before) + " xp" : " (as far as the Pen takes them)"));
    });
    s.pen.lastSpar = sparBout(a, b, now, got);
    return yes(s, now, who(a) + " and " + who(b) + " spar in the ring -- nobody gets hurt. " + got.join(", ") + ".");
  }
  /** The bout itself, to watch on the Training Yard (Cam, PT16 x4: "the Training Yard for the Beast Master's fights at the Pen
   *  (sparring as a fight)"): six exchanges with their own moves, practice blows only -- it changes nothing but who wins the round of
   *  applause. Seeded by the time, so it plays the same each time it's shown. */
  function sparBout(a, b, now, got) {
    var seed = (Math.floor(now / 1000) ^ 0x5bd1e995) >>> 0;
    var r = function () { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) / 16777216; };
    var side = function (x) { var st = beastStats(x), mv = movesOf(x).filter(function (id) { return BEAST_MOVES[id]; });
      return { id: x.id, name: who(x), species: x.species, colour: x.colour, level: beastLevel(x), att: st.attack || 1, def: st.defence || 1, speed: st.speed || 1,
               moves: mv.length ? mv : ["scrap"], score: 0 }; };
    var A = side(a), B = side(b), rounds = [], first = A.speed >= B.speed ? [A, B] : [B, A];
    for (var i = 0; i < 6; i++) {
      var me = first[i % 2], them = first[1 - i % 2], id = me.moves[Math.floor(r() * me.moves.length)], m = BEAST_MOVES[id] || BEAST_MOVES.scrap;
      var hit = r() < Math.max(0.35, Math.min(0.9, 0.7 * (m.acc || 1) + (me.speed - them.speed) * 0.01));
      var pts = hit ? Math.max(1, Math.round((m.power || 1) * (2 + me.att / Math.max(1, them.def)) * (0.8 + r() * 0.4))) : 0;
      me.score += pts;
      rounds.push({ by: me === A ? "a" : "b", move: m.name, hit: hit, pts: pts });
    }
    var win = A.score === B.score ? "" : A.score > B.score ? "a" : "b";
    return { at: now, a: { id: A.id, name: A.name, species: A.species, colour: A.colour, level: A.level, score: A.score },
             b: { id: B.id, name: B.name, species: B.species, colour: B.colour, level: B.level, score: B.score }, rounds: rounds, win: win, got: got.slice() };
  }
