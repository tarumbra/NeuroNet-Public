  // ---- trips ----------------------------------------------------------------------
  // a trip's worker: you, or (slice 5) a pet from the den
  function find(s, w, job, at) {
    var sk = SKILLS[job.skill], spot = spotOf(job.skill, job.spot), pl = w, you = w === s.player;
    pl.skills = pl.skills || {};
    pl.skills[job.skill] = pl.skills[job.skill] || 0;
    var before = levelOf(pl.skills[job.skill]);
    var bg = you && GATHERING.indexOf(job.skill) >= 0 ? brewOf(s, "gather") : null;      // a gathering draught
    var xp = Math.round(spot.xp * rate("xp") * (you ? modeBonus(s, "xp") : 1) * (1 + (you ? boostFor(s.pet, job.skill, at) : 0) + (job.xpBonus || 0) + (bg ? bg.xp || 0 : 0)) * (you ? homeXp(s, job.skill, at) * noviceMult(before) : 1) * 100) / 100;
    pl.skills[job.skill] = Math.round((pl.skills[job.skill] + xp) * 100) / 100;
    job.xp = Math.round((job.xp + xp) * 100) / 100;
    var item;
    var loot = spot.loot;
    if (job.byHand) loot = loot.filter(function (l) { return job.skill === "fishing" ? HAND_CATCH[l[0]] : !ORE[l[0]]; });   // bare hands: never ore; shrimp and minnows
    // no hatchet: "lumbering should only give twigs until you have an axe" -- what lies on the ground: twigs, and the spot's leaf
    // litter (2026-10-19, Cam: "why cant i get leaf litter when collecting twigs from apple trees ... in autumn leafs do fall")
    if (job.twigsOnly) {
      loot = loot.filter(function (l) { return l[0] === "twigs" || l[0] === "leaflitter"; });
      if (!loot.some(function (l) { return l[0] === "twigs"; })) loot = [["twigs", 15]].concat(loot);   // (the oaks list no twigs of their own)
    }
    if (job.twigsOnly && loot.length === 1) item = "twigs";
    else if (spot.rare && !job.byHand && !job.twigsOnly && rnd(job) < (job.rareMult || 1) * rate("drops") / spot.rare[1]) {
      item = spot.rare[0];
      note(s, at, "A rare find at the " + spot.name + ": " + ITEMS[item].name.toLowerCase() + "!");
    } else {
      var total = 0, i;
      for (i = 0; i < loot.length; i++) total += loot[i][1];
      var r = rnd(job) * total;
      for (i = 0; i < loot.length; i++) { r -= loot[i][1]; if (r < 0) { item = loot[i][0]; break; } }
      if (!item) item = loot[loot.length - 1][0];
    }
    var got = bg && bg.double && rnd(job) < bg.double ? 2 : 1;
    if (spot.yield) got *= spot.yield + Math.floor(Math.max(0, before - spot.level) / 11);   // runes: a handful from each essence stone
    // into the bag if there's room (2026-10-07); a herb comes unidentified -- the spot's own, or by its level
    var put = HERB_TIER_OF[item] ? addUnid(s, wildHerb(job, item, spot.level), got) : give(s, item, got);
    if (put) job.items[HERB_TIER_OF[item] ? "unidherb" : item] = (job.items[HERB_TIER_OF[item] ? "unidherb" : item] || 0) + put;
    job.count++;
    if (bg) useBrew(s, "gather", at);
    // an unidentified herb, now and then (Herblore): foraging and digging, by the spot's level and yours
    if (you && (job.skill === "foraging" || job.skill === "digging") && rnd(job) < herbChance(before, spot.level)) {
      if (addUnid(s, rollHerb(job, spot.level), 1)) job.items.unidherb = (job.items.unidherb || 0) + 1;
    }
    if (you && job.tool) wearTool(s, job, item, at);
    if (you && spot.needs && KIT_DUR[spot.needs] && s.player.job === job && !job.byHand) wearKit(s, job, spot.needs, at);
    // the spot's main find won't fit any more (2026-10-10 audit, I-5): said once in the diary, and the trip shows "stack full"
    // until you make room -- it carries on for the xp (a 250 stack fills in ~15 minutes at 3 s a find, so ending the trip
    // would turn a night away into a quarter of an hour). Other finds that don't fit are just left behind, as before.
    // B1 (2026-10-19): ANY find that won't fit says so (twigs at the Apple trees without a hatchet never were the main find)
    var fullUp = you && s.player.job === job && put < got && !(s.dev && s.dev.infinite);
    if (you && item === job.full && put >= got) job.full = "";
    var after = levelOf(pl.skills[job.skill]);
    if (after > before) {
      var opened = sk.spots.filter(function (x) { return x.level === after && !x.essence; });
      note(s, at, (you ? "You" : who(w)) + " reached " + sk.name + " level " + after + "!" +
                  (opened.length ? " The " + opened[0].name + " is open to " + (you ? "you" : "them") + " now." : ""));
    }
    var mainFind = job.twigsOnly ? "twigs" : spot.loot[0][0], firstFull = !job.full;
    if (fullUp && (firstFull || item === mainFind)) job.full = item;    // the trip shows the main find once it's that one
    if (fullUp && firstFull) {
      note(s, at, "Your bag is full (" + bagUsed(s) + "/" + bagCap(s) + " slots) -- no room for more " + ITEMS[item].name.toLowerCase() +
                  " -- you're still at the " + spot.name + " for the xp, but nothing more of it fits. Store things at home to carry on collecting.");
    }
  }

  function endTrip(s, w, at, why) {
    var job = w.job, spot = placeOf(job), you = w === s.player;
    w.lastTrip = { skill: job.skill, spot: job.spot, hunt: job.hunt || "", since: job.since, ended: at, count: job.count, xp: job.xp, items: job.items, ate: job.ate || null, why: why || "", stolen: job.stolen || 0 };
    w.job = null;
    if (you && w.fury) w.fury = 0;                                        // a Berserker's fury fades when the hunt ends (Part 5)
    if (you && w.devotion) w.devotion = 0;                                // ... and a Paladin's devotion (Part 8)
    if (you && w.battle && w.battle.kind === "hunt") w.battle = null;     // you walk away mid-fight
    if (job.hunt && why === "food") {                                     // the hunt plan's last meal (V3, Battle Re-work Part 14)
      note(s, at, (you ? "Out of food, you came home from the " : who(w) + " ran out of food and came home from the ") + spot.name + " after " + job.count + " win" + (job.count === 1 ? "" : "s") +
                  " -- hungry, but home before the next fight could finish you.");
      return;
    }
    if (you && job.hunt && s.beasts) s.beasts.forEach(ppFill);           // the pack's home: every PP full (V5, 2026-10-17)
    if (job.steal) {                                                     // the Marketplace (2026-10-17)
      note(s, at, "You left the market: " + (job.count || 0) + " good tr" + ((job.count || 0) === 1 ? "y" : "ies") + ", " + Math.round(job.xp || 0) + " Larceny xp; in your swag sack for Nell: " +
                  [job.coins ? job.coins + " coins from purses" : "", Object.keys(job.items || {}).length ? itemsText(job.items) : ""].filter(Boolean).join(" and ") + (job.coins || Object.keys(job.items || {}).length ? "" : "nothing") +
                  (job.caught ? " -- caught " + job.caught + " time" + (job.caught === 1 ? "" : "s") + " (" + (job.fines || 0) + " coins in fines)" : "") + ".");
      return;
    }
    if (job.hunt) {
      note(s, at, (you ? (why === "hurt" ? "Hurt, you came home from the " : why === "time" ? "Home from the " : "You left the ")
                       : who(w) + (why === "hurt" ? " was hurt and came home from the " : why === "time" ? " came home from the " : " left the ")) +
                  spot.name + " after " + job.count + " win" + (job.count === 1 ? "" : "s") + ".");
      return;
    }
    note(s, at, (you ? (why === "time" ? "Home from the " : "You left the ") : who(w) + (why === "time" ? " came home from the " : " left the ")) +
                spot.name + " with " + Math.round(job.xp) + " " + SKILLS[job.skill].name + " xp" +
                (Object.keys(job.items || {}).length ? " (" + itemsText(job.items) + ")." : "."));
  }

  // Looking for prey (Cam, 2026-10-03): "I want that fixed time to work like a cap for the longest it
  // can take, however have it random, so anywhere from 5 seconds to the cap." The trip's own dice
  // pick it, so a hunt still comes out the same however often it's looked at.
  var HUNT_MIN_WAIT = 5000;
  var FIGHT_GAP = 1000;                    // your hunts: a breath between fights, no more (2026-10-07)
  function huntWait(job) { return HUNT_MIN_WAIT + Math.floor(rnd(job) * Math.max(0, job.every - HUNT_MIN_WAIT)); }
  function placeOf(j) { return j.hunt ? HUNTS[j.hunt] : spotOf(j.skill, j.spot); }
  function runTrip(s, w, upTo) {
    while (w.job) {
      var j = w.job, spot = placeOf(j);
      if (!spot) { w.job = null; break; }
      if (j.hunt && w === s.player) {
        // your hunts are live: a fight goes round by round, then you look for the next one
        var b = w.battle;
        if (b && b.kind === "hunt") {
          if (b.nextRound > upTo) break;
          var bat = b.nextRound, res = battleRound(s, w, b, bat);
          if (res) endHuntBattle(s, w, j, b, res, bat);
          continue;
        }
        if (j.next > j.until) { if (upTo >= j.until) endTrip(s, w, j.until, "time"); break; }
        if (j.next > upTo) break;
        healTo(w, j.next);
        var aw = areaWorst(spot, guardOf(w));
        autoEat(s, w, 50, j.next, aw);
        if (mustFlee(w, aw)) { endTrip(s, w, j.next, "hurt"); break; }
        var st = startBattle(s, w, "hunt", j.hunt, pick(j, quarryPool(s, j.hunt, huntPool(spot, j.next))), j.next, j);   // day or night (2026-10-08)
        if (st.out) { endHunt(s, w, j, j.next, (st.why || "Out of " + st.out + "s") + " -- you came home from the " + spot.name + " after " + j.count + " win" + (j.count === 1 ? "" : "s") + "."); break; }
        continue;
      }
      if (j.next > j.until) { if (upTo >= j.until) endTrip(s, w, j.until, "time"); break; }
      if (j.next > upTo) break;
      // bait: one a catch (yours -- pets fish with their paws); none left, home you come
      if (!j.hunt && w === s.player && spot.bait) {
        if (!has(s, spot.bait)) { endHunt(s, w, j, j.next, "Out of " + ITEMS[spot.bait].name.toLowerCase() + "s -- you came home from the " + spot.name + " with " + Math.round(j.xp) + " " + SKILLS[j.skill].name + " xp."); break; }
        if (!spot.baitPace || rnd(j) < spot.baitPace) take(s, spot.bait);   // fishing bait: the same by the hour (2026-10-09)
      }
      if (j.hunt) hunt(s, w, j, j.next);
      else if (j.steal) { if (stealTry(s, w, j, j.next)) continue; }     // the Marketplace (2026-10-17)
      else { find(s, w, j, j.next); giftedRoll(s, w, j, j.next); }   // a gifted pet, now and then (2026-10-12)
      if (w.job !== j) continue;
      if (j.hunt) {
        var gap = huntWait(j);
        j.next += gap;
        if (j.fight) j.fight.gap = gap;                 // the battle screen fits the replay into it
      } else j.next += j.every || spot.time * 1000;
    }
  }

