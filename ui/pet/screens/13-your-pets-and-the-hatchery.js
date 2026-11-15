  // ---- your pets: the hatchery, the companion, the den (slice 5) -----------------------------
  // painted pets (2026-10-10, Cam's sheets; art/pets/manifest.js): a portrait for every picture of a pet, a side view for the
  // room, a sleeper for when it naps. A reskinned or mod-coloured pet keeps its pixel picture (its colours are its own).
  function paintedPet(species, colour, pose, skin) {
    if (skin || modSkin(species, colour, null)) return "";
    const p = window.PET_PICS && window.PET_PICS[species + "/" + colour];
    if (!p) return "";
    const k = p[pose] ? pose : p.a ? "a" : "";
    return k ? `art/pets/${species}-${colour}-${k}.webp` : "";
  }
  const petImgs = {};
  function petImage(src) {                                           // a loaded Image for the room's canvas
    if (!petImgs[src]) { const im = new Image(); im.src = src; petImgs[src] = im; }
    return petImgs[src].complete && petImgs[src].naturalWidth ? petImgs[src] : null;
  }
  /** A grown farm animal (2026-10-12, Cam's livestock sheets): art/livestock/<kind>-<breed>-<pose>.webp, else its young pet picture. */
  // voyage provisions (2026-10-13): a tick by every Set sail. ON by default since 2026-10-15 (Cam) -- untick it to keep
  // a contract's smoked fish; that choice is remembered.
  function provOn() { try { return localStorage.getItem("np:provisions") !== "0"; } catch (e) { return true; } }
  function provisionHTML(p) {
    return `<label class="pp-provisions stamp" title="The crew eats them on the way"><input type="checkbox" data-provisions ${provOn() ? "checked" : ""}>
      Take provisions: ${p.n} smoked fish (you have ${p.have}) -- ${p.mins} minutes instead, and you land rested</label>`;
  }
  function wireProvisions(root) {
    root.querySelectorAll("[data-provisions]").forEach((el) => el.addEventListener("change", () => { try { localStorage.setItem("np:provisions", el.checked ? "1" : "0"); } catch (e) { /* */ } }));
  }
  function livestockURL(art, pic, size, pose) {
    if (!pic) return itemIcon(art, size);                          // a bee colony: its icon (no livestock painting)
    const p = (window.LIVESTOCK_PICS || {})[art] || {};
    return p[pose || "a"] ? `art/livestock/${art.replace("/", "-")}-${pose || "a"}.webp` : petURL(pic[0], pic[1], size, "ok");
  }
  function petURL(species, colour, size, mood, skin) {
    const painted = paintedPet(species, colour, mood === "asleep" ? "sleep" : "a", skin);
    if (painted) return painted;
    const c = document.createElement("canvas");
    const sc = Math.max(1, Math.floor(size / 16));
    c.width = c.height = 16 * sc;
    Art.draw(c.getContext("2d"), Art.frame(species, mood || "ok"), Art.palette(species, colour, modSkin(species, colour, skin)), 0, 0, sc, false);
    return c.toDataURL();
  }
  // the Petapedia's mystery: the pet's shape, dark, upside down
  function mysteryURL(species, size) {
    const first = ((Core.SPECIES[species] || {}).colours || [])[0], painted = first && paintedPet(species, first, "a");
    if (painted) return painted;                                     // .pp-dex-mystery darkens it
    const c = document.createElement("canvas");
    const sc = Math.max(1, Math.floor(size / 16));
    c.width = c.height = 16 * sc;
    const ctx = c.getContext("2d");
    ctx.translate(0, c.height); ctx.scale(1, -1);
    const pal = {}; "oblpewts".split("").forEach((k) => { pal[k] = "#2a2430"; });
    Art.draw(ctx, Art.frame(species, "ok"), pal, 0, 0, sc, false);
    return c.toDataURL();
  }
  function renderPets(host) {
    const {s, v, now} = current();
    const pets = Core.petsView(s, now), hv = Core.hatcheryView(s, now), jv = Core.jobsView(s);
    const eggs = Core.bagList(s).filter((b) => b.kind === "egg");
    const gatherPick = (p) => `<select class="input pp-gather" data-id="${p.id}">
        <option value="">Send gathering…</option>
        ${Core.GATHERING.map((k) => p.skills[k].spots.map((sp) => `<option value="${k}:${sp.id}" ${sp.open ? "" : "disabled"}>
          ${esc(p.skills[k].name)} · ${esc(sp.name)}${sp.open ? "" : ` (level ${sp.level})`}${p.skills[k].natural ? " ★" : ""}</option>`).join("")).join("")}
        ${Core.HUNT_ORDER.map((g) => `<option value="hunt:${g}" ${p.level >= Core.HUNTS[g].level ? "" : "disabled"}>Hunt · ${esc(Core.HUNTS[g].name)}${p.level >= Core.HUNTS[g].level ? "" : ` (pet level ${Core.HUNTS[g].level})`}</option>`).join("")}
      </select>`;
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${hatcheryNote(hv, eggs)}
        ${pets.some((p) => !p.companion) ? `<p class="stamp pp-comforts">${(() => { const n = Core.comfortsOf(current().s);   // (2026-10-12) care in the work
            return n >= 3 ? "Your pet's room has a bed, a toy box and a rug: den pets go gathering 10% quicker."
              : `Your pet's room has ${n} of its 3 comforts (a bed, a toy box, a rug): den pets go gathering ${n * 3}% quicker${n ? "" : " -- each comfort adds 3%, all three 10%"}.`; })()}
            A pet with ★ beside a skill is a natural at it: 20% quicker again. Now and then, gathering, a Gifted pet follows you home -- one for each skill.</p>` : ""}
        ${pets.some((p) => !p.companion) ? `<section class="pp-shop pp-jobs-panel">
          <div class="pp-shop-head"><div><b>Jobs at home</b> <span class="pp-level">${jv.used}/${jv.slots} working</span>
            <div class="stamp">Pets in the den can work at your estate while you're out. Your bedroom (the pets' quarters) decides how many: build it up for more.
              A pet whose knack is the job's skill does it twice as well.${jv.home ? "" : " (They work at home -- on another island their jobs wait.)"}</div></div></div>
          <div class="pp-jobs">${jv.jobs.map((j) => `<div class="pp-job"><b>${esc(j.name)}</b><span class="stamp">${esc(j.says)}</span>
            <div class="who">${j.who.length ? j.who.map((w) => esc(w.name) + (w.busy ? " (away)" : "")).join(", ") : `<span class="stamp">Nobody yet${j.max > 1 ? ` (up to ${j.max})` : ""}</span>`}</div></div>`).join("")}</div>
        </section>` : ""}
        <div class="pp-pets">${pets.length ? pets.map((p) => `
          <section class="pp-shop pp-petcard${p.companion ? " companion" : ""}">
            <div class="pp-shop-head">
              <img class="pp-npc" alt="" src="${petURL(p.species, p.colour, 64, "ok", p.skin)}">
              <div><b>${esc(p.name)}</b>${p.stars ? ` <span class="pp-stars" title="${p.stars} star${p.stars === 1 ? "" : "s"}: +${p.stars * 10}% to its boost, ${p.stars} more kind${p.stars === 1 ? "" : "s"} carried">${"★".repeat(p.stars)}</span>` : ""} ${p.companion ? `<span class="pp-boost">Companion</span>` : ""}
                <div class="stamp">${esc(p.kind)} <span class="pp-rarity r-${esc(p.rarity.toLowerCase())}">${esc(p.rarity)}</span> · level ${p.level} · ${p.ageDays} day${p.ageDays === 1 ? "" : "s"} old</div></div>
            </div>
            ${geneHTML(p.gene)}
            ${p.choose ? `<div class="pp-choose"><b>New!</b> <span class="stamp">Keep ${esc(p.name)} as a home pet (gathering, jobs, expeditions), make it your companion,
                or send it to the <b>Beast Pen</b> as a battle pet (a ${esc(p.beastType)} type) -- free while it's new, and it can't come back.</span>
              <div class="pp-row"><button class="btn btn-sm" data-petkeep="${p.id}">Keep at home</button><button class="btn btn-sm" data-topen="${p.id}">To the Beast Pen</button></div></div>` : ""}
            <div class="pp-mini-skills">${Core.GATHERING.map((k) => `<span title="${esc(p.skills[k].name)}">${esc(p.skills[k].name.slice(0, 4))} ${p.skills[k].level}${p.skills[k].natural ? "★" : ""}</span>`).join("")}</div>
            ${p.companion ? `<p class="stamp">${p.away ? "On an expedition." : "Lives with you — see My pet."}</p>` : p.party ? `<p class="stamp">Away on an expedition with your companion, as its ${esc(p.party.toLowerCase())}.</p>` : `
              <div class="pp-row pp-work"><span class="stamp">Job at home</span>
                <select class="input pp-work-pick" data-id="${p.id}" aria-label="Job at home" ${p.job ? "disabled" : ""}>
                  <option value="">None</option>${jv.jobs.map((j) => `<option value="${j.id}" ${p.work === j.id ? "selected" : ""}>${esc(j.name)}</option>`).join("")}</select>
</div>
              ${p.work ? "" : p.job ? `<div class="pp-trip-line">${esc(p.job.skillName)} at the ${esc(p.job.spotName)} ${p.job.hunt ? ` · ${p.job.count} wins · health ${p.job.petHp}` : ` · +${p.job.xp} xp`} · next in <span class="pp-den-clock" data-id="${p.id}">${clock(p.job.nextIn)}</span></div>
                <div class="pp-finds">${items(p.job.items)}</div>
                <div class="pp-row"><button class="btn btn-sm pp-den-home" data-id="${p.id}">Bring home</button></div>`
              : gatherPick(p)}
              <div class="pp-row">
                <button class="btn btn-sm pp-make-comp" data-id="${p.id}">Make companion</button>
                ${p.named ? "" : `<input class="input pp-num pp-den-name" data-id="${p.id}" placeholder="Name" maxlength="24" style="width:120px">
                  <button class="btn btn-sm pp-den-name-save" data-id="${p.id}">Name</button>`}
              </div>
              ${p.dupe ? `<div class="pp-row pp-dupe">
                <select class="input pp-merge-into" data-id="${p.id}" aria-label="Merge into">${pets.filter((x) => x.id !== p.id && x.species === p.species).map((x) =>
                  `<option value="${x.id}">${esc(x.name)}${x.gene && x.gene.natureName ? " · " + esc(x.gene.natureName) : ""} · level ${x.level}${x.stars ? " " + "★".repeat(x.stars) : ""}${x.companion ? " (companion)" : ""}</option>`).join("")}</select>
                <button class="btn btn-sm pp-merge" data-id="${p.id}" title="It joins the other: +1 star (up to ${Core.STAR_MAX}), and half its experience">Merge</button>
                <button class="btn btn-sm btn-quiet pp-release-dupe" data-id="${p.id}" data-tokens="${p.tokens}">Release for ${p.tokens} tokens</button></div>` : ""}`}
          </section>`).join("") : `<p class="stamp">No pets yet — take an egg on My pet.</p>`}</div>
        <section class="pp-shop pp-tokens">
          <div class="pp-shop-head"><div><b>Pet token shop</b> <span class="pp-level">${(s.petTokens || 0).toLocaleString()} tokens</span>
            <div class="stamp">Release a pet you have more than one of for tokens (common 5, uncommon 10, rare 25, special 50), or merge it into another of its kind for a star.</div></div></div>
          <div class="pp-token-list">${Core.TOKEN_SHOP.map(([id, price]) => `<button class="pp-need-chip pp-token-buy${(s.petTokens || 0) >= price ? "" : " lack"}" data-item="${id}" title="${esc(Core.ITEMS[id].name)}">
            <img alt="" src="${itemIcon(id, 16)}">${esc(Core.ITEMS[id].name)} · ${price}</button>`).join("")}</div>
        </section>
      </div>`;
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } };
    wireHatcheryNote(host);
    host.querySelectorAll(".pp-gather").forEach((sel) => sel.addEventListener("change", async () => {
      if (!sel.value) return;
      const [skill, spot] = sel.value.split(":");
      if (skill === "hunt") err(await act("pethunt", {id: sel.dataset.id, ground: spot, roll: Math.random()}));
      else err(await act("pettrip", {id: sel.dataset.id, skill, spot, roll: Math.random()}));
    }));
    host.querySelectorAll(".pp-den-home").forEach((b) => b.addEventListener("click", async () => err(await act("pethome", {id: b.dataset.id}))));
    host.querySelectorAll("[data-petkeep]").forEach((b) => b.addEventListener("click", async () => err(await act("petkeep", {id: b.dataset.petkeep}))));
    host.querySelectorAll("[data-topen]").forEach((b) => b.addEventListener("click", async () => {      // the hatch choice (Part 11a)
      const q = pets.find((x) => x.id === b.dataset.topen);
      if (await askYes(`Send ${q.name} to the Beast Pen? A battle pet can't come back to the den.`)) err(await act("penmove", {id: q.id}));
    }));
    host.querySelectorAll(".pp-make-comp").forEach((b) => b.addEventListener("click", async () => err(await act("companion", {id: b.dataset.id}))));
    host.querySelectorAll(".pp-work-pick").forEach((sel) => sel.addEventListener("change", async () => err(await act("petwork", {id: sel.dataset.id, work: sel.value}))));
    // duplicates (2026-10-10): merge for a star, or release for tokens -- both asked first
    const petName = (id) => (pets.find((x) => x.id === id) || {}).name || "this pet";
    host.querySelectorAll(".pp-merge").forEach((b) => b.addEventListener("click", async () => {
      const into = host.querySelector(`.pp-merge-into[data-id="${b.dataset.id}"]`).value;
      if (await askYes(`Merge ${petName(b.dataset.id)} into ${petName(into)}? ${petName(b.dataset.id)} will be gone; ${petName(into)} gains a star.`)) err(await act("petmerge", {id: b.dataset.id, into}));
    }));
    host.querySelectorAll(".pp-release-dupe").forEach((b) => b.addEventListener("click", async () => {
      if (await askYes(`Release ${petName(b.dataset.id)} for ${b.dataset.tokens} pet tokens? This can't be undone.`)) err(await act("petrelease", {id: b.dataset.id}));
    }));
    host.querySelectorAll(".pp-token-buy").forEach((b) => b.addEventListener("click", async () => err(await act("tokenbuy", {item: b.dataset.item}))));
    host.querySelectorAll(".pp-den-name-save").forEach((b) => b.addEventListener("click", async () => {
      const box = host.querySelector(`.pp-den-name[data-id="${b.dataset.id}"]`);
      err(await act("petname", {id: b.dataset.id, name: box.value}));
    }));
    everySecond("den");
    if (hv.eggs.length || pets.some((p) => p.job)) everySecond("den", () => {
      if (!host.isConnected || page() !== "pet:pets") return false;
      const c = current(), h2 = Core.hatcheryView(c.s, c.now), p2 = Core.petsView(c.s, c.now);
      if (h2.eggs.length !== hv.eggs.length || p2.length !== pets.length) return render();     // something hatched
      host.querySelectorAll(".pp-den-clock").forEach((el) => { const p = p2.find((x) => x.id === el.dataset.id); if (p && p.job) el.textContent = clock(p.job.nextIn); });
    });
  }

  // ---- the hatchery, its own page (Cam, 2026-10-03: "i cant find the hatchery for when i
  // find pet eggs"). My pet and Pets point to it whenever there are eggs.
  function goTo(v) {
    if (SS.go) return SS.go(v);
    if (v.startsWith("shop:")) { view = Core.WORKSHOPS[v.slice(5)].npc ? "pet:village" : "pet:workshop"; openShop = v.slice(5); status = ""; return render(); }
    view = v; status = ""; render();
  }
  // a Mend button anywhere on a page
  document.addEventListener("click", async (e) => {
    const b = e.target.closest && e.target.closest("[data-mend]");
    if (!b) return;
    const r = await act("repair", {item: b.dataset.mend});
    if (r && r.error) { status = r.error; toast(r.error, true); render(); }
  });
  function hatcheryNote(hv, eggs) {
    const waiting = eggs.reduce((a, e) => a + e.count, 0);
    if (!waiting && !hv.eggs.length) return "";
    return `<div class="pp-reveal pp-hatch-note"><div><b>Hatchery</b> — ${hv.eggs.length ? `${hv.eggs.length} egg${hv.eggs.length === 1 ? "" : "s"} hatching` : "nothing hatching"}${waiting ? ` · ${waiting} egg${waiting === 1 ? "" : "s"} in your bag waiting` : ""}</div>
      <div><button class="btn btn-sm pp-go-hatchery">Open the Hatchery</button></div></div>`;
  }
  function wireHatcheryNote(host) { host.querySelectorAll(".pp-go-hatchery").forEach((b) => b.addEventListener("click", () => goTo("pet:hatchery"))); }
  function renderHatchery(host) {
    const {s, v, now} = current();
    // your first egg is taken here, at the Hatchery (I6, 2026-10-19, Cam: "this way we get introduced to the hatchery")
    if (!v.has) return renderChooser(host);
    const hv = Core.hatcheryView(s, now), eggs = Core.bagList(s).filter((b) => b.kind === "egg");
    const first = v.stage === "egg" ? `<div class="pp-incubator pp-first-egg"><img alt="" src="${itemIcon((v.egg || "starter") + "egg", 48)}" class="pp-wobble">
        <b>${esc(v.name || "Your first egg")}</b><span class="stamp pp-hatch-clock" data-first="1">hatches in ${clock(v.hatchIn)}</span><span class="stamp">your first pet -- it lives at home</span></div>` : "";
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <div class="pp-hatchery">${first}${Array.from({length: hv.slots}, (_, i) => {
          const h = hv.eggs[i];
          return h ? `<div class="pp-incubator"><img alt="" src="${itemIcon(h.egg + "egg", 48)}" class="pp-wobble">
              <b>${esc(h.eggName)}</b><span class="stamp pp-hatch-clock" data-i="${i}">hatches in ${clock(h.hatchIn)}</span></div>`
            : `<div class="pp-incubator empty"><span class="stamp">Empty</span></div>`;
        }).join("")}</div>
        ${hv.upgrade ? `<div class="pp-row" style="margin-top:10px"><button class="btn btn-sm pp-upgrade" data-what="hatchery" ${hv.upgrade.can ? "" : "disabled"}>Build another nest — ${hv.upgrade.cost.toLocaleString()} coins, ${esc(hv.upgrade.needs)}</button>
          <span class="stamp">one more egg at a time</span></div>` : ""}
        <div class="pp-group" style="margin-top:14px"><div class="pp-label">Eggs in your bag</div>
          ${eggs.length ? `<div class="pp-row">${eggs.map((e) => `<button class="btn pp-incubate" data-egg="${Core.ITEMS[e.id].egg}">
              <img alt="" src="${itemIcon(e.id, 20)}"> ${v.has ? "Put the" : "Hatch the"} ${esc(e.name.toLowerCase())} ${v.has ? "in" : ""} <span class="pp-count">${e.count}</span></button>`).join("")}</div>`
            : `<p class="stamp">None yet. Expeditions, crates and breeding find them.</p>`}</div>
      </div>`;
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } };
    host.querySelectorAll(".pp-incubate").forEach((b) => b.addEventListener("click", async () => err(await act("hatch", {egg: b.dataset.egg, roll: Math.random()}))));
    host.querySelectorAll(".pp-upgrade").forEach((b) => b.addEventListener("click", async () => err(await act("upgrade", {what: b.dataset.what}))));
    everySecond("hatch");
    if (hv.eggs.length || first) everySecond("hatch", () => {
      if (!host.isConnected || page() !== "pet:hatchery") return false;
      const c = current(), h2 = Core.hatcheryView(c.s, c.now);
      if (h2.eggs.length !== hv.eggs.length || !!first !== (c.v.stage === "egg")) return render();
      host.querySelectorAll(".pp-hatch-clock").forEach((el) => { const h = el.dataset.first ? c.v : h2.eggs[+el.dataset.i]; if (h) el.textContent = `hatches in ${clock(h.hatchIn)}`; });
    });
  }

  function renderDex(host) {
    const {s} = current();
    const dex = Core.dexView(s), found = dex.filter((d) => d.found).length;
    host.innerHTML = `
      <div class="pp-page">
        <div class="pp-dex">${dex.map((d) => d.found ? `
          <div class="pp-dex-card">
            <img alt="" src="${petURL(d.species, d.colour, 64, "ok", d.skin)}">
            <b>${esc(d.name)}</b><span class="pp-rarity r-${esc(d.rarity.toLowerCase())}">${esc(d.rarity)}</span>
            <span class="stamp">First hatched ${esc(new Date(d.first).toLocaleDateString())}</span>
            <span class="stamp">From: ${esc(d.eggs.join(", "))}${d.when === "night" ? " · 🌙 a creature of the night" : d.when === "day" ? " · ☀ out by day" : ""}</span>
          </div>` : `
          <div class="pp-dex-card unknown">
            <div class="pp-dex-mystery"><img alt="" src="${mysteryURL(d.species, 64)}"><span>?</span></div>
            <b>???</b><span class="stamp">Not found yet</span>
          </div>`).join("")}</div>
      </div>`;
  }

