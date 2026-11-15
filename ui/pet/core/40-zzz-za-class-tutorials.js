  // ---- class tutorials (2026-10-17): a class's tutor shows you how it works ----------------------------------------------
  //      Cam: "when choosing a class there should be a seperate tutorial which goes thorugh an explanation how it works. The
  //      tutorial will provide all starting requirements but once over they will say sorry i have to depart now with my pack,
  //      i bid you goodluck with starting your own pack. There parting gift will be 2 eggs." Then: "Now every tutor should
  //      offer a tutorial. The tutorial should provide all basic provisions and how to do everything related to that class.
  //      Inclusive of poison making, weapon crafting, holy water, etc. Also will give some gifts in form of starter kits when
  //      you finish the tutorial. It should be in a wooden crate for now."
  //   - it starts when you take the class (once), or from the tutor's card at the Guild hall (classtut {op: "start", cls});
  //   - it shows in Amunet's window, after hers (tutorialView hands over to classTutView when hers isn't on);
  //   - it opens with an offer (step 0): nothing is lent until you press Next -- taking a class never fills your bag by itself;
  //   - then the tutor lends what you need to start: items to keep, and pets that leave with them (b.loan) at the end;
  //   - a step can be a job (check), a thing to make (make + ws: done for real when the bench is open to you, else the tutor
  //     makes it for you -- "show" -- and says what opens the bench), or just words;
  //   - the end (the last step, skipping, or leaving the class) is the farewell: the loans go, the parting gift and the
  //     class's starter crate come. Gifts come once per class, ever: a lesson run again from the Guild hall teaches again
  //     but gives nothing twice.
  //   s.classTut = { on: {cls, step, base, have, shown}, done: {cls: time}, gifted: {"cls:what": time} }.
  var CLASS_TUTORIALS = CONTENT("CLASS_TUTORIALS");
  // the starter crates: a crate item each, opened like any crate but with what's inside fixed
  Object.keys(CLASS_TUTORIALS).forEach(function (cls) {
    var K = CLASS_TUTORIALS[cls].kit;
    if (cls === "//" || !K) return;
    ITEMS[K.id] = { name: K.name, gem: 3, crate: true, iconAs: K.icon || "woodcrate", about: K.about || "" };
    CRATES[K.id] = { fixed: K.contents };
  });
  function classTutOf(s) { var c = s.classTut; return c && c.on && CLASS_TUTORIALS[c.on.cls] ? c.on : null; }
  function classTutor(cls) { return GUILD.tutors[cls] || {}; }
  function classTutStep(s) { var T = classTutOf(s); return T ? CLASS_TUTORIALS[T.cls].steps[T.step] : null; }
  /** Given once per class, ever? (An old save that finished Tamsin's lesson before this had her loans and eggs.) */
  function tutGiven(s, cls, what) { var g = (s.classTut && s.classTut.gifted) || {}; return !!g[cls + ":" + what] || (what !== "kit" && what.indexOf("step:") !== 0 && !!((s.classTut || {}).done || {})[cls]); }
  function tutGive(s, cls, what, items, now) {
    if (tutGiven(s, cls, what) || !items || !Object.keys(items).length) return false;
    Object.keys(items).forEach(function (k) { give(s, k, items[k], true); });
    s.classTut.gifted = s.classTut.gifted || {};
    s.classTut.gifted[cls + ":" + what] = now;
    return true;
  }
  function haveCount(s, id) {
    var g = (s.player && s.player.gear) || {};
    return ((s.bag || {})[id] || 0) + Object.keys(g).filter(function (k) { return g[k] === id; }).length;
  }
  /** Can you make `item` at `ws` now? "" if so, else why not (the bench isn't open in the story yet, or a skill level). */
  function tutMakeWhy(s, st) {
    var W = WORKSHOPS[st.ws], rec = W && W.recipes.filter(function (r) { return r.make === st.make; })[0];
    if (!rec) return "nobody makes that";
    if (W.skill && levelOf(s.player.skills[W.skill] || 0) < rec.level) return "it needs " + SKILLS[W.skill].name + " level " + rec.level;
    var lk = roomLock(s, st.ws, rec.level || 1);
    return lk ? lk.charAt(0).toLowerCase() + lk.slice(1) : "";
  }
  /** Is a class tutorial step's job done? */
  function classTutMet(s, st, now) {
    if (!st) return true;
    var T = classTutOf(s), b = (T && T.base) || {}, pl = s.player, g = pl.gear || {}, cb = pl.combat || {};
    if (st.make) return !!(T.shown || {})[st.id] || haveCount(s, st.make) > ((T.have || {})[st.make] || 0);
    if (!st.check) return true;
    var c = st.check.split(":"), w = g.weapon && ITEMS[g.weapon] && ITEMS[g.weapon].gear;
    switch (c[0]) {
      case "crook": return !!crookOf(s, pl);
      case "train": return beastsOf(s).some(function (x) { return !!x.train; });
      case "fed": return beastsOf(s).some(function (x) { return x.train && (x.fedUntil || 0) > now; });
      case "pack": return packBeasts(s, pl).length > 0;
      case "hunt": return tutorialCounts(s).kills >= (b.kills || 0) + (+c[1] || 3);
      case "wear": return Object.keys(g).some(function (k) { return g[k] === c[1]; });
      case "ranged": return !!w && w.style === "ranged" && !!g.ammo;
      case "magic": return !!w && w.style === "magic";
      case "dual": return !!w && !!w.dagger && !!g.offhand && !!(ITEMS[g.offhand].gear || {}).dagger;
      case "shield": return !!g.offhand && !!(ITEMS[g.offhand].gear || {}).shield;
      case "coat": return !!pl.coat;
      case "bless": return !!pl.bless;
      case "brew": return Object.keys(pl.brews || {}).some(function (k) { return !!pl.brews[k]; });
      case "special": return !!cb.special;
      case "loadout": return (pl.loadout || []).length > 0;
      case "tools": return !!(cb.trap || cb.net);
      case "made": return haveCount(s, c[1]) > ((T.have || {})[c[1]] || 0);
      case "skill": return (pl.skills[c[1]] || 0) > (b["xp:" + c[1]] || 0);
    }
    return true;
  }
  function classTutEnter(s, i, now) {
    var T = classTutOf(s), C = CLASS_TUTORIALS[T.cls], st = C.steps[i], t = classTutor(T.cls);
    T.step = i;
    T.base = tutorialCounts(s);
    Object.keys(s.player.skills).forEach(function (k) { T.base["xp:" + k] = s.player.skills[k] || 0; });
    if (i === 1) {                                                       // what the tutor lends you to start (after the offer: you said yes)
      var lentItems = tutGive(s, T.cls, "items", C.items, now);
      (C.loans || []).forEach(function (L, n) {
        var id = "loan-" + T.cls + "-" + n;
        if (beastById(s, id)) return;
        beastsOf(s).push({ id: id, name: L.name, species: L.species, colour: L.colour, born: now, hatchAt: now, joined: now, xp: XP[L.level || 1],
                           stat: {}, train: "", trainAt: now, fedUntil: 0, restUntil: 0, wins: 0, faints: 0, from: "loan", loan: T.cls });
      });
      var bits = [];
      if ((C.loans || []).length) bits.push("lent you " + C.loans.map(function (L) { return L.name; }).join(" and ") + " for your Beast Pen");
      if (lentItems) bits.push("gave you " + itemsText(C.items));
      if (bits.length) note(s, now, t.standIn + " " + bits.join(", and ") + ".");
    }
    if (!st) return;
    if (st.gift && tutGive(s, T.cls, "step:" + st.id, st.gift, now)) note(s, now, t.standIn + ": " + itemsText(st.gift) + ".");
    if (st.check && st.check.indexOf("made:") === 0) { T.have = T.have || {}; T.have[st.check.slice(5)] = haveCount(s, st.check.slice(5)); }
    if (st.make) {
      T.have = T.have || {}; T.have[st.make] = haveCount(s, st.make);
      if (tutMakeWhy(s, st)) {                                           // the bench isn't open to you yet: the tutor makes them
        T.shown = T.shown || {}; T.shown[st.id] = true;
        if (st.show && tutGive(s, T.cls, "show:" + st.id, st.show, now)) note(s, now, t.standIn + " made you " + itemsText(st.show) + ".");
      }
    }
  }
  /** The farewell: the lent pets leave with the tutor, the parting gift and the starter crate are yours (once), done. */
  function classTutEnd(s, now) {
    var T = classTutOf(s);
    if (!T) return "";
    var C = CLASS_TUTORIALS[T.cls], t = classTutor(T.cls), pl = s.player;
    var lent = beastsOf(s).filter(function (x) { return x.loan === T.cls; }), gone = lent.map(function (x) { return x.id; });
    s.beasts = beastsOf(s).filter(function (x) { return gone.indexOf(x.id) < 0; });
    if (pl.combat && pl.combat.pack) pl.combat.pack = pl.combat.pack.filter(function (id) { return gone.indexOf(id) < 0; });
    var got = {};
    if (tutGive(s, T.cls, "gifts", C.gifts, now)) Object.keys(C.gifts).forEach(function (k) { got[k] = C.gifts[k]; });
    if (C.kit && tutGive(s, T.cls, "kit", (function () { var o = {}; o[C.kit.id] = 1; return o; })(), now)) got[C.kit.id] = 1;
    s.classTut.done = s.classTut.done || {};
    s.classTut.done[T.cls] = now;
    s.classTut.on = null;
    var msg = t.standIn + " set off" + (lent.length ? " with " + lent.map(function (x) { return x.name; }).join(" and ") : "") +
              (Object.keys(got).length ? ". A parting gift: " + itemsText(got) : "") + ". " + (C.goodbye || "Good luck!");
    note(s, now, msg);
    return msg;
  }
  /** Start a class's tutorial: when you take the class (class act), or from the tutor at the Guild hall. */
  function classTutStart(s, cls, now) {
    if (!CLASS_TUTORIALS[cls]) return false;
    s.classTut = s.classTut || { on: null, done: {} };
    if (s.classTut.on) return false;
    s.classTut.on = { cls: cls, step: 0, base: {}, have: {}, shown: {} };
    classTutEnter(s, 0, now);
    return true;
  }
  /** For tutorialView: the class tutorial in the same window, with its own act ("classtut"). */
  function classTutView(s, now) {
    var T = classTutOf(s);
    if (!T) return null;
    var C = CLASS_TUTORIALS[T.cls], st = C.steps[T.step], t = classTutor(T.cls), say = st.say.slice(), goal = st.goal || "", point = st.point || [], go = st.go || "";
    if (st.make) {
      var W = WORKSHOPS[st.ws], why = tutMakeWhy(s, st);
      if ((T.shown || {})[st.id]) {                                     // shown, not made: what opens it, and where it'll be
        say.push(st.later || ("You can't make " + aOr(ITEMS[st.make].name.toLowerCase()) + " yourself yet -- " + (why || "not yet") + ". I've made you some; when it opens, it's at the " + W.name.toLowerCase() + " in your Workshop."));
        if (why) say.push("(" + why.charAt(0).toUpperCase() + why.slice(1) + ".)");
        goal = ""; point = []; go = "";
      } else {
        goal = goal || "Make " + aOr(ITEMS[st.make].name.toLowerCase()) + " at the " + W.name.toLowerCase();
        go = go || "shop:" + st.ws;
        point = point.length ? point : ['.pp-make[data-ws="' + st.ws + '"][data-make="' + st.make + '"]', '.pp-spot[data-key="' + st.ws + '"]', '.pp-spot[data-key="pet:workshop"]', '#np-pathbar [data-go="pet:estate"]'];
      }
    }
    var gifts = {};
    if (st.finale) {
      if (!tutGiven(s, T.cls, "gifts")) Object.keys(C.gifts || {}).forEach(function (k) { gifts[k] = C.gifts[k]; });
      if (C.kit && !tutGiven(s, T.cls, "kit")) gifts[C.kit.id] = 1;
    }
    return { on: true, act: "classtut", cls: T.cls, step: T.step, of: C.steps.length, id: st.id, say: say, goal: goal, go: go,
             name: false, body: false, chosen: "", point: point, met: classTutMet(s, st, now), finale: !!st.finale,
             guide: { name: t.standIn, title: C.title, look: t.look, gear: {} }, skills: null,
             gifts: st.finale ? Object.keys(gifts).map(function (k) { return { id: k, name: ITEMS[k].name, n: gifts[k] }; }) : null };
  }
  /** classtut {op: start {cls} | next | skipstep | skip | finish} */
  function classTutAct(s, action, opts, now) {
    if (action !== "classtut") return null;
    var op = opts.op, T = classTutOf(s);
    if (op === "start") {
      if (!CLASS_TUTORIALS[opts.cls]) return no(s, "There's no lesson for that class.");
      if (s.player.cls !== opts.cls) return no(s, "Become " + (/^[AEIOU]/.test(CLASSES[opts.cls].name) ? "an " : "a ") + CLASSES[opts.cls].name + " first.");
      if (T) return no(s, classTutor(T.cls).standIn + " is already showing you around.");
      classTutStart(s, opts.cls, now);
      return yes(s, now, classTutor(opts.cls).standIn + " will show you how it works.");
    }
    if (!T) return no(s, "There's no lesson going on.");
    var st = CLASS_TUTORIALS[T.cls].steps[T.step];
    if (op === "skip" || op === "finish") {
      if (op === "finish" && !st.finale) return no(s, "Not yet.");
      var pl = s.player, lentOut = pl.battle && pl.battle.pack && pl.battle.pack.pets.some(function (p) { return /^loan-/.test(p.id); });
      if (lentOut && pl.battle.kind !== "hunt") return no(s, "Finish your fight first -- " + classTutor(T.cls).standIn + " will wait.");
      var home = pl.job && pl.job.hunt ? (lentOut ? "You called the pack home from the hunt. " : classTutor(T.cls).standIn + " calls you back from the hunt. ") : "";   // hunts run fight after fight -- and nobody runs for you now (PT30): the tutor brings you home
      if (home) endTrip(s, pl, now, "stop");
      return yes(s, now, home + classTutEnd(s, now));
    }
    if (op === "next" || op === "skipstep") {
      if (op === "next" && !classTutMet(s, st, now)) return no(s, "Not yet: " + (classTutView(s, now).goal || "") + ".");
      if (/^hunt/.test(String(st.check || "")) && s.player.job && s.player.job.hunt && !(s.beasts || []).some(function (b) { return /^loan-/.test(b.id); })) endTrip(s, s.player, now, "stop");   // (a lent pack hunts on: its farewell calls it home)   // the hunting step done: the tutor calls you back (PT30 -- a new player would fight on to a fall)
      if (st.finale) return no(s, "Say goodbye first.");
      classTutEnter(s, T.step + 1, now);
      return yes(s, now, "");
    }
    return no(s, "Nothing like that.");
  }
