  // ---- expeditions (slice 4) -------------------------------------------------------------
  // ---- the Camp and the Bestiary (2026-10-06, part 3; Cam: "the more unlocks we achieve, the better
  //      our next run is") ---------------------------------------------------------------------------
  function renderCamp(host) {
    const {s, now} = current();
    const c = Core.campView(s, now);
    host.innerHTML = `
      <div class="pp-page">
        ${paintedHTML("camp", [{key: "@forest", name: "Forest"}, {key: "camp:fire", name: "Campfire"}, {key: "camp:training", name: "Training post"},
          {key: "camp:relic", name: "Relic chest", note: `${c.relics} relic${c.relics === 1 ? "" : "s"}`}])}
        <div class="np-panel np-statstrip">${badge("Ancient relics", c.relics, "warn")}
          <span class="stamp">Found clearing the deep areas: one sometimes from the Caves, one or two from each later area. Upgrades last for every pet, through deaths.</span></div>
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <div class="pp-areas">${c.upgrades.map((u) => `
          <div class="pp-area">
            <div class="pp-skill-head"><b>${esc(u.name)}</b><span class="pp-level">${u.max > 1 ? `Level ${u.level} of ${u.max}` : u.level ? "Built" : "Not built"}</span></div>
            <div class="stamp">${esc(u.says.charAt(0).toUpperCase() + u.says.slice(1))}.</div>
            ${u.id === "phoenix" && u.level ? `<div class="stamp">${c.phoenixReady ? "Ready." : "Resting — it wakes a day after it last saved a pet."}</div>` : ""}
            ${u.level < u.max ? `<button class="btn btn-sm pp-camp" data-u="${u.id}" ${u.can ? "" : "disabled"}><img alt="" src="${itemIcon("relic", 16)}"> ${u.cost} relics</button>` : ""}
          </div>`).join("")}</div>
      </div>`;
    host.querySelectorAll(".pp-camp").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("camp", {upgrade: b.dataset.u});
      if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; }
    }));
    wirePainted(host, (k) => {                                         // the picture: back to the Forest, or the upgrades
      if (k === "@forest") { worldRegion = "forest"; return goTo("pet:world"); }
      const el = host.querySelector(".pp-areas"); if (el) el.scrollIntoView({block: "start", behavior: "smooth"});
    });
  }
  // The Bestiary: one home for every creature (V6, "Know your quarry") -- the ones you hunt (default) and the ones your pets meet
  let bestiaryTab = "hunt";
  const elName = (el) => (Core.ELEMENTS[el] || {}).name || el;
  /** What you know of a creature, as chips: "?" until your kills teach you (V6). */
  function quarryChips(k) {
    const chip = (cls, label, list, names) => list === null ? `<span class="pp-know-chip unknown" title="Beat more to learn this">${label}: ?</span>`
      : list.length ? `<span class="pp-know-chip ${cls}">${label}: ${list.map((x) => esc(names ? elName(x) : x)).join(", ")}</span>` : "";
    return chip("weak", "Weak", k.weak) + chip("resist", "Resists", k.resist) + chip("weak", "Fears", k.elWeak, true) + chip("resist", "Shrugs off", k.elResist, true);
  }
  function renderBestiary(host) {
    const {s} = current();
    const tabs = `<nav class="pp-tabs" role="tablist" aria-label="Bestiary">${[["hunt", "Your hunts"], ["pets", "Your pets' expeditions"]].map(([k, n]) =>
      `<button class="pp-tab${bestiaryTab === k ? " on" : ""}" role="tab" aria-selected="${bestiaryTab === k}" data-btab="${k}">${n}</button>`).join("")}</nav>`;
    let body;
    if (bestiaryTab === "hunt") {
      const T = Core.QUARRY.tiers;
      body = `<p class="stamp" style="margin:0 0 12px">Every creature you've beaten, ground by ground. Beat ${T.style} and you know where to hit it; ${T.resist}, what it
          shrugs off; ${T.elements}, its elements. Beat enough to <b>master</b> it: +${Math.round(Core.QUARRY.bonus.dmg * 100)}% damage and drops against it, a trophy here,
          and for some its own special drop. Ranger Ash in the Forest can tell you more.</p>
        ${Core.quarryView(s).map((g) => `<div class="pp-group"><div class="pp-label">${esc(g.name)} <span class="stamp">· level ${g.level}${g.trackWhy ? ` · tracking: ${esc(g.trackWhy.toLowerCase())}` : " · you can track one kind here"}</span></div>
          <div class="pp-beasts">${g.creatures.map((c) => { const k = c.know;
            if (!k.kills) return `<div class="pp-beast unknown"><b>???</b><div class="stamp">Not beaten yet${c.night ? " · comes out at night" : ""}${c.boss ? " · the boss" : ""}</div></div>`;
            const bar = k.mastery ? `<div class="pp-skill-bar" title="${k.kills} of ${k.mastery} for mastery"><span class="pp-skill-fill" style="width:${Math.min(100, Math.round(100 * k.kills / k.mastery))}%"></span></div>` : "";
            return `<div class="pp-beast${c.boss ? " guardian" : ""}${k.mastered ? " mastered" : ""}">
              <div class="pp-quarry-top"><img alt="" src="${monsterURL(c.id, 32)}"><b>${esc(c.name)}</b>${c.boss ? ' <span class="pp-guard-tag">Boss</span>' : ""}${k.mastered ? ' <span class="pp-guard-tag mastered">Mastered</span>' : ""}</div>
              <div class="stamp">Beaten ${k.kills.toLocaleString()}${k.mastery && !k.mastered ? ` · mastery at ${k.mastery.toLocaleString()}` : ""}${k.next && k.next < (k.mastery || Infinity) ? ` · learn more at ${k.next}` : ""}</div>
              <div class="pp-know">${quarryChips(k)}</div>${bar}
              ${c.tracked ? `<div class="pp-row"><span class="pp-need-chip">Tracking</span><button class="btn btn-sm btn-quiet" data-track="${esc(g.ground)}" data-mon="">Stop tracking</button></div>`
                : c.canTrack ? `<div class="pp-row"><button class="btn btn-sm" data-track="${esc(g.ground)}" data-mon="${esc(c.id)}" title="Hunt only ${esc(c.name.toLowerCase())}s at the ${esc(g.name)} -- a little slower between fights">Track</button></div>` : ""}
              ${k.mastered ? `<div class="stamp">Trophy won${k.drop ? ` · its <b>${esc(k.drop.name)}</b>: ${esc(k.drop.about)}` : ""}</div>`
                : k.mastery ? `<div class="stamp">Mastery brings a trophy${k.drop ? ` and now and then its ${esc(k.drop.name.toLowerCase())}` : ""}.</div>` : ""}</div>`; }).join("")}</div></div>`).join("")}`;
    } else {
      const areas = Core.bestiaryView(s);
      body = `<p class="stamp" style="margin:0 0 12px">Every creature your pets meet on expeditions. Beat one 5 times and your pets know it
          (studied: they hit it more often, and harder); 15 times and they've mastered it.</p>
        ${areas.map((a) => `<div class="pp-group"><div class="pp-label">${esc(a.name)}</div>
          <div class="pp-beasts">${a.foes.map((f) => f.met ? `
            <div class="pp-beast${f.guardian ? " guardian" : ""}"><div><b>${esc(f.name)}</b>${f.guardian ? ' <span class="pp-guard-tag">Guardian</span>' : ""}</div>
              <div class="stamp">Health ${f.hp} · Attack ${f.att} · Defence ${f.def} · hits up to ${f.maxHit}</div>
              <div class="stamp">Beaten ${f.beaten} · felled your pets ${f.felled}${f.know && f.know !== "met" ? ` · <b>${esc(f.know)}</b>` : ""}${f.toNext ? ` · ${f.toNext} more wins to ${f.beaten >= 5 ? "master" : "study"} it` : ""}</div></div>`
            : `<div class="pp-beast unknown"><b>???</b><div class="stamp">Not met yet</div></div>`).join("")}</div></div>`).join("")}`;
    }
    host.innerHTML = `<div class="pp-page">${tabs}${body}</div>`;
    host.querySelectorAll("[data-btab]").forEach((b) => b.addEventListener("click", () => { bestiaryTab = b.dataset.btab; renderBestiary(host); }));
    host.querySelectorAll("[data-track]").forEach((b) => b.addEventListener("click", async () => {   // tracking (V15)
      const r = await act("track", {ground: b.dataset.track, mon: b.dataset.mon}); if (r && r.error) toast(r.error, true); }));
  }

  // ---- Today (2026-10-07): the first screen -- what's going on, what's ready, where you left off -----------
  function renderDash(host, after) {
    everySecond("dash");
    const here = page();
    const {s, v, now} = current();
    const d = Core.dashView(s, now);
    const pic = (x, size) => x.pet && v.has ? petURL(v.species, v.colour, size, "ok", v.skin) : x.look ? avatarURL(x.look, size) : itemIcon(x.icon || "obj_map", size);
    const tile = (x, i, list) => `<button class="pp-dash-row" data-list="${list}" data-i="${i}">
        <img alt="" src="${pic(x, 32)}">
        <span class="pp-dash-text"><b>${esc(x.title)}</b>${x.sub ? `<span class="stamp">${esc(x.sub)}</span>` : ""}</span>
        ${x.endsIn ? `<span class="pp-dash-clock" data-ends="${now + x.endsIn * 1000}">${clock(x.endsIn)}</span>` : `<span class="pp-dash-go">›</span>`}
      </button>`;
    host.innerHTML = `
      <div class="pp-page pp-dash">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <section class="pp-dash-hero">
          ${v.has ? `<img class="pp-dash-pet" alt="" src="${petURL(v.species, v.colour, 96, "ok", v.skin)}">` : `<img class="pp-dash-pet" alt="" src="${itemIcon("starteregg", 96)}">`}
          <div class="pp-dash-who">
            <b>${v.has && v.name ? esc(v.name) : v.has ? "Your pet" : "No pet yet"}</b>
            <span class="stamp">${v.has && v.need ? esc(v.need) : v.has ? "Happy and well" : "Hatch the starter egg on My pet"}</span>
          </div>
          <div class="pp-dash-stats">
            <span><small>You</small><b>${esc(d.name)}</b></span>
            <span class="pp-mode-${d.mode}"><small>Mode</small><b>${esc(d.modeName)}${d.ngPlus ? ` · NG+${d.ngPlus > 1 ? d.ngPlus : ""}` : ""}</b></span>
            <span><small>Combat</small><b>${d.combat}</b></span>
            <span><small>Health</small><b>${d.hp}/${d.maxHp}</b></span>
            <span><small>Coins</small><b>${d.coins.toLocaleString()}</b></span>
            <span class="${d.bag.used > d.bag.cap ? "pp-over" : ""}"><small>Bag</small><b>${d.bag.used}/${d.bag.cap}</b></span>
          </div>
        </section>
        ${(() => { const st = d.story; if (!st) return "";      // the story (2026-10-10, audit H-4)
          return st.finished ? `<section class="pp-dash-card pp-story"><h3>${esc(st.name)}</h3><p class="stamp">Every chapter told (${st.total}/${st.total}). More of the story is coming.</p></section>`
            : `<section class="pp-dash-card pp-story">
            <h3>${st.part > 1 ? `Part ${st.part}: ` : ""}${esc(st.name)} · <span class="stamp">chapter ${st.chapter} of ${st.total}</span></h3>
            <p><b>${esc(st.title)}</b> — ${esc(st.text)}</p>
            <p class="stamp">See <b>${esc(st.person)}</b> in the <b>${esc(st.regionName)}</b>.${st.gated && st.opens.length ? ` Opens: ${esc(st.opens.join(", "))}.` : ""}</p>
            <button class="btn" data-story-region="${esc(st.region)}">Find ${esc(st.person)} on the Map</button></section>`; })()}
        <div class="pp-dash-grid">
          <section class="pp-dash-card">
            <h3>Going on now</h3>
            ${d.live.length ? d.live.map((x, i) => tile(x, i, "live")).join("") : `<p class="stamp">Nothing's running. Pick somewhere on the map, or pick up where you left off.</p>`}
            ${d.again.length ? `<h3>Pick up where you left off</h3><div class="pp-dash-again">${d.again.map((x, i) =>
              `<button class="btn" data-again="${i}">${esc(x.title)}</button>`).join("")}</div>` : ""}
            <div class="pp-dash-again"><button class="btn btn-quiet" data-jump="pet:world">Map</button><button class="btn btn-quiet" data-jump="pet:estate">Estate</button>
              <button class="btn btn-quiet" data-jump="pet:village">Village</button></div>
          </section>
          <section class="pp-dash-card">
            <h3>Ready for you</h3>
            ${d.ready.length ? d.ready.map((x, i) => tile(x, i, "ready")).join("") : `<p class="stamp">All caught up.</p>`}
          </section>
          <section class="pp-dash-card pp-dash-log">
            <h3>Lately</h3>
            ${d.log.map((e) => `<p><span class="stamp">${esc(new Date(e.at).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}))}</span> ${esc(e.text)}</p>`).join("")}
          </section>
        </div>
        ${after || ""}
      </div>`;
    const go = (x) => { if (x.region) worldRegion = x.region; goTo(x.go); };
    host.querySelectorAll(".pp-dash-row").forEach((b) => b.addEventListener("click", () => go(d[b.dataset.list][+b.dataset.i])));
    host.querySelectorAll("[data-story-region]").forEach((b) => b.addEventListener("click", () => { worldRegion = b.dataset.storyRegion; seaChart = false; goTo("pet:world"); }));
    host.querySelectorAll("[data-again]").forEach((b) => b.addEventListener("click", async () => {
      const x = d.again[+b.dataset.again];
      if (!x.act) { worldRegion = x.region || ""; seaChart = false; return goTo("pet:world"); }   // to the place, on the map (2026-10-10)
      const r = await act(x.act, Object.assign({roll: Math.random()}, x.opts));
      if (r && r.error) { status = r.error; toast(r.error, true); render(); }
    }));
    host.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.jump === "pet:world") worldRegion = ""; goTo(b.dataset.jump); }));
    everySecond("dash", () => {
      if (!host.isConnected || page() !== here) return false;
      let done = false;
      host.querySelectorAll("[data-ends]").forEach((el) => { const left = Math.ceil((+el.dataset.ends - Date.now()) / 1000); if (left <= 0) done = true; el.textContent = clock(Math.max(0, left)); });
      if (done) { render(); return false; }
    });
  }

  // ---- settings (2026-10-08, Cam: "Settings can hide the modder and new game button etc.") -- kept by pet.py
  const SETTING_ROWS = [
    ["sidebar", "Show the sidebar", "Hide it for a cleaner screen -- the ☰ button in the top bar brings it back, and Home and Map stay up there"],
    ["dailySaves", "Show the save slots on the first start of the day", "When NeuroPets has been fully closed: pick a game, or carry on"],
    ["newGame", "Show New game buttons", "On the Save slots page (and Clear)"],
    ["modder", "Show the Modder", "Making mod packs, in the sidebar"],
    ["sandbox", "Show the Sandbox switch", "The developer's copy of the game, at the foot of the sidebar"],
    ["@Accessibility"],
    ["dayNight", "Day and night on the pictures", "The outdoor pictures dim and warm with your clock in the evening and at night (fireflies come out); off: always daylight"],
    ["deepNight", "Deeper night", "A darker, duskier evening and night on the pictures (the original light); off: a gentle dusk"]];
  const SETTING_OFF = {deepNight: true, kit: true};                               // switches that start off
  function renderSettings(host) {
    const st = (window.NP && NP.settings) || {};
    // PT32 x1 (Cam: "the layout of the new UI works really good ... implement this whereever a similar UI is located"): one
    // titled card per group, as in Dev tools
    const groups = [];
    SETTING_ROWS.forEach((r) => { if (r[0].startsWith("@")) groups.push({title: r[0].slice(1), icon: "lantern", rows: []});
      else { if (!groups.length) groups.push({title: "The screen", icon: "obj_map", rows: []}); groups[groups.length - 1].rows.push(r); } });
    host.innerHTML = `
      <div class="pp-page pp-settings-page">
        ${groups.map((g) => `<section class="pp-shop pp-dev-card pp-settings"><h3><img alt="" src="${itemIcon(g.icon, 24)}">${esc(g.title)}</h3>
          ${g.rows.map(([k, name, about]) => `<label class="pp-setting"><input type="checkbox" data-setting="${k}" ${(SETTING_OFF[k] ? st[k] === true : st[k] !== false) ? "checked" : ""}>
            <span><b>${esc(name)}</b><span class="stamp">${esc(about)}</span></span></label>`).join("")}</section>`).join("")}
        <section class="pp-shop pp-dev-card"><h3><img alt="" src="${itemIcon("candle", 24)}">The tutorial</h3>
          <p class="stamp">${esc(Core.GUIDE.name)} walks you through the basics again (her gifts are only given once).</p>
          <div class="pp-dev-row"><span class="pp-dev-label">Again</span><div class="pp-dev-ctl"><button class="btn" id="pp-tutor-again">Start the tutorial</button></div></div></section>
      </div>`;
    const ta = host.querySelector("#pp-tutor-again");
    if (ta) ta.addEventListener("click", async () => { const r = await act("tutorial", {op: "restart"}); if (r && r.error) toast(r.error, true); });
    host.querySelectorAll("[data-setting]").forEach((i) => i.addEventListener("change", () => { if (window.NP && NP.setSetting) NP.setSetting(i.dataset.setting, i.checked); }));
  }

