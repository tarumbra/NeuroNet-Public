  // ---- the Marketplace and Larceny (2026-10-17) ---------------------------------------------------------------------------
  //      Cam: "The thief should also get the ability to steal, pickpocket etc. This could be in the form of a new area called
  //      marketplace (A new map that has multiple stores, when as a thief class you can attempt to steal from them, this will
  //      need to be balanced and add a new skill (this skill can be a carry over from thief when changing class)". V4 carried
  //      8-1 (the Economist's conditions met: coins from pockets only, stalls' own goods from a slow stock); Cam's calls in Q4:
  //      the skill is Larceny ("so it can include lockpicking"), everyone can buy, class trade perks, caught = a fine, a stun,
  //      a watching keeper and, caught often, an hour's ban; never hurt; idle and played; locked crates while hunting.
  //   - STEAL {target} -- one try, played (a store's id or a mark's); STEALTRIP {target} -- keep trying while you're away
  //     (a trip: s.player.job with steal: true, through runTrip -> stealTry); MARKET {op: buy | sell, store, item, n};
  //   - s.market = { stock: {store: {n, at}}, watch: {store: until}, caught: [times], banUntil, lastTry, seed };
  //     s.player.stunUntil. The sandbox's warp moves them all (shift()).
  var MARKET = CONTENT("MARKET");
  var LOCKED_CRATES = CONTENT("LOCKED_CRATES");
  var MR = MARKET.rules;
  var MARKET_BY = {};
  MARKET.stores.forEach(function (st) { st.kind = "store"; st.area = "village"; st.time = MR.idleMs / 1000; MARKET_BY[st.id] = st; });
  MARKET.marks.forEach(function (mk) { mk.kind = "mark"; mk.area = "village"; mk.time = MR.idleMs / 1000; mk.loot = mk.loot || []; MARKET_BY[mk.id] = mk; });
  // the locked crates: crates you open by picking their lock (the open act reads cr.lock)
  Object.keys(LOCKED_CRATES).forEach(function (id) {
    if (id === "//") return;
    var L = LOCKED_CRATES[id];
    ITEMS[id] = { name: L.name, gem: 4, crate: true, price: 0, about: "A lock to pick: Larceny " + L.lock + "." };
    CRATES[id] = { rolls: L.rolls, level: 20, loot: L.loot, lock: L.lock, lockXp: L.xp, coins: L.coins };
  });
  /** spotOf's market targets (a stealing trip's "spot"). */
  function marketTarget(id) { return MARKET_BY[id] || null; }
  function marketBox(s) {
    var m = s.market = s.market && typeof s.market === "object" ? s.market : {};
    m.stock = m.stock || {}; m.watch = m.watch || {}; m.caught = m.caught || [];
    if (typeof m.seed !== "number") m.seed = 0x5eed1e55;
    return m;
  }
  /** Thieves -- and anyone with the Pickpocketing technique slotted (Cam: "a carry over from thief when changing class"). */
  function canSteal(pl) { return !!pl && (pl.cls === "thief" || !!talentSum(pl).larcenyUse); }
  function larcenyLevel(pl) { return levelOf(((pl && pl.skills) || {}).larceny || 0); }
  function stealChance(pl, T) {
    var p = MR.base + MR.perLevel * (larcenyLevel(pl) - T.level) - (pl.cls === "thief" ? 0 : MR.offClass);
    return Math.max(MR.min, Math.min(MR.max, p));
  }
  /** A stall's goods left now: it refills one every restockMs, up to stockCap. */
  function stockOf(s, id, at) {
    var m = marketBox(s), k = m.stock[id];
    if (!k) return MR.stockCap;
    return Math.min(MR.stockCap, k.n + Math.floor(Math.max(0, at - k.at) / MR.restockMs));
  }
  function takeStock(s, id, at) {
    var m = marketBox(s), n = stockOf(s, id, at), k = m.stock[id];
    // keep the part-way refill: the clock moves on by the whole refills counted, not to now
    var since = k ? k.at + Math.floor(Math.max(0, at - k.at) / MR.restockMs) * MR.restockMs : at;
    m.stock[id] = { n: n - 1, at: n >= MR.stockCap ? at : since };
  }
  function banLeft(s, at) { return Math.max(0, (marketBox(s).banUntil || 0) - at); }
  function watchLeft(s, id, at) { return Math.max(0, (marketBox(s).watch[id] || 0) - at); }
  function stunLeft(s, at) { return Math.max(0, ((s.player && s.player.stunUntil) || 0) - at); }
  /** Why you can't try `T` now ("" if you can). */
  function stealWhyNot(s, T, at) {
    var pl = s.player;
    if (!T) return "There's nobody like that in the market.";
    if (!canSteal(pl)) return "Only a Thief steals -- or another class with the Pickpocketing technique slotted.";
    if (islandOf(s)) return "The Marketplace is on the main island.";
    if (banLeft(s, at)) return MARKET.guard.name + " threw you out -- back in " + Math.ceil(banLeft(s, at) / MIN) + " min.";
    if (stunLeft(s, at)) return "You're still seeing stars -- " + Math.ceil(stunLeft(s, at) / 1000) + " s.";
    if (larcenyLevel(pl) < T.level) return (T.kind === "store" ? "The " + T.name.toLowerCase() : T.name) + " needs Larceny level " + T.level + ".";
    if (T.kind === "store" && watchLeft(s, T.id, at)) return T.keeper + " is watching you -- " + Math.ceil(watchLeft(s, T.id, at) / MIN) + " min.";
    if (T.kind === "store" && stockOf(s, T.id, at) < 1) return "The " + T.name.toLowerCase() + " is picked clean for now.";
    return "";
  }
  /** One try at `T`: success (Larceny xp, the goods or the coins), a quiet miss, or caught. holder rolls the dice. */
  function stealOnce(s, pl, T, at, holder) {
    var m = marketBox(s), out = { ok: false, caught: false, got: {}, coins: 0, fine: 0, banned: false };
    if (rnd(holder) < stealChance(pl, T)) {
      out.ok = true;
      addXp(s, pl, "larceny", T.xp, at);
      if (T.kind === "store") { var g = pick(holder, T.loot); swagAdd(s, g, 1); out.got[g] = 1; takeStock(s, T.id, at); }
      else {
        out.coins = T.coins[0] + Math.floor(rnd(holder) * (T.coins[1] - T.coins[0] + 1));
        if (T.rare && rnd(holder) < T.rare[1]) { swagAdd(s, T.rare[0], 1); out.got[T.rare[0]] = 1; }
      }
      if (out.coins) swagAdd(s, "", out.coins);                         // a purse: its coins are hot too -- Nell's (2026-10-17)
      return out;
    }
    if (rnd(holder) >= MR.caughtShare) return out;                       // a miss nobody saw
    out.caught = true;
    out.fine = Math.min(s.coins || 0, T.fine);
    s.coins = (s.coins || 0) - out.fine;
    pl.stunUntil = at + MR.stunMs;
    if (T.kind === "store") m.watch[T.id] = at + MR.watchMs;
    m.caught = m.caught.filter(function (t) { return at - t < MR.banWindow; }).concat([at]);
    if (m.caught.length >= MR.banAfter) { m.banUntil = at + MR.banMs; m.caught = []; out.banned = true; }
    return out;
  }
  function caughtText(T, r) {
    var who = T.kind === "store" ? T.keeper : T.name.charAt(0).toLowerCase() + T.name.slice(1);
    return "Caught! " + who.charAt(0).toUpperCase() + who.slice(1) + " grabbed your wrist" + (r.fine ? " -- a fine of " + r.fine + " coin" + (r.fine === 1 ? "" : "s") : "") + "." +
           (r.banned ? " " + MARKET.guard.name + " marched you out of the market: not for an hour." : T.kind === "store" ? " " + T.keeper + "'ll be watching you for a while." : "");
  }
  /** runTrip's step for a stealing trip. true when it moved j.next itself (a wait) or ended the trip. */
  function stealTry(s, pl, j, at) {
    var T = marketTarget(j.spot);
    if (banLeft(s, at)) { note(s, at, MARKET.guard.name + " won't let you back in yet."); endTrip(s, pl, at, "stop"); return true; }
    if (stunLeft(s, at)) { j.next = pl.stunUntil; return true; }
    if (T.kind === "store" && watchLeft(s, T.id, at)) { j.next = marketBox(s).watch[T.id]; return true; }   // wait till the keeper looks away
    if (T.kind === "store" && stockOf(s, T.id, at) < 1) {              // picked clean: wait for the stall to fill up again (the stall is the cap)
      var k = marketBox(s).stock[T.id]; j.next = k.at + MR.restockMs * (Math.floor(Math.max(0, at - k.at) / MR.restockMs) + 1); return true;
    }
    var r = stealOnce(s, pl, T, at, j);
    if (r.ok) { j.count = (j.count || 0) + 1; j.xp = Math.round(((j.xp || 0) + T.xp) * 10) / 10; }
    Object.keys(r.got).forEach(function (k) { j.items[k] = (j.items[k] || 0) + r.got[k]; });
    if (r.coins) j.coins = (j.coins || 0) + r.coins;
    if (r.caught) {
      j.caught = (j.caught || 0) + 1; j.fines = (j.fines || 0) + r.fine;
      note(s, at, caughtText(T, r));
      if (r.banned) { endTrip(s, pl, at, "stop"); return true; }
    }
    return false;
  }
  // ---- the swag sack and the fence (2026-10-17, Cam: "balance the thieving with having to sell goods to a fence who take a cut ...
  //      the fence is the thief tutor") -- Nell the Fence, in her back room off the market. Stolen goods and purses never touch
  //      your bag: they're in the sack until she buys them, for what they're worth less her cut.
  var FENCE = MARKET.fence;
  function swagOf(s) { var m = marketBox(s); m.swag = m.swag || { items: {}, coins: 0 }; m.swag.items = m.swag.items || {}; return m.swag; }
  function swagAdd(s, id, n) { var w = swagOf(s); if (id) w.items[id] = (w.items[id] || 0) + n; else w.coins = (w.coins || 0) + n; }
  /** What the sack's worth (before Nell's cut), and what she pays. */
  function swagWorth(s) { var w = swagOf(s); return Object.keys(w.items).reduce(function (a, k) { return a + eachFor(k, 1) * w.items[k]; }, w.coins || 0); }
  function fencePays(s) { return Math.floor(swagWorth(s) * (1 - FENCE.cut)); }
  function fenceAct(s, now) {
    if (islandOf(s)) return no(s, FENCE.name + "'s back room is off the Marketplace, on the main island.");
    var w = swagOf(s), worth = swagWorth(s);
    if (!worth && !Object.keys(w.items).length) return no(s, "Your swag sack's empty -- " + FENCE.name.split(" ")[0] + " has nothing to buy.");
    var paid = fencePays(s), what = itemsText(w.items) + (w.coins ? (Object.keys(w.items).length ? " and " : "") + w.coins + " coins from purses" : "");
    s.coins = (s.coins || 0) + paid;
    marketBox(s).swag = { items: {}, coins: 0 };
    return yes(s, now, FENCE.name + " took " + what + " -- worth " + Math.round(worth) + ", and she paid you " + paid + " coin" + (paid === 1 ? "" : "s") + " (her cut: " + Math.round(FENCE.cut * 100) + "%).");
  }
  /** A cleared expedition: a pet comes home with a locked crate now and then -- for an owner with the Keen Eye (who can steal).
   *  Rolls nothing for anyone else (their runs come out as before). The area's level picks the lock. */
  function expeditionLockDrop(s, area, got, job, findMore) {
    if (!canSteal(s.player) || rnd(job) >= MR.expeditionLock * (findMore || 1)) return;
    var lv = (area && area.level) || 1, id = "lockbox";
    Object.keys(LOCKED_CRATES).forEach(function (k) { if (k !== "//" && LOCKED_CRATES[k].ground <= lv && LOCKED_CRATES[k].ground >= LOCKED_CRATES[id].ground) id = k; });
    got[id] = (got[id] || 0) + 1;
  }
  // ---- buying and selling: everyone ----
  var MARKET_FISH = null;
  function isRawFood(id) {
    if (!MARKET_FISH) { MARKET_FISH = {}; SKILLS.fishing.spots.forEach(function (sp) { sp.loot.forEach(function (l) { if (MARKET.notFish.indexOf(l[0]) < 0) MARKET_FISH[l[0]] = 1; }); }); }
    return /^raw/.test(id) || !!MARKET_FISH[id];
  }
  function madeAt(ws, id) { return !!WORKSHOPS[ws] && WORKSHOPS[ws].recipes.some(function (r) { return r.make === id; }); }
  /** Does this store buy it? */
  function storeBuys(st, id) {
    if (!ITEMS[id] || ITEMS[id].crate || ITEMS[id].bound) return false;      // (bound: a mastery's keepsake, V6)
    if (st.buys === "raw") return isRawFood(id);
    if (st.buys === "potions") return madeAt("apothecary", id);
    if (st.buys === "gems") return madeAt("gemology", id);
    if (st.buys === "curios") return MARKET.curios.indexOf(id) >= 0;
    return false;
  }
  function perkFor(pl, st, kind) {
    var out = { pct: 0, why: "" };
    [pl.cls, "all"].forEach(function (k) {
      var P = MARKET.perks[k];
      if (!P || !P[kind] || (P.at && P.at.indexOf(st.id) < 0)) return;
      if (P[kind] > out.pct) { out.pct = P[kind]; out.why = P.why; }
    });
    return out;
  }
  /** The store's price (storeFloor: Cam's 2.5 x materials, never under 2 x value), less a class's discount -- which never takes
   *  it under 2.5 x materials or under floorMult x value (above anything a buyer pays: no buy-low-sell-high). */
  function buyPrice(pl, st, id) {
    var full = storeFloor(id), d = perkFor(pl, st, "buy").pct, low = Math.ceil(Math.max(materialCost(id) * STORE_RULE, priceOf(id) * MR.floorMult));
    return Math.max(1, low, Math.ceil(full * (1 - d)));
  }
  function sellEach(pl, st, id) { return eachFor(id, 1) * (1 + perkFor(pl, st, "sell").pct); }
  function marketAct(s, action, opts, now) {
    if (action === "steal" || action === "stealtrip") {
      var T = marketTarget(opts.target), why = stealWhyNot(s, T, now), pl = s.player;
      if (why) return no(s, why);
      if (pl.job && !(pl.job.steal && action === "steal")) {
        if (action === "steal") return no(s, "You're out " + SKILLS[pl.job.skill].verb + " -- come home first.");
        endTrip(s, pl, now, "stop");
      }
      if (action === "stealtrip") {
        pl.job = { skill: "larceny", spot: T.id, steal: true, since: now, next: now + MR.idleMs, until: now + JOB_MAX, every: MR.idleMs, xpBonus: 0, rareMult: 1,
                   count: 0, xp: 0, items: {}, coins: 0, seed: (typeof opts.roll === "number" ? Math.floor(opts.roll * 4294967296) : now) | 0 };
        return yes(s, now, "You drift into the crowd by the " + (T.kind === "store" ? T.name.toLowerCase() : "stalls") + " -- you'll keep trying while you're away.");
      }
      var m = marketBox(s);
      if (m.lastTry && now - m.lastTry < MR.tryMs) return no(s, "Easy -- wait a moment, or they'll notice.");
      m.lastTry = now;
      var r = stealOnce(s, pl, T, now, m);
      if (r.ok) return yes(s, now, (T.kind === "store" ? "You lifted " + itemsText(r.got) + " from the " + T.name.toLowerCase() : "You picked " + T.name.toLowerCase() + "'s pocket: " +
                       r.coins + " coin" + (r.coins === 1 ? "" : "s") + (Object.keys(r.got).length ? " and " + itemsText(r.got) : "")) + " -- into your swag sack (+" + T.xp + " Larceny xp).");
      if (r.caught) return yes(s, now, caughtText(T, r));
      return yes(s, now, "Not this time -- nobody noticed.");
    }
    if (action === "fence") return fenceAct(s, now);
    if (action !== "market") return null;
    var st = MARKET_BY[opts.store], it = ITEMS[opts.item], pl2 = s.player;
    if (!st || st.kind !== "store") return no(s, "There's no store like that.");
    if (islandOf(s)) return no(s, "The Marketplace is on the main island.");
    if (banLeft(s, now)) return no(s, MARKET.guard.name + " threw you out -- back in " + Math.ceil(banLeft(s, now) / MIN) + " min.");
    if (!it) return no(s, "There's nothing like that.");
    if (opts.op === "buy") {
      if (st.sells.indexOf(opts.item) < 0) return no(s, st.keeper + " doesn't sell that.");
      var n = Math.max(1, Math.min(100, opts.n | 0 || 1)), each = buyPrice(pl2, st, opts.item), cost = each * n;
      if ((s.coins || 0) < cost && !(s.dev && s.dev.infinite)) return no(s, n + " × " + it.name.toLowerCase() + " costs " + cost.toLocaleString() + " coins.");
      if (!roomFor(s, opts.item)) return no(s, "Your bag is full.");
      if (!(s.dev && s.dev.infinite)) s.coins -= cost;
      give(s, opts.item, n, true);
      return yes(s, now, "Bought " + (n > 1 ? n + " × " : "") + it.name.toLowerCase() + " from " + st.keeper + " for " + cost.toLocaleString() + " coin" + (cost === 1 ? "" : "s") + ".");
    }
    if (opts.op === "sell") {
      if (boundWhy(opts.item)) return no(s, boundWhy(opts.item));            // (a mastery's keepsake, V6)
      if (!storeBuys(st, opts.item)) return no(s, st.keeper + " doesn't buy that.");
      if (!has(s, opts.item)) return no(s, "You haven't got that.");
      var keep = Object.keys(pl2.gear || {}).some(function (k) { return pl2.gear[k] === opts.item; }) ? 1 : 0;
      var max = (s.bag[opts.item] || 0) - keep;
      if (max <= 0) return no(s, "That's the one you're using -- take it off first.");
      var sn = opts.n === "all" ? max : Math.max(1, Math.min(max, opts.n | 0 || 1)), e = sellEach(pl2, st, opts.item);
      var paid = e >= 1 ? Math.round(e * sn) : Math.floor(e * sn), pk = perkFor(pl2, st, "sell");
      take(s, opts.item, sn);
      s.coins = (s.coins || 0) + paid;
      return yes(s, now, "Sold " + (sn > 1 ? sn + " × " : "") + it.name.toLowerCase() + " to " + st.keeper + " for " + paid + " coin" + (paid === 1 ? "" : "s") + (pk.pct ? " (" + pk.why + ")" : "") + ".");
    }
    return no(s, "Buy or sell?");
  }
  /** A hunting win: a Thief (or a technique-borrower) finds a locked crate now and then -- the ground's level picks which.
   *  Rolls nothing for anyone else, so their hunts come out as they always did. */
  function lockedCrateDrop(s, pl, j, mon, ground, at) {
    if (pl !== s.player || !canSteal(pl) || rnd(j) >= MR.lockChance) return;
    var lv = (ground && ground.level) || 1, id = "lockbox";
    Object.keys(LOCKED_CRATES).forEach(function (k) { if (k !== "//" && LOCKED_CRATES[k].ground <= lv && LOCKED_CRATES[k].ground >= LOCKED_CRATES[id].ground) id = k; });
    give(s, id, 1, true);
    j.items[id] = (j.items[id] || 0) + 1;
  }
  /** The Marketplace page. */
  function marketView(s, now) {
    var pl = s.player, steal = canSteal(pl), job = pl.job && pl.job.steal ? pl.job : null;
    var tgt = function (T) {
      return { id: T.id, name: T.name, level: T.level, xp: T.xp, fine: T.fine, chance: steal ? Math.round(stealChance(pl, T) * 100) : 0, why: steal ? stealWhyNot(s, T, now) : "",
               here: !!job && job.spot === T.id };
    };
    var sw = swagOf(s);
    return { fence: { name: FENCE.name, where: FENCE.where, look: FENCE.look, says: FENCE.says, cut: FENCE.cut, items: Object.keys(sw.items).map(function (k) { return { id: k, name: ITEMS[k].name, n: sw.items[k] }; }),
                      coins: sw.coins || 0, worth: Math.round(swagWorth(s)), pays: fencePays(s) },
             name: MARKET.name, guard: MARKET.guard, island: !!islandOf(s), canSteal: steal, thief: pl.cls === "thief", level: larcenyLevel(pl),
             banLeft: banLeft(s, now), stunLeft: stunLeft(s, now), caught: marketBox(s).caught.filter(function (t) { return now - t < MR.banWindow; }).length, banAfter: MR.banAfter,
             job: job ? { target: job.spot, name: MARKET_BY[job.spot].name, count: job.count || 0, coins: job.coins || 0, caught: job.caught || 0, xp: job.xp || 0, items: job.items } : null,
             stores: MARKET.stores.map(function (st) {
               var bp = perkFor(pl, st, "buy"), sp = perkFor(pl, st, "sell");
               return Object.assign(tgt(st), { kind: "store", keeper: st.keeper, look: st.look, says: st.says, stock: stockOf(s, st.id, now), cap: MR.stockCap, watchLeft: watchLeft(s, st.id, now),
                 sells: st.sells.filter(function (id) { return ITEMS[id]; }).map(function (id) { return { id: id, name: ITEMS[id].name, price: buyPrice(pl, st, id) }; }).sort(function (a, c) { return a.name.localeCompare(c.name); }),   // A to Z (PT24)
                 buys: st.buys ? Object.keys(s.bag || {}).filter(function (id) { return (s.bag[id] || 0) > 0 && storeBuys(st, id); }).map(function (id) {
                   var e = sellEach(pl, st, id); return { id: id, name: ITEMS[id].name, have: s.bag[id], each: Math.round(e * 100) / 100 }; }).sort(function (a, c) { return a.name.localeCompare(c.name); }) : null,
                 buysWhat: { raw: "raw fish and meat", potions: "potions, draughts and salves", gems: "cut gems and jewellery", curios: "curios and old things" }[st.buys] || "",
                 buyPerk: bp.pct ? Math.round(bp.pct * 100) + "% off -- " + bp.why : "", sellPerk: sp.pct ? "+" + Math.round(sp.pct * 100) + "% -- " + sp.why : "" });
             }),
             marks: MARKET.marks.map(function (mk) { return Object.assign(tgt(mk), { kind: "mark", coins: mk.coins }); }) };
  }
  // ---- the Keen Eye: a sealed crypt in the Pyramid (2026-10-17, Cam: "Maybe the pyrimid challenges can even include locked crypts
  //      and stuff, that only thieves can spot because of their Keen Eye") -- one a day, in one of the first chambers.
  var PYR_CRYPT = CONTENT("PYR_CRYPT");
  function pyrCryptAt(day) { return Math.floor(rnd(pyrSeed(day, 3)) * PYR_CRYPT.chambers); }
  /** For pyramidView: the crypt, if your eye's keen enough to see it (null otherwise). */
  function pyrCryptView(s, now, py) {
    var pl = s.player || {};
    if (!canSteal(pl)) return null;
    var at = pyrCryptAt(pyrDay(now));
    if ((py.at || 0) < at) return null;                                // not there yet
    var lv = larcenyLevel(pl);
    return { chamber: at, req: PYR_CRYPT.req, level: lv, chance: pyrChance(lv, PYR_CRYPT.req), done: py.crypt || "" };
  }
  /** pyramid {op: "crypt"} -- pick it. */
  function pyrCryptAct(s, py, now, job) {
    var pl = s.player, at = pyrCryptAt(py.day);
    if (!canSteal(pl) || (py.at || 0) < at) return no(s, "There's nothing there but stone.");
    if (py.crypt) return no(s, py.crypt === "opened" ? "You've emptied the crypt today." : "The crypt's sealed for today.");
    if (larcenyLevel(pl) < PYR_CRYPT.req) return no(s, "A lock like that needs Larceny " + PYR_CRYPT.req + " -- you'd only jam it.");
    var msg;
    if (rnd(job) < pyrChance(larcenyLevel(pl), PYR_CRYPT.req)) {
      var L = pyrLoot(job, false), items = {}, keys = Object.keys(L.items).slice(0, PYR_CRYPT.picks);
      keys.forEach(function (k) { items[k] = L.items[k]; give(s, k, L.items[k], true); });
      var coins = PYR_CRYPT.coins[0] + Math.floor(rnd(job) * (PYR_CRYPT.coins[1] - PYR_CRYPT.coins[0] + 1));
      s.coins = (s.coins || 0) + coins;
      addXp(s, pl, "larceny", PYR_CRYPT.xp, now);
      py.crypt = "opened";
      msg = "Keen Eye: behind a loose stone, a sealed crypt -- you picked it (+" + PYR_CRYPT.xp + " Larceny xp): " + coins + " coins" + (keys.length ? ", " + itemsText(items) : "") + ".";
    } else {
      pl.hp = Math.max(1, Math.round(pl.hp - Math.ceil(maxHp(pl) * PYR_CRYPT.hurt)));
      addXp(s, pl, "larceny", Math.round(PYR_CRYPT.xp / 5), now);
      py.crypt = "sealed";
      msg = "Keen Eye: a sealed crypt -- but the lock bit back with a poisoned dart, and the stone slid shut for the day.";
    }
    py.log.push(msg);
    return yes(s, now, msg);
  }

