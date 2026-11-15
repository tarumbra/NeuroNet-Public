  // ---- you: the character, the skills, the trips (slice 2) -------------------------------
  // painted people (2026-10-10, Cam's player sheets; art/player/manifest.js): a portrait by look -- skin, hair, tunic -- and a
  // fighting stance for battles. A reskinned look keeps its pixels (its colours are its own).
  /** A painted egg (an item icon, or one of the egg looks painted for the hatchery: starter, special, bred, coast). */
  function paintedEgg(kind) { const id = kind + "egg"; return window.PET_ICONS && window.PET_ICONS[id] ? `art/icons/${id}.webp` : ""; }
  function paintedLook(lk, pose, skin) {
    if (lk && lk.pic && window.PET_ICONS && window.PET_ICONS["obj_p" + lk.pic]) return `art/icons/obj_p${lk.pic}.webp`;   // a painted person (Cam's portraits, 2026-10-16)
    if (skin || !lk || !window.PLAYER_PICS) return "";
    const key = `${lk.skin | 0}-${lk.hair | 0}-${lk.outfit | 0}`, p = window.PLAYER_PICS[key];
    return p && p[pose] ? `art/player/${key}-${pose}.webp` : "";
  }
  // you (2026-10-11, Cam: "1 male character standing and fighting and 1 female standing and fighting"): a young man or a
  // young woman (look.body "m"/"f"), standing ("a") or fighting (facing right). Worn armour will be drawn onto these exact
  // bodies, so a set's 3-piece colours no longer swap you for the 16-pixel figure. Villagers keep the painted looks above.
  function youURL(lk, pose) { return `art/player/body-${lk && lk.body === "f" ? "f" : "m"}-${pose === "fight" ? "fight" : "a"}.webp`; }
  // worn armour (2026-10-11): each piece is a layer the size of the body (art/worn/<item>-<pose>.webp, cut by
  // tools/lift_worn.py), stacked over you from the legs up. A piece with no art yet simply doesn't show.
  const WORN_ORDER = ["legs", "feet", "torso", "arms", "helmet"];   // a cloak hangs behind you: drawn before the body
  function wornOn(gear) { const m = {}; (gear || []).forEach((g) => { if (g && g.item) m[g.slot] = g.item.id; }); return m; }
  function youHTML(lk, pose, gear, cls, attrs) {
    const p = pose === "fight" ? "fight" : "a", on = wornOn(gear), W = window.WORN_PICS || {};
    const layers = WORN_ORDER.map((s) => on[s]).filter((id) => id && W[id] && W[id][p]);
    const cloak = on.cloak && W[on.cloak] && W[on.cloak][p] ? `<img alt="" src="art/worn/${on.cloak}-${p}.webp">` : "";
    return `<span class="pp-you-pic ${cls}" ${attrs || ""}>${cloak}<img alt="" src="${youURL(lk, p)}">${layers.map((id) => `<img alt="" src="art/worn/${id}-${p}.webp">`).join("")}</span>`;
  }
  function avatarURL(lk, size, skin, pose) {
    const painted = paintedLook(lk, pose || "a", skin);
    if (painted) return painted;
    const a = Art.avatar(lk, false, skin);
    const c = document.createElement("canvas");
    const sc = Math.floor(size / 16);
    c.width = c.height = 16 * sc;
    Art.draw(c.getContext("2d"), a.rows, a.pal, 0, 0, sc, false);
    return c.toDataURL();
  }
  const dur = (secs) => {
    const h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, x = secs % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(x).padStart(2, "0")}`;
  };
  const items = (map) => Object.keys(map || {}).filter((k) => Core.ITEMS[k]).map((k) =>
    `<span class="pp-find" title="${esc(Core.ITEMS[k].name)}"><img alt="" src="${itemIcon(k, 20)}">${map[k]}</span>`).join("");

  function renderMaker(host, pv) {
    // a new game with the tutorial on: Amunet asks the questions, in her window (2026-10-11, Cam: "Lets just have all the
    // character questions in the tutorial window")
    { const c = current(), tv = Core.tutorialView(c.s, c.now);
      if (!pv.made && (tv.on || tv.canStart)) {
        host.innerHTML = `<div class="pp-page"><h2 class="page-h">Welcome to Neurovale</h2>
          <p class="stamp">${esc(Core.GUIDE.name)} is waiting for you in the corner -- answer her questions to make your character.</p></div>`;
        return;
      } }
    // a young man or a young woman (2026-10-11); skin, hair and outfit are shelved
    const body = look.body === "f" ? "f" : "m";
    const bodies = [["m", "A young man"], ["f", "A young woman"]].map(([b, n]) =>
      `<button class="btn btn-sm ${body === b ? "btn-primary" : "btn-quiet"} pp-body" data-b="${b}" aria-pressed="${body === b}">${n}</button>`).join("");
    host.innerHTML = `
      <div class="pp-page">
        <div class="pp-head"><div>
          <h2 class="page-h">${pv.made ? "Your look" : "Welcome to the isle"}</h2>
          <p class="stamp">${pv.made ? "Change how you look." : "Before you go gathering, who are you? You level up your own skills while your pets are small."}</p>
        </div></div>
        <div class="pp-maker">
          <img class="pp-avatar-big" alt="" src="${youURL(look)}">
          <div class="pp-maker-picks">
            <div class="pp-label">You are</div><div class="pp-row">${bodies}</div>
            <div class="pp-name"><input class="input" id="pp-pname" maxlength="24" placeholder="Your name" aria-label="Your name"
              value="${esc(pv.made ? pv.name : "")}"><button class="btn btn-primary" id="pp-begin">${pv.made ? "Save" : "Begin"}</button></div>
            <p class="pp-status" id="pp-status">${esc(status)}</p>
          </div>
        </div>
      </div>`;
    host.querySelectorAll(".pp-body").forEach((b) => b.addEventListener("click", () => {
      const keep = host.querySelector("#pp-pname").value;
      look.body = b.dataset.b;
      renderMaker(host, pv);
      host.querySelector("#pp-pname").value = keep;
    }));
    const go = async () => {
      const r = await act("player", {name: host.querySelector("#pp-pname").value, look});
      if (r && r.error) { status = r.error; toast(r.error, true); host.querySelector("#pp-status").textContent = status; }
      else { makingLook = false; render(); }
    };
    host.querySelector("#pp-begin").addEventListener("click", go);
    host.querySelector("#pp-pname").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }
  let makingLook = false;

  // only the page's own skill: Cam, "dont have digging status appear in Mining, fishing, player screen
  // etc. It clogs up the UI"
  function tripHTML(pv, k) {
    const j = pv.job && !pv.job.hunt && pv.job.skill === k ? pv.job : null;
    if (!j) {
      const t = !pv.job && pv.lastTrip && !pv.lastTrip.hunt && pv.lastTrip.skill === k ? pv.lastTrip : null;
      return t ? `<div class="pp-label">Last trip</div>
        <p class="stamp">${esc(Core.SKILLS[t.skill].name)} at the ${esc(spotName(t.skill, t.spot))}: +${Math.round(t.xp)} xp.</p>
        <div class="pp-finds">${items(t.items)}</div>` : "";
    }
    const pct = j.every ? Math.round(100 * (1 - j.nextIn / j.every)) : 0;
    return `<div class="pp-label">On a trip</div>
      <div class="pp-trip-line"><b>${esc(j.skillName)} at the ${esc(j.spotName)}</b> · +${j.xp} xp
        ${j.boost ? `<span class="pp-boost">+${Math.round(j.boost * 100)}% from your companion</span>` : ""}</div>
      <div class="pp-bar pp-trip-bar"><span style="width:${pct}%"></span></div>
      <p class="stamp">Next find in ${dur(j.nextIn)} · home in ${dur(j.endsIn)}</p>
      ${j.full ? `<p class="pp-trip-full">Bag full: no more ${esc(j.full.toLowerCase())} fits -- you're only earning xp. Store things at home to keep collecting.</p>` : ""}
      <div class="pp-finds">${items(j.items)}</div>`;
  }
  function spotName(skill, id) {
    const sp = Core.SKILLS[skill].spots.find((x) => x.id === id);
    return sp ? sp.name : id;
  }

  // ---- Player: a clean sheet of you (2026-10-04) ---------------------------------------------
  // Cam: "When i click player i should be able to see a clean stat interface ... Please redesign the
  // player screen to look more modern and usable." Who you are up top; combat and class side by side;
  // every skill as one compact row (click one to go and train it).
  // the skills' pictures and the Player page's columns, from the skill registry (2026-10-11, FUT-1)
  const SKILL_ICON = Object.fromEntries(Core.SKILL_REG.map((k) => [k.id, k.icon]));
  const SKILL_GROUPS = [["Gathering", "gathering"], ["Making", "making"], ["Combat", "combat"]]
    .map(([name, g]) => [name, Core.SKILL_REG.filter((k) => k.group === g).map((k) => k.id)]);
  function skillHome(k) {
    // a gathering skill: the Map -- you find its places out in the world, not from a list (2026-10-10)
    return k === "magic" ? "pet:spellbook" : Core.GATHERING.includes(k) ? "pet:world" : k === "farming" ? "pet:farm" : k === "husbandry" ? "pet:estate" : SKILL_SHOP[k] ? "shop:" + SKILL_SHOP[k] : "pet:hunt";
  }
  // what's next and your records on the Player page (2026-10-12, audit FEAT-4 and FEAT-5): words only, no shortcuts -- you
  // still find each place on the map
  function goalsHTML(goals) {
    if (!goals.length) return "";
    const line = (g) => `<div class="pp-recipe"><img alt="" src="${itemIcon(g.icon, 32)}"><div class="pp-recipe-main">
        <div><b>${esc(g.name)} ${g.level}</b> <span class="stamp">${g.xpToGo.toLocaleString()} xp to go</span></div>
        <div class="stamp">${esc(g.text)}${g.more ? ` -- and ${g.more} more` : ""}</div></div></div>`;
    return `<section class="pl-card pl-goals"><h3>What's next</h3>
        <p class="pl-note">The nearest level in each skill that opens something new.</p>
        ${goals.slice(0, 6).map(line).join("")}
        ${goals.length > 6 ? `<details><summary class="stamp">Every skill (${goals.length})</summary>${goals.slice(6).map(line).join("")}</details>` : ""}
      </section>`;
  }
  function recordsHTML(rv) {
    return `<section class="pl-card pl-records"><h3>Records</h3>
        <div class="pl-stats">${rv.rows.map((r) => `<div class="pl-stat"><img alt="" src="${itemIcon(r.icon, 24)}"><span class="pl-stat-l">${esc(r.label)}</span>
          <b class="pl-stat-v">${typeof r.value === "number" ? r.value.toLocaleString() : esc(String(r.value))}</b></div>`).join("")}</div>
        <p class="pl-note">Your best skills: ${rv.best.map((b) => `${esc(b.name)} ${b.level}`).join(", ")}.${rv.since ? ` Coins, things made, trips and hunts counted since ${esc(new Date(rv.since).toLocaleDateString())}.` : " Coins, things made, trips and hunts are counted from your next action."}</p>
      </section>`;
  }
  function renderSkills(host) {
    const {s, now} = current();
    const pv = Core.playerView(s, now), pet = Core.view(s, now), prest = Core.prestigeView(s);   // (prestige marks, Part 12)
    if (!pv.made || makingLook) { if (!makingLook) look = Object.assign({skin: 0, hair: 0, outfit: 0}, pv.look); return renderMaker(host, pv); }
    const comp = pv.companionSkill
      ? `${esc(pet.name)} is your companion: ${esc(pv.companionDoes)}`
      : pet.has ? "Your egg becomes your companion once it hatches" : "Hatch a pet to have a companion";
    const cls = pv.cls ? Core.CLASSES[pv.cls] : null;
    const typeList = (t) => Object.keys(t || {}).map((k) => Core.DTYPES[k].toLowerCase()).join(", ") || "nothing";
    const wt = Core.WEAPONS[pv.weapon && pv.weapon.id] || ["crush"];
    const pct = Math.round(100 * pv.hp / Math.max(1, pv.maxHp));
    const w = pv.worn, sk = pv.skills;
    // V17 (armour weights): RuneScape's equipment stats -- attack by style, Defence by kind of attack; a penalty in red, with its minus sign
    const armourGridHTML = (av) => {
      const n = (v) => `<td class="${v < 0 ? "neg" : v > 0 ? "pos" : ""}">${v < 0 ? "−" + Math.abs(v) : "+" + v}</td>`;
      return `<table class="pl-astats" aria-label="What your gear adds">
        <tbody><tr class="pl-ahead"><th scope="col">Attack</th><th scope="col">Melee</th><th scope="col">Ranged</th><th scope="col">Magic</th><th></th></tr>
        <tr><th scope="row">from gear</th>${n(av.att.melee)}${n(av.att.ranged)}${n(av.att.magic)}<td></td></tr>
        <tr class="pl-ahead"><th scope="col">Defence</th>${av.types.map((k) => `<th scope="col">${esc(Core.DTYPES[k] || k)}</th>`).join("")}</tr>
        <tr><th scope="row">against</th>${av.types.map((k) => n(av.defVs[k])).join("")}</tr></tbody></table>`;
    };
    const stat = (icon, label, val, sub) => `<div class="pl-stat"><img alt="" src="${itemIcon(icon, 24)}"><span class="pl-stat-l">${label}</span>
      <b class="pl-stat-v">${val}</b>${sub ? `<span class="pl-stat-s">${sub}</span>` : ""}</div>`;
    const extras = [];
    if (w.xp) extras.push(`+${Math.round(w.xp * 100)}% gathering xp`);
    if (w.speed < 1) extras.push(`${Math.round((1 - w.speed) * 100)}% faster`);
    if (w.dodge) extras.push(`${Math.round(w.dodge * 100)}% dodge`);
    if (w.brace) extras.push(`${Math.round(w.brace * 100)}% less damage taken`);
    if (w.acc) extras.push(`+${Math.round(w.acc * 100)}% accuracy`);
    if (w.regen) extras.push(`heal ${w.regen} a round`);
    if (w.clsBonus) extras.push(`${w.clsBonus} piece${w.clsBonus === 1 ? "" : "s"} with a ${cls ? cls.name : "class"} bonus`);
    if (w.fit && cls) extras.push(`${w.fit} piece${w.fit === 1 ? "" : "s"} of ${Core.ARMOUR.weights[Core.ARMOUR.fit[pv.cls]].name.toLowerCase()} armour suit your class: +${w.fitDef} Defence, +${w.fit} accuracy`);
    const row = (k) => {
      const q = sk[k];
      return `<button class="pl-skill${trainingSkill(pv) === k ? " on" : ""}" data-k="${k}" data-go="${skillHome(k)}" title="${esc(skillXpText(q))}">
        <img alt="" src="${itemIcon(SKILL_ICON[k], 24)}">
        <span class="pl-skill-name">${esc(q.name)}${pv.companionSkill === k ? ` <span class="pl-star" title="Your companion's skill">★</span>` : ""}</span>
        <span class="pl-skill-lv">${q.level}<small>/${Core.MAX_LEVEL}</small></span>
        <span class="pl-skill-bar"><span class="pp-skill-fill" style="width:${Math.round(q.progress * 100)}%"></span></span>
        <span class="pl-skill-xp pp-skill-xp">${esc(skillXpText(q))}</span>
      </button>`;
    };
    // THE CHARACTER SHEET (2026-10-15, Cam, Q1: "I do get annoyed by having to go through multiple tabs to get what i want
    // done. So the one page is ideal"): You, Skills, Gear, Combat, Records -- one page, a tab each (the Bag stays its own
    // page). Equipment left the Storeroom; choosing your three spells happens here (the Spellbook in the Library is the
    // reference). The tabs switch without a redraw; the one you were on is remembered.
    const TABS = [["you", "You"], ["skills", "Skills"], ["gear", "Gear"], ["combat", "Combat"], ["talents", "Talents"], ["records", "Records"]];
    host.innerHTML = `
      <div class="pp-page pl-page">
        <nav class="pl-tabs" role="tablist">${TABS.map(([k, n]) => `<button class="pl-tabbtn${sheetTab === k ? " on" : ""}" role="tab" data-tab="${k}" aria-selected="${sheetTab === k}">${n}</button>`).join("")}</nav>
        <p class="pp-status" id="pp-status">${esc(status)}</p>
        <div class="pl-tab" data-pane="you"${sheetTab === "you" ? "" : " hidden"}>
        <section class="pl-hero">
          ${youHTML(pv.look, "a", pv.gear, "pl-avatar")}
          <div class="pl-hero-main">
            <div class="pl-name"><h2>${esc(pv.name)}</h2><span class="pl-chip${cls ? "" : " none"}">${cls ? esc(cls.name) : "No class yet"}</span>
              ${(() => { const st = current().s, m = st.mode && Core.MODES[st.mode]; if (!m) return ""; const xp = Core.modeBonus(st, "xp"), dr = Core.modeBonus(st, "drop");
                return `<span class="pl-chip pl-mode pl-mode-${esc(st.mode)}" title="${esc(m.about)}${xp > 1 ? ` -- +${Math.round((xp - 1) * 100)}% xp and ${dr}× rare drops for the risk (V16)` : ""}">${esc(m.name)}${xp > 1 ? ` · +${Math.round((xp - 1) * 100)}% xp` : ""}</span>`; })()}</div>
            <div class="pl-nums">
              <div><span>Total level</span><b>${pv.totalLevel}</b></div>
              <div><span>Combat level</span><b>${pv.combatLevel}</b></div>
              <div><span>Coins</span><b>${coinTxt(pv.coins || 0)}</b></div>
              ${prest.marks ? `<div title="One mark for each game you've finished${prest.marks >= prest.freeRespecAt ? ` -- with ${prest.freeRespecAt}, one respec a game is free` : ""}"><span>Prestige</span><b>${"★".repeat(Math.min(prest.marks, 9))}${prest.marks > 9 ? " " + prest.marks : ""}</b></div>` : ""}
            </div>
            ${prest.legacy && prest.legacy.cls ? `<p class="stamp pl-legacy">Legacy: ${esc(prest.legacyName)} level ${prest.legacy.level} in your last game${prest.legacy.points ? ` -- ${prest.legacy.points} free ${esc(prest.legacyName)} talent point${prest.legacy.points === 1 ? "" : "s"}` : ""}.</p>` : ""}
            <div class="pl-hp"><span>Health <b>${pv.hp} / ${pv.maxHp}</b></span>
              <span class="pl-hp-bar"><span class="${pct > 50 ? "" : pct > 20 ? "mid" : "low"}" style="width:${pct}%"></span></span></div>
            <div class="pl-comp">${comp}</div>
          </div>
          <button class="btn btn-quiet btn-sm pl-look" id="pp-look">Change look</button>
        </section>
        <!-- (your figure and its slots live on Gear only -- I1, Cam: "It feels like a double up", 2026-10-16) -->
        <div class="pl-cols">
          <section class="pl-card"><h3>Your gear in a fight</h3>
            <div class="pl-stats">
              <!-- your combat levels are on the Hunting page's strip and the Skills tab; here, only what your gear adds (C4 D4, 2026-10-16) -->
              ${armourGridHTML(Core.armourView(s.player))}
              ${stat(pv.weapon ? pv.weapon.id : "woodenclub", "Weapon", pv.weapon ? esc(pv.weapon.name) : "Fists", pv.weapon && pv.weapon.style === "magic" ? "casts spells (your Spellbook)" : `hits with ${esc(Core.DTYPES[wt[0]].toLowerCase())}`)}
              ${pv.fury ? stat("fairystone", pv.meter === "devotion" ? "Devotion" : "Fury", (pv.furyNow || 0) + "", pv.meter === "devotion" ? "builds as you block and get hit; lasts the hunt" : "builds as you hit and get hit; lasts the hunt") : stat("fairystone", "Special bar", pv.spec + "%", "+10 a fight")}
            </div>
            ${extras.length ? `<div class="pl-extras">${extras.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
          </section>
          <section class="pl-card"><h3>Class</h3>
            ${classHTML(pv)}
            ${cls ? `<p class="pl-note">You resist ${esc(typeList(cls.resist))} and are weak to ${esc(typeList(cls.weak))}. ${Core.ARMOUR.fit[pv.cls] ? `${esc(cls.name)}s fit ${esc(Core.ARMOUR.weights[Core.ARMOUR.fit[pv.cls]].name.toLowerCase())} armour (${esc(Core.ARMOUR.weights[Core.ARMOUR.fit[pv.cls]].about)}): +10% Defence and +1 accuracy a piece. ` : ""}Snakeskin suits a Hunter, armadillo a Berserker, bat leather the Arcane.</p>` : `<p class="pl-note">A class gives you its weapons, specials and talents.</p>`}
          </section>
        </div>
        </div>
        <div class="pl-tab" data-pane="skills"${sheetTab === "skills" ? "" : " hidden"}>
        <section class="pl-card"><h3>Skills</h3>
          <div class="pl-skillcols">${SKILL_GROUPS.map(([name, keys]) => `<div class="pl-skillgroup"><h4>${name}</h4>${keys.map(row).join("")}</div>`).join("")}</div>
        </section>
        </div>
        <div class="pl-tab" data-pane="gear"${sheetTab === "gear" ? "" : " hidden"}>${paperDollHTML(pv)}<div id="pl-gear"></div></div>
        <div class="pl-tab" data-pane="combat"${sheetTab === "combat" ? "" : " hidden"}>${sheetCombatHTML(pv, s)}</div>
        <div class="pl-tab" data-pane="talents"${sheetTab === "talents" ? "" : " hidden"}>${talentsHTML(Core.talentsView(s))}${techniquesHTML(Core.techniquesView(s))}</div>
        <div class="pl-tab" data-pane="records"${sheetTab === "records" ? "" : " hidden"}>
          ${goalsHTML(Core.goalsView(s, now))}
          ${recordsHTML(Core.recordsView(s, now))}
        </div>
      </div>`;
    const showTab = (k) => {
      sheetTab = k;
      host.querySelectorAll(".pl-tabbtn").forEach((b) => { b.classList.toggle("on", b.dataset.tab === k); b.setAttribute("aria-selected", b.dataset.tab === k); });
      host.querySelectorAll(".pl-tab").forEach((x) => { x.hidden = x.dataset.pane !== k; });
    };
    host.querySelectorAll(".pl-tabbtn").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
    // your figure's slots: a click opens that slot's picker right there (Cam, 2026-10-15: "have the list of available
    // equipment appear rather then directing to the other equipment selector ... reduce the UI a little")
    host.querySelectorAll("[data-doll]").forEach((b) => b.addEventListener("click", () => openSlotPicker(b, "player", b.dataset.doll)));
    renderGear(host.querySelector("#pl-gear"), true);
    host.querySelector("#pp-look").addEventListener("click", () => { makingLook = true; look = Object.assign({}, pv.look); render(); });
    const err = (r) => { if (r && r.error) { status = r.error; toast(r.error, true); const el = host.querySelector("#pp-status"); if (el) el.textContent = status; } };
    wirePlan(host.querySelector('[data-pane="combat"]'), err);
    wireSheetSpells(host.querySelector('[data-pane="combat"]'), err);
    wireTalents(host.querySelector('[data-pane="talents"]'), err);
    host.querySelectorAll(".pp-class-guild").forEach((b) => b.addEventListener("click", () => goTo("pet:guild")));
    host.querySelectorAll(".pl-skill").forEach((b) => b.addEventListener("click", async () => {
      if (s.dev && s.dev.on) {                                     // the sandbox: a click sets the level (Cam, PT6: "click a skill and set the level")
        const lv = await askText({title: `Set ${b.querySelector(".pl-skill-name").textContent.trim()}'s level`, label: `1 to ${Core.MAX_LEVEL}`, value: b.querySelector(".pl-skill-lv").firstChild.textContent.trim(), number: [1, Core.MAX_LEVEL], ok: "Set"});
        if (lv === null) return;
        return err(await act("dev", {op: "level", skill: b.dataset.k, level: +lv}));
      }
      if (b.dataset.go === "pet:world") { worldRegion = ""; seaChart = false; } goTo(b.dataset.go);
    }));
    liveSkills(host, pv, "pet:skills");
  }
  let sheetTab = "you";
  // ---- a slot's picker (2026-10-15): what's in it, and everything that fits, right by the slot -- for you or your pet ----
  function slotChoices(who, slot) {
    const {s, v, now} = current(), pv = Core.playerView(s, now);
    if (who === "player" && slot === "offhand") {
      const off = pv.weapons && pv.weapons.off, main = (pv.weapons && pv.weapons.main) || null;
      const two = main && Core.ITEMS[main.id] && Core.ITEMS[main.id].gear.twoHanded;
      const cur = off || pv.offItem, shieldOk = (id) => Core.canUseClass(current().s.player, Core.ITEMS[id].gear.cls);   // (an old class's too: New Game Plus)
      return {title: "Off hand", note: two ? `Your ${main.name.toLowerCase()} takes both hands.` : "A second weapon (used when your main can't be: no arrows or runes, broken -- or two daggers, two swords), or a shield.",
              current: cur ? {id: cur.id, name: cur.name} : null,
              fits: two ? [] : Core.bagList(s).filter((x) => (Core.isWeapon(x.id) || Core.isShield(x.id)) && (x.id !== (main && main.id) || x.count > 1) && x.id !== (cur && cur.id) && !(Core.ITEMS[x.id].gear || {}).twoHanded)
                .map((x) => ({id: x.id, name: x.name, why: Core.isShield(x.id) && !shieldOk(x.id) ? `for ${Core.clsPlural(Core.ITEMS[x.id].gear.cls)}` : ""}))};
    }
    const list = who === "pet" ? v.gear || [] : pv.gear || [], g = list.find((x) => x.slot === slot);
    if (!g) return null;
    return {title: (who === "pet" ? v.name + ": " : "") + g.name, current: g.item ? {id: g.item.id, name: g.item.name, does: g.item.does} : null,
            fits: g.fits.filter((f) => !g.item || f.id !== g.item.id).map((f) => {      // another class's gear: greyed, with why
              const c = who === "player" && ((Core.ITEMS[f.id] || {}).gear || {}).cls;
              return {id: f.id, name: f.name, why: f.why || (c && c !== pv.cls ? `for ${Core.clsPlural(c)}` : "")}; })};
  }
  function openSlotPicker(anchor, who, slot) {
    document.querySelectorAll(".pp-picker").forEach((x) => x.remove());
    const c = slotChoices(who, slot);
    if (!c) return;
    const {s} = current();
    const doesOf = (id) => { const i = Core.itemInfo(s, id); return i && i.does ? i.does.replace(/^[^:]*: /, "") : ""; };
    const box = document.createElement("div");
    box.className = "pp-picker"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", c.title);
    box.innerHTML = `<div class="pp-picker-head"><b>${esc(c.title)}</b><button class="btn btn-quiet btn-sm pp-picker-x" aria-label="Close">✕</button></div>
      ${c.current ? `<div class="pp-picker-now"><img alt="" src="${itemIcon(c.current.id, 32)}"><span><b>${esc(c.current.name)}</b><small>${esc(c.current.does ? c.current.does.replace(/^[^:]*: /, "") : doesOf(c.current.id))}</small></span>
          <button class="btn btn-sm" data-pick="-">${slot === "offhand" ? "Put away" : "Take off"}</button></div>` : `<p class="stamp">Empty.</p>`}
      ${c.note ? `<p class="stamp">${esc(c.note)}</p>` : ""}
      ${c.fits.length ? `<div class="pp-picker-list">${c.fits.map((f) => `<button class="pp-picker-item" data-pick="${esc(f.id)}" ${f.why ? "disabled" : ""}>
          <img alt="" src="${itemIcon(f.id, 32)}"><span><b>${esc(f.name)}</b><small>${esc(f.why || doesOf(f.id))}</small></span></button>`).join("")}</div>`
        : `<p class="stamp">${c.current ? "Nothing else in your bag fits here." : "Nothing in your bag fits here."}</p>`}`;
    document.body.appendChild(box);
    const r = anchor.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 16);
    box.style.width = w + "px";
    box.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
    const below = r.bottom + 6, h = Math.min(box.offsetHeight, window.innerHeight * 0.7);
    box.style.top = (below + h < window.innerHeight - 8 ? below : Math.max(8, r.top - h - 6)) + "px";
    const close = () => { box.remove(); document.removeEventListener("mousedown", outside, true); document.removeEventListener("keydown", esc_, true); };
    const outside = (e) => { if (!box.contains(e.target) && e.target !== anchor) close(); };
    const esc_ = (e) => { if (e.key === "Escape") close(); };
    setTimeout(() => { document.addEventListener("mousedown", outside, true); document.addEventListener("keydown", esc_, true); }, 0);
    box.querySelector(".pp-picker-x").addEventListener("click", close);
    box.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.pick;
      const res = slot === "offhand" ? await act("offhand", {item: id === "-" ? "" : id}) : id === "-" ? await act("unequip", {item: c.current.id}) : await act("equip", {item: id});
      if (res && res.error) { toast(res.error, true); return; }
      close();
    }));
    (box.querySelector(".pp-picker-item:not([disabled])") || box.querySelector(".pp-picker-x")).focus();
  }
  /** Your figure with every slot around it -- a click on a slot to change it. */
  function paperDollHTML(pv) {
    const by = {}; (pv.gear || []).forEach((g) => { by[g.slot] = g; });
    const off = (pv.weapons && pv.weapons.off) || pv.offItem;             // a weapon, or a Paladin's shield (Part 8)
    const slot = (k) => {
      const g = by[k], it = k === "offhand" ? (off ? {id: off.id, name: off.name} : null) : g && g.item, name = k === "offhand" ? "Off hand" : (g ? g.name : k);
      return `<button class="pl-doll-slot${it ? " full" : ""}" data-doll="${k}" title="${esc(name)}: ${it ? esc(it.name) : "empty"}">
        ${it ? `<img alt="" src="${itemIcon(it.id, 32)}">` : `<span class="pl-doll-empty"></span>`}<small>${esc(name)}</small></button>`;
    };
    return `<section class="pl-doll" aria-label="What you wear">
        <div class="pl-doll-col">${["helmet", "necklace", "cloak", "torso", "arms"].map(slot).join("")}</div>
        <div class="pl-doll-fig">${youHTML(pv.look, "a", pv.gear, "pl-doll-img")}</div>
        <div class="pl-doll-col">${["weapon", "offhand", "ammo", "quiver", "ring", "legs", "feet"].map(slot).join("")}</div>
      </section>`;
  }
  /** The Combat tab: how you fight, your hunt plan, and your three spells. */
  function sheetCombatHTML(pv, s) {
    const sb = Core.spellbookView(s), byId = {};
    sb.spells.forEach((x) => { byId[x.id] = x; });
    const runes = (x) => x.runes.map((r) => `<span class="pp-need-chip${r.free ? "" : (sb.runes.find((y) => y.id === r.id) || {have: 0}).have >= r.n ? "" : " lack"}"><img alt="" src="${itemIcon(r.id, 16)}">${r.free ? "∞" : r.n}</span>`).join("");
    const can = sb.spells.filter((x) => !x.hidden && !x.equipped && !(x.lock && !/in hand$/.test(x.lock)));
    // (N18, 2026-10-19, Cam: "presented in the horizontal rows" -- full-width cards, one after another, as in Dev tools)
    return `<div class="pl-combat pp-plan-rows">
        ${combatHTML(pv)}
      </div>
      <section class="pl-card"><h3>Your ${sb.max === 3 ? "three" : sb.max === 4 ? "four" : sb.max} spells</h3>
        
        <div class="pp-loadout">${Array.from({length: sb.max}, (_, i) => i).map((i) => { const id = sb.loadout[i], x = id && byId[id];
          return x ? `<div class="pp-load-slot"><b>${i + 1}. ${esc(x.name)}</b><span class="stamp">max hit ${x.maxHit} · ${x.casts >= 999 ? "∞" : x.casts} casts</span>
              <span>${i ? `<button class="btn btn-sm btn-quiet" data-sp-up="${id}" title="Cast earlier">↑</button>` : ""}<button class="btn btn-sm btn-quiet" data-sp-off="${id}">Remove</button></span></div>`
            : `<div class="pp-load-slot empty"><span class="stamp">${i + 1}. Empty</span></div>`; }).join("")}</div>
        ${can.length ? `<div class="pp-label">Add a spell</div><div class="pl-spells">${can.map((x) => `<button class="pl-spell" data-sp-on="${x.id}" ${sb.loadout.length >= sb.max ? "disabled" : ""}
            title="${esc(x.about || x.name)}"><b>${esc(x.name)}</b><span class="stamp">Magic ${x.level} · max hit ${x.maxHit}</span><span class="pp-needs">${runes(x)}</span></button>`).join("")}</div>`
          : `<p class="stamp">No more spells to add yet${sb.level < 50 ? " -- more unlock as your Magic grows" : ""}.</p>`}
      </section>`;
  }
  // ---- the Talents tab (Battle Re-work Part 3, 2026-10-15): your class's level, its points and its tree ----
  function talentsHTML(tv) {
    if (!tv.cls) return `<section class="pl-card"><h3>Talents</h3><p class="stamp">Choose a class at the Guild hall in the Village -- each has its own level and its own tree of talents.</p></section>`;
    const pips = (n) => Array.from({length: n.ranks}, (_, i) => `<span class="pl-pip${i < n.rank ? " on" : ""}"></span>`).join("");
    const node = (n) => `<button class="pl-node${n.rank ? " has" : ""}${n.rank >= n.ranks ? " full" : ""}${n.keystone ? " key" : ""}${n.can ? " can" : ""}" data-talent="${n.id}"
        ${n.can ? "" : 'aria-disabled="true"'} title="${esc(n.lock || "Spend a point")}">
        <b>${esc(n.name)}</b><span class="pl-pips">${pips(n)}</span>
        <span class="stamp">${esc(n.about)}</span>
        ${n.choice ? `<span class="pl-or">one or the other</span>` : ""}
        ${n.rank >= n.ranks ? "" : n.can ? `<span class="pl-node-go">+ a point</span>` : `<span class="pl-node-lock">${esc(n.lock)}</span>`}</button>`;
    const tiers = (b) => [0, 1, 2, 3, 4].map((t) => { const ns = b.nodes.filter((n) => n.tier === t); return ns.length ? `<div class="pl-tier"><span class="pl-gate">${t ? `${b.nodes.find((n) => n.tier === t).gate} in ${esc(b.name)}` : "open"}</span>${ns.map(node).join("")}</div>` : ""; }).join("");
    return `<section class="pl-card pl-talents-head">
        <div class="pl-tal-top"><h3>${esc(tv.name)} · ${tv.sandbox ? `<button class="btn btn-sm pl-tal-setlv" title="The sandbox: set your class level (and so your points)">class level ${tv.level} ✎</button>` : `class level ${tv.level}`}</h3>
          <span class="pl-tal-pts"><b>${tv.left}</b> point${tv.left === 1 ? "" : "s"} to spend · ${tv.spent} of ${tv.points} spent${tv.legacyPts ? ` (${tv.legacyPts} from your legacy)` : ""}</span></div>
        <span class="pl-skill-bar"><span class="pp-skill-fill" style="width:${Math.round(tv.progress * 100)}%"></span></span>
        <p class="stamp">${tv.next ? `${tv.next.toLocaleString()} xp to class level ${tv.level + 1}` : "Top level"} -- your class learns from every bit of Attack, Ranged, Magic or Defence xp you earn.
          A point every ${tv.every} class levels. Other classes: ${tv.classes.filter((c) => !c.on).map((c) => `${esc(c.name)} ${c.level}`).join(", ")}.</p>
        <div class="pp-row">
          <button class="btn btn-sm" id="pl-respec" ${tv.respec.any ? "" : "disabled"}>${tv.respec.marked ? "Respec (free: your prestige marks, once a game)" : tv.respec.free ? `Respec (free to level ${tv.respec.freeTo})` : `Respec (🪙 ${tv.respec.cost.toLocaleString()})`}</button>
          ${tv.builds.map((bd) => `<span class="pl-build"><b>${esc(bd.name || "Build " + "AB"[bd.slot])}</b>${bd.has ? ` <span class="stamp">${bd.points} pts</span>` : ""}
            <button class="btn btn-sm btn-quiet" data-build-save="${bd.slot}">Save here</button>${bd.has ? `<button class="btn btn-sm btn-quiet" data-build-load="${bd.slot}">Use</button>` : ""}</span>`).join("")}
        </div>
      </section>
      ${talentTreeHTML(tv)}`;
  }
  // ---- the tree, as a tree (Cam, 2026-10-17: "I cant really see the talent back ground again ... come up with another UI design for
  //      the talent tree" -- he chose design A of the mock-up): each talent a small round badge on the class's painted board,
  //      joined by a line to the one it follows; a click opens its card at the side, where the point is spent. The painting stays
  //      in view. A talent with a painted icon (art/icons/talent_<id>) shows it; the rest show their initials.
  //      Hovering a badge shows its name, ranks and what it does (Cam, 2026-10-18).
  let talentSel = "";
  function talentTreeHTML(tv) {
    const all = tv.branches.reduce((a, b) => a.concat(b.nodes.map((n) => ({b, n}))), []);
    if (!all.some((x) => x.n.id === talentSel)) talentSel = "";
    const pips = (n) => Array.from({length: n.ranks}, (_, i) => `<span class="pl-pip${i < n.rank ? " on" : ""}"></span>`).join("");
    const face = (n) => window.PET_ICONS && window.PET_ICONS["talent_" + n.id] ? `<img alt="" src="art/icons/talent_${esc(n.id)}.webp">`
      : esc(n.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2));
    const badge = (b, n) => `<div class="pl-tslot"><button class="pl-tnode${n.keystone ? " key" : ""}${n.choice ? " choice" : ""}${n.rank ? " has" : ""}${n.rank >= n.ranks ? " full" : ""}${n.can ? " can" : ""}${!n.can && !n.rank ? " locked" : ""}${talentSel === n.id ? " sel" : ""}"
        data-talent-pick="${esc(n.id)}" data-parent="${esc(n.parent || "")}" aria-label="${esc(n.name)}: ${n.rank} of ${n.ranks}" title="${esc(n.name)} (${n.rank}/${n.ranks})&#10;${esc(n.about)}">${face(n)}<span class="pl-tpips">${pips(n)}</span></button>
        <span class="pl-tlabel">${esc(n.name)}</span></div>`;
    const col = (b) => `<div class="pl-tcol${b.later ? " later" : ""}" data-tcol="${esc(b.id)}"><svg class="pl-tlinks" aria-hidden="true"></svg>
        <div class="pl-tbranch" title="${esc(b.about)}">${esc(b.name)} · ${b.later ? "later" : b.spent}</div>
        ${b.later ? `<p class="pl-tlater">${esc(b.about)} Comes with ${esc(b.later)}.</p>` : [0, 1, 2, 3, 4].map((t) => `<div class="pl-ttier">${b.nodes.filter((n) => n.tier === t).map((n) => badge(b, n)).join("")}</div>`).join("")}</div>`;
    const pick = all.find((x) => x.n.id === talentSel);
    const card = pick ? (() => { const {b, n} = pick;
      return `<div class="pl-tcard"><h3>${esc(n.name)}</h3>
          <div class="stamp">${esc(b.name)} · ${n.tier ? `tier ${n.tier} (${n.gate} points in ${esc(b.name)})` : "open from the start"} · ${n.rank}/${n.ranks} rank${n.ranks === 1 ? "" : "s"}${n.keystone ? " · <b>keystone</b>" : ""}${n.choice ? " · one or the other" : ""}</div>
          <p>${esc(n.about)}</p>
          ${n.rank >= n.ranks ? `<p class="stamp">All its ranks are yours.</p>` : n.can ? "" : `<p class="pl-tlock">${esc(n.lock)}</p>`}
          <div class="pp-row"><button class="btn btn-primary" data-talent="${esc(n.id)}" ${n.can ? "" : 'aria-disabled="true"'} title="${esc(n.can ? "Spend a point" : n.lock || "")}">Spend a point</button></div></div>`; })()
      : `<div class="pl-tcard"><h3>Pick a talent</h3></div>`;
    // the key, always in view (Cam, PT18 t3: "A locked one; a keystone; a dashed-ring choice" -- "Where is that?")
    const keyOf = (cls, text) => `<span class="pl-tkey"><span class="pl-tnode pl-tmini ${cls}" aria-hidden="true"></span>${text}</span>`;
    const legend = `<div class="pl-tlegend" aria-label="What the badges mean"><button class="btn btn-sm btn-quiet" data-talk="talents">How the tree works</button>${keyOf("has", "Taken")}${keyOf("can", "You can take it")}${keyOf("locked", "Locked -- needs points in its branch, or the one above")}
        ${keyOf("key", "Keystone (the big ones, at the bottom of a branch)")}${keyOf("choice", "One of two -- take either, not both")}</div>`;
    const boardArt = tv.cls === "arcane" && tv.branches.some((b) => b.id === "necromancy" && !b.locked) ? "necromancer" : tv.cls;
    return `<div class="pl-treewrap"><div class="pl-tree" style="--board: url('art/boards/${esc(boardArt)}.webp'); --cols: ${tv.branches.length}">${tv.branches.map(col).join("")}</div>
        <aside class="pl-tside">${card}</aside></div>
      ${legend}`;
  }
  /** The tree's lines: from each talent to the one it follows (gold once both are taken). After the page is drawn, and on a resize. */
  function talentLinks(host) {
    (host || document).querySelectorAll(".pl-tcol").forEach((col) => {
      const svg = col.querySelector(".pl-tlinks"); if (!svg) return;
      const box = col.getBoundingClientRect(); let out = "";
      col.querySelectorAll(".pl-tnode[data-parent]").forEach((el) => {
        const p = el.dataset.parent && col.querySelector(`.pl-tnode[data-talent-pick="${CSS.escape(el.dataset.parent)}"]`); if (!p) return;
        const a = p.getBoundingClientRect(), c = el.getBoundingClientRect();
        out += `<line class="${el.classList.contains("has") && p.classList.contains("has") ? "lit" : ""}" x1="${a.left + a.width / 2 - box.left}" y1="${a.bottom - box.top}" x2="${c.left + c.width / 2 - box.left}" y2="${c.top - box.top}"/>`;
      });
      svg.innerHTML = out;
    });
  }
  let talentResize = false;
  // techniques (Battle Re-work Part 9): learned in any class's tree, kept for good; two slots for other classes' ones, at 60%
  function techniquesHTML(tq) {
    if (!tq) return "";
    const row = (t) => `<div class="pl-tech${t.on ? " on" : ""}${t.learned ? "" : " locked"}"><b>${esc(t.name)}</b> <span class="stamp">${esc(t.clsName)}${t.own ? " (your class: full strength)" : ""}</span>
        <div class="stamp">${esc(t.about)}</div>
        ${t.own || !t.learned ? `<span class="stamp">${t.learned ? "" : "Not learned yet"}</span>` : `<button class="btn btn-sm" data-tech="${t.id}" data-on="${t.on ? "" : "1"}">${t.on ? "Take out" : "Slot it"}</button>`}</div>`;
    return `<section class="pl-card"><h3>Techniques <span class="stamp">${tq.on.length}/${tq.slots} slots · another class's at ${Math.round(tq.offClass * 100)}%</span></h3>
        
        <div class="pl-techs">${tq.list.map(row).join("")}</div></section>`;
  }
  function wireTalents(host, err) {
    if (!host) return;
    host.querySelectorAll("[data-tech]").forEach((b) => b.addEventListener("click", async () => err(await act("technique", {id: b.dataset.tech, on: !!b.dataset.on}))));
    host.querySelectorAll("[data-talent-pick]").forEach((b) => b.addEventListener("click", () => { talentSel = b.dataset.talentPick; render(); }));
    if (host.querySelector(".pl-tree")) {                                 // the tree's explanation (PT20 t3: "Need this explained in the game maybe by some dialogue")
      setTimeout(() => talkPopup("talents", true), 300);
      host.querySelectorAll("[data-talk]").forEach((b) => b.addEventListener("click", () => talkPopup(b.dataset.talk)));
    }
    requestAnimationFrame(() => talentLinks(host));
    if (!talentResize) { talentResize = true; window.addEventListener("resize", () => requestAnimationFrame(() => talentLinks())); }
    host.querySelectorAll("[data-talent]").forEach((b) => b.addEventListener("click", async () => {
      if (b.getAttribute("aria-disabled")) { toast(b.title, true); return; }
      err(await act("talent", {node: b.dataset.talent}));
    }));
    const sl = host.querySelector(".pl-tal-setlv");
    if (sl) sl.addEventListener("click", async () => {                     // the sandbox: set your class level (PT7)
      const lv = await askText({title: "Set your class level", label: `1 to ${Core.MAX_LEVEL} -- a talent point every 2 levels`, value: 50, number: [1, Core.MAX_LEVEL], ok: "Set"});
      if (lv !== null) err(await act("dev", {op: "level", target: "class", level: +lv}));
    });
    const rs = host.querySelector("#pl-respec");
    if (rs) rs.addEventListener("click", async () => {
      if (!await askYes("Take back every point in this class's tree? " + rs.textContent.trim())) return;
      err(await act("respec", {}));
    });
    host.querySelectorAll("[data-build-save]").forEach((b) => b.addEventListener("click", async () => {
      const name = await askText({title: "Name this build", value: "Build " + "AB"[+b.dataset.buildSave], max: 20, ok: "Save"});
      if (name === null) return;
      err(await act("talentbuild", {op: "save", slot: +b.dataset.buildSave, name}));
    }));
    host.querySelectorAll("[data-build-load]").forEach((b) => b.addEventListener("click", async () => err(await act("talentbuild", {op: "load", slot: +b.dataset.buildLoad}))));
  }
  function wireSheetSpells(host, err) {
    const sb = Core.spellbookView(current().s);
    const set = async (list) => { const r = await act("loadout", {spells: list}); err(r); };
    host.querySelectorAll("[data-sp-on]").forEach((b) => b.addEventListener("click", () => set(sb.loadout.concat([b.dataset.spOn]))));
    host.querySelectorAll("[data-sp-off]").forEach((b) => b.addEventListener("click", () => set(sb.loadout.filter((x) => x !== b.dataset.spOff))));
    host.querySelectorAll("[data-sp-up]").forEach((b) => b.addEventListener("click", () => {
      const l = sb.loadout.slice(), i = l.indexOf(b.dataset.spUp); [l[i - 1], l[i]] = [l[i], l[i - 1]]; set(l); }));
  }

