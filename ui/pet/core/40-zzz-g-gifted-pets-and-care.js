  // ---- gifted pets, and care that shows in the work (2026-10-12, audit FEAT-1 to FEAT-3 -- "species skills", "care feeds
  //      work", "rare skilling pets"). Species skills were already there: a pet whose knack is the skill gathers 20% faster
  //      (marked ★ on its card). Now:
  //   - care: your companion's help already doubles while it's happy. Den pets live in your pet's room, so their comfort is the
  //     room: a pet bed, a toy box and a rug make them work 3% quicker each (10% with all three) when they go gathering;
  //   - gifted pets: gathering, now and then a young animal follows you home -- one per skill, ever. It has a knack for that
  //     skill, the best potential, and the Gifted nature, which doubles its companion bonus. The higher the spot, the likelier:
  //     about one in 60,000 finds at level 50 (a hundred-odd hours), one in 300,000 at level 10. The roll is its own, so a
  //     trip's other finds come out exactly as before.
  var GIFTED = CONTENT("GIFTED");
  var GIFTED_TUNE = CONTENT("GIFTED_TUNE");
  function giftedChance(spot) { return spot && spot.level >= GIFTED_TUNE.min && !spot.essence ? spot.level / MAX_LEVEL * GIFTED_TUNE.rate : 0; }
  /** After each of your finds: a gifted pet for this skill, if the find's own roll says so. */
  function giftedRoll(s, w, j, at) {
    if (w !== s.player || j.hunt || !GIFTED[j.skill] || (s.gifted || {})[j.skill]) return;
    var spot = spotOf(j.skill, j.spot), ch = giftedChance(spot);
    if (!ch) return;
    var roll = (hashOf(String(j.seed) + "/" + j.skill + "/" + j.count) >>> 0) / 4294967296;
    if (roll >= ch) return;
    var q = newPet(GIFTED[j.skill], "common", at - EXPEDITION_AGE, at - EXPEDITION_AGE);   // grown enough for expeditions
    q.id = "g" + j.skill.slice(0, 3) + Math.floor(at / 1000).toString(36);
    q.gene = { sex: (hashOf(q.id) & 1) ? "f" : "m", nature: "gifted", stats: { hp: 10, att: 10, def: 10, agi: 10, knack: 10 } };
    s.den = s.den || []; s.den.push(q);
    discover(s, q, at);
    s.gifted = s.gifted || {}; s.gifted[j.skill] = at;
    s.natures = s.natures || {}; s.natures.gifted = s.natures.gifted || at;
    note(s, at, "While you were " + SKILLS[j.skill].verb + " at the " + spot.name + ", a " + kindName(q).toLowerCase() + " followed you home! It's Gifted: a natural at " +
         SKILLS[j.skill].name.toLowerCase() + ", and twice the help as your companion. It's in the den.");
  }
  var COMFORTS = CONTENT("COMFORTS");
  /** The pet's room's comforts the den pets enjoy (0-3). */
  function comfortsOf(s) { var r = (s && s.room) || {}; return COMFORTS.filter(function (k) { return !!r[k]; }).length; }
  /** A den pet's pace setting off: 3% quicker for each comfort, 10% with all three. */
  function carePace(s) { var n = comfortsOf(s); return n >= 3 ? 0.9 : 1 - 0.03 * n; }
  function giftedView(s) {
    return Object.keys(GIFTED).map(function (k) { var sp = GIFTED[k].split("/");
      return { skill: k, name: SKILLS[k].name, found: !!((s && s.gifted) || {})[k], kind: GIFTED[k], species: sp[0], colour: sp[1] }; });
  }
