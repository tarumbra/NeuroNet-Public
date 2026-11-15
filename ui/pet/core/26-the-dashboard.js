  // ---- the dashboard (2026-10-07, Cam: "happy with your plan lets do it" -- a first screen with what's
  //      going on, what's ready for you, and quick ways back to what you were doing) ---------------------
  function dashView(s, now) {
    var pl = s.player, p = s.pet, b = s.bag || {}, live = [], ready = [], again = [];
    var secs = function (t) { return Math.max(0, Math.ceil((t - now) / 1000)); };
    if (pl.battle && pl.battle.kind === "boss") live.push({ kind: "boss", icon: "bronzesword", title: "Fighting " + (MONSTERS[pl.battle.mon] || {}).name, sub: pl.battle.manual ? "It's your move" : "Round by round", go: "pet:hunt" });
    if (pl.job) {
      var sp = pl.job.hunt ? null : spotOf(pl.job.skill, pl.job.spot);
      live.push(pl.job.hunt ? { kind: "hunt", icon: "bronzesword", title: "Hunting in the " + HUNTS[pl.job.hunt].name, sub: (pl.job.count || 0) + " fights so far", endsIn: secs(pl.job.until), go: "pet:hunt", home: true }
        : { kind: "gather", icon: sp ? sp.loot[0][0] : "berry", title: SKILLS[pl.job.skill].name + " at the " + (sp ? sp.name : "spot"), sub: (pl.job.count || 0) + " finds so far",
            region: sp && REGIONS[sp.area] ? sp.area : "",
            endsIn: secs(pl.job.until), go: sp && REGIONS[sp.area] ? "pet:world" : "pet:" + pl.job.skill, home: true });   // (2026-10-10) where you are, on the map
    }
    if (pl.explore) live.push({ kind: "explore", icon: "obj_map", title: "Exploring the " + REGIONS[pl.explore.region].name, endsIn: secs(pl.explore.until), go: "pet:world", region: pl.explore.region });
    if (p && p.away) live.push({ kind: "pet", pet: true, title: who(p) + " is exploring the " + AREAS[p.away.area].name, sub: "Stage " + ((p.away.stage || 0) + 1) + " of " + (p.away.stages || "?"),
                                 endsIn: secs(p.away.until), go: "pet:expeditions" });
    (s.den || []).forEach(function (d) { if (d.job) live.push({ kind: "den", icon: d.job.hunt ? "bronzesword" : "berry", title: who(d) + (d.job.hunt ? " is hunting" : " is out " + SKILLS[d.job.skill].verb),
                                                                   endsIn: secs(d.job.until), go: "pet:pets" }); });
    if ((s.hatchery || []).length) {
      var soon = s.hatchery.reduce(function (m, h) { return Math.min(m, h.hatchAt); }, Infinity);
      live.push({ kind: "eggs", icon: "commonegg", title: s.hatchery.length + " egg" + (s.hatchery.length === 1 ? "" : "s") + " in the hatchery", endsIn: secs(soon), go: "pet:hatchery" });
    }
    if (s.breeding) live.push({ kind: "breed", icon: "heart", title: "Two of your pets are breeding", endsIn: secs(s.breeding.until), go: "pet:breed" });
    if (s.player.voyage) live.push({ kind: "voyage", icon: "obj_map", title: "At sea, bound for " + (s.player.voyage.to ? ISLANDS[s.player.voyage.to].the : "home"), endsIn: secs(s.player.voyage.until), go: "pet:world" });
    if (s.ship && s.ship.building) live.push({ kind: "ship", icon: "plank", title: "Building your " + SHIPS[s.ship.building.tier].name.toLowerCase() + "'s " + SHIP_PART_NAMES[s.ship.building.part].toLowerCase(), endsIn: secs(s.ship.building.until), go: "pet:shipyard" });
    // ready for you
    REGION_ORDER.forEach(function (r) { var pv = personView(s, r); if (pv && pv.quest && pv.quest.can && !regionLock(s, r))
      ready.push({ kind: "quest", look: PEOPLE[r].look, title: "Quest ready: " + pv.quest.name, sub: pv.name + ", " + REGIONS[r].name, go: "pet:world", region: r }); });
    var ords = ordersView(s, now).list.filter(function (o) { return o.can; });
    if (ords.length) ready.push({ kind: "orders", icon: ords[0].id, title: ords.length + " order" + (ords.length === 1 ? "" : "s") + " you can fill", sub: "The notice board, in the village", go: "shop:board" });
    if (b.unidherb > 0) ready.push({ kind: "herbs", icon: "unidherb", title: b.unidherb + " unidentified herb" + (b.unidherb === 1 ? "" : "s"), sub: "The herb table, in your library", go: "shop:herblore" });
    var crates = Object.keys(b).filter(function (k) { return b[k] > 0 && ITEMS[k] && ITEMS[k].crate; });
    if (crates.length) ready.push({ kind: "crates", icon: crates[0], title: crates.reduce(function (n, k) { return n + b[k]; }, 0) + " crate" + (crates.reduce(function (n, k) { return n + b[k]; }, 0) === 1 ? "" : "s") + " to open", sub: "In your bag", go: "pet:bag" });
    var eggs = Object.keys(b).filter(function (k) { return b[k] > 0 && ITEMS[k] && ITEMS[k].egg; });
    if (eggs.length) ready.push({ kind: "eggs", icon: eggs[0], title: "An egg to put in the hatchery", sub: ITEMS[eggs[0]].name, go: "pet:hatchery" });
    var ripe = (s.farm && s.farm.plots || []).filter(function (x) { return x.state === "ripe"; }).length, pots = (s.farm && s.farm.pots || []).filter(function (x) { return x.ready; }).length;
    if (ripe || pots) ready.push({ kind: "farm", icon: "carrot", title: (ripe ? ripe + " crop" + (ripe === 1 ? "" : "s") : "") + (ripe && pots ? " and " : "") + (pots ? pots + " herb pot" + (pots === 1 ? "" : "s") : "") + " ready to pick", sub: "Your farm", go: "pet:farm" });
    if (p && p.injury && !p.injury.treatedAt) ready.push({ kind: "hurt", pet: true, title: who(p) + " is hurt", sub: "A salve or poultice starts the healing", go: "pet:expeditions" });
    var mood0 = p ? mood(p, now) : "none";
    if (["hungry", "sleepy", "dirty", "sad", "sick"].indexOf(mood0) >= 0) ready.push({ kind: "care", pet: true, title: who(p) + ": " + NEEDS[mood0], sub: "My pet", go: "pet:home" });
    var tw = towerView(s), nextRank = tw.ranks.filter(function (r) { return r.ready; })[0];
    var nq = s.player.necro && s.player.necro.accepted && !s.player.necro.taught ? necroSteps(s).filter(function (x) { return !x.done; })[0] : null;   // the Blood Book (V8)
    if (nq) ready.push({ kind: "quest", icon: "bloodbook", title: "The Blood Book: " + nq.text, sub: "Sorceress Nyx's quest -- the mage tower has every step", go: "pet:world", region: "magetower" });
    if (nextRank) ready.push({ kind: "rank", icon: "wizardhat", title: "The mage tower: duel for the rank of " + nextRank.name, sub: "Against " + nextRank.mage, go: "pet:world", region: "magetower" });
    ranchDash(s, now).forEach(function (x) { ready.push(x); });          // the Farm (2026-10-12): ready, hungry
    if (s.cart && s.cart.out) live.push({ kind: "cart", icon: "obj_handcart", title: "The cart's on the road to Marlow", sub: s.cart.out.pay.toLocaleString() + " coins when it's back",
                                          endsIn: secs(s.cart.out.back), go: "pet:estate" });
    var scrolls = Object.keys(b).filter(function (k) { return b[k] > 0 && ITEMS[k] && ITEMS[k].learn; });
    if (scrolls.length) ready.push({ kind: "learn", icon: scrolls[0], title: "Something to read: " + ITEMS[scrolls[0]].name, sub: "In your bag", go: "pet:bag" });
    var hv = houseView(s, now), canBuild = hv.rooms.filter(function (r) { return r.next && r.next.can; });
    if (canBuild.length) ready.push({ kind: "build", icon: "obj_house", title: "You can build " + aOr(canBuild[0].next.name.toLowerCase() + " " + canBuild[0].name.toLowerCase()), sub: "Home", go: "pet:workshop" });
    if (bagUsed(s) >= bagCap(s)) ready.push({ kind: "bag", icon: "willowbasket", title: "Your bag is " + (bagUsed(s) > bagCap(s) ? "over capacity" : "full") + " (" + bagUsed(s) + "/" + bagCap(s) + ")", sub: "Sell, store or fill an order", go: "pet:bag" });
    // pick up where you left off
    var lt = pl.lastTrip;
    if (!pl.job && !pl.explore && lt && lt.spot) {
      // (2026-10-10) "where you left off" takes you to the place on the map -- you start again there, not from here
      if (lt.hunt) again.push({ kind: "hunt", title: "Back to the " + HUNTS[lt.hunt].name + " hunting ground", region: REGIONS[lt.hunt] ? lt.hunt : "" });
      else if (spotOf(lt.skill, lt.spot)) again.push({ kind: "gather", title: "Back to the " + spotOf(lt.skill, lt.spot).name, region: REGIONS[spotOf(lt.skill, lt.spot).area] ? spotOf(lt.skill, lt.spot).area : "" });
    }
    if (!pl.job && !pl.explore && s.lastExplore && !regionLock(s, s.lastExplore.region)) again.push({ kind: "explore", title: "Explore the " + REGIONS[s.lastExplore.region].name + " again", act: "explore", opts: { region: s.lastExplore.region } });
    return { story: storyView(s), name: pl.name || "You", combat: combatLevel(pl), hp: Math.floor(pl.hp), maxHp: maxHp(pl), coins: s.coins || 0, bag: { used: bagUsed(s), cap: bagCap(s) },
             mode: modeOf(s), modeName: MODES[modeOf(s)].name, ngPlus: s.ngPlus || 0,
             live: live, ready: ready, again: again, log: (s.log || []).slice(0, 6).map(function (e) { return { at: e.t || e.at, text: e.text }; }) };
  }
