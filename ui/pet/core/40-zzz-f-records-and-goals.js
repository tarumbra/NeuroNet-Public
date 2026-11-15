  // ---- records and goals (2026-10-12, audit FEAT-4 and FEAT-5 -- "22 skills and 168 quests need a 'what next?'" and
  //      "statistics: kills, hours per skill, coins earned"). Both live on the Player page. Most records are read from what the
  //      save already keeps (kills, bosses, quests, the Petapedia, the Farm); a few are counted as you play (coins in and out,
  //      things made, trips), from the first action after this update -- an old save starts counting then.
  /** Counts what an action did: coins in and out (everything since the last action, idle earnings too), things made, trips. */
  function noteRecords(s, action, opts, coins0, now, res) {
    var r = s.records = s.records || { since: now, coinsIn: 0, coinsOut: 0, made: 0, trips: 0, hunts: 0 };
    var d = (s.coins || 0) - (coins0 || 0);
    if (d > 0) r.coinsIn += d; else if (d < 0) r.coinsOut -= d;
    if (action === "craft") r.made += (res && res.crafts) || 1;      // "Cook all" makes many at once
    if (action === "trip") r.trips += 1;
    if (action === "hunt") r.hunts += 1;
  }
  function actAndNote(state, action, opts, now) {
    var c0 = state && typeof state.coins === "number" ? state.coins : 0;
    var res = fightGearChanged(act(state, action, opts, now), action, opts || {}, now);   // gear and draughts mid-fight count now (N22)
    if (res && res.ok && res.state && res.state.player && res.state.player.made) noteRecords(res.state, action, opts || {}, c0, now, res);
    return res;
  }
  function recordsView(s, now) {
    s = s || {};
    var r = s.records || {}, hunt = s.hunt || {}, pl = s.player || {};
    var kills = Object.keys(hunt).reduce(function (a, g) { return a + ((hunt[g] || {}).kills || 0); }, 0);
    var wins = Object.keys(hunt).filter(function (g) { return HUNTS[g] && HUNTS[g].boss; }).reduce(function (a, g) { return a + ((hunt[g] || {}).wins || 0); }, 0);
    var xp = Object.keys(pl.skills || {}).reduce(function (a, k) { return a + (pl.skills[k] || 0); }, 0);
    var dex = dexView(s) || [], found = dex.filter(function (d) { return d.found; }).length;
    var animals = s.ranch && s.ranch.b ? Object.keys(s.ranch.b).reduce(function (a, k) { return a + (s.ranch.b[k].animals || []).length; }, 0) : 0;
    var best = SKILL_ORDER.map(function (k) { return { id: k, name: SKILLS[k].name, xp: (pl.skills || {})[k] || 0 }; })
      .sort(function (a, z) { return z.xp - a.xp; }).slice(0, 3).map(function (x) { return { name: x.name, level: levelOf(x.xp), xp: Math.floor(x.xp) }; });
    var questN = Object.keys(s.quests || {}).length, questAll = Object.keys(PEOPLE).reduce(function (a, k) { return a + PEOPLE[k].quests.length; }, 0);
    return {
      since: r.since || 0, days: r.since ? Math.max(0, Math.floor(((now || 0) - r.since) / DAY)) : 0,
      rows: [
        { icon: "bronzesword", label: "Creatures beaten", value: kills },
        { icon: "obj_map", label: "Bosses beaten", value: wins },
        { icon: "tomekeen", label: "Quests done", value: questN + " of " + questAll },
        { icon: "clover", label: "Pets found (Petapedia)", value: found + " of " + dex.length },
        { icon: "bones", label: "Pets lost", value: (s.graveyard || []).length },
        { icon: "obj_ranch", label: "Animals on the Farm", value: animals + ((s.ranch && s.ranch.born) ? " (" + s.ranch.born + " born there)" : "") },
        { icon: "oldcoin", label: "Coins earned", value: Math.floor(r.coinsIn || 0), counted: true },
        { icon: "oldcoin", label: "Coins spent", value: Math.floor(r.coinsOut || 0), counted: true },
        { icon: "obj_bench", label: "Things made", value: r.made || 0, counted: true },
        { icon: "willowbasket", label: "Trips out gathering", value: r.trips || 0, counted: true },
        { icon: "bronzehelm", label: "Hunts", value: r.hunts || 0, counted: true },
        { icon: "heart", label: "Xp in every skill together", value: Math.floor(xp) },
        { icon: "specialegg", label: "Gifted pets found", value: Object.keys(s.gifted || {}).length + " of " + Object.keys(GIFTED).length }
      ],
      best: best
    };
  }
  /** What's next (FEAT-4): for every skill, the nearest level that opens something, and what. Closest first. */
  function goalsView(s, now) {
    s = s || {};
    var pl = s.player || {}, out = [];
    SKILL_ORDER.forEach(function (k) {
      var lv = levelOf((pl.skills || {})[k] || 0);
      for (var L = lv + 1; L <= MAX_LEVEL; L++) {
        var u = levelUnlocks(k, L);
        if (u.length) {
          var need = Math.max(0, XP[L] - ((pl.skills || {})[k] || 0));
          out.push({ skill: k, name: SKILLS[k].name, level: L, have: lv, icon: u[0].icon, text: u[0].text, more: u.length - 1, xpToGo: Math.ceil(need) });
          break;
        }
      }
    });
    return out.sort(function (a, z) { return (a.level - a.have) - (z.level - z.have) || a.xpToGo - z.xpToGo; });
  }
