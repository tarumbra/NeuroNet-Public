  // ==== pets at work, and expedition parties (2026-10-10, audit M-1 and M-2 -- Cam: "lets roll into the next jobs") ===========
  //  Jobs at home: a den pet can work at the estate while you're out -- a gardener waters the plots and they grow faster, a
  //  hand in a room makes its benches give more xp and now and then saves an ingredient, a store keeper looks after one more
  //  chest. How many can work: your bedroom's tier (the pets' quarters), 1 to 4. A pet whose companion knack is the work's
  //  skill does it twice as well (a cow in the garden, a chicken in the kitchen).
  //  Parties: up to two den pets go along on your companion's expedition, each with a role -- a scout finds more and dodges
  //  traps, a hauler carries more home, a fighter stands beside it. They share the xp and come home with it.
  var JOBS = CONTENT("JOBS");
  var JOB_ORDER = CONTENT("JOB_ORDER");
  function jobSlots(s) { return roomTier(s, "bedroom"); }                // a basic bedroom 1 ... a grand one 4
  /** Den pets doing this job (and free to: not out on a trip or an expedition). */
  function workers(s, job) {
    if (!s || islandOf(s)) return [];                                    // the estate at home
    return (s.den || []).filter(function (q) { return q && q.work === job && !q.job && !q.away; });
  }
  /** How well a job's done: each worker 1, or 2 if its knack is the job's skill (a cooking pet in the kitchen). */
  function jobPower(s, job) {
    var J = JOBS[job], skills = J.room ? (ROOMS[J.room].workshops || []).map(function (w) { return WORKSHOPS[w] && WORKSHOPS[w].skill; }) : [J.skill];
    return workers(s, job).reduce(function (a, q) { return a + (skills.indexOf(BOOSTS[q.species]) >= 0 ? 2 : 1); }, 0);
  }
  function gardenFx(s) { var g = jobPower(s, "gardener"); return { water: g > 0, speed: Math.max(0.6, 1 - 0.1 * g) }; }
  function keeperChests(s) { return Math.min(2, workers(s, "keeper").length); }
  /** A bench's hand: { xp bonus, saving per craft } -- or nothing. */
  function handFx(s, ws) {
    var room = ROOM_OF[ws];
    if (!room || !JOBS[room]) return { xp: 0, save: 0 };
    var pw = jobPower(s, room);
    return { xp: 0.1 * pw, save: 0.1 * pw };
  }
  function jobsView(s) {
    var slots = jobSlots(s), used = (s.den || []).filter(function (q) { return q && q.work; }).length;
    return { slots: slots, used: used, home: !islandOf(s),
             jobs: JOB_ORDER.map(function (k) { var J = JOBS[k];
               return { id: k, name: J.name, says: J.says, max: J.max,
                        who: (s.den || []).filter(function (q) { return q && q.work === k; }).map(function (q) { return { id: q.id, name: who(q), busy: !!(q.job || q.away) }; }) }; }) };
  }
  function workAct(s, opts, now) {
    var q = denPet(s, opts.id), job = opts.work || "";
    if (!q) return no(s, "Only pets in the den can work at home -- your companion stays with you.");
    if (!job) { if (!q.work) return no(s, who(q) + " isn't working."); var was = JOBS[q.work].name; q.work = ""; return yes(s, now, who(q) + " stopped working as " + aOr(was).replace(/^an? /, "the ").toLowerCase() + "."); }
    var J = JOBS[job];
    if (!J) return no(s, "There's no job like that.");
    if (q.work === job) return no(s, who(q) + " already works as " + aOr(J.name).toLowerCase() + ".");
    if (stage(q, now) === "egg") return no(s, "An egg can't work.");
    if (q.job) return no(s, who(q) + " is out " + (q.job.hunt ? "hunting" : "gathering") + " -- bring them home first.");
    if (q.away) return no(s, who(q) + " is away on an expedition.");
    if (s.breeding && (s.breeding.a === q.id || s.breeding.b === q.id)) return no(s, who(q) + " is busy breeding.");
    var others = (s.den || []).filter(function (x) { return x && x.work && x !== q; });
    if (!q.work && others.length >= jobSlots(s)) return no(s, "Your pets' quarters have room for " + jobSlots(s) + " working pet" + (jobSlots(s) === 1 ? "" : "s") + " -- build a better bedroom for more.");
    if (others.filter(function (x) { return x.work === job; }).length >= J.max) return no(s, "The " + J.name.toLowerCase() + (J.max === 1 ? " job is taken." : "s are all taken (" + J.max + ")."));
    q.work = job;
    return yes(s, now, who(q) + " is your " + J.name.toLowerCase() + " now: " + J.says.charAt(0).toLowerCase() + J.says.slice(1) + ".");
  }

  // ---- parties --------------------------------------------------------------------------------------------------------
  var ROLES = CONTENT("ROLES");
  var PARTY_MAX = 2;
  /** Why a den pet can't join an expedition to this area ("" if it can). */
  function partyLock(s, q, area, now) {
    var ar = AREAS[area];
    if (!q) return "That pet isn't in the den";
    if (stage(q, now) === "hatchling" || stage(q, now) === "egg") return who(q) + " is too young";
    if (q.job) return who(q) + " is out " + (q.job.hunt ? "hunting" : "gathering");
    if (q.away) return who(q) + " is already away";
    if (q.work) return who(q) + " is working as " + aOr(JOBS[q.work].name).toLowerCase();
    if (s.breeding && (s.breeding.a === q.id || s.breeding.b === q.id)) return who(q) + " is breeding";
    if (injuryBlock(q, now)) return who(q) + " is hurt";
    if (ar && levelOf(q.xp || 0) < Math.max(1, ar.level - 5)) return who(q) + " needs to be level " + Math.max(1, ar.level - 5) + " for the " + ar.name;
    if (ar && ar.flying && FLYING.indexOf(q.species) < 0) return who(q) + " can't fly";
    return "";
  }
  /** Check and gather a party: [{ q, role }] or an error string. */
  function partyOf(s, area, list, now) {
    var out = [], seen = {};
    list = Array.isArray(list) ? list.slice(0, PARTY_MAX + 1) : [];
    if (list.length > PARTY_MAX) return "A party is your companion and up to " + PARTY_MAX + " more";
    for (var i = 0; i < list.length; i++) {
      var m = list[i] || {}, q = denPet(s, m.id);
      if (!ROLES[m.role]) return "Pick a role for each pet: scout, hauler or fighter";
      if (seen[m.id]) return "The same pet twice";
      seen[m.id] = 1;
      var why = partyLock(s, q, area, now);
      if (why) return why;
      out.push({ q: q, role: m.role });
    }
    return out;
  }
  /** The fighters add to the party's strength; the scouts and haulers are counted. */
  function partyFx(members) {
    var fx = { scout: 0, hauler: 0, hp: 0, att: 0, def: 0, maxHit: 0 };
    members.forEach(function (m) {
      var g = function (k) { return geneOff(m.q, k); };
      if (m.role === "scout") fx.scout += 1 + Math.max(-0.5, g("agi") * 0.1);
      if (m.role === "hauler") fx.hauler += 1 + Math.max(-0.5, g("knack") * 0.1);
      if (m.role === "fighter") { var f = runFighter(m.q, {}); fx.hp += Math.round(f.hp * 0.5); fx.att += Math.round(f.att * 0.5); fx.def += Math.round(f.def * 0.3); fx.maxHit += 1; }
    });
    return fx;
  }
  /** Home from the run: the party shares the xp, and comes back (a fall hurts them a little; only the leader can die). */
  function partyHome(s, job, at, how) {
    var back = [];
    (job.party || []).forEach(function (m) {
      var q = denPet(s, m.id);
      if (!q) return;
      q.away = null;
      var b4 = levelOf(q.xp || 0), gain = Math.round((job.xp || 0) * 0.6);
      q.xp = (q.xp || 0) + gain;
      if (how === "fell" && !q.injury) q.injury = { sev: "light", at: at, treatedAt: null };
      if (levelOf(q.xp) > b4) note(s, at, who(q) + " reached level " + levelOf(q.xp) + " on the expedition!");
      back.push(whom(q) + " (+" + gain + " xp" + (how === "fell" ? ", a little hurt" : "") + ")");
    });
    if (back.length) note(s, at, "The party came home too: " + back.join(" and ") + ".");
  }
  function partyView(s, area, now) {
    return (s.den || []).filter(function (q) { return q && stage(q, now) !== "egg"; }).map(function (q) {
      return { id: q.id, name: who(q), species: q.species, colour: q.colour, level: levelOf(q.xp || 0), lock: partyLock(s, q, area, now), nature: (geneView(q) || {}).natureName || "" };
    });
  }
