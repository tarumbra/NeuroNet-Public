  // ---- the bag's room (2026-10-07, Cam: "a way to cap how much items i can have in my bag at one
  //      time ... the items already in the bag can show up as over capacity but i cant add anymore
  //      until i sell them off") ----------------------------------------------------------------
  // (2026-10-10, Cam: "Bag sizes should be reduced to make storerooms relevent. Like a real person and bag you shouldnt be
  // able to carry so much") -- half the kinds, and each kind stacks only so high; the store room at home holds the rest
  var BAG_START = 25, STACK_START = 250, SATCHEL_KINDS = 3;   // 25 (I8, 2026-10-19: room for the tutorial's and a class lesson's gifts; was 20)
  function bagCap(s) { var b = s && s.bagSize && ITEMS[s.bagSize]; return (b ? b.bagSize : BAG_START) + SATCHEL_KINDS * researched(s, "satchel") + packOf(s).kinds; }
  /** How many of one thing a stack in the bag holds. */
  function stackCap(s) { var b = s && s.bagSize && ITEMS[s.bagSize]; return ((b && b.stack) || STACK_START) + packOf(s).stack; }
  // the pack pet (2026-10-10 audit, PET-1, after RuneScape Summoning's beasts of burden): your companion carries part of the
  // load -- by its size, and a kind more for every 5 levels -- while it's hatched, with you and not away on an expedition
  var PET_SIZE = CONTENT("PET_SIZE");
  var PACK = CONTENT("PACK");
  function sizeOf(species) { return PET_SIZE.small.indexOf(species) >= 0 ? "small" : PET_SIZE.large.indexOf(species) >= 0 ? "large" : "medium"; }
  function packOf(s) {
    var p = s && s.pet;
    if (!p || p.away || !(p.hatchAt <= (p.at || 0)) || !SPECIES[p.species]) return { kinds: 0, stack: 0, size: "", name: "" };
    var sz = sizeOf(p.species), base = PACK[sz];
    return { kinds: base.kinds + Math.floor(levelOf(p.xp || 0) / 5) + (p.stars || 0), stack: base.stack, size: sz, name: who(p) };
  }
  // several stacks of one thing (2026-10-10, Cam: "when it goes over stack limit ... it starts a new stack and takes another
  // spot in the bag"): a bag slot holds one stack; 450 berries in 300 stacks take two slots
  function wornSet(s) {
    var pl = (s && s.player) || {}, worn = {};
    Object.keys(pl.gear || {}).forEach(function (k) { if (pl.gear[k]) worn[pl.gear[k]] = 1; });
    Object.keys(pl.tools || {}).forEach(function (k) { if (pl.tools[k]) worn[pl.tools[k]] = 1; });
    return worn;
  }
  /** Bag slots a thing takes: one a stack (the one you wear or carry as a tool is free). */
  function slotsOf(s, id, worn) {
    var n = Math.max(0, ((s && s.bag) || {})[id] || 0) - ((worn || wornSet(s))[id] ? 1 : 0);
    return n > 0 ? Math.ceil(n / stackCap(s)) : 0;
  }
  /** How many more of `id` fit: what's left on its last stack, and new stacks in the free slots. */
  function stackRoom(s, id) {
    if (s.dev && s.dev.infinite) return 1e9;
    var cap = stackCap(s), n = Math.max(0, ((s && s.bag) || {})[id] || 0) - (wornSet(s)[id] ? 1 : 0);
    var partial = n > 0 ? Math.ceil(n / cap) * cap - n : 0;
    return partial + Math.max(0, bagCap(s) - bagUsed(s)) * cap;
  }
  /** Bag slots in use: a stack a slot. */
  function bagUsed(s) {
    var worn = wornSet(s), b = (s && s.bag) || {};
    return Object.keys(b).reduce(function (a, k) { return a + (b[k] > 0 && ITEMS[k] ? slotsOf(s, k, worn) : 0); }, 0);
  }
  /** A named herb (identified, or from a pot of one you know): into the bag as itself, if there's room. */
  function giveKnown(s, id, n) {
    if (roomFor(s, id)) return give(s, id, n, true);
    s.lost = s.lost || {}; s.lost[id] = (s.lost[id] || 0) + n; return 0;
  }
  function roomFor(s, id) {
    if (s.dev && s.dev.infinite) return true;
    return stackRoom(s, id) > 0;                                       // room on its last stack, or a free slot for a new one
  }
  /** Room for `n` new kinds? */
  function roomForKinds(s, ids) {
    if (s.dev && s.dev.infinite) return true;
    var fresh = ids.filter(function (k, i) { return ids.indexOf(k) === i && !((s.bag[k] || 0) > 0); }).length;
    return bagUsed(s) + fresh <= bagCap(s);
  }
  function trimUnid(s) {                    // the hidden herbs follow the stack (sold, lost, used)
    var want = Math.max(0, s.bag.unidherb || 0), u = s.unid = s.unid || {}, have = 0;
    Object.keys(u).forEach(function (k) { have += u[k] > 0 ? u[k] : 0; });
    while (have > want) {
      var most = Object.keys(u).filter(function (k) { return u[k] > 0; }).sort(function (a, b) { return u[b] - u[a] || (a < b ? -1 : 1); })[0];
      var cut = Math.min(u[most], have - want);
      u[most] -= cut; have -= cut;
      if (!u[most]) delete u[most];
    }
    if (have < want) u.herb = (u.herb || 0) + (want - have);
  }
  function flushLost(s, at) {
    if (!s.lost) return;
    var l = s.lost; delete s.lost;
    note(s, at, "No room in your bag for " + itemsText(l) + " (" + bagUsed(s) + "/" + bagCap(s) + " slots, " + stackCap(s).toLocaleString() + " to a stack)" +
                ". Store things at home, sell to the merchant, fill an order on the notice board, or buy a bigger bag.");
  }
  function mastery(p, area) { var n = (p.areas || {})[area] || 0, m = 1; while (m < 5 && n >= MASTERY[m]) m++; return m; }
  /** A name you typed (you, a pet, a chest), as it's kept: one line, no tags or control characters, at most n long (2026-10-12,
   *  audit SEC-2 -- every screen escapes it too; this is belt and braces for one that forgets). */
  function cleanName(v, n) { return String(v == null ? "" : v).replace(/\s+/g, " ").replace(/[<>\u0000-\u001f\u007f]/g, "").trim().slice(0, n); }
  function aOr(name) { return (/^[aeiou]/i.test(name) ? "an " : "a ") + name.toLowerCase(); }
  function who(p) { return p.name || "Your " + kindName(p).toLowerCase(); }     // starting a sentence
  function whom(p) { return p.name || "your " + kindName(p).toLowerCase(); }    // inside one
  function kindName(p) { var k = PETS[p.species + "/" + p.colour]; return k ? k.name : (SPECIES[p.species] || {}).name || "Pet"; }
  function rarityOf(p) { var k = PETS[p.species + "/" + p.colour]; return k ? k.rarity : "Common"; }

  // Kibble is the pet bowl: always there. Every other food comes from the bag.
  var FOODS = CONTENT("FOODS");

