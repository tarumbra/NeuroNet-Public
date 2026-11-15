  // ---- Developer -> NeuroPet: the sandbox's tools ----------------------------------------
  function renderDev(host) {
    const {s, v} = current();
    const d = s.dev || {};
    const opt = (list) => list.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("");
    const items = Object.keys(Core.ITEMS).sort((a, b) => Core.ITEMS[a].name.localeCompare(Core.ITEMS[b].name)).map((k) => [k, Core.ITEMS[k].name]);
    // the UX lead's refresh (Cam, PT19 b1: "clean up the sandbox UI and make it more presentable ... looks over the place"):
    // one header for which sandbox you're in, then cards that each do one job -- a title, a line of help, label-left rows
    // PT31 (Cam: "make the tools run horizontal across the screen and have each tool on its line ... tag pills i can click to jump
    // to a specific section"): every card full width, one tool a line, and a pill for each card at the top
    const cards = [], slug = (t) => "dv-sec-" + t.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const card = (icon, title, help, body) => { cards.push(title); return `<section class="pp-shop pp-dev-card" id="${slug(title)}"><h3><img alt="" src="${itemIcon(icon, 24)}">${esc(title)}</h3>
        ${help ? `<p class="stamp">${help}</p>` : ""}${body}</section>`; };
    const row = (label, ctl) => `<div class="pp-dev-row"><span class="pp-dev-label">${label}</span><div class="pp-dev-ctl">${ctl}</div></div>`;
    const bossGrounds = Object.keys(Core.HUNTS).filter((k) => Core.HUNTS[k].boss && Core.HUNTS[k].kills)
      .map((k) => { const hl = (s.hunt || {})[k] || {}; return [k, `${Core.MONSTERS[Core.HUNTS[k].boss].name} -- ${Core.HUNTS[k].name}${hl.wins ? " (beaten)" : ""}`]; });
    const ngOpen = Core.ngUnlocked(s), ngPool = [s.pet].concat(s.den || []).filter((p) => p && p.id && p.hatchAt <= Date.now());
    const lg = ngOpen ? Core.legacyOf(s) : null;
    host.innerHTML = `
      <div class="pp-page pp-dev">
        <header class="pp-shop pp-dev-head">
          <div><b>The sandbox</b><p class="stamp">A copy of the game to test in -- nothing here touches your real game. <b>Everything unlocked</b>: infinite items,
            every level. <b>Plain account</b>: the game's own rules, add what you need.</p></div>
          <div class="pp-dev-seg" id="dv-kinds" role="group" aria-label="Which sandbox"><button class="btn btn-sm" data-sbx="max">Everything unlocked</button><button class="btn btn-sm" data-sbx="plain">Plain account</button></div>
          <div class="pp-row"><button class="btn btn-sm btn-quiet" id="dv-clone">Copy my real game in</button><button class="btn btn-sm btn-quiet" id="dv-fresh">Start a fresh sandbox</button></div>
        </header>
        <nav class="pp-dev-pills" id="dv-pills" aria-label="Jump to a tool"></nav>
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${card("obj_sun", "Time and sky", "The clock moves things on (needs, trips, eggs, expeditions); the sky sets night or day whatever the clock says.",
          row("Move on", [[1 / 6, "+10 min"], [1, "+1 h"], [6, "+6 h"], [24, "+1 day"], [120, "+5 days"]].map(([h, n]) => `<button class="btn btn-sm dv-warp" data-h="${h}">${n}</button>`).join(""))
          + row("Sky", `<div class="pp-dev-seg" id="dv-sky" role="group" aria-label="Sky">${[["", "Real clock"], ["day", "Day"], ["night", "Night"]].map(([k, n]) =>
              `<button class="btn btn-sm${(d.sky || "") === k ? " btn-primary" : ""}" data-sky="${k}" aria-pressed="${(d.sky || "") === k}">${n}</button>`).join("")}</div>`))}
        ${card("bronzesword", "You", "Difficulty, levels, coins and wear. Your class and the sky are in the sidebar too, for a quick switch.",
          row("Difficulty", `<div class="pp-dev-seg" id="dv-mode" role="group" aria-label="Difficulty">${Object.keys(Core.MODES).map((k) =>
              `<button class="btn btn-sm${(s.mode || "hardcore") === k ? " btn-primary" : ""}" data-mode="${k}" aria-pressed="${(s.mode || "hardcore") === k}" title="${esc(Core.MODES[k].about)}">${esc(Core.MODES[k].name)}</button>`).join("")}</div>`)
          + row("Skill", `<select class="input" id="dv-skill">${opt(Core.SKILL_ORDER.map((k) => [k, Core.SKILLS[k].name]))}</select>
              <input class="input pp-num" id="dv-slv" type="number" min="1" max="${Core.MAX_LEVEL}" value="10" aria-label="Level"><button class="btn btn-sm" id="dv-slv-set">Set</button>`)
          + row("Class", `<select class="input" id="dv-cls">${opt([["", "-- none --"], ...Object.keys(Core.CLASSES).map((k) => [k, Core.CLASSES[k].name])])}</select><button class="btn btn-sm" id="dv-cls-set">Become</button>`)
          + row("Coins", `<input class="input pp-num" id="dv-coins" type="number" min="-99999" max="99999" value="500" aria-label="Coins"><button class="btn btn-sm" id="dv-coins-add">Add</button>`)
          + row("Weapon", `<button class="btn btn-sm" id="dv-wear80">Wear to 80%</button><button class="btn btn-sm" id="dv-wear99">To its last blow</button>`)
          + row("", `<button class="btn btn-sm" id="dv-max" title="Every skill, your pet and its areas at the top level">Max everything</button>`))}
        ${card("starteregg", "Pet", v.has ? "" : "No pet in the sandbox yet -- take an egg on My pet.",
          row("Care", `<button class="btn btn-sm" id="dv-fill">Fill stats & heal</button><button class="btn btn-sm dv-age" data-d="1">Age +1 day</button><button class="btn btn-sm dv-age" data-d="5">+5 days</button>`)
          + row("Level", `<input class="input pp-num" id="dv-plv" type="number" min="1" max="${Core.MAX_LEVEL}" value="${v.level || 1}" aria-label="Pet level"><button class="btn btn-sm" id="dv-plv-set">Set</button>`)
          + row("Area", `<select class="input" id="dv-area">${opt(Core.AREA_ORDER.filter((a) => !Core.AREAS[a].later).map((a) => [a, Core.AREAS[a].name]))}</select>
              <input class="input pp-num" id="dv-alv" type="number" min="1" max="5" value="5" aria-label="Area level"><button class="btn btn-sm" id="dv-alv-set">Set</button>`)
          + row("Graveyard", `<select class="input" id="dv-bury">${opt([
              ...(s.pet && v.has && v.stage !== "egg" ? [["", (s.pet.name || "Your pet") + " (your pet)"]] : []),
              ...(s.beasts || []).filter((x) => !x.loan).map((x) => [x.id, (x.name || x.species) + (x.risen ? " (risen)" : " (battle pet)")])])}</select>
              <button class="btn btn-sm" id="dv-bury-go">Lay to rest</button>`))}
        ${card("obj_chest", "Items", "Added straight to the bag (bag room ignored).",
          row("Add", `<select class="input" id="dv-item">${opt(items)}</select><input class="input pp-num" id="dv-n" type="number" min="1" max="9999" value="10" aria-label="How many"><button class="btn btn-sm" id="dv-give">Add</button>`)
          + row("Empty", `<button class="btn btn-sm btn-danger" id="dv-clearbag" title="Your bag, what you wear and carry -- not the bank or your coins">Remove all items from your character</button>`)
          + row("", `<button class="btn btn-sm" id="dv-giveall">Add 10 of everything</button>`))}
        ${card("bones", "Bosses", "Skip a boss's kill count, or count it as beaten without the fight (no spoils).",
          row("Boss", `<select class="input" id="dv-boss">${opt(bossGrounds)}</select>`)
          + row("", `<button class="btn btn-sm" id="dv-bossready">Ready to fight now</button><button class="btn btn-sm" id="dv-beatboss">Mark beaten</button>`))}
        ${card("bronzesword", "Hunt one creature", "A hunting ground meets only the creature you pick -- for quests and drops that want one kind. " +
            (Object.keys(d.target || {}).length ? "Now: " + Object.keys(d.target).map((g) => `${esc(Core.HUNTS[g].name)} → ${esc(Core.MONSTERS[d.target[g]].name)}`).join(", ") + "." : "Nothing picked: every ground has all its creatures."),
          row("Creature", `<select class="input" id="dv-tmon">${opt(Object.keys(Core.HUNTS).filter((g) => Core.HUNTS[g].monsters && Core.HUNTS[g].monsters.length)
              .flatMap((g) => Core.HUNTS[g].monsters.map((m) => [g + ":" + m[0], `${Core.HUNTS[g].name}: ${Core.MONSTERS[m[0]].name}${m[2] === "night" ? " (night)" : ""}`])))}</select>`)
          + row("", `<button class="btn btn-sm" id="dv-tset">Hunt only this</button><button class="btn btn-sm btn-quiet" id="dv-tclear">All creatures again</button>`))}
        ${card("stardust", "New Game Plus", ngOpen ? "Start a New Game Plus in the sandbox from this game -- its legacy, three pets, and a battle pet if you were a Beast Master."
            : "New Game Plus opens once the Basilisk (the Jungle's boss) is beaten -- in the sandbox, one click:",
          ngOpen ? row("Pets (up to 3)", `<div class="pp-dev-pets">${ngPool.map((p) => `<label class="pp-check"><input type="checkbox" data-ngpet="${esc(p.id)}"> ${esc(p.name || p.species)}</label>`).join("") || '<span class="stamp">No pets</span>'}</div>`)
            + (lg && lg.beast && lg.beasts.length ? row("Battle pet", `<select class="input" id="dv-ngbeast">${opt(lg.beasts.map((b) => [b.id, b.name]))}</select>`) : "")
            + (lg ? `<p class="stamp">Legacy: ${esc(lg.name || "no class")}${lg.points ? ` · ${lg.points} free talent points` : ""} · prestige mark ${lg.marks}</p>` : "")
            + row("", `<button class="btn btn-sm btn-primary" id="dv-ngplus">Start New Game Plus here</button>`)
            : row("", `<button class="btn btn-sm btn-primary" id="dv-ngbeat">Mark the Basilisk beaten</button>`))}
        ${card("fairystone", "Switches", "",
          `<label class="pp-check"><input type="checkbox" data-flag="instantHatch" ${d.instantHatch ? "checked" : ""}> Instant hatch</label>
          <label class="pp-check"><input type="checkbox" data-flag="allEggs" ${d.allEggs ? "checked" : ""}> Every egg can be taken</label>
          <label class="pp-check"><input type="checkbox" data-flag="infinite" ${d.infinite ? "checked" : ""}> Infinite items (nothing is used up)</label>
          <label class="pp-check"><input type="checkbox" data-flag="questFree" ${d.questFree ? "checked" : ""}> Quests hand in without their needs (kills, things to bring, levels)</label>`)}
      </div>`;
    const q = (id) => host.querySelector(id);
    const dev = async (o) => {
      const r = await act("dev", o);
      if (r && r.error) { status = r.error; toast(r.error, true); q("#pp-status").textContent = status; }
    };
    q("#dv-clone").addEventListener("click", async () => {
      if (!await askYes("Replace the sandbox with a copy of your real game?")) return;
      const real = await load("main");
      const copy = JSON.parse(JSON.stringify(real));
      copy.dev = Object.assign({}, (states.dev && states.dev.dev) || {}, {on: true});
      const r = await saveSlot("dev", copy);
      if (r && r.error) { status = r.error; toast(r.error, true); } else { states.dev = copy; status = "The sandbox is now a copy of your real game."; toast(status); }
      render();
    });
    q("#dv-fresh").addEventListener("click", async () => {
      if (!await askYes("Empty the sandbox and start again?")) return;
      const fresh = Core.empty();
      fresh.dev = Object.assign({}, (states.dev && states.dev.dev) || {}, {on: true});
      const r = await saveSlot("dev", fresh);
      if (!(r && r.error)) { states.dev = fresh; tutorStarted.delete("dev"); status = "A fresh sandbox."; toast(status); return goTo("pet:world"); }   // (PT31: the map, with the tutorial's start)
      render();
    });
    host.querySelectorAll("[data-flag]").forEach((c) => c.addEventListener("change", () => dev({op: "flags", [c.dataset.flag]: c.checked})));
    // which sandbox (2026-10-15): switch, and a new one is set up the first time -- a copy of your real game; the
    // everything-unlocked one with infinite items, instant hatching, every egg and every level on top
    const markKind = (k) => host.querySelectorAll("[data-sbx]").forEach((b) => { b.classList.toggle("btn-primary", b.dataset.sbx === k); b.setAttribute("aria-pressed", b.dataset.sbx === k); });
    call("pet_sandbox", [], "Your sandbox").then((r) => { if (r && r.kind) markKind(r.kind); }).catch(() => {});
    host.querySelectorAll("[data-sbx]").forEach((b) => b.addEventListener("click", async () => {
      if (b.getAttribute("aria-pressed") === "true") return;           // already this one
      const r = await call("pet_sandbox_use", [b.dataset.sbx], "Switching sandbox");
      if (!r || r.error) { toast((r && r.error) || "Couldn't switch.", true); return; }
      await load("dev");
      if (!r.exists || !(states.dev && states.dev.player && states.dev.player.made)) {
        const real = await load("main"), copy = JSON.parse(JSON.stringify(real));
        copy.dev = r.kind === "max" ? {on: true, infinite: true, allEggs: true, instantHatch: true} : {on: true};
        let st = copy;
        if (r.kind === "max") { const m = Core.act(st, "dev", {op: "maxall"}, Date.now()); if (m.ok) st = m.state; }
        await saveSlot("dev", st); states.dev = st;
      }
      status = r.kind === "max" ? "Sandbox: everything unlocked." : "Sandbox: a plain account -- the game's own rules; add what you need below.";
      toast(status); render();
    }));
    const pills = host.querySelector("#dv-pills");
    if (pills) { pills.innerHTML = cards.map((t) => `<button class="pp-btab" data-dvjump="${slug(t)}">${esc(t)}</button>`).join("");
      pills.querySelectorAll("[data-dvjump]").forEach((b) => b.addEventListener("click", () => { const el = host.querySelector("#" + b.dataset.dvjump); if (el) el.scrollIntoView({behavior: "smooth", block: "start"}); })); }
    host.querySelectorAll(".dv-warp").forEach((b) => b.addEventListener("click", () => dev({op: "warp", hours: +b.dataset.h})));
    host.querySelectorAll(".dv-age").forEach((b) => b.addEventListener("click", () => dev({op: "age", days: +b.dataset.d})));
    q("#dv-fill").addEventListener("click", () => dev({op: "fill"}));
    host.querySelectorAll("#dv-mode [data-mode]").forEach((b) => b.addEventListener("click", () => dev({op: "mode", mode: b.dataset.mode})));   // (PT33)
    host.querySelectorAll("[data-sky]").forEach((b) => b.addEventListener("click", () => dev({op: "sky", sky: b.dataset.sky})));
    q("#dv-bury-go").addEventListener("click", async () => { const sel = q("#dv-bury"); if (!sel.options.length) return toast("Nothing to lay to rest.", true);
      if (await askYes(`Send ${sel.options[sel.selectedIndex].text} to the Graveyard?`)) dev({op: "bury", beast: sel.value}); });
    q("#dv-plv-set").addEventListener("click", () => dev({op: "level", target: "pet", level: +q("#dv-plv").value}));
    q("#dv-alv-set").addEventListener("click", () => dev({op: "level", target: "area", area: q("#dv-area").value, level: +q("#dv-alv").value}));
    q("#dv-slv-set").addEventListener("click", () => dev({op: "level", target: "player", skill: q("#dv-skill").value, level: +q("#dv-slv").value}));
    q("#dv-max").addEventListener("click", () => dev({op: "maxall"}));
    q("#dv-wear80").addEventListener("click", () => dev({op: "wearweapon", share: 0.8}));
    q("#dv-wear99").addEventListener("click", () => dev({op: "wearweapon", share: 0.9999}));
    q("#dv-coins-add").addEventListener("click", () => dev({op: "coins", n: +q("#dv-coins").value}));
    q("#dv-give").addEventListener("click", () => dev({op: "give", item: q("#dv-item").value, n: +q("#dv-n").value}));
    q("#dv-clearbag").addEventListener("click", async () => { if (await askYes("Remove everything your character carries and wears (the sandbox only)?")) dev({op: "clearbag"}); });
    // PT30 v4 (Cam: "i dont like the arrows on the side i reckon we go a slider so its consistent with the benches"): every number
    // here gets the bench's − slider + beside its box (the box keeps its id, so each Set/Add button reads it as before)
    host.querySelectorAll("input.pp-num[type=number]").forEach((nb) => {
      if (nb.dataset.slid) return; nb.dataset.slid = "1";
      const lo = +nb.min, hi = +nb.max, wrap = document.createElement("span"); wrap.className = "pp-numslide";
      const minus = Object.assign(document.createElement("button"), {className: "btn btn-sm", textContent: "−", type: "button"});
      const plus = Object.assign(document.createElement("button"), {className: "btn btn-sm", textContent: "+", type: "button"});
      const sl = Object.assign(document.createElement("input"), {type: "range", min: lo, max: hi, value: nb.value, className: "pp-bslide"}); sl.setAttribute("aria-label", nb.getAttribute("aria-label") || "Amount");
      const step = Math.max(1, Math.round((hi - lo) / 200));
      const set = (v) => { const n = Math.max(lo, Math.min(hi, Math.round(+v) || lo)); nb.value = sl.value = n; };
      sl.addEventListener("input", () => set(sl.value)); nb.addEventListener("input", () => { sl.value = nb.value; });
      minus.addEventListener("click", () => set(+nb.value - step)); plus.addEventListener("click", () => set(+nb.value + step));
      nb.parentNode.insertBefore(wrap, nb); wrap.append(minus, sl, plus, nb);
    });
    q("#dv-giveall").addEventListener("click", () => dev({op: "giveall", n: 10}));
    q("#dv-cls").value = s.player.cls || "";
    q("#dv-cls-set").addEventListener("click", () => { const c = q("#dv-cls").value; if (c && c !== s.player.cls) act("class", {cls: c, quick: true}).then((r) => r && r.error && toast(r.error, true)); });
    q("#dv-bossready").addEventListener("click", () => dev({op: "bossready", ground: q("#dv-boss").value}));
    q("#dv-beatboss").addEventListener("click", () => dev({op: "beatboss", ground: q("#dv-boss").value}));
    q("#dv-tset").addEventListener("click", () => { const [g, m] = q("#dv-tmon").value.split(":"); dev({op: "target", ground: g, mon: m}); });
    q("#dv-tclear").addEventListener("click", () => { const [g] = q("#dv-tmon").value.split(":"); dev({op: "target", ground: g, mon: ""}); });
    const ngx = q("#dv-ngbeat"); if (ngx) ngx.addEventListener("click", () => dev({op: "beatboss", ground: "jungle"}));   // (PT20 d4: right here, not via the Bosses list)
    const ngb = q("#dv-ngplus");
    if (ngb) ngb.addEventListener("click", async () => {
      const pets = [...host.querySelectorAll("[data-ngpet]:checked")].map((c) => c.dataset.ngpet).slice(0, 3), bsel = q("#dv-ngbeast");
      if (!await askYes("Replace this sandbox with a New Game Plus started from it?")) return;
      const st = Core.newGame({mode: s.mode || "hardcore", from: s, pets, beast: bsel ? bsel.value : ""}, Date.now());
      st.dev = Object.assign({}, s.dev || {}, {on: true});
      const r = await saveSlot("dev", st);
      if (r && r.error) return toast(r.error, true);
      states.dev = st; status = "New Game Plus " + (st.ngPlus || 1) + " started in the sandbox."; toast(status); render();
    });
    host.querySelectorAll("[data-ngpet]").forEach((c) => c.addEventListener("change", () => {
      if (host.querySelectorAll("[data-ngpet]:checked").length > 3) { c.checked = false; toast("Three pets at most.", true); } }));
  }

  const VIEWS = ["proto:grid", "pet:pyramid", "pet:islandestate", "pet:shipyard", "pet:settings", "pet:estate", "pet:house", "pet:library", "pet:storeroom", "pet:nursery", "pet:guild", "pet:market", "pet:pen", "pet:workshop", "pet:outskirts", "pet:home", "pet:skills", "pet:foraging", "pet:fishing", "pet:mining", "pet:lumbering", "pet:digging", "pet:village",
                 "pet:gear", "pet:expeditions", "pet:hunt", "pet:farm", "pet:pets", "pet:hatchery", "pet:breed", "pet:dex", "pet:graveyard", "pet:ranch", "pet:camp", "pet:bestiary", "pet:herbarium", "pet:world", "pet:dash", "pet:runecrafting", "pet:spellbook", "pet:enchants", "pet:saves", "pet:modder", "dev:tools", "dev:places"];
  SS.Pet = {
    VIEWS,
    kitToggle() { kitSet(!kitOpen()); },
    kitShow(tab) { kitShow(tab); },                       // open the Kit at a tab (the old Bag page's links come here, 2026-10-20)
    kitRefresh() { kitSig = ""; kitRender(); },                  // the top bar's Kit button (Modernize/Reduce Nav)
    everySecond,                                          // the shared ticker (game.js's nav and top bar ride it too)
    memo,
    PREFIX: "pet",
    /** Draw the game into host: view, on the real game ("main") or the sandbox ("dev"). */
    async mount(host, v, which) {
      hostEl = host;
      view = VIEWS.includes(v) ? v : "pet:home";
      slot = which === "dev" ? "dev" : "main";
      makingLook = false;
      status = "";
      await load();
      render();
      checkpoint().then(() => render());               // opened: settle the time away once (OPT-1)
    },
    /** Another page, the same game (the sidebar). */
    /** The sidebar's Map opens the whole map, not the last region (2026-10-07). */
    mapHome() { worldRegion = ""; seaChart = false; closeSeaSheet(); },
    /** Where you're gathering: that region's picture (2026-10-10, Cam: the top bar's trip chip opened the skill's list of
        every spot -- "it takes away the need to navigate the gameworld ... and doesnt allow the player to have to learn
        where everything is"). */
    toRegion(id) { worldRegion = id || ""; seaChart = false; closeSeaSheet(); closeSec(); status = ""; },
    // ---- the navigation bar above every page (2026-10-09, Cam: "I want all navigation just above the map and not in
    //      the top bar ... back, map and home ... Home will not work when on another island until you unlock and build
    //      the respective player estate") -- the shell draws it; these say what's inside the Map and where Home is.
    /** A view inside the Map to step back out of: {back: label} or null. */
    inner() {
      if (view !== "pet:world") return null;
      if (REGION_UP[worldRegion]) return {back: Core.REGIONS[REGION_UP[worldRegion]].name, up: REGION_UP[worldRegion]};   // (Cam: "Fix the way back from the nile")
      if (worldRegion && worldRegion !== "village") return {back: "Map"};
      if (seaChart) return {back: "Map"};                             // the Map button goes there too
      return null;
    },
    /** Where Back from a page under the Map goes: the region it was opened from (the Shipyard from the Coast). */
    regionName() { return worldRegion && worldRegion !== "village" && Core.REGIONS[worldRegion] ? Core.REGIONS[worldRegion].name : ""; },
    innerBack() { const up = REGION_UP[worldRegion]; if (up) worldRegion = up; else if (worldRegion) worldRegion = ""; else seaChart = false; closeSeaSheet(); closeSec(); status = ""; render(); },
    /** Buttons that belong to this page: the Sea chart on the Map. */
    extras() {
      if (view !== "pet:world" || (worldRegion && worldRegion !== "village")) return [];
      return [{id: "sea", label: seaChart ? "Island map" : "Sea chart", on: seaChart}];
    },
    extra(id) { if (id === "sea") { seaChart = !seaChart; closeSeaSheet(); status = ""; render(); } },
    /** Where Home is: your house on the main island, your estate on another island once its house is built. */
    homeTarget() {
      const {s, now} = current(), wv = Core.worldView(s, now);
      if (wv.voyage) return {go: "", why: "You're at sea -- your estate is back on land."};
      if (!wv.here) return {go: "pet:estate"};                         // the estate: house, workshop, library, store room (2026-10-10)
      const e = (s.estates || {})[wv.here], town = wv.hereTown && Core.REGIONS[wv.hereTown] ? Core.REGIONS[wv.hereTown].name : "town";
      if (e && e.bought && ((e.parts || {}).house || 0) >= 1) return {go: "pet:islandestate"};
      return {go: "", why: `Your estate on ${wv.hereName} is in ${town} -- ${e && e.bought ? "build its house" : "buy the plot and build its house"} first.`};
    },
    show(v) {
      closeSec();
      view = VIEWS.includes(v) ? v : "pet:home";
      makingLook = false; status = ""; openShop = "";
      const m = document.querySelector(".pp-modal.pp-shop-modal"); if (m) m.remove();
      render();
    },
    /** A village workshop, opened (the sidebar's Cooking and Crafting). */
    shop(id) { view = Core.WORKSHOPS[id] && Core.WORKSHOPS[id].npc ? "pet:village" : "pet:workshop"; openShop = id; status = ""; render(); },
    /** The real game or the sandbox. */
    async setSlot(which) { slot = which === "dev" ? "dev" : "main"; await load(); render(); checkpoint().then(() => render()); },
    get slot() { return slot; },
    get view() { return view; },
    get shopId() { return openShop; },
    /** The game now (advanced), for the shell's sidebar and top bar. */
    peek() { return current(); },
    reload: async () => { await load(); render(); },
    /** The pet in a line (the top bar's hint on My pet). */
    describe: () => { const v = current().v; return v.has ? describe(v) : ""; },
    act,
    icon: (name, size) => itemIcon(name, size),
    avatar: (lk, size, skin) => avatarURL(lk, size, skin),
    grave: () => { const {s: st, now} = current(); return Core.graveView(st, now); },   // the top bar's gravestone chip (V16)
    you: (lk, pose) => youURL(lk, pose),
    pet: (species, colour, size) => petURL(species, colour, size),
    monster: (id, size) => monsterURL(id, size),
    _test: {current, setState: (s, which) => { states[which || slot] = s; }, describe},
  };
})();
