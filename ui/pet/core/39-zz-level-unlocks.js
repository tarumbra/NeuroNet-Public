  // ==== what a skill level opens (2026-10-10, Cam: "when leveling a skill and the pop up comes up have the unlocks as well"):
  //      the gathering spots, recipes, tools, gear, regions, crops and spells that need exactly this level -- for the level-up
  //      celebration. [{ icon, text }], most useful first. ---------------------------------------------------------------
  // (2026-10-20, Cam: "when leveling a combat skills have a pop up arise with relevent unlocks") -- s (optional): with a save, a
  //  combat skill also lists the weapons, armour and ammo that need it (WEAR, MAGIC_WEAR: most gear keeps its levels there),
  //  your own classes' gear included, and the hunting grounds the new combat level opens
  var COMBAT_UNLOCK_SKILLS = { attack: 1, ranged: 1, magic: 1, defence: 1, hitpoints: 1 };
  function levelUnlocks(skill, level, s, guide) {                      // guide: the skill's whole list (no "your new combat level" grounds)
    var out = [], seen = {};
    var add = function (icon, text) { if (!seen[text]) { seen[text] = 1; out.push({ icon: icon, text: text }); } };
    ((SKILLS[skill] || {}).spots || []).forEach(function (sp) {
      if (sp.level === level && !sp.essence && !sp.secret) add(sp.loot[0][0], "Gather at the " + sp.name + (REGIONS[sp.area] ? " (" + REGIONS[sp.area].name + ")" : ""));
    });
    Object.keys(WORKSHOPS).forEach(function (w) {
      var ws = WORKSHOPS[w];
      if (ws.npc || ws.skill !== skill) return;
      (ws.recipes || []).forEach(function (r) {
        if ((r.level || 1) === level && ITEMS[r.make]) add(r.make, (skill === "cooking" ? "Cook " + ITEMS[r.make].name.toLowerCase() : "Make " + aOr(ITEMS[r.make].name)) + " at the " + ws.name.toLowerCase());
      });
    });
    Object.keys(ITEMS).forEach(function (id) {
      var it = ITEMS[id];
      if (it.tool && it.tool.skill === skill && it.tool.level === level) add(id, "Use the " + it.name.toLowerCase());
      if (it.gear && it.gear.req && it.gear.req[skill] === level && !it.gear.cls) add(id, "Wear the " + it.name.toLowerCase());
    });
    Object.keys(REGIONS).forEach(function (r) {
      var n = REGIONS[r].needs;
      if (n && n.skills && n.skills[skill] === level) add(n.item || "obj_map", "The way into the " + REGIONS[r].name + (n.item ? " (with " + aOr(ITEMS[n.item].name) + ")" : ""));
    });
    if (skill === "husbandry") ranchUnlocks(level).forEach(function (u) { add(u.icon, u.text); });     // the Farm (2026-10-12)
    if (skill === "farming") Object.keys(CROPS).forEach(function (k) { if (CROPS[k].level === level) add(CROPS[k].seed, "Grow " + CROPS[k].plural); });
    if (skill === "magic") Object.keys(SPELLS).forEach(function (k) { if (SPELLS[k].level === level) add("tomearcanist", "Cast " + SPELLS[k].name.toLowerCase()); });
    if (COMBAT_UNLOCK_SKILLS[skill]) {
      var pl = s && s.player;
      [WEAR, MAGIC_WEAR].forEach(function (tab) {
        Object.keys(tab || {}).forEach(function (id) {
          var it = ITEMS[id], g = it && it.gear;
          if (!g || g.who !== "player" || tab[id][skill] !== level) return;
          if (g.cls && pl && !canUseClass(pl, g.cls)) return;                                    // another class's: not for you
          add(id, (g.slot === "weapon" ? "Wield the " : g.slot === "ammo" ? "Shoot " : "Wear the ") + it.name.toLowerCase() + (g.slot === "ammo" ? "s" : ""));
        });
      });
      if (pl && !guide) {
        var sk = copy(pl.skills || {}); sk[skill] = XP[Math.max(1, level - 1)];
        var was = combatLevel({ skills: sk }), cl = combatLevel(pl);
        Object.keys(HUNTS).forEach(function (h) {
          var H = HUNTS[h];
          if (H.level > was && H.level <= cl && !H.mage && h !== "magetower") add("obj_map", "Combat level " + H.level + ": hunt in the " + H.name);
        });
      }
    }
    return out;
  }
