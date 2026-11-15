  // ---- the farm --------------------------------------------------------------------------
  function growFarm(s, upTo) {
    (s.farm.pots || []).forEach(function (pt, i) {
      if (!pt.herb || pt.ready) return;
      var at = s.dev && s.dev.instantHatch ? pt.since : pt.readyAt;
      if (at <= upTo) { pt.ready = true; note(s, at, "Pot " + (i + 1) + ": the " + HERBS[pt.herb].name.toLowerCase() + " is ready to pick."); }
    });
    var gf = gardenFx(s);                                                // your gardeners (2026-10-10): they water, and it grows faster
    s.farm.plots.forEach(function (pl, i) {
      if (pl.state !== "growing") return;
      var c = CROPS[pl.crop], len = s.dev && s.dev.instantHatch ? 0 : Math.round(c.stage * (pl.fert || 1) * gf.speed);
      if (gf.water) pl.watered = true;
      while (pl.stage < 4 && pl.watered && pl.stageAt + len <= upTo) {
        pl.stage++; pl.stageAt += len; pl.watered = !!pl.soak || gf.water;  // the steel can (or a gardener) keeps it watered
        if (pl.stage === 4) { pl.state = "ripe"; note(s, pl.stageAt, "Plot " + (i + 1) + ": the " + c.plural + " " + (c.plural === "cotton" ? "is" : "are") + " ready to harvest."); }
      }
    });
  }
  function farmXp(s, xp, now) {
    var b = levelOf(s.player.skills.farming || 0);
    s.player.skills.farming = Math.round(((s.player.skills.farming || 0) + xp * noviceMult(b)) * 10) / 10;
    var a = levelOf(s.player.skills.farming);
    if (a > b) note(s, now, "You reached Farming level " + a + "!");
  }
  function farmAct(s, o, now) {
    var plots = s.farm.plots, pl = plots[o.plot | 0], lv = levelOf(s.player.skills.farming || 0);
    var r = typeof o.roll === "number" ? o.roll : (now % 997) / 997;
    var pots = s.farm.pots, pt = pots[o.pot | 0];
    if (o.op === "addpot") {
      if (pots.length >= maxPots(s)) return no(s, "The windowsill holds " + maxPots(s) + " pots.");
      if (!has(s, "plantpot")) return no(s, "You need a plant pot -- make one at your potter's wheel (Crafting 5).");
      take(s, "plantpot");
      pots.push({ herb: "", since: 0, readyAt: 0, ready: false });
      return yes(s, now, "You set pot " + pots.length + " on the windowsill.");
    }
    if (o.op === "potplant") {
      if (!pt) return no(s, "There's no pot like that.");
      if (pt.herb) return no(s, "Pot " + ((o.pot | 0) + 1) + " is growing already.");
      var hs = ITEMS[o.seed], h = hs && HERBS[hs.herbseed];
      if (!h) return no(s, "Pick a herb seed for the pot.");
      if (lv < h.level) return no(s, h.name + " needs Farming level " + h.level + ".");
      if (!has(s, o.seed)) return no(s, "There's no " + hs.name.toLowerCase() + " in the bag.");
      take(s, o.seed);
      pt.herb = hs.herbseed; pt.since = now; pt.readyAt = now + h.time; pt.ready = false;
      farmXp(s, 4, now);
      return yes(s, now, "You planted " + h.name.toLowerCase() + " in pot " + ((o.pot | 0) + 1) + ".");
    }
    if (o.op === "potpick") {
      if (!pt || !pt.herb) return no(s, "That pot is empty.");
      if (!pt.ready) return no(s, "The " + HERBS[pt.herb].name.toLowerCase() + " isn't ready yet.");
      var hh = HERBS[pt.herb], hn = hh.yield[0] + Math.floor(r * (hh.yield[1] - hh.yield[0] + 1));
      // you grow what you know (Herblore, 2026-10-06): a herb in your Herbarium comes up as itself;
      // one you've never identified comes up unidentified, of its tier
      var known = !HERB_TIER_OF[pt.herb] || herbarium(s)[pt.herb] > 0;
      var gotP = known ? pt.herb : "unidherb";
      if (known) giveKnown(s, pt.herb, hn); else addUnid(s, pt.herb, hn);
      farmXp(s, hh.xp, now);
      pt.herb = ""; pt.ready = false;
      return yes(s, now, "You picked " + hn + " × " + (known ? hh.name : ITEMS[gotP].name).toLowerCase() +
                 " (+" + hh.xp + " Farming xp)." + (known ? "" : " Identify it at the Herb table -- once it's in your Herbarium, it grows as itself.") + " The pot's ready for another seed.");
    }
    if (o.op === "unlock") {
      var next = plots.length, u = PLOT_UNLOCKS[next];
      if (!u) return no(s, "The farm has all its plots.");
      if (lv < u.level) return no(s, "Plot " + (next + 1) + " needs Farming level " + u.level + ".");
      if (!has(s, "soil", u.soil)) return no(s, "Plot " + (next + 1) + " needs " + u.soil + " soil to dig -- digging finds it.");
      take(s, "soil", u.soil);
      plots.push(newPlot());
      return yes(s, now, "You dug plot " + (next + 1) + " with your soil.");
    }
    if (o.op === "waterall") {
      if (!has(s, "wateringcan") && !has(s, "steelwateringcan")) return no(s, "You need a watering can -- smith one at the anvil.");
      var wn = 0;
      plots.forEach(function (q, qi) {
        if (q.state !== "growing" || q.watered) return;
        if (q.stageAt + Math.round(CROPS[q.crop].stage * (q.fert || 1)) <= now) q.stageAt = now;
        q.watered = true; if (has(s, "steelwateringcan")) q.soak = true; wn++;
      });
      if (!wn) return no(s, "Nothing needs water.");
      for (var wk = 0; wk < wn; wk++) wearKit(s, null, has(s, "steelwateringcan") ? "steelwateringcan" : "wateringcan", now);
      farmXp(s, wn, now);
      return yes(s, now, "You watered " + wn + " plot" + (wn === 1 ? "" : "s") + ".");
    }
    if (!pl) return no(s, "There's no plot like that.");
    var n = (o.plot | 0) + 1;
    switch (o.op) {
      case "rake": {
        if (pl.state !== "weedy") return no(s, "Plot " + n + " has no weeds.");
        if (!has(s, "rake")) return no(s, "You need a rake -- smith one at the anvil.");
        var w = 2 + Math.floor(r * 3);
        give(s, pl.weed, w);
        wearKit(s, null, "rake", now);
        pl.state = "raked";
        farmXp(s, 2, now);
        return yes(s, now, "You raked plot " + n + ": " + w + " × " + ITEMS[pl.weed].name.toLowerCase() + ".");
      }
      case "hoe":
        if (pl.state !== "raked") return no(s, pl.state === "weedy" ? "Rake the weeds first." : "Plot " + n + " is already tilled.");
        if (!has(s, "hoe")) return no(s, "You need a hoe -- smith one at the anvil.");
        pl.state = "tilled";
        wearKit(s, null, "hoe", now);
        farmXp(s, 2, now);
        return yes(s, now, "You tilled plot " + n + ".");
      case "plant": {
        if (pl.state !== "tilled") return no(s, "Till plot " + n + " before planting.");
        var it = ITEMS[o.seed], c = it && CROPS[it.seed];
        if (!c) return no(s, "Pick a seed to plant.");
        if (lv < c.level) return no(s, c.name + " needs Farming level " + c.level + ".");
        if (!has(s, o.seed)) return no(s, "There's no " + it.name.toLowerCase() + " in the bag.");
        take(s, o.seed);
        pl.state = "growing"; pl.crop = it.seed; pl.stage = 0; pl.stageAt = now; pl.watered = false;
        farmXp(s, 5, now);
        return yes(s, now, "You planted " + c.name.toLowerCase() + " in plot " + n + ". Water it to help it grow.");
      }
      case "water":
        if (pl.state !== "growing") return no(s, "Nothing's growing in plot " + n + ".");
        if (pl.watered) return no(s, "Plot " + n + " is already watered.");
        if (!has(s, "wateringcan") && !has(s, "steelwateringcan")) return no(s, "You need a watering can -- smith one at the anvil.");
        // a thirsty plant: its stage starts again from now
        if (pl.stageAt + Math.round(CROPS[pl.crop].stage * (pl.fert || 1)) <= now) pl.stageAt = now;
        pl.watered = true;
        if (has(s, "steelwateringcan")) pl.soak = true;
        wearKit(s, null, has(s, "steelwateringcan") ? "steelwateringcan" : "wateringcan", now);
        farmXp(s, 1, now);
        return yes(s, now, "You watered plot " + n + (pl.soak ? " -- the steel can keeps it watered till harvest." : "."));
      case "fertilise": {
        if (pl.state !== "growing") return no(s, "Fertiliser goes on a growing crop.");
        if (pl.fert) return no(s, "Plot " + n + " is already fertilised.");
        var fi = ITEMS[o.item];
        if (!fi || !fi.fert) return no(s, "That isn't fertiliser.");
        if (!has(s, o.item)) return no(s, "There's no " + fi.name.toLowerCase() + " in the bag.");
        take(s, o.item);
        pl.fert = fi.fert;
        farmXp(s, 3, now);
        return yes(s, now, "You spread " + fi.name.toLowerCase() + " on plot " + n + ": it'll grow " + Math.round((1 - fi.fert) * 100) + "% quicker.");
      }
      case "harvest": {
        if (pl.state !== "ripe") return no(s, "Plot " + n + " isn't ready yet.");
        var c2 = CROPS[pl.crop];
        var got = c2.yield[0] + Math.floor(r * (c2.yield[1] - c2.yield[0] + 1)) + Math.floor(lv / 10);
        give(s, pl.crop, got);
        farmXp(s, c2.xp * got, now);
        pl.state = "weedy"; pl.weed = c2.weed; pl.crop = ""; pl.stage = 0; pl.watered = false; pl.fert = 0; pl.soak = false;
        return yes(s, now, "You harvested " + got + " × " + c2.name.toLowerCase() + " from plot " + n + " (+" + c2.xp * got + " Farming xp).");
      }
    }
    return no(s, "The farm has no job called " + o.op + ".");
  }
  /** The farm: each plot, what it needs next, and what can be planted. */
  function farmView(state, now) {
    var s = state, lv = levelOf(s.player.skills.farming || 0), b = s.bag || {}, inf = s.dev && s.dev.infinite;
    var next = s.farm.plots.length, u = PLOT_UNLOCKS[next];
    return {
      level: lv, tools: { rake: !!(inf || b.rake), hoe: !!(inf || b.hoe), wateringcan: !!(inf || b.wateringcan || b.steelwateringcan), steelcan: !!(inf || b.steelwateringcan) },
      ferts: ["fertiliser", "richfertiliser"].map(function (k) { return { id: k, name: ITEMS[k].name, have: inf ? 999 : b[k] || 0 }; }),
      seeds: CROP_ORDER.map(function (k) { var c = CROPS[k]; return { id: c.seed, crop: k, name: ITEMS[c.seed].name, have: inf ? 999 : b[c.seed] || 0, level: c.level, open: lv >= c.level }; }),
      pots: (s.farm.pots || []).map(function (pt, i) {
        var h = HERBS[pt.herb];
        return { n: i + 1, herb: pt.herb, name: h ? h.name : "", colour: h ? h.colour : "", ready: !!pt.ready,
                 readyIn: h && !pt.ready ? Math.max(0, Math.ceil((pt.readyAt - now) / 1000)) : 0,
                 progress: h ? (pt.ready ? 1 : Math.max(0, Math.min(1, (now - pt.since) / h.time))) : 0 };
      }),
      maxPots: maxPots(s), sill: UPGRADES.windowsill.costs[upgradeLevel(s, "windowsill")] || 0, sillNeeds: itemsText(UPGRADES.windowsill.needs),
      sillHave: inf || Object.keys(UPGRADES.windowsill.needs).every(function (k) { return (b[k] || 0) >= UPGRADES.windowsill.needs[k]; }), potsInBag: inf ? 999 : b.plantpot || 0,
      herbSeeds: HERB_ORDER.map(function (k) { var h = HERBS[k]; return { id: h.seed, herb: k, name: ITEMS[h.seed].name, have: inf ? 999 : b[h.seed] || 0, level: h.level, open: lv >= h.level, minutes: Math.round(h.time / MIN) }; }),
      unlock: u ? { plot: next + 1, level: u.level, soil: u.soil, have: inf ? 999 : b.soil || 0, can: lv >= u.level && (inf || (b.soil || 0) >= u.soil) } : null,
      plots: s.farm.plots.map(function (pl, i) {
        var c = CROPS[pl.crop], len = c ? Math.round(c.stage * (pl.fert || 1)) : 0;
        var left = pl.state === "growing" && pl.watered ? Math.max(0, Math.ceil((pl.stageAt + len - now) / 1000)) : 0;
        return { n: i + 1, state: pl.state, weed: ITEMS[pl.weed] ? ITEMS[pl.weed].name : "", crop: pl.crop, cropName: c ? c.name : "", stage: pl.stage,
                 watered: pl.watered, thirsty: pl.state === "growing" && !pl.watered, stageIn: left, colour: c ? c.colour : "", fert: pl.fert || 0, soak: !!pl.soak,
                 next: pl.state === "weedy" ? "rake" : pl.state === "raked" ? "hoe" : pl.state === "tilled" ? "plant"
                     : pl.state === "growing" ? (pl.watered ? "" : "water") : "harvest" };
      })
    };
  }

