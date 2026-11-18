/* ==========================================================================
   NeuroPets -- the game's shell (2026-10-03): the sidebar of skills, the
   coloured top bar, toasts, and the sandbox switch. pet.js draws the pages into #np-host; this file goes around it.

   Cam: "look over the whole app and modernize the UI ... clean the UI,
   declutter, make it easier to follow" with Melvor Idle as the reference --
   so, like Melvor: every skill in the sidebar with its level, a dot on the
   one you're training, and what you're doing up in the top bar, so the pages
   themselves don't have to keep saying it.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};
  const NP = window.NP = window.NP || {};
  const Core = window.PetCore;

  // pywebview's bridge (neuropets.py Api). A test page may bring its own SS.Store.
  const bridge = new Promise((ok) => {
    if (window.pywebview && window.pywebview.api) ok();
    else window.addEventListener("pywebviewready", () => ok(), {once: true});
  });
  if (!SS.Store) SS.Store = {
    async call(name, args) {
      await bridge;
      const f = window.pywebview.api[name];
      if (!f) return {error: `NeuroPets can't ${name}.`};
      return f(...(args || []));
    },
  };

  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem("np." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("np." + k, JSON.stringify(v)); } catch (e) { /* private window */ } },
  };

  // ---- the pages: where each lives in the sidebar, its colour, its icon, a short hint -----------
  // (the hint replaces the paragraph each page used to open with)
  const PAGES = {
    "pet:dash": {name: "Today", accent: "#f2a03c", icon: "obj_sun", hint: "What's going on, what's ready for you, and where you left off"},
    "pet:home": {name: "My pet", accent: "#e8a0bf", hint: "Feed, play and keep your pet clean — click it for a fuss"},
    "pet:skills": {name: "Character", accent: "#7c8cf0", hint: "Your Character sheet: you, skills, gear, combat and records"},
    // Cam (2026-10-04): the skills leave the sidebar -- gathering lives in the Outskirts, making in the Workshop
    "pet:outskirts": {name: "Outskirts", accent: "#4caf50", icon: "birch", hint: "Gathering — pick a skill, then a material"},
    "pet:workshop": {name: "Workshop", accent: "#c9773d", icon: "obj_anvil", hint: "Every bench, room by room: kitchen, smithy, shed and library — build them up"},
    // the estate and the nursery (2026-10-08): places with doors to the pages that used to be in the sidebar
    "pet:estate": {name: "Estate", accent: "#c9a15a", icon: "obj_house", hint: "Your house, workshop, library, store room and graveyard"},
    "pet:house": {name: "Home", accent: "#e8a0bf", icon: "obj_house", hint: "What's going on, what's ready — your pet, your bag, you, and the bedroom"},
    "pet:islandestate": {name: "Island estate", accent: "#c9a15a", icon: "obj_house", hint: "A home away from home: buy the plot, build it up, and use its benches and chests on the island"},
    "pet:pyramid": {name: "The Pyramid", accent: "#c8963c", icon: "glyphsun", hint: "Five chambers a day -- traps, glyph riddles, guardians -- then the treasure; the Pharaoh after dark"},
    "pet:shipyard": {name: "Shipyard", accent: "#3a8ab8", icon: "boat", hint: "Your ship, the next one in four parts, and setting sail -- Shipwright Hal runs the yard"},
    "pet:settings": {name: "Settings", accent: "#8a94a8", icon: "fairystone", hint: "What the game shows you"},
    "pet:library": {name: "Library", accent: "#8a7ad8", icon: "tomekeen", hint: "Spellbook, enchants, Herbarium, Bestiary and Petapedia"},
    "pet:storeroom": {name: "Storeroom", accent: "#8a94a8", icon: "woodcrate", hint: "Your equipment, and the chests"},
    "pet:nursery": {name: "Nursery", accent: "#f2c46d", icon: "commonegg", hint: "Hatching and breeding"},
    "pet:guild": {name: "Guild hall", accent: "#c8a24a", icon: "tomearcanist", hint: "The tutors, switching class, class books and benches"},
    "pet:pen": {name: "Beast Pen", accent: "#8a6a3a", icon: "grainfeed", hint: "Battle pets: stalls, training and rest"},
    "pet:hunt": {name: "Hunting", accent: "#d84a4a", icon: "bronzesword", hint: "Your fight, round by round — hunting grounds are on the Map"},
    "pet:gear": {name: "Character", accent: "#8a94a8", icon: "bronzehelm", hint: "Your Character sheet: gear, for you and your pet"},
    "pet:spellbook": {name: "Spellbook", accent: "#6a5ad8", icon: "tomearcanist", hint: "Every spell, the runes it takes -- and the three you take into a fight"},
    "pet:enchants": {name: "Enchant book", accent: "#c86ad8", icon: "tomeflaming", hint: "The enchants you've learnt (from tomes in ancient chests), and what they're on"},
    // the crafters' work, yours now (2026-10-04): a skill and a thing in the village each
    "pet:village": {name: "Village", accent: "#e0a040", icon: "obj_village", hint: "The merchants, the alchemist, the nursery — and the way to your estate"},
    "pet:pets": {name: "Pets", accent: "#e8a0bf", hint: "Your companion and the den; send den pets gathering"},
    "pet:hatchery": {name: "Hatchery", accent: "#f2c46d", icon: "commonegg", hint: "Eggs hatch here — a surprise until they do"},
    "pet:breed": {name: "Breeding", accent: "#e07aa8", icon: "heart", hint: "Two pets, an hour together, an egg"},
    "pet:expeditions": {name: "Expeditions", accent: "#d07a4a", icon: "woodcrate", hint: "Your pet explores and brings things home"},
    "pet:dex": {name: "Petapedia", accent: "#6fa0d8", icon: "clover", hint: "Every pet on the isle"},
    "pet:graveyard": {name: "Graveyard", accent: "#8a8f9c", icon: "bones", hint: "The pets lost on expeditions"},
    "pet:camp": {name: "Camp", accent: "#c8a050", icon: "relic", hint: "Lasting upgrades for every pet, bought with relics"},
    "pet:world": {name: "Map", accent: "#5aa0d8", icon: "obj_map", hint: "Go anywhere: gather, hunt, explore and meet people in each region"},
    "pet:saves": {name: "Save slots", accent: "#7a8ab8", icon: "tomekeen", hint: "Three games at once -- each with its own mode; New Game Plus once you've beaten the Basilisk"},
    "pet:modder": {name: "Modder", accent: "#3fb5a5", icon: "obj_bench", hint: "Make mod packs: rates, pictures, map backgrounds, pets' colours and buffs -- pick one when you start a new game"},
    "pet:herbarium": {name: "Herbarium", accent: "#5fbf7a", icon: "herb", hint: "Every herb you've identified, and where to find more"},
    "pet:bestiary": {name: "Bestiary", accent: "#9a6ad8", icon: "batwing", hint: "Every creature you and your pets have met -- and what you know of it"},
    "dev:tools": {name: "Dev tools", accent: "#f2c43c", icon: "fairystone", hint: "The sandbox's tools: time, levels, items"},
    "dev:places": {name: "Place editor", accent: "#f2c43c", icon: "obj_map", hint: "Where each place is painted on its scene: drag the scrolls, then Save"},
  };
  // Cam (2026-10-07, "happy with your plan lets do it"): the Map is how you get about -- gathering, hunting
  // and the village are in its regions now, so the sidebar keeps only what isn't a place
  // Cam (2026-10-08): "This is all to move to a navigation style game" -- everything else is a place now:
  // Map > Village > Estate > House / Workshop / Library / Storeroom / Graveyard, Village > Nursery
  // (2026-10-08: Home is the start, with Today on it; the Camp is in the Forest)
  const GROUPS = [
    ["", ["pet:house", "pet:world"]],
    ["Game", ["pet:saves", "pet:modder", "pet:settings"]],
    ["Sandbox", ["dev:tools", "dev:places"]],
  ];
  // the game's settings (pet.py settings.json -- the window is private, so localStorage doesn't last)
  NP.settings = {sidebar: true, modder: true, newGame: true, sandbox: true, dailySaves: true, dayNight: true, deepNight: false, kit: false};
  const shown = (k) => k !== "pet:modder" || NP.settings.modder !== false;
  // (the grid game's prototype, Prototypes > Grid world, was taken out 2026-11-18 at Cam's ask: git tag grid-game-prototype)
  function applySettings() {
    document.body.classList.toggle("np-noside", NP.settings.sidebar === false);
    const sw = document.querySelector(".np-side-foot");
    if (sw) sw.hidden = NP.settings.sandbox === false && !sandbox;
  }
  NP.setSetting = async (k, v) => {
    NP.settings[k] = !!v;
    applySettings(); navSig = ""; drawNav(); drawTop();
    if ((k === "dayNight" || k === "deepNight") && SS.Pet.reload) SS.Pet.show(current);
    if (k === "kit" && SS.Pet.kitRefresh) SS.Pet.kitRefresh();                                 // the Kit comes or goes at once           // redraw the picture in its new light
    const r = await SS.Store.call("pet_settings_save", [{[k]: !!v}]);
    if (r && r.error) SS.toast(r.error, true);
  };

  // pages reached from a hub rather than the sidebar: the hub stays lit, and the top bar offers the way back
  // every skill's own page (a gathering skill's spots, a making skill's bench), from the skill registry (2026-10-11, FUT-1)
  Object.assign(PAGES, Core.skillPages());
  // Larceny's page is the Marketplace (2026-10-17): a place first, a skill's page second
  PAGES["pet:market"] = Object.assign(PAGES["pet:market"] || {}, {name: "Marketplace", accent: "#c8763a", icon: "oldcoin", hint: "Stalls to buy from and sell to -- and, for a Thief, pockets to pick"});
  Core.GATHERING.map((k) => "pet:" + k).concat(["pet:outskirts", "pet:hunt", "pet:village"]).forEach((k) => { PAGES[k].parent = "pet:world"; });
  PAGES["pet:farm"].parent = "pet:workshop";                       // the farm is your garden, at home
  Object.keys(PAGES).filter((k) => k.startsWith("shop:")).forEach((k) => { PAGES[k].parent = "pet:workshop"; });
  const UNDER = {"pet:estate": "pet:world", "pet:nursery": "pet:village", "pet:guild": "pet:village", "pet:market": "pet:village",          // the estate is on the main map (2026-10-13)
    "pet:house": "pet:estate", "pet:workshop": "pet:estate", "pet:library": "pet:estate", "pet:storeroom": "pet:estate", "pet:graveyard": "pet:estate", "pet:pen": "pet:estate",
    "pet:home": "pet:house", "pet:pets": "pet:house", "pet:skills": "pet:house", "pet:expeditions": "pet:house",
    "pet:spellbook": "pet:library", "pet:enchants": "pet:library", "pet:herbarium": "pet:library", "pet:bestiary": "pet:library", "pet:dex": "pet:library",
    "pet:gear": "pet:house", "pet:hatchery": "pet:nursery", "pet:breed": "pet:nursery"};
  Object.keys(UNDER).forEach((k) => { PAGES[k].parent = UNDER[k]; });
  Object.assign(PAGES["pet:ranch"], {name: "The Farm", hint: "Your animals, the Feed store and Fern's stall", parent: "pet:estate"});   // Husbandry's page (2026-10-12)
  PAGES["pet:camp"].parent = "pet:world";                          // the camp is in the Forest (2026-10-08)
  PAGES["pet:shipyard"].parent = "pet:world";                      // the Shipyard is on the Coast
  PAGES["pet:pyramid"].parent = "pet:world";                       // the Pyramid is in the Desert (2026-10-09)
  PAGES["pet:islandestate"].parent = "pet:world";                  // an island estate is in its town (stage 4)
  /** Is `key` this page or one it sits under (the sidebar lights Map for everything out in the world)? */
  const within = (page, key) => { for (let k = page, n = 0; k && n < 9; k = PAGES[k] && PAGES[k].parent, n++) if (k === key) return true; return false; };
  let current = "pet:estate";                                      // the game opens at your Estate (2026-10-10, was the house)
  let sandbox = false;

  function iconFor(key, g) {
    const P = PAGES[key];
    if (key === "pet:home") return g.v.has && g.v.stage !== "egg" ? SS.Pet.pet(g.v.species, g.v.colour, 32) : SS.Pet.icon("starteregg", 32);
    if (key === "pet:skills" || key === "pet:pets") return key === "pet:skills" ? SS.Pet.you(g.pv.look)
      : (g.v.has && g.v.stage !== "egg" ? SS.Pet.pet(g.v.species, g.v.colour, 32) : SS.Pet.icon("starteregg", 32));
    return SS.Pet.icon(P.icon, 32);
  }
  /** The game now, from pet.js: the pet, you, the bag. */
  function glance() {
    const c = SS.Pet.peek();
    return {s: c.s, v: c.v, now: c.now, pv: SS.Pet.memo("playerView", c.s, c.now)};   // shared with the page's clock
  }
  function busyKey(pv) {
    const j = pv.job;
    if (pv.battle || (j && j.hunt)) return "pet:hunt";
    if (j) return "pet:" + j.skill;
    return "";
  }
  function rightOf(key, g) {
    const P = PAGES[key], pv = g.pv;
    if (P.skill) return `${pv.skills[P.skill].level}`;
    if (key === "pet:hunt") return `${pv.combatLevel}`;
    if (key === "pet:skills") return `${pv.totalLevel}`;
    if (key === "pet:hatchery") { const n = Core.hatcheryView(g.s, g.now).eggs.length; return n ? `${n}` : ""; }
    return "";
  }

  // ---- the sidebar --------------------------------------------------------------------------
  let navSig = "";
  function drawNav() {
    const g = glance(), busy = busyKey(g.pv);
    const sky = sandbox ? ((g.s.dev || {}).sky || "") : "", cls = sandbox ? ((g.s.player || {}).cls || "") : "";
    const sig = JSON.stringify([current, sandbox, busy, NP.settings.modder, GROUPS.map(([, keys]) => keys.map((k) => rightOf(k, g))), g.v.species, g.v.stage, g.pv.look, sky, cls]);
    if (sig === navSig) return;
    navSig = sig;
    $("np-nav").innerHTML = GROUPS.filter(([name, keys]) => (name !== "Sandbox" || sandbox) && keys.some(shown)).map(([name, keys]) => `
      <div class="np-group">${name ? `<h6>${esc(name)}</h6>` : ""}
        ${keys.filter(shown).map((k) => {
          const P = PAGES[k], on = within(current, k);
          return `<button class="np-row${on ? " on" : ""}${busy && within(busy, k) ? " busy" : ""}" data-go="${k}" style="--row-accent:${P.accent}">
            <img alt="" src="${iconFor(k, g)}"><span class="np-row-name">${esc(P.name)}</span><span class="np-row-n">${esc(rightOf(k, g))}</span></button>`;
        }).join("")}${name === "Sandbox" ? quickHTML(sky, cls) : ""}</div>`).join("");
  }
  /** The sandbox's quick switches, under its pages (Cam, PT19 b1: "in the developer mode add day/night switcher and class switcher
      to the side bar. This will make it quicker when i want to change in a pinch"). The class switch skips the tutor's lesson. */
  function quickHTML(sky, cls) {
    return `<div class="np-quick" aria-label="Quick switches">
      <div class="np-quick-seg" role="group" aria-label="Sky">${[["", "Clock", "Real clock"], ["day", "Day", "Day"], ["night", "Night", "Night"]].map(([k, ic, n]) =>
        `<button class="${sky === k ? "on" : ""}" data-qsky="${k}" title="Sky: ${n}" aria-pressed="${sky === k}">${ic}</button>`).join("")}</div>
      <select class="np-quick-cls" id="np-qcls" aria-label="Class (sandbox)" title="Class -- no lesson, free in the sandbox">
        <option value="" ${cls ? "" : "selected"}>Class…</option>${Object.keys(Core.CLASSES).map((k) => `<option value="${k}" ${cls === k ? "selected" : ""}>${esc(Core.CLASSES[k].name)}</option>`).join("")}</select></div>`;
  }

  // ---- the top bar: the page, and what you're up to --------------------------------------------
  const clock = (secs) => {
    const h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(secs % 60).padStart(2, "0")}`;
  };
  // (OPT-A, audit 2026-10-19: the top bar redraws every second -- writing an unchanged title, hint, icon or the page's accent
  // still makes the browser restyle and lay out the page beside it, 31 ms a second on a full sandbox Bag. Write only changes.)
  const setText = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
  const setSrc = (el, u) => { if (el && el.getAttribute("src") !== u) el.setAttribute("src", u); };
  let accentNow = "";
  function drawTop() {
    const P = PAGES[current] || PAGES["pet:home"], g = glance(), pv = g.pv;
    if (accentNow !== P.accent) { accentNow = P.accent; document.documentElement.style.setProperty("--accent", P.accent); }
    setText($("np-title"), current === "pet:home" && g.v.has && g.v.name ? g.v.name : P.name);
    const back = $("np-back");
    if (back && !back.hidden) back.hidden = true;                   // Back lives in the bar above the page now (2026-10-09)
    drawPath(P);
    setText($("np-hint"), current === "pet:home" ? SS.Pet.describe() || "" : "");   // (2026-10-20, Cam: no explaining writing -- only your pet's mood)
    setSrc($("np-top-img"), iconFor(current, g));
    const chips = [];
    if (sandbox) chips.push(`<button class="np-chip sandbox" data-go="dev:tools" title="You're in the sandbox — nothing here touches your real game">SANDBOX</button>`);
    // you: your portrait opens your Character sheet (2026-10-15, Cam, Q1)
    if (pv.made && window.innerWidth <= 760) chips.push(`<button class="np-chip np-kit-toggle${document.body.classList.contains("np-kit-on") ? " on" : ""}" id="np-kit-toggle" data-kittoggle aria-pressed="${document.body.classList.contains("np-kit-on")}" title="Your kit: bag, gear and magic at the side (Modernize/Reduce Nav)">Kit</button>`);
    if (pv.made) chips.push(`<button class="np-chip np-me" data-go="pet:skills" title="Your Character sheet"><img alt="" src="${SS.Pet.avatar(pv.look, 20)}">${esc(pv.name)}</button>`);
    // what you're doing: one place for it, instead of on every page
    const j = pv.job, b = pv.battle;
    if (b) chips.push(`<button class="np-chip" data-go="pet:hunt"><img alt="" src="${SS.Pet.monster(b.mon, 20)}">vs ${esc(b.monName)} · ${b.mhp}/${b.monHp}</button>`);
    else if (j && j.hunt) chips.push(`<button class="np-chip" data-go="pet:hunt"><img alt="" src="${SS.Pet.icon("bronzesword", 20)}">${esc(j.spotName)} · ${j.count} win${j.count === 1 ? "" : "s"}</button>`);
    // your trip: to the region you're gathering in, on the map -- never the skill's list of every spot (2026-10-10)
    else if (j) chips.push(`<button class="np-chip" ${j.area ? `data-place="${esc(j.area)}"` : 'data-go="pet:world"'} title="Where you're gathering"><img alt="" src="${SS.Pet.icon(PAGES["pet:" + j.skill].icon, 20)}">${esc(j.spotName)} · ${j.full ? "bag full" : `next ${clock(j.nextIn)}`}</button>`);
    // where you are (2026-10-08): at sea, or on an island
    { const gv = SS.Pet.grave && SS.Pet.grave(); if (gv) chips.push(`<button class="np-chip np-grave" data-go="pet:hunt" title="Your gravestone at the ${esc(gv.where)}: what you lost is in it. Open it for half of what's inside.">Gravestone · ${Math.ceil(gv.leftMs / 60000)}m</button>`); }   // V16
    if (pv.voyage) chips.push(`<button class="np-chip" data-go="pet:world">At sea: ${esc(pv.voyage.toName)} · ${clock(pv.voyage.endsIn)}</button>`);
    else if (pv.island) chips.push(`<button class="np-chip" data-go="pet:world">On ${esc(pv.islandName)}</button>`);
    if (pv.made) chips.push(`<button class="np-chip" data-go="pet:village" title="Your coins — the merchant buys what you can spare">🪙 ${Number(pv.coins || 0).toLocaleString()}</button>`);
    if (pv.made) {
      const pct = Math.round(100 * pv.hp / Math.max(1, pv.maxHp));
      chips.push(`<button class="np-chip" data-go="pet:skills" title="Your health">♥ ${pv.hp}/${pv.maxHp}<span class="np-mini"><span class="${pct > 50 ? "" : pct > 20 ? "mid" : "low"}" style="width:${pct}%"></span></span></button>`);
    }
    if (g.v.has && g.v.need) chips.push(   // (PT30 l1: it stays in the panel on the pet's own page too)
      `<button class="np-chip" data-go="pet:home"><img alt="" src="${iconFor("pet:home", g)}">${esc(g.v.need)}</button>`);
    const html = chips.join("");
    // (Q6 q5, 2026-10-19: you, coins, health and what you're doing live at the top of the left panel; the top bar has them
    // only while the panel is hidden)
    const side = !document.body.classList.contains("np-noside"), on = $(side ? "np-chips" : "np-chips-top"), off = $(side ? "np-chips-top" : "np-chips");
    if (off && off.dataset.html) { off.innerHTML = ""; off.dataset.html = ""; }
    if (on && on.dataset.html !== html) { on.innerHTML = html; on.dataset.html = html; }
  }

  // ---- the navigation bar, just above every page (2026-10-09, Cam: "navigation needs to be altered so it has
  //      continuity ... all navigation just above the map and not in the top bar ... back, map and home"): Back is one
  //      step up (a region to the Map, the sea chart to the island, a room to its building), Map the map of where you
  //      are, Home your house -- or on another island, your estate there once its house is built.
  function drawPath(P) {
    const bar = $("np-pathbar");
    if (!bar || !SS.Pet || !SS.Pet.homeTarget) return;
    let inner = null, home = {go: "pet:estate"};
    try { inner = SS.Pet.inner(); home = SS.Pet.homeTarget(); } catch (e) { /* not loaded yet */ }
    const up = !inner && P.parent && PAGES[P.parent], onMap = current === "pet:world" && !inner, atHome = current === home.go;
    const btn = (attrs, label, on, off, title) => `<button class="np-path${on ? " on" : ""}" ${attrs}${off ? " disabled" : ""}${title ? ` title="${esc(title)}"` : ""}>${label}</button>`;
    const html = [
      // (2026-10-09, Cam: "‹ Map" beside "🗺 Map" is the same button twice) -- a Back that only leads to the Map is greyed out
      inner && inner.back !== "Map" ? btn('data-path="back"', "‹ " + esc(inner.back))
        : up && !(P.parent === "pet:world" && !SS.Pet.regionName()) ? btn(`data-go="${P.parent}" data-back-region="1"`, "‹ " + esc(P.parent === "pet:world" && SS.Pet.regionName() || up.name))
        : btn('data-path="none"', "‹ Back", false, true, "The Map button takes you there"),
      btn('data-go="pet:world"', "Map", onMap),
      // (2026-10-10, Cam: "change the home button ... to estate ... more efficient for me to access my workshop, library or
      // storeroom") -- your estate, not inside the house
      home.go ? btn(`data-go="${home.go}"`, "Estate", atHome) : btn('data-path="none"', "Estate", false, true, home.why),
      // (the Bag button went 2026-10-20: the bag lives in the Kit at the side -- Cam: "the navigation pill can also go")
      ...SS.Pet.extras().map((x) => btn(`data-path="x:${esc(x.id)}"`, esc(x.label), x.on)),
    ].join("");
    if (bar.dataset.html !== html) { bar.innerHTML = html; bar.dataset.html = html; }
  }

  // ---- going places ----------------------------------------------------------------------------
  function go(key) {
    if (key === "pet:bag") { if (SS.Pet && SS.Pet.kitShow) SS.Pet.kitShow("bag"); return; }   // the bag is the Kit's (2026-10-20): no page of its own
    if ((key === "dev:tools" || key === "dev:places") && !sandbox) key = "pet:home";
    if (key === "pet:dash") key = "pet:house";                     // Today is at Home now
    if (key !== "pet:saves") NP.welcome = false;
    current = key;
    store.set("view", key);
    if (key.startsWith("shop:")) SS.Pet.shop(key.slice(5));
    else SS.Pet.show(key);
    $("np-scroll").scrollTop = 0;
    drawNav(); drawTop();
  }
  SS.go = go;
  // pet.js tells us what it drew (a link inside a page, a shop closed back to the village...)
  SS.petRendered = (view) => {
    const shop = (view === "pet:village" || view === "pet:workshop") && SS.Pet.shopId ? "shop:" + SS.Pet.shopId : "";
    current = shop && PAGES[shop] ? shop : view;
    store.set("view", current);
    drawNav(); drawTop();
  };
  document.addEventListener("change", (e) => {
    if (e.target.id === "np-qcls" && e.target.value) SS.Pet.act("class", {cls: e.target.value, quick: true}).then((r) => { if (r && r.error) SS.toast(r.error, true); });
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-kittoggle]")) { SS.Pet.kitToggle(); return; }
    const qs = e.target.closest("[data-qsky]");
    if (qs) { SS.Pet.act("dev", {op: "sky", sky: qs.dataset.qsky}).then((r) => { if (r && r.error) SS.toast(r.error, true); }); return; }
    const el = e.target.closest("[data-go]");
    if (el && (el.closest("#np-nav") || el.closest("#np-chips") || el.closest("#np-chips-top") || el.closest("#np-pathbar") || el.id === "np-back")) {
      e.preventDefault();
      // Map: the whole map of where you are -- but "‹ Farmyard" (back to the region you came from) keeps that region open
      // (2026-10-11, Cam: "Farmyard navigation button doesnt work when in hunting ground ... it takes me back to the main island map")
      if ((el.closest("#np-nav") || el.closest("#np-chips") || el.closest("#np-chips-top") || el.closest("#np-pathbar")) && el.dataset.go === "pet:world" && !el.dataset.backRegion && SS.Pet.mapHome) SS.Pet.mapHome();
      go(el.dataset.go);
      return;
    }
    const pl = e.target.closest("#np-chips [data-place], #np-chips-top [data-place]");
    if (pl) { e.preventDefault(); if (SS.Pet.toRegion) SS.Pet.toRegion(pl.dataset.place); go("pet:world"); return; }
    const pb = e.target.closest("#np-pathbar [data-path]");
    if (pb && !pb.disabled) {
      if (pb.dataset.path === "back") SS.Pet.innerBack();
      else if (pb.dataset.path.startsWith("x:")) SS.Pet.extra(pb.dataset.path.slice(2));
    }
  });

  // ---- toasts --------------------------------------------------------------------------------
  SS.toast = (msg, bad) => {
    const box = $("np-toasts");
    if (!box || !msg) return;
    const el = document.createElement("div");
    el.className = "np-toast" + (bad ? " bad" : "");
    el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, bad ? 5000 : 3500);
  };

  // ---- the sandbox (Developer): the same game on its own save -------------------------------------
  NP.sandbox = async (on) => {
    sandbox = !!on;
    $("np-sandbox").checked = sandbox;
    document.body.classList.toggle("np-in-sandbox", sandbox);
    await SS.Pet.setSlot(sandbox ? "dev" : "main");
    if (!sandbox && (current === "dev:tools" || current === "dev:places")) go("pet:home");
    navSig = ""; drawNav(); drawTop();
    SS.toast(sandbox ? "Sandbox: a copy to test in — your real game is untouched." : "Back to your real game.");
  };
  $("np-sandbox").addEventListener("change", (e) => NP.sandbox(e.target.checked));
  if ($("np-menu")) $("np-menu").addEventListener("click", () => NP.setSetting("sidebar", NP.settings.sidebar === false));

  // ---- start ---------------------------------------------------------------------------------
  async function start() {
    let hello = {};
    try { hello = (await SS.Store.call("hello", [])) || {}; } catch (e) { /* a test page */ }
    if (hello.version) $("np-version").textContent = "v" + hello.version;
    sandbox = !!hello.sandbox;
    $("np-sandbox").checked = sandbox;
    document.body.classList.toggle("np-in-sandbox", sandbox);
    try { const st = await SS.Store.call("pet_settings", []); if (st && !st.error) Object.assign(NP.settings, st); } catch (e) { /* a test page */ }
    applySettings();
    // the first start of the day, after NeuroPets was fully closed: the save slots first (Cam, 2026-10-08)
    NP.welcome = !!hello.firstToday && NP.settings.dailySaves !== false && !sandbox;
    if (NP.welcome) current = "pet:saves";
    const first = current;
    await SS.Pet.mount($("np-host"), first.startsWith("shop:") ? "pet:workshop" : first, sandbox ? "dev" : "main");
    if (first.startsWith("shop:")) SS.Pet.shop(first.slice(5));
    drawNav(); drawTop();
    SS.Pet.everySecond("shell", () => { drawNav(); drawTop(); });   // one ticker for the whole game (2026-10-10, M-3)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
