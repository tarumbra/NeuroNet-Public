  // ---- breeding (2026-10-03) ------------------------------------------------------------
  // The brief: "Breed (some eggs can only be obtained by specific pets breeding, but also
  // depends on some special circumstances such as specific skill level, pet level, age
  // etc)". Two pets, an hour together, then a day's rest each. The egg goes straight into
  // the hatchery (so a place must be free). A special pairing lays a Special egg (2 hours);
  // otherwise a Bred egg (30 minutes) that takes after the parents.
  var BREED_TIME = HOUR, BREED_REST = DAY, BREED_AGE = 5 * DAY;
  function plv(q) { return levelOf(q.xp || 0); }
  function psk(q, k) { return levelOf((q.skills || {})[k] || 0); }
  function days(q, now) { return (now - q.hatchAt) / DAY; }
  var BREEDS = [
    { id: "goldencat", kind: "cat/golden",
      hint: "Two cats who have seen the isle (pet level 5 each), one of them handy with an axe (Lumbering 10).",
      test: function (a, b) { return a.species === "cat" && b.species === "cat" && plv(a) >= 5 && plv(b) >= 5 && (psk(a, "lumbering") >= 10 || psk(b, "lumbering") >= 10); } },
    { id: "moonbunny", kind: "bunny/moon",
      hint: "Two grown bunnies (10 days old each), one a keen forager (Foraging 10).",
      test: function (a, b, now) { return a.species === "bunny" && b.species === "bunny" && days(a, now) >= 10 && days(b, now) >= 10 && (psk(a, "foraging") >= 10 || psk(b, "foraging") >= 10); } },
    { id: "emberfrog", kind: "frog/ember",
      hint: "A seasoned frog (pet level 8, Fishing 10) with any pet of level 8.",
      test: function (a, b) {
        var f = function (x, y) { return x.species === "frog" && plv(x) >= 8 && psk(x, "fishing") >= 10 && plv(y) >= 8; };
        return f(a, b) || f(b, a); } }
  ];
  function allPets(s) { return (s.pet ? [s.pet] : []).concat(s.den || []); }
  function petById(s, id) { var l = allPets(s); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function breeding(s, q) { return !!(s.breeding && (s.breeding.a === q.id || s.breeding.b === q.id)); }
  /** Why this pet can't breed now, or "". */
  function cantBreed(s, q, now) {
    if (stage(q, now) === "egg") return "hasn't hatched";
    if (isAstral(q.species)) return "came from the sky -- an Astral pet can't be bred";   // (V10, the Economist)
    if (now - q.hatchAt < BREED_AGE) return "is too young (5 days old)";
    if (q.away) return "is on an expedition";
    if (q.job) return "is out " + (q.job.hunt ? "hunting" : "gathering");
    if (q.sick) return "is poorly";
    if (q.injuredUntil && q.injuredUntil > now) return "is hurt";
    if (breeding(s, q)) return "is breeding";
    if (q.bredAt && now - q.bredAt < BREED_REST) return "needs rest (" + Math.ceil((q.bredAt + BREED_REST - now) / HOUR) + " h)";
    return "";
  }
  function specialFor(a, b, now) { for (var i = 0; i < BREEDS.length; i++) if (BREEDS[i].test(a, b, now)) return BREEDS[i]; return null; }
  /** What a pair might lay: [{kind, name, chance}]. */
  function pairOdds(a, b) {
    var ka = a.species + "/" + a.colour, kb = b.species + "/" + b.colour, out = {};
    var add = function (k, n) { out[k] = (out[k] || 0) + n; };
    if (a.species === b.species) {
      add(ka, 45); add(kb, 45);
      var others = SPECIES[a.species].colours.filter(function (c) { return c !== a.colour && c !== b.colour; });
      if (others.length) others.forEach(function (c) { add(a.species + "/" + c, 10 / others.length); });
      else { add(ka, 5); add(kb, 5); }
    } else { add(ka, 50); add(kb, 50); }
    return Object.keys(out).map(function (k) { return { kind: k, name: PETS[k] ? PETS[k].name : k, chance: Math.round(out[k] * 10) / 10 }; });
  }
  function layDue(s, upTo) {
    var br = s.breeding;
    if (!br || br.until > upTo) return;
    var a = petById(s, br.a), b = petById(s, br.b), egg, kind;
    s.breeding = null;
    if (!a || !b) return;
    if (br.special) { egg = "special"; kind = br.special; }
    else {
      var table = pairOdds(a, b).map(function (o) { return [o.kind, o.chance]; });
      egg = "bred"; kind = pick(br, table);
    }
    a.bredAt = b.bredAt = br.since;
    var cg = childGene(a, b, br);
    s.hatchery.push({ egg: egg, kind: kind, gene: cg, started: br.until, hatchAt: br.until + Math.round(EGGS[egg].hatch / rate("hatch")) * (s.dev && s.dev.instantHatch ? 0 : 1) });
    note(s, br.until, who(a) + " and " + whom(b) + " laid " + aOr(EGGS[egg].name) + (egg === "special" ? " -- something special!" : ".") + " It's in the hatchery.");
  }
  function denPet(s, id) { for (var i = 0; i < s.den.length; i++) if (s.den[i].id === id) return s.den[i]; return null; }

