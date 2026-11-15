  // ---- Expeditions as runs (2026-10-06): the pet's own battle stats, a pack, stages, injuries ----
  let pack = {};                       // what to carry: {item: count}
  let party = [{id: "", role: "scout"}, {id: "", role: "fighter"}];   // who goes along (2026-10-10): up to two den pets, a role each
  // the party picker (2026-10-10): two places, a den pet and a role each
  function haulers() { return party.filter((m) => m.id && m.role === "hauler").length; }
  function partyHTML(s, now) {
    const pets = Core.partyView(s, "", now);
    party.forEach((m) => { if (m.id && !pets.some((p) => p.id === m.id && !p.lock)) m.id = ""; });
    if (!pets.length) return `<div class="pp-group"><div class="pp-label">Party</div></div>`;
    const row = (m, i) => `<div class="pp-party-row">
        <select class="input pp-party-pet" data-i="${i}" aria-label="Who goes along"><option value="">Nobody</option>
          ${pets.map((p) => `<option value="${p.id}" ${m.id === p.id ? "selected" : ""} ${p.lock || party.some((o, j) => j !== i && o.id === p.id) ? "disabled" : ""}>${esc(p.name)} · level ${p.level}${p.nature ? " · " + esc(p.nature) : ""}${p.lock ? " — " + esc(p.lock.replace(p.name + " ", "")) : ""}</option>`).join("")}</select>
        <select class="input pp-party-role" data-i="${i}" aria-label="Their role">${Object.keys(Core.ROLES).map((r) => `<option value="${r}" ${m.role === r ? "selected" : ""}>${esc(Core.ROLES[r].name)}</option>`).join("")}</select>
        <span class="stamp">${esc(Core.ROLES[m.role].says)}</span></div>`;
    return `<div class="pp-group"><div class="pp-label">Party: up to ${Core.PARTY_MAX} pets from the den go along, sharing the xp</div>${party.map(row).join("")}</div>`;
  }
  function renderExpeditions(host) {
    const {s, v, now} = current();
    const areas = Core.expeditionsView(s, now);
    const inf = s.dev && s.dev.infinite;
    const why = !v.has ? ((s.graveyard || []).length ? "No companion — choose one from Pets (the den), or hatch an egg in the Hatchery." : "Hatch a pet first.")
      : v.stage === "egg" ? "Your egg hasn't hatched yet."
      : v.stage === "hatchling" ? `${v.name} can go exploring at ${Core.EXPEDITION_DAYS || 3} days old — in ${v.daysToExpeditions} day${v.daysToExpeditions === 1 ? "" : "s"}.`
      : v.away ? "" : v.injury && !v.injury.treated ? `${v.name} has ${v.injury.name} and won't heal until it's treated.`
      : v.injuredFor ? `${v.name} is healing for ${v.injuredFor} more minutes.`
      : v.asleep ? `${v.name} is asleep.` : v.sick ? `${v.name} is poorly.` : "";
    const have = (k) => inf ? 99 : (s.bag[k] || 0);
    const usable = Object.keys(s.bag).filter((k) => have(k) > 0 && Core.ITEMS[k] && (Core.ITEMS[k].heal || Core.ITEMS[k].petbrew || Core.ITEMS[k].treats));
    Object.keys(pack).forEach((k) => { if (!have(k)) delete pack[k]; else pack[k] = Math.min(pack[k], have(k), 10); });
    const kinds = Object.keys(pack).filter((k) => pack[k] > 0);
    const what = (k) => { const it = Core.ITEMS[k]; return it.petbrew ? "drunk at the start" : it.treats ? `treats ${it.treats} injuries on the spot` : `heals ${Math.round(it.heal * 1.5)}`; };
    const f = v.fight || {};
    const meds = v.injury && !v.injury.treated ? Object.keys(s.bag).filter((k) => have(k) && Core.ITEMS[k] && Core.ITEMS[k].treats
      && Core.INJURIES[Core.ITEMS[k].treats].rank >= Core.INJURIES[v.injury.sev].rank) : [];
    const awayBox = v.away ? `
      <div class="pp-trip pp-run">
        <div class="pp-label">${esc(v.name)} at the ${esc(v.away.areaName)} — stage ${Math.min(v.away.stage + 1, v.away.stages)} of ${v.away.stages}</div>
        ${(v.away.party || []).length ? `<div class="stamp">With ${v.away.party.map((m) => `${esc(m.name)} (${esc(m.role.toLowerCase())})`).join(" and ")}</div>` : ""}
        <div class="pp-runhp"><span style="width:${v.away.maxHp ? Math.round(100 * v.away.hp / v.away.maxHp) : 0}%"></span><b>${v.away.hp} / ${v.away.maxHp}</b></div>
        <ol class="pp-runlog">${(v.away.log || []).map((l) => `<li>${esc(l.text)} <small>(${l.hp} hp)</small></li>`).join("") || "<li>On the way…</li>"}</ol>
        <div class="stamp">Next stage in <span id="pp-next">${clock(v.away.backIn)}</span> · carrying ${Object.keys(v.away.pack).filter((k) => v.away.pack[k] > 0).map((k) => `${esc(Core.ITEMS[k].name)} ×${v.away.pack[k]}`).join(", ") || "nothing"}</div>
        <button class="btn btn-sm" id="pp-recall2">Call back (keeps what it found)</button>
      </div>` : "";
    const last = v.lastExp && v.lastExp.how ? `
      <div class="pp-trip"><div class="pp-label">Last expedition</div>
        <div>${esc(Core.AREAS[v.lastExp.area].name)}: ${v.lastExp.how === "cleared" ? "cleared" : v.lastExp.how === "fell" ? "fell" : v.lastExp.how === "retreated" ? "came home hurt" : "called back"}
          (${v.lastExp.reached}/${v.lastExp.stages} stages)${v.lastExp.injury ? ` — ${esc(Core.INJURIES[v.lastExp.injury].name)}` : ""} · +${v.lastExp.xp} xp</div>
        <div class="pp-finds">${items(v.lastExp.items)}</div>
        ${(v.lastExp.log || []).length ? `<ol class="pp-runlog">${v.lastExp.log.map((l) => `<li>${esc(l.text)} <small>(${l.hp} hp)</small></li>`).join("")}</ol>` : ""}</div>` : "";
    host.innerHTML = `
      <div class="pp-page">
        ${v.has && v.stage !== "egg" ? `<div class="np-panel np-statstrip">
          ${badge("Health", f.hp, "good")}${badge("Attack", f.att)}${badge("Defence", f.def)}${badge("Dodge", Math.round((f.dodge || 0) * 100) + "%")}
          <span class="stamp">${esc(v.name)}'s fighting strength: its level and kind, what it wears, how happy and fed it is.</span></div>` : ""}
        ${v.injury ? `<div class="pp-injury"><b>${esc(v.name)} has ${esc(v.injury.name)}.</b>
          ${v.injury.treated ? ` Treated — fit again in ${v.injury.healIn} minutes.`
            : ` It won't start to heal until it's treated: ${v.injury.sev === "light" ? "a herbal poultice or stronger" : v.injury.sev === "serious" ? "a healing salve or stronger" : "a strong salve or a restorative balm"} (Apothecary table, Alchemy).
              <div class="pp-row">${meds.map((k) => `<button class="btn btn-sm pp-treat" data-item="${k}"><img alt="" src="${itemIcon(k, 16)}"> ${esc(Core.ITEMS[k].name)} <span class="pp-count">${have(k)}</span></button>`).join("") || `<span class="stamp">None in the bag.</span>`}</div>`}</div>` : ""}
        ${awayBox}${last}
        ${why ? `<p class="pp-why">${esc(why)}</p>` : ""}
        ${!v.away && v.has && v.stage !== "egg" ? partyHTML(s, now) : ""}
        ${!v.away ? `<div class="pp-group"><div class="pp-label">Pack (${kinds.length} of ${Core.packSlots(s) + haulers()} kinds): food heals on the road, draughts are drunk at the start, medicine treats an injury at once</div>
          <div class="pp-row">${usable.length ? usable.map((k) => `<span class="pp-packitem${pack[k] ? " on" : ""}" title="${esc(what(k))}">
              <img alt="" src="${itemIcon(k, 16)}"> ${esc(Core.ITEMS[k].name)} <small>(${have(k)})</small>
              <button class="pp-pk" data-k="${k}" data-d="-1" ${pack[k] ? "" : "disabled"}>−</button><b>${pack[k] || 0}</b>
              <button class="pp-pk" data-k="${k}" data-d="1" ${(pack[k] || 0) >= Math.min(10, have(k)) || (!pack[k] && kinds.length >= Core.packSlots(s) + haulers()) ? "disabled" : ""}>+</button></span>`).join("")
            : `<span class="stamp">Nothing to carry yet — cooked food, draughts and salves (Kitchen and Apothecary table).</span>`}</div></div>` : ""}
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <div class="pp-areas">${areas.map((a) => a.later ? `
          <div class="pp-area later"><b>${esc(a.name)}</b><div class="stamp">Pet level ${a.level}${a.note ? ` · ${esc(a.note)}` : ""} · coming in a later update</div></div>` : `
          <div class="pp-area${a.open ? "" : " locked"}">
            <div class="pp-skill-head"><b>${esc(a.name)}</b><span class="pp-level">${a.open ? `${a.stages} stages` : `Level ${a.level}`}</span></div>
            <div class="pp-mastery" title="Area level">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= a.mastery ? "on" : ""}"></span>`).join("")}
              <small>${a.mastery >= 5 ? "Mastered" : `${a.toNextMastery} more clears to area level ${a.mastery + 1}`}</small></div>
            <div class="stamp">${a.minutes >= 60 ? (a.minutes / 60) + " h" : a.minutes + " min"} · pet level ${a.level} · ${esc(a.foes.join(", "))}; guardian: ${esc(a.guardian)}</div>
            <div class="stamp pp-danger">If ${v.has ? esc(v.name) : "your pet"} falls here: ${a.deadly
              ? `${Math.round(a.deadly * 100)}% it dies, otherwise ${esc(a.fallName)}` : esc(a.fallName)}</div>
            ${a.lock ? `<div class="stamp pp-lock">🔒 ${esc(a.lock)}</div>` : ""}
            ${a.flying && !a.canFly ? `<div class="stamp pp-lock">Only a flying pet can reach it — a chicken, a duck or a gull.</div>` : ""}
            <div class="pp-finds">${a.loot.map((k) => `<img alt="" title="${esc(Core.ITEMS[k].name)}" src="${itemIcon(k, 20)}">`).join("")}
              <img alt="" title="${esc(Core.ITEMS[a.crate].name)} (on a clear, sometimes)" src="${itemIcon(a.crate, 20)}">
              <img alt="" title="${esc(Core.ITEMS[a.egg].name)} (on a clear, rarely)" src="${itemIcon(a.egg, 20)}"></div>
            <button class="btn btn-sm pp-send" data-area="${a.id}" ${a.open && !why && !v.away ? "" : "disabled"}>Send ${v.has && v.stage !== "egg" ? esc(v.name) : ""}</button>
          </div>`).join("")}</div>
      </div>`;
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } };
    host.querySelectorAll(".pp-pk").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.k; pack[k] = Math.max(0, (pack[k] || 0) + Number(b.dataset.d)); if (!pack[k]) delete pack[k]; render();
    }));
    host.querySelectorAll(".pp-treat").forEach((b) => b.addEventListener("click", async () => err(await act("treat", {item: b.dataset.item}))));
    const rc = host.querySelector("#pp-recall2");
    if (rc) rc.addEventListener("click", () => act("recall"));
    host.querySelectorAll(".pp-send").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("expedition", {area: b.dataset.area, pack: Object.assign({}, pack), party: party.filter((m) => m.id).map((m) => ({id: m.id, role: m.role})), roll: Math.random()});
      if (r && r.error) err(r); else { pack = {}; party.forEach((m) => { m.id = ""; }); }
    }));
    host.querySelectorAll(".pp-party-pet").forEach((sel) => sel.addEventListener("change", () => { party[+sel.dataset.i].id = sel.value; render(); }));
    host.querySelectorAll(".pp-party-role").forEach((sel) => sel.addEventListener("change", () => { party[+sel.dataset.i].role = sel.value; render(); }));
    everySecond("exp");
    if (v.away) everySecond("exp", () => {
      if (!host.isConnected || page() !== "pet:expeditions") return false;
      const c = current();
      if (!c.v.away || c.v.away.stage !== v.away.stage) render();
      else { const w = host.querySelector("#pp-next"); if (w) w.textContent = clock(c.v.away.backIn); }
    });
  }

