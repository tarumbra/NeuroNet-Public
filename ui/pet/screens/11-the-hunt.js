  // ---- the hunt, your health, game over (2026-10-03) ---------------------------------------
  function monsterURL(id, size, flip) {
    if (modPics.monsters[id]) return modPics.monsters[id];
    // a painted creature (2026-10-10): stored facing left -- towards you in a fight -- so it's never mirrored
    if (window.MONSTER_PICS && window.MONSTER_PICS[id]) return "art/creatures/" + id + ".webp";
    const m = Art.monster(id);
    const c = document.createElement("canvas");
    const sc = Math.max(1, Math.floor(size / 16));
    c.width = c.height = 16 * sc;
    Art.draw(c.getContext("2d"), m.rows, m.pal, 0, 0, sc, !!flip);
    return c.toDataURL();
  }
  function hpBar(hp, max) {
    const pct = Math.round(100 * hp / Math.max(1, max));
    return `<div class="pp-hp${pct <= 30 ? " low" : ""}"><span class="pp-hp-fill" style="width:${pct}%"></span><span class="pp-hp-text">${hp} / ${max}</span></div>`;
  }
  // your potions (2026-10-05): what you're under, and a button for each you could drink
  function potionLine(pv, s, kind) {
    const on = (pv.brews || {})[kind];
    const can = Core.bagList(s).filter((b) => b.kind === "brew" && Core.ITEMS[b.id].brew.kind === kind);
    if (!on && !can.length) return "";
    return `<p class="stamp pp-potions">${on ? `Under ${esc(on.name.toLowerCase())}: ${esc(on.does.replace(/ for \d+ (fights|finds)$/, ""))} — ${on.left} ${kind === "combat" ? "fights" : "finds"} left (another is drunk from the bag when it wears off).` : `No ${kind === "combat" ? "combat potion" : "gathering draught"} on.`}
      ${can.map((b) => `<button class="btn btn-sm pp-drink" data-item="${b.id}" title="${esc(b.does)}">Drink ${esc(b.name.toLowerCase())} ×${b.count}</button>`).join(" ")}</p>`;
  }
  function renderHunt(host) {
    const {s, now} = current();
    const pv = Core.playerView(s, now), grounds = Core.huntsView(s);
    const heal = Core.bagList(s).filter((b) => Core.ITEMS[b.id].heal);
    const j = pv.job && pv.job.hunt ? pv.job : null;
    const den = Core.petsView(s, now).filter((p) => !p.companion);
    // Cam (2026-10-03): "Have the window on right side of the screen then to the left have the areas
    // (which will be collpased, the classes move to player menu ...)"
    const last = !j && pv.lastTrip && pv.lastTrip.hunt ? pv.lastTrip : null, sess = j || last;
    host.innerHTML = `
      <div class="pp-page">
        <div class="np-panel np-statstrip">
          ${badge("Combat", pv.combatLevel, "good")}${badge("Attack", pv.skills.attack.level)}${badge("Ranged", pv.skills.ranged.level)}${badge("Magic", pv.skills.magic.level)}
          ${badge("Defence", pv.skills.defence.level)}${badge("Hitpoints", pv.skills.hitpoints.level)}
          ${pv.worn.att || pv.worn.def ? badge("Gear", `+${pv.worn.att} / +${pv.worn.def}`, "info") : ""}
          ${badge("Class", pv.cls ? esc(Core.CLASSES[pv.cls].name) : "None", pv.cls ? "warn" : "bad")}
          <a href="#" class="pp-go-player np-link">Class &amp; stats →</a>
        </div>
        ${(() => {
          /* V16 (2026-10-19): what you woke with, and your gravestone -- said plainly while it stands */
          const f = s.lastFall, g = Core.graveView(s, now);
          if (!f || now - f.at > 60 * 60000) return g ? graveHTML(g) : "";
          const kept = Object.keys(f.kept || {}).map((k) => `${f.kept[k] > 1 ? f.kept[k] + " × " : ""}${esc(Core.ITEMS[k].name.toLowerCase())}`);
          return `<div class="pp-fell"><b>You fell to ${esc(f.by)} at the ${esc(f.where)}.</b>
            You woke by the fire ${kept.length ? `still holding ${kept.join(", ")}` : "with nothing you'd carried"}.
            ${g ? "" : f.grave ? "Your gravestone has crumbled -- the rest is gone." : ""} Your skills, pets, farm and home are safe.</div>${g ? graveHTML(g) : ""}`;
        })()}
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <div class="pp-hunt-layout">
          <div class="pp-hunt-areas">
            <div class="pp-label">Areas</div>
            ${!sess ? `
              <button class="btn" data-jump="pet:world">Map</button>` : ""}
            ${grounds.filter((g) => sess && g.id === sess.hunt).map((g) => {     // (2026-10-10 audit, H-5) only the ground you're at
              const here = j && j.hunt === g.id;
              return `<details class="pp-hunt-fold${g.open ? "" : " locked"}${here ? " here" : ""}" data-ground="${g.id}" ${openAreas.has(g.id) ? "open" : ""}>
              <summary>
                <img alt="" src="${monsterURL(g.monsters[0].id, 32)}">
                <span class="pp-fold-name"><b>${esc(g.name)}</b>
                  <span class="stamp">Combat ${g.level}${g.open ? ` · ${esc(g.boss.name)} ${g.kills}/${g.need}${g.wins ? ` · beaten ${g.wins}×` : ""}` : " · 🔒"}</span></span>
                ${here ? `<span class="pp-boost">Hunting</span>` : g.bossReady ? `<span class="pp-rarity r-special">Boss ready</span>` : ""}
              </summary>
              <div class="pp-fold-body">
                <div class="pp-row">
                  ${here ? `<span class="pp-boost">You're here</span>` : `<span class="stamp">Last hunted here — travel back on the Map to hunt again.</span>`}
                  ${den.length ? `<select class="input pp-pethunt" data-ground="${g.id}"><option value="">Send a den pet…</option>
                    ${den.map((p) => `<option value="${p.id}" ${p.level >= g.level ? "" : "disabled"}>${esc(p.name)} (level ${p.level})</option>`).join("")}</select>` : ""}
                </div>
                ${bossHTML(g)}
                <div class="pp-monsters">${g.monsters.map((m) => `<div class="pp-monster">
                    <img alt="" src="${monsterURL(m.id, 48)}"><b>${esc(m.name)}${m.when ? ` <span class="pp-when ${m.when}" title="Only comes out ${m.when === "night" ? "at night (9 pm to 5 am)" : "by day"}">${m.when === "night" ? "🌙 night" : "☀ day"}</span>` : ""}</b>
                    <span class="stamp">${m.hp} hp · attack ${m.att} · defence ${m.def} · hits with ${esc(Core.DTYPES[m.atk].toLowerCase())}${m.eva ? ` · dodges ${Math.round(m.eva * 100)}%` : ""}</span>
                    <span class="pp-wr">${Object.keys(m.weak || {}).map((k) => `<span class="pp-weak">weak: ${esc(Core.DTYPES[k].toLowerCase())}</span>`).join("")}
                      ${Object.keys(m.resist || {}).map((k) => `<span class="pp-resist">resists: ${esc(Core.DTYPES[k].toLowerCase())}</span>`).join("")}
                      ${Object.keys(m.matWeak || {}).map((k) => `<span class="pp-weak">weak to ${esc(k)}</span>`).join("")}</span>
                    <span class="pp-finds">${m.drops.map((d) => `<img alt="" title="${esc(Core.ITEMS[d].name)}" src="${itemIcon(d, 16)}">`).join("")}</span></div>`).join("")}</div>
              </div>
            </details>`; }).join("")}
            
          </div>
          <div class="pp-hunt-main">
            ${arenaHTML(pv, j, s, now)}
            ${sess ? `<div class="pp-hunt-sum">
                <span class="pp-label">${j ? "This hunt" : "Last hunt"}</span>
                <b>The ${esc(j ? j.spotName : Core.HUNTS[last.hunt].name)}</b>
                <span class="pp-wins">${sess.count} win${sess.count === 1 ? "" : "s"}</span>
                <span class="pp-finds">${Object.keys(sess.items || {}).length ? items(sess.items) : `<span class="stamp">nothing yet</span>`}</span>
                ${sess.ate ? `<span class="stamp">ate ${Object.keys(sess.ate).map((k) => `${sess.ate[k]} ${esc(Core.ITEMS[k].name.toLowerCase())}`).join(", ")}</span>` : ""}</div>` : ""}
            ${""/* (2026-10-20, Cam: the health box, the plan line, the weapon line and the companion line went -- the fight card has your
                   health, the Kit has the rest) */}
          </div>
        </div>
      </div>`;
    host.querySelectorAll(".pp-hunt-fold").forEach((d) => d.addEventListener("toggle", () => { if (d.open) openAreas.add(d.dataset.ground); else openAreas.delete(d.dataset.ground); }));
    host.querySelectorAll(".pp-go-player").forEach((a2) => a2.addEventListener("click", (e) => { e.preventDefault(); goTo("pet:skills"); }));
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } };
    host.querySelectorAll(".pp-eat").forEach((b) => b.addEventListener("click", async () => err(await act("eat", {item: b.dataset.item}))));
    host.querySelectorAll(".pp-hunt").forEach((b) => b.addEventListener("click", async () => err(await act("hunt", {ground: b.dataset.ground, roll: Math.random()}))));
    host.querySelectorAll(".pp-hunt-areas [data-jump]").forEach((b) => b.addEventListener("click", () => { worldRegion = ""; goTo(b.dataset.jump); }));
    host.querySelectorAll("[data-bm]").forEach((b) => b.addEventListener("click", () => {
      bossMode(b.dataset.bm);
      host.querySelectorAll("[data-bm]").forEach((x) => x.classList.toggle("on", x.dataset.bm === b.dataset.bm));
    }));
    host.querySelectorAll(".pp-boss-go").forEach((b) => b.addEventListener("click", async () => {
      // one click (2026-10-11, Cam: "remove the warning note which comes up when challenging the boss, that way it is a
      // single click for the player to challenge the boss") -- the rematch count is on the boss's card
      arenaMenu = "main";
      const r = await act("boss", {ground: b.dataset.ground, roll: Math.random(), manual: bossMode() === "manual"});
      if (r && r.error) err(r);
      else { const ar = document.getElementById("pp-arena"); if (ar) ar.scrollIntoView({block: "center", behavior: "smooth"}); }
    }));
    host.querySelectorAll(".pp-pethunt").forEach((sel) => sel.addEventListener("change", async () => {
      if (sel.value) err(await act("pethunt", {id: sel.value, ground: sel.dataset.ground, roll: Math.random()}));
    }));
    clearInterval(huntTimer);
    const sig = (p2, c) => [p2.dead ? 1 : 0, p2.job && p2.job.hunt ? p2.job.hunt : "", p2.battle ? p2.battle.start : 0,
      c.s.lastBoss && c.now - c.s.lastBoss.at < 12000 ? c.s.lastBoss.at : 0].join("|");
    let shape = sig(pv, {s, now}), fightAt = j && j.fight ? j.fight.at : 0, tick = 0;
    if (host.querySelector("#pp-arena")) arenaWire(host, pv);
    updateArena(host, s, pv, now);
    huntTimer = setInterval(() => {
      if (!host.isConnected || page() !== "pet:hunt") { clearInterval(huntTimer); return; }
      const c = current(), p2 = Core.playerView(c.s, c.now);
      // a fight began or ended, a hunt or a boss: build the page again
      if (sig(p2, c) !== shape) {
        const f2 = p2.job && p2.job.fight;
        // let the creature faint on screen first
        if (!(f2 && f2.at !== fightAt && c.now - f2.at < 1600 && !p2.battle)) return render();
      }
      updateArena(host, c.s, p2, c.now);
      if (++tick % 4) return;                                        // the health and special bars: once a second
      const hb = host.querySelector("#pp-hp-box"); if (hb) hb.innerHTML = hpBar(p2.hp, p2.maxHp);
      const sb = host.querySelector("#pp-spec-box"); if (sb) sb.style.width = p2.spec + "%";
    }, 250);                                                         // 4 a second (audit OPT-2, 2026-10-13; was 10): still smooth
  }
  let huntTimer = 0;
  const openAreas = new Set();                     // the Hunting page's open areas, kept as it redraws

  // each area's boss: how close you are, what it's like, what beating it unlocks
  function bossHTML(g) {
    const b = g.boss, pct = Math.min(100, Math.round(100 * g.kills / g.need));
    return `<div class="pp-boss">
      <img alt="" src="${monsterURL(b.id, 64)}">
      <div class="pp-boss-main">
        <div><b>${esc(b.name)}</b> <span class="pp-rarity r-special">Boss</span>${g.wins ? ` <span class="stamp">beaten ${g.wins}×</span>` : ""}</div>
        <div class="stamp">${b.hp} hp · attack ${b.att} · defence ${b.def} · hits with ${esc(Core.DTYPES[b.atk].toLowerCase())}${b.eva ? ` · <b>dodges ${Math.round(b.eva * 100)}%</b>` : ""}</div>
        <span class="pp-wr" style="justify-content:flex-start">${Object.keys(b.weak || {}).map((k) => `<span class="pp-weak">weak: ${esc(Core.DTYPES[k].toLowerCase())}</span>`).join("")}
          ${Object.keys(b.resist || {}).map((k) => `<span class="pp-resist">resists: ${esc(Core.DTYPES[k].toLowerCase())}</span>`).join("")}</span>
        <div class="pp-finds">${b.drops.map((d) => `<img alt="" title="${esc(Core.ITEMS[d].name)}" src="${itemIcon(d, 16)}">`).join("")}</div>
        ${b.unlocks.map((u) => `<div class="stamp">${u.done ? "✓" : `${Math.min(g.wins, u.wins)}/${u.wins}`} — ${esc(u.pet)} from ${esc(u.egg.toLowerCase())}s</div>`).join("")}
        ${Core.bossGearSet(g.id).length ? `<div class="stamp">${g.wins >= Core.BOSS_GEAR_WINS ? "✓" : `${g.wins}/${Core.BOSS_GEAR_WINS}`} — ${esc(b.name)}'s armour and weapons can be made</div>` : ""}
        <div class="pp-npc-level"><span class="pp-bar"><span style="width:${pct}%"></span></span><span class="stamp">${g.kills}/${g.need} kills to challenge${g.unlocked ? " (a rematch)" : ` (the first time; then ${g.rematch} a rematch)`}</span></div>
        <button class="btn btn-sm ${g.bossReady ? "btn-primary" : ""} pp-boss-go" data-ground="${g.id}" ${g.bossReady ? "" : "disabled"}>Challenge ${esc(b.name)}</button>
        <span class="pp-bossmode" role="group" aria-label="How the fight is played" title="Auto: the fight plays itself. Manual: each round waits for your move.">
          <button class="pp-bm ${bossMode() === "auto" ? "on" : ""}" data-bm="auto">Auto</button><button class="pp-bm ${bossMode() === "manual" ? "on" : ""}" data-bm="manual">Manual</button></span>
      </div></div>`;
  }
  /** Your gravestone while it stands: where, how long, what's in it, and Open (half of what's inside) -- V16. */
  function graveHTML(g) {
    const m = Math.ceil(g.leftMs / 60000);
    return `<div class="pp-fell pp-grave"><b>Your gravestone at the ${esc(g.where)}</b> · ${m} minute${m === 1 ? "" : "s"} before it crumbles
      <div class="pp-needs">${g.coins ? `<span class="pp-need-chip">${g.coins.toLocaleString()} coins</span>` : ""}${g.items.slice(0, 12).map((x) => `<span class="pp-need-chip" title="${esc(x.name)}"><img alt="" src="${itemIcon(x.id, 16)}">${x.n}</span>`).join("")}${g.items.length > 12 ? `<span class="stamp">and ${g.items.length - 12} more</span>` : ""}</div>
      ${g.here ? `<button class="btn btn-sm btn-primary" id="pp-grave-open">Open it · ${g.fee.toLocaleString()} coins</button> <span class="stamp">half of what's inside</span>`
        : `<span class="stamp">It's on ${g.isle ? "another island" : "the main island"} -- go there to open it (${g.fee.toLocaleString()} coins).</span>`}</div>`;
  }
  /** The Hunting page's one line of your plan (C4 D1, 2026-10-16: the plan and how you fight have one home, the
   *  Character sheet's Combat tab -- the Hunting page had them all again). */

  // your attack style and special (Cam: "from here i can select a default attack to use or a
  // special attack")
  // (PT38 q1, 2026-10-20, Cam: yes -- the hunt plan's one home is the Kit's Combat tab: quick slots, traps and nets, the bash;
  //  the Character sheet's copy of it went)
  // the Hunter's traps and nets in the plan (Battle Re-work Part 4; Cam's Q1: "net creatures above Y")
  function toolPlanHTML(tp, row) {
    if (!tp || !tp.can) return "";
    const pick = (cls, list, on, kind) => `<select class="input ${cls}" aria-label="Which ${kind}"><option value="">your cheapest ${kind}</option>
        ${list.map((x) => `<option value="${x.id}" ${on === x.id ? "selected" : ""}>${esc(x.name)} (×${x.count})</option>`).join("")}</select>`;
    return row("Use them on", `<select class="input pp-toolson" aria-label="Which creatures get traps and nets">
                <option value="tough" ${tp.toolsOn === "tough" ? "selected" : ""}>dangerous creatures only</option>
                <option value="all" ${tp.toolsOn === "all" ? "selected" : ""}>every creature</option></select>`, `Dangerous: a boss, or a creature whose best blow ${tp.toughBlows} times would finish you. On easy creatures a trap only costs your first blow.`)
      + row("Trap", `<label><input type="checkbox" class="pp-trapopen" ${tp.trapOpen ? "checked" : ""}> as each fight opens</label> ${pick("pp-trapwhich", tp.traps, tp.trap, "trap")}`, `The trap costs your first attack (not with Ambush). ${tp.perFight > 1 ? "Two traps a fight." : "One trap a fight."}`)
      + row("Net", `<span class="stamp">when it's above</span> <select class="input pp-netabove" aria-label="Throw a net above">
                ${tp.above.map((r) => `<option value="${r}" ${Math.abs(tp.netAbove - r) < 0.001 ? "selected" : ""}>${r ? Math.round(r * 100) + "%" : "never"}</option>`).join("")}</select> ${pick("pp-netwhich", tp.nets, tp.net, "net")}`, "Once a fight, when the creature isn't already caught. A net (or a bear trap) is picked up again after a win -- a snare is spent.")
      + (!tp.traps.length && !tp.nets.length ? `` : "");
  }
  /** Wire the plan's and fighting style's controls in `host` (the Hunting page and the Combat tab). */
  function wirePlan(host, err) {
    const on = (sel, ev, f) => { const el = host.querySelector(sel); if (el) el.addEventListener(ev, f); };
    on(".pp-retreat", "change", async (e) => err(await act("settings", {retreat: +e.target.value})));
    host.querySelectorAll(".pp-quickpick").forEach((sel) => sel.addEventListener("change", async () => err(await act("quick", {op: "set", i: +sel.dataset.i, item: sel.value}))));   // V16
    on(".pp-toolson", "change", async (e) => err(await act("toolplan", {toolsOn: e.target.value})));
    on(".pp-bashauto", "change", async (e) => err(await act("bashplan", {on: e.target.checked})));
    on(".pp-trapopen", "change", async (e) => err(await act("toolplan", {trapOpen: e.target.checked})));
    on(".pp-netabove", "change", async (e) => err(await act("toolplan", {netAbove: +e.target.value})));
    on(".pp-trapwhich", "change", async (e) => err(await act("toolplan", {trap: e.target.value})));
    on(".pp-netwhich", "change", async (e) => err(await act("toolplan", {net: e.target.value})));
    host.querySelectorAll(".pp-drink").forEach((b) => b.addEventListener("click", async () => err(await act("drink", {item: b.dataset.item}))));
    host.querySelectorAll(".pp-class-guild").forEach((b) => b.addEventListener("click", () => goTo("pet:guild")));
    host.querySelectorAll(".pp-style").forEach((b) => b.addEventListener("click", async () => err(await act("combat", {style: b.dataset.style}))));
    on(".pp-special", "change", async (e) => err(await act("combat", {special: e.target.value})));
    host.querySelectorAll("[data-speccat]").forEach((b) => b.addEventListener("click", async () => {   // V18: on or off your side bar
      const {s, now} = current(), lo = Core.playerView(s, now).specLoadout.slice(), id = b.dataset.speccat, i = lo.indexOf(id);
      if (i >= 0) lo.splice(i, 1); else if (lo.length >= Core.SPECIALS.max) return toast(`Your side bar holds ${Core.SPECIALS.max} specials -- take one off first.`, true); else lo.push(id);
      err(await act("combat", {loadout: lo}));
    }));
    const pack = () => (current().s.player.combat || {}).pack || [];          // a Beast Master's pack (Part 11b)
    host.querySelectorAll("[data-packadd]").forEach((b) => b.addEventListener("click", async () => err(await act("pack", {ids: pack().concat([b.dataset.packadd])}))));
    host.querySelectorAll("[data-packoff]").forEach((b) => b.addEventListener("click", async () => err(await act("pack", {ids: pack().filter((x) => x !== b.dataset.packoff)}))));
    host.querySelectorAll("[data-packup]").forEach((b) => b.addEventListener("click", async () => { const p = pack(), i = p.indexOf(b.dataset.packup); if (i > 0) { [p[i - 1], p[i]] = [p[i], p[i - 1]]; err(await act("pack", {ids: p})); } }));
  }
  /** A Beast Master's pack (Part 11b): who fights, in order, and who waits on the bench. */
  function packPlanHTML(pp) {
    const inPack = pp.pack.map((id) => pp.beasts.find((x) => x.id === id)).filter(Boolean), out = pp.beasts.filter((x) => x.inPack < 0);
    const row = (x, i) => `<div class="pp-recipe${x.resting ? " short" : ""}"><div class="pp-recipe-main"><b>${i < pp.size ? (i === 0 ? "Front: " : "Fights: ") : "Bench: "}${esc(x.name)}</b>
        <span class="stamp">${esc(x.type)} · level ${x.level} · ${x.hp}/${x.maxHp}${x.resting ? " · resting" : ""}</span></div>
        <span class="pp-place-btns">${i ? `<button class="btn btn-sm btn-quiet" data-packup="${esc(x.id)}" title="Move up">↑</button>` : ""}<button class="btn btn-sm btn-quiet" data-packoff="${esc(x.id)}">Leave out</button></span></div>`;
    return `<div class="pp-label">Your pack</div>
      
      ${inPack.length ? inPack.map(row).join("") : `<p class="stamp"><b>Nobody in your pack</b> -- add a battle pet below.</p>`}
      ${out.length ? `<div class="pp-row">${out.map((x) => `<button class="btn btn-sm" data-packadd="${esc(x.id)}" ${inPack.length >= pp.size + pp.bench ? "disabled" : ""}>+ ${esc(x.name)} (${esc(x.type)}, ${x.level})</button>`).join("")}</div>` : pp.beasts.length ? "" : `<p class="stamp">No battle pets yet -- a new pet can go to the Beast Pen when it hatches.</p>`}`;
  }
  // the specials catalogue (V18, 2026-10-20, Cam: "the skills that you want to appear on the combat side bar screen can be adjusted
  // from a catalogue in the player screen under combat"): every special, an icon and its level, greyed until it's yours; a click
  // puts it on the Kit's side bar or takes it off (SPECIALS.max of them)
  /** A special's painted icon (spec_<id>, Cam's sheets 113-114), else its stand-in (the class book, the weapon). */
  function specIcon(id, standIn, size) { return itemIcon(window.PET_ICONS && window.PET_ICONS["spec_" + id] ? "spec_" + id : standIn || "tome", size); }
  function specCatalogueHTML(pv) {
    const all = pv.specCatalogue || [], on = pv.specLoadout || [];
    const cell = (x) => `<button class="pp-bcell pp-speccell${x.lock ? " lock" : ""}${x.on ? " on" : ""}" data-speccat="${esc(x.id)}" ${x.lock ? "disabled" : ""}
        title="${esc(x.name)} (${esc(x.from)}) -- ${esc(x.about)} ${x.cost}${pv.fury ? " " + esc(pv.meter) : "%"}${x.lock ? " -- " + esc(x.lock) : x.on ? " -- on your side bar" : ""}">
        <img alt="" src="${specIcon(x.id, x.icon, 48)}">${x.level ? `<span class="lv">${x.level}</span>` : ""}<span class="pp-specname">${esc(x.name)}</span></button>`;
    const group = (kind, title) => { const l = all.filter((x) => x.kind === kind); return l.length ? `<div class="pp-label">${title}</div><div class="pp-specgrid">${l.map(cell).join("")}</div>` : ""; };
    return `<div class="pp-label">Specials <span class="stamp">${on.length}/${Core.SPECIALS.max} on your side bar</span></div>
      ${pv.cls ? group("class", esc(Core.CLASSES[pv.cls].name)) : ""}${group("weapon", "Weapons")}${group("signature", "Signature weapons")}`;
  }
  function combatHTML(pv) {
    const cls = pv.cls ? Core.CLASSES[pv.cls] : null;
    const specials = cls ? cls.specials : {};
    const typeList = (t) => Object.keys(t || {}).map((k) => Core.DTYPES[k].toLowerCase()).join(", ") || "nothing";
    return `<div class="pp-trip">
      ${pv.packPlan ? packPlanHTML(pv.packPlan) : `<div class="pp-label">How you fight</div>
      <div class="pp-row">${Object.keys(Core.STYLES).map((k) => `<button class="btn btn-sm pp-style${pv.combat.style === k ? " on" : ""}" data-style="${k}"
          title="${esc(Core.STYLES[k].about)}">${esc(Core.STYLES[k].name)}</button>`).join("")}
        <span class="stamp">${esc(Core.STYLES[pv.combat.style] ? Core.STYLES[pv.combat.style].about : "")}</span></div>`}
      ${cls ? specCatalogueHTML(pv) + `
        ${pv.fury ? ``
          : `${pv.combat.special && specials[pv.combat.special] ? `` : ""}
        <div class="pp-row"><span class="stamp">Special bar</span><span class="pp-bar pp-spec"><span id="pp-spec-box" style="width:${pv.spec}%"></span></span>
          <span class="stamp">+10 a fight</span></div>`}
        ${pv.paladin ? `<p class="stamp">${pv.bless ? `Your blade is blessed — ${pv.bless.left} hits left (more against the undead).` : "Bless your blade with holy water from your bag (open it, then <b>Bless your blade</b>)."}</p>` : ""}
        ${pv.canCoat ? `<p class="stamp">${pv.coat ? `Your blades: <b>${esc(pv.coat.name)}</b> — ${pv.coat.left} hits left. (Throwing knives carry it too.)` : "Your blades are clean — coat them from a poison in your bag (open it, then <b>Coat your blades</b>)."}</p>` : ""}
        `
      : `<p class="stamp">Choose a class at the Guild hall in the Village for special attacks.</p>`}
    </div>`;
  }
  // the gravestone's Open button, wherever it shows (the Hunting page, the top bar) -- V16
  document.addEventListener("click", async (e) => {
    const b = e.target.closest && e.target.closest("#pp-grave-open, [data-graveopen]"); if (!b) return;
    e.preventDefault(); const r = await act("grave", {op: "open"}); if (r) toast(r.error || r.msg, !!r.error);
  });
