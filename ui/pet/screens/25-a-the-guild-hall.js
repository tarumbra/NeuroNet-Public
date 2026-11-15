  // ---- the Guild hall (Battle Re-work Part 9, 2026-10-16) ---------------------------------------------------------------
  //      Cam (Q2): "An explanation of the class, some smug talk as to why it is the best class. A natural banter between
  //      them. Also the guild hall should have specific craft benches in there where class specific tools, weapons, spells,
  //      equipment are made. They only show class specific craftables and none of the extras." V1 (carried 10-1): a book on
  //      each class, bought here, read from the bag anywhere. Three parts: the Tutors, the Benches, the Books.
  let guildTab = "tutors", guildBench = "";
  function renderGuild(host) {
    const {s, now} = current();
    const g = Core.guildView(s, now), gm = g.guildmaster;
    if (!guildBench) guildBench = g.cls && g.benches.some((b) => b.cls === g.cls) ? g.cls : g.benches[0].cls;
    const price = (p) => p.free ? `free (${esc(p.free)})` : `${p.coins.toLocaleString()} coins, ${esc(Core.itemsText ? Core.itemsText(p.items) : Object.keys(p.items).map((k) => p.items[k] + " × " + Core.ITEMS[k].name).join(", "))}${p.back ? " -- half: you've played it" : ""}`;
    const need = (q) => q.needs.map((x) => `${esc(x.text)} ${x.have}/${x.need}`).join(" · ");
    const tutor = (t) => `<section class="pp-shop gh-tutor${t.you ? " you" : ""}">
        <div class="pp-shop-head"><img class="pp-npc" alt="" src="${avatarURL(t.look, 64)}">
          <div><b>${esc(t.standIn)}</b> <span class="stamp">${esc(t.title)} · ${esc(t.name)}</span>
            <div class="gh-banter">“${esc(t.banter)}”</div></div></div>
        ${t.met ? `<p class="stamp gh-smug">“${esc(t.smug)}”</p>` : ""}
        <div class="pp-row">
          <button class="btn btn-sm" data-talk="${t.cls}">${t.met ? "Talk again" : "Talk"}</button>
          ${t.you ? `<span class="pp-boost">Your class · level ${t.level}</span>${Core.CLASS_TUTORIALS[t.cls] && !(s.classTut && s.classTut.on) ? `<button class="btn btn-sm" data-glesson="${t.cls}" title="${esc(t.standIn)} walks you through it, step by step">Show me how it works</button>` : ""}`
            : `<button class="btn btn-sm${g.cls ? "" : " btn-primary"}" data-become="${t.cls}" title="${g.cls ? price(t.price) : "Your first class is free"}">Become a${/^[AEIOU]/.test(t.name) ? "n" : ""} ${esc(t.name)}</button>
               <span class="stamp">${g.cls ? price(t.price) : "your first class is free"}</span>`}
        </div>
        <div class="gh-quest stamp"><b>${esc(t.quest.name)}</b>${t.quest.done ? " ✓ done" : t.quest.forYou ? ` -- ${need(t.quest)} ${t.quest.can ? `<button class="btn btn-sm btn-primary" data-gquest="${t.cls}">Hand it in</button>` : ""}` : ` -- for ${esc(Core.clsPlural(t.cls))}`}</div>
      </section>`;
    const bench = g.benches.find((b) => b.cls === guildBench) || g.benches[0];
    host.innerHTML = `
      <div class="pp-page gh-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${paintedHTML("guildhall", [{key: "guildmaster", name: gm.name}, {key: "necro", name: "The Necromancy corner"}]
          .concat(g.tutors.map((t) => ({key: "tutor:" + t.cls, name: `${t.standIn} -- the ${t.name}`, note: t.you ? "Your class" : t.met ? "" : "Not met yet"}))))}
        <section class="pp-shop gh-master">
          <div class="pp-shop-head"><img class="pp-npc" alt="" src="${avatarURL(gm.look, 64)}">
            <div><b>${esc(gm.name)}</b><div class="stamp">“${esc(gm.says)}”</div></div></div>
          ${g.tourDone ? `<p class="stamp">You've met the whole Guild.</p>` : `<p class="stamp"><b>${esc(gm.tour.name)}</b> -- ${esc(gm.tour.text)} <b>${g.met}/${g.of}</b> met.
            ${g.met >= g.of ? `<button class="btn btn-sm btn-primary" data-gquest="tour">Tell the Guildmaster</button>` : ""}</p>`}
          ${g.freeSwitch && g.cls ? `<p class="stamp">Your next switch of class is free.</p>` : ""}
          ${g.sandbox ? `<p class="stamp">The sandbox: switching class is free and instant.</p>` : ""}
          ${g.island ? `<p class="stamp">You're away from the main island -- the Guild hall is here when you're home.</p>` : ""}
        </section>
        <div class="pl-tabs gh-tabs" role="tablist">${[["tutors", "Tutors"], ["benches", "Class benches"], ["books", "Class books"]].map(([k, n]) =>
          `<button class="pl-tabbtn${guildTab === k ? " on" : ""}" data-gtab="${k}">${n}</button>`).join("")}</div>
        ${guildTab === "tutors" ? `<div class="gh-tutors">${g.tutors.map(tutor).join("")}</div>
          ` : ""}
        ${guildTab === "benches" ? `<section class="pp-shop gh-panel"><div class="pp-row gh-benchpick">${g.benches.map((b) => `<button class="btn btn-sm${b.cls === guildBench ? " btn-primary" : ""}" data-gbench="${b.cls}">${esc(b.name)}</button>`).join("")}</div>
          
          ${gridBenchHTML("guild:" + bench.cls, [{id: "r", label: bench.name, items: bench.recipes.map((r) => ({key: r.workshop + ":" + r.i, icon: itemIcon(r.make, 48), name: r.name, corner: r.level, lock: !r.open, can: r.can, r})), empty: "Nothing for this class at your benches yet."}], (it) => { const r = it.r;
            return gbHead(itemIcon(r.make, 64), `${r.n > 1 ? r.n + " × " : ""}${esc(r.name)}`, [esc(r.bench), `level ${r.level}`, r.fee ? coinTxt(r.fee) : ""])
              + `<div class="pp-label">Materials</div>${r.needs.map((n) => gbMat(n.id, `${esc(n.name)} ${n.have}/${n.need}`, n.have >= n.need)).join("")}
              <button class="btn btn-primary pp-bmake" data-gmake="${esc(r.make)}" data-gws="${esc(r.workshop)}" data-gi="${r.i}" ${r.can ? "" : "disabled"}>${r.open ? "MAKE" : "LEVEL " + r.level}</button>`; })}</section>` : ""}
        ${guildTab === "books" ? `<section class="pp-shop gh-panel"><div class="gh-books">${g.books.map((b) => `<div class="pp-recipe"><img alt="" src="${itemIcon(b.id, 32)}">
            <div class="pp-recipe-main"><b>${esc(b.name)}</b><div class="stamp">Everything about the ${esc(Core.CLASSES[b.cls].name)}: its tree, every talent's numbers, specials, techniques, builds -- read it from your bag, anywhere.</div></div>
            ${b.have ? `<button class="btn btn-sm" data-gread="${b.cls}">Read</button>` : `<button class="btn btn-sm" data-gbuy="${b.id}">Buy (${b.price} coins)</button>`}</div>`).join("")}</div></section>` : ""}
      </div>`;
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } return r; };
    host.querySelectorAll("[data-gtab]").forEach((b) => b.addEventListener("click", () => { guildTab = b.dataset.gtab; renderGuild(host); }));
    wirePainted(host, async (k) => {                                    // Cam's painting of the hall (2026-10-16): a corner is its tutor
      if (k === "guildmaster") { const el = host.querySelector(".gh-master"); if (el) el.scrollIntoView({block: "start", behavior: "smooth"}); return; }
      if (k === "necro") return toast("A dim corner with candles and a skull. Sorceress Nyx teaches Necromancy -- beat her at the mage tower first.");
      const t = g.tutors.find((x) => "tutor:" + x.cls === k); if (!t) return;
      await act("guildmet", {cls: t.cls}); openTalk(t);
    });
    host.querySelectorAll("[data-gbench]").forEach((b) => b.addEventListener("click", () => { guildBench = b.dataset.gbench; renderGuild(host); }));
    host.querySelectorAll("[data-talk]").forEach((b) => b.addEventListener("click", async () => {
      const t = g.tutors.find((x) => x.cls === b.dataset.talk);
      await act("guildmet", {cls: t.cls});
      openTalk(t);
    }));
    host.querySelectorAll("[data-become]").forEach((b) => b.addEventListener("click", async () => {
      const t = g.tutors.find((x) => x.cls === b.dataset.become);
      if (g.cls && !t.price.free && !await askYes(`Become a${/^[AEIOU]/.test(t.name) ? "n" : ""} ${t.name}? It costs ${price(t.price).replace(/<[^>]+>/g, "")}. Your ${Core.CLASSES[g.cls].name} keeps its level and tree for when you come back.`)) return;
      err(await act("class", {cls: t.cls, guild: true}));
    }));
    host.querySelectorAll("[data-glesson]").forEach((b) => b.addEventListener("click", async () => err(await act("classtut", {op: "start", cls: b.dataset.glesson}))));
    host.querySelectorAll("[data-gquest]").forEach((b) => b.addEventListener("click", async () => err(await act("guildquest", {cls: b.dataset.gquest}))));
    host.querySelectorAll("[data-gbuy]").forEach((b) => b.addEventListener("click", async () => err(await act("guildbuy", {item: b.dataset.gbuy}))));
    host.querySelectorAll("[data-gread]").forEach((b) => b.addEventListener("click", () => openBook(b.dataset.gread)));
    host.querySelectorAll(".pp-gbench").forEach((g) => gridBenchWire(host, g.dataset.gb, () => renderGuild(host)));   // (2026-10-20)
    host.querySelectorAll("[data-gmake]").forEach((b) => b.addEventListener("click", async () => err(await act("craft", {workshop: b.dataset.gws, make: b.dataset.gmake, i: +b.dataset.gi}))));
  }
  /** A tutor's words: who they are, the class, and why it's the best (it isn't, say the others). */
  function openTalk(t) {
    document.querySelectorAll(".pp-item-sheet").forEach((x) => x.remove());
    const box = document.createElement("div");
    box.className = "pp-modal pp-item-sheet";
    box.innerHTML = `<div class="pp-modal-card pp-sheet" role="dialog" aria-label="${esc(t.standIn)}">
        <button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
        <div class="pp-sheet-head"><img alt="" src="${avatarURL(t.look, 64)}"><div><b>${esc(t.standIn)}</b><div class="stamp">${esc(t.title)} -- the ${esc(t.name)}'s tutor is ${esc(t.real)}</div></div>${t.realPic ? `<img class="gh-real" alt="${esc(t.real)}" title="${esc(t.real)}" src="${itemIcon("obj_p" + t.realPic, 64)}">` : ""}</div>
        <div class="gh-talk"><p>“${esc(t.intro)}”</p><p><b>“${esc(t.smug)}”</b></p><p class="stamp">“${esc(t.banter)}”</p>
          <p class="stamp">${esc(t.quest.name)}: ${esc(t.quest.text)}</p></div></div>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    box.querySelector(".pp-shop-x").addEventListener("click", close);
    box.querySelector(".pp-shop-x").focus();
    const h = document.querySelector("#np-host"); if (h && SS.Pet.view === "pet:guild") renderGuild(h);
  }
  /** A class's book: made from the game's own data (V1), read anywhere -- a real book (Cam, 2026-10-17: "It should open up with
   *  a stylized popup, there should be pages and arrows in the bottom right for going forward and bottom left for going
   *  backwards"). at "spells": open at the Arcane's spells (the Library's Spellbook, C4 D5). Arrow keys turn the pages too. */
  function openBook(cls, at) {
    const pages = classBookPages(cls);
    if (!pages.length) return;
    openPages(pages, `The ${Core.CLASSES[cls].name}'s book`, Math.max(0, at === "spells" ? pages.findIndex((p) => p.spells) : 0));
  }
  /** A book of pages ({head, html}) in the leather reader: the class books, and How to Play (2026-10-20). */
  function openPages(pages, label, start, extra) {
    document.querySelectorAll(".pp-item-sheet").forEach((x) => x.remove());
    let n = start || 0;
    const box = document.createElement("div");
    box.className = "pp-modal pp-item-sheet gh-bookmodal" + (extra ? " " + extra : "");
    box.innerHTML = `<div class="pp-modal-card gh-book gh-tome" role="dialog" aria-label="${esc(label)}">
        <button class="btn btn-quiet btn-sm pp-shop-x" aria-label="Close">✕</button>
        <div class="gh-page" aria-live="polite"></div>
        <div class="gh-book-foot">
          <button class="gh-turn gh-back" aria-label="The page before">◀</button>
          <span class="gh-folio"></span>
          <button class="gh-turn gh-next" aria-label="The next page">▶</button>
        </div></div>`;
    document.body.appendChild(box);
    const page = box.querySelector(".gh-page"), back = box.querySelector(".gh-back"), next = box.querySelector(".gh-next"), folio = box.querySelector(".gh-folio");
    const close = () => box.remove();
    const show = (k, dir) => {
      n = Math.max(0, Math.min(pages.length - 1, k));
      const P = pages[n];
      page.innerHTML = `<div class="gh-running">${esc(P.head)}</div>${P.html}`;
      page.className = "gh-page" + (dir ? " turn-" + dir : "");
      page.scrollTop = 0;
      back.disabled = n === 0; next.disabled = n === pages.length - 1;
      folio.textContent = `${n + 1} / ${pages.length}`;
      page.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => { close(); if (b.dataset.sheetTab) { sheetTab = b.dataset.sheetTab; sheetFrom = b.dataset.jump; } goTo(b.dataset.jump); }));
      page.querySelectorAll("[data-bookto]").forEach((b) => b.addEventListener("click", () => show(+b.dataset.bookto, "next")));
    };
    back.addEventListener("click", () => show(n - 1, "back"));
    next.addEventListener("click", () => show(n + 1, "next"));
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); show(n + 1, "next"); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); show(n - 1, "back"); }
    });
    box.querySelector(".pp-shop-x").addEventListener("click", close);
    show(n);
    (n ? next : next.disabled ? back : next).focus();
  }
  /** A class book's pages: the title page (with its contents), the specials, a page for each branch of the tree, the
   *  techniques and builds, the class's own things -- and the Arcane's spells, a few a page. */
  function classBookPages(cls, noToc) {
    const k = Core.classBookView(cls);
    if (!k) return [];
    const types = (t) => Object.keys(t || {}).map((x) => Core.DTYPES[x].toLowerCase()).join(", ") || "nothing";
    const pages = [];
    pages.push({head: `The ${k.name}`, title: "", html: `<div class="gh-title"><img alt="" src="${itemIcon(cls + "book", 96)}"><h2>The ${esc(k.name)}'s Book</h2>
        <p class="stamp">${esc(k.about)}</p></div>
        <blockquote>“${esc(k.intro)}” — <b>“${esc(k.smug)}”</b></blockquote>
        <p class="stamp">Resists ${esc(types(k.resist))}; weak to ${esc(types(k.weak))}. Tutor: ${esc(k.tutor)} (in the Guild hall: ${esc(k.standIn)}).</p>`});
    pages.push({head: "Specials", html: `<h3>Specials</h3><p class="stamp">Paid from ${k.meter === "special bar" ? "the special bar" : "your " + esc(k.meter)}.</p>
        <ul>${k.specials.map((x) => `<li><b>${esc(x.name)}</b> -- ${x.cost}${k.meter === "special bar" ? "%" : " " + esc(k.meter)}${x.style ? ` · ${x.style === "melee" ? "melee weapons" : "a bow"} only` : ""}${x.minLevel ? ` · from class level ${x.minLevel}` : ""}. ${esc(x.about)}</li>`).join("")}</ul>
        <h3>The tree</h3><p class="stamp">A talent point every ${k.rules.pointsEvery} class levels. A tier opens once its branch has the points shown. Respec free to class level ${k.rules.freeRespecTo}.</p>`});
    k.branches.forEach((b) => pages.push({head: `The tree: ${b.name}`, html: `<h3>${esc(b.name)}</h3><p class="stamp">${esc(b.about)}</p>
        <ul>${b.nodes.map((nd) => `<li><b>${esc(nd.name)}</b>${nd.keystone ? " (keystone)" : ""} -- ${nd.tier ? `tier ${nd.tier} (${nd.gate} points in the branch)` : "open from the start"}, ${nd.ranks} rank${nd.ranks === 1 ? "" : "s"}${nd.parent ? `, after ${esc(nd.parent)}` : ""}${nd.choice ? `; or ${esc(nd.choice)}, not both` : ""}.
          ${esc(nd.about)} <span class="stamp">(${esc(nd.perRank)} a rank)</span></li>`).join("")}</ul>`}));
    pages.push({head: "Techniques and builds", html: `<h3>Techniques</h3><p class="stamp">Learned for good by putting a point in their node; another class can slot them at ${Math.round(k.rules.offClass * 100)}%.</p>
        <ul>${k.techniques.map((t) => `<li><b>${esc(t.name)}</b> (learned at ${esc(t.node)}): ${esc(t.about)}</li>`).join("")}</ul>
        <h3>Builds</h3><ul>${k.builds.map((b) => `<li><b>${esc(b.name)}</b>: ${esc(b.text)}</li>`).join("")}</ul>`});
    pages.push({head: `The ${k.name}'s own things`, html: `<h3>The ${esc(k.name)}'s own things</h3><p>${k.gear.map(esc).join(", ")}</p>`});
    if (cls === "arcane") {
      const all = Core.spellbookView(current().s).spells.length, per = 6;
      for (let f = 0; f < all; f += per) pages.push({head: "Spells", spells: f === 0, html: `<div class="gh-spells">${spellbookRefHTML(f, f + per)}</div>`});
    }
    // the title page's contents: a line to each chapter (its first page)
    if (noToc) return pages;
    const toc = [];
    pages.forEach((p, i) => { if (i && !toc.some((t) => t.head === p.head)) toc.push({head: p.head, i}); });
    pages[0].html += `<h3>Contents</h3><ol class="gh-toc">${toc.map((t) => `<li><button class="np-link" data-bookto="${t.i}">${esc(t.head)}</button> <span class="stamp">${t.i + 1}</span></li>`).join("")}</ol>`;
    return pages;
  }
  /** A class book, as one page of text (kept for anything that wants it whole). */
  function classBookHTML(cls) { return classBookPages(cls, true).map((p) => p.html).join(""); }
