  // ---- breeding (2026-10-03) ------------------------------------------------------------------
  let breedA = "", breedB = "";
  // natures and potential (2026-10-08): a pet's sex, nature and five stats, drawn small
  function geneHTML(g, wide) {
    return `<div class="pp-gene">
      <span class="pp-sex ${g.sex}" title="${g.sexName}">${g.sign}</span>
      <span class="pp-nature${g.rare ? " rare" : ""}" title="${esc(g.natureText)}">${esc(g.natureName)}</span>
      ${g.pattern ? `<span class="pp-pattern">✨ ${esc(g.pattern)}</span>` : ""}
      ${wide ? `<span class="stamp">${esc(g.natureText)}</span>` : ""}
      <div class="pp-gpot" title="Potential (hatched pets 0-10, bred up to 15)">${g.stats.map((x) => `<span class="pp-gpot-row"><small>${esc(x.name.slice(0, 3))}</small>
        <span class="pp-gpot-bar"><span style="width:${Math.round(100 * x.value / 15)}%"${x.value > 10 ? ' class="over"' : ""}></span></span><b>${esc(x.value)}</b></span>`).join("")}</div>
    </div>`;
  }
  function renderBreed(host) {
    const {s, now} = current();
    const bv = Core.breedingView(s, now, breedA, breedB);
    const ready = bv.pets.filter((p) => !p.why);
    const opt = (sel) => `<option value="">Choose a pet…</option>` + bv.pets.map((p) =>
      `<option value="${p.id}" ${p.id === sel ? "selected" : ""} ${p.why ? "disabled" : ""}>${p.gene.sign} ${esc(p.name)} — ${esc(p.gene.natureName)} ${esc(p.kind)}, level ${p.level}${p.why ? ` (${esc(p.why)})` : ""}</option>`).join("");
    host.innerHTML = `
      <div class="pp-page">
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${bv.busy ? `<div class="pp-trip"><div class="pp-label">Breeding now</div>
            <div class="pp-trip-line"><b>${esc(bv.busy.a)}</b> and <b>${esc(bv.busy.b)}</b>${bv.busy.special ? " — something feels special ✨" : ""}</div>
            <p class="stamp" id="pp-breed-clock">An egg in ${clock(bv.busy.layIn)}</p></div>` : `
          <section class="pp-shop">
            <div class="pp-breed-pick">
              <select class="input" id="pp-ba">${opt(breedA)}</select><span class="pp-heart">♥</span><select class="input" id="pp-bb">${opt(breedB)}</select>
            </div>
            ${bv.pair ? `<div class="pp-breed-genes">${geneHTML(bv.pair.genes.a, true)}<span class="pp-heart">♥</span>${geneHTML(bv.pair.genes.b, true)}</div>
              ${bv.pair.genes.sexOk ? "" : `<p class="pp-over">It takes a male and a female.</p>`}
              ${bv.pair.genes.rare ? `<p class="pp-why">✨ ${esc(bv.pair.genes.a.natureName)} and ${esc(bv.pair.genes.b.natureName)}: a ${bv.pair.genes.rare.chance}% chance of a
                  <b>${esc(bv.pair.genes.rare.name)}</b> pet (${esc(bv.pair.genes.rare.text)}) — and sometimes the ${esc(bv.pair.genes.rare.pattern)} colouring.</p>` : ""}
              <div class="pp-label">The egg's potential</div>
              <div class="pp-needs">${bv.pair.genes.stats.map((x) => `<span class="pp-need-chip">${esc(x.name)} ${x.lo}–${x.hi}</span>`).join("")}</div>
              <div class="pp-label">What they might lay</div>
              ${bv.pair.special ? `<p class="pp-why">✨ These two are a special pairing — they'll lay a Special egg.</p>` : `<table class="pp-odds"><tbody>${bv.pair.odds.map((o) =>
                `<tr><td>${esc(o.name)}</td><td class="pp-chance">${o.chance}%</td></tr>`).join("")}</tbody></table>`}` : ""}
            ${bv.hatcheryFree > 0 ? "" : `<p class="stamp">The hatchery is full — the egg needs a place.</p>`}
            ${ready.length < 2 ? `<p class="stamp">You need two pets that are ready — 5 days old, at home and rested.</p>` : ""}
            <button class="btn btn-primary" id="pp-breed" ${bv.pair && bv.pair.genes.sexOk && bv.hatcheryFree > 0 ? "" : "disabled"}>Breed</button>
          </section>`}
        <section class="pp-shop">
          <b>Natures</b>
          
          <div class="pp-beasts">${bv.natures.map((n) => `<div class="pp-beast${n.rare && !n.seen ? " unknown" : ""}"><div><b>${esc(n.name)}</b>${n.rare ? ` <span class="pp-guard-tag">Rare</span>` : ""}${n.seen ? " ✓" : ""}</div>
            <div class="stamp">${esc(n.text)}</div>${n.from ? `<div class="stamp">${esc(n.from.join(" × "))}${n.pattern ? ` · ${esc(n.pattern)} colouring` : ""}</div>` : ""}</div>`).join("")}</div>
        </section>
        <section class="pp-shop">
          <b>The breeding book</b>
          
          ${bv.book.map((b) => `<div class="pp-recipe">
              ${b.found ? `<img alt="" src="${petURL(b.kind.split("/")[0], b.kind.split("/")[1], 32)}">` : `<div class="pp-slot-empty" style="display:grid;place-items:center;color:#e8a0bf;font-weight:800">?</div>`}
              <div class="pp-recipe-main"><b>${esc(b.name)}</b><div class="stamp">${esc(b.hint)}</div></div><span></span></div>`).join("")}
        </section>
      </div>`;
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } };
    const a = host.querySelector("#pp-ba"), b = host.querySelector("#pp-bb");
    if (a) a.addEventListener("change", () => { breedA = a.value; render(); });
    if (b) b.addEventListener("change", () => { breedB = b.value; render(); });
    const go = host.querySelector("#pp-breed");
    if (go) go.addEventListener("click", async () => { const r = await act("breed", {a: breedA, b: breedB, roll: Math.random()}); if (!(r && r.error)) { breedA = breedB = ""; } err(r); });
    everySecond("breed");
    if (bv.busy) everySecond("breed", () => {
      if (!host.isConnected || page() !== "pet:breed") return false;
      const c = current(), b2 = Core.breedingView(c.s, c.now);
      if (!b2.busy) return render();
      const el = host.querySelector("#pp-breed-clock"); if (el) el.textContent = `An egg in ${clock(b2.busy.layIn)}`;
    });
  }

  // ---- the farm (2026-10-03) -------------------------------------------------------------------
  function plotURL(p, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    Art.drawPlot(c.getContext("2d"), p, 0, 0, w, h);
    return c.toDataURL();
  }
  const PLOT_WORDS = {weedy: "Weedy", raked: "Raked — ready to till", tilled: "Tilled — ready to plant", growing: "Growing", ripe: "Ready to harvest"};
  function plotLine(p) {
    if (p.state === "weedy") return `Weedy (${p.weed.toLowerCase()})`;
    if (p.state === "growing") return `${p.cropName} · stage ${p.stage + 1} of 4 · ${p.thirsty ? "thirsty — needs water" : `watered, next stage in ${clock(p.stageIn)}`}`;
    if (p.state === "ripe") return `${p.cropName} — ready to harvest`;
    return PLOT_WORDS[p.state];
  }
  function renderFarm(host) {
    const {s, now} = current();
    const fv = Core.farmView(s, now);
    const seeds = fv.seeds.filter((x) => x.have > 0);
    host.innerHTML = `
      <div class="pp-page">
        ${skillPanel("farming", Core.playerView(s, now).skills.farming,
          ["rake", "hoe", "wateringcan"].map((t) => badge(esc(Core.ITEMS[t].name), fv.tools[t] ? "✓" : "✗", fv.tools[t] ? "good" : "bad")).join(""))}
        ${fv.tools.rake && fv.tools.hoe && fv.tools.wateringcan ? "" : `<p class="np-hint">Smith the tools you're missing at the anvil (Village).</p>`}
        ${fv.plots.filter((p) => p.thirsty).length > 1 ? `<div class="pp-row"><button class="btn btn-sm pp-farm" data-op="waterall">Water all (${fv.plots.filter((p) => p.thirsty).length})</button>
          ${fv.tools.steelcan ? "" : `<span class="stamp">A steel watering can (Smithing 22) keeps a crop watered till harvest.</span>`}</div>` : ""}
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <div class="pp-plots">${fv.plots.map((p) => `
          <section class="pp-shop pp-plot">
            <div class="pp-skill-head"><b>Plot ${p.n}</b>${p.state === "growing" ? `<span class="pp-level">${p.stage}/4</span>` : ""}</div>
            <img class="pp-plot-img" alt="" src="${plotURL(p, 192, 128)}">
            <div class="stamp pp-plot-line" data-n="${p.n}">${esc(plotLine(p))}</div>
            <div class="pp-row">
              ${p.next === "rake" ? `<button class="btn btn-sm pp-farm" data-op="rake" data-plot="${p.n - 1}">Rake</button>` : ""}
              ${p.next === "hoe" ? `<button class="btn btn-sm pp-farm" data-op="hoe" data-plot="${p.n - 1}">Hoe</button>` : ""}
              ${p.next === "plant" ? (seeds.length ? `<select class="input pp-plant" data-plot="${p.n - 1}"><option value="">Plant a seed…</option>
                  ${seeds.map((x) => `<option value="${x.id}" ${x.open ? "" : "disabled"}>${esc(x.name)} (${x.have})${x.open ? "" : ` — Farming ${x.level}`}</option>`).join("")}</select>`
                : `<span class="stamp">No seeds — foraging and hunting find them.</span>`) : ""}
              ${p.next === "water" ? `<button class="btn btn-sm pp-farm" data-op="water" data-plot="${p.n - 1}">Water</button>` : ""}
              ${p.state === "growing" && !p.fert && fv.ferts.some((f) => f.have) ? `<select class="input pp-fert" data-plot="${p.n - 1}"><option value="">Fertilise…</option>
                ${fv.ferts.filter((f) => f.have).map((f) => `<option value="${f.id}">${esc(f.name)} (${f.have})</option>`).join("")}</select>` : ""}
              ${p.soak ? `<span class="stamp">Kept watered</span>` : ""}
              ${p.fert ? `<span class="stamp">Fertilised (${Math.round((1 - p.fert) * 100)}% quicker)</span>` : ""}
              ${p.next === "harvest" ? `<button class="btn btn-sm btn-primary pp-farm" data-op="harvest" data-plot="${p.n - 1}">Harvest</button>` : ""}
            </div>
          </section>`).join("")}
          ${fv.unlock ? `<section class="pp-shop pp-plot locked">
            <b>Plot ${fv.unlock.plot}</b>
            <p class="stamp">Fern will dig it at Farming level ${fv.unlock.level}, with ${fv.unlock.soil} soil (you have ${fv.unlock.have}). Digging finds soil.</p>
            <button class="btn btn-sm pp-farm" data-op="unlock" ${fv.unlock.can ? "" : "disabled"}>Ask Fern</button></section>` : ""}
        </div>
        <div class="pp-group"><div class="pp-label">The windowsill — herbs in pots</div>
          <p class="stamp">${fv.pots.length}/${fv.maxPots} pots</p>
          <div class="pp-pots">${fv.pots.map((p) => `
            <div class="pp-pot${p.ready ? " ready" : ""}">
              <img alt="" src="${itemIcon(p.herb || "plantpot", 48)}">
              <b>Pot ${p.n}</b>
              ${p.herb ? `<span class="stamp pp-pot-line" data-n="${p.n}">${esc(p.name)} — ${p.ready ? "ready to pick" : `ready in ${dur(p.readyIn)}`}</span>
                  <span class="pp-bar"><span style="width:${Math.round(p.progress * 100)}%"></span></span>
                  ${p.ready ? `<button class="btn btn-sm btn-primary pp-pot-pick" data-pot="${p.n - 1}">Pick</button>` : ""}`
                : fv.herbSeeds.some((h) => h.have) ? `<select class="input pp-pot-plant" data-pot="${p.n - 1}"><option value="">Plant a herb…</option>
                  ${fv.herbSeeds.filter((h) => h.have).map((h) => `<option value="${h.id}" ${h.open ? "" : "disabled"}>${esc(h.name)} (${h.have}) · ${h.minutes} min${h.open ? "" : ` — Farming ${h.level}`}</option>`).join("")}</select>`
                : `<span class="stamp">Empty — forage for herb seeds.</span>`}
            </div>`).join("")}
            ${fv.pots.length < fv.maxPots ? `<div class="pp-pot add"><img alt="" src="${itemIcon("plantpot", 48)}">
              <span class="stamp">${fv.potsInBag ? `${fv.potsInBag} plant pot${fv.potsInBag === 1 ? "" : "s"} in the bag` : "No plant pots yet"}</span>
              <button class="btn btn-sm pp-farm" data-op="addpot" ${fv.potsInBag ? "" : "disabled"}>Add a pot</button></div>` : ""}
          </div>
          ${fv.sill ? `<div class="pp-row"><button class="btn btn-sm pp-upgrade" data-what="windowsill" ${(s.coins >= fv.sill && fv.sillHave) || (s.dev && s.dev.infinite) ? "" : "disabled"}>Put up a shelf — ${fv.sill.toLocaleString()} coins, ${esc(fv.sillNeeds)}</button>
            <span class="stamp">three more herb pots</span></div>` : ""}</div>
      </div>`;
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } };
    host.querySelectorAll(".pp-farm").forEach((b) => b.addEventListener("click", async () => err(await act("farm", {op: b.dataset.op, plot: +b.dataset.plot || 0, roll: Math.random()}))));
    host.querySelectorAll(".pp-fert").forEach((sel) => sel.addEventListener("change", async () => {
      if (sel.value) err(await act("farm", {op: "fertilise", plot: +sel.dataset.plot, item: sel.value}));
    }));
    host.querySelectorAll(".pp-plant").forEach((sel) => sel.addEventListener("change", async () => {
      if (sel.value) err(await act("farm", {op: "plant", plot: +sel.dataset.plot, seed: sel.value}));
    }));
    host.querySelectorAll(".pp-upgrade").forEach((b) => b.addEventListener("click", async () => err(await act("upgrade", {what: b.dataset.what}))));
    host.querySelectorAll(".pp-pot-pick").forEach((b) => b.addEventListener("click", async () => err(await act("farm", {op: "potpick", pot: +b.dataset.pot, roll: Math.random()}))));
    host.querySelectorAll(".pp-pot-plant").forEach((sel) => sel.addEventListener("change", async () => {
      if (sel.value) err(await act("farm", {op: "potplant", pot: +sel.dataset.pot, seed: sel.value}));
    }));
    everySecond("farm");
    if (fv.plots.some((p) => p.state === "growing") || fv.pots.some((p) => p.herb && !p.ready)) everySecond("farm", () => {
      if (!host.isConnected || page() !== "pet:farm") return false;
      const c = current(), f2 = Core.farmView(c.s, c.now);
      if (f2.plots.some((p, i) => p.state !== fv.plots[i].state || p.stage !== fv.plots[i].stage)) return render();
      if (f2.pots.some((p, i) => fv.pots[i] && p.ready !== fv.pots[i].ready)) return render();
      host.querySelectorAll(".pp-pot-line").forEach((el) => { const p = f2.pots[+el.dataset.n - 1]; if (p && p.herb) el.textContent = `${p.name} — ${p.ready ? "ready to pick" : `ready in ${dur(p.readyIn)}`}`; });
      host.querySelectorAll(".pp-plot-line").forEach((el) => { const p = f2.plots[+el.dataset.n - 1]; if (p) el.textContent = plotLine(p); });
    });
  }

  // ---- your class (2026-10-03) ----------------------------------------------------------------
  function classHTML(pv) {
    // your class is chosen at the Guild hall -- the first free, a switch after it paid (Part 9); one home for it (C4 D2, 2026-10-16)
    if (!pv.cls) return `<div class="pp-classes"><button class="pp-class pp-class-guild"><b>Choose your class</b><span class="stamp">Meet the tutors at the Guild hall in the Village -- your first class is free.</span></button></div>`;
    return `<div class="pp-classes"><div class="pp-class on"><b>${esc(Core.CLASSES[pv.cls].name)}</b><span class="pp-boost">Your class</span>
        <span class="stamp">${esc(Core.CLASSES[pv.cls].about)}</span></div>
      <button class="pp-class pp-class-guild"><b>Change class</b><span class="stamp">The tutors at the Guild hall in the Village${pv.freeSwitch ? " -- your next switch is free" : ""}.</span></button></div>`;
  }

