  // ---- the skill registry (2026-10-11, audit FUT-1 -- Cam: "yes please do them and the skill registry"). Every skill
  //      declares itself here, once: the rules' lists (SKILL_ORDER, GATHERING), the skills table's names, the economy's
  //      speeds, and the screens' pages, groups, icons and benches are all read from it. Adding a skill is now: an entry
  //      here, its content (spots, recipes) and its art. The order is the Player page's order.
  //   id, name, verb  -- what it's called and what you're doing ("You went foraging")
  //   group           -- gathering | making | combat (the Player page's columns)
  //   trips: true     -- a gathering skill you go on trips for (spots on the map); runs through the pace rule
  //   coins           -- (trips) how much an hour at its spots should earn, against the others (the economy rule)
  //   icon            -- its picture on the Player page; page / pageIcon / accent / hint -- its page in the shell
  //   bench           -- (making) the workshop that trains it, whose window is its page
  var SKILL_REG = CONTENT("SKILL_REG");
  var SKILL_BY = {};
  SKILL_REG.forEach(function (k) {
    SKILL_BY[k.id] = k;
    if (!k.page) k.page = k.bench ? "shop:" + k.bench : k.group === "combat" ? "pet:hunt" : "pet:" + k.id;
  });
  /** A skill's own page in the shell: the skills table's gathering pages and benches, from the registry. */
  function skillPages() {
    var out = {};
    SKILL_REG.forEach(function (k) {
      if (k.group === "combat" || k.page === "pet:spellbook" || k.page === "pet:hunt") return;
      out[k.page] = { name: k.name, accent: k.accent, icon: k.pageIcon || k.icon, skill: k.id, hint: k.hint || "" };
    });
    return out;
  }
