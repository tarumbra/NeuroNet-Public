  // ---- Battle Re-work Part 13: the Necromancer (2026-10-16) -------------------------------------------------------------
  //      The Archmage's offer at the mage tower (yes / no / yes later -- Q15), and the Necromancer's ground in the graveyard:
  //      the graves you could raise and what each costs, your risen (a potion of life essence for the hurt), the lanterns,
  //      and a night's vigil. Note 07; the Narrative Designer's rule: gentle -- the dead are brought back, and glad of it.
  /** A risen pet's picture: Cam's painted spirit if there is one (art/pets/spectral), else its own with the ghostly tint. */
  function risenPicHTML(species, colour, size, pose, cls) {
    const k = species + "/" + colour, sp = window.PET_SPECTRAL && window.PET_SPECTRAL[k];
    if (sp && sp[pose === "side" ? "side" : "a"]) return `<img alt="" class="${cls || ""}" src="art/pets/spectral/${species}-${colour}-${pose === "side" ? "side" : "a"}.webp" style="width:${size}px;height:${size}px;object-fit:contain">`;
    return `<img alt="" class="${cls || ""} pp-risen-pic" src="${petURL(species, colour, size)}">`;
  }
  function necroOfferHTML(s, now) {
    const nv = Core.necroView(s, now);
    if (!nv.offered) return "";
    if (nv.taught) return `<section class="pp-shop pp-necro-offer"><b>Sorceress Nyx</b>
        </section>`;
    const quest = nv.quest.map((q) => `<span class="pp-need-chip${q.have >= q.need ? "" : " lack"}"><img alt="" src="${itemIcon(q.id, 16)}"> ${esc(q.name)} ${Math.min(q.have, q.need)}/${q.need}</span>`).join("");
    return `<section class="pp-shop pp-necro-offer">
        <b>Sorceress Nyx's offer</b>${window.PET_ICONS && window.PET_ICONS.obj_pmorvane ? ` <img class="pp-necro-morvane" alt="Morvane the Lich" title="Morvane the Lich keeps the Blood Book" src="${itemIcon("obj_pmorvane", 48)}">` : ""}
        <p class="pp-said">${esc(nv.offer)}</p>
        ${nv.accepted ? `<p class="pp-said">${esc(nv.accept)}</p>
            <div class="pp-needs">${quest}</div>
            ${stepsHTML(nv)}
            <div class="pp-place-btns"><button class="btn btn-primary" data-necro="learn" ${nv.quest.every((q) => q.have >= q.need) ? "" : "disabled"}>Give her the book and the runes</button>
              <button class="btn" data-bloodbook>The Blood Book (the quest)</button></div>`
          : `<div class="pp-place-btns"><button class="btn btn-primary" data-necro="accept">Yes -- teach me</button>${nv.declined ? `<span class="stamp">You said no. She's still waiting.</span>` : `<button class="btn" data-necro="decline">No</button>`}</div>`}
      </section>`;
  }
  function necroGroundHTML(s, now) {
    const nv = Core.necroView(s, now);
    if (!nv.taught) return nv.offered ? `<section class="pp-shop pp-necro-ground locked"><b>🔒 An old gate, chained</b>
        <p class="stamp">Something behind the graves is waiting for a Necromancer. Sorceress Nyx could teach you.</p></section>` : "";
    const risen = nv.risen.map((r) => `<div class="pp-recipe">
        ${risenPicHTML(r.species, r.colour, 32)}
        <div class="pp-recipe-main"><div><b>${esc(r.name)}</b> <span class="stamp">· ${esc(r.kind)} · battle level ${r.level}</span></div>
          <div class="pp-skill-bar"><span class="pp-skill-fill" style="width:${Math.round(r.hp / r.maxHp * 100)}%"></span></div><span class="stamp">${r.hp} / ${r.maxHp} health -- only Necromancy or a potion of life essence mends it</span></div>
        <button class="btn btn-sm" data-risenpotion="${esc(r.id)}" ${r.hp < r.maxHp ? "" : "disabled"}>Potion</button></div>`).join("");
    return `<section class="pp-shop pp-necro-ground">
        <b>The Necromancer's ground</b> <span class="stamp">· ${nv.lanterns} lantern${nv.lanterns === 1 ? "" : "s"} lit · ${nv.essence} life essence · ${nv.slots} risen in a fight at once</span>
        
        ${risen ? `<div class="pp-label">Your risen</div>${risen}` : ""}
        <div class="pp-place-btns"><button class="btn" data-vigil ${nv.night && !nv.vigilDone ? "" : "disabled"} title="After dark, once a night: a wisp may come">${nv.vigilDone ? "Tonight's vigil is kept" : nv.night ? "Keep a vigil" : "Keep a vigil (after dark)"}</button></div>
      </section>`;
  }
  /** A headstone's Raise (one home for the graves: the list above, not a second one -- Cam's "keep it lean"). */
  function graveRaiseHTML(s, i, now) {
    const nv = Core.necroView(s, now), g = nv.taught && nv.graves[i];
    if (!g) return "";
    const can = nv.essence >= g.cost && nv.arcane && nv.room;
    return `<div class="pp-grave-raise"><span class="pp-need-chip${nv.essence >= g.cost ? "" : " lack"}"><img alt="" src="${itemIcon("lifeessence", 16)}"> ${g.cost} life essence · battle level ${g.level}</span>
      <button class="btn btn-sm${can ? " btn-primary" : ""}" data-raise="${g.i}" ${can ? "" : "disabled"}>Raise</button></div>`;
  }
  function wireNecro(host) {
    const go = async (a, o) => { const r = await act(a, o); if (r && r.error) { status = r.error; toast(r.error, true); } render(); };
    host.querySelectorAll("[data-necro]").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("necro", {op: b.dataset.necro});
      if (r && r.error) { status = r.error; toast(r.error, true); }
      render();
      if (!(r && r.error) && b.dataset.necro === "accept") bloodBookPopup();      // saying yes opens the quest (V8)
    }));
    const bb = host.querySelector("[data-bloodbook]"); if (bb) bb.addEventListener("click", bloodBookPopup);
    host.querySelectorAll("[data-raise]").forEach((b) => b.addEventListener("click", () => go("raise", {i: +b.dataset.raise})));
    host.querySelectorAll("[data-risenpotion]").forEach((b) => b.addEventListener("click", () => go("risenpotion", {id: b.dataset.risenpotion})));
    const v = host.querySelector("[data-vigil]"); if (v) v.addEventListener("click", () => go("vigil", {}));
  }
  // ---- the quest "The Blood Book" (V8, Cam: "a necromancy quest ... accessed via a pop up ... it will show the requirements like
  //      rowboat, quests etc to unlock sailing for the ability to get to misty isle"): every step, ticked as you go
  function stepsHTML(nv) {
    return `<ol class="pp-quest-steps">${nv.steps.map((x) => `<li class="${x.done ? "done" : ""}"><span aria-hidden="true">${x.done ? "✓" : "○"}</span> ${esc(x.text)}${x.done ? '<span class="sr-only"> (done)</span>' : ""}</li>`).join("")}</ol>`;
  }
  function bloodBookPopup() {
    const {s, now} = current(), nv = Core.necroView(s, now);
    if (!nv.accepted || nv.taught) return;
    const box = document.createElement("div");
    box.className = "pp-modal";
    box.innerHTML = `<div class="pp-modal-card pp-bloodbook" role="dialog" aria-label="The Blood Book">
        <img class="pp-bloodbook-pic" alt="" src="${itemIcon("bloodbook", 64)}">
        <div class="pp-label">The Blood Book -- Sorceress Nyx's quest</div>
        <p class="pp-said">${esc(nv.ilse)}</p>
        ${stepsHTML(nv)}
        
        <button class="btn btn-primary pp-modal-close">Close</button></div>`;
    document.body.appendChild(box);
    const shut = () => box.remove();
    box.querySelector(".pp-modal-close").addEventListener("click", shut);
    box.addEventListener("click", (e) => { if (e.target === box) shut(); });
    box.querySelector(".pp-modal-close").focus();
  }
