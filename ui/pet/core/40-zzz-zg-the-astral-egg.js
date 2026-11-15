  // ---- V10: the Astral egg and the planet pets (2026-10-18; Cam, PT19 b5: "the rare chance for them to drop a new type of egg ...
  //      called the Astral egg. This egg should drop special rare pets that are themed around the planets ... their spells will be
  //      elemental based on the planet"). A won rematch at the tower now and then drops one (ASTRAL.drop by rank); eight pets,
  //      painted by Cam (pet sheet 7); as battle pets the Astral type, neutral, with their planet's element in their moves.
  var ASTRAL = CONTENT("ASTRAL");
  ITEMS.astralegg = ASTRAL.item;
  EGGS.astral = ASTRAL.egg;                                              // (not in EGG_ORDER: that is the first egg you choose)
  BEAST_TYPES.astral = ASTRAL.type;
  BEAST_RULES.base.astral = ASTRAL.base;
  var ASTRAL_SPECIES = {};
  Object.keys(ASTRAL.pets).forEach(function (k) {
    var P = ASTRAL.pets[k], c = k.split("/")[1];
    SPECIES[P.species] = { name: P.speciesName, colours: [c] };
    PETS[k] = { name: P.name, rarity: P.rarity };
    FIGHT_STYLE[P.species] = P.fight; BOOSTS[P.species] = P.boost; PET_ATTACKS[P.species] = P.attack;
    if (P.size === "small") PET_SIZE.small.push(P.species); if (P.size === "large") PET_SIZE.large.push(P.species);
    BEAST_TYPE_OF.species[P.species] = "astral";
    ASTRAL_SPECIES[P.species] = P.element;
  });
  // each element's four moves (ids must be new), and each planet pet learns its own element's
  Object.keys(ASTRAL.moves).forEach(function (el) {
    var ids = Object.keys(ASTRAL.moves[el]);
    ids.forEach(function (m) {
      if (BEAST_MOVES[m]) throw new Error("An astral move " + m + " has the id of a move pets already learn");
      BEAST_MOVES[m] = Object.assign({ type: "astral", element: el }, ASTRAL.moves[el][m].power ? { dtype: "magic" } : {}, ASTRAL.moves[el][m]);   // spells: magic blows
    });
    Object.keys(ASTRAL_SPECIES).forEach(function (sp) { if (ASTRAL_SPECIES[sp] === el) SPECIES_MOVES[sp] = ids.slice(); });
  });
  function isAstral(species) { return !!ASTRAL_SPECIES[species]; }
  /** A won rematch (endDuel asks): now and then, an Astral egg -- on the duel's own dice. */
  function astralDrop(s, b, rank, at, got) {
    var n = ASTRAL.drop[rank] || 0; if (!n) return;
    if (rnd(b) >= 1 / n) return;
    give(s, "astralegg", 1, true); if (got) got.astralegg = (got.astralegg || 0) + 1;
    s.unlocked = (s.unlocked || []).concat([{ at: at + 0.25, title: "An Astral egg!", list: [{ icon: "astralegg", text: ASTRAL.item.about },
      { icon: "astralegg", text: "Put it in the Hatchery: a pet themed on a planet hatches from it -- they can't be sold or bred." }] }]).slice(-5);
    note(s, at, "Something falls from the mage's sleeve as they bow: an Astral egg!");
  }
