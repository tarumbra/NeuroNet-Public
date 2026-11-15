  // ---- Combining in the bag: field recipes (V2, 2026-10-16) ----------------------------------------------------------------
  //      Cam (PT10): "rpg mo ... allows for combining items straight from bag and different items being combined will result
  //      in different items. Great for quick crafting." Carried by the team's vote (V2), started small (Cam: "the hunters 3"):
  //   - FIELD_RECIPES: two things combined (either way round) make a third, through the rule that already made it (landAct);
  //   - "Use with...": pick a thing in the bag, then what to use it on -- only what combines lights up (the UX lead's condition);
  //   - not in a boss fight (the Combat Designer's: the fight isn't a crafting menu); one home per recipe (QA's).
  //   Step 2 (2026-10-16, the Economist's plan, V2): arrows and bandages for every class -- a recipe is known by a Hunter with a
  //   knife (hunter: true) or by anyone who has read its PAGE (a scroll: Ash's and Nell's quests, or a rare find on certain
  //   creatures); recipes with `needs` are made by fieldMake, at about two-thirds of a bench's xp (the Mathematician's).
  var FIELD_RECIPES = CONTENT("FIELD_RECIPES");
  var FIELD_ITEMS = CONTENT("FIELD_ITEMS");
  var FIELD_PAGES = CONTENT("FIELD_PAGES");
  Object.keys(FIELD_ITEMS).forEach(function (k) { ITEMS[k] = FIELD_ITEMS[k]; });
  function isKnife(id) { return !!(ITEMS[id] && ITEMS[id].gear && ITEMS[id].gear.knife); }
  /** Does this thing (an item id, or "@knife" for your knife in hand) fill a recipe's side? */
  function fieldFits(side, id) { return side === "@knife" ? id === "@knife" || isKnife(id) : side === id; }
  function fieldFind(a, b) {
    return FIELD_RECIPES.list.filter(function (r) {
      return (fieldFits(r.use, a) && r.on.indexOf(b) >= 0) || (fieldFits(r.use, b) && r.on.indexOf(a) >= 0);
    })[0] || null;
  }
  /** The field recipes you know (a Hunter's, with a knife): each with what it takes and whether you can now. */
  function fieldKnows(s, r) {
    var pl = s.player;
    return !!((r.hunter && !landWhyNot(s, pl)) || (r.hunterAt && !hunterAtWhy(pl, r)) || (r.page && ((pl.fieldPages || {})[r.id])));
  }
  /** I11 (2026-10-20): a recipe a Hunter knows from a level on (flint: Ranged 3) -- why not yet ("" if known that way). */
  function hunterAtWhy(pl, r) {
    if (pl.cls !== "hunter") return "a Hunter's skill";
    var short = Object.keys(r.hunterAt).filter(function (k) { return levelOf((pl.skills || {})[k] || 0) < r.hunterAt[k]; });
    return short.length ? "a Hunter learns it at " + short.map(function (k) { return SKILLS[k].name + " " + r.hunterAt[k]; }).join(" and ") : "";
  }
  function fieldKnown(s) { return FIELD_RECIPES.list.filter(function (r) { return fieldKnows(s, r); }); }
  /** How many field recipes are still to find on pages (the bag's hint). */
  function fieldPagesLeft(s) { return FIELD_RECIPES.list.filter(function (r) { return r.page && !fieldKnows(s, r); }).length; }
  /** A recipe with `needs`: as many as the bag allows (up to LAND.most), into the bag, with its skill's xp. */
  function fieldMake(s, r, now) {
    var bag = s.bag || {}, pl = s.player, per = r.n || 1;
    var n = Math.min.apply(null, Object.keys(r.needs).map(function (k) { return Math.floor((bag[k] || 0) / r.needs[k]); }));
    n = Math.min(n, Math.floor(LAND.most / per), roomFor(s, r.makes) ? Math.floor(stackRoom(s, r.makes) / per) : 0);
    var short = Object.keys(r.needs).filter(function (k) { return (bag[k] || 0) < r.needs[k]; });
    if (short.length) return no(s, r.name + " take " + itemsText(r.needs) + " -- no " + short.map(function (k) { return ITEMS[k].name.toLowerCase(); }).join(" or ") + ".");
    if (n < 1) return no(s, "No room in the bag for " + ITEMS[r.makes].name.toLowerCase() + "s.");
    Object.keys(r.needs).forEach(function (k) { take(s, k, r.needs[k] * n); });
    give(s, r.makes, n * per);
    if (r.wears) for (var wi = 0; wi < n && has(s, r.wears); wi++) wearKit(s, null, r.wears, now);   // a chisel wears a use a make, as at a bench (I11)
    if (r.skill && r.xp) addXp(s, pl, r.skill, Math.round(n * r.xp * 10) / 10, now);
    return yes(s, now, "You made " + n * per + " " + ITEMS[r.makes].name.toLowerCase() + (n * per === 1 || /s$/.test(ITEMS[r.makes].name) ? "" : "s") + ".");
  }
  /** Reading a recipe page (the learn action, for a scroll with learn.field). */
  function fieldLearn(s, item, now) {
    var r = FIELD_RECIPES.list.filter(function (x) { return x.id === ITEMS[item].learn.field; })[0], pl = s.player;
    if (!r) return no(s, "The page is too smudged to read.");
    // (I11: a page can hold more than one -- the knapper's: arrowheads and the arrows)
    var all = FIELD_RECIPES.list.filter(function (x) { return x === r || x.page === item; }), fresh = all.filter(function (x) { return !fieldKnows(s, x); });
    if (!fresh.length) return no(s, "You know how to make " + r.name.toLowerCase() + " already.");
    take(s, item); pl.fieldPages = pl.fieldPages || {};
    fresh.forEach(function (x) { pl.fieldPages[x.id] = now; });
    fieldUnlock(s, now, "A new field recipe: " + fresh.map(function (x) { return x.name; }).join(" and "), fresh.map(function (x) { return { icon: x.makes || item, text: x.name + ": " + fieldHow(x) + "." }; }));
    return yes(s, now, "You learnt " + (fresh.length > 1 ? "field recipes: " : "a field recipe: ") + fresh.map(function (x) { return x.name + " (use " + (x.use === "@knife" ? "your knife" : ITEMS[x.use].name.toLowerCase()) + " with " +
                       x.on.map(function (k) { return ITEMS[k].name.toLowerCase(); }).join(" or ") + ")"; }).join("; ") + ", right in the bag.");
  }
  /** A kill may turn up a page (FIELD_PAGES): only one you don't know and don't carry, on its own dice, never the fight's. */
  function fieldPageDrop(s, pl, j, mon, at) {
    if (pl !== s.player) return;
    var id = Object.keys(MONSTERS).filter(function (k) { return MONSTERS[k] === mon; })[0];
    Object.keys(FIELD_PAGES).forEach(function (pg) {
      var P = FIELD_PAGES[pg], r = FIELD_RECIPES.list.filter(function (x) { return x.page === pg; })[0];
      if (!r || P.from.indexOf(id) < 0 || fieldKnows(s, r) || (s.bag || {})[pg] > 0) return;
      var h = Math.imul((j.count | 0) + 1, 2654435761) ^ Math.imul((j.until | 0) ^ pg.length, 40503), roll = ((h ^ (h >>> 13)) >>> 0) % 100000 / 100000;
      if (roll >= P.chance) return;
      if (give(s, pg, 1)) { j.items[pg] = (j.items[pg] || 0) + 1; fieldPageGot(s, pg, at); note(s, at, "The " + mon.name.toLowerCase() + " had something tucked away: " + ITEMS[pg].name + ". Read it from your bag."); }
    });
  }
  /** A recipe page reaching your bag, or a field recipe learnt: the game's Unlocks pop-up says so (Cam, PT14 p2: "All field recipe
   *  unlocks should be handled the same way other unlocks are in the form of a pop up"). */
  function fieldUnlock(s, at, title, list) { s.unlocked = (s.unlocked || []).concat([{ at: at + (s.unlocked || []).length / 1000, title: title, list: list }]).slice(-5); }
  function fieldPageGot(s, pg, at) {
    var r = FIELD_RECIPES.list.filter(function (x) { return x.page === pg; })[0];
    if (r && !fieldKnows(s, r)) fieldUnlock(s, at, "A field recipe page: " + ITEMS[pg].name, [{ icon: pg, text: "Read it from your bag (Read it) to learn " + r.name.toLowerCase() + "." }, { icon: r.makes || pg, text: r.name + ": " + fieldHow(r) }]);
  }
  function fieldHow(r) { return "use " + (r.use === "@knife" ? "your knife" : ITEMS[r.use].name.toLowerCase()) + " with " + r.on.map(function (k) { return ITEMS[k].name.toLowerCase(); }).join(" or ") + ", right in the bag"; }
  /** Where a page turns up, in a few words (the Use with line names it). */
  function fieldPageWhere(pg) { var P = FIELD_PAGES[pg]; return P && P.from && P.from.length ? "creatures like " + P.from.slice(0, 3).map(function (m) { return MONSTERS[m] ? MONSTERS[m].name.toLowerCase().replace(/(x|s|sh|ch)$/, "$1e") + "s" : m; }).join(", ") + " drop it" : "found out in the world"; }
  /** Its page is in the bag, not read yet: using the things reads it for you (Cam, PT24 b4f: "I did have the page"). */
  function fieldPageHeld(s, r) { return !!(r.page && ((s.bag || {})[r.page] > 0) && !fieldKnows(s, r)); }
  /** Is this thing part of any field recipe? (The bag offers Use with… on it, known or not -- PT14 b4.) */
  function fieldInvolved(id) { return isQuiverItem(id) || needsQuiver(id) || FIELD_RECIPES.list.some(function (r) { return fieldFits(r.use, id) || r.on.indexOf(id) >= 0; }); }
  // N24: arrows with a quiver (in the bag or worn) load it
  function isQuiverItem(id) { return !!(ITEMS[id] && ITEMS[id].gear && ITEMS[id].gear.quiver); }
  /** Why this thing can't be used with anything yet: a line a recipe it's in (PT14 b4/m3: "Cannot click use with" -- "My class is Arcane"). */
  function fieldWhy(s, id) {
    var pl = s.player, bag = s.bag || {};
    return FIELD_RECIPES.list.filter(function (r) { return fieldFits(r.use, id) || r.on.indexOf(id) >= 0; }).map(function (r) {
      if (fieldPageHeld(s, r)) return r.name + ": you have its page (" + ITEMS[r.page].name + ") -- use them together and you'll read it first";
      if (!fieldKnows(s, r)) return r.name + ": " + (r.hunter && !r.page ? (landWhyNot(s, pl) || "a Hunter's skill") : (r.hunterAt && pl.cls === "hunter" ? hunterAtWhy(pl, r) + ", or " : "") + "you need its page, " + ITEMS[r.page].name + " (" + fieldPageWhere(r.page) + ")");
      var other = fieldFits(r.use, id) ? r.on : [r.use];
      return r.name + ": " + (other.some(function (k) { return k === "@knife" ? hasKnife(s, pl) : bag[k] > 0; }) ? "ready" : "you need " + other.map(function (k) { return k === "@knife" ? "a knife" : ITEMS[k].name.toLowerCase(); }).join(" or ") + " in your bag");
    });
  }
  /** What this thing can be used with, right now: [{id ("@knife" for the one in your hand), recipe}]. */
  function fieldPartners(s, id) {
    var out = [], bag = s.bag || {}, pl = s.player, held = [(pl.gear || {}).weapon, (pl.gear || {}).offhand].filter(isKnife)[0];
    if (needsQuiver(id)) Object.keys(bag).forEach(function (k) { if (bag[k] > 0 && isQuiverItem(k) && arrowTier(id) <= ITEMS[k].gear.quiver.tier) out.push({ id: k, recipe: "quiver" }); });   // (N24)
    if (isQuiverItem(id)) Object.keys(bag).forEach(function (k) { if (bag[k] > 0 && needsQuiver(k) && arrowTier(k) <= ITEMS[id].gear.quiver.tier) out.push({ id: k, recipe: "quiver" }); });
    FIELD_RECIPES.list.filter(function (r) { return fieldKnows(s, r) || fieldPageHeld(s, r); }).forEach(function (r) {   // (a page in the bag counts: PT24 b4f)
      var others = [];
      if (fieldFits(r.use, id)) others = r.on.filter(function (k) { return bag[k] > 0; });
      else if (r.on.indexOf(id) >= 0) others = r.use === "@knife" ? Object.keys(bag).filter(function (k) { return bag[k] > 0 && isKnife(k); }).concat(held ? ["@knife"] : []) : bag[r.use] > 0 ? [r.use] : [];
      others.forEach(function (o) { if (!out.some(function (x) { return x.id === o; })) out.push({ id: o, recipe: r.id }); });
    });
    return out;
  }
  /** usewith {item, on} -- use one thing with another. */
  function fieldAct(s, action, opts, now) {
    if (action !== "usewith") return null;
    var pl = s.player, r = fieldFind(opts.item, opts.on);
    var qa = needsQuiver(opts.item) ? opts.item : needsQuiver(opts.on) ? opts.on : "", qq = isQuiverItem(opts.item) ? opts.item : isQuiverItem(opts.on) ? opts.on : "";
    if (qa && qq) {                                                       // N24: load the quiver
      if (!has(s, qq)) return no(s, "There's no " + ITEMS[qq].name.toLowerCase() + " in your bag.");
      return loadQuiver(s, pl, qa, now, qq);
    }
    if (pl.battle && pl.battle.kind === "boss") return no(s, "Not in the middle of a boss fight.");
    if (!r) return no(s, "Nothing happens.");
    var readFirst = "";
    if (!fieldKnows(s, r) && fieldPageHeld(s, r)) { var lr = fieldLearn(s, r.page, now); if (!lr.ok) return lr; s = lr.state; readFirst = "You read " + ITEMS[r.page].name + " first. "; }
    if (!fieldKnows(s, r)) return no(s, r.hunter && !r.page ? landWhyNot(s, pl) : "You don't know how to make " + r.name.toLowerCase() + " -- it's written on " + ITEMS[r.page].name + (r.hunterAt && pl.cls === "hunter" ? " (or " + hunterAtWhy(pl, r) + ")" : "") + ".");
    if (r.needs && r.use !== "@knife" && !r.needs[r.use] && !has(s, r.use)) return no(s, r.name + " need " + aOr(ITEMS[r.use].name.toLowerCase()) + ".");   // (the chisel: used, not used up)
    if (r.also && !((s.bag || {})[r.also] > 0)) return no(s, r.name + " need " + ITEMS[r.also].name.toLowerCase() + "s too.");
    var made = r.needs ? fieldMake(s, r, now) : landAct(s, r.act, r.pass ? { item: r.on.indexOf(opts.item) >= 0 ? opts.item : opts.on } : {}, now);
    if (readFirst && made && made.ok) made.msg = readFirst + (made.msg || "");
    return made;
  }
  /** The bag's field recipes: what you know, what each takes, and whether you have it now. */
  function fieldView(s) {
    var bag = s.bag || {}, pl = s.player, knife = hasKnife(s, pl);
    return fieldKnown(s).map(function (r) {
      var on = r.on.filter(function (k) { return bag[k] > 0; });
      var useOk = r.use === "@knife" ? knife : bag[r.use] > 0, alsoOk = !r.also || bag[r.also] > 0;
      if (r.needs) useOk = Object.keys(r.needs).every(function (k) { return (bag[k] || 0) >= r.needs[k]; });
      return { id: r.id, name: r.name, about: r.about, makes: r.makes, use: r.use === "@knife" ? "a hunting knife" : ITEMS[r.use].name, useId: r.use === "@knife" ? "" : r.use,
               on: r.on.map(function (k) { return ITEMS[k].name; }), also: r.also ? ITEMS[r.also].name : "", can: useOk && on.length > 0 && alsoOk };
    });
  }
