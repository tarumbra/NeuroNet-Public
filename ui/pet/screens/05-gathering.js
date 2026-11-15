  // ---- the Outskirts: every gathering skill, one card each (2026-10-04) ------------------------
  // Cam: "outskirts (fishing, foraging, lumbering, farming, digging, anything that opens an interface
  // with cards to select materials)"
  function renderOutskirts(host) {
    const {s, now} = current();
    const pv = Core.playerView(s, now);
    if (!pv.made) return renderSkills(host);
    const keys = Core.GATHERING.concat(["farming"]);
    host.innerHTML = `
      <div class="pp-page">
        <div class="pl-out-grid">${keys.map((k) => {
          const q = pv.skills[k], t = pv.tools[k], here = pv.job && !pv.job.hunt && pv.job.skill === k;
          const tool = k === "farming" ? `${((s.farm && s.farm.plots) || []).length} plot${((s.farm && s.farm.plots) || []).length === 1 ? "" : "s"}`
            : t ? `${esc(t.name)} · ${t.stone ? `× ${t.count}` : `${t.left}/${t.dur}`}` : k === "mining" ? "No pickaxe" : k === "lumbering" ? "No hatchet" : k === "foraging" ? "No basket" : "No tool";
          const worn = t && !t.stone && t.left / t.dur < 0.25;
          return `<button class="pl-out${here ? " here" : ""}" data-k="${k}" data-go="${skillHome(k)}">
            <img alt="" src="${itemIcon(SKILL_ICON[k], 48)}">
            <b>${esc(q.name)}</b>
            <span class="pl-out-lv">Level ${q.level}${pv.companionSkill === k ? ` <span class="pl-star">★</span>` : ""}</span>
            <span class="pl-skill-bar"><span class="pp-skill-fill" style="width:${Math.round(q.progress * 100)}%"></span></span>
            <span class="pl-out-tool${worn ? " worn" : ""}">${tool}</span>
            <span class="pl-out-state">${here ? `At the ${esc(pv.job.spotName)}` : ""}</span>
          </button>`;
        }).join("")}</div>
      </div>`;
    host.querySelectorAll(".pl-out").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.go)));
  }
  function toolText(pv, k) {
    return pv.tools[k] ? `Carrying: ${esc(pv.tools[k].name)} (${esc(pv.tools[k].does)})${pv.tools[k].stone ? ` — ${pv.tools[k].count} left` : ` — ${pv.tools[k].left}/${pv.tools[k].dur}`}`
      : k === "mining" ? "<b class=\"pp-lock\">You need a pickaxe for ore</b> — stone, flint and clay come by hand; make a stone pickaxe at your Crafting bench, or smelt bronze bars and smith one at the anvil."
      : k === "lumbering" ? "No hatchet — trees give only twigs until you make one (a stone hatchet at your bench, or bronze at the anvil)."
      : "No tool — you make them in the village.";
  }
  /** The tool badge: its name and how much wear it has left (a stone tool: how many you have). */
  function toolBadge(t) {
    if (!t) return badge("Tool", "None", "bad");
    const left = t.stone ? `× ${t.count}` : `${t.left}/${t.dur}`;
    const tone = t.stone ? "warn" : t.left / t.dur < 0.25 ? "bad" : t.left / t.dur < 0.5 ? "warn" : "good";
    return badge("Tool", `${esc(t.name)} · ${left}`, tone);
  }
  /** Mending (2026-10-04): half its making, before it breaks. */
  function mendHTML(t) {
    if (!t || !t.repair) return "";
    return `<p class="np-hint pp-mend">Worn: ${t.left}/${t.dur} left. Mend it at the ${esc(t.repair.where.toLowerCase())} for ${esc(t.repair.needs)}${t.repair.fee ? ` and ${t.repair.fee} coins` : ""}.
      <button class="btn btn-sm" data-mend="${t.id}" ${t.repair.can ? "" : "disabled"}>Mend it</button></p>`;
  }
  // the trip and every skill's xp, live (Cam: "i want it to auto update everytime i get exp")
  function liveSkills(host, pv, pageKey) {
    everySecond("trip");
    everySecond("trip", () => {
      if (!host.isConnected || page() !== pageKey) return false;
      const c = current(), p2 = memo("playerView", c.s, c.now);
      const box = host.querySelector("#pp-trip");
      if (box) { const t = tripHTML(p2, pageKey.slice(4)); box.innerHTML = t; box.hidden = !t; }
      const cb = host.querySelector(".np-card.here .np-card-bar span"), j2 = p2.job;
      if (cb && j2 && j2.every) cb.style.width = Math.round(100 * (1 - j2.nextIn / j2.every)) + "%";
      Core.SKILL_ORDER.forEach((k) => {
        const card = host.querySelector(`.pp-skill[data-k="${k}"], .pl-skill[data-k="${k}"]`), sk = p2.skills[k];
        if (!card) return;
        card.querySelector(".pp-skill-fill").style.width = Math.round(sk.progress * 100) + "%";
        card.querySelector(".pp-skill-xp").textContent = skillXpText(sk);
      });
      // a find made a level, or the trip ended: draw it all again
      const levels = Core.SKILL_ORDER.map((k) => p2.skills[k].level).join(), was = Core.SKILL_ORDER.map((k) => pv.skills[k].level).join();
      if (levels !== was || !!p2.job !== !!pv.job) render();
    });
  }

  // ---- a page for each gathering skill: a card for each area (2026-10-03) ------------------
  // Cam: "add a new menu for each skill for example Digging, which will provide a card structure that
  // has a card for each area (areas will be broken down into sub areas ...)" -- and each area's
  // essence spot, opened by beating its boss 50 times.
  function renderGather(host, k) {
    const {s, now} = current();
    const pv = Core.playerView(s, now);
    if (!pv.made) return renderSkills(host);
    const sk = pv.skills[k], hunts = Core.huntsView(s);
    // Melvor's cards (Cam: "break the pages into cards with those materials like malvor idle"): one per
    // material -- what you do, what you get, xp and seconds, the tool and bait it needs, a bar while you're there
    const MATERIAL = k === "fishing" || k === "mining" || k === "lumbering" || k === "foraging";
    const job = pv.job && !pv.job.hunt && pv.job.skill === k ? pv.job : null;
    const card = (sp) => {
      const here = job && job.spot === sp.id, it = Core.ITEMS[sp.main];
      const title = sp.essence ? sp.name : MATERIAL ? it.name.replace(/^Raw /, "") : sp.name;
      const verb = sp.essence ? "Gather" : METHOD_VERB[sp.method] || "Go";
      const blocked = sp.open ? sp.missing : sp.lock;
      const chip = (id, n) => `<span class="np-need${n === 0 ? " lack" : ""}" title="${esc(Core.ITEMS[id].name)}"><img alt="" src="${itemIcon(id, 16)}">${n == null ? "" : n}</span>`;
      const have = (id) => (s.dev && s.dev.infinite) ? 999 : (s.bag[id] || 0);
      const pct = here && job.every ? Math.round(100 * (1 - job.nextIn / job.every)) : 0;
      return `<button class="np-card${sp.essence ? " essence" : ""}${sp.open ? "" : " locked"}${here ? " here" : ""}${blocked ? " blocked" : ""}" data-spot="${sp.id}"
          ${sp.open && !here && !sp.missing ? "" : "aria-disabled=\"true\""} title="${esc(blocked || (here ? "You're here" : "Go"))}">
        <span class="np-card-verb">${esc(verb)}</span>
        <span class="np-card-title">${esc(title)}</span>
        <span class="np-card-sub">${sp.open ? `${sp.xp} XP / ${sp.time} SECONDS` : `LEVEL ${sp.level}`}</span>
        <img class="np-card-icon" alt="" src="${itemIcon(sp.main, 48)}">
        ${MATERIAL && !sp.essence ? `<span class="np-card-place">${esc(sp.name)}</span>` : ""}
        <span class="np-card-needs">${sp.needs ? chip(sp.needs, have(sp.needs) || sp.hand ? null : 0) : ""}${sp.hand && !have(sp.needs) ? `<span class="np-need" title="No net: you fish here by hand -- slower, shrimp and minnows only">By hand</span>` : ""}${sp.bait ? chip(sp.bait, have(sp.bait)) : ""}
          ${sp.toolTier ? `<span class="np-need${blocked && /or better/.test(blocked) ? " lack" : ""}">${k === "foraging" ? ["", "Twig", "Willow", "Maple", "Yew"][sp.toolTier] + " basket" : ["", "Bronze", "Iron", "Steel", "Mithril", "Adamant", "Rune"][sp.toolTier] + " tool"}</span>` : ""}
          ${sp.wears ? `<span class="np-need" title="Above your tool's tier: each find here costs ${sp.wears} durability -- the further above, the faster it climbs (1, 3, 6, 10)">Wears your tool ×${sp.wears}</span>` : ""}</span>
        <span class="np-card-drops">${sp.loot.slice(MATERIAL ? 1 : 0).map((d) => `<img alt="" title="${esc(Core.ITEMS[d].name)}" src="${itemIcon(d, 16)}">`).join("")}
          ${sp.rare ? `<img alt="" class="pp-rare-ic" title="Rare: ${esc(Core.ITEMS[sp.rare].name)}" src="${itemIcon(sp.rare, 16)}">` : ""}</span>
        <span class="np-card-state">${here ? "You're here" : blocked ? esc(blocked) : ""}</span>
        <span class="np-card-bar"><span style="width:${pct}%"></span></span>
      </button>`;
    };
    host.innerHTML = `
      <div class="pp-page">
        ${skillPanel(k, sk, (k === "runecrafting" ? "" : toolBadge(pv.tools[k]))
          + (pv.companionSkill === k ? badge("Companion", `+${Math.round((sk.boost || 0.1) * 100)}% xp`, "pink") : ""))}
        ${k === "runecrafting" ? `<p class="np-hint">Each essence stone you carry becomes a handful of runes at a shrine -- mine them at the Essence rocks (Meadow); the higher shrines need pure essence (Crystal Caves).</p>`
          : !pv.tools[k] ? `<p class="np-hint">${toolText(pv, k)}</p>` : mendHTML(pv.tools[k])}
        ${potionLine(pv, s, "gather")}
        <div class="pp-trip" id="pp-trip" ${tripHTML(pv, k) ? "" : "hidden"}>${tripHTML(pv, k)}</div>
        ${pv.job && !pv.job.hunt && pv.job.skill === k ? `<button class="btn" id="pp-home">Come home</button>` : ""}
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        ${Core.REGION_ORDER.filter((a) => sk.spots.some((sp) => sp.area === a)).map((a) => {   // by region of the world map (2026-10-07)
          const g = {name: Core.REGIONS[a].name}, spots = sk.spots.filter((sp) => sp.area === a);
          return `<section class="np-area${job && spots.some((sp) => sp.id === job.spot) ? " here" : ""}">
            <h3 class="np-area-h">${esc(g.name)} <small>${spots.filter((sp) => !sp.essence).map((sp) => sp.level).join(" · ")}</small></h3>
            <div class="np-cards">${spots.map(card).join("")}</div>
          </section>`;
        }).join("")}
      </div>`;
    const home = host.querySelector("#pp-home");
    if (home) home.addEventListener("click", () => act("home"));
    host.querySelectorAll(".pp-drink").forEach((b) => b.addEventListener("click", async () => {
      const r = await act("drink", {item: b.dataset.item});
      if (r && r.error) toast(r.error, true);
    }));
    // (2026-10-10 audit, H-5) a skill's page is a guide now, not a shortcut past the world: a card says where the place is
    host.querySelectorAll(".np-card[data-spot]").forEach((b) => b.addEventListener("click", () => {
      if (b.classList.contains("here")) return;
      const sp = Core.SKILLS[k].spots.find((x) => x.id === b.dataset.spot), reg = sp && Core.REGIONS[sp.area];
      toast(`The ${sp ? sp.name : "spot"} is in the ${reg ? reg.name : "world"} — travel there on the Map to ${(Core.SKILLS[k].verb || "gather").replace(/ing$/, "")} there.`);
    }));
    liveSkills(host, pv, "pet:" + k);
  }
  const METHOD_VERB = {net: "Net", bait: "Bait", fly: "Fly fish", cage: "Cage", harpoon: "Harpoon", mine: "Mine", cut: "Cut", pick: "Pick", dig: "Dig"};
  /** A skill's panel, Melvor-style: LEVEL and XP badges, anything else, one long bar. */
  function skillPanel(k, sk, extra) {
    return `<div class="np-panel pp-skill np-skillpanel" data-k="${k}">
      <div class="np-sp-row">
        <span class="np-sp-stat">Level <b class="np-badge good">${sk.level} / ${Core.MAX_LEVEL}</b></span>
        <span class="np-sp-stat">XP <b class="np-badge info">${sk.xp.toLocaleString()}</b></span>
        ${extra || ""}
      </div>
      <div class="np-sp-bar"><span class="pp-skill-fill" style="width:${Math.round(sk.progress * 100)}%"></span></div>
      <div class="np-sp-sub pp-skill-xp">${skillXpText(sk)}</div>
    </div>`;
  }
  const badge = (label, val, kind) => `<span class="np-sp-stat">${label} <b class="np-badge ${kind || ""}">${val}</b></span>`;
  function skillXpText(sk) { return `${sk.xp.toLocaleString()} xp${sk.toNext ? ` · ${sk.toNext.toLocaleString()} to level ${sk.level + 1}` : " · top level"}`; }
  function trainingSkill(pv) {
    const j = pv.job;
    if (!j) return "";
    if (!j.hunt) return j.skill;
    return pv.combat && pv.combat.style === "defensive" ? "defence" : pv.weapon && pv.weapon.style === "ranged" ? "ranged" : "attack";
  }

  /** The button a thing in the bag gets: feed it, give it, carry it, wear it, place it. */
  /** What you can do with a thing in the bag, as {act, label, on} -- or {note} (Modernize/Reduce Nav: one list for the bag's button,
      the item sheet and the side panel's right-click menu). */
  function bagActs(it, pv, canFeed, v) {
    const out = [];
    const html = bagAction(it, pv, canFeed, v), m = /data-act="([^"]+)"[^>]*>([^<]*)</.exec(html);
    if (m) out.push({act: m[1], label: m[2].replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'), on: /pp-bag-act on/.test(html)});
    else if (html) out.push({note: html.replace(/<[^>]+>/g, "")});
    if (!out.some((x) => x.act === "usewith") && (Core.fieldPartners(current().s, it.id).length || Core.fieldInvolved(it.id) || benchUses(it.id))) out.push({act: "usewith", label: "Use with…"});   // (a bench too, Q6)
    return out;
  }
  /** Do a bag action on a thing (the bag, the item sheet, the side panel all come here). */
  async function doBagAct(a, id) {
    if (a === "open") return openCrate(id);
    if (a === "readbook") return openBook(Core.ITEMS[id].book);
    if (a === "readguide") return openGuide();           // a class book: anywhere (Part 9)
    if (a === "tool") return act("battle", {cmd: "tool", item: id});      // a trap, a net, a throwing knife: your next turn (N22)
    if (a === "usewith") { if (!startUse(id)) return; if (typeof kitRender === "function") kitRender(); return kitShow("bag"); }   // field recipes (V2)
    return a === "feed" ? act("feed", {food: id}) : a === "hatchegg" ? act("hatch", {egg: Core.ITEMS[id].egg, roll: Math.random()})
      : a === "combine" ? act("combine", {item: id, all: true}) : act(a, {item: id});
  }
  function bagAction(it, pv, canFeed, v) {
    const b = (act, label, on, full) => `<button class="btn btn-sm pp-bag-act${on ? " on" : ""}" data-act="${act}" data-item="${it.id}"${full ? ` title="${esc(full)}"` : ""}>${esc(label)}</button>`;   // (a short label, the whole thing on hover: audit NP UX-1)
    if (pv.battle && Core.ITEMS[it.id].heal && !pv.battle.pack) return b("eat", "Eat it", false, "It costs your next attack");   // N22: in a fight, food is for you
    if (Core.ITEMS[it.id].ageUp && canFeed && v.stage !== "hatchling") return `<span class="stamp">For a hatchling</span>`;   // grows one up (2026-10-09)
    if (it.kind === "food") return canFeed ? b("feed", "Feed", false, `Feed ${v.name}`) : "";
    if (Core.ITEMS[it.id].ageUp && !Core.ITEMS[it.id].potion) return canFeed ? b("use", "Use", false, `Use on ${v.name}`) : "";
    if (it.kind === "potion") return canFeed ? b("use", "Give", false, `Give to ${v.name}`) : "";
    if (it.kind === "brew") return pv.brews && Object.values(pv.brews).some((x) => x.id === it.id) ? b("drink", "Drink another", true) : b("drink", "Drink it");
    if (it.kind === "heal") return b("eat", Core.ITEMS[it.id].verb || !/potion|blood/i.test(it.name) ? "Use it" : "Drink it");   // a bandage or a balm isn't drunk
    if (it.kind === "tool") {
      const sk = Core.ITEMS[it.id].tool.skill;
      return pv.tools[sk] && pv.tools[sk].id === it.id ? b("unequip", "Carrying ✓", true) : b("equip", "Carry it");
    }
    if (it.kind === "gear") {
      const g = Core.ITEMS[it.id].gear;
      const worn = g.who === "pet" ? (v.gear || []).find((x) => x.slot === g.slot) : pv.gear.find((x) => x.slot === g.slot);
      if (worn && worn.item && worn.item.id === it.id) return b("unequip", "Wearing ✓", true);
      if (g.who === "pet" && !(v.gear || []).some((x) => x.slot === g.slot)) return `<span class="stamp">${v.has && v.stage !== "egg" ? "Doesn't fit " + esc(v.name) : "For a pet"}</span>`;
      return b("equip", g.who === "pet" ? "Put on" : "Wear it", false, g.who === "pet" ? `Put on ${v.name}` : "");
    }
    if (Core.ITEMS[it.id].hunterTool) return pv.battle ? b("tool", Core.ITEMS[it.id].hunterTool.kind === "trap" ? "Lay it" : "Throw it", false, "Your next turn, in this fight") : "";   // N22: from the bag, not a menu
    if (it.kind === "crate") return b("open", "Open it");
    if (it.kind === "seed") return "";
    if (it.kind === "scroll") return b("learn", "Read it");
    if (it.kind === "frag") return it.count >= 5 ? b("combine", it.count >= 10 ? `Combine all (${Math.floor(it.count / 5)})` : "Combine 5") : `<span class="stamp">${5 - it.count} more to combine</span>`;
    if (it.kind === "egg") return b("hatchegg", v.has ? "Put in the Hatchery" : "Hatch it");
    if (Core.ITEMS[it.id].book) return b("readbook", "Read it");
    if (Core.ITEMS[it.id].guide) return b("readguide", "Read it");        // How to Play (2026-10-20)           // a class book (Part 9)
    if (Core.ITEMS[it.id].bless && pv.paladin) return b("bless", pv.bless ? `Bless again (${pv.bless.left} hits left)` : "Bless your blade");   // holy water (Part 8)
    if (Core.ITEMS[it.id].coat && pv.canCoat) return b("coat", pv.coat && pv.coat.id === it.id ? `Coat again (${pv.coat.left} hits left)` : "Coat your blades");   // a Thief's poisons (Part 7)
    if (Core.fieldPartners(current().s, it.id).length || Core.fieldInvolved(it.id) || benchUses(it.id)) return b("usewith", "Use with…");   // (or a bench that makes something from it: Q6)   // field recipes (V2) -- offered on anything in one, known or not (PT14 b4)
    if (it.kind === "furniture") return pv.room[Core.ITEMS[it.id].furniture] ? `<span class="stamp">One's in the room</span>` : b("place", "Put in the room");
    return "";
  }

