  // ---- Battle Re-work Part 10: quivers (2026-10-16) ---------------------------------------------------------------------
  //      Cam (PT7): "quivers ... will have a certain capacity and can hold only up to a certain tier of arrow". A quiver (its
  //      own slot, beside your ammo) holds cap arrows a hunt, of tier up to its tier; arrows it can't hold, or no quiver at
  //      all, and you have a handful loose (QUIVERS.loose). playerFighter counts the hunt's arrows (job.used).
  var QUIVERS = CONTENT("QUIVERS");
  Object.keys(QUIVERS.items).forEach(function (k) { ITEMS[k] = QUIVERS.items[k]; WEAR[k] = copy(ITEMS[k].gear.req); });
  QUIVERS.recipes.forEach(function (r) { WORKSHOPS.crafting.recipes.push(r); });
  var ARROW_TIER = CONTENT("ARROW_TIER");
  function arrowTier(id) { return typeof ARROW_TIER[id] === "number" ? ARROW_TIER[id] : 6; }
  /** How many arrows this hunt may use, with your quiver (and whether the arrows fit it). */
  function quiverCap(pl, ammo) {
    var q = ITEMS[(pl.gear || {}).quiver], qq = q && q.gear && q.gear.quiver;
    if (qq && arrowTier(ammo) <= qq.tier) return { cap: qq.cap, name: q.name, fits: true };
    return { cap: needsQuiver(ammo) ? 0 : QUIVERS.loose, name: "", fits: !qq && !needsQuiver(ammo), tooGood: !!qq, none: !qq };
  }
  // N19 (2026-10-19, Cam: "only allow arrows to be held in a quiver. You cannot equip arrows without the quiver"): arrows and
  // bolts (ARROW_TIER) go only in a quiver that holds their tier -- nothing loose. Taking the quiver off takes them off too.
  function needsQuiver(id) { return typeof ARROW_TIER[id] === "number"; }
  /** Why these arrows can't go with your quiver ("" if they can) -- at the equip. */
  function quiverWhyNot(pl, ammo) {
    var q = ITEMS[(pl.gear || {}).quiver], qq = q && q.gear && q.gear.quiver;
    if (!qq) return needsQuiver(ammo) ? "arrows only go in a quiver -- wear one first" : "";
    if (arrowTier(ammo) <= qq.tier) return "";
    return "your " + q.name.toLowerCase() + " can't hold " + ITEMS[ammo].name.toLowerCase() + "s -- a better quiver can";
  }
  // ---- B5 (2026-10-20, Cam: "I expected to see the arrow count go down. When arrows ran out to default to hunting knife or
  //      fists"): in a live fight a bow takes an arrow A SHOT (a special that looses more takes more), not one a fight. The
  //      count on you drops as you shoot; when the bag or the quiver runs dry, battleRound hands you the off hand, a hunting
  //      knife from the bag, or fists, and the fight goes on -- and so does the hunt (your health line still sends you home).
  /** Arrows (or bolts) shot so far this hunt (the quiver's count). */
  function huntShots(job) { return Object.keys((job && job.used) || {}).reduce(function (a, k) { return a + job.used[k]; }, 0); }
  // ---- N24 (2026-10-20, Cam: "The quiver should have to be manually loaded again and not automatically pulled from the bag. So
  //      gear screen would have the amount of arrows held in the quiver, then when it runs out player defaults to knife or fists,
  //      until the player reloads. Reload can occur from the bag by using arrows with the quiver"): arrows go INTO the quiver
  //      (pl.quiverN of gear.ammo, out of the bag) when you load it -- by wearing them, or using them with the quiver -- and shots
  //      come only from there. Taking the quiver or the arrows off puts what's left back in the bag; so does a fall.
  /** How many you can shoot right now: what's loaded in your quiver (anything else, or a pet: the bag). */
  function quiverHeld(s, pl) {
    var am = (pl.gear || {}).ammo;
    if (!am || !ITEMS[am]) return 0;
    if (s.dev && s.dev.infinite) return 999;
    if (pl !== s.player || !needsQuiver(am)) return (s.bag || {})[am] || 0;
    return (pl.gear || {}).quiver ? pl.quiverN || 0 : 0;
  }
  function arrowsLeft(s, pl) { return quiverHeld(s, pl); }
  /** n arrows off the quiver (or the bag, for what doesn't go in one). */
  function takeArrows(s, pl, n) {
    if (s.dev && s.dev.infinite) return;
    if (pl === s.player && needsQuiver((pl.gear || {}).ammo)) pl.quiverN = Math.max(0, (pl.quiverN || 0) - n);
    else take(s, pl.gear.ammo, n);
  }
  /** What's in the quiver back to the bag. */
  function unloadQuiver(s, pl) {
    var am = (pl.gear || {}).ammo;
    if (am && ITEMS[am] && pl.quiverN > 0) give(s, am, pl.quiverN, true);
    pl.quiverN = 0;
  }
  /** Load the quiver with these arrows from the bag: up to what it holds; other arrows in it come out first. quiver: one from the
   *  bag to put on first (using arrows with a quiver you aren't wearing). */
  function loadQuiver(s, pl, arrows, now, quiver) {
    if (quiver && (pl.gear || {}).quiver !== quiver) {
      var qi = ITEMS[quiver], cw = cantWear(s, quiver);
      if (cw) return no(s, "The " + qi.name.toLowerCase() + " " + cw + ".");
      if ((pl.gear || {}).quiver) unloadQuiver(s, pl);
      pl.gear.quiver = quiver;
    }
    var why = quiverWhyNot(pl, arrows);
    if (why) return no(s, "Not with that quiver: " + why + ".");
    if (pl.gear.ammo && pl.gear.ammo !== arrows) unloadQuiver(s, pl);
    if (pl.gear.ammo !== arrows) pl.quiverN = 0;
    pl.gear.ammo = arrows;
    var q = ITEMS[pl.gear.quiver], cap = q.gear.quiver.cap, room = cap - (pl.quiverN || 0), inf = s.dev && s.dev.infinite;
    var n = Math.min(room, inf ? room : (s.bag || {})[arrows] || 0), nm = ITEMS[arrows].name.toLowerCase() + "s";
    if (room <= 0) return yes(s, now, "Your " + q.name.toLowerCase() + " is full: " + cap + " " + nm + ".");
    if (n < 1) return pl.quiverN ? yes(s, now, "You'll shoot " + nm + " -- " + pl.quiverN + " in your " + q.name.toLowerCase() + ".") : no(s, "There are no " + nm + " in your bag to load.");
    if (!inf) take(s, arrows, n);
    pl.quiverN = (pl.quiverN || 0) + n;
    return yes(s, now, "You load " + n + " " + nm + " into your " + q.name.toLowerCase() + " (" + pl.quiverN + "/" + cap + ").");
  }
  /** A shot: n arrows (fewer if that's all there is) off the bag and onto the hunt's count. Returns how many went. */
  function shootArrows(s, pl, b, n) {
    var am = (pl.gear || {}).ammo, go = Math.min(n, arrowsLeft(s, pl));
    if (go < 1) return 0;
    var tl = (b.me && b.me.tal) || {};
    if (tl.ammoSave && rnd(b) < tl.ammoSave) return go;                    // Quiver craft: this one's free
    takeArrows(s, pl, go);                                                 // (N24: out of the quiver)
    var j = pl.job;
    if (j && j.hunt) { j.used = j.used || {}; j.used[am] = (j.used[am] || 0) + go; }
    b.shot = (b.shot || 0) + go;
    return go;
  }
