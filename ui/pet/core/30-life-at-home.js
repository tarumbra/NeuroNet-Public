  // ==== life at home (2026-10-08, Cam: "All this sounds amazing") -- the hearth's pot, the dining table, the
  //      forbidden archive and its lore pages, the reading chair, the ancient stacks' research, the observatory.
  //      All of it lives in s.home; the bonuses are small and one at a time, so active play stays the best way.
  ITEMS.thinstew = CONTENT("ITEMS.thinstew");
  ITEMS.heartystew = CONTENT("ITEMS.heartystew");
  ITEMS.richstew = CONTENT("ITEMS.richstew");
  ITEMS.archivekey = CONTENT("ITEMS.archivekey");
  ITEMS.stardust = CONTENT("ITEMS.stardust");
  // stardust: another way to enchant a gem, without the runes
  WORKSHOPS.enchanting.recipes.push({ make: "enchantedopal", needs: { opal: 1, stardust: 2 }, level: 14, xp: 40 },
                                    { make: "enchantedsapphire", needs: { sapphire: 1, stardust: 3 }, level: 22, xp: 60 });
  var POT_TIME = 45 * MIN, POT_MIN = 3, POT_MAX = 8, MEAL_TIME = 60 * MIN, READ_TIME = 30 * MIN;
  var STEWS = CONTENT("STEWS");    // [stew, the ingredients' worth it takes]
  /** What an ingredient is worth in a stew (0: not one): its own healing, what it cooks into, or how filling it is. */
  function stewWorth(id) {
    var it = ITEMS[id];
    if (!it || it.potion || it.brew || it.gear || it.tool || STEWS.some(function (x) { return x[0] === id; })) return 0;
    if (it.heal) return it.heal;
    var cooked = 0;
    WORKSHOPS.kitchen.recipes.forEach(function (r) { if (r.needs[id] && ITEMS[r.make] && ITEMS[r.make].heal) cooked = Math.max(cooked, ITEMS[r.make].heal); });
    if (cooked) return cooked;
    return it.food ? Math.max(1, Math.round(it.food.full / 10)) : 0;
  }
  function stewFor(avg) { var t = STEWS[0][0]; STEWS.forEach(function (x) { if (avg >= x[1]) t = x[0]; }); return t; }
  /** The meal bonus a dish gives at the table: xp, for an hour. */
  function mealXp(id) { var h = (ITEMS[id] || {}).heal || 0, b = h >= 12 ? 0.08 : h >= 7 ? 0.06 : h >= 4 ? 0.04 : 0.02;
    return STEWS.some(function (x) { return x[0] === id; }) ? b + 0.02 : b; }
  // the lore pages, one per region, turned up exploring
  var LORE = CONTENT("LORE");
  var LORE_REWARDS = CONTENT("LORE_REWARDS");
  // the ancient stacks: research, one project at a time, three levels each
  var RESEARCH = CONTENT("RESEARCH");
  var RESEARCH_ORDER = CONTENT("RESEARCH_ORDER");
  // (balance, 2026-10-08) each level needs a better library too: sturdy, fine, grand
  var RESEARCH_COST = CONTENT("RESEARCH_COST");
  // the observatory: a constellation a week, a bonus to one skill for the night
  var STARS = CONTENT("STARS");
  function homeOf(s) {
    var h = s.home = s.home && typeof s.home === "object" ? s.home : {};
    if (!h.pages || typeof h.pages !== "object") h.pages = {};
    if (!h.done || typeof h.done !== "object") h.done = {};
    if (!Array.isArray(h.claimed)) h.claimed = [];
    return h;
  }
  function researched(s, id) { return ((s && s.home && s.home.done) || {})[id] || 0; }
  /** How much quicker a gathering skill is, from research (a divisor for a find's time). */
  function researchSpeed(s, skill) { var n = 1; RESEARCH_ORDER.forEach(function (k) { if (RESEARCH[k].skill === skill) n += 0.03 * researched(s, k); }); return n; }
  // the sandbox's sky (Cam, PT15 c2: "a way to set time in game to either night or day in the sandbox mode"): normal() sets it
  // from s.dev.sky on every state it reads -- "night", "day", or "" for the real clock. The real game never has one.
  var SKY = "";
  function isNight(now) { if (SKY) return SKY === "night"; var h = new Date(now).getHours(); return h >= 21 || h < 5; }
  /** The night a moment belongs to (a night runs 9 pm to 5 am): the date it started. */
  function nightOf(now) { var d = new Date(now - 5 * HOUR); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function nextMorning(now) { var d = new Date(now); if (d.getHours() >= 6) d.setDate(d.getDate() + 1); d.setHours(6, 0, 0, 0); return d.getTime(); }
  function starOfWeek(now) { return STARS[Math.floor((now / DAY + 3) / 7) % STARS.length]; }
  /** Your xp, multiplied by what home gives: a good meal, and tonight's stars. */
  function homeXp(s, skill, at) {
    var h = s.home || {}, m = 1;
    if (h.fed && h.fed.until > at) m += h.fed.xp;
    if (h.star && h.star.until > at && h.star.skill === skill) m += 0.1;
    return m;
  }
  function readXp(s, skill) { return 15 + 6 * levelOf(s.player.skills[skill] || 0); }
  /** A torn page, sometimes, coming back from exploring (it's yours, archive open or not). */
  function findPage(s, region, roll, at) {
    var h = homeOf(s);
    if (!LORE[region] || h.pages[region] || roll >= 0.3) return;
    h.pages[region] = at;
    note(s, at, "Tucked in a crack in the " + REGIONS[region].name + ", you found a torn page of an old book. " +
                (h.archive ? "It belongs in the forbidden archive." : "There's a locked archive in your library -- maybe it belongs there."));
    claimLore(s, at);
  }
  /** The archive's rewards for pages gathered, once it's open. */
  function claimLore(s, at) {
    var h = homeOf(s), n = Object.keys(h.pages).length;
    if (!h.archive) return;
    LORE_REWARDS.forEach(function (r) {
      if (n < r[0] || h.claimed.indexOf(r[0]) >= 0) return;
      h.claimed.push(r[0]);
      var got = {};
      if (r[1].coins) { s.coins = (s.coins || 0) + r[1].coins; got.coins = r[1].coins; }
      Object.keys(r[1].items || {}).forEach(function (k) { give(s, k, r[1].items[k], true); got[k] = r[1].items[k]; });
      note(s, at, r[0] + " pages put back together in the archive: something was pressed between them (" + itemsText(got) + ").");
    });
  }
  /** Home's clocks: a book finished, research done. */
  function resolveHome(s, now) {
    var h = homeOf(s);
    if (h.reading && h.reading.until <= now) {
      var rd = h.reading; delete h.reading;
      addXp(s, s.player, rd.skill, rd.xp, rd.until);
      note(s, rd.until, "You finished reading by the fire: " + rd.xp + " " + SKILLS[rd.skill].name + " xp.");
    }
    if (h.research && h.research.until <= now && h.research.id === "plague") {      // the tablet, read (2026-10-08)
      var pt = h.research; delete h.research;
      give(s, "plagueegg", 1, true);
      h.plagues = (h.plagues || 0) + 1;
      note(s, pt.until, "The glyphs make sense at last: a plague, and a promise. Under the tablet, something buzzes -- a buzzing egg. Put it in the Hatchery.");
    }
    if (h.research && h.research.until <= now) {
      var rs = h.research; delete h.research;
      h.done[rs.id] = rs.level;
      note(s, rs.until, "Research done in the ancient stacks: " + RESEARCH[rs.id].name + " " + rs.level + " (" + RESEARCH[rs.id].says + ").");
    }
  }
  function homeIdle(s) {
    var pl = s.player;
    return pl.job ? "You're out " + (pl.job.hunt ? "hunting" : SKILLS[pl.job.skill] ? SKILLS[pl.job.skill].verb : "gathering") + " -- come home first."
      : pl.battle ? "You're in a fight." : pl.explore ? "You're out exploring." : "";
  }
  /** The home acts. Returns null when the action isn't one of them. */
  function homeAct(s, action, opts, now) {
    var h = homeOf(s), it;
    if (action === "pot") {
      if (h.pot) return no(s, "There's already a pot on the hearth.");
      var pick = opts.items || {}, n = 0, worth = 0;
      for (var k in pick) {
        var c = Math.max(0, pick[k] | 0);
        if (!c) continue;
        if (!stewWorth(k)) return no(s, (ITEMS[k] ? ITEMS[k].name : "That") + " doesn't go in a stew.");
        if (!has(s, k, c)) return no(s, "You haven't got " + c + " " + ITEMS[k].name.toLowerCase() + ".");
        n += c; worth += stewWorth(k) * c;
      }
      if (n < POT_MIN) return no(s, "A stew needs at least " + POT_MIN + " things in the pot.");
      if (n > POT_MAX) return no(s, "The pot holds " + POT_MAX + " at most.");
      for (var k2 in pick) if (pick[k2] > 0) take(s, k2, pick[k2] | 0);
      var stew = stewFor(worth / n);
      h.pot = { stew: stew, n: n, readyAt: now + POT_TIME, xp: 3 * n };
      return yes(s, now, "The pot's on the hearth: " + ITEMS[stew].name.toLowerCase() + " for " + n + ", ready in " + Math.round(POT_TIME / MIN) + " minutes.");
    }
    if (action === "potcollect") {
      if (!h.pot) return no(s, "The pot's empty.");
      if (h.pot.readyAt > now) return no(s, "It isn't ready yet.");
      var pot = h.pot; delete h.pot;
      give(s, pot.stew, pot.n, true);
      addXp(s, s.player, "cooking", pot.xp, now);
      return yes(s, now, "You ladled out " + pot.n + " " + ITEMS[pot.stew].name.toLowerCase() + " (" + pot.xp + " Cooking xp).");
    }
    if (action === "dine") {
      it = ITEMS[opts.food];
      if (!it || !it.heal || /^raw/.test(opts.food)) return no(s, "That's not a meal.");
      if (!has(s, opts.food)) return no(s, "You haven't got any " + it.name.toLowerCase() + ".");
      take(s, opts.food);
      var xpb = mealXp(opts.food);
      h.fed = { food: opts.food, xp: xpb, until: now + MEAL_TIME };
      s.player.hp = Math.min(maxHp(s.player), s.player.hp + it.heal);
      if (s.pet && !s.pet.away && s.pet.s) s.pet.s.happy = Math.min(100, s.pet.s.happy + 10);
      return yes(s, now, "You sat down to " + it.name.toLowerCase() + " at the table" + (s.pet && !s.pet.away ? ", " + (s.pet.name || "your pet") + " at your feet" : "") +
                         ". Well fed: +" + Math.round(xpb * 100) + "% xp for an hour.");
    }
    if (action === "archive") {
      if (h.archive) return no(s, "The archive's already open.");
      if (!has(s, "archivekey")) return no(s, "The gate's locked. Grizz, in the Deep Forest, is said to carry the key.");
      take(s, "archivekey");
      h.archive = now;
      note(s, now, "The key turns. The forbidden archive is open: shelves of torn books, waiting for their pages.");
      claimLore(s, now);
      return yes(s, now, "The forbidden archive is open.");
    }
    if (action === "read") {
      if (h.reading) return no(s, "You're already reading.");
      var busy = homeIdle(s);
      if (busy) return no(s, busy);
      if (!SKILLS[opts.skill] || opts.skill === "hitpoints") return no(s, "There's no book on that.");
      h.reading = { skill: opts.skill, xp: readXp(s, opts.skill), since: now, until: now + READ_TIME };
      return yes(s, now, "You settled into the chair by the fire with a book on " + SKILLS[opts.skill].name.toLowerCase() + ".");
    }
    if (action === "stopread") {
      if (!h.reading) return no(s, "You're not reading.");
      delete h.reading;
      return yes(s, now, "You put the book down.");
    }
    if (action === "research") {
      var r = RESEARCH[opts.id];
      if (!r) return no(s, "There's nothing like that in the stacks.");
      if (h.research) return no(s, "You're already researching " + RESEARCH[h.research.id].name.toLowerCase() + ".");
      var lv = researched(s, opts.id);
      if (lv >= RESEARCH_COST.length) return no(s, r.name + " is as good as it gets.");
      var cost = RESEARCH_COST[lv];
      if (roomTier(s, "library") < cost.library) return no(s, r.name + " " + (lv + 1) + " needs " + aOr(HOUSE_TIERS[cost.library].toLowerCase()) + " library -- build it up in the Workshop.");
      if ((s.coins || 0) < cost.coins) return no(s, "That takes " + cost.coins + " coins.");
      for (var ci in cost.items) if (!has(s, ci, cost.items[ci])) return no(s, "That takes " + cost.items[ci] + " " + ITEMS[ci].name.toLowerCase() + ".");
      s.coins -= cost.coins;
      for (var cj in cost.items) take(s, cj, cost.items[cj]);
      h.research = { id: opts.id, level: lv + 1, since: now, until: now + cost.hours * HOUR };
      return yes(s, now, "You started on " + r.name.toLowerCase() + " " + (lv + 1) + " -- " + cost.hours + " hours in the stacks.");
    }
    if (action === "decipher") {
      var miss = GLYPHS.filter(function (g) { return !has(s, g); });
      if (miss.length) return no(s, "The tablet needs all six glyphs -- you're missing the " + miss.map(function (g) { return ITEMS[g].name.toLowerCase(); }).join(", ") + ".");
      if (h.research) return no(s, "The stacks are busy with " + RESEARCH[h.research.id].name.toLowerCase() + " -- one project at a time.");
      GLYPHS.forEach(function (g) { take(s, g); });
      h.research = { id: "plague", level: 1, since: now, until: now + DECIPHER_HOURS * HOUR };
      return yes(s, now, "You laid the six glyphs out in the ancient stacks. Reading them together will take " + DECIPHER_HOURS + " hours.");
    }
    if (action === "stargaze") {
      if (!isNight(now)) return no(s, "The sky's too bright -- come back after 9 at night.");
      var night = nightOf(now);
      if (h.stars === night) return no(s, "You've looked at the stars tonight. Come back tomorrow night.");
      h.stars = night;
      var st = starOfWeek(now), roll = typeof opts.roll === "number" ? opts.roll : (now % 997) / 997;
      h.star = { name: st[0], skill: st[1], until: nextMorning(now) };
      var dust = roll < 0.35 ? 1 + (roll < 0.1 ? 1 : 0) : 0;
      if (dust) give(s, "stardust", dust, true);
      return yes(s, now, st[0] + " is high tonight: +10% " + SKILLS[st[1]].name + " xp until morning." + (dust ? " A shooting star! You found " + dust + " stardust." : ""));
    }
    return null;
  }
  /** Everything at home, for the page. */
  function homeView(s, now) {
    var h = (s && s.home) || {}, b = (s && s.bag) || {};
    var stars = starOfWeek(now), npages = Object.keys(h.pages || {}).length;
    return {
      pot: h.pot ? { stew: h.pot.stew, name: ITEMS[h.pot.stew].name, n: h.pot.n, readyIn: Math.max(0, Math.ceil((h.pot.readyAt - now) / 1000)), ready: h.pot.readyAt <= now } : null,
      ingredients: Object.keys(b).filter(function (k) { return b[k] > 0 && stewWorth(k); }).map(function (k) { return { id: k, name: ITEMS[k].name, have: b[k], worth: stewWorth(k) }; })
        .sort(function (x, y) { return y.worth - x.worth; }),
      potMin: POT_MIN, potMax: POT_MAX, potMins: Math.round(POT_TIME / MIN), stews: STEWS.map(function (x) { return { id: x[0], name: ITEMS[x[0]].name, worth: x[1], heal: ITEMS[x[0]].heal }; }),
      fed: h.fed && h.fed.until > now ? { food: h.fed.food, name: ITEMS[h.fed.food].name, xp: h.fed.xp, endsIn: Math.ceil((h.fed.until - now) / 1000) } : null,
      meals: Object.keys(b).filter(function (k) { return b[k] > 0 && ITEMS[k] && ITEMS[k].heal && !/^raw/.test(k); })
        .map(function (k) { return { id: k, name: ITEMS[k].name, have: b[k], xp: mealXp(k), heal: ITEMS[k].heal }; }).sort(function (x, y) { return y.xp - x.xp || y.heal - x.heal; }),
      archive: { open: !!h.archive, key: !!b.archivekey, pages: Object.keys(LORE).map(function (r) { return { region: r, name: REGIONS[r].name, found: !!(h.pages || {})[r], text: (h.pages || {})[r] ? LORE[r] : "" }; }),
                 found: npages, total: Object.keys(LORE).length,
                 rewards: LORE_REWARDS.map(function (r) { return { at: r[0], got: (h.claimed || []).indexOf(r[0]) >= 0, what: r[1].coins ? r[1].coins + " coins" : itemsText(r[1].items) }; }) },
      reading: h.reading ? { skill: h.reading.skill, name: SKILLS[h.reading.skill].name, xp: h.reading.xp, endsIn: Math.max(0, Math.ceil((h.reading.until - now) / 1000)) } : null,
      readMins: Math.round(READ_TIME / MIN), busy: s ? homeIdle(s) : "",
      books: SKILL_ORDER.filter(function (k) { return k !== "hitpoints"; }).map(function (k) { return { skill: k, name: SKILLS[k].name, xp: s ? readXp(s, k) : 0 }; }),
      research: RESEARCH_ORDER.map(function (k) { var lv = researched(s, k), c = RESEARCH_COST[lv];
        return { id: k, name: RESEARCH[k].name, says: RESEARCH[k].says, level: lv, max: RESEARCH_COST.length,
                 next: c ? { coins: c.coins, hours: c.hours, library: HOUSE_TIERS[c.library], libraryOk: roomTier(s, "library") >= c.library, items: Object.keys(c.items).map(function (i) { return { id: i, name: ITEMS[i].name, need: c.items[i], have: b[i] || 0 }; }),
                             can: !h.research && roomTier(s, "library") >= c.library && (s.coins || 0) >= c.coins && Object.keys(c.items).every(function (i) { return (b[i] || 0) >= c.items[i]; }) } : null }; }),
      researching: h.research ? { id: h.research.id, name: RESEARCH[h.research.id].name, level: h.research.level, endsIn: Math.max(0, Math.ceil((h.research.until - now) / 1000)) } : null,
      glyphs: GLYPHS.map(function (g) { return { id: g, name: ITEMS[g].name, have: b[g] || 0, from: GLYPH_FROM[g] }; }),
      canDecipher: GLYPHS.every(function (g) { return (b[g] || 0) > 0; }) && !h.research, decipherHours: DECIPHER_HOURS, plagues: h.plagues || 0,
      stars: { night: isNight(now), looked: h.stars === nightOf(now) && isNight(now), name: stars[0], skill: SKILLS[stars[1]].name,
               buff: h.star && h.star.until > now ? { name: h.star.name, skill: SKILLS[h.star.skill].name, endsIn: Math.ceil((h.star.until - now) / 1000) } : null,
               dust: b.stardust || 0 } };
  }

