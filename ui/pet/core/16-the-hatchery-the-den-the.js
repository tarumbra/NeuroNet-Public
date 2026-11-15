  // ---- the hatchery, the den, the Petapedia (slice 5) ------------------------------------
  function discover(s, q, at) {
    s.dex = s.dex || {};
    var k = q.species + "/" + q.colour;
    if (!s.dex[k]) s.dex[k] = { first: at };
  }
  function newPet(kind, egg, born, hatchAt) {
    var sp = kind.split("/");
    return { id: "p" + Math.abs(born | 0).toString(36) + sp[0].charAt(0) + Math.floor(hatchAt % 997), name: "", species: sp[0], colour: sp[1], egg: egg,
             born: born, hatchAt: hatchAt, at: hatchAt, xp: 0, areas: {}, away: null, injuredUntil: 0, gear: {},
             skills: { foraging: 0, fishing: 0, mining: 0, lumbering: 0 }, job: null, lastTrip: null,
             s: { full: 80, happy: 80, energy: 90, clean: 100, health: 100 }, asleep: false, sick: false, lastMed: 0, counts: {} };
  }
  // eggs in the hatchery that are ready come out into the den
  function hatchDue(s, upTo) {
    for (var i = 0; i < s.hatchery.length;) {
      var h = s.hatchery[i];
      if (h.hatchAt > upTo) { i++; continue; }
      var q = newPet(h.kind, h.egg, h.started, h.hatchAt);
      if (h.gene) {                                                     // bred: the egg carries the child's nature and colouring
        q.gene = copy(h.gene);
        if (h.gene.pattern && PATTERNS[h.gene.pattern]) q.skin = copy(PATTERNS[h.gene.pattern].pal);
        s.natures = s.natures || {}; s.natures[h.gene.nature] = s.natures[h.gene.nature] || h.hatchAt;
      }
      geneOf(q);
      q.choose = true;                                                  // a home pet or a battle pet? asked once (Part 11a)
      s.den.push(q);
      discover(s, q, h.hatchAt);
      s.hatchery.splice(i, 1);
      note(s, h.hatchAt, "In the hatchery: the " + EGGS[h.egg].name.toLowerCase() + " hatched -- it's a " + kindName(q) + "! (" + rarityOf(q) + ") It's in the den: keep it at home, or send it to the Beast Pen.");
    }
  }
