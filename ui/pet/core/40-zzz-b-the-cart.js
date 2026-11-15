  // ---- the cart (2026-10-11, Cam: "a cart (which you can sell straight to the merchant straight from all the estate storage
  //      and bag) you send it off and in 4 hours receive the money when the cart comes back. Later you can upgrade the cart,
  //      get a horse etc." -- and: "Marlows full price", "happy with proposed cart tiers") ------------------------------------
  // Home only. Load it from your bag, your chests and the recycled materials; send it to Marlow; the coins come when it's
  // back. It pays exactly what Marlow would (sellFor), and never takes the one you're wearing or using, a crate, or anything
  // too precious to throw away (keys, tomes, glyphs, eggs). One trip at a time. The bigger carts need animals from the
  // Farm's Stable (to come), and the merchant's wagon a word from Marlow too -- until then they show what they're waiting for.
  var CART = CONTENT("CART");
  var CART_FROM = CONTENT("CART_FROM");
  function cartBox(s) { s.cart = s.cart || {}; s.cart.tier = s.cart.tier || 0; s.cart.load = s.cart.load || {}; return s.cart; }
  function cartSource(s, from) { return from === "chests" ? (s.storage = s.storage || {}) : from === "recycled" ? recycleBox(s).mats : s.bag; }
  function usingIt(s, id) {
    var pl = s.player, it = ITEMS[id] || {};
    return (it.tool && pl.tools[it.tool.skill] === id) || Object.keys(pl.gear || {}).some(function (g) { return pl.gear[g] === id; });
  }
  /** How many of a thing the cart may take from a store: all of it, less the one you're using (from the bag). */
  function cartSpare(s, id, from) {
    var it = ITEMS[id];
    if (!it || it.crate || recycleKeeps(id)) return 0;
    var have = Math.max(0, cartSource(s, from)[id] || 0);
    return from === "bag" && usingIt(s, id) ? Math.max(0, have - 1) : have;
  }
  function loadCount(l) { return CART_FROM.reduce(function (a, f) { return a + (l[f] || 0); }, 0); }
  /** What waits for a cart tier you can't build yet: its animal (the Farm's Stable) and, for the last, Marlow's word. */
  function cartLock(s, t) {                                             // (2026-10-12, Farm step 6: the Stable's ponies and draft horses)
    var b = CART.build[t];
    if (!b || !b.animal) return "";
    var out = [];
    if (ranchCount(s, b.kind) < b.count) out.push(b.animal + " in your Stable on the Farm" + (ranchOpen(s) ? "" : " (the Farm opens with Fern's quest)"));
    if (b.quest && ((s.cart || {}).trips || 0) < CART.trust) out.push("Marlow's word -- he trusts you with his wagon after " + CART.trust + " cart loads (" + ((s.cart || {}).trips || 0) + " so far)");
    return out.length ? "Needs " + out.join(", and ") : "";
  }
  function resolveCart(s, now) {
    var c = s.cart;
    if (!c || !c.out || c.out.back > now) return;
    s.coins = (s.coins || 0) + c.out.pay;
    note(s, c.out.back, "The cart's back from Marlow: " + c.out.pay.toLocaleString() + " coins for " + c.out.kinds + " kind" + (c.out.kinds === 1 ? "" : "s") + " of things.");
    delete c.out;
  }
  function cartView(s, now) {
    s = s || {};
    var c = s.cart || {}, t = c.tier || 0, load = c.load || {}, b = s.bag || {}, inf = s.dev && s.dev.infinite;
    var con = levelOf(((s.player || {}).skills || {}).construction || 0), bonus = CART.bonus[t] || 1;
    var nx = CART.build[t + 1], next = null;
    if (nx) {
      var needs = Object.keys(nx.needs).map(function (k) { return { id: k, name: ITEMS[k].name, need: nx.needs[k], have: inf ? 999 : b[k] || 0 }; });
      var lock = s.player ? cartLock(s, t + 1) : "";
      next = { tier: t + 1, name: CART.names[t + 1], hours: CART.hours[t + 1], kinds: CART.kinds[t + 1], bonus: CART.bonus[t + 1], pulled: CART.pulled[t + 1],
               con: nx.con, coins: nx.coins, xp: nx.xp, needs: needs, lock: lock,
               can: !lock && (inf || con >= nx.con) && (inf || (s.coins || 0) >= nx.coins) && needs.every(function (n) { return n.have >= n.need; }) };
    }
    var rows = Object.keys(load).filter(function (k) { return ITEMS[k] && loadCount(load[k]) > 0; }).map(function (k) {
      var n = loadCount(load[k]);
      return { id: k, name: ITEMS[k].name, n: n, from: load[k], pay: Math.floor(sellFor(k, n, 1) * bonus) };
    }).sort(function (a, z) { return z.pay - a.pay; });
    var can = {};
    if (s.player) CART_FROM.forEach(function (f) { Object.keys(cartSource(s, f)).forEach(function (k) { if (cartSpare(s, k, f) > 0) can[k] = true; }); });
    return {
      here: !!(s.player && !s.player.island && !s.player.voyage), con: con, tier: t, name: CART.names[t], hours: CART.hours[t], kinds: CART.kinds[t],
      pulled: CART.pulled[t], bonus: bonus, next: next,
      out: c.out ? { backIn: Math.max(0, Math.ceil((c.out.back - (now || 0)) / 1000)), pay: c.out.pay, kinds: c.out.kinds } : null,
      load: rows, total: rows.reduce(function (a, r) { return a + r.pay; }, 0),
      can: t ? Object.keys(can).map(function (k) {
        return { id: k, name: ITEMS[k].name, each: eachFor(k, 1) * bonus, gem: ITEMS[k].gem || 0, loaded: load[k] ? loadCount(load[k]) : 0,
                 bag: cartSpare(s, k, "bag"), chests: cartSpare(s, k, "chests"), recycled: cartSpare(s, k, "recycled") };
      }).sort(function (a, z) { return (z.each * (z.bag + z.chests + z.recycled)) - (a.each * (a.bag + a.chests + a.recycled)) || a.name.localeCompare(z.name); }) : []
    };
  }
  /** cartbuild · cartload {id, from: bag|chests|recycled, n} · cartunload {id} · cartsend */
  function cartAct(s, action, opts, now) {
    if (["cartbuild", "cartload", "cartunload", "cartsend"].indexOf(action) < 0) return null;
    var c = cartBox(s), inf = s.dev && s.dev.infinite;
    if (action === "cartbuild") {
      var t = c.tier, nx = CART.build[t + 1];
      if (!nx) return no(s, "The merchant's wagon is as grand as it gets.");
      var lock = cartLock(s, t + 1);
      if (lock) return no(s, "The " + CART.names[t + 1].toLowerCase() + " " + lock.charAt(0).toLowerCase() + lock.slice(1) + ".");
      var con = levelOf(s.player.skills.construction || 0);
      if (!inf && con < nx.con) return no(s, "That needs Construction level " + nx.con + " (you're " + con + ").");
      var short = Object.keys(nx.needs).filter(function (q) { return !has(s, q, nx.needs[q]); });
      if (short.length) return no(s, "Not enough " + short.map(function (q) { return ITEMS[q].name.toLowerCase(); }).join(" or ") + " -- it takes " + itemsText(nx.needs) + ".");
      if (!inf && !hasCoins(s, nx.coins)) return no(s, "It costs " + nx.coins + " coins -- you have " + (s.coins || 0) + ".");
      Object.keys(nx.needs).forEach(function (q) { take(s, q, nx.needs[q]); });
      spend(s, nx.coins);
      c.tier = t + 1;
      var cb = levelOf(s.player.skills.construction || 0);              // Construction xp, as building a room gives
      s.player.skills.construction = Math.round(((s.player.skills.construction || 0) + nx.xp * noviceMult(cb)) * 10) / 10;
      if (levelOf(s.player.skills.construction) > cb) note(s, now, "You reached Construction level " + levelOf(s.player.skills.construction) + "!");
      return yes(s, now, (t ? "You built the " + CART.names[t + 1].toLowerCase() : "You built a cart shed, with a hand cart in it") + " (+" + nx.xp + " Construction xp): " +
                 CART.kinds[t + 1] + " kinds a load, " + CART.hours[t + 1] + " hours to Marlow and back.");
    }
    if (!c.tier) return no(s, "Build a cart shed first.");
    if (action === "cartload") {
      var id = opts.id, it = ITEMS[id], from = CART_FROM.indexOf(opts.from) >= 0 ? opts.from : "bag";
      if (!it) return no(s, "There's no such thing.");
      if (it.crate) return no(s, "Marlow doesn't buy crates -- open it.");
      if (recycleKeeps(id)) return no(s, "The " + it.name.toLowerCase() + " is too precious to sell.");
      if (boundWhy(id)) return no(s, boundWhy(id));                          // (a mastery's keepsake, V6)
      var spare = cartSpare(s, id, from), n = opts.n === "all" ? spare : Math.floor(+opts.n || 1);
      if (n < 1 || n > spare) return no(s, spare ? "There are only " + spare + " to spare there." : usingIt(s, id) && from === "bag" ? "That's the " + it.name.toLowerCase() + " you're using." : "There's none of that there.");
      if (!c.load[id] && Object.keys(c.load).length >= CART.kinds[c.tier]) return no(s, "The " + CART.names[c.tier].toLowerCase() + " is full -- " + CART.kinds[c.tier] + " kinds a load.");
      if (from === "bag") take(s, id, n);
      else { var src = cartSource(s, from); src[id] -= n; if (src[id] <= 0) delete src[id]; }
      c.load[id] = c.load[id] || {};
      c.load[id][from] = (c.load[id][from] || 0) + n;
      return yes(s, now, "Loaded " + n + " × " + it.name.toLowerCase() + " onto the cart (" + sellFor(id, loadCount(c.load[id]), 1) + " coins' worth).");
    }
    if (action === "cartunload") {
      var l = c.load[opts.id], uit = ITEMS[opts.id];
      if (!l || !uit) return no(s, "That isn't on the cart.");
      if (l.bag && (!roomFor(s, opts.id) || stackRoom(s, opts.id) < l.bag)) return no(s, "Your bag has no room for " + l.bag + " × " + uit.name.toLowerCase() + ".");
      if (l.bag) give(s, opts.id, l.bag);
      if (l.chests) { s.storage = s.storage || {}; s.storage[opts.id] = (s.storage[opts.id] || 0) + l.chests; }
      if (l.recycled) { var m = recycleBox(s).mats; m[opts.id] = (m[opts.id] || 0) + l.recycled; }
      delete c.load[opts.id];
      return yes(s, now, "You took the " + uit.name.toLowerCase() + " off the cart and put it back.");
    }
    if (action === "cartsend") {
      if (c.out) return no(s, "The cart's still out -- back in " + Math.max(1, Math.ceil((c.out.back - now) / MIN)) + " minutes.");
      var ids = Object.keys(c.load).filter(function (k) { return loadCount(c.load[k]) > 0; });
      if (!ids.length) return no(s, "Load something first.");
      var pay = ids.reduce(function (a, k) { return a + Math.floor(sellFor(k, loadCount(c.load[k]), 1) * CART.bonus[c.tier]); }, 0);
      c.out = { at: now, back: now + CART.hours[c.tier] * HOUR, pay: pay, kinds: ids.length };
      c.trips = (c.trips || 0) + 1;
      c.load = {};
      return yes(s, now, "The " + CART.names[c.tier].toLowerCase() + " set off for Marlow with " + ids.length + " kind" + (ids.length === 1 ? "" : "s") + " of things -- " +
                 pay.toLocaleString() + " coins when it's back in " + CART.hours[c.tier] + " hours.");
    }
    return null;
  }
