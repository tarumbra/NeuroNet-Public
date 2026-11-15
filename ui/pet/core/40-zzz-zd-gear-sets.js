  // ---- gear sets (Modernize/Reduce Nav, 2026-10-18 -- the team's addition to Cam's N9: "a quick way to adjust a gear loadout on
  //      the fly"): save what you're wearing as one of three sets, and put a whole set on in one click from the Kit's Gear tab.
  //      A set is what each slot held (and the off hand); putting it on wears each of them you still have, through the usual equip.
  var GEAR_SETS = 3;
  /** gearset {op: "save" | "load" | "clear", n, name} */
  function gearSetAct(s, action, opts, now) {
    if (action !== "gearset") return null;
    var pl = s.player, n = opts.n | 0;
    if (!(n >= 0 && n < GEAR_SETS)) return no(s, "There's no gear set like that.");
    pl.gearSets = pl.gearSets || [];
    if (opts.op === "save") {
      var g = {}; Object.keys(pl.gear || {}).forEach(function (k) { if (pl.gear[k]) g[k] = pl.gear[k]; });
      if (!Object.keys(g).length) return no(s, "You're not wearing anything to save.");
      pl.gearSets[n] = { name: cleanName(opts.name, 16) || (pl.gearSets[n] && pl.gearSets[n].name) || "Set " + (n + 1), gear: g };
      return yes(s, now, "Saved what you're wearing as “" + pl.gearSets[n].name + "”.");
    }
    if (opts.op === "clear") { pl.gearSets[n] = null; return yes(s, now, "Gear set " + (n + 1) + " is empty now."); }
    var set = pl.gearSets[n];
    if (!set) return no(s, "That gear set is empty -- save what you're wearing first.");
    if (pl.battle) return no(s, "Not in the middle of a fight.");
    var cur = s, put = [], miss = [];
    var order = Object.keys(set.gear).sort(function (a, b) { return (a === "weapon" ? 0 : a === "offhand" ? 1 : 2) - (b === "weapon" ? 0 : b === "offhand" ? 1 : 2); });   // the weapon before the off hand
    order.forEach(function (slot) {
      var id = set.gear[slot];
      if (!ITEMS[id]) return;
      if ((cur.player.gear || {})[slot] === id) return;
      var r = slot === "offhand" ? act(cur, "offhand", { item: id }, now) : act(cur, "equip", { item: id }, now);
      if (r.ok) { cur = r.state; put.push(ITEMS[id].name.toLowerCase()); } else miss.push(ITEMS[id].name.toLowerCase());
    });
    if (!put.length && !miss.length) return no(s, "You're already wearing “" + set.name + "”.");
    var msg = "You put on “" + set.name + "”" + (put.length ? ": " + put.join(", ") : "") + "." + (miss.length ? " Couldn't put on " + miss.join(", ") + "." : "");
    if (!put.length) return no(s, msg);
    note(cur, now, msg);
    return { ok: true, msg: msg, state: cur };
  }
  function gearSetsView(s) {
    var sets = ((s && s.player) || {}).gearSets || [];
    return Array.from({ length: GEAR_SETS }, function (_, i) { var x = sets[i];
      return x ? { n: i, name: x.name, items: Object.keys(x.gear).map(function (k) { return { slot: k, id: x.gear[k], have: has(s, x.gear[k]) || ((s.player.gear || {})[k] === x.gear[k]) }; }),
                   on: Object.keys(x.gear).every(function (k) { return (s.player.gear || {})[k] === x.gear[k]; }) } : { n: i, empty: true }; });
  }
