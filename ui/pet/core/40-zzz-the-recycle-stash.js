  // ---- the recycle stash (2026-10-11, Cam: "the ability to trash old or uneeded items ... Place the scroll for the recycle
  //      stash in the centre of the storeroom where the barrels are. You place all items to be recycled there and then after
  //      a specified time they are broken into raw materials, which is placed into recycled materials storage right under
  //      the recycle stash scroll. The raw materials stash can store upto 15 types of materials. It can be upgraded in size
  //      later. Also you can upgrade the recycle stash later to break items down faster. By default take 12 hours. The
  //      materials in the recycled materials storage can be used at the crafting benches on the estate.") ---------------
  // Home only (the store room on the main island). Each lot you put in breaks down on its own clock. What comes back is
  // half of the raw materials it was made from, all the way down (a bronze helmet -> bronze bars -> copper and tin),
  // worked out from the benches' own recipes; food, potions and magic don't come apart. A thing that gives no materials
  // back (a drop, a fish, a berry) becomes recycling points instead, worth half what Marlow pays for it (2026-10-11, Cam:
  // "for recycling materials that dont return anything, have them broken down into recycling points which can then be
  // spent on different raw materials (this way it makes it relevent to recycle stil)"). Points buy any raw material you
  // can gather yourself now, at Marlow's value, into the recycled materials store. Keys, tomes, glyphs and eggs can't go in.
  var RECYCLE = CONTENT("RECYCLE");
  var SALVAGE = null;                              // item -> {raw material: amount in one of it}, worked out once
  function salvageOf(id) {
    if (!SALVAGE) {
      SALVAGE = {};
      var how = {};
      RECYCLE.benches.forEach(function (w) { ((WORKSHOPS[w] && WORKSHOPS[w].recipes) || []).forEach(function (r) { if (!how[r.make]) how[r.make] = r; }); });
      var walk = function (k, seen) {
        if (SALVAGE[k]) return SALVAGE[k];
        var r = how[k];
        if (!r || seen[k]) return null;            // raw (nobody makes it) -- or a loop: stop here
        seen[k] = true;
        var out = {};
        Object.keys(r.needs).forEach(function (m) {
          var per = r.needs[m] / (r.n || 1), down = walk(m, seen);
          if (down) Object.keys(down).forEach(function (x) { out[x] = (out[x] || 0) + per * down[x]; });
          else out[m] = (out[m] || 0) + per;
        });
        delete seen[k];
        return (SALVAGE[k] = out);
      };
      Object.keys(how).forEach(function (k) { walk(k, {}); });
    }
    return SALVAGE[id] || null;
  }
  /** What n of a thing break down into: {material: count}, empty if nothing comes back. */
  function salvage(id, n) {
    var per = salvageOf(id) || {}, out = {};
    Object.keys(per).forEach(function (m) { var c = Math.floor(per[m] * n * RECYCLE.share + 1e-9); if (c > 0 && ITEMS[m]) out[m] = c; });
    return out;
  }
  /** How long a lot of this takes in the stash (ms): 30 minutes a tier of the thing, quicker in a better stash (I4, 2026-10-19:
   *  "30 minutes for low level materials like old boots, then 1 hour for bronze and equivalent, 1 and a half iron ..."). */
  function recycleMs(id, tier) { return Math.round(RECYCLE.minutes * Math.max(1, (ITEMS[id] && ITEMS[id].gem) || 0) * RECYCLE.speed[tier || 1] * MIN); }
  function recycleTime(ms) { var m = Math.round(ms / MIN); return m < 60 ? m + " minutes" : Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : ""); }
  var recycleSpeedText = function (t) { return t > 1 ? Math.round((1 - RECYCLE.speed[t]) * 100) + "% quicker than a simple stash" : "30 minutes for each tier of the thing (old boots 30 min, bronze 1 h, iron 1 h 30 ...)"; };
  /** Recycling points for n of a thing that gives no materials back: half its worth, to the hundredth. */
  function recyclePoints(id, n) { return Object.keys(salvage(id, n)).length ? 0 : Math.floor(priceOf(id) * n * RECYCLE.share * 100) / 100; }
  /** What points can buy: every raw material a gathering spot you can work now gives (its level, its place, its story). */
  var BENCH_USES = null;                           // every raw thing some bench of yours uses (so no old boots or bait)
  function pointsShop(s) {
    if (!BENCH_USES) { BENCH_USES = {}; Object.keys(WORKSHOPS).forEach(function (w) { if (!WORKSHOPS[w].npc) (WORKSHOPS[w].recipes || []).forEach(function (r) { Object.keys(r.needs || {}).forEach(function (k) { BENCH_USES[k] = true; }); }); }); }
    var out = {}, pl = s.player || {};
    GATHERING.forEach(function (k) {
      var lv = levelOf((pl.skills || {})[k] || 0);
      ((SKILLS[k] && SKILLS[k].spots) || []).forEach(function (sp) {
        if (sp.level > lv || spotLock(s, k, sp) || (REGIONS[sp.area] && placeLock(s, sp.area))) return;
        (sp.loot || []).forEach(function (l) { if (ITEMS[l[0]] && BENCH_USES[l[0]] && !recycleKeeps(l[0]) && priceOf(l[0]) > 0) out[l[0]] = true; });
      });
    });
    return Object.keys(out);
  }
  function recycleKeeps(id) { var it = ITEMS[id] || {}; return RECYCLE.keep.some(function (f) { return it[f]; }); }
  function recycleBox(s) {
    s.recycle = s.recycle || {};
    var r = s.recycle;
    r.tier = r.tier || 1; r.storeTier = r.storeTier || 1; r.lots = r.lots || []; r.mats = r.mats || {}; r.points = r.points || 0;
    return r;
  }
  function recycledHere(s) { return s && s.recycle && s.player && !s.player.island && !s.player.voyage ? s.recycle.mats : null; }
  function matKinds(mats) { return Object.keys(mats).filter(function (k) { return mats[k] > 0; }).length; }
  /** Lots whose time has come go into the recycled materials store -- if it has room for every kind they bring. */
  function resolveRecycle(s, now) {
    var r = s.recycle;
    if (!r || !r.lots || !r.lots.length) return;
    var cap = RECYCLE.kinds[r.storeTier || 1];
    r.lots = r.lots.filter(function (lot) {
      if (lot.at && lot.ready > lot.at + recycleMs(lot.id, r.tier)) lot.ready = lot.at + recycleMs(lot.id, r.tier);   // (a lot put in under the old 12 hours finishes on the new time, I4)
      if (lot.ready > now) return true;
      var pts = recyclePoints(lot.id, lot.n);
      if (pts) {                                                        // nothing comes back: recycling points instead
        r.points = Math.round(((r.points || 0) + pts) * 100) / 100;
        note(s, lot.ready, "Recycled " + lot.n + " × " + ITEMS[lot.id].name.toLowerCase() + " into " + Math.floor(pts * 100) / 100 + " recycling points.");
        return false;
      }
      var got = salvage(lot.id, lot.n), fresh = Object.keys(got).filter(function (m) { return !(r.mats[m] > 0); }).length;
      if (matKinds(r.mats) + fresh > cap) {
        if (!lot.full) { lot.full = true; note(s, lot.ready, "The recycle stash has broken down " + lot.n + " × " + ITEMS[lot.id].name.toLowerCase() + ", but the recycled materials store is full (" + cap + " kinds). Use or take some out."); }
        return true;
      }
      Object.keys(got).forEach(function (m) { r.mats[m] = (r.mats[m] || 0) + got[m]; });
      var said = Object.keys(got).map(function (m) { return got[m] + " " + ITEMS[m].name.toLowerCase(); }).join(", ");
      note(s, lot.ready, "Recycled " + lot.n + " × " + ITEMS[lot.id].name.toLowerCase() + (said ? ": " + said + " into the recycled materials store." : " -- nothing to salvage, it's gone."));
      return false;
    });
  }
  function recycleView(s, now) {
    s = s || {};
    var r = s.recycle || {}, tier = r.tier || 1, st = r.storeTier || 1, mats = r.mats || {}, b = s.bag || {}, sto = s.storage || {};
    var con = levelOf(((s.player || {}).skills || {}).construction || 0), inf = s.dev && s.dev.infinite;
    var named = function (o) { return Object.keys(o).filter(function (k) { return ITEMS[k] && o[k] > 0; }).map(function (k) { return { id: k, name: ITEMS[k].name, n: o[k] }; }); };
    var next = function (part, t) {
      var nx = RECYCLE.build[part][t + 1];
      if (!nx) return null;
      var needs = Object.keys(nx.needs).map(function (k) { return { id: k, name: ITEMS[k].name, need: nx.needs[k], have: inf ? 999 : b[k] || 0 }; });
      return { tier: t + 1, name: HOUSE_TIERS[t + 1], con: nx.con, coins: nx.coins, xp: nx.xp, needs: needs,
               does: part === "stash" ? "breaks things down " + recycleSpeedText(t + 1) : "holds " + RECYCLE.kinds[t + 1] + " kinds of material",
               can: (inf || con >= nx.con) && (inf || (s.coins || 0) >= nx.coins) && needs.every(function (n) { return n.have >= n.need; }) };
    };
    var can = {};
    Object.keys(b).concat(Object.keys(sto)).forEach(function (k) { if (ITEMS[k] && !recycleKeeps(k) && ((b[k] || 0) + (sto[k] || 0)) > 0) can[k] = true; });
    return {
      here: !!(s.player && !s.player.island && !s.player.voyage), con: con,
      stash: { tier: tier, tierName: HOUSE_TIERS[tier], speed: recycleSpeedText(tier), max: RECYCLE.lots, next: next("stash", tier),
               lots: (r.lots || []).map(function (lot, i) {
                 return { i: i, id: lot.id, name: ITEMS[lot.id].name, n: lot.n, readyIn: Math.max(0, Math.ceil((lot.ready - (now || 0)) / 1000)),
                          waiting: !!lot.full, gives: named(salvage(lot.id, lot.n)), points: recyclePoints(lot.id, lot.n) }; }) },
      store: { tier: st, tierName: HOUSE_TIERS[st], cap: RECYCLE.kinds[st], used: matKinds(mats), next: next("store", st),
               items: named(mats).sort(function (a, c) { return a.name.localeCompare(c.name); }) },
      points: Math.floor((r.points || 0) * 100) / 100,
      shop: s.player ? pointsShop(s).map(function (k) { return { id: k, name: ITEMS[k].name, price: priceOf(k), have: mats[k] || 0,
                                                                  can: Math.floor(((r.points || 0) + 1e-9) / priceOf(k)) }; })
        .sort(function (a, c) { return a.price - c.price || a.name.localeCompare(c.name); }) : [],
      can: Object.keys(can).map(function (k) { return { id: k, name: ITEMS[k].name, bag: b[k] || 0, stored: sto[k] || 0, gem: ITEMS[k].gem || 0,
                                                        each: named(salvage(k, 2)).map(function (x) { return { id: x.id, name: x.name, n: x.n / 2 }; }),
                                                        points: recyclePoints(k, 1), takes: recycleTime(recycleMs(k, tier)) }; })
        .sort(function (a, c) { return (c.each.length ? 1 : 0) - (a.each.length ? 1 : 0) || c.gem - a.gem || a.name.localeCompare(c.name); })
    };
  }
  /** recycle {id, n, from: bag|chests} · recyclecancel {i} · recycletake {id, n} · recyclebuild {part: stash|store} · recyclebuy {id, n} */
  function recycleAct(s, action, opts, now) {
    if (["recycle", "recyclecancel", "recycletake", "recyclebuild", "recyclebuy"].indexOf(action) < 0) return null;
    var r = recycleBox(s);
    if (action === "recycle") {
      var id = opts.id, it = ITEMS[id], from = opts.from === "chests" ? "chests" : "bag";
      if (!it) return no(s, "There's no such thing.");
      if (recycleKeeps(id)) return no(s, "The " + it.name.toLowerCase() + " is too precious to throw away.");
      var src = from === "chests" ? (s.storage = s.storage || {}) : s.bag, have = Math.max(0, src[id] || 0);
      var n = opts.n === "all" ? have : Math.floor(+opts.n || 1);
      if (n < 1 || have < n) return no(s, "You don't have " + (n > 1 ? n + " of those" : "that") + " in your " + (from === "chests" ? "chests" : "bag") + ".");
      if (r.lots.length >= RECYCLE.lots) return no(s, "The recycle stash is full -- " + RECYCLE.lots + " lots at a time.");
      if (from === "chests") { src[id] -= n; if (src[id] <= 0) delete src[id]; } else take(s, id, n);
      var rms = recycleMs(id, r.tier), hrs = recycleTime(rms);
      r.lots.push({ id: id, n: n, at: now, ready: now + rms });
      var gets = salvage(id, n);
      var pts = recyclePoints(id, n);
      return yes(s, now, "Into the recycle stash: " + n + " × " + it.name.toLowerCase() + (Object.keys(gets).length ? " -- broken down in " + hrs + "."
        : pts ? " -- " + pts + " recycling points in " + hrs + "." : " -- it's worth nothing, so it's simply thrown away in " + hrs + "."));
    }
    if (action === "recyclecancel") {
      var lot = r.lots[opts.i | 0];
      if (!lot) return no(s, "There's nothing like that in the stash.");
      if (!roomFor(s, lot.id) || stackRoom(s, lot.id) < lot.n) return no(s, "Your bag has no room for " + lot.n + " × " + ITEMS[lot.id].name.toLowerCase() + ".");
      r.lots.splice(opts.i | 0, 1);
      give(s, lot.id, lot.n);
      return yes(s, now, "You took the " + ITEMS[lot.id].name.toLowerCase() + " back out of the recycle stash.");
    }
    if (action === "recycletake") {
      var m = opts.id, have2 = r.mats[m] || 0, k = opts.n === "all" ? have2 : Math.floor(+opts.n || 1);
      if (!ITEMS[m] || k < 1 || have2 < k) return no(s, "There isn't that much of it in the recycled materials store.");
      k = Math.min(k, stackRoom(s, m));
      if (k < 1 || !roomFor(s, m)) return no(s, "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + ").");
      r.mats[m] -= k; if (r.mats[m] <= 0) delete r.mats[m];
      give(s, m, k);
      return yes(s, now, "You took " + k + " " + ITEMS[m].name.toLowerCase() + " from the recycled materials store.");
    }
    if (action === "recyclebuy") {                                     // spend recycling points on a raw material
      var bid = opts.id, bit = ITEMS[bid];
      if (!bit || pointsShop(s).indexOf(bid) < 0) return no(s, "Recycling points only buy raw materials you can gather yourself.");
      var price = priceOf(bid), most = Math.floor(((r.points || 0) + 1e-9) / price), bn = opts.n === "max" ? most : Math.floor(+opts.n || 1);
      if (bn < 1 || bn > most) return no(s, "That takes " + Math.ceil(price * Math.max(1, bn) * 100) / 100 + " recycling points -- you have " + Math.floor((r.points || 0) * 100) / 100 + ".");
      if (!(r.mats[bid] > 0) && matKinds(r.mats) >= RECYCLE.kinds[r.storeTier]) return no(s, "The recycled materials store is full (" + RECYCLE.kinds[r.storeTier] + " kinds).");
      r.points = Math.round((r.points - price * bn) * 100) / 100;
      r.mats[bid] = (r.mats[bid] || 0) + bn;
      return yes(s, now, bn + " " + bit.name.toLowerCase() + " for " + Math.round(price * bn * 100) / 100 + " recycling points -- in the recycled materials store.");
    }
    if (action === "recyclebuild") {
      var part = opts.part === "store" ? "store" : "stash", key = part === "store" ? "storeTier" : "tier", t = r[key];
      var nx = RECYCLE.build[part][t + 1], inf = s.dev && s.dev.infinite;
      var what = part === "store" ? "recycled materials store" : "recycle stash";
      if (!nx) return no(s, "The " + what + " is as grand as it gets.");
      var con = levelOf(s.player.skills.construction || 0);
      if (!inf && con < nx.con) return no(s, "That needs Construction level " + nx.con + " (you're " + con + ").");
      var short = Object.keys(nx.needs).filter(function (q) { return !has(s, q, nx.needs[q]); });
      if (short.length) return no(s, "Not enough " + short.map(function (q) { return ITEMS[q].name.toLowerCase(); }).join(" or ") + " -- it takes " + itemsText(nx.needs) + ".");
      if (!inf && !hasCoins(s, nx.coins)) return no(s, "It costs " + nx.coins + " coins -- you have " + (s.coins || 0) + ".");
      Object.keys(nx.needs).forEach(function (q) { take(s, q, nx.needs[q]); });
      spend(s, nx.coins);
      r[key] = t + 1;
      var cb = levelOf(s.player.skills.construction || 0);              // Construction xp, as building a room gives
      s.player.skills.construction = Math.round(((s.player.skills.construction || 0) + nx.xp * noviceMult(cb)) * 10) / 10;
      if (levelOf(s.player.skills.construction) > cb) note(s, now, "You reached Construction level " + levelOf(s.player.skills.construction) + "!");
      return yes(s, now, "You built " + aOr(HOUSE_TIERS[t + 1].toLowerCase()) + " " + what + " (+" + nx.xp + " Construction xp) -- it " +
                 (part === "store" ? "holds " + RECYCLE.kinds[t + 1] + " kinds of material." : "breaks things down " + recycleSpeedText(t + 1) + "."));
    }
    return null;
  }
