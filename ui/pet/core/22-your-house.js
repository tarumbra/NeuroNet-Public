  // ---- your house (2026-10-07, Cam: "build a new area called home, inside the home it has different areas
  //      like kitchen where i cook, smithy which has the anvil and furnace, shed which has the tanner and
  //      crafting bench, library which has the herblore, alchemy and gem table. Each area starts off basic
  //      and you have to build house upgrades. This will also become a requirement for being able to craft
  //      higher gear ... a special pet bed will increase the efficiency of a pet resting and depending on
  //      the bed will reduce nap time by 5%, 8%, 10% or 15%") ------------------------------------------
  // Six rooms, four tiers each. A workshop room caps what its benches can make (by recipe level) and
  // gives a little more xp; the bedroom's pet bed shortens naps and your own bed heals you faster; the
  // store room keeps things safe at home, out of your bag. Building trains Construction.
  var HOUSE_TIERS = CONTENT("HOUSE_TIERS");
  var ROOMS = CONTENT("ROOMS");
  var ROOM_ORDER = CONTENT("ROOM_ORDER");
  var ROOM_CAP = CONTENT("ROOM_CAP");                    // the highest recipe level a workshop room's benches can make
  var ROOM_XP = CONTENT("ROOM_XP");                // ...and the extra xp they give
  var NAP_CUT = CONTENT("NAP_CUT");             // the bedroom's pet bed: naps this much shorter
  var REST_HEAL = CONTENT("REST_HEAL");              // your own bed: you heal this much faster
  // the store room is a BANK (2026-10-18, Modernize/Reduce Nav -- it was chests of 13 kinds each): one store of BANK.kinds kinds,
  // sorted into up to BANK.tabs named tabs, RuneScape-style. The old chests' names and contents became the first tabs.
  var BANK = CONTENT("BANK");
  var ROOM_BUILD = CONTENT("ROOM_BUILD");
  var ROOM_OF = {};
  ROOM_ORDER.forEach(function (r) { (ROOMS[r].workshops || []).forEach(function (w) { ROOM_OF[w] = r; }); });
  function house(s) { s.house = s.house || {}; ROOM_ORDER.forEach(function (r) { if (!s.house[r]) s.house[r] = 1; }); return s.house; }
  function roomTier(s, r) { return (s && s.house && s.house[r]) || 1; }
  /** Why a workshop can't make a recipe of this level ("" if it can). */
  function roomLock(s, ws, level) {
    var r = ROOM_OF[ws];
    if (s && s.dev && s.dev.infinite) return "";
    var told = benchStoryLock(s, ws);                                    // the story hasn't got here yet (2026-10-10)
    if (told) return told;
    if (islandOf(s)) {                                                   // on an island: its estate's workshop (2026-10-08)
      var ee = hereEstate(s);
      if (!ee || estateBenches(ee).indexOf(ws) < 0) return "Your estate here has no " + ((WORKSHOPS[ws] && WORKSHOPS[ws].name) || "bench").toLowerCase() + " yet";
      var wt = partTier(ee, "workshop");
      if ((level || 1) <= ROOM_CAP[wt]) return "";
      var wn = 1; while (ROOM_CAP[wn] < level) wn++;
      return "Needs " + aOr(HOUSE_TIERS[wn].toLowerCase()) + " workshop on your estate here";
    }
    if (!r) return "";
    var t = roomTier(s, r);
    if ((level || 1) <= ROOM_CAP[t]) return "";
    var need = 1; while (ROOM_CAP[need] < level) need++;
    return "Needs " + aOr(HOUSE_TIERS[need] + " " + ROOMS[r].name.toLowerCase()) + " (build it at home)";
  }
  function napSpeed(s) { return 1 / (1 - NAP_CUT[roomTier(s, "bedroom")]); }
  function storeHere(s) { var e = islandOf(s) ? hereEstate(s) : null; if (e) { e.store = e.store || {}; return e.store; } s.storage = s.storage || {}; return s.storage; }
  function storeCap(s) { var e = islandOf(s) ? hereEstate(s) : null; return e ? BANK.kinds[partTier(e, "storeroom")] || 0 : BANK.kinds[roomTier(s, "storeroom")] + keeperChests(s) * BANK.keeper; }
  function storeUsed(s) { var st = (islandOf(s) ? (hereEstate(s) || {}).store : s && s.storage) || {}; return Object.keys(st).filter(function (k) { return st[k] > 0; }).length; }
  /** The bank where you are: its tabs (names), and which tab each stored kind is in -- a copy, written back with saveChests.
      Kinds stored without a tab (old saves, or a tab that's gone) go in the first tab; the old chests map onto tabs in order. */
  function chestLayout(s) {
    var e = islandOf(s) ? hereEstate(s) : null, box = e || s || {};
    var sto = (e ? e.store : s && s.storage) || {}, n = storeCap(s) > 0 ? BANK.tabs : 0;
    var m = box.chests || {}, names = (m.names || []).slice(0, n), of = {};
    while (names.length < n) names.push("");
    var used = names.map(function () { return 0; });
    Object.keys(sto).filter(function (k) { return sto[k] > 0; }).sort().forEach(function (k) {
      if (!n) return;
      var c = (m.of || {})[k];
      c = typeof c === "number" && c >= 0 ? Math.min(c, n - 1) : 0;
      of[k] = c; used[c]++;
    });
    return { n: n, names: names, of: of, used: used, box: box };
  }
  function saveChests(L) { L.box.chests = { names: L.names, of: L.of }; }
  function chestName(L, i) { return L.names[i] || (i ? "Tab " + (i + 1) : "Main"); }
  /** A tab in a sentence: "the bank's Ores tab", or "the bank" for the main one with no name. */
  function chestSay(L, i) { return L.names[i] ? "the bank's " + L.names[i] + " tab" : i ? "the bank's tab " + (i + 1) : "the bank"; }
  /** The chests you can craft from (2026-10-10, Cam: "When at player estate (only) all crafting stations should be able to
      auto detect materials in the storeroom"): home's on the main island, an island estate's store room there. */
  function benchStore(s) {
    if (!s || !s.player || s.player.voyage) return null;
    if (islandOf(s)) { var e = hereEstate(s); return e && partTier(e, "storeroom") ? (e.store || {}) : null; }
    return s.storage || {};
  }
  /** Take from the bag first, then the recycled materials (at home, 2026-10-11), then the chests. */
  function takeBench(s, id, n, sto) {
    if (s.dev && s.dev.infinite) return;
    var fromBag = Math.min(n, Math.max(0, s.bag[id] || 0));
    if (fromBag) take(s, id, fromBag);
    n -= fromBag;
    var rec = sto ? recycledHere(s) : null, fromRec = rec ? Math.min(n, Math.max(0, rec[id] || 0)) : 0;
    if (fromRec) { rec[id] -= fromRec; if (rec[id] <= 0) delete rec[id]; n -= fromRec; }
    if (n > 0 && sto) { sto[id] = (sto[id] || 0) - n; if (sto[id] <= 0) delete sto[id]; }
  }
  /** How many a bench can use from your chests and (at home) the recycled materials store. */
  function benchStored(s, sto, id) { var rec = sto ? recycledHere(s) : null; return Math.max(0, (sto && sto[id]) || 0) + Math.max(0, (rec && rec[id]) || 0); }
  function syncRest(s) { s.player.restBonus = restHere(s); }
  /** What each tier of a room does, in words. */
  function tierPerks(r, t) {
    if (ROOMS[r].workshops) return "Makes things up to level " + (ROOM_CAP[t] >= 99 ? "50+" : ROOM_CAP[t]) + (ROOM_XP[t] ? ", +" + Math.round(ROOM_XP[t] * 100) + "% xp" : "");
    if (r === "bedroom") return ROOMS.bedroom.beds[t] + ": naps " + Math.round(NAP_CUT[t] * 100) + "% shorter" + (REST_HEAL[t] ? "; you heal " + Math.round(REST_HEAL[t] * 100) + "% faster" : "");
    if (r === "storeroom") return "A bank of " + BANK.kinds[t] + " kinds of things, in up to " + BANK.tabs + " tabs";
    return "";
  }
  function houseView(s, now) {
    var pl = (s && s.player) || newPlayer(), con = levelOf((pl.skills || {}).construction || 0), b = (s && s.bag) || {}, inf = s && s.dev && s.dev.infinite;
    return { con: con, rooms: ROOM_ORDER.map(function (r) {
      var t = roomTier(s, r), nx = ROOM_BUILD[t + 1];
      var next = nx ? { tier: t + 1, name: HOUSE_TIERS[t + 1], perks: tierPerks(r, t + 1), con: nx.con, coins: nx.coins, xp: nx.xp,
                        needs: Object.keys(nx.needs).map(function (k) { return { id: k, name: ITEMS[k].name, need: nx.needs[k], have: inf ? 999 : b[k] || 0 }; }) } : null;
      if (next) next.can = (inf || con >= nx.con) && (inf || (s.coins || 0) >= nx.coins) && next.needs.every(function (n) { return n.have >= n.need; });
      return { id: r, name: ROOMS[r].name, says: ROOMS[r].says, tier: t, tierName: HOUSE_TIERS[t], perks: tierPerks(r, t), workshops: ROOMS[r].workshops || [], next: next };
    }), storage: { used: storeUsed(s || {}), cap: storeCap(s),
                   here: islandOf(s || {}) ? ISLANDS[islandOf(s)].name + " estate" : "home",
                   items: (function (sto) { return Object.keys(sto).filter(function (k) { return sto[k] > 0 && ITEMS[k]; }).map(function (k) { return { id: k, name: ITEMS[k].name, count: sto[k], gem: ITEMS[k].gem || 0 }; }); })(
                          islandOf(s || {}) ? ((hereEstate(s) || {}).store || {}) : ((s && s.storage) || {}))
                     .sort(function (a, c) { return c.gem - a.gem || a.name.localeCompare(c.name); }),
                   overflow: (!islandOf(s || {}) && s && s.overflow) ? Object.keys(s.overflow).filter(function (k) { return ITEMS[k] && s.overflow[k] > 0; })
                     .map(function (k) { return { id: k, name: ITEMS[k].name, count: s.overflow[k], gem: ITEMS[k].gem || 0 }; })
                     .sort(function (a, c) { return c.gem - a.gem || a.name.localeCompare(c.name); }) : [],
                   chests: (function () {
                     if (!s || !s.player) return [];
                     var L = chestLayout(s), sto = (islandOf(s) ? (hereEstate(s) || {}).store : s.storage) || {};
                     return L.names.map(function (nm, i) {
                       var its = Object.keys(L.of).filter(function (k) { return L.of[k] === i && ITEMS[k]; }).map(function (k) { return { id: k, name: ITEMS[k].name, count: sto[k], gem: ITEMS[k].gem || 0 }; })
                         .sort(function (a, c) { return c.gem - a.gem || a.name.localeCompare(c.name); });
                       return { i: i, name: chestName(L, i), named: !!nm, used: its.length, items: its };
                     });
                   })() } };
  }

