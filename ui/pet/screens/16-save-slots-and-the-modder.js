  // ---- save slots and new games (2026-10-07, Cam: "3 save slots to play different characters at a time" ... "3
  //      different game modes" ... "a new game plus mode which gets unlocked when you beat the last boss") ----------
  let newGameSlot = 0, newGameMode = "hardcore", ngFrom = 0, ngPets = [], ngBeast = "", slotData = null, newGameMod = "";
  /** What New Game Plus brings from the finished game (Battle Re-work Part 12): the class's gift, its points, the
   *  techniques, the prestige mark -- and, for a Beast Master, which battle pet comes back. */
  function legacyHTML(L) {
    if (!L) return "";
    const items = Object.keys(L.items).map((k) => `${Core.ITEMS[k] ? esc(Core.ITEMS[k].name) : esc(k)}${L.items[k] > 1 ? ` ×${L.items[k]}` : ""}`);
    return `<div class="pp-label">Your legacy</div>
      <ul class="pp-legacy">
        ${L.cls ? `<li>Your highest class: <b>${esc(L.name)} level ${L.level}</b>${items.length ? ` -- ${items.join(", ")}` : ""}.</li>` : `<li class="stamp">No class in that game, so no class gift.</li>`}
        ${L.points ? `<li><b>${L.points} free talent point${L.points === 1 ? "" : "s"}</b> whenever you're ${esc(L.name === "Arcane" ? "an Arcane" : "a " + L.name)} (one for every 10 levels you had).</li>` : ""}
        ${L.beast ? (L.beasts.length ? `<li>A battle pet from your old Pen, back at battle level ${L.battleLevel}:
            <select class="input" id="pp-ng-beast">${L.beasts.map((b) => `<option value="${esc(b.id)}" ${ngBeast === b.id ? "selected" : ""}>${esc(b.name)} (battle level ${b.level})</option>`).join("")}</select></li>`
          : `<li class="stamp">Your old Pen was empty, so no battle pet comes with you.</li>`) : ""}
        ${(L.oldClasses || []).length ? `<li>The weapons and armour of every class you levelled: <b>${L.oldClasses.map((c) => esc(c.name)).join(", ")}</b> -- change how you fight mid-hunt.</li>` : ""}
        ${L.techs.length ? `<li>Your techniques: ${L.techs.map((t) => esc(t.name)).join(", ")}.</li>` : ""}
        <li>Prestige mark ${L.marks}${L.marks >= L.freeRespecAt ? " -- one respec a game is free" : ` (at ${L.freeRespecAt}, one respec a game is free)`}.</li>
      </ul>`;
  }
  async function renderSaves(host) {
    if (slot === "dev") { host.innerHTML = `<div class="pp-page"><p class="stamp">Save slots are for your real game, not the sandbox.</p></div>`; return; }
    if (!slotData) {
      host.innerHTML = `<div class="pp-page"><p class="stamp">Opening your saves…</p></div>`;
      const r = await call("pet_slots", [], "Reading your saves");
      slotData = r && !r.error ? r : {active: 1, slots: [states.main, null, null]};
      const ms = await call("pet_mods", [], "Reading your mod packs");
      slotData.mods = Array.isArray(ms) ? ms : [];
      if (page() === "pet:saves") renderSaves(host);
      return;
    }
    const now = Date.now(), sums = slotData.slots.map((st) => Core.slotSummary(st, now));
    const ngSources = sums.map((x, i) => x && x.ngUnlocked ? i + 1 : 0).filter(Boolean);
    const when = (t) => t ? new Date(t).toLocaleString([], {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}) : "";
    const showNewGame = !(window.NP && NP.settings && NP.settings.newGame === false);
    const card = (x, i) => { const n = i + 1, on = n === slotData.active;
      return `<section class="pp-slot-card${on ? " on" : ""}">
        <div class="pp-label">Slot ${n}${on ? " · playing" : ""}</div>
        ${x ? `<b class="pp-slot-name">${esc(x.name)}</b>
            <div><span class="pp-mode-tag pp-mode-${x.mode}">${esc(x.modeName)}</span>${x.ngPlus ? ` <span class="pp-mode-tag ng">New Game Plus${x.ngPlus > 1 ? " " + x.ngPlus : ""}</span>` : ""}${x.dead ? ` <span class="pp-mode-tag dead">Died</span>` : ""}</div>
            <div class="stamp">Combat ${x.combat} · total level ${x.total} · ${coinTxt(x.coins)}${x.pet ? ` · ${esc(x.pet)}` : ""}</div>
            <div class="stamp">${x.mod ? `Mod pack: ${esc(x.mod)} · ` : ""}${x.ngUnlocked ? "★ Basilisk beaten: New Game Plus unlocked · " : ""}last played ${esc(when(x.last))}</div>`
          : `<p class="stamp">${slotData.slots[i] && !on ? "A game not started yet" : on ? "A new game -- make your character on the Player page" : "Empty"}</p>`}
        <div class="pp-place-btns">
          ${!on && x ? `<button class="btn btn-sm btn-primary" data-play="${n}">Play</button>` : ""}
          ${showNewGame ? `<button class="btn btn-sm" data-new="${n}">New game</button>` : ""}
          ${slotData.slots[i] ? `<button class="btn btn-sm btn-quiet pp-slot-delete" data-clear="${n}" title="${on ? "Delete this game and start afresh here (with the tutorial)" : "Delete this game"}">Delete</button>` : ""}
        </div>
      </section>`; };
    const src = ngFrom && sums[ngFrom - 1], cur = sums[slotData.active - 1];
    // the first start of the day (2026-10-08, Cam: "Happy for save slots to appear when first opening the game for the day")
    const welcome = window.NP && NP.welcome;
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${welcome ? `<section class="pp-shop pp-welcome"><div><b>${new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}!</b>
            <span class="stamp">Which game today?</span></div>
            <button class="btn btn-primary" id="pp-carry-on">Carry on${cur ? ` with ${esc(cur.name)}` : ""}</button></section>` : ""}
        <div class="pp-slots">${sums.map(card).join("")}</div>
        ${newGameSlot ? `<section class="pp-shop pp-newgame">
          <b>A new game in slot ${newGameSlot}</b>
          ${slotData.slots[newGameSlot - 1] && sums[newGameSlot - 1] ? `<p class="pp-over">This replaces ${esc(sums[newGameSlot - 1].name)}'s game in slot ${newGameSlot}.</p>` : ""}
          <div class="pp-label">Mod pack</div>
          <select class="input" id="pp-ng-mod"><option value="">None -- the game as it is</option>${(slotData.mods || []).map((m) => `<option value="${esc(m.id)}" ${newGameMod === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>
          <div class="pp-modes">${Object.keys(Core.MODES).map((k) => `<label class="pp-mode-pick${newGameMode === k ? " on" : ""}">
              <input type="radio" name="pp-mode" value="${k}" ${newGameMode === k ? "checked" : ""}><b>${esc(Core.MODES[k].name)}</b><span class="stamp">${esc(Core.MODES[k].about)}</span></label>`).join("")}</div>
          ${ngSources.length ? `<div class="pp-label">New Game Plus</div>
            
            <select class="input" id="pp-ng-from"><option value="0">No -- a plain new game</option>${ngSources.map((n) => `<option value="${n}" ${ngFrom === n ? "selected" : ""}>From slot ${n}: ${esc(sums[n - 1].name)}</option>`).join("")}</select>
            ${src ? `<div class="pp-ng-pets">${src.pets.map((p) => `<label class="pp-need-chip${ngPets.includes(p.id) ? "" : " lack"}"><input type="checkbox" data-pet="${p.id}" ${ngPets.includes(p.id) ? "checked" : ""}
                ${!ngPets.includes(p.id) && ngPets.length >= 3 ? "disabled" : ""}> ${esc(p.name)} (${esc(p.kind)}, level ${p.level})</label>`).join("")}</div>
              <p class="stamp">${ngPets.length}/3 pets chosen.</p>${legacyHTML(src.legacy)}` : ""}` : `<p class="stamp">Beat the Basilisk (the Jungle's boss) in any slot to unlock New Game Plus.</p>`}
          <div class="pp-place-btns"><button class="btn btn-primary" id="pp-ng-go">Start</button><button class="btn btn-quiet" id="pp-ng-cancel">Cancel</button></div>
        </section>` : ""}
      </div>`;
    const reload = async () => { slotData = null; renderSaves(host); };
    const co = host.querySelector("#pp-carry-on");
    if (co) co.addEventListener("click", () => { NP.welcome = false; goTo("pet:estate"); });
    host.querySelectorAll("[data-play]").forEach((b) => b.addEventListener("click", async () => {
      const r = await call("pet_switch", [+b.dataset.play], "Switching games");
      if (!r || r.error) { toast((r && r.error) || "Couldn't switch.", true); return; }
      states.main = r; slotData = null; status = ""; if (window.NP) NP.welcome = false; toast(`Playing slot ${b.dataset.play}.`); goTo("pet:estate");
      checkpoint("main").then(() => render());        // a game left running for days: settle it once (OPT-1)
    }));
    host.querySelectorAll("[data-new]").forEach((b) => b.addEventListener("click", () => { newGameSlot = +b.dataset.new; ngFrom = 0; ngPets = []; renderSaves(host); }));
    // delete a save (2026-10-11, Cam: "Also need an ability to delete saves"): any slot, the one being played too -- that
    // one starts afresh, with the tutorial. Asked twice; the file before it is kept as a .bak.
    host.querySelectorAll("[data-clear]").forEach((b) => b.addEventListener("click", async () => {
      const n = +b.dataset.clear, name = sums[n - 1] ? sums[n - 1].name : `slot ${n}`;
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = `Delete ${name}'s game — sure?`; b.classList.add("pp-over"); return; }
      if (n === slotData.active) {
        const r = await call("pet_newgame", [n, Core.newGame({mode: (sums[n - 1] && sums[n - 1].mode) || newGameMode}, Date.now())], "Deleting the game");
        if (!r || r.error) { toast((r && r.error) || "Couldn't delete it.", true); return; }
        states.main = r; tutorStarted.delete("main"); slotData = null; status = "";
        toast(`${name}'s game is deleted -- a fresh start in slot ${n}.`); goTo("pet:home"); return;
      }
      const r = await call("pet_clearslot", [n], "Deleting the game");
      if (r && r.error) toast(r.error, true); else toast(`${name}'s game in slot ${n} is deleted.`);
      reload();
    }));
    host.querySelectorAll('input[name="pp-mode"]').forEach((i) => i.addEventListener("change", () => { newGameMode = i.value; renderSaves(host); }));
    const nm = host.querySelector("#pp-ng-mod");
    if (nm) nm.addEventListener("change", () => { newGameMod = nm.value; });
    const nf = host.querySelector("#pp-ng-from");
    if (nf) nf.addEventListener("change", () => { ngFrom = +nf.value; ngPets = []; ngBeast = ""; renderSaves(host); });
    const nb = host.querySelector("#pp-ng-beast");
    if (nb) nb.addEventListener("change", () => { ngBeast = nb.value; });
    host.querySelectorAll("[data-pet]").forEach((c) => c.addEventListener("change", () => {
      const id = c.dataset.pet; ngPets = c.checked ? ngPets.concat([id]).slice(0, 3) : ngPets.filter((x) => x !== id); renderSaves(host); }));
    const cancel = host.querySelector("#pp-ng-cancel");
    if (cancel) cancel.addEventListener("click", () => { newGameSlot = 0; renderSaves(host); });
    const go = host.querySelector("#pp-ng-go");
    if (go) go.addEventListener("click", async () => {
      const from = ngFrom ? slotData.slots[ngFrom - 1] : null;
      if (from && ngPets.length !== 3 && sums[ngFrom - 1].pets.length >= 3) { toast("Choose three pets to bring.", true); return; }
      let mod = null;
      if (newGameMod) { const m = await call("pet_mod_load", [newGameMod], "Reading the mod pack"); if (m && !m.error) mod = Core.cleanMod(m); }
      const st = Core.newGame({mode: newGameMode, from, pets: ngPets, beast: ngBeast, mod}, Date.now());
      const r = await call("pet_newgame", [newGameSlot, st], "Starting a new game");
      if (!r || r.error) { toast((r && r.error) || "Couldn't start it.", true); return; }
      states.main = r; toast(`A new ${Core.MODES[newGameMode].name} game in slot ${newGameSlot}.`);
      newGameSlot = 0; slotData = null; status = ""; goTo("pet:skills");
    });
  }

  // ---- the modder (2026-10-07, Cam: "an inbuilt modders tool where assets can be changed, custom backgrounds for maps
  //      and custom icons can be placed into the game, rates can be changed. These can then be saved and when starting
  //      a new game you should be able to select a mod pack ... A pet modder as well where you can change the color of
  //      pets, their bonus and add or remove buffs. Neuronet already has a tool to handle that.") -- pictures come from
  //      a PNG, or from NeuroNet's Assets (Creative -> Pixel art, saved as a Game asset) -------------------------------
  let modList = null, modDoc = null, modTab = "rates", modKind = "items", modQuery = "", modPet = "cat";
  const PIC_KINDS = {items: "Items", monsters: "Creatures", regions: "Regions and the map"};
  function picEntries(kind) {
    if (kind === "items") return Object.keys(Core.ITEMS).map((id) => ({id, name: Core.ITEMS[id].name, icon: itemIcon(id, 32)}));
    if (kind === "monsters") return Object.keys(Core.MONSTERS).map((id) => ({id, name: Core.MONSTERS[id].name, icon: monsterURL(id, 32)}));
    return [{id: "worldmap", name: "The world map (background)", icon: itemIcon("obj_map", 32)}, {id: "seachart", name: "The sea chart (background)", icon: itemIcon("obj_map", 32)}].concat(Core.REGION_ORDER.filter((r) => r !== "village")
      .map((r) => ({id: r, name: Core.REGIONS[r].name + " (scene)", icon: itemIcon("obj_map", 32)})));
  }
  async function renderModder(host) {
    if (!modList) {
      host.innerHTML = `<div class="pp-page"><p class="stamp">Opening the modder…</p></div>`;
      const r = await call("pet_mods", [], "Reading your mod packs");
      modList = Array.isArray(r) ? r : [];
      if (page() === "pet:modder") renderModder(host);
      return;
    }
    if (!modDoc) {
      host.innerHTML = `
        <div class="pp-page">
          <p class="stamp" style="margin:0 0 12px">A mod pack changes the game's rates, its pictures (items, creatures, the regions' scenes, the world map)
            and its pets (colours, companion buffs). Pick one when you start a new game in <b>Save slots</b> -- a game keeps the pack it began with.
            Draw pictures in NeuroNet (Creative → Pixel art) and save them as <b>Game assets</b>: they're offered here.</p>
          <div class="pp-slots">${modList.map((m) => `<section class="pp-slot-card">
              <b class="pp-slot-name">${esc(m.name)}</b>
              ${m.about ? `<div class="stamp">${esc(m.about)}</div>` : ""}
              <div class="stamp">${Object.keys(m.rates).length ? Object.keys(m.rates).map((k) => `${esc((Core.MOD_RATES[k] || k))} ×${m.rates[k]}`).join(" · ") : "Rates as they are"}
                · ${m.pictures} picture${m.pictures === 1 ? "" : "s"} · ${m.pets} kind${m.pets === 1 ? "" : "s"} of pet changed</div>
              <div class="pp-place-btns"><button class="btn btn-sm btn-primary" data-edit="${esc(m.id)}">Edit</button>
                <button class="btn btn-sm btn-quiet" data-del="${esc(m.id)}">Delete</button></div>
            </section>`).join("")}
            <section class="pp-slot-card"><b>A new mod pack</b><p class="stamp">Start from the game as it is.</p>
              <div class="pp-place-btns"><button class="btn btn-sm" id="pp-mod-new">New mod pack</button></div></section>
          </div>
        </div>`;
      host.querySelector("#pp-mod-new").addEventListener("click", () => { modDoc = {name: "", about: "", rates: {}, pets: {}, items: {}, monsters: {}, regions: {}}; modTab = "rates"; renderModder(host); });
      host.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", async () => {
        const m = await call("pet_mod_load", [b.dataset.edit], "Opening the mod pack");
        if (!m || m.error) { toast((m && m.error) || "Couldn't open it.", true); return; }
        modDoc = Object.assign({rates: {}, pets: {}, items: {}, monsters: {}, regions: {}}, m); modTab = "rates"; renderModder(host);
      }));
      host.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
        if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Delete — sure?"; return; }
        const r = await call("pet_mod_delete", [b.dataset.del], "Deleting the mod pack");
        if (r && r.error) toast(r.error, true); else toast("Mod pack deleted.");
        modList = null; renderModder(host);
      }));
      return;
    }
    const d = modDoc;
    const tabs = [["rates", "Rates"], ["pictures", "Pictures"], ["pets", "Pets"]];
    let body = "";
    if (modTab === "rates") {
      body = `<p class="stamp">1 is the game as it is; 2 is twice as much (or as fast); 0.5 half.</p>
        <div class="pp-mod-rates">${Object.keys(Core.MOD_RATES).map((k) => `<label class="pp-mod-rate"><span>${esc(Core.MOD_RATES[k])}</span>
          <input class="input" type="number" min="0.1" max="10" step="0.05" data-rate="${k}" value="${d.rates[k] || 1}"> <span class="stamp">×</span></label>`).join("")}</div>`;
    } else if (modTab === "pictures") {
      const q = modQuery.trim().toLowerCase(), list = picEntries(modKind).filter((e) => !q || e.name.toLowerCase().includes(q) || e.id.includes(q));
      body = `<div class="pp-place-btns">${Object.keys(PIC_KINDS).map((k) => `<button class="btn btn-sm ${modKind === k ? "btn-primary" : ""}" data-kind="${k}">${PIC_KINDS[k]}</button>`).join("")}
          <input class="input" id="pp-mod-q" type="search" placeholder="Search…" value="${esc(modQuery)}" style="max-width:240px"></div>
        <p class="stamp">${list.length > 60 ? `Showing 60 of ${list.length} -- search to narrow it. ` : ""}A PNG works best: pixel art at 16, 32 or 48 pixels for icons; a wide picture for a scene or the map.</p>
        <div class="pp-mod-pics">${list.slice(0, 60).map((e) => { const mine = d[modKind][e.id];
          return `<div class="pp-mod-pic${mine ? " set" : ""}"><img alt="" src="${mine || e.icon}"><span><b>${esc(e.name)}</b>${mine ? `<span class="stamp">your picture</span>` : ""}</span>
            <span class="pp-place-btns"><label class="btn btn-sm">PNG…<input type="file" accept="image/png,image/webp,image/gif,image/jpeg" data-up="${esc(e.id)}" hidden></label>
              <button class="btn btn-sm" data-nn="${esc(e.id)}">From NeuroNet</button>${mine ? `<button class="btn btn-sm btn-quiet" data-reset="${esc(e.id)}">Reset</button>` : ""}</span></div>`; }).join("")}</div>`;
    } else {
      const species = Object.keys(Core.SPECIES), sp = Core.SPECIES[modPet], pm = d.pets[modPet] || {};
      const buffs = Array.isArray(pm.buffs) ? pm.buffs : Core.petBuffs({}, modPet);
      const skills = Object.keys(Core.SKILLS).map((k) => [k, Core.SKILLS[k].name + " xp"]).concat(Object.keys(Core.FIGHT_BOOSTS).map((k) => [k, Core.FIGHT_BOOSTS[k] + " in a fight"]));
      body = `<div class="pp-place-btns"><select class="input" id="pp-mod-pet" style="max-width:240px">${species.map((k) => `<option value="${k}" ${k === modPet ? "selected" : ""}>${esc(Core.SPECIES[k].name)}${d.pets[k] ? " ✎" : ""}</option>`).join("")}</select></div>
        <div class="pp-label">Colours</div>
        <div class="pp-mod-pets">${sp.colours.map((c) => { const cc = (pm.colours || {})[c] || {}, base = Art.palette(modPet, c) || {};
          return `<div class="pp-mod-pic"><img alt="" src="${petURL(modPet, c, 48, "ok", Object.assign({}, cc))}"><span><b>${esc(c)}</b></span>
            <span class="pp-place-btns">${["b", "l"].filter((k) => base[k]).map((k) => `<label class="stamp">${k === "b" ? "Body" : "Light"} <input type="color" data-col="${c}" data-key="${k}" value="${cc[k] || base[k]}"></label>`).join("")}
              ${(pm.colours || {})[c] ? `<button class="btn btn-sm btn-quiet" data-colreset="${c}">Reset</button>` : ""}</span></div>`; }).join("")}</div>
        <div class="pp-label">Companion buffs ${Array.isArray(pm.buffs) ? "" : "<span class='stamp'>(its own, unchanged)</span>"}</div>
        ${buffs.map((b, i) => `<div class="pp-place-btns"><select class="input" data-buffskill="${i}" style="max-width:240px">${skills.map(([k, n]) => `<option value="${k}" ${b.skill === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
            <input class="input" type="number" min="1" max="100" step="1" data-buffamt="${i}" value="${Math.round(b.amount * 100)}" style="max-width:90px"> <span class="stamp">% (doubled while happy)</span>
            <button class="btn btn-sm btn-quiet" data-buffdel="${i}">Remove</button></div>`).join("") || `<p class="stamp">No buffs.</p>`}
        <div class="pp-place-btns"><button class="btn btn-sm" id="pp-buff-add" ${buffs.length >= 4 ? "disabled" : ""}>Add a buff</button>
          ${d.pets[modPet] ? `<button class="btn btn-sm btn-quiet" id="pp-pet-reset">Back to its own</button>` : ""}</div>`;
    }
    host.innerHTML = `
      <div class="pp-page">
        <section class="pp-shop pp-mod-head">
          <div class="pp-place-btns"><input class="input" id="pp-mod-name" placeholder="The mod pack's name" value="${esc(d.name)}" style="max-width:320px">
            <input class="input" id="pp-mod-about" placeholder="What it does (a line)" value="${esc(d.about || "")}"></div>
          <div class="pp-place-btns">${tabs.map(([k, n]) => `<button class="btn btn-sm ${modTab === k ? "btn-primary" : ""}" data-tab="${k}">${n}</button>`).join("")}
            <span style="flex:1"></span><button class="btn btn-primary" id="pp-mod-save">Save</button><button class="btn btn-quiet" id="pp-mod-close">Close</button></div>
        </section>
        <section class="pp-shop">${body}</section>
      </div>`;
    const keepText = () => { d.name = host.querySelector("#pp-mod-name").value; d.about = host.querySelector("#pp-mod-about").value; };
    const again = () => { keepText(); renderModder(host); };
    host.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { modTab = b.dataset.tab; again(); }));
    host.querySelector("#pp-mod-close").addEventListener("click", () => { modDoc = null; modList = null; renderModder(host); });
    host.querySelector("#pp-mod-save").addEventListener("click", async () => {
      keepText();
      const r = await call("pet_mod_save", [d], "Saving the mod pack");
      if (!r || r.error) { toast((r && r.error) || "Couldn't save it.", true); return; }
      d.id = r.id; toast(`Saved "${d.name}".`); modList = null;
    });
    host.querySelectorAll("[data-rate]").forEach((i) => i.addEventListener("change", () => {
      const v = Math.max(0.1, Math.min(10, Number(i.value) || 1)); if (v === 1) delete d.rates[i.dataset.rate]; else d.rates[i.dataset.rate] = v; }));
    host.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => { modKind = b.dataset.kind; modQuery = ""; again(); }));
    const mq = host.querySelector("#pp-mod-q");
    if (mq) mq.addEventListener("change", () => { modQuery = mq.value; again(); });
    host.querySelectorAll("[data-up]").forEach((inp) => inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      if (f.size > 1024 * 1024) { toast("That picture is over 1 MB -- try a smaller one.", true); return; }
      const rd = new FileReader();
      rd.onload = () => { d[modKind][inp.dataset.up] = String(rd.result); again(); };
      rd.readAsDataURL(f);
    }));
    host.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", () => { delete d[modKind][b.dataset.reset]; again(); }));
    host.querySelectorAll("[data-nn]").forEach((b) => b.addEventListener("click", () => pickGameAsset((url) => { d[modKind][b.dataset.nn] = url; again(); })));
    const ps = host.querySelector("#pp-mod-pet");
    if (ps) ps.addEventListener("change", () => { modPet = ps.value; again(); });
    const petMod = () => { d.pets[modPet] = d.pets[modPet] || {}; return d.pets[modPet]; };
    host.querySelectorAll("[data-col]").forEach((i) => i.addEventListener("change", () => {
      const pm = petMod(); pm.colours = pm.colours || {}; pm.colours[i.dataset.col] = Object.assign(pm.colours[i.dataset.col] || {}, {[i.dataset.key]: i.value}); again(); }));
    host.querySelectorAll("[data-colreset]").forEach((b) => b.addEventListener("click", () => { const pm = petMod(); if (pm.colours) delete pm.colours[b.dataset.colreset]; again(); }));
    const curBuffs = () => { const pm = petMod(); if (!Array.isArray(pm.buffs)) pm.buffs = Core.petBuffs({}, modPet).map((x) => Object.assign({}, x)); return pm.buffs; };
    host.querySelectorAll("[data-buffskill]").forEach((sel) => sel.addEventListener("change", () => { curBuffs()[+sel.dataset.buffskill].skill = sel.value; again(); }));
    host.querySelectorAll("[data-buffamt]").forEach((i) => i.addEventListener("change", () => { curBuffs()[+i.dataset.buffamt].amount = Math.max(0.01, Math.min(1, (Number(i.value) || 10) / 100)); again(); }));
    host.querySelectorAll("[data-buffdel]").forEach((b) => b.addEventListener("click", () => { curBuffs().splice(+b.dataset.buffdel, 1); again(); }));
    const ba = host.querySelector("#pp-buff-add");
    if (ba) ba.addEventListener("click", () => { curBuffs().push({skill: "foraging", amount: 0.1}); again(); });
    const pr = host.querySelector("#pp-pet-reset");
    if (pr) pr.addEventListener("click", () => { delete d.pets[modPet]; again(); });
  }
  // NeuroNet's game assets (Creative -> Pixel art): pick one for the mod pack
  async function pickGameAsset(done) {
    const list = await call("pet_game_assets", [], "Reading NeuroNet's game assets");
    const box = document.createElement("div");
    box.className = "pp-modal pp-item-sheet";
    box.innerHTML = `<div class="pp-modal-card pp-sheet" role="dialog" aria-label="NeuroNet's game assets">
        <button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
        <b>From NeuroNet's Assets</b>
        <p class="stamp">Your Game assets (Creative → Pixel art, saved as a Game asset).</p>
        <div class="pp-mod-pics">${Array.isArray(list) && list.length ? list.map((a) => `<button class="pp-mod-pic pp-asset-pick" data-id="${esc(a.id)}"><span class="pp-asset-thumb" data-thumb="${esc(a.id)}"></span>
            <span><b>${esc(a.name)}</b><span class="stamp">${a.w}×${a.h}</span></span></button>`).join("")
          : `<p class="stamp">No game assets yet -- draw one in NeuroNet (Creative → Pixel art) and save it as a Game asset.</p>`}</div>
      </div>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.querySelector(".pp-shop-x").addEventListener("click", close);
    box.querySelectorAll(".pp-asset-pick").forEach((b) => b.addEventListener("click", async () => {
      const a = await call("pet_game_asset", [b.dataset.id], "Reading the asset");
      if (!a || a.error || !a.dataUrl) { toast((a && a.error) || "Couldn't read it.", true); return; }
      close(); done(a.dataUrl);
    }));
    // the pictures, one by one (a pack can be big)
    for (const el of box.querySelectorAll("[data-thumb]")) {
      const a = await call("pet_game_asset", [el.dataset.thumb], "");
      if (a && a.dataUrl && el.isConnected) el.innerHTML = `<img alt="" src="${a.dataUrl}">`;
    }
  }

