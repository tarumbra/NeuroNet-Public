  // ---- the fight from the bag (N22, the Bag Overhaul, 2026-10-20) ----------------------------------------------------------
  //      Cam: "Should be able to change equipment mid fight from the bag, and it will be applied straight away, same as potions
  //      and food from the bag as well. Also traps should have the ability to be assigned to a shortcut as well and not hidden
  //      in a menu button anymore. I am thinking of removing the buttons and having all the actions occur from the bag."
  //   - GEAR MID-FIGHT: wearing, taking off, the off hand, a gear set or a draught, in a fight, remakes you there and then
  //     (refreshFighter) and costs your next attack -- as eating from the bag does. A Beast Master's pack fights on as it was.
  //   - QUICK SLOTS hold food, draughts, traps, nets and throwing knives: a trap on a slot is laid on your next turn.
  var FIGHT_GEAR_ACTS = { equip: 1, unequip: 1, offhand: 1, drink: 1 };
  /** After an action: if it changed what you fight with, mid-fight, the fight sees it now. */
  function fightGearChanged(res, action, opts, now) {
    if (!res || !res.ok || !res.state || !res.state.player) return res;
    var s = res.state, pl = s.player, b = pl.battle, it = ITEMS[opts.item];
    var counts = FIGHT_GEAR_ACTS[action] || (action === "gearset" && opts.op === "load") || res.fightGear;
    if (!b || b.pack || !counts) return res;
    if ((action === "equip" || action === "unequip") && it && (it.tool || ((it.gear || {}).who === "pet"))) return res;   // a gathering tool, a pet's things
    refreshFighter(s, pl, b, now, true);
    b.skip = true; b.skipWhy = action === "drink" || res.fightGear === "drink" ? "drink" : "gear";
    var msg = String(res.msg || "").replace(" (from your next trip)", "") + " It costs your next attack.";
    if (b.manual) { var mr = manualRound(s, b, now); if (mr && mr.ok) mr.msg = msg + (mr.msg ? " " + mr.msg : ""); return mr; }
    res.msg = msg;
    return res;
  }
  /** What can go on a quick slot: food (heals), a draught, a trap, a net or a throwing knife. */
  function quickFits(id) { var it = ITEMS[id]; return !!(it && (it.heal || it.brew || it.hunterTool)); }
