  // ---- a mod pack's pictures and pet colours (2026-10-07): the game being played's pack, loaded once ----------
  let modPics = {id: "", items: {}, monsters: {}, regions: {}};
  function modOf() { const st = states[slot]; return (st && st.mod) || null; }
  function modSkin(species, colour, skin) {
    const m = modOf(), c = m && m.pets && m.pets[species] && m.pets[species].colours && m.pets[species].colours[colour];
    return c ? Object.assign({}, c, skin || {}) : skin;
  }
  async function loadModPics() {
    const m = modOf(), id = (m && m.id) || "";
    if (modPics.id === id) return;
    modPics = {id, items: {}, monsters: {}, regions: {}};
    Object.keys(icons).forEach((k) => delete icons[k]);
    if (id) {
      const got = await call("pet_mod_load", [id], "Loading the mod pack");
      if (got && !got.error && modPics.id === id) modPics = {id, items: got.items || {}, monsters: got.monsters || {}, regions: got.regions || {}};
    }
    if (hostEl && hostEl.isConnected) render();
  }
  function itemIcon(name, size) {
    if (modPics.items[name]) return modPics.items[name];
    const as = Core.ITEMS[name] && Core.ITEMS[name].iconAs;          // borrows another's picture until its own is painted (starter crates)
    if (as && !(window.PET_ICONS && window.PET_ICONS[name])) return itemIcon(as, size);
    if (window.PET_ICONS && window.PET_ICONS[name]) return "art/icons/" + name + ".webp";   // a painted icon (2026-10-10 audit, H-6)
    const key = name + "@" + size;
    if (icons[key]) return icons[key];
    const it = Art.itemArt(name) || Art.item(name);
    if (!it) return "";
    const c = document.createElement("canvas");
    const w = it.rows[0].length, h = it.rows.length, sc = Math.max(1, Math.floor(size / Math.max(w, h)));
    c.width = w * sc; c.height = h * sc;
    Art.draw(c.getContext("2d"), it.rows, it.pal, 0, 0, sc, false);
    return (icons[key] = c.toDataURL());
  }

  /** The views: the pet, your skills and trips, the bag. The game's sidebar (game.js) picks one. */
  const page = () => view;
  // ---- celebrations (2026-10-07, Cam OK'd "motion and feedback"): the big moments pop up -- a level, a
  //      new herb, a quest done, a secret found, an egg hatched, a boss beaten, a room built ----------------
  const CHEERS = [
    [/^You reached (.+) level (\d+)!/, (m) => ["⭐", "Level up!", `${m[1]} ${m[2]}`, levelUnlockList(m[1], +m[2])]],
    [/: "Thank you!" Quest done -- (.+?) \(/, (m) => ["📜", "Quest complete", m[1]]],
    [/^Story, chapter (\d+) done: (.+?) \(/, (m) => {                 // the last chapter of a part: the next part begins
      const cur = Core.STORY.find((c) => c.n === +m[1]), nx = Core.STORY.find((c) => c.n === +m[1] + 1);
      return ["📜", `Chapter ${m[1]} complete`, m[2] + (cur && nx && nx.arc !== cur.arc ? ` — Part ${nx.arc} begins: ${Core.STORY_ARCS[nx.arc]}` : "")]; }],
    [/^Exploring the (.+?), you found (.+?)!/, (m) => ["🧭", `Found in the ${m[1]}`, m[2].charAt(0).toUpperCase() + m[2].slice(1)]],
    [/hatched -- it's a (.+?)!/, (m) => ["🥚", "Hatched!", m[1]]],
    [/^You beat (.+?)! \(/, (m) => ["⚔", "Boss beaten", m[1]]],
    [/^You built an? (.+?) \(/, (m) => ["🏠", "Built", m[1].charAt(0).toUpperCase() + m[1].slice(1)]],
    [/^New in your Herbarium: (.+?)!/, (m) => ["🌿", "New herb", m[1]]],
    [/^A rare find at the .+?: (.+?)!/, (m) => ["💎", "Rare find", m[1].charAt(0).toUpperCase() + m[1].slice(1)]],
  ];
  const COMBAT_POP = {attack: 1, ranged: 1, magic: 1, defence: 1, hitpoints: 1};
  let cheerSeen = null;
  const cheerQueue = [];
  function cheerCheck(st) {
    const log = (st && st.log) || [], key = (e) => e.t + "|" + e.text;
    if (cheerSeen === null) { cheerSeen = new Set(log.slice(0, 60).map(key)); return; }
    const fresh = log.slice(0, 20).filter((e) => !cheerSeen.has(key(e)));
    fresh.forEach((e) => cheerSeen.add(key(e)));
    fresh.reverse().forEach((e) => {
      // a combat skill's level with something new: the Unlocks pop-up, which waits for you (2026-10-20, Cam: "when leveling a
      // combat skills have a pop up arise with relevent unlocks")
      const lm = e.text.match(/^You reached (.+) level (\d+)!/), ck = lm && COMBAT_POP[Object.keys(Core.SKILLS).find((x) => Core.SKILLS[x].name === lm[1])];
      if (ck) { const list = levelUnlockList(lm[1], +lm[2]); if (list.length) { showUnlocks({at: e.t, title: `${lm[1]} level ${lm[2]}`, list}); return; } }
      for (const [re, f] of CHEERS) { const m = e.text.match(re); if (m) { cheerQueue.push(f(m)); break; } }
    });
    if (cheerQueue.length > 4) cheerQueue.splice(0, cheerQueue.length - 4);   // a long time away: the last few
    if (!document.querySelector(".pp-cheer")) cheerNext();
  }
  // the Unlocks pop-up (2026-10-10, Cam: "once i complete a quest that has an unlock assigned ... a Bronze bar on the left,
  // title says Unlocks then the divider and the unlocks there"): the game's leafy frame, one row a thing opened
  let unlockSeen = null;
  function unlockCheck(st) {
    const list = (st && st.unlocked) || [];
    if (unlockSeen === null) { unlockSeen = new Set(list.map((u) => u.at)); return; }
    const fresh = list.filter((u) => !unlockSeen.has(u.at));
    fresh.forEach((u) => { unlockSeen.add(u.at); showUnlocks(u); });
  }
  function showUnlocks(u) {
    const box = document.createElement("div");
    box.className = "pp-modal pp-unlock-modal";
    box.innerHTML = `<div class="pp-modal-card pp-unlock-card" role="dialog" aria-label="Unlocks">
        <div class="pp-shop-head pp-unlock-head">
          <img class="pp-unlock-pic" alt="" src="${itemIcon(u.list[0].icon, 96)}">
          <div><b class="pp-unlock-title">Unlocks</b><div class="stamp">${esc(u.title)}</div></div>
        </div>
        <ul class="pp-unlock-list">${u.list.map((x) => `<li><img alt="" src="${itemIcon(x.icon, 48)}"><span>${esc(x.text)}</span></li>`).join("")}</ul>
        <div class="pp-unlock-go"><button class="btn btn-primary pp-unlock-ok">Continue</button></div>
      </div>`;
    const close = () => box.remove();
    box.addEventListener("click", (e) => { if (e.target === box || e.target.closest(".pp-unlock-ok")) close(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape" || e.key === "Enter") close(); });
    document.body.appendChild(box);
    const ok = box.querySelector(".pp-unlock-ok"); if (ok) ok.focus();
  }
  // what the new level opens, for the level-up celebration (2026-10-10, Cam: "when leveling a skill ... have the unlocks as well")
  function levelUnlockList(skillName, level) {
    const k = Object.keys(Core.SKILLS).find((x) => Core.SKILLS[x].name === skillName);
    return k ? Core.levelUnlocks(k, level, current().s) : [];   // (with the save: your class's gear, the grounds a combat level opens)
  }
  function cheerNext() {
    const c = cheerQueue.shift();
    if (!c) return;
    const el = document.createElement("div");
    el.className = "pp-cheer";
    el.setAttribute("role", "status");
    const bits = Array.from({length: 18}, (_, i) => `<i style="--dx:${Math.round(Math.cos(i * 0.35) * 160)}px;--dy:${Math.round(-60 - 120 * ((i * 37) % 10) / 10)}px;--r:${i * 47}deg;--c:${["#f2c43c", "#e8a0bf", "#5fbf7a", "#6fa8dc", "#f29a2e"][i % 5]}"></i>`).join("");
    const un = c[3] || [], MAXU = 5;
    const list = un.length ? `<div class="pp-cheer-unlocks"><div class="pp-cheer-unlocks-h">Unlocks</div>
        ${un.slice(0, MAXU).map((x) => `<div class="pp-cheer-unlock"><img alt="" src="${itemIcon(x.icon, 32)}"><span>${esc(x.text)}</span></div>`).join("")}
        ${un.length > MAXU ? `<div class="stamp">and ${un.length - MAXU} more</div>` : ""}</div>` : "";
    el.innerHTML = `<div class="pp-cheer-card${un.length ? " has-unlocks" : ""}"><span class="pp-cheer-icon">${c[0]}</span><small>${esc(c[1])}</small><b>${esc(c[2])}</b>${list}${bits}</div>`;
    document.body.appendChild(el);
    let gone = false;
    const done = () => { if (gone) return; gone = true; el.classList.add("out"); setTimeout(() => { el.remove(); cheerNext(); }, 350); };
    el.addEventListener("click", done);
    setTimeout(done, un.length ? 6500 : 2400);                       // longer when there's a list to read
  }
