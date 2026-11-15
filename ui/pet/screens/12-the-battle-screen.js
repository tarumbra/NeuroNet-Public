  // ---- the battle screen (2026-10-03) ---------------------------------------------------
  // Cam: "Flash out the battle UI a little, make it look more modern like a pokemon stlye game."
  // An arena for the area; the creature top right on its platform with its card, you bottom left
  // with yours; a message box, and four commands: Fight (your style), Special, Eat, Run.
  let arenaMenu = "main";
  const BATTLE_ART = ["farmyard", "pasture", "meadow", "forest", "deepforest", "coast", "jungle", "frostpeak", "desert", "nile", "hollowcrypt"];   // (the crypt: the Ossuary; at night the Wisp marsh -- Cam's, 2026-10-16)   // art/battle-<ground>.webp                                   // main | style | eat
  const arenaSeen = {key: "", t: 0};                         // blows already shown (numbers pop once)
  const theName = (b) => b.boss ? b.monName : "the " + b.monName.toLowerCase();
  const TheName = (b) => b.boss ? b.monName : "The " + b.monName.toLowerCase();
  function arenaHTML(pv, j, s, now) {
    const b = pv.battle, lb = s.lastBoss && now - s.lastBoss.at < 12000 ? s.lastBoss : null;
    const ground = b ? b.ground : j ? j.hunt : lb ? lb.ground : pv.lastTrip && pv.lastTrip.hunt ? pv.lastTrip.hunt : "farmyard";
    const bg = (b && b.pyramid) || (lb && lb.pyramid) ? "pyramid" : ground === "hollowcrypt" && Core.isNight(now) ? "hollowcrypt-night" : BATTLE_ART.includes(ground) ? ground : "";
    return `<div class="pp-arena-wrap">
      <div class="pp-arena arena-${esc(ground)}${bg ? " pp-arena-painted" : ""}" id="pp-arena"${bg ? ` style="background-image:url('art/battle-${bg}.webp')"` : ""}>
        <div class="pp-arena-hills"></div>
        <div class="pp-plat foe"></div><div class="pp-plat you"></div>
        <div class="pp-bcard foe" id="pp-foe-card" hidden>
          <div class="pp-bcard-top"><b id="pp-foe-name"></b><span class="pp-lv" id="pp-foe-lv"></span></div>
          <div class="pp-bhp"><span class="pp-bhp-tag">HP</span><span class="pp-bhp-bar"><span id="pp-foe-hp"></span></span></div>
          <div class="pp-fx" id="pp-foe-fx"></div>
          <div class="pp-know pp-foe-know" id="pp-foe-know" aria-label="What you know of it"></div>
        </div>
        <div class="pp-rustle" id="pp-rustle" hidden><span></span><span></span><span></span></div>
        <img class="pp-sprite foe" id="pp-foe" alt="" hidden>
        ${youHTML(pv.look, "fight", pv.gear, "pp-sprite you", 'id="pp-you"')}
        <img class="pp-sprite you pp-packpet" id="pp-packpet" alt="" hidden>
        <img class="pp-sprite pp-risen" id="pp-risen" alt="" hidden>
        <div class="pp-packstrip" id="pp-packstrip" aria-label="Your pack"></div>
        <div class="pp-bcard you">
          <div class="pp-bcard-top"><b id="pp-you-name">${esc(pv.name)}</b><span class="pp-lv" id="pp-you-lv">Lv${pv.combatLevel}</span></div>
          <div class="pp-bhp"><span class="pp-bhp-tag">HP</span><span class="pp-bhp-bar"><span id="pp-you-hp"></span></span></div>
          <div class="pp-bcard-nums"><span class="pp-bspec" title="Special bar"><span id="pp-you-spec"></span></span><span id="pp-you-hpn"></span></div>
          <div class="pp-bweapons" id="pp-you-weapons"></div>
          <div class="pp-fx" id="pp-you-fx"></div>
        </div>
        <div class="pp-buffs" id="pp-you-buffs" aria-label="On you"></div>
        <div class="pp-pops" id="pp-pops"></div>
        <div class="pp-round" title="Next round"><span id="pp-round-bar"></span></div>
        <div class="pp-arena-tag">${esc(Core.HUNTS[ground].name)}</div>
      </div>
      <div class="pp-arena-ui">
        <div class="pp-msg" id="pp-msg" aria-live="polite"></div>
        <div class="pp-cmds" id="pp-cmds"></div>
        <div class="pp-quick" id="pp-quick" aria-label="Quick-use slots (Shift+1 to 4)"></div>
      </div>
    </div>`;
  }
  // Battle Re-work (2026-10-15): effects on either side, a held turn, a weapon that broke, a swap
  const fxName = (k) => (Core.EFFECTS[k] || {}).name || k;
  function fxText(r, b) {
    const who = r.side === "them" ? TheName(b) : "You", E = Core.EFFECTS[r.kind] || {};
    if (r.immune) return `${who} ${r.side === "them" ? "is" : "are"} immune to that!`;
    if (r.resisted) return `${who} shrug${r.side === "them" ? "s" : ""} it off.`;
    if (r.on) return `${who} ${r.side === "them" ? E.says || "is " + fxName(r.kind).toLowerCase() : "are " + fxName(r.kind).toLowerCase()} — ${r.on} round${r.on === 1 ? "" : "s"}.`;
    return `${E.icon || ""} ${fxName(r.kind)}: ${r.side === "them" ? theName(b) : "you"} take${r.side === "them" ? "s" : ""} ${r.hit}.`;
  }
  function roundText(r, b, pv) {
    const ally = pv.ally ? pv.ally.name : "Your companion";
    if (r.by === "fx") return fxText(r, b);
    if (r.by === "pet" && r.pet && r.risen && !r.move) {   // the risen (Part 13)
      const p = esc(r.pet);
      if (r.rose) return `<b class="pp-msg-hi">Raise the fallen</b>: ${p} rises to fight beside you!`;
      if (r.stays) return `${p} is still beside you.`;
      if (r.mended) return `<b class="pp-msg-hi">Mend the dead</b>: ${p} +${r.mended} health.`;
      if (r.army) return `<b class="pp-msg-hi">Army of the dead</b>: your risen will strike twice!`;
      if (r.ritesOn) return `<b class="pp-msg-hi">Last rites</b>: the next risen to fall will stand again.`;
      if (r.rites) return `${p} falls -- and stands again!`;
      if (r.fell) return `<b>${p} falls</b>, and goes back to rest in the graveyard.`;
    }
    if (r.by === "pet" && r.pet) {                 // a Beast Master's pets (Part 11b)
      const p = esc(r.pet), m = r.move ? `<b class="pp-msg-hi">${esc(r.move)}</b>` : "";
      if (r.swapIn) return `${p} steps in!`;
      if (r.ate) return `${p} eats — that's its turn.`;
      if (r.heal) return `${p} uses ${m}: +${r.heal} health.`;
      if (r.guard) return `${p} uses ${m} and braces.`;
      if (r.fade) return `${p} uses ${m} and fades from sight.`;
      if (r.status) return `${p} uses ${m}!`;
      if (r.dodged) return `${TheName(b)} dodged ${p}'s ${m}!`;
      return r.hit ? `${p}'s ${m} hits for ${r.hit}!${r.strong ? " It's strong against it!" : r.weak ? " It isn't very strong against it." : ""}` : `${p}'s ${m} missed.`;
    }
    if (r.by === "them" && r.tell) return `<b class="pp-msg-hi">${TheName(b)} ${esc(r.wind)}</b> -- <b>${esc(r.tell)}</b> is coming! (${esc(Core.BOSS_TELLS.answers)} will break it)`;   // creature tells
    if (r.by === "them" && r.tellBroken) return `<b class="pp-msg-hi">${esc(r.tellBroken)} breaks</b> -- ${r.why === "smoke" ? "it's lost in the smoke" : r.why === "shield" ? "it meets your shield" : "it can't get to you"}, and staggers!`;
    if (r.by === "them" && r.tellHit && r.hit && !r.pet) return `<b>${esc(r.tellHit)}!</b> ${TheName(b)} hits you for <b>${r.hit}</b>.`;
    if (r.by === "them" && r.pet) return r.dodged ? `${esc(r.pet)} dodged ${theName(b)}!` : r.hit ? `${TheName(b)} hits ${esc(r.pet)} for ${r.hit}!${r.faint ? ` <b>${esc(r.pet)} fainted!</b>` : ""}` : `${TheName(b)} missed ${esc(r.pet)}.`;
    if (r.rally) return `Rally! Your pack heals.`;
    if (r.call) return `${esc(r.spec)}!`;
    if (r.broke) return `Your ${esc(r.broke.toLowerCase())} broke!`;
    if (r.dry) return `Out of ${esc(r.dry.toLowerCase())}s — you fight on with ${r.w && r.w !== "fists" ? `your <b class="pp-msg-hi">${esc(r.w.toLowerCase())}</b>` : "your fists"}!`;   // B5
    if (r.swap) return "You swap weapons — no attack this turn.";
    if (r.gear) return r.gear === "drink" ? "You drink a draught — no attack this turn." : "You change your gear — no attack this turn.";   // (N22)
    if (r.blocked) return r.saved ? `Sanctuary! The blow that would have felled you glances off your shield.` : r.aegis ? `Aegis: ${theName(b)}'s blow can't get through.` : `You block ${theName(b)}'s blow!`;
    if (r.lay) return `Lay on hands: +${r.lay} health.`;
    if (r.smoke) return `${TheName(b)} can't find you in the smoke!`;
    if (r.counter) return `You slip the blow and strike back for ${r.hit}!`;
    if (r.windup) return `You heave your ${esc((r.w || "maul").toLowerCase())} up…`;
    if (r.wind) return `Second wind! +${r.wind} health.`;
    if (r.tool && r.kind === "throw") return `You throw a knife (<b class="pp-msg-hi">${esc(r.w.toLowerCase())}</b>).`;
    if (r.tool) return `${r.kind === "trap" ? "You lay" : "You throw"} ${/^[aeiou]/i.test(r.w) ? "an" : "a"} <b class="pp-msg-hi">${esc(r.w.toLowerCase())}</b>.`;   // a trap or a net (Part 4)
    if (r.held) return r.by === "you" ? `You're ${fxName(r.held).toLowerCase()} — you can't act!` : `${TheName(b)} is ${fxName(r.held).toLowerCase()} and can't act!`;
    if (r.by === "pet") return `${ally} hits ${theName(b)} for ${r.hit}!`;
    if (r.by === "you") {
      if (r.ate) return r.auto ? "Auto-eat: you ate some food." : "You ate — no attack this turn.";
      if (r.reflect) return `Your armour reflects ${r.hit} back!`;
      if (r.w) {                                 // what you used (2026-10-09): "You hit the rat for 6 with Wind Strike!"
        const w = `<b class="pp-msg-hi">${esc(r.w)}</b>`, with_ = r.wp ? `your ${w}` : w, end = r.spec ? "!" : ".";
        return r.dodged ? `${TheName(b)} dodged ${with_}!` : r.hit ? `You hit ${theName(b)} for ${r.hit} with ${with_}${end}` : `${r.wp ? "Your" : ""} ${w} missed!`.trim();
      }
      const sp = r.spec ? `${r.spec}! ` : "";
      return sp + (r.dodged ? `${TheName(b)} dodged!` : r.hit ? `You hit ${theName(b)} for ${r.hit}.` : `You missed!`);
    }
    return r.stunned ? `${TheName(b)} is stunned!` : r.dodged ? `You dodged ${theName(b)}!` : r.hit ? `${TheName(b)} hits you for ${r.hit}!` : `${TheName(b)} missed!`;
  }
  // a number that floats up over whoever was hit
  function pop(host, who, text, kind) {
    const layer = host.querySelector("#pp-pops"), spr = host.querySelector(who === "foe" ? "#pp-foe" : "#pp-you");
    if (!layer) return;
    const el = document.createElement("span");
    el.className = "pp-pop " + kind + " at-" + who;
    el.style.setProperty("--dx", (Math.random() * 30 - 15).toFixed(0) + "px");
    el.textContent = text;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1300);
    if (spr && (kind === "dmg" || kind === "spec")) { spr.classList.remove("hit"); void spr.offsetWidth; spr.classList.add("hit"); }
  }
  function hpClass(pct) { return pct > 50 ? "" : pct > 20 ? "mid" : "low"; }
  function updateArena(host, s, pv, now) {
    const ar = host.querySelector("#pp-arena");
    if (!ar) return;
    const b = pv.battle, j = pv.job && pv.job.hunt ? pv.job : null, f = j && j.fight, lb = s.lastBoss;
    if (!b && towerWords(lb, now)) return;                                     // a won tower duel: back to the tower, the mage's words (PT15)
    const foe = host.querySelector("#pp-foe"), card = host.querySelector("#pp-foe-card"), msg = host.querySelector("#pp-msg");
    // you
    const pct = Math.max(0, Math.min(100, 100 * pv.hp / pv.maxHp));
    const yh = host.querySelector("#pp-you-hp"); yh.style.width = pct + "%"; yh.className = hpClass(pct);
    host.querySelector("#pp-you-hpn").textContent = `${pv.hp} / ${pv.maxHp}`;
    const furyNow = pv.furyNow || 0;                                           // a Berserker's fury: it lasts the hunt (Part 5, PT4)
    const sbar = host.querySelector("#pp-you-spec"); sbar.style.width = (pv.fury ? furyNow || 0 : pv.spec) + "%";
    sbar.classList.toggle("fury", pv.meter === "fury"); sbar.classList.toggle("devotion", pv.meter === "devotion");
    sbar.parentNode.title = pv.fury ? `${pv.meter === "devotion" ? "Devotion" : "Fury"}: ${furyNow || 0}` : "Special bar";
    const fxHTML = (list) => (list || []).map((e) => `<span class="pp-fx-chip" role="img" aria-label="${esc(e.name)}${e.stacks > 1 ? " ×" + e.stacks : ""}: ${e.rounds} round${e.rounds === 1 ? "" : "s"} left" title="${esc(e.name)}${e.stacks > 1 ? " ×" + e.stacks : ""}: ${e.rounds} round${e.rounds === 1 ? "" : "s"} left">${window.PET_ICONS && window.PET_ICONS["obj_fx" + e.kind] ? `<img class="pp-fx-img" alt="" src="${itemIcon("obj_fx" + e.kind, 18)}">` : e.icon}<b>${e.rounds}</b>${e.stacks > 1 ? `<i>×${e.stacks}</i>` : ""}</span>`).join("");
    const setHTML = (sel, html) => { const el = host.querySelector(sel); if (el && el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; } };
    setHTML("#pp-foe-fx", (b && b.tell ? `<span class="pp-fx-chip pp-tell" role="img" aria-label="About to use ${esc(b.tell.move)} -- ${esc(b.tell.answers)} breaks it" title="${esc(b.tell.answers)} breaks it">⚠<b>${esc(b.tell.move)}</b></span>` : "") + fxHTML(b && b.fx && b.fx.them));   // a boss's tell
    // what's on you, bottom left (PT7/PT8, Cam: "an indicator on the left of the battle screen ... We will use that left section
    // as the buffs applied to character"): arrows in the quiver, your blade's poison or blessing, your potions
    const chip = (id, n, title, low) => `<span class="pp-buff${low ? " low" : ""}" title="${esc(title)}"><img alt="" src="${itemIcon(id, 24)}"><b>${n}</b></span>`;
    setHTML("#pp-you-buffs", [
      pv.weapon && pv.weapon.style === "ranged" && pv.ammo ? (() => { const n = pv.ammo.count;   // what's loaded in your quiver (N24)
        return chip(pv.ammo.id, n >= 999 ? "∞" : n, `${pv.ammo.name}: ${n >= 999 ? "∞" : n}${pv.quiver ? ` of ${pv.quiver.cap} in your ${pv.quiver.name.toLowerCase()}` : ""}`, n < 10); })() : "",
      pv.coat ? chip(pv.coat.id, pv.coat.left, `${pv.coat.name} on your blades: ${pv.coat.left} hits left`, pv.coat.left <= 5) : "",
      pv.bless ? chip("holywater", pv.bless.left, `Blessed blade: ${pv.bless.left} hits left`, pv.bless.left <= 5) : "",
      ...Object.keys(pv.brews || {}).map((k) => chip(pv.brews[k].id, pv.brews[k].left, `${pv.brews[k].name}: ${pv.brews[k].left} left -- ${pv.brews[k].does}`, pv.brews[k].left <= 1)),
    ].join(""));
    setHTML("#pp-you-fx", fxHTML(b && b.fx && b.fx.you));
    setHTML("#pp-foe-know", b && b.know ? quarryChips(b.know) + (b.know.mastered ? '<span class="pp-know-chip mastered">Mastered +10%</span>' : "") : "");   // the Bestiary (V6)
    const wv = (w, tag, on) => w ? `<span class="pp-bweapon${on ? " on" : ""}" title="${esc(w.name)}: ${w.left} of ${w.dur} blows left${w.tempered ? " (re-tempered)" : ""}">
        <img alt="" src="${itemIcon(w.id, 16)}"><span class="pp-bwear"><span style="width:${100 - w.pct}%" class="${w.pct >= 90 ? "low" : w.pct >= 75 ? "mid" : ""}"></span></span><small>${tag}</small></span>` : "";
    const using = b ? b.using : "";
    setHTML("#pp-you-weapons", b && b.pack ? "" : pv.weapons && (pv.weapons.main || pv.weapons.off)
      ? wv(pv.weapons.main, "main", b && pv.weapons.main && using === pv.weapons.main.name) + wv(pv.weapons.off, "off", b && pv.weapons.off && using === pv.weapons.off.name && b.usingFrom === "offhand")
        + (b && using === "fists" ? `<span class="pp-bweapon on"><small>fists</small></span>` : "")
        + (b && b.usingFrom === "knife" ? `<span class="pp-bweapon on" title="${esc(using)}: out of arrows, from your bag"><small>${esc(using.toLowerCase())}</small></span>` : "")   // (B5)
      : "");
    // a Beast Master's pack (Part 11b): the front pet stands in your place, every pet's health along the bottom
    const pk = b && b.pack, front = pk ? pk.pets.find((x) => !x.bench && !x.fainted) || pk.pets[0] : null, pp = host.querySelector("#pp-packpet");
    host.querySelector("#pp-you").hidden = !!pk; pp.hidden = !pk;
    if (front) {
      if (pp.dataset.id !== front.id) { pp.src = petURL(front.species, front.colour, 112, "ok"); pp.dataset.id = front.id; }
      host.querySelector("#pp-you-name").textContent = front.name; host.querySelector("#pp-you-lv").textContent = "Lv" + front.level;
      const fp = Math.max(0, Math.min(100, 100 * front.hp / front.maxHp)); yh.style.width = fp + "%"; yh.className = hpClass(fp);
      host.querySelector("#pp-you-hpn").textContent = `${front.hp} / ${front.maxHp}`;
    } else { host.querySelector("#pp-you-name").textContent = pv.name; host.querySelector("#pp-you-lv").textContent = "Lv" + pv.combatLevel; }
    // a Necromancer's risen stands just behind you, its health in the strip (PT19 r3-r5)
    // (PT20 f1: always there while it's in the fight -- lying down, dim, once it has fallen -- and its painted spirit when there is one)
    const rs = b && !pk ? (b.risen || []) : !b ? (pv.huntRisen || []) : [], rUp = rs.find((x) => x.hp > 0) || rs[0], ri = host.querySelector("#pp-risen");
    ri.hidden = !rUp;
    if (rUp && ri.dataset.id !== rUp.id) {
      const sp = window.PET_SPECTRAL && window.PET_SPECTRAL[rUp.species + "/" + rUp.colour];
      ri.src = sp && sp.a ? `art/pets/spectral/${rUp.species}-${rUp.colour}-a.webp` : petURL(rUp.species, rUp.colour, 112, "ok"); ri.dataset.id = rUp.id; ri.alt = rUp.name + " (risen)";
    }
    if (rUp) ri.classList.toggle("down", rUp.hp <= 0);
    if (!rUp) ri.dataset.id = "";
    setHTML("#pp-packstrip", !pk && rs.length ? rs.map((x) => { const q = Math.round(100 * x.hp / x.maxHp);
      return `<span class="pp-packpet-chip risen${x.hp > 0 ? "" : " out"}" title="${esc(x.name)} (risen, level ${x.level}): ${x.hp}/${x.maxHp} -- heals only with Mend the dead or a potion of life essence">
        <b>${esc(x.name)}</b> <small>risen</small><span class="pp-bhp-bar"><span class="${hpClass(q)}" style="width:${q}%"></span></span><small>${x.hp}/${x.maxHp}</small></span>`; }).join("") :
      pk ? pk.pets.map((x) => { const q = Math.round(100 * x.hp / x.maxHp);
      return `<span class="pp-packpet-chip${x.bench ? " bench" : ""}${x.fainted ? " out" : ""}" title="${esc(x.name)} (${esc(x.typeName)}, level ${x.level}): ${x.hp}/${x.maxHp}${x.bench ? " -- on the bench" : ""}">
        <b>${esc(x.name)}</b><span class="pp-bhp-bar"><span class="${hpClass(q)}" style="width:${q}%"></span></span></span>`; }).join("") : "");
    // the creature
    const fainted = !b && ((f && f.won && now - f.at < 1600) || (lb && lb.won && now - lb.at < 1600));
    const showMon = b ? b.mon : fainted ? (f && now - f.at < 1600 ? f.mon : lb.mon) : null;
    if (showMon) {
      if (foe.dataset.mon !== showMon) { foe.src = monsterURL(showMon, 112, true); foe.dataset.mon = showMon; }
      foe.hidden = false;
      foe.classList.toggle("faint", !!fainted);
      foe.classList.toggle("boss", !!Core.MONSTERS[showMon].boss);
    } else { foe.hidden = true; foe.dataset.mon = ""; }
    card.hidden = !b;
    host.querySelector("#pp-rustle").hidden = !!(b || fainted || !j);
    let text = "";
    if (b) {
      host.querySelector("#pp-foe-name").innerHTML = esc(b.monName) + (b.boss ? ' <span class="pp-boss-tag">BOSS</span>' : "");
      host.querySelector("#pp-foe-lv").textContent = "Lv" + b.monLevel;
      const mp = Math.max(0, Math.min(100, 100 * b.mhp / b.monHp)), fh = host.querySelector("#pp-foe-hp");
      fh.style.width = mp + "%"; fh.className = hpClass(mp);
      host.querySelector("#pp-round-bar").style.width = (100 * (1 - b.nextIn / b.round)) + "%";
      // new blows: numbers pop (yours first, theirs a moment later)
      const key = b.start + "/" + b.mon;
      if (arenaSeen.key !== key) { arenaSeen.key = key; arenaSeen.t = b.start; }
      const fresh = b.rounds.filter((r) => r.t > arenaSeen.t);
      if (fresh.length) {
        arenaSeen.t = fresh[fresh.length - 1].t;
        let them = 0;
        fresh.forEach((r) => {
          const later = r.by === "them" ? 650 : 0;
          if (r.by === "them") them++;
          setTimeout(() => {
            if (r.by === "fx") {                                      // effects (Battle Re-work)
              const at = r.side === "them" ? "foe" : "you", E = Core.EFFECTS[r.kind] || {};
              if (r.hit) pop(host, at, "-" + r.hit, "dmg"); else pop(host, at, r.immune ? "immune" : r.resisted ? "resisted" : (E.icon || "") + " " + (E.name || ""), "miss");
            } else if (r.held) pop(host, r.by === "them" ? "foe" : "you", (Core.EFFECTS[r.held] || {}).icon || "…", "miss");
            else if (r.broke) pop(host, "you", "broke!", "miss");
            else if (r.dry) pop(host, "you", "no arrows!", "miss");
            else if (r.swap) pop(host, "you", "swap", "miss");
            else if (r.tool) pop(host, "you", r.kind === "trap" ? "trap!" : "net!", "miss");
            else if (r.windup) pop(host, "you", "…", "miss");
            else if (r.smoke) pop(host, "you", "smoke", "miss");
            else if (r.blocked) pop(host, "you", "block!", "miss");
            else if (r.lay) pop(host, "you", "+" + r.lay, "spec");
            else if (r.wind) pop(host, "you", "+" + r.wind, "spec");
            else if (r.ate) pop(host, "you", r.auto ? "nom!" : "eating…", "miss");
            else if (r.by === "them") pop(host, "you", r.stunned ? "stunned" : r.dodged ? "dodge!" : r.hit ? "-" + r.hit : "miss", r.hit ? "dmg" : "miss");
            else pop(host, "foe", r.dodged ? "dodge!" : r.hit ? "-" + r.hit : "miss", r.hit ? (r.spec ? "spec" : "dmg") : "miss");
          }, later);
        });
      }
      const last = b.rounds.slice(-2);
      text = b.n === 0 ? (b.boss ? `${b.monName} blocks your way!` : `A wild ${b.monName.toLowerCase()} appeared!`)
        : last.map((r) => roundText(r, b, pv)).join("<br>");
      if (b.queued && b.special) text += `<br><b class="pp-msg-hi">${esc(b.special.name)} is ready to fire!</b>`;
      if (b.skip) text += `<br><span class="pp-msg-dim">Eating — your next attack is spent.</span>`;
      const tn = b.toolNext && (b.tools || []).find((x) => x.id === b.toolNext);
      if (tn) text += `<br><span class="pp-msg-dim">Next turn: your ${esc(tn.name.toLowerCase())}.</span>`;
      if (b.danger && b.noRun && !b.manual) text += `<br><b class="pp-msg-hi">One more blow could finish you — nothing runs for you. Eat or Run!</b>`;
    } else {
      host.querySelector("#pp-round-bar").style.width = "0%";
      if (lb && now - lb.at < 12000 && !j) {
        const got = Object.keys(lb.got || {}).map((k) => k === "coins" ? `${lb.got[k]} coins` : `${Core.ITEMS[k] ? Core.ITEMS[k].name : k} ×${lb.got[k]}`).join(", ");
        text = lb.won ? `You beat ${Core.MONSTERS[lb.mon].name}!${got ? `<br><span class="pp-msg-dim">${esc(got)}</span>` : ""}`
          : lb.fled ? `You got away from ${Core.MONSTERS[lb.mon].name}.` : `${Core.MONSTERS[lb.mon].name} was too strong.`;
      } else if (f && now - f.at < 2500) {
        const mn = Core.MONSTERS[f.mon].name.toLowerCase();
        text = f.won ? `The ${mn} fainted! You win.` : f.ran ? "Got away safely!" : f.fled ? "Hurt — you ran!" : `The ${mn} got away…`;
      } else if (j) text = "Looking for prey…";
      else text = "Travel to a hunting ground on the Map and press <b>Hunt here</b>.";
    }
    if (msg.dataset.t !== text) { msg.innerHTML = text; msg.dataset.t = text; }
    arenaCmds(host, s, pv);
  }
  // a menu keeps its place in its list (Cam, PT14 m2: "After beating a creature ... if i have the eat menu open it will jump back
  // to the start. I would like it to keep its current place ... if i close the eat menu and re open it should stay where i left it")
  const menuScroll = {};
  function arenaCmds(host, s, pv) {
    const box = host.querySelector("#pp-cmds");
    if (!box) return;
    if (!box.dataset.keeps) { box.dataset.keeps = "1"; box.addEventListener("scroll", () => { if (box.dataset.menu) menuScroll[box.dataset.menu] = box.scrollTop; }, {passive: true}); }
    arenaCmds0(host, s, pv);
    quickDraw(host, s);                                                   // V16: food by your own hand
    if (box.dataset.menu !== arenaMenu) { box.dataset.menu = arenaMenu; box.scrollTop = menuScroll[arenaMenu] || 0; }
    else if (Math.abs(box.scrollTop - (menuScroll[arenaMenu] || 0)) > 1) box.scrollTop = menuScroll[arenaMenu] || 0;   // redrawn: back where you were
  }
  /** The quick-use slots under the fight (V16): your four foods, Shift+1 to 4 (1-9 press the commands, C3). */
  function quickDraw(host, s) {
    const el = host.querySelector("#pp-quick"); if (!el) return;
    const html = quickSlotsHTML(s);
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  }
  /** The four quick slots' buttons -- under the fight, and in the Kit's Combat tab (2026-10-20). */
  function quickSlotsHTML(s) {
    const q = s.player.quick || [];
    return [0, 1, 2, 3].map((i) => { const id = q[i], it = Core.ITEMS[id], n = id ? (s.bag[id] || 0) : 0;
      const does = !it ? "" : it.heal ? `+${it.heal} health` : it.brew ? "drink it" : it.hunterTool ? (it.hunterTool.kind === "trap" ? "lay it, your next turn" : "throw it, your next turn") : "";   // (N22: traps and draughts too)
      // (aria-disabled, not disabled: an empty slot still takes a drop from the bag -- 2026-10-20, Cam: "drag something from my bag and drop it into a quick use slot")
      return `<button class="pp-quick-slot${it ? "" : " empty"}" data-quick="${i}" ${it && n ? "" : 'aria-disabled="true"'} title="${it ? `${esc(it.name)}: ${does} (Shift+${i + 1}) -- right-click to empty it` : `Slot ${i + 1}: drag food, a draught or a trap here from your bag`}">
        <small>⇧${i + 1}</small>${it ? `<img alt="" src="${itemIcon(id, 32)}"><span>${n}</span>` : ""}</button>`; }).join("");
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest && e.target.closest("[data-quick]"); if (!b || b.getAttribute("aria-disabled") === "true") return;
    const r = await act("quick", {op: "use", i: +b.dataset.quick}); if (r && r.error) toast(r.error, true);
  });
  // drag from the Kit's bag onto a slot (2026-10-20): it goes on that slot now, mid-fight or not; right-click a slot to empty it
  const quickOf = (e) => e.target.closest && e.target.closest("[data-quick]");
  document.addEventListener("dragover", (e) => {
    const q = quickOf(e); if (!q || !kitDragId) return;
    if (!Core.quickFits(kitDragId)) { e.dataTransfer.dropEffect = "none"; return; }
    e.preventDefault(); e.dataTransfer.dropEffect = "copy"; q.classList.add("drop-over");
  });
  document.addEventListener("dragleave", (e) => { const q = quickOf(e); if (q) q.classList.remove("drop-over"); });
  document.addEventListener("drop", async (e) => {
    const q = quickOf(e); if (!q || !kitDragId) return;
    e.preventDefault(); q.classList.remove("drop-over");
    const id = kitDragId; kitDragId = ""; document.body.classList.remove("np-kit-dragging");
    const r = await act("quick", {op: "set", i: +q.dataset.quick, item: id}); if (r && r.error) toast(r.error, true);
  });
  document.addEventListener("contextmenu", (e) => {
    const q = quickOf(e); if (!q) return;
    e.preventDefault();
    const i = +q.dataset.quick, id = (current().s.player.quick || [])[i];
    ctxMenu(e.clientX, e.clientY, `Quick slot ${i + 1}`, [{label: id ? `Empty it (${Core.ITEMS[id].name.toLowerCase()})` : "It's empty -- drag something here", off: !id, fn: async () => { const r = await act("quick", {op: "set", i, item: ""}); if (r && r.error) toast(r.error, true); }}]);
  });
  document.addEventListener("keydown", async (e) => {
    if (!e.shiftKey || e.ctrlKey || e.altKey || !/^Digit[1-4]$/.test(e.code)) return;
    const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const q = document.querySelector("#pp-quick"); if (!q || !q.getClientRects().length) return;
    e.preventDefault(); const r = await act("quick", {op: "use", i: +e.code.slice(5) - 1}); if (r && r.error) toast(r.error, true);
  });
  // the four commands (and their menus), redrawn only when something on them changes
  function arenaCmds0(host, s, pv) {
    const box = host.querySelector("#pp-cmds"), b = pv.battle;
    // N22 (2026-10-20, Cam: "look to remove the buttons from fighting unless a beast master controlling a pet in battle"): with
    // the kit showing, you fight from it -- the bag (eat, wear, drink, lay a trap), Combat (stance, special, Run), Magic (your
    // next spell). The buttons stay for a pack, and for a narrow window with the kit closed.
    if (!(b && b.pack) && !(pv.cls === "beastmaster" && pv.packPlan) && kitOpen()) {
      const hint = "";                                                  // (2026-10-20, Cam: no explaining writing -- the Kit speaks for itself)
      if (box.dataset.sig !== hint) { box.dataset.sig = hint; box.className = "pp-cmds pp-cmds-kitted"; box.innerHTML = hint; arenaMenu = "main"; }
      return;
    }
    const foods = Core.bagList(s).filter((x) => Core.ITEMS[x.id].heal).sort((x, y) => Core.ITEMS[x.id].heal - Core.ITEMS[y.id].heal);
    const cls = pv.cls ? Core.CLASSES[pv.cls] : null, sp = cls ? Core.specOf(s.player, pv.combat.special) : null;   // (V18)
    // ready in a fight, or between a hunt's fights (pressed then, it fires on the next fight's first blow -- 2026-10-11)
    const nextFight = !b && !!pv.combat.queued;
    const spCost = sp ? (pv.specCosts || {})[pv.combat.special] || sp.cost : 0;   // after your talents
    const ready = b ? !!(b.special && b.special.ready) : !!(pv.job && pv.job.hunt && sp && (pv.fury ? pv.furyNow : pv.spec) >= spCost && !nextFight && !(pv.specLocks || {})[pv.combat.special]);
    const meter = (n) => pv.fury ? `${n} ${pv.meter} (${pv.furyNow || 0})` : `${n}% bar`;
    const spells = (b && b.spells) || [];
    const tools = (b && b.tools) || [];
    const sigNow = [spells.map((x) => x.id + x.can).join(","), b && b.castNext, tools.map((x) => x.id + x.count + x.can).join(","), b && b.toolNext, pv.weapons && pv.weapons.off ? pv.weapons.off.id : "", arenaMenu, !!b, b && b.manual, b && b.danger, pv.combat.style, ready, b && b.queued, nextFight, b && b.skip, pv.spec >= (sp ? sp.cost : 101), pv.furyNow, b && (b.specials || []).map((x) => x.id + x.ready + x.lock).join(","), b && b.bash && (b.bash.why + b.bash.next + b.bashCd), foods.map((x) => x.id + x.count).join(","), !!pv.job, b && b.pack ? b.pack.pets.map((x) => x.id + x.hp + x.last + x.bench + x.fainted + x.moves.map((m) => m.left).join("")).join(",") : ""].join("|");
    if (box.dataset.sig === sigNow) return;
    box.dataset.sig = sigNow;
    const styleName = esc(Core.STYLES[pv.combat.style] ? Core.STYLES[pv.combat.style].name : "Accurate");
    const btn = (cls2, label, sub, data, off) => `<button class="pp-cmd ${cls2}" ${data || ""} ${off ? "disabled" : ""}><b>${label}</b>${sub ? `<small>${sub}</small>` : ""}</button>`;
    // your spells as battle moves (2026-10-15): the loadout, each with what it costs; picking one is your next cast
    const runeText = (c) => Object.keys(c).map((k) => `${c[k]} ${esc(Core.ITEMS[k].name.toLowerCase().replace(/ rune$/, ""))}`).join(", ");
    // traps and nets (Battle Re-work Part 4): laying or throwing one is your next turn
    if (arenaMenu === "tools" && b) {
      const what = (x) => x.kind === "throw" ? [`hits ${x.damage.join("–")}`, "carries your poison", x.keep ? `back ${Math.round(x.keep * 100)}%` : "", `×${x.count}`].filter(Boolean).join(" · ") : [x.holds ? `holds up to ${x.holds} round${x.holds === 1 ? "" : "s"}` : "won't hold this one",
        x.spring ? `snaps ${x.spring.join("–")}` : "", x.bleed ? "bleeds" : "", x.burn ? "burns" : "", x.keep ? `back ${Math.round(x.keep * 100)}%` : "", `×${x.count}`].filter(Boolean).join(" · ");
      box.className = "pp-cmds pp-cmds-cast";
      box.innerHTML = (tools.length ? tools.map((x) => btn("tool" + (b.toolNext === x.id ? " on" : ""), esc(x.name), x.can ? what(x) : esc(x.why),
            `data-tool="${esc(x.id)}" title="${esc(x.name)}: ${esc(x.can ? what(x) : x.why)}"`, !x.can)).join("")
          : `<p class="pp-msg-dim">Nothing in the bag to use — ${pv.cls === "thief" ? "throwing knives are made at the anvil" : "snares at your crafting bench, nets at the spinning wheel, bear traps at the anvil"}.</p>`)
        + btn("back", "Back", b.manual ? "Using one is your move" : "It takes your next attack", 'data-back="1"');
      return;
    }
    // your specials, one tap away (PT7, Cam: "switch specials easier ... It breaks immersion in a fight" -- the UX lead's design:
    // Special still fires the one you have; Specials opens them all, and picking one makes it yours and fires it if you can)
    if (arenaMenu === "specials" && b) {
      box.className = "pp-cmds pp-cmds-cast";
      box.innerHTML = (b.specials || []).map((x) => btn("special" + (pv.combat.special === x.id ? " on" : "") + (x.ready ? " ready" : ""), esc(x.name),
            x.lock ? esc(x.lock) : `${meter(x.cost)}${x.ready ? " · ready" : ""}`, `data-spec-pick="${esc(x.id)}" title="${esc(x.about)}"`, !!x.lock)).join("")
        + btn("back", "Back", "Picking one makes it your special -- and fires it if you can", 'data-back="1"');
      return;
    }
    if (arenaMenu === "cast" && b && b.magic) {
      box.className = "pp-cmds pp-cmds-cast";
      box.innerHTML = (spells.length ? spells.map((x) => btn("cast" + (b.castNext === x.id ? " on" : ""), esc(x.name),
            x.lock ? esc(x.lock) : x.short.length ? "Not enough " + esc(x.short.map((k) => Core.ITEMS[k].name.toLowerCase().replace(/ rune$/, "")).join(", ")) : (x.element ? (x.weak > 1 ? "⚡" : x.weak < 1 ? "▾" : "") + x.element[0].toUpperCase() + x.element.slice(1) + " · " : "") + (runeText(x.cost) || "free") + ` · up to ${x.base}+`,
            `data-cast="${esc(x.id)}" title="${esc(x.name)}: ${esc(runeText(x.cost) || "no runes")}"`, !x.can)).join("")
          : `<p class="pp-msg-dim">No spells loaded — choose up to three in the Spellbook (the Library).</p>`)
        + btn("back", "Back", b.manual ? "Choosing a spell is your move" : "Otherwise your first spell you can pay for", 'data-back="1"');
      return;
    }
    if (arenaMenu === "style") {
      box.className = "pp-cmds";
      box.innerHTML = Object.keys(Core.STYLES).map((k) => btn("fight" + (pv.combat.style === k ? " on" : ""), esc(Core.STYLES[k].name), esc(Core.STYLES[k].about), `data-style="${k}" title="${esc(Core.STYLES[k].about)}"`)).join("")
        + btn("back", "Back", "", 'data-back="1"');
    } else if (arenaMenu === "eat") {
      box.className = "pp-cmds pp-cmds-food";
      box.innerHTML = (foods.length ? foods.map((x) => `<button class="pp-food" data-item="${x.id}" ${pv.hp >= pv.maxHp ? "disabled" : ""}>
          <img alt="" src="${itemIcon(x.id, 24)}"><span><b>${esc(x.name)}</b><small>+${Core.ITEMS[x.id].heal} HP · ×${x.count}</small></span></button>`).join("")
        : `<p class="pp-msg-dim">No food in the bag. Fruit heals a little; cooked food much more.</p>`)
        + btn("back", "Back", b ? "Eating costs your next attack" : "", 'data-back="1"');
    } else if (b && b.pack && arenaMenu === "moves") {   // each pet's moves (Part 11b): a pick repeats until you change it
      box.className = "pp-cmds pp-cmds-cast";
      const fightingPets = b.pack.pets.filter((x) => !x.bench && !x.fainted);
      box.innerHTML = fightingPets.map((x) => x.moves.map((m) => btn("cast" + (x.last === m.id ? " on" : ""), `${fightingPets.length > 1 ? esc(x.name) + ": " : ""}${esc(m.name)}`,
            `${m.mult > 1 ? "⚡ strong · " : m.mult < 1 ? "▾ weak · " : ""}${m.left !== null ? `${m.left}/${m.max} PP` : esc(m.about)}`, `data-pmove="${x.i}:${esc(m.id)}" title="${esc(m.about)}"`, m.left === 0)).join("")).join("")
        + btn("back", "Back", "Left alone, each pet picks its own", 'data-back="1"');
      return;
    } else if (b && b.pack && arenaMenu === "petfeed") {   // food on a pet: its turn
      box.className = "pp-cmds pp-cmds-food";
      const fightingPets = b.pack.pets.filter((x) => !x.bench && !x.fainted && x.hp < x.maxHp);
      // a Pet tonic for a pet whose moves are running low (PT18 p4: the tonic lives in the hunt now)
      // (PT20 f3: always in the list -- greyed, with why, when it can't be used yet)
      const tonics = (s.dev && s.dev.infinite) ? 999 : (s.bag || {}).pettonic || 0, inFight = b.pack.pets.filter((x) => !x.bench && !x.fainted);
      const tonicBtns = inFight.map((x) => { const used = x.moves.some((m) => m.left !== null && m.left < m.max), why = !tonics ? "none in your bag -- the apothecary table makes them" : !used ? "its PP are full" : "";
        return `<button class="pp-food" data-ptonic="${x.i}" ${why ? "disabled" : ""}><img alt="" src="${itemIcon("pettonic", 24)}"><span><b>${esc(x.name)}: Pet tonic</b><small>${why ? esc(why) : `fills its PP · ×${tonics >= 999 ? "∞" : tonics}`}</small></span></button>`; }).join("");
      box.innerHTML = tonicBtns + (foods.length && fightingPets.length ? fightingPets.map((x) => { const gap = x.maxHp - x.hp, fd = foods.find((f) => Core.ITEMS[f.id].heal * Core.BEAST_FIGHT.foodCut >= gap) || foods[foods.length - 1];
          return `<button class="pp-food" data-pfeed="${x.i}:${fd.id}"><img alt="" src="${itemIcon(fd.id, 24)}"><span><b>${esc(x.name)}: ${esc(fd.name)}</b><small>${x.hp}/${x.maxHp} · ×${fd.count}</small></span></button>`; }).join("")
        : `<p class="pp-msg-dim">${foods.length ? "Nobody's hurt." : "No food in the bag."}</p>`) + btn("back", "Back", "Feeding takes that pet's turn", 'data-back="1"');
      return;
    } else if (b && b.pack && arenaMenu === "petswap") {
      box.className = "pp-cmds pp-cmds-cast";
      const inFight = b.pack.pets.filter((x) => !x.bench && !x.fainted), bench = b.pack.pets.filter((x) => x.bench && !x.fainted);
      box.innerHTML = inFight.flatMap((x) => bench.map((y) => btn("swap", `${esc(y.name)} in`, `for ${esc(x.name)} · ${y.hp}/${y.maxHp}`, `data-pswap="${x.i}:${y.i - b.pack.size}"`))).join("")
        + btn("back", "Back", "The one stepping in loses its turn", 'data-back="1"');
      return;
    } else if (arenaMenu === "actions") {           // your class's extras (C3)
      box.className = "pp-cmds pp-cmds-cast";
      box.innerHTML = cmdExtras().join("") + btn("back", "Back", "", 'data-back="1"');
    } else {
      // the same four, always in the same places (C3, the UX lead: "the one you need in a hurry moves depending on your class
      // and gear") -- Attack (or Cast, or your Style), Special, Eat, Run -- and Actions for the rest. Keys 1-5.
      box.className = "pp-cmds pp-cmds-four";
      const manual = !!(b && b.manual), nextSpell = b && b.castNext && spells.find((x) => x.id === b.castNext);
      const pk = b && b.pack, pfront = pk && pk.pets.find((x) => !x.bench && !x.fainted), plast = pfront && pfront.moves.find((m) => m.id === pfront.last);
      const first = pk ? btn("fight", "Moves", plast ? esc(plast.name) + " (repeats)" : "Each picks its own", 'data-menu="moves"') : b && b.magic ? btn("cast" + (nextSpell ? " queued" : ""), "Cast", nextSpell ? "Next: " + esc(nextSpell.name) : spells.length ? (manual ? "Pick your spell" : "Pick your next spell") : "No spells loaded", 'data-menu="cast"')
        : manual ? btn("fight ready" + (b.danger ? " danger" : ""), "Attack", b.danger ? "One blow could finish you" : styleName, 'data-attack="1"' + (b.danger ? ' data-risky="1"' : ""))
        : btn("fight", "Fight", styleName, 'data-menu="style"');
      const special = manual ? btn("special" + (ready ? " ready" : ""), sp ? esc(sp.name) : "Special", !cls ? "Choose a class" : !sp ? "Choose one below" : meter(spCost), 'data-special="1"', !ready)
        : btn("special" + ((b && b.queued) || nextFight ? " queued" : ready ? " ready" : ""), sp ? esc(sp.name) : "Special",
              !cls ? "Choose a class" : !sp ? "Choose one below" : b && b.queued ? "Next attack!" : nextFight ? "Next fight!" : ready ? "Ready!" : meter(spCost),
              'data-special="1"', !ready || (b && b.queued) || nextFight);
      const eat = pk ? btn("eat", "Feed", foods.length ? "A pet, its turn" : "No food", 'data-menu="petfeed"') : btn("eat", "Eat", manual ? (foods.length ? "Uses your attack" : "No food") : foods.length ? `${foods.length} food${foods.length === 1 ? "" : "s"}` : "No food", 'data-menu="eat"');
      const run = b ? btn("run", "Run", b.boss ? "Counts as a loss" : "Back to hunting", 'data-run="1"') : btn("run", "Home", "Stop hunting", 'data-home="1"', !pv.job);
      const extras = cmdExtras();
      // your other specials: a small ▾ on Special, not a menu of their own (PT11 x1: "Actions only when there's more than
      // changing your special") -- it comes after the others in the box, so keys 1-4 (and 5, Actions) keep their places
      const more = b && (b.specials || []).length > 1 ? `<button class="pp-cmd-more" data-menu="specials" title="Change your special" aria-label="Change your special">▾</button>` : "";
      box.innerHTML = first + special + eat + run + (extras.length ? btn("actions", "Actions", extras.length + " more", 'data-menu="actions"') : "") + more;
    }
    // the class's extras: style (when the first button isn't it), every special, a shield bash, traps and knives, a swap, manual/auto
    function cmdExtras() {
      const manual = !!(b && b.manual);
      return [
        manual && b.pack ? btn("fight ready", "Go", "The round, with these moves", 'data-attack="1"') : "",
        manual && b.magic ? btn("fight ready" + (b.danger ? " danger" : ""), "Attack", "Your next spell (or bash)", 'data-attack="1"' + (b.danger ? ' data-risky="1"' : "")) : "",
        b && !b.pack && (b.magic || manual) ? btn("style", "Style", styleName, 'data-menu="style"') : "",
        b && b.bash && pv.paladin && pv.offItem && pv.offItem.shield ? btn("bash" + (b.bash.next ? " queued" : ""), "Bash", b.bash.next ? "Next turn!" : b.bashCd ? `${b.bashCd} round${b.bashCd === 1 ? "" : "s"}` : "Stuns", 'data-bash="1"', !!b.bash.why && !b.bash.next) : "",
        b && b.pack && b.pack.pets.some((x) => x.bench && !x.fainted) ? btn("swap", "Swap", "From the bench", 'data-menu="petswap"') : "",
        b && tools.length ? btn("tool" + (b.toolNext ? " queued" : ""), "Tools", b.toolNext ? "Next: " + esc((tools.find((x) => x.id === b.toolNext) || {name: ""}).name) : (tools.some((x) => x.kind === "throw") ? "Throw a knife" : "Trap or net"), 'data-menu="tools"') : "",
        pv.weapons && pv.weapons.off ? btn("swap", "Swap", (b ? "Costs a turn: " : "Next fight: ") + esc(pv.weapons.off.name.toLowerCase()), 'data-swap="1"') : "",
        b && b.boss ? (manual ? btn("auto", "Auto", "Let it play itself", 'data-mode="auto"') : btn("manual", "Manual", "Choose each move", 'data-mode="manual"')) : "",
      ].filter(Boolean);
    }
  }
  // the commands' clicks: one listener on the box, as its buttons are redrawn
  function arenaWire(host) {
    const box = host.querySelector("#pp-cmds");
    // keys 1-9 press the commands in order (C3: "Keyboard keys 1-4 for the big four" -- and Actions, and each menu's choices)
    if (!window.__ppCmdKeys) {
      window.__ppCmdKeys = true;
      document.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.altKey || e.metaKey || !/^[1-9]$/.test(e.key)) return;
        const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        const cmds = document.querySelector("#pp-cmds"); if (!cmds || !cmds.isConnected || !cmds.getClientRects().length) return;
        const b = [...cmds.querySelectorAll("button")][+e.key - 1];   // fixed places: a greyed button keeps its number
        if (!b || b.disabled) return;
        e.preventDefault(); b.click();
      });
    }
    const say = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } };
    box.addEventListener("click", async (e) => {
      const el = e.target.closest("button");
      if (!el || el.disabled) return;
      const again = () => { box.dataset.sig = ""; const c = current(); updateArena(host, c.s, Core.playerView(c.s, c.now), c.now); };
      if (el.dataset.menu) { arenaMenu = el.dataset.menu; return again(); }
      if (el.dataset.back) { arenaMenu = "main"; return again(); }
      arenaMenu = "main";
      if (el.dataset.style) return say(await act("combat", {style: el.dataset.style}));
      if (el.dataset.item) return say(await act("eat", {item: el.dataset.item}));
      if (el.dataset.special) return say(await act("battle", {cmd: "special"}));
      if (el.dataset.run) return say(await act("battle", {cmd: "run"}));
      if (el.dataset.swap) return say(await act("battle", {cmd: "swap"}));
      if (el.dataset.cast) return say(await act("battle", {cmd: "cast", spell: el.dataset.cast}));
      if (el.dataset.specPick) {                                     // a special from the Specials menu: yours now, and fired if you can
        const id = el.dataset.specPick, x = ((current().s.player.battle && Core.playerView(current().s, current().now).battle) || {specials: []}).specials.find((y) => y.id === id);
        const r = await act("combat", {special: id});
        if (r && r.error) return say(r);
        return say(x && x.ready ? await act("battle", {cmd: "special"}) : r);
      }
      if (el.dataset.bash) return say(await act("battle", {cmd: "bash"}));   // a Paladin's shield bash (Part 8)
      if (el.dataset.tool) return say(await act("battle", {cmd: "tool", item: el.dataset.tool}));
      if (el.dataset.attack) {
        // permadeath: a blow you might not survive is asked twice
        if (el.dataset.risky && !await askYes("One more blow could finish you -- and a fall loses everything you carry: bag, coins, armour and tools. Attack anyway? (Eat or Run instead?)")) return;
        return say(await act("battle", {cmd: "attack"}));
      }
      if (el.dataset.mode) return say(await act("battle", {cmd: el.dataset.mode}));
      if (el.dataset.pmove) { const [i, mv] = el.dataset.pmove.split(":"); return say(await act("battle", {cmd: "move", i: +i, move: mv})); }   // a pack (Part 11b)
      if (el.dataset.ptonic) return say(await act("battle", {cmd: "pettonic", i: +el.dataset.ptonic}));
      if (el.dataset.pfeed) { const [i, it] = el.dataset.pfeed.split(":"); return say(await act("battle", {cmd: "petfeed", i: +i, item: it})); }
      if (el.dataset.pswap) { const [i, j] = el.dataset.pswap.split(":"); return say(await act("battle", {cmd: "petswap", i: +i, j: +j})); }
      if (el.dataset.home) return say(await act("home"));
    });
  }

  function renderGameOver(host, pv) {
    const mon = Object.keys(Core.MONSTERS).map((k) => Core.MONSTERS[k]).find((m) => m.name === pv.dead.by);
    host.innerHTML = `
      <div class="pp-page pp-gameover">
        ${youHTML(pv.look, "a", pv.gear, "pp-avatar-big", 'style="filter: grayscale(1) brightness(.6)"')}
        <h2 class="page-h">Game over</h2>
        <p>${esc(pv.name)} died to ${esc(mon && !mon.boss ? "a " + pv.dead.by.toLowerCase() : pv.dead.by)}${pv.dead.where ? ` at the ${esc(pv.dead.where)}` : ""}
          on ${esc(new Date(pv.dead.at).toLocaleString())}.</p>
        <p class="stamp">This is a Hell game: death is final. Everything — your pets, the bag, your levels — is gone. Start again from nothing, or play another save slot.</p>
        <div class="pp-place-btns"><button class="btn btn-primary" id="pp-restart">Start again (Hell)</button><button class="btn" id="pp-to-saves">Save slots</button></div>
      </div>`;
    host.querySelector("#pp-restart").addEventListener("click", async () => { tutorStarted.delete(slot); const r = await act("restart"); if (!(r && r.error)) goTo("pet:world"); });   // (PT31 n2: start again on the main island's map, where the tutorial begins -- not the fight)
    host.querySelector("#pp-to-saves").addEventListener("click", () => goTo("pet:saves"));
  }

