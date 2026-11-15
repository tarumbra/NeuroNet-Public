  // ==== ships, the Shipyard and the islands (2026-10-08, Cam: "split frostpeak mountains and desert from the initial
  //      island ... different islands where they are gotten to by ship (unlock a shipyard) Where you can build a ship
  //      which starts off as a simple row boat, then tiers up slowly ... ship building should be apart of the construction
  //      skill ... can only be worked on from the shipyard at the coast area next to the harbour ... a new NPC who handles
  //      the ship yard and will give out ocean and other island gather quests"). Stage 1: the ships, the yard, voyages,
  //      the Desert Island and Frostpeak Island with their towns. You're somewhere: s.player.island ("" = the main island).
  var SHIPS = CONTENT("SHIPS");
  var SHIP_PARTS = CONTENT("SHIP_PARTS");
  var SHIP_PART_NAMES = CONTENT("SHIP_PART_NAMES");
  var SHIP_BUILD = CONTENT("SHIP_BUILD");
  var ISLANDS = CONTENT("ISLANDS");
  var VOYAGE_MINS = CONTENT("VOYAGE_MINS");                   // by ship tier: a caravel 15 minutes, a galleon 10
  // provisions (2026-10-13, Cam liked "smoked fish keeps -- for long voyages"): sail with 3 smoked fish from the Farm's
  // Smokehouse and the crew, well fed, makes it in half the time; you step ashore rested (full health, pets refreshed)
  var PROVISIONS = CONTENT("PROVISIONS");
  Object.assign(ITEMS, CONTENT("more ITEMS"));
  WORKSHOPS.spinning.recipes.push({ make: "rope", needs: { flax: 3 }, level: 15, xp: 20 }, { make: "rope", needs: { cotton: 3 }, level: 15, xp: 20 },
                                  { make: "rope", needs: { horsehair: 3 }, level: 12, xp: 20 },     // horsehair's use now (Cam, 2026-10-09)
                                  { make: "sailcloth", needs: { cloth: 3 }, level: 22, xp: 35 });
  WORKSHOPS.crafting.recipes.push({ make: "pitch", needs: { resin: 3, twigs: 2 }, level: 28, xp: 40 });
  function shipOf(s) {
    var sh = s.ship = s.ship && typeof s.ship === "object" ? s.ship : { tier: 0, parts: {} };
    if (typeof sh.tier !== "number") sh.tier = 0;
    if (!sh.parts || typeof sh.parts !== "object") sh.parts = {};
    if (((s.bag || {}).boat || 0) > 0) { sh.tier = Math.max(sh.tier, 1); delete s.bag.boat; }        // Old Salt's rowing boat is your first ship
    return sh;
  }
  function shipTier(s) { return (s && s.ship && s.ship.tier) || ((s && s.bag && s.bag.boat > 0) ? 1 : 0); }
  function islandOf(s) { return (s && s.player && s.player.island) || ""; }
  function regionIsle(id) { return (REGIONS[id] && REGIONS[id].isle) || ""; }
  /** Why you can't be in a region from where you are ("" if you can). */
  function placeLock(s, id) {
    var pl = (s && s.player) || {};
    if (pl.voyage) return "You're at sea -- " + (pl.voyage.to ? "bound for the " + ISLANDS[pl.voyage.to].name : "sailing home");
    var here = pl.island || "", there = regionIsle(id);
    if (here === there) return "";
    if (there) return "On " + ISLANDS[there].the + " -- sail there from the Shipyard on the Coast (it takes a " + SHIPS[ISLANDS[there].ship].name.toLowerCase() + ")";
    return "That's on the main island, and you're on " + ISLANDS[here].the + " -- sail home from " + REGIONS[ISLANDS[here].town].name + "'s dock first";
  }
  // things that only happen at home (benches, shops, the house): away, they wait (an estate on the island comes later)
  var HOME_ACTS = CONTENT("HOME_ACTS");
  function awayLock(s, action, opts) {
    var pl = s.player;
    var ish = opts && WORKSHOPS[opts.from || opts.to];                  // an island's own shop: the mirage, the bazaar, the trading post
    if ((action === "buy" || action === "sell") && ish && ish.isle && ish.isle === pl.island && !pl.voyage) return "";
    if (pl.voyage && (HOME_ACTS.indexOf(action) >= 0 || action === "trip" || action === "hunt" || action === "boss" || action === "explore"))
      return "You're at sea -- " + (pl.voyage.to ? "bound for the " + ISLANDS[pl.voyage.to].name : "sailing home") + ".";
    var ehere = pl.island ? hereEstate(s) : null;                        // an island estate's benches and chests (stage 4)
    if (ehere && (action === "craft" || action === "enchant" || action === "identify" || action === "repair") && partTier(ehere, "workshop")) return "";
    if (ehere && (action === "store" || action === "withdraw" || action === "chestname" || action === "chestmove" || action === "deposit" || action === "banktab" || action === "tabname") && partTier(ehere, "storeroom")) return "";
    if (pl.island && HOME_ACTS.indexOf(action) >= 0)
      return "That's back home, and you're on " + ISLANDS[pl.island].the + ". Sail home from " + REGIONS[ISLANDS[pl.island].town].name + "'s dock.";
    return "";
  }
  function voyageMins(s) { return VOYAGE_MINS[Math.max(3, shipTier(s))] || 15; }
  function shipAct(s, action, opts, now) {
    var sh = shipOf(s), pl = s.player;
    if (action === "shipbuild") {
      if (sh.tier < 1) return no(s, "Old Salt on the Coast will help you build your first boat -- then the Shipyard is yours.");
      if (sh.tier >= SHIPS.length - 1) return no(s, "Your galleon is as fine as ships get.");
      if (sh.building) return no(s, "The yard is busy with your " + SHIP_PART_NAMES[sh.building.part].toLowerCase() + ".");
      var nt = sh.tier + 1, part = opts.part, b = SHIP_BUILD[nt] && SHIP_BUILD[nt][part];
      if (!b) return no(s, "There's no part like that.");
      if (sh.parts[part]) return no(s, "The " + SHIP_PART_NAMES[part].toLowerCase() + " is done.");
      if (levelOf(pl.skills.construction || 0) < SHIPS[nt].con) return no(s, "A " + SHIPS[nt].name.toLowerCase() + " needs Construction " + SHIPS[nt].con + ".");
      if ((s.coins || 0) < b.coins) return no(s, "That takes " + b.coins + " coins.");
      for (var k in b.items) if (!has(s, k, b.items[k])) return no(s, "That takes " + b.items[k] + " " + ITEMS[k].name.toLowerCase() + " (you have " + (s.bag[k] || 0) + ").");
      s.coins -= b.coins;
      for (var k2 in b.items) take(s, k2, b.items[k2]);
      sh.building = { tier: nt, part: part, since: now, until: now + (s.dev && s.dev.instantHatch ? 0 : b.hours * HOUR) };
      return yes(s, now, "Shipwright Hal and you started on the " + SHIPS[nt].name.toLowerCase() + "'s " + SHIP_PART_NAMES[part].toLowerCase() + " (" + b.hours + " hours).");
    }
    if (action === "sail") {
      if (pl.voyage) return no(s, "You're already at sea.");
      if (pl.job) return no(s, "You're out " + (pl.job.hunt ? "hunting" : "gathering") + " -- come back first.");
      if (pl.battle) return no(s, "You're in a fight.");
      if (pl.explore) return no(s, "You're out exploring.");
      var to = opts.to === "home" ? "" : opts.to;
      if (to && !ISLANDS[to]) return no(s, "There's no island like that.");
      if (to === (pl.island || "")) return no(s, to ? "You're already on " + ISLANDS[to].the + "." : "You're already home.");
      if (to && sh.tier < ISLANDS[to].ship) return no(s, ISLANDS[to].the.charAt(0).toUpperCase() + ISLANDS[to].the.slice(1) + " is too far for a " + SHIPS[sh.tier].name.toLowerCase() + " -- it takes a " + SHIPS[ISLANDS[to].ship].name.toLowerCase() + ".");
      var mins = voyageMins(s), fed = false, short = "";
      if (opts.provisions) {
        if ((s.dev && s.dev.infinite) || has(s, PROVISIONS.id, PROVISIONS.n)) { take(s, PROVISIONS.id, PROVISIONS.n); fed = true; mins = Math.ceil(mins * PROVISIONS.quick); }
        else short = " There weren't " + PROVISIONS.n + " smoked fish for provisions, so the crew sails at the usual pace.";
      }
      pl.voyage = { to: to, from: pl.island || "", since: now, until: now + (s.dev && s.dev.instantHatch ? 0 : mins * MIN) };
      if (fed) pl.voyage.fed = 1;
      return yes(s, now, "You set sail in your " + SHIPS[sh.tier].name.toLowerCase() + " for " + (to ? ISLANDS[to].the : "home") + " (" + mins + " minutes)." +
                 (fed ? " The crew's well fed on " + PROVISIONS.n + " smoked fish -- half the time, and you'll step ashore rested." : short));
    }
    return null;
  }
  /** Ships and voyages, brought up to `now`: a part finished, a voyage ended. */
  function resolveShip(s, now) {
    var sh = shipOf(s), pl = s.player;
    if (sh.building && sh.building.until <= now) {
      var bd = sh.building; delete sh.building;
      sh.parts[bd.part] = bd.until;
      addXp(s, pl, "construction", SHIP_BUILD[bd.tier][bd.part].xp, bd.until);
      if (SHIP_PARTS.every(function (p) { return sh.parts[p]; })) {
        sh.tier = bd.tier; sh.parts = {};
        note(s, bd.until, "Your " + SHIPS[bd.tier].name.toLowerCase() + " is finished! Shipwright Hal is grinning from ear to ear." +
             (bd.tier === 2 ? " Your pets can go on ocean expeditions now." : bd.tier === 3 ? " She'll take you to the Desert Island and Frostpeak Island." : ""));
      } else note(s, bd.until, "The " + SHIPS[bd.tier].name.toLowerCase() + "'s " + SHIP_PART_NAMES[bd.part].toLowerCase() + " is done.");
    }
    if (pl.voyage && pl.voyage.until <= now) {
      var v = pl.voyage; delete pl.voyage;
      pl.island = v.to;
      if (v.fed) {                                                       // provisions: ashore rested
        pl.hp = maxHp(pl);
        [s.pet].concat(s.den || []).forEach(function (q) { if (q && q.s && !q.away && stage(q, v.until) !== "egg") { q.s.energy = clamp(q.s.energy + 30); q.s.happy = clamp(q.s.happy + 15); } });
      }
      note(s, v.until, v.to ? "Land ho! You tied up at " + REGIONS[ISLANDS[v.to].town].name + " on " + ISLANDS[v.to].the + "." : "Home again -- you tied up at the Shipyard.");
    }
  }
  function shipyardView(s, now) {
    var sh = (s && s.ship) || { tier: shipTier(s), parts: {} }, b = (s && s.bag) || {}, nt = sh.tier + 1, con = levelOf(((s && s.player && s.player.skills) || {}).construction || 0);
    return { tier: sh.tier, name: SHIPS[sh.tier].name, next: SHIPS[nt] ? { tier: nt, name: SHIPS[nt].name, con: SHIPS[nt].con, conOk: con >= (SHIPS[nt].con || 0),
               parts: SHIP_PARTS.map(function (p) { var c = SHIP_BUILD[nt] && SHIP_BUILD[nt][p];
                 return { id: p, name: SHIP_PART_NAMES[p], done: !!(sh.parts || {})[p], building: !!(sh.building && sh.building.part === p),
                          coins: c ? c.coins : 0, hours: c ? c.hours : 0, xp: c ? c.xp : 0,
                          items: c ? Object.keys(c.items).map(function (k) { return { id: k, name: ITEMS[k].name, need: c.items[k], have: b[k] || 0 }; }) : [],
                          can: !!c && !sh.building && !(sh.parts || {})[p] && con >= SHIPS[nt].con && ((s && s.coins) || 0) >= c.coins && Object.keys(c.items).every(function (k) { return (b[k] || 0) >= c.items[k]; }) }; }) } : null,
             building: sh.building ? { part: SHIP_PART_NAMES[sh.building.part], endsIn: Math.max(0, Math.ceil((sh.building.until - now) / 1000)) } : null,
             island: islandOf(s), voyage: s && s.player && s.player.voyage ? { to: s.player.voyage.to, endsIn: Math.max(0, Math.ceil((s.player.voyage.until - now) / 1000)) } : null,
             mins: voyageMins(s || {}), person: personView(s, "shipyard"),
             provisions: { id: PROVISIONS.id, n: PROVISIONS.n, have: ((s && s.bag) || {})[PROVISIONS.id] || 0, mins: Math.ceil(voyageMins(s || {}) * PROVISIONS.quick) },
             islands: Object.keys(ISLANDS).map(function (k) { return { id: k, name: ISLANDS[k].name, ship: SHIPS[ISLANDS[k].ship].name, can: sh.tier >= ISLANDS[k].ship, here: islandOf(s) === k }; }) };
  }

  // the islands' places: the towns, the Shipyard (Hal's), and who lives there
  REGIONS.desert.isle = "desert"; REGIONS.nile.isle = "desert"; REGIONS.frostpeak.isle = "frostpeak";
  REGIONS.sandport = CONTENT("REGIONS.sandport");
  REGIONS.frosthaven = CONTENT("REGIONS.frosthaven");
  REGIONS.shipyard = CONTENT("REGIONS.shipyard");
  REGION_ORDER.push("sandport", "frosthaven");
  REGION_LINKS.push(["sandport", "desert"], ["frosthaven", "frostpeak"]);
  SECRETS.sandport = []; SECRETS.frosthaven = [];
  PEOPLE.shipyard = CONTENT("PEOPLE.shipyard");
  PEOPLE.sandport = CONTENT("PEOPLE.sandport");
  PEOPLE.frosthaven = CONTENT("PEOPLE.frosthaven");

