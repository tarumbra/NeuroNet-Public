  // ---- loot crates: a popup, one thing at a time --------------------------------------------
  // Cam (2026-10-03): "when clicking to open a crate have a little popup window where i
  // click the crate and it opens revealing in the window 1 at a time the contents, then
  // once all items are presented the close button will appear ... Have a delay between
  // items being revealed like a gathcha system."
  const REVEAL_MS = 900, RARE_MS = 1500, COUNT_MS = 140;
  // Cam (2026-10-17): "Crates should have the ability to click to finish them revealing their contents and skipping to the view
  // which has their quantities however if when revealing it would become not visable to the player then it skips to that
  // screen automatically and the number quantity just goes up" -- a starter crate's 90 things ran off the bottom of the window.
  function openCrate(item) {
    const crate = Core.ITEMS[item];
    const box = document.createElement("div");
    box.className = "pp-modal";
    box.innerHTML = `<div class="pp-modal-card pp-crate-card" role="dialog" aria-label="${esc(crate.name)}">
        <div class="pp-label">${esc(crate.name)}</div>
        <button class="pp-crate" aria-label="Open the crate"><img alt="" src="${itemIcon(item, 120)}"></button>
        <p class="stamp pp-crate-hint" aria-live="polite"></p>   <!-- (empty until it says what you found: the crate code writes here -- 2026-10-20 fix) -->
        <div class="pp-reveal-row"></div>
        <button class="btn btn-primary pp-modal-close" hidden>Close</button>
      </div>`;
    document.body.appendChild(box);
    const btn = box.querySelector(".pp-crate"), row = box.querySelector(".pp-reveal-row"), close = box.querySelector(".pp-modal-close");
    const hint = box.querySelector(".pp-crate-hint");
    let opened = false, done = false, revealing = false, counting = false, timer = 0, got = [], i = 0;
    const seen = {}, order = [];                                       // what's been shown so far, alike ones counted
    const shut = () => { if (!done) return; box.remove(); render(); };
    const prize = (id, n, k) => { const it = Core.ITEMS[id];
      return `<div class="pp-prize gem-${Math.min(it.gem, 7)}${it.gem >= 5 ? " rare" : ""}" data-prize="${esc(id)}"${k !== undefined ? ` style="animation-delay:${k * 90}ms"` : ""}>
        <img alt="" src="${itemIcon(id, 48)}"><b><span class="pp-prize-n">${n > 1 ? n + " × " : ""}</span>${esc(it.name)}</b><span class="pp-gem">◆ ${it.gem}</span></div>`; };
    // the quantities view: one card a kind, its number going up as more come out
    const toCounting = () => {
      counting = true;
      row.classList.add("pp-haul");
      row.innerHTML = order.map((id) => prize(id, seen[id])).join("");
      hint.textContent = "Click to see it all";
    };
    const count = (id) => {
      const card = row.querySelector(`[data-prize="${CSS.escape(id)}"]`);
      if (!card) { row.insertAdjacentHTML("beforeend", prize(id, seen[id])); return; }
      card.querySelector(".pp-prize-n").textContent = seen[id] > 1 ? seen[id] + " × " : "";
      card.classList.remove("bump"); void card.offsetWidth; card.classList.add("bump");
    };
    /** Is this card where the player can see it (above the window's foot, with room for Close)? */
    const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom <= window.innerHeight - 72; };
    // the haul, all of it: best first (Cam, 2026-10-07: "after they have all be shown once, have the items found pop up again")
    const finish = () => {
      if (done) return;
      clearTimeout(timer); revealing = false;
      const haul = {};
      got.forEach((id) => { haul[id] = (haul[id] || 0) + 1; });
      const ids = Object.keys(haul).sort((a, b) => Core.ITEMS[b].gem - Core.ITEMS[a].gem);
      row.classList.add("pp-haul");
      row.innerHTML = ids.map((id, k) => prize(id, haul[id], k)).join("");
      hint.textContent = `You found ${got.length} thing${got.length === 1 ? "" : "s"} — all in your bag.`;
      done = true; close.hidden = false; close.focus();
    };
    const next = () => {
      if (i >= got.length) { timer = setTimeout(finish, counting ? 500 : 900); return; }
      const id = got[i++], rare = Core.ITEMS[id].gem >= 5;
      if (!seen[id]) order.push(id);
      seen[id] = (seen[id] || 0) + 1;
      if (counting || seen[id] > 1) { count(id); timer = setTimeout(next, rare && seen[id] === 1 ? RARE_MS : COUNT_MS); return; }   // more of the same: its number goes up
      row.insertAdjacentHTML("beforeend", prize(id, 1));
      if (!inView(row.lastElementChild)) toCounting();                 // it would be out of sight: count them up instead
      timer = setTimeout(next, counting ? COUNT_MS : rare ? RARE_MS : REVEAL_MS);
    };
    close.addEventListener("click", shut);
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (revealing) finish(); else shut(); } });
    box.addEventListener("click", (e) => { if (revealing && !e.target.closest(".pp-modal-close")) finish(); });   // click to see it all
    btn.addEventListener("click", async (e) => {
      if (opened) return;
      e.stopPropagation();
      opened = true;
      btn.classList.add("shake");
      hint.textContent = "…";
      const [r] = await Promise.all([act("open", {item, roll: Math.random()}), new Promise((ok) => setTimeout(ok, 700))]);
      btn.classList.remove("shake");
      if (!r || r.error) { hint.textContent = (r && r.error) || "It wouldn't open."; done = true; close.hidden = false; return; }
      btn.classList.add("burst");
      hint.textContent = "Click to see it all";
      got = r.got || [];
      revealing = true;
      timer = setTimeout(next, 500);
    });
    btn.focus();
  }

  // ---- equipment ---------------------------------------------------------------------------
  function wornText(w, whoFor) {
    const bits = [];
    if (whoFor === "player") {
      if (w.xp) bits.push(`+${Math.round(w.xp * 100)}% gathering xp`);
      if (w.speed < 1) bits.push(`finds ${Math.round((1 - w.speed) * 100)}% faster`);
      if (w.rare > 1) bits.push("rare finds ×" + w.rare);
    } else {
      if (w.success) bits.push(`+${Math.round(w.success * 100)}% expedition success`);
      if (w.expXp) bits.push(`+${Math.round(w.expXp * 100)}% expedition xp`);
    }
    return bits.join(" · ") || "nothing yet";
  }
  // the off hand and weapon wear (Battle Re-work, Part 1, 2026-10-15): a second weapon, used when the main can't be; each
  // weapon's blows left -- re-tempered only at the Grindstone (C4 D3, 2026-10-16: it was here too)
  function weaponWearHTML(w, tag) {
    if (!w) return "";
    const rc = w.retemper, cost = rc ? (rc.coins ? rc.coins + " coins" : Object.keys(rc.needs).map((k) => `${rc.needs[k]} × ${Core.ITEMS[k].name.toLowerCase()}`).join(", ")) : "";
    return `<div class="pp-slot-wear"><span>${esc(tag)}: ${esc(w.name)}</span>
      <span class="pp-wear" title="${w.left} of ${w.dur} blows left"><span style="width:${100 - w.pct}%" class="${w.pct >= 90 ? "low" : w.pct >= 75 ? "mid" : ""}"></span></span>
      <span class="stamp">${w.left.toLocaleString()} blows left${w.tempered ? " · re-tempered" : ""}</span>
      ${rc ? `<span class="stamp pp-retemper-at">ready to re-temper at the Grindstone (${esc(cost)})</span>` : ""}</div>`;
  }
  /** Your pet with its slots around it -- a click on a slot opens its picker (2026-10-15). */
  function petDollHTML(v, petImg) {
    const slot = (g) => `<button class="pl-doll-slot${g.item ? " full" : ""}" data-petdoll="${g.slot}" title="${esc(g.name)}: ${g.item ? esc(g.item.name) : "empty"}">
        ${g.item ? `<img alt="" src="${itemIcon(g.item.id, 32)}">` : `<span class="pl-doll-empty"></span>`}<small>${esc(g.name)}</small></button>`;
    const gs = v.gear || [], half = Math.ceil(gs.length / 2);
    return `<section class="pl-doll pl-petdoll" aria-label="What ${esc(v.name)} wears">
        <div class="pl-doll-col">${gs.slice(0, half).map(slot).join("")}</div>
        <div class="pl-doll-fig"><img class="pl-doll-img pl-petdoll-img" alt="" src="${petImg}"></div>
        <div class="pl-doll-col">${gs.slice(half).map(slot).join("")}</div>
      </section>`;
  }
  function renderGear(host, inSheet) {
    const {s, v, now} = current();
    const pv = Core.playerView(s, now);
    const petOK = v.has && v.stage !== "egg";
    const petImg = petOK ? paintedPet(v.species, v.colour, "a", v.skin) || (() => {
      const c = document.createElement("canvas"); c.width = c.height = 16 * 8;
      Art.draw(c.getContext("2d"), Art.frame(v.species, "ok"), Art.palette(v.species, v.colour, modSkin(v.species, v.colour, v.skin)), 0, 0, 8, false);
      return c.toDataURL(); })() : "";
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <div class="pp-gear-panels">
          <section class="pp-shop">
            <div class="pp-shop-head"><div><b>What you wear</b><div class="stamp">${esc(wornText(pv.worn, "player"))}</div></div></div>
            ${inSheet ? "" : paperDollHTML(pv)}
            
            ${weaponWearHTML(pv.weapons && pv.weapons.main, "Main")}${weaponWearHTML(pv.weapons && pv.weapons.off, "Off hand")}
            <div class="pp-label">Tools</div>
            <div class="stamp">${Core.GATHERING.map((k) => `${esc(Core.SKILLS[k].name)}: ${pv.tools[k] ? esc(pv.tools[k].name) : "none"}`).join(" · ")}</div>
          </section>
          <section class="pp-shop">
            ${petOK ? `<div class="pp-shop-head"><img class="pp-npc" alt="" src="${petImg}">
              <div><b>${esc(v.name)}</b><div class="stamp">${esc(v.kind)} · ${esc(wornText(v.worn, "pet"))}</div></div></div>
              ${petDollHTML(v, petImg)}
              `
              : `<p class="stamp">Your pet's equipment shows here once it has hatched.</p>`}
          </section>
        </div>
      </div>`;
    const sayIt = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); host.querySelector("#pp-status").textContent = status; } };
    host.querySelectorAll("[data-petdoll]").forEach((b) => b.addEventListener("click", () => openSlotPicker(b, "pet", b.dataset.petdoll)));
    host.querySelectorAll("[data-doll]").forEach((b) => b.addEventListener("click", () => openSlotPicker(b, "player", b.dataset.doll)));
  }

