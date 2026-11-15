  // ---- Battle Re-work Part 9: the Guild hall -- tutors, switching class, techniques, class benches and books (2026-10-16) --
  //      Cam (Q2): "An explanation of the class, some smug talk as to why it is the best class. A natural banter between
  //      them. Also the guild hall should have specific craft benches ... They only show class specific craftables ... The
  //      guild hall can replace the player estate section of the map." V1 (carried 10-1): a book per class, made from the
  //      game's own data, bought here and read from the bag anywhere. C1: an existing save gets one free switch; in a
  //      sandbox switching is free and instant.
  //   - your FIRST class is still a free choice (Q2.3); after it, a switch is made here (act "class" with guild: true),
  //     for GUILD.tutors[c].switch -- half to go back to a class you've played (Q7);
  //   - TECHNIQUES: learned for good by putting a point in their node; two slots; off your class they work at 60%;
  //   - FEATS (pl.feats): what the tutors' quests count -- fury filled, element effects landed, blows dodged and blocked.
  var GUILD = CONTENT("GUILD");
  var TECHNIQUES = CONTENT("TECHNIQUES");
  var CLASS_BOOKS = CONTENT("CLASS_BOOKS");
  Object.keys(CLASS_BOOKS).forEach(function (k) { ITEMS[k] = CLASS_BOOKS[k]; });
  var GUILD_CLASSES = Object.keys(GUILD.tutors).filter(function (k) { return k !== "//"; });

  function feat(pl, k, n) { pl.feats = pl.feats || {}; pl.feats[k] = (pl.feats[k] || 0) + (n || 1); }
  /** What switching to this class costs you now: {coins, items, free: why ("" if not)}. */
  function switchPrice(s, cls) {
    var pl = s.player, t = GUILD.tutors[cls];
    if (!t) return null;
    if (s.dev && s.dev.on) return { coins: 0, items: {}, free: "the sandbox" };
    if (pl.freeSwitch > 0) return { coins: 0, items: {}, free: "your free switch" };
    var back = ((pl.classes || {})[cls] || {}).xp > 0 ? GUILD.back : 1, items = {};
    Object.keys(t.switch.items).forEach(function (k) { items[k] = Math.max(1, Math.round(t.switch.items[k] * back)); });
    return { coins: Math.round(t.switch.coins * back), items: items, free: "", back: back < 1 };
  }
  /** Called by the class action: a first class is free; a switch is made at the Guild hall and paid for. Returns
   *  {error} or {paid: "what it cost"}. */
  function switchClass(s, cls, opts) {
    var pl = s.player;
    if (!pl.cls) return { paid: "" };                                      // your first class: a free choice
    if (s.dev && s.dev.on) return { paid: "" };                            // the sandbox: free and instant (C1)
    if (!opts.guild) return { error: "To change class, see the tutors at the Guild hall in the Village." };
    if ((pl.island || "") !== "") return { error: "The Guild hall is on the main island." };
    var p = switchPrice(s, cls);
    if (p.free) { pl.freeSwitch--; return { paid: " (" + p.free + ")" }; }
    if ((s.coins || 0) < p.coins) return { error: "Becoming " + aOr(CLASSES[cls].name) + " costs " + p.coins.toLocaleString() + " coins." };
    var short = Object.keys(p.items).filter(function (k) { return !has(s, k, p.items[k]); });
    if (short.length) return { error: "You need " + itemsText(p.items) + " -- short of " + short.map(function (k) { return ITEMS[k].name.toLowerCase(); }).join(", ") + "." };
    s.coins -= p.coins;
    Object.keys(p.items).forEach(function (k) { take(s, k, p.items[k]); });
    return { paid: " (" + p.coins.toLocaleString() + " coins and " + itemsText(p.items) + ")" };
  }
  /** Learned techniques: ever had a point in their node (kept for good). */
  function techLearned(pl, id) {
    var T = TECHNIQUES.list[id];
    return !!T && (!!(pl.techLearned || {})[id] || ((((pl.classes || {})[T.cls] || {}).talents || {})[T.node] || 0) > 0);
  }
  function techSlots(s) { return TECHNIQUES.slots + TECHNIQUES.ngSlots.filter(function (n) { return (s.ngPlus || 0) >= n; }).length; }
  /** Your slotted techniques from other classes, at offClass strength, added to your talents' sum (talentSum calls it). */
  function addTechniques(pl, out) {
    (pl.techs || []).forEach(function (id) {
      var T = TECHNIQUES.list[id];
      if (!T || T.cls === pl.cls || !techLearned(pl, id)) return;
      Object.keys(T.fx).forEach(function (k) { out[k] = (out[k] || 0) + T.fx[k] * TECHNIQUES.offClass; });
    });
  }
  /** Mark techniques learned when a point goes in their node (talentAct calls it). */
  function learnTechniques(pl, node) {
    Object.keys(TECHNIQUES.list).forEach(function (id) { if (TECHNIQUES.list[id].node === node) { pl.techLearned = pl.techLearned || {}; pl.techLearned[id] = true; } });
  }
  /** The class an item belongs to, for the Guild hall's benches ("" for anyone's). */
  function itemClass(id) {
    var it = ITEMS[id];
    if (!it) return "";
    if (it.gear && it.gear.cls) return it.gear.cls;
    if (it.hunterTool) return it.hunterTool.kind === "throw" ? "thief" : "hunter";
    if (it.coat) return "thief";
    if (it.bless) return "paladin";
    if (it.gear && it.gear.style === "magic") return "arcane";
    return "";
  }
  /** A quest's progress against your feats (the tutors' quests). */
  questProgressHooks.push(function (s, n, out) {
    if (n.feat) out.push({ text: { furyFull: "Fury filled to the top", elements: "Element effects landed", dodged: "Blows dodged", blocked: "Blows blocked", packwins: "Fights won with your pack" }[n.feat[0]] || n.feat[0],
                           have: Math.min(n.feat[1], ((s.player || {}).feats || {})[n.feat[0]] || 0), need: n.feat[1] });
  });
  function guildQuest(cls) { return cls === "tour" ? null : GUILD.tutors[cls] && GUILD.tutors[cls].quest; }
  /** The Guild hall: the Guildmaster's tour, every tutor (met, your class, the price, the quest), books and benches. */
  function guildView(s, now) {
    var pl = s.player, met = pl.guildMet || {}, day = Math.floor((now || 0) / DAY), done = s.quests || {};
    var benches = villageView(s, now).filter(function (w) { return !w.npc && w.recipes; });
    return {
      guildmaster: GUILD.guildmaster, tourDone: !!done[GUILD.guildmaster.tour.id], met: GUILD_CLASSES.filter(function (c) { return met[c]; }).length, of: GUILD_CLASSES.length,
      freeSwitch: pl.freeSwitch || 0, sandbox: !!(s.dev && s.dev.on), cls: pl.cls || "", island: pl.island || "",
      tutors: GUILD_CLASSES.map(function (c, i) {
        var t = GUILD.tutors[c], q = t.quest, prog = questProgress(s, q);
        return { cls: c, name: CLASSES[c].name, standIn: t.standIn, title: t.title, real: t.real, realPic: t.realPic || "", look: t.look, intro: t.intro, smug: t.smug,
                 banter: t.banter[(day + i) % t.banter.length], met: !!met[c], you: pl.cls === c, level: classLevel(pl, c), played: ((pl.classes || {})[c] || {}).xp > 0,
                 price: switchPrice(s, c),
                 quest: { id: q.id, name: q.name, text: q.text, needs: prog, done: !!done[q.id], forYou: pl.cls === c, can: pl.cls === c && !done[q.id] && prog.every(function (x) { return x.ok; }) } };
      }),
      books: Object.keys(CLASS_BOOKS).map(function (k) { return { id: k, name: ITEMS[k].name, cls: CLASS_BOOKS[k].book, price: CLASS_BOOKS[k].price, have: has(s, k) }; }),
      benches: GUILD_CLASSES.map(function (c) {
        var out = [];
        benches.forEach(function (w) { w.recipes.forEach(function (r) { if (itemClass(r.make) === c) out.push({ workshop: w.id, bench: w.name, i: r.i, make: r.make, name: r.name, level: r.level, open: r.open, can: r.can, needs: r.needs, fee: r.fee, n: r.n }); }); });
        return { cls: c, name: CLASSES[c].name, recipes: out };
      }) };
  }
  /** A class's book, made from the game's own data (V1: it can't drift from the game). */
  function classBookView(cls) {
    var C = CLASSES[cls], T = GUILD.tutors[cls], tree = TALENTS[cls];
    if (!C || !T) return null;
    var LBL = CONTENT("TALENT_LABELS");
    var fxText = function (fx) { return Object.keys(fx).map(function (k) { var v = fx[k], nm = LBL[k] || k;
      return v === 1 && /Use$|^ambush$|^counter$|^saveOnce$|^layFree$/.test(k) ? nm : (v < 1 && v > 0 ? "+" + Math.round(v * 1000) / 10 + "% " : "+" + v + " ") + nm; }).join(", "); };
    return { cls: cls, name: C.name, about: C.about, tutor: T.real, standIn: T.standIn, intro: T.intro, smug: T.smug,
             resist: C.resist, weak: C.weak, styles: C.styles || [C.style],
             specials: Object.keys(C.specials).map(function (k) { var sp = C.specials[k]; return { name: sp.name, cost: sp.cost, about: sp.about, style: sp.style || "", minLevel: sp.minLevel || 0 }; }),
             meter: cls === "berserker" ? "fury" : cls === "paladin" ? "devotion" : "special bar",
             branches: tree.branches.map(function (b) { return { name: b.name, about: b.about, nodes: b.nodes.map(function (n) {
               return { name: n.name, about: n.about, ranks: n.ranks, tier: n.tier, gate: TALENT_RULES.gates[n.tier] || 0, keystone: !!n.keystone, choice: n.choice ? b.nodes.filter(function (m) { return m.choice === n.choice && m.id !== n.id; }).map(function (m) { return m.name; })[0] : "",
                        perRank: fxText(n.fx), parent: n.parent ? b.nodes.filter(function (m) { return m.id === n.parent; }).map(function (m) { return m.name; })[0] || "" : "" }; }) }; }),
             techniques: Object.keys(TECHNIQUES.list).filter(function (id) { return TECHNIQUES.list[id].cls === cls; }).map(function (id) { var t = TECHNIQUES.list[id];
               var node = null; tree.branches.forEach(function (b) { b.nodes.forEach(function (n) { if (n.id === t.node) node = n.name; }); });
               return { name: t.name, about: t.about, node: node }; }),
             builds: (GUILD.builds[cls] || []).map(function (b) { return { name: b[0], text: b[1] }; }),
             gear: Object.keys(ITEMS).filter(function (k) { return itemClass(k) === cls; }).map(function (k) { return ITEMS[k].name; }),
             rules: { pointsEvery: TALENT_RULES.pointsEvery, freeRespecTo: TALENT_RULES.freeRespecTo, offClass: TECHNIQUES.offClass } };
  }
  /** guildmet {cls} -- you've talked to a tutor · guildquest {cls | "tour"} -- hand in a quest · guildbuy {item} -- a book ·
   *  technique {id, on} -- a technique in (or out of) a slot. (Switching: the class action with guild: true.) */
  function guildAct(s, action, opts, now) {
    var pl = s.player;
    if (action === "guildmet") {
      if (!GUILD.tutors[opts.cls]) return no(s, "There's nobody like that here.");
      pl.guildMet = pl.guildMet || {}; pl.guildMet[opts.cls] = true;
      return { ok: true, msg: "", state: s };
    }
    if (action === "guildquest") {
      s.quests = s.quests || {};
      var tour = opts.cls === "tour", q = tour ? GUILD.guildmaster.tour : guildQuest(opts.cls);
      if (!q) return no(s, "There's no quest like that.");
      if (s.quests[q.id]) return no(s, "Already done.");
      if (tour) { var left = GUILD_CLASSES.filter(function (c) { return !(pl.guildMet || {})[c]; }); if (left.length) return no(s, "Talk to every tutor first -- " + left.map(function (c) { return GUILD.tutors[c].standIn; }).join(", ") + " still to meet."); }
      else {
        if (pl.cls !== opts.cls) return no(s, GUILD.tutors[opts.cls].standIn + " teaches " + clsPlural(opts.cls) + ".");
        var short = questProgress(s, q).filter(function (x) { return !x.ok; });
        if (short.length) return no(s, "Not yet: " + short.map(function (x) { return x.text.toLowerCase() + " " + x.have + "/" + x.need; }).join(", ") + ".");
      }
      s.quests[q.id] = now;
      var rw = q.reward;
      if (rw.coins) s.coins = (s.coins || 0) + rw.coins;
      Object.keys(rw.items || {}).forEach(function (k) { give(s, k, rw.items[k], true); });
      Object.keys(rw.xp || {}).forEach(function (k) { addXp(s, pl, k, rw.xp[k], now); });
      return yes(s, now, "\"Thank you!\" Quest done -- " + q.name + " (" + rewardText(rw) + ").");
    }
    if (action === "guildbuy") {
      var bk = CLASS_BOOKS[opts.item];
      if (!bk) return no(s, "There's no book like that.");
      if ((pl.island || "") !== "") return no(s, "The Guild hall is on the main island.");
      if ((s.coins || 0) < bk.price && !(s.dev && s.dev.infinite)) return no(s, "It's " + bk.price + " coins.");
      if (!(s.dev && s.dev.infinite)) s.coins -= bk.price;
      give(s, opts.item, 1, true);
      return yes(s, now, "You bought " + ITEMS[opts.item].name + " -- read it from your bag, anywhere.");
    }
    if (action === "technique") {
      var T = TECHNIQUES.list[opts.id];
      if (!T) return no(s, "There's no technique like that.");
      pl.techs = (pl.techs || []).filter(function (x) { return TECHNIQUES.list[x]; });
      if (!opts.on) { pl.techs = pl.techs.filter(function (x) { return x !== opts.id; }); return yes(s, now, T.name + " is out of its slot."); }
      if (!techLearned(pl, opts.id)) return no(s, T.name + " is learned in the " + CLASSES[T.cls].name + "'s tree.");
      if (T.cls === pl.cls) return no(s, "As " + aOr(CLASSES[T.cls].name) + " you have it already, at full strength.");
      if (pl.techs.indexOf(opts.id) >= 0) return no(s, "It's in a slot already.");
      if (pl.techs.length >= techSlots(s)) return no(s, "Both slots are full -- take one out first.");
      pl.techs.push(opts.id);
      return yes(s, now, T.name + " is in a slot: " + T.about.charAt(0).toLowerCase() + T.about.slice(1, -1) + " (at " + Math.round(TECHNIQUES.offClass * 100) + "%).");
    }
    return null;
  }
  /** The Techniques part of the Talents tab: every technique, learned or not, and your slots. */
  function techniquesView(s) {
    var pl = s.player;
    return { slots: techSlots(s), offClass: TECHNIQUES.offClass, on: (pl.techs || []).slice(),
             list: Object.keys(TECHNIQUES.list).map(function (id) { var t = TECHNIQUES.list[id];
               return { id: id, name: t.name, about: t.about, cls: t.cls, clsName: CLASSES[t.cls].name, learned: techLearned(pl, id), own: t.cls === pl.cls, on: (pl.techs || []).indexOf(id) >= 0 }; }) };
  }
