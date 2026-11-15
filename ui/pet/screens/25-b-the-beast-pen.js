  // ---- the Beast Pen (Battle Re-work Part 11a, 2026-10-16) -----------------------------------------------------------------
  //      Note 06: stalls for battle pets, idle training on one stat (fed from the Farm's Feed store), rest for fainted pets,
  //      and Warden Briar, who takes pets in from the den. Their fights (and the Beast Master) are Part 11b.
  function renderPen(host) {
    const {s, now} = current();
    const pv = Core.penView(s, now), w = pv.warden, R = Core.BEAST_RULES;
    const hrs = (ms) => ms >= 3600e3 ? `${Math.floor(ms / 3600e3)}h ${Math.floor(ms % 3600e3 / 60000)}m` : `${Math.ceil(ms / 60000)}m`;
    const foods = Core.bagList(s).filter((x) => Core.ITEMS[x.id].heal).sort((a, b) => Core.ITEMS[b.id].heal - Core.ITEMS[a.id].heal);
    const card = (b) => `<section class="pen-beast${b.resting ? " resting" : ""}">      <!-- (a pet's sheet, PT27) -->
        <div class="pp-sheet-head">${b.risen ? risenPicHTML(b.species, b.colour, 64, "a", "pp-npc") : `<img alt="" src="${petURL(b.species, b.colour, 64, b.resting ? "asleep" : "ok", b.skin)}">`}
          <div><b>${esc(b.name)}</b>${b.loan ? ` <span class="pp-need-chip" title="Lent to you for the lesson -- ${esc(b.loan)} takes them home at the end">${esc(b.loan)}'s</span>` : ""}${b.risen ? ` <span class="pen-type t-spirit" title="Raised by your Necromancy: only Mend the dead or a potion of life essence heals it">Risen</span>` : ""} <span class="pen-type t-${esc(b.type)}" title="${b.strong.length || b.weak.length ? `Strong against ${esc(b.strong.join(" and "))}; weak to ${esc(b.weak.join(" and "))}` : "Neutral against every type"}"><img class="pen-type-img" alt="" src="${itemIcon(b.type === "astral" && !(window.PET_ICONS || {}).obj_typeastral ? "astralegg" : "obj_type" + b.type, 16)}"> ${esc(b.typeName)}</span>
            <div class="stamp">${esc(b.kind)} · battle level ${b.level} · ${b.strong.length || b.weak.length ? `strong against ${esc(b.strong.join(", ").toLowerCase())}, weak to ${esc(b.weak.join(", ").toLowerCase())}` : "neutral: no type is strong or weak against it"}</div>
            <span class="pp-bar pen-xp"><span style="width:${Math.round(b.progress * 100)}%"></span></span></div></div>
        <div class="pen-stats">${Object.keys(R.stats).map((k) => `<span><small>${esc(R.stats[k])}</small><b>${b.stats[k]}</b>${b.trained[k] ? `<em title="from training">+${b.trained[k]}</em>` : ""}</span>`).join("")}</div>
        ${b.resting ? `<p class="stamp pen-rest">Resting -- ready in ${hrs(b.restLeft)}. Food cuts it short:
            ${foods.length ? foods.slice(0, 4).map((f) => `<button class="btn btn-sm" data-penrest="${esc(b.id)}" data-item="${esc(f.id)}">${esc(f.name)} ×${f.count}</button>`).join(" ") : "none in the bag."}</p>`
          : `<div class="pp-row"><span class="stamp">Training</span>
            <select class="input pen-train" data-id="${esc(b.id)}" aria-label="What ${esc(b.name)} trains"><option value="">Nothing</option>
              ${Object.keys(R.stats).map((k) => `<option value="${k}" ${b.train === k ? "selected" : ""}>${esc(R.stats[k])}</option>`).join("")}</select>
            <span class="stamp">${b.train ? b.capped ? `Battle level ${pv.cap} is as far as the Pen takes them -- the rest comes from fights.` : b.fed ? `Fed for ${hrs(b.fedLeft)}.` : "<b>Hungry</b> -- fill the troughs." : ""}</span></div>`}
        <div class="pen-moves" aria-label="${esc(b.name)}'s moves"><span class="stamp">Moves (${b.moves.use.length}/${b.moves.slots}):</span>
          ${b.moves.all.map((m) => `<button class="pen-move${m.used ? " on" : ""}" data-penmove="${esc(b.id)}" data-move="${esc(m.id)}" ${m.known ? "" : "disabled"} title="${esc(m.about)}">${esc(m.name)}${m.known ? ` <small class="pen-pp${m.pp < m.ppMax ? " low" : ""}">${m.pp}/${m.ppMax}</small>` : ` · Lv${m.level}`}</button>`).join("")}
</div>
        ${b.teach.length ? `<div class="pp-row pen-teach"><span class="stamp">Teach from a tome (${b.tomeMoves}/${pv.tomeMax}):</span>
            <select class="input" data-teachfor="${esc(b.id)}" aria-label="A move to teach ${esc(b.name)}">${b.teach.map((m) => `<option value="${esc(m.move)}">${esc(m.name)} (${esc(m.typeName)}, level ${m.level}) -- ${esc(m.about)}</option>`).join("")}</select>
            <button class="btn btn-sm" data-teach="${esc(b.id)}">Teach</button></div>` : ""}
        ${b.later.length ? `<div class="pp-row pen-later"><span class="stamp">${b.teach.length ? "Later" : "From your tomes, later"}: ${b.later.slice(0, 6).map((m) => `${esc(m.name)} at battle level ${m.level}`).join(", ")}${b.later.length > 6 ? ` and ${b.later.length - 6} more` : ""}.</span></div>` : ""}
        ${b.named ? "" : `<div class="pp-row"><input class="input pen-name" data-id="${esc(b.id)}" placeholder="Name" maxlength="24" style="width:140px"><button class="btn btn-sm" data-penname="${esc(b.id)}">Name</button></div>`}
      </section>`;
    // V12 (carried, Cam's yes, 2026-10-18; PT18 p4: "the battle pen so it doesnt have all those menus under the map, we make them
    // live in the places"): the painting is the page, and each place opens its own sheet. PT27 (Cam: "the beast pen is the
    // games weakest area in terms of UI -- make it consistent with all other areas"): the sheets are the Marketplace's and the
    // house's -- a head with its picture, labelled lists of rows with their buttons on the right -- and a pet opens its own sheet.
    host.innerHTML = `
      <div class="pp-page pen-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${paintedHTML("pen", [{key: "stalls", name: "Stalls", note: `${pv.beasts.length}/${pv.stalls}`}, {key: "barn", name: "Resting barn", note: pv.beasts.some((b) => b.resting) ? `${pv.beasts.filter((b) => b.resting).length} resting` : ""},
          {key: "yard", name: "Training yard"}, {key: "ring", name: "Sparring ring", lock: pv.yard.find((y) => y.id === "ring").built ? "" : "build it in the yard", lockShort: "Not built"},
          {key: "feed", name: "Feed store"}, {key: "warden", name: "Warden Briar"}])}
        <p class="sr-only" role="status">${pv.beasts.length} of ${pv.stalls} stalls used. Click a place on the painting.</p>
      </div>`;
    wirePainted(host, (k) => { penPlace = k; penPlaceShow(); });
    penCard = card;
    if (penPlace) penPlaceShow();                                         // a sheet stays open while you use it
  }
  let penPlace = "", penCard = null;
  /** One row of a sheet, as in the Marketplace: a picture, a name and a line, buttons on the right. */
  const penRow = (pic, name, line, btns, short) => `<div class="pp-recipe${short ? " short" : ""}">${pic ? `<img alt="" src="${pic}">` : "<span></span>"}<div class="pp-recipe-main"><b>${name}</b>${line ? ` <span class="stamp">${line}</span>` : ""}</div><span class="pp-place-btns">${btns || ""}</span></div>`;
  const penPic = (own, stand) => itemIcon((window.PET_ICONS || {})[own] ? own : stand, 64);   // its own badge once painted (collab N14)
  const penHead = (pic, name, line) => `<div class="pp-sheet-head"><img alt="" src="${pic}"><div><b>${esc(name)}</b><div class="stamp">${line}</div></div></div>`;
  function penSheetHTML(key, s, now) {
    const pv = Core.penView(s, now), w = pv.warden;
    const hrs = (ms) => ms >= 3600e3 ? `${Math.floor(ms / 3600e3)}h ${Math.floor(ms % 3600e3 / 60000)}m` : `${Math.ceil(ms / 60000)}m`;
    const petPic = (b, size) => petURL(b.species, b.colour, size, b.resting ? "asleep" : "ok", b.skin);
    const typeChip = (b) => `<span class="pen-type t-${esc(b.type)}"><img class="pen-type-img" alt="" src="${itemIcon("obj_type" + b.type, 16)}"> ${esc(b.typeName)}</span>`;
    const state = (b) => b.resting ? `resting, ready in ${hrs(b.restLeft)}` : b.train ? b.capped ? `trained to the Pen's cap` : b.fed ? `training ${Core.BEAST_RULES.stats[b.train].toLowerCase()}, fed for ${hrs(b.fedLeft)}` : `hungry -- fill the troughs` : "not training";
    if (key.startsWith("pet:")) {                                          // a pet's own sheet: its card, as before
      const b = pv.beasts.find((x) => x.id === key.slice(4));
      return b ? `<p class="stamp"><button class="btn btn-quiet btn-sm" data-pengo="${b.resting ? "barn" : "stalls"}">‹ ${b.resting ? "The resting barn" : "The stalls"}</button></p>${penCard(b)}` : "";
    }
    const petRows = (list) => list.map((b) => penRow(petPic(b, 32), `${esc(b.name)} ${typeChip(b)}${b.risen ? ` <span class="pen-type t-spirit">Risen</span>` : ""}`,
      `${esc(b.kind)} · battle level ${b.level} · ${esc(state(b))}`, `<button class="btn btn-sm" data-pengo="pet:${esc(b.id)}">Open</button>`)).join("");
    if (key === "stalls") return `${penHead(itemIcon("obj_stalls", 64), "The stalls", `${pv.beasts.length} of ${pv.stalls} stalls -- your battle pets. Each one's training, moves and tomes are on its sheet.`)}
        ${pv.beasts.length ? petRows(pv.beasts.filter((b) => !b.resting)) || `<p class="stamp">Everyone's resting in the barn.</p>` : `<p class="stamp">No battle pets yet. A newly hatched pet can come here free -- ${esc(w.name)} takes others from your den.</p>`}
        `;
    if (key === "barn") {
      const resting = pv.beasts.filter((b) => b.resting);
      const foods = Core.bagList(s).filter((x) => Core.ITEMS[x.id].heal).sort((a, b) => Core.ITEMS[b.id].heal - Core.ITEMS[a.id].heal).slice(0, 3);
      return `${penHead(penPic("obj_restbarn", "obj_barn"), "The resting barn", "A pet that faints rests here. Food cuts it short.")}
        <div class="pp-label">Resting</div>
        ${resting.length ? resting.map((b) => penRow(petPic(b, 32), esc(b.name), `ready in ${hrs(b.restLeft)}`,
            foods.map((f) => `<button class="btn btn-sm" data-penrest="${esc(b.id)}" data-item="${esc(f.id)}" title="Feed it ${esc(f.name.toLowerCase())}">${esc(f.name)} ×${f.count}</button>`).join("") || `<span class="stamp">no food in the bag</span>`)).join("")
          : `<p class="stamp">Nobody's resting.</p>`}
        <div class="pp-label">More stalls</div>
        ${pv.up ? penRow(itemIcon("obj_stalls", 32), `${pv.up.stalls} stalls`, `Construction ${pv.up.construction} · ${pv.up.coins.toLocaleString()} coins`, `<button class="btn btn-sm btn-primary" id="pen-up" ${pv.up.can ? "" : "disabled"}>Build</button>`, !pv.up.can)
          : `<p class="stamp">The Pen is as big as it gets (${pv.stalls} stalls).</p>`}`;
    }
    if (key === "yard") return `${penHead(itemIcon("obj_dummy", 64), "The training yard", `Training: ${pv.rate} xp an hour while fed, up to battle level ${pv.cap}. Pick what each pet trains on its sheet.`)}
        <div class="pp-label">Build</div>
        ${pv.yard.map((y) => penRow(itemIcon(y.id === "dummy" ? "obj_dummy" : "obj_showring", 32), esc(y.name), y.built ? "built" : `Construction ${y.construction} · ${y.coins.toLocaleString()} coins · ${esc(y.items)}`,
            y.built ? `<span class="stamp">${y.id === "dummy" ? "training 15% quicker" : "open: the sparring ring"}</span>` : `<button class="btn btn-sm btn-primary" data-penbuild="${y.id}" ${y.can ? "" : "disabled"}>Build</button>`, !y.built && !y.can)).join("")}
        <p class="stamp">${pv.yard.find((y) => y.id === "dummy").built ? "" : "The training dummy makes idle training 15% quicker. "}${pv.yard.find((y) => y.id === "ring").built ? "" : "The sparring ring lets two pets spar for a little battle xp."}</p>`;
    if (key === "ring") return `${penHead(penPic("obj_sparring", "obj_showring"), "The sparring ring", "Two pets spar for a little battle xp -- nobody gets hurt. You watch the bout on the training yard.")}
        ${pv.spar ? `<div class="pp-label">Choose two</div><div class="pp-row"><select class="input" id="pen-spar-a" aria-label="First pet to spar">${pv.spar.map((p) => `<option value="${esc(p.id)}" ${p.ready ? "" : "disabled"}>${esc(p.name)}${p.ready ? "" : ` (${p.wait ? p.wait + " min" : "resting"})`}</option>`).join("")}</select>
            <select class="input" id="pen-spar-b" aria-label="Second pet to spar">${pv.spar.map((p, i) => `<option value="${esc(p.id)}" ${p.ready ? "" : "disabled"} ${i === 1 ? "selected" : ""}>${esc(p.name)}${p.ready ? "" : ` (${p.wait ? p.wait + " min" : "resting"})`}</option>`).join("")}</select>
            <button class="btn btn-sm btn-primary" id="pen-spar">Spar</button></div>`
          : `<p class="stamp">Build the sparring ring in the training yard first.</p><p><button class="btn btn-sm" data-pengo="yard">The training yard</button></p>`}`;
    if (key === "feed") return `${penHead(penPic("obj_feedstore", "hay"), "The feed store", `Troughs for the battle pets, filled from the Farm's Feed store. One feeds a pet ${Core.BEAST_PEN.feedHours} hours of training.`)}
        <div class="pp-label">In your bag</div>
        ${pv.feed.map((f) => penRow(itemIcon(f.id, 32), esc(f.name), `×${f.have}`, "", !f.have)).join("")}
        <div class="pp-row"><button class="btn btn-primary" id="pen-feed" ${pv.feed.some((f) => f.have) ? "" : "disabled"}>Fill the troughs</button>${pv.feed.some((f) => f.have) ? "" : `<span class="stamp">Make feed at the Farm's Feed store.</span>`}</div>`;
    if (key === "warden") return `${penHead(avatarURL(w.look, 64), w.name, `${esc(w.title)} -- “${esc(w.says)}”`)}
        ${pv.pack ? `<div class="pp-label">Your pack</div>${penRow("", pv.pack.length ? esc(pv.pack.join(", ")) : "Nobody yet", "the battle pets that hunt with you", `<button class="btn btn-sm" id="pen-pack">Choose your pack</button>`)}` : ""}
        <div class="pp-label">Bring a pet from your den</div>
        <p class="stamp">${esc(w.move)}</p>
        ${pv.den.length ? pv.den.map((q) => penRow(petURL(q.species, q.colour, 32, "ok", q.skin), esc(q.name), `${esc(q.kind)} · ${esc(q.type)}${q.fresh ? " · new: no charge" : ""}${q.why ? ` -- ${esc(q.why)}` : ""}`,
            `<button class="btn btn-sm btn-primary" data-penin="${esc(q.id)}" ${q.why ? "disabled" : ""}>${q.price ? `Move in · ${q.price.toLocaleString()}` : "Move in"}</button>`, !!q.why)).join("")
          : `<p class="stamp">Nobody in the den. Your companion stays with you.</p>`}
        <div class="pp-label">Move tomes · ${pv.tomePrice.toLocaleString()} coins each</div>
        
        ${pv.tomes.map((t) => penRow(itemIcon(t.id, 32), esc(t.name), t.have ? `you have ${t.have}` : "", `<button class="btn btn-sm" data-penbuy="${esc(t.id)}">Buy</button>`)).join("")}
        ${pv.found.length ? `<div class="pp-label">Your found tomes</div>
          ${pv.found.map((t) => penRow(itemIcon(t.id, 32), esc(t.name) + (t.have > 1 ? ` ×${t.have}` : ""), `${esc(t.moves)}${t.banked ? " -- in the bank: take it out to teach" : ""}`, "", t.banked)).join("")}` : ""}`;
    return "";
  }
  const PEN_PLACE_NAMES = {stalls: "Stalls", barn: "Resting barn", yard: "Training yard", ring: "Sparring ring", feed: "Feed store", warden: "Warden Briar"};
  /** The place's sheet (or a pet's), the Marketplace's way: a parchment card over the painting; its buttons act, then it redraws. */
  function penPlaceShow() {
    document.querySelectorAll(".pp-modal.pen-sheet").forEach((x) => x.remove());
    const {s, now} = current(), body = penSheetHTML(penPlace, s, now);
    if (!body) { penPlace = ""; return; }
    const pv = Core.penView(s, now);
    const box = document.createElement("div");
    box.className = "pp-modal pp-item-sheet pen-sheet";
    box.innerHTML = `<div class="pp-modal-card pp-sheet" role="dialog" aria-label="${esc(PEN_PLACE_NAMES[penPlace] || "A battle pet")}"><button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>${body}</div>`;
    document.body.appendChild(box);
    const err = (r) => { if (r && r.error) toast(r.error, true); };
    const shut = () => { penPlace = ""; box.remove(); };
    const q = (sel, f) => box.querySelectorAll(sel).forEach(f);
    box.querySelector(".pp-shop-x").addEventListener("click", shut);
    box.addEventListener("click", (e) => { if (e.target === box) shut(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") shut(); });
    q("[data-pengo]", (b) => b.addEventListener("click", () => { penPlace = b.dataset.pengo; penPlaceShow(); }));
    const pk = box.querySelector("#pen-pack"); if (pk) pk.addEventListener("click", () => { shut(); sheetTab = "combat"; sheetFrom = "pet:pen"; goTo("pet:skills"); });
    const up = box.querySelector("#pen-up"); if (up) up.addEventListener("click", async () => err(await act("penup", {})));
    const fd = box.querySelector("#pen-feed"); if (fd) fd.addEventListener("click", async () => err(await act("penfeed", {})));
    q(".pen-train", (sel) => sel.addEventListener("change", async () => err(await act("pentrain", {id: sel.dataset.id, stat: sel.value}))));
    q("[data-penrest]", (b) => b.addEventListener("click", async () => err(await act("penrest", {id: b.dataset.penrest, item: b.dataset.item}))));
    q("[data-penname]", (b) => b.addEventListener("click", async () => err(await act("penname", {id: b.dataset.penname, name: b.closest(".pen-beast").querySelector(".pen-name").value}))));
    q(".pen-move", (el) => el.addEventListener("click", async () => {     // its four moves (Part 11b)
      const bv = pv.beasts.find((x) => x.id === el.dataset.penmove), use = bv.moves.use.slice(), m = el.dataset.move, i = use.indexOf(m);
      if (i >= 0) { if (use.length === 1) return; use.splice(i, 1); } else { if (use.length >= bv.moves.slots) { toast(`${bv.name} uses ${bv.moves.slots} moves -- take one out first.`, true); return; } use.push(m); }
      err(await act("penmoves", {id: bv.id, moves: use}));
    }));
    q("[data-penbuild]", (b) => b.addEventListener("click", async () => err(await act("penbuild", {what: b.dataset.penbuild}))));
    const spar = box.querySelector("#pen-spar"); if (spar) spar.addEventListener("click", async () => {
      const r = await act("penspar", {a: box.querySelector("#pen-spar-a").value, b: box.querySelector("#pen-spar-b").value});
      if (r && r.error) return err(r);
      const sp = (current().s.pen || {}).lastSpar; if (sp) sparShow(sp);
    });
    q("[data-penbuy]", (b) => b.addEventListener("click", async () => err(await act("penbuy", {item: b.dataset.penbuy}))));   // move tomes (Part 14)
    q("[data-teach]", (b) => b.addEventListener("click", async () => err(await act("penteach", {id: b.dataset.teach, move: b.closest(".pen-beast").querySelector("[data-teachfor]").value}))));
    q("[data-penin]", (b) => b.addEventListener("click", async () => {
      const d = pv.den.find((x) => x.id === b.dataset.penin);
      if (!await askYes(`Move ${d.name} into the Beast Pen${d.price ? ` for ${d.price.toLocaleString()} coins` : ""}? A battle pet can't come back to the den.`)) return;
      err(await act("penmove", {id: d.id}));
    }));
    const first = box.querySelector(".pp-sheet button:not(.pp-shop-x), .pp-sheet select"); if (first) first.focus({preventScroll: true});
  }
  // ---- a spar, watched on the Training Yard (Cam, PT16 x4) ---------------------------------------------------------------
  function sparShow(sp) {
    const box = document.createElement("div");
    box.className = "pp-modal";
    box.innerHTML = `<div class="pp-modal-card pp-spar-card" role="dialog" aria-label="Sparring: ${esc(sp.a.name)} and ${esc(sp.b.name)}">
        <div class="pp-spar-ring" style="background-image:url('art/battle-trainingyard.webp')">
          <div class="pp-spar-side a"><img alt="" src="${petURL(sp.a.species, sp.a.colour, 112, "ok")}"><b>${esc(sp.a.name)}</b><span class="pp-spar-score" data-score="a">0</span></div>
          <div class="pp-spar-side b"><img alt="" src="${petURL(sp.b.species, sp.b.colour, 112, "ok")}"><b>${esc(sp.b.name)}</b><span class="pp-spar-score" data-score="b">0</span></div>
        </div>
        <p class="pp-msg pp-spar-msg" aria-live="polite">The Warden rings the bell.</p>
        <div class="pp-row"><button class="btn btn-sm pp-spar-skip">Skip to the end</button><button class="btn btn-primary pp-modal-close" hidden>Close</button></div></div>`;
    document.body.appendChild(box);
    const msg = box.querySelector(".pp-spar-msg"), score = {a: 0, b: 0}, close = box.querySelector(".pp-modal-close"), skip = box.querySelector(".pp-spar-skip");
    let i = 0, timer = 0;
    const end = () => {
      clearInterval(timer);
      box.querySelector('[data-score="a"]').textContent = sp.a.score; box.querySelector('[data-score="b"]').textContent = sp.b.score;
      const w = sp.win ? sp[sp.win].name : "";
      msg.innerHTML = `${w ? `<b>${esc(w)}</b> takes the bout, ${Math.max(sp.a.score, sp.b.score)} to ${Math.min(sp.a.score, sp.b.score)}.` : "A draw -- the Warden calls it even."} Nobody's hurt. ${esc(sp.got.join(", "))}.`;
      skip.hidden = true; close.hidden = false; close.focus();
    };
    const step = () => {
      if (i >= sp.rounds.length) return end();
      const r = sp.rounds[i++], me = sp[r.by], side = box.querySelector(`.pp-spar-side.${r.by}`);
      score[r.by] += r.pts; box.querySelector(`[data-score="${r.by}"]`).textContent = score[r.by];
      side.classList.remove("go"); void side.offsetWidth; side.classList.add("go");
      msg.textContent = `${me.name}: ${r.move} -- ${r.hit ? `a clean hit (+${r.pts})` : "misses"}.`;
    };
    timer = setInterval(step, 950);
    skip.addEventListener("click", end);
    close.addEventListener("click", () => box.remove());
  }
